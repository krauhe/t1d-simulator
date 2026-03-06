// =============================================================================
// SIMULATOR.JS — Core physiological simulation engine
// =============================================================================
//
// This file contains the Simulator class, which is the heart of the game.
// It models the key physiological processes of Type 1 Diabetes:
//
//   1. Blood glucose (BG) dynamics — rises from food, falls from insulin
//   2. Insulin pharmacokinetics — absorption, activity, and clearance
//   3. Carbohydrate absorption — delayed by fat and protein content
//   4. Exercise effects — aerobic (BG-lowering) and anaerobic (BG-raising)
//   5. Stress hormones — cortisol, glucagon, adrenaline affecting liver output
//   6. Circadian rhythm — dawn effect (morning cortisol peak)
//   7. CGM simulation — realistic sensor delay, noise, and systemic drift
//   8. Game mechanics — scoring, game over conditions (hypo, DKA, weight)
//
// Architecture:
//   The Simulator acts as the "Model" in a Model-View-Controller pattern.
//   It owns all game state and advances the simulation each tick via update().
//   The View (ui.js) reads state from the Simulator to render the UI.
//   The Controller (main.js) calls Simulator methods in response to user input.
//
// Units used throughout:
//   - Blood glucose: mmol/L (millimoles per liter) — standard in Denmark/EU
//   - Insulin: E (units, aka IU — international units)
//   - Time: minutes (simulated time)
//   - Carbohydrates/protein/fat: grams
//   - Weight: kg
//
// Key physiological parameters:
//   - ISF (Insulin Sensitivity Factor): how much 1 unit of insulin lowers BG
//   - ICR (Insulin-to-Carb Ratio): grams of carbs covered by 1 unit of insulin
//
// Dependencies (global): speedSelector, logEvent, showPopup, playSound,
//   cgmDataPoints, trueBgPoints, MAX_GRAPH_POINTS_PER_DAY,
//   KCAL_PER_KG_WEIGHT, various DOM element references
//
// Exports (global): Simulator class
// =============================================================================

class Simulator {
    // =========================================================================
    // CONSTRUCTOR — Initialize all simulation state
    // =========================================================================
    //
    // Sets up the initial conditions for a new game. The player starts at
    // midnight (timeInMinutes = 0) with stable blood glucose (5.5 mmol/L)
    // and a pre-administered basal insulin dose from 16 hours ago (simulating
    // that the patient took their daily long-acting insulin the previous morning).
    //
    // The constructor accepts an optional profile object with the patient's
    // personal diabetes parameters (weight, ICR, ISF). If no profile is given,
    // sensible defaults are used. The profile drives all derived calculations:
    // basal insulin dose, resting calorie burn, etc.
    //
    // In MATLAB terms, this is like setting up your initial conditions vector
    // before running ode45 — all state variables start here.
    //
    // @param {object} profile          - Optional patient profile
    // @param {number} profile.weight   - Body weight in kg (default: 70)
    // @param {number} profile.icr      - Insulin-to-Carb Ratio in g/E (default: 10)
    // @param {number} profile.isf      - Insulin Sensitivity Factor in mmol/L per E (default: 3.0)
    // =========================================================================
    constructor(profile = {}) {
        // --- Time tracking ---
        this.day = 1;                   // Current simulation day (1-indexed)
        this.timeInMinutes = 0;         // Time within current day (0-1440, wraps at midnight)
        this.totalSimMinutes = 0;       // Total elapsed simulation time (never wraps)
        this.simulationSpeed = parseInt(speedSelector.value); // Real-seconds to sim-minutes ratio
        this.isGameOver = false;        // Flag to stop simulation on death

        // --- Patient parameters (from profile or defaults) ---

        // Weight in kg — used for resting calorie calculation.
        this.weight = profile.weight || 70;

        // ISF: Insulin Sensitivity Factor — how many mmol/L one unit of insulin lowers BG.
        // Example: ISF=3.0 means 1 unit of fast insulin drops BG by ~3 mmol/L.
        this.ISF = profile.isf || 3.0;

        // ICR: Insulin-to-Carb Ratio — how many grams of carbs are "covered" by 1 unit.
        // Example: ICR=10 means you need 1 unit of insulin per 10g carbs.
        this.ICR = profile.icr || 10;

        // --- Hovorka fysiologisk model ---
        // Vi bruger den validerede Hovorka 2004-model som kerne-motor for
        // glukose-insulin dynamikken. Spillerens ISF mappes til modellens
        // insulinfølsomheds-parametre via en skaleringsfaktor.
        //
        // Default ISF = 3.0 mmol/L per E svarer til scale = 1.0.
        // Højere ISF → mere følsom → scale > 1.0
        // Lavere ISF → mindre følsom → scale < 1.0
        // Kalibreringsfaktor: Hovorka-modellens baseline insulin-parametre
        // giver en effektiv ISF på ~3.75 mmol/L per enhed. Vi skalerer så
        // spillerens ISF mappes korrekt: ISF=3.0 → scale=0.80.
        // Kalibreret empirisk: 1E bolus fra BG=8 med scale=ISF/3.75 giver
        // et BG-fald ≈ ISF mmol/L.
        const insulinSensitivityScale = this.ISF / 3.75;
        this.hovorka = new HovorkaModel(this.weight, {
            insulinSensitivityScale: insulinSensitivityScale
        });

        // gramsPerMmolRise: derived value — how many grams of carbs raise BG by 1 mmol/L.
        // Calculated as ICR/ISF. With ICR=10 and ISF=3.0: 10/3 = 3.33 g per mmol/L rise.
        this.gramsPerMmolRise = this.ICR / this.ISF;

        // --- Resting metabolic rate (derived from weight) ---
        // Baseline: 2200 kcal/day at 70 kg, scales linearly with body weight.
        // At 80 kg: ~2514 kcal/day. At 50 kg: ~1571 kcal/day.
        this.restingKcalPerDay = this.weight * (2200 / 70);
        this.restingKcalPerMinute = this.restingKcalPerDay / (24 * 60);

        // --- Estimated Total Daily Dose (TDD) and basal dose ---
        // The "100 rule" (derived from the 1800 rule for mg/dL):
        //   TDD = 1800 / ISF_mgdl = 1800 / (ISF_mmol * 18) = 100 / ISF_mmol
        // Basal insulin is typically ~45% of TDD.
        // Example: ISF=3.0 → TDD=33 E/day → basal=15 E/day
        this.estimatedTDD = 100 / this.ISF;
        this.basalDose = Math.round(this.estimatedTDD * 0.45);

        // --- Blood glucose state ---
        // trueBG: the actual blood glucose level (ground truth, not visible to player).
        // cgmBG: the CGM (Continuous Glucose Monitor) reading — what the player sees.
        // CGM has a ~5-10 minute delay and some noise vs. true BG, just like real sensors.
        this.trueBG = 5.5;             // Starting BG: 5.5 mmol/L (overskrives af steady-state)
        this.cgmBG = 5.5;             // Overskrives efter steady-state init nedenfor
        this.cgmBGHistory = [];        // Fyldes efter steady-state init
        this.lastCgmCalculationTime = -5;  // Første CGM-update sker ved t=0

        // CGM sensor characteristics — kalibreret mod rigtig Libre 2 data.
        // Analyse af ~34.000 målinger over et år viser:
        //   - Støj std: ~0.18 mmol/L (skalerer med BG-niveau: ~3-5% af BG)
        //   - Støj er næsten pure random (lag-1 autokorrelation: -0.04)
        //   - Drift: langsom systematisk afvigelse over sensorens levetid
        //   - Diskontinuiteter: ~0.7/dag (spring > 2 mmol/L, fx kompression, kalibrering)
        //
        // cgmSystemicPeriod: periode for langsom sinusbølge-drift (4-8 timer)
        // cgmSystemicAmplitude: amplitude af drift (0.3-0.7 mmol/L)
        // cgmNoiseScale: støj som andel af BG-niveau (kalibreret fra data)
        this.cgmSystemicPeriod = (4 + Math.random() * 4) * 60;
        this.cgmSystemicAmplitude = (0.3 + Math.random() * 0.4);
        this.cgmNoiseScale = 0.025 + Math.random() * 0.015; // 2.5-4.0% af BG
        this.cgmDiscontinuityChance = 0.0025; // ~0.7 per dag ved 5-min intervaller (288 målinger/dag)

        // Steep drop detection — warns player when BG is falling dangerously fast
        this.lastTrueBGForDropCheck = this.trueBG;
        this.timeOfLastBGDropCheck = 0;

        // --- Active effects arrays ---
        // These arrays hold currently active food, insulin, and exercise "objects".
        // Each entry tracks its own timing and absorption progress.
        // Think of it like tracking multiple differential equations simultaneously —
        // each food item, insulin dose, and exercise session has its own state.
        this.activeFood = [];           // Active food items being digested
        this.activeFastInsulin = [];    // Active fast-acting insulin doses
        this.activeLongInsulin = [];    // Active long-acting (basal) insulin doses
        this.activeMotion = [];         // Active and recently completed exercise sessions

        // --- Aggregate state ---
        this.iob = 0;                  // Insulin On Board: total active fast insulin (units)
        this.cob = 0;                  // Carbs On Board: total unabsorbed carbs (grams)
        this.lastInsulinTime = -Infinity; // Time of last insulin injection (for DKA detection)

        // --- DKA (Diabetic Ketoacidosis) tracking ---
        // DKA develops when there's prolonged insulin deficiency + high BG.
        // The body can't use glucose without insulin, so it burns fat instead,
        // producing ketones (acids) that poison the blood. Untreated = fatal.
        this.timeOfHighBGwithInsulinDeficit = 0; // When the DKA clock started
        this.dkaWarning1Given = false;           // Has the first DKA warning been shown?
        this.dkaGameOverTime = -1;               // Scheduled game over time (-1 = not set)

        // --- Ketone level (mmol/L blood ketones) ---
        // Ketoner produceres når kroppen brænder fedt i stedet for glukose pga. insulinmangel.
        // Normal: < 0.6 mmol/L. Forhøjet: 0.6-1.5. Farlig: 1.5-3.0. DKA: > 3.0.
        // Ketonniveauet stiger ved insulinmangel + høj BG, og falder når der gives insulin.
        // Spilleren kan måle ketoner med et "keton-stik" (som fingerprik).
        this.ketoneLevel = 0.1;                 // Starter normalt (< 0.6 mmol/L)

        // --- Emergency glucagon ---
        // Glucagon is a hormone that rapidly raises BG by telling the liver to dump glucose.
        // In real life, it's an emergency injection for severe hypoglycemia.
        this.glucagonUsedTime = -Infinity; // Last usage time (24h cooldown)

        // --- Scoring ---
        this.normoPoints = 0;          // Points earned for time spent in target BG range

        // Night intervention penalty: if you eat/inject at night (22:00-07:00),
        // point earning is halved for a period. This simulates the real-world
        // principle that a well-managed diabetes shouldn't require frequent
        // nighttime interventions (ideally, basal insulin handles the night).
        this.nightInterventionPenaltyFactor = 1.0;
        this.nightInterventionPenaltyEndTime = -1;

        // Basal insulin reminders — one per day for the first 3 days
        this.basalReminderGivenForDay = [false, false, false];

        // --- Statistics and history ---
        this.bgHistoryForStats = [];   // BG history for TIR/TITR/average calculations
        this.logHistory = [];          // Event log (food, insulin, exercise) for display

        // --- Calorie tracking (for weight change calculation) ---
        this.totalKcalConsumed = 0;        // Total calories eaten
        this.totalKcalBurnedBase = 0;      // Calories burned at rest (BMR)
        this.totalKcalBurnedMotion = 0;    // Calories burned via exercise
        this.weightChangeKg = 0;           // Net weight change (positive = gained)

        // --- Graph messages ---
        // Temporary messages displayed on the graph (e.g., basal reminders)
        this.graphMessages = [];

        // --- Insulin resistance factor ---
        // Dynamically modified by chronic stress. At baseline (no stress) = 1.0.
        // Higher values mean insulin is less effective (ISF is divided by this).
        this.insulinResistanceFactor = 1.0;

        // --- Bonus range tracking ---
        // Tracks whether BG is in the tight bonus range (5.0-6.0) for sound feedback
        this.isInBonusRange = false;

        // --- Stress hormones (cortisol, glucagon, adrenaline) ---
        // These hormones increase the liver's glucose production and insulin resistance.
        // We use two separate levels with different washout speeds:
        //
        // acuteStressLevel: short-lived stress (adrenaline/glucagon during hypoglycemia
        //   or intense exercise). Half-life: ~60 simulated minutes.
        //   Example triggers: severe hypoglycemia (Somogyi effect), high-intensity training.
        //
        // chronicStressLevel: long-lasting stress (elevated cortisol from illness,
        //   sleep deprivation). Half-life: ~12 simulated hours. Much slower decay.
        //
        // Both levels feed into a combined stress multiplier that scales hepatic
        // glucose production (HGP):
        //   stressMultiplier = 1.0 + acuteStressLevel + chronicStressLevel
        //   + circadianKortisolNiveau
        //
        // At zero stress: normal production (multiplier = 1.0).
        // At acuteStress = 1.0: double production (multiplier = 2.0).
        this.acuteStressLevel = 0.0;
        this.chronicStressLevel = 0.0;

        // Initialiser Hovorka-modellen til steady-state.
        // initializeSteadyState finder automatisk den insulin-rate der giver
        // target BG=5.5 mmol/L, uanset patientens ISF/basal-dosis.
        // Den fundne rate gemmes som hovorkaSteadyStateBasalRate.
        const basalRateGuess = this.hovorka.basalToRate(this.basalDose);
        this.hovorka.initializeSteadyState(basalRateGuess, 5.5);
        this.hovorkaSteadyStateBasalRate = this.hovorka.steadyStateBasalRate;

        // Pre-administer basal insulin fra 16 timer siden (patienten tog
        // sin daglige Lantus/Tresiba i går morges kl. 08:00).
        // Dosis justeres så trapez-profilens plateau-rate matcher den
        // kalibrerede steady-state rate. Dette sikrer at BG er stabil ved start.
        // (totalDuration er tilfældig 24-36 timer; vi beregner dosis baglæns)
        this.addLongInsulin(this.basalDose, this.totalSimMinutes - 16 * 60, true);
        // Juster den interne dosis så plateau-raten matcher Hovorka's steady-state
        const initialBasal = this.activeLongInsulin[0];
        initialBasal.dose = this.hovorkaSteadyStateBasalRate * initialBasal.totalDuration / 1000;
        this.lastInsulinTime = this.totalSimMinutes - 16 * 60;

        // Synkroniser trueBG med Hovorka-modellens steady-state glukose
        this.trueBG = this.hovorka.glucoseConcentration;
        this.cgmBG = this.trueBG;

        // Seed CGM-historik med steady-state BG så de første datapunkter
        // har noget at referere til (undgår diskontinuitet i grafen ved start).
        // Vi lægger 20 punkter ind med 5-minutters interval bagud fra t=0.
        for (let t = -100; t <= 0; t += 5) {
            this.cgmBGHistory.push({ time: t, value: this.trueBG });
        }

        // Tilføj et initialt CGM-datapunkt så grafen starter med en værdi
        cgmDataPoints.push({ time: 0, value: this.trueBG });
        trueBgPoints.push({ time: 0, value: this.trueBG });
    }

