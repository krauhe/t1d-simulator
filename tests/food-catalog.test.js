// Kontrollerer snackportioner, næringsberegning og katalogkobling uden browser.
// Kør med tests/.bin/node.exe tests/food-catalog.test.js fra projektroden.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FOODS, foodMacroAmount } = require('../js/foods.js');
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
}
console.log('OK: alle seks portioner accepteres af simulatoren og bevares i Hvad Nu Hvis-historikken.');
