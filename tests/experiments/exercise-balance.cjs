// Afgrænset modelforsøg for review F01. Ændrer IKKE appens HovorkaModel eller
// prototype globalt. Kun udtrykkeligt oprettede forsøgsinstanser får andre Q1/Q2-
// ligninger; øvrige insulin-, hormon- og glykogenprocesser er uændrede.
//
// Kandidater:
//   current: før-revisionens ligninger (inkl. den kendte Q2-clamp-fejl).
//   capped-q2: samme forespurgte sinks, men begrænset til kildens disponible masse.
//   direct-q1: kontraktionsoptag som særskilt nettoflux fra tilgængelig glukose.
// Den sidste kandidats G/5,5 er en mass-action-hypotese, ikke en målt GLUT4-Km.
// Romeres 2021, ligninger 4/11, motiverer strukturen, ikke den bevarede beta-værdi.
//
// Kør: tests/.bin/node.exe tests/experiments/exercise-balance.cjs
// --json giver komplette resultater; --activity <candidate> genbruger den
// eksisterende aktivitetsvalidering i en separat proces uden at ændre dens targets.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createEngine } = require('../../js/physiology-engine.js');
const { HovorkaModel, HOVORKA_STATE_IDX: S } = require('../../js/hovorka.js');

const CANDIDATES = ['current', 'capped-q2', 'direct-q1'];
const REFERENCE_BG = 5.5; // Normalisering [mmol/L], valgt før forsøgene.
const G_PER_MMOL = 0.18016;

function attachCandidate(h, candidate) {
    assert.ok(CANDIDATES.includes(candidate), 'Ukendt forsøgsmodel');
    const originalStep = h.step.bind(h);
    h.step = dt => {
        const q1 = h.state[S.Q1], q2 = h.state[S.Q2];
        const transport = h.state[S.x1] * q1;
        const returning = h.k_12 * q2;
        const disposal = h.state[S.x2] * q2;
        const directDemand = h.beta * h.state[S.E1];
        const glucose = q1 / h.V_G;
        let f01 = h.F_01 / 0.85 * glucose / (glucose + 1);
        let renal = glucose >= h.R_thr ? h.R_cl * (glucose - h.R_thr) * h.V_G : 0;
        originalStep(dt);
        // UG/EGP er uændrede. F01/FR ovenfor er de forespurgte rater før
        // kildebegrænsning; produktionsmodellens realiserede rater må ikke
        // lække ind i rekonstruktionen af de historiske kandidater.
        let forward = transport, backward = returning, insulinDisposal = disposal;
        let contraction = directDemand;
        if (candidate !== 'current') {
            contraction *= candidate === 'direct-q1' ? q1 / h.V_G / REFERENCE_BG : 1;
            // Euler med kildebegrænsning: alle samtidige udløb fra samme pool
            // skaleres ens. Indløb bliver disponible næste deltrin. Dermed kan
            // gensidig Q1/Q2-udveksling ikke låne samme masse to gange.
            const plasmaOut = f01 + renal + forward + (candidate === 'direct-q1' ? contraction : 0);
            const peripheralOut = backward + insulinDisposal + (candidate === 'capped-q2' ? contraction : 0);
            const plasmaScale = plasmaOut > 0 ? Math.min(1, q1 / (dt * plasmaOut)) : 1;
            const peripheralScale = peripheralOut > 0 ? Math.min(1, q2 / (dt * peripheralOut)) : 1;
            f01 *= plasmaScale; renal *= plasmaScale; forward *= plasmaScale;
            backward *= peripheralScale; insulinDisposal *= peripheralScale;
            contraction *= candidate === 'direct-q1' ? plasmaScale : peripheralScale;
        }
        h.state[S.Q1] = Math.max(0, q1 + dt * (h._lastUG + h._lastEGP - f01 - renal - forward + backward - (candidate === 'direct-q1' ? contraction : 0)));
        h.state[S.Q2] = Math.max(0, q2 + dt * (forward - backward - insulinDisposal - (candidate !== 'direct-q1' ? contraction : 0)));
        // Forklaringspanelets ledger skal følge den valgte forsøgskandidat.
        h._lastF01c = f01; h._lastFR = renal;
        h._lastTransport = forward; h._lastReturn = backward;
        h._lastDisposal = insulinDisposal;
        h._lastContraction = candidate === 'direct-q1' ? contraction : 0;
        const expectedChange = dt * (h._lastUG + h._lastEGP - f01 - renal - insulinDisposal - contraction);
        h.experimentFlux = {
            transport: forward, returning: backward, insulinDisposal,
            contraction, f01, renal, expectedChange,
            residual: h.state[S.Q1] + h.state[S.Q2] - q1 - q2 - expectedChange
        };
    };
    return h;
}

function engine(candidate, insulinFree = false) {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20261004, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0,
            sleepDisruption: 0, cgmSensorFaults: false, stressResponse: 0,
            glucotoxicity: 0, ketones: 0 }
    });
    e.totalSimMinutes = e.timeInMinutes = 840;
    e.initSteadyState();
    if (insulinFree) {
        e.activeLongInsulin = [];
        for (const k of [S.S1b, S.S2b, S.Ib, S.I, S.x1, S.x2, S.x3]) e.hovorka.state[k] = 0;
    }
    attachCandidate(e.hovorka, candidate);
    return e;
}

