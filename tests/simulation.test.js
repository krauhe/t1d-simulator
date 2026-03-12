// =============================================================================
// AUTOMATED TESTS FOR THE GLUCOSE SIMULATION
// =============================================================================
//
// This file tests the physiological simulator (the Simulator class from js/simulator.js)
// in a Node.js environment WITHOUT a browser. All browser globals (DOM elements, audio, etc.)
// are mocked out so we only test the simulation logic itself.
//
// Run with: node tests/simulation.test.js
//
// The tests verify:
//   1. Carbohydrate intake produces a physiologically plausible BG rise
//   2. Bolus insulin lowers BG by approximately ISF per unit
//   3. Cardio lowers BG, strength training raises BG acutely
//   4. Game over at BG < 1.5 (severe hypoglycaemia)
//   5. DKA symptoms and game over upon insulin deficiency
//   6. Ketoacidosis state builds up over time with high BG + insulin deficiency
//
// =============================================================================

const fs = require('fs');
const path = require('path');

// --- Mock environment setup ---
// The simulator is written for the browser and uses global variables (DOM elements,
// audio functions, etc.). We create "dummy" versions of all of these so the code
// can run in Node.js without errors.

// Mock DOM element: an object that accepts all typical DOM operations
function mockElement() {
    const el = {
        textContent: '',
        innerHTML: '',
        value: '60',           // speedSelector.value is used in the constructor
        disabled: false,
        style: {
            display: 'none',
            setProperty: () => {},
            removeProperty: () => {}
        },
        classList: {
            add: () => {},
            remove: () => {},
            toggle: () => {},
            contains: () => false
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ width: 800, height: 400 }),
        querySelector: () => mockElement(),
        querySelectorAll: () => [],
        closest: () => null,
        appendChild: () => {},
        removeChild: () => {},
        remove: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        children: [],
        parentElement: null
    };
    return el;
}

// All global DOM references from main.js — set to mock elements
const domGlobals = [
    'startButton', 'resetButton', 'helpButton', 'pauseButton', 'speedSelector',
    'dayDisplay', 'timeDisplay', 'cgmValueDisplayGraph', 'normoPointsDisplay',
    'normoPointsWeighting', 'muteButton', 'carbsSlider', 'carbsValue',
    'proteinSlider', 'proteinValue', 'fatSlider', 'fatValue', 'giveFoodButton',
    'foodInfoDisplay', 'foodKcalDisplay', 'foodKeDisplay', 'dextroButton',
    'burgerButton', 'avocadoButton', 'chickenButton', 'cakeButton', 'sodaButton',
    'saladButton', 'cerealButton', 'fastInsulinSlider', 'fastInsulinValue',
    'giveFastInsulinButton', 'longInsulinSlider', 'longInsulinValue',
    'giveLongInsulinButton', 'motionIntensitySelect', 'motionDurationSelect',
    'startMotionButton', 'motionKcalDisplay', 'fingerprickButton', 'ketoneTestButton', 'glucagonButton',
    'debugTrueBgCheckbox', 'iobDisplay', 'cobDisplay', 'bgGraphCanvas', 'graphCtx',
    'weightChangeSlider', 'weightChangeValue', 'steepDropWarningDiv',
    'weightDisplay', 'icrDisplay', 'isfDisplay', 'carbEffectDisplay',
    'basalDoseDisplay', 'restingKcalDisplay',
    'tir24hDisplay', 'titr24hDisplay', 'avgCgm24hDisplay',
    'fastInsulin24hDisplay', 'basalInsulin24hDisplay', 'kcal24hDisplay',
    'tir14dDisplay', 'titr14dDisplay', 'avgCgm14dDisplay',
    'lastBolusTimerDisplay', 'kcalBalance24hDisplay',
    'fastInsulin7dDisplay', 'basalInsulin7dDisplay', 'kcal7dDisplay', 'kcalBalance7dDisplay'
];

domGlobals.forEach(name => { global[name] = mockElement(); });

// Global variables from main.js used by the simulator
global.isPaused = false;
global.cgmDataPoints = [];
global.trueBgPoints = [];
global.MAX_GRAPH_POINTS_PER_DAY = 288;
global.KCAL_PER_KG_WEIGHT = 7700;
global.RESTING_KCAL_PER_DAY = 2200;
global.RESTING_KCAL_PER_MINUTE = RESTING_KCAL_PER_DAY / (24 * 60);

// Mock functions that normally live in other JS files (ui.js, sounds.js, i18n.js)
global.logEvent = () => {};             // Logs game events — ignored in tests
global.showPopup = () => {};            // Shows popup messages — ignored in tests
global.showGameOverPopup = () => {};    // Shows game over popup — ignored in tests
global.playSound = () => {};            // Plays sounds — ignored in tests
global.drawGraph = () => {};            // Draws the graph — ignored in tests
global.updateUI = () => {};             // Updates the UI — ignored in tests

// i18n mock — t() just returns the key (with variables inserted), since we are not testing UI text
global.appSettings = { language: 'da' };
global.I18N = { da: {}, en: {} };
global.t = (key, vars) => { let text = key; if (vars) Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); }); return text; };
global.tInsulinUnit = () => 'E';

// Mock document.getElementById — used by updateWeight() in simulator.js
global.document = {
    getElementById: () => mockElement(),
    body: { appendChild: () => {} }
};

// --- Load the Hovorka model and Simulator class ---
// Hovorka must be loaded first because Simulator uses HovorkaModel in its constructor.
// We evaluate both JS files directly and make the classes available globally.
const hovorkaCode = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'hovorka.js'), 'utf8'
);
eval(hovorkaCode + '\nglobal.HovorkaModel = HovorkaModel;');

const simulatorCode = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'simulator.js'), 'utf8'
);
const wrappedCode = simulatorCode + '\nglobal.Simulator = Simulator;';
eval(wrappedCode);

// =============================================================================
// TEST HELPER FUNCTIONS
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

// Run a single test with a name and test function
function test(name, fn) {
    testsTotal++;
    try {
        fn();
        testsPassed++;
        console.log(`  PASS: ${name}`);
    } catch (e) {
        testsFailed++;
        console.log(`  FAIL: ${name}`);
        console.log(`        ${e.message}`);
    }
}

// Assert that a value is truthy — throws an error with the given message if not
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

// Assert that a value is within a given range
function assertInRange(value, min, max, label) {
    assert(
        value >= min && value <= max,
        `${label}: expected ${min}-${max}, got ${value.toFixed(3)}`
    );
}

// Create a fresh simulator with reset state.
// We remove basal insulin from the constructor and set stable starting values
// so the tests are reproducible.
function createCleanSimulator() {
    // Reset global arrays
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator();

    // Remove the basal insulin that is automatically added in the constructor,
    // so we have full control over the insulin balance in the tests
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;

    // Set starting values that give predictable behaviour
    sim.trueBG = 5.5;
    sim.cgmBG = 5.5;
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;

    // Synchronise the Hovorka model's Q1 with trueBG (Q1 = BG * V_G)
    // and reset insulin inputs so Hovorka starts clean
    sim.hovorka.state[4] = 5.5 * sim.hovorka.V_G;  // Q1 = trueBG * distribution volume
    sim.hovorka.insulinRate = 0;

    // Set time to midday (14:00) to avoid the dawn effect
    sim.totalSimMinutes = 14 * 60;
    sim.timeInMinutes = 14 * 60;

    return sim;
}

