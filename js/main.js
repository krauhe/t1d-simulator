// =============================================================================
// MAIN.JS — Application entry point: globals, DOM references, event listeners
// =============================================================================
//
// This file is the last in the script chain (loaded after sounds.js, hovorka.js,
// simulator.js, ui.js and game.js). It serves as the application entry point:
//
//   1. Declares all global variables and constants
//   2. Captures DOM element references on page load
//   3. Sets up event listeners (button clicks, slider changes, dock panels, etc.)
//
// All files share the global scope (no module system).
// Variables declared here are accessible from all other files.
//
// Script loading order: sounds.js → hovorka.js → simulator.js → ui.js → game.js → main.js
//
// Dependencies: All other JS files must be loaded before this one.
// Exports (global): All variables below, initializeApp()
// =============================================================================


// =============================================================================
// GLOBAL DOM ELEMENT REFERENCES
// =============================================================================
// Held as `let` (uninitialised) and assigned in initializeApp() after the DOM is ready.
// Other files (simulator.js, ui.js) access these directly by variable name.
// =============================================================================
let startButton, helpButton, highscoreButton, pauseButton, speedSelector, dayDisplay,
    timeDisplay, cgmValueDisplayGraph, normoPointsDisplay, normoPointsWeighting,
    soundButton, carbsSlider, carbsValue, proteinSlider, proteinValue, fatSlider,
    fatValue, foodKcalDisplay,
    fastInsulinSlider, fastInsulinValue,
    giveFastInsulinButton, longInsulinSlider, longInsulinValue, giveLongInsulinButton,
    motionIntensitySelect, startMotionButton, motionKcalDisplay,
    fingerprickButton, ketoneTestButton, debugTrueBgCheckbox,
    iobDisplay, cobDisplay, bgGraphCanvas, graphCtx,
    weightChangeValue, steepDropWarningDiv,
    // Stats fragment in the capsule bar (replaces the removed stats side-drawer)
    statsTirValue, statsAvgBgValue, statsWeightValue;

// Physiology mode: when activated mid-game the score is not saved.
// The flag is reset by startGame() and set permanently when activated during a game.
let trainingModeUsedThisSession = false;
let trainingModeStartedThisSession = false;

// =============================================================================
// DEBUG LOG SYSTEM — Collects internal simulation data in a CSV buffer.
// Used for debugging: download the file and share it with the developer.
// Logged every 5 simulation minutes to keep file size manageable.
// =============================================================================
let debugLogEnabled = false;         // Activated via checkbox in the debug panel
let debugLogData = [];               // Array of CSV rows (strings)
let debugLogLastTime = -Infinity;    // Last logged sim time (avoid duplicates)
const DEBUG_LOG_INTERVAL = 5;        // Log every 5 sim minutes

// CSV header with all relevant internal parameters + event column
const DEBUG_LOG_HEADER = 'Dag,Tid,SimMin,TrueBG,CgmBG,IOB,SubQ,PlasmaI,COB,FedtTarm,TauG,AminoAcid,ProtGluc,Ketoner,AcidoseLoad,x1,x2,x3,EGP,ExFac,StressMult,Stress_akut,Stress_kron,Puls,Points,VægtÆndring,Motion,HypoArea,CounterReg,Event';

// debugLogTick() — called from updateUI() every frame. Only logs if enabled
// and at least DEBUG_LOG_INTERVAL sim minutes have passed since last log.
function debugLogTick() {
    if (!debugLogEnabled || !game) return;

    // Log only every 5 sim minutes
    if (game.totalSimMinutes - debugLogLastTime < DEBUG_LOG_INTERVAL) return;
    debugLogLastTime = game.totalSimMinutes;

    const day = game.day || 1;
    const h = String(Math.floor(game.timeInMinutes / 60)).padStart(2, '0');
    const m = String(Math.floor(game.timeInMinutes % 60)).padStart(2, '0');
    // Check whether there is an active activity
    const isExercising = game.activeAktivitet
        ? `${game.activeAktivitet.typeDef.navn}:${game.activeAktivitet.intensitet}`
        : 'nej';

    const hov = game.hovorka;
    // StressMult with glycogen-aware calculation + protein-glucagon
    const _glyRes = game.glycogenReserve ?? 1.0;
    const _protGluc = game.proteinGlucagonLevel * (0.5 + 0.5 * _glyRes);
    const _gngComp = (1 - _glyRes) * 0.25;
    const _catecholamineDrive =
        (game.acuteStressLevel + (game.exerciseHepaticDrive || 0)) *
        (0.6 * _glyRes + 0.4);
    const stressMult = hov ? (0.5 * _glyRes + 0.5 + _gngComp +
        _catecholamineDrive + game.chronicStressLevel +
        game.circadianKortisolNiveau + _protGluc) : 1.0;
    const subQ = hov ? (hov.state[HOVORKA_STATE_IDX.S1] + hov.state[HOVORKA_STATE_IDX.S2]) / 1000 : 0;
    const plasmaI = hov ? hov.state[HOVORKA_STATE_IDX.I] : 0;
    const x1 = hov ? hov.state[HOVORKA_STATE_IDX.x1] : 0;
    const x2 = hov ? hov.state[HOVORKA_STATE_IDX.x2] : 0;
    const x3 = hov ? hov.state[HOVORKA_STATE_IDX.x3] : 0;
    const egp = hov ? Math.max(0, hov.EGP_0 * (stressMult - x3)) : 0;
    const exFac = game._lastPeisFactor || 1;

    // Collect events that have occurred since the last log tick (food, insulin, exercise start)
    const eventsSinceLastLog = game.logHistory
        ? game.logHistory.filter(ev => ev.time > debugLogLastTime - DEBUG_LOG_INTERVAL && ev.time <= game.totalSimMinutes)
        : [];
    const eventStrs = eventsSinceLastLog.map(ev => {
        if (ev.type === 'food') return `FOOD:${ev.details.carbs}gC/${ev.details.protein || 0}gP/${ev.details.fat || 0}gF`;
        if (ev.type === 'insulin-fast') return `BOLUS:${ev.details.dose}E`;
        if (ev.type === 'insulin-basal') return `BASAL:${ev.details.dose}E`;
        if (ev.type === 'motion') return `MOTION:${ev.details.type || ''}/${ev.details.intensity || ''}`;
        return '';
    }).filter(s => s);
    const eventCol = eventStrs.length > 0 ? '"' + eventStrs.join('; ') + '"' : '';

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
        game.fatIntestine.toFixed(1),
        (hov ? hov.tau_G.toFixed(0) : '40'),
        game.aminoAcidsBlood.toFixed(1),
        game.proteinGlucagonLevel.toFixed(3),
        game.ketoneLevel.toFixed(2),
        game.acidosisLoad.toFixed(1),
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
        game.counterRegFactor.toFixed(3),
        eventCol
    ].join(',');

    debugLogData.push(row);

    // Update row counter in the UI
    const countEl = document.getElementById('debugLogCount');
    if (countEl) countEl.textContent = debugLogData.length + ' rækker';
}

// debugUpdateLiveValues() — updates live debug values in the panel
function debugUpdateLiveValues() {
    if (!game) return;
    const el = (id) => document.getElementById(id);
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

    set('dbgTrueBG', game.trueBG.toFixed(2));
    set('dbgCgmBG', game.cgmBG.toFixed(2));
    set('dbgIOB', game.iob.toFixed(2));
    // Basal IOB: remaining dose (without bioavailability correction, so it matches injected dose)
    let basalIOB = 0;
    if (game.activeLongInsulin) {
        game.activeLongInsulin.forEach(ins => {
            const elapsed = game.totalSimMinutes - ins.injectionTime;
            if (elapsed < 0 || elapsed >= ins.totalDuration) return;
            basalIOB += ins.dose * (1 - elapsed / ins.totalDuration);
        });
    }
    set('dbgBasalIOB', basalIOB.toFixed(2));
    // Flow into plasma [mU/min] → convert to U/h for readability
    // Basal flow: direct input rate from the trapezoid profile
    set('dbgBasalRate', ((game.basalInsulinRate || 0) / 1000 * 60).toFixed(2));
    // Bolus flow: absorption rate from subcutaneous depot → plasma = S2/τ_I
    const bolusFlow = game.hovorka ? game.hovorka.state[HOVORKA_STATE_IDX.S2] / game.hovorka.tau_I : 0; // mU/min
    set('dbgBolusFlow', (bolusFlow / 1000 * 60).toFixed(2));
    // Subcutaneous depot: S1+S2 in Hovorka [mU] → convert to units [U]
    const subQ = game.hovorka ? (game.hovorka.state[HOVORKA_STATE_IDX.S1] + game.hovorka.state[HOVORKA_STATE_IDX.S2]) / 1000 : 0;
    set('dbgSubQ', subQ.toFixed(2));
    // Plasma insulin: I in Hovorka [mU/L]
    const plasmaI = game.hovorka ? game.hovorka.state[HOVORKA_STATE_IDX.I] : 0;
    set('dbgPlasmaI', plasmaI.toFixed(1));
    set('dbgCOB', game.cob.toFixed(1));
    set('dbgFatInt', game.fatIntestine.toFixed(1));
    set('dbgTauG', game.hovorka ? game.hovorka.tau_G.toFixed(0) : '40');
    set('dbgAA', game.aminoAcidsBlood.toFixed(1));
    set('dbgProtGluc', game.proteinGlucagonLevel.toFixed(3));
    set('dbgKetone', game.ketoneLevel.toFixed(2));
    set('dbgFfaLipo', game.ffaLipolysis.toFixed(3));
    set('dbgLipoRate', (game._lastLipolyseRate ?? 0).toFixed(4));
    set('dbgCpt1', (game._lastCpt1Activity ?? 0).toFixed(3));
    set('dbgAcidosis', game.acidosisLoad.toFixed(1) + '/' + game.ACIDOSIS_THRESHOLD);

    // Hovorka insulin action variables (the actual drivers of BG change)
    // x1: drives glucose transport plasma→periphery (higher = faster transport)
    // x2: drives glucose disposal in periphery (higher = faster utilisation)
    // x3: suppresses hepatic glucose production (higher = more suppression)
    // All three rise with active insulin and decay as insulin is cleared.
    const h = game.hovorka;
    if (h) {
        set('dbgX1', h.state[HOVORKA_STATE_IDX.x1].toFixed(4));
        set('dbgX2', h.state[HOVORKA_STATE_IDX.x2].toFixed(4));
        set('dbgX3', h.state[HOVORKA_STATE_IDX.x3].toFixed(4));

        // EGP: current hepatic glucose production [mmol/min]
        // Glycogen-aware stressMult: baseline = 50% glycogenolysis (requires glycogen) + 50% gluconeogenesis (always active)
        // Acute stress is also scaled by glycogenReserve (glycogenolysis-driven)
        const glyRes = game.glycogenReserve ?? 1.0;
        const glycogenBaseline = 0.5 * glyRes;
        const gngBaseline = 0.5 + (1 - glyRes) * 0.25;
        const effectiveCatecholamineDrive =
            (game.acuteStressLevel + (game.exerciseHepaticDrive || 0)) *
            (0.6 * glyRes + 0.4);
        const effectiveProtGluc = game.proteinGlucagonLevel * (0.5 + 0.5 * glyRes);
        const stressMult = glycogenBaseline + gngBaseline + effectiveCatecholamineDrive +
            game.chronicStressLevel + game.circadianKortisolNiveau + effectiveProtGluc;
        const egp = Math.max(0, h.EGP_0 * (stressMult - h.state[HOVORKA_STATE_IDX.x3]));
        set('dbgEGP', egp.toFixed(3));

        // Liver glycogen: grams in pool (0–120 g) and reserve scaling (0–100%)
        set('dbgGlycogen', (game.liverGlycogenGrams ?? 90).toFixed(1));
        set('dbgGlyReserve', ((glyRes * 100).toFixed(0)) + '%');

        // Muscle glycogen: grams / capacity (weight-scaled) + resynthesis rate
        // Displayed as "312 / 385 g (81%)" so both absolute and relative levels are visible.
        const mGly = game.muscleGlycogenGrams ?? 0;
        const mCap = game.muscleGlycogenCapacity ?? 1;
        const mPct = (mGly / mCap) * 100;
        set('dbgMuscleGly', `${mGly.toFixed(0)} / ${mCap.toFixed(0)} (${mPct.toFixed(0)}%)`);
        // Resynthesis rate: positive = pool filling, negative = pool depleting (during exercise)
        const resynthRate = game._muscleGlycogenResynthRate ?? 0;
        const consRate = game._muscleGlycogenConsumptionRate ?? 0;
        const netRate = resynthRate - consRate;
        set('dbgMuscleGlyRate', (netRate >= 0 ? '+' : '') + netRate.toFixed(2));

        // Motionsbetinget insulinmedieret følsomhed. E2 er kun telemetri;
        // PEIS-faktoren anvendes én gang som et EC50-skift i muskelkanalen.
        const peisFactor = game._lastPeisFactor || 1;
        set('dbgExFac', peisFactor.toFixed(2));

        // ISF (effective): the combined effective ISF with ALL modifiers applied
        // = profileISF × circadianISF × insulinResistanceFactor × vasodilation / exerciseBoost
        set('dbgISFeff', game.currentISF.toFixed(1));

        set('dbgStressMult', stressMult.toFixed(3));
    }

    set('dbgAcute', game.acuteStressLevel.toFixed(3));
    set('dbgChronic', game.chronicStressLevel.toFixed(3));
    set('dbgHR', (h ? h.heartRate : 60).toFixed(0));

    // Dawn (HGP): circadian cortisol level (0.0 = none, ~0.3 = peak at 08:00)
    set('dbgDawn', game.circadianKortisolNiveau.toFixed(3));
    // Dawn (ISF): circadian ISF factor (0.70 morning, 1.20 evening)
    set('dbgCircadianISF', game.circadianISF.toFixed(2));
    // Insulin resistance factor: 1.0 + chronicStress × 0.5
    set('dbgInsResistance', game.insulinResistanceFactor.toFixed(2));

    // Sleep loss: accumulated lost sleep tonight (hours)
    set('dbgSleep', game.lostSleepHoursTonight.toFixed(1));

    set('dbgHypoArea', game.hypoArea.toFixed(1));
    set('dbgCounterReg', (game.counterRegFactor * 100).toFixed(0) + '%');
    set('dbgPoints', game.normoPoints.toFixed(1));
}

