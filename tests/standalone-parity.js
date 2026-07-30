// =============================================================================
// STANDALONE-PARITY.JS — Standalone-paritets-test for fysiologi-modellen (S9.5)
// =============================================================================
//
// Formål: bevise at den BARE PhysiologyEngine (createEngine + engine-native
// interventioner + engine.step(), UDEN Simulator-facaden) reproducerer spillets
// kliniske adfærd. Dette er det vigtigste bevis for at motoren er en GENEREL,
// standalone fysiologisk model og ikke en spil-skræddersyet kerne.
//
// Hvordan: det SAMME deterministiske scenarie-batteri køres ad to stier i samme
// proces — (1) via Simulator-facaden (spillets vej) og (2) via den bare engine —
// og de to traces sammenlignes punktvis med de SAMME kliniske tolerancer som
// tests/clinical-equivalence.js (|ΔtrueBG| <= 0.1 mmol/L, TIR +-1pp, IOB/COB +-2%
// osv.). Begge traces genereres friskt hver kørsel, så testen ikke afhænger af en
// frossen baseline — den måler direkte afstanden mellem de to stier.
//
// Brug:
//   tests/.bin/node.exe tests/standalone-parity.js
//   tests/.bin/node.exe tests/standalone-parity.js --verbose   # vis max-afvig pr. metrik
//
// VIGTIGT DESIGN — to confoundere skal neutraliseres, ellers maaler testen RNG-
// realisering i stedet for model-adfaerd:
//
// 1) BASAL-SETUP. Den bare engines default-initSteadyState bruger establishDepot:true
//    med et 3t gammelt depot — et ANDET basal-forloeb end facaden. Facaden kalder
//    initSteadyState({establishDepot:false}) og laver sin egen pre-injektion (16t alder,
//    circadian-justeret dosis). Engine-stien replikerer facadens basal-setup praecis.
//
// 2) RNG-RAEKKEFOELGE. Dawn-parametrene traekkes nu af ENGINE-KONSTRUKTOEREN selv
//    (regenerateDawn, S9.6), saa baade facade og bar engine faar dawn fra de samme
//    foerste rng-traek. Det ENESTE facade-konstruktoer-traek den bare engine ikke
//    laver er _boxSeed (1 traek, game-mekanik). Goer engine-stien ikke det, staar dens
//    RNG i en anden position -> bolus-tauFactor (gaussRand) afviger, selv om fysikken
//    er ens. Engine-stien replikerer derfor _boxSeed-traekket, saa den efterfoelgende
//    RNG-stroem flugter med facaden.
//
// STOEJ SLAAS FRA paa begge stier (setNoise(false)). Det fjerner (a) CGM-stoejens egen
// RNG-realisering og (b) facadens per-tik CGM-selvtest, hvis rng-traek (simulator.js
// ~linje 1691) kun udloeses ved store CGM-spring/diskontinuiteter — dem opstaar ikke
// uden stoej, saa den korte-slutter UDEN at traekke RNG. Tilbage staar ren, deterministisk
// fysik + insulin-PK, som de to stier deler 1:1.
//
// NB: efter S9.8 ejer ENGINE hele soevnforstyrrelses-mekanismen (accrual i de
// engine-native interventioner + applySleepDebt ved 07:00 i _processSleepCrossings),
// saa nat-interventioner traekker den SAMME RNG i begge stier. Scenariet
// 'night-sleep-disruption' tester netop nat-stien (en bolus kl. 03:00).
//
// Hvis standalone og facade IKKE kan bringes inden for klinisk tolerance: tolerancerne
// loesnes IKKE. Testen rapporterer de praecise afvigelser (per metrik, per scenarie),
// saa en afvigelse kan analyseres frem for skjules.
// =============================================================================

const path = require('path');
const {
    Simulator, CARB_TYPES, estimateEatTimeMin, resetGraphArrays, setSimulatorBG
} = require('./harness.js');
// createEngine eksporteres ikke fra harness' module.exports, men harness saetter
// global.createEngine. Vi henter den direkte fra engine-modulet (cached require).
const { createEngine } = require('../js/physiology-engine.js');

