// =============================================================================
// SYMPTOMS.TEST.JS - test af fælles symptomresolver og dens UI-kontrakt
// =============================================================================
//
// Testen kontrollerer både symptomlogikken og de vigtigste integrationer:
//   - progressive tærskler for hypo, hyper, ketoner, energi og sygdom;
//   - deduplikering når samme symptom kan have flere årsager;
//   - fælles VFX-driver for desktop, mobil og tips;
//   - script-rækkefølge, læringstips og links til spilguiden.
//
// Kør fra projektroden:
//   tests/.bin/node.exe tests/symptoms.test.js
// =============================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const {
    resolveSymptomState,
    resolveSymptomVfxState,
    isSymptomGroupActive,
    countActiveSymptomGroups,
} = require('../js/symptoms.js');

function simulatorState(overrides = {}) {
    return {
        trueBG: 7,
        cgmBG: 7,
        acidosisLoad: 0,
        ACIDOSIS_THRESHOLD: 600,
        brainEnergyDeficit: 0,
        glucotoxicLoad: 0,
        weightChangeKg: 0,
        timeInMinutes: 12 * 60,
        totalSimMinutes: 12 * 60,
        illnessSymptomsStart: null,
        illnessSymptomsUntil: 0,
        _campaignDisableWeight: false,
        ...overrides,
    };
}

function concepts(state) {
    return state.symptoms.map(symptom => symptom.concept);
}

function read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

const normal = resolveSymptomState(simulatorState());
assert.deepStrictEqual(normal.activeGroups, [], 'Normal tilstand må ikke vise symptomgrupper');
assert.deepStrictEqual(normal.symptoms, [], 'Normal tilstand må ikke vise symptomord');

const mildHypo = resolveSymptomState(simulatorState({ trueBG: 3.4 }));
assert(mildHypo.groups.hypo.active, 'BG 3,4 skal aktivere hypogruppen');
assert(concepts(mildHypo).includes('sweat'), 'Mild hypo skal kunne vise sved');
assert(concepts(mildHypo).includes('heartbeat'), 'Mild hypo skal kunne vise hjertebanken');
assert(concepts(mildHypo).includes('tremor'), 'BG under 3,5 skal kunne vise rysten');
assert(!concepts(mildHypo).includes('confusion'), 'Forvirring må først optræde under sin tærskel');

const severeHypo = resolveSymptomState(simulatorState({ trueBG: 2.7 }));
assert(concepts(severeHypo).includes('confusion'), 'Svær hypo skal kunne vise forvirring');
assert(concepts(severeHypo).includes('blurredVision'), 'BG under 2,8 skal kunne vise sløret syn');
assert(!concepts(severeHypo).includes('seizures'), 'Kramper må først optræde under 2,5');

const hyper = resolveSymptomState(simulatorState({ trueBG: 15 }));
assert(hyper.groups.hyper.active, 'BG over 14 skal aktivere hypergruppen');
assert(concepts(hyper).includes('thirst'), 'Hyper skal kunne vise tørst');
assert(concepts(hyper).includes('urination'), 'Hyper skal kunne vise hyppig vandladning');

const moderateKetones = resolveSymptomState(simulatorState({ acidosisLoad: 0.30 * 600 }));
assert(concepts(moderateKetones).includes('nausea'), '25% syrebelastning skal kunne vise kvalme');
assert(!concepts(moderateKetones).includes('stomachPain'), 'Mavesmerter kræver mere end 30% syrebelastning');

const advancedKetones = resolveSymptomState(simulatorState({ acidosisLoad: 0.61 * 600 }));
assert(concepts(advancedKetones).includes('kussmaul'), 'Over 60% skal kunne vise dyb, hurtig vejrtrækning');

const energy = resolveSymptomState(simulatorState({ weightChangeKg: -1.1 }));
assert(energy.groups.energy.active, 'Energiunderskud skal være aktivt om dagen efter 0,5 kg vægttab');
assert(concepts(energy).includes('hunger'), 'Energiunderskud skal kunne vise sult');
assert(concepts(energy).includes('weakness'), 'Større energiunderskud skal kunne vise svaghed');
assert(
    !resolveSymptomState(simulatorState({ weightChangeKg: -1.1, timeInMinutes: 2 * 60 })).groups.energy.active,
    'Energiord skal ikke vises under søvnperioden'
);
assert(
    !resolveSymptomState(simulatorState({ weightChangeKg: -1.1, _campaignDisableWeight: true })).groups.energy.active,
    'Baner uden vægtmekanik skal ikke vise energisymptomer'
);

const illnessFromMidnight = resolveSymptomState(simulatorState({
    totalSimMinutes: 45,
    timeInMinutes: 45,
    illnessSymptomsStart: 0,
    illnessSymptomsUntil: 300,
}));
assert(illnessFromMidnight.groups.illness.active, 'En sygdom der starter ved minut 0 skal registreres');
assert(concepts(illnessFromMidnight).includes('soreThroat'), 'Sygdom skal kunne vise ondt i halsen');

const overlapSimulator = simulatorState({
    trueBG: 23,
    acidosisLoad: 0.40 * 600,
});
const overlap = resolveSymptomState(overlapSimulator);
assert.strictEqual(
    concepts(overlap).filter(concept => concept === 'thirst').length,
    1,
    'Tørst må kun tegnes én gang ved samtidig hyper og ketonbelastning'
);
assert.strictEqual(
    concepts(overlap).filter(concept => concept === 'nausea').length,
    1,
    'Kvalme må kun tegnes én gang ved flere samtidige årsager'
);
assert.strictEqual(countActiveSymptomGroups(overlapSimulator), 2, 'Hyper og ketoner skal tælle som to grupper');
assert(isSymptomGroupActive(overlapSimulator, 'ketone', 0.25), 'Tipmotoren skal kunne spørge til gruppens minimumsværdi');

