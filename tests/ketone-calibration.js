// =============================================================================
// KETON-KALIBRERING — Standalone script til at validere ketonmodellens output
// =============================================================================
//
// Kører automatisk UDEN brugerinteraktion. Tester ketonmodellens opførsel
// under forskellige scenarier og rapporterer resultater med tidsserie.
//
// Kør med:  node tests/ketone-calibration.js
//
// Scenarier:
//   1. Faste med basal-insulin (BG clamped ~5.5) → keton-plateau
//   2. Ingen insulin (pumpesvigt) → tid til DKA game over
//   3. Høj-fedt kost (meget lav carb/protein) med insulin → keton 1-2
//   4. Profileffekt: ISF-variation → indirekte via basal-dosis
//
// Determinisme: insulin-variabilitet slås fra (bioavailability=1, tauFactor=1)
// så resultater er reproducerbare mellem kørsler.
//
// =============================================================================

// =============================================================================
// KONFIGURÉRBARE MÅL — Justér disse for at ændre hvad der tæller som "korrekt"
// =============================================================================
const TARGETS = {
    // Scenarie 1: Faste med basal-insulin → keton-plateau
    // Cahill 1970: 24t faste → BHB 0.5-1.5, 48-72t → BHB 2-4 mmol/L
    // T1D med basal insulin: partiel lipolyse-suppression → BHB 1-3 efter 24t
    fastingWithInsulin: {
        minBHB: 0.5,    // mmol/L — under dette er lipolysen for undertrykt
        maxBHB: 4.0,    // mmol/L — over dette nærmer vi os DKA-territorium
        duration: 24,    // timer faste-simulation
        description: 'Faste 24t med basal-insulin → starvation ketosis'
    },

    // Scenarie 2: Total insulinmangel → DKA → game over
    // Kitabchi 2009, Atkinson 2014: ubehandlet DKA → fatal efter 1-3 dage
    pumpFailureDKA: {
        minHoursToGameOver: 24,   // timer — hurtigere end dette er for aggressivt
        maxHoursToGameOver: 72,   // timer — langsommere er urealistisk
        description: 'Pumpesvigt (0 insulin) → DKA game over'
    },

    // Scenarie 3: Høj-fedt, lav-carb kost med insulin
    // Feinman 2015: nutritional ketosis → BHB 0.5-3.0 mmol/L
    highFatDiet: {
        minBHB: 0.5,     // mmol/L
        maxBHB: 3.0,     // mmol/L
        duration: 12,     // timer simulation
        description: 'Høj-fedt/lav-carb kost → nutritional ketosis'
    },

    // Scenarie 4: ISF-variation med profil-tilpasset basal
    // Højere basal (lav ISF) → højere plasmaI → lavere ketoner. Forventeligt.
    // Nogen forskel er uundgåelig da Hovorka-modellens dose→plasmaI er non-lineær.
    isfVariation: {
        maxDifference: 0.6, // mmol/L — tillader moderat forskel pga. non-lineær dosis-respons
        description: 'ISF-variation med korrekt basal → lignende ketoner'
    }
};

const { Simulator } = require('./harness.js');

// =============================================================================
// HJÆLPEFUNKTIONER
// =============================================================================

/**
 * Opret en frisk simulator med clean state og deterministisk insulin.
 * Monkey-patcher gaussRand til at returnere mean (ingen variabilitet).
 */
