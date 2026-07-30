// =============================================================================
// HARNESS.JS — Hovedløs (headless) opsætning til Node-baserede model-tests
// =============================================================================
//
// Samler den fælles "kør Simulator uden browser"-opsætning ét sted, så
// golden-master-regression (tests/golden-master.js) og fremtidige model-tests
// kan genbruge den i stedet for at gentage ~100 linjers mock-kode.
//
// Ansvar:
//   1. Mock af alle browser-globals (DOM-elementer, lyd, i18n, konstanter)
//      som js/simulator.js forventer, så koden kan køre i Node.
//   2. Deterministisk mock af performance.now() så intet realtids-ur siver
//      ind i en kørsel (vigtigt for golden-master-reproducerbarhed).
//   3. Indlæsning af js/foods.js, js/hovorka.js, js/physiology-engine.js og
//      js/simulator.js ind i global, så testene matcher browserens globale
//      script-miljø.
//   4. simulateMinutes()-helper: kører update() i 1-minuts skridt.
//
// NB (migration): Når fysiologien udskilles til js/physiology-engine.js
// (slice S1+), peger denne harness på engine i stedet, og DOM-mocks kan
// fjernes for ren model-test. Se docs/reviews/2026-06-14_physiology-engine-
// api-plan.md.
//
// NB (oprydning): tests/simulation.test.js har stadig sin egen indlejrede
// kopi af denne opsætning. Den kan senere pege på denne harness for at fjerne
// duplikatet — det er en separat oprydning, ikke en del af golden-master.
// =============================================================================

// -----------------------------------------------------------------------------
// Mock af et DOM-element: et objekt der accepterer alle typiske DOM-operationer.
// -----------------------------------------------------------------------------
function mockElement() {
    return {
        textContent: '',
        innerHTML: '',
        value: '60',           // speedSelector.value bruges i konstruktøren
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
}

// Alle globale DOM-referencer som simulator.js/main.js forventer.
const domGlobals = [
    'startButton', 'resetButton', 'helpButton', 'pauseButton', 'speedSelector',
    'dayDisplay', 'timeDisplay', 'cgmValueDisplayGraph', 'normoPointsDisplay',
    'normoPointsWeighting', 'muteButton', 'carbsSlider', 'carbsValue',
    'proteinSlider', 'proteinValue', 'fatSlider', 'fatValue', 'giveFoodButton',
    'foodInfoDisplay', 'foodKcalDisplay', 'dextroButton',
    'pizzaButton', 'pastaButton', 'cakeButton', 'iceButton', 'chocolateButton',
    'breadButton', 'cerealButton', 'meatButton', 'cheeseButton', 'avocadoButton',
    'candyButton', 'juiceButton', 'saladButton', 'fastInsulinSlider', 'fastInsulinValue',
    'giveFastInsulinButton', 'longInsulinSlider', 'longInsulinValue',
    'giveLongInsulinButton', 'motionIntensitySelect', 'motionDurationSelect',
    'startMotionButton', 'motionKcalDisplay', 'fingerprickButton', 'ketoneTestButton', 'glucagonButton',
    'debugTrueBgCheckbox', 'iobDisplay', 'cobDisplay', 'bgGraphCanvas', 'graphCtx',
    'weightChangeSlider', 'weightChangeValue', 'steepDropWarningDiv',
    'lastBolusTimerDisplay',
    'statsTirValue', 'statsAvgBgValue', 'statsWeightValue'
];
domGlobals.forEach(name => { global[name] = mockElement(); });

// Globale variable fra main.js som simulatoren bruger.
global.isPaused = false;
global.cgmDataPoints = [];
global.trueBgPoints = [];
global.physiologyDataPoints = [];
global.MAX_GRAPH_POINTS_PER_DAY = 288;
global.KCAL_PER_KG_WEIGHT = 7700;
global.RESTING_KCAL_PER_DAY = 2200;
global.RESTING_KCAL_PER_MINUTE = global.RESTING_KCAL_PER_DAY / (24 * 60);

// Mock-funktioner der normalt bor i ui.js, sounds.js, i18n.js — ignoreres her.
global.logEvent = () => {};
global.showPopup = () => {};
global.showGameOverPopup = () => {};
global.playSound = () => {};
global.drawGraph = () => {};
global.updateUI = () => {};
global.togglePause = () => {};
global.showLifeLostAnimation = () => {};

// i18n-mock — t() returnerer nøglen (med variabler indsat). Vi tester model, ikke tekst.
global.appSettings = { language: 'da' };
global.I18N = { da: {}, en: {} };
global.t = (key, vars) => { let text = key; if (vars) Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); }); return text; };
global.tInsulinUnit = () => 'E';
global.MMOL_TO_MGDL = 18.0182;
global.bgUnitLabel = () => 'mmol/L';
global.displayBG = (mmolValue) => mmolValue.toFixed(1);
global.displayBGValue = (mmolValue) => parseFloat(mmolValue.toFixed(1));
global.bgVars = () => ({ unit: 'mmol/L', low: '4.0', high: '10.0', threshold: '2.5', floor: '4.0', ceil: '14.0' });

