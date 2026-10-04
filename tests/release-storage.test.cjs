// Afgrænsede tests af udgivelseslagets browserlager. Falske Storage-objekter
// deler rå nøgler som stable og preview gør på samme origin. Testene bruger
// ingen app-/modelkode og skriver aldrig til brugerens virkelige browserlager.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createScopedStorage, install } = require('../tools/releases/storage-scope.js');

const PREFIX = 't1d-preview:';

function nativeStorage(entries = {}) {
    const values = new Map(Object.entries(entries));
    return {
        get length() { return values.size; },
        key(index) { return Array.from(values.keys())[index] ?? null; },
        getItem(key) { return values.get(String(key)) ?? null; },
        setItem(key, value) { values.set(String(key), String(value)); },
        removeItem(key) { values.delete(String(key)); },
        clear() { values.clear(); }
    };
}

function browserWindow(local = nativeStorage(), session = nativeStorage()) {
    const target = {};
    Object.defineProperties(target, {
        localStorage: { get: () => local, configurable: true, enumerable: true },
        sessionStorage: { get: () => session, configurable: true, enumerable: true }
    });
    return target;
}

test('Preview læser ikke stable og gemmer kun med præfiks', () => {
    const native = nativeStorage({ t1dSimSettings: 'stable', t1d_platform: 'mobile' });
    const preview = createScopedStorage(native, PREFIX);
    assert.equal(preview.getItem('t1dSimSettings'), null);
    assert.equal(preview.getItem('t1d_platform'), null);
    preview.setItem('t1dSimSettings', 'preview');
    preview.setItem('t1d_platform', 'desktop');
    assert.equal(native.getItem('t1dSimSettings'), 'stable');
    assert.equal(native.getItem('t1d_platform'), 'mobile');
    assert.equal(native.getItem(PREFIX + 't1dSimSettings'), 'preview');
    assert.equal(preview.getItem('t1d_platform'), 'desktop');
    preview.removeItem('t1dSimSettings');
    assert.equal(native.getItem('t1dSimSettings'), 'stable');
    assert.equal(preview.getItem('t1dSimSettings'), null);
});

test('length/key viser kun logiske preview-nøgler; clear bevarer stable og andre apps', () => {
    const native = nativeStorage({ stable: 'keep', unrelated: 'keep', [PREFIX + 'first']: '1' });
    const preview = createScopedStorage(native, PREFIX);
    preview.setItem('second', '2');
    assert.equal(preview.length, 2);
    assert.deepEqual([preview.key(0), preview.key(1)], ['first', 'second']);
    assert.equal(preview.key(2), null);
    assert.equal(preview.key(-1), null);
    assert.equal(preview.key('1'), 'second');
    preview.clear();
    assert.equal(preview.length, 0);
    assert.equal(native.length, 2);
    assert.equal(native.getItem('stable'), 'keep');
    assert.equal(native.getItem('unrelated'), 'keep');
});

test('Mobilens eksisterende highscore-løkke sletter kun sin egen kanal', () => {
    // Samme key/length/removeItem-mønster som mobile/mobile.js clearHighscores.
    function clearHighscores(storage) {
        const keys = [];
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key && key.indexOf('t1dSimHighscores') === 0) keys.push(key);
        }
        keys.forEach(key => storage.removeItem(key));
    }
    const native = nativeStorage({ t1dSimHighscores: 'stable', t1dSimHighscores_boxchallenge: 'stable-box' });
    const preview = createScopedStorage(native, PREFIX);
    preview.setItem('t1dSimHighscores', 'preview');
    preview.setItem('t1dSimHighscores_boxchallenge', 'preview-box');
    preview.setItem('t1dSimSettings', 'keep');
    clearHighscores(preview);
    assert.equal(native.getItem('t1dSimHighscores'), 'stable');
    assert.equal(native.getItem('t1dSimHighscores_boxchallenge'), 'stable-box');
    assert.equal(preview.getItem('t1dSimHighscores'), null);
    assert.equal(preview.getItem('t1dSimSettings'), 'keep');
    preview.setItem('t1dSimHighscores', 'preview-again');
    clearHighscores(native);
    assert.equal(native.getItem('t1dSimHighscores'), null);
    assert.equal(preview.getItem('t1dSimHighscores'), 'preview-again');
});