function createSimulator(profile = {}) {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.isPaused = false;

    const sim = new Simulator();

    // --- Determinisme: slå insulin-variabilitet fra ---
    // Overskriver gaussRand så bioavailability=mean, tauFactor=mean, duration=mean.
    // Dette gør resultater 100% reproducerbare.
    sim.gaussRand = function(mean, _std) { return mean; };

    // Overskrev profil-parametre hvis angivet
    if (profile.weight) sim.weight = profile.weight;
    if (profile.isf) sim.ISF = profile.isf;
    if (profile.icr) sim.ICR = profile.icr;

    // Sæt tid til middag (14:00) for at undgå dawn-effekt
    sim.totalSimMinutes = 14 * 60;
    sim.timeInMinutes = 14 * 60;

    // Reset tilstand
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;
    sim.hypoArea = 0.0;
    sim.counterRegFactor = 1.0;
    sim.isGameOver = false;
    sim.brainEnergyDeficit = 0.0;
    sim.acidosisLoad = 0.0;
    sim.ketoneLevel = 0.1;
    sim.ffaLipolysis = 0.0;

    sim.simulationSpeed = 60;
    return sim;
}

/**
 * Giv deterministisk basal-insulin.
 * addLongInsulin bruger gaussRand for variabilitet — allerede patched.
 */
function giveBasal(sim, dose, injectionTime) {
    sim.addLongInsulin(dose, injectionTime || sim.totalSimMinutes, true);
}

/**
 * Simulér et antal minutter. Returnerer tidsserie-data.
 * @param {Simulator} sim
 * @param {number} minutes - antal sim-minutter
 * @param {object} options - { clampBG, feedFat: { grams, intervalMin }, basalDose }
 */
function simulate(sim, minutes, options = {}) {
    const bhbHistory = [];
    const bgHistory = [];
    let gameOverMin = null;

    // Track hvornår basal sidst blev givet for automatisk re-dosering.
    let lastBasalTime = sim.totalSimMinutes;
    if (options.basalDose && sim.activeLongInsulin.length > 0) {
        lastBasalTime = Math.max(...sim.activeLongInsulin.map(b => b.injectionTime));
    }

    for (let i = 0; i < minutes; i++) {
        // Optionel BG-clamp (overskriver Hovorka hvert tick)
        if (options.clampBG !== undefined) {
            sim.trueBG = options.clampBG;
            sim.hovorka.state[4] = options.clampBG * sim.hovorka.V_G;
        }

        // Automatisk basal re-dosering hver 24. time
        if (options.basalDose && (sim.totalSimMinutes - lastBasalTime) >= 24 * 60) {
            giveBasal(sim, options.basalDose);
            lastBasalTime = sim.totalSimMinutes;
        }

        // Optionel periodisk fedt-indgivelse
        if (options.feedFat && i > 0 && i % options.feedFat.intervalMin === 0) {
            sim.addFood(0, 0, options.feedFat.grams);
        }

        sim.update(1.0);

        // Registrér data hvert 10. minut
        if (i % 10 === 0) {
            bhbHistory.push({
                min: i, bhb: sim.ketoneLevel,
                bg: sim.trueBG, plasmaI: sim.hovorka.plasmaInsulin,
                acidosis: sim.acidosisLoad
            });
        }

        if (sim.isGameOver && gameOverMin === null) {
            gameOverMin = i;
        }
    }

    return { bhbHistory, bgHistory, gameOverMin };
}

/**
 * Print en mini-tidsserie med BHB-udvikling (sparkline i terminalen).
 */
function printTimeseries(history, durationHours, label) {
    // Vælg ~8-10 datapunkter jævnt fordelt
    const step = Math.max(1, Math.floor(history.length / 8));
    const points = [];
    for (let i = 0; i < history.length; i += step) {
        points.push(history[i]);
    }
    // Altid tag det sidste punkt med
    const last = history[history.length - 1];
    if (points[points.length - 1] !== last) points.push(last);

    console.log(`  Tidsserie (${label}):`);
    console.log('  Time  │ BHB    │ PlasmaI │ Acidosis');
    console.log('  ──────┼────────┼─────────┼─────────');
    points.forEach(p => {
        const hours = (p.min / 60).toFixed(1).padStart(5);
        const bhb = p.bhb.toFixed(2).padStart(6);
        const insulin = p.plasmaI.toFixed(1).padStart(7);
        const acid = p.acidosis.toFixed(0).padStart(8);
        console.log(`  ${hours} │${bhb} │${insulin} │${acid}`);
    });
}

