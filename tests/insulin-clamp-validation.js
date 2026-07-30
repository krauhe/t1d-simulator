// =============================================================================
// INSULIN-CLAMP-VALIDATION.JS - Ekstern kontrol af vedvarende insulinvirkning
// =============================================================================
//
// Formål:
//   Sammenligne kernemodellens analytiske steady-state glukosebehov med den
//   hyperinsulinæmiske-euglykæmiske clamp i Shetty et al. (2021).
//
// Denne test ændrer ikke modellen og udfører ingen parameterfit. Den viser en
// kendt åben afvigelse som PARTIAL, fordi studiet ikke rapporterer deltagernes
// individuelle ISF-værdier. Afvigelsen er dog synlig over hele det angivne
// plasma-insulininterval og må derfor ikke skjules som en motionsparameter.
//
// Kør:
//   tests/.bin/node.exe tests/insulin-clamp-validation.js
//   tests/.bin/node.exe tests/insulin-clamp-validation.js --json
// =============================================================================

const fs = require('fs');
const path = require('path');
const { HovorkaModel } = require('../js/hovorka.js');

const TARGET_PATH = path.join(
    __dirname,
    'fixtures',
    'activity-literature-targets.json'
);
const TARGETS = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));
const SHETTY = TARGETS.holdouts.shetty2021HyperinsulinemicClamp;

const REFERENCE_PROFILE = {
    weightKg: 76,
    isfMmolPerLPerUnit: 3.0,
    hovorkaReferenceIsf: 3.75,
    clampBgMmolPerL: 5.5
};

function calculateSteadyStateFlux(
    insulinMUL,
    isf = REFERENCE_PROFILE.isfMmolPerLPerUnit
) {
    const h = new HovorkaModel(REFERENCE_PROFILE.weightKg, {
        insulinSensitivityScale: isf / REFERENCE_PROFILE.hovorkaReferenceIsf
    });
    const actions = h.steadyStateActions(insulinMUL);
    const bg = REFERENCE_PROFILE.clampBgMmolPerL;
    const q1 = bg * h.V_G;
    const q2 = actions.x1 * q1 / (h.k_12 + actions.x2);
    const f01c = (h.F_01 / 0.85) * bg / (bg + 1);
    const egp = Math.max(0, h.EGP_0 * (1 - actions.x3));
    const rd = f01c + actions.x2 * q2;
    const girMgKgMin =
        (rd - egp) * 180.156 / REFERENCE_PROFILE.weightKg;

    return {
        insulinMUL,
        isf,
        x1: actions.x1,
        x2: actions.x2,
        x3: actions.x3,
        f01cMmolMin: f01c,
        egpMmolMin: egp,
        rdMmolMin: rd,
        girMgKgMin
    };
}

function solveIsfForTargetGir(insulinMUL, targetGir) {
    let lower = 0.1;
    let upper = 6.0;
    for (let iteration = 0; iteration < 80; iteration++) {
        const midpoint = (lower + upper) / 2;
        if (
            calculateSteadyStateFlux(insulinMUL, midpoint).girMgKgMin >
            targetGir
        ) {
            upper = midpoint;
        } else {
            lower = midpoint;
        }
    }
    return (lower + upper) / 2;
}

function runValidation() {
    // 1 mU/L insulin svarer omtrent til 6 pmol/L. Studiets målinterval
    // 300-550 pmol/L svarer derfor omtrent til 50-92 mU/L.
    const insulinRangeMUL = [50, 60, 92];
    const fluxes = insulinRangeMUL.map(insulin =>
        calculateSteadyStateFlux(insulin)
    );
    const targetLower =
        SHETTY.baselineGirMean - 2 * SHETTY.baselineGirSem;
    const targetUpper =
        SHETTY.baselineGirMean + 2 * SHETTY.baselineGirSem;
    const allAboveTarget =
        fluxes.every(flux => flux.girMgKgMin > targetUpper);
    const fittedIsfAt60 =
        solveIsfForTargetGir(60, SHETTY.baselineGirMean);

    return {
        metadata: {
            targetFrozenOn: TARGETS.frozenOn,
            deterministic: true,
            interpretation:
                'Diagnostic only. The inferred ISF is not a calibration recommendation.'
        },
        status: allAboveTarget ? 'PARTIAL' : 'PASS',
        message: allAboveTarget
            ? 'The reference profile exceeds the Shetty resting GIR interval across the represented plasma-insulin range.'
            : 'At least one represented insulin concentration overlaps the Shetty resting GIR interval.',
        target: {
            meanGirMgKgMin: SHETTY.baselineGirMean,
            semGirMgKgMin: SHETTY.baselineGirSem,
            meanPlusMinus2Sem: [targetLower, targetUpper],
            plasmaInsulinPmolPerL: SHETTY.targetPlasmaInsulinPmolPerL
        },
        referenceProfile: REFERENCE_PROFILE,
        fluxes,
        diagnosticIsfAt60ForMeanTarget: fittedIsfAt60,
        openFinding: allAboveTarget
            ? 'A single ISF multiplier currently links transient bolus response and sustained clamp response. Joint recalibration is required before changing the insulin-action curve.'
            : null
    };
}

function printHumanReport(result) {
    console.log('\nInsulin clamp validation - sustained insulin action');
    console.log('====================================================');
    console.log(
        `Shetty resting GIR: ${result.target.meanGirMgKgMin.toFixed(1)} ± ` +
        `${result.target.semGirMgKgMin.toFixed(1)} mg/kg/min`
    );
    for (const flux of result.fluxes) {
        console.log(
            `  I=${flux.insulinMUL} mU/L -> model GIR ` +
            `${flux.girMgKgMin.toFixed(2)} mg/kg/min`
        );
    }
    console.log(`[${result.status}] ${result.message}`);
    console.log(
        'Diagnostic only: matching 4.4 at I=60 with the current equation ' +
        `would require model ISF ≈${result.diagnosticIsfAt60ForMeanTarget.toFixed(2)}, ` +
        'which is not proposed as a fix.'
    );
}

const result = runValidation();
if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
    printHumanReport(result);
}

// PARTIAL er et synligt reviewfund. Kun en numerisk/runtime-fejl bør gøre
// regressionskommandoen rød, før en fælles bolus+clamp-kalibrering er besluttet.
process.exit(0);
