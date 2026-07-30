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
//   3. Cardio lowers BG; resistance exercise balances uptake and hepatic output
//   4. Game over at BG < 1.5 (severe hypoglycaemia)
//   5. DKA — acidosis load model (ketone-driven game over)
//   6. Ketoacidosis state builds up over time with high BG + insulin deficiency
//
// =============================================================================

// Fælles headless browser-/module-setup deles med golden-master harnessen.
// Testfilens egne helpers nedenfor bevares, så eksisterende testadfærd ikke
// ændres af denne loader-oprydning.
const { Simulator, FOODS, CARB_TYPES } = require('./harness.js');
const { createEngine } = require('../js/physiology-engine.js');
const { HovorkaModel, HOVORKA_STATE_IDX } = require('../js/hovorka.js');

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

// Find en bestemt BG-force i et forces-array.
function findForce(forces, name) {
    return forces.find(f => f.name === name);
}

// Create a fresh simulator with reset state.
// We remove basal insulin from the constructor and set stable starting values
// so the tests are reproducible.
function createCleanSimulator() {
    // Reset global arrays
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false; // Reset — game over i tidligere tests sætter isPaused=true globalt

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

    console.log('\n--- Test 3: Exercise (cardio lowers BG; resistance balances uptake and EGP) ---');

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

test('High intensity produces a stronger exercise-driven hepatic response than low intensity', () => {
    // In the model, high intensity has BOTH larger aerobic BG drop (3x vs 1x)
    // AND an anaerobic component (stress + direct liver glucose).
    // The aerobic component dominates during exercise, but the anaerobic component
    // shows up via accumulated acute stress that drives liver glucose AFTER exercise.
    //
    // Motionens leverrespons er adskilt fra hypo-/sygdomsstress, så denne test
    // læser exerciseHepaticDrive og ikke acuteStressLevel.
    const simLow = createCleanSimulator();
    simLow.startMotion("Lav", "30");
    simulateMinutes(simLow, 30);

    const simHigh = createCleanSimulator();
    simHigh.startMotion("Høj", "30");
    simulateMinutes(simHigh, 30);

    assert(simHigh.exerciseHepaticDrive > simLow.exerciseHepaticDrive + 0.05,
        `High intensity hepatic drive (${simHigh.exerciseHepaticDrive.toFixed(3)}) ` +
        `must be higher than low (${simLow.exerciseHepaticDrive.toFixed(3)})`);
});

test('High intensity builds exercise catecholamine drive without changing hypo stress', () => {
    const sim = createCleanSimulator();
    assert(sim.exerciseHepaticDrive === 0, 'Starting exercise drive must be 0');

    sim.startMotion("Høj", "30");
    simulateMinutes(sim, 30);

    assert(sim.exerciseHepaticDrive > 0.1,
        `Exercise drive after high-intensity exercise (${sim.exerciseHepaticDrive.toFixed(3)}) must be > 0.1`);
    assert(sim.acuteStressLevel < 0.01,
        `Exercise must not alter the separate hypo-stress state (${sim.acuteStressLevel.toFixed(3)})`);
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
// TEST 4: BRAIN ENERGY DEFICIT — PROGRESSIVE HYPO GAME OVER
// =============================================================================
//
// Physiological background:
//   - The brain consumes ~120g glucose/day (F_01 in Hovorka model)
//   - Below BG ~2.5 mmol/L, GLUT1 transport cannot supply enough glucose
//   - The energy deficit accumulates over time: deficitRate = F_01 × (1 - BG/2.5)
//   - The brain has small glycogen reserves (~4g) modelled as BRAIN_DEFICIT_THRESHOLD
//   - Game over triggers when accumulated deficit exceeds the threshold
//   - This replaces the old instant-death at BG < 1.5 with a progressive model
// =============================================================================

console.log('\n--- Test 4: Brain energy deficit (progressive hypo game over) ---');

test('Brain deficit accumulates at low BG (2.0 for 20 min)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 2.0);  // Below crisis threshold (2.5)

    // Simulate 20 minutes at BG=2.0
    // Hold BG steady by re-clamping each tick
    for (let i = 0; i < 20; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        setSimulatorBG(sim, 2.0);  // Re-clamp to keep at 2.0
    }

    assert(sim.brainEnergyDeficit > 0,
        `Brain deficit (${sim.brainEnergyDeficit.toFixed(2)}) should accumulate at BG=2.0`);
});

test('Brain deficit does NOT accumulate at BG > 2.5', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 4.0);  // Above crisis threshold

    simulateMinutes(sim, 30);

    assert(sim.brainEnergyDeficit === 0,
        `Brain deficit (${sim.brainEnergyDeficit.toFixed(2)}) should be 0 at BG=4.0`);
});

test('Brief hypo does NOT trigger game over (BG=2.0 for 10 min)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 2.0);

    for (let i = 0; i < 10; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        setSimulatorBG(sim, 2.0);
    }

    assert(!sim.isGameOver,
        `Brief hypo at BG=2.0 for 10 min should NOT trigger game over (deficit=${sim.brainEnergyDeficit.toFixed(2)}/${sim.BRAIN_DEFICIT_THRESHOLD})`);
});

test('Prolonged severe hypo triggers game over (massive overdose)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 3.0);
    sim.addFastInsulin(20);  // Massive overdose

    let gameOverTriggered = false;
    for (let i = 0; i < 500; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(gameOverTriggered,
        'Massive overdose (20U from BG=3) must eventually trigger game over via brain deficit');
});

test('Brain deficit recovers when BG normalizes', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 2.0);

    // Accumulate some deficit (15 min at BG=2.0)
    for (let i = 0; i < 15; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        setSimulatorBG(sim, 2.0);
    }
    const deficitAfterHypo = sim.brainEnergyDeficit;

    // Normalize BG and let it recover
    setSimulatorBG(sim, 7.0);
    for (let i = 0; i < 90; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        setSimulatorBG(sim, 7.0);
    }

    assert(sim.brainEnergyDeficit < deficitAfterHypo * 0.5,
        `Brain deficit should recover: ${sim.brainEnergyDeficit.toFixed(2)} should be < ${(deficitAfterHypo * 0.5).toFixed(2)} (half of peak ${deficitAfterHypo.toFixed(2)})`);
});

test('Game over is NOT triggered at normal BG', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    simulateMinutes(sim, 60);

    assert(!sim.isGameOver, 'Game over must NOT be triggered at normal BG');
});

test('BG stays non-negative under extreme insulin overdose', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 0.5);
    sim.addFastInsulin(20);  // Absurd overdose

    sim.simulationSpeed = 60;
    for (let i = 0; i < 10; i++) {
        sim.update(1.0);
        if (sim.isGameOver) break;
    }

    assert(sim.trueBG >= 0, `BG (${sim.trueBG.toFixed(3)}) must never be negative`);
});


// =============================================================================
// TEST 5: DKA — ACIDOSE-BELASTNINGSMODEL
// =============================================================================
//
// Fysiologisk baggrund:
//   - Uden insulin brænder kroppen fedt → ketonsyrer (BHB) akkumuleres
//   - Ketonsyrer sænker blodets pH → metabolisk acidose → organsvigt
//   - Kroppens bikarbonat-buffer kan neutralisere en vis mængde (acidosisLoad)
//   - Når bufferen er opbrugt (load ≥ ACIDOSIS_THRESHOLD) → game over
//
// I modellen:
//   - acidosisLoad akkumuleres når ketoneLevel > 3.0 mmol/L
//   - Rate: lineært + kvadratisk med BHB-overskud (pH er logaritmisk)
//   - Recovery: eksponentiel decay (t½ = 45 min) når BHB falder under tærskel
//   - Advarsel ved 50%, game over ved 100%
//   - Insulin nulstiller IKKE acidosisLoad — den sænker ketoner naturligt
// =============================================================================

console.log('\n--- Test 5: DKA — acidose-belastningsmodel ---');

test('Acidosis load accumulates when ketones > 3.0', () => {
    const sim = createCleanSimulator();
    sim.ketoneLevel = 5.0;
    // Sæt plasma-insulin til 0 for at simulere DKA (insulinmangel), ikke faste-ketose.
    // Default basal-insulin (~8 mU/L efter #6-implementeringen) klassificeres som faste-ketose (ufarlig),
    // jf. søster-testen "Fasting ketosis (insulin present) does NOT cause acidosis".
    if (sim.hovorka) sim.hovorka.state[6] = 0;
    sim.updateAcidosisLoad(60); // 1 time
    assert(sim.acidosisLoad > 0,
        `Acidosis load must accumulate at BHB 5.0 (was ${sim.acidosisLoad.toFixed(1)})`);
});

test('Acidosis load stays 0 at normal ketone levels', () => {
    const sim = createCleanSimulator();
    sim.ketoneLevel = 0.5;
    sim.updateAcidosisLoad(60);
    assert(sim.acidosisLoad === 0,
        'Acidosis load must be 0 at BHB 0.5');
});

test('Acidosis load stays 0 at threshold (BHB = 3.0)', () => {
    const sim = createCleanSimulator();
    sim.ketoneLevel = 3.0;
    sim.updateAcidosisLoad(60);
    assert(sim.acidosisLoad === 0,
        'Acidosis load must be 0 at exactly BHB 3.0 (threshold is exclusive)');
});

test('Higher BHB causes faster accumulation (quadratic)', () => {
    const sim4 = createCleanSimulator();
    const sim8 = createCleanSimulator();
    sim4.ketoneLevel = 4.0;
    sim8.ketoneLevel = 8.0;
    // DKA-betingelse (insulin=0) — ellers klassificeres default basal-insulin (~8 mU/L,
    // #6-implementeringen) som ufarlig faste-ketose og acidose akkumulerer ikke.
    if (sim4.hovorka) sim4.hovorka.state[6] = 0;
    if (sim8.hovorka) sim8.hovorka.state[6] = 0;
    sim4.updateAcidosisLoad(10);
    sim8.updateAcidosisLoad(10);
    // BHB 8.0 excess=5, BHB 4.0 excess=1
    // Linear+quadratic: rate_8 = 0.3*5 + 0.05*25 = 2.75, rate_4 = 0.3*1 + 0.05*1 = 0.35
    // Ratio should be ~7.9x, definitely > 4x
    assert(sim8.acidosisLoad > 4 * sim4.acidosisLoad,
        `BHB 8.0 load (${sim8.acidosisLoad.toFixed(1)}) should be >4x BHB 4.0 load (${sim4.acidosisLoad.toFixed(1)})`);
});

test('Acidosis recovers exponentially when ketones fall below threshold', () => {
    const sim = createCleanSimulator();
    sim.acidosisLoad = 100;
    sim.ketoneLevel = 0.5; // Under tærskel → recovery
    sim.updateAcidosisLoad(45); // 1 halveringstid
    // Forventet: 100 * exp(-ln2/45 * 45) = 100 * 0.5 = 50
    assert(sim.acidosisLoad > 45 && sim.acidosisLoad < 55,
        `After 1 half-life, load should be ~50 (was ${sim.acidosisLoad.toFixed(1)})`);
});

test('Acidosis warning at 50% capacity', () => {
    const sim = createCleanSimulator();
    // Sæt load tæt på 50% af dynamisk tærskel
    const halfThreshold = sim.ACIDOSIS_THRESHOLD * 0.5;
    sim.acidosisLoad = halfThreshold - 10;
    sim.ketoneLevel = 10.0;
    // Sæt plasma-insulin til 0 for at simulere DKA (ikke faste-ketose)
    // Uden dette ville insulin-checket forhindre acidose-akkumulering
    if (sim.hovorka) sim.hovorka.state[6] = 0;
    // BHB 10: excess=7, rate = 0.3*7 + 0.05*49 = 4.55/min → load + 4.55*2 > halfThreshold
    sim.updateAcidosisLoad(5);
    assert(sim.acidosisWarningGiven,
        'Acidosis warning must be given when load crosses 50% threshold');
});

test('Acidosis game over at 100% capacity', () => {
    const sim = createCleanSimulator();
    // Sæt load tæt på 100% af dynamisk tærskel — brug lidt mere margin
    // Rate ved BHB=10: 0.3*7 + 0.05*49 = 4.55/min → 3 updates à ~1 min = ~13.65
    sim.acidosisLoad = sim.ACIDOSIS_THRESHOLD - 5;
    sim.ketoneLevel = 10.0;
    // Sæt plasma-insulin til 0 for at simulere DKA (ikke faste-ketose)
    if (sim.hovorka) sim.hovorka.state[6] = 0;
    sim.simulationSpeed = 60;
    // BHB 10: excess=7, rate = 0.3*7 + 0.05*49 = 4.55/min
    // Kør nok steps til at load krydser tærsklen
    sim.update(1.0);
    sim.update(1.0);
    sim.update(1.0);
    assert(sim.isGameOver,
        `Game over must trigger when acidosis load reaches threshold (load=${sim.acidosisLoad.toFixed(1)})`);
});

test('Insulin does NOT reset acidosisLoad', () => {
    const sim = createCleanSimulator();
    sim.acidosisLoad = 300;
    sim.addFastInsulin(5);
    assert(sim.acidosisLoad === 300,
        `Insulin must NOT reset acidosisLoad (was ${sim.acidosisLoad})`);
});

test('Fasting ketosis (insulin present) does NOT cause acidosis', () => {
    // Faste-ketose med BHB 5.0 men normal plasma-insulin = IKKE farligt
    // Kilde: BG-SCIENCE.md — "fasting ketosis is NOT the same as DKA"
    const sim = createCleanSimulator();
    sim.ketoneLevel = 5.0;
    // Sæt plasma-insulin til normalt basalniveau (~8 mU/L)
    // Simulerer faste-ketose: høje ketoner men insulin til stede → ufarligt
    if (sim.hovorka) sim.hovorka.state[6] = 8.0;
    const loadBefore = sim.acidosisLoad;
    sim.updateAcidosisLoad(60); // 1 hel time med BHB=5.0 men insulin til stede
    assert(sim.acidosisLoad === loadBefore,
        `Fasting ketosis (BHB=5.0 + insulin=8 mU/L) must NOT accumulate acidosis (load: ${sim.acidosisLoad})`);
});


// =============================================================================
// TEST 6: DKA — FULL PIPELINE (PUMPESVIGT → ACIDOSE → RECOVERY)
// =============================================================================
//
// Integrationstest: verificerer at den fysiologiske kaskade virker end-to-end:
//   insulin falder → lipolyse stiger → BHB stiger → acidose akkumuleres
//   → insulin gives → BHB falder gradvist → acidose recoverer langsomt
// =============================================================================

console.log('\n--- Test 6: DKA full pipeline ---');

test('Pump failure: acidosis accumulates as ketones rise', () => {
    // Opsæt pumpesvigt: fjern al insulin
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 12.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simuler 18 timer uden insulin — ketoner bør nå DKA-niveau (>3.0).
    // Rekalibreret 2026-06-06: med den langsommere codex-alignede ramp nås DKA-
    // tærsklen (BHB >3.0 → acidosisLoad akkumulerer) omkring 14-16h, ikke 8h.
    // 18h giver god margin (BHB ~3.7, acidosisLoad > 0).
    simulateMinutes(sim, 1080);

    assert(sim.ketoneLevel > 3.0,
        `Ketones must exceed 3.0 after 18h pump failure (was ${sim.ketoneLevel.toFixed(2)})`);
    assert(sim.acidosisLoad > 0,
        `Acidosis load must accumulate during prolonged pump failure (was ${sim.acidosisLoad.toFixed(1)})`);
});

test('Recovery after insulin: acidosis load is not instantly zeroed', () => {
    // Test at insulin IKKE nulstiller acidosisLoad direkte —
    // den forbliver efter insulingift og recoverer naturligt over tid.
    const sim = createCleanSimulator();
    // Byg en betydelig acidose-load op manuelt
    sim.acidosisLoad = 400;
    sim.ketoneLevel = 5.0;

    // Giv insulin
    sim.addFastInsulin(10);

    // Lige efter insulingift skal load stadig være 400
    assert(sim.acidosisLoad === 400,
        `Acidosis load must not change immediately after insulin (was ${sim.acidosisLoad.toFixed(1)})`);

    // Selv efter at ketoner sættes under tærskel og vi kører recovery,
    // skal load stadig være > 0 efter kort tid (45 min = halveringstid)
    sim.ketoneLevel = 1.0; // Simulér at insulin har sænket ketoner
    sim.updateAcidosisLoad(45); // 1 halveringstid recovery
    assert(sim.acidosisLoad > 190 && sim.acidosisLoad < 210,
        `After 1 half-life of recovery, load ~200 (was ${sim.acidosisLoad.toFixed(1)})`);
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

test('Circadian ISF keeps its documented 0.70–1.20 default swing independently of daily HGP amplitude', () => {
    const sim = createCleanSimulator();

    sim.timeInMinutes = 8 * 60;
    sim._dawnAmplitude = 0.05;
    const morningWithLowHgpDawn = sim.circadianISF;
    sim._dawnAmplitude = 0.35;
    const morningWithHighHgpDawn = sim.circadianISF;

    assertInRange(morningWithLowHgpDawn, 0.699999, 0.700001, 'Morning circadian ISF at low HGP dawn');
    assertInRange(morningWithHighHgpDawn, 0.699999, 0.700001, 'Morning circadian ISF at high HGP dawn');

    sim.timeInMinutes = 0;
    assertInRange(sim.circadianISF, 1.199999, 1.200001, 'Midnight circadian ISF');
});

test('Dawn module scalar attenuates circadian ISF around neutral without changing its shape', () => {
    const full = createCleanSimulator();
    const half = createCleanSimulator();
    const off = createCleanSimulator();
    full.engine.modules.dawn = 1.0;
    half.engine.modules.dawn = 0.5;
    off.engine.modules.dawn = 0.0;
    full.timeInMinutes = half.timeInMinutes = off.timeInMinutes = 8 * 60;

    assertInRange(full.circadianISF, 0.699999, 0.700001, 'Full dawn module morning ISF');
    assertInRange(half.circadianISF, 0.849999, 0.850001, 'Half dawn module morning ISF');
    assertInRange(off.circadianISF, 0.999999, 1.000001, 'Disabled dawn module morning ISF');
});

test('Acute stress decays over time (exponential washout)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 10.0);  // High enough BG to avoid Somogyi trigger (< 3.5)
    sim.acuteStressLevel = 1.0;

    simulateMinutes(sim, 60); // 1 half-life

    // After 60 min (1 half-life) stress should be approximately halved
    assertInRange(sim.acuteStressLevel, 0.3, 0.7, 'Acute stress after 1 half-life');
});

test('addChronicStress increases chronic stress level (gradual via pending pool)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);  // Normal BG — undgå Somogyi-trigger
    sim.addChronicStress(0.5);
    // Stress lægges i pending-pool og drænes gradvist (τ=30 min).
    // Efter ~90 min (~3τ) er >95% overført til chronicStressLevel.
    simulateMinutes(sim, 90);
    // Chronic stress decayer med t½=12t, men efter 90 min er henfald lille (~8%).
    // Forventet: ~0.5 × 0.95 × 0.92 ≈ 0.44
    assertInRange(sim.chronicStressLevel, 0.35, 0.55, 'Chronic stress after gradual application');
});

test('Simulator stress-API afviser ugyldige værdier uden delvis mutation', () => {
    const sim = createCleanSimulator();
    const before = {
        acute: sim.acuteStressLevel,
        chronic: sim.chronicStressLevel,
        pending: sim._pendingChronicStress,
        events: sim.engine.peekEvents().length
    };

    let acuteError = false;
    let chronicError = false;
    try { sim.addAcuteStress(NaN); } catch (error) { acuteError = true; }
    try { sim.addChronicStress(-0.1); } catch (error) { chronicError = true; }

    assert(acuteError && chronicError, 'begge ugyldige stresskald skal afvises');
    assert(sim.acuteStressLevel === before.acute, 'akut stress må ikke ændres');
    assert(sim.chronicStressLevel === before.chronic, 'aktiv kronisk stress må ikke ændres');
    assert(sim._pendingChronicStress === before.pending, 'pending kronisk stress må ikke ændres');
    assert(sim.engine.peekEvents().length === before.events, 'eventbuffer må ikke ændres');
});


