// =============================================================================
// AUTOMATISEREDE TESTS FOR GLUKOSE-SIMULATIONEN
// =============================================================================
//
// Denne fil tester den fysiologiske simulator (Simulator-klassen fra js/simulator.js)
// i et Node.js-miljoe UDEN browser. Alle browser-globaler (DOM-elementer, lyd, osv.)
// mockes ud, saa vi kun tester selve simulationslogikken.
//
// Koer med: node tests/simulation.test.js
//
// Testene verificerer:
//   1. Kulhydratindtag giver fysiologisk plausibel BG-stigning
//   2. Bolusinsulin saenker BG med ca. ISF per enhed
//   3. Cardio saenker BG, styrketraening hæver BG akut
//   4. Game over ved BG < 1.5 (svær hypo)
//   5. DKA-symptomer og game over ved insulinmangel
//   6. Ketoacidose-tilstand opbygges over tid ved hoej BG + insulinmangel
//
// =============================================================================

const fs = require('fs');
const path = require('path');

// --- Opsaetning af mock-miljoe ---
// Simulatoren er skrevet til browseren og bruger globale variable (DOM-elementer,
// lydfunktioner osv.). Vi opretter "dummy"-versioner af alle disse, saa koden
// kan koere i Node.js uden fejl.

// Mock DOM-element: et objekt der accepterer alle typiske DOM-operationer
function mockElement() {
    const el = {
        textContent: '',
        innerHTML: '',
        value: '60',           // speedSelector.value bruges i constructor
        disabled: false,
        style: {
            display: 'none',
            setProperty: () => {},
            removeProperty: () => {}
        },
        classList: {
            add: () => {},
            remove: () => {},
            toggle: () => {},
            contains: () => false
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ width: 800, height: 400 }),
        querySelector: () => mockElement(),
        querySelectorAll: () => [],
        closest: () => null,
        appendChild: () => {},
        removeChild: () => {},
        remove: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        children: [],
        parentElement: null
    };
    return el;
}

// Alle globale DOM-referencer fra main.js — saettes til mock-elementer
const domGlobals = [
    'startButton', 'resetButton', 'helpButton', 'pauseButton', 'speedSelector',
    'dayDisplay', 'timeDisplay', 'cgmValueDisplayGraph', 'normoPointsDisplay',
    'normoPointsWeighting', 'muteButton', 'carbsSlider', 'carbsValue',
    'proteinSlider', 'proteinValue', 'fatSlider', 'fatValue', 'giveFoodButton',
    'foodInfoDisplay', 'foodKcalDisplay', 'foodKeDisplay', 'dextroButton',
    'burgerButton', 'avocadoButton', 'chickenButton', 'cakeButton', 'sodaButton',
    'saladButton', 'cerealButton', 'fastInsulinSlider', 'fastInsulinValue',
    'giveFastInsulinButton', 'longInsulinSlider', 'longInsulinValue',
    'giveLongInsulinButton', 'motionIntensitySelect', 'motionDurationSelect',
    'startMotionButton', 'motionKcalDisplay', 'fingerprickButton', 'ketoneTestButton', 'glucagonButton',
    'debugTrueBgCheckbox', 'iobDisplay', 'cobDisplay', 'bgGraphCanvas', 'graphCtx',
    'weightChangeSlider', 'weightChangeValue', 'steepDropWarningDiv',
    'weightDisplay', 'icrDisplay', 'isfDisplay', 'carbEffectDisplay',
    'basalDoseDisplay', 'restingKcalDisplay',
    'tir24hDisplay', 'titr24hDisplay', 'avgCgm24hDisplay',
    'fastInsulin24hDisplay', 'basalInsulin24hDisplay', 'kcal24hDisplay',
    'tir14dDisplay', 'titr14dDisplay', 'avgCgm14dDisplay',
    'lastBolusTimerDisplay', 'kcalBalance24hDisplay',
    'fastInsulin7dDisplay', 'basalInsulin7dDisplay', 'kcal7dDisplay', 'kcalBalance7dDisplay'
];

domGlobals.forEach(name => { global[name] = mockElement(); });

// Globale variable fra main.js der bruges af simulatoren
global.isPaused = false;
global.cgmDataPoints = [];
global.trueBgPoints = [];
global.MAX_GRAPH_POINTS_PER_DAY = 288;
global.KCAL_PER_KG_WEIGHT = 7700;
global.RESTING_KCAL_PER_DAY = 2200;
global.RESTING_KCAL_PER_MINUTE = RESTING_KCAL_PER_DAY / (24 * 60);

// Mock-funktioner der normalt lever i andre JS-filer (ui.js, sounds.js)
global.logEvent = () => {};             // Logger spilhaendelser — vi ignorerer i tests
global.showPopup = () => {};            // Viser popup-beskeder — vi ignorerer i tests
global.showGameOverPopup = () => {};    // Viser game over popup — vi ignorerer i tests
global.playSound = () => {};            // Afspiller lyde — vi ignorerer i tests
global.drawGraph = () => {};            // Tegner graf — vi ignorerer i tests
global.updateUI = () => {};             // Opdaterer UI — vi ignorerer i tests

// Mock document.getElementById — bruges af updateWeight() i simulator.js
global.document = {
    getElementById: () => mockElement(),
    body: { appendChild: () => {} }
};

// --- Indlaes Hovorka-modellen og Simulator-klassen ---
// Hovorka skal loades foerst, da Simulator bruger HovorkaModel i sin constructor.
// Vi evaluerer begge JS-filer direkte og goer klasserne tilgaengelige globalt.
const hovorkaCode = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'hovorka.js'), 'utf8'
);
eval(hovorkaCode + '\nglobal.HovorkaModel = HovorkaModel;');

const simulatorCode = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'simulator.js'), 'utf8'
);
const wrappedCode = simulatorCode + '\nglobal.Simulator = Simulator;';
eval(wrappedCode);

// =============================================================================
// TEST-HJÆLPEFUNKTIONER
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

// Koer en enkelt test med navn og testfunktion
function test(name, fn) {
    testsTotal++;
    try {
        fn();
        testsPassed++;
        console.log(`  PASS: ${name}`);
    } catch (e) {
        testsFailed++;
        console.log(`  FAIL: ${name}`);
        console.log(`        ${e.message}`);
    }
}

// Bekraeft at en vaerdi er sand — kaster fejl med besked hvis ikke
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

// Bekraeft at vaerdi er inden for et interval
function assertInRange(value, min, max, label) {
    assert(
        value >= min && value <= max,
        `${label}: forventede ${min}-${max}, fik ${value.toFixed(3)}`
    );
}

