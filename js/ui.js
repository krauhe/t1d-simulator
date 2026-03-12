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

// Genanvendeligt offscreen canvas til hue-roterede emoji-ikoner på grafen.
// Oprettes én gang og genbruges i drawGraph() for at undgå memory churn.
const _emojiOffCanvas = document.createElement('canvas');
const _emojiOffCtx = _emojiOffCanvas.getContext('2d');


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

    // Opdater dag/nat-ikon baseret på klokkeslæt (simpelt ikon, ingen animation)
    const dayNightIcon = document.getElementById('dayNightIcon');
    if (dayNightIcon) {
        const h = Math.floor(game.timeInMinutes / 60);
        const isNight = (h >= 22 || h < 7);
        const currentIcon = isNight ? '\uD83C\uDF19' : '\u2600\uFE0F';
        if (dayNightIcon.textContent.trim() !== currentIcon) {
            dayNightIcon.textContent = currentIcon;
        }
    }

    // Display values with appropriate precision
    const cgmVal = game.cgmBG.toFixed(1);
    cgmValueDisplayGraph.textContent = cgmVal;
    iobDisplay.textContent = game.iob.toFixed(1);              // 1 decimal (e.g., "2.4")
    cobDisplay.textContent = game.cob.toFixed(0);              // Integer (e.g., "45")
    normoPointsDisplay.textContent = game.normoPoints.toFixed(1);

    // --- CGM Hero farve baseret på BG-niveau ---
    // Fjern alle BG-klasser og tilføj den aktuelle
    cgmValueDisplayGraph.classList.remove('bg-target', 'bg-elevated', 'bg-danger');
    const cgmHero = document.getElementById('cgm-hero');
    if (cgmHero) cgmHero.classList.remove('glow-target', 'glow-elevated', 'glow-danger');
    if (game.cgmBG < 4.0 || game.cgmBG > 14.0) {
        cgmValueDisplayGraph.classList.add('bg-danger');
        if (cgmHero) cgmHero.classList.add('glow-danger');
    } else if (game.cgmBG > 10.0) {
        cgmValueDisplayGraph.classList.add('bg-elevated');
        if (cgmHero) cgmHero.classList.add('glow-elevated');
    } else {
        cgmValueDisplayGraph.classList.add('bg-target');
        if (cgmHero) cgmHero.classList.add('glow-target');
    }

    // --- CGM Trend-pil ---
    // Beregn trend fra de seneste CGM-målinger (som rigtig CGM: ↑↗→↘↓).
    // Bruger 30 min vindue med gennemsnit af 2 målinger i hver ende for støj-robusthed.
    // Rate = ændringsrate i mmol/L pr. minut.
    const cgmTrendEl = document.getElementById('cgm-trend');
    if (cgmTrendEl && cgmDataPoints.length >= 4) {
        const currentTime = cgmDataPoints[cgmDataPoints.length - 1].time;
        const trendWindow = 30; // sim-minutter — længere vindue = mere stabilt
        const trendPoints = cgmDataPoints.filter(p => p.time >= currentTime - trendWindow);
        if (trendPoints.length >= 4) {
            // Gennemsnit af de 2 ældste og 2 nyeste punkter i vinduet
            const firstAvgVal = (trendPoints[0].value + trendPoints[1].value) / 2;
            const firstAvgTime = (trendPoints[0].time + trendPoints[1].time) / 2;
            const n = trendPoints.length;
            const lastAvgVal = (trendPoints[n - 1].value + trendPoints[n - 2].value) / 2;
            const lastAvgTime = (trendPoints[n - 1].time + trendPoints[n - 2].time) / 2;
            const timeDiff = lastAvgTime - firstAvgTime;
            if (timeDiff > 0) {
                const rate = (lastAvgVal - firstAvgVal) / timeDiff; // mmol/L pr. minut
                // Trend-pile baseret på ændringsrate (klinisk CGM-standard)
                let arrow, arrowColor;
                if (rate > 0.1) { arrow = '\u2191\u2191'; arrowColor = 'var(--red)'; }         // ↑↑ hurtigt stigende
                else if (rate > 0.05) { arrow = '\u2191'; arrowColor = 'var(--orange)'; }      // ↑ stigende
                else if (rate > 0.02) { arrow = '\u2197'; arrowColor = 'var(--orange)'; }      // ↗ langsomt stigende
                else if (rate > -0.02) { arrow = '\u2192'; arrowColor = 'var(--green)'; }      // → stabil
                else if (rate > -0.05) { arrow = '\u2198'; arrowColor = 'var(--orange)'; }     // ↘ langsomt faldende
                else if (rate > -0.1) { arrow = '\u2193'; arrowColor = 'var(--orange)'; }      // ↓ faldende
                else { arrow = '\u2193\u2193'; arrowColor = 'var(--red)'; }                     // ↓↓ hurtigt faldende
                cgmTrendEl.textContent = arrow;
                cgmTrendEl.style.color = arrowColor;
            }
        }
    }

    // Opdater hændelsesloggen under grafen
    updateEventLog();

    // --- #3: Opdater anbefalet basal dosis i insulin-panelet ---
    const basalRecommendedDose = document.getElementById('basalRecommendedDose');
    if (basalRecommendedDose) {
        basalRecommendedDose.textContent = game.basalDose;
    }
    // Opdater basal preset-knapper med doser baseret på anbefalet
    const bp1 = document.getElementById('basalPreset1Dose');
    const bp2 = document.getElementById('basalPreset2Dose');
    const bp3 = document.getElementById('basalPreset3Dose');
    if (bp1) bp1.textContent = Math.round(game.basalDose / 3);
    if (bp2) bp2.textContent = Math.round(game.basalDose * 2 / 3);
    if (bp3) bp3.textContent = game.basalDose;

    // Skaler basal slider max til 2× anbefalet dosis
    const longSlider = document.getElementById('longInsulinSlider');
    if (longSlider) {
        const newMax = Math.max(30, game.basalDose * 2);
        longSlider.max = newMax;
    }

    // --- Glukagon cooldown-indikator ---
    updateGlucagonCooldownUI();

    // --- Daglig max points tracking + stjernedryss ---
    updateDailyMaxPoints();

    // --- Aktivitets-overlay: opdater timer og progress ---
    if (typeof updateActivityOverlay === 'function') updateActivityOverlay();

    // --- Debug: log data + opdater live-værdier ---
    if (typeof debugLogTick === 'function') debugLogTick();
    if (typeof debugUpdateLiveValues === 'function') debugUpdateLiveValues();
}


