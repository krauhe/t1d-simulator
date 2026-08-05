// =============================================================================
// PHYSIOLOGY-ENGINE.JS — Standalone physiology engine (under construction)
// =============================================================================
//
// Goal: a reusable physiological model WITHOUT DOM, sound, canvas or game UI,
// which the current game (Simulator facade), model tests and future
// tools can share. See the plan: docs/reviews/2026-06-14_physiology-engine-
// api-plan.md, and the work log: docs/reviews/physiology-engine-LOG.md.
//
// Status (slice S2): Engine skeleton created and progressively owns more
// physiological state. Simulator creates an engine in its constructor and
// exposes engine-owned state via proxy accessors, so existing
// this.X calls in simulator.js can be migrated without behaviour change.
//
// Export: browser-global via script tag (no build step). When the engine is later
// fully standalone, module.exports will be added for clean Node require (slice S6).
// Until then the file is loaded in Node via eval in tests/harness.js — same pattern
// as js/hovorka.js and js/simulator.js.
// =============================================================================

// -----------------------------------------------------------------------------
// makeRng — Seeded pseudo-random generator (mulberry32)
// -----------------------------------------------------------------------------
// Returns a function that behaves like Math.random() (yields a number in
// [0,1)), but is deterministic: the same seed always produces the same sequence.
// Foundation for golden-master regression: same seed + same input gives
// bit-identical output, so the model can be compared across refactors.
function makeRng(seed) {
    let a = seed >>> 0; // coerce to 32-bit unsigned integer
    const rng = function() {
        a = (a + 0x6D2B79F5) | 0;
        rng._state = a >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng._state = a >>> 0;
    rng._setState = function(state) {
        a = state >>> 0;
        rng._state = a;
    };
    return rng;
}

// MODULE_DEFAULTS — toggleable physiology modules (S9.10 / S9.12). Eight modules are
// 0..1 intensity SCALARS (default 1 = full effect); two are plain booleans (default
// true). A scalar dials the module's effect strength: 1 = today's full physiology,
// 0 = off, 0.5 = half strength. Set via createEngine(profile, { modules: { <key>: 0.5 } }).
// A boolean is also accepted for a scalar key and coerced (true→1, false→0), so existing
// { dawn: false }-style opt-outs keep working unchanged. ALL default to full strength,
// so the full physiology — and golden-master bit-identity — is unchanged unless a caller
// opts out (every scalar enters the model as `* 1.0`, an IEEE no-op).
//
// The two boolean modules are structural/discrete and have no meaningful intermediate
// "intensity": cgmSensorFaults gates discrete sensor events (warmup/self-test/loss),
// and fatProtein switches a whole sub-model (fat/protein meal handling) on or off.
//
// CGM sensor NOISE is a separate, pre-existing control (`noiseEnabled`/`setNoise`), not
// a module here. Defining "easy mode" is a game decision (the facade picks a
// combination); the engine only exposes the individual switches.
const MODULE_DEFAULTS = {
    dawn: 1,                 // [scalar] dawn phenomenon (morning cortisol HGP) + circadian ISF
    dawnVariability: 1,      // [scalar] day-to-day variation in dawn amplitude/peak (0 → fixed mean)
    stressResponse: 1,       // [scalar] acute counter-regulation + chronic stress + HAAF (not the dawn cortisol)
    glucotoxicity: 1,        // [scalar] hyperglycemia-induced insulin resistance
    ketones: 1,              // [scalar] ketone production / DKA acidosis load
    sleepDisruption: 1,      // [scalar] night-intervention sleep loss → next-day chronic stress
    cgmSensorFaults: true,   // [boolean] CGM warmup / auto self-test / sensor loss (not random noise)
    insulinVariability: 1,   // [scalar] per-injection PK randomness (bioavailability + tau)
    fatProtein: true,        // [boolean] fat/protein meal effects (pizza-effect gastric slowing, FFA, protein-glucagon)
    ffaResistance: 1,        // [scalar] FFA-induced insulin resistance (the "second wave" after a fatty meal)
};

// MODULE_IS_SCALAR — true for the 0..1 intensity modules, false for the boolean ones.
// Derived from the default's type so the two lists never drift apart.
const MODULE_IS_SCALAR = Object.fromEntries(
    Object.keys(MODULE_DEFAULTS).map(k => [k, typeof MODULE_DEFAULTS[k] === 'number'])
);

// requireNumber — input validation for the public API (S9.9). Throws a TypeError
// for non-numbers/NaN/Infinity and a RangeError for out-of-range values, with a
// clear message naming the field. Used by the constructor and the interventions so
// a malformed external call fails fast instead of silently producing garbage (e.g.
// `NaN || 0` quietly collapsing to 0). Returns the validated value for chaining.
function requireNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(
            `PhysiologyEngine: '${name}' must be a finite number, got ${
                typeof value === 'number' ? value : typeof value}`);
    }
    if (value < min || value > max) {
        throw new RangeError(`PhysiologyEngine: '${name}' must be within [${min}, ${max}], got ${value}`);
    }
    return value;
}

// =============================================================================
// MUSCLE GLYCOGEN — mass-balanced depot, scaled to body weight (S7.5c)
// =============================================================================
// Engine-owned, used only by updateMuscleGlycogen() — the single source of truth
// (the former simulator.js copies + their doc block have been removed).
//
// Muscles store ~5.5 g glycogen per kg body weight (Jensen 2011: ~15 g/kg muscle
// mass at ~35% muscle mass -> 5-6 g/kg total). For a 70 kg adult: ~385 g. This
// pool is a MAJOR fuel during exercise: at high intensity muscle glycogen covers
// 60-75% of energy demand (Romijn 1993).
//
// CONSUMPTION (depletes pool, during exercise):
//   kcalPerMin x glycogen-fraction / 4 kcal/g. Fraction by intensity: Low 30%,
//   Medium 50%, High 75% (scaled by the activity's glycogenUseScaling).
//
// RESYNTHESIS (refills the intracellular bookkeeping pool):
//   Phase 1 (insulin-independent, 0-~60 min post): AMPK/GLUT4 still activated,
//     rate up to ~1.0 g/min (Ivy 1988: 5-7 mmol/kg/h over the first 4 h).
//   Phase 2 (insulin-dependent, 1-24 h post): requires insulin x BG drive,
//     baseline 0.1-0.3 g/min; carbohydrate intake accelerates it (Jentjens 2003).
//   IMPORTANT: Repletion does not subtract glucose directly from Q1. Hovorka's
//     x1/x2 channels already represent total insulin-mediated glucose disposal,
//     including non-oxidative storage, while E1 owns the contraction-mediated
//     uptake. A separate Q1 drain therefore counted the same uptake twice.
//
// COUPLING TO EARLY-PEIS (Wojtaszewski 2000): the early post-exercise sensitivity
//   boost is modulated by (1 - muscleGlycogenReserve). Empty pool -> full boost
//   -> higher insulin-stimulated uptake; full pool -> boost ~ 0. Carbohydrate
//   refeeding refills the pool and reverses the early phase within hours.
//
// LATE-PEIS is DECOUPLED from glycogen: AS160 phosphorylation persists regardless
//   of pool status, so the late component has its own fixed half-life decay. It
//   drives biphasic nocturnal hypoglycemia after afternoon exercise (McMahon
//   2007: BG can dip again 7-11 h later as the late component overlaps the
//   nocturnal basal insulin).
//
// Sources: Jensen 2011 (pool size), Romijn 1993 (fuel partitioning), Ivy 1988 /
//   Jentjens 2003 (resynthesis kinetics), Mikines 1988 (PEIS), McMahon 2007.
// =============================================================================
const MUSCLE_GLYCOGEN_G_PER_KG = 5.5;
const MUSCLE_GLYCOGEN_DEPLETION_FRACTION = { Lav: 0.30, Medium: 0.50, Høj: 0.75 };
const MUSCLE_GLYCOGEN_FAST_PHASE_RATE   = 0.8;   // Peak insulin-independent rate (Ivy 1988)
const MUSCLE_GLYCOGEN_SLOW_PHASE_RATE   = 0.3;   // Insulin-dependent baseline
const MUSCLE_GLYCOGEN_CHO_ACCEL_RATE    = 0.5;   // CHO-accelerated phase-2 contribution
const MUSCLE_GLYCOGEN_FAST_PHASE_HL_MIN = 45;    // Phase-1 decay t½ (AMPK persistence)

// Glucose molar mass for g <-> mmol conversion. C6H12O6 = 180.16 g/mol, so
// 1 mmol glucose weighs 0.18016 g (equivalently 1 g = 1000/180.16 ~ 5.55 mmol).
// Engine-owned (ENGINE_-prefixed); this is now the single source — the former
// GLUCOSE_* copies in simulator.js have been removed.
const ENGINE_GLUCOSE_G_PER_MMOL = 180.16 / 1000;  // = 0.18016 g/mmol

// Energy density of body tissue: ~7700 kcal stored/released per kg of body-weight
// change (standard nutritional approximation). Drives weightChangeKg from the net
// caloric balance (consumed - resting burn - exercise burn). Engine-owned single
// source — the former KCAL_PER_KG_WEIGHT global in main.js feeds only the UI label.
const ENGINE_KCAL_PER_KG_WEIGHT = 7700;

// =============================================================================
// EXERCISE-INDUCED INSULIN SENSITIVITY — three-component model (S7.6a)
// =============================================================================
// Used by currentISF. Engine-owned (ENGINE_-prefixed); this is now the single
// source — the former EXERCISE_* copies + their doc block in simulator.js have
// been removed.
//
// Exercise raises insulin sensitivity via three partly independent mechanisms.
// Total effect: sensitivityIncreaseFactor = 1 + sum(fast + early + late) summed
// over sessions, capped at ENGINE_EXERCISE_SENS_CAP (2.5; Mikines 1988 ~2x).
//
//   FAST (acute insulin-mediated synergy): builds over minutes and decays with
//     t1/2 ~15 min after the delayed exercise stimulus ends. Contraction-mediated,
//     insulin-INDEPENDENT uptake is represented separately by Hovorka E1, so this
//     term only shifts the muscle insulin-response curve.
//
//   EARLY (~1-4 h, glycogen-permissive): builds over ~30 min; decay is coupled
//     to the muscle glycogen pool: earlyBoost = A_early x (1 - glycogenReserve).
//     Empty pool -> full boost; full pool -> none. sqrt(duration/60) scaled;
//     requires insulin to manifest. Sources: Wojtaszewski 2000, Cartee 2015.
//
//   LATE (~24-48 h, AS160/TBC1D4-mediated): builds over ~30 min; decays as
//     lateBoost = A_late x 0.5^(t_post / t1/2), with t1/2 = 18 h (mid-range of
//     Cartee 2015's 12-24 h). NOT glycogen-coupled — a phosphorylation memory
//     that carbohydrate refeeding does not reverse; drives night-hypo after
//     evening exercise. Sources: Mikines 1988, Cartee 2015, Riddell 2017.
//
// Calibration (60 min Cardio Medium, e2=1.0): A_late_peak = 0.50 x sqrt(60/60) x
//   (1-e^-2) = 0.43. +24 h: 0.43 x 0.5^(24/18) = 17% (Cartee 2015 mid 25-50%
//   disposal); +48 h: 6.8% (Mikines 1988); +120 h: 0.4% (undetectable at 5 days).
//   A_late was raised 0.37 -> 0.50 (review C-A3.b 2026-04-30) so +24 h lands
//   nearer Cartee's central range. Intensity ratios preserved (Low/Medium 0.60,
//   High/Medium 1.56). See docs/reviews/2026-04-29_late-phase-peis-fix.md.
// =============================================================================
const ENGINE_EXERCISE_FAST_BASE_AMPLITUDE  = { Lav: 0.30, Medium: 0.80, Høj: 1.00 };
const ENGINE_EXERCISE_FAST_TAU_ACTIVATION_MIN = 2;
const ENGINE_EXERCISE_FAST_HALFLIFE_MIN    = 15;
const ENGINE_EXERCISE_EARLY_BASE_AMPLITUDE = { Lav: 0.10, Medium: 0.18, Høj: 0.30 };
const ENGINE_EXERCISE_EARLY_TAU_BUILDUP_MIN = 30;
const ENGINE_EXERCISE_EARLY_HALFLIFE_MIN    = 4 * 60;
const ENGINE_EXERCISE_LATE_BASE_AMPLITUDE  = { Lav: 0.30, Medium: 0.50, Høj: 0.78 };
const ENGINE_EXERCISE_LATE_TAU_BUILDUP_MIN = 30;
const ENGINE_EXERCISE_LATE_HALFLIFE_MIN    = 18 * 60;
// Hill-eksponenten former den glatte latenstidskurve. n=4 holder styrke-PEIS
// meget lille i det tidlige Young-vindue, men uden en fysiologisk kontakt ved
// ét bestemt minut. Alder og onset-halvtid har begge enheden minutter, så
// deres forhold og dermed Hill-faktoren er dimensionsløs.
const ENGINE_EXERCISE_ONSET_HILL_N          = 4;
const ENGINE_EXERCISE_SENS_CAP             = 2.5;
// Post-exercise sensitivity cleanup cutoff: a hard 96 h lifetime bound (Mikines
// 1988: undetectable at 5 days). Used by stopActivity (S8-A4). Engine-owned; the
// former EXERCISE_SENSITIVITY_MAX_LIFETIME_MIN copy in simulator.js was removed.
const ENGINE_EXERCISE_SENSITIVITY_MAX_LIFETIME_MIN = 96 * 60;

// exerciseSensitivityOnsetGate — glat latenstidskurve uden en ren delay.
// onsetHalfMin er tidspunktet, hvor gate=0,5; det er IKKE en startgrænse.
// For n>1 er både værdien og hældningen 0 ved aktivitetens start. En værdi på
// 0 betyder øjeblikkelig fuld gate (cardio), mens fx 120 min giver en gradvis
// styrke-onset gennem det tidlige recovery-vindue.
function exerciseSensitivityOnsetGate(ageMin, onsetHalfMin) {
    if (!(ageMin > 0)) return 0;
    if (!(onsetHalfMin > 0)) return 1;

    const ageRatio = ageMin / onsetHalfMin;
    const poweredRatio = Math.pow(ageRatio, ENGINE_EXERCISE_ONSET_HILL_N);
    return poweredRatio / (1 + poweredRatio);
}

// exerciseRectangularResponse — continuous response to an exercise bout. The
// exercise stimulus is a rectangle from start to end. Responsen bygges med
// buildTauMin; efter afslutning henfalder den med decayHalfLifeMin. Den glatte
// aktivitetstype-latens multipliceres separat via
// exerciseSensitivityOnsetGate(), så denne funktion ikke indeholder en skjult
// tidskontakt.
//
// This is deliberately a function of start time and duration, NOT of the stop
// event. A three-hour bout can therefore develop sensitivity while exercise is
// still running. The value is mathematically continuous at stop.
function exerciseRectangularResponse(
    ageMin,
    durationMin,
    buildTauMin,
    decayHalfLifeMin
) {
    if (!(ageMin > 0)) return 0;

    // null duration means that the activity is still running.
    if (durationMin == null || ageMin < durationMin) {
        return 1 - Math.exp(-ageMin / buildTauMin);
    }

    const peakAfterFullStimulus = 1 - Math.exp(-durationMin / buildTauMin);
    const minutesAfterEnd = ageMin - durationMin;
    return peakAfterFullStimulus *
        Math.pow(0.5, minutesAfterEnd / decayHalfLifeMin);
}

// Hovorka reference ISF (S9.1). The Hovorka model's baseline insulin parameters yield
// an effective ISF of ~3.75 mmol/L per unit. The simulated subject's ISF is mapped to the model's
// insulin sensitivity scale via isf / HOVORKA_REFERENCE_ISF (e.g. ISF=3.0 -> 0.80).
// Previously this number lived as a magic "3.75" in the Simulator constructor; the engine
// now owns the coupling so a standalone user does not need to know it.
const HOVORKA_REFERENCE_ISF = 3.75;

// Default activity catalogue (S9.2). Standalone engine copy of the PHYSIOLOGICAL
// fields from the game's AKTIVITETSTYPER (js/simulator.js) — the engine reads no globals.
// Used ONLY as fallback when startActivity() is called without an explicit typeDef, so a
// standalone user can write engine.startActivity({type:'cardio', intensity:'Medium',
// durationMin:30}) without knowing the typeDef contract. The game facade always passes its
// own typeDef and therefore never touches this catalogue (-> bit-identical).
// Values are a faithful subset of the validated game values; UI fields (name, icon,
// colour) are omitted. Intensity keys follow the game: Lav / Medium / Høj.
const ENGINE_DEFAULT_ACTIVITIES = {
    cardio: {
        hrTarget: { Lav: 100, Medium: 130, Høj: 160 },
        contractionUptakeScaling: 1.0,
        fastSensitivityScaling: 1.0,
        earlySensitivityScaling: 1.0,
        lateSensitivityScaling: 1.0,
        insulinSensitivityOnsetHalfMin: 0,
        glycogenUseScaling: 1.0,
        hepaticDriveRate: { Lav: 0, Medium: 0, Høj: 0.005 },
        hepaticDriveCeiling: { Lav: 0, Medium: 0, Høj: 0.40 },
        kcalPerMin: { Lav: 4, Medium: 7, Høj: 10 },
        stressReduction: 0, vasodilatation: 0,
    },
    styrke: {
        hrTarget: { Lav: 85, Medium: 110, Høj: 135 },
        contractionUptakeScaling: 0.55,
        // Young et al. 2023 found no significant insulin-mediated glucose-
        // utilization increase during or in the first 45 min after resistance
        // exercise. The fast component is therefore disabled. A smaller 0.45
        // early/late scale preserves the documented recovery effect and gives
        // about 12% greater disposal at 24 h (Breen et al. 2011).
        fastSensitivityScaling: 0.0,
        earlySensitivityScaling: 0.45,
        lateSensitivityScaling: 0.45,
        // Glat onset med halvtid 150 min fra start. Ved et 45-minutters pas er
        // PEIS fortsat nær baseline gennem de første 30 minutters recovery,
        // hvorefter den udvikles gradvist gennem 1-2 timers recovery.
        insulinSensitivityOnsetHalfMin: 150,
        glycogenUseScaling: 0.90,
        // Fælles undervisningskalibrering: 1,25 x leverrespons, uden
        // individuelle responderprofiler eller ændring af PEIS.
        hepaticDriveRate: { Lav: 0.010, Medium: 0.020, Høj: 0.03125 },
        hepaticDriveCeiling: { Lav: 0.3125, Medium: 0.75, Høj: 1.25 },
        kcalPerMin: { Lav: 3, Medium: 5, Høj: 8 },
        stressReduction: 0, vasodilatation: 0,
    },
    blandet: {
        hrTarget: { Lav: 105, Medium: 135, Høj: 165 },
        contractionUptakeScaling: 0.45,
        fastSensitivityScaling: 0.85,
        earlySensitivityScaling: 0.85,
        lateSensitivityScaling: 0.85,
        insulinSensitivityOnsetHalfMin: 10,
        glycogenUseScaling: 0.85,
        hepaticDriveRate: { Lav: 0.003, Medium: 0.006, Høj: 0.012 },
        hepaticDriveCeiling: { Lav: 0.20, Medium: 0.40, Høj: 0.65 },
        kcalPerMin: { Lav: 5, Medium: 8, Høj: 12 },
        stressReduction: 0, vasodilatation: 0,
    },
    afslapning: {
        hrTarget: { Lav: 58, Medium: 65, Høj: 75 },
        contractionUptakeScaling: 0.01,
        fastSensitivityScaling: 0.0,
        earlySensitivityScaling: 0.0,
        lateSensitivityScaling: 0.0,
        insulinSensitivityOnsetHalfMin: 0,
        glycogenUseScaling: 0.0,
        hepaticDriveRate: { Lav: 0, Medium: 0, Høj: 0 },
        hepaticDriveCeiling: { Lav: 0, Medium: 0, Høj: 0 },
        kcalPerMin: { Lav: 1.5, Medium: 2, Høj: 2.5 },
        stressReduction: { Lav: 0.005, Medium: 0.01, Høj: 0.015 },
        vasodilatation: { Lav: 0.02, Medium: 0.03, Høj: 0.05 },
    },
};

// resolveHovorkaBindings — find both the model class and its state-index map.
// Browser: hovorka.js is loaded first as a classic script, so HovorkaModel and
// HOVORKA_STATE_IDX share the global lexical scope with this file. Node: import
// both exports explicitly. Keeping the pair together prevents the standalone API
// from accidentally depending on a test harness that creates global variables.
function resolveHovorkaBindings() {
    if (typeof HovorkaModel !== 'undefined' && typeof HOVORKA_STATE_IDX !== 'undefined') {
        return { HovorkaModel, HOVORKA_STATE_IDX };
    }
    if (typeof require !== 'undefined') {
        const bindings = require('./hovorka.js');
        if (bindings.HovorkaModel && bindings.HOVORKA_STATE_IDX) return bindings;
    }
    throw new Error(
        'PhysiologyEngine: HovorkaModel eller HOVORKA_STATE_IDX ikke tilgængelig ' +
        '(indlæs hovorka.js før physiology-engine.js)');
}

const ENGINE_HOVORKA_BINDINGS = resolveHovorkaBindings();
const ENGINE_HOVORKA_STATE_IDX = ENGINE_HOVORKA_BINDINGS.HOVORKA_STATE_IDX;

// -----------------------------------------------------------------------------
// PhysiologyEngine — the physiological core (under construction)
// -----------------------------------------------------------------------------
class PhysiologyEngine {
    // @param {object} profile  Simulated-subject profile (weight, isf, icr). Used by
    //                          later slices; stored already now.
    // @param {object} options  { seed }. Without seed a random seed is chosen,
    //                          so normal gameplay varies between sessions; tests
    //                          and golden-master supply a fixed seed.
    constructor(profile = {}, options = {}) {
        this.profile = profile;

        // this.rng() is the sole source of randomness in the entire model.
        // (Only Math.random: seed entropy here, if no seed is given.)
        this._seed = (options.seed != null)
            ? (options.seed >>> 0)
            : (Math.floor(Math.random() * 0x7FFFFFFF) >>> 0);
        this.rng = makeRng(this._seed);

        // --- Noise flag (lab API, S5) ---
        // noiseEnabled controls WHETHER CGM sensor noise (proportional noise, slow drift
        // and discontinuities) is applied. Default IS true, so normal gameplay and
        // golden-master are unchanged. setNoise(false) gives a clean, smooth signal
        // for laboratory plots. Determinism = seed (reproducible rng sequence)
        // + noiseEnabled (whether noise is applied). See docs/reviews/2026-06-14_physiology-
        // engine-api-plan.md.
        this.noiseEnabled = options.noiseEnabled !== false;

        // --- Toggleable physiology modules (S9.10 / S9.12) ---
        // Build this.modules from MODULE_DEFAULTS (all full strength) overlaid with caller
        // overrides. Validate per key: an unknown key is a likely typo and throws (fail
        // fast, like the other inputs). Scalar modules accept a number in [0,1] OR a
        // boolean (coerced true→1, false→0, so { dawn: false } still means "off"); the two
        // structural modules accept a boolean only. Scalar values are stored as numbers so
        // moduleScale() can read them uniformly.
        this.modules = Object.assign({}, MODULE_DEFAULTS);
        if (options.modules != null) {
            if (typeof options.modules !== 'object') {
                throw new TypeError("PhysiologyEngine: 'options.modules' must be an object of module toggles");
            }
            for (const key of Object.keys(options.modules)) {
                if (!(key in MODULE_DEFAULTS)) {
                    throw new RangeError(
                        `PhysiologyEngine: unknown module '${key}'. Known: ${Object.keys(MODULE_DEFAULTS).join(', ')}`);
                }
                const val = options.modules[key];
                if (MODULE_IS_SCALAR[key]) {
                    if (typeof val === 'boolean') {
                        this.modules[key] = val ? 1 : 0;
                    } else if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1) {
                        this.modules[key] = val;
                    } else {
                        throw new RangeError(`PhysiologyEngine: module '${key}' must be a number in [0, 1] or a boolean`);
                    }
                } else {
                    if (typeof val !== 'boolean') {
                        throw new TypeError(`PhysiologyEngine: module '${key}' must be a boolean`);
                    }
                    this.modules[key] = val;
                }
            }
        }

        this.plasmaInsulinClamp = null;        // Lab API: null = normal Hovorka dynamics
        this.scenarioRunner = null;            // Lab API bridge to Simulator, until step() is moved

        // --- Event buffer (S3 skeleton) ---
        // The engine must not ultimately call logEvent(), playSound(), gameOver() or
        // DOM directly. Instead physiology places structured events here,
        // which the Simulator facade later translates to sound, log, popup and game
        // mechanics. No existing side-effects have been moved yet.
        this.events = [];

        // --- Clinical events (S9.3, opt-in) ---
        // When clinicalEvents is enabled, engine.step() emits edge-triggered
        // physiological events (glucose-low/high, ketones-elevated, acidosis-risk,
        // brain-energy-low) with severity, so a standalone consumer can subscribe
        // instead of polling getState(). DEFAULT OFF: the game facade does not use it,
        // so the game's event stream is unchanged (bit-identical). _clinicalZones remembers the
        // last-reported zone per dimension so events fire only at TRANSITIONS.
        this.clinicalEvents = options.clinicalEvents === true;
        this._clinicalZones = { glucose: 'in-range', ketones: 'normal', acidosis: 'none', brain: 'none' };

        // --- Simulation clock (S7.2) ---
        // The engine owns forward-progressing time. The Simulator facade exposes
        // totalSimMinutes/timeInMinutes/day via proxy. step() advances them
        // each tick (see step()); campaign start can overwrite them via the facade
        // setter before the first step.
        this.totalSimMinutes = 0;   // Total elapsed sim time [min] (never wraps)
        this.timeInMinutes = 0;     // Time of day [0-1440), wraps at midnight
        this.day = 1;               // Current sim day (1-indexed)
        this._lastPhysioRecordTime = -1;  // Sampling cadence for the substep loop (S7.6c)