// debugDownloadLog() — generates a CSV file and triggers a browser download
function debugDownloadLog() {
    if (debugLogData.length === 0) return;
    const csv = DEBUG_LOG_HEADER + '\n' + debugLogData.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Filename with date/time
    const now = new Date();
    const ts = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    a.download = `t1d-debug-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


// debugDownloadScreenshot() — real screen capture via the Screen Capture API.
// Prompts the user to select a tab/screen, captures one frame and downloads it as PNG.
// Fallback: if the API is unavailable, the graph canvas alone is used.
async function debugDownloadScreenshot() {
    try {
        // Ask the browser for screen capture access (user selects tab/screen)
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },  // suggest current tab
            preferCurrentTab: true                   // Chrome 94+: auto-select current tab
        });

        // Wait one frame for the image to stabilise
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        // Draw the frame onto an offscreen canvas
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        // Wait one more frame to ensure the video is ready
        await new Promise(r => requestAnimationFrame(r));

        const canvas = document.createElement('canvas');
        canvas.width = settings.width || video.videoWidth;
        canvas.height = settings.height || video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Stop stream immediately (removes the "sharing screen" banner)
        track.stop();

        // Download the image
        triggerCanvasDownload(canvas);
    } catch (err) {
        // User dismissed the sharing dialog, or the API is unavailable
        console.warn('Screen capture afbrudt:', err.message);
        // Fallback: download graph canvas only
        if (bgGraphCanvas) triggerCanvasDownload(bgGraphCanvas);
    }
}

// Helper: trigger a download of a canvas element as PNG
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
// GLOBAL GAME STATE VARIABLES AND CONFIGURATION CONSTANTS
// =============================================================================

// game: the current Simulator instance (null when no game is running)
let game;

// currentGameMode: aktiv offentlig spiltilstand ('boxchallenge' eller 'campaign')
let currentGameMode = 'campaign';

// gameLoopIntervalId: handle from requestAnimationFrame used to stop the loop
let gameLoopIntervalId = null;

// lastFrameTime: timestamp of the previous frame (for deltaTime calculation)
let lastFrameTime = 0;

// isPaused: whether the simulation is paused
let isPaused = true;

// cgmDataPoints / trueBgPoints: arrays of {time, value} objects for the graph.
let cgmDataPoints = [];
let trueBgPoints = [];
// physiologyDataPoints: history of insulin and physiology data for graph display.
// Each element: { time, basalRate, bolusIOB, egp, carbAbsorption }
let physiologyDataPoints = [];

// Visual symptom effects (VFX) — on/off toggle
// Controls CSS filter effects (blur, desaturation) and vignette overlay
let vfxEnabled = true;

// MAX_GRAPH_POINTS_PER_DAY: max data points per day (288 = one point per 5 min)
const MAX_GRAPH_POINTS_PER_DAY = 288;

// Calorie constants
const KCAL_PER_KG_WEIGHT = 7700;  // kcal per kg body weight change


// =============================================================================
// CANVAS SIZING — Responsive layout and high-DPI support
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
// FLYING ICON — Animate an icon from the panel down to the graph
// =============================================================================
//
// When the user performs an action (give insulin, eat food, start exercise),
// an icon flies from the panel button down to the graph. This provides visual
// feedback even after the panel closes, so the user can see the action occurred.
//
// @param {string} emoji — Icon character to animate (e.g. '💉', '🍔')
// @param {string} panelId — ID of the dock panel the action came from
// =============================================================================
//
// addFoodFromKey — Look up a food item in the FOODS table and pass it to Simulator.addFood()
//
// Used by both preset-chip click handlers and keyboard shortcuts. Centralises
// the FOODS lookup in one place so no code duplicates macros/icon/weight/carbType.
// Also triggers the fly-icon animation to the graph on a successful intake.
//
// @param {string} foodKey — Key in the FOODS table (e.g. 'pizza', 'æg', 'cola')
// =============================================================================
// Reverse keyboard mapping: FOODS key → shortcut key (for tooltips)
const FOOD_SHORTCUT_MAP = {
    'æg': 'Q', 'nødder': 'W', 'salat': 'E', 'laksAvocado': 'R', 'ægBacon': 'T', 'bøfBearnaise': 'Y',
    'bollerIKarry': 'A', 'havregryn': 'S', 'burger': 'D', 'pasta': 'F', 'pizza': 'G', 'lagkage': 'H',
    'druesukker': 'Z', 'slik': 'X', 'juice': 'C', 'cola': 'V', 'banan': 'B', 'chokolade': 'N',
};


// =============================================================================
// getPortionScale — Returns portion scaling based on the character's fixed weight
// =============================================================================
// Children (< 45 kg) receive smaller portions. Each food item can override this
// via food.childScale; otherwise the global CHILD_PORTION_SCALE (0.55) is used.
function getPortionScale(foodKey) {
    const w = game?.weight ?? (() => {
        try { return loadFixedCharacterProfile().weight; }
        catch (e) { return 70; }
    })();
    if (w >= 45) return 1.0;
    const food = FOODS[foodKey];
    if (!food) return 1.0;
    return food.childScale !== undefined ? food.childScale : CHILD_PORTION_SCALE;
}


// =============================================================================
// initFoodChipUI — One-time DOM setup of food chips on page load
// =============================================================================
// 1. Removes visible keyboard shortcut indicators (.pc-key, .dock-key) from all
//    buttons — the shortcut is shown in the tooltip (mouse-over) instead.
// 2. Wraps each food chip's macro bar in a .pc-macro-wrapper and adds
//    .pc-macro-labels with gram values in macro colours below the bar.
// 3. Adds keyboard shortcut info to food chip tooltips.
// 4. Converts the first row title to a flex layout with a portion label.
function initFoodChipUI() {
    // 1. Remove all visible keyboard shortcut indicators
    document.querySelectorAll('.pc-key, .dock-key').forEach(el => el.remove());

    // 2. Add info row (weight + kcal) and macro labels to each food chip
    document.querySelectorAll('.preset-chip[data-food]').forEach(chip => {
        const foodKey = chip.dataset.food;
        const food = FOODS[foodKey];
        if (!food) return;

        const bar = chip.querySelector('.pc-macro-bar');
        if (!bar) return;

        // Move .pc-weight into an info row above the macro bar
        const oldWeight = chip.querySelector('.pc-weight');

        // Create info row: [weight left] [kcal right] — stacked: value above unit
        const infoRow = document.createElement('div');
        infoRow.className = 'pc-info-row';

        const isLiquid = food.carbType === 'sukker_flydende';
        const weightUnit = isLiquid ? 'ml' : 'g';

        // Left: weight (value above unit)
        const weightGroup = document.createElement('div');
        weightGroup.className = 'pc-info-group info-left';
        const weightVal = document.createElement('span');
        weightVal.className = 'pc-info-value pc-weight-value';
        weightVal.textContent = food.weight;
        const weightUnitEl = document.createElement('span');
        weightUnitEl.className = 'pc-info-unit pc-weight-unit';
        weightUnitEl.textContent = weightUnit;
        weightGroup.appendChild(weightVal);
        weightGroup.appendChild(weightUnitEl);
        infoRow.appendChild(weightGroup);

        // Right: kcal (value above unit)
        const kcalGroup = document.createElement('div');
        kcalGroup.className = 'pc-info-group info-right';
        const kcalVal = document.createElement('span');
        kcalVal.className = 'pc-info-value pc-kcal-value';
        const kcal = food.carbs * 4 + food.protein * 4 + food.fat * 9;
        kcalVal.textContent = kcal;
        const kcalUnitEl = document.createElement('span');
        kcalUnitEl.className = 'pc-info-unit';
        kcalUnitEl.textContent = 'kcal';
        kcalGroup.appendChild(kcalVal);
        kcalGroup.appendChild(kcalUnitEl);
        infoRow.appendChild(kcalGroup);

        // Remove old weight label
        if (oldWeight) oldWeight.remove();

        // Wrap bar in macro wrapper and insert info row before it
        const wrapper = document.createElement('div');
        wrapper.className = 'pc-macro-wrapper';
        bar.parentNode.insertBefore(wrapper, bar);
        wrapper.appendChild(infoRow);
        wrapper.appendChild(bar);

        // Add labels div with the same flex proportions as the bar segments
        const labels = document.createElement('div');
        labels.className = 'pc-macro-labels';

        if (food.carbs > 0) {
            const s = document.createElement('span');
            s.className = 'ml-carb';
            s.style.flex = food.carbs;
            s.textContent = food.carbs;
            labels.appendChild(s);
        }
        if (food.protein > 0) {
            const s = document.createElement('span');
            s.className = 'ml-protein';
            s.style.flex = food.protein;
            s.textContent = food.protein;
            labels.appendChild(s);
        }
        if (food.fat > 0) {
            const s = document.createElement('span');
            s.className = 'ml-fat';
            s.style.flex = food.fat;
            s.textContent = food.fat;
            labels.appendChild(s);
        }

        wrapper.appendChild(labels);

        // 3. Add keyboard shortcut to tooltip
        const tooltip = chip.querySelector('.pc-tooltip');
        const shortcut = FOOD_SHORTCUT_MAP[foodKey];
        if (tooltip && shortcut) {
            const br = document.createElement('br');
            tooltip.appendChild(br);
            const keySpan = document.createElement('span');
            keySpan.className = 'tt-key';
            keySpan.textContent = t('food.shortcut') + ': ' + shortcut;
            tooltip.appendChild(keySpan);
        }
    });

    // 4. Convert the first row title to a flex layout with a portion label
    const firstRowTitle = document.querySelector('.preset-row-title[data-row-id="lowCarb"]');
    if (firstRowTitle) {
        const titleText = firstRowTitle.textContent;
        firstRowTitle.removeAttribute('data-i18n');
        firstRowTitle.classList.add('preset-row-title-line');
        firstRowTitle.innerHTML = '';

        const textSpan = document.createElement('span');
        textSpan.setAttribute('data-i18n', 'food.row.lowCarb');
        textSpan.textContent = titleText;
        firstRowTitle.appendChild(textSpan);

        const portionSpan = document.createElement('span');
        portionSpan.className = 'food-portion-label';
        portionSpan.id = 'foodPortionLabel';
        firstRowTitle.appendChild(portionSpan);
    }

    // Set initial values (including portion label and child scaling)
    updateFoodChips();
}


// =============================================================================
// updateFoodChips — Update food chip display based on portion scaling
// =============================================================================
// Called on:
//   - Page load (via initFoodChipUI)
//   - Profile save (weight changed → adult/child may switch)
//   - Game start (profile loaded)
//   - Language change (tooltip text must be re-translated)
function updateFoodChips() {
    const profileWeight = game?.weight ?? (() => {
        try { return loadFixedCharacterProfile().weight; }
        catch (e) { return 70; }
    })();
    const isChild = profileWeight < 45;

    document.querySelectorAll('.preset-chip[data-food]').forEach(chip => {
        const foodKey = chip.dataset.food;
        const food = FOODS[foodKey];
        if (!food) return;

        // Calculate scaled portion
        const scale = isChild ? (food.childScale !== undefined ? food.childScale : CHILD_PORTION_SCALE) : 1.0;
        const carbs = Math.round(food.carbs * scale);
        const protein = Math.round(food.protein * scale);
        const fat = Math.round(food.fat * scale);
        const portionWeight = Math.round(food.weight * scale);
        const kcal = carbs * 4 + protein * 4 + fat * 9;

        // Update info row (weight + kcal) above the macro bar
        const weightValEl = chip.querySelector('.pc-weight-value');
        if (weightValEl) weightValEl.textContent = portionWeight;
        const weightUnitEl = chip.querySelector('.pc-weight-unit');
        if (weightUnitEl) weightUnitEl.textContent = food.carbType === 'sukker_flydende' ? 'ml' : 'g';
        const kcalValEl = chip.querySelector('.pc-kcal-value');
        if (kcalValEl) kcalValEl.textContent = kcal;

        // Update macro bar flex values
        const bar = chip.querySelector('.pc-macro-bar');
        if (bar) {
            const carbBar = bar.querySelector('.pc-mb-carb');
            const proteinBar = bar.querySelector('.pc-mb-protein');
            const fatBar = bar.querySelector('.pc-mb-fat');
            if (carbBar) carbBar.style.flex = carbs || 0;
            if (proteinBar) proteinBar.style.flex = protein || 0;
            if (fatBar) fatBar.style.flex = fat || 0;
        }

        // Update macro labels (gram values below the bar)
        const labels = chip.querySelector('.pc-macro-labels');
        if (labels) {
            const carbLabel = labels.querySelector('.ml-carb');
            const proteinLabel = labels.querySelector('.ml-protein');
            const fatLabel = labels.querySelector('.ml-fat');
            if (carbLabel) { carbLabel.textContent = carbs; carbLabel.style.flex = carbs || 1; }
            if (proteinLabel) { proteinLabel.textContent = protein; proteinLabel.style.flex = protein || 1; }
            if (fatLabel) { fatLabel.textContent = fat; fatLabel.style.flex = fat || 1; }
        }

        // Update tooltip with scaled values
        const tooltip = chip.querySelector('.pc-tooltip');
        if (tooltip) {
            const carbTT = tooltip.querySelector('.tt-carb');
            const proteinTT = tooltip.querySelector('.tt-protein');
            const fatTT = tooltip.querySelector('.tt-fat');
            const kcalTT = tooltip.querySelector('.tt-kcal');
            const keyTT = tooltip.querySelector('.tt-key');
            if (carbTT) carbTT.textContent = t('food.label.carbs') + ': ' + carbs + 'g';
            if (proteinTT) proteinTT.textContent = t('food.label.protein') + ': ' + protein + 'g';
            if (fatTT) fatTT.textContent = t('food.label.fat') + ': ' + fat + 'g';
            if (kcalTT) kcalTT.textContent = kcal + ' kcal';
            if (keyTT) {
                const shortcut = FOOD_SHORTCUT_MAP[foodKey];
                if (shortcut) keyTT.textContent = t('food.shortcut') + ': ' + shortcut;
            }
        }
    });

    // Update portion label
    const portionLabel = document.getElementById('foodPortionLabel');
    if (portionLabel) {
        portionLabel.textContent = t(isChild ? 'food.portions.child' : 'food.portions.adult');
    }
}


function addFoodFromKey(foodKey) {
    if (!game) return;
    if (typeof FOODS === 'undefined') return;
    const food = FOODS[foodKey];
    if (!food) {
        console.warn(`addFoodFromKey: ukendt madvare-nøgle "${foodKey}"`);
        return;
    }
    // Block keyboard shortcuts for chips in a campaign-disabled food row.
    // Click handlers are already blocked by pointer-events:none on the row,
    // but key presses (Q/W/E... A/S/D... Z/X/C...) bypass the DOM event.
    const chip = document.querySelector(`.preset-chip[data-food="${foodKey}"]`);
    if (chip && chip.closest('.preset-row.campaign-disabled')) return;
    // Apply portion scaling (children < 45 kg receive smaller portions)
    const scale = getPortionScale(foodKey);
    // Gem rettens viste navn sammen med handlingen, så logs er menneskeligt læsbare.
    const foodName = chip ? (chip.querySelector('.pc-name')?.textContent || '').trim() : '';
    const ok = game.addFood(
        Math.round(food.carbs * scale),
        Math.round(food.protein * scale),
        Math.round(food.fat * scale),
        food.icon,
        Math.round(food.weight * scale),
        food.carbType,
        food.eatTimeMin,
        foodName
    );
    if (ok) flyIconToGraph(food.icon, 'dock-panel-food');
}

function flyIconToGraph(emoji, sourceId, insulinType) {
    // --- Night-pop delay ---
    // When zzZzz bubbles pop, the fly-icon animation is delayed ~400 ms
    // so the player sees: bubbles pop → [pause] → icon flies to graph.
    if (window._nightPopActiveUntil) {
        const now = performance.now();
        if (now < window._nightPopActiveUntil) {
            const delay = window._nightPopActiveUntil - now;
            setTimeout(() => flyIconToGraph(emoji, sourceId, insulinType), delay);
            return;
        }
    }

    const graph = document.getElementById('bg-graph');
    if (!graph) return;

    // Find start position: dock icon for the relevant type (not the panel)
    const dockMap = {
        'dock-panel-insulin': '.dock-item.d-insulin',
        'dock-panel-food': '.dock-item.d-food',
        'dock-panel-custom-food': '.dock-item.d-food',   // Custom food uses the same dock icon as food
        'dock-panel-motion': '.dock-item.d-exercise',
        'dock-panel-kit': '.dock-item.d-kit'
    };
    const dockSelector = dockMap[sourceId];
    const dockItem = dockSelector ? document.querySelector(dockSelector) : document.getElementById(sourceId);
    if (!dockItem) return;

    const startRect = dockItem.getBoundingClientRect();
    const graphRect = graph.getBoundingClientRect();

    // Create icon element. Food can now be either an emoji or an image path.
    // For insulin syringes: use SVG instead of hue-rotated
    // 💉 emoji, since emoji rendering varies across platforms (Windows = yellowish,
    // Android tablet = reddish) and produces inconsistent colours after hue-rotate.
    let icon;
    const insulinIconMap = {
        basal: 'assets/icons/app/basal-syringe-clock.png',
        fast: 'assets/icons/app/rapid-syringe.png',
        glucagon: 'assets/icons/app/glucagon-pen.png'
    };
    if (typeof emoji === 'string' && /\.(png|webp|svg)$/i.test(emoji)) {
        icon = document.createElement('img');
        icon.className = 'flying-icon flying-icon-img';
        icon.src = emoji;
        icon.alt = '';
    } else if (emoji === '💉' && insulinIconMap[insulinType]) {
        icon = document.createElement('img');
        icon.className = 'flying-icon flying-icon-img';
        icon.src = insulinIconMap[insulinType];
        icon.alt = '';
    } else {
        icon = document.createElement('span');
        icon.className = 'flying-icon';
        icon.textContent = emoji;
    }

    // Start position: centre of the dock icon
    const startX = startRect.left + startRect.width / 2 - 14;
    const startY = startRect.top + startRect.height / 2 - 14;
    icon.style.left = startX + 'px';
    icon.style.top = startY + 'px';
    document.body.appendChild(icon);

    // Close the panel immediately
    closeDockPanels();

    // Calculate the time-based x position on the graph
    const padding = { left: 58, right: 20 };
    const graphWidth = graphRect.width - padding.left - padding.right;
    let xFraction = 0.8;
    if (game) {
        const timeInDay = game.timeInMinutes % 1440;
        xFraction = timeInDay / 1440;
    }
    const targetX = graphRect.left + padding.left + xFraction * graphWidth;
    // Graph drawing area has padding.bottom=40 — place icon just above the x-axis
    const targetY = graphRect.top + graphRect.height - 80;

    // Animate along a quadratic Bezier curve from dock → control point (upward) → graph.
    // Bezier gives a natural, smooth arc without clamping issues.
    // P0 = start (dock), P1 = control point (above the midpoint), P2 = target (graph).
    const duration = 1000; // ms
    const startTime = performance.now();
    // Control point: centred on X axis, shifted upward (highest part of the arc)
    const cpX = (startX + targetX) / 2;
    const cpY = Math.min(startY, targetY) - 120; // 120 px above the highest point

    function animate(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Ease-out cubic for smooth deceleration
        const ease = 1 - Math.pow(1 - t, 3);
        // Quadratic Bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
        const inv = 1 - ease;
        const currentX = inv * inv * startX + 2 * inv * ease * cpX + ease * ease * targetX;
        const currentY = inv * inv * startY + 2 * inv * ease * cpY + ease * ease * targetY;

        icon.style.left = currentX + 'px';
        icon.style.top = currentY + 'px';
        // Fade and shrink during the last 25%
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
// ACTIVITY UI — Show/hide active state and update overlay
// =============================================================================

/**
 * showActivityActive — Switch the activity panel to active state and show overlay.
 * Displays timer, progress bar and stop button in both the dock panel and the graph overlay.
 */
function showActivityActive(type, intensitet, varighed) {
    const typeDef = AKTIVITETSTYPER[type];
    if (!typeDef) return;

    // Hide setup, show active
    const setupEl = document.getElementById('activity-setup');
    const activeEl = document.getElementById('activity-active');
    if (setupEl) setupEl.style.display = 'none';
    if (activeEl) activeEl.style.display = 'block';

    // Set info in the panel. Activity type icon can be an emoji or a PNG path.
    const setContent = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setActivityIcon = (id, iconPath) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = '';
        if (typeof iconPath === 'string' && /\.(png|webp|svg)$/i.test(iconPath)) {
            const img = document.createElement('img');
            img.className = 'activity-inline-icon-img';
            img.src = iconPath;
            img.alt = '';
            el.appendChild(img);
        } else {
            el.textContent = iconPath;
        }
    };
    setActivityIcon('activityActiveIcon', typeDef.icon);
    setContent('activityActiveName', t(`activity.name.${type}`));
    const intensityKey = intensitet === 'Lav' ? 'low' : intensitet === 'Høj' ? 'high' : 'medium';
    setContent('activityActiveIntensity', t(`activity.intensity.${intensityKey}`));

    // Show overlay on the graph
    const overlay = document.getElementById('activity-overlay');
    if (overlay) {
        overlay.style.display = 'block';
        setActivityIcon('activityOverlayIcon', typeDef.icon);
        setContent('activityOverlayName', t(`activity.name.${type}`));
        setContent('activityOverlayIntensity', t(`activity.intensity.${intensityKey}`));
        // Set border colour to the activity type colour
        overlay.style.borderColor = typeDef.farve + '40';
    }

    // Animate the dock icon
    const dockExercise = document.querySelector('.dock-item.d-exercise');
    if (dockExercise) {
        dockExercise.classList.add('activity-active');
        dockExercise.style.setProperty('--activity-color', typeDef.farve);
    }

    // Reset progress bar: colour + width to 0% (prevents it from starting at 100%)
    document.querySelectorAll('.activity-progress-fill').forEach(el => {
        el.style.background = typeDef.farve;
        el.style.width = '0%';
        el.style.opacity = '1';
    });
}

/**
 * hideActivityActive — Switch back to setup state and hide overlay.
 */
function hideActivityActive() {
    const setupEl = document.getElementById('activity-setup');
    const activeEl = document.getElementById('activity-active');
    if (setupEl) setupEl.style.display = 'block';
    if (activeEl) activeEl.style.display = 'none';

    const overlay = document.getElementById('activity-overlay');
    if (overlay) overlay.style.display = 'none';

    const dockExercise = document.querySelector('.dock-item.d-exercise');
    if (dockExercise) dockExercise.classList.remove('activity-active');
}

/**
 * updateActivityOverlay — Update timer and progress in the overlay and panel.
 * Called from updateUI() every frame.
 */
function updateActivityOverlay() {
    if (!game || !game.activeAktivitet) {
        // If the activity has stopped (e.g. auto-stop), hide UI
        const overlay = document.getElementById('activity-overlay');
        if (overlay && overlay.style.display !== 'none') hideActivityActive();
        return;
    }

    const akt = game.activeAktivitet;
    const elapsed = game.totalSimMinutes - akt.startTime;

    // Format time as "Xh Ym" for durations over 60 min, otherwise "X min"
    const fmtTime = (totalMin) => {
        const m = Math.floor(totalMin);
        if (m >= 60) return `${Math.floor(m / 60)}t ${m % 60}m`;
        return `${m} min`;
    };
    const timeStr = akt.varighed
        ? `${fmtTime(elapsed)} / ${fmtTime(akt.varighed)}`
        : fmtTime(elapsed);

    // Update timer
    const setContent = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setContent('activityTimerPanel', timeStr);
    setContent('activityOverlayTimer', timeStr);
    setContent('activityKcalBurned', Math.round(akt.kcalBurned));

    // --- Dynamic overlay position ---
    // Default: bottom-right (away from CGM hero and dock).
    // Moved to bottom-left ONLY when the current CGM readings are in the right
    // side of the graph and would be hidden behind the overlay.
    const overlay = document.getElementById('activity-overlay');
    if (overlay) {
        const currentDayStartMinutes = (game.day - 1) * 1440;
        const minutesIntoDay = game.totalSimMinutes - currentDayStartMinutes;
        const dayProgress = minutesIntoDay / 1440; // 0.0 til 1.0

        // Overlay is ~180 px wide. When the current time is in the right ~18% of
        // the graph (roughly after 19:40), the overlay moves left so CGM data is visible.
        if (dayProgress > 0.82) {
            overlay.style.left = '70px';
            overlay.style.right = 'auto';
        } else {
            overlay.style.left = 'auto';
            overlay.style.right = '32px';
        }
    }

    // Update progress bar (only if fixed duration)
    if (akt.varighed) {
        const progress = Math.min(100, (elapsed / akt.varighed) * 100);
        document.querySelectorAll('.activity-progress-fill').forEach(el => {
            el.style.width = progress + '%';
        });
    } else {
        // Open-ended duration: fill slowly (pulsing effect)
        document.querySelectorAll('.activity-progress-fill').forEach(el => {
            el.style.width = '100%';
            el.style.opacity = '0.5';
        });
    }
}

// =============================================================================
// SOS GLUCAGON — Shared function for the SOS button and B keyboard shortcut
// =============================================================================
//
// Called from both the SOS dock-item click and the B keyboard shortcut.
// Checks cooldown, administers glucagon, and provides visual feedback.
// =============================================================================
function triggerGlucagonSOS() {
    if (!game || game.isGameOver) return;
    const cooldownMinutes = 24 * 60;
    const timeSinceUsed = game.totalSimMinutes - game.glucagonUsedTime;
    if (timeSinceUsed >= cooldownMinutes) {
        game.useGlucagon();
        closeDockPanels();
        // Visual feedback: flash the kit icon + fly glucagon pen to the graph.
        const kitItem = document.querySelector('.dock-item.d-kit');
        if (kitItem) {
            kitItem.classList.add('sos-activated');
            setTimeout(() => kitItem.classList.remove('sos-activated'), 600);
        }
        // Fly icon from the kit icon to the graph's current time position
        flyIconToGraph('assets/icons/app/glucagon-pen.png', 'dock-panel-kit', 'glucagon');
    }
}


// =============================================================================
// STOP CONFIRMATION — "Are you sure?" popup when the player clicks Stop
// =============================================================================
function showStopConfirmPopup() {
    // I Insights betyder topknappen "Tilbage til banen". Her er intet at
    // bekræfte: den alternative kopi kasseres, og den pausede bane fortsætter.
    if (currentGameMode === 'insights') {
        returnFromInsights();
        return;
    }

    // Pause the game while the popup is shown
    const wasPaused = isPaused;
    if (!isPaused) togglePause();

    const isInsightsView = currentGameMode === 'insights';
    const stopTitle = isInsightsView ? t('insights.stop.title') : t('stop.title');
    const stopMessage = isInsightsView ? t('insights.stop.message') : t('stop.message');
    const stopYes = isInsightsView ? t('insights.stop.yes') : t('stop.yes');

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = `
        <div class="popup-content" style="text-align:center; max-width:380px;">
            <h2 style="color: var(--red); font-size: 1.4em;">${stopTitle}</h2>
            <p style="margin: 16px 0;">${stopMessage}</p>
            <div style="display:flex; gap:12px; justify-content:center; margin-top:20px;">
                <button id="stopConfirmYes" style="background: linear-gradient(135deg, #dc2626, #b91c1c); box-shadow: 0 4px 15px rgba(220,38,38,0.3);">${stopYes}</button>
                <button id="stopConfirmNo" style="background: linear-gradient(135deg, #374151, #1f2937); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">${t('stop.cancel')}</button>
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
        // Resume if the game was not paused before
        if (!wasPaused) togglePause();
    });
}


