// =============================================================================
// PHYSIOLOGY-ENGINE-API.TEST.JS — Direkte Node-tests for engine-API'et
// =============================================================================
//
// Denne fil tester js/physiology-engine.js uden DOM-, lyd- eller i18n-mocks.
// Formålet er S6-migrationen: Lab-API'et skal kunne bruges af modeltests og
// fremtidige værktøjer uden at starte hele spil-facaden.
// =============================================================================

const { createEngine, PhysiologyEngine } = require('../js/physiology-engine.js');
const { HovorkaModel, HOVORKA_STATE_IDX } = require('../js/hovorka.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function approx(actual, expected, tolerance = 1e-9) {
    return Math.abs(actual - expected) <= tolerance;
}

function sampleStats(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
        / (values.length - 1);
    return { mean, std: Math.sqrt(variance) };
}

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  PASS: ${name}`);
    } catch (err) {
        failed++;
        console.error(`  FAIL: ${name}`);
        console.error(`        ${err.message}`);
    }
}

console.log('\n--- PhysiologyEngine API tests ---');

test('exportState/importState bevarer RNG-fortsættelse uden event-genafspilning', () => {
    const source = createEngine({}, { seed: 123 });
    source.rng();
    source.rng();
    source.emitEvent('test-event', { value: 1 });
    const snapshot = source.exportState();
    const expectedNext = source.rng();

    const target = createEngine({}, { seed: 999 });
    target.importState(snapshot);

    assert(target.rng() === expectedNext, 'importeret RNG skal fortsætte samme sekvens');
    assert(target.peekEvents().length === 0, 'importState skal ikke genafspille gamle events');
    assert(snapshot.eventCount === 1, 'exportState skal bevare eventCount som metadata');
});

test('exportState laver dyb kopi og bevarer Infinity/undefined', () => {
    const engine = createEngine({}, { seed: 1 });
    engine._lowestBGDuringDeficit = Infinity;
    engine._lastPeisFactor = undefined;
    engine.activeFastInsulin.push({ dose: 1, nested: { tau: 55 } });

    const snapshot = engine.exportState();
    snapshot.state.activeFastInsulin[0].nested.tau = 99;

    assert(snapshot.state._lowestBGDuringDeficit === Infinity, 'Infinity skal bevares');
    assert(Object.prototype.hasOwnProperty.call(snapshot.state, '_lastPeisFactor'), 'undefined-felt skal bevares');
    assert(engine.activeFastInsulin[0].nested.tau === 55, 'snapshot må ikke dele nested objekter med engine');
});

test('exportState/importState round-tripper Hovorka ODE-kernen (S9.9)', () => {
    // Uden hovorka.state i snapshottet ville import IKKE genoprette glukose-kompartmenterne,
    // og trueBG (gen-udledt fra hovorka hvert step) ville snappe tilbage til live ODE-state.
    const source = createEngine({}, { seed: 7, steadyState: true });
    source.addRapidInsulin({ units: 2 });
    for (let i = 0; i < 30; i++) source.step(1);
    const snapshot = source.exportState();
    const sourceQ1 = source.hovorka.state[4];
    const sourceBG = source.trueBG;

    const target = createEngine({}, { seed: 999 });
    target.importState(snapshot);
    assert(snapshot.version === 2, 'snapshot-format skal være version 2 (inkl. hovorka)');
    assert(approx(target.hovorka.state[4], sourceQ1), 'Hovorka Q1 skal restaureres');
    assert(approx(target.trueBG, sourceBG), 'trueBG skal matche kilden efter import');
    // Det afgørende: efter import skal step() fortsætte IDENTISK med kilden (ODE-kerne + rng).
    target.step(1);
    source.step(1);
    assert(approx(target.trueBG, source.trueBG), 'efter import skal target.step() fortsætte identisk (ODE-kerne restaureret)');
});

test('step() underinddeler store steps så søvn-krydsninger ikke springes over (S9.9)', () => {
    const engine = createEngine({}, { seed: 3, steadyState: true });
    engine.totalSimMinutes = 3 * 60; engine.timeInMinutes = 3 * 60; // 03:00 (nat)
    engine.addRapidInsulin({ units: 1 }); // nat-bolus -> søvntab akkumuleres
    engine.consumeEvents();
    engine.step(1);
    assert(engine.lostSleepHoursTonight > 0, 'nat-bolus skal akkumulere faktisk vågen tid');
    // ÉT stort step fra 03:00 henover 07:00 (5 timer) i et enkelt kald
    let sawSleepDebt = false;
    const { events } = engine.step(5 * 60 - 1);
    for (const e of events) if (e.type === 'sleep-debt') sawSleepDebt = true;
    assert(sawSleepDebt, 'stort step henover 07:00 skal stadig udløse sleep-debt (krydsning ikke sprunget over)');
    assert(engine.sleepDebtAppliedForDay === engine.day, 'søvngæld skal være anvendt efter krydsningen');
});

test('input-validering kaster tydelige fejl ved malformet input (S9.9)', () => {
    let threw;
    threw = false; try { createEngine({ weight: -5 }); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'negativ vægt skal kaste RangeError');
    threw = false; try { createEngine({ isf: 'x' }); } catch (e) { threw = e instanceof TypeError; }
    assert(threw, 'ikke-numerisk isf skal kaste TypeError');

    const engine = createEngine({}, { seed: 1, steadyState: true });
    threw = false; try { engine.addFood({ carbs: NaN }); } catch (e) { threw = e instanceof TypeError; }
    assert(threw, 'NaN carbs skal kaste TypeError (ikke lydløst -> 0)');
    threw = false; try { engine.addRapidInsulin({}); } catch (e) { threw = e instanceof TypeError; }
    assert(threw, 'manglende units skal kaste TypeError');
    threw = false; try { engine.addRapidInsulin({ units: -3 }); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'negativ bolus skal kaste RangeError');
    threw = false; try { engine.step(NaN); } catch (e) { threw = e instanceof TypeError; }
    assert(threw, 'step(NaN) skal kaste TypeError');

    // Gyldige kald må IKKE kaste.
    engine.addFood({ carbs: 30 });
    engine.addRapidInsulin({ units: 3 });
    engine.step(0);    // no-op
    engine.step(2.5);  // stort step
    assert(true, 'gyldige kald gennemføres uden fejl');
});

test('carbParams valideres før måltidet kan sprede NaN til ODE-kernen', () => {
    const invalidCases = [
        [{ simpleFraction: NaN, fiberPerGram: 0.08, retentionFactor: 1.0 }, TypeError],
        [{ simpleFraction: 1.1, fiberPerGram: 0.08, retentionFactor: 1.0 }, RangeError],
        [{ simpleFraction: 0.2, fiberPerGram: Infinity, retentionFactor: 1.0 }, TypeError],
        [{ simpleFraction: 0.2, fiberPerGram: 0.08, retentionFactor: -0.1 }, RangeError],
        [{ simpleFraction: 0.2 }, TypeError],
        ['mixed', TypeError],
    ];

    for (const [carbParams, ExpectedError] of invalidCases) {
        const engine = createEngine({}, { seed: 30 });
        let error = null;
        try {
            engine.addFood({ carbs: 10, weight: 20, eatTimeMin: 1, carbParams });
        } catch (caught) {
            error = caught;
        }
        assert(error instanceof ExpectedError,
            `ugyldige carbParams skal kaste ${ExpectedError.name}, fik ${error && error.constructor.name}`);
        assert(engine.activeFood.length === 0 && engine.activeIntake.length === 0,
            'afvist carbParams må ikke efterlade måltids-state');
        assert(engine.peekEvents().length === 0,
            'afvist carbParams må ikke udsende events før fejlen');
    }

    // Fiber/digestible-carb kan legitimt være >1 for meget fiberrige grøntsager.
    const valid = createEngine({}, { seed: 31 });
    assert(valid.addFood({
        carbs: 10,
        weight: 40,
        eatTimeMin: 1,
        carbParams: { simpleFraction: 0.65, fiberPerGram: 1.55, retentionFactor: 0.4 }
    }) === true, 'gyldige høj-fiber-parametre skal accepteres');

    // Den generelle invariant giver en præcis fejl, hvis en fremtidig kodevej alligevel
    // forurener en kernetilstand med NaN.
    const poisoned = createEngine({}, { seed: 32 });
    poisoned.hovorka.state[HovorkaModel.STATE_IDX.Q1] = NaN;
    let invariantError = null;
    try { poisoned.step(1); } catch (caught) { invariantError = caught; }
    assert(invariantError instanceof Error && /Q1/.test(invariantError.message),
        'step-invarianten skal navngive den ikke-endelige Hovorka-state');
});

test('steady-state-søgningen udvider grænser og afviser uopnåelige mål tydeligt', () => {
    // Normalprofilen skal bruge den historiske søgevej og forblive bit-identisk.
    const normal = new HovorkaModel(70, { insulinSensitivityScale: 3.0 / 3.75 });
    const normalBG = normal.initializeSteadyState(10, 5.5);
    assert(approx(normal.steadyStateBasalRate, 9.36295843124390, 1e-12),
        'normalprofilens etablerede steady-state-rate skal være bit-identisk');
    assert(Math.abs(normalBG - 5.5) <= 0.02,
        'normalprofilen skal nå targetBG inden for tolerancen');

    // Denne gyldige, meget resistente API-profil ramte tidligere den skjulte 20 mU/min-grænse.
    const resistant = createEngine({ weight: 200, isf: 0.5, icr: 10 }, { seed: 33 });
    resistant.initSteadyState({ establishDepot: false });
    assert(resistant.hovorkaSteadyStateBasalRate > 20,
        'resistent profil skal aktivere den adaptive øvre søgegrænse');
    assert(Math.abs(resistant.trueBG - 5.5) <= 0.02,
        'resistent profil skal nå targetBG efter adaptiv søgning');

    // Denne gyldige, meget følsomme API-profil kræver mindre end den gamle 0,5-grænse.
    const sensitive = createEngine({ weight: 1, isf: 50, icr: 10 }, { seed: 34 });
    sensitive.initSteadyState({ establishDepot: false });
    assert(sensitive.hovorkaSteadyStateBasalRate < 0.5,
        'følsom profil skal aktivere den adaptive nedre søgegrænse');
    assert(Math.abs(sensitive.trueBG - 5.5) <= 0.02,
        'følsom profil skal nå targetBG efter adaptiv søgning');

    // Ekstreme profiler/mål må fejle eksplicit i stedet for at returnere falsk steady state.
    const beyondRateLimit = createEngine({ weight: 500, isf: 0.1, icr: 10 }, { seed: 35 });
    let highRateError = null;
    try { beyondRateLimit.initSteadyState(); } catch (caught) { highRateError = caught; }
    assert(highRateError instanceof RangeError && /0-500 mU\/min/.test(highRateError.message),
        'uopnåeligt mål ved øvre rategrænse skal kaste en tydelig RangeError');

    const beyondNoInsulinBG = createEngine({}, { seed: 36 });
    let highTargetError = null;
    try { beyondNoInsulinBG.initSteadyState({ targetBG: 25 }); } catch (caught) { highTargetError = caught; }
    assert(highTargetError instanceof RangeError && /insulinfrie steady-state BG/.test(highTargetError.message),
        'mål over insulinfrie ligevægt skal kaste en tydelig RangeError');
});

test('modules-toggles isolerer/slår modeldele fra (S9.10)', () => {
    // Ukendt modul-navn afvises (typo-beskyttelse).
    let threw = false;
    try { createEngine({}, { modules: { dwan: false } }); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'ukendt modul skal kaste RangeError');
    threw = false;
    try { createEngine({}, { modules: { dawn: 'no' } }); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'ugyldig dawn-skalering skal kaste RangeError');

    // dawn off -> ingen morgen-kortisol uanset tidspunkt.
    const noDawn = createEngine({}, { seed: 1, steadyState: true, modules: { dawn: false } });
    noDawn.totalSimMinutes = 8 * 60; noDawn.timeInMinutes = 8 * 60; // 08:00 (dawn-peak)
    assert(noDawn.circadianKortisolNiveau === 0, 'dawn off -> circadianKortisol 0');
    assert(noDawn.circadianISF === 1.0, 'dawn off -> circadian ISF neutral');

    // cgmSensorFaults off -> sensoren er altid aktiv, selv efter et eksplicit sensor-tab.
    const noFaults = createEngine({}, { seed: 1, steadyState: true, modules: { cgmSensorFaults: false } });
    noFaults.startCgmSensorLoss(45, 60);
    assert(noFaults.getCgmSensorStatus() === 'active', 'cgmSensorFaults off -> altid active');

    // ketones off -> ingen keton-produktion selv ved insulinmangel + høj BG.
    const noKet = createEngine({}, { seed: 1, steadyState: true, modules: { ketones: false } });
    noKet.activeLongInsulin = []; noKet.hovorka.insulinRate = 0; // insulinmangel
    noKet.setBG(20);
    for (let i = 0; i < 240; i++) noKet.step(1);
    // ketoneLevel har en fysiologisk baseline på 0.1; med modulet fra stiger den IKKE
    // (ingen produktion) selv ved 4 timers insulinmangel ved BG 20.
    assert(noKet.ketoneLevel <= 0.1 + 1e-9, 'ketones off -> ketoneLevel stiger ikke over baseline');
    assert(noKet.acidosisLoad === 0, 'ketones off -> ingen acidose-load');

    // insulinVariability off -> deterministisk PK (to boluser får samme tauI).
    const noVar = createEngine({}, { seed: 1, steadyState: true, modules: { insulinVariability: false } });
    noVar.addRapidInsulin({ units: 2 });
    noVar.addRapidInsulin({ units: 2 });
    assert(noVar.activeFastInsulin[0].tauI === noVar.activeFastInsulin[1].tauI,
        'insulinVariability off -> identisk tauI på tværs af boluser');

    // fatProtein off -> fedt/protein-måltider behandles som carbs-only (ingen effekt).
    const noFP = createEngine({}, { seed: 1, steadyState: true, modules: { fatProtein: false } });
    noFP.addFood({ carbs: 30, protein: 40, fat: 40 });
    for (let i = 0; i < 120; i++) noFP.step(1);
    assert(noFP.proteinGlucagonLevel === 0, 'fatProtein off -> ingen protein-glukagon');
    assert(noFP.ffaResistanceFactor <= 1.0 + 1e-6, 'fatProtein off -> ingen FFA-resistens (fedt droppet)');

    // ffaResistance off -> en høj FFA-resistensfaktor reducerer IKKE currentISF.
    const ffaOff = createEngine({}, { seed: 1, steadyState: true, modules: { ffaResistance: false } });
    const ffaOn = createEngine({}, { seed: 1, steadyState: true });
    ffaOff.ffaResistanceFactor = 1.42; ffaOn.ffaResistanceFactor = 1.42;
    assert(ffaOff.currentISF > ffaOn.currentISF,
        'ffaResistance off -> FFA reducerer ikke ISF (højere effektiv ISF end med modulet on)');

    // reset() bevarer modul-toggles.
    noDawn.reset();
    assert(noDawn.modules.dawn === 0, 'reset() skal bevare den normaliserede dawn-skalering');
});

test('setNoise toggler støjflag uden at røre seed/RNG-state', () => {
    const engine = createEngine({}, { seed: 2 });
    const before = engine.rng._state;

    assert(engine.noiseEnabled === true, 'default noiseEnabled skal være true');
    assert(engine.setNoise(false) === engine, 'setNoise skal returnere engine');
    assert(engine.noiseEnabled === false, 'setNoise(false) skal slå støj fra');
    assert(engine.rng._state === before, 'setNoise må ikke trække RNG');
    engine.setNoise(true);
    assert(engine.noiseEnabled === true, 'setNoise(true) skal slå støj til');
});

test('setBG synkroniserer engine-state og Hovorka Q1/Q2/C', () => {
    const engine = createEngine({}, { seed: 3 });
    const hovorka = new HovorkaModel(70);
    hovorka.state[4] = 5.5 * hovorka.V_G;
    hovorka.state[5] = 12;
    hovorka.state[10] = 5.5;
    engine.attachHovorka(hovorka);

    engine.setBG(11);

    assert(engine.trueBG === 11, 'trueBG skal sættes');
    assert(engine.cgmBG === 11, 'cgmBG skal sættes');
    assert(approx(hovorka.state[4], 11 * hovorka.V_G), 'Q1 skal matche targetBG * V_G');
    assert(approx(hovorka.state[5], 24), 'Q2 skal skaleres proportionalt');
    assert(hovorka.state[10] === 11, 'CGM-kompartment C skal sættes');
});

// --- CGM-komponentkontrakt --------------------------------------------------
// Disse tests holder den stokastiske sensor adskilt fra fysiologibaselinen.
// Dermed peger en fejl direkte på lag, støj, drift, kompression eller sensorstate.

test('CGM-kompartmentet følger førsteordens lag med ka_int = 0,073 min^-1', () => {
    const hovorka = new HovorkaModel(70);
    const startBG = 5.5;
    const targetBG = 10.0;
    const steps = 10;

    hovorka.state[HOVORKA_STATE_IDX.C] = startBG;
    for (let minute = 0; minute < steps; minute++) {
        // Plasma-BG fastholdes som et kontrolleret step-input. Resten af ODE'en
        // må gerne udvikle sig, men Q1 nulstilles før hvert Euler-step.
        hovorka.state[HOVORKA_STATE_IDX.Q1] = targetBG * hovorka.V_G;
        hovorka.step(1);
    }

    const expected = targetBG
        - (targetBG - startBG) * Math.pow(1 - hovorka.ka_int, steps);
    assert(approx(hovorka.state[HOVORKA_STATE_IDX.C], expected, 1e-10),
        `C efter ${steps} min skal være ${expected.toFixed(6)} mmol/L`);

    const halfResponseMinutes = Math.log(2) / hovorka.ka_int;
    assert(halfResponseMinutes > 9.4 && halfResponseMinutes < 9.6,
        'CGM-lagets analytiske halvresponstid skal være cirka 9,5 min');
});

test('samme seed giver en identisk stokastisk CGM-trace', () => {
    const makeTrace = () => {
        const engine = createEngine({}, {
            seed: 1701,
            steadyState: true,
            modules: { cgmSensorFaults: false }
        });
        const trace = [];
        for (let minute = 0; minute < 180; minute++) {
            engine.step(1);
            if ((minute + 1) % 5 === 0) trace.push(engine.cgmBG);
        }
        return trace;
    };

    const first = makeTrace();
    const second = makeTrace();
    assert(first.length === second.length, 'traces skal have samme længde');
    assert(first.every((value, index) => Object.is(value, second[index])),
        'samme seed og konfiguration skal give bit-identisk CGM-trace');
});

test('CGM-støj er centreret og skalerer proportionalt med BG', () => {
    const collectNoise = (bg) => {
        const engine = createEngine({}, {
            seed: 1702,
            steadyState: true,
            modules: { cgmSensorFaults: false }
        });
        engine.cgmNoiseScale = 0.03;
        engine.cgmSystemicAmplitude = 0;
        engine.cgmDiscontinuityChance = 0;
        engine.hovorka.state[HOVORKA_STATE_IDX.C] = bg;
        engine.cgmBG = bg;

        const errors = [];
        for (let i = 0; i < 2000; i++) {
            engine._computeCgmBG();
            errors.push(engine.cgmBG - bg);
        }
        return sampleStats(errors);
    };

    const low = collectNoise(5);
    const medium = collectNoise(10);
    const high = collectNoise(15);
    assert(Math.abs(low.mean) < 0.015, 'støj ved BG 5 skal være centreret omkring 0');
    assert(Math.abs(medium.mean) < 0.030, 'støj ved BG 10 skal være centreret omkring 0');
    assert(Math.abs(high.mean) < 0.045, 'støj ved BG 15 skal være centreret omkring 0');
    assert(Math.abs(low.std - 0.15) < 0.015, 'støj-SD ved BG 5 skal være cirka 0,15 mmol/L');
    assert(Math.abs(medium.std - 0.30) < 0.030, 'støj-SD ved BG 10 skal være cirka 0,30 mmol/L');
    assert(Math.abs(high.std - 0.45) < 0.045, 'støj-SD ved BG 15 skal være cirka 0,45 mmol/L');
    assert(Math.abs(medium.std / low.std - 2) < 0.05,
        'støjens standardafvigelse skal fordobles fra BG 5 til BG 10');
    assert(Math.abs(high.std / low.std - 3) < 0.05,
        'støjens standardafvigelse skal tredobles fra BG 5 til BG 15');
});

test('CGM-drift følger den konfigurerede amplitude og periode', () => {
    const engine = createEngine({}, {
        seed: 1703,
        steadyState: true,
        modules: { cgmSensorFaults: false }
    });
    engine.cgmNoiseScale = 0;
    engine.cgmDiscontinuityChance = 0;
    engine.cgmSystemicAmplitude = 0.5;
    engine.cgmSystemicPeriod = 360;
    engine.hovorka.state[HOVORKA_STATE_IDX.C] = 10;

    engine.totalSimMinutes = 0;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 10), 'drift skal være 0 ved periodens start');

    engine.totalSimMinutes = 90;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 10.5), 'drift skal være +0,5 ved kvart periode');

    engine.totalSimMinutes = 270;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 9.5), 'drift skal være -0,5 ved trekvart periode');
});

test('CGM-output begrænses til sensorområdet 2,2-30 mmol/L', () => {
    const engine = createEngine({}, {
        seed: 1704,
        steadyState: true,
        modules: { cgmSensorFaults: false }
    });
    engine.setNoise(false);

    engine.hovorka.state[HOVORKA_STATE_IDX.C] = 1;
    engine._computeCgmBG();
    assert(engine.cgmBG === 2.2, 'lavt CGM-output skal clampes til 2,2 mmol/L');

    engine.hovorka.state[HOVORKA_STATE_IDX.C] = 35;
    engine._computeCgmBG();
    assert(engine.cgmBG === 30, 'højt CGM-output skal clampes til 30 mmol/L');
});

test('kompressions-low er negativ og fader ud før slut', () => {
    const engine = createEngine({}, {
        seed: 1705,
        steadyState: true,
        modules: { cgmSensorFaults: false }
    });
    engine.setNoise(false);
    engine.hovorka.state[HOVORKA_STATE_IDX.C] = 10;
    engine.cgmCompressionStart = 0;
    engine.cgmCompressionUntil = 60;
    engine.cgmCompressionDrop = 2.5;

    engine.totalSimMinutes = 10;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 7.5), 'fuld kompression skal sænke CGM med 2,5 mmol/L');

    engine.totalSimMinutes = 55;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 10 - 2.5 * (5 / 15)),
        'kompression skal fade gradvist ud de sidste 15 min');

    engine.totalSimMinutes = 60;
    engine._computeCgmBG();
    assert(approx(engine.cgmBG, 10), 'kompression skal være væk ved periodens slutning');
});

test('stort CGM-spring kan starte automatisk selvtest med kontrolleret RNG', () => {
    const engine = createEngine({}, {
        seed: 1706,
        steadyState: true,
        modules: { cgmSensorFaults: true }
    });
    engine.setNoise(false);
    engine.trueBG = 10;
    engine.hovorka.state[HOVORKA_STATE_IDX.C] = 10;
    engine.cgmBG = 5;
    engine.totalSimMinutes = 5;
    engine.lastCgmCalculationTime = 0;

    // _computeCgmBG bruger de første 2 træk i Box-Muller. Derefter giver 0,1
    // accept af self-test-kandidaten, og 0,5 giver en varighed på 22,5 min.
    const draws = [0.5, 0.25, 0.1, 0.5];
    engine.rng = () => draws.shift();
    const sample = engine._sampleCgm();

    assert(sample && sample.active, 'det udløsende CGM-sample skal stadig leveres');
    assert(engine.getCgmSensorStatus() === 'checking', 'sensoren skal gå i checking-state');
    assert(approx(engine.cgmSelfTestUntil, 27.5), 'self-test skal slutte efter 22,5 min');
    assert(engine.peekEvents().some(event => event.type === 'cgm-self-test-started'),
        'motoren skal udsende event for startet selvtest');
});

test('setPlasmaInsulinClamp fastholder Hovorka plasma-insulin når aktiv', () => {
    const engine = createEngine({}, { seed: 4 });
    const hovorka = new HovorkaModel(70);
    engine.attachHovorka(hovorka);

    assert(engine.setPlasmaInsulinClamp(18) === engine, 'clamp skal returnere engine');
    assert(engine.plasmaInsulinClamp === 18, 'clamp-state skal gemmes');
    assert(hovorka.state[6] === 18, 'clamp skal anvendes straks');
    hovorka.state[6] = 7;
    assert(engine.applyPlasmaInsulinClamp() === true, 'aktiv clamp skal returnere true');
    assert(hovorka.state[6] === 18, 'aktiv clamp skal gendanne state[6]');
    engine.setPlasmaInsulinClamp(null);
    assert(engine.applyPlasmaInsulinClamp() === false, 'inaktiv clamp skal returnere false');
});

test('runScenario afvikler events i tidsorden via runner uden DOM', () => {
    const engine = createEngine({}, { seed: 5 });
    let time = 0;
    const applied = [];
    engine.attachScenarioRunner({
        step: minutes => { time += minutes; },
        applyEvent: event => { applied.push(event.type); },
        getSample: () => ({ time, applied: applied.slice() })
    });

    const result = engine.runScenario([
        { time: 5, type: 'second' },
        { time: 0, type: 'first' }
    ], 10, 2);

    assert(applied.join(',') === 'first,second', 'events skal afvikles i tidsorden');
    assert(result.samples[0].time === 0, 'første sample skal være start');
    assert(result.samples[result.samples.length - 1].time === 10, 'sidste sample skal være scenarie-slut');
    assert(result.finalState.version === 2, 'runScenario skal returnere finalState');
    assert(!Object.prototype.hasOwnProperty.call(result.finalState.state, 'scenarioRunner'),
        'scenarioRunner må ikke eksporteres');
});

test('Lab-API afviser ugyldige kald tydeligt', () => {
    const engine = createEngine({}, { seed: 6 });
    let bgError = false;
    let clampError = false;
    let scenarioError = false;

    try { engine.setBG(0); } catch (err) { bgError = /positivt/.test(err.message); }
    try { engine.setPlasmaInsulinClamp(-1); } catch (err) { clampError = /ikke-negativt/.test(err.message); }
    try { engine.runScenario([], 1, 1); } catch (err) { scenarioError = /scenario-runner/.test(err.message); }

    assert(bgError, 'setBG skal afvise ikke-positive værdier');
    assert(clampError, 'setPlasmaInsulinClamp skal afvise negative værdier');
    assert(scenarioError, 'runScenario skal kræve runner');
});

// --- S8: engine-native interventioner + læse-API + standalone step ---

// Minimal aktivitets-typeDef (catalog bor normalt i spillet; engine får den ind).
const FAKE_ACTIVITY_TYPEDEF = {
    hrTarget: { Lav: 100, Medium: 130, Høj: 160 },
    contractionUptakeScaling: 1.0,
    fastSensitivityScaling: 1.0,
    earlySensitivityScaling: 1.0,
    lateSensitivityScaling: 1.0,
    insulinSensitivityDelayMin: 0,
    glycogenUseScaling: 1.0,
    hepaticDriveRate: { Lav: 0, Medium: 0, Høj: 0.02 },
    hepaticDriveCeiling: { Lav: 0, Medium: 0, Høj: 0.4 },
    stressReduction: 0,
    kcalPerMin: { Lav: 4, Medium: 7, Høj: 11 },
    vasodilatation: 0,
    icon: '🏃'
};

test('engine-native interventioner muterer state + emitterer events', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 20 });
    const hovorka = new HovorkaModel(70);
    engine.attachHovorka(hovorka);

    const foodOk = engine.addFood({ carbs: 40, protein: 10, fat: 5, weight: 80 });
    assert(foodOk === true, 'addFood skal returnere true ved accept');
    assert(engine.activeFood.length === 1, 'addFood skal lægge i activeFood');
    assert(engine.activeIntake.length === 1, 'addFood skal lægge i activeIntake-køen');
    assert(approx(engine.totalKcalConsumed, 40 * 4 + 10 * 4 + 5 * 9), 'addFood skal akkumulere kcal');

    engine.acidosisWarningGiven = true;
    engine.addRapidInsulin({ units: 5 });
    assert(engine.activeFastInsulin.length === 1, 'addRapidInsulin skal lægge en bolus');
    assert(engine.activeFastInsulin[0].dose === 5, 'bolus skal have korrekt dosis');
    assert(engine.lastInsulinTime === engine.totalSimMinutes, 'addRapidInsulin skal sætte lastInsulinTime');
    assert(engine.acidosisWarningGiven === false, 'insulin skal nulstille DKA-advarsel');

    engine.addBasalInsulin({ units: 20 });
    assert(engine.activeLongInsulin.length === 1, 'addBasalInsulin skal lægge en basal-dosis');

    const started = engine.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 30, typeDef: FAKE_ACTIVITY_TYPEDEF });
    assert(started === true, 'startActivity skal returnere true');
    assert(engine.activeAktivitet && engine.activeAktivitet.type === 'cardio', 'aktivitet skal være aktiv');
    assert(engine.startActivity({ type: 'cardio', intensity: 'Lav', durationMin: 10, typeDef: FAKE_ACTIVITY_TYPEDEF }) === false,
        'startActivity skal afvise når en aktivitet allerede kører');
    engine.stopActivity();
    assert(engine.activeAktivitet === null, 'stopActivity skal nulstille aktiviteten');
    assert(engine.activeMotion.length === 1,
        'startActivity skal oprette én kontinuerlig exercise-sensitivity-session');

    engine.liverGlycogenGrams = 90;
    const released = engine.useGlucagon();
    assert(approx(released, 35), 'useGlucagon skal mobilisere ~35 g ved fuld lever');
    assert(engine.activeGlucagon && engine.activeGlucagon.totalRelease_g === released, 'activeGlucagon skal sættes');

    const types = engine.peekEvents().map(e => e.type);
    assert(types.includes('food-added') && types.includes('fast-insulin-added')
        && types.includes('activity-started') && types.includes('activity-ended')
        && types.includes('glucagon-used'), 'interventioner skal emitte strukturerede events');
});

test('fysisk aktivitet bruger én fælles vågentilstand under pas og 30 min efter stop', () => {
    for (const type of ['cardio', 'styrke', 'blandet']) {
        const engine = createEngine({}, {
            seed: 300,
            steadyState: true,
            noiseEnabled: false
        });
        engine.totalSimMinutes = 23 * 60;
        engine.timeInMinutes = 23 * 60;
        engine.day = 1;

        assert(engine.startActivity({ type, intensity: 'Medium', durationMin: null }) === true,
            `${type} skal kunne starte`);
        assert(engine.isNightAwake(), `${type} skal holde karakteren vågen straks`);

        engine.step(60);
        assert(engine.activeAktivitet !== null, `${type} skal stadig være aktiv efter 60 min`);
        assert(engine.isNightAwake(), `${type} skal holde karakteren vågen gennem midnat`);
        assert(approx(engine.lostSleepHoursTonight, 1, 1e-9),
            `${type} skal optjene 60 min faktisk søvntab`);

        engine.stopActivity();
        engine.step(29);
        assert(engine.isNightAwake(), `${type} skal være vågen 29 min efter stop`);
        engine.step(1);
        assert(!engine.isNightAwake(), `${type} skal falde i søvn 30 min efter stop`);
        assert(approx(engine.lostSleepHoursTonight, 1.5, 1e-9),
            `${type} skal ende med 90 min samlet søvntab`);
    }
});

test('automatisk og manuelt aktivitetsstop giver samme natlige vågenperiode', () => {
    const makeNightEngine = () => {
        const engine = createEngine({}, { seed: 301, steadyState: true, noiseEnabled: false });
        engine.totalSimMinutes = 23 * 60;
        engine.timeInMinutes = 23 * 60;
        engine.day = 1;
        return engine;
    };
    const automatic = makeNightEngine();
    const manual = makeNightEngine();

    automatic.startActivity({ type: 'styrke', intensity: 'Medium', durationMin: 60 });
    manual.startActivity({ type: 'styrke', intensity: 'Medium', durationMin: null });
    automatic.step(60);
    manual.step(60);
    manual.stopActivity();

    assert(automatic.activeAktivitet === null, 'fast varighed skal stoppe automatisk');
    assert(automatic.nightAwakeUntil === manual.nightAwakeUntil,
        'automatisk og manuelt stop skal sætte samme restitutionstid');
    automatic.step(30);
    manual.step(30);
    assert(approx(automatic.lostSleepHoursTonight, manual.lostSleepHoursTonight, 1e-9),
        'automatisk og manuelt stop skal give samme søvntab');
});

test('motion hen over 07:00 tæller kun nattens vågne minutter og udløser søvngæld', () => {
    const engine = createEngine({}, { seed: 302, steadyState: true, noiseEnabled: false });
    engine.totalSimMinutes = 6.5 * 60;
    engine.timeInMinutes = 6.5 * 60;
    engine.day = 1;
    engine.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 60 });
    engine.consumeEvents();

    const { events } = engine.step(60);
    const debtEvent = events.find(event => event.type === 'sleep-debt');
    assert(debtEvent, '07:00-krydsningen skal omsætte vågentid til søvngæld');
    assert(approx(debtEvent.data.hours, 0.5, 1e-9),
        'kun 06:30-07:00 skal tælle som mistet søvn');
    assert(engine._pendingChronicStress > 0,
        'den faktiske halve times søvntab skal kobles til morgenstress');
});

test('overlappende natlig bolus og motion dobbelttæller ikke søvntab', () => {
    const engine = createEngine({}, { seed: 303, steadyState: true, noiseEnabled: false });
    engine.totalSimMinutes = 23 * 60;
    engine.timeInMinutes = 23 * 60;
    engine.day = 1;
    engine.startActivity({ type: 'blandet', intensity: 'Medium', durationMin: 60 });
    engine.step(15);
    engine.addRapidInsulin({ units: 1 });
    engine.step(75);

    assert(approx(engine.lostSleepHoursTonight, 1.5, 1e-9),
        '60 min motion plus 30 min restitution skal tælle 90 min én gang');
    assert(engine.sleepAwakeIntervals.length === 1,
        'overlappende handlinger skal være ét sammenlagt vågeninterval');
});

test('stressinterventioner validerer før state og eventbuffer ændres', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 201 });

    assert(engine.addAcuteStress(0.2) === true, 'gyldig akut stress skal accepteres');
    assert(approx(engine.acuteStressLevel, 0.2), 'akut stress skal lægges til state');
    assert(engine.addChronicStress(0.5) === true, 'gyldig kronisk stress skal accepteres');
    assert(approx(engine._pendingChronicStress, 0.5), 'kronisk stress skal lægges i pending-puljen');
    assert(engine.peekEvents().map(event => event.type).join(',') ===
        'acute-stress-added,chronic-stress-added', 'gyldige kald skal emitte de to stress-events');

    const assertRejectedWithoutMutation = (operation, label) => {
        const before = engine.exportState();
        let threw = false;
        try {
            operation();
        } catch (error) {
            threw = error instanceof TypeError || error instanceof RangeError;
        }
        const after = engine.exportState();
        assert(threw, `${label} skal afvises med TypeError eller RangeError`);
        assert(JSON.stringify(after) === JSON.stringify(before),
            `${label} må ikke ændre state, RNG eller eventbuffer`);
    };

    [NaN, -0.01, 0.41].forEach(amount =>
        assertRejectedWithoutMutation(() => engine.addAcuteStress(amount), `akut stress ${amount}`));
    [NaN, -0.01, 1.51].forEach(amount =>
        assertRejectedWithoutMutation(() => engine.addChronicStress(amount), `kronisk stress ${amount}`));

    engine.addAcuteStress(0.3);
    engine.addChronicStress(1.25);
    assert(approx(engine.acuteStressLevel, 0.4), 'gentagen akut stress skal cappe aktiv state ved 0,4');
    assert(approx(engine._pendingChronicStress, 1.5), 'gentagen kronisk stress skal cappe pending-puljen ved 1,5');
});

test('startActivity afviser ugyldige specifikationer atomisk', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 202 });
    let acceptedCallbacks = 0;
    const onAccept = () => { acceptedCallbacks++; };
    const malformedTypeDef = { ...FAKE_ACTIVITY_TYPEDEF, hepaticDriveRate: { Lav: 0 } };

    const assertRejectedWithoutMutation = (operation, expectedReturn, label) => {
        const before = engine.exportState();
        let result;
        let threw = false;
        try {
            result = operation();
        } catch (error) {
            threw = true;
        }
        const after = engine.exportState();
        if (expectedReturn === 'throw') {
            assert(threw, `${label} skal kaste en fejl`);
        } else {
            assert(!threw && result === expectedReturn, `${label} skal returnere ${expectedReturn}`);
        }
        assert(JSON.stringify(after) === JSON.stringify(before),
            `${label} må ikke ændre state, søvn, RNG eller eventbuffer`);
        assert(acceptedCallbacks === 0, `${label} må ikke kalde onAccept`);
    };

    assertRejectedWithoutMutation(
        () => engine.startActivity(
            { type: 'ukendt', intensity: 'Medium', durationMin: 30 },
            onAccept
        ),
        false,
        'ukendt aktivitetstype'
    );
    assertRejectedWithoutMutation(
        () => engine.startActivity(
            { type: 'cardio', intensity: 'Ekstrem', durationMin: 30, typeDef: FAKE_ACTIVITY_TYPEDEF },
            onAccept
        ),
        false,
        'ukendt intensitet'
    );
    assertRejectedWithoutMutation(
        () => engine.startActivity(
            { type: 'cardio', intensity: 'Medium', durationMin: 30, typeDef: malformedTypeDef },
            onAccept
        ),
        false,
        'ufuldstændig type-definition'
    );
    assertRejectedWithoutMutation(
        () => engine.startActivity(
            { type: 'cardio', intensity: 'Medium', durationMin: 0, typeDef: FAKE_ACTIVITY_TYPEDEF },
            onAccept
        ),
        'throw',
        'nul minutters aktivitet'
    );

    assert(engine.startActivity(
        { type: 'cardio', intensity: 'Medium', durationMin: null, typeDef: FAKE_ACTIVITY_TYPEDEF },
        onAccept
    ) === true, 'null-varighed skal starte en åben aktivitet');
    assert(acceptedCallbacks === 1, 'gyldig aktivitet skal kalde onAccept præcis én gang');
    assert(engine.activeAktivitet.varighed === null, 'åben aktivitet skal bevare null-varigheden');
});

// Bemærk: insulin-interventionerne bruger nu objekt-form ({units}) som mad/motion (S9.2).

test('addFood afviser når mavesækken er fuld', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 21 });
    engine.attachHovorka(new HovorkaModel(70));
    engine.stomachFull = true;
    const ok = engine.addFood({ carbs: 30, weight: 60 });
    assert(ok === false, 'addFood skal returnere false ved fuld mave');
    assert(engine.peekEvents().some(e => e.type === 'stomach-full'), 'addFood skal emitte stomach-full');
    assert(engine.activeFood.length === 0, 'afvist mad må ikke ligge i activeFood');
});

test('getState/getFluxSnapshot/getPhysiologySnapshot leverer forventede former', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 22 });
    engine.attachHovorka(new HovorkaModel(70));

    const state = engine.getState();
    ['trueBG', 'cgmBG', 'iob', 'cob', 'ketoneLevel', 'currentISF', 'totalSimMinutes', 'day'].forEach(k =>
        assert(Object.prototype.hasOwnProperty.call(state, k), `getState skal indeholde ${k}`));

    const flux = engine.getFluxSnapshot();
    assert(Array.isArray(flux), 'getFluxSnapshot skal returnere et array');

    const snap = engine.getPhysiologySnapshot();
    ['forces', 'insulin', 'food', 'stress', 'liver', 'ketones', 'exercise', 'brain', 'sensitivity', 'bg', 'time'].forEach(k =>
        assert(Object.prototype.hasOwnProperty.call(snap, k), `snapshot skal indeholde kategori ${k}`));
    assert(Array.isArray(snap.forces), 'snapshot.forces skal være et array');
});

test('engine.step() kører standalone og returnerer {state, events}', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 23 });
    const hovorka = new HovorkaModel(70, { insulinSensitivityScale: 3.0 / 3.75 });
    engine.attachHovorka(hovorka);
    engine.setBG(8.0);
    engine.addRapidInsulin({ units: 3 });
    engine.addFood({ carbs: 30 });

    let samples = 0;
    let ret;
    for (let i = 0; i < 60; i++) {
        ret = engine.step(1, { onSample: () => { samples++; } });
    }
    assert(engine.totalSimMinutes === 60, 'step skal fremskrive uret');
    assert(samples === 60, 'onSample skal kaldes ~1/min');
    assert(ret && ret.state && typeof ret.state.trueBG === 'number', 'step skal returnere state');
    assert(Array.isArray(ret.events), 'step skal returnere events-array');
    assert(approx(ret.state.trueBG, engine.trueBG), 'returneret state.trueBG skal matche engine.trueBG');
    assert(engine.trueBG !== 8.0, 'BG skal ændre sig efter mad+insulin over 60 min');
});

test('attachDefaultRunner muliggør standalone runScenario uden facade', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 24 });
    const hovorka = new HovorkaModel(70, { insulinSensitivityScale: 3.0 / 3.75 });
    engine.attachHovorka(hovorka);
    engine.setBG(5.5);
    assert(engine.attachDefaultRunner() === engine, 'attachDefaultRunner skal returnere engine');

    const result = engine.runScenario([
        { time: 0, type: 'food', carbs: 50, protein: 10, fat: 5 },
        { time: 0, type: 'rapidInsulin', units: 5 },
        { time: 90, type: 'glucagon' }
    ], 180, 5);

    assert(result.samples.length > 0, 'runScenario skal producere samples');
    assert(result.samples[0].time === 0, 'første sample skal være start');
    assert(typeof result.samples[1].trueBG === 'number', 'samples skal indeholde trueBG (getState)');
    assert(result.finalState.version === 2, 'runScenario skal returnere finalState');
});

// --- S9.2: ergonomi (default-aktivitetskatalog + reset) ---

test('startActivity bruger default-aktivitetskatalog uden typeDef', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 25, steadyState: true });
    // Ukendt type uden typeDef -> intet katalog-match -> afvist.
    assert(engine.startActivity({ type: 'ukendt-type', intensity: 'Medium', durationMin: 10 }) === false,
        'ukendt type uden typeDef skal afvises');
    // Kendt type slås op i ENGINE_DEFAULT_ACTIVITIES.
    assert(engine.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 30 }) === true,
        'kendt type skal lykkes via default-katalog');
    assert(engine.activeAktivitet && engine.activeAktivitet.type === 'cardio', 'aktivitet skal være aktiv');
    assert(engine.activeAktivitet.kcalPerMin === 7, 'katalog-værdi (cardio Medium = 7 kcal/min) skal bruges');
});

test('reset nulstiller engine til frisk start med samme profil', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 26 });
    engine.setBG(8.0);
    engine.addRapidInsulin({ units: 4 });
    engine.addFood({ carbs: 50 });
    for (let i = 0; i < 30; i++) engine.step(1);
    assert(engine.totalSimMinutes === 30 && engine.activeFastInsulin.length > 0, 'forudsætning: state ændret');

    engine.reset();
    assert(engine.totalSimMinutes === 0, 'reset skal nulstille uret');
    assert(engine.activeFastInsulin.length === 0, 'reset skal rydde rapid-insulin');
    assert(engine.activeFood.length === 0 && engine.activeIntake.length === 0, 'reset skal rydde mad');
    assert(engine.events.length === 0, 'reset skal rydde event-buffer');

    engine.reset({ steadyState: true });
    assert(engine.activeLongInsulin.length === 1, 'reset({steadyState:true}) skal etablere basal-depot');
    assert(Math.abs(engine.trueBG - 5.5) < 0.5, 'reset({steadyState:true}) skal starte nær target-BG');
});

// --- S9.3: kliniske events (opt-in) ---

test('kliniske events (opt-in) fyrer ved tærskel-overgange med severity', () => {
    const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 27, steadyState: true, clinicalEvents: true });
    engine.setBG(8.0);
    engine.addRapidInsulin({ units: 6 });   // stor over-bolus -> driver hypo
    const seen = [];
    for (let i = 0; i < 300; i++) {
        engine.step(1);
        for (const e of engine.consumeEvents()) seen.push(e);
    }
    const lowEv = seen.find(e => e.type === 'glucose-low');
    assert(lowEv, 'glucose-low skal fyre under hypo');
    assert(['mild', 'significant', 'severe'].includes(lowEv.severity), 'glucose-low skal have severity');

    // Default OFF: ingen kliniske glucose-events selv ved samme hypo.
    const quiet = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 27, steadyState: true });
    quiet.setBG(8.0);
    quiet.addRapidInsulin({ units: 6 });
    const quietSeen = [];
    for (let i = 0; i < 300; i++) {
        quiet.step(1);
        for (const e of quiet.consumeEvents()) quietSeen.push(e);
    }
    assert(!quietSeen.some(e => e.type === 'glucose-low'),
        'uden clinicalEvents må glucose-low IKKE fyre');
});

console.log('\n========================================');
console.log(`Result: ${passed}/${passed + failed} tests passed`);

if (failed > 0) {
    process.exit(1);
}