        // --- Simulated-subject parameters (from profile or defaults) ---
        // The engine owns the subject's core parameters; the Simulator facade exposes
        // them via proxy getters/setters, so this.weight/this.ISF/this.ICR are
        // unchanged (slice S2). Validate explicitly supplied values (S9.9); omitted
        // fields fall back to defaults.
        if (profile.weight != null) requireNumber(profile.weight, 'profile.weight', { min: 1, max: 500 });
        if (profile.isf != null) requireNumber(profile.isf, 'profile.isf', { min: 0.1, max: 50 });
        if (profile.icr != null) requireNumber(profile.icr, 'profile.icr', { min: 1, max: 200 });
        this.weight = profile.weight || 70;   // body weight [kg]
        this.ISF = profile.isf || 3.0;        // insulin sensitivity [mmol/L per U]
        this.ICR = profile.icr || 10;         // insulin-to-carb ratio [g per U]
        // gramsPerMmolRise: grams of carbohydrate that raise BG by 1 mmol/L (= ICR/ISF).
        this.gramsPerMmolRise = this.ICR / this.ISF;

        // --- Derived profile parameters ---
        // Resting metabolic rate: baseline 2200 kcal/day at 70 kg, scaled
        // linearly with body weight.
        this.restingKcalPerDay = this.weight * (2200 / 70);
        this.restingKcalPerMinute = this.restingKcalPerDay / (24 * 60);

        // Estimated Total Daily Dose (TDD) and an initial basal placeholder. The
        // clinical TDD·0.45 heuristic is used only as the binary search's initial
        // guess. initSteadyState() replaces it with an explicit contract containing
        // both the effective model input and the injected amount before bioavailability.
        const tddFromISF = 100 / this.ISF;
        const tddFromWeight = this.weight * 0.55;
        this.estimatedTDD = Math.min(tddFromISF, tddFromWeight);
        this.basalDose = Math.round(this.estimatedTDD * 0.45);
        this.effectiveBasalRequirement = undefined; // U/day reaching the model
        this.basalInjectionRequirement = undefined; // U/day injected before bioavailability

        // --- Hovorka glucose-insulin model (S9.1) ---
        // The engine now owns its own Hovorka instance instead of having it injected
        // from outside. The simulated subject's ISF is mapped to the model's insulin sensitivity scale via
        // HOVORKA_REFERENCE_ISF. The HovorkaModel constructor draws NO RNG, so
        // construction here does not shift the seeded sequence (the CGM draws below are
        // unchanged). A caller can still override with attachHovorka() if needed.
        const HovorkaModelClass = ENGINE_HOVORKA_BINDINGS.HovorkaModel;
        this.hovorka = new HovorkaModelClass(this.weight, {
            insulinSensitivityScale: this.ISF / HOVORKA_REFERENCE_ISF
        });

        // --- Blood glucose and CGM state ---
        // trueBG is the actual blood glucose value ("ground truth"). The Hovorka
        // flow still updates the value from the Simulator facade via proxy, until
        // the step mathematics is moved in later slices.
        this.trueBG = 5.5;                    // Overwritten after steady-state init

        // cgmBG: the CGM reading the player sees. The CGM layer has delay/noise relative to
        // trueBG, just like real sensors.
        this.cgmBG = 5.5;                     // Overwritten after steady-state init
        this.lastCgmCalculationTime = -5;     // First CGM update occurs at t=0

        // CGM sensor characteristics — calibrated against real Libre 2 data.
        // Analysis of ~34,000 readings over a year shows:
        //   - Noise std: ~0.18 mmol/L (scales with BG level: ~3-5% of BG)
        //   - Noise is nearly pure random (lag-1 autocorrelation: -0.04)
        //   - Drift: slow systematic deviation over the sensor's lifetime
        //   - Discontinuities: ~0.7/day (jumps > 2 mmol/L, e.g. compression, calibration)
        this.cgmSystemicPeriod = (4 + this.rng() * 4) * 60;
        this.cgmSystemicAmplitude = (0.3 + this.rng() * 0.4);
        this.cgmNoiseScale = 0.025 + this.rng() * 0.015; // 2.5-4.0% of BG
        this.cgmDiscontinuityChance = 0.0025; // ~0.7 per day at 5-min intervals

        // CGM compression: temporarily falsely low CGM reading when the player e.g.
        // lies on the sensor arm at night. Used by B10 event "CGM alarm".
        this.cgmCompressionUntil = -Infinity;
        this.cgmCompressionStart = -Infinity;
        this.cgmCompressionDrop = 0;

        // CGM sensor faults: periods when the sensor is offline, warming up, or
        // performing a brief self-test. Physiology continues but no new CGM points
        // are produced while status is not active.
        this.cgmSensorOfflineUntil = -Infinity;
        this.cgmSensorOfflineStart = -Infinity;
        this.cgmSensorWarmupUntil = -Infinity;
        this.cgmSensorWarmupStart = -Infinity;
        this.cgmSelfTestUntil = -Infinity;
        this.cgmSelfTestStart = -Infinity;
        this.cgmAutoSelfTestCooldownUntil = -Infinity;
        this.cgmSensorStatus = 'active';      // 'active' | 'offline' | 'warmup' | 'checking'

        // --- Insulin/IOB state ---
        // The insulin calculations themselves still reside in Simulator in this slice;
        // the engine only owns the state fields, which the facade exposes via proxies.
        this.activeFastInsulin = [];           // active rapid-acting insulin doses
        this.activeLongInsulin = [];           // active long-acting basal doses
        this.iob = 0;                          // physiological rapid-IOB [units]
        this.displayIOB = 0;                   // UI-IOB scaled to injected dose
        this.lastInsulinTime = -Infinity;      // last insulin injection [sim-min]
        this.basalIOBbaseline = undefined;     // set after Hovorka steady state
        this.basalInsulinRate = undefined;     // updated in update() [mU/min]
        this.bioavScale = undefined;           // displayIOB scaling for UI/IAN band

        // Fixed session bioavailability (no dose-to-dose uncertainty).
        // Variation in absorption rate is still handled per injection via
        // tauFactor, while these values keep the dose response proportional.
        this.sessionBioavFast = 0.78;
        this.sessionBioavBasal = 0.82;

        // --- Ketone and acidosis state ---
        // Pure physiological accumulators. Warning flags, ketone test cooldown and
        // game-over decisions remain in the Simulator facade for now.
        this.acidosisLoad = 0.0;                // accumulated acid load [arbitrary unit]
        this.acidosisWarningGiven = false;      // internal 50%-guard in updateAcidosisLoad (S7.5b)
        this.ketoneLevel = 0.1;                 // BHB in blood [mmol/L]
        this.ffaLipolysis = 0.0;                // FFA from lipolysis [arbitrary unit]

        // --- Physiology constants: ketone/lipolysis/acidosis (S7.4a) ---
        // Moved from Simulator constructor to engine so the ketone/acidosis
        // methods that use them can be moved into the engine (S7.5). The Simulator
        // exposes them via getter proxy so `this.X` in the facade is unchanged and
        // bit-identical. Full calibration history + sources (Pinnaro 2021,
        // Ozoran 2023, Guerci, Laffel, Dhatariya 2020 et al.): docs/BG-SCIENCE.md
        // §23-25, docs/MODEL-IMPLEMENTATION.md Step 3 and git history for
        // js/simulator.js.
        this.ACIDOSIS_THRESHOLD = 600;          // Game over threshold (bicarbonate buffer capacity)
        this.ACIDOSIS_BHB_THRESHOLD = 3.0;      // BHB above this → acidosis accumulates [mmol/L]
        this.ACIDOSIS_RECOVERY_HALF = 45;       // Recovery t½ [sim-min] (bicarbonate regenerated by kidneys)
        this.ACIDOSIS_BASE_RATE = 0.3;          // Linear rate per mmol/L BHB excess per minute
        this.ACIDOSIS_ACCEL_RATE = 0.05;        // Quadratic acceleration (pH is logarithmic)
        this.LIPOLYSIS_MAX = 0.09;              // Max lipolysis rate [units/min] at zero insulin
        this.LIPOLYSIS_EC50 = 5;                // Half-maximal insulin suppression [mU/L]
        this.LIPOLYSIS_HILL_N = 3;              // Hill coefficient (gradual insulin transition)
        this.CPT1_EC50 = 7;                     // Insulin for half-maximal CPT-1 suppression [mU/L]
        this.CPT1_HILL_N = 2.5;                 // Moderate Hill — gradual transition
        this.CPT1_MAX_SUPP = 0.95;              // Max 95% suppression of ketogenesis at high insulin
        this.FFA_LIPO_CLEAR_HALF = 120;         // Effective ketogenesis ramp half-life [min]
        this.BHB_PROD_RATE = 0.0012;            // mmol/L per min per unit FFA × CPT-1 activity
        this.BHB_DIET_FAT_FRAC = 0.35;          // Weight of ffaBlood in ketogenesis formula (dietary fat)
        this.BHB_VMAX = 0.016;                  // Michaelis-Menten Vmax [mmol/L/min] — peak oxidation
        this.BHB_KM = 2.0;                      // Michaelis-Menten Km [mmol/L] — half-saturation
        this.BHB_RENAL_THR = 0.5;               // Renal ketone threshold [mmol/L] — ketonuria begins
        this.BHB_RENAL_VMAX = 0.005;            // Renal Michaelis-Menten Vmax [mmol/L/min]
        this.BHB_RENAL_KM = 2.0;                // Renal half-saturation constant [mmol/L]

        // --- Physiology constants: fat/protein/gastric/FFA resistance (S7.4b) ---
        // Mechanism descriptions (gastric CSTR, pizza-effect/FFA resistance, protein-
        // glucagon-HGP) still reside with the methods in js/simulator.js until they are
        // moved (S7.5). Sources: Wolpert 2013, Smart 2013, Paterson 2016,
        // Gannon & Nuttall, Lodefalk 2008 et al. — see docs/BG-SCIENCE.md.
        this.STOMACH_CAPACITY_PER_KG = 15;      // Gastric capacity [g per kg body weight] (~1050 g at 70 kg)
        this.STOMACH_HYSTERESIS = 0.67;         // Can eat again below 67% capacity (~700 g at 70 kg)
        this.TAU_FAT_ABS = 150;                 // Time constant for fat absorption in the intestine [min]
        this.FFA_CLEARANCE_HALF = 180;          // FFA clearance half-life [min] (muscle uptake + re-esterification)
        this.FFA_RESIST_MAX = 0.42;             // Max ISF reduction (42%, Wolpert 2013: 60 g fat)
        this.FFA_EC50 = 8;                      // FFA level at half-maximal resistance [g]
        this.FFA_HILL_N = 2;                    // Hill coefficient (sigmoid steepness)
        this.TAU_PROT_ABS = 90;                 // Time constant for protein absorption from intestine [min]
        this.AA_DECAY_RATE = Math.log(2) / 60;  // Amino acid clearance (half-life ~60 min)
        this.AA_EC50 = 8;                       // Half-maximal glucagon stimulation [g amino acids]
        this.AA_HILL_N = 2;                     // Hill coefficient (steepness of dose-response)
        this.PROTEIN_GLUCAGON_MAX = 0.25;       // Max glucagon contribution to stressMultiplier

        // --- Physiology constants: brain/glucotoxicity/HAAF/liver glycogen (S7.4c) ---
        // Mechanism descriptions still reside with the methods in js/simulator.js
        // until they are moved (S7.5). Sources: Cryer 2013 (HAAF), Rossetti 1990
        // (glucotoxicity) et al. — see docs/BG-SCIENCE.md.
        this.BRAIN_DEFICIT_THRESHOLD = 8.0;     // Game over threshold [mmol] ≈ 1.4 g
        this.BRAIN_CRISIS_BG = 2.5;             // BG below this → deficit accumulates [mmol/L]
        this.BRAIN_RECOVERY_HALF = 45;          // Recovery t½ at normal BG [sim-min]
        this.GLUCOTOX_BG_THRESHOLD = 10.0;      // BG above this → load accumulates [mmol/L]
        this.GLUCOTOX_RATE = 0.0004;            // Accumulation rate [units/min/(mmol/L)²]
        this.GLUCOTOX_RECOVERY_HALF = 24 * 60;  // Recovery t½ = 24 hours [sim-min]
        this.GLUCOTOX_MAX_RESIST = 0.40;        // Max ISF reduction (40%, poorly controlled T1D)
        this.GLUCOTOX_EC50 = 50;                // Half-maximal load for sigmoid saturation
        this.GLUCOTOX_HILL_N = 1.5;             // Sigmoid steepness (softer than Hill n=2)
        this.HAAF_DAMAGE_SCALE = 30;            // Scale for hypo damage [mmol·min/L]
        this.HAAF_RECOVERY_HALFLIFE = 3 * 24 * 60; // Recovery t½ [sim-min] (3 days)
        this.LIVER_GLYCOGEN_MAX = 120;          // Liver glycogen maximum capacity [g]
        this.GLYCOGEN_STRESS_THRESHOLD = 15;    // Below this grams, stress EGP is attenuated [g]

        // --- Weight and calorie state ---
        // The calorie accumulators are physiological state; the game-over threshold and
        // campaign activity goals remain in the Simulator facade.
        this.totalKcalConsumed = 0;
        this.totalKcalBurnedBase = 0;
        this.totalKcalBurnedMotion = 0;
        this.weightChangeKg = 0;

        // --- Food, gastric, and carbohydrate state ---
        // The absorption mathematics will be moved later; here the engine only owns the
        // physiological containers and queues.
        this.activeFood = [];
        this.activeIntake = [];
        this.stomachContentGrams = 0;
        this.stomachFull = false;
        this.stomachCarbsTotal = 0;
        this.stomachCarbsSimple = 0;
        this.stomachFiber = 0;
        this.stomachRetentionWeight = 0;
        this.cob = 0;

        // --- Fat/protein/FFA state ---
        // Compartments for the pizza effect, FFA resistance, and protein-glucagon.
        this.fatStomach = 0;
        this.fatIntestine = 0;
        this.ffaBlood = 0.0;
        this.ffaResistanceFactor = 1.0;
        this.proteinStomach = 0;
        this.proteinGut = 0;
        this.aminoAcidsBlood = 0;
        this.proteinGlucagonLevel = 0;

        // --- Exercise state ---
        this.activeMotion = [];                 // active/recent sessions with continuous sensitivity effects
        this.activeAktivitet = null;            // active activity; null = none
        this.exerciseCooldownUntil = 0;         // sim time when cooldown expires
        this.smoothHeartRate = 60;              // smoothed heart rate [bpm]
        this.totalExerciseMinutes = 0;          // sum of sim minutes with activeAktivitet (campaign goal, S8-C1)

        // --- Muscle glycogen state ---
        this.muscleGlycogenCapacity = this.weight * MUSCLE_GLYCOGEN_G_PER_KG;
        this.muscleGlycogenGrams = this.muscleGlycogenCapacity;
        this.muscleGlycogenReserve = 1.0;
        this.lastMuscleContractionEndTime = null;
        this._muscleGlycogenResynthRate = 0;
        this._muscleGlycogenConsumptionRate = 0;

        // --- Estimated liver-glycogen capacity state ---
        this.liverGlycogenGrams = 90;
        this.glycogenReserve = 1.0;

        // --- Stress, insulin resistance, glucotoxicity, and HAAF state ---
        this.glucotoxicLoad = 0.0;
        this.glucotoxicResistanceFactor = 1.0;
        this.insulinResistanceFactor = 1.0;
        this.acuteStressLevel = 0.0;
        // Katekolamin-medieret leverrespons fra aktiv motion. Den holdes adskilt
        // fra acuteStressLevel, så en stærk træningsrespons ikke samtidig gør
        // kroppens begrænsede modregulation ved hypoglykæmi stærkere.
        this.exerciseHepaticDrive = 0.0;
        this.chronicStressLevel = 0.0;
        this._pendingChronicStress = 0.0;
        this.hypoArea = 0.0;
        this.counterRegFactor = 1.0;

        // --- Sleep disruption state ---
        // Nocturnal interventions accumulate sleep loss, which in the morning
        // is converted to chronic stress and can amplify the dawn effect. The engine
        // owns the full sleep-disruption mechanism (S9.8): the per-intervention
        // accrual (registerNightIntervention), the morning conversion to chronic
        // stress (applySleepDebt) and the night/morning clock crossings driven from
        // step() (_processSleepCrossings). It emits the structured sleep events
        // (sleep-started/sleep-disruption/sleep-pop/morning-alarm/good-sleep/
        // sleep-debt); the facade reacts to those for sound + graph UI. Previously
        // all of this lived in the Simulator facade.
        this.lostSleepHoursTonight = 0;
        this.lastNightAwakeningTime = -Infinity;
        // Én fælles motor-ejet vågentilstand. `nightAwakeUntil` bruges til
        // tidsafgrænsede opvågninger, mens `sleepAwakeOpen` er sand under en
        // fysisk aktivitet, hvor sluttidspunktet endnu ikke kendes. Historikken
        // er den samme kilde, som desktop og mobil bruger til nattens lyse felter.
        this.nightAwakeUntil = -Infinity;
        this.sleepAwakeOpen = false;
        this.sleepAwakeIntervals = [];
        this._activeExerciseAwakeInterval = null;
        this._sleepWasAwake = false;
        this.sleepDebtAppliedForDay = -1;
        this._sleepStartedForDay = -1;     // guards the 22:00 night-start crossing (once/day)
        this._morningProcessedForDay = -1; // guards the 07:00 morning crossing (once/day)

        // --- Dawn state ---
        // Physiological circadian variation (morning cortisol peak). The engine
        // is self-contained: it seeds day-1 dawn parameters here via
        // regenerateDawn() so a bare engine (no Simulator facade) has valid dawn
        // amplitude/peak from the first step. Previously these draws lived in the
        // Simulator constructor purely to preserve RNG ordering; that left a bare
        // engine with undefined dawn until the first day rollover. Moving them
        // here deliberately changes the RNG draw order vs. the old game build
        // (see physiology-engine-LOG.md, S9.6) — gated on clinical equivalence,
        // not bit-identity.
        // _campaignDisableDawn is now an alias over modules.dawn (S9.10) — see getter below.
        this.regenerateDawn();              // seed day-1 _dawnAmplitude/_dawnPeakMinutes + _dawnDay (2 gaussRand draws)

        // --- Derived physiology/debug values ---
        // Set continuously by existing Simulator mathematics and displayed in
        // snapshots/dashboard. Initialised as undefined to preserve the same
        // fallback behaviour (`|| 1` / `|| 0`) before the first computation.
        this.hovorkaSteadyStateBasalRate = undefined;
        this._lastPeisFactor = undefined;
        this._lastHyperMod = undefined;
        this._lastExerciseGEMod = undefined;
        this._lastSplanchnicAbsorbMod = undefined;
        this._lastLipolyseRate = undefined;
        this._lastCpt1Activity = undefined;

        // --- Brain energy deficit state ---
        this.brainEnergyDeficit = 0.0;
        this._lowestBGDuringDeficit = Infinity;
        this.brainDeficitWarningGiven = false;  // internal 50%-guard in updateBrainEnergyDeficit (S7.5b)

