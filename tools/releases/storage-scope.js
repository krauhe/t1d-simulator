// Browserlager for preview-udgivelser, uden ændringer i simulatorens kildefiler.
// Adapteren giver de eksisterende Storage-metoder et fast navneområde. Stable
// beholder sine oprindelige nøgler. Dette er dataadskillelse, ikke en
// sikkerhedsgrænse mellem sider på samme origin (protokol, vært og port).
//
// Indlæs før ALLE app-scripts, også inline-platformrouting. Kald derefter
// T1DStorageScope.install(window, 't1d-preview:'). Ved fejl skal udgivelsesskallen
// stoppe indlæsningen af appen; et kast stopper ikke senere script-tags alene.
// Der må aldrig fortsættes med det oprindelige, uafgrænsede browserlager.
//
// Dækker de API'er appen bruger: getItem, setItem, removeItem, key og length.
// clear understøttes også og sletter kun navneområdets egne nøgler. Direkte
// egenskabsadgang (storage.foo/storage['foo']), Storage.prototype-kald og
// storage-events understøttes ikke; nye brugsmønstre kræver en ny vurdering.
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.T1DStorageScope = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const installations = new WeakMap();

    function validatePrefix(prefix) {
        if (typeof prefix !== 'string' || !prefix.length) {
            throw new TypeError('Storage scope must have a non-empty prefix.');
        }
    }

    // DOMString tillader almindelig strengkonvertering, men ikke Symbol.
    function storageString(value) {
        if (typeof value === 'symbol') throw new TypeError('Storage cannot convert a Symbol.');
        return String(value);
    }

    function requireArguments(count, expected) {
        if (count < expected) throw new TypeError('Missing required Storage argument.');
    }

    function createScopedStorage(nativeStorage, prefix) {
        validatePrefix(prefix);
        if (!nativeStorage) throw new TypeError('Native storage is unavailable.');

        // Bind til det ægte lager: browserens metoder kræver den rigtige receiver.
        // Den oprindelige reference forbliver privat i funktionernes closure.
        const nativeGet = nativeStorage.getItem.bind(nativeStorage);
        const nativeSet = nativeStorage.setItem.bind(nativeStorage);
        const nativeRemove = nativeStorage.removeItem.bind(nativeStorage);
        const nativeKey = nativeStorage.key.bind(nativeStorage);

        function scopedKeys() {
            const keys = [];
            for (let index = 0; index < nativeStorage.length; index++) {
                const key = nativeKey(index);
                if (key !== null && key.startsWith(prefix)) keys.push(key.slice(prefix.length));
            }
            return keys;
        }

        const facade = Object.create(null);
        Object.defineProperties(facade, {
            getItem: { value: function (key) {
                requireArguments(arguments.length, 1);
                return nativeGet(prefix + storageString(key));
            } },
            setItem: { value: function (key, value) {
                requireArguments(arguments.length, 2);
                nativeSet(prefix + storageString(key), storageString(value));
            } },
            removeItem: { value: function (key) {
                requireArguments(arguments.length, 1);
                nativeRemove(prefix + storageString(key));
            } },
            key: { value: function (index) {
                requireArguments(arguments.length, 1);
                // Storage.key bruger et unsigned 32-bit indeks, ligesom >>> 0.
                return scopedKeys()[index >>> 0] ?? null;
            } },
            length: { get: function () { return scopedKeys().length; } },
            clear: { value: function () {
                // Tag først en kopi; ellers flytter sletning indeksene under løkken.
                for (const key of scopedKeys()) nativeRemove(prefix + key);
            } }
        });
        return Object.freeze(facade);
    }

    function install(targetWindow, prefix = 't1d-preview:') {
        validatePrefix(prefix);
        const previous = installations.get(targetWindow);
        if (previous) {
            if (previous.prefix !== prefix) throw new Error('A different storage scope is already installed.');
            return previous.storage;
        }

        const replacements = {};
        const storage = {};
        for (const name of ['localStorage', 'sessionStorage']) {
            // Kontrollér begge globale egenskaber, før nogen erstattes. Læsning af
            // det oprindelige lager kan også kaste SecurityError i browseren.
            const descriptor = Object.getOwnPropertyDescriptor(targetWindow, name);
            if ((descriptor && !descriptor.configurable) || (!descriptor && !Object.isExtensible(targetWindow))) {
                throw new Error('Cannot safely install scoped ' + name + '.');
            }
            const facade = createScopedStorage(targetWindow[name], prefix);
            storage[name] = facade;
            replacements[name] = { value: facade, enumerable: true, configurable: false, writable: false };
        }

        // Ingen catch/fallback: en fejl skal håndteres som en blokeret preview-app.
        Object.defineProperties(targetWindow, replacements);
        Object.freeze(storage);
        installations.set(targetWindow, { prefix: prefix, storage: storage });
        return storage;
    }

    return Object.freeze({ createScopedStorage: createScopedStorage, install: install });
});
