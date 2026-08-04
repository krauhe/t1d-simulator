// =============================================================================
// DOSE-CONTROLS.TEST.JS - Regressionstest af fælles grove basal-kontroller
// =============================================================================

const {
    getBasalControlCap,
    getBasalControlPresetDoses,
} = require('../js/dose-controls.js');

function assertEqual(actual, expected, label) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${label}: forventede ${expectedJson}, fik ${actualJson}`);
    }
}

assertEqual(getBasalControlCap(7), 10, 'barnets loft');
assertEqual(getBasalControlCap(16), 30, 'den voksnes loft');
assertEqual(getBasalControlCap(34), 70, 'den store voksnes loft');

assertEqual(getBasalControlPresetDoses(7), [2, 4, 6, 8, 10], 'barnets knapper');
assertEqual(getBasalControlPresetDoses(16), [6, 12, 18, 24, 30], 'den voksnes knapper');
assertEqual(getBasalControlPresetDoses(34), [15, 30, 40, 55, 70], 'den store voksnes knapper');

console.log('PASS: grove basallofter og knapper er ens på desktop og mobil');
