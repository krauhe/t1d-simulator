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
// isPhysiologyViewingActiveForScore — checks whether extra physiology display is active
// =============================================================================
//
// High scores should only be saved when the player uses the same information as
// in normal gameplay. The top-bar physiology mode, the true BG line, and the
// separate physiology window all count as training views.
// =============================================================================
function isPhysiologyViewingActiveForScore() {
    return !!(
        physiologyEffectsEnabled ||
        showInsulinBand ||
        showCarbBand ||
        showISFLine ||
        (appSettings && (appSettings.debugTrueBG || appSettings.physiologyDashboard))
    );
}


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

        // CLAMP deltaTime to [0, 0.5] real seconds.
        // Upper cap: when the tab is backgrounded, requestAnimationFrame pauses
        // while real time keeps ticking; without the cap, returning to the tab
        // would advance the simulation by minutes/hours in one giant step.
        // Lower cap: deltaTime can come out slightly negative right after
        // lastFrameTime is reset to performance.now() (on resume / popup close),
        // because the next rAF frame timestamp may be marginally earlier than
        // that performance.now() reading. A negative real-time delta is
        // meaningless, and feeding it to the engine throws (it correctly rejects
        // negative simMinutes), which would kill the game loop. Clamp to 0 so
        // such a frame simply advances nothing.
        if (deltaTime < 0) deltaTime = 0;
        else if (deltaTime > 0.5) deltaTime = 0.5;

        // Advance the physiological simulation by deltaTime
        game.update(deltaTime);

        // Campaign engine: check scheduled events, tips, objectives, and day-end
        if (campaignEngine && campaignEngine.levelActive) {
            campaignEngine.update(game);
        }

        // GLOBAL_TIPS: check in both public modes (Box Challenge and campaign).
        // Runs independently of campaignEngine so general tips also appear in Box Challenge.
        if (typeof checkGlobalTipsForAllModes === 'function') {
            checkGlobalTipsForAllModes(game);
        }

        // Refresh all numeric displays (day, time, CGM, IOB, COB, points)
        updateUI();

        // Symptom sounds only play while the simulation is advancing.
        // playSound handles SFX-mute and long cooldowns internally.
        if (typeof updateSymptomAudio === 'function') updateSymptomAudio();
    }

    // Always redraw the graph (even when paused, for responsive resizing)
    drawGraph();

    // Update visual symptom effects (CSS blur, desaturation, vignette)
    // Called every frame for smooth lerp transitions
    if (typeof updateSymptomEffects === 'function') updateSymptomEffects();

    // Schedule the next frame — this creates the continuous loop
    // gameLoopIntervalId stores the rAF handle so we can cancel it later
    gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
}


// =============================================================================
// startGame — Resolve the selected fixed character, then start a session
// =============================================================================
//
// The public app persists only a character id. Weight, ICR and ISF are resolved
// from the fixed character table immediately before Simulator is constructed.
// =============================================================================
// GAME_MODES — de spiltilstande, som den offentlige app tilbyder.
// =============================================================================
// Registreret bruges både af start-flowet og til at afvise direkte kald til
// tilstande, som ikke er en del af den offentlige udgivelse.
const GAME_MODES = {
    campaign:     { group: 'play', order: 1, labelKey: 'mode.campaign',     descKey: 'mode.campaign.desc',     icon: 'mode-campaign.png' },
    boxchallenge: { group: 'play', order: 2, labelKey: 'mode.boxchallenge', descKey: 'mode.boxchallenge.desc', icon: 'mode-box-challenge.png' }
};

function isGameModeEnabled(mode) {
    const descriptor = GAME_MODES[mode];
    return !!descriptor
        && (typeof descriptor.enabled !== 'function' || descriptor.enabled());
}

function startGame(mode = 'campaign') {
    if (!isGameModeEnabled(mode)) {
        console.warn(`startGame: mode "${mode}" er ikke tilgængelig i denne runtime`);
        return false;
    }

    // Tone.js requires a user gesture to start the audio context (browser security policy).
    // We attempt to start it here on the first button click.
    if (sounds && Tone.context.state !== 'running') Tone.start();

    // Den offentlige app konstruerer altid motoren fra den valgte fiktive karakter.
    const profile = loadFixedCharacterProfile();

    // If physiology viewing is already active before game start, the player must
    // see the highscore warning before the session begins — otherwise the score
    // feels disqualified without a real choice having been made.
    if (isPhysiologyViewingActiveForScore() && typeof showPhysiologyConfirmDialog === 'function') {
        showPhysiologyConfirmDialog(
            () => startGameWithProfile(profile, mode),
            () => {
                if (typeof activatePhysiologyMode === 'function') activatePhysiologyMode(false);
                if (appSettings) {
                    appSettings.debugTrueBG = false;
                    appSettings.physiologyDashboard = false;
                    saveSettings(appSettings);
                }
                if (debugTrueBgCheckbox) debugTrueBgCheckbox.checked = false;
                if (physiologyWindow && !physiologyWindow.closed) {
                    physiologyWindow.close();
                    physiologyWindow = null;
                }
                if (typeof syncPhysiologyToggles === 'function') syncPhysiologyToggles();
                startGameWithProfile(profile, mode);
            }
        );
        return;
    }

    // Start the game with the saved/default profile and selected mode
    return startGameWithProfile(profile, mode);
}

