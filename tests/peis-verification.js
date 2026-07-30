// =============================================================================
// PEIS-VERIFICATION-EKSPERIMENT
// =============================================================================
//
// Formaal: Sample Resist.-linjens (1/sensitivityIncreaseFactor) tidsforløb før,
// under og efter Cardio Medium 30 min, og sammenligne mod literaturværdier
// (Mikines 1988: ~25% effekt ved 48 t).
//
// Eksperimentet køres i to scenarier:
//   (A) Ingen post-motion CHO (faste-recovery)
//   (B) Standard CHO-måltid 1 t efter motion-slut
//
// Output: CSV til stdout med kolonner:
//   scenario, t_min, t_post_h, currentISF_ratio, sensFactor, slowEmptyFactor, glycogenReserve, BG, IOB
//
// Kør: tests/.bin/node.exe tests/peis-verification.js > peis-output.csv
// =============================================================================

const { Simulator } = require('./harness.js');

// --- Mock browser environment ---
function mockElement() {
    const el = {
        textContent: '', innerHTML: '', value: '60', disabled: false,
        style: { display: 'none', setProperty: () => {}, removeProperty: () => {} },
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        addEventListener: () => {}, removeEventListener: () => {},
        getBoundingClientRect: () => ({ width: 800, height: 400 }),
        querySelector: () => mockElement(), querySelectorAll: () => [],
        closest: () => null, appendChild: () => {}, removeChild: () => {}, remove: () => {},
        setAttribute: () => {}, getAttribute: () => null, children: [], parentElement: null
    };
    return el;
}

const domGlobals = [
    'startButton','resetButton','helpButton','pauseButton','speedSelector',
    'dayDisplay','timeDisplay','cgmValueDisplayGraph','normoPointsDisplay','normoPointsWeighting',
    'muteButton','carbsSlider','carbsValue','proteinSlider','proteinValue','fatSlider','fatValue',
    'giveFoodButton','foodInfoDisplay','foodKcalDisplay',
    'dextroButton','pizzaButton','pastaButton','cakeButton','iceButton','chocolateButton',
    'breadButton','cerealButton','meatButton','cheeseButton','avocadoButton','appleButton',
    'juiceButton','saladButton','fastInsulinSlider','fastInsulinValue','giveFastInsulinButton',
    'longInsulinSlider','longInsulinValue','giveLongInsulinButton',
    'motionIntensitySelect','motionDurationSelect','startMotionButton','motionKcalDisplay',
    'fingerprickButton','ketoneTestButton','glucagonButton',
    'debugTrueBgCheckbox','iobDisplay','cobDisplay','bgGraphCanvas','graphCtx',
    'weightChangeSlider','weightChangeValue','steepDropWarningDiv','lastBolusTimerDisplay',
    'kitGlucagonButton','statsBgValue','statsTirValue','statsCobValue','statsIobValue',
    'statsHbA1cValue','statsBmiValue'
];
domGlobals.forEach(name => { global[name] = mockElement(); });