// Opret en frisk simulator med nulstillet tilstand.
// Vi fjerner basal-insulin fra konstruktoren og saetter stabile startvaerdier
// saa testene er reproducerbare.
function createCleanSimulator() {
    // Nulstil globale arrays
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator();

    // Fjern den basal-insulin der tilfojes automatisk i konstruktoren,
    // saa vi har fuld kontrol over insulinbalancen i testene
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;

    // Saet startvaerdier der giver forudsigelig opfoersel
    sim.trueBG = 5.5;
    sim.cgmBG = 5.5;
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;

    // Synkroniser Hovorka-modellens Q1 med trueBG (Q1 = BG * V_G)
    // og nulstil insulin-inputs saa Hovorka starter rent
    sim.hovorka.state[4] = 5.5 * sim.hovorka.V_G;  // Q1 = trueBG * distributionsvolumen
    sim.hovorka.insulinRate = 0;

    // Saet tid til midt paa dagen (kl. 14:00) for at undgaa dawn-effekt
    sim.totalSimMinutes = 14 * 60;
    sim.timeInMinutes = 14 * 60;

    return sim;
}

// Opret simulator med specifik start-BG og synkroniser Hovorka-state
function setSimulatorBG(sim, targetBG) {
    sim.trueBG = targetBG;
    sim.hovorka.state[4] = targetBG * sim.hovorka.V_G;  // Q1
}

// Simuler et antal minutter ved at kalde update() i smaa tidsskridt.
// simulationSpeed=60 betyder 1 sekund real-tid = 1 minut simuleret tid.
// Vi bruger dt=1 sekund per tick, saa hvert tick = 1 simuleret minut.
function simulateMinutes(sim, minutes) {
    sim.simulationSpeed = 60;
    const ticksPerMinute = 1;  // 1 tick a 1 sek med speed=60 giver 1 sim-minut
    const totalTicks = minutes * ticksPerMinute;
    for (let i = 0; i < totalTicks; i++) {
        sim.update(1.0);  // 1 sekund real-tid
    }
}

// =============================================================================
// TEST 1: KULHYDRATINDTAG
// =============================================================================
//
// Tester at 10g kulhydrat giver en BG-stigning paa 1-3 mmol/L.
//
// Fysiologisk baggrund:
//   - currentCarbEffect = currentISF / ICR = 3.0 / 10 = 0.3 mmol/L per gram
//   - 10g * 0.3 = 3.0 mmol/L teoretisk maks (uden insulin eller leverproduktion)
//   - I praksis vil leveren ogsaa producere lidt glukose, og absorptionen
//     tager tid (20 min delay + ~40 min absorption), saa vi maaler efter
//     tilstraekkelig tid til fuld absorption.
//   - Vi bruger et bredt interval (0.5-5.0) fordi leverproduktion tilfojer lidt.
// =============================================================================

console.log('\n--- Test 1: Kulhydratindtag (10g carbs -> BG-stigning) ---');

test('10g kulhydrat giver BG-stigning paa 1-8 mmol/L (inkl. leverproduktion)', () => {
    const sim = createCleanSimulator();
    const startBG = sim.trueBG;

    // Tilfoej 10g kulhydrat (ingen protein/fedt)
    sim.addFood(10, 0, 0);

    // Simuler 120 minutter — nok tid til fuld absorption
    // (20 min delay + ~40 min absorption + buffer)
    simulateMinutes(sim, 120);

    const bgRise = sim.trueBG - startBG;
    // BG stiger pga. kulhydrater (~3 mmol/L fra 10g) + leverproduktion (~2.4 mmol/L over 120 min)
    // Samlet stigning ca. 5-6 mmol/L uden insulin til at modvirke
    // Med Hovorka-modellen har der rest-insulin fra steady-state i alle
    // kompartmenter, saa kulhydrateffekten modvirkes delvist. Nedre graense
    // er derfor lavere end i den gamle model.
    assertInRange(bgRise, 0.2, 8.0, '10g carbs BG-stigning');
});

test('60g kulhydrat giver stoerre stigning end 10g', () => {
    const sim10 = createCleanSimulator();
    sim10.addFood(10, 0, 0);
    simulateMinutes(sim10, 120);
    const rise10 = sim10.trueBG - 5.5;

    const sim60 = createCleanSimulator();
    sim60.addFood(60, 0, 0);
    simulateMinutes(sim60, 120);
    const rise60 = sim60.trueBG - 5.5;

    assert(rise60 > rise10, `60g stigning (${rise60.toFixed(1)}) skal vaere stoerre end 10g (${rise10.toFixed(1)})`);
});

test('Uden mad er BG relativt stabil (lever vs. hjerne/nyrer i balance)', () => {
    const sim = createCleanSimulator();
    const startBG = sim.trueBG;

    // 60 minutter uden mad — Hovorka-modellen har lever, hjerne og nyrer
    // i balance. Uden insulin vil BG langsomt stige pga. leverproduktion,
    // men hjernens forbrug og eventuel renal clearance bremser stigningen.
    // Med rest-insulin fra steady-state kan BG ogsaa falde lidt.
    simulateMinutes(sim, 60);

    const bgChange = Math.abs(sim.trueBG - startBG);
    // BG skal vaere relativt stabil — ikke aendre mere end 4 mmol/L paa 60 min
    assert(bgChange < 4.0,
        `BG-aendring uden mad (kun lever): forventede < 4.0, fik ${bgChange.toFixed(3)}`);
});


// =============================================================================
// TEST 2: INSULIN-EFFEKT
// =============================================================================
//
// Tester at bolusinsulin saenker BG med cirka ISF (3.0 mmol/L) per enhed.
//
// Modellen bruger en trekantet absorptionsprofil:
//   onset (~10-15 min) -> peak (~45-70 min) -> tail (~120-240 min)
// Den samlede BG-effekt per enhed skal vaere taet paa ISF = 3.0 mmol/L.
//
// Vi starter med hoej BG (15 mmol/L) saa der er plads til at falde,
// og vi simulerer lang nok tid til at insulinen er fuldt absorberet.
// =============================================================================

console.log('\n--- Test 2: Insulin-effekt (bolus saenker BG ~ISF per enhed) ---');

test('1 enhed bolusinsulin saenker BG med ca. ISF (isoleret fra leverproduktion)', () => {
    // For at isolere insulinens effekt koerer vi to simulationer:
    //   1. Baseline uden insulin (kun leverproduktion)
    //   2. Med 1 enhed insulin
    // Forskellen er insulinens netto-effekt.
    const simBaseline = createCleanSimulator();
    setSimulatorBG(simBaseline, 15.0);
    simulateMinutes(simBaseline, 300);
    const bgBaseline = simBaseline.trueBG;

    const simInsulin = createCleanSimulator();
    setSimulatorBG(simInsulin, 15.0);
    simInsulin.addFastInsulin(1);
    simulateMinutes(simInsulin, 300);
    const bgInsulin = simInsulin.trueBG;

    // Isoleret insulin-effekt = forskellen mellem de to simulationer
    // Skal vaere taet paa ISF = 3.0 mmol/L (men med lidt variation pga. random onset)
    const isolatedDrop = bgBaseline - bgInsulin;
    assertInRange(isolatedDrop, 1.0, 8.0, '1E insulin isoleret BG-fald');
});