// =============================================================================
// SCENARIE 1: Faste med basal-insulin → keton-plateau
// =============================================================================
function scenario1_fastingWithInsulin() {
    const target = TARGETS.fastingWithInsulin;
    const hours = target.duration;
    const minutes = hours * 60;

    const sim = createSimulator();

    // Giv basal-insulin 6 timer før start (normal 20U Lantus)
    sim.activeLongInsulin = [];
    giveBasal(sim, 20, sim.totalSimMinutes - 6 * 60);

    // Stabilisér 2 timer (basal når steady-state i plasma)
    simulate(sim, 120, { clampBG: 5.5, basalDose: 20 });

    // Reset ketoner til udgangspunkt
    sim.ketoneLevel = 0.1;
    sim.ffaLipolysis = 0.0;

    // Kør faste-scenariet
    const result = simulate(sim, minutes, { clampBG: 5.5, basalDose: 20 });

    // Plateau = gennemsnit af sidste 2 timer
    const last2h = result.bhbHistory.filter(p => p.min >= (minutes - 120));
    const plateauBHB = last2h.reduce((s, p) => s + p.bhb, 0) / last2h.length;
    const plasmaI = sim.hovorka.plasmaInsulin;

    const pass = plateauBHB >= target.minBHB && plateauBHB <= target.maxBHB;

    return { result, plasmaI, plateauBHB, pass, target };
}

// =============================================================================
// SCENARIE 2: Total insulinmangel → DKA → game over
// =============================================================================
function scenario2_pumpFailure() {
    const target = TARGETS.pumpFailureDKA;
    const maxMinutes = 96 * 60;

    const sim = createSimulator();

    // Fjern AL insulin
    sim.activeLongInsulin = [];
    sim.activeFastInsulin = [];
    sim.hovorka.state[0] = 0; // S1
    sim.hovorka.state[1] = 0; // S2
    sim.hovorka.state[2] = 0; // S1 basal
    sim.hovorka.state[3] = 0; // S2 basal
    sim.hovorka.state[6] = 0; // Plasma insulin
    sim.hovorka.insulinRate = 0;

    sim.trueBG = 8.0;
    sim.hovorka.state[4] = 8.0 * sim.hovorka.V_G;

    const result = simulate(sim, maxMinutes);

    const gameOverHours = result.gameOverMin !== null ? result.gameOverMin / 60 : null;
    const peakBHB = Math.max(...result.bhbHistory.map(p => p.bhb));

    const pass = gameOverHours !== null &&
                 gameOverHours >= target.minHoursToGameOver &&
                 gameOverHours <= target.maxHoursToGameOver;

    return { result, gameOverHours, peakBHB, pass, target };
}

// =============================================================================
// SCENARIE 3: Høj-fedt kost med insulin → nutritional ketosis
// =============================================================================
function scenario3_highFatDiet() {
    const target = TARGETS.highFatDiet;
    const hours = target.duration;
    const minutes = hours * 60;

    const sim = createSimulator();

    sim.activeLongInsulin = [];
    giveBasal(sim, 20, sim.totalSimMinutes - 6 * 60);

    // Stabilisér
    simulate(sim, 60, { clampBG: 5.5, basalDose: 20 });

    sim.ketoneLevel = 0.1;
    sim.ffaLipolysis = 0.0;

    // 40g fedt hver 3. time = ~320g fedt/dag (ketogen kost)
    const result = simulate(sim, minutes, {
        feedFat: { grams: 40, intervalMin: 180 },
        clampBG: 5.5,
        basalDose: 20
    });

    const lastHour = result.bhbHistory.filter(p => p.min >= (minutes - 60));
    const finalBHB = lastHour.reduce((s, p) => s + p.bhb, 0) / lastHour.length;

    const pass = finalBHB >= target.minBHB && finalBHB <= target.maxBHB;

    return { result, finalBHB, pass, target };
}

