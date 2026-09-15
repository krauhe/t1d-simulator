// Diagnostisk review af korte aktiviteter og aktiv insulin, 2026-09-06.
// Ændrer ingen produktionsparametre. Ablationer gælder kun denne proces.
// Kør: tests/.bin/node.exe tests/exercise-short-bout-review.cjs
// Output er målinger, ikke litteraturkalibrerede acceptgrænser.
const assert = require('node:assert/strict');
const { createEngine } = require('../js/physiology-engine.js');
const { HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');

function run({ duration = 0, bolus = null, intensity = 'Høj', type = 'cardio',
    dt = 0.125, ablation = '', clamp = false, startMinute = -90 } = {}) {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20260906, noiseEnabled: false,
        modules: { dawn: false, dawnVariability: false, insulinVariability: false,
            sleepDisruption: false, cgmSensorFaults: false }
    });
    e.initSteadyState({ targetBG: 10 });
    // Samme basale plasma-insulin fastholdes i begge arme. Dermed kan hverken
    // hurtigere basal- eller bolusoptagelse forklare en forskel i clamp-parret.
    if (clamp) e.setPlasmaInsulinClamp(e.hovorka.state[S.I]);
    if (ablation === 'noContraction') e.hovorka.beta = 0;
    if (ablation === 'noSensitivity') {
        const original = e.hovorka.setInsulinModifiers.bind(e.hovorka);
        e.hovorka.setInsulinModifiers = (amplitude) => original(amplitude, 1);
    }
    if (ablation === 'noAbsorptionAcceleration') {
        // Puls bruges stadig til muskelarbejde og øvrig fysiologi. Kun de to
        // absorptionsberegninger ser hvilepuls i denne mekanisme-ablation.
        for (const [owner, key] of [[e, '_substepRapidInsulin'], [e.hovorka, 'step']]) {
            const original = owner[key].bind(owner);
            owner[key] = (...args) => {
                const hr = e.hovorka.heartRate;
                e.hovorka.heartRate = e.hovorka.HR_base;
                try { return original(...args); }
                finally { e.hovorka.heartRate = hr; }
            };
        }
    }
    const samples = {};
    let directMmol = 0, minQ2 = Infinity, largestEventJump = 0, stopAt = null;
    for (let k = 0; k <= Math.round((120 - startMinute) / dt); k++) {
        const t = Math.round((startMinute + k * dt) * 1e6) / 1e6;
        const before = e.trueBG;
        if (bolus !== null && t === bolus) e.addRapidInsulin({ units: 1 });
        if (t === 0 && duration) e.startActivity({ type, intensity, durationMin: duration });
        largestEventJump = Math.max(largestEventJump, Math.abs(e.trueBG - before));
        if (Number.isInteger(t)) samples[t] = {
            bg: e.trueBG, cgm: e.cgmBG, interstitial: e.hovorka.cgmValue,
            cgmSampleAgeMin: e.totalSimMinutes - e.lastCgmCalculationTime,
            insulin: e.hovorka.state[S.I], iob: e.iob,
            isf: e.currentISF, peis: e._lastPeisFactor,
            e1: e.hovorka.state[S.E1], x1: e.hovorka.state[S.x1],
            active: !!e.activeAktivitet
        };
        minQ2 = Math.min(minQ2, e.hovorka.state[S.Q2]);
        if (t >= 0) directMmol += e.hovorka.beta * e.hovorka.state[S.E1] * dt;
        assert(Number.isFinite(e.trueBG), 'Ikke-endeligt blodsukker');
        if (t < 120) {
            const wasActive = !!e.activeAktivitet;
            e.step(dt);
            if (wasActive && !e.activeAktivitet) stopAt = round(t + dt);
        }
        e.consumeEvents();
    }
    assert.equal(largestEventJump, 0, 'Hændelser må ikke flytte BG øjeblikkeligt');
    // Registrér grænseafrunding i stedet for at skjule den: flydende tid kan
    // medføre ét ekstra dt før automatisk stop. Tillad højst dette ene trin.
    if (duration) assert(stopAt >= duration - 1e-6 && stopAt <= duration + dt + 1e-6);
    return { samples, directMmol, minQ2, stopAt };
}

