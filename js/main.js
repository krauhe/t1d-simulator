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
let startButton, helpButton, pauseButton, profileButton, speedSelector, dayDisplay,
    timeDisplay, cgmValueDisplayGraph, normoPointsDisplay, normoPointsWeighting,
    muteButton, carbsSlider, carbsValue, proteinSlider, proteinValue, fatSlider,
    fatValue, giveFoodButton, foodInfoDisplay, foodKcalDisplay, foodKeDisplay,
    dextroButton, burgerButton, avocadoButton, chickenButton, cakeButton,
    sodaButton, saladButton, cerealButton, fastInsulinSlider, fastInsulinValue,
    giveFastInsulinButton, longInsulinSlider, longInsulinValue, giveLongInsulinButton,
    motionIntensitySelect, motionDurationSelect, startMotionButton, motionKcalDisplay,
    fingerprickButton, ketoneTestButton, debugTrueBgCheckbox,
    iobDisplay, cobDisplay, bgGraphCanvas, graphCtx,
    weightChangeValue, steepDropWarningDiv, weightDisplay, icrDisplay, isfDisplay,
    carbEffectDisplay, basalDoseDisplay, restingKcalDisplay, tir24hDisplay,
    titr24hDisplay, avgCgm24hDisplay, fastInsulin24hDisplay, basalInsulin24hDisplay,
    kcal24hDisplay, tir14dDisplay, titr14dDisplay, avgCgm14dDisplay,
    kcalBalance24hDisplay, fastInsulin7dDisplay,
    basalInsulin7dDisplay, kcal7dDisplay, kcalBalance7dDisplay;

// =============================================================================
// DEBUG LOG SYSTEM — Samler interne simulationsdata i en CSV-buffer.
// Bruges til fejlfinding: download filen og del den med udvikleren.
// Logges hvert 5. simulationsminut for at holde størrelsen håndterbar.
// =============================================================================
let debugLogEnabled = false;         // Aktiveret via checkbox i debug-panelet
let debugLogData = [];               // Array af CSV-rækker (strings)
let debugLogLastTime = -Infinity;    // Sidste loggede sim-tid (undgå duplikater)
const DEBUG_LOG_INTERVAL = 5;        // Log hvert 5. sim-minut

// CSV-header med alle relevante interne parametre
const DEBUG_LOG_HEADER = 'Dag,Tid,SimMin,TrueBG,CgmBG,IOB,SubQ,PlasmaI,COB,Ketoner,x1,x2,x3,EGP,ExFac,StressMult,Stress_akut,Stress_kron,Puls,Points,VægtÆndring,Motion,HypoArea,CounterReg';

// debugLogTick() — kaldes fra updateUI() hvert frame. Logger kun hvis aktiveret
// og der er gået mindst DEBUG_LOG_INTERVAL sim-minutter siden sidst.
function debugLogTick() {
    if (!debugLogEnabled || !game) return;

    // Log kun hvert 5. sim-minut
    if (game.totalSimMinutes - debugLogLastTime < DEBUG_LOG_INTERVAL) return;
    debugLogLastTime = game.totalSimMinutes;

    const day = game.day || 1;
    const h = String(Math.floor(game.timeInMinutes / 60)).padStart(2, '0');
    const m = String(Math.floor(game.timeInMinutes % 60)).padStart(2, '0');
    // Tjek om der er aktiv motion (ikke afsluttet endnu)
    const activeEx = game.activeMotion.find(m => game.totalSimMinutes < (m.startTime + m.duration));
    const isExercising = activeEx ? activeEx.intensity : 'nej';

    const hov = game.hovorka;
    const stressMult = hov ? (1.0 + game.acuteStressLevel + game.chronicStressLevel + game.circadianKortisolNiveau) : 1.0;
    const subQ = hov ? (hov.state[2] + hov.state[3]) / 1000 : 0;
    const plasmaI = hov ? hov.state[6] : 0;
    const x1 = hov ? hov.state[7] : 0;
    const x2 = hov ? hov.state[8] : 0;
    const x3 = hov ? hov.state[9] : 0;
    const egp = hov ? Math.max(0, hov.EGP_0 * (stressMult - x3)) : 0;
    const E2 = hov ? hov.state[12] : 0;
    const exFac = hov ? 1 + hov.alpha * E2 * E2 : 1;

    const row = [
        day,
        `${h}:${m}`,
        game.totalSimMinutes.toFixed(0),
        game.trueBG.toFixed(2),
        game.cgmBG.toFixed(2),
        game.iob.toFixed(2),
        subQ.toFixed(2),
        plasmaI.toFixed(1),
        game.cob.toFixed(1),
        game.ketoneLevel.toFixed(2),
        x1.toFixed(4),
        x2.toFixed(4),
        x3.toFixed(4),
        egp.toFixed(3),
        exFac.toFixed(2),
        stressMult.toFixed(3),
        game.acuteStressLevel.toFixed(3),
        game.chronicStressLevel.toFixed(3),
        (hov ? hov.heartRate : 60).toFixed(0),
        game.normoPoints.toFixed(1),
        game.weightChangeKg.toFixed(2),
        isExercising,
        game.hypoArea.toFixed(1),
        game.counterRegFactor.toFixed(3)
    ].join(',');

    debugLogData.push(row);

    // Opdater tæller i UI
    const countEl = document.getElementById('debugLogCount');
    if (countEl) countEl.textContent = debugLogData.length + ' rækker';
}