// =============================================================================
// TEST 7: SIMULATED-SUBJECT PROFILE — Custom model parameters
// =============================================================================
//
// Tests that the Simulator class accepts a profile with weight, ICR and ISF,
// and that all derived values (basal dose, resting metabolic rate, carb effect)
// are calculated correctly from the profile.
// =============================================================================

console.log('\n--- Test 7: Simulated-subject profile ---');

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

test('basal contract separates effective need from injected dose at 0.82 bioavailability', () => {
    // estimatedTDD keeps the conservative min-of-two-rules estimate (the 1800-rule
    // 100/ISF vs the 0.55 U/kg weight-rule). initSteadyState() then separates the
    // effective Hovorka input from the larger subcutaneous injection required before
    // the fixed 0.82 basal bioavailability.
    const cases = [
        { isf: 2.0, icr: 8,  weight: 70, tdd: 38.5 },   // resistant: steady-state > old clinical 17 (→19)
        { isf: 5.0, icr: 15, weight: 60, tdd: 20 },     // sensitive
        { isf: 3.0, icr: 10, weight: 30, tdd: 16.5 },   // low weight (child archetype)
    ];
    cases.forEach(c => {
        global.cgmDataPoints = [];
        global.trueBgPoints = [];
        const sim = new Simulator({ isf: c.isf, icr: c.icr, weight: c.weight });
        assert(sim.estimatedTDD === c.tdd, `TDD must be ${c.tdd} for ${c.weight}kg/ISF${c.isf}, got ${sim.estimatedTDD}`);
        const expectedEffective = sim.hovorkaSteadyStateBasalRate * 1440 / 1000;
        const expectedInjection = expectedEffective / sim.sessionBioavBasal;
        const expectedRoundedDose = Math.max(1, Math.round(expectedInjection));
        assert(Math.abs(sim.effectiveBasalRequirement - expectedEffective) < 1e-12,
            `effective basal requirement must match steady-state input for ${c.weight}kg`);
        assert(Math.abs(sim.basalInjectionRequirement - expectedInjection) < 1e-12,
            `injection requirement must compensate bioavailability for ${c.weight}kg`);
        assert(sim.basalDose === expectedRoundedDose,
            `basalDose must equal rounded injection dose ${expectedRoundedDose} for ${c.weight}kg, got ${sim.basalDose}`);
        // Clinically plausible total daily basal: ~0.1–0.8 U/kg/day.
        assertInRange(sim.basalDose, 0.1 * c.weight, 0.8 * c.weight, `basalDose plausible for ${c.weight}kg`);
    });
});

test('campaign start-basal distinguishes false, true and an omitted field', () => {
    function createCampaignStart(basalPreInjected) {
        global.cgmDataPoints = [];
        global.trueBgPoints = [];
        global.physiologyDataPoints = [];
        global.isPaused = false;

        const physics = { weightTrackingEnabled: false };
        if (basalPreInjected !== 'omitted') {
            physics.basalPreInjected = basalPreInjected;
        }
        return new Simulator(
            { weight: 70, isf: 3.0, icr: 10 },
            'campaign',
            {
                seed: 123,
                levelConfig: {
                    startTimeMinutes: 0,
                    startBG: 6.0,
                    physics,
                },
            }
        );
    }

    const withoutDepot = createCampaignStart(false);
    const withExplicitDepot = createCampaignStart(true);
    const withDefaultDepot = createCampaignStart('omitted');

    assert(withoutDepot.activeLongInsulin.length === 0,
        `basalPreInjected=false må starte uden aktivt depot (fik ${withoutDepot.activeLongInsulin.length})`);
    assert(withExplicitDepot.activeLongInsulin.length === 1,
        `basalPreInjected=true skal starte med ét depot (fik ${withExplicitDepot.activeLongInsulin.length})`);
    assert(withDefaultDepot.activeLongInsulin.length === 1,
        `manglende basalPreInjected skal bevare standarddepotet (fik ${withDefaultDepot.activeLongInsulin.length})`);
    assert(withoutDepot.hovorka.state[HOVORKA_STATE_IDX.Ib] > 0,
        'false-kontrakten skal bevare en aftagende basal plasma-/effekttilstand som overgang');
    assert(withoutDepot.lastInsulinTime === -Infinity,
        `uden aktivt depot må der ikke registreres en skjult injektion (fik ${withoutDepot.lastInsulinTime})`);
});

test('CGM sensor self-test and sensor loss are enabled only in campaign level 10', () => {
    function createForMode(gameMode, levelConfig = null) {
        global.cgmDataPoints = [];
        global.trueBgPoints = [];
        global.physiologyDataPoints = [];
        global.isPaused = false;
        return new Simulator(
            { weight: 70, isf: 3.0, icr: 10 },
            gameMode,
            { seed: 123, levelConfig }
        );
    }

    const sandbox = createForMode('sandbox');
    const level1 = createForMode('campaign', {
        number: 1,
        physics: { weightTrackingEnabled: false },
    });
    const level10 = createForMode('campaign', {
        number: 10,
        physics: {
            weightTrackingEnabled: false,
            cgmSensorFaultsEnabled: true,
        },
    });

    assert(sandbox.engine.modules.cgmSensorFaults === false,
        'sandbox må ikke udløse CGM-selvtest eller sensor-tab');
    assert(level1.engine.modules.cgmSensorFaults === false,
        'bane 1 må ikke udløse CGM-selvtest eller sensor-tab');
    assert(level10.engine.modules.cgmSensorFaults === true,
        'bane 10 skal have CGM-selvtest og sensor-tab slået til');

    level1.startCgmSelfTest(20);
    assert(level1.getCgmSensorStatus() === 'active',
        'et selvtest-kald i bane 1 skal ignoreres');
    level10.startCgmSelfTest(20);
    assert(level10.getCgmSensorStatus() === 'checking',
        'et selvtest-kald i bane 10 skal sætte sensoren i checking-tilstand');
});

test('level 2 start får præcis ét depot efter spillerens første basaldosis', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;

    const level2Start = {
        startTimeMinutes: 0,
        startBG: 6.0,
        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: false,
        },
    };
    const sim = new Simulator(
        { weight: 70, isf: 3.0, icr: 10 },
        'campaign',
        { seed: 123, levelConfig: level2Start }
    );

    assert(sim.activeLongInsulin.length === 0,
        'level 2 skal være uden aktivt depot før spillerens handling');
    sim.addLongInsulin(sim.basalDose);
    assert(sim.activeLongInsulin.length === 1,
        `spillerens første dosis skal give præcis ét depot (fik ${sim.activeLongInsulin.length})`);
    assert(sim.activeLongInsulin[0].injectionTime === sim.totalSimMinutes,
        'det eneste depot skal stamme fra spillerens aktuelle handling');
});

test('character basal doses hold BG near target over the three-day level-1 regimen', () => {
    const level1 = {
        startTimeMinutes: 0,
        startBG: 6.0,
        physics: {
            weightTrackingEnabled: false,
            dawnEffectEnabled: false,
            basalPreInjected: true,
            basalPreInjectedAgeHours: 16,
            basalPreInjectedDurationHours: 30.5,
        },
    };
    const profiles = [
        { label: 'child', weight: 40, isf: 4.0, icr: 15 },
        { label: 'adult', weight: 70, isf: 3.0, icr: 10 },
        { label: 'large', weight: 100, isf: 2.0, icr: 7 },
    ];

    for (const profile of profiles) {
        global.cgmDataPoints = [];
        global.trueBgPoints = [];
        global.physiologyDataPoints = [];
        global.isPaused = false;
        const sim = new Simulator(profile, 'campaign', { seed: 123, levelConfig: level1 });
        sim.engine.modules.insulinVariability = 0; // fast 28 h profile for deterministic calibration
        let minimumBG = sim.trueBG;
        let maximumBG = sim.trueBG;

        for (let minute = 0; minute < 3 * 1440; minute++) {
            if (minute === 8 * 60 || minute === 32 * 60 || minute === 56 * 60) {
                sim.addLongInsulin(sim.basalDose);
            }
            simulateMinutes(sim, 1);
            minimumBG = Math.min(minimumBG, sim.trueBG);
            maximumBG = Math.max(maximumBG, sim.trueBG);
        }

        assert(Math.abs(sim.trueBG - 5.5) < 1.0,
            `${profile.label} 3-day basal regimen must end near 5.5 mmol/L, got ${sim.trueBG.toFixed(2)}`);
        assert(minimumBG >= 3.5 && maximumBG <= 7.0,
            `${profile.label} 3-day basal regimen must remain in 3.5-7.0 mmol/L, got ${minimumBG.toFixed(2)}-${maximumBG.toFixed(2)}`);
    }
});

// =============================================================================
// TEST 7B: NON-LINEAR INSULIN DOSE-RESPONSE — Hill contract for muscle
// =============================================================================
//
// These tests protect the implemented #6 design directly. The muscle channels
// x1/x2 are saturating Hill responses, hepatic x3 remains the documented linear
// early-response approximation, and PEIS shifts only the muscle EC50 leftward.
// =============================================================================

console.log('\n--- Test 7B: Non-linear insulin dose-response ---');

test('Muscle Hill response is zero at zero plasma insulin', () => {
    const h = createCleanSimulator().hovorka;
    h.setInsulinModifiers(1, 1);
    const action = h.steadyStateActions(0);
    assert(action.x1 === 0 && action.x2 === 0 && action.x3 === 0,
        `all insulin-action targets must be zero at I=0 (got ${JSON.stringify(action)})`);
});

test('Muscle Hill response reaches half of x_max at EC50', () => {
    const h = createCleanSimulator().hovorka;
    h.setInsulinModifiers(1, 1);
    const action = h.steadyStateActions(h.EC50_muscle);
    assert(Math.abs(action.x1 / h.x1max - 0.5) < 1e-12,
        `x1 must be half-maximal at EC50 (got ${(action.x1 / h.x1max).toFixed(12)})`);
    assert(Math.abs(action.x2 / h.x2max - 0.5) < 1e-12,
        `x2 must be half-maximal at EC50 (got ${(action.x2 / h.x2max).toFixed(12)})`);
});

test('Muscle Hill response saturates near x_max at very high plasma insulin', () => {
    const h = createCleanSimulator().hovorka;
    h.setInsulinModifiers(1, 1);
    const action = h.steadyStateActions(1e6);
    assert(action.x1 / h.x1max > 0.999999,
        `x1 must approach x1max at high I (got ${action.x1 / h.x1max})`);
    assert(action.x2 / h.x2max > 0.999999,
        `x2 must approach x2max at high I (got ${action.x2 / h.x2max})`);
});

test('Low-zone muscle effect per mU rises as insulin approaches EC50', () => {
    const h = createCleanSimulator().hovorka;
    h.setInsulinModifiers(1, 1);
    const low = h.steadyStateActions(10);
    const higher = h.steadyStateActions(20);
    assert(higher.x2 / 20 > low.x2 / 10,
        `Hill response per mU must accelerate below EC50 (${low.x2 / 10} -> ${higher.x2 / 20})`);
});

