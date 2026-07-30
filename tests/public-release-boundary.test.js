// =============================================================================
// PUBLIC-RELEASE-BOUNDARY.TEST.JS - Kontrol af den offentlige udgivelsesgrænse
// =============================================================================
//
// Testen beskytter den aftalte opdeling mellem den offentlige læringsapp og det
// separate, private udviklerlaboratorium. Den undersøger Git-indekset frem for
// filsystemet, fordi private, gitignorede filer gerne må ligge i ejerens lokale
// arbejdsmappe uden at blive en del af den offentlige udgivelse.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let failures = 0;

function check(condition, message) {
    if (condition) {
        console.log(`[OK] ${message}`);
    } else {
        failures += 1;
        console.error(`[FEJL] ${message}`);
    }
}

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const trackedFiles = new Set(
    execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean)
        .map(file => file.replace(/\\/g, '/'))
);

const privateOnlyPaths = [
    'editor.local.html',
    'js/editor.js',
    'tests/editor-gate.test.js',
    'docs/REGULATORY.md',
    'docs/scenario-editor-plan.md',
    'docs/engine-state-snapshot-plan.md',
    '.agents/skills/t1d-regulatory-reviewer/SKILL.md',
];

for (const file of privateOnlyPaths) {
    check(!trackedFiles.has(file), `${file} er ikke tracket i den offentlige udgivelse`);
}

const trackedPrivateAssets = [...trackedFiles].filter(file =>
    /^assets\/icons\/app\/(?:editor-|mode-sandbox|mode-scenario-editor)/.test(file)
);
check(trackedPrivateAssets.length === 0, 'editor- og sandkasse-assets er ikke tracket offentligt');

const indexSource = read('index.html');
check(!/js\/editor\.js/i.test(indexSource), 'den offentlige side indlæser ikke editor-kode');
check(!/editorMenuWrapper|ddDeveloperEnabled|ddDeveloperProfile/.test(indexSource), 'den offentlige HTML har ingen udviklerindgange');

const gameSource = read('js/game.js');
check(!/^\s*(?:sandbox|editor)\s*:/m.test(gameSource), 'GAME_MODES registrerer kun offentlige tilstande');
check(!/startEditor|isEditorEnabled|isDeveloperModeEnabled|LOCAL_DEVELOPER/.test(gameSource), 'game.js har ingen udvikler-startveje');

const mainSource = read('js/main.js');
check(!/editorMenuButton|window\.Editor|ddDeveloper/.test(mainSource), 'main.js binder ingen editor-kontroller');

const simulatorSource = read('js/simulator.js');
check(!/exportScenario|scenarioLog|_recordScenarioEvent|engineSnapshots/.test(simulatorSource), 'den offentlige facade eksporterer ikke frie scenarier');

if (failures > 0) {
    console.error(`\n${failures} offentlig udgivelsesgrænse-kontrol(ler) fejlede.`);
    process.exit(1);
}

console.log('\nAlle kontroller af den offentlige udgivelsesgrænse bestod.');
