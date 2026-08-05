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
// SETTINGS — Persistent user settings stored in localStorage.
//
// Stored as JSON under the key 't1dSimSettings'. Contains:
//   muted:      Sound muted (boolean)
//   debugOpen:  Debug panel visible (boolean)
//   debugTrueBG: Show true BG line on graph (boolean)
//   debugLog:   CSV logging active (boolean)
//   language:   Language code — 'da' or 'en' (prepared for future use)
//
// The public character choice is stored separately as characterId under
// 'diabetesDystenProfile'. Fixed model values are resolved in archetypes.js.
// =============================================================================
const SETTINGS_KEY = 't1dSimSettings';
// Detect browser language — navigator.language returns e.g. 'da-DK', 'en-US', 'de'.
// If the language starts with 'da' → Danish, otherwise → English.
// Used only as the default on first visit; the user's choice is then remembered in localStorage.
const detectedLanguage = (typeof navigator !== 'undefined' && navigator.language || '').startsWith('da') ? 'da' : 'en';

// Auto-detect BG unit based on browser locale.
// mg/dL is used in: USA, Germany, Austria, Switzerland, Japan, Italy, Spain, France, Belgium.
// mmol/L is used in: Denmark, UK, Australia, Canada, Netherlands, Scandinavia, China, India.
function detectBgUnit() {
    const lang = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase();
    if (lang === 'en-us') return 'mg';
    if (lang.startsWith('de')) return 'mg';
    if (lang.startsWith('ja')) return 'mg';
    if (lang.startsWith('it')) return 'mg';
    if (lang.startsWith('fr')) return 'mg';
    if (lang.startsWith('es')) return 'mg';
    return 'mmol';
}

const DEFAULT_SETTINGS = {
    muted: false,
    cgmMuted: false,       // CGM sounds (bonus, hypo/hyper warnings, tick) separate mute
    musicMuted: false,     // Music on by default at 25% volume
    musicVolume: 25,       // Music volume 0-100 (default 25%)
    statsOpen: false,      // Stats pull-out drawer closed by default
    debugOpen: false,      // Debug pull-out drawer closed by default
    debugEnabled: false,   // Debug tab visible in side drawers (off = completely hidden)
    debugTrueBG: false,    // True BG line on graph (enable during development)
    debugLog: false,       // CSV logging (enable during development)
    language: detectedLanguage,
    bgUnit: detectBgUnit(),
    showLifeBars: false,        // Life bars (brain/acidosis/weight) in capsule bar
    showStatsFragment: true,    // Stats fragment (TIR, avg BG, weight) in capsule bar
    physiologyEffects: false,   // BG forces effects panel visible
    showInsulinBand: false,     // Insulin action band (IAB) on graph
    showCarbBand: false,        // Carb absorption band on graph
    showISFLine: false,         // Effective ISF line on graph
    showKetoneLine: false,      // Ketone (BHB) line on graph — follows physiology package
    physiologyDashboard: false, // Physiology dashboard window open
    levelTipsEnabled: true,     // Level tips (level.tips + tutorial popups, bound to specific levels)
    globalTipsEnabled: true     // General tips (GLOBAL_TIPS — active in all modes)
};

/**
 * loadSettings — Load saved settings from localStorage.
 * Returns an object with all settings (missing fields filled in with defaults).
 */
function loadSettings() {
    let loadedSettings = { ...DEFAULT_SETTINGS };
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) loadedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) { /* localStorage unavailable — use defaults */ }

    // Midlertidig sikkerhedsregel: Statistikfragmentet viser kaloriebalancen,
    // som spilleren skal kunne se for at gennemføre baner med vægtmål. En ældre
    // gemt `false` må derfor ikke skjule fragmentet ved næste indlæsning.
    loadedSettings.showStatsFragment = true;
    return loadedSettings;
}

/**
 * saveSettings — Save settings to localStorage.
 * @param {object} settings — Full settings object (all fields)
 */
function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* localStorage unavailable */ }
}

// Load saved settings at startup
const appSettings = loadSettings();

// =============================================================================
// HIGHSCORE — Local highscore list stored in localStorage.
//
// Stored as a JSON object under the key 't1dSimHighscores':
//   { version: "X.Y", scores: [ { name, points, day, cause, date }, ... ] }
//
// Sorted by points (highest first), max 10 entries.
//
// VERSIONING: When HIGHSCORE_VERSION changes (e.g. due to changes in scoring,
// physiology, or game-over conditions), old scores are deleted automatically.
// Scores from different game versions are not comparable.
// =============================================================================
const HIGHSCORE_KEY = 't1dSimHighscores';
const HIGHSCORE_VERSION = '0.1';  // Bump when changes affect scoring
const MAX_HIGHSCORES = 8;

/**
 * _highscoreStorageKey — Returns the localStorage key for a given gameMode.
 * Sandbox uses the original key (backwards compatible).
 */
function _highscoreStorageKey(gameMode) {
    if (!gameMode || gameMode === 'sandbox') return HIGHSCORE_KEY;
    return HIGHSCORE_KEY + '_' + gameMode;
}

/**
 * loadHighscores — Load the highscore list from localStorage.
 * Returns a sorted array (highest score first).
 * Returns an empty list if the version does not match (old scores are deleted).
 * @param {string} gameMode — Game mode ('sandbox', 'boxchallenge', 'campaign')
 */
function loadHighscores(gameMode = 'sandbox') {
    const key = _highscoreStorageKey(gameMode);
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            const data = JSON.parse(stored);
            // Old format (bare array) or wrong version → delete
            if (Array.isArray(data) || data.version !== HIGHSCORE_VERSION) {
                localStorage.removeItem(key);
                return [];
            }
            if (Array.isArray(data.scores)) {
                return data.scores.sort((a, b) => b.points - a.points);
            }
        }
    } catch (e) { /* localStorage unavailable */ }
    return [];
}

