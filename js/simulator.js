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

// =============================================================================
// AKTIVITETSTYPER — Data-drevet definition af alle aktivitetstyper
// =============================================================================
//
// Hver aktivitetstype har sine egne fysiologiske parametre der bestemmer
// hvordan den påvirker blodsukker, puls, stress og insulinfølsomhed.
//
// Nøgleparametre:
//   hrTarget:        Målpuls per intensitetsniveau [bpm]
//   e1Scaling:       Skalering af E1 (GLUT4 insulin-uafhængigt muskeloptag) [0-1]
//   e2Scaling:       Skalering af E2 (post-exercise insulinfølsomhed) [0-1]
//   stressPerMin:    Akut stress tilføjet per simuleringsminut (katekolamin-respons)
//   kcalPerMin:      Kalorieforbrug per minut
//   stressReduction: Stressreduktion per simuleringsminut (kun afslapning)
//   vasodilatation:  Midlertidig ISF-forbedring under aktiviteten (kun afslapning)
//   farve:           Farve til graf-bånd og UI-elementer
//
// Videnskabeligt grundlag:
//   - Cardio: Riddell et al. 2017 (Lancet), Resalat et al. 2020 (E1/E2-model)
//   - Styrketræning: Yardley et al. 2013 (Diabetes Care), Bally et al. 2015 (HIIT)
//   - Blandet sport: Riddell 2017 ("mixed = glucose stability"), PMC6768890 (fodbold)
//   - Afslapning: PMC10534311 (mindfulness meta-analyse), PMC8798588 (yoga+HPA-akse)
// =============================================================================
const AKTIVITETSTYPER = {
    cardio: {
        navn: "Cardio",
        icon: "🏃",
        eksempler: "Løb, cykling, svømning",
        // Målpuls: moderat til høj — driver E1/E2 og pulsFaktor fuldt ud
        hrTarget: { Lav: 100, Medium: 130, Høj: 160 },
        e1Scaling: 1.0,        // Fuld GLUT4-effekt (insulin-uafhængigt muskeloptag)
        e2Scaling: 1.0,        // Fuld post-exercise insulinfølsomhed
        // Stress: ingen ved lav/medium, mild ved høj (langvarig intens cardio)
        stressPerMin: { Lav: 0, Medium: 0, Høj: 0.005 },
        kcalPerMin: { Lav: 4, Medium: 7, Høj: 10 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#10b981",      // Grøn
    },
    styrke: {
        navn: "Styrketræning",
        icon: "💪",
        eksempler: "Vægttræning, crossfit, kropsvægt",
        // Lavere puls end cardio — styrketræning er interval-baseret
        hrTarget: { Lav: 85, Medium: 110, Høj: 135 },
        e1Scaling: 0.3,        // Mindre kontinuerlig bevægelse → mindre GLUT4-optag
        e2Scaling: 0.9,        // God post-exercise insulinfølsomhed (Yardley 2013)
        // Stress ved ALLE intensiteter — katekolamin-respons er kernen i styrketræning
        // BG stiger akut 2-5 mmol/L (HIIT: gennemsnit +3.7 mmol/L, Bally 2015)
        stressPerMin: { Lav: 0.008, Medium: 0.015, Høj: 0.025 },
        kcalPerMin: { Lav: 3, Medium: 5, Høj: 8 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#ef4444",      // Rød
    },
    blandet: {
        navn: "Blandet sport",
        icon: "⚽",
        eksempler: "Fodbold, badminton, håndbold",
        // Høj puls — blandet sport er ofte intenst (sprints + cardio base)
        hrTarget: { Lav: 105, Medium: 135, Høj: 165 },
        // Vægtet ~65% cardio / ~35% anaerob → moderat GLUT4 + moderat stress
        // Riddell 2017: "mixed activities are associated with glucose stability"
        e1Scaling: 0.65,
        e2Scaling: 0.85,
        // Moderat stress fra intermitterende sprints
        stressPerMin: { Lav: 0.003, Medium: 0.006, Høj: 0.012 },
        kcalPerMin: { Lav: 5, Medium: 8, Høj: 12 },
        stressReduction: 0,
        vasodilatation: 0,
        farve: "#f59e0b",      // Orange
    },
    afslapning: {
        navn: "Afslapning",
        icon: "🧘",
        eksempler: "Yoga, meditation, udstrækning",
        // Puls ved eller under hvile — parasympatisk aktivering
        hrTarget: { Lav: 58, Medium: 55, Høj: 52 },
        e1Scaling: 0.0,        // Ingen muskeloptag (ikke fysisk aktivitet)
        e2Scaling: 0.0,        // Ingen exercise sensitivity-boost
        stressPerMin: { Lav: 0, Medium: 0, Høj: 0 },
        kcalPerMin: { Lav: 1.5, Medium: 2, Høj: 2.5 },
        // REDUCERER stress — parasympatisk aktivering sænker HPA-akse
        // PMC10534311: mindfulness forbedrer glykæmisk kontrol via stressreduktion
        stressReduction: { Lav: 0.005, Medium: 0.01, Høj: 0.015 },
        // Perifer vasodilatation → mild ISF-forbedring under aktiviteten
        // AHA: insulin-medieret vasodilatation er funktionelt koblet til glukoseoptag
        vasodilatation: { Lav: 0.02, Medium: 0.03, Høj: 0.05 },
        farve: "#8b5cf6",      // Lilla
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
        this.activeMotion = [];         // Afsluttede sessions (post-exercise effekter)
        // Aktiv aktivitet — kun én ad gangen. null = ingen aktivitet i gang.
        // Indeholder: { type, intensitet, startTime, varighed, typeDef, kcalPerMin }
        this.activeAktivitet = null;

        // --- Fedt-kompartmenter (pizza-effekt) ---
        // Fedt i maven og tarmen modellerer fedts forsinkelse af kulhydratabsorption.
        // Fedt i tarmen (intestine) er den fysiologisk aktive variabel: det udløser
        // CCK/GLP-1 hormoner der signalerer maven om at tømme langsommere (øget τG).
        //
        // Flow: mad → fatStomach →(τG)→ fatIntestine →(τFatAbs)→ absorberet
        //
        // τFatAbs = 150 min (fedt absorberes langsomt: galde-emulgering + lipase-spalting)
        // Effekt: τG = 40 + 18 × ln(1 + fatIntestine / 10)
        //
        // Kilder: Smart 2013, Wolpert 2013, Lodefalk 2008, Gentilcore 2006
        this.fatStomach = 0;            // Gram fedt i maven (tømmes med τG)
        this.fatIntestine = 0;          // Gram fedt i tarmen (tømmes med τFatAbs=150 min)
        this.TAU_FAT_ABS = 150;         // Tidskonstant for fedt-absorption i tarmen [min]

        // --- Protein-kompartmenter (glukagon-drevet HGP) ---
        // Protein modelleres som aminosyre-absorption der stimulerer glukagonsekretion.
        // Ved T1D har patienten ingen endogen insulin-respons til at modvirke glukagonet,
        // så aminosyrerne driver en umodvirket HGP-stigning via leveren.
        //
        // Dette er den PRIMÆRE mekanisme — IKKE direkte glukoneogenese fra protein.
        // Isotop-studier viser kun 4-19% konvertering (Fromentin 2013, Nuttall 2001),
        // men BG-stigningen ved T1D er langt større pga. glukagon-effekten (Paterson 2016).
        //
        // Flow: mad → proteinStomach →(τG)→ proteinGut →(τProtAbs)→ aminoAcidsBlood
        //                                                                  ↓
        //                                                        glukagon-stimulering
        //                                                                  ↓
        //                                                        proteinGlucagonLevel → EGP
        //
        // Tidsforløb (fra Paterson 2016):
        //   Onset: ~60-90 min (aminosyrer skal absorberes fra tarmen først)
        //   Peak:  ~150-180 min (3 timer efter måltid)
        //   Varighed: >5 timer (langsom clearance)
        //
        // Dosis-respons (Paterson 2016):
        //   <75g protein alene: minimal BG-effekt (inkretiner dominerer)
        //   ≥75g protein alene: +1.6-1.7 mmol/L ved 4-5 timer
        //   I blandet måltid: effekt allerede fra ~12.5g (insulin dækker KH, ikke glukagon)
        //
        // Kilder: Paterson 2016, Smart 2013, Gannon & Nuttall 2001/2013,
        //         Fromentin 2013, Bell 2015/2020, Bengtsen 2021
        this.proteinStomach = 0;        // Gram protein i maven (tømmes med τG)
        this.proteinGut = 0;            // Gram protein i tarmen (absorberes med τProtAbs)
        this.aminoAcidsBlood = 0;       // Aminosyre-niveau i blodet (arbitrær enhed, ~gram-ækvivalent)
        this.proteinGlucagonLevel = 0;  // Glukagon-stimulering fra aminosyrer (adderes til stressMultiplier)
        this.TAU_PROT_ABS = 90;         // Tidskonstant for protein-absorption fra tarm [min]
                                        // Langsommere end KH (~40 min) men hurtigere end fedt (~150 min)
        this.AA_DECAY_RATE = Math.log(2) / 60;  // Aminosyre-clearance halveringstid ~60 min
        // Glukagon-stimulering: Hill-funktion med tærskel
        // EC50=8: halvmaksimal effekt ved ~8g aminosyrer i blodet
        // Hill n=2: moderat stej S-kurve (tærskeleffekt uden on/off)
        // maxGlucagon=0.25: maks BG-stigning ~25% af EGP (matcher Paterson: +1.7 mmol/L ved 75g)
        this.AA_EC50 = 8;               // Halvmaksimal glukagon-stimulering [g aminosyrer]
        this.AA_HILL_N = 2;             // Hill-koefficient (stejlhed af dose-respons)
        this.PROTEIN_GLUCAGON_MAX = 0.25; // Maks glukagon-bidrag til stressMultiplier

        // --- Aggregate state ---
        this.iob = 0;                  // Insulin On Board: total active fast insulin (units)
        this.cob = 0;                  // Carbs On Board: total unabsorbed carbs (grams)
        this.smoothHeartRate = 60;     // Glidende puls [bpm] — falder gradvist efter motion
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

        // --- Fingerprik cooldown ---
        // Teststrimler er dyre (~8 kr/stk) og stikket er ubehageligt.
        // 3 timers cooldown simulerer at man ikke prikker sig hele tiden i virkeligheden.
        this.fingerprickUsedTime = -Infinity; // Sidste fingerprik-tidspunkt (3t cooldown)
        this.fingerprickOnCooldown = false;

        // --- Keton-stik cooldown ---
        // Keton-teststrimler er endnu dyrere (~20 kr/stk).
        // 6 timers cooldown — man måler kun ketoner ved reel mistanke om insulinmangel.
        this.ketoneTestUsedTime = -Infinity;
        this.ketoneTestOnCooldown = false;

        // --- Emergency glucagon ---
        // Glucagon is a hormone that rapidly raises BG by telling the liver to dump glucose.
        // In real life, it's an emergency injection for severe hypoglycemia.
        this.glucagonUsedTime = -Infinity; // Last usage time (24h cooldown)

        // --- Scoring ---
        this.normoPoints = 0;          // Points earned for time spent in target BG range

        // Søvnforstyrrelses-model: natlige interventioner (22:00-07:00) koster
        // søvn, hvilket øger kronisk stress næste dag. Baseret på:
        //   Donga et al. 2010 (Diabetes Care): 1 nat delvis søvnrestriktion
        //   reducerer insulinfølsomhed ~21% hos T1D.
        //   Zheng et al. 2017 (PMC): dårlig søvnkvalitet forstærker dawn-fænomenet.
        //
        // Mekanik: hver vågen-hændelse om natten koster 1 times søvn.
        //   Hændelser inden for 30 min af hinanden tæller som samme vågenhed.
        //   Max 4 timers søvntab pr. nat (ceiling for at undgå urealistisk stress).
        //   Søvntab konverteres til chronicStressLevel ved sovetid-slut (kl. 07):
        //     chronicStress += lostSleepHours * 0.06
        //   Ved max søvntab (4t): chronicStress += 0.24 → ~24% øget insulinresistens
        this.lostSleepHoursTonight = 0;         // Akkumuleret søvntab denne nat
        this.lastNightAwakeningTime = -Infinity; // Tidspunkt for seneste vågenhed
        this.sleepDebtAppliedForDay = -1;        // Hvilken dag søvngæld sidst blev applied

        // Basal insulin reminders — one per day for the first 3 days
        this.basalReminderGivenForDay = [false, false, false];

        // --- Statistics and history ---
        this.bgHistoryForStats = [];   // BG history for TIR/TITR/average calculations
        this.logHistory = [];          // Event log (food, insulin, exercise) for display

        // --- Daglig max points tracking ---
        // Holder styr på den højeste points-score spilleren opnår per dag.
        // Bruges til stjernedryss-animation når ny high score opnås.
        this.dailyMaxPoints = 0;
        this.lastTrackedPointsDay = 1;

        // --- Calorie tracking (for weight change calculation) ---
        this.totalKcalConsumed = 0;        // Total calories eaten
        this.totalKcalBurnedBase = 0;      // Calories burned at rest (BMR)
        this.totalKcalBurnedMotion = 0;    // Calories burned via exercise
        this.weightChangeKg = 0;           // Net weight change (positive = gained)

        // --- Graph messages ---
        // Temporary messages displayed on the graph (e.g., basal reminders)
        this.graphMessages = [];

        // --- Floating labels ---
        // Animerede labels der popper op over grafen og forsvinder af sig selv.
        // Bruges til fingerprik- og ketonresultater (spil-agtigt feedback).
        // Hvert label: { time, value, text, color, createdAt, duration }
        this.floatingLabels = [];

        // --- Insulin resistance factor ---
        // Dynamically modified by chronic stress. At baseline (no stress) = 1.0.
        // Higher values mean insulin is less effective (ISF is divided by this).
        this.insulinResistanceFactor = 1.0;

        // --- Zone-lyd tracking ---
        // Tracker om BG er i bestemte zoner så lyde kun spilles ved overgang (ikke hvert tick).
        this.isInBonusRange = true;       // 5.0-6.0 mmol/L → stjernedrys (true ved start så lyd ikke triggers)
        this.isInRange = true;            // 4.0-10.0 mmol/L → positiv lyd (true ved start)
        this.isInHyperZone = false;       // > 10.0 → "nedern" lyd
        this.lastHypoWarnTime = -Infinity; // cooldown for hypo-fare lyd (sim-minutter)
        this.hypoWarnArmed = true;         // hysterese: klar til næste hypo-advarsel (reset når BG > 5.0)

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

        // --- Dawn-variabilitet ---
        // Dawn-fænomenet (morgenkortisol) varierer fra dag til dag.
        // Ved simulationsstart og ved hvert dagsskift genereres nye værdier:
        //   - Amplitude: normalfordelt (mean 0.3, std 0.06, CV ~20%)
        //   - Peak-tidspunkt: normalfordelt (mean 08:00, std 30 min)
        // Dårlig søvn og kronisk stress forstærker amplituden yderligere
        // (Leproult 1997: søvndeprivation øger morgenkortisol 30-50%).
        this._dawnAmplitude = this.gaussRand(0.3, 0.06);       // Basis-amplitude
        this._dawnPeakMinutes = this.gaussRand(8 * 60, 30);    // Peak-tidspunkt
        this._dawnDay = 1;                                      // Hvilken dag dawn er beregnet for

        // --- Hypoglykæmi-unawareness (HAAF) — Kontinuert areal-baseret model ---
        //
        // Baseret på: Dagogo-Jack et al. 1993, Cryer 2001/2013, Reno et al. 2013,
        // Fanelli et al. 1993, Cranston et al. 1994, Rickels et al. 2019.
        //
        // Modellen bruger to modstridende kræfter:
        //
        // 1. SKADE (hypoArea): Akkumuleret "hypo-belastning"
        //    hypoArea += max(0, 3.0 - trueBG) × dt  [mmol/L × min]
        //    Jo dybere og længere hypo, jo mere skade. BG=2.0 i 30 min giver
        //    (3.0-2.0) × 30 = 30 mmol·min/L. BG=3.5 giver 0 (over tærskel).
        //
        // 2. RECOVERY: Når BG er over 4.0, falder hypoArea eksponentielt
        //    med halveringstid HAAF_RECOVERY_HALFLIFE (sim-minutter).
        //    Klinisk: 2-3 uger → komprimeret til ~3 sim-dage for gameplay.
        //
        // counterRegFactor beregnes fra hypoArea via sigmoid:
        //    counterRegFactor = 0.3 + 0.7 × exp(-hypoArea / HAAF_DAMAGE_SCALE)
        //    0 areal → 1.0 (fuld respons)
        //    Stort areal → 0.3 (svær HAAF, 70% reduktion)
        //
        // Parametre kalibreret så:
        //   - En kort hypo (BG=2.5 i 20 min) giver ~20% reduktion
        //   - To hypoer samme dag giver ~40-50% reduktion
        //   - 3 sim-dage uden hypo → næsten fuld genopretning
        //
        // HAAF_DAMAGE_SCALE: areal der giver ~63% reduktion [mmol·min/L]
        //   Sat til 30 — svarende til BG=2.0 i 30 min, eller BG=2.5 i 60 min
        // HAAF_RECOVERY_HALFLIFE: halveringstid for recovery [sim-minutter]
        //   Sat til 3×24×60 = 4320 min (3 sim-dage). Klinisk evidens:
        //   Dagogo-Jack 1993: 2-3 uger → awareness restored
        //   Fanelli 1993: 3 måneder → adrenalin delvist restored
        //   Vi komprimerer til 3 dage for gameplay-balance.
        this.hypoArea = 0.0;              // Akkumuleret hypo-belastning [mmol·min/L]
        this.counterRegFactor = 1.0;      // Effektiv kontraregulerings-styrke (0.3-1.0)
        this.HAAF_DAMAGE_SCALE = 30;      // Skala for skade [mmol·min/L]
        this.HAAF_RECOVERY_HALFLIFE = 3 * 24 * 60; // Recovery t½ [sim-min] (3 dage)

        // --- Lever-glykogenpool (massebalanceret model i gram) ---
        //
        // Leveren indeholder ~80-100g glykogen hos en voksen. Dette er en
        // ENDELIG brændstofkilde for hurtig glukoseproduktion (glykogenolyse).
        //
        // Massebalancen er eksplicit — glukose opstår IKKE fra ingenting:
        //
        // FORBRUG (tømmer poolen):
        //   1. Stress-drevet glykogenolyse — glukagon/adrenalin omdanner
        //      glykogen → glukose. Raten er proportional med den akutte stress
        //      der ligger over baseline. Beregnes fra EGP-formlens stress-komponent.
        //   2. Motion-drevet forbrug — under motion bruger muskler leverglykogen
        //      indirekte via Cori-cyklus (laktat → lever → glukose → blod → muskler).
        //      Raten stiger med aktivitetens intensitet (kcal/min som proxy).
        //
        // GENOPFYLDNING (fylder poolen):
        //   1. Gluconeogenese — leveren syntetiserer glukose fra aminosyrer,
        //      laktat og glycerol. Konstant ~0.1 g/min (6 g/time). Kræver IKKE
        //      glykogen og er derfor altid tilgængelig.
        //   2. Kulhydrat-absorption — når BG er over basalniveau og insulin er
        //      til stede, lagrer leveren overskuds-glukose som glykogen.
        //      ~30-40% af absorberede kulhydrater lagres i leveren.
        //
        // EFFEKT PÅ MODELLEN:
        //   glycogenReserve = min(1.0, liverGlycogenGrams / GLYCOGEN_STRESS_THRESHOLD)
        //   effectiveAcuteStress = acuteStressLevel × glycogenReserve
        //   → Når glykogen < 15g: stress-drevet EGP falder proportionelt
        //   → Ved 0g: kun gluconeogenese-baseline leverer glukose
        //
        // Typisk forløb:
        //   Hypo alene:          ~7-10 g/time forbrug → 90g holder i ~10 timer
        //   Høj cardio:          ~25-35 g/time → 90g holder i ~3 timer
        //   Høj cardio + hypo:   ~35-45 g/time → under stressTærskel (15g) efter ~2 timer
        //   Recovery (spisning):  ~20-30 g/time (hurtig ved mad)
        //   Recovery (faste):     ~6 g/time (kun gluconeogenese)
        //
        // Kilder: Roden 2001 (lever-glykogen, MRS-måling)
        //         Petersen 2004 (glycogen repletion efter motion)
        //         Trefts 2015 (exercise + hepatic glucose output)
        //         Gonzalez 2016 (postprandial liver glycogen synthesis)
        this.liverGlycogenGrams = 90;           // Start: 90g (normal postabsorptiv voksen)
        this.LIVER_GLYCOGEN_MAX = 120;          // Max kapacitet [g]
        this.GLYCOGEN_STRESS_THRESHOLD = 15;    // Under dette gram svækkes stress-EGP
        this.glycogenReserve = 1.0;             // Afledt: 0.0-1.0, skalerer EGP og stress

        // Initialiser Hovorka-modellen til steady-state.
        // initializeSteadyState finder automatisk den insulin-rate der giver
        // target BG=5.5 mmol/L, uanset patientens ISF/basal-dosis.
        // Den fundne rate gemmes som hovorkaSteadyStateBasalRate.
        const basalRateGuess = this.hovorka.basalToRate(this.basalDose);
        this.hovorka.initializeSteadyState(basalRateGuess, 5.5);
        this.hovorkaSteadyStateBasalRate = this.hovorka.steadyStateBasalRate;

        // Gem steady-state basal IOB (S1+S2 ved ligevægt) så vi kan trække
        // den fra total IOB. Vi viser kun BOLUS-IOB til spilleren — basal
        // insulin er en stabil baggrund der ikke er relevant for doserings-beslutninger.
        this.basalIOBbaseline = (this.hovorka.state[2] + this.hovorka.state[3]) / 1000;

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
     * Base ISF is modified by three dynamic factors:
     *
     *   1. circadianISF (0.70–1.20 over døgnet)
     *      — Cirkadisk døgnvariation i insulinfølsomhed.
     *      — Om morgenen (kl. ~08): faktor 0.70 → insulin virker 30% dårligere
     *        → spilleren skal bruge ~43% mere insulin for samme effekt.
     *      — Om aftenen (kl. ~19): faktor 1.20 → insulin virker 20% bedre.
     *      — Baseret på Toffanin 2013, dæmpet 50%, justeret efter klinisk
     *        erfaring. Se circadianISF getter for detaljer.
     *
     *   2. insulinResistanceFactor (>1.0 when chronic stress is elevated)
     *      — Kronisk stress øger insulinresistens via leverens HGP.
     *      — Sættes i updateStressHormones: 1.0 + chronicStressLevel × 0.5.
     *
     *   3. sensitivityIncreaseFactor (>1.0 after exercise)
     *      — Motion øger insulinfølsomhed i timer efter træning.
     *      — Fader lineært fra max til 1.0 over post-exercise perioden.
     *
     * @returns {number} Effective ISF in mmol/L per unit of insulin
     */
    get currentISF() {
        // Start with no sensitivity increase (factor = 1.0 = no change)
        let sensitivityIncreaseFactor = 1.0;

        // Check each active/recent exercise session for post-exercise sensitivity boost.
        // Eksponentielt henfald: kraftig effekt lige efter motion, aftager hurtigt
        // de første timer, men med en lang hale der varer op til ~24 timer.
        //
        // Halveringstider (sensitivityHalfLife):
        //   Lav intensitet:  t½ = 3 timer → mærkbar effekt i ~6-8 timer
        //   Medium:          t½ = 4 timer → mærkbar effekt i ~10-12 timer
        //   Høj:             t½ = 5 timer → mærkbar effekt i ~14-18 timer
        //
        // Klinisk evidens: Riddell 2017 (Lancet) rapporterer 24-48 timers øget
        // insulinfølsomhed efter motion. Halveringstiderne er valgt så daglig
        // motion giver overlap → vedvarende lavere insulinbehov.
        //
        // sensitivityEndTime bruges som oprydnings-cutoff (boost < 1%).
        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes < motion.sensitivityEndTime) {
                const timeAfterExercise = this.totalSimMinutes - (motion.startTime + motion.duration);
                if (timeAfterExercise < 0) return; // Stadig under motion — håndteres af E1/E2

                // Eksponentielt henfald: boost × 2^(-t/t½)
                const halfLife = motion.sensitivityHalfLife || 240;
                const decay = Math.pow(0.5, timeAfterExercise / halfLife);
                const currentIncrease = (motion.maxSensitivityIncreaseFactor - 1) * decay;

                if (currentIncrease > 0.005) { // Cutoff: < 0.5% boost = negligibelt
                    sensitivityIncreaseFactor = Math.max(sensitivityIncreaseFactor, 1 + currentIncrease);
                }
            }
        });

        // Afslapning vasodilatation — mild ISF-forbedring UNDER aktiviteten.
        // Perifer vasodilatation øger blodgennemstrømning → insulin virker lidt bedre.
        let vasodilatationFaktor = 1.0;
        if (this.activeAktivitet) {
            const typeDef = this.activeAktivitet.typeDef;
            const vasoDil = typeof typeDef.vasodilatation === 'object'
                ? (typeDef.vasodilatation[this.activeAktivitet.intensitet] || 0)
                : (typeDef.vasodilatation || 0);
            if (vasoDil > 0) {
                vasodilatationFaktor = 1.0 + vasoDil; // fx 1.03 = 3% bedre ISF
            }
        }

        // Final ISF = base ISF × cirkadisk faktor × resistensfaktor × vasodilatation / motionsboost
        // circadianISF < 1.0 om morgenen → lavere ISF → insulin virker dårligere
        // circadianISF > 1.0 om aftenen → højere ISF → insulin virker bedre
        return (this.ISF * this.circadianISF * this.insulinResistanceFactor * vasodilatationFaktor) / sensitivityIncreaseFactor;
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
    // gaussRand — Normalfordelt tilfældig variabel (Box-Muller transformation)
    // =========================================================================
    // Genererer en normalfordelt værdi med angivet gennemsnit og standardafvigelse.
    // Bruges til fysiologisk variation: insulin-bioavailability, dawn-amplitude,
    // søvnstress, absorptionshastighed m.m.
    // Box-Muller transformerer to uniformt fordelte tal til én normalfordelt.
    gaussRand(mean, std) {
        const u1 = Math.random(), u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * std;
    }

    // =========================================================================
    // regenerateDawn — Generér nye dawn-parametre for en ny dag
    // =========================================================================
    // Kaldes ved dagsskift (midnat). Beregner ny amplitude og peak-tidspunkt
    // for morgenkortisol, påvirket af:
    //   1. Basis-variation: CV ~20% (normalfordelt)
    //   2. Søvngæld: forstærker dawn med ~12% per mistet time
    //      (Leproult 1997: søvndeprivation øger morgenkortisol 30-50%)
    //   3. Kronisk stress: forstærker dawn med op til ~30%
    //      (vedvarende kortisol gør morgen-peaket højere)
    regenerateDawn() {
        // Basis-variation: mean 0.15, std 0.03 (CV ~20%)
        // NOTE: Reduceret fra 0.30 til 0.15 fordi dawn-effekten nu er DELT
        // mellem HGP-stigning (denne kurve) og cirkadisk ISF-reduktion
        // (circadianISF getter). Se PHYSIOLOGY.md section 8 for begrundelse.
        let amplitude = Math.max(0.05, Math.min(0.35, this.gaussRand(0.15, 0.03)));

        // Dårlig søvn forstærker dawn (+12% per mistet time søvn)
        // Ved max søvntab (4t): +48% amplitude → ~0.22 i stedet for 0.15
        amplitude *= 1 + this.lostSleepHoursTonight * 0.12;

        // Kronisk stress fra forrige dag forstærker dawn (+30% ved chronicStress=1.0)
        amplitude *= 1 + this.chronicStressLevel * 0.30;

        // Clamp til fysiologisk område (reduceret max fra 0.60 til 0.35)
        this._dawnAmplitude = Math.min(0.35, amplitude);

        // Peak-tidspunkt varierer: mean 08:00, std 30 min → typisk 07:00-09:00
        this._dawnPeakMinutes = Math.max(6.5 * 60, Math.min(9.5 * 60,
            this.gaussRand(8 * 60, 30)));

        this._dawnDay = this.day;
    }

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
    get circadianKortisolNiveau() {
        // Regenerér dawn-parametre ved dagsskift (ny dag = nye værdier).
        // Vigtigt: dette sker FØR applySleepDebt, så søvngæld fra natten
        // påvirker denne morgens dawn-amplitude.
        if (this.day !== this._dawnDay) {
            this.regenerateDawn();
        }

        const amplitude = this._dawnAmplitude;
        const peakTime = this._dawnPeakMinutes;
        const t = this.timeInMinutes;

        // Stigningen starter 4 timer før peak (uanset peak-tidspunkt)
        const stigStart = peakTime - 4 * 60;
        // Faldet slutter 4 timer efter peak (symmetrisk)
        const falSlut = peakTime + 4 * 60;

        if (t >= stigStart && t < peakTime) {
            // Stigende fase: kvart-sinusbue fra 0 → amplitude
            const fremgang = (t - stigStart) / (peakTime - stigStart);
            return amplitude * Math.sin(Math.PI / 2 * fremgang);

        } else if (t >= peakTime && t < falSlut) {
            // Faldende fase: spejlet sinusbue fra amplitude → 0
            const fremgang = (t - peakTime) / (falSlut - peakTime);
            return amplitude * Math.sin(Math.PI / 2 * (1 - fremgang));

        } else {
            // Resten af dagen: ingen cirkadisk kortisol-bidrag
            return 0;
        }
    }

    // =========================================================================
    // CIRCADIAN ISF — Døgnvariation i insulinfølsomhed
    // =========================================================================
    //
    // Insulinfølsomheden varierer over døgnet. Om morgenen er insulin
    // mindre effektivt (ISF lavere), om aftenen mere effektivt (ISF højere).
    // Dette er en SEPARAT mekanisme fra dawn-fænomenet (HGP-stigning via
    // circadianKortisolNiveau) — dawn driver leverproduktion, denne kurve
    // driver perifer insulinresistens.
    //
    // HYBRID MODEL: Den samlede morgen-effekt er summen af:
    //   1. HGP +15% (circadianKortisolNiveau, reduceret fra +30%)
    //   2. ISF ×0.70 (denne kurve → 43% mere insulin nødvendigt)
    //
    // Kurven er inspireret af Toffanin et al. (2013) men dæmpet til 50%
    // amplitude, da evidensen for T1D er mangelfuld:
    //   - Hinshaw 2013: ISF-mønster er individuelt, ikke generaliserbart
    //   - Sohag 2022: morgen ISF ~50, aften ~75 mg/dL (50% forskel)
    //   - Klinisk erfaring: ~40% mere morgeninsulin matcher T1D-oplevelse
    //
    // Kontrolpunkter (tid → ISF-faktor relativt til nominelt=1.0):
    //   00:00 → 1.20  (nat: høj følsomhed)
    //   04:00 → 1.20  (sen nat: stadig høj, inden dawn-drop)
    //   08:00 → 0.70  (morgen nadir: lavest følsomhed)
    //   14:00 → 1.00  (eftermiddag: nominelt)
    //   19:00 → 1.20  (aften: højest følsomhed)
    //   24:00 → 1.20  (midnat: wraps til start)
    //
    // Mellem kontrolpunkter interpoleres med cosinusfunktion for glatte
    // overgange uden skarpe knæk (S-kurve mellem hvert par).
    //
    // Visual (ISF-faktor over døgnet):
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
    // VIGTIGT: Denne model er bygget på mangelfuld evidens og klinisk
    // erfaring. Bør opdateres hvis bedre kvantitative data bliver
    // tilgængelige. Se PHYSIOLOGY.md section 8 og SCIENCE.md section 14.
    // =========================================================================
    get circadianISF() {
        const t = this.timeInMinutes;

        // Kontrolpunkter: [tid_i_minutter, ISF_faktor]
        // Defineret som array for overskuelighed og nem justering.
        const points = [
            [0,    1.20],   // midnat
            [240,  1.20],   // 04:00 — sen nat, inden dawn-drop
            [480,  0.70],   // 08:00 — morgen nadir (lavest følsomhed)
            [840,  1.00],   // 14:00 — eftermiddag nominelt
            [1140, 1.20],   // 19:00 — aften peak (højest følsomhed)
            [1440, 1.20],   // 24:00 — midnat (wraps)
        ];

        // Find det segment vi er i (hvilket par af kontrolpunkter)
        let i = 0;
        while (i < points.length - 1 && t >= points[i + 1][0]) i++;

        // Cosinus-interpolation for glat S-kurve mellem kontrolpunkter.
        // cos(0)=1, cos(π)=-1 → (1-cos(π×progress))/2 giver 0→1 S-kurve.
        const [t0, v0] = points[i];
        const [t1, v1] = points[Math.min(i + 1, points.length - 1)];

        if (t1 === t0) return v0; // Guard mod division by zero ved endpoints

        const progress = (t - t0) / (t1 - t0);
        const smoothProgress = (1 - Math.cos(Math.PI * progress)) / 2;

        return v0 + (v1 - v0) * smoothProgress;
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
        let basalInsulinRate = 0;  // Separat tracking til debug-panelet [mU/min]
        this.activeLongInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection < 0) return;
            let effectFactor = 0;
            const timeToPlateau = 4 * 60;
            const endOfPlateau = timeToPlateau + 18 * 60;
            const tailOffDuration = ins.totalDuration - endOfPlateau;
            if (timeSinceInjection < timeToPlateau) effectFactor = timeSinceInjection / timeToPlateau;
            else if (timeSinceInjection < endOfPlateau) effectFactor = 1.0;
            else if (timeSinceInjection < ins.totalDuration && tailOffDuration > 0) effectFactor = 1.0 - (timeSinceInjection - endOfPlateau) / tailOffDuration;
            // Bioavailability: kun en del af dosen når blodbanen (resten nedbrydes lokalt).
            // Ældre injektioner (før denne feature) har ingen bioavailability → default 1.0.
            const ba = ins.bioavailability || 1.0;
            const rate = (ins.dose * ba * 1000 / ins.totalDuration) * Math.max(0, effectFactor);
            totalInsulinRate += rate;
            basalInsulinRate += rate;
        });
        this.basalInsulinRate = basalInsulinRate;  // Gem til debug [mU/min]
        this.activeLongInsulin = this.activeLongInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        // BOLUS (hurtigvirkende) insulin: injiceres som kort puls (5 sim-min).
        // Hovorka-modellens S1→S2→I→x1/x2/x3 kompartmenter håndterer al
        // farmakokinetik (absorption, distribution, effekt-forsinkelse).
        // Vi bruger IKKE en trekant-profil oven på Hovorka — det ville give
        // dobbelt modellering og alt for lang insulinvarighed.
        //
        // IOB beregnes fra Hovorka's tilstandsvariable (S1 + S2 + I*VI)
        // i stedet for vores egen tracking, da Hovorka nu ejer al insulin-PK.
        //
        // Bioavailability reducerer effektiv dosis (lokal nedbrydning i subkutis).
        // tauFactor varierer absorptionshastigheden per injektion — sættes som
        // en vægtet blanding af alle aktive injektioners tauFactor.
        const BOLUS_PULSE_DURATION = 5; // minutter — simulerer subkutan injektion
        let bolusInsulinRate = 0;  // Separat tracking til debug-panelet [mU/min]
        let tauWeightSum = 0;
        let tauWeightedFactor = 0;
        this.activeFastInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection >= 0 && timeSinceInjection < BOLUS_PULSE_DURATION) {
                // Injicér effektiv dosis (efter lokal nedbrydning) som kort puls.
                const ba = ins.bioavailability || 1.0;
                const rate = ins.dose * ba * 1000 / BOLUS_PULSE_DURATION;
                totalInsulinRate += rate;
                bolusInsulinRate += rate;
            }
            // Vægtet tauFactor: nyeste/største injektioner dominerer.
            // Bruges til at justere Hovorka's tau_I for denne tick.
            const tf = ins.tauFactor || 1.0;
            const remainingInsulin = Math.max(0, ins.dose * (1 - timeSinceInjection / (6 * 60)));
            if (remainingInsulin > 0) {
                tauWeightSum += remainingInsulin;
                tauWeightedFactor += tf * remainingInsulin;
            }
        });
        // Opdatér Hovorka's tau_I baseret på vægtet gennemsnit af aktive injektioners
        // absorptionsvariabilitet. Standardværdi 55 min skaleres med tauFactor.
        const baseTauI = 55; // Hovorka standard [min]
        if (tauWeightSum > 0) {
            this.hovorka.tau_I = baseTauI * (tauWeightedFactor / tauWeightSum);
        } else {
            this.hovorka.tau_I = baseTauI;
        }
        this.bolusInsulinRate = bolusInsulinRate;  // Gem til debug [mU/min]
        // Fjern bolus-entries efter 6 timer (langt efter pulsen er slut, men
        // beholdes for log/UI-formål og IOB-tracking)
        this.activeFastInsulin = this.activeFastInsulin.filter(ins =>
            (this.totalSimMinutes - ins.injectionTime) < 6 * 60);

        // IOB: beregn fra Hovorka's insulin-kompartmenter. S1+S2 er total
        // subkutan insulin (basal + bolus). Vi trækker basal-baseline fra
        // så IOB kun viser BOLUS-insulin — det er det spilleren har brug for
        // at se for at undgå insulin-stacking. Basal er stabil baggrund.
        const totalIOB = (this.hovorka.state[2] + this.hovorka.state[3]) / 1000;
        this.iob = Math.max(0, totalIOB - this.basalIOBbaseline);

        // --- 2. FEDT-KOMPARTMENTER OG DYNAMISK τG (pizza-effekt) ---
        //
        // Fedt modelleres med to kompartmenter parallelt til kulhydraternes D1/D2:
        //   fatStomach → fatIntestine → absorberet (FFA i blodet)
        //
        // Fedt i tarmen udløser CCK/GLP-1 hormoner der bremser mavetømning.
        // Effekten er logaritmisk mættende: de første 20g fedt bremser mest.
        //
        // Kilder: Smart 2013 (35g fedt forsinkede peak 47 min),
        //         Wolpert 2013, Lodefalk 2008, Gentilcore 2006
        // -----------------------------------------------------------------

        // Fedt-kompartment ODE'er (Euler-integration, dt = simuleringstidsstep)
        const currentTauG = 40 + 18 * Math.log(1 + this.fatIntestine / 10);
        const fatStomachToIntestine = this.fatStomach / currentTauG * simulatedMinutesPassed;
        const fatIntestineAbsorbed = this.fatIntestine / this.TAU_FAT_ABS * simulatedMinutesPassed;
        this.fatStomach = Math.max(0, this.fatStomach - fatStomachToIntestine);
        this.fatIntestine = Math.max(0, this.fatIntestine + fatStomachToIntestine - fatIntestineAbsorbed);

        // Opdater Hovorka's τG dynamisk — dette påvirker D1→D2 og D2→blod raten
        this.hovorka.tau_G = currentTauG;

        // --- 2b. PROTEIN-KOMPARTMENTER OG GLUKAGON-DREVET HGP ---
        //
        // Protein modelleres med tre kompartmenter:
        //   proteinStomach →(τG)→ proteinGut →(τProtAbs)→ aminoAcidsBlood →(decay)→ 0
        //
        // Aminosyrer i blodet stimulerer alfa-cellernes glukagonsekretion.
        // Ved T1D er der ingen endogen insulinrespons → glukagon virker umodvirket
        // → leveren øger glukoseproduktionen (HGP) via glycogenolyse/gluconeogenese.
        //
        // Dosis-respons: Hill-funktion (tærskeleffekt + mætning)
        //   proteinGlucagonLevel = maxGlucagon × AA^n / (EC50^n + AA^n)
        //
        // Tidsforløb (matcher Paterson 2016):
        //   Onset ~60-90 min, Peak ~150-180 min, Varighed >5 timer
        //
        // Kilder: Paterson 2016, Smart 2013, Gannon 2001/2013, Fromentin 2013,
        //         Bell 2015/2020, Bengtsen 2021
        // -----------------------------------------------------------------

        // Protein transit: mave → tarm (deler τG med kulhydrater — blandes i samme mave)
        const protStomachToGut = this.proteinStomach / currentTauG * simulatedMinutesPassed;
        this.proteinStomach = Math.max(0, this.proteinStomach - protStomachToGut);

        // Protein absorption: tarm → aminosyrer i blod (τProtAbs = 90 min)
        // Langsommere end KH (~40 min) men hurtigere end fedt (~150 min)
        // Proteiner skal spaltes af proteaser (pepsin, trypsin) før absorption
        const protGutAbsorbed = this.proteinGut / this.TAU_PROT_ABS * simulatedMinutesPassed;
        this.proteinGut = Math.max(0, this.proteinGut + protStomachToGut - protGutAbsorbed);

        // Aminosyre-pool i blodet: tilføj absorberede + naturlig clearance
        // Clearance via oxidation, proteinsyntese, og renal udskillelse (t½ ~60 min)
        const aaDecay = this.aminoAcidsBlood * this.AA_DECAY_RATE * simulatedMinutesPassed;
        this.aminoAcidsBlood = Math.max(0, this.aminoAcidsBlood + protGutAbsorbed - aaDecay);

        // Glukagon-stimulering fra aminosyrer: Hill-funktion
        // Giver tærskeleffekt (lidt protein = næsten ingen effekt) og mætning (meget protein platauer)
        // EC50=8g: halvmaksimal ved ~8g aminosyrer i blodet
        // Hill n=2: moderat S-kurve
        // maxGlucagon=0.25: maks ~25% øget EGP (kalibreret til Paterson 2016: +1.7 mmol/L ved 75g)
        const aaN = Math.pow(this.aminoAcidsBlood, this.AA_HILL_N);
        const ec50N = Math.pow(this.AA_EC50, this.AA_HILL_N);
        this.proteinGlucagonLevel = this.PROTEIN_GLUCAGON_MAX * aaN / (ec50N + aaN);

        // --- BEREGN KULHYDRAT-RATE til Hovorka D1/D2 [mmol/min] ---
        //
        // Kulhydrater feedes ind i Hovorka's D1→D2 tarm-kompartmenter via
        // carbRate. Med den dynamiske τG giver modellen automatisk langsommere
        // absorption når der er fedt i tarmen (pizza-effekten).
        //
        // Protein påvirker BG via glukagon-stimulering (se ovenfor), IKKE som kulhydrater.
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

            // COB tracking: estimer resterende kulhydrater baseret på tid.
            // Med dynamisk τG bruger vi den aktuelle τG til decay-estimat.
            // Protein er IKKE del af COB — det påvirker BG via glukagon, ikke som kulhydrat.
            const decayTime = 3 * currentTauG; // ~95% absorberet efter 3×τG
            const carbDecay = Math.max(0, 1 - timeSinceConsumption / decayTime);
            this.cob += food.carbs * carbDecay;
        });
        // Fjern mad-entries efter 6 timer (fedt kan forlænge absorption betydeligt)
        this.activeFood = this.activeFood.filter(f =>
            (this.totalSimMinutes - f.startTime) < 360);

        // --- 3. BEREGN PULS OG AKTIVITETSEFFEKTER ---
        // Aktivitetstypen bestemmer målpuls, E1-skalering, stress og stressreduktion.
        // Puls stiger/falder GRADVIST via eksponentiel smoothing:
        //   Under aktivitet: t½ ≈ 2 min (hurtig stigning)
        //   Efter aktivitet:  t½ ≈ 5 min (gradvis recovery — realistisk)
        let targetHeartRate = this.hovorka.HR_base;
        let currentE1Scaling = 1.0; // Standard: fuld E1-effekt

        // Håndtér aktiv aktivitet
        if (this.activeAktivitet) {
            const akt = this.activeAktivitet;
            const typeDef = akt.typeDef;

            // Målpuls fra aktivitetstype og intensitet
            targetHeartRate = typeDef.hrTarget[akt.intensitet] || typeDef.hrTarget.Medium;

            // E1-skalering: styrer hvor meget puls driver GLUT4-optag
            // Cardio=1.0 (fuld), Styrke=0.3 (lille), Afslapning=0.0 (ingen)
            currentE1Scaling = typeDef.e1Scaling;

            // Stress-tilføjelse per sim-minut (katekolamin-respons)
            // Styrketræning: stress ved alle intensiteter → akut BG-stigning
            // Cardio: kun mild stress ved høj intensitet
            const stressRate = typeDef.stressPerMin[akt.intensitet] || 0;
            if (stressRate > 0) {
                this.acuteStressLevel = Math.min(0.4,
                    this.acuteStressLevel + stressRate * simulatedMinutesPassed);
            }

            // Stressreduktion (kun afslapning) — parasympatisk aktivering
            // Reducerer BÅDE akut og kronisk stress over tid
            const stressRedRate = typeof typeDef.stressReduction === 'object'
                ? (typeDef.stressReduction[akt.intensitet] || 0)
                : typeDef.stressReduction;
            if (stressRedRate > 0) {
                this.acuteStressLevel = Math.max(0,
                    this.acuteStressLevel - stressRedRate * simulatedMinutesPassed);
                this.chronicStressLevel = Math.max(0,
                    this.chronicStressLevel - stressRedRate * 0.3 * simulatedMinutesPassed);
            }

            // Akkumulér kalorieforbrænding
            akt.kcalBurned += akt.kcalPerMin * simulatedMinutesPassed;

            // Auto-stop hvis fast varighed er sat og tiden er nået
            if (akt.varighed && (this.totalSimMinutes - akt.startTime) >= akt.varighed) {
                this.stopAktivitet();
            }
        }

        // --- Hypo-reduceret motionskapacitet ---
        // Ved lav BG kan kroppen ikke opretholde høj fysisk aktivitet.
        // Hjernen prioriterer glukose → muskler svækkes → puls falder.
        // BG ≥ 3.5: fuld kapacitet (factor=1.0)
        // BG  = 2.5: halveret kapacitet (factor=0.5)
        // BG ≤ 2.0: minimal kapacitet (factor≈0.1) — næsten bevidstløs
        // Implementeret som lineær interpolation fra hvilepuls mod målpuls.
        if (this.trueBG < 3.5 && targetHeartRate > this.hovorka.HR_base) {
            const hypoFactor = Math.max(0.05, Math.min(1.0, (this.trueBG - 1.5) / 2.0));
            targetHeartRate = this.hovorka.HR_base + (targetHeartRate - this.hovorka.HR_base) * hypoFactor;
        }

        // Glidende puls: eksponentiel tilnærmelse mod targetHeartRate.
        // Hurtigere op (t½≈2 min) end ned (t½≈5 min) — fysiologisk realistisk.
        const isRising = targetHeartRate > this.smoothHeartRate;
        const hrHalfLife = isRising ? 2.0 : 5.0;  // sim-minutter
        const hrDecay = 1 - Math.exp(-Math.log(2) / hrHalfLife * simulatedMinutesPassed);
        this.smoothHeartRate += (targetHeartRate - this.smoothHeartRate) * hrDecay;
        const currentHeartRate = this.smoothHeartRate;

        // --- 4. SÆT HOVORKA-INPUTS OG KØR MODELLEN ---
        //
        // StressMultiplier bestemmer leverens glukose-output (EGP).
        // Normal baseline (1.0) består af to komponenter:
        //   - 50% glycogenolysis: omdanner glykogen → glukose (kræver glykogen!)
        //   - 50% gluconeogenese: syntetiserer glukose fra aminosyrer/laktat (altid aktiv)
        //
        // Når leverglykogenet er udtømt, falder glycogenolysis-delen til 0,
        // og kun gluconeogenese (0.5) forbliver. EGP halveres.
        //
        // Akut stress (Somogyi) driver EKSTRA glycogenolysis — kræver også glykogen.
        // Kronisk stress og circadian kortisol driver gluconeogenese — uafhængig af glykogen.
        // Protein-glukagon driver EKSTRA glycogenolyse+gluconeogenese — kræver delvist glykogen.
        //
        // Effekt ved tom glycogen:
        //   stressMultiplier = 0.5 + 0 + chronic + circadian + protGlucagon×0.5
        //   Protein-glukagon halveres ved tom glykogen (halvdelen er glycogenolyse-drevet)
        const glycogenBaseline = 0.5 * this.glycogenReserve; // 0.0-0.5 (glycogenolysis)
        const gngBaseline = 0.5;                              // altid 0.5 (gluconeogenese)
        const effectiveAcuteStress = this.acuteStressLevel * this.glycogenReserve;
        // Protein-glukagon: ~50% via glycogenolyse (kræver glykogen), ~50% via gluconeogenese
        // Ved tom glykogen forbliver gluconeogenese-delen (aminosyrer → glukose)
        const effectiveProteinGlucagon = this.proteinGlucagonLevel *
            (0.5 + 0.5 * this.glycogenReserve);
        const stressMultiplikator = glycogenBaseline + gngBaseline + effectiveAcuteStress +
            this.chronicStressLevel + this.circadianKortisolNiveau + effectiveProteinGlucagon;

        this.hovorka.insulinRate = totalInsulinRate;
        // Kulhydrater feedes nu via Hovorka's D1→D2 tarm-model (ikke direkte Q1).
        // D1/D2 giver realistisk 2-kompartment absorption med peak ved ~2*τG.
        this.hovorka.carbRate = totalCarbRate;
        this.hovorka.heartRate = currentHeartRate;
        this.hovorka.stressMultiplier = stressMultiplikator;
        // E1-skalering: aktivitetstype bestemmer hvor meget puls driver GLUT4-optag.
        // Cardio=1.0, Styrke=0.3, Blandet=0.65, Afslapning=0.0.
        this.hovorka.e1Scaling = currentE1Scaling;

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
        //   1. Interstitiel forsinkelse (Hovorkas C-kompartment: dC = ka_int × (G - C))
        //   2. Random målestøj (sensor-elektronik)
        //   3. Langsom systematisk drift (sensor-degradering, kalibreringsdrift)
        //
        // Forsinkelsen modelleres fysiologisk korrekt via Hovorkas ODE:
        //   dC/dt = ka_int × (G - C)
        // hvor G er plasma-glukose og C er interstitiel glukose.
        // ka_int = 0.073 min⁻¹ → tidskonstant ~14 min → 5-10 min effektiv lag.
        // Dette er et førsteordens lavpasfilter der giver:
        //   - Hurtigt stigende BG: CGM halter bagefter (viser lavere)
        //   - Hurtigt faldende BG: CGM halter bagefter (viser højere)
        //   - Stabilt BG: CGM = sandt BG (ingen forsinkelse ved steady state)
        //
        // Oven på den interstitielle værdi tilføjes støj, drift og spring.
        //
        // CGM opdateres hvert 5. simulerede minut (som rigtige CGM-sensorer).
        // Resultatet clampes til 2.2-25.0 mmol/L (reelt sensorinterval).
        // =====================================================================
        if (this.totalSimMinutes - this.lastCgmCalculationTime >= 5) {
            // Interstitiel glukose fra Hovorkas C-kompartment (state[10]).
            // Denne værdi er allerede forsinket ift. plasma via ODE'en dC = ka_int*(G-C).
            const interstitialBG = this.hovorka.cgmValue;

            // Proportional random støj — skalerer med BG-niveau (kalibreret fra Libre 2 data).
            // Ved BG=5: std ≈ 0.15 mmol/L. Ved BG=10: std ≈ 0.30 mmol/L.
            // Bruger Box-Muller transform for normalfordelt støj (mere realistisk end uniform).
            const gaussianNoise = this.gaussRand(0, 1);
            const noiseStd = interstitialBG * this.cgmNoiseScale;
            const randomNoise = gaussianNoise * noiseStd;

            // Langsom sinusbølge-drift (sensor-karakteristik, periode 4-8 timer)
            let systemicDeviation = Math.sin(this.totalSimMinutes / this.cgmSystemicPeriod) * this.cgmSystemicAmplitude;

            // Diskontinuiteter — lejlighedsvise spring (kompression, kalibrering, sensor-fejl)
            // Ca. 0.7 per dag (~1 per 400 CGM-målinger). Typisk 2-3 mmol/L spring.
            let discontinuity = 0;
            if (Math.random() < this.cgmDiscontinuityChance) {
                discontinuity = (Math.random() - 0.5) * 4.0; // ±2 mmol/L spring
            }

            // Kombiner alle komponenter: interstitiel BG + støj + drift + spring
            this.cgmBG = interstitialBG + randomNoise + systemicDeviation + discontinuity;
            this.cgmBG = Math.max(2.2, Math.min(30.0, this.cgmBG)); // Sensor range limits (hævet fra 25 for bedre synlighed på grafen)
            this.lastCgmCalculationTime = this.totalSimMinutes;

            // Store data points for graph rendering and statistics
            cgmDataPoints.push({ time: this.totalSimMinutes, value: this.cgmBG });
            trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
            this.bgHistoryForStats.push({time: this.totalSimMinutes, cgmBG: this.cgmBG, trueBG: this.trueBG });

            // Daglig max points tracking — nulstilles ved dagsskifte
            if (this.day !== this.lastTrackedPointsDay) {
                this.dailyMaxPoints = 0;
                this.lastTrackedPointsDay = this.day;
            }
            // Keep history buffers from growing indefinitely
            if (cgmDataPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) cgmDataPoints.shift();
            if (trueBgPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) trueBgPoints.shift();
            if (this.bgHistoryForStats.length > (14 * MAX_GRAPH_POINTS_PER_DAY + 10)) this.bgHistoryForStats.shift();

            // Spil tick-lyd ved hvert CGM-update (hvert 5. sim-minut) for feedback
            playSound('tick');
        }

        // Clean up expired graph messages
        this.graphMessages = this.graphMessages.filter(msg => this.totalSimMinutes < msg.expireTime);

        // Anvend søvngæld fra natten når klokken passerer 07:00
        if (currentHour >= 7 && currentHour < 8) {
            this.applySleepDebt();
        }
        // Nulstil søvntab-tæller ved starten af ny nat (22:00)
        if (currentHour === 22 && this.lostSleepHoursTonight > 0 && this.sleepDebtAppliedForDay === this.day) {
            this.lostSleepHoursTonight = 0;
            this.lastNightAwakeningTime = -Infinity;
        }

        // =====================================================================
        // BASAL INSULIN REMINDER — Nudge for new players
        // =====================================================================
        // During the first 3 days, remind the player to take their basal insulin
        // if they haven't done so by morning (8:00-12:00). This teaches the
        // fundamental importance of basal insulin in T1D management.
        if (this.day <= 3 && currentHour >= 8 && currentHour < 12) {
            const startOfDay = (this.day - 1) * 24 * 60;
            const hasTakenBasalToday = this.logHistory.some(e => e.type === 'insulin-basal' && e.time >= startOfDay);
            const reminderId = `basal_reminder_day_${this.day}`;
            if (!hasTakenBasalToday) {
                // Vis reminder hvis den ikke allerede er oppe.
                // expireTime: udløb ved kl. 12:00 (slutningen af vinduet)
                const existingReminder = this.graphMessages.find(msg => msg.id === reminderId);
                if (!existingReminder) {
                    const minutesTilKl12 = (12 * 60) - this.timeInMinutes;
                    this.graphMessages.push({
                        id: reminderId,
                        text: t('graph.basalReminder'),
                        expireTime: this.totalSimMinutes + Math.max(60, minutesTilKl12)
                    });
                }
            } else {
                // Basal er taget — fjern eventuel reminder med det samme
                this.graphMessages = this.graphMessages.filter(msg => msg.id !== reminderId);
            }
        }

        // Run end-of-tick housekeeping
        this.updateNormoPoints(simulatedMinutesPassed);
        this.updateWeight();
        this.updateKetones(simulatedMinutesPassed);
        this.updateStats();
        this.checkGameOverConditions();
        this.updateGlucagonStatus();
        this.updateFingerprickStatus();
        this.updateKetoneTestStatus();
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
    // Asymmetrien afspejler at hypoglykæmi er akut farligt (kramper, besvimelse),
    // mens moderat hyperglykæmi (10-14) er skadeligt på sigt men ikke akut.
    // Baseret på International Consensus on TIR (Battelino 2019):
    //   TAR Level 1: 10.1-13.9 mmol/L — bør være <25% af tiden
    //   TAR Level 2: >13.9 mmol/L — bør være <5% af tiden
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

        // Hypo-fare lyd med hysterese:
        // Spilles når BG krydser NED under 4.5 (faldende).
        // Derefter IKKE igen før BG har været OVER 5.0 (hysterese-tærskel).
        // Dette forhindrer gentagne lyde når BG svæver omkring 4.5 i ligevægt.
        // Minimum cooldown 15 sim-min som ekstra sikkerhed mod spam.
        if (this.trueBG >= 5.0) {
            this.hypoWarnArmed = true;  // Reset — klar til næste advarsel
        }
        const bgFalling = this.trueBG < this.lastTrueBGForDropCheck;
        if (this.trueBG < 4.5 && bgFalling && this.hypoWarnArmed
            && this.totalSimMinutes - this.lastHypoWarnTime >= 15) {
            playSound('hypoWarn');
            this.lastHypoWarnTime = this.totalSimMinutes;
            this.hypoWarnArmed = false;  // Lås — kræver BG > 5.0 før næste
        }

        // In-range lyd: positiv lyd når BG kommer tilbage i grøn zone (4.0-10.0)
        // fra enten hypo (<4) eller hyper (>10). Spilles kun ved overgang ind.
        const inRangeNow = this.trueBG >= 4.0 && this.trueBG <= 10.0;
        if (inRangeNow && !this.isInRange) {
            playSound('inRange');
        }
        this.isInRange = inRangeNow;

        // Hyper-zone lyd: spilles når BG krydser over 10.0.
        // Mindre dramatisk end hypo — en kort "nedern" tone der signalerer
        // at spilleren er gået ud af målzonen opad.
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
            bgWeight = 0;         // Hypo (<4) eller høj hyper (>14): ingen points
        }

        // Accumulate points (converted from minutes to hours)
        this.normoPoints += (minutesPassed / 60) * bgWeight;

        // Update the UI display showing current point weight
        normoPointsWeighting.textContent = `(x${bgWeight.toFixed(1)})`;

        // Opdater visuelt feedback på points-badge baseret på weight
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
    // SØVNFORSTYRRELSE — Natlige interventioner koster søvn → stress næste dag
    // =========================================================================
    //
    // Når spilleren udfører en handling mellem 22:00 og 07:00, tæller det som
    // en vågen-hændelse der koster 1 times søvn. Hændelser inden for 30 min
    // af hinanden tæller som én vågenhed (man er allerede vågen).
    //
    // Søvntabet konverteres til kronisk stress om morgenen (kl. 07:00) via
    // applySleepDebt(). Dette øger insulinresistens og forstærker dawn-effekten
    // — præcis som i virkeligheden (Donga et al. 2010, Zheng et al. 2017).
    //
    // Fysiologisk grundlag:
    //   - Søvnafbrydelse → forhøjet kortisol + katekolaminer
    //   - Insulinfølsomhed falder ~20-30% efter dårlig søvn
    //   - Dawn-fænomenet forstærkes (kortisol + cirkadisk effekt adderes)
    //   - Effekten varer hele næste dag (t½ = 12 timer for chronicStressLevel)
    // =========================================================================
    handleNightIntervention() {
        const currentHour = Math.floor(this.timeInMinutes / 60);
        if (currentHour >= 22 || currentHour < 7) {
            // Tjek om dette er en NY vågenhed (> 30 min siden sidst)
            const timeSinceLastAwakening = this.totalSimMinutes - this.lastNightAwakeningTime;
            if (timeSinceLastAwakening > 30) {
                // Ny vågen-hændelse: kost 1 times søvn (max 4 timer pr. nat)
                const MAX_LOST_SLEEP = 4;
                if (this.lostSleepHoursTonight < MAX_LOST_SLEEP) {
                    // Varians: nogle nætter falder man hurtigt i søvn igen (0.5t tabt),
                    // andre ligger man længe vågen (1.5t). Mean 1.0, std 0.3.
                    const sleepLoss = Math.max(0.3, Math.min(1.8, this.gaussRand(1.0, 0.3)));
                    this.lostSleepHoursTonight = Math.min(MAX_LOST_SLEEP, this.lostSleepHoursTonight + sleepLoss);
                    logEvent(t('log.sleepDisruption', {hours: this.lostSleepHoursTonight.toFixed(1)}), 'event');
                    this.graphMessages.push({
                        id: `sleep_disruption_${this.totalSimMinutes}`,
                        text: t('graph.sleepLoss', {hours: this.lostSleepHoursTonight.toFixed(1)}),
                        expireTime: this.totalSimMinutes + 60 // Vis i 1 sim-time
                    });
                }
            }
            this.lastNightAwakeningTime = this.totalSimMinutes;
        }
    }

    // =========================================================================
    // applySleepDebt — Konverter nattens søvntab til kronisk stress om morgenen
    // =========================================================================
    //
    // Kaldes fra update() når klokken passerer 07:00. Konverterer akkumuleret
    // søvntab til chronicStressLevel og nulstiller tælleren.
    //
    // Konvertering: 0.06 chronicStress per mistet time søvn
    //   1t tabt → +0.06 stress → ~6% øget insulinresistens
    //   4t tabt → +0.24 stress → ~24% øget insulinresistens (max)
    //
    // chronicStressLevel har t½ = 12 sim-timer, så effekten aftager naturligt
    // gennem dagen og er næsten væk ved næste aften.
    // =========================================================================
    applySleepDebt() {
        if (this.lostSleepHoursTonight > 0 && this.sleepDebtAppliedForDay !== this.day) {
            const stressBoost = this.lostSleepHoursTonight * 0.06;
            this.chronicStressLevel = Math.min(1.0, this.chronicStressLevel + stressBoost);
            logEvent(t('log.sleepDebt', {hours: this.lostSleepHoursTonight, percent: (stressBoost * 100).toFixed(0)}), 'event');
            this.sleepDebtAppliedForDay = this.day;
            this.lostSleepHoursTonight = 0;
            this.lastNightAwakeningTime = -Infinity;
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
     * @param {number} protein - Grams of protein (raises BG via glucagon-driven HGP, delayed onset)
     * @param {number} fat     - Grams of fat (slows carb absorption via CCK/GLP-1, pizza effect)
     * @param {string} icon    - Emoji icon for the graph/log display (default: fork/knife)
     */
    addFood(carbs, protein, fat, icon = '🍴') {
        this.handleNightIntervention();
        const foodKcal = (carbs * 4) + (protein * 4) + (fat * 9); // Standard calorie calculation
        this.totalKcalConsumed += foodKcal;
        logEvent(t('log.food', {carbs, protein, fat}), 'food', {kcal: foodKcal, carbs, protein, icon});
        this.activeFood.push({ carbs, protein, fat, startTime: this.totalSimMinutes });
        // Fedt og protein tilføjes direkte til mave-kompartmenterne (blandes med eksisterende indhold)
        this.fatStomach += fat;
        this.proteinStomach += protein;
        playSound('eating');
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
        logEvent(t('log.fastInsulin', {dose}), 'insulin-fast', {dose});

        // -----------------------------------------------------------------
        // Randomiseret farmakokinetik — normalfordelt variation per injektion.
        //
        // Heinemann 2002 (review af subkutan insulinabsorption) rapporterer
        // intra-individuel CV ~20-30% for hurtigvirkende insulinanaloger.
        // CV = standardafvigelse / gennemsnit.
        //
        // Vi bruger Box-Muller normalfordeling (samme metode som CGM-støj)
        // og clamper til rimelige fysiologiske grænser.
        // -----------------------------------------------------------------

        // Bioavailability: andel af injiceret insulin der når blodbanen.
        // Resten nedbrydes lokalt af proteaser i det subkutane væv.
        // Gennemsnit ~78%, CV ~10% (Heinemann 2002, Kildegaard 2019).
        // Clamped til [0.55, 0.95] for fysiologisk realisme.
        const bioavailability = Math.max(0.55, Math.min(0.95,
            this.gaussRand(0.78, 0.08)));                                   // mean 78%, std 8%

        // Absorptionshastighed-variation: tau_I varierer fra gang til gang.
        // CV ~25% matcher Heinemann 2002's rapporterede intra-individuelle
        // variation. Årsager: injektionsdybde, lokalt blodflow, temperatur,
        // depot-størrelse, lipodystrofi.
        // Clamped til [0.50, 1.60] — ekstreme værdier er sjældne men mulige
        // (fx intramuskulær injektion = meget hurtigere, lipodystrofi = meget
        // langsommere).
        const tauFactor = Math.max(0.50, Math.min(1.60,
            this.gaussRand(1.0, 0.25)));                                    // mean 1.0, CV 25%

        this.activeFastInsulin.push({
            dose, injectionTime: this.totalSimMinutes,
            bioavailability, tauFactor
        });
        this.lastInsulinTime = this.totalSimMinutes;
        this.resetDKAState(); // Insulin given → DKA crisis averted
        playSound('insulinPen');
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
            logEvent(t('log.basalInsulin', {dose}), 'insulin-basal', {dose});
            this.basalReminderGivenForDay[this.day-1] = true;
            // Fjern basal-reminder fra grafen med det samme
            this.graphMessages = this.graphMessages.filter(msg =>
                !msg.id || !msg.id.startsWith('basal_reminder_day_'));
            playSound('insulinPen');
         }
         // Basal insulin variabilitet — normalfordelt ligesom bolus.
         // Basal har lidt højere bioavailability (~82%) fordi langsommere
         // absorption giver mindre lokal nedbrydning. CV lavere (~15%)
         // da basal-insuliner er designet til at være mere forudsigelige.
         // Varighed: mean 28t, std 3t (clamped 22-38t) for Lantus/Levemir.
         const bioavailability = Math.max(0.60, Math.min(0.95,
             this.gaussRand(0.82, 0.08)));                                   // mean 82%, std 8%
         const durationHours = Math.max(22, Math.min(38,
             this.gaussRand(28, 3)));                                        // mean 28t, std 3t
         this.activeLongInsulin.push({
             dose, injectionTime,
             totalDuration: durationHours * 60,
             bioavailability
         });
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
        // Responsen er gradueret — stærkere jo lavere BG er.
        //
        // Fysiologisk grundlag: Cryer 2013 beskriver tærskler for kontraregulering:
        //   Glukagon: ~3.8 mmol/L, Adrenalin: ~3.8 mmol/L, Kortisol: ~3.2 mmol/L
        //
        // Kontraregulering ved T1D:
        // T1D-patienter har SVÆKKET kontraregulering sammenlignet med raske:
        //   - Glukagon-respons: tabt inden 1-5 år (Bengtsen 2021)
        //   - Adrenalin-respons: bevaret men svækkes ved gentagne hypoer (HAAF)
        //   - Cap sat til 2.0 (vs. ~5.0 hos raske) for at afspejle dette
        //
        // counterRegFactor: reduceres kontinuert baseret på akkumuleret hypoArea.
        // Se updateHAAF() for detaljer.
        //
        // Klinisk betydning: Denne respons kan give "Somogyi rebound" —
        // BG stiger efter en hypoglykæmi-episode, især om natten.
        // Men ved massiv overdosis er responsen utilstrækkelig.
        if (this.trueBG < 4.0) {
            // Gradueret respons: stærkere jo lavere BG er.
            // T1D-patienter har kun adrenalin (glukagon tabt) — SVAG respons.
            //
            // VIGTIGT: Cap sat lavt (0.4) så kontraregulering IKKE kan redde
            // spilleren fra dårlige beslutninger. Pædagogisk pointe:
            // hypo ER farligt ved T1D, og spilleren skal lære at undgå det.
            //
            // Beregning af tid til cap (0.4):
            //   BG=3.5: 0.002 + 0.01*0.25 = 0.0045/min → 0.4 på ~89 min
            //   BG=3.0: 0.002 + 0.01*1.0  = 0.012/min  → 0.4 på ~33 min
            //   BG=2.0: 0.002 + 0.01*4.0  = 0.042/min  → 0.4 på ~10 min
            //
            // Med cap=0.4 og circadian=0: stressMultiplier max = 1.4 (dawn halveret → max ~1.55 med dawn)
            // Med aktiv insulin (x3≈1.3): EGP = EGP_0 × max(0, 1.4-1.3) = EGP_0 × 0.1
            // → Leveren kan næsten IKKE kompensere. Hypo er reelt farligt.
            const bgDeficit = 4.0 - this.trueBG;   // 0.0 ved BG=4, 2.0 ved BG=2
            const baseRate = 0.002 + 0.01 * bgDeficit * bgDeficit;
            // Reducer med counterRegFactor (HAAF — akkumuleret hypo-belastning)
            const hypoStressRate = baseRate * this.counterRegFactor;
            this.acuteStressLevel = Math.min(0.4, this.acuteStressLevel + hypoStressRate * simulatedMinutesPassed);
        }

        // Opdater HAAF (hypoArea akkumulering + recovery)
        this.updateHAAF(simulatedMinutesPassed);

        // --- Lever-glykogenreserve: depletion og recovery ---
        // Glykogenreserven udtømmes når akut stress driver glykogenolyse,
        // og ekstra hurtigt under motion (muskler forbruger også glykogen).
        // Recovery sker langsomt via gluconeogenese når BG er normalt.
        this.updateGlycogenReserve(simulatedMinutesPassed);

        // Clamp to zero to prevent floating-point drift below zero
        this.acuteStressLevel = Math.max(0, this.acuteStressLevel);
        this.chronicStressLevel = Math.max(0, this.chronicStressLevel);

        // Opdatér insulinresistens fra kronisk stress (fx søvnmangel).
        // chronicStressLevel ~0.5 → 25% øget insulinresistens.
        this.insulinResistanceFactor = 1.0 + this.chronicStressLevel * 0.5;
    }

    // =========================================================================
    // HYPOGLYKÆMI-UNAWARENESS (HAAF) — Kontinuert areal-baseret model
    // =========================================================================
    //
    // Modellerer HAAF som en balance mellem skade og recovery:
    //
    // SKADE: Når BG < 3.0 mmol/L akkumuleres hypoArea proportionelt med
    //   dybden under tærskel: ΔhypoArea = max(0, 3.0 - BG) × dt
    //   Tærskel 3.0 (ikke 3.5) fordi det er ved denne dybde at den
    //   neuronale adaptation primært sker (Cryer 2013).
    //
    // RECOVERY: hypoArea henfader eksponentielt med t½ = 3 sim-dage
    //   når BG er over 4.0 (hypo-fri). Dette modellerer den kliniske
    //   observation at 2-3 uger hypo-fri genopretter awareness
    //   (Dagogo-Jack 1993, Cranston 1994, Fanelli 1993).
    //
    // COUNTERREGFACTOR: Sigmoid mapping fra hypoArea:
    //   counterRegFactor = 0.3 + 0.7 × exp(-hypoArea / HAAF_DAMAGE_SCALE)
    //   Går fra 1.0 (frisk) mod 0.3 (svær HAAF) asymptotisk.
    //
    // Fordele ved denne model vs. diskret episode-tælling:
    //   - Proportionel: dyb hypo (BG=1.5) giver mere skade end mild (BG=2.8)
    //   - Kontinuert: ingen arbitrær "10 min"-tærskel for at tælle en episode
    //   - Reversibel: recovery sker gradvist så længe man undgår hypo
    //   - Realistisk: kort, mild hypo giver lille effekt; langvarig, dyb hypo
    //     giver stor, langvarig effekt
    //
    // Kilder: Dagogo-Jack 1993, Fanelli 1993, Cranston 1994,
    //         Cryer 2001/2013, Reno 2013, Rickels 2019
    // =========================================================================
    updateHAAF(simulatedMinutesPassed) {
        const HYPO_DAMAGE_THRESHOLD = 3.0; // mmol/L — under dette akkumuleres skade

        // --- SKADE: akkumuler hypoArea når BG er under tærskel ---
        if (this.trueBG < HYPO_DAMAGE_THRESHOLD) {
            const deficit = HYPO_DAMAGE_THRESHOLD - this.trueBG; // mmol/L under tærskel
            this.hypoArea += deficit * simulatedMinutesPassed;   // [mmol·min/L]
        }

        // --- RECOVERY: eksponentielt henfald af hypoArea når BG er ok ---
        // Recovery sker kun når BG > 4.0 (ingen aktiv hypo).
        // Under hypo (BG < 4.0) stopper recovery — kroppen kan ikke "reparere"
        // mens den stadig er under stress.
        if (this.trueBG >= 4.0 && this.hypoArea > 0) {
            const recoveryDecay = Math.log(2) / this.HAAF_RECOVERY_HALFLIFE;
            this.hypoArea *= Math.exp(-recoveryDecay * simulatedMinutesPassed);
            // Clamp til 0 for at undgå floating-point støv
            if (this.hypoArea < 0.01) this.hypoArea = 0;
        }

        // --- COUNTERREGFACTOR: sigmoid mapping fra hypoArea ---
        // 0.3 er gulv (svær HAAF — 70% reduktion, aldrig helt 0)
        // 0.7 er range (fra 0.3 til 1.0)
        // HAAF_DAMAGE_SCALE bestemmer hvor hurtigt vi når gulvet
        this.counterRegFactor = 0.3 + 0.7 * Math.exp(-this.hypoArea / this.HAAF_DAMAGE_SCALE);
    }

    // =========================================================================
    // LEVER-GLYKOGENPOOL — Massebalanceret model (gram)
    // =========================================================================
    //
    // Eksplicit pool der fyldes og tømmes. Glukose opstår ALDRIG fra ingenting —
    // al glykogenolyse-output trækkes fra poolen, og genopfyldning kræver
    // enten gluconeogenese (langsom) eller kulhydrat-absorption (hurtig).
    //
    // FORBRUG:
    //   1. Stress-drevet glykogenolyse (Somogyi/kontraregulering):
    //      Beregnes fra EGP-formlens stress-komponent:
    //      stressEGP = EGP_0 × acuteStressLevel [mmol/min] → omregnet til gram
    //      Ved stress=0.4, 70kg: 1.127 × 0.4 × 0.180 = 0.081 g/min ≈ 5 g/time
    //
    //   2. Motion-drevet forbrug (lever forsyner muskler via Cori-cyklus):
    //      Beregnes fra kcalPerMin × glycogenFraktion:
    //        - Lever-glycogen dækker ~25% af motions-energiforbruget via carbs
    //        - 1g glycogen ≈ 4 kcal
    //      Medium cardio (7 kcal/min): 7 × 0.25 / 4 = 0.44 g/min ≈ 26 g/time
    //      Høj cardio (10 kcal/min):   10 × 0.25 / 4 = 0.63 g/min ≈ 38 g/time
    //
    // GENOPFYLDNING:
    //   1. Gluconeogenese: konstant 0.10 g/min (6 g/time) — uafhængig af glykogen
    //      Substrat: aminosyrer, laktat, glycerol — altid tilgængelige.
    //
    //   2. Postprandial glycogensyntese: når BG > 5.0 mmol/L, lagrer leveren
    //      overskuds-glukose som glykogen. Rate proportional med BG-overskud:
    //        storageRate = 0.12 × (BG - 5.0) g/min
    //      Ved BG=8.0 (post-måltid): 0.36 g/min ≈ 22 g/time
    //      Gonzalez 2016: ~40-60g lever-glycogen genopfyldt efter stort måltid.
    //
    // EFFEKT PÅ STRESSMODELLEN:
    //   glycogenReserve = min(1.0, liverGlycogenGrams / GLYCOGEN_STRESS_THRESHOLD)
    //   → Under 15g: stress-drevet EGP aftager proportionelt
    //   → Ved 0g: stressEGP = 0, kun gluconeogenese-baseline (altid aktiv)
    //
    // Kilder: Roden 2001, Petersen 2004, Trefts 2015, Gonzalez 2016
    // =========================================================================
    updateGlycogenReserve(simulatedMinutesPassed) {
        const dt = simulatedMinutesPassed;

        // --- FORBRUG 1: Basal glycogenolysis (normalt EGP-bidrag) ---
        // I postabsorptiv tilstand kommer ~50% af leverens EGP fra glycogenolysis.
        // Denne rate er proportional med EGP_0 og uafhængig af stress.
        // For 70kg: 1.127 × 0.5 × 0.180 = 0.101 g/min ≈ 6 g/time.
        // NB: Kun aktiv når der ER glykogen. Ved tom pool: EGP falder til 50%.
        const basalGlycogenolysis_gPerMin = this.hovorka.EGP_0 * 0.5 * 0.180;

        // --- FORBRUG 2: Stress-drevet ekstra glykogenolyse ---
        // Akut stress (glukagon/adrenalin) driver YDERLIGERE glycogenolysis
        // udover den basale. Beregnet fra stress-niveauet.
        // Ved stress=0.4, 70kg: 1.127 × 0.4 × 0.180 = 0.081 g/min ≈ 5 g/time.
        const stressEGP_gPerMin = this.hovorka.EGP_0 * this.acuteStressLevel * 0.180;

        // --- FORBRUG 3: Motion-drevet leverglykogen-forbrug ---
        // Under motion forsyner leveren muskler med glukose via blodbanen.
        // Lever-glycogen dækker ~25% af energiforbruget via kulhydrater.
        // 1g glycogen ≈ 4 kcal.
        // Medium cardio (7 kcal/min): 7 × 0.25 / 4 = 0.44 g/min ≈ 26 g/time.
        let exerciseEGP_gPerMin = 0;
        if (this.activeAktivitet) {
            const kcalPerMin = this.activeAktivitet.kcalPerMin || 5;
            const liverGlycogenFraction = 0.25;
            exerciseEGP_gPerMin = kcalPerMin * liverGlycogenFraction / 4.0;
        }

        // Total forbrug fra glykogenpoolen [g/min]
        const totalConsumption = basalGlycogenolysis_gPerMin + stressEGP_gPerMin + exerciseEGP_gPerMin;

        // --- GENOPFYLDNING 1: Gluconeogenese (konstant baggrund) ---
        // Leveren syntetiserer glukose fra aminosyrer, laktat og glycerol.
        // ~50% af GNG-output leveres direkte til blodet (som EGP).
        // ~50% kan genlagres som glykogen (kun ved normal BG, dvs. intet underskud).
        // Netto-replenishment ≈ basal glycogenolysis i steady state → pool stabil.
        // Ved hypo (BG < 4.0): al GNG bruges til akut glukose-levering, ikke lagring.
        const gngReplenishment = (this.trueBG >= 4.0) ? basalGlycogenolysis_gPerMin : 0;

        // --- GENOPFYLDNING 2: Postprandial glycogensyntese ---
        // Når BG er forhøjet (efter mad), lagrer leveren overskuds-glukose.
        // Insulin fremmer glycogensyntese — her approksimeret via BG-niveau
        // (høj BG korrelerer med tilgængelig insulin post-prandialt).
        // Ved BG=8.0: 0.12 × 3.0 = 0.36 g/min ≈ 22 g/time.
        // Gonzalez 2016: ~40-60g lever-glycogen genopfyldt efter stort måltid.
        let postprandialStorage = 0;
        if (this.trueBG > 5.0 && this.liverGlycogenGrams < this.LIVER_GLYCOGEN_MAX) {
            const bgExcess = this.trueBG - 5.0;
            postprandialStorage = Math.min(1.0, 0.12 * bgExcess); // max 1 g/min
        }

        // --- MASSEBALANCE: opdater poolen ---
        const totalReplenishment = gngReplenishment + postprandialStorage;
        this.liverGlycogenGrams += (totalReplenishment - totalConsumption) * dt;

        // Clamp til [0, max]
        this.liverGlycogenGrams = Math.max(0, Math.min(this.LIVER_GLYCOGEN_MAX, this.liverGlycogenGrams));

        // --- AFLEDT: glycogenReserve for EGP-skalering ---
        // Lineær skalering: fuldt effektiv over tærskel, aftagende under.
        // glycogenReserve = 1.0 når liverGlycogenGrams ≥ 15g
        // glycogenReserve → 0.0 når liverGlycogenGrams → 0g
        // Påvirker BÅDE basal glycogenolysis-andelen (50%) og stress-EGP i stressMultiplier.
        this.glycogenReserve = Math.min(1.0, this.liverGlycogenGrams / this.GLYCOGEN_STRESS_THRESHOLD);
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
     * Capped at 0.4 to prevent runaway liver glucose production.
     *
     * @param {number} amount - Stress increment (0.0-0.4 scale)
     */
    addAcuteStress(amount) {
        this.acuteStressLevel = Math.min(0.4, this.acuteStressLevel + amount);
        logEvent(t('log.acuteStress', {amount: amount.toFixed(2)}), 'event');
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
        logEvent(t('log.chronicStress', {amount: amount.toFixed(2)}), 'event');
    }


    // =========================================================================
    // AKTIVITET — Start en aktivitetssession
    // =========================================================================
    //
    // Starter en aktivitet baseret på type (cardio/styrke/blandet/afslapning),
    // intensitet (Lav/Medium/Høj), og valgfri varighed (15/30/60/null=åben).
    //
    // Kun én aktivitet kan køre ad gangen. Aktiviteten påvirker BG gennem:
    //   - E1/E2 i Hovorka-modellen (skaleret efter aktivitetstype)
    //   - Stress-respons (katekolaminer ved styrke/blandet)
    //   - Stressreduktion (parasympatisk aktivering ved afslapning)
    //   - pulsFaktor (hurtigere insulinabsorption ved forhøjet puls)
    //
    // Post-exercise sensitivity boost:
    //   - Varighed: Høj=4×, Medium=2×, Lav=1× aktivitetens varighed
    //   - Magnitude: Høj=+100%, Medium=+75%, Lav=+50% bedre insulinfølsomhed
    //   - Fader lineært fra max til baseline over post-exercise perioden
    //
    // @param {string} type       - "cardio", "styrke", "blandet", "afslapning"
    // @param {string} intensitet - "Lav", "Medium", "Høj"
    // @param {number|null} varighed - Varighed i minutter (15/30/60), eller null=åben
    // =========================================================================
    startAktivitet(type, intensitet, varighed) {
        // Kan ikke starte ny aktivitet mens en kører
        if (this.activeAktivitet) return false;

        this.handleNightIntervention();

        const typeDef = AKTIVITETSTYPER[type];
        if (!typeDef) return false;

        const kcalPerMinute = typeDef.kcalPerMin[intensitet] || typeDef.kcalPerMin.Medium;

        this.activeAktivitet = {
            type,               // "cardio", "styrke", "blandet", "afslapning"
            intensitet,         // "Lav", "Medium", "Høj"
            startTime: this.totalSimMinutes,
            varighed,           // null = åben (kører til spilleren stopper)
            typeDef,            // Reference til AKTIVITETSTYPER[type]
            kcalPerMin: kcalPerMinute,
            kcalBurned: 0       // Akkumuleret under aktiviteten
        };

        // Estimeret kcal (kun for fast varighed — åben akkumulerer løbende)
        const estimatedKcal = varighed ? (kcalPerMinute * varighed) : 0;
        const actName = t(`activity.name.${type}`);
        const actIntensity = t(`activity.intensity.${intensitet === 'Lav' ? 'low' : intensitet === 'Høj' ? 'high' : 'medium'}`);
        const durationStr = varighed ? t('log.activity.duration.fixed', {min: varighed}) : t('log.activity.duration.open');
        const kcalStr = estimatedKcal ? t('log.activity.kcal', {kcal: estimatedKcal}) : '';
        logEvent(
            t('log.activityStart', {name: actName, intensity: actIntensity, duration: durationStr, kcal: kcalStr}),
            'motion',
            { type, intensity: intensitet, duration: varighed, kcalBurned: estimatedKcal, icon: typeDef.icon }
        );

        playSound('intervention', 'F4');
        return true;
    }

    // =========================================================================
    // STOP AKTIVITET — Afslut den aktive aktivitetssession
    // =========================================================================
    //
    // Beregner faktisk varighed og kalorieforbrænding.
    // Opretter en post-exercise sensitivity entry i activeMotion[]
    // (bruger eksisterende ISF-boost mekanik).
    // =========================================================================
    stopAktivitet() {
        if (!this.activeAktivitet) return;

        const akt = this.activeAktivitet;
        const actualDuration = this.totalSimMinutes - akt.startTime;

        // Registrér kalorieforbrænding (inkl. løbende akkumulerede kcal)
        this.totalKcalBurnedMotion += akt.kcalBurned;

        // Post-exercise insulin sensitivity boost (eksponentielt henfald)
        //
        // Halveringstid afhænger af intensitet:
        //   Lav: t½ = 180 min (3 timer) — let motion, kort boost
        //   Medium: t½ = 240 min (4 timer) — moderat motion, god boost
        //   Høj: t½ = 300 min (5 timer) — hård motion, lang boost
        //
        // maxSensIncrease bestemmer peak-boost lige efter motion:
        //   Lav: ×1.50 (50% bedre ISF)
        //   Medium: ×1.75 (75% bedre ISF)
        //   Høj: ×2.00 (100% bedre ISF)
        //
        // Skaleret med e2Scaling så afslapning (e2=0) ikke giver boost.
        //
        // Eksempel: 30 min medium cardio (e2=1.0):
        //   Peak: ISF ×1.75 → insulin virker 75% bedre lige efter
        //   t=2t: ×1.53 (−29%) — "hurtigt på vej op" ✓
        //   t=4t: ×1.375 (halveret)
        //   t=8t: ×1.19
        //   t=12t: ×1.09
        //   t=24t: ×1.01 — næsten væk
        //
        // Daglig motion: overlappende haler giver vedvarende lavere insulinbehov.
        // Stop med motion i 2 dage → al hale er væk → insulinbehov stiger markant.
        const e2Scale = akt.typeDef.e2Scaling;
        const halfLife = (akt.intensitet === "Høj" ? 300 : (akt.intensitet === "Medium" ? 240 : 180));
        const sensitivityHalfLife = halfLife * e2Scale;
        const baseSensIncrease = akt.intensitet === "Høj" ? 1.0 : (akt.intensitet === "Medium" ? 0.75 : 0.5);
        const maxSensIncrease = 1 + baseSensIncrease * e2Scale;

        // Cutoff: 7 halveringstider → boost < 0.8%, oprydning af gamle entries
        const sensitivityCutoffMinutes = sensitivityHalfLife * 7;

        // Tilføj til activeMotion for post-exercise ISF-boost
        if (sensitivityHalfLife > 0 && maxSensIncrease > 1.0) {
            this.activeMotion.push({
                intensity: akt.intensitet,
                startTime: akt.startTime,
                duration: actualDuration,
                sensitivityEndTime: this.totalSimMinutes + sensitivityCutoffMinutes,
                sensitivityHalfLife: sensitivityHalfLife,
                maxSensitivityIncreaseFactor: maxSensIncrease
            });
        }

        // Opdater det originale motion-event med faktisk varighed
        // (så aktivitetsbåndet i grafen viser den reelle varighed, ikke den planlagte)
        const originalEvent = this.logHistory.findLast(e => e.type === 'motion' && e.details && e.details.type === akt.type && e.time === akt.startTime);
        if (originalEvent) {
            originalEvent.details.duration = Math.round(actualDuration);
            originalEvent.details.kcalBurned = Math.round(akt.kcalBurned);
        }

        const endActName = t(`activity.name.${akt.type}`);
        const endActIntensity = t(`activity.intensity.${akt.intensitet === 'Lav' ? 'low' : akt.intensitet === 'Høj' ? 'high' : 'medium'}`);
        logEvent(
            t('log.activityEnd', {name: endActName, intensity: endActIntensity, duration: Math.round(actualDuration), kcal: Math.round(akt.kcalBurned)}),
            'motion-end',
            { type: akt.type, intensity: akt.intensitet, duration: Math.round(actualDuration), kcalBurned: Math.round(akt.kcalBurned), icon: akt.typeDef.icon }
        );

        this.activeAktivitet = null;
    }

    // Bagudkompatibel wrapper — bruges af eksisterende tests og evt. keyboard shortcuts
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
        // Cooldown-check: teststrimler er dyre og stikket gør ondt — 3 timers cooldown
        const cooldownMinutes = 3 * 60;
        if (this.totalSimMinutes - this.fingerprickUsedTime < cooldownMinutes) return;

        this.handleNightIntervention();
        const measuredBG = this.trueBG * (1 + (Math.random() * 0.1 - 0.05)); // ±5% error
        logEvent(t('log.fingerprick', {value: measuredBG.toFixed(1)}), 'fingerprick', {value: measuredBG.toFixed(1)});
        cgmDataPoints.push({ time: this.totalSimMinutes, value: measuredBG, type: 'fingerprick' });

        // Floating label over målepunktet på grafen (spil-agtigt feedback)
        const bgColor = measuredBG < 4.0 ? '#b91c1c' : measuredBG > 10.0 ? '#b91c1c' : '#38a169';
        this.floatingLabels.push({
            time: this.totalSimMinutes,
            value: measuredBG,
            text: `🩸 ${measuredBG.toFixed(1)}`,
            color: bgColor,
            createdAt: this.totalSimMinutes,
            duration: 90  // Synlig i 90 sim-minutter
        });
        playSound('intervention', 'B4');

        this.fingerprickUsedTime = this.totalSimMinutes;
        this.updateFingerprickStatus();
    }

    /**
     * updateFingerprickStatus — Aktivér/deaktivér fingerprik-knappen baseret på cooldown.
     *
     * Teststrimler koster ~8 kr/stk og stikket er ubehageligt. I virkeligheden
     * prikker man sig typisk 4-8 gange om dagen (hver 3. time).
     * Cooldown: 3 simulerede timer. Lagkage-animation viser resterende tid.
     */
    updateFingerprickStatus() {
        const cooldownMinutes = 3 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.fingerprickUsedTime;
        const onCooldown = timeSinceUsed < cooldownMinutes;
        this.fingerprickOnCooldown = onCooldown;

        const btn = document.getElementById('fingerprickButton');
        if (btn) {
            if (onCooldown) {
                btn.classList.add('on-cooldown');
                btn.style.pointerEvents = 'none';
                const pct = Math.min(100, (timeSinceUsed / cooldownMinutes) * 100);
                btn.style.setProperty('--cooldown-pct', pct.toFixed(1));
                // Vis resterende tid
                const remaining = cooldownMinutes - timeSinceUsed;
                const hours = Math.floor(remaining / 60);
                const mins = Math.floor(remaining % 60);
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = `${hours}t ${mins}m`;
            } else {
                btn.classList.remove('on-cooldown');
                btn.style.removeProperty('pointer-events');
                btn.style.removeProperty('--cooldown-pct');
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = t('kit.fingerprick');
            }
        }
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
        // Cooldown-check: keton-strimler er dyre (~20 kr) — 6 timers cooldown
        const cooldownMinutes = 6 * 60;
        if (this.totalSimMinutes - this.ketoneTestUsedTime < cooldownMinutes) return;

        this.handleNightIntervention();
        const measured = this.ketoneLevel * (1 + (Math.random() * 0.2 - 0.1)); // ±10% fejl
        const measuredClamped = Math.max(0, measured);

        // Bestem advarselsniveau baseret på målt ketonværdi
        // Kliniske grænseværdier for blod-ketoner (β-hydroxybutyrat):
        //   < 0.6: normal (også ved faste kan det stige til 0.5)
        //   0.6–1.5: let forhøjet — kan skyldes faste, keto-diæt, eller begyndende insulinmangel
        //   1.5–3.0: forhøjet — risiko for DKA hvis det skyldes insulinmangel
        //   > 3.0: høj — DKA sandsynlig hvis BG også er høj og der er insulinmangel
        // NB: Faste-ketose kan give 3-4 mmol/L uden fare — kontekst er vigtig!
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

        logEvent(t('log.ketoneTest', {value: measuredClamped.toFixed(1), status: statusShort}), 'ketone-test', { value: measuredClamped.toFixed(1) });

        // Floating label over CGM-positionen på grafen
        const popupColor = measuredClamped < 0.6 ? '#38a169' : measuredClamped < 1.5 ? '#d69e2e' : measuredClamped < 3.0 ? '#e67e22' : '#b91c1c';
        this.floatingLabels.push({
            time: this.totalSimMinutes,
            value: this.cgmBG,  // Vis ved CGM-niveauet (keton er ikke BG)
            text: `🧪 ${measuredClamped.toFixed(1)} ${statusShort}`,
            color: popupColor,
            createdAt: this.totalSimMinutes,
            duration: 120  // Synlig i 120 sim-minutter (lidt længere for keton)
        });
        playSound('intervention', 'B4');

        this.ketoneTestUsedTime = this.totalSimMinutes;
        this.updateKetoneTestStatus();
    }

    /**
     * updateKetoneTestStatus — Aktivér/deaktivér keton-stik-knappen baseret på cooldown.
     *
     * Keton-teststrimler koster ~20 kr/stk. I virkeligheden måler man kun ketoner
     * ved mistanke om insulinmangel (højt BG, kvalme, mavesmerter).
     * Cooldown: 6 simulerede timer. Lagkage-animation viser resterende tid.
     */
    updateKetoneTestStatus() {
        const cooldownMinutes = 6 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.ketoneTestUsedTime;
        const onCooldown = timeSinceUsed < cooldownMinutes;
        this.ketoneTestOnCooldown = onCooldown;

        const btn = document.getElementById('ketoneTestButton');
        if (btn) {
            if (onCooldown) {
                btn.classList.add('on-cooldown');
                btn.style.pointerEvents = 'none';
                const pct = Math.min(100, (timeSinceUsed / cooldownMinutes) * 100);
                btn.style.setProperty('--cooldown-pct', pct.toFixed(1));
                const remaining = cooldownMinutes - timeSinceUsed;
                const hours = Math.floor(remaining / 60);
                const mins = Math.floor(remaining % 60);
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = `${hours}t ${mins}m`;
            } else {
                btn.classList.remove('on-cooldown');
                btn.style.removeProperty('pointer-events');
                btn.style.removeProperty('--cooldown-pct');
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = t('kit.ketone');
            }
        }
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
        // Glukagon-knappen er nu i kit-panelet (kitGlucagonButton)
        const btn = document.getElementById('kitGlucagonButton');
        if (btn) {
            if (onCooldown) {
                btn.classList.add('on-cooldown');
                btn.style.pointerEvents = 'none';
                // Lagkage-progress: 0% = lige brugt (helt dækket), 100% = klar (helt synlig)
                const pct = Math.min(100, (timeSinceUsed / cooldownMinutes) * 100);
                btn.style.setProperty('--cooldown-pct', pct.toFixed(1));
                // Vis resterende cooldown-tid på knappen
                const remaining = cooldownMinutes - timeSinceUsed;
                const hours = Math.floor(remaining / 60);
                const mins = Math.floor(remaining % 60);
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = `${hours}t ${mins}m`;
            } else {
                btn.classList.remove('on-cooldown');
                btn.style.removeProperty('pointer-events');
                btn.style.removeProperty('--cooldown-pct');
                // Gendan label
                const nameEl = btn.querySelector('.pc-name');
                if (nameEl) nameEl.textContent = t('kit.glucagon');
            }
        }
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
        // Dobbelt-check cooldown (sikkerhed mod direkte kald)
        const cooldownMinutes = 24 * 60;
        if (this.totalSimMinutes - this.glucagonUsedTime < cooldownMinutes) return;
        this.handleNightIntervention();
        logEvent(t('log.glucagon'), 'glucagon');

        // Glucagon stimulerer leverens glykogenolyse → glukose dumpes i plasma.
        // Vi tilføjer glukose direkte til Hovorka-modellens Q1 (plasma-glukose)
        // i stedet for at sætte trueBG, da trueBG overskrides af modellen hvert tick.
        // Q1 er i mmol, så deltaBG (mmol/L) * V_G (L) = deltaQ1 (mmol).
        const deltaBG = 8 + Math.random() * 4; // +8 til +12 mmol/L
        const deltaQ1 = deltaBG * this.hovorka.V_G;
        this.hovorka.state[4] += deltaQ1;
        // Opdater trueBG fra modellen med det samme
        this.trueBG = this.hovorka.glucoseConcentration;

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

        // Opdater vægtændring-værdien i stats-tabellen
        const wcEl = document.getElementById('weightChangeValue');
        if (wcEl) {
            wcEl.textContent = this.weightChangeKg.toFixed(1);
            // Farvekodning: neutral=stabil, gul=advarsel (±2.5 kg), rød=fare (±4 kg), game over ved ±5 kg
            const abs = Math.abs(this.weightChangeKg);
            wcEl.style.color = abs > 4.0 ? '#b91c1c' : abs > 2.5 ? '#d69e2e' : '';
        }
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
        if (this.trueBG < 1.5) {
            this.gameOver(t('game.over.hypo.name'), {
                cause: t('game.over.hypo.cause', {bg: this.trueBG.toFixed(1)}),
                explanation: t('game.over.hypo.explanation'),
                tips: [
                    t('game.over.hypo.tip1'),
                    t('game.over.hypo.tip2'),
                    t('game.over.hypo.tip3'),
                    t('game.over.hypo.tip4')
                ]
            });
            return;
        }

        // Condition 2: Extreme weight change
        if (Math.abs(this.weightChangeKg) > 5.0) {
            this.gameOver(t('game.over.weight.name'), {
                cause: t('game.over.weight.cause', {weight: this.weightChangeKg.toFixed(1)}),
                explanation: t('game.over.weight.explanation'),
                tips: [
                    t('game.over.weight.tip1'),
                    t('game.over.weight.tip2'),
                    t('game.over.weight.tip3')
                ]
            });
            return;
        }

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
            // shouldPause = true (sidste parameter) → pauser spillet så spilleren kan læse advarslen
            showPopup(t('dka.warning.title'),
                t('dka.warning.message'),
                false, true, false, true);
        }
        // DKA Death: 12 hours after the warning (18 hours total)
        if (this.dkaGameOverTime !== -1 && this.totalSimMinutes >= this.dkaGameOverTime) {
            this.gameOver(t('game.over.dka.name'), {
                cause: t('game.over.dka.cause', {ketones: this.ketoneLevel.toFixed(1)}),
                explanation: t('game.over.dka.explanation'),
                tips: [
                    t('game.over.dka.tip1'),
                    t('game.over.dka.tip2'),
                    t('game.over.dka.tip3'),
                    t('game.over.dka.tip4')
                ]
            });
            return;
        }

        // Condition 4: Chronic complications (after 7 days of gameplay)
        // Matcher statistik-perioden der vises i UI (7-dages gennemsnit).
        if (this.day > 7) {
            const avg7d = this.calculateAverageBGForPeriod(7 * 24 * 60, true);
            if (avg7d !== null && avg7d > 15.0) {
                this.gameOver(t('game.over.complications.name'), {
                    cause: t('game.over.complications.cause', {avg: avg7d.toFixed(1)}),
                    explanation: t('game.over.complications.explanation'),
                    tips: [
                        t('game.over.complications.tip1'),
                        t('game.over.complications.tip2'),
                        t('game.over.complications.tip3'),
                        t('game.over.complications.tip4')
                    ]
                });
                return;
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
            { key: '7d', minutes: 7*24*60, displays: { tir: tir14dDisplay, titr: titr14dDisplay, avg: avgCgm14dDisplay, fast: fastInsulin7dDisplay, basal: basalInsulin7dDisplay, kcal: kcal7dDisplay }}
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
                const tirPct = (inRangeCount / dataPoints.length) * 100;
                const titrPct = (inTightRangeCount / dataPoints.length) * 100;
                const avgCgm = sumCgm / dataPoints.length;

                p.displays.tir.textContent = tirPct.toFixed(0);
                p.displays.titr.textContent = titrPct.toFixed(0);
                p.displays.avg.textContent = avgCgm.toFixed(1);

                // Farveindikation baseret på kliniske mål
                // TIR: grøn > 70%, orange 50-70%, rød < 50%
                p.displays.tir.style.color = tirPct >= 70 ? '#38a169' : tirPct >= 50 ? '#d69e2e' : '#b91c1c';
                // TITR: grøn > 50%, orange 30-50%, rød < 30%
                p.displays.titr.style.color = titrPct >= 50 ? '#38a169' : titrPct >= 30 ? '#d69e2e' : '#b91c1c';
                // Gns. CGM: grøn 5-8, orange 8-10 eller 4-5, rød > 10 eller < 4
                p.displays.avg.style.color = (avgCgm >= 5 && avgCgm <= 8) ? '#38a169' : (avgCgm >= 4 && avgCgm <= 10) ? '#d69e2e' : '#b91c1c';

                // Insulin- og kalorietotaler for perioden
                if (p.displays.fast) {
                    let totalFast = 0, totalBasal = 0, totalKcal = 0;
                    this.logHistory.filter(ev => ev.time >= (this.totalSimMinutes - p.minutes)).forEach(ev => {
                        if (ev.type === 'insulin-fast') totalFast += ev.details.dose;
                        if (ev.type === 'insulin-basal') totalBasal += ev.details.dose;
                        if (ev.type === 'food') totalKcal += ev.details.kcal;
                    });

                    // For 7d viser vi daglige gennemsnit, for 24h viser vi totaler
                    const periodMinutes = Math.min(this.totalSimMinutes, p.minutes);
                    const days = periodMinutes / (24 * 60);
                    const divisor = (p.key === '7d' && days >= 1) ? days : 1;

                    p.displays.fast.textContent = (totalFast / divisor).toFixed(1);
                    p.displays.basal.textContent = (totalBasal / divisor).toFixed(0);
                    p.displays.kcal.textContent = Math.round((totalKcal / divisor) / 10) * 10;

                    // Kaloriebalance: indtag minus forbrug (hvile + motion)
                    const restingBurn = this.restingKcalPerMinute * periodMinutes;
                    let motionBurn = 0;
                    this.logHistory.filter(ev => ev.time >= (this.totalSimMinutes - p.minutes) && ev.type === 'motion').forEach(ev => {
                        motionBurn += ev.details.kcalBurned || 0;
                    });
                    const balance = (totalKcal - restingBurn - motionBurn) / divisor;
                    // Afrund til nærmeste 10
                    const balanceRounded = Math.round(balance / 10) * 10;
                    const balanceDisplay = p.key === '7d' ? kcalBalance7dDisplay : kcalBalance24hDisplay;
                    if (balanceDisplay) {
                        balanceDisplay.textContent = (balanceRounded >= 0 ? '+' : '') + balanceRounded;
                        // Farvekodning: skaler tærsklerne med periodens andel af en fuld dag.
                        // Tidligt på dagen (fx kl. 04:00) er et underskud helt normalt — man
                        // har sovet og ikke spist. Fuld tærskel (±200 kcal) gælder kun
                        // efter en hel dag. For 7d-gennemsnit bruges fast tærskel.
                        const dayFraction = p.key === '7d' ? 1.0 : Math.min(1.0, periodMinutes / (24 * 60));
                        const threshold = 200 + 300 * (1 - dayFraction); // 500 tidligt → 200 efter fuld dag
                        balanceDisplay.style.color = balanceRounded < -threshold ? '#b91c1c' : balanceRounded > threshold ? '#d69e2e' : '#38a169';
                    }
                }
            } else {
                // Not enough data yet — show placeholder dashes
                Object.values(p.displays).forEach(el => { if(el) el.textContent = '--'; });
                if(p.displays.tir) p.displays.tir.textContent = '--';
                if(p.displays.titr) p.displays.titr.textContent = '--';
            }
        });
    }

    /**
     * gameOver — Afslut simulationen med en game over-skærm.
     *
     * Sætter isGameOver, pauser spillet, spiller lyd, og viser popup
     * med struktureret indhold: årsag → points → forklaring → tips.
     *
     * @param {string} cause     - Kort årsagsbeskrivelse (fx "Svær Hypoglykæmi")
     * @param {object} details   - { cause, explanation, tips[] }
     */
    gameOver(cause, details) {
        this.isGameOver = true; isPaused = true;
        playSound('gameOver');
        showGameOverPopup(cause, details, this.normoPoints);
    }
}
