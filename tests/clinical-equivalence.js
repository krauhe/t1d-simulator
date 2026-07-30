// =============================================================================
// CLINICAL-EQUIVALENCE.JS — Reference-regression for fysiologi-modellen
// =============================================================================
//
// Formål: et KOMPLEMENTÆRT sikkerhedsnet til golden-master.js. Hvor golden-master
// kræver BIT-IDENTISK output (Object.is, tolerance 0), fryser dette værktøj den
// nuværende models opførsel og sammenligner senere kørsler med faste regressionstolerancer.
//
// Hvorfor begge: nogle arkitektur-ændringer (S9: engine ejer Hovorka + selvbærende
// steady-state, fysiologiske events, ergonomi) er rene flytninger og BØR forblive
// bit-identiske — dem fanger golden-master. Men hvis en ændring uundgåeligt bryder
// bit-identitet, er det stadig afgørende at opdage ændringer i modellens numeriske adfærd.
// Det er denne fils opgave: kontrollere "reference-ens" når "bit-ens" ikke kan garanteres.
//
// Tolerancerne er udviklingsgrænser, der gør testen følsom over for små numeriske
// ændringer. De dokumenterer ikke klinisk ækvivalens eller ydeevne.
//
// Brug:
//   tests/.bin/node.exe tests/clinical-equivalence.js generate   # frys baseline
//   tests/.bin/node.exe tests/clinical-equivalence.js check       # sammenlign mod baseline
//
// Baseline gemmes i tests/fixtures/clinical-baseline.json (alle scenarier i én fil).
//
// NB (S9.5): en standalone-runner (bar engine uden Simulator-facade) slottes ind
// senere, så det SAMME batteri kan køres direkte på PhysiologyEngine og sammenlignes
// mod facade-tracen — kontrollen af at motoren alene reproducerer spillets modeladfærd.
// =============================================================================

const fs = require('fs');
const path = require('path');
const { Simulator, resetGraphArrays, setSimulatorBG } = require('./harness.js');

const BASELINE_PATH = path.join(__dirname, 'fixtures', 'clinical-baseline.json');

// -----------------------------------------------------------------------------
// Per-sample-metrikker der registreres ved hvert sample-punkt. cgmBG er her det
// deterministiske, interstitielle signal med fysiologisk forsinkelse; stokastisk
// sensorstøj og sensorfejl testes særskilt i physiology-engine-api.test.js.
// -----------------------------------------------------------------------------
const PER_SAMPLE = ['trueBG', 'cgmBG', 'iob', 'cob', 'ketoneLevel', 'acidosisLoad', 'brainEnergyDeficit'];

// -----------------------------------------------------------------------------
// Regressionstolerancer.
//   abs = absolut tilladt afvigelse (fungerer som gulv for små værdier)
//   rel = relativ tilladt afvigelse af den forventede værdis størrelse
// En værdi består hvis |Δ| <= max(abs, rel·|forventet|). Tolerancerne er valgt så
// de fanger små ændringer i hver størrelse uden at kræve bit-identisk output.
// -----------------------------------------------------------------------------
const PER_SAMPLE_TOL = {
    trueBG:             { abs: 0.10 },              // mmol/L — under display-opløsning
    cgmBG:              { abs: 0.15 },              // mmol/L — CGM har lidt mere slæk
    iob:                { abs: 0.05, rel: 0.02 },   // enheder
    cob:                { abs: 1.0,  rel: 0.02 },   // gram
    ketoneLevel:        { abs: 0.05, rel: 0.02 },   // mmol/L BHB
    acidosisLoad:       { abs: 1.0,  rel: 0.02 },   // arbitrær syre-enhed
    brainEnergyDeficit: { abs: 0.10, rel: 0.02 },   // mmol
};

