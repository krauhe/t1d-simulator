// =============================================================================
// UI.JS — User Interface rendering: graph, popups, logging, display updates
// =============================================================================
//
// This file handles everything the player SEES:
//   - updateUI(): refreshes the top-bar numbers (day, time, CGM, IOB, COB, points)
//   - drawGraph(): renders the blood glucose graph on an HTML5 Canvas element
//   - showPopup() / showHelpPopup(): modal dialogs for events and game over
//   - logEvent(): records events in the game's event history
//   - updateFoodDisplay() / updateMotionKcal(): updates calorie displays in the UI
//
// The graph is the centerpiece of the game — it shows:
//   - CGM data points (green = in range, red = out of range)
//   - Optional true BG line (debug mode)
//   - Color-coded BG zones (green = target, red = danger)
//   - Event icons (food, insulin, exercise) placed at their timestamps
//   - Temporary messages (basal reminders, night intervention warnings)
//
// Canvas basics (for MATLAB users):
//   HTML5 Canvas is like MATLAB's figure/axes but lower-level. You draw
//   shapes and text with explicit commands (moveTo, lineTo, fillRect, etc.)
//   instead of plot(). The coordinate system has (0,0) at top-left, with
//   y increasing downward (opposite to MATLAB's default). We use padding
//   and coordinate transforms to create a proper chart area.
//
// Dependencies (global): game (Simulator), cgmDataPoints, trueBgPoints,
//   MAX_GRAPH_POINTS_PER_DAY, isPaused, various DOM element references
//
// Exports (global): updateUI(), drawGraph(), showHelpPopup(), showPopup(),
//   logEvent(), updateFoodDisplay(), updateMotionKcal(), updatePlayerFixedDataUI()
// =============================================================================