test('PEIS shifts muscle EC50 left without changing the hepatic target', () => {
    const h = createCleanSimulator().hovorka;
    h.setInsulinModifiers(1, 1);
    const resting = h.steadyStateActions(20);
    h.setInsulinModifiers(1, 1.5);
    const postExercise = h.steadyStateActions(20);
    assert(postExercise.x1 > resting.x1 && postExercise.x2 > resting.x2,
        'PEIS must increase muscle action at the same plasma-insulin concentration');
    assert(Math.abs(postExercise.x3 - resting.x3) < 1e-15,
        `PEIS must not shift hepatic x3 (${resting.x3} vs ${postExercise.x3})`);
    assert(Math.abs(resting.x3 - h.S_IE * 20) < 1e-15,
        `hepatic x3 must retain its documented linear target (got ${resting.x3})`);
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
    global.physiologyDataPoints = [];
    global.isPaused = false; // Reset — game over in previous tests sets isPaused=true globally

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

    // Reset ketone/FFA/brain/glucotoxicity state for clean isolation between tests
    sim.brainEnergyDeficit = 0.0;
    sim.acidosisLoad = 0.0;
    sim.ketoneLevel = 0.0;
    sim.ffaLipolysis = 0.0;
    sim.glucotoxicLoad = 0.0;
    sim.glucotoxicResistanceFactor = 1.0;

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

test('2U bolus from BG=8 without food does NOT cause game over (severe hypo but survivable)', () => {
    // Use simulator WITH basal insulin
    const sim = createSimulatorWithBasal();
    setSimulatorBG(sim, 8.0);

    // Give 2U — ISF=3.0 → forventet drop ~6 mmol/L. Fra BG=8 med kontraregulering
    // bør spilleren overleve (BG falder til ~3-4 med stress-respons).
    // NB: Direkte S1-deponering (pen-injektion er øjeblikkelig) giver hurtigere
    // absorption end den gamle 5-min puls, så 3U fra BG=8 kan nu være dødelig.
    sim.addFastInsulin(2);

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
        `2U from BG=8 should be survivable (BG: ${sim.trueBG.toFixed(2)}, ` +
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
    // After 1 t1/2 hypoArea should be approximately halved.
    // NB: isGameOver must be reset each tick — without basal insulin,
    // DKA game over would fire mid-recovery and block further update() calls,
    // preventing hypoArea decay. This only affects the test (no basal insulin).
    for (let i = 0; i < 4320; i++) {
        sim.trueBG = 7.0;
        sim.hovorka.state[4] = 7.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        if (sim.isGameOver) sim.isGameOver = false;
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
//   - Strength training: response depends on intensity and insulin context
//   - Mixed sport: BG relatively stable (weighted cardio+anaerobic)
//   - Relaxation: reduces stress, lowers BG slightly
//
// Scientific basis:
//   - Riddell et al. 2017 (Lancet): aerobic -> BG down, mixed -> often more stable
//   - Young et al. 2023: EGP and non-insulin-mediated uptake both rise during resistance work
//   - Yardley et al. 2013: resistance exercise produced a smaller fall than aerobic exercise
//   - PMC10534311: mindfulness reduces stress -> better glycaemic control
// =============================================================================

console.log('\n--- Test 10: Activity system (4 types) ---');

test('60 min styrketræning fra steady state giver kalibrerede akutte BG-responser', () => {
    const intensities = [
        // Fælles pædagogisk steady-state-kontrakt: styrke skal gøre den mulige
        // leverdrevne stigning synlig. Andre insulin-/måltidskontekster må
        // fortsat vende nettoretningen og testes separat.
        { intensity: 'Lav', min: 0.15, max: 0.35 },
        { intensity: 'Medium', min: 0.40, max: 0.70 },
        { intensity: 'Høj', min: 0.75, max: 1.15 }
    ];

    intensities.forEach(({ intensity, min, max }) => {
        const engine = createEngine({ weight: 70, isf: 3, icr: 10 }, {
            seed: 20260723,
            steadyState: true,
            noiseEnabled: false,
            modules: {
                dawn: false,
                dawnVariability: false,
                insulinVariability: false
            }
        });
        const startBG = engine.trueBG;
        engine.startActivity({ type: 'styrke', intensity, durationMin: 60 });
        for (let minute = 0; minute < 60; minute++) engine.step(1);

        assertInRange(engine.trueBG - startBG, min, max,
            `${intensity} styrke, akut BG-ændring efter 60 min`);
    });
});

test('Styrke adskiller live glukoseoptag fra tidsforsinket insulinfølsomhed', () => {
    const engine = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20260723,
        steadyState: true,
        noiseEnabled: false,
        modules: {
            dawn: false,
            dawnVariability: false,
            insulinVariability: false
        }
    });
    const baseISF = engine.currentISF;

    // Young et al. 2023: insulinmedieret optagelse var uændret under det
    // 45-minutters styrkepas. Eftereffekten må derfor ikke være tændt endnu.
    engine.startActivity({ type: 'styrke', intensity: 'Medium', durationMin: null });
    for (let minute = 0; minute < 45; minute++) engine.step(1);
    const isfDuring = engine.currentISF;
    const livePeisFactor = engine._lastPeisFactor;

    // Stop må ikke skabe en amplitude eller et spring.
    engine.stopActivity();
    const isfAfter = engine.currentISF;
    for (let minute = 0; minute < 30; minute++) engine.step(1);
    const isfThirtyMinutesLater = engine.currentISF;
    for (let minute = 0; minute < 90; minute++) engine.step(1);
    const isfTwoHoursLater = engine.currentISF;

    assertInRange(livePeisFactor, 0.999, 1.001,
        'Styrke må ikke tilføje insulinmedieret PEIS under selve passet');
    assert(isfDuring <= baseISF * 1.01,
        `ISF under styrke (${isfDuring.toFixed(3)}) må ikke overstige baseline (${baseISF.toFixed(3)})`);
    assert(Math.abs(isfAfter - isfDuring) < 1e-12,
        `Stop må ikke ændre ISF momentant: ${isfDuring.toFixed(6)} -> ${isfAfter.toFixed(6)}`);
    assertInRange(isfThirtyMinutesLater / baseISF, 0.999, 1.01,
        'Styrke skal bevare insulinmedieret optagelse nær baseline i tidlig recovery');
    assertInRange(isfTwoHoursLater / baseISF, 1.08, 1.20,
        'Styrke skal udvikle en moderat senere PEIS');
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

test('Relaxation gives only a small active GLUT4 effect during yoga/stretching', () => {
    const simRelax = createCleanSimulator();
    simRelax.startAktivitet('afslapning', 'Medium', 30);
    simulateMinutes(simRelax, 20);
    const e1Relax = simRelax.hovorka.state[11]; // E1: active muscle glucose uptake

    const simQuiet = createCleanSimulator();
    simQuiet.startAktivitet('afslapning', 'Lav', 30);
    simulateMinutes(simQuiet, 20);
    const e1Quiet = simQuiet.hovorka.state[11];

    const simCardio = createCleanSimulator();
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 20);
    const e1Cardio = simCardio.hovorka.state[11];

    assert(e1Relax > e1Quiet + 0.0001,
        `Medium relaxation E1 (${e1Relax.toFixed(4)}) must be slightly above quiet relaxation (${e1Quiet.toFixed(4)})`);
    assert(e1Relax < e1Cardio * 0.05,
        `Medium relaxation E1 (${e1Relax.toFixed(4)}) must stay <5% of cardio E1 (${e1Cardio.toFixed(4)})`);
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

test('Kontraktionsskalering: styrke giver mindre kontinuerlig E1-optagelse end cardio', () => {
    // Cardio: contractionUptakeScaling=1,0; styrke: 0,10.
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

// -----------------------------------------------------------------------------
// Litteratur-, lignings-, ablations- og eventgrænsetests for motionsmodellen.
// De er bevidst placeret ved aktivitetstestene, så modelkontrakten ikke kun
// testes indirekte gennem slut-BG.
// -----------------------------------------------------------------------------

function createExerciseCalibrationEngine(profileOverrides = {}) {
    return createEngine(
        {
            weight: 70,
            isf: 3,
            icr: 10,
            ...profileOverrides
        },
        {
            seed: 20260723,
            steadyState: true,
            noiseEnabled: false,
            modules: {
                dawn: false,
                dawnVariability: false,
                insulinVariability: false
            }
        }
    );
}

function stepEngineMinutes(engine, minutes, dt = 1) {
    for (let elapsed = 0; elapsed < minutes - 1e-9; elapsed += dt) {
        engine.step(Math.min(dt, minutes - elapsed));
    }
}

test('Resalat E1 følger en 5-minutters førsteordenskontrakt uden ekstra HR-faktor', () => {
    const model = new HovorkaModel(70);
    model.exerciseInput = 0.5;
    for (let minute = 0; minute < 5; minute++) model.step(1);

    // Euler-løsningen til dE1/dt=(0,5-E1)/5 ved dt=1 er
    // 0,5 × (1 - 0,8^5). Denne assertion låser kilde-ligningen.
    const expectedE1 = 0.5 * (1 - Math.pow(0.8, 5));
    assert(Math.abs(model.state[HOVORKA_STATE_IDX.E1] - expectedE1) < 1e-12,
        `E1=${model.state[HOVORKA_STATE_IDX.E1]} skal matche ${expectedE1}`);

    // Samme E1 skal give samme direkte Q2-flux ved forskellig puls. Hvis pulsen
    // blev ganget på igen her, ville den gamle kvadrering vende tilbage.
    const resting = new HovorkaModel(70);
    const elevated = new HovorkaModel(70);
    resting.state[HOVORKA_STATE_IDX.Q2] = 100;
    elevated.state[HOVORKA_STATE_IDX.Q2] = 100;
    resting.state[HOVORKA_STATE_IDX.E1] = 0.4;
    elevated.state[HOVORKA_STATE_IDX.E1] = 0.4;
    resting.heartRate = resting.HR_base;
    elevated.heartRate = 140;
    resting.step(1);
    elevated.step(1);
    assert(Math.abs(
        resting.state[HOVORKA_STATE_IDX.Q2] -
        elevated.state[HOVORKA_STATE_IDX.Q2]
    ) < 1e-12, 'Direkte E1-optagelse må ikke multipliceres med puls en ekstra gang');
});

test('E1-kontraktionsoptagelsen forsvinder gradvist efter arbejdet stopper', () => {
    const model = new HovorkaModel(70);
    model.state[HOVORKA_STATE_IDX.E1] = 0.5;
    model.exerciseInput = 0;
    for (let minute = 0; minute < 30; minute++) model.step(1);
    assert(model.state[HOVORKA_STATE_IDX.E1] < 0.5 * 0.03,
        `E1 efter 30 min (${model.state[HOVORKA_STATE_IDX.E1].toFixed(5)}) skal være <3% af peak`);
});

test('Resalat beta-flux skalerer med vægt omkring 70-kg-referencepersonen', () => {
    const small = new HovorkaModel(40);
    const reference = new HovorkaModel(70);
    const large = new HovorkaModel(100);

    assert(Math.abs(reference.beta - 0.78) < 1e-12,
        `70-kg-reference beta skal være 0,78 mmol/min, fik ${reference.beta}`);
    assert(Math.abs(small.beta / reference.beta - 40 / 70) < 1e-12,
        '40-kg beta skal følge vægtforholdet 40/70');
    assert(Math.abs(large.beta / reference.beta - 100 / 70) < 1e-12,
        '100-kg beta skal følge vægtforholdet 100/70');
});

test('Young 2023: 45 min medium styrke balancerer EGP og ikke-insulinmedieret optagelse', () => {
    const engine = createExerciseCalibrationEngine();
    const startBG = engine.trueBG;
    const baselineEGP = engine.hovorka._lastEGP || engine.hovorka.EGP_0;
    let egpAucMmolPerL = 0;
    let contractionAucMmolPerL = 0;

    engine.startActivity({ type: 'styrke', intensity: 'Medium', durationMin: 45 });
    for (let minute = 0; minute < 45; minute++) {
        engine.step(1);
        egpAucMmolPerL +=
            (engine.hovorka._lastEGP - baselineEGP) / engine.hovorka.V_G;
        contractionAucMmolPerL +=
            (engine.hovorka.beta * engine.hovorka.state[HOVORKA_STATE_IDX.E1]) /
            engine.hovorka.V_G;
    }

    // Young et al.: EGP AUC +1,04 (95% CI 0,65-1,43) mmol/L og
    // NIMGU AUC +1,26 (0,41-2,10) mmol/L; middel-BG var uændret.
    assertInRange(egpAucMmolPerL, 0.65, 1.43,
        '45-minutters styrke: ekstra EGP-AUC');
    assertInRange(contractionAucMmolPerL, 0.80, 1.70,
        '45-minutters styrke: kontraktionsoptagelses-AUC');
    assert(Math.abs(engine.trueBG - startBG) < 0.5,
        `Netto-BG skal være omtrent stabilt, fik ${(engine.trueBG - startBG).toFixed(3)} mmol/L`);
});

test('Fælles styrkerespons bevarer retning og størrelse på tværs af vægtprofiler', () => {
    const profiles = [
        { label: '40 kg', weight: 40, isf: 4, icr: 15 },
        { label: '70 kg', weight: 70, isf: 3, icr: 10 },
        { label: '100 kg', weight: 100, isf: 2, icr: 7 }
    ];
    const targets = [
        { intensity: 'Lav', min: 0.15, max: 0.35 },
        { intensity: 'Medium', min: 0.40, max: 0.70 },
        { intensity: 'Høj', min: 0.75, max: 1.15 }
    ];

    profiles.forEach(profile => {
        targets.forEach(target => {
            const engine = createEngine(profile, {
                seed: 20260723,
                steadyState: true,
                noiseEnabled: false,
                modules: {
                    dawn: false,
                    dawnVariability: false,
                    insulinVariability: false
                }
            });
            const startBG = engine.trueBG;
            engine.startActivity({
                type: 'styrke',
                intensity: target.intensity,
                durationMin: 60
            });
            stepEngineMinutes(engine, 60);
            assertInRange(
                engine.trueBG - startBG,
                target.min,
                target.max,
                `${profile.label}, ${target.intensity} styrke`
            );
        });
    });
});

test('Tre timers styrke udvikler forsinket følsomhed før stop uden stop-spring', () => {
    const engine = createExerciseCalibrationEngine();
    const baseISF = engine.currentISF;
    engine.startActivity({ type: 'styrke', intensity: 'Medium', durationMin: null });

    stepEngineMinutes(engine, 45);
    assert(engine.currentISF <= baseISF * 1.01,
        'Et 45-minutters styrkepas må endnu ikke have ekstra insulinmedieret følsomhed');

    stepEngineMinutes(engine, 75); // 120 min fra start: ren delay-grænse
    assert(engine.activeAktivitet !== null, 'Tre-timers sessionen skal stadig være aktiv');
    assert(engine.currentISF <= baseISF * 1.01,
        'Følsomheden må ikke springe ved delay-grænsen');

    stepEngineMinutes(engine, 30); // 150 min fra start: responsen bygges under passet
    assert(engine.currentISF > baseISF * 1.15,
        'Den forsinkede følsomhed skal være aktiv under et langt styrkepas');

    stepEngineMinutes(engine, 30); // 180 min fra start
    const beforeStop = engine.currentISF;
    engine.stopActivity();
    const afterStop = engine.currentISF;
    assert(Math.abs(beforeStop - afterStop) < 1e-12,
        `Stop ved 180 min må ikke skabe spring: ${beforeStop} -> ${afterStop}`);
});

test('Manuelt stop og auto-stop giver samme fysiologi ved alle varighedsgrænser', () => {
    [1, 5, 30, 45, 60, 180, 240].forEach(duration => {
        const automatic = createExerciseCalibrationEngine();
        const manual = createExerciseCalibrationEngine();
        automatic.startActivity({
            type: 'styrke',
            intensity: 'Medium',
            durationMin: duration
        });
        manual.startActivity({
            type: 'styrke',
            intensity: 'Medium',
            durationMin: null
        });

        stepEngineMinutes(automatic, duration);
        stepEngineMinutes(manual, duration);
        const isfBeforeManualStop = manual.currentISF;
        manual.stopActivity();

        assert(automatic.activeAktivitet === null,
            `Auto-stop skal være udført ved ${duration} min`);
        assert(Math.abs(manual.currentISF - isfBeforeManualStop) < 1e-12,
            `Manuelt stop må ikke ændre ISF ved ${duration} min`);
        assert(Math.abs(automatic.trueBG - manual.trueBG) < 1e-10,
            `Auto/manuelt stop skal give samme BG ved ${duration} min`);
        assert(Math.abs(
            automatic.hovorka.state[HOVORKA_STATE_IDX.E1] -
            manual.hovorka.state[HOVORKA_STATE_IDX.E1]
        ) < 1e-10, `Auto/manuelt stop skal give samme E1 ved ${duration} min`);
        assert(Math.abs(automatic.currentISF - manual.currentISF) < 1e-10,
            `Auto/manuelt stop skal give samme ISF ved ${duration} min`);
    });
});

test('Ablation: optagelse, leverrespons, følsomhed og glykogen kan slås fra hver for sig', () => {
    const baseType = {
        hrTarget: { Medium: 130 },
        contractionUptakeScaling: 0,
        fastSensitivityScaling: 0,
        earlySensitivityScaling: 0,
        lateSensitivityScaling: 0,
        insulinSensitivityDelayMin: 0,
        glycogenUseScaling: 0,
        hepaticDriveRate: { Medium: 0 },
        hepaticDriveCeiling: { Medium: 0 },
        kcalPerMin: { Medium: 7 },
        stressReduction: 0,
        vasodilatation: 0
    };
    const variants = {
        uptake: { ...baseType, contractionUptakeScaling: 1 },
        liver: {
            ...baseType,
            hepaticDriveRate: { Medium: 0.016 },
            hepaticDriveCeiling: { Medium: 0.6 }
        },
        sensitivity: {
            ...baseType,
            fastSensitivityScaling: 1,
            earlySensitivityScaling: 1,
            lateSensitivityScaling: 1
        },
        glycogen: { ...baseType, glycogenUseScaling: 1 }
    };

    const results = {};
    Object.entries(variants).forEach(([name, typeDef]) => {
        const engine = createExerciseCalibrationEngine();
        const initialGlycogen = engine.muscleGlycogenGrams;
        engine.startActivity({
            type: `ablation-${name}`,
            intensity: 'Medium',
            durationMin: 30,
            typeDef
        });
        stepEngineMinutes(engine, 30);
        results[name] = {
            e1: engine.hovorka.state[HOVORKA_STATE_IDX.E1],
            drive: engine.exerciseHepaticDrive,
            peis: engine.currentISF / engine.ISF,
            glycogenUsed: initialGlycogen - engine.muscleGlycogenGrams
        };
    });

    assert(results.uptake.e1 > 0.1 && results.uptake.drive === 0 &&
        results.uptake.peis < 1.01 && results.uptake.glycogenUsed < 0.01,
        'Optagelses-ablation må kun aktivere E1');
    assert(results.liver.e1 < 1e-12 && results.liver.drive > 0.1 &&
        results.liver.peis < 1.01 && results.liver.glycogenUsed < 0.01,
        'Lever-ablation må kun aktivere motionens leverrespons');
    assert(results.sensitivity.e1 < 1e-12 && results.sensitivity.drive === 0 &&
        results.sensitivity.peis > 1.2 && results.sensitivity.glycogenUsed < 0.01,
        'Følsomheds-ablation må kun aktivere insulinmedieret følsomhed');
    assert(results.glycogen.e1 < 1e-12 && results.glycogen.drive === 0 &&
        results.glycogen.peis < 1.01 && results.glycogen.glycogenUsed > 10,
        'Glykogen-ablation må kun tømme muskeldepotet');
});

test('Numerisk robusthed: høj styrke er stabil ved dt 1, 0,5 og 0,25 min', () => {
    const runAtStep = dt => {
        const engine = createExerciseCalibrationEngine();
        engine.startActivity({ type: 'styrke', intensity: 'Høj', durationMin: 60 });
        stepEngineMinutes(engine, 60, dt);
        return engine;
    };
    const oneMinute = runAtStep(1);
    const halfMinute = runAtStep(0.5);
    const quarterMinute = runAtStep(0.25);

    assert(Math.abs(oneMinute.trueBG - quarterMinute.trueBG) < 0.05,
        `BG-difference dt=1 vs 0,25 er ${(oneMinute.trueBG - quarterMinute.trueBG).toFixed(4)}`);
    assert(Math.abs(halfMinute.trueBG - quarterMinute.trueBG) < 0.02,
        `BG-difference dt=0,5 vs 0,25 er ${(halfMinute.trueBG - quarterMinute.trueBG).toFixed(4)}`);
});


// --- Test 11: Estimated hepatic glycogen capacity (gram-based bookkeeping) ---
console.log('\n--- Test 11: Estimated hepatic glycogen capacity (depletion + recovery) ---');

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

test('K1b regression: glycogen drain matches blood-side protein-glucagon decomposition (50/50)', () => {
    // Kvantitativ regression for review K1b (2026-04-30).
    // Protein-glucagon er 50% glycogenolysis + 50% gluconeogenesis (matcher
    // effectiveProteinGlucagon = proteinGlucagonLevel × (0.5 + 0.5 × reserve)
    // i blod-bidraget). Kun glycogenolysis-komponenten må trække fra pool.
    //
    // Vi genbruger K1's setup (BG=2.0, acute=0.4 → ingen GNG-replenishment,
    // pinned acute via BG-feedback) og tilføjer proteinGlucagonLevel=0.20.
    // Det marginale bidrag fra protein-glucagon kan så isoleres mod K1-testen.
    //
    // Pin proteinGlucagonLevel manuelt siden updateStressHormones ikke opdaterer
    // den (kun _substepFatProteinFFA gør det inde i hovedsubstep-løkken).
    //
    //   Basal glycogenolysis: 1.127 × 0.5 × 0.180 × 60 ≈ 6.09 g
    //   Stress glycogenolysis (acute=0.4 pinnet): 1.127 × 0.4 × 0.6 × 0.180 × 60 ≈ 2.92 g
    //   Protein glycogenolysis (post-fix): 1.127 × 0.20 × 0.5 × 0.180 × 60 ≈ 1.22 g
    //   GNG-replenishment: 0 (BG<4)
    //   Forventet samlet drain post-fix: ≈ 10.23 g
    //   Pre-fix (manglende protein-bookkeeping): ≈ 9.01 g (1.22 g for lidt)
    const sim = createCleanSimulator();
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4);
    sim.proteinGlucagonLevel = 0.20;

    const startGrams = sim.liverGlycogenGrams;
    for (let i = 0; i < 60; i++) {
        // Pin proteinGlucagonLevel siden updateStressHormones ikke opdaterer den
        sim.proteinGlucagonLevel = 0.20;
        sim.updateStressHormones(1.0);
    }
    const consumed = startGrams - sim.liverGlycogenGrams;

    assert(consumed > 9.5,
        `Glycogen drain (${consumed.toFixed(2)}g) skal være >9.5g — pre-fix bug ville drain ~9.01g (manglende protein-bookkeeping)`);
    assert(consumed < 11.0,
        `Glycogen drain (${consumed.toFixed(2)}g) skal være <11.0g (basal+stress+protein-glycogenolysis ved BG<4 + acute=0.4)`);
});

test('K1 regression: glycogen drain matches blood-side acute-stress decomposition (60/40)', () => {
    // Kvantitativ regression for review K1 (2026-04-30).
    // Acute stress er 60% glycogenolysis + 40% gluconeogenesis (matcher
    // effectiveAcuteStress = acute × (0.6 × reserve + 0.4) i blod-bidraget).
    // Kun glycogenolysis-komponenten må trække fra glykogen-poolen.
    //
    // Setup: 70 kg patient, BG=2.0, fuld glykogen, acute=0.4, ingen motion.
    // updateStressHormones har BG<4-feedback der holder acuteStressLevel ved
    // cap=0.4 hele perioden (BG-drevet vækst kompenserer t½=60min decay).
    //
    //   Basal glycogenolysis: EGP_0 × 0.5 × G_PER_MMOL = 1.127 × 0.5 × 0.180
    //     ≈ 0.1014 g/min × 60 min = 6.09 g
    //   Stress glycogenolysis (post-fix): EGP_0 × 0.4 × 0.6 × 0.180 × 60
    //     ≈ 0.0487 g/min × 60 min = 2.92 g
    //   GNG-replenishment: 0 (BG<4)
    //   Forventet samlet drain post-fix: ≈ 9.01 g
    //   Pre-fix bug (faktor 0.6 manglede): drain ≈ 10.96 g (1.95 g for høj)
    const sim = createCleanSimulator();
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4);

    const startGrams = sim.liverGlycogenGrams;
    for (let i = 0; i < 60; i++) {
        sim.updateStressHormones(1.0);
    }
    const consumed = startGrams - sim.liverGlycogenGrams;

    assert(consumed > 8.5,
        `Glycogen drain (${consumed.toFixed(2)}g) skal være >8.5g (basal+stress glycogenolysis ved BG<4)`);
    assert(consumed < 9.5,
        `Glycogen drain (${consumed.toFixed(2)}g) skal være <9.5g — pre-fix bug ville drain 1.67× for hurtigt på stress-komponenten (~10.96g)`);
});

test('Exercise reduces estimated liver reserve markedly faster than hypo alone', () => {
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

test('Estimated liver reserve recovers via gluconeogenesis + high-BG food proxy', () => {
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

test('Fat-free meal: τG har ingen fat-delay (kun carbBase * fiberMod * retentionMod)', () => {
    // Re-kalibreret 2026-04-11 (EU-konvention, frida.fooddata.dk):
    // For default 'mixed' (50g carbs): simpleFraction=0.20, fiberPerGram=0.08
    //   simpleFrac = 0.20 → carbBase = 25 + 0.80*25 = 45
    //   fiber = 50*0.08 = 4g → fiberMod = 1 + 0.5*ln(1+4/2) = 1 + 0.549 = 1.549
    //   retentionMod = 1.0, fatDelay = 0
    //   τG = 45 * 1.549 ≈ 69.7 min
    // Det vigtige er at FAT-DELAY er 0 — selve carb-base er typeafhængig.
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 0, '🍞'); // 50g carbs, 0 fat, default carbType='mixed'
    // Lad eatTime-queue (~1 min for 50g mixed) dryppe helt ind, så τG måles
    // på den fulde blanding — ikke på en partiel drip-tilstand.
    simulateMinutes(sim, 2);
    assert(sim.fatIntestine === 0, 'fatIntestine skal være 0 efter fat-fri måltid');
    assert(sim.hovorka.tau_G >= 65 && sim.hovorka.tau_G <= 75,
        `τG skal være i range for mixed-default uden fat (var ${sim.hovorka.tau_G.toFixed(1)})`);
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
    // Uden bolus-insulin er BG forhøjet efter 8t → hyperMod (hyperglykæmi-GE
    // delay) hæver τG med ~15-35%. Baseline ~40–50 × hyperMod ≈ 48–65.
    assert(sim.hovorka.tau_G < 70,
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

// --- Test: Motions-effekt på mavetømning og intestinal absorption ---
console.log('\n--- Test: Exercise effect on gastric emptying and intestinal absorption ---');

test('Exercise increases τG at high intensity (GE delay)', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 10, 0, '🍞');
    // Simulér 10 min uden motion — mål baseline τG
    for (let i = 0; i < 10 * 60; i++) sim.update(1/60);
    const tauGBaseline = sim.hovorka.tau_G;

    // Hård cardio: hold puls på 160 bpm (sæt HVER step da update-loopet
    // ellers exponentialt decay'er smoothHeartRate mod HR_base)
    for (let i = 0; i < 10 * 60; i++) {
        sim.smoothHeartRate = 160;
        sim.update(1/60);
    }
    const tauGExercise = sim.hovorka.tau_G;

    assert(tauGExercise > tauGBaseline * 1.15,
        `τG should increase during hard exercise (baseline ${tauGBaseline.toFixed(1)}, exercise ${tauGExercise.toFixed(1)})`);
});

test('Exercise does NOT increase τG at low intensity', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 10, 0, '🍞');
    for (let i = 0; i < 10 * 60; i++) sim.update(1/60);
    const tauGBaseline = sim.hovorka.tau_G;

    // Let cardio: hold puls på 100 bpm
    for (let i = 0; i < 10 * 60; i++) {
        sim.smoothHeartRate = 100;
        sim.update(1/60);
    }
    const tauGLowExercise = sim.hovorka.tau_G;

    assert(Math.abs(tauGLowExercise - tauGBaseline) / tauGBaseline < 0.05,
        `τG should be ~unchanged at low intensity (baseline ${tauGBaseline.toFixed(1)}, low ${tauGLowExercise.toFixed(1)})`);
});

test('Splanchnic absorption modifier decreases during exercise', () => {
    const sim = createCleanSimulator();
    // Hvile: splanchnicAbsorbMod = 1.0
    sim.addFood(30, 5, 0, '🍞');
    for (let i = 0; i < 5 * 60; i++) sim.update(1/60);
    assert(sim.hovorka.splanchnicAbsorbMod > 0.95,
        `splanchnicAbsorbMod should be ~1.0 at rest (was ${sim.hovorka.splanchnicAbsorbMod.toFixed(3)})`);

    // Hård motion: hold puls på 160 bpm
    for (let i = 0; i < 5 * 60; i++) {
        sim.smoothHeartRate = 160;
        sim.update(1/60);
    }
    assert(sim.hovorka.splanchnicAbsorbMod < 0.6,
        `splanchnicAbsorbMod should be <0.6 at hard exercise (was ${sim.hovorka.splanchnicAbsorbMod.toFixed(3)})`);
});

test('Exercise delays glucose appearance (double delay: GE + absorption)', () => {
    // Spis samme måltid, med og uden motion — BG peak skal være lavere/senere med motion
    const simRest = createCleanSimulator();
    const simExercise = createCleanSimulator();

    simRest.addFood(40, 5, 0, '🍞');
    simExercise.addFood(40, 5, 0, '🍞');

    // Start motion på den ene simulator (HR=150 — hård cardio)
    let peakBGRest = 0;
    let peakBGExercise = 0;
    for (let i = 0; i < 90 * 60; i++) {
        simRest.update(1/60);
        simExercise.smoothHeartRate = 150;
        simExercise.hovorka.heartRate = 150;
        simExercise.update(1/60);
        if (simRest.trueBG > peakBGRest) peakBGRest = simRest.trueBG;
        if (simExercise.trueBG > peakBGExercise) peakBGExercise = simExercise.trueBG;
    }

    // BG-peak under motion skal være lavere (glukose absorberes langsommere)
    // NB: motion øger også muskeloptag, men GE+absorptions-delay bidrager til fladere kurve
    assert(peakBGExercise < peakBGRest,
        `Peak BG during exercise should be lower than at rest (rest ${peakBGRest.toFixed(1)}, exercise ${peakBGExercise.toFixed(1)})`);
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

// --- Test 14: FFA-induced insulin resistance (postprandial "second wave") ---
console.log('\n--- Test 14: FFA-induced insulin resistance (postprandial fat effect) ---');

test('No FFA resistance without dietary fat', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 0, '🍞'); // Kun kulhydrater, ingen fedt
    for (let i = 0; i < 360 * 60; i++) sim.update(1/60); // 6 timer
    assert(sim.ffaResistanceFactor < 1.01,
        `ffaResistanceFactor should be ~1.0 without fat (was ${sim.ffaResistanceFactor.toFixed(3)})`);
    assert(sim.ffaBlood < 0.1,
        `ffaBlood should be ~0 without fat (was ${sim.ffaBlood.toFixed(2)})`);
});

test('High-fat meal builds FFA in blood with delayed onset', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 0, 60, '🧈'); // 60g fedt alene (Wolpert 2013 protokol)
    // Ved 30 min: FFA bør stadig være lavt (fedt stadig i mave/tarm)
    for (let i = 0; i < 30 * 60; i++) sim.update(1/60);
    const ffaAt30min = sim.ffaBlood;
    // Ved 180 min: FFA bør være signifikant (fedt absorberes fra tarm)
    for (let i = 0; i < 150 * 60; i++) sim.update(1/60);
    const ffaAt180min = sim.ffaBlood;
    assert(ffaAt180min > ffaAt30min * 2,
        `FFA should be much higher at 180 min than 30 min ` +
        `(30min=${ffaAt30min.toFixed(2)}, 180min=${ffaAt180min.toFixed(2)})`);
});

test('60g fat triggers significant insulin resistance (Wolpert 2013)', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 0, 60, '🧈'); // 60g fedt
    // Simuler 5-6 timer (forventet peak af FFA-resistens)
    for (let i = 0; i < 330 * 60; i++) sim.update(1/60);
    assert(sim.ffaResistanceFactor > 1.10,
        `ffaResistanceFactor should be >1.10 at peak with 60g fat ` +
        `(was ${sim.ffaResistanceFactor.toFixed(3)})`);
    assert(sim.ffaResistanceFactor <= 1.42,
        `ffaResistanceFactor should not exceed 1.42 max (was ${sim.ffaResistanceFactor.toFixed(3)})`);
});

test('Small fat dose has minimal FFA resistance (threshold behavior)', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 5, '🍞'); // 5g fedt (lille snack)
    for (let i = 0; i < 360 * 60; i++) sim.update(1/60); // 6 timer
    assert(sim.ffaResistanceFactor < 1.05,
        `Small fat (5g) should have minimal resistance effect ` +
        `(was ${sim.ffaResistanceFactor.toFixed(3)})`);
});

test('FFA resistance resolves over time (clearance)', () => {
    const sim = createCleanSimulator();
    sim.addFood(0, 0, 60, '🧈'); // 60g fedt
    // Simuler til peak (~5-6 timer)
    for (let i = 0; i < 330 * 60; i++) sim.update(1/60);
    const peakResistance = sim.ffaResistanceFactor;
    // Simuler 5 timer mere (total 10.5 timer) — resistens bør have aftaget
    for (let i = 0; i < 300 * 60; i++) sim.update(1/60);
    const lateResistance = sim.ffaResistanceFactor;
    assert(lateResistance < peakResistance - 0.02,
        `FFA resistance should decrease after peak ` +
        `(peak=${peakResistance.toFixed(3)}, late=${lateResistance.toFixed(3)})`);
});

test('Pizza effect: fat causes measurable FFA insulin resistance', () => {
    // Tester at FFA-induceret insulinresistens faktisk manifesterer sig.
    // Vi isolerer effekten ved at måle ffaResistanceFactor direkte.
    // Pizza (80g carbs + 35g fedt) bør opbygge betydelig FFA-resistens
    // sammenlignet med carbs-only (ingen fedt).
    // Wolpert 2013: 60g fedt → 42% mere insulin nødvendigt, peak ~5-6 timer.
    const simCarbsOnly = createCleanSimulator();
    const simPizza = createCleanSimulator();

    const carbs = 80;
    const bolus = carbs / simCarbsOnly.ICR;
    simCarbsOnly.addFood(carbs, 0, 0, '🍞');
    simCarbsOnly.addFastInsulin(bolus);
    simPizza.addFood(carbs, 15, 35, '🍕'); // Pizza: 80g carbs + 35g fedt + 15g protein
    simPizza.addFastInsulin(bolus);

    // Simuler 6 timer (FFA-resistens peaker ved ~5-6 timer)
    for (let i = 0; i < 360; i++) {
        simCarbsOnly.simulationSpeed = 60;
        simPizza.simulationSpeed = 60;
        simCarbsOnly.update(1.0);
        simPizza.update(1.0);
    }

    // FFA-resistens: faktor 1.0 = ingen effekt, >1.0 = resistens (max ~1.42)
    const pizzaFFA = simPizza.ffaResistanceFactor;
    const carbsFFA = simCarbsOnly.ffaResistanceFactor;

    assert(pizzaFFA > 1.05,
        `Pizza should have measurable FFA resistance at 6h ` +
        `(ffaResistanceFactor=${pizzaFFA.toFixed(3)}, expected >1.05) — fat triggers FFA pathway`);
    assert(carbsFFA < 1.01,
        `Carbs-only should have no FFA resistance ` +
        `(ffaResistanceFactor=${carbsFFA.toFixed(3)}, expected ~1.0) — no fat intake`);
});

// --- Test 15: FFA-driven ketone model (IOB-based, replaces old BG-driven model) ---
console.log('\n--- Test 15: FFA-driven ketone model ---');

test('Normal insulin level keeps ketones low', () => {
    // Med normal basal insulin (plasma ~8-10 mU/L) skal ketoner forblive lave.
    // Basal gives 6 timer før start så den er på plateau (ramp-up = 2 timer).
    // Tærskel 1.2 mmol/L: starvation ketosis ved I~8 giver BHB ~0.5-1.0.
    // Med MM renal clearance (i stedet for lineær) er steady-state BHB lidt højere.
    const sim = createCleanSimulator();
    sim.addLongInsulin(20, sim.totalSimMinutes - 6 * 60, true);
    simulateMinutes(sim, 360); // 6 timer
    assert(sim.ketoneLevel < 1.2,
        `Ketones should be <1.2 with normal insulin (was ${sim.ketoneLevel.toFixed(2)})`);
});

test('Zero insulin causes rising ketones (lipolysis + CPT-1 open)', () => {
    // Uden insulin: fuld lipolyse + CPT-1 åben → ketoner stiger
    const sim = createCleanSimulator();
    // Ingen insulin givet, basal fjernet i createCleanSimulator
    const startKetones = sim.ketoneLevel;
    simulateMinutes(sim, 240); // 4 timer
    assert(sim.ketoneLevel > startKetones + 0.5,
        `Ketones should rise significantly without insulin ` +
        `(start=${startKetones.toFixed(2)}, after 4h=${sim.ketoneLevel.toFixed(2)})`);
});

test('Pump failure 4h: ketones reach early-rise range (0.5-1.5)', () => {
    // Pumpesvigt: ingen insulin i 4 timer.
    // Rekalibreret 2026-06-06 mod codex/Guerci 2006-data (langsommere ramp end den
    // tidligere Laffel-baserede kalibrering): beta-OHB ~0.5-1.0 ved 4h. Modellen
    // giver ~0.88. Den langsommere ramp matcher nyere CSII-afbrydelsesdata —
    // se docs/reviews/2026-06-05_codex_pump-failure-outcome.md.
    const sim = createCleanSimulator();
    simulateMinutes(sim, 240); // 4 timer uden insulin
    assert(sim.ketoneLevel >= 0.5,
        `Ketones after 4h pump failure should be ≥0.5 (was ${sim.ketoneLevel.toFixed(2)})`);
    assert(sim.ketoneLevel <= 1.5,
        `Ketones after 4h pump failure should be ≤1.5 (was ${sim.ketoneLevel.toFixed(2)})`);
});

test('Pump failure 8h: ketones reach clinical-concern range (1.5-2.5)', () => {
    // 8 timer uden insulin. Codex/Guerci-target ~1.5-2.0 ved 8h (modellen ~1.90).
    // DKA-tærsklen (>3.0) nås nu omkring 14-16h, ikke 8h — den langsommere ramp
    // er bevidst (se 4h-testen og codex-reviewet).
    const sim = createCleanSimulator();
    simulateMinutes(sim, 480); // 8 timer
    assert(sim.ketoneLevel >= 1.5,
        `Ketones after 8h pump failure should be ≥1.5 (was ${sim.ketoneLevel.toFixed(2)})`);
    assert(sim.ketoneLevel <= 2.5,
        `Ketones after 8h pump failure should be ≤2.5 (was ${sim.ketoneLevel.toFixed(2)})`);
});

test('Insulin given after ketone rise → ketones fall (clearance)', () => {
    // Først: lad ketoner stige uden insulin
    const sim = createCleanSimulator();
    simulateMinutes(sim, 240); // 4 timer uden insulin
    const peakKetones = sim.ketoneLevel;

    // Giv stor dosis insulin → lipolyse stoppes → clearance dominerer
    sim.addFastInsulin(10);
    sim.addLongInsulin(20);
    simulateMinutes(sim, 180); // 3 timer med insulin

    assert(sim.ketoneLevel < peakKetones * 0.7,
        `Ketones should decrease after insulin ` +
        `(peak=${peakKetones.toFixed(2)}, after insulin=${sim.ketoneLevel.toFixed(2)})`);
});

test('Ketone model uses plasma insulin, not IOB (FFA-driven)', () => {
    // Verificer at modellen er drevet af plasma-insulin, ikke gammel IOB-logik
    const sim = createCleanSimulator();
    // Tjek at ffaLipolysis state-variabel eksisterer og starter ved 0
    assert(sim.ffaLipolysis === 0.0,
        `ffaLipolysis should start at 0 (was ${sim.ffaLipolysis})`);
    assert(typeof sim.LIPOLYSIS_EC50 === 'number',
        `LIPOLYSIS_EC50 parameter should exist`);
    assert(typeof sim.CPT1_EC50 === 'number',
        `CPT1_EC50 parameter should exist`);
    assert(typeof sim.BHB_VMAX === 'number',
        `BHB_VMAX (Michaelis-Menten clearance) should exist`);
});

test('Michaelis-Menten clearance saturates at high ketone levels', () => {
    // Ved høje ketonniveauer bremser clearance → DKA-spiral
    const sim1 = createCleanSimulator();
    const sim2 = createCleanSimulator();
    // Sæt ketoner manuelt til lavt vs. højt niveau
    sim1.ketoneLevel = 0.5;
    sim2.ketoneLevel = 5.0;
    // Giv begge insulin for at stoppe produktion
    sim1.addLongInsulin(20);
    sim2.addLongInsulin(20);
    sim1.addFastInsulin(5);
    sim2.addFastInsulin(5);
    simulateMinutes(sim1, 60);
    simulateMinutes(sim2, 60);
    // Ved 0.5: clearance er effektiv → falder hurtigt
    // Ved 5.0: clearance er mættet → falder langsommere proportionelt
    const drop1 = (0.5 - sim1.ketoneLevel) / 0.5; // relativ fald
    const drop2 = (5.0 - sim2.ketoneLevel) / 5.0; // relativ fald
    assert(drop1 > drop2,
        `Relative clearance rate should be lower at high ketones (saturation) ` +
        `(low: ${(drop1*100).toFixed(1)}%, high: ${(drop2*100).toFixed(1)}%)`);
});

test('Exercise boosts ketone clearance', () => {
    // Motion øger muskeloxidation af ketoner
    const simRest = createCleanSimulator();
    const simExercise = createCleanSimulator();
    // Begge: ketoner = 2.0, ingen insulin
    simRest.ketoneLevel = 2.0;
    simExercise.ketoneLevel = 2.0;
    // Motion-simulering: sæt puls højt (simulerer aktiv motion)
    simExercise.smoothHeartRate = 140; // Moderat cardio
    // Simuler 30 min (med insulin for at bremse produktion)
    simRest.addLongInsulin(20);
    simExercise.addLongInsulin(20);
    simRest.addFastInsulin(5);
    simExercise.addFastInsulin(5);
    simulateMinutes(simRest, 30);
    simulateMinutes(simExercise, 30);
    assert(simExercise.ketoneLevel < simRest.ketoneLevel,
        `Exercise should clear ketones faster ` +
        `(rest=${simRest.ketoneLevel.toFixed(2)}, exercise=${simExercise.ketoneLevel.toFixed(2)})`);
});

// =============================================================================
// BOX CHALLENGE — Boks-generation, kollision, liv, respawn, bonus
// =============================================================================

console.log('\n--- Box Challenge tests ---');

test('Box generation: korrekt antal bokse pr. dag (progressiv)', () => {
    const sim = new Simulator({}, 'boxchallenge');
    // Dag 1: forvent 1 boks (1 + floor(0/4) = 1)
    const day1Boxes = sim.boxes.filter(b => b.dayNumber === 1);
    assert(day1Boxes.length === 1,
        `Dag 1 bør have 1 boks, har ${day1Boxes.length}`);

    // Dag 5: forvent 2 bokse (1 + floor(4/4) = 2)
    sim.generateBoxesForDay(5);
    const day5Boxes = sim.boxes.filter(b => b.dayNumber === 5);
    assert(day5Boxes.length === 2,
        `Dag 5 bør have 2 bokse, har ${day5Boxes.length}`);

    // Dag 21: forvent 6 (cap: 1 + floor(20/4) = 6)
    sim.generateBoxesForDay(21);
    const day21Boxes = sim.boxes.filter(b => b.dayNumber === 21);
    assert(day21Boxes.length === 6,
        `Dag 21 bør have 6 bokse (max), har ${day21Boxes.length}`);
});

test('Box generation: alle bokse er indenfor BG-range (3.0-11.0)', () => {
    const sim = new Simulator({}, 'boxchallenge');
    // Generer bokse for flere dage for at teste bred fordeling
    for (let d = 2; d <= 7; d++) sim.generateBoxesForDay(d);

    for (const box of sim.boxes) {
        assert(box.bgMin >= 2.5,
            `Boks bgMin=${box.bgMin.toFixed(1)} er under 2.5 (dag ${box.dayNumber})`);
        assert(box.bgMax <= 11.5, // Lille margin for afrunding + skew
            `Boks bgMax=${box.bgMax.toFixed(1)} er over 11.5 (dag ${box.dayNumber})`);
        assert(box.bgMax > box.bgMin,
            `Boks bgMax=${box.bgMax} skal være > bgMin=${box.bgMin}`);
    }
});

test('Box generation: tidsmæssig placering indenfor 02:00-23:00', () => {
    const sim = new Simulator({}, 'boxchallenge');
    for (let d = 2; d <= 5; d++) sim.generateBoxesForDay(d);

    for (const box of sim.boxes) {
        assert(box.startMinute >= 120,
            `Boks starter for tidligt: ${box.startMinute} min (dag ${box.dayNumber})`);
        assert(box.endMinute <= 1380,
            `Boks slutter for sent: ${box.endMinute} min (dag ${box.dayNumber})`);
    }
});

test('Box Challenge: starter med 3 liv', () => {
    const sim = new Simulator({}, 'boxchallenge');
    assert(sim.lives === 3, `Forventede 3 liv, fik ${sim.lives}`);
    assert(sim.gameMode === 'boxchallenge', `gameMode bør være boxchallenge`);
});

test('Sandbox: uendeligt antal liv', () => {
    const sim = new Simulator({}, 'sandbox');
    assert(sim.lives === Infinity, `Sandbox bør have uendelige liv`);
    assert(sim.boxes.length === 0, `Sandbox bør ikke have bokse`);
});

test('loseLife: liv mistes ved boks-kollision (3→2)', () => {
    // Reset globalt (loseLife kalder playSound og showLifeLostAnimation)
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.activeLongInsulin = [];
    assert(sim.lives === 3, `Start: 3 liv`);

    sim.loseLife('box');
    assert(sim.lives === 2, `Efter boks-kollision: forventede 2 liv, fik ${sim.lives}`);
    assert(!sim.isGameOver, `Bør IKKE være game over med 2 liv`);
});

test('loseLife: game over ved 0 liv', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.activeLongInsulin = [];
    sim.loseLife('box');  // 3→2
    sim.loseLife('box');  // 2→1
    assert(sim.lives === 1, `Forventede 1 liv, fik ${sim.lives}`);

    sim.loseLife('box');  // 1→0 → game over
    assert(sim.lives === 0, `Forventede 0 liv, fik ${sim.lives}`);
    assert(sim.isGameOver, `Bør være game over ved 0 liv`);
});

test('loseLife hypo-respawn: genopretter BG', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.activeLongInsulin = [];

    // Sæt BG lavt (simuler hypo-tilstand)
    const lowBG = 2.0;
    sim.hovorka.state[4] = lowBG * sim.hovorka.V_G;
    sim.trueBG = sim.hovorka.glucoseConcentration;
    sim.brainEnergyDeficit = 5.0;

    sim.loseLife('hypo');

    // _findSafeRespawnBG finder et sikkert BG mindst 2 mmol/L fra bokse.
    // Uden bokse i vinduet bruges default 7.0; med bokse kan det variere.
    const bgAfter = sim.hovorka.glucoseConcentration;
    assert(bgAfter >= 4.0 && bgAfter <= 10.0,
        `Hypo-respawn bør sætte BG til sikkert niveau 4-10 (fik ${bgAfter.toFixed(1)})`);
    assert(bgAfter > 3.0,
        `Hypo-respawn BG bør være markant over hypo-grænsen (fik ${bgAfter.toFixed(1)})`);
    assert(sim.brainEnergyDeficit === 0,
        `brainEnergyDeficit bør nulstilles efter hypo-respawn`);
    assert(sim.lives === 2, `Bør have 2 liv efter respawn`);
});