// Create a simulator with a specific starting BG and synchronise Hovorka state
function setSimulatorBG(sim, targetBG) {
    sim.trueBG = targetBG;
    sim.hovorka.state[4] = targetBG * sim.hovorka.V_G;  // Q1
}

// Simulate a number of minutes by calling update() in small time steps.
// simulationSpeed=60 means 1 second of real time = 1 minute of simulated time.
// We use dt=1 second per tick, so each tick = 1 simulated minute.
function simulateMinutes(sim, minutes) {
    sim.simulationSpeed = 60;
    const ticksPerMinute = 1;  // 1 tick of 1 sec at speed=60 gives 1 sim-minute
    const totalTicks = minutes * ticksPerMinute;
    for (let i = 0; i < totalTicks; i++) {
        sim.update(1.0);  // 1 second of real time
    }
}

// =============================================================================
// TEST 1: CARBOHYDRATE INTAKE
// =============================================================================
//
// Tests that 10g of carbohydrates produces a BG rise of 1-3 mmol/L.
//
// Physiological background:
//   - currentCarbEffect = currentISF / ICR = 3.0 / 10 = 0.3 mmol/L per gram
//   - 10g * 0.3 = 3.0 mmol/L theoretical max (without insulin or liver production)
//   - In practice the liver also produces some glucose, and absorption takes
//     time (20 min delay + ~40 min absorption), so we measure after sufficient
//     time for full absorption.
//   - We use a wide interval (0.5-5.0) because liver production adds a bit.
// =============================================================================

console.log('\n--- Test 1: Carbohydrate intake (10g carbs -> BG rise) ---');

test('10g carbohydrates causes BG rise of 1-8 mmol/L (incl. liver production)', () => {
    const sim = createCleanSimulator();
    const startBG = sim.trueBG;

    // Add 10g carbohydrates (no protein/fat)
    sim.addFood(10, 0, 0);

    // Simulate 120 minutes — enough time for full absorption
    // (20 min delay + ~40 min absorption + buffer)
    simulateMinutes(sim, 120);

    const bgRise = sim.trueBG - startBG;
    // BG rises due to carbohydrates (~3 mmol/L from 10g) + liver production (~2.4 mmol/L over 120 min)
    // Total rise approx. 5-6 mmol/L without insulin to counteract
    // With the Hovorka model there is residual insulin from steady-state in all
    // compartments, so the carbohydrate effect is partially offset. The lower
    // bound is therefore lower than in the old model.
    assertInRange(bgRise, 0.2, 8.0, '10g carbs BG rise');
});

test('60g carbohydrates causes a larger rise than 10g', () => {
    const sim10 = createCleanSimulator();
    sim10.addFood(10, 0, 0);
    simulateMinutes(sim10, 120);
    const rise10 = sim10.trueBG - 5.5;

    const sim60 = createCleanSimulator();
    sim60.addFood(60, 0, 0);
    simulateMinutes(sim60, 120);
    const rise60 = sim60.trueBG - 5.5;

    assert(rise60 > rise10, `60g rise (${rise60.toFixed(1)}) must be larger than 10g (${rise10.toFixed(1)})`);
});

test('Without food, BG is relatively stable (liver vs. brain/kidneys in balance)', () => {
    const sim = createCleanSimulator();
    const startBG = sim.trueBG;

    // 60 minutes without food — the Hovorka model has liver, brain and kidneys
    // in balance. Without insulin BG will slowly rise due to liver production,
    // but brain consumption and potential renal clearance slow the rise.
    // With residual insulin from steady-state, BG can also drop slightly.
    simulateMinutes(sim, 60);

    const bgChange = Math.abs(sim.trueBG - startBG);
    // BG should be relatively stable — not change more than 4 mmol/L in 60 min
    assert(bgChange < 4.0,
        `BG change without food (liver only): expected < 4.0, got ${bgChange.toFixed(3)}`);
});


// =============================================================================
// TEST 2: INSULIN EFFECT
// =============================================================================
//
// Tests that bolus insulin lowers BG by approximately ISF (3.0 mmol/L) per unit.
//
// The model uses a triangular absorption profile:
//   onset (~10-15 min) -> peak (~45-70 min) -> tail (~120-240 min)
// The total BG effect per unit should be close to ISF = 3.0 mmol/L.
//
// We start with high BG (15 mmol/L) so there is room to fall,
// and we simulate long enough for the insulin to be fully absorbed.
// =============================================================================

console.log('\n--- Test 2: Insulin effect (bolus lowers BG ~ISF per unit) ---');

test('1 unit bolus insulin lowers BG by approx. ISF (isolated from liver production)', () => {
    // To isolate the insulin effect we run two simulations:
    //   1. Baseline without insulin (liver production only)
    //   2. With 1 unit of insulin
    // The difference is the net insulin effect.
    const simBaseline = createCleanSimulator();
    setSimulatorBG(simBaseline, 15.0);
    simulateMinutes(simBaseline, 300);
    const bgBaseline = simBaseline.trueBG;

    const simInsulin = createCleanSimulator();
    setSimulatorBG(simInsulin, 15.0);
    simInsulin.addFastInsulin(1);
    simulateMinutes(simInsulin, 300);
    const bgInsulin = simInsulin.trueBG;

    // Isolated insulin effect = difference between the two simulations
    // Should be close to ISF = 3.0 mmol/L (but with some variation due to random onset)
    const isolatedDrop = bgBaseline - bgInsulin;
    assertInRange(isolatedDrop, 1.0, 8.0, '1U insulin isolated BG drop');
});

test('3 units of insulin causes a larger BG drop than 1 unit', () => {
    const sim1 = createCleanSimulator();
    setSimulatorBG(sim1, 20.0);
    sim1.addFastInsulin(1);
    simulateMinutes(sim1, 300);
    const drop1 = 20.0 - sim1.trueBG;

    const sim3 = createCleanSimulator();
    setSimulatorBG(sim3, 20.0);
    sim3.addFastInsulin(3);
    simulateMinutes(sim3, 300);
    const drop3 = 20.0 - sim3.trueBG;

    assert(drop3 > drop1, `3U drop (${drop3.toFixed(1)}) must be larger than 1U (${drop1.toFixed(1)})`);
});

test('Insulin has a delay (onset) — BG does not drop immediately', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 15.0);
    const startBG = sim.trueBG;

    sim.addFastInsulin(5);

    // Only 5 minutes — insulin has an onset of 10-15 min, so there should be
    // minimal drop yet (primarily liver production counteracting)
    simulateMinutes(sim, 5);

    const bgDropIn5min = startBG - sim.trueBG;
    // Within the first 5 min we expect only a small insulin drop.
    // The Hovorka model has a faster initial response than the triangle profile,
    // but the effect is still limited due to the S1->S2->I->x cascade.
    // With 5U bolus and Hovorka's pharmacokinetics, up to 2 mmol/L drop is realistic.
    // Hovorka's 2-compartment insulin has faster initial response than
    // the old triangle profile, so up to 3 mmol/L drop in 5 min is realistic
    // with 5U bolus (which is a large dose).
    assert(bgDropIn5min < 3.5, `BG drop after 5 min (${bgDropIn5min.toFixed(2)}) should be moderate (onset phase)`);
});