    // =========================================================================
    // COMPUTED PROPERTIES (getters)
    // =========================================================================
    // In JavaScript, "get" defines a computed property — like a MATLAB dependent
    // property. It looks like a variable (sim.currentISF) but runs a function.
    // =========================================================================

    /**
     * currentISF — The effective Insulin Sensitivity Factor at this moment.
     *
     * Base ISF is modified by two dynamic factors:
     *   1. insulinResistanceFactor (>1.0 when chronic stress is elevated)
     *      — This DIVIDES ISF, making insulin less effective.
     *      — E.g., factor=1.5 means ISF goes from 3.0 to 3.0*1.5=4.5,
     *        but since ISF is "how much 1U lowers BG", higher ISF here means
     *        the formula yields less BG drop... actually wait: the factor
     *        multiplies ISF so the insulin rate (dose * ISF) increases.
     *        But then sensitivityIncreaseFactor divides it back.
     *        The net effect: insulinResistanceFactor > 1 means higher ISF value
     *        which means MORE BG drop per unit... This seems counterintuitive,
     *        but in the update() method, insulin effect is calculated as
     *        dose * currentISF, so a higher ISF = more BG lowering.
     *        The insulinResistanceFactor is set in updateStressHormones as
     *        1.0 + chronicStressLevel * 0.5, but it multiplies ISF...
     *        (Note: this may be a design choice where resistance is modeled
     *        differently than expected — the liver produces more glucose via
     *        the stress multiplier, which is the main insulin resistance effect.)
     *
     *   2. sensitivityIncreaseFactor (>1.0 after exercise)
     *      — Exercise increases insulin sensitivity for hours after the session.
     *      — This DIVIDES the result, making insulin MORE effective post-exercise.
     *      — The increase fades linearly from max to 1.0 over the sensitivity window.
     *
     * @returns {number} Effective ISF in mmol/L per unit of insulin
     */
    get currentISF() {
        // Start with no sensitivity increase (factor = 1.0 = no change)
        let sensitivityIncreaseFactor = 1.0;

        // Check each active/recent exercise session for post-exercise sensitivity boost
        this.activeMotion.forEach(motion => {
            // sensitivityEndTime = when the post-exercise sensitivity boost wears off
            if (this.totalSimMinutes < motion.sensitivityEndTime) {
                // Calculate how far into the post-exercise sensitivity period we are
                const timeIntoSensitivityEffect = this.totalSimMinutes - (motion.startTime + motion.duration);
                const totalSensitivityDuration = motion.sensitivityEndTime - (motion.startTime + motion.duration);
                if (totalSensitivityDuration <= 0) return; // Guard against division by zero

                // Linear fade from maxSensitivityIncreaseFactor down to 1.0
                // At start of post-exercise: full boost. At end: no boost.
                const currentIncrease = (motion.maxSensitivityIncreaseFactor - 1) * (1 - (timeIntoSensitivityEffect / totalSensitivityDuration));
                sensitivityIncreaseFactor = Math.max(sensitivityIncreaseFactor, 1 + currentIncrease);
            }
        });

        // Final ISF = (base ISF * resistance factor) / sensitivity boost
        return (this.ISF * this.insulinResistanceFactor) / sensitivityIncreaseFactor;
    }

