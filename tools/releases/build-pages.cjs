// Bygger to selvstændige Pages-udgaver uden at ændre kildetræ eller Git-historik.
// Stabil hentes fra et låst commit; preview hentes fra HEAD eller, kun lokalt,
// arbejdsfilerne. Kun den eksplicitte liste af offentlige runtimefiler medtages.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const runtimeScripts = new Set(['archetypes', 'campaign-core', 'campaign', 'dose-controls',
    'editor', 'foods', 'game', 'graph-renderer', 'guide-data', 'hovorka', 'i18n', 'levels',
    'main', 'physiology-engine', 'simulator', 'sounds', 'symptoms', 'ui', 'version-data', 'welcome-tour']
    .map(name => `js/${name}.js`));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function git(args, options = {}) {
    return cp.execFileSync('git', args, { cwd: root, maxBuffer: 512 * 1024 * 1024, ...options });
}
function publicFile(file) {
    return ['index.html', 'style.css', 'physiology-dashboard.html', 'LICENSE',
        'tests/model-validation.html', 'tests/validation-metrics.js'].includes(file)
        || runtimeScripts.has(file)
        || ['mobile/index.html', 'mobile/mobile.css', 'mobile/mobile.js', 'mobile/manifest.webmanifest'].includes(file)
        || /^assets\/.*\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(file)
        || /^sounds\/.*\.(mp3|wav|ogg)$/i.test(file)
        || /^docs\/diagrams\/[^/]+\/(?:[^/]+-diagram\.html|figure\.svg|validation\.png)$/.test(file);
}
function committedFiles(commit) {
    const entries = git(['ls-tree', '-rz', commit]).toString('utf8').split('\0').filter(Boolean);
    const names = entries.map(entry => {
        const [meta, file] = entry.split('\t');
        if (!publicFile(file)) return null;
        if (!/^100644 blob |^100755 blob /.test(meta)) throw new Error(`Not a regular file: ${file}`);
        if (/[\r\n]/.test(file)) throw new Error('Unsupported filename');
        return file;
    }).filter(Boolean);
    // batch læser binære Git-blobs direkte. Ingen checkout, shell eller tar-udpakning.
    const data = git(['cat-file', '--batch'], { input: names.map(name => `${commit}:${name}\n`).join('') });
    let position = 0;
    return new Map(names.map(name => {
        const newline = data.indexOf(10, position);
        const match = data.subarray(position, newline).toString().match(/^[a-f0-9]+ blob (\d+)$/);
        if (!match) throw new Error(`Cannot read ${name}`);
        const size = Number(match[1]);
        const bytes = data.subarray(newline + 1, newline + 1 + size);
        position = newline + size + 2;
        return [name, bytes];
    }));
}
function versionOf(files) {
    const match = files.get('js/version-data.js')?.toString().match(/version:\s*'([^']+)'/);
    if (!match || !/^\d+\.\d+\.\d+-beta$/.test(match[1])) throw new Error('Missing/invalid app version');
    return match[1];
}
function decorateHtml(html, name, metadata, shellHash) {
    const relativeRoot = '../'.repeat(name.split('/').length - 1);
    const releasePath = `${relativeRoot}_release/`;
    const config = JSON.stringify(metadata).replace(/</g, '\\u003c');
    const bootstrap = `\n<script>window.T1D_RELEASE = ${config};</script>\n`
        + `<script src="${releasePath}storage-scope.js?v=${shellHash}"></script>\n`
        + `<script src="${releasePath}channel.js?v=${shellHash}"></script>\n`
        // Separat inline-guard beskytter også mod 404/parsefejl i bootstrap selv.
        + `<script>if (window.T1D_RELEASE.channel === 'preview' && !window.T1D_RELEASE_READY) { window.stop(); location.replace('${releasePath}unavailable.html'); }</script>\n`;
    // Placering før platform-routing og før ethvert lageropslag er afgørende.
    if (!/<meta\s+charset=[^>]+>/i.test(html)) throw new Error(`Missing charset: ${name}`);
    html = html.replace(/<meta\s+charset=[^>]+>/i, match => match + bootstrap);
    html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="${releasePath}channel.css?v=${shellHash}">\n</head>`);
    if (metadata.channel === 'preview') {
        html = html.replace(/<title>/i, '<title>[Preview] ')
            .replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow">\n</head>');
    }
    // Omfatter også ankre inde i <template>, som querySelectorAll ikke ser.
    html = html.replaceAll('https://github.com/krauhe/t1d-simulator/blob/main/docs/',
        `https://github.com/krauhe/t1d-simulator/blob/${metadata.commit}/docs/`);
    // Nye deploys får nye cache-id'er, også når en historisk side har gamle ?v=.
    return html.replace(/((?:src|href)=["'])([^"']+\.(?:js|css)(?:\?[^"']*)?)(["'])/gi,
        (full, before, url, after) => /^(https?:|\/\/|data:)/i.test(url) ? full
            : before + url + (url.includes('?') ? '&' : '?') + 'release=' + metadata.contentId + after);
}
function buildSite({ out, previewRef = 'HEAD', workingTree = false, configPath = path.join(__dirname, 'channels.json') }) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(config.stableCommit)
        || config.previewDirectory !== 'preview') throw new Error('Invalid channel configuration');
    const destination = path.resolve(root, out || '');
    const allowedRoot = path.join(root, '.release-builds') + path.sep;
    if (!destination.startsWith(allowedRoot)) throw new Error('Output must be a new directory under .release-builds/');
    if (fs.existsSync(destination)) throw new Error('Output exists; choose a new directory. Nothing overwritten.');
    const previewCommit = git(['rev-parse', '--verify', `${previewRef}^{commit}`]).toString().trim();
    const bundles = {
        stable: committedFiles(config.stableCommit),
        preview: committedFiles(previewCommit)
    };
    if (workingTree) {
        // Kun tracked runtimefiler; nye filer kræver Git-staging og allowliste.
        // Ingen rå
        // downloads, lokale launchere, testresultater eller private reviewpakker.
        const names = git(['ls-files', '-z', '--cached']).toString().split('\0');
        bundles.preview = new Map([...new Set(names.filter(publicFile))].filter(name => fs.existsSync(path.join(root, name))).map(name => {
            const file = path.join(root, name);
            if (!fs.lstatSync(file).isFile()) throw new Error(`Not a regular file: ${name}`);
            return [name, fs.readFileSync(file)];
        }));
    }
    if (versionOf(bundles.stable) !== config.stableVersion) throw new Error('Stable commit/version mismatch');
    const shell = ['storage-scope.js', 'channel.js', 'channel.css'].map(name => [name, fs.readFileSync(path.join(__dirname, name))]);
    const shellHash = hash(Buffer.concat(shell.map(([, bytes]) => bytes))).slice(0, 16);
    const manifest = { schemaVersion: 1, localWorkingTree: workingTree, shellHash, channels: {} };
    for (const [channel, files] of Object.entries(bundles)) {
        for (const required of ['index.html', 'mobile/index.html', 'js/hovorka.js', 'js/simulator.js']) {
            if (!files.has(required)) throw new Error(`Missing ${channel}/${required}`);
        }
        const hashes = Object.fromEntries([...files].map(([name, bytes]) => [name, hash(bytes)]));
        const metadata = {
            channel, version: versionOf(files),
            commit: channel === 'stable' ? config.stableCommit : previewCommit,
            localWorkingTree: channel === 'preview' && workingTree,
            contentId: hash(JSON.stringify(hashes)).slice(0, 16)
        };
        const folder = channel === 'stable' ? destination : path.join(destination, 'preview');
        const write = (name, bytes) => {
            const file = path.join(folder, name);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        };
        for (const [name, original] of files) {
            // Diagrammer er statiske referencefigurer, ikke selvstændige spilvinduer.
            const decorate = ['index.html', 'mobile/index.html', 'physiology-dashboard.html', 'tests/model-validation.html'].includes(name);
            write(name, decorate ? decorateHtml(original.toString('utf8'), name, metadata, shellHash) : original);
        }
        for (const [name, bytes] of shell) write('_release/' + name, bytes);
        write('_release/unavailable.html', '<!doctype html><html lang="en"><meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview unavailable</title>'
            + '<body style="font:18px/1.6 system-ui;max-width:42em;margin:3em auto;padding:1em">'
            + '<h1>Preview unavailable</h1><p>Preview storage isolation failed. The game has not started.</p>'
            + '<p lang="da">Testversionen kunne ikke åbnes med separat lagring. Spillet er ikke startet.</p>'
            + `<a href="${channel === 'preview' ? '../../' : '../'}index.html">Åbn stabil version / Open stable version</a></body></html>`);
        if (channel === 'preview' && files.has('mobile/manifest.webmanifest')) {
            const app = JSON.parse(files.get('mobile/manifest.webmanifest'));
            app.name = 'T1D Simulator — Preview'; app.short_name = 'T1D Preview';
            write('mobile/manifest.webmanifest', JSON.stringify(app, null, 2));
        }
        write('_release/metadata.json', JSON.stringify(metadata, null, 2));
        manifest.channels[channel] = { ...metadata, sourceHashes: hashes };
    }
    fs.writeFileSync(path.join(destination, '.nojekyll'), '');
    fs.writeFileSync(path.join(destination, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
}
module.exports = { buildSite, publicFile, committedFiles };
if (require.main === module) {
    const args = process.argv.slice(2);
    const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const manifest = buildSite({ out: value('--out'), previewRef: value('--preview-ref'), workingTree: args.includes('--working-tree') });
    console.log(JSON.stringify({ output: value('--out'), stable: manifest.channels.stable.commit,
        preview: manifest.channels.preview.commit, localWorkingTree: manifest.localWorkingTree }, null, 2));
}