// =============================================================================
// SCENARIE 4: ISF-variation med profil-tilpasset basal
// =============================================================================
function scenario4_isfVariation() {
    const target = TARGETS.isfVariation;
    const profiles = [
        { isf: 2.0, label: 'ISF=2.0 (insulinresistent)' },
        { isf: 3.0, label: 'ISF=3.0 (standard)' },
        { isf: 5.0, label: 'ISF=5.0 (insulinfølsom)' }
    ];

    const results = profiles.map(p => {
        const sim = createSimulator({ isf: p.isf });
        const basalDose = Math.round(100 / p.isf);

        sim.activeLongInsulin = [];
        giveBasal(sim, basalDose, sim.totalSimMinutes - 6 * 60);

        simulate(sim, 120, { clampBG: 5.5, basalDose });
        sim.ketoneLevel = 0.1;
        sim.ffaLipolysis = 0.0;

        const result = simulate(sim, 6 * 60, { clampBG: 5.5, basalDose });

        const last = result.bhbHistory.slice(-6);
        const bhb = last.reduce((s, p) => s + p.bhb, 0) / last.length;
        const plasmaI = sim.hovorka.plasmaInsulin;

        return { label: p.label, bhb, plasmaI, basalDose };
    });

    const bhbValues = results.map(r => r.bhb);
    const maxDiff = Math.max(...bhbValues) - Math.min(...bhbValues);
    const pass = maxDiff <= target.maxDifference;

    return { results, maxDiff, pass };
}

