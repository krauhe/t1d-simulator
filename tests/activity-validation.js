// =============================================================================
// ACTIVITY-VALIDATION.JS - Litteraturkoblet validering af motionsmodellen
// =============================================================================
//
// Formål:
//   1. Køre et reproducerbart 3 x 3-fingeraftryk for cardio, blandet sport og
//      styrketræning ved lav, medium og høj intensitet.
//   2. Sammenligne modellen med frosne litteraturmål i
//      tests/fixtures/activity-literature-targets.json.
//   3. Teste kontekster, der kan ændre nettoretningen: aktiv insulin,
//      måltid/bolus, klokkeslæt og tidligere motion.
//   4. Sammenligne lav, medium og høj konditionsintensitet ved bolus givet
//      120, 60 eller 0 minutter før aktiviteten samt uden ekstra bolus.
//   5. Skelne mellem PASS, PARTIAL, FAIL og NOT TESTABLE. Manglende mekanismer
//      må ikke skjules ved at gennemsnitliggøre dem ind i en samlet score.
//
// Kør:
//   tests/.bin/node.exe tests/activity-validation.js
//   tests/.bin/node.exe tests/activity-validation.js --json
//
// Scriptet ændrer ikke modellen og skriver ingen resultater til disk. --json
// giver et maskinlæsbart resultat på stdout, som kan arkiveres ved behov.
// =============================================================================

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { createEngine } = require('../js/physiology-engine.js');
const { HOVORKA_STATE_IDX } = require('../js/hovorka.js');

const TARGET_PATH = path.join(__dirname, 'fixtures', 'activity-literature-targets.json');
const TARGETS = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));

const PROFILE_ARCHETYPES = {
    child: { label: 'Child body (Oscar/Olivia)', weight: 40, isf: 4, icr: 15 },
    adult: { label: 'Adult body (Erik/Eva)', weight: 70, isf: 3, icr: 10 },
    large: { label: 'Large body (Frank/Fiona)', weight: 100, isf: 2, icr: 7 }
};

const ACTIVITY_TYPES = ['cardio', 'blandet', 'styrke'];
const INTENSITIES = ['Lav', 'Medium', 'Høj'];
const MATRIX_DURATIONS = [30, 60, 90];
const MATRIX_CONTEXTS = ['fasted', 'active-insulin', 'fed'];
const MATRIX_START_HOURS = [8, 16];
const STATUS_ORDER = ['PASS', 'PARTIAL', 'NOT TESTABLE', 'FAIL'];

function getGitRevision() {
    try {
        return childProcess.execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8'
        }).trim();
    } catch (_error) {
        return 'unavailable';
    }
}

function getAppVersion() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'version-data.js'), 'utf8');
    const match = source.match(/version:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : 'unavailable';
}

function createDeterministicEngine(profile = PROFILE_ARCHETYPES.adult, options = {}) {
    const circadian = options.circadian === true;
    const startHour = options.startHour == null ? 14 : options.startHour;
    const engine = createEngine(
        { weight: profile.weight, isf: profile.isf, icr: profile.icr },
        {
            seed: 20260723,
            noiseEnabled: false,
            modules: {
                dawn: circadian ? 1 : 0,
                dawnVariability: false,
                insulinVariability: false
            }
        }
    );

    // Klokken sættes før steady-state-initialisering, så basal-depotet matcher
    // den valgte cirkadiske ISF. Dette undgår en kunstig basaldrift ved 08/16.
    engine.totalSimMinutes = startHour * 60;
    engine.timeInMinutes = startHour * 60;
    engine.day = 1;
    engine.initSteadyState();
    return engine;
}

function cloneEngine(source) {
    const clone = createEngine(source.profile, {
        seed: 20260723,
        noiseEnabled: false,
        modules: source.modules
    });
    clone.importState(source.exportState());
    return clone;
}

function stepMinutes(engine, minutes, onMinute) {
    for (let minute = 1; minute <= minutes; minute++) {
        engine.step(1);
        if (onMinute) onMinute(engine, minute);
    }
}

