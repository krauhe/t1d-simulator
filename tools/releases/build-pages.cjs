// Bygger én offentlig Pages-udgave fra det valgte Git-commit uden at ændre
// kildetræ eller Git-historik. Arbejdsfiler kan kun bruges til lokal kontrol.
// Kun den eksplicitte liste af offentlige runtimefiler medtages; gamle preview-
// adresser får en statisk henvisning til samme spil og ingen ekstra runtime.
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
        + `<script src="${releasePath}channel.js?v=${shellHash}"></script>\n`;
    // Placering før platform-routing og før ethvert lageropslag er afgørende.
    if (!/<meta\s+charset=[^>]+>/i.test(html)) throw new Error(`Missing charset: ${name}`);
    html = html.replace(/<meta\s+charset=[^>]+>/i, match => match + bootstrap);
    // Omfatter også ankre inde i <template>, som querySelectorAll ikke ser.
    html = html.replaceAll('https://github.com/krauhe/t1d-simulator/blob/main/docs/',
        `https://github.com/krauhe/t1d-simulator/blob/${metadata.commit}/docs/`);
    // Nye deploys får nye cache-id'er, også når en historisk side har gamle ?v=.
    return html.replace(/((?:src|href)=["'])([^"']+\.(?:js|css)(?:\?[^"']*)?)(["'])/gi,
        (full, before, url, after) => /^(https?:|\/\/|data:)/i.test(url) ? full
            : before + url + (url.includes('?') ? '&' : '?') + 'release=' + metadata.contentId + after);
}
function buildSite({ out, releaseRef = 'HEAD', workingTree = false }) {
    const destination = path.resolve(root, out || '');
    const allowedRoot = path.join(root, '.release-builds') + path.sep;
    if (!destination.startsWith(allowedRoot)) throw new Error('Output must be a new directory under .release-builds/');
    if (fs.existsSync(destination)) throw new Error('Output exists; choose a new directory. Nothing overwritten.');
    const releaseCommit = git(['rev-parse', '--verify', `${releaseRef}^{commit}`]).toString().trim();
    let files = committedFiles(releaseCommit);
    if (workingTree) {
        // Kun tracked runtimefiler; nye filer kræver Git-staging og allowliste.
        // Ingen rå downloads, lokale launchere, testresultater eller reviewpakker.
        const names = git(['ls-files', '-z', '--cached']).toString().split('\0');
        files = new Map([...new Set(names.filter(publicFile))].filter(name => fs.existsSync(path.join(root, name))).map(name => {
            const file = path.join(root, name);
            if (!fs.lstatSync(file).isFile()) throw new Error(`Not a regular file: ${name}`);
            return [name, fs.readFileSync(file)];
        }));
    }
    const shell = [['channel.js', fs.readFileSync(path.join(__dirname, 'channel.js'))]];
    const shellHash = hash(Buffer.concat(shell.map(([, bytes]) => bytes))).slice(0, 16);
    for (const required of ['index.html', 'mobile/index.html', 'js/hovorka.js', 'js/simulator.js']) {
        if (!files.has(required)) throw new Error(`Missing ${required}`);
    }
    const hashes = Object.fromEntries([...files].map(([name, bytes]) => [name, hash(bytes)]));
    const metadata = {
        version: versionOf(files), commit: releaseCommit, localWorkingTree: workingTree,
        contentId: hash(JSON.stringify(hashes)).slice(0, 16)
    };
    const manifest = { schemaVersion: 2, localWorkingTree: workingTree, shellHash,
        release: { ...metadata, sourceHashes: hashes } };
    const write = (name, bytes) => {
        const file = path.join(destination, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
    };
    for (const [name, original] of files) {
        // Diagrammer er statiske referencefigurer, ikke selvstændige spilvinduer.
        const decorate = ['index.html', 'mobile/index.html', 'physiology-dashboard.html', 'tests/model-validation.html'].includes(name);
        write(name, decorate ? decorateHtml(original.toString('utf8'), name, metadata, shellHash) : original);
    }
    for (const [name, bytes] of shell) write('_release/' + name, bytes);
    write('_release/metadata.json', JSON.stringify(metadata, null, 2));
    // Gamle bogmærker peger frem til én udgave. Ingen preview-model, lyd eller
    // lagerwrapper kopieres, og omdirigeringen bevarer eksplicit platformvalg.
    for (const [oldPage, target] of Object.entries({
        'preview/index.html': '../index.html',
        'preview/mobile/index.html': '../../mobile/',
        'preview/physiology-dashboard.html': '../physiology-dashboard.html',
        'preview/tests/model-validation.html': '../../tests/model-validation.html'
    })) {
        write(oldPage, '<!doctype html><html lang="en"><head><meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1">'
            + `<meta http-equiv="refresh" content="0;url=${target}">`
            + '<meta name="robots" content="noindex,nofollow"><title>T1D Simulator</title></head>'
            + `<body><p><a href="${target}">Åbn T1D Simulator / Open T1D Simulator</a></p>`
            + `<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script></body></html>`);
    }
    fs.writeFileSync(path.join(destination, '.nojekyll'), '');
    fs.writeFileSync(path.join(destination, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
}
module.exports = { buildSite, publicFile, committedFiles };
if (require.main === module) {
    const args = process.argv.slice(2);
    const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const manifest = buildSite({ out: value('--out'), releaseRef: value('--ref'), workingTree: args.includes('--working-tree') });
    console.log(JSON.stringify({ output: value('--out'), release: manifest.release.commit,
        version: manifest.release.version, localWorkingTree: manifest.localWorkingTree }, null, 2));
}