// =============================================================================
// startGameWithProfile — Starts the game with a given profile
// =============================================================================
// Separated from startGame() so both the Start button (direct) and the Profile
// popup (after editing) can start the game via the same function.
// =============================================================================
function startGameWithProfile(profile, mode = 'campaign') {
    if (!isGameModeEnabled(mode)) {
        console.warn(`startGameWithProfile: mode "${mode}" er ikke tilgængelig i denne runtime`);
        return false;
    }

    // Håndhæv profilkontrakten igen, fordi funktionen ligger i globalt scope og
    // derfor kan kaldes direkte fra browserkonsollen.
    profile = loadFixedCharacterProfile();

    // Store the selected mode globally so UI functions can access it
    currentGameMode = mode;

    // A4b: refresh the character header in the BG panel so it reflects the
    // character chosen for this round.
    if (typeof updateCgmCharacter === 'function') updateCgmCharacter();

    // GoatCounter: record which mode/level the player starts.
    // Logged as a "virtual page view" so the dashboard shows the split
    // between Box Challenge and individual campaign levels.
    // Only runs if goatcounter is loaded (i.e., on the live site, not localhost).
    try {
        if (typeof window !== 'undefined' && window.goatcounter && typeof window.goatcounter.count === 'function') {
            let path, title;
            if (mode === 'campaign' && typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelConfig) {
                const levelNum = campaignEngine.levelConfig.number;
                path = '/campaign/level-' + levelNum;
                title = 'Campaign — Level ' + levelNum;
            } else if (mode === 'boxchallenge') {
                path = '/boxchallenge';
                title = 'Box Challenge';
            }
            window.goatcounter.count({ path: path, title: title, event: false });
        }
    } catch (e) { /* analytics must never crash the game */ }

    // Reset training-mode flag for the new session.
    // If physiology viewing is already on at start, the attempt is still not
    // highscore-valid, but the game-over popup does not need to repeat the
    // message because the player already accepted it before starting.
    trainingModeStartedThisSession = isPhysiologyViewingActiveForScore();
    trainingModeUsedThisSession = trainingModeStartedThisSession;

    // Reset per-level tip state at each new game/level (music roll may only happen once per session)
    if (typeof tipSessionState !== 'undefined') {
        tipSessionState._musicTipRolledThisLevel = false;
        tipSessionState._lastAnyTipShownAt = -Infinity;
    }

    // Update game mode indicator in the points panel
    const modeName = document.getElementById('gameModeName');
    const capsuleCampaignHeader = document.getElementById('capsuleCampaignHeader');
    if (modeName) {
        const modeNames = { boxchallenge: 'Box Challenge', campaign: 'Campaign' };
        modeName.textContent = modeNames[mode] || modeNames.campaign;
        // Box Challenge: show simple mode name, hide campaign header.
        // Campaign: the reverse — populated further down once levelConfig is ready.
        if (mode === 'campaign') {
            modeName.style.display = 'none';
            if (capsuleCampaignHeader) capsuleCampaignHeader.style.display = '';
        } else {
            modeName.style.display = '';
            if (capsuleCampaignHeader) capsuleCampaignHeader.style.display = 'none';
        }
    }
    // Reset dayTotalDisplay (only shown in campaign — set further down)
    const dayTotalEl = document.getElementById('dayTotalDisplay');
    if (dayTotalEl) {
        if (mode === 'campaign') {
            // Shown once levelConfig is known (in the campaign block below)
            dayTotalEl.style.display = '';
        } else {
            dayTotalEl.textContent = '';
            dayTotalEl.style.display = 'none';
        }
    }

    // Clear any game-over overlay and view-mode from the previous game
    // (important when startGame() is called without resetGame(), e.g. via spacebar)
    if (typeof exitGameOverView === 'function') exitGameOverView();
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) existingPopup.remove();

    // Create a new Simulator with the resolved fictional model subject and mode.
    // Inject the active campaign level's config (or null) so the facade does not
    // reach into the global campaignEngine — keeps the model usable standalone.
    game = new Simulator(profile, mode, {
        levelConfig: (mode === 'campaign' && typeof campaignEngine !== 'undefined' && campaignEngine)
            ? campaignEngine.levelConfig : null,
    });

    // Initialize the graph data arrays with the starting BG value
    cgmDataPoints = [{ time: 0, value: game.cgmBG }];
    trueBgPoints = [{ time: 0, value: game.trueBG }];
    physiologyDataPoints = [];  // Clear insulin band/physiology data from the previous game
    yAxisMax = 16.0; yAxisTarget = 16.0; yAxisShrinkTimer = 0; // Reset y-axis

    // Unpause and start the loop
    isPaused = false;
    if (typeof updateSpeedStepperUI === 'function') updateSpeedStepperUI();

    // Record the current time as the reference point for deltaTime calculations
    lastFrameTime = performance.now();

    // Cancel any existing loop before starting a new one (safety measure)
    if (gameLoopIntervalId) cancelAnimationFrame(gameLoopIntervalId);
    gameLoopIntervalId = requestAnimationFrame(mainGameLoop);

    if (typeof updateFoodChips === 'function') updateFoodChips();
    // Fill the insulin popup's basal presets immediately from the profile, so
    // they show real doses from the start instead of the "-- U" placeholder
    // (otherwise they only populate on the first game-loop tick).
    if (typeof updateBasalPresetUI === 'function') updateBasalPresetUI();

    // Show the BG-forces panel if the toggle is active (clears placeholder → live data)
    if (physiologyEffectsEnabled) {
        const fxPanel = document.getElementById('physiology-effects');
        if (fxPanel) fxPanel.style.display = 'block';
        _lastEffectsData = [];  // Forces first update
    }

    // Convert the Start button to a red Stop button.
    // Also update the data-i18n attributes so translateDOM() does not overwrite the text.
    startButton.textContent = t('ui.btn.stop');
    startButton.title = t('ui.title.stop');
    startButton.setAttribute('data-i18n', 'ui.btn.stop');
    startButton.setAttribute('data-i18n-title', 'ui.title.stop');
    startButton.classList.add('game-running');
    // Profile button remains active during game — opens in read-only mode

    // (#12) Set the sound button to the correct initial icon
    const muteIcon = document.getElementById('muteIcon');
    if (muteIcon) muteIcon.textContent = (isMuted && isMusicMuted) ? '\u{1F507}' : '\u{1F50A}';

    // Campaign: start the level flow (objectives overlay, intro popup)
    if (mode === 'campaign' && campaignEngine && campaignEngine.levelConfig) {
        campaignEngine.startCampaignLevel();
        // Populate the 2-line campaign header in the points capsule:
        //   Line 1: "LEVEL X" (reuses campaign.levelLabel i18n key)
        //   Line 2: level theme/title (from levelConfig.titleKey)
        const labelEl = document.getElementById('capsuleLevelLabel');
        const titleEl = document.getElementById('capsuleLevelTitle');
        const levelNum = campaignEngine.levelConfig.number;
        if (labelEl) labelEl.textContent = t('campaign.levelLabel', {n: levelNum});
        if (titleEl && campaignEngine.levelConfig.titleKey) {
            titleEl.textContent = t(campaignEngine.levelConfig.titleKey);
        }
        // Set dayTotalDisplay to "/Y" where Y = total days in the level
        const totalDays = Math.round((campaignEngine.levelConfig.durationMinutes || 1440) / 1440);
        const dayTotalEl2 = document.getElementById('dayTotalDisplay');
        if (dayTotalEl2) {
            dayTotalEl2.textContent = '/' + totalDays;
            dayTotalEl2.style.display = '';
        }
    }

    // Start background music (if enabled by the user)
    if (typeof startMusic === 'function') startMusic();
    return true;
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

    // Reset the physiology dashboard (clear buffer so it does not show stale data)
    if (physiologyWindow && !physiologyWindow.closed) {
        try { physiologyWindow.postMessage({ type: 'physiology-reset' }, '*'); } catch(e) {}
    }

    // Background music is intentionally NOT stopped here. It plays continuously across
    // the menu and gameplay; it only stops when the player turns the music switch off
    // (toggleMusic -> stopMusic). Returning to the menu after a game keeps the music on.

    // Reset game state
    isPaused = true; game = null;
    if (typeof updateSpeedStepperUI === 'function') updateSpeedStepperUI();
    cgmDataPoints = []; trueBgPoints = []; physiologyDataPoints = [];
    yAxisMax = 16.0; yAxisTarget = 16.0; yAxisShrinkTimer = 0; // Reset y-axis to default

    // Reset sleep-overlay state (function properties on drawSymptomOverlay)
    if (typeof drawSymptomOverlay !== 'undefined') {
        drawSymptomOverlay._smoothBG = undefined;
        drawSymptomOverlay._wasNight = false;
        drawSymptomOverlay._nightStartReal = 0;
        drawSymptomOverlay._popRealTime = 0;
        drawSymptomOverlay._sleepResumedReal = null;
        drawSymptomOverlay._lastAwakeSim = -Infinity;
    }

    // Clear game-over view mode (if active)
    if (typeof exitGameOverView === 'function') exitGameOverView();

    // Remove any active popup (e.g., game over screen)
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) document.body.removeChild(existingPopup);

    // Reset all display elements to their default placeholder values
    dayDisplay.textContent="1"; timeDisplay.textContent="00:00";
    cgmValueDisplayGraph.textContent="-.-";
    normoPointsDisplay.textContent = "0.0";
    iobDisplay.textContent="0.0"; cobDisplay.textContent="0";

    // Reset stats fragment in the capsule bar
    if (statsTirValue) { statsTirValue.textContent = '—'; statsTirValue.style.color = ''; }
    if (statsAvgBgValue) { statsAvgBgValue.textContent = '—'; statsAvgBgValue.style.color = ''; }
    if (statsWeightValue) { statsWeightValue.textContent = '0 kcal'; statsWeightValue.style.color = ''; }

    // Reset weight change
    if (weightChangeValue) { weightChangeValue.textContent = "0.0"; weightChangeValue.style.color = ''; }

    // Reset debug panel values to '--'
    document.querySelectorAll('#debugLiveValues .dp-val').forEach(el => el.textContent = '--');

    // Restore the Start button from Stop to Start.
    // Also restore the data-i18n attributes to the start keys.
    startButton.textContent = t('ui.btn.start');
    startButton.title = t('ui.title.start');
    startButton.setAttribute('data-i18n', 'ui.btn.start');
    startButton.setAttribute('data-i18n-title', 'ui.title.start');
    startButton.classList.remove('game-running');
    // Profile button — no btn-inactive to remove (always active, read-only during game)

    // Clear floating labels (DOM elements from finger-prick/ketone-stick readings)
    document.querySelectorAll('.floating-label').forEach(el => el.remove());

    // Reset kit-chip cooldowns (remove visual cooldown state)
    document.querySelectorAll('.kit-chip.on-cooldown').forEach(btn => {
        btn.classList.remove('on-cooldown');
        btn.style.removeProperty('pointer-events');
        btn.style.removeProperty('--cooldown-pct');
    });
    // Restore kit-chip labels to their original names
    const fpName = document.querySelector('#fingerprickButton .pc-name');
    if (fpName) fpName.textContent = t('kit.fingerprick');
    const ktName = document.querySelector('#ketoneTestButton .pc-name');
    if (ktName) ktName.textContent = t('kit.ketone');
    const glName = document.querySelector('#kitGlucagonButton .pc-name');
    if (glName) glName.textContent = t('kit.glucagon');

    // Reset activity UI (hide overlay, show setup)
    if (typeof hideActivityActive === 'function') hideActivityActive();

    // Hide lives display and day points (Box Challenge)
    const livesEl = document.getElementById('livesDisplay');
    if (livesEl) livesEl.style.display = 'none';
    const dayPointsEl = document.getElementById('dayPointsDisplay');
    if (dayPointsEl) dayPointsEl.style.display = 'none';

    // Reset campaign state and hide info button
    if (campaignEngine) campaignEngine.levelActive = false;
    const campInfoBtn = document.getElementById('campaignInfoBtn');
    if (campInfoBtn) campInfoBtn.style.display = 'none';
    // Remove campaign-disabled classes from dock items
    document.querySelectorAll('.campaign-disabled').forEach(el => el.classList.remove('campaign-disabled'));
    // Remove tutorial-highlight classes
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

    currentGameMode = 'campaign';

    // BG-forces: show placeholder state if the toggle is active, otherwise hide
    const fxPanel = document.getElementById('physiology-effects');
    const fxList = document.getElementById('effectsList');
    if (fxPanel && fxList) {
        if (physiologyEffectsEnabled) {
            fxList.innerHTML = _effectsPlaceholderHTML();
            fxPanel.style.display = 'block';
        } else {
            fxList.innerHTML = '';
            fxPanel.style.display = 'none';
        }
    }
    _lastEffectsData = [];

    // Reset visual symptom effects (remove blur/vignette)
    const vfxContainer = document.getElementById('game-container');
    const vfxVignette = document.getElementById('symptom-vignette');
    if (vfxContainer) vfxContainer.style.filter = '';
    if (vfxVignette) vfxVignette.style.opacity = '0';

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
    // Pause-tip tracker: record when the player last used the pause button
    game.lastPauseTime = game.totalSimMinutes;
    if (typeof updateSpeedStepperUI === 'function') updateSpeedStepperUI();

    if (!isPaused) {
        // Reset the frame timer to prevent a time jump after unpausing
        lastFrameTime = performance.now();
        // Restart the loop if it was stopped
        if (!gameLoopIntervalId) gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
    }
    // Music continues during pause — the player can think undisturbed while the atmosphere is preserved.
}