function runPairedActivity(preparedEngine, type, intensity, durationMin) {
    const activity = cloneEngine(preparedEngine);
    const control = cloneEngine(preparedEngine);
    const startBG = activity.trueBG;
    const startISF = activity.currentISF;
    const activityTrace = [{ minute: 0, bg: activity.trueBG }];
    const controlTrace = [{ minute: 0, bg: control.trueBG }];

    activity.startActivity({ type, intensity, durationMin });
    for (let minute = 1; minute <= durationMin; minute++) {
        activity.step(1);
        control.step(1);
        activityTrace.push({ minute, bg: activity.trueBG });
        controlTrace.push({ minute, bg: control.trueBG });
    }

    const activityBgs = activityTrace.map(sample => sample.bg);
    const controlBgs = controlTrace.map(sample => sample.bg);
    return {
        type,
        intensity,
        durationMin,
        startBG,
        endBG: activity.trueBG,
        controlEndBG: control.trueBG,
        withinSessionChange: activity.trueBG - startBG,
        matchedControlEffect: activity.trueBG - control.trueBG,
        nadir: Math.min(...activityBgs),
        peak: Math.max(...activityBgs),
        controlNadir: Math.min(...controlBgs),
        startISF,
        endISF: activity.currentISF,
        endIOB: activity.iob,
        finalHepaticDrive: activity.exerciseHepaticDrive,
        finite: [
            activity.trueBG,
            control.trueBG,
            activity.currentISF,
            activity.exerciseHepaticDrive,
            activity.muscleGlycogenGrams
        ].every(Number.isFinite)
    };
}

function prepareHighInsulinContext() {
    const engine = createDeterministicEngine();
    engine.addRapidInsulin({ units: 3 });

    // Den korte præparations-clamp holder start-BG ens, mens bolusdepotet får
    // lov at udvikle aktiv insulin. Den efterfølgende aktivitet er ikke clamped.
    stepMinutes(engine, 45, current => {
        current.hovorka.state[HOVORKA_STATE_IDX.Q1] =
            5.5 * current.hovorka.V_G;
        current.trueBG = 5.5;
        current.cgmBG = 5.5;
    });
    return engine;
}

function prepareFedAfternoonContext() {
    const engine = createDeterministicEngine(PROFILE_ARCHETYPES.adult, {
        circadian: true,
        startHour: 14.5
    });
    engine.addFood({
        carbs: 60,
        protein: 20,
        fat: 15,
        weight: 400,
        eatTimeMin: 15
    });
    engine.addRapidInsulin({ units: 6 });
    stepMinutes(engine, 90);
    return engine;
}

function preparePriorExerciseContext() {
    const engine = createDeterministicEngine();
    engine.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 60 });

    // Hold BG på samme referenceværdi under præparationen. Formålet er at
    // isolere PEIS fra hypo-/stresskaskader, ikke at efterligne en intervention.
    stepMinutes(engine, 60 + 12 * 60, current => {
        current.hovorka.state[HOVORKA_STATE_IDX.Q1] =
            5.5 * current.hovorka.V_G;
        current.trueBG = 5.5;
        current.cgmBG = 5.5;
    });
    return engine;
}

function prepareMatrixContext(profile, context, activityStartHour) {
    const preparationMinutes =
        context === 'fed' ? 90 :
        context === 'active-insulin' ? 45 :
        0;
    const engine = createDeterministicEngine(profile, {
        circadian: true,
        startHour: activityStartHour - preparationMinutes / 60
    });

    if (context === 'active-insulin') {
        // Bolus skaleres med karakterkroppens ICR, så konteksten svarer til
        // omtrent samme kulhydratdækning på tværs af de tre kropsarketyper.
        engine.addRapidInsulin({ units: 3 * 10 / profile.icr });
        stepMinutes(engine, preparationMinutes, current => {
            current.hovorka.state[HOVORKA_STATE_IDX.Q1] =
                5.5 * current.hovorka.V_G;
            current.trueBG = 5.5;
            current.cgmBG = 5.5;
        });
    } else if (context === 'fed') {
        const bodyScale = profile.weight / 70;
        const carbs = 60 * bodyScale;
        engine.addFood({
            carbs,
            protein: 20 * bodyScale,
            fat: 15 * bodyScale,
            weight: 400 * bodyScale,
            eatTimeMin: 15
        });
        engine.addRapidInsulin({ units: carbs / profile.icr });
        stepMinutes(engine, preparationMinutes);
    }

    return engine;
}

