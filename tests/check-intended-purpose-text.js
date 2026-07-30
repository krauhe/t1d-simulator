// =============================================================================
// CHECK-INTENDED-PURPOSE-TEXT.JS - kontrol af aktiv produkttekst
// =============================================================================
//
// Scriptet beskytter den offentlige tekst mod kendte formuleringer, som enten
// gør den fiktive karakters værdier personlige eller påstår klinisk validering af
// den samlede simulator. Kontrollen er bevidst smal: videnskabelige kilder,
// historiske planer og review-filer scannes ikke.
//
// Kør med:
//   tests/.bin/node.exe tests/check-intended-purpose-text.js
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const activeTextFiles = [
    'README.md',
    'index.html',
    'mobile/index.html',
    'js/i18n.js',
    'js/guide-data.js',
    'js/levels.js',
    'js/welcome-tour.js',
    'tools/generate-tour-audio.ps1',
    'docs/INTENDED-PURPOSE.md',
    'docs/MODEL-IMPLEMENTATION.md',
    'docs/MODEL-API.md',
];

const forbiddenPatterns = [
    { pattern: /play it safe, before it really counts/gi, reason: 'gammelt slogan' },
    { pattern: /spil sikkert, før det virkelig tæller/gi, reason: 'gammelt slogan' },
    { pattern: /clinically validated/gi, reason: 'påstand om klinisk validering' },
    { pattern: /clinically accurate/gi, reason: 'påstand om klinisk nøjagtighed' },
    { pattern: /klinisk valideret/gi, reason: 'påstand om klinisk validering' },
    { pattern: /your (?:current )?blood (?:sugar|glucose)/gi, reason: 'karakterens blodsukker gøres personligt' },
    { pattern: /(?:dit|dine) (?:aktuelle )?blodsukker(?:målinger)?/gi, reason: 'karakterens blodsukker gøres personligt' },
    { pattern: /your (?:basal )?dose/gi, reason: 'dosis gøres personlig' },
    { pattern: /din (?:basal)?dosis/gi, reason: 'dosis gøres personlig' },
    { pattern: /your (?:ISF|ICR|insulin sensitivity|weight)/gi, reason: 'modelparameter gøres personlig' },
    { pattern: /din (?:ISF|ICR|insulinfølsomhed|vægt)/gi, reason: 'modelparameter gøres personlig' },
    { pattern: /ICR\s*10[^\n]{0,120}60\s*g[^\n]{0,120}6\s*(?:U|E|units?|enheder?)/gi, reason: 'konkret dosisberegning' },
];

function lineNumberAt(text, index) {
    return text.slice(0, index).split(/\r?\n/).length;
}

const findings = [];

for (const relativePath of activeTextFiles) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        findings.push(`${relativePath}: filen mangler`);
        continue;
    }

    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const rule of forbiddenPatterns) {
        rule.pattern.lastIndex = 0;
        for (const match of text.matchAll(rule.pattern)) {
            findings.push(
                `${relativePath}:${lineNumberAt(text, match.index)}: ${rule.reason}: "${match[0]}"`
            );
        }
    }
}

if (findings.length > 0) {
    console.error('Intended-purpose tekstkontrol fejlede:');
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exit(1);
}

console.log(`Intended-purpose tekstkontrol: OK (${activeTextFiles.length} aktive filer)`);
