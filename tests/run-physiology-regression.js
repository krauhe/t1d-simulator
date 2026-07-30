// =============================================================================
// RUN-PHYSIOLOGY-REGRESSION.JS — Samlet fysiologi-regression
// =============================================================================
//
// Kører de syv faste checks for physiology-engine arbejdet:
//   1. Direkte engine-API-test uden DOM-mocks
//   2. Golden-master bit-identisk regression
//   3. Klinisk ækvivalens mod frossen baseline
//   4. Standalone-paritet mellem motor og facade
//   5. Ekstern insulin-clamp-diagnostik
//   6. Litteraturkoblet aktivitetsvalidering
//   7. Eksisterende fuld Node-suite
//
// Brug:
//   tests/.bin/node.exe tests/run-physiology-regression.js
// =============================================================================

const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const node = process.execPath;

const checks = [
    {
        name: 'Direkte engine-API-test',
        args: ['tests/physiology-engine-api.test.js']
    },
    {
        name: 'Golden-master bit-identisk regression',
        args: ['tests/golden-master.js', 'check']
    },
    {
        name: 'Klinisk-ækvivalens (mod frossen baseline)',
        args: ['tests/clinical-equivalence.js', 'check']
    },
    {
        name: 'Standalone-paritet (bar engine vs facade)',
        args: ['tests/standalone-parity.js']
    },
    {
        name: 'Ekstern insulin-clamp-diagnostik',
        args: ['tests/insulin-clamp-validation.js']
    },
    {
        name: 'Litteraturkoblet aktivitetsvalidering',
        args: ['tests/activity-validation.js']
    },
    {
        name: 'Fuld Node-suite',
        args: ['tests/simulation.test.js']
    }
];

for (const check of checks) {
    console.log(`\n=== ${check.name} ===`);
    const result = spawnSync(node, check.args, {
        cwd: repoRoot,
        stdio: 'inherit'
    });

    if (result.error) {
        console.error(`\nFEJL: Kunne ikke starte ${check.name}: ${result.error.message}`);
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error(`\nFEJL: ${check.name} fejlede med exit code ${result.status}`);
        process.exit(result.status || 1);
    }
}

console.log('\n========================================');
console.log('Alle physiology regression checks bestod.');