function exerciseCase(candidate, dt, insulinFree) {
    const e = engine(candidate, insulinFree);
    let residual = 0, contraction = 0, minQ1 = Infinity, minQ2 = Infinity;
    const samples = [];
    e.startActivity({ type: 'cardio', intensity: 'Høj', durationMin: 60 });
    for (let tick = 1; tick <= Math.round(120 / dt); tick++) {
        e.step(dt); e.consumeEvents();
        const flux = e.hovorka.experimentFlux;
        residual += flux.residual;
        contraction += flux.contraction * dt;
        minQ1 = Math.min(minQ1, e.hovorka.state[S.Q1]);
        minQ2 = Math.min(minQ2, e.hovorka.state[S.Q2]);
        if ([30, 60, 90, 120].some(t => Math.abs(tick * dt - t) < 1e-8)) {
            samples.push({ minute: tick * dt, bg: e.trueBG, contractionG: contraction * G_PER_MMOL });
        }
    }
    return { candidate, dt, insulinFree, residualG: residual * G_PER_MMOL,
        minQ1, minQ2, contractionG: contraction * G_PER_MMOL, samples };
}

function verifyInvariants() {
    let cases = 0;
    for (const candidate of CANDIDATES.slice(1)) for (const dt of [1, 0.5, 0.1]) {
        // Testen kræver ingen insulin, intet Q2-lager og positiv Q1. Et rent
        // Q2-loft skal netop afsløres som utilstrækkeligt til insulin-uafhængigt optag.
        const h = attachCandidate(new HovorkaModel(70), candidate);
        h.state[S.Q1] = REFERENCE_BG * h.V_G; h.state[S.E1] = 1;
        h.step(dt);
        assert.ok(Math.abs(h.experimentFlux.residual) < 1e-10);
        if (candidate === 'direct-q1') assert.ok(h.experimentFlux.contraction > 0);
        else assert.equal(h.experimentFlux.contraction, 0);
        for (const bg of [0, 0.001, 1, 5.5, 20]) {
            // Kraftige action states fremprovokerer overtræk, ikke en klinisk profil.
            h.state[S.Q1] = bg * h.V_G; h.state[S.Q2] = 0.001;
            h.state[S.x1] = 10; h.state[S.x2] = 10; h.state[S.E1] = 10;
            h.step(dt);
            assert.ok(h.state[S.Q1] >= 0 && h.state[S.Q2] >= 0);
            assert.ok(Math.abs(h.experimentFlux.residual) < 1e-10);
            cases++;
        }
    }
    // Ablation: uden E1 er kandidaterne identiske i et ikke-begrænsende hviletrin.
    const states = CANDIDATES.map(candidate => {
        const h = new HovorkaModel(70); h.initializeSteadyState(10, 5.5);
        attachCandidate(h, candidate); h.step(0.5); return [...h.state];
    });
    for (const state of states.slice(1)) state.forEach((value, i) => assert.ok(Math.abs(value - states[0][i]) < 1e-10));
    return { extremePoolCases: cases, zeroInsulinCases: 6, restAblation: 'PASS' };
}

if (require.main === module) {
    if (process.argv.includes('--activity')) {
        const candidate = process.argv[process.argv.indexOf('--activity') + 1];
        assert.ok(CANDIDATES.includes(candidate));
        // Kun child-processens createEngine bindes til kandidaten. Den eksisterende
        // validering, dens kildetargets og produktionsfilerne forbliver urørte.
        const preload = `const {attachCandidate}=require('./tests/experiments/exercise-balance.cjs');const api=require('./js/physiology-engine.js');const original=api.createEngine;api.createEngine=(...args)=>{const e=original(...args);attachCandidate(e.hovorka,${JSON.stringify(candidate)});return e;};require('./tests/activity-validation.js');`;
        const run = spawnSync(process.execPath, ['-e', preload, '--', ...(process.argv.includes('--json') ? ['--json'] : [])], {
            cwd: path.resolve(__dirname, '../..'), stdio: 'inherit'
        });
        if (run.error) throw run.error;
        process.exitCode = run.status;
    } else {
        const checks = verifyInvariants();
        const results = CANDIDATES.flatMap(candidate => [false, true].flatMap(insulinFree =>
            [1, 0.5, 0.1].map(dt => exerciseCase(candidate, dt, insulinFree))));
        for (const result of results.filter(r => r.candidate !== 'current')) assert.ok(Math.abs(result.residualG) < 1e-8);
        const report = { status: 'EXPERIMENT_ONLY', referenceBg: REFERENCE_BG, checks, results };
        if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
        else {
            console.log(checks);
            console.table(results.map(r => ({ candidate: r.candidate, insulinFree: r.insulinFree, dt: r.dt,
                residualG: r.residualG, bg60: r.samples[1].bg, bg120: r.samples[3].bg, contractionG: r.contractionG })));
        }
    }
}
module.exports = { attachCandidate, verifyInvariants, exerciseCase };
