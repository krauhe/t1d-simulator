// =============================================================================
// KETONE PATHWAY RECALIBRATION HARNESS
// =============================================================================
//
// Fits the full ketone model (lipolysis + CPT-1 gate + BHB production/clearance)
// against the consolidated clinical target table:
//
//   Plasma insulin (steady) | Target BHB    | Source
//   ------------------------|---------------|-------------------------------
//   I = 20 (postprandial)   | < 0.15        | Pinnaro 2021
//   I = 12 (good basal)     | 0.2 - 0.5     | Cahill 1970, Owen 1967
//   I = 8  (typical basal)  | 0.5 - 1.2     | Mitchell 1995
//   I = 6  (late-night)     | 0.8 - 1.8     | (interpolated)
//
//   Transient scenarios:
//   Keto diet (3 meals)     | 0.3 - 1.5     | Ozoran 2023 VLCD
//   72h fast (basal only)   | 0.5 - 2.0     | Cahill, Owen
//   Pump failure +4h        | 0.5 - 1.0     | Guerci 2006
//   Pump failure +8h        | 1.5 - 2.0     | PMC11531023
//   Pump failure +12h       | ~3.0          | PMC11531023
//
// KEY INSIGHT: at I=0, cpt1Activity = 1.0 regardless of CPT-1 parameters, so
// CPT-1 EC50/Hill only reshape the MODERATE-insulin region without touching the
// zero-insulin (pump failure) ramp. This lets us raise moderate-insulin BHB
// (G.2-G.5) independently of the pump-failure kinetics (G.6).
//
// Run with: tests/.bin/node.exe tests/calibrate-ketone-pathway.js
// =============================================================================

const { Simulator } = require('./harness.js');
Simulator.prototype.gameOver = function() {};

// --- Helpers ---
function createSim(profile = { weight: 70, isf: 3.0, icr: 10 }) {
    global.cgmDataPoints = []; global.trueBgPoints = []; global.physiologyDataPoints = [];
    const origGauss = Simulator.prototype.gaussRand;
    Simulator.prototype.gaussRand = function(mean) { return mean; };
    const sim = new Simulator(profile);
    Simulator.prototype.gaussRand = origGauss;
    sim._dawnAmplitude = 0.15;
    sim.gaussRand = function(mean) { return mean; };
    return sim;
}

// Apply a candidate parameter set to a fresh sim.
function applyParams(sim, p) {
    if (p.LIPOLYSIS_MAX !== undefined) sim.LIPOLYSIS_MAX = p.LIPOLYSIS_MAX;
    if (p.LIPOLYSIS_EC50 !== undefined) sim.LIPOLYSIS_EC50 = p.LIPOLYSIS_EC50;
    if (p.LIPOLYSIS_HILL_N !== undefined) sim.LIPOLYSIS_HILL_N = p.LIPOLYSIS_HILL_N;
    if (p.CPT1_EC50 !== undefined) sim.CPT1_EC50 = p.CPT1_EC50;
    if (p.CPT1_HILL_N !== undefined) sim.CPT1_HILL_N = p.CPT1_HILL_N;
    if (p.CPT1_MAX_SUPP !== undefined) sim.CPT1_MAX_SUPP = p.CPT1_MAX_SUPP;
    if (p.BHB_PROD_RATE !== undefined) sim.BHB_PROD_RATE = p.BHB_PROD_RATE;
    if (p.FFA_LIPO_CLEAR_HALF !== undefined) sim.FFA_LIPO_CLEAR_HALF = p.FFA_LIPO_CLEAR_HALF;
    if (p.BHB_DIET_FAT_FRAC !== undefined) sim.BHB_DIET_FAT_FRAC = p.BHB_DIET_FAT_FRAC;
    if (p.BHB_VMAX !== undefined) sim.BHB_VMAX = p.BHB_VMAX;
    if (p.BHB_KM !== undefined) sim.BHB_KM = p.BHB_KM;
    if (p.BHB_RENAL_VMAX !== undefined) sim.BHB_RENAL_VMAX = p.BHB_RENAL_VMAX;
}

// --- STEADY-STATE PROBE: clamp plasma insulin, run ketone substep to equilibrium ---
// Isolates the insulin → BHB dose-response (no food → ffaBlood=0).
function steadyStateBHB(params, insulinLevel, minutes = 48 * 60) {
    const sim = createSim();
    applyParams(sim, params);
    sim.ffaLipolysis = 0;
    sim.ketoneLevel = 0;
    sim.ffaBlood = 0;
    sim.smoothHeartRate = sim.hovorka.HR_base; // no exercise boost
    for (let i = 0; i < minutes; i++) {
        sim.hovorka.state[6] = insulinLevel; // clamp plasma insulin [mU/L]
        sim._substepKetones(1.0);
    }
    return sim.ketoneLevel;
}

// --- FAST G.6 PROXY: zero-insulin BHB ramp from clean state ---
// Real G.6 starts day 2 with ffaLipolysis ≈ 0 (full insulin coverage on day 1),
// then insulin → 0. This proxy reproduces that ramp without the full update loop,
// so it can be scored cheaply in the sweep. Validated against the real G.6 below.
function zeroInsulinRamp(params) {
    const sim = createSim();
    applyParams(sim, params);
    sim.ffaLipolysis = 0; sim.ketoneLevel = 0; sim.ffaBlood = 0;
    sim.smoothHeartRate = sim.hovorka.HR_base;
    const out = {};
    for (let m = 1; m <= 12 * 60; m++) {
        sim.hovorka.state[6] = 0;
        sim._substepKetones(1.0);
        if (m === 4 * 60) out.at4h = sim.ketoneLevel;
        if (m === 8 * 60) out.at8h = sim.ketoneLevel;
        if (m === 12 * 60) out.at12h = sim.ketoneLevel;
    }
    return out;
}