function runContextStressMatrix() {
    const records = [];

    for (const [profileId, profile] of Object.entries(PROFILE_ARCHETYPES)) {
        for (const context of MATRIX_CONTEXTS) {
            for (const startHour of MATRIX_START_HOURS) {
                const prepared = prepareMatrixContext(profile, context, startHour);
                for (const type of ACTIVITY_TYPES) {
                    for (const intensity of INTENSITIES) {
                        for (const durationMin of MATRIX_DURATIONS) {
                            records.push({
                                profileId,
                                context,
                                startHour,
                                ...runPairedActivity(
                                    prepared,
                                    type,
                                    intensity,
                                    durationMin
                                )
                            });
                        }
                    }
                }
            }
        }
    }

    const key = record => [
        record.profileId,
        record.context,
        record.startHour,
        record.type,
        record.intensity,
        record.durationMin
    ].join('|');
    const byKey = new Map(records.map(record => [key(record), record]));
    const lookup = (profileId, context, startHour, type, intensity, durationMin) =>
        byKey.get([
            profileId,
            context,
            startHour,
            type,
            intensity,
            durationMin
        ].join('|'));

    const activeInsulinComparisons = [];
    const mixedEnvelopeComparisons = [];
    for (const profileId of Object.keys(PROFILE_ARCHETYPES)) {
        for (const startHour of MATRIX_START_HOURS) {
            for (const intensity of INTENSITIES) {
                for (const durationMin of MATRIX_DURATIONS) {
                    const fasted = lookup(
                        profileId, 'fasted', startHour, 'cardio', intensity, durationMin
                    );
                    const active = lookup(
                        profileId, 'active-insulin', startHour, 'cardio', intensity, durationMin
                    );
                    activeInsulinComparisons.push({
                        profileId,
                        startHour,
                        intensity,
                        durationMin,
                        fastedWithinSessionChange: fasted.withinSessionChange,
                        activeInsulinWithinSessionChange: active.withinSessionChange,
                        passes:
                            active.withinSessionChange <=
                            fasted.withinSessionChange + 0.05
                    });
                }
            }
        }

        for (const context of MATRIX_CONTEXTS) {
            for (const startHour of MATRIX_START_HOURS) {
                for (const intensity of INTENSITIES) {
                    for (const durationMin of MATRIX_DURATIONS) {
                        const cardio = lookup(
                            profileId, context, startHour, 'cardio', intensity, durationMin
                        );
                        const mixed = lookup(
                            profileId, context, startHour, 'blandet', intensity, durationMin
                        );
                        const strength = lookup(
                            profileId, context, startHour, 'styrke', intensity, durationMin
                        );
                        const lower = Math.min(
                            cardio.matchedControlEffect,
                            strength.matchedControlEffect
                        );
                        const upper = Math.max(
                            cardio.matchedControlEffect,
                            strength.matchedControlEffect
                        );
                        mixedEnvelopeComparisons.push({
                            profileId,
                            context,
                            startHour,
                            intensity,
                            durationMin,
                            cardioEffect: cardio.matchedControlEffect,
                            mixedEffect: mixed.matchedControlEffect,
                            strengthEffect: strength.matchedControlEffect,
                            passes:
                                mixed.matchedControlEffect >= lower - 0.15 &&
                                mixed.matchedControlEffect <= upper + 0.15
                        });
                    }
                }
            }
        }
    }

    return {
        scenarioCount: records.length,
        representedCharacterCount: 6,
        uniquePhysiologyProfileCount: Object.keys(PROFILE_ARCHETYPES).length,
        finiteCount: records.filter(record => record.finite).length,
        minimumNadir: Math.min(...records.map(record => record.nadir)),
        maximumPeak: Math.max(...records.map(record => record.peak)),
        hypoglycemiaScenarioCount:
            records.filter(record => record.nadir < 3.9).length,
        severeHypoglycemiaScenarioCount:
            records.filter(record => record.nadir < 2.5).length,
        hyperglycemiaScenarioCount:
            records.filter(record => record.peak > 10).length,
        activeInsulinCardio: {
            comparisonCount: activeInsulinComparisons.length,
            passCount: activeInsulinComparisons.filter(item => item.passes).length,
            failures: activeInsulinComparisons.filter(item => !item.passes).slice(0, 10)
        },
        mixedEnvelope: {
            comparisonCount: mixedEnvelopeComparisons.length,
            passCount: mixedEnvelopeComparisons.filter(item => item.passes).length,
            failures: mixedEnvelopeComparisons.filter(item => !item.passes).slice(0, 10)
        }
    };
}