// Aggregerede scenarie-metrikker (afledt af per-sample trueBG).
const AGG_TOL = {
    meanTrueBG: { abs: 0.10 },   // mmol/L
    minTrueBG:  { abs: 0.20 },   // mmol/L
    maxTrueBG:  { abs: 0.20 },   // mmol/L
    tir:        { abs: 0.01 },   // fraktion (1 procentpoint) i 3.9-10 mmol/L
};

const TIR_LOW = 3.9, TIR_HIGH = 10.0;

// within — regressionstolerance for ét tal-par.
function within(expected, actual, spec) {
    if (typeof expected !== 'number' || typeof actual !== 'number') {
        return Object.is(expected, actual);
    }
    const d = Math.abs(actual - expected);
    const allow = Math.max(spec.abs || 0, (spec.rel || 0) * Math.abs(expected));
    return d <= allow + 1e-12;
}

// -----------------------------------------------------------------------------
// SCENARIE-BATTERI
// -----------------------------------------------------------------------------
// Superset af golden-master-scenarierne + hypo-fra-overbolus + glukagon-rescue,
// så batteriet dækker alle de fysiologiske veje planen nævner: faste, måltid+bolus,
// hypo, motion, søvn/dawn, DKA, fedt/protein og glukagon.
//
// Samme opskrift-format som golden-master: atMin/sample-tider er FORLØBNE sim-
// minutter siden scenarie-start (0-baseret), uafhængigt af valgt starttid.
// -----------------------------------------------------------------------------
const SCENARIOS = [
    {
        name: 'basal-24h',
        seed: 2001,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: () => {},
        events: [],
        durationMin: 1440,
        sampleEveryMin: 15
    },
    {
        name: 'bolus-2u',
        seed: 2002,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60; setSimulatorBG(sim, 15.0); },
        events: [ { atMin: 0, fn: (sim) => sim.addFastInsulin(2) } ],
        durationMin: 300,
        sampleEveryMin: 5
    },
    {
        name: 'meal-fat-protein',
        seed: 2003,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60; setSimulatorBG(sim, 7.0); },
        events: [ { atMin: 0, fn: (sim) => sim.addFood(60, 20, 30) } ],
        durationMin: 360,
        sampleEveryMin: 10
    },
    {
        name: 'exercise-cardio',
        seed: 2004,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60; setSimulatorBG(sim, 9.0); },
        events: [ { atMin: 30, fn: (sim) => sim.startMotion('Medium', 30) } ],
        durationMin: 240,
        sampleEveryMin: 5
    },
    {
        name: 'sleep-dawn',
        seed: 2005,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 22 * 60; sim.timeInMinutes = 22 * 60; setSimulatorBG(sim, 6.0); },
        events: [],
        durationMin: 600,
        sampleEveryMin: 15
    },
    {
        name: 'ketones-dka',
        seed: 2006,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 8 * 60; sim.timeInMinutes = 8 * 60;
            sim.activeLongInsulin = [];          // fjern basal -> insulinmangel
            sim.lastInsulinTime = sim.totalSimMinutes;
            setSimulatorBG(sim, 20.0);
            sim.hovorka.insulinRate = 0;
        },
        events: [],
        durationMin: 720,
        sampleEveryMin: 15
    },
    {
        // Hypo fra over-bolus: stor bolus fra moderat BG driver lavt, så
        // counterregulation/brain-deficit-dynamikken testes.
        name: 'hypo-overbolus',
        seed: 2007,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60; setSimulatorBG(sim, 8.0); },
        events: [ { atMin: 0, fn: (sim) => sim.addFastInsulin(3) } ],
        durationMin: 300,
        sampleEveryMin: 5
    },
    {
        // Glukagon-rescue: samme over-bolus, men glukagon-injektion når BG er lavt
        // (frigiver leverglykogen). Tester glukagon-vejen + leverglykogen-pulje.
        name: 'glucagon-rescue',
        seed: 2008,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60; setSimulatorBG(sim, 8.0); },
        events: [
            { atMin: 0,   fn: (sim) => sim.addFastInsulin(3) },
            { atMin: 120, fn: (sim) => sim.useGlucagon() }
        ],
        durationMin: 300,
        sampleEveryMin: 5
    }
];