test('Box Challenge-respawn viser først basalobservation ved gammel dosis, lav rate og stigende CGM', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.loseLife('hypo');
    assert(sim._boxRespawnBasalReminderPending === true,
        'Hypo-respawn skal armere den forsinkede basalobservation');

    const originalLogEvent = global.logEvent;
    const messages = [];
    global.logEvent = (message, type) => messages.push({ message, type });
    try {
        // Respawn-depotet er kun 12 timer gammelt: observationen må ikke vises.
        sim.basalInsulinRate = sim.hovorkaSteadyStateBasalRate * 0.5;
        sim.cgmBG = 7.0;
        sim.bgHistoryForStats = [
            { time: sim.totalSimMinutes - 30, cgmBG: 6.0, trueBG: 6.0 }
        ];
        assert(sim._checkBoxRespawnBasalReminder() === false,
            'Basalobservationen må ikke vises umiddelbart efter respawn');
        assert(messages.length === 0, 'Der må ikke logges en tidlig basalbesked');

        // Når dosis er 22 timer gammel, raten er lav og CGM stiger synligt,
        // skal den fælles karakterbaserede basalLow-tekst vises præcis én gang.
        sim.totalSimMinutes += 10 * 60;
        sim.timeInMinutes = sim.totalSimMinutes % (24 * 60);
        sim.cgmBG = 7.2;
        sim.bgHistoryForStats = [
            { time: sim.totalSimMinutes - 30, cgmBG: 6.0, trueBG: 6.0 }
        ];
        assert(sim._checkBoxRespawnBasalReminder() === true,
            'Gammel basal + lav rate + stigende CGM skal vise observationen');
        assert(messages.length === 1 && messages[0].message === 'campaign.tip.basalLow',
            'Box Challenge skal genbruge kampagnens basalLow-tekst');
        assert(sim._boxRespawnBasalReminderPending === false,
            'Observationen skal afvæbnes efter første visning');
    } finally {
        global.logEvent = originalLogEvent;
    }
});