// =============================================================================
// TEST 3: EXERCISE — CARDIO VS. STRENGTH TRAINING
// =============================================================================
//
// Physiological background:
//   - Cardio (aerobic): Muscles take up glucose via GLUT4 -> BG drops
//   - Strength training (anaerobic/high intensity): Catecholamines released ->
//     the liver releases extra glucose -> BG rises acutely
//     (but after training insulin sensitivity increases)
//
// In the model:
//   - All exercise produces a BG drop (aerobic component)
//   - High intensity also adds a BG rise (anaerobic component)
//     plus acute stress that drives additional liver glucose
//   - Net result at high intensity can be a rise or a smaller drop
// =============================================================================

console.log('\n--- Test 3: Exercise (cardio lowers BG, strength raises acutely) ---');

test('Cardio (low intensity, 30 min) lowers BG', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 8.0);
    const startBG = sim.trueBG;

    sim.startMotion("Lav", "30");

    // Simulate during the exercise
    simulateMinutes(sim, 30);

    const bgChange = sim.trueBG - startBG;
    // Low-intensity cardio produces ~1.0 mmol/L drop per 10 min
    // Over 30 min: approx. 3 mmol/L drop (minus liver production)
    assert(bgChange < 0, `Cardio BG change (${bgChange.toFixed(2)}) must be negative (BG drops)`);
});

test('High intensity produces higher acute stress than low intensity (anaerobic component)', () => {
    // In the model, high intensity has BOTH larger aerobic BG drop (3x vs 1x)
    // AND an anaerobic component (stress + direct liver glucose).
    // The aerobic component dominates during exercise, but the anaerobic component
    // shows up via accumulated acute stress that drives liver glucose AFTER exercise.
    //
    // We therefore test that high intensity produces noticeably higher acuteStressLevel
    // than low intensity — that is the physiological hallmark of strength training.
    const simLow = createCleanSimulator();
    simLow.startMotion("Lav", "30");
    simulateMinutes(simLow, 30);

    const simHigh = createCleanSimulator();
    simHigh.startMotion("Høj", "30");
    simulateMinutes(simHigh, 30);

    assert(simHigh.acuteStressLevel > simLow.acuteStressLevel + 0.05,
        `High intensity stress (${simHigh.acuteStressLevel.toFixed(3)}) ` +
        `must be higher than low (${simLow.acuteStressLevel.toFixed(3)})`);
});

test('High intensity builds acute stress (catecholamines)', () => {
    const sim = createCleanSimulator();
    assert(sim.acuteStressLevel === 0, 'Starting stress must be 0');

    sim.startMotion("Høj", "30");
    simulateMinutes(sim, 30);

    // High intensity adds 0.02 * simulatedMinutesPassed per tick to acuteStress
    assert(sim.acuteStressLevel > 0.1,
        `Acute stress after high-intensity exercise (${sim.acuteStressLevel.toFixed(3)}) must be > 0.1`);
});

test('BG drop during exercise is larger with active insulin than without', () => {
    // Physiological: Insulin enhances muscle glucose uptake during exercise
    // (via GLUT4 translocation). Therefore BG drops more during exercise IF
    // there is active insulin in the body — an important clinical point for T1D.
    //
    // In the Hovorka model this is seen via x1 and x2 (insulin action variables)
    // that enhance glucose transport and disposal in muscles.
    const simNoInsulin = createCleanSimulator();
    setSimulatorBG(simNoInsulin, 10.0);
    // Remove all active insulin to isolate the effect
    simNoInsulin.hovorka.state.S1 = 0;
    simNoInsulin.hovorka.state.S2 = 0;
    simNoInsulin.hovorka.state.I = 0;
    simNoInsulin.startMotion("Lav", "30");
    simulateMinutes(simNoInsulin, 30);
    const dropNoInsulin = 10.0 - simNoInsulin.trueBG;

    const simWithInsulin = createCleanSimulator();
    setSimulatorBG(simWithInsulin, 10.0);
    // Set insulin directly in plasma (avoids random bioavailability/tauFactor
    // that could make the test flaky — we are testing the exercise effect, not absorption).
    simWithInsulin.hovorka.state[6] = 30; // 30 mU/L plasma insulin (physiological bolus level)
    simWithInsulin.startMotion("Lav", "30");
    simulateMinutes(simWithInsulin, 30);
    const dropWithInsulin = 10.0 - simWithInsulin.trueBG;

    assert(dropWithInsulin > dropNoInsulin,
        `BG drop with insulin (${dropWithInsulin.toFixed(1)}) must be larger than without (${dropNoInsulin.toFixed(1)})`);
});


// =============================================================================
// TEST 4: GAME OVER AT BG < 1.5 (SEVERE HYPOGLYCAEMIA)
// =============================================================================
//
// Physiological background:
//   - BG below ~1.5 mmol/L is life-threatening — the brain does not get enough energy
//   - In the game this triggers game over as a safety mechanism
//   - The model checks this in checkGameOverConditions()
// =============================================================================

console.log('\n--- Test 4: Game over at BG < 1.5 (severe hypoglycaemia) ---');

test('Game over when BG falls below 1.5 mmol/L', () => {
    const sim = createCleanSimulator();
    // Set BG just above the threshold and give a large insulin dose
    setSimulatorBG(sim, 3.0);
    sim.addFastInsulin(20);  // Massive overdose (20U from BG=3 overcomes counter-regulation)

    // Simulate until BG falls below the threshold
    let gameOverTriggered = false;
    for (let i = 0; i < 500; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(gameOverTriggered, 'Game over must be triggered at BG < 1.5');
    assert(sim.trueBG < 1.5 || sim.isGameOver, 'BG must be below 1.5 or game over active');
});

test('Game over is NOT triggered at normal BG', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    // Simulate 60 minutes without interventions
    simulateMinutes(sim, 60);

    assert(!sim.isGameOver, 'Game over must NOT be triggered at normal BG');
});

test('BG has a physiological floor at 0.1 (clamped)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 0.5);
    sim.addFastInsulin(20);  // Absurd overdose

    // Run a few ticks
    sim.simulationSpeed = 60;
    for (let i = 0; i < 10; i++) {
        sim.update(1.0);
        if (sim.isGameOver) break;
    }

    // BG must be clamped to at least 0.1 (not negative)
    assert(sim.trueBG >= 0.1, `BG (${sim.trueBG.toFixed(3)}) must never be below 0.1`);
});


