// --- DOM Elements ---
let startButton, resetButton, helpButton, pauseButton, speedSelector, dayDisplay, timeDisplay, cgmValueDisplayGraph, normoPointsDisplay, normoPointsWeighting, muteButton, carbsSlider, carbsValue, proteinSlider, proteinValue, fatSlider, fatValue, giveFoodButton, foodInfoDisplay, foodKcalDisplay, foodKeDisplay, dextroButton, burgerButton, avocadoButton, chickenButton, cakeButton, sodaButton, saladButton, cerealButton, fastInsulinSlider, fastInsulinValue, giveFastInsulinButton, longInsulinSlider, longInsulinValue, giveLongInsulinButton, motionIntensitySelect, motionDurationSelect, startMotionButton, motionKcalDisplay, fingerprickButton, glucagonButton, debugTrueBgCheckbox, iobDisplay, cobDisplay, bgGraphCanvas, graphCtx, weightChangeSlider, weightChangeValue, steepDropWarningDiv, icrDisplay, isfDisplay, carbEffectDisplay, restingKcalDisplay, tir24hDisplay, titr24hDisplay, avgCgm24hDisplay, fastInsulin24hDisplay, basalInsulin24hDisplay, kcal24hDisplay, tir14dDisplay, titr14dDisplay, avgCgm14dDisplay;

// --- Game State and Configuration ---
let game;
let gameLoopIntervalId = null;
let lastFrameTime = 0;
let isPaused = true;
let cgmDataPoints = [];
let trueBgPoints = [];
const MAX_GRAPH_POINTS_PER_DAY = 288;
const KCAL_PER_KG_WEIGHT = 7700;
const RESTING_KCAL_PER_DAY = 2200;
const RESTING_KCAL_PER_MINUTE = RESTING_KCAL_PER_DAY / (24 * 60);

const sizeCanvas = () => {
    if (!bgGraphCanvas) return;
    const rect = bgGraphCanvas.getBoundingClientRect();
    if (rect.width > 0) {
        const dpr = window.devicePixelRatio || 1;
        bgGraphCanvas.width = rect.width * dpr;
        bgGraphCanvas.height = rect.height * dpr;
        graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGraph();
    } else {
         setTimeout(sizeCanvas, 50);
    }
}