// -----------------------------------------------------------------------------
// Per-sample-metrikker + kliniske tolerancer — IDENTISKE med clinical-equivalence.js.
// (Bevidst kopieret, ikke importeret, saa det ene script kan aendres uden at
// braekke det andet; vaerdierne skal holdes i sync — se clinical-equivalence.js.)
// -----------------------------------------------------------------------------
// Begge stier bruger den samme offentlige setBG()-kontrakt, stokastisk sensorstøj
// er slået fra, og sandbox har ingen sensorfejl. Derfor er det deterministiske
// interstitielle cgmBG nu en del af paritets-gaten sammen med kernefysiologien.
const PARITY_METRICS = ['trueBG', 'cgmBG', 'iob', 'cob', 'ketoneLevel', 'acidosisLoad', 'brainEnergyDeficit'];
const PER_SAMPLE = ['trueBG', 'cgmBG', 'iob', 'cob', 'ketoneLevel', 'acidosisLoad', 'brainEnergyDeficit'];

const PER_SAMPLE_TOL = {
    trueBG:             { abs: 0.10 },
    cgmBG:              { abs: 0.15 },
    iob:                { abs: 0.05, rel: 0.02 },
    cob:                { abs: 1.0,  rel: 0.02 },
    ketoneLevel:        { abs: 0.05, rel: 0.02 },
    acidosisLoad:       { abs: 1.0,  rel: 0.02 },
    brainEnergyDeficit: { abs: 0.10, rel: 0.02 },
};

const AGG_TOL = {
    meanTrueBG: { abs: 0.10 },
    minTrueBG:  { abs: 0.20 },
    maxTrueBG:  { abs: 0.20 },
    tir:        { abs: 0.01 },
};

const TIR_LOW = 3.9, TIR_HIGH = 10.0;

function within(expected, actual, spec) {
    if (typeof expected !== 'number' || typeof actual !== 'number') {
        return Object.is(expected, actual);
    }
    const d = Math.abs(actual - expected);
    const allow = Math.max(spec.abs || 0, (spec.rel || 0) * Math.abs(expected));
    return d <= allow + 1e-12;
}

// -----------------------------------------------------------------------------
// SCENARIE-BATTERI (data-drevet)
// -----------------------------------------------------------------------------
// Samme batteri som clinical-equivalence.js, men beskrevet som REN DATA (typede
// events + setup-felter) saa det kan fortolkes af BEGGE stier (facade + engine).
// Hver intervention oversaettes til facade-metode hhv. engine-native objekt.
//
//   startClockMin  sim-minutter siden midnat ved scenarie-start (default 0).
//   startBG        eksplicit start-BG [mmol/L] (udelades -> steady-state 5.5).
//   removeBasal    fjern basal-depot + saet hovorka.insulinRate=0 (insulinmangel/DKA).
//   events         [{ atMin, kind, ... }] hvor kind ER intervention-typen.
// -----------------------------------------------------------------------------
const SCENARIOS = [
    {
        name: 'basal-24h', seed: 2001, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 0, events: [], durationMin: 1440, sampleEveryMin: 15
    },
    {
        name: 'bolus-2u', seed: 2002, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 15.0,
        events: [{ atMin: 0, kind: 'bolus', units: 2 }],
        durationMin: 300, sampleEveryMin: 5
    },
    {
        name: 'meal-fat-protein', seed: 2003, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 7.0,
        events: [{ atMin: 0, kind: 'food', carbs: 60, protein: 20, fat: 30 }],
        durationMin: 360, sampleEveryMin: 10
    },
    {
        name: 'exercise-cardio', seed: 2004, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 9.0,
        events: [{ atMin: 30, kind: 'motion', activity: 'cardio', intensity: 'Medium', durationMin: 30 }],
        durationMin: 240, sampleEveryMin: 5
    },
    {
        name: 'sleep-dawn', seed: 2005, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 22 * 60, startBG: 6.0,
        events: [], durationMin: 600, sampleEveryMin: 15
    },
    {
        name: 'ketones-dka', seed: 2006, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 8 * 60, startBG: 20.0, removeBasal: true,
        events: [], durationMin: 720, sampleEveryMin: 15
    },
    {
        name: 'hypo-overbolus', seed: 2007, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 8.0,
        events: [{ atMin: 0, kind: 'bolus', units: 3 }],
        durationMin: 300, sampleEveryMin: 5
    },
    {
        name: 'glucagon-rescue', seed: 2008, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 8.0,
        events: [
            { atMin: 0, kind: 'bolus', units: 3 },
            { atMin: 120, kind: 'glucagon' }
        ],
        durationMin: 300, sampleEveryMin: 5
    },
    {
        name: 'cgm-noise', seed: 2009, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 14 * 60, startBG: 8.0,
        events: [], durationMin: 180, sampleEveryMin: 1
    },
    {
        // Nat-intervention: en bolus kl. 03:00 udløser søvnforstyrrelse (S9.8). Kører
        // fra 02:00 gennem 07:00-morgen-krydsningen til ud på formiddagen, så søvngæld
        // -> _pendingChronicStress -> chronicStressLevel -> insulinresistens slår igennem
        // på BG. Beviser at den bare engine modellerer hele søvn-stien (accrual i
        // engine.addRapidInsulin + applySleepDebt ved 07:00 i _processSleepCrossings)
        // identisk med facaden — den sti standalone-paritet tidligere bevidst undgik.
        name: 'night-sleep-disruption', seed: 2010, profile: { weight: 70, isf: 3.0, icr: 10 },
        startClockMin: 2 * 60, startBG: 8.0,
        events: [{ atMin: 60, kind: 'bolus', units: 1 }],
        durationMin: 600, sampleEveryMin: 15
    }
];