test('Desktop og mobil i preview deler data; forskellige præfikser gør ikke', () => {
    const native = nativeStorage();
    const desktop = createScopedStorage(native, PREFIX);
    const mobile = createScopedStorage(native, PREFIX);
    const other = createScopedStorage(native, 'other-preview:');
    desktop.setItem('diabetesDystenProfile', '{"characterId":"erik"}');
    assert.equal(mobile.getItem('diabetesDystenProfile'), '{"characterId":"erik"}');
    assert.equal(other.getItem('diabetesDystenProfile'), null);
    assert.equal(native.getItem('diabetesDystenProfile'), null);
});

test('Strengkonvertering, tomme nøgler og manglende argumenter', () => {
    const preview = createScopedStorage(nativeStorage(), PREFIX);
    preview.setItem('', '');
    preview.setItem(7, false);
    preview.setItem(undefined, null);
    assert.equal(preview.getItem(''), '');
    assert.equal(preview.getItem('7'), 'false');
    assert.equal(preview.getItem('undefined'), 'null');
    assert.throws(() => preview.getItem(), TypeError);
    assert.throws(() => preview.setItem('missing'), TypeError);
    assert.throws(() => preview.removeItem(), TypeError);
    assert.throws(() => preview.key(), TypeError);
    assert.throws(() => preview.setItem(Symbol(), 'value'), TypeError);
    assert.throws(() => createScopedStorage(nativeStorage(), ''), TypeError);
});

test('Installation erstatter local/sessionStorage og kan gentages uden dobbelt præfiks', () => {
    const local = nativeStorage();
    const session = nativeStorage();
    const target = browserWindow(local, session);
    const result = install(target);
    assert.equal(target.localStorage, result.localStorage);
    assert.equal(target.sessionStorage, result.sessionStorage);
    target.localStorage.setItem('key', 'local');
    target.sessionStorage.setItem('key', 'session');
    assert.equal(local.getItem(PREFIX + 'key'), 'local');
    assert.equal(session.getItem(PREFIX + 'key'), 'session');
    assert.equal(install(target), result);
    assert.throws(() => install(target, 'different:'), /different storage scope/);
    assert.equal(Object.getOwnPropertyDescriptor(target, 'localStorage').configurable, false);
});

test('Utilgængeligt eller uerstatteligt browserlager kaster før delvis installation', () => {
    const local = nativeStorage({ safe: 'stable' });
    const target = browserWindow(local);
    Object.defineProperty(target, 'sessionStorage', { get: () => { throw new Error('SecurityError'); } });
    assert.throws(() => install(target), /SecurityError/);
    assert.equal(target.localStorage, local);
    assert.equal(local.getItem('safe'), 'stable');

    const fixed = browserWindow(local);
    Object.defineProperty(fixed, 'sessionStorage', { configurable: false });
    assert.throws(() => install(fixed), /Cannot safely install scoped sessionStorage/);
    assert.equal(fixed.localStorage, local);
});

test('Kvotefejl giver ingen fallback til en uafgrænset nøgle', () => {
    const calls = [];
    const native = nativeStorage();
    native.setItem = (key, value) => { calls.push([key, value]); throw new Error('QuotaExceededError'); };
    const preview = createScopedStorage(native, PREFIX);
    assert.throws(() => preview.setItem('t1dSimSettings', 'value'), /QuotaExceededError/);
    assert.deepEqual(calls, [[PREFIX + 't1dSimSettings', 'value']]);
    assert.equal(native.length, 0);
});

test('Browser-scriptet eksporteres uden Node og afgrænser det tidlige routing-opslag', () => {
    const source = fs.readFileSync(path.join(__dirname, '../tools/releases/storage-scope.js'), 'utf8');
    const local = nativeStorage({ t1d_platform: 'mobile', [PREFIX + 't1d_platform']: 'desktop' });
    const context = vm.createContext(browserWindow(local));
    vm.runInContext(source, context);
    vm.runInContext('T1DStorageScope.install(globalThis);', context);
    assert.equal(vm.runInContext("localStorage.getItem('t1d_platform')", context), 'desktop');
    assert.equal(local.getItem('t1d_platform'), 'mobile');
});