// --- App Initialization ---
function initializeApp() {
    // Assign all DOM elements once the document is loaded
    startButton = document.getElementById('startButton');
    resetButton = document.getElementById('resetButton');
    helpButton = document.getElementById('helpButton');
    pauseButton = document.getElementById('pauseButton');
    speedSelector = document.getElementById('speedSelector');
    dayDisplay = document.getElementById('dayDisplay');
    timeDisplay = document.getElementById('timeDisplay');
    cgmValueDisplayGraph = document.getElementById('cgmValueDisplayGraph');
    normoPointsDisplay = document.getElementById('normoPointsDisplay');
    normoPointsWeighting = document.getElementById('normoPointsWeighting');
    muteButton = document.getElementById('muteButton');
    carbsSlider = document.getElementById('carbsSlider');
    carbsValue = document.getElementById('carbsValue');
    proteinSlider = document.getElementById('proteinSlider');
    proteinValue = document.getElementById('proteinValue');
    fatSlider = document.getElementById('fatSlider');
    fatValue = document.getElementById('fatValue');
    giveFoodButton = document.getElementById('giveFoodButton');
    foodInfoDisplay = document.getElementById('foodInfoDisplay');
    foodKcalDisplay = document.getElementById('foodKcalDisplay');
    foodKeDisplay = document.getElementById('foodKeDisplay');
    dextroButton = document.getElementById('dextroButton');
    burgerButton = document.getElementById('burgerButton');
    avocadoButton = document.getElementById('avocadoButton');
    chickenButton = document.getElementById('chickenButton');
    cakeButton = document.getElementById('cakeButton');
    sodaButton = document.getElementById('sodaButton');
    saladButton = document.getElementById('saladButton');
    cerealButton = document.getElementById('cerealButton');
    fastInsulinSlider = document.getElementById('fastInsulinSlider');
    fastInsulinValue = document.getElementById('fastInsulinValue');
    giveFastInsulinButton = document.getElementById('giveFastInsulinButton');
    longInsulinSlider = document.getElementById('longInsulinSlider');
    longInsulinValue = document.getElementById('longInsulinValue');
    giveLongInsulinButton = document.getElementById('giveLongInsulinButton');
    motionIntensitySelect = document.getElementById('motionIntensity');
    motionDurationSelect = document.getElementById('motionDuration');
    startMotionButton = document.getElementById('startMotionButton');
    motionKcalDisplay = document.getElementById('motionKcalDisplay');
    fingerprickButton = document.getElementById('fingerprickButton');
    glucagonButton = document.getElementById('glucagonButton');
    debugTrueBgCheckbox = document.getElementById('debugTrueBgCheckbox');
    iobDisplay = document.getElementById('iobDisplay');
    cobDisplay = document.getElementById('cobDisplay');
    bgGraphCanvas = document.getElementById('bg-graph');
    graphCtx = bgGraphCanvas.getContext('2d');
    weightChangeSlider = document.getElementById('weightChangeSlider');
    weightChangeValue = document.getElementById('weightChangeValue');
    steepDropWarningDiv = document.getElementById('steep-drop-warning');
    icrDisplay = document.getElementById('icrDisplay');
    isfDisplay = document.getElementById('isfDisplay');
    carbEffectDisplay = document.getElementById('carbEffectDisplay');
    restingKcalDisplay = document.getElementById('restingKcalDisplay');
    tir24hDisplay = document.getElementById('tir24h');
    titr24hDisplay = document.getElementById('titr24h');
    avgCgm24hDisplay = document.getElementById('avgCgm24h');
    fastInsulin24hDisplay = document.getElementById('fastInsulin24h');
    basalInsulin24hDisplay = document.getElementById('basalInsulin24h');
    kcal24hDisplay = document.getElementById('kcal24h');
    tir14dDisplay = document.getElementById('tir14d');
    titr14dDisplay = document.getElementById('titr14d');
    avgCgm14dDisplay = document.getElementById('avgCgm14d');

    sizeCanvas();
    updatePlayerFixedDataUI();
    resetButton.disabled = true;
    updateFoodDisplay();
    updateMotionKcal();
    weightChangeSlider.style.setProperty('--thumb-color', '#4CAF50');

    // --- Event Listeners ---
    carbsSlider.addEventListener('input', (e) => { carbsValue.textContent = e.target.value; updateFoodDisplay(); });
    proteinSlider.addEventListener('input', (e) => { proteinValue.textContent = e.target.value; updateFoodDisplay(); });
    fatSlider.addEventListener('input', (e) => { fatValue.textContent = e.target.value; updateFoodDisplay(); });

    fastInsulinSlider.addEventListener('input', (e) => fastInsulinValue.textContent = parseFloat(e.target.value).toFixed(1));
    longInsulinSlider.addEventListener('input', (e) => longInsulinValue.textContent = e.target.value);

    startButton.addEventListener('click', startGame);
    resetButton.addEventListener('click', resetGame);
    helpButton.addEventListener('click', showHelpPopup);
    pauseButton.addEventListener('click', togglePause);
    muteButton.addEventListener('click', () => { isMuted = !isMuted; muteButton.textContent = isMuted ? "Unmute" : "Mute"; if (sounds && Tone.Destination) Tone.Destination.mute = isMuted; });
    speedSelector.addEventListener('change', (e) => { if (game) game.simulationSpeed = parseInt(e.target.value); });

    giveFoodButton.addEventListener('click', () => { if(game) game.addFood(parseInt(carbsSlider.value), parseInt(proteinSlider.value), parseInt(fatSlider.value)); });
    dextroButton.addEventListener('click', () => { if(game) game.addFood(3, 0, 0, '🍬'); });
    burgerButton.addEventListener('click', () => { if(game) game.addFood(40, 30, 30, '🍔'); });
    avocadoButton.addEventListener('click', () => { if(game) game.addFood(5, 5, 25, '🥑'); });
    chickenButton.addEventListener('click', () => { if(game) game.addFood(2, 30, 15, '🍗'); });
    cakeButton.addEventListener('click', () => { if(game) game.addFood(60, 5, 25, '🍰'); });
    sodaButton.addEventListener('click', () => { if(game) game.addFood(35, 0, 0, '🥤'); });
    saladButton.addEventListener('click', () => { if(game) game.addFood(5, 2, 1, '🥗'); });
    cerealButton.addEventListener('click', () => { if(game) game.addFood(30, 8, 2, '🥣'); });

    giveFastInsulinButton.addEventListener('click', () => { if(game) game.addFastInsulin(parseFloat(fastInsulinSlider.value)); });
    giveLongInsulinButton.addEventListener('click', () => { if(game) game.addLongInsulin(parseInt(longInsulinSlider.value)); });

    [motionIntensitySelect, motionDurationSelect].forEach(el => el.addEventListener('change', updateMotionKcal));
    startMotionButton.addEventListener('click', () => { if(game && !startMotionButton.disabled) game.startMotion(motionIntensitySelect.value, motionDurationSelect.value); });

    fingerprickButton.addEventListener('click', () => { if(game) game.performFingerprick(); });
    glucagonButton.addEventListener('click', () => { if (game && !glucagonButton.disabled) game.useGlucagon(); });
    debugTrueBgCheckbox.addEventListener('change', () => { if(game) drawGraph(); });
}

// Run initialization on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
window.addEventListener('resize', sizeCanvas);