/**
 * saveHighscore — Save a new highscore entry.
 * Appends to the list, sorts, and keeps only the top 10.
 * @param {string} name     — Player signature (the player's own name, entered at
 *                            game over — NOT the character's name; see A4 two-name
 *                            model).
 * @param {number} points   — Points scored
 * @param {number} day      — Day the player reached
 * @param {string} cause    — Game over cause
 * @param {string} gameMode — Game mode ('sandbox', 'boxchallenge', 'campaign')
 * @param {object} character — The played character as { id, name } (A4f: stored so
 *                            the single leaderboard can tag each row with which
 *                            character was played). May be null for older entries.
 * @returns {number} The rank (1-indexed), or -1 if not in the top 10
 */
function saveHighscore(name, points, day, cause, gameMode = 'sandbox', character = null) {
    const key = _highscoreStorageKey(gameMode);
    const list = loadHighscores(gameMode);
    const entry = {
        name: name.trim() || (typeof t === 'function' ? t('stats.player.anonymous') : 'Anonym'),
        points: Math.round(points * 10) / 10,
        day: day,
        cause: cause,
        date: new Date().toISOString().slice(0, 10),  // YYYY-MM-DD
        // A4f: tag the row with the played character so one combined list can show
        // who was played, instead of splitting the board per character.
        character: character ? { id: character.id, name: character.name } : null,
    };
    list.push(entry);
    list.sort((a, b) => b.points - a.points);
    const trimmed = list.slice(0, MAX_HIGHSCORES);
    try {
        localStorage.setItem(key, JSON.stringify({
            version: HIGHSCORE_VERSION,
            scores: trimmed
        }));
    } catch (e) { /* localStorage unavailable */ }
    // Return rank (1-indexed)
    const rank = trimmed.findIndex(e => e === entry);
    return rank >= 0 ? rank + 1 : -1;
}

// =============================================================================
// PLAYER SIGNATURE (A4 two-name model)
// =============================================================================
// The player's own name is now kept entirely separate from the character they
// play. The character has a fixed name we define (CHARACTERS in archetypes.js);
// the SIGNATURE is the free-text name the player signs the highscore with. It is
// stored on its own key — never on the character profile — so it persists across
// characters and is entered/confirmed at game over (defaulting to the last one).
// =============================================================================
const PLAYER_SIGNATURE_KEY = 'ddPlayerSignature';

/**
 * getPlayerSignature — the player's last-used highscore signature ('' if none).
 */
function getPlayerSignature() {
    try {
        return (localStorage.getItem(PLAYER_SIGNATURE_KEY) || '').trim();
    } catch (e) {
        return '';
    }
}

/**
 * setPlayerSignature — remember the player's signature for next time.
 * Trimmed and capped to 20 characters (matches the highscore name length).
 */
function setPlayerSignature(name) {
    try {
        localStorage.setItem(PLAYER_SIGNATURE_KEY, (name || '').trim().slice(0, 20));
    } catch (e) { /* localStorage unavailable */ }
}

// --- Sound State ---
// Three separate mute flags for the three sound categories:
//   isMuted:     Sound effects (insulin pen, food, menu, game over, sleep)
//   isCgmMuted:  CGM feedback (bonus, inRange, hypo/hyper warnings, tick)
//   isMusicMuted: Background music (Pixel-Sipper.mp3)
// Each has its own toggle in the sound popup.
let isMuted = appSettings.muted;
let isCgmMuted = appSettings.cgmMuted ?? false;

// Categorisation: which sound types belong to which mute group
const _CGM_SOUNDS = new Set(['tick', 'bonus', 'inRange', 'hypoWarn', 'hyperWarn', 'cgmAlarm']);