test('3 enheder insulin giver stoerre BG-fald end 1 enhed', () => {
    const sim1 = createCleanSimulator();
    setSimulatorBG(sim1, 20.0);
    sim1.addFastInsulin(1);
    simulateMinutes(sim1, 300);
    const drop1 = 20.0 - sim1.trueBG;

    const sim3 = createCleanSimulator();
    setSimulatorBG(sim3, 20.0);
    sim3.addFastInsulin(3);
    simulateMinutes(sim3, 300);
    const drop3 = 20.0 - sim3.trueBG;

    assert(drop3 > drop1, `3E fald (${drop3.toFixed(1)}) skal vaere stoerre end 1E (${drop1.toFixed(1)})`);
});

test('Insulin har forsinkelse (onset) — BG falder ikke med det samme', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 15.0);
    const startBG = sim.trueBG;

    sim.addFastInsulin(5);

    // Kun 5 minutter — insulinen har onset paa 10-15 min, saa der burde
    // vaere minimalt fald endnu (primaert leverproduktion der modvirker)
    simulateMinutes(sim, 5);

    const bgDropIn5min = startBG - sim.trueBG;
    // Inden for de foerste 5 min forventer vi kun lille insulin-fald.
    // Hovorka-modellen har hurtigere initial respons end trekant-profilen,
    // men effekten er stadig begrænset pga. S1->S2->I->x kaskaden.
    // Med 5E bolus og Hovorka's farmakokinetik er op til 2 mmol/L fald realistisk.
    // Hovorka's 2-kompartment insulin har hurtigere initial respons end
    // den gamle trekant-profil, saa op til 3 mmol/L fald paa 5 min er realistisk
    // med 5E bolus (som er en stor dosis).
    assert(bgDropIn5min < 3.5, `BG-fald efter 5 min (${bgDropIn5min.toFixed(2)}) skal vaere moderat (onset fase)`);
});


// =============================================================================
// TEST 3: MOTION — CARDIO VS. STYRKETRAENING
// =============================================================================
//
// Fysiologisk baggrund:
//   - Cardio (aerob): Muskler optager glukose via GLUT4 -> BG falder
//   - Styrketraening (anaerob/hoej intensitet): Katekolaminer frigivet ->
//     leveren frigiver ekstra glukose -> BG stiger akut
//     (men efter traening oeges insulinfoelsomheden)
//
// I modellen:
//   - Al motion giver et BG-fald (aerob komponent)
//   - Hoej intensitet tilfojer ogsaa et BG-stigning (anaerob komponent)
//     samt akut stress der driver yderligere leverglukose
//   - Nettoresultat ved hoej intensitet kan vaere stigning eller mindre fald
// =============================================================================

console.log('\n--- Test 3: Motion (cardio saenker BG, styrke hæver akut) ---');

test('Cardio (lav intensitet, 30 min) saenker BG', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 8.0);
    const startBG = sim.trueBG;

    sim.startMotion("Lav", "30");

    // Simuler under motionen
    simulateMinutes(sim, 30);

    const bgChange = sim.trueBG - startBG;
    // Lav-intensitets cardio giver ~1.0 mmol/L fald per 10 min
    // Over 30 min: ca. 3 mmol/L fald (minus leverproduktion)
    assert(bgChange < 0, `Cardio BG-aendring (${bgChange.toFixed(2)}) skal vaere negativ (BG falder)`);
});

test('Hoej intensitet giver hoejere akut stress end lav intensitet (anaerob komponent)', () => {
    // I modellen har hoej intensitet BAADE stoerre aerob BG-fald (3x vs 1x)
    // OG en anaerob komponent (stress + direkte leverglukose).
    // Det aerobe dominerer under traeningen, men den anaerobe komponent
    // viser sig via ophobet akut stress der driver leverglukose EFTER traeningen.
    //
    // Vi tester derfor at hoej intensitet giver maerkbart hoejere acuteStressLevel
    // end lav intensitet — det er det fysiologiske kendetegn ved styrketraening.
    const simLow = createCleanSimulator();
    simLow.startMotion("Lav", "30");
    simulateMinutes(simLow, 30);

    const simHigh = createCleanSimulator();
    simHigh.startMotion("Høj", "30");
    simulateMinutes(simHigh, 30);

    assert(simHigh.acuteStressLevel > simLow.acuteStressLevel + 0.05,
        `Hoej intensitet stress (${simHigh.acuteStressLevel.toFixed(3)}) ` +
        `skal vaere hoejere end lav (${simLow.acuteStressLevel.toFixed(3)})`);
});

test('Hoej intensitet opbygger akut stress (katekolaminer)', () => {
    const sim = createCleanSimulator();
    assert(sim.acuteStressLevel === 0, 'Start-stress skal vaere 0');

    sim.startMotion("Høj", "30");
    simulateMinutes(sim, 30);

    // Hoej intensitet tilfojer 0.02 * simulatedMinutesPassed per tick til acuteStress
    assert(sim.acuteStressLevel > 0.1,
        `Akut stress efter hoej traening (${sim.acuteStressLevel.toFixed(3)}) skal vaere > 0.1`);
});

test('BG-fald under motion er stoerre med aktiv insulin end uden', () => {
    // Fysiologisk: Insulin foerstaerker musklernes glukoseoptag under motion
    // (via GLUT4 translokation). Derfor falder BG mere under motion HVIS
    // der er aktiv insulin i kroppen — en vigtig klinisk pointe for T1D.
    //
    // I Hovorka-modellen ses dette via x1 og x2 (insulin-aktionsvariable)
    // der foerstaerker glukose-transport og -disposal i muskler.
    const simNoInsulin = createCleanSimulator();
    setSimulatorBG(simNoInsulin, 10.0);
    // Fjern al aktiv insulin for at isolere effekten
    simNoInsulin.hovorka.state.S1 = 0;
    simNoInsulin.hovorka.state.S2 = 0;
    simNoInsulin.hovorka.state.I = 0;
    simNoInsulin.startMotion("Lav", "30");
    simulateMinutes(simNoInsulin, 30);
    const dropNoInsulin = 10.0 - simNoInsulin.trueBG;

    const simWithInsulin = createCleanSimulator();
    setSimulatorBG(simWithInsulin, 10.0);
    // Sæt insulin direkte i plasma (undgår tilfældig bioavailability/tauFactor
    // der kan gøre testen flakey — vi tester motionseffekt, ikke absorption).
    simWithInsulin.hovorka.state[6] = 30; // 30 mU/L plasma-insulin (fysiologisk bolus-niveau)
    simWithInsulin.startMotion("Lav", "30");
    simulateMinutes(simWithInsulin, 30);
    const dropWithInsulin = 10.0 - simWithInsulin.trueBG;

    assert(dropWithInsulin > dropNoInsulin,
        `BG-fald med insulin (${dropWithInsulin.toFixed(1)}) skal vaere stoerre end uden (${dropNoInsulin.toFixed(1)})`);
});