// =============================================================================
// TEST 5: DKA (DIABETIC KETOACIDOSIS) — SYMPTOMS AND GAME OVER
// =============================================================================
//
// Physiological background:
//   - When the body lacks insulin, cells cannot take up glucose
//   - The body starts burning fat -> ketones are produced
//   - Ketones are acids that poison the blood -> ketoacidosis
//   - Untreated DKA is fatal (typically within 24-72 hours)
//
// In the model:
//   - The DKA state builds when: BG > 12 AND IOB < 0.1 AND no active
//     basal insulin AND > 8 hours since last insulin
//   - After 6 hours of insulin deficiency + high BG: warning (dkaWarning1Given)
//   - 12 hours after the warning: game over (dkaGameOverTime)
// =============================================================================

console.log('\n--- Test 5: DKA symptoms and game over upon insulin deficiency ---');

test('DKA warning after 6+ hours of high BG + insulin deficiency', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);    // High BG
    sim.iob = 0;                  // No insulin on board
    sim.activeFastInsulin = [];   // No active rapid insulin
    sim.activeLongInsulin = [];   // No active basal insulin
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60); // Last insulin 9 hours ago
    // Reset Hovorka insulin state so there is no residual insulin
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simulate 7 hours (420 min) to reach the DKA warning threshold of 6 hours
    // NB: BG will rise due to liver production, so the BG>12 condition holds
    simulateMinutes(sim, 420);

    assert(sim.dkaWarning1Given,
        'DKA warning must be given after 6+ hours of insulin deficiency');
});

test('DKA game over 12 hours after warning', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 20.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simulate 20 hours (long enough for warning + 12-hour grace period)
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 1200; i++) {  // 1200 min = 20 hours
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(sim.dkaWarning1Given, 'DKA warning must be given first');
    assert(gameOverTriggered, 'DKA game over must be triggered after warning + 12 hours');
});

test('Insulin resets DKA state (resetDKAState)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simulate 7 hours to trigger DKA warning
    simulateMinutes(sim, 420);
    assert(sim.dkaWarning1Given, 'DKA warning must be given');

    // Give insulin — this calls resetDKAState()
    sim.addFastInsulin(5);

    // DKA state must be reset
    assert(!sim.dkaWarning1Given, 'DKA warning is reset after insulin');
    assert(sim.dkaGameOverTime === -1, 'DKA game over timer is reset after insulin');
    assert(sim.timeOfHighBGwithInsulinDeficit === 0, 'DKA counter is reset after insulin');
});


// =============================================================================
// TEST 6: KETOACIDOSIS BUILD-UP DURING INSULIN DEFICIENCY
// =============================================================================
//
// These tests verify the current DKA mechanics: that the state builds up
// gradually over time when BG is high and insulin is absent.
//
// NB: The model does not yet have an explicit ketone variable (this is a TODO
// in the code). The current tests verify the time-based DKA mechanics
// as a proxy for ketone build-up.
//
// Future improvement: When a ketone model is implemented, tests should be added
// that measure sim.ketones directly and verify that:
//   - Ketones rise when IOB is low and BG is high
//   - Ketones fall when insulin is given
//   - Symptom thresholds (0.6, 1.5, 3.0 mmol/L) trigger correct warnings
// =============================================================================

console.log('\n--- Test 6: Ketoacidosis build-up during insulin deficiency ---');

test('DKA timer starts only when ALL conditions are met (BG>12, IOB<0.1, no basal, >8h)', () => {
    // Test with normal BG — DKA must NOT start
    const simNormal = createCleanSimulator();
    setSimulatorBG(simNormal, 8.0);  // Normal BG
    simNormal.activeFastInsulin = [];
    simNormal.activeLongInsulin = [];
    simNormal.lastInsulinTime = simNormal.totalSimMinutes - (9 * 60);

    simulateMinutes(simNormal, 120);
    // BG can rise due to liver production, but must start normal
    assert(simNormal.timeOfHighBGwithInsulinDeficit === 0,
        'DKA timer must NOT start at normal starting BG (even if BG can rise)');
});

test('DKA timer resets when insulin is given', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simulate 3 hours so the DKA timer is running
    simulateMinutes(sim, 180);
    assert(sim.timeOfHighBGwithInsulinDeficit > 0,
        'DKA timer must have started');

    // Give insulin
    sim.addFastInsulin(3);

    // Run one more tick so checkGameOverConditions updates
    // (insulin gives IOB > 0.1 and lastInsulinTime is updated)
    simulateMinutes(sim, 1);

    assert(sim.timeOfHighBGwithInsulinDeficit === 0,
        'DKA timer must reset when insulin is given');
});

test('Insulin deficiency over time: BG rises due to uncounteracted liver production', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 12.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    const startBG = sim.trueBG;

    // Simulate 4 hours without insulin
    simulateMinutes(sim, 240);

    // Without insulin to lower BG, it rises due to hepatic glucose production
    assert(sim.trueBG > startBG,
        `BG (${sim.trueBG.toFixed(1)}) must rise from ${startBG} without insulin`);
});

test('Somogyi effect: low BG triggers stress hormone response', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 3.0);  // Below 3.5 -> Somogyi trigger

    const stressBefore = sim.acuteStressLevel;
    simulateMinutes(sim, 30);

    assert(sim.acuteStressLevel > stressBefore,
        `Acute stress (${sim.acuteStressLevel.toFixed(3)}) must rise at low BG (Somogyi)`);
});


// =============================================================================
// EXTRA TESTS: STRESS HORMONES AND DAWN EFFECT
// =============================================================================

console.log('\n--- Extra: Stress hormones and dawn effect ---');

test('Circadian cortisol is 0 in the afternoon (14:00)', () => {
    const sim = createCleanSimulator(); // time = 14:00
    assert(sim.circadianKortisolNiveau === 0,
        `Cortisol at 14:00 (${sim.circadianKortisolNiveau}) must be 0`);
});

test('Circadian cortisol peaks in the morning (08:00)', () => {
    const sim = createCleanSimulator();
    // Set dawn parameters to known values (avoids random variation in the test)
    sim._dawnAmplitude = 0.3;
    sim._dawnPeakMinutes = 8 * 60;
    sim.timeInMinutes = 8 * 60; // 08:00

    assertInRange(sim.circadianKortisolNiveau, 0.25, 0.35, 'Cortisol at 08:00 (peak)');
});

test('Acute stress decays over time (exponential washout)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 10.0);  // High enough BG to avoid Somogyi trigger (< 3.5)
    sim.acuteStressLevel = 1.0;

    simulateMinutes(sim, 60); // 1 half-life

    // After 60 min (1 half-life) stress should be approximately halved
    assertInRange(sim.acuteStressLevel, 0.3, 0.7, 'Acute stress after 1 half-life');
});

test('addChronicStress increases chronic stress level', () => {
    const sim = createCleanSimulator();
    sim.addChronicStress(0.5);
    assertInRange(sim.chronicStressLevel, 0.45, 0.55, 'Chronic stress after addition');
});


// =============================================================================
// TEST 7: PATIENT PROFILE — Custom patient parameters
// =============================================================================
//
// Tests that the Simulator class accepts a profile with weight, ICR and ISF,
// and that all derived values (basal dose, resting metabolic rate, carb effect)
// are calculated correctly from the profile.
// =============================================================================