// Base path for the file-based audio assets ('sounds/...'). Empty on the desktop
// build (page at the site root). The mobile shell lives in /mobile/, so it sets
// window.AUDIO_BASE_PATH = '../' before loading this file so the assets resolve.
const _AUDIO_BASE = (typeof window !== 'undefined' && window.AUDIO_BASE_PATH) || '';

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

    // Bonus sound: "stjernedrys" — played when BG hits the 2x bonus zone (5.0-6.0 mmol/L).
    // Uses a PolySynth (can play multiple notes simultaneously) with a bright, bell-like sine tone.
    // The effect is a fast ascending arpeggio (C6→E6→G6→C7) that sounds like glittering stars.
    // Reverb adds room ambience so the notes "hang" in the air.
    sounds.bonusReverb = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).toDestination();
    sounds.bonusSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,  // Cap against voice pile-up during rapid zone oscillations
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 },
        volume: -22   // Subtle — audible but not irritating
    }).connect(sounds.bonusReverb);

    // In-range sound: positive, gently ascending two-tone when BG returns to 4-10 mmol/L.
    // Sine wave with short envelope — friendly "ding-ding" that rewards the player.
    sounds.inRangeSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.2 },
        volume: -14
    }).toDestination();

    // Hypo warning sound: deep, slow, threatening tone when BG < 4.5 and falling.
    // FMSynth produces a dark, unsettled timbre — very low frequency with FM modulation
    // creates a heavy, vibrating sensation that signals acute danger.
    // Long envelope times (attack 0.3s, decay 1.2s) make the sound slow and menacing.
    // Hypo warning sound: deep, threatening FM tone when BG falls below 4.5.
    // Original envelope times — long enough to feel threatening.
    // Hysteresis in simulator.js ensures it is only played once per hypo episode.
    sounds.hypoWarnSynth = new Tone.FMSynth({
        harmonicity: 1.5, modulationIndex: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.3, decay: 1.2, sustain: 0.2, release: 1.5 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.2, decay: 0.8, sustain: 0.3, release: 1.0 },
        volume: -6
    }).toDestination();

    // Hyper-zone sound: short, downbeat descending motif when BG crosses above 10.
    // Triangle wave gives a softer, less dramatic tone than the FM synth.
    // Two descending notes (minor interval) — signals "it's going the wrong way"
    // without panic.
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
    // =========================================================================
    // HTML5 AUDIO POOLS — Pre-allocated Audio instances per type, round-robin.
    //
    // Previously we used Audio.cloneNode() on each play. That works, but
    // creates detached Audio nodes that are only GC'd when playback finishes.
    // In long sessions (Box Challenge 15+ min) dozens of nodes can accumulate.
    // The pool pattern keeps a fixed number of instances and reuses them.
    //
    // Pool size = max realistic simultaneous playbacks for that sound type.
    // Round-robin index ensures that a just-played instance is NOT chosen again
    // before the pool has cycled — allows overlap.
    // =========================================================================

    // Helper: build a pool of N Audio instances with the same src/volume
    const _mkAudioPool = (src, size, volume) => Array.from({ length: size }, () => {
        const audio = new Audio(_AUDIO_BASE + src);
        audio.preload = 'auto';
        audio.volume = volume;
        return audio;
    });

    // Insulin pen: pool of 4 — bolus+basal+hypo correction can overlap
    sounds.insulinPenPool = _mkAudioPool('sounds/insulin pen edited.wav', 4, 1.0);
    sounds.insulinPenPoolIdx = 0;

    // Eating crunch sounds: 4 variants (a/b/c/d), each with a pool of 2 instances.
    // Random variant selection per meal still provides variation.
    sounds.eatingPools = ['a', 'b', 'c', 'd'].map(letter =>
        _mkAudioPool(`sounds/flæskesvær ${letter}.wav`, 2, 1.0)
    );
    sounds.eatingPoolIdx = [0, 0, 0, 0];  // Round-robin index per variant

    // Sleep bubble pop: pool of 3 — multiple bubbles can pop in sequence
    sounds.sleepPopPool = _mkAudioPool('sounds/pop1.wav', 3, 1.0);
    sounds.sleepPopPoolIdx = 0;

    // Sleep start (snoring): pool of 3 — matches the 3-step snore sequence
    // in the playback logic (5s interval between each, fading volume).
    sounds.sleepStartPool = _mkAudioPool('sounds/zZzzz1.wav', 3, 0.8);
    sounds.sleepStartPoolIdx = 0;

    // Urination symptom: two short variants picked at random per playback.
    // Low volume + long cooldown keep the symptom informative without
    // dominating the game when BG stays high for a long time.
    sounds.peeSymptomPool = [
        ..._mkAudioPool('sounds/pee sound 1.wav', 1, 0.35),
        ..._mkAudioPool('sounds/pee sound2.wav', 1, 0.35)
    ];

    // Illness symptom: short snot/sneeze variants. They play infrequently via
    // cooldown, so illness feels present without becoming annoying.
    sounds.illnessSymptomPool = [
        ..._mkAudioPool('sounds/sygdom 1 snot.wav', 1, 0.35),
        ..._mkAudioPool('sounds/sygdom 2 nys.wav', 1, 0.35),
        ..._mkAudioPool('sounds/sygdom 3 nys og snot.wav', 1, 0.35)
    ];
    sounds.illnessSymptomPoolIdx = 0;

    // Morning alarm sound (07:00): real alarm clock bell.
    // Plays for only ~1 second (stopped by setTimeout) — short and discreet,
    // just enough to signal "good morning" without being annoying.
    sounds.morningAlarmAudio = new Audio(_AUDIO_BASE + 'sounds/Old Alarm Clock Sound Effect.wav');
    sounds.morningAlarmAudio.preload = 'auto';
    sounds.morningAlarmAudio.volume = 0.5;

    // CGM alarm: WAV provides better compatibility on iOS/Safari than OGG.
    // alarm 2.wav is the preferred short variant. We preload two instances
    // so the same alarm can play twice in quick succession.
    // It belongs to the CGM sound category, so it follows the CGM sound toggle in settings.
    sounds.cgmAlarmPool = _mkAudioPool('sounds/alarm 2.wav', 2, 0.55);
    sounds.cgmAlarmPoolIdx = 0;

    // Invalid sound: low double-bleep (E3→C3) for invalid actions (e.g. full stomach).
    // Square wave gives more "buzz" than triangle — more clearly audible as error feedback.
    sounds.invalidSynth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.2 },
        volume: -8
    }).toDestination();

    // Menu pop sound: short, airy "pop" when dock panels open/close.
    // MembraneSynth gives a soft, round percussive sound — like a soap bubble popping.
    // Low pitchDecay + high octave = short, light "pop" without being sharp/irritating.
    // Two variants: opening (higher tone, C5) and closing (lower, G4).
    sounds.menuPopSynth = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
        volume: -18
    }).toDestination();

    // =========================================================================
    // LEVEL-COMPLETE SOUNDS — TIR counter tick, star ding, fanfare per star count
    // =========================================================================
    // Used by campaign.js animation in the level-complete popup.
    // Three levels of fanfare richness depending on star count:
    //   0 stars: sad minor figure (descending)
    //   1 star: "muted fanfare" (stopped trumpet with downward pitch bend)
    //   2 stars: simple arpeggio + bell (without sparkle/stab)
    //   3 stars: full glorious fanfare (5 layers: pad/lead/bell/sparkle/stab)

    // Star ding: short FM bell, ascending pitch per star (C5/E5/G5)
    sounds.starDingSynth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 8,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
        modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        volume: -10
    }).toDestination();

    // TIR counter tick: very short sine blip while the number counts up
    sounds.levelTickSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
        volume: -28
    }).toDestination();

    // Fanfare chain: shared reverb + multiple layers mixed based on star count
    sounds.fanfareReverb = new Tone.Reverb({ decay: 2.2, wet: 0.45 }).toDestination();
    sounds.fanfareLead = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0.0, release: 0.15 },
        volume: -12
    }).connect(sounds.fanfareReverb);
    sounds.fanfarePad = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,  // Cap against voice pile-up from popup spam
        oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
        envelope: { attack: 0.15, decay: 0.4, sustain: 0.6, release: 1.2 },
        volume: -22
    }).connect(sounds.fanfareReverb);
    sounds.fanfareBell = new Tone.FMSynth({
        harmonicity: 5,
        modulationIndex: 12,
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.6 },
        modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
        volume: -14
    }).connect(sounds.fanfareReverb);
    sounds.fanfareSparkle = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,  // Cap against voice pile-up
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
        volume: -18
    }).connect(sounds.fanfareReverb);

    // "Stuffy" fanfare voice: square wave through low-pass filter (700 Hz)
    // + -20 cents detune. Sounds like a muted trumpet with a cold. Used for 1 star.
    sounds.fanfareStuffyFilter = new Tone.Filter({ frequency: 700, type: 'lowpass', rolloff: -24 });
    sounds.fanfareStuffyFilter.connect(sounds.fanfareReverb);
    sounds.fanfareStuffy = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.04, decay: 0.25, sustain: 0.15, release: 0.3 },
        detune: -20,
        volume: -10
    }).connect(sounds.fanfareStuffyFilter);
} catch (e) {
    // If Tone.js can't initialize (missing library, audio context blocked, etc.),
    // set sounds to null. playSound() checks for this and becomes a no-op.
    console.error("Tone.js initialization failed.", e);
    sounds = null;
}

