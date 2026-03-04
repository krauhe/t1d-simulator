// --- Main Game Loop Function ---
function mainGameLoop(currentTime) {
    if (game?.isGameOver) {
        if(gameLoopIntervalId) cancelAnimationFrame(gameLoopIntervalId);
        gameLoopIntervalId = null;
        return;
    }
    if (!isPaused) {
        const deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;
        game.update(deltaTime);
        updateUI();
    }
    drawGraph();
    gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
}

// --- Game Control Functions ---
function startGame() {
    if (sounds && Tone.context.state !== 'running') Tone.start();
    game = new Simulator();
    cgmDataPoints = [{ time: 0, value: game.cgmBG }];
    trueBgPoints = [{ time: 0, value: game.trueBG }];
    isPaused = false;
    pauseButton.textContent = "Pause";
    lastFrameTime = performance.now();
    if (gameLoopIntervalId) cancelAnimationFrame(gameLoopIntervalId);
    gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
    updatePlayerFixedDataUI();
    resetButton.disabled = false; startButton.disabled = true;
}

function resetGame() {
    if (gameLoopIntervalId) { cancelAnimationFrame(gameLoopIntervalId); gameLoopIntervalId = null; }
    isPaused = true; pauseButton.textContent = "Genoptag"; game = null;
    cgmDataPoints = []; trueBgPoints = [];
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) document.body.removeChild(existingPopup);

    dayDisplay.textContent="1"; timeDisplay.textContent="00:00";
    cgmValueDisplayGraph.textContent="-.-";
    normoPointsDisplay.textContent = "0.0";
    iobDisplay.textContent="0.0"; cobDisplay.textContent="0";
    document.querySelectorAll('.stats-table .value').forEach(el => el.textContent = '--');
    document.querySelectorAll('#tir24h, #tir14d, #titr24h, #titr14d').forEach(el => el.textContent = '--%');
    document.querySelectorAll('#fastInsulin24h, #basalInsulin24h').forEach(el => el.textContent = '-- E');
    document.querySelector('#kcal24h').textContent = '-- kcal';
    [icrDisplay, isfDisplay, carbEffectDisplay, restingKcalDisplay].forEach(el => el.textContent="--");
    weightChangeSlider.value = 0; weightChangeValue.textContent = "0.0";
    weightChangeSlider.style.setProperty('--thumb-color', '#4CAF50');

    resetButton.disabled = true; startButton.disabled = false;
    drawGraph();
}

function togglePause() {
    if (!game || game.isGameOver) return;
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "Genoptag" : "Pause";
    if (!isPaused) {
        lastFrameTime = performance.now();
        if (!gameLoopIntervalId) gameLoopIntervalId = requestAnimationFrame(mainGameLoop);
    }
}
