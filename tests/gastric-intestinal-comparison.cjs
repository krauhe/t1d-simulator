// Reproducerbar før/efter-sammenligning af mave/tarm-prototypen mod et Git-checkpoint.
// Baseline indlæses i hukommelsen: ingen checkout, revert eller ændring af appfiler.
// Resultaterne beskriver modelændringer og numerik, aldrig klinisk kalibrering.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const baselineRef = process.argv[2] || 'e4b8494';
const outputDirectory = path.join(root, '.local-artifacts/2026-10-25-gut-implementation');
const profile = { weight: 70, isf: 3, icr: 10 };
const options = { seed: 20261025, noiseEnabled: false, modules: {
  dawn: 0, dawnVariability: 0, insulinVariability: 0,
  cgmSensorFaults: false, sleepDisruption: 0,
} };
const endpointsMin = [15, 30, 60, 120, 240];
const timeStepsMin = [1, 0.5, 0.1];
const horizonMin = 240;
const gramsPerMmol = 0.18016;
const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

// Hver version får sin egen CommonJS-cache og sin egen Hovorka-afhængighed.
// Derved kan require('./hovorka.js') aldrig hente den anden versions model.
function loadVersion(label, ref) {
  const cache = new Map(), sourceHashes = {};
  function load(relativePath) {
    relativePath = path.posix.normalize(relativePath.replaceAll('\\', '/'));
    assert.ok(relativePath.startsWith('js/') && !relativePath.includes('../'));
    if (cache.has(relativePath)) return cache.get(relativePath).exports;
    const source = ref
      ? execFileSync('git', ['show', `${ref}:${relativePath}`], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relativePath), 'utf8');
    sourceHashes[relativePath] = sha256(source);
    const module = { exports: {} };
    cache.set(relativePath, module);
    const localRequire = requested => {
      assert.ok(requested.startsWith('.'), `Uventet afhængighed: ${requested}`);
      return load(path.posix.join(path.posix.dirname(relativePath), requested));
    };
    const wrapper = vm.runInThisContext(`(function(require,module,exports){\n${source}\n})`,
      { filename: `${label}/${relativePath}` });
    wrapper(localRequire, module, module.exports);
    return module.exports;
  }
  return { label, ref, engine: load('js/physiology-engine.js'),
    hovorka: load('js/hovorka.js'), foods: load('js/foods.js'), sourceHashes };
}

// Måltider normaliseres til 30 g KH; sukkerprodukterne til 15 g KH.
// Alle makroer og produktvægten skaleres ens, uden UI-afrunding. Spisetiden
// bevares fra kataloget, ligesom ved samtidige portioner i appen.
const scenarioDefinitions = [
  { id: 'no_food', events: [] },
  { id: 'tablet_15g', events: [{ minute: 0, key: 'druesukker', carbs: 15 }] },
  { id: 'gummy_15g', events: [{ minute: 0, key: 'slik', carbs: 15 }] },
  { id: 'drink_15g', events: [{ minute: 0, key: 'juice', carbs: 15 }] },
  { id: 'fiber_meal_30g', events: [{ minute: 0, key: 'havregryn', carbs: 30 }] },
  { id: 'fat_meal_30g', events: [{ minute: 0, key: 'burger', carbs: 30 }] },
  { id: 'fiber_then_tablet', events: [{ minute: 0, key: 'havregryn', carbs: 30 },
    { minute: 60, key: 'druesukker', carbs: 15 }] },
  { id: 'fat_then_tablet', events: [{ minute: 0, key: 'burger', carbs: 30 },
    { minute: 60, key: 'druesukker', carbs: 15 }] },
];

function resolveScenario(version, definition) {
  return { id: definition.id, events: definition.events.map(event => {
    const food = version.foods.FOODS[event.key];
    assert.ok(food && food.carbs > 0, `Manglende katalogprodukt: ${event.key}`);
    const scale = event.carbs / food.carbs;
    return { ...event, scale, carbType: food.carbType, spec: {
      carbs: event.carbs, protein: food.protein * scale, fat: food.fat * scale,
      weight: food.weight * scale,
      eatTimeMin: food.eatTimeMin ?? version.foods.estimateEatTimeMin(food),
      carbParams: clone(version.foods.CARB_TYPES[food.carbType]),
    } };
  }) };
}