// =============================================================================
// SOUND COOLDOWN — Prevents the same sound from playing too quickly in succession.
//
// Problem: When BG oscillates around a zone boundary (e.g. 5.0 mmol/L bonus edge),
// zone-in/out sounds can "self-oscillate" and play many times per second.
// Solution: Each sound type has a cooldown period (milliseconds real-time).
// If the sound was played within the cooldown period, it is ignored.
//
// Cooldown values:
//   0     = no cooldown (user actions, ticks — must always respond)
//   3000  = 3s (CGM feedback — may occur fairly often)
//   5000  = 5s (sleep/alarm — avoid overlap)
//   10000 = 10s (zone sounds — prevents self-oscillation at boundaries)
// =============================================================================
const SOUND_COOLDOWNS = {
    bonus:        10000,  // 10s — bonus-zone self-oscillation was the original problem
    inRange:       3000,  // 3s — CGM feedback, player should hear it fairly often
    hypoWarn:     10000,  // 10s — also has hysteresis in simulator.js
    hyperWarn:    10000,  // 10s — zone transition
    cgmAlarm:     10000,  // 10s — real alarm file for CGM events
    tick:           150,  // 150ms — prevents voice clicks on MembraneSynth at high sim speed
    intervention:     0,  // User action — always play
    insulinPen:       0,  // User action
    eating:           0,  // User action
    sleepPop:         0,  // Bubble pop — short and discreet
    sleepStart:   18000,  // 18s — 3 snore sounds with 5s interval + buffer
    peeSymptom:  240000,  // 4 min — symptom sound for increased urination
    illnessSymptom: 300000, // 5 min — illness sound during active illness period
    morningAlarm:  5000,  // 5s — avoid double alarm
    invalid:        500,  // 0.5s — invalid action, short cooldown against spam
    menuOpen:         0,  // UI feedback — always play
    menuClose:        0,  // UI feedback
    gameOver:         0   // Rare — always play
};
// Timestamp (performance.now()) of the last playback for each sound type
const _soundLastPlayTime = {};

// Timestamp of the last playLevelTick — local minimum interval (50ms) so
// the animation does not overwhelm the audio stack on high-refresh-rate screens
// (120 Hz → ~24 ticks/s without cap; 50ms cap = max 20/s).
let _levelTickLastTime = 0;

// Re-entry guard for playLevelFanfare — the fanfare lasts up to ~2.5s
// (pad + reverb tail). If the user clicks "next" repeatedly or popup
// timers stack up, repeated calls must be ignored until the fanfare is done.
// Otherwise voices accumulate on fanfarePad/fanfareSparkle.
let _fanfareActiveUntil = 0;

// =============================================================================
// _playFromPool — Round-robin playback from an Audio pool.
//
// The pool is an array of Audio instances. idxKey is the key in the sounds object
// where the round-robin index is stored (e.g. 'insulinPenPoolIdx'). Each playback
// resets currentTime and takes the next slot — allows overlap without creating
// new detached nodes.
// =============================================================================
function _playFromPool(pool, idxKey) {
    if (!pool || pool.length === 0) return;
    const idx = (sounds[idxKey] || 0) % pool.length;
    sounds[idxKey] = idx + 1;
    const clip = pool[idx];
    try { clip.currentTime = 0; } catch (e) { /* ignore — not ready yet */ }
    clip.play().catch(() => {});
}