// =============================================================================
// updateUI — Refresh the numeric displays in the top bar
// =============================================================================
//
// Called every frame by the game loop. Updates:
//   - Day counter and clock (HH:MM format)
//   - CGM glucose reading (what the player sees as their "current BG")
//   - IOB (Insulin On Board) — helps player avoid insulin stacking
//   - COB (Carbs On Board) — shows remaining undigested food
//   - Normoglycemia points (the score)
// =============================================================================
function updateUI() {
    if (!game) return; // Guard: no game instance yet

    dayDisplay.textContent = game.day;

    // Format time as HH:MM with zero-padding
    // Ved høje hastigheder rundes minuttallet ned til nærmeste 5 eller 10
    // for at undgå at tiden blinker kaotisk hurtigt i displayet.
    const hours = String(Math.floor(game.timeInMinutes / 60)).padStart(2, '0');
    let rawMinutes = Math.floor(game.timeInMinutes % 60);
    const speed = game.simulationSpeed || 60;
    if (speed >= 1440) rawMinutes = Math.floor(rawMinutes / 10) * 10;       // 24t/min → vis pr. 10 min
    else if (speed >= 720) rawMinutes = Math.floor(rawMinutes / 5) * 5;     // 12t/min → vis pr. 5 min
    const minutes = String(rawMinutes).padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}`;

    // Display values with appropriate precision
    cgmValueDisplayGraph.textContent = game.cgmBG.toFixed(1);  // 1 decimal (e.g., "6.3")
    iobDisplay.textContent = game.iob.toFixed(1);              // 1 decimal (e.g., "2.4")
    cobDisplay.textContent = game.cob.toFixed(0);              // Integer (e.g., "45")
    normoPointsDisplay.textContent = game.normoPoints.toFixed(1);

    // Opdater hændelsesloggen under grafen
    updateEventLog();
}

// =============================================================================
// updatePlayerFixedDataUI — Display the patient's fixed diabetes parameters
// =============================================================================
//
// Shows ICR, ISF, carb effect, and resting calorie burn in the stats panel.
// These values don't change during gameplay (they're the patient's profile).
// If no game is running, shows default values.
// =============================================================================
function updatePlayerFixedDataUI() {
    const tempSim = game || { ICR: 10, ISF: 3.0, gramsPerMmolRise: 3.3, weight: 70, restingKcalPerDay: 2200, basalDose: 15 };
    weightDisplay.textContent = tempSim.weight;                      // e.g., "70"
    icrDisplay.textContent = tempSim.ICR;                            // e.g., "10"
    isfDisplay.textContent = tempSim.ISF.toFixed(1);                 // e.g., "3.0"
    carbEffectDisplay.textContent = tempSim.gramsPerMmolRise.toFixed(1); // e.g., "3.3"
    basalDoseDisplay.textContent = tempSim.basalDose;                // e.g., "15"
    restingKcalDisplay.textContent = Math.round(tempSim.restingKcalPerDay); // e.g., "2200"
}

// =============================================================================
// drawGraph — Render the blood glucose chart on the HTML5 Canvas
// =============================================================================
//
// This is the most complex rendering function. It draws:
//   1. Background zones (green for target range, red for danger zones)
//   2. Night shading (22:00-07:00)
//   3. Horizontal reference lines at key BG thresholds
//   4. Axis labels and tick marks
//   5. True BG line (if debug mode is enabled)
//   6. CGM data points (colored dots: green = in range, red = out of range)
//   7. Finger prick measurements (blood drop emoji)
//   8. Event icons (food, insulin, exercise) along the bottom
//   9. Temporary graph messages (reminders, warnings)
//
// The graph shows one day (24 hours) at a time, determined by game.day.
// Y-axis auto-scales: starts at 0-12, expands up to 25 if BG goes high.
//
// Canvas coordinate system:
//   (0,0) is top-left of the canvas.
//   x increases to the right (time: 00:00 → 24:00)
//   y increases DOWNWARD (so high BG values are at the top = lower y pixel values)
//
// To convert between BG values and pixel coordinates:
//   y_pixel = padding.top + graphHeight - (bgValue / range) * graphHeight
//   x_pixel = padding.left + (timeInDay / 1440) * graphWidth
// =============================================================================

// yAxisMax: dynamic upper limit of the y-axis. Starts at 16 mmol/L,
// expands to 21 when readings exceed 15, then further in steps of 2 (max 35).
// Contracts back to 16 when values drop below 14.
let yAxisMax = 16.0;

function drawGraph() {
    if (!bgGraphCanvas) return; // Guard against premature calls before DOM is ready

    // --- Canvas setup ---
    // Handle high-DPI displays (e.g., Retina): scale canvas pixels by devicePixelRatio
    // so everything looks crisp. Without this, the graph would look blurry on 2x screens.
    const rect = bgGraphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    bgGraphCanvas.width = rect.width * dpr;
    bgGraphCanvas.height = rect.height * dpr;
    graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- Dynamic y-axis scaling ---
    // Find the highest CGM value currently visible on the graph
    let currentMaxCGMOnGraph = 0;
    const visibleCGMPoints = cgmDataPoints.slice(-MAX_GRAPH_POINTS_PER_DAY);
    visibleCGMPoints.forEach(p => { if (p.value > currentMaxCGMOnGraph) currentMaxCGMOnGraph = p.value; });

    // Expand y-axis: først til 21 når BG > 15, derefter i trin af 2 (max 35).
    // Contract: tilbage til 16 når BG falder under 14.
    if (currentMaxCGMOnGraph > 15 && yAxisMax < 21) yAxisMax = 21;
    else if (currentMaxCGMOnGraph > 19 && yAxisMax < Math.min(35, currentMaxCGMOnGraph + 2)) yAxisMax = Math.ceil((currentMaxCGMOnGraph + 2) / 2) * 2;
    if (currentMaxCGMOnGraph < 14.0 && yAxisMax > 16.0) yAxisMax = 16.0;
    const range = yAxisMax - 0; if (range <= 0) return;

    // --- Chart area dimensions ---
    // Padding leaves room for axis labels and tick marks
    const padding = {top: 20, right: 20, bottom: 40, left: 58};
    graphCtx.clearRect(0, 0, bgGraphCanvas.width, bgGraphCanvas.height);
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;
    if (graphWidth <= 0 || graphHeight <= 0) return;

    // --- Night shading (22:00-07:00) ---
    // Light grey-blue overlay to indicate nighttime hours
    const totalMinutesInView = 24 * 60; // 1440 minutes = one full day
    const xNightStart = padding.left + ((22 * 60) / totalMinutesInView) * graphWidth;
    const xNightEnd = padding.left + ((7 * 60) / totalMinutesInView) * graphWidth;
    graphCtx.fillStyle = 'rgba(60, 60, 80, 0.1)';
    graphCtx.fillRect(xNightStart, padding.top, graphWidth - (xNightStart - padding.left), graphHeight); // 22:00 to midnight
    graphCtx.fillRect(padding.left, padding.top, xNightEnd - padding.left, graphHeight);                  // Midnight to 07:00

    // --- BG zone coloring ---
    // Green zone: 4.0-10.0 mmol/L (target range, 1x points)
    // Orange zone: 10.0-14.0 mmol/L (elevated hyper, 0.5x points)
    // Red zones: below 4.0 (hypo, akut farligt) og above 14.0 (høj hyper, 0 points)
    const zones = [
        { min: 4.0, max: 10.0, color: 'rgba(72, 187, 120, 0.15)' },     // Grøn: target
        { min: 0, max: 3.99, color: 'rgba(229, 62, 62, 0.12)' },         // Rød: hypo — akut fare
        { min: 10.01, max: 14.0, color: 'rgba(214, 158, 46, 0.10)' },    // Orange: forhøjet hyper
        { min: 14.01, max: yAxisMax, color: 'rgba(229, 62, 62, 0.10)' }, // Rød: høj hyper
    ];
    zones.forEach(zone => {
        // Convert BG values to pixel y-coordinates (remember: y is inverted on canvas)
        const y_max_px = padding.top + graphHeight - ((zone.min) / range) * graphHeight;
        const y_min_px = padding.top + graphHeight - ((zone.max) / range) * graphHeight;
        graphCtx.fillStyle = zone.color;
        graphCtx.fillRect(padding.left, y_min_px, graphWidth, y_max_px - y_min_px);
    });

    // --- Fatal hypo threshold line (1.5 mmol/L) ---
    // Kun denne ene linje tegnes — zone-farverne kommunikerer de øvrige grænser.
    const yHypo = padding.top + graphHeight - (1.5 / range) * graphHeight;
    graphCtx.beginPath();
    graphCtx.moveTo(padding.left, yHypo);
    graphCtx.lineTo(padding.left + graphWidth, yHypo);
    graphCtx.strokeStyle = 'rgba(229, 62, 62, 0.8)';
    graphCtx.lineWidth = 2;
    graphCtx.setLineDash([2, 2]);
    graphCtx.stroke();
    graphCtx.setLineDash([]);

    // --- Bonus zone baggrund (5.0-6.0 mmol/L) — tydeligere markering ---
    const bonusYtop = padding.top + graphHeight - (6.0 / range) * graphHeight;
    const bonusYbot = padding.top + graphHeight - (5.0 / range) * graphHeight;
    graphCtx.fillStyle = 'rgba(72, 187, 120, 0.12)';
    graphCtx.fillRect(padding.left, bonusYtop, graphWidth, bonusYbot - bonusYtop);

    // --- Chart border ---
    graphCtx.strokeStyle = '#a0aec0'; graphCtx.lineWidth = 1;
    graphCtx.strokeRect(padding.left, padding.top, graphWidth, graphHeight);

    // --- X-axis labels (time of day, every 2 hours) ---
    graphCtx.fillStyle = '#4a5568'; graphCtx.font = "bold 12px Segoe UI";
    for (let i = 0; i <= 24; i += 2) {
        const x = padding.left + ( (i*60 / totalMinutesInView ) * graphWidth );
        graphCtx.fillText(`${String(i).padStart(2,'0')}:00`, x - 15, padding.top + graphHeight + 20);
    }

    // --- Y-axis labels (BG values in mmol/L) ---
    // Step size depends on axis range: use steps of 2 for large ranges, 1 for small
    const yStep = range > 15 ? 2 : 1;
    for (let i = Math.ceil(0); i <= yAxisMax; i += yStep) {
        if (i === 0 && yAxisMax > 2) continue; // Skip 0 label if axis is large
        const y = padding.top + graphHeight - ((i) / range) * graphHeight;
        graphCtx.fillText(i.toFixed(0), padding.left - 30, y + 4);
    }

    // --- Y-axis label (rotated text: "Blodsukker (mmol/L)") ---
    // save/restore preserves the current canvas state around the rotation
    graphCtx.save(); graphCtx.translate(12, padding.top + graphHeight/2); graphCtx.rotate(-Math.PI/2);
    graphCtx.textAlign = "center"; graphCtx.font = "bold 12px Segoe UI"; graphCtx.fillText("Blodsukker (mmol/L)", 0, 0); graphCtx.restore();

    if (!game) return; // No data to plot if game hasn't started

    // --- Determine which day's data to show ---
    const currentDayStartMinutes = (game.day - 1) * totalMinutesInView;

    // --- True BG line (debug mode only) ---
    // When the debug checkbox is enabled, draw the actual BG as a blue line.
    // This reveals the "ground truth" that the CGM is trying to approximate.
    if(debugTrueBgCheckbox.checked) {
        const points = trueBgPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
        graphCtx.beginPath();
        points.forEach((p, i) => {
            const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            const y = padding.top + graphHeight - ((p.value) / range) * graphHeight;
            if (i === 0) graphCtx.moveTo(x, y); else graphCtx.lineTo(x, y);
        });
        graphCtx.strokeStyle = 'rgba(100, 100, 255, 0.7)'; graphCtx.lineWidth = 2; graphCtx.stroke();
    }

    // --- CGM data points ---
    // Each CGM reading is drawn as a small colored circle:
    //   Green: within target range (4.0-10.0 mmol/L)
    //   Red: outside target range (hypo or hyper)
    // Finger prick measurements are shown as blood drop emojis instead.
    const pointsToDraw = cgmDataPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
    pointsToDraw.forEach(p => {
        const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
        const y = padding.top + graphHeight - ((p.value) / range) * graphHeight;
        if (y < padding.top || y > padding.top + graphHeight) return; // Skip if off-screen

        if (p.type === 'fingerprick') {
            // Finger prick: draw blood drop emoji at the measurement point
            graphCtx.font = '16px Arial';
            graphCtx.textAlign = 'center';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = '#e53e3e';
            graphCtx.fillText('🩸', x, y);
        } else {
            // Regular CGM reading: small colored circle
            // Farver afspejler scoring-zoner: grøn=target, orange=forhøjet, rød=fare
            graphCtx.beginPath();
            graphCtx.arc(x, y, 3, 0, 2 * Math.PI); // 3px radius circle
            if (p.value < 4.0 || p.value > 14.0) graphCtx.fillStyle = '#e53e3e';      // Rød: akut fare
            else if (p.value > 10.0) graphCtx.fillStyle = '#d69e2e';                    // Orange: forhøjet
            else graphCtx.fillStyle = '#38a169';                                         // Grøn: i target
            graphCtx.fill();
        }
    });

    // --- Event icons along the bottom of the graph ---
    // Food (emoji), insulin (syringe/pen), and exercise icons are drawn at
    // the x-position corresponding to their timestamp, near the bottom of the chart.
    game.logHistory.forEach(event => {
        if (event.time >= currentDayStartMinutes && event.time < currentDayStartMinutes + totalMinutesInView) {
            const x = padding.left + ((event.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            let yPos = padding.top + graphHeight - 10; // Near the bottom of the chart
            graphCtx.textAlign = "center";
            graphCtx.font = "14px Arial";

            if(event.type === 'ketone-test') {
                // Keton-stik: blivende ikon på x-aksen med ketonværdi
                graphCtx.fillStyle = '#805ad5'; // Lilla — matcher keton-knappen
                graphCtx.fillText('🧪', x, yPos);
                graphCtx.font = "bold 9px Segoe UI";
                graphCtx.fillStyle = '#805ad5';
                const ketonVal = event.details.value || '';
                graphCtx.fillText(ketonVal, x, yPos - 12);
            } else if(event.type === 'food') {
                const icon = event.details.icon || '🍴';
                graphCtx.fillText(icon, x, yPos);
                // For custom meals (not presets), show carb equivalent (KE) label
                if (icon === '🍴') {
                    const carbs = event.details.carbs || 0;
                    const protein = event.details.protein || 0;
                    const ke = (carbs + protein * 0.25).toFixed(0);
                    graphCtx.font = "bold 9px Segoe UI";
                    graphCtx.fillStyle = '#333';
                    graphCtx.fillText(`${ke}g`, x, yPos - 12);
                }
            } else if (event.type === 'motion') {
                graphCtx.fillText(event.icon, x, yPos);
            } else if(event.type.includes('insulin')) {
                // Color-coded: blue for basal, red for fast-acting
                graphCtx.fillStyle = event.type === 'insulin-basal' ? '#2b6cb0' : '#c53030';
                graphCtx.fillText(event.icon, x, yPos);
                // Show dose amount above the icon
                graphCtx.font = "bold 10px Segoe UI";
                const doseText = event.details.dose.toFixed(event.type === 'insulin-fast' ? 1 : 0);
                graphCtx.fillText(doseText, x, yPos - 12);
            }
        }
    });

    // --- Temporary graph messages (reminders, warnings) ---
    // These are transient messages displayed over the graph, e.g.,
    // "Remember basal insulin" or "Night intervention" with sleep animation.
     game.graphMessages.forEach(msg => {
        const xCenter = padding.left + graphWidth / 2;
        const yPos = padding.top + 25;
        graphCtx.fillStyle = "rgba(255, 240, 150, 0.9)";
        graphCtx.strokeStyle = "#FFC107";
        graphCtx.lineWidth = 2;
        graphCtx.textAlign = "center";
        graphCtx.font = "bold 13px Segoe UI";
        const textWidth = graphCtx.measureText(msg.text).width;

        if (msg.text.startsWith("zZzz")) {
            // Natlig intervention: vis diskret i øverste højre hjørne af grafen
            // med en svag blå farve og let svaj-animation.
            graphCtx.globalAlpha = 0.5;
            graphCtx.font = "italic bold 13px Segoe UI";
            graphCtx.fillStyle = "#63b3ed"; // Lys blå — søvnig stemning
            graphCtx.textAlign = "right";
            const xPos = padding.left + graphWidth - 10;
            const yPos = padding.top + 18;
            const xOffset = Math.sin(game.totalSimMinutes / 20) * 3; // Let vandret svaj
            graphCtx.fillText(msg.text, xPos + xOffset, yPos);
            graphCtx.textAlign = "center"; // Reset
            graphCtx.globalAlpha = 1.0;
        } else {
            // Standard message: yellow rounded rectangle with text
            graphCtx.fillRect(xCenter - textWidth/2 - 10, yPos - 20, textWidth + 20, 30);
            graphCtx.strokeRect(xCenter - textWidth/2 - 10, yPos - 20, textWidth + 20, 30);
            graphCtx.fillStyle = "#333";
            graphCtx.fillText(msg.text, xCenter, yPos);
        }
    });

    // --- Floating labels (animerede måleresultater) ---
    // Disse popper op fra et målepunkt på grafen og svæver opad mens de fader ud.
    // Bruges til fingerprik og keton-stik — spil-agtigt visuelt feedback.
    // Cleanup: fjern labels der er udløbet.
    if (game.floatingLabels) {
        game.floatingLabels = game.floatingLabels.filter(lbl =>
            (game.totalSimMinutes - lbl.createdAt) < lbl.duration);

        game.floatingLabels.forEach(lbl => {
            // Kun tegn labels fra den aktuelle dag
            if (lbl.time < currentDayStartMinutes || lbl.time >= currentDayStartMinutes + totalMinutesInView) return;

            const progress = (game.totalSimMinutes - lbl.createdAt) / lbl.duration; // 0→1
            const x = padding.left + ((lbl.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            const baseY = padding.top + graphHeight - ((lbl.value) / range) * graphHeight;

            // Animation: start 30px OVER kurven og svæv yderligere 25px opad
            // Sikrer at labelen ikke dækker for data-punkterne
            const yOffset = -30 - 25 * progress;    // Start over kurven, bevæg videre op
            const alpha = 1.0 - progress * 0.8;     // Fade: 1.0 → 0.2
            const y = baseY + yOffset;

            if (y < padding.top - 20 || y > padding.top + graphHeight + 20) return;

            graphCtx.save();
            graphCtx.globalAlpha = alpha;
            graphCtx.font = "bold 13px Segoe UI";
            graphCtx.textAlign = "center";

            // Baggrund-boks med afrundede hjørner
            const textWidth = graphCtx.measureText(lbl.text).width;
            const boxX = x - textWidth / 2 - 6;
            const boxY = y - 12;
            const boxW = textWidth + 12;
            const boxH = 20;
            graphCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
            graphCtx.strokeStyle = lbl.color;
            graphCtx.lineWidth = 1.5;
            // Afrundet rektangel
            graphCtx.beginPath();
            graphCtx.roundRect(boxX, boxY, boxW, boxH, 4);
            graphCtx.fill();
            graphCtx.stroke();

            // Tekst
            graphCtx.fillStyle = lbl.color;
            graphCtx.fillText(lbl.text, x, y + 2);
            graphCtx.restore();
        });
    }
}


// =============================================================================
// POPUP FUNCTIONS — Modal dialogs for help, events, and game over
// =============================================================================

/**
 * showHelpPopup — Display the help/information modal.
 *
 * Shows game instructions, mechanics explanation, and game over conditions.
 * Pauses the game while open (if running). Only one popup can be open at a time.
 */
function showHelpPopup() {
    if(document.querySelector('.popup-overlay')) return; // Prevent duplicate popups
    if (game && !isPaused) togglePause(); // Pause the game while reading help

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const content = document.createElement('div');
    content.className = 'popup-content';

    // Hjælp-teksten hentes fra <template id="help-content-template"> i index.html.
    // Template-tags er usynlige i browseren men kan læses af JavaScript.
    // Rediger teksten direkte i index.html under template-tagget.
    const template = document.getElementById('help-content-template');
    content.innerHTML = template.innerHTML + `<div class="popup-button-container"><button id="help-ok-button">OK</button></div>`;
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    document.getElementById('help-ok-button').addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (game && isPaused && !game.isGameOver) togglePause();
    });
}


/**
 * showPopup — Display a general-purpose modal popup.
 *
 * Used for game events (DKA warning), game over screens, and info messages.
 * Only one popup can be active at a time (prevents stacking).
 *
 * @param {string}  title           - Popup title text
 * @param {string}  message         - HTML body content
 * @param {boolean} isGameOverPopup - If true: red title, "Reset" button, resets game on close
 * @param {boolean} isEventPopup    - If true: blue title (for in-game events like DKA warning)
 * @param {boolean} isInfoPopup     - If true: suppress sound on display
 * @param {boolean} shouldPause     - If true: pause the game while popup is open
 */
function showPopup(title, message, isGameOverPopup, isEventPopup = false, isInfoPopup = false, shouldPause = true) {
    // Hvis en game over popup skal vises, fjern eksisterende popup først
    // (ellers kan game over aldrig vises hvis en DKA-advarsel er åben)
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) {
        if (isGameOverPopup) {
            document.body.removeChild(existingPopup);
        } else {
            return; // Ikke-game-over popups stacker ikke
        }
    }

    if (shouldPause && game && !isPaused) togglePause();

    // Build popup DOM elements
    const overlay = document.createElement('div'); overlay.className = 'popup-overlay';
    const content = document.createElement('div'); content.className = 'popup-content';

    const h2 = document.createElement('h2'); h2.textContent = title;
    if (isEventPopup) h2.classList.add('event-title');   // Blue title for events
    if (isGameOverPopup) h2.style.color = '#e53e3e';     // Red title for game over
    const p = document.createElement('p'); p.innerHTML = message;
    content.appendChild(h2); content.appendChild(p);

    // Action button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-button-container';
    const button = document.createElement('button');
    button.textContent = isGameOverPopup ? "Reset Spil" : "OK";
    button.onclick = () => {
        document.body.removeChild(overlay);
        if (isGameOverPopup) resetGame();
        else if (shouldPause && game && !game.isGameOver && isPaused) togglePause();
    };
    buttonContainer.appendChild(button);
    content.appendChild(buttonContainer);
    overlay.appendChild(content);
    document.body.appendChild(overlay); // Add overlay to the page so it's actually visible

    // Play a notification sound (unless it's a game over or pure info popup)
    if (!isGameOverPopup && !isInfoPopup) playSound('intervention', 'C5');
}


// =============================================================================
// EVENT LOGGING — Record game events for the graph and history
// =============================================================================

/**
 * logEvent — Record a game event (food, insulin, exercise, etc.) in the history.
 *
 * Each event gets a timestamp and icon, and is stored in game.logHistory[].
 * Events are rendered on the graph as icons at their x-position.
 *
 * @param {string} message  - Human-readable description of the event
 * @param {string} type     - Event category: 'food', 'motion', 'insulin-fast',
 *                            'insulin-basal', 'fingerprick', 'event', 'info'
 * @param {object} details  - Additional data (dose, carbs, kcal, icon, etc.)
 */
function logEvent(message, type = 'info', details = {}) {
    if (!game) return;
    // Assign an emoji icon based on event type
    let icon = '';
    switch(type) {
        case 'food': icon = details.icon || '🍴'; break;
        case 'motion': icon = '🏃'; break;
        case 'insulin-fast': icon = '💉'; break;   // Syringe for bolus insulin
        case 'insulin-basal': icon = '🖊️'; break;  // Pen for basal insulin
    }
    game.logHistory.push({ time: game.totalSimMinutes, message, type, icon, details });
}


// =============================================================================
// FOOD & EXERCISE DISPLAY HELPERS
// =============================================================================

/**
 * updateFoodDisplay — Update the calorie and carb-equivalent displays for custom meals.
 *
 * Called whenever the food sliders change. Shows:
 *   - Total kcal: carbs*4 + protein*4 + fat*9 (standard Atwater factors)
 *   - KE (Kulhydrat-Ækvivalenter / Carb Equivalents): carbs + protein*0.25
 *     KE represents the total "carb-like" BG impact of the meal.
 */
function updateFoodDisplay() {
    foodKcalDisplay.textContent = ((parseInt(carbsSlider.value) * 4) + (parseInt(proteinSlider.value) * 4) + (parseInt(fatSlider.value) * 9)).toFixed(0);
    const ke = (parseInt(carbsSlider.value) + parseInt(proteinSlider.value) * 0.25).toFixed(0);
    foodKeDisplay.textContent = ke + " g";
}

/**
 * updateMotionKcal — Update the estimated calorie burn for selected exercise settings.
 *
 * Calorie burn rates: Low=4, Medium=7, High=10 kcal per minute.
 * Total = rate * duration.
 */
function updateMotionKcal() {
    let kcalPerMinute = motionIntensitySelect.value === "Lav" ? 4 : (motionIntensitySelect.value === "Medium" ? 7 : 10);
    motionKcalDisplay.textContent = (kcalPerMinute * parseInt(motionDurationSelect.value)).toFixed(0);
}


// =============================================================================
// EVENT LOG — Vis de seneste hændelser med tidsstempler og "tid siden"
// =============================================================================
//
// Viser de seneste 8 events fra logHistory i en liste under grafen.
// Hver entry viser: klokkeslæt, tid siden hændelsen, og beskrivelse.
// Nyttigt for: pre-bolus timing, post-motion awareness, debugging.
// =============================================================================
// Holder styr på hvornår event log sidst blev opdateret (sim-minutter).
// Bruges til at throttle opdateringerne ved høje hastigheder.
let _lastEventLogUpdateMin = -1;

function updateEventLog() {
    const logList = document.getElementById('event-log-list');
    if (!logList || !game) return;

    // Throttle opdateringer ved høje hastigheder for et roligere visuelt display.
    // Ved 720x opdateres hvert 5. sim-minut, ved 1440x hvert 10. sim-minut.
    const speed = game.simulationSpeed || 60;
    let updateInterval = 1; // opdater hvert minut normalt
    if (speed >= 1440) updateInterval = 10;
    else if (speed >= 720) updateInterval = 5;
    const roundedNow = Math.floor(game.totalSimMinutes / updateInterval) * updateInterval;
    if (roundedNow === _lastEventLogUpdateMin) return; // Spring over — intet nyt at vise
    _lastEventLogUpdateMin = roundedNow;

    // Vis de seneste 8 events (nyeste først)
    const recentEvents = game.logHistory.slice(-8).reverse();

    if (recentEvents.length === 0) {
        logList.innerHTML = '<div style="padding:4px; color:#a0aec0;">Ingen hændelser endnu</div>';
        return;
    }

    // Formatér "tid siden" som fx "12min", "1t 30min", "3t 15min"
    // Ved høje hastigheder rundes til 5/10-min intervaller for roligere display.
    function formatTimeSince(eventTime) {
        let minSince = Math.floor(game.totalSimMinutes - eventTime);
        if (minSince < 1) return 'nu';
        // Afrund til 5 eller 10 min ved høje hastigheder
        const speed = game.simulationSpeed || 60;
        if (speed >= 1440) minSince = Math.floor(minSince / 10) * 10;
        else if (speed >= 720) minSince = Math.floor(minSince / 5) * 5;
        if (minSince < 1) return 'nu';
        const h = Math.floor(minSince / 60);
        const m = minSince % 60;
        if (h > 0) return `${h}t ${String(m).padStart(2, '0')}m`;
        return `${String(m).padStart(2, '0')}min`;
    }

    // Formatér klokkeslæt fra totalSimMinutes
    function formatClock(totalMin) {
        const dayMin = totalMin % 1440; // Minutter inden for dagen
        const hh = String(Math.floor(dayMin / 60)).padStart(2, '0');
        const mm = String(Math.floor(dayMin % 60)).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Byg HTML for alle entries
    let html = '';
    recentEvents.forEach(ev => {
        const icon = ev.icon || '';
        html += `<div class="event-log-entry">
            <span class="event-log-time">${formatClock(ev.time)}</span>
            <span class="event-log-ago">${formatTimeSince(ev.time)}</span>
            <span class="event-log-msg">${icon} ${ev.message}</span>
        </div>`;
    });
    logList.innerHTML = html;
}


// =============================================================================
// PROFILE POPUP — Patient profile setup before starting the game
// =============================================================================
//
// Shows a modal form where the player enters their personal diabetes parameters:
//   - Weight (kg) — used for resting calorie calculation
//   - ICR (Insulin-to-Carb Ratio) — grams of carbs per unit of insulin
//   - ISF (Insulin Sensitivity Factor) — BG drop per unit of insulin
//
// The form also displays calculated values (TDD, basal dose, resting kcal)
// that update live as the player adjusts the inputs.
//
// Previous values are saved to localStorage and restored as defaults.
//
// @param {function} onStartCallback - Called with the profile object when
//                                     the player clicks "Start Simulation"
// =============================================================================
function showProfilePopup(onStartCallback) {
    // Prevent duplicate popups
    if (document.querySelector('.popup-overlay')) return;

    // Load previously saved profile from localStorage (or use defaults)
    let savedProfile = { weight: 70, icr: 10, isf: 3.0 };
    try {
        const stored = localStorage.getItem('diabetesDystenProfile');
        if (stored) savedProfile = JSON.parse(stored);
    } catch (e) { /* localStorage not available or corrupted — use defaults */ }

    // Build the popup DOM
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const content = document.createElement('div');
    content.className = 'popup-content';

    content.innerHTML = `
        <h2 class="info-title">Personprofil</h2>
        <p>Indtast dine diabetes-parametre for en personlig simulation.
           Værdierne bruges til at beregne din insulin-dosering og kaloriebehov.</p>

        <div class="profile-form">
            <div class="profile-field">
                <label for="profileWeight">Vægt</label>
                <div class="profile-input-row">
                    <input type="number" id="profileWeight" min="30" max="200" step="1" value="${savedProfile.weight}">
                    <span class="profile-unit">kg</span>
                </div>
                <small>Din kropsvægt — bruges til beregning af kalorieforbrug.</small>
            </div>

            <div class="profile-field">
                <label for="profileICR">ICR (Insulin-to-Carb Ratio)</label>
                <div class="profile-input-row">
                    <input type="number" id="profileICR" min="3" max="30" step="1" value="${savedProfile.icr}">
                    <span class="profile-unit">g / E</span>
                </div>
                <small>Hvor mange gram kulhydrat dækker 1 enhed hurtigvirkende insulin?
                       Typisk 8-15 for voksne. Lavere tal = mere insulin pr. måltid.</small>
            </div>

            <div class="profile-field">
                <label for="profileISF">ISF (Insulin Sensitivity Factor)</label>
                <div class="profile-input-row">
                    <input type="number" id="profileISF" min="0.5" max="10" step="0.1" value="${savedProfile.isf}">
                    <span class="profile-unit">mmol/L / E</span>
                </div>
                <small>Hvor meget sænker 1 enhed hurtigvirkende insulin dit blodsukker?
                       Typisk 1.5-5.0 mmol/L for voksne. Højere tal = mere følsom for insulin.</small>
            </div>

            <div class="profile-calculated">
                <h4>Beregnede værdier</h4>
                <div><span>Estimeret TDD:</span> <span id="profileTDD">--</span> E/dag</div>
                <div><span>Anbefalet basal:</span> <span id="profileBasal">--</span> E/dag</div>
                <div><span>Hvileforbrug:</span> <span id="profileKcal">--</span> kcal/dag</div>
            </div>
        </div>

        <div class="popup-button-container">
            <button id="profileStartButton">Start Simulation</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // References to the form inputs and calculated displays
    const weightInput = document.getElementById('profileWeight');
    const icrInput = document.getElementById('profileICR');
    const isfInput = document.getElementById('profileISF');
    const tddDisplay = document.getElementById('profileTDD');
    const basalDisplay = document.getElementById('profileBasal');
    const kcalDisplay = document.getElementById('profileKcal');

    // Live-update calculated values whenever an input changes
    function updateCalculatedValues() {
        const w = parseFloat(weightInput.value) || 70;
        const isf = parseFloat(isfInput.value) || 3.0;
        const tdd = 100 / isf;
        const basal = Math.round(tdd * 0.45);
        const kcal = Math.round(w * (2200 / 70));

        tddDisplay.textContent = tdd.toFixed(0);
        basalDisplay.textContent = basal;
        kcalDisplay.textContent = kcal;
    }

    // Attach input listeners for live calculation updates
    [weightInput, icrInput, isfInput].forEach(input => {
        input.addEventListener('input', updateCalculatedValues);
    });

    // Show initial calculated values
    updateCalculatedValues();

    // Start button handler: collect values, save to localStorage, and start the game
    document.getElementById('profileStartButton').addEventListener('click', () => {
        const profile = {
            weight: Math.max(30, Math.min(200, parseFloat(weightInput.value) || 70)),
            icr: Math.max(3, Math.min(30, parseInt(icrInput.value) || 10)),
            isf: Math.max(0.5, Math.min(10, parseFloat(isfInput.value) || 3.0))
        };

        // Save profile for next session
        try {
            localStorage.setItem('diabetesDystenProfile', JSON.stringify(profile));
        } catch (e) { /* localStorage not available — that's OK */ }

        // Remove the popup and start the game with the profile
        document.body.removeChild(overlay);
        onStartCallback(profile);
    });
}
