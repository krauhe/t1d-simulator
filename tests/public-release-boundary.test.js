// =============================================================================
// PUBLIC-RELEASE-BOUNDARY.TEST.JS - Kontrol af den offentlige udgivelsesgrænse
// =============================================================================
//
// Testen beskytter grænsen mellem den offentlige læringsapp, den begrænsede
// Hvad Nu Hvis-visning og lokale udviklerværktøjer. Hvad Nu Hvis-koden er en del
// af den offentlige app, men dens offentlige API må kun åbne et allerede spillet
// forløb for en fast karakter. Fil-, profil- og eksportfunktioner må ikke udstilles.
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
    'tests/editor-gate.test.js',
    'docs/REGULATORY.md',
    'docs/scenario-editor-plan.md',
    'docs/engine-state-snapshot-plan.md',
    '.agents/skills/t1d-regulatory-reviewer/SKILL.md',
];

for (const file of privateOnlyPaths) {
    check(!trackedFiles.has(file), `${file} er ikke tracket i den offentlige udgivelse`);
}

const indexSource = read('index.html');
check(/js\/editor\.js/i.test(indexSource), 'den offentlige side indlæser den begrænsede Hvad Nu Hvis-kode');
check(!/ddDeveloperEnabled|ddDeveloperProfile|editor\.local\.html/.test(indexSource),
    'den offentlige HTML har ingen udviklerprofil eller lokal editor-indgang');

const gameSource = read('js/game.js');
check(!/^\s*(?:sandbox|editor)\s*:/m.test(gameSource), 'GAME_MODES registrerer kun de to offentlige spiltilstande');
check(/mode === 'insights'/.test(gameSource), 'Hvad Nu Hvis er en statisk visning og ikke en tredje spiltilstand');
check(!/isDeveloperModeEnabled|LOCAL_DEVELOPER/.test(gameSource), 'game.js har ingen udvikler-startvej');

const mainSource = read('js/main.js');
check(!/ddDeveloperEnabled|ddDeveloperProfile|LOCAL_DEVELOPER/.test(mainSource),
    'main.js binder ingen udviklerprofil eller lokal udviklertilstand');

const simulatorSource = read('js/simulator.js');
const exportStart = simulatorSource.indexOf('exportInsightsScenario(');
const exportEnd = simulatorSource.indexOf('\n    }', exportStart);
const exportBody = exportStart >= 0 && exportEnd > exportStart
    ? simulatorSource.slice(exportStart, exportEnd)
    : '';
check(exportBody.includes("format: 't1d-insights'") && exportBody.includes('characterId: this.characterId'),
    'spillet eksporterer kun den faste karakter-id til Hvad Nu Hvis-kontrakten');
check(!/\b(?:weight|isf|icr)\s*:/.test(exportBody),
    'Hvad Nu Hvis-kontrakten indeholder ikke vægt, ISF eller ICR');
check(exportBody.includes("['acuteStress', 'chronicStress'].includes(event.kind)") &&
    exportBody.includes('Number.isFinite(event.t)') &&
    exportBody.includes('Number.isFinite(event.amount)'),
    'låste banehændelser er begrænset til faste stress-events med gyldig tid og styrke');

const editorSource = read('js/editor.js');
check(/const FUTURE_MIN = 360/.test(editorSource), 'Hvad Nu Hvis viser højst seks timer efter pausepunktet');
check(/profile = characterToProfile\(characterId\)/.test(editorSource),
    'Hvad Nu Hvis slår altid modelprofilen op fra den faste karakter-id');
const publicApiStart = editorSource.lastIndexOf('// Det offentlige API');
const publicApi = publicApiStart >= 0 ? editorSource.slice(publicApiStart) : '';
check(publicApiStart >= 0 && !/\b(?:saveScenario|loadScenarioData|openScenario|newScenario|printScenario|serializeScenario)\b/.test(publicApi),
    'Hvad Nu Hvis-API udstiller ikke fil-, ny-, gem-, print- eller profilfunktioner');

if (failures > 0) {
    console.error(`\n${failures} offentlig udgivelsesgrænse-kontrol(ler) fejlede.`);
    process.exit(1);
}

console.log('\nAlle kontroller af den offentlige udgivelsesgrænse bestod.');
