// =============================================================================
// SIMULATOR.JS — Core physiological simulation engine
// =============================================================================
//
// This file contains the Simulator class, which is the heart of the game.
// It models the key physiological processes of Type 1 Diabetes:
//
//   1. Blood glucose (BG) dynamics — rises from food, falls from insulin
//   2. Insulin pharmacokinetics — absorption, activity, and clearance
//   3. Carbohydrate absorption — delayed by fat content (pizza effect)
//   3b. Protein absorption — amino acids → glucagon → hepatic glucose production
//   4. Exercise effects — aerobic (BG-lowering) and anaerobic (BG-raising)
//   5. Stress hormones — cortisol, glucagon, adrenaline affecting liver output
//   6. Circadian rhythm — dawn effect (morning cortisol peak)
//   7. CGM simulation — realistic sensor delay, noise, and systemic drift
//   8. Ketone model — FFA-driven (lipolysis → CPT-1 → BHB), insulin-regulated
//   9. Game mechanics — scoring, game over conditions (hypo, DKA, weight)
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

// =============================================================================
// AKTIVITETSTYPER — Data-driven definition of all activity types
// =============================================================================
//
// Each activity type has its own physiological parameters that determine
// how it affects blood glucose, heart rate, stress, and insulin sensitivity.
//
// Key parameters:
//   hrTarget:        Target heart rate per intensity level [bpm]
//   contractionUptakeScaling:
//                    Relativ kontraktionsmedieret, insulin-uafhængig optagelse [0-1]
//   fastSensitivityScaling / earlySensitivityScaling / lateSensitivityScaling:
//                    Aktivitetsspecifik størrelse af hver PEIS-fase [0-1]
//   insulinSensitivityDelayMin:
//                    Ren tidsforsinkelse før motionsfølsomheden begynder [min]
//   glycogenUseScaling:
//                    Relativt bidrag fra muskelglykogen til energiforbruget [0-1]
//   hepaticDriveRate:
//                    Katekolamin-medieret leverrespons pr. simulationsminut
//   hepaticDriveCeiling:
//                    Maksimal ekstra leverrespons for aktiviteten
//   kcalPerMin:      Calorie expenditure per minute
//   stressReduction: Stress reduction per simulation minute (relaxation activities only)
//   vasodilatation:  Temporary ISF improvement during activity (relaxation activities only)
//   farve:           Color for graph bands and UI elements
//
// Scientific basis:
//   - Cardio: Riddell et al. 2017 (Lancet), Resalat et al. 2020 (E1/E2 model)
//   - Strength training: Yardley et al. 2013 (Diabetes Care), Bally et al. 2015 (HIIT)
//   - Mixed sport: Riddell 2017 ("mixed = glucose stability"), PMC6768890 (football)
//   - Relaxation: PMC10534311 (mindfulness meta-analysis), PMC8798588 (yoga+HPA axis)
// =============================================================================
// Weight game-over: the limit is a fraction of STARTING WEIGHT (proportional), so it is
// fair for both children and adults. 0.07 = 7% ≈ 4.9 kg for a 70 kg person and ~2.1 kg
// for a 30 kg person. A fixed kg limit was unreasonably strict for lighter players.
// Defined here (not in main.js) so simulator.js is self-contained in the test harness.
const WEIGHT_GAMEOVER_FRACTION = 0.07;

