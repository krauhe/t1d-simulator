// Afprøver pakning, fast stable-commit, filadskillelse og afvisning af usikre
// destinationsmapper. Output er nye, ignorerede mapper; eksisterende filer røres ikke.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildSite, publicFile } = require('../tools/releases/build-pages.cjs');
const root = path.resolve(__dirname, '..');
const out = '.release-builds/test-' + Date.now();
const manifest = buildSite({ out });
let checks = 0;
function check(name, action) { action(); checks++; console.log('PASS ' + name); }
const read = name => fs.readFileSync(path.join(root, out, name), 'utf8');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
check('Stable is the verified published commit', () => {
    const pin = JSON.parse(fs.readFileSync(path.join(root, 'tools/releases/channels.json'), 'utf8'));
    assert.equal(manifest.channels.stable.commit, pin.stableCommit);
    assert.equal(manifest.channels.stable.version, pin.stableVersion);
    assert.equal(manifest.localWorkingTree, false);
});
check('Every application JS/CSS/media file is byte-identical to its own source', () => {
    for (const channel of ['stable', 'preview']) {
        const prefix = channel === 'preview' ? 'preview/' : '';
        for (const [name, expected] of Object.entries(manifest.channels[channel].sourceHashes)) {
            if (name.endsWith('.html') || name.endsWith('.webmanifest')) continue;
            assert.equal(digest(path.join(root, out, prefix, name)), expected, prefix + name);
        }
    }
});
check('Private material and tooling cannot enter the website', () => {
    for (const name of ['editor.local.html', 'developer input/paper.pdf', 'docs/references/paper.pdf',
        'docs/reviews/private.html', 'node_modules/index.js', 'AGENTS.md', '.git/config',
        'js/private.local.js', 'js/developer-lab.js', 'mobile/editor.local.html', 'docs/diagrams/private-review.js',
        'output/pdf/review.pdf', 'tools/releases/channels.json', 'sounds/tour/da/generation-log.txt']) {
        assert.equal(publicFile(name), false, name);
        assert.equal(fs.existsSync(path.join(root, out, name)), false, name);
    }
});
check('Bootstrap precedes inline routing and all original scripts', () => {
    for (const name of ['index.html', 'mobile/index.html', 'physiology-dashboard.html', 'tests/model-validation.html']) {
        for (const prefix of ['', 'preview/']) {
            const html = read(prefix + name);
            assert.ok(html.indexOf('window.T1D_RELEASE') < html.indexOf('storage-scope.js'));
            assert.ok(html.indexOf('storage-scope.js') < html.indexOf('channel.js'));
            assert.ok(html.indexOf('channel.js') < html.indexOf('localStorage') || !html.includes('localStorage'));
            assert.ok(html.includes("channel === 'preview' && !window.T1D_RELEASE_READY"));
            assert.match(html, /release=[a-f0-9]{16}/);
        }
    }
});
check('Preview is labelled, not indexed, and has a separate installable app name', () => {
    assert.match(read('preview/index.html'), /<title>\[Preview\]/);
    assert.match(read('preview/index.html'), /noindex,nofollow/);
    assert.doesNotMatch(read('index.html'), /noindex,nofollow/);
    const app = JSON.parse(read('preview/mobile/manifest.webmanifest'));
    assert.equal(app.short_name, 'T1D Preview');
    assert.equal(app.start_url, '.');
});
check('Existing directories and paths outside the build area are rejected', () => {
    assert.throws(() => buildSite({ out }), /Output exists/);
    assert.throws(() => buildSite({ out: '.' }), /new directory under/);
    assert.throws(() => buildSite({ out: '../bad' }), /new directory under/);
});
check('Documentation links, including help templates, follow the source commit', () => {
    for (const channel of ['stable', 'preview']) {
        const html = read((channel === 'preview' ? 'preview/' : '') + 'index.html');
        assert.doesNotMatch(html, /t1d-simulator\/blob\/main\/docs\//);
        assert.ok(html.includes('/blob/' + manifest.channels[channel].commit + '/docs/'));
    }
});
check('Stable and preview include their own diagnostics', () => {
    for (const prefix of ['', 'preview/']) {
        assert.ok(read(prefix + 'tests/model-validation.html').includes('../js/hovorka.js'));
        assert.ok(fs.existsSync(path.join(root, out, prefix + 'physiology-dashboard.html')));
    }
});
check('Diagram pages include both SVG figures and their raster fallbacks', () => {
    for (const channel of ['stable', 'preview']) {
        const prefix = channel === 'preview' ? 'preview/' : '';
        for (const name of Object.keys(manifest.channels[channel].sourceHashes)) {
            if (!/^docs\/diagrams\/[^/]+\/[^/]+-diagram\.html$/.test(name)) continue;
            const html = read(prefix + name);
            for (const match of html.matchAll(/(?:src|data)="(figure\.svg|validation\.png)"/g)) {
                assert.ok(fs.existsSync(path.join(root, out, prefix, path.dirname(name), match[1])),
                    `${prefix}${name} requires ${match[1]}`);
            }
        }
    }
});
console.log(`${checks}/${checks} checks passed. Build: ${out}`);