// -----------------------------------------------------------------------------
// Kør ét scenarie via Simulator-facaden og returnér samples + aggregater.
// -----------------------------------------------------------------------------
function runScenario(scn) {
    resetGraphArrays();
    const sim = new Simulator(scn.profile || {}, scn.mode || 'sandbox', { seed: scn.seed });

    // Den kliniske baseline beskytter modellens fysiologiske forløb. Tilfældig
    // sensorstøj og bane-10-fejltilstande har deres egne komponenttests og må
    // ikke forskyde denne baseline, blot fordi antallet af RNG-træk ændres.
    sim.engine.setNoise(false);
    if (sim.engine.modules.cgmSensorFaults) {
        throw new Error(`${scn.name}: fysiologibaseline kræver cgmSensorFaults=false`);
    }

    if (scn.setup) scn.setup(sim);

    const events = (scn.events || []).slice().sort((a, b) => a.atMin - b.atMin);
    let evIdx = 0;
    const samples = [];

    for (let minute = 0; minute <= scn.durationMin; minute++) {
        while (evIdx < events.length && events[evIdx].atMin === minute) {
            events[evIdx].fn(sim);
            evIdx++;
        }
        if (minute % scn.sampleEveryMin === 0) {
            const row = { t: minute };
            for (const m of PER_SAMPLE) row[m] = sim[m];
            samples.push(row);
        }
        if (minute < scn.durationMin) {
            sim.simulationSpeed = 60;
            sim.update(1.0);
        }
    }

    return {
        name: scn.name,
        seed: scn.seed,
        profile: scn.profile || {},
        mode: scn.mode || 'sandbox',
        durationMin: scn.durationMin,
        sampleEveryMin: scn.sampleEveryMin,
        sensorContract: 'deterministic-interstitial-no-faults',
        metrics: PER_SAMPLE,
        samples,
        aggregates: computeAggregates(samples)
    };
}

// computeAggregates — afled oversigtstal fra per-sample trueBG.
function computeAggregates(samples) {
    const bg = samples.map(s => s.trueBG).filter(v => typeof v === 'number');
    const n = bg.length || 1;
    const mean = bg.reduce((a, v) => a + v, 0) / n;
    const min = bg.reduce((a, v) => Math.min(a, v), Infinity);
    const max = bg.reduce((a, v) => Math.max(a, v), -Infinity);
    const inRange = bg.filter(v => v >= TIR_LOW && v <= TIR_HIGH).length / n;
    return { meanTrueBG: mean, minTrueBG: min, maxTrueBG: max, tir: inRange };
}

// -----------------------------------------------------------------------------
// Sammenlign forventet vs. faktisk med regressionstolerancer.
// Returnerer { fails: [...], maxDev: { metric: størst |Δ| } }.
// -----------------------------------------------------------------------------
function compareRuns(expected, actual) {
    const fails = [];
    const maxDev = {};
    const track = (metric, e, a) => {
        if (typeof e === 'number' && typeof a === 'number') {
            const d = Math.abs(a - e);
            if (!(metric in maxDev) || d > maxDev[metric]) maxDev[metric] = d;
        }
    };

    if (expected.samples.length !== actual.samples.length) {
        fails.push({ scenario: expected.name, t: '-', metric: 'sample-count', expected: expected.samples.length, actual: actual.samples.length });
    }
    const n = Math.min(expected.samples.length, actual.samples.length);
    for (let i = 0; i < n; i++) {
        const e = expected.samples[i], a = actual.samples[i];
        for (const m of PER_SAMPLE) {
            track(m, e[m], a[m]);
            if (!within(e[m], a[m], PER_SAMPLE_TOL[m])) {
                fails.push({ scenario: expected.name, t: e.t, metric: m, expected: e[m], actual: a[m], delta: a[m] - e[m] });
            }
        }
    }

    const ea = expected.aggregates || {}, aa = actual.aggregates || {};
    for (const m of Object.keys(AGG_TOL)) {
        track('agg.' + m, ea[m], aa[m]);
        if (!within(ea[m], aa[m], AGG_TOL[m])) {
            fails.push({ scenario: expected.name, t: 'agg', metric: m, expected: ea[m], actual: aa[m], delta: aa[m] - ea[m] });
        }
    }

    return { fails, maxDev };
}

