// Studieinformeret test af motion mod identisk hvilekontrol, 2026-09-06.
// Pemberton 2025, DOI 10.1111/dme.70146: CGM fra start til 20 min efter stop.
// Dette rekonstruerer ikke kohorten: måltidshistorik og individdata mangler.
// Ingen produktionsparametre kalibreres. Kun startbetingelser tilpasses.
// Kør med tests/.bin/node.exe tests/exercise-pemberton-review.cjs [--json]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createEngine } = require('../js/physiology-engine.js');
const { HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');
const profile = { weight: 70, isf: 3, icr: 10 };
const modulesOff = { dawn: false, dawnVariability: false, insulinVariability: false,
    sleepDisruption: false, cgmSensorFaults: false };
const round = n => +n.toFixed(5);

function create() {
    return createEngine(profile, { seed: 20260906, noiseEnabled: false, modules: modulesOff });
}
function sample(e) {
    return { bg: e.trueBG, sensor: e.hovorka.cgmValue, displayed: e.cgmBG,
        iob: e.iob, plasmaInsulin: e.hovorka.state[S.I] };
}
function prepare(initialBG, { targetCGM = 11.7, iobPerKg = 0.01, age = 120, dt = 0.125, mealCarbs = 0 }) {
    const e = create();
    // Bolus gives kl. 12 og aktivitet begynder efter age minutter, altid om dagen.
    e.totalSimMinutes = e.timeInMinutes = 720;
    e.initSteadyState({ targetBG: initialBG });
    e.lastCgmCalculationTime = e.totalSimMinutes;
    // Studiets estimerede IOB bruger 4 timers lineært henfald. Den er IKKE
    // identisk med motorens depotbaserede IOB; begge rapporteres separat.
    const units = iobPerKg * profile.weight / (1 - age / 240);
    if (units > 0) assert(e.addRapidInsulin({ units }));
    const history = [];
    for (let k = 0; k <= age / dt; k++) {
        const t = k * dt - age;
        if (t === -45 && mealCarbs > 0) assert(e.addFood({
            carbs: mealCarbs, protein: 0, fat: 0, weight: mealCarbs * 2,
            eatTimeMin: 5, carbParams: { simpleFraction: 0.20, fiberPerGram: 0.08, retentionFactor: 1 }
        }));
        if (t >= -60) history.push({ t, ...sample(e) });
        if (k < age / dt) e.step(dt);
        e.consumeEvents();
    }
    return { e, history, units, initialBG, targetCGM, mealCarbs };
}
function startErrors(p, target) {
    const previous = p.history.find(row => row.t === -15);
    return [p.e.hovorka.cgmValue - target, p.e.hovorka.cgmValue - previous.sensor];
}
const preparedCache = new Map();
function matchedStart(options) {
    const key = JSON.stringify(options);
    if (preparedCache.has(key)) return preparedCache.get(key);
    if (options.flat) {
        // To startkrav: CGM-niveau og nul ændring i de seneste 15 minutter.
        // Kulhydratmængden er en syntetisk forhistorie, IKKE studiets måltid.
        // Newton-metoden må aldrig se motionsarmens efterfølgende resultat.
        let bg = 12, carbs = 10, result;
        for (let n = 0; n < 20; n++) {
            result = prepare(bg, { ...options, mealCarbs: carbs });
            const r = startErrors(result, options.targetCGM);
            if (Math.abs(r[0]) < 0.005 && Math.abs(r[1]) < 0.005) break;
            const a = startErrors(prepare(bg + 0.1, { ...options, mealCarbs: carbs }), options.targetCGM);
            const b = startErrors(prepare(bg, { ...options, mealCarbs: carbs + 0.5 }), options.targetCGM);
            const j00 = (a[0] - r[0]) / 0.1, j10 = (a[1] - r[1]) / 0.1;
            const j01 = (b[0] - r[0]) / 0.5, j11 = (b[1] - r[1]) / 0.5;
            const det = j00 * j11 - j01 * j10;
            assert(Math.abs(det) > 1e-8, 'Startkravene kunne ikke løses');
            bg = Math.max(5, Math.min(19, bg - (j11 * r[0] - j01 * r[1]) / det));
            carbs = Math.max(0, Math.min(150, carbs - (-j10 * r[0] + j00 * r[1]) / det));
        }
        const errors = startErrors(result, options.targetCGM);
        assert(errors.every(x => Math.abs(x) < 0.005), JSON.stringify({ options, errors }));
        preparedCache.set(key, result);
        return result;
    }
    // Søg kun start-BG, aldrig en motionsparameter eller et slutresultat.
    // Glukose tilføjes/fjernes ikke ved selve aktivitetsstarten.
    let lo = options.targetCGM, hi = 19.5;
    let lower = prepare(lo, options), upper = prepare(hi, options);
    assert(lower.e.hovorka.cgmValue <= options.targetCGM + 0.01);
    if (upper.e.hovorka.cgmValue < options.targetCGM) {
        return { excluded: true, reason: 'Kan ikke nå start-CGM med denne måltidsfri forhistorie', ...options };
    }
    let result;
    for (let n = 0; n < 20; n++) {
        result = prepare((lo + hi) / 2, options);
        if (result.e.hovorka.cgmValue > options.targetCGM) hi = result.initialBG;
        else lo = result.initialBG;
    }
    assert(Math.abs(result.e.hovorka.cgmValue - options.targetCGM) < 0.01,
        JSON.stringify({ options, actual: result.e.hovorka.cgmValue }));
    preparedCache.set(key, result);
    return result;
}
function clone(e) {
    const copy = create();
    copy.importState(e.exportState());
    return copy;
}
function pair({ duration = 23, intensity = 'Medium', type = 'cardio',
    targetCGM = 11.7, iobPerKg = 0.01, age = 120, dt = 0.125, flat = false } = {}) {
    const p = matchedStart({ targetCGM, iobPerKg, age, dt, flat });
    if (p.excluded) return p;
    const activity = clone(p.e), rest = clone(p.e);
    assert.deepEqual(sample(activity), sample(rest));
    const before = sample(activity);
    assert(activity.startActivity({ type, intensity, durationMin: duration }));
    assert.equal(activity.trueBG, before.bg, 'Ingen øjeblikkelig BG-ændring ved start');
    const stop = duration + 20;
    const trace = [{ minute: 0, activity: before, rest: sample(rest) }];
    let stoppedAt = null, minBG = before.bg;
    for (let k = 1; k <= stop / dt; k++) {
        const wasActive = !!activity.activeAktivitet;
        activity.step(dt); rest.step(dt);
        const t = k * dt;
        if (wasActive && !activity.activeAktivitet) stoppedAt = t;
        for (const e of [activity, rest]) {
            assert([...e.hovorka.state].every(Number.isFinite));
            assert(e.hovorka.state[S.Q1] >= 0 && e.hovorka.state[S.Q2] >= 0);
            e.consumeEvents();
        }
        minBG = Math.min(minBG, activity.trueBG);
        if (Number.isInteger(t)) trace.push({ minute: t, activity: sample(activity), rest: sample(rest) });
    }
    assert.equal(stoppedAt, duration, 'Aktiviteten skal stoppe ved den aftalte grænse');
    const at = minute => trace.find(row => row.minute === minute);
    const last = at(stop), atStop = at(duration);
    // Kontinuert, støjfrit interstitielt signal er hovedmålet. Den samplede
    // CGM følger med som kontrol; en gammel sample må ikke kaldes et nyt mål.
    const prev = p.history.find(row => row.t === -15);
    const fiveMinuteHistory = p.history.filter(row => row.t % 5 === 0);
    const mean = fiveMinuteHistory.reduce((s, row) => s + row.sensor, 0) / fiveMinuteHistory.length;
    const cv = 100 * Math.sqrt(fiveMinuteHistory.reduce((s, row) => s + (row.sensor - mean) ** 2, 0) / fiveMinuteHistory.length) / mean;
    return { duration, intensity, type, age, dt, targetCGM, iobPerKg, flat,
        mealCarbs: round(p.mealCarbs),
        dose: round(p.units), initialSteadyBG: round(p.initialBG),
        startBG: round(before.bg), startCGM: round(before.sensor),
        nativeIOB: round(before.iob), studyIOB: round(iobPerKg * profile.weight),
        plasmaInsulin: round(before.plasmaInsulin),
        startSlope: round((before.sensor - prev.sensor) / 15), cvBefore: round(cv),
        endpoint: stop, activityCGMChange: round(last.activity.sensor - before.sensor),
        restCGMChange: round(last.rest.sensor - before.sensor),
        extraCGM: round(last.activity.sensor - last.rest.sensor),
        extraAtStop: round(atStop.activity.sensor - atStop.rest.sensor),
        extraBG: round(last.activity.bg - last.rest.bg),
        extraDisplayedCGM: round(last.activity.displayed - last.rest.displayed),
        sampleAge: round(activity.totalSimMinutes - activity.lastCgmCalculationTime),
        minBG: round(minBG), trace };
}
const rows = [];
for (const duration of [10, 15, 20, 23, 30]) {
    for (const intensity of ['Lav', 'Medium', 'Høj']) rows.push(pair({ duration, intensity }));
}
const context = [];
for (const targetCGM of [10.7, 11.7, 13.1]) {
    for (const iobPerKg of [0, 0.01, 0.03]) {
        for (const age of [60, 120, 180]) context.push(pair({ targetCGM, iobPerKg, age }));
    }
}
const types = ['cardio', 'blandet', 'styrke'].map(type => pair({ type }));
const convergence = [1, 0.25, 0.125].map(dt => pair({ dt }));
const flat = ['Lav', 'Medium', 'Høj'].map(intensity => pair({ intensity, flat: true }));
const flatConvergence = [0.25, 0.125].map(dt => pair({ dt, flat: true }));
assert(Math.abs(flatConvergence[0].extraCGM - flatConvergence[1].extraCGM) < 0.03);
assert(Math.abs(convergence[1].extraCGM - convergence[2].extraCGM) < 0.03,
    'Motionsforskellen skal være numerisk stabil ved finere tidsstep');
const compact = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'trace'));
if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ source: '10.1111/dme.70146',
        status: 'STUDY-INFORMED SENSITIVITY TEST, NOT COHORT REPLICATION',
        engineHashes: Object.fromEntries(['hovorka.js', 'physiology-engine.js'].map(file =>
            [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../js', file))).digest('hex')])),
        profile, rows, context, types, convergence, flat, flatConvergence }, null, 2));
} else {
    const concise = row => row.excluded ? row : Object.fromEntries(
        ['duration', 'intensity', 'type', 'age', 'dt', 'targetCGM', 'iobPerKg', 'startSlope',
            'activityCGMChange', 'restCGMChange', 'extraCGM'].map(key => [key, row[key]]));
    console.log('Varighed/intensitet:'); console.table(rows.map(concise));
    console.log('Start-BG, studie-IOB og bolusalder:'); console.table(context.map(concise));
    console.log('Typer:'); console.table(types.map(concise));
    console.log('Numerik:'); console.table(convergence.map(concise));
    console.log('Fladt start-CGM:'); console.log(JSON.stringify(flat.map(compact), null, 2));
    console.log('Flad numerik:'); console.table(flatConvergence.map(concise));
    console.log('Tekniske assertions bestået. Ingen automatisk fysiologisk PASS-grænse.');
}