// =============================================================================
// CUSTOM FOOD PANEL — "Build your own" branching from the food dock panel
// =============================================================================
//
// Toggles visibility of the custom food panel (dock-panel-custom-food).
// The panel is positioned as a branch beside the food panel.
// =============================================================================
function showCustomFoodPanel() {
    const customPanel = document.getElementById('dock-panel-custom-food');
    if (!customPanel) return;

    // Toggle: close food panel, show custom panel (or vice versa)
    const foodPanel = document.getElementById('dock-panel-food');
    if (foodPanel) foodPanel.classList.remove('visible');

    // Show custom panel
    customPanel.classList.toggle('visible');
}


// =============================================================================
// DOCK PANEL SYSTEM — Open/close fold-up panels from the dock bar
// =============================================================================
//
// Each dock item has a data-panel attribute pointing to a panel element.
// Clicking a dock item toggles its panel (and closes other open panels).
// Clicking outside an open panel also closes it.
//
// Panels use the CSS class 'visible' to display with a fade+slide animation.
// Dock items receive the 'active' class when their panel is open.
// =============================================================================

/**
 * toggleDockPanel — Open or close a dock panel.
 * @param {string} panelId — ID of the panel to toggle
 */
function toggleDockPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // Campaign mode: check whether the panel is permitted
    if (campaignEngine && campaignEngine.levelActive) {
        const actionMap = {
            'dock-panel-food': 'food',
            'dock-panel-motion': 'exercise',
            'dock-panel-kit': 'kit',
        };
        const actionType = actionMap[panelId];
        // Insulin panel: allowed if either fast or basal is active
        if (panelId === 'dock-panel-insulin') {
            if (!campaignEngine.isActionAllowed('fastInsulin') && !campaignEngine.isActionAllowed('basalInsulin')) {
                playSound('menuClose');
                return;
            }
        } else if (actionType && !campaignEngine.isActionAllowed(actionType)) {
            playSound('menuClose');
            return;
        }
    }

    const isCurrentlyVisible = panel.classList.contains('visible');

    // Close ALL open dock panels first
    document.querySelectorAll('.dock-panel.visible').forEach(p => {
        p.classList.remove('visible');
    });
    // Remove 'active' from all dock items
    document.querySelectorAll('.dock-item.active').forEach(d => {
        d.classList.remove('active');
    });

    // If the panel was not open: open it now
    if (!isCurrentlyVisible) {
        panel.classList.add('visible');
        // Mark the corresponding dock item as active
        const dockItem = document.querySelector(`.dock-item[data-panel="${panelId}"]`);
        if (dockItem) dockItem.classList.add('active');
        playSound('menuOpen');
    } else {
        // Panel was closed
        playSound('menuClose');
    }
}

