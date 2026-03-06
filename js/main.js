// =============================================================================
// MAIN.JS — Application entry point: globals, DOM references, event listeners
// =============================================================================
//
// This file is loaded LAST in the script chain (after sounds.js, simulator.js,
// ui.js, and game.js). It serves as the application's entry point:
//
//   1. Declares all global variables and constants
//   2. Captures DOM element references on page load
//   3. Sets up all event listeners (button clicks, slider changes, etc.)
//
// Because this project uses plain JavaScript without modules or a build system,
// all files share the same global scope. Variables declared here (with `let`
// or `const` at the top level) are accessible from all other files.
//
// Script loading order in index.html (order matters!):
//   sounds.js → simulator.js → ui.js → game.js → main.js
//
// For MATLAB users: think of this as the "main script" that calls all the
// setup functions and connects the GUI callbacks to the simulation functions.
//
// Dependencies: All other JS files must be loaded before this one.
// Exports (global): All variables declared below, initializeApp()
// =============================================================================


// =============================================================================
// GLOBAL DOM ELEMENT REFERENCES
// =============================================================================
// These variables hold references to HTML elements (buttons, sliders, displays).
// They're declared here as `let` (uninitialized) and assigned in initializeApp()
// after the DOM is ready. Other files (simulator.js, ui.js) access these
// directly by their variable names.
//
// This is similar to MATLAB's guidata or handles structure — a central place
// where all UI element references are stored for easy access.
// =============================================================================
let startButton, resetButton, helpButton, pauseButton, speedSelector, dayDisplay, timeDisplay, cgmValueDisplayGraph, normoPointsDisplay, normoPointsWeighting, muteButton, carbsSlider, carbsValue, proteinSlider, proteinValue, fatSlider, fatValue, giveFoodButton, foodInfoDisplay, foodKcalDisplay, foodKeDisplay, dextroButton, burgerButton, avocadoButton, chickenButton, cakeButton, sodaButton, saladButton, cerealButton, fastInsulinSlider, fastInsulinValue, giveFastInsulinButton, longInsulinSlider, longInsulinValue, giveLongInsulinButton, motionIntensitySelect, motionDurationSelect, startMotionButton, motionKcalDisplay, fingerprickButton, glucagonButton, debugTrueBgCheckbox, iobDisplay, cobDisplay, bgGraphCanvas, graphCtx, weightChangeSlider, weightChangeValue, steepDropWarningDiv, weightDisplay, icrDisplay, isfDisplay, carbEffectDisplay, basalDoseDisplay, restingKcalDisplay, tir24hDisplay, titr24hDisplay, avgCgm24hDisplay, fastInsulin24hDisplay, basalInsulin24hDisplay, kcal24hDisplay, tir14dDisplay, titr14dDisplay, avgCgm14dDisplay;


// =============================================================================
// GLOBAL GAME STATE AND CONFIGURATION CONSTANTS
// =============================================================================

// game: the current Simulator instance (null when no game is running)
let game;

// gameLoopIntervalId: handle returned by requestAnimationFrame, used to cancel the loop
let gameLoopIntervalId = null;

// lastFrameTime: timestamp of the previous animation frame (for deltaTime calculation)
let lastFrameTime = 0;

// isPaused: whether the simulation is currently paused
let isPaused = true;

// cgmDataPoints / trueBgPoints: arrays of {time, value} objects for graph rendering.
// cgmDataPoints are the simulated CGM readings (what the player sees).
// trueBgPoints are the actual BG values (only shown in debug mode).
let cgmDataPoints = [];
let trueBgPoints = [];

// MAX_GRAPH_POINTS_PER_DAY: maximum data points to keep per day.
// At 1 reading per 5 sim-minutes: 24*60/5 = 288 readings per day.
const MAX_GRAPH_POINTS_PER_DAY = 288;

// KCAL_PER_KG_WEIGHT: calories per kilogram of body weight change.
// Standard nutritional approximation: ~7700 kcal = 1 kg of body mass.
const KCAL_PER_KG_WEIGHT = 7700;

