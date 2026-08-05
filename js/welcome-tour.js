// =============================================================================
// WELCOME-TOUR.JS - Welcome screen and guided tour for new players
// =============================================================================
//
// This file owns only the start guide:
//   1. Welcome popup with the selected fictional character
//   2. Guided tour with arrow, glow, and per-step explanations
//   3. localStorage setting for whether to show the welcome screen on startup
//   4. Audio playback once finished audio files are placed in sounds/tour/
//
// The guide is deliberately isolated from the simulator's physiology and game
// state. It does not start the simulation directly but fires callbacks back to
// main.js so the existing disclaimer, mode, and campaign flows are preserved.
//
// MODULAR STRUCTURE (easy to split up later):
//   All steps live in the TOURS object, grouped under a tour id. Currently only
//   the "intro" tour exists, but additional topic tours (e.g. food-only,
//   insulin-only) can be added by inserting a new array in TOURS and calling
//   startTour('id'). Step objects are self-contained, so a step can be reused
//   across tours.
//
// STEP PROPERTIES:
//   target           selector for the ring that highlights the element
//   secondaryTarget  optional second ring (e.g. time: both clock and speed)
//   panel            id of a dock panel to open (and raise) during the step
//   arrow            arrow direction: 'top' | 'bottom' | 'left' | 'right'
//   chartDemo        true: draw demo CGM points on the graph
//   tipDemo          true: show a simulated tip with guide icon
//   titleKey/textKey i18n keys for the bubble title and body text
//   audio            { da, en } paths to audio files (optional)
//   durationMs       auto-advance delay when no audio is playing
//
// Dependencies: t(), bgVars(), appSettings
// Exports (global): WelcomeTour
// =============================================================================

