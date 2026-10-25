// Browserkontrol af den færdige Pages-pakke med én offentlig spiludgave.
// Tester projektsti, gamle preview-adresser, desktop/mobil og fravær af kanal-UI.
// Tone.js erstattes som i smoke.spec.js; lyd fra CDN er ikke denne tests formål.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const site = path.resolve(root, process.argv[2] || '.release-builds/pages');
const output = path.join(root, 'tests/playwright/single-release-' + Date.now());
const toneStub = fs.readFileSync(path.join(__dirname, 'e2e/smoke.spec.js'), 'utf8').match(/const toneStub = `([\s\S]*?)`;/)[1];
const manifest = JSON.parse(fs.readFileSync(path.join(site, 'release-manifest.json'), 'utf8'));
const port = Number(process.env.RELEASE_TEST_PORT || 8765);
const base = `http://127.0.0.1:${port}/t1d-simulator/`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const results = [];
const report = name => { results.push(name); console.log('PASS ' + name); };
const server = http.createServer((req, res) => {
    const url = new URL(req.url, base);
    if (!url.pathname.startsWith('/t1d-simulator/')) { res.writeHead(404).end(); return; }
    let relative = decodeURIComponent(url.pathname.slice('/t1d-simulator/'.length));
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(site, relative);
    if (!file.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
});
async function seed(page) {
    await page.evaluate(() => {
        localStorage.setItem('disclaimerAccepted', 'true');
        localStorage.setItem('t1dWelcomeTourShowOnStartup', 'false');
        localStorage.setItem('t1dWelcomeTourCompleted', 'true');
        localStorage.setItem('t1dSimSettings', JSON.stringify({ language: 'da', muted: true, cgmMuted: true, musicMuted: true }));
    });
    await page.reload();
}
(async () => {
    fs.mkdirSync(output, { recursive: true });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(process.argv.includes('--chromium') ? {} : { channel: 'chrome' }) });
        const errors = [], missing = [], requests = [];
        async function makeContext(options) {
            const context = await browser.newContext(options);
            context.on('page', page => {
                page.on('pageerror', error => errors.push(error.message));
                page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) missing.push(response.url()); });
                page.on('request', request => requests.push(request.url()));
            });
            await context.route('**/Tone.min.js', route => route.fulfill({ contentType: 'text/javascript', body: toneStub }));
            await context.route('https://fonts.**/*', route => route.abort());
            return context;
        }
        const context = await makeContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        await page.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
        await seed(page);
        assert.equal(await page.evaluate(() => window.T1D_RELEASE.commit), manifest.release.commit);
        assert.equal(await page.locator('#t1d-release-bar').count(), 0);
        assert.equal(await page.locator('#t1d-release-switch').count(), 0);
        await page.locator('#startButton').click();
        await page.locator('.mode-card[data-mode="campaign"]').click();
        await page.locator('.level-card[data-level-index="0"]').click();
        await page.locator('#campaignStartBtn').click();
        await page.waitForFunction(() => typeof game !== 'undefined' && game && Number.isFinite(game.trueBG));
        await page.waitForFunction(() => typeof isPaused !== 'undefined' && !isPaused);
        await page.waitForFunction(() => /\d/.test(document.querySelector('#cgmValueDisplayGraph').textContent));
        await page.locator('.dock-item.d-food').click();
        assert.ok(await page.locator('#dock-panel-food').isVisible());
        await page.waitForFunction(() => {
            const panel = document.querySelector('#dock-panel-food');
            return panel.classList.contains('visible') && Number(getComputedStyle(panel).opacity) > 0.99;
        });
        await page.screenshot({ path: path.join(output, 'desktop.png') });
        report('Campaign starts and food opens without channel controls');
        for (const viewport of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
            await page.setViewportSize(viewport);
            const bounds = await page.locator('#game-container').boundingBox();
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1);
        }
        report('Desktop fits 1280 x 800 and 1920 x 1080');
        const popupPromise = context.waitForEvent('page');
        await page.evaluate(() => openPhysiologyDashboard());
        const popup = await popupPromise;
        await popup.waitForURL(base + 'physiology-dashboard.html');
        await popup.waitForLoadState('domcontentloaded');
        assert.equal(new URL(popup.url()).pathname, '/t1d-simulator/physiology-dashboard.html');
        assert.equal(await popup.evaluate(() => window.T1D_RELEASE.commit), manifest.release.commit);
        report('Dashboard uses the same release');
        // Preview-data efterlades urørt. Gamle adresser åbner nu rodens normale lager.
        await page.evaluate(() => {
            localStorage.setItem('release-test-sentinel', 'root');
            localStorage.setItem('t1d-preview:release-test-sentinel', 'previous-preview');
        });
        for (const [oldAddress, destination] of [
            ['preview/', 'index.html'],
            ['preview/index.html?view=test#graph', 'index.html?view=test#graph'],
            ['preview/mobile/', 'mobile/'],
            ['preview/mobile/index.html', 'mobile/']
        ]) {
            await page.goto(base + oldAddress, { waitUntil: 'domcontentloaded' });
            await page.waitForURL(base + destination);
            assert.equal(await page.evaluate(() => localStorage.getItem('release-test-sentinel')), 'root');
            assert.equal(await page.evaluate(() => localStorage.getItem('t1d-preview:release-test-sentinel')), 'previous-preview');
            assert.equal(await page.locator('#t1d-release-bar').count(), 0);
        }
        assert.equal(await page.evaluate(() => DESKTOP_URL), base);
        await page.evaluate(() => switchToDesktop());
        await page.waitForURL(base + 'index.html');
        report('Preview bookmarks redirect to one release; storage and query/hash survive');
        const phoneContext = await makeContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
        const phone = await phoneContext.newPage();
        for (const address of ['index.html', 'preview/index.html']) {
            await phone.goto(base + address, { waitUntil: 'domcontentloaded' });
            await phone.waitForURL(base + 'mobile/');
            const bounds = await phone.locator('#app').boundingBox();
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 668);
            assert.equal(await phone.locator('#t1d-release-bar').count(), 0);
        }
        await phone.screenshot({ path: path.join(output, 'phone.png') });
        report('Root and preview route touch phones to the same mobile app');
        const runtimeRequests = requests.filter(url => url.startsWith(base) && /\/(js|assets|sounds)\//.test(url));
        assert.ok(runtimeRequests.length > 15);
        assert.ok(runtimeRequests.every(url => !url.startsWith(base + 'preview/')));
        assert.deepEqual(errors, []);
        assert.deepEqual([...new Set(missing)], []);
        report('Only root assets load; no JavaScript errors or missing local files');
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ site, results, errors, missing }, null, 2));
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date());
        fs.writeFileSync(path.join(output, 'rapport.txt'), '\ufeffGenereret: ' + date + '\nSingle public release smoke checks\n'
            + results.map(result => '[OK] ' + result).join('\n') + '\nTone.js stubbed; CDN sound not tested.\n', 'utf8');
        console.log('Screenshots/report: ' + output);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
