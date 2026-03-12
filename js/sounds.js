// =============================================================================
// SOUNDS.JS — Audio feedback system using Tone.js
// =============================================================================
//
// This file sets up all sound effects for the game using the Tone.js library
// (loaded from CDN in index.html). Sounds provide auditory feedback for game
// events like eating, injecting insulin, entering bonus BG range, and game over.
//
// Tone.js is a Web Audio framework that lets you create synthesizers in the
// browser. Each "synth" is like a virtual instrument with configurable
// waveform shape (sine, triangle, square) and amplitude envelope (ADSR:
// attack, decay, sustain, release — controls how the volume changes over time).
//
// If Tone.js fails to load (e.g., browser blocks audio), sounds are disabled
// gracefully and the game runs silently.
//
// Dependencies: Tone.js (global, loaded via CDN before this file)
// Exports (global): isMuted, sounds, playSound()
// =============================================================================

// =============================================================================
// SETTINGS — Persistente brugerindstillinger gemt i localStorage.
//
// Gemmes som JSON under nøglen 't1dSimSettings'. Indeholder:
//   muted:      Lyd slået fra (boolean)
//   debugOpen:  Debug-panel synligt (boolean)
//   debugTrueBG: Vis sand BG-linje på grafen (boolean)
//   debugLog:   CSV-logning aktiv (boolean)
//   language:   Sprogkode — 'da' eller 'en' (forberedt til fremtidig brug)
//
// Profil (vægt/ISF/ICR) gemmes separat under 'diabetesDystenProfile' — se ui.js.
// =============================================================================
const SETTINGS_KEY = 't1dSimSettings';
const DEFAULT_SETTINGS = {
    muted: false,
    debugOpen: true,       // DEV DEFAULT — sæt til false ved release
    debugTrueBG: true,     // DEV DEFAULT — sæt til false ved release
    debugLog: true,        // DEV DEFAULT — sæt til false ved release
    language: 'da'
};

/**
 * loadSettings — Hent gemte indstillinger fra localStorage.
 * Returnerer et objekt med alle settings (manglende felter udfyldes med defaults).
 */
function loadSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) { /* localStorage utilgængeligt — brug defaults */ }
    return { ...DEFAULT_SETTINGS };
}

/**
 * saveSettings — Gem indstillinger til localStorage.
 * @param {object} settings — Fuldt settings-objekt (alle felter)
 */
function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* localStorage utilgængeligt */ }
}

// Indlæs gemte indstillinger ved opstart
const appSettings = loadSettings();

// =============================================================================
// HIGHSCORE — Lokal highscore-liste gemt i localStorage.
//
// Gemmes som JSON-objekt under nøglen 't1dSimHighscores':
//   { version: "X.Y", scores: [ { name, points, day, cause, date }, ... ] }
//
// Sorteret efter points (højeste først), max 10 indgange.
//
// VERSIONERING: Når HIGHSCORE_VERSION ændres (fx ved ændringer i scoring,
// fysiologi eller game over-betingelser), slettes gamle scores automatisk.
// Scores fra forskellige spilversioner er ikke sammenlignelige.
// =============================================================================
const HIGHSCORE_KEY = 't1dSimHighscores';
const HIGHSCORE_VERSION = '0.1';  // Bump ved ændringer der påvirker scoring
const MAX_HIGHSCORES = 10;

/**
 * loadHighscores — Hent highscore-listen fra localStorage.
 * Returnerer et sorteret array (højeste score først).
 * Returnerer tom liste hvis versionen ikke matcher (gamle scores slettes).
 */
function loadHighscores() {
    try {
        const stored = localStorage.getItem(HIGHSCORE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Gammel format (bare et array) eller forkert version → slet
            if (Array.isArray(data) || data.version !== HIGHSCORE_VERSION) {
                localStorage.removeItem(HIGHSCORE_KEY);
                return [];
            }
            if (Array.isArray(data.scores)) {
                return data.scores.sort((a, b) => b.points - a.points);
            }
        }
    } catch (e) { /* localStorage utilgængeligt */ }
    return [];
}