// RESTING_KCAL_PER_DAY: basal metabolic rate (calories burned at rest per day).
// A reasonable average for an adult. Used for weight change calculations.
const RESTING_KCAL_PER_DAY = 2200;

// RESTING_KCAL_PER_MINUTE: derived from daily rate for per-tick calculations.
const RESTING_KCAL_PER_MINUTE = RESTING_KCAL_PER_DAY / (24 * 60);


// =============================================================================
// CANVAS SIZING — Handle responsive layout and high-DPI displays
// =============================================================================
//
// sizeCanvas() ensures the canvas element fills its container and renders
// crisply on high-DPI (Retina) displays. It's called on initialization and
// whenever the browser window is resized.
//
// The trick: HTML canvas has two sizes — CSS size (how big it appears) and
// pixel size (how many pixels it actually has). For crisp rendering on a 2x
// display, we set the pixel size to 2x the CSS size and scale the drawing
// context accordingly.
// =============================================================================
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
        // Canvas not yet visible (e.g., hidden by CSS transition) — retry shortly
         setTimeout(sizeCanvas, 50);
    }
}


// =============================================================================
// initializeApp — One-time setup when the page loads
// =============================================================================
//
// This function:
//   1. Captures all DOM element references (getElementById for each UI element)
//   2. Sets up the canvas for rendering
//   3. Shows initial UI state (player data, food display, etc.)
//   4. Attaches event listeners to all interactive elements
//
// In JavaScript, document.getElementById('someId') returns a reference to the
// HTML element with that id attribute. This is like MATLAB's findobj or
// handles.someElement in a GUIDE-generated GUI.
// =============================================================================
function initializeApp() {
    // --- Assign all DOM element references ---
    // Each variable corresponds to an HTML element with a matching id attribute.
    // After this block, we can use these variables to read/write element properties.
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
    graphCtx = bgGraphCanvas.getContext('2d'); // Get the 2D drawing context for the canvas
    weightChangeSlider = document.getElementById('weightChangeSlider');
    weightChangeValue = document.getElementById('weightChangeValue');
    steepDropWarningDiv = document.getElementById('steep-drop-warning');
    weightDisplay = document.getElementById('weightDisplay');
    icrDisplay = document.getElementById('icrDisplay');
    isfDisplay = document.getElementById('isfDisplay');
    carbEffectDisplay = document.getElementById('carbEffectDisplay');
    basalDoseDisplay = document.getElementById('basalDoseDisplay');
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

    // --- Initial UI setup ---
    sizeCanvas();                  // Size the canvas to its container
    updatePlayerFixedDataUI();     // Show patient parameters (ICR, ISF, etc.)
    resetButton.disabled = true;   // Can't reset before starting
    updateFoodDisplay();           // Show initial calorie/KE values for food sliders
    updateMotionKcal();            // Show initial calorie burn for exercise settings
    weightChangeSlider.style.setProperty('--thumb-color', '#4CAF50'); // Green = stable

    // =========================================================================
    // EVENT LISTENERS — Connect UI elements to their handler functions
    // =========================================================================
    // addEventListener('event', callback) is JavaScript's way of attaching
    // callback functions to UI events. Similar to MATLAB's set(handle, 'Callback', @fn).
    //
    // 'input' fires continuously while a slider is being dragged.
    // 'click' fires when a button is clicked.
    // 'change' fires when a dropdown selection changes.
    //
    // Arrow functions (e => { ... }) are shorthand for anonymous functions:
    //   (e) => { code } is equivalent to function(e) { code }
    // =========================================================================

    // --- Food slider change handlers: update displayed values and calorie calculation ---
    carbsSlider.addEventListener('input', (e) => { carbsValue.textContent = e.target.value; updateFoodDisplay(); });
    proteinSlider.addEventListener('input', (e) => { proteinValue.textContent = e.target.value; updateFoodDisplay(); });
    fatSlider.addEventListener('input', (e) => { fatValue.textContent = e.target.value; updateFoodDisplay(); });

    // --- Insulin slider change handlers: update displayed dose values ---
    fastInsulinSlider.addEventListener('input', (e) => fastInsulinValue.textContent = parseFloat(e.target.value).toFixed(1));
    longInsulinSlider.addEventListener('input', (e) => longInsulinValue.textContent = e.target.value);

    // --- Game control buttons ---
    startButton.addEventListener('click', startGame);
    resetButton.addEventListener('click', resetGame);
    helpButton.addEventListener('click', showHelpPopup);
    pauseButton.addEventListener('click', togglePause);

    // --- Mute button: toggles sound on/off ---
    muteButton.addEventListener('click', () => { isMuted = !isMuted; muteButton.textContent = isMuted ? "Unmute" : "Mute"; if (sounds && Tone.Destination) Tone.Destination.mute = isMuted; });

    // --- Speed selector: update simulation speed in real-time ---
    speedSelector.addEventListener('change', (e) => { if (game) game.simulationSpeed = parseInt(e.target.value); });

    // --- Food buttons: custom meal from sliders + preset meals ---
    giveFoodButton.addEventListener('click', () => { if(game) game.addFood(parseInt(carbsSlider.value), parseInt(proteinSlider.value), parseInt(fatSlider.value)); });
    // Preset meals with fixed macronutrient profiles (carbs, protein, fat)
    dextroButton.addEventListener('click', () => { if(game) game.addFood(3, 0, 0, '🍬'); });        // Dextrose tablet: pure sugar
    burgerButton.addEventListener('click', () => { if(game) game.addFood(40, 30, 30, '🍔'); });     // Burger: balanced but heavy
    avocadoButton.addEventListener('click', () => { if(game) game.addFood(5, 5, 25, '🥑'); });      // Avocado: mostly fat
    chickenButton.addEventListener('click', () => { if(game) game.addFood(2, 30, 15, '🍗'); });     // Chicken thigh: mostly protein
    cakeButton.addEventListener('click', () => { if(game) game.addFood(60, 5, 25, '🍰'); });        // Layer cake: carb bomb
    sodaButton.addEventListener('click', () => { if(game) game.addFood(35, 0, 0, '🥤'); });         // Soda: pure liquid carbs
    saladButton.addEventListener('click', () => { if(game) game.addFood(5, 2, 1, '🥗'); });         // Salad: minimal impact
    cerealButton.addEventListener('click', () => { if(game) game.addFood(30, 8, 2, '🥣'); });       // Oatmeal: moderate carbs

    // --- Insulin buttons ---
    giveFastInsulinButton.addEventListener('click', () => { if(game) game.addFastInsulin(parseFloat(fastInsulinSlider.value)); });
    giveLongInsulinButton.addEventListener('click', () => { if(game) game.addLongInsulin(parseInt(longInsulinSlider.value)); });

    // --- Exercise controls ---
    [motionIntensitySelect, motionDurationSelect].forEach(el => el.addEventListener('change', updateMotionKcal));
    startMotionButton.addEventListener('click', () => { if(game && !startMotionButton.disabled) game.startMotion(motionIntensitySelect.value, motionDurationSelect.value); });

    // --- Measurement and emergency buttons ---
    fingerprickButton.addEventListener('click', () => { if(game) game.performFingerprick(); });
    glucagonButton.addEventListener('click', () => { if (game && !glucagonButton.disabled) game.useGlucagon(); });

    // --- Debug checkbox: toggle true BG line on graph ---
    debugTrueBgCheckbox.addEventListener('change', () => { if(game) drawGraph(); });
}


// =============================================================================
// APP INITIALIZATION — Run initializeApp when the DOM is ready
// =============================================================================
// The DOM (Document Object Model) is the browser's internal representation of
// the HTML page. We can't access elements with getElementById until the DOM
// is fully loaded. These lines ensure initializeApp runs at the right time.
//
// document.readyState === 'loading' means the HTML is still being parsed.
// In that case, we wait for the 'DOMContentLoaded' event.
// Otherwise, the DOM is already ready and we can initialize immediately.
// =============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Re-size the canvas whenever the browser window is resized
window.addEventListener('resize', sizeCanvas);