// -----------------------------------------------------------------------------
// GENERATE: kør alle scenarier og frys baseline.
// -----------------------------------------------------------------------------
function generate() {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    const baseline = {
        version: 2,
        generatedAt: new Date().toISOString().slice(0, 10),
        sensorContract: 'deterministic-interstitial-no-faults',
        scenarios: {}
    };
    for (const scn of SCENARIOS) {
        const result = runScenario(scn);
        baseline.scenarios[scn.name] = result;
        const agg = result.aggregates;
        console.log(`  SKREVET: ${scn.name}  (${result.samples.length} samples, ` +
            `middel ${agg.meanTrueBG.toFixed(2)}, min ${agg.minTrueBG.toFixed(2)}, ` +
            `max ${agg.maxTrueBG.toFixed(2)}, TIR ${(agg.tir * 100).toFixed(0)}%)`);
    }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    console.log(`\n${SCENARIOS.length} scenarier frosset i ${path.relative(process.cwd(), BASELINE_PATH)}`);
}

// -----------------------------------------------------------------------------
// CHECK: kør alle scenarier og sammenlign mod baseline med regressionstolerancer.
// -----------------------------------------------------------------------------
function check() {
    if (!fs.existsSync(BASELINE_PATH)) {
        console.log(`MANGLER baseline (${path.relative(process.cwd(), BASELINE_PATH)}) — kør 'generate' først.`);
        return false;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    let failedScenarios = 0;

    for (const scn of SCENARIOS) {
        const expected = baseline.scenarios[scn.name];
        if (!expected) {
            console.log(`  MANGLER: ${scn.name} ikke i baseline — kør 'generate' igen`);
            failedScenarios++;
            continue;
        }
        const actual = runScenario(scn);
        const { fails, maxDev } = compareRuns(expected, actual);
        const devNote = `trueBG Δ≤${(maxDev.trueBG || 0).toFixed(3)}, agg.middel Δ≤${(maxDev['agg.meanTrueBG'] || 0).toFixed(3)}`;
        if (fails.length === 0) {
            console.log(`  OK:   ${scn.name}  (${devNote})`);
        } else {
            failedScenarios++;
            console.log(`  FEJL: ${scn.name} — ${fails.length} referenceafvigelser (${devNote}):`);
            for (const f of fails.slice(0, 8)) {
                console.log(`        t=${f.t} ${f.metric}: baseline ${fmt(f.expected)}, fik ${fmt(f.actual)}` +
                    (f.delta !== undefined ? ` (Δ ${fmt(f.delta)})` : ''));
            }
            if (fails.length > 8) console.log(`        ... og ${fails.length - 8} flere`);
        }
    }

    console.log('');
    if (failedScenarios === 0) {
        console.log(`Resultat: ${SCENARIOS.length}/${SCENARIOS.length} scenarier inden for regressionstolerancerne.`);
    } else {
        console.log(`Resultat: ${SCENARIOS.length - failedScenarios}/${SCENARIOS.length} scenarier inden for regressionstolerancerne — ${failedScenarios} fejlede.`);
    }
    return failedScenarios === 0;
}

function fmt(v) {
    return typeof v === 'number' ? v.toFixed(4) : String(v);
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function main() {
    const mode = process.argv[2];
    if (mode === 'generate') {
        generate();
    } else if (mode === 'check') {
        const ok = check();
        process.exit(ok ? 0 : 1);
    } else {
        console.log('Brug: node tests/clinical-equivalence.js <generate|check>');
        process.exit(2);
    }
}

main();