    /**
     * currentCarbEffect — How much 1 gram of carbohydrate raises BG (in mmol/L).
     *
     * Derived from currentISF and ICR:
     *   carbEffect = ISF / ICR
     *
     * Example: ISF=3.0, ICR=10 → 3.0/10 = 0.3 mmol/L per gram of carbs.
     * So eating 10g of carbs would raise BG by ~3.0 mmol/L.
     *
     * @returns {number} BG rise in mmol/L per gram of carbohydrate
     */
    get currentCarbEffect() { return this.currentISF / this.ICR; }

    // =========================================================================
    // CIRCADIAN CORTISOL — Dawn Effect Model
    // =========================================================================
    //
    // Cortisol naturally rises in the morning as part of the circadian rhythm.
    // This causes the liver to produce more glucose, leading to the "dawn
    // phenomenon" — a common source of frustration for T1D patients who wake
    // up with high BG despite not eating anything.
    //
    // We model the cortisol curve in three phases using quarter-sine arcs
    // for a smooth, physiologically plausible shape:
    //
    //   00:00–04:00 | Baseline: cortisol is low, no extra liver glucose
    //   04:00–08:00 | Rising phase: sin curve from 0 → peak (quarter sine up)
    //   08:00–12:00 | Falling phase: cos curve from peak → 0 (quarter sine down)
    //   12:00–24:00 | Baseline: cortisol is low for the rest of the day
    //
    // The math behind the quarter-sine arc:
    //   sin(0) = 0  →  sin(pi/2) = 1   (rise from 0 to 1 over quarter period)
    //   cos(0) = 1  →  cos(pi/2) = 0   (fall from 1 to 0 over quarter period)
    //   "progress" is a value from 0.0 to 1.0 indicating how far through
    //   the current phase we are.
    //
    // Visual representation (amplitude = 0.3):
    //
    //   0.30 |         ^ peak at 08:00
    //        |       /   \
    //   0.15 |     /       \
    //        |   /           \
    //   0.00 |---              ---------------
    //        +----------------------------> time
    //       00   04   08   12   16   20   24
    //
    // =========================================================================
    get circadianKortisolNiveau() {
        const maxAmplitude = 0.3; // Maximum cortisol contribution to stress multiplier
        const t = this.timeInMinutes; // Current time of day in minutes

        const stigStart  = 4 * 60;  // 04:00 — cortisol begins to rise
        const peak       = 8 * 60;  // 08:00 — peak (dawn effect maximum)
        const falSlut    = 12 * 60; // 12:00 — back to baseline

        if (t >= stigStart && t < peak) {
            // Rising phase: quarter sine arc from 0 to 1
            const fremgang = (t - stigStart) / (peak - stigStart); // 0.0 → 1.0
            return maxAmplitude * Math.sin(Math.PI / 2 * fremgang);

        } else if (t >= peak && t < falSlut) {
            // Falling phase: quarter cosine arc from 1 to 0
            const fremgang = (t - peak) / (falSlut - peak);        // 0.0 → 1.0
            return maxAmplitude * Math.cos(Math.PI / 2 * fremgang);

        } else {
            // Rest of the day: no circadian cortisol contribution
            return 0;
        }
    }

