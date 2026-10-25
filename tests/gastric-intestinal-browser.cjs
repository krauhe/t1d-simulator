// Browserkontrol af kulhydratprofiler i madmenu, T1D-kit og "Lav selv".
// Bruger isolerede browserkontekster, gemt testfremskridt og rigtige klik.
// Kun lyd-CDN erstattes; appens handlinger og model bliver ikke stubbet.
// Kør: tests/.bin/node.exe tests/gastric-intestinal-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests/playwright/2026-10-25_gut-ui');
const base = 'http://127.0.0.1:8765/';
const toneStub = fs.readFileSync(path.join(__dirname, 'e2e/smoke.spec.js'), 'utf8').match(/const toneStub = `([\s\S]*?)`;/)[1];
const results = [], errors = [], missing = [];
let browser, server, currentPage, stage = 'startup';
const pass = label => { results.push(label); console.log('PASS ' + label); };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

async function ensureServer() {
    try {
        const response = await fetch(base + 'js/foods.js');
        if (response.ok && (await response.text()).includes('appearanceProfileId')) return;
        throw new Error('Port 8765 serverer ikke den aktuelle simulator');
    } catch (error) {
        if (error.message !== 'fetch failed') throw error;
    }
    server = http.createServer((req, res) => {
        const url = new URL(req.url, base);
        if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
        let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
        });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8765, '127.0.0.1', resolve); });
}

async function contextFor(language, viewport, mobile = false) {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    await context.addInitScript(language => {
        // Init-scriptet køres også i about:blank, som ikke har localStorage.
        // Seed kun den lokale app, så testopsætningen ikke skaber egne fejl.
        if (location.origin !== 'http://127.0.0.1:8765') return;
        localStorage.setItem('disclaimerAccepted', 'true');
        localStorage.setItem('t1dWelcomeTourShowOnStartup', 'false');
        localStorage.setItem('t1dWelcomeTourCompleted', 'true');
        localStorage.setItem('t1dMobileDisclaimerSeen', '1');
        localStorage.setItem('t1dMobileOnboarded', '1');
        localStorage.setItem('t1dSimSettings', JSON.stringify({ language, muted: true, cgmMuted: true, musicMuted: true }));
        localStorage.setItem('t1dSimCampaignProgress', JSON.stringify({ version: '1.0', levels: {}, currentLevel: 9, tutorialTipsSeen: [] }));
    }, language);
    await context.route('**/Tone.min.js', route => route.fulfill({ contentType: 'text/javascript', body: toneStub }));
    await context.route('https://fonts.**/*', route => route.abort());
    context.on('page', page => {
        page.on('pageerror', e => errors.push({ stage, message: e.message }));
        page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) missing.push(r.url()); });
    });
    return context;
}

async function openCustom(page) {
    if (!await page.locator('#dock-panel-food').evaluate(p => p.classList.contains('visible'))) await page.locator('.dock-item.d-food').click();
    await page.waitForFunction(() => {
        const p = document.querySelector('#dock-panel-food');
        return p.classList.contains('visible') && Number(getComputedStyle(p).opacity) > .99;
    });
    await page.locator('#customFoodToggle').click();
    await page.waitForFunction(() => {
        const p = document.querySelector('#dock-panel-custom-food');
        return p.classList.contains('visible') && Number(getComputedStyle(p).opacity) > .99;
    });
}

async function checkPoolAfterClick(page, expectedProfile, expectedGrams, action) {
    const before = await page.evaluate(id => game.hovorka.carbPools[id]?.deliveredGrams || 0, expectedProfile);
    await action();
    // Natlig opvågning udsætter den eksisterende flyveanimation, som lukker
    // panelet. Vent på den, før næste menu åbnes; ellers lukker animationen
    // den næste menu og testen måler en hurtigklik-race i stedet for profilen.
    await page.waitForFunction(() => performance.now() > (window._nightPopActiveUntil || 0) + 80);
    const queued = await page.evaluate(() => game.engine.activeIntake.map(i => ({ profile: i.appearanceProfileId, grams: i.carbsTotalRate * i.remainingMin })));
    assert(queued.some(i => i.profile === expectedProfile && Math.abs(i.grams - expectedGrams) < 1e-8), JSON.stringify(queued));
    // Indtaget kom fra brugerens klik. Motoren fremrykkes deterministisk under
    // pause for at kontrollere, at køen leveres til den rigtige pulje.
    const after = await page.evaluate(id => {
        game.engine.step(3);
        return game.hovorka.carbPools[id]?.deliveredGrams || 0;
    }, expectedProfile);
    assert(Math.abs(after - before - expectedGrams) < 1e-7, expectedProfile + ': forkert leveret mængde');
}

