// =============================================================================
// SMOKE.SPEC.JS - Hurtig Playwright smoke-test af T1D Simulator
// =============================================================================
//
// Testen kontrollerer at den statiske app loader, at kampagnen kan starte, og at
// de vigtigste dock-paneler kan åbnes. Tone.js hentes normalt fra CDN, men E2E-
// testen stubber biblioteket for at undgå falske fejl i offline testmiljøer.
// =============================================================================

const { test, expect } = require('@playwright/test');

const toneStub = `
(() => {
    class ToneNode {
        constructor() {
            this.volume = { value: 0 };
        }
        toDestination() { return this; }
        connect() { return this; }
        triggerAttackRelease() {}
        triggerAttack() {}
        triggerRelease() {}
        start() { return this; }
        stop() { return this; }
    }

    window.Tone = {
        context: {
            state: 'running',
            resume: () => Promise.resolve(),
        },
        Destination: { mute: false },
        start: () => Promise.resolve(),
        now: () => 0,
        Frequency: () => ({ toFrequency: () => 440 }),
        Synth: ToneNode,
        MembraneSynth: ToneNode,
        FMSynth: ToneNode,
        PolySynth: ToneNode,
        Reverb: ToneNode,
        Filter: ToneNode,
    };
})();
`;

async function routeToneJsToStub(page) {
    await page.route('**/Tone.min.js', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: toneStub,
    }));
}

