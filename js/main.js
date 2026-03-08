// =============================================================================
// MAIN.JS — Application entry point: globals, DOM references, event listeners
// =============================================================================
//
// Denne fil er den sidste i script-kæden (loadet efter sounds.js, hovorka.js,
// simulator.js, ui.js og game.js). Den fungerer som applikationens entry point:
//
//   1. Deklarerer alle globale variable og konstanter
//   2. Fanger DOM element-referencer ved page load
//   3. Sætter event listeners op (knap-klik, slider-ændringer, dock-paneler osv.)
//
// Alle filer deler det globale scope (ingen module system).
// Variable deklareret her er tilgængelige fra alle andre filer.
//
// Script loading order: sounds.js → hovorka.js → simulator.js → ui.js → game.js → main.js
//
// Dependencies: Alle andre JS filer skal være loadet før denne.
// Exports (global): Alle variable herunder, initializeApp()
// =============================================================================


// =============================================================================
// GLOBALE DOM ELEMENT-REFERENCER
// =============================================================================
// Holdes som `let` (uinitialiseret) og tildeles i initializeApp() efter DOM er klar.
// Andre filer (simulator.js, ui.js) tilgår disse direkte via variabelnavne.
// =============================================================================
let startButton, resetButton, helpButton, pauseButton, speedSelector, dayDisplay,
    timeDisplay, cgmValueDisplayGraph, normoPointsDisplay, normoPointsWeighting,
    muteButton, carbsSlider, carbsValue, proteinSlider, proteinValue, fatSlider,
    fatValue, giveFoodButton, foodInfoDisplay, foodKcalDisplay, foodKeDisplay,
    dextroButton, burgerButton, avocadoButton, chickenButton, cakeButton,
    sodaButton, saladButton, cerealButton, fastInsulinSlider, fastInsulinValue,
    giveFastInsulinButton, longInsulinSlider, longInsulinValue, giveLongInsulinButton,
    motionIntensitySelect, motionDurationSelect, startMotionButton, motionKcalDisplay,
    fingerprickButton, ketoneTestButton, glucagonButton, debugTrueBgCheckbox,
    iobDisplay, cobDisplay, bgGraphCanvas, graphCtx, weightChangeSlider,
    weightChangeValue, steepDropWarningDiv, weightDisplay, icrDisplay, isfDisplay,
    carbEffectDisplay, basalDoseDisplay, restingKcalDisplay, tir24hDisplay,
    titr24hDisplay, avgCgm24hDisplay, fastInsulin24hDisplay, basalInsulin24hDisplay,
    kcal24hDisplay, tir14dDisplay, titr14dDisplay, avgCgm14dDisplay,
    lastBolusTimerDisplay, kcalBalance24hDisplay, fastInsulin7dDisplay,
    basalInsulin7dDisplay, kcal7dDisplay, kcalBalance7dDisplay;


// =============================================================================
// GLOBALE SPILTILSTANDS-VARIABLE OG KONFIGURATIONSKONSTANTER
// =============================================================================

// game: den aktuelle Simulator-instans (null når intet spil kører)
let game;

// gameLoopIntervalId: handle fra requestAnimationFrame til at stoppe loopet
let gameLoopIntervalId = null;

// lastFrameTime: timestamp for forrige frame (til deltaTime-beregning)
let lastFrameTime = 0;

// isPaused: om simulationen er pauseret
let isPaused = true;

// cgmDataPoints / trueBgPoints: arrays af {time, value} objekter til grafren.
let cgmDataPoints = [];
let trueBgPoints = [];

// MAX_GRAPH_POINTS_PER_DAY: max datapunkter pr. dag (288 = ét punkt pr. 5 min)
const MAX_GRAPH_POINTS_PER_DAY = 288;

// Kaloriekonstanter
const KCAL_PER_KG_WEIGHT = 7700;  // kcal pr. kg kropsvægt-ændring
const RESTING_KCAL_PER_DAY = 2200;
const RESTING_KCAL_PER_MINUTE = RESTING_KCAL_PER_DAY / (24 * 60);


// =============================================================================
// CANVAS SIZING — Responsivt layout og high-DPI understøttelse
// =============================================================================
const sizeCanvas = () => {
    if (!bgGraphCanvas) return;
    const rect = bgGraphCanvas.getBoundingClientRect();
    if (rect.width > 0) {
        const dpr = window.devicePixelRatio || 1;
        bgGraphCanvas.width = rect.width * dpr;
        bgGraphCanvas.height = rect.height * dpr;
        graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGraph();
    } else {
        setTimeout(sizeCanvas, 50);
    }
}