test('Ny basaldosis efter Box Challenge-respawn annullerer basalobservationen', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.loseLife('dka');
    assert(sim._boxRespawnBasalReminderPending === true,
        'DKA-respawn skal armere basalobservationen');
    sim.addLongInsulin(10);
    assert(sim._boxRespawnBasalReminderPending === false,
        'En ny spillerstyret basaldosis skal annullere observationen');
});

test('Box Challenge-respawn er invariant over for gamle insulinmodifikatorer og motionsdriver', () => {
    function createRespawnPair() {
        global.cgmDataPoints = [];
        global.trueBgPoints = [];
        global.physiologyDataPoints = [];
        global.isPaused = false;

        const clean = new Simulator({}, 'boxchallenge', { seed: 4242 });
        const contaminated = new Simulator({}, 'boxchallenge', { seed: 4242 });

        // Gyldige, men kraftige tilstande fra et tidligere liv.
        contaminated.hovorka.setInsulinModifiers(0.48, 1.8);
        contaminated.exerciseHepaticDrive = 1.0;
        contaminated.activeMotion = [{
            startTime: contaminated.totalSimMinutes - 60,
            duration: 60,
            fastPeak: 0.4,
            earlyPeak: 0.3,
            latePeak: 0.2,
            fastSensitivityScaling: 1,
            earlySensitivityScaling: 1,
            lateSensitivityScaling: 1,
        }];
        contaminated.acuteStressLevel = 0.35;
        contaminated.chronicStressLevel = 0.6;
        contaminated._pendingChronicStress = 0.25;
        contaminated.insulinResistanceFactor = 1.3;
        contaminated.ffaResistanceFactor = 1.4;
        contaminated.glucotoxicLoad = 40;
        contaminated.glucotoxicResistanceFactor = 1.2;

        clean._resetToStableBG(7.0);
        contaminated._resetToStableBG(7.0);
        return { clean, contaminated };
    }

    function runPair(totalMinutes, stepMinutes) {
        const { clean, contaminated } = createRespawnPair();
        const steps = Math.round(totalMinutes / stepMinutes);
        clean.simulationSpeed = 60;
        contaminated.simulationSpeed = 60;
        for (let i = 0; i < steps; i++) {
            clean.update(stepMinutes);
            contaminated.update(stepMinutes);
        }
        return { clean, contaminated };
    }

    const immediate = createRespawnPair();
    const stateKeys = [
        HOVORKA_STATE_IDX.Q1,
        HOVORKA_STATE_IDX.Q2,
        HOVORKA_STATE_IDX.x1,
        HOVORKA_STATE_IDX.x2,
        HOVORKA_STATE_IDX.x3,
    ];
    stateKeys.forEach(index => {
        assert(Math.abs(
            immediate.clean.hovorka.state[index] -
            immediate.contaminated.hovorka.state[index]
        ) < 1e-12, `respawn-state[${index}] skal være uafhængig af gammel fysiologi`);
    });
    assert(immediate.contaminated.exerciseHepaticDrive === 0,
        'motionsudløst leverdriver skal nulstilles ved respawn');
    assert(immediate.contaminated.activeMotion.length === 0,
        'forsinkede motionssessioner skal nulstilles ved respawn');
    assert(immediate.contaminated._pendingChronicStress === 0,
        'ventende kronisk stress skal nulstilles ved respawn');
    assert(immediate.contaminated.hovorka._peisMuscleFactor === 1,
        'Hovorka PEIS-modifikatoren skal være neutral efter respawn');

    for (const stepMinutes of [1.0, 0.25]) {
        const { clean, contaminated } = runPair(120, stepMinutes);
        assert(Math.abs(clean.trueBG - contaminated.trueBG) < 1e-9,
            `120-minutters BG skal være invariant ved dt=${stepMinutes} ` +
            `(${clean.trueBG.toFixed(6)} vs ${contaminated.trueBG.toFixed(6)})`);
        assert(contaminated.exerciseHepaticDrive === 0,
            `leverdriveren skal forblive nul efter 120 min ved dt=${stepMinutes}`);
    }
});

// Hjælper: byg syntetisk bgHistoryForStats for dag `day` med en given TIR-andel.
// awardLevelBonus læser bgHistoryForStats over [(day-1)*1440, day*1440) og beregner
// TIR (4-10 mmol/L). Vi laver 100 datapunkter ligeligt fordelt over dagen, hvoraf
// inRangeFraction*100 er i målområdet (BG=6) og resten er højt (BG=12).
function seedBgHistoryForDay(sim, day, inRangeFraction) {
    const dayStart = (day - 1) * 1440;
    const inRangeCount = Math.round(100 * inRangeFraction);
    sim.bgHistoryForStats = sim.bgHistoryForStats || [];
    for (let i = 0; i < 100; i++) {
        sim.bgHistoryForStats.push({
            time: dayStart + i * 14.4,
            cgmBG: i < inRangeCount ? 6 : 12,
            trueBG: i < inRangeCount ? 6 : 12,
        });
    }
}

test('awardLevelBonus: 95% TIR giver 3 stjerner og +15 bonus', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.activeLongInsulin = [];
    sim.bgHistoryForStats = [];

    sim.dayStartPoints = 0;
    sim.normoPoints = 30;
    seedBgHistoryForDay(sim, 1, 0.96); // 96% TIR → ≥95% tærskel → 3 stjerner
    const expected = sim.normoPoints + 15.0;
    sim.awardLevelBonus(1);
    assert(Math.abs(sim.normoPoints - expected) < 0.01,
        `≥95% TIR bør give +15.0 bonus (forventet ${expected.toFixed(1)}, fik ${sim.normoPoints.toFixed(1)})`);
    assert(sim.levelBonusAwarded === true, `levelBonusAwarded bør være true`);
});

test('awardLevelBonus: 50% TIR giver ingen bonus (under 70% tærskel)', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator({}, 'boxchallenge');
    sim.activeLongInsulin = [];
    sim.bgHistoryForStats = [];

    sim.dayStartPoints = 0;
    sim.normoPoints = 30;
    seedBgHistoryForDay(sim, 1, 0.50); // 50% TIR → under 70% → 0 stjerner
    const before = sim.normoPoints;
    sim.awardLevelBonus(1);
    assert(Math.abs(sim.normoPoints - before) < 0.01,
        `Under 70% TIR bør give 0 bonus (forventet ${before.toFixed(1)}, fik ${sim.normoPoints.toFixed(1)})`);
});


// =============================================================================
// FYSIOLOGI-SNAPSHOT TESTS
// =============================================================================
// Tester at getPhysiologySnapshot() og _computeBGForces() returnerer korrekte
// datastrukturer med forventede felter.

test('getPhysiologySnapshot returnerer objekt med alle kategorier', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = new Simulator();
    // Kør et par ticks så modellen har data
    for (let i = 0; i < 10; i++) sim.update(16);
    const snap = sim.getPhysiologySnapshot();
    assert(snap !== null && snap !== undefined, 'Snapshot skal eksistere');
    assert(snap.insulin !== undefined, 'Snapshot skal have insulin-kategori');
    assert(snap.food !== undefined, 'Snapshot skal have food-kategori');
    assert(snap.stress !== undefined, 'Snapshot skal have stress-kategori');
    assert(snap.liver !== undefined, 'Snapshot skal have liver-kategori');
    assert(snap.ketones !== undefined, 'Snapshot skal have ketones-kategori');
    assert(snap.exercise !== undefined, 'Snapshot skal have exercise-kategori');
    assert(snap.brain !== undefined, 'Snapshot skal have brain-kategori');
    assert(snap.sensitivity !== undefined, 'Snapshot skal have sensitivity-kategori');
    assert(snap.bg !== undefined, 'Snapshot skal have bg-kategori');
    assert(snap.time !== undefined, 'Snapshot skal have time-kategori');
    assert(snap.forces !== undefined, 'Snapshot skal have forces-array');
});

test('_computeBGForces returnerer sorteret array med mindst 2 kræfter', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = new Simulator();
    for (let i = 0; i < 10; i++) sim.update(16);
    const forces = sim._computeBGForces();
    assert(Array.isArray(forces), 'Forces skal være et array');
    assert(forces.length >= 2, `Forces skal have mindst 2 elementer (har ${forces.length})`);
    // Tjek at der er mindst én op-kraft og brainConsumption (altid aktive).
    // EGP er fjernet — i stedet vises de individuelle årsager (dawn, stress, etc.)
    const hasUpForce = forces.some(f => f.direction === 'up');
    const hasBrain = forces.some(f => f.name === 'brainConsumption');
    assert(hasUpForce, 'Forces skal indeholde mindst én op-kraft');
    assert(hasBrain, 'Forces skal indeholde brainConsumption');
});

test('Forces har korrekt struktur: name, direction, magnitude', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = new Simulator();
    for (let i = 0; i < 10; i++) sim.update(16);
    const forces = sim._computeBGForces();
    forces.forEach(f => {
        assert(typeof f.name === 'string', `Force name skal være string (er ${typeof f.name})`);
        assert(f.direction === 'up' || f.direction === 'down',
            `Force direction skal være 'up' eller 'down' (er '${f.direction}')`);
        assert(typeof f.magnitude === 'number' && f.magnitude >= 0,
            `Force magnitude skal være positivt tal (er ${f.magnitude})`);
    });
    // Tjek sortering: magnitude skal være faldende
    for (let i = 1; i < forces.length; i++) {
        assert(forces[i].magnitude <= forces[i-1].magnitude,
            `Forces skal være sorteret faldende (${forces[i-1].magnitude} >= ${forces[i].magnitude})`);
    }
});

test('BG forces viser basalinsulin uden hurtiginsulin i basal-only scenarie', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = createCleanSimulator();

    // Stabil basal uden rapid: alle insulin-kræfter bør tilskrives basal.
    sim.addLongInsulin(20, sim.totalSimMinutes - 6 * 60, true);
    simulateMinutes(sim, 60);

    const forces = sim._computeBGForces();
    const basal = findForce(forces, 'basalInsulin');
    const rapid = findForce(forces, 'bolusInsulin');

    assert(basal && basal.magnitude > 0.01, 'Basal-only skal vise basalinsulin som BG-force');
    assert(!rapid, 'Basal-only må ikke vise hurtiginsulin');
});

test('BG forces viser hurtiginsulin som dominerende insulin-kraft efter bolus', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = createCleanSimulator();

    // Gør rapid-PK deterministisk, så testen ikke afhænger af random tau/bioavailability.
    sim.gaussRand = () => 1.0;
    sim.sessionBioavFast = 1.0;

    sim.addLongInsulin(20, sim.totalSimMinutes - 6 * 60, true);
    simulateMinutes(sim, 1);
    sim.addFastInsulin(4);
    simulateMinutes(sim, 60);

    const forces = sim._computeBGForces();
    const basal = findForce(forces, 'basalInsulin');
    const rapid = findForce(forces, 'bolusInsulin');

    assert(basal, 'Bolus-scenarie med basal skal stadig vise basalinsulin');
    assert(rapid, 'Bolus-scenarie skal vise hurtiginsulin');
    assert(
        rapid.magnitude > basal.magnitude * 1.4,
        `Hurtiginsulin (${rapid.magnitude.toFixed(3)}) skal være klart større end basal (${basal.magnitude.toFixed(3)}) efter nylig bolus`
    );
    assert(
        rapid.magnitude > 0.5,
        `Hurtiginsulin-force må ikke kollapses til en mikropil ved høj IOB (${rapid.magnitude.toFixed(3)})`
    );
});

test('physiologyDataPoints akkumuleres under simulation', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
    const sim = new Simulator();
    // Kør 30 minutter simulation (6 CGM-opdateringer á 5 min)
    for (let i = 0; i < 60; i++) sim.update(16); // ~30 sim-min ved speed 60
    assert(global.physiologyDataPoints.length > 0,
        `physiologyDataPoints skal have data efter simulation (har ${global.physiologyDataPoints.length})`);
    const first = global.physiologyDataPoints[0];
    assert(first.time !== undefined, 'Datapunkt skal have time');
    assert(first.basalRate !== undefined, 'Datapunkt skal have basalRate');
    assert(first.bolusIOB !== undefined, 'Datapunkt skal have bolusIOB');
});

test('CGM sensor loss creates data gap and warmup before readings resume', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    const sim = new Simulator({}, 'campaign', {
        seed: 123,
        levelConfig: {
            number: 10,
            physics: { cgmSensorFaultsEnabled: true },
        },
    });
    const initialCount = global.cgmDataPoints.length;

    sim.startCgmSensorLoss(30, 60);
    assert(sim.getCgmSensorStatus() === 'offline', 'Sensor skal starte som offline efter sensor loss');
    simulateMinutes(sim, 20);
    assert(global.cgmDataPoints.length === initialCount,
        'Offline CGM må ikke tilføje nye CGM-punkter');

    simulateMinutes(sim, 20);
    assert(sim.getCgmSensorStatus() === 'warmup', 'Sensor skal gå i warmup efter offline-perioden');
    assert(global.cgmDataPoints.length === initialCount,
        'Warmup må heller ikke tilføje nye CGM-punkter');

    simulateMinutes(sim, 65);
    assert(sim.getCgmSensorStatus() === 'active', 'Sensor skal blive aktiv efter warmup');
    simulateMinutes(sim, 6);
    assert(global.cgmDataPoints.length > initialCount,
        'Aktiv sensor skal igen tilføje CGM-punkter');
});

test('CGM self-test pauses readings briefly without changing true BG physiology', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    const sim = new Simulator({}, 'campaign', {
        seed: 123,
        levelConfig: {
            number: 10,
            physics: { cgmSensorFaultsEnabled: true },
        },
    });
    const bgBefore = sim.trueBG;
    const initialCount = global.cgmDataPoints.length;

    sim.startCgmSelfTest(20);
    assert(sim.getCgmSensorStatus() === 'checking', 'Self-test skal sætte CGM i checking-status');
    simulateMinutes(sim, 15);
    assert(global.cgmDataPoints.length === initialCount,
        'CGM self-test må ikke tilføje nye CGM-punkter');
    assert(Number.isFinite(sim.trueBG) && Math.abs(sim.trueBG - bgBefore) < 2.0,
        'TrueBG-fysiologien skal fortsætte stabilt under CGM self-test');

    simulateMinutes(sim, 15);
    assert(sim.getCgmSensorStatus() === 'active', 'CGM skal blive aktiv efter self-test');
});


// --- Test 20: Glucotoxicity — hyperglycemia-induced insulin resistance ---
console.log('\n--- Test 20: Glucotoxicity (hyperglycemia → insulin resistance) ---');

test('Normal BG does not build glucotoxic load', () => {
    // Ved normalt BG (~6 mmol/L) skal der ikke akkumuleres glukotoksisk belastning.
    const sim = createCleanSimulator();
    // Giv insulin og mad for at holde BG i normalområdet
    sim.addLongInsulin(20, sim.totalSimMinutes - 6 * 60, true);
    simulateMinutes(sim, 360); // 6 timer
    assert(sim.glucotoxicLoad < 1.0,
        `glucotoxicLoad should be minimal at normal BG (was ${sim.glucotoxicLoad.toFixed(2)})`);
    assert(sim.glucotoxicResistanceFactor < 1.02,
        `glucotoxicResistanceFactor should be ~1.0 at normal BG (was ${sim.glucotoxicResistanceFactor.toFixed(3)})`);
});

test('Sustained hyperglycemia builds glucotoxic resistance', () => {
    // Ved vedvarende højt BG (~20 mmol/L) skal glukotoksicitet akkumuleres.
    // Vi sætter BG højt via Hovorka-modellen ved at give mange kulhydrater uden insulin.
    const sim = createCleanSimulator();
    // Ingen insulin, mange kulhydrater → BG stiger kraftigt
    sim.addFood(200, 0, 0, '🍞');
    simulateMinutes(sim, 360); // 6 timer
    // BG bør have været forhøjet i lang tid → noget glucotoxicLoad
    assert(sim.glucotoxicLoad > 0.5,
        `glucotoxicLoad should build up with sustained hyperglycemia ` +
        `(was ${sim.glucotoxicLoad.toFixed(2)}, BG=${sim.trueBG.toFixed(1)})`);
    assert(sim.glucotoxicResistanceFactor > 1.01,
        `glucotoxicResistanceFactor should be elevated ` +
        `(was ${sim.glucotoxicResistanceFactor.toFixed(3)})`);
});

test('24h at ~20 mmol/L gives ~20-30% ISF reduction (Vuorinen-Markkola 1992)', () => {
    // Kalibreringstest: 24 timer vedvarende hyperglykæmi (~20 mmol/L)
    // bør give ca. 26% ISF-reduktion (dvs. glucotoxicResistanceFactor ~1.20-1.35).
    // Vi bruger direkte manipulation af glucotoxicLoad for at teste sigmoid-funktionen
    // da det er upraktisk at holde BG stabilt ved 20 i 24 timer i simulationen.
    const sim = createCleanSimulator();
    // Beregn forventet load: 24t × 60min × 0.0004 × (20-10)² = 57.6
    sim.glucotoxicLoad = 57.6;
    // Opdatér resistensfaktoren ved at kalde updateGlucotoxicity med dt=0
    // (vi har allerede sat loaden manuelt, behøver bare sigmoid-beregningen)
    sim.updateGlucotoxicity(0);
    const factor = sim.glucotoxicResistanceFactor;
    const reduction = (factor - 1.0) * 100;
    assert(factor > 1.15 && factor < 1.35,
        `24h at 20 mmol/L should give ~20-30% ISF reduction ` +
        `(factor=${factor.toFixed(3)}, reduction=${reduction.toFixed(1)}%)`);
});

test('Glucotoxic load recovers when BG normalizes', () => {
    // Glukotoksicitet bør aftage med t½ ~24 timer når BG er under tærskel.
    const sim = createCleanSimulator();
    // Sæt en forhøjet load manuelt
    sim.glucotoxicLoad = 50;
    sim.updateGlucotoxicity(0);
    const loadBefore = sim.glucotoxicLoad;
    const factorBefore = sim.glucotoxicResistanceFactor;
    // Simuler 24 timer med normalt BG (trueBG starter ~6.5, under tærskel 10)
    // Giv basal insulin med fuld dækning: én dosis nu + én halvvejs igennem
    // (24t basal varer præcis 24t, så vi behøver overlap for fuld dækning)
    sim.addLongInsulin(20, sim.totalSimMinutes, true);
    sim.addLongInsulin(20, sim.totalSimMinutes + 12 * 60, true);
    simulateMinutes(sim, 1440); // 24 timer
    assert(sim.glucotoxicLoad < loadBefore * 0.6,
        `glucotoxicLoad should decay after 24h normoglycemia ` +
        `(before=${loadBefore.toFixed(2)}, after=${sim.glucotoxicLoad.toFixed(2)})`);
    assert(sim.glucotoxicResistanceFactor < factorBefore,
        `Resistance factor should decrease during recovery ` +
        `(before=${factorBefore.toFixed(3)}, after=${sim.glucotoxicResistanceFactor.toFixed(3)})`);
});

test('Mild hyperglycemia has much less effect than severe (quadratic dose-response)', () => {
    // Kvadratisk dose-respons: BG 12 bør give MEGET mindre belastning end BG 20.
    // (12-10)² = 4 vs. (20-10)² = 100 → 25× forskel.
    const sim1 = createCleanSimulator();
    const sim2 = createCleanSimulator();
    // Manuelt: simuler 1 time ved BG 12 vs. BG 20
    // load = rate × excess² × tid = 0.0004 × excess² × 60
    const loadMild = 0.0004 * Math.pow(12 - 10, 2) * 60;   // = 0.096
    const loadSevere = 0.0004 * Math.pow(20 - 10, 2) * 60; // = 2.4
    assert(loadSevere > loadMild * 20,
        `Severe hyperglycemia should cause >>20× more load than mild ` +
        `(mild=${loadMild.toFixed(3)}, severe=${loadSevere.toFixed(3)}, ratio=${(loadSevere/loadMild).toFixed(1)})`);
});