/**
 * saveHighscore — Gem en ny highscore-indgang.
 * Tilføjer til listen, sorterer, og beholder kun top 10.
 * @param {string} name   — Spillerens navn
 * @param {number} points — Normoglykæmi-points
 * @param {number} day    — Dag spilleren nåede til
 * @param {string} cause  — Game over-årsag
 * @returns {number} Placeringen (1-indexed), eller -1 hvis ikke i top 10
 */
function saveHighscore(name, points, day, cause) {
    const list = loadHighscores();
    const entry = {
        name: name.trim() || 'Anonym',
        points: Math.round(points * 10) / 10,
        day: day,
        cause: cause,
        date: new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
    };
    list.push(entry);
    list.sort((a, b) => b.points - a.points);
    const trimmed = list.slice(0, MAX_HIGHSCORES);
    try {
        localStorage.setItem(HIGHSCORE_KEY, JSON.stringify({
            version: HIGHSCORE_VERSION,
            scores: trimmed
        }));
    } catch (e) { /* localStorage utilgængeligt */ }
    // Returnér placering (1-indexed)
    const rank = trimmed.findIndex(e => e === entry);
    return rank >= 0 ? rank + 1 : -1;
}

// --- Sound State ---
// Global flag to mute/unmute all sounds. Toggled by the mute button in the UI.
// Initialiseret fra gemte indstillinger.
let isMuted = appSettings.muted;