// =============================================================================
// _ensureAudioRunning — Fire-and-forget resume of Tone's AudioContext.
//
// Called from every public sound entry (playSound, playStarDing, playLevelTick,
// playLevelFanfare). Windows can put the AC into state 'suspended' (tab idle)
// or 'interrupted' (Teams/Discord/fullscreen game has exclusive output).
// Tone.start() handles both — it normally requires a user gesture, but
// even without a gesture the resume() call is harmless if it does not succeed.
//
// The calls are fire-and-forget — we do NOT await the promise. The audio
// timestamp for triggerAttackRelease is already in the future (Tone.now() + offset),
// so the AC is typically back before the sound actually needs to play.
// =============================================================================
function _ensureAudioRunning() {
    if (typeof Tone === 'undefined' || !Tone.context) return;
    if (Tone.context.state === 'running') return;
    try {
        // Tone.start() internally: resume() + set user-gesture flag
        Tone.start().catch(() => {});
    } catch (e) { /* ignore — next call will retry */ }
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
    // Early exit if Tone.js failed to initialize
    if (!sounds) return;

    // Check the correct mute flag based on sound category:
    //   CGM sounds → isCgmMuted
    //   Everything else (SFX) → isMuted
    if (_CGM_SOUNDS.has(type)) {
        if (isCgmMuted) return;
    } else {
        if (isMuted) return;
    }

    // Ensure AudioContext is 'running' — covers 'suspended' (tab idle)
    // and 'interrupted' (Windows exclusive audio mode from Teams/Discord/games).
    _ensureAudioRunning();

    // --- Cooldown check ---
    // Prevents the same sound type from playing faster than its cooldown period.
    // Uses real-time (performance.now()), NOT simulated time — cooldown must
    // protect the user's ears regardless of simulation speed.
    const cooldown = SOUND_COOLDOWNS[type] ?? 10000; // Unknown type → 10s default
    if (cooldown > 0) {
        const perfNow = performance.now();
        if (_soundLastPlayTime[type] && perfNow - _soundLastPlayTime[type] < cooldown) return;
        _soundLastPlayTime[type] = perfNow;
    }

    // --- Night pop delay ---
    // When zzZzz bubbles pop at night, intervention sounds are delayed ~400ms
    // so the sequence is: pop sound → [pause] → intervention sound.
    // The sleepPop sound itself is NOT delayed (it triggers the sequence).
    if (type !== 'sleepPop' && window._nightPopActiveUntil) {
        const now = performance.now();
        if (now < window._nightPopActiveUntil) {
            const delay = window._nightPopActiveUntil - now;
            setTimeout(() => playSound(type, note, duration), delay);
            return;
        }
    }

    try {
        // Tone.now() returns the current audio context time in seconds.
        // All triggerAttackRelease calls are scheduled relative to this time
        // to ensure precise synchronization.
        const now = Tone.now();

        if (type === 'tick' && sounds.tickSynth) sounds.tickSynth.triggerAttackRelease("C2", "32n", now);
        else if (type === 'bonus' && sounds.bonusSynth) {
            // "Stjernedrys" — fast ascending arpeggio with glittering high tones.
            // Notes C6→E6→G6→C7 form a C major chord rising upward,
            // with 70ms between each note. Sounds like magic glitter/stardust.
            const notes = ['C6', 'E6', 'G6', 'C7'];
            notes.forEach((n, i) => {
                sounds.bonusSynth.triggerAttackRelease(n, '16n', now + i * 0.07);
            });
        }
        else if (type === 'inRange' && sounds.inRangeSynth) {
            // Positive ascending two-tone: C5 → E5 (major third up).
            // Light and friendly — "well done, you're back in the green zone".
            sounds.inRangeSynth.triggerAttackRelease('C5', '16n', now);
            sounds.inRangeSynth.triggerAttackRelease('E5', '16n', now + 0.1);
        }
        else if (type === 'hypoWarn' && sounds.hypoWarnSynth) {
            // Short, deep descending two-tone: E2 → C2.
            // 32n notes (~125ms) + 150ms spacing = total ~0.4s. Quick and clear.
            sounds.hypoWarnSynth.triggerAttackRelease('E2', '2n', now);
            sounds.hypoWarnSynth.triggerAttackRelease('C2', '1n', now + 0.5);
        }
        else if (type === 'hyperWarn' && sounds.hyperWarnSynth) {
            // Downbeat descending two-note motif: A3 → F3 (deeper, more saturated).
            // Signals "you're over 10, that's not good" without acute panic.
            sounds.hyperWarnSynth.triggerAttackRelease('A3', '8n', now);
            sounds.hyperWarnSynth.triggerAttackRelease('F3', '8n', now + 0.15);
        }
        else if (type === 'cgmAlarm' && sounds.cgmAlarmPool) {
            const playCgmAlarmClip = () => {
                _playFromPool(sounds.cgmAlarmPool, 'cgmAlarmPoolIdx');
            };
            playCgmAlarmClip();
            setTimeout(playCgmAlarmClip, 850);
        }
        else if (type === 'insulinPen' && sounds.insulinPenPool) {
            // Play from insulin pen pool (round-robin of 4 pre-allocated instances).
            // Replaces previous cloneNode-based playback → bounded memory.
            _playFromPool(sounds.insulinPenPool, 'insulinPenPoolIdx');
        }
        else if (type === 'eating' && sounds.eatingPools && sounds.eatingPools.length > 0) {
            // Random variant selection, then round-robin within that variant's pool.
            const variantIdx = Math.floor(Math.random() * sounds.eatingPools.length);
            const pool = sounds.eatingPools[variantIdx];
            const slotIdx = sounds.eatingPoolIdx[variantIdx] % pool.length;
            sounds.eatingPoolIdx[variantIdx] = slotIdx + 1;
            const clip = pool[slotIdx];
            try { clip.currentTime = 0; } catch (e) { /* ignore */ }
            clip.play().catch(() => {});
        }
        else if (type === 'sleepPop' && sounds.sleepPopPool) {
            // Sleep bubble pop: pool of 3 — multiple bubbles can pop in sequence
            _playFromPool(sounds.sleepPopPool, 'sleepPopPoolIdx');
        }
        else if (type === 'peeSymptom' && sounds.peeSymptomPool) {
            // Urination symptom: pick one of the two WAV variants at random.
            // Driven by the symptom logic in ui.js. SFX, so it follows isMuted.
            const pool = sounds.peeSymptomPool;
            const clip = pool[Math.floor(Math.random() * pool.length)];
            try { clip.currentTime = 0; } catch (e) { /* not ready yet — ignore */ }
            clip.play().catch(() => {});
        }
        else if (type === 'illnessSymptom' && sounds.illnessSymptomPool) {
            // Illness: snot/sneeze variants, driven by the B10 illness period.
            _playFromPool(sounds.illnessSymptomPool, 'illnessSymptomPoolIdx');
        }
        else if (type === 'sleepStart' && sounds.sleepStartPool) {
            // 3 snore sounds with 5 second intervals, gradually fading out.
            // Each clip plays ~1.5 sec → ~3.5 sec silence → next snore.
            // Uses a pool of 3 instances (one per snore sound in the sequence).
            const baseVol = 0.8;
            const volumes = [baseVol, baseVol * 0.50, baseVol * 0.20];
            const clipDuration = 1500; // ms — hvor lang tid hvert klip spiller
            volumes.forEach((vol, i) => {
                setTimeout(() => {
                    const pool = sounds.sleepStartPool;
                    const slotIdx = sounds.sleepStartPoolIdx % pool.length;
                    sounds.sleepStartPoolIdx = slotIdx + 1;
                    const clip = pool[slotIdx];
                    clip.volume = vol;
                    try { clip.currentTime = 0; } catch (e) { /* ignore */ }
                    clip.play().catch(() => {});
                    setTimeout(() => {
                        try { clip.pause(); clip.currentTime = 0; } catch (e) { /* ignore */ }
                    }, clipDuration);
                }, i * 5000);
            });
        }
        else if (type === 'morningAlarm' && sounds.morningAlarmAudio) {
            // Alarm clock: play ~1 second — short "ring" that signals morning.
            // Reuses the preloaded Audio element directly (mp3 files are
            // too large for cloneNode() to preload quickly enough).
            const audio = sounds.morningAlarmAudio;
            audio.currentTime = 0;
            audio.play().catch(() => {});
            setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1000);
        }
        else if (type === 'menuOpen' && sounds.menuPopSynth) {
            // Panel opening: higher tone (C5) — light, upward "pop"
            sounds.menuPopSynth.triggerAttackRelease('C5', '32n', now);
        }
        else if (type === 'menuClose' && sounds.menuPopSynth) {
            // Panel closing: lower tone (G4) — softer, downward "pop"
            sounds.menuPopSynth.triggerAttackRelease('G4', '32n', now);
        }
        else if (type === 'invalid' && sounds.invalidSynth) {
            // Low double-bleep: E3 → C3 with 120ms spacing — short "nope"
            sounds.invalidSynth.triggerAttackRelease('E3', '16n', now);
            sounds.invalidSynth.triggerAttackRelease('C3', '16n', now + 0.12);
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

// =============================================================================
// LEVEL-COMPLETE SOUNDS — helper functions for animation in the campaign popup
// =============================================================================
// Three dedicated functions that bypass playSound's switch — they take extra
// parameters (star index, star count) that playSound does not support.
// Respects isMuted (same as the SFX category).
// =============================================================================

/**
 * playStarDing — short FM bell. Ascending pitch per star (C5/E5/G5).
 * @param {number} starIndex - 0, 1 or 2 (corresponds to star position).
 */
function playStarDing(starIndex) {
    if (!sounds || isMuted || !sounds.starDingSynth) return;
    _ensureAudioRunning();
    const notes = ['C5', 'E5', 'G5'];
    try {
        sounds.starDingSynth.triggerAttackRelease(notes[starIndex] || 'C5', '8n');
    } catch (e) { console.warn("Error playing starDing:", e); }
}

/**
 * playLevelTick — very short sine blip. Used while the TIR number counts up.
 * @param {boolean} slow - If true: lower tone (A5) signalling that the
 *                        count is slowing near a milestone. Default: C6.
 */
function playLevelTick(slow = false) {
    if (!sounds || isMuted || !sounds.levelTickSynth) return;
    // Local minimum interval — the campaign animation calls every 5th frame,
    // which on 120 Hz screens becomes ~24/s. 50ms cap = max 20/s, no voice clicks.
    const perfNow = performance.now();
    if (perfNow - _levelTickLastTime < 50) return;
    _levelTickLastTime = perfNow;
    _ensureAudioRunning();
    try {
        sounds.levelTickSynth.triggerAttackRelease(slow ? 'A5' : 'C6', '32n');
    } catch (e) { /* ignore — ticks fire rapidly */ }
}

/**
 * playLevelFanfare — end sound for level-complete.
 * Different complexity depending on star count:
 *   0 stars: sad minor figure (E5→C5→A4) + low A-minor pad
 *   1 star: "stuffy fanfare" (square + low-pass + downward pitch bend)
 *   2 stars: simple arpeggio (C5-E5-G5-C6) + bell, no sparkle
 *   3 stars: full fanfare (pad + 6-note arpeggio + bell + sparkle + stab)
 * @param {number} stars - 0, 1, 2 or 3.
 */
function playLevelFanfare(stars) {
    if (!sounds || isMuted || !sounds.fanfareLead) return;
    // Re-entry guard: ignore repeated calls while the fanfare is still playing
    // (up to ~2.5s including reverb tail). Guards against voice pile-up if
    // popup logic fires the fanfare multiple times (spam, timer overlap).
    const perfNow = performance.now();
    if (perfNow < _fanfareActiveUntil) return;
    _fanfareActiveUntil = perfNow + 2500;
    _ensureAudioRunning();
    try {
        const now = Tone.now();

        if (stars === 0) {
            // Sad minor figure — descending melody over A-minor pad
            sounds.fanfarePad.triggerAttackRelease(['A3', 'C4', 'E4'], '2n', now);
            sounds.fanfareLead.triggerAttackRelease('E5', '8n', now);
            sounds.fanfareLead.triggerAttackRelease('C5', '8n', now + 0.18);
            sounds.fanfareLead.triggerAttackRelease('A4', '4n', now + 0.36);
            return;
        }

        if (stars === 1) {
            // "Stuffy fanfare" — muted trumpet with downward pitch bend on final note
            sounds.fanfareStuffy.triggerAttackRelease('C5', '8n', now);
            sounds.fanfareStuffy.triggerAttackRelease('E5', '8n', now + 0.18);
            sounds.fanfareStuffy.triggerAttack('G5', now + 0.36);
            sounds.fanfareStuffy.frequency.setValueAtTime('G5', now + 0.36);
            sounds.fanfareStuffy.frequency.exponentialRampToValueAtTime(
                Tone.Frequency('F5').toFrequency(),
                now + 0.75
            );
            sounds.fanfareStuffy.triggerRelease(now + 0.85);
            return;
        }

        if (stars === 2) {
            // Acceptable result: arpeggio + bell, but no sparkle/stab
            sounds.fanfarePad.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now);
            const arp = ['C5', 'E5', 'G5', 'C6'];
            arp.forEach((n, i) => {
                sounds.fanfareLead.triggerAttackRelease(n, '16n', now + i * 0.07);
            });
            sounds.fanfareBell.triggerAttackRelease('E6', '4n', now + arp.length * 0.07 + 0.05);
            return;
        }

        // 3 stars: full glorious fanfare
        sounds.fanfarePad.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now);
        const arp = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
        arp.forEach((n, i) => {
            sounds.fanfareLead.triggerAttackRelease(n, '32n', now + i * 0.055);
        });
        sounds.fanfareBell.triggerAttackRelease('C7', '4n', now + arp.length * 0.055 + 0.05);
        const sparkleStart = now + arp.length * 0.055 + 0.15;
        [['G6', 0], ['E6', 0.08], ['C7', 0.16]].forEach(([n, dt]) => {
            sounds.fanfareSparkle.triggerAttackRelease(n, '16n', sparkleStart + dt);
        });
        const stabTime = now + arp.length * 0.055 + 0.5;
        sounds.fanfareLead.triggerAttackRelease('C5', '4n', stabTime);
        sounds.fanfareBell.triggerAttackRelease('C6', '4n', stabTime);
    } catch (e) { console.warn("Error playing levelFanfare:", e); }
}