assert(resolveSymptomVfxState(simulatorState({ trueBG: 3.2 })).hypoActive, 'Lavt BG skal aktivere hypo-VFX');
assert(
    !resolveSymptomVfxState(simulatorState({ trueBG: 5, brainEnergyDeficit: 4 })).active,
    'Et gammelt hjerneunderskud må ikke give VFX efter normalisering af BG'
);
assert(
    resolveSymptomVfxState(simulatorState({ trueBG: 14, glucotoxicLoad: 10 })).hyperActive,
    'Glukotoksisk belastning med fortsat højt BG skal aktivere hyper-VFX'
);
assert(
    resolveSymptomVfxState(simulatorState({ acidosisLoad: 0.11 * 600 })).ketoneActive,
    'Syrebelastning over 10% skal aktivere keton-VFX'
);

const desktopHtml = read('index.html');
const mobileHtml = read('mobile/index.html');
assert(
    desktopHtml.indexOf('js/symptoms.js') < desktopHtml.indexOf('js/campaign-core.js'),
    'Desktop skal indlæse symptoms.js før tipmotoren'
);
assert(
    mobileHtml.indexOf('../js/symptoms.js') < mobileHtml.indexOf('../js/campaign-core.js'),
    'Mobil skal indlæse symptoms.js før tipmotoren'
);

const desktopUi = read('js/ui.js');
const mobileUi = read('mobile/mobile.js');
assert(desktopUi.includes('resolveSymptomState(game)'), 'Desktopgrafen skal bruge den fælles resolver');
assert(mobileUi.includes('resolveSymptomState(game)'), 'Mobilgrafen skal bruge den fælles resolver');
assert(desktopUi.includes('resolveSymptomVfxState(game)'), 'Desktop-VFX skal bruge den fælles resolver');
assert(mobileUi.includes('resolveSymptomVfxState(game)'), 'Mobil-VFX skal bruge den fælles resolver');

const levelsSource = read('js/levels.js');
const guaranteedTips = (levelsSource.match(/firstOccurrenceGuaranteed: true/g) || []).length;
assert(guaranteedTips >= 7, 'De syv symptomrelaterede læringstips skal vises sikkert første gang');
assert(!levelsSource.includes('global_hyper_urination'), 'Det dobbelte hyper-vandladningstip skal være fjernet');
assert(!levelsSource.includes('global_ketone_breathing'), 'Det overlappende keton-vejrtrækningstip skal være fjernet');

// Kør den faktiske tipmotor i en isoleret kontekst. Dermed testes kontrakten
// bag firstOccurrenceGuaranteed, ikke kun at feltet står i levels.js.
const campaignCoreSource = read('js/campaign-core.js');
const tipContext = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    resolveSymptomState,
    resolveSymptomVfxState,
    isSymptomGroupActive,
    countActiveSymptomGroups,
});
vm.runInContext(`${campaignCoreSource}\nthis.__tipTest = {
    tipSessionState,
    _rollTipChance,
    _resetEventChanceIfInactive,
    _tipShouldShow,
    _tipCommitShown,
    _tipVfxActive,
};`, tipContext, { filename: 'js/campaign-core.js' });

const tipTools = tipContext.__tipTest;
const guaranteedTip = {
    id: 'test_symptom_learning',
    triggerType: 'symptomGroupActive',
    symptomGroup: 'hyper',
    chance: 0,
    firstOccurrenceGuaranteed: true,
    priority: 2,
};
assert.strictEqual(tipTools._rollTipChance(guaranteedTip), true, 'Første læringstip skal omgå lodtrækningen');
tipTools._tipCommitShown(
    guaranteedTip,
    { totalSimMinutes: 100, graphMessages: null },
    { cooldownStore: {}, scope: 'global' }
);
assert(tipTools.tipSessionState._educationShown[guaranteedTip.id], 'Første visning skal huskes');
assert.strictEqual(
    tipTools._rollTipChance(guaranteedTip),
    false,
    'Samme aktive episode må ikke vise læringstippet igen'
);
tipTools._resetEventChanceIfInactive(guaranteedTip);
assert.strictEqual(
    tipTools._rollTipChance(guaranteedTip),
    false,
    'Senere episoder skal bruge den almindelige chance'
);

const disabledVfxContext = {
    core: { host: { getSettings: () => ({ vfxEnabled: false }) } },
};
assert.strictEqual(
    tipTools._tipVfxActive(simulatorState({ trueBG: 3.0 }), disabledVfxContext),
    false,
    'VFX-tippet må ikke vises, når spilleren har slået VFX fra'
);

const guideSource = read('js/guide-data.js');
const guideContext = vm.createContext({});
vm.runInContext(`${guideSource}\nthis.__guideTest = { guideSectionForTextKey };`, guideContext);
const guideSectionForTextKey = guideContext.__guideTest.guideSectionForTextKey;
assert.strictEqual(guideSectionForTextKey('tips.symptomHypo'), 'low-bg-kit');
assert.strictEqual(guideSectionForTextKey('tips.symptomKetone'), 'ketones');
assert.strictEqual(guideSectionForTextKey('tips.symptomEnergyDeficit'), 'energy');
assert.strictEqual(guideSectionForTextKey('tips.symptomIllness'), 'stress-dawn-illness');
assert.strictEqual(guideSectionForTextKey('tips.symptomHyper'), 'body-signals');

console.log('PASS: fælles symptomlogik, læringstips og guidekoblinger er konsistente');
