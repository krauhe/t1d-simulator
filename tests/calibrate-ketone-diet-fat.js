// =============================================================================
// CALIBRATION SCRIPT — Dietary fat → ketone pathway (BHB_DIET_FAT_FRAC alpha)
// =============================================================================
//
// Iterates α = BHB_DIET_FAT_FRAC across candidate values and runs the same
// G.1/G.2/G.3 scenarios as tests/model-validation.html chapter G to find the
// value that best matches the Ozoran 2023 BHB targets:
//   - G.1 (normal day): max BHB < 0.6 mmol/L
//   - G.2 (low-carb 30g): plateau BHB ~ 0.3-0.5 mmol/L
//   - G.3 (keto <20g): plateau BHB ~ 0.5-1.5 mmol/L
//
// Run with: tests/.bin/node.exe tests/calibrate-ketone-diet-fat.js
// =============================================================================

const { Simulator } = require('./harness.js');

// Disable game-over (matches model-validation.html line 345)
Simulator.prototype.gameOver = function() {};

// =============================================================================
// HELPERS (matches model-validation.html)
// =============================================================================

function createSim(profile = { weight: 70, isf: 3.0, icr: 10 }) {
    global.cgmDataPoints = []; global.trueBgPoints = []; global.physiologyDataPoints = [];
    const origGauss = Simulator.prototype.gaussRand;
    Simulator.prototype.gaussRand = function(mean) { return mean; };
    const sim = new Simulator(profile);
    Simulator.prototype.gaussRand = origGauss;
    sim._dawnAmplitude = 0.15;
    sim.cgmSystemicPeriod = 6 * 60;
    sim.cgmSystemicAmplitude = 0.5;
    sim.cgmNoiseScale = 0.0325;
    sim.gaussRand = function(mean) { return mean; };
    return sim;
}

function clampBG(sim, targetBG) {
    const currentBG = sim.hovorka.glucoseConcentration;
    if (Math.abs(currentBG - targetBG) < 0.1) return;
    const ratio = targetBG / currentBG;
    sim.hovorka.state[4] *= ratio;
    sim.hovorka.state[5] *= ratio;
    for (let i = 0; i < 15; i++) sim.update(1.0);
}

function advanceTo(sim, targetMinutes) {
    while (sim.totalSimMinutes < targetMinutes - 5.01) sim.update(5.0);
    while (sim.totalSimMinutes < targetMinutes - 0.01) sim.update(1.0);
}

function runSchedule(sim, schedule, durationMinutes, sampleInterval = 30) {
    const bhbSamples = [];
    const startTime = sim.totalSimMinutes;
    const endTime = startTime + durationMinutes;
    let schedIdx = 0;
    let lastSampleTime = startTime;
    bhbSamples.push({ time: 0, bhb: sim.ketoneLevel });
    while (sim.totalSimMinutes < endTime - 0.01) {
        while (schedIdx < schedule.length && sim.totalSimMinutes >= schedule[schedIdx].time - 0.01) {
            const s = schedule[schedIdx];
            if (s.food) sim.addFood(s.food[0], s.food[1], s.food[2]);
            if (s.insulin) sim.addFastInsulin(s.insulin);
            if (s.basal) sim.addLongInsulin(s.basal);
            schedIdx++;
        }
        const remaining = endTime - sim.totalSimMinutes;
        sim.update(Math.min(5.0, remaining));
        if (sim.totalSimMinutes - lastSampleTime >= sampleInterval - 0.01) {
            bhbSamples.push({ time: sim.totalSimMinutes - startTime, bhb: sim.ketoneLevel });
            lastSampleTime = sim.totalSimMinutes;
        }
    }
    return bhbSamples;
}

// =============================================================================
// G-CHAPTER SCENARIOS (replicates tests/model-validation.html G.1-G.3)
// =============================================================================

function scenarioG1(alpha) {
    // G.1: Normal day, 48h, 3 meals + basal, BG clamp 5.5 at 07:00
    const sim = createSim();
    sim.BHB_DIET_FAT_FRAC = alpha;
    sim.addLongInsulin(20, -2 * 60, true);
    advanceTo(sim, 7 * 60);
    clampBG(sim, 5.5);
    const schedule = [];
    for (let day = 0; day < 2; day++) {
        const d = day * 24 * 60;
        schedule.push(
            { time: (8 * 60) + d, food: [50, 5, 10], insulin: 5 },
            { time: (12 * 60) + d, food: [60, 10, 15], insulin: 6 },
            { time: (18 * 60) + d, food: [70, 15, 20], insulin: 7 },
            { time: (22 * 60) + d, basal: 20 }
        );
    }
    return runSchedule(sim, schedule, 48 * 60);
}

function scenarioG2(alpha) {
    // G.2: Low-carb 30g/day, 72h
    const sim = createSim();
    sim.BHB_DIET_FAT_FRAC = alpha;
    sim.addLongInsulin(20, -2 * 60, true);
    advanceTo(sim, 8 * 60);
    clampBG(sim, 6.0);
    const schedule = [];
    for (let day = 0; day < 3; day++) {
        const d = day * 24 * 60;
        schedule.push(
            { time: (8 * 60) + d, food: [10, 5, 30], insulin: 1 },
            { time: (13 * 60) + d, food: [10, 5, 25], insulin: 1 },
            { time: (18 * 60) + d, food: [10, 5, 25], insulin: 1 },
            { time: (22 * 60) + d, basal: 20 }
        );
    }
    return runSchedule(sim, schedule, 72 * 60);
}