// --- TRANSIENT G.6: 24h normal day then pump failure (insulin → 0) ---
function advanceTo(sim, targetMinutes) {
    while (sim.totalSimMinutes < targetMinutes - 5.01) sim.update(5.0);
    while (sim.totalSimMinutes < targetMinutes - 0.01) sim.update(1.0);
}
function clampBG(sim, targetBG) {
    const currentBG = sim.hovorka.glucoseConcentration;
    if (Math.abs(currentBG - targetBG) < 0.1) return;
    const ratio = targetBG / currentBG;
    sim.hovorka.state[4] *= ratio;
    sim.hovorka.state[5] *= ratio;
    for (let i = 0; i < 15; i++) sim.update(1.0);
}
function runSchedule(sim, schedule, durationMinutes) {
    const startTime = sim.totalSimMinutes;
    const endTime = startTime + durationMinutes;
    let schedIdx = 0;
    const samples = [{ time: 0, bhb: sim.ketoneLevel }];
    while (sim.totalSimMinutes < endTime - 0.01) {
        while (schedIdx < schedule.length && sim.totalSimMinutes >= schedule[schedIdx].time - 0.01) {
            const s = schedule[schedIdx];
            if (s.food) sim.addFood(s.food[0], s.food[1], s.food[2]);
            if (s.insulin) sim.addFastInsulin(s.insulin);
            if (s.basal) sim.addLongInsulin(s.basal);
            schedIdx++;
        }
        sim.update(Math.min(5.0, endTime - sim.totalSimMinutes));
        samples.push({ time: sim.totalSimMinutes - startTime, bhb: sim.ketoneLevel });
    }
    return samples;
}
function scenarioG6(params) {
    const sim = createSim();
    applyParams(sim, params);
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 7 * 60);
    clampBG(sim, 5.5);
    runSchedule(sim, [
        { time: 8 * 60, food: [50, 5, 10], insulin: 5 },
        { time: 12 * 60, food: [60, 10, 15], insulin: 6 },
        { time: 18 * 60, food: [70, 15, 20], insulin: 7 },
        { time: 22 * 60, basal: 14 },
    ], 24 * 60);
    sim.activeFastInsulin = []; sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - 12 * 60;
    [2,3,6,7,8,9,13,14,15].forEach(i => { sim.hovorka.state[i] = 0; });
    const day2 = runSchedule(sim, [], 48 * 60);
    const bhbAt = (h) => {
        const target = h * 60; let best = day2[0];
        for (const s of day2) if (Math.abs(s.time - target) < Math.abs(best.time - target)) best = s;
        return best.bhb;
    };
    return { at4h: bhbAt(4), at8h: bhbAt(8), at12h: bhbAt(12), at24h: bhbAt(24), max: Math.max(...day2.map(s => s.bhb)) };
}

// --- TRANSIENT G.3 keto + G.5 fast (dietary-fat / lipolysis plateau checks) ---
function scenarioG3(params) {
    const sim = createSim();
    applyParams(sim, params);
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
    const samples = runSchedule(sim, schedule, 72 * 60);
    const tail = samples.filter(s => s.time >= samples[samples.length - 1].time - 12 * 60);
    return tail.reduce((sum, s) => sum + s.bhb, 0) / tail.length;
}
function scenarioG5(params) {
    const sim = createSim();
    applyParams(sim, params);
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 8 * 60);
    clampBG(sim, 6.0);
    const samples = runSchedule(sim, [
        { time: 22 * 60, basal: 14 },
        { time: (22 + 24) * 60, basal: 14 },
        { time: (22 + 48) * 60, basal: 14 },
    ], 72 * 60);
    const tail = samples.filter(s => s.time >= samples[samples.length - 1].time - 12 * 60);
    return tail.reduce((sum, s) => sum + s.bhb, 0) / tail.length;
}

// --- REPORT a single parameter set against all targets ---
function report(label, params) {
    const ss = {
        I20: steadyStateBHB(params, 20),
        I12: steadyStateBHB(params, 12),
        I8: steadyStateBHB(params, 8),
        I6: steadyStateBHB(params, 6),
    };
    const g3 = scenarioG3(params);
    const g5 = scenarioG5(params);
    const g6 = scenarioG6(params);
    console.log('\n--- ' + label + ' ---');
    console.log('  params: ' + JSON.stringify(params));
    const chk = (v, lo, hi) => (v >= lo && v <= hi) ? 'OK' : (v < lo ? 'LOW' : 'HIGH');
    console.log('  Steady-state insulin -> BHB:');
    console.log('    I=20: ' + ss.I20.toFixed(2) + '  [<0.15]      ' + (ss.I20 < 0.15 ? 'OK' : 'HIGH'));
    console.log('    I=12: ' + ss.I12.toFixed(2) + '  [0.2-0.5]    ' + chk(ss.I12, 0.2, 0.5));
    console.log('    I=8:  ' + ss.I8.toFixed(2) + '  [0.5-1.2]    ' + chk(ss.I8, 0.5, 1.2));
    console.log('    I=6:  ' + ss.I6.toFixed(2) + '  [0.8-1.8]    ' + chk(ss.I6, 0.8, 1.8));
    console.log('  Transient scenarios:');
    console.log('    G.3 keto plateau:  ' + g3.toFixed(2) + '  [0.3-1.5]  ' + chk(g3, 0.3, 1.5));
    console.log('    G.5 fast plateau:  ' + g5.toFixed(2) + '  [0.5-2.0]  ' + chk(g5, 0.5, 2.0));
    console.log('    G.6 +4h:   ' + g6.at4h.toFixed(2) + '  [0.5-1.0]  ' + chk(g6.at4h, 0.5, 1.0));
    console.log('    G.6 +8h:   ' + g6.at8h.toFixed(2) + '  [1.5-2.0]  ' + chk(g6.at8h, 1.5, 2.0));
    console.log('    G.6 +12h:  ' + g6.at12h.toFixed(2) + '  [~3.0]     ' + chk(g6.at12h, 2.5, 3.5));
    console.log('    G.6 +24h:  ' + g6.at24h.toFixed(2) + '  (DKA)');
    console.log('    G.6 max:   ' + g6.max.toFixed(2));
    return { ss, g3, g5, g6 };
}

// =============================================================================
// CANDIDATE PARAMETER SETS
// =============================================================================