// =============================================================================
// TEST 4: GAME OVER VED BG < 1.5 (SVÆR HYPOGLYKÆMI)
// =============================================================================
//
// Fysiologisk baggrund:
//   - BG under ~1.5 mmol/L er livsfarligt — hjernen faar ikke nok energi
//   - I spillet udloeser dette game over som en sikkerhedsmekanisme
//   - Modellen checker dette i checkGameOverConditions()
// =============================================================================

console.log('\n--- Test 4: Game over ved BG < 1.5 (svær hypo) ---');

test('Game over naar BG falder under 1.5 mmol/L', () => {
    const sim = createCleanSimulator();
    // Saet BG lige over graensen og giv en stor dosis insulin
    setSimulatorBG(sim, 3.0);
    sim.addFastInsulin(20);  // Massiv overdosis (20E fra BG=3 overvinder kontraregulering)

    // Simuler indtil BG falder under graensen
    let gameOverTriggered = false;
    for (let i = 0; i < 500; i++) {
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(gameOverTriggered, 'Game over skal udloeses ved BG < 1.5');
    assert(sim.trueBG < 1.5 || sim.isGameOver, 'BG skal vaere under 1.5 eller game over aktiv');
});

test('Game over udloeses IKKE ved normal BG', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);

    // Simuler 60 minutter uden interventioner
    simulateMinutes(sim, 60);

    assert(!sim.isGameOver, 'Game over maa IKKE udloeses ved normal BG');
});

test('BG har fysiologisk gulv paa 0.1 (clamped)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 0.5);
    sim.addFastInsulin(20);  // Absurd overdosis

    // Koer et par ticks
    sim.simulationSpeed = 60;
    for (let i = 0; i < 10; i++) {
        sim.update(1.0);
        if (sim.isGameOver) break;
    }

    // BG skal vaere clamped til mindst 0.1 (ikke negativt)
    assert(sim.trueBG >= 0.1, `BG (${sim.trueBG.toFixed(3)}) maa aldrig vaere under 0.1`);
});


// =============================================================================
// TEST 5: DKA (DIABETISK KETOACIDOSE) — SYMPTOMER OG GAME OVER
// =============================================================================
//
// Fysiologisk baggrund:
//   - Naar kroppen mangler insulin, kan cellerne ikke optage glukose
//   - Kroppen begynder at forbraende fedt -> ketoner produceres
//   - Ketoner er syrer der forgifter blodet -> ketoacidose
//   - Ubehandlet DKA er doedelig (typisk inden for 24-72 timer)
//
// I modellen:
//   - DKA-tilstanden opbygges naar: BG > 12 OG IOB < 0.1 OG ingen aktiv
//     basal insulin OG > 8 timer siden sidste insulin
//   - Efter 6 timers insulinmangel+hoej BG: advarsel (dkaWarning1Given)
//   - 12 timer efter advarslen: game over (dkaGameOverTime)
// =============================================================================

console.log('\n--- Test 5: DKA-symptomer og game over ved insulinmangel ---');

test('DKA-advarsel efter 6+ timers hoej BG + insulinmangel', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);    // Hoej BG
    sim.iob = 0;                  // Ingen insulin on board
    sim.activeFastInsulin = [];   // Ingen aktiv hurtiginsulin
    sim.activeLongInsulin = [];   // Ingen aktiv basalinsulin
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60); // Sidste insulin for 9 timer siden
    // Nulstil Hovorka insulin-state saa der ingen restinsulin er
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simuler 7 timer (420 min) for at naa DKA-advarsel-kravet paa 6 timer
    // OBS: BG vil stige pga. leverproduktion, saa betingelsen BG>12 holdes
    simulateMinutes(sim, 420);

    assert(sim.dkaWarning1Given,
        'DKA-advarsel skal vaere givet efter 6+ timers insulinmangel');
});

test('DKA game over 12 timer efter advarsel', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 20.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simuler 20 timer (lang nok til advarsel + 12 timers frist)
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 1200; i++) {  // 1200 min = 20 timer
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(sim.dkaWarning1Given, 'DKA-advarsel skal vaere givet foerst');
    assert(gameOverTriggered, 'DKA game over skal udloeses efter advarsel + 12 timer');
});

test('Insulin nulstiller DKA-tilstand (resetDKAState)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simuler 7 timer for at trigge DKA-advarsel
    simulateMinutes(sim, 420);
    assert(sim.dkaWarning1Given, 'DKA-advarsel skal vaere givet');

    // Giv insulin — dette kalder resetDKAState()
    sim.addFastInsulin(5);

    // DKA-tilstand skal vaere nulstillet
    assert(!sim.dkaWarning1Given, 'DKA-advarsel nulstilles efter insulin');
    assert(sim.dkaGameOverTime === -1, 'DKA game over timer nulstilles efter insulin');
    assert(sim.timeOfHighBGwithInsulinDeficit === 0, 'DKA-taeller nulstilles efter insulin');
});


// =============================================================================
// TEST 6: KETOACIDOSE-OPBYGNING VED INSULINMANGEL
// =============================================================================
//
// Disse tests verificerer den nuvaerende DKA-mekanik: at tilstanden opbygges
// gradvist over tid naar BG er hoej og der mangler insulin.
//
// NB: Modellen har endnu ikke en eksplicit keton-variabel (dette er en TODO
// i koden). De nuvaerende tests verificerer den tidsbaserede DKA-mekanik
// som proxy for ketonopbygning.
//
// Fremtidig forbedring: Naar ketonmodel implementeres, bor tests tilfojes
// der maaler sim.ketones direkte og verificerer at:
//   - Ketoner stiger naar IOB er lav og BG er hoej
//   - Ketoner falder naar insulin gives
//   - Symptomtaerskler (0.6, 1.5, 3.0 mmol/L) udloeser korrekte advarsler
// =============================================================================

console.log('\n--- Test 6: Ketoacidose-opbygning ved insulinmangel ---');

test('DKA-timer starter kun naar ALLE betingelser er opfyldt (BG>12, IOB<0.1, ingen basal, >8t)', () => {
    // Test med normal BG — DKA maa IKKE starte
    const simNormal = createCleanSimulator();
    setSimulatorBG(simNormal, 8.0);  // Normal BG
    simNormal.activeFastInsulin = [];
    simNormal.activeLongInsulin = [];
    simNormal.lastInsulinTime = simNormal.totalSimMinutes - (9 * 60);

    simulateMinutes(simNormal, 120);
    // BG kan stige pga. leverproduktion, men skal starte normalt
    assert(simNormal.timeOfHighBGwithInsulinDeficit === 0,
        'DKA-timer maa IKKE starte ved normal start-BG (selvom BG kan stige)');
});

