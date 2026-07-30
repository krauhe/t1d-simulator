// =============================================================================
// TIP-BOLUS-TIMING.TEST.JS - regressionstest af måltidstip om manglende bolus
// =============================================================================
//
// Tippet må ikke hævde, at et måltid blev givet uden bolus, når hurtig insulin
// ligger tæt på måltidet. Testen kører den faktiske betingelse fra
// campaign-core.js og dækker både insulin før og efter måltidet samt sukker ved
// lavt blodsukker, hvor fravær af bolus ikke skal udløse et behandlingstip.
//
// Kør fra projektroden:
//   tests/.bin/node.exe tests/tip-bolus-timing.test.js
// =============================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const campaignCoreSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'campaign-core.js'),
    'utf8'
);

const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(
    `${campaignCoreSource}\nthis.__tipTimingTest = { _tipEvaluateCondition };`,
    context,
    { filename: 'js/campaign-core.js' }
);

const evaluateCondition = context.__tipTimingTest._tipEvaluateCondition;

function noRecentBolus(logHistory, totalSimMinutes = 600, cgmBG = 7.0) {
    return evaluateCondition('noRecentBolus', {
        logHistory,
        totalSimMinutes,
        cgmBG,
    }, {});
}

const meal = { type: 'food', time: 600 };

assert.strictEqual(
    noRecentBolus([
        { type: 'insulin-fast', time: 545 },
        { type: 'insulin-fast', time: 575 },
        meal,
    ]),
    false,
    'To boluser før måltidet skal undertrykke tippet'
);

assert.strictEqual(
    noRecentBolus([{ type: 'insulin-fast', time: 540 }, meal]),
    false,
    'Bolus præcis 60 minutter før måltidet skal tælle med'
);

assert.strictEqual(
    noRecentBolus([meal, { type: 'insulin-fast', time: 630 }], 630),
    false,
    'Bolus efter måltidet skal undertrykke tippet inden for vinduet'
);

assert.strictEqual(
    noRecentBolus([{ type: 'insulin-fast', time: 539 }, meal]),
    true,
    'En bolus uden for måltidsvinduet skal ikke skjule tippet'
);

assert.strictEqual(
    noRecentBolus([meal]),
    true,
    'Et måltid uden nærliggende bolus skal fortsat kunne udløse tippet'
);

assert.strictEqual(
    noRecentBolus([meal], 600, 4.2),
    false,
    'Sukker ved lavt blodsukker må ikke udløse et manglende-bolus-tip'
);

console.log('PASS: manglende-bolus-tippet bestod 6/6 timingkontroller');