global.window = { _nightPopActiveUntil: 0, opener: null };
global.document = {
    getElementById: () => mockElement(),
    querySelector: () => mockElement(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { appendChild: () => {} }
};
global.navigator = { language: 'da-DK' };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.cancelAnimationFrame = () => {};
global.playSound = () => {};
global.flyIconToGraph = () => {};
global.logEvent = () => {};
global.showCustomNotification = () => {};
global.updateUI = () => {};
global.drawGraph = () => {};
global.updateBoxChallengeUI = () => {};
global.showGameOverPopup = () => {};
global.endGame = () => {};
global.activateRestartButton = () => {};
global.gameOver = () => { global.isPaused = true; };
global.formatBG = (v) => v.toFixed(1);
global.formatTime = (m) => `${Math.floor(m/60)}:${String(Math.floor(m%60)).padStart(2,'0')}`;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// Globale arrays brugt af simulator
global.cgmDataPoints = [];
global.trueBgPoints = [];
global.physiologyDataPoints = [];
global.activityHistoryPoints = [];
global.medicationPoints = [];
global.foodPoints = [];
global.activityIcons = [];
global.eventLog = [];
global.isPaused = false;
global.game = null;
global.MAX_GRAPH_POINTS_PER_DAY = 288;
global.MAX_PHYSIOLOGY_POINTS = 5000;
global.KCAL_PER_KG_WEIGHT = 7700;
global.DEBUG_LOG_INTERVAL = 5;

// Mock i18n for tooltip-strenge etc.
global.t = (key) => key;
global.currentLanguage = 'da';
global.translations = { da: {}, en: {} };

// =============================================================================
// EXPERIMENT
// =============================================================================

function createSim() {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;

    const sim = new Simulator();
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;

    sim.trueBG = 5.5;
    sim.cgmBG = 5.5;
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;

    sim.hovorka.state[4] = 5.5 * sim.hovorka.V_G;
    sim.hovorka.insulinRate = 0;

    // Start kl. 12:00 så motion 30 min ikke krydser midnat før vi når 48 t post
    sim.totalSimMinutes = 12 * 60;
    sim.timeInMinutes = 12 * 60;

    return sim;
}

// Avancér sim ved at kalde update(1.0) — 1 sec real = 1 sim min ved speed=60
function advanceMinutes(sim, mins) {
    sim.simulationSpeed = 60;
    for (let i = 0; i < mins; i++) {
        sim.update(1.0);
    }
}

// Hent state-snapshot
function snapshot(sim) {
    const baseISF = sim.ISF;
    const curISF = sim.currentISF;
    const ratio = baseISF / curISF;  // = 1/sensFactor for "Resist line"-konvention
    const sensFactor = curISF / (baseISF * sim.circadianISF);  // approx — uden combined resistance
    return {
        t: sim.totalSimMinutes,
        BG: sim.trueBG,
        IOB: sim.iob,
        currentISF: curISF,
        baseISF: baseISF,
        circadianISF: sim.circadianISF,
        resistRatio: ratio,
        sensFactorApprox: sensFactor,
        glycogenReserve: sim.muscleGlycogenReserve,
        slowEmptyFactor: 1 - sim.muscleGlycogenReserve,
        cob: sim.cob,
    };
}

function runScenario(label, withCHO) {
    const sim = createSim();

    const records = [];
    const tStart = sim.totalSimMinutes;

    // Pre-motion baseline: 5 min stabilization
    advanceMinutes(sim, 5);
    records.push({ scenario: label, label: 'pre-exercise', tPost_h: -0.083, ...snapshot(sim) });

    // Start Cardio Medium 30 min
    sim.startAktivitet('cardio', 'Medium', 30);

    // Sample under motion: 1, 5, 10, 15, 30 min
    const duringSamples = [1, 5, 10, 15, 30];
    let lastT = 0;
    for (const t of duringSamples) {
        advanceMinutes(sim, t - lastT);
        lastT = t;
        records.push({
            scenario: label, label: `during-${t}min`,
            tPost_h: -((30 - t) / 60),  // negativ = stadig under motion
            ...snapshot(sim)
        });
    }

    // Motion er nu sluttet (efter 30 min). Verify
    // sim.activeAktivitet bør være null nu.

    // Post-exercise sampling: 1h, 2h, 4h, 8h, 12h, 16h, 24h, 36h, 48h, 72h
    const postSamples_h = [1, 2, 4, 8, 12, 16, 24, 36, 48, 72];
    let lastPost_min = 0;

    for (const h of postSamples_h) {
        const target_min = h * 60;
        const advance = target_min - lastPost_min;
        lastPost_min = target_min;

        // Hvis withCHO og vi krydser 1 t post — giv standard måltid
        // 60 g kulhydrat (en stor pasta/burger)
        if (withCHO && lastPost_min >= 60 && !sim._mealGiven) {
            sim.addFood(60, 0, 0);
            sim._mealGiven = true;
            // Bolus matched: 60g / 10 ICR = 6 E
            sim.addFastInsulin(6);
        }

        // Avancér i bidder af max 60 min for at sikre stabilitet
        let remaining = advance;
        while (remaining > 0) {
            const step = Math.min(remaining, 60);
            advanceMinutes(sim, step);
            remaining -= step;
        }

        records.push({
            scenario: label, label: `post-${h}h`,
            tPost_h: h,
            ...snapshot(sim)
        });
    }

    return records;
}

// =============================================================================
// RUN
// =============================================================================

console.error('=== PEIS Verification Experiment ===');
console.error('Cardio Medium 30 min, 70 kg patient, ISF=3.0');
console.error('');

const resultsA = runScenario('A_no_CHO', false);
console.error(`Scenario A (no CHO): ${resultsA.length} samples`);

const resultsB = runScenario('B_with_CHO', true);
console.error(`Scenario B (CHO 1h post): ${resultsB.length} samples`);

// CSV output
const all = [...resultsA, ...resultsB];
const cols = ['scenario','label','tPost_h','t','BG','IOB','currentISF','baseISF','circadianISF','resistRatio','sensFactorApprox','glycogenReserve','slowEmptyFactor','cob'];
console.log(cols.join(','));
for (const r of all) {
    console.log(cols.map(c => {
        const v = r[c];
        if (typeof v === 'number') return v.toFixed(4);
        return String(v);
    }).join(','));
}

console.error('');
console.error('Done. Pipe to file: tests/.bin/node.exe tests/peis-verification.js > peis-output.csv');
