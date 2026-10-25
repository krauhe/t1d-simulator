// Afgrænset kontrol af adskilt mavetransport og profilbundet systemisk tilførsel.
// Analytiske mål og massebalancer er matematiske tests, ikke klinisk kalibrering.
// Testparametrene nedenfor er valgte kontrolværdier, ikke målte sukkerhastigheder.
const assert = require('node:assert/strict');
const { HovorkaModel, HOVORKA_STATE_IDX: S } = require('../js/hovorka.js');
const { createEngine } = require('../js/physiology-engine.js');
const { resolveCustomFoodSpec } = require('../js/foods.js');
const gramsPerMmol = 0.18016;
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
function close(a, b, eps = 1e-9, why = '') {
    assert.ok(Number.isFinite(a) && Math.abs(a - b) <= eps, `${why}: ${a} != ${b}, tolerance ${eps}`);
}
function core() {
    const h = new HovorkaModel(70);
    h.clearCarbohydrates(); h.tauGastric = 25; h.splanchnicAbsorbMod = 1;
    return h;
}
function pool(h, id, s, i, tau) {
    h.carbPools[id] = { stomachGrams: s, intestinalGrams: i,
        appearanceTauMin: tau, deliveredGrams: s + i, appearedGrams: 0 };
    h.syncCarbohydrateViews();
}
function mass(h) {
    for (const [id, p] of Object.entries(h.carbPools)) {
        close(p.stomachGrams + p.intestinalGrams + p.appearedGrams, p.deliveredGrams, 1e-8, id);
        assert.ok(p.stomachGrams >= 0 && p.intestinalGrams >= 0 && p.appearedGrams >= 0);
    }
}
function engine() {
    const e = createEngine({ weight: 70, isf: 3, icr: 10 }, { seed: 20261025, noiseEnabled: false,
        modules: { dawn: 0, dawnVariability: 0, insulinVariability: 0, sleepDisruption: 0, cgmSensorFaults: false } });
    e.totalSimMinutes = e.timeInMinutes = 720;
    e.initSteadyState(); e.consumeEvents(); return e;
}
function food(id, tau = 25, carbs = 15, eatTimeMin = 0.3, extra = {}) {
    return { carbs, protein: 0, fat: 0, weight: carbs, eatTimeMin,
        carbParams: { simpleFraction: 1, fiberPerGram: 0, retentionFactor: 1,
            appearanceProfileId: id, appearanceTauMin: tau, sugarIdentity: 'glucose', physicalForm: 'solid' }, ...extra };
}
function advance(e, duration, dt) {
    const end = e.totalSimMinutes + duration;
    while (e.totalSimMinutes < end - 1e-9) e.step(Math.min(dt, end - e.totalSimMinutes));
}

