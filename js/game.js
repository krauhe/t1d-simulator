// =============================================================================
// GAME.JS — Game loop and game control functions (start, reset, pause)
// =============================================================================
//
// This file manages the game lifecycle:
//   - mainGameLoop(): the animation frame callback that drives the simulation
//   - startGame(): initialize a new game session
//   - resetGame(): clean up and return to the start screen
//   - togglePause(): pause/resume the simulation
//
// The game loop uses requestAnimationFrame (rAF), which is the browser's way
// of running code synchronized with the display refresh rate (typically 60 fps).
// Each frame, the loop:
//   1. Calculates elapsed real time since the last frame (deltaTime)
//   2. Calls simulator.update(deltaTime) to advance the physiological model
//   3. Calls updateUI() and drawGraph() to render the current state
//
// For MATLAB users: this is analogous to a timer callback that runs your
// simulation step and updates a plot, but managed by the browser's rendering
// engine for smooth animation.
//
// Dependencies (global): game (Simulator), isPaused, lastFrameTime,
//   gameLoopIntervalId, cgmDataPoints, trueBgPoints, various DOM references
//
// Exports (global): mainGameLoop(), startGame(), resetGame(), togglePause()
// =============================================================================


// =============================================================================
// mainGameLoop — The animation frame callback (runs ~60 times per second)
// =============================================================================
//
// This function is called by the browser via requestAnimationFrame (rAF).
// rAF passes a high-resolution timestamp (currentTime, in milliseconds)
// which we use to calculate the exact real-world time elapsed since the
// last frame (deltaTime).
//
// The simulation speed multiplier (set by the speed dropdown) determines
// how many simulated minutes each real second corresponds to:
//   speed=60:   1 real second = 1 simulated minute  (1 hour per real minute)
//   speed=240:  1 real second = 4 simulated minutes  (4 hours per real minute)
//   speed=720:  1 real second = 12 simulated minutes (12 hours per real minute)
//   speed=1440: 1 real second = 24 simulated minutes (24 hours per real minute)
//
// @param {number} currentTime - High-resolution timestamp from rAF (milliseconds)
// =============================================================================
function mainGameLoop(currentTime) {
    // Stop the loop if the game is over
    if (game?.isGameOver) {
        if(gameLoopIntervalId) cancelAnimationFrame(gameLoopIntervalId);
        gameLoopIntervalId = null;
        return;
    }

    // Only advance the simulation if the game is not paused
    if (!isPaused) {
        // deltaTime: real-world seconds since the last frame
        // Typical values: ~0.016s at 60fps, ~0.033s at 30fps
        let deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;

        // CAP deltaTime to prevent simulation blowup when tab is backgrounded.
        // When the browser tab is inactive, requestAnimationFrame pauses, but
        // real time keeps ticking. Without this cap, returning to the tab would
        // produce a deltaTime of minutes/hours, causing the simulation to "fast
        // forward" in one giant step — leading to wildly unrealistic BG values.
        // Max 0.5 seconds = ~30 sim-seconds at 60x speed, a safe upper bound.
        if (deltaTime > 0.5) deltaTime = 0.5;

        // Advance the physiological simulation by deltaTime
        game.update(deltaTime);

        // Refresh all numeric displays (day, time, CGM, IOB, COB, points)
        updateUI();
    }

    // Always redraw the graph (even when paused, for responsive resizing)
    drawGraph();

    // Schedule the next frame — this creates the continuous loop
    // gameLoopIntervalId stores the rAF handle so we can cancel it later
    gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
}