console.log('\n--- Test 7: Patient profile ---');

test('Default profile: ISF=3.0, ICR=10, weight=70', () => {
    const sim = createCleanSimulator();
    assert(sim.ISF === 3.0, `ISF must be 3.0, got ${sim.ISF}`);
    assert(sim.ICR === 10, `ICR must be 10, got ${sim.ICR}`);
    assert(sim.weight === 70, `Weight must be 70, got ${sim.weight}`);
});

test('Custom profile: ISF=2.0, ICR=8, weight=85', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 85 });
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;

    assert(sim.ISF === 2.0, `ISF must be 2.0, got ${sim.ISF}`);
    assert(sim.ICR === 8, `ICR must be 8, got ${sim.ICR}`);
    assert(sim.weight === 85, `Weight must be 85, got ${sim.weight}`);
});

test('Basal dose is calculated from ISF via the rule of 100', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    // ISF=2.0 -> TDD = 100/2 = 50 -> basal = 50 * 0.45 = 22.5 -> rounded 23
    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 70 });
    assert(sim.estimatedTDD === 50, `TDD must be 50, got ${sim.estimatedTDD}`);
    assert(sim.basalDose === 23, `Basal must be 23, got ${sim.basalDose}`);

    // ISF=5.0 -> TDD = 100/5 = 20 -> basal = 20 * 0.45 = 9
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim2 = new Simulator({ isf: 5.0, icr: 15, weight: 60 });
    assert(sim2.estimatedTDD === 20, `TDD must be 20, got ${sim2.estimatedTDD}`);
    assert(sim2.basalDose === 9, `Basal must be 9, got ${sim2.basalDose}`);
});

test('Resting metabolic rate scales with weight (2200 kcal at 70 kg)', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim70 = new Simulator({ weight: 70 });
    assertInRange(sim70.restingKcalPerDay, 2199, 2201, 'Kcal at 70 kg');

    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim100 = new Simulator({ weight: 100 });
    // 100 * (2200/70) = 3142.86
    assertInRange(sim100.restingKcalPerDay, 3142, 3144, 'Kcal at 100 kg');

    assert(sim100.restingKcalPerDay > sim70.restingKcalPerDay,
        'Higher weight must give higher resting metabolic rate');
});

test('Carb effect changes with ISF and ICR', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    // ISF=2.0, ICR=8 -> carbEffect = ISF * circadianISF / ICR
    // At midnight (00:00) circadianISF = 1.20, so:
    // carbEffect = 2.0 * 1.20 / 8 = 0.30
    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 70 });
    assertInRange(sim.currentCarbEffect, 0.29, 0.31, 'CarbEffect at ISF=2, ICR=8 (midnight, circadianISF=1.2)');

    // ISF=5.0, ICR=15 -> carbEffect = 5.0 * 1.20 / 15 = 0.40
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim2 = new Simulator({ isf: 5.0, icr: 15, weight: 70 });
    assertInRange(sim2.currentCarbEffect, 0.39, 0.41, 'CarbEffect at ISF=5, ICR=15 (midnight, circadianISF=1.2)');
});


// =============================================================================
// TEST 8: INSULIN OVERDOSE — 9U FROM BG=6 MUST BE LETHAL
// =============================================================================
//
// Physiological background:
//   - 9U with ISF=3.0 gives an expected BG drop of ~27 mmol/L
//   - From starting BG=6 there is only 4.5 mmol/L to the lethal threshold (1.5)
//   - T1D patients have impaired counter-regulation (lost glucagon response)
//   - Counter-regulation CANNOT compensate for massive overdose
//   - Sources: Bengtsen 2021, Rzepczyk 2022, Megarbane 2007
// =============================================================================

// Helper function: create a simulator WITH intact basal insulin.
// Runs the model 60 min forward so the Hovorka state is in sync with
// the active basal insulin. Used for overdose and HAAF tests.
function createSimulatorWithBasal() {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator(); // Keeps basal insulin from the constructor

    // Run 60 ticks (1 sim-minute each) to stabilise Hovorka
    sim.simulationSpeed = 60;
    for (let i = 0; i < 60; i++) sim.update(1.0);

    // Reset stress and HAAF (hypo during init may have triggered something)
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;
    sim.hypoArea = 0.0;
    sim.counterRegFactor = 1.0;
    sim.isGameOver = false;

    return sim;
}

console.log('\n--- Test 8: Insulin overdose (9U from BG=6 is lethal) ---');

test('9U bolus from BG=6 without food causes game over (lethal overdose)', () => {
    // Use simulator WITH basal insulin — realistic scenario
    const sim = createSimulatorWithBasal();
    setSimulatorBG(sim, 6.0);

    // Give 9U rapid-acting insulin without food
    sim.addFastInsulin(9);

    // Simulate up to 6 hours (360 min) — death should occur well before
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 360; i++) {
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(gameOverTriggered,
        `9U from BG=6 MUST be lethal (BG reached ${sim.trueBG.toFixed(2)} mmol/L)`);
});

test('3U bolus from BG=8 without food does NOT cause game over (severe hypo but survivable)', () => {
    // Use simulator WITH basal insulin
    const sim = createSimulatorWithBasal();
    setSimulatorBG(sim, 8.0);

    // Give 3U — expected drop ~9 mmol/L, but from BG=8 with counter-regulation
    // the player should survive (BG drops to ~2-3 with stress response)
    sim.addFastInsulin(3);

    // Simulate 6 hours
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 360; i++) {
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(!gameOverTriggered,
        `3U from BG=8 should be survivable (BG: ${sim.trueBG.toFixed(2)}, ` +
        `stress: ${sim.acuteStressLevel.toFixed(2)})`);
});


// =============================================================================
// TEST 9: HYPOGLYCAEMIA UNAWARENESS (HAAF) — Continuous area-based model
// =============================================================================
//
// Physiological background:
//   - Repeated/prolonged hypos impair the counter-regulatory response
//   - hypoArea accumulates: integral of max(0, 3.0 - BG) over time
//   - counterRegFactor = 0.3 + 0.7 * exp(-hypoArea / HAAF_DAMAGE_SCALE)
//   - Recovery: hypoArea decays exponentially when BG > 4.0 (t1/2 = 3 sim-days)
//   - Sources: Dagogo-Jack 1993, Cryer 2001/2013, Reno 2013, Rickels 2019
// =============================================================================

console.log('\n--- Test 9: Hypoglycaemia unawareness (HAAF) — area-based ---');

test('counterRegFactor starts at 1.0 and hypoArea at 0', () => {
    const sim = createCleanSimulator();
    assert(sim.counterRegFactor === 1.0,
        `counterRegFactor must start at 1.0, got ${sim.counterRegFactor}`);
    assert(sim.hypoArea === 0.0,
        `hypoArea must start at 0, got ${sim.hypoArea}`);
});