/**
 * closeDockPanels — Close all open dock panels.
 * Called when the user clicks outside a panel.
 */
function closeDockPanels() {
    // Check whether there are actually open panels (only play sound if something closes)
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
 * toggleSideDrawer — Open/close the debug drawer from the right edge.
 * @param {string} drawerId — ID of the panel to toggle ('debug-sidebar')
 */
function toggleSideDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;

    const isOpening = !drawer.classList.contains('open');
    drawer.classList.toggle('open', isOpening);

    // Persist debug drawer state in settings
    appSettings.debugOpen = document.getElementById('debug-sidebar')?.classList.contains('open') || false;
    saveSettings(appSettings);

    // Resize canvas because drawers change the available width for the graph
    setTimeout(sizeCanvas, 380);
}

/**
 * toggleDebugSidebar — Backwards-compatible wrapper (used by the settings menu).
 */
function toggleDebugSidebar() {
    toggleSideDrawer('debug-sidebar');
}


// =============================================================================
// activatePhysiologyMode — Enable/disable the entire physiology package as one action.
// Controls: BG forces panel, insulin band, carb band, ISF line and true BG line.
// When activated mid-game, trainingModeUsedThisSession is set to true.
// =============================================================================
function activatePhysiologyMode(activate) {
    // Set all physiology flags
    showInsulinBand = activate;
    showCarbBand = activate;
    showISFLine = activate;
    showKetoneLine = activate;
    physiologyEffectsEnabled = activate;
    appSettings.showInsulinBand = activate;
    appSettings.showCarbBand = activate;
    appSettings.showISFLine = activate;
    appSettings.showKetoneLine = activate;
    appSettings.physiologyEffects = activate;
    appSettings.debugTrueBG = activate;
    if (debugTrueBgCheckbox) debugTrueBgCheckbox.checked = activate;

    // BG forces panel show/hide
    const panel = document.getElementById('physiology-effects');
    const list = document.getElementById('effectsList');
    if (activate) {
        if (panel) panel.style.display = 'block';
        if (!game && list) list.innerHTML = _effectsPlaceholderHTML();
    } else {
        if (panel) panel.style.display = 'none';
        if (list) list.innerHTML = '';
        _lastEffectsData = [];
    }

    // Mark session as training mode if the game is running
    if (game && activate) {
        trainingModeUsedThisSession = true;
    }

    // Update button styling
    const btn = document.getElementById('physiologyToggle');
    if (btn) btn.classList.toggle('active', activate);

    saveSettings(appSettings);
    syncPhysiologyToggles();

    // Redraw the graph so the watermark appears/disappears immediately
    drawGraph();
}


// =============================================================================
// showPhysiologyConfirmDialog — Confirmation dialog before physiology display is activated.
// =============================================================================
function showPhysiologyConfirmDialog(onConfirm, onContinueWithoutPhysiology = null) {
    const { overlay, content } = createPopup({ maxWidth: '420px' });
    overlay.style.zIndex = '9999';

    content.innerHTML = `
        <h3 style="color: var(--accent-gold); margin-bottom: 12px;">${t('ui.physiology.confirm.title')}</h3>
        <p style="margin-bottom: 20px; line-height: 1.5;">${t('ui.physiology.confirm.body')}</p>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button class="popup-btn-primary" id="physConfirmYes">${t('ui.physiology.confirm.yes')}</button>
            <button class="popup-btn-link" id="physConfirmNo">${t('ui.physiology.confirm.no')}</button>
        </div>
    `;

    document.getElementById('physConfirmYes').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onConfirm();
    });
    document.getElementById('physConfirmNo').addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (typeof onContinueWithoutPhysiology === 'function') {
            onContinueWithoutPhysiology();
        }
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });
}