function scenarioG6(alpha) {
    // G.6: 24h normal day + pump failure at hour 24 (all insulin cleared) + 48h no insulin
    const sim = createSim();
    sim.BHB_DIET_FAT_FRAC = alpha;
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 7 * 60);
    clampBG(sim, 5.5);
    const day1Schedule = [
        { time: 8 * 60, food: [50, 5, 10], insulin: 5 },
        { time: 12 * 60, food: [60, 10, 15], insulin: 6 },
        { time: 18 * 60, food: [70, 15, 20], insulin: 7 },
        { time: 22 * 60, basal: 14 },
    ];
    const day1 = runSchedule(sim, day1Schedule, 24 * 60);
    // Pump failure: ryd al insulin
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - 12 * 60;
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0;
    sim.hovorka.state[6] = 0; sim.hovorka.state[7] = 0;
    sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;
    sim.hovorka.state[13] = 0; sim.hovorka.state[14] = 0; sim.hovorka.state[15] = 0;
    const day2 = runSchedule(sim, [], 48 * 60);
    // Returnér kun day2 data (efter pump failure) med korrigeret tid (24h+)
    return day2.map(s => ({ time: s.time + 24 * 60, bhb: s.bhb }));
}

function scenarioG5(alpha) {
    // G.5: 72h fast (no food), basal 14U pre-injected + daily re-inj
    const sim = createSim();
    sim.BHB_DIET_FAT_FRAC = alpha;
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 8 * 60);
    clampBG(sim, 6.0);
    const schedule = [
        { time: 22 * 60, basal: 14 },
        { time: (22 + 24) * 60, basal: 14 },
        { time: (22 + 48) * 60, basal: 14 },
    ];
    return runSchedule(sim, schedule, 72 * 60);
}

function scenarioG3(alpha) {
    // G.3: Keto <20g carbs, high fat, 72h
    const sim = createSim();
    sim.BHB_DIET_FAT_FRAC = alpha;
    sim.addLongInsulin(20, -2 * 60, true);
    advanceTo(sim, 8 * 60);
    clampBG(sim, 5.5);
    const schedule = [];
    for (let day = 0; day < 3; day++) {
        const d = day * 24 * 60;
        schedule.push(
            { time: (8 * 60) + d, food: [5, 10, 50], insulin: 0.5 },
            { time: (13 * 60) + d, food: [5, 20, 40], insulin: 0.5 },
            { time: (18 * 60) + d, food: [5, 15, 45], insulin: 0.5 },
            { time: (22 * 60) + d, basal: 20 }
        );
    }
    return runSchedule(sim, schedule, 72 * 60);
}

// =============================================================================
// CALIBRATION SWEEP
// =============================================================================

function metrics(samples) {
    const bhbs = samples.map(s => s.bhb);
    const max = Math.max(...bhbs);
    // Average over last 12h (~24 samples at 30min intervals)
    const tail = samples.filter(s => s.time >= samples[samples.length - 1].time - 12 * 60);
    const tailMean = tail.reduce((sum, s) => sum + s.bhb, 0) / tail.length;
    return { max, tailMean };
}

const alpha = 0.35;
console.log('Ketone scenarios at BHB_DIET_FAT_FRAC = ' + alpha);
console.log('=================================================================');

const g1 = metrics(scenarioG1(alpha));
const g2 = metrics(scenarioG2(alpha));
const g3 = metrics(scenarioG3(alpha));
const g5 = metrics(scenarioG5(alpha));
const g6samples = scenarioG6(alpha);
// G.6 specific timepoints (relative to pump failure at hour 24)
const bhbAt = (samples, targetMin) => {
    let best = samples[0];
    for (const s of samples) {
        if (Math.abs(s.time - targetMin) < Math.abs(best.time - targetMin)) best = s;
    }
    return best.bhb;
};
const g6_at4h = bhbAt(g6samples, 28 * 60);   // +4h post-failure
const g6_at8h = bhbAt(g6samples, 32 * 60);   // +8h post-failure
const g6_at12h = bhbAt(g6samples, 36 * 60);  // +12h post-failure
const g6_at24h = bhbAt(g6samples, 48 * 60);  // +24h post-failure
const g6_max = Math.max(...g6samples.map(s => s.bhb));

console.log('G.1 (normal day, 48h):        max BHB ' + g1.max.toFixed(2) + ' mmol/L  [target <0.6]');
console.log('G.2 (low-carb 30g, 72h):      plateau ' + g2.tailMean.toFixed(2) + ' mmol/L  [target 0.3-0.5, Ozoran LCD]');
console.log('G.3 (keto <20g, 72h):         plateau ' + g3.tailMean.toFixed(2) + ' mmol/L  [target 0.5-1.5, Ozoran VLCD]');
console.log('G.5 (72h fast, no food):      plateau ' + g5.tailMean.toFixed(2) + ' mmol/L  [target 0.5-2.0, Cahill/Owen]');
console.log('');
console.log('G.6 (pump failure):');
console.log('  +4h post-failure:   BHB ' + g6_at4h.toFixed(2) + ' mmol/L  [codex/Guerci target: 0.5-1.0; code comment: 1.5-2.0]');
console.log('  +8h post-failure:   BHB ' + g6_at8h.toFixed(2) + ' mmol/L  [codex/Guerci target: 1.5-2.0; code comment: 3.5-4.5]');
console.log('  +12h post-failure:  BHB ' + g6_at12h.toFixed(2) + ' mmol/L  [codex/Guerci target: ~3.0]');
console.log('  +24h post-failure:  BHB ' + g6_at24h.toFixed(2) + ' mmol/L');
console.log('  Max BHB:            ' + g6_max.toFixed(2) + ' mmol/L');
console.log('=================================================================');
