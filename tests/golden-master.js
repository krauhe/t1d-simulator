// =============================================================================
// GOLDEN-MASTER.JS — Karakteriserings-regression for den fysiologiske model
// =============================================================================
//
// Formål: fryse den EKSAKTE numeriske opførsel af den nuværende model på et
// fast sæt scenarier, så fremtidige refaktoreringer (udskillelse af engine,
// flytning af state, side-effects -> events) kan verificeres mod en kendt
// reference. Se planen: docs/reviews/2026-06-14_physiology-engine-api-plan.md.
//
// Hvorfor det virker: hvert scenarie kører Simulator med et FAST seed (via
// options.seed), så al tilfældighed (CGM-støj, sensor-spring, dawn-variation
// osv.) afspilles identisk. Samme profil + samme seed + samme input-sekvens
// => bit-identisk output.
//
// Brug:
//   node tests/golden-master.js generate     # skriv/overskriv fixturer
//   node tests/golden-master.js check         # sammenlign mod fixturer (CI/regression)
//   node tests/golden-master.js check --tol=1e-9   # tillad lille epsilon
//
// Tolerance-politik (fra planen):
//   - Ren kode-flytning  -> kør 'check' UDEN --tol: kræver bit-identisk (Object.is).
//   - Bevidst model-ændring -> regenerér med 'generate' og notér ændringen i
//     arbejdsloggen (docs/reviews/physiology-engine-LOG.md). Brug --tol kun til
//     at undersøge størrelsen af en forventet afvigelse, ikke som permanent slæk.
//
// Exit-kode: 0 hvis alle scenarier matcher, ellers 1 (så CI fejler).
// =============================================================================

const fs = require('fs');
const path = require('path');
const { Simulator, resetGraphArrays, setSimulatorBG } = require('./harness.js');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'golden-master');

// Metrikker der fryses pr. sample-punkt. Holdes bevidst kort og fysiologisk
// betydningsfuldt — de fanger kerne-tilstanden uden UI-/graf-detaljer.
const METRICS = ['trueBG', 'cgmBG', 'iob', 'cob', 'ketoneLevel', 'weightChangeKg'];

// -----------------------------------------------------------------------------
// SCENARIER
// -----------------------------------------------------------------------------
// Hvert scenarie er en deterministisk opskrift:
//   name           unikt navn (= fixtur-filnavn)
//   seed           fast RNG-seed
//   profile        patient-profil { weight, isf, icr }
//   mode           spiltilstand ('sandbox' osv.)
//   setup(sim)     valgfri: sæt start-BG, starttid, fjern basal m.m.
//   events         [{ atMin, fn(sim) }] handlinger ved forløbet sim-minut
//   durationMin    forløb i sim-minutter
//   sampleEveryMin hvor ofte metrikker registreres
//
// atMin og sample-tider er FORLØBNE sim-minutter siden scenarie-start (0-baseret),
// ikke sim.totalSimMinutes — det gør opskriften uafhængig af valgt starttid.
// -----------------------------------------------------------------------------
const SCENARIOS = [
    {
        // Basal steady state over et helt døgn, inkl. dawn-effekt ved ~07:00.
        name: 'basal-24h',
        seed: 1001,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => { /* default-konstruktør: starter ved midnat med basal */ },
        events: [],
        durationMin: 1440,
        sampleEveryMin: 15
    },
    {
        // Ren bolusrespons fra forhøjet BG (dawn undgået ved start kl. 14).
        name: 'bolus-2u',
        seed: 1002,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60;
            setSimulatorBG(sim, 15.0);
        },
        events: [ { atMin: 0, fn: (sim) => sim.addFastInsulin(2) } ],
        durationMin: 300,
        sampleEveryMin: 5
    },
    {
        // Blandet måltid med fedt og protein (forsinket optag, pizza-effekt).
        name: 'meal-fat-protein',
        seed: 1003,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60;
            setSimulatorBG(sim, 7.0);
        },
        events: [ { atMin: 0, fn: (sim) => sim.addFood(60, 20, 30) } ],
        durationMin: 360,
        sampleEveryMin: 10
    },
    {
        // Aerob motion: insulin-uafhængigt muskeloptag + efterfølgende følsomhed.
        name: 'exercise-cardio',
        seed: 1004,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60;
            setSimulatorBG(sim, 9.0);
        },
        events: [ { atMin: 30, fn: (sim) => sim.startMotion('Medium', 30) } ],
        durationMin: 240,
        sampleEveryMin: 5
    },
    {
        // Nat + søvn + morgen-dawn: start kl. 22, kør 10 timer ind i formiddagen.
        name: 'sleep-dawn',
        seed: 1005,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 22 * 60; sim.timeInMinutes = 22 * 60;
            setSimulatorBG(sim, 6.0);
        },
        events: [],
        durationMin: 600,
        sampleEveryMin: 15
    },
    {
        // Insulinmangel ved høj BG: basal fjernet -> ketoner/DKA bygger op.
        name: 'ketones-dka',
        seed: 1006,
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
        // Isoleret CGM-støj/drift ved stabilt BG: sampler hvert minut, så den
        // seedede støj-sekvens (gaussRand/Box-Muller + drift + spring) fryses.
        name: 'cgm-noise',
        seed: 1007,
        profile: { weight: 70, isf: 3.0, icr: 10 },
        mode: 'sandbox',
        setup: (sim) => {
            sim.totalSimMinutes = 14 * 60; sim.timeInMinutes = 14 * 60;
            setSimulatorBG(sim, 8.0);
        },
        events: [],
        durationMin: 180,
        sampleEveryMin: 1
    }
];

