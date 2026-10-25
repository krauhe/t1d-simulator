// Kontrollerer snackportioner, næringsberegning og katalogkobling uden browser.
// Glukose/sukrose/bamser har adskilte identiteter, men ingen opdigtet hastighedsbonus.
// Custom-kontrollerne skal sende gram én gang og bruge de samme madprofiler.
// Kør med tests/.bin/node.exe tests/food-catalog.test.js fra projektroden.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FOODS, CARB_TYPES, foodMacroAmount, resolveCustomFoodSpec } = require('../js/foods.js');
const order = ['druesukker', 'slik', 'chokolade', 'juice', 'banan', 'caffeLatte'];
assert.deepEqual(Object.keys(FOODS).slice(-6), order);
assert.equal(FOODS.cola, undefined);
const expected = {
    druesukker: [3, 3, 0, 0], slik: [6, 4.6, 0.4, 0],
    chokolade: [6, 3.2, 0.5, 1.9], juice: [250, 24, 1.5, 0.5],
    banan: [120, 23.6, 1.3, 0.2], caffeLatte: [230, 9.4, 7, 3]
};
for (const key of order) {
    const food = FOODS[key];
    assert.deepEqual([food.weight, food.carbs, food.protein, food.fat], expected[key], key);
    assert(food.carbs + food.protein + food.fat <= food.weight, key + ': makroer kan ikke veje mere end portionen');
    for (const macro of ['carbs', 'protein', 'fat']) {
        assert.equal(foodMacroAmount(food, macro), food[macro], key + ': bevar decimaler');
    }
    assert(fs.existsSync(path.join(__dirname, '..', food.icon)), key + ': ikon findes');
}
for (const key of ['slik', 'chokolade']) assert.equal(FOODS[key].childScale, 1);
// Opskriftens makroer: 200 g letmælk; espressoens sporbidrag er udeladt.
assert.equal(FOODS.caffeLatte.carbs, 2 * 4.7);
assert.equal(FOODS.caffeLatte.protein, 2 * 3.5);
assert.equal(FOODS.caffeLatte.fat, 2 * 1.5);
assert.equal(foodMacroAmount(FOODS.juice, 'protein', .6), .9);
// Uændrede måltider skal beholde deres hidtidige afrunding.
assert.equal(foodMacroAmount(FOODS.burger, 'carbs', .55), 22);
for (const file of ['index.html', 'mobile/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const actual = [...html.matchAll(/data-food="([^"]+)"/g)].map(match => match[1]).filter(key => order.includes(key));
    assert.deepEqual(actual, order, file);
    assert(!html.includes('data-food="cola"'), file);
}
console.log('OK: snackrækkefølge, 6 g portioner, makroer, latteopskrift, decimaler og ikonreferencer.');

// Profilerne er gyldige for motoren og kan ikke forveksles ved aggregering.
const profileIds = new Set();
for (const [type, profile] of Object.entries(CARB_TYPES)) {
    assert(Number.isFinite(profile.appearanceTauMin) && profile.appearanceTauMin > 0, type);
    assert(typeof profile.appearanceProfileId === 'string' && profile.appearanceProfileId.length > 0, type);
    assert(!profileIds.has(profile.appearanceProfileId), type + ': profilidentitet skal være entydig');
    profileIds.add(profile.appearanceProfileId);
    assert(profile.sugarIdentity && profile.physicalForm, type + ': kemi og fysisk form er særskilte');
}
assert.equal(CARB_TYPES[FOODS.druesukker.carbType].sugarIdentity, 'glucose');
assert.equal(CARB_TYPES[FOODS.slik.carbType].sugarIdentity, 'mixed-sugars');
assert.equal(CARB_TYPES.sukrose.sugarIdentity, 'sucrose');
assert.notEqual(FOODS.druesukker.carbType, FOODS.slik.carbType);
assert.equal(CARB_TYPES.druesukker.appearanceTauMin, CARB_TYPES.vingummi.appearanceTauMin,
    'Den foreløbige strukturelle revision må ikke opfinde en glukosebonus');

// En ren sukkeropskrift må ikke få skjult ekstra vand. Valget ændrer hverken
// gram eller kalorier; blandet mad bruger den dokumenterede vægtheuristik.
for (const type of ['druesukker', 'sukrose']) {
    const custom = resolveCustomFoodSpec(15, 0, 0, type);
    assert.equal(custom.carbs, 15);
    assert.equal(custom.weight, 15);
    assert.equal(custom.carbType, type);
    assert(Number.isFinite(custom.eatTimeMin) && custom.eatTimeMin > 0);
}
assert.equal(resolveCustomFoodSpec(15, 10, 5, 'druesukker').weight, 52.5);
assert.throws(() => resolveCustomFoodSpec(15, 0, 0, 'unknown'), RangeError);
assert.throws(() => resolveCustomFoodSpec(NaN, 0, 0, 'druesukker'), RangeError);

const desktopHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const customTypes = [...desktopHtml.matchAll(/data-carb-type="([^"]+)"/g)].map(match => match[1]);
assert(customTypes.includes('druesukker') && customTypes.includes('sukrose'));
assert(!customTypes.includes('vingummi'), 'Produktprofilen for bamser er ikke et falsk rent sukkervalg');
assert(!customTypes.includes('sukker_fast'), 'Det gamle tvetydige custom-valg er erstattet');
for (const type of customTypes) assert(CARB_TYPES[type], type + ': UI-profil findes');
console.log('OK: særskilte sukkeridentiteter, neutrale startprofiler og custom-mængder.');
// Kontroller også den rigtige simulatorgrænse og Hvad Nu Hvis-historik,
// så decimalerne ikke kun overlever UI-testens opsamling af argumenter.
const { Simulator } = require('./harness.js');
for (const key of order) {
    const sim = new Simulator();
    const f = FOODS[key];
    assert.equal(sim.addFood(f.carbs, f.protein, f.fat, f.icon, f.weight, f.carbType, f.eatTimeMin), true);
    const event = sim.scenarioLog.at(-1);
    assert.deepEqual([event.carbs, event.protein, event.fat, event.weight], [f.carbs, f.protein, f.fat, f.weight]);
    assert.equal(event.icon, f.icon);
    assert.equal(event.carbType, f.carbType, key + ': replay bevarer kulhydratprofilen');
}
console.log('OK: alle seks portioner accepteres af simulatoren og bevares i Hvad Nu Hvis-historikken.');