// --- Tone.js Sound Setup ---
// Each property is a different synthesizer for a different type of game event.
// The try/catch ensures the game still works if audio initialization fails
// (e.g., if the browser hasn't received a user gesture yet, or Tone.js CDN is down).
let sounds = {};
try {
    // Tick sound: plays every CGM update at high simulation speeds (>=240x).
    // MembraneSynth simulates a drum-like percussive hit — short and unobtrusive.
    // pitchDecay: how fast the pitch drops (like a drum skin vibrating slower)
    // octaves: range of the pitch sweep
    sounds.tickSynth = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -6 }).toDestination();

    // Intervention sound: plays when the player takes an action (eat, inject, exercise).
    // Triangle wave is softer than a square wave — pleasant for frequent feedback.
    // The note and duration are configurable per event (passed to playSound()).
    sounds.interventionSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }, volume: -12 }).toDestination();

    // Bonus sound: "stjernedrys" — spilles når BG rammer 2x bonus-zonen (5.0-6.0 mmol/L).
    // Bruger en PolySynth (kan spille flere toner samtidig) med en høj, klokkeklar sine-lyd.
    // Effekten er en hurtig opadgående arpeggio (C6→E6→G6→C7) der lyder som glitrende stjerner.
    // Reverb tilføjer rumklang så tonerne "hænger" i luften.
    sounds.bonusReverb = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).toDestination();
    sounds.bonusSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 },
        volume: -22   // Subtil — skal høres men ikke irritere
    }).connect(sounds.bonusReverb);

    // In-range lyd: positiv, let opadgående to-tone når BG vender tilbage til 4-10 mmol/L.
    // Sine-bølge med kort envelope — venlig "ding-ding" der belønner spilleren.
    sounds.inRangeSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.2 },
        volume: -14
    }).toDestination();

    // Hypo-fare lyd: dyb, langsom, faretruende lyd når BG < 4.5 og faldende.
    // FMSynth giver en mørk, urolig klang — meget lav frekvens med FM-modulation
    // skaber en tung, vibrerende fornemmelse der signalerer akut fare.
    // Lange envelope-tider (attack 0.3s, decay 1.2s) gør lyden langsom og truende.
    // Hypo-fare lyd: dyb, truende FM-lyd når BG falder under 4.5.
    // Originale envelope-tider — lang nok til at føles faretruende.
    // Hysterese i simulator.js sikrer at den kun spilles én gang per hypo-episode.
    sounds.hypoWarnSynth = new Tone.FMSynth({
        harmonicity: 1.5, modulationIndex: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.3, decay: 1.2, sustain: 0.2, release: 1.5 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.2, decay: 0.8, sustain: 0.3, release: 1.0 },
        volume: -6
    }).toDestination();

    // Hyper-zone lyd: kort, "nedern" nedadgående motiv når BG krydser over 10.
    // Triangle-bølge giver en blødere, mindre dramatisk tone end FM-synthen.
    // To nedadgående toner (moll-interval) — signalerer "det går den forkerte vej"
    // men uden panik.
    sounds.hyperWarnSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.05, release: 0.3 },
        volume: -14
    }).toDestination();

    // Game over sound: plays a descending three-note sequence (G3 → E3 → C3).
    // FMSynth uses frequency modulation for a richer, more dramatic timbre.
    // harmonicity: ratio of modulator to carrier frequency (8 = very harmonically rich)
    // modulationIndex: depth of FM — higher = more complex/buzzy timbre
    sounds.gameOverSynth = new Tone.FMSynth({
        harmonicity: 8, modulationIndex: 2, oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.5, release: 1 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.2, release: 0.1 }
    }).toDestination();
    // Insulin pen lyd: ægte lydoptagelse af en insulin-pen der klikker.
    // Afspilles ved både bolus og basal insulin-injektioner.
    // Bruger HTML5 Audio element — virker med både file:// og http://.
    // Audio-elementet preloades og klones ved afspilning (så overlappende
    // afspilninger er mulige).
    sounds.insulinPenAudio = new Audio('sounds/insulin pen edited.wav');
    sounds.insulinPenAudio.preload = 'auto';
    sounds.insulinPenAudio.volume = 0.7;

    // Mad-knaselyde: fire varianter af flæskesvær-knase.
    // Ved hvert måltid vælges én tilfældigt — giver variation og liv.
    // Bruger HTML5 Audio ligesom insulin-pen lyden.
    sounds.eatingSounds = ['a', 'b', 'c', 'd'].map(letter => {
        const audio = new Audio(`sounds/flæskesvær ${letter}.wav`);
        audio.preload = 'auto';
        audio.volume = 0.6;
        return audio;
    });

    // Menu pop-lyd: kort, luftig "pop" når dock-paneler åbner/lukker.
    // MembraneSynth giver en blød, rund percussiv lyd — som en sæbeboble der popper.
    // Lav pitchDecay + høj oktav = kort, let "pop" uden at være skarp/irriterende.
    // To varianter: åbning (højere tone, C5) og lukning (lavere, G4).
    sounds.menuPopSynth = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
        volume: -18
    }).toDestination();
} catch (e) {
    // If Tone.js can't initialize (missing library, audio context blocked, etc.),
    // set sounds to null. playSound() checks for this and becomes a no-op.
    console.error("Tone.js initialization failed.", e);
    sounds = null;
}

/**
 * playSound — Triggers a sound effect for a given game event type.
 *
 * @param {string} type      - The event type: 'tick', 'bonus', 'hypoWarn', 'hyperWarn', 'intervention', or 'gameOver'
 * @param {string} note      - Musical note in scientific pitch notation (e.g., 'C4', 'A5').
 *                              Only used for 'intervention' type. Default: 'C4'
 * @param {string} duration  - Tone.js duration string (e.g., '8n' = eighth note, '16n' = sixteenth).
 *                              Only used for 'intervention' type. Default: '8n'
 *
 * Note names follow the pattern: letter (A-G) + optional # + octave number.
 * Higher octave = higher pitch. Middle C is C4. A4 = 440 Hz (concert pitch).
 *
 * Duration notation: '4n' = quarter note, '8n' = eighth note, '16n' = sixteenth note, etc.
 * These are relative to the Tone.js transport tempo (defaults to 120 BPM).
 */