// -----------------------------------------------------------------------------
// Facadens madvare-forbehandling, replikeret saa engine-stien faar IDENTISKE
// argumenter til engine.addFood som facadens addFood(carbs,protein,fat) ville give.
// (Facade: js/simulator.js addFood — foodWeight = sum af makroer, eatTime via
// estimateEatTimeMin, carbType 'mixed', icon-default.)
// -----------------------------------------------------------------------------
function resolveFoodArgs(ev) {
    const carbs = ev.carbs || 0, protein = ev.protein || 0, fat = ev.fat || 0;
    const foodWeight = carbs + protein + fat;
    let eatTime;
    if (typeof estimateEatTimeMin === 'function') {
        eatTime = estimateEatTimeMin({ weight: foodWeight, carbs, protein, fat, carbType: 'mixed' });
    } else {
        eatTime = Math.max(0.5, Math.min(10, foodWeight / 50));
    }
    eatTime = Math.max(0.1, eatTime);
    const carbParams = (typeof CARB_TYPES !== 'undefined')
        ? (CARB_TYPES.mixed || { simpleFraction: 0.20, fiberPerGram: 0.08, retentionFactor: 1.0 })
        : { simpleFraction: 0.20, fiberPerGram: 0.08, retentionFactor: 1.0 };
    return { carbs, protein, fat, weight: foodWeight, eatTimeMin: eatTime, carbParams, icon: '🍲' };
}

// -----------------------------------------------------------------------------
// STI 1 — facade. Identisk loop med clinical-equivalence.js' runScenario, men
// events fortolkes fra den data-drevne spec.
// -----------------------------------------------------------------------------
function runViaFacade(scn) {
    resetGraphArrays();
    const sim = new Simulator(scn.profile || {}, 'sandbox', { seed: scn.seed });

    // Setup (svarer til scn.setup-closurene i clinical-equivalence.js).
    if (scn.startClockMin) { sim.totalSimMinutes = scn.startClockMin; sim.timeInMinutes = scn.startClockMin; }
    if (scn.removeBasal) {
        sim.activeLongInsulin = [];
        sim.lastInsulinTime = sim.totalSimMinutes;
        sim.hovorka.insulinRate = 0;
    }
    if (scn.startBG != null) setSimulatorBG(sim, scn.startBG);

    // Stoej fra: deterministisk CGM (+ ingen selvtest-RNG) — se header.
    // setNoise er en engine-metode; facaden eksponerer den ikke, saa kald via engine.
    sim.engine.setNoise(false);

    const applyEvent = (ev) => {
        switch (ev.kind) {
            case 'bolus':    sim.addFastInsulin(ev.units); break;
            case 'food':     sim.addFood(ev.carbs, ev.protein, ev.fat); break;
            case 'motion':   sim.startMotion(ev.intensity, ev.durationMin); break;
            case 'glucagon': sim.useGlucagon(); break;
            default: throw new Error(`Ukendt event-kind: ${ev.kind}`);
        }
    };

    return runLoop(scn, applyEvent, () => readMetrics(sim), () => { sim.simulationSpeed = 60; sim.update(1.0); });
}