// =============================================================================
// initializeApp — One-time setup when the page loads
// =============================================================================
function initializeApp() {
    // --- Assign all DOM element references ---
    startButton = document.getElementById('startButton');
    helpButton = document.getElementById('helpButton');
    highscoreButton = document.getElementById('highscoreButton');
    pauseButton = document.getElementById('pauseButton');
    speedSelector = document.getElementById('speedStepper');
    // Stepper: .value property is read by simulator.js to determine speed
    speedSelector.value = '240'; // Default value (4x/min)
    dayDisplay = document.getElementById('dayDisplay');
    timeDisplay = document.getElementById('timeDisplay');
    cgmValueDisplayGraph = document.getElementById('cgmValueDisplayGraph');
    normoPointsDisplay = document.getElementById('normoPointsDisplay');
    normoPointsWeighting = document.getElementById('normoPointsWeighting');
    soundButton = document.getElementById('soundButton');
    carbsSlider = document.getElementById('carbsSlider');
    carbsValue = document.getElementById('carbsValue');
    proteinSlider = document.getElementById('proteinSlider');
    proteinValue = document.getElementById('proteinValue');
    fatSlider = document.getElementById('fatSlider');
    fatValue = document.getElementById('fatValue');
    foodKcalDisplay = document.getElementById('foodKcalDisplay');
    // Food buttons (preset chips) are no longer stored as individual variables —
    // they are bound data-driven via querySelectorAll('[data-food]') in the preset handler block
    // and look up all their macros from the FOODS table in js/foods.js.
    fastInsulinSlider = document.getElementById('fastInsulinSlider');
    fastInsulinValue = document.getElementById('fastInsulinValue');
    giveFastInsulinButton = document.getElementById('giveFastInsulinButton');
    longInsulinSlider = document.getElementById('longInsulinSlider');
    longInsulinValue = document.getElementById('longInsulinValue');
    giveLongInsulinButton = document.getElementById('giveLongInsulinButton');
    motionIntensitySelect = document.getElementById('motionIntensity');
    startMotionButton = document.getElementById('startMotionButton');
    motionKcalDisplay = document.getElementById('motionKcalDisplay');
    fingerprickButton = document.getElementById('fingerprickButton');
    ketoneTestButton = document.getElementById('ketoneTestButton');
    debugTrueBgCheckbox = document.getElementById('debugTrueBgCheckbox');
    iobDisplay = document.getElementById('iobDisplay');
    cobDisplay = document.getElementById('cobDisplay');
    bgGraphCanvas = document.getElementById('bg-graph');
    graphCtx = bgGraphCanvas.getContext('2d');
    weightChangeValue = document.getElementById('weightChangeValue');
    steepDropWarningDiv = document.getElementById('steep-drop-warning');
    // Stats fragment in the capsule bar (replaces the removed stats side-drawer)
    statsTirValue = document.getElementById('statsTirValue');
    statsAvgBgValue = document.getElementById('statsAvgBgValue');
    statsWeightValue = document.getElementById('statsWeightValue');

    // --- Initial UI setup ---
    sizeCanvas();
    translateDOM();   // Translate all data-i18n elements based on saved language

    // Fetch version number from js/version-data.js and display in logo tooltip.
    // HTML only has a neutral fallback, so version data lives in one place.
    if (typeof loadVersionInfo === 'function') loadVersionInfo().then(v => {
        const el = document.getElementById('brandGroup');
        if (el) el.title = `v${v.version} — ${v.date}`;
    }).catch(() => {});
    initFoodChipUI(); // Build macro labels, remove shortcut indicators, add portion label
    updateFoodDisplay();
    updateMotionKcal();

    // =========================================================================
    // EVENT LISTENERS — Connect UI elements to their handler functions
    // =========================================================================

    // --- Food slider change handlers ---
    carbsSlider.addEventListener('input', (e) => { carbsValue.textContent = e.target.value; updateFoodDisplay(); });
    proteinSlider.addEventListener('input', (e) => { proteinValue.textContent = e.target.value; updateFoodDisplay(); });
    fatSlider.addEventListener('input', (e) => { fatValue.textContent = e.target.value; updateFoodDisplay(); });

    // --- Insulin slider change handlers ---
    fastInsulinSlider.addEventListener('input', (e) => fastInsulinValue.textContent = parseFloat(e.target.value).toFixed(1));
    longInsulinSlider.addEventListener('input', (e) => longInsulinValue.textContent = e.target.value);

    // --- Insulin dose steppers (fine ± adjuster above each slider) ---
    // Rapid insulin is dosed in half units (-1/-½/+½/+1). Long-acting basal is
    // dosed only in whole units (its slider is integer-stepped), so the basal
    // stepper offers -2/-1/+1/+2 instead — a half step would just snap away.
    (function setupDoseSteppers() {
        const mk = (slider, opts) => {
            if (!slider || !slider.parentNode || slider.parentNode.querySelector('.dp-stepper-row')) return;
            const st = buildDoseStepper(slider, opts);
            if (!st) return;
            const row = document.createElement('div');
            row.className = 'dp-stepper-row';
            row.appendChild(st);
            slider.parentNode.insertBefore(row, slider);
        };
        mk(fastInsulinSlider, { half: 0.5, whole: 1, unit: t('insulin.unit') });
        mk(longInsulinSlider, { half: 1, whole: 2, unit: t('insulin.unit') });
    })();

    // --- Global focus removal after any UI interaction ---
    // Buttons, selects and sliders retain focus after click/change,
    // which blocks keyboard shortcuts (tag === 'INPUT'/'SELECT'/'BUTTON').
    // Solution: remove focus from ALL interactive elements after use.
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
    // The start button acts as both Start and Stop.
    // While the game is running: shows an "Are you sure?" confirmation popup before reset.
    function showDisclaimerBeforeGameStart(mode, continueAfterDisclaimer) {
        // Informationen om formål og grænser hører til selve spilstarten, ikke velkomstskærmen eller
        // intro tour. The player first selects mode (campaign/Box Challenge),
        // and all game modes then pass through the same disclaimer gate on first run.
        showDisclaimerPopup(continueAfterDisclaimer);
    }

    // A4b: mode + character are chosen together on the mode-selection screen
    // (showModeSelectionPopup persists the chosen character), so the flow goes
    // straight to startGame from there — no separate character step.
    function showNormalStartFlow() {
        showModeSelectionPopup(
            (mode) => startGame(mode),
            { beforeStart: showDisclaimerBeforeGameStart }
        );
    }

    function startFirstCampaignLevelFromWelcome() {
        // Velkomstskærmen vælger allerede tilstanden, men spilleren skal stadig
        // vælge den fiktive karakter, før bane 1 starter. Genbrug den almindelige
        // karaktervælger, så samme kort, lagring og visuelle mønster bruges overalt.
        showProfilePopup({
            onSave: () => showDisclaimerBeforeGameStart('campaign', () => {
                // campaignEngine is constructed at load time in campaign.js.
                campaignEngine.loadLevel(0);
                startGame('campaign');
            })
        });
    }

    if (typeof WelcomeTour !== 'undefined') {
        WelcomeTour.init({
            onStartCampaign: startFirstCampaignLevelFromWelcome,
            onSkip: () => {}
        });
        WelcomeTour.show();
    }

    startButton.addEventListener('click', () => {
        if (game && !game.isGameOver) {
            // Game is running → show confirmation popup
            showStopConfirmPopup();
        } else {
            // Intet spil → vis information om formål og grænser, vælg tilstand, og start
            showNormalStartFlow();
        }
    });
    helpButton.addEventListener('click', showHelpPopup);
    highscoreButton.addEventListener('click', showHighscorePopup);

    // Campaign info button: reopens the level intro popup (objectives + description + tools)
    const campaignInfoBtn = document.getElementById('campaignInfoBtn');
    if (campaignInfoBtn) {
        campaignInfoBtn.addEventListener('click', () => {
            if (campaignEngine && campaignEngine.levelActive && campaignEngine.levelConfig) {
                campaignEngine.showLevelIntroPopup(true);
            }
        });
    }
    // pauseButton listener is now in the speed-stepper setup below

    // Show the current/last-used character in the BG panel from the start.
    if (typeof updateCgmCharacter === 'function') updateCgmCharacter();

    // --- Sound popup: three separate toggles for sound effects, CGM sounds and music ---
    // Initialise mute icon from saved setting (shows overall sound status)
    const sfxToggle = document.getElementById('sfxToggle');
    const cgmToggle = document.getElementById('cgmToggle');
    const musicToggle = document.getElementById('musicToggle');

    // Synchronise sound toggle buttons with saved settings
    function updateSoundIcon() {
        const muteIcon = document.getElementById('sdMuteIcon');
        if (muteIcon) {
            muteIcon.textContent = (isMuted && isCgmMuted && isMusicMuted) ? '\u{1F507}' : '\u{1F50A}';
        }
    }
    function syncSoundToggles() {
        if (sfxToggle) sfxToggle.classList.toggle('active', !isMuted);
        if (cgmToggle) cgmToggle.classList.toggle('active', !isCgmMuted);
        if (musicToggle) musicToggle.classList.toggle('active', !isMusicMuted);
        updateSoundIcon();
    }
    syncSoundToggles();

    // Tone.js Destination is muted if BOTH SFX and CGM are off
    function updateToneDestination() {
        if (sounds && Tone.Destination) {
            Tone.Destination.mute = isMuted && isCgmMuted;
        }
    }
    updateToneDestination();

    // Sound effects toggle — click on row (.sd-row) in dropdown
    const sfxRow = sfxToggle ? sfxToggle.closest('.sd-row') : null;
    if (sfxRow) {
        sfxRow.addEventListener('click', () => {
            isMuted = !isMuted;
            appSettings.muted = isMuted;
            saveSettings(appSettings);
            updateToneDestination();
            syncSoundToggles();
        });
    }

    // CGM sounds toggle
    const cgmRow = cgmToggle ? cgmToggle.closest('.sd-row') : null;
    if (cgmRow) {
        cgmRow.addEventListener('click', () => {
            toggleCgm();
            updateToneDestination();
            syncSoundToggles();
        });
    }

    // Music toggle
    const musicRow = musicToggle ? musicToggle.closest('.sd-row') : null;
    if (musicRow) {
        musicRow.addEventListener('click', () => {
            toggleMusic();
            syncSoundToggles();
        });
    }

    // Music volume slider — real-time volume update
    const musicVolumeSlider = document.getElementById('musicVolumeSlider');
    const musicVolumeLabel = document.getElementById('musicVolumeLabel');
    // Initialise slider from saved setting
    const savedVol = appSettings.musicVolume ?? 25;
    if (musicVolumeSlider) musicVolumeSlider.value = savedVol;
    if (musicVolumeLabel) musicVolumeLabel.textContent = savedVol + '%';
    if (musicVolumeSlider) {
        // 'input' event fires continuously while the user drags the slider
        musicVolumeSlider.addEventListener('input', (e) => {
            e.stopPropagation(); // Prevents row click from toggling music
            const vol = setMusicVolume(parseInt(e.target.value, 10));
            if (musicVolumeLabel) musicVolumeLabel.textContent = vol + '%';
        });
        // Stop click propagation so the slider does not toggle the music toggle
        musicVolumeSlider.addEventListener('click', (e) => e.stopPropagation());
    }

    // Initialise the background music system (creates the Audio element, no playback yet)
    initMusic();
    // Music is on by default and plays continuously across menu + game. The browser's
    // autoplay policy forbids play() before a user gesture, so on a fresh load (F5) this
    // start is usually blocked — but startMusic() then arms a one-shot gesture retry that
    // unlocks playback on the player's very first interaction (click/keydown), with no
    // need to start a game or toggle the music switch. Where autoplay is already allowed
    // it just starts immediately.
    if (!isMusicMuted) startMusic();

    // --- Language switcher is handled in the SETTINGS DROPDOWN section below ---

    // --- Insights-menu: fysiologi + karakterbundet udforskning af aktiv bane ---
    const insightsMenuBtn = document.getElementById('insightsMenuButton');
    const insightsDropdown = document.getElementById('insightsDropdown');
    const insightsExploreBtn = document.getElementById('insightsExploreButton');
    if (insightsMenuBtn && insightsDropdown) {
        insightsMenuBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (insightsExploreBtn && game) {
                const supportedMode = currentGameMode === 'campaign' || currentGameMode === 'boxchallenge';
                const canExplore = supportedMode && (typeof game.hasMeaningfulInsightsCourse !== 'function'
                    || game.hasMeaningfulInsightsCourse());
                const help = insightsExploreBtn.querySelector('.sd-row-help');
                insightsExploreBtn.disabled = !canExplore;
                if (help) {
                    const key = canExplore ? 'insights.menu.explore.help' : 'insights.menu.explore.wait';
                    help.setAttribute('data-i18n', key);
                    help.textContent = t(key);
                }
            }
            const settings = document.getElementById('settingsDropdown');
            const mobile = document.getElementById('mobileMenu');
            if (settings) settings.classList.remove('visible');
            if (mobile) mobile.classList.remove('visible');
            const wasVisible = insightsDropdown.classList.contains('visible');
            insightsDropdown.classList.toggle('visible');
            if (typeof playSound === 'function') playSound(wasVisible ? 'menuClose' : 'menuOpen');
        });
        insightsDropdown.addEventListener('click', event => event.stopPropagation());
        document.addEventListener('click', () => insightsDropdown.classList.remove('visible'));
    }
    if (insightsExploreBtn) {
        insightsExploreBtn.addEventListener('click', () => {
            if (insightsDropdown) insightsDropdown.classList.remove('visible');
            if (typeof openPlayInInsights === 'function') openPlayInInsights();
        });
    }

    // --- Physiology row — enables/disables the entire physiology package ---
    const physiologyBtn = document.getElementById('physiologyToggle');
    if (physiologyBtn) {
        physiologyBtn.addEventListener('click', () => {
            if (insightsDropdown) insightsDropdown.classList.remove('visible');
            const isActive = physiologyBtn.classList.contains('active');
            if (!isActive && !trainingModeUsedThisSession) {
                // Physiology mode provides extra information, so the player must
                // explicitly accept that no highscore will be saved for this session.
                showPhysiologyConfirmDialog(() => activatePhysiologyMode(true));
                return;
            }
            activatePhysiologyMode(!isActive);
        });
    }

    // --- Hamburger menu (mobile ≤768 px) ---
    // Secondary buttons (profile/help/highscore) are hidden via CSS on narrow screens.
    // A slide-in menu is created here with click delegation to the original buttons.
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');
    const mobileMenuPanel = document.getElementById('mobileMenuPanel');

    if (hamburgerBtn && mobileMenu && mobileMenuPanel) {
        // Toggle menu on hamburger click — position panel directly below the button
        hamburgerBtn.addEventListener('click', () => {
            // Close settings dropdown if it is open
            const sd = document.getElementById('settingsDropdown');
            if (sd) sd.classList.remove('visible');
            const insights = document.getElementById('insightsDropdown');
            if (insights) insights.classList.remove('visible');
            mobileMenu.classList.toggle('visible');
            if (mobileMenu.classList.contains('visible')) {
                const rect = hamburgerBtn.getBoundingClientRect();
                mobileMenuPanel.style.top = (rect.bottom + 6) + 'px';
                mobileMenuPanel.style.left = rect.left + 'px';
            }
            if (typeof playSound === 'function') {
                playSound(mobileMenu.classList.contains('visible') ? 'menuOpen' : 'menuClose');
            }
        });
        // Close menu on backdrop click
        if (mobileMenuBackdrop) {
            mobileMenuBackdrop.addEventListener('click', () => {
                mobileMenu.classList.remove('visible');
                if (typeof playSound === 'function') playSound('menuClose');
            });
        }
        // Create menu items that delegate clicks to the original buttons.
        ['helpButton', 'highscoreButton'].forEach(id => {
            const original = document.getElementById(id);
            if (!original) return;
            const item = document.createElement('button');
            item.className = 'mobile-menu-item';
            item.textContent = original.textContent.trim();
            item.addEventListener('click', () => {
                original.click();
                mobileMenu.classList.remove('visible');
            });
            mobileMenuPanel.appendChild(item);
        });
    }

    // --- VFX initialisation from localStorage ---
    vfxEnabled = localStorage.getItem('vfxEnabled') !== 'false';

    // --- Speed stepper (◀ 4x/min ▶) with integrated pause ---
    const speeds = [60, 240, 720, 1440];
    const speedLabels = { 60: '1t/min', 240: '4t/min', 720: '12t/min', 1440: '24t/min' };
    const speedLabel = document.getElementById('speedLabel');
    const speedStateIcon = document.getElementById('speedStateIcon');
    const speedDownBtn = document.getElementById('speedDown');
    const speedUpBtn = document.getElementById('speedUp');

    // Helper: update stepper UI
    // Icon shows mode: ⏸ when paused, ▶/▶▶/▶▶▶/▶▶▶▶ when running (pulsing)
    // Pulse rate matches the simulation speed
    const speedArrows = { 60: '\u25B6', 240: '\u25B6\u25B6', 720: '\u25B6\u25B6\u25B6', 1440: '\u25B6\u25B6\u25B6\u25B6' };
    // Pulse duration per speed — faster sim = faster pulse
    const speedPulse = { 60: '3', 240: '1.5', 720: '0.6', 1440: '0.3' };
    function updateSpeedStepperUI() {
        const val = speedSelector.value;
        const idx = speeds.indexOf(parseInt(val));
        // Label shows "Pause" when paused, otherwise speed (e.g. "4t/min")
        speedLabel.textContent = isPaused ? 'Pause' : (speedLabels[val] || '4t/min');
        // Disable ▶ at the highest speed
        speedUpBtn.disabled = (idx >= speeds.length - 1);
        speedDownBtn.disabled = false;
        // Icon + pulse: ⏸ static when paused, arrows when running
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
            // All speeds pulse — slower at low speed, faster at high speed
            speedStateIcon.classList.add('pulsing');
            speedStateIcon.style.animationDuration = (speedPulse[val] || '1.5') + 's';
        }
    }

    // Change speed up/down — leftmost step pauses the simulation
    function changeSpeed(delta) {
        if (!game || game.isGameOver) return;
        // Tracker for speed/idle tips: record that the player has used the speed buttons
        game.lastSpeedChangeTime = game.totalSimMinutes;
        game._speedEverChanged = true;
        const idx = speeds.indexOf(parseInt(speedSelector.value));
        const newIdx = idx + delta;
        // ◀ at lowest speed → pause
        if (delta < 0 && idx <= 0) {
            if (!isPaused) togglePause();
            return;
        }
        // ▶ while paused → resume at lowest speed (1x/min)
        if (delta > 0 && isPaused) {
            speedSelector.value = String(speeds[0]);
            if (game) game.simulationSpeed = speeds[0];
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
    // Centre button = pause/resume
    pauseButton.addEventListener('click', togglePause);
    // Expose functions globally (used from game.js)
    window.updateSpeedStepperUI = updateSpeedStepperUI;
    window.changeSpeed = changeSpeed;
    updateSpeedStepperUI();

    // --- Food buttons: preset chips + "Build your own" popup ---
    // All preset chips in the food panel are tagged with data-food="<key>".
    // ONE handler per chip is bound and macros/icon/weight/carbType are looked up in
    // the FOODS table (js/foods.js). This means:
    //   1) The table is the source of truth — changes update both UI and physics.
    //   2) carbType is passed so Simulator.addFood() can control dynamic τG.
    //   3) New food items only need a table entry + a chip in HTML — no JS.
    document.querySelectorAll('#dock-panel-food .preset-chip[data-food]').forEach(chip => {
        const foodKey = chip.dataset.food;
        chip.addEventListener('click', () => addFoodFromKey(foodKey));
    });

    // --- Insulin buttons: preset buttons + custom slider ---
    // Rapid insulin presets (½, 1, 2, 4, 8 units)
    document.getElementById('fastPreset05').addEventListener('click', () => {
        if(game) { game.addFastInsulin(0.5); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset1').addEventListener('click', () => {
        if(game) { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset2').addEventListener('click', () => {
        if(game) { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset4').addEventListener('click', () => {
        if(game) { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    document.getElementById('fastPreset8').addEventListener('click', () => {
        if(game) { game.addFastInsulin(8); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    // Rapid insulin custom slider (N)
    giveFastInsulinButton.addEventListener('click', () => {
        if(game) { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); }
    });
    // Basal insulin presets — a coarse, character-scaled dose ladder (A5b). The
    // doses come from getBasalPresetDoses() (ui.js), the SAME source the displayed
    // chip numbers and the keyboard shortcuts use, so the chip always gives exactly
    // what it shows. They are derived from the coarse basal cap, not the precise
    // steady-state need, so no chip equals a recommended dose.
    document.getElementById('basalPreset1').addEventListener('click', () => {
        if(game) { game.addLongInsulin(getBasalPresetDoses()[0]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset2').addEventListener('click', () => {
        if(game) { game.addLongInsulin(getBasalPresetDoses()[1]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset3').addEventListener('click', () => {
        if(game) { game.addLongInsulin(getBasalPresetDoses()[2]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset4').addEventListener('click', () => {
        if(game) { game.addLongInsulin(getBasalPresetDoses()[3]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    document.getElementById('basalPreset5').addEventListener('click', () => {
        if(game) { game.addLongInsulin(getBasalPresetDoses()[4]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });
    // Basal insulin custom slider (H)
    giveLongInsulinButton.addEventListener('click', () => {
        if(game) { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); }
    });

    // --- Activity controls ---
    // Selected activity type and duration (state for the activity panel)
    let selectedActivityType = 'cardio';
    let selectedDuration = 30; // null = open-ended

    // Intensity icons per activity type
    const INTENSITET_IKONER = {
        default: {
            Lav: 'assets/icons/app/intensity-low.png',
            Medium: 'assets/icons/app/intensity-medium.png',
            Høj: 'assets/icons/app/intensity-high.png'
        }
    };

    // Update intensity chip icons and labels based on activity type
    function updateIntensityChips(type) {
        const ikoner = INTENSITET_IKONER[type] || INTENSITET_IKONER.default;
        document.querySelectorAll('.intensity-chip').forEach(chip => {
            const level = chip.dataset.intensity;
            const emojiEl = chip.querySelector('.pc-emoji');
            if (emojiEl && ikoner[level]) {
                emojiEl.textContent = '';
                const img = document.createElement('img');
                img.className = 'pc-emoji-img';
                img.src = ikoner[level];
                img.alt = '';
                emojiEl.appendChild(img);
            }
        });
    }

    // Helper: update examples text based on selected type + intensity.
    // Falls back to general text if the intensity-specific key is missing.
    function updateActivityExamples() {
        const examplesEl = document.getElementById('activityTypeExamples');
        if (!examplesEl) return;
        const intensitet = motionIntensitySelect ? motionIntensitySelect.value : 'Medium';
        const specificKey = `activity.examples.${selectedActivityType}.${intensitet}`;
        const fallbackKey = `activity.examples.${selectedActivityType}`;
        const specific = t(specificKey);
        // If t() returns the key itself, the translation is missing
        examplesEl.textContent = (specific === specificKey) ? t(fallbackKey) : specific;
    }

    // Type chips: click selects activity type
    document.querySelectorAll('.activity-type-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.activity-type-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            selectedActivityType = chip.dataset.type;
            updateActivityExamples();
            // Update intensity icons for the selected activity type
            updateIntensityChips(selectedActivityType);
            updateMotionKcal();
        });
    });

    // Duration chips = START buttons: click starts the activity immediately
    function startActivityWithDuration(duration) {
        if (!game || game.activeAktivitet) return;
        const intensitet = motionIntensitySelect.value;
        const success = game.startAktivitet(selectedActivityType, intensitet, duration);
        if (success) {
            const typeDef = AKTIVITETSTYPER[selectedActivityType];
            flyIconToGraph(typeDef.icon, 'dock-panel-motion');
            // I Hvad Nu Hvis er aktiviteten en fast handling på tidslinjen - den
            // kører ikke live. Derfor må den fælles aktivitets-overlay med timer og
            // Stop-knap ikke åbnes. Facaden har med vilje ingen activeAktivitet.
            if (typeof isStaticMode === 'function' && isStaticMode()) {
                hideActivityActive();
            } else {
                showActivityActive(selectedActivityType, intensitet, duration);
            }
        }
    }

    document.querySelectorAll('.duration-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const duration = chip.dataset.duration === 'open' ? null : parseInt(chip.dataset.duration);
            startActivityWithDuration(duration);
        });
    });

    // Start button (hidden, retained for backwards compatibility)
    startMotionButton.addEventListener('click', () => {
        startActivityWithDuration(selectedDuration);
    });

    // Stop buttons (both in the panel and the overlay)
    document.getElementById('stopActivityButton').addEventListener('click', () => {
        if (game && game.activeAktivitet) {
            game.stopAktivitet();
        }
        // Ryd også et eventuelt forældet overlay. Det gør Stop robust, selv hvis
        // en tidligere UI-tilstand ikke længere har en aktiv modelaktivitet.
        hideActivityActive();
    });
    document.getElementById('stopActivityOverlayButton').addEventListener('click', () => {
        if (game && game.activeAktivitet) {
            game.stopAktivitet();
        }
        hideActivityActive();
    });

    // --- Diabetes kit: dextrose tablets, tests and glucagon ---
    fingerprickButton.addEventListener('click', () => { if(game) { game.performFingerprick(); flyIconToGraph('assets/icons/app/blood-drop.png', 'dock-panel-kit'); } });
    ketoneTestButton.addEventListener('click', () => { if(game) { game.performKetoneTest(); flyIconToGraph('assets/icons/app/ketone-reagent.png', 'dock-panel-kit'); } });

    // Dextrose in the kit panel — uses the FOODS table so carbType=sukker_fast
    // is passed along (gives short τG ≈ 25 min via dynamic gastric emptying).
    const kitDextroButton = document.getElementById('kitDextroButton');
    if (kitDextroButton) {
        kitDextroButton.addEventListener('click', () => {
            if (!game || typeof FOODS === 'undefined') return;
            const f = FOODS.druesukker;
            if (game.addFood(f.carbs, f.protein, f.fat, f.icon, f.weight, f.carbType, f.eatTimeMin)) {
                flyIconToGraph(f.icon, 'dock-panel-kit');
            }
        });
    }

    // Glucagon in the kit panel
    const kitGlucagonButton = document.getElementById('kitGlucagonButton');
    if (kitGlucagonButton) {
        kitGlucagonButton.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerGlucagonSOS();
        });
    }

    // --- Debug checkboxes (persist setting on change) ---
    debugTrueBgCheckbox.addEventListener('change', () => {
        appSettings.debugTrueBG = debugTrueBgCheckbox.checked;
        if (game && debugTrueBgCheckbox.checked) {
            trainingModeUsedThisSession = true;
        }
        saveSettings(appSettings);
        if(game) drawGraph();
    });

    // Unlock all levels: toggle in the developer section — rebuild level grid immediately
    const unlockAllRow = document.getElementById('debugUnlockAllLevelsToggle');
    if (unlockAllRow) {
        unlockAllRow.closest('.sd-row').addEventListener('click', () => {
            appSettings.debugUnlockAllLevels = !appSettings.debugUnlockAllLevels;
            saveSettings(appSettings);
            unlockAllRow.classList.toggle('active', !!appSettings.debugUnlockAllLevels);
            if (campaignEngine) campaignEngine.renderLevelSelect();
        });
    }

    // Debug log checkbox: enable/disable CSV logging
    const debugLogCheckbox = document.getElementById('debugLogCheckbox');
    const debugLogControls = document.getElementById('debugLogControls');
    debugLogCheckbox.addEventListener('change', () => {
        debugLogEnabled = debugLogCheckbox.checked;
        debugLogControls.style.display = debugLogEnabled ? 'flex' : 'none';
        const statusEl = document.getElementById('debugLogStatus');
        if (statusEl) statusEl.textContent = debugLogEnabled ? 'Logger...' : 'Klar';
        appSettings.debugLog = debugLogEnabled;
        saveSettings(appSettings);
    });

    // Debug log download, screenshot and clear buttons
    document.getElementById('debugLogDownload').addEventListener('click', debugDownloadLog);
    document.getElementById('debugScreenshot').addEventListener('click', debugDownloadScreenshot);
    document.getElementById('debugLogClear').addEventListener('click', () => {
        debugLogData = [];
        debugLogLastTime = -Infinity;
        const countEl = document.getElementById('debugLogCount');
        if (countEl) countEl.textContent = '0 rækker';
    });

    // "Clear all local data" — deletes everything stored in localStorage for the T1D simulator
    document.getElementById('debugClearAll').addEventListener('click', () => {
        if (!confirm(t('debug.clearAll.confirm'))) return;
        // Delete all known keys
        localStorage.removeItem('t1dSimSettings');
        localStorage.removeItem('t1dSimHighscores');
        localStorage.removeItem('diabetesDystenProfile');
        localStorage.removeItem('disclaimerAccepted');
        localStorage.removeItem('t1dSimCampaignProgress');
        localStorage.removeItem('t1d_viewportNoticeShown');
        localStorage.removeItem('t1dWelcomeTourShowOnStartup');
        localStorage.removeItem('t1dWelcomeTourCompleted');
        // Reload the page so everything starts from scratch
        location.reload();
    });

    // =========================================================================
    // DOCK PANEL SYSTEM — Clicking dock items opens/closes fold-up panels
    // =========================================================================

    // Add click handler to all dock items that have a data-panel attribute
    document.querySelectorAll('.dock-item[data-panel]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents the click-outside handler from closing the panel
            toggleDockPanel(item.dataset.panel);
        });
    });

    // Click outside an open panel: close it
    // Uses event delegation on game-container for performance
    document.getElementById('game-container').addEventListener('click', (e) => {
        // Check whether the click landed inside a dock panel or dock item
        if (e.target.closest('.dock-panel') || e.target.closest('.dock-item')) {
            return; // Let the panel/dock item handle it itself
        }
        closeDockPanels();
    });

    // Prevents clicks inside dock panels from bubbling up and closing the panel
    document.querySelectorAll('.dock-panel').forEach(panel => {
        panel.addEventListener('click', (e) => e.stopPropagation());
    });

    // =========================================================================
    // SIDE DRAWER TAB — Debug drawer opened/closed via tab
    // (Stats drawer removed — replaced by stats fragment in the capsule bar)
    // =========================================================================
    const debugDrawerTab = document.getElementById('debugDrawerTab');
    if (debugDrawerTab) {
        debugDrawerTab.addEventListener('click', () => toggleSideDrawer('debug-sidebar'));
    }

    // Event log is now always visible (no toggle needed)

    // =========================================================================
    // "BUILD YOUR OWN" — Open custom food panel branching from the food panel
    // =========================================================================
    const customFoodToggle = document.getElementById('customFoodToggle');
    if (customFoodToggle) {
        customFoodToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            showCustomFoodPanel();
        });
    }

    // Custom food sliders and eat button
    const customCarbsSlider = document.getElementById('customCarbsSlider');
    const customProteinSlider = document.getElementById('customProteinSlider');
    const customFatSlider = document.getElementById('customFatSlider');
    const customCarbsVal = document.getElementById('customCarbsVal');
    const customProteinVal = document.getElementById('customProteinVal');
    const customFatVal = document.getElementById('customFatVal');
    const customKcalDisplay = document.getElementById('customKcalDisplay');
    const customFoodEatButton = document.getElementById('customFoodEat');
    const customFoodControls = [
        customCarbsSlider, customProteinSlider, customFatSlider,
        customCarbsVal, customProteinVal, customFatVal,
        customKcalDisplay, customFoodEatButton
    ];

    // "Lav selv" er et ekstra panel. En browser kan kortvarigt have nyere JavaScript
    // sammen med en ældre cachet HTML-fil under en opdatering. I den situation må det
    // valgfrie panel ikke afbryde resten af appens initialisering.
    if (customFoodControls.every(Boolean)) {
        // Den valgte kulhydrattype gemmes lokalt, så spis-handlingen kan læse den.
        // Standardværdien "mixed" svarer til et addFood-kald uden carbType.
        let customSelectedCarbType = 'mixed';
        document.querySelectorAll('#customCarbTypeChips .carb-type-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                customSelectedCarbType = chip.dataset.carbType || 'mixed';
                // Toggle selected class so only the clicked chip is highlighted
                document.querySelectorAll('#customCarbTypeChips .carb-type-chip').forEach(c =>
                    c.classList.toggle('selected', c === chip)
                );
            });
        });

        function updateCustomFoodDisplay() {
            const c = parseInt(customCarbsSlider.value);
            const p = parseInt(customProteinSlider.value);
            const f = parseInt(customFatSlider.value);
            customCarbsVal.textContent = c;
            customProteinVal.textContent = p;
            customFatVal.textContent = f;
            customKcalDisplay.textContent = (c * 4 + p * 4 + f * 9).toFixed(0);
        }
        [customCarbsSlider, customProteinSlider, customFatSlider].forEach(slider =>
            slider.addEventListener('input', updateCustomFoodDisplay)
        );
        updateCustomFoodDisplay();

        customFoodEatButton.addEventListener('click', () => {
            if (game) {
                const cc = parseInt(customCarbsSlider.value);
                const cp = parseInt(customProteinSlider.value);
                const cf = parseInt(customFatSlider.value);
                // Makroerne udgør omtrent 40 % af måltidets vægt. Resten er vand og fibre.
                const customWeight = Math.round((cc + cp + cf) / 0.4);
                if (!game.addFood(cc, cp, cf, '\u{1F372}', customWeight, customSelectedCarbType)) return;
                flyIconToGraph('\u{1F372}', 'dock-panel-custom-food');
            }
            closeDockPanels();
        });
    } else {
        console.warn('Lav selv-panelet kunne ikke initialiseres; resten af appen fortsætter.');
    }

    // =========================================================================
    // INTENSITY CHIPS — Click switches intensity
    // =========================================================================
    document.querySelectorAll('.intensity-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Block click if the chip is locked (campaign-disabled — e.g. level 7 lockedIntensity)
            if (chip.classList.contains('campaign-disabled')) return;
            // Remove 'selected' from all chips
            document.querySelectorAll('.intensity-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            // Update the hidden select
            motionIntensitySelect.value = chip.dataset.intensity;
            updateActivityExamples();
            updateMotionKcal();
        });
    });


    // =========================================================================
    // SETTINGS DROPDOWN — Combined settings menu in the top-right
    // =========================================================================
    const settingsBtn = document.getElementById('topSettingsButton');
    const settingsDropdown = document.getElementById('settingsDropdown');

    // Open/close dropdown
    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close hamburger menu if it is open
            const mm = document.getElementById('mobileMenu');
            if (mm) mm.classList.remove('visible');
            const insights = document.getElementById('insightsDropdown');
            if (insights) insights.classList.remove('visible');
            const isVisible = settingsDropdown.classList.contains('visible');
            settingsDropdown.classList.toggle('visible');
            // Synchronise toggles on open
            if (!isVisible) {
                syncPhysiologyToggles();
                syncSettingsToggles();
            }
            playSound(isVisible ? 'menuClose' : 'menuOpen');
        });
        settingsDropdown.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            settingsDropdown.classList.remove('visible');
        });
    }

    // Language selection: DA/EN via language cards in settings dropdown
    function updateLangCards() {
        const isDa = appSettings.language === 'da';
        const daCard = document.getElementById('langOptionDA');
        const enCard = document.getElementById('langOptionEN');
        if (daCard) daCard.classList.toggle('selected', isDa);
        if (enCard) enCard.classList.toggle('selected', !isDa);
    }
    const langDA = document.getElementById('langOptionDA');
    const langEN = document.getElementById('langOptionEN');
    if (langDA) {
        langDA.addEventListener('click', (e) => {
            e.stopPropagation();
            appSettings.language = 'da';
            saveSettings(appSettings);
            translateDOM();
            updateFoodChips();
            updateLangCards();
            _lastEffectsData = [];  // Force BG forces to re-render in Danish
            const iobUnit = document.getElementById('iobUnitLabel');
            if (iobUnit) iobUnit.textContent = 'E';
        });
    }
    if (langEN) {
        langEN.addEventListener('click', (e) => {
            e.stopPropagation();
            appSettings.language = 'en';
            saveSettings(appSettings);
            translateDOM();
            updateFoodChips();
            updateLangCards();
            _lastEffectsData = [];  // Force BG forces to re-render in English
            const iobUnit = document.getElementById('iobUnitLabel');
            if (iobUnit) iobUnit.textContent = 'U';
        });
    }
    updateLangCards();

    // BG unit selection: mmol/L or mg/dL via cards in settings dropdown
    function updateBgUnitCards() {
        const isMmol = appSettings.bgUnit !== 'mg';
        const mmolCard = document.getElementById('bgUnitMmol');
        const mgCard = document.getElementById('bgUnitMg');
        if (mmolCard) mmolCard.classList.toggle('selected', isMmol);
        if (mgCard) mgCard.classList.toggle('selected', !isMmol);
    }
    function applyBgUnit() {
        saveSettings(appSettings);
        updateBgUnitCards();
        // Update CGM unit label in the capsule bar
        const unitLabel = document.getElementById('cgmUnitLabel');
        if (unitLabel) unitLabel.textContent = bgUnitLabel();
        // Update TIR tooltip with correct units
        const tirRow = document.getElementById('statsTirRow');
        if (tirRow) tirRow.title = t('stats.tooltip.tir', bgVars());
        // Redraw the graph with the new units
        drawGraph();
    }
    const bgMmolBtn = document.getElementById('bgUnitMmol');
    const bgMgBtn = document.getElementById('bgUnitMg');
    if (bgMmolBtn) {
        bgMmolBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appSettings.bgUnit = 'mmol';
            applyBgUnit();
        });
    }
    if (bgMgBtn) {
        bgMgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appSettings.bgUnit = 'mg';
            applyBgUnit();
        });
    }
    updateBgUnitCards();
    // Set CGM unit label on initialisation
    const cgmUnitInit = document.getElementById('cgmUnitLabel');
    if (cgmUnitInit) cgmUnitInit.textContent = bgUnitLabel();

    // Fullscreen toggle in Settings — replaces the old fullscreen button
    const fullscreenSettingsToggle = document.getElementById('fullscreenSettingsToggle');
    const fullscreenSettingsRow = fullscreenSettingsToggle ? fullscreenSettingsToggle.closest('.sd-row') : null;
    if (fullscreenSettingsRow) {
        fullscreenSettingsRow.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }
    // Synchronise fullscreen toggle when the user presses Escape or the browser changes
    document.addEventListener('fullscreenchange', () => {
        const fsToggle = document.getElementById('fullscreenSettingsToggle');
        if (fsToggle) fsToggle.classList.toggle('active', !!document.fullscreenElement);
    });

    // Life bars toggle — click on row (show/hide brain/acidosis/weight bars in capsule)
    const lifeBarsToggle = document.getElementById('lifeBarsToggle');
    const lifeBarsRow = lifeBarsToggle ? lifeBarsToggle.closest('.sd-row') : null;
    if (lifeBarsRow) {
        lifeBarsRow.addEventListener('click', () => {
            appSettings.showLifeBars = !appSettings.showLifeBars;
            const panel = document.getElementById('life-bars-panel');
            if (panel) panel.style.display = appSettings.showLifeBars ? 'flex' : 'none';
            lifeBarsToggle.classList.toggle('active', appSettings.showLifeBars);
            saveSettings(appSettings);
        });
    }

    // Stats fragment toggle — click on row (show/hide TIR/avg BG/weight in capsule)
    const statsFragmentToggle = document.getElementById('statsFragmentToggle');
    const statsFragmentRow = statsFragmentToggle ? statsFragmentToggle.closest('.sd-row') : null;
    if (statsFragmentRow) {
        statsFragmentRow.addEventListener('click', () => {
            appSettings.showStatsFragment = !appSettings.showStatsFragment;
            const frag = document.getElementById('stats-fragment');
            if (frag) frag.style.display = appSettings.showStatsFragment ? '' : 'none';
            statsFragmentToggle.classList.toggle('active', appSettings.showStatsFragment);
            saveSettings(appSettings);
        });
    }

    // Physiology window toggle — click on row
    const dashboardToggle = document.getElementById('dashboardToggle');
    const dashboardRow = dashboardToggle ? dashboardToggle.closest('.sd-row') : null;
    if (dashboardRow) {
        dashboardRow.addEventListener('click', () => {
            if (!physiologyWindow || physiologyWindow.closed) {
                const openDashboard = () => {
                    openPhysiologyDashboard();
                    appSettings.physiologyDashboard = true;
                    if (game) trainingModeUsedThisSession = true;
                    saveSettings(appSettings);
                    syncPhysiologyToggles();
                };

                if (!trainingModeUsedThisSession) {
                    showPhysiologyConfirmDialog(openDashboard);
                    return;
                }

                openDashboard();
            } else {
                physiologyWindow.close();
                physiologyWindow = null;
                appSettings.physiologyDashboard = false;
                saveSettings(appSettings);
                syncPhysiologyToggles();
            }
        });
    }

    function removeVisibleTipsByScope(scope) {
        if (!game || !Array.isArray(game.graphMessages)) return;
        const removedIds = new Set();
        game.graphMessages = game.graphMessages.filter(message => {
            const isTip = message.isGameTip || message.isTutorialTip;
            if (!isTip) return true;

            const id = String(message.id || '');
            const messageScope = message.tipScope || (id.includes('global_') ? 'global' : 'level');
            if (messageScope !== scope) return true;

            removedIds.add(id);
            return false;
        });

        document.querySelectorAll('.graph-tip-guide-link').forEach(button => {
            if (removedIds.has(button.dataset.guideMessageId)) button.remove();
        });

        if (typeof drawGraph === 'function') drawGraph();
    }

    // Master tips toggle — one switch for ALL tips: level.tips + tutorial popups AND
    // the global gameplay/UI hints (GLOBAL_TIPS). Both flags move together; the toggle
    // reads as on when any tips are enabled. Default true. Click the whole row for a
    // larger click target.
    const tipsToggle = document.getElementById('tipsToggle');
    const tipsRow = tipsToggle ? tipsToggle.closest('.sd-row') : null;
    if (tipsRow) {
        tipsRow.addEventListener('click', () => {
            const currentlyOn = (appSettings.levelTipsEnabled !== false) || (appSettings.globalTipsEnabled !== false);
            const next = !currentlyOn;
            appSettings.levelTipsEnabled = next;
            appSettings.globalTipsEnabled = next;
            tipsToggle.classList.toggle('active', next);
            saveSettings(appSettings);
            if (!next) { removeVisibleTipsByScope('level'); removeVisibleTipsByScope('global'); }
        });
    }

    // VFX toggle — click on row in the physiology section
    const vfxToggleBtn = document.getElementById('vfxToggle');
    const vfxRow = vfxToggleBtn ? vfxToggleBtn.closest('.sd-row') : null;
    if (vfxRow) {
        vfxRow.addEventListener('click', () => {
            vfxEnabled = !vfxEnabled;
            localStorage.setItem('vfxEnabled', vfxEnabled);
            syncSettingsToggles();
        });
    }

    // Debug toggle — controls whether the debug tab is visible (on/off).
    // When turned on, the tab is shown but the drawer starts closed.
    // When turned off, the drawer is closed and the tab is hidden entirely.
    const debugToggleBtn = document.getElementById('debugToggle');
    const debugRow = debugToggleBtn ? debugToggleBtn.closest('.sd-row') : null;
    if (debugRow) {
        debugRow.addEventListener('click', () => {
            const debugSB = document.getElementById('debug-sidebar');
            const isEnabled = appSettings.debugEnabled;
            appSettings.debugEnabled = !isEnabled;
            saveSettings(appSettings);
            if (!isEnabled) {
                // Turn on: show tab (drawer stays closed)
                if (debugSB) debugSB.classList.remove('debug-hidden');
            } else {
                // Turn off: close drawer and hide tab
                if (debugSB) {
                    debugSB.classList.remove('open');
                    debugSB.classList.add('debug-hidden');
                }
                appSettings.debugOpen = false;
                saveSettings(appSettings);
            }
            syncSettingsToggles();
            setTimeout(sizeCanvas, 380);
        });
    }

    // Synchronise all settings toggles (VFX, Debug)
    function syncSettingsToggles() {
        // VFX toggle
        const vfxT = document.getElementById('vfxToggle');
        if (vfxT) vfxT.classList.toggle('active', vfxEnabled);
        // Debug toggle — reflects whether the debug tab is visible (enabled), not whether it is open
        const debugT = document.getElementById('debugToggle');
        if (debugT) debugT.classList.toggle('active', appSettings.debugEnabled);
    }

    // =========================================================================
    // KEYBOARD SHORTCUTS — RTS-style chord system
    // =========================================================================
    // First key opens a panel (Z=insulin, X=food, C=exercise, V=tests).
    // Second key executes an action — works BOTH as a chord (quick ZZ)
    // AND as a single press when the panel is already open.
    //
    // Insulin (Z): Z/X/C = 1/2/4 U rapid, A/S/D = basal presets, V/F = custom
    // Food (X):    Grid layout — bottom row: Z=Dextro(hypo!) X=Soda C=Apple V=Oats B=Burger
    //              Top row: A=Cake S=Salad D=Avocado F=Chicken G=Build own
    // Tests (V):   Z = finger prick, X = ketone test
    // =========================================================================
    let chordFirstKey = null;      // First key in chord sequence
    let chordTimeout = null;       // Timer to reset chord
    const CHORD_TIMEOUT_MS = 600;  // Time to press 2nd key (ms)

    // Helper: check whether a specific panel is open
    function isPanelOpen(panelId) {
        const panel = document.getElementById(panelId);
        return panel && panel.classList.contains('visible');
    }

    // Execute a sub-action for an open panel
    function executeSubAction(key) {
        if (!game) return false;

        // --- Insulin panel open ---
        // Rapid: Z=½U, X=1U, C=2U, V=4U, B=8U, N=custom slider
        // Basal:  A-G = the five basal preset chips (coarse dose ladder), H=custom slider
        // Each branch respects campaign action gating: if fastInsulin is
        // disabled in the active level, Z/X/C/V/B/N are blocked (same for basal).
        if (isPanelOpen('dock-panel-insulin')) {
            const fastBlocked = campaignEngine && !campaignEngine.isActionAllowed('fastInsulin');
            const basalBlocked = campaignEngine && !campaignEngine.isActionAllowed('basalInsulin');
            if (!fastBlocked) {
                if (key === 'z') { game.addFastInsulin(0.5); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
                if (key === 'x') { game.addFastInsulin(1); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
                if (key === 'c') { game.addFastInsulin(2); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
                if (key === 'v') { game.addFastInsulin(4); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
                if (key === 'b') { game.addFastInsulin(8); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
                if (key === 'n') { game.addFastInsulin(parseFloat(fastInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast'); return true; }
            }
            if (!basalBlocked) {
                // A/S/D/F/G map to the five basal preset chips — same doses as the
                // chips show and the click handlers give (getBasalPresetDoses, ui.js).
                if (key === 'a') { game.addLongInsulin(getBasalPresetDoses()[0]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
                if (key === 's') { game.addLongInsulin(getBasalPresetDoses()[1]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
                if (key === 'd') { game.addLongInsulin(getBasalPresetDoses()[2]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
                if (key === 'f') { game.addLongInsulin(getBasalPresetDoses()[3]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
                if (key === 'g') { game.addLongInsulin(getBasalPresetDoses()[4]); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
                if (key === 'h') { game.addLongInsulin(parseInt(longInsulinSlider.value)); flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'basal'); return true; }
            }
        }

        // --- Food panel open ---
        // 3 rows organised by carbohydrate profile. Keyboard follows the rows:
        //   Row 1 (Q-Y): Low-carb — eggs, nuts, salad, salmon-avocado, egg-bacon, steak-béarnaise
        //   Row 2 (A-H): Meals    — rye bread, oats, white bread, pasta, pizza, layer cake
        //   Row 3 (Z-N): Snacks   — dextrose, sweets, juice, cola, banana, chocolate
        //   P:           Build own (custom popup)
        // Mapping looks up FOOD_KEY_MAP and calls addFoodFromKey() which finds
        // all macros + carbType in the FOODS table (js/foods.js).
        if (isPanelOpen('dock-panel-food')) {
            const FOOD_KEY_MAP = {
                // Row 1 — Low-carb
                q: 'æg', w: 'nødder', e: 'salat', r: 'laksAvocado', t: 'ægBacon', y: 'bøfBearnaise',
                // Row 2 — Meals
                a: 'bollerIKarry', s: 'havregryn', d: 'burger',
                f: 'pasta', g: 'pizza', h: 'lagkage',
                // Row 3 — Fast carbs
                z: 'druesukker', x: 'slik', c: 'juice',
                v: 'cola', b: 'banan', n: 'chokolade',
            };
            if (FOOD_KEY_MAP[key]) { addFoodFromKey(FOOD_KEY_MAP[key]); return true; }
            if (key === 'p') {
                // Respect campaign-disabled on the custom column — the P shortcut must not
                // bypass gating when the level only allows presets (e.g. levels 1 and 2).
                const customCol = document.querySelector('.preset-custom-column');
                if (customCol && customCol.classList.contains('campaign-disabled')) return true;
                showCustomFoodPanel();
                return true;
            }
        }

        // --- Activity panel open ---
        // Type:      Q=Cardio, W=Strength, E=Mixed
        // Intensity: A=Low, S=Medium, D=High
        // Start (duration): Z=15 min, X=30 min, C=60 min, V=Open
        // Stop (when active): Z=Stop
        if (isPanelOpen('dock-panel-motion')) {
            // If activity is active: Z = stop
            if (game.activeAktivitet) {
                if (key === 'z') { game.stopAktivitet(); hideActivityActive(); return true; }
                return false; // No other shortcuts while an activity is active
            }
            // Type selection (QWE)
            const typeMap = { q: 'cardio', w: 'styrke', e: 'blandet' };
            if (typeMap[key]) {
                const chip = document.querySelector(`.activity-type-chip[data-type="${typeMap[key]}"]`);
                if (chip) chip.click();
                return true;
            }
            // Intensity selection (ASD)
            const intMap = { a: 'Lav', s: 'Medium', d: 'Høj' };
            if (intMap[key]) {
                const chip = document.querySelector(`.intensity-chip[data-intensity="${intMap[key]}"]`);
                if (chip) chip.click();
                return true;
            }
            // Start with duration (ZXCV)
            const durMap = { z: 15, x: 30, c: 60, v: null };
            if (key in durMap) {
                startActivityWithDuration(durMap[key]);
                return true;
            }
            return false;
        }

        // --- Diabetes kit panel open ---
        // Z=Finger prick, X=Ketone test, C=Glucagon, V=Dextrose
        if (isPanelOpen('dock-panel-kit')) {
            if (key === 'z') { game.performFingerprick(); flyIconToGraph('\u{1FA78}', 'dock-panel-kit'); return true; }
            if (key === 'x') { game.performKetoneTest(); flyIconToGraph('\u{1F9EA}', 'dock-panel-kit'); return true; }
            if (key === 'c') { triggerGlucagonSOS(); return true; }
            if (key === 'v') {
                if (typeof FOODS !== 'undefined') {
                    const f = FOODS.druesukker;
                    if (game.addFood(f.carbs, f.protein, f.fat, f.icon, f.weight, f.carbType, f.eatTimeMin)) {
                        flyIconToGraph(f.icon, 'dock-panel-kit');
                    }
                }
                return true;
            }
        }

        return false;
    }

    document.addEventListener('keydown', (e) => {
        // Ignore shortcuts when input fields or selects have focus
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        // Welcome popup and intro tour have their own navigation. Global
        // Genveje (især Mellemrum = start nyt spil) må ikke åbne formålsinformationen eller
        // start flow behind the tour.
        if (document.body.classList.contains('welcome-tour-running') || document.querySelector('.welcome-tour-overlay')) {
            return;
        }

        const key = e.key.toLowerCase();

        // Space and Escape always work directly (no chord)
        if (key === ' ') {
            e.preventDefault();
            if (game && !game.isGameOver) {
                togglePause();
            } else if (!game || game.isGameOver) {
                // Intet spil kører → start nyt (med formålsinformation + valg af tilstand)
                showNormalStartFlow();
            }
            return;
        }
        if (key === 'escape') {
            // Close popup overlay if one is open (profile, help, highscore, etc.)
            const popup = document.querySelector('.popup-overlay');
            if (popup) { popup.remove(); }
            closeDockPanels();
            chordFirstKey = null;
            return;
        }

        // Arrow keys: ← slower, → faster (cycle through speed options)
        if (key === 'arrowright' || key === 'arrowleft') {
            e.preventDefault();
            changeSpeed(key === 'arrowright' ? 1 : -1);
            return;
        }

        // Number keys 1-9: direct shortcut for rapid insulin at that dose
        // ½ (Danish keyboard) gives 0.5 U
        // Respects campaign restrictions: fastInsulin gating and maxBolusDose.
        if (game && (key >= '1' && key <= '9' || key === '½')) {
            // Block entirely if rapid insulin is disabled in the level
            if (campaignEngine && !campaignEngine.isActionAllowed('fastInsulin')) {
                chordFirstKey = null;
                return;
            }
            e.preventDefault();
            const dose = key === '½' ? 0.5 : parseInt(key);
            // Check maxBolusDose restriction
            const maxDose = (campaignEngine && campaignEngine.getMaxBolusDose) ? campaignEngine.getMaxBolusDose() : Infinity;
            if (dose > maxDose) { chordFirstKey = null; return; }
            game.addFastInsulin(dose);
            flyIconToGraph('\u{1F489}', 'dock-panel-insulin', 'fast');
            chordFirstKey = null;
            return;
        }

        // --- Chord 2nd key (fast sequence, e.g. ZZ) ---
        if (chordFirstKey) {
            e.preventDefault();
            chordFirstKey = null;
            if (chordTimeout) { clearTimeout(chordTimeout); chordTimeout = null; }
            // Panel was opened by 1st key; now execute sub-action
            executeSubAction(key);
            return;
        }

        // --- Panel already open: single-key sub-action ---
        // When the panel is visible only one key press is needed.
        // Includes B (banana in food panel / 8 U rapid insulin),
        // N (custom slider for rapid insulin / chocolate in food panel)
        // and H (custom slider for basal / layer cake in food panel).
        if (['z', 'x', 'c', 'v', 'a', 's', 'd', 'f', 'b', 'g', 'q', 'w', 'e', 'r', 't', 'h', 'n'].includes(key)) {
            // Try sub-action first (if relevant panel is open)
            if (executeSubAction(key)) {
                e.preventDefault();
                return;
            }
        }

        // --- First key: open panel + start chord timer ---
        if (['z', 'x', 'c', 'v'].includes(key)) {
            e.preventDefault();
            const panelMap = { z: 'dock-panel-insulin', x: 'dock-panel-food', c: 'dock-panel-motion', v: 'dock-panel-kit' };
            toggleDockPanel(panelMap[key]);

            // Start chord timer for fast sequence
            chordFirstKey = key;
            chordTimeout = setTimeout(() => { chordFirstKey = null; }, CHORD_TIMEOUT_MS);
        }
    });

    // --- Restore physiology mode from localStorage ---
    // The physiology button controls all of these as one package.
    // Check if ANY of the physiology settings were active → restore the whole package.
    const physiologyWasActive = appSettings.showInsulinBand || appSettings.showCarbBand
        || appSettings.showISFLine || appSettings.showKetoneLine || appSettings.physiologyEffects;
    if (physiologyWasActive) {
        activatePhysiologyMode(true);
    }
    // Life bars: hidden by default, shown only if the setting is enabled
    const lifeBarsPanel = document.getElementById('life-bars-panel');
    if (lifeBarsPanel) {
        lifeBarsPanel.style.display = appSettings.showLifeBars ? 'flex' : 'none';
    }
    const lifeBarsToggleInit = document.getElementById('lifeBarsToggle');
    if (lifeBarsToggleInit && appSettings.showLifeBars) {
        lifeBarsToggleInit.classList.add('active');
    }

    // Stats fragment: shown by default (showStatsFragment=true), hidden if disabled
    const statsFragmentEl = document.getElementById('stats-fragment');
    if (statsFragmentEl) {
        statsFragmentEl.style.display = appSettings.showStatsFragment ? '' : 'none';
    }
    const statsFragmentToggleInit = document.getElementById('statsFragmentToggle');
    if (statsFragmentToggleInit && appSettings.showStatsFragment) {
        statsFragmentToggleInit.classList.add('active');
    }

    syncPhysiologyToggles();
    if (appSettings.physiologyDashboard) {
        openPhysiologyDashboard();
        syncPhysiologyToggles();
    }

    // Tips toggle init — active when any tips are enabled (default true).
    const tipsToggleInit = document.getElementById('tipsToggle');
    if (tipsToggleInit && ((appSettings.levelTipsEnabled !== false) || (appSettings.globalTipsEnabled !== false))) {
        tipsToggleInit.classList.add('active');
    }

    // --- Restore side drawer state from localStorage ---

    // Debug sidebar: hide entirely if debugEnabled is false (default).
    // If enabled AND was open: reopen. Otherwise show the tab but keep the drawer closed.
    const debugSidebar = document.getElementById('debug-sidebar');
    if (debugSidebar) {
        if (!appSettings.debugEnabled) {
            debugSidebar.classList.add('debug-hidden');
        } else {
            debugSidebar.classList.remove('debug-hidden');
            if (appSettings.debugOpen) debugSidebar.classList.add('open');
        }
    }
    // (Stats drawer removed — only debug drawer is used now)

    // True BG line
    if (debugTrueBgCheckbox) debugTrueBgCheckbox.checked = appSettings.debugTrueBG;
    const unlockAllToggleEl = document.getElementById('debugUnlockAllLevelsToggle');
    if (unlockAllToggleEl) unlockAllToggleEl.classList.toggle('active', !!appSettings.debugUnlockAllLevels);

    // CSV logging
    const debugLogCheckboxEl = document.getElementById('debugLogCheckbox');
    if (debugLogCheckboxEl && appSettings.debugLog) {
        debugLogCheckboxEl.checked = true;
        debugLogEnabled = true;
        const ctrl = document.getElementById('debugLogControls');
        if (ctrl) ctrl.style.display = 'flex';
        const statusEl = document.getElementById('debugLogStatus');
        if (statusEl) statusEl.textContent = 'Logger...';
    }
}


// =============================================================================
// APP INITIALISATION — Run initializeApp when the DOM is ready
// =============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Resize canvas when the window is resized
window.addEventListener('resize', sizeCanvas);

// Small-viewport popup — shown once on the start screen on displays narrower than 1024 px
(function showViewportPopup() {
    if (window.innerWidth >= 1024) return;
    if (localStorage.getItem('t1d_viewportNoticeShown')) return;
    // Don't nag a user who explicitly chose desktop (via this popup or the mobile "switch
    // to desktop" link) — that choice already means they don't want the mobile version.
    if (localStorage.getItem('t1d_platform') === 'desktop') return;

    const popup = document.createElement('div');
    popup.className = 'viewport-popup';
    popup.innerHTML = `
        <span class="viewport-popup-icon"><img class="viewport-popup-icon-img" src="assets/icons/app/switch-to-mobile.png" alt=""></span>
        <p class="viewport-popup-title">${t('viewport.title')}</p>
        <p class="viewport-popup-msg">${t('viewport.message')}</p>
        <div class="viewport-popup-actions">
            <button id="viewportSwitch" class="viewport-popup-primary">${t('viewport.switch')}</button>
            <button id="viewportStay">${t('viewport.stay')}</button>
        </div>
    `;
    document.body.appendChild(popup);

    function dismissPopup() {
        localStorage.setItem('t1d_viewportNoticeShown', '1');
        popup.remove();
    }

    // "Switch to mobile" — remember the choice so the root auto-redirects next time too.
    document.getElementById('viewportSwitch').addEventListener('click', () => {
        try { localStorage.setItem('t1d_platform', 'mobile'); } catch (e) {}
        location.replace('mobile/');
    });

    // "Stay on desktop" — record the preference so the auto-redirect never fires on this
    // device, then dismiss the popup. We are already on desktop, so no navigation.
    document.getElementById('viewportStay').addEventListener('click', () => {
        try { localStorage.setItem('t1d_platform', 'desktop'); } catch (e) {}
        dismissPopup();
    });

    // Dismiss popup automatically when the player clicks Start (leaves the start screen)
    const sb = document.getElementById('startButton');
    if (sb) sb.addEventListener('click', () => { if (popup.parentNode) dismissPopup(); }, { once: true });
})();
