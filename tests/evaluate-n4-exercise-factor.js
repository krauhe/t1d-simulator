// =============================================================================
// N4 REGRESSION LAB — exercise sensitivity must be applied exactly once
// =============================================================================
//
// The former implementation multiplied both x1 and x2 by 1+alpha·E2² while
// the engine also shifted the muscle EC50. That duplicate path has been removed.
// E2 is now telemetry only; insulin-mediated exercise sensitivity is represented
// once by the engine's PEIS factor and contraction uptake once by beta·E1.
//
// This historical lab is retained as a regression comparison of cardio intensity
// and insulin/exercise interaction under the current one-path implementation.
//
// Run with:  node tests/evaluate-n4-exercise-factor.js
// =============================================================================

const { Simulator } = require('./harness.js');

// ---------- Helpers ----------------------------------------------------------
function createCleanSimulator(startBG = 8.0) {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;

    const sim = new Simulator();
    sim.activeLongInsulin = [];                                  // No basal — clean control
    sim.lastInsulinTime = sim.totalSimMinutes;
    sim.trueBG = startBG;
    sim.cgmBG = startBG;
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;
    sim.hovorka.state[4] = startBG * sim.hovorka.V_G;            // Q1 = BG · V_G
    sim.hovorka.insulinRate = 0;
    sim.totalSimMinutes = 14 * 60;                               // 14:00 — no dawn
    sim.timeInMinutes = 14 * 60;
    return sim;
}

// Run sim minute-by-minute, log BG trajectory, return min/max/end BG
function runScenario(sim, minutes, label) {
    sim.simulationSpeed = 60;
    // Hovorka state indices: 11=E1 (contraction response), 12=E2 (telemetry only)
    const trajectory = [{ t: 0, bg: sim.trueBG, e1: sim.hovorka.state[11] || 0, e2: sim.hovorka.state[12] || 0 }];
    let minBG = sim.trueBG, minBGTime = 0;
    let maxBG = sim.trueBG, maxBGTime = 0;
    let maxE1 = 0, maxE2 = 0, maxFactor = 1;

    for (let i = 1; i <= minutes; i++) {
        sim.update(1.0);                                          // 1 min sim
        const bg = sim.trueBG;
        const e1 = sim.hovorka.state[11] || 0;
        const e2 = sim.hovorka.state[12] || 0;
        const factor = sim._lastPeisFactor || 1;
        trajectory.push({ t: i, bg, e1, e2, factor });
        if (bg < minBG) { minBG = bg; minBGTime = i; }
        if (bg > maxBG) { maxBG = bg; maxBGTime = i; }
        if (e1 > maxE1) maxE1 = e1;
        if (e2 > maxE2) maxE2 = e2;
        if (factor > maxFactor) maxFactor = factor;
    }

    return {
        label,
        startBG: trajectory[0].bg,
        endBG: trajectory[trajectory.length - 1].bg,
        minBG, minBGTime,
        maxBG, maxBGTime,
        maxE1, maxE2, maxFactor,
        peakDrop: trajectory[0].bg - minBG,
        trajectory
    };
}

function fmt(x, d = 2) { return Number(x).toFixed(d); }

// =============================================================================
// SCENARIOS
// =============================================================================
console.log('\n===========================================================');
console.log(' N4 REGRESSION — single-path exercise sensitivity');
console.log('===========================================================');
console.log(' Setup: 70 kg adult, ISF=3.0, ICR=10, BG_start=8.0 mmol/L');
console.log(' E2 is telemetry; maxFactor below is the engine PEIS factor');
console.log('===========================================================\n');

// --- A: Control ---
console.log('--- Scenario A: Control (no intervention, 180 min) ---');
const A = runScenario(createCleanSimulator(8.0), 180, 'Control');
console.log(`   start=${fmt(A.startBG)}  end=${fmt(A.endBG)}  min=${fmt(A.minBG)}@${A.minBGTime}m  max=${fmt(A.maxBG)}@${A.maxBGTime}m`);