// =============================================================================
// BACKGROUND MUSIC — MP3-based background music
// =============================================================================
//
// Plays Pixel-Sipper.mp3 from the sounds folder as looped background music.
// Simple HTML5 Audio playback — no Tone.js Transport needed.
//
// Global functions: initMusic(), startMusic(), stopMusic(), toggleMusic()
// Global variables: isMusicPlaying, isMusicMuted
// =============================================================================

// Global flag — tracked separately from sound effects (isMuted) and CGM sounds (isCgmMuted)
let isMusicMuted = appSettings.musicMuted ?? true;
let isMusicPlaying = false;

// --- Simple music system with native loop + watchdog ---
// Uses the browser's native loop=true for reliable looping.
// A watchdog timer checks every 2 seconds that music is still playing
// and restarts it if the browser has paused it (tab switch, CPU load).
let _musicAudio = null;
let _mInitialized = false;
let _musicWatchdog = null;         // setInterval ID for watchdog
let _musicReloadInFlight = false;  // True while a devicechange reload (load()+play()) is in progress — watchdog skips play() during this
let _deviceChangeTimer = null;     // Debounce handle for devicechange — Windows can fire bursts of events
let _musicGestureArmed = false;    // True while a one-shot gesture listener is waiting to retry a blocked play()

/**
 * _getMusicTargetVolume — Calculate target volume based on slider and max cap.
 */