test.describe('T1D Simulator smoke', () => {
    test.beforeEach(async ({ page }) => {
        await routeToneJsToStub(page);
        await page.goto('/index.html');
        await page.evaluate(() => {
            localStorage.setItem('disclaimerAccepted', 'true');
            localStorage.setItem('t1dWelcomeTourShowOnStartup', 'false');
            localStorage.setItem('t1dWelcomeTourCompleted', 'true');
            localStorage.setItem('t1dSimSettings', JSON.stringify({
                muted: true,
                cgmMuted: true,
                musicMuted: true,
                language: 'da',
                bgUnit: 'mmol',
            }));
        });
        await page.reload();
    });

    test('starter offentlig kampagne uden lokale udviklerværktøjer eller JavaScript-fejl', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => pageErrors.push(err.message));

        await expect(page.locator('#startButton')).toBeVisible();
        await page.locator('#startButton').click();
        // Den offentlige udgivelse må kun vise de offentlige spiltilstande.
        // Sandkasse og editor er ikke en del af den offentlige udgivelse.
        await expect(page.locator('.mode-card[data-mode="sandbox"]')).toHaveCount(0);
        await expect(page.locator('.mode-card[data-mode="editor"]')).toHaveCount(0);
        await page.locator('.mode-card[data-mode="campaign"]').click();
        await expect(page.locator('.campaign-select-popup')).toBeVisible();
        await page.locator('.level-card[data-level-index="0"]').click();
        await expect(page.locator('.campaign-intro-popup')).toBeVisible();
        await page.locator('#campaignStartBtn').click();
        await expect(page.locator('.campaign-intro-popup')).toHaveCount(0, { timeout: 3_000 });

        await expect(page.locator('#cgmValueDisplayGraph')).toContainText(/\d/);
        await expect(page.locator('#timeDisplay')).toContainText(/\d{2}:\d{2}/);

        await expect.poll(() => page.evaluate(() => ({
            hasGame: typeof game !== 'undefined' && !!game,
            mode: typeof currentGameMode !== 'undefined' ? currentGameMode : undefined,
            bg: typeof game !== 'undefined' && game ? game.trueBG : null,
        }))).toMatchObject({
            hasGame: true,
            mode: 'campaign',
        });

        const physiology = await page.evaluate(() => ({
            bg: game.trueBG,
            iob: game.iob,
            cob: game.cob,
        }));
        expect(physiology.bg).toBeGreaterThan(1.5);
        expect(physiology.bg).toBeLessThan(35);
        expect(physiology.iob).toBeGreaterThanOrEqual(0);
        expect(physiology.cob).toBeGreaterThanOrEqual(0);

        await page.locator('.dock-item.d-food').click();
        await expect(page.locator('#dock-panel-food')).toHaveClass(/visible/);

        await page.locator('.dock-item.d-insulin').click();
        await expect(page.locator('#dock-panel-insulin')).toHaveClass(/visible/);

        // Aktivitet er med vilje låst i bane 1. Det er selve gating-reglen,
        // ikke et manglende panel, der skal være synlig i den offentlige smoke-test.
        await expect(page.locator('.dock-item.d-exercise')).toHaveClass(/campaign-disabled/);

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test('åbner bane 10 og planlægger uforudsete events', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => pageErrors.push(err.message));

        // Bane 10 skal være valgbar i denne isolerede feature-test uden at
        // ændre appens almindelige, trinvise progression.
        await page.evaluate(() => {
            localStorage.setItem('t1dSimCampaignProgress', JSON.stringify({
                version: '1.0',
                levels: {},
                currentLevel: 9,
                tutorialTipsSeen: [],
            }));
        });
        await page.reload();

        await expect(page.locator('#startButton')).toBeVisible();
        await page.locator('#startButton').click();
        await page.locator('.mode-card[data-mode="campaign"]').click();
        await expect(page.locator('.campaign-select-popup')).toBeVisible();
        await page.locator('.level-card[data-level-index="9"]').click();

        await expect(page.locator('.campaign-intro-popup')).toContainText('Uforudsigelighed');
        await page.locator('#campaignStartBtn').click();
        await expect(page.locator('.campaign-intro-popup')).toHaveCount(0, { timeout: 3_000 });

        const plan = await page.evaluate(() => ({
            mode: currentGameMode,
            levelId: campaignEngine.levelConfig.id,
            objectiveTypes: campaignEngine.levelConfig.objectives.map(obj => obj.type),
            resolvedEvents: campaignEngine.resolvedScheduledEvents.map(evt => ({
                id: evt.id,
                type: evt.type,
                timeMinutes: evt.timeMinutes,
                eventStyle: evt.eventStyle,
            })),
            resolvedMarkers: campaignEngine.resolvedTimelineMarkers.map(marker => ({
                id: marker.id,
                type: marker.type,
                icon: marker.icon,
                timeMinutes: marker.timeMinutes,
                startMinutes: marker.startMinutes,
                endMinutes: marker.endMinutes,
                revealTimeMinutes: marker.revealTimeMinutes,
                persistAfterPast: marker.persistAfterPast,
                labelKey: marker.labelKey,
                labelPosition: marker.labelPosition,
            })),
            poolTypes: campaignEngine.levelConfig.randomEventDirector.pool.map(template => template.event.type),
            busyConflictMarker: (() => {
                const template = campaignEngine.levelConfig.randomEventDirector.pool
                    .find(item => item.id === 'busy_conflict');
                const marker = campaignEngine.eventDirector._buildMarkers(
                    template,
                    600,
                    { id: 'playwright_busy_conflict' }
                )[0];
                return {
                    type: marker.type,
                    icon: marker.icon,
                    startMinutes: marker.startMinutes,
                    endMinutes: marker.endMinutes,
                    revealTimeMinutes: marker.revealTimeMinutes,
                    persistAfterPast: marker.persistAfterPast,
                    labelKey: marker.labelKey,
                    labelPosition: marker.labelPosition,
                };
            })(),
        }));

        expect(plan.mode).toBe('campaign');
        expect(plan.levelId).toBe('level10_unpredictable_day');
        expect(plan.objectiveTypes).toEqual(['survive', 'minCalories']);
        expect(plan.resolvedEvents.length).toBeGreaterThanOrEqual(6);
        expect(plan.resolvedEvents.length).toBeLessThanOrEqual(9);
        expect(plan.resolvedEvents.every(evt => evt.eventStyle === true)).toBe(true);
        expect(plan.resolvedMarkers.length).toBeGreaterThanOrEqual(plan.resolvedEvents.length);
        expect(plan.resolvedMarkers.some(marker => Number.isFinite(marker.revealTimeMinutes))).toBe(true);
        expect(plan.resolvedMarkers.every(marker => marker.persistAfterPast === true)).toBe(true);
        expect(plan.busyConflictMarker).toMatchObject({
            type: 'interval',
            icon: 'assets/icons/app/event-conversation.png',
            startMinutes: 600,
            endMinutes: 720,
            revealTimeMinutes: 600,
            persistAfterPast: true,
            labelKey: 'campaign.level10.marker.stress',
            labelPosition: 'top',
        });
        expect(plan.poolTypes).toContain('autoMotion');
        expect(plan.poolTypes).toContain('autoFood');
        expect(plan.poolTypes).toContain('acuteStress');
        expect(plan.poolTypes).toContain('cgmCompressionAlarm');
        expect(plan.poolTypes).toContain('cgmSensorLoss');
        expect(plan.poolTypes).toContain('cgmSelfTest');

        const foodEventResult = await page.evaluate(() => {
            const template = campaignEngine.levelConfig.randomEventDirector.pool
                .find(item => item.event.type === 'autoFood');
            const evt = {
                id: 'playwright_auto_food',
                ...template.event,
                eventStyle: true,
                priority: template.priority,
            };

            campaignEngine.executeScheduledEvent(evt, game);

            return {
                popupVisible: !!document.querySelector('.popup-overlay'),
                paused: isPaused,
                popupTitleKey: template.event.popupTitleKey,
                popupMessageKey: template.event.popupMessageKey,
                markerLabelPosition: template.markers?.[0]?.labelPosition,
            };
        });

        expect(foodEventResult.popupVisible).toBe(true);
        expect(foodEventResult.paused).toBe(true);
        expect(foodEventResult.popupTitleKey).toBe('campaign.level10.popup.foodTitle');
        expect(foodEventResult.popupMessageKey).toBeTruthy();
        expect(foodEventResult.markerLabelPosition).toBe('top');
        await page.locator('.popup-overlay button:not(.guide-link-btn)').click();
        await expect(page.locator('.popup-overlay')).toHaveCount(0);

        const motionEventResult = await page.evaluate(() => {
            const template = campaignEngine.levelConfig.randomEventDirector.pool
                .find(item => item.event.type === 'autoMotion');
            const evt = {
                id: 'playwright_auto_motion',
                ...template.event,
                eventStyle: true,
                priority: template.priority,
            };

            campaignEngine.executeScheduledEvent(evt, game);

            return {
                activeType: game.activeAktivitet?.type || null,
                activeIntensity: game.activeAktivitet?.intensitet || null,
                activeDuration: game.activeAktivitet?.varighed || null,
                overlayVisible: document.getElementById('activity-overlay')?.style.display !== 'none',
                popupVisible: !!document.querySelector('.popup-overlay'),
                paused: isPaused,
                popupTitleKey: template.event.popupTitleKey,
            };
        });

        expect(motionEventResult.activeType).toBeTruthy();
        expect(motionEventResult.activeIntensity).toBeTruthy();
        expect(motionEventResult.activeDuration).toBeGreaterThan(0);
        expect(motionEventResult.overlayVisible).toBe(true);
        expect(motionEventResult.popupVisible).toBe(true);
        expect(motionEventResult.paused).toBe(true);
        expect(motionEventResult.popupTitleKey).toBeTruthy();
        await page.locator('.popup-overlay button:not(.guide-link-btn)').click();
        await expect(page.locator('.popup-overlay')).toHaveCount(0);

        const sensorLossResult = await page.evaluate(() => {
            const template = campaignEngine.levelConfig.randomEventDirector.pool
                .find(item => item.event.type === 'cgmSensorLoss');
            const evt = {
                id: 'playwright_sensor_loss',
                ...template.event,
                eventStyle: true,
                priority: template.priority,
            };

            const beforeCount = cgmDataPoints.length;
            campaignEngine.executeScheduledEvent(evt, game);
            const immediateStatus = game.getCgmSensorStatus();
            const pausedAfterPopup = isPaused;
            isPaused = false;
            for (let i = 0; i < 4; i++) game.update(5);
            const countDuringOffline = cgmDataPoints.length;
            game.totalSimMinutes = game.cgmSensorOfflineUntil + 1;
            game.update(5);
            const warmupStatus = game.getCgmSensorStatus();

            return {
                popupVisible: !!document.querySelector('.popup-overlay'),
                paused: pausedAfterPopup,
                immediateStatus,
                warmupStatus,
                beforeCount,
                countDuringOffline,
                warmupUntil: game.cgmSensorWarmupUntil,
                popupTitleKey: template.event.popupTitleKey,
            };
        });

        expect(sensorLossResult.popupVisible).toBe(true);
        expect(sensorLossResult.paused).toBe(true);
        expect(sensorLossResult.immediateStatus).toBe('offline');
        expect(sensorLossResult.warmupStatus).toBe('warmup');
        expect(sensorLossResult.countDuringOffline).toBe(sensorLossResult.beforeCount);
        expect(sensorLossResult.warmupUntil).toBeGreaterThan(0);
        expect(sensorLossResult.popupTitleKey).toBe('campaign.level10.popup.sensorLossTitle');
        await page.locator('.popup-overlay button:not(.guide-link-btn)').click();
        await expect(page.locator('.popup-overlay')).toHaveCount(0);

        const sleepEventResult = await page.evaluate(() => {
            const template = campaignEngine.levelConfig.randomEventDirector.pool
                .find(item => item.event.type === 'cgmCompressionAlarm');
            game.totalSimMinutes = 24 * 60 + 2 * 60;
            game.timeInMinutes = 2 * 60;
            game.cgmSensorOfflineUntil = -Infinity;
            game.cgmSensorWarmupUntil = -Infinity;
            game.cgmSelfTestUntil = -Infinity;
            game.cgmSensorStatus = 'active';
            const evt = {
                id: 'playwright_cgm_alarm',
                ...template.event,
                eventStyle: true,
                priority: template.priority,
            };

            const beforeAwakenings = game.sleepAwakeIntervals.length;
            const compressionStartedAt = game.totalSimMinutes;
            campaignEngine.executeScheduledEvent(evt, game);
            const compressionUntilAfterEvent = game.cgmCompressionUntil;

            const immediateState = {
                popupVisible: !!document.querySelector('.popup-overlay'),
                awakeIntervals: game.sleepAwakeIntervals.length,
                pendingAlerts: campaignEngine.pendingEventAlerts.length,
            };

            let alarmTime = null;
            game.cgmBG = 3.8;
            campaignEngine.checkPendingEventAlerts(game);
            if (document.querySelector('.popup-overlay')) {
                alarmTime = game.totalSimMinutes;
            }

            return {
                compressionStartedAt,
                compressionUntilAfterEvent,
                totalSimMinutes: game.totalSimMinutes,
                awakeIntervals: game.sleepAwakeIntervals.length,
                lostSleepHoursTonight: game.lostSleepHoursTonight,
                awakeNow: game.isNightAwake(),
                beforeAwakenings,
                immediateState,
                alarmTime,
                cgmAtAlarm: game.cgmBG,
                popupVisible: !!document.querySelector('.popup-overlay'),
                paused: isPaused,
                popupTitleKey: template.event.popupTitleKey,
                markerLabelKey: template.markers?.[0]?.labelKey,
            };
        });

        expect(sleepEventResult.compressionUntilAfterEvent).toBeGreaterThan(sleepEventResult.compressionStartedAt);
        expect(sleepEventResult.immediateState.popupVisible).toBe(false);
        expect(sleepEventResult.immediateState.awakeIntervals).toBe(sleepEventResult.beforeAwakenings);
        expect(sleepEventResult.immediateState.pendingAlerts).toBeGreaterThan(0);
        expect(sleepEventResult.alarmTime).not.toBeNull();
        expect(sleepEventResult.cgmAtAlarm).toBeLessThanOrEqual(4.0);
        expect(sleepEventResult.awakeIntervals).toBeGreaterThan(sleepEventResult.beforeAwakenings);
        expect(sleepEventResult.awakeNow).toBe(true);
        expect(sleepEventResult.popupVisible).toBe(true);
        expect(sleepEventResult.paused).toBe(true);
        expect(sleepEventResult.popupTitleKey).toBe('campaign.level10.popup.sleepAlarmTitle');
        expect(sleepEventResult.markerLabelKey).toBe('campaign.level10.marker.cgmAlarm');

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test('viser opvågning på næste døgn når natintervention krydser midnat', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => pageErrors.push(err.message));

        await expect(page.locator('#startButton')).toBeVisible();
        await page.locator('#startButton').click();
        await page.locator('#modeCloseBtn').click();

        const pixels = await page.evaluate(() => {
            game = new Simulator();
            // Simuler en opvågning der starter 23:55 på dag 1 og varer 60 min.
            game.sleepAwakeIntervals = [{ startMin: 1435, endMin: 1495 }];
            game.totalSimMinutes = 1445; // Dag 2 kl. 00:05
            game.day = 2;
            game.timeInMinutes = 5;
            game.trueBG = 6.0;
            game.cgmBG = 6.0;
            cgmDataPoints = [];
            trueBgPoints = [];
            physiologyDataPoints = [];
            drawGraph();

            const canvas = document.getElementById('bg-graph');
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const ctx = canvas.getContext('2d');
            const padding = { top: 20, right: 20, bottom: 44, left: 64 };
            const graphWidth = rect.width - padding.left - padding.right;
            const graphHeight = rect.height - padding.top - padding.bottom;

            const sampleAtMinute = (minute) => {
                const xCss = padding.left + (minute / 1440) * graphWidth;
                const yCss = padding.top + graphHeight * 0.5;
                const data = ctx.getImageData(
                    Math.round(xCss * dpr),
                    Math.round(yCss * dpr),
                    1,
                    1
                ).data;
                return {
                    r: data[0],
                    g: data[1],
                    b: data[2],
                    luminance: data[0] * 0.2126 + data[1] * 0.7152 + data[2] * 0.0722,
                };
            };

            return {
                awakePatch: sampleAtMinute(30), // 00:30, stadig vågen
                normalNight: sampleAtMinute(90), // 01:30, opvågningen er slut
            };
        });

        expect(pixels.awakePatch.luminance).toBeGreaterThan(pixels.normalNight.luminance + 5);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test('krydsfader BG-hero-humør over 4 sekunder på desktop og mobil', async ({ page }) => {
        async function verifyCrossfade(pagePath, neutralSrc, moodSrc) {
            await page.goto(pagePath);
            await page.waitForFunction(() => typeof setCharacterPortraitCrossfade === 'function');

            await page.evaluate(({ neutralSrc }) => {
                const portrait = document.getElementById('cgmCharacterPortrait');
                setCharacterPortraitCrossfade(portrait, neutralSrc, 'neutral', 'Erik', true);
            }, { neutralSrc });

            const transition = await page.locator('#cgmCharacterPortrait .cgm-character-avatar').first()
                .evaluate(element => getComputedStyle(element).transitionDuration);
            expect(transition).toBe('4s');

            await page.evaluate(({ moodSrc }) => {
                const portrait = document.getElementById('cgmCharacterPortrait');
                setCharacterPortraitCrossfade(portrait, moodSrc, 'hypo', 'Erik');
            }, { moodSrc });

            await page.waitForFunction(expectedSrc => {
                const portrait = document.getElementById('cgmCharacterPortrait');
                return portrait && portrait.dataset.currentSrc === expectedSrc;
            }, moodSrc);

            // currentSrc og CSS-klasserne opdateres i samme animation-frame.
            // Vent på en faktisk paint, før overgangens mellemværdi aflæses.
            await page.waitForTimeout(100);

            const during = await page.locator('#cgmCharacterPortrait .cgm-character-avatar')
                .evaluateAll(layers => layers.map(layer => Number(getComputedStyle(layer).opacity)));
            expect(during.some(opacity => opacity > 0 && opacity < 1)).toBe(true);

            await page.waitForTimeout(4100);
            const after = await page.locator('#cgmCharacterPortrait .cgm-character-avatar')
                .evaluateAll(layers => layers.map(layer => Number(getComputedStyle(layer).opacity)));
            expect(after.filter(opacity => opacity > 0.99)).toHaveLength(1);
            expect(after.filter(opacity => opacity < 0.01)).toHaveLength(1);
        }

        await verifyCrossfade(
            '/index.html',
            'assets/icons/app/character-erik.png',
            'assets/characters/erik/moods/hypo.png'
        );
        await verifyCrossfade(
            '/mobile/index.html',
            '../assets/icons/app/character-erik.png',
            '../assets/characters/erik/moods/hypo.png'
        );
    });

    test('gennemfører alle model-validation-sektioner uden JavaScript-fejl', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', error => pageErrors.push(error.message));

        // Denne smoke-test ville blandt andet have fanget den tidligere
        // "createEngine is not defined"-fejl på den offentlige testside.
        await page.goto('/tests/model-validation.html');
        await expect(page).toHaveTitle(/Model Behaviour Checks/);
        await expect(page.locator('#status')).toHaveText(
            '51 test sections completed.',
            { timeout: 30_000 }
        );

        await expect(page.locator('#results > .test-section')).toHaveCount(51);
        await expect(page.locator('#results .fail')).toHaveCount(0);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