// --- B: Bolus only ---
console.log('\n--- Scenario B: 5 E bolus only (180 min) ---');
const simB = createCleanSimulator(8.0);
simB.addFastInsulin(5);
const B = runScenario(simB, 180, 'Bolus 5E');
console.log(`   start=${fmt(B.startBG)}  end=${fmt(B.endBG)}  peakDrop=${fmt(B.peakDrop)} mmol/L @ t=${B.minBGTime}m`);

// --- C1: Cardio Lav (low) 60 min ---
console.log('\n--- Scenario C1: Cardio Lav 60 min (no insulin), watch 180 min ---');
const simC1 = createCleanSimulator(8.0);
simC1.startAktivitet('cardio', 'Lav', 60);
const C1 = runScenario(simC1, 180, 'Cardio Lav 60m');
console.log(`   peakDrop=${fmt(C1.peakDrop)} mmol/L @ t=${C1.minBGTime}m   maxE1=${fmt(C1.maxE1,3)}  maxPEIS=${fmt(C1.maxFactor,3)}`);

// --- C2: Cardio Medium 60 min ---
console.log('\n--- Scenario C2: Cardio Medium 60 min (no insulin), watch 180 min ---');
const simC2 = createCleanSimulator(8.0);
simC2.startAktivitet('cardio', 'Medium', 60);
const C2 = runScenario(simC2, 180, 'Cardio Medium 60m');
console.log(`   peakDrop=${fmt(C2.peakDrop)} mmol/L @ t=${C2.minBGTime}m   maxPEIS=${fmt(C2.maxFactor)}`);

// --- C3: Cardio Høj 60 min ---
console.log('\n--- Scenario C3: Cardio Høj 60 min (no insulin), watch 180 min ---');
const simC3 = createCleanSimulator(8.0);
simC3.startAktivitet('cardio', 'Høj', 60);
const C3 = runScenario(simC3, 180, 'Cardio Høj 60m');
console.log(`   peakDrop=${fmt(C3.peakDrop)} mmol/L @ t=${C3.minBGTime}m   maxPEIS=${fmt(C3.maxFactor)}`);

// --- D: Combined bolus + Medium cardio (synergy test) ---
console.log('\n--- Scenario D: 5 E bolus + Cardio Medium 60 min concurrent (180 min) ---');
const simD = createCleanSimulator(8.0);
simD.addFastInsulin(5);
simD.startAktivitet('cardio', 'Medium', 60);
const D = runScenario(simD, 180, 'Bolus + Cardio');
console.log(`   peakDrop=${fmt(D.peakDrop)} mmol/L @ t=${D.minBGTime}m   maxFactor=${fmt(D.maxFactor)}`);

// --- E: Long high-intensity (45 min Høj) — exercise-response stress test ---
console.log('\n--- Scenario E: Cardio Høj 45 min @ BG=10 (no insulin), watch 180 min ---');
const simE = createCleanSimulator(10.0);
simE.startAktivitet('cardio', 'Høj', 45);
const E = runScenario(simE, 180, 'Cardio Høj 45m @ BG10');
console.log(`   peakDrop=${fmt(E.peakDrop)} mmol/L @ t=${E.minBGTime}m   maxPEIS=${fmt(E.maxFactor)}`);

// =============================================================================
// HEADROOM TEST — start BG=14 to check if Medium and Høj diverge with no floor
// =============================================================================
console.log('\n===========================================================');
console.log(' HEADROOM TEST — start BG=14 to remove floor effect');
console.log('===========================================================');

console.log('\n--- F1: Cardio Lav 60m @ BG=14 ---');
const simF1 = createCleanSimulator(14.0);
simF1.startAktivitet('cardio', 'Lav', 60);
const F1 = runScenario(simF1, 180, 'Cardio Lav 60m @ BG14');
console.log(`   peakDrop=${fmt(F1.peakDrop)} mmol/L @ t=${F1.minBGTime}m   minBG=${fmt(F1.minBG)}   maxE2=${fmt(F1.maxE2,3)}`);