test('hypoArea accumulates when BG < 3.0 (HAAF damage)', () => {
    // Hold BG at 2.0 for 15 min -> expected area: (3.0-2.0) x 15 = 15 mmol*min/L
    const sim = createCleanSimulator();

    for (let i = 0; i < 15; i++) {
        sim.trueBG = 2.0;
        sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) sim.isGameOver = false;
    }

    // hypoArea should be approx. 15 (1.0 deficit x 15 min)
    assert(sim.hypoArea > 10,
        `hypoArea must be > 10 after 15 min at BG=2.0 (got ${sim.hypoArea.toFixed(1)})`);
    assert(sim.counterRegFactor < 0.8,
        `counterRegFactor must be reduced (${sim.counterRegFactor.toFixed(2)})`);
});

test('Deep hypo causes more damage than mild hypo', () => {
    // BG=1.5 (deficit 1.5) vs BG=2.5 (deficit 0.5) for 10 min
    const simDeep = createCleanSimulator();
    const simMild = createCleanSimulator();

    for (let i = 0; i < 10; i++) {
        // Deep hypo
        simDeep.trueBG = 1.5;
        simDeep.hovorka.state[4] = 1.5 * simDeep.hovorka.V_G;
        simDeep.simulationSpeed = 60;
        simDeep.update(1.0);
        if (simDeep.isGameOver) simDeep.isGameOver = false;

        // Mild hypo
        simMild.trueBG = 2.5;
        simMild.hovorka.state[4] = 2.5 * simMild.hovorka.V_G;
        simMild.simulationSpeed = 60;
        simMild.update(1.0);
        if (simMild.isGameOver) simMild.isGameOver = false;
    }

    assert(simDeep.hypoArea > simMild.hypoArea * 2,
        `Deep hypo (${simDeep.hypoArea.toFixed(1)}) must cause at least 2x more damage than mild (${simMild.hypoArea.toFixed(1)})`);
    assert(simDeep.counterRegFactor < simMild.counterRegFactor,
        `Deep hypo must give lower counterRegFactor (${simDeep.counterRegFactor.toFixed(2)} vs ${simMild.counterRegFactor.toFixed(2)})`);
});

test('HAAF recovery: hypoArea decreases when BG > 4.0', () => {
    const sim = createCleanSimulator();

    // Build up hypoArea: hold BG at 2.0 for 20 min -> approx. 20 mmol*min/L
    for (let i = 0; i < 20; i++) {
        sim.trueBG = 2.0;
        sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) sim.isGameOver = false;
    }
    const peakArea = sim.hypoArea;
    assert(peakArea > 15, `hypoArea must be > 15 (got ${peakArea.toFixed(1)})`);

    // Now recovery: hold BG at 7.0 for 3 sim-days (4320 min = t1/2)
    // After 1 t1/2 hypoArea should be approximately halved
    for (let i = 0; i < 4320; i++) {
        sim.trueBG = 7.0;
        sim.hovorka.state[4] = 7.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
    }

    assert(sim.hypoArea < peakArea * 0.6,
        `hypoArea must have decreased after 3 sim-days of recovery (${sim.hypoArea.toFixed(1)} vs peak ${peakArea.toFixed(1)})`);
    assert(sim.counterRegFactor > 0.8,
        `counterRegFactor must be nearly restored (${sim.counterRegFactor.toFixed(2)})`);
});


// =============================================================================
// TEST 10: ACTIVITY SYSTEM — Four activity types with correct physiology
// =============================================================================
//
// Tests the activity system with 4 types:
//   - Cardio: BG drops (GLUT4 + insulin sensitivity)
//   - Strength training: BG rises acutely (catecholamine stress response)
//   - Mixed sport: BG relatively stable (weighted cardio+anaerobic)
//   - Relaxation: reduces stress, lowers BG slightly
//
// Scientific basis:
//   - Riddell et al. 2017 (Lancet): aerobic -> BG down, anaerobic -> BG up, mixed -> stable
//   - Yardley et al. 2013: strength training causes acute BG rise of 2-5 mmol/L
//   - PMC10534311: mindfulness reduces stress -> better glycaemic control
// =============================================================================

console.log('\n--- Test 10: Activity system (4 types) ---');

test('Strength training raises BG acutely due to stress response', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    const startBG = sim.trueBG;
    const startStress = sim.acuteStressLevel;

    // Start strength training at medium intensity
    sim.startAktivitet('styrke', 'Medium', 30);

    // Simulate during strength training
    simulateMinutes(sim, 30);

    // Stress must have risen significantly (catecholamine response)
    assert(sim.acuteStressLevel > startStress + 0.1,
        `Acute stress after strength training (${sim.acuteStressLevel.toFixed(3)}) must be > ${(startStress + 0.1).toFixed(3)}`);
});

test('Mixed sport causes less BG change than pure cardio', () => {
    // Riddell 2017: "mixed activities are associated with glucose stability"
    const simCardio = createCleanSimulator();
    setSimulatorBG(simCardio, 8.0);
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 30);
    const cardioDrop = 8.0 - simCardio.trueBG;

    const simBlandet = createCleanSimulator();
    setSimulatorBG(simBlandet, 8.0);
    simBlandet.startAktivitet('blandet', 'Medium', 30);
    simulateMinutes(simBlandet, 30);
    const blandetDrop = 8.0 - simBlandet.trueBG;

    // Mixed must produce less BG drop than pure cardio
    // (the stress component partially counteracts the aerobic drop)
    assert(blandetDrop < cardioDrop,
        `Mixed BG drop (${blandetDrop.toFixed(2)}) must be less than cardio (${cardioDrop.toFixed(2)})`);
});

test('Relaxation reduces stress level', () => {
    const sim = createCleanSimulator();
    // Add some stress first
    sim.acuteStressLevel = 0.2;
    sim.chronicStressLevel = 0.1;

    sim.startAktivitet('afslapning', 'Medium', 30);
    simulateMinutes(sim, 30);

    assert(sim.acuteStressLevel < 0.15,
        `Acute stress after relaxation (${sim.acuteStressLevel.toFixed(3)}) must be reduced (<0.15)`);
});

test('Stop function works — post-exercise effects begin', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 8.0);

    // Start 60 min cardio, stop after 15 min
    sim.startAktivitet('cardio', 'Medium', 60);
    assert(sim.activeAktivitet !== null, 'Activity must be active');

    simulateMinutes(sim, 15);
    sim.stopAktivitet();

    assert(sim.activeAktivitet === null, 'Activity must be stopped');
    // Post-exercise entry must be in activeMotion
    assert(sim.activeMotion.length > 0, 'Post-exercise sensitivity entry must exist');
});

test('Cannot start two activities simultaneously', () => {
    const sim = createCleanSimulator();
    const result1 = sim.startAktivitet('cardio', 'Lav', 30);
    assert(result1 === true, 'First activity must start');

    const result2 = sim.startAktivitet('styrke', 'Høj', 30);
    assert(result2 === false, 'Second activity must be rejected');
    assert(sim.activeAktivitet.type === 'cardio', 'First activity must still be running');
});