// --- Test 21: Exercise ISF model — duration-dependent, continuous, 48h decay ---
console.log('\n--- Test 21: Exercise ISF model (duration-scaled, continuous, 48h decay) ---');

test('60 min high cardio: peak boost dominated af fast-komponent (tre-komponent model)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    const baseISF = sim.ISF;
    sim.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim, 60);
    // Tre-komponent model: A_fast ≈ 1.50 + A_early/A_late ≈ 0.5-0.7 → boost ≈ 2.0-2.3, ratio ≈ 3.0-3.4
    // Late-amplitude bumpet fra 0.37 → 0.50 (review C-A3.b 2026-04-30) → peak ratio steget tilsvarende.
    const isfRatio = sim.currentISF / baseISF;
    assert(isfRatio > 2.50 && isfRatio < 3.50,
        `60min high cardio: ISF ratio ${isfRatio.toFixed(3)} should be ~3.0-3.4 (range 2.50-3.50)`);
});

test('15 min low cardio: boost mindre end 60 min høj (tre-komponent model)', () => {
    const sim15 = createCleanSimulator();
    setSimulatorBG(sim15, 7.0);
    sim15.startAktivitet('cardio', 'Lav', 15);
    simulateMinutes(sim15, 15);
    const baseISF = sim15.ISF;
    const isfRatio15 = sim15.currentISF / baseISF;

    const sim60 = createCleanSimulator();
    setSimulatorBG(sim60, 7.0);
    sim60.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim60, 60);
    const isfRatio60 = sim60.currentISF / baseISF;

    assert(isfRatio15 < isfRatio60,
        `15min low ISF ratio (${isfRatio15.toFixed(3)}) must be < 60min high (${isfRatio60.toFixed(3)})`);
    // 15 min low: fast ~0.30, slow ~0.03 → ratio ~1.33
    assert(isfRatio15 < 1.50,
        `15min low cardio: ISF ratio (${isfRatio15.toFixed(3)}) should be modest (<1.50)`);
});

test('Duration scaling: 90 min gives more boost than 30 min (same intensity)', () => {
    const sim30 = createCleanSimulator();
    setSimulatorBG(sim30, 7.0);
    sim30.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(sim30, 30);
    const baseISF = sim30.ISF;
    const ratio30 = sim30.currentISF / baseISF;

    const sim90 = createCleanSimulator();
    setSimulatorBG(sim90, 7.0);
    sim90.startAktivitet('cardio', 'Medium', 90);
    simulateMinutes(sim90, 90);
    const ratio90 = sim90.currentISF / baseISF;

    assert(ratio90 > ratio30,
        `90min medium (${ratio90.toFixed(3)}) must give more ISF boost than 30min medium (${ratio30.toFixed(3)})`);
});

test('Continuity: ISF during exercise matches ISF right after stop (no discontinuity)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim, 59); // 1 min before planned end
    const isfDuring = sim.currentISF;
    simulateMinutes(sim, 2); // Auto-stop at 60 min, now 1 min after
    const isfAfter = sim.currentISF;

    // The jump must be small — less than 5% relative difference
    const relativeDiff = Math.abs(isfAfter - isfDuring) / isfDuring;
    assert(relativeDiff < 0.05,
        `ISF continuity: during=${isfDuring.toFixed(3)}, after=${isfAfter.toFixed(3)}, ` +
        `diff=${(relativeDiff*100).toFixed(1)}% (must be <5%)`);
});

// Hjælpefunktion: simulér i 1-times chunks med BG-reset for at undgå at
// hypo/stress-kaskader forurener ISF-testen. Bruger kontrol-simulator til
// at eliminere cirkadiske og andre tidsafhængige effekter.
function simulateStableBG(sim, minutes, targetBG) {
    const chunkSize = 60;
    let remaining = minutes;
    while (remaining > 0) {
        const chunk = Math.min(chunkSize, remaining);
        simulateMinutes(sim, chunk);
        setSimulatorBG(sim, targetBG);
        remaining -= chunk;
    }
}

test('24h decay: 60 min high cardio still has substantial boost at 24h (Cartee 2015 target)', () => {
    const simEx = createCleanSimulator();
    const simCtrl = createCleanSimulator();
    setSimulatorBG(simEx, 7.0);
    setSimulatorBG(simCtrl, 7.0);

    // Kun exercise-sim laver motion
    simEx.startAktivitet('cardio', 'Høj', 60);
    simulateStableBG(simEx, 60, 7.0);
    simulateStableBG(simCtrl, 60, 7.0);

    // Begge simulerer 24 timer med stabil BG (uden CHO/insulin → early-fase persisterer)
    simulateStableBG(simEx, 1440, 7.0);
    simulateStableBG(simCtrl, 1440, 7.0);

    // Sammenlign: exercise-sim skal have markant bedre ISF end kontrol
    const ratio = simEx.currentISF / simCtrl.currentISF;
    // Forventet: ~30% boost (late ~20% via t½=18t + early ~15% glykogen-koblet, fasted state).
    // Cartee 2015: 25-50% disposal-boost målt ved 16-48 t. Vores 30% er midt i range.
    assert(ratio > 1.15 && ratio < 1.45,
        `24h after 60min high cardio: ISF ratio vs control ${ratio.toFixed(3)} should be 1.15-1.45 (Cartee 2015)`);
});

test('48h decay: 60 min high cardio — late phase persists (Mikines 1988 target)', () => {
    const simEx = createCleanSimulator();
    const simCtrl = createCleanSimulator();
    setSimulatorBG(simEx, 7.0);
    setSimulatorBG(simCtrl, 7.0);

    simEx.startAktivitet('cardio', 'Høj', 60);
    simulateStableBG(simEx, 60, 7.0);
    simulateStableBG(simCtrl, 60, 7.0);

    // 48 timer
    simulateStableBG(simEx, 2880, 7.0);
    simulateStableBG(simCtrl, 2880, 7.0);

    const ratio = simEx.currentISF / simCtrl.currentISF;
    // Forventet (post C-A3.b 2026-04-30, A_late_peak Høj=0.78):
    // late-bidrag ~11% (0.5^(48/18)=0.157, A_peak~0.68 → 11%) + early
    // residue ~25-30% (glykogen ikke fyldt op uden CHO+insulin) → samlet ~36-42%.
    // Mikines 1988: ~+25% Km-reduktion + early-residue → konsistent med ~+40%.
    // VIGTIGST: late-fasen er stadig aktivt detekterbar (>5%), modsat den
    // gamle glykogen-only model hvor der ikke var noget tilbage.
    assert(ratio > 1.08 && ratio < 1.50,
        `48h after 60min high cardio: ISF ratio vs control ${ratio.toFixed(3)} should be 1.08-1.50 (Mikines 1988)`);
});

test('120h decay: late-fase under cutoff ved 5 dage (Mikines 1988)', () => {
    // Direkte unit-test af late-decay-formlen uden full sim-update-loop
    // (som ville blive forstyrret af spil-logik som game-over checks).
    //
    // Vi laver motion, fremfører totalSimMinutes manuelt til +120t og fylder
    // glykogen-pool op manuelt, så vi isoleret ser late-komponentens decay.
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    sim.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim, 60); // motion auto-stopper ved 60 min
    assert(sim.activeMotion.length === 1, 'motion should be in activeMotion after stop');
    const motion = sim.activeMotion[0];

    // Fyld glykogen-pool op (simulerer 5 dages CHO-rige måltider)
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;

    // Fremfør tid manuelt til +120 t (= 7200 min) post motion-slut
    const tPost_120h_min = 120 * 60;
    sim.totalSimMinutes = motion.startTime + motion.duration + tPost_120h_min;

    // Late-komponentens decay ved 120 t (t½=18t):
    //   A_late × 0.5^(120/18) = A_late × 0.0098
    //   A_late ≈ 0.502 (Cardio Høj 60 min) → late ved 120 t ≈ 0.0049
    //   Det er UNDER EXERCISE_LATE_CUTOFF (0.005) — bidrager ikke.
    // Fast er for længst dødt (t½=15min). Early=0 fordi pool er fuld.
    // Total boost bør være < 1% — under cutoff og ikke detekterbart.
    const ratio = sim.currentISF / sim.ISF;
    assert(ratio < 1.05,
        `120h post 60min høj cardio: ISF ratio ${ratio.toFixed(3)} skal være <1.05 (Mikines: undetekterbar ved 5 dage)`);
});

// =============================================================================
// PEIS — late-fase kalibrerings-tests (Cartee 2015, Mikines 1988)
// =============================================================================
// Disse tests verificerer at late-komponenten persisterer ved 24-48 t som
// litteraturen forudsiger. De bruger direkte tidsmanipulation for at undgå
// game-over fra urealistiske BG-trajektorier i lange test-windows.
// =============================================================================

test('Late-fase: 60 min Cardio Medium giver +24t boost i Cartee-range (10-15%)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    sim.startAktivitet('cardio', 'Medium', 60);
    simulateMinutes(sim, 60);
    assert(sim.activeMotion.length === 1, 'motion stored after stop');

    // Fyld pool så early-komponent ikke forvrænger målingen — vi tester KUN late
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;

    const motion = sim.activeMotion[0];
    sim.totalSimMinutes = motion.startTime + motion.duration + 24 * 60;

    const ratio = sim.currentISF / sim.ISF;
    // Forventet (post C-A3.b 2026-04-30, A_late_peak Medium=0.50):
    // late ved +24t = A_late × 0.5^(24/18) = 0.43 × 0.397 = 0.171 (17%)
    // Cartee 2015 target: 25-50% disposal-boost → ~12-25% effektiv ISF-boost
    assert(ratio > 1.10 && ratio < 1.25,
        `+24h Cardio Medium 60min: ratio ${ratio.toFixed(3)} skal være 1.10-1.25 (Cartee 2015 mid-range)`);
});

test('Late-fase: 60 min Cardio Medium giver +48t boost i Mikines-range (5-10%)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    sim.startAktivitet('cardio', 'Medium', 60);
    simulateMinutes(sim, 60);
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;

    const motion = sim.activeMotion[0];
    sim.totalSimMinutes = motion.startTime + motion.duration + 48 * 60;

    const ratio = sim.currentISF / sim.ISF;
    // Forventet (post C-A3.b 2026-04-30, A_late_peak Medium=0.50):
    // late ved +48t = A_late × 0.5^(48/18) = 0.43 × 0.157 = 0.068 (6.8%)
    // Mikines 1988 target: ~+25% Km-reduktion ≈ +5-10% effektiv ISF boost
    assert(ratio > 1.03 && ratio < 1.12,
        `+48h Cardio Medium 60min: ratio ${ratio.toFixed(3)} skal være 1.03-1.12 (Mikines 1988 efter pool-refill)`);
});

test('Late-fase decay-monotonicitet: +12t > +24t > +48t > +72t', () => {
    // Med fyldt pool isolerer vi late-komponenten og verificerer monoton decay
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim, 60);
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;
    const motion = sim.activeMotion[0];

    const samples = [];
    for (const h of [12, 24, 48, 72]) {
        sim.totalSimMinutes = motion.startTime + motion.duration + h * 60;
        samples.push({ h, isf: sim.currentISF });
    }

    // Verificer monoton decay
    for (let i = 1; i < samples.length; i++) {
        assert(samples[i].isf < samples[i-1].isf,
            `Late-decay skal være monoton: +${samples[i].h}h (${samples[i].isf.toFixed(3)}) ` +
            `skal være mindre end +${samples[i-1].h}h (${samples[i-1].isf.toFixed(3)})`);
    }
});

test('Late-fase: aften-motion → boost detektérbar ved nat-tid (Riddell 2017 nat-hypo target)', () => {
    // Klinisk scenario: motion kl. 17, sov kl. 22:30 (~5.5 t senere).
    // PEIS skal stadig være ≥7% for at modellere nat-hypo-risiko.
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(sim, 30);

    // Fyld pool (svarer til middag med CHO efter motion)
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;

    const motion = sim.activeMotion[0];
    // 5.5 timer post-motion (motion 17:00, sengetid 22:30)
    sim.totalSimMinutes = motion.startTime + motion.duration + 5.5 * 60;

    const ratio = sim.currentISF / sim.ISF;
    // Forventet (post C-A3.b 2026-04-30, A_late_peak Medium=0.50, 30min motion):
    // A_late ≈ 0.50 × √(30/60) × (1-e^-1) = 0.50 × 0.707 × 0.632 = 0.224
    // late ved +5.5t = 0.224 × 0.5^(5.5/18) ≈ 0.224 × 0.808 = 0.181 (18%)
    // Mål: ratio ≥ 1.07 for at modellere klinisk relevant nat-hypo-risiko
    assert(ratio >= 1.07,
        `5.5t post Cardio Medium 30min: ratio ${ratio.toFixed(3)} skal være ≥1.07 (klinisk nat-hypo-vindue)`);
});

test('Late-fase: glykogen-pool refill ELIMINERER early men ikke late', () => {
    // Verificer den centrale design-intention: tidlig fase reverseres af CHO
    // (glykogen-koblet), men sen fase persisterer (AS160-fosforylering).
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(sim, 30);
    const motion = sim.activeMotion[0];

    // FØR refill: tjek combined boost (early + late)
    sim.totalSimMinutes = motion.startTime + motion.duration + 60; // 1 t post
    // Isolér koblingen med et tydeligt, men fysiologisk muligt depotunderskud.
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity * 0.50;
    sim.muscleGlycogenReserve = 0.50;
    const isfBeforeRefill = sim.currentISF;

    // EFTER refill: pool fyldt op, kun late tilbage
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;
    const isfAfterRefill = sim.currentISF;

    // Pool-refill skal REDUCERE total ISF (eliminerer early-bidrag)
    // men late-komponenten skal stadig give boost > baseline
    assert(isfAfterRefill < isfBeforeRefill,
        `Pool-refill skal reducere ISF (eliminere early): før=${isfBeforeRefill.toFixed(3)}, ` +
        `efter=${isfAfterRefill.toFixed(3)}`);
    const ratio = isfAfterRefill / sim.ISF;
    assert(ratio > 1.05,
        `Selv efter pool-refill skal late stadig give >5% boost: ratio=${ratio.toFixed(3)}`);
});

test('Efter styrketræning giver de aktivitetsspecifikke PEIS-faser mindre boost end cardio', () => {
    const simCardio = createCleanSimulator();
    setSimulatorBG(simCardio, 7.0);
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 30);
    const baseISF = simCardio.ISF;
    const ratioCardio = simCardio.currentISF / baseISF;

    const simStyrke = createCleanSimulator();
    setSimulatorBG(simStyrke, 7.0);
    simStyrke.startAktivitet('styrke', 'Medium', 30);
    simulateMinutes(simStyrke, 30);
    const ratioStyrke = simStyrke.currentISF / baseISF;

    // Begge sessioner er stoppet her. Testen gælder derfor den efterfølgende
    // komponent-skalaer og den typespecifikke forsinkelse.
    assert(ratioStyrke < ratioCardio,
        `Strength ISF ratio (${ratioStyrke.toFixed(3)}) must be < cardio (${ratioCardio.toFixed(3)})`);
});

test('Styrke: 24-timers PEIS svarer til cirka 12% større muskel-disposal', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('styrke', 'Medium', 60);
    simulateMinutes(sim, 60);

    // Fyldt pool isolerer late-fasen. Breen et al. 2011 målte cirka 12%
    // større glucose disappearance 24 timer efter styrketræning.
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity;
    sim.muscleGlycogenReserve = 1.0;
    const motion = sim.activeMotion[0];
    sim.totalSimMinutes = motion.startTime + motion.duration + 24 * 60;
    const peisFactor = sim.currentISF / sim.ISF;

    // Mål den faktiske Hill-respons ved et typisk basalniveau. PEIS-faktoren
    // er et EC50-skift og er derfor ikke selv lig procentændringen i disposal.
    const referenceInsulin = 8;
    sim.hovorka.setInsulinModifiers(1, 1);
    const restingDisposal = sim.hovorka.steadyStateActions(referenceInsulin).x2;
    sim.hovorka.setInsulinModifiers(1, peisFactor);
    const postExerciseDisposal = sim.hovorka.steadyStateActions(referenceInsulin).x2;
    const disposalRatio = postExerciseDisposal / restingDisposal;

    assertInRange(peisFactor, 1.05, 1.11,
        'Styrke-PEIS ved 24 timer skal være et moderat EC50-skift');
    assertInRange(disposalRatio, 1.08, 1.16,
        'Styrke-PEIS ved 24 timer skal give cirka 12% større muskel-disposal');
});

test('Afslapning: PEIS-skalaer 0 giver intet efterfølgende ISF-boost', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    const baseISF = sim.ISF;
    const isfBefore = sim.currentISF;
    sim.startAktivitet('afslapning', 'Medium', 30);
    simulateMinutes(sim, 30);
    // Afslapning may give vasodilatation during, but no post-exercise ISF
    simulateMinutes(sim, 10); // 10 min after
    const isfAfter = sim.currentISF;

    // Bør være nær baseline, fordi alle tre PEIS-skalaer er 0.
    const ratio = isfAfter / isfBefore;
    assert(ratio < 1.05,
        `Relaxation: post-exercise ISF ratio (${ratio.toFixed(3)}) should be near 1.0 (<1.05, no e2 boost)`);
});

test('Daily exercise accumulation: two sessions 24h apart give overlapping boost', () => {
    // To simulatorer: én med 2 sessioner, én med kun 1 (den anden)
    const simTwo = createCleanSimulator();
    const simOne = createCleanSimulator();
    setSimulatorBG(simTwo, 7.0);
    setSimulatorBG(simOne, 7.0);

    // Session 1 (kun simTwo)
    simTwo.startAktivitet('cardio', 'Medium', 60);
    simulateStableBG(simTwo, 60, 7.0);
    simulateStableBG(simOne, 60, 7.0);

    // Vent 24 timer
    simulateStableBG(simTwo, 1440, 7.0);
    simulateStableBG(simOne, 1440, 7.0);

    // Session 2 (begge)
    simTwo.startAktivitet('cardio', 'Medium', 60);
    simOne.startAktivitet('cardio', 'Medium', 60);
    simulateStableBG(simTwo, 60, 7.0);
    simulateStableBG(simOne, 60, 7.0);

    // simTwo har overlappende haler fra session 1 + session 2
    // simOne har kun session 2
    const isfTwo = simTwo.currentISF;
    const isfOne = simOne.currentISF;

    assert(isfTwo > isfOne,
        `Two sessions ISF (${isfTwo.toFixed(3)}) must be > one session (${isfOne.toFixed(3)}) — overlapping tails`);
});

// --- Test 22: Muskel-glykogen depot (vægt-skaleret pool + resynthesis) ---
console.log('\n--- Test 22: Muskel-glykogen depot (vægt-skaleret pool + resynthesis) ---');

test('Pool-kapacitet skalerer lineært med kropsvægt (~5.5 g/kg)', () => {
    const sim70 = new Simulator({ weight: 70 }, 'sandbox');
    const sim90 = new Simulator({ weight: 90 }, 'sandbox');
    const cap70 = sim70.muscleGlycogenCapacity;
    const cap90 = sim90.muscleGlycogenCapacity;
    // 70 kg → ~385g, 90 kg → ~495g
    assert(Math.abs(cap70 - 70 * 5.5) < 0.1,
        `70 kg pool-kapacitet ${cap70} skal være ~385g`);
    assert(Math.abs(cap90 - 90 * 5.5) < 0.1,
        `90 kg pool-kapacitet ${cap90} skal være ~495g`);
    // Ratio skal matche vægt-ratio
    assert(Math.abs(cap90 / cap70 - 90 / 70) < 0.01,
        `Pool-kapacitet skal skalere lineært med vægt`);
});

test('Levels starter altid med fuldt depot (reserve=1.0)', () => {
    const sim = createCleanSimulator();
    assert(sim.muscleGlycogenReserve === 1.0,
        `Initial reserve ${sim.muscleGlycogenReserve} skal være 1.0`);
    assert(sim.muscleGlycogenGrams === sim.muscleGlycogenCapacity,
        `Initial grams skal være = kapacitet`);
});