    // =========================================================================
    // UPDATE — Main simulation tick (called every frame by the game loop)
    // =========================================================================
    //
    // This is the core of the simulation — like a single step of an ODE solver.
    // Each call advances the simulation by a small time increment and computes
    // the net change in blood glucose from all active processes:
    //
    //   BG_change = liver_production - basal_insulin - bolus_insulin
    //             + carb_absorption + protein_absorption
    //             - exercise_glucose_uptake + exercise_anaerobic_response
    //
    // The time step size depends on simulation speed and real elapsed time:
    //   simulatedMinutesPassed = deltaTimeSeconds * simulationSpeed / 60
    //
    // At speed=60 (1 hour per real minute), a 1-second real tick = 1 sim-minute.
    // At speed=240 (4 hours per real minute), a 1-second real tick = 4 sim-minutes.
    //
    // @param {number} deltaTimeSeconds - Real-world seconds since last update call
    // =========================================================================
    update(deltaTimeSeconds) {
        if (this.isGameOver) return; // Dead players don't metabolize

        // Calculate how many simulated minutes this tick represents
        const simulatedMinutesPassed = deltaTimeSeconds * this.simulationSpeed / 60;
        this.totalSimMinutes += simulatedMinutesPassed;
        this.timeInMinutes = this.totalSimMinutes % (24 * 60); // Wrap at midnight
        this.day = Math.floor(this.totalSimMinutes / (24*60)) + 1;

        // Burn resting calories (basal metabolic rate) proportional to time passed.
        // Uses the patient-specific rate derived from body weight.
        this.totalKcalBurnedBase += this.restingKcalPerMinute * simulatedMinutesPassed;

        // Update stress hormone levels (exponential decay + auto-triggers like hypo)
        this.updateStressHormones(simulatedMinutesPassed);
        const currentHour = Math.floor(this.timeInMinutes / 60);

        // =====================================================================
        // HOVORKA MODEL — Fysiologisk kerne-motor
        // =====================================================================
        //
        // I stedet for manuelt at beregne bgChangeThisFrame som en sum af
        // separate lineære effekter, bruger vi nu Hovorka-modellens 11 ODE'er
        // til at beregne glukose-dynamikken. Modellen håndterer automatisk:
        //
        //   - Leverproduktion (EGP) supprimeret af insulin
        //   - Hjernens glukoseforbrug (F01)
        //   - Renal clearance (nyrer udskiller glukose > 9 mmol/L)
        //   - Insulin-farmakokinetik (2 subkutane kompartmenter → plasma)
        //   - Kulhydrat-absorption (2 tarm-kompartmenter)
        //   - Motionseffekter (E1/E2 state variables via puls)
        //
        // Vi beregner de samlede input-rates fra vores eksisterende
        // data-strukturer (activeFood, activeFastInsulin, activeLongInsulin,
        // activeMotion) og feeder dem ind i Hovorka-modellen.
        // =====================================================================

        // --- 1. BEREGN SAMLET INSULIN-RATE [mU/min] ---
        //
        // BASAL insulin: trapez-profil (langsom ramp-up over 4t, plateau 18t, tail-off)
        // leverer en jævn rate over ~24-36 timer. Feedes direkte til Hovorka's
        // insulinRate input (bypasser S1/S2 da basal allerede er langsomt).
        let totalInsulinRate = 0;
        this.activeLongInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection < 0) return;
            let effectFactor = 0;
            const timeToPlateau = 4 * 60;
            const endOfPlateau = timeToPlateau + 18 * 60;
            const tailOffDuration = ins.totalDuration - endOfPlateau;
            if (timeSinceInjection < timeToPlateau) effectFactor = timeSinceInjection / timeToPlateau;
            else if (timeSinceInjection < endOfPlateau) effectFactor = 1.0;
            else if (timeSinceInjection < ins.totalDuration) effectFactor = 1.0 - (timeSinceInjection - endOfPlateau) / tailOffDuration;
            totalInsulinRate += (ins.dose * 1000 / ins.totalDuration) * Math.max(0, effectFactor);
        });
        this.activeLongInsulin = this.activeLongInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        // BOLUS (hurtigvirkende) insulin: injiceres som kort puls (5 sim-min).
        // Hovorka-modellens S1→S2→I→x1/x2/x3 kompartmenter håndterer al
        // farmakokinetik (absorption, distribution, effekt-forsinkelse).
        // Vi bruger IKKE en trekant-profil oven på Hovorka — det ville give
        // dobbelt modellering og alt for lang insulinvarighed.
        //
        // IOB beregnes fra Hovorka's tilstandsvariable (S1 + S2 + I*VI)
        // i stedet for vores egen tracking, da Hovorka nu ejer al insulin-PK.
        const BOLUS_PULSE_DURATION = 5; // minutter — simulerer subkutan injektion
        this.activeFastInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection >= 0 && timeSinceInjection < BOLUS_PULSE_DURATION) {
                // Injicér hele dosen som en kort puls: dose * 1000 mU over 5 min
                totalInsulinRate += ins.dose * 1000 / BOLUS_PULSE_DURATION;
            }
        });
        // Fjern bolus-entries efter 6 timer (langt efter pulsen er slut, men
        // beholdes for log/UI-formål og IOB-tracking)
        this.activeFastInsulin = this.activeFastInsulin.filter(ins =>
            (this.totalSimMinutes - ins.injectionTime) < 6 * 60);

        // IOB: beregn fra Hovorka's insulin-kompartmenter (mere korrekt end
        // vores gamle lineære tracking). S1+S2 er subkutan insulin, I*VI er
        // plasma insulin. Vi normaliserer til enheder (divider med 1000).
        this.iob = (this.hovorka.state[2] + this.hovorka.state[3]) / 1000;

        // --- 2. BEREGN KULHYDRAT-RATE til Hovorka D1/D2 [mmol/min] ---
        //
        // Kulhydrater feedes ind i Hovorka's D1→D2 tarm-kompartmenter via
        // carbRate. Modellens to-kompartment tarm-model (τG=40 min) giver
        // automatisk realistisk absorption med forsinket peak og gradvis optag.
        //
        // Fedt påvirker τG (mavetømningshastighed) — dette håndteres ved at
        // justere Hovorka's tau_G parameter dynamisk baseret på måltidets
        // fedtindhold. Protein bidrager med ~25% som forsinkede kulhydrater.
        //
        // Mad-items har en "spisetid" (10 min default) hvor carbRate er aktiv.
        let totalCarbRate = 0;
        this.cob = 0;
        this.activeFood.forEach(food => {
            const timeSinceConsumption = this.totalSimMinutes - food.startTime;
            const eatingDuration = 10; // minutter det tager at spise

            // Kulhydrat-rate: feedes ind over spisetiden
            if (timeSinceConsumption >= 0 && timeSinceConsumption < eatingDuration && food.carbs > 0) {
                // Konverter gram til mmol/min: gram * 1000/180 / eatingDuration
                totalCarbRate += (food.carbs * 1000 / 180) / eatingDuration;
            }

            // Protein som forsinkede kulhydrater (25% effekt, 30 min forsinkelse)
            const proteinDelay = 30;
            const proteinDuration = 60; // protein absorberes langsommere
            if (food.protein > 0 &&
                timeSinceConsumption >= proteinDelay &&
                timeSinceConsumption < proteinDelay + proteinDuration) {
                totalCarbRate += (food.protein * 0.25 * 1000 / 180) / proteinDuration;
            }

            // COB tracking: estimer resterende kulhydrater baseret på tid.
            // Hovorka's D1/D2 har τG=40, så ~95% absorberet efter 3*τG=120 min.
            const carbDecay = Math.max(0, 1 - timeSinceConsumption / 120);
            const protDecay = Math.max(0, 1 - Math.max(0, timeSinceConsumption - proteinDelay) / 120);
            this.cob += food.carbs * carbDecay + food.protein * 0.25 * protDecay;
        });
        // Fjern mad-entries efter 3 timer (al absorption færdig)
        this.activeFood = this.activeFood.filter(f =>
            (this.totalSimMinutes - f.startTime) < 180);

        // --- 3. BEREGN PULS (for motionseffekt i Hovorka E1/E2) ---
        // Motionsintensitet mappes til puls:
        //   Lav → 100 bpm, Medium → 130 bpm, Høj → 160 bpm
        // Stresskatekolaminer (anaerob) håndteres via acuteStressLevel
        let currentHeartRate = this.hovorka.HR_base;
        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes >= motion.startTime &&
                this.totalSimMinutes < (motion.startTime + motion.duration)) {
                const hrMap = { "Lav": 100, "Medium": 130, "Høj": 160 };
                currentHeartRate = Math.max(currentHeartRate, hrMap[motion.intensity] || 100);

                // Anaerob komponent (høj intensitet): opbyg akut stress
                if (motion.intensity === "Høj") {
                    this.acuteStressLevel = Math.min(2.0,
                        this.acuteStressLevel + 0.02 * simulatedMinutesPassed);
                }
            }
        });

        // --- 4. SÆT HOVORKA-INPUTS OG KØR MODELLEN ---
        const stressMultiplikator = 1.0 + this.acuteStressLevel +
            this.chronicStressLevel + this.circadianKortisolNiveau;

        this.hovorka.insulinRate = totalInsulinRate;
        // Kulhydrater feedes nu via Hovorka's D1→D2 tarm-model (ikke direkte Q1).
        // D1/D2 giver realistisk 2-kompartment absorption med peak ved ~2*τG.
        this.hovorka.carbRate = totalCarbRate;
        this.hovorka.heartRate = currentHeartRate;
        this.hovorka.stressMultiplier = stressMultiplikator;

        // Kør Hovorka ODE'erne for dette tidsstep
        // Ved store tidsstep (høj simuleringshastighed) subdeler vi for stabilitet.
        // Euler-integration er stabil op til ~1 min tidsstep for denne model.
        const maxStepSize = 1.0; // max 1 sim-minut per Euler-step
        let remaining = simulatedMinutesPassed;
        while (remaining > 0) {
            const stepDt = Math.min(remaining, maxStepSize);
            this.hovorka.step(stepDt);
            remaining -= stepDt;
        }

        // Aflæs trueBG fra Hovorka-modellen
        this.trueBG = this.hovorka.glucoseConcentration;
        this.trueBG = Math.max(0.1, this.trueBG);

        // =====================================================================
        // STEEP DROP WARNING — Alert when BG is falling dangerously fast
        // =====================================================================
        // Checks every simulated minute whether BG is low (<4.0) AND falling
        // faster than 0.15 mmol/L per minute. This warns the player to eat
        // before they reach severe hypoglycemia.
        if (this.totalSimMinutes - this.timeOfLastBGDropCheck >= 1) {
            const bgDropPerMinute = this.lastTrueBGForDropCheck - this.trueBG;
            if (this.trueBG < 4.0 && bgDropPerMinute > 0.15) this.showSteepDropWarning();
            this.lastTrueBGForDropCheck = this.trueBG;
            this.timeOfLastBGDropCheck = this.totalSimMinutes;
        }

        // =====================================================================
        // CGM SIMULATION — Continuous Glucose Monitor with realistic imperfections
        // =====================================================================
        // Real CGM sensors (e.g., Dexcom, Libre) don't measure blood glucose directly.
        // They measure interstitial fluid glucose, which:
        //   1. Lags behind blood glucose by 5-10 minutes (diffusion delay)
        //   2. Has random measurement noise (sensor electronics)
        //   3. Has slow systemic drift (sensor degradation, calibration drift)
        //
        // We simulate all three:
        //   cgmBG = delayed_trueBG + randomNoise + systemicDrift
        //
        // CGM updates every 5 simulated minutes (like real CGM sensors).
        // The result is clamped to 2.2-25.0 mmol/L (real sensor range).
        // =====================================================================
        if (this.totalSimMinutes - this.lastCgmCalculationTime >= 5) {
            // Simulate interstitial fluid delay: look up trueBG from 5-10 minutes ago
            const cgmDelayMinutes = 5 + Math.random() * 5;
            let delayedTrueBG = this.trueBG;
            const targetTime = this.totalSimMinutes - cgmDelayMinutes;
            for (let i = this.cgmBGHistory.length - 1; i >= 0; i--) {
                if (this.cgmBGHistory[i].time <= targetTime) {
                    delayedTrueBG = this.cgmBGHistory[i].value;
                    break;
                }
            }

            // Proportional random støj — skalerer med BG-niveau (kalibreret fra Libre 2 data).
            // Ved BG=5: std ≈ 0.15 mmol/L. Ved BG=10: std ≈ 0.30 mmol/L.
            // Bruger Box-Muller transform for normalfordelt støj (mere realistisk end uniform).
            const u1 = Math.random();
            const u2 = Math.random();
            const gaussianNoise = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
            const noiseStd = delayedTrueBG * this.cgmNoiseScale;
            const randomNoise = gaussianNoise * noiseStd;

            // Langsom sinusbølge-drift (sensor-karakteristik, periode 4-8 timer)
            let systemicDeviation = Math.sin(this.totalSimMinutes / this.cgmSystemicPeriod) * this.cgmSystemicAmplitude;

            // Diskontinuiteter — lejlighedsvise spring (kompression, kalibrering, sensor-fejl)
            // Ca. 0.7 per dag (~1 per 400 CGM-målinger). Typisk 2-3 mmol/L spring.
            let discontinuity = 0;
            if (Math.random() < this.cgmDiscontinuityChance) {
                discontinuity = (Math.random() - 0.5) * 4.0; // ±2 mmol/L spring
            }

            // Kombiner alle komponenter
            this.cgmBG = delayedTrueBG + randomNoise + systemicDeviation + discontinuity;
            this.cgmBG = Math.max(2.2, Math.min(25.0, this.cgmBG)); // Sensor range limits
            this.lastCgmCalculationTime = this.totalSimMinutes;

            // Store data points for graph rendering and statistics
            cgmDataPoints.push({ time: this.totalSimMinutes, value: this.cgmBG });
            trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
            this.bgHistoryForStats.push({time: this.totalSimMinutes, cgmBG: this.cgmBG, trueBG: this.trueBG });
            this.cgmBGHistory.push({ time: this.totalSimMinutes, value: this.trueBG });

            // Keep history buffers from growing indefinitely
            if(this.cgmBGHistory.length > 120) this.cgmBGHistory.shift();
            if (cgmDataPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) cgmDataPoints.shift();
            if (trueBgPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) trueBgPoints.shift();
            if (this.bgHistoryForStats.length > (14 * MAX_GRAPH_POINTS_PER_DAY + 10)) this.bgHistoryForStats.shift();

            // Play a tick sound at high simulation speeds for auditory feedback
            if (this.simulationSpeed >= 240) playSound('tick');
        }

        // Clean up expired graph messages
        this.graphMessages = this.graphMessages.filter(msg => this.totalSimMinutes < msg.expireTime);

        // =====================================================================
        // BASAL INSULIN REMINDER — Nudge for new players
        // =====================================================================
        // During the first 3 days, remind the player to take their basal insulin
        // if they haven't done so by morning (8:00-12:00). This teaches the
        // fundamental importance of basal insulin in T1D management.
        if (this.day <= 3 && !this.basalReminderGivenForDay[this.day-1] && currentHour >= 8 && currentHour < 12) {
            const startOfDay = (this.day - 1) * 24 * 60;
            const hasTakenBasalToday = this.logHistory.some(e => e.type === 'insulin-basal' && e.time >= startOfDay);
            if (!hasTakenBasalToday) {
                const existingReminder = this.graphMessages.find(msg => msg.id === `basal_reminder_day_${this.day}`);
                if (!existingReminder) {
                    this.graphMessages.push({
                        id: `basal_reminder_day_${this.day}`,
                        text: "Husk basal insulin!",
                        expireTime: this.totalSimMinutes + (120 * (this.simulationSpeed/60))
                    });
                }
            } else {
                // Basal er taget — fjern eventuel reminder med det samme
                this.graphMessages = this.graphMessages.filter(msg => msg.id !== `basal_reminder_day_${this.day}`);
            }
        }

        // Run end-of-tick housekeeping
        this.updateNormoPoints(simulatedMinutesPassed);
        this.updateWeight();
        this.updateKetones(simulatedMinutesPassed);
        this.updateStats();
        this.checkGameOverConditions();
        this.updateGlucagonStatus();
    }

    // =========================================================================
    // SCORING — Normoglycemia Points
    // =========================================================================
    //
    // Points are earned for time spent in target BG ranges:
    //   - Bonus range (5.0-6.0 mmol/L): 2 points per hour (tight control!)
    //   - Normal range (4.0-10.0 mmol/L): 1 point per hour
    //   - Outside range: 0 points per hour
    //
    // Points are halved during night intervention penalty (to discourage
    // frequent nocturnal corrections — good diabetes management means
    // the night largely runs itself on basal insulin).
    //
    // @param {number} minutesPassed - Simulated minutes elapsed this tick
    // =========================================================================
    updateNormoPoints(minutesPassed) {
        // Check if night penalty has expired
        if (this.totalSimMinutes > this.nightInterventionPenaltyEndTime) this.nightInterventionPenaltyFactor = 1.0;

        // Check for entering bonus range (triggers a pleasant sound)
        const inBonusNow = this.trueBG >= 5.0 && this.trueBG <= 6.0;
        if(inBonusNow && !this.isInBonusRange) {
            playSound('bonus');
        }
        this.isInBonusRange = inBonusNow;

        // Determine point weight based on current BG
        let bgWeight = 0;
        if (inBonusNow) {
            bgWeight = 2;       // Tight control bonus: 2x points
        } else if (this.trueBG >= 4.0 && this.trueBG <= 10.0) {
            bgWeight = 1;       // In range: normal points
        } else {
            bgWeight = 0;       // Out of range: no points
        }

        // Apply night penalty and accumulate points (converted from minutes to hours)
        const finalWeight = this.nightInterventionPenaltyFactor * bgWeight;
        this.normoPoints += (minutesPassed / 60) * finalWeight;

        // Update the UI display showing current point weight
        normoPointsWeighting.textContent = `(x${finalWeight.toFixed(1)})`;
    }

    // =========================================================================
    // NIGHT INTERVENTION PENALTY
    // =========================================================================
    //
    // If the player takes an action (eating, injecting) between 22:00 and 07:00,
    // their point earning rate is halved for `penaltyMinutes` (default: 2 hours).
    //
    // This teaches that well-managed T1D shouldn't require frequent nighttime
    // interventions. If you need to eat or correct at 3 AM, something went wrong
    // earlier in the day (wrong basal dose, wrong dinner bolus, etc.).
    //
    // @param {number} penaltyMinutes - Duration of the half-points penalty (default: 120)
    // =========================================================================
    handleNightIntervention(penaltyMinutes = 120) {
        const currentHour = Math.floor(this.timeInMinutes / 60);
        if (currentHour >= 22 || currentHour < 7) {
            if (this.nightInterventionPenaltyFactor === 1.0) {
                logEvent(`Natlig intervention! Pointoptjening halveret i ${penaltyMinutes/60} timer.`, 'event');
                this.graphMessages.push({
                    id: `night_intervention_${this.totalSimMinutes}`,
                    text: "zZzz... Natlig intervention",
                    expireTime: this.totalSimMinutes + penaltyMinutes
                });
            }
            this.nightInterventionPenaltyFactor = 0.5;
            this.nightInterventionPenaltyEndTime = this.totalSimMinutes + penaltyMinutes;
        }
    }

    /**
     * showSteepDropWarning — Display a visual warning when BG is dropping fast.
     *
     * Shows a red warning overlay on the graph area for 5 seconds (real time).
     * Only shown if not already visible (prevents stacking).
     * Triggered when trueBG < 4.0 AND drop rate > 0.15 mmol/L/min.
     */
    showSteepDropWarning() {
        if (steepDropWarningDiv.style.display === 'block') return;
        steepDropWarningDiv.style.display = 'block';
        playSound('intervention', 'A5', '2n');
        setTimeout(() => { steepDropWarningDiv.style.display = 'none'; }, 5000);
    }

    // =========================================================================
    // PLAYER ACTIONS — Food, Insulin, Exercise
    // =========================================================================

    /**
     * addFood — Player eats a meal with specified macronutrients.
     *
     * Creates a food entry in activeFood[] that will be absorbed over time
     * during subsequent update() calls. Fat slows carb absorption significantly.
     *
     * @param {number} carbs   - Grams of carbohydrate (primary BG impact)
     * @param {number} protein - Grams of protein (secondary BG impact, ~25% of carbs)
     * @param {number} fat     - Grams of fat (slows absorption, no direct BG impact)
     * @param {string} icon    - Emoji icon for the graph/log display (default: fork/knife)
     */
    addFood(carbs, protein, fat, icon = '🍴') {
        this.handleNightIntervention();
        const foodKcal = (carbs * 4) + (protein * 4) + (fat * 9); // Standard calorie calculation
        this.totalKcalConsumed += foodKcal;
        logEvent(`Mad: ${carbs}g K, ${protein}g P, ${fat}g F`, 'food', {kcal: foodKcal, carbs, protein, icon});
        this.activeFood.push({ carbs, protein, fat, startTime: this.totalSimMinutes, carbsAbsorbed: 0, proteinAbsorbed: 0 });
        playSound('intervention', 'E4');
    }

    /**
     * addFastInsulin — Player injects fast-acting (bolus) insulin.
     *
     * Creates an insulin entry in activeFastInsulin[] with randomized
     * pharmacokinetic parameters (onset, peak, duration). This simulates
     * real-world variability — even the same insulin doesn't always act
     * exactly the same way.
     *
     * The randomization ranges roughly match NovoRapid/Humalog profiles:
     *   onset: 10-15 min (time before insulin starts working)
     *   timeToPeak: 45-70+ min (scales with dose — larger doses take longer)
     *   totalDuration: 120-240+ min (scales with dose)
     *
     * Also resets DKA state, since giving insulin addresses the root cause.
     *
     * @param {number} dose - Insulin dose in units (E)
     */
    addFastInsulin(dose) {
        this.handleNightIntervention();
        logEvent(`Hurtig insulin: ${dose}E`, 'insulin-fast', {dose});

        // Randomized pharmacokinetics — each injection is slightly different
        const onset = 10 + Math.random() * 5;                              // 10-15 min
        const timeToPeak = 45 + (dose * 5) + (Math.random() * 20);         // Scales with dose
        const totalDuration = 120 + (dose * 12) + (Math.random() * 60);    // Scales with dose

        this.activeFastInsulin.push({ dose, injectionTime: this.totalSimMinutes, onset, timeToPeak, totalDuration });
        this.lastInsulinTime = this.totalSimMinutes;
        this.resetDKAState(); // Insulin given → DKA crisis averted
        playSound('intervention', 'A4');
    }

    /**
     * addLongInsulin — Player injects long-acting (basal) insulin.
     *
     * Basal insulin provides background glucose control over ~24-36 hours.
     * Duration has some randomness (24-36 hours) to simulate variability.
     *
     * @param {number} dose           - Insulin dose in units (E)
     * @param {number} injectionTime  - When the injection happened (default: now)
     * @param {boolean} isSilent      - If true, skip logging/sound (used for pre-game dose)
     */
    addLongInsulin(dose, injectionTime = this.totalSimMinutes, isSilent = false) {
         if (!isSilent) {
            this.handleNightIntervention();
            logEvent(`Basal insulin: ${dose}E`, 'insulin-basal', {dose});
            this.basalReminderGivenForDay[this.day-1] = true;
            // Fjern basal-reminder fra grafen med det samme
            this.graphMessages = this.graphMessages.filter(msg =>
                !msg.id || !msg.id.startsWith('basal_reminder_day_'));
            playSound('intervention', 'G3');
         }
         // Duration: 24-36 hours (randomized to simulate real-world variability)
         this.activeLongInsulin.push({ dose, injectionTime, totalDuration: (24 + Math.random() * 12) * 60 });
         this.lastInsulinTime = injectionTime;
         this.resetDKAState(); // Insulin given → DKA crisis averted
    }

    /**
     * resetDKAState — Clear all DKA (Diabetic Ketoacidosis) tracking state.
     *
     * Called whenever insulin is administered. Since DKA is caused by insulin
     * deficiency, giving insulin resets the countdown to DKA game over.
     */
    resetDKAState() { this.timeOfHighBGwithInsulinDeficit = 0; this.dkaWarning1Given = false; this.dkaGameOverTime = -1; }

    // =========================================================================
    // STRESS HORMONE UPDATE — Washout and automatic triggers
    // =========================================================================
    //
    // Called once per simulation tick, BEFORE hepatic glucose calculation.
    // Handles two things:
    //   1. Exponential washout (levels naturally decay over time)
    //   2. Automatic triggers (e.g., Somogyi reaction during hypoglycemia)
    //
    // The decay follows first-order kinetics (same math as radioactive decay
    // or drug clearance from blood):
    //   new_level = old_level * e^(-decay_constant * time)
    //   decay_constant = ln(2) / half_life
    //
    // In MATLAB notation: this is solving dC/dt = -k*C analytically.
    //
    // @param {number} simulatedMinutesPassed - Time step size in simulated minutes
    // =========================================================================
    updateStressHormones(simulatedMinutesPassed) {
        // --- Exponential washout ---

        // Acute stress (adrenaline/glucagon): half-life ~60 simulated minutes
        // After 60 min, stress level is halved. After 120 min, quartered. Etc.
        const akutHenfaldskonstant = Math.log(2) / 60;
        this.acuteStressLevel *= Math.exp(-akutHenfaldskonstant * simulatedMinutesPassed);

        // Chronic stress (cortisol from illness/sleep deprivation): half-life ~12 hours
        // Much slower decay — illness effects linger for most of the day.
        const kroniskHenfaldskonstant = Math.log(2) / (12 * 60);
        this.chronicStressLevel *= Math.exp(-kroniskHenfaldskonstant * simulatedMinutesPassed);

        // --- Kontraregulering (glucagon/adrenalin-respons ved lavt BG) ---
        // Kroppen frigiver kontraregulatoriske hormoner når BG falder under ~4 mmol/L.
        // Responsen er gradueret — stærkere jo lavere BG er:
        //   4.0 mmol/L: svag respons (begyndende adrenalin-frigivelse)
        //   3.5 mmol/L: moderat respons (mærkbar glukagon + adrenalin)
        //   2.5 mmol/L: kraftig respons (massiv kontraregulering)
        //
        // Fysiologisk grundlag: Cryer 2013 beskriver tærskler for kontraregulering:
        //   Glukagon: ~3.8 mmol/L, Adrenalin: ~3.8 mmol/L, Kortisol: ~3.2 mmol/L
        //
        // Klinisk betydning: Denne respons kan give "Somogyi rebound" —
        // BG stiger kraftigt efter en hypoglykæmi-episode, især om natten.
        if (this.trueBG < 4.0) {
            // Gradueret respons: stærkere jo lavere BG er
            let hypoStressRate;
            if (this.trueBG < 2.5) {
                hypoStressRate = 0.06;       // Svær hypo — massiv kontraregulering
            } else if (this.trueBG < 3.0) {
                hypoStressRate = 0.04;       // Alvorlig hypo
            } else if (this.trueBG < 3.5) {
                hypoStressRate = 0.02;       // Moderat hypo
            } else {
                hypoStressRate = 0.008;      // Begyndende hypo (3.5-4.0)
            }
            this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + hypoStressRate * simulatedMinutesPassed);
        }

        // Clamp to zero to prevent floating-point drift below zero
        this.acuteStressLevel = Math.max(0, this.acuteStressLevel);
        this.chronicStressLevel = Math.max(0, this.chronicStressLevel);
    }

    // =========================================================================
    // PUBLIC STRESS API — For scenarios and future features
    // =========================================================================
    // These methods allow external code (game scenarios, future "fever" or
    // "sleep deprivation" events) to inject stress into the simulation.

    /**
     * addAcuteStress — Add short-lived stress (decays with half-life ~60 min).
     *
     * Examples: high-intensity exercise, emotional shock, adrenaline rush.
     * An amount of 0.5 represents a moderate stress reaction.
     * Capped at 2.0 to prevent runaway liver glucose production.
     *
     * @param {number} amount - Stress increment (0.0-2.0 scale)
     */
    addAcuteStress(amount) {
        this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + amount);
        logEvent(`Akut stresshormon-stigning: +${amount.toFixed(2)} (fx adrenalin/glukagon)`, 'event');
    }

    /**
     * addChronicStress — Add long-lasting stress (decays with half-life ~12 hours).
     *
     * Examples: illness, fever, sleep deprivation, prolonged psychological stress.
     * An amount of 0.5 represents one night of poor sleep or mild illness.
     * Capped at 1.5 to keep the model stable.
     *
     * @param {number} amount - Stress increment (0.0-1.5 scale)
     */
    addChronicStress(amount) {
        this.chronicStressLevel = Math.min(1.5, this.chronicStressLevel + amount);
        logEvent(`Kronisk stressniveau øget: +${amount.toFixed(2)} (fx kortisol ved sygdom)`, 'event');
    }


    // =========================================================================
    // EXERCISE — Start a workout session
    // =========================================================================
    //
    // Creates an exercise entry in activeMotion[] that affects BG during the
    // workout (aerobic + anaerobic components in update()) and enhances
    // insulin sensitivity for hours afterwards (handled by currentISF getter).
    //
    // Post-exercise sensitivity boost:
    //   - Duration scales with intensity: High=4x, Medium=2x, Low=1x the workout duration
    //   - Magnitude scales with intensity: High=+100%, Medium=+75%, Low=+50% more sensitive
    //   - Fades linearly from max to baseline over the post-exercise period
    //
    // @param {string} intensity - "Lav", "Medium", or "Høj" (Low/Medium/High)
    // @param {string} duration  - Duration in minutes as a string (parsed to int)
    // =========================================================================
    startMotion(intensity, duration) {
        this.handleNightIntervention();
        const durationMinutes = parseInt(duration);

        // Track calories burned for weight change calculation
        let kcalPerMinute = intensity === "Lav" ? 4 : (intensity === "Medium" ? 7 : 10);
        this.totalKcalBurnedMotion += kcalPerMinute * durationMinutes;

        const kcalBurned = kcalPerMinute * durationMinutes;
        logEvent(`Motion: ${intensity}, ${durationMinutes} min (${kcalBurned} kcal)`, 'motion', {intensity, duration: durationMinutes, kcalBurned});

        // Post-exercise insulin sensitivity boost parameters
        let sensitivityDurationMinutes = durationMinutes * (intensity === "Høj" ? 4 : (intensity === "Medium" ? 2 : 1));
        const maxSensIncrease = 1 + (intensity === "Høj" ? 1.0 : (intensity === "Medium" ? 0.75 : 0.5));

        this.activeMotion.push({
            intensity,
            startTime: this.totalSimMinutes,
            duration: durationMinutes,
            sensitivityEndTime: this.totalSimMinutes + durationMinutes + sensitivityDurationMinutes,
            maxSensitivityIncreaseFactor: maxSensIncrease
        });

        // Disable the motion button during the workout
        // (setTimeout uses real time, adjusted by simulation speed)
        startMotionButton.disabled = true;
        setTimeout(() => { startMotionButton.disabled = false; }, durationMinutes * 60 * 1000 / this.simulationSpeed);
        playSound('intervention', 'F4');
    }

    /**
     * performFingerprick — Manual blood glucose measurement.
     *
     * More accurate than CGM but still has ±5% measurement error.
     * In real life, finger prick tests measure capillary blood glucose directly,
     * while CGM measures interstitial fluid glucose (delayed and noisier).
     *
     * The result is displayed as a blood drop emoji on the graph.
     * Incurs only a 30-minute night penalty (vs. 120 for other interventions).
     */
    performFingerprick() {
        this.handleNightIntervention(30); // Shorter night penalty for checking BG
        const measuredBG = this.trueBG * (1 + (Math.random() * 0.1 - 0.05)); // ±5% error
        logEvent(`Fingerprik: ${measuredBG.toFixed(1)} mmol/L`, 'fingerprick', {value: measuredBG.toFixed(1)});
        cgmDataPoints.push({ time: this.totalSimMinutes, value: measuredBG, type: 'fingerprick' });

        // Vis resultatet som popup — giver visuelt feedback udover grafikonen
        const bgColor = measuredBG < 4.0 ? '#e53e3e' : measuredBG > 10.0 ? '#e53e3e' : '#38a169';
        showPopup(
            'Fingerprik resultat',
            `<div style="text-align:center; font-size:1.3em; margin:10px 0;">
                <strong style="color:${bgColor}">${measuredBG.toFixed(1)} mmol/L</strong>
            </div>`,
            false, true, true, false  // isInfoPopup=true → ingen lyd, shouldPause=false
        );
        playSound('intervention', 'B4');
    }

    // =========================================================================
    // KETONE MODEL — Simpel ketonproduktions- og clearancemodel
    // =========================================================================
    //
    // Ketoner stiger når kroppen mangler insulin og ikke kan bruge glukose.
    // I stedet brændes fedt, og ketoner er et biprodukt.
    //
    // Nøglemekanik:
    //   - Stiger ved: insulinmangel (IOB < 0.1, ingen basal) OG høj BG (> 12)
    //   - Falder ved: tilstrækkeligt insulin tilstede
    //   - Hastighed afhænger af graden af insulinmangel og BG-niveau
    //
    // Kliniske grænseværdier (blod-ketoner, mmol/L):
    //   Normal:   < 0.6    — alt ok
    //   Forhøjet: 0.6-1.5  — tag ekstra insulin, drik vand
    //   Farligt:  1.5-3.0  — søg læge, giv insulin
    //   DKA:      > 3.0    — akut livsfarligt
    //
    // @param {number} simMinutes - Simulerede minutter passeret dette tick
    // =========================================================================
    updateKetones(simMinutes) {
        const insulinDeficient = this.iob < 0.1 && this.activeLongInsulin.length === 0;

        if (insulinDeficient && this.trueBG > 12) {
            // Ketonproduktion: hurtigere jo højere BG og jo længere insulinmangel
            // Maks stigning: ~0.5 mmol/L per time ved BG > 20
            const bgFactor = Math.min((this.trueBG - 12) / 8, 1.0); // 0-1, max ved BG=20
            const riseRate = 0.008 * bgFactor; // mmol/L per sim-minut (~0.48/time ved max)
            this.ketoneLevel += riseRate * simMinutes;
        } else {
            // Keton-clearance: insulin hjælper kroppen med at stoppe fedtforbrænding.
            // Halveringstid ~2 timer med insulin tilstede.
            const clearanceRate = 0.006; // mmol/L per sim-minut (~0.36/time)
            this.ketoneLevel -= clearanceRate * simMinutes;
        }

        // Clamp til fysiologisk interval: 0.0 - 10.0 mmol/L
        this.ketoneLevel = Math.max(0.0, Math.min(10.0, this.ketoneLevel));
    }

    /**
     * performKetoneTest — Manuel ketonmåling med blod-ketonstik.
     *
     * Måler det aktuelle ketonniveau med ±10% fejlmargin (ligesom fingerprik).
     * Viser resultatet som en log-besked med farvekodet advarselsniveau.
     * Koster 30-minutters natpenalty (ligesom fingerprik).
     */
    performKetoneTest() {
        this.handleNightIntervention(30);
        const measured = this.ketoneLevel * (1 + (Math.random() * 0.2 - 0.1)); // ±10% fejl
        const measuredClamped = Math.max(0, measured);

        // Bestem advarselsniveau baseret på målt ketonværdi
        // Kliniske grænseværdier for blod-ketoner (β-hydroxybutyrat):
        //   < 0.6: normal (også ved faste kan det stige til 0.5)
        //   0.6–1.5: let forhøjet — kan skyldes faste, keto-diæt, eller begyndende insulinmangel
        //   1.5–3.0: forhøjet — risiko for DKA hvis det skyldes insulinmangel
        //   > 3.0: høj — DKA sandsynlig hvis BG også er høj og der er insulinmangel
        // NB: Faste-ketose kan give 3-4 mmol/L uden fare — kontekst er vigtig!
        let status;
        if (measuredClamped < 0.6) {
            status = 'Normal';
        } else if (measuredClamped < 1.5) {
            status = 'Let forhøjet — kan skyldes faste. Ved højt BG: tag ekstra insulin';
        } else if (measuredClamped < 3.0) {
            status = 'Forhøjet — kontrollér BG og insulin. Ved højt BG + insulinmangel: DKA-risiko';
        } else {
            status = 'Høj — ved højt BG og insulinmangel: akut DKA-risiko! Kontakt læge';
        }

        logEvent(`Keton-stik: ${measuredClamped.toFixed(1)} mmol/L — ${status}`, 'event');

        // Vis resultatet som popup så spilleren faktisk kan se det
        // (logEvent gemmer kun i logHistory som pt. ikke har en synlig liste i UI'en)
        const popupColor = measuredClamped < 0.6 ? '#38a169' : measuredClamped < 1.5 ? '#d69e2e' : measuredClamped < 3.0 ? '#e67e22' : '#e53e3e';
        showPopup(
            'Keton-stik resultat',
            `<div style="text-align:center; font-size:1.3em; margin:10px 0;">
                <strong style="color:${popupColor}">${measuredClamped.toFixed(1)} mmol/L</strong>
            </div>
            <p>${status}</p>
            <p style="font-size:0.85em; color:#666;">
                Normal: &lt; 0.6 · Let forhøjet: 0.6–1.5 · Forhøjet: 1.5–3.0 · Høj: &gt; 3.0<br>
                NB: Faste/keto-diæt kan give 3-4 uden fare. Kontekst er vigtig.
            </p>`,
            false, true, false, true
        );
        playSound('intervention', 'B4');
    }

    /**
     * updateGlucagonStatus — Enable/disable the glucagon button based on cooldown.
     *
     * Glucagon can only be used once every 24 simulated hours (real-life
     * glucagon depletes liver glycogen stores, which take time to replenish).
     */
    updateGlucagonStatus() {
        const cooldownMinutes = 24 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.glucagonUsedTime;
        glucagonButton.disabled = timeSinceUsed < cooldownMinutes;
    }

    /**
     * useGlucagon — Emergency glucagon injection for severe hypoglycemia.
     *
     * Instantly raises BG by 8-12 mmol/L (simulates the liver dumping its
     * entire glycogen reserve into the bloodstream). This is a last resort
     * for BG < 2 mmol/L when the patient can't eat.
     *
     * Capped at 25 mmol/L to prevent unrealistic values.
     * 24-hour cooldown after use (liver needs to replenish glycogen).
     */
    useGlucagon() {
        this.handleNightIntervention();
        logEvent("Glycagon brugt! BG stiger hurtigt.", 'event');
        this.trueBG = Math.min(25, this.trueBG + 8 + Math.random() * 4); // +8 to +12 mmol/L
        this.glucagonUsedTime = this.totalSimMinutes;
        this.updateGlucagonStatus();
    }

    // =========================================================================
    // WEIGHT TRACKING
    // =========================================================================
    //
    // Calculates weight change based on caloric balance:
    //   net_kcal = consumed - (resting_burn + exercise_burn)
    //   weight_change_kg = net_kcal / 7700
    //
    // 7700 kcal ≈ 1 kg of body weight (standard nutritional approximation).
    // The slider color changes: green (stable) → yellow (>1.5 kg) → red (>3.5 kg).
    // Game over at ±5 kg weight change.
    // =========================================================================
    updateWeight() {
        const netKcal = this.totalKcalConsumed - (this.totalKcalBurnedBase + this.totalKcalBurnedMotion);
        this.weightChangeKg = netKcal / KCAL_PER_KG_WEIGHT;
        weightChangeSlider.value = Math.max(-5, Math.min(5, this.weightChangeKg));
        weightChangeValue.textContent = this.weightChangeKg.toFixed(1);

        // Color coding for the weight slider thumb
        const absWeightChange = Math.abs(this.weightChangeKg);
        let thumbColor = '#4CAF50';        // Green: stable weight
        if (absWeightChange > 3.5) thumbColor = '#F44336';      // Red: danger zone
        else if (absWeightChange > 1.5) thumbColor = '#FFC107';  // Yellow: warning
        weightChangeSlider.style.setProperty('--thumb-color', thumbColor);
    }

    // =========================================================================
    // GAME OVER CONDITIONS
    // =========================================================================
    //
    // Checks multiple lethal conditions each tick:
    //
    // 1. SEVERE HYPOGLYCEMIA (trueBG < 1.5 mmol/L)
    //    The brain requires glucose to function. Below ~1.5, loss of
    //    consciousness and death occur rapidly. Immediate game over.
    //
    // 2. EXTREME WEIGHT CHANGE (|weightChange| > 5 kg)
    //    Rapid weight gain/loss indicates severely unbalanced nutrition.
    //
    // 3. DIABETIC KETOACIDOSIS (DKA)
    //    When ALL of these conditions are met simultaneously:
    //      - BG > 12 mmol/L (hyperglycemia)
    //      - IOB < 0.1 (virtually no insulin on board)
    //      - No active basal insulin
    //      - Last insulin > 8 hours ago
    //    Then a DKA timer starts. After 6 hours: warning. After 6+12=18 hours: death.
    //    Giving insulin at any point resets the DKA timer (via resetDKAState).
    //
    // 4. CHRONIC COMPLICATIONS (14-day average BG > 15 mmol/L after day 14)
    //    Sustained hyperglycemia causes damage to blood vessels, nerves, kidneys.
    //    While real complications take years, this provides feedback that
    //    chronically high BG has consequences.
    // =========================================================================
    checkGameOverConditions() {
        if (this.isGameOver) return; // Don't trigger multiple game overs

        // Condition 1: Severe hypoglycemia — instant death
        if (this.trueBG < 1.5) { this.gameOver("GAME OVER", `Hypoglykæmi! Dit sande blodsukker faldt under 1.5 mmol/L.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return; }

        // Condition 2: Extreme weight change
        if (Math.abs(this.weightChangeKg) > 5.0) { this.gameOver("GAME OVER", `Vægtændring! Din vægtændring oversteg 5 kg (${this.weightChangeKg.toFixed(1)} kg).<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return; }

        // Condition 3: DKA — progressive insulin deficiency
        // Check if all DKA preconditions are met
        const insulinDeficient = this.iob < 0.1 && this.activeLongInsulin.length === 0 && (this.totalSimMinutes - this.lastInsulinTime > 8*60);
        if (this.trueBG > 12 && insulinDeficient) {
            // Start the DKA clock if not already running
            if (this.timeOfHighBGwithInsulinDeficit === 0) this.timeOfHighBGwithInsulinDeficit = this.totalSimMinutes;
        } else {
            // Conditions no longer met — reset the clock
            this.timeOfHighBGwithInsulinDeficit = 0;
        }

        // NOTE: Keton-model er nu implementeret (se updateKetones() og performKetoneTest()).
        // Ketoner stiger automatisk ved insulinmangel + høj BG, og spilleren kan måle dem.
        // DKA-advarsler bruger stadig den tidsbaserede model (6+12 timer) som supplement.
        //
        // TODO: DKA model forbedringer:
        // 1. Kobl DKA game-over direkte til ketonniveau (> 3.0 → advarsel, > 5.0 → død)
        //    i stedet for den nuværende rene tidsbaserede model.
        // 2. Tilføj symptom-progression baseret på ketonniveau (tørst, kvalme, opkastning)
        // 3. Research klinisk litteratur for realistisk tidslinje fra onset til bevidstløshed.

        // DKA Warning: after 6 hours of insulin deficiency + high BG
        if (this.timeOfHighBGwithInsulinDeficit > 0 && (this.totalSimMinutes - this.timeOfHighBGwithInsulinDeficit > 6 * 60) && !this.dkaWarning1Given) {
            this.dkaWarning1Given = true;
            this.dkaGameOverTime = this.totalSimMinutes + 12 * 60; // 12 more hours until death
            showPopup("Advarsel: Risiko for Ketoacidose!", "Højt blodsukker og insulinmangel i over 6 timer. Symptomer: tørst, hyppig vandladning, kvalme, træthed. Tag insulin hurtigst muligt!", false, true, false, false);
        }
        // DKA Death: 12 hours after the warning (18 hours total)
        if (this.dkaGameOverTime !== -1 && this.totalSimMinutes >= this.dkaGameOverTime) {
             this.gameOver("GAME OVER", `Diabetisk Ketoacidose! Du reagerede ikke på advarslen om insulinmangel i tide.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return;
        }

        // Condition 4: Chronic complications (after 14 days of gameplay)
        if (this.day > 14) {
            const avg14d = this.calculateAverageBGForPeriod(14 * 24 * 60, true);
            if (avg14d !== null && avg14d > 15.0) {
                this.gameOver(`GAME OVER`, `Sendiabetiske Komplikationer! Dit gennemsnitlige BG over de sidste 14 dage var ${avg14d.toFixed(1)} mmol/L.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return;
            }
        }
    }

    /**
     * calculateAverageBGForPeriod — Compute mean BG over a time window.
     *
     * Used for statistics display and chronic complication detection.
     * Returns null if insufficient data (< 50 data points).
     *
     * @param {number} periodMinutes - Time window to average over (in sim-minutes)
     * @param {boolean} useTrueBG    - If true, use true BG; if false, use CGM BG
     * @returns {number|null} Average BG in mmol/L, or null if not enough data
     */
    calculateAverageBGForPeriod(periodMinutes, useTrueBG = false) {
        const relevantData = this.bgHistoryForStats.filter(p => p.time >= (this.totalSimMinutes - periodMinutes));
        if (relevantData.length < 50) return null; // Not enough data for meaningful average
        const key = useTrueBG ? 'trueBG' : 'cgmBG';
        return relevantData.reduce((sum, p) => sum + p[key], 0) / relevantData.length;
    }

    // =========================================================================
    // STATISTICS — TIR, TITR, averages, insulin/calorie totals
    // =========================================================================
    //
    // Updates the statistics panel with clinical metrics used in real diabetes care:
    //
    // TIR (Time In Range): % of time BG was between 4.0-10.0 mmol/L
    //   Clinical target: >70% for T1D patients
    //
    // TITR (Time In Tight Range): % of time BG was between 4.0-8.0 mmol/L
    //   A stricter version of TIR for tighter control
    //
    // Average CGM: mean CGM glucose over the period
    //   Used to estimate HbA1c (GMI = 3.31 + 0.02392 * mean_glucose_mg/dL)
    //
    // Also tracks 24-hour insulin usage and calorie intake.
    // =========================================================================
    updateStats() {
        const periods = [
            { key: '24h', minutes: 24*60, displays: { tir: tir24hDisplay, titr: titr24hDisplay, avg: avgCgm24hDisplay, fast: fastInsulin24hDisplay, basal: basalInsulin24hDisplay, kcal: kcal24hDisplay }},
            { key: '7d', minutes: 7*24*60, displays: { tir: tir14dDisplay, titr: titr14dDisplay, avg: avgCgm14dDisplay }}
        ];
        periods.forEach(p => {
            const dataPoints = this.bgHistoryForStats.filter(point => point.time >= (this.totalSimMinutes - p.minutes));
            // Kræv mindst 1 times data for 24h, og mindst 1 dags data for 7d
            // (288 = antal 5-min readings pr. dag)
            const minRequired = p.key === '7d' ? 288 : 20;
            if (dataPoints.length > minRequired) {
                let inRangeCount = 0, inTightRangeCount = 0, sumCgm = 0;
                dataPoints.forEach(pt => {
                    sumCgm += pt.cgmBG;
                    // TIR and TITR are based on true BG (not CGM) for accuracy
                    if (pt.trueBG >= 4 && pt.trueBG <= 10) inRangeCount++;
                    if (pt.trueBG >= 4 && pt.trueBG <= 8) inTightRangeCount++;
                });
                p.displays.tir.textContent = ((inRangeCount / dataPoints.length) * 100).toFixed(0) + "%";
                p.displays.titr.textContent = ((inTightRangeCount / dataPoints.length) * 100).toFixed(0) + "%";
                p.displays.avg.textContent = (sumCgm / dataPoints.length).toFixed(1);

                // 24-hour period also shows insulin and calorie totals
                if (p.key === '24h') {
                    let totalFast24h = 0, totalBasal24h = 0, totalKcal24h = 0;
                    this.logHistory.filter(ev => ev.time >= (this.totalSimMinutes - p.minutes)).forEach(ev => {
                        if (ev.type === 'insulin-fast') totalFast24h += ev.details.dose;
                        if (ev.type === 'insulin-basal') totalBasal24h += ev.details.dose;
                        if (ev.type === 'food') totalKcal24h += ev.details.kcal;
                    });
                    p.displays.fast.textContent = totalFast24h.toFixed(1);
                    p.displays.basal.textContent = totalBasal24h.toFixed(0);
                    p.displays.kcal.textContent = totalKcal24h.toFixed(0);

                    // Kaloriebalance: indtag minus forbrug (hvile + motion)
                    // Hvileforbrænding beregnes proportionalt med perioden
                    const periodMinutes = Math.min(this.totalSimMinutes, p.minutes);
                    const restingBurn = this.restingKcalPerMinute * periodMinutes;
                    let motionBurn24h = 0;
                    this.logHistory.filter(ev => ev.time >= (this.totalSimMinutes - p.minutes) && ev.type === 'motion').forEach(ev => {
                        motionBurn24h += ev.details.kcalBurned || 0;
                    });
                    const balance = totalKcal24h - restingBurn - motionBurn24h;
                    if (kcalBalance24hDisplay) {
                        kcalBalance24hDisplay.textContent = (balance >= 0 ? '+' : '') + balance.toFixed(0);
                        kcalBalance24hDisplay.style.color = balance < -200 ? '#e53e3e' : balance > 200 ? '#d69e2e' : '#38a169';
                    }
                }
            } else {
                // Not enough data yet — show placeholder dashes
                Object.values(p.displays).forEach(el => { if(el) el.textContent = '--'; });
                if(p.displays.tir) p.displays.tir.textContent = '--%';
                if(p.displays.titr) p.displays.titr.textContent = '--%';
            }
        });
    }

    /**
     * gameOver — End the simulation with a death screen.
     *
     * Sets isGameOver flag, pauses the game, plays death sound,
     * and shows a popup with the cause of death and final score.
     *
     * @param {string} title   - Popup title (e.g., "GAME OVER")
     * @param {string} message - HTML message explaining the cause of death
     */
    gameOver(title, message) {
        this.isGameOver = true; isPaused = true;
        playSound('gameOver');
        showPopup(title, message, true, false, false, true);
    }
}