console.log('\n--- F2: Cardio Medium 60m @ BG=14 ---');
const simF2 = createCleanSimulator(14.0);
simF2.startAktivitet('cardio', 'Medium', 60);
const F2 = runScenario(simF2, 180, 'Cardio Medium 60m @ BG14');
console.log(`   peakDrop=${fmt(F2.peakDrop)} mmol/L @ t=${F2.minBGTime}m   minBG=${fmt(F2.minBG)}   maxE2=${fmt(F2.maxE2,3)}`);

console.log('\n--- F3: Cardio Høj 60m @ BG=14 ---');
const simF3 = createCleanSimulator(14.0);
simF3.startAktivitet('cardio', 'Høj', 60);
const F3 = runScenario(simF3, 180, 'Cardio Høj 60m @ BG14');
console.log(`   peakDrop=${fmt(F3.peakDrop)} mmol/L @ t=${F3.minBGTime}m   minBG=${fmt(F3.minBG)}   maxE2=${fmt(F3.maxE2,3)}`);

console.log('\n   Marginal effects with headroom (no floor):');
console.log(`     Lav    → Medium:  +${fmt(F2.peakDrop - F1.peakDrop)} mmol/L extra`);
console.log(`     Medium → Høj:     +${fmt(F3.peakDrop - F2.peakDrop)} mmol/L extra`);
console.log(`     Compare to BG=8 scenarios:`);
console.log(`     Lav    → Medium:  +${fmt(C2.peakDrop - C1.peakDrop)} mmol/L extra (floor-bound)`);
console.log(`     Medium → Høj:     +${fmt(C3.peakDrop - C2.peakDrop)} mmol/L extra (floor-bound)`);

// =============================================================================
// FLOOR-FREE TEST — short exercise (30 min) at BG=14 so even Høj stays >5
// =============================================================================
console.log('\n===========================================================');
console.log(' SHORT-EXERCISE TEST — 30 min @ BG=14 (no hypoFactor activation)');
console.log('===========================================================');
console.log(' Goal: keep all intensities ABOVE BG=3.5 (where hypo-reduction kicks in)');
console.log('       and isolate pure intensity-scaling without floor effects.');

console.log('\n--- G1: Cardio Lav 30m @ BG=14 ---');
const simG1 = createCleanSimulator(14.0);
simG1.startAktivitet('cardio', 'Lav', 30);
const G1 = runScenario(simG1, 120, 'Cardio Lav 30m');
console.log(`   peakDrop=${fmt(G1.peakDrop)} mmol/L @ t=${G1.minBGTime}m   minBG=${fmt(G1.minBG)}   maxE2=${fmt(G1.maxE2,3)}`);

console.log('\n--- G2: Cardio Medium 30m @ BG=14 ---');
const simG2 = createCleanSimulator(14.0);
simG2.startAktivitet('cardio', 'Medium', 30);
const G2 = runScenario(simG2, 120, 'Cardio Medium 30m');
console.log(`   peakDrop=${fmt(G2.peakDrop)} mmol/L @ t=${G2.minBGTime}m   minBG=${fmt(G2.minBG)}   maxE2=${fmt(G2.maxE2,3)}`);

console.log('\n--- G3: Cardio Høj 30m @ BG=14 ---');
const simG3 = createCleanSimulator(14.0);
simG3.startAktivitet('cardio', 'Høj', 30);
const G3 = runScenario(simG3, 120, 'Cardio Høj 30m');
console.log(`   peakDrop=${fmt(G3.peakDrop)} mmol/L @ t=${G3.minBGTime}m   minBG=${fmt(G3.minBG)}   maxE2=${fmt(G3.maxE2,3)}`);

console.log('\n   Marginal effects (30 min, no floor activation):');
console.log(`     Lav    → Medium:  +${fmt(G2.peakDrop - G1.peakDrop)} mmol/L extra`);
console.log(`     Medium → Høj:     +${fmt(G3.peakDrop - G2.peakDrop)} mmol/L extra`);
const ratioLM = (G2.peakDrop - G1.peakDrop) / G1.peakDrop;
const ratioMH = (G3.peakDrop - G2.peakDrop) / G2.peakDrop;
console.log(`     Drop-ratio Lav→Med:  ${fmt(ratioLM*100,1)}%`);
console.log(`     Drop-ratio Med→Høj:  ${fmt(ratioMH*100,1)}%`);
console.log('     Litteratur (Riddell/Adams): Høj giver typisk 30-50% mere drop end Medium');