// =============================================================================
// DOCK PANEL SYSTEM — Åbn/luk fold-op paneler fra dock-baren
// =============================================================================
//
// Hver dock-item har en data-panel attribut der peger på et panel-element.
// Klik på et dock-item toggler dets panel (og lukker andre åbne paneler).
// Klik udenfor et åbent panel lukker det også.
//
// Panelerne bruger CSS-klassen 'visible' til at vise sig med en fade+slide animation.
// Dock-items får 'active' klassen når deres panel er åbent.
// =============================================================================

/**
 * toggleDockPanel — Åbn eller luk et dock-panel.
 * @param {string} panelId — ID på det panel der skal toggles
 */
function toggleDockPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const isCurrentlyVisible = panel.classList.contains('visible');

    // Luk ALLE åbne paneler først
    document.querySelectorAll('.dock-panel.visible').forEach(p => {
        p.classList.remove('visible');
    });
    // Fjern 'active' fra alle dock-items
    document.querySelectorAll('.dock-item.active').forEach(d => {
        d.classList.remove('active');
    });

    // Hvis panelet ikke var åbent: åbn det nu
    if (!isCurrentlyVisible) {
        panel.classList.add('visible');
        // Marker det tilhørende dock-item som aktivt
        const dockItem = document.querySelector(`.dock-item[data-panel="${panelId}"]`);
        if (dockItem) dockItem.classList.add('active');
    }
}

/**
 * closeDockPanels — Luk alle åbne dock-paneler.
 * Kaldes når brugeren klikker udenfor et panel.
 */
function closeDockPanels() {
    document.querySelectorAll('.dock-panel.visible').forEach(p => {
        p.classList.remove('visible');
    });
    document.querySelectorAll('.dock-item.active').forEach(d => {
        d.classList.remove('active');
    });
}