// Deterministisk tids-mock: performance.now() bruges kun til UI-besked-timing
// (graphMessages), aldrig til fysik. Vi fastlåser den til 0 så ingen realtid
// kan påvirke en golden-master-kørsel.
global.performance = { now: () => 0 };

// document.getElementById bruges af updateWeight() m.fl. i simulator.js.
global.document = {
    getElementById: () => mockElement(),
    body: { appendChild: () => {} }
};

// -----------------------------------------------------------------------------
// Indlæs foods.js, Hovorka-modellen, physiology-engine og Simulator-klassen.
// Rækkefølge: foods (CARB_TYPES) -> hovorka/engine -> simulator.
// Alle fire filer kan nu loades med require(); globals sættes eksplicit for at
// efterligne browserens script-rækkefølge.
// -----------------------------------------------------------------------------
const {
    FOODS,
    CARB_TYPES,
    CHILD_PORTION_SCALE,
    estimateEatTimeMin,
} = require('../js/foods.js');
const { HovorkaModel, HOVORKA_STATE_IDX } = require('../js/hovorka.js');
// HOVORKA_STATE_IDX must be a global before engine/simulator modules run their
// methods (in the browser all scripts share global scope; here we mirror that).
global.HOVORKA_STATE_IDX = HOVORKA_STATE_IDX;
const { PhysiologyEngine, createEngine } = require('../js/physiology-engine.js');
const { Simulator } = require('../js/simulator.js');
global.FOODS = FOODS;
global.CARB_TYPES = CARB_TYPES;
global.CHILD_PORTION_SCALE = CHILD_PORTION_SCALE;
global.estimateEatTimeMin = estimateEatTimeMin;
global.HovorkaModel = HovorkaModel;
global.PhysiologyEngine = PhysiologyEngine;
global.createEngine = createEngine;
global.Simulator = Simulator;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Nulstil de globale graf-arrays mellem to simulationer, så de ikke deler state.
function resetGraphArrays() {
    global.cgmDataPoints = [];
    global.trueBgPoints = [];
    global.physiologyDataPoints = [];
    global.isPaused = false;
}

// Kør et antal sim-minutter ved at kalde update() i 1-minuts skridt.
// simulationSpeed=60 + update(1.0) => 1 reelt sekund = 1 sim-minut pr. tick.
function simulateMinutes(sim, minutes) {
    sim.simulationSpeed = 60;
    for (let i = 0; i < minutes; i++) {
        sim.update(1.0);
    }
}

// Sæt et bestemt start-BG gennem motorens offentlige API. setBG() holder både
// plasma-kompartmentet Q1, det perifere kompartment Q2, CGM-kompartmentet C og
// de to viste BG-værdier synkroniserede. Direkte ændring af Q1 alene skaber en
// kunstig transient i starten af et testscenarie.
function setSimulatorBG(sim, targetBG) {
    sim.engine.setBG(targetBG);
}

module.exports = {
    Simulator: global.Simulator,
    HovorkaModel: global.HovorkaModel,
    FOODS: global.FOODS,
    CARB_TYPES: global.CARB_TYPES,
    CHILD_PORTION_SCALE: global.CHILD_PORTION_SCALE,
    estimateEatTimeMin: global.estimateEatTimeMin,
    mockElement,
    resetGraphArrays,
    simulateMinutes,
    setSimulatorBG
};