// -----------------------------------------------------------------------------
// STI 2 — bar engine. INGEN Simulator-facade. Replikerer facadens basal-setup,
// bruger engine-native interventioner og engine.step() direkte.
// -----------------------------------------------------------------------------
function runViaEngine(scn) {
    // createEngine kaldes med PRAECIS samme options som Simulator-konstruktoren
    // (kun seed; noise on, steadyState off, clinicalEvents off — alle defaults).
    const engine = createEngine(scn.profile || {}, { seed: scn.seed });

    // --- Replikér facade-konstruktørens RNG-traek i PRAECIS samme raekkefoelge ---
    // Dawn-parametrene (_dawnAmplitude/_dawnPeakMinutes/_dawnDay) traekkes nu af
    // ENGINE-KONSTRUKTOEREN selv (regenerateDawn, S9.6), saa baade facade og bar
    // engine faar dem fra de SAMME foerste rng-traek — de er identiske uden
    // manuel replikering her. Det eneste facade-konstruktoer-traek den bare engine
    // IKKE laver er _boxSeed (game-mekanik, simulator.js linje 700, 1 rng()-traek).
    // Replikeres her saa engine-stiens efterfoelgende RNG-position (bolus-tauFactor
    // osv.) flugter med facaden.
    engine.rng();                                            // _boxSeed — vaerdi ubrugt

    // --- Replikér facadens steady-state + spil-specifikke basal-pre-injektion ---
    // (js/simulator.js konstruktoren, S9.1). establishDepot:false -> facadens egen
    // pre-injektion nedenfor styrer basal-forloebet.
    engine.initSteadyState({ targetBG: 5.5, establishDepot: false });
    const PRE_INJECT_AGE_HOURS = 16;  // sandbox-default (campaign kan overstyre; ikke testet her)
    engine.addBasalInsulin({
        units: engine.basalDose,
        injectionTime: engine.totalSimMinutes - PRE_INJECT_AGE_HOURS * 60,
        silent: true
    });
    const depot = engine.activeLongInsulin[0];
    const ba = depot.bioavailability || 1.0;
    const rampUp = 2 * 60, tailOff = 6 * 60;  // samme som trapez-profilen i _prepInsulinRates
    const effectiveArea = depot.totalDuration - rampUp / 2 - tailOff / 2;
    const midnightISF = engine.circadianISF;  // ~1.20 ved midnat, justeret efter dawn
    depot.dose = engine.hovorkaSteadyStateBasalRate * effectiveArea / (1000 * ba * midnightISF);
    engine.lastInsulinTime = engine.totalSimMinutes - PRE_INJECT_AGE_HOURS * 60;

    // --- Setup (efter basal-pre-injektion, ligesom scn.setup koerer EFTER konstruktoren) ---
    if (scn.startClockMin) { engine.totalSimMinutes = scn.startClockMin; engine.timeInMinutes = scn.startClockMin; }
    if (scn.removeBasal) {
        engine.activeLongInsulin = [];
        engine.lastInsulinTime = engine.totalSimMinutes;
        engine.hovorka.insulinRate = 0;
    }
    if (scn.startBG != null) {
        // Samme offentlige kontrakt som facade-stiens setSimulatorBG(): Q1, Q2,
        // CGM-kompartment C, trueBG og cgmBG holdes synkroniserede.
        engine.setBG(scn.startBG);
    }

    // Støj fra: deterministisk CGM, samme som facade-stien — se header.
    engine.setNoise(false);

    const applyEvent = (ev) => {
        switch (ev.kind) {
            case 'bolus':
                engine.addRapidInsulin({ units: ev.units });
                break;
            case 'food':
                engine.addFood(resolveFoodArgs(ev));
                break;
            case 'motion':
                // typeDef UDELADES med vilje -> engine slaar op i sit indbyggede
                // ENGINE_DEFAULT_ACTIVITIES-katalog. Det er den AEGTE standalone-vej
                // (en fremmed bruger kender ikke spillets AKTIVITETSTYPER). For cardio
                // er katalogets numeriske felter identiske med spillets, saa fysikken
                // matcher facaden.
                engine.startActivity({ type: ev.activity, intensity: ev.intensity, durationMin: ev.durationMin });
                break;
            case 'glucagon':
                engine.useGlucagon();
                break;
            default: throw new Error(`Ukendt event-kind: ${ev.kind}`);
        }
        engine.consumeEvents();  // toem event-bufferen (ingen UI at oversaette til)
    };

    return runLoop(scn, applyEvent, () => readMetrics(engine), () => { engine.step(1.0); engine.consumeEvents(); });
}

// readMetrics — laes per-sample-metrikkerne fra et objekt der eksponerer dem
// (baade Simulator-facaden og PhysiologyEngine har felterne i PER_SAMPLE).
function readMetrics(obj) {
    const row = {};
    for (const m of PER_SAMPLE) row[m] = obj[m];
    return row;
}

