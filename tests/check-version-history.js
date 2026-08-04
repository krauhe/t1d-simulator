// =============================================================================
// CHECK-VERSION-HISTORY.JS - kontrol før offentlig publicering
// =============================================================================
//
// Kontrollen sikrer, at versionshistorikken har én spiller-vendt beskrivelse
// for den version og dato, der pushes. Flere push samme dag opdaterer samme post.
// Kun de to nyeste udgivelsesdage må have detaljerede punktlister; resten skal
// være korte månedsopsummeringer.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const versionFile = path.join(projectRoot, 'js', 'version-data.js');
const source = `${fs.readFileSync(versionFile, 'utf8')}\n;globalThis.__versionInfo = APP_VERSION_INFO;`;
const context = {};
vm.createContext(context);
vm.runInContext(source, context, { filename: versionFile });

const info = context.__versionInfo;
const history = Array.isArray(info && info.history) ? info.history : [];
const findings = [];

if (history.length < 2) findings.push('Versionshistorikken skal have mindst to offentlige udgivelser.');

const latest = history[0] || {};
if (latest.version !== info.version) {
    findings.push(`Nyeste historikversion (${latest.version || 'mangler'}) matcher ikke appversionen (${info.version}).`);
}
if (latest.date !== info.date) {
    findings.push(`Nyeste historikdato (${latest.date || 'mangler'}) matcher ikke appdatoen (${info.date}).`);
}

const releaseDates = history.filter(entry => entry.date).map(entry => entry.date);
const duplicateDates = releaseDates.filter((date, index) => releaseDates.indexOf(date) !== index);
if (duplicateDates.length) {
    findings.push(`Der må kun være én udgivelsespost pr. dato: ${[...new Set(duplicateDates)].join(', ')}.`);
}

history.forEach((entry, index) => {
    const hasFeatures = entry.features && (Array.isArray(entry.features.da) || Array.isArray(entry.features.en));
    const hasFixes = entry.fixes && (Array.isArray(entry.fixes.da) || Array.isArray(entry.fixes.en));
    const hasDetailedLists = hasFeatures || hasFixes;

    if (index < 2 && !hasDetailedLists) {
        findings.push(`Udgivelsespost ${index + 1} skal have spiller-vendte punkter på dansk og engelsk.`);
    }
    if (index >= 2 && hasDetailedLists) {
        findings.push(`Kun de to nyeste udgivelser må have punktlister (post ${index + 1}).`);
    }
    if (index >= 2) {
        if (!/^\d{4}-\d{2}$/.test(entry.month || '')) {
            findings.push(`Ældre post ${index + 1} mangler month: 'YYYY-MM'.`);
        }
        if (!entry.summary || !entry.summary.da || !entry.summary.en) {
            findings.push(`Ældre post ${index + 1} mangler månedsopsummering på dansk eller engelsk.`);
        }
    }
});

const months = history.slice(2).map(entry => entry.month).filter(Boolean);
const duplicateMonths = months.filter((month, index) => months.indexOf(month) !== index);
if (duplicateMonths.length) {
    findings.push(`Ældre historik skal samles til én post pr. måned: ${[...new Set(duplicateMonths)].join(', ')}.`);
}

if (findings.length) {
    console.error('Versionshistorik-kontrol fejlede:');
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exit(1);
}

console.log(`Versionshistorik-kontrol: OK (${history.length} poster, ${months.length} månedsopsummeringer)`);
