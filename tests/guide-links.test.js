// Kontrollerer spilguidens sprog, ikoner og faktiske koblinger fra alle aktive
// tips og baneintroer. Præcise regressionscases fanger kendte forkerte opslag;
// den brede kontrol fanger nye tips uden opslag, men kan ikke bedømme prosaen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of ['js/i18n.js', 'js/levels.js', 'js/guide-data.js']) {
    vm.runInContext(read(file), context, { filename: file });
}
const data = vm.runInContext('({ GUIDE_SECTIONS, GUIDE_SECTION_ICONS, GUIDE_LEVEL_LINKS, CAMPAIGN_LEVELS, GLOBAL_TIPS, I18N, guideSectionForTextKey })', context);
const ids = new Set(data.GUIDE_SECTIONS.map(section => section.id));
assert.equal(ids.size, data.GUIDE_SECTIONS.length, 'Afsnits-id skal være unikke');
assert.ok(ids.has('what-if'), 'Hvad Nu Hvis skal have sit eget afsnit');
for (const section of data.GUIDE_SECTIONS) {
    for (const lang of ['da', 'en']) {
        assert.ok(section.title[lang]?.trim(), `${section.id}: mangler ${lang}-titel`);
        assert.ok(section.body[lang]?.trim(), `${section.id}: mangler ${lang}-tekst`);
        assert.ok(!/<button\b/.test(section.body[lang]), 'Fremhævninger må ikke ligne falske knapper');
    }
    const structure = html => (html.match(/<(?:p|li)\b/g) || []).join(',');
    assert.equal(structure(section.body.da), structure(section.body.en), `${section.id}: afsnittenes sprogstruktur er forskellig`);
    assert.ok(fs.existsSync(path.join(root, data.GUIDE_SECTION_ICONS[section.id])), `${section.id}: ikon mangler`);
}
const source = read('js/guide-data.js');
assert.equal(source.match(/guide-en-version: (\S+)/)[1], source.match(/guide-da-translated-from-en: (\S+)/)[1]);

const tips = [...data.GLOBAL_TIPS];
for (const level of data.CAMPAIGN_LEVELS) {
    tips.push(...(level.tutorialTips || []), ...(level.tips || []));
    assert.ok(data.GUIDE_LEVEL_LINKS[level.number]?.length, `Bane ${level.number}: mangler guide-links`);
    for (const id of data.GUIDE_LEVEL_LINKS[level.number]) assert.ok(ids.has(id), `Ukendt afsnit: ${id}`);
}
const keys = new Set(tips.map(tip => tip.textKey));
for (const key of keys) {
    assert.ok(ids.has(data.guideSectionForTextKey(key)), `${key}: intet gyldigt guideafsnit`);
    for (const lang of ['da', 'en']) assert.ok(data.I18N[lang][key], `${key}: tiptekst mangler på ${lang}`);
}
// Cases er udvalgt efter tipindholdet, ikke udledt af implementeringens regler.
const expected = {
    'campaign.level1.tip.splitDose': 'basal',
    'campaign.level2.tip.onsetUncertainty': 'stress-dawn-illness',
    'tips.nightAction': 'stress-dawn-illness',
    'campaign.level4.tip.splitDose': 'rapid-iob',
    'campaign.level8.tip.cardioIob': 'activity',
    'campaign.level8.tip.strengthLater': 'activity',
    'tips.keyboardDextrose': 'controls',
    'tips.physiologyEisf': 'controls',
    'tips.foodNoBolus': 'rapid-iob',
    'tips.symptomHyper': 'body-signals',
    'tips.symptomKetone': 'ketones',
    'tips.symptomEnergyDeficit': 'energy',
    'tips.symptomIllness': 'stress-dawn-illness',
    'campaign.level10.tip.falseAlarms': 'cgm',
};
for (const [key, section] of Object.entries(expected)) {
    assert.ok(keys.has(key), `Regressionscasen ${key} skal stadig være et aktivt tip`);
    assert.equal(data.guideSectionForTextKey(key), section, `${key}: forkert afsnit`);
}
assert.deepEqual(Array.from(data.GUIDE_LEVEL_LINKS[5]), ['food', 'rapid-iob', 'energy']);
assert.equal(data.guideSectionForTextKey('unknown.key'), null);
assert.equal(data.guideSectionForTextKey(null), null);
console.log(`PASS: ${ids.size} tosprogede guideafsnit, ${keys.size} aktive tipnøgler, 10 baneintroer og ${Object.keys(expected).length} indholdsspecifikke regressioner`);
