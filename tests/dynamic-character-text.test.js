// =============================================================================
// DYNAMIC-CHARACTER-TEXT.TEST.JS - kontrakt for dynamiske karakternavne
// =============================================================================
//
// Testen sikrer, at spiller-vendte tekster ikke falder tilbage til én bestemt
// karakter. Alle tekster med {characterName} prøves på dansk og engelsk for
// hver af spillets seks karakterer. Den kontrollerer også, at de dynamiske
// pladser i mobilens HTML ikke indeholder et hårdkodet standardnavn.
//
// Kør fra projektroden:
//   tests/.bin/node.exe tests/dynamic-character-text.test.js
// =============================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCHETYPES_PATH = path.join(PROJECT_ROOT, 'js', 'archetypes.js');
const I18N_PATH = path.join(PROJECT_ROOT, 'js', 'i18n.js');
const MOBILE_HTML_PATH = path.join(PROJECT_ROOT, 'mobile', 'index.html');

const storage = new Map();
const context = vm.createContext({
    console,
    appSettings: { language: 'da' },
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
    },
});

vm.runInContext(fs.readFileSync(ARCHETYPES_PATH, 'utf8'), context, {
    filename: ARCHETYPES_PATH,
});
vm.runInContext(fs.readFileSync(I18N_PATH, 'utf8'), context, {
    filename: I18N_PATH,
});
vm.runInContext(`this.__textTestExports = {
    CHARACTERS,
    CHARACTER_STORAGE_KEY,
    I18N,
    t,
};`, context);

const {
    CHARACTERS,
    CHARACTER_STORAGE_KEY,
    I18N,
    t,
} = context.__textTestExports;

// Begge sprog skal bruge navnevariablen i præcis de samme tekster. Ellers kan
// en oversættelse utilsigtet blive hængende i en gammel, generisk formulering.
const characterKeysByLanguage = Object.fromEntries(['da', 'en'].map(language => [
    language,
    Object.entries(I18N[language])
        .filter(([, value]) => typeof value === 'string' && value.includes('{characterName}'))
        .map(([key]) => key)
        .sort(),
]));

assert.deepStrictEqual(
    Array.from(characterKeysByLanguage.da),
    Array.from(characterKeysByLanguage.en),
    'Dansk og engelsk skal bruge {characterName} i de samme tekster'
);
assert(characterKeysByLanguage.da.length > 0, 'Der skal findes dynamiske karaktertekster');

for (const character of CHARACTERS) {
    storage.set(CHARACTER_STORAGE_KEY, JSON.stringify({ characterId: character.id }));

    for (const language of ['da', 'en']) {
        context.appSettings.language = language;

        for (const key of characterKeysByLanguage[language]) {
            const rendered = t(key, {
                threshold: '3.0',
                unit: 'mmol/L',
                weight: '5',
                limit: '6',
                limitKcal: '42000',
                ketones: '3.2',
                avg: '11.0',
                count: '2',
                days: '3',
                hours: '4',
                range: '10-20',
            });

            assert(
                rendered.includes(character.name),
                `${language}.${key} skal vise ${character.name}`
            );
            assert(
                !rendered.includes('{characterName}'),
                `${language}.${key} må ikke efterlade {characterName}`
            );
        }
    }
}

// Navnefelterne udfyldes af mobile.js, inden deres popup vises. HTML-fallbacken
// skal derfor være tom, så Erik ikke blinker frem for en anden valgt karakter.
const mobileHtml = fs.readFileSync(MOBILE_HTML_PATH, 'utf8');
const dynamicMobileIds = [
    'goCharacterCaption',
    'ciCharacterCaption',
    'crCharacterCaption',
];

for (const id of dynamicMobileIds) {
    const elementPattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([^<]*)<`);
    const match = mobileHtml.match(elementPattern);
    assert(match, `Mobilfeltet #${id} skal findes`);
    assert.strictEqual(match[1].trim(), '', `Mobilfeltet #${id} skal udfyldes dynamisk`);
}

for (const id of ['goCharacter', 'obCharacter', 'ciCharacter', 'crCharacter']) {
    const imagePattern = new RegExp(`<img[^>]+id=["']${id}["'][^>]+alt=["']([^"']*)["']`);
    const match = mobileHtml.match(imagePattern);
    assert(match, `Mobilbilledet #${id} skal findes`);
    assert.strictEqual(match[1], '', `Mobilbilledet #${id} må ikke have et hårdkodet navn`);
}

console.log(`PASS: ${characterKeysByLanguage.da.length} dynamiske tekster virker for alle 6 karakterer på dansk og engelsk`);
