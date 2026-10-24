// Mekanisme- og invarianttests for kontraktionsoptaget revideret 2026-10-04.
// Disse kontroller validerer regnskab, ablation og kontinuitet, ikke kliniske
// amplituder. Litteraturprotokoller findes separat i activity-validation.js.
const assert = require('node:assert/strict');
const { HovorkaModel, HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');
const { createEngine } = require('../js/physiology-engine.js');
const { attachCandidate } = require('./experiments/exercise-balance.cjs');
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function close(a, b, tolerance = 1e-10) {
    assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}; tolerance ${tolerance}`);
}
function balanceStep(h, dt) {
    const q1 = h.state[S.Q1], q2 = h.state[S.Q2];
    h.step(dt);
    const expected = dt * (h._lastUG + h._lastEGP - h._lastF01c -
        h._lastFR - h._lastDisposal - h._lastContraction);
    close(h.state[S.Q1] + h.state[S.Q2] - q1 - q2, expected);
    assert.ok(h.state[S.Q1] >= 0 && h.state[S.Q2] >= 0);
    assert.ok(dt * (h._lastF01c + h._lastFR + h._lastTransport + h._lastContraction) <= q1 + 1e-10);
    assert.ok(dt * (h._lastReturn + h._lastDisposal) <= q2 + 1e-10);
}
function engine() {
    return createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20261004, steadyState: true, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0,
            sleepDisruption: 0, cgmSensorFaults: false }
    });
}
for (const dt of [1, 0.5, 0.1]) {
    test(`Insulin-uafhængigt optag med Q2=0; dt=${dt}`, () => {
        const h = new HovorkaModel(70);
        h.state.fill(0); h.state[S.Q1] = 5.5 * h.V_G; h.state[S.E1] = 1;
        balanceStep(h, dt);
        close(h._lastContraction, h.beta);
        close(h._lastTransport, 0); close(h.state[S.Q2], 0);
    });
    test(`Pool-budget og massebalance ved ekstreme states; dt=${dt}`, () => {
        for (const glucose of [0, 0.001, 1, 5.5, 20]) for (const action of [0, 0.02, 10]) {
            const h = new HovorkaModel(70);
            h.state[S.Q1] = glucose * h.V_G; h.state[S.Q2] = 0.001;
            h.state[S.x1] = h.state[S.x2] = action; h.state[S.E1] = 10;
            balanceStep(h, dt);
            if (glucose === 0) close(h._lastContraction, 0);
        }
    });
    test(`120 minutters massebalance med og uden insulin; dt=${dt}`, () => {
        for (const insulin of [0, 10]) {
            const h = new HovorkaModel(70);
            if (insulin) h.initializeSteadyState(insulin, 5.5);
            else { h.state.fill(0); h.state[S.Q1] = 5.5 * h.V_G; }
            for (let tick = 0; tick < 120 / dt; tick++) {
                h.exerciseInput = tick * dt < 60 ? 1 : 0;
                balanceStep(h, dt);
            }
        }
    });
    test(`Ablation uden kontraktion matcher før-revisionens hvileligninger; dt=${dt}`, () => {
        const h = new HovorkaModel(70); h.initializeSteadyState(10, 5.5);
        const old = new HovorkaModel(70); old.initializeSteadyState(10, 5.5);
        attachCandidate(old, 'current');
        for (let tick = 0; tick < 10 / dt; tick++) { h.step(dt); old.step(dt); }
        h.state.forEach((value, i) => close(value, old.state[i]));
        close(h._lastContraction, 0);
    });
}
test('Vægtskalering af faktisk optag ved referenceglukose', () => {
    for (const weight of [40, 70, 100]) {
        const h = new HovorkaModel(weight);
        h.state.fill(0); h.state[S.Q1] = 5.5 * h.V_G; h.state[S.E1] = 1;
        h.step(0.5); close(h._lastContraction / weight, 0.78 / 70);
    }
});
for (const dt of [1, 0.5]) {
    test(`Start ændrer stimulus uden et øjeblikkeligt E1-spring; dt=${dt}`, () => {
        const e = engine(), before = [...e.hovorka.state];
        e.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: 10 });
        e.hovorka.state.forEach((value, i) => close(value, before[i]));
        e.step(dt); e.consumeEvents();
        close(e.hovorka._lastContraction, 0); // Euler bruger startværdien E1=0.
        assert.ok(e.hovorka.state[S.E1] > 0);
        e.step(dt); e.consumeEvents();
        assert.ok(e.hovorka._lastContraction > 0);
    });
}
for (const dt of [1, 0.5]) for (const automatic of [false, true]) {
    test(`${automatic ? 'Automatisk' : 'Manuelt'} stop bevarer E1 og fortsat optag; dt=${dt}`, () => {
        const e = engine();
        e.startActivity({ type: 'cardio', intensity: 'Medium', durationMin: automatic ? 10 : null });
        for (let tick = 0; tick < 10 / dt; tick++) {
            e.step(dt); e.consumeEvents();
            close(e.q1Fluxes.numerical, 0);
            close(e.q1Fluxes.contraction, e.hovorka._lastContraction);
        }
        const stateAtStop = e.hovorka.state[S.E1];
        assert.ok(stateAtStop > 0);
        if (!automatic) { e.stopActivity(); close(e.hovorka.state[S.E1], stateAtStop); }
        assert.equal(e.activeAktivitet, null);
        const glucoseAtStop = e.hovorka.state[S.Q1] / e.hovorka.V_G;
        e.step(dt); e.consumeEvents();
        close(e.hovorka._lastContraction, e.hovorka.beta * stateAtStop * glucoseAtStop / 5.5);
        assert.ok(e.hovorka.state[S.E1] < stateAtStop && e.hovorka._lastContraction > 0);
        const force = e._computeBGForces().find(f => f.name === 'exerciseUptake');
        assert.equal(force.kind, 'flux');
        close(force.magnitude, e.q1Fluxes.contraction);
    });
}
test('Tidsstep-konvergens i isoleret kontraktionsforløb', () => {
    function run(dt) {
        const h = new HovorkaModel(70); h.initializeSteadyState(10, 5.5);
        for (let tick = 0; tick < 60 / dt; tick++) { h.exerciseInput = 1; h.step(dt); }
        return h.state[S.Q1] / h.V_G;
    }
    const reference = run(0.1), error1 = Math.abs(run(1) - reference), errorHalf = Math.abs(run(0.5) - reference);
    assert.ok(errorHalf < error1 && error1 < 0.1, `${error1}, ${errorHalf}`);
});
console.log(`${passed}/${passed} exercise conservation tests passed`);
