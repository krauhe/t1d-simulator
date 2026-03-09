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
let startButton, helpButton, pauseButton, speedSelector, dayDisplay,
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
// FLYVENDE IKON — Animér et ikon fra panelet ned til grafen
// =============================================================================
//
// Når brugeren udfører en handling (giv insulin, spis mad, start motion),
// flyver et ikon fra panelknappen ned til grafen. Dette giver visuelt
// feedback selvom panelet lukkes, så brugeren kan se at handlingen skete.
//
// @param {string} emoji — Ikon-tegnet der skal animeres (fx '💉', '🍔')
// @param {string} panelId — ID på dock-panelet handlingen kom fra
// =============================================================================
function flyIconToGraph(emoji, sourceId) {
    const source = document.getElementById(sourceId);
    const graph = document.getElementById('bg-graph');
    if (!source || !graph) return;

    // Start-position: midten af kilde-elementet (panel eller ikon)
    const panelRect = source.getBoundingClientRect();
    const graphRect = graph.getBoundingClientRect();

    const icon = document.createElement('span');
    icon.className = 'flying-icon';
    icon.textContent = emoji;
    icon.style.left = (panelRect.left + panelRect.width / 2 - 14) + 'px';
    icon.style.top = (panelRect.top + 20) + 'px';
    document.body.appendChild(icon);

    // Luk panelet med det samme
    closeDockPanels();

    // Beregn tidsmæssig x-position på grafen (hvor ikonet placeres)
    // Grafens x-akse: padding.left + (timeInDay / 1440) * graphWidth
    const padding = { left: 58, right: 20 };
    const graphWidth = graphRect.width - padding.left - padding.right;
    let xFraction = 0.8; // Default: højre del af grafen
    if (game) {
        const timeInDay = game.timeInMinutes % 1440;
        xFraction = timeInDay / 1440;
    }
    const targetX = graphRect.left + padding.left + xFraction * graphWidth;
    const targetY = graphRect.top + graphRect.height - 25;

    // Start animationen til grafens aktuelle tidsposition (næste frame for CSS transition)
    requestAnimationFrame(() => {
        icon.style.left = targetX + 'px';
        icon.style.top = targetY + 'px';
        icon.classList.add('animate');
    });

    // Fjern ikonet efter animationen
    setTimeout(() => icon.remove(), 700);
}


// =============================================================================
// SOS GLUCAGON — Fælles funktion til SOS-knap og B-shortcut
// =============================================================================
//
// Kaldes fra både SOS dock-item klik og B keyboard shortcut.
// Tjekker cooldown, udfører glucagon, og giver visuel feedback.
// =============================================================================
function triggerGlucagonSOS() {
    if (!game || game.isGameOver) return;
    const cooldownMinutes = 24 * 60;
    const timeSinceUsed = game.totalSimMinutes - game.glucagonUsedTime;
    if (timeSinceUsed >= cooldownMinutes) {
        game.useGlucagon();
        closeDockPanels();
        // Visuel feedback: flash SOS-ikonet + flyv ✚ ikon til grafen
        const sosItem = document.getElementById('glucagonDockItem');
        if (sosItem) {
            sosItem.classList.add('sos-activated');
            setTimeout(() => sosItem.classList.remove('sos-activated'), 600);
        }
        // Flyv ✚ ikon fra SOS-ikonet til grafens aktuelle tidsposition
        flyIconToGraph('\u271A', 'glucagonDockItem');
    }
}


