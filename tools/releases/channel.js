// Udgivelsesmetadata indlæses før spillets første script. Dokumentationslinks
// følger den viste udgaves commit. Der findes kun én offentlig udgave, så denne
// fil tilføjer hverken navigation, mærkater eller ændringer af browserens lager.
(function () {
    'use strict';
    const release = window.T1D_RELEASE;
    const siteRoot = new URL('../', document.currentScript.src);

    // Kildedokumentation skal følge den viste udgave, ikke en senere main.
    // En lokal arbejdsudgave kan have nyere dokumentation end sit base-commit.
    function documentationUrl(value) {
        if (value == null) return value;
        const url = new URL(value, location.href);
        const prefix = '/krauhe/t1d-simulator/blob/main/docs/';
        if (url.origin === 'https://github.com' && url.pathname.startsWith(prefix)) {
            url.pathname = url.pathname.replace('/blob/main/', '/blob/' + release.commit + '/');
        }
        return url.href;
    }
    const openWindow = window.open.bind(window);
    window.open = function (url, target, features) {
        return openWindow(documentationUrl(url), target, features);
    };
    function pinLink(event) {
        const link = event.target.closest?.('a[href]');
        if (link) link.href = documentationUrl(link.href);
    }
    document.addEventListener('click', pinLink, true);
    document.addEventListener('auxclick', pinLink, true);
    document.addEventListener('contextmenu', pinLink, true);

    function prepareLinks() {
        // Deling fra mobil skal bruge den samme offentlige rod som desktop.
        if (typeof DESKTOP_URL !== 'undefined') window.DESKTOP_URL = siteRoot.href;
        document.querySelectorAll('a[href]').forEach(link => { link.href = documentationUrl(link.href); });
    }
    document.addEventListener('DOMContentLoaded', prepareLinks, { once: true });
})();