// =============================================================================
// startGame — Show profile popup, then initialize and begin a new simulation
// =============================================================================
//
// First shows the profile popup for the player to enter/confirm their diabetes
// parameters (weight, ICR, ISF). When they click "Start", creates a Simulator
// with those parameters and starts the game loop.
//
// Called when the player clicks "Start Simulation".
// =============================================================================
function startGame() {
    // Tone.js requires a user gesture to start the audio context (browser security policy).
    // We attempt to start it here on the first button click.
    if (sounds && Tone.context.state !== 'running') Tone.start();

    // Show the profile setup popup. The callback is called with the profile
    // when the player clicks "Start Simulation" in the popup.
    showProfilePopup((profile) => {
        // Create a new Simulator with the player's personal parameters
        game = new Simulator(profile);

        // Initialize the graph data arrays with the starting BG value
        cgmDataPoints = [{ time: 0, value: game.cgmBG }];
        trueBgPoints = [{ time: 0, value: game.trueBG }];

        // Unpause and start the loop
        isPaused = false;
        pauseButton.textContent = "Pause";

        // Record the current time as the reference point for deltaTime calculations
        // performance.now() returns a high-resolution timestamp in milliseconds
        lastFrameTime = performance.now();

        // Cancel any existing loop before starting a new one (safety measure)
        if (gameLoopIntervalId) cancelAnimationFrame(gameLoopIntervalId);
        gameLoopIntervalId = requestAnimationFrame(mainGameLoop);

        // Update the patient data display and enable/disable appropriate buttons
        updatePlayerFixedDataUI();
        resetButton.disabled = false; startButton.disabled = true;
    });
}


// =============================================================================
// resetGame — Clean up everything and return to the initial state
// =============================================================================
//
// Stops the game loop, clears all data, resets all UI elements to their
// default values, and removes any active popup. Called when the player
// clicks "Reset Simulation" or after game over.
// =============================================================================
function resetGame() {
    // Stop the animation loop
    if (gameLoopIntervalId) { cancelAnimationFrame(gameLoopIntervalId); gameLoopIntervalId = null; }

    // Reset game state
    isPaused = true; pauseButton.textContent = "Genoptag"; game = null;
    cgmDataPoints = []; trueBgPoints = [];
    yAxisMax = 16.0; // Nulstil y-akse til standard

    // Remove any active popup (e.g., game over screen)
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) document.body.removeChild(existingPopup);

    // Reset all display elements to their default placeholder values
    dayDisplay.textContent="1"; timeDisplay.textContent="00:00";
    cgmValueDisplayGraph.textContent="-.-";
    normoPointsDisplay.textContent = "0.0";
    iobDisplay.textContent="0.0"; cobDisplay.textContent="0";

    // Reset stats table values to dashes
    document.querySelectorAll('.stats-table .value').forEach(el => el.textContent = '--');
    document.querySelectorAll('#tir24h, #tir14d, #titr24h, #titr14d').forEach(el => el.textContent = '--');
    document.querySelectorAll('#fastInsulin24h, #basalInsulin24h').forEach(el => el.textContent = '--');
    document.querySelector('#kcal24h').textContent = '--';
    [weightDisplay, icrDisplay, isfDisplay, carbEffectDisplay, basalDoseDisplay, restingKcalDisplay].forEach(el => el.textContent="--");

    // Reset weight slider
    weightChangeSlider.value = 0; weightChangeValue.textContent = "0.0";
    weightChangeSlider.style.setProperty('--thumb-color', '#4CAF50');

    // Toggle button states: can start, can't reset
    resetButton.disabled = true; startButton.disabled = false;

    // Ryd hændelsesloggen
    const logList = document.getElementById('event-log-list');
    if (logList) logList.innerHTML = '<div style="padding:4px; color:#a0aec0;">Ingen hændelser endnu</div>';

    // Redraw the empty graph
    drawGraph();
}


// =============================================================================
// togglePause — Pause or resume the simulation
// =============================================================================
//
// When pausing: the loop keeps running (for graph redraws) but update() is skipped.
// When resuming: we reset lastFrameTime to prevent a huge deltaTime spike
// (if we didn't, the simulation would "catch up" all the paused time at once).
// =============================================================================
function togglePause() {
    if (!game || game.isGameOver) return; // Can't pause if no game or already dead

    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "Genoptag" : "Pause";

    if (!isPaused) {
        // Reset the frame timer to prevent a time jump after unpausing
        lastFrameTime = performance.now();
        // Restart the loop if it was stopped
        if (!gameLoopIntervalId) gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
    }
}