function initialise(version) {
  const engine = version.engine.createEngine(profile, options);
  engine.totalSimMinutes = engine.timeInMinutes = 720;
  engine.initSteadyState({ targetBG: 5.5 });
  engine.setBG(5.5);
  engine.lastCgmCalculationTime = 720;
  engine.consumeEvents();
  const indices = version.hovorka.HOVORKA_STATE_IDX;
  return { snapshot: engine.exportState(),
    insulin: Object.fromEntries(['S1', 'S2', 'I', 'x1', 'x2', 'x3', 'S1b', 'S2b', 'Ib']
      .map(key => [key, engine.hovorka.state[indices[key]]])),
    basalRateMilliUnitsPerMin: engine.hovorkaSteadyStateBasalRate,
    effectiveBasalUnitsPerDay: engine.effectiveBasalRequirement };
}

function run(version, initial, scenario, dt) {
  const engine = version.engine.createEngine(profile, options);
  engine.importState(initial.snapshot);
  const indices = version.hovorka.HOVORKA_STATE_IDX;
  const hasProfileLedger = engine.hovorka.carbPools !== undefined;
  let baselineDeliveredG = 0, baselineAppearedG = 0, maxMassResidualG = 0;
  let acceptedCarbsG = 0;
  const trace = [];
  function mass() {
    const profiles = hasProfileLedger ? Object.entries(engine.hovorka.carbPools).map(([id, pool]) => ({
      id, ...clone(pool), residualG: pool.deliveredGrams - pool.stomachGrams
        - pool.intestinalGrams - pool.appearedGrams,
    })) : null;
    const stomachG = engine.hovorka.state[indices.D1] * gramsPerMmol;
    const intestinalG = engine.hovorka.state[indices.D2] * gramsPerMmol;
    const deliveredG = profiles ? profiles.reduce((sum, p) => sum + p.deliveredGrams, 0) : baselineDeliveredG;
    const appearedG = profiles ? profiles.reduce((sum, p) => sum + p.appearedGrams, 0) : baselineAppearedG;
    const residualG = deliveredG - stomachG - intestinalG - appearedG;
    maxMassResidualG = Math.max(maxMassResidualG, Math.abs(residualG),
      ...(profiles || []).map(p => Math.abs(p.residualG)));
    assert.ok(Math.abs(residualG) < 1e-7, `${version.label}/${scenario.id}: massefejl ${residualG}`);
    assert.ok(stomachG >= -1e-9 && intestinalG >= -1e-9);
    for (const pool of profiles || []) {
      assert.ok(Math.abs(pool.residualG) < 1e-7, `Profilmassefejl: ${pool.id}`);
      assert.ok(pool.stomachGrams >= -1e-9 && pool.intestinalGrams >= -1e-9);
    }
    return { deliveredG, appearedG, stomachG, intestinalG, residualG, profiles };
  }
  // Eventet ved 60 min gives EFTER endpointet ved 60 min: ingen tidligere
  // påvirkning af måltidskurven og samme præcise tidspunkt ved alle tidsstep.
  for (let tick = 0; tick <= Math.round(horizonMin / dt); tick++) {
    const t = Math.round(tick * dt * 1e9) / 1e9;
    const balance = mass();
    assert.ok(Number.isFinite(engine.trueBG) && Number.isFinite(engine.cgmBG));
    trace.push({ t, plasma: engine.trueBG, cgm: engine.cgmBG,
      ...(endpointsMin.includes(t) ? { mass: balance } : {}) });
    if (tick === Math.round(horizonMin / dt)) break;
    for (const event of scenario.events.filter(event => Math.abs(event.minute - t) < 1e-8)) {
      assert.equal(engine.addFood(clone(event.spec)), true, `Afvist forsøgsindtag: ${scenario.id}`);
      acceptedCarbsG += event.spec.carbs;
    }
    engine.step(dt);
    if (!hasProfileLedger) {
      // Den gamle motor har højst 1-minuts Euler-trin. Ved de valgte dt er
      // _lastUG derfor netop fluxen for dette ydre trin; nye deltrin bruger ledgeren.
      baselineDeliveredG += engine.hovorka.carbRate * dt * gramsPerMmol;
      baselineAppearedG += engine.hovorka._lastUG * dt * gramsPerMmol;
    }
    engine.consumeEvents();
  }
  const finalMass = mass();
  assert.ok(Math.abs(finalMass.deliveredG - acceptedCarbsG) < 1e-7,
    `${version.label}/${scenario.id}: ikke alt indtag leveret`);
  return { trace, finalMass, maxMassResidualG, profileLedger: hasProfileLedger,
    expectedCarbsG: acceptedCarbsG };
}