function _getMusicTargetVolume() {
    return ((appSettings.musicVolume ?? 25) / 100) * _MUSIC_MAX_VOLUME;
}

/**
 * initMusic — Create the Audio element for background music.
 * Uses native loop for reliable gapless looping.
 * Preloads the MP3 file. Does NOT start playback.
 */
function initMusic() {
    if (_mInitialized) return;

    try {
        _musicAudio = new Audio(_AUDIO_BASE + 'sounds/Pixel-Sipper.mp3');
        _musicAudio.loop = true;   // Browser native loop — simple and reliable
        _musicAudio.volume = 0;
        _musicAudio.preload = 'auto';
        _mInitialized = true;
    } catch (e) {
        console.warn('Background music could not be initialised:', e);
        _mInitialized = false;
    }
}

/**
 * _startMusicWatchdog — Checks every 2 seconds that music is still playing.
 * Browsers can pause audio on tab switch or CPU load.
 * The watchdog restarts music if it has stopped unexpectedly.
 */
function _startMusicWatchdog() {
    _stopMusicWatchdog();
    _musicWatchdog = setInterval(() => {
        if (!isMusicPlaying || isMusicMuted || !_musicAudio) return;

        // Skip if a devicechange reload is in progress — otherwise watchdog.play()
        // races with _musicAudio.load() and can cause stutter/duplicate playback.
        // The canplay/error handler in the devicechange listener clears the flag.
        if (_musicReloadInFlight) return;

        // Resume Tone.js AudioContext if suspended (device switch, tab switch)
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume().catch(() => {});
        }

        // Restart music if paused or stalled
        if (_musicAudio.paused || _musicAudio.readyState < 2) {
            _musicAudio.volume = _getMusicTargetVolume();
            _musicAudio.play().catch(() => {});
        }
    }, 2000);
}

/**
 * _stopMusicWatchdog — Stop the watchdog timer.
 */
function _stopMusicWatchdog() {
    if (_musicWatchdog) {
        clearInterval(_musicWatchdog);
        _musicWatchdog = null;
    }
}

// Gesture event types we listen for to unlock blocked autoplay. We cover pointer,
// touch, mouse and keyboard so the very first interaction anywhere in the app counts.
const _MUSIC_GESTURE_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'];

/**
 * _armMusicGestureRetry — Recover from a blocked autoplay on the next user gesture.
 *
 * Browsers reject (or silently pause) play() when it is not tied to a "real" user
 * interaction (e.g. the MP3 was not yet decoded when the start button was clicked, or
 * the audio context was suspended). When that happens we register a ONE-SHOT listener
 * on the next user gesture and retry startMusic() from inside that fresh gesture, where
 * play() is allowed.
 *
 * The listeners are registered in the CAPTURE phase so that an inner handler calling
 * stopPropagation() (several game buttons do) cannot prevent the unlock from firing.
 *
 * Without this the player would be stuck with "music on" in settings but silence, and
 * the only way out would be to manually toggle music off and on again.
 */
function _armMusicGestureRetry() {
    if (_musicGestureArmed) return;   // Listener already waiting — don't stack duplicates
    _musicGestureArmed = true;

    const retry = () => {
        _MUSIC_GESTURE_EVENTS.forEach(ev => document.removeEventListener(ev, retry, true));
        _musicGestureArmed = false;
        // Only retry if the user still wants music and it is not already playing.
        if (!isMusicMuted && !isMusicPlaying) startMusic();
    };

    // capture = true → fires before any stopPropagation() deeper in the tree.
    _MUSIC_GESTURE_EVENTS.forEach(ev => document.addEventListener(ev, retry, true));
}

/**
 * startMusic — Start playback of background music.
 *
 * play() returns a promise. Three outcomes are handled:
 *   1. Rejects        → autoplay blocked; arm a gesture retry.
 *   2. Resolves but the element is still paused → browser refused silently; arm retry.
 *   3. Resolves and is playing → success.
 */
