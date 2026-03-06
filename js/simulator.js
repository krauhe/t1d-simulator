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
        this.trueBG = 5.5;             // Starting BG: 5.5 mmol/L (normal fasting level)
        this.cgmBG = 5.5;
        this.cgmBGHistory = [{ time: -5 * 60, value: 5.5 }]; // History buffer for CGM delay
        this.lastCgmCalculationTime = -5;  // Last time CGM was updated (every 5 sim-min)

        // CGM sensor characteristics — each game has slightly different sensor behavior
        // to simulate real-world CGM variability between sensor sessions.
        // cgmSystemicPeriod: period of the slow sine-wave drift (4-8 hours)
        // cgmSystemicAmplitude: amplitude of the drift (0.3-0.7 mmol/L)
        this.cgmSystemicPeriod = (4 + Math.random() * 4) * 60;
        this.cgmSystemicAmplitude = (0.3 + Math.random() * 0.4);

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

        // Pre-administer basal insulin from 16 hours ago (simulates the patient
        // taking their daily Lantus/Tresiba injection yesterday morning at 08:00).
        // The dose is calculated from the patient's ISF using the 100-rule.
        // The `true` flag makes it silent (no log entry or sound).
        this.addLongInsulin(this.basalDose, this.totalSimMinutes - 16 * 60, true);
        this.lastInsulinTime = this.totalSimMinutes - 16 * 60;
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

        // Accumulate all BG changes for this tick, then apply at the end
        let bgChangeThisFrame = 0;

        // Update stress hormone levels (exponential decay + auto-triggers like hypo)
        this.updateStressHormones(simulatedMinutesPassed);

        // =====================================================================
        // HEPATIC GLUCOSE PRODUCTION (HGP) — Liver glucose output
        // =====================================================================
        // The liver constantly releases glucose into the bloodstream to maintain
        // a baseline BG level. This is essential for brain function.
        //
        // Base rate: 0.02 mmol/L per simulated minute.
        // This rate is scaled by the combined stress multiplier:
        //   stressMultiplier = 1.0 + acuteStress + chronicStress + circadianCortisol
        //
        // The dawn effect is NOT a separate mechanism — it's simply cortisol
        // rising as part of the normal circadian rhythm, which increases HGP
        // through the same stress pathway as illness or exercise.
        // =====================================================================
        const currentHour = Math.floor(this.timeInMinutes / 60);
        const stressMultiplikator = 1.0 + this.acuteStressLevel + this.chronicStressLevel + this.circadianKortisolNiveau;
        let liverGlucoseProduction = 0.02 * stressMultiplikator;
        bgChangeThisFrame += liverGlucoseProduction * simulatedMinutesPassed;

        // =====================================================================
        // LONG-ACTING (BASAL) INSULIN — Background insulin absorption
        // =====================================================================
        // Basal insulin (e.g., Lantus, Tresiba) provides a steady background
        // insulin level over ~24 hours. It's modeled with a trapezoidal profile:
        //
        //   effectFactor
        //   1.0 |      ______________
        //       |    /                \
        //       |  /                    \
        //   0.0 |/________________________\___
        //       0  4h  ramp-up  22h  tail  duration
        //
        // Phase 1: Ramp-up (0 to 4 hours) — insulin gradually enters the bloodstream
        // Phase 2: Plateau (4h to 22h) — steady state, full effect
        // Phase 3: Tail-off (22h to end) — insulin is being cleared
        //
        // The BG-lowering rate at any moment = basalRate * effectFactor
        // where basalRate distributes the total dose effect over the duration.
        // =====================================================================
        this.activeLongInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection < 0) return; // Not yet injected (pre-game dose)

            let effectFactor = 0;
            const timeToPlateau = 4 * 60; // 4 hours to reach full effect
            const endOfPlateau = timeToPlateau + 18 * 60; // Plateau lasts 18 hours
            const tailOffDuration = ins.totalDuration - endOfPlateau;

            // Determine which phase we're in and calculate effect factor (0-1)
            if (timeSinceInjection < timeToPlateau) effectFactor = timeSinceInjection / timeToPlateau;
            else if (timeSinceInjection < endOfPlateau) effectFactor = 1.0;
            else if (timeSinceInjection < ins.totalDuration) effectFactor = 1.0 - (timeSinceInjection - endOfPlateau) / tailOffDuration;

            // Calculate BG-lowering rate: total BG effect spread over effective duration
            // dose * ISF = total mmol/L this dose will lower BG by
            // Divided by effective duration (accounting for ramp-up and tail-off)
            const basalRate = (ins.dose * this.currentISF) / (ins.totalDuration - (timeToPlateau + tailOffDuration) * 0.5);
            bgChangeThisFrame -= basalRate * Math.max(0, effectFactor) * simulatedMinutesPassed;
        });
        // Remove expired basal insulin entries
        this.activeLongInsulin = this.activeLongInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        // =====================================================================
        // CARBOHYDRATE AND PROTEIN ABSORPTION — Food processing
        // =====================================================================
        // Food absorption is modeled with a delay + linear absorption rate:
        //
        //   1. Delay phase: stomach emptying takes time, especially with fat/protein
        //      carbAbsorptionStartDelay = 20 + (fat * 0.5) minutes
        //
        //   2. Absorption phase: carbs enter the bloodstream at a steady rate
        //      carbAbsorptionDuration = 40 + (fat * 1.5) + (protein * 0.5) minutes
        //      Fat significantly slows carb absorption (greasy pizza vs. juice)
        //
        //   3. Protein has a secondary, slower effect on BG (~25% of carb effect)
        //      This models gluconeogenesis: the liver converts amino acids to glucose
        //      Protein starts absorbing after 30 minutes, over a much longer duration
        //
        // BG impact per gram of carbs = currentCarbEffect (= ISF / ICR)
        // BG impact per gram of protein = currentCarbEffect * 0.25
        //
        // COB (Carbs On Board) tracks remaining unabsorbed carbs + protein equivalent
        // =====================================================================
        this.cob = 0;
        this.activeFood.forEach(food => {
            const timeSinceConsumption = this.totalSimMinutes - food.startTime;

            // Calculate absorption timing based on macronutrient composition
            let carbAbsorptionDuration = 40 + (food.fat * 1.5) + (food.protein * 0.5);
            let carbAbsorptionStartDelay = 20 + (food.fat * 0.5);

            // Carbohydrate absorption
            if (food.carbsAbsorbed < food.carbs && timeSinceConsumption > carbAbsorptionStartDelay) {
                // Linear absorption: total carbs / duration = rate per minute
                const absorbAmount = Math.min(food.carbs - food.carbsAbsorbed, (food.carbs / carbAbsorptionDuration) * simulatedMinutesPassed);
                bgChangeThisFrame += absorbAmount * this.currentCarbEffect;
                food.carbsAbsorbed += absorbAmount;
            }

            // Protein absorption (delayed, slower, weaker effect than carbs)
            if (food.proteinAbsorbed < food.protein && timeSinceConsumption > 30) {
                 // Protein absorbs over a longer window (180 min + fat delay)
                 // and has only 25% the BG impact of an equal weight of carbs
                 const absorbAmountProtein = Math.min(food.protein - food.proteinAbsorbed, (food.protein / (180 + food.fat * 2)) * simulatedMinutesPassed);
                 bgChangeThisFrame += absorbAmountProtein * this.currentCarbEffect * 0.25;
                 food.proteinAbsorbed += absorbAmountProtein;
            }

            // Update COB: remaining carbs + protein equivalent (at 25% weight)
            this.cob += (food.carbs - food.carbsAbsorbed) + (food.protein - food.proteinAbsorbed) * 0.25;
        });
        // Remove fully absorbed food entries
        this.activeFood = this.activeFood.filter(f => f.carbsAbsorbed < f.carbs || f.proteinAbsorbed < f.protein);

        // =====================================================================
        // FAST-ACTING (BOLUS) INSULIN — Meal/correction insulin
        // =====================================================================
        // Fast-acting insulin (e.g., NovoRapid, Humalog) has a triangular
        // activity profile:
        //
        //   effectiveness
        //   1.0 |        /\
        //       |      /    \
        //       |    /        \
        //   0.0 |__/____________\___
        //       0  onset  peak  duration
        //
        // Phase 1: Onset (10-15 min) — insulin enters the bloodstream, no effect yet
        // Phase 2: Rising (onset to peak) — effect ramps up linearly
        // Phase 3: Falling (peak to end) — effect tapers off linearly
        //
        // Each dose has slightly randomized timing parameters to simulate
        // real-world variability in insulin absorption.
        //
        // IOB (Insulin On Board) is also calculated here — the total remaining
        // active insulin. Important for the player to avoid "stacking" doses.
        //
        // BG-lowering rate = insulinRate * effectiveness
        // where insulinRate = 2 * dose * ISF / effective_duration
        // (the factor of 2 compensates for the triangular profile having
        // half the area of a rectangle with the same base and height)
        // =====================================================================
        this.iob = 0;
        this.activeFastInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection >= ins.onset) {
                let insulinEffectiveness = 0;
                if (timeSinceInjection < (ins.onset + ins.timeToPeak)) insulinEffectiveness = (timeSinceInjection - ins.onset) / ins.timeToPeak;
                else if (timeSinceInjection < ins.totalDuration) insulinEffectiveness = 1 - (timeSinceInjection - (ins.onset + ins.timeToPeak)) / (ins.totalDuration - (ins.onset + ins.timeToPeak));

                // Rate calculation: factor of 2 because triangular area = 0.5 * base * height
                // So to deliver the full dose effect, the peak rate must be 2x the average.
                const insulinRate = (2 * ins.dose * this.currentISF) / (ins.totalDuration - ins.onset);
                bgChangeThisFrame -= insulinRate * Math.max(0, insulinEffectiveness) * simulatedMinutesPassed;

                // Calculate remaining IOB for this dose
                const remainingDuration = ins.totalDuration - timeSinceInjection;
                if (remainingDuration > 0) {
                    // IOB decreases as insulin is used up. Before peak: full dose remains.
                    // After peak: proportional to remaining time in the tail.
                    let iobFactor = (timeSinceInjection < (ins.onset + ins.timeToPeak)) ? 1 : (remainingDuration / (ins.totalDuration - (ins.onset + ins.timeToPeak)));
                    this.iob += ins.dose * Math.max(0, iobFactor);
                }
            }
        });
        // Remove expired fast insulin entries
        this.activeFastInsulin = this.activeFastInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        // =====================================================================
        // EXERCISE EFFECTS — Aerobic and anaerobic components
        // =====================================================================
        // Exercise affects BG through two competing mechanisms:
        //
        // 1. AEROBIC (all exercise): Muscles take up glucose directly via GLUT4
        //    transporters, independent of insulin. This LOWERS BG.
        //    Rate depends on intensity: Low=1.0, Medium=2.0, High=3.0 mmol/L per 10 min
        //    Small random variation (±20%) simulates real-world variability.
        //
        // 2. ANAEROBIC (high intensity only): The body releases catecholamines
        //    (adrenaline/noradrenaline) which stimulate the liver to dump glucose.
        //    This RAISES BG and partially counteracts the aerobic effect.
        //    Also builds up acuteStressLevel, which continues to drive liver
        //    glucose output AFTER the exercise session ends.
        //
        // Net effect:
        //   - Low/Medium intensity → BG drops (aerobic dominates)
        //   - High intensity → BG drops less, or may even rise transiently
        //     (anaerobic partially or fully counteracts aerobic)
        //   - Post-exercise: increased insulin sensitivity for hours (handled by
        //     currentISF getter, not here)
        //
        // Key learning point for new T1D patients:
        //   Cardio without reducing insulin → risk of hypoglycemia!
        //   Strength training may require correction insulin afterwards.
        // =====================================================================
        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes >= motion.startTime && this.totalSimMinutes < (motion.startTime + motion.duration)) {
                // Aerobic component: direct muscle glucose uptake → BG drops
                let bgDropPer10min = (motion.intensity === "Lav") ? 1.0 : (motion.intensity === "Medium") ? 2.0 : 3.0;
                bgChangeThisFrame -= (bgDropPer10min / 10) * (1 + (Math.random()*0.4-0.2)) * simulatedMinutesPassed;

                // Anaerobic component (high intensity only):
                // Catecholamines (adrenaline/noradrenaline) are released and do two things:
                //   1. Directly stimulate the liver to release extra glucose (0.05 mmol/L/min)
                //   2. Build up acute stress that persists AFTER the workout ends
                // This means BG may rise or fall less than expected during hard training.
                if (motion.intensity === "Høj") {
                    // Direct catecholamine-driven liver glucose during exercise
                    bgChangeThisFrame += 0.05 * simulatedMinutesPassed;
                    // Build acute stress level (decays after exercise via washout)
                    this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + 0.02 * simulatedMinutesPassed);
                }
            }
        });

        // =====================================================================
        // APPLY BG CHANGE AND CLAMP
        // =====================================================================
        // Apply the net BG change from all sources, then clamp to physiological minimum.
        // BG below 0.1 mmol/L is not physiologically possible (you'd be dead already).
        this.trueBG += bgChangeThisFrame;
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

            // Add random noise (electronics noise, ±0.075 mmol/L)
            const randomNoise = (Math.random() - 0.5) * 0.15;

            // Add slow sinusoidal drift (sensor characteristic, period = 4-8 hours)
            let systemicDeviation = Math.sin(this.totalSimMinutes / this.cgmSystemicPeriod) * this.cgmSystemicAmplitude;

            // Combine all components
            this.cgmBG = delayedTrueBG + randomNoise + systemicDeviation;
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
                        text: "Husk Basal Insulin (Normal dosis ca. 10E)",
                        expireTime: this.totalSimMinutes + (120 * (this.simulationSpeed/60))
                    });
                }
            }
        }

        // Run end-of-tick housekeeping
        this.updateNormoPoints(simulatedMinutesPassed);
        this.updateWeight();
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

        // --- Somogyi Effect (counter-regulatory response to hypoglycemia) ---
        // When BG drops below 3.5 mmol/L, the body detects danger and releases
        // glucagon + adrenaline as a counter-regulatory defense mechanism.
        // This is an automatic protective response.
        //
        // The effect is stronger during severe hypo (<2.5) than mild hypo (2.5-3.5).
        //
        // Clinical significance: This can cause BG to "rebound" to high levels
        // after a hypoglycemic episode — especially problematic during nighttime
        // hypos where the patient is asleep and can't intervene.
        if (this.trueBG < 3.5) {
            const hypoStressRate = this.trueBG < 2.5 ? 0.04 : 0.015;
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

        logEvent(`Motion: ${intensity}, ${durationMinutes} min`, 'motion', {intensity, duration: durationMinutes});

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

        // TODO: DKA model improvements needed:
        //
        // 1. TIMELINE FOR DEATH:
        //    Research clinical literature for realistic timeline.
        //    Current model: warning after 6 hours of high BG + insulin deficit,
        //    game over 12 hours after warning (i.e., ~18 hours total).
        //    Question: When does loss of consciousness occur? When is it fatal?
        //    Hint: Untreated DKA can be fatal within 24-72 hours,
        //    but severe symptoms (altered consciousness) typically occur earlier.
        //
        // 2. KETONE MODEL:
        //    In reality, it's ketones (acids produced when the body burns fat
        //    instead of glucose due to insulin deficiency) that are the actual
        //    killing mechanism — not high glucose alone.
        //    A future model could include:
        //      - Ketones rise when: BG > 12 AND insulin deficit AND time
        //      - Ketone rate depends on degree of insulin deficit and BG level
        //      - Player can measure ketones with "ketone strips" (like finger prick)
        //      - Symptom thresholds: mild (0.6-1.5) → warning,
        //        moderate (1.5-3.0) → strong warning + symptoms,
        //        severe (> 3.0) → DKA, game over approaching
        //      - Insulin + fluids lower ketones over time
        //
        // 3. STRESS HORMONES / HEPATIC GLUCOSE OUTPUT:
        //    Consider adding a unified "stress hormone parameter" that drives
        //    liver glucose production. The current model has this partially
        //    implemented (see updateStressHormones), but could be extended.

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
            { key: '14d', minutes: 14*24*60, displays: { tir: tir14dDisplay, titr: titr14dDisplay, avg: avgCgm14dDisplay }}
        ];
        periods.forEach(p => {
            const dataPoints = this.bgHistoryForStats.filter(point => point.time >= (this.totalSimMinutes - p.minutes));
            if (dataPoints.length > 20) {
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
                    p.displays.fast.textContent = totalFast24h.toFixed(1) + " E";
                    p.displays.basal.textContent = totalBasal24h.toFixed(0) + " E";
                    p.displays.kcal.textContent = totalKcal24h.toFixed(0) + " kcal";
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