// =============================================================================
// SYNERGY ANALYSIS
// =============================================================================
console.log('\n===========================================================');
console.log(' SYNERGY ANALYSIS');
console.log('===========================================================');
const expectedSum = B.peakDrop + C2.peakDrop;
const synergy = D.peakDrop / expectedSum;
console.log(`   Bolus alone (B):       drop = ${fmt(B.peakDrop)} mmol/L`);
console.log(`   Cardio alone (C2):     drop = ${fmt(C2.peakDrop)} mmol/L`);
console.log(`   Sum (linear stacking): drop = ${fmt(expectedSum)} mmol/L`);
console.log(`   Combined (D):          drop = ${fmt(D.peakDrop)} mmol/L`);
console.log(`   Synergy ratio (D / sum) = ${fmt(synergy)}`);
console.log(`     ratio = 1.0 → purely additive`);
console.log(`     ratio > 1.0 → super-additive (multiplicative coupling > linear)`);
console.log(`     ratio < 1.0 → sub-additive (saturation/depletion)`);

// =============================================================================
// LITERATURE COMPARISON
// =============================================================================
console.log('\n===========================================================');
console.log(' LITERATURE COMPARISON');
console.log('===========================================================');
console.log(' Reference values (T1D, no concurrent meal):');
console.log('   Tonoli 2012 meta:  aerobic 30-60min      → drop 3.0 mmol/L (CI 2.4-3.6)');
console.log('   Bally 2017:        moderate intensity    → drop 1-4 mmol/L');
console.log('   Adams 2018:        bolus + exercise      → drop 5-7 mmol/L common');
console.log('');
console.log(' Model results:');
console.log(`   Cardio Lav 60m:     ${fmt(C1.peakDrop)} mmol/L   (lit: low end ~1-2)`);
console.log(`   Cardio Medium 60m:  ${fmt(C2.peakDrop)} mmol/L   (lit: 2.4-3.6 mmol/L)`);
console.log(`   Cardio Høj 60m:     ${fmt(C3.peakDrop)} mmol/L   (lit: 3-5 mmol/L)`);
console.log(`   Bolus + Cardio:     ${fmt(D.peakDrop)} mmol/L   (lit: 5-7 mmol/L)`);

// =============================================================================
// VERDICT
// =============================================================================
console.log('\n===========================================================');
console.log(' VERDICT');
console.log('===========================================================');

let verdict = [];
if (C2.peakDrop >= 2.0 && C2.peakDrop <= 4.5) {
    verdict.push('OK   — Cardio Medium drop within Tonoli 2012 CI');
} else if (C2.peakDrop > 4.5) {
    verdict.push('FLAG — Cardio Medium drop EXCEEDS Tonoli 2012 upper bound (3.6)');
} else {
    verdict.push('FLAG — Cardio Medium drop BELOW Tonoli 2012 lower bound (2.4)');
}

if (C3.peakDrop <= 6.0) {
    verdict.push('OK   — Cardio Høj drop within plausible range');
} else {
    verdict.push('FLAG — Cardio Høj drop EXCESSIVE (>6 mmol/L without insulin)');
}

if (D.peakDrop >= 4.0 && D.peakDrop <= 8.0) {
    verdict.push('OK   — Combined drop within Adams 2018 range (5-7)');
} else if (D.peakDrop > 8.0) {
    verdict.push('FLAG — Combined drop SUSPICIOUSLY LARGE (super-additive blow-up?)');
} else {
    verdict.push('FLAG — Combined drop too small');
}

if (synergy >= 0.85 && synergy <= 1.25) {
    verdict.push('OK   — Synergy ratio reasonable (mild super-additivity expected)');
} else if (synergy > 1.25) {
    verdict.push('FLAG — Synergy ratio HIGH — PEIS/insulin interaction may be over-amplifying');
} else {
    verdict.push('NOTE — Synergy ratio low — possibly sub-additive due to BG hitting floor');
}

verdict.forEach(v => console.log('   ' + v));
console.log('\n');