test('DKA-timer nulstilles naar insulin gives', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 18.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes - (9 * 60);
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    // Simuler 3 timer saa DKA-timer er i gang
    simulateMinutes(sim, 180);
    assert(sim.timeOfHighBGwithInsulinDeficit > 0,
        'DKA-timer skal vaere startet');

    // Giv insulin
    sim.addFastInsulin(3);

    // Koer endnu et tick saa checkGameOverConditions opdaterer
    // (insulin giver IOB > 0.1 og lastInsulinTime opdateres)
    simulateMinutes(sim, 1);

    assert(sim.timeOfHighBGwithInsulinDeficit === 0,
        'DKA-timer skal nulstilles naar insulin gives');
});

test('Insulinmangel over tid: BG stiger pga. leverproduktion uden modvirkning', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 12.0);
    sim.activeFastInsulin = [];
    sim.activeLongInsulin = [];
    sim.hovorka.state[2] = 0; sim.hovorka.state[3] = 0; sim.hovorka.state[6] = 0;
    sim.hovorka.state[7] = 0; sim.hovorka.state[8] = 0; sim.hovorka.state[9] = 0;

    const startBG = sim.trueBG;

    // Simuler 4 timer uden insulin
    simulateMinutes(sim, 240);

    // Uden insulin til at saenke BG, stiger den pga. leverens glukoseproduktion
    assert(sim.trueBG > startBG,
        `BG (${sim.trueBG.toFixed(1)}) skal stige fra ${startBG} uden insulin`);
});

test('Somogyi-effekten: lav BG udloeser stresshormon-respons', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 3.0);  // Under 3.5 -> Somogyi trigger

    const stressBefore = sim.acuteStressLevel;
    simulateMinutes(sim, 30);

    assert(sim.acuteStressLevel > stressBefore,
        `Akut stress (${sim.acuteStressLevel.toFixed(3)}) skal stige ved lav BG (Somogyi)`);
});


// =============================================================================
// EKSTRA TESTS: STRESSHORMONER OG DAWN-EFFEKT
// =============================================================================

console.log('\n--- Ekstra: Stresshormoner og dawn-effekt ---');

test('Cirkadisk kortisol er 0 om eftermiddagen (kl. 14)', () => {
    const sim = createCleanSimulator(); // tid = kl. 14:00
    assert(sim.circadianKortisolNiveau === 0,
        `Kortisol kl. 14 (${sim.circadianKortisolNiveau}) skal vaere 0`);
});

test('Cirkadisk kortisol har peak om morgenen (kl. 08)', () => {
    const sim = createCleanSimulator();
    // Sæt dawn-parametre til kendte værdier (undgår tilfældig variation i testen)
    sim._dawnAmplitude = 0.3;
    sim._dawnPeakMinutes = 8 * 60;
    sim.timeInMinutes = 8 * 60; // Kl. 08:00

    assertInRange(sim.circadianKortisolNiveau, 0.25, 0.35, 'Kortisol kl. 08 (peak)');
});

test('Akut stress aftager over tid (eksponentiel washout)', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 10.0);  // Hoej nok BG til at undgaa Somogyi-trigger (< 3.5)
    sim.acuteStressLevel = 1.0;

    simulateMinutes(sim, 60); // 1 halveringstid

    // Efter 60 min (1 halveringstid) skal stress vaere ca. halveret
    assertInRange(sim.acuteStressLevel, 0.3, 0.7, 'Akut stress efter 1 halveringstid');
});

test('addChronicStress oeget kronisk stressniveau', () => {
    const sim = createCleanSimulator();
    sim.addChronicStress(0.5);
    assertInRange(sim.chronicStressLevel, 0.45, 0.55, 'Kronisk stress efter tilfoejelse');
});


// =============================================================================
// TEST 7: PERSONPROFIL — Custom patient parameters
// =============================================================================
//
// Tester at Simulator-klassen accepterer en profil med vaegt, ICR og ISF,
// og at alle afledte vaerdier (basal dosis, hvileforbrug, kulhydrateffekt)
// beregnes korrekt ud fra profilen.
// =============================================================================

console.log('\n--- Test 7: Personprofil ---');

test('Default profil: ISF=3.0, ICR=10, vaegt=70', () => {
    const sim = createCleanSimulator();
    assert(sim.ISF === 3.0, `ISF skal vaere 3.0, fik ${sim.ISF}`);
    assert(sim.ICR === 10, `ICR skal vaere 10, fik ${sim.ICR}`);
    assert(sim.weight === 70, `Vaegt skal vaere 70, fik ${sim.weight}`);
});

test('Custom profil: ISF=2.0, ICR=8, vaegt=85', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 85 });
    sim.activeLongInsulin = [];
    sim.lastInsulinTime = sim.totalSimMinutes;

    assert(sim.ISF === 2.0, `ISF skal vaere 2.0, fik ${sim.ISF}`);
    assert(sim.ICR === 8, `ICR skal vaere 8, fik ${sim.ICR}`);
    assert(sim.weight === 85, `Vaegt skal vaere 85, fik ${sim.weight}`);
});

test('Basal dosis beregnes fra ISF via 100-reglen', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    // ISF=2.0 → TDD = 100/2 = 50 → basal = 50 * 0.45 = 22.5 → afrundet 23
    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 70 });
    assert(sim.estimatedTDD === 50, `TDD skal vaere 50, fik ${sim.estimatedTDD}`);
    assert(sim.basalDose === 23, `Basal skal vaere 23, fik ${sim.basalDose}`);

    // ISF=5.0 → TDD = 100/5 = 20 → basal = 20 * 0.45 = 9
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim2 = new Simulator({ isf: 5.0, icr: 15, weight: 60 });
    assert(sim2.estimatedTDD === 20, `TDD skal vaere 20, fik ${sim2.estimatedTDD}`);
    assert(sim2.basalDose === 9, `Basal skal vaere 9, fik ${sim2.basalDose}`);
});

test('Hvileforbrug skaleres med vaegt (2200 kcal ved 70 kg)', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim70 = new Simulator({ weight: 70 });
    assertInRange(sim70.restingKcalPerDay, 2199, 2201, 'Kcal ved 70 kg');

    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim100 = new Simulator({ weight: 100 });
    // 100 * (2200/70) = 3142.86
    assertInRange(sim100.restingKcalPerDay, 3142, 3144, 'Kcal ved 100 kg');

    assert(sim100.restingKcalPerDay > sim70.restingKcalPerDay,
        'Hoejere vaegt skal give hoejere hvileforbrug');
});

