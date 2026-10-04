// Browserkontrol af den færdige stable/preview-pakke, ikke udviklingskildetræet.
// Bruger lokal HTTP som projektets Playwright-skill kræver. CDN-lyd erstattes
// med samme testdobbel som smoke.spec.js; lyd/netværks-CDN er ikke testens mål.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const site = path.resolve(root, process.argv[2] || '.release-builds/local-channels-20261004');
const output = path.join(root, 'tests/playwright/release-channels-' + Date.now());
const toneStub = fs.readFileSync(path.join(__dirname, 'e2e/smoke.spec.js'), 'utf8').match(/const toneStub = `([\s\S]*?)`;/)[1];
const base = 'http://127.0.0.1:8765/t1d-simulator/';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const results = [];
const report = (name, details = {}) => { results.push({ name, ...details }); console.log('PASS ' + name); };
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
async function desktopGame(page, channel) {
    await page.locator('#startButton').click();
    await page.locator('.mode-card[data-mode="campaign"]').click();
    await page.locator('.level-card[data-level-index="0"]').click();
    await page.locator('#campaignStartBtn').click();
    await page.waitForFunction(() => typeof game !== 'undefined' && game && Number.isFinite(game.trueBG));
    await page.waitForFunction(() => /\d/.test(document.querySelector('#cgmValueDisplayGraph').textContent));
    assert.match(await page.locator('#cgmValueDisplayGraph').innerText(), /\d/);
    await page.locator('.dock-item.d-food').click();
    assert.ok(await page.locator('#dock-panel-food').isVisible());
    await page.screenshot({ path: path.join(output, channel + '-desktop.png') });
    report(channel + ' desktop campaign and food panel');
}
(async () => {
    fs.mkdirSync(output, { recursive: true });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8765, '127.0.0.1', resolve); });
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(process.argv.includes('--chromium') ? {} : { channel: 'chrome' }) });
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const errors = [], missing = [], requests = [];
        context.on('page', page => {
            page.on('pageerror', error => errors.push(error.message));
            page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) missing.push(response.url()); });
            page.on('request', request => requests.push(request.url()));
        });
        await context.route('**/Tone.min.js', route => route.fulfill({ contentType: 'text/javascript', body: toneStub }));
        await context.route('https://fonts.**/*', route => route.abort());
        const stable = await context.newPage();
        await stable.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
        await seed(stable);
        await stable.evaluate(() => {
            localStorage.setItem('release-test-sentinel', 'stable');
            localStorage.setItem('t1dSimCampaignProgress', '{"stableSentinel":true}');
            localStorage.setItem('t1dSimHighscores_test', 'stable-score');
            sessionStorage.setItem('release-test-session', 'stable');
        });
        await desktopGame(stable, 'stable');
        const preview = await context.newPage();
        const beforePreview = requests.length;
        await preview.goto(base + 'preview/index.html', { waitUntil: 'domcontentloaded' });
        assert.equal(await preview.evaluate(() => localStorage.getItem('release-test-sentinel')), null);
        assert.equal(await preview.evaluate(() => sessionStorage.getItem('release-test-session')), null);
        await seed(preview);
        await preview.evaluate(() => {
            localStorage.setItem('release-test-sentinel', 'preview');
            localStorage.setItem('t1dSimHighscores_test', 'preview-score');
        });
        await desktopGame(preview, 'preview');
        const runtimeRequests = requests.slice(beforePreview).filter(url => url.startsWith(base) && /\/(js|assets|sounds)\//.test(url));
        assert.ok(runtimeRequests.length > 15);
        assert.ok(runtimeRequests.every(url => url.startsWith(base + 'preview/')), 'Preview loads only its own runtime files');
        assert.equal(await stable.evaluate(() => localStorage.getItem('release-test-sentinel')), 'stable');
        assert.equal(await stable.evaluate(() => localStorage.getItem('t1d-preview:release-test-sentinel')), 'preview');
        report('Isolated persistence and channel-local runtime requests', { requests: runtimeRequests.length });

        // Samtidige vinduer må ikke dele named target og dermed skifte datakilde.
        const stablePopupPromise = context.waitForEvent('page');
        await stable.evaluate(() => openPhysiologyDashboard());
        const stablePopup = await stablePopupPromise;
        await stablePopup.waitForLoadState('domcontentloaded');
        const previewPopupPromise = context.waitForEvent('page');
        await preview.evaluate(() => openPhysiologyDashboard());
        const previewPopup = await previewPopupPromise;
        await previewPopup.waitForLoadState('domcontentloaded');
        assert.notEqual(stablePopup, previewPopup);
        assert.equal(await stablePopup.evaluate(() => window.name), 'physiologyDashboard-stable');
        assert.equal(await previewPopup.evaluate(() => window.name), 'physiologyDashboard-preview');
        report('Stable and preview dashboards stay separate');

        for (const page of [stable, preview]) {
            await page.evaluate(() => { appSettings.language = 'en'; translateDOM(); });
            await page.waitForFunction(() => document.querySelector('#t1d-release-bar').textContent.includes('version')
                || document.querySelector('#t1d-release-bar').textContent.includes('Preview'));
            for (const viewport of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
                await page.setViewportSize(viewport);
                const bounds = await page.locator('#t1d-release-bar').boundingBox();
                const gameBounds = await page.locator('#game-container').boundingBox();
                assert.ok(bounds.y >= 0 && gameBounds.y >= bounds.y + bounds.height - 1);
                assert.ok(gameBounds.y + gameBounds.height <= viewport.height + 1);
            }
        }
        report('English labels and non-overlapping desktop layout at two sizes');

        // Mobiludgaven er en anden HTML-shell; afprøv dens rigtige slettefunktion.
        await preview.goto(base + 'preview/mobile/', { waitUntil: 'domcontentloaded' });
        assert.equal(await preview.evaluate(() => localStorage.getItem('release-test-sentinel')), 'preview');
        assert.equal(await preview.evaluate(() => DESKTOP_URL), base + 'preview/');
        preview.on('dialog', dialog => dialog.accept());
        await preview.evaluate(() => clearHighscores());
        assert.equal(await stable.evaluate(() => localStorage.getItem('t1dSimHighscores_test')), 'stable-score');
        assert.equal(await preview.evaluate(() => localStorage.getItem('t1dSimHighscores_test')), null);
        report('Preview mobile shares preview data; clearing scores preserves stable');
        await preview.evaluate(() => switchToDesktop());
        await preview.waitForURL(base + 'preview/index.html');
        assert.equal(await preview.evaluate(() => localStorage.getItem('release-test-sentinel')), 'preview');
        await preview.locator('#t1d-release-switch').click();
        await preview.waitForURL(base + 'index.html');
        assert.equal(await preview.evaluate(() => localStorage.getItem('release-test-sentinel')), 'stable');
        report('Mobile-to-desktop and preview-to-stable navigation');

        const phoneContext = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
        phoneContext.on('page', page => {
            page.on('pageerror', error => errors.push(error.message));
            page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) missing.push(response.url()); });
        });
        await phoneContext.route('**/Tone.min.js', route => route.fulfill({ contentType: 'text/javascript', body: toneStub }));
        const phone = await phoneContext.newPage();
        for (const prefix of ['', 'preview/']) {
            await phone.goto(base + prefix + 'index.html', { waitUntil: 'domcontentloaded' });
            await phone.waitForURL(base + prefix + 'mobile/');
            await phone.locator('#t1d-release-bar').waitFor();
            const bar = await phone.locator('#t1d-release-bar').boundingBox();
            const app = await phone.locator('#app').boundingBox();
            assert.ok(app.y >= bar.y + bar.height - 1);
            assert.ok(app.y + app.height <= 668);
            await phone.screenshot({ path: path.join(output, (prefix ? 'preview' : 'stable') + '-phone.png') });
        }
        report('Touch-phone routing and 375 × 667 layout in both channels');
        await phone.evaluate(() => localStorage.setItem('t1d_platform', 'desktop'));
        await phone.goto(base + 'mobile/', { waitUntil: 'domcontentloaded' });
        await phone.evaluate(() => localStorage.setItem('t1d_platform', 'mobile'));
        await phone.goto(base + 'preview/index.html', { waitUntil: 'domcontentloaded' });
        assert.equal(phone.url(), base + 'preview/index.html');
        assert.ok(await phone.locator('#game-container').isVisible());
        report('Preview desktop preference overrides the separate stable mobile preference');

        const blockedContext = await browser.newContext();
        await blockedContext.addInitScript(() => Object.defineProperty(window, 'localStorage', {
            value: window.localStorage, configurable: false, writable: false
        }));
        const blocked = await blockedContext.newPage();
        // Fejlgrenen afbryder med vilje den oprindelige sides DOMContentLoaded.
        await blocked.goto(base + 'preview/index.html', { waitUntil: 'commit' });
        await blocked.waitForFunction(() => document.body?.textContent.includes('Preview storage isolation failed'));
        assert.equal(await blocked.evaluate(() => typeof HovorkaModel), 'undefined');
        assert.equal(await blocked.evaluate(() => window.T1D_RELEASE_READY), undefined);
        await blocked.screenshot({ path: path.join(output, 'storage-blocked.png') });
        report('Unavailable isolation aborts the app before model scripts execute');
        const brokenContext = await browser.newContext();
        await brokenContext.route('**/preview/_release/channel.js*', route => route.abort());
        const broken = await brokenContext.newPage();
        await broken.goto(base + 'preview/index.html', { waitUntil: 'commit' });
        await broken.waitForFunction(() => document.body?.textContent.includes('isolation failed'));
        assert.equal(await broken.evaluate(() => typeof HovorkaModel), 'undefined');
        report('Missing bootstrap also fails closed before app scripts');
        assert.deepEqual(errors, []);
        assert.deepEqual([...new Set(missing)], []);
        report('No uncaught JavaScript errors or missing local assets');
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ site, results, errors, missing }, null, 2));
        fs.writeFileSync(path.join(output, 'rapport.txt'), '\ufeffGenereret: 2026-10-04\nRelease-channel smoke, navigation and layout checks\n'
            + results.map(result => '[OK] ' + result.name.replace('×', 'x')).join('\n')
            + '\nTone.js stubbed; CDN sound not tested.\n', 'utf8');
        console.log('Screenshots/report: ' + output);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
