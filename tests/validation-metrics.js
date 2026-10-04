// Fælles resultatmål for browser- og Node-validering. Ingen modelparametre.
// Genopfyldning kræver først et observeret fald under målet; en høj startværdi
// eller en måling præcis ved nul minutter må ikke blive til "over 12 timer".
(function (root) {
    function recoveryAfterNadir(data, target) {
        if (!data.length) return { status: 'no-data', minutes: null, nadir: null };
        const depletedIndex = data.findIndex(point => point.bg < target);
        if (depletedIndex < 0) return { status: 'no-observed-depletion', minutes: null,
            nadir: Math.min(...data.map(point => point.bg)) };
        // Første genopfyldning afslutter episoden; et senere nyt fald må ikke
        // slette en genopfyldning, som faktisk blev observeret tidligere.
        const recoveryIndex = data.findIndex((point, i) => i > depletedIndex && point.bg >= target);
        const recovered = recoveryIndex < 0 ? null : data[recoveryIndex];
        const nadir = Math.min(...data.slice(depletedIndex, recovered ? recoveryIndex + 1 : undefined).map(point => point.bg));
        return { status: recovered ? 'recovered' : 'not-recovered',
            minutes: recovered ? recovered.time - data[0].time : null, nadir };
    }
    function hasSampleInRange(values, lower, upper) {
        return values.some(value => Number.isFinite(value) && value >= lower && value <= upper);
    }
    const api = { recoveryAfterNadir, hasSampleInRange };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ValidationMetrics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