/**
 * Kører den læringskritiske interaktion mellem aktiv insulin og bevægelse.
 *
 * Alle forsøg starter kl. 12 og observerer aktivitet fra kl. 14. Dermed har
 * bolus ved -120, -60 og 0 minutter samme urtid og samme basale modelhistorik.
 * BG sættes til 10,0 umiddelbart før aktiviteten, men insulinets depoter og
 * virkningstilstande bevares. Hver aktivitetsarm sammenlignes med sin egen
 * hvilearm med nøjagtig samme insulinforløb. Forskellen mellem de to arme er
 * derfor bevægelsens ekstra modelvirkning i den pågældende insulinkontekst.
 */
function runBolusTimingIntensityMatrix() {
    const timings = [
        { id: 'none', label: 'No extra bolus', injectionMinute: null },
        { id: 'minus120', label: '1U at -120 min', injectionMinute: 0 },
        { id: 'minus60', label: '1U at -60 min', injectionMinute: 60 },
        { id: 'start', label: '1U at activity start', injectionMinute: 120 }
    ];
    const records = [];

    for (const timing of timings) {
        const prepared = createDeterministicEngine(PROFILE_ARCHETYPES.adult, {
            startHour: 12
        });

        // Opbyg insulinets alder over samme 120-minutters forløb i alle arme.
        for (let minute = 0; minute < 120; minute++) {
            if (timing.injectionMinute === minute) {
                prepared.addRapidInsulin({ units: 1 });
            }
            prepared.step(1);
        }
        prepared.setBG(10.0);
        if (timing.injectionMinute === 120) {
            prepared.addRapidInsulin({ units: 1 });
        }

        for (const intensity of INTENSITIES) {
            const result = runPairedActivity(prepared, 'cardio', intensity, 60);
            records.push({
                timing: timing.id,
                timingLabel: timing.label,
                intensity,
                startBG: result.startBG,
                exerciseBG60: result.endBG,
                restBG60: result.controlEndBG,
                // Positiv værdi betyder, at bevægelsen gav en større reduktion
                // end hvile med præcis samme insulinforløb.
                movementReduction: result.controlEndBG - result.endBG,
                finite: result.finite
            });
        }
    }

    const find = (timing, intensity) => records.find(record =>
        record.timing === timing && record.intensity === intensity
    );
    const intensityOrdering = timings.map(timing => {
        const low = find(timing.id, 'Lav').movementReduction;
        const medium = find(timing.id, 'Medium').movementReduction;
        const high = find(timing.id, 'Høj').movementReduction;
        return {
            timing: timing.id,
            low,
            medium,
            high,
            passes: low < medium && medium < high
        };
    });
    const activeInsulinAmplification = ['Medium', 'Høj'].map(intensity => {
        const noExtraBolus = find('none', intensity).movementReduction;
        const activeRows = timings
            .filter(timing => timing.id !== 'none')
            .map(timing => find(timing.id, intensity));
        const strongest = activeRows.reduce((best, row) =>
            row.movementReduction > best.movementReduction ? row : best
        );
        return {
            intensity,
            noExtraBolus,
            strongestTiming: strongest.timing,
            strongestReduction: strongest.movementReduction,
            amplification: strongest.movementReduction - noExtraBolus,
            passes: strongest.movementReduction > noExtraBolus + 0.05
        };
    });

    return {
        scenarioCount: records.length,
        matchedRunCount: records.length * 2,
        allFinite: records.every(record => record.finite),
        sameStartBG: records.every(record => Math.abs(record.startBG - 10.0) < 1e-9),
        intensityOrdering,
        activeInsulinAmplification,
        records
    };
}

function prepareHyperinsulinemicClampEngine() {
    const engine = createDeterministicEngine();
    const h = engine.hovorka;
    const insulinClamp = 60;
    const targetBG = 5.5;
    const actions = h.steadyStateActions(insulinClamp);

    engine.activeFastInsulin = [];
    engine.activeLongInsulin = [];
    engine.activeFood = [];
    engine.activeIntake = [];

    h.state[HOVORKA_STATE_IDX.I] = insulinClamp;
    h.state[HOVORKA_STATE_IDX.x1] = actions.x1;
    h.state[HOVORKA_STATE_IDX.x2] = actions.x2;
    h.state[HOVORKA_STATE_IDX.x3] = actions.x3;
    h.state[HOVORKA_STATE_IDX.Q1] = targetBG * h.V_G;
    h.state[HOVORKA_STATE_IDX.Q2] =
        actions.x1 * h.state[HOVORKA_STATE_IDX.Q1] / (h.k_12 + actions.x2);
    engine.trueBG = targetBG;
    engine.cgmBG = targetBG;
    return engine;
}