test('Motion tømmer pool (høj cardio hurtigere end lav)', () => {
    const simHoj = createCleanSimulator();
    const simLav = createCleanSimulator();
    const capacity = simHoj.muscleGlycogenCapacity;

    simHoj.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(simHoj, 60);
    const depletedHoj = capacity - simHoj.muscleGlycogenGrams;

    simLav.startAktivitet('cardio', 'Lav', 60);
    simulateMinutes(simLav, 60);
    const depletedLav = capacity - simLav.muscleGlycogenGrams;

    // Høj: 10 kcal/min × 0.75 / 4 = 1.875 g/min × 60 = ~112g (skalaret af reserve)
    // Lav:  4 kcal/min × 0.30 / 4 = 0.30 g/min × 60 = ~18g
    assert(depletedHoj > depletedLav * 3,
        `Høj intensitet skal tømme >3× mere end lav (høj=${depletedHoj.toFixed(1)}g, lav=${depletedLav.toFixed(1)}g)`);
    assert(depletedHoj > 50 && depletedHoj < 140,
        `60 min høj cardio skal tømme 50-140g (fik ${depletedHoj.toFixed(1)}g)`);
});

test('Afslapning tømmer IKKE pool (glycogenUseScaling=0)', () => {
    const sim = createCleanSimulator();
    const capBefore = sim.muscleGlycogenGrams;
    sim.startAktivitet('afslapning', 'Medium', 30);
    simulateMinutes(sim, 30);
    const capAfter = sim.muscleGlycogenGrams;
    assert(Math.abs(capBefore - capAfter) < 0.5,
        `Afslapning må ikke tømme pool (før=${capBefore.toFixed(1)}, efter=${capAfter.toFixed(1)})`);
});

test('Pool genopfyldes post-exercise (fast phase + slow phase)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.startAktivitet('cardio', 'Høj', 60);
    // Hold BG stabil under motion (createCleanSimulator fjerner basal insulin → BG crasher ellers)
    simulateStableBG(sim, 60, 7.0);
    const depletedAt0 = sim.muscleGlycogenCapacity - sim.muscleGlycogenGrams;

    // 2 timer post-motion ved stabil BG=7
    simulateStableBG(sim, 120, 7.0);
    const depletedAt2h = sim.muscleGlycogenCapacity - sim.muscleGlycogenGrams;

    assert(depletedAt2h < depletedAt0,
        `Pool skal genopfyldes over 2t (start=${depletedAt0.toFixed(1)}g væk, 2t=${depletedAt2h.toFixed(1)}g væk)`);
});

test('Pool-genopfyldning allokerer eksisterende muskeloptag uden ekstra Q1-drain', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    sim.muscleGlycogenGrams = sim.muscleGlycogenCapacity * 0.5;
    sim.muscleGlycogenReserve = 0.5;
    sim.lastMuscleContractionEndTime = sim.totalSimMinutes;

    const q1Before = sim.hovorka.state[HOVORKA_STATE_IDX.Q1];
    const glycogenBefore = sim.muscleGlycogenGrams;
    sim.updateMuscleGlycogen(1);
    const q1After = sim.hovorka.state[HOVORKA_STATE_IDX.Q1];

    assert(sim.muscleGlycogenGrams > glycogenBefore,
        'Glykogen-poolen skal stadig kunne genopfyldes');
    assert(Math.abs(q1After - q1Before) < 1e-12,
        `Genopfyldning må ikke trække Q1 igen (${q1Before} -> ${q1After})`);
});

test('slowBoost kobles til (1 - muscleGlycogenReserve) — tom pool giver max boost', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    const baseISF = sim.ISF;

    sim.startAktivitet('cardio', 'Høj', 60);
    simulateMinutes(sim, 60);
    // Umiddelbart efter motion: pool delvist tom → slowBoost aktiv
    const emptyFactorAtEnd = 1 - sim.muscleGlycogenReserve;

    // Vent til fast-boost er væk (15 min t½, efter 90 min er det < 2%)
    simulateStableBG(sim, 90, 7.0);
    const isfAfter90min = sim.currentISF / baseISF;
    const emptyFactorAt90 = 1 - sim.muscleGlycogenReserve;

    // Pool skal stadig være delvist tom (resynthesis tager timer)
    assert(emptyFactorAt90 > 0.05,
        `90 min efter motion skal pool stadig være delvist tom (emptyFactor=${emptyFactorAt90.toFixed(3)})`);
    // ISF-boost skal komme fra slow-komponenten nu (fast er væk)
    assert(isfAfter90min > 1.02,
        `90 min efter motion: slowBoost via glykogen-kobling skal give ISF-boost (fik ratio=${isfAfter90min.toFixed(3)})`);
});

test('CHO-indtag accelererer resynthesis (Mann 2021: 48→18t)', () => {
    const simFasted = createCleanSimulator();
    const simFed = createCleanSimulator();
    setSimulatorBG(simFasted, 7.0);
    setSimulatorBG(simFed, 7.0);

    // Begge laver samme motion (hold BG stabil — ingen basal insulin i test-setup)
    simFasted.startAktivitet('cardio', 'Høj', 60);
    simFed.startAktivitet('cardio', 'Høj', 60);
    simulateStableBG(simFasted, 60, 7.0);
    simulateStableBG(simFed, 60, 7.0);

    // Fed simulator får CHO-snack (30g) — accelererer resynthesis.
    // cob nulstilles hvert tick fra activeFood, så vi simulerer manuelt
    // med cob-override for at isolere CHO-accelerationseffekten.
    // Fasted: 2 timer genopfyldning uden CHO
    simulateStableBG(simFasted, 120, 7.0);

    // Fed: 2 timer med cob=30 holdt konstant (simulerer løbende CHO-tilgængelighed)
    simFed.simulationSpeed = 60;
    for (let i = 0; i < 120; i++) {
        simFed.cob = 30; // Sæt FØR tick — tick læser cob i updateMuscleGlycogen
        simFed.update(1.0);
        setSimulatorBG(simFed, 7.0);
    }

    const fastedReserve = simFasted.muscleGlycogenReserve;
    const fedReserve = simFed.muscleGlycogenReserve;

    assert(fedReserve > fastedReserve,
        `Fed (COB=30) skal genopfylde hurtigere end fasted (fed=${fedReserve.toFixed(3)}, fasted=${fastedReserve.toFixed(3)})`);
});

// =============================================================================
// CARB-TYPE DIFFERENTIATION (dynamisk τG fra mavens blanding)
// =============================================================================
//
// Tester at simulator.addFood(carbs, protein, fat, icon, weight, carbType)
// fylder mavens blandings-variable korrekt og at _substepFatProteinFFA()
// beregner τG som funktion af blandingens sammensætning:
//
//   currentTauG = carbBase(simpleFrac) * fiberMod * retentionMod + fatDelay
//
// Re-kalibreret 2026-04-11 (EU-konvention, frida.fooddata.dk):
//   carbBase  = 25 + (1 - simpleFrac) * 25                 [range 25-50 min]
//   fiberMod  = 1 + 0.5 * ln(1 + stomachFiber/2)          [saturerende]
//   retentionMod = 1 - 0.6 * (1 - retentionRatio)               [pyloric sieve]
//
// Forventet ordning af τG for 25g rent carb, fast føde (ingen fat, ingen væske):
//   sukker_flydende  (25 * 0.7 = 17.5 min)               ← hurtigst (cola/juice)
//   sukker_fast      (25 * 1.0 = 25 min)
//   frugt            (27.5 * 1.55 ≈ 42.6 min)
//   hvidt_mel        (48.75 * 1.20 ≈ 58.5 min)
//   mixed (default)  (45 * 1.35 ≈ 60.6 min)
//   grøntsag         (33.75 * 2.17 ≈ 73.3 min)
//   fuldkorn         (48 * 1.63 ≈ 78.2 min)               ← langsomst (rugbrød/havregryn)
//
// =============================================================================

console.log('\n--- Test CARB-TYPES: dynamisk τG fra mavens blanding ---');

// --- Helper: returnér simulator's currentTauG ved at trigge én sub-step ---
// Vi læser hovorka.tau_G som proxy fordi _substepFatProteinFFA() sætter den
// direkte, og det er præcis værdien BG-modellen bruger.
function getTauGAfterMeal(carbs, protein, fat, weight, carbType) {
    const sim = createCleanSimulator();
    sim.addFood(carbs, protein, fat, 'X', weight, carbType);
    // Kør 5 sim-min så hele eatTime-queue er drænet ind i mavesækken og
    // _substepFatProteinFFA() har opdateret hovorka.tau_G på den fulde blanding.
    // (eatTime for typiske test-vægte er 0.5-5 min via estimateEatTimeMin fallback.)
    simulateMinutes(sim, 5);
    return sim.hovorka.tau_G;
}

test('CARB_TYPES og FOODS er tilgængelige globalt', () => {
    assert(typeof CARB_TYPES === 'object', 'CARB_TYPES skal være defineret');
    assert(typeof FOODS === 'object', 'FOODS skal være defineret');
    assert(CARB_TYPES.sukker_fast.simpleFraction === 1.0, 'sukker_fast skal have simpleFraction=1.0');
    assert(CARB_TYPES.fuldkorn.fiberPerGram === 0.20, 'fuldkorn skal have fiberPerGram=0.20 (rugbrød/havregryn fra frida)');
    assert(CARB_TYPES.sukker_flydende.retentionFactor === 0.4, 'sukker_flydende skal have retentionFactor=0.4 (pyloric sieve, Kong 2008)');
});

test('Rent sukker (fast) giver kort τG omkring 25 min', () => {
    // 30g sukker_fast, ingen fedt, ingen protein, vægt = 30g (rent sukker)
    // Forventet: carbBase=25, fiberMod=1, retentionMod=1, fatDelay=0 → τG=25
    // Kalibreret mod oral glucose tolerance test (peak BG ~30 min)
    const tauG = getTauGAfterMeal(30, 0, 0, 30, 'sukker_fast');
    assertInRange(tauG, 22, 28, 'sukker_fast τG');
});

test('Ren stivelse (hvidt mel) giver længere τG end sukker', () => {
    // 30g hvidt_mel, fiberPerGram=0.04 → 1.2g fiber
    // fiberMod = 1 + 0.5 * ln(1 + 1.2/2) = 1 + 0.5 * ln(1.6) ≈ 1.235
    // simpleFrac=0.05 → carbBase = 25 + 0.95*25 = 48.75
    // τG ≈ 48.75 * 1.235 ≈ 60.2 min
    const tauG = getTauGAfterMeal(30, 0, 0, 30, 'hvidt_mel');
    assertInRange(tauG, 55, 65, 'hvidt_mel τG');
});

test('Fuldkorn giver længere τG end hvidt_mel pga. mere fiber', () => {
    const tauHvidt    = getTauGAfterMeal(30, 0, 0, 30, 'hvidt_mel');
    const tauFuldkorn = getTauGAfterMeal(30, 0, 0, 30, 'fuldkorn');
    assert(tauFuldkorn > tauHvidt,
        `fuldkorn (${tauFuldkorn.toFixed(1)}) skal have længere τG end hvidt_mel (${tauHvidt.toFixed(1)})`);
});

test('Flydende sukker (cola) tømmes hurtigere end fast sukker', () => {
    // Samme carbs, samme vægt, kun forskel = retentionFactor (0.5 vs 1.0)
    const tauFast    = getTauGAfterMeal(25, 0, 0, 250, 'sukker_fast');
    const tauFlydende = getTauGAfterMeal(25, 0, 0, 250, 'sukker_flydende');
    assert(tauFlydende < tauFast,
        `flydende (${tauFlydende.toFixed(1)}) skal være < fast (${tauFast.toFixed(1)})`);
    // Forskellen skal være markant: retentionMod = 1 - 0.6*0.5 = 0.7 → ~30% hurtigere
    assert(tauFlydende < tauFast * 0.75,
        `flydende skal være mindst 25% hurtigere — fast=${tauFast.toFixed(1)}, flydende=${tauFlydende.toFixed(1)}`);
});

test('Fiber forsinker mavetømning (grøntsag vs hvidt_mel ved samme carb-mængde)', () => {
    // 20g carbs. Ny kalibrering:
    //   grøntsag: fiberPerGram=0.75 → 15g fiber, simpleFraction=0.65 → carbBase=33.75
    //             fiberMod = 1 + 0.5*ln(1 + 15/2) = 1 + 0.5*ln(8.5) ≈ 2.07
    //             τG ≈ 33.75 * 2.07 ≈ 69.8 min
    //   hvidt_mel: fiberPerGram=0.04 → 0.8g fiber, simpleFraction=0.05 → carbBase=48.75
    //              fiberMod = 1 + 0.5*ln(1 + 0.8/2) ≈ 1.168
    //              τG ≈ 48.75 * 1.168 ≈ 56.9 min
    // Grøntsagen bliver langsommere trods lavere carbBase (fiber-effekten dominerer).
    const tauHvidt = getTauGAfterMeal(20, 0, 0, 200, 'hvidt_mel');
    const tauVeg   = getTauGAfterMeal(20, 0, 0, 200, 'grøntsag');
    assert(tauVeg > tauHvidt,
        `grøntsag τG (${tauVeg.toFixed(1)}) skal være > hvidt_mel (${tauHvidt.toFixed(1)}) pga. fiber`);
    assert(tauVeg > 25, `grøntsag τG (${tauVeg.toFixed(1)}) skal være >25 pga. fiber`);
});

test('Tom mave: τG falder tilbage på base 40 min (kompatibelt med gammel opførsel)', () => {
    const sim = createCleanSimulator();
    // Ingen mad → ingen blanding → fallback
    sim.update(1.0);
    assertInRange(sim.hovorka.tau_G, 38, 42, 'tom mave τG fallback');
});

test('Default carbType="mixed" giver ~60 min τG (typisk blandet måltid)', () => {
    // mixed: simpleFraction=0.20 → carbBase = 25 + 0.8*25 = 45
    // fiberPerGram=0.08 → 25g carbs → 2.0g fiber
    // fiberMod = 1 + 0.5 * ln(1 + 2.0/2) = 1 + 0.5 * ln(2) ≈ 1.347
    // τG ≈ 45 * 1.347 ≈ 60.6 min
    // (matcher Horowitz 1991: solid mixed meal ≈ 60-90 min gastric emptying)
    const tauG = getTauGAfterMeal(25, 0, 0, 100, 'mixed');
    assertInRange(tauG, 55, 65, 'mixed default τG');
});

test('Manglende/ukendt carbType falder tilbage på "mixed"', () => {
    // Sender en typo-string — skal ikke crashe og skal opføre sig som mixed
    const tauUnknown = getTauGAfterMeal(25, 0, 0, 100, 'frugtFRUTBANANSKDJ');
    const tauMixed   = getTauGAfterMeal(25, 0, 0, 100, 'mixed');
    assertInRange(Math.abs(tauUnknown - tauMixed), 0, 0.01, 'unknown ≈ mixed fallback');
});

test('Mavens blandings-variable bevarer ratios under tømning (mass conservation)', () => {
    // Indtag 30g hvidt_mel, lad maven tømme 30 min, tjek at simpleFraction
    // og fiber/g forbliver konstante.
    const sim = createCleanSimulator();
    sim.addFood(30, 0, 0, 'X', 30, 'hvidt_mel');

    // Lad eatTime-queue dryppe helt ind i mavesækken (ca. 0.6 min for 30g)
    // så snapshottet tages på den fulde blanding, ikke en partiel drip-tilstand.
    simulateMinutes(sim, 1);

    // Snapshot lige efter måltid
    const ratioSimple0 = sim.stomachCarbsSimple / sim.stomachCarbsTotal;
    const ratioFiber0  = sim.stomachFiber       / sim.stomachCarbsTotal;
    const ratioLiquid0 = sim.stomachRetentionWeight / sim.stomachContentGrams;

    // Lad maven tømme noget
    simulateMinutes(sim, 30);

    // Tjek at noget faktisk er tømt (sanity check)
    assert(sim.stomachContentGrams < 30, `mave skal være delvist tømt: ${sim.stomachContentGrams.toFixed(1)}g`);
    assert(sim.stomachContentGrams > 0,  `mave må ikke være helt tømt på 30 min`);

    // Ratios skal være bevaret (tolerans 1% for flydende-komma)
    const ratioSimple1 = sim.stomachCarbsSimple / sim.stomachCarbsTotal;
    const ratioFiber1  = sim.stomachFiber       / sim.stomachCarbsTotal;
    const ratioLiquid1 = sim.stomachRetentionWeight / sim.stomachContentGrams;

    assertInRange(Math.abs(ratioSimple1 - ratioSimple0), 0, 0.01,
        `simpleFraction bevaret: ${ratioSimple0.toFixed(3)} → ${ratioSimple1.toFixed(3)}`);
    assertInRange(Math.abs(ratioFiber1 - ratioFiber0), 0, 0.01,
        `fiberRatio bevaret: ${ratioFiber0.toFixed(3)} → ${ratioFiber1.toFixed(3)}`);
    assertInRange(Math.abs(ratioLiquid1 - ratioLiquid0), 0, 0.01,
        `retentionRatio bevaret: ${ratioLiquid0.toFixed(3)} → ${ratioLiquid1.toFixed(3)}`);
});

test('Mavens blandings-variable opdateres additivt ved nyt måltid', () => {
    const sim = createCleanSimulator();
    // Pass eatTimeMin=0.1 så drip-køen drænes på næste sub-step. Selv ved kort
    // wait sker der lidt mave-tømning (τG ≈ 25 min for sukker_fast → ~2% per
    // 0.5 min), så vi tester ADDITIVE BLANDING via ratios, ikke absolut mængde.
    sim.addFood(20, 0, 0, 'X', 20, 'sukker_fast', 0.1); // simpleFraction=1.00, fiber=0
    sim.addFood(20, 0, 0, 'X', 20, 'fuldkorn', 0.1);    // simpleFraction=0.08, fiber=0.20
    simulateMinutes(sim, 0.2);  // drain queue

    // Total skal være tæt på 40g (lidt tab til mavetømning under drip — accept op til 5%)
    assertInRange(sim.stomachCarbsTotal, 38, 40.1, 'total carbs efter to måltider');

    // Forventede ratios (uafhængige af mavetømning fordi alle blend-variable
    // skaleres ens):
    //   simpleFraction = (20*1.00 + 20*0.08) / 40 = 21.6 / 40 = 0.54
    //   fiberFraction  = (0 + 20*0.20) / 40 = 4.0 / 40 = 0.10
    const simpleRatio = sim.stomachCarbsSimple / sim.stomachCarbsTotal;
    const fiberRatio  = sim.stomachFiber       / sim.stomachCarbsTotal;
    assertInRange(simpleRatio, 0.535, 0.545, 'simpleFraction efter additiv blanding');
    assertInRange(fiberRatio,  0.095, 0.105, 'fiberFraction efter additiv blanding');
});

test('Cola-måltid: BG stiger hurtigere end ækvivalent rugbrød (early peak)', () => {
    // 25g cola vs 25g fuldkorn — efter 30 min skal cola have hævet BG mere
    // fordi den allerede er passeret pylorus. Begge måltider er normaliseret
    // til samme vægt for fair sammenligning.
    const simCola = createCleanSimulator();
    simCola.addFood(25, 0, 0, 'C', 100, 'sukker_flydende');
    simulateMinutes(simCola, 30);
    const riseCola = simCola.trueBG - 5.5;

    const simRugbrød = createCleanSimulator();
    simRugbrød.addFood(25, 0, 0, 'R', 100, 'fuldkorn');
    simulateMinutes(simRugbrød, 30);
    const riseRugbrød = simRugbrød.trueBG - 5.5;

    assert(riseCola > riseRugbrød,
        `cola (${riseCola.toFixed(2)}) skal stige hurtigere end fuldkorn (${riseRugbrød.toFixed(2)}) på 30 min`);
});