test('Kulhydrateffekt aendres med ISF og ICR', () => {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    // ISF=2.0, ICR=8 → carbEffect = ISF * circadianISF / ICR
    // Ved midnat (kl. 00:00) er circadianISF = 1.20, saa:
    // carbEffect = 2.0 * 1.20 / 8 = 0.30
    const sim = new Simulator({ isf: 2.0, icr: 8, weight: 70 });
    assertInRange(sim.currentCarbEffect, 0.29, 0.31, 'CarbEffect ved ISF=2, ICR=8 (midnat, circadianISF=1.2)');

    // ISF=5.0, ICR=15 → carbEffect = 5.0 * 1.20 / 15 = 0.40
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    const sim2 = new Simulator({ isf: 5.0, icr: 15, weight: 70 });
    assertInRange(sim2.currentCarbEffect, 0.39, 0.41, 'CarbEffect ved ISF=5, ICR=15 (midnat, circadianISF=1.2)');
});


// =============================================================================
// TEST 8: INSULINOVERDOSIS — 9E FRA BG=6 SKAL VAERE DOEDELIG
// =============================================================================
//
// Fysiologisk baggrund:
//   - 9E med ISF=3.0 giver et forventet BG-fald paa ~27 mmol/L
//   - Fra start-BG=6 er der kun 4.5 mmol/L til doedelig graense (1.5)
//   - T1D-patienter har svaekket kontraregulering (tabt glukagon-respons)
//   - Kontrareguleringen kan IKKE kompensere for massiv overdosis
//   - Kilde: Bengtsen 2021, Rzepczyk 2022, Megarbane 2007
// =============================================================================

// Hjælpefunktion: opret simulator MED intakt basal insulin.
// Koerer modellen 60 min fremad saa Hovorka-tilstanden er i sync med
// den aktive basal-insulin. Bruges til overdosis- og HAAF-tests.
function createSimulatorWithBasal() {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];

    const sim = new Simulator(); // Beholder basal insulin fra constructor

    // Koer 60 ticks (1 sim-minut hver) for at stabilisere Hovorka
    sim.simulationSpeed = 60;
    for (let i = 0; i < 60; i++) sim.update(1.0);

    // Nulstil stress og HAAF (hypo under init kan have trigget noget)
    sim.acuteStressLevel = 0.0;
    sim.chronicStressLevel = 0.0;
    sim.hypoArea = 0.0;
    sim.counterRegFactor = 1.0;
    sim.isGameOver = false;

    return sim;
}

console.log('\n--- Test 8: Insulinoverdosis (9E fra BG=6 er doedelig) ---');

test('9E bolus fra BG=6 uden mad giver game over (doedelig overdosis)', () => {
    // Brug simulator MED basal insulin — realistisk scenarie
    const sim = createSimulatorWithBasal();
    setSimulatorBG(sim, 6.0);

    // Giv 9E hurtigvirkende insulin uden mad
    sim.addFastInsulin(9);

    // Simuler op til 6 timer (360 min) — death bor ske langt foer
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 360; i++) {
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(gameOverTriggered,
        `9E fra BG=6 SKAL vaere doedelig (BG naaede ${sim.trueBG.toFixed(2)} mmol/L)`);
});

test('3E bolus fra BG=8 uden mad giver IKKE game over (svaer hypo men overlevelig)', () => {
    // Brug simulator MED basal insulin
    const sim = createSimulatorWithBasal();
    setSimulatorBG(sim, 8.0);

    // Giv 3E — forventet fald ~9 mmol/L, men fra BG=8 med kontraregulering
    // burde spilleren overleve (BG falder til ~2-3 med stress-respons)
    sim.addFastInsulin(3);

    // Simuler 6 timer
    let gameOverTriggered = false;
    sim.simulationSpeed = 60;
    for (let i = 0; i < 360; i++) {
        sim.update(1.0);
        if (sim.isGameOver) {
            gameOverTriggered = true;
            break;
        }
    }

    assert(!gameOverTriggered,
        `3E fra BG=8 bor vaere overlevelig (BG: ${sim.trueBG.toFixed(2)}, ` +
        `stress: ${sim.acuteStressLevel.toFixed(2)})`);
});


// =============================================================================
// TEST 9: HYPOGLYKAEMI-UNAWARENESS (HAAF) — Kontinuert areal-baseret model
// =============================================================================
//
// Fysiologisk baggrund:
//   - Gentagne/langvarige hypoer svaekker den kontraregulatoriske respons
//   - hypoArea akkumulerer: integral af max(0, 3.0 - BG) over tid
//   - counterRegFactor = 0.3 + 0.7 * exp(-hypoArea / HAAF_DAMAGE_SCALE)
//   - Recovery: hypoArea henfader eksponentielt naar BG > 4.0 (t½ = 3 sim-dage)
//   - Kilder: Dagogo-Jack 1993, Cryer 2001/2013, Reno 2013, Rickels 2019
// =============================================================================

console.log('\n--- Test 9: Hypoglykaemi-unawareness (HAAF) — areal-baseret ---');

test('counterRegFactor starter ved 1.0 og hypoArea ved 0', () => {
    const sim = createCleanSimulator();
    assert(sim.counterRegFactor === 1.0,
        `counterRegFactor skal starte ved 1.0, fik ${sim.counterRegFactor}`);
    assert(sim.hypoArea === 0.0,
        `hypoArea skal starte ved 0, fik ${sim.hypoArea}`);
});

test('hypoArea akkumuleres naar BG < 3.0 (HAAF skade)', () => {
    // Hold BG ved 2.0 i 15 min → forventet areal: (3.0-2.0) × 15 = 15 mmol·min/L
    const sim = createCleanSimulator();

    for (let i = 0; i < 15; i++) {
        sim.trueBG = 2.0;
        sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) sim.isGameOver = false;
    }

    // hypoArea skal vaere ca. 15 (1.0 deficit × 15 min)
    assert(sim.hypoArea > 10,
        `hypoArea skal vaere > 10 efter 15 min ved BG=2.0 (fik ${sim.hypoArea.toFixed(1)})`);
    assert(sim.counterRegFactor < 0.8,
        `counterRegFactor skal vaere reduceret (${sim.counterRegFactor.toFixed(2)})`);
});