function runGlucoseClamp(type, intensity, durationMin = 40) {
    const engine = prepareHyperinsulinemicClampEngine();
    const h = engine.hovorka;
    const targetBG = 5.5;
    const insulinClamp = 60;
    let infusedMgPerKg = 0;
    let overshootMmol = 0;

    if (type) engine.startActivity({ type, intensity, durationMin });

    for (let minute = 0; minute < durationMin; minute++) {
        h.state[HOVORKA_STATE_IDX.I] = insulinClamp;
        engine.step(1);
        h.state[HOVORKA_STATE_IDX.I] = insulinClamp;

        const targetQ1 = targetBG * h.V_G;
        const deficitMmol = targetQ1 - h.state[HOVORKA_STATE_IDX.Q1];
        if (deficitMmol >= 0) {
            h.state[HOVORKA_STATE_IDX.Q1] += deficitMmol;
            infusedMgPerKg += deficitMmol * 180.156 / engine.weight;
        } else {
            // En klinisk euglykæmisk clamp kan ikke fjerne glukose. Vi registrerer
            // derfor overshoot særskilt i stedet for at skjule det som negativ GIR.
            overshootMmol += -deficitMmol;
        }
        engine.trueBG = h.glucoseConcentration;
        engine.cgmBG = engine.trueBG;
    }

    return {
        type: type || 'control',
        intensity: intensity || null,
        meanGir: infusedMgPerKg / durationMin,
        overshootMmol,
        durationMin
    };
}

function withinRange(value, min, max, tolerance = 0) {
    return value >= min - tolerance && value <= max + tolerance;
}

function addCheck(checks, id, status, message, details = {}) {
    checks.push({ id, status, message, details });
}

function aggregateStatus(checks) {
    if (checks.some(check => check.status === 'FAIL')) return 'FAIL';
    if (checks.every(check => check.status === 'PASS')) return 'PASS';

    // PARTIAL og NOT TESTABLE beskriver forskellige begrænsninger ved enkelte
    // påstande. En hel valideringspakke med flere beståede checks er derfor
    // samlet PARTIAL, ikke samlet NOT TESTABLE.
    return 'PARTIAL';
}