const versions = [loadVersion('before', baselineRef), loadVersion('after', null)];
const initials = versions.map(initialise);
for (const [key, value] of Object.entries(initials[0].insulin)) {
  assert.ok(Math.abs(value - initials[1].insulin[key]) < 1e-10, `Forskellig initial insulin: ${key}`);
}
const results = [];
for (let v = 0; v < versions.length; v++) {
  const version = versions[v], initial = initials[v];
  const scenarios = scenarioDefinitions.map(definition => resolveScenario(version, definition));
  for (const dt of timeStepsMin) {
    const control = run(version, initial, scenarios[0], dt);
    for (const scenario of scenarios) {
      const result = scenario.id === 'no_food' ? control : run(version, initial, scenario, dt);
      const trace = result.trace.map((row, i) => ({ ...row,
        plasmaMinusControl: row.plasma - control.trace[i].plasma,
        cgmMinusControl: row.cgm - control.trace[i].cgm }));
      const peak = field => {
        const row = trace.reduce((best, row) => row[field] > best[field] ? row : best);
        return { value: row[field], minute: row.t, atWindowEnd: row.t === horizonMin };
      };
      results.push({ version: version.label, scenario: scenario.id, dt, inputs: scenario.events,
        endpoints: endpointsMin.map(t => trace[Math.round(t / dt)]),
        peak: Object.fromEntries(['plasma', 'cgm', 'plasmaMinusControl', 'cgmMinusControl'].map(field => [field, peak(field)])),
        finalMass: result.finalMass, maxMassResidualG: result.maxMassResidualG,
        expectedCarbsG: result.expectedCarbsG, profileLedger: result.profileLedger });
    }
  }
}

