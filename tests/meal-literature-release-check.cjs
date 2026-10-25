// Afgrænset litteraturorienteret måltidskontrol før udgivelse.
// Sammenligner fire Smart-lignende måltider i gammel og ny motor uden checkout.
// Retningstargets er fra originalens protokol/resultater; ingen kliniske
// talintervaller opfindes. En retningstest er ikke et fit eller klinisk validering.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const baselineRef = process.argv[2] || 'e4b8494';
const out = path.join(root, '.local-artifacts/2026-10-25-release-meal-check');
const clone = x => JSON.parse(JSON.stringify(x));

// Fastlagt før resultaterne: Smart 2013, original HTML, Methods og Results.
// Bolus 10 min før mad, 20 min indtag, 5 timer CGM. Grænserne er tidspunkter
// fra originalen, ikke opfundne størrelsestolerancer for en virtuel deltager.
const targets = [
  { id: 'protein_late', comparison: 'LFHP-LFLP', minute: 180, direction: 'positive' },
  { id: 'fat_late', comparison: 'HFLP-LFLP', minute: 210, direction: 'positive' },
  { id: 'combined_late', comparison: 'HFHP-max(other meals)', minutes: [180, 210, 240, 270, 300], direction: 'positive' },
  { id: 'fat_early', comparison: 'HFLP-LFLP', interval: [0, 90], direction: 'negative glucose excursion area' },
  { id: 'combined_peak', comparison: 'HFHP-LFLP peak time', direction: 'later' },
];
const meals = [
  { id: 'LFLP', carbs: 30, fat: 4, protein: 5 },
  { id: 'LFHP', carbs: 30, fat: 4, protein: 40 },
  { id: 'HFLP', carbs: 30, fat: 35, protein: 5 },
  { id: 'HFHP', carbs: 30, fat: 35, protein: 40 },
];
const profiles = [
  { id: 'adult_reference', weight: 70, isf: 3, icr: 10, portion: 1 },
  { id: 'smaller_reference', weight: 40, isf: 5, icr: 16.6666666667, portion: 0.75 },
];
const options = { seed: 20261025, noiseEnabled: false, modules: {
  dawn: 0, dawnVariability: 0, insulinVariability: 0, cgmSensorFaults: false, sleepDisruption: 0,
} };
function loadVersion(label, ref) {
  const cache = new Map(), hashes = {};
  function load(file) {
    file = path.posix.normalize(file);
    assert.ok(file.startsWith('js/') && !file.includes('../'));
    if (cache.has(file)) return cache.get(file).exports;
    const source = ref ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8');
    hashes[file] = crypto.createHash('sha256').update(source).digest('hex');
    const module = { exports: {} }; cache.set(file, module);
    vm.runInThisContext(`(function(require,module,exports){\n${source}\n})`, { filename: `${label}/${file}` })(
      request => { assert.ok(request.startsWith('.')); return load(path.posix.join(path.posix.dirname(file), request)); }, module, module.exports);
    return module.exports;
  }
  return { label, ref, engine: load('js/physiology-engine.js'), foods: load('js/foods.js'), hashes };
}
function run(version, profile, meal, dt, startBG, carbType) {
  const engine = version.engine.createEngine(profile, options);
  engine.totalSimMinutes = engine.timeInMinutes = 470; // Kl. 07:50: bolus, mad kl. 08:00.
  engine.initSteadyState({ targetBG: startBG });
  engine.setBG(startBG);
  engine.lastCgmCalculationTime = 470;
  const dose = meal.carbs * profile.portion / profile.icr;
  engine.addRapidInsulin({ units: dose });
  let premeal = null, firstHypoMin = null;
  const trace = [];
  const ticks = Math.round(310 / dt);
  for (let tick = 0; tick <= ticks; tick++) {
    const minute = Math.round((-10 + tick * dt) * 1e8) / 1e8;
    if (minute === 0) {
      premeal = { plasma: engine.trueBG, cgm: engine.cgmBG };
      assert.equal(engine.addFood({ carbs: meal.carbs * profile.portion,
        fat: meal.fat * profile.portion, protein: meal.protein * profile.portion,
        weight: 250 * profile.portion, eatTimeMin: 20,
        carbParams: clone(version.foods.CARB_TYPES[carbType]) }), true);
    }
    assert.ok(Number.isFinite(engine.trueBG) && Number.isFinite(engine.cgmBG));
    if (minute >= 0) {
      if (engine.trueBG < 3.6 && firstHypoMin === null) firstHypoMin = minute;
      trace.push({ minute, plasma: engine.trueBG, cgm: engine.cgmBG,
        plasmaExcursion: engine.trueBG - premeal.plasma,
        cgmExcursion: engine.cgmBG - premeal.cgm,
        gastricTau: engine.hovorka.tauGastric ?? engine.hovorka.tau_G,
        ffaResistance: engine.ffaResistanceFactor });
    }
    if (tick < ticks) engine.step(dt);
    engine.consumeEvents();
  }
  const at = minute => trace.find(row => row.minute === minute);
  const peak = field => trace.reduce((best, row) => row[field] > best[field] ? row : best);
  // Signeret areal relativt til præmåltid; ikke positiv-only GI-iAUC.
  const area = (start, end) => trace.slice(1).reduce((sum, row, i) =>
    row.minute > start && row.minute <= end ? sum + dt * (trace[i].cgmExcursion + row.cgmExcursion) / 2 : sum, 0);
  return { version: version.label, profile: profile.id, meal: meal.id, dt, startBG, carbType,
    dose, premeal, firstHypoMin, endpoints: [0, 30, 60, 90, 120, 180, 210, 240, 270, 300].map(at),
    cgmPeak: peak('cgmExcursion'), plasmaPeak: peak('plasmaExcursion'), area0to90: area(0, 90),
    area180to300: area(180, 300), trace };
}
const versions = [loadVersion('before', baselineRef), loadVersion('after', null)];
const results = [], contrasts = [];
// To beskrevne profiler, to relevante sammensætningsproxyer og to initiale BG.
// Primærarmen er voksenreference, hvidt mel, BG 5.5, dt=0.5; dt=1 måler numerik.
for (const version of versions) for (const profile of profiles) for (const carbType of ['hvidt_mel', 'mixed']) for (const startBG of [5.5, 7]) for (const dt of [0.5, 1]) {
  const rows = Object.fromEntries(meals.map(meal => {
    const result = run(version, profile, meal, dt, startBG, carbType);
    results.push(result); return [meal.id, result];
  }));
  const value = (id, minute) => rows[id].endpoints.find(row => row.minute === minute).cgmExcursion;
  const observed = {
    proteinAt180: value('LFHP', 180) - value('LFLP', 180),
    fatAt210: value('HFLP', 210) - value('LFLP', 210),
    combinedMargins: [180, 210, 240, 270, 300].map(minute => ({ minute,
      margin: value('HFHP', minute) - Math.max(...['LFLP', 'LFHP', 'HFLP'].map(id => value(id, minute))) })),
    fatEarlyAreaDifference: rows.HFLP.area0to90 - rows.LFLP.area0to90,
    combinedPeakTimeDifference: rows.HFHP.cgmPeak.minute - rows.LFLP.cgmPeak.minute,
  };
  contrasts.push({ version: version.label, profile: profile.id, carbType, startBG, dt, observed,
    directions: { protein_late: observed.proteinAt180 > 0, fat_late: observed.fatAt210 > 0,
      combined_late: observed.combinedMargins.every(row => row.margin > 0),
      fat_early: observed.fatEarlyAreaDifference < 0, combined_peak: observed.combinedPeakTimeDifference > 0 },
    hypoCensoring: Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, row.firstHypoMin])) });
}
const notes = [
  'Qualitative protocol approximation, not a fitted clinical reproduction or clinical release certification.',
  'Smart original cohort aged 8–17; virtual 70 kg/40 kg profiles and ISF/ICR are illustrative, not estimated cohort participants.',
  'Same carbohydrate and fixed bolus within each factorial group; 10-minute prebolus and 20-minute ingestion matched.',
  'Full portions above 45 kg; 75% at 40 kg. Pancake sugar/fibre and physical weight are not identified: white-flour and mixed catalog proxies; weight assumed 250 g.',
  'Baseline basal state is computed by the engine; no recreated fasting day or individually optimized patient ICR. Dawn/noise/variability disabled.',
  'Smart used iPro2 CGM; this uses simulator CGM. Hypoglycaemia (<3.6 plasma proxy) is flagged but not rescued; subsequent values cannot be interpreted as trial-matched observations.',
  'No significance testing of virtual profiles. Positive direction does not establish effect size, onset accuracy, or mechanistic validity.',
  'Wolpert closed-loop insulin and Bell dual-wave protocols were not reproduced; they cannot calibrate this fixed-bolus experiment.',
];
const output = { generatedAt: new Date().toISOString(), baselineRef, targets, notes,
  profiles, options, versions: versions.map(v => ({ label: v.label, ref: v.ref, hashes: v.hashes })), contrasts, results };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(output, null, 2) + '\n');
const primary = contrasts.filter(r => r.profile === 'adult_reference' && r.carbType === 'hvidt_mel' && r.startBG === 5.5 && r.dt === 0.5);
console.log(JSON.stringify({ arms: results.length, outputDirectory: out, primary,
  failures: contrasts.filter(r => Object.values(r.directions).some(x => !x)).map(r => ({ ...r, observed: undefined })) }, null, 2));
// Gør en ændret retning synlig for testkørslen; ingen amplituder tilpasses her.
if (contrasts.some(row => Object.values(row.directions).some(passed => !passed))) process.exitCode = 1;