function runValidation() {
    const checks = [];

    const core = {};
    for (const type of ACTIVITY_TYPES) {
        core[type] = {};
        for (const intensity of INTENSITIES) {
            core[type][intensity] = runPairedActivity(
                createDeterministicEngine(),
                type,
                intensity,
                60
            );
        }
    }
    const coreFinite = ACTIVITY_TYPES.every(type =>
        INTENSITIES.every(intensity => core[type][intensity].finite)
    );
    addCheck(
        checks,
        'verification.3x3-finite',
        coreFinite ? 'PASS' : 'FAIL',
        coreFinite
            ? 'All nine deterministic activity/intensity runs remain finite.'
            : 'At least one deterministic activity/intensity run is non-finite.'
    );

    const highCardio = core.cardio['Høj'].matchedControlEffect;
    const mediumCardio = core.cardio.Medium.matchedControlEffect;
    const lowCardio = core.cardio.Lav.matchedControlEffect;
    const cardioOrdered = highCardio < mediumCardio && mediumCardio < lowCardio;
    addCheck(
        checks,
        'verification.cardio-intensity-order',
        cardioOrdered ? 'PASS' : 'FAIL',
        `Cardio effect low/medium/high: ${lowCardio.toFixed(2)}, ` +
        `${mediumCardio.toFixed(2)}, ${highCardio.toFixed(2)} mmol/L.`
    );

    const contextMatrix = runContextStressMatrix();
    const matrixNumericallyStable =
        contextMatrix.finiteCount === contextMatrix.scenarioCount &&
        contextMatrix.minimumNadir >= 0 &&
        contextMatrix.maximumPeak <= 60;
    addCheck(
        checks,
        'verification.context-matrix-finite',
        matrixNumericallyStable ? 'PASS' : 'FAIL',
        `${contextMatrix.finiteCount}/${contextMatrix.scenarioCount} unique-body scenarios ` +
        `remain finite; BG range ${contextMatrix.minimumNadir.toFixed(2)} to ` +
        `${contextMatrix.maximumPeak.toFixed(2)} mmol/L. ` +
        `${contextMatrix.hypoglycemiaScenarioCount} scenarios cross 3.9 mmol/L; ` +
        'these unmanaged stress runs are not safety recommendations.',
        contextMatrix
    );

    const activeInsulinMatrixPass =
        contextMatrix.activeInsulinCardio.passCount ===
        contextMatrix.activeInsulinCardio.comparisonCount;
    addCheck(
        checks,
        'verification.context-matrix-active-insulin',
        activeInsulinMatrixPass ? 'PASS' : 'FAIL',
        `${contextMatrix.activeInsulinCardio.passCount}/` +
        `${contextMatrix.activeInsulinCardio.comparisonCount} comparisons show at least ` +
        'as much total within-session cardio lowering with active insulin.',
        contextMatrix.activeInsulinCardio
    );

    const mixedEnvelopePass =
        contextMatrix.mixedEnvelope.passCount ===
        contextMatrix.mixedEnvelope.comparisonCount;
    addCheck(
        checks,
        'verification.context-matrix-mixed-envelope',
        mixedEnvelopePass ? 'PASS' : 'FAIL',
        `${contextMatrix.mixedEnvelope.passCount}/` +
        `${contextMatrix.mixedEnvelope.comparisonCount} mixed-activity responses lie ` +
        'between matched cardio and resistance responses.',
        contextMatrix.mixedEnvelope
    );

    const bolusTimingMatrix = runBolusTimingIntensityMatrix();
    const bolusMatrixStable =
        bolusTimingMatrix.allFinite && bolusTimingMatrix.sameStartBG;
    addCheck(
        checks,
        'verification.bolus-timing-intensity-finite',
        bolusMatrixStable ? 'PASS' : 'FAIL',
        `${bolusTimingMatrix.scenarioCount} activity scenarios and ` +
        `${bolusTimingMatrix.matchedRunCount} total runs remain finite and start ` +
        'from the same 10.0 mmol/L BG.',
        bolusTimingMatrix
    );

    const bolusIntensityOrdered = bolusTimingMatrix.intensityOrdering.every(
        comparison => comparison.passes
    );
    addCheck(
        checks,
        'verification.bolus-timing-intensity-order',
        bolusIntensityOrdered ? 'PASS' : 'FAIL',
        `${bolusTimingMatrix.intensityOrdering.filter(item => item.passes).length}/` +
        `${bolusTimingMatrix.intensityOrdering.length} insulin timings show a larger ` +
        'movement-associated reduction from low to medium to high cardio intensity.',
        bolusTimingMatrix.intensityOrdering
    );

    const bolusAmplificationPass = bolusTimingMatrix.activeInsulinAmplification.every(
        comparison => comparison.passes
    );
    addCheck(
        checks,
        'verification.bolus-timing-active-insulin-amplification',
        bolusAmplificationPass ? 'PASS' : 'FAIL',
        `${bolusTimingMatrix.activeInsulinAmplification.filter(item => item.passes).length}/` +
        `${bolusTimingMatrix.activeInsulinAmplification.length} medium/high comparisons ` +
        'show that active rapid insulin amplifies the extra reduction from movement.',
        bolusTimingMatrix.activeInsulinAmplification
    );

    const t1dexiTarget = TARGETS.holdouts.t1dexi2023ExerciseTypes;
    const t1dexiRuns = {};
    for (const [profileId, profile] of Object.entries(PROFILE_ARCHETYPES)) {
        t1dexiRuns[profileId] = {};
        for (const type of ACTIVITY_TYPES) {
            t1dexiRuns[profileId][type] = runPairedActivity(
                createDeterministicEngine(profile),
                type,
                'Medium',
                30
            );
        }
    }

    const t1dexiMeans = {};
    for (const type of ACTIVITY_TYPES) {
        const values = Object.values(t1dexiRuns)
            .map(profileRuns => profileRuns[type].matchedControlEffect);
        t1dexiMeans[type] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    const t1dexiOrdered =
        t1dexiMeans.cardio < t1dexiMeans.blandet &&
        t1dexiMeans.blandet < t1dexiMeans.styrke;
    const t1dexiInsideOneSd = t1dexiTarget.outcomes.every(target =>
        withinRange(
            t1dexiMeans[target.activity],
            target.mean - target.sd,
            target.mean + target.sd
        )
    );
    addCheck(
        checks,
        'holdout.t1dexi-ordering',
        t1dexiOrdered && t1dexiInsideOneSd ? 'PARTIAL' : 'FAIL',
        t1dexiOrdered && t1dexiInsideOneSd
            ? 'Cross-type ordering and all three means fall within the broad observed SDs, ' +
              'but three body archetypes are not a representative virtual population.'
            : 'The deterministic archetypes do not reproduce the T1DEXI ordering or variability envelope.',
        { modeledMeans: t1dexiMeans }
    );

    const clampControl = runGlucoseClamp(null, null);
    const clampRuns = {};
    const shettyTarget = TARGETS.holdouts.shetty2021HyperinsulinemicClamp;
    for (const target of shettyTarget.exerciseGirIncrement) {
        if (!target.gameIntensity) continue;
        const run = runGlucoseClamp('cardio', target.gameIntensity);
        clampRuns[target.vo2PeakPercent] = {
            ...run,
            increment: run.meanGir - clampControl.meanGir,
            targetMean: target.mean,
            targetSem: target.sem
        };
    }

    const clampRepresentedPass = Object.values(clampRuns).every(run =>
        withinRange(
            run.increment,
            run.targetMean - 2 * run.targetSem,
            run.targetMean + 2 * run.targetSem,
            0.05
        )
    );
    const clampNoOvershoot =
        clampControl.overshootMmol < 1e-9 &&
        Object.values(clampRuns).every(run => run.overshootMmol < 1e-9);
    addCheck(
        checks,
        'holdout.shetty-clamp',
        clampRepresentedPass && clampNoOvershoot ? 'PARTIAL' : 'FAIL',
        clampRepresentedPass && clampNoOvershoot
            ? 'Low, medium and high game intensities reproduce the 35%, 50% and 80% ' +
              'GIR-increment intervals. The separate 65% maximum is not represented.'
            : 'At least one represented Shetty clamp target falls outside mean ± 2 SEM.',
        { control: clampControl, represented: clampRuns }
    );

    const shettyBaselineLower =
        shettyTarget.baselineGirMean - 2 * shettyTarget.baselineGirSem;
    const shettyBaselineUpper =
        shettyTarget.baselineGirMean + 2 * shettyTarget.baselineGirSem;
    const baselineInsideStudyRange = withinRange(
        clampControl.meanGir,
        shettyBaselineLower,
        shettyBaselineUpper
    );
    addCheck(
        checks,
        'holdout.shetty-baseline-gir',
        baselineInsideStudyRange ? 'PASS' : 'PARTIAL',
        baselineInsideStudyRange
            ? 'The virtual resting clamp GIR falls inside the Shetty mean ± 2 SEM interval.'
            : 'The virtual resting clamp GIR is substantially above the Shetty control value. ' +
              'Exercise increments remain comparable after control subtraction, but absolute ' +
              'clamp calibration is not validated.',
        {
            modelControlGirMgKgMin: clampControl.meanGir,
            shettyMeanMgKgMin: shettyTarget.baselineGirMean,
            shettyMeanPlusMinus2Sem: [shettyBaselineLower, shettyBaselineUpper],
            modelClampInsulinMUL: 60,
            shettyInsulinInfusionMilliunitsPerSquareMeterPerMinute:
                shettyTarget.insulinInfusionRateMilliunitsPerSquareMeterPerMinute,
            shettyTargetPlasmaInsulinPmolPerL:
                shettyTarget.targetPlasmaInsulinPmolPerL,
            interpretation: baselineInsideStudyRange
                ? 'Absolute and incremental comparisons are available.'
                : 'Only control-subtracted exercise increments are used as activity evidence; ' +
                  'the absolute mismatch is an open whole-model insulin-dose-response finding.'
        }
    );

    addCheck(
        checks,
        'holdout.shetty-65-percent',
        'NOT TESTABLE',
        'The three-level game catalogue has no separate 65% VO2peak condition, so the ' +
        '65-to-80% plateau cannot be independently identified.'
    );

    const basal = createDeterministicEngine();
    const highInsulin = prepareHighInsulinContext();
    const basalCardio = runPairedActivity(basal, 'cardio', 'Medium', 30);
    const highInsulinCardio = runPairedActivity(highInsulin, 'cardio', 'Medium', 30);
    const insulinAmplifiesDrop =
        highInsulinCardio.withinSessionChange < basalCardio.withinSessionChange - 0.5 &&
        highInsulinCardio.endIOB > 0.5;
    addCheck(
        checks,
        'context.active-insulin-cardio',
        insulinAmplifiesDrop ? 'PASS' : 'FAIL',
        `Cardio change with basal context ${basalCardio.withinSessionChange.toFixed(2)} ` +
        `vs active insulin ${highInsulinCardio.withinSessionChange.toFixed(2)} mmol/L.`
    );

    const morningFasted = createDeterministicEngine(PROFILE_ARCHETYPES.adult, {
        circadian: true,
        startHour: 8
    });
    const afternoonFed = prepareFedAfternoonContext();
    const morningStrength = runPairedActivity(morningFasted, 'styrke', 'Medium', 30);
    const afternoonStrength = runPairedActivity(afternoonFed, 'styrke', 'Medium', 30);
    const contextReversal =
        morningStrength.withinSessionChange > 0 &&
        afternoonStrength.withinSessionChange < 0;
    addCheck(
        checks,
        'holdout.resistance-context-reversal',
        contextReversal ? 'PASS' : 'FAIL',
        `Fasted morning strength ${morningStrength.withinSessionChange >= 0 ? '+' : ''}` +
        `${morningStrength.withinSessionChange.toFixed(2)}; fed afternoon strength ` +
        `${afternoonStrength.withinSessionChange.toFixed(2)} mmol/L.`
    );

    const priorExercise = preparePriorExerciseContext();
    const priorIsfRatio = priorExercise.currentISF / priorExercise.ISF;
    const repeatedCardio = runPairedActivity(priorExercise, 'cardio', 'Medium', 30);
    const priorContextFinite = priorIsfRatio > 1.05 && repeatedCardio.finite;
    addCheck(
        checks,
        'context.prior-exercise',
        priorContextFinite ? 'PASS' : 'FAIL',
        `At 12 h after prior cardio, ISF ratio is ${priorIsfRatio.toFixed(2)}; ` +
        `the repeated activity remains finite.`
    );

    addCheck(
        checks,
        'holdout.rempel-explicit-intervals',
        'NOT TESTABLE',
        'The current mixed category is a continuous average and cannot reproduce ' +
        'Rempel’s six explicit work/recovery intervals.'
    );

    addCheck(
        checks,
        'calibration.romeres-flux-decomposition',
        'NOT TESTABLE',
        'The simulator exposes direct E1 uptake and insulin-mediated action, but not ' +
        'a Romeres-compatible resting IIRd/IDRd decomposition with matching denominators.'
    );

    const contexts = {
        basalCardio,
        activeInsulinCardio: highInsulinCardio,
        fastedMorningStrength: morningStrength,
        fedAfternoonStrength: afternoonStrength,
        priorExercise: {
            isfRatioBeforeSecondBout: priorIsfRatio,
            repeatedCardio
        }
    };

    const summary = STATUS_ORDER.reduce((counts, status) => {
        counts[status] = checks.filter(check => check.status === status).length;
        return counts;
    }, {});

    return {
        metadata: {
            generatedAt: new Date().toISOString(),
            appVersion: getAppVersion(),
            gitRevision: getGitRevision(),
            targetSchemaVersion: TARGETS.schemaVersion,
            targetFrozenOn: TARGETS.frozenOn,
            deterministic: true
        },
        overallStatus: aggregateStatus(checks),
        summary,
        checks,
        deterministicCore: core,
        t1dexi: {
            profileRuns: t1dexiRuns,
            modeledMeans: t1dexiMeans,
            target: t1dexiTarget.outcomes
        },
        shettyClamp: {
            control: clampControl,
            representedIntensities: clampRuns
        },
        contextMatrix,
        bolusTimingMatrix,
        contexts
    };
}

function printHumanReport(result) {
    console.log('\nActivity validation - literature-linked exercise review');
    console.log('========================================================');
    console.log(`Version ${result.metadata.appVersion}, git ${result.metadata.gitRevision}`);
    console.log('');
    for (const check of result.checks) {
        console.log(`[${check.status}] ${check.id}`);
        console.log(`  ${check.message}`);
    }
    console.log('');
    console.log(
        `Summary: ${result.summary.PASS} PASS, ${result.summary.PARTIAL} PARTIAL, ` +
        `${result.summary['NOT TESTABLE']} NOT TESTABLE, ${result.summary.FAIL} FAIL`
    );
    console.log(`Overall: ${result.overallStatus}`);
}

const result = runValidation();
if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
    printHumanReport(result);
}

// Kun egentlige fysiologiske eller numeriske FAIL-resultater gør CI rød.
// PARTIAL og NOT TESTABLE er synlige reviewfund, ikke falske testfejl.
process.exit(result.summary.FAIL === 0 ? 0 : 1);