// =============================================================================
// RAPPORTERING
// =============================================================================
function run() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           KETON-KALIBRERING — Automatisk validering         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Vis aktuelle parametre
    const ref = createSimulator();
    console.log('Ketonmodel-parametre:');
    console.log(`  Lipolyse:  MAX=${ref.LIPOLYSIS_MAX}  EC50=${ref.LIPOLYSIS_EC50}mU/L  Hill=${ref.LIPOLYSIS_HILL_N}`);
    console.log(`  CPT-1:     EC50=${ref.CPT1_EC50}mU/L  Hill=${ref.CPT1_HILL_N}  MaxSupp=${ref.CPT1_MAX_SUPP}`);
    console.log(`  BHB:       Prod=${ref.BHB_PROD_RATE}  Vmax=${ref.BHB_VMAX}  Km=${ref.BHB_KM}  RenalThr=${ref.BHB_RENAL_THR}  RenalVmax=${ref.BHB_RENAL_VMAX}  RenalKm=${ref.BHB_RENAL_KM}`);
    console.log(`  FFA clear: t½=${ref.FFA_LIPO_CLEAR_HALF}min`);
    console.log(`  Acidosis:  Threshold=${ref.ACIDOSIS_THRESHOLD}  Base=${ref.ACIDOSIS_BASE_RATE}  Accel=${ref.ACIDOSIS_ACCEL_RATE}`);
    console.log('  (Deterministisk: gaussRand → mean, ingen insulin-variabilitet)');
    console.log('');

    let passed = 0;
    let failed = 0;

    // --- Scenarie 1 ---
    console.log('── Scenarie 1: ' + TARGETS.fastingWithInsulin.description + ' ──');
    const s1 = scenario1_fastingWithInsulin();
    printTimeseries(s1.result.bhbHistory, TARGETS.fastingWithInsulin.duration, 'faste');
    console.log(`  Plateau BHB: ${s1.plateauBHB.toFixed(2)} mmol/L  (mål: ${s1.target.minBHB}-${s1.target.maxBHB})`);
    console.log(`  Plasma-I:    ${s1.plasmaI.toFixed(1)} mU/L`);
    console.log(`  ${s1.pass ? '✅ PASS' : '❌ FAIL'}`);
    s1.pass ? passed++ : failed++;
    console.log('');

    // --- Scenarie 2 ---
    console.log('── Scenarie 2: ' + TARGETS.pumpFailureDKA.description + ' ──');
    const s2 = scenario2_pumpFailure();
    printTimeseries(s2.result.bhbHistory, 96, 'pumpesvigt');
    const goH = s2.gameOverHours !== null ? s2.gameOverHours.toFixed(1) : '>96';
    console.log(`  Game over:   ${goH} timer  (mål: ${s2.target.minHoursToGameOver}-${s2.target.maxHoursToGameOver}t)`);
    console.log(`  Peak BHB:    ${s2.peakBHB.toFixed(1)} mmol/L`);
    console.log(`  ${s2.pass ? '✅ PASS' : '❌ FAIL'}`);
    s2.pass ? passed++ : failed++;
    console.log('');

    // --- Scenarie 3 ---
    console.log('── Scenarie 3: ' + TARGETS.highFatDiet.description + ' ──');
    const s3 = scenario3_highFatDiet();
    printTimeseries(s3.result.bhbHistory, TARGETS.highFatDiet.duration, 'høj-fedt');
    console.log(`  BHB efter ${TARGETS.highFatDiet.duration}t: ${s3.finalBHB.toFixed(2)} mmol/L  (mål: ${s3.target.minBHB}-${s3.target.maxBHB})`);
    console.log(`  ${s3.pass ? '✅ PASS' : '❌ FAIL'}`);
    s3.pass ? passed++ : failed++;
    console.log('');

    // --- Scenarie 4 ---
    console.log('── Scenarie 4: ' + TARGETS.isfVariation.description + ' ──');
    const s4 = scenario4_isfVariation();
    s4.results.forEach(r => {
        console.log(`  ${r.label}: basal=${r.basalDose}U → plasmaI=${r.plasmaI.toFixed(1)}mU/L → BHB=${r.bhb.toFixed(2)}`);
    });
    console.log(`  Max forskel: ${s4.maxDiff.toFixed(3)} mmol/L  (mål: <${TARGETS.isfVariation.maxDifference})`);
    console.log(`  ${s4.pass ? '✅ PASS' : '❌ FAIL'}`);
    s4.pass ? passed++ : failed++;
    console.log('');

    // --- Sammenfatning ---
    console.log('════════════════════════════════════════');
    console.log(`Resultat: ${passed}/${passed + failed} scenarier bestået`);
    if (failed > 0) {
        console.log(`         ${failed} scenarie(r) FEJLET`);
        console.log('');
        console.log('Kalibreringstips:');
        if (!s1.pass) {
            const v = s1.plateauBHB;
            if (v < TARGETS.fastingWithInsulin.minBHB) {
                console.log('  S1: Ketoner for lave → hæv LIPOLYSIS_EC50, sænk LIPOLYSIS_HILL_N, eller sænk CPT1_MAX_SUPP');
            } else {
                console.log('  S1: Ketoner for høje → sænk LIPOLYSIS_EC50, hæv LIPOLYSIS_HILL_N');
            }
        }
        if (!s2.pass) {
            if (s2.gameOverHours === null || s2.gameOverHours > TARGETS.pumpFailureDKA.maxHoursToGameOver) {
                console.log('  S2: For langsomt → sænk ACIDOSIS_THRESHOLD, hæv BASE/ACCEL_RATE');
            } else {
                console.log('  S2: For hurtigt → hæv ACIDOSIS_THRESHOLD, sænk BASE/ACCEL_RATE');
            }
        }
        if (!s3.pass) {
            const v = s3.finalBHB;
            if (v < TARGETS.highFatDiet.minBHB) {
                console.log('  S3: Diæt-ketoner for lave → fedt→FFA pathway er for svag');
            } else {
                console.log('  S3: Diæt-ketoner for høje → fedt→FFA pathway er for stærk');
            }
        }
        if (!s4.pass) {
            console.log('  S4: ISF-variation giver for stor forskel → Hovorka basalToRate varierer insulin-niveauer');
        }
    }
    console.log('════════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
}

run();
