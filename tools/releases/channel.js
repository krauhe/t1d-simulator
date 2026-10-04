// Udgivelsesskal, indlæst før spillets første script. Tilføjer kanalnavigation,
// isoleret preview-lagring og kanalfast dashboard uden at redigere modelkoden.
(function () {
    'use strict';
    const release = window.T1D_RELEASE;
    const channelRoot = new URL('../', document.currentScript.src);
    const preview = release.channel === 'preview';
    const siteRoot = preview ? new URL('../', channelRoot) : channelRoot;
    const mobile = location.pathname.startsWith(new URL('mobile/', channelRoot).pathname);
    const otherRoot = preview ? siteRoot : new URL('preview/', siteRoot);
    const otherUrl = new URL(mobile ? 'mobile/' : 'index.html', otherRoot);

    if (preview) {
        try {
            window.T1DStorageScope.install(window, 't1d-preview:');
        } catch (error) {
            // Et kast alene stopper ikke senere script-tags. Stop parser/hentning
            // og navigér til en statisk fejlside uden appkode eller lageradgang.
            window.stop();
            location.replace(new URL('_release/unavailable.html', channelRoot).href);
            return;
        }
    }
    window.T1D_RELEASE_READY = true;

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
        const scopedTarget = target === 'physiologyDashboard' ? target + '-' + release.channel : target;
        return openWindow(documentationUrl(url), scopedTarget, features);
    };
    function pinLink(event) {
        const link = event.target.closest?.('a[href]');
        if (link) link.href = documentationUrl(link.href);
    }
    document.addEventListener('click', pinLink, true);
    document.addEventListener('auxclick', pinLink, true);
    document.addEventListener('contextmenu', pinLink, true);

    function showChannel() {
        const bar = document.createElement('nav');
        bar.id = 't1d-release-bar';
        bar.dataset.channel = release.channel;
        bar.setAttribute('aria-label', 'Release version');
        const label = document.createElement('span');
        const switchLink = document.createElement('a');
        switchLink.href = otherUrl.href;
        switchLink.id = 't1d-release-switch';
        bar.append(label, switchLink);
        document.body.prepend(bar);
        document.documentElement.classList.add('t1d-release-shell');
        if (mobile) document.documentElement.classList.add('t1d-release-mobile');

        // Udgivelsesskallen deles også med den frosne udgave, hvis i18n-fil ikke
        // må ændres. Derfor ligger disse få tosprogede tekster i selve skallen.
        // en-version: 2026-10-04-v1; da-translated-from-en: 2026-10-04-v1
        function translate() {
            const english = document.documentElement.lang === 'en';
            const name = preview ? (english ? 'Preview — may contain bugs' : 'Testversion — kan indeholde fejl')
                : (english ? 'Stable version' : 'Stabil version');
            label.textContent = name + ' · ' + release.version + ' · ' + release.commit.slice(0, 7)
                + (release.localWorkingTree ? (english ? ' · local changes' : ' · lokale ændringer') : '');
            switchLink.textContent = preview ? (english ? 'Open stable version' : 'Åbn stabil version')
                : (english ? 'Try preview' : 'Prøv testversion');
            switchLink.title = english ? 'Opens the other version. Game progress is separate.'
                : 'Åbner den anden udgave. Spilfremskridt holdes adskilt.';
        }
        translate();
        new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        // Mobilens delingsknap skal dele samme kanal som den åbne udgave.
        if (typeof DESKTOP_URL !== 'undefined') window.DESKTOP_URL = channelRoot.href;
        document.querySelectorAll('a[href]').forEach(link => { link.href = documentationUrl(link.href); });
    }
    document.addEventListener('DOMContentLoaded', showChannel, { once: true });
})();