function playSound(type, note = 'C4', duration = '8n') {
    // Early exit if muted or if Tone.js failed to initialize
    if (isMuted || !sounds) return;
    try {
        // Tone.now() returns the current audio context time in seconds.
        // All triggerAttackRelease calls are scheduled relative to this time
        // to ensure precise synchronization.
        const now = Tone.now();

        if (type === 'tick' && sounds.tickSynth) sounds.tickSynth.triggerAttackRelease("C2", "32n", now);
        else if (type === 'bonus' && sounds.bonusSynth) {
            // "Stjernedrys" — hurtig opadgående arpeggio med glitrende høje toner.
            // Tonerne C6→E6→G6→C7 danner en C-dur akkord der stiger opad,
            // med 70ms mellem hver tone. Lyder som magisk glitter/stjernestøv.
            const notes = ['C6', 'E6', 'G6', 'C7'];
            notes.forEach((n, i) => {
                sounds.bonusSynth.triggerAttackRelease(n, '16n', now + i * 0.07);
            });
        }
        else if (type === 'inRange' && sounds.inRangeSynth) {
            // Positiv opadgående to-tone: C5 → E5 (stor terts op).
            // Let og venlig — "godt klaret, du er tilbage i grøn zone".
            sounds.inRangeSynth.triggerAttackRelease('C5', '16n', now);
            sounds.inRangeSynth.triggerAttackRelease('E5', '16n', now + 0.1);
        }
        else if (type === 'hypoWarn' && sounds.hypoWarnSynth) {
            // Kort, dyb nedadgående to-tone: E2 → C2.
            // 32n noter (~125ms) + 150ms spacing = total ~0.4s. Hurtigt og tydeligt.
            sounds.hypoWarnSynth.triggerAttackRelease('E2', '2n', now);
            sounds.hypoWarnSynth.triggerAttackRelease('C2', '1n', now + 0.5);
        }
        else if (type === 'hyperWarn' && sounds.hyperWarnSynth) {
            // "Nedern" nedadgående to-tone motiv: A3 → F3 (dybere, mere mættet).
            // Signalerer "du er over 10, det er ikke godt" uden akut panik.
            sounds.hyperWarnSynth.triggerAttackRelease('A3', '8n', now);
            sounds.hyperWarnSynth.triggerAttackRelease('F3', '8n', now + 0.15);
        }
        else if (type === 'insulinPen' && sounds.insulinPenAudio) {
            // Afspil den rigtige insulin-pen lydoptagelse.
            // Kloner Audio-elementet så lyden kan afspilles igen selvom
            // forrige afspilning ikke er færdig.
            const clip = sounds.insulinPenAudio.cloneNode();
            clip.volume = sounds.insulinPenAudio.volume;
            clip.play().catch(() => {}); // Ignorer autoplay-blokering
        }
        else if (type === 'eating' && sounds.eatingSounds && sounds.eatingSounds.length > 0) {
            // Tilfældig knaselyd fra de fire varianter
            const clip = sounds.eatingSounds[Math.floor(Math.random() * sounds.eatingSounds.length)].cloneNode();
            clip.volume = sounds.eatingSounds[0].volume;
            clip.play().catch(() => {});
        }
        else if (type === 'menuOpen' && sounds.menuPopSynth) {
            // Panel åbner: højere tone (C5) — let, opadgående "pop"
            sounds.menuPopSynth.triggerAttackRelease('C5', '32n', now);
        }
        else if (type === 'menuClose' && sounds.menuPopSynth) {
            // Panel lukker: lavere tone (G4) — blødere, nedadgående "pop"
            sounds.menuPopSynth.triggerAttackRelease('G4', '32n', now);
        }
        else if (type === 'intervention' && sounds.interventionSynth) sounds.interventionSynth.triggerAttackRelease(note, duration, now);
        else if (type === 'gameOver' && sounds.gameOverSynth) {
            // Descending three-note sequence with 100ms spacing between notes.
            // G3 → E3 → C3 creates a minor-feel "failure" motif.
            sounds.gameOverSynth.triggerAttackRelease("G3", "8n", now);
            sounds.gameOverSynth.triggerAttackRelease("E3", "8n", now + 0.1);
            sounds.gameOverSynth.triggerAttackRelease("C3", "4n", now + 0.2);
        }
    } catch (e) { console.warn("Error playing sound:", type, e); }
}