function startMusic() {
    if (!_mInitialized || isMusicMuted || isMusicPlaying) return;
    if (!_musicAudio) return;

    isMusicPlaying = true;
    _musicAudio.volume = _getMusicTargetVolume();
    const playPromise = _musicAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
            // Some browsers resolve play() yet immediately pause when autoplay is
            // refused — treat a paused element as a blocked start and arm a retry.
            if (_musicAudio && _musicAudio.paused) {
                isMusicPlaying = false;
                _armMusicGestureRetry();
            }
        }).catch(() => {
            // Autoplay blocked — browser requires a user interaction first.
            // Reset the flag and arm a one-shot retry on the next user gesture so the
            // player does not have to manually toggle music off/on to get sound.
            isMusicPlaying = false;
            _armMusicGestureRetry();
        });
    }
    _startMusicWatchdog();
}

/**
 * stopMusic — Pause background music. Preserves position for resume.
 */
function stopMusic() {
    isMusicPlaying = false;
    _stopMusicWatchdog();
    if (_musicAudio) { try { _musicAudio.pause(); } catch(e) {} }
}

/**
 * toggleMusic — Toggle music on/off and save the setting.
 * Returns the new muted state (true = off).
 */
function toggleMusic() {
    isMusicMuted = !isMusicMuted;
    appSettings.musicMuted = isMusicMuted;
    saveSettings(appSettings);

    if (isMusicMuted) {
        stopMusic();
    } else {
        if (!_mInitialized) initMusic();
        startMusic();
    }

    return isMusicMuted;
}

/**
 * toggleCgm — Toggle CGM sounds on/off and save the setting.
 * CGM sounds: bonus, inRange, hypoWarn, hyperWarn, tick.
 * Returns the new muted state (true = off).
 */
function toggleCgm() {
    isCgmMuted = !isCgmMuted;
    appSettings.cgmMuted = isCgmMuted;
    saveSettings(appSettings);
    return isCgmMuted;
}

/**
 * setMusicVolume — Set music volume (0-100) and save the setting.
 * Updates _musicAudio.volume directly (0.0 – 1.0).
 */
// Music file max volume cap (0.25 = 25% of original loudness).
// The slider scales within this ceiling, so 100% slider = 25% real volume.
const _MUSIC_MAX_VOLUME = 0.25;

function setMusicVolume(pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    appSettings.musicVolume = pct;
    saveSettings(appSettings);
    // Update volume directly on the audio element
    if (_musicAudio && !_musicAudio.paused) {
        _musicAudio.volume = _getMusicTargetVolume();
    }
    return pct;
}

// =============================================================================
// AUDIO PLAYBACK RECOVERY
// =============================================================================
//
// The browser can suspend AudioContext and pause HTMLAudioElement in several
// situations:
//   1. Audio output switches (Bluetooth/HDMI/device selection) — devicechange
//   2. Tab is in background / screen is locked (especially tablet/mobile) —
//      visibilitychange
//   3. Network goes offline and comes back online — online
//   4. Browser restores from bfcache (back/forward navigation) — pageshow
//
// All four scenarios call the same recovery routine: resume Tone.js
// context + reload+play HTMLAudio if music should be playing. Without these
// listeners the UI still shows "music active" while sound has stopped — this
// was bug issue 38.
//
// During the reload itself (load()+play()) we set _musicReloadInFlight = true
// so the watchdog does not race with play() while audio is reloading.
// Debounce: events can arrive in bursts (especially devicechange during BT
// negotiation), so the last event in a burst wins.
// =============================================================================

function _recoverMusicPlayback() {
    // 1. Resume Tone.js AudioContext hvis den er suspenderet
    if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
        Tone.context.resume().catch(() => {});
    }

    // 2. Restart music if it should be playing but is paused
    if (isMusicPlaying && !isMusicMuted && _musicAudio) {
        // Set inflight flag → watchdog skips its play() branch
        // while we reload. canplay/error handlers clear the flag when
        // audio is ready again (or failed). Safety timeout clears it
        // regardless after 3s if no event fires.
        _musicReloadInFlight = true;
        const onReady = () => {
            _musicReloadInFlight = false;
            if (_musicAudio) {
                _musicAudio.removeEventListener('canplay', onReady);
                _musicAudio.removeEventListener('error', onReady);
            }
        };
        _musicAudio.addEventListener('canplay', onReady);
        _musicAudio.addEventListener('error', onReady);
        setTimeout(() => { if (_musicReloadInFlight) onReady(); }, 3000);

        // The audio element may be paused, stalled, or in an error state.
        // Reload and restart to bind to the new output / re-activate.
        const currentTime = _musicAudio.currentTime;
        try {
            _musicAudio.load();
            _musicAudio.currentTime = currentTime;
        } catch (e) { /* load can throw if audio is in an error state */ }
        _musicAudio.volume = _getMusicTargetVolume();
        _musicAudio.play().catch(() => {});
    }
}

function _scheduleMusicRecovery(delayMs = 500) {
    if (_deviceChangeTimer) clearTimeout(_deviceChangeTimer);
    _deviceChangeTimer = setTimeout(() => {
        _deviceChangeTimer = null;
        _recoverMusicPlayback();
    }, delayMs);
}

// devicechange: BT/HDMI/output switch. Burst debounce 500ms.
if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => _scheduleMusicRecovery(500));
}

// visibilitychange: tab becomes visible again after being in the background.
// Primary fix on tablet/mobile where the browser suspends audio when apps switch
// or the screen locks. Short delay (200ms) gives the browser time to
// re-activate the audio stack before we attempt play().
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            _scheduleMusicRecovery(200);
        }
    });
}

// online: network comes back. Even though music is a local MP3, the browser may
// have suspended audio during the offline period (especially on tablet).
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => _scheduleMusicRecovery(200));
    // pageshow: bfcache restore (back/forward navigation). persisted=true
    // means the page was loaded from bfcache and audio may be suspended.
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) _scheduleMusicRecovery(200);
    });
}