const round = x => +x.toFixed(5);
function delta(row, control) {
    return Object.fromEntries([3, 15, 30, 60, 120].map(t =>
        [t, round(row.samples[t].bg - control.samples[t].bg)]));
}
const output = { protocol: 'Erik; BG 10 steady state at -90; 1 U if specified; exercise at 0; no meals; high cardio unless stated; differences vs matched rest', timing: [], ablations: [], convergence: [], types: [] };
for (const bolus of [null, -60, -30, 0, 30]) {
    const rest = run({ bolus });
    const exercise = run({ bolus, duration: 3 });
    output.timing.push({ bolus, bgAtStart: round(rest.samples[0].bg),
        iobAtStart: round(rest.samples[0].iob), deltaBG: delta(exercise, rest),
        bgAt3: round(exercise.samples[3].bg), peisAt3: round(exercise.samples[3].peis),
        directGrams: round(exercise.directMmol * 0.18016), minQ2: round(exercise.minQ2) });
}
for (const ablation of ['', 'noContraction', 'noSensitivity', 'noAbsorptionAcceleration']) {
    output.ablations.push({ ablation: ablation || 'full',
        deltaBG: delta(run({ bolus: -30, duration: 3, ablation }), run({ bolus: -30, ablation })) });
}
output.fixedBasalPlasmaInsulin = delta(run({ duration: 3, clamp: true }), run({ clamp: true }));
// Fire arme skelner mellem to samtidige virkninger og en egentlig interaktion.
// Negativt tal betyder større ekstra motionsfald med bolus end uden bolus.
output.interaction = {};
for (const ablation of ['', 'noAbsorptionAcceleration']) {
    const bolusEffect = delta(run({ duration: 3, bolus: -30, ablation }), run({ bolus: -30, ablation }));
    const basalEffect = delta(run({ duration: 3, ablation }), run({ ablation }));
    output.interaction[ablation || 'full'] = Object.fromEntries(
        Object.keys(bolusEffect).map(t => [t, round(bolusEffect[t] - basalEffect[t])])
    );
}
const restingControl = run();
output.restingControlDrift = round(restingControl.samples[120].bg - restingControl.samples[-90].bg);
for (const duration of [3, 15, 60]) {
    for (const dt of [1, 0.25, 0.125, 0.1]) {
        const exercise = run({ duration, dt, bolus: -30 });
        output.convergence.push({ duration, dt, stopAt: exercise.stopAt,
            deltaBG: delta(exercise, run({ dt, bolus: -30 })) });
    }
}
for (const type of ['cardio', 'styrke', 'blandet']) {
    for (const intensity of ['Lav', 'Medium', 'Høj']) {
        output.types.push({ type, intensity,
            deltaBG: delta(run({ type, intensity, duration: 3, bolus: -30 }), run({ bolus: -30 })) });
    }
}
// Brugerens præcisering: kort motion sent i bolusforløbet, når BG-faldet
// er aftaget. Alle disse par starter ved -330 min; ingen BG-reset ved motion.
// Hældningen før motion dokumenterer, om BG faktisk er ved at flade ud.
output.lateBolus = [];
for (const bolus of [-60, -120, -180, -240, -300]) {
    const rest = run({ bolus, startMinute: -330 });
    for (const duration of [3, 4]) {
        const exercise = run({ bolus, duration, startMinute: -330 });
        output.lateBolus.push({ bolus, duration,
            bgAtStart: round(rest.samples[0].bg), iobAtStart: round(rest.samples[0].iob),
            plasmaInsulinAtStart: round(rest.samples[0].insulin),
            bgChangeBefore10Min: round(rest.samples[0].bg - rest.samples[-10].bg),
            extraDropAt15: round(exercise.samples[15].bg - rest.samples[15].bg),
            totalChangeAt15: round(exercise.samples[15].bg - exercise.samples[0].bg),
            cgmChangeBefore10Min: round(rest.samples[0].cgm - rest.samples[-10].cgm),
            extraCgmChangeAt15: round(exercise.samples[15].cgm - rest.samples[15].cgm),
            totalCgmChangeAt15: round(exercise.samples[15].cgm - exercise.samples[0].cgm),
            extraInterstitialChangeAt15: round(exercise.samples[15].interstitial - rest.samples[15].interstitial),
            cgmSampleAgeAt15: exercise.samples[15].cgmSampleAgeMin
        });
    }
}
console.log(JSON.stringify(output, null, 2));
