// =============================================================================
// TIP-PACING.TEST.JS - regressionstest af tiprytme og trængselsbegrænsning
// =============================================================================
//
// Testen kører den faktiske fælles tipmotor i en isoleret JavaScript-kontekst.
// Den kontrollerer, at almindelige tips får afstand i virkelig tid, at kun én
// 15%-lodtrækning foretages, når ét tip allerede er synligt, og at akutte tips
// altid kan bryde igennem.
//
// Kør fra projektroden:
//   tests/.bin/node.exe tests/tip-pacing.test.js
// =============================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'js', 'campaign-core.js'), 'utf8');

let nowMs = 10000;
let randomValue = 0.5;
let randomCalls = 0;
const controlledMath = Object.create(Math);
controlledMath.random = () => {
    randomCalls++;
    return randomValue;
};

const context = vm.createContext({
    console,
    Date,
    Math: controlledMath,
    performance: { now: () => nowMs },
    setTimeout,
    clearTimeout,
});

vm.runInContext(
    `${source}\nthis.__tipPacingTest = { tipSessionState, _tipPassesCrowdingGate };`,
    context,
    { filename: 'js/campaign-core.js' }
);

const { tipSessionState, _tipPassesCrowdingGate } = context.__tipPacingTest;
const ordinaryTip = { id: 'ordinary', priority: 2 };
const urgentTip = { id: 'urgent', priority: 1 };

function visibleTip(id, createdAt) {
    return { id, createdAt, isGameTip: true };
}

tipSessionState._lastAnyTipShownRealMs = -Infinity;
tipSessionState._crowdingRollSignature = null;
assert.strictEqual(
    _tipPassesCrowdingGate(ordinaryTip, { graphMessages: [] }),
    true,
    'Første almindelige tip skal kunne vises på en tom graf'
);

tipSessionState._lastAnyTipShownRealMs = 7000;
nowMs = 12000;
assert.strictEqual(
    _tipPassesCrowdingGate(ordinaryTip, { graphMessages: [] }),
    false,
    'Almindelige tips skal have mindst 6 sekunders afstand i virkelig tid'
);

nowMs = 14000;
randomValue = 0.14;
randomCalls = 0;
const oneVisible = { graphMessages: [visibleTip('first', 600)] };
assert.strictEqual(
    _tipPassesCrowdingGate(ordinaryTip, oneVisible),
    true,
    'Et andet tip skal kunne bestå 15%-lodtrækningen'
);
assert.strictEqual(randomCalls, 1, 'Der må kun foretages én trængselslodtrækning');
assert.strictEqual(
    _tipPassesCrowdingGate(ordinaryTip, oneVisible),
    false,
    'Samme synlige tilstand må ikke udløse en ny lodtrækning ved næste billede'
);
assert.strictEqual(randomCalls, 1, 'Gentagne billeder må ikke øge den reelle chance');

tipSessionState._crowdingRollSignature = null;
assert.strictEqual(
    _tipPassesCrowdingGate(ordinaryTip, {
        graphMessages: [visibleTip('first', 600), visibleTip('second', 620)],
    }),
    false,
    'To synlige tips skal blokere flere almindelige tips'
);

assert.strictEqual(
    _tipPassesCrowdingGate(urgentTip, {
        graphMessages: [visibleTip('first', 600), visibleTip('second', 620)],
    }),
    true,
    'Akutte tips skal kunne bryde igennem trængselsbegrænsningen'
);

console.log('PASS: tiprytmen bestod 6/6 trængselskontroller');
