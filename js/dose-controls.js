// =============================================================================
// DOSE-CONTROLS.JS - Fælles, grove dosistrin til desktop og mobil
// =============================================================================
//
// Filen indeholder kun præsentationslogik. Fysiologimotorens præcise interne
// basalbehov ændres ikke. Formålet er, at begge brugerflader viser de samme grove
// knapper for den valgte fiktive karakter.
//
// Eksporter (globalt i browseren og via CommonJS i Node-tests):
//   getBasalControlCap(basalDose)
//   getBasalControlPresetDoses(basalDose)
// =============================================================================

// Basal-sliderens loft er en grov karakterafhængig størrelse. Afrundingen til
// nærmeste 10 gør, at loftet ikke afslører motorens præcise interne dosis.
function getBasalControlCap(basalDose) {
    const internalDose = Number.isFinite(basalDose) && basalDose > 0 ? basalDose : 10;
    return Math.max(10, Math.round(internalDose * 2 / 10) * 10);
}

// Knapperne udledes af det grove loft, aldrig direkte af den interne dosis.
// Dermed bliver ingen knap et skjult "korrekt svar" på karakterens basalbehov.
function getBasalControlPresetDoses(basalDose) {
    const cap = getBasalControlCap(basalDose);
    const step = cap >= 50 ? 5 : 2;
    return [0.2, 0.4, 0.6, 0.8, 1.0]
        .map(fraction => Math.max(1, Math.round(cap * fraction / step) * step));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getBasalControlCap,
        getBasalControlPresetDoses,
    };
}
