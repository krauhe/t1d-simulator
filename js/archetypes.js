// =============================================================================
// ARCHETYPES.JS — Fixed weight-based player profiles ("who do you want to play")
// =============================================================================
//
// DESIGN: Instead of typing in free numeric body weight / ISF / ICR, the player
// picks a character to play — a small, fixed set of archetypes. The framing is
// "who do you want to play", not "which patient is most like you": you explore
// the physiology of a chosen character. That keeps the simulator a clear
// educational toy rather than a personal calculator.
//
// This file is the single source of truth for those archetypes. The physiology
// engine consumes these values, but they are DEFINED only here — never typed in
// by the user.
//
// Axis: BODY WEIGHT only (decided 2026-06-29). Larger body → more total insulin,
// lower effect per unit (lower ISF) and fewer grams covered per unit (lower ICR).
// A separate "sensitivity" axis (sensitive/standard/resistant at fixed weight)
// was considered and deferred — see docs/REGULATORY.md §4 sensitivityAxisNote.
//
// Values are grounded in ISPAD 2018 (children are more insulin-sensitive per kg)
// and the model's own reference profile (adult 70 kg / ISF 3.0 / ICR 10). The
// ICR/ISF ratio (~3.3) matches the model default rather than the textbook 500/100
// rule (=5); since these are fixed presets (not a calculator), that ratio is fine.
//
// NOTE on the child archetype: the Hovorka model is calibrated for adults
// (~50-100 kg). The ~40 kg child sits just below that window, so its absolute
// numbers are an educational approximation. This limitation is documented rather
// than presented as a personal profile warning, because the public UI only offers
// fixed fictional characters.
//
// Dependencies: none — this is a pure data file (loaded before simulator.js).
// Exports (global): PROFILE_ARCHETYPES, DEFAULT_ARCHETYPE_ID,
//                   getArchetype(), nearestArchetype(), archetypeToProfile(),
//                   loadFixedCharacterProfile(), saveCharacterSelection()
// =============================================================================


// -----------------------------------------------------------------------------
// PROFILE_ARCHETYPES — the selectable characters, ordered small → large.
// -----------------------------------------------------------------------------
// Each object:
//   id:                Stable identifier (stored in localStorage as the chosen
//                      character; survives label/translation changes).
//   weight:            Body weight in kg (drives BMR, portion scaling, and the
//                      model's steady-state basal estimate).
//   isf:               Insulin sensitivity factor, mmol/L per unit.
//   icr:               Insulin-to-carb ratio, grams carb per unit.
//   bolusMax:          Upper limit of the fast-insulin (meal) slider for this
//                      character — a round number with comfortable headroom over
//                      a large meal + correction. Larger character → larger meals
//                      and more total insulin → higher cap. Keeps the input a
//                      coarse character-scaled control, not a fine dose dial.
//   nameKey:           i18n key for the user-facing character name.
//   descKey:           i18n key for the short character description.
//   outsideValidatedRange: true → engine is extrapolating (show low-weight
//                      warning). Used by the child archetype.
//
// IMPORTANT: these are PRESETS, not a personal dose calculator. The basal the
// game suggests is derived at runtime from the model's steady-state estimate
// (see the physiology engine), NOT from ISF/ICR via a clinical rule.
const PROFILE_ARCHETYPES = [
    {
        id: 'child',
        weight: 40,
        isf: 4.0,
        icr: 15,
        bolusMax: 10,
        nameKey: 'archetype.child.name',
        descKey: 'archetype.child.desc',
        outsideValidatedRange: true,
    },
    {
        id: 'adult',
        weight: 70,
        isf: 3.0,
        icr: 10,
        bolusMax: 15,
        nameKey: 'archetype.adult.name',
        descKey: 'archetype.adult.desc',
        outsideValidatedRange: false,
    },
    {
        id: 'large',
        weight: 100,
        isf: 2.0,
        icr: 7,
        bolusMax: 20,
        nameKey: 'archetype.large.name',
        descKey: 'archetype.large.desc',
        outsideValidatedRange: false,
    },
];