// =============================================================================
// initializeApp — Engangs-setup når siden indlæses
// =============================================================================
function initializeApp() {
    // --- Tildel alle DOM element-referencer ---
    startButton = document.getElementById('startButton');
    resetButton = document.getElementById('resetButton');
    helpButton = document.getElementById('helpButton');
    pauseButton = document.getElementById('pauseButton');
    speedSelector = document.getElementById('speedSelector');
    dayDisplay = document.getElementById('dayDisplay');
    timeDisplay = document.getElementById('timeDisplay');
    cgmValueDisplayGraph = document.getElementById('cgmValueDisplayGraph');
    normoPointsDisplay = document.getElementById('normoPointsDisplay');
    normoPointsWeighting = document.getElementById('normoPointsWeighting');
    muteButton = document.getElementById('muteButton');
    carbsSlider = document.getElementById('carbsSlider');
    carbsValue = document.getElementById('carbsValue');
    proteinSlider = document.getElementById('proteinSlider');
    proteinValue = document.getElementById('proteinValue');
    fatSlider = document.getElementById('fatSlider');
    fatValue = document.getElementById('fatValue');
    giveFoodButton = document.getElementById('giveFoodButton');
    foodInfoDisplay = document.getElementById('foodInfoDisplay');
    foodKcalDisplay = document.getElementById('foodKcalDisplay');
    foodKeDisplay = document.getElementById('foodKeDisplay');
    dextroButton = document.getElementById('dextroButton');
    burgerButton = document.getElementById('burgerButton');
    avocadoButton = document.getElementById('avocadoButton');
    chickenButton = document.getElementById('chickenButton');
    cakeButton = document.getElementById('cakeButton');
    sodaButton = document.getElementById('sodaButton');
    saladButton = document.getElementById('saladButton');
    cerealButton = document.getElementById('cerealButton');
    fastInsulinSlider = document.getElementById('fastInsulinSlider');
    fastInsulinValue = document.getElementById('fastInsulinValue');
    giveFastInsulinButton = document.getElementById('giveFastInsulinButton');
    longInsulinSlider = document.getElementById('longInsulinSlider');
    longInsulinValue = document.getElementById('longInsulinValue');
    giveLongInsulinButton = document.getElementById('giveLongInsulinButton');
    motionIntensitySelect = document.getElementById('motionIntensity');
    motionDurationSelect = document.getElementById('motionDuration');
    startMotionButton = document.getElementById('startMotionButton');
    motionKcalDisplay = document.getElementById('motionKcalDisplay');
    fingerprickButton = document.getElementById('fingerprickButton');
    ketoneTestButton = document.getElementById('ketoneTestButton');
    glucagonButton = document.getElementById('glucagonButton');
    debugTrueBgCheckbox = document.getElementById('debugTrueBgCheckbox');
    iobDisplay = document.getElementById('iobDisplay');
    cobDisplay = document.getElementById('cobDisplay');
    bgGraphCanvas = document.getElementById('bg-graph');
    graphCtx = bgGraphCanvas.getContext('2d');
    weightChangeSlider = document.getElementById('weightChangeSlider');
    weightChangeValue = document.getElementById('weightChangeValue');
    steepDropWarningDiv = document.getElementById('steep-drop-warning');
    weightDisplay = document.getElementById('weightDisplay');
    icrDisplay = document.getElementById('icrDisplay');
    isfDisplay = document.getElementById('isfDisplay');
    carbEffectDisplay = document.getElementById('carbEffectDisplay');
    basalDoseDisplay = document.getElementById('basalDoseDisplay');
    restingKcalDisplay = document.getElementById('restingKcalDisplay');
    tir24hDisplay = document.getElementById('tir24h');
    titr24hDisplay = document.getElementById('titr24h');
    avgCgm24hDisplay = document.getElementById('avgCgm24h');
    fastInsulin24hDisplay = document.getElementById('fastInsulin24h');
    basalInsulin24hDisplay = document.getElementById('basalInsulin24h');
    kcal24hDisplay = document.getElementById('kcal24h');
    tir14dDisplay = document.getElementById('tir14d');
    titr14dDisplay = document.getElementById('titr14d');
    avgCgm14dDisplay = document.getElementById('avgCgm14d');
    lastBolusTimerDisplay = document.getElementById('lastBolusTimer');
    kcalBalance24hDisplay = document.getElementById('kcalBalance24h');
    fastInsulin7dDisplay = document.getElementById('fastInsulin7d');
    basalInsulin7dDisplay = document.getElementById('basalInsulin7d');
    kcal7dDisplay = document.getElementById('kcal7d');
    kcalBalance7dDisplay = document.getElementById('kcalBalance7d');

    // --- Initial UI setup ---
    sizeCanvas();
    updatePlayerFixedDataUI();
    resetButton.disabled = true;
    updateFoodDisplay();
    updateMotionKcal();
    weightChangeSlider.style.setProperty('--thumb-color', '#4CAF50');

    // =========================================================================
    // EVENT LISTENERS — Forbind UI-elementer med deres handler-funktioner
    // =========================================================================

    // --- Food slider change handlers ---
    carbsSlider.addEventListener('input', (e) => { carbsValue.textContent = e.target.value; updateFoodDisplay(); });
    proteinSlider.addEventListener('input', (e) => { proteinValue.textContent = e.target.value; updateFoodDisplay(); });
    fatSlider.addEventListener('input', (e) => { fatValue.textContent = e.target.value; updateFoodDisplay(); });

    // --- Insulin slider change handlers ---
    fastInsulinSlider.addEventListener('input', (e) => fastInsulinValue.textContent = parseFloat(e.target.value).toFixed(1));
    longInsulinSlider.addEventListener('input', (e) => longInsulinValue.textContent = e.target.value);

    // --- Game control buttons ---
    startButton.addEventListener('click', startGame);
    resetButton.addEventListener('click', resetGame);
    helpButton.addEventListener('click', showHelpPopup);
    pauseButton.addEventListener('click', togglePause);

    // --- Mute button: toggler lyd (emoji ikon skifter) ---
    muteButton.addEventListener('click', () => {
        isMuted = !isMuted;
        muteButton.textContent = isMuted ? '\u{1F50A}' : '\u{1F507}';
        if (sounds && Tone.Destination) Tone.Destination.mute = isMuted;
    });

    // --- Hastigheds-vælger ---
    speedSelector.addEventListener('change', (e) => {
        if (game) game.simulationSpeed = parseInt(e.target.value);
    });

    // --- Food buttons: custom måltid fra sliders + preset meals ---
    giveFoodButton.addEventListener('click', () => {
        if(game) game.addFood(parseInt(carbsSlider.value), parseInt(proteinSlider.value), parseInt(fatSlider.value));
    });
    // Preset meals med faste makronæringsprofiler (kulhydrat, protein, fedt)
    dextroButton.addEventListener('click', () => { if(game) game.addFood(3, 0, 0, '\u{1F36C}'); });
    burgerButton.addEventListener('click', () => { if(game) game.addFood(40, 30, 30, '\u{1F354}'); });
    avocadoButton.addEventListener('click', () => { if(game) game.addFood(5, 5, 25, '\u{1F951}'); });
    chickenButton.addEventListener('click', () => { if(game) game.addFood(2, 30, 15, '\u{1F357}'); });
    cakeButton.addEventListener('click', () => { if(game) game.addFood(60, 5, 25, '\u{1F370}'); });
    sodaButton.addEventListener('click', () => { if(game) game.addFood(35, 0, 0, '\u{1F964}'); });
    saladButton.addEventListener('click', () => { if(game) game.addFood(5, 2, 1, '\u{1F957}'); });
    cerealButton.addEventListener('click', () => { if(game) game.addFood(30, 8, 2, '\u{1F963}'); });

    // --- Insulin buttons ---
    giveFastInsulinButton.addEventListener('click', () => {
        if(game) game.addFastInsulin(parseFloat(fastInsulinSlider.value));
    });
    giveLongInsulinButton.addEventListener('click', () => {
        if(game) game.addLongInsulin(parseInt(longInsulinSlider.value));
    });

    // --- Motion controls ---
    [motionIntensitySelect, motionDurationSelect].forEach(el =>
        el.addEventListener('change', updateMotionKcal)
    );
    startMotionButton.addEventListener('click', () => {
        if(game && !startMotionButton.disabled) {
            game.startMotion(motionIntensitySelect.value, motionDurationSelect.value);
        }
    });

    // --- Måling og nødhjælp ---
    fingerprickButton.addEventListener('click', () => { if(game) game.performFingerprick(); });
    ketoneTestButton.addEventListener('click', () => { if(game) game.performKetoneTest(); });
    glucagonButton.addEventListener('click', () => {
        if (game && !glucagonButton.disabled) game.useGlucagon();
    });

    // SOS dock-item: trigger den skjulte glucagon-knap
    const glucagonDockItem = document.getElementById('glucagonDockItem');
    if (glucagonDockItem) {
        glucagonDockItem.addEventListener('click', () => {
            if (game && !glucagonButton.disabled) {
                game.useGlucagon();
            }
        });
    }

    // --- Debug checkbox ---
    debugTrueBgCheckbox.addEventListener('change', () => { if(game) drawGraph(); });

    // =========================================================================
    // DOCK PANEL SYSTEM — Klik på dock-items åbner/lukker fold-op paneler
    // =========================================================================

    // Tilføj click-handler til alle dock-items der har et data-panel attribut
    document.querySelectorAll('.dock-item[data-panel]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // Forhindrer at click-udenfor-handler lukker panelet
            toggleDockPanel(item.dataset.panel);
        });
    });

    // Klik udenfor et åbent panel: luk det
    // Bruger event delegation på game-container for performance
    document.getElementById('game-container').addEventListener('click', (e) => {
        // Tjek om klikket ramte inde i et dock-panel eller dock-item
        if (e.target.closest('.dock-panel') || e.target.closest('.dock-item')) {
            return; // Lad panelet/dock-item håndtere det selv
        }
        closeDockPanels();
    });

    // Forhindrer at klik inde i dock-paneler bobler op og lukker panelet
    document.querySelectorAll('.dock-panel').forEach(panel => {
        panel.addEventListener('click', (e) => e.stopPropagation());
    });

    // =========================================================================
    // STATS PANEL TOGGLE — Fold sidebar ind/ud
    // =========================================================================
    const statsToggle = document.getElementById('stats-toggle');
    const statsPanel = document.getElementById('stats-panel');
    if (statsToggle && statsPanel) {
        statsToggle.addEventListener('click', () => {
            statsPanel.classList.toggle('collapsed');
            statsToggle.textContent = statsPanel.classList.contains('collapsed') ? '\u25B6' : '\u25C0';
            // Resize canvas når sidebaren folder (grafen får mere/mindre plads)
            setTimeout(sizeCanvas, 400);
        });
    }

    // =========================================================================
    // EVENT LOG TOGGLE — Fold hændelsesloggen ind/ud
    // =========================================================================
    const eventLogHeader = document.getElementById('event-log-header');
    const eventLog = document.getElementById('event-log');
    if (eventLogHeader && eventLog) {
        eventLogHeader.addEventListener('click', () => {
            eventLog.classList.toggle('collapsed');
        });
    }
}


// =============================================================================
// APP INITIALISERING — Kør initializeApp når DOM er klar
// =============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Resize canvas når vinduet ændrer størrelse
window.addEventListener('resize', sizeCanvas);