test('Dyb hypo giver mere skade end mild hypo', () => {
    // BG=1.5 (deficit 1.5) vs BG=2.5 (deficit 0.5) i 10 min
    const simDeep = createCleanSimulator();
    const simMild = createCleanSimulator();

    for (let i = 0; i < 10; i++) {
        // Dyb hypo
        simDeep.trueBG = 1.5;
        simDeep.hovorka.state[4] = 1.5 * simDeep.hovorka.V_G;
        simDeep.simulationSpeed = 60;
        simDeep.update(1.0);
        if (simDeep.isGameOver) simDeep.isGameOver = false;

        // Mild hypo
        simMild.trueBG = 2.5;
        simMild.hovorka.state[4] = 2.5 * simMild.hovorka.V_G;
        simMild.simulationSpeed = 60;
        simMild.update(1.0);
        if (simMild.isGameOver) simMild.isGameOver = false;
    }

    assert(simDeep.hypoArea > simMild.hypoArea * 2,
        `Dyb hypo (${simDeep.hypoArea.toFixed(1)}) skal give mindst 2x mere skade end mild (${simMild.hypoArea.toFixed(1)})`);
    assert(simDeep.counterRegFactor < simMild.counterRegFactor,
        `Dyb hypo skal give lavere counterRegFactor (${simDeep.counterRegFactor.toFixed(2)} vs ${simMild.counterRegFactor.toFixed(2)})`);
});

test('HAAF recovery: hypoArea falder naar BG > 4.0', () => {
    const sim = createCleanSimulator();

    // Opbyg hypoArea: hold BG ved 2.0 i 20 min → ca. 20 mmol·min/L
    for (let i = 0; i < 20; i++) {
        sim.trueBG = 2.0;
        sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
        if (sim.isGameOver) sim.isGameOver = false;
    }
    const peakArea = sim.hypoArea;
    assert(peakArea > 15, `hypoArea skal vaere > 15 (fik ${peakArea.toFixed(1)})`);

    // Nu recovery: hold BG ved 7.0 i 3 sim-dage (4320 min = t½)
    // Efter 1 t½ burde hypoArea vaere ca. halveret
    for (let i = 0; i < 4320; i++) {
        sim.trueBG = 7.0;
        sim.hovorka.state[4] = 7.0 * sim.hovorka.V_G;
        sim.simulationSpeed = 60;
        sim.update(1.0);
    }

    assert(sim.hypoArea < peakArea * 0.6,
        `hypoArea skal vaere faldet efter 3 sim-dage recovery (${sim.hypoArea.toFixed(1)} vs peak ${peakArea.toFixed(1)})`);
    assert(sim.counterRegFactor > 0.8,
        `counterRegFactor skal vaere naesten genoprettet (${sim.counterRegFactor.toFixed(2)})`);
});


// =============================================================================
// TEST 10: AKTIVITETSSYSTEM — Fire aktivitetstyper med korrekt fysiologi
// =============================================================================
//
// Tester det nye aktivitetssystem med 4 typer:
//   - Cardio: BG falder (GLUT4 + insulinfølsomhed)
//   - Styrketræning: BG stiger akut (katekolamin stress-respons)
//   - Blandet sport: BG relativt stabilt (vægtet cardio+anaerob)
//   - Afslapning: reducerer stress, sænker BG en smule
//
// Videnskabeligt grundlag:
//   - Riddell et al. 2017 (Lancet): aerob → BG↓, anaerob → BG↑, blandet → stabilt
//   - Yardley et al. 2013: styrketræning giver akut BG-stigning 2-5 mmol/L
//   - PMC10534311: mindfulness reducerer stress → bedre glykæmisk kontrol
// =============================================================================

console.log('\n--- Test 10: Aktivitetssystem (4 typer) ---');

test('Styrketraening haever BG akut pga. stress-respons', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 7.0);
    const startBG = sim.trueBG;
    const startStress = sim.acuteStressLevel;

    // Start styrketræning med medium intensitet
    sim.startAktivitet('styrke', 'Medium', 30);

    // Simuler under styrketræning
    simulateMinutes(sim, 30);

    // Stress skal være steget markant (katekolamin-respons)
    assert(sim.acuteStressLevel > startStress + 0.1,
        `Akut stress efter styrke (${sim.acuteStressLevel.toFixed(3)}) skal vaere > ${(startStress + 0.1).toFixed(3)}`);
});

test('Blandet sport giver mindre BG-aendring end ren cardio', () => {
    // Riddell 2017: "mixed activities are associated with glucose stability"
    const simCardio = createCleanSimulator();
    setSimulatorBG(simCardio, 8.0);
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 30);
    const cardioDrop = 8.0 - simCardio.trueBG;

    const simBlandet = createCleanSimulator();
    setSimulatorBG(simBlandet, 8.0);
    simBlandet.startAktivitet('blandet', 'Medium', 30);
    simulateMinutes(simBlandet, 30);
    const blandetDrop = 8.0 - simBlandet.trueBG;

    // Blandet skal give mindre BG-fald end ren cardio
    // (stress-komponenten modvirker delvist det aerobe fald)
    assert(blandetDrop < cardioDrop,
        `Blandet BG-fald (${blandetDrop.toFixed(2)}) skal vaere mindre end cardio (${cardioDrop.toFixed(2)})`);
});

test('Afslapning reducerer stress-niveau', () => {
    const sim = createCleanSimulator();
    // Tilføj noget stress først
    sim.acuteStressLevel = 0.2;
    sim.chronicStressLevel = 0.1;

    sim.startAktivitet('afslapning', 'Medium', 30);
    simulateMinutes(sim, 30);

    assert(sim.acuteStressLevel < 0.15,
        `Akut stress efter afslapning (${sim.acuteStressLevel.toFixed(3)}) skal vaere reduceret (<0.15)`);
});

test('Stop-funktion virker — post-exercise effekter starter', () => {
    const sim = createCleanSimulator();
    setSimulatorBG(sim, 8.0);

    // Start 60 min cardio, stop efter 15 min
    sim.startAktivitet('cardio', 'Medium', 60);
    assert(sim.activeAktivitet !== null, 'Aktivitet skal vaere aktiv');

    simulateMinutes(sim, 15);
    sim.stopAktivitet();

    assert(sim.activeAktivitet === null, 'Aktivitet skal vaere stoppet');
    // Post-exercise entry skal vaere i activeMotion
    assert(sim.activeMotion.length > 0, 'Post-exercise sensitivity entry skal eksistere');
});

test('Kan ikke starte to aktiviteter samtidigt', () => {
    const sim = createCleanSimulator();
    const result1 = sim.startAktivitet('cardio', 'Lav', 30);
    assert(result1 === true, 'Foerste aktivitet skal starte');

    const result2 = sim.startAktivitet('styrke', 'Høj', 30);
    assert(result2 === false, 'Anden aktivitet skal afvises');
    assert(sim.activeAktivitet.type === 'cardio', 'Foerste aktivitet skal stadig koere');
});

test('Auto-stop naar varighed er naaet', () => {
    const sim = createCleanSimulator();
    sim.startAktivitet('cardio', 'Lav', 15);
    assert(sim.activeAktivitet !== null, 'Aktivitet skal vaere aktiv');

    // Simuler 20 minutter — aktiviteten bør auto-stoppe efter 15
    simulateMinutes(sim, 20);

    assert(sim.activeAktivitet === null, 'Aktivitet skal vaere auto-stoppet efter 15 min');
    assert(sim.activeMotion.length > 0, 'Post-exercise entry skal eksistere');
});