// Baseline = current model values
const BASELINE = {
    LIPOLYSIS_MAX: 0.09, LIPOLYSIS_EC50: 8, LIPOLYSIS_HILL_N: 3,
    CPT1_EC50: 5, CPT1_HILL_N: 5, CPT1_MAX_SUPP: 0.95,
    BHB_PROD_RATE: 0.0028, FFA_LIPO_CLEAR_HALF: 60, BHB_DIET_FAT_FRAC: 0.35,
};

const MODE = process.env.KETONE_MODE || 'baseline';

// Steady-state target table (insulin level -> [lo, hi])
const SS_TARGETS = [
    { I: 20, lo: 0.00, hi: 0.15 },
    { I: 12, lo: 0.20, hi: 0.50 },
    { I: 8,  lo: 0.50, hi: 1.20 },
    { I: 6,  lo: 0.80, hi: 1.80 },
];
function ssPenalty(params) {
    let pen = 0;
    const vals = {};
    for (const t of SS_TARGETS) {
        const v = steadyStateBHB(params, t.I);
        vals['I' + t.I] = v;
        if (v < t.lo) pen += (t.lo - v) ** 2;
        else if (v > t.hi) pen += (v - t.hi) ** 2 * 4; // over-shoot penalized harder
    }
    return { pen, vals };
}

// G.6 proxy targets (zero-insulin ramp): codex / Guerci / PMC11531023
function g6Penalty(params) {
    const r = zeroInsulinRamp(params);
    let pen = 0;
    const tgt = [
        { v: r.at4h, lo: 0.5, hi: 1.0 },
        { v: r.at8h, lo: 1.5, hi: 2.0 },
        { v: r.at12h, lo: 2.5, hi: 3.5 },
    ];
    for (const t of tgt) {
        if (t.v < t.lo) pen += (t.lo - t.v) ** 2;
        else if (t.v > t.hi) pen += (t.v - t.hi) ** 2;
    }
    return { pen, r };
}

if (MODE === 'baseline') {
    report('BASELINE (current model)', BASELINE);
    // Verify the zero-insulin proxy matches the real G.6 transient.
    const proxy = zeroInsulinRamp(BASELINE);
    const real = scenarioG6(BASELINE);
    console.log('\n--- G.6 proxy vs real (baseline) ---');
    console.log('  +4h  proxy ' + proxy.at4h.toFixed(2) + '  real ' + real.at4h.toFixed(2));
    console.log('  +8h  proxy ' + proxy.at8h.toFixed(2) + '  real ' + real.at8h.toFixed(2));
    console.log('  +12h proxy ' + proxy.at12h.toFixed(2) + '  real ' + real.at12h.toFixed(2));
}

if (MODE === 'sweep') {
    // Combined sweep: CPT-1 shape (moderate-insulin lever) + BHB_PROD_RATE +
    // FFA_LIPO_CLEAR_HALF (G.6 ramp-speed lever). Scored against steady-state
    // targets AND the zero-insulin G.6 proxy.
    // Pair each FFA_LIPO_CLEAR_HALF with BHB_PROD_RATE values scaled inversely
    // (longer clearance → higher steady-state ffaLipolysis → need lower PROD to
    // keep moderate-insulin BHB in range). Longer CLR gives a more S-shaped G.6
    // ramp (slow early, DKA late) which is what codex's slow-ramp target needs.
    const clrProd = [
        { clr: 60,  prods: [0.0016, 0.0020, 0.0024] },
        { clr: 120, prods: [0.0009, 0.0011, 0.0013] },
        { clr: 180, prods: [0.0006, 0.0008, 0.0010] },
        { clr: 240, prods: [0.0005, 0.0006, 0.0007] },
    ];
    const grid = {
        CPT1_EC50:   [9, 11, 13, 15],
        CPT1_HILL_N: [2.0, 2.5, 3.0],
    };
    const results = [];
    for (const e of grid.CPT1_EC50)
    for (const h of grid.CPT1_HILL_N)
    for (const cp of clrProd)
    for (const b of cp.prods) {
        const c = cp.clr;
        const params = { ...BASELINE, CPT1_EC50: e, CPT1_HILL_N: h, BHB_PROD_RATE: b, FFA_LIPO_CLEAR_HALF: c };
        const ss = ssPenalty(params);
        const g6 = g6Penalty(params);
        results.push({ params, total: ss.pen + g6.pen, ssPen: ss.pen, g6Pen: g6.pen, vals: ss.vals, g6: g6.r });
    }
    results.sort((a, b) => a.total - b.total);
    console.log('\n=== COMBINED SWEEP: top 15 (steady-state + G.6 proxy) ===');
    console.log('rk total ssP  g6P  | EC50 HiN PROD   CLR | I20  I12  I8   I6   | g6_4 g6_8 g6_12');
    results.slice(0, 15).forEach((r, i) => {
        const p = r.params, v = r.vals, g = r.g6;
        console.log(
            `${String(i+1).padStart(2)} ${r.total.toFixed(2).padStart(5)} ${r.ssPen.toFixed(2)} ${r.g6Pen.toFixed(2)} | ` +
            `${String(p.CPT1_EC50).padStart(2)}  ${p.CPT1_HILL_N.toFixed(1)} ${p.BHB_PROD_RATE.toFixed(4)} ${String(p.FFA_LIPO_CLEAR_HALF).padStart(3)} | ` +
            `${v.I20.toFixed(2)} ${v.I12.toFixed(2)} ${v.I8.toFixed(2)} ${v.I6.toFixed(2)} | ` +
            `${g.at4h.toFixed(2)} ${g.at8h.toFixed(2)} ${g.at12h.toFixed(2)}`
        );
    });
    fs.writeFileSync(path.join(__dirname, '.ketone-top.json'),
        JSON.stringify(results.slice(0, 6).map(r => r.params), null, 2));
    console.log('\nTop 6 saved to tests/.ketone-top.json — run with KETONE_MODE=validate');
}

// Full time-series version of the zero-insulin ramp (for the SVG ramp plot).
function zeroInsulinRampSeries(params, hours) {
    const sim = createSim();
    applyParams(sim, params);
    sim.ffaLipolysis = 0; sim.ketoneLevel = 0; sim.ffaBlood = 0;
    sim.smoothHeartRate = sim.hovorka.HR_base;
    const out = [];
    for (let m = 0; m <= hours * 60; m++) {
        if (m > 0) { sim.hovorka.state[6] = 0; sim._substepKetones(1.0); }
        if (m % 10 === 0) out.push({ t: m / 60, bhb: sim.ketoneLevel });
    }
    return out;
}