        // --- Glucagon state ---
        // The 24 h cooldown itself remains in the Simulator facade because it is
        // game mechanics. The active injection is physiological state.
        this.activeGlucagon = null;
    }

    // gaussRand — Normally distributed variable (Box-Muller) drawn from this.rng().
    // Used for physiological variation: CGM noise, dawn amplitude, sleep stress,
    // absorption rate etc. Two uniform samples -> one normally distributed sample.
    gaussRand(mean, std) {
        const u1 = this.rng() || 1e-10, u2 = this.rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * std;
    }

    // setNoise — Enable/disable CGM sensor noise (lab API, S5).
    // false gives a clean, smooth signal (no proportional noise, drift, or
    // discontinuities) for laboratory plots; default is true. Does NOT affect
    // seed/rng — only WHETHER noise is applied. Returns this for chaining.
    setNoise(enabled) {
        this.noiseEnabled = !!enabled;
        return this;
    }

    // moduleScale — intensity [0,1] for a scalar physiology module (S9.12). Booleans
    // coerce (true→1, false→0) so a boolean override or a boolean-valued module reads
    // cleanly. Returns the stored number otherwise. Used at every site where a scalar
    // module's effect is applied: `effect * moduleScale(key)` (a no-op at the default 1)
    // or the lerp `1 + (factor - 1) * moduleScale(key)` for resistance factors.
    moduleScale(key) {
        const v = this.modules[key];
        if (v === true) return 1;
        if (v === false) return 0;
        return v;
    }

    // _campaignDisableDawn — back-compat alias over modules.dawn (S9.10). The dawn
    // disable used to be a standalone campaign flag; it is now one of the toggleable
    // modules. The getter/setter keep the old name working for the circadian getters
    // and the Simulator facade's campaign wiring without a separate field. With dawn now
    // a 0..1 scalar (S9.12), "disabled" means scale 0 and the setter stores 0/1.
    get _campaignDisableDawn() { return !this.modules.dawn; }
    set _campaignDisableDawn(v) { this.modules.dawn = v ? 0 : 1; }

    // attachHovorka — Override the engine's own Hovorka instance (S9.1). The engine builds
    // its own Hovorka in the constructor from the profile, so this method is normally
    // not needed. It is retained for advanced use (e.g. tests that want to inject a
    // pre-configured model). Returns this for chaining.
    attachHovorka(hovorka) {
        this.hovorka = hovorka;
        return this;
    }

    // initSteadyState — Bring engine to physiological steady state (S9.1).
    //
    // Makes the engine SELF-SUSTAINING: after this call the model holds ~targetBG
    // while fasting, has correct basal plasma insulin, and does NOT drift when stepped.
    // Without this a bare engine would start with an empty insulin depot -> basal rate 0
    // -> BG climbs.
    //
    // Steps:
    //   1. Find the basal rate that yields targetBG (Hovorka binary search, RNG-neutral).
    //   2. (establishDepot) Establish a basal insulin depot sized so _prepInsulinRates
    //      reproduces exactly that rate, pre-aged so it is already on the plateau.
    //   3. Store hovorkaSteadyStateBasalRate + basalIOBbaseline, sync trueBG/cgmBG.
    //
    // @param {object} opts
    //   targetBG        desired steady-state BG [mmol/L] (default 5.5)
    //   establishDepot  if true: create basal depot so engine maintains the level itself
    //                   (default true — standalone use). The game facade sets it
    //                   FALSE and makes its own game-specific basal pre-injection
    //                   (16 h age, circadian-adjusted dose) afterwards, so the facade
    //                   remains bit-identical (no extra gaussRand here).
    //   preInjectAgeHours  depot age at establishDepot (default 3 h — just inside
    //                   the trapezoid plateau, so the depot lasts as long as possible before
    //                   tail-off. A basal depot always decays eventually; very long
    //                   standalone runs must re-dose basal just as in real life.)
    // @returns {number} steady-state trueBG [mmol/L]
    initSteadyState(opts = {}) {
        const targetBG = (opts.targetBG != null) ? opts.targetBG : 5.5;
        const establishDepot = opts.establishDepot !== false;
        const preInjectAgeHours = (opts.preInjectAgeHours != null) ? opts.preInjectAgeHours : 3;

        // 1. Find basal rate that yields targetBG. The guess is irrelevant for the result
        //    (binary search overwrites it immediately), but we use basalDose->rate
        //    as a reasonable starting point for readability.
        const basalRateGuess = this.hovorka.basalToRate(this.basalDose);
        this.hovorka.initializeSteadyState(basalRateGuess, targetBG);
        this.hovorkaSteadyStateBasalRate = this.hovorka.steadyStateBasalRate;

        // Basaldosis-kontrakten skelner mellem to størrelser:
        //   1. effektivt behov: inputtet som Hovorka-modellen skal modtage pr. døgn;
        //   2. injektionsbehov: den subkutane dosis før den faste biotilgængelighed.
        // basalDose er den afrundede spil-dosis. Uden divisionen med 0,82 ville en
        // spillerinjektion systematisk levere 18 % mindre end steady-state-behovet.
        this.effectiveBasalRequirement = this.hovorkaSteadyStateBasalRate * 1440 / 1000;
        this.basalInjectionRequirement = this.effectiveBasalRequirement / this.sessionBioavBasal;
        this.basalDose = Math.max(1, Math.round(this.basalInjectionRequirement));

        // 2. Establish basal depot (standalone only). Dose is calibrated so the trapezoid
        //    profile's plateau rate matches the steady-state rate at current circadian ISF.
        if (establishDepot) {
            const injectionTime = this.totalSimMinutes - preInjectAgeHours * 60;
            this.addBasalInsulin({ units: this.basalDose, injectionTime, silent: true });
            const depot = this.activeLongInsulin[this.activeLongInsulin.length - 1];
            const ba = depot.bioavailability || 1.0;
            const rampUp = 2 * 60, tailOff = 6 * 60;  // same as trapezoid profile in _prepInsulinRates
            const effectiveArea = depot.totalDuration - rampUp / 2 - tailOff / 2;
            depot.dose = this.hovorkaSteadyStateBasalRate * effectiveArea / (1000 * ba * this.circadianISF);
            this.lastInsulinTime = injectionTime;
        }

        // 3. Store basal steady-state IOB baseline (S1+S2+I×V_I at equilibrium) and sync BG.
        this.basalIOBbaseline = (this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] + this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2]
            + this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] * this.hovorka.V_I) / 1000;
        this.trueBG = this.hovorka.glucoseConcentration;
        this.cgmBG = this.trueBG;

        return this.trueBG;
    }

    // reset — Reset engine to a fresh start with the same profile (S9.2).
    // Convenient for labs/tools that run many scenarios in a row without needing to
    // build a new engine each time. The result is equivalent to createEngine(profile,
    // {seed, steadyState}): all dynamic state (food, insulin, exercise, ketones, clock,
    // event buffer, Hovorka) is reset to constructor defaults.
    //
    // @param {object} opts
    //   seed         new RNG seed (default: same seed as now — reproducible restart)
    //   steadyState  if true: bring immediately to equilibrium with basal depot (default false,
    //                like createEngine — call initSteadyState() yourself otherwise).
    // @returns {this}
    reset(opts = {}) {
        const newSeed = (opts.seed != null) ? (opts.seed >>> 0) : this._seed;
        const wantSteadyState = opts.steadyState === true;

        // Build a fresh engine with the same profile to get clean default values, and
        // copy them over. The rng FUNCTION is preserved (the Simulator facade holds a
        // reference to it) — we only set its state to the fresh engine's,
        // so the rng position matches a new createEngine (after the constructor's CGM draws).
        // scenarioRunner is preserved (it is wiring, not state).
        const fresh = new PhysiologyEngine(this.profile, {
            seed: newSeed, noiseEnabled: this.noiseEnabled, clinicalEvents: this.clinicalEvents,
            modules: this.modules // S9.10: preserve module toggles across reset()
        });
        for (const key of Object.keys(fresh)) {
            if (key === 'rng' || key === 'scenarioRunner') continue;
            this[key] = fresh[key];
        }
        this.rng._setState(fresh.rng._state);
        this._seed = newSeed;

        // Forward steady-state options (e.g. preInjectAgeHours) to the universal
        // starter, so callers can match the game's start-basal age via reset().
        if (wantSteadyState) this.initSteadyState(opts);
        return this;
    }

    // attachScenarioRunner — Register a runner for runScenario(). The runner must
    // provide step(minutes), applyEvent(event), and getSample(). The game facade uses
    // its own runner (campaign/log/audio); standalone use can call attachDefaultRunner().
    // The runner is not engine-owned state and is therefore not exported.
    attachScenarioRunner(runner) {
        this.scenarioRunner = runner;
        return this;
    }

    // attachDefaultRunner — Opt-in standalone scenario runner (S8-C4). Wires
    // runScenario to engine-native step + interventions + getState, so the engine can
    // run lab scenarios WITHOUT the game facade. step() drains the engine event buffer
    // (no UI to translate to). startActivity events require event.typeDef, because
    // the engine does not know the activity catalogue (AKTIVITETSTYPER lives in the game).
    // Requires an attached Hovorka model. Returns this for chaining.
    attachDefaultRunner() {
        if (!this.hovorka) {
            throw new Error('PhysiologyEngine.attachDefaultRunner kræver en tilknyttet Hovorka-model (attachHovorka)');
        }
        this.scenarioRunner = {
            step: minutes => { this.step(minutes); this.consumeEvents(); },
            applyEvent: event => this._applyScenarioEvent(event),
            getSample: () => ({
                time: this.totalSimMinutes,
                ...this.getState(),
                plasmaInsulin: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I],
                plasmaInsulinClamp: this.plasmaInsulinClamp
            })
        };
        return this;
    }

    // _applyScenarioEvent — Engine-native dispatch of a runScenario event (S8-C4).
    // Maps event types to pure engine interventions (no campaign/night/log —
    // those are the game facade's responsibility). Lab controls (setBG/setNoise/clamp)
    // and interventions (food/insulin/glucagon/activity) are supported. Used by
    // attachDefaultRunner; the game facade has its own dispatch to facade methods.
    _applyScenarioEvent(event) {
        if (!event || !event.type) {
            throw new Error('runScenario event mangler type');
        }
        switch (event.type) {
            case 'setBG':
                return this.setBG(event.value ?? event.bg ?? event.mmolL);
            case 'setNoise':
                return this.setNoise(event.enabled);
            case 'setPlasmaInsulinClamp':
                return this.setPlasmaInsulinClamp(event.value ?? event.valueOrNull);
            case 'food':
            case 'addFood':
                return this.addFood({
                    carbs: event.carbs || 0, protein: event.protein || 0, fat: event.fat || 0,
                    weight: event.weight || 0, eatTimeMin: event.eatTimeMin,
                    carbParams: event.carbParams, icon: event.icon
                });
            case 'rapidInsulin':
            case 'fastInsulin':
            case 'bolus':
                return this.addRapidInsulin({ units: event.units ?? event.dose });
            case 'basalInsulin':
            case 'longInsulin':
                return this.addBasalInsulin({
                    units: event.units ?? event.dose,
                    injectionTime: event.injectionTime ?? this.totalSimMinutes,
                    silent: !!event.silent
                });
            case 'activity':
            case 'startActivity': {
                const activityType = event.activityType || event.exerciseType;
                // Requires either an explicit typeDef OR a type present in
                // the default catalogue (S9.2) — otherwise throw, so lab errors are not silent.
                if (!event.typeDef && !ENGINE_DEFAULT_ACTIVITIES[activityType]) {
                    throw new Error('runScenario startActivity kræver event.typeDef eller en type i default-kataloget (cardio/styrke/blandet/afslapning)');
                }
                return this.startActivity({
                    type: activityType,
                    intensity: event.intensity || event.intensitet || 'Medium',
                    durationMin: event.durationMin ?? event.duration ?? null,
                    typeDef: event.typeDef   // omitted -> startActivity looks up in the catalogue
                });
            }
            case 'stopActivity':
                return this.stopActivity();
            case 'glucagon':
                return this.useGlucagon();
            default:
                throw new Error(`Ukendt runScenario event-type: ${event.type}`);
        }
    }

    // step — Execute the FULL physiology tick for a number of sim-minutes (S8-C3).
    // The engine now owns the physics standalone (no facade stepper needed):
    //   1. time bookkeeping (clock + resting-kcal)
    //   2. insulin rate prep (_prepInsulinRates)
    //   3. carbohydrate / heart-rate / exercise prep + auto-stop (_prepStepInputs)
    //   4. substep integration loop dt <= 1 min (_runSubstepLoop)
    //   5. post-loop IOB recompute (_recomputePostStepIOB)
    //   6. CGM sampling gate every 5 sim-min (_sampleCgm)
    // Ordering invariants preserved 1:1 from the old facade stepper.
    // options.onSample(sample) receives per-minute graph samples from the substep loop
    // (the facade/UI owns the graph history). Returns { state, events } so external
    // callers can read core state + the structured events from this tick. Game
    // post-processing (steep-drop, graph message cleanup, sleep/morning, score/weight/
    // game-over, Box Challenge) lives in the facade's _postStep() after this call.
    //
    // Robustness for large steps (S9.9): step() subdivides into chunks of at most
    // STEP_MAX_CHUNK_MIN (1 min) and calls _stepChunk() per chunk, so clock crossings
    // (sleep 22:00/07:00, CGM-5-min gate) and input prep are never skipped regardless
    // of simMinutes. step(<=1) is exactly one chunk = unchanged behaviour, and the
    // test/golden-master paths drive the engine with 1-min steps, so they are bit-identical.
    // simMinutes <= 0 is a no-op (frames can yield ~0 dt); non-numbers throw.
    step(simMinutes, options = {}) {
        requireNumber(simMinutes, 'simMinutes', { min: 0 });
        if (simMinutes === 0) {
            return { state: this.getState(), events: this.peekEvents() };
        }
        const STEP_MAX_CHUNK_MIN = 1.0;
        let remaining = simMinutes;
        while (remaining > 1e-9) {
            const dt = Math.min(remaining, STEP_MAX_CHUNK_MIN);
            this._stepChunk(dt, options);
            remaining -= dt;
        }
        return { state: this.getState(), events: this.peekEvents() };
    }

    // _stepChunk — one physiology tick of <= 1 min (the core of step(), formerly step()'s
    // body). Ordering invariants preserved 1:1 from the old facade stepper.
    _stepChunk(simMinutes, options = {}) {
        // 1. Time bookkeeping: advance the clock + resting-kcal BEFORE physics (unchanged order).
        const stepStartMinutes = this.totalSimMinutes;
        this.totalSimMinutes += simMinutes;
        this.timeInMinutes = this.totalSimMinutes % (24 * 60); // wrap at midnight
        this.day = Math.floor(this.totalSimMinutes / (24 * 60)) + 1;
        this.totalKcalBurnedBase += this.restingKcalPerMinute * simMinutes;

        // 2-6. Physics tick (engine-internal).
        const onSample = options.onSample || function () {};
        this._prepInsulinRates();
        const {
            exerciseHepaticDriveRate,
            exerciseHepaticDriveCeiling,
            exerciseStressRedRate,
            autoStopAfterStep
        } = this._prepStepInputs(simMinutes);
        this._runSubstepLoop(
            simMinutes,
            exerciseHepaticDriveRate,
            exerciseHepaticDriveCeiling,
            exerciseStressRedRate,
            onSample
        );
        // Auto-stop occurs AFTER the final exercise substep. This makes a requested
        // 60-minute bout contain 60 physiological exercise minutes, while stopActivity()
        // still records the exact end time and only removes the future stimulus.
        if (autoStopAfterStep) this.stopActivity();
        // Registrér kun det faktiske overlap mellem vågenperioden og 22:00-07:00.
        // Dette sker før 07:00-krydsningen omsætter nattens akkumulerede tab til stress.
        this._accrueAwakeSleepLoss(stepStartMinutes, this.totalSimMinutes);
        this._recomputePostStepIOB();
        this._updateWeightChange();
        this._sampleCgm();
        this._processSleepCrossings();
        this._emitClinicalEvents();
        this._assertFiniteCoreState();
    }

    // _assertFiniteCoreState — fail fast if a malformed external input or future
    // numerical regression contaminates the ODE core. JavaScript comparisons do not
    // clamp NaN (NaN < 0 is false), so checking after every public step chunk prevents
    // one bad value from silently spreading through a long editor/lab simulation.
    _assertFiniteCoreState() {
        for (const [stateName, stateIndex] of Object.entries(ENGINE_HOVORKA_STATE_IDX)) {
            const value = this.hovorka.state[stateIndex];
            if (!Number.isFinite(value)) {
                throw new Error(
                    `PhysiologyEngine: ikke-endelig Hovorka-state '${stateName}' efter step (${value})`);
            }
        }
        if (!Number.isFinite(this.hovorka.tau_G) || this.hovorka.tau_G <= 0) {
            throw new Error(
                `PhysiologyEngine: ugyldig tau_G efter step (${this.hovorka.tau_G})`);
        }
        if (!Number.isFinite(this.trueBG)) {
            throw new Error(`PhysiologyEngine: ikke-endelig trueBG efter step (${this.trueBG})`);
        }
    }

    // _updateWeightChange — Derive cumulative body-weight change from the net caloric
    // balance. Engine-owned so EVERY consumer (game, scenario editor, standalone API)
    // gets a maintained weightChangeKg without re-deriving it. Runs after the substep
    // loop so this chunk's food/exercise kcal are already accumulated.
    //
    //   net_kcal        = consumed - resting_burn - exercise_burn
    //   weightChangeKg  = net_kcal / 7700   (≈ kcal per kg body tissue)
    //
    // The game-over threshold (weightLimitKg) stays in the consuming app — it is a
    // game-mechanic limit, not physiology.
    _updateWeightChange() {
        const netKcal = this.totalKcalConsumed
            - (this.totalKcalBurnedBase + this.totalKcalBurnedMotion);
        this.weightChangeKg = netKcal / ENGINE_KCAL_PER_KG_WEIGHT;
    }

    // _emitClinicalEvents — Edge-triggered clinical events (S9.3, opt-in).
    // No-op unless clinicalEvents is enabled. Compares the current clinical zone
    // against the last reported (_clinicalZones) and emits only on transitions, so
    // a standalone consumer is notified when something clinical happens without polling.
    // Draws NO RNG and changes no physiology -> does not affect the BG trajectory.
    // Thresholds reuse engine constants (no new magic numbers).
    _emitClinicalEvents() {
        if (!this.clinicalEvents) return;
        const z = this._clinicalZones;

        // --- Glucose ---
        const bg = this.trueBG;
        let gZone;
        if (bg < this.BRAIN_CRISIS_BG) gZone = 'severe-low';      // < 2.5
        else if (bg < 3.0) gZone = 'low';
        else if (bg < 3.9) gZone = 'slightly-low';
        else if (bg <= 10) gZone = 'in-range';
        else if (bg < 13.9) gZone = 'slightly-high';              // < 250 mg/dL
        else if (bg < 20) gZone = 'high';
        else gZone = 'very-high';
        if (gZone !== z.glucose) {
            if (gZone === 'in-range') {
                this.emitEvent('glucose-in-range', { trueBG: bg }, 'info');
            } else if (gZone.endsWith('low')) {
                const sev = gZone === 'severe-low' ? 'severe' : (gZone === 'low' ? 'significant' : 'mild');
                this.emitEvent('glucose-low', { trueBG: bg }, sev);
            } else {
                const sev = gZone === 'very-high' ? 'severe' : (gZone === 'high' ? 'high' : 'mild');
                this.emitEvent('glucose-high', { trueBG: bg }, sev);
            }
            z.glucose = gZone;
        }

        // --- Ketones (BHB) ---
        const k = this.ketoneLevel;
        let kZone;
        if (k < 0.6) kZone = 'normal';
        else if (k < 1.5) kZone = 'elevated';
        else if (k < 3.0) kZone = 'high';
        else kZone = 'very-high';
        if (kZone !== z.ketones) {
            if (kZone === 'normal') {
                this.emitEvent('ketones-normal', { ketoneLevel: k }, 'info');
            } else {
                const sev = kZone === 'very-high' ? 'severe' : (kZone === 'high' ? 'high' : 'mild');
                this.emitEvent('ketones-elevated', { ketoneLevel: k }, sev);
            }
            z.ketones = kZone;
        }

        // --- Acidosis (fraction of bicarbonate buffer capacity) ---
        const aFrac = this.acidosisLoad / this.ACIDOSIS_THRESHOLD;
        let aZone;
        if (aFrac < 0.25) aZone = 'none';
        else if (aFrac < 0.60) aZone = 'warning';
        else aZone = 'critical';
        if (aZone !== z.acidosis) {
            if (aZone === 'none') this.emitEvent('acidosis-cleared', { acidosisLoad: this.acidosisLoad }, 'info');
            else this.emitEvent('acidosis-risk', { acidosisLoad: this.acidosisLoad, fraction: aFrac },
                aZone === 'critical' ? 'severe' : 'warning');
            z.acidosis = aZone;
        }

        // --- Brain energy deficit (fraction of game-over threshold) ---
        const bFrac = this.brainEnergyDeficit / this.BRAIN_DEFICIT_THRESHOLD;
        let brZone;
        if (bFrac < 0.25) brZone = 'none';
        else if (bFrac < 0.60) brZone = 'warning';
        else brZone = 'critical';
        if (brZone !== z.brain) {
            if (brZone === 'none') this.emitEvent('brain-energy-recovered', { brainEnergyDeficit: this.brainEnergyDeficit }, 'info');
            else this.emitEvent('brain-energy-low', { brainEnergyDeficit: this.brainEnergyDeficit, fraction: bFrac },
                brZone === 'critical' ? 'severe' : 'warning');
            z.brain = brZone;
        }
    }

    // --- Sleep disruption (S9.8) ---
    // Night-time interventions (22:00-07:00) cost sleep; the accrued loss is
    // converted to chronic stress the next morning, raising insulin resistance and
    // amplifying the dawn effect (Donga 2010, Zheng 2017). The engine owns the whole
    // mechanism so a bare engine models it without the facade; it emits the structured
    // events (sleep-disruption/sleep-pop/sleep-started/morning-alarm/good-sleep/
    // sleep-debt) and the facade renders sound + graph UI from them.

    // _isNightMinute — sand når et absolut simuleringstidspunkt ligger i
    // nattens søvnvindue 22:00-07:00.
    _isNightMinute(absoluteMinute) {
        const clockMinute = ((absoluteMinute % 1440) + 1440) % 1440;
        return clockMinute >= 22 * 60 || clockMinute < 7 * 60;
    }

    // isNightAwake — fælles definition, som både fysiologi og UI bruger.
    // Metoden er kun sand i søvnvinduet; aktivitet om dagen er derfor ikke en
    // "natlig opvågning" selv om et fysisk pas stadig er aktivt.
    isNightAwake(absoluteMinute = this.totalSimMinutes) {
        if (!this._isNightMinute(absoluteMinute)) return false;
        if (this.sleepAwakeOpen) return true;
        return Number.isFinite(this.nightAwakeUntil)
            && absoluteMinute < this.nightAwakeUntil;
    }

    // _mergeSleepAwakeInterval — sammenlæg overlappende vågenperioder, så samme
    // minut aldrig tælles dobbelt. `endMin=null` markerer et åbent motionspas.
    _mergeSleepAwakeInterval(startMin, endMin = null) {
        const last = this.sleepAwakeIntervals[this.sleepAwakeIntervals.length - 1];
        const lastEnd = last && last.endMin == null ? Infinity : last?.endMin;
        if (last && startMin <= lastEnd) {
            if (endMin == null && last.endMin != null) {
                last._endBeforeOpen = last.endMin;
                last.endMin = null;
            } else if (last.endMin == null || endMin == null) last.endMin = null;
            else last.endMin = Math.max(last.endMin, endMin);
            return last;
        }
        const interval = { startMin, endMin };
        this.sleepAwakeIntervals.push(interval);
        // UI viser højst tre døgn; begræns historikken uden at påvirke fysiologien.
        if (this.sleepAwakeIntervals.length > 64) this.sleepAwakeIntervals.shift();
        return interval;
    }

    // _nightMinutesInInterval — præcis overlap med alle 22:00-07:00-vinduer.
    _nightMinutesInInterval(startMin, endMin) {
        let total = 0;
        const firstDay = Math.floor(startMin / 1440) - 1;
        const lastDay = Math.floor(endMin / 1440) + 1;
        for (let dayIndex = firstDay; dayIndex <= lastDay; dayIndex++) {
            const dayStart = dayIndex * 1440;
            const windows = [
                [dayStart, dayStart + 7 * 60],
                [dayStart + 22 * 60, dayStart + 24 * 60]
            ];
            for (const [nightStart, nightEnd] of windows) {
                total += Math.max(0,
                    Math.min(endMin, nightEnd) - Math.max(startMin, nightStart));
            }
        }
        return total;
    }

    // _accrueAwakeSleepLoss — optjen søvntab fra faktisk vågen tid. Historikken
    // er allerede sammenlagt, så overlap mellem motion og andre handlinger tælles én gang.
    _accrueAwakeSleepLoss(stepStartMin, stepEndMin) {
        let awakeNightMinutes = 0;
        for (const interval of this.sleepAwakeIntervals) {
            const intervalEnd = interval.endMin == null ? stepEndMin : interval.endMin;
            const overlapStart = Math.max(stepStartMin, interval.startMin);
            const overlapEnd = Math.min(stepEndMin, intervalEnd);
            if (overlapEnd > overlapStart) {
                awakeNightMinutes += this._nightMinutesInInterval(overlapStart, overlapEnd);
            }
        }
        this.lostSleepHoursTonight += awakeNightMinutes / 60;
    }

    // registerNightIntervention — record that the character acted during the night.
    // Called by the engine's own interventions (food/insulin/activity/glucagon); the
    // facade also calls it for game-only actions without an engine intervention
    // (fingerstick, ketone test) and for campaign-scripted awakenings. Each new
    // awakening (>30 min since the last) draws a sleep-loss sample and accrues it.
    // Emits 'sleep-pop' on every night action; 'sleep-disruption' only on a new
    // awakening. RNG: one gaussRand per new awakening — kept at the same call position
    // as the old facade trigger so the rng stream is unchanged.
    registerNightIntervention() {
        const sleepScale = this.moduleScale('sleepDisruption');
        if (sleepScale <= 0) return; // S9.10/S9.12: scale 0 -> no sleep penalty (morning always reports good sleep)
        const currentHour = Math.floor(this.timeInMinutes / 60);
        if (currentHour < 22 && currentHour >= 7) return; // only night hours 22:00-07:00
        const wasAlreadyAwake = this.isNightAwake();
        const timeSinceLastAwakening = this.totalSimMinutes - this.lastNightAwakeningTime;
        if (!wasAlreadyAwake && timeSinceLastAwakening > 30) {
            // New awakening: cost sleep (variance 0.3-1.8 h, mean 1.0). Sleep loss
            // accrues without ceiling; the ceiling sits on the morning stress effect.
            // Deterministic tools (noiseEnabled:false, e.g. the Scenarie editor) use the
            // FIXED mean sleep loss with NO gaussRand call, so a drag never re-rolls it and
            // the rng stream stays stable. The live game (noiseEnabled:true) draws the
            // random per-awakening loss exactly as before.
            const baseLoss = (this.noiseEnabled ? Math.max(0.3, Math.min(1.8, this.gaussRand(1.0, 0.3))) : 1.0) * sleepScale;
            // Taper near the morning: an awakening cannot cost more sleep than remains
            // until wake (07:00), so the cost glides to ~0 as the event approaches the
            // alarm instead of stepping a full hour off a 1-minute shift across 07:00.
            // (gaussRand is still drawn ABOVE in the same position, so the rng stream is
            // unchanged; only the resulting value is capped.)
            const minsUntilWake = this.timeInMinutes < 7 * 60
                ? (7 * 60 - this.timeInMinutes)              // 00:00-07:00 → wake same day
                : ((24 * 60 - this.timeInMinutes) + 7 * 60); // 22:00-24:00 → wake next day
            const sleepLoss = Math.min(baseLoss, minsUntilWake / 60);
            const awakeEnd = this.totalSimMinutes + sleepLoss * 60;
            this.nightAwakeUntil = Math.max(this.nightAwakeUntil, awakeEnd);
            this._mergeSleepAwakeInterval(this.totalSimMinutes, awakeEnd);
            this.emitEvent('sleep-disruption', {
                hours: this.lostSleepHoursTonight + sleepLoss,
                sleepLoss
            });
        } else if (wasAlreadyAwake && !this.sleepAwakeOpen) {
            // En ny handling mens karakteren allerede er vågen holder lyset tændt
            // mindst 30 minutter fra nu, men udløser ikke en ny stokastisk opvågning.
            const awakeEnd = Math.max(this.nightAwakeUntil, this.totalSimMinutes + 30);
            this.nightAwakeUntil = awakeEnd;
            this._mergeSleepAwakeInterval(this.totalSimMinutes, awakeEnd);
        }
        this.lastNightAwakeningTime = this.totalSimMinutes;
        this.emitEvent('sleep-pop');
    }

    // applySleepDebt — convert accrued night sleep loss to pending chronic stress
    // (drained gradually by updateStressHormones, τ≈30 min). 0.06 chronic stress per
    // lost hour, capped at 0.30 from sleep alone; insulin-resistance factor is later
    // 1 + chronicStressLevel*0.5. Once per day (sleepDebtAppliedForDay guard).
    applySleepDebt() {
        if (this.lostSleepHoursTonight > 0 && this.sleepDebtAppliedForDay !== this.day) {
            const MAX_SLEEP_STRESS = 0.30;
            const stressBoost = Math.min(MAX_SLEEP_STRESS, this.lostSleepHoursTonight * 0.06);
            this._pendingChronicStress += stressBoost;
            this.emitEvent('sleep-debt', { hours: this.lostSleepHoursTonight });
            this.sleepDebtAppliedForDay = this.day;
            this.lostSleepHoursTonight = 0;
            this.lastNightAwakeningTime = -Infinity;
        }
    }

    // _processSleepCrossings — clock-driven sleep transitions, called from step().
    // 22:00 → night starts. Hvis karakteren er vågen, udsættes sleep-started til
    // den fælles vågentilstand slutter. 07:00 → morning: convert sleep debt to chronic
    // stress (bad night) or report a good night. Each fires once per day. Draws no
    // RNG and runs after the physics tick (mirrors the old facade _postStep position),
    // so the pending-stress drain timing matches the previous game behavior.
    _processSleepCrossings() {
        const currentHour = Math.floor(this.timeInMinutes / 60);
        const awakeNow = this.isNightAwake();
        if (currentHour === 22 && this._sleepStartedForDay !== this.day) {
            this._sleepStartedForDay = this.day;
            this.lostSleepHoursTonight = 0;
            if (!awakeNow) this.emitEvent('sleep-started');
        } else if (this._isNightMinute(this.totalSimMinutes)
            && this._sleepWasAwake && !awakeNow) {
            this.emitEvent('sleep-started');
        }
        if (currentHour >= 7 && currentHour < 8 && this._morningProcessedForDay !== this.day) {
            this._morningProcessedForDay = this.day;
            this.emitEvent('morning-alarm');
            if (this.lostSleepHoursTonight > 0) {
                this.applySleepDebt(); // emits 'sleep-debt'
            } else {
                this.emitEvent('good-sleep');
            }
        }
        this._sleepWasAwake = awakeNow;
    }

    // _runSubstepLoop — substep loop (dt <= 1 min) (S7.6c). The engine now owns the full
    // substep integration. Ordering invariants preserved 1:1: fat/protein BEFORE
    // hovorka.step(), ketones AFTER, stress/muscle/glucagon per substep, trueBG last.
    // Motionens leverrespons og stressreduktion kommer fra input-forberedelsen.
    // Graph sampling via onSample callback
    // (physiologyDataPoints is graph/UI state, facade-owned, S4).
    _runSubstepLoop(
        simulatedMinutesPassed,
        exerciseHepaticDriveRate,
        exerciseHepaticDriveCeiling,
        exerciseStressRedRate,
        onSample
    ) {
        const maxStepSize = 1.0; // max 1 sim-minute per Euler step
        let remaining = simulatedMinutesPassed;
        while (remaining > 0) {
            const stepDt = Math.min(remaining, maxStepSize);

            // --- Stress hormones, counter-regulation, and stress baseline (PER SUBSTEP) ---
            // Moved into the loop 2026-06-08 (finding #1) so counter-regulation, HAAF,
            // liver glycogen, and insulin resistance are integrated with the same dt <= 1 min as
            // BG. Runs at the TOP of the substep on start-of-step BG (Euler convention) —
            // at 1-min substeps the behaviour is identical to the old per-tick version.
            // Stress response (S9.10, modules.stressResponse): acute counter-regulation,
            // chronic stress, HAAF, and exercise adrenaline. Disabled -> no stress
            // evolution and acute/chronic are excluded from stressBase (dawn cortisol and the
            // hepatic baseline are NOT stress and are preserved).
            const stressScale = this.moduleScale('stressResponse');
            // Udvaskning fortsætter også når stress-modulet er slået fra; modulet
            // bestemmer kun, om leverresponsen påvirker fysiologien.
            this.exerciseHepaticDrive *= Math.exp(-Math.log(2) / 30 * stepDt);
            if (stressScale > 0) {
                this.updateStressHormones(stepDt, stressScale);
                // Den motionsudløste katekolaminrespons er en separat, kortlivet
                // leverdriver. Den vaskes ud kontinuerligt og opbygges kun under
                // aktivitet. Type-specifikke lofter tillader en kraftig styrke/HIIT-
                // respons uden at ændre hypo-modregulationens loft på 0,4.
                if (exerciseHepaticDriveRate > 0) {
                    this.exerciseHepaticDrive = Math.min(
                        exerciseHepaticDriveCeiling,
                        this.exerciseHepaticDrive + exerciseHepaticDriveRate * stepDt
                    );
                }
                if (exerciseStressRedRate > 0) {
                    this.acuteStressLevel = Math.max(0,
                        this.acuteStressLevel - exerciseStressRedRate * stepDt);
                    this.chronicStressLevel = Math.max(0,
                        this.chronicStressLevel - exerciseStressRedRate * 0.3 * stepDt);
                }
            } else {
                // A disabled stress-response module freezes stress/HAAF evolution,
                // but basal, protein, exercise and recovery flows in the liver pool
                // must continue. Only the stress-driven glycogen drain is zero.
                this.updateGlycogenReserve(stepDt, 0);
            }
            // Recompute stressBase with fresh glycogen/stress state. Decomposition:
            //   glycogenBaseline (50% glycogenolysis, glycogen-scaled)
            // + gngBaseline (50% GNG + compensatory up-regulation when glycogen is depleted)
            // + effective acute stress (60% glycogenolysis component falls with glycogen, 40% GNG component survives)
            // + chronic stress + dawn cortisol.
            const glycogenBaseline = 0.5 * this.glycogenReserve;
            const gngCompensation = (1 - this.glycogenReserve) * 0.25;
            const gngBaseline = 0.5 + gngCompensation;
            // S9.12: scale the acute + chronic HGP stress terms by the module scalar
            // (× 1.0 at default → bit-identical). The ISF-side stress effect
            // (insulinResistanceFactor) is scaled in the currentISF getter.
            const effectiveCatecholamineDrive =
                (this.acuteStressLevel + this.exerciseHepaticDrive) *
                (0.6 * this.glycogenReserve + 0.4) * stressScale;
            const chronicStressTerm = this.chronicStressLevel * stressScale;
            const stressBase = glycogenBaseline + gngBaseline + effectiveCatecholamineDrive +
                chronicStressTerm + this.circadianKortisolNiveau;

            // --- 0. Drip active meals into the stomach (drip mechanism) ---
            // The activeIntake queue contains meals that feed themselves into the
            // stomach over their eatTimeMin. Must be called BEFORE _substepFatProteinFFA()
            // so tau_G is computed on the updated stomach mixture each substep.
            this._processActiveIntake(stepDt);

            // --- 1. Update fat/protein/FFA compartments (substep precision) ---
            // Updates: fatStomach, fatIntestine, ffaBlood, ffaResistanceFactor,
            //          proteinStomach, proteinGut, aminoAcidsBlood, proteinGlucagonLevel,
            //          hovorka.tau_G (dynamic gastric emptying)
            this._substepFatProteinFFA(stepDt);

            // --- 2. Update Hovorka parameters that depend on substep-updated state ---
            // stressMultiplier: stressBase (per-substep) + protein-glucagon (substep-variable)
            const effectiveProteinGlucagon = this.proteinGlucagonLevel *
                (0.5 + 0.5 * this.glycogenReserve);
            this.hovorka.stressMultiplier = stressBase + effectiveProteinGlucagon;

            // ISF modifier: includes ffaResistanceFactor (updated in substep)
            // currentISF getter uses ffaResistanceFactor → ISF modifier is updated correctly
            // ISF-modifier split (#6, BG-SCIENCE §25): the sustained PEIS is applied
            // as an EC50 shift on the muscle channel; circadian + vasodilation
            // + resistance are scaled as amplitude (x_max). The currentISF getter sets
            // this._lastPeisFactor as a side-effect immediately before we read it here.
            const fullMod = this.currentISF / this.ISF;
            const peis = this._lastPeisFactor || 1.0;
            this.hovorka.setInsulinModifiers(fullMod / peis, peis);

            // --- 2b. Per-bolus rapid insulin (codex review 2026-04-07 followup, issue 3) ---
            // Integrate each active bolus' own (s1, s2) with its own tauI.
            // Sets hovorka.rapidU_I = sum so hovorka.step()'s dI uses
            // the correct total absorption without boluses interfering with each other.
            this._substepRapidInsulin(stepDt);

            // --- 3. Run Hovorka ODEs for this substep ---
            this.applyPlasmaInsulinClamp();
            this.hovorka.step(stepDt);
            this.applyPlasmaInsulinClamp();

            // --- 4. Update ketone compartments (after Hovorka, so plasmaInsulin is fresh) ---
            // modules.ketones (S9.10): disabled -> no ketone/acidosis production
            // (ketoneLevel/acidosisLoad remain 0; simplified mode without DKA).
            if (this.moduleScale('ketones') > 0) this._substepKetones(stepDt);

            // --- 5. Update muscle glycogen pool (after Hovorka, so Q1 is fresh) ---
            // The pool is intracellular bookkeeping that modulates earlyBoost in
            // currentISF. Its replenishment is allocated from the glucose disposal
            // already represented by x1/x2 and E1; it must not subtract Q1 again.
            this.updateMuscleGlycogen(stepDt);

            // --- 6. Update active glucagon injection (gradual glycogenolysis) ---
            // Triangle profile: ramp 0 → peak (12 min) → 0 (45 min). Draws from
            // liverGlycogenGrams, adds to Q1. Mass-conserving.
            this._substepGlucagon(stepDt);

            // --- 7. Refresh trueBG + BG-coupled damage accumulators (PER SUBSTEP) ---
            // trueBG is updated HERE — after all other substep physics — so the subsystems
            // above retain their start-of-step BG (unchanged behaviour at 1-min substeps),
            // while the damage models below see the fresh post-step value. Moved into
            // the loop 2026-06-08 (finding #1) so brain-deficit, acidosis, and glucotoxicity
            // are integrated with dt <= 1 min regardless of game speed/framerate.
            this.trueBG = Math.max(0.1, this.hovorka.glucoseConcentration);
            this.updateBrainEnergyDeficit(stepDt);
            this.updateAcidosisLoad(stepDt);
            // modules.glucotoxicity (S9.10): disabled -> glucotoxic load remains 0
            // (the currentISF getter then returns factor 1.0; no hyperglycaemia resistance).
            if (this.moduleScale('glucotoxicity') > 0) this.updateGlucotoxicity(stepDt);

            remaining -= stepDt;

            // Physiology data is recorded every sim-minute (instead of every 5th at CGM rate).
            // This yields smooth insulin curves because the two-compartment model
            // (S1 → S2 → plasma) is sampled at its native resolution.
            const substepTime = this.totalSimMinutes - remaining;
            if (substepTime - this._lastPhysioRecordTime >= 1.0) {
                const iobNow = Math.max(0,
                    (this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] + this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2]
                    + Math.max(0, (this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] - this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib]) * this.hovorka.V_I))
                    / 1000);
                // Plasma insulin I×V_I [mU] — "Insulin Active Now" (IAN).
                // Used by the insulin band to display the classic PK curve.
                const plasmaIMU = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] * this.hovorka.V_I;
                // Exact basal/rapid separation via the shadow cascade (S1b/S2b/Ib).
                // Ib (state[15]) tracks precisely how much plasma insulin derives
                // from basal input, including the correct pulseFactor acceleration.
                // Rapid = total - basal is exact due to linearity of the ODEs.
                const basalPlasmaMU = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib] * this.hovorka.V_I;
                const rapidPlasmaMU = Math.max(0, plasmaIMU - basalPlasmaMU);
                onSample({
                    time: substepTime,
                    basalRate: this.basalInsulinRate,
                    bolusIOB: iobNow,
                    plasmaInsulinMU: plasmaIMU,
                    basalPlasmaMU: basalPlasmaMU,
                    rapidPlasmaMU: rapidPlasmaMU,
                    egp: this.hovorka._lastEGP || 0,
                    carbAbsorption: this.hovorka._lastUG || 0,
                    currentISF: this.currentISF,       // effective ISF including all modifiers
                    ketoneLevel: this.ketoneLevel || 0 // BHB [mmol/L] — drives the keto line
                });
                this._lastPhysioRecordTime = substepTime;
            }
        }
    }

    // _prepInsulinRates — Pre-loop insulin calculation (S7.3). Computes the basal
    // trapezoid rate, deposits new bolus doses directly into their s1 depot, filters
    // expired doses, and updates rapid-IOB. Sets hovorka.basalInsRate/insulinRate
    // and the engine fields basalInsulinRate/iob/displayIOB/bioavScale. Called from
    // Simulator._stepPhysiology() at the same position as the old inline block, so
    // the ordering is bit-identical. Requires an attached Hovorka model.
    _prepInsulinRates() {
        // --- 1. COMPUTE TOTAL INSULIN RATE [mU/min] ---
        //
        // BASAL insulin: trapezoid profile (slow ramp-up over 2 h, plateau, tail-off 6 h)
        // delivers a steady rate over ~22-32 hours (Lantus profile).
        // Onset 2 h → plateau ~20 h → tail-off 6 h. Fed via Hovorka's shadow cascade
        // (S1b → S2b → Ib) which further smooths transitions.
        // TODO: Selectable insulin type (Tresiba/Levemir/Toujeo) with individual profiles.
        let totalInsulinRate = 0;
        let basalInsulinRate = 0;  // Separate tracking for the debug panel [mU/min]
        this.activeLongInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection < 0) return;
            let effectFactor = 0;
            const timeToPlateau = 2 * 60;                                          // 2 h ramp-up (Lantus onset ~1-2 h)
            const tailOffDuration = 6 * 60;                                        // 6 h gradual tail-off (fast)
            const endOfPlateau = Math.max(timeToPlateau, ins.totalDuration - tailOffDuration); // plateau ends 6 h before end
            if (timeSinceInjection < timeToPlateau) effectFactor = timeSinceInjection / timeToPlateau;
            else if (timeSinceInjection < endOfPlateau) effectFactor = 1.0;
            else if (timeSinceInjection < ins.totalDuration) effectFactor = 1.0 - (timeSinceInjection - endOfPlateau) / tailOffDuration;
            // Bioavailability: only a fraction of the dose reaches the bloodstream (the rest is degraded locally).
            // Trapezoid area normalisation: divisor is the effective area under the trapezoid curve,
            // NOT totalDuration. Otherwise ~14% of bioavailable insulin "disappears".
            // Effective area = totalDuration - rampUp/2 - tailOff/2 (= area of trapezoid with height 1).
            const ba = ins.bioavailability || 1.0;
            const effectiveArea = ins.totalDuration - timeToPlateau / 2 - tailOffDuration / 2;
            const rate = (ins.dose * ba * 1000 / effectiveArea) * Math.max(0, effectFactor);
            totalInsulinRate += rate;
            basalInsulinRate += rate;
        });
        this.basalInsulinRate = basalInsulinRate;  // Store for debug [mU/min]
        this.activeLongInsulin = this.activeLongInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        // Basal → basal cascade (S1b/S2b/Ib) with constant baseTauI.
        // Rapid → S1/S2 (deposited directly, see below) with variable tau_I.
        // insulinRate = 0: basal does NOT feed into the rapid depot (S1/S2).
        // (codex review 2026-04-07, issue 2: decoupling bolus tauFactor from basal)
        this.hovorka.basalInsRate = basalInsulinRate;
        this.hovorka.insulinRate = 0;  // Rapid depot receives input only via direct S1 deposit

        // BOLUS (rapid-acting) insulin: per-bolus depots (codex review
        // 2026-04-07 followup, issue 3).
        //
        // Each active rapid bolus has its own (s1, s2, tauI) pair. This means
        // two overlapping boluses with different tauFactor do NOT interfere
        // with each other's absorption — the kinetics are truly independent per dose.
        // Previously all active boluses were collapsed into a single weighted tau_I,
        // which retroactively changed the kinetics for previously injected
        // insulin whenever a new bolus with a different tauFactor was added.
        //
        // Per-bolus integration is done in _substepRapidInsulin(), called
        // before hovorka.step() in the substep loop below. It updates
        // hovorka.rapidU_I, and state[2]/state[3] are held as cached sums
        // for IOB display and respawn logic.
        //
        // DIRECT S1 DEPOSIT: A pen injection takes seconds, not 5 minutes.
        // The full dose is deposited directly into the bolus' own ins.s1 the first time it
        // is seen in update(). The 'deposited' flag ensures this happens only once.
        // Bioavailability reduces the effective dose (local degradation in
        // subcutis). Substepping then integrates s1 → s2 → plasma.
        this.activeFastInsulin.forEach(ins => {
            if (!ins.deposited) {
                const ba = ins.bioavailability || 1.0;
                ins.s1 = (ins.s1 || 0) + ins.dose * ba * 1000;  // mU
                ins.deposited = true;
            }
        });
        // Remove bolus entries after 6 hours (well after all insulin has been absorbed,
        // but retained for IOB tracking during this period)
        this.activeFastInsulin = this.activeFastInsulin.filter(ins =>
            (this.totalSimMinutes - ins.injectionTime) < 6 * 60);

        // IOB: rapid-only from separated depots. S1/S2 contain ONLY rapid insulin,
        // plasma rapid = I - Ib (total minus basal). No baseline subtraction needed.
        const rapidDepotMU = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] + this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2];
        const rapidPlasmaMU_iob = Math.max(0,
            (this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] - this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib]) * this.hovorka.V_I);
        this.iob = Math.max(0, (rapidDepotMU + rapidPlasmaMU_iob) / 1000);

        // displayIOB: shows the full injected dose in the game's IOB display.
        // Physiological IOB is reduced due to bioavailability (~78%), but the user
        // expects to see the dose they actually injected.
        // Compute scaling factor from active bolus injections (last 6 hours):
        let _injected = 0, _effective = 0;
        for (const ins of this.activeFastInsulin) {
            if (this.totalSimMinutes - ins.injectionTime < 360) {
                _injected += ins.dose;
                _effective += ins.dose * (ins.bioavailability || 1.0);
            }
        }
        const bioavScale = _effective > 0 ? _injected / _effective : 1.0;
        this.bioavScale = bioavScale;  // Exposed to the IAN band (ui.js)
        this.displayIOB = Math.max(0, this.iob * bioavScale);
    }

    // _prepStepInputs — pre-loop carbohydrate rate + heart-rate/exercise prep (S8-C1).
    // Computes tau_G init, carb rate for Hovorka D1/D2 (step-overlap weighted),
    // COB estimate, heart rate (sliding toward activity target, hypo-reduced), and
    // exercise stress rates; handles calorie/time accumulation and auto-stop
    // (fixed duration or 4 h limit → stopActivity + 'exercise-max-duration').
    // Sets hovorka.insulinRate/carbRate/heartRate/exerciseInput. Returns the two
    // exercise stress rates plus an auto-stop flag. Reads only
    // engine state + hovorka + activity typeDef (stored on activeAktivitet).
    _prepStepInputs(simulatedMinutesPassed) {
        // Initialise tau_G from fat state before carb rate is computed.
        // tau_G is updated continuously in each substep, but the start value is used for carbRate.
        this.hovorka.tau_G = 40 + 18 * Math.log(1 + this.fatIntestine / 10);

        // --- COMPUTE CARBOHYDRATE RATE for Hovorka D1/D2 [mmol/min] ---
        // Mass-conservation under variable step size: compute the real overlap
        // between the update step [stepStart, stepEnd] and the eating window [eatStart, eatEnd]
        // and derive carbRate so that totalCarbRate × stepDuration matches the carbs
        // "eaten" in this step. Protein affects BG via glucagon, not as carbs.
        const stepStart = this.totalSimMinutes - simulatedMinutesPassed;
        const stepEnd = this.totalSimMinutes;
        let totalCarbRate = 0;
        this.cob = 0;
        this.activeFood.forEach(food => {
            const timeSinceConsumption = this.totalSimMinutes - food.startTime;
            const eatingDuration = food.eatingDuration > 0 ? food.eatingDuration : 10;

            // Carbohydrate rate: fed in over eating time, weighted by step overlap
            if (food.carbs > 0 && simulatedMinutesPassed > 0) {
                const eatStart = food.startTime;
                const eatEnd = food.startTime + eatingDuration;
                const overlap = Math.max(0, Math.min(stepEnd, eatEnd) - Math.max(stepStart, eatStart));
                if (overlap > 0) {
                    const mmolDelivered = (food.carbs / ENGINE_GLUCOSE_G_PER_MMOL) * (overlap / eatingDuration);
                    totalCarbRate += mmolDelivered / simulatedMinutesPassed;
                }
            }

            // COB tracking: estimate remaining carbohydrates based on time (dynamic tau_G).
            const decayTime = 3 * this.hovorka.tau_G; // ~95% absorbed after 3×tau_G
            const carbDecay = Math.max(0, 1 - timeSinceConsumption / decayTime);
            this.cob += food.carbs * carbDecay;
        });
        // Remove food entries after 6 hours (fat can significantly extend absorption)
        this.activeFood = this.activeFood.filter(f =>
            (this.totalSimMinutes - f.startTime) < 360);

        // --- COMPUTE HEART RATE AND EXERCISE EFFECTS ---
        // Heart rate rises/falls GRADUALLY via exponential smoothing (up t½≈2 min, down t½≈5 min).
        // Exercise stress rates are tick-constant but accumulated per substep in the loop.
        let targetHeartRate = this.hovorka.HR_base;
        let contractionUptakeScaling = 0.0;
        let exerciseHepaticDriveRate = 0;
        let exerciseHepaticDriveCeiling = 0;
        let exerciseStressRedRate = 0;  // relaxation stress reduction per sim-min (>0 for relaxation)
        let autoStopAfterStep = false;

        if (this.activeAktivitet) {
            const akt = this.activeAktivitet;
            const typeDef = akt.typeDef;

            // Target HR + contraction scaling. This one parameter controls only
            // insulin-independent muscle uptake; sensitivity and glycogen use have
            // separate parameters in the activity definition.
            targetHeartRate = typeDef.hrTarget[akt.intensitet] || typeDef.hrTarget.Medium;
            contractionUptakeScaling = typeDef.contractionUptakeScaling;

            // Motionsudløst leverrespons og stressreduktion pr. simulationsminut.
            exerciseHepaticDriveRate =
                typeDef.hepaticDriveRate[akt.intensitet] || 0;
            exerciseHepaticDriveCeiling =
                typeDef.hepaticDriveCeiling[akt.intensitet] || 0;
            exerciseStressRedRate = typeof typeDef.stressReduction === 'object'
                ? (typeDef.stressReduction[akt.intensitet] || 0)
                : typeDef.stressReduction;

            // Accumulate calorie burn + activity time (campaign objectives)
            akt.kcalBurned += akt.kcalPerMin * simulatedMinutesPassed;
            this.totalExerciseMinutes += simulatedMinutesPassed;

            // Mark auto-stop at fixed duration or hard 4-hour limit. The actual stop
            // happens after this tick's physiology, so the final minute is included.
            const elapsed = this.totalSimMinutes - akt.startTime;
            const MAX_EXERCISE_DURATION = 240; // 4 hours — marathon limit
            if ((akt.varighed != null && elapsed >= akt.varighed) || elapsed >= MAX_EXERCISE_DURATION) {
                if (elapsed >= MAX_EXERCISE_DURATION) {
                    this.emitEvent('exercise-max-duration');
                }
                autoStopAfterStep = true;
            }
        }

        // --- Hypo-reduced exercise capacity ---
        // BG >= 3.5: full capacity; BG=2.5: halved; BG<=2.0: minimal (~unconscious).
        if (this.trueBG < 3.5 && targetHeartRate > this.hovorka.HR_base) {
            const hypoFactor = Math.max(0.05, Math.min(1.0, (this.trueBG - 1.5) / 2.0));
            targetHeartRate = this.hovorka.HR_base + (targetHeartRate - this.hovorka.HR_base) * hypoFactor;
        }

        // Sliding heart rate: exponential approach toward targetHeartRate.
        const isRising = targetHeartRate > this.smoothHeartRate;
        const hrHalfLife = isRising ? 2.0 : 5.0;  // sim-minutes
        const hrDecay = 1 - Math.exp(-Math.log(2) / hrHalfLife * simulatedMinutesPassed);
        this.smoothHeartRate += (targetHeartRate - this.smoothHeartRate) * hrDecay;
        const currentHeartRate = this.smoothHeartRate;

        // --- Set Hovorka inputs (constant for the whole tick) ---
        // insulinRate = 0: the rapid depot (S1/S2) receives input only via direct deposit.
        this.hovorka.insulinRate = 0;
        // Carbohydrates are fed via Hovorka's D1→D2 gut model (realistic 2-compartment absorption).
        this.hovorka.carbRate = totalCarbRate;
        this.hovorka.heartRate = currentHeartRate;
        // E1 input is normalized heart-rate excess while the muscles are actually
        // working. It becomes zero immediately when no activity is active; E1 itself
        // then decays continuously in Hovorka. Smooth HR remains available separately
        // for perfusion-driven insulin absorption during recovery.
        const normalizedHeartRateExcess = this.activeAktivitet
            ? Math.max(0, (currentHeartRate - this.hovorka.HR_base) / this.hovorka.HR_base)
            : 0;
        this.hovorka.exerciseInput =
            normalizedHeartRateExcess * contractionUptakeScaling;

        return {
            exerciseHepaticDriveRate,
            exerciseHepaticDriveCeiling,
            exerciseStressRedRate,
            autoStopAfterStep
        };
    }

    // _recomputePostStepIOB — recompute IOB/displayIOB from post-ODE Hovorka state
    // (S7.7). Called after the substep loop. Rapid-only from separated depots
    // (state[2]/[3]) + plasma rapid (I - Ib). displayIOB is scaled up to the injected
    // dose (compensate for bioavailability).
    _recomputePostStepIOB() {
        const postRapidDepot = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] + this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2];
        const postRapidPlasma = Math.max(0,
            (this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] - this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib]) * this.hovorka.V_I);
        this.iob = Math.max(0, (postRapidDepot + postRapidPlasma) / 1000);
        let _inj2 = 0, _eff2 = 0;
        for (const ins of this.activeFastInsulin) {
            if (this.totalSimMinutes - ins.injectionTime < 360) {
                _inj2 += ins.dose;
                _eff2 += ins.dose * (ins.bioavailability || 1.0);
            }
        }
        this.displayIOB = Math.max(0, this.iob * (_eff2 > 0 ? _inj2 / _eff2 : 1.0));
    }

    // =========================================================================
    // GLUCOTOXICITY — hyperglycaemia-induced insulin resistance (S7.5a)
    // =========================================================================
    // Sustained hyperglycaemia (BG > 10 mmol/L) impairs cellular insulin signalling
    // via oxidative stress (Brownlee 2001), hexosamine pathway, PKC activation,
    // AGEs, and GLUT4 down-regulation. Modelled as an accumulating load
    // (glucotoxicLoad) that drives a sigmoid ISF divisor. Quadratic dose-response.
    // Calibration: 24 h at 20 mmol/L → ~26% ISF reduction (Vuorinen-Markkola 1992).
    updateGlucotoxicity(simulatedMinutesPassed) {
        const bg = this.trueBG;

        if (bg > this.GLUCOTOX_BG_THRESHOLD) {
            // --- ACCUMULATION: quadratic with BG excess ---
            //   BG 12 → (12-10)² = 4  → slow accumulation (mild hyperglycaemia)
            //   BG 15 → (15-10)² = 25 → moderate accumulation
            //   BG 20 → (20-10)² = 100 → rapid accumulation (severe hyperglycaemia)
            const excess = bg - this.GLUCOTOX_BG_THRESHOLD;
            this.glucotoxicLoad += this.GLUCOTOX_RATE * excess * excess * simulatedMinutesPassed;
        } else if (this.glucotoxicLoad > 0) {
            // --- RECOVERY: exponential decay when BG normalises ---
            // t½ = 24 h: the acute component (GLUT4) reverses within hours, but
            // full re-expression takes days. 24 h is a clinical compromise.
            const decayRate = Math.log(2) / this.GLUCOTOX_RECOVERY_HALF;
            this.glucotoxicLoad *= Math.exp(-decayRate * simulatedMinutesPassed);
            if (this.glucotoxicLoad < 0.01) this.glucotoxicLoad = 0;
        }

        // --- ISF DIVISOR: sigmoid saturation (prevents unbounded resistance) ---
        //   load ~0:  factor ≈ 1.0  (no resistance)
        //   load ~50: factor ≈ 1.16 (half-maximal — ~24 h at 20 mmol/L)
        //   load →∞:  factor → 1.40 (max 40% ISF reduction)
        if (this.glucotoxicLoad > 0.01) {
            const loadN = Math.pow(this.glucotoxicLoad, this.GLUCOTOX_HILL_N);
            const ec50N = Math.pow(this.GLUCOTOX_EC50, this.GLUCOTOX_HILL_N);
            this.glucotoxicResistanceFactor = 1.0 + this.GLUCOTOX_MAX_RESIST * loadN / (ec50N + loadN);
        } else {
            this.glucotoxicResistanceFactor = 1.0;
        }
    }

    // updateBrainEnergyDeficit — brain glucose deficit during severe hypo (S7.5b).
    // Accumulates when BG < BRAIN_CRISIS_BG (linearly with F01), recovers otherwise.
    // brainDeficitWarningGiven is an internal 50% guard (popup removed; symptom
    // overlay is drawn by the facade based on brainEnergyDeficit).
    updateBrainEnergyDeficit(simulatedMinutesPassed) {
        const G = this.trueBG;
        const F01 = this.hovorka.F_01;

        if (G < this.BRAIN_CRISIS_BG) {
            // --- ACCUMULATION: brain is not receiving enough glucose ---
            // Linear deficit: 0% at BG=2.5, 100% at BG=0
            const deficitRate = F01 * (1 - G / this.BRAIN_CRISIS_BG);
            this.brainEnergyDeficit += deficitRate * simulatedMinutesPassed;

            // Track lowest BG during the deficit period (for game-over message)
            if (G < this._lowestBGDuringDeficit) this._lowestBGDuringDeficit = G;

            // --- WARNING at 50% of threshold (internal guard) ---
            if (!this.brainDeficitWarningGiven &&
                this.brainEnergyDeficit >= this.BRAIN_DEFICIT_THRESHOLD * 0.5) {
                this.brainDeficitWarningGiven = true;
            }
        } else if (this.brainEnergyDeficit > 0) {
            // --- RECOVERY: brain rebuilds glycogen reserves ---
            const recoveryDecay = Math.log(2) / this.BRAIN_RECOVERY_HALF;
            this.brainEnergyDeficit *= Math.exp(-recoveryDecay * simulatedMinutesPassed);
            // Clamp to 0 to avoid floating-point dust
            if (this.brainEnergyDeficit < 0.01) {
                this.brainEnergyDeficit = 0;
                this._lowestBGDuringDeficit = Infinity; // Reset when fully recovered
            }

            // Reset warning when deficit falls below 25% (allows a new warning)
            if (this.brainEnergyDeficit < this.BRAIN_DEFICIT_THRESHOLD * 0.25) {
                this.brainDeficitWarningGiven = false;
            }
        }
    }

    // updateAcidosisLoad — progressive metabolic acidosis from ketones (S7.5b).
    // Accumulates ONLY under real insulin deficiency (DKA), not fasting ketosis: a smooth
    // insulin gate (smoothstep) determines whether elevated BHB is dangerous. acidosisWarningGiven
    // is an internal 50% guard (popup removed; the facade renders DKA symptoms).
    // Source: BG-SCIENCE.md §18 — "fasting ketosis is NOT the same as DKA".
    updateAcidosisLoad(simulatedMinutesPassed) {
        const bhb = this.ketoneLevel;

        // Plasma insulin determines whether ketones are dangerous:
        //   plasmaI > ~8 mU/L: insulin present → fasting ketosis → NO acidosis
        //   plasmaI < ~5 mU/L: insulin deficiency → DKA → acidosis accumulates
        // FIXED EC50=5: numerically equal to LIPOLYSIS_EC50 but conceptually independent —
        // asks "is there enough insulin to prevent life-threatening DKA?".
        const ACIDOSIS_INSULIN_EC50 = 5;   // Fixed value — independent of lipolysis EC50
        const plasmaI = this.hovorka ? this.hovorka.plasmaInsulin : 10;
        const insulinSuppression = Math.pow(ACIDOSIS_INSULIN_EC50, 2) /
            (Math.pow(ACIDOSIS_INSULIN_EC50, 2) + Math.pow(Math.max(0, plasmaI), 2));
        // insulinSuppression: 1.0 at I=0 (full DKA), ~0.5 at I=5, ~0.06 at I=20 mU/L

        // --- SMOOTH INSULIN GATE (Hermite smoothstep 3t²−2t³) ---
        // Replaces a hard `> 0.3` gate that produced a discontinuity at I ≈ 7.64
        // mU/L (codex 2026-04-07 #4). C¹-continuous with the same boundary points:
        //   suppression ≤ 0.3 → gateSmooth = 0 (no accumulation)
        //   suppression ≥ 0.5 → gateSmooth = 1 (full rate)
        const t = Math.min(1, Math.max(0, (insulinSuppression - 0.3) / 0.2));
        const gateSmooth = t * t * (3 - 2 * t);

        if (bhb > this.ACIDOSIS_BHB_THRESHOLD && gateSmooth > 0) {
            // --- ACCUMULATION: only under real insulin deficiency (DKA) ---
            const excess = bhb - this.ACIDOSIS_BHB_THRESHOLD;
            // Linear + quadratic: mild DKA = slow, severe DKA = fast.
            const rawRate = this.ACIDOSIS_BASE_RATE * excess
                          + this.ACIDOSIS_ACCEL_RATE * excess * excess;
            const rate = rawRate * insulinSuppression * gateSmooth;
            this.acidosisLoad += rate * simulatedMinutesPassed;

            // --- WARNING at 50% of threshold (internal guard) ---
            if (!this.acidosisWarningGiven &&
                this.acidosisLoad >= this.ACIDOSIS_THRESHOLD * 0.5) {
                this.acidosisWarningGiven = true;
            }
        } else if (this.acidosisLoad > 0) {
            // --- RECOVERY: bicarbonate buffer is regenerated via the kidneys ---
            const recoveryDecay = Math.log(2) / this.ACIDOSIS_RECOVERY_HALF;
            this.acidosisLoad *= Math.exp(-recoveryDecay * simulatedMinutesPassed);
            // Clamp to 0 to avoid floating-point dust
            if (this.acidosisLoad < 0.1) this.acidosisLoad = 0;

            // Reset warning when load falls below 25% (allows a new warning)
            if (this.acidosisLoad < this.ACIDOSIS_THRESHOLD * 0.25) {
                this.acidosisWarningGiven = false;
            }
        }
    }

    // updateMuscleGlycogen — muscle glycogen pool: exercise depletes and
    // post-exercise resynthesis refills it (S7.5c). The pool tracks intracellular
    // fuel allocation and gates early PEIS. It does not subtract Q1 directly:
    // x1/x2 and E1 already own the corresponding whole-body glucose uptake.
    updateMuscleGlycogen(simulatedMinutesPassed) {
        const dt = simulatedMinutesPassed;

        // Live BG from Hovorka — this method is called per substep after hovorka.step(),
        // so Q1/V_G reflects the current plasma glucose.
        const bgNow = this.hovorka.glucoseConcentration;

        // --- CONSUMPTION: exercise depletes the pool ---
        let consumption_gPerMin = 0;
        if (this.activeAktivitet) {
            const akt = this.activeAktivitet;
            const typeDef = akt.typeDef;
            const glycogenUseScale = typeDef.glycogenUseScaling || 0;
            const kcalPerMin = akt.kcalPerMin || 5;
            const fraction = MUSCLE_GLYCOGEN_DEPLETION_FRACTION[akt.intensitet] || 0;
            // glycogenUseScale is independent of contraction uptake and PEIS.
            // Scale by reserve: an empty pool cannot deliver the full rate.
            consumption_gPerMin = (kcalPerMin * fraction / 4.0) *
                glycogenUseScale * this.muscleGlycogenReserve;
        }

        // Track the last real muscle contraction (AMPK phase-1 decay in resynthesis).
        // Deliberately INDEPENDENT of activeMotion — even brief exercise bouts qualify.
        if (consumption_gPerMin > 0) {
            this.lastMuscleContractionEndTime = this.totalSimMinutes;
        }

        // --- REPLENISHMENT: only when not exercising, pool not full, BG > 3.5 ---
        let resynthesis_gPerMin = 0;
        const deficit = this.muscleGlycogenCapacity - this.muscleGlycogenGrams;
        const emptyFraction = deficit / this.muscleGlycogenCapacity;

        if (!this.activeAktivitet && emptyFraction > 0.005 && bgNow > 3.5) {
            // Phase 1: AMPK-driven, insulin-independent. Scales with how recent
            // the last muscle contraction was.
            let fastPhaseActivity = 0;
            if (this.lastMuscleContractionEndTime !== null) {
                const tPost = this.totalSimMinutes - this.lastMuscleContractionEndTime;
                if (tPost >= 0) {
                    fastPhaseActivity = Math.pow(0.5, tPost / MUSCLE_GLYCOGEN_FAST_PHASE_HL_MIN);
                }
            }
            const fastPhase = MUSCLE_GLYCOGEN_FAST_PHASE_RATE * fastPhaseActivity;

            // Phase 2: insulin × BG drive. Insulin signal: x3 normalised.
            const x3 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x3];
            const insulinThreshold = 0.15 * (this.ISF / 3.75);
            const insulinSignal = Math.min(1.0, x3 / insulinThreshold);
            // BG drive: 0 at BG=4, 1 at BG=8+
            const bgDrive = Math.max(0, Math.min(1.0, (bgNow - 4.0) / 4.0));
            const slowBase = MUSCLE_GLYCOGEN_SLOW_PHASE_RATE * insulinSignal * bgDrive;

            // CHO acceleration: COB → additional insulin-driven contribution (max at COB > 50 g)
            const choFactor = Math.min(1.0, this.cob / 50);
            const choAccel = MUSCLE_GLYCOGEN_CHO_ACCEL_RATE * choFactor * insulinSignal;

            // Total rate, scaled down as pool approaches full (avoid overshoot)
            resynthesis_gPerMin = (fastPhase + slowBase + choAccel) * emptyFraction;
        }

        // --- MASS BALANCE: update pool (full uncapped rate — can use lactate etc.) ---
        const netChange = (resynthesis_gPerMin - consumption_gPerMin) * dt;
        this.muscleGlycogenGrams = Math.max(0,
            Math.min(this.muscleGlycogenCapacity, this.muscleGlycogenGrams + netChange));
        this.muscleGlycogenReserve = this.muscleGlycogenGrams / this.muscleGlycogenCapacity;

        // --- Rate tracking for UI ---
        this._muscleGlycogenResynthRate = resynthesis_gPerMin;
        this._muscleGlycogenConsumptionRate = consumption_gPerMin;
    }

    // _substepKetones — FFA-driven, IOB-based ketone model (S7.5d). Called per
    // substep AFTER hovorka.step() (requires fresh plasmaInsulin). Lipolysis (Hill,
    // insulin-suppressed) → FFA → CPT-1 gating → BHB production; clearance via
    // Michaelis-Menten oxidation + renal excretion. Reads only engine state +
    // engine constants (LIPOLYSIS_*/CPT1_*/BHB_*, moved in S7.4a).
    _substepKetones(dt) {
        // --- 1. Retrieve plasma insulin from the Hovorka model ---
        const plasmaI = this.hovorka.plasmaInsulin; // [mU/L]

        // --- 2. Lipolysis: FFA release from adipose tissue (insulin suppresses via Hill) ---
        const lipoEc50n = Math.pow(this.LIPOLYSIS_EC50, this.LIPOLYSIS_HILL_N);
        const lipoIn = Math.pow(Math.max(0, plasmaI), this.LIPOLYSIS_HILL_N);
        const lipolyseRate = this.LIPOLYSIS_MAX * lipoEc50n / (lipoEc50n + lipoIn);
        this._lastLipolyseRate = lipolyseRate; // Exposed to debug panel

        // FFA accumulation from lipolysis with exponential clearance
        const ffaLipoClearRate = Math.LN2 / this.FFA_LIPO_CLEAR_HALF; // min⁻¹
        const ffaLipoDecay = this.ffaLipolysis * ffaLipoClearRate * dt;
        const ffaLipoProduced = lipolyseRate * dt;
        this.ffaLipolysis = Math.max(0, this.ffaLipolysis + ffaLipoProduced - ffaLipoDecay);

        // --- 3. CPT-1 gating (insulin → malonyl-CoA → blocks FFA→ketones) ---
        const cpt1Ec50n = Math.pow(this.CPT1_EC50, this.CPT1_HILL_N);
        const cpt1In = Math.pow(Math.max(0, plasmaI), this.CPT1_HILL_N);
        const cpt1Activity = 1.0 - this.CPT1_MAX_SUPP * cpt1In / (cpt1Ec50n + cpt1In);
        this._lastCpt1Activity = cpt1Activity; // Exposed to debug panel

        // --- 4. BHB production (hepatic acyl-CoA = adipose FFA + fraction of dietary fat) ---
        const hepaticFFA = this.ffaLipolysis + this.BHB_DIET_FAT_FRAC * this.ffaBlood;
        // S9.12: ketones module scalar dials BHB production (× 1.0 at default →
        // bit-identical; the substep is gated off entirely at scale 0).
        const bhbProduced = this.BHB_PROD_RATE * hepaticFFA * cpt1Activity * dt * this.moduleScale('ketones');

        // --- 5. BHB clearance ---
        // 5a. Michaelis-Menten oxidation (muscle + brain), boosted by exercise
        const exerciseKetoneBoost = 1.0 + (this.smoothHeartRate - this.hovorka.HR_base) / 120;
        const effectiveVmax = this.BHB_VMAX * Math.max(1.0, exerciseKetoneBoost);
        const mmClearance = effectiveVmax * this.ketoneLevel / (this.BHB_KM + this.ketoneLevel) * dt;

        // 5b. Renal excretion: ketonuria above threshold (~0.5 mmol/L)
        let renalClearance = 0;
        if (this.ketoneLevel > this.BHB_RENAL_THR) {
            const excess = this.ketoneLevel - this.BHB_RENAL_THR;
            renalClearance = this.BHB_RENAL_VMAX * excess / (this.BHB_RENAL_KM + excess) * dt;
        }

        // --- 6. Net change ---
        this.ketoneLevel += bhbProduced - mmClearance - renalClearance;
        this.ketoneLevel = Math.max(0.0, Math.min(20.0, this.ketoneLevel));
    }

    // _substepRapidInsulin — per-bolus rapid insulin absorption (S7.5d). Integrates
    // each active bolus' own (s1, s2) with its own tauI and heart-rate-driven acceleration,
    // and sets hovorka.rapidU_I + caches the depots in state[2]/state[3]. Called BEFORE
    // hovorka.step() in the substep loop. Reads only engine state (activeFastInsulin) +
    // hovorka.
    _substepRapidInsulin(dt) {
        if (this.activeFastInsulin.length === 0) {
            this.hovorka.rapidU_I = 0;
            this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] = 0;
            this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2] = 0;
            return;
        }

        // Heart-rate-driven absorption — same formula as hovorka.step() uses for
        // the basal shadow cascade, so bolus and basal are affected equally by exercise.
        const pulsFaktor = 1 + Math.max(0,
            (this.hovorka.heartRate - this.hovorka.HR_base) / this.hovorka.HR_base) * 0.5;

        let totalS1 = 0;
        let totalS2 = 0;
        let totalU_I = 0;

        for (const ins of this.activeFastInsulin) {
            // Backward-compat: entries from before the refactor may not have s1/s2/tauI
            if (ins.s1 === undefined) ins.s1 = 0;
            if (ins.s2 === undefined) ins.s2 = 0;
            const tauI_eff = ins.tauI || (55 * (ins.tauFactor || 1.0));

            // Start-of-step values (Euler uses these to compute derivatives)
            const s1_start = ins.s1;
            const s2_start = ins.s2;

            // Per-bolus absorption from s2 to plasma [mU/min]
            const u_I_i = s2_start / tauI_eff * pulsFaktor;
            totalU_I += u_I_i;

            // Euler integration:
            //   ds1/dt = -s1/tauI * pulsFaktor               (no input — already deposited)
            //   ds2/dt = s1/tauI * pulsFaktor - s2/tauI * pulsFaktor
            const ds1 = -s1_start / tauI_eff * pulsFaktor;
            const ds2 = s1_start / tauI_eff * pulsFaktor - u_I_i;
            ins.s1 = Math.max(0, s1_start + ds1 * dt);
            ins.s2 = Math.max(0, s2_start + ds2 * dt);

            totalS1 += ins.s1;
            totalS2 += ins.s2;
        }

        // hovorka.step() reads this.rapidU_I in its dI computation
        this.hovorka.rapidU_I = totalU_I;

        // Cache total rapid depots in state[2]/state[3] (for IOB display and respawn logic)
        this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S1] = totalS1;
        this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.S2] = totalS2;
    }

    // _substepFatProteinFFA — fat/protein/FFA compartments + dynamic tau_G (S7.5d).
    // Computes the stomach's dynamic tau_G (carb type, fibre, retention, fat delay,
    // hyperglycaemia delay, exercise delay), updates fat/protein ODEs, FFA resistance
    // (pizza effect), and protein-glucagon. Sets hovorka.tau_G + splanchnicAbsorbMod.
    // Called BEFORE hovorka.step() (affects tau_G/ISF). Reads only engine state +
    // engine constants (STOMACH_*/TAU_*/FFA_*/AA_*, moved in S7.4b).
    // Full calibration/source documentation: docs/BG-SCIENCE.md §5/§23 +
    // git history for js/simulator.js.
    _substepFatProteinFFA(dt) {
        // Dynamic tau_G from the stomach's mixture state (carb type, fibre, retention).
        // Empty stomach: fall back to base 40 min.
        let carbBase = 40; // fallback when stomach is empty
        let fiberMod = 1.0;
        let retentionMod = 1.0;
        if (this.stomachContentGrams > 0.1) {
            const simpleFrac = this.stomachCarbsTotal > 0
                ? this.stomachCarbsSimple / this.stomachCarbsTotal
                : 0.2;
            carbBase = 25 + (1 - simpleFrac) * 25;
            fiberMod = 1 + 0.5 * Math.log(1 + this.stomachFiber / 2);
            const retentionRatio = this.stomachRetentionWeight / this.stomachContentGrams;
            retentionMod = 1 - 0.6 * (1 - retentionRatio);
        }
        const fatDelay = 18 * Math.log(1 + this.fatIntestine / 10);

        // Hyperglycaemia-mediated gastric emptying delay (vagal/nitrergic feedback,
        // Phillips 2015). +0% at BG<=8, saturates toward +60%.
        const hyperExcess = Math.max(0, this.trueBG - 8);
        const hyperMod = 1 + 0.6 * hyperExcess / (hyperExcess + 6);
        this._lastHyperMod = hyperMod;

        // Exercise-mediated GE delay (A) + splanchnic absorption reduction (B).
        // hrFrac as intensity proxy (Leiper 2001, Qamar & Read 1987).
        const hrFrac = Math.max(0,
            (this.smoothHeartRate - this.hovorka.HR_base) / this.hovorka.HR_base);
        // A) GE delay: linear ramp from hrFrac 1.0 to 1.6, max +35%
        const geRamp = Math.max(0, Math.min(1, (hrFrac - 1.0) / 0.6));
        const exerciseGEMod = 1 + 0.35 * geRamp;
        this._lastExerciseGEMod = exerciseGEMod;
        // B) Splanchnic absorption reduction: quadratic ramp (start hrFrac 0.5, full at 1.7)
        const splanchRamp = Math.max(0, Math.min(1, (hrFrac - 0.5) / 1.2));
        const splanchnicAbsorbMod = 1 - 0.55 * splanchRamp * splanchRamp;
        this.hovorka.splanchnicAbsorbMod = splanchnicAbsorbMod;
        this._lastSplanchnicAbsorbMod = splanchnicAbsorbMod;

        const currentTauG = (carbBase * fiberMod * retentionMod + fatDelay) * hyperMod * exerciseGEMod;

        // --- Fat compartment ODEs ---
        const fatStomachToIntestine = this.fatStomach / currentTauG * dt;
        const fatIntestineAbsorbed = this.fatIntestine / this.TAU_FAT_ABS * dt;
        this.fatStomach = Math.max(0, this.fatStomach - fatStomachToIntestine);
        this.fatIntestine = Math.max(0, this.fatIntestine + fatStomachToIntestine - fatIntestineAbsorbed);

        // Update Hovorka's tau_G dynamically — affects D1→D2 carbohydrate absorption
        this.hovorka.tau_G = currentTauG;

        // Stomach volume empties with the same tau_G (everything is mixed in the same stomach)
        const stomachContentBefore = this.stomachContentGrams;
        const stomachEmptied = stomachContentBefore / currentTauG * dt;
        this.stomachContentGrams = Math.max(0, stomachContentBefore - stomachEmptied);

        // Scale stomach mixture variables proportionally (preserve composition)
        if (stomachContentBefore > 0.001) {
            const ratio = this.stomachContentGrams / stomachContentBefore;
            this.stomachCarbsTotal   *= ratio;
            this.stomachCarbsSimple  *= ratio;
            this.stomachFiber        *= ratio;
            this.stomachRetentionWeight *= ratio;
        }

        // Hysteresis: clear stomachFull when content + queue is below threshold.
        if (this.stomachFull) {
            const stomachCapacity = this.STOMACH_CAPACITY_PER_KG * this.weight;
            const queuedWeight = this.activeIntake.reduce((s, i) => s + i.weightRate * i.remainingMin, 0);
            if (this.stomachContentGrams + queuedWeight < stomachCapacity * this.STOMACH_HYSTERESIS) {
                this.stomachFull = false;
            }
        }

        // --- FFA accumulation from dietary fat (clearance t½ = 180 min) ---
        const ffaClearanceRate = Math.LN2 / this.FFA_CLEARANCE_HALF; // min⁻¹
        const ffaDecay = this.ffaBlood * ffaClearanceRate * dt;
        this.ffaBlood = Math.max(0, this.ffaBlood + fatIntestineAbsorbed - ffaDecay);

        // Hill function: FFA → insulin resistance (pizza effect)
        if (this.ffaBlood > 0.01) {
            const ffaN = Math.pow(this.ffaBlood, this.FFA_HILL_N);
            const ec50N = Math.pow(this.FFA_EC50, this.FFA_HILL_N);
            this.ffaResistanceFactor = 1.0 + this.FFA_RESIST_MAX * ffaN / (ec50N + ffaN);
        } else {
            this.ffaResistanceFactor = 1.0;
        }

        // --- Protein compartment ODEs ---
        // Transit: stomach → gut (shares tau_G with carbohydrates)
        const protStomachToGut = this.proteinStomach / currentTauG * dt;
        this.proteinStomach = Math.max(0, this.proteinStomach - protStomachToGut);
        // Absorption: gut → amino acids (tau_ProtAbs = 90 min)
        const protGutAbsorbed = this.proteinGut / this.TAU_PROT_ABS * dt;
        this.proteinGut = Math.max(0, this.proteinGut + protStomachToGut - protGutAbsorbed);
        // Amino acid pool: absorbed + natural clearance (t½ ~60 min)
        const aaDecay = this.aminoAcidsBlood * this.AA_DECAY_RATE * dt;
        this.aminoAcidsBlood = Math.max(0, this.aminoAcidsBlood + protGutAbsorbed - aaDecay);
        // Glucagon stimulation from amino acids: Hill function
        const aaN = Math.pow(this.aminoAcidsBlood, this.AA_HILL_N);
        const ec50N = Math.pow(this.AA_EC50, this.AA_HILL_N);
        this.proteinGlucagonLevel = this.PROTEIN_GLUCAGON_MAX * aaN / (ec50N + aaN);
    }

    // _processActiveIntake — food drip (S7.5d/e). Drips active meals' physical
    // stomach contributions (fat, protein, weight, carb blend) into the stomach over their
    // eatTimeMin. Called BEFORE _substepFatProteinFFA() each substep. Reads/writes
    // only engine state (activeIntake queue + stomach compartments).
    _processActiveIntake(dt) {
        if (this.activeIntake.length === 0) return;
        for (const intake of this.activeIntake) {
            const consume = Math.min(dt, intake.remainingMin);
            if (consume <= 0) continue;
            this.fatStomach             += intake.fatRate * consume;
            this.proteinStomach         += intake.proteinRate * consume;
            this.stomachContentGrams    += intake.weightRate * consume;
            this.stomachCarbsTotal      += intake.carbsTotalRate * consume;
            this.stomachCarbsSimple     += intake.carbsSimpleRate * consume;
            this.stomachFiber           += intake.fiberRate * consume;
            this.stomachRetentionWeight += intake.retentionWeightRate * consume;
            intake.remainingMin -= consume;
        }
        this.activeIntake = this.activeIntake.filter(i => i.remainingMin > 0.001);
    }

    // --- Stress/HAAF/liver glycogen (S7.5e, moved from simulator.js) ---
    // updateStressHormones orchestrates; calls updateHAAF + updateGlycogenReserve.
    // Reads only engine state + engine constants (HAAF_*, LIVER_GLYCOGEN_*) + hovorka.
    updateStressHormones(simulatedMinutesPassed, stressScale = this.moduleScale('stressResponse')) {
        // --- Exponential washout ---

        // Acute stress (adrenaline/glucagon): half-life ~60 simulated minutes
        // After 60 min, stress level is halved. After 120 min, quartered. Etc.
        const akutHenfaldskonstant = Math.log(2) / 60;
        this.acuteStressLevel *= Math.exp(-akutHenfaldskonstant * simulatedMinutesPassed);

        // Chronic stress (cortisol from illness/sleep deprivation): half-life ~12 hours
        // Much slower decay — illness effects linger for most of the day.
        const kroniskHenfaldskonstant = Math.log(2) / (12 * 60);
        this.chronicStressLevel *= Math.exp(-kroniskHenfaldskonstant * simulatedMinutesPassed);

        // --- Gradual drain of pending chronic stress ---
        // Stress from sleep debt (and future discrete sources) is NOT added
        // directly to chronicStressLevel. Instead it accumulates in
        // _pendingChronicStress and is transferred gradually with time constant tau=30 min.
        // This causes chronicStressLevel to rise smoothly over ~1 hour → no visible
        // discontinuity in the ISF/resistance line on the graph.
        if (this._pendingChronicStress > 0.0005) {
            const drainFraction = 1 - Math.exp(-simulatedMinutesPassed / 30); // tau = 30 min
            const drained = this._pendingChronicStress * drainFraction;
            this.chronicStressLevel = Math.min(1.0, this.chronicStressLevel + drained);
            this._pendingChronicStress -= drained;
        } else if (this._pendingChronicStress > 0) {
            // Remainder below cutoff — transfer it all
            this.chronicStressLevel = Math.min(1.0, this.chronicStressLevel + this._pendingChronicStress);
            this._pendingChronicStress = 0;
        }

        // --- Counter-regulation (glucagon/adrenaline response at low BG) ---
        // The body releases counter-regulatory hormones when BG falls below ~4 mmol/L.
        // The response is graded — stronger the lower BG is.
        //
        // Physiological basis: Cryer 2013 describes thresholds for counter-regulation:
        //   Glucagon: ~3.8 mmol/L, Adrenaline: ~3.8 mmol/L, Cortisol: ~3.2 mmol/L
        //
        // Counter-regulation in T1D:
        // T1D patients have IMPAIRED counter-regulation compared to healthy subjects:
        //   - Glucagon response: lost within 1-5 years (Bengtsen 2021)
        //   - Adrenaline response: preserved but blunted by repeated hypos (HAAF)
        //   - Cap set at 0.4 (vs. ~5.0 in healthy subjects) to reflect this
        //
        // counterRegFactor: reduced continuously based on accumulated hypoArea.
        // See updateHAAF() for details.
        //
        // Clinical significance: This response can produce "Somogyi rebound" —
        // BG rises after a hypoglycaemic episode, especially overnight.
        // But with a massive overdose the response is insufficient.
        if (this.trueBG < 4.0) {
            // Graded response: stronger the lower BG is.
            // T1D patients have only adrenaline (glucagon lost) — WEAK response.
            //
            // IMPORTANT: Cap set low (0.4) so counter-regulation CANNOT save
            // the player from bad decisions. Educational point:
            // hypo IS dangerous in T1D, and the player must learn to avoid it.
            //
            // Time-to-cap calculation (0.4):
            //   BG=3.5: 0.002 + 0.01*0.25 = 0.0045/min → 0.4 in ~89 min
            //   BG=3.0: 0.002 + 0.01*1.0  = 0.012/min  → 0.4 in ~33 min
            //   BG=2.0: 0.002 + 0.01*4.0  = 0.042/min  → 0.4 in ~10 min
            //
            // With cap=0.4 and circadian=0: stressMultiplier max = 1.4 (dawn halved → max ~1.55 with dawn)
            // With active insulin (x3≈1.3): EGP = EGP_0 × max(0, 1.4-1.3) = EGP_0 × 0.1
            // → The liver can barely compensate. Hypo is genuinely dangerous.
            const bgDeficit = 4.0 - this.trueBG;   // 0.0 at BG=4, 2.0 at BG=2
            const baseRate = 0.002 + 0.01 * bgDeficit * bgDeficit;
            // Reduce by counterRegFactor (HAAF — accumulated hypo burden)
            const hypoStressRate = baseRate * this.counterRegFactor;
            this.acuteStressLevel = Math.min(0.4, this.acuteStressLevel + hypoStressRate * simulatedMinutesPassed);
        }

        // Update HAAF (hypoArea accumulation + recovery)
        this.updateHAAF(simulatedMinutesPassed);

        // --- Estimated liver-glycogen capacity: depletion and recovery ---
        // Acute stress and protein terms mirror their blood-side glycogenolysis
        // fractions. Exercise and high-BG recovery are capacity proxies only;
        // see updateGlycogenReserve() for the explicit Q1 boundary.
        this.updateGlycogenReserve(simulatedMinutesPassed, stressScale);

        // --- Muscle glycogen pool moved to the substep loop (2026-06-02) ---
        // updateMuscleGlycogen() is now called per substep in update() with stepDt <= 1 min,
        // so BG drain from resynthesis is integrated smoothly (no single-tick BG spikes
        // at high simulation speed). See note at the call in update().

        // Clamp to zero to prevent floating-point drift below zero
        this.acuteStressLevel = Math.max(0, this.acuteStressLevel);
        this.chronicStressLevel = Math.max(0, this.chronicStressLevel);

        // Update insulin resistance from chronic stress (e.g. sleep deprivation).
        // chronicStressLevel ~0.5 → 25% increased insulin resistance.
        this.insulinResistanceFactor = 1.0 + this.chronicStressLevel * 0.5;
    }

    updateHAAF(simulatedMinutesPassed) {
        const HYPO_DAMAGE_THRESHOLD = 3.0; // mmol/L — below this damage accumulates

        // --- DAMAGE: accumulate hypoArea when BG is below threshold ---
        if (this.trueBG < HYPO_DAMAGE_THRESHOLD) {
            const deficit = HYPO_DAMAGE_THRESHOLD - this.trueBG; // mmol/L below threshold
            this.hypoArea += deficit * simulatedMinutesPassed;   // [mmol·min/L]
        }

        // --- RECOVERY: exponential decay of hypoArea when BG is normal ---
        // Recovery only occurs when BG > 4.0 (no active hypo).
        // During hypo (BG < 4.0) recovery stops — the body cannot "repair"
        // while it is still under stress.
        if (this.trueBG >= 4.0 && this.hypoArea > 0) {
            const recoveryDecay = Math.log(2) / this.HAAF_RECOVERY_HALFLIFE;
            this.hypoArea *= Math.exp(-recoveryDecay * simulatedMinutesPassed);
            // Clamp to 0 to avoid floating-point dust
            if (this.hypoArea < 0.01) this.hypoArea = 0;
        }

        // --- COUNTERREGFACTOR: sigmoid mapping from hypoArea ---
        // 0.3 is the floor (severe HAAF — 70% reduction, never fully 0)
        // 0.7 is the range (from 0.3 to 1.0)
        // HAAF_DAMAGE_SCALE determines how quickly we reach the floor
        this.counterRegFactor = 0.3 + 0.7 * Math.exp(-this.hypoArea / this.HAAF_DAMAGE_SCALE);
    }

    updateGlycogenReserve(simulatedMinutesPassed, stressScale = this.moduleScale('stressResponse')) {
        const dt = simulatedMinutesPassed;

        // --- CONSUMPTION 1: Basal glycogenolysis (normal EGP contribution) ---
        // In the postabsorptive state ~50% of hepatic EGP comes from glycogenolysis.
        // This rate is proportional to EGP_0 and independent of stress.
        // For 70 kg: 1.127 × 0.5 × 0.180 = 0.101 g/min ≈ 6 g/h.
        // NOTE: Only active when glycogen IS present. With an empty pool: EGP falls to 50%.
        const basalGlycogenolysis_gPerMin = this.hovorka.EGP_0 * 0.5 * ENGINE_GLUCOSE_G_PER_MMOL;

        // --- CONSUMPTION 2: Stress-driven extra glycogenolysis ---
        // Acute stress (glucagon/adrenaline) drives ADDITIONAL EGP beyond the basal.
        // The EGP contribution is 60% glycogenolysis + 40% gluconeogenesis
        // (matches effectiveAcuteStress decomposition at line ~1809-1810,
        // where the blood contribution = acuteStress × (0.6 × reserve + 0.4)).
        // ONLY the glycogenolysis component (60%) draws from the glycogen pool;
        // the GNG component (40%) synthesises from amino acids/lactate/glycerol
        // and is independent of the reserve.
        // Ved samlet katekolamindrive=0,4 og 70 kg:
        // 1,127 × 0,4 × 0,6 × 0,180 = 0,0487 g/min ≈ 2,9 g/time.
        // (Previous bug: factor 0.6 was missing → drain 1.67× too high. Review
        // K1 2026-04-30; see docs/reviews/2026-04-30_glycogen-drain-fix.md.)
        // The same stressResponse scalar is used by the blood-side HGP term.
        // Scaling both sides keeps the marginal stress flow internally consistent.
        const totalCatecholamineDrive =
            this.acuteStressLevel + this.exerciseHepaticDrive;
        const stressGlycogenolysis_gPerMin = this.hovorka.EGP_0 * totalCatecholamineDrive
            * stressScale * 0.6 * ENGINE_GLUCOSE_G_PER_MMOL;

        // --- CAPACITY DRAIN 3: Exercise-driven liver-glycogen estimate ---
        // This term estimates how exercise reduces the liver's future glycogen-based
        // response capacity. It is NOT an acute glucose flux into Q1: the current
        // implementation does not add a matching exercise-EGP term to blood.
        // Liver glycogen is estimated to cover ~25% of energy expenditure via carbs.
        // 1 g glycogen ≈ 4 kcal.
        // Medium cardio (7 kcal/min): 7 × 0.25 / 4 = 0.44 g/min ≈ 26 g/h.
        let exerciseCapacityDrain_gPerMin = 0;
        if (this.activeAktivitet) {
            const kcalPerMin = this.activeAktivitet.kcalPerMin || 5;
            const liverGlycogenFraction = 0.25;
            exerciseCapacityDrain_gPerMin = kcalPerMin * liverGlycogenFraction / 4.0;
            // Insulin gate: hepatic glycogenolysis during exercise requires that the liver is not
            // fully suppressed by insulin. x3 (EGP suppression) inhibits the liver's
            // ability to release glycogen — the same mechanism as in the EGP formula.
            // Uses the ratio (stressMultiplier - x3) / stressMultiplier as the gate.
            // At normal basal: x3 < stressMultiplier → gate ≈ 0.5-0.7 (partial, OK)
            // At high bolus-IOB: x3 > stressMultiplier → gate = 0 (liver suppressed)
            // (review 2026-03-22, A6)
            const x3 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x3];
            const sm = this.hovorka.stressMultiplier || 1.0;
            const insulinGate = Math.max(0, sm - x3) / Math.max(0.01, sm);
            exerciseCapacityDrain_gPerMin *= insulinGate;
        }

        // --- CONSUMPTION 4: Protein-glucagon glycogenolysis ---
        // Amino acids from protein meals stimulate glucagon release, which
        // causes the liver to produce glucose via 50% glycogenolysis + 50%
        // gluconeogenesis (matches effectiveProteinGlucagon decomposition at
        // line ~1852-1853, where the blood contribution = proteinGlucagonLevel ×
        // (0.5 + 0.5 × reserve)). ONLY the glycogenolysis component (50%) draws
        // from the glycogen pool; the GNG component (50%) synthesises from
        // amino acids/lactate/glycerol and is independent of the reserve.
        //
        // At peak proteinGlucagonLevel=0.20 (typical 75 g protein meal),
        // 70 kg: 1.127 × 0.20 × 0.5 × 0.180 = 0.0203 g/min ≈ 1.2 g/h.
        // Per protein-rich meal (4 h postprandial): ~2-3 g cumulative drain.
        // (Review K1b 2026-04-30; see docs/reviews/2026-04-30_protein-glucagon-drain-fix.md.)
        const proteinGlycogenolysis_gPerMin = this.hovorka.EGP_0 * this.proteinGlucagonLevel * 0.5 * ENGINE_GLUCOSE_G_PER_MMOL;

        // Scale basal, stress, and protein glycogenolysis by glycogenReserve, so
        // glycogen consumption from the pool matches the actual EGP contribution to blood.
        // Without this scaling the pool depletes faster than physiologically justified:
        // at glycogenReserve=0.5 only 50% glycogenolysis-EGP is delivered to blood,
        // but 100% is drawn from the pool → energy imbalance (review 2026-03-19).
        const scaledBasal = basalGlycogenolysis_gPerMin * this.glycogenReserve;
        const scaledStress = stressGlycogenolysis_gPerMin * this.glycogenReserve;
        const scaledProtein = proteinGlycogenolysis_gPerMin * this.glycogenReserve;
        // The heuristic exercise drain is also scaled by glycogenReserve: an empty
        // estimated reserve cannot lose more capacity.
        // (Review 2026-03-20: missing scaling → consumption from empty pool.)
        const scaledExerciseCapacityDrain = exerciseCapacityDrain_gPerMin * this.glycogenReserve;
        // Total reduction of the estimated glycogen capacity [g/min]. Basal, stress
        // and protein terms mirror blood-side EGP decomposition; exercise does not.
        const totalConsumption = scaledBasal + scaledStress + scaledProtein + scaledExerciseCapacityDrain;

        // --- REPLENISHMENT 1: Gluconeogenesis (constant background) ---
        // The liver synthesises glucose from amino acids, lactate, and glycerol.
        // ~50% of GNG output is delivered directly to blood (as EGP).
        // ~50% can be re-stored as glycogen (only at normal BG, i.e. no deficit).
        // Net replenishment ≈ basal glycogenolysis at steady state → pool stable.
        // During hypo (BG < 4.0): all GNG is used for acute glucose delivery, not storage.
        // GNG is INDEPENDENT of the glycogen reserve — it synthesises from amino acids/lactate/glycerol,
        // not from glycogen. Therefore the unscaled basalGlycogenolysis_gPerMin is used,
        // so the pool can be refilled even when glycogen is empty (review 2026-03-22, A1).
        //
        // --- Insulin gate for glycogen synthesis (codex review 2026-04-07, issue 1) ---
        // Hepatic glycogen synthase (GS) requires insulin signalling via Akt/GSK3β.
        // Without insulin GS remains inactive → the liver cannot store glycogen
        // even at high BG. x3 (Hovorka's hepatic insulin effect) is used as a proxy.
        // Normalised to x3 at typical basal (~0.18 at ISF=3.0). The threshold
        // is scaled by insulinSensitivityScale to match the simulated subject's ISF:
        //   ISF=3.0 → scale=0.80 → threshold=0.12 → x3≈0.18/0.12=1.0 (full synthesis)
        //   ISF=1.5 → scale=0.40 → threshold=0.06 → x3≈0.09/0.06=1.0 (full synthesis)
        // Without scaling ISF=1.5 would give permanently 40% reduced glycogen synthesis.
        // Same pattern as the exercise-glycogenolysis gate (line ~2668).
        const x3synth = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x3];
        const synthThreshold = 0.15 * (this.ISF / 3.75);
        const insulinSynthGate = Math.min(1.0, x3synth / synthThreshold);
        const gngReplenishment = (this.trueBG >= 4.0)
            ? basalGlycogenolysis_gPerMin * insulinSynthGate : 0;

        // --- REPLENISHMENT 2: Postprandial glycogen synthesis ---
        // When BG is elevated (after a meal), the liver stores excess glucose.
        // Requires insulin (insulinSynthGate) — without insulin GNG output is directed
        // to blood (EGP↑) instead of glycogen.
        // At BG=8.0, full insulin: 0.12 × 3.0 = 0.36 g/min ≈ 22 g/h.
        // Gonzalez 2016: ~40-60 g liver glycogen refilled after a large meal.
        // This is a capacity-recovery heuristic: the stored amount is not subtracted
        // from plasma Q1. It must therefore not be described as whole-body mass balance.
        let postprandialStorage = 0;
        if (this.trueBG > 5.0 && this.liverGlycogenGrams < this.LIVER_GLYCOGEN_MAX) {
            const bgExcess = this.trueBG - 5.0;
            postprandialStorage = Math.min(1.0, 0.12 * bgExcess) * insulinSynthGate;
        }

        // --- HEURISTIC CAPACITY ACCOUNTING: update the estimated pool ---
        const totalReplenishment = gngReplenishment + postprandialStorage;
        this.liverGlycogenGrams += (totalReplenishment - totalConsumption) * dt;

        // Clamp to [0, max]
        this.liverGlycogenGrams = Math.max(0, Math.min(this.LIVER_GLYCOGEN_MAX, this.liverGlycogenGrams));

        // --- DERIVED: glycogenReserve for EGP scaling ---
        // Linear scaling: fully effective above threshold, declining below.
        // glycogenReserve = 1.0 when liverGlycogenGrams >= 15 g
        // glycogenReserve → 0.0 when liverGlycogenGrams → 0 g
        // Affects BOTH the basal glycogenolysis fraction (50%) and stress-EGP in stressMultiplier.
        this.glycogenReserve = Math.min(1.0, this.liverGlycogenGrams / this.GLYCOGEN_STRESS_THRESHOLD);
    }

    // _substepGlucagon — active glucagon injection: gradual glycogenolysis (S7.5e).
    // Triangle profile (ramp → peak → 0). Draws from liverGlycogenGrams, adds
    // to plasma Q1 (mass-conserving). Called per substep. Reads only engine state
    // (activeGlucagon, liverGlycogenGrams) + hovorka.
    _substepGlucagon(dt) {
        if (!this.activeGlucagon) return;
        const gl = this.activeGlucagon;
        const tau = this.totalSimMinutes - gl.startTime;

        if (tau >= gl.duration_min || gl.totalRelease_g <= 0) {
            this.activeGlucagon = null;
            return;
        }

        // Triangle shape: rises linearly to peakMin, falls linearly to duration_min
        let shape;
        if (tau < gl.peakMin) {
            shape = tau / gl.peakMin;
        } else {
            const decayWindow = gl.duration_min - gl.peakMin;
            shape = Math.max(0, 1 - (tau - gl.peakMin) / decayWindow);
        }

        // Peak rate set so the integral over the triangle = totalRelease_g.
        const peakRate_gPerMin = 2 * gl.totalRelease_g / gl.duration_min;
        const releaseRate_gPerMin = peakRate_gPerMin * shape;

        // Cap against currently available glycogen pool
        const released_g = Math.min(
            releaseRate_gPerMin * dt,
            Math.max(0, this.liverGlycogenGrams)
        );

        // Mass conservation: draw from liver, add to plasma Q1
        const released_mmol = released_g / ENGINE_GLUCOSE_G_PER_MMOL;
        this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q1] += released_mmol;
        this.liverGlycogenGrams = Math.max(0, this.liverGlycogenGrams - released_g);
        gl.releasedSoFar_g += released_g;
    }

    // --- Dawn/circadian (S7.6a) ---
    // regenerateDawn + circadianKortisolNiveau + circadianISF moved from
    // simulator.js. Reads only engine state (dawn state S2.17, day/timeInMinutes
    // S7.2, sleep/stress) + the campaign flag _campaignDisableDawn. regenerateDawn
    // is called ONLY by circadianKortisolNiveau (on a day change) — the RNG order is
    // unchanged. Sources/detail: docs/MODEL-IMPLEMENTATION.md §8, BG-SCIENCE.md §14.

    // regenerateDawn — generate new dawn parameters on a day change (gaussRand draw).
    regenerateDawn() {
        // Base variation: mean 0.15, std 0.03 (CV ~20%) for the HGP component.
        // The circadian-ISF curve has its own fixed, normalised amplitude; these
        // quantities use different scales and must not be coupled directly.
        // modules.dawnVariability (S9.10): disabled -> fixed amplitude/peak (no
        // gaussRand), so dawn is the same every day. Sleep/stress amplification
        // below is deterministic and is preserved.
        const varScale = this.moduleScale('dawnVariability');
        // S9.12: lerp the random sample toward the fixed mean by the variability scalar.
        // At scale 1 the sample is used directly (sample·1 + mean·0 → bit-identical); at
        // scale 0 the gaussRand is skipped so the rng stream matches the old "off" path.
        let amplitude = varScale > 0
            ? Math.max(0.05, Math.min(0.35, this.gaussRand(0.15, 0.03))) * varScale + 0.15 * (1 - varScale)
            : 0.15;
        // Poor sleep amplifies dawn (+12% per lost hour of sleep)
        amplitude *= 1 + this.lostSleepHoursTonight * 0.12;
        // Chronic stress from the previous day amplifies dawn (+30% at chronicStress=1.0)
        amplitude *= 1 + this.chronicStressLevel * 0.30;
        // Clamp to physiological range
        this._dawnAmplitude = Math.min(0.35, amplitude);
        // Peak time varies: mean 08:00, std 30 min → typically 07:00-09:00
        this._dawnPeakMinutes = varScale > 0
            ? Math.max(6.5 * 60, Math.min(9.5 * 60, this.gaussRand(8 * 60, 30))) * varScale + 8 * 60 * (1 - varScale)
            : 8 * 60;
        this._dawnDay = this.day;
    }

    // circadianKortisolNiveau — dawn phenomenon: morning cortisol → increased HGP.
    // Quarter-sine arc up (4 h before peak) and down (4 h after peak); 0 otherwise.
    get circadianKortisolNiveau() {
        if (this._campaignDisableDawn) return 0;
        // Regenerate dawn parameters on a day change (BEFORE applySleepDebt).
        if (this.day !== this._dawnDay) {
            this.regenerateDawn();
        }
        const amplitude = this._dawnAmplitude * this.moduleScale('dawn'); // S9.12: scale HGP dawn cortisol
        const peakTime = this._dawnPeakMinutes;
        const t = this.timeInMinutes;
        const stigStart = peakTime - 4 * 60;  // rise start
        const falSlut = peakTime + 4 * 60;    // fall end
        if (t >= stigStart && t < peakTime) {
            const fremgang = (t - stigStart) / (peakTime - stigStart); // progress 0→1
            return amplitude * Math.sin(Math.PI / 2 * fremgang);
        } else if (t >= peakTime && t < falSlut) {
            const fremgang = (t - peakTime) / (falSlut - peakTime);   // progress 0→1
            return amplitude * Math.sin(Math.PI / 2 * (1 - fremgang));
        } else {
            return 0;
        }
    }

    // circadianISF — circadian variation in peripheral insulin sensitivity (separate from dawn HGP).
    // Control points (night high, morning nadir 0.70, evening peak) with cosine interpolation.
    // See docs/MODEL-IMPLEMENTATION.md §8, BG-SCIENCE.md §14 for curve + sources.
    get circadianISF() {
        if (this._campaignDisableDawn) return 1.0;
        const t = this.timeInMinutes;
        // The default curve is the documented full swing (0.70–1.20). The dawn
        // module scalar can attenuate both circadian mechanisms for laboratory or
        // campaign use, but daily random HGP amplitude does not rescale ISF.
        const amp = this.moduleScale('dawn');
        if (amp === 0) return 1.0;
        const points = [
            [0,    1.0 + 0.20 * amp],   // midnight
            [240,  1.0 + 0.20 * amp],   // 04:00 — late night
            [480,  1.0 - 0.30 * amp],   // 08:00 — morning nadir
            [840,  1.0],                 // 14:00 — afternoon nominal
            [1140, 1.0 + 0.20 * amp],   // 19:00 — evening peak
            [1440, 1.0 + 0.20 * amp],   // 24:00 — midnight (wraps)
        ];
        let i = 0;
        while (i < points.length - 1 && t >= points[i + 1][0]) i++;
        const [t0, v0] = points[i];
        const [t1, v1] = points[Math.min(i + 1, points.length - 1)];
        if (t1 === t0) return v0;
        const progress = (t - t0) / (t1 - t0);
        const smoothProgress = (1 - Math.cos(Math.PI * progress)) / 2;
        return v0 + (v1 - v0) * smoothProgress;
    }

    // currentISF — effective insulin sensitivity (S7.6a): base ISF x circadian x
    // vasodilation x exercise-sensitivity boost / resistance factors.
    // Sets _lastPeisFactor and _lastExerciseSensitivityComponents.
    // Uses the engine-owned ENGINE_EXERCISE_* PEIS constants (see the doc block at
    // the top of this file and docs/MODEL-IMPLEMENTATION.md).
    get currentISF() {
        // Three insulin-MEDIATED components: fast (acute synergy, t½=15 min),
        // early (glycogen-coupled, t½=4 h) and late (AS160, t½=18 h).
        // Insulin-independent contraction uptake is NOT included here; Hovorka E1
        // owns that separate flux. Components sum across active/recent sessions.
        //
        // EARLY phase (Wojtaszewski 2000, ~1-4 h post): glycogen-permissive.
        //   earlyBoost = A_early × (1 - muscleGlycogenReserve)
        //   CHO feeding refills the pool → reverses quickly (hours).
        //
        // LATE phase (Mikines 1988, Cartee 2015, ~24-48 h post): AS160-mediated.
        //   lateBoost = A_late × 0.5^(t_post / 18 h)
        //   Exponential decay, NOT glycogen-coupled. Not reversed by CHO.
        //   Persists overnight after evening exercise → drives nocturnal hypo (Riddell 2017).
        let totalBoost = 0;
        const componentTotals = { fast: 0, early: 0, late: 0 };

        // slowEmptyFactor: 0 at full pool, 1 at empty pool — scales EARLY for ALL sessions.
        //
        // DELIBERATE DESIGN: Early-amplitude is COUPLED to the current muscle glycogen
        // state, not to the individual session's historical state. A session that
        // could not contribute when the pool was full can therefore "wake up" when a later
        // activity drains the pool again. This reflects Wojtaszewski's permissive
        // glycogen role for the early phase. The late component, by contrast, has its OWN
        // session-specific decay — it does not wake up again.
        const slowEmptyFactor = 1 - this.muscleGlycogenReserve;

        // Active and completed sessions use the SAME delayed rectangular response.
        // stopActivity() only freezes duration; it never creates an amplitude.
        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes >= motion.sensitivityEndTime) return;
            const ageMin = this.totalSimMinutes - motion.startTime;
            if (!(ageMin > 0)) return;

            const exposureDuration = motion.duration == null
                ? ageMin
                : motion.duration;
            if (!(exposureDuration > 0)) return;

            const fastSensitivityScale = motion.fastSensitivityScaling || 0;
            const earlySensitivityScale = motion.earlySensitivityScaling || 0;
            const lateSensitivityScale = motion.lateSensitivityScaling || 0;
            if (!(fastSensitivityScale > 0 ||
                  earlySensitivityScale > 0 ||
                  lateSensitivityScale > 0)) return;

            const durationFactor = Math.min(
                Math.sqrt(exposureDuration / 60),
                1.5
            );
            const onsetGate = exerciseSensitivityOnsetGate(
                ageMin,
                motion.insulinSensitivityOnsetHalfMin || 0
            );

            const fastResponse = exerciseRectangularResponse(
                ageMin,
                motion.duration,
                ENGINE_EXERCISE_FAST_TAU_ACTIVATION_MIN,
                ENGINE_EXERCISE_FAST_HALFLIFE_MIN
            );
            const fastBoost =
                (ENGINE_EXERCISE_FAST_BASE_AMPLITUDE[motion.intensity] || 0) *
                fastSensitivityScale * durationFactor * fastResponse * onsetGate;
            totalBoost += fastBoost;
            componentTotals.fast += fastBoost;

            const earlyResponse = exerciseRectangularResponse(
                ageMin,
                motion.duration,
                ENGINE_EXERCISE_EARLY_TAU_BUILDUP_MIN,
                ENGINE_EXERCISE_EARLY_HALFLIFE_MIN
            );
            const earlyBoost =
                (ENGINE_EXERCISE_EARLY_BASE_AMPLITUDE[motion.intensity] || 0) *
                earlySensitivityScale * durationFactor * earlyResponse *
                slowEmptyFactor * onsetGate;
            totalBoost += earlyBoost;
            componentTotals.early += earlyBoost;

            const lateResponse = exerciseRectangularResponse(
                ageMin,
                motion.duration,
                ENGINE_EXERCISE_LATE_TAU_BUILDUP_MIN,
                ENGINE_EXERCISE_LATE_HALFLIFE_MIN
            );
            const lateBoost =
                (ENGINE_EXERCISE_LATE_BASE_AMPLITUDE[motion.intensity] || 0) *
                lateSensitivityScale * durationFactor * lateResponse * onsetGate;
            totalBoost += lateBoost;
            componentTotals.late += lateBoost;
        });

        // Relaxation vasodilation is the only active-session modifier handled
        // outside the session response above.
        let vasodilatationFaktor = 1.0;
        if (this.activeAktivitet) {
            const akt = this.activeAktivitet;
            const typeDef = akt.typeDef;
            // Relaxation vasodilation — mild ISF improvement DURING the activity.
            // Peripheral vasodilation increases blood flow → insulin acts slightly better.
            const vasoDil = typeof typeDef.vasodilatation === 'object'
                ? (typeDef.vasodilatation[akt.intensitet] || 0)
                : (typeDef.vasodilatation || 0);
            if (vasoDil > 0) {
                vasodilatationFaktor = 1.0 + vasoDil; // e.g. 1.03 = 3% better ISF
            }
        }

        // Final ISF = base ISF × circadian factor × vasodilation × exercise boost / resistance factors
        // circadianISF < 1.0 in the morning → lower ISF → insulin acts less effectively
        // circadianISF > 1.0 in the evening → higher ISF → insulin acts more effectively
        // insulinResistanceFactor > 1.0 under stress → divided → lower ISF → insulin less effective
        // ffaResistanceFactor > 1.0 after a fatty meal → divided → lower ISF ("second wave")
        // glucotoxicResistanceFactor > 1.0 under sustained hyperglycaemia → divided → lower ISF
        // sensitivityIncreaseFactor > 1.0 after exercise → multiplied → higher ISF → insulin more effective
        // Combined resistance cap: prevents unrealistic combination of simultaneous extremes.
        // Individual max: stress 1.50, FFA 1.42, glucotox 1.40 → product up to ~3.0.
        // Cap 2.5 ensures effective ISF never falls below ~40% of nominal.
        // modules.ffaResistance (S9.11): off -> FFA still accumulates but applies no
        // insulin resistance (factor forced neutral). FFA-driven gastric slowing still
        // belongs to the fatProtein module, not here.
        // S9.12: each resistance factor is lerped from neutral (1.0) toward its full
        // value by the matching module scalar — 1 + (factor − 1)·scale. At the default
        // scale 1 this is exactly the factor (Sterbenz: factors live in [1, ~1.5]); at
        // scale 0 it collapses to 1.0 (neutral), matching the old module-off path. The
        // stress ISF effect (insulinResistanceFactor) scales with the stressResponse
        // module here; its HGP effect is scaled in the substep loop.
        const ffaResist = 1.0 + (this.ffaResistanceFactor - 1.0) * this.moduleScale('ffaResistance');
        const stressResist = 1.0 + (this.insulinResistanceFactor - 1.0) * this.moduleScale('stressResponse');
        const glucotoxResist = 1.0 + (this.glucotoxicResistanceFactor - 1.0) * this.moduleScale('glucotoxicity');
        const combinedResistance = Math.min(2.5,
            stressResist * ffaResist * glucotoxResist);
        // Cap combined exercise boost to avoid unrealistic stacking of sessions
        const sensitivityIncreaseFactor = Math.min(ENGINE_EXERCISE_SENS_CAP, 1 + totalBoost);
        // #6: expose the PEIS factor as a side-effect so update() can apply it
        // as a muscle EC50 shift (instead of gain scaling) in hovorka.setInsulinModifiers.
        this._lastPeisFactor = sensitivityIncreaseFactor;
        this._lastExerciseSensitivityComponents = componentTotals;
        return (this.ISF * this.circadianISF * vasodilatationFaktor * sensitivityIncreaseFactor)
            / combinedResistance;
    }

    // currentCarbEffect — how much 1 g carbohydrate raises BG (= currentISF/ICR).
    get currentCarbEffect() { return this.currentISF / this.ICR; }

    // basalPlasmaInsulinBaseline — LIVE basal plasma insulin [mU] = state[15] × V_I,
    // i.e. the plasma insulin that derives from basal input (shadow cascade Ib).
    // Exact due to the linearity of the Hovorka system in input. Used by the read API and
    // the insulin band's rapid/basal separation.
    get basalPlasmaInsulinBaseline() {
        return this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib] * this.hovorka.V_I;
    }

    // _computeCgmBG — compute and set cgmBG from interstitial glucose + sensor
    // imperfections (S7.7): proportional noise, slow drift, discontinuities,
    // compression. Interstitial lag comes from Hovorka's C compartment
    // (hovorka.cgmValue). noiseEnabled=false gives a clean interstitial signal.
    // Returns { previousCgmBG, interstitialBG, discontinuity } for the facade's
    // self-test / jump detection. Orchestration (sampling gating, graph, audio,
    // self-test, sensor status) remains on the facade.
    _computeCgmBG() {
        // Interstitial glucose from Hovorka's C compartment — already delayed
        // relative to plasma via the ODE dC = ka_int*(G-C).
        const interstitialBG = this.hovorka.cgmValue;

        // Proportional random noise (Box-Muller), scales with BG level.
        const gaussianNoise = this.gaussRand(0, 1);
        const noiseStd = interstitialBG * this.cgmNoiseScale;
        const randomNoise = this.noiseEnabled ? gaussianNoise * noiseStd : 0;

        // Slow sine-wave drift (sensor characteristic, period 4-8 hours)
        let systemicDeviation = this.noiseEnabled
            ? Math.sin(2 * Math.PI * this.totalSimMinutes / this.cgmSystemicPeriod) * this.cgmSystemicAmplitude
            : 0;

        // Discontinuities — occasional jumps (~0.7/day, ±2 mmol/L)
        let discontinuity = 0;
        if (this.noiseEnabled && this.rng() < this.cgmDiscontinuityChance) {
            discontinuity = (this.rng() - 0.5) * 4.0;
        }

        // Compression low: sensor pressure → falsely low CGM, fades in/out.
        let compressionDeviation = 0;
        if (this.totalSimMinutes < this.cgmCompressionUntil) {
            const elapsed = Math.max(0, this.totalSimMinutes - this.cgmCompressionStart);
            const remaining = Math.max(0, this.cgmCompressionUntil - this.totalSimMinutes);
            const fadeIn = Math.min(1, elapsed / 10);
            const fadeOut = Math.min(1, remaining / 15);
            compressionDeviation = -this.cgmCompressionDrop * Math.min(fadeIn, fadeOut);
        }

        // Combine + clamp to sensor range (2.2-30.0 mmol/L)
        const previousCgmBG = this.cgmBG;
        this.cgmBG = interstitialBG + randomNoise + systemicDeviation + discontinuity + compressionDeviation;
        this.cgmBG = Math.max(2.2, Math.min(30.0, this.cgmBG));
        return { previousCgmBG, interstitialBG, discontinuity };
    }

    // getCgmSensorStatus — current CGM sensor state based on engine-owned timers.
    // 'offline' | 'warmup' | 'checking' | 'active'. Pure read, no mutation.
    getCgmSensorStatus() {
        if (!this.modules.cgmSensorFaults) return 'active'; // S9.10: faults off -> sensor never offline/warming/checking
        if (this.totalSimMinutes < this.cgmSensorOfflineUntil) return 'offline';
        if (this.totalSimMinutes < this.cgmSensorWarmupUntil) return 'warmup';
        if (this.totalSimMinutes < this.cgmSelfTestUntil) return 'checking';
        return 'active';
    }

    // startCgmSelfTest — short CGM self-test ("checking") without the sensor falling
    // off. Models situations where the CGM signal looks implausible (very fast drop,
    // large sensor noise, an isolated point that does not fit its neighbours). Engine-
    // owned core state transition (S9.7): sets the timers + status and emits
    // 'cgm-self-test-started'. The Simulator facade adds the player-facing floating
    // label/log by reacting to that event, so the engine carries no UI. No-op unless
    // the sensor is currently active (cannot self-test while offline/warming up).
    startCgmSelfTest(durationMinutes = 20) {
        if (!this.modules.cgmSensorFaults) return; // S9.10: faults off -> no-op
        if (this.getCgmSensorStatus() !== 'active') return;
        this.cgmSelfTestStart = this.totalSimMinutes;
        this.cgmSelfTestUntil = this.totalSimMinutes + Math.max(5, durationMinutes);
        this.cgmAutoSelfTestCooldownUntil = this.totalSimMinutes + 360;  // 6 h before next auto self-test
        this.cgmSensorStatus = 'checking';
        this.emitEvent('cgm-self-test-started', { durationMinutes });
    }

    // startCgmSensorLoss — simulate the CGM sensor being knocked loose/falling off:
    // an offline window, then a warmup window before it streams data again. Engine-
    // owned core state transition (S9.7): sets the timers + status and emits
    // 'cgm-sensor-lost'. The facade adds the floating label/log via that event.
    startCgmSensorLoss(offlineMinutes = 45, warmupMinutes = 60) {
        if (!this.modules.cgmSensorFaults) return; // S9.10: faults off -> no-op
        const offline = Math.max(5, offlineMinutes);
        const warmup = Math.max(15, warmupMinutes);
        this.cgmSensorOfflineStart = this.totalSimMinutes;
        this.cgmSensorOfflineUntil = this.totalSimMinutes + offline;
        this.cgmSensorWarmupStart = this.cgmSensorOfflineUntil;
        this.cgmSensorWarmupUntil = this.cgmSensorOfflineUntil + warmup;
        this.cgmSelfTestUntil = -Infinity;
        this.cgmSensorStatus = 'offline';
        this.emitEvent('cgm-sensor-lost', { offlineMinutes: offline, warmupMinutes: warmup });
    }

    // _sampleCgm — 5-min CGM sampling gate (S8-C2). When >= 5 sim-min have passed since
    // the last sample: update sensor status + lastCgmCalculationTime, and — if the sensor
    // is active — compute a new cgmBG signal via _computeCgmBG (rng). Returns null
    // if the gate did not fire; otherwise { active, previousCgmBG, interstitialBG,
    // discontinuity } so the facade can push to the graph, play audio, and trigger self-test.
    // Also emits 'cgm-sample' with the same data (used when step() runs engine-internally).
    _sampleCgm() {
        if (this.totalSimMinutes - this.lastCgmCalculationTime < 5) return null;
        this.cgmSensorStatus = this.getCgmSensorStatus();
        this.lastCgmCalculationTime = this.totalSimMinutes;

        // When the sensor is offline/warming up/self-testing: no new CGM reading (trueBG
        // continues; fingerstick can still be used).
        if (this.cgmSensorStatus !== 'active') {
            this.emitEvent('cgm-sample', { active: false, trueBG: this.trueBG });
            return { active: false };
        }

        const { previousCgmBG, interstitialBG, discontinuity } = this._computeCgmBG();
        this.emitEvent('cgm-sample', {
            active: true, cgmBG: this.cgmBG, trueBG: this.trueBG,
            previousCgmBG, interstitialBG, discontinuity
        });

        // Auto self-test trigger (S9.7, engine-owned): when the freshly computed
        // signal looks implausible — a large jump vs. the previous reading, or a big
        // true-vs-interstitial lag combined with a discontinuity — the sensor may
        // briefly enter "checking" mode. Rare and rate-limited (25% chance, 6 h
        // cooldown). Drawing the rng here (right after _computeCgmBG, the step's last
        // rng consumer) keeps the rng stream position identical to when this lived in
        // the facade's cgm-sample handler. startCgmSelfTest emits 'cgm-self-test-started'
        // for the facade's label/log.
        const cgmJump = Math.abs(this.cgmBG - previousCgmBG);
        const cgmLag = Math.abs(this.trueBG - interstitialBG);
        const selfTestCandidate = cgmJump > 3.0 || (cgmLag > 2.5 && Math.abs(discontinuity) > 1.0);
        // modules.cgmSensorFaults (S9.10) gates the whole trigger first, so faults-off
        // also skips the rng draw (no self-test, deterministic-friendly sensor).
        if (this.modules.cgmSensorFaults
            && selfTestCandidate
            && this.totalSimMinutes > this.cgmAutoSelfTestCooldownUntil
            && this.rng() < 0.25) {
            this.startCgmSelfTest(15 + this.rng() * 15);
        }

        return { active: true, previousCgmBG, interstitialBG, discontinuity };
    }

    // =========================================================================
    // READ API — external output (S8 Phase B)
    // =========================================================================
    // Curated readings of engine state for UI, dashboards, and external tools.
    // Pure derivations (no mutation, no RNG). exportState()/importState() are
    // the full serialisation snapshot; these are readable excerpts.

    // getState — compact numeric core state for lightweight external reads.
    getState() {
        return {
            trueBG: this.trueBG,
            cgmBG: this.cgmBG,
            iob: this.iob,
            displayIOB: this.displayIOB,
            cob: this.cob,
            basalInsulinRate: this.basalInsulinRate,
            ketoneLevel: this.ketoneLevel,
            acidosisLoad: this.acidosisLoad,
            brainEnergyDeficit: this.brainEnergyDeficit,
            weightChangeKg: this.weightChangeKg,
            liverGlycogenGrams: this.liverGlycogenGrams,
            muscleGlycogenReserve: this.muscleGlycogenReserve,
            currentISF: this.currentISF,
            totalSimMinutes: this.totalSimMinutes,
            day: this.day,
            timeInMinutes: this.timeInMinutes,
        };
    }

    // getFluxSnapshot — BG flux/modifier decomposition (up/down forces sorted
    // by magnitude). Same data structure as the effect panel uses.
    getFluxSnapshot() {
        return this._computeBGForces();
    }

    // getPhysiologySnapshot — Complete object with all physiological variables grouped
    // by category (insulin, food, stress, liver, ketones, exercise, brain,
    // sensitivity, BG, time). Used by the physiology dashboard and effect panel.
    getPhysiologySnapshot() {
        return {
            // BG forces sorted by magnitude (for the effect panel)
            forces: this._computeBGForces(),

            // Insulin compartments and effect variables
            insulin: {
                bolusIOB: this.iob,
                basalRate: this.basalInsulinRate,
                plasmaInsulin: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] * this.hovorka.V_I,   // I × V_I [mU]
                basalPlasmaBaseline: this.basalPlasmaInsulinBaseline || 0, // basal steady-state [mU]
                x1: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x1],   // insulin effect: transport
                x2: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x2],   // insulin effect: disposal
                x3: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x3],   // insulin effect: EGP suppression
            },

            // Food absorption and macronutrients
            food: {
                carbAbsorption: this.hovorka._lastUG || 0,   // current carbohydrate absorption [mmol/min]
                carbsInStomach: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.D1],       // D1 [mmol]
                carbsInGut: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.D2],           // D2 [mmol]
                hyperGEMod: this._lastHyperMod || 1,         // hyperglycaemia GE modifier (1.0 = no effect)
                exerciseGEMod: this._lastExerciseGEMod || 1, // exercise GE modifier (1.0 = rest, max 1.35)
                splanchnicAbsorbMod: this._lastSplanchnicAbsorbMod || 1, // splanchnic absorption (1.0 = rest, min 0.45)
                proteinGlucagonLevel: this.proteinGlucagonLevel,
                ffaBlood: this.ffaBlood,
            },

            // Stress hormones and counter-regulation
            stress: {
                acute: this.acuteStressLevel,
                exerciseHepaticDrive: this.exerciseHepaticDrive,
                chronic: this.chronicStressLevel,
                circadian: this.circadianKortisolNiveau,
                counterReg: this.counterRegFactor,
            },

            // Liver and glycogen reserves
            liver: {
                glycogen: this.liverGlycogenGrams,
                egp: this.hovorka._lastEGP || 0,
            },

            // Ketones and acidosis
            ketones: {
                bhb: this.ketoneLevel,
                acidosisLoad: this.acidosisLoad,
                ffaLipolysis: this.ffaLipolysis,
            },

            // Exercise and heart rate
            exercise: {
                heartRate: this.smoothHeartRate,
                e1: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.E1],   // short-term exercise effect
                e2: this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.E2],   // long-term exercise effect
            },

            // Brain energy
            brain: {
                energyDeficit: this.brainEnergyDeficit,
                f01c: this.hovorka._lastF01c || 0,
            },

            // Insulin sensitivity and modifiers
            sensitivity: {
                currentISF: this.currentISF,
                baseISF: this.ISF,
                circadianISF: this.circadianISF,
                ffaResistanceFactor: this.ffaResistanceFactor,
                glucotoxicResistanceFactor: this.glucotoxicResistanceFactor,
                glucotoxicLoad: this.glucotoxicLoad,
                insulinResistanceFactor: this.insulinResistanceFactor,
                exerciseFactor: this.hovorka._lastExerciseFactor || 1,
            },

            // Blood glucose
            bg: {
                trueBG: this.trueBG,
                cgmBG: this.cgmBG,
            },

            // Time
            time: {
                totalMinutes: this.totalSimMinutes,
                day: this.day,
                timeInDay: this.totalSimMinutes % 1440,
            },
        };
    }

    // _computeBGForces — the individual physiological forces pulling BG up
    // or down, sorted by magnitude. Educational causal display for the effect panel
    // (arrows with direction + strength). Most rows are actual glucose fluxes
    // (mmol/min) from Hovorka; insulin is shown as a combined insulin effect.
    _computeBGForces() {
        const forces = [];

        // --- UP forces (raise BG) ---

        // Food absorption — carbohydrates from the gut (UG flux)
        const ug = this.hovorka._lastUG || 0;
        if (ug > 0.01) {
            forces.push({ name: 'carbAbsorption', direction: 'up', magnitude: ug, kind: 'flux' });
        }

        // Hepatic production (EGP) — combined as ONE force with the dominant cause in parentheses.
        // Actual EGP = EGP_0 × max(0, stressMultiplier - x3). stressMultiplier =
        // 1.0 (base) + stress + dawn + protein. Cause = largest non-base component.
        const actualEGP = this.hovorka._lastEGP || 0;
        if (actualEGP > 0.01) {
            const acuteStress = this.acuteStressLevel;
            const exerciseDrive = this.exerciseHepaticDrive;
            const chronicStress = this.chronicStressLevel;
            const dawn = this.circadianKortisolNiveau;
            const protein = this.proteinGlucagonLevel;

            // Find the dominant extra cause (the one with the largest contribution to stressMultiplier)
            const causes = [
                { key: 'dawn',    val: dawn },
                { key: 'exercise', val: exerciseDrive },
                { key: 'acute',   val: acuteStress },
                { key: 'chronic', val: chronicStress },
                { key: 'protein', val: protein },
            ];
            const dominant = causes.reduce((a, b) => b.val > a.val ? b : a);

            // Only show cause if the dominant component is noticeable (> 5% of base)
            let cause = null;
            if (dominant.val > 0.05) {
                if (dominant.key === 'dawn')    cause = 'dawn';
                if (dominant.key === 'exercise') cause = 'stress';
                if (dominant.key === 'acute')   cause = 'stress';
                if (dominant.key === 'chronic') cause = 'sleep';
                if (dominant.key === 'protein') cause = 'protein';
            }

            forces.push({ name: 'egp', direction: 'up', magnitude: actualEGP, cause: cause, kind: 'flux' });
        }

        // FFA resistance — fat reduces insulin effectiveness → BG rises (modifier).
        if (this.moduleScale('ffaResistance') > 0 && this.ffaResistanceFactor > 1.01) {
            const ffaFlux = (this.ffaResistanceFactor - 1.0) * this.hovorka.EGP_0 * 0.3;
            forces.push({ name: 'ffaResistance', direction: 'up', magnitude: ffaFlux, kind: 'modifier' });
        }

        // Glucotoxicity — sustained high BG → insulin acts less effectively (modifier).
        if (this.glucotoxicResistanceFactor > 1.01) {
            const gtoxFlux = (this.glucotoxicResistanceFactor - 1.0) * this.hovorka.EGP_0 * 0.5;
            forces.push({ name: 'glucotoxicity', direction: 'up', magnitude: gtoxFlux, kind: 'modifier' });
        }

        // --- DOWN forces (lower BG) ---

        // Insulin — combined effect on BG: net Q1 transport + peripheral disposal (x2*Q2)
        // + inhibited endogenous glucose production (x3). The x3 component is "avoided
        // upward flux", but in the net model balance it is part of insulin's BG-lowering effect.
        const Q1 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q1] || 1;
        const Q2 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q2] || 0;
        const x1 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x1] || 0;
        const x2 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x2] || 0;
        const x3 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.x3] || 0;
        const exFactor = this.hovorka._lastExerciseFactor || 1;
        const k12Q2 = this.hovorka.k_12 * Q2;
        const netPlasmaTransport = Math.max(0, exFactor * x1 * Q1 - k12Q2);
        const peripheralDisposal = Math.max(0, exFactor * x2 * Q2);
        const stressMultiplier = Math.max(0, this.hovorka.stressMultiplier || 1);
        const hepaticSuppression = this.hovorka.EGP_0 * Math.min(Math.max(0, x3), stressMultiplier);
        const insulinEffectFlux = netPlasmaTransport + peripheralDisposal + hepaticSuppression;

        if (insulinEffectFlux > 0.001) {
            // Basal/rapid attribution: state[15] (Ib) is basal plasma insulin.
            const totalPlasmaI = Math.max(this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] || 0, 0.01); // mU/L
            const basalPlasmaI = Math.min(Math.max(this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Ib] || 0, 0), totalPlasmaI);
            const basalFrac = basalPlasmaI / totalPlasmaI;

            const basalFlux = insulinEffectFlux * basalFrac;
            const bolusFlux = insulinEffectFlux * (1 - basalFrac);

            if (basalFlux > 0.001) {
                forces.push({ name: 'basalInsulin', direction: 'down', magnitude: basalFlux, kind: 'flux' });
            }
            if (bolusFlux > 0.001) {
                forces.push({ name: 'bolusInsulin', direction: 'down', magnitude: bolusFlux, kind: 'flux' });
            }
        }

        // Muscle uptake (exercise) — direct insulin-independent uptake during activity.
        const e1 = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.E1] || 0;
        const exerciseDirectUptake = this.hovorka.beta * e1;
        if (exerciseDirectUptake > 0.001) {
            forces.push({ name: 'exerciseUptake', direction: 'down', magnitude: exerciseDirectUptake, kind: 'flux' });
        }

        // Brain consumption — F01c flux (mmol/min), always active
        const f01c = this.hovorka._lastF01c || 0;
        if (f01c > 0.001) {
            forces.push({ name: 'brainConsumption', direction: 'down', magnitude: f01c, kind: 'flux' });
        }

        // Renal excretion — FR flux (mmol/min), only when BG > renal threshold
        const fr = this.hovorka._lastFR || 0;
        if (fr > 0.001) {
            forces.push({ name: 'renalExcretion', direction: 'down', magnitude: fr, kind: 'flux' });
        }

        // Sort by magnitude (largest first)
        forces.sort((a, b) => b.magnitude - a.magnitude);
        return forces;
    }

    // =========================================================================
    // INTERVENTIONS — external input API (S8 Phase A)
    // =========================================================================
    // Pure physiological interventions: food, insulin, exercise, glucagon. NO
    // game/campaign/DOM logic — that stays on the Simulator facade, which calls
    // these and translates the emitted events into audio/log/popup. Catalogue lookups
    // (CARB_TYPES, AKTIVITETSTYPER, estimateEatTimeMin) happen in the facade; the resolved
    // values are passed in so the engine never reads globals. `onAccept` is an optional
    // facade hook called AFTER an optional rejection gate, but BEFORE side-effects —
    // so the facade can insert its game bookkeeping (recordAction, handleNightIntervention)
    // at exactly the old position, and the RNG/event order remains bit-identical.
    // External callers omit onAccept.

    // addFood — register a meal. Returns false if the stomach is full.
    // spec: { carbs, protein, fat, weight, eatTimeMin, carbParams, icon }. carbParams
    // = { simpleFraction, fiberPerGram, retentionFactor } (default mixed). Stomach
    // capacity check (hysteresis) happens BEFORE onAccept; if the stomach is full,
    // 'stomach-full' is emitted and false is returned without side-effects.
    addFood(spec = {}, onAccept) {
        // Validate explicitly provided macros/fields (S9.9) BEFORE the `|| 0` fallback, otherwise
        // e.g. NaN would silently collapse to 0. Omitted fields -> 0/heuristic as before.
        if (spec.carbs != null) requireNumber(spec.carbs, 'food.carbs', { min: 0, max: 1000 });
        if (spec.protein != null) requireNumber(spec.protein, 'food.protein', { min: 0, max: 1000 });
        if (spec.fat != null) requireNumber(spec.fat, 'food.fat', { min: 0, max: 1000 });
        if (spec.weight != null) requireNumber(spec.weight, 'food.weight', { min: 0, max: 5000 });
        if (spec.eatTimeMin != null) requireNumber(spec.eatTimeMin, 'food.eatTimeMin', { min: 0, max: 600 });

        // carbParams is optional as a whole (omitted -> calibrated mixed defaults),
        // but when supplied all three fields are required. The upper bounds are broad
        // API safety limits, not calibration targets: fiber/digestible-carb can exceed
        // 1 for vegetables, while all catalogue retention factors currently lie <= 1.
        let carbParams = { simpleFraction: 0.20, fiberPerGram: 0.08, retentionFactor: 1.0 };
        if (spec.carbParams != null) {
            if (typeof spec.carbParams !== 'object' || Array.isArray(spec.carbParams)) {
                throw new TypeError("PhysiologyEngine: 'food.carbParams' must be an object");
            }
            carbParams = {
                simpleFraction: requireNumber(
                    spec.carbParams.simpleFraction, 'food.carbParams.simpleFraction', { min: 0, max: 1 }),
                fiberPerGram: requireNumber(
                    spec.carbParams.fiberPerGram, 'food.carbParams.fiberPerGram', { min: 0, max: 10 }),
                retentionFactor: requireNumber(
                    spec.carbParams.retentionFactor, 'food.carbParams.retentionFactor', { min: 0, max: 10 }),
            };
        }

        const carbs = spec.carbs || 0;
        // modules.fatProtein (S9.11): off -> treat meals as carbs-only (drop fat/protein,
        // so no pizza-effect gastric slowing, no FFA resistance, no protein-glucagon). When
        // off, foodWeight ignores spec.weight (which would include the fat/protein mass).
        const protein = this.modules.fatProtein ? (spec.protein || 0) : 0;
        const fat = this.modules.fatProtein ? (spec.fat || 0) : 0;
        const foodWeight = (this.modules.fatProtein && spec.weight > 0) ? spec.weight : (carbs + protein + fat);
        // eatTime: the facade sends the resolved eating time (estimateEatTimeMin); otherwise
        // weight heuristic as standalone fallback. Clamp >= 0.1 as before.
        let eatTime = (spec.eatTimeMin != null && spec.eatTimeMin > 0)
            ? spec.eatTimeMin
            : Math.max(0.5, Math.min(10, foodWeight / 50));
        eatTime = Math.max(0.1, eatTime);
        // Stomach capacity check with hysteresis (gate BEFORE onAccept/side-effects).
        // Includes both current stomach content AND what is already queued
        // (activeIntake), so rapid double-clicks cannot overfill the stomach.
        const stomachCapacity = this.STOMACH_CAPACITY_PER_KG * this.weight;
        const queuedWeight = this.activeIntake.reduce((sum, i) => sum + i.weightRate * i.remainingMin, 0);
        if (this.stomachFull || this.stomachContentGrams + queuedWeight + foodWeight > stomachCapacity) {
            this.stomachFull = true;
            this.emitEvent('stomach-full');
            return false;
        }

        // Game bookkeeping inserted here (facade hook), at the same position as before.
        if (onAccept) onAccept();
        this.registerNightIntervention(); // night-time eating costs sleep (S9.8)

        const foodKcal = (carbs * 4) + (protein * 4) + (fat * 9);
        this.totalKcalConsumed += foodKcal;
        this.emitEvent('food-added', { carbs, protein, fat, kcal: foodKcal, icon: spec.icon });

        // activeFood: the carbRate mechanism in step() feeds Hovorka D1 over eatTime.
        this.activeFood.push({ carbs, protein, fat, startTime: this.totalSimMinutes, eatingDuration: eatTime });
        // activeIntake queue: _processActiveIntake() drips the physical stomach contributions
        // (fat/protein/weight/carb blend) gradually over eatTime → smooth tau_G.
        this.activeIntake.push({
            remainingMin: eatTime,
            proteinRate:         protein / eatTime,
            fatRate:             fat / eatTime,
            weightRate:          foodWeight / eatTime,
            carbsTotalRate:      carbs / eatTime,
            carbsSimpleRate:     (carbs * carbParams.simpleFraction) / eatTime,
            fiberRate:           (carbs * carbParams.fiberPerGram) / eatTime,
            retentionWeightRate: (foodWeight * carbParams.retentionFactor) / eatTime,
        });
        this.emitEvent('food-sound');
        return true;
    }

    // addRapidInsulin — rapid-acting (bolus) insulin.
    // @param {object} spec        { units: dose [U] }
    // @param {function} onAccept  optional callback after acceptance, before side-effects
    //                             (facade hook; all interventions share this pattern).
    // Randomised PK per injection (Heinemann 2002): session-wide bioavailability
    // + per-bolus tauFactor (gaussRand, CV 25%, clamp 0.50-1.60). The full dose
    // is deposited into the bolus' own s1 at the next step (_prepInsulinRates). Resets
    // the DKA warning (insulin addresses the cause). No gate.
    addRapidInsulin(spec = {}, onAccept) {
        requireNumber(spec.units, 'rapidInsulin.units', { min: 0, max: 100 }); // validate before any side effect/RNG (S9.9)
        const units = spec.units;
        if (onAccept) onAccept();
        this.registerNightIntervention(); // night-time bolus costs sleep (S9.8)
        this.emitEvent('fast-insulin-added', { dose: units });
        const bioavailability = this.sessionBioavFast;
        // modules.insulinVariability (S9.10): off -> fixed PK (tauFactor 1.0, no gaussRand).
        // S9.12: lerp the random tau factor toward the fixed 1.0 by the scalar; at scale 1
        // the clamped sample is used directly (bit-identical), at scale 0 gaussRand is skipped.
        const ivScaleFast = this.moduleScale('insulinVariability');
        const tauFactor = ivScaleFast > 0
            ? Math.max(0.50, Math.min(1.60, this.gaussRand(1.0, 0.25))) * ivScaleFast + 1.0 * (1 - ivScaleFast)
            : 1.0;
        this.activeFastInsulin.push({
            dose: units, injectionTime: this.totalSimMinutes,
            bioavailability, tauFactor,
            tauI: 55 * tauFactor,  // Per-bolus tau_I [min] — frozen at injection time
            s1: 0, s2: 0, deposited: false
        });
        this.lastInsulinTime = this.totalSimMinutes;
        this.acidosisWarningGiven = false; // insulin givet → DKA-advarsel nulstilles
        this.emitEvent('fast-insulin-sound');
        return true;
    }

    // addBasalInsulin — long-acting (basal) insulin.
    // @param {object} spec  { units: dose [U], injectionTime?: sim-min (default now),
    //                         silent?: bool (skip log/sound event; pre-game dose) }
    // Trapezoid profile over ~22-38 h (gaussRand 28±3 h). No gate.
    addBasalInsulin(spec = {}) {
        requireNumber(spec.units, 'basalInsulin.units', { min: 0, max: 200 }); // validate before any side effect/RNG (S9.9)
        if (spec.injectionTime != null) requireNumber(spec.injectionTime, 'basalInsulin.injectionTime'); // sim-min; may be negative (pre-injection)
        const units = spec.units;
        const injectionTime = (spec.injectionTime != null) ? spec.injectionTime : this.totalSimMinutes;
        const silent = spec.silent === true;
        if (!silent) this.registerNightIntervention(); // night-time basal costs sleep; silent pre-injection does not (S9.8)
        if (!silent) this.emitEvent('basal-insulin-added', { dose: units });
        const bioavailability = this.sessionBioavBasal;
        // modules.insulinVariability (S9.10): off -> fixed 28 h duration (no gaussRand).
        // S9.12: lerp the random basal duration toward the fixed 28 h by the scalar; at
        // scale 1 the clamped sample is used directly (bit-identical), at 0 gaussRand skipped.
        const ivScaleBasal = this.moduleScale('insulinVariability');
        const durationHours = ivScaleBasal > 0
            ? Math.max(22, Math.min(38, this.gaussRand(28, 3))) * ivScaleBasal + 28 * (1 - ivScaleBasal)
            : 28;
        this.activeLongInsulin.push({
            dose: units, injectionTime,
            totalDuration: durationHours * 60,
            bioavailability
        });
        this.lastInsulinTime = injectionTime;
        this.acidosisWarningGiven = false; // insulin administered → reset DKA warning
        return true;
    }

    // addAcuteStress — atomar intervention for kortvarig stress.
    // Hele inputtet valideres før state eller eventbuffer ændres.
    addAcuteStress(amount) {
        requireNumber(amount, 'acuteStress.amount', { min: 0, max: 0.4 });
        this.acuteStressLevel = Math.min(0.4, this.acuteStressLevel + amount);
        this.emitEvent('acute-stress-added', { amount });
        return true;
    }

    // addChronicStress — atomar intervention for langvarig stress.
    // Pending-puljen er begrænset til 1,5, mens overførslen til den aktive
    // stress-state fortsat sker gradvist i updateStressHormones().
    addChronicStress(amount) {
        requireNumber(amount, 'chronicStress.amount', { min: 0, max: 1.5 });
        this._pendingChronicStress = Math.min(1.5, this._pendingChronicStress + amount);
        this.emitEvent('chronic-stress-added', { amount });
        return true;
    }

    // startActivity — start an exercise/activity session. Returns false if an
    // activity is already running or the exercise cooldown has not expired (emits
    // 'exercise-cooldown'). spec: { type, intensity, durationMin, typeDef }.
    // typeDef: the game's AKTIVITETSTYPER[type] passed in by the facade. If typeDef
    // is omitted (standalone use), type is looked up in ENGINE_DEFAULT_ACTIVITIES
    // (cardio/styrke/blandet/afslapning). The engine reads no globals.
    // onAccept (facade: handleNightIntervention) is called after gates, before side-effects.
    startActivity(spec = {}, onAccept) {
        // Valider hele specifikationen før callback, søvnregistrering, RNG eller
        // event-emission. durationMin=null er en åben session; 0 er tvetydigt
        // og afvises, så det aldrig kan blive til den hårde 240-minutters grænse.
        if (spec.durationMin != null) {
            requireNumber(spec.durationMin, 'activity.durationMin', { min: 0, max: 1440 });
            if (spec.durationMin === 0) {
                throw new RangeError('activity.durationMin skal være større end 0 eller null');
            }
        }
        const typeDef = spec.typeDef || ENGINE_DEFAULT_ACTIVITIES[spec.type];
        const intensitet = spec.intensity ?? 'Medium';
        const validIntensity = ['Lav', 'Medium', 'Høj'].includes(intensitet);
        const finiteAtIntensity = map =>
            map && Number.isFinite(map[intensitet]);
        const stressReductionValid = Number.isFinite(typeDef?.stressReduction)
            || finiteAtIntensity(typeDef?.stressReduction);
        const vasodilatationValid = Number.isFinite(typeDef?.vasodilatation)
            || finiteAtIntensity(typeDef?.vasodilatation);
        const typeDefValid = !!typeDef
            && validIntensity
            && finiteAtIntensity(typeDef.hrTarget)
            && finiteAtIntensity(typeDef.kcalPerMin)
            && finiteAtIntensity(typeDef.hepaticDriveRate)
            && finiteAtIntensity(typeDef.hepaticDriveCeiling)
            && Number.isFinite(typeDef.contractionUptakeScaling)
            && Number.isFinite(typeDef.fastSensitivityScaling)
            && Number.isFinite(typeDef.earlySensitivityScaling)
            && Number.isFinite(typeDef.lateSensitivityScaling)
            && Number.isFinite(typeDef.insulinSensitivityOnsetHalfMin)
            && Number.isFinite(typeDef.glycogenUseScaling)
            && stressReductionValid
            && vasodilatationValid;
        if (!typeDefValid) return false;

        // Cannot start a new activity while one is already running
        if (this.activeAktivitet) return false;
        // Cooldown after long/intense exercise — the body needs rest
        if (this.exerciseCooldownUntil && this.totalSimMinutes < this.exerciseCooldownUntil) {
            const remainMin = Math.ceil(this.exerciseCooldownUntil - this.totalSimMinutes);
            this.emitEvent('exercise-cooldown', { min: remainMin });
            return false;
        }
        if (onAccept) onAccept();

        const isPhysicalActivity = spec.type !== 'afslapning';
        if (isPhysicalActivity) {
            // Fysisk aktivitet holder karakteren vågen, indtil passet stopper.
            // Den åbne periode afsluttes i stopActivity() med 30 min restitution.
            this.sleepAwakeOpen = true;
            this.nightAwakeUntil = -Infinity;
            this._activeExerciseAwakeInterval = this._mergeSleepAwakeInterval(
                this.totalSimMinutes,
                null
            );
            if (this._isNightMinute(this.totalSimMinutes)) {
                this.lastNightAwakeningTime = this.totalSimMinutes;
                this.emitEvent('sleep-pop');
            }
        } else {
            // Afslapning/yoga er ikke et fysisk pas i søvnkontrakten. Hvis den
            // startes om natten, behandles den som en almindelig kort handling.
            this.registerNightIntervention();
        }

        const varighed = spec.durationMin;
        const kcalPerMinute = typeDef.kcalPerMin[intensitet];

        this.activeAktivitet = {
            type: spec.type,    // "cardio", "styrke", "blandet", "afslapning"
            intensitet,         // "Lav", "Medium", "Høj"
            startTime: this.totalSimMinutes,
            varighed,           // null = open-ended (runs until the player stops)
            typeDef,            // Reference to AKTIVITETSTYPER[type]
            kcalPerMin: kcalPerMinute,
            kcalBurned: 0       // Accumulated during the activity
        };

        // Create the sensitivity session at START. The session response is a
        // continuous function of elapsed time and a type-specific physiological
        // delay. stopActivity() later freezes only duration; it does not add a new
        // amplitude. Store the record on activeAktivitet so the exact object can be
        // completed without searching by timestamp.
        const sensitivitySession = {
            intensity: intensitet,
            type: spec.type,
            startTime: this.totalSimMinutes,
            duration: null,
            fastSensitivityScaling: typeDef.fastSensitivityScaling,
            earlySensitivityScaling: typeDef.earlySensitivityScaling,
            lateSensitivityScaling: typeDef.lateSensitivityScaling,
            insulinSensitivityOnsetHalfMin: typeDef.insulinSensitivityOnsetHalfMin,
            sensitivityEndTime: Infinity
        };
        this.activeMotion.push(sensitivitySession);
        this.activeAktivitet.sensitivitySession = sensitivitySession;
        // Estimated kcal (only for fixed duration — open sessions accumulate continuously)
        const estimatedKcal = varighed ? (kcalPerMinute * varighed) : 0;
        this.emitEvent('activity-started', {
            type: spec.type, intensity: intensitet, duration: varighed, kcal: estimatedKcal, icon: typeDef.icon
        });
        return true;
    }

    // stopActivity — end the active session. Computes actual duration + calorie
    // expenditure, freezes the duration of the already-existing continuous
    // sensitivity session, sets the exercise cooldown, and emits 'activity-ended'.
    // The log-history patch (graph band) stays on the facade. No-op without an active session.
    stopActivity() {
        if (!this.activeAktivitet) return;

        const akt = this.activeAktivitet;
        const actualDuration = this.totalSimMinutes - akt.startTime;

        // Register calorie expenditure (including continuously accumulated kcal)
        this.totalKcalBurnedMotion += akt.kcalBurned;

        // Complete the session that was created in startActivity(). The delayed
        // rectangular response remains continuous before and after this assignment.
        const sensitivitySession = akt.sensitivitySession;
        sensitivitySession.duration = actualDuration;
        sensitivitySession.sensitivityEndTime =
            this.totalSimMinutes +
            ENGINE_EXERCISE_SENSITIVITY_MAX_LIFETIME_MIN;

        // Prune expired sessions (older than sensitivityEndTime).
        this.activeMotion = this.activeMotion.filter(m =>
            this.totalSimMinutes < m.sensitivityEndTime);

        this.emitEvent('activity-ended', {
            type: akt.type, intensity: akt.intensitet, startTime: akt.startTime,
            duration: Math.round(actualDuration), kcal: Math.round(akt.kcalBurned),
            icon: akt.typeDef.icon
        });

        // Cooldown after exercise — proportional to duration and intensity.
        // Low: ×0.15, Medium: ×0.25, High: ×0.40; clamp 0-60 min.
        const cooldownFactor = akt.intensitet === 'Høj' ? 0.40
                             : akt.intensitet === 'Medium' ? 0.25 : 0.15;
        const cooldownMin = Math.max(0, Math.min(60,
            (actualDuration - 30) * cooldownFactor));
        if (cooldownMin > 0) {
            this.exerciseCooldownUntil = this.totalSimMinutes + cooldownMin;
        }

        if (akt.type !== 'afslapning') {
            // Efter fysisk aktivitet forbliver karakteren vågen i 30 minutter.
            // Den samme slutgrænse styrer søvntab, Zzz, humør og grafens natlys.
            const recoveryEnd = this.totalSimMinutes + 30;
            this.sleepAwakeOpen = false;
            if (this._activeExerciseAwakeInterval) {
                const finalAwakeEnd = Math.max(
                    this._activeExerciseAwakeInterval._endBeforeOpen || -Infinity,
                    recoveryEnd
                );
                this._activeExerciseAwakeInterval.endMin = finalAwakeEnd;
                delete this._activeExerciseAwakeInterval._endBeforeOpen;
                this.nightAwakeUntil = finalAwakeEnd;
            } else {
                this._mergeSleepAwakeInterval(akt.startTime, recoveryEnd);
                this.nightAwakeUntil = recoveryEnd;
            }
            this._activeExerciseAwakeInterval = null;
        }

        this.activeAktivitet = null;
    }

    // useGlucagon — administer emergency glucagon. Mobilises up to 35 g (clinical
    // typical at full liver) limited by liverGlycogenGrams; _substepGlucagon
    // releases it gradually (triangle profile) into plasma. Emits 'glucagon-used'
    // (+ 'glucagon-reduced-effect' at low reserve). Returns actualRelease_g.
    // The 24 h cooldown (game mechanic) stays on the facade.
    useGlucagon() {
        this.registerNightIntervention(); // night-time glucagon costs sleep (S9.8)
        // Target: 35 g (clinical typical for 1 mg glucagon at a full liver).
        // Actual: limited to what IS available in the pool (floor emerges from
        // real pool values after exercise/fasting).
        const GLUCAGON_TARGET_RELEASE_G = 35;
        const availableGlycogen_g = Math.max(0, this.liverGlycogenGrams);
        const actualRelease_g = Math.min(GLUCAGON_TARGET_RELEASE_G, availableGlycogen_g);

        // Triangle profile: ramp 0→peak (12 min) → 0 (45 min total).
        const duration_min = 45;
        const peakMin = 12;
        this.activeGlucagon = {
            startTime: this.totalSimMinutes,
            totalRelease_g: actualRelease_g,
            releasedSoFar_g: 0,
            duration_min: duration_min,
            peakMin: peakMin,
        };

        this.emitEvent('glucagon-used', { totalRelease_g: actualRelease_g });
        if (actualRelease_g < 15) {
            this.emitEvent('glucagon-reduced-effect', { availableGlycogen: actualRelease_g });
        }
        return actualRelease_g;
    }

    // setBG — Set starting BG for laboratory use without resetting other physiology.
    // Q1 and Q2 are scaled proportionally so plasma and peripheral glucose remain
    // consistent. The CGM compartment C is set to the same value to avoid an
    // artificial sensor lag immediately after lab initialisation.
    setBG(mmolL) {
        if (!Number.isFinite(mmolL) || mmolL <= 0) {
            throw new Error('PhysiologyEngine.setBG forventer et positivt mmol/L-tal');
        }
        if (!this.hovorka) {
            throw new Error('PhysiologyEngine.setBG kræver en tilknyttet Hovorka-model');
        }

        const currentBG = this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q1] / this.hovorka.V_G;
        const targetQ1 = mmolL * this.hovorka.V_G;
        if (Number.isFinite(currentBG) && currentBG > 0) {
            const bgRatio = mmolL / currentBG;
            this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q1] *= bgRatio;   // Q1: plasma glucose
            this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q2] *= bgRatio;   // Q2: peripheral glucose
        } else {
            this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.Q1] = targetQ1;
        }
        this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.C] = mmolL;          // C: CGM sensor
        this.trueBG = mmolL;
        this.cgmBG = mmolL;

        return this;
    }

    // setPlasmaInsulinClamp — Hold Hovorka's plasma insulin I [mU/L] at a fixed value.
    // Used for laboratory experiments. null disables the clamp and restores normal
    // Hovorka dynamics. When the clamp is active, Simulator calls
    // applyPlasmaInsulinClamp() before/after each Hovorka step.
    setPlasmaInsulinClamp(valueOrNull) {
        if (valueOrNull == null) {
            this.plasmaInsulinClamp = null;
            return this;
        }
        if (!Number.isFinite(valueOrNull) || valueOrNull < 0) {
            throw new Error('PhysiologyEngine.setPlasmaInsulinClamp forventer null eller et ikke-negativt mU/L-tal');
        }
        if (!this.hovorka) {
            throw new Error('PhysiologyEngine.setPlasmaInsulinClamp kræver en tilknyttet Hovorka-model');
        }

        this.plasmaInsulinClamp = valueOrNull;
        this.applyPlasmaInsulinClamp();
        return this;
    }

    // applyPlasmaInsulinClamp — Internal hook used by Simulator substeps.
    applyPlasmaInsulinClamp() {
        if (this.plasmaInsulinClamp == null) return false;
        if (!this.hovorka) {
            throw new Error('PhysiologyEngine plasma-insulin clamp kræver en tilknyttet Hovorka-model');
        }
        this.hovorka.state[ENGINE_HOVORKA_STATE_IDX.I] = this.plasmaInsulinClamp;
        return true;
    }

    // runScenario — Execute a laboratory scenario via the registered runner.
    // events is a list of objects with time/minute/at/t in sim-minutes and a type.
    // Returns samples before start, after each event/step, and at the end.
    runScenario(events = [], durationMinutes, stepMinutes = 1) {
        if (!this.scenarioRunner) {
            throw new Error('PhysiologyEngine.runScenario kræver en registreret scenario-runner');
        }
        if (!Array.isArray(events)) {
            throw new Error('PhysiologyEngine.runScenario forventer events som array');
        }
        if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
            throw new Error('PhysiologyEngine.runScenario forventer ikke-negativ durationMinutes');
        }
        if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
            throw new Error('PhysiologyEngine.runScenario forventer positiv stepMinutes');
        }

        const eventTime = event => {
            const time = event.time ?? event.minute ?? event.at ?? event.t ?? 0;
            if (!Number.isFinite(time) || time < 0) {
                throw new Error('PhysiologyEngine.runScenario event-tid skal være ikke-negativ');
            }
            return time;
        };
        const timeline = events
            .map((event, index) => ({ event, index, time: eventTime(event) }))
            .sort((a, b) => (a.time - b.time) || (a.index - b.index));

        const samples = [this.scenarioRunner.getSample()];
        let elapsed = 0;
        let eventIndex = 0;

        while (elapsed < durationMinutes || eventIndex < timeline.length) {
            while (eventIndex < timeline.length && timeline[eventIndex].time <= elapsed + 1e-9) {
                this.scenarioRunner.applyEvent(timeline[eventIndex].event);
                samples.push(this.scenarioRunner.getSample());
                eventIndex++;
            }

            if (elapsed >= durationMinutes) break;

            const nextEventTime = eventIndex < timeline.length ? timeline[eventIndex].time : Infinity;
            const nextStepEnd = Math.min(durationMinutes, elapsed + stepMinutes, nextEventTime);
            const dt = nextStepEnd - elapsed;
            if (dt > 1e-9) {
                this.scenarioRunner.step(dt);
                elapsed = nextStepEnd;
                samples.push(this.scenarioRunner.getSample());
            } else {
                elapsed = nextEventTime;
            }
        }

        return {
            durationMinutes,
            stepMinutes,
            samples,
            finalState: this.exportState()
        };
    }

    // emitEvent — Push a structured physiology event into the engine buffer.
    // type is a stable machine-readable string; severity and data are used by the
    // facade to select text, sound, popup, or game mechanic.
    emitEvent(type, data = {}, severity = 'info') {
        const event = { type, severity, data };
        this.events.push(event);
        return event;
    }

    // consumeEvents — Retrieve and clear the event buffer.
    // The Simulator facade calls this after engine.step(), as S3 begins moving
    // concrete side-effects out of the physiology code.
    consumeEvents() {
        const events = this.events.slice();
        this.events.length = 0;
        return events;
    }

    // peekEvents — Retrieve events without clearing the buffer. Useful for tests
    // and debugging while S3 is being migrated in small steps.
    peekEvents() {
        return this.events.slice();
    }

    // _cloneForExport — Deep copy of engine state without JSON loss of Infinity/undefined.
    // The lab API must be able to deliver a stable snapshot to tests/tools.
    // JSON.stringify would convert Infinity to null and drop undefined, so we
    // clone recursively instead.
    _cloneForExport(value) {
        if (Array.isArray(value)) {
            return value.map(item => this._cloneForExport(item));
        }
        if (value && typeof value === 'object') {
            const copy = {};
            for (const key of Object.keys(value)) {
                copy[key] = this._cloneForExport(value[key]);
            }
            return copy;
        }
        return value;
    }

    // exportState — Read-only lab-API snapshot of engine-owned state.
    // Does not mutate the model and does not drain the event buffer. RNG state is
    // exported separately so a later importState() restore can continue the same
    // random sequence rather than only knowing the original seed.
    exportState() {
        const state = {};
        for (const key of Object.keys(this)) {
            if (key === 'rng' || key === 'events' || key === 'hovorka' || key === 'scenarioRunner') continue;
            state[key] = this._cloneForExport(this[key]);
        }

        // Hovorka ODE core (S9.9): the engine excludes the `hovorka` object from the
        // generic copy (it is a class instance), but its mutable state MUST be in the
        // snapshot or import/restore would not round-trip the glucose compartments —
        // trueBG is re-derived from hovorka.glucoseConcentration on the next step, so a
        // snapshot without it silently reverts to the live ODE state. state[4]/Q1 etc.
        // live in the Float64Array; insulinRate/carbRate/heartRate are transient inputs
        // re-derived each step but exported too for a faithful mid-tick snapshot.
        const hovorka = {
            state: Array.from(this.hovorka.state),
            insulinRate: this.hovorka.insulinRate,
            carbRate: this.hovorka.carbRate,
            heartRate: this.hovorka.heartRate,
        };

        return {
            version: 2,
            seed: this._seed,
            rngState: this.rng._state,
            eventCount: this.events.length,
            state,
            hovorka
        };
    }

    // importState — Restore engine state from the exportState() format.
    // The RNG function is kept as the same object because the Simulator facade also
    // holds a reference to it. The event buffer is cleared: exportState() stores only
    // eventCount as metadata, not side-effect events for replay.
    importState(snapshot) {
        if (!snapshot || snapshot.version !== 2 || !snapshot.state || !snapshot.hovorka) {
            throw new Error('PhysiologyEngine.importState forventer exportState() version 2');
        }

        for (const key of Object.keys(this)) {
            if (key === 'rng' || key === 'events' || key === 'hovorka' || key === 'scenarioRunner') continue;
            delete this[key];
        }

        for (const key of Object.keys(snapshot.state)) {
            if (key === 'rng' || key === 'events' || key === 'hovorka' || key === 'scenarioRunner') continue;
            this[key] = this._cloneForExport(snapshot.state[key]);
        }

        // Restore the Hovorka ODE core (S9.9). Reuse the existing Float64Array (set()
        // copies in place) so any reference held by the facade stays valid.
        this.hovorka.state.set(snapshot.hovorka.state);
        this.hovorka.insulinRate = snapshot.hovorka.insulinRate;
        this.hovorka.carbRate = snapshot.hovorka.carbRate;
        this.hovorka.heartRate = snapshot.hovorka.heartRate;

        this._seed = snapshot.seed >>> 0;
        this.rng._setState(snapshot.rngState);
        this.events.length = 0;

        return this.exportState();
    }
}

// -----------------------------------------------------------------------------
// createEngine — factory (preferred external entry point)
// -----------------------------------------------------------------------------
function createEngine(profile, options = {}) {
    const engine = new PhysiologyEngine(profile, options);
    // Opt-in steady-state (S9.1): createEngine(profile, {steadyState:true}) gives a
    // ready-to-run standalone engine in equilibrium with its own basal depot. Default off,
    // so isolation tests and the Simulator facade (which performs its own game-specific
    // init) get a clean engine without an auto-depot.
    if (options.steadyState === true) {
        engine.initSteadyState();
    }
    return engine;
}

// Browser global export. Node can use module.exports in S6+ tests/labs.
if (typeof window !== 'undefined') {
    window.T1DPhysiologyEngine = { createEngine, PhysiologyEngine, makeRng };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createEngine, PhysiologyEngine, makeRng };
}