test('Lidt fedt eller protein i custom sukker giver ingen diskontinuert vægtændring', () => {
    for (const type of ['druesukker', 'sukrose']) {
        close(resolveCustomFoodSpec(15, 0, 0, type).weight, 15);
        close(resolveCustomFoodSpec(15, 0.0001, 0, type).weight, 15.00025);
        close(resolveCustomFoodSpec(15, 0, 0.0001, type).weight, 15.00025);
    }
});
test('To lige tidskonstanter følger den analytiske impulsrespons', () => {
    const h = core(); pool(h, 'glucose', 15, 0, 25);
    const t = 40;
    const systemic = h.advanceCarbohydrates(t);
    const p = h.carbPools.glucose;
    close(p.stomachGrams, 15 * Math.exp(-t / 25));
    close(p.intestinalGrams, 15 * t / 25 * Math.exp(-t / 25));
    close(systemic * t * gramsPerMmol, p.appearedGrams);
    mass(h);
});
test('Konstant indtag følger analytisk løsning, også næsten ens tidskonstanter', () => {
    for (const tau of [25, 25.00000001, 40]) {
        const h = core(); h.carbIntakeRates = [{ profileId: 'sugar', appearanceTauMin: tau, gramsPerMinute: 2 }];
        const t = 10, k = 1 / 25, l = 1 / tau;
        h.advanceCarbohydrates(t);
        const expectedS = 2 / k * (1 - Math.exp(-k * t));
        const expectedI = tau === 40
            ? 2 * ((1 - Math.exp(-l * t)) / l - (Math.exp(-k * t) - Math.exp(-l * t)) / (l - k))
            : 2 * ((1 - Math.exp(-k * t)) / k - t * Math.exp(-k * t));
        close(h.carbPools.sugar.stomachGrams, expectedS);
        close(h.carbPools.sugar.intestinalGrams, expectedI, 1e-8);
        mass(h);
    }
});
test('Eksakt puljeløsning er uafhængig af trin ved konstante koefficienter', () => {
    const results = [1, 0.5, 0.1].map(dt => {
        const h = core(); pool(h, 'glucose', 15, 2, 25); pool(h, 'mixed', 7, 4, 47);
        for (let t = 0; t < 20 - 1e-9; t += dt) h.advanceCarbohydrates(dt);
        mass(h); return h.carbPools;
    });
    for (const actual of results.slice(1)) for (const id of Object.keys(actual))
        for (const field of ['stomachGrams', 'intestinalGrams', 'appearedGrams']) close(actual[id][field], results[0][id][field]);
});
test('Gastrisk ændring påvirker ikke eksisterende tarmindhold uden nyt gastrisk input', () => {
    const a = core(), b = core(); pool(a, 'glucose', 0, 15, 25); pool(b, 'glucose', 0, 15, 25);
    a.tauGastric = 10; b.tauGastric = 100;
    close(a.advanceCarbohydrates(1), b.advanceCarbohydrates(1));
    close(a.carbPools.glucose.intestinalGrams, b.carbPools.glucose.intestinalGrams);
});
test('Forskellige tarmprofiler bevares ved fælles mavetømning', () => {
    const h = core(); pool(h, 'a', 10, 5, 20); pool(h, 'b', 10, 5, 40);
    h.advanceCarbohydrates(5);
    close(h.carbPools.a.stomachGrams, h.carbPools.b.stomachGrams);
    assert.ok(h.carbPools.a.appearedGrams > h.carbPools.b.appearedGrams);
    mass(h);
});
test('Nul downstream-rate bevarer alt i mave og tarm; A_G anvendes kun én gang', () => {
    const h = core(); pool(h, 'a', 10, 5, 25); h.splanchnicAbsorbMod = 0;
    close(h.advanceCarbohydrates(5), 0); mass(h);
    close(h.carbsOnBoard, 15);
    h.splanchnicAbsorbMod = 1; h.A_G = 0.8;
    const before = h.carbPools.a.appearedGrams;
    const u = h.advanceCarbohydrates(5);
    close(u * 5 * gramsPerMmol, (h.carbPools.a.appearedGrams - before) * 0.8);
    mass(h);
});
test('Stive, store og meget små kontroltrin mister ikke masse', () => {
    for (const dt of [1e-6, 0.1, 10, 1000]) {
        const h = core(); h.tauGastric = 0.1;
        pool(h, 'fast', 15, 7, 0.2); h.advanceCarbohydrates(dt); mass(h);
    }
});
test('Ugyldige rater og ændret profilparameter afvises', () => {
    for (const tau of [0, -1, NaN, Infinity]) {
        const h = core(); h.carbIntakeRates = [{ profileId: 'a', appearanceTauMin: tau, gramsPerMinute: 1 }];
        assert.throws(() => h.advanceCarbohydrates(1));
    }
    const h = core(); pool(h, 'a', 1, 1, 25);
    h.carbIntakeRates = [{ profileId: 'a', appearanceTauMin: 30, gramsPerMinute: 1 }];
    assert.throws(() => h.advanceCarbohydrates(1));
});

for (const dt of [1, 0.5, 0.1]) test(`Kort spisetid, sidste rest og fælles fysisk mave, dt=${dt}`, () => {
    const e = engine();
    e.addFood(food('glucose', 25, 15, 0.30001));
    close(e.hovorka.carbsOnBoard, 0);
    advance(e, 1, dt);
    close(e.hovorka.carbPools.glucose.deliveredGrams, 15);
    assert.equal(e.activeIntake.length, 0);
    for (let t = 0; t < 20; t++) {
        advance(e, 1, dt); mass(e.hovorka);
        close(e.stomachCarbsTotal, Object.values(e.hovorka.carbPools).reduce((s, p) => s + p.stomachGrams, 0));
        close(e.stomachContentGrams, e.stomachCarbsTotal, 1e-8, 'Rent sukker har samme masse som fysisk maveindhold');
    }
});
test('Overlappende måltider og midt-indtag snapshot fortsætter identisk i frisk motor', () => {
    const a = engine(); a.addFood(food('glucose', 25, 15, 3));
    a.step(0.1); a.addFood(food('mixed', 45, 20, 8, { protein: 10, fat: 15, weight: 100 }));
    a.step(0.2);
    const snapshot = a.exportState(); assert.equal(snapshot.version, 3);
    const b = engine(); b.importState(snapshot);
    assert.deepEqual(b.hovorka.carbPools, a.hovorka.carbPools);
    advance(a, 60, 0.5); advance(b, 60, 0.5);
    assert.deepEqual(b.hovorka.carbPools, a.hovorka.carbPools);
    close(a.trueBG, b.trueBG, 1e-12); close(a.stomachContentGrams, b.stomachContentGrams);
    assert.equal(a.rng(), b.rng()); mass(a.hovorka);
    close(a.hovorka.carbPools.glucose.deliveredGrams, 15);
    close(a.hovorka.carbPools.mixed.deliveredGrams, 20);
});
test('Afvist mad er atomisk, og core-reset rydder puljer og visninger', () => {
    const e = engine(); e.stomachFull = true;
    const before = e.exportState(); assert.equal(e.addFood(food('glucose')), false);
    close(e.totalKcalConsumed, before.state.totalKcalConsumed);
    assert.equal(e.activeIntake.length, 0); assert.deepEqual(e.hovorka.carbPools, {});
    const h = core(); pool(h, 'a', 10, 4, 25); h.clearCarbohydrates();
    assert.deepEqual(h.carbPools, {}); assert.deepEqual(h.carbIntakeRates, []);
    close(h.state[S.D1], 0); close(h.state[S.D2], 0); close(h.carbsOnBoard, 0);
});
console.log(`${passed} gastric/intestinal mechanism checks passed.`);