// =============================================================================
// updateGlucagonCooldownUI — Opdater glukagon-ikonets cooldown-overlay og tekst
// =============================================================================
//
// Viser en grå overlay der gradvist forsvinder oppefra og ned,
// plus en nedtælling i timer under ikonet.
// =============================================================================
function updateGlucagonCooldownUI() {
    if (!game) return;
    const overlay = document.getElementById('sosCooldownOverlay');
    const text = document.getElementById('sosCooldownText');
    const dockItem = document.getElementById('glucagonDockItem');
    if (!overlay || !text || !dockItem) return;

    const cooldownMinutes = 24 * 60;
    const timeSinceUsed = game.totalSimMinutes - game.glucagonUsedTime;
    const remaining = cooldownMinutes - timeSinceUsed;

    if (remaining > 0) {
        // Cooldown aktiv: vis overlay (procentdel = resterende tid)
        const pct = (remaining / cooldownMinutes) * 100;
        overlay.style.height = pct + '%';
        dockItem.classList.add('disabled');

        // Nedtælling: altid i format "HH:MM" for fast bredde
        const hrs = Math.floor(remaining / 60);
        const mins = Math.floor(remaining % 60);
        text.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    } else {
        // Klar til brug
        overlay.style.height = '0%';
        text.textContent = '';
        dockItem.classList.remove('disabled');
    }
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

    // --- Rounded clip for chart area ---
    // Alle fills/strokes inden for chart-området klippes til afrundede hjørner,
    // så zoner, nat-shading osv. matcher grafens border-radius.
    const chartRadius = 12;
    graphCtx.save();
    graphCtx.beginPath();
    graphCtx.roundRect(padding.left, padding.top, graphWidth, graphHeight, chartRadius);
    graphCtx.clip();

    // --- Night shading (22:00-07:00) ---
    // Mørkere overlay for at indikere nattetimer — tydeligere i det mørke tema.
    // Giver visuel rytme til døgnet (dag/nat) og minder spilleren om søvn-mekanikken.
    const totalMinutesInView = 24 * 60; // 1440 minutes = one full day
    const xNightStart = padding.left + ((22 * 60) / totalMinutesInView) * graphWidth;
    const xNightEnd = padding.left + ((7 * 60) / totalMinutesInView) * graphWidth;
    // Nat-shading: tydeligt mørkere overlay for klar visuel forskel dag/nat
    graphCtx.fillStyle = 'rgba(10, 10, 40, 0.40)';
    graphCtx.fillRect(xNightStart, padding.top, graphWidth - (xNightStart - padding.left), graphHeight); // 22:00 to midnight
    graphCtx.fillRect(padding.left, padding.top, xNightEnd - padding.left, graphHeight);                  // Midnight to 07:00



    // --- BG zone coloring ---
    // Green zone: 4.0-10.0 mmol/L (target range, 1x points)
    // Orange zone: 10.0-14.0 mmol/L (elevated hyper, 0.5x points)
    // Red zones: below 4.0 (hypo, akut farligt) og above 14.0 (høj hyper, 0 points)
    const zones = [
        { min: 4.0, max: 10.0, color: 'rgba(72, 187, 120, 0.28)' },     // Grøn: target
        { min: 0, max: 3.99, color: 'rgba(229, 62, 62, 0.23)' },         // Rød: hypo — akut fare
        { min: 10.01, max: 14.0, color: 'rgba(214, 158, 46, 0.19)' },    // Orange: forhøjet hyper
        { min: 14.01, max: yAxisMax, color: 'rgba(229, 62, 62, 0.18)' }, // Rød: høj hyper
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

    // --- Afslut rounded clip (zoner/shading er nu klippet) ---
    graphCtx.restore();

    // --- Chart border med runde hjørner ---
    graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    graphCtx.roundRect(padding.left, padding.top, graphWidth, graphHeight, chartRadius);
    graphCtx.stroke();

    // --- X-axis labels (time of day, every 2 hours) — lysere tekst ---
    graphCtx.fillStyle = 'rgba(190, 210, 235, 0.85)'; graphCtx.font = "bold 12px Inter, Segoe UI";
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
        graphCtx.fillText(i.toFixed(0), padding.left - 22, y + 4);
    }

    // --- Y-axis label (rotated text: "Blodsukker (mmol/L)") ---
    // save/restore preserves the current canvas state around the rotation
    graphCtx.save(); graphCtx.translate(16, padding.top + graphHeight/2); graphCtx.rotate(-Math.PI/2);
    graphCtx.textAlign = "center"; graphCtx.font = "bold 12px Inter, Segoe UI";
    graphCtx.fillStyle = 'rgba(190, 210, 235, 0.85)';
    graphCtx.fillText("Blodsukker (mmol/L)", 0, 0); graphCtx.restore();

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
            if (p.value < 4.0 || p.value > 14.0) graphCtx.fillStyle = '#ef4444';      // Rød: akut fare
            else if (p.value > 10.0) graphCtx.fillStyle = '#fb923c';                    // Orange: forhøjet
            else graphCtx.fillStyle = '#4ade80';                                         // Grøn: i target (lysere til mørk bg)
            graphCtx.fill();
        }
    });

    // --- Aktivitetsbånd: farvet bånd i bunden af grafen for aktive/afsluttede aktiviteter ---
    // Tegner semi-transparente farvede bånd der viser hvornår aktiviteter fandt sted.
    // Farve afhænger af aktivitetstype (grøn=cardio, rød=styrke, orange=blandet, lilla=afslapning).
    const activityBandHeight = 10;
    const activityBandY = padding.top + graphHeight - activityBandHeight - 18; // Lige over x-aksen
    if (typeof AKTIVITETSTYPER !== 'undefined') {
        // Tegn bånd for afsluttede aktiviteter (fra logHistory)
        game.logHistory.forEach(event => {
            if (event.type !== 'motion' || !event.details || !event.details.type) return;
            const typeDef = AKTIVITETSTYPER[event.details.type];
            if (!typeDef) return;
            const startMin = event.time;
            const duration = event.details.duration || 30;
            const endMin = startMin + duration;
            // Tegn kun hvis båndet er synligt i nuværende view
            if (endMin < currentDayStartMinutes || startMin >= currentDayStartMinutes + totalMinutesInView) return;
            const x1 = padding.left + Math.max(0, (startMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            const x2 = padding.left + Math.min(1, (endMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            graphCtx.fillStyle = typeDef.farve + '30'; // 30 = ~19% opacity
            graphCtx.fillRect(x1, activityBandY, x2 - x1, activityBandHeight);
            // Top-kant for synlighed
            graphCtx.fillStyle = typeDef.farve + '60';
            graphCtx.fillRect(x1, activityBandY, x2 - x1, 2);
        });
        // Tegn bånd for AKTIV aktivitet (igangværende)
        if (game.activeAktivitet) {
            const akt = game.activeAktivitet;
            const typeDef = akt.typeDef;
            const startMin = akt.startTime;
            const nowMin = game.totalSimMinutes;
            if (startMin >= currentDayStartMinutes && startMin < currentDayStartMinutes + totalMinutesInView) {
                const x1 = padding.left + ((startMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
                const x2 = padding.left + ((nowMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
                // Aktivt bånd med pulserende opacity
                const pulse = 0.25 + 0.1 * Math.sin(performance.now() / 500);
                graphCtx.fillStyle = typeDef.farve + Math.round(pulse * 255).toString(16).padStart(2, '0');
                graphCtx.fillRect(x1, activityBandY, x2 - x1, activityBandHeight);
                graphCtx.fillStyle = typeDef.farve + '80';
                graphCtx.fillRect(x1, activityBandY, x2 - x1, 2);
                // Vis planlagt varighed som lysere skygge
                if (akt.varighed) {
                    const endMin = startMin + akt.varighed;
                    if (nowMin < endMin) {
                        const x3 = padding.left + ((endMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
                        graphCtx.fillStyle = typeDef.farve + '10';
                        graphCtx.fillRect(x2, activityBandY, x3 - x2, activityBandHeight);
                        // Stiplet kant for planlagt slutning
                        graphCtx.strokeStyle = typeDef.farve + '30';
                        graphCtx.setLineDash([3, 3]);
                        graphCtx.beginPath();
                        graphCtx.moveTo(x3, activityBandY);
                        graphCtx.lineTo(x3, activityBandY + activityBandHeight);
                        graphCtx.stroke();
                        graphCtx.setLineDash([]);
                    }
                }
            }
        }
    }

    // --- Event icons along the bottom of the graph ---
    // Food (emoji), insulin (syringe/pen), and exercise icons are drawn at
    // the x-position corresponding to their timestamp, near the bottom of the chart.
    const nowMsIcons = performance.now();
    game.logHistory.forEach(event => {
        // Vent med at vise graf-ikon til fly-animationen er færdig
        if (event._visibleAfter && nowMsIcons < event._visibleAfter) return;
        if (event.time >= currentDayStartMinutes && event.time < currentDayStartMinutes + totalMinutesInView) {
            const x = padding.left + ((event.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            let yPos = padding.top + graphHeight - 10; // Near the bottom of the chart
            graphCtx.textAlign = "center";
            graphCtx.font = "16px Arial";

            if(event.type === 'ketone-test') {
                // Keton-stik: blivende ikon på x-aksen med ketonværdi
                graphCtx.fillStyle = '#805ad5'; // Lilla — matcher keton-knappen
                graphCtx.fillText('🧪', x, yPos);
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = '#805ad5';
                const ketonVal = event.details.value || '';
                graphCtx.fillText(ketonVal, x, yPos - 14);
            } else if(event.type === 'food') {
                const icon = event.details.icon || '🍴';
                graphCtx.fillText(icon, x, yPos);
                // For custom meals (not presets), show carb equivalent (KE) label
                if (icon === '🍴') {
                    const carbs = event.details.carbs || 0;
                    const protein = event.details.protein || 0;
                    const ke = (carbs + protein * 0.25).toFixed(0);
                    graphCtx.font = "bold 11px Inter, Segoe UI";
                    graphCtx.fillStyle = 'rgba(200, 210, 230, 0.9)';
                    graphCtx.fillText(`${ke}g`, x, yPos - 14);
                }
            } else if (event.type === 'motion' || event.type === 'motion-end') {
                const motionIcon = (event.details && event.details.icon) || event.icon || '🏃';
                graphCtx.fillText(motionIcon, x, yPos);
            } else if(event.type === 'glucagon') {
                // Glukagon: rød sprøjte-emoji (💉) — samme størrelse som insulin, lidt større.
                // Bruger samme _emojiOffCanvas teknik som insulin-ikoner.
                const emojiSize = 24;
                _emojiOffCanvas.width = emojiSize * 2;
                _emojiOffCanvas.height = emojiSize * 2;
                _emojiOffCtx.clearRect(0, 0, emojiSize * 2, emojiSize * 2);
                _emojiOffCtx.filter = 'hue-rotate(330deg) saturate(1.8) brightness(1.1)';
                _emojiOffCtx.font = `${18}px Arial`;
                _emojiOffCtx.textAlign = 'center';
                _emojiOffCtx.textBaseline = 'middle';
                _emojiOffCtx.fillText('\u{1F489}', emojiSize, emojiSize);
                _emojiOffCtx.filter = 'none';
                graphCtx.drawImage(_emojiOffCanvas, x - emojiSize, yPos - 6 - emojiSize, emojiSize * 2, emojiSize * 2);
                // "GLU" label OVER ikonet
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = '#dc2626';
                graphCtx.fillText('GLU', x, yPos - 14);
            } else if(event.type.includes('insulin')) {
                // Hue-roteret sprøjte-emoji via offscreen canvas med CSS filter.
                // Canvas API kan ikke filtrere emoji direkte, så vi tegner emoji på
                // et midlertidigt canvas med filter og kopierer resultatet tilbage.
                const isBasal = event.type === 'insulin-basal';
                const insulinColor = isBasal ? '#2563eb' : '#0d9488';
                const hueRotate = isBasal ? 220 : 170;
                const emojiSize = 22;
                // Genanvend global offscreen canvas (undgår at oprette ny per ikon per frame)
                _emojiOffCanvas.width = emojiSize * 2;
                _emojiOffCanvas.height = emojiSize * 2;
                _emojiOffCtx.filter = `hue-rotate(${hueRotate}deg) saturate(1.3) brightness(1.1)`;
                _emojiOffCtx.font = "16px Arial";
                _emojiOffCtx.textAlign = "center";
                _emojiOffCtx.textBaseline = "middle";
                _emojiOffCtx.fillText(event.icon, emojiSize, emojiSize);
                // Tegn det filtrerede emoji på hovedcanvas
                graphCtx.drawImage(_emojiOffCanvas, x - emojiSize, yPos - 6 - emojiSize, emojiSize * 2, emojiSize * 2);
                // Dosis-label over ikonet
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = insulinColor;
                const doseText = event.details.dose.toFixed(isBasal ? 0 : 1);
                graphCtx.fillText(doseText, x, yPos - 14);
            }
        }
    });

    // --- Temporary graph messages (reminders, warnings) ---
    // These are transient messages displayed over the graph, e.g.,
    // "Remember basal insulin" or "Night intervention" with sleep animation.
     game.graphMessages.forEach(msg => {
        const xCenter = padding.left + graphWidth / 2;
        const yPos = padding.top + 25;
        graphCtx.fillStyle = "rgba(50, 40, 10, 0.85)";
        graphCtx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        graphCtx.lineWidth = 2;
        graphCtx.textAlign = "center";
        graphCtx.font = "bold 13px Inter, Segoe UI";
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
            // Standard message (fx "Husk basal insulin"): Mac-stil afrundet boks
            // med pulserende gul glow-animation for at vise at det er relevant NU.
            const boxX = xCenter - textWidth / 2 - 14;
            const boxY = yPos - 18;
            const boxW = textWidth + 28;
            const boxH = 34;
            const radius = 12;

            // Pulserende glow: sinusbølge der varierer glow-intensitet
            const pulsePhase = Math.sin(game.totalSimMinutes * 0.8) * 0.5 + 0.5; // 0→1
            const glowAlpha = 0.15 + pulsePhase * 0.25; // 0.15 → 0.40
            const glowSpread = 8 + pulsePhase * 12;     // 8px → 20px

            // Ydre gul glow (tegnes først, bag boksen)
            graphCtx.save();
            graphCtx.shadowColor = `rgba(251, 191, 36, ${glowAlpha})`;
            graphCtx.shadowBlur = glowSpread;
            graphCtx.shadowOffsetX = 0;
            graphCtx.shadowOffsetY = 0;

            // Baggrund: mørk med subtil gennemsigtighed (matcher dock-panel)
            graphCtx.beginPath();
            graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
            graphCtx.fillStyle = "rgba(21, 30, 48, 0.92)";
            graphCtx.fill();
            graphCtx.restore();

            // Kant: pulserende gul border
            const borderAlpha = 0.4 + pulsePhase * 0.3; // 0.4 → 0.7
            graphCtx.beginPath();
            graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
            graphCtx.strokeStyle = `rgba(251, 191, 36, ${borderAlpha})`;
            graphCtx.lineWidth = 1.5;
            graphCtx.stroke();

            // Tekst: pulserer svagt i lysstyrke
            const textAlpha = 0.85 + pulsePhase * 0.15; // 0.85 → 1.0
            graphCtx.fillStyle = `rgba(251, 191, 36, ${textAlpha})`;
            graphCtx.fillText(msg.text, xCenter, yPos);
        }
    });

    // --- Floating labels (animerede måleresultater) ---
    // Renderes som DOM-elementer OVER canvas'et (z-index: 20) så de vises oven på
    // CGM hero (z-index: 10) og points overlay (z-index: 10).
    // Bruges til fingerprik og keton-stik — spil-agtigt visuelt feedback.
    // Bruger real-tid (performance.now) til smooth animation uafhængig af sim-hastighed.
    renderFloatingLabels(padding, graphWidth, graphHeight, range, currentDayStartMinutes, totalMinutesInView);
}

// =============================================================================
// renderFloatingLabels — Tegn animerede måleresultater som DOM-elementer
// =============================================================================
//
// I stedet for at tegne på canvas (hvor de skjules af CGM hero/points overlay),
// oprettes <div>-elementer i #graph-area-container med z-index: 20.
// Hvert label-element genbruges via en _domEl-reference på label-objektet.
// Elementer fjernes automatisk når animationen er færdig.
// =============================================================================
function renderFloatingLabels(padding, graphWidth, graphHeight, range, currentDayStartMinutes, totalMinutesInView) {
    if (!game || !game.floatingLabels) return;
    const container = document.getElementById('graph-area-container');
    if (!container) return;

    const FLOAT_DURATION_MS = 3000; // 3 sekunder real-tid
    const nowMs = performance.now();

    // Cleanup: fjern labels der er udløbet
    game.floatingLabels = game.floatingLabels.filter(lbl => {
        if (!lbl._realCreatedAt) lbl._realCreatedAt = nowMs;
        const alive = (nowMs - lbl._realCreatedAt) < FLOAT_DURATION_MS;
        if (!alive && lbl._domEl) {
            lbl._domEl.remove();
            lbl._domEl = null;
        }
        return alive;
    });

    game.floatingLabels.forEach(lbl => {
        // Kun vis labels fra den aktuelle dag
        if (lbl.time < currentDayStartMinutes || lbl.time >= currentDayStartMinutes + totalMinutesInView) {
            if (lbl._domEl) lbl._domEl.style.display = 'none';
            return;
        }

        // Beregn position (samme koordinatsystem som canvas, men i CSS-pixels)
        const progress = Math.min(1, (nowMs - lbl._realCreatedAt) / FLOAT_DURATION_MS);
        const x = padding.left + ((lbl.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
        const baseY = padding.top + graphHeight - ((lbl.value) / range) * graphHeight;
        const yOffset = -30 - 25 * progress;
        const alpha = 1.0 - progress * 0.8;
        const y = baseY + yOffset;

        if (y < padding.top - 20 || y > padding.top + graphHeight + 20) {
            if (lbl._domEl) lbl._domEl.style.display = 'none';
            return;
        }

        // Opret DOM-element ved første rendering
        if (!lbl._domEl) {
            const el = document.createElement('div');
            el.className = 'floating-label';
            el.textContent = lbl.text;
            el.style.borderColor = lbl.color;
            el.style.color = lbl.color;
            container.appendChild(el);
            lbl._domEl = el;
        }

        // Opdater position og opacity
        const el = lbl._domEl;
        el.style.display = '';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.opacity = alpha;
    });
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
    content.className = 'popup-content help-popup';

    // Hjælp-teksten hentes fra <template id="help-content-template"> i index.html.
    // Template-tags er usynlige i browseren men kan læses af JavaScript.
    // Rediger teksten direkte i index.html under template-tagget.
    const template = document.getElementById('help-content-template');
    content.innerHTML = template.innerHTML + `<div class="popup-button-container"><button id="help-ok-button">Luk</button></div>`;
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
// GAME OVER POPUP — Struktureret game over-skærm med stjerne-animation
// =============================================================================
//
// Vist i rækkefølgen:
//   1. "Game over på grund af: [årsag]"
//   2. Points med pulserende stjerne-animation
//   3. Forklaring (hvad skete der)
//   4. Tips (sådan undgår du det)
//   5. Reset-knap
//
// @param {string} cause     - Årsagsnavn (fx "Svær Hypoglykæmi")
// @param {object} details   - { cause, explanation, tips[] }
// @param {number} points    - Spillerens Normoglykæmi-points
// =============================================================================
function showGameOverPopup(cause, details, points) {
    // Fjern eksisterende popup (fx DKA-advarsel)
    const existing = document.querySelector('.popup-overlay');
    if (existing) document.body.removeChild(existing);

    if (game && !isPaused) togglePause();

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const content = document.createElement('div');
    content.className = 'popup-content game-over-popup';

    // Byg indhold
    content.innerHTML = `
        <h2 class="go-title">Game Over</h2>
        <div class="go-cause">${cause}</div>
        <p class="go-cause-detail">${details.cause}</p>

        <div class="go-points-container">
            <div class="go-star">&#x2B50;</div>
            <div class="go-points-num">${points.toFixed(1)}</div>
            <div class="go-points-label">Normoglykæmi-points</div>
        </div>

        <div class="go-section">
            <div class="go-section-title">Hvad skete der?</div>
            <p>${details.explanation}</p>
        </div>

        <div class="go-section">
            <div class="go-section-title">Sådan undgår du det næste gang</div>
            <ul>${details.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>

        <div class="popup-button-container">
            <button id="gameOverResetBtn">Prøv igen</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    document.getElementById('gameOverResetBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resetGame();
    });
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
        case 'motion': icon = (details && details.icon) || '🏃'; break;
        case 'motion-end': icon = '⏹'; break;
        case 'insulin-fast': icon = '💉'; break;   // Sprøjte for hurtig insulin
        case 'insulin-basal': icon = '💉'; break;  // Sprøjte for basal insulin
    }
    // _visibleAfter: forsinker graf-ikon-rendering til fly-animationen er færdig (1200ms)
    const visibleAfter = performance.now() + 1200;
    game.logHistory.push({ time: game.totalSimMinutes, message, type, icon, details, _visibleAfter: visibleAfter });
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
 * updateMotionKcal — Opdater estimeret kalorieforbrænding baseret på valgt
 * aktivitetstype, intensitet og varighed.
 *
 * Henter kcalPerMin fra AKTIVITETSTYPER og multiplicerer med varighed.
 * Ved åben varighed vises kun rate (kcal/min).
 */
function updateMotionKcal() {
    // Find valgt aktivitetstype fra chips
    const selectedChip = document.querySelector('.activity-type-chip.selected');
    const type = selectedChip ? selectedChip.dataset.type : 'cardio';
    const typeDef = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[type] : null;
    const intensitet = motionIntensitySelect.value;

    const kcalPerMinute = typeDef ? (typeDef.kcalPerMin[intensitet] || 7) : 7;

    // Find valgt varighed
    const durationChip = document.querySelector('.duration-chip.selected');
    const duration = durationChip ? durationChip.dataset.duration : '30';

    if (duration === 'open') {
        motionKcalDisplay.textContent = `~${kcalPerMinute}/min`;
    } else {
        motionKcalDisplay.textContent = (kcalPerMinute * parseInt(duration)).toFixed(0);
    }
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
        if (h > 0) return `${h}t${String(m).padStart(2, '0')}m`;
        return `${m}m`;
    }

    // Formatér klokkeslæt fra totalSimMinutes
    function formatClock(totalMin) {
        const dayMin = totalMin % 1440; // Minutter inden for dagen
        const hh = String(Math.floor(dayMin / 60)).padStart(2, '0');
        const mm = String(Math.floor(dayMin % 60)).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Byg HTML for alle entries — insulin-ikoner wraps i farvet span
    let html = '';
    recentEvents.forEach(ev => {
        let iconHtml = ev.icon || '';
        // Farvekodet sprøjte-ikon: blå for basal, teal for hurtig
        if (ev.type === 'insulin-basal') iconHtml = `<span class="insulin-icon-blue">${ev.icon}</span>`;
        else if (ev.type === 'insulin-fast') iconHtml = `<span class="insulin-icon-teal">${ev.icon}</span>`;
        html += `<div class="event-log-entry">
            <span class="event-log-time">${formatClock(ev.time)}</span>
            <span class="event-log-ago">${formatTimeSince(ev.time)}</span>
            <span class="event-log-msg">${iconHtml} ${ev.message}</span>
        </div>`;
    });
    logList.innerHTML = html;
}


// =============================================================================
// DAGLIG MAX POINTS — Tracking og stjernedryss ved ny high score
// =============================================================================
//
// Holder styr på den højeste points-score spilleren har opnået i løbet af
// en dag. Når spilleren slår sin daglige high score, vises en kort
// stjernedryss-animation ved points-displayet, og der spilles en lyd.
// =============================================================================

// Gemmer den daglige max og hvilken dag den tilhører
let _dailyMaxPoints = 0;
let _dailyMaxPointsDay = 1;

function updateDailyMaxPoints() {
    if (!game) return;

    // Nulstil ved dagsskifte
    if (game.day !== _dailyMaxPointsDay) {
        _dailyMaxPoints = 0;
        _dailyMaxPointsDay = game.day;
    }

    // Tjek om spilleren har slået sin daglige high score
    if (game.normoPoints > _dailyMaxPoints) {
        const wasZero = _dailyMaxPoints === 0;
        const improvement = game.normoPoints - _dailyMaxPoints;
        _dailyMaxPoints = game.normoPoints;

        // Vis stjernedryss kun ved mærkbare stigninger (mindst 5 points)
        // og ikke ved spilstart (wasZero)
        if (!wasZero && improvement >= 5) {
            spawnStarBurst();
            playSound('intervention', 'E5');
        }
    }
}

/**
 * spawnStarBurst — Animér stjernedryss omkring points-displayet.
 * Skaber 5-8 stjerne-elementer der flyver ud fra points-badgen.
 */
function spawnStarBurst() {
    const pointsBadge = normoPointsDisplay;
    if (!pointsBadge) return;

    const rect = pointsBadge.getBoundingClientRect();
    const stars = ['\u2B50', '\u2728', '\u{1F31F}']; // ⭐, ✨, 🌟
    const count = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
        const star = document.createElement('span');
        star.className = 'star-burst';
        star.textContent = stars[Math.floor(Math.random() * stars.length)];
        star.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 40) + 'px';
        star.style.top = (rect.top + (Math.random() - 0.5) * 20) + 'px';
        document.body.appendChild(star);
        // Fjern efter animation
        setTimeout(() => star.remove(), 900);
    }
}


// =============================================================================
// PROFILE POPUP — Rediger personprofil (åbnes via Profil-knappen)
// =============================================================================
//
// Viser en modal formular hvor spilleren indtaster diabetes-parametre:
//   - Vægt (kg) — bruges til kalorieforbrug
//   - ICR (Insulin-to-Carb Ratio) — gram kulhydrat per enhed insulin
//   - ISF (Insulin Sensitivity Factor) — BG-fald per enhed insulin
//
// Beregnede værdier (TDD, basal, kcal) opdateres live.
// Profilen gemmes i localStorage ved "Gem".
//
// @param {object} options - Valgfri indstillinger
// @param {boolean} options.showStartButton - Vis "Start Simulation"-knap (true under spilstart)
// =============================================================================
function showProfilePopup(options) {
    options = options || {};

    // Forhindrer dobbelt-popup
    if (document.querySelector('.popup-overlay')) return;

    // Hent gemt profil fra localStorage (eller brug defaults)
    let savedProfile = { weight: 70, icr: 10, isf: 3.0 };
    try {
        const stored = localStorage.getItem('diabetesDystenProfile');
        if (stored) savedProfile = JSON.parse(stored);
    } catch (e) { /* localStorage utilgængeligt — brug defaults */ }

    // Byg popup DOM
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const content = document.createElement('div');
    content.className = 'popup-content profile-popup';

    content.innerHTML = `
        <h5 class="profile-title">Personprofil</h5>
        <p class="profile-desc">Indtast dine diabetes-parametre for en personlig simulation.</p>

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
                <small>Gram kulhydrat per enhed insulin. Typisk 8–15 for voksne.</small>
            </div>

            <div class="profile-field">
                <label for="profileISF">ISF (Insulin Sensitivity Factor)</label>
                <div class="profile-input-row">
                    <input type="number" id="profileISF" min="0.5" max="10" step="0.1" value="${savedProfile.isf}">
                    <span class="profile-unit">mmol/L / E</span>
                </div>
                <small>BG-fald per enhed insulin. Typisk 1.5–5.0 mmol/L for voksne.</small>
            </div>

            <div class="profile-calculated">
                <div class="profile-calc-row">
                    <span class="label">Total Daily Dose (TDD)</span>
                    <span class="value" id="profileTDD">--</span>
                    <span class="unit">E/dag</span>
                </div>
                <div class="profile-calc-row">
                    <span class="label">Anbefalet basal</span>
                    <span class="value" id="profileBasal">--</span>
                    <span class="unit">E/dag</span>
                </div>
                <div class="profile-calc-row">
                    <span class="label">Hvileforbrug</span>
                    <span class="value" id="profileKcal">--</span>
                    <span class="unit">kcal/dag</span>
                </div>
            </div>
        </div>

        <div class="popup-button-container">
            <button id="profileSaveButton" class="profile-save-btn">Gem profil</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Klik på overlay (uden for popup) lukker popup
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    // Referencer til form-inputs og beregnede displays
    const weightInput = document.getElementById('profileWeight');
    const icrInput = document.getElementById('profileICR');
    const isfInput = document.getElementById('profileISF');
    const tddDisplay = document.getElementById('profileTDD');
    const basalDisplay = document.getElementById('profileBasal');
    const kcalDisplay = document.getElementById('profileKcal');

    // Live-opdater beregnede værdier når input ændres
    function updateCalculatedValues() {
        const w = parseFloat(weightInput.value) || 70;
        const isf = parseFloat(isfInput.value) || 3.0;
        const tdd = 100 / isf;
        const basal = Math.round(tdd * 0.45);
        // Afrund kcal til nærmeste 100
        const kcal = Math.round(w * (2200 / 70) / 100) * 100;

        tddDisplay.textContent = tdd.toFixed(0);
        basalDisplay.textContent = basal;
        kcalDisplay.textContent = kcal;
    }

    // Tilknyt input-lyttere for live beregning
    [weightInput, icrInput, isfInput].forEach(input => {
        input.addEventListener('input', updateCalculatedValues);
    });

    // Vis initiale beregnede værdier
    updateCalculatedValues();

    // Hjælpefunktion: saml profil-værdier fra inputfelterne
    function collectProfile() {
        return {
            weight: Math.max(30, Math.min(200, parseFloat(weightInput.value) || 70)),
            icr: Math.max(3, Math.min(30, parseInt(icrInput.value) || 10)),
            isf: Math.max(0.5, Math.min(10, parseFloat(isfInput.value) || 3.0))
        };
    }

    // Hjælpefunktion: gem profil til localStorage
    function saveProfile(profile) {
        try {
            localStorage.setItem('diabetesDystenProfile', JSON.stringify(profile));
        } catch (e) { /* localStorage utilgængeligt */ }
    }

    // "Gem profil"-knap: gem og luk popup
    document.getElementById('profileSaveButton').addEventListener('click', () => {
        const profile = collectProfile();
        saveProfile(profile);
        document.body.removeChild(overlay);
    });
}