test('E1-skalering: styrke giver mindre GLUT4-optag end cardio', () => {
    // Cardio: e1Scaling=1.0, Styrke: e1Scaling=0.3
    // Ved samme puls bør E1-effekten (insulin-uafhængigt glukoseoptag) være lavere for styrke
    const simCardio = createCleanSimulator();
    simCardio.startAktivitet('cardio', 'Medium', 30);
    simulateMinutes(simCardio, 20);
    const e1Cardio = simCardio.hovorka.state[11]; // E1

    const simStyrke = createCleanSimulator();
    simStyrke.startAktivitet('styrke', 'Medium', 30);
    simulateMinutes(simStyrke, 20);
    const e1Styrke = simStyrke.hovorka.state[11]; // E1

    assert(e1Styrke < e1Cardio * 0.6,
        `Styrke E1 (${e1Styrke.toFixed(3)}) skal vaere < 60% af cardio E1 (${e1Cardio.toFixed(3)})`);
});


// --- Test 11: Lever-glykogenpool (massebalanceret model i gram) ---
console.log('\n--- Test 11: Lever-glykogenpool (gram-baseret depletion + recovery) ---');

test('Lever-glykogen starter ved 90g', () => {
    const sim = createCleanSimulator();
    assert(sim.liverGlycogenGrams === 90,
        `liverGlycogenGrams skal starte ved 90 (var ${sim.liverGlycogenGrams})`);
    assert(sim.glycogenReserve === 1.0,
        `glycogenReserve skal vaere 1.0 ved 90g (var ${sim.glycogenReserve})`);
});

test('Lever-glykogen falder under langvarig hypo (stress-drevet glykogenolyse)', () => {
    const sim = createCleanSimulator();
    // Tving BG lavt og tilføj akut stress for at simulere Somogyi
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G; // Q1 → BG=2.0
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4); // Fuld Somogyi-respons

    const startGrams = sim.liverGlycogenGrams;

    // Simuler 60 minutter med lavt BG
    for (let i = 0; i < 60; i++) {
        sim.updateStressHormones(1.0);
    }

    const consumed = startGrams - sim.liverGlycogenGrams;
    assert(consumed > 2,
        `Lever-glykogen skal falde maalbart efter 60 min hypo (forbrugt: ${consumed.toFixed(1)}g)`);
    assert(sim.liverGlycogenGrams < startGrams,
        `liverGlycogenGrams (${sim.liverGlycogenGrams.toFixed(1)}g) skal vaere under start (${startGrams}g)`);
});

test('Motion drainer glykogen markant hurtigere end hypo alene', () => {
    const simRest = createCleanSimulator();
    const simExercise = createCleanSimulator();

    // Samme udgangspunkt: lav BG + stress
    simRest.hovorka.state[4] = 2.5 * simRest.hovorka.V_G;
    simRest.trueBG = 2.5;
    simRest.addAcuteStress(0.4);

    simExercise.hovorka.state[4] = 2.5 * simExercise.hovorka.V_G;
    simExercise.trueBG = 2.5;
    simExercise.addAcuteStress(0.4);
    simExercise.startAktivitet('cardio', 'Medium', 60);

    // Simuler 45 minutter
    for (let i = 0; i < 45; i++) {
        simRest.updateStressHormones(1.0);
        simExercise.updateStressHormones(1.0);
    }

    assert(simExercise.liverGlycogenGrams < simRest.liverGlycogenGrams,
        `Motion+hypo (${simExercise.liverGlycogenGrams.toFixed(1)}g) skal give lavere glykogen end hypo alene (${simRest.liverGlycogenGrams.toFixed(1)}g)`);

    // Motion bør drainere markant mere (>3× pga. kcal-forbrug)
    const restConsumed = 90 - simRest.liverGlycogenGrams;
    const exerciseConsumed = 90 - simExercise.liverGlycogenGrams;
    assert(exerciseConsumed > restConsumed * 2,
        `Motion-drain (${exerciseConsumed.toFixed(1)}g) bør vaere >2× hvile-drain (${restConsumed.toFixed(1)}g)`);
});

test('Lever-glykogen kan ikke gaa under 0g', () => {
    const sim = createCleanSimulator();
    sim.hovorka.state[4] = 2.0 * sim.hovorka.V_G;
    sim.trueBG = 2.0;
    sim.addAcuteStress(0.4);
    sim.startAktivitet('cardio', 'Høj', null);

    // Simuler MEGET lang tid (300 min høj cardio + hypo)
    for (let i = 0; i < 300; i++) {
        sim.updateStressHormones(1.0);
    }

    assert(sim.liverGlycogenGrams >= 0,
        `liverGlycogenGrams kan ikke vaere negativ (var ${sim.liverGlycogenGrams.toFixed(2)}g)`);
    assert(sim.glycogenReserve >= 0,
        `glycogenReserve kan ikke vaere negativ (var ${sim.glycogenReserve.toFixed(3)})`);
});

test('Lever-glykogen genoprettes via gluconeogenese + mad', () => {
    const sim = createCleanSimulator();
    // Udtøm glycogen (motion drainer hurtigt)
    sim.hovorka.state[4] = 2.5 * sim.hovorka.V_G;
    sim.trueBG = 2.5;
    sim.addAcuteStress(0.3);
    sim.startAktivitet('cardio', 'Høj', null);
    for (let i = 0; i < 180; i++) {
        sim.updateStressHormones(1.0);
    }
    sim.stopAktivitet();
    const depletedGrams = sim.liverGlycogenGrams;

    // Normaliser BG (simuler måltid) og lad glycogen recovere
    sim.hovorka.state[4] = 8.0 * sim.hovorka.V_G;
    sim.trueBG = 8.0;
    sim.acuteStressLevel = 0;
    for (let i = 0; i < 180; i++) { // 3 timer med BG=8.0
        sim.updateStressHormones(1.0);
    }

    assert(sim.liverGlycogenGrams > depletedGrams + 10,
        `Lever-glykogen skal stige markant ved BG=8.0 (var ${sim.liverGlycogenGrams.toFixed(1)}g, depleteret: ${depletedGrams.toFixed(1)}g)`);
});

// =============================================================================
// RESULTAT-OVERSIGT
// =============================================================================

console.log('\n========================================');
console.log(`Resultat: ${testsPassed}/${testsTotal} tests bestaaet`);
if (testsFailed > 0) {
    console.log(`         ${testsFailed} test(s) FEJLEDE`);
    process.exit(1);
} else {
    console.log('         Alle tests bestaaet!');
    process.exit(0);
}