// The character selected by default (the model's reference profile).
const DEFAULT_ARCHETYPE_ID = 'adult';

// Den offentlige app gemmer KUN id'et på den valgte fiktive karakter. Rå
// modelparametre må ikke kunne sniges ind i spillet via localStorage. Motoren
// modtager stadig vægt/ISF/ICR, men de bliver altid slået op fra de faste
// karakterdefinitioner, når den offentlige app starter en session.
const CHARACTER_STORAGE_KEY = 'diabetesDystenProfile';


// -----------------------------------------------------------------------------
// getArchetype(id) — look up an archetype by its stable id.
// Falls back to the default archetype if the id is unknown/missing, so callers
// never have to null-check (e.g. a localStorage value from an older build).
// -----------------------------------------------------------------------------
function getArchetype(id) {
    return PROFILE_ARCHETYPES.find(a => a.id === id)
        || PROFILE_ARCHETYPES.find(a => a.id === DEFAULT_ARCHETYPE_ID);
}


// -----------------------------------------------------------------------------
// nearestArchetype(profile) — map a raw {weight, isf, icr} profile to the
// closest archetype. Used to migrate old saved data and old editor scenarios
// (which stored raw numbers) onto the archetype model (item A3).
//
// The axis is body weight, so we match on weight; ISF/ICR are tie-breakers only.
// -----------------------------------------------------------------------------
function nearestArchetype(profile) {
    if (!profile || typeof profile.weight !== 'number') {
        return getArchetype(DEFAULT_ARCHETYPE_ID);
    }
    let best = PROFILE_ARCHETYPES[0];
    let bestDist = Infinity;
    for (const a of PROFILE_ARCHETYPES) {
        // Weight dominates (kg); ISF/ICR differences are small and only break ties.
        const dist = Math.abs(a.weight - profile.weight) * 100
            + (typeof profile.isf === 'number' ? Math.abs(a.isf - profile.isf) * 5 : 0)
            + (typeof profile.icr === 'number' ? Math.abs(a.icr - profile.icr) : 0);
        if (dist < bestDist) {
            bestDist = dist;
            best = a;
        }
    }
    return best;
}


// -----------------------------------------------------------------------------
// archetypeToProfile(idOrArchetype, name) — build the {name, weight, icr, isf,
// archetypeId} profile object the rest of the app expects (matches the shape of
// collectProfile() in ui.js), plus the archetype id so the choice survives a
// scenario export/import round-trip.
//
// `name` is the free-text player name (kept for highscores — archetype-
// independent; see item A1, name field preserved).
// -----------------------------------------------------------------------------
function archetypeToProfile(idOrArchetype, name) {
    const a = typeof idOrArchetype === 'string' ? getArchetype(idOrArchetype) : idOrArchetype;
    return {
        name: (name || '').trim().slice(0, 20),
        weight: a.weight,
        icr: a.icr,
        isf: a.isf,
        archetypeId: a.id,
    };
}


// =============================================================================
// CHARACTERS (A4) — the six named, fixed characters the player picks to play
// =============================================================================
//
// A4 decouples the player from a personal "profile": instead of configuring
// numbers, the player chooses one of OUR fixed fictional characters to play.
// The character has a fixed name we define (the player can NOT rename it — that
// would re-introduce self-modelling); the player's own name only appears as a
// highscore signature, kept entirely separate.
//
// Physiology stays the three weight bodies above (PROFILE_ARCHETYPES). Gender,
// name and icon are a purely cosmetic layer on top — the model does not differ by
// gender — so each character just references one of the three bodies. Two
// characters per body (a male and a female) give six relatable people without
// duplicating any physiology.
//
// Icon convention: assets/icons/app/character-<id>.png
// =============================================================================
// Alle karakterer har samme sæt BG-hero-tilstande. Stierne dannes ét sted, så
// en ny tilstand ikke skal kopieres manuelt seks gange med risiko for tastefejl.
const CHARACTER_MOOD_KEYS = [
    'hypo',
    'hyper',
    'active',
    'breathless',
    'sleep',
    'tired',
    'stress',
    'sick',
    'happy',
];

