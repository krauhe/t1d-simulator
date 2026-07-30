// =============================================================================
// DOSE-CONTROLS.JS - Fælles, grove dosistrin til desktop og mobil
// =============================================================================
//
// Filen indeholder kun præsentationslogik. Fysiologimotorens præcise interne
// basalbehov ændres ikke. Formålet er, at begge brugerflader viser samme grove
// forsøgsinterval og samme knapper for den valgte fiktive karakter.
//
// Eksporter (globalt i browseren og via CommonJS i Node-tests):
//   getBasalControlCap(basalDose)
//   getBasalControlPresetDoses(basalDose)
//   getBasalTrialRangeForCharacter(basalDose, isChild)
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

// Bane 1 viser et interval omkring karakterens injektionsbehov. Børn beholder
// 5 E-opdeling, mens de to voksne kropstyper afrundes udad til hele 10 E.
// Et behov præcis på en grænse udvides, så resultatet stadig er et interval og
// ikke et forklædt facit.
function getBasalTrialRangeForCharacter(basalDose, isChild) {
    const injectionNeed = Number.isFinite(basalDose) && basalDose > 0 ? basalDose : 16;
    const intervalStep = isChild ? 5 : 10;
    let min = Math.max(0, Math.floor(injectionNeed / intervalStep) * intervalStep);
    let max = Math.ceil(injectionNeed / intervalStep) * intervalStep;

    if (min === max) {
        min = Math.max(0, min - intervalStep);
        max += intervalStep;
    }

    return { basalRangeMin: min, basalRangeMax: max };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getBasalControlCap,
        getBasalControlPresetDoses,
        getBasalTrialRangeForCharacter,
    };
}