// -----------------------------------------------------------------------------
// Kør ét scenarie og returnér { samples: [{ t, ...metrics }] }.
// -----------------------------------------------------------------------------
function runScenario(scn) {
    resetGraphArrays();
    const sim = new Simulator(scn.profile || {}, scn.mode || 'sandbox', { seed: scn.seed });
    if (scn.setup) scn.setup(sim);

    const events = (scn.events || []).slice().sort((a, b) => a.atMin - b.atMin);
    let evIdx = 0;
    const samples = [];

    for (let minute = 0; minute <= scn.durationMin; minute++) {
        // Affyr eventuelle events planlagt til dette forløbne minut (før step).
        while (evIdx < events.length && events[evIdx].atMin === minute) {
            events[evIdx].fn(sim);
            evIdx++;
        }
        // Registrér metrikker på sample-punkter.
        if (minute % scn.sampleEveryMin === 0) {
            const row = { t: minute };
            for (const m of METRICS) row[m] = sim[m];
            samples.push(row);
        }
        // Avancér 1 sim-minut (undtagen efter sidste sample).
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
        metrics: METRICS,
        samples
    };
}

function fixturePath(name) {
    return path.join(FIXTURE_DIR, `${name}.json`);
}

// -----------------------------------------------------------------------------
// GENERATE: kør alle scenarier og skriv fixturer.
// -----------------------------------------------------------------------------
function generate() {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    for (const scn of SCENARIOS) {
        const result = runScenario(scn);
        fs.writeFileSync(fixturePath(scn.name), JSON.stringify(result, null, 2) + '\n', 'utf8');
        console.log(`  SKREVET: ${scn.name}  (${result.samples.length} samples)`);
    }
    console.log(`\n${SCENARIOS.length} fixturer genereret i ${path.relative(process.cwd(), FIXTURE_DIR)}`);
}

// Sammenlign forventet vs. faktisk; returnér liste af afvigelser.
function diffRuns(expected, actual, tol) {
    const diffs = [];
    const n = Math.min(expected.samples.length, actual.samples.length);
    if (expected.samples.length !== actual.samples.length) {
        diffs.push({ t: '-', metric: 'sample-count', expected: expected.samples.length, actual: actual.samples.length });
    }
    for (let i = 0; i < n; i++) {
        const e = expected.samples[i], a = actual.samples[i];
        for (const m of expected.metrics) {
            const ev = e[m], av = a[m];
            const equal = tol > 0 ? (Math.abs(ev - av) <= tol) : Object.is(ev, av);
            if (!equal) diffs.push({ t: e.t, metric: m, expected: ev, actual: av, delta: av - ev });
        }
    }
    return diffs;
}

// -----------------------------------------------------------------------------
// CHECK: kør alle scenarier og sammenlign mod fixturer.
// -----------------------------------------------------------------------------
function check(tol) {
    let failed = 0;
    for (const scn of SCENARIOS) {
        const fp = fixturePath(scn.name);
        if (!fs.existsSync(fp)) {
            console.log(`  MANGLER: ${scn.name} — kør 'generate' først`);
            failed++;
            continue;
        }
        const expected = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const actual = runScenario(scn);
        const diffs = diffRuns(expected, actual, tol);
        if (diffs.length === 0) {
            console.log(`  OK:   ${scn.name}`);
        } else {
            failed++;
            console.log(`  FEJL: ${scn.name} — ${diffs.length} afvigelser:`);
            for (const d of diffs.slice(0, 8)) {
                console.log(`        t=${d.t} ${d.metric}: forventet ${d.expected}, fik ${d.actual}` +
                            (d.delta !== undefined ? ` (delta ${d.delta})` : ''));
            }
            if (diffs.length > 8) console.log(`        ... og ${diffs.length - 8} flere`);
        }
    }
    console.log('');
    const tolNote = tol > 0 ? ` (tolerance ${tol})` : ' (bit-identisk)';
    if (failed === 0) {
        console.log(`Resultat: ${SCENARIOS.length}/${SCENARIOS.length} scenarier matcher${tolNote}.`);
    } else {
        console.log(`Resultat: ${SCENARIOS.length - failed}/${SCENARIOS.length} matcher — ${failed} fejlede${tolNote}.`);
    }
    return failed === 0;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function main() {
    const mode = process.argv[2];
    const tolArg = process.argv.find(a => a.startsWith('--tol='));
    const tol = tolArg ? parseFloat(tolArg.split('=')[1]) : 0;

    if (mode === 'generate') {
        generate();
    } else if (mode === 'check') {
        const ok = check(tol);
        process.exit(ok ? 0 : 1);
    } else {
        console.log('Brug: node tests/golden-master.js <generate|check> [--tol=<epsilon>]');
        process.exit(2);
    }
}

main();