// Sammenlign fødeeffekter mod hver versions egen kontrol, samt de rå BG-tal.
const comparisons = results.filter(row => row.version === 'after').map(after => {
  const before = results.find(row => row.version === 'before' && row.scenario === after.scenario && row.dt === after.dt);
  return { scenario: after.scenario, dt: after.dt, endpoints: after.endpoints.map((row, i) => ({
    minute: row.t, plasmaAfterMinusBefore: row.plasma - before.endpoints[i].plasma,
    cgmAfterMinusBefore: row.cgm - before.endpoints[i].cgm,
    foodPlasmaEffectAfterMinusBefore: row.plasmaMinusControl - before.endpoints[i].plasmaMinusControl,
    foodCgmEffectAfterMinusBefore: row.cgmMinusControl - before.endpoints[i].cgmMinusControl,
  })) };
});
const numericalSensitivity = results.filter(row => row.dt !== 0.1).map(coarse => {
  const fine = results.find(row => row.version === coarse.version && row.scenario === coarse.scenario && row.dt === 0.1);
  return { version: coarse.version, scenario: coarse.scenario, coarseDt: coarse.dt, referenceDt: 0.1,
    maxEndpointPlasmaDifference: Math.max(...coarse.endpoints.map((row, i) => Math.abs(row.plasma - fine.endpoints[i].plasma))),
    maxEndpointCgmDifference: Math.max(...coarse.endpoints.map((row, i) => Math.abs(row.cgm - fine.endpoints[i].cgm))) };
});
const output = { generatedAt: new Date().toISOString(), classification: 'local_model_comparison_not_clinical_validation',
  baselineRef, setup: { profile, options, startBG: 5.5, startMinute: 720, horizonMin, endpointsMin, timeStepsMin },
  versions: versions.map((version, i) => ({ label: version.label, ref: version.ref,
    sourceHashes: version.sourceHashes, initial: { ...initials[i], snapshot: undefined } })),
  notes: ['Ingen bolus eller motion; sukker 15 g KH, havregryn og burger hver 30 g KH.',
    'Alle katalogmakroer/vægt skaleres med KH, spisetiden bevares. Ingen UI-afrunding.',
    'Før/efter omfatter både arkitekturændring og ændret integrationsmetode; ændringen er ikke ren parameterfølsomhed.',
    'Peak er maksimum inden for 240 minutter; atWindowEnd viser et uafsluttet observationsvindue.',
    'Masse er glukoseækvivalent modelbogføring med A_G=1, ikke målt intestinal absorption.',
    'Baseline har ingen profilledger; total masse testes, men profilidentitet kan ikke rekonstrueres.'],
  results, comparisons, numericalSensitivity };
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'comparison.json'), JSON.stringify(output, null, 2) + '\n');
const number = value => value.toFixed(3);
const lines = ['# Lokal før/efter-sammenligning af mave/tarm', '', `Baseline: ${baselineRef}. Genereret: ${output.generatedAt}.`, '',
  ...output.notes.map((note, i) => `${i + 1}. ${note}`), '',
  '## Endpoints ved dt = 0,1 minut', '',
  'Tallene er ændring i fødeeffekt (efter minus før), hvor hver model har sin egen ingen-mad-kontrol. Enhed: mmol/L.', '',
  '| Scenarie | 15 min plasma/CGM | 30 min | 60 min | 120 min | 240 min |',
  '|---|---:|---:|---:|---:|---:|'];
for (const row of comparisons.filter(row => row.dt === 0.1)) lines.push(`| ${row.scenario} | ${row.endpoints.map(p => `${number(p.foodPlasmaEffectAfterMinusBefore)} / ${number(p.foodCgmEffectAfterMinusBefore)}`).join(' | ')} |`);
lines.push('', '## Maksimal fødeeffekt inden for observationsvinduet ved dt = 0,1 minut', '',
  '| Scenarie | Før plasma (min) | Efter plasma (min) | Før CGM (min) | Efter CGM (min) |', '|---|---:|---:|---:|---:|');
const peakText = peak => `${number(peak.value)} (${peak.minute}${peak.atWindowEnd ? '; vinduets slutning' : ''})`;
for (const after of results.filter(row => row.version === 'after' && row.dt === 0.1)) {
  const before = results.find(row => row.version === 'before' && row.scenario === after.scenario && row.dt === 0.1);
  lines.push(`| ${after.scenario} | ${peakText(before.peak.plasmaMinusControl)} | ${peakText(after.peak.plasmaMinusControl)} | ${peakText(before.peak.cgmMinusControl)} | ${peakText(after.peak.cgmMinusControl)} |`);
}
lines.push('', '## Kontroller', '',
  `1. ${results.length} modelarme; massebalance og fuld levering bestod i alle arme.`,
  `2. Største absolutte masserest: ${Math.max(...results.map(r => r.maxMassResidualG)).toExponential(3)} g.`,
  '3. Samme initiale insulin/action-stater i begge versioner. JSON indeholder source-hashes, resolved inputs, alle dt, endpoints, profilmasse og numerisk følsomhed.',
  '4. Sammenligningen er ikke klinisk validering. Arvede startparametre er ikke estimeret fra disse kurver.', '');
fs.writeFileSync(path.join(outputDirectory, 'comparison.md'), lines.join('\n'));
console.log(JSON.stringify({ results: results.length, outputDirectory,
  maxMassResidualG: Math.max(...results.map(r => r.maxMassResidualG)), comparisons: comparisons.filter(row => row.dt === 0.1) }, null, 2));
