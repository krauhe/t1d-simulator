// =============================================================================
// CHARACTER-MOODS.TEST.JS - statisk og logisk test af spillets seks karakterer
// =============================================================================
//
// Testen indlæser js/archetypes.js i en isoleret VM-kontekst og kontrollerer:
//   - at de tre fysiologiske kropstyper hver har et navnepar;
//   - at alle helfigurer og BG-hero-stemninger findes på disken;
//   - at stemningsprioriteten følger den aftalte gameplay-logik.
//
// Kør fra projektroden:
//   tests/.bin/node.exe tests/character-moods.test.js
// =============================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCHETYPES_PATH = path.join(PROJECT_ROOT, 'js', 'archetypes.js');
const source = fs.readFileSync(ARCHETYPES_PATH, 'utf8');

const context = vm.createContext({
    console,
    localStorage: {
        getItem: () => null,
    },
});

vm.runInContext(`${source}
this.__characterTestExports = {
    CHARACTERS,
    CHARACTER_MOOD_KEYS,
    getCharacter,
    getCharacterMoodPortrait,
    resolveCharacterMood,
};`, context, { filename: ARCHETYPES_PATH });

const {
    CHARACTERS,
    CHARACTER_MOOD_KEYS,
    getCharacter,
    getCharacterMoodPortrait,
    resolveCharacterMood,
} = context.__characterTestExports;

function assetExists(relativePath) {
    return fs.existsSync(path.join(PROJECT_ROOT, ...relativePath.split('/')));
}

function mood(overrides = {}, previousMood = 'neutral') {
    const sim = {
        trueBG: 7,
        cgmBG: 7,
        totalSimMinutes: 12 * 60,
        timeInMinutes: 12 * 60,
        illnessSymptomsUntil: 0,
        activeAktivitet: null,
        smoothHeartRate: 60,
        hovorka: { HR_base: 60 },
        awakeAtNight: false,
        isNightAwake() { return this.awakeAtNight; },
        acuteStressLevel: 0,
        chronicStressLevel: 0,
        ...overrides,
    };
    return resolveCharacterMood(sim, previousMood);
}

assert.strictEqual(CHARACTERS.length, 6, 'Der skal være præcis seks karakterer');
assert.strictEqual(new Set(CHARACTERS.map(character => character.id)).size, 6, 'Karakter-id’er skal være unikke');
assert.strictEqual(new Set(CHARACTERS.map(character => character.name)).size, 6, 'Karakter-navne skal være unikke');

const expectedPairs = {
    child: ['Oscar', 'Olivia'],
    adult: ['Erik', 'Eva'],
    large: ['Frank', 'Fiona'],
};

Object.entries(expectedPairs).forEach(([archetype, expectedNames]) => {
    const actualNames = CHARACTERS
        .filter(character => character.archetype === archetype)
        .map(character => character.name);
    assert.deepStrictEqual(
        Array.from(actualNames),
        expectedNames,
        `${archetype} skal have det aftalte navnepar`
    );
    assert(
        actualNames.every(name => name[0] === expectedNames[0][0]),
        `${archetype}-parret skal begynde med samme bogstav`
    );
});

assert.deepStrictEqual(
    Array.from(CHARACTER_MOOD_KEYS),
    ['hypo', 'hyper', 'active', 'breathless', 'sleep', 'tired', 'stress', 'sick', 'happy'],
    'Stemningssættet må ikke ændres uden at assets og test opdateres sammen'
);

CHARACTERS.forEach(character => {
    const neutralPortrait = `assets/icons/app/character-${character.id}.png`;
    assert(assetExists(neutralPortrait), `Mangler neutralt portræt: ${neutralPortrait}`);

    ['intro', 'celebrate', 'concern'].forEach(scene => {
        const scenePath = character.fullBody && character.fullBody[scene];
        assert(scenePath, `${character.name} mangler helfigur til ${scene}`);
        assert(assetExists(scenePath), `Mangler karakter-asset: ${scenePath}`);
    });

    CHARACTER_MOOD_KEYS.forEach(moodKey => {
        const moodPath = getCharacterMoodPortrait(character, moodKey);
        assert(assetExists(moodPath), `Mangler stemnings-asset: ${moodPath}`);
    });

    assert.strictEqual(
        getCharacterMoodPortrait(character, 'ukendt'),
        neutralPortrait,
        `${character.name} skal falde tilbage til sit neutrale portræt`
    );
});

assert.strictEqual(getCharacter('ukendt').id, 'erik', 'Ukendt karakter-id skal bruge den stabile standardkarakter');

assert.strictEqual(mood({ trueBG: 3.8, activeAktivitet: { type: 'cardio' } }), 'hypo', 'Hypo skal vinde over aktivitet');
assert.strictEqual(mood({ illnessSymptomsUntil: 800 }), 'sick', 'Aktiv sygdomshændelse skal vises');
assert.strictEqual(mood({ trueBG: 11 }), 'hyper', 'Højt blodsukker skal give hyper-udtryk');
assert.strictEqual(
    mood({ activeAktivitet: { type: 'cardio' }, smoothHeartRate: 120 }),
    'breathless',
    'Høj puls under aktivitet skal give forpustet udtryk'
);
assert.strictEqual(
    mood({ activeAktivitet: { type: 'cardio' }, smoothHeartRate: 95 }),
    'active',
    'Aktivitet uden høj puls skal give aktivt udtryk'
);
assert.strictEqual(mood({ timeInMinutes: 60 }), 'sleep', 'Karakteren skal sove om natten');
assert.strictEqual(
    mood({ timeInMinutes: 60, awakeAtNight: true }),
    'tired',
    'En vågen karakter om natten skal se træt ud'
);
assert.strictEqual(
    mood({ timeInMinutes: 60, trueBG: 3.5 }),
    'sleep',
    'Søvn skal beholde lukkede øjne ved lavt blodsukker'
);
assert.strictEqual(
    mood({ timeInMinutes: 60, trueBG: 12, illnessSymptomsUntil: 800, acuteStressLevel: 0.2 }),
    'sleep',
    'Søvn skal beholde lukkede øjne ved hyper, sygdom og stress'
);
assert.strictEqual(
    mood({ timeInMinutes: 60, trueBG: 3.5, awakeAtNight: true }),
    'hypo',
    'Efter opvågning skal det akutte fysiologiske udtryk vises igen'
);
assert.strictEqual(mood({ acuteStressLevel: 0.15 }), 'stress', 'Tydelig akut stress skal vises');
assert.strictEqual(mood({ trueBG: 5.5 }), 'happy', 'Bonusområdet skal give et glad udtryk');
assert.strictEqual(mood({ trueBG: 7 }), 'neutral', 'Rolig dagtilstand skal bruge neutralt portræt');

console.log('PASS: 6 karakterer, 72 karakter-assets og stemningsprioritet er konsistente');
