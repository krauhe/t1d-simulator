// Browserkontrol af den fælles spilguide og Hvad Nu Hvis. Kør fra projektroden
// med en lokal server på 8765. Browseren er isoleret, headless og helt lydløs.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

(async () => {
    const output = path.resolve('tests/playwright/2026-09-06_guide');
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        await context.addInitScript(() => {
            localStorage.setItem('t1dSimSettings', JSON.stringify({ language: 'da', muted: true, cgmMuted: true, musicMuted: true }));
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:8765/index.html');
        await page.waitForTimeout(1500);
        await page.evaluate(() => document.querySelectorAll('.popup-overlay').forEach(el => el.remove()));
        // Guiden testes i den fælles desktop-app ved tre skærmstørrelser. Den
        // selvstændige mobile shell har endnu ikke guide/editor-integration.
        let visits = 0;
        // Vent på det faktiske rullemål, ikke et fast antal millisekunder.
        // Et langt spring fra sidste til første afsnit tager længere tid.
        const waitForSection = target => page.waitForFunction(target => {
            const doc=document.querySelector('.guide-document');
            const section=document.querySelector(`#guide-section-${target}`);
            const expected=Math.max(0,Math.min(doc.scrollHeight-doc.clientHeight,section.offsetTop-doc.offsetTop-8));
            return Math.abs(doc.scrollTop-expected)<2;
        },target);
        for (const viewport of (process.argv.includes('--flow-only') ? [] : [{width:1280,height:800}, {width:1920,height:1080}, {width:375,height:667}])) {
            await page.setViewportSize(viewport);
            for (const lang of ['da', 'en']) {
                await page.evaluate(lang => { appSettings.language = lang; showGuidePopup('what-if'); }, lang);
                await page.waitForTimeout(400);
                const targets = await page.locator('.guide-toc-link').evaluateAll(els => els.map(el => el.dataset.guideTarget));
                for (const target of targets) {
                    await page.locator(`[data-guide-target="${target}"]`).click();
                    await waitForSection(target);
                    const visible = await page.evaluate(target => {
                        const body = document.querySelector('.guide-document').getBoundingClientRect();
                        const title = document.querySelector(`#guide-section-${target} h3`).getBoundingClientRect();
                        const popup = document.querySelector('.guide-popup').getBoundingClientRect();
                        return {titleTop:title.top,bodyTop:body.top,titleBottom:title.bottom,bodyBottom:body.bottom,heading: title.top >= body.top - 2 && title.bottom <= body.bottom + 2,
                            fits: popup.left >= 0 && popup.right <= innerWidth + 1 && popup.bottom <= innerHeight + 1};
                    }, target);
                    if (!visible.heading || !visible.fits) await page.screenshot({path:path.join(output,`ISSUE-${viewport.width}-${lang}-${target}.png`)});
                    assert.ok(visible.heading && visible.fits, `${viewport.width}/${lang}/${target}: overskrift eller popup uden for synligt område ${JSON.stringify(visible)}`);
                    visits++;
                }
                await page.locator('[data-guide-target="what-if"]').click();
                await waitForSection('what-if');
                await page.screenshot({ path: path.join(output, `guide-${viewport.width}-${lang}.png`) });
                await page.locator('#guideCloseBtn').click();
            }
        }
        if(visits) console.log(`PASS: ${visits} guideopslag på dansk/engelsk ved 1280, 1920 og 375 px`);

        await page.setViewportSize({ width:1280,height:800 });
        await page.evaluate(() => { appSettings.language='da'; campaignEngine.loadLevel(3); startGame('campaign'); });
        await page.locator('#campaignStartBtn').click();
        await page.locator('#campaignStartBtn').waitFor({state:'detached'});
        await page.evaluate(() => {
            if (!isPaused) togglePause();
            game.addFastInsulin(1);
            game.simulationSpeed=60;
            for(let i=0;i<20;i++) game.update(1);
            // Insulinhandlingen kan genoptage spillet. Fiksturen skal først
            // herefter fryse det udgangspunkt, vi sammenligner ved tilbagekomst.
            if (!isPaused) togglePause();
            updateUI(); drawGraph();
            window.guideQaOriginalGame=game;
        });
        const original = await page.evaluate(() => ({ t:game.totalSimMinutes,bg:game.trueBG,id:game.characterId,paused:isPaused }));
        await page.locator('#insightsMenuButton').click();
        await page.locator('#insightsExploreButton').click();
        await page.locator('#insightsOpenConfirm').click();
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => currentGameMode), 'insights');
        const state = await page.evaluate(() => ({
            locked: Editor._debug.playedUntilMin(), frames: Editor._debug.frames().length,
            sameCharacter:JSON.stringify(Editor._debug.profile()) === JSON.stringify(characterToProfile(window.guideQaOriginalGame.characterId)),
            points:document.querySelector('#normoPointsDisplay').textContent,
            events:Editor._debug.events().length
        }));
        assert.ok(state.events > 0);
        assert.ok(state.sameCharacter, 'Den samme faste karakter bruges i editoren');
        assert.ok(state.frames <= state.locked + 362, 'Højst seks ekstra timer');
        assert.equal(state.points.trim(), '—', 'Ingen alternativ pointscore');
        await page.evaluate(() => {
            const bolus = Editor._debug.events().find(event => event.kind === 'bolus');
            bolus.units += 1;
            Editor._debug.recompute();
        });
        // Åbning/lukning af guiden oven på editoren må ikke genstarte banen.
        await page.evaluate(() => showGuidePopup('what-if'));
        await page.locator('#guideCloseBtn').click();
        assert.equal(await page.evaluate(() => isPaused), true);
        await page.screenshot({ path:path.join(output,'what-if-desktop.png') });
        await page.locator('#startButton').click();
        const restored = await page.evaluate(() => ({same:game===window.guideQaOriginalGame,t:game.totalSimMinutes,bg:game.trueBG,paused:isPaused}));
        if(!restored.same || !restored.paused) await page.screenshot({path:path.join(output,'ISSUE-return.png')});
        assert.ok(restored.same && restored.paused);
        assert.equal(restored.t, original.t);
        assert.equal(restored.bg, original.bg);
        console.log('PASS: spil → Hvad Nu Hvis → guide → uændret pauset spil',state);
        // Et guideopslag fra resultatet skal vende tilbage til resultatet og
        // bevare vejen til et nyt forsøg. Selve tabshændelsen er en testfikstur.
        await page.evaluate(() => game.gameOver('Test af resultatnavigation', {type:'hypo',cause:'Test',explanation:'Test af guide og nyt forsøg',tips:[]}));
        await page.locator('.campaign-gameover-popup [data-guide-section="rapid-iob"]').click();
        await page.locator('#guideCloseBtn').click();
        await page.locator('#campaignRetryBtn').click();
        await page.locator('#campaignStartBtn').waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>game.isGameOver),false);
        console.log('PASS: resultat → relevant guide → resultat → nyt forsøg');
        assert.deepEqual(errors, []);
        await page.setViewportSize({width:375,height:667});
        await page.goto('http://127.0.0.1:8765/mobile/');
        const mobileFeatures = await page.evaluate(() => ({guide:typeof showGuidePopup === 'function',whatIf:typeof Editor !== 'undefined'}));
        console.log('Særskilt mobilapp - tilgængelige funktioner (ikke en bestået guide/editor-test):',mobileFeatures);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