async function desktop(language, viewport) {
    stage = `desktop-${language}-${viewport.width}`;
    const context = await contextFor(language, viewport);
    const page = currentPage = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(base + 'index.html', { waitUntil: 'load' });
    await page.locator('#startButton').click();
    // Custom er bevidst gated i kampagnens nuværende enabledFoodRows.
    // Box Challenge giver den offentlige adgang, uden at teste via DOM-omgåelse.
    await page.locator('.mode-card[data-mode="boxchallenge"]').click();
    await page.waitForFunction(() => typeof game !== 'undefined' && game && !isPaused);
    await page.locator('#pauseButton').click();
    await page.waitForFunction(() => isPaused);
    await openCustom(page);
    assert.equal(await page.locator('#customCarbTypeChips .carb-type-chip').count(), 8);
    const layout = await page.locator('#customCarbTypeChips .carb-type-chip').evaluateAll(chips => chips.map(chip => {
        const r = chip.getBoundingClientRect(), label = chip.querySelector('.ct-name');
        const l = label.getBoundingClientRect();
        return { text: label.textContent, visible: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            labelFits: label.scrollWidth <= label.clientWidth + 1 && l.left >= r.left && l.right <= r.right + 1, y: r.y };
    }));
    assert(layout.every(i => i.visible && i.labelFits), JSON.stringify(layout));
    assert.equal(new Set(layout.map(i => Math.round(i.y))).size, 2);
    assert.equal(await page.locator('[data-carb-type="druesukker"] .ct-name').textContent(), language === 'da' ? 'Druesukker' : 'Dextrose');
    assert.equal(await page.locator('[data-carb-type="sukrose"] .ct-name').textContent(), language === 'da' ? 'Hvidt sukker' : 'Table sugar');
    await page.locator('[data-carb-type="druesukker"]').click();
    // Sliderværdier sættes gennem DOM-input-events, ikke ved at kalde addFood.
    await page.evaluate(() => {
        for (const [id, value] of [['customCarbsSlider', 15], ['customProteinSlider', 0], ['customFatSlider', 0]]) {
            const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    assert.equal(await page.locator('#customCarbsVal').innerText(), '15');
    assert.equal(await page.locator('#customKcalDisplay').innerText(), '60');
    assert.equal(await page.locator('#customCarbTypeChips .selected').getAttribute('data-carb-type'), 'druesukker');
    // CSS-valgfarven animeres i 200 ms. Vent på den, så billedet viser sluttilstanden.
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, stage + '.png') });
    await checkPoolAfterClick(page, 'glucose-solid', 15, () => page.locator('#customFoodEat').click());
    await openCustom(page);
    await page.locator('[data-carb-type="sukrose"]').click();
    await checkPoolAfterClick(page, 'sucrose-solid', 15, () => page.locator('#customFoodEat').click());
    await page.locator('.dock-item.d-food').click();
    await checkPoolAfterClick(page, 'glucose-solid', 3, () => page.locator('.preset-chip[data-food="druesukker"]').click());
    // Madpanelet bliver stående ved katalogklik; kittet åbnes gennem docken.
    await page.locator('.dock-item[data-panel="dock-panel-kit"]').click();
    await checkPoolAfterClick(page, 'glucose-solid', 3, () => page.locator('#kitDextroButton').click());
    pass(stage + ': 8 synlige valg, korrekt sprog, custom/katalog/kit leverer rette profiler og gram');
    await context.close();
}

async function mobile(language) {
    stage = 'mobile-' + language;
    const context = await contextFor(language, { width: 375, height: 667 }, true);
    const page = currentPage = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(base + 'mobile/index.html', { waitUntil: 'load' });
    await page.locator('.start-mode-card[onclick="startScreenChoose(\'campaign\')"]').click();
    await page.locator('#lsGrid .lc').nth(5).click();
    await page.locator('#ciStartBtn').click();
    await page.waitForFunction(() => !document.getElementById('campaignIntro').classList.contains('open'));
    await page.waitForFunction(() => _started && !isPaused);
    await page.locator('#speedStepper .sp-current').click();
    await page.waitForFunction(() => isPaused);
    await page.locator('.mdock-item.d-food').click();
    await page.locator('#sheet-food .cat-tile[onclick*="\'fast\'"]').click();
    const selector = '#sheet-food [data-level2="fast"] .chip[data-food]';
    assert.deepEqual(await page.locator(selector).evaluateAll(els => els.map(e => e.dataset.food)), ['druesukker', 'slik', 'chokolade', 'juice', 'banan', 'caffeLatte']);
    // Bundpanelets animation skal være afsluttet før den visuelle kontrol.
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(output, stage + '.png') });
    await checkPoolAfterClick(page, 'glucose-solid', 3, () => page.locator(selector + '[data-food="druesukker"]').click());
    await page.locator('.mdock-item.d-food').click();
    if (await page.locator('#sheet-food .cat-tile[onclick*="\'fast\'"]').isVisible()) await page.locator('#sheet-food .cat-tile[onclick*="\'fast\'"]').click();
    await checkPoolAfterClick(page, 'gummy-mixed-sugars', 4.6, () => page.locator(selector + '[data-food="slik"]').click());
    pass(stage + ': mobilkatalog ved 375x667 leverer glukose og bamseprofil med uændrede portioner');
    await context.close();
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    await ensureServer();
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
        for (const language of ['da', 'en']) for (const viewport of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) await desktop(language, viewport);
        for (const language of ['da', 'en']) await mobile(language);
        assert.deepEqual(errors, []);
        assert.deepEqual([...new Set(missing)], []);
        pass('Ingen JavaScript-fejl eller manglende lokale ressourcer');
    } catch (error) {
        if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, 'ISSUE_' + stage + '.png') }).catch(() => {});
        errors.push({ stage, message: error.message });
        throw error;
    } finally {
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors, missing }, null, 2));
        fs.writeFileSync(path.join(output, 'rapport.txt'), '\ufeffGenereret: 2026-10-25\nKulhydratprofiler - browserkontrol\n'
            + results.map((r, i) => `${i + 1}. [OK] ${r}`).join('\n') + '\n'
            + errors.map((e, i) => `${i + 1}. ISSUE ${e.stage}: ${e.message}`).join('\n')
            + '\nIsoleret Chrome. Tone.js stubbet, lyd muted. Ingen klinisk kalibrering testet.\n', 'utf8');
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
        console.log('Artifacts: ' + output);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