if (MODE === 'svg') {
    // Generate the calibration figure: two stacked panels.
    //   Panel A: steady-state insulin -> BHB (old vs new curve + clinical target boxes)
    //   Panel B: pump-failure ramp time -> BHB (old vs new + codex target points)
    // Explicit old/new parameter sets (independent of the live simulator.js defaults).
    const COMMON = { LIPOLYSIS_MAX: 0.09, LIPOLYSIS_HILL_N: 3, CPT1_MAX_SUPP: 0.95, BHB_DIET_FAT_FRAC: 0.35 };
    const OLD = { ...COMMON, LIPOLYSIS_EC50: 8, CPT1_EC50: 5, CPT1_HILL_N: 5, FFA_LIPO_CLEAR_HALF: 60, BHB_PROD_RATE: 0.0028, BHB_VMAX: 0.02 };
    const NEW = { ...COMMON, LIPOLYSIS_EC50: 5, CPT1_EC50: 7, CPT1_HILL_N: 2.5, FFA_LIPO_CLEAR_HALF: 120, BHB_PROD_RATE: 0.0012, BHB_VMAX: 0.016 };

    // Panel A data: insulin 0..24
    const insAxis = [];
    for (let i = 0; i <= 24; i += 0.5) insAxis.push(i);
    const ssOld = insAxis.map(I => ({ I, bhb: steadyStateBHB(OLD, I, 36 * 60) }));
    const ssNew = insAxis.map(I => ({ I, bhb: steadyStateBHB(NEW, I, 36 * 60) }));
    const ssTargets = [
        { I: 20, lo: 0.00, hi: 0.15, src: 'Pinnaro (postpr.)' },
        { I: 12, lo: 0.10, hi: 0.35, src: 'good day basal' },
        { I: 9,  lo: 0.15, hi: 0.40, src: 'overnight basal' },
        { I: 7,  lo: 0.25, hi: 0.50, src: 'night basal tail' },
    ];

    // Panel B data: ramp 0..24h (long enough to show the severe-DKA climb, not just early)
    const rampOld = zeroInsulinRampSeries(OLD, 24);
    const rampNew = zeroInsulinRampSeries(NEW, 24);
    const rampTargets = [
        { t: 4,  lo: 0.5, hi: 1.0, src: 'Guerci 2006' },
        { t: 8,  lo: 1.5, hi: 2.0, src: 'PMC11531023' },
        { t: 12, lo: 2.5, hi: 3.5, src: 'PMC11531023' },
    ];

    // --- SVG builders ---
    const W = 720, padL = 60, padR = 180, padT = 38, panelH = 230, gapV = 60;
    const plotW = W - padL - padR;
    const H = padT + panelH * 2 + gapV + 30;

    // Panel A scales: x 0..24, y 0..2.0
    const ax0 = padT;
    const axMaxY = 2.0;
    const aX = I => padL + (I / 24) * plotW;
    const aY = bhb => ax0 + panelH - (Math.min(bhb, axMaxY) / axMaxY) * panelH;
    // Panel B scales: x 0..16, y 0..5
    const bx0 = padT + panelH + gapV;
    const bxMaxY = 8.0;
    const bxMaxX = 24;
    const bX = t => padL + (t / bxMaxX) * plotW;
    const bY = bhb => bx0 + panelH - (Math.min(bhb, bxMaxY) / bxMaxY) * panelH;

    const polyA = pts => pts.map(p => `${aX(p.I).toFixed(1)},${aY(p.bhb).toFixed(1)}`).join(' ');
    const polyB = pts => pts.map(p => `${bX(p.t).toFixed(1)},${bY(p.bhb).toFixed(1)}`).join(' ');

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, -apple-system, sans-serif">
<style>
  .bg{fill:#1a1d28}
  .grid{stroke:#2e3444;stroke-width:1}
  .axis{stroke:#8b95a7;stroke-width:1.2}
  .axlabel{fill:#cbd5e1;font-size:11px}
  .title{fill:#e5e7eb;font-size:13px;font-weight:600}
  .tick{fill:#9aa4b5;font-size:10px}
  .curveNew{fill:none;stroke:#3b82f6;stroke-width:2.4}
  .curveOld{fill:none;stroke:#94a3b8;stroke-width:1.8;stroke-dasharray:5 4}
  .tbox{fill:#22c55e;fill-opacity:0.18;stroke:#22c55e;stroke-opacity:0.7;stroke-width:1}
  .tpt{stroke:#f97316;stroke-width:2}
  .tdot{fill:#f97316}
  .legtxt{fill:#cbd5e1;font-size:11px}
  .dka{stroke:#ef4444;stroke-width:1;stroke-dasharray:4 3;stroke-opacity:0.8}
  .dkatxt{fill:#ef4444;font-size:10px}
</style>
<rect class="bg" x="0" y="0" width="${W}" height="${H}"/>`;

    // ---- Panel A ----
    svg += `\n<text class="title" x="${padL}" y="20">A — Steady-state plasma insulin to BHB (calibration of CPT-1 shape)</text>`;
    // gridlines y
    for (let y = 0; y <= axMaxY + 0.001; y += 0.5) {
        svg += `\n<line class="grid" x1="${padL}" y1="${aY(y).toFixed(1)}" x2="${padL+plotW}" y2="${aY(y).toFixed(1)}"/>`;
        svg += `\n<text class="tick" x="${padL-8}" y="${(aY(y)+3).toFixed(1)}" text-anchor="end">${y.toFixed(1)}</text>`;
    }
    for (let x = 0; x <= 24; x += 4) {
        svg += `\n<text class="tick" x="${aX(x).toFixed(1)}" y="${(ax0+panelH+14).toFixed(1)}" text-anchor="middle">${x}</text>`;
    }
    // target boxes (width ~1.4 mU/L around the insulin level)
    for (const t of ssTargets) {
        const x1 = aX(t.I - 0.7), x2 = aX(t.I + 0.7);
        const yTop = aY(t.hi), yBot = aY(t.lo);
        svg += `\n<rect class="tbox" x="${x1.toFixed(1)}" y="${yTop.toFixed(1)}" width="${(x2-x1).toFixed(1)}" height="${(yBot-yTop).toFixed(1)}"/>`;
        svg += `\n<text class="tick" x="${aX(t.I).toFixed(1)}" y="${(yTop-4).toFixed(1)}" text-anchor="middle">I=${t.I}</text>`;
    }
    svg += `\n<polyline class="curveOld" points="${polyA(ssOld)}"/>`;
    svg += `\n<polyline class="curveNew" points="${polyA(ssNew)}"/>`;
    // axes
    svg += `\n<line class="axis" x1="${padL}" y1="${ax0}" x2="${padL}" y2="${ax0+panelH}"/>`;
    svg += `\n<line class="axis" x1="${padL}" y1="${ax0+panelH}" x2="${padL+plotW}" y2="${ax0+panelH}"/>`;
    svg += `\n<text class="axlabel" x="${padL+plotW/2}" y="${(ax0+panelH+28).toFixed(1)}" text-anchor="middle">plasma insulin (mU/L)</text>`;
    svg += `\n<text class="axlabel" x="${18}" y="${(ax0+panelH/2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 18 ${(ax0+panelH/2).toFixed(1)})">BHB (mmol/L)</text>`;

    // ---- Panel B ----
    svg += `\n<text class="title" x="${padL}" y="${(bx0-12).toFixed(1)}">B — Pump-failure ramp: BHB after insulin to zero (calibration of ramp speed)</text>`;
    for (let y = 0; y <= bxMaxY + 0.001; y += 1) {
        svg += `\n<line class="grid" x1="${padL}" y1="${bY(y).toFixed(1)}" x2="${padL+plotW}" y2="${bY(y).toFixed(1)}"/>`;
        svg += `\n<text class="tick" x="${padL-8}" y="${(bY(y)+3).toFixed(1)}" text-anchor="end">${y}</text>`;
    }
    for (let x = 0; x <= bxMaxX; x += 4) {
        svg += `\n<text class="tick" x="${bX(x).toFixed(1)}" y="${(bx0+panelH+14).toFixed(1)}" text-anchor="middle">${x}</text>`;
    }
    // DKA threshold
    svg += `\n<line class="dka" x1="${padL}" y1="${bY(3).toFixed(1)}" x2="${padL+plotW}" y2="${bY(3).toFixed(1)}"/>`;
    svg += `\n<text class="dkatxt" x="${(padL+plotW-4).toFixed(1)}" y="${(bY(3)-4).toFixed(1)}" text-anchor="end">DKA threshold 3.0</text>`;
    // target error bars
    for (const t of rampTargets) {
        const x = bX(t.t);
        svg += `\n<line class="tpt" x1="${x.toFixed(1)}" y1="${bY(t.lo).toFixed(1)}" x2="${x.toFixed(1)}" y2="${bY(t.hi).toFixed(1)}"/>`;
        svg += `\n<line class="tpt" x1="${(x-4).toFixed(1)}" y1="${bY(t.hi).toFixed(1)}" x2="${(x+4).toFixed(1)}" y2="${bY(t.hi).toFixed(1)}"/>`;
        svg += `\n<line class="tpt" x1="${(x-4).toFixed(1)}" y1="${bY(t.lo).toFixed(1)}" x2="${(x+4).toFixed(1)}" y2="${bY(t.lo).toFixed(1)}"/>`;
    }
    svg += `\n<polyline class="curveOld" points="${polyB(rampOld)}"/>`;
    svg += `\n<polyline class="curveNew" points="${polyB(rampNew)}"/>`;
    svg += `\n<line class="axis" x1="${padL}" y1="${bx0}" x2="${padL}" y2="${bx0+panelH}"/>`;
    svg += `\n<line class="axis" x1="${padL}" y1="${bx0+panelH}" x2="${padL+plotW}" y2="${bx0+panelH}"/>`;
    svg += `\n<text class="axlabel" x="${padL+plotW/2}" y="${(bx0+panelH+28).toFixed(1)}" text-anchor="middle">hours after insulin to zero</text>`;
    svg += `\n<text class="axlabel" x="${18}" y="${(bx0+panelH/2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 18 ${(bx0+panelH/2).toFixed(1)})">BHB (mmol/L)</text>`;

    // ---- Legend (right margin) ----
    const lx = padL + plotW + 20;
    let ly = padT + 6;
    const legLine = (cls, label) => {
        svg += `\n<line class="${cls}" x1="${lx}" y1="${ly}" x2="${lx+28}" y2="${ly}"/>`;
        svg += `\n<text class="legtxt" x="${lx+34}" y="${ly+4}">${label}</text>`;
        ly += 22;
    };
    legLine('curveNew', 'New calibration');
    legLine('curveOld', 'Old (pre-2026-06-06)');
    // target box swatch
    svg += `\n<rect class="tbox" x="${lx}" y="${ly-8}" width="28" height="14"/>`;
    svg += `\n<text class="legtxt" x="${lx+34}" y="${ly+3}">Clinical target</text>`; ly += 22;
    svg += `\n<line class="tpt" x1="${lx+14}" y1="${ly-8}" x2="${lx+14}" y2="${ly+6}"/>`;
    svg += `\n<line class="tpt" x1="${lx+10}" y1="${ly-8}" x2="${lx+18}" y2="${ly-8}"/>`;
    svg += `\n<line class="tpt" x1="${lx+10}" y1="${ly+6}" x2="${lx+18}" y2="${ly+6}"/>`;
    svg += `\n<text class="legtxt" x="${lx+34}" y="${ly+3}">Target range</text>`; ly += 30;
    // source notes
    svg += `\n<text class="legtxt" x="${lx}" y="${ly}" font-size="9.5">Panel A sources:</text>`; ly += 14;
    for (const t of ssTargets) { svg += `\n<text class="legtxt" x="${lx}" y="${ly}" font-size="9">I=${t.I}: ${t.src}</text>`; ly += 13; }
    ly += 6;
    svg += `\n<text class="legtxt" x="${lx}" y="${ly}" font-size="9.5">Panel B sources:</text>`; ly += 14;
    svg += `\n<text class="legtxt" x="${lx}" y="${ly}" font-size="9">Guerci 2006,</text>`; ly += 12;
    svg += `\n<text class="legtxt" x="${lx}" y="${ly}" font-size="9">PMC11531023</text>`;

    svg += `\n</svg>\n`;

    const outPath = path.join(__dirname, '..', 'docs', 'MODEL-KETONES-CALIBRATION.svg');
    fs.writeFileSync(outPath, svg);
    console.log('SVG written to docs/MODEL-KETONES-CALIBRATION.svg (' + svg.length + ' bytes)');
    console.log('Panel A new curve sample: I=6 ' + steadyStateBHB(NEW, 6, 36*60).toFixed(2) +
        ', I=12 ' + steadyStateBHB(NEW, 12, 36*60).toFixed(2));
    console.log('Panel B new ramp +4h ' + rampNew.find(p => p.t === 4).bhb.toFixed(2) +
        ', +12h ' + rampNew.find(p => p.t === 12).bhb.toFixed(2));
}

// --- G.4 overnight fast (10h, 14U basal, evening meal then sleep) ---
function scenarioG4(params) {
    const sim = createSim();
    applyParams(sim, params);
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 20 * 60);
    sim.addFood(60, 10, 15); sim.addFastInsulin(6);
    advanceTo(sim, 22 * 60);
    sim.addLongInsulin(14, sim.totalSimMinutes, true);
    clampBG(sim, 6.5);
    // Sample plasma insulin + BG through the night to see the operating point.
    let iSum = 0, n = 0, bgSum = 0;
    const startT = sim.totalSimMinutes, endT = startT + 10 * 60;
    let maxBhb = sim.ketoneLevel;
    while (sim.totalSimMinutes < endT - 0.01) {
        sim.update(5.0);
        iSum += sim.hovorka.plasmaInsulin; bgSum += sim.trueBG; n++;
        if (sim.ketoneLevel > maxBhb) maxBhb = sim.ketoneLevel;
    }
    return { max: maxBhb, end: sim.ketoneLevel, meanI: iSum / n, meanBG: bgSum / n };
}

if (MODE === 'check') {
    // Measure overnight-fast (G.4) and full pump-failure (G.6) with LIVE params.
    const live = {}; // no override -> uses simulator.js current values
    const g4 = scenarioG4(live);
    const g6 = scenarioG6(live);
    console.log('--- Current live calibration ---');
    console.log('G.4 overnight fast (10h): max BHB ' + g4.max.toFixed(2) +
        ', morning BHB ' + g4.end.toFixed(2) + '  [Pinnaro 2021 well-ctrl T1D: 0.05-0.3]');
    console.log('       overnight mean plasma insulin ' + g4.meanI.toFixed(1) + ' mU/L, mean BG ' + g4.meanBG.toFixed(1) + ' mmol/L');
    console.log('G.6 pump failure (full scenario after normal day):');
    console.log('  +4h  ' + g6.at4h.toFixed(2) + '  [Guerci 0.5-1.0; Laffel 1.5-2.0]');
    console.log('  +8h  ' + g6.at8h.toFixed(2) + '  [Guerci 1.5-2.0; Laffel 3.5-4.5]');
    console.log('  +12h ' + g6.at12h.toFixed(2) + '  [~3.0]');
    console.log('  +24h ' + g6.at24h.toFixed(2));
    console.log('  max  ' + g6.max.toFixed(2));
}

if (MODE === 'sweep2') {
    // Revised targets after user feedback (2026-06-06): overnight (I≈9, well-
    // controlled) was too high (~0.9 vs Pinnaro 0.05-0.3), pump-failure a bit low.
    // Pull moderate-insulin DOWN (steeper CPT-1) and zero-insulin ramp UP (higher
    // production). The two are separable because CPT-1 shape doesn't affect I=0.
    const SS2 = [
        { I: 20, lo: 0.00, hi: 0.15, w: 1 },
        { I: 12, lo: 0.10, hi: 0.35, w: 1 },
        { I: 9,  lo: 0.20, hi: 0.45, w: 3 },   // overnight operating point — weighted
        { I: 8,  lo: 0.30, hi: 0.70, w: 1 },
        { I: 6,  lo: 0.60, hi: 1.30, w: 1 },
    ];
    function ss2Penalty(params) {
        let pen = 0; const vals = {};
        for (const t of SS2) {
            const v = steadyStateBHB(params, t.I, 36 * 60); vals['I' + t.I] = v;
            if (v < t.lo) pen += t.w * (t.lo - v) ** 2;
            else if (v > t.hi) pen += t.w * (v - t.hi) ** 2 * 4;
        }
        return { pen, vals };
    }
    // G.6 proxy targets raised toward Laffel (clean-state proxy reads ~1.2x low vs full):
    function g6p2(params) {
        const r = zeroInsulinRamp(params);
        let pen = 0;
        const t = [ { v: r.at4h, lo: 1.0, hi: 1.6 }, { v: r.at8h, lo: 2.2, hi: 2.9 }, { v: r.at12h, lo: 3.0, hi: 3.8 } ];
        for (const x of t) { if (x.v < x.lo) pen += (x.lo - x.v) ** 2; else if (x.v > x.hi) pen += (x.v - x.hi) ** 2; }
        return { pen, r };
    }
    const clrProd = [
        { clr: 120, prods: [0.0012, 0.0015, 0.0018] },
        { clr: 150, prods: [0.0010, 0.0013, 0.0016] },
        { clr: 180, prods: [0.0009, 0.0011, 0.0014] },
    ];
    const results = [];
    for (const e of [8, 9, 10, 11])
    for (const h of [2.5, 3.0, 3.5])
    for (const cp of clrProd)
    for (const b of cp.prods) {
        const params = { ...BASELINE, CPT1_EC50: e, CPT1_HILL_N: h, BHB_PROD_RATE: b, FFA_LIPO_CLEAR_HALF: cp.clr };
        const ss = ss2Penalty(params), g6 = g6p2(params);
        results.push({ params, total: ss.pen + g6.pen, ssPen: ss.pen, g6Pen: g6.pen, vals: ss.vals, g6: g6.r });
    }
    results.sort((a, b) => a.total - b.total);
    console.log('=== SWEEP2: top 15 (revised: lower overnight, higher pump-failure) ===');
    console.log('rk total ssP  g6P  | EC50 HiN PROD   CLR | I20  I12  I9   I8   I6   | g6_4 g6_8 g6_12');
    results.slice(0, 15).forEach((r, i) => {
        const p = r.params, v = r.vals, g = r.g6;
        console.log(
            `${String(i+1).padStart(2)} ${r.total.toFixed(2).padStart(5)} ${r.ssPen.toFixed(2)} ${r.g6Pen.toFixed(2)} | ` +
            `${String(p.CPT1_EC50).padStart(2)}  ${p.CPT1_HILL_N.toFixed(1)} ${p.BHB_PROD_RATE.toFixed(4)} ${String(p.FFA_LIPO_CLEAR_HALF).padStart(3)} | ` +
            `${v.I20.toFixed(2)} ${v.I12.toFixed(2)} ${v.I9.toFixed(2)} ${v.I8.toFixed(2)} ${v.I6.toFixed(2)} | ` +
            `${g.at4h.toFixed(2)} ${g.at8h.toFixed(2)} ${g.at12h.toFixed(2)}`
        );
    });
    fs.writeFileSync(path.join(__dirname, '.ketone-top.json'),
        JSON.stringify(results.slice(0, 6).map(r => r.params), null, 2));
    console.log('\nTop 6 saved — run KETONE_MODE=validate2');
}

if (MODE === 'validate2') {
    const top = JSON.parse(fs.readFileSync(path.join(__dirname, '.ketone-top.json'), 'utf8'));
    top.forEach((params, i) => {
        const g4 = scenarioG4(params);
        const g6 = scenarioG6(params);
        console.log('\n--- CANDIDATE ' + (i + 1) + ' --- ' + JSON.stringify({EC50:params.CPT1_EC50,Hill:params.CPT1_HILL_N,PROD:params.BHB_PROD_RATE,CLR:params.FFA_LIPO_CLEAR_HALF}));
        console.log('  G.4 overnight: max ' + g4.max.toFixed(2) + ' (I=' + g4.meanI.toFixed(1) + ', target 0.2-0.5)');
        console.log('  G.6 full: +4h ' + g6.at4h.toFixed(2) + '  +8h ' + g6.at8h.toFixed(2) + '  +12h ' + g6.at12h.toFixed(2) + '  +24h ' + g6.at24h.toFixed(2));
    });
}

if (MODE === 'sweep3') {
    // Add LIPOLYSIS_EC50 as a second moderate-insulin lever (independent of I=0,
    // where lipolyseRate = LIPOLYSIS_MAX regardless of EC50). Target the I=7 morning
    // operating point tightly (G.4 peaks there as basal wanes) while keeping the
    // zero-insulin pump-failure ramp high.
    const SS3 = [
        { I: 20, lo: 0.00, hi: 0.15, w: 1 },
        { I: 12, lo: 0.10, hi: 0.35, w: 1 },
        { I: 9,  lo: 0.15, hi: 0.40, w: 2 },
        { I: 7,  lo: 0.25, hi: 0.50, w: 3 },   // G.4 morning operating point
        { I: 5,  lo: 0.50, hi: 1.20, w: 1 },
    ];
    function ssp(params) {
        let pen = 0; const vals = {};
        for (const t of SS3) {
            const v = steadyStateBHB(params, t.I, 36 * 60); vals['I' + t.I] = v;
            if (v < t.lo) pen += t.w * (t.lo - v) ** 2;
            else if (v > t.hi) pen += t.w * (v - t.hi) ** 2 * 4;
        }
        return { pen, vals };
    }
    function g6p(params) {
        const r = zeroInsulinRamp(params);
        let pen = 0;
        const t = [ { v: r.at4h, lo: 1.0, hi: 1.6 }, { v: r.at8h, lo: 2.2, hi: 2.9 }, { v: r.at12h, lo: 3.0, hi: 3.8 } ];
        for (const x of t) { if (x.v < x.lo) pen += (x.lo - x.v) ** 2; else if (x.v > x.hi) pen += (x.v - x.hi) ** 2; }
        return { pen, r };
    }
    const clrProd = [
        { clr: 120, prods: [0.0012, 0.0015, 0.0018] },
        { clr: 150, prods: [0.0010, 0.0013, 0.0016] },
    ];
    const results = [];
    for (const le of [5, 6, 7, 8])
    for (const e of [7, 8, 9])
    for (const h of [2.5, 3.0])
    for (const cp of clrProd)
    for (const b of cp.prods) {
        const params = { ...BASELINE, LIPOLYSIS_EC50: le, CPT1_EC50: e, CPT1_HILL_N: h, BHB_PROD_RATE: b, FFA_LIPO_CLEAR_HALF: cp.clr };
        const ss = ssp(params), g6 = g6p(params);
        results.push({ params, total: ss.pen + g6.pen, ssPen: ss.pen, g6Pen: g6.pen, vals: ss.vals, g6: g6.r });
    }
    results.sort((a, b) => a.total - b.total);
    console.log('=== SWEEP3: top 12 (LIPOLYSIS_EC50 added, I=7 morning weighted) ===');
    console.log('rk total | LipEC CptEC HiN PROD  CLR | I20  I12  I9   I7   I5   | g6_4 g6_8 g6_12');
    results.slice(0, 12).forEach((r, i) => {
        const p = r.params, v = r.vals, g = r.g6;
        console.log(
            `${String(i+1).padStart(2)} ${r.total.toFixed(2).padStart(5)} | ` +
            `${String(p.LIPOLYSIS_EC50).padStart(3)}   ${String(p.CPT1_EC50).padStart(2)}   ${p.CPT1_HILL_N.toFixed(1)} ${p.BHB_PROD_RATE.toFixed(4)} ${String(p.FFA_LIPO_CLEAR_HALF).padStart(3)} | ` +
            `${v.I20.toFixed(2)} ${v.I12.toFixed(2)} ${v.I9.toFixed(2)} ${v.I7.toFixed(2)} ${v.I5.toFixed(2)} | ` +
            `${g.at4h.toFixed(2)} ${g.at8h.toFixed(2)} ${g.at12h.toFixed(2)}`
        );
    });
    fs.writeFileSync(path.join(__dirname, '.ketone-top.json'),
        JSON.stringify(results.slice(0, 6).map(r => r.params), null, 2));
    console.log('\nTop 6 saved — run KETONE_MODE=validate2');
}

if (MODE === 'clearance') {
    // The pump-failure ramp plateaus at ~5.7 (production ≈ clearance). Real severe
    // untreated DKA keeps climbing toward 10-15+. Lowering BHB_VMAX (peripheral
    // ketone-oxidation ceiling, impaired in severe acidosis) lets severe DKA climb,
    // and because MM clearance is near-LINEAR at low BHB but SATURATED at high BHB,
    // lowering Vmax disproportionately raises the high-BHB plateau while barely
    // touching the low-BHB overnight value. Sweep to find the balance.
    const live = {}; // current simulator.js values
    console.log('Vmax  | G.4 overnight | G.6 +12h +24h +48h +72h max');
    for (const vmax of [0.020, 0.018, 0.016, 0.014, 0.012]) {
        const p = { BHB_VMAX: vmax };
        const g4 = scenarioG4(p);
        const g6 = scenarioG6(p);
        // also need +72h — scenarioG6 returns at72? no, returns at24 max. Extend:
        console.log(`${vmax.toFixed(3)} |   ${g4.max.toFixed(2)}        | ${g6.at12h.toFixed(2)} ${g6.at24h.toFixed(2)} ${g6.max.toFixed(2)}`);
    }
    console.log('(G.6 max ≈ +48h plateau; current live Vmax=0.020)');
    console.log('\n--- combos: Vmax + LIPOLYSIS_EC50 (re-lower overnight) ---');
    console.log('Vmax  LipEC | G.4 overnight | G.3 keto | G.5 fast | G.6 +12h +24h +48h');
    for (const [vmax, le] of [[0.016, 5], [0.016, 6], [0.017, 5], [0.018, 5]]) {
        const p = { BHB_VMAX: vmax, LIPOLYSIS_EC50: le };
        const g4 = scenarioG4(p), g3 = scenarioG3(p), g5 = scenarioG5(p), g6 = scenarioG6(p);
        console.log(`${vmax.toFixed(3)} ${le}    |   ${g4.max.toFixed(2)}        |   ${g3.toFixed(2)}   |   ${g5.toFixed(2)}   | ${g6.at12h.toFixed(2)} ${g6.at24h.toFixed(2)} ${g6.max.toFixed(2)}`);
    }
}

if (MODE === 'g4trace') {
    // Trace G.4 overnight BHB + insulin hour by hour with candidate 1 params.
    const p = { ...BASELINE, CPT1_EC50: 8, CPT1_HILL_N: 2.5, BHB_PROD_RATE: 0.0012, FFA_LIPO_CLEAR_HALF: 120 };
    const sim = createSim(); applyParams(sim, p);
    sim.addLongInsulin(14, -2 * 60, true);
    advanceTo(sim, 20 * 60);
    sim.addFood(60, 10, 15); sim.addFastInsulin(6);
    advanceTo(sim, 22 * 60);
    sim.addLongInsulin(14, sim.totalSimMinutes, true);
    clampBG(sim, 6.5);
    console.log('clock | BHB  | plasmaI | BG');
    const startT = sim.totalSimMinutes;
    for (let hh = 0; hh <= 10; hh++) {
        const clock = (22 + hh) % 24;
        console.log(`${String(clock).padStart(2,'0')}:00 | ${sim.ketoneLevel.toFixed(2)} | ${sim.hovorka.plasmaInsulin.toFixed(1).padStart(5)}   | ${sim.trueBG.toFixed(1)}`);
        let t = sim.totalSimMinutes; while (sim.totalSimMinutes < t + 60 - 0.01 && sim.totalSimMinutes < startT + 10*60) sim.update(5.0);
    }
}

if (MODE === 'dietfat') {
    // How does BHB_DIET_FAT_FRAC affect G.4 (evening meal + overnight) vs G.3 (keto)?
    // Uses candidate 1 base params (steeper CPT-1, higher production).
    const base = { ...BASELINE, CPT1_EC50: 8, CPT1_HILL_N: 2.5, BHB_PROD_RATE: 0.0012, FFA_LIPO_CLEAR_HALF: 120 };
    console.log('alpha | G.4 overnight max | G.3 keto plateau');
    for (const a of [0, 0.10, 0.20, 0.30, 0.35]) {
        const p = { ...base, BHB_DIET_FAT_FRAC: a };
        const g4 = scenarioG4(p);
        const g3 = scenarioG3(p);
        console.log(`${a.toFixed(2)}  |   ${g4.max.toFixed(2)}            |   ${g3.toFixed(2)}`);
    }
}

if (MODE === 'probe') {
    // Measure the clean-state pump-failure ramp using the LIVE simulator.js params
    // (no override) at multiple timepoints — replicates what the node tests do.
    const sim = createSim();
    sim.activeFastInsulin = []; sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;
    [2,3,6,7,8,9,13,14,15].forEach(i => { sim.hovorka.state[i] = 0; });
    console.log('Clean-state pump-failure ramp (live simulator.js params):');
    let t = 0;
    for (const target of [4, 8, 12, 16, 20]) {
        while (t < target * 60) { sim.update(1.0); t++; }
        console.log('  +' + target + 'h: BHB ' + sim.ketoneLevel.toFixed(2) + '  acidosisLoad ' + sim.acidosisLoad.toFixed(1));
    }
}

if (MODE === 'validate') {
    // PHASE 2: run full transients (G.3/G.5/G.6) for the top steady-state candidates.
    const top = JSON.parse(fs.readFileSync(path.join(__dirname, '.ketone-top.json'), 'utf8'));
    top.forEach((params, i) => {
        report('CANDIDATE ' + (i + 1), params);
    });
}