const AKTIVITETSTYPER = {
    cardio: {
        navn: "Cardio",
        icon: "assets/icons/app/activity-shoe.png",
        eksempler: "Løb, cykling, svømning",
        // Target heart rate: moderate to high — drives contraction and perfusion.
        hrTarget: { Lav: 100, Medium: 130, Høj: 160 },
        contractionUptakeScaling: 1.0,
        fastSensitivityScaling: 1.0,
        earlySensitivityScaling: 1.0,
        lateSensitivityScaling: 1.0,
        insulinSensitivityDelayMin: 0,
        glycogenUseScaling: 1.0,
        // Stress: none at low/medium, mild at high (prolonged intense cardio)
        hepaticDriveRate: { Lav: 0, Medium: 0, Høj: 0.005 },
        hepaticDriveCeiling: { Lav: 0, Medium: 0, Høj: 0.40 },
        kcalPerMin: { Lav: 4, Medium: 7, Høj: 10 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#10b981",      // Green
    },
    styrke: {
        navn: "Styrketræning",
        icon: "assets/icons/app/activity-strength.png",
        eksempler: "Vægttræning, crossfit, kropsvægt",
        // Lower heart rate than cardio — strength training is interval-based
        hrTarget: { Lav: 85, Medium: 110, Høj: 135 },
        // Kalibreret mod Young et al. 2023: over 45 minutter giver denne værdi
        // ca. 1,23 mmol/L ekstra ikke-insulinmedieret glukoseoptagelse.
        contractionUptakeScaling: 0.55,
        // Young et al. 2023 fandt uændret insulinmedieret optagelse under og
        // gennem den tidlige recovery efter et 45-minutters styrkepas. Derfor
        // er den hurtige PEIS-fase slået fra. De mindre early/late-skalaer
        // bevarer en moderat senere effekt, inklusive ca. 12% højere disposal
        // efter 24 timer (Breen et al. 2011).
        fastSensitivityScaling: 0.0,
        earlySensitivityScaling: 0.45,
        lateSensitivityScaling: 0.45,
        // 120 minutter fra start svarer ved et 60-minutters pas til, at den
        // senere følsomhed først bygges op efter den første recovery-time.
        insulinSensitivityDelayMin: 120,
        glycogenUseScaling: 0.90,
        // Medium giver ca. 1,04 mmol/L ekstra EGP-AUC over 45 minutter, så
        // leverproduktion og muskeloptag omtrent balancerer som hos Young et al.
        // Fælles undervisningskalibrering: 1,25 x den litteraturcentrerede
        // leverrespons gør den mulige BG-stigning synlig uden individuelle
        // responderprofiler. Muskeloptaget og PEIS ændres ikke.
        hepaticDriveRate: { Lav: 0.010, Medium: 0.020, Høj: 0.03125 },
        hepaticDriveCeiling: { Lav: 0.3125, Medium: 0.75, Høj: 1.25 },
        kcalPerMin: { Lav: 3, Medium: 5, Høj: 8 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#ef4444",      // Red
    },
    blandet: {
        navn: "Blandet sport",
        icon: "assets/icons/app/activity-ball.png",
        eksempler: "Fodbold, badminton, håndbold",
        // High heart rate — mixed sport is often intense (sprints + cardio base)
        hrTarget: { Lav: 105, Medium: 135, Høj: 165 },
        // Weighted ~65% cardio / ~35% anaerobic → moderate GLUT4 + moderate stress
        // Riddell 2017: "mixed activities are associated with glucose stability"
        contractionUptakeScaling: 0.45,
        fastSensitivityScaling: 0.85,
        earlySensitivityScaling: 0.85,
        lateSensitivityScaling: 0.85,
        insulinSensitivityDelayMin: 10,
        glycogenUseScaling: 0.85,
        // Moderate stress from intermittent sprints
        hepaticDriveRate: { Lav: 0.003, Medium: 0.006, Høj: 0.012 },
        hepaticDriveCeiling: { Lav: 0.20, Medium: 0.40, Høj: 0.65 },
        kcalPerMin: { Lav: 5, Medium: 8, Høj: 12 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#f59e0b",      // Orange
    },
    afslapning: {
        navn: "Afslapning",
        icon: "assets/icons/app/activity-yoga.png",
        eksempler: "Yoga, meditation, udstrækning",
        // Umbrella category: low = quiet meditation, medium/high = yoga or stretching
        hrTarget: { Lav: 58, Medium: 65, Høj: 75 },
        contractionUptakeScaling: 0.01, // Weak effect during yoga/stretching
        fastSensitivityScaling: 0.0,
        earlySensitivityScaling: 0.0,
        lateSensitivityScaling: 0.0,
        insulinSensitivityDelayMin: 0,
        glycogenUseScaling: 0.0,
        hepaticDriveRate: { Lav: 0, Medium: 0, Høj: 0 },
        hepaticDriveCeiling: { Lav: 0, Medium: 0, Høj: 0 },
        kcalPerMin: { Lav: 1.5, Medium: 2, Høj: 2.5 },
        // REDUCES stress — parasympathetic activation suppresses HPA axis
        // PMC10534311: mindfulness improves glycemic control via stress reduction
        stressReduction: { Lav: 0.005, Medium: 0.01, Høj: 0.015 },
        // Peripheral vasodilation → mild ISF improvement during activity
        // AHA: insulin-mediated vasodilation is functionally coupled to glucose uptake
        vasodilatation: { Lav: 0.02, Medium: 0.03, Høj: 0.05 },
        farve: "#8b5cf6",      // Purple
    }
};

class Simulator {
    // =========================================================================
    // CONSTRUCTOR — Initialize all simulation state
    // =========================================================================
    //
    // Sets up the initial conditions for a new game. The player starts at
    // midnight (timeInMinutes = 0) with stable blood glucose (5.5 mmol/L)
    // and a pre-administered basal insulin dose from 16 hours ago (simulating
    // that the simulated character received long-acting insulin the previous morning).
    //
    // The constructor accepts an optional profile object with model parameters
    // (weight, ICR, ISF) for the simulated subject. If no profile is given,
    // sensible defaults are used. The profile drives all derived calculations:
    // basal insulin dose, resting calorie burn, etc.
    //
    // In MATLAB terms, this is like setting up your initial conditions vector
    // before running ode45 — all state variables start here.
    //
    // @param {object} profile          - Optional simulated-subject profile
    // @param {number} profile.weight   - Body weight in kg (default: 70)
    // @param {number} profile.icr      - Insulin-to-Carb Ratio in g/E (default: 10)
    // @param {number} profile.isf      - Insulin Sensitivity Factor in mmol/L per E (default: 3.0)
    // =========================================================================
    constructor(profile = {}, gameMode = 'sandbox', options = {}) {
        // Den offentlige Insights-visning gemmer kun den faste karakters id. De
        // fysiologiske værdier slås fortsat op i archetypes.js og kan ikke ændres
        // gennem det scenarie, som sendes videre fra en spillet bane.
        const fallbackCharacterId = (typeof DEFAULT_CHARACTER_ID !== 'undefined')
            ? DEFAULT_CHARACTER_ID
            : 'erik';
        this.characterId = profile.characterId || fallbackCharacterId;
        // --- Physiology engine (slice S1) ---
        // Simulator is the facade; the physiological core lives in PhysiologyEngine
        // (js/physiology-engine.js). For now the engine owns the seeded RNG source
        // and gaussRand; Simulator borrows the rng (this.rng) so existing call
        // sites are unchanged and bit-identical. Later slices move more physiology
        // into the engine. Without options.seed the engine picks a random seed
        // (varied gameplay); tests/golden-master supply a fixed seed.
        // See docs/reviews/2026-06-14_physiology-engine-api-plan.md.
        // CGM-sensorfejl er en bevidst del af bane 10 ("Uforudsigelighed").
        // I alle andre spiltilstande og baner bevarer CGM'en sin almindelige
        // forsinkelse og målevariation, men går ikke i selvtest, warmup eller
        // sensor-tab. Det holder de tidlige læringsbaner fokuserede på fysiologien.
        const cgmSensorFaultsEnabled = gameMode === 'campaign'
            && options.levelConfig?.physics?.cgmSensorFaultsEnabled === true;
        this.engine = createEngine(profile, {
            seed: options.seed,
            modules: { cgmSensorFaults: cgmSensorFaultsEnabled },
        });
        this._seed = this.engine._seed;
        this.rng = this.engine.rng;

        // --- Time tracking ---
        // day/timeInMinutes/totalSimMinutes are now owned by the engine (S7.2) and
        // advanced in engine.step(). Exposed here via proxy accessors — see below.
        this.simulationSpeed = parseInt(speedSelector.value); // Real-seconds to sim-minutes ratio
        this.isGameOver = false;        // Flag to stop simulation on death
        this.gameMode = gameMode;       // Game mode: 'sandbox', 'boxchallenge', 'campaign'
        // Level config is INJECTED: the facade no longer reaches into the global
        // campaignEngine.levelConfig. The controller (game.js) passes the active
        // campaign level's config here; it is null outside campaign mode. This keeps
        // the facade usable by other environments without a campaignEngine global.
        this.levelConfig = options.levelConfig || null;

        // --- Tip-trackers (used by GLOBAL gameplay tips) ---
        // lastSpeedChangeTime/lastPauseTime: sim-min when the action last occurred (-Infinity = never).
        // _speedEverChanged: has the player EVER touched the speed buttons in this sim session?
        // Used for "do not show speed/idle tip if the player already knows the buttons".
        this.lastSpeedChangeTime = -Infinity;
        this.lastPauseTime = -Infinity;
        this._speedEverChanged = false;
        // lastActionTime: last sim-min the player performed a player-action
        // (food, exercise, insulin, finger prick). Used for 'idle' detection in tips.
        this.lastActionTime = 0;

        // --- Simulated-subject parameters ---
        // weight, ISF and ICR are now owned by the engine (set in the PhysiologyEngine
        // constructor from the profile). Simulator reads them via proxy getters below,
        // so this.weight/this.ISF/this.ICR work unchanged. Slice S2.

        // Weight game-over: the limit is proportional to starting weight (7%), so it is
        // fair for both children (~2.1 kg at 30 kg) and adults (~4.9 kg at 70 kg).
        // (weightLimitKg is a game-mechanic limit and stays on the facade.)
        this.weightLimitKg = WEIGHT_GAMEOVER_FRACTION * this.weight;

        // --- Hovorka physiological model ---
        // The engine now owns the Hovorka 2004 model (S9.1): it is built in the
        // PhysiologyEngine constructor from the profile, and the subject's ISF is mapped
        // to the model's insulin-sensitivity scale via HOVORKA_REFERENCE_ISF (=3.75).
        // The facade accesses the model via the this.hovorka proxy (see getter below).
        this.engine.attachScenarioRunner({
            step: minutes => this._stepEngineScenario(minutes),
            applyEvent: event => this._applyEngineScenarioEvent(event),
            getSample: () => this._getEngineScenarioSample()
        });

        // S8-C3: engine.step() now owns the ENTIRE physiology tick standalone (no
        // facade stepper). The facade calls engine.step() in _tickPhysiology() and
        // runs game post-processing in _postStep() afterwards.

        // gramsPerMmolRise (ICR/ISF) is now owned by the engine — see proxy getters below.

        // restingKcalPerDay/restingKcalPerMinute and the basal contract
        // (effectiveBasalRequirement, basalInjectionRequirement and basalDose)
        // are now owned by the engine — see proxy getters below.

        // --- Blood glucose state ---
        // trueBG/cgmBG are owned by the engine and exposed here via proxy accessors.
        // trueBG is the actual blood glucose value; cgmBG is the player's CGM
        // reading with delay/noise relative to trueBG, as with real sensors.
        // _lastPhysioRecordTime (sampling cadence) is now owned by the engine (S7.6c) — proxy below.

        // Steep drop detection — warns player when BG is falling dangerously fast
        this.lastTrueBGForDropCheck = this.trueBG;
        this.timeOfLastBGDropCheck = 0;

        // --- Active effects arrays ---
        // These arrays hold currently active food, insulin, and exercise "objects".
        // Each entry tracks its own timing and absorption progress.
        // Think of it like tracking multiple differential equations simultaneously —
        // each food item, insulin dose, and exercise session has its own state.
        // --- Food intake queue (drip mechanism) ---
        // When addFood() is called, the meal's physical stomach contribution (fat, protein,
        // weight, carbs-blend variables) is NOT placed directly in the stomach — it is
        // dripped in over its eatTimeMin. Each entry contains rates per sim-min for each
        // of the stomach's 7 state variables and a remainingMin counter decremented per substep.
        // _processActiveIntake(dt) processes the queue every substep and removes expired entries.
        // --- Stomach capacity (gastric volume) ---
        // Tracks total food weight in the stomach (grams). Emptied at rate τG (same as fat/protein).
        // When the stomach is full the player cannot eat more — natural cooldown.
        // Capacity: ~1000-1500 g for adults, scaled with body weight.
        // Source: Geliebter 1988, Delgado-Aros 2004
        // STOMACH_* constants are now owned by the engine (S7.4b) — read via getter proxy.

        // --- Stomach mixing state (CSTR model: everything mixed in a single compartment) ---
        // These variables describe the COMPOSITION of the current stomach contents
        // and are used by _substepFatProteinFFA() to compute the dynamic τG
        // as a function of the mixture's carb type. Ratios (simpleFraction,
        // fiber/g, retentionFactor) are preserved during emptying by scaling all four
        // variables proportionally with stomachContentGrams.
        //
        // When a food item is consumed, variables are incremented additively in addFood():
        //   stomachCarbsTotal   += food.carbs
        //   stomachCarbsSimple  += food.carbs * carbType.simpleFraction
        //   stomachFiber        += food.carbs * carbType.fiberPerGram
        //   stomachRetentionWeight += foodWeight * carbType.retentionFactor
        //
        // During emptying in _substepFatProteinFFA():
        //   ratio = stomachContentGrams_after / stomachContentGrams_before
        //   all four variables * ratio
        //
        // This preserves physically plausible mass conservation: the stomach cannot lose
        // simple sugars faster than fiber — everything empties proportionally.
        // Active activity — only one at a time. null = no activity in progress.
        // Contains: { type, intensitet, startTime, varighed, typeDef, kcalPerMin }

        // --- Fat compartments (pizza effect) ---
        // Fat in the stomach and intestine models fat's delay of carbohydrate absorption.
        // Fat in the intestine is the physiologically active variable: it triggers
        // CCK/GLP-1 hormones that signal the stomach to empty more slowly (increased τG).
        //
        // Flow: food → fatStomach →(τG)→ fatIntestine →(τFatAbs)→ absorbed
        //
        // τFatAbs = 150 min (fat is absorbed slowly: bile emulsification + lipase cleavage)
        // Effect: τG = 40 + 18 × ln(1 + fatIntestine / 10)
        //
        // Sources: Smart 2013, Wolpert 2013, Lodefalk 2008, Gentilcore 2006
        // TAU_FAT_ABS is now owned by the engine (S7.4b) — read via getter proxy.

        // --- FFA-induced insulin resistance (postprandial fat effect, "second wave") ---
        //
        // Free fatty acids (FFA) from fat absorption impair insulin action in muscle.
        // Mechanism: FFA → DAG + ceramides → PKC-θ activation → IRS-1 blockade
        //            → reduced GLUT4 translocation → ↓ insulin sensitivity
        //
        // Time course after a fat-containing meal (Wolpert 2013):
        //   Onset:    ~2-4 hours (FFA must be absorbed from intestine and accumulate)
        //   Peak:     ~5-6 hours
        //   Duration: 5-10 hours
        //   60 g fat → 42% more insulin required
        //
        // Flow: fatIntestine →(τFatAbs)→ absorbed → ffaBlood →(clearance)→ 0
        //                                                ↓
        //                                        Hill function → ffaResistanceFactor
        //                                                ↓
        //                                        currentISF / ffaResistanceFactor
        //
        // Sources: Wolpert 2013, Gormsen 2017, Roden 1996, Boden 2001
        // FFA_CLEARANCE_HALF/FFA_RESIST_MAX/FFA_EC50/FFA_HILL_N are now owned by
        // the engine (S7.4b) — read via getter proxy.

        // --- Protein compartments (glucagon-driven HGP) ---
        // Protein is modelled as amino acid absorption that stimulates glucagon secretion.
        // In T1D the patient has no endogenous insulin response to counteract the glucagon,
        // so amino acids drive an unopposed HGP increase via the liver.
        //
        // This is the PRIMARY mechanism — NOT direct gluconeogenesis from protein.
        // Isotope studies show only 4-19% conversion (Fromentin 2013, Nuttall 2001),
        // but the BG rise in T1D is far larger due to the glucagon effect (Paterson 2016).
        //
        // Flow: food → proteinStomach →(τG)→ proteinGut →(τProtAbs)→ aminoAcidsBlood
        //                                                                    ↓
        //                                                          glucagon stimulation
        //                                                                    ↓
        //                                                          proteinGlucagonLevel → EGP
        //
        // Time course (from Paterson 2016):
        //   Onset:    ~60-90 min (amino acids must be absorbed from the gut first)
        //   Peak:     ~150-180 min (3 hours after meal)
        //   Duration: >5 hours (slow clearance)
        //
        // Dose-response (Paterson 2016):
        //   <75 g protein alone: minimal BG effect (incretins dominate)
        //   ≥75 g protein alone: +1.6-1.7 mmol/L at 4-5 hours
        //   In a mixed meal: effect from as little as ~12.5 g (insulin covers CHO, not glucagon)
        //
        // Sources: Paterson 2016, Smart 2013, Gannon & Nuttall 2001/2013,
        //          Fromentin 2013, Bell 2015/2020, Bengtsen 2021
        // TAU_PROT_ABS and AA_DECAY_RATE are now owned by the engine (S7.4b) — getter proxy.
        // Glucagon stimulation: Hill function with threshold
        // EC50=8: half-maximal effect at ~8 g amino acids in blood
        // Hill n=2: moderately steep S-curve (threshold effect without on/off switch)
        // maxGlucagon=0.25: max BG rise ~25% of EGP (matches Paterson: +1.7 mmol/L at 75 g)
        // AA_EC50, AA_HILL_N and PROTEIN_GLUCAGON_MAX are now owned by the engine (S7.4b) — getter proxy.

        // --- Aggregate state ---
        // --- Brain energy deficit (neuroglycopenia) ---
        //
        // The brain consumes ~120 g glucose/day (F_01 in the Hovorka model).
        // Below BG 2.5 mmol/L, GLUT1 transport cannot deliver enough glucose to the brain.
        // The shortfall accumulates as an energy deficit:
        //
        //   deficitRate = F_01 × (1 - BG / 2.5)    [mmol/min]
        //
        // Short duration at low BG is survivable (brain glycogen reserve ~4 g).
        // But sustained deficit → neuroglycopenia → loss of consciousness → brain damage.
        //
        // Calibration (70 kg, F_01 = 0.679 mmol/min):
        //   BG 2.0: deficit 0.136/min → game over ~59 min
        //   BG 1.5: deficit 0.272/min → game over ~29 min
        //   BG 1.0: deficit 0.407/min → game over ~20 min
        //   BG 0.5: deficit 0.543/min → game over ~15 min
        //
        // Sources: Oz 2007 (brain glycogen ~4 g), Cryer 2007 (neuroglycopenia thresholds)
        // BRAIN_* constants are now owned by the engine (S7.4c) — read via getter proxy.
        // brainDeficitWarningGiven (internal guard) is now owned by the engine (S7.5b) — proxy.

        // --- Acidosis load model (metabolic acidosis from ketones) ---
        //
        // Ketone acids (BHB + acetoacetate) lower blood pH. The body has a
        // bicarbonate buffer system that neutralises a certain acid load,
        // but with sustained elevated ketones the buffer is exhausted and pH falls
        // → organ failure → death.
        //
        // Modelled identically to brainEnergyDeficit:
        //   - acidosisLoad accumulates when ketoneLevel > ACIDOSIS_BHB_THRESHOLD
        //   - Rate proportional + quadratic with BHB excess (pH is logarithmic)
        //   - Recovery via exponential decay when BHB falls below threshold
        //   - Warning at 50%, game over at 100%
        //
        // Insulin does NOT reset acidosisLoad — it lowers ketones over time
        // (via the FFA model), which then allows natural recovery.
        //
        // Calibration (re-calibrated 2026-03-22):
        //   Old values (THRESHOLD=200, BASE=1.0, ACCEL=0.15) were far too aggressive:
        //   game over at BHB ~4.1 after pump failure — clinically unrealistic.
        //
        //   Real DKA progression with total insulin deficiency:
        //     4-8h:  BHB 1-3, mild acidosis. Patient nauseous but alive.
        //     8-16h: BHB 3-7, moderate acidosis. Vomiting, dehydration.
        //     16-24h: BHB 7-15+, severe acidosis. Impaired consciousness.
        //     24-48h+: Untreated → fatal. Fatal DKA takes DAYS, not hours.
        //
        //   Current values (THRESHOLD=600, BASE=0.3, ACCEL=0.05):
        //   BHB 3.5: load ~0.16/min → game over ~61 hours (mild, slow)
        //   BHB 5.0: load ~0.80/min → game over ~12.5 hours (moderate, time pressure)
        //   BHB 7.0: load ~2.0/min  → game over ~5.0 hours (severe, acute)
        //   BHB 10:  load ~4.6/min  → game over ~2.2 hours (critical)
        //   BHB 15:  load ~10.8/min → game over ~55 min (near-fatal)
        //
        //   In practice BHB rises continuously, so the accumulated load grows
        //   faster than the constant-BHB figures suggest. The player still has
        //   several hours to react, but the situation escalates quickly.
        //
        // Sources: Dhatariya 2020 (DKA guidelines), Nyenwe 2016, Kitabchi 2009
        // acidosisWarningGiven (internal guard) is now owned by the engine (S7.5b) — proxy.
        // ACIDOSIS_* constants are now owned by the engine (S7.4a) and read via getter proxy.
        // See js/physiology-engine.js (ketone/lipolysis/acidosis constants) for values.

        // --- Ketone model (FFA-driven, IOB-based) ---
        //
        // Ketones (beta-hydroxybutyrate, BHB) are produced from free fatty acids (FFA)
        // in the liver. Insulin is the primary regulator — NOT blood glucose. The cascade:
        //
        //   Low plasma insulin → ↑ lipolysis (adipose tissue releases FFA)
        //                       → FFA transported to liver
        //                       → ↑ CPT-1 activity (malonyl-CoA falls)
        //                       → FFA → beta-oxidation → ketones (BHB)
        //
        // Insulin blocks ketogenesis at TWO levels:
        //   1. Lipolysis suppression (EC50 ~5 mU/L — lowest of all insulin processes!)
        //   2. CPT-1 suppression via malonyl-CoA (insulin → ACC → malonyl-CoA → blocks CPT-1)
        //
        // Clearance:
        //   - Michaelis-Menten (saturable): muscles + brain oxidise ketones → rate-limited at high levels
        //   - Renal excretion: ketonuria above threshold ~0.5 mmol/L (additional safety valve)
        //   - Exercise: boosts muscle oxidation of ketones (up to 2× at high heart rate)
        //
        // Clinical scenarios the model should match:
        //   Normal (I=20 mU/L): BHB ~0.05-0.1 mmol/L    (minimal lipolysis)
        //   Overnight fast (I=12): BHB ~0.3-0.5 mmol/L   (moderate lipolysis, controlled)
        //   Pump failure 4h (I→0): BHB ~1.5-2.0 mmol/L   (full lipolysis, CPT-1 open)
        //   Pump failure 8h (I→0): BHB ~3.5-4.5 mmol/L   (DKA level, clearance saturated)
        //
        // Sources: Pinnaro 2021, Laffel 1999, Cahill 1970, McGarry 1980, Robinson 1980
        // Lipolysis parameters: insulin suppresses adipose FFA release
        // Lipolysis has the LOWEST EC50 of all insulin processes (~78-106 pmol/L ≈ 13-18 mU/L)
        // → even low basal insulin suppresses lipolysis effectively.
        // Clinically important: this is why basal insulin prevents ketoacidosis.
        //
        // EC50 was first raised and then lowered again through ketone calibration iterations.
        // The current value is 5 mU/L: lower than the physiological EC50 (~13-18 mU/L;
        // Nurjhan 1986, Campbell 1992), but chosen to keep well-controlled overnight fasting
        // in a realistic BHB range without changing DKA dynamics (I=0 → full rate).
        // Hill n=3 gives a softer transition: more gradual lipolysis at intermediate insulin
        // levels, instead of the near-binary n=4 curve that almost fully suppressed fasting ketosis.
        //
        // Lipolysis at various insulin levels (EC50=5, n=3):
        //   I=0:  100% → 0.090/min  (pump failure, full DKA)
        //   I=5:  50%  → 0.045/min  (very low insulin)
        //   I=7:  27%  → 0.024/min  (nocturnal basal tail → morning ketosis ~0.45)
        //   I=12: 7%   → 0.006/min  (well-controlled daytime basal → low ketosis)
        //   I=20: 2%   → 0.001/min  (postprandial → minimal)
        // LIPOLYSIS_* constants are now owned by the engine (S7.4a) — see js/physiology-engine.js.

        // CPT-1 gating: insulin → ACC → malonyl-CoA → blocks CPT-1 → no FFA→ketones
        // Without insulin: malonyl-CoA falls → CPT-1 opens → FFA flows to beta-oxidation
        //
        // CPT1_* constants are now owned by the engine (S7.4a) — see js/physiology-engine.js.
        // Calibration history (steady-state insulin→BHB, G-test targets, Pinnaro/
        // Ozoran/Guerci/Laffel sources): docs/BG-SCIENCE.md §23, docs/MODEL-
        // IMPLEMENTATION.md Step 3 and git history for js/simulator.js.

        // FFA_LIPO_CLEAR_HALF and BHB_* constants are now owned by the engine (S7.4a) —
        // see js/physiology-engine.js. FFA_LIPO_CLEAR_HALF = effective ketogenesis
        // ramp half-life (malonyl-CoA depletion + CPT-1 derepression). BHB_*
        // = production (FFA + dietary-fat fraction), MM oxidation and renal clearance.
        // Full calibration history + sources: docs/BG-SCIENCE.md §23,
        // docs/MODEL-IMPLEMENTATION.md Step 3, docs/reviews/2026-06-05_claude_
        // ketone-dietary-fat-review.md and git history for js/simulator.js.

        // --- Finger prick cooldown ---
        // Test strips are expensive (~8 DKK each) and the prick is uncomfortable.
        // 3-hour cooldown simulates not pricking fingers constantly in real life.
        this.fingerprickUsedTime = -Infinity; // Last finger prick time (3h cooldown)
        this.fingerprickOnCooldown = false;

        // --- Ketone test cooldown ---
        // Ketone test strips are even more expensive (~20 DKK each).
        // 6-hour cooldown — ketones are only measured when there is real suspicion of insulin deficiency.
        this.ketoneTestUsedTime = -Infinity;
        this.ketoneTestOnCooldown = false;
        // Last ketone measurement (mmol/L). null if no measurement yet.
        // Used by campaign tip 'lastKetoneTestHigh' which fires when a
        // ketone measurement returns >= 0.6 mmol/L.
        this.ketoneTestLastValue = null;

        // --- Emergency glucagon ---
        // Glucagon is a hormone that rapidly raises BG by telling the liver to dump glucose.
        // In real life, it's an emergency injection for severe hypoglycemia.
        this.glucagonUsedTime = -Infinity; // Last usage time (24h GAME-mechanical cooldown)

        // Active glucagon injection (gradual glycogenolysis over 20-45 min).
        // null = no active injection. Object = { startTime, totalRelease_g,
        //  releasedSoFar_g, duration_min, peakMin } — see useGlucagon() and
        //  _substepGlucagon() for kinetics.
        // Mass conservation: glucagon draws from liverGlycogenGrams and adds
        // to Q1 (plasma glucose). If the liver pool is depleted (post-exercise,
        // fasting, alcohol-impaired GNG), the effect is proportionally weaker —
        // matching the clinical observation that glucagon does NOT work in
        // alcohol- or fasting-induced hypoglycemia.
        // --- Scoring ---
        this.normoPoints = 0;          // Points earned for time spent in target BG range

        // Sleep disruption model: night interventions (22:00-07:00) cost sleep,
        // which increases chronic stress the next day. Based on:
        //   Donga et al. 2010 (Diabetes Care): one night of partial sleep restriction
        //   reduces insulin sensitivity ~21% in T1D.
        //   Zheng et al. 2017 (PMC): poor sleep quality amplifies the dawn phenomenon.
        //
        // Mechanics: motoren sammenlægger faktiske vågenintervaller i 22:00-07:00.
        //   Fysisk aktivitet holder karakteren vågen under passet og 30 min efter.
        //   Korte handlinger åbner et stokastisk interval. Overlap tælles én gang.
        //   At sleep-end (07:00) the sleep debt is added to a pending pool:
        //     _pendingChronicStress += min(0.30, lostSleepHours * 0.06)
        //   The insulin resistance factor is later computed as 1 + chronicStressLevel * 0.5.
        // Sleep-debt state is now owned by the engine — see proxy getters below.
        // Aktuel vågenstatus og visuel historik ejes også af motoren.
        this._sleepStartPlayedForDay = -1;       // Which day the sleep-start sound last played
        this._morningAlarmPlayedForDay = -1;      // Hvilken dag morgen-alarm sidst blev spillet
        this.illnessSymptomsUntil = -Infinity;   // B10-sygdom: driver hoste/nyse-lyd og flydende symptomer
        this.illnessSymptomsStart = -Infinity;

        // --- Statistics and history ---
        this.bgHistoryForStats = [];   // BG history for TIR/TITR/average calculations
        this.logHistory = [];          // Event log (food, insulin, exercise) for display

        // Handlinger udført i den aktuelle bane, gemt i Insights-format. Loggen
        // indeholder kun handlinger rettet mod den valgte fiktive karakter.
        this.scenarioLog = [];

        // Livstab i Box Challenge gemmes separat fra spillerens handlinger. De
        // eksporteres som låste markeringer på Insights-referencekurven, så et
        // boks-hit eller et fysiologisk livstab fortsat kan ses efter respawn.
        this.boxChallengeIncidents = [];

        // Midnats-snapshots gør det muligt at fortsætte fra den fysiologiske
        // tilstand, som banen faktisk nåede frem til. Bufferen dækker højst de
        // 72 timer, som Insights-visningen kan vise.
        this.engineSnapshots = [];
        this._lastSnapshotDay = null;

        // --- Daily max points tracking ---
        // Tracks the highest points score the player reaches per day.
        // Used for the star-shower animation when a new high score is reached.
        this.dailyMaxPoints = 0;
        this.lastTrackedPointsDay = 1;

        // --- Exercise minutes (campaign goal tracking) are now owned by the engine (S8-C1) ---
        // Exposed via get/set proxy; campaign.js reads sim.totalExerciseMinutes unchanged.

        // --- Graph messages ---
        // Temporary messages displayed on the graph (e.g., basal reminders)
        this.graphMessages = [];

        // --- Floating labels ---
        // Animated labels that pop up above the graph and disappear on their own.
        // Used for finger prick and ketone results (game-like feedback).
        // Each label: { time, value, text, color, createdAt, duration }
        this.floatingLabels = [];

        // --- Box Challenge state ---
        // Only active in 'boxchallenge' mode. The player has 3 lives and must avoid
        // red obstacle boxes inside the graph's green zone (4-10 mmol/L).
        // Each sim-day = a new level with increasing difficulty.
        // A collision (trueBG inside a box) or any other game-over condition
        // costs one life. At 0 lives = final game over.
        this.lives = gameMode === 'boxchallenge' ? 3 : Infinity;
        this.boxes = [];                    // All generated boxes [{dayNumber, startMinute, endMinute, bgMin, bgMax, hit, fadeInStart}]
        this.currentLevelDay = 0;           // Most recent day for which boxes have been generated
        this.dayStartPoints = 0;            // normoPoints at the start of the day (for bonus calculation)
        this.levelBonusAwarded = false;     // Has the bonus been awarded for the current day?
        this.dayTheoreticalMax = 48.0;     // Dynamic max points per day (updated in generateBoxesForDay)
        this.respawnImmunityUntil = -Infinity; // Box immunity after respawn (sim-minutes)
        // Efter hypo-/DKA-respawn får karakteren et kunstigt basal-depot, der er
        // 12 timer gammelt. Påmindelsen må først komme, når depotet reelt er ved
        // at aftage OG spillerens CGM-kurve er begyndt at stige.
        this._boxRespawnBasalReminderPending = false;
        this._boxSeed = Math.floor(this.rng() * 2147483647); // Seed for reproducible box placement

        // Generate boxes for day 1 in box challenge mode
        if (gameMode === 'boxchallenge') {
            this.generateBoxesForDay(1);
        }

        // --- Campaign physics overrides ---
        // When campaign mode is active, level-specific overrides are applied
        // to simplify the simulation (e.g. no dawn effect, no weight tracking).
        if (this.levelConfig) {
            const phys = this.levelConfig.physics || {};

            // Start time can be overridden (e.g. 420 = 07:00).
            // Sets totalSimMinutes so time-of-day (via modulo) starts correctly.
            // NB: startBG override happens AFTER initializeSteadyState() below,
            // because steady-state would otherwise overwrite Q1.
            if (this.levelConfig.startTimeMinutes != null) {
                this.timeInMinutes = this.levelConfig.startTimeMinutes;
                this.totalSimMinutes = this.levelConfig.startTimeMinutes;
            }

            // Dawn effect can be disabled (level 1)
            if (phys.dawnEffectEnabled === false) {
                this._campaignDisableDawn = true;
            }

            // Weight tracking can be disabled (no game over from caloric imbalance)
            if (phys.weightTrackingEnabled === false) {
                this._campaignDisableWeight = true;
            }

        }

        // --- Glucotoxicity — hyperglycemia-induced insulin resistance ---
        //
        // Sustained elevated blood glucose damages cellular insulin signalling:
        //   Hyperglycemia → mitochondrial superoxide → HBP, PKC, AGEs, polyol
        //   → GLUT4 downregulation + IRS-1 blockade → insulin resistance
        //
        // Time course:
        //   Onset:       ~6-12 hours (GLUT4 translocation affected gradually)
        //   24h at 20:   26% ISF reduction (Vuorinen-Markkola 1992, T1D)
        //   Days:        progressively worse with sustained hyperglycemia
        //   Recovery:    t½ ~24 hours (acute component, GLUT4 re-expression)
        //
        // Implementation: rolling "glucotoxic load" accumulates when BG > threshold,
        // and drives an ISF divisor via sigmoidal saturation.
        // Separate from (but interacting with) FFA resistance and stress resistance.
        //
        // Calibration against Vuorinen-Markkola 1992:
        //   24h at 20 mmol/L → ~26% ISF reduction (literature target)
        //   rate = 0.0004/min × (BG - 10)² when BG > 10
        //   24h × 60min × 0.0004 × (20-10)² = 0.0004 × 100 × 1440 = 57.6 load
        //   sigmoid: 57.6 / (57.6 + 50) = 0.535 → 0.535 × 0.40 = 0.214 → factor 1.21
        //   Model reaches ~21% — deliberately undershot relative to the 26% target.
        //
        // CALIBRATION CHOICE (review C-A6.a 2026-04-30):
        // GLUCOTOX_MAX_RESIST = 0.40 is deliberately capped below Vuorinen-Markkola's
        // direct 26% target to leave headroom for combined resistance mechanisms.
        // Glucotox interacts multiplicatively with FFA resistance (up to 42% reduction
        // from Wolpert 2013) and chronic stress resistance in `combinedResistance`,
        // which has a hard cap of 2.5×. If glucotox alone reached 26%, a patient with
        // a simultaneous high-fat meal + hyperglycemia would quickly saturate the
        // combined cap and lose differentiation between mechanisms. The slight
        // underestimate is therefore a deliberate multi-factor balance, not a
        // calibration error.
        //
        // Sources: Brownlee 2001/2005, Vuorinen-Markkola 1992, Rossetti 1990,
        //          Yki-Järvinen 1990, Apostolopoulou 2025
        // GLUCOTOX_* constants are now owned by the engine (S7.4c) — read via getter proxy.

        // --- Insulin resistance factor ---
        // Dynamically modified by chronic stress. At baseline (no stress) = 1.0.
        // Higher values mean insulin is less effective (ISF is divided by this).
        // --- Zone sound tracking ---
        // Tracks whether BG is in specific zones so sounds are only played on transitions (not every tick).
        this.isInBonusRange = true;       // 5.0-6.0 mmol/L → star shower (true at start so sound doesn't trigger)
        this.isInRange = true;            // 4.0-10.0 mmol/L → positive sound (true at start)
        this.isInHyperZone = false;       // > 10.0 → "too high" sound
        this.lastHypoWarnTime = -Infinity; // cooldown for hypo warning sound (sim-minutes)
        this.hypoWarnArmed = true;         // hysteresis: ready for next hypo warning (reset when BG > 5.0)

        // --- Stress hormones (cortisol, glucagon, adrenaline) ---
        // These hormones increase the liver's glucose production and insulin resistance.
        // We use two separate levels with different washout speeds:
        //
        // acuteStressLevel: short-lived stress (adrenaline-mediated in T1D — glucagon
        //   response is lost 1-5 years after diagnosis, Bengtsen 2021).
        //   Half-life: ~60 simulated minutes.
        //   Example triggers: severe hypoglycemia counterregulation, high-intensity training.
        //
        // chronicStressLevel: long-lasting stress (elevated cortisol from illness,
        //   sleep deprivation). Half-life: ~12 simulated hours. Much slower decay.
        //
        // Both levels feed into a combined stress multiplier that scales hepatic
        // glucose production (HGP):
        //   stressMultiplier = 1.0 + acuteStressLevel + chronicStressLevel
        //   + circadianKortisolNiveau
        //
        // CAPS (T1D-impaired counterregulation):
        //   acuteStressLevel  ∈ [0, 0.4]  — capped in the hypo-response branch and in
        //     public addAcuteStress(). Reflects that T1D patients have LOST the glucagon
        //     response (primary acute counterregulation) and a blunted adrenaline response
        //     via HAAF. Maximum contribution to stressMultiplier from acute alone: +0.4 → 1.4× EGP.
        //     Clinical point: counterregulation ALONE cannot "rescue" a T1D patient from
        //     a severe overdose — hypoglycemia must be prevented, not "compensated".
        //   chronicStressLevel ∈ [0, 1.0] (soft cap via pending pool; typical real
        //     peak ~0.2-0.3 from sleep debt + illness).
        //
        // Typical operative stressMultiplier range:
        //   Rest, normal control:          1.0
        //   Mild morning dawn:             ~1.15
        //   Acute hypo (capped):           ~1.4
        //   Acute hypo + dawn + illness:   ~1.8 (simultaneous extremes)
        //
        // (Cap docs synced with code 2026-06-04 after review finding — the earlier
        // "acuteStress = 1.0 → multiplier 2.0" example was a pre-cap formulation
        // that did not reflect the implemented T1D-fidelity.)
        // Pending chronic stress pool — drained gradually into chronicStressLevel
        // via updateStressHormones. Avoids discrete jumps in the ISF/resistance line
        // when sleep debt or other discrete stress sources are added.

        // --- Dawn variability ---
        // Day-1 dawn parameters (_dawnAmplitude/_dawnPeakMinutes/_dawnDay) are now
        // seeded inside the PhysiologyEngine constructor via regenerateDawn(), so
        // the engine is self-contained and a bare engine has valid dawn from the
        // first step (see physiology-engine.js dawn-state block, S9.6). The facade
        // no longer draws them here; subsequent days regenerate on day rollover via
        // circadianKortisolNiveau as before.

        // --- Hypoglycemia unawareness (HAAF) — continuous area-based model ---
        //
        // Based on: Dagogo-Jack et al. 1993, Cryer 2001/2013, Reno et al. 2013,
        // Fanelli et al. 1993, Cranston et al. 1994, Rickels et al. 2019.
        //
        // The model uses two opposing forces:
        //
        // 1. DAMAGE (hypoArea): accumulated "hypo load"
        //    hypoArea += max(0, 3.0 - trueBG) × dt  [mmol/L × min]
        //    Deeper and longer hypoglycemia causes more damage. BG=2.0 for 30 min gives
        //    (3.0-2.0) × 30 = 30 mmol·min/L. BG=3.5 gives 0 (above threshold).
        //
        // 2. RECOVERY: When BG is above 4.0, hypoArea decays exponentially
        //    with half-life HAAF_RECOVERY_HALFLIFE (sim-minutes).
        //    Clinical: 2-3 weeks → compressed to ~3 sim-days for gameplay.
        //
        // counterRegFactor is computed from hypoArea via sigmoid:
        //    counterRegFactor = 0.3 + 0.7 × exp(-hypoArea / HAAF_DAMAGE_SCALE)
        //    0 area → 1.0 (full response)
        //    Large area → 0.3 (severe HAAF, 70% reduction)
        //
        // Parameters calibrated so:
        //   - A brief hypo (BG=2.5 for 20 min) gives ~20% reduction
        //   - Two hypos on the same day give ~40-50% reduction
        //   - 3 sim-days without hypo → near-full recovery
        //
        // HAAF_DAMAGE_SCALE: area giving ~63% reduction [mmol·min/L]
        //   Set to 30 — equivalent to BG=2.0 for 30 min, or BG=2.5 for 60 min
        // HAAF_RECOVERY_HALFLIFE: half-life for recovery [sim-minutes]
        //   Set to 3×24×60 = 4320 min (3 sim-days). Clinical evidence:
        //   Dagogo-Jack 1993: 2-3 weeks → awareness restored
        //   Fanelli 1993: 3 months → adrenaline partially restored
        //   Compressed to 3 days for gameplay balance.
        // HAAF_* constants are now owned by the engine (S7.4c) — read via getter proxy.

        // --- Estimated liver-glycogen capacity (grams) ---
        //
        // The liver contains ~80-100 g glycogen in an adult. This is a
        // FINITE fuel source for rapid glucose production (glycogenolysis).
        //
        // This is a finite-capacity estimate, not a complete hepatic mass balance.
        // Basal/stress/protein terms are coordinated with blood-side EGP, and an
        // injected glucagon release is explicitly transferred to Q1. Exercise drain
        // and postprandial refill only change future response capacity; they do not
        // add to or subtract from Q1 in the current implementation.
        //
        // CAPACITY DRAINS (reduce the estimate):
        //   1. Stress-driven glycogenolysis — glucagon/adrenaline converts
        //      glycogen → glucose. Rate is proportional to acute stress above baseline.
        //      Computed from the stress component of the EGP formula.
        //   2. Exercise proxy — reduces later liver response capacity according to
        //      activity intensity (kcal/min as proxy), without adding acute Q1 glucose.
        //
        // CAPACITY RECOVERY (raises the estimate):
        //   1. Gluconeogenesis — the liver synthesises glucose from amino acids,
        //      lactate and glycerol. Constant ~0.1 g/min (6 g/hour). Does NOT
        //      require glycogen and is therefore always available.
        //   2. Carbohydrate absorption — when BG is above basal and insulin is
        //      present, the liver stores excess glucose as glycogen.
        //      ~30-40% of absorbed carbohydrates are stored in the liver.
        //
        // EFFECT ON THE MODEL:
        //   glycogenReserve = min(1.0, liverGlycogenGrams / GLYCOGEN_STRESS_THRESHOLD)
        //   effectiveAcuteStress = acuteStressLevel × glycogenReserve
        //   → When glycogen < 15 g: stress-driven EGP falls proportionally
        //   → At 0 g: only gluconeogenesis baseline supplies glucose
        //
        // Typical trajectories:
        //   Hypo alone:            ~7-10 g/hour consumption → 90 g lasts ~10 hours
        //   High cardio:           ~25-35 g/hour → 90 g lasts ~3 hours
        //   High cardio + hypo:    ~35-45 g/hour → below stress threshold (15 g) after ~2 hours
        //   Recovery (eating):     ~20-30 g/hour (fast with food)
        //   Recovery (fasting):    ~6 g/hour (gluconeogenesis only)
        //
        // Sources: Roden 2001 (liver glycogen, MRS measurement)
        //          Petersen 2004 (glycogen repletion after exercise)
        //          Trefts 2015 (exercise + hepatic glucose output)
        //          Gonzalez 2016 (postprandial liver glycogen synthesis)
        // LIVER_GLYCOGEN_MAX and GLYCOGEN_STRESS_THRESHOLD are now owned by the engine (S7.4c) — getter proxy.

        // --- Muscle glycogen pool (weight-scaled, see MUSCLE_GLYCOGEN_* at top) ---
        // Capacity scales linearly with body weight: 70 kg → 385 g, 90 kg → 495 g.
        // All levels start with a full depot (reserve=1.0) unless
        // this.levelConfig.startMuscleGlycogenFraction is set (injected level config).
        // Timestamp of the last tick with real muscle contraction (consumption > 0).
        // Used for AMPK phase-1 resynthesis decay and is INDEPENDENT of whether
        // the session was stored in activeMotion. Updated in updateMuscleGlycogen
        // every time consumption_gPerMin > 0. null = no exercise yet.
        // Rate tracking for UI (g/min, updated every tick)

        // Initialise engine to steady-state (S9.1).
        // engine.initSteadyState finds the basal rate that gives target BG=5.5, stores
        // hovorkaSteadyStateBasalRate + basalIOBbaseline (basal S1+S2+I×V_I at
        // equilibrium — the IOB portion not shown to the player) and synchronises
        // trueBG/cgmBG with the Hovorka equilibrium.
        // establishDepot:false — the facade creates its OWN game-specific basal pre-
        // injection below (age 16h, circadian-adjusted dose), so the engine must not
        // create a depot here. Bit-identical to the former inline init.
        this.engine.initSteadyState({ targetBG: 5.5, establishDepot: false });

        // Basal plasma is now a LIVE getter (basalPlasmaInsulinBaseline) that
        // returns state[15] × V_I at the time of lookup. Previously an init-snapshot
        // was stored, but it drifted away from real basal plasma over the day due to
        // circadian/stress modulation. The shadow cascade (state[13..15]) tracks the
        // basal contribution exactly thanks to the linearity of the Hovorka system.

        // Fixed bioavailability (no uncertainty). Ensures proportionality:
        // 1U = always half of 2U. Variation in absorption speed (tauFactor)
        // still gives realistic PK variation per injection.
        //
        // CALIBRATION CHOICE (review C-A4.c 2026-04-30):
        // 78%/82% are empirically calibrated to produce realistic BG trajectories
        // in combination with the simulator's broader insulin PD chain (ISF, displayIOB,
        // exercise modulation). Values exceed BG-SCIENCE §7 / Becker 2007's
        // ~70% median, but are within the FDA-label range 55-77% (lispro) and
        // up to 84% in individual studies (Gradel 2018).
        //
        // IMPORTANT: This is NOT a literature median, but a deliberate calibration
        // choice that gives the best game balance. Reducing to ~70%/75% (literature
        // median) would require re-calibrating insulin dose sizes or ISF to avoid
        // persistently high BG. See MODEL-IMPLEMENTATION.md §13
        // "Variability of insulin response" for full discussion.
        // Pre-administer basal insulin from an earlier time point (default:
        // 16 hours ago, corresponding to 08:00 yesterday when the game starts at
        // midnight). Campaign levels can override the age and duration so the first
        // tutorial levels can be deterministic without changing the usual
        // basal variability in sandbox and later gameplay.
        // Dose is adjusted so the trapezoid profile's plateau rate matches the
        // calibrated steady-state rate. This ensures BG is stable at game start.
        const campaignPhysics = this.levelConfig ? (this.levelConfig.physics || {}) : {};
        const preInjectedBasalAgeHours = Number.isFinite(campaignPhysics.basalPreInjectedAgeHours)
            ? campaignPhysics.basalPreInjectedAgeHours
            : 16;
        // Manglende felt bevarer den almindelige startkontrakt. Kun et eksplicit
        // `false` betyder, at spilleren starter uden et aktivt basal-depot.
        // Hovorka-modellens allerede etablerede plasma- og effektkompartmenter
        // nulstilles ikke: deres gradvise decay bygger fysiologisk bro over den
        // nye basaldosis' langsomme start uden at skjule en ekstra aktiv dosis.
        const shouldPreInjectBasal = campaignPhysics.basalPreInjected !== false;
        if (shouldPreInjectBasal) {
            this.addLongInsulin(this.basalDose, this.totalSimMinutes - preInjectedBasalAgeHours * 60, true);

            // Adjust the internal dose so the trapezoid profile's plateau rate matches
            // Hovorka's steady-state, ADJUSTED for circadian ISF at game start. Steady-state
            // is calibrated at neutral ISF (1.0), but regular games start at 00:00
            // where circadianISF is typically 1.20 (insulin 20% more effective). In levels
            // where dawn/circadian variation is disabled, circadianISF returns 1.0.
            // The rate formula uses effectiveArea (trapezoid-normalised):
            //   plateauRate = dose * ba * 1000 / effectiveArea
            // So the inverse is: dose = ssRate * effectiveArea / (1000 * ba)
            const initialBasal = this.activeLongInsulin[0];
            if (Number.isFinite(campaignPhysics.basalPreInjectedDurationHours)) {
                initialBasal.totalDuration = campaignPhysics.basalPreInjectedDurationHours * 60;
            }
            const ba = initialBasal.bioavailability || 1.0;
            const rampUp = 2 * 60, tailOff = 6 * 60;  // Same as in the trapezoid profile
            const effectiveArea = initialBasal.totalDuration - rampUp / 2 - tailOff / 2;
            const midnightISF = this.circadianISF;  // 1.20 at midnight — insulin more effective
            initialBasal.dose = this.hovorkaSteadyStateBasalRate * effectiveArea / (1000 * ba * midnightISF);
            this.lastInsulinTime = this.totalSimMinutes - preInjectedBasalAgeHours * 60;
        }

        // (trueBG/cgmBG were synchronised with the Hovorka equilibrium in
        // engine.initSteadyState above — the pre-injection does not change glucose.)

        // --- Campaign startBG override (AFTER initializeSteadyState) ---
        // Steady-state sets BG to 5.5 mmol/L. Campaign levels can override
        // the starting blood glucose (e.g. 9.0 in level 1). We change BOTH trueBG
        // and Hovorka's Q1 (glucose mass in the plasma compartment, state[4]).
        // Formula: Q1 = BG × V_G, where V_G already includes the simulated subject's weight.
        if (this.levelConfig && this.levelConfig.startBG != null) {
            this.trueBG = this.levelConfig.startBG;
            this.cgmBG = this.trueBG;
            // Scale the ENTIRE glucose subsystem proportionally so Q1/Q2/C are consistent.
            // Without this, Q2 remains at the 5.5 equilibrium → artificial transient in the first 15 min.
            // (codex review 2026-04-07, issue 3)
            const bgRatio = this.trueBG / (this.hovorka.state[HOVORKA_STATE_IDX.Q1] / this.hovorka.V_G);
            this.hovorka.state[HOVORKA_STATE_IDX.Q1] *= bgRatio;   // Q1: plasma glucose
            this.hovorka.state[HOVORKA_STATE_IDX.Q2] *= bgRatio;   // Q2: peripheral glucose
            this.hovorka.state[HOVORKA_STATE_IDX.C] = this.trueBG; // C: CGM sensor
        }

        // --- Campaign muscleGlycogen override ---
        // Default is a full depot. Special scenarios can start with an empty depot
        // (e.g. "tired athlete" level) via levelConfig.startMuscleGlycogenFraction ∈ [0,1].
        if (this.levelConfig && this.levelConfig.startMuscleGlycogenFraction != null) {
            const frac = Math.max(0, Math.min(1,
                this.levelConfig.startMuscleGlycogenFraction));
            this.muscleGlycogenGrams = this.muscleGlycogenCapacity * frac;
            this.muscleGlycogenReserve = frac;
        }

        // Add an initial CGM data point so the graph starts with a value.
        // Uses totalSimMinutes (not 0) — in campaign the start time can be e.g. 420 (07:00).
        cgmDataPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
        trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
        // Initial physiology data point for the insulin band
        physiologyDataPoints.push({
            time: this.totalSimMinutes,
            basalRate: 0,
            bolusIOB: 0,
            plasmaInsulinMU: this.basalPlasmaInsulinBaseline,
            basalPlasmaMU: this.basalPlasmaInsulinBaseline,
            egp: this.hovorka._lastEGP || 0,
            carbAbsorption: 0,
            currentISF: this.currentISF
        });
    }

    // =========================================================================
    // COMPUTED PROPERTIES (getters)
    // =========================================================================
    // In JavaScript, "get" defines a computed property — like a MATLAB dependent
    // property. It looks like a variable (sim.currentISF) but runs a function.
    // =========================================================================

    /**
     * basalPlasmaInsulinBaseline — LIVE basal plasma insulin [mU].
     *
     * Returns state[HOVORKA_STATE_IDX.Ib] × V_I at the time of lookup — i.e. exactly the
     * plasma insulin originating from basal input (shadow cascade S1b/S2b/Ib).
     * Used as the baseline for the insulin band's rapid/basal separation: all
     * plasma insulin ABOVE this value originates from bolus.
     *
     * Previously stored as an init-snapshot, but it drifted over the day due to
     * circadian/stress modulation of basal requirements, causing the UI to show
     * incorrect "rapid plasma" around dawn (05:00-09:00). The live getter is exact
     * thanks to the linearity of the Hovorka system in its inputs.
     *
     * @returns {number} Basal plasma insulin [mU]
     */
    get basalPlasmaInsulinBaseline() {
        return this.hovorka.state[HOVORKA_STATE_IDX.Ib] * this.hovorka.V_I;
    }

    /**
     * currentISF — The effective Insulin Sensitivity Factor at this moment.
     *
     * Base ISF is modified by three dynamic factors:
     *
     *   1. circadianISF (0.70–1.20 over the 24-hour cycle)
     *      — Circadian variation in insulin sensitivity.
     *      — In the morning (~08:00): factor 0.70 → insulin 30% less effective
     *        → player needs ~43% more insulin for the same effect.
     *      — In the evening (~19:00): factor 1.20 → insulin 20% more effective.
     *      — Based on Toffanin 2013, damped 50%, adjusted for clinical experience.
     *        See circadianISF getter for details.
     *
     *   2. insulinResistanceFactor (>1.0 when chronic stress is elevated)
     *      — Chronic stress increases insulin resistance via hepatic HGP.
     *      — Set in updateStressHormones: 1.0 + chronicStressLevel × 0.5.
     *
     *   3. glucotoxicResistanceFactor (>1.0 when hyperglycemia has persisted)
     *      — Sustained high BG (>10) → GLUT4 downregulation → insulin resistance.
     *      — Accumulates over hours/days, recovers with t½ ~24 hours.
     *      — Set in updateGlucotoxicity: sigmoid of glucotoxicLoad.
     *
     *   4. sensitivityIncreaseFactor (>1.0 after exercise)
     *      — Exercise increases insulin sensitivity for hours after training.
     *      — Decays exponentially from max to 1.0 (t½ = 3-5 hours).
     *
     * @returns {number} Effective ISF in mmol/L per unit of insulin
     */
    // currentISF moved to engine (S7.6a) — proxy (sets engine._lastPeisFactor).
    get currentISF() { return this.engine.currentISF; }

    // -------------------------------------------------------------------------
    // Engine state delegation: ~150 trivial passthrough get/set accessors that
    // mirrored PhysiologyEngine fields used to live here (one hand-written pair
    // per field). They are now generated by a prototype-delegation loop right
    // after the class definition (see SIMULATOR_ENGINE_READONLY / _READWRITE).
    // To expose a new engine field on the facade, add its name to one of those
    // arrays. The non-trivial / individually-documented accessors stay explicit:
    // basalPlasmaInsulinBaseline + currentISF (above) and currentCarbEffect /
    // circadianISF / circadianKortisolNiveau (below, near their related methods).
    // -------------------------------------------------------------------------

    // _stepEngineScenario — Run a number of sim-minutes for engine.runScenario().
    // S7.8: engine.step() takes sim-minutes directly, so the old speed=60 trick
    // (which made update(deltaSeconds) give 1 sec = 1 sim-min) is no longer needed.
    // The same isGameOver guard as in update() is preserved.
    _stepEngineScenario(minutes) {
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        if (this.isGameOver) return;
        // Same full tick as update() (engine.step + game post-processing), so
        // scenario samples see the same state (e.g. weightChangeKg from updateWeight) as
        // the running game. _postStep flushes the buffered engine events.
        this._tickPhysiology(minutes);
    }

    // _applyEngineScenarioEvent — Facade dispatch for runScenario() events.
    // The engine knows only the type; the concrete interventions remain in Simulator.
    _applyEngineScenarioEvent(event) {
        if (!event || !event.type) {
            throw new Error('runScenario event mangler type');
        }

        switch (event.type) {
            case 'setBG':
                return this.engine.setBG(event.value ?? event.bg ?? event.mmolL);
            case 'setNoise':
                return this.engine.setNoise(event.enabled);
            case 'setPlasmaInsulinClamp':
                return this.engine.setPlasmaInsulinClamp(event.value ?? event.valueOrNull);
            case 'food':
            case 'addFood':
                return this.addFood(
                    event.carbs || 0,
                    event.protein || 0,
                    event.fat || 0,
                    event.icon || '🍲',
                    event.weight || 0,
                    event.carbType || 'mixed',
                    event.eatTimeMin ?? null
                );
            case 'rapidInsulin':
            case 'fastInsulin':
            case 'bolus':
                return this.addFastInsulin(event.units ?? event.dose);
            case 'basalInsulin':
            case 'longInsulin':
                return this.addLongInsulin(
                    event.units ?? event.dose,
                    event.injectionTime ?? this.totalSimMinutes,
                    !!event.silent
                );
            case 'activity':
            case 'startActivity':
                return this.startAktivitet(
                    event.activityType || event.exerciseType || 'cardio',
                    event.intensity || event.intensitet || 'Medium',
                    event.durationMin ?? event.duration ?? null
                );
            case 'stopActivity':
                return this.stopAktivitet();
            case 'glucagon':
                return this.useGlucagon();
            default:
                throw new Error(`Ukendt runScenario event-type: ${event.type}`);
        }
    }

    // _getEngineScenarioSample — Compact numeric sample for the Lab API.
    _getEngineScenarioSample() {
        return {
            time: this.totalSimMinutes,
            day: this.day,
            trueBG: this.trueBG,
            cgmBG: this.cgmBG,
            iob: this.iob,
            displayIOB: this.displayIOB,
            cob: this.cob,
            ketoneLevel: this.ketoneLevel,
            weightChangeKg: this.weightChangeKg,
            plasmaInsulin: this.hovorka.state[HOVORKA_STATE_IDX.I],
            plasmaInsulinClamp: this.engine.plasmaInsulinClamp
        };
    }

    // _handleEngineEvent — Facade translation from engine events to game side-effects.
    // S3 is migrated in small steps: engine/physiology code emits machine-readable events,
    // and Simulator becomes the place that selects i18n text, sound, log, popup, and game
    // mechanics. For now only stress log-events are handled.
    _handleEngineEvent(event) {
        if (!event || !event.type) return;

        switch (event.type) {
            case 'acute-stress-added':
                logEvent(t('log.acuteStress', {
                    amount: event.data.amount.toFixed(2)
                }), 'event');
                break;
            case 'chronic-stress-added':
                logEvent(t('log.chronicStress', {
                    amount: event.data.amount.toFixed(2)
                }), 'event');
                break;
            case 'cgm-compression-started':
                logEvent(t('log.cgmCompression'), 'event');
                break;
            case 'cgm-sensor-lost':
                logEvent(t('log.cgmSensorLost'), 'event');
                this.addFloatingLabel(t('label.cgmSensorLost'), this.cgmBG || this.trueBG, '#93c5fd', 120);
                break;
            case 'cgm-self-test-started':
                logEvent(t('log.cgmSelfTest'), 'event');
                this.addFloatingLabel(t('label.cgmSelfTest'), this.cgmBG || this.trueBG, '#fbbf24', 90);
                break;
            case 'food-added':
                logEvent(t('log.food', {
                    carbs: event.data.carbs,
                    protein: event.data.protein,
                    fat: event.data.fat
                }), 'food', {
                    kcal: event.data.kcal,
                    carbs: event.data.carbs,
                    protein: event.data.protein,
                    icon: event.data.icon
                });
                break;
            case 'food-sound':
                playSound('eating');
                break;
            case 'fast-insulin-added':
                logEvent(t('log.fastInsulin', {
                    dose: event.data.dose
                }), 'insulin-fast', { dose: event.data.dose });
                break;
            case 'fast-insulin-sound':
                playSound('insulinPen');
                break;
            case 'basal-insulin-added':
                logEvent(t('log.basalInsulin', {
                    dose: event.data.dose
                }), 'insulin-basal', { dose: event.data.dose });
                playSound('insulinPen');
                break;
            case 'glucagon-used':
                logEvent(t('log.glucagon'), 'glucagon');
                break;
            case 'glucagon-reduced-effect':
                logEvent(
                    `Glucagon: reduced effect — only ${event.data.availableGlycogen.toFixed(0)} g glycogen available (low liver reserves)`,
                    'glucagon'
                );
                break;
            case 'kit-cooldown-status':
                this._applyKitCooldownStatus(event.data);
                break;
            case 'weight-status':
                this._applyWeightStatus(event.data);
                break;
            case 'stats-status':
                this._applyStatsStatus(event.data);
                break;
            case 'game-over-condition':
                this._handleGameOverCondition(event.data);
                break;
            case 'steep-drop-warning':
                this._applySteepDropWarning();
                break;
            case 'cgm-sample':
                this._applyCgmSample(event.data);
                break;
            case 'fingerprick-measured':
                logEvent(t('log.fingerprick', {
                    value: displayBG(event.data.value),
                    unit: bgUnitLabel()
                }), 'fingerprick', { value: event.data.value.toFixed(1) });
                break;
            case 'fingerprick-sound':
                playSound('intervention', 'B4');
                break;
            case 'ketone-test-measured':
                logEvent(t('log.ketoneTest', {
                    value: event.data.value.toFixed(1),
                    unit: 'mmol/L',
                    status: event.data.status
                }), 'ketone-test', { value: event.data.value.toFixed(1) });
                break;
            case 'ketone-test-sound':
                playSound('intervention', 'B4');
                break;
            case 'sleep-started':
                playSound('sleepStart');
                logEvent(t('log.sleepStart'), 'event');
                break;
            case 'morning-alarm':
                playSound('morningAlarm');
                break;
            case 'good-sleep':
                logEvent(t('log.goodSleep'), 'event');
                break;
            case 'sleep-disruption':
                logEvent(t('log.sleepDisruption', {
                    hours: event.data.hours.toFixed(1)
                }), 'event');
                // Grafbeskeden vises straks. Vågenhistorikken og det faktiske
                // søvntab ejes og akkumuleres nu af motoren minut for minut.
                this.graphMessages.push({
                    id: `sleep_disruption_${this.totalSimMinutes}`,
                    text: t('graph.sleepLoss', { hours: event.data.hours.toFixed(1) }),
                    expireTime: this.totalSimMinutes + 60 // Vis i 1 sim-time
                });
                break;
            case 'sleep-debt':
                logEvent(t('log.sleepDebt', {
                    hours: event.data.hours.toFixed(1)
                }), 'event');
                break;
            case 'sleep-pop':
                playSound('sleepPop');
                // Night-pop sequence: bubbles pop FIRST, intervention delayed ~400 ms.
                // window._nightPopActiveUntil tells playSound()/flyIconToGraph() to
                // delay themselves so zzZzz bubbles pop before intervention VFX.
                if (typeof drawSymptomOverlay === 'function') {
                    drawSymptomOverlay._popRealTime = performance.now();
                }
                if (typeof window !== 'undefined') {
                    window._nightPopActiveUntil = performance.now() + 400;
                }
                break;
            case 'stomach-full':
                logEvent(t('log.stomachFull'), 'info');
                playSound('invalid');
                break;
            case 'exercise-max-duration':
                logEvent(t('log.exerciseMaxDuration'), 'motion-end');
                break;
            case 'exercise-cooldown':
                logEvent(t('log.exerciseCooldown', { min: event.data.min }), 'warning');
                break;
            case 'activity-started': {
                const d = event.data;
                const name = t(`activity.name.${d.type}`);
                const intensity = t(`activity.intensity.${d.intensity === 'Lav' ? 'low' : d.intensity === 'Høj' ? 'high' : 'medium'}`);
                const durationStr = d.duration ? t('log.activity.duration.fixed', { min: d.duration }) : t('log.activity.duration.open');
                const kcalStr = d.kcal ? t('log.activity.kcal', { kcal: d.kcal }) : '';
                logEvent(
                    t('log.activityStart', { name, intensity, duration: durationStr, kcal: kcalStr }),
                    'motion',
                    { type: d.type, intensity: d.intensity, duration: d.duration, kcalBurned: d.kcal, icon: d.icon }
                );
                playSound('intervention', 'F4');
                break;
            }
            case 'activity-ended': {
                const d = event.data;
                // Update the original exercise event (graph band) with the actual duration.
                // Moved here in S8-C1 so BOTH manual stop and auto-stop (from engine
                // step) patch correctly. d.startTime + d.type identifies the START entry.
                const originalEvent = this.logHistory.findLast(e => e.type === 'motion' && e.details && e.details.type === d.type && e.time === d.startTime);
                if (originalEvent) {
                    originalEvent.details.duration = d.duration;
                    originalEvent.details.kcalBurned = d.kcal;
                }
                const name = t(`activity.name.${d.type}`);
                const intensity = t(`activity.intensity.${d.intensity === 'Lav' ? 'low' : d.intensity === 'Høj' ? 'high' : 'medium'}`);
                logEvent(
                    t('log.activityEnd', { name, intensity, duration: d.duration, kcal: d.kcal }),
                    'motion-end',
                    { type: d.type, intensity: d.intensity, duration: d.duration, kcalBurned: d.kcal, icon: d.icon }
                );
                break;
            }
        }
    }

    // _flushEngineEvents — Drain the engine event buffer and execute facade side-effects.
    // Called after the concrete physiology methods, which in this phase still live in
    // Simulator but now pass through the engine event layer.
    _flushEngineEvents() {
        const events = this.engine.consumeEvents();
        for (const event of events) {
            this._handleEngineEvent(event);
        }
    }

    // _applyCgmSample — Facade orchestration of a CGM sample event (S8-C2).
    // The engine produces the cgmBG signal + emits 'cgm-sample'; the facade owns
    // the graph history arrays and the tick sound. The auto-self-test trigger (including
    // the RNG draw) now lives in engine._sampleCgm (S9.7) — the facade only reacts to
    // the resulting 'cgm-self-test-started' event (label/log).
    _applyCgmSample(data) {
        if (!data.active) {
            // Sensor offline/warmup/checking: no CGM measurement, only a trueBG point.
            trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
            if (trueBgPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) trueBgPoints.shift();
            return;
        }

        // Store data points for graph rendering and statistics
        cgmDataPoints.push({ time: this.totalSimMinutes, value: this.cgmBG });
        trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
        this.bgHistoryForStats.push({ time: this.totalSimMinutes, cgmBG: this.cgmBG, trueBG: this.trueBG });

        // Daily max points tracking — reset at day rollover
        if (this.day !== this.lastTrackedPointsDay) {
            this.dailyMaxPoints = 0;
            this.lastTrackedPointsDay = this.day;
        }
        // Keep history buffers from growing indefinitely
        if (cgmDataPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) cgmDataPoints.shift();
        if (trueBgPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) trueBgPoints.shift();
        // Physiology data: 1440 points/day (1 per minute), buffered for 2 days
        if (physiologyDataPoints.length > 2880) physiologyDataPoints.shift();
        if (this.bgHistoryForStats.length > (14 * MAX_GRAPH_POINTS_PER_DAY + 10)) this.bgHistoryForStats.shift();

        // Play tick sound at every CGM update (every 5 sim-minutes) for feedback
        playSound('tick');
    }

    // _applySteepDropWarning — Facade DOM/sound for rapid BG-drop warning.
    // The physiological trigger only emits the event; overlay, sound, and timeout
    // belong to the facade.
    _applySteepDropWarning() {
        if (steepDropWarningDiv.style.display === 'block') return;
        steepDropWarningDiv.style.display = 'block';
        playSound('intervention', 'A5', '2n');
        setTimeout(() => { steepDropWarningDiv.style.display = 'none'; }, 5000);
    }

    // _applyKitCooldownStatus — Facade DOM for kit-button cooldown pie display.
    // Physics/game-state only computes the status data; this helper is the single
    // place that touches the concrete button, CSS class, and player-facing label.
    _applyKitCooldownStatus(data) {
        const btn = document.getElementById(data.buttonId);
        if (!btn) return;

        const nameEl = btn.querySelector('.pc-name');
        if (data.onCooldown) {
            btn.classList.add('on-cooldown');
            btn.style.pointerEvents = 'none';
            btn.style.setProperty('--cooldown-pct', data.cooldownPercent.toFixed(1));

            const remaining = data.remainingMinutes;
            const hours = Math.floor(remaining / 60);
            const mins = Math.floor(remaining % 60);
            if (nameEl) nameEl.textContent = `${hours}t ${mins}m`;
        } else {
            btn.classList.remove('on-cooldown');
            btn.style.removeProperty('pointer-events');
            btn.style.removeProperty('--cooldown-pct');
            if (nameEl) nameEl.textContent = t(data.readyLabelKey);
        }
    }

    // _applyWeightStatus — Facade DOM for weight and calorie-balance display.
    // updateWeight() still computes the physiological numbers; this helper shows them.
    _applyWeightStatus(data) {
        const wcEl = document.getElementById('weightChangeValue');
        if (wcEl) {
            wcEl.textContent = data.weightChangeKg.toFixed(1);
            const absWeight = Math.abs(data.weightChangeKg);
            wcEl.style.color = absWeight > 0.8 * data.weightLimitKg ? '#b91c1c' : absWeight > 0.5 * data.weightLimitKg ? '#d69e2e' : '';
        }

        // Update stats fragment in the capsule bar.
        // typeof guard: model-validation.html mocks DOM globals via window assigns,
        // but older versions of the test harness did not include this variable.
        // The typeof check avoids a ReferenceError in such restricted test environments.
        if (typeof statsWeightValue !== 'undefined' && statsWeightValue) {
            const absKcal = Math.abs(data.netKcal);
            const sign = data.netKcal >= 0 ? '+' : '';
            statsWeightValue.textContent = sign + Math.round(data.netKcal / 10) * 10 + ' kcal';
            statsWeightValue.style.color = absKcal > 1200 ? '#b91c1c' : absKcal > 600 ? '#d69e2e' : '#38a169';
        }
    }

    // _applyStatsStatus — Facade DOM for TIR, average CGM and debug GMI.
    // updateStats() still computes the numbers; this helper shows them in the UI.
    _applyStatsStatus(data) {
        if (data.period === '24h') {
            // Update stats fragment in the capsule bar.
            // typeof guards due to test environment without these globals (see updateWeight).
            if (typeof statsTirValue !== 'undefined' && statsTirValue) {
                statsTirValue.textContent = data.tirPct.toFixed(0) + '%';
                statsTirValue.style.color = data.tirColor;
            }
            if (typeof statsAvgBgValue !== 'undefined' && statsAvgBgValue) {
                statsAvgBgValue.textContent = displayBG(data.avgCgm);
                statsAvgBgValue.style.color = data.avgColor;
            }
        } else if (data.period === '7d') {
            const dbgEl = document.getElementById('dbgEHbA1c');
            if (dbgEl) {
                dbgEl.textContent = data.gmi.toFixed(1);
                dbgEl.style.color = data.gmiColor;
            }
        }
    }

    // _handleGameOverCondition — Facade decision for physiological thresholds.
    // The engine/physiology code only sends raw values and type; the facade decides
    // whether that means a life loss in Box Challenge or a full game over with i18n text.
    _handleGameOverCondition(data) {
        if (this.gameMode === 'boxchallenge' && this.lives > 0) {
            this.loseLife(data.type);
            return;
        }

        switch (data.type) {
            case 'hypo':
                this.gameOver(t('game.over.hypo.name'), {
                    type: 'hypo',
                    cause: t('game.over.hypo.cause', {bg: displayBG(data.bg), unit: bgUnitLabel()}),
                    explanation: t('game.over.hypo.explanation', bgVars()),
                    tips: [
                        t('game.over.hypo.tip1'),
                        t('game.over.hypo.tip2', bgVars()),
                        t('game.over.hypo.tip3'),
                        t('game.over.hypo.tip4')
                    ]
                });
                break;

            case 'weight':
                this.gameOver(t('game.over.weight.name'), {
                    type: 'weight',
                    cause: t('game.over.weight.cause', {
                        weight: data.weightChangeKg.toFixed(1),
                        limit: data.weightLimitKg.toFixed(1),
                        // Limit converted to caloric balance (the number the player sees
                        // during the game), rounded to the nearest 100 kcal.
                        limitKcal: Math.round(data.weightLimitKg * KCAL_PER_KG_WEIGHT / 100) * 100
                    }),
                    explanation: t('game.over.weight.explanation'),
                    tips: [
                        t('game.over.weight.tip1'),
                        t('game.over.weight.tip2'),
                        t('game.over.weight.tip3')
                    ]
                });
                break;

            case 'dka':
                this.gameOver(t('game.over.dka.name'), {
                    type: 'dka',
                    cause: t('game.over.dka.cause', {ketones: data.ketoneLevel.toFixed(1)}),
                    explanation: t('game.over.dka.explanation'),
                    tips: [
                        t('game.over.dka.tip1'),
                        t('game.over.dka.tip2'),
                        t('game.over.dka.tip3'),
                        t('game.over.dka.tip4')
                    ]
                });
                break;

            case 'complications':
                this.gameOver(t('game.over.complications.name'), {
                    type: 'complications',
                    cause: t('game.over.complications.cause', {avg: displayBG(data.avg7d), unit: bgUnitLabel()}),
                    explanation: t('game.over.complications.explanation'),
                    tips: [
                        t('game.over.complications.tip1', bgVars()),
                        t('game.over.complications.tip2'),
                        t('game.over.complications.tip3'),
                        t('game.over.complications.tip4')
                    ]
                });
                break;
        }
    }

    // currentCarbEffect moved to engine (S7.6a) — proxy.
    get currentCarbEffect() { return this.engine.currentCarbEffect; }

    // =========================================================================
    // gaussRand — Normally distributed random variable (Box-Muller transform)
    // =========================================================================
    // Generates a normally distributed value with the specified mean and standard deviation.
    // Used for physiological variation: insulin bioavailability, dawn amplitude,
    // sleep stress, absorption speed, etc.
    // Box-Muller transforms two uniformly distributed numbers into one normally distributed value.
    gaussRand(mean, std) {
        // Delegated to engine (slice S1). Same RNG, so bit-identical.
        return this.engine.gaussRand(mean, std);
    }

    // =========================================================================
    // regenerateDawn — Generate new dawn parameters for a new day
    // =========================================================================
    // Called at day rollover (midnight). Computes new amplitude and peak time
    // for morning cortisol, influenced by:
    //   1. Base variation: CV ~20% (normally distributed)
    //   2. Sleep debt: amplifies dawn by ~12% per lost hour
    //      (Leproult 1997: sleep deprivation increases morning cortisol 30-50%)
    //   3. Chronic stress: amplifies dawn by up to ~30%
    //      (sustained cortisol raises the morning peak)
    // regenerateDawn moved to PhysiologyEngine (S7.6a) — called only internally by engine.circadianKortisolNiveau.

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
    // Visual representation (amplitude = 0.15, reduced from 0.30):
    //
    //   0.15 |         ^ peak at 08:00
    //        |       /   \
    //   0.08 |     /       \
    //        |   /           \
    //   0.00 |---              ---------------
    //        +----------------------------> time
    //       00   04   08   12   16   20   24
    //
    // NOTE: Amplitude halved because the morning effect is now SPLIT between
    // HGP increase (this curve) and peripheral ISF reduction (circadianISF).
    // The combined effect is comparable to the original 0.30 HGP-only model.
    //
    // =========================================================================
    // circadianKortisolNiveau moved to engine (S7.6a) — proxy.
    get circadianKortisolNiveau() { return this.engine.circadianKortisolNiveau; }

    // =========================================================================
    // CIRCADIAN ISF — Diurnal variation in insulin sensitivity
    // =========================================================================
    //
    // Insulin sensitivity varies over the 24-hour cycle. In the morning insulin
    // is less effective (lower ISF); in the evening more effective (higher ISF).
    // This is a SEPARATE mechanism from the dawn phenomenon (HGP increase via
    // circadianKortisolNiveau) — dawn drives hepatic glucose production, while
    // this curve drives peripheral insulin resistance.
    //
    // HYBRID MODEL: The combined morning effect is the sum of:
    //   1. HGP +15% (circadianKortisolNiveau, reduced from +30%)
    //   2. ISF ×0.70 (this curve → 43% more insulin required)
    //
    // The curve is inspired by Toffanin et al. (2013) but damped to 50%
    // amplitude because the T1D evidence base is limited:
    //   - Hinshaw 2013: ISF pattern is individual, not generalisable
    //   - Sohag 2022: morning ISF ~50, evening ~75 mg/dL (50% difference)
    //   - Clinical experience: ~40% more morning insulin matches T1D experience
    //
    // Control points (time → ISF factor relative to nominal=1.0):
    //   00:00 → 1.20  (night: high sensitivity)
    //   04:00 → 1.20  (late night: still high, before dawn drop)
    //   08:00 → 0.70  (morning nadir: lowest sensitivity)
    //   14:00 → 1.00  (afternoon: nominal)
    //   19:00 → 1.20  (evening: highest sensitivity)
    //   24:00 → 1.20  (midnight: wraps to start)
    //
    // Between control points, cosine interpolation gives smooth transitions
    // without sharp kinks (S-curve between each pair).
    //
    // Visual (ISF factor over the day):
    //
    //  1.20 |****                                      ********
    //       |     *                                  **
    //  1.10 |      *                               *
    //       |       *                            *
    //  1.00 |─ ─ ─ ─*─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─*─ ─ ─ ─ ─ ─ ─ ─ ─
    //       |        *                     *
    //  0.90 |         *                  *
    //       |          *               *
    //  0.80 |           *            *
    //       |            **       **
    //  0.70 |              *******
    //       ├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──┤
    //      00   02   04   06   08   10   12   14   16   18   20  24
    //
    // IMPORTANT: This model is built on limited evidence and clinical experience.
    // Should be updated if better quantitative data become available.
    // See MODEL-IMPLEMENTATION.md section 8 and BG-SCIENCE.md section 14.
    // =========================================================================
    // circadianISF moved to engine (S7.6a) — proxy.
    get circadianISF() { return this.engine.circadianISF; }

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

        // Wall-clock seconds → sim-minutes (facade responsibility). Engine.step() now
        // owns the ENTIRE physiology tick standalone (S8-C3); the facade provides
        // graph sampling via onSample and runs game post-processing in _postStep() afterwards.
        const simulatedMinutesPassed = deltaTimeSeconds * this.simulationSpeed / 60;
        this._tickPhysiology(simulatedMinutesPassed);
    }

    // _tickPhysiology — shared facade wrapper around engine.step() + game post-processing.
    // Used by both update() (wall-clock tick) and _stepEngineScenario() (Lab API).
    // Captures box-sweep prev-values BEFORE engine.step advances the clock/BG (Box Challenge),
    // provides graph sampling via onSample, and runs _postStep() after physics.
    _tickPhysiology(simulatedMinutesPassed) {
        // Box sweep: save previous tick's BG + time-of-day BEFORE engine.step advances
        // them. Used by the Box Challenge collision sweep in _postStep.
        this._prevTrueBG = this.trueBG;
        this._prevTimeInMinutes = this.timeInMinutes;
        this.engine.step(simulatedMinutesPassed, {
            onSample: sample => physiologyDataPoints.push(sample)
        });
        this._postStep(simulatedMinutesPassed);
    }

    // _postStep — Game post-processing after engine.step() (S8-C3).
    // Engine.step() owns the physics (insulin prep, substep loop, IOB, CGM signal);
    // this method runs the facade-/game-specific tasks in the same order as the old
    // _stepPhysiology tail: steep-drop warning, dispatch of buffered engine events
    // (auto-stop + cgm-sample via _flushEngineEvents → graph/sound/self-test),
    // graph-message cleanup, sleep/morning events, score/weight/stats/game-over/kit-status,
    // and Box Challenge day-rollover + collision sweep. Called by _tickPhysiology().
    _postStep(simulatedMinutesPassed) {
        const currentHour = Math.floor(this.timeInMinutes / 60);

        // Gem en reproducerbar starttilstand ved midnat. Insights bruger det
        // tidligste snapshot inden for sit vindue og viser dermed fortsættelsen
        // af den spillede bane i stedet for en ny, tom modeldag.
        if (this._lastSnapshotDay === null) {
            this._lastSnapshotDay = this.day;
            if (this.timeInMinutes < 30) this._captureEngineSnapshot();
        } else if (this.day !== this._lastSnapshotDay) {
            this._lastSnapshotDay = this.day;
            this._captureEngineSnapshot();
        }

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
        //   1. Interstitial delay (Hovorka's C compartment: dC = ka_int × (G - C))
        //   2. Random measurement noise (sensor electronics)
        //   3. Slow systematic drift (sensor degradation, calibration drift)
        //
        // The delay is modelled physiologically via Hovorka's ODE:
        //   dC/dt = ka_int × (G - C)
        // where G is plasma glucose and C is interstitial glucose.
        // ka_int = 0.073 min⁻¹ → time constant ~14 min → 5-10 min effective lag.
        // This is a first-order low-pass filter that gives:
        //   - Rapidly rising BG: CGM lags behind (shows lower)
        //   - Rapidly falling BG: CGM lags behind (shows higher)
        //   - Stable BG: CGM = true BG (no delay at steady state)
        //
        // Noise, drift, and jumps are added on top of the interstitial value.
        //
        // CGM is updated every 5 simulated minutes (like real CGM sensors).
        // The result is clamped to 2.2-30.0 mmol/L.
        // Real CGM sensors typically do not report that high, but the simulator
        // uses 30 to make severe hyperglycaemia visible on the graph.
        // =====================================================================
        // The CGM sampling gate (5-min cadence + status + signal computation) now runs
        // INSIDE engine.step() (S8-C2/C3) and emits 'cgm-sample'. This flush dispatches
        // the buffered engine events from the tick — auto-stop (exercise-max-duration +
        // activity-ended) and cgm-sample — so the facade's _applyCgmSample() creates
        // graph history, tick sound, and self-test trigger. The self-test RNG draw happens
        // in the handler AFTER the substep loop's RNG → unchanged RNG order.
        this._flushEngineEvents();

        // Clean up expired graph messages — mark as fading rather than removing
        // immediately so the UI can animate them out.
        // Minimum real time for graph tips. Without this rule, tips disappear
        // within seconds at maximum speed even though expireTime in sim-time is
        // technically correct.
        const TIP_MIN_VISIBLE_MS = 10000;
        const TIP_FADE_OUT_MS = 2000;
        const nowRealMs = performance.now();
        for (const msg of this.graphMessages) {
            if (msg._createdRealTimeMs === undefined) {
                msg._createdRealTimeMs = nowRealMs;
            }

            const isTipMessage = !!(msg.isGameTip || msg.isTutorialTip);
            const hasReachedSimExpiry = this.totalSimMinutes >= msg.expireTime;
            const hasReachedRealMinimum = !isTipMessage
                || (nowRealMs - msg._createdRealTimeMs) >= TIP_MIN_VISIBLE_MS;

            if (hasReachedSimExpiry && hasReachedRealMinimum && !msg._fadingOut) {
                msg._fadingOut = true;
                msg._fadeStartTime = nowRealMs;
            }
        }
        this.graphMessages = this.graphMessages.filter(msg => {
            if (!msg._fadingOut) return true;
            const fadeDurationMs = msg._fadeDurationMs || TIP_FADE_OUT_MS;
            return (nowRealMs - msg._fadeStartTime) < fadeDurationMs;
        });

        // Sleep/morning crossings (22:00 sleep-started + night reset, 07:00 morning
        // alarm + sleep-debt/good-sleep) are now driven by engine._processSleepCrossings()
        // in step() (S9.8). It emits sleep-started/morning-alarm/good-sleep/sleep-debt;
        // Facadens event handlers skaber lyd og grafbeskeder, mens UI læser
        // motorens fælles vågenhistorik direkte.

        // Run end-of-tick housekeeping
        // NB: Ketones, acidosis and glucotoxicity are now updated in the substep loop
        // (_substepKetones / updateAcidosisLoad / updateGlucotoxicity) — not here.
        this.updateNormoPoints(simulatedMinutesPassed);
        this.updateWeight();
        this.updateStats();
        this._checkBoxRespawnBasalReminder();
        this.checkGameOverConditions();
        this.updateGlucagonStatus();
        this.updateFingerprickStatus();
        this.updateKetoneTestStatus();

        // --- Box Challenge / Sandbox: day rollover + (box only) collision detection ---
        // Day-rollover logic is shared between box and sandbox — both modes show a
        // level-complete popup at sim-midnight with TIR stars and bonus.
        // Campaign has its own end-of-level popup and does not use this hook.
        if ((this.gameMode === 'boxchallenge' || this.gameMode === 'sandbox') && !this.isGameOver) {
            // Day rollover: award bonus for yesterday + wait for the player's "Next day" click.
            // In box mode, boxes are NOT generated here — that happens in startNextDay().
            // In sandbox there are no boxes, so Next day just closes the popup.
            if (this.day > this.currentLevelDay) {
                if (!this.levelBonusAwarded && this.currentLevelDay >= 1) {
                    this.awardLevelBonus(this.currentLevelDay);
                }
                // Update currentLevelDay immediately to prevent re-triggering.
                this.currentLevelDay = this.day;
                this.dayStartPoints = this.normoPoints;
                this.levelBonusAwarded = false;
            }
        }

        // --- Box Challenge ONLY: sweep collision detection against boxes ---
        if (this.gameMode === 'boxchallenge' && !this.isGameOver) {
            // Sweep collision detection: check whether the BG curve has crossed a box
            // between the previous and current tick. With fast BG changes (glucagon,
            // large insulin doses) BG can jump over a box in one tick — the sweep
            // catches this by testing the full BG interval [prevBG, trueBG].
            const timeInDay = this.timeInMinutes;
            const prevTime = this._prevTimeInMinutes || timeInDay;
            const bgLo = Math.min(this._prevTrueBG || this.trueBG, this.trueBG);
            const bgHi = Math.max(this._prevTrueBG || this.trueBG, this.trueBG);
            // Time interval: normally [prevTime, timeInDay], but handle midnight wrap
            const tLo = (prevTime <= timeInDay) ? prevTime : 0;
            const tHi = timeInDay;

            // Respawn immunity: after loseLife the player is immune to box collision
            // for a short period so they cannot die immediately again.
            const isImmune = this.totalSimMinutes < this.respawnImmunityUntil;

            for (let i = 0; i < this.boxes.length; i++) {
                const box = this.boxes[i];
                if (box.dayNumber !== this.day || box.hit) continue;
                if (isImmune) continue; // Skip boxes during immunity
                // Time-overlap check first (cheap)
                if (tHi < box.startMinute || tLo > box.endMinute) continue;

                // BG interval for the box at the current time.
                // Skewed boxes (parallelograms) have a linearly interpolated BG offset
                // from 0 at startMinute to skewBG at endMinute.
                const skew = box.skewBG || 0;
                let boxBgMin, boxBgMax;
                if (skew === 0) {
                    // Standard rektangel — simpel AABB
                    boxBgMin = box.bgMin;
                    boxBgMax = box.bgMax;
                } else {
                    // Skewed box: compute the BG interval covered in the time window [tLo, tHi].
                    // Offset is interpolated linearly: 0 at start, skewBG at end.
                    const dur = box.endMinute - box.startMinute || 1;
                    const frac1 = Math.max(0, Math.min(1, (tLo - box.startMinute) / dur));
                    const frac2 = Math.max(0, Math.min(1, (tHi - box.startMinute) / dur));
                    const off1 = skew * frac1;
                    const off2 = skew * frac2;
                    // Box covers from min(offset1, offset2) to max(offset1, offset2)
                    boxBgMin = box.bgMin + Math.min(off1, off2);
                    boxBgMax = box.bgMax + Math.max(off1, off2);
                }

                // Sweep AABB overlap: BG-kurve [bgLo, bgHi] ∩ boksens BG-interval
                if (bgHi >= boxBgMin && bgLo <= boxBgMax) {
                    box.hit = true;
                    this.loseLife('box');
                    break; // Only one life lost per tick
                }
            }
        }
    }

    // =========================================================================
    // SCORING — Normoglycemia Points
    // =========================================================================
    //
    // Points are earned for time spent in target BG ranges:
    //   - Bonus range (5.0-6.0 mmol/L): 2.0 points per hour (tight control!)
    //   - Normal range (4.0-10.0 mmol/L): 1.0 point per hour
    //   - Elevated hyper (10.0-14.0 mmol/L): 0.5 points per hour (orange zone)
    //   - Hypo (<4.0) or high hyper (>14.0): 0 points per hour
    //
    // The asymmetry reflects that hypoglycemia is acutely dangerous (seizures, loss of
    // consciousness), whereas moderate hyperglycemia (10-14) causes long-term harm but
    // is not immediately dangerous. Based on International Consensus on TIR (Battelino 2019):
    //   TAR Level 1: 10.1-13.9 mmol/L — target <25% of time
    //   TAR Level 2: >13.9 mmol/L — target <5% of time
    //
    // @param {number} minutesPassed - Simulated minutes elapsed this tick
    // =========================================================================
    updateNormoPoints(minutesPassed) {
        // Check for entering bonus range (triggers stjernedrys-lyd)
        const inBonusNow = this.trueBG >= 5.0 && this.trueBG <= 6.0;
        if(inBonusNow && !this.isInBonusRange) {
            playSound('bonus');
        }
        this.isInBonusRange = inBonusNow;

        // Hypo warning sound with hysteresis:
        // Plays when BG crosses DOWN through 4.5 (falling).
        // Does NOT play again until BG has been ABOVE 5.0 (hysteresis threshold).
        // Prevents repeated sounds when BG hovers near 4.5 at equilibrium.
        // Minimum 15 sim-min cooldown as extra spam protection.
        if (this.trueBG >= 5.0) {
            this.hypoWarnArmed = true;  // Reset — ready for the next warning
        }
        const bgFalling = this.trueBG < this.lastTrueBGForDropCheck;
        if (this.trueBG < 4.5 && bgFalling && this.hypoWarnArmed
            && this.totalSimMinutes - this.lastHypoWarnTime >= 15) {
            playSound('hypoWarn');
            this.lastHypoWarnTime = this.totalSimMinutes;
            this.hypoWarnArmed = false;  // Latched — requires BG > 5.0 before next warning
        }

        // In-range sound: positive sound when BG returns to green zone (4.0-10.0)
        // from either hypo (<4) or hyper (>10). Played only on the inbound transition.
        const inRangeNow = this.trueBG >= 4.0 && this.trueBG <= 10.0;
        if (inRangeNow && !this.isInRange) {
            playSound('inRange');
        }
        this.isInRange = inRangeNow;

        // Hyper-zone sound: plays when BG crosses above 10.0.
        // Less dramatic than hypo — a brief negative tone signalling that
        // the player has exited the target zone upward.
        const inHyperNow = this.trueBG > 10.0;
        if (inHyperNow && !this.isInHyperZone) {
            playSound('hyperWarn');
        }
        this.isInHyperZone = inHyperNow;

        // Determine point weight based on current BG
        let bgWeight = 0;
        if (inBonusNow) {
            bgWeight = 2;         // Tight control bonus: 2x points
        } else if (this.trueBG >= 4.0 && this.trueBG <= 10.0) {
            bgWeight = 1;         // In range: normal points
        } else if (this.trueBG > 10.0 && this.trueBG <= 14.0) {
            bgWeight = 0.5;       // Elevated hyper (orange zone): halve points
        } else {
            bgWeight = 0;         // Hypo (<4) or high hyper (>14): no points
        }

        // Accumulate points (converted from minutes to hours)
        this.normoPoints += (minutesPassed / 60) * bgWeight;

        // Update the UI display showing current point weight
        normoPointsWeighting.textContent = `(x${bgWeight.toFixed(1)})`;

        // Update visual feedback on the points badge based on weight
        const pointsBadge = normoPointsWeighting && normoPointsWeighting.closest
            ? normoPointsWeighting.closest('.status-badge') : null;
        if (pointsBadge) {
            pointsBadge.classList.remove('pts-off', 'pts-half', 'pts-on', 'pts-bonus');
            if (bgWeight === 0) pointsBadge.classList.add('pts-off');
            else if (bgWeight === 0.5) pointsBadge.classList.add('pts-half');
            else if (bgWeight >= 2) pointsBadge.classList.add('pts-bonus');
            else pointsBadge.classList.add('pts-on');
        }
    }

    // =========================================================================
    // SLEEP DISRUPTION — facade wrappers (S9.8)
    // =========================================================================
    //
    // The full sleep-disruption physics (night-awakening accrual, morning
    // conversion to chronic stress, and 22:00/07:00 clock crossings) now live in
    // PhysiologyEngine (registerNightIntervention / applySleepDebt /
    // _processSleepCrossings) — Donga et al. 2010, Zheng et al. 2017. The engine's
    // own interventions (food/insulin/exercise/glucagon) trigger accrual themselves.
    // The facade retains only these thin delegates for GAME actions that have no
    // engine counterpart (fingerprick, ketone test) + campaign-scripted awakenings.
    // The player-facing side effects (graph message, awakening bands, pop animation,
    // sleep/morning sounds) now live in the event handlers for the corresponding
    // sleep events.
    // =========================================================================
    handleNightIntervention() {
        this.engine.registerNightIntervention();
        this._flushEngineEvents();
    }

    // Fælles søvnstatus til desktop, mobil og karakterhumør. Motoren afgør både
    // nattens klokkevindue og eventuel aktivitet/restitution.
    isNightAwake(absoluteMinute = this.totalSimMinutes) {
        return this.engine.isNightAwake(absoluteMinute);
    }

    // applySleepDebt — facade delegate (S9.8). The engine's step() normally calls
    // applySleepDebt itself at the 07:00 crossing; this wrapper is retained for a
    // stable facade API (tests / external callers).
    applySleepDebt() {
        this.engine.applySleepDebt();
        this._flushEngineEvents();
    }

    /**
     * showSteepDropWarning — Display a visual warning when BG is dropping fast.
     *
     * Shows a red warning overlay on the graph area for 5 seconds (real time).
     * Only shown if not already visible (prevents stacking).
     * Triggered when trueBG < 4.0 AND drop rate > 0.15 mmol/L/min.
     */
    showSteepDropWarning() {
        this.engine.emitEvent('steep-drop-warning');
        this._flushEngineEvents();
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
     * The food's carbType determines how the carbohydrates affect gastric emptying
     * (simpleFraction, fiberPerGram, retentionFactor — looked up in CARB_TYPES from
     * js/foods.js). Default 'mixed' preserves existing behaviour for calls that do
     * not specify a type.
     *
     * EU convention: the 'carbs' parameter is SUGARS + STARCH (digestible).
     * Fiber is tracked separately via CARB_TYPES.fiberPerGram and appears in
     * stomachFiber — it is NOT included in the 'carbs' value. This matches
     * Danish nutrition labels and frida.fooddata.dk. It means that food.carbs
     * can be fed directly into Hovorka D1 without a bioavailability deduction —
     * every gram counts as potential glucose.
     *
     * @param {number} carbs    - Grams of DIGESTIBLE carbs (sugars + starch, EU style)
     * @param {number} protein  - Grams of protein (raises BG via glucagon-driven HGP, delayed onset)
     * @param {number} fat      - Grams of fat (slows carb absorption via CCK/GLP-1, pizza effect)
     * @param {string} icon     - Emoji icon for the graph/log display (default: pot/custom)
     * @param {number} weight   - Total food weight in grams (estimated from macros if 0)
     * @param {string} carbType - Carbohydrate type from CARB_TYPES (default 'mixed')
     */
    // addFood — facade wrapper (S8-A1). The physics (stomach gate, kcal, activeFood/
    // activeIntake queue, food events) now live in engine.addFood(). The facade
    // resolves catalog globals (estimateEatTimeMin, CARB_TYPES) and passes the
    // resolved values in, and injects its game-side bookkeeping (campaign
    // recordAction + handleNightIntervention) via the onAccept hook at exactly the
    // original position (after the stomach gate, before side effects) → bit-identical
    // RNG / event order.
    addFood(carbs, protein, fat, icon = '🍲', weight = 0, carbType = 'mixed', eatTimeMin = null) {
        // Compute total food weight (grams). If weight not supplied, estimate from macros.
        const foodWeight = weight > 0 ? weight : (carbs + protein + fat);

        // Compute eating time (sim-min) — used to drip the meal into the stomach
        // over time instead of instantaneously. Prevents discontinuities in τG/U_G.
        // null/undefined → fall back to weight-based heuristic (custom food).
        let eatTime;
        if (eatTimeMin !== null && eatTimeMin !== undefined && eatTimeMin > 0) {
            eatTime = eatTimeMin;
        } else if (typeof estimateEatTimeMin === 'function') {
            eatTime = estimateEatTimeMin({ weight: foodWeight, carbs, protein, fat, carbType });
        } else {
            eatTime = Math.max(0.5, Math.min(10, foodWeight / 50));
        }
        eatTime = Math.max(0.1, eatTime);

        // Look up carb-type parameters. Fall back to 'mixed' for unknown types
        // (e.g. if the caller passes a typo or a new type not yet in CARB_TYPES).
        // typeof guard because CARB_TYPES comes from foods.js (script load order).
        let carbParams = { simpleFraction: 0.20, fiberPerGram: 0.08, retentionFactor: 1.0 };
        if (typeof CARB_TYPES !== 'undefined') {
            carbParams = CARB_TYPES[carbType] || CARB_TYPES.mixed || carbParams;
        }

        const accepted = this.engine.addFood(
            { carbs, protein, fat, weight: foodWeight, eatTimeMin: eatTime, carbParams, icon },
            () => {
                // Campaign: record action for objective tracking. Night intervention
                // is now handled by engine.addFood itself (S9.8).
                if (typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive) campaignEngine.recordAction('food', this.totalSimMinutes);
            }
        );
        this._flushEngineEvents();
        if (accepted) {
            this._recordScenarioEvent({
                kind: 'meal', carbs, protein, fat,
                weight: foodWeight, carbType, eatTimeMin: eatTime, icon
            });
        }
        return accepted;
    }

    // Tilføj én spillerhandling til det karakterbundne Insights-forløb.
    _recordScenarioEvent(partial) {
        this.scenarioLog.push(Object.assign({ t: this.totalSimMinutes }, partial));
    }

    // Insights sammenligner spillerens valg med alternativer. Derfor åbnes det
    // først efter den første handling. Handlingen kan bagefter slettes i Insights,
    // hvis spilleren vil sammenligne med et forløb helt uden handlingen.
    hasMeaningfulInsightsCourse() {
        return this.scenarioLog.length > 0;
    }

    // Byg det interne scenarie, som Insights kan åbne. Kontrakten indeholder
    // kun characterId; rå ISF-, ICR- og vægtværdier følger aldrig med.
    exportInsightsScenario(options = {}) {
        const MAX_WINDOW_MIN = 72 * 60;
        const now = this.totalSimMinutes;
        const candidates = this.engineSnapshots.filter(snapshot =>
            now - snapshot.atMin <= MAX_WINDOW_MIN && snapshot.timeOfDay < 30);
        const startSnapshot = candidates.length ? candidates[0] : null;
        const windowStartMin = startSnapshot ? startSnapshot.atMin : Math.max(0, now - MAX_WINDOW_MIN);
        const spanMin = now - windowStartMin;

        const events = this.scenarioLog
            .filter(event => event.t >= windowStartMin && event.t <= now)
            .map(event => {
                const { _openEnded, ...clean } = event;
                clean.t = event.t - windowStartMin;
                if (clean.kind === 'activity' && !(clean.durationMin > 0)) clean.durationMin = 60;
                return clean;
            });

        const scenario = {
            format: 't1d-insights',
            version: 1,
            characterId: this.characterId,
            sourceMode: this.gameMode,
            levelNumber: this.levelConfig?.number || null,
            // Grænsen forbinder Insights med den pausede bane. Handlinger må kun
            // ændres frem til dette minut; derefter vises kun konsekvenserne.
            playedUntilMin: spanMin,
            events,
            // Faste fysiologiske banehændelser genafspilles i Hvad Nu Hvis, men
            // holdes adskilt fra spillerens redigerbare handlinger. Tiderne og den
            // eventuelle grafmarkering omsættes til samme lokale tidslinje.
            lockedEvents: (Array.isArray(options.lockedEvents) ? options.lockedEvents : [])
                .filter(event => event &&
                    ['acuteStress', 'chronicStress'].includes(event.kind) &&
                    Number.isFinite(event.t) && Number.isFinite(event.amount) &&
                    event.t >= windowStartMin && event.t <= now)
                .map(event => {
                    const clean = {
                        t: event.t - windowStartMin,
                        kind: event.kind,
                        amount: event.amount
                    };
                    if (event.marker) {
                        const marker = Object.assign({}, event.marker);
                        if (marker.type === 'interval') {
                            marker.startMin -= windowStartMin;
                            marker.endMin -= windowStartMin;
                        } else {
                            marker.timeMin -= windowStartMin;
                        }
                        clean.marker = marker;
                    }
                    return clean;
                }),
            // Den stiplede reference er det faktisk spillede, simulerede forløb
            // frem til åbningstidspunktet - ikke en ny forudsigelse af resten af dagen.
            sourceBg: this.bgHistoryForStats
                .filter(point => point.time >= windowStartMin && point.time <= now)
                .map(point => ({
                    t: point.time - windowStartMin,
                    bg: point.trueBG
                })),
            // Box Challenge-kasser er en del af det spillede scenarie, ikke
            // redigerbare handlinger. De kopieres derfor separat med absolut tid
            // omsat til Insights-tidslinjen. Editorens 6 timers fremskrivning
            // afgør, hvilke kommende kasser der fortsat er synlige.
            lockedBoxes: this.gameMode === 'boxchallenge'
                ? this.boxes
                    .map(box => {
                        const absoluteStart = (box.dayNumber - 1) * 1440 + box.startMinute;
                        const absoluteEnd = (box.dayNumber - 1) * 1440 + box.endMinute;
                        return {
                            startMin: absoluteStart - windowStartMin,
                            endMin: absoluteEnd - windowStartMin,
                            bgMin: box.bgMin,
                            bgMax: box.bgMax,
                            skewBG: box.skewBG || 0,
                            hit: !!box.hit
                        };
                    })
                    .filter(box => box.endMin >= 0 && box.startMin <= spanMin + 360)
                : [],
            // Livstab hører til det faktisk spillede forløb og er derfor ikke
            // redigerbare. BG-værdien gemmes før en eventuel respawn.
            sourceIncidents: this.gameMode === 'boxchallenge'
                ? this.boxChallengeIncidents
                    .filter(incident => incident.t >= windowStartMin && incident.t <= now)
                    .map(incident => ({
                        t: incident.t - windowStartMin,
                        cause: incident.cause,
                        bg: incident.bg
                    }))
                : []
        };
        if (startSnapshot) scenario.engineState = startSnapshot.snap;
        return scenario;
    }

    _captureEngineSnapshot() {
        if (!this.engine || typeof this.engine.exportState !== 'function') return;
        this.engineSnapshots.push({
            atMin: this.totalSimMinutes,
            timeOfDay: this.timeInMinutes,
            snap: this.engine.exportState()
        });
        if (this.engineSnapshots.length > 5) {
            this.engineSnapshots.splice(0, this.engineSnapshots.length - 5);
        }
    }

    /**
     * _processActiveIntake — Drips the meal's stomach-mixing contribution from
     * activeIntake into the stomach state (fatStomach, proteinStomach,
     * stomachContentGrams, and blend variables that govern τG).
     *
     * Carbs for Hovorka D1 are handled separately via the carbRate mechanism in
     * update() — this method does NOT touch Hovorka state.
     *
     * Called every substep before _substepFatProteinFFA() so that τG is computed
     * on the updated stomach blend.
     *
     * @param {number} dt — Substep duration in sim-min
     */
    // _processActiveIntake — moved to PhysiologyEngine (S7.5e). Thin delegate;
    // engine owns the activeIntake queue and stomach compartments.
    _processActiveIntake(dt) {
        return this.engine._processActiveIntake(dt);
    }

    /**
     * addFastInsulin — Player injects rapid-acting (bolus) insulin.
     *
     * Creates an insulin entry in activeFastInsulin[] with randomised
     * pharmacokinetics. The dose is deposited directly into the Hovorka S1
     * compartment (subcutaneous depot) on the next update() call — pen injection
     * takes seconds, which is instantaneous compared to tau_I = 55 min.
     *
     * Per-injection variability (Heinemann 2002, CV ~20-30%):
     *   bioavailability: session-wide (~78%, std 8%) — local degradation
     *   tauFactor: per-injection (mean 1.0, CV 25%, clamped 0.50-1.60)
     *             — varies absorption speed via Hovorka tau_I
     *
     * Also resets DKA state, since insulin addresses the root cause.
     *
     * @param {number} dose - Insulin dose in units (U)
     */
    // addFastInsulin — facade wrapper (S8-A2). The randomised pharmacokinetics
    // (session bioavailability + per-bolus tauFactor) and DKA reset now live in
    // engine.addRapidInsulin(). The facade performs its game-side bookkeeping
    // (campaign recordAction + handleNightIntervention) at the top as before and
    // then delegates.
    addFastInsulin(dose) {
        // Campaign: record action for objective tracking
        if (typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive) campaignEngine.recordAction('fastInsulin', this.totalSimMinutes);
        // Night intervention is now handled by engine.addRapidInsulin itself (S9.8).
        this.engine.addRapidInsulin({ units: dose });
        this._flushEngineEvents();
        this._recordScenarioEvent({ kind: 'bolus', units: dose });
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
    // addLongInsulin — facade wrapper (S8-A3). Trapezoidal duration randomisation
    // and DKA reset now live in engine.addBasalInsulin(). isSilent (pre-game dose)
    // skips recordAction + night + log/sound — forwarded as the silent argument to engine.
    addLongInsulin(dose, injectionTime = this.totalSimMinutes, isSilent = false) {
        // Campaign: record action for objective tracking (player-initiated injections only)
        if (!isSilent && typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive) campaignEngine.recordAction('basalInsulin', this.totalSimMinutes);
        // Night intervention is now handled by engine.addBasalInsulin itself (only when !silent, S9.8).
        this.engine.addBasalInsulin({ units: dose, injectionTime, silent: isSilent });
        this._flushEngineEvents();
        // En ny spillerstyret basaldosis gør respawn-påmindelsen overflødig.
        if (!isSilent) this._boxRespawnBasalReminderPending = false;
        if (!isSilent) this.scenarioLog.push({ kind: 'basal', t: injectionTime, units: dose });
    }

    /**
     * resetDKAState — Reset the DKA warning flag (but NOT acidosisLoad).
     *
     * Called when insulin is administered. acidosisLoad is NEVER reset manually
     * — it recovers naturally via exponential decay in updateAcidosisLoad() once
     * ketones fall below threshold. Insulin helps by lowering ketones over time
     * (via the FFA model), not by directly clearing acidosis.
     *
     * The warning flag is reset so the player can receive a new warning
     * if acidosis rises again (edge case: insulin dose too small).
     */
    resetDKAState() {
        // acidosisLoad is preserved — it recovers naturally
        this.acidosisWarningGiven = false;
    }

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
    // updateStressHormones — moved to PhysiologyEngine (S7.5e). Thin delegate.
    updateStressHormones(simulatedMinutesPassed) {
        return this.engine.updateStressHormones(simulatedMinutesPassed);
    }

    // =========================================================================
    // HYPOGLYCEMIA UNAWARENESS (HAAF) — Continuous area-based model
    // =========================================================================
    //
    // Models HAAF as a balance between damage and recovery:
    //
    // DAMAGE: When BG < 3.0 mmol/L, hypoArea accumulates in proportion to
    //   the depth below threshold: ΔhypoArea = max(0, 3.0 - BG) × dt
    //   Threshold 3.0 (not 3.5) because neuronal adaptation primarily occurs
    //   at this depth (Cryer 2013).
    //
    // RECOVERY: hypoArea decays exponentially with t½ = 3 sim-days
    //   when BG is above 4.0 (hypo-free). This models the clinical
    //   observation that 2-3 weeks hypo-free restores awareness
    //   (Dagogo-Jack 1993, Cranston 1994, Fanelli 1993).
    //
    // COUNTERREGFACTOR: Sigmoid mapping from hypoArea:
    //   counterRegFactor = 0.3 + 0.7 × exp(-hypoArea / HAAF_DAMAGE_SCALE)
    //   Ranges from 1.0 (healthy) toward 0.3 (severe HAAF) asymptotically.
    //
    // Advantages over discrete episode counting:
    //   - Proportional: deep hypo (BG=1.5) causes more damage than mild (BG=2.8)
    //   - Continuous: no arbitrary "10 min" threshold to count an episode
    //   - Reversible: recovery is gradual as long as hypo is avoided
    //   - Realistic: short, mild hypo has small effect; prolonged, deep hypo has
    //     large and lasting effect
    //
    // Sources: Dagogo-Jack 1993, Fanelli 1993, Cranston 1994,
    //          Cryer 2001/2013, Reno 2013, Rickels 2019
    // =========================================================================
    // updateHAAF — moved to PhysiologyEngine (S7.5e). Thin delegate.
    updateHAAF(simulatedMinutesPassed) {
        return this.engine.updateHAAF(simulatedMinutesPassed);
    }

    // =========================================================================
    // BRAIN ENERGY DEFICIT — Neuroglycopenia model
    // =========================================================================
    //
    // The brain depends almost entirely on glucose as its energy source.
    // The Hovorka model's F_01 parameter is the brain's baseline consumption rate.
    // When BG falls below BRAIN_CRISIS_BG (2.5 mmol/L), GLUT1 transport across
    // the blood-brain barrier cannot deliver sufficient glucose.
    //
    // Deficit accumulates in proportion to the shortfall:
    //   deficitRate = F_01 × (1 - BG / 2.5)    [mmol/min]
    //
    // The brain holds a small glycogen reserve (~4 g, Oz 2007) that acts as a
    // buffer — modelled via BRAIN_DEFICIT_THRESHOLD.
    //
    // Recovery: when BG normalises (> 2.5), reserves rebuild exponentially
    // with t½ ~45 minutes.
    //
    // Game over: when accumulated deficit exceeds the threshold → loss of
    // consciousness.
    // =========================================================================
    // updateBrainEnergyDeficit — moved to PhysiologyEngine (S7.5b). Thin
    // delegate; engine owns brainEnergyDeficit/_lowestBGDuringDeficit and the
    // internal guard brainDeficitWarningGiven.
    updateBrainEnergyDeficit(simulatedMinutesPassed) {
        return this.engine.updateBrainEnergyDeficit(simulatedMinutesPassed);
    }

    // =========================================================================
    // ACIDOSIS LOAD — Progressive metabolic acidosis from ketones
    // =========================================================================
    //
    // Keto acids (BHB + acetoacetate) lower blood pH. The body has a bicarbonate
    // buffer system that neutralises a certain amount, but with sustained elevated
    // ketones the buffer is exhausted and pH falls → organ failure.
    //
    // Identical structure to brainEnergyDeficit:
    //   - Accumulation: load rises linearly + quadratically with BHB excess
    //   - Recovery: exponential decay with t½ = 45 min when BHB normalises
    //   - Warning at 50% capacity, game over at 100%
    //
    // The quadratic term captures the logarithmic nature of the pH scale:
    // doubling BHB causes MORE than twice the damage to the buffer system.
    //
    // @param {number} simulatedMinutesPassed - Simulated minutes this tick
    // =========================================================================
    // updateAcidosisLoad — moved to PhysiologyEngine (S7.5b). Thin delegate;
    // engine owns acidosisLoad and the internal guard acidosisWarningGiven.
    updateAcidosisLoad(simulatedMinutesPassed) {
        return this.engine.updateAcidosisLoad(simulatedMinutesPassed);
    }

    // updateGlucotoxicity — moved to PhysiologyEngine (S7.5a). Thin delegate;
    // the full calculation (accumulation, recovery, sigmoid ISF divisor) now lives in
    // the engine, which owns glucotoxicLoad/glucotoxicResistanceFactor and GLUCOTOX_*.
    updateGlucotoxicity(simulatedMinutesPassed) {
        return this.engine.updateGlucotoxicity(simulatedMinutesPassed);
    }

    // =========================================================================
    // LIVER GLYCOGEN CAPACITY ESTIMATE (grams)
    // =========================================================================
    //
    // Heuristic finite reserve that fills and empties. It limits later EGP capacity,
    // but it is not a complete glucose-mass ledger: exercise drain has no matching
    // acute Q1 inflow, and postprandial refill has no matching Q1 outflow. Emergency
    // glucagon is the explicitly mass-conserving liver-to-Q1 pathway.
    //
    // CAPACITY DRAINS:
    //   1. Stress-driven glycogenolysis (Somogyi / counter-regulation):
    //      Derived from the stress component of the EGP formula:
    //      stressEGP = EGP_0 × acuteStressLevel [mmol/min] → converted to grams
    //      At stress=0.4, 70 kg: 1.127 × 0.4 × 0.180 = 0.081 g/min ≈ 5 g/hour
    //
    //   2. Exercise proxy (future liver response capacity):
    //      Derived from kcalPerMin × glycogen fraction:
    //        - Liver glycogen covers ~25% of exercise energy expenditure via carbs
    //        - 1 g glycogen ≈ 4 kcal
    //      Medium cardio (7 kcal/min): 7 × 0.25 / 4 = 0.44 g/min ≈ 26 g/hour
    //      High cardio  (10 kcal/min): 10 × 0.25 / 4 = 0.63 g/min ≈ 38 g/hour
    //
    // CAPACITY RECOVERY:
    //   1. Gluconeogenesis: constant 0.10 g/min (6 g/hour) — independent of glycogen
    //      Substrate: amino acids, lactate, glycerol — always available.
    //
    //   2. Postprandial glycogen synthesis: when BG > 5.0 mmol/L the liver stores
    //      surplus glucose as glycogen. Rate proportional to BG excess:
    //        storageRate = 0.12 × (BG - 5.0) g/min
    //      At BG=8.0 (post-meal): 0.36 g/min ≈ 22 g/hour
    //      Gonzalez 2016: ~40-60 g liver glycogen replenished after a large meal.
    //
    // EFFECT ON STRESS MODEL:
    //   glycogenReserve = min(1.0, liverGlycogenGrams / GLYCOGEN_STRESS_THRESHOLD)
    //   → Below 15 g: stress-driven EGP tapers proportionally
    //   → At 0 g: stressEGP = 0, only gluconeogenesis baseline (always active)
    //
    // Sources: Roden 2001, Petersen 2004, Trefts 2015, Gonzalez 2016
    // =========================================================================
    // updateGlycogenReserve — moved to PhysiologyEngine (S7.5e). Thin delegate.
    updateGlycogenReserve(simulatedMinutesPassed) {
        return this.engine.updateGlycogenReserve(simulatedMinutesPassed);
    }

    // =========================================================================
    // MUSCLE GLYCOGEN — Depletion during exercise + post-exercise resynthesis
    // =========================================================================
    //
    // Mass-balanced pool scaled to body weight (~5.5 g/kg, Jensen 2011).
    // Detailed explanation in the MUSCLE_GLYCOGEN_* comment block at the top of
    // this file.
    //
    // CONSUMPTION:
    //   kcalPerMin × glycogen fraction(intensity) / 4 kcal/g
    //   × glycogenUseScaling
    //
    // REPLENISHMENT (two phases):
    //   Phase 1 — AMPK-driven, insulin-independent:
    //     Active 0-~60 min after exercise ends (t½ = 45 min).
    //     Can refill the pool even at low insulin. Peak ~0.8 g/min with empty pool.
    //   Phase 2 — insulin-dependent:
    //     Baseline 0.3 g/min × insulin × BG drive.
    //     CHO-accelerated: +0.5 g/min extra when COB is present.
    //
    // GLUKOSEKOBLING:
    //   Poolen bogfører, hvordan eksisterende muskeloptag allokeres til
    //   glykogen. Den trækker ikke separat fra Q1, fordi Hovorka x1/x2 og E1
    //   allerede repræsenterer det samlede muskeloptag. Et ekstra Q1-træk ville
    //   tælle den samme glukose to gange.
    //
    // Sources: Ivy 1988 (phase-1 rate), Jentjens 2003 (CHO acceleration),
    //          Jensen 2011 (pool size), Romijn 1993 (energy partitioning).
    // =========================================================================
    // updateMuscleGlycogen — moved to PhysiologyEngine (S7.5c). Thin delegate;
    // engine owns the muscle glycogen pool state + MUSCLE_GLYCOGEN_* constants.
    updateMuscleGlycogen(simulatedMinutesPassed) {
        return this.engine.updateMuscleGlycogen(simulatedMinutesPassed);
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
     * An amount of 0.2 represents a moderate stress reaction.
     * Capped at 0.4 to prevent runaway liver glucose production.
     *
     * @param {number} amount - Stress increment (0.0-0.4 scale)
     */
    addAcuteStress(amount) {
        const accepted = this.engine.addAcuteStress(amount);
        this._flushEngineEvents();
        return accepted;
    }

    /**
     * addChronicStress — Add long-lasting stress (decays with half-life ~12 hours).
     *
     * Examples: illness, fever, sleep deprivation, prolonged psychological stress.
     * An amount of 0.5 represents one night of poor sleep or mild illness.
     * The pending pool is capped at 1.5 to keep the model stable.
     *
     * @param {number} amount - Stress increment (0.0-1.5 scale)
     */
    addChronicStress(amount) {
        const accepted = this.engine.addChronicStress(amount);
        this._flushEngineEvents();
        return accepted;
    }

    /**
     * startCgmCompression — temporary falsely-low CGM reading due to sensor pressure.
     *
     * Used for B10 night events where the player is lying on the sensor arm.
     * The effect only affects the CGM display, not trueBG or the physiology.
     *
     * @param {number} dropMmol        - Maximum false drop in CGM [mmol/L]
     * @param {number} durationMinutes - Duration of the compression [sim-minutes]
     */
    startCgmCompression(dropMmol = 2.5, durationMinutes = 45) {
        this.cgmCompressionStart = this.totalSimMinutes;
        this.cgmCompressionUntil = Math.max(
            this.cgmCompressionUntil || -Infinity,
            this.totalSimMinutes + durationMinutes
        );
        this.cgmCompressionDrop = Math.max(0.5, Math.min(5.0, dropMmol));
        this.engine.emitEvent('cgm-compression-started', { dropMmol, durationMinutes });
        this._flushEngineEvents();
    }

    /**
     * getCgmSensorStatus — aktuel CGM-tilstand.
     *
     * active:   normal CGM-måling.
     * offline:  sensoren er faldet af eller sender ingen data.
     * warmup:   ny sensor er sat på og varmer op.
     * checking: sensoren fejltester efter et mistænkeligt signal.
     *
     * Status beregnes ud fra absolut simulationstid i stedet for timers, så
     * tilstanden også virker korrekt over midnat.
     */
    // getCgmSensorStatus — facade-wrapper (S8-C2). Delegerer til engine (ren read
    // af engine-ejede sensor-timere). Kaldes af ui.js, campaign og tests via game.
    getCgmSensorStatus() {
        return this.engine.getCgmSensorStatus();
    }

    /**
     * startCgmSensorLoss — simulate the CGM sensor becoming detached / falling off.
     *
     * Used in level 10 as a learning event: when the sensor is gone the player must
     * use fingerpricks and trend understanding instead of continuous CGM data. After
     * a new sensor is applied there is a warmup period before it starts sending data.
     */
    startCgmSensorLoss(offlineMinutes = 45, warmupMinutes = 60) {
        // Engine owns the state transition + emits 'cgm-sensor-lost' (S9.7).
        // The facade flushes the event so the event handler creates log + floating label
        // (one place → no duplicate label regardless of whether the call comes from here
        // or from an engine-internal auto-trigger).
        this.engine.startCgmSensorLoss(offlineMinutes, warmupMinutes);
        this._flushEngineEvents();
    }

    /**
     * startCgmSelfTest — brief CGM error self-test without the sensor falling off.
     *
     * Represents situations where the CGM signal looks implausible, e.g. a very
     * rapid drop, high sensor noise, or an isolated reading inconsistent with its
     * neighbours. Engine owns the state transition + emit (S9.7); the facade only
     * flushes so the event handler creates log + floating label.
     */
    startCgmSelfTest(durationMinutes = 20) {
        this.engine.startCgmSelfTest(durationMinutes);
        this._flushEngineEvents();
    }

    /**
     * startIllnessSymptoms — show and play mild illness signs for a period.
     *
     * The insulin resistance itself comes from addChronicStress(). This method
     * controls only player feedback: floating symptoms on the graph and
     * occasional illness sounds.
     */
    startIllnessSymptoms(durationMinutes = 720) {
        this.illnessSymptomsStart = this.totalSimMinutes;
        this.illnessSymptomsUntil = Math.max(
            this.illnessSymptomsUntil || -Infinity,
            this.totalSimMinutes + Math.max(60, durationMinutes)
        );
        this.addFloatingLabel(t('label.illnessStarts'), this.cgmBG || this.trueBG, '#fca5a5', 150);
    }

    /**
     * addFloatingLabel — lille helper til tekstfeedback over grafen.
     */
    addFloatingLabel(text, value, color, duration = 90) {
        if (!this.floatingLabels) return;
        this.floatingLabels.push({
            time: this.totalSimMinutes,
            value,
            text,
            color,
            createdAt: this.totalSimMinutes,
            duration
        });
    }


    // =========================================================================
    // ACTIVITY — Start an activity session
    // =========================================================================
    //
    // Starts an activity based on type (cardio/styrke/blandet/afslapning),
    // intensity (Lav/Medium/Høj), and optional duration (15/30/60/null=open).
    //
    // Only one activity can run at a time. The activity affects BG through:
    //   - E1-kontraktionsoptagelse i Hovorka-modellen
    //   - En separat, forsinket ændring af insulinmedieret følsomhed
    //   - Exercise-specific hepatic drive (catecholamines for strength/mixed)
    //   - Stress reduction (parasympathetic activation for relaxation)
    //   - pulsFaktor (faster insulin absorption at elevated heart rate)
    //
    // Motionsfølsomheden oprettes ved start og udvikles kontinuerligt. Stop fryser
    // kun den faktiske varighed; det skaber ikke en ny fysiologisk effekt.
    //
    // @param {string} type          - "cardio", "styrke", "blandet", "afslapning"
    // @param {string} intensitet    - "Lav", "Medium", "Høj"
    // @param {number|null} varighed - Duration in minutes (15/30/60), or null=open-ended
    // =========================================================================
    // startAktivitet — facade wrapper (S8-A4). Gates (active session, cooldown),
    // post-exercise setup, and activity events now live in engine.startActivity().
    // The facade looks up AKTIVITETSTYPER[type] and injects handleNightIntervention
    // via onAccept (after gates, before side effects) → bit-identical RNG order.
    startAktivitet(type, intensitet, varighed) {
        const typeDef = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[type] : undefined;
        // Night intervention is now handled by engine.startActivity itself (S9.8).
        const started = this.engine.startActivity(
            { type, intensity: intensitet, durationMin: varighed, typeDef }
        );
        this._flushEngineEvents();
        if (started) {
            this._recordScenarioEvent({
                kind: 'activity', actType: type, intensity: intensitet,
                durationMin: varighed || null, _openEnded: !varighed
            });
        }
        return started;
    }

    // =========================================================================
    // PRUNE EXPIRED MOTIONS — Remove sessions that no longer contribute
    // =========================================================================
    //
    // Sessions in activeMotion[] where totalSimMinutes >= sensitivityEndTime
    // no longer contribute to ISF (filtered out in the currentISF getter),
    // but would otherwise accumulate in the array indefinitely. This method
    // clears them. Typically called from stopAktivitet where the array is
    // mutated anyway, keeping its size at "sessions that can still contribute"
    // (typically 0-3).
    // =========================================================================
    pruneExpiredMotions() {
        this.activeMotion = this.activeMotion.filter(m =>
            this.totalSimMinutes < m.sensitivityEndTime
        );
    }

    // =========================================================================
    // STOP ACTIVITY — End the active activity session
    // =========================================================================
    //
    // Calculates actual duration and calorie expenditure.
    // Færdiggør den kontinuerlige sensitivity-session, som blev oprettet ved start.
    // =========================================================================
    // stopAktivitet — facade wrapper (S8-A4/C1). Post-exercise sensitivity, cooldown
    // and the activity-ended event live in engine.stopActivity(). The log-history
    // patch (graph band shows actual duration) now happens in the activity-ended
    // handler, so both manual stop and engine-internal auto-stop patch correctly.
    // No RNG → bit-identical.
    stopAktivitet() {
        if (!this.activeAktivitet) return;
        this.engine.stopActivity();
        this._flushEngineEvents();
        for (let index = this.scenarioLog.length - 1; index >= 0; index--) {
            const event = this.scenarioLog[index];
            if (event.kind === 'activity' && event._openEnded) {
                event.durationMin = Math.max(1, Math.round(this.totalSimMinutes - event.t));
                delete event._openEnded;
                break;
            }
        }
    }

    // Backwards-compatible wrapper — used by existing tests and possibly keyboard shortcuts
    startMotion(intensity, duration) {
        this.startAktivitet('cardio', intensity, parseInt(duration));
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
        // Cooldown check: test strips are expensive and the prick is painful — 3-hour cooldown
        const cooldownMinutes = 3 * 60;
        if (this.totalSimMinutes - this.fingerprickUsedTime < cooldownMinutes) return;

        this.handleNightIntervention();
        const measuredBG = this.trueBG * (1 + (this.rng() * 0.1 - 0.05)); // ±5% error
        this.engine.emitEvent('fingerprick-measured', { value: measuredBG });
        this._flushEngineEvents();
        cgmDataPoints.push({ time: this.totalSimMinutes, value: measuredBG, type: 'fingerprick' });

        // Floating label above the measurement point on the graph (game-style feedback)
        const bgColor = measuredBG < 4.0 ? '#b91c1c' : measuredBG > 10.0 ? '#b91c1c' : '#38a169';
        this.floatingLabels.push({
            time: this.totalSimMinutes,
            value: measuredBG,
            text: `🩸 ${displayBG(measuredBG)}`,
            color: bgColor,
            createdAt: this.totalSimMinutes,
            duration: 90  // Visible for 90 sim-minutes
        });
        this.engine.emitEvent('fingerprick-sound');
        this._flushEngineEvents();

        this.fingerprickUsedTime = this.totalSimMinutes;
        this.updateFingerprickStatus();
    }

    /**
     * updateFingerprickStatus — Enable/disable the fingerprick button based on cooldown.
     *
     * Test strips cost ~8 DKK each and the prick is uncomfortable. In practice
     * people test 4-8 times per day (roughly every 3 hours).
     * Cooldown: 3 simulated hours. Pie-chart animation shows remaining time.
     */
    updateFingerprickStatus() {
        const cooldownMinutes = 3 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.fingerprickUsedTime;
        const onCooldown = timeSinceUsed < cooldownMinutes;
        this.fingerprickOnCooldown = onCooldown;

        this.engine.emitEvent('kit-cooldown-status', {
            buttonId: 'fingerprickButton',
            onCooldown,
            cooldownPercent: Math.min(100, (timeSinceUsed / cooldownMinutes) * 100),
            remainingMinutes: cooldownMinutes - timeSinceUsed,
            readyLabelKey: 'kit.fingerprick'
        });
        this._flushEngineEvents();
    }

    // =========================================================================
    // SUBSTEP METHODS — ODEs that run INSIDE the Hovorka substep loop
    // =========================================================================
    // These methods update fat/protein/FFA/ketone compartments with small
    // time steps (≤ 1 min) instead of the full simulatedMinutesPassed.
    // This ensures numerical stability and accuracy at high forward-speed.
    //
    // Previously these calculations ran outside the substep loop with full dt
    // (up to 5-10 min at 10x speed), which caused:
    //   - Imprecise fat absorption (A1 in review 2026-04-01)
    //   - FFA clearance with too-large an Euler step (A2)
    //   - Unstable ketone Michaelis-Menten clearance (A3)
    // =========================================================================

    // _substepFatProteinFFA — Update fat/protein compartments and FFA with substep dt.
    //
    // Fat compartments:    fatStomach → fatIntestine → absorbed (FFA in blood)
    // Protein compartments: proteinStomach → proteinGut → aminoAcidsBlood
    // FFA: accumulation from fat absorption + exponential clearance
    //
    // Also updates derived values:
    //   - hovorka.tau_G (dynamic gastric emptying — pizza effect)
    //   - ffaResistanceFactor (FFA-induced insulin resistance)
    //   - proteinGlucagonLevel (amino acid-driven glucagon)
    //
    // @param {number} dt - Time step in simulated minutes (≤ 1.0)
    // _substepFatProteinFFA — moved to PhysiologyEngine (S7.5d). Thin delegate;
    // engine owns fat/protein/FFA/stomach state + STOMACH_*/TAU_*/FFA_*/AA_*.
    _substepFatProteinFFA(dt) {
        return this.engine._substepFatProteinFFA(dt);
    }

    // _substepRapidInsulin — Per-bolus rapid insulin absorption.
    //
    // (codex review 2026-04-07 followup, issue 3)
    //
    // Each active bolus in activeFastInsulin has its own (s1, s2, tauI) triple.
    // This method integrates each bolus's two-compartment cascade with its own
    // tauI using Euler, and writes the summed totals back into state[2]/state[3]
    // as cached totals for IOB display and respawn logic.
    //
    // pulsFaktor (exercise-induced subcutaneous perfusion) affects all boluses
    // equally — physiologically correct because increased blood flow flushes
    // insulin faster regardless of which depot it resides in.
    //
    // The aggregate absorption is set as hovorka.rapidU_I, used in
    // hovorka.step()'s dI calculation. This replaces the earlier global
    // U_I = S2/tau_I, where a single shared tau_I meant a new bolus could
    // retroactively alter the kinetics of previously injected insulin.
    //
    // Euler stability: tauI is typically 27-88 min (55 × clamp[0.5-1.6]),
    // and dt ≤ 1 min, so stepDt/tauI ≤ 0.037 << 1 — exponential decay is
    // numerically stable.
    //
    // @param {number} dt - Time step in simulated minutes (≤ 1.0)
    // _substepRapidInsulin — moved to PhysiologyEngine (S7.5d). Thin delegate;
    // engine owns activeFastInsulin and drives Hovorka's rapid depot.
    _substepRapidInsulin(dt) {
        return this.engine._substepRapidInsulin(dt);
    }

    // =========================================================================
    // KETONE MODEL — FFA-driven ketone model based on plasma insulin
    // =========================================================================
    //
    // New model (replaces the old BG-driven model, March 2026).
    //
    // Physiological cascade:
    //   1. Lipolysis: adipose tissue releases FFA in proportion to insulin DEFICIENCY
    //      - Insulin suppresses lipolysis via HSL (hormone-sensitive lipase)
    //      - Physiological EC50 ~13-18 mU/L (Nurjhan 1986, Campbell 1992)
    //      - Calibrated EC50=5 mU/L (lower than physiological, see constructor comment)
    //      - At zero insulin: full lipolysis (0.09 units/min)
    //      - At normal insulin (20 mU/L): minimal lipolysis
    //
    //   2. CPT-1 gating: insulin → ACC → malonyl-CoA → blocks CPT-1
    //      - CPT-1 is the gateway to mitochondrial beta-oxidation
    //      - Without insulin: malonyl-CoA falls → CPT-1 opens → FFA → ketones
    //      - Note: in DKA there is plentiful blood glucose, but without insulin
    //        cells cannot take it up → no intracellular glucose → no malonyl-CoA
    //        → CPT-1 open → ketogenesis despite high BG
    //
    //   3. Ketone clearance (two mechanisms):
    //      a. Michaelis-Menten oxidation (muscle + brain)
    //         - Saturable: rate slows at high BHB → DKA spiral possible
    //         - Exercise boosts capacity (up to 2× at high heart rate)
    //      b. Renal excretion (ketonuria)
    //         - Linear above threshold ~0.5 mmol/L
    //         - Important safety drain at very high levels
    //
    // Clinical thresholds (blood BHB, mmol/L):
    //   Normal:   < 0.6    — all fine
    //   Elevated: 0.6-1.5  — take extra insulin, drink water
    //   Dangerous: 1.5-3.0 — seek medical advice, administer insulin
    //   DKA:      > 3.0    — acutely life-threatening
    //
    // Calibration verified against clinical measurements:
    //   Normal (I=20 mU/L):      BHB ~0.08 mmol/L    ✓
    //   Overnight fast (I=12):   BHB ~0.3-0.5 mmol/L ✓
    //   Pump failure 4 h (I→0):  BHB ~1.5-2.0 mmol/L ✓
    //   Pump failure 8 h (I→0):  BHB ~3.5-4.5 mmol/L ✓
    //
    // Sources: Pinnaro 2021, Laffel 1999, Cahill 1970, McGarry 1980, Robinson 1980
    // =========================================================================

    // _substepKetones — Update ketone compartments with substep dt.
    //
    // Runs AFTER hovorka.step() in the substep loop so plasmaInsulin is updated.
    // Lipolysis FFA is a SEPARATE pool from dietary FFA (ffaBlood).
    //
    // @param {number} dt - Time step in simulated minutes (≤ 1.0)
    // _substepKetones — moved to PhysiologyEngine (S7.5d). Thin delegate;
    // engine owns ketone/FFA state + LIPOLYSIS_*/CPT1_*/BHB_* constants.
    _substepKetones(dt) {
        return this.engine._substepKetones(dt);
    }

    /**
     * performKetoneTest — Manual ketone measurement with a blood ketone strip.
     *
     * Measures the current ketone level with ±10% error margin (same as fingerprick).
     * Displays the result as a log message with colour-coded warning level.
     * Incurs a 30-minute night penalty (same as fingerprick).
     */
    performKetoneTest() {
        // Cooldown check: ketone strips are expensive (~20 DKK) — 6-hour cooldown
        const cooldownMinutes = 6 * 60;
        if (this.totalSimMinutes - this.ketoneTestUsedTime < cooldownMinutes) return;

        this.handleNightIntervention();
        const measured = this.ketoneLevel * (1 + (this.rng() * 0.2 - 0.1)); // ±10% error
        const measuredClamped = Math.max(0, measured);

        // Determine warning level from the measured ketone value
        // Clinical thresholds for blood ketones (beta-hydroxybutyrate):
        //   < 0.6: normal (fasting can also raise it to 0.5)
        //   0.6-1.5: mildly elevated — may be fasting, ketogenic diet, or early insulin deficiency
        //   1.5-3.0: elevated — DKA risk if due to insulin deficiency
        //   > 3.0: high — DKA likely if BG is also high and insulin is deficient
        // Note: fasting ketosis can reach 3-4 mmol/L without danger — context matters!
        let statusShort;
        if (measuredClamped < 0.6) {
            statusShort = t('ketone.ok');
        } else if (measuredClamped < 1.5) {
            statusShort = t('ketone.elevated');
        } else if (measuredClamped < 3.0) {
            statusShort = t('ketone.high');
        } else {
            statusShort = t('ketone.critical');
        }

        // S3.8: ketone test log event now goes through the engine event layer (same
        // pattern as fingerprick). statusShort is still computed here (also used
        // by the floating label below) and passed along; the facade handler builds
        // the localised log text. See docs/reviews/physiology-engine-LOG.md.
        this.engine.emitEvent('ketone-test-measured', { value: measuredClamped, status: statusShort });
        this._flushEngineEvents();

        // Floating label above the CGM position on the graph
        const popupColor = measuredClamped < 0.6 ? '#38a169' : measuredClamped < 1.5 ? '#d69e2e' : measuredClamped < 3.0 ? '#e67e22' : '#b91c1c';
        this.floatingLabels.push({
            time: this.totalSimMinutes,
            value: this.cgmBG,  // Display at CGM level (ketone is not BG)
            text: `🧪 ${measuredClamped.toFixed(1)} ${statusShort}`,
            color: popupColor,
            createdAt: this.totalSimMinutes,
            duration: 120  // Visible for 120 sim-minutes (slightly longer for ketone)
        });
        this.engine.emitEvent('ketone-test-sound');
        this._flushEngineEvents();

        this.ketoneTestUsedTime = this.totalSimMinutes;
        this.ketoneTestLastValue = measuredClamped;

        // Record action in campaign engine so tips with
        // afterAction: 'ketoneTest' can trigger.
        if (typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive) {
            campaignEngine.recordAction('ketoneTest', this.totalSimMinutes);
        }

        this.updateKetoneTestStatus();
    }

    /**
     * updateKetoneTestStatus — Enable/disable the ketone test button based on cooldown.
     *
     * Ketone test strips cost ~20 DKK each. In practice you only test ketones
     * when insulin deficiency is suspected (high BG, nausea, stomach pain).
     * Cooldown: 6 simulated hours. Pie-chart animation shows remaining time.
     */
    updateKetoneTestStatus() {
        const cooldownMinutes = 6 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.ketoneTestUsedTime;
        const onCooldown = timeSinceUsed < cooldownMinutes;
        this.ketoneTestOnCooldown = onCooldown;

        this.engine.emitEvent('kit-cooldown-status', {
            buttonId: 'ketoneTestButton',
            onCooldown,
            cooldownPercent: Math.min(100, (timeSinceUsed / cooldownMinutes) * 100),
            remainingMinutes: cooldownMinutes - timeSinceUsed,
            readyLabelKey: 'kit.ketone'
        });
        this._flushEngineEvents();
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
        const onCooldown = timeSinceUsed < cooldownMinutes;

        this.engine.emitEvent('kit-cooldown-status', {
            buttonId: 'kitGlucagonButton',
            onCooldown,
            cooldownPercent: Math.min(100, (timeSinceUsed / cooldownMinutes) * 100),
            remainingMinutes: cooldownMinutes - timeSinceUsed,
            readyLabelKey: 'kit.glucagon'
        });
        this._flushEngineEvents();
    }

    /**
     * useGlucagon — Emergency glucagon injection for severe hypoglycemia.
     *
     * Gradual glycogenolysis over 20-45 min (refactored 2026-06-04):
     *
     *   Clinical: 1 mg glucagon IM typically mobilises 25-40 g glucose from
     *   hepatic glycogenolysis over 20-30 min. Peak BG rise +3-8 mmol/L
     *   (Carstensen 1994, Pearson 2008, Haymond 2005). Onset 5-10 min,
     *   peak 15-25 min, return toward baseline 60-120 min depending on IOB.
     *
     *   Mass conservation: glucose is drawn from liverGlycogenGrams and
     *   added to Q1 (plasma) in the substep loop via _substepGlucagon().
     *   If the liver pool is depleted (post-exercise, fasting, alcohol-
     *   inhibited GNG):
     *     - Empty pool (≤ 5 g): minimal effect, clinical failure
     *     - Half pool (~45 g): ~half effect
     *     - Full pool (≥ 70 g): full effect
     *   This matches clinical experience that glucagon does NOT work in
     *   alcohol- or prolonged-fasting hypoglycemia (Rasmussen 2014, Sherwin 2019).
     *
     *   Game-mechanic cooldown retained: 24 hours between injections
     *   (one glucagon pen available per day). Physiological recovery of
     *   liver glycogen happens INDEPENDENTLY via updateGlycogenReserve():
     *   with food intake the pool refills in 8-12 h, without food 24-48 h.
     */
    // useGlucagon — facade wrapper (S8-A5). The glucose mobilisation calculation +
    // activeGlucagon + events now live in engine.useGlucagon(). The facade retains
    // the 24 h cooldown (game mechanic, glucagonUsedTime) + handleNightIntervention
    // + DOM status. Night before engine call, status after → unchanged order.
    useGlucagon() {
        // Double-check game cooldown (guard against direct calls)
        const cooldownMinutes = 24 * 60;
        if (this.totalSimMinutes - this.glucagonUsedTime < cooldownMinutes) return;
        // Night intervention is now handled by engine.useGlucagon itself (S9.8).
        this.engine.useGlucagon();
        this._flushEngineEvents();
        this.glucagonUsedTime = this.totalSimMinutes;
        this.updateGlucagonStatus();
        this._recordScenarioEvent({ kind: 'glucagon' });
    }

    /**
     * _substepGlucagon — Gradual glycogen mobilisation from an active glucagon injection.
     *
     * Called per substep (dt ≤ 1 min) from the update() loop. Triangle profile
     * over duration_min minutes:
     *   - 0 → peakMin: linear ramp-up
     *   - peakMin → duration_min: linear ramp-down
     *   - After duration_min: glucagon effect ends, this.activeGlucagon is cleared
     *
     * Mass conservation: glucose is drawn from liverGlycogenGrams and added
     * to Q1 (mmol). 1 g glucose ≈ 5.551 mmol (= 1000/180.16).
     *
     * @param {number} dt - Substep duration in sim-min
     */
    // _substepGlucagon — moved to PhysiologyEngine (S7.5e). Thin delegate;
    // engine owns activeGlucagon + liverGlycogenGrams.
    _substepGlucagon(dt) {
        return this.engine._substepGlucagon(dt);
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
    // The value color changes: green (stable) → yellow (>50% of limit) → red (>80%).
    // Game over at ±weightLimitKg (7% of starting weight, ~4.9 kg for 70 kg).
    // =========================================================================
    // updateWeight — facade UI relay. weightChangeKg itself is now derived by the
    // engine each step (engine._updateWeightChange), so this no longer computes it —
    // it only forwards the engine's value plus the game-mechanic limit to the UI.
    updateWeight() {
        const netKcal = this.totalKcalConsumed - (this.totalKcalBurnedBase + this.totalKcalBurnedMotion);

        this.engine.emitEvent('weight-status', {
            weightChangeKg: this.weightChangeKg,
            weightLimitKg: this.weightLimitKg,
            netKcal
        });
        this._flushEngineEvents();
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
    // 2. EXTREME WEIGHT CHANGE (|weightChange| > 7% of starting weight)
    //    Rapid weight gain/loss indicates severely unbalanced nutrition. The
    //    limit scales with body weight so it is fair for children and adults.
    //
    // 3. DIABETIC KETOACIDOSIS (DKA)
    //    acidosisLoad accumulates when BHB > 3.0 mmol/L + insulin deficiency (see updateAcidosisLoad).
    //    Rate = linear + quadratic with BHB excess. Game over at load ≥ 600.
    //    Recovery via exponential decay (t½=45 min) when BHB falls below threshold.
    //    Insulin does NOT clear acidosisLoad — it lowers ketones naturally.
    //
    // 4. CHRONIC COMPLICATIONS (7-day average BG > 15 mmol/L after day 7)
    //    Sustained hyperglycemia causes damage to blood vessels, nerves, kidneys.
    //    While real complications take years, this provides feedback that
    //    chronically high BG has consequences.
    // =========================================================================
    checkGameOverConditions() {
        if (this.isGameOver) return; // Don't trigger multiple game overs

        // Condition 1: Neuroglycopenia — brain energy reserves exhausted
        // Use the lowest BG during the deficit period (not current BG, which may have recovered)
        if (this.brainEnergyDeficit >= this.BRAIN_DEFICIT_THRESHOLD) {
            const hypoBG = this._lowestBGDuringDeficit < Infinity
                ? this._lowestBGDuringDeficit : this.trueBG;
            this.engine.emitEvent('game-over-condition', { type: 'hypo', bg: hypoBG });
            this._flushEngineEvents();
            return;
        }

        // Condition 2: Extreme weight change (disabled in campaign with weightTrackingEnabled: false)
        // The limit is proportional to starting weight (weightLimitKg = 7% of weight).
        if (this._campaignDisableWeight) { /* skip */ }
        else if (Math.abs(this.weightChangeKg) > this.weightLimitKg) {
            this.engine.emitEvent('game-over-condition', {
                type: 'weight',
                weightChangeKg: this.weightChangeKg,
                weightLimitKg: this.weightLimitKg
            });
            this._flushEngineEvents();
            return;
        }

        // Condition 3: DKA — metabolic acidosis from accumulated keto acids
        if (this.acidosisLoad >= this.ACIDOSIS_THRESHOLD) {
            this.engine.emitEvent('game-over-condition', {
                type: 'dka',
                ketoneLevel: this.ketoneLevel
            });
            this._flushEngineEvents();
            return;
        }

        // Condition 4: Chronic complications (after 7 days of gameplay)
        if (this.day > 7) {
            const avg7d = this.calculateAverageBGForPeriod(7 * 24 * 60, true);
            if (avg7d !== null && avg7d > 15.0) {
                this.engine.emitEvent('game-over-condition', {
                    type: 'complications',
                    avg7d
                });
                this._flushEngineEvents();
                return;
            }
        }
    }

    // =========================================================================
    // BOX CHALLENGE — Box generation, collision, and level bonus
    // =========================================================================
    //
    // Box Challenge is a game mode where red obstacle boxes are placed in the
    // graph's green zone (4-10 mmol/L). The player has 3 lives and loses one
    // on a collision (trueBG inside a box) or another game-over condition
    // (hypo, DKA, weight). At 0 lives → final game over.
    //
    // Each sim-day = a new level with progressively harder box placement:
    // more boxes, tighter gaps, closer to the hypo boundary (4.0 mmol/L).
    // =========================================================================

    /**
     * _boxPRNG — Seeded pseudo-random number generator (mulberry32).
     * Returns a number in [0, 1) based on the internal seed.
     * Used for reproducible box placement within the same game.
     */
    _boxPRNG() {
        let s = this._boxSeed;
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        this._boxSeed = s;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * startNextDay — Called from the "Next day" button in the level-complete overlay.
     * Generates new boxes for the current day. Separated from the day-rollover
     * logic in update() so the player sees a clean transition: old level gone
     * → click → new boxes fade in.
     */
    startNextDay() {
        // Boxes are generated ONLY in box challenge mode. In sandbox there are no
        // boxes — the "Next day" button simply closes the popup and lets the
        // player continue free play.
        if (this.gameMode === 'boxchallenge') {
            this.generateBoxesForDay(this.day);
        }
    }

    /**
     * generateBoxesForDay — Generate obstacle boxes for a given sim-day.
     *
     * Difficulty is primarily controlled by COVERAGE — the fraction of the day
     * (02:00-23:00) covered by boxes. Coverage rises gradually:
     *   Day 1:   10% (~2 hours)
     *   Day 5:   26% (~5.5 hours)
     *   Day 10:  46% (~9.5 hours)
     *   Day 15+: 65% (~13.5 hours)
     *
     * Boxes can be placed ANYWHERE on the graph (3.0-11.0 mmol/L), including
     * the bonus zone (5-6) and below the green zone. Theoretical max is adjusted
     * dynamically based on what is actually available.
     *
     * Box shapes vary: flat/wide, square, and tall/narrow.
     *
     * Called from startNextDay() when the player clicks "Next day" in the
     * level-complete overlay — NOT automatically on day rollover.
     *
     * @param {number} dayNumber — Sim-day (1-indexed)
     */
    generateBoxesForDay(dayNumber) {
        const d = dayNumber - 1; // 0-indexed

        // --- Coverage: fraction of the day covered by boxes ---
        // Day 1: 8% (~1.5 hours, 1 centrally placed box)
        // Rises gradually to max 65% (half speed: d * 0.02 instead of 0.04)
        const targetCoverage = Math.min(0.65, 0.08 + d * 0.02);

        // Box count: day 1 = 1, then gradual increase (half speed: d/4)
        // 1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6
        const boxCount = Math.min(6, 1 + Math.floor(d / 4));

        // Time window
        const dayStart = 120;   // 02:00
        const dayEnd   = 1380;  // 23:00
        const totalWindow = dayEnd - dayStart; // 1260 min

        // Total box time governed by coverage
        const totalBoxTime = Math.round(targetCoverage * totalWindow);

        // BG range: boxes can be placed ANYWHERE (3.0 - 11.0 mmol/L)
        const bgLow  = 3.0;
        const bgHigh = 11.0;

        // Height: varied — flat, square, AND tall/narrow boxes
        // Half speed: d * 0.1 instead of 0.2
        const minHeight = 0.8;
        const maxHeight = Math.min(4.0, 1.5 + d * 0.1);

        // Minimum time gap between boxes — 3× larger (180 base, falls slowly)
        // Half speed: d * 2.5 instead of d * 5
        const minTimeGap = Math.max(60, 180 - d * 2.5);

        // Skewed boxes (parallelograms) from day 2+ (half speed)
        const skewChance = Math.min(0.5, d * 0.04);
        const maxSkew    = Math.min(2.0, 0.5 + d * 0.1);

        // --- Distribute totalBoxTime randomly across boxes ---
        const rawW = [];
        for (let i = 0; i < boxCount; i++) rawW.push(0.5 + this._boxPRNG());
        const sumW = rawW.reduce((a, b) => a + b, 0);
        const durations = rawW.map(w => Math.max(30, Math.round((w / sumW) * totalBoxTime)));

        // --- Temporal placement with gaps ---
        // Total free time (what is not covered by boxes)
        const actualBoxTime = durations.reduce((a, b) => a + b, 0);
        const totalFreeTime = Math.max(0, totalWindow - actualBoxTime);
        const innerMinGaps = Math.max(0, boxCount - 1) * minTimeGap;
        const extraFreeTime = Math.max(0, totalFreeTime - innerMinGaps);

        // Distribute extra free time randomly as gaps (including before first and after last)
        const gapSlots = boxCount + 1;
        const gapW = [];
        for (let i = 0; i < gapSlots; i++) gapW.push(0.3 + this._boxPRNG());
        const sumGW = gapW.reduce((a, b) => a + b, 0);

        const newBoxes = [];
        let currentTime = dayStart;

        for (let i = 0; i < boxCount; i++) {
            // Gap before this box: minimum gap (except before first) + random extra
            const innerMin = (i > 0) ? minTimeGap : 0;
            const extraGap = (gapW[i] / sumGW) * extraFreeTime;
            currentTime += innerMin + extraGap;

            const startMinute = Math.round(Math.max(dayStart, currentTime));
            const endMinute = Math.min(dayEnd, Math.round(currentTime + durations[i]));
            currentTime = endMinute;

            // BG placement: random height, positioned anywhere in 3.0-11.0
            const height = minHeight + this._boxPRNG() * (maxHeight - minHeight);
            const bgMin = bgLow + this._boxPRNG() * Math.max(0, bgHigh - height - bgLow);
            const bgMax = bgMin + height;

            // Skewed box (parallelogram)
            let skewBG = 0;
            if (this._boxPRNG() < skewChance) {
                skewBG = (this._boxPRNG() * 2 - 1) * maxSkew;
                const eBgMin = bgMin + skewBG;
                const eBgMax = bgMax + skewBG;
                if (eBgMin < bgLow - 0.5 || eBgMax > bgHigh + 0.5) {
                    skewBG = -skewBG;
                    if (bgMin + skewBG < bgLow - 0.5 || bgMax + skewBG > bgHigh + 0.5) {
                        skewBG = 0;
                    }
                }
            }

            newBoxes.push({
                dayNumber, startMinute, endMinute,
                bgMin: Math.round(bgMin * 10) / 10,
                bgMax: Math.round(bgMax * 10) / 10,
                skewBG: Math.round(skewBG * 10) / 10,
                hit: false,
                fadeInStart: performance.now()
            });
        }

        this.boxes.push(...newBoxes);
        this.currentLevelDay = dayNumber;

        // Compute dynamic theoretical max for this day
        this.dayTheoreticalMax = this._computeTheoreticalMax(dayNumber);
    }

    /**
     * _computeTheoreticalMax — Compute the maximum achievable points for a day,
     * given the box placement.
     *
     * For each minute of the day, checks:
     *   1. Is the bonus zone (5.0-6.0) available? → 2.0 pts/hour
     *   2. Otherwise: is any part of the green zone (4.0-10.0) available? → 1.0 pts/hour
     *   3. Otherwise: 0 pts/hour (whole zone is blocked)
     *
     * @param {number} dayNumber — Sim-day
     * @returns {number} Theoretical max points (rounded to 1 decimal)
     */
    _computeTheoreticalMax(dayNumber) {
        const dayBoxes = this.boxes.filter(b => b.dayNumber === dayNumber);
        let totalPoints = 0;

        for (let minute = 0; minute < 1440; minute++) {
            // Collect active box BG intervals at this minute
            const activeRanges = [];
            for (const box of dayBoxes) {
                if (minute < box.startMinute || minute > box.endMinute) continue;
                const skew = box.skewBG || 0;
                const dur = box.endMinute - box.startMinute || 1;
                const frac = (minute - box.startMinute) / dur;
                const offset = skew * frac;
                activeRanges.push({
                    min: box.bgMin + offset,
                    max: box.bgMax + offset
                });
            }

            // Best possible rate: bonus zone > green zone > nothing
            if (!this._isRangeFullyCovered(5.0, 6.0, activeRanges)) {
                totalPoints += 2.0 / 60;  // Bonus zone available
            } else if (!this._isRangeFullyCovered(4.0, 10.0, activeRanges)) {
                totalPoints += 1.0 / 60;  // Green zone available (but not bonus)
            }
            // Otherwise: 0 — entire green zone is blocked
        }

        return Math.round(totalPoints * 10) / 10;
    }

    /**
     * _isRangeFullyCovered — Check whether a BG interval is completely covered
     * by boxes (union of intervals).
     *
     * Sorts intervals and scans from lo to hi. Returns true if there is no
     * gap in the coverage.
     *
     * @param {number} lo — Lower bound (mmol/L)
     * @param {number} hi — Upper bound (mmol/L)
     * @param {Array} ranges — Array of {min, max} intervals
     * @returns {boolean} True if [lo, hi] is completely covered
     */
    _isRangeFullyCovered(lo, hi, ranges) {
        if (ranges.length === 0) return false;
        const sorted = ranges.slice().sort((a, b) => a.min - b.min);
        let covered = lo;
        for (const r of sorted) {
            if (r.min > covered + 0.05) return false; // Gap found (0.05 tolerance)
            covered = Math.max(covered, r.max);
            if (covered >= hi - 0.05) return true;
        }
        return covered >= hi - 0.05;
    }

    /**
     * _findSafeRespawnBG — Find a safe BG level for respawn.
     *
     * Priority:
     *   1. Preferred BG (7.0) if clear of boxes
     *   2. Best spot in target zone (4.0-10.0) with at least 1 mmol/L clearance from boxes
     *   3. If target zone is full: best spot outside (3.0-11.0) with 1 mmol/L clearance
     *   4. Fallback: point with greatest distance from boxes (regardless of distance)
     *
     * Box immunity (30 sim-min) protects the player after respawn, so excessive
     * clearance is not needed — 1 mmol/L is enough to avoid visual overlap.
     *
     * @param {number} immunityMinutes — Immunity duration (sim-minutes)
     * @returns {number} Safe BG level in mmol/L
     */
    _findSafeRespawnBG(immunityMinutes = 30) {
        const MIN_DISTANCE = 1.0;  // Minimum clearance from box edge in mmol/L
        const TARGET_MIN = 4.0;    // Target zone lower bound
        const TARGET_MAX = 10.0;   // Target zone upper bound
        const ABSOLUTE_MIN = 3.0;  // Absolute lowest respawn BG
        const ABSOLUTE_MAX = 11.0; // Absolute highest respawn BG
        const PREFERRED_BG = 7.0;  // Preferred target

        // Collect BG intervals for all active boxes in the immunity window
        const timeNow = this.timeInMinutes;
        const timeEnd = timeNow + immunityMinutes;
        const boxIntervals = [];

        for (const box of this.boxes) {
            if (box.dayNumber !== this.day || box.hit) continue;
            // Tjek tids-overlap med immunitetsvinduet
            if (timeEnd < box.startMinute || timeNow > box.endMinute) continue;

            // Compute BG interval including skew across the full overlap period
            const skew = box.skewBG || 0;
            if (skew === 0) {
                boxIntervals.push({ min: box.bgMin, max: box.bgMax });
            } else {
                const dur = box.endMinute - box.startMinute || 1;
                const frac1 = Math.max(0, Math.min(1, (timeNow - box.startMinute) / dur));
                const frac2 = Math.max(0, Math.min(1, (timeEnd - box.startMinute) / dur));
                const off1 = skew * frac1;
                const off2 = skew * frac2;
                boxIntervals.push({
                    min: box.bgMin + Math.min(off1, off2),
                    max: box.bgMax + Math.max(off1, off2)
                });
            }
        }

        // No boxes in the window — use preferred BG
        if (boxIntervals.length === 0) return PREFERRED_BG;

        // Helper: minimum distance from a BG point to all boxes
        const minDistToBoxes = (bg) => {
            let minDist = Infinity;
            for (const interval of boxIntervals) {
                if (bg >= interval.min && bg <= interval.max) return 0;
                const dist = Math.min(
                    Math.abs(bg - interval.min),
                    Math.abs(bg - interval.max)
                );
                minDist = Math.min(minDist, dist);
            }
            return minDist;
        };

        // 1. Try preferred BG first
        if (minDistToBoxes(PREFERRED_BG) >= MIN_DISTANCE) return PREFERRED_BG;

        // 2. Scan target zone (4.0-10.0) — prefer staying within target
        let bestTargetBG = null;
        let bestTargetDist = 0;
        for (let bg = TARGET_MIN; bg <= TARGET_MAX; bg += 0.5) {
            const dist = minDistToBoxes(bg);
            if (dist >= MIN_DISTANCE && dist > bestTargetDist) {
                bestTargetDist = dist;
                bestTargetBG = bg;
            }
        }
        // Among all with sufficient clearance, pick the one closest to 7.0
        if (bestTargetBG !== null) {
            const goodInTarget = [];
            for (let bg = TARGET_MIN; bg <= TARGET_MAX; bg += 0.5) {
                if (minDistToBoxes(bg) >= MIN_DISTANCE) goodInTarget.push(bg);
            }
            goodInTarget.sort((a, b) => Math.abs(a - PREFERRED_BG) - Math.abs(b - PREFERRED_BG));
            return goodInTarget[0];
        }

        // 3. Target zone is full — scan extended range (3.0-11.0)
        const goodOutside = [];
        for (let bg = ABSOLUTE_MIN; bg <= ABSOLUTE_MAX; bg += 0.5) {
            if (minDistToBoxes(bg) >= MIN_DISTANCE) goodOutside.push(bg);
        }
        if (goodOutside.length > 0) {
            goodOutside.sort((a, b) => Math.abs(a - PREFERRED_BG) - Math.abs(b - PREFERRED_BG));
            return goodOutside[0];
        }

        // 4. Fallback: everything is covered by boxes — find the point with greatest clearance
        let bestBG = PREFERRED_BG;
        let bestDist = minDistToBoxes(PREFERRED_BG);
        for (let bg = ABSOLUTE_MIN; bg <= ABSOLUTE_MAX; bg += 0.5) {
            const dist = minDistToBoxes(bg);
            if (dist > bestDist) {
                bestDist = dist;
                bestBG = bg;
            }
        }
        return bestBG;
    }

    /**
     * _resetToStableBG — Complete physiological reset: BG to target and the whole
     * body to basal steady-state ("fresh start" after a life is lost).
     *
     * Used for box challenge respawn (hypo/dka). The function clears ALL active
     * physiological state so the player gets a clean starting position without
     * hidden carry-over effects from the previous life:
     *
     *   - Plasma glucose (Q1) → target. Peripheral glucose (Q2) → equilibrium.
     *   - Bolus insulin → 0. Basal shadow cascade → analytical steady-state
     *     for the calibrated basal rate (no ramp-up delay).
     *   - Stomach/gut/diet pipeline (carbs, fat, protein, FFA, amino acids) → 0
     *   - Exercise (E1, E2, heart rate, active activity, post-exercise effects, cooldown) → reset
     *   - Stress (acute, chronic, counter-regulation, hypoArea) → 0 / baseline
     *   - Insulin resistance factors (FFA, glucotox, chronic stress IR) → 1.0
     *   - Glycogen reserves (liver + muscle) → fully replenished
     *   - Brain energy deficit + acidosis load → 0
     *   - Ketones → baseline (0.1 mmol/L)
     *   - CGM compartment → matches new trueBG (no interstitial delay)
     *
     * Rationale: if only insulin is cleared (as before) but the food pipeline
     * persists, unabsorbed carbs will continue flowing in without matching insulin
     * → a "free" hyperglycaemia spike after respawn. Similarly, a post-DKA respawn
     * with high ffaResistance would make the player's subsequent insulin weaker than
     * nominal with nothing in the UI explaining why.
     * (W6, claude review 2026-04-18 v2)
     *
     * BASAL/RAPID SEPARATION (codex review 2026-04-07 followup, issue 1):
     * Basal lives in the shadow cascade S1b/S2b/Ib (state[13..15]), while S1/S2
     * (state[2..3]) are exclusively the bolus depot. The basal shadow cascade is
     * filled to steady state while the rapid depot is kept empty.
     *
     * PRESERVED (not cleared):
     *   - lostSleepHoursTonight + sleepDebtAppliedForDay (sleep debt is separate)
     *   - Profile data (ICR, ISF, weight), points, day, campaign state
     *
     * NOTE: activeLongInsulin is cleared and replaced with one recommended basal dose
     * "injected 12 h ago" (see section 8 below). weightChangeKg + kcal accumulators
     * are zeroed (see section 9) to give a genuine "fresh start" weight display.
     *
     * @param {number} targetBG — Desired BG in mmol/L (typically 7.0)
     */
    _resetToStableBG(targetBG) {
        // Ryd alle skjulte drivere FØR insulinvirkning og Q2 beregnes.
        // Ellers kan steadyStateActions() bruge PEIS, stress- eller
        // resistensmodifikatorer fra det tabte liv og dermed gøre respawnens
        // efterfølgende BG-forløb afhængigt af den gamle fysiologi.
        this.activeAktivitet = null;
        this.activeMotion = [];
        this.exerciseCooldownUntil = 0;
        this.exerciseHepaticDrive = 0;
        this.acuteStressLevel = 0;
        this.chronicStressLevel = 0;
        this._pendingChronicStress = 0;
        this.insulinResistanceFactor = 1.0;
        this.ffaResistanceFactor = 1.0;
        this.glucotoxicLoad = 0;
        this.glucotoxicResistanceFactor = 1.0;

        // Bevar den aktuelle døgnvariation, fordi tiden ikke nulstilles ved
        // respawn. Alle øvrige faktorer er nu baseline, og PEIS er 1 efter at
        // activeMotion er ryddet. Modifikatorerne sættes eksplicit før
        // steadyStateActions(), så gamle Hovorka-felter ikke kan sive igennem.
        const respawnFullModifier = this.currentISF / this.ISF;
        const respawnPeisFactor = this._lastPeisFactor || 1.0;
        this.hovorka.setInsulinModifiers(
            respawnFullModifier / respawnPeisFactor,
            respawnPeisFactor
        );

        // -------------------------------------------------------------------
        // 1) Hovorka ODE-state — glukose, insulin, motion, CGM
        // -------------------------------------------------------------------

        // Set plasma glucose (Q1) directly. Q2 is set below — first the
        // insulin action variables x1/x2 must be computed so Q2 can be derived
        // from the actual steady-state relation in the Q2 equation.
        const targetQ1 = targetBG * this.hovorka.V_G;
        this.hovorka.state[HOVORKA_STATE_IDX.Q1] = targetQ1;

        // Carb gut compartments (D1/D2) — unabsorbed carbs from the previous
        // meal. Must be cleared to avoid a "free" BG rise after respawn.
        this.hovorka.state[HOVORKA_STATE_IDX.D1] = 0;  // D1 — carb depot 1
        this.hovorka.state[HOVORKA_STATE_IDX.D2] = 0;  // D2 — carb depot 2

        // --- Set insulin to basal steady-state ---
        // Use the calibrated steady-state rate from Hovorka initialisation.
        // Steady-state equations (at rest, pulsFaktor = 1):
        //   S1b_ss = S2b_ss = rate × baseTauI   (basal shadow depot, fixed 55 min)
        //   Ib_ss  = rate / (V_I × k_e)          (basal plasma shadow)
        //   I_ss   = Ib_ss                        (total plasma = basal, rapid = 0)
        //   x_ss   = k_b × I_ss / k_a             (insulin action)
        const ssRate = this.hovorka.steadyStateBasalRate || 0;
        const baseTauI = this.hovorka.baseTauI;   // 55 min, konstant
        const V_I = this.hovorka.V_I;
        const k_e = this.hovorka.k_e;
        const I_ss = ssRate / (V_I * k_e);

        // Basal shadow cascade — filled to steady state
        this.hovorka.state[HOVORKA_STATE_IDX.S1b] = ssRate * baseTauI;  // S1b — basal depot 1
        this.hovorka.state[HOVORKA_STATE_IDX.S2b] = ssRate * baseTauI;  // S2b — basal depot 2
        this.hovorka.state[HOVORKA_STATE_IDX.Ib] = I_ss;               // Ib  — basal plasma shadow

        // Rapid bolus depot kept EMPTY — no hidden bolus after respawn
        this.hovorka.state[HOVORKA_STATE_IDX.S1] = 0;  // S1 — rapid depot 1
        this.hovorka.state[HOVORKA_STATE_IDX.S2] = 0;  // S2 — rapid depot 2

        // Total plasma insulin = basal only (rapid = 0)
        this.hovorka.state[HOVORKA_STATE_IDX.I] = I_ss;  // I — total plasma insulin [mU/L]

        // Insulin action variables: Hill steady-state at I_ss med den rene
        // post-respawn-modifikation, som blev sat ovenfor.
        const ssAct = this.hovorka.steadyStateActions(I_ss);
        this.hovorka.state[HOVORKA_STATE_IDX.x1] = ssAct.x1;  // x1 — transport
        this.hovorka.state[HOVORKA_STATE_IDX.x2] = ssAct.x2;  // x2 — disposal
        this.hovorka.state[HOVORKA_STATE_IDX.x3] = ssAct.x3;  // x3 — EGP suppression

        // Exercise effects — clear contraction state, telemetry and delayed
        // sensitivity sessions so respawn restarts from physiological rest.
        this.hovorka.state[HOVORKA_STATE_IDX.E1] = 0;  // E1 — contraction response
        this.hovorka.state[HOVORKA_STATE_IDX.E2] = 0;  // E2 — filtered telemetry only
        this.hovorka.heartRate = this.hovorka.HR_base;
        this.hovorka.exerciseInput = 0;

        // Peripheral glucose (Q2) at Hovorka steady state:
        //   dQ2/dt = x1 * Q1 - k_12 * Q2 - x2 * Q2 - beta * E1
        // At rest (E1=0), dQ2/dt = 0 gives:
        //   x1*Q1 = (k_12 + x2)*Q2   =>   Q2 = x1*Q1 / (k_12 + x2)
        // This honours the just-set insulin action variables from I_ss.
        const x1_ss = this.hovorka.state[HOVORKA_STATE_IDX.x1];
        const x2_ss = this.hovorka.state[HOVORKA_STATE_IDX.x2];
        this.hovorka.state[HOVORKA_STATE_IDX.Q2] = x1_ss * targetQ1 / (this.hovorka.k_12 + x2_ss);

        // Update trueBG immediately
        this.trueBG = this.hovorka.glucoseConcentration;

        // CGM compartment (C, state[10]) set to new trueBG → no
        // interstitial delay after respawn.
        this.hovorka.state[HOVORKA_STATE_IDX.C] = this.trueBG;
        this.cgmBG = this.trueBG;
        this.cgmCompressionUntil = -Infinity;
        this.cgmCompressionStart = -Infinity;
        this.cgmCompressionDrop = 0;
        this.cgmSensorOfflineUntil = -Infinity;
        this.cgmSensorOfflineStart = -Infinity;
        this.cgmSensorWarmupUntil = -Infinity;
        this.cgmSensorWarmupStart = -Infinity;
        this.cgmSelfTestUntil = -Infinity;
        this.cgmSelfTestStart = -Infinity;
        this.cgmAutoSelfTestCooldownUntil = -Infinity;
        this.cgmSensorStatus = 'active';
        this.illnessSymptomsUntil = -Infinity;
        this.illnessSymptomsStart = -Infinity;

        // -------------------------------------------------------------------
        // 2) Insulin injections (rapid) + IOB
        // -------------------------------------------------------------------
        this.activeFastInsulin = [];
        this.iob = 0;
        this.displayIOB = 0;
        // activeLongInsulin is PRESERVED — basal is the player's choice and continues delivering.

        // -------------------------------------------------------------------
        // 3) Stomach/gut/diet pipeline — carbs, fat, protein, FFA
        // -------------------------------------------------------------------
        this.activeFood = [];
        this.activeIntake = [];
        this.cob = 0;

        this.stomachContentGrams = 0;
        this.stomachFull = false;
        this.stomachCarbsTotal = 0;
        this.stomachCarbsSimple = 0;
        this.stomachFiber = 0;
        this.stomachRetentionWeight = 0;

        this.fatStomach = 0;
        this.fatIntestine = 0;
        this.ffaBlood = 0;
        this.ffaResistanceFactor = 1.0;

        this.proteinStomach = 0;
        this.proteinGut = 0;
        this.aminoAcidsBlood = 0;
        this.proteinGlucagonLevel = 0;

        // -------------------------------------------------------------------
        // 4) Exercise — active activity, post-exercise effects, cooldown, heart rate
        // -------------------------------------------------------------------
        this.smoothHeartRate = this.hovorka.HR_base;

        // -------------------------------------------------------------------
        // 5) Stress + counter-regulation + insulin resistance
        // -------------------------------------------------------------------
        this.hypoArea = 0;
        this.counterRegFactor = 1.0;

        // -------------------------------------------------------------------
        // 6) Liver + muscle glycogen (fully replenished)
        // -------------------------------------------------------------------
        this.liverGlycogenGrams = this.LIVER_GLYCOGEN_MAX;  // typically 120 g
        this.glycogenReserve = 1.0;
        this.muscleGlycogenGrams = this.muscleGlycogenCapacity;
        this.muscleGlycogenReserve = 1.0;

        // -------------------------------------------------------------------
        // 7) Brain deficit + acidosis + ketones + lipolysis
        // -------------------------------------------------------------------
        this.brainEnergyDeficit = 0;
        this.brainDeficitWarningGiven = false;
        this._lowestBGDuringDeficit = Infinity;
        this.acidosisLoad = 0;
        this.acidosisWarningGiven = false;
        this.ketoneLevel = 0.1;
        this.ffaLipolysis = 0;

        // -------------------------------------------------------------------
        // 8) Basal injection history (activeLongInsulin) — fresh start
        //
        // Design choice: the player respawns as if they had taken their FULL
        // recommended basal dose 12 hours before the respawn time. This means:
        //   - Plateau rate matches the steady state we just set in the cascade
        //   - ~10-16 h of active basal remain before the dose tails off (at 28 h duration)
        //   - En senere observation udløses først, når den faktiske basalrate er
        //     lav og CGM-kurven samtidig stiger synligt.
        //
        // Dose is back-computed from the plateau rate (same trick as the constructor)
        // so the actual insulin delivery matches the calibrated steady-state at the
        // CURRENT circadianISF (not necessarily midnight).
        // -------------------------------------------------------------------
        this.activeLongInsulin = [];
        this.addLongInsulin(this.basalDose, this.totalSimMinutes - 12 * 60, true);
        const respawnBasal = this.activeLongInsulin[0];
        const ba = respawnBasal.bioavailability || 1.0;
        const rampUp = 2 * 60, tailOff = 6 * 60;
        const effectiveArea = respawnBasal.totalDuration - rampUp / 2 - tailOff / 2;
        const currentISF = this.circadianISF || 1.0;
        respawnBasal.dose = this.hovorkaSteadyStateBasalRate * effectiveArea
                          / (1000 * ba * currentISF);
        this.lastInsulinTime = this.totalSimMinutes - 12 * 60;

        // -------------------------------------------------------------------
        // 9) Weight accumulators — reset to 0 for a genuine "fresh start" display
        //
        // weightChangeKg is derived by the engine each step (engine._updateWeightChange):
        //   netKcal = totalKcalConsumed - totalKcalBurnedBase - totalKcalBurnedMotion
        //   weightChangeKg = netKcal / 7700
        // Only setting weightChangeKg = 0 would be overwritten on the next tick —
        // so the three underlying kcal accumulators are cleared instead.
        // -------------------------------------------------------------------
        this.totalKcalConsumed = 0;
        this.totalKcalBurnedBase = 0;
        this.totalKcalBurnedMotion = 0;
        this.totalExerciseMinutes = 0;
        this.weightChangeKg = 0;
    }

    /**
     * _checkBoxRespawnBasalReminder — vis først basalobservationen, når spilleren
     * kan se problemet på CGM-kurven.
     *
     * Respawn-depotet starter med en alder på 12 timer. Vi venter mindst til
     * dosisalderen er 20 timer, kræver at den aktuelle basalrate er under 70 %
     * af steady-state-behovet og bruger samme synlige 30-minutters stigegrænse
     * som kampagnens basalLow-tip. Dermed kommer teksten ikke umiddelbart efter
     * respawn og afslører heller ikke en skjult fysiologisk tilstand.
     *
     * @returns {boolean} true når påmindelsen blev vist i dette kald.
     */
    _checkBoxRespawnBasalReminder() {
        if (this.gameMode !== 'boxchallenge' || this.isGameOver ||
            !this._boxRespawnBasalReminderPending) return false;

        const basalDoses = this.activeLongInsulin || [];
        const latestInjection = basalDoses.reduce((latest, dose) =>
            Number.isFinite(dose.injectionTime) ? Math.max(latest, dose.injectionTime) : latest,
        -Infinity);
        const doseAgeMinutes = Number.isFinite(latestInjection)
            ? this.totalSimMinutes - latestInjection
            : Infinity;
        if (doseAgeMinutes < 20 * 60) return false;

        const required = this.hovorkaSteadyStateBasalRate || 0;
        const actual = this.basalInsulinRate || 0;
        if (required <= 0 || actual >= 0.7 * required) return false;

        const history = this.bgHistoryForStats || [];
        const currentTime = this.totalSimMinutes || 0;
        const currentBG = Number.isFinite(this.cgmBG) ? this.cgmBG : this.trueBG;
        let earlierPoint = null;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].time <= currentTime - 30) {
                earlierPoint = history[i];
                break;
            }
        }
        const earlierBG = earlierPoint && Number.isFinite(earlierPoint.cgmBG)
            ? earlierPoint.cgmBG
            : earlierPoint && earlierPoint.trueBG;
        const elapsed = earlierPoint ? currentTime - earlierPoint.time : 0;
        const riseRate = elapsed > 0 && Number.isFinite(currentBG) && Number.isFinite(earlierBG)
            ? (currentBG - earlierBG) / elapsed
            : 0;
        if (riseRate <= 0.02) return false;

        const hoursSinceBasal = Number.isFinite(doseAgeMinutes)
            ? Math.max(0, Math.round(doseAgeMinutes / 60))
            : '?';
        logEvent(t('campaign.tip.basalLow', { hoursSinceBasal }), 'info');
        this._boxRespawnBasalReminderPending = false;
        return true;
    }

    /**
     * loseLife — Lose one life (Box Challenge mode).
     *
     * Handles respawn based on reason:
     *   'hypo': BG → safe level, insulin → basal steady-state, clear brainEnergyDeficit
     *   'dka':  BG → safe level, insulin → basal steady-state, clear acidosisLoad
     *   'weight': clear weightChangeKg
     *   'complications': reset check (grant new chance)
     *   'box': no respawn (BG is fine, just a penalty)
     *
     * At 0 lives → final game over.
     *
     * @param {string} reason — Reason for the life loss
     */
    loseLife(reason) {
        this.lives--;

        // Save snapshot of physiological values BEFORE respawn clears them.
        // Otherwise the details panel would show respawn values (BG=7) instead of the actual problem.
        const preRespawnLowestBG = this._lowestBGDuringDeficit;
        const preRespawnBG = this.trueBG;
        const preRespawnKetones = this.ketoneLevel;
        const preRespawnWeight = this.weightChangeKg;

        // Gem det præcise livstab før fysiologien eventuelt nulstilles. Ved hypo
        // bruges det laveste registrerede BG, fordi det er det relevante punkt
        // på referencekurven; ved alle andre årsager bruges det aktuelle true BG.
        const incidentBG = reason === 'hypo' && preRespawnLowestBG < Infinity
            ? preRespawnLowestBG
            : preRespawnBG;
        this.boxChallengeIncidents.push({
            t: this.totalSimMinutes,
            cause: reason || 'box',
            bg: incidentBG
        });

        if (this.lives <= 0) {
            // Final game over — all lives used.
            const reasonLabels = {
                box: t('boxchallenge.respawn.box'),
                hypo: t('boxchallenge.respawn.hypo'),
                dka: t('boxchallenge.respawn.dka'),
                weight: t('boxchallenge.respawn.weight'),
                complications: t('boxchallenge.respawn.complications')
            };
            const lastReason = reasonLabels[reason] || t('boxchallenge.gameOver');
            const hypoBG = preRespawnLowestBG < Infinity ? preRespawnLowestBG : preRespawnBG;

            this.gameOver(lastReason, {
                type: reason || 'box',
                cause: lastReason,
                explanation: reason === 'box'
                    ? t('boxchallenge.lifeUsed')
                    : reason === 'hypo' ? t('game.over.hypo.cause', {bg: displayBG(hypoBG), unit: bgUnitLabel()})
                    : reason === 'dka' ? t('game.over.dka.cause', {ketones: preRespawnKetones.toFixed(1)})
                    : reason === 'weight' ? t('game.over.weight.cause', {weight: preRespawnWeight.toFixed(1)})
                    : t('boxchallenge.gameOver'),
                tips: []
            });
            return;
        }

        // --- Respawn: restart with stable physiological values ---
        // After hypo/dka the player made a mistake — they deserve a fair chance
        // with the new life. _resetToStableBG performs a COMPLETE physiological reset
        // (BG, insulin, stomach/gut, exercise, stress, glycogen, brain/acidosis,
        // ketones, basal history). Short immunity against box collisions is granted.
        switch (reason) {
            case 'hypo':
            case 'dka':
                // Find safe BG level at least 2 mmol/L from all active boxes
                const safeBG = this._findSafeRespawnBG(30);
                this._resetToStableBG(safeBG);
                // Box immunity: 30 sim-min after respawn (avoid hitting a box immediately)
                this.respawnImmunityUntil = this.totalSimMinutes + 30;
                logEvent(t('boxchallenge.lifeUsed'), 'warning');
                // Basalobservationen udskydes til depotets virkning er lav, dosis
                // er mindst 20 timer gammel og CGM-kurven faktisk stiger.
                this._boxRespawnBasalReminderPending = true;
                break;

            case 'weight':
                // Clear kcal accumulators — weightChangeKg is derived from them
                // and would otherwise be recomputed to the same value on the next tick.
                this.totalKcalConsumed = 0;
                this.totalKcalBurnedBase = 0;
                this.totalKcalBurnedMotion = 0;
                this.totalExerciseMinutes = 0;
                this.weightChangeKg = 0;
                break;

            case 'complications':
                // Reset check — grant a new chance today
                break;

            case 'box':
                // No respawn needed — BG is fine, just a penalty
                // Short immunity so the player does not immediately hit the next box
                this.respawnImmunityUntil = this.totalSimMinutes + 15;
                logEvent(t('boxchallenge.lifeUsed'), 'warning');
                break;
        }

        // Build details object with reason, explanation, and tips (same info as sandbox game over).
        // Uses the pre-respawn snapshot (saved at the top of loseLife) — NOT current values,
        // since respawn has already cleared BG/ketones/etc.
        let lifeDetails = { name: '', cause: '', explanation: '', tips: [] };
        switch (reason) {
            case 'hypo': {
                const hypoBG = preRespawnLowestBG < Infinity
                    ? preRespawnLowestBG : preRespawnBG;
                lifeDetails = {
                    name: t('game.over.hypo.name'),
                    cause: t('game.over.hypo.cause', {bg: displayBG(hypoBG), unit: bgUnitLabel()}),
                    explanation: t('game.over.hypo.explanation', bgVars()),
                    tips: [t('game.over.hypo.tip1'), t('game.over.hypo.tip2', bgVars()), t('game.over.hypo.tip3'), t('game.over.hypo.tip4')]
                };
                break;
            }
            case 'dka':
                lifeDetails = {
                    name: t('game.over.dka.name'),
                    cause: t('game.over.dka.cause', {ketones: preRespawnKetones.toFixed(1)}),
                    explanation: t('game.over.dka.explanation'),
                    tips: [t('game.over.dka.tip1'), t('game.over.dka.tip2'), t('game.over.dka.tip3'), t('game.over.dka.tip4')]
                };
                break;
            case 'weight':
                lifeDetails = {
                    name: t('game.over.weight.name'),
                    cause: t('game.over.weight.cause', {weight: preRespawnWeight.toFixed(1)}),
                    explanation: t('game.over.weight.explanation'),
                    tips: [t('game.over.weight.tip1'), t('game.over.weight.tip2'), t('game.over.weight.tip3')]
                };
                break;
            case 'complications': {
                const avg = this.calculateAverageBGForPeriod(7 * 24 * 60, true);
                lifeDetails = {
                    name: t('game.over.complications.name'),
                    cause: t('game.over.complications.cause', {avg: avg ? displayBG(avg) : '?', unit: bgUnitLabel()}),
                    explanation: t('game.over.complications.explanation'),
                    tips: [t('game.over.complications.tip1', bgVars()), t('game.over.complications.tip2'), t('game.over.complications.tip3'), t('game.over.complications.tip4')]
                };
                break;
            }
            case 'box':
                lifeDetails = {
                    name: t('boxchallenge.respawn.box'),
                    cause: '',
                    explanation: '',
                    tips: []
                };
                break;
        }

        // Pause the game, play sound, and show popup with hearts, reason, and OK button.
        // The player must press OK to continue.
        if (typeof isPaused !== 'undefined' && !isPaused) togglePause();
        playSound('gameOver');
        if (typeof showLifeLostAnimation === 'function') {
            showLifeLostAnimation(this.lives, reason, lifeDetails);
        }
    }

    /**
     * awardLevelBonus — Award bonus points for a completed day (Box Challenge).
     *
     * Calculates the player's daily points as a percentage of the theoretical
     * maximum (24.0) and awards bonus points at high percentages:
     *   ≥85% → +5.0p (perfect control)
     *   ≥75% → +3.0p (well done)
     *   ≥50% → +1.0p (passing)
     *   <50% → no bonus
     *
     * Triggers a celebration animation with bling effects.
     *
     * @param {number} completedDay — Sim-day that just completed
     */
    awardLevelBonus(completedDay) {
        // TIR-based star system — harmonised with campaign (70/85/95).
        // Uses TIR (Time In Range, 4-10 mmol/L) over the just-completed day
        // instead of "% of day's points max" as before. This matches
        // campaign's calculateStars() and the clinical 70% TIR target for T1D.
        const dayStartTime = (completedDay - 1) * 1440;
        const dayEndTime = completedDay * 1440;
        const dayData = (this.bgHistoryForStats || []).filter(
            p => p.time >= dayStartTime && p.time < dayEndTime
        );
        let tir = 0;
        if (dayData.length >= 10) {
            const inRange = dayData.filter(p => p.trueBG >= 4 && p.trueBG <= 10).length;
            tir = (inRange / dayData.length) * 100;
        }

        let bonus = 0;
        let stars = 0;
        // Same thresholds as campaign: 70/85/95% TIR
        // Bonus points: 5/10/15 (unchanged scheme, just new star boundaries)
        if (tir >= 95) { stars = 3; bonus = 15.0; }
        else if (tir >= 85) { stars = 2; bonus = 10.0; }
        else if (tir >= 70) { stars = 1; bonus = 5.0; }

        // Today's points WITHOUT bonus = earned through TIR time during the day.
        // Used in the popup's breakdown ("Today: X.X" + "⭐×N: +bonus" = Total).
        const dayPoints = this.normoPoints - this.dayStartPoints;

        if (bonus > 0) {
            this.normoPoints += bonus;
            logEvent(t('boxchallenge.bonus', {bonus: bonus.toFixed(1)}), 'bonus');
        }

        this.levelBonusAwarded = true;

        // Trigger celebration animation in the UI — shows TIR% below the title
        if (typeof showLevelCompleteAnimation === 'function') {
            showLevelCompleteAnimation(completedDay, stars, bonus, tir, dayPoints, this.normoPoints);
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
    // Updates the statistics panel with model summaries related to published glucose metrics:
    //
    // TIR (Time In Range): % of time BG was between 4.0-10.0 mmol/L
    //   Game colour threshold: 70%, based on the published TIR reference target
    //
    // SD BG (Standard Deviation of true BG): measure of glucose variability
    //   Lower values indicate a more stable simulated BG curve.
    //
    // Average CGM: mean CGM glucose over the period
    //   Used to estimate HbA1c (GMI = 3.31 + 0.02392 * mean_glucose_mg/dL)
    //
    // Also tracks 24-hour insulin usage and calorie intake.
    // =========================================================================
    updateStats() {
        // =====================================================================
        // Compute 24 h statistics for the stats fragment in the capsule bar,
        // and 7-day eHbA1c for the debug panel.
        // (The old stats side-drawer has been removed — all display happens here now.)
        // =====================================================================
        const periods = [
            { key: '24h', minutes: 24 * 60 },
            { key: '7d',  minutes: 7 * 24 * 60 }
        ];

        periods.forEach(p => {
            const dataPoints = this.bgHistoryForStats.filter(
                point => point.time >= (this.totalSimMinutes - p.minutes)
            );
            // Require at least 1 hour of data for 24h, and at least 1 day of data for 7d
            const minRequired = p.key === '7d' ? 288 : 20;
            if (dataPoints.length <= minRequired) return;

            let inRangeCount = 0, sumCgm = 0;
            dataPoints.forEach(pt => {
                sumCgm += pt.cgmBG;
                if (pt.trueBG >= 4 && pt.trueBG <= 10) inRangeCount++;
            });
            const tirPct = (inRangeCount / dataPoints.length) * 100;
            const avgCgm = sumCgm / dataPoints.length;

            // Game colours based on the fixed thresholds documented above
            const tirColor = tirPct >= 70 ? '#38a169' : tirPct >= 50 ? '#d69e2e' : '#b91c1c';
            const avgColor = (avgCgm >= 5 && avgCgm <= 8) ? '#38a169' : (avgCgm >= 4 && avgCgm <= 10) ? '#d69e2e' : '#b91c1c';

            if (p.key === '24h') {
                this.engine.emitEvent('stats-status', {
                    period: '24h',
                    tirPct,
                    tirColor,
                    avgCgm,
                    avgColor
                });
                this._flushEngineEvents();
            }

            // eHbA1c (GMI): estimated HbA1c from mean CGM — only for the weekly period
            // Formula: GMI = 3.31 + 0.02392 × mean glucose in mg/dL
            // Shown only in the debug panel (not meaningful for short play sessions)
            if (p.key === '7d') {
                const avgCgmMgDl = avgCgm * 18.0182;
                const gmi = 3.31 + 0.02392 * avgCgmMgDl;
                this.engine.emitEvent('stats-status', {
                    period: '7d',
                    gmi,
                    gmiColor: gmi < 7.0 ? '#38a169' : gmi <= 8.0 ? '#d69e2e' : '#b91c1c'
                });
                this._flushEngineEvents();
            }
        });
    }

    /**
     * gameOver — End the simulation with a game over screen.
     *
     * Sets isGameOver, pauses the game, plays sound, and shows a popup with
     * structured content: reason → points → explanation → tips.
     *
     * @param {string} cause     - Short reason description (e.g. "Severe Hypoglycemia")
     * @param {object} details   - { cause, explanation, tips[] }
     */
    gameOver(cause, details) {
        this.isGameOver = true; isPaused = true;
        playSound('gameOver');

        // Campaign mode: show encouraging popup via CampaignEngine instead of standard game over
        if (this.gameMode === 'campaign' && typeof campaignEngine !== 'undefined' && campaignEngine) {
            campaignEngine.handleCampaignGameOver(cause, details);
            return;
        }

        showGameOverPopup(cause, details, this.normoPoints);
    }

    // =========================================================================
    // PHYSIOLOGY SNAPSHOT — Aggregated view of all physiological variables
    // =========================================================================
    //
    // Used by:
    //   1. The effects panel (in-game arrow overview)
    //   2. The physiology dashboard (separate browser window with multi-graph)
    //
    // Returns a read-only snapshot — does NOT affect anything in the simulation.
    // Called every tick by updateUI() (effects panel) and by the dashboard window
    // via window.opener.game.getPhysiologySnapshot().
    // =========================================================================

    /**
     * getPhysiologySnapshot — Returns an aggregated object with all physiological
     * variables grouped by category.
     *
     * @returns {object} Snapshot with insulin, food, stress, liver, ketones,
     *                    exercise, brain, sensitivity, BG and time.
     */
    // getPhysiologySnapshot — facade wrapper (S8-B1). Snapshot + _computeBGForces
    // now live in the engine (pure derivation of engine state + hovorka). Tests and
    // the dashboard call game.getPhysiologySnapshot() / game._computeBGForces() → delegation.
    getPhysiologySnapshot() {
        return this.engine.getPhysiologySnapshot();
    }

    // _computeBGForces — facade wrapper (S8-B1). Delegates to engine.
    _computeBGForces() {
        return this.engine._computeBGForces();
    }
}


// =============================================================================
// Simulator -> PhysiologyEngine state delegation (generated)
// =============================================================================
// The facade mirrors engine-owned state via prototype accessors that forward to
// this.engine. These replace ~150 hand-written get/set passthrough pairs: now a
// new engine field is exposed on the facade by adding its name to one of the two
// lists below (read-only for immutable constants, read/write for mutable state).
// Non-trivial / individually-documented accessors stay explicit on the class.
// Immutable physiology constants (engine-owned, set only in the engine ctor).
const SIMULATOR_ENGINE_READONLY = [
    'ACIDOSIS_THRESHOLD', 'ACIDOSIS_BHB_THRESHOLD', 'ACIDOSIS_RECOVERY_HALF', 'ACIDOSIS_BASE_RATE', 'ACIDOSIS_ACCEL_RATE', 'LIPOLYSIS_MAX',
    'LIPOLYSIS_EC50', 'LIPOLYSIS_HILL_N', 'CPT1_EC50', 'CPT1_HILL_N', 'CPT1_MAX_SUPP', 'FFA_LIPO_CLEAR_HALF',
    'BHB_PROD_RATE', 'BHB_DIET_FAT_FRAC', 'BHB_VMAX', 'BHB_KM', 'BHB_RENAL_THR', 'BHB_RENAL_VMAX',
    'BHB_RENAL_KM', 'STOMACH_CAPACITY_PER_KG', 'STOMACH_HYSTERESIS', 'TAU_FAT_ABS', 'FFA_CLEARANCE_HALF', 'FFA_RESIST_MAX',
    'FFA_EC50', 'FFA_HILL_N', 'TAU_PROT_ABS', 'AA_DECAY_RATE', 'AA_EC50', 'AA_HILL_N',
    'PROTEIN_GLUCAGON_MAX', 'BRAIN_DEFICIT_THRESHOLD', 'BRAIN_CRISIS_BG', 'BRAIN_RECOVERY_HALF', 'GLUCOTOX_BG_THRESHOLD', 'GLUCOTOX_RATE',
    'GLUCOTOX_RECOVERY_HALF', 'GLUCOTOX_MAX_RESIST', 'GLUCOTOX_EC50', 'GLUCOTOX_HILL_N', 'HAAF_DAMAGE_SCALE', 'HAAF_RECOVERY_HALFLIFE',
    'LIVER_GLYCOGEN_MAX', 'GLYCOGEN_STRESS_THRESHOLD',
];

// Mutable engine state: clock, patient params, BG/CGM, insulin, ketones,
// nutrition, exercise/glycogen, stress/sleep, Hovorka model + debug fields.
const SIMULATOR_ENGINE_READWRITE = [
    'totalSimMinutes', 'timeInMinutes', 'day', 'weight', 'ISF', 'ICR',
    'gramsPerMmolRise', 'restingKcalPerDay', 'restingKcalPerMinute', 'estimatedTDD',
    'effectiveBasalRequirement', 'basalInjectionRequirement', 'basalDose', 'trueBG',
    'cgmBG', 'lastCgmCalculationTime', 'cgmSystemicPeriod', 'cgmSystemicAmplitude', 'cgmNoiseScale', 'cgmDiscontinuityChance',
    'cgmCompressionUntil', 'cgmCompressionStart', 'cgmCompressionDrop', 'cgmSensorOfflineUntil', 'cgmSensorOfflineStart', 'cgmSensorWarmupUntil',
    'cgmSensorWarmupStart', 'cgmSelfTestUntil', 'cgmSelfTestStart', 'cgmAutoSelfTestCooldownUntil', 'cgmSensorStatus', 'activeFastInsulin',
    'activeLongInsulin', 'iob', 'displayIOB', 'lastInsulinTime', 'basalIOBbaseline', 'basalInsulinRate',
    'bioavScale', 'sessionBioavFast', 'sessionBioavBasal', 'acidosisLoad', 'ketoneLevel', 'ffaLipolysis',
    'totalKcalConsumed', 'totalKcalBurnedBase', 'totalKcalBurnedMotion', 'weightChangeKg', 'activeFood', 'activeIntake',
    'stomachContentGrams', 'stomachFull', 'stomachCarbsTotal', 'stomachCarbsSimple', 'stomachFiber', 'stomachRetentionWeight',
    'cob', 'fatStomach', 'fatIntestine', 'ffaBlood', 'ffaResistanceFactor', 'proteinStomach',
    'proteinGut', 'aminoAcidsBlood', 'proteinGlucagonLevel', 'activeMotion', 'activeAktivitet', 'exerciseCooldownUntil',
    'smoothHeartRate', 'totalExerciseMinutes', 'muscleGlycogenCapacity', 'muscleGlycogenGrams', 'muscleGlycogenReserve', 'lastMuscleContractionEndTime',
    '_muscleGlycogenResynthRate', '_muscleGlycogenConsumptionRate', 'liverGlycogenGrams', 'glycogenReserve', 'glucotoxicLoad', 'glucotoxicResistanceFactor',
    'insulinResistanceFactor', 'acuteStressLevel', 'exerciseHepaticDrive', 'chronicStressLevel',
    '_pendingChronicStress', 'hypoArea', 'counterRegFactor',
    'lostSleepHoursTonight', 'lastNightAwakeningTime', 'nightAwakeUntil', 'sleepAwakeOpen', 'sleepAwakeIntervals',
    'sleepDebtAppliedForDay', '_dawnAmplitude', '_dawnPeakMinutes', '_dawnDay',
    '_campaignDisableDawn', '_lastPhysioRecordTime', 'hovorkaSteadyStateBasalRate', 'hovorka', '_lastPeisFactor', '_lastHyperMod',
    '_lastExerciseGEMod', '_lastSplanchnicAbsorbMod', '_lastLipolyseRate', '_lastCpt1Activity', 'brainEnergyDeficit', '_lowestBGDuringDeficit',
    'brainDeficitWarningGiven', 'acidosisWarningGiven', 'activeGlucagon',
];

for (const _n of SIMULATOR_ENGINE_READONLY) {
    Object.defineProperty(Simulator.prototype, _n, {
        get() { return this.engine[_n]; },
        enumerable: false, configurable: true,
    });
}
for (const _n of SIMULATOR_ENGINE_READWRITE) {
    Object.defineProperty(Simulator.prototype, _n, {
        get() { return this.engine[_n]; },
        set(v) { this.engine[_n] = v; },
        enumerable: false, configurable: true,
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Simulator };
}
