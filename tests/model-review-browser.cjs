// Browserkontrol af modelreviewets rettelser. Kører hele HTML-suiten og derefter
// en bevidst defekt madnøgle for at kontrollere fejlrapporteringen. Testdoblen
// findes kun i browserens lokale HTTP-svar; projektfiler ændres ikke.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'playwright/2026-10-04-model-fixes');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const server = http.createServer((req, res) => {
        const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
        });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8765, '127.0.0.1', resolve); });
    let browser;
    try {
        browser = await chromium.launch({ headless: true, channel: 'chrome' });
        let stochasticBaseline;
        for (const injectFault of [false, true]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            if (injectFault) {
                await page.route('**/tests/model-validation.html', route => {
                    const source = fs.readFileSync(path.join(root, 'tests/model-validation.html'), 'utf8');
                    const modified = source.replace("validationFood('græskYoghurt', 'Greek yoghurt & walnuts')", "validationFood('missing-review-fixture', 'Greek yoghurt & walnuts')");
                    assert.notEqual(source, modified, 'Fejlinjektion skal ramme den tilsigtede nøgle');
                    return route.fulfill({ status: 200, contentType: 'text/html', body: modified });
                });
            }
            await page.goto('http://127.0.0.1:8765/tests/model-validation.html', { waitUntil: 'load', timeout: 60000 });
            await page.waitForFunction(() => window.modelValidation?.running === false, null, { timeout: 300000 });
            const report = await page.evaluate(() => ({
                ...window.modelValidation,
                status: document.getElementById('status').textContent,
                content: [...document.querySelectorAll('.test-section[data-section-number]')].map(section => ({
                    id: section.id, title: section.querySelector('h2').textContent,
                    results: section.querySelector('[id^="result-"]')?.innerText,
                    conclusions: section.querySelector('[id^="conclusion-"]')?.innerText
                }))
            }));
            report.pageErrors = errors;
            const stochastic = report.content.filter(section => /^J\.[123]\./.test(section.title));
            assert.equal(stochastic.length, 3);
            if (injectFault) assert.deepEqual(stochastic, stochasticBaseline, 'Faste stokastiske samples reproduceres uafhængigt af C.3-fejlen');
            else stochasticBaseline = stochastic;
            const name = injectFault ? 'fault-injection' : 'browser-results';
            fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(report, null, 2));
            assert.equal(errors.length, 0, 'Ingen ufangede JavaScript-fejl');
            assert.equal(report.summary.errors, injectFault ? 1 : 0);
            if (injectFault) assert.match(report.sections.find(s => s.execution === 'error').error, /missing-review-fixture/);
            else {
                await page.screenshot({ path: path.join(output, 'overview.png') });
                for (const prefix of ['C.3.', 'G.5.', 'H.3.', 'I.6.', 'K.1.', 'K.3.']) {
                    const section = report.content.find(s => s.title.startsWith(prefix));
                    assert.ok(section, prefix);
                    await page.locator('#' + section.id).screenshot({ path: path.join(output, prefix.slice(0, 3) + '.png') });
                }
            }
            console.log(JSON.stringify({ name, ...report.summary, pageErrors: errors }));
            await page.close();
        }
        // Afgrænset renderer-test i den faktiske app. De kunstige fluxværdier
        // afprøver nye rækker og tooltips, ikke et fysiologisk scenarie.
        const uiPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await uiPage.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await uiPage.waitForFunction(() => typeof updateEffectsPanel === 'function');
        const ui = await uiPage.evaluate(() => {
            const panel = document.createElement('section');
            panel.style.cssText = 'position:fixed;inset:20px auto auto 20px;width:360px;padding:24px;background:#162238;color:white;z-index:2147483647';
            panel.id = 'review-effects-fixture';
            const list = document.getElementById('effectsList');
            panel.append(list); document.body.append(panel);
            updateEffectsPanel({ forces: [
                { name: 'tissueReturn', direction: 'up', magnitude: 0.4, kind: 'flux' },
                { name: 'glucagonRescue', direction: 'up', magnitude: 0.3, kind: 'flux' },
                { name: 'numericalCorrection', direction: 'up', magnitude: 0.2, kind: 'numerical' },
                { name: 'bolusInsulin', direction: 'down', magnitude: 0.3, kind: 'flux' },
                { name: 'exerciseUptake', direction: 'down', magnitude: 0.4, kind: 'modifier' }
            ] });
            return [...list.querySelectorAll('.effect-row')].map(row => ({
                text: row.innerText, title: row.title, link: row.dataset.link
            }));
        });
        assert.equal(ui.length, 5);
        assert.ok(ui.every(row => row.text.trim() && !row.text.includes('force.')));
        assert.equal(ui.filter(row => !row.link).length, 1, 'Numerisk korrektion har ikke et fysiologilink');
        assert.ok(ui.some(row => /Mekanisme|Mechanism/.test(row.title)));
        assert.ok(ui.find(row => /Mekanisme|Mechanism/.test(row.title)).text.startsWith('◇'));
        await uiPage.locator('#review-effects-fixture').screenshot({ path: path.join(output, 'effects-renderer.png') });
        fs.writeFileSync(path.join(output, 'effects-renderer.json'), JSON.stringify(ui, null, 2));
        console.log('PASS effect-panel renderer: labels, modifier distinction and numerical row');
        await uiPage.close();
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