// -----------------------------------------------------------------------------
// Faelles scenarie-loop (samme tidsstruktur som clinical-equivalence.js):
// 1 sim-min pr. tick, events fyres ved deres atMin, samples ved sampleEveryMin.
//   applyEvent(ev)  fortolker en intervention paa den aktuelle sti.
//   sampleFn()      laeser metrikkerne.
//   stepFn()        avancerer 1 sim-min (facade: sim.update; engine: engine.step).
// -----------------------------------------------------------------------------
function runLoop(scn, applyEvent, sampleFn, stepFn) {
    const events = (scn.events || []).slice().sort((a, b) => a.atMin - b.atMin);
    let evIdx = 0;
    const samples = [];

    for (let minute = 0; minute <= scn.durationMin; minute++) {
        while (evIdx < events.length && events[evIdx].atMin === minute) {
            applyEvent(events[evIdx]);
            evIdx++;
        }
        if (minute % scn.sampleEveryMin === 0) {
            const row = sampleFn();
            row.t = minute;
            samples.push(row);
        }
        if (minute < scn.durationMin) stepFn();
    }

    return {
        name: scn.name,
        durationMin: scn.durationMin,
        sampleEveryMin: scn.sampleEveryMin,
        samples,
        aggregates: computeAggregates(samples)
    };
}

function computeAggregates(samples) {
    const bg = samples.map(s => s.trueBG).filter(v => typeof v === 'number');
    const n = bg.length || 1;
    const mean = bg.reduce((a, v) => a + v, 0) / n;
    const min = bg.reduce((a, v) => Math.min(a, v), Infinity);
    const max = bg.reduce((a, v) => Math.max(a, v), -Infinity);
    const inRange = bg.filter(v => v >= TIR_LOW && v <= TIR_HIGH).length / n;
    return { meanTrueBG: mean, minTrueBG: min, maxTrueBG: max, tir: inRange };
}

// compareRuns — facade (forventet) vs engine (faktisk) med kliniske tolerancer.
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
            track(m, e[m], a[m]);  // mål ALLE metrikker (også cgmBG) til verbose/maxDev
            if (PARITY_METRICS.includes(m) && !within(e[m], a[m], PER_SAMPLE_TOL[m])) {
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

function fmt(v) {
    return typeof v === 'number' ? v.toFixed(4) : String(v);
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
function main() {
    const verbose = process.argv.includes('--verbose');
    console.log('Standalone-paritet: bar engine (createEngine + engine.step) vs Simulator-facade\n');

    let failedScenarios = 0;
    for (const scn of SCENARIOS) {
        const facade = runViaFacade(scn);
        const engine = runViaEngine(scn);
        const { fails, maxDev } = compareRuns(facade, engine);
        const devNote = `trueBG Δ≤${(maxDev.trueBG || 0).toFixed(4)}, cgmBG Δ≤${(maxDev.cgmBG || 0).toFixed(4)}, ` +
            `iob Δ≤${(maxDev.iob || 0).toFixed(4)}, agg.middel Δ≤${(maxDev['agg.meanTrueBG'] || 0).toFixed(4)}`;

        if (fails.length === 0) {
            console.log(`  OK:   ${scn.name}  (${devNote})`);
        } else {
            failedScenarios++;
            console.log(`  FEJL: ${scn.name} — ${fails.length} afvigelser uden for klinisk tolerance (${devNote}):`);
            for (const f of fails.slice(0, 8)) {
                console.log(`        t=${f.t} ${f.metric}: facade ${fmt(f.expected)}, engine ${fmt(f.actual)}` +
                    (f.delta !== undefined ? ` (Δ ${fmt(f.delta)})` : ''));
            }
            if (fails.length > 8) console.log(`        ... og ${fails.length - 8} flere`);
        }
        if (verbose) {
            const parts = Object.keys(maxDev).sort().map(k => `${k}=${maxDev[k].toFixed(4)}`);
            console.log(`        max-afvig: ${parts.join('  ')}`);
        }
    }

    console.log('');
    if (failedScenarios === 0) {
        console.log(`Resultat: ${SCENARIOS.length}/${SCENARIOS.length} scenarier — den bare engine reproducerer facaden inden for klinisk tolerance.`);
        return true;
    }
    console.log(`Resultat: ${SCENARIOS.length - failedScenarios}/${SCENARIOS.length} inden for tolerance — ${failedScenarios} afveg. Se afvigelser ovenfor (tolerancer er IKKE loesnet).`);
    return false;
}

const ok = main();
process.exit(ok ? 0 : 1);