// debugUpdateLiveValues() — opdaterer live debug-værdier i panelet
function debugUpdateLiveValues() {
    if (!game) return;
    const el = (id) => document.getElementById(id);
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

    set('dbgTrueBG', game.trueBG.toFixed(2));
    set('dbgCgmBG', game.cgmBG.toFixed(2));
    set('dbgIOB', game.iob.toFixed(2));
    // Basal IOB: resterende dosis (uden bioavailability-korrektion, så det matcher injiceret dosis)
    let basalIOB = 0;
    if (game.activeLongInsulin) {
        game.activeLongInsulin.forEach(ins => {
            const elapsed = game.totalSimMinutes - ins.injectionTime;
            if (elapsed < 0 || elapsed >= ins.totalDuration) return;
            basalIOB += ins.dose * (1 - elapsed / ins.totalDuration);
        });
    }
    set('dbgBasalIOB', basalIOB.toFixed(1));
    // Flow ind i plasma [mU/min] → konvertér til E/t for læsbarhed
    // Basal flow: direkte input-rate fra trapez-profilen
    set('dbgBasalRate', ((game.basalInsulinRate || 0) / 1000 * 60).toFixed(2));
    // Bolus flow: absorptionshastighed fra subkutant depot → plasma = S2/τ_I
    const bolusFlow = game.hovorka ? game.hovorka.state[3] / game.hovorka.tau_I : 0; // mU/min
    set('dbgBolusFlow', (bolusFlow / 1000 * 60).toFixed(2));
    // Subkutant depot: S1+S2 i Hovorka [mU] → konverter til enheder [E]
    const subQ = game.hovorka ? (game.hovorka.state[2] + game.hovorka.state[3]) / 1000 : 0;
    set('dbgSubQ', subQ.toFixed(2));
    // Plasma insulin: I i Hovorka [mU/L]
    const plasmaI = game.hovorka ? game.hovorka.state[6] : 0;
    set('dbgPlasmaI', plasmaI.toFixed(1));
    set('dbgCOB', game.cob.toFixed(1));
    set('dbgKetone', game.ketoneLevel.toFixed(2));

    // Hovorka insulin-aktionsvariable (de reelle drivere af BG-ændring)
    // x1: driver glukose-transport plasma→periferi (højere = hurtigere transport)
    // x2: driver glukose-disposal i periferi (højere = hurtigere forbrug)
    // x3: undertrykker leverens glukoseproduktion (højere = mere suppression)
    // Alle tre stiger med aktiv insulin og falder når insulin klares.
    const h = game.hovorka;
    if (h) {
        set('dbgX1', h.state[7].toFixed(4));
        set('dbgX2', h.state[8].toFixed(4));
        set('dbgX3', h.state[9].toFixed(4));

        // EGP: leverens aktuelle glukoseproduktion [mmol/min]
        // = EGP_0 × max(0, stressMultiplier - x3)
        const stressMult = 1.0 + game.acuteStressLevel + game.chronicStressLevel + game.circadianKortisolNiveau;
        const egp = Math.max(0, h.EGP_0 * (stressMult - h.state[9]));
        set('dbgEGP', egp.toFixed(3));

        // ExerciseFactor: multiplikator på insulinvirkning fra motion
        // 1.0 = ingen motion, >1 = insulin virker stærkere
        const E2 = h.state[12];
        const exFac = 1 + h.alpha * E2 * E2;
        set('dbgExFac', exFac.toFixed(2));

        // ISF (effektiv): profilISF × ExerciseFac — viser hvor meget 1E insulin
        // reelt sænker BG lige nu. ExerciseFac er den primære dynamiske modulator
        // fra Hovorka-modellen (motion forstærker insulinvirkning).
        const isfEff = game.ISF * exFac;
        set('dbgISFeff', isfEff.toFixed(1));

        set('dbgStressMult', stressMult.toFixed(3));
    }

    set('dbgAcute', game.acuteStressLevel.toFixed(3));
    set('dbgChronic', game.chronicStressLevel.toFixed(3));
    set('dbgHR', (h ? h.heartRate : 60).toFixed(0));

    // Dawn-effekt: cirkadisk kortisol-niveau (0.0 = ingen, ~0.3 = peak kl. 08:00)
    set('dbgDawn', game.circadianKortisolNiveau.toFixed(3));

    // Søvntab: akkumuleret mistet søvn denne nat (timer)
    set('dbgSleep', game.lostSleepHoursTonight.toFixed(1));

    set('dbgHypoArea', game.hypoArea.toFixed(1));
    set('dbgCounterReg', (game.counterRegFactor * 100).toFixed(0) + '%');
    set('dbgPoints', game.normoPoints.toFixed(1));
}