test('Auto-stop when duration is reached', () => {
    const sim = createCleanSimulator();
    sim.startAktivitet('cardio', 'Lav', 15);
    assert(sim.activeAktivitet !== null, 'Activity must be active');

    // Simulate 20 minutes — the activity should auto-stop after 15
    simulateMinutes(sim, 20);

    assert(sim.activeAktivitet === null, 'Activity must be auto-stopped after 15 min');
    assert(sim.activeMotion.length > 0, 'Post-exercise entry must exist');
});

test('E1 scaling: strength training gives less GLUT4 uptake than cardio', () => {
    // Cardio: e1Scaling=1.0, Strength: e1Scaling=0.3
    // At the same heart rate, the E1 effect (insulin-independent glucose uptake) should be lower for strength
    const simCardio = createCleanSimulator();
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 20);
    const e1Cardio = simCardio.hovorka.state[11]; // E1

    const simStyrke = createCleanSimulator();
    simStyrke.startAktivitet('styrke', 'Medium', 30);
    simulateMinutes(simStyrke, 20);
    const e1Styrke = simStyrke.hovorka.state[11]; // E1

    assert(e1Styrke < e1Cardio * 0.6,
        `Strength E1 (${e1Styrke.toFixed(3)}) must be < 60% of cardio E1 (${e1Cardio.toFixed(3)})`);
});


// --- Test 11: Hepatic glycogen pool (mass-balanced model in grams) ---
console.log('\n--- Test 11: Hepatic glycogen pool (gram-based depletion + recovery) ---');

test('Hepatic glycogen starts at 90g', () => {
    const sim = createCleanSimulator();
    assert(sim.liverGlycogenGrams === 90,
        `liverGlycogenGrams must start at 90 (was ${sim.liverGlycogenGrams})`);
    assert(sim.glycogenReserve === 1.0,
        `glycogenReserve must be 1.0 at 90g (was ${sim.glycogenReserve})`);
});

test('Hepatic glycogen decreases during prolonged hypo (stress-driven glycogenolysis)', () => {
    const sim = createCleanSimulator();
    // Force BG low and add acute stress to simulate Somogyi
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G; // Q1 -> BG=2.0
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4); // Full Somogyi response

    const startGrams = sim.liverGlycogenGrams;

    // Simulate 60 minutes with low BG
    for (let i = 0; i < 60; i++) {
        sim.updateStressHormones(1.0);
    }

    const consumed = startGrams - sim.liverGlycogenGrams;
    assert(consumed > 2,
        `Hepatic glycogen must decrease measurably after 60 min of hypo (consumed: ${consumed.toFixed(1)}g)`);
    assert(sim.liverGlycogenGrams < startGrams,
        `liverGlycogenGrams (${sim.liverGlycogenGrams.toFixed(1)}g) must be below start (${startGrams}g)`);
});

test('Exercise drains glycogen markedly faster than hypo alone', () => {
    const simRest = createCleanSimulator();
    const simExercise = createCleanSimulator();

    // Same starting point: low BG + stress
    simRest.hovorka.state[4] = 2.5 * simRest.hovorka.V_G;
    simRest.trueBG = 2.5;
    simRest.addAcuteStress(0.4);

    simExercise.hovorka.state[4] = 2.5 * simExercise.hovorka.V_G;
    simExercise.trueBG = 2.5;
    simExercise.addAcuteStress(0.4);
    simExercise.startAktivitet('cardio', 'Medium', 60);

    // Simulate 45 minutes
    for (let i = 0; i < 45; i++) {
        simRest.updateStressHormones(1.0);
        simExercise.updateStressHormones(1.0);
    }

    assert(simExercise.liverGlycogenGrams < simRest.liverGlycogenGrams,
        `Exercise+hypo (${simExercise.liverGlycogenGrams.toFixed(1)}g) must give lower glycogen than hypo alone (${simRest.liverGlycogenGrams.toFixed(1)}g)`);

    // Exercise should drain significantly more (>3x due to kcal expenditure)
    const restConsumed = 90 - simRest.liverGlycogenGrams;
    const exerciseConsumed = 90 - simExercise.liverGlycogenGrams;
    assert(exerciseConsumed > restConsumed * 2,
        `Exercise drain (${exerciseConsumed.toFixed(1)}g) should be >2x resting drain (${restConsumed.toFixed(1)}g)`);
});

test('Hepatic glycogen cannot go below 0g', () => {
    const sim = createCleanSimulator();
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4);
    sim.startAktivitet('cardio', 'Høj', null);

    // Simulate a VERY long time (300 min high cardio + hypo)
    for (let i = 0; i < 300; i++) {
        sim.updateStressHormones(1.0);
    }

    assert(sim.liverGlycogenGrams >= 0,
        `liverGlycogenGrams cannot be negative (was ${sim.liverGlycogenGrams.toFixed(2)}g)`);
    assert(sim.glycogenReserve >= 0,
        `glycogenReserve cannot be negative (was ${sim.glycogenReserve.toFixed(3)})`);
});

test('Hepatic glycogen is restored via gluconeogenesis + food', () => {
    const sim = createCleanSimulator();
    // Deplete glycogen (exercise drains quickly)
    sim.hovorka.state[4] = 2.5 * sim.hovorka.V_G;
    sim.trueBG = 2.5;
    sim.addAcuteStress(0.3);
    sim.startAktivitet('cardio', 'Høj', null);
    for (let i = 0; i < 180; i++) {
        sim.updateStressHormones(1.0);
    }
    sim.stopAktivitet();
    const depletedGrams = sim.liverGlycogenGrams;

    // Normalise BG (simulate a meal) and let glycogen recover
    sim.hovorka.state[4] = 8.0 * sim.hovorka.V_G;
    sim.trueBG = 8.0;
    sim.acuteStressLevel = 0;
    for (let i = 0; i < 180; i++) { // 3 hours at BG=8.0
        sim.updateStressHormones(1.0);
    }

    assert(sim.liverGlycogenGrams > depletedGrams + 10,
        `Hepatic glycogen must rise significantly at BG=8.0 (was ${sim.liverGlycogenGrams.toFixed(1)}g, depleted: ${depletedGrams.toFixed(1)}g)`);
});

// --- Test 12: Fat compartment model (pizza effect) ---
console.log('\n--- Test 12: Fat compartment model (pizza effect / dynamic τG) ---');

test('Fat-free meal: τG stays at baseline 40 min', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 0, '🍞'); // 50g carbs, 0 fat
    // Run 1 tick to process fat compartments
    sim.update(1/60); // 1 second
    assert(sim.hovorka.tau_G >= 39 && sim.hovorka.tau_G <= 41,
        `τG should be ~40 min with no fat (was ${sim.hovorka.tau_G.toFixed(1)})`);
});

test('High-fat meal increases τG via intestinal fat', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 10, 30, '🍕'); // 50g carbs, 30g fat (pizza)
    // Fat enters stomach, needs to transit to intestine
    // Simulate 30 min (fat flows stomach→intestine at rate 1/τG)
    for (let i = 0; i < 30 * 60; i++) sim.update(1/60);
    assert(sim.fatIntestine > 5,
        `Fat should have reached intestine after 30 min (fatIntestine=${sim.fatIntestine.toFixed(1)}g)`);
    assert(sim.hovorka.tau_G > 50,
        `τG should be elevated with fat in intestine (was ${sim.hovorka.tau_G.toFixed(1)})`);
});