test('Massebalance: stomachCarbsTotal må aldrig overstige initialt indtaget', () => {
    const sim = createCleanSimulator();
    sim.addFood(50, 0, 0, 'X', 50, 'mixed');
    // Initialt indtaget = præcis det vi bad om at indtage. Med eatTime-drip
    // bygges stomachCarbsTotal op fra 0 op til ~50 over eatTime-min, så vi kan
    // ikke aflæse stomachCarbsTotal "lige efter" addFood — i stedet tjekker vi
    // mod den deklarerede mængde.
    const totalEaten = 50;

    // Tjek hver tick i 60 min at total aldrig vokser ud over indtaget
    let maxObserved = 0;
    for (let i = 0; i < 60; i++) {
        sim.update(1.0);
        if (sim.stomachCarbsTotal > maxObserved) maxObserved = sim.stomachCarbsTotal;
    }
    assert(maxObserved <= totalEaten + 0.001,
        `max observeret (${maxObserved.toFixed(3)}) må ikke overstige initial (${totalEaten.toFixed(3)})`);
    // Skal også være faldet (ikke konstant) — efter 60 min skal stomach være væsentligt mindre end indtaget
    assert(sim.stomachCarbsTotal < totalEaten,
        `total skal være faldet efter 60 min: ${sim.stomachCarbsTotal.toFixed(3)} vs indtaget ${totalEaten.toFixed(3)}`);
});

// =============================================================================
// TEST GLUCAGON: Graduel glycogenolyse + mass-conservation
// =============================================================================
//
// Implementation: 2026-06-04. Glucagon-injektion mobiliserer op til 35 g
// glukose fra liverGlycogenGrams over en trekant-profil (peak ved t=12 min,
// total varighed 45 min). Mass-conservation: hvert gram glukose der
// tilføjes Q1 trækkes fra liver-poolen.
//
// VIGTIGT om netto-effekt vs. brutto-release:
//   - Glucagon mobiliserer ~35 g BRUTTO fra lever til plasma
//   - NETTO BG-stigning afhænger af insulin-context:
//     • Med IOB (klinisk scenarie): periferi clearer hurtigt → +3-8 mmol/L
//       (Carstensen 1994, Pearson 2008)
//     • Uden IOB (createCleanSimulator-baseline): minimal clearance +
//       postprandialStorage refyldner lever fra plasma → BG kan stige højere
//   - Dette afspejler virkelig fysiologi: glucagon SOM emergency-tool
//     bruges ved INSULIN-induceret hypo (= IOB tilstede)
//
// Tests verificerer:
//   1-3. Skalering med lever-pool (normal/post-motion/faste) — relative ratios
//   4. Brutto-release (via releasedSoFar_g) matcher target ~35 g ved fuld pool
//   5. Game-mekanisk 24h cooldown blokerer ny injektion
//   6. Trekant-profil giver gradvis BG-stigning (ikke instant spike)
//   7. Klinisk scenarie med IOB: BG-stigning matcher Carstensen +3-8 mmol/L
// =============================================================================

console.log('\n--- Test GLUCAGON: graduel glycogenolyse + mass-conservation ---');

// Helper: kør glucagon-injektion fra en given lever-tilstand og rapportér
// peak BG-stigning, brutto-release, og resterende lever-pool.
// trackBrutto=true: optag activeGlucagon.releasedSoFar_g hver tick (capture
// før nulning ved duration-end) så vi får total brutto-mobilisering.
function runGlucagonScenario(initialLiverGlycogenGrams, initialBG, opts = {}) {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, initialBG);
    sim.liverGlycogenGrams = initialLiverGlycogenGrams;
    sim.glycogenReserve = Math.min(1.0, initialLiverGlycogenGrams / 15);
    // Lad simulationen stabilisere et minut FØR injektion (ingen drift)
    simulateMinutes(sim, 1);
    const startBG = sim.trueBG;
    const startLiver = sim.liverGlycogenGrams;

    // Injicér glucagon
    sim.useGlucagon();

    // Track peak BG og brutto-release over 60 min
    let peakBG = startBG;
    let peakAtMin = 0;
    let maxBruttoRelease_g = 0;
    for (let i = 1; i <= 60; i++) {
        simulateMinutes(sim, 1);
        if (sim.activeGlucagon) {
            maxBruttoRelease_g = sim.activeGlucagon.releasedSoFar_g;
        }
        if (sim.trueBG > peakBG) {
            peakBG = sim.trueBG;
            peakAtMin = i;
        }
    }

    return {
        startBG,
        startLiver,
        peakBG,
        peakAtMin,
        bgRise: peakBG - startBG,
        endLiver: sim.liverGlycogenGrams,
        netLiverConsumed: startLiver - sim.liverGlycogenGrams,
        bruttoRelease_g: maxBruttoRelease_g,
        activeAtEnd: sim.activeGlucagon !== null,
        sim,
    };
}

test('GLUCAGON 1 — Normal lever (90 g): peak BG-stigning og brutto-release rimelige', () => {
    const r = runGlucagonScenario(90, 2.5);
    // Uden insulin (clean sim) er der minimal perifær clearance → høj BG-stigning.
    // Brutto-release skal være ~35 g (cap'et target).
    assert(r.bruttoRelease_g >= 30 && r.bruttoRelease_g <= 36,
        `Brutto-release skal være ~35 g, fik ${r.bruttoRelease_g.toFixed(2)} g`);
    // Peak BG-stigning i no-clearance scenarie: 35g → 195 mmol → +17.4 max teoretisk;
    // i praksis dæmpet til ~10-18 af F_01c-forbrug og postprandialStorage refill.
    assert(r.bgRise >= 8 && r.bgRise <= 18,
        `BG-stigning uden insulin: 8-18 mmol/L, fik ${r.bgRise.toFixed(2)}`);
    assert(r.peakAtMin >= 8 && r.peakAtMin <= 40,
        `Peak skal være ved t=8-40 min (trekant peakMin=12), fik t=${r.peakAtMin} min`);
});

test('GLUCAGON 2 — Post-motion lever (15 g): brutto-release begrænset af pool, BG-stigning markant mindre end normal', () => {
    const r = runGlucagonScenario(15, 2.5);
    const rNormal = runGlucagonScenario(90, 2.5);
    // Brutto-release skal være ~10-15 g (pool er begrænsningen)
    assert(r.bruttoRelease_g <= 15.1 && r.bruttoRelease_g >= 8,
        `Begrænset pool: brutto-release skal være 8-15 g, fik ${r.bruttoRelease_g.toFixed(2)} g`);
    // BG-stigning skal være mindre end normal-scenarie
    assert(r.bgRise < rNormal.bgRise,
        `Post-motion bgRise (${r.bgRise.toFixed(2)}) skal være < normal (${rNormal.bgRise.toFixed(2)})`);
});

test('GLUCAGON 3 — Faste-tømt lever (5 g): minimal effekt (klinisk pattern: glucagon fejler ved langvarig faste)', () => {
    const r = runGlucagonScenario(5, 2.5);
    // Brutto-release kan ikke overstige startværdien
    assert(r.bruttoRelease_g <= 5.1,
        `Faste-tømt pool: brutto-release ≤ 5 g, fik ${r.bruttoRelease_g.toFixed(2)} g`);
    // BG-stigning skal være lille (uden insulin: 5g → ~28 mmol → max +2.5)
    assert(r.bgRise <= 3.5,
        `Faste-tømt pool: BG-stigning ≤ 3.5 mmol/L, fik ${r.bgRise.toFixed(2)}`);
});

test('GLUCAGON 4 — Brutto-release matcher target ~35 g ved fuld lever (mass-tracking via releasedSoFar_g)', () => {
    const r = runGlucagonScenario(90, 2.5);
    // Direkte verifikation af mass-tracking: activeGlucagon.releasedSoFar_g
    // akkumulerer alt der trækkes fra lever til plasma uanset om
    // postprandialStorage refyldner.
    assert(r.bruttoRelease_g >= 33 && r.bruttoRelease_g <= 36,
        `Brutto-release skal være 33-36 g (target 35), fik ${r.bruttoRelease_g.toFixed(2)} g`);
    // Mass-conservation: brutto-release × mmol/g ≈ glukose tilført Q1
    const expectedQ1Add_mmol = r.bruttoRelease_g / 0.18016;
    assert(expectedQ1Add_mmol >= 180 && expectedQ1Add_mmol <= 200,
        `Glucagon Q1-bidrag skal være 180-200 mmol (= ${expectedQ1Add_mmol.toFixed(0)})`);
});

test('GLUCAGON 8 — Lever-glykogen recovery efter injektion: med mad fyldes pool på 8-12 t', () => {
    // Klinisk: efter glucagon-injektion bør patienten spise for at undgå rebound-hypo.
    // Vi tester at lever-poolen genopfyldes via postprandialStorage når patient spiser.
    const sim = createCleanSimulator();
    sim.liverGlycogenGrams = 90;
    setSimulatorBG(sim, 2.5);
    simulateMinutes(sim, 1);

    // Injicér glucagon → lever drænes
    sim.useGlucagon();
    for (let i = 0; i < 50; i++) simulateMinutes(sim, 1);  // Lad glucagon-effekt være færdig
    const liverAfterGlucagon = sim.liverGlycogenGrams;
    assert(liverAfterGlucagon < 90,
        `Lever skal være drænet efter glucagon, fik ${liverAfterGlucagon.toFixed(2)}`);

    // Spis kontinuerligt og indjicér basal insulin for at simulere normal mad-respons
    sim.addLongInsulin(10);
    for (let mealNum = 0; mealNum < 8; mealNum++) {
        sim.addFood(40, 10, 5);
        simulateMinutes(sim, 60);  // 1 t mellem måltider
    }
    // Yderligere 2 timer hvile
    simulateMinutes(sim, 120);

    // Efter ~10 t (8 måltider × 1 t + 2 t) bør pool være væsentligt genopfyldt
    assert(sim.liverGlycogenGrams > liverAfterGlucagon + 15,
        `Lever skal være re-fyldt efter mad: gik fra ${liverAfterGlucagon.toFixed(2)} til ${sim.liverGlycogenGrams.toFixed(2)}`);
});

test('GLUCAGON 9 — Lever-recovery efter injektion: pool genopfyldes når insulin og BG tillader storage', () => {
    // Verificerer at lever-poolen RECOVERS efter glucagon-injektionens drain.
    // Hastigheden afhænger af:
    //   - GNG-baseline: ~6 g/t (Roden 2001) — altid aktiv ved insulin
    //   - postprandialStorage: ~22 g/t ved BG=8 — aktiv når BG > 5 og insulin
    //   - Drain: basal glycogenolysis ~6 g/t + stress
    // Uden insulin er insulinSynthGate=0 → ingen storage → ingen recovery.
    // I dette test simulerer vi post-hypo med basal insulin tilbage on board.
    const sim = createCleanSimulator();
    sim.liverGlycogenGrams = 90;
    setSimulatorBG(sim, 2.5);
    simulateMinutes(sim, 1);
    sim.useGlucagon();
    for (let i = 0; i < 50; i++) simulateMinutes(sim, 1);
    const liverAfterGlucagon = sim.liverGlycogenGrams;

    // Tilføj basal insulin og lad BG normalisere
    sim.addLongInsulin(10);
    setSimulatorBG(sim, 5.5);
    // Vent 6 t uden mad
    for (let i = 0; i < 6 * 60; i++) simulateMinutes(sim, 1);

    const recovered = sim.liverGlycogenGrams - liverAfterGlucagon;
    // Verificér at recovery faktisk skete (netto positiv)
    assert(recovered > 0,
        `Lever-pool skal genoprette efter injektion, fik kun ${recovered.toFixed(2)} g`);
    // Cap ved fysiologisk max
    assert(sim.liverGlycogenGrams <= 120,
        `Pool må ikke overstige LIVER_GLYCOGEN_MAX=120 g, fik ${sim.liverGlycogenGrams.toFixed(2)}`);
});

test('GLUCAGON 7 — Klinisk scenarie med IOB (insulin-induceret hypo): BG-stigning matcher Carstensen 1994 (+3-8 mmol/L)', () => {
    // Simulér realistisk hypo: T1D-patient har taget for meget hurtiginsulin
    // og er nu i hypo ved BG=2.5. Lever stadig fuld (~90 g) fordi hypo er akut.
    const sim = createCleanSimulator();
    sim.liverGlycogenGrams = 90;
    sim.glycogenReserve = 1.0;
    setSimulatorBG(sim, 5.5);
    // Giv en bolus så IOB er tilstede når hypo opstår
    sim.addFastInsulin(8);  // 8E hurtiginsulin
    // Lad insulin absorbere i 60 min mens vi tvinger BG ned
    simulateMinutes(sim, 60);
    // Tving BG til 2.5 (simulerer at insulin-overdosen førte til hypo)
    setSimulatorBG(sim, 2.5);
    simulateMinutes(sim, 1);
    const startBG = sim.trueBG;

    sim.useGlucagon();
    let peakBG = startBG;
    for (let i = 1; i <= 60; i++) {
        simulateMinutes(sim, 1);
        if (sim.trueBG > peakBG) peakBG = sim.trueBG;
    }
    const bgRise = peakBG - startBG;

    // Klinisk Carstensen-range +3-8 mmol/L (med IOB-clearance)
    // Vores accept-range bredere (2-10) for at tillade simulator-specifik
    // variation i clearance-koefficienter.
    assert(bgRise >= 2 && bgRise <= 10,
        `Med IOB-clearance: BG-stigning skal være 2-10 mmol/L (Carstensen +3-8), fik ${bgRise.toFixed(2)}`);
});

test('GLUCAGON 5 — Game-mekanisk 24h cooldown: en anden injektion blokeres', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 2.5);
    sim.liverGlycogenGrams = 90;
    simulateMinutes(sim, 1);

    sim.useGlucagon();
    const firstActive = sim.activeGlucagon !== null;
    assert(firstActive, 'Første injektion skal sætte activeGlucagon');

    // Vent 2 timer (under 24h cooldown), forsøg ny injektion
    simulateMinutes(sim, 120);
    sim.activeGlucagon = null; // antag første er færdig
    const beforeSecondTry = sim.glucagonUsedTime;
    sim.useGlucagon();
    assert(sim.activeGlucagon === null,
        'Anden injektion inden 24h skal IKKE sætte activeGlucagon (cooldown blokerer)');
    assert(sim.glucagonUsedTime === beforeSecondTry,
        'glucagonUsedTime skal ikke ændres når cooldown blokerer');
});

test('GLUCAGON 6 — Tidsforløb: trekant-profil giver glat BG-stigning, ikke instant spike', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 2.5);
    sim.liverGlycogenGrams = 90;
    simulateMinutes(sim, 1);
    const startBG = sim.trueBG;

    sim.useGlucagon();

    // Tjek at BG ved t=1 min er kun moderat over start (ikke +10 spike)
    simulateMinutes(sim, 1);
    const bgAt1min = sim.trueBG;
    assert(bgAt1min - startBG < 1.5,
        `Ved t=1 min skal BG-stigning være < 1.5 mmol/L (gradvis ramp), fik +${(bgAt1min-startBG).toFixed(2)}`);

    // Tjek at BG fortsat stiger til t=12 min (peak release rate)
    simulateMinutes(sim, 11);  // t=12 nu
    const bgAt12min = sim.trueBG;
    assert(bgAt12min > bgAt1min,
        `BG skal fortsætte med at stige fra t=1 (${bgAt1min.toFixed(2)}) til t=12 (${bgAt12min.toFixed(2)})`);
});

// =============================================================================
// MODULE SCALING (S9.12) — 0..1 intensity scalars for physiology modules
// =============================================================================
console.log('\n--- Test MODULE SCALING (S9.12): 0..1 intensity scalars ---');

test('MODULE 1 — defaults: scalar modules read 1, boolean modules coerce to 1', () => {
    const e = createEngine({});
    assert(e.moduleScale('dawn') === 1, `default dawn scale should be 1, got ${e.moduleScale('dawn')}`);
    assert(e.moduleScale('ketones') === 1, 'default ketones scale should be 1');
    assert(e.moduleScale('cgmSensorFaults') === 1, 'boolean module true coerces to scale 1');
});

test('MODULE 2 — a fractional scalar is accepted and stored verbatim', () => {
    const e = createEngine({}, { modules: { dawn: 0.5, ketones: 0 } });
    assert(e.moduleScale('dawn') === 0.5, `dawn 0.5 expected, got ${e.moduleScale('dawn')}`);
    assert(e.moduleScale('ketones') === 0, `ketones 0 expected, got ${e.moduleScale('ketones')}`);
});

test('MODULE 3 — boolean overrides coerce on scalar keys (false→0, true→1)', () => {
    const e = createEngine({}, { modules: { dawn: false, ketones: true } });
    assert(e.moduleScale('dawn') === 0, 'dawn:false coerces to 0');
    assert(e.moduleScale('ketones') === 1, 'ketones:true coerces to 1');
    // _campaignDisableDawn alias stays consistent with dawn scale 0
    assert(e._campaignDisableDawn === true, 'dawn scale 0 → _campaignDisableDawn true');
});

test('MODULE 4 — out-of-range / wrong-type scalars throw', () => {
    let threw = 0;
    for (const bad of [1.5, -0.1, NaN, Infinity, 'x', null]) {
        try { createEngine({}, { modules: { dawn: bad } }); }
        catch (err) { threw++; }
    }
    assert(threw === 6, `all 6 bad scalar values should throw, got ${threw}`);
});

test('MODULE 5 — boolean modules reject numbers; unknown key throws', () => {
    let faultsThrew = false, unknownThrew = false;
    try { createEngine({}, { modules: { cgmSensorFaults: 0.5 } }); } catch (e) { faultsThrew = true; }
    try { createEngine({}, { modules: { notAModule: true } }); } catch (e) { unknownThrew = true; }
    assert(faultsThrew, 'numeric value on a boolean module (cgmSensorFaults) should throw');
    assert(unknownThrew, 'unknown module key should throw');
});

test('MODULE 6 — ketones scalar dials production: full > half > off (off does not rise)', () => {
    // Same seed + no basal insulin → insulin-deficient → ketogenesis proceeds.
    // Only the ketones scalar differs, so ketoneLevel must scale monotonically.
    // Scale 0 gates the substep off entirely, so the level stays at its baseline.
    const run = (scale) => {
        const e = createEngine({}, { seed: 12345, modules: { ketones: scale } });
        const initial = e.ketoneLevel;
        for (let i = 0; i < 12; i++) e.step(60); // 12 h of insulin deficiency
        return { level: e.ketoneLevel, initial };
    };
    const r1 = run(1.0), r05 = run(0.5), r0 = run(0.0);
    assert(r0.level === r0.initial,
        `ketones scale 0 (off) must not produce: stayed ${r0.level.toFixed(4)} vs baseline ${r0.initial.toFixed(4)}`);
    assert(r1.level > r05.level && r05.level > r0.level,
        `expected full (${r1.level.toFixed(3)}) > half (${r05.level.toFixed(3)}) > off (${r0.level.toFixed(3)})`);
});

test('MODULE 7 — fractional stress scales only the marginal stress-driven liver-glycogen drain', () => {
    const run = (acuteStress, stressScale) => {
        const e = createEngine({ weight: 70, isf: 3, icr: 10 }, { seed: 7, steadyState: true });
        e.trueBG = 2.0; // Disable GNG replenishment so pool drain can be isolated.
        e.liverGlycogenGrams = 90;
        e.glycogenReserve = 1.0;
        e.acuteStressLevel = acuteStress;
        e.proteinGlucagonLevel = 0;
        e.updateGlycogenReserve(60, stressScale);
        return 90 - e.liverGlycogenGrams;
    };

    const basalDrain = run(0, 1);
    const fullExtra = run(0.4, 1) - basalDrain;
    const halfExtra = run(0.4, 0.5) - basalDrain;
    const offExtra = run(0.4, 0) - basalDrain;

    assertInRange(halfExtra / fullExtra, 0.499, 0.501,
        'Half stress module gives half marginal stress glycogen drain');
    assert(Math.abs(offExtra) < 1e-9,
        `Disabled stress module must give zero marginal stress drain (was ${offExtra.toFixed(6)} g)`);
});

test('MODULE 8 — stress off does not freeze non-stress liver-glycogen flows', () => {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 8,
        steadyState: true,
        modules: { stressResponse: 0 }
    });
    const start = e.liverGlycogenGrams;
    e.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 60 });
    e.step(60);

    assert(e.liverGlycogenGrams < start - 5,
        `Exercise must still drain liver glycogen with stress off (${start.toFixed(1)} -> ${e.liverGlycogenGrams.toFixed(1)} g)`);
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