function createCharacterMoodPortraits(characterId) {
    return Object.fromEntries(CHARACTER_MOOD_KEYS.map(mood => [
        mood,
        `assets/characters/${characterId}/moods/${mood}.png`,
    ]));
}


const CHARACTERS = [
    {
        id: 'oscar',
        name: 'Oscar',
        gender: 'boy',
        archetype: 'child',
        // Helfigurer bruges i fortællende popupper, hvor kropssproget skal
        // formidle situationen. Små UI-flader bruger fortsat portrættet.
        fullBody: {
            intro: 'assets/characters/oscar/intro.png',
            celebrate: 'assets/characters/oscar/celebrate.png',
            concern: 'assets/characters/oscar/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('oscar'),
    },
    {
        id: 'emma',
        // ID'et bevares af hensyn til gemte valg og eksisterende billedstier.
        name: 'Olivia',
        gender: 'girl',
        archetype: 'child',
        fullBody: {
            intro: 'assets/characters/emma/intro.png',
            celebrate: 'assets/characters/emma/celebrate.png',
            concern: 'assets/characters/emma/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('emma'),
    },
    {
        id: 'erik',
        name: 'Erik',
        gender: 'man',
        archetype: 'adult',
        fullBody: {
            intro: 'assets/characters/erik/intro.png',
            celebrate: 'assets/characters/erik/celebrate.png',
            concern: 'assets/characters/erik/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('erik'),
    },
    {
        id: 'laura',
        // ID'et bevares af hensyn til gemte valg og eksisterende billedstier.
        name: 'Eva',
        gender: 'woman',
        archetype: 'adult',
        fullBody: {
            intro: 'assets/characters/laura/intro.png',
            celebrate: 'assets/characters/laura/celebrate.png',
            concern: 'assets/characters/laura/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('laura'),
    },
    {
        id: 'frank',
        name: 'Frank',
        gender: 'man',
        archetype: 'large',
        fullBody: {
            intro: 'assets/characters/frank/intro.png',
            celebrate: 'assets/characters/frank/celebrate.png',
            concern: 'assets/characters/frank/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('frank'),
    },
    {
        id: 'ruth',
        // ID'et bevares af hensyn til gemte valg og eksisterende billedstier.
        name: 'Fiona',
        gender: 'woman',
        archetype: 'large',
        fullBody: {
            intro: 'assets/characters/ruth/intro.png',
            celebrate: 'assets/characters/ruth/celebrate.png',
            concern: 'assets/characters/ruth/concern.png',
        },
        moodPortraits: createCharacterMoodPortraits('ruth'),
    },
];

// Default character = the model's reference body (70 kg adult). 'erik' is the man,
// chosen only because the legacy default body was the adult — not a value judgement.
const DEFAULT_CHARACTER_ID = 'erik';


// -----------------------------------------------------------------------------
// getCharacter(id) — merge a character's identity with its body's physiology into
// one flat object: { id, name, gender, archetype, icon, weight, isf, icr,
// bolusMax, outsideValidatedRange, ... }. Falls back to the default character for
// an unknown/missing id, so callers never have to null-check.
// -----------------------------------------------------------------------------
function getCharacter(id) {
    const c = CHARACTERS.find(ch => ch.id === id)
        || CHARACTERS.find(ch => ch.id === DEFAULT_CHARACTER_ID);
    const body = getArchetype(c.archetype);
    // body first, character identity second (so character id/name win the merge).
    return { ...body, ...c, icon: `character-${c.id}.png` };
}


// -----------------------------------------------------------------------------
// characterToProfile(idOrCharacter) — build the { weight, icr, isf, archetypeId,
// characterId } object the Simulator + persistence need. NOTE: unlike the legacy
// archetypeToProfile, this carries NO player name — the name is a highscore
// signature now, stored and entered separately (A4).
// -----------------------------------------------------------------------------
function characterToProfile(idOrCharacter) {
    const c = typeof idOrCharacter === 'string' ? getCharacter(idOrCharacter) : idOrCharacter;
    return {
        weight: c.weight,
        icr: c.icr,
        isf: c.isf,
        archetypeId: c.archetype,
        characterId: c.id,
    };
}

// Bemærk: objektet ovenfor er motorens runtime-profil. Den offentlige app må
// ikke gemme de rå værdier som brugerens valg; persistence går gennem
// saveCharacterSelection() nedenfor og indeholder kun characterId.


// -----------------------------------------------------------------------------
// resolveCharacterId(saved) — pick a character id from saved data of any vintage:
//   - new data with a characterId → use it;
//   - legacy data with an archetypeId / raw weight → map to the nearest body and
//     pick that body's first (male) character as a stable default.
// Always returns a valid id (never throws).
// -----------------------------------------------------------------------------
function resolveCharacterId(saved) {
    if (saved && saved.characterId && CHARACTERS.some(c => c.id === saved.characterId)) {
        return saved.characterId;
    }
    const body = nearestArchetype(saved || {});
    const c = CHARACTERS.find(ch => ch.archetype === body.id);
    return (c && c.id) || DEFAULT_CHARACTER_ID;
}


// -----------------------------------------------------------------------------
// readSavedCharacterSelection() - læs den offentlige karaktermarkør. Ældre
// versioner gemte også rå modelparametre; de accepteres kun som migrationsinput
// til én af de seks faste karakterer og returneres aldrig direkte til motoren.
// -----------------------------------------------------------------------------
function readSavedCharacterSelection() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CHARACTER_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}


// -----------------------------------------------------------------------------
// saveCharacterSelection() - gem kun det stabile karakter-id. Funktionen er den
// eneste skrivevej, som desktop- og mobil-UI'et skal bruge til karaktervalget.
// -----------------------------------------------------------------------------
function saveCharacterSelection(characterId) {
    const resolvedId = getCharacter(characterId).id;
    try {
        localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify({ characterId: resolvedId }));
    } catch (e) {
        // Privat browsing eller blokeret storage: valget gælder kun i denne visning.
    }
    return resolvedId;
}


// -----------------------------------------------------------------------------
// getSavedCharacterId() - returnér altid et gyldigt id. Hvis gemte data stammer
// fra den gamle rå profil, migreres de straks til den id-only kontrakt.
// -----------------------------------------------------------------------------
function getSavedCharacterId() {
    const saved = readSavedCharacterSelection();
    const characterId = resolveCharacterId(saved);
    const keys = Object.keys(saved);
    if (saved.characterId !== characterId || keys.some(key => key !== 'characterId')) {
        saveCharacterSelection(characterId);
    }
    return characterId;
}


// -----------------------------------------------------------------------------
// loadFixedCharacterProfile() - den offentlige apps eneste profilresolver.
// Selv hvis localStorage manipuleres med fx weight/isf/icr, returneres de
// hardcodede værdier for det valgte karakter-id.
// -----------------------------------------------------------------------------
function loadFixedCharacterProfile() {
    return characterToProfile(getSavedCharacterId());
}


// -----------------------------------------------------------------------------
// getActiveCharacter() - hent den fiktive karakter, som den aktuelle session
// handler om. Alle UI-lag bruger denne samme helper, så introer, tips og
// resultater ikke kan komme til at vise forskellige personer.
// -----------------------------------------------------------------------------
function getActiveCharacter() {
    return getCharacter(getSavedCharacterId());
}


// -----------------------------------------------------------------------------
// resolveCharacterMood() - vælg det ansigtsudtryk, som bedst beskriver den
// fiktive karakters aktuelle tilstand i BG-hero-panelet.
//
// Prioriteten er bevidst: faktisk søvn vises altid med lukkede øjne. Når
// karakteren er vågen, vinder akutte fysiologiske signaler over aktivitet, og
// stress bruges kun når intet mere konkret foregår. previousMood giver en lille
// BG-hysterese, så portrættet ikke flimrer omkring 4 eller 10 mmol/L.
// -----------------------------------------------------------------------------
function resolveCharacterMood(sim, previousMood = 'neutral') {
    if (!sim) return 'neutral';

    const bg = Number.isFinite(sim.trueBG)
        ? sim.trueBG
        : (Number.isFinite(sim.cgmBG) ? sim.cgmBG : null);

    const activity = sim.activeAktivitet;
    const isPhysicalActivity = activity && activity.type !== 'afslapning';
    const hour = Math.floor(Number(sim.timeInMinutes) || 0) / 60;
    const isNight = hour >= 22 || hour < 7;
    const awakeAtNight = isNight && typeof sim.isNightAwake === 'function'
        && sim.isNightAwake();

    // Søvn er en fysisk tilstand, ikke blot et humør. Hvis den fælles motor siger,
    // at karakteren sover, skal øjnene derfor være lukkede, også når BG samtidig
    // er højt/lavt eller sygdom/stress er aktiv. De signaler vises igen ved opvågning.
    if (isNight && !awakeAtNight && !activity) return 'sleep';

    // Hypo har altid førsteprioritet. En aktiv hypo fastholdes til 4,3 mmol/L,
    // så små beregnings- eller sensorudsving ikke skifter portrættet frem og tilbage.
    if (bg !== null && (bg < 4.0 || (previousMood === 'hypo' && bg < 4.3))) {
        return 'hypo';
    }

    // Kampagnens egentlige sygdomshændelser har deres egen visuelle tidsperiode.
    const illnessActive = Number.isFinite(sim.illnessSymptomsUntil)
        && sim.totalSimMinutes < sim.illnessSymptomsUntil;
    if (illnessActive) return 'sick';

    // Hyper vises fra den øvre målzonegrænse. Hysterese ned til 9,5 mmol/L
    // forhindrer flimren omkring grænsen.
    if (bg !== null && (bg > 10.0 || (previousMood === 'hyper' && bg > 9.5))) {
        return 'hyper';
    }

    // Forpustelse følger den simulerede puls i stedet for den valgte intensitetsknap.
    // Ved modellens hvilepuls på 60 bpm skifter portrættet ved 115 bpm. Det betyder,
    // at lav cardio normalt beholder det aktive ansigt, mens medium/høj aktivitet
    // gradvist bliver forpustet. Pulsens eksisterende langsomme fald efter motion
    // holder udtrykket synligt under den naturlige restitution. En 10 bpm hysterese
    // forhindrer flimren, når pulsen ligger omkring tærsklen.
    const restingHeartRate = Number.isFinite(sim.hovorka?.HR_base)
        ? sim.hovorka.HR_base
        : 60;
    const heartRate = Number(sim.smoothHeartRate);
    const breathlessStart = restingHeartRate + 55;
    const breathlessStop = restingHeartRate + 45;
    const isBreathless = Number.isFinite(heartRate)
        && (heartRate >= breathlessStart
            || (previousMood === 'breathless' && heartRate > breathlessStop));
    if (isBreathless && (!activity || isPhysicalActivity)) return 'breathless';

    // Aktiv motion er synlig, medmindre det er spillets rolige
    // afslapnings-/yogaaktivitet, hvor et energisk sportsansigt ville være forkert.
    if (isPhysicalActivity) return 'active';

    // Efter fysisk aktivitet vinder "forpustet" ovenfor, så længe pulsen er høj.
    // Resten af den fælles 30-minutters restitutionsperiode vises som træt.
    if (awakeAtNight) return 'tired';

    // Tærsklerne ligger over den almindelige baggrundsvariation, men under de
    // planlagte stress- og sygdomshændelser i de sene baner.
    const acuteStress = Number(sim.acuteStressLevel) || 0;
    const chronicStress = Number(sim.chronicStressLevel) || 0;
    if (acuteStress >= 0.10 || chronicStress >= 0.12) return 'stress';

    // Et roligt, glad udtryk giver positiv feedback i den samme 5,0-6,0 mmol/L
    // bonuszone, som updateNormoPoints() belønner med dobbelt point. Mere konkrete
    // tilstande ovenfor - fx søvn, aktivitet, sygdom, hypo og hyper - vinder altid.
    if (bg !== null && bg >= 5.0 && bg <= 6.0) return 'happy';

    return 'neutral';
}


// -----------------------------------------------------------------------------
// getCharacterMoodPortrait() - slå et BG-hero-asset op med sikker fallback.
// Hvis et enkelt asset mangler, beholder karakteren sit neutrale ikon i stedet
// for at vise en brudt billedmarkør.
// -----------------------------------------------------------------------------
function getCharacterMoodPortrait(idOrCharacter, mood = 'neutral') {
    const character = typeof idOrCharacter === 'string'
        ? getCharacter(idOrCharacter)
        : idOrCharacter;
    if (!character) return '';
    if (character.moodPortraits && character.moodPortraits[mood]) {
        return character.moodPortraits[mood];
    }
    return `assets/icons/app/character-${character.id}.png`;
}


// -----------------------------------------------------------------------------
// setCharacterPortraitCrossfade() - skift BG-hero-portræt uden et brat billedhop.
//
// Desktop og mobil har hver to identiske billedlag i en fast beholder. Det nye
// asset indlæses i det skjulte lag, og først når filen er klar, krydsfades lagene
// over 4 sekunder via CSS. Et request-nummer forhindrer et langsomt, ældre asset i
// at vinde over en nyere humørtilstand.
// -----------------------------------------------------------------------------
function setCharacterPortraitCrossfade(portrait, src, mood, characterName, immediate = false) {
    if (!portrait || !src) return;
    const layers = Array.from(portrait.querySelectorAll('[data-portrait-layer]'));
    if (layers.length !== 2) return;

    portrait.dataset.mood = mood || 'neutral';
    portrait.setAttribute('aria-label', characterName || '');

    let activeIndex = Number.parseInt(portrait.dataset.activeLayer || '0', 10);
    if (activeIndex !== 0 && activeIndex !== 1) activeIndex = 0;
    const activeLayer = layers[activeIndex];

    // Ved indlæsning eller karaktervalg skal der ikke animeres fra en tom figur.
    if (immediate || !activeLayer.getAttribute('src')) {
        layers.forEach((layer, index) => {
            layer.classList.toggle('is-visible', index === 0);
            if (index === 0) layer.src = src;
            else layer.removeAttribute('src');
        });
        portrait.dataset.activeLayer = '0';
        portrait.dataset.currentSrc = src;
        delete portrait.dataset.pendingSrc;
        portrait.dataset.portraitRequest = String((Number(portrait.dataset.portraitRequest) || 0) + 1);
        return;
    }

    if (portrait.dataset.currentSrc === src) return;
    if (portrait.dataset.pendingSrc === src) return;

    const incomingIndex = activeIndex === 0 ? 1 : 0;
    const incomingLayer = layers[incomingIndex];
    const requestId = (Number(portrait.dataset.portraitRequest) || 0) + 1;
    portrait.dataset.portraitRequest = String(requestId);
    portrait.dataset.pendingSrc = src;

    const revealIncomingLayer = () => {
        if (Number(portrait.dataset.portraitRequest) !== requestId) return;
        // Et frame-mellemrum sikrer, at browseren registrerer start-opaciteten,
        // også når billedet allerede ligger i cache.
        requestAnimationFrame(() => {
            if (Number(portrait.dataset.portraitRequest) !== requestId) return;
            activeLayer.classList.remove('is-visible');
            incomingLayer.classList.add('is-visible');
            portrait.dataset.activeLayer = String(incomingIndex);
            portrait.dataset.currentSrc = src;
            delete portrait.dataset.pendingSrc;
        });
    };

    incomingLayer.onload = revealIncomingLayer;
    incomingLayer.onerror = () => {
        // Behold det nuværende portræt, hvis et enkelt mood-asset mangler.
        incomingLayer.classList.remove('is-visible');
        delete portrait.dataset.pendingSrc;
    };
    incomingLayer.src = src;
    if (incomingLayer.complete && incomingLayer.naturalWidth > 0) revealIncomingLayer();
}
