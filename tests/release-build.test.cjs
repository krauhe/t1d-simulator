// Afprøver én offentlig pakke, dens valgte commit og afvisning af usikre
// destinationsmapper. Output er nye, ignorerede mapper; eksisterende filer røres ikke.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { buildSite, publicFile } = require('../tools/releases/build-pages.cjs');
const root = path.resolve(__dirname, '..');
const out = '.release-builds/test-' + Date.now();
const manifest = buildSite({ out });
let checks = 0;
function check(name, action) { action(); checks++; console.log('PASS ' + name); }
const read = name => fs.readFileSync(path.join(root, out, name), 'utf8');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
check('The single release is the selected HEAD commit', () => {
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.channels, undefined);
    assert.equal(manifest.release.commit, cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
    assert.equal(manifest.release.localWorkingTree, false);
    assert.equal(manifest.localWorkingTree, false);
});
check('Every application JS/CSS/media file is byte-identical to its own source', () => {
    for (const [name, expected] of Object.entries(manifest.release.sourceHashes)) {
        if (name.endsWith('.html')) continue;
        assert.equal(digest(path.join(root, out, name)), expected, name);
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
        const html = read(name);
        assert.ok(html.indexOf('window.T1D_RELEASE') < html.indexOf('channel.js'));
        assert.ok(html.indexOf('channel.js') < html.indexOf('localStorage') || !html.includes('localStorage'));
        assert.doesNotMatch(html, /storage-scope\.js|channel\.css|T1D_RELEASE_READY/);
        assert.match(html, /release=[a-f0-9]{16}/);
    }
});
check('Old preview addresses redirect without retaining a second playable runtime', () => {
    assert.match(read('preview/index.html'), /location\.replace\("\.\.\/index\.html"/);
    assert.match(read('preview/mobile/index.html'), /location\.replace\("\.\.\/\.\.\/mobile\/"/);
    assert.match(read('preview/index.html'), /noindex,nofollow/);
    assert.doesNotMatch(read('index.html'), /noindex,nofollow/);
    assert.doesNotMatch(read('index.html'), /<title>\[Preview\]/);
    for (const name of ['preview/js', 'preview/assets', 'preview/sounds', 'preview/_release',
        'preview/mobile/manifest.webmanifest', '_release/storage-scope.js', '_release/channel.css']) {
        assert.equal(fs.existsSync(path.join(root, out, name)), false, name);
    }
    const app = JSON.parse(read('mobile/manifest.webmanifest'));
    assert.doesNotMatch(app.name, /Preview/);
    assert.equal(app.start_url, '.');
});
check('Existing directories and paths outside the build area are rejected', () => {
    assert.throws(() => buildSite({ out }), /Output exists/);
    assert.throws(() => buildSite({ out: '.' }), /new directory under/);
    assert.throws(() => buildSite({ out: '../bad' }), /new directory under/);
});
check('Documentation links, including help templates, follow the source commit', () => {
    const html = read('index.html');
    assert.doesNotMatch(html, /t1d-simulator\/blob\/main\/docs\//);
    assert.ok(html.includes('/blob/' + manifest.release.commit + '/docs/'));
});
check('The release includes diagnostics at the root only', () => {
    assert.ok(read('tests/model-validation.html').includes('../js/hovorka.js'));
    assert.ok(fs.existsSync(path.join(root, out, 'physiology-dashboard.html')));
    assert.doesNotMatch(read('preview/tests/model-validation.html'), /<script src=/);
});
check('Diagram pages include both SVG figures and their raster fallbacks', () => {
    for (const name of Object.keys(manifest.release.sourceHashes)) {
        if (!/^docs\/diagrams\/[^/]+\/[^/]+-diagram\.html$/.test(name)) continue;
        const html = read(name);
        for (const match of html.matchAll(/(?:src|data)="(figure\.svg|validation\.png)"/g)) {
            assert.ok(fs.existsSync(path.join(root, out, path.dirname(name), match[1])),
                `${name} requires ${match[1]}`);
        }
    }
});
console.log(`${checks}/${checks} checks passed. Build: ${out}`);