// debugDownloadLog() — genererer CSV-fil og trigger download i browseren
function debugDownloadLog() {
    if (debugLogData.length === 0) return;
    const csv = DEBUG_LOG_HEADER + '\n' + debugLogData.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Filnavn med dato/tid
    const now = new Date();
    const ts = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    a.download = `t1d-debug-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


// debugDownloadScreenshot() — tager screenshot af hele spilvinduet via html2canvas-fallback.
// Bruger canvas-elementets toDataURL() for grafen, og html2canvas for resten.
// Simpel implementation: screenshot af hele game-container via DOM→canvas.
function debugDownloadScreenshot() {
    const container = document.getElementById('game-container');
    if (!container) return;

    // Brug html2canvas hvis tilgængeligt, ellers fallback til ren graf-screenshot
    if (typeof html2canvas !== 'undefined') {
        html2canvas(container, { backgroundColor: '#0f1923' }).then(canvas => {
            triggerCanvasDownload(canvas);
        });
    } else {
        // Fallback: download kun graf-canvas
        if (!bgGraphCanvas) return;
        triggerCanvasDownload(bgGraphCanvas);
    }
}

// Hjælpefunktion: trigger download af et canvas-element som PNG
function triggerCanvasDownload(canvas) {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    a.download = `t1d-screenshot-${ts}.png`;
    a.click();
}


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
function flyIconToGraph(emoji, sourceId, insulinType) {
    const graph = document.getElementById('bg-graph');
    if (!graph) return;

    // Find startposition: dock-ikonet for den pågældende type (ikke panelet)
    const dockMap = {
        'dock-panel-insulin': '.dock-item.d-insulin',
        'dock-panel-food': '.dock-item.d-food',
        'dock-panel-custom-food': '.dock-item.d-food',   // Custom food bruger samme dock-ikon som mad
        'dock-panel-motion': '.dock-item.d-exercise',
        'dock-panel-kit': '.dock-item.d-kit'
    };
    const dockSelector = dockMap[sourceId];
    const dockItem = dockSelector ? document.querySelector(dockSelector) : document.getElementById(sourceId);
    if (!dockItem) return;

    const startRect = dockItem.getBoundingClientRect();
    const graphRect = graph.getBoundingClientRect();

    // Opret ikon-element med korrekt hue-rotate for insulin
    const icon = document.createElement('span');
    icon.className = 'flying-icon';
    icon.textContent = emoji;

    // Hue-rotate for insulin-sprøjter: blå for basal, teal for hurtig, rød for glukagon
    if (insulinType === 'basal') icon.classList.add('insulin-icon-blue');
    else if (insulinType === 'fast') icon.classList.add('insulin-icon-teal');
    else if (insulinType === 'glucagon') icon.classList.add('insulin-icon-red');

    // Startposition: midten af dock-ikonet
    const startX = startRect.left + startRect.width / 2 - 14;
    const startY = startRect.top + startRect.height / 2 - 14;
    icon.style.left = startX + 'px';
    icon.style.top = startY + 'px';
    document.body.appendChild(icon);

    // Luk panelet med det samme
    closeDockPanels();

    // Beregn tidsmæssig x-position på grafen
    const padding = { left: 58, right: 20 };
    const graphWidth = graphRect.width - padding.left - padding.right;
    let xFraction = 0.8;
    if (game) {
        const timeInDay = game.timeInMinutes % 1440;
        xFraction = timeInDay / 1440;
    }
    const targetX = graphRect.left + padding.left + xFraction * graphWidth;
    // Grafens tegneområde har padding.bottom=40 — placer ikonet lige over x-aksen
    const targetY = graphRect.top + graphRect.height - 80;

    // Animér langs en quadratic Bezier-kurve fra dock → kontrolpunkt (opad) → graf.
    // Bezier giver en naturlig, jævn bue uden clamp-problemer.
    // P0 = start (dock), P1 = kontrolpunkt (ovenover midtpunktet), P2 = target (graf).
    const duration = 1000; // ms
    const startTime = performance.now();
    // Kontrolpunktet: midt i X, og opad (den højeste del af buen)
    const cpX = (startX + targetX) / 2;
    const cpY = Math.min(startY, targetY) - 120; // 120px over det højeste punkt

    function animate(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Ease-out cubic for blød deceleration
        const ease = 1 - Math.pow(1 - t, 3);
        // Quadratic Bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
        const inv = 1 - ease;
        const currentX = inv * inv * startX + 2 * inv * ease * cpX + ease * ease * targetX;
        const currentY = inv * inv * startY + 2 * inv * ease * cpY + ease * ease * targetY;

        icon.style.left = currentX + 'px';
        icon.style.top = currentY + 'px';
        // Fade og krymp i den sidste 25%
        if (t > 0.75) {
            const fadeProg = (t - 0.75) / 0.25;
            icon.style.opacity = (1 - fadeProg).toString();
            icon.style.transform = `scale(${1 - fadeProg * 0.4})`;
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            icon.remove();
        }
    }
    requestAnimationFrame(animate);
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
        // Visuel feedback: flash kit-ikonet + flyv ✚ ikon til grafen
        const kitItem = document.querySelector('.dock-item.d-kit');
        if (kitItem) {
            kitItem.classList.add('sos-activated');
            setTimeout(() => kitItem.classList.remove('sos-activated'), 600);
        }
        // Flyv ✚ ikon fra kit-ikonet til grafens aktuelle tidsposition
        flyIconToGraph('\u{1F489}', 'dock-panel-kit', 'glucagon');
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

    // Luk ALLE åbne dock-paneler først
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
        playSound('menuOpen');
    } else {
        // Panelet blev lukket
        playSound('menuClose');
    }
}

/**
 * closeDockPanels — Luk alle åbne dock-paneler.
 * Kaldes når brugeren klikker udenfor et panel.
 */
function closeDockPanels() {
    // Tjek om der faktisk er åbne paneler (spil kun lyd hvis noget lukkes)
    const hadOpen = document.querySelector('.dock-panel.visible');
    document.querySelectorAll('.dock-panel.visible').forEach(p => {
        p.classList.remove('visible');
    });
    document.querySelectorAll('.dock-item.active').forEach(d => {
        d.classList.remove('active');
    });
    if (hadOpen) playSound('menuClose');
}

/**
 * toggleDebugSidebar — Åbn/luk debug-sidebar (uafhængig af dock-paneler).
 * Debug-sidebaren er et flow-element i main-area, ikke et dock-panel.
 */
function toggleDebugSidebar() {
    const sidebar = document.getElementById('debug-sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('visible');
    // Resize canvas da debug-sidebar ændrer tilgængelig bredde for grafen
    setTimeout(sizeCanvas, 350);
}


// =============================================================================
// initializeApp — Engangs-setup når siden indlæses
// =============================================================================
function initializeApp() {
    // --- Tildel alle DOM element-referencer ---
    startButton = document.getElementById('startButton');
    helpButton = document.getElementById('helpButton');
    pauseButton = document.getElementById('pauseButton');
    profileButton = document.getElementById('profileButton');
    speedSelector = document.getElementById('speedStepper');
    // Stepper: .value property bruges af simulator.js til at læse hastigheden
    speedSelector.value = '240'; // Default-værdi (4t/min)
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
    // glucagonButton fjernet — glukagon er nu i kit-panelet (kitGlucagonButton)
    debugTrueBgCheckbox = document.getElementById('debugTrueBgCheckbox');
    iobDisplay = document.getElementById('iobDisplay');
    cobDisplay = document.getElementById('cobDisplay');
    bgGraphCanvas = document.getElementById('bg-graph');
    graphCtx = bgGraphCanvas.getContext('2d');
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

    // --- Global fokus-fjernelse efter enhver UI-interaktion ---
    // Knapper, selects og slidere beholder fokus efter klik/ændring,
    // hvilket blokerer keyboard shortcuts (tag === 'INPUT'/'SELECT'/'BUTTON').
    // Løsning: fjern fokus fra ALLE interaktive elementer efter brug.
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, select, input[type="range"]');
        if (el) setTimeout(() => el.blur(), 50);
    });
    document.addEventListener('change', (e) => {
        if (e.target.matches('select, input[type="range"]')) {
            setTimeout(() => e.target.blur(), 50);
        }
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
    // pauseButton listener er nu i speed-stepper opsætningen nedenfor

    // Profil-knap: åbner profil-popup til redigering af vægt/ICR/ISF
    profileButton.addEventListener('click', () => {
        showProfilePopup();
    });

    // --- Mute button: toggler lyd (#12: ikon viser nuværende status) ---
    muteButton.addEventListener('click', () => {
        isMuted = !isMuted;
        // Vis nuværende status: 🔊 = lyd tændt, 🔇 = lyd slukket
        const muteIcon = document.getElementById('muteIcon');
        if (muteIcon) muteIcon.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';
        if (sounds && Tone.Destination) Tone.Destination.mute = isMuted;
    });

    // --- Hastigheds-stepper (◀ 4t/min ▶) med integreret pause ---
    const speeds = [60, 240, 720, 1440];
    const speedLabels = { 60: '1t/min', 240: '4t/min', 720: '12t/min', 1440: '24t/min' };
    const speedLabel = document.getElementById('speedLabel');
    const speedStateIcon = document.getElementById('speedStateIcon');
    const speedDownBtn = document.getElementById('speedDown');
    const speedUpBtn = document.getElementById('speedUp');

    // Hjælpefunktion: opdater stepper UI
    // Ikonet viser mode: ⏸ ved pause, ▶/▶▶/▶▶▶/▶▶▶▶ ved kørsel (pulserende)
    // Puls-hastigheden matcher simulationshastigheden
    const speedArrows = { 60: '\u25B6', 240: '\u25B6\u25B6', 720: '\u25B6\u25B6\u25B6', 1440: '\u25B6\u25B6\u25B6\u25B6' };
    // Puls-varighed per hastighed — hurtigere sim = hurtigere puls
    const speedPulse = { 60: '3', 240: '1.5', 720: '0.6', 1440: '0.3' };
    function updateSpeedStepperUI() {
        const val = speedSelector.value;
        const idx = speeds.indexOf(parseInt(val));
        // Label viser "Pause" ved pause, ellers hastighed (fx "4t/min")
        speedLabel.textContent = isPaused ? 'Pause' : (speedLabels[val] || '4t/min');
        // Deaktiver ▶ ved højeste hastighed
        speedUpBtn.disabled = (idx >= speeds.length - 1);
        speedDownBtn.disabled = false;
        // Ikon + puls: ⏸ statisk ved pause, pile ved kørsel
        if (isPaused) {
            speedStateIcon.innerHTML = '\u23F8';  // ⏸ statisk pause-ikon
            speedSelector.classList.remove('playing');
            speedSelector.classList.add('paused');
            speedStateIcon.classList.remove('pulsing');
            speedStateIcon.style.animationDuration = '';
        } else {
            speedStateIcon.innerHTML = speedArrows[val] || '\u25B6\u25B6';
            speedSelector.classList.remove('paused');
            speedSelector.classList.add('playing');
            // Alle hastigheder pulserer — langsommere ved lav speed, hurtigere ved høj
            speedStateIcon.classList.add('pulsing');
            speedStateIcon.style.animationDuration = (speedPulse[val] || '1.5') + 's';
        }
    }

    // Skift hastighed op/ned — helt tv. pauser simulationen
    function changeSpeed(delta) {
        if (!game || game.isGameOver) return;
        const idx = speeds.indexOf(parseInt(speedSelector.value));
        const newIdx = idx + delta;
        // ◀ ved laveste hastighed → pause
        if (delta < 0 && idx <= 0) {
            if (!isPaused) togglePause();
            return;
        }
        // ▶ mens pauset → resume (på nuværende hastighed)
        if (delta > 0 && isPaused) {
            togglePause();
            return;
        }
        if (newIdx < 0 || newIdx >= speeds.length) return;
        speedSelector.value = String(speeds[newIdx]);
        if (game) game.simulationSpeed = speeds[newIdx];
        updateSpeedStepperUI();
    }

    speedDownBtn.addEventListener('click', () => changeSpeed(-1));
    speedUpBtn.addEventListener('click', () => changeSpeed(1));
    // Midterste knap = pause/resume
    pauseButton.addEventListener('click', togglePause);
    // Gør funktionerne tilgængelige globalt (bruges fra game.js)
    window.updateSpeedStepperUI = updateSpeedStepperUI;
    window.changeSpeed = changeSpeed;
    updateSpeedStepperUI();

    // --- Food buttons: preset meals + "Lav selv" popup ---
    // Alle mad-knapper luk panelet og flyver et ikon ned til grafen.
    // Preset meals med faste makronæringsprofiler (kulhydrat, protein, fedt)
    dextroButton.addEventListener('click', () => { if(game) { game.addFood(3, 0, 0, '\u25FB\uFE0F'); flyIconToGraph('\u25FB\uFE0F', 'dock-panel-food'); } });
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
        if(game) { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset2').addEventListener('click', () => {
        if(game) { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset4').addEventListener('click', () => {
        if(game) { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    // Hurtig insulin custom slider
    giveFastInsulinButton.addEventListener('click', () => {
        if(game) { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    // Basal insulin presets (1/3, 2/3, 1x anbefalet)
    document.getElementById('basalPreset1').addEventListener('click', () => {
        if(game) { const dose = Math.round(game.basalDose / 3); game.addLongInsulin(dose); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset2').addEventListener('click', () => {
        if(game) { const dose = Math.round(game.basalDose * 2 / 3); game.addLongInsulin(dose); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset3').addEventListener('click', () => {
        if(game) { game.addLongInsulin(game.basalDose); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    // Basal insulin custom slider
    giveLongInsulinButton.addEventListener('click', () => {
        if(game) { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
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

    // --- Diabetes-kit: druesukker, målinger og glukagon ---
    fingerprickButton.addEventListener('click', () => { if(game) { game.performFingerprick(); flyIconToGraph('\u{1FA78}', 'dock-panel-kit'); } });
    ketoneTestButton.addEventListener('click', () => { if(game) { game.performKetoneTest(); flyIconToGraph('\u{1F9EA}', 'dock-panel-kit'); } });

    // Druesukker i kit-panelet
    const kitDextroButton = document.getElementById('kitDextroButton');
    if (kitDextroButton) {
        kitDextroButton.addEventListener('click', () => {
            if(game) { game.addFood(3, 0, 0, '\u25FB\uFE0F'); flyIconToGraph('\u25FB\uFE0F', 'dock-panel-kit'); }
        });
    }

    // Glukagon i kit-panelet
    const kitGlucagonButton = document.getElementById('kitGlucagonButton');
    if (kitGlucagonButton) {
        kitGlucagonButton.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerGlucagonSOS();
        });
    }

    // --- Debug checkboxes ---
    debugTrueBgCheckbox.addEventListener('change', () => { if(game) drawGraph(); });

    // Debug log checkbox: aktiver/deaktiver CSV-logning
    const debugLogCheckbox = document.getElementById('debugLogCheckbox');
    const debugLogControls = document.getElementById('debugLogControls');
    debugLogCheckbox.addEventListener('change', () => {
        debugLogEnabled = debugLogCheckbox.checked;
        debugLogControls.style.display = debugLogEnabled ? 'flex' : 'none';
        const statusEl = document.getElementById('debugLogStatus');
        if (statusEl) statusEl.textContent = debugLogEnabled ? 'Logger...' : 'Klar';
    });

    // Debug log download, screenshot og ryd knapper
    document.getElementById('debugLogDownload').addEventListener('click', debugDownloadLog);
    document.getElementById('debugScreenshot').addEventListener('click', debugDownloadScreenshot);
    document.getElementById('debugLogClear').addEventListener('click', () => {
        debugLogData = [];
        debugLogLastTime = -Infinity;
        const countEl = document.getElementById('debugLogCount');
        if (countEl) countEl.textContent = '0 rækker';
    });

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
    // SETTINGS TOOLS — Debug, fysiologi, hjælp, lyd (i bottom-bar th)
    // =========================================================================
    document.querySelectorAll('.settings-item[data-panel]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDockPanel(btn.dataset.panel);
        });
    });

    // Debug-sidebar toggle (separat fra dock-paneler)
    const debugToggleBtn = document.getElementById('debugToggleButton');
    if (debugToggleBtn) {
        debugToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDebugSidebar();
        });
    }

    // =========================================================================
    // KEYBOARD SHORTCUTS — RTS-stil chord-system
    // =========================================================================
    // Første tast åbner panel (Z=insulin, X=mad, C=motion, V=målinger).
    // Anden tast udfører handling — virker BÅDE som chord (hurtigt ZZ)
    // OG som enkelt-tryk når panelet allerede er åbent.
    //
    // Insulin (Z): Z/X/C = 1/2/4E hurtig, A/S/D = basal presets, V/F = custom
    // Mad (X):     Koordinatsystem — nederste rk: Z=Dextro(hypo!) X=Sodavand C=Æble V=Havregryn B=Burger
    //              Øverste rk: A=Lagkage S=Salat D=Avocado F=Kylling G=Lav selv
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
            if (key === 'z') { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
            if (key === 'x') { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
            if (key === 'c') { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
            if (key === 'v') { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
            if (key === 'a') { game.addLongInsulin(Math.round(game.basalDose / 3)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
            if (key === 's') { game.addLongInsulin(Math.round(game.basalDose * 2 / 3)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
            if (key === 'd') { game.addLongInsulin(game.basalDose); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
            if (key === 'f') { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
        }

        // --- Mad panel åbent ---
        // Tastatur-layout som koordinatsystem (korresponderer til ikonernes grid-position):
        //   Øverste række: A=Lagkage  S=Salat  D=Avocado  F=Kylling  G=Lav selv
        //   Nederste række: Z=Dextro(hypo!)  X=Sodavand  C=Æble  V=Havregryn  B=Burger
        if (isPanelOpen('dock-panel-food')) {
            // Nederste række — Z=Dextro (hurtig hypo-korrektion), X=Sodavand, C=Æble, V=Havregryn, B=Burger
            if (key === 'z') { game.addFood(3, 0, 0, '\u25FB\uFE0F'); flyIconToGraph('\u25FB\uFE0F', 'dock-panel-food'); return true; }
            if (key === 'x') { game.addFood(35, 0, 0, '\u{1F964}'); flyIconToGraph('\u{1F964}', 'dock-panel-food'); return true; }
            if (key === 'c') { game.addFood(20, 0, 0, '\u{1F34E}'); flyIconToGraph('\u{1F34E}', 'dock-panel-food'); return true; }
            if (key === 'v') { game.addFood(30, 8, 2, '\u{1F963}'); flyIconToGraph('\u{1F963}', 'dock-panel-food'); return true; }
            if (key === 'b') { game.addFood(40, 30, 30, '\u{1F354}'); flyIconToGraph('\u{1F354}', 'dock-panel-food'); return true; }
            // Øverste række — A=Lagkage, S=Salat, D=Avocado, F=Kylling, G=Lav selv
            if (key === 'a') { game.addFood(60, 5, 25, '\u{1F370}'); flyIconToGraph('\u{1F370}', 'dock-panel-food'); return true; }
            if (key === 's') { game.addFood(5, 2, 1, '\u{1F957}'); flyIconToGraph('\u{1F957}', 'dock-panel-food'); return true; }
            if (key === 'd') { game.addFood(5, 5, 25, '\u{1F951}'); flyIconToGraph('\u{1F951}', 'dock-panel-food'); return true; }
            if (key === 'f') { game.addFood(2, 30, 15, '\u{1F357}'); flyIconToGraph('\u{1F357}', 'dock-panel-food'); return true; }
            if (key === 'g') { showCustomFoodPanel(); return true; }
        }

        // --- Diabetes-kit panel åbent ---
        // Z=Druesukker, X=Fingerprik, C=Keton-stik, V=Glukagon
        if (isPanelOpen('dock-panel-kit')) {
            if (key === 'z') { game.addFood(3, 0, 0, '\u25FB\uFE0F'); flyIconToGraph('\u25FB\uFE0F', 'dock-panel-kit'); return true; }
            if (key === 'x') { game.performFingerprick(); flyIconToGraph('\u{1FA78}', 'dock-panel-kit'); return true; }
            if (key === 'c') { game.performKetoneTest(); flyIconToGraph('\u{1F9EA}', 'dock-panel-kit'); return true; }
            if (key === 'v') { triggerGlucagonSOS(); return true; }
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

        // Piltaster: ← langsommere, → hurtigere (cyklér gennem hastighedsvalg)
        if (key === 'arrowright' || key === 'arrowleft') {
            e.preventDefault();
            changeSpeed(key === 'arrowright' ? 1 : -1);
            return;
        }

        // Taltaster 1-9: direkte genvej til hurtig insulin med den pågældende dosis
        // ½ (dansk tastatur) giver 0.5 E
        if (game && (key >= '1' && key <= '9' || key === '½')) {
            e.preventDefault();
            const dose = key === '½' ? 0.5 : parseInt(key);
            game.addFastInsulin(dose);
            flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast');
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
        // Inkluderer B (æble i mad-panel) og G (lav selv i mad-panel)
        if (['z', 'x', 'c', 'v', 'a', 's', 'd', 'f', 'b', 'g'].includes(key)) {
            // Prøv sub-handling først (hvis relevant panel er åbent)
            if (executeSubAction(key)) {
                e.preventDefault();
                return;
            }
        }

        // --- Første tast: åbn panel + start chord-timer ---
        if (['z', 'x', 'c', 'v'].includes(key)) {
            e.preventDefault();
            const panelMap = { z: 'dock-panel-insulin', x: 'dock-panel-food', c: 'dock-panel-motion', v: 'dock-panel-kit' };
            toggleDockPanel(panelMap[key]);

            // Start chord-timer for hurtig sekvens
            chordFirstKey = key;
            chordTimeout = setTimeout(() => { chordFirstKey = null; }, CHORD_TIMEOUT_MS);
        }
    });

    // --- DEV DEFAULTS: Slå debug-features til automatisk under udvikling ---
    // Fjern denne blok når spillet er klar til release.
    const debugSidebar = document.getElementById('debug-sidebar');
    if (debugSidebar) debugSidebar.classList.add('visible');

    // Vis sand BG-linje (blå) som standard
    if (debugTrueBgCheckbox) debugTrueBgCheckbox.checked = true;

    // Aktiver CSV-logning som standard
    const debugLogCheckboxEl = document.getElementById('debugLogCheckbox');
    if (debugLogCheckboxEl) {
        debugLogCheckboxEl.checked = true;
        debugLogEnabled = true;
        const ctrl = document.getElementById('debugLogControls');
        if (ctrl) ctrl.style.display = 'flex';
        const statusEl = document.getElementById('debugLogStatus');
        if (statusEl) statusEl.textContent = 'Logger...';
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
