// Regression for konkrete fund i modelreviewet 2026-10-04.
// Målene er massebevarelse, rene initialbetingelser og en korrekt Q1-forklaring;
// testene er ikke klinisk kalibrering og fastfryser ikke de gamle fejlkurver.
const assert = require('node:assert/strict');
const { createEngine } = require('../js/physiology-engine.js');
const { HovorkaModel, HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');
const { recoveryAfterNadir, hasSampleInRange } = require('./validation-metrics.js');

function engine() {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20261004, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0, sleepDisruption: 0, cgmSensorFaults: false }
    });
    e.totalSimMinutes = e.timeInMinutes = 840;
    e.initSteadyState();
    return e;
}
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function close(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
}

test('F09 genopfyldning måles efter observeret depletion, ikke ved start', () => {
    const series = values => values.map((bg, time) => ({ bg, time }));
    assert.equal(recoveryAfterNadir(series([65, 55, 40, 60, 65]), 65).minutes, 4);
    assert.equal(recoveryAfterNadir(series([92.5, 80, 70]), 65).status, 'no-observed-depletion');
    assert.equal(recoveryAfterNadir(series([65, 40, 50]), 65).status, 'not-recovered');
    assert.equal(recoveryAfterNadir(series([65, 45, 66, 30, 40]), 65).minutes, 2);
    assert.equal(recoveryAfterNadir([], 65).status, 'no-data');
});
test('Clampdiagnostik kræver et faktisk datapunkt inden for intervallet', () => {
    assert.equal(hasSampleInRange([1, 2], 3.6, 5.2), false);
    assert.equal(hasSampleInRange([10, 15], 3.6, 5.2), false);
    assert.equal(hasSampleInRange([2, 8], 3.6, 5.2), false);
    assert.equal(hasSampleInRange([3.6, 5.2], 3.6, 5.2), true);
});

for (const dt of [1, 0.5]) for (const tau of [55, 88]) {
    test(`F02 depot bevares over 360 min; dt=${dt}, tau=${tau}`, () => {
        const e = engine(); e.totalSimMinutes = 0;
        e.addRapidInsulin({ units: 10 }); e.activeFastInsulin[0].tauI = tau;
        let absorbed = 0;
        for (let tick = 1; tick <= 1200 / dt; tick++) {
            e.totalSimMinutes = tick * dt;
            e._prepInsulinRates(); e._substepRapidInsulin(dt);
            absorbed += e.hovorka.rapidU_I * dt;
            const depot = e.hovorka.state[S.S1] + e.hovorka.state[S.S2];
            close(absorbed + depot, 7800, 1e-5, 'Effektiv dosis = absorberet + depot [mU]');
            if (tick * dt >= 359 && tick * dt <= 361) {
                assert.ok(depot > 0);
                close(e.bioavScale, 1 / 0.78, 1e-12, 'Visningsskalering er kontinuert');
            }
        }
    });
}
for (const dt of [1, 0.5]) {
    test(`F02 stablede doser, accelereret absorption og oprydning; dt=${dt}`, () => {
        const e = engine(); e.totalSimMinutes = 0;
        let absorbed = 0, delivered = 0;
        for (let tick = 0; tick < 3600 / dt; tick++) {
            e.totalSimMinutes = tick * dt;
            if (tick === 0 || tick === 300 / dt) {
                e.addRapidInsulin({ units: 10 });
                e.activeFastInsulin.at(-1).tauI = tick === 0 ? 88 : 55;
                delivered += 7800;
            }
            e.hovorka.heartRate = tick * dt >= 350 && tick * dt < 410 ? 150 : 60;
            e._prepInsulinRates(); e._substepRapidInsulin(dt);
            absorbed += e.hovorka.rapidU_I * dt;
            const depot = e.hovorka.state[S.S1] + e.hovorka.state[S.S2];
            close(absorbed + depot, delivered, 3e-6, 'Massebalance med højst 10^-6 mU oprydning pr. depot');
        }
        assert.equal(e.activeFastInsulin.length, 0, 'Tomme gamle depoter ryddes stadig op');
    });
}
test('F10 geninitialisering ignorerer restinput fra hurtiginsulin', () => {
    const rates = [0, 3, 10].map(input => {
        const h = new HovorkaModel(70, { insulinSensitivityScale: 3 / 3.75 });
        h.rapidU_I = input; h.initializeSteadyState(10, 5.5);
        assert.equal(h.rapidU_I, 0);
        return h.steadyStateBasalRate;
    });
    rates.forEach(rate => close(rate, rates[0], 1e-12, 'Samme basalrate'));
});
for (const dt of [1, 0.5]) for (const duration of [10, 360, 600]) {
    test(`F11 komplet kulhydratlevering; dt=${dt}, spisetid=${duration}`, () => {
        const e = engine(); e.addFood({ carbs: 60, weight: 60, eatTimeMin: duration });
        let appeared = 0;
        for (let tick = 0; tick < 720 / dt; tick++) {
            e.step(dt); appeared += e.hovorka._lastUG * dt; e.consumeEvents();
        }
        close((appeared + e.hovorka.state[S.D1] + e.hovorka.state[S.D2]) * 0.18016,
            60, 1e-8, 'Kulhydrat i blod og tarm svarer til hele måltidet [g]');
    });
}
for (const dt of [1, 0.5]) {
    test(`F15 forklaring følger Q1-balancen, også motion og glukagon; dt=${dt}`, () => {
        const e = engine();
        e.addFood({ carbs: 40, protein: 20, fat: 20, weight: 180 });
        e.addRapidInsulin({ units: 4 });
        for (let tick = 0; tick < 240 / dt; tick++) {
            if (tick === 60 / dt) e.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 30 });
            if (tick === 120 / dt) e.useGlucagon();
            const before = e.hovorka.state[S.Q1]; e.step(dt);
            const signed = e._computeBGForces().filter(f => f.kind !== 'modifier')
                .reduce((sum, f) => sum + (f.direction === 'up' ? 1 : -1) * f.magnitude, 0);
            close(signed * dt, e.hovorka.state[S.Q1] - before, 1e-9, 'Q1-forklaring [mmol]');
            e.consumeEvents();
        }
        const copy = engine(); copy.importState(e.exportState());
        assert.deepEqual(copy._computeBGForces(), e._computeBGForces(), 'Snapshot bevarer målt flux');
    });
}
test('F15 næsten stationært Q1 giver næsten balancerede pile', () => {
    const e = engine(); e.step(1);
    const net = e._computeBGForces().filter(f => f.kind === 'flux')
        .reduce((sum, f) => sum + (f.direction === 'up' ? 1 : -1) * f.magnitude, 0);
    assert.ok(Math.abs(net) < 0.001, `Nettoflux ved ligevægt: ${net}`);
});
console.log(`${passed}/${passed} review regression tests passed.`);
