// Mekanismekontrol før udgivelse: fiberforsinkelse, massebalance og trinfølsomhed.
// Samme stivelse og tarmprofil isolerer den gastriske fiberproxy. Dette er ikke
// en kopi af et klinisk havreforsøg eller en kalibrering af fiberens virkning.
'use strict';
const assert = require('node:assert/strict');
const { createEngine } = require('../js/physiology-engine.js');
function run(fiberGrams, dt) {
    const engine = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20261025, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0,
            sleepDisruption: 0, cgmSensorFaults: false },
    });
    engine.totalSimMinutes = engine.timeInMinutes = 720;
    engine.initSteadyState({ targetBG: 5.5 }); engine.setBG(5.5);
    assert.equal(engine.addFood({ carbs: 30, protein: 0, fat: 0, weight: 150,
        eatTimeMin: 10, carbParams: { simpleFraction: 0.05,
            fiberPerGram: fiberGrams / 30, retentionFactor: 1,
            appearanceProfileId: 'fiber-control', appearanceTauMin: 48.75 } }), true);
    const outputs = {};
    for (let tick = 1; tick <= Math.round(480 / dt); tick++) {
        engine.step(dt);
        const time = tick * dt, pool = engine.hovorka.carbPools['fiber-control'];
        assert.ok(Number.isFinite(engine.trueBG));
        assert.ok(Math.abs(pool.deliveredGrams - pool.stomachGrams
            - pool.intestinalGrams - pool.appearedGrams) < 1e-8);
        if ([30, 60, 120, 480].includes(time)) outputs[time] = {
            appearedGrams: pool.appearedGrams, stomachGrams: pool.stomachGrams,
            bg: engine.trueBG,
        };
    }
    return outputs;
}
const results = {};
for (const dt of [0.5, 0.1]) {
    results[dt] = [0, 3, 6].map(fiber => ({ fiber, endpoints: run(fiber, dt) }));
    // Fortegnskrav: mere af samme fiberproxy forsinker tidlig tilførsel.
    for (const time of [30, 60, 120]) {
        const grams = results[dt].map(x => x.endpoints[time].appearedGrams);
        assert.ok(grams[0] > grams[1] && grams[1] > grams[2],
            `Fiberforsinkelse mangler ved ${time} min, dt=${dt}: ${grams}`);
    }
}
let maxStepDifferenceGrams = 0;
for (let i = 0; i < 3; i++) for (const time of [30, 60, 120, 480]) {
    maxStepDifferenceGrams = Math.max(maxStepDifferenceGrams,
        Math.abs(results[0.5][i].endpoints[time].appearedGrams
            - results[0.1][i].endpoints[time].appearedGrams));
}
// Numerisk udviklingsgrænse på 0.05 g, ikke en litteraturtolerance.
assert.ok(maxStepDifferenceGrams < 0.05, `Trinfølsomhed: ${maxStepDifferenceGrams} g`);
console.log(JSON.stringify({ status: 'mechanism checks passed; not clinical calibration',
    maxStepDifferenceGrams, results }, null, 2));