const WelcomeTour = (() => {
    const STORAGE_SHOW_KEY = 't1dWelcomeTourShowOnStartup';
    const STORAGE_COMPLETED_KEY = 't1dWelcomeTourCompleted';
    const STEP_TEXT_FADE_MS = 450;
    const FOCUS_SETTLE_MS = 2400;

    function activeCharacterForTour() {
        if (typeof getActiveCharacter === 'function') return getActiveCharacter();
        return { id: 'erik', name: 'Erik' };
    }

    function characterAssetForTour(scene = 'portrait') {
        const character = activeCharacterForTour();

        // Den store velkomst har plads til en helfigur. Små tip-bobler bruger
        // fortsat portrættet, så karakteren ikke presser teksten ud af UI'et.
        if (scene === 'intro' && character.fullBody?.intro) {
            return character.fullBody.intro;
        }

        return character.portrait || `assets/icons/app/character-${character.id}.png`;
    }

    let overlay = null;
    let tourLayer = null;
    let tourDim = null;
    let targetRing = null;
    let secondaryRing = null;
    let openerRing = null;
    let arrowEl = null;
    let bubbleEl = null;
    let demoCgmTimer = null;
    let rangeDemoEl = null;
    let tipDemoEl = null;
    let dayNightDemoEl = null;
    let tipDemoTextEl = null;
    let tipDemoLinkEl = null;
    let titleEl = null;
    let textEl = null;
    let progressEl = null;
    let navGroupTitleEl = null;
    let speechGroupTitleEl = null;
    let pauseBtn = null;
    let audioPauseBtn = null;
    let voiceBtn = null;
    let replayBtn = null;
    let skipBtn = null;
    let backBtn = null;
    let nextBtn = null;

    let cursorEl = null;

    let tourIndex = 0;
    let highlightedEls = [];
    let currentAudio = null;
    let autoTimer = null;
    let paused = false;
    let audioEnabled = false;
    let audioPausedByUser = false;
    let audioProgressUpdatedAt = 0;
    let lastAudioCurrentTime = 0;
    let callbacks = {};
    const AUTO_ADVANCE_MULTIPLIER = 1.6;
    const GRAPH_DEMO_INTERVAL_MS = 380;

    // The resolved target selector for the current step (may be a fallback
    // element, e.g. the hamburger menu when the profile button is collapsed).
    let activeTargetSelector = null;
    // True when the target element itself received the glow (.welcome-tour-highlight)
    // in this step. In that case the glow is used as the primary marker and the
    // floating ring is hidden; when false (e.g. graph canvas or a target that
    // could not receive the glow), we fall back to the ring.
    // (Issue #3: markers that did not align.)
    let targetHighlighted = false;
    // Glide transition is enabled only after the first step so nothing flies in
    // from a corner on initial render.
    let glideEnabled = false;
    // Timers for the menu-open choreography (cursor glides -> click -> panel opens).
    let openSeqTimers = [];
    // Timer for fade-out -> swap content -> fade-in on step transitions.
    let renderTimer = null;
    // The profile popup the tour itself opened (profile step), so it can be closed again.
    let tourProfileOverlay = null;
    let tourCgmDemoState = null;
    // Stable bubble position per dock panel. Sub-steps within the same panel
    // may move the focus ring, but the text box should remain stationary.
    let panelBubblePositions = {};

    // =========================================================================
    // TOUR DEFINITIONS
    // Each tour is a list of self-contained steps. The active tour is copied to
    // activeSteps when startTour() is called, so the rest of the code only sees
    // a single array.
    // =========================================================================
    const TOURS = {
        intro: {
            id: 'intro',
            steps: [
                // 1 - Overview: calm introduction without a focus frame, before the UI is broken down.
                {
                    noTarget: true,
                    bubblePlacement: 'graphCenter',
                    wideBubble: true,
                    titleKey: 'welcomeTour.step.overview.title',
                    textKey: 'welcomeTour.step.overview.text',
                    audio: { da: 'sounds/tour/da/00-overview.mp3', en: 'sounds/tour/en/00-overview.mp3' },
                    durationMs: 12000
                },
                // 1 — Graph: demo CGM points and target range
                {
                    target: '#graph-area-container',
                    arrow: 'left',
                    chartDemo: true,
                    graphMarker: 'range',
                    bubblePlacement: 'graphCenter',
                    titleKey: 'welcomeTour.step.graph.title',
                    textKey: 'welcomeTour.step.graph.text',
                    audio: { da: 'sounds/tour/da/01-graph.mp3', en: 'sounds/tour/en/01-graph.mp3' },
                    durationMs: 7500
                },
                {
                    target: '#graph-area-container',
                    arrow: 'left',
                    chartDemo: true,
                    graphMarker: 'dayNight',
                    bubblePlacement: 'graphCenter',
                    titleKey: 'welcomeTour.step.graphDayNight.title',
                    textKey: 'welcomeTour.step.graphDayNight.text',
                    audio: { da: 'sounds/tour/da/02-graph-daynight.mp3', en: 'sounds/tour/en/02-graph-daynight.mp3' },
                    durationMs: 7000
                },
                // 2 — BG value, trend arrow, IOB/COB
                {
                    target: '#cgm-hero',
                    keepRing: true,
                    arrow: 'right',
                    titleKey: 'welcomeTour.step.cgm.title',
                    textKey: 'welcomeTour.step.cgm.text',
                    audio: { da: 'sounds/tour/da/02-cgm.mp3', en: 'sounds/tour/en/02-cgm.mp3' },
                    durationMs: 9500
                },
                // Character: replaces the obsolete personal-profile explanation. The
                // selected fixed character is visible beside the CGM value throughout play.
                {
                    target: '#cgmCharacter',
                    keepRing: true,
                    arrow: 'right',
                    titleKey: 'welcomeTour.step.character.title',
                    textKey: 'welcomeTour.step.character.text',
                    audio: { da: 'sounds/tour/da/03-character.mp3', en: 'sounds/tour/en/03-character.mp3' },
                    durationMs: 9000
                },
                // 3 — Insulin (overview): show the Mac-style menu icon first, before the panel opens.
                {
                    target: '.dock-item.d-insulin',
                    keepRing: true,
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.insulin.title',
                    textKey: 'welcomeTour.step.insulin.text',
                    audio: { da: 'sounds/tour/da/04-insulin.mp3', en: 'sounds/tour/en/04-insulin.mp3' },
                    durationMs: 9500
                },
                // 5 — Insulin · Basal
                {
                    target: '.dp-insulin-basal',
                    panel: 'dock-panel-insulin',
                    includePreviousLabel: true,
                    focusPadding: 28,
                    dockGuide: true,
                    arrow: 'left',
                    titleKey: 'welcomeTour.step.basal.title',
                    textKey: 'welcomeTour.step.basal.text',
                    audio: { da: 'sounds/tour/da/05-basal.mp3', en: 'sounds/tour/en/05-basal.mp3' },
                    durationMs: 9500
                },
                // 6 — Insulin · Fast-acting
                {
                    target: '.dp-insulin-fast',
                    panel: 'dock-panel-insulin',
                    includePreviousLabel: true,
                    focusPadding: 28,
                    dockGuide: true,
                    arrow: 'left',
                    titleKey: 'welcomeTour.step.fast.title',
                    textKey: 'welcomeTour.step.fast.text',
                    audio: { da: 'sounds/tour/da/06-fast.mp3', en: 'sounds/tour/en/06-fast.mp3' },
                    durationMs: 9500
                },
                // 7 — Food (overview): show the Mac-style menu icon first, before the panel opens.
                {
                    target: '.dock-item.d-food',
                    keepRing: true,
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.food.title',
                    textKey: 'welcomeTour.step.food.text',
                    audio: { da: 'sounds/tour/da/07-food.mp3', en: 'sounds/tour/en/07-food.mp3' },
                    durationMs: 9500
                },
                // 8 — Food · Fast carbohydrates (most common)
                {
                    target: '.preset-row[data-row-id="adjustments"]',
                    panel: 'dock-panel-food',
                    dockGuide: true,
                    arrow: 'left',
                    titleKey: 'welcomeTour.step.foodSugars.title',
                    textKey: 'welcomeTour.step.foodSugars.text',
                    audio: { da: 'sounds/tour/da/08-food-sugars.mp3', en: 'sounds/tour/en/08-food-sugars.mp3' },
                    durationMs: 9500
                },
                // 9 — Food · Meals (middle row) — separate description
                {
                    target: '.preset-row[data-row-id="meals"]',
                    panel: 'dock-panel-food',
                    dockGuide: true,
                    arrow: 'left',
                    titleKey: 'welcomeTour.step.foodMeals.title',
                    textKey: 'welcomeTour.step.foodMeals.text',
                    audio: { da: 'sounds/tour/da/09-food-meals.mp3', en: 'sounds/tour/en/09-food-meals.mp3' },
                    durationMs: 9500
                },
                // 10 — Food · Low-carb (top row)
                {
                    target: '.preset-row[data-row-id="lowCarb"]',
                    panel: 'dock-panel-food',
                    dockGuide: true,
                    arrow: 'left',
                    titleKey: 'welcomeTour.step.foodLowCarb.title',
                    textKey: 'welcomeTour.step.foodLowCarb.text',
                    audio: { da: 'sounds/tour/da/09-food-lowcarb.mp3', en: 'sounds/tour/en/09-food-lowcarb.mp3' },
                    durationMs: 9000
                },
                // 11 — Activity (overview): show the Mac-style menu icon first, before the panel opens.
                {
                    target: '.dock-item.d-exercise',
                    keepRing: true,
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.activityOverview.title',
                    textKey: 'welcomeTour.step.activityOverview.text',
                    audio: { da: 'sounds/tour/da/10b-activityoverview.mp3', en: 'sounds/tour/en/10b-activityoverview.mp3' },
                    durationMs: 8000
                },
                // 12 — Activity: type, intensity, duration
                {
                    target: '#dock-panel-motion',
                    panel: 'dock-panel-motion',
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.activity.title',
                    textKey: 'welcomeTour.step.activity.text',
                    audio: { da: 'sounds/tour/da/10-activity.mp3', en: 'sounds/tour/en/10-activity.mp3' },
                    durationMs: 10000
                },
                // 13 — T1D Kit (overview): show the Mac-style menu icon first, before the panel opens.
                {
                    target: '.dock-item.d-kit',
                    keepRing: true,
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.kitOverview.title',
                    textKey: 'welcomeTour.step.kitOverview.text',
                    audio: { da: 'sounds/tour/da/11b-kitoverview.mp3', en: 'sounds/tour/en/11b-kitoverview.mp3' },
                    durationMs: 8000
                },
                // 14 — T1D Kit: finger prick, ketone, glucagon, glucose tablets
                {
                    target: '#dock-panel-kit',
                    panel: 'dock-panel-kit',
                    dockGuide: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.kit.title',
                    textKey: 'welcomeTour.step.kit.text',
                    audio: { da: 'sounds/tour/da/11-kit.mp3', en: 'sounds/tour/en/11-kit.mp3' },
                    durationMs: 10000
                },
                // 16 — Time controls: pause and speed.
                {
                    target: '#speedStepper',
                    keepRing: true,
                    arrow: 'top',
                    titleKey: 'welcomeTour.step.timeControls.title',
                    textKey: 'welcomeTour.step.timeControls.text',
                    audio: { da: 'sounds/tour/da/12b-timecontrols.mp3', en: 'sounds/tour/en/12b-timecontrols.mp3' },
                    durationMs: 7500
                },
                // Indsigt: vis begge avancerede læringsværktøjer samlet i menuen.
                {
                    target: '#insightsDropdown',
                    keepRing: true,
                    openInsights: true,
                    arrow: 'bottom',
                    titleKey: 'welcomeTour.step.physiology.title',
                    textKey: 'welcomeTour.step.physiology.text',
                    audio: { da: 'sounds/tour/da/13-physiology.mp3', en: 'sounds/tour/en/13-physiology.mp3' },
                    durationMs: 9500
                },
                {
                    target: '#topSettingsButton',
                    keepRing: true,
                    openSettings: true,
                    arrow: 'bottom',
                    titleKey: 'welcomeTour.step.settings.title',
                    textKey: 'welcomeTour.step.settings.text',
                    audio: { da: 'sounds/tour/da/13b-settings.mp3', en: 'sounds/tour/en/13b-settings.mp3' },
                    durationMs: 8000
                },
                // 14 — Learn more: simulated tip with guide icon
                {
                    target: '#welcomeTourTipDemo',
                    tipDemo: true,
                    arrow: 'bottom',
                    titleKey: 'welcomeTour.step.learn.title',
                    textKey: 'welcomeTour.step.learn.text',
                    audio: { da: 'sounds/tour/da/14-learn.mp3', en: 'sounds/tour/en/14-learn.mp3' },
                    durationMs: 10000
                },
                // 15 — Ready: start the first learning level
                {
                    target: '#startButton',
                    keepRing: true,
                    arrow: 'bottom',
                    titleKey: 'welcomeTour.step.ready.title',
                    textKey: 'welcomeTour.step.ready.text',
                    audio: { da: 'sounds/tour/da/15-ready.mp3', en: 'sounds/tour/en/15-ready.mp3' },
                    durationMs: 9000
                }
            ]
        }
    };

    // The currently running tour (set in startTour). All other code reads from this alone.
    let activeSteps = TOURS.intro.steps;

    // Danish audio files are planned but not yet present in the repo. Until they
    // are placed in sounds/tour/da/, speech falls back to English rather than
    // attempting to fetch missing files and producing 404 errors in the browser.
    const TOUR_AUDIO_READY = {
        da: true,
        en: true
    };

    const READY_TOUR_AUDIO_SOURCES = new Set([
        'sounds/tour/da/00-overview.mp3',
        'sounds/tour/da/01-graph.mp3',
        'sounds/tour/da/02-graph-daynight.mp3',
        'sounds/tour/da/02-cgm.mp3',
        'sounds/tour/da/03-character.mp3',
        'sounds/tour/da/04-insulin.mp3',
        'sounds/tour/da/05-basal.mp3',
        'sounds/tour/da/06-fast.mp3',
        'sounds/tour/da/07-food.mp3',
        'sounds/tour/da/08-food-sugars.mp3',
        'sounds/tour/da/09-food-meals.mp3',
        'sounds/tour/da/09-food-lowcarb.mp3',
        'sounds/tour/da/10-activity.mp3',
        'sounds/tour/da/10b-activityoverview.mp3',
        'sounds/tour/da/11-kit.mp3',
        'sounds/tour/da/11b-kitoverview.mp3',
        'sounds/tour/da/12b-timecontrols.mp3',
        'sounds/tour/da/13-physiology.mp3',
        'sounds/tour/da/13b-settings.mp3',
        'sounds/tour/da/14-learn.mp3',
        'sounds/tour/da/15-ready.mp3',
        'sounds/tour/en/00-overview.mp3',
        'sounds/tour/en/01-graph.mp3',
        'sounds/tour/en/02-graph-daynight.mp3',
        'sounds/tour/en/02-cgm.mp3',
        'sounds/tour/en/03-character.mp3',
        'sounds/tour/en/04-insulin.mp3',
        'sounds/tour/en/05-basal.mp3',
        'sounds/tour/en/06-fast.mp3',
        'sounds/tour/en/07-food.mp3',
        'sounds/tour/en/08-food-sugars.mp3',
        'sounds/tour/en/09-food-meals.mp3',
        'sounds/tour/en/09-food-lowcarb.mp3',
        'sounds/tour/en/10-activity.mp3',
        'sounds/tour/en/10b-activityoverview.mp3',
        'sounds/tour/en/11-kit.mp3',
        'sounds/tour/en/11b-kitoverview.mp3',
        'sounds/tour/en/12b-timecontrols.mp3',
        'sounds/tour/en/13-physiology.mp3',
        'sounds/tour/en/13b-settings.mp3',
        'sounds/tour/en/14-learn.mp3',
        'sounds/tour/en/15-ready.mp3'
    ]);

    function lang() {
        return (typeof appSettings !== 'undefined' && appSettings.language) || 'da';
    }

    function shouldShowOnStartup() {
        return localStorage.getItem(STORAGE_SHOW_KEY) !== 'false';
    }

    function setShowOnStartup(shouldShow) {
        localStorage.setItem(STORAGE_SHOW_KEY, shouldShow ? 'true' : 'false');
    }

    function hasCompletedTour() {
        return localStorage.getItem(STORAGE_COMPLETED_KEY) === 'true';
    }

    function markCompleted() {
        localStorage.setItem(STORAGE_COMPLETED_KEY, 'true');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function removeExisting() {
        stopStepAudio();
        clearAutoTimer();
        if (renderTimer) { window.clearTimeout(renderTimer); renderTimer = null; }
        clearHighlight();
        closeTourPanels();
        document.querySelectorAll('.welcome-tour-overlay, .welcome-tour-layer, .welcome-tour-dim-layer').forEach(el => el.remove());
        overlay = null;
        tourLayer = null;
        tourDim = null;
    }

    function closeBlockingPopupsBeforeTour() {
        // The tour must run on a clean simulator surface. If the disclaimer, mode
        // selection, or help popup are already in the DOM, remove them first so
        // they do not visually compete with the tour's focus rings and text bubbles.
        document.querySelectorAll('.popup-overlay:not(.welcome-tour-overlay)').forEach(popup => {
            popup.remove();
        });
    }

    function buildWelcomeOverlay() {
        removeExisting();

        overlay = document.createElement('section');
        overlay.className = 'popup-overlay welcome-tour-overlay';
        overlay.setAttribute('aria-label', t('welcomeTour.aria.welcome'));

        overlay.innerHTML = `
            <article class="popup-content welcome-tour-popup">
                <div class="welcome-tour-character">
                    <img src="assets/characters/welcome-group.png" alt="${escapeHtml(t('welcomeTour.groupAlt'))}">
                    <p class="welcome-tour-lead">${escapeHtml(t('welcomeTour.lead'))}</p>
                </div>
                <div class="welcome-tour-content">
                    <h2>${escapeHtml(t('welcomeTour.title'))}</h2>

                    <div class="welcome-tour-choice-grid">
                        <button class="welcome-tour-choice recommended" id="welcomeStartTourBtn" type="button">
                            <span class="welcome-tour-badge">${escapeHtml(t('welcomeTour.recommended'))}</span>
                            <span class="welcome-tour-choice-top">
                                <span class="welcome-tour-choice-icon">
                                    <img src="assets/icons/app/event-note.png" alt="">
                                </span>
                                <span class="welcome-tour-choice-title">${escapeHtml(t('welcomeTour.choice.tour.title'))}</span>
                            </span>
                            <span class="welcome-tour-choice-copy">${escapeHtml(t('welcomeTour.choice.tour.copy'))}</span>
                        </button>
                        <button class="welcome-tour-choice" id="welcomeStartCampaignBtn" type="button">
                            <span class="welcome-tour-choice-top">
                                <span class="welcome-tour-choice-icon">
                                    <img src="assets/icons/app/mode-campaign.png" alt="">
                                </span>
                                <span class="welcome-tour-choice-title">${escapeHtml(t('welcomeTour.choice.campaign.title'))}</span>
                            </span>
                            <span class="welcome-tour-choice-copy">${escapeHtml(t('welcomeTour.choice.campaign.copy'))}</span>
                        </button>
                    </div>

                    <div class="welcome-tour-footer">
                        <label class="welcome-tour-toggle">
                            <input type="checkbox" id="welcomeShowOnStartup" ${shouldShowOnStartup() ? 'checked' : ''}>
                            <span>${escapeHtml(t('welcomeTour.showOnStartup'))}</span>
                        </label>
                        <button class="welcome-tour-link" id="welcomeNotNowBtn" type="button">${escapeHtml(t('welcomeTour.notNow'))}</button>
                    </div>
                </div>
            </article>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#welcomeShowOnStartup').addEventListener('change', (event) => {
            setShowOnStartup(event.target.checked);
        });
        overlay.querySelector('#welcomeStartTourBtn').addEventListener('click', () => startTour('intro'));
        overlay.querySelector('#welcomeStartCampaignBtn').addEventListener('click', () => {
            closeWelcome();
            callbacks.onStartCampaign?.();
        });
        overlay.querySelector('#welcomeNotNowBtn').addEventListener('click', () => {
            closeWelcome();
            callbacks.onSkip?.();
        });
    }

    function buildTourLayer() {
        if (tourLayer) return;

        // The dim layer is a SEPARATE root element (not a child of the tour layer).
        // It must sit BELOW the raised elements (panels/buttons), while the ring,
        // arrow, and bubble must sit ABOVE them. Because an element can only occupy
        // one position in the root stack, this requires two separate layers that
        // "sandwich" the raised elements (dim < raised < overlay).
        tourDim = document.createElement('div');
        tourDim.className = 'welcome-tour-dim-layer';
        document.body.appendChild(tourDim);

        tourLayer = document.createElement('section');
        tourLayer.className = 'welcome-tour-layer';
        tourLayer.setAttribute('aria-live', 'polite');
        tourLayer.innerHTML = `
            <div class="welcome-tour-target-ring" id="welcomeTourTargetRing"></div>
            <div class="welcome-tour-target-ring welcome-tour-secondary-ring" id="welcomeTourSecondaryRing"></div>
            <div class="welcome-tour-target-ring welcome-tour-opener-ring" id="welcomeTourOpenerRing"></div>
            <div class="welcome-tour-range-demo" id="welcomeTourRangeDemo" aria-hidden="true">
                <div class="welcome-tour-score-band score-half"><span></span></div>
                <div class="welcome-tour-score-band score-one"><span></span></div>
                <div class="welcome-tour-score-band score-bonus"><span></span></div>
            </div>
            <div class="welcome-tour-daynight-demo" id="welcomeTourDayNightDemo" aria-hidden="true">
                <div class="wtdn-band wtdn-night wtdn-night-left"><span></span></div>
                <div class="wtdn-band wtdn-day"><span></span></div>
                <div class="wtdn-band wtdn-night wtdn-night-right"><span></span></div>
            </div>
            <div class="welcome-tour-tip-demo" id="welcomeTourTipDemo" aria-hidden="true">
                <div class="wtt-bubble">
                    <img class="wtt-bulb" src="assets/icons/app/tip-lightbulb.png" alt="">
                    <p class="wtt-text" id="welcomeTourTipDemoText"></p>
                </div>
                <button type="button" class="graph-tip-guide-link welcome-tour-tip-guide-link" id="welcomeTourTipDemoBtn" tabindex="-1">
                    <img src="assets/icons/app/event-note.png" alt="">
                    <span class="guide-link-label" id="welcomeTourTipDemoLink"></span>
                </button>
            </div>
            <div class="welcome-tour-arrow" id="welcomeTourArrow">➜</div>
            <div class="welcome-tour-cursor" id="welcomeTourCursor" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12.5 14 L19 14 Z"/></svg>
            </div>
            <article class="welcome-tour-bubble" id="welcomeTourBubble">
                <p class="welcome-tour-kicker" id="welcomeTourKicker"></p>
                <p class="welcome-tour-text" id="welcomeTourText"></p>
                <span class="welcome-tour-progress" id="welcomeTourProgress"></span>
                <div class="welcome-tour-controls">
                    <div class="welcome-tour-control-stack">
                        <div class="welcome-tour-control-group">
                            <div class="welcome-tour-control-heading" id="welcomeTourNavigationHeading"></div>
                            <div class="welcome-tour-stepper welcome-tour-nav-row" aria-label="Tour navigation">
                                <button class="welcome-tour-step-btn" id="welcomeTourBackBtn" type="button"></button>
                                <button class="welcome-tour-step-btn" id="welcomeTourNextBtn" type="button"></button>
                            </div>
                            <div class="welcome-tour-toggle-actions welcome-tour-nav-options">
                                <button class="welcome-tour-option-toggle" id="welcomeTourPauseBtn" type="button">
                                    <span class="welcome-tour-state-label"></span>
                                    <span class="welcome-tour-state-icon" aria-hidden="true"></span>
                                </button>
                            </div>
                        </div>
                        <div class="welcome-tour-control-group">
                            <div class="welcome-tour-control-heading" id="welcomeTourSpeechHeading"></div>
                            <div class="welcome-tour-stepper welcome-tour-speech-row" aria-label="Tour voice controls">
                                <button class="welcome-tour-step-btn" id="welcomeTourAudioPauseBtn" type="button"></button>
                                <button class="welcome-tour-step-btn welcome-tour-replay-btn" id="welcomeTourReplayBtn" type="button"></button>
                            </div>
                            <div class="welcome-tour-toggle-actions welcome-tour-speech-options">
                                <button class="welcome-tour-option-toggle welcome-tour-sound-btn" id="welcomeTourVoiceBtn" type="button">
                                    <span class="welcome-tour-sound-label"></span>
                                    <span class="welcome-tour-sound-icon" aria-hidden="true"></span>
                                </button>
                            </div>
                        </div>
                        <button class="welcome-tour-exit-btn" id="welcomeTourSkipBtn" type="button"></button>
                    </div>
                </div>
            </article>
        `;

        document.body.appendChild(tourLayer);
        targetRing = tourLayer.querySelector('#welcomeTourTargetRing');
        secondaryRing = tourLayer.querySelector('#welcomeTourSecondaryRing');
        openerRing = tourLayer.querySelector('#welcomeTourOpenerRing');
        arrowEl = tourLayer.querySelector('#welcomeTourArrow');
        cursorEl = tourLayer.querySelector('#welcomeTourCursor');
        bubbleEl = tourLayer.querySelector('#welcomeTourBubble');
        rangeDemoEl = tourLayer.querySelector('#welcomeTourRangeDemo');
        tipDemoEl = tourLayer.querySelector('#welcomeTourTipDemo');
        dayNightDemoEl = tourLayer.querySelector('#welcomeTourDayNightDemo');
        tipDemoTextEl = tourLayer.querySelector('#welcomeTourTipDemoText');
        tipDemoLinkEl = tourLayer.querySelector('#welcomeTourTipDemoLink');
        titleEl = tourLayer.querySelector('#welcomeTourKicker');
        textEl = tourLayer.querySelector('#welcomeTourText');
        progressEl = tourLayer.querySelector('#welcomeTourProgress');
        navGroupTitleEl = tourLayer.querySelector('#welcomeTourNavigationHeading');
        speechGroupTitleEl = tourLayer.querySelector('#welcomeTourSpeechHeading');
        pauseBtn = tourLayer.querySelector('#welcomeTourPauseBtn');
        audioPauseBtn = tourLayer.querySelector('#welcomeTourAudioPauseBtn');
        voiceBtn = tourLayer.querySelector('#welcomeTourVoiceBtn');
        replayBtn = tourLayer.querySelector('#welcomeTourReplayBtn');
        skipBtn = tourLayer.querySelector('#welcomeTourSkipBtn');
        backBtn = tourLayer.querySelector('#welcomeTourBackBtn');
        nextBtn = tourLayer.querySelector('#welcomeTourNextBtn');

        pauseBtn.addEventListener('click', togglePause);
        audioPauseBtn.addEventListener('click', toggleSpeechPause);
        voiceBtn.addEventListener('click', toggleVoice);
        replayBtn.addEventListener('click', replayCurrentStep);
        skipBtn.addEventListener('click', endTour);
        backBtn.addEventListener('click', () => {
            clearAutoTimer();
            stopStepAudio();
            goBack();
        });
        nextBtn.addEventListener('click', () => {
            clearAutoTimer();
            stopStepAudio();
            advanceTour();
        });
        document.addEventListener('keydown', handleTourKeydown, true);

        window.addEventListener('resize', () => {
            if (!tourLayer?.classList.contains('active')) return;
            panelBubblePositions = {};
            positionCurrentStep();
        });
    }

    function closeWelcome() {
        if (overlay) overlay.remove();
        overlay = null;
    }

    function clearAutoTimer() {
        if (autoTimer) window.clearTimeout(autoTimer);
        autoTimer = null;
    }

    function scheduleStableReposition(step) {
        // Some elements (dock icons, panels with images/sliders, and responsive
        // top-bar buttons) reach their final size/position just after the first
        // paint. A resize fixes this because positionCurrentStep() re-measures.
        // Here the tour performs the same re-measurement automatically so the
        // focus box does not start misaligned and only correct itself after a resize.
        [80, 260, 520].forEach(delayMs => {
            openSeqTimers.push(window.setTimeout(() => {
                if (!tourLayer?.classList.contains('active') || activeSteps[tourIndex] !== step) return;
                if (step.panel) delete panelBubblePositions[`${step.panel}|${step.target || ''}`];
                positionCurrentStep();
            }, delayMs));
        });
    }

    function stopStepAudio() {
        if (!currentAudio) return;
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        audioPausedByUser = false;
        audioProgressUpdatedAt = 0;
        lastAudioCurrentTime = 0;
    }

    function getAudioSource(step) {
        const sources = step.audio || {};
        const preferredLang = lang();
        if (TOUR_AUDIO_READY[preferredLang] && READY_TOUR_AUDIO_SOURCES.has(sources[preferredLang])) return sources[preferredLang];
        if (TOUR_AUDIO_READY.en && READY_TOUR_AUDIO_SOURCES.has(sources.en)) return sources.en;
        if (TOUR_AUDIO_READY.da && READY_TOUR_AUDIO_SOURCES.has(sources.da)) return sources.da;
        return null;
    }

    function playStepAudio(step) {
        stopStepAudio();
        if (!audioEnabled) return false;

        const src = getAudioSource(step);
        if (!src) return false;

        const audio = new Audio(src);
        currentAudio = audio;
        audioPausedByUser = false;
        audioProgressUpdatedAt = performance.now();
        lastAudioCurrentTime = 0;

        const markAudioProgress = () => {
            lastAudioCurrentTime = audio.currentTime || 0;
            audioProgressUpdatedAt = performance.now();
        };

        audio.addEventListener('playing', markAudioProgress);
        audio.addEventListener('timeupdate', markAudioProgress);
        audio.addEventListener('ended', () => {
            if (currentAudio === audio) currentAudio = null;
            audioPausedByUser = false;
            updateTourControls();
            if (!paused && tourLayer?.classList.contains('active')) scheduleAutoAdvance(450);
        });
        audio.addEventListener('error', () => {
            if (currentAudio === audio) currentAudio = null;
            audioPausedByUser = false;
            updateTourControls();
            if (!paused && tourLayer?.classList.contains('active')) scheduleAutoAdvance();
        });

        audio.play().catch(() => {
            if (currentAudio === audio) currentAudio = null;
            audioPausedByUser = false;
            updateTourControls();
            if (!paused && tourLayer?.classList.contains('active')) scheduleAutoAdvance();
        });

        scheduleAutoAdvance();
        updateTourControls();
        return true;
    }

    function replayCurrentStep() {
        clearAutoTimer();
        stopStepAudio();
        const usedAudio = playStepAudio(activeSteps[tourIndex]);
        if (!usedAudio) scheduleAutoAdvance();
    }

    function isTourAudioActive() {
        if (!(audioEnabled && currentAudio && !currentAudio.paused && !currentAudio.ended)) return false;

        const currentTime = currentAudio.currentTime || 0;
        if (currentTime > lastAudioCurrentTime + 0.05) {
            lastAudioCurrentTime = currentTime;
            audioProgressUpdatedAt = performance.now();
        }

        return performance.now() - audioProgressUpdatedAt < 2000;
    }

    function startStepAudioAfterFocus(step, waitForFocus) {
        const delayMs = waitForFocus ? FOCUS_SETTLE_MS : 0;
        const timerId = window.setTimeout(() => {
            if (!tourLayer?.classList.contains('active') || activeSteps[tourIndex] !== step) return;
            const usedAudio = playStepAudio(step);
            if (!usedAudio) scheduleAutoAdvance();
        }, delayMs);
        openSeqTimers.push(timerId);
    }

    function scheduleAutoAdvance(delayOverrideMs = null) {
        clearAutoTimer();
        if (paused) return;

        const step = activeSteps[tourIndex];
        const delayMs = delayOverrideMs ?? Math.round((step.durationMs || 7000) * AUTO_ADVANCE_MULTIPLIER);
        autoTimer = window.setTimeout(() => {
            if (isTourAudioActive()) {
                scheduleAutoAdvance(500);
                return;
            }
            advanceTour();
        }, delayMs);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // =========================================================================
    // DOCK PANEL CONTROL DURING THE TOUR
    // The tour opens the correct panel directly (without campaign gating or sound)
    // so the tour can point at the actual sub-elements. Reuses the same classes as
    // main.js' toggleDockPanel for a consistent appearance.
    // =========================================================================
    function openTourPanel(panelId) {
        // Close ONLY other panels — leave the target panel open if it already is,
        // to avoid a flicker when staying in the same menu (overview -> sub-step).
        document.querySelectorAll('.dock-panel.visible').forEach(p => {
            if (p.id !== panelId) p.classList.remove('visible');
        });
        document.querySelectorAll('.dock-item.active').forEach(d => {
            if (d.getAttribute('data-panel') !== panelId) d.classList.remove('active');
        });

        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.classList.add('visible');
        const dockItem = document.querySelector(`.dock-item[data-panel="${panelId}"]`);
        if (dockItem) dockItem.classList.add('active');
    }

    function closeTourPanels() {
        document.querySelectorAll('.dock-panel.visible').forEach(p => p.classList.remove('visible'));
        document.querySelectorAll('.dock-item.active').forEach(d => d.classList.remove('active'));
        closeTourSettings();
        closeTourInsights();
    }

    function openTourSettings() {
        const dropdown = document.getElementById('settingsDropdown');
        const wrapper = document.getElementById('topSettingsWrapper');
        if (!dropdown) return;
        dropdown.classList.add('visible', 'welcome-tour-raise');
        if (wrapper) wrapper.classList.add('welcome-tour-raise');
    }

    function closeTourSettings() {
        const dropdown = document.getElementById('settingsDropdown');
        const wrapper = document.getElementById('topSettingsWrapper');
        if (dropdown) dropdown.classList.remove('visible', 'welcome-tour-raise');
        if (wrapper) wrapper.classList.remove('welcome-tour-raise');
    }

    // Touren åbner Indsigt-menuen direkte, så fokusrammen omfatter både
    // Fysiologi og Hvad Nu Hvis.
    function openTourInsights() {
        const dropdown = document.getElementById('insightsDropdown');
        const wrapper = document.getElementById('insightsMenuWrapper');
        if (!dropdown) return;
        document.body.classList.add('welcome-tour-insights-preview');
        dropdown.classList.add('visible', 'welcome-tour-raise');
        if (wrapper) wrapper.classList.add('welcome-tour-raise');
    }

    function closeTourInsights() {
        const dropdown = document.getElementById('insightsDropdown');
        const wrapper = document.getElementById('insightsMenuWrapper');
        document.body.classList.remove('welcome-tour-insights-preview');
        if (dropdown) dropdown.classList.remove('visible', 'welcome-tour-raise');
        if (wrapper) wrapper.classList.remove('welcome-tour-raise');
    }

    function applyPanelState(step) {
        // Open the panel directly and keep focus on the content this step explains.
        // The earlier two-phase cursor animation was too distracting for an intro tour.
        if (step.openInsights) {
            closeTourPanels();
            openTourInsights();
        } else if (step.openSettings) {
            closeTourPanels();
            openTourSettings();
        } else if (step.panel) {
            closeTourSettings();
            openTourPanel(step.panel);
        } else {
            closeTourPanels();
        }
    }

    // =========================================================================
    // ANIMATED MOUSE CURSOR + MENU-OPEN CHOREOGRAPHY
    // On menu steps (openVia) a cursor glides to the dock icon, performs a
    // "click", and then the panel opens — showing the player WHERE to tap to
    // open e.g. the food menu and that the menu then expands.
    // =========================================================================
    function clearOpenSeqTimers() {
        openSeqTimers.forEach(id => window.clearTimeout(id));
        openSeqTimers = [];
    }

    // =========================================================================
    // PROFILE POPUP DURING THE TOUR
    // The profile step opens the REAL profile popup (read-only), raised above the
    // tour dim, so the player sees the actual fields (weight, ICR, ISF) while
    // The tour explains them. Closed again when leaving the step.
    // =========================================================================
    function openTourProfile() {
        closeTourProfile();
        if (typeof showProfilePopup !== 'function') return;

        // Open the profile in EDITABLE mode (the same code path used at startup,
        // which works without a running game). The readOnly:true path fails when
        // game is null. We then make it view-only afterwards by disabling all
        // inputs and hiding action buttons so the tour cannot change anything.
        showProfilePopup({});

        const overlays = [...document.querySelectorAll('.popup-overlay')];
        tourProfileOverlay = overlays.find(o => o.querySelector('.profile-popup')) || null;
        if (!tourProfileOverlay) return;

        tourProfileOverlay.classList.add('welcome-tour-profile-open');
        const profilePopup = tourProfileOverlay.querySelector('.profile-popup');
        if (profilePopup) profilePopup.classList.add('welcome-tour-profile-highlight');
        tourProfileOverlay.querySelectorAll('input').forEach(inp => {
            inp.readOnly = true;
            inp.style.opacity = '1';
        });
        tourProfileOverlay
            .querySelectorAll('#profileSaveButton, #profileStartButton, .popup-close-btn')
            .forEach(btn => { btn.style.display = 'none'; });

        // The profile popup may change height/width when inputs and buttons are
        // hidden. Re-measure the focus rect after the browser has laid out so the
        // profile gets a proper ring rather than only the green highlight glow.
        window.setTimeout(() => positionCurrentStep(), 40);
        window.setTimeout(() => positionCurrentStep(), 180);
    }

    function closeTourProfile() {
        if (tourProfileOverlay && tourProfileOverlay.parentNode) {
            tourProfileOverlay.parentNode.removeChild(tourProfileOverlay);
        }
        tourProfileOverlay = null;
    }

    function showCgmDemo() {
        const valueEl = document.getElementById('cgmValueDisplayGraph');
        const unitEl = document.getElementById('cgmUnitLabel');
        const trendEl = document.getElementById('cgm-trend');
        const iobEl = document.getElementById('iobDisplay');
        const cobEl = document.getElementById('cobDisplay');
        const heroEl = document.getElementById('cgm-hero');
        if (!valueEl || tourCgmDemoState) return;

        tourCgmDemoState = {
            value: valueEl.textContent,
            valueClass: valueEl.className,
            unit: unitEl?.textContent,
            trend: trendEl?.textContent,
            trendColor: trendEl?.style.color || '',
            iob: iobEl?.textContent,
            cob: cobEl?.textContent,
            heroClass: heroEl?.className
        };

        valueEl.textContent = typeof displayBG === 'function' ? displayBG(6.8) : '6.8';
        valueEl.className = 'cgm-number bg-target';
        if (unitEl) unitEl.textContent = typeof bgUnitLabel === 'function' ? bgUnitLabel() : 'mmol/L';
        if (trendEl) {
            trendEl.textContent = '→';
            trendEl.style.color = 'var(--green)';
        }
        if (iobEl) iobEl.textContent = '0.4';
        if (cobEl) cobEl.textContent = '18';
        updateCgmDemoHighlight(false);
    }

    function updateCgmDemoHighlight(shouldHighlight) {
        const heroEl = document.getElementById('cgm-hero');
        if (!heroEl || !tourCgmDemoState) return;
        heroEl.classList.toggle('glow-target', shouldHighlight);
        heroEl.classList.toggle('welcome-tour-cgm-demo', shouldHighlight);
    }

    function clearCgmDemo() {
        if (!tourCgmDemoState) return;
        const valueEl = document.getElementById('cgmValueDisplayGraph');
        const unitEl = document.getElementById('cgmUnitLabel');
        const trendEl = document.getElementById('cgm-trend');
        const iobEl = document.getElementById('iobDisplay');
        const cobEl = document.getElementById('cobDisplay');
        const heroEl = document.getElementById('cgm-hero');

        if (valueEl) {
            valueEl.textContent = tourCgmDemoState.value;
            valueEl.className = tourCgmDemoState.valueClass;
        }
        if (unitEl) unitEl.textContent = tourCgmDemoState.unit;
        if (trendEl) {
            trendEl.textContent = tourCgmDemoState.trend;
            trendEl.style.color = tourCgmDemoState.trendColor;
        }
        if (iobEl) iobEl.textContent = tourCgmDemoState.iob;
        if (cobEl) cobEl.textContent = tourCgmDemoState.cob;
        if (heroEl) heroEl.className = tourCgmDemoState.heroClass;
        tourCgmDemoState = null;
    }

    function hideCursor() {
        clearOpenSeqTimers();
        if (cursorEl) {
            cursorEl.classList.remove('visible', 'clicking');
        }
    }

    function moveCursorTo(rect, offX = 14, offY = 14) {
        if (!cursorEl) return;
        cursorEl.style.left = `${rect.left + rect.width / 2 + offX}px`;
        cursorEl.style.top = `${rect.top + rect.height / 2 + offY}px`;
    }

    function runOpenSequence(step) {
        clearOpenSeqTimers();
        const icon = document.querySelector(step.openVia);
        if (!icon || !cursorEl) {
            // Fall back to simple open if the icon is not found.
            openTourPanel(step.panel);
            return;
        }

        const iconRect = icon.getBoundingClientRect();

        // The cursor is positioned FIRST at the bubble without a transition (so it
        // does not glide in from an old position), then becomes visible, and then
        // glides to the icon.
        const bubbleRect = bubbleEl.getBoundingClientRect();
        cursorEl.style.transition = 'none';
        cursorEl.style.left = `${bubbleRect.left + bubbleRect.width / 2}px`;
        cursorEl.style.top = `${bubbleRect.top + bubbleRect.height / 2}px`;
        void cursorEl.offsetWidth;          // force reflow
        cursorEl.style.transition = '';     // re-enable CSS transition
        cursorEl.classList.add('visible');

        // Glide to the icon (the CSS transition on the cursor handles the movement).
        openSeqTimers.push(window.setTimeout(() => moveCursorTo(iconRect), 80));

        // Click pulse once the cursor has arrived.
        openSeqTimers.push(window.setTimeout(() => {
            cursorEl.classList.add('clicking');
            if (typeof playSound === 'function') playSound('menuOpen');
        }, 720));

        // Open the panel immediately after the "click" and move the ring to it.
        openSeqTimers.push(window.setTimeout(() => {
            cursorEl.classList.remove('clicking');
            openTourPanel(step.panel);
            const panel = document.getElementById(step.panel);
            if (panel) { panel.classList.add('welcome-tour-raise'); if (!highlightedEls.includes(panel)) highlightedEls.push(panel); }
            // Phase 2: the ring now points at the panel itself (no longer the dock icon).
            activeTargetSelector = step.target;
            // Wait for the panel to finish expanding, then let the ring glide to it.
            openSeqTimers.push(window.setTimeout(() => positionCurrentStep(), 60));
        }, 900));

        // Hide the cursor again once the menu is open.
        openSeqTimers.push(window.setTimeout(() => hideCursor(), 1500));
    }

    // =========================================================================
    // RAISE ELEMENTS ABOVE THE DIM LAYER
    // Elements being pointed at must be visible on top of the dark overlay.
    //   - Dock panels: position:absolute with transform -> only z-index is raised
    //     (.welcome-tour-raise); otherwise the panel's placement breaks.
    //   - Regular buttons/panels: .welcome-tour-highlight (z-index + glow).
    //   - chartDemo (graph): the graph is raised so demo points appear on top.
    //   - tipDemo: the demo card already lives in the tour layer above the dim.
    // =========================================================================
    function raiseStepElements(step) {
        const els = [];
        targetHighlighted = false;

        if (step.noTarget) {
            // The overview step intentionally has no highlight.
        } else if (step.tipDemo) {
            // The demo card is part of the tour layer and already sits above the dim.
        } else if (step.openProfile) {
            // The profile popup is marked by the target ring after it has opened.
            // The button was covered in the preceding step, so avoid double focus.
        } else if (step.panel) {
            const panel = document.getElementById(step.panel);
            if (panel) { panel.classList.add('welcome-tour-raise'); els.push(panel); }
            // Glow the EXACT sub-element (e.g. a preset row) directly on the
            // real DOM structure so the highlight cannot drift relative to a
            // floating ring. Skipped when target IS the panel itself because
            // .welcome-tour-highlight forces position:relative and would break the
            // panel's absolute+transform placement (see note at .welcome-tour-raise
            // in style.css).
            const panelTarget = document.querySelector(step.target);
            if (panelTarget && panelTarget.id !== step.panel) {
                panelTarget.classList.add('welcome-tour-highlight');
                els.push(panelTarget);
                targetHighlighted = true;
            }
        } else {
            const target = document.querySelector(activeTargetSelector || step.target);
            if (target) { target.classList.add('welcome-tour-highlight'); els.push(target); targetHighlighted = true; }
        }

        // The secondary target is raised only when it is NOT inside an open panel
        // (the panel is already raised). E.g. the time step: the speed stepper is standalone.
        if (step.secondaryTarget && !step.panel) {
            const secondary = document.querySelector(step.secondaryTarget);
            if (secondary) { secondary.classList.add('welcome-tour-highlight'); els.push(secondary); }
        }

        // Panel steps also highlight the dock icon the player uses to open the
        // panel. This makes e.g. the insulin and T1D Kit steps feel less detached.
        const openerSelector = getPanelOpenerSelector(step);
        const opener = openerSelector ? document.querySelector(openerSelector) : null;
        if (opener) { opener.classList.add('welcome-tour-highlight'); els.push(opener); }

        highlightedEls = els;
    }

    function getPanelOpenerSelector(step) {
        if (!step.showOpenerRing) return null;
        if (!step.panel) return null;
        if (step.openVia) return step.openVia;

        const panelOpeners = {
            'dock-panel-insulin': '.dock-item.d-insulin',
            'dock-panel-food': '.dock-item.d-food',
            'dock-panel-motion': '.dock-item.d-exercise',
            'dock-panel-kit': '.dock-item.d-kit'
        };
        return panelOpeners[step.panel] || null;
    }

    function clearHighlight(nextStep = null) {
        const keepGraphMarkers = !!nextStep?.chartDemo;
        highlightedEls.forEach(el => {
            el.classList.remove('welcome-tour-highlight');
            el.classList.remove('welcome-tour-raise');
        });
        highlightedEls = [];
        if (targetRing) targetRing.classList.remove('welcome-tour-chart-ring');
        if (targetRing) targetRing.classList.remove('welcome-tour-profile-ring');
        if (secondaryRing) secondaryRing.classList.remove('visible');
        if (openerRing) openerRing.classList.remove('visible');
        if (!keepGraphMarkers && !activeSteps[tourIndex]?.chartDemo) stopGraphDemo();
        hideCursor();
        closeTourProfile();
        if (!keepGraphMarkers && rangeDemoEl) rangeDemoEl.classList.remove('visible');
        if (tipDemoEl) tipDemoEl.classList.remove('visible');
        if (!keepGraphMarkers && dayNightDemoEl) dayNightDemoEl.classList.remove('visible');
    }

    // =========================================================================
    // GRAPH DEMO: show the REAL graph filling up with CGM points
    // Instead of drawing custom circles, points are fed into the global
    // cgmDataPoints array and the simulator's own drawGraph() renders them —
    // the same small coloured dots, the same time axis, the same target-range
    // colours as during gameplay. Points are added one at a time from left to
    // right so it resembles a real CGM trace building up over time.
    // =========================================================================
    function buildDemoSeries() {
        // Calm morning curve: mostly in the target zone (green) with a gentle wave
        // so the first impression feels safe. Points every 5 sim-minutes like a CGM.
        const stepMin = 5;
        const totalPoints = 72;         // ~6 hours, enough to show points without feeling rushed
        const series = [];
        for (let i = 0; i < totalPoints; i++) {
            const tMin = i * stepMin;
            const hours = tMin / 60;
            const base = 6.4 + 1.4 * Math.sin(hours / 2.1) + 0.6 * Math.sin(hours / 0.7);
            const value = Math.max(4.3, Math.min(9.0, base + Math.sin(i * 1.3) * 0.18));
            series.push({ time: tMin, value: Math.round(value * 10) / 10 });
        }
        return series;
    }

    function startGraphDemo() {
        if (demoCgmTimer || (typeof cgmDataPoints !== 'undefined' && cgmDataPoints.length > 0)) return;
        stopGraphDemo();
        if (typeof drawGraph !== 'function' || typeof cgmDataPoints === 'undefined') return;

        const series = buildDemoSeries();
        cgmDataPoints = [];
        drawGraph();

        let idx = 0;
        demoCgmTimer = window.setInterval(() => {
            // Stop if the tour has been closed or we are no longer on a graph step.
            if (!tourLayer?.classList.contains('active') || !activeSteps[tourIndex]?.chartDemo) {
                stopGraphDemo();
                return;
            }
            cgmDataPoints.push(series[idx]);
            drawGraph();
            idx += 1;
            if (idx >= series.length) {
                window.clearInterval(demoCgmTimer);
                demoCgmTimer = null;
            }
        }, GRAPH_DEMO_INTERVAL_MS);
    }

    function stopGraphDemo() {
        if (demoCgmTimer) {
            window.clearInterval(demoCgmTimer);
            demoCgmTimer = null;
        }
        // Clear the demo points so the empty graph is blank again (as at startup).
        if (typeof cgmDataPoints !== 'undefined' && !game) {
            cgmDataPoints = [];
            if (typeof drawGraph === 'function') drawGraph();
        }
    }

    function getGraphCanvasRect(fallbackRect) {
        const canvas = document.querySelector('#bg-graph');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
        if (canvasRect && canvasRect.width > 1 && canvasRect.height > 1) return canvasRect;
        return fallbackRect;
    }

    function getGraphChartRect(rect) {
        // Use the actual graph metrics from drawGraph() when available. This makes
        // the tour overlays robust against a dynamic y-axis and physiology bands.
        const metrics = window.t1dGraphMetrics;
        if (metrics && metrics.width > 1 && metrics.height > 1) {
            return {
                left: metrics.left,
                top: metrics.top,
                width: metrics.width,
                height: metrics.height,
                yAxisMin: metrics.yAxisMin,
                yAxisMax: metrics.yAxisMax
            };
        }

        // Fallback: same chart padding as drawGraph() in ui.js.
        const canvasRect = getGraphCanvasRect(rect);
        const chartPadding = { top: 20, right: 20, bottom: 44, left: 64 };
        const chartLeft = canvasRect.left + chartPadding.left;
        const chartTop = canvasRect.top + chartPadding.top;
        const chartWidth = canvasRect.width - chartPadding.left - chartPadding.right;
        const chartHeight = canvasRect.height - chartPadding.top - chartPadding.bottom;
        if (chartWidth <= 0 || chartHeight <= 0) return null;
        return { left: chartLeft, top: chartTop, width: chartWidth, height: chartHeight, yAxisMin: 0, yAxisMax: 16 };
    }

    function placeRangeDemo(rect) {
        if (!rangeDemoEl) return;

        const chart = getGraphChartRect(rect);
        if (!chart) return;

        const yAxisMin = Number.isFinite(chart.yAxisMin) ? chart.yAxisMin : 0;
        const yAxisMax = Number.isFinite(chart.yAxisMax) ? chart.yAxisMax : 16;
        const bgToY = value => chart.top + chart.height - ((value - yAxisMin) / (yAxisMax - yAxisMin)) * chart.height;

        rangeDemoEl.style.left = `${chart.left}px`;
        rangeDemoEl.style.top = `${chart.top}px`;
        rangeDemoEl.style.width = `${chart.width}px`;
        rangeDemoEl.style.height = `${chart.height}px`;

        const placeBand = (selector, low, high, labelKey) => {
            const band = rangeDemoEl.querySelector(selector);
            if (!band) return;
            const top = Math.max(chart.top, bgToY(high));
            const bottom = Math.min(chart.top + chart.height, bgToY(low));
            band.style.top = `${top - chart.top}px`;
            band.style.height = `${Math.max(0, bottom - top)}px`;
            const label = band.querySelector('span');
            if (label) label.textContent = t(labelKey);
        };

        placeBand('.score-half', 10.0, 14.0, 'welcomeTour.graphMarker.pointsHalf');
        placeBand('.score-one', 4.0, 10.0, 'welcomeTour.graphMarker.pointsOne');
        placeBand('.score-bonus', 5.0, 6.0, 'welcomeTour.graphMarker.pointsBonus');
        rangeDemoEl.classList.add('visible');
    }

    function placeDayNightDemo(rect) {
        if (!dayNightDemoEl) return;

        const chart = getGraphChartRect(rect);
        if (!chart) return;

        dayNightDemoEl.style.left = `${chart.left}px`;
        dayNightDemoEl.style.top = `${chart.top}px`;
        dayNightDemoEl.style.width = `${chart.width}px`;
        dayNightDemoEl.style.height = `${chart.height}px`;

        const nightLeft = dayNightDemoEl.querySelector('.wtdn-night-left');
        const day = dayNightDemoEl.querySelector('.wtdn-day');
        const nightRight = dayNightDemoEl.querySelector('.wtdn-night-right');

        if (nightLeft) {
            nightLeft.style.left = '0%';
            nightLeft.style.width = `${(7 / 24) * 100}%`;
            nightLeft.querySelector('span').textContent = t('welcomeTour.graphMarker.night');
        }
        if (day) {
            day.style.left = `${(7 / 24) * 100}%`;
            day.style.width = `${(15 / 24) * 100}%`;
            day.querySelector('span').textContent = t('welcomeTour.graphMarker.day');
        }
        if (nightRight) {
            nightRight.style.left = `${(22 / 24) * 100}%`;
            nightRight.style.width = `${(2 / 24) * 100}%`;
            nightRight.querySelector('span').textContent = t('welcomeTour.graphMarker.night');
        }

        dayNightDemoEl.classList.add('visible');
    }

    // Position and show the simulated tip card over the graph. Texts are set in
    // renderStep; this function only handles positioning.
    function placeTipDemoCard() {
        if (!tipDemoEl) return;
        tipDemoEl.classList.add('visible');

        // Issue #8: place the demo tip in the same position as real in-game tips —
        // top-left of the chart area. drawGraph() renders tips at
        // padding.left+15 / padding.top+25, and getGraphChartRect uses the same
        // chart padding, so the card lands exactly where a real tip would appear.
        const graph = document.querySelector('#graph-area-container');
        const gr = graph ? graph.getBoundingClientRect()
                         : { left: window.innerWidth / 2 - 200, top: 120, width: 400, height: 240 };
        const chart = getGraphChartRect(gr) || { left: gr.left + 64, top: gr.top + 20 };

        const cardRect = tipDemoEl.getBoundingClientRect();
        const left = clamp(chart.left + 8, 12, window.innerWidth - cardRect.width - 12);
        const top = clamp(chart.top + 8, 12, window.innerHeight - cardRect.height - 220);
        tipDemoEl.style.left = `${left}px`;
        tipDemoEl.style.top = `${top}px`;
    }

    // Arrow + bubble for the tip-demo step: the arrow points at the guide icon, the bubble sits below the card.
    function placeTipDemoArrowBubble(cardRect) {
        const arrowSize = 94;
        const btn = document.querySelector('#welcomeTourTipDemoBtn');
        const btnRect = btn ? btn.getBoundingClientRect() : cardRect;

        // Arrow to the left of the guide icon, pointing right towards it.
        const arrowLeft = clamp(btnRect.left - arrowSize - 4, 10, window.innerWidth - arrowSize - 10);
        const arrowTop = clamp(btnRect.top + btnRect.height / 2 - arrowSize / 2, 10, window.innerHeight - arrowSize - 10);
        arrowEl.style.left = `${arrowLeft}px`;
        arrowEl.style.top = `${arrowTop}px`;
        arrowEl.style.transform = 'rotate(0deg)';

        // Bubble centred below the card.
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const bubbleLeft = clamp(cardRect.left + cardRect.width / 2 - bubbleRect.width / 2, 14, window.innerWidth - bubbleRect.width - 14);
        const bubbleTop = clamp(cardRect.bottom + 26, 14, window.innerHeight - bubbleRect.height - 14);
        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;
    }

    function placeBubble(rect, step) {
        const margin = 18;
        const arrowSize = 94;
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let bubbleLeft;
        let bubbleTop;

        if (step.arrow === 'top') {
            bubbleLeft = rect.left + rect.width / 2 - bubbleRect.width / 2;
            bubbleTop = rect.top - bubbleRect.height - arrowSize - margin;
        } else if (step.arrow === 'bottom') {
            bubbleLeft = rect.left + rect.width / 2 - bubbleRect.width / 2;
            bubbleTop = rect.bottom + arrowSize + margin;
        } else if (step.arrow === 'right') {
            bubbleLeft = rect.right + arrowSize + margin;
            bubbleTop = rect.top + rect.height / 2 - bubbleRect.height / 2;
        } else {
            bubbleLeft = rect.left - bubbleRect.width - arrowSize - margin;
            bubbleTop = rect.top + rect.height / 2 - bubbleRect.height / 2;
        }

        bubbleLeft = clamp(bubbleLeft, 14, viewportWidth - bubbleRect.width - 14);
        bubbleTop = clamp(bubbleTop, 14, viewportHeight - bubbleRect.height - 14);
        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;
        return { bubbleLeft, bubbleTop, bubbleRect };
    }

    function placeBubbleBesideRect(rect) {
        const margin = 18;
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let bubbleLeft;
        let bubbleTop = rect.top + rect.height / 2 - bubbleRect.height / 2;

        if (viewportWidth - rect.right >= bubbleRect.width + margin + 14) {
            bubbleLeft = rect.right + margin;
        } else if (rect.left >= bubbleRect.width + margin + 14) {
            bubbleLeft = rect.left - bubbleRect.width - margin;
        } else {
            bubbleLeft = rect.left + rect.width / 2 - bubbleRect.width / 2;
            bubbleTop = rect.bottom + margin;
            if (bubbleTop + bubbleRect.height > viewportHeight - 14) {
                bubbleTop = rect.top - bubbleRect.height - margin;
            }
        }

        bubbleLeft = clamp(bubbleLeft, 14, viewportWidth - bubbleRect.width - 14);
        bubbleTop = clamp(bubbleTop, 14, viewportHeight - bubbleRect.height - 14);
        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;
    }

    function rectsOverlap(a, b, padding = 0) {
        return !(
            a.right < b.left - padding ||
            a.left > b.right + padding ||
            a.bottom < b.top - padding ||
            a.top > b.bottom + padding
        );
    }

    function placeProfileBubble(profileRect) {
        const margin = 18;
        const edge = 14;
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const rawCandidates = [
            // Try the sides first because they let the player see the profile fields.
            { left: profileRect.right + margin, top: profileRect.top },
            { left: profileRect.left - bubbleRect.width - margin, top: profileRect.top },
            // On very narrow screens the sides may not have enough space.
            { left: profileRect.left + profileRect.width / 2 - bubbleRect.width / 2, top: profileRect.bottom + margin },
            { left: profileRect.left + profileRect.width / 2 - bubbleRect.width / 2, top: profileRect.top - bubbleRect.height - margin },
            { left: viewportWidth - bubbleRect.width - edge, top: edge },
            { left: edge, top: edge }
        ];

        const candidates = rawCandidates.map(candidate => {
            const left = clamp(candidate.left, edge, viewportWidth - bubbleRect.width - edge);
            const top = clamp(candidate.top, edge, viewportHeight - bubbleRect.height - edge);
            return {
                left,
                top,
                right: left + bubbleRect.width,
                bottom: top + bubbleRect.height
            };
        });

        const nonOverlapping = candidates.find(candidate => !rectsOverlap(candidate, profileRect, 10));
        const chosen = nonOverlapping || candidates[0];

        bubbleEl.style.left = `${chosen.left}px`;
        bubbleEl.style.top = `${chosen.top}px`;
    }

    function placePanelBubbleBesideRect(rect, panelId, targetSelector = '') {
        const bubbleKey = panelId ? `${panelId}|${targetSelector || ''}` : '';
        if (bubbleKey && panelBubblePositions[bubbleKey]) {
            const stored = panelBubblePositions[bubbleKey];
            bubbleEl.style.left = `${stored.left}px`;
            bubbleEl.style.top = `${stored.top}px`;
            return;
        }

        const margin = 18;
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let bubbleLeft;
        let bubbleTop = rect.top;

        if (viewportWidth - rect.right >= bubbleRect.width + margin + 14) {
            bubbleLeft = rect.right + margin;
        } else if (rect.left >= bubbleRect.width + margin + 14) {
            bubbleLeft = rect.left - bubbleRect.width - margin;
        } else {
            // When the dock panel is in the middle of the screen there is not always
            // room on the sides. Use a fixed offset above the panel so the bubble
            // does not jump between sub-steps just because the text height changes.
            bubbleLeft = rect.left + rect.width / 2 - bubbleRect.width / 2;
            const spaceAbove = rect.top - 14;
            const spaceBelow = viewportHeight - rect.bottom - 14;
            const preferBelow = spaceBelow >= bubbleRect.height + margin || spaceBelow > spaceAbove;
            bubbleTop = preferBelow
                ? rect.bottom + margin
                : rect.top - bubbleRect.height - margin;
        }

        bubbleLeft = clamp(bubbleLeft, 14, viewportWidth - bubbleRect.width - 14);
        bubbleTop = clamp(bubbleTop, 14, viewportHeight - bubbleRect.height - 14);
        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;

        if (bubbleKey) {
            panelBubblePositions[bubbleKey] = { left: bubbleLeft, top: bubbleTop };
        }
    }

    function placeDockGuideBubble() {
        const margin = 28;
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const graphEl = document.getElementById('graph-area-container');
        const graphRect = graphEl?.getBoundingClientRect() || {
            left: 14,
            top: 14,
            right: window.innerWidth - 14,
            bottom: window.innerHeight - 14,
            width: window.innerWidth - 28,
            height: window.innerHeight - 28
        };

        // The Mac-menu walkthrough uses one stable text position at the bottom-right
        // of the graph area. The focus ring still moves to the current icon or panel
        // content, but the text does not jump between steps.
        let bubbleLeft = graphRect.right - bubbleRect.width - margin;
        let bubbleTop = graphRect.bottom - bubbleRect.height - margin;

        bubbleLeft = clamp(bubbleLeft, graphRect.left + 14, window.innerWidth - bubbleRect.width - 14);
        bubbleTop = clamp(bubbleTop, graphRect.top + 14, window.innerHeight - bubbleRect.height - 14);

        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;
        return { bubbleLeft, bubbleTop, bubbleRect };
    }

    function placeArrow(rect, bubblePosition, step) {
        const arrowSize = 94;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let arrowLeft = centerX - arrowSize / 2;
        let arrowTop = centerY - arrowSize / 2;
        let rotate = 0;

        if (step.arrow === 'top') {
            arrowTop = rect.top - arrowSize - 8;
            rotate = 90;
        } else if (step.arrow === 'bottom') {
            arrowTop = rect.bottom + 8;
            rotate = 270;
        } else if (step.arrow === 'right') {
            arrowLeft = rect.right + 8;
            rotate = 180;
        } else {
            arrowLeft = rect.left - arrowSize - 8;
            rotate = 0;
        }

        const bubbleRect = {
            left: bubblePosition.bubbleLeft,
            top: bubblePosition.bubbleTop,
            right: bubblePosition.bubbleLeft + bubblePosition.bubbleRect.width,
            bottom: bubblePosition.bubbleTop + bubblePosition.bubbleRect.height
        };

        const arrowRect = {
            left: arrowLeft,
            top: arrowTop,
            right: arrowLeft + arrowSize,
            bottom: arrowTop + arrowSize
        };

        const overlapsBubble = !(
            arrowRect.right < bubbleRect.left ||
            arrowRect.left > bubbleRect.right ||
            arrowRect.bottom < bubbleRect.top ||
            arrowRect.top > bubbleRect.bottom
        );

        if (overlapsBubble) {
            if (step.arrow === 'top') arrowTop = bubbleRect.bottom + 6;
            if (step.arrow === 'bottom') arrowTop = bubbleRect.top - arrowSize - 6;
            if (step.arrow === 'left') arrowLeft = bubbleRect.right + 6;
            if (step.arrow === 'right') arrowLeft = bubbleRect.left - arrowSize - 6;
        }

        arrowLeft = clamp(arrowLeft, 10, window.innerWidth - arrowSize - 10);
        arrowTop = clamp(arrowTop, 10, window.innerHeight - arrowSize - 10);
        arrowEl.style.left = `${arrowLeft}px`;
        arrowEl.style.top = `${arrowTop}px`;
        arrowEl.style.transform = `rotate(${rotate}deg)`;
    }

    function placeGraphStep(rect, step = {}) {
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const arrowSize = 94;

        let bubbleLeft;
        let bubbleTop;

        if (step.bubblePlacement === 'graphCenter') {
            // The first graph steps should feel like one continuous explanation of
            // the graph. They therefore share the same calm position centred in the chart area.
            bubbleLeft = rect.left + rect.width / 2 - bubbleRect.width / 2;
            bubbleTop = rect.top + rect.height / 2 - bubbleRect.height / 2;
        } else if (step.bubblePlacement === 'screenCenter') {
            bubbleLeft = window.innerWidth / 2 - bubbleRect.width / 2;
            bubbleTop = window.innerHeight / 2 - bubbleRect.height / 2;
        } else {
            bubbleLeft = rect.left + rect.width * 0.50 - bubbleRect.width / 2;
            bubbleTop = rect.bottom - bubbleRect.height - 70;
        }

        bubbleLeft = clamp(bubbleLeft, 14, window.innerWidth - bubbleRect.width - 14);
        bubbleTop = clamp(bubbleTop, 14, window.innerHeight - bubbleRect.height - 14);

        bubbleEl.style.left = `${bubbleLeft}px`;
        bubbleEl.style.top = `${bubbleTop}px`;

        const arrowLeft = clamp(rect.left + 34, 10, window.innerWidth - arrowSize - 10);
        const arrowTop = clamp(rect.top + rect.height * 0.46 - arrowSize / 2, 10, window.innerHeight - arrowSize - 10);
        arrowEl.style.left = `${arrowLeft}px`;
        arrowEl.style.top = `${arrowTop}px`;
        arrowEl.style.transform = 'rotate(0deg)';
    }

    function setRing(ring, rect, padding) {
        ring.style.left = `${rect.left - padding}px`;
        ring.style.top = `${rect.top - padding}px`;
        ring.style.width = `${rect.width + padding * 2}px`;
        ring.style.height = `${rect.height + padding * 2}px`;
    }

    function mergeRects(rects) {
        const visibleRects = rects.filter(rect => rect && rect.width > 1 && rect.height > 1);
        if (!visibleRects.length) return null;
        const left = Math.min(...visibleRects.map(rect => rect.left));
        const top = Math.min(...visibleRects.map(rect => rect.top));
        const right = Math.max(...visibleRects.map(rect => rect.right));
        const bottom = Math.max(...visibleRects.map(rect => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }

    function getFocusRectForStep(step, target, baseRect) {
        if (step.includePreviousLabel) {
            const label = target.previousElementSibling?.classList.contains('dp-section-label')
                ? target.previousElementSibling
                : null;
            return mergeRects([
                label?.getBoundingClientRect(),
                baseRect
            ]) || baseRect;
        }
        return step.chartDemo ? (getGraphChartRect(baseRect) || baseRect) : baseRect;
    }

    // Find the element the ring should point at. Falls back to an alternative
    // (e.g. the hamburger menu) if the primary element is hidden — and uses
    // the dock icon in phase 1 of the menu-open choreography.
    function isElementVisible(el) {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && el.offsetParent === null) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
    }

    function resolveTargetSelector(step) {
        if (step.noTarget) return null;
        if (step.panel || step.tipDemo) return step.target;
        const primary = document.querySelector(step.target);
        if (!isElementVisible(primary) && step.fallbackTarget && isElementVisible(document.querySelector(step.fallbackTarget))) {
            return step.fallbackTarget;
        }
        return step.target;
    }

    function positionCurrentStep() {
        if (!tourLayer?.classList.contains('active')) return;

        const step = activeSteps[tourIndex];

        if (step.noTarget) {
            if (targetRing) {
                targetRing.style.display = '';
                targetRing.classList.remove('visible');
            }
            if (secondaryRing) secondaryRing.classList.remove('visible');
            if (openerRing) openerRing.classList.remove('visible');
            if (arrowEl) arrowEl.style.display = 'none';
            if (rangeDemoEl) rangeDemoEl.classList.remove('visible');
            if (dayNightDemoEl) dayNightDemoEl.classList.remove('visible');
            placeGraphStep(document.getElementById('graph-area-container')?.getBoundingClientRect() || {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                right: window.innerWidth,
                bottom: window.innerHeight
            }, step);
            return;
        }

        // Profile popup step: highlight only the open profile popup. The button
        // was presented in the preceding step, so the tour keeps one focus point at a time.
        if (step.openProfile) {
            const profilePopup = tourProfileOverlay?.querySelector('.profile-popup')
                || document.querySelector('.popup-overlay.welcome-tour-profile-open .profile-popup');

            targetRing.style.display = '';
            targetRing.classList.add('welcome-tour-profile-ring');
            targetRing.classList.remove('welcome-tour-chart-ring');
            arrowEl.style.display = 'none';
            if (profilePopup) {
                setRing(targetRing, profilePopup.getBoundingClientRect(), 14);
                targetRing.classList.add('visible');
                placeProfileBubble(profilePopup.getBoundingClientRect());
            } else {
                targetRing.classList.remove('visible');
            }
            if (secondaryRing) secondaryRing.classList.remove('visible');
            if (openerRing) openerRing.classList.remove('visible');
            return;
        }
        // Ring and arrow are visible on all other steps.
        targetRing.style.display = '';
        targetRing.classList.remove('welcome-tour-profile-ring');
        arrowEl.style.display = '';

        // Tip demo: position the card first so the ring can measure it.
        if (step.tipDemo) placeTipDemoCard();

        const target = document.querySelector(activeTargetSelector || step.target);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const focusRect = getFocusRectForStep(step, target, rect);
        // Panel content such as insulin rows and food rows may have sliders,
        // glows, and internal margins that make a pixel-precise ring feel slightly
        // off. Use a larger, more forgiving ring around panel elements.
        const ringPadding = step.focusPadding ?? (step.panel ? 22 : step.keepRing ? 14 : 8);
        setRing(targetRing, focusRect, ringPadding);
        targetRing.classList.toggle('welcome-tour-chart-ring', !!step.chartDemo);

        // Small dock icons and panel rows need a proper focus box. On them
        // a filter-glow is too subtle and can look like a missing highlight.
        const ringAsPrimary = step.chartDemo || step.keepRing || step.panel || !targetHighlighted;
        targetRing.classList.toggle('visible', ringAsPrimary);

        if (rangeDemoEl) rangeDemoEl.classList.toggle('visible', step.graphMarker === 'range');
        if (dayNightDemoEl) dayNightDemoEl.classList.toggle('visible', step.graphMarker === 'dayNight');

        const openerSelector = getPanelOpenerSelector(step);
        const opener = openerSelector ? document.querySelector(openerSelector) : null;
        if (opener && openerRing) {
            setRing(openerRing, opener.getBoundingClientRect(), 6);
            openerRing.classList.add('visible');
        } else if (openerRing) {
            openerRing.classList.remove('visible');
        }

        const secondaryTarget = step.secondaryTarget ? document.querySelector(step.secondaryTarget) : null;
        if (secondaryTarget && secondaryRing) {
            setRing(secondaryRing, secondaryTarget.getBoundingClientRect(), ringPadding);
            secondaryRing.classList.add('visible');
        } else if (secondaryRing) {
            secondaryRing.classList.remove('visible');
        }

        if (step.chartDemo) {
            if (step.graphMarker === 'range') placeRangeDemo(rect);
            if (step.graphMarker === 'dayNight') placeDayNightDemo(rect);
            placeGraphStep(focusRect, step);
        } else if (step.tipDemo) {
            placeTipDemoArrowBubble(rect);
        } else if (step.dockGuide) {
            const bubblePosition = placeDockGuideBubble();
            placeArrow(focusRect, bubblePosition, step);
        } else if (step.panel) {
            const panel = document.getElementById(step.panel);
            const panelRect = panel ? panel.getBoundingClientRect() : rect;
            placePanelBubbleBesideRect(panelRect, step.panel, step.target);
            placeArrow(rect, {
                bubbleLeft: bubbleEl.getBoundingClientRect().left,
                bubbleTop: bubbleEl.getBoundingClientRect().top,
                bubbleRect: bubbleEl.getBoundingClientRect()
            }, step);
        } else {
            const bubblePosition = placeBubble(rect, step);
            placeArrow(rect, bubblePosition, step);
        }
    }

    function renderStep() {
        if (renderTimer) { window.clearTimeout(renderTimer); renderTimer = null; }

        const step = activeSteps[tourIndex];

        // Tip demo: populate the simulated tip BEFORE measuring, so the card has content.
        if (step.tipDemo) {
            if (tipDemoTextEl) tipDemoTextEl.textContent = t('welcomeTour.tipDemo.text', typeof bgVars === 'function' ? bgVars() : {});
            if (tipDemoLinkEl) tipDemoLinkEl.textContent = t('welcomeTour.tipDemo.link');
        }

        activeTargetSelector = resolveTargetSelector(step);

        const exists = step.noTarget || step.tipDemo || !!document.querySelector(activeTargetSelector);
        if (!exists) {
            advanceTour();
            return;
        }

        // Only the text bubble fades briefly. Focus frames and graph markers
        // stay visible and can glide smoothly to the next topic instead of blinking.
        bubbleEl.classList.add('is-fading');
        clearAutoTimer();

        renderTimer = window.setTimeout(() => {
            renderTimer = null;
            if (!tourLayer?.classList.contains('active')) return;

            clearHighlight(step);      // clear the previous step's raises, but preserve graph markers between graph steps
            applyPanelState(step);
            raiseStepElements(step);
            bubbleEl.classList.toggle('wide', !!step.wideBubble);

            titleEl.textContent = t(step.titleKey);
            textEl.textContent = t(step.textKey, typeof bgVars === 'function' ? bgVars() : {});
            progressEl.textContent = t('welcomeTour.progress', { current: tourIndex + 1, total: activeSteps.length });
            updateTourControls();
            showCgmDemo();
            updateCgmDemoHighlight(step.target === '#cgm-hero');

            if (step.openProfile) openTourProfile();      // open the real profile popup
            positionCurrentStep();                        // ring/arrow/bubble glide into place
            scheduleStableReposition(step);
            if (step.chartDemo) startGraphDemo();          // fill the graph with real CGM points
            const shouldWaitForFocus = glideEnabled && !step.noTarget;
            if (!glideEnabled) {
                glideEnabled = true;
                tourLayer.classList.add('glide');
            }

            // The text bubble stays invisible (is-fading) while the green focus
            // rect glides to its target. Only after the ring has settled
            // (FOCUS_SETTLE_MS) does the bubble fade in — so the player does not
            // read text about one element while the ring still points at the previous one.
            if (shouldWaitForFocus) {
                const settleStep = step;
                const settleTimer = window.setTimeout(() => {
                    if (!tourLayer?.classList.contains('active')) return;
                    if (activeSteps[tourIndex] !== settleStep) return;
                    bubbleEl.classList.remove('is-fading');
                }, FOCUS_SETTLE_MS);
                openSeqTimers.push(settleTimer);
            } else {
                bubbleEl.classList.remove('is-fading');
            }

            startStepAudioAfterFocus(step, shouldWaitForFocus);
        }, glideEnabled ? STEP_TEXT_FADE_MS : 0);
    }

    function startTour(tourId = 'intro') {
        const tour = TOURS[tourId] || TOURS.intro;
        activeSteps = tour.steps;
        panelBubblePositions = {};

        closeWelcome();
        closeBlockingPopupsBeforeTour();
        buildTourLayer();
        tourIndex = 0;
        // The tour starts as a guided walkthrough: auto-advance and speech are on,
        // but the player can always turn them off using the toggles below the nav.
        paused = false;
        audioEnabled = true;
        audioPausedByUser = false;
        glideEnabled = false;
        tourLayer.classList.remove('glide');
        if (tourDim) tourDim.classList.add('active');
        tourLayer.classList.add('active');
        document.body.classList.add('welcome-tour-running');
        showCgmDemo();
        renderStep();
    }

    function endTour() {
        markCompleted();
        stopStepAudio();
        clearAutoTimer();
        if (renderTimer) { window.clearTimeout(renderTimer); renderTimer = null; }
        clearHighlight();
        clearCgmDemo();
        closeTourPanels();
        panelBubblePositions = {};
        if (tourDim) tourDim.classList.remove('active');
        if (tourLayer) tourLayer.classList.remove('active');
        document.body.classList.remove('welcome-tour-running');
        show({ force: true });
    }

    function goBack() {
        if (tourIndex <= 0) return;
        tourIndex -= 1;
        renderStep();
    }

    function advanceTour() {
        if (tourIndex >= activeSteps.length - 1) {
            endTour();
            return;
        }

        tourIndex += 1;
        renderStep();
    }

    function handleTourKeydown(e) {
        if (!tourLayer?.classList.contains('active')) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        const key = e.key;

        // Escape ends the entire tour (same as the "End tour" button).
        if (key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            endTour();
            return;
        }

        if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;

        // The tour uses the same forward/back logic as the buttons. The capture
        // listener also suppresses the simulator's normal arrow-key shortcuts while
        // the tour is running.
        e.preventDefault();
        e.stopPropagation();
        clearAutoTimer();
        stopStepAudio();

        if (key === 'ArrowLeft') {
            goBack();
        } else {
            advanceTour();
        }
    }

    function togglePause() {
        paused = !paused;
        updateTourControls();

        if (paused) {
            clearAutoTimer();
            return;
        }

        scheduleAutoAdvance();
    }

    function toggleSpeechPause() {
        if (!audioEnabled || !currentAudio) return;

        if (currentAudio.paused) {
            audioPausedByUser = false;
            currentAudio.play().catch(() => {
                currentAudio = null;
                updateTourControls();
                if (!paused) scheduleAutoAdvance();
            });
            if (!paused) scheduleAutoAdvance();
        } else {
            currentAudio.pause();
            audioPausedByUser = true;
            clearAutoTimer();
        }

        updateTourControls();
    }

    function toggleVoice() {
        audioEnabled = !audioEnabled;
        updateTourControls();
        clearAutoTimer();

        if (!audioEnabled) {
            stopStepAudio();
            scheduleAutoAdvance();
            updateTourControls();
            return;
        }

        const usedAudio = playStepAudio(activeSteps[tourIndex]);
        if (!usedAudio) scheduleAutoAdvance();
    }

    function updateTourControls() {
        if (!pauseBtn) return;

        // Auto-advance belongs to navigation. Speech pause/replay belongs to
        // narration and is controlled separately from the tour's auto-advance.
        if (navGroupTitleEl) navGroupTitleEl.textContent = t('welcomeTour.group.navigation');
        if (speechGroupTitleEl) speechGroupTitleEl.textContent = t('welcomeTour.group.speech');

        const iconEl = pauseBtn.querySelector('.welcome-tour-state-icon');
        const labelEl = pauseBtn.querySelector('.welcome-tour-state-label');
        const autoOn = !paused;
        if (iconEl) iconEl.textContent = '';   // empty — CSS draws the toggle itself
        if (labelEl) labelEl.textContent = t('welcomeTour.autoPlay');
        pauseBtn.classList.toggle('paused', paused);   // .paused => toggle in OFF state
        pauseBtn.setAttribute('role', 'switch');
        pauseBtn.setAttribute('aria-checked', autoOn ? 'true' : 'false');
        pauseBtn.title = autoOn ? t('welcomeTour.autoPlayOn') : t('welcomeTour.autoPlayOff');

        if (audioPauseBtn) {
            const hasCurrentAudio = !!(audioEnabled && currentAudio);
            const speechIsPaused = !!(currentAudio && currentAudio.paused);
            audioPauseBtn.textContent = speechIsPaused ? t('welcomeTour.resumeSpeech') : t('welcomeTour.pauseSpeech');
            audioPauseBtn.disabled = !hasCurrentAudio;
            audioPauseBtn.title = hasCurrentAudio
                ? (speechIsPaused ? t('welcomeTour.resumeSpeech') : t('welcomeTour.pauseSpeech'))
                : t(audioEnabled ? 'welcomeTour.replayNoAudio' : 'welcomeTour.replayUnavailable');
        }

        if (voiceBtn) {
            const soundLabel = voiceBtn.querySelector('.welcome-tour-sound-label');
            if (soundLabel) soundLabel.textContent = t('welcomeTour.sound');
            voiceBtn.classList.toggle('sound-off', !audioEnabled);
            voiceBtn.setAttribute('role', 'switch');
            voiceBtn.setAttribute('aria-checked', audioEnabled ? 'true' : 'false');
            voiceBtn.title = audioEnabled ? t('welcomeTour.soundOn') : t('welcomeTour.soundOff');
        }
        if (replayBtn) {
            const hasStepAudio = !!getAudioSource(activeSteps[tourIndex]);
            const replayAvailable = audioEnabled && hasStepAudio;
            replayBtn.textContent = t('welcomeTour.replay');
            replayBtn.disabled = !replayAvailable;
            replayBtn.title = replayAvailable
                ? t('welcomeTour.replay')
                : t(audioEnabled ? 'welcomeTour.replayNoAudio' : 'welcomeTour.replayUnavailable');
        }
        if (skipBtn) skipBtn.textContent = t('welcomeTour.skip');

        if (backBtn) {
            backBtn.textContent = t('welcomeTour.back');
            backBtn.title = t('welcomeTour.back');
            backBtn.setAttribute('aria-label', t('welcomeTour.back'));
            backBtn.disabled = tourIndex === 0;
        }

        if (nextBtn) {
            const isLastStep = tourIndex === activeSteps.length - 1;
            nextBtn.textContent = isLastStep ? t('welcomeTour.done') : t('welcomeTour.next');
            nextBtn.title = isLastStep ? t('welcomeTour.done') : t('welcomeTour.next');
            nextBtn.setAttribute('aria-label', isLastStep ? t('welcomeTour.done') : t('welcomeTour.next'));
        }
    }

    function init(options = {}) {
        callbacks = options;
    }

    function show(options = {}) {
        if (!options.force && !shouldShowOnStartup()) return;
        buildWelcomeOverlay();
    }

    return {
        init,
        show,
        startTour,
        shouldShowOnStartup,
        hasCompletedTour,
        markCompleted
    };
})();
