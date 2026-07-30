// =============================================================================
// PUBLIC-CHARACTER-PROFILE.TEST.JS - offentlig id-only profilkontrakt
// =============================================================================
//
// Den publicerede app må kun gemme characterId. Rå weight/isf/icr-felter i
// localStorage er enten gamle migrationsdata eller manipulation og må aldrig
// sendes direkte til motoren. Testen kører den faktiske resolver fra
// js/archetypes.js i en isoleret browserlignende kontekst.
// =============================================================================

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/archetypes.js', 'utf8');

function makeContext(initialValue) {
    const storage = new Map();
    if (initialValue !== undefined) {
        storage.set('diabetesDystenProfile', JSON.stringify(initialValue));
    }
    const context = vm.createContext({
        console,
        localStorage: {
            getItem: key => storage.has(key) ? storage.get(key) : null,
            setItem: (key, value) => storage.set(key, String(value))
        }
    });
    vm.runInContext(source, context);
    return { context, storage };
}

function resolve(initialValue) {
    const fixture = makeContext(initialValue);
    const profile = JSON.parse(vm.runInContext(
        'JSON.stringify(loadFixedCharacterProfile())',
        fixture.context
    ));
    const persisted = JSON.parse(fixture.storage.get('diabetesDystenProfile'));
    return { profile, persisted };
}

const tampered = resolve({
    characterId: 'erik',
    weight: 999,
    isf: 0.1,
    icr: 1
});
if (tampered.profile.weight !== 70 || tampered.profile.isf !== 3 || tampered.profile.icr !== 10) {
    throw new Error(`Manipulerede Erik-værdier slap igennem: ${JSON.stringify(tampered.profile)}`);
}
if (JSON.stringify(tampered.persisted) !== JSON.stringify({ characterId: 'erik' })) {
    throw new Error(`Storage blev ikke reduceret til characterId: ${JSON.stringify(tampered.persisted)}`);
}

const legacy = resolve({ weight: 100, isf: 8, icr: 30 });
if (legacy.profile.characterId !== 'frank' || legacy.profile.weight !== 100
    || legacy.profile.isf !== 2 || legacy.profile.icr !== 7) {
    throw new Error(`Legacy-profil blev ikke migreret til fast karakter: ${JSON.stringify(legacy.profile)}`);
}
if (Object.keys(legacy.persisted).join(',') !== 'characterId') {
    throw new Error(`Legacy-storage indeholder fortsat rå felter: ${JSON.stringify(legacy.persisted)}`);
}

const expectedProfiles = {
    oscar: [40, 4, 15], emma: [40, 4, 15],
    erik: [70, 3, 10], laura: [70, 3, 10],
    frank: [100, 2, 7], ruth: [100, 2, 7]
};

for (const [characterId, expected] of Object.entries(expectedProfiles)) {
    const result = resolve({ characterId, weight: 1, isf: 99, icr: 99 });
    const actual = [result.profile.weight, result.profile.isf, result.profile.icr];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${characterId} gav ${JSON.stringify(actual)}, forventede ${JSON.stringify(expected)}`);
    }
}

for (const fileName of ['js/ui.js', 'mobile/mobile.js']) {
    const uiSource = fs.readFileSync(fileName, 'utf8');
    if (/setItem\(\s*['"]diabetesDystenProfile['"][\s\S]{0,120}characterToProfile/.test(uiSource)) {
        throw new Error(`${fileName} gemmer stadig rå characterToProfile-værdier`);
    }
}

console.log(`PASS: offentlig karakterprofil bestod ${expectedProfiles ? 10 : 0}/10 kontroller`);
