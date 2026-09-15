// Kontrol af madmenuens rækkefølge, portioner, genveje, mobil og ikongalleri.
// Browseren er isoleret og lydløs. Ingen data fra brugerens egne faner ændres.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FOODS, foodMacroAmount } = require('../js/foods.js');
const order = ['druesukker', 'slik', 'chokolade', 'juice', 'banan', 'caffeLatte'];
(async () => {
    const out = path.resolve('tests/playwright/2026-09-06_food');
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.addInitScript(() => localStorage.setItem('t1dSimSettings', JSON.stringify({ language: 'da', muted: true, cgmMuted: true, musicMuted: true })));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:8765/index.html');
        await page.waitForTimeout(1200);
        await page.evaluate(() => {
            document.querySelectorAll('.popup-overlay').forEach(el => el.remove());
            campaignEngine.loadLevel(6);
            startGame('campaign');
        });
        await page.locator('#campaignStartBtn').click();
        await page.evaluate(() => {
            if (!isPaused) togglePause();
            toggleDockPanel('dock-panel-food');
            window.foodCalls = [];
            // Opsaml de præcise argumenter på motorgrænsen uden at fylde maven.
            game.addFood = (...args) => { window.foodCalls.push(args); return false; };
        });
        await page.waitForTimeout(400);
        assert.deepEqual(await page.locator('.preset-row[data-row-id="adjustments"] [data-food]').evaluateAll(els => els.map(el => el.dataset.food)), order);
        for (const weight of [70, 35]) {
            await page.evaluate(weight => { game.weight = weight; updateFoodChips(); window.foodCalls = []; }, weight);
            for (const key of order) {
                await page.locator('.preset-chip[data-food="' + key + '"]').click();
                const food = FOODS[key];
                const scale = weight < 45 ? food.childScale : 1;
                const call = await page.evaluate(() => foodCalls.at(-1));
                assert.deepEqual(call.slice(0, 3), ['carbs', 'protein', 'fat'].map(n => foodMacroAmount(food, n, scale)), key);
                assert.equal(call[4], Math.round(food.weight * scale), key + ': portionsvægt');
                assert.equal(await page.locator('[data-food="' + key + '"] .pc-weight-value').innerText(), String(call[4]));
            }
        }
        await page.evaluate(() => { game.weight = 70; updateFoodChips(); window.foodCalls = []; });
        for (const key of ['z', 'x', 'c', 'v', 'b', 'n']) await page.keyboard.press(key);
        assert.deepEqual(await page.evaluate(() => foodCalls.map(call => call[3])), order.map(key => FOODS[key].icon));
        for (const lang of ['da', 'en']) {
            await page.evaluate(lang => { appSettings.language = lang; translateDOM(); updateFoodChips(); }, lang);
            assert.equal(await page.locator('#latteButton .pc-name').innerText(), 'Caffè latte');
            await page.mouse.move(0, 0);
            await page.locator('#dock-panel-food').screenshot({ path: path.join(out, 'desktop-' + lang + '.png') });
        }
        assert.deepEqual(errors, []);
        const mobile = await context.newPage();
        await mobile.setViewportSize({ width: 390, height: 844 });
        const mobileErrors = [];
        mobile.on('pageerror', error => mobileErrors.push(error.message));
        await mobile.goto('http://127.0.0.1:8765/mobile/index.html');
        await mobile.waitForTimeout(1200);
        await mobile.evaluate(() => {
            document.querySelectorAll('.ob-overlay').forEach(el => el.classList.remove('open'));
            _started = true;
            window.foodCalls = [];
            game.addFood = (...args) => { foodCalls.push(args); return true; };
            openSheet('food'); toLevel2('food', 'fast', 'food.row.adjustments');
        });
        const mobileSelector = '#sheet-food [data-level2="fast"] .chip[data-food]';
        assert.deepEqual(await mobile.locator(mobileSelector).evaluateAll(els => els.map(el => el.dataset.food)), order);
        for (const key of order) {
            await mobile.evaluate(() => { openSheet('food'); toLevel2('food', 'fast', 'food.row.adjustments'); });
            await mobile.locator(mobileSelector + '[data-food="' + key + '"]').click();
            const call = await mobile.evaluate(() => foodCalls.at(-1));
            const food = FOODS[key];
            assert.deepEqual(call.slice(0, 3), [food.carbs, food.protein, food.fat], key + ': mobil');
            assert.equal(call[4], food.weight);
        }
        for (const lang of ['da', 'en']) {
            await mobile.evaluate(lang => { appSettings.language = lang; enrichFoodChips(); openSheet('food'); toLevel2('food', 'fast', 'food.row.adjustments'); }, lang);
            await mobile.locator('#sheet-food').screenshot({ path: path.join(out, 'mobile-' + lang + '.png') });
        }
        assert.deepEqual(mobileErrors, []);
        const gallery = await context.newPage();
        await gallery.setViewportSize({ width: 1500, height: 900 });
        await gallery.goto('http://127.0.0.1:8765/mockups/2026-05-24_icon-revision-plan/index.html');
        await gallery.locator('#snacks-20260906').screenshot({ path: path.join(out, 'icons.png') });
        console.log('OK: desktop klik, børneportioner, Z/X/C/V/B/N, mobilklik, dansk/engelsk, ingen JS-fejl. Screenshots: ' + out);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