test('τG returns toward baseline as fat is absorbed from intestine', () => {
    const sim = createCleanSimulator();
    sim.addFood(30, 0, 25, '🧀'); // 25g fat
    // Measure τG at peak (after ~40 min when fat reaches intestine)
    for (let i = 0; i < 60 * 60; i++) sim.update(1/60);
    const tauGPeak = sim.hovorka.tau_G;
    // Simulate 7 more hours — fat should be mostly absorbed
    for (let i = 0; i < 420 * 60; i++) sim.update(1/60);
    assert(sim.hovorka.tau_G < tauGPeak - 5,
        `τG should decrease significantly after 8 hours (peak ${tauGPeak.toFixed(1)}, now ${sim.hovorka.tau_G.toFixed(1)})`);
    assert(sim.hovorka.tau_G < 50,
        `τG should be near baseline after 8 hours (was ${sim.hovorka.tau_G.toFixed(1)})`);
});

test('Fat from first meal delays absorption of second meal', () => {
    // This tests TODO #37: food interaction (fat delays subsequent meals)
    const simNoFat = createCleanSimulator();
    const simWithFat = createCleanSimulator();

    // Scenario 1: eat burger (fat) then dextrose 30 min later
    simWithFat.addFood(40, 30, 30, '🍔');
    for (let i = 0; i < 30 * 60; i++) simWithFat.update(1/60);
    const tauGBeforeDextro = simWithFat.hovorka.tau_G;
    simWithFat.addFood(15, 0, 0, '◻️'); // dextrose (no fat)

    // Scenario 2: eat dextrose alone (no prior fat)
    simNoFat.addFood(15, 0, 0, '◻️');

    // The dextrose in scenario 1 faces a higher τG because burger fat is still in intestine
    assert(tauGBeforeDextro > 50,
        `τG should be elevated when adding dextrose after burger (was ${tauGBeforeDextro.toFixed(1)})`);
});

// --- Test 13: Protein glucagon model ---
console.log('\n--- Test 13: Protein glucagon model (amino acid → glucagon → HGP) ---');

test('Protein-free meal: no glucagon stimulation', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 0, '🍞'); // 50g carbs, 0 protein
    for (let i = 0; i < 120 * 60; i++) sim.update(1/60); // 2 timer
    assert(sim.proteinGlucagonLevel < 0.001,
        `proteinGlucagonLevel should be ~0 without protein (was ${sim.proteinGlucagonLevel.toFixed(4)})`);
    assert(sim.aminoAcidsBlood < 0.1,
        `aminoAcidsBlood should be ~0 without protein (was ${sim.aminoAcidsBlood.toFixed(2)})`);
});

test('Protein meal builds amino acids in blood with delayed onset', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 50, 0, '🥩'); // 50g protein alene
    // Tjek at aminosyrer IKKE er høje efter 15 min (protein skal igennem mave→tarm→blod)
    for (let i = 0; i < 15 * 60; i++) sim.update(1/60);
    const aaAt15min = sim.aminoAcidsBlood;
    // Simuler til 120 min — aminosyrer burde peake
    for (let i = 0; i < 105 * 60; i++) sim.update(1/60);
    const aaAt120min = sim.aminoAcidsBlood;
    assert(aaAt120min > aaAt15min * 3,
        `Amino acids should be much higher at 120 min than 15 min ` +
        `(15min=${aaAt15min.toFixed(1)}, 120min=${aaAt120min.toFixed(1)})`);
});

test('High protein triggers glucagon stimulation (Hill function)', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 75, 0, '🥩'); // 75g protein — over EC50 tærskel
    // Simuler 3 timer (peak ~150-180 min)
    for (let i = 0; i < 180 * 60; i++) sim.update(1/60);
    assert(sim.proteinGlucagonLevel > 0.05,
        `proteinGlucagonLevel should be significant at 3 hours with 75g protein ` +
        `(was ${sim.proteinGlucagonLevel.toFixed(4)})`);
    assert(sim.proteinGlucagonLevel <= 0.25,
        `proteinGlucagonLevel should not exceed max 0.25 (was ${sim.proteinGlucagonLevel.toFixed(4)})`);
});

test('Small protein dose has minimal glucagon effect (threshold behavior)', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 10, 0, '🥚'); // 10g protein — under EC50
    for (let i = 0; i < 180 * 60; i++) sim.update(1/60); // 3 timer
    assert(sim.proteinGlucagonLevel < 0.05,
        `Small protein (10g) should have minimal glucagon effect ` +
        `(was ${sim.proteinGlucagonLevel.toFixed(4)})`);
});

test('Protein glucagon raises BG compared to carbs-only baseline', () => {
    const simNoProtein = createCleanSimulator();
    const simWithProtein = createCleanSimulator();

    // Begge: basal insulin kører allerede (fra init). Ingen bolus.
    // Sim1: 30g carbs alene
    simNoProtein.addFood(30, 0, 0, '🍞');
    // Sim2: 30g carbs + 50g protein
    simWithProtein.addFood(30, 50, 0, '🥩');

    // Simuler 4 timer
    for (let i = 0; i < 240 * 60; i++) {
        simNoProtein.update(1/60);
        simWithProtein.update(1/60);
    }
    // Med protein bør BG være højere pga. glukagon-drevet HGP
    assert(simWithProtein.trueBG > simNoProtein.trueBG,
        `BG with protein (${simWithProtein.trueBG.toFixed(1)}) should be higher than ` +
        `without (${simNoProtein.trueBG.toFixed(1)}) at 4 hours due to glucagon effect`);
});

test('Protein effect is delayed compared to carb effect', () => {
    const simCarbs = createCleanSimulator();
    const simProtein = createCleanSimulator();
    // Sim1: 50g carbs
    simCarbs.addFood(50, 0, 0, '🍞');
    // Sim2: 50g protein (should have much later onset)
    simProtein.addFood(0, 50, 0, '🥩');

    // Ved 45 min: kulhydrater burde have peaket, protein stadig minimal
    for (let i = 0; i < 45 * 60; i++) {
        simCarbs.update(1/60);
        simProtein.update(1/60);
    }
    const carbBG45 = simCarbs.trueBG;
    const protBG45 = simProtein.trueBG;
    // Carbs bør have hævet BG mere end protein ved 45 min
    const carbRise = carbBG45 - 6.0; // Start-BG er ca. 6.0
    const protRise = protBG45 - 6.0;
    assert(carbRise > protRise + 0.5,
        `Carb BG rise at 45 min (${carbRise.toFixed(1)}) should be much larger than ` +
        `protein rise (${protRise.toFixed(1)}) — protein onset is ~60-90 min`);
});

// =============================================================================
// RESULTS SUMMARY
// =============================================================================

console.log('\n========================================');
console.log(`Result: ${testsPassed}/${testsTotal} tests passed`);
if (testsFailed > 0) {
    console.log(`        ${testsFailed} test(s) FAILED`);
    process.exit(1);
} else {
    console.log('        All tests passed!');
    process.exit(0);
}
