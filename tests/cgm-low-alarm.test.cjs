// Kontrollerer CGM-alarm, opvågning og søvnregnskab. Grænserne beskriver
// spillets sensoradfærd; testene er ikke klinisk validering af en CGM.
const assert = require('node:assert/strict');
const { createEngine } = require('../js/physiology-engine.js');
const { HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');

function engine(minute = 120) {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, {
        seed: 20261025, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0 }
    });
    e.totalSimMinutes = e.timeInMinutes = minute;
    e.initSteadyState();
    e.consumeEvents();
    return e;
}
function sample(e, bg, advance = 5) {
    e.totalSimMinutes += advance;
    e.timeInMinutes = e.totalSimMinutes % 1440;
    e.hovorka.state[S.C] = bg;
    e._sampleCgm();
    return e.consumeEvents();
}
const alarms = events => events.filter(event => event.type === 'cgm-low-alarm');
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }

test('CGM-grænse, rolig lav måling og genaktivering', () => {
    const e = engine(720);
    assert.equal(alarms(sample(e, 4.0)).length, 0);
    assert.equal(alarms(sample(e, 3.9)).length, 1);
    assert.equal(alarms(sample(e, 3.9)).length, 0);
    assert.equal(alarms(sample(e, 4.49)).length, 0);
    assert.equal(alarms(sample(e, 3.9)).length, 0);
    sample(e, 4.5);
    assert.equal(alarms(sample(e, 3.9)).length, 1);
    assert.equal(e.lostSleepHoursTonight, 0);
    assert.equal(e.sleepAwakeIntervals.length, 0);
});
test('Alarm følger CGM, ikke skjult plasma-BG', () => {
    const e = engine(720);
    e.trueBG = 2.8;
    assert.equal(alarms(sample(e, 5.5)).length, 0);
    e.trueBG = 6;
    assert.equal(alarms(sample(e, 3.8)).length, 1);
});
test('Offline, opvarmning og selvtest giver ingen alarm på gamle målinger', () => {
    for (const timer of ['cgmSensorOfflineUntil', 'cgmSensorWarmupUntil', 'cgmSelfTestUntil']) {
        const e = engine(); e[timer] = 200;
        assert.equal(alarms(sample(e, 3.5)).length, 0, timer);
        assert.equal(e.sleepAwakeIntervals.length, 0);
    }
});
for (const dt of [1, 0.5]) test(`Natlig alarm optjener faktisk søvntab, dt=${dt}`, () => {
    const e = engine();
    assert.equal(alarms(sample(e, 3.9)).length, 1);
    assert.equal(e.isNightAwake(), true);
    assert.equal(e.lostSleepHoursTonight, 0);
    // Ét minut efter alarmen spises. Det overlapper den eksisterende
    // vågenperiode og må ikke tilføje en ekstra times søvntab.
    e.totalSimMinutes += 1; e.timeInMinutes += 1;
    e.addFood({ carbs: 3, weight: 3, eatTimeMin: 0.3 });
    assert.equal(e.sleepAwakeIntervals.length, 1);
    const start = e.sleepAwakeIntervals[0].startMin;
    for (let t = start; t < start + 60; t += dt) e._accrueAwakeSleepLoss(t, t + dt);
    assert.ok(Math.abs(e.lostSleepHoursTonight - 1) < 1e-10);
});
test('Alarm ved slutningen af natten tæller kun tiden indtil 07:00', () => {
    const e = engine(414);
    sample(e, 3.9);
    assert.equal(e.nightAwakeUntil, 420);
    e._accrueAwakeSleepLoss(419, 421);
    assert.ok(Math.abs(e.lostSleepHoursTonight - 1 / 60) < 1e-12);
});
test('Snapshot bevarer alarmens episode uden dobbeltalarm', () => {
    const e = engine(); sample(e, 3.9);
    const copy = engine(); copy.importState(e.exportState());
    assert.equal(alarms(sample(copy, 3.8)).length, 0);
    assert.deepEqual(copy.sleepAwakeIntervals, e.sleepAwakeIntervals);
});
test('Ny lav episode vækker også efter en kort, afsluttet opvågning', () => {
    const e = engine();
    e.modules.sleepDisruption = 0.3; // Deterministisk opvågning på 18 minutter.
    sample(e, 3.8); // 02:05 -> vågen til 02:23.
    assert.equal(e.nightAwakeUntil, 143);
    sample(e, 4.6, 20); // 02:25: sover igen; alarm genaktiveres.
    assert.equal(e.isNightAwake(), false);
    assert.equal(alarms(sample(e, 3.8)).length, 1); // 02:30, kun 25 min efter første alarm.
    assert.equal(e.isNightAwake(), true);
    assert.equal(e.sleepAwakeIntervals.length, 2);
});
console.log(`${passed} CGM-alarmchecks passed.`);