// =============================================================================
// STOP BEKRÆFTELSE — "Er du sikker?" popup når spilleren klikker Stop
// =============================================================================
function showStopConfirmPopup() {
    // Pausér spillet mens popup vises
    const wasPaused = isPaused;
    if (!isPaused) togglePause();

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = `
        <div class="popup-content" style="text-align:center; max-width:380px;">
            <h2 style="color: var(--red); font-size: 1.4em;">Stop spil?</h2>
            <p style="margin: 16px 0;">Er du sikker på at du vil stoppe simulationen? Al fremgang går tabt.</p>
            <div style="display:flex; gap:12px; justify-content:center; margin-top:20px;">
                <button id="stopConfirmYes" style="background: linear-gradient(135deg, #dc2626, #b91c1c); box-shadow: 0 4px 15px rgba(220,38,38,0.3);">Ja, stop</button>
                <button id="stopConfirmNo" style="background: linear-gradient(135deg, #374151, #1f2937); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">Annuller</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('stopConfirmYes').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resetGame();
    });
    document.getElementById('stopConfirmNo').addEventListener('click', () => {
        document.body.removeChild(overlay);
        // Genoptag hvis spillet ikke var pauseret før
        if (!wasPaused) togglePause();
    });
}


// =============================================================================
// CUSTOM FOOD PANEL — "Byg din egen" som forgrening fra mad-dock-panelet
// =============================================================================
//
// Toggler synlighed af custom food panelet (dock-panel-custom-food).
// Panelet er positioneret som en forgrening ved siden af mad-panelet.
// =============================================================================
function showCustomFoodPanel() {
    const customPanel = document.getElementById('dock-panel-custom-food');
    if (!customPanel) return;

    // Toggle: luk mad-panelet, vis custom-panelet (eller omvendt)
    const foodPanel = document.getElementById('dock-panel-food');
    if (foodPanel) foodPanel.classList.remove('visible');

    // Vis custom-panelet
    customPanel.classList.toggle('visible');
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

    // Fjern fokus fra ALLE slidere når musen slippes, så keyboard shortcuts virker igen
    [fastInsulinSlider, longInsulinSlider, carbsSlider, proteinSlider, fatSlider].forEach(slider => {
        slider.addEventListener('change', () => slider.blur());
    });

    // --- Game control buttons ---
    // Start-knappen fungerer som både Start og Stop.
    // Når spillet kører: viser "Er du sikker?" bekræftelsespopup før reset.
    startButton.addEventListener('click', () => {
        if (game && !game.isGameOver) {
            // Spillet kører → vis bekræftelsespopup
            showStopConfirmPopup();
        } else {
            // Intet spil → start nyt
            startGame();
        }
    });
    helpButton.addEventListener('click', showHelpPopup);
    pauseButton.addEventListener('click', togglePause);

    // --- Mute button: toggler lyd (#12: ikon viser nuværende status) ---
    muteButton.addEventListener('click', () => {
        isMuted = !isMuted;
        // (#12) Vis nuværende status: 🔊 = lyd er tændt, 🔇 = lyd er slukket
        muteButton.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';
        if (sounds && Tone.Destination) Tone.Destination.mute = isMuted;
    });

    // --- Hastigheds-vælger ---
    speedSelector.addEventListener('change', (e) => {
        if (game) game.simulationSpeed = parseInt(e.target.value);
    });

    // --- Food buttons: preset meals + "Lav selv" popup ---
    // Alle mad-knapper luk panelet og flyver et ikon ned til grafen.
    // Preset meals med faste makronæringsprofiler (kulhydrat, protein, fedt)
    dextroButton.addEventListener('click', () => { if(game) { game.addFood(3, 0, 0, '\u{1F36C}'); flyIconToGraph('\u{1F36C}', 'dock-panel-food'); } });
    document.getElementById('appleButton').addEventListener('click', () => { if(game) { game.addFood(20, 0, 0, '\u{1F34E}'); flyIconToGraph('\u{1F34E}', 'dock-panel-food'); } });
    burgerButton.addEventListener('click', () => { if(game) { game.addFood(40, 30, 30, '\u{1F354}'); flyIconToGraph('\u{1F354}', 'dock-panel-food'); } });
    avocadoButton.addEventListener('click', () => { if(game) { game.addFood(5, 5, 25, '\u{1F951}'); flyIconToGraph('\u{1F951}', 'dock-panel-food'); } });
    chickenButton.addEventListener('click', () => { if(game) { game.addFood(2, 30, 15, '\u{1F357}'); flyIconToGraph('\u{1F357}', 'dock-panel-food'); } });
    cakeButton.addEventListener('click', () => { if(game) { game.addFood(60, 5, 25, '\u{1F370}'); flyIconToGraph('\u{1F370}', 'dock-panel-food'); } });
    sodaButton.addEventListener('click', () => { if(game) { game.addFood(35, 0, 0, '\u{1F964}'); flyIconToGraph('\u{1F964}', 'dock-panel-food'); } });
    saladButton.addEventListener('click', () => { if(game) { game.addFood(5, 2, 1, '\u{1F957}'); flyIconToGraph('\u{1F957}', 'dock-panel-food'); } });
    cerealButton.addEventListener('click', () => { if(game) { game.addFood(30, 8, 2, '\u{1F963}'); flyIconToGraph('\u{1F963}', 'dock-panel-food'); } });

    // --- Insulin buttons: preset-knapper + custom slider ---
    // Hurtig insulin presets (1, 2, 4 enheder)
    document.getElementById('fastPreset1').addEventListener('click', () => {
        if(game) { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); }
    });
    document.getElementById('fastPreset2').addEventListener('click', () => {
        if(game) { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); }
    });
    document.getElementById('fastPreset4').addEventListener('click', () => {
        if(game) { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); }
    });
    // Hurtig insulin custom slider
    giveFastInsulinButton.addEventListener('click', () => {
        if(game) { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); }
    });
    // Basal insulin presets (1/3, 2/3, 1x anbefalet)
    document.getElementById('basalPreset1').addEventListener('click', () => {
        if(game) { const dose = Math.round(game.basalDose / 3); game.addLongInsulin(dose); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); }
    });
    document.getElementById('basalPreset2').addEventListener('click', () => {
        if(game) { const dose = Math.round(game.basalDose * 2 / 3); game.addLongInsulin(dose); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); }
    });
    document.getElementById('basalPreset3').addEventListener('click', () => {
        if(game) { game.addLongInsulin(game.basalDose); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); }
    });
    // Basal insulin custom slider
    giveLongInsulinButton.addEventListener('click', () => {
        if(game) { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); }
    });

    // --- Motion controls ---
    [motionIntensitySelect, motionDurationSelect].forEach(el =>
        el.addEventListener('change', updateMotionKcal)
    );
    startMotionButton.addEventListener('click', () => {
        if(game && !startMotionButton.disabled) {
            game.startMotion(motionIntensitySelect.value, motionDurationSelect.value);
            flyIconToGraph('\u{1F3C3}', 'dock-panel-motion');
        }
    });

    // --- Måling og nødhjælp: flyv ikon til graf ---
    fingerprickButton.addEventListener('click', () => { if(game) { game.performFingerprick(); flyIconToGraph('\u{1FA78}', 'dock-panel-measure'); } });
    ketoneTestButton.addEventListener('click', () => { if(game) { game.performKetoneTest(); flyIconToGraph('\u{1F9EA}', 'dock-panel-measure'); } });
    glucagonButton.addEventListener('click', () => {
        if (game && !glucagonButton.disabled) game.useGlucagon();
    });

    // SOS dock-item: trigger glucagon direkte (#5: fix — tjek cooldown via game i stedet for hidden button)
    const glucagonDockItem = document.getElementById('glucagonDockItem');
    if (glucagonDockItem) {
        glucagonDockItem.addEventListener('click', (e) => {
            e.stopPropagation(); // Forhindrer at dock-panel system fanger klikket
            triggerGlucagonSOS();
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

    // Event log er nu altid synlig (ingen toggle nødvendig)

    // =========================================================================
    // "LAV SELV" — Åbn custom food panel som forgrening fra mad-panelet
    // =========================================================================
    const customFoodToggle = document.getElementById('customFoodToggle');
    if (customFoodToggle) {
        customFoodToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!game) return;
            showCustomFoodPanel();
        });
    }

    // Custom food sliders og spis-knap
    const customCarbsSlider = document.getElementById('customCarbsSlider');
    const customProteinSlider = document.getElementById('customProteinSlider');
    const customFatSlider = document.getElementById('customFatSlider');
    const customCarbsVal = document.getElementById('customCarbsVal');
    const customProteinVal = document.getElementById('customProteinVal');
    const customFatVal = document.getElementById('customFatVal');
    const customKcalDisplay = document.getElementById('customKcalDisplay');
    const customKeDisplay = document.getElementById('customKeDisplay');

    function updateCustomFoodDisplay() {
        const c = parseInt(customCarbsSlider.value), p = parseInt(customProteinSlider.value), f = parseInt(customFatSlider.value);
        customCarbsVal.textContent = c; customProteinVal.textContent = p; customFatVal.textContent = f;
        customKcalDisplay.textContent = (c * 4 + p * 4 + f * 9).toFixed(0);
        customKeDisplay.textContent = (c + p * 0.25).toFixed(0);
    }
    [customCarbsSlider, customProteinSlider, customFatSlider].forEach(s =>
        s.addEventListener('input', updateCustomFoodDisplay)
    );
    updateCustomFoodDisplay();

    document.getElementById('customFoodEat').addEventListener('click', () => {
        if (game) {
            game.addFood(parseInt(customCarbsSlider.value), parseInt(customProteinSlider.value), parseInt(customFatSlider.value));
            flyIconToGraph('\u{1F374}', 'dock-panel-custom-food');
        }
        closeDockPanels();
    });

    // =========================================================================
    // #8: MOTION INTENSITETS-CHIPS — Klik skifter intensitet
    // =========================================================================
    document.querySelectorAll('.intensity-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Fjern 'selected' fra alle chips
            document.querySelectorAll('.intensity-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            // Opdater den skjulte select
            motionIntensitySelect.value = chip.dataset.intensity;
            updateMotionKcal();
        });
    });

    // =========================================================================
    // #15: STATS SEKTIONER — Sammenklappelige
    // =========================================================================
    document.querySelectorAll('.stats-collapse-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const section = toggle.closest('.stats-section');
            if (section) section.classList.toggle('collapsed');
        });
    });

    // =========================================================================
    // CORNER TOOLS — Debug og fysiologi ikoner (nu i top-bar højre side)
    // =========================================================================
    document.querySelectorAll('.corner-tool-btn[data-panel]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDockPanel(btn.dataset.panel);
        });
    });

    // =========================================================================
    // KEYBOARD SHORTCUTS — RTS-stil chord-system
    // =========================================================================
    // Første tast åbner panel (Z=insulin, X=mad, C=motion, V=målinger).
    // Anden tast udfører handling — virker BÅDE som chord (hurtigt ZZ)
    // OG som enkelt-tryk når panelet allerede er åbent.
    //
    // Insulin (Z): Z/X/C = 1/2/4E hurtig, A/S/D = basal presets, V/F = custom
    // Mad (X):     Z/X/C/V = presets (dextro/æble/havregryn/burger)
    // Målinger (V): Z = fingerprik, X = keton-stik
    // =========================================================================
    let chordFirstKey = null;      // Første tast i chord-sekvens
    let chordTimeout = null;       // Timer til at nulstille chord
    const CHORD_TIMEOUT_MS = 600;  // Tid til at trykke 2. tast

    // Hjælpefunktion: tjek om et bestemt panel er åbent
    function isPanelOpen(panelId) {
        const panel = document.getElementById(panelId);
        return panel && panel.classList.contains('visible');
    }

    // Udfør en sub-handling for et åbent panel
    function executeSubAction(key) {
        if (!game) return false;

        // --- Insulin panel åbent ---
        if (isPanelOpen('dock-panel-insulin')) {
            if (key === 'z') { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); return true; }
            if (key === 'x') { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); return true; }
            if (key === 'c') { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); return true; }
            if (key === 'v') { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin'); return true; }
            if (key === 'a') { game.addLongInsulin(Math.round(game.basalDose / 3)); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); return true; }
            if (key === 's') { game.addLongInsulin(Math.round(game.basalDose * 2 / 3)); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); return true; }
            if (key === 'd') { game.addLongInsulin(game.basalDose); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); return true; }
            if (key === 'f') { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F58A}\uFE0F', 'dock-panel-insulin'); return true; }
        }

        // --- Mad panel åbent ---
        if (isPanelOpen('dock-panel-food')) {
            if (key === 'z') { game.addFood(3, 0, 0, '\u{1F36C}'); flyIconToGraph('\u{1F36C}', 'dock-panel-food'); return true; }
            if (key === 'x') { game.addFood(20, 0, 0, '\u{1F34E}'); flyIconToGraph('\u{1F34E}', 'dock-panel-food'); return true; }
            if (key === 'c') { game.addFood(30, 8, 2, '\u{1F963}'); flyIconToGraph('\u{1F963}', 'dock-panel-food'); return true; }
            if (key === 'v') { game.addFood(40, 30, 30, '\u{1F354}'); flyIconToGraph('\u{1F354}', 'dock-panel-food'); return true; }
        }

        // --- Målinger panel åbent ---
        if (isPanelOpen('dock-panel-measure')) {
            if (key === 'z') { game.fingerprick(); flyIconToGraph('\u{1FA78}', 'dock-panel-measure'); return true; }
            if (key === 'x') { game.ketoneTest(); flyIconToGraph('\u{1F9EA}', 'dock-panel-measure'); return true; }
        }

        return false;
    }

    document.addEventListener('keydown', (e) => {
        // Ignorer shortcuts når input-felter eller selects har fokus
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        const key = e.key.toLowerCase();

        // Space og Escape virker altid direkte (ingen chord)
        if (key === ' ') { e.preventDefault(); if (game) togglePause(); return; }
        if (key === 'escape') { closeDockPanels(); chordFirstKey = null; return; }
        if (key === 'b') { e.preventDefault(); triggerGlucagonSOS(); chordFirstKey = null; return; }

        // Taltaster 1-9: direkte genvej til hurtig insulin med den pågældende dosis
        // ½ (dansk tastatur) giver 0.5 E
        if (game && (key >= '1' && key <= '9' || key === '½')) {
            e.preventDefault();
            const dose = key === '½' ? 0.5 : parseInt(key);
            game.addFastInsulin(dose);
            flyIconToGraph('\u{1F489}', 'dock-panel-insulin');
            chordFirstKey = null;
            return;
        }

        // --- Chord 2. tast (hurtig sekvens, fx ZZ) ---
        if (chordFirstKey) {
            e.preventDefault();
            chordFirstKey = null;
            if (chordTimeout) { clearTimeout(chordTimeout); chordTimeout = null; }
            // Panelet blev åbnet af 1. tast, nu udfør sub-handling
            executeSubAction(key);
            return;
        }

        // --- Panel allerede åbent: enkelt-tryk sub-handling ---
        // Når panelet er synligt behøver man kun trykke én tast
        if (['z', 'x', 'c', 'v', 'a', 's', 'd', 'f'].includes(key)) {
            // Prøv sub-handling først (hvis relevant panel er åbent)
            if (executeSubAction(key)) {
                e.preventDefault();
                return;
            }
        }

        // --- Første tast: åbn panel + start chord-timer ---
        if (['z', 'x', 'c', 'v'].includes(key)) {
            e.preventDefault();
            const panelMap = { z: 'dock-panel-insulin', x: 'dock-panel-food', c: 'dock-panel-motion', v: 'dock-panel-measure' };
            toggleDockPanel(panelMap[key]);

            // Start chord-timer for hurtig sekvens
            chordFirstKey = key;
            chordTimeout = setTimeout(() => { chordFirstKey = null; }, CHORD_TIMEOUT_MS);
        }
    });
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
