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
//   logEvent(), updateFoodDisplay(), updateMotionKcal()
// =============================================================================

// =============================================================================
// Shared UI constants + small classifier helpers
// =============================================================================
// Single source of truth for the BG zone thresholds (mmol/L) and the CGM trend
// arrow mapping, so the colour classes, graph point colours, zone gradient and
// the editor's cursor trend all agree — change a threshold or an arrow in ONE
// place. Plain module-level globals: the project shares one global scope across
// its scripts, and ui.js loads before editor.js/game.js.

// BG_ZONES, getBGZone, CGM_TREND_LEVELS and cgmTrendForRate moved to
// js/graph-renderer.js (loaded before ui.js) so the mobile shell can reuse them.
// See mobile/MOBILE-DESIGN.md §2.2. They remain available here via the shared
// classic-script global scope, so callers below are unchanged.

// Reusable offscreen canvas for hue-rotated emoji icons on the graph.
// Created once and reused in drawGraph() to avoid memory churn.
const _emojiOffCanvas = document.createElement('canvas');
const _emojiOffCtx = _emojiOffCanvas.getContext('2d');

// Pre-loaded insulin/glucagon icons for campaign markers and events on the canvas graph.
// IMPORTANT: 'blue' (basal) must point to the SAME file as dp-section-icon in index.html
// and action-icon-svg in campaign.js — so the icon only needs to be replaced in one place.
const _syringeIconPaths = {
    blue: 'assets/icons/app/basal-syringe-clock.png', // Basal
    teal: 'assets/icons/app/rapid-syringe.png',       // Hurtigvirkende
    red:  'assets/icons/app/glucagon-pen.png',        // Glukagon
};
const _syringeIcons = {};
Object.entries(_syringeIconPaths).forEach(([color, path]) => {
    const img = new Image();
    img.src = path;
    _syringeIcons[color] = img;
});

// Cache for bitmap-based food icons on the canvas graph. Without this cache,
// drawGraph() would create new Image objects every frame, causing unnecessary
// memory churn and making icons flicker while they load.
const _foodIconImages = {};
function _getFoodIconImage(path) {
    if (!_foodIconImages[path]) {
        const img = new Image();
        img.src = path;
        _foodIconImages[path] = img;
    }
    return _foodIconImages[path];
}

// Grafens tips kommer fra spillets neutrale tipsystem, ikke fra den karakter
// spilleren styrer. Pæreikonet gør afsenderen tydelig uden ekstra forklaring i
// hvert tip; karakterens identitet vises fortsat i baneintroen og BG-feltet.
const _graphTipIconImg = new Image();
_graphTipIconImg.src = 'assets/icons/app/tip-lightbulb.png';


// =============================================================================
// shouldShowCalorieBalanceUI — moved to the shared core (js/campaign-core.js) so the
// mobile shell (which does not load ui.js) uses the same policy. It is a pure, DOM-free
// predicate and is loaded before this file's call sites run. See campaign-core.js.


// =============================================================================
// getBasalCap / getBasalPresetDoses — coarse, character-scaled basal controls (A5)
// =============================================================================
//
// SINGLE SOURCE OF TRUTH for the basal slider max, the five basal preset chips
// and their keyboard shortcuts. Centralised so the displayed number, the chip
// click and the key press can never drift apart (they used to each recompute
// game.basalDose × fraction independently).
//
// A5 / A5a / A5b: the character's rounded injection requirement (game.basalDose)
// is NOT shown. Instead the controls use a COARSE cap = 2× that amount, rounded to the nearest 10
// (A5a) — a round, character-scaled range, not a personal dose recommendation.
// The presets are a ladder derived from that cap (A5b: 20/40/60/80/100 %), NOT
// from game.basalDose — so no chip equals the exact amount, and there is nothing to
// reverse-engineer a personal dose from. It still scales with the character, which
// only reveals the general "bigger body → more insulin" principle.
// =============================================================================
function getBasalCap() {
    return getBasalControlCap(game && game.basalDose);
}
function getBasalPresetDoses() {
    return getBasalControlPresetDoses(game && game.basalDose);
}


// =============================================================================
// updateBasalPresetUI — Fill the basal section of the insulin popup
// =============================================================================
//
// Fills the five basal preset chips and scales the basal slider. After A5 no
// recommended-dose NUMBER is shown: the chip doses and the slider cap come from
// the coarse per-character cap (getBasalPresetDoses / getBasalCap), not from the
// precise injection requirement. Extracted from updateUI() so it can ALSO be called
// once at game start — otherwise the chips show the "--" HTML placeholder until
// the first game-loop tick repaints them.
// =============================================================================
function updateBasalPresetUI() {
    if (!game) return; // Guard: no game instance yet

    // A5: the recommended basal NUMBER is no longer shown anywhere (it read as a
    // basal dosing recommendation). The model still self-initialises to steady
    // state, so the character starts stable — we just don't print "recommended
    // basal = X". The basal controls are scaled to a COARSE, rounded per-character
    // cap (see getBasalCap) — the general "bigger character → more insulin"
    // principle, not the precise injection requirement.
    const presetDoses = getBasalPresetDoses();
    const presetIds = ['basalPreset1Dose', 'basalPreset2Dose', 'basalPreset3Dose', 'basalPreset4Dose', 'basalPreset5Dose'];
    presetIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.textContent = presetDoses[i];
    });

    // Basal slider max = the same coarse per-character cap (A5a: nearest 10).
    const longSlider = document.getElementById('longInsulinSlider');
    if (longSlider) longSlider.max = getBasalCap();

    // Scale the fast (meal) insulin slider max to the active character's bolusMax
    // (defined per archetype in archetypes.js). Bigger character → bigger meals →
    // higher cap (child 10 / adult 15 / large 20). nearestArchetype maps the
    // engine's weight/ISF/ICR back to its archetype so this works even for an
    // older saved profile that predates the archetypeId field.
    const fastSlider = document.getElementById('fastInsulinSlider');
    if (fastSlider && typeof nearestArchetype === 'function') {
        const arch = nearestArchetype({ weight: game.weight, isf: game.ISF, icr: game.ICR });
        if (arch && typeof arch.bolusMax === 'number') fastSlider.max = arch.bolusMax;
    }
}


// =============================================================================
// updateUI — Refresh the numeric displays in the top bar
// =============================================================================
//
// Called every frame by the game loop. Updates:
//   - Day counter and clock (HH:MM format)
//   - CGM glucose reading (what the player sees as their "current BG")
//   - IOB (Insulin On Board) — helps player avoid insulin stacking
//   - COB (Carbs On Board) — shows remaining undigested food
//   - Points (the score)
// =============================================================================
function updateUI() {
    if (!game) return; // Guard: no game instance yet

    dayDisplay.textContent = game.day;

    // Campaign: keep dayTotalDisplay in sync (the title/label is set at level start
    // in game.js and does not change during play — but totalDays may shift if
    // levelConfig is hot-reloaded, so it is kept in sync here).
    if (typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive && campaignEngine.levelConfig) {
        const totalDays = Math.round((campaignEngine.levelConfig.durationMinutes || 1440) / 1440);
        const dayTotalEl = document.getElementById('dayTotalDisplay');
        if (dayTotalEl && dayTotalEl.textContent !== '/' + totalDays) {
            dayTotalEl.textContent = '/' + totalDays;
            dayTotalEl.style.display = '';
        }
    }

    updateClockAndDayNight();

    const cgmActive = updateCgmValueDisplay();
    iobDisplay.textContent = (game.displayIOB ?? game.iob).toFixed(1); // Én decimal (e.g., "4.0")
    cobDisplay.textContent = game.cob.toFixed(0);              // Integer (e.g., "45")
    normoPointsDisplay.textContent = game.normoPoints.toFixed(1);

    // --- Stomach capacity: grey out food buttons when the stomach is full ---
    const foodPanel = document.getElementById('dock-panel-food');
    const customFoodPanel = document.getElementById('dock-panel-custom-food');
    const kitDextro = document.getElementById('kitDextroButton');
    if (game.stomachFull) {
        if (foodPanel) foodPanel.classList.add('stomach-full');
        if (customFoodPanel) customFoodPanel.classList.add('stomach-full');
        if (kitDextro) kitDextro.classList.add('stomach-full-btn');
    } else {
        if (foodPanel) foodPanel.classList.remove('stomach-full');
        if (customFoodPanel) customFoodPanel.classList.remove('stomach-full');
        if (kitDextro) kitDextro.classList.remove('stomach-full-btn');
    }

    updateCgmHeroColor(cgmActive);

    // Lad den valgte fiktive karakter reagere visuelt på den aktuelle tilstand.
    // Funktionen skifter kun fil, når mood faktisk ændrer sig, så den er billig
    // at kalde fra frame-loopet.
    updateCgmCharacterMood();

    updateCgmTrendArrow(cgmActive);

    // --- Life bars: three game-over criterion bars (see updateLifeBars) ---
    updateLifeBars();

    // --- #3: Update basal preset chips + slider cap in the insulin panel ---
    updateBasalPresetUI();

    // --- Glucagon cooldown indicator ---
    updateGlucagonCooldownUI();

    // --- Daily max points tracking + star burst ---
    updateDailyMaxPoints();

    // --- Activity overlay: update timer and progress ---
    if (typeof updateActivityOverlay === 'function') updateActivityOverlay();

    updateScorePanels();

    // --- Physiology effects panel: update arrows ---
    if (physiologyEffectsEnabled) updateEffectsPanel();

    postPhysiologyDashboardSnapshot();

    // --- Campaign: update info button (objective checklist shown only in popup) ---
    if (campaignEngine) {
        campaignEngine.updateCampaignInfoBtn();
    }

    // --- Debug: log data + update live values ---
    if (typeof debugLogTick === 'function') debugLogTick();
    if (typeof debugUpdateLiveValues === 'function') debugUpdateLiveValues();
}







// =============================================================================
// postPhysiologyDashboardSnapshot — push a physiology snapshot to the popup
// =============================================================================
// Extracted from updateUI(). Throttled to at most once per second (the dashboard
// does not need a per-frame update). No-op when the popup window is closed.
let _lastPhysiologyPost = 0; // module-scope throttle timestamp (performance.now)
function postPhysiologyDashboardSnapshot() {
    // Physiology dashboard: push a snapshot to the popup window via postMessage.
    // No-op when the popup is closed or no game is running; throttled to ~1/sec.
    if (!physiologyWindow || physiologyWindow.closed || !game) return;
    const now = performance.now();
    if (now - _lastPhysiologyPost <= 1000) return;
    _lastPhysiologyPost = now;
    try {
        const snap = game.getPhysiologySnapshot();
        const lang = (typeof appSettings !== 'undefined' && appSettings.language) || 'da';
        physiologyWindow.postMessage({ type: 'physiology-snapshot', data: snap, lang: lang }, '*');
    } catch (e) {
        // Expected case: the popup was closed between the guard above and the
        // post — ignore. Anything else (e.g. a bug in getPhysiologySnapshot) is
        // real, so surface it instead of swallowing. The ~1/sec throttle bounds
        // any logging, so this cannot spam the console.
        if (!physiologyWindow.closed) console.warn('[UI] postPhysiologyDashboardSnapshot failed:', e);
    }
}
// =============================================================================
// updateCgmHeroColor — BG-level colour class on the CGM number + hero glow
// =============================================================================
// Extracted from updateUI(). cgmActive passed in (from updateCgmValueDisplay).
function updateCgmHeroColor(cgmActive) {
    // --- CGM Hero colour based on BG level ---
    // Remove all BG classes, then add the current zone's class. The zone comes
    // from getBGZone (the shared classifier) so the number colour, hero glow,
    // graph point colours and zone gradient all use the same thresholds.
    cgmValueDisplayGraph.classList.remove('bg-target', 'bg-elevated', 'bg-danger', 'bg-offline');
    const cgmHero = document.getElementById('cgm-hero');
    if (cgmHero) cgmHero.classList.remove('glow-target', 'glow-elevated', 'glow-danger');
    if (!cgmActive) {
        cgmValueDisplayGraph.classList.add('bg-offline');
        return;
    }
    const zone = getBGZone(game.cgmBG);
    cgmValueDisplayGraph.classList.add('bg-' + zone);
    if (cgmHero) cgmHero.classList.add('glow-' + zone);
}
// =============================================================================
// updateCgmValueDisplay — CGM number + unit (or sensor status); returns cgmActive
// =============================================================================
// Extracted from updateUI(). Returns whether the sensor is active so the caller
// can reuse it for the hero colour and the trend arrow without recomputing.
function updateCgmValueDisplay() {
    // Display values with appropriate precision. On CGM sensor failure, show
    // status instead of a stale number, so the player does not confuse a
    // stale reading with a current CGM value.
    const cgmStatus = typeof game.getCgmSensorStatus === 'function'
        ? game.getCgmSensorStatus()
        : (game.cgmSensorStatus || 'active');
    const cgmActive = cgmStatus === 'active';
    const cgmUnitEl = document.getElementById('cgmUnitLabel');
    if (cgmActive) {
        cgmValueDisplayGraph.textContent = displayBG(game.cgmBG);
        if (cgmUnitEl) cgmUnitEl.textContent = bgUnitLabel();
    } else {
        cgmValueDisplayGraph.textContent = '--';
        if (cgmUnitEl) cgmUnitEl.textContent = t(`cgm.status.${cgmStatus}`);
    }
    return cgmActive;
}
// =============================================================================
// updateScorePanels — box-challenge lives + day-points line (box/sandbox)
// =============================================================================
// Extracted from updateUI(). Box and sandbox show both points lines; lives show
// only in box; campaign uses its own capsule header. Reads game + DOM only.
function updateScorePanels() {
    // --- Lives (box only) + day points (box + sandbox) ---
    // Box and sandbox show BOTH points lines ("Total" + "Today") — hence
    // we add the "Total" label to the top line. Lives are shown only in box.
    // Campaign has its own capsule header and uses neither lives nor day points.
    const livesEl = document.getElementById('livesDisplay');
    const dayPointsEl = document.getElementById('dayPointsDisplay');
    const totalLabelEl = document.getElementById('normoPointsLabel');
    const showDayPoints = game.gameMode === 'boxchallenge' || game.gameMode === 'sandbox';
    if (game.gameMode === 'boxchallenge') {
        if (livesEl) {
            livesEl.style.display = '';
            const livesHearts = document.getElementById('livesHearts');
            if (livesHearts) {
                const lives = Math.max(0, game.lives);
                livesHearts.textContent = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
            }
        }
    } else {
        if (livesEl) livesEl.style.display = 'none';
    }
    if (showDayPoints) {
        if (dayPointsEl) {
            dayPointsEl.style.display = '';
            const dpVal = document.getElementById('dayPointsValue');
            if (dpVal) {
                const dayPts = Math.max(0, game.normoPoints - game.dayStartPoints);
                dpVal.textContent = dayPts.toFixed(1);
            }
        }
        if (totalLabelEl) totalLabelEl.style.display = '';
    } else {
        if (dayPointsEl) dayPointsEl.style.display = 'none';
        if (totalLabelEl) totalLabelEl.style.display = 'none';
    }
}
// =============================================================================
// updateClockAndDayNight — HH:MM clock display + day/night sun/moon icon
// =============================================================================
// Extracted from updateUI(). Reads game.timeInMinutes + simulationSpeed and DOM;
// no shared updateUI locals.
function updateClockAndDayNight() {
    // Format time as HH:MM with zero-padding
    // At high speeds the minute value is rounded to the nearest 5 or 10
    // to prevent the time display from flickering chaotically fast.
    const hours = String(Math.floor(game.timeInMinutes / 60)).padStart(2, '0');
    let rawMinutes = Math.floor(game.timeInMinutes % 60);
    const speed = game.simulationSpeed || 60;
    if (speed >= 1440) rawMinutes = Math.floor(rawMinutes / 10) * 10;       // 24h/min → show per 10 min
    else if (speed >= 720) rawMinutes = Math.floor(rawMinutes / 5) * 5;     // 12h/min → show per 5 min
    const minutes = String(rawMinutes).padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}`;

    // Update the day/night icon based on the time of day — a stylised SVG sun/moon with glow.
    // .is-day / .is-night are set on .daynight-wrap (NOT on the img) so the ::before
    // pulse glow gets the right colour via the --daynight-glow custom property.
    const dayNightIcon = document.getElementById('dayNightIcon');
    const dayNightWrap = document.getElementById('dayNightWrap');
    if (dayNightIcon) {
        const h = Math.floor(game.timeInMinutes / 60);
        const isNight = (h >= 22 || h < 7);
        const targetSrc = isNight ? 'assets/icons/moon.svg' : 'assets/icons/sun.svg';
        // Only swap src + class if it actually changed (avoid unnecessary DOM traffic)
        if (!dayNightIcon.src.endsWith(targetSrc)) {
            dayNightIcon.src = targetSrc;
            if (dayNightWrap) {
                dayNightWrap.classList.toggle('is-night', isNight);
                dayNightWrap.classList.toggle('is-day', !isNight);
            }
        }
    }
}
// =============================================================================
// updateCgmTrendArrow — CGM trend arrow (rate of change over a 30-min window)
// =============================================================================
// Extracted from updateUI(). cgmActive is passed in (computed once per frame in
// updateUI from the sensor status); the rest reads cgmDataPoints + DOM.
function updateCgmTrendArrow(cgmActive) {
    // --- CGM trend arrow ---
    // Compute trend from the most recent CGM readings (like a real CGM: ↑↗→↘↓).
    // Uses a 30-minute window averaging the 2 readings at each end for noise robustness.
    // Rate = rate of change in mmol/L per minute.
    const cgmTrendEl = document.getElementById('cgm-trend');
    if (cgmTrendEl && !cgmActive) {
        cgmTrendEl.textContent = '!';
        cgmTrendEl.style.color = 'var(--orange)';
    } else if (cgmTrendEl && cgmDataPoints.length >= 4) {
        const currentTime = cgmDataPoints[cgmDataPoints.length - 1].time;
        const trendWindow = 30; // sim-minutes — longer window = more stable
        const trendPoints = cgmDataPoints.filter(p => p.time >= currentTime - trendWindow);
        if (trendPoints.length >= 4) {
            // Average of the 2 oldest and 2 newest points in the window
            const firstAvgVal = (trendPoints[0].value + trendPoints[1].value) / 2;
            const firstAvgTime = (trendPoints[0].time + trendPoints[1].time) / 2;
            const n = trendPoints.length;
            const lastAvgVal = (trendPoints[n - 1].value + trendPoints[n - 2].value) / 2;
            const lastAvgTime = (trendPoints[n - 1].time + trendPoints[n - 2].time) / 2;
            const timeDiff = lastAvgTime - firstAvgTime;
            if (timeDiff > 0) {
                const rate = (lastAvgVal - firstAvgVal) / timeDiff; // mmol/L per minute
                // Arrow + colour from the shared rate-to-trend mapping (cgmTrendForRate).
                const trend = cgmTrendForRate(rate);
                cgmTrendEl.textContent = trend.arrow;
                cgmTrendEl.style.color = trend.color;
            }
        }
    }
}
// =============================================================================
// setLifeBar — update one standard life bar (brain / acidosis)
// =============================================================================
// Fill width, percent text and the warning/danger colour class for a single bar.
// rawPct is clamped to [0,100]. Each element is guarded independently so a missing
// one never throws. The weight bar is a centre-bar with its own logic (not here).
function setLifeBar(fillEl, pctEl, barEl, rawPct) {
    if (!fillEl) return;
    const pct = Math.max(0, Math.min(100, rawPct));
    fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct);
    if (barEl) {
        barEl.classList.remove('warning', 'danger');
        if (pct < 25) barEl.classList.add('danger');
        else if (pct < 50) barEl.classList.add('warning');
    }
}

// =============================================================================
// updateLifeBars — three game-over criterion bars (brain / acidosis / weight)
// =============================================================================
// Extracted from updateUI(). Self-contained: reads game + DOM, no updateUI locals.
function updateLifeBars() {
    // --- Life bars: update the three game-over criteria ---
    // Brain: (1 - deficit/threshold) × 100 → full bar = safe, empty = game over
    // Acidosis: (1 - load/threshold) × 100 → full bar = safe, empty = game over
    // Weight: centre-bar, -100 to +100. Grows out from the centre. Shows distance to
    // weight game-over: ±100% = at the limit (weightLimitKg = 7% of starting weight).
    const _lfBrain = document.getElementById('life-fill-brain');
    const _lpBrain = document.getElementById('life-pct-brain');
    const _lrBrain = document.getElementById('life-bar-brain');
    const _lfAcid  = document.getElementById('life-fill-acid');
    const _lpAcid  = document.getElementById('life-pct-acid');
    const _lrAcid  = document.getElementById('life-bar-acid');
    const _lfWt    = document.getElementById('life-fill-weight');
    const _lpWt    = document.getElementById('life-pct-weight');
    const _lrWt    = document.getElementById('life-bar-weight');
    const statsWeightRow = document.getElementById('statsWeightRow');
    const showCalorieBalance = shouldShowCalorieBalanceUI();

    if (_lrWt) _lrWt.style.display = showCalorieBalance ? '' : 'none';
    if (statsWeightRow) statsWeightRow.style.display = showCalorieBalance ? '' : 'none';

    // Brain and acidosis are standard bars: full = safe, empty = game over.
    setLifeBar(_lfBrain, _lpBrain, _lrBrain,
        (1 - game.brainEnergyDeficit / game.BRAIN_DEFICIT_THRESHOLD) * 100);
    setLifeBar(_lfAcid, _lpAcid, _lrAcid,
        (1 - game.acidosisLoad / game.ACIDOSIS_THRESHOLD) * 100);
    if (_lfWt && showCalorieBalance) {
        // Weight life bar: shows the distance to the weight game-over so the player has real
        // feedback on the weight criterion. ±100% = at the limit (weightLimitKg = 7% of
        // starting weight). Centre-bar: negative = weight loss (left), gain (right).
        // Warning at 50%, danger at 80% — same thresholds as the colour coding.
        const limit = game.weightLimitKg || (0.07 * (game.weight || 70));
        const pctRaw = Math.max(-100, Math.min(100, (game.weightChangeKg / limit) * 100));
        const absPct = Math.abs(pctRaw);
        if (pctRaw >= 0) {
            _lfWt.style.left = '50%';
            _lfWt.style.width = (absPct / 2) + '%';
        } else {
            _lfWt.style.left = (50 - absPct / 2) + '%';
            _lfWt.style.width = (absPct / 2) + '%';
        }
        const sign = game.weightChangeKg > 0 ? '+' : '';
        _lpWt.textContent = sign + game.weightChangeKg.toFixed(1);
        _lrWt.classList.remove('warning', 'danger');
        if (absPct > 80) _lrWt.classList.add('danger');
        else if (absPct > 50) _lrWt.classList.add('warning');
    } else if (!showCalorieBalance) {
        if (_lrWt) _lrWt.classList.remove('warning', 'danger');
        if (typeof statsWeightValue !== 'undefined' && statsWeightValue) {
            statsWeightValue.textContent = '';
            statsWeightValue.style.color = '';
        }
    }
}


// =============================================================================
// updateGlucagonCooldownUI — Update the glucagon icon cooldown overlay and text
// =============================================================================
//
// Shows a grey overlay that gradually disappears from top to bottom,
// plus a countdown in hours below the icon.
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
        // Cooldown active: show overlay (percentage = remaining time)
        const pct = (remaining / cooldownMinutes) * 100;
        overlay.style.height = pct + '%';
        dockItem.classList.add('disabled');

        // Countdown: always in "HH:MM" format for a fixed width
        const hrs = Math.floor(remaining / 60);
        const mins = Math.floor(remaining % 60);
        text.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    } else {
        // Ready to use
        overlay.style.height = '0%';
        text.textContent = '';
        dockItem.classList.remove('disabled');
    }
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

// yAxisMax: dynamic upper limit of the y-axis. Starts at 16 mmol/L.
// Scales gradually up/down with animated interpolation and hysteresis:
//   - yAxisTarget: the desired target based on data (jumps in steps)
//   - yAxisMax: the displayed value, interpolated toward target (~2 sec animation)
//   - Hysteresis: scale-up threshold is 2 mmol/L above peak data; scale-down requires
//     that ALL visible data points are at least 3 mmol/L below the current axis
//     for at least 5 seconds (avoids constant readjustment)
let yAxisMax = 16.0;
let yAxisTarget = 16.0;
let yAxisShrinkTimer = 0;           // Time (ms) with data below the shrink threshold
const Y_AXIS_MIN = 16.0;            // Never below 16 mmol/L
const Y_AXIS_HARD_MAX = 36.0;       // Never above 36 mmol/L
const Y_AXIS_SHRINK_DELAY = 5000;   // 5-second hysteresis before the axis shrinks
const Y_AXIS_LERP_SPEED = 3.0;      // Interpolation speed (higher = faster)

// graphViewOverride — optional time-window override for drawGraph().
// When null (the default — live game and welcome tour), drawGraph renders the
// current day: a 1440-minute window aligned to the day boundary, exactly as
// before. The Scenarie editor sets this to a scrollable window of the form
// { startMin, widthMin } (startMin need NOT be day-aligned; the window may span
// day boundaries) so the SAME renderer — same zones, bands, colours and
// coordinate system — draws its static multi-day curve. Cleared on teardown.
let graphViewOverride = null;

// updateYAxisScale — dynamic y-axis target + animated lerp with hysteresis.
// Extracted from drawGraph() (pure code-move, no behaviour change): finds the
// tallest visible CGM value, sets the target axis height (instant on scale-up,
// Y_AXIS_SHRINK_DELAY hysteresis on scale-down) and eases yAxisMax toward it.
// Mutates the module-level yAxisTarget / yAxisMax / yAxisShrinkTimer; reads only
// cgmDataPoints. No geometry dependency, so it runs before the chart layout.
function updateYAxisScale() {
    // Find the highest CGM value currently visible on the graph
    let currentMaxCGMOnGraph = 0;
    const visibleCGMPoints = cgmDataPoints.slice(-MAX_GRAPH_POINTS_PER_DAY);
    visibleCGMPoints.forEach(p => { if (p.value > currentMaxCGMOnGraph) currentMaxCGMOnGraph = p.value; });

    // Compute required axis size: data + 2 mmol/L headroom, rounded up to nearest 2
    const neededMax = Math.ceil((currentMaxCGMOnGraph + 2) / 2) * 2;
    const clampedNeeded = Math.max(Y_AXIS_MIN, Math.min(Y_AXIS_HARD_MAX, neededMax));

    // SCALE UP: react immediately (target jumps up right away)
    if (clampedNeeded > yAxisTarget) {
        yAxisTarget = clampedNeeded;
        yAxisShrinkTimer = 0; // Reset shrink timer on new scale-up
    }

    // SCALE DOWN with hysteresis: require data to have been below threshold for 5 sec.
    // Shrink threshold: all data points must be at least 3 mmol/L below current target
    const shrinkThreshold = yAxisTarget - 3;
    if (currentMaxCGMOnGraph < shrinkThreshold && yAxisTarget > Y_AXIS_MIN) {
        yAxisShrinkTimer += 16; // ~16 ms per frame (requestAnimationFrame)
        if (yAxisShrinkTimer >= Y_AXIS_SHRINK_DELAY) {
            yAxisTarget = clampedNeeded;
            yAxisShrinkTimer = 0;
        }
    } else {
        yAxisShrinkTimer = 0; // Data rose again — reset timer
    }

    // Animated interpolation: yAxisMax moves gradually toward target
    const dt = 0.016; // ~16 ms frame time
    const diff = yAxisTarget - yAxisMax;
    if (Math.abs(diff) > 0.05) {
        // Exponential lerp: fast start, soft landing
        yAxisMax += diff * Y_AXIS_LERP_SPEED * dt;
    } else {
        yAxisMax = yAxisTarget; // Snap to target when close enough
    }
}

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

    // --- View window (window-aware graph) ---
    // The graph renders a time window [startMin, startMin + widthMin]. By default
    // (live game / welcome tour) this is the current day — a 1440-minute window
    // aligned to the day boundary, isLive:true — so behaviour is byte-for-byte the
    // old view. The Scenarie editor supplies a static, continuously scrollable
    // window via graphViewOverride (isLive:false, may span day boundaries, carries
    // a fixed yAxisMax). Computed up front because isLive gates the live-only bits
    // (animated y-axis, symptom overlay, the "now" marker and the future clip).
    const view = graphViewOverride || { startMin: (game ? game.day - 1 : 0) * 1440, widthMin: 1440, isLive: true };

    // --- Dynamic y-axis scaling med animation og hysterese ---
    // Live game: animate the axis toward the data. Editor: use the fixed yAxisMax
    // it computed for the whole period (a stable axis that does not jump on scroll).
    if (view.isLive) {
        updateYAxisScale(); // updates module-level yAxisTarget/yAxisMax/yAxisShrinkTimer
    } else if (view.yAxisMax) {
        yAxisTarget = yAxisMax = view.yAxisMax;
    }

    // Dynamic y-axis floor: when physiology bands are visible, the graph is extended
    // downward into negative space (-2 to -4 mmol/L) so the bands are drawn INSIDE
    // the chart area rather than outside it.
    const anyBandsActive = showInsulinBand || showCarbBand || showISFLine;
    const bandCount = (showInsulinBand ? 1 : 0) + (showCarbBand ? 1 : 0) + (showISFLine ? 1 : 0);
    // Negative space below BG=0: only the insulin band (downward) and the eISF line
    // need room. The carb band grows UPWARD and does not count.
    const downwardBands = (showInsulinBand ? 1 : 0) + (showISFLine ? 1 : 0);
    const yAxisMin = downwardBands > 0 ? -(0.5 + downwardBands * 1.0) : 0;
    const range = yAxisMax - yAxisMin; if (range <= 0) return;

    // Helper: convert a BG value to a y-pixel coordinate
    // (closure — uses padding/graphHeight defined below)
    const bgToY = (bg) => padding.top + graphHeight - ((bg - yAxisMin) / range) * graphHeight;

    // --- Chart area dimensions ---
    // Padding leaves room for axis labels and tick marks
    const padding = {top: 20, right: 20, bottom: 44, left: 64};
    graphCtx.clearRect(0, 0, bgGraphCanvas.width, bgGraphCanvas.height);
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;
    if (graphWidth <= 0 || graphHeight <= 0) return;

    // Derive the window variables from the active view (computed above). They keep
    // their original names so the rest of drawGraph — the ~30 time→x mappings and
    // data filters — is unchanged; it already reads exactly these two variables.
    const currentDayStartMinutes = view.startMin;
    const totalMinutesInView = view.widthMin;
    const viewEndMin = currentDayStartMinutes + totalMinutesInView;
    // Map an absolute sim-minute to an x pixel using the active view window.
    const timeToX = (m) => padding.left + ((m - currentDayStartMinutes) / totalMinutesInView) * graphWidth;

    // Expose the actual chart coordinates to the welcome tour.
    // The tour's focus areas must use the same dynamic y-axis as the canvas graph;
    // otherwise the 4-10 mmol/L target zone can be a few pixels off.
    window.t1dGraphMetrics = {
        left: rect.left + padding.left,
        top: rect.top + padding.top,
        width: graphWidth,
        height: graphHeight,
        yAxisMin,
        yAxisMax
    };

    // --- Dynamic band scaling ---
    // As BG rises, the negative space (0 → yAxisMin) is compressed in pixels.
    // Band heights are scaled proportionally so they always fit without overlap.
    // Reference: at yAxisMax=12 and yAxisMin=-2.5, range=14.5, the negative space uses
    // ~17% of graphHeight. At yAxisMax=28, range=30.5, only ~8%.
    // bandScale = actual negative-zone pixels / reference pixels (capped 0.3–1.0).
    const negativeZonePx = Math.abs(yAxisMin) / range * graphHeight;
    const referenceNegPx = Math.abs(yAxisMin) / (12 - yAxisMin) * graphHeight; // som ved yAxisMax=12
    const bandScale = Math.max(0.3, Math.min(1.0, negativeZonePx / (referenceNegPx || 1)));

    // --- Rounded clip for chart area ---
    // All fills/strokes inside the chart area are clipped to rounded corners
    // so zones, night shading etc. match the graph's border-radius.
    const chartRadius = 12;
    graphCtx.save();
    graphCtx.beginPath();
    graphCtx.roundRect(padding.left, padding.top, graphWidth, graphHeight, chartRadius);
    graphCtx.clip();

    // --- Night shading (22:00-07:00), view-aware ---
    // Darker overlay to indicate night-time hours — more visible in the dark theme.
    // Provides visual rhythm for the day/night cycle and reminds the player of the sleep mechanic.
    // Draw the night band (22:00 → 07:00) for every day the view window touches.
    // For the default day-aligned 1440-min window this produces the exact same
    // two rectangles as before; a scrollable editor window that spans midnight
    // gets each night it covers shaded correctly.
    // Lighter band for print: 0.55 alpha reads as a heavy dark block on a white
    // page, so the editor's print snapshot (view.printMode) uses a soft tint instead.
    graphCtx.fillStyle = view.printMode ? 'rgba(40, 50, 90, 0.14)' : 'rgba(10, 10, 40, 0.55)';
    const _nightRect = (aMin, bMin) => {
        const a = Math.max(aMin, currentDayStartMinutes);
        const b = Math.min(bMin, viewEndMin);
        if (b <= a) return;
        const xa = timeToX(a), xb = timeToX(b);
        graphCtx.fillRect(xa, padding.top, xb - xa, graphHeight);
    };
    for (let _d = Math.floor(currentDayStartMinutes / 1440); _d <= Math.floor((viewEndMin - 1) / 1440); _d++) {
        const _base = _d * 1440;
        _nightRect(_base + 22 * 60, _base + 24 * 60); // 22:00 → midnight
        _nightRect(_base, _base + 7 * 60);            // midnight → 07:00
    }

    // --- Awakening patches: "holes" in the night shading ---
    // When the player wakes up at night for an intervention, the night shading is
    // removed for the period the character is awake. The patch has the same appearance
    // as the daytime period — the night darkness is visually "broken up". Soft edges via gradient.
    if (game && game.sleepAwakeIntervals) {
        // Use 'destination-out' compositing to erase the night shading
        // during the periods the player is awake. Result: daytime colours
        // show through, as if the character turned on the light.
        graphCtx.save();
        graphCtx.globalCompositeOperation = 'destination-out';
        game.sleepAwakeIntervals.forEach(aw => {
            // Use absolute simulation time, not clock time alone. If an
            // awakening starts before midnight and continues after midnight,
            // the visible part must be drawn on both days' graph.
            const viewStartMin = currentDayStartMinutes;
            const viewEndMin = viewStartMin + totalMinutesInView;
            const awakeStartMin = aw.startMin;
            const awakeEndMin = aw.endMin == null ? game.totalSimMinutes : aw.endMin;
            const overlapStartMin = Math.max(awakeStartMin, viewStartMin);
            const overlapEndMin = Math.min(awakeEndMin, viewEndMin);
            if (overlapEndMin <= overlapStartMin) return;

            const dayMin = overlapStartMin - viewStartMin;
            const endDayMin = overlapEndMin - viewStartMin;
            const awX = padding.left + (dayMin / totalMinutesInView) * graphWidth;
            const awW = ((endDayMin - dayMin) / totalMinutesInView) * graphWidth;
            if (awW <= 0) return;

            // Horizontal gradient: soft edges so the patch has no hard sides
            const fadeW = Math.min(awW * 0.3, 15); // 30% of the width, max 15px
            const awGrad = graphCtx.createLinearGradient(awX, 0, awX + awW, 0);
            awGrad.addColorStop(0, 'rgba(0,0,0,0)');
            awGrad.addColorStop(fadeW / awW, 'rgba(0,0,0,0.85)');       // Remove 85% of the night shading
            awGrad.addColorStop(1 - fadeW / awW, 'rgba(0,0,0,0.85)');
            awGrad.addColorStop(1, 'rgba(0,0,0,0)');
            graphCtx.fillStyle = awGrad;
            graphCtx.fillRect(awX, padding.top, awW, graphHeight);
        });
        graphCtx.restore();
    }



    // --- BG zone colouring with soft pastels ---
    // Vertical gradient blending zone colours smoothly instead of
    // hard edges. A transition band (~0.8 mmol/L) at each boundary gives
    // a soft transition. Soft pastels: warm, friendly tones with low alpha.
    // Pink/peach in danger zones, mint in target, amber in elevated.
    //
    // Zones: 0-4.0 pink (hypo) | 4.0-10.0 mint (target) | 10.0-14.0 amber | 14.0+ peach
    // Helper: convert a BG value to a gradient stop (0.0 = top, 1.0 = bottom)
    const bgToStop = (bg) => 1.0 - ((bg - yAxisMin) / range);
    const TRANSITION = 0.8; // mmol/L width of the transition band
    const halfT = TRANSITION / 2;

    // Build vertical gradient from top (yAxisMax) to bottom (0)
    const zoneGrad = graphCtx.createLinearGradient(
        0, padding.top, 0, padding.top + graphHeight
    );

    // Zone colours — soft pastels with low alpha (0.08–0.12).
    // Warm pink (hypo), mint (target), amber (elevated), peach (hyper).
    // Halved saturation and alpha compared to the old colours → calmer, warmer look.
    const pink      = 'rgba(255, 150, 170, 0.12)';   // Hypo: warm pink
    const mint      = 'rgba(134, 239, 172, 0.12)';   // Target: warm mint/jade
    const amber     = 'rgba(253, 224, 130, 0.10)';   // Elevated: warm amber
    const peach     = 'rgba(255, 180, 170, 0.08)';   // Hyper: light pink-peach

    // Colours are placed with soft transitions at 4.0, 10.0 and 14.0 mmol/L.
    // Clamp stops to [0, 1] to avoid errors at extremes.
    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    zoneGrad.addColorStop(0, peach);                                               // Top: hyper
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.HYPER + halfT)), peach);       // Peach ends
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.HYPER - halfT)), amber);       // Amber begins
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.TARGET_HIGH + halfT)), amber); // Amber ends
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.TARGET_HIGH - halfT)), mint);  // Mint begins
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.HYPO + halfT)), mint);         // Mint ends
    zoneGrad.addColorStop(clamp01(bgToStop(BG_ZONES.HYPO - halfT)), pink);         // Pink hypo begins
    zoneGrad.addColorStop(1, pink);                                                // Bottom: hypo

    graphCtx.fillStyle = zoneGrad;
    graphCtx.fillRect(padding.left, padding.top, graphWidth, graphHeight);

    // --- Soft boundary lines at 4, 10 and 14 mmol/L ---
    // Thin (2px) line with a horizontal gradient fade: strongest in the centre,
    // fades to transparent at the left/right edge of the graph. Warm colours
    // match the zone pastels and give a discreet, friendly boundary.
    const boundaryDefs = [
        { bg: 4.0,  color: [255, 150, 170], alpha: 0.20 },  // Pink: hypo boundary
        { bg: 10.0, color: [134, 239, 172], alpha: 0.18 },  // Mint: target boundary
        { bg: 14.0, color: [253, 224, 130], alpha: 0.15 },  // Amber: hyper boundary
    ];
    boundaryDefs.forEach(({ bg, color, alpha }) => {
        const y = bgToY(bg);
        const lineGrad = graphCtx.createLinearGradient(
            padding.left, 0, padding.left + graphWidth, 0
        );
        const [r, g, b] = color;
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.10, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        lineGrad.addColorStop(0.90, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        lineGrad.addColorStop(1, 'transparent');
        graphCtx.strokeStyle = lineGrad;
        graphCtx.lineWidth = 2;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, y);
        graphCtx.lineTo(padding.left + graphWidth, y);
        graphCtx.stroke();
    });

    // (Fatal hypo threshold line removed — game over is now gradual via
    // brainEnergyDeficit, so a fixed line at 1.5 mmol/L would be misleading.)

    // --- Bonus zone (BG 5.0–6.0): subtle "sweet spot" marking ---
    // Marks the area where scoring gives 2 points/hour (see updateNormoPoints).
    // A very discreet mint band in the same pastel palette as the other zones, with
    // a horizontal fade (strongest in the centre) so it never looks like a hard box.
    // Drawn on top of the zone gradient — applies to both the game and the Scenario editor
    // (in the editor it is the only sweet-spot cue, since CGM dot glow is absent).
    {
        const bonusTopY = bgToY(6.0), bonusBotY = bgToY(5.0);
        const bonusGrad = graphCtx.createLinearGradient(
            padding.left, 0, padding.left + graphWidth, 0
        );
        bonusGrad.addColorStop(0, 'transparent');
        bonusGrad.addColorStop(0.10, 'rgba(134, 239, 172, 0.11)');
        bonusGrad.addColorStop(0.90, 'rgba(134, 239, 172, 0.11)');
        bonusGrad.addColorStop(1, 'transparent');
        graphCtx.fillStyle = bonusGrad;
        graphCtx.fillRect(padding.left, bonusTopY, graphWidth, bonusBotY - bonusTopY);
    }

    // --- Physiology view watermark ---
    // Large rotated text stamp in the centre of the graph when physiology view is active.
    // Reminds the player that scores are not saved. Drawn behind data but above zones.
    if (view.isLive && typeof physiologyEffectsEnabled !== 'undefined' && physiologyEffectsEnabled) {
        graphCtx.save();
        const wmX = padding.left + graphWidth / 2;
        const wmY = padding.top + graphHeight / 2;
        graphCtx.translate(wmX, wmY);
        graphCtx.rotate(-Math.PI / 12);
        graphCtx.filter = 'blur(2px)';
        graphCtx.font = 'bold 38px Inter, sans-serif';
        graphCtx.textAlign = 'center';
        graphCtx.textBaseline = 'middle';
        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        graphCtx.letterSpacing = '6px';
        const wmText = t('ui.physiology.watermark');
        graphCtx.fillText(wmText, 0, 0);
        graphCtx.filter = 'none';
        graphCtx.restore();
    }

    // --- Pause overlay ---
    // Large centred pause indicator when the simulation is paused. Includes:
    //   1. Subtle dark dim over the chart area to make it look "frozen"
    //   2. Large ⏸ icon in the centre with "PAUSE" text below
    //   3. Pulsating opacity to catch the eye
    // Drawn as the last background element so it sits above zones
    // and watermark, but below data lines (data is drawn afterwards in drawGraph).
    if (view.isLive && !document.body.classList.contains('insights-confirm-open') &&
        typeof isPaused !== 'undefined' && isPaused && game && !game.isGameOver) {
        graphCtx.save();
        // 1. Subtle dim over the entire chart area — makes it visually clear that
        //    the game has stopped without hiding the graph.
        graphCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        graphCtx.fillRect(padding.left, padding.top, graphWidth, graphHeight);

        // 2. Pulsating opacity (1.5s cycle, 0.55 → 0.95)
        const pulsePhase = (performance.now() / 1500) % 1;
        const pulse = 0.55 + 0.40 * (0.5 + 0.5 * Math.cos(pulsePhase * Math.PI * 2));

        const cx = padding.left + graphWidth / 2;
        const cy = padding.top + graphHeight / 2;

        // 3. ⏸ icon — two vertical bars
        graphCtx.globalAlpha = pulse;
        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        graphCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        graphCtx.lineWidth = 3;
        const barW = 14;
        const barH = 64;
        const barGap = 10;
        // Left bar
        graphCtx.beginPath();
        graphCtx.roundRect(cx - barGap - barW, cy - barH / 2, barW, barH, 4);
        graphCtx.fill();
        graphCtx.stroke();
        // Right bar
        graphCtx.beginPath();
        graphCtx.roundRect(cx + barGap, cy - barH / 2, barW, barH, 4);
        graphCtx.fill();
        graphCtx.stroke();

        // 4. "PAUSE" text below the icon
        graphCtx.font = 'bold 20px Inter, sans-serif';
        graphCtx.textAlign = 'center';
        graphCtx.textBaseline = 'top';
        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        graphCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        graphCtx.lineWidth = 3;
        graphCtx.letterSpacing = '4px';
        graphCtx.strokeText('PAUSE', cx, cy + barH / 2 + 14);
        graphCtx.fillText('PAUSE', cx, cy + barH / 2 + 14);

        graphCtx.restore();
    }

    // Insights kan overtage Box Challenge-kasser som låst scenariegeometri.
    // Hooket ligger her, så kasserne - ligesom i det aktive spil - tegnes under
    // blodsukkerkurver og handlingsmarkører.
    if (!view.isLive && typeof Editor !== 'undefined' && Editor.drawLockedBoxes) {
        Editor.drawLockedBoxes(graphCtx, {
            padding, graphWidth, graphHeight, bgToY, timeToX,
            startMin: currentDayStartMinutes, widthMin: totalMinutesInView
        });
    }
    if (!view.isLive && typeof Editor !== 'undefined' && Editor.drawLockedEvents) {
        Editor.drawLockedEvents(graphCtx, {
            padding, graphWidth, graphHeight, bgToY, timeToX,
            startMin: currentDayStartMinutes, widthMin: totalMinutesInView
        });
    }

    // --- Box Challenge: draw obstacle boxes in the chart area ---
    // Boxes are drawn BEFORE the clip restore, so they are clipped by the chart's rounded corners.
    // Only active boxes for the current day are shown.
    if (game && game.gameMode === 'boxchallenge' && game.boxes) {
        const dayBoxes = game.boxes.filter(b => b.dayNumber === game.day);
        dayBoxes.forEach(box => {
            // Convert box coordinates to canvas pixels.
            // Left side: (startMinute, bgMin-bgMax)
            // Right side: (endMinute, bgMin+skew - bgMax+skew)
            const skew = box.skewBG || 0;
            const x1 = padding.left + (box.startMinute / totalMinutesInView) * graphWidth;
            const x2 = padding.left + (box.endMinute / totalMinutesInView) * graphWidth;
            // Left edge: original BG
            const yTopL = bgToY(box.bgMax);
            const yBotL = bgToY(box.bgMin);
            // Right edge: BG + skew (parallelogram)
            const yTopR = bgToY(box.bgMax + skew);
            const yBotR = bgToY(box.bgMin + skew);

            // Fade-in animation: opacity ramps up over 2 seconds (real-time)
            let opacity = 1.0;
            if (box.fadeInStart !== null) {
                const elapsed = performance.now() - box.fadeInStart;
                opacity = Math.min(1.0, elapsed / 2000);
            }

            graphCtx.save();
            graphCtx.globalAlpha = opacity;

            // Draw box shape: rectangle (skew=0) or parallelogram (skew≠0)
            // Path: left-top → right-top → right-bottom → left-bottom
            const drawBoxPath = () => {
                graphCtx.beginPath();
                graphCtx.moveTo(x1, yTopL);
                graphCtx.lineTo(x2, yTopR);
                graphCtx.lineTo(x2, yBotR);
                graphCtx.lineTo(x1, yBotL);
                graphCtx.closePath();
            };

            if (box.hit) {
                // Hit box: grey, dimmed, crossed out
                graphCtx.fillStyle = 'rgba(80, 80, 80, 0.3)';
                drawBoxPath();
                graphCtx.fill();
                graphCtx.strokeStyle = 'rgba(150, 150, 150, 0.4)';
                graphCtx.lineWidth = 1.5;
                graphCtx.stroke();
                // Cross (X) — diagonals through the parallelogram
                graphCtx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
                graphCtx.lineWidth = 2;
                graphCtx.beginPath();
                graphCtx.moveTo(x1 + 6, yTopL + 6); graphCtx.lineTo(x2 - 6, yBotR - 6);
                graphCtx.moveTo(x2 - 6, yTopR + 6); graphCtx.lineTo(x1 + 6, yBotL - 6);
                graphCtx.stroke();
            } else {
                // Active box: black fill, pulsating red border + background glow.
                // Proximity effect: pulsation intensifies as BG approaches the box
                // (≤1 mmol/L BG distance and/or ≤60 min time distance).

                // Compute distance from current BG/time to the box
                const timeInDay = game.totalSimMinutes % 1440;
                const trueBG = game.trueBG;

                // Time distance (minutes) — 0 if we are within the box's time interval
                let timeDist;
                if (timeInDay >= box.startMinute && timeInDay <= box.endMinute) {
                    timeDist = 0;
                } else {
                    timeDist = Math.min(Math.abs(timeInDay - box.startMinute), Math.abs(timeInDay - box.endMinute));
                }

                // BG distance (mmol/L) — compensate for skew at the current time position
                const dur = box.endMinute - box.startMinute || 1;
                const frac = Math.max(0, Math.min(1, (timeInDay - box.startMinute) / dur));
                const skewOff = skew * frac;
                const curBgMin = box.bgMin + skewOff;
                const curBgMax = box.bgMax + skewOff;
                let bgDist;
                if (trueBG >= curBgMin && trueBG <= curBgMax) {
                    bgDist = 0;
                } else {
                    bgDist = Math.min(Math.abs(trueBG - curBgMin), Math.abs(trueBG - curBgMax));
                }

                // Proximity: 0 (far away) → ~0.85 (right at the edge).
                // Capped at 0.85 to avoid extremely fast pulsation.
                // Uses the PRODUCT of time and BG proximity — both must be close
                // for the pulse to intensify. Prevents fast pulsation simply
                // because time is approaching, while BG is still far from the box.
                const timeProx = Math.max(0, 1 - timeDist / 60);   // 60 min = 1 hour
                const bgProx   = Math.max(0, 1 - bgDist / 2.0);    // 2.0 mmol/L distance
                const proximity = Math.min(0.85, timeProx * bgProx);

                // Pulse period: 400 ms (calm) → 220 ms (hectic) based on proximity.
                // Floor 220 ms ≈ ~1.1 Hz full cycle — dramatic but not seizure-inducing.
                const pulseSpeed = 400 - proximity * 210;
                const pulse = 0.5 + 0.5 * Math.sin(performance.now() / pulseSpeed);

                // Glow and border scale up with proximity
                const glowIntensity = 8 + pulse * (22 + proximity * 20);    // shadowBlur 8→30 (calm) → 8→47 (close)
                const glowAlpha = (0.3 + proximity * 0.1) + pulse * (0.5 + proximity * 0.15);  // stronger glow
                const borderAlpha = (0.5 + proximity * 0.1) + pulse * (0.45 - proximity * 0.05);

                // Black fill (static, no oscillation)
                graphCtx.shadowColor = `rgba(255, 30, 30, ${glowAlpha})`;
                graphCtx.shadowBlur = glowIntensity;
                graphCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
                drawBoxPath();
                graphCtx.fill();
                // Pulsating red border
                graphCtx.shadowBlur = 0;
                graphCtx.strokeStyle = `rgba(255, 50, 50, ${borderAlpha})`;
                graphCtx.lineWidth = 2.5;
                graphCtx.stroke();
            }

            graphCtx.restore();
        });
    }

    // --- End rounded clip (zones/shading are now clipped) ---
    graphCtx.restore();

    // --- Chart border with rounded corners ---
    graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    graphCtx.roundRect(padding.left, padding.top, graphWidth, graphHeight, chartRadius);
    graphCtx.stroke();

    // --- X-axis labels (time of day, every 2 hours) — view-aware ---
    // Place a tick at every even clock-hour inside the view window, labelled with
    // the time of day. The default day-aligned 1440-min window yields 00,02,…,22
    // plus "24" at the right edge — identical to the classic day view. A
    // scrollable editor window that spans midnight shows "00" at interior day
    // boundaries and the correct time of day at each edge.
    graphCtx.fillStyle = 'rgba(190, 210, 235, 0.85)'; graphCtx.font = "bold 14px Inter, Segoe UI";
    for (let _h = Math.ceil(currentDayStartMinutes / 60); _h <= Math.floor(viewEndMin / 60); _h++) {
        if (_h % 2 !== 0) continue; // every 2nd hour
        const _absMin = _h * 60;
        const _x = timeToX(_absMin);
        const _hourOfDay = ((_h % 24) + 24) % 24;
        // Right-edge midnight reads "24" (matches the classic 24-hour view);
        // interior midnights read "00".
        const _label = (_hourOfDay === 0 && _absMin === viewEndMin) ? '24' : String(_hourOfDay).padStart(2, '0');
        graphCtx.fillText(_label, _x - 9, padding.top + graphHeight + 22);
    }

    // --- Y-axis labels (BG values in the user's chosen unit) ---
    const isMgDl = appSettings.bgUnit === 'mg';
    if (isMgDl) {
        // mg/dL mode: steps of 50 mg/dL, convert back to mmol/L for y-positioning
        const mgStep = range * MMOL_TO_MGDL > 270 ? 100 : 50;
        const mgMax = Math.ceil(yAxisMax * MMOL_TO_MGDL / mgStep) * mgStep;
        for (let mg = 0; mg <= mgMax; mg += mgStep) {
            const mmol = mg / MMOL_TO_MGDL;
            if (mmol > yAxisMax) break;
            if (mg === 0 && yAxisMax > 2) continue;
            const y = bgToY(mmol);
            graphCtx.fillText(mg.toString(), padding.left - 28, y + 5);
        }
    } else {
        // mmol/L mode: steps of 1 or 2 depending on the axis span
        const yStep = range > 15 ? 2 : 1;
        for (let i = 0; i <= yAxisMax; i += yStep) {
            if (i === 0 && yAxisMax > 2) continue;
            const y = bgToY(i);
            graphCtx.fillText(i.toFixed(0), padding.left - 24, y + 5);
        }
    }

    // --- Y-axis label (rotated text: "Blodsukker (mmol/L)") ---
    // save/restore preserves the current canvas state around the rotation
    graphCtx.save(); graphCtx.translate(16, padding.top + graphHeight/2); graphCtx.rotate(-Math.PI/2);
    graphCtx.textAlign = "center"; graphCtx.font = "bold 14px Inter, Segoe UI";
    graphCtx.fillStyle = 'rgba(190, 210, 235, 0.85)';
    graphCtx.fillText(t('graph.yAxisLabel', {unit: bgUnitLabel()}), 0, 0); graphCtx.restore();

    // --- Data window ---
    // currentDayStartMinutes / totalMinutesInView are computed once at the top of
    // drawGraph from the active view (day-based for the live game, a scrollable
    // window for the Scenarie editor). Without a game (welcome tour) the default
    // view falls back to day 1 (startMin 0) so the tour's demo CGM points still
    // plot with the real renderer.

    // --- True BG line ---
    // The actual BG drawn as a bright blue line. Shown in the live game only when
    // the debug checkbox is on (it reveals the "ground truth" the CGM approximates),
    // and ALWAYS in the editor — there it IS the curve (deterministic, no CGM noise
    // to approximate), so the editor drops the CGM dots and shows only this line.
    // Brighter + 2x thicker than before so it reads clearly as the main curve.
    const showTrueBgLine = game && trueBgPoints.length &&
        ((view.isLive && debugTrueBgCheckbox.checked) || !view.isLive);
    if (showTrueBgLine) {
        const points = trueBgPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
        graphCtx.beginPath();
        points.forEach((p, i) => {
            const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            const y = bgToY(p.value);
            if (i === 0) graphCtx.moveTo(x, y); else graphCtx.lineTo(x, y);
        });
        graphCtx.lineJoin = 'round'; graphCtx.lineCap = 'round';
        graphCtx.strokeStyle = 'rgba(130, 165, 255, 0.95)'; graphCtx.lineWidth = 4; graphCtx.stroke();

        // "True BG" label only in the live debug overlay — in the editor the line
        // is the sole curve and needs no debug label.
        if (view.isLive) {
            graphCtx.save();
            graphCtx.font = 'bold 12px Inter, Segoe UI, sans-serif';
            graphCtx.textAlign = 'right';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = 'rgba(130, 165, 255, 0.9)';
            const trueBgLabelY = bgToY(7);
            graphCtx.fillText('Rigtig', padding.left - 4, trueBgLabelY - 7);
            graphCtx.fillText(t('stats.bgShort'), padding.left - 4, trueBgLabelY + 7);
            graphCtx.restore();
        }
    }

    // --- CGM data points ---
    // Each CGM reading is drawn as a small colored circle:
    //   Green: within target range (4.0-10.0 mmol/L)
    //   Red: outside target range (hypo or hyper)
    // Finger prick measurements are shown as blood drop emojis instead.
    const pointsToDraw = cgmDataPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
    pointsToDraw.forEach(p => {
        const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
        const y = bgToY(p.value);
        if (y < padding.top || y > padding.top + graphHeight) return; // Skip if off-screen

        if (p.type === 'fingerprick') {
            // Finger prick: draw the blood drop image at the measurement point.
            const bloodImg = _getFoodIconImage('assets/icons/app/blood-drop.png');
            const iconSize = 22;
            if (bloodImg.complete && bloodImg.naturalWidth > 0) {
                graphCtx.drawImage(bloodImg, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
            } else {
                graphCtx.font = '16px Arial';
                graphCtx.textAlign = 'center';
                graphCtx.textBaseline = 'middle';
                graphCtx.fillStyle = '#e53e3e';
                graphCtx.fillText(t('stats.bgShort'),x, y);
            }
        } else {
            // Regular CGM reading: small colored circle
            // Colours reflect scoring zones: green=target, orange=elevated, red=danger
            const isSweetSpot = p.value >= 5.0 && p.value <= 6.0;

            // Sweet spot glow: points in 5.0–6.0 mmol/L get a soft mint glow
            // behind them via shadowBlur. Gives visual reward without a background fill.
            if (isSweetSpot) {
                graphCtx.save();
                graphCtx.shadowColor = 'rgba(134, 239, 172, 0.8)';
                graphCtx.shadowBlur = 10;
            }

            graphCtx.beginPath();
            graphCtx.arc(x, y, isSweetSpot ? 3.5 : 3, 0, 2 * Math.PI);
            // Zone from the shared classifier (same thresholds as hero colour + gradient).
            const ptZone = getBGZone(p.value);
            graphCtx.fillStyle = ptZone === 'danger' ? '#ef4444'         // Red: acute danger
                : ptZone === 'elevated' ? '#fb923c'                       // Orange: elevated
                : '#4ade80';                                              // Green: in target
            graphCtx.fill();

            if (isSweetSpot) {
                graphCtx.restore();
            }
        }
    });

    // The rest of the graph (symptom overlays, physiology bands, intervention markers)
    // requires an active game. Without a game — e.g. during the welcome tour —
    // the CGM points above are the only thing drawn on top of the grid and target zone.
    if (!game) return;

    // --- Symptom texts: subtle, blurred text drifting in the background ---
    // Physiological symptoms fade in and out based on current state.
    // Three categories: hypo (BG < 4), DKA (ketones > 1.5), hyperglycaemia (BG > 14).
    // Text is large, faint, and blurred — targeting peripheral awareness.
    // Each symptom has a unique phase offset so they do not overlap visually.
    // Symptoms are a live-only ambient effect (they fade in on the character's
    // CURRENT state). The static editor has no "now", so skip them there.
    if (view.isLive) {
        // Store y-axis parameters so drawSymptomOverlay can use them for anchor position.
        drawSymptomOverlay._yAxisMin = yAxisMin;
        drawSymptomOverlay._range = range;
        drawSymptomOverlay(graphCtx, padding, graphWidth, graphHeight);
        // Reset canvas state after the symptom overlay — at night this function
        // draws sleep bubbles with clip, shadow, and scale. Any state leaked from
        // here would affect all subsequent elements (bands, icons, markers).
        graphCtx.globalAlpha = 1.0;
        graphCtx.globalCompositeOperation = 'source-over';
        graphCtx.shadowBlur = 0;
        graphCtx.shadowColor = 'transparent';
    }

    // --- Insulin band: filled band near the bottom of the graph ---
    // Only visible when the physiology overlay is active (same toggle as the effects panel).
    // IAN band (Insulin Active Now) — shows PLASMA insulin rather than IOB.
    // Plasma insulin (I×V_I) shows when insulin is actually acting — the classic
    // PK curve: gradual rise → peak at ~55 min → slow decay.
    // Rapid (downward, light teal): plasma insulin ABOVE baseline = bolus contribution.
    // Basal (downward, light blue): steady-state plasma contribution (stacked below rapid).
    // Both insulin bands point downward because insulin LOWERS BG.
    // --- Shared right boundary for physiology bands ---
    // Bands MUST NOT be drawn into the future. Compute the x-position for the current
    // sim time and use it as the right boundary — except for completed days where
    // we have data for the full day and extend to the graph edge.
    // view.isLive gates the "now" concept: the static editor has no current time,
    // so isCurrentDay is false there → bands extend to the full width and the
    // now-marker is skipped.
    const simNowMin = game ? game.totalSimMinutes : 0;
    const isCurrentDay = view.isLive && game && (simNowMin >= currentDayStartMinutes && simNowMin < currentDayStartMinutes + totalMinutesInView);
    const nowX = isCurrentDay
        ? padding.left + ((simNowMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth
        : padding.left + graphWidth;  // afsluttet dag / editor → fuld bredde

    const insulinBandsVisible = showInsulinBand && game && physiologyDataPoints.length > 2;
    if (insulinBandsVisible) {
        const insulinBandMaxH = 28 * bandScale; // scaled pixel height
        // Centre line placed at BG=0 (top of the negative space)
        const centerY = bgToY(0);
        const currentDayStart = currentDayStartMinutes;

        // --- FIXED scaling based on the player's profile (ICR) ---
        // Scaling is proportional to a "typical large bolus" (50 g carbs / ICR).
        // Fixed scaling ensures that 1U is always visually half of 2U (linear).
        const basalBaseline = game.basalPlasmaInsulinBaseline || 75;
        const ke = game.hovorka?.k_e || 0.138;
        const tauI = game.hovorka?.tau_I || 55;
        const icr = game.ICR || 10;
        // Peak plasma contribution from a typical large bolus (50 g carbs / ICR):
        // dose_mU × bioav × exp(-1) / (τ_I × k_e)
        const typicalBolusMU = (50 / icr) * 780;  // effektiv mU (78% bioav)
        const rapidPeakMU = typicalBolusMU * 0.368 / (tauI * ke);
        const sharedNorm = Math.max(basalBaseline, rapidPeakMU) * 1.3;
        const clipFactor = 2.0;

        // Collect visible data points: split plasma insulin into basal + rapid.
        // rapidPlasmaMU is computed at recording time in simulator.js (total - basal)
        // and stored in each data point. This preserves historical bolus data
        // even after activeFastInsulin has been emptied (fully absorbed bolus).
        const visPoints = [];
        for (let i = 0; i < physiologyDataPoints.length; i++) {
            const p = physiologyDataPoints[i];
            if (p.time < currentDayStart || p.time >= currentDayStart + totalMinutesInView) continue;
            const x = padding.left + ((p.time - currentDayStart) / totalMinutesInView) * graphWidth;
            const dynamicBasal = p.basalPlasmaMU != null ? p.basalPlasmaMU : basalBaseline;
            const rapidPlasma = p.rapidPlasmaMU != null ? p.rapidPlasmaMU : 0;
            visPoints.push({ x, basalPlasma: dynamicBasal, rapidPlasma });
        }
        // Extend to the graph edges to avoid discontinuities at day boundaries.
        // The first point is extended to the left edge. The last point is extended to
        // nowX (current sim time) — NOT to the graph's right edge, because the band
        // must not be drawn into the future.
        if (visPoints.length >= 1) {
            if (visPoints[0].x > padding.left + 2) {
                visPoints.unshift({ ...visPoints[0], x: padding.left });
            }
            if (visPoints[visPoints.length - 1].x < nowX - 2) {
                visPoints.push({ ...visPoints[visPoints.length - 1], x: nowX });
            }
        }

        if (visPoints.length >= 2) {
            // Basal (steady-state plasma insulin): filled area DOWNWARD from centre line (light blue)
            // Basal is drawn first (closest to centre line); rapid is stacked below it.
            graphCtx.beginPath();
            graphCtx.moveTo(visPoints[0].x, centerY);
            for (let i = 0; i < visPoints.length; i++) {
                const h = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].basalPlasma / sharedNorm) * insulinBandMaxH);
                graphCtx.lineTo(visPoints[i].x, centerY + h);
            }
            graphCtx.lineTo(visPoints[visPoints.length - 1].x, centerY);
            graphCtx.closePath();
            graphCtx.fillStyle = 'rgba(96, 165, 250, 0.50)';
            graphCtx.fill();
            // Border line — same colour as fill
            graphCtx.beginPath();
            for (let i = 0; i < visPoints.length; i++) {
                const h = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].basalPlasma / sharedNorm) * insulinBandMaxH);
                if (i === 0) graphCtx.moveTo(visPoints[i].x, centerY + h);
                else graphCtx.lineTo(visPoints[i].x, centerY + h);
            }
            graphCtx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
            graphCtx.lineWidth = 1;
            graphCtx.stroke();

            // Rapid (bolus plasma insulin): filled area DOWNWARD stacked BELOW basal (light teal)
            // Classic PK curve: onset ~15 min, peak ~55 min, decay over 3-5 hours.
            // Drawn as a closed polygon from the basal bottom edge downward to basal+rapid,
            // so teal does NOT overdraw the blue basal band.
            graphCtx.beginPath();
            // Top edge: follow the basal bottom edge (left to right)
            for (let i = 0; i < visPoints.length; i++) {
                const basalH = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].basalPlasma / sharedNorm) * insulinBandMaxH);
                if (i === 0) graphCtx.moveTo(visPoints[i].x, centerY + basalH);
                else graphCtx.lineTo(visPoints[i].x, centerY + basalH);
            }
            // Bottom edge: follow basal+rapid (right to left)
            for (let i = visPoints.length - 1; i >= 0; i--) {
                const basalH = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].basalPlasma / sharedNorm) * insulinBandMaxH);
                const rapidH = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].rapidPlasma / sharedNorm) * insulinBandMaxH);
                graphCtx.lineTo(visPoints[i].x, centerY + basalH + rapidH);
            }
            graphCtx.closePath();
            graphCtx.fillStyle = 'rgba(94, 234, 212, 0.50)';
            graphCtx.fill();
            // Border line — bottom edge only (basal+rapid)
            graphCtx.beginPath();
            for (let i = 0; i < visPoints.length; i++) {
                const basalH = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].basalPlasma / sharedNorm) * insulinBandMaxH);
                const rapidH = Math.min(insulinBandMaxH * clipFactor,
                    (visPoints[i].rapidPlasma / sharedNorm) * insulinBandMaxH);
                if (i === 0) graphCtx.moveTo(visPoints[i].x, centerY + basalH + rapidH);
                else graphCtx.lineTo(visPoints[i].x, centerY + basalH + rapidH);
            }
            graphCtx.strokeStyle = 'rgba(94, 234, 212, 0.50)';
            graphCtx.lineWidth = 1;
            graphCtx.stroke();

            // --- Labels ---
            graphCtx.save();
            graphCtx.font = 'bold 12px Inter, Segoe UI, sans-serif';
            graphCtx.textAlign = 'right';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = 'rgba(96, 165, 250, 0.85)';
            graphCtx.fillText('Basal', padding.left - 4, centerY + insulinBandMaxH * 0.35);
            graphCtx.fillStyle = 'rgba(94, 234, 212, 0.85)';
            graphCtx.fillText('Rapid', padding.left - 4, centerY + insulinBandMaxH * 0.85);
            graphCtx.restore();
        }
    }

    // --- Carbohydrate absorption band: filled band showing U_G (gut → plasma) ---
    // Same visual pattern as the insulin band. Shows carbohydrate absorption rate
    // (U_G = D2 / τG from the Hovorka model) as a filled area.
    // Colour: warm orange (matches the food icon colour scheme).
    const carbBandVisible = showCarbBand && game && physiologyDataPoints.length > 2;
    if (carbBandVisible) {
        const carbBandMaxH = 17 * bandScale;  // scaled pixel height
        // Centre line at BG=0 — band grows UPWARD (carbohydrates raise BG)
        const carbCenterY = bgToY(0);
        const currentDayStartCarb = currentDayStartMinutes;

        // Scaling: typical U_G peak for a 50 g carb meal ≈ 0.8–1.2 mmol/min.
        // No hard clip — large meals are drawn taller (behind BG data/icons).
        const carbNorm = 1.0;  // mmol/min — a ~50 g carb meal peaks around here

        // Collect visible data points
        const carbVisPoints = [];
        for (let i = 0; i < physiologyDataPoints.length; i++) {
            const p = physiologyDataPoints[i];
            if (p.time < currentDayStartCarb || p.time >= currentDayStartCarb + totalMinutesInView) continue;
            const x = padding.left + ((p.time - currentDayStartCarb) / totalMinutesInView) * graphWidth;
            carbVisPoints.push({ x, ug: p.carbAbsorption || 0 });
        }
        // Extend to the graph edges (avoid discontinuities at day boundaries).
        // Right boundary is nowX — the band is NOT drawn into the future.
        if (carbVisPoints.length >= 1) {
            if (carbVisPoints[0].x > padding.left + 2) {
                carbVisPoints.unshift({ ...carbVisPoints[0], x: padding.left });
            }
            if (carbVisPoints[carbVisPoints.length - 1].x < nowX - 2) {
                carbVisPoints.push({ ...carbVisPoints[carbVisPoints.length - 1], x: nowX });
            }
        }

        if (carbVisPoints.length >= 2) {
            // Filled area UPWARD from centre line (carbohydrates raise BG).
            // No hard clip — large meals grow freely up into the BG zone.
            // Drawn behind icons and BG data, so overlap is visually acceptable.
            graphCtx.beginPath();
            graphCtx.moveTo(carbVisPoints[0].x, carbCenterY);
            for (let i = 0; i < carbVisPoints.length; i++) {
                const h = (carbVisPoints[i].ug / carbNorm) * carbBandMaxH;
                graphCtx.lineTo(carbVisPoints[i].x, carbCenterY - h);
            }
            graphCtx.lineTo(carbVisPoints[carbVisPoints.length - 1].x, carbCenterY);
            graphCtx.closePath();
            graphCtx.fillStyle = 'rgba(74, 222, 128, 0.50)';    // green (--macro-carb: #4ade80)
            graphCtx.fill();
            // Border line — same colour as fill
            graphCtx.beginPath();
            for (let i = 0; i < carbVisPoints.length; i++) {
                const h = (carbVisPoints[i].ug / carbNorm) * carbBandMaxH;
                if (i === 0) graphCtx.moveTo(carbVisPoints[i].x, carbCenterY - h);
                else graphCtx.lineTo(carbVisPoints[i].x, carbCenterY - h);
            }
            graphCtx.strokeStyle = 'rgba(74, 222, 128, 0.50)';
            graphCtx.lineWidth = 1;
            graphCtx.stroke();

            // Label
            graphCtx.save();
            graphCtx.font = 'bold 12px Inter, Segoe UI, sans-serif';
            graphCtx.textAlign = 'right';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = 'rgba(74, 222, 128, 0.85)';
            graphCtx.fillText('Carbs', padding.left - 4, carbCenterY - carbBandMaxH * 0.35);
            graphCtx.restore();
        }
    }

    // --- eISF line: effective ISF over time ---
    // Shows how strongly insulin is acting right now relative to the profile ISF.
    // The profile ISF is the centre line: up = higher eISF (insulin more potent),
    // down = lower eISF (insulin less potent). The line is normalised with
    // tanh so large excursions remain on the graph and do not overlap other bands.
    // Colour: pink/magenta (clearly distinct from insulin teal and carb green).
    const isfLineVisible = showISFLine && game && physiologyDataPoints.length > 2;
    if (isfLineVisible) {
        // Place eISF in the negative space below BG=0. If the insulin band is also
        // active, eISF is shifted slightly lower and given a smaller amplitude so the
        // two physiology layers do not overlap.
        const negativeTopY = bgToY(0);
        const negativeBottomY = bgToY(yAxisMin);
        const negativeSpaceH = Math.max(1, negativeBottomY - negativeTopY);
        const isfCenterY = negativeTopY + negativeSpaceH * (showInsulinBand ? 0.68 : 0.50);
        const isfBandMaxH = Math.max(6, Math.min(22 * bandScale,
            negativeSpaceH * (showInsulinBand ? 0.22 : 0.38)));

        const baseISF = game.ISF || 2.0;

        // Collect visible data points
        const isfVisPoints = [];
        for (let i = 0; i < physiologyDataPoints.length; i++) {
            const p = physiologyDataPoints[i];
            if (p.time < currentDayStartMinutes || p.time >= currentDayStartMinutes + totalMinutesInView) continue;
            const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            // Normalised eISF: 1.0 = profile ISF, >1 = insulin more potent,
            // <1 = insulin less potent.
            const eISFRatio = (p.currentISF || baseISF) / baseISF;
            isfVisPoints.push({ x, eISFRatio });
        }
        // Extend to graph edges (avoid discontinuities at day boundaries).
        // Right boundary is nowX — the line is NOT drawn into the future.
        if (isfVisPoints.length >= 1) {
            if (isfVisPoints[0].x > padding.left + 2) {
                isfVisPoints.unshift({ ...isfVisPoints[0], x: padding.left });
            }
            if (isfVisPoints[isfVisPoints.length - 1].x < nowX - 2) {
                isfVisPoints.push({ ...isfVisPoints[isfVisPoints.length - 1], x: nowX });
            }
        }

        if (isfVisPoints.length >= 2) {
            // Centre line: profile ISF.
            graphCtx.save();
            graphCtx.setLineDash([4, 4]);
            graphCtx.strokeStyle = 'rgba(244, 114, 182, 0.30)';
            graphCtx.lineWidth = 1;
            graphCtx.beginPath();
            graphCtx.moveTo(padding.left, isfCenterY);
            graphCtx.lineTo(padding.left + graphWidth, isfCenterY);
            graphCtx.stroke();
            graphCtx.restore();

            // Filled area: up = insulin more potent, down = insulin less potent.
            // tanh mapping keeps extreme values within the reserved band.
            const isfScale = 1.35; // sensitivity around the profile ISF
            graphCtx.beginPath();
            graphCtx.moveTo(isfVisPoints[0].x, isfCenterY);
            for (let i = 0; i < isfVisPoints.length; i++) {
                const deviation = isfVisPoints[i].eISFRatio - 1.0;
                const h = isfBandMaxH * Math.tanh(deviation * isfScale);
                graphCtx.lineTo(isfVisPoints[i].x, isfCenterY - h);
            }
            graphCtx.lineTo(isfVisPoints[isfVisPoints.length - 1].x, isfCenterY);
            graphCtx.closePath();
            graphCtx.fillStyle = 'rgba(244, 114, 182, 0.35)';
            graphCtx.fill();

            // Border line
            graphCtx.beginPath();
            for (let i = 0; i < isfVisPoints.length; i++) {
                const deviation = isfVisPoints[i].eISFRatio - 1.0;
                const h = isfBandMaxH * Math.tanh(deviation * isfScale);
                if (i === 0) graphCtx.moveTo(isfVisPoints[i].x, isfCenterY - h);
                else graphCtx.lineTo(isfVisPoints[i].x, isfCenterY - h);
            }
            graphCtx.strokeStyle = 'rgba(244, 114, 182, 0.50)';
            graphCtx.lineWidth = 1;
            graphCtx.stroke();

            // Label
            graphCtx.save();
            graphCtx.font = 'bold 12px Inter, Segoe UI, sans-serif';
            graphCtx.textAlign = 'right';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = 'rgba(244, 114, 182, 0.85)';
            graphCtx.fillText('eISF', padding.left - 4, isfCenterY - isfBandMaxH * 0.45);
            graphCtx.restore();
        }
    }

    // --- Ketone line (BHB) in the negative space, below the other physiology layers ---
    // Shows ketone concentration over time (beta-hydroxybutyrate). Drawn as a short
    // line near the bottom of the negative space so it does NOT displace other bands
    // (it is therefore not included in bandCount/downwardBands). The renal threshold
    // (0.5 mmol/L) is marked with a dashed reference line. Shared by game + editor
    // (same field in physiologyDataPoints from the engine's onSample). Colour: violet —
    // distinct from insulin teal, carb green, and eISF pink.
    const ketoLineVisible = showKetoneLine && game && physiologyDataPoints.length > 2;
    if (ketoLineVisible) {
        const negTopY = bgToY(0);
        const negBotY = bgToY(yAxisMin);
        const negH = Math.max(1, negBotY - negTopY);
        const ketoBaseY = negTopY + negH * 0.94;            // baseline near the bottom
        const ketoMaxH = Math.max(6, Math.min(18 * bandScale, negH * 0.34));
        const KETO_FULL = 3.0;                              // mmol/L → full band height
        const violet = '167, 139, 250';                     // #a78bfa
        const hOf = k => ketoMaxH * Math.min(1, Math.max(0, k) / KETO_FULL);

        const kPts = [];
        for (let i = 0; i < physiologyDataPoints.length; i++) {
            const p = physiologyDataPoints[i];
            if (p.time < currentDayStartMinutes || p.time >= currentDayStartMinutes + totalMinutesInView) continue;
            const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            kPts.push({ x, k: p.ketoneLevel || 0 });
        }
        // Extend to edges (not into the future — right boundary is nowX).
        if (kPts.length >= 1) {
            if (kPts[0].x > padding.left + 2) kPts.unshift({ ...kPts[0], x: padding.left });
            if (kPts[kPts.length - 1].x < nowX - 2) kPts.push({ ...kPts[kPts.length - 1], x: nowX });
        }
        if (kPts.length >= 2) {
            // Filled area upward from baseline.
            graphCtx.beginPath();
            graphCtx.moveTo(kPts[0].x, ketoBaseY);
            for (let i = 0; i < kPts.length; i++) graphCtx.lineTo(kPts[i].x, ketoBaseY - hOf(kPts[i].k));
            graphCtx.lineTo(kPts[kPts.length - 1].x, ketoBaseY);
            graphCtx.closePath();
            graphCtx.fillStyle = 'rgba(' + violet + ', 0.28)';
            graphCtx.fill();
            // Border line.
            graphCtx.beginPath();
            for (let i = 0; i < kPts.length; i++) {
                const y = ketoBaseY - hOf(kPts[i].k);
                if (i === 0) graphCtx.moveTo(kPts[i].x, y); else graphCtx.lineTo(kPts[i].x, y);
            }
            graphCtx.strokeStyle = 'rgba(' + violet + ', 0.6)';
            graphCtx.lineWidth = 1;
            graphCtx.stroke();
            // Renal threshold reference (0.5 mmol/L) — above this level ketones spill into urine.
            const threshY = ketoBaseY - hOf(0.5);
            graphCtx.save();
            graphCtx.setLineDash([3, 3]);
            graphCtx.strokeStyle = 'rgba(' + violet + ', 0.30)';
            graphCtx.beginPath();
            graphCtx.moveTo(padding.left, threshY);
            graphCtx.lineTo(padding.left + graphWidth, threshY);
            graphCtx.stroke();
            graphCtx.restore();
            // Label.
            graphCtx.save();
            graphCtx.font = 'bold 12px Inter, Segoe UI, sans-serif';
            graphCtx.textAlign = 'right';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = 'rgba(' + violet + ', 0.85)';
            graphCtx.fillText((typeof appSettings !== 'undefined' && appSettings.language === 'en') ? 'Ketone' : 'Keton',
                padding.left - 4, ketoBaseY - ketoMaxH * 0.5);
            graphCtx.restore();
        }
    }

    // --- Activity band: coloured band at the bottom of the graph for active/completed activities ---
    // Draws semi-transparent coloured bands showing when activities took place.
    // Colour depends on activity type (green=cardio, red=strength, orange=mixed, purple=relaxation).
    const activityBandHeight = Math.max(4, 10 * bandScale); // scaled, minimum 4px
    // Activity band is placed at a fixed offset from the graph bottom — independent of
    // y-axis scaling and physiology bands. The bar sits just above the x-axis labels.
    const activityBandY = padding.top + graphHeight - activityBandHeight - 2;
    // Activity bands are NO LONGER drawn at the bottom of the graph.
    // The duration bar has moved to the exercise icon (see event icon section below).
    // activityBandY and activityBandHeight are retained — used for icon baseline calculations.

    // --- Event icons along the bottom of the graph ---
    // Food (emoji), insulin (syringe/pen), and exercise icons are drawn at
    // the x-position corresponding to their timestamp, near the bottom of the chart.
    // Defensive reset of ALL canvas state — ensures no leakage
    // from physiology bands, night shading, symptom overlays, or activity bands
    // affects icon rendering. Covers: opacity, compositing, shadows, lines.
    graphCtx.globalAlpha = 1.0;
    graphCtx.globalCompositeOperation = 'source-over';
    graphCtx.shadowBlur = 0;
    graphCtx.shadowColor = 'transparent';
    graphCtx.setLineDash([]);
    graphCtx.fillStyle = '#ffffff';  // Fully opaque fillStyle — Windows emoji rendering
    // uses fillStyle alpha, so a low-alpha fillStyle from the activity band
    // would make emojis semi-transparent.

    // --- Glow Ring Timer ---
    // Draws a thin glowing ring around the most recent event icon of each type.
    // The ring represents elapsed time: full circle = just happened, empty = 60 min.
    // A glowing dot tracks the leading end of the arc. Minute count shown below the ring.
    // Colours: rapid insulin = teal (#0d9488), basal = blue (#2563eb),
    //          food = warm gold (#e8c87a) — distinct from carb/protein/fat colours.

    // Find the latest event time for each type (for glow-ring display)
    const _latestEventTime = { food: -Infinity, 'insulin-fast': -Infinity, 'insulin-basal': -Infinity };
    game.logHistory.forEach(ev => {
        if (ev.type === 'food' && ev.time > _latestEventTime.food) _latestEventTime.food = ev.time;
        else if (ev.type === 'insulin-basal' && ev.time > _latestEventTime['insulin-basal']) _latestEventTime['insulin-basal'] = ev.time;
        else if (ev.type === 'insulin-fast' && ev.time > _latestEventTime['insulin-fast']) _latestEventTime['insulin-fast'] = ev.time;
    });

    // Draw a glowing ring around an event icon.
    // cx/cy = ring centre (= icon centre), minutesSince = minutes since the event,
    // color = ring colour, fadeMinutes = total duration before the ring disappears.
    // The ring fills clockwise: full circle at 0 min → empty at fadeMinutes.
    function _drawGlowRing(cx, cy, minutesSince, color, fadeMinutes) {
        if (minutesSince < 0 || minutesSince > fadeMinutes) return;
        const RING_RADIUS = 14;
        const RING_WIDTH = 2.5;
        const DOT_RADIUS = 3;

        // Overall alpha: fades out over the last 20% of the period
        const fadeStart = fadeMinutes * 0.8;
        const alpha = minutesSince > fadeStart
            ? 1.0 - (minutesSince - fadeStart) / (fadeMinutes - fadeStart)
            : 1.0;
        graphCtx.globalAlpha = alpha;

        // 1) Background ring (dim circle)
        graphCtx.beginPath();
        graphCtx.arc(cx, cy, RING_RADIUS, 0, Math.PI * 2);
        graphCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        graphCtx.lineWidth = RING_WIDTH;
        graphCtx.stroke();

        // 2) Progress arc: fills clockwise from 12 o'clock (0 min → empty, fadeMinutes → full)
        const progress = minutesSince / fadeMinutes; // 0 = tom, 1 = fuld
        if (progress > 0.005) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + progress * Math.PI * 2;
            graphCtx.beginPath();
            graphCtx.arc(cx, cy, RING_RADIUS, startAngle, endAngle, false);
            graphCtx.strokeStyle = color;
            graphCtx.lineWidth = RING_WIDTH;
            graphCtx.lineCap = 'round';
            graphCtx.stroke();
            graphCtx.lineCap = 'butt'; // reset

            // 3) Glowing dot at the arc head (leading end of progress)
            const dotX = cx + RING_RADIUS * Math.cos(endAngle);
            const dotY = cy + RING_RADIUS * Math.sin(endAngle);
            graphCtx.shadowBlur = 6;
            graphCtx.shadowColor = color;
            graphCtx.beginPath();
            graphCtx.arc(dotX, dotY, DOT_RADIUS, 0, Math.PI * 2);
            graphCtx.fillStyle = color;
            graphCtx.fill();
            graphCtx.shadowBlur = 0;
            graphCtx.shadowColor = 'transparent';
        }

        // Reset alpha
        graphCtx.globalAlpha = 1.0;
    }

    // --- Event icon layout: pixel-based placement above the activity band ---
    // Icons are placed using PIXEL coordinates above the activity band AND above
    // any visible physiology bands (insulin, carb, ISF). Overlapping icons
    // are stacked upward using a greedy sweep.
    //
    // When physiology bands are visible, the icon baseline is shifted above them:
    //   - Carb band grows upward from bgToY(0) with max 17*bandScale px
    //   - Insulin band grows downward from bgToY(0) with max 28*bandScale px
    //   - Activity band is at the bottom
    // Icon baseline: the HIGHEST of (activityBandY - 6) and (bandTop - margin)
    const _eventLayout = (function() {
        const ICON_HALF_W = 14;          // Half icon width (28px overlap zone)
        const SLOT_STEP = 22;            // Pixels per overlap slot upward

        // Dynamic max slots: more room when BG is high
        // The lowest BG in the visible data determines how much space is available
        let lowestVisibleBG = yAxisMax; // Start pessimistic
        cgmDataPoints.forEach(pt => {
            if (pt.x >= currentDayStartMinutes && pt.x < currentDayStartMinutes + totalMinutesInView) {
                if (pt.y < lowestVisibleBG) lowestVisibleBG = pt.y;
            }
        });
        // Icon zone top: BG 3.0 normally, BG 5.0 if the lowest data is above 8
        const iconZoneTopBG = lowestVisibleBG > 8 ? 5.0 : 3.0;
        const iconZoneTopY = bgToY(iconZoneTopBG);
        // Base: above the activity band — and above physiology bands if visible
        let baseY = activityBandY - 6;
        if (anyBandsActive) {
            // Carb band is topmost: it grows UPWARD from bgToY(0)
            // Insulin band is below bgToY(0). We need to clear them all.
            const bandZeroY = bgToY(0);
            const carbTopMargin = carbBandVisible ? (17 * bandScale) : 0;
            const bandTopY = bandZeroY - carbTopMargin; // Top of the visible band area
            baseY = Math.min(baseY, bandTopY - 10); // 10px margin above the top band
        }
        // Compute max slots from available height
        const availableHeight = baseY - iconZoneTopY;
        const MAX_SLOTS = Math.max(2, Math.min(5, Math.floor(availableHeight / SLOT_STEP)));

        // Collect visible events with their x-position
        const items = [];
        game.logHistory.forEach(ev => {
            if (ev.type === 'motion-end') return;
            if (ev.time < currentDayStartMinutes || ev.time >= currentDayStartMinutes + totalMinutesInView) return;
            if (ev._visibleAfter && performance.now() < ev._visibleAfter) return;
            const x = padding.left + ((ev.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            items.push({ event: ev, x, slot: 0 });
        });

        items.sort((a, b) => a.x - b.x);

        // Greedy sweep: assign the lowest free slot to each icon
        for (let i = 0; i < items.length; i++) {
            const occupiedSlots = [];
            for (let j = i - 1; j >= 0; j--) {
                if (items[i].x - items[j].x > ICON_HALF_W * 2) break;
                occupiedSlots.push(items[j].slot);
            }
            let slot = 0;
            while (occupiedSlots.includes(slot) && slot < MAX_SLOTS) slot++;
            items[i].slot = Math.min(slot, MAX_SLOTS - 1);
        }

        // Map<event → pixelY> — slot 0 = baseY, slot 1 = baseY - SLOT_STEP, etc.
        const layout = new Map();
        items.forEach(item => {
            layout.set(item.event, baseY - item.slot * SLOT_STEP);
        });
        return layout;
    })();

    const nowMsIcons = performance.now();
    game.logHistory.forEach(event => {
        // Hold off showing the graph icon until the fly-in animation has finished
        if (event._visibleAfter && nowMsIcons < event._visibleAfter) return;
        if (event.time >= currentDayStartMinutes && event.time < currentDayStartMinutes + totalMinutesInView) {
            const x = padding.left + ((event.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            // y-position from pixel-based layout (independent of BG axis scaling)
            let yPos = _eventLayout.get(event);
            if (yPos === undefined) yPos = activityBandY - 6; // Fallback
            // Subtle vertical guide line from the icon down to the time axis so the
            // precise event time can be read directly below the icon.
            // Only for icons that have a layout slot (skips motion-end etc.).
            if (_eventLayout.has(event)) {
                graphCtx.save();
                graphCtx.strokeStyle = 'rgba(190, 210, 235, 0.22)';
                graphCtx.lineWidth = 1;
                graphCtx.setLineDash([3, 4]);
                graphCtx.beginPath();
                graphCtx.moveTo(x, yPos);
                graphCtx.lineTo(x, padding.top + graphHeight);
                graphCtx.stroke();
                graphCtx.restore();
            }
            graphCtx.textAlign = "center";
            graphCtx.font = "16px Arial";

            if(event.type === 'ketone-test') {
                // Ketone finger prick: persistent icon on the x-axis with ketone value
                graphCtx.fillStyle = '#805ad5'; // Purple — matches the ketone button
                const ketoneImg = _getFoodIconImage('assets/icons/app/ketone-reagent.png');
                const iconSize = 26;
                if (ketoneImg.complete && ketoneImg.naturalWidth > 0) {
                    graphCtx.drawImage(ketoneImg, x - iconSize / 2, yPos - iconSize + 4, iconSize, iconSize);
                } else {
                    graphCtx.fillText('K', x, yPos);
                }
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = '#805ad5';
                const ketonVal = event.details.value || '';
                // Placér måleværdien over reagensikonet med lidt luft imellem,
                // så tallet ikke dækkes af det 26 px høje ikon.
                graphCtx.fillText(ketonVal, x, yPos - iconSize - 2);
            } else if(event.type === 'food') {
                const icon = event.details.icon || '🍲';
                const iconIsImage = typeof icon === 'string' && /\.(png|webp|svg)$/i.test(icon);
                if (iconIsImage) {
                    const foodImg = _getFoodIconImage(icon);
                    const iconSize = 36;
                    if (foodImg.complete && foodImg.naturalWidth > 0) {
                        graphCtx.drawImage(foodImg, x - iconSize / 2, yPos - iconSize + 4, iconSize, iconSize);
                    } else {
                        graphCtx.fillText('🍲', x, yPos);
                    }
                } else {
                    graphCtx.fillText(icon, x, yPos);
                }
                // For custom meals (not presets), show the actual carbohydrate
                // amount. Protein remains a separate delayed model effect and is
                // therefore not converted to a dosing-like carb equivalent.
                if (icon === '🍲') {
                    const carbs = event.details.carbs || 0;
                    graphCtx.font = "bold 11px Inter, Segoe UI";
                    graphCtx.fillStyle = 'rgba(200, 210, 230, 0.9)';
                    graphCtx.fillText(`${carbs.toFixed(0)}g`, x, yPos - 14);
                }
                // Glow ring: only on the most recent food event, warm gold (#e8c87a) —
                // distinct from carb (green), protein (blue), fat (amber)
                if (event.time === _latestEventTime.food) {
                    const minSince = game.totalSimMinutes - event.time;
                    // Emoji centre is ~7px above baseline; bitmap icons are drawn
                    // slightly higher and therefore get a separate centre.
                    _drawGlowRing(x, iconIsImage ? yPos - 9 : yPos - 7, minSince, '#e8c87a', 60);
                    graphCtx.fillStyle = '#ffffff';
                }
            } else if (event.type === 'motion') {
                const motionIcon = (event.details && event.details.icon) || event.icon || '🏃';
                const motionIconIsImage = typeof motionIcon === 'string' && /\.(png|webp|svg)$/i.test(motionIcon);
                if (motionIconIsImage) {
                    const motionImg = _getFoodIconImage(motionIcon);
                    const iconSize = 30;
                    if (motionImg.complete && motionImg.naturalWidth > 0) {
                        graphCtx.drawImage(motionImg, x - iconSize / 2, yPos - iconSize + 5, iconSize, iconSize);
                    } else {
                        graphCtx.fillText('A', x, yPos);
                    }
                } else {
                    graphCtx.fillText(motionIcon, x, yPos);
                }

                // --- Duration bar BELOW the icon ---
                // Coloured bar from the icon's x-position to the end time, just below the emoji.
                // Replaces the old bottom-of-graph band — now visually anchored to the icon.
                const typeDef = event.details && event.details.type ? AKTIVITETSTYPER[event.details.type] : null;
                const isActiveMotion = game.activeAktivitet && game.activeAktivitet.startTime === event.time;
                let durMin = null;
                let plannedDurMin = null;
                if (event.details && event.details.duration > 0) {
                    durMin = event.details.duration;
                } else if (isActiveMotion) {
                    durMin = game.totalSimMinutes - event.time;
                    if (game.activeAktivitet.varighed) {
                        plannedDurMin = game.activeAktivitet.varighed;
                    }
                }

                if (durMin !== null && durMin > 0 && typeDef) {
                    const barY = yPos + 3;   // Just below emoji baseline
                    const barH = 4;
                    const xEnd = padding.left + Math.min(1, (event.time + durMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
                    const barW = Math.max(8, xEnd - x);  // Minimum 8px width

                    graphCtx.save();
                    if (isActiveMotion) {
                        // Pulsating opacity for active activity
                        const pulse = 0.25 + 0.1 * Math.sin(performance.now() / 500);
                        graphCtx.fillStyle = typeDef.farve + Math.round(pulse * 255).toString(16).padStart(2, '0');
                    } else {
                        graphCtx.fillStyle = typeDef.farve + '50'; // Semi-transparent for completed
                    }
                    // Rounded ends on the bar
                    graphCtx.beginPath();
                    graphCtx.roundRect(x - 4, barY, barW + 4, barH, barH / 2);
                    graphCtx.fill();

                    // Top edge for visibility
                    graphCtx.fillStyle = typeDef.farve + (isActiveMotion ? '90' : '70');
                    graphCtx.beginPath();
                    graphCtx.roundRect(x - 4, barY, barW + 4, 1.5, [barH / 2, barH / 2, 0, 0]);
                    graphCtx.fill();

                    // Planned duration as a lighter shadow (only for ongoing activities)
                    if (isActiveMotion && plannedDurMin && durMin < plannedDurMin) {
                        const xPlannedEnd = padding.left + Math.min(1, (event.time + plannedDurMin - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
                        graphCtx.fillStyle = typeDef.farve + '18';
                        graphCtx.beginPath();
                        graphCtx.roundRect(xEnd, barY, Math.max(0, xPlannedEnd - xEnd), barH, [0, barH / 2, barH / 2, 0]);
                        graphCtx.fill();
                        // Dashed border at planned end
                        graphCtx.strokeStyle = typeDef.farve + '40';
                        graphCtx.setLineDash([3, 3]);
                        graphCtx.beginPath();
                        graphCtx.moveTo(xPlannedEnd, barY);
                        graphCtx.lineTo(xPlannedEnd, barY + barH);
                        graphCtx.stroke();
                        graphCtx.setLineDash([]);
                    }
                    graphCtx.restore();
                }

                // Duration label ABOVE the icon — duration in minutes/hours
                if (durMin !== null && durMin > 0) {
                    const durRound = Math.round(durMin);
                    const durLabel = durRound >= 60
                        ? Math.floor(durRound / 60) + 't' + (durRound % 60 > 0 ? (durRound % 60) + 'm' : '')
                        : durRound + 'm';
                    graphCtx.save();
                    graphCtx.font = 'bold 10px Inter, Segoe UI, sans-serif';
                    graphCtx.textAlign = 'center';
                    graphCtx.fillStyle = 'rgba(200, 210, 230, 0.9)';
                    graphCtx.fillText(durLabel, x, yPos - 14);
                    graphCtx.restore();
                }
            } else if (event.type === 'motion-end') {
                // Do NOT show a stop icon on the graph — the bar already shows the duration
            } else if(event.type === 'glucagon') {
                // Glucagon: dedicated pen icon — consistent across all platforms.
                const syrImg = _syringeIcons['red'];
                const iconSize = 28;
                if (syrImg && syrImg.complete) {
                    graphCtx.drawImage(syrImg, x - iconSize / 2, yPos - 6 - iconSize, iconSize, iconSize);
                }
                // "GLU" label ABOVE the icon (above the syringe top)
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = '#dc2626';
                graphCtx.fillText('GLU', x, yPos - 6 - iconSize - 2);
            } else if(event.type.includes('insulin')) {
                // Dedicated insulin icons instead of hue-rotated emojis.
                // Image icons are consistent across all platforms (PC, tablet, mobile).
                const isBasal = event.type === 'insulin-basal';
                const insulinColor = isBasal ? '#2563eb' : '#0d9488';
                const syringeColor = isBasal ? 'blue' : 'teal';
                const syrImg = _syringeIcons[syringeColor];
                const iconSize = isBasal ? 28 : 24;
                if (syrImg && syrImg.complete) {
                    graphCtx.drawImage(syrImg, x - iconSize / 2, yPos - 6 - iconSize, iconSize, iconSize);
                }
                // Dose label below the icon
                graphCtx.font = "bold 11px Inter, Segoe UI";
                graphCtx.fillStyle = insulinColor;
                const doseText = event.details.dose.toFixed(isBasal ? 0 : 1);
                graphCtx.fillText(doseText, x, yPos + 6);
                // Glow ring: rapid insulin only (basal has no count-up)
                if (!isBasal && event.time === _latestEventTime['insulin-fast']) {
                    const minSince = game.totalSimMinutes - event.time;
                    _drawGlowRing(x, yPos - 6 - iconSize / 2, minSince, insulinColor, 60);
                    graphCtx.fillStyle = '#ffffff';
                }
            }

            // Alarm-clock icons removed — zZz overlays are sufficient for night indication
        }
    });

    // --- Campaign timeline markers (dashed line + icon + label) ---
    // Shows when the player should act (💉, 🥣 etc.) as visual hints on the graph.
    // Supports two types:
    //   - Point marker (type: 'action'/'info'): dashed line + icon at a single time
    //   - Interval marker (type: 'interval'): coloured band between start and end
    // Both fade out after the time/interval has passed.
    if (view.isLive && typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive) {
        const markers = campaignEngine.getTimelineMarkers(game);
        markers.forEach(marker => {

            // === INTERVAL MARKER: coloured band between startMinutes and endMinutes ===
            if (marker.type === 'interval') {
                const mStart = marker.startMinutes;
                const mEnd = marker.endMinutes;
                // Skip if the interval is entirely outside the visible range
                if (mEnd < currentDayStartMinutes || mStart >= currentDayStartMinutes + totalMinutesInView) return;

                // Compute x-positions (clipped to visible range)
                const xStart = padding.left + (Math.max(mStart, currentDayStartMinutes) - currentDayStartMinutes) / totalMinutesInView * graphWidth;
                const xEnd = padding.left + (Math.min(mEnd, currentDayStartMinutes + totalMinutesInView) - currentDayStartMinutes) / totalMinutesInView * graphWidth;
                const xCenter = (xStart + xEnd) / 2;

                // Fade out: regular planned hints fade after their end time.
                // Unexpected events can be persistent so they remain as historical
                // markers after the player has discovered them.
                const timePast = game.totalSimMinutes - mEnd;
                let alpha = 1.0;
                if (timePast > 0) {
                    alpha = marker.persistAfterPast
                        ? (marker.pastAlpha ?? 0.55)
                        : Math.max(0, 1.0 - timePast / 60);
                }
                if (alpha <= 0) return;

                graphCtx.globalAlpha = alpha;

                // Semi-transparent coloured band
                const bandTop = padding.top + 30;
                const bandHeight = graphHeight - 55;
                graphCtx.fillStyle = marker.bandColor || 'rgba(59, 130, 246, 0.07)';
                graphCtx.fillRect(xStart, bandTop, xEnd - xStart, bandHeight);

                // Dashed boundary lines at start and end
                graphCtx.save();
                graphCtx.setLineDash([4, 4]);
                graphCtx.strokeStyle = marker.lineColor || 'rgba(59, 130, 246, 0.35)';
                graphCtx.lineWidth = 1.5;
                graphCtx.beginPath();
                graphCtx.moveTo(xStart, bandTop);
                graphCtx.lineTo(xStart, bandTop + bandHeight);
                graphCtx.moveTo(xEnd, bandTop);
                graphCtx.lineTo(xEnd, bandTop + bandHeight);
                graphCtx.stroke();
                graphCtx.restore();

                // Icon centred above the band
                graphCtx.textAlign = 'center';
                if (marker.icon === '💉' && marker.syringeColor && _syringeIcons[marker.syringeColor]) {
                    const syrImg = _syringeIcons[marker.syringeColor];
                    if (syrImg.complete) {
                        const iconSize = marker.syringeColor === 'blue' ? 28 : 24;
                        graphCtx.drawImage(syrImg, xCenter - iconSize / 2, padding.top + 10, iconSize, iconSize);
                    }
                } else if (typeof marker.icon === 'string' && /\.(png|webp|svg)$/i.test(marker.icon)) {
                    const markerImg = _getFoodIconImage(marker.icon);
                    const iconSize = marker.iconSize || 26;
                    if (markerImg.complete && markerImg.naturalWidth > 0) {
                        graphCtx.drawImage(markerImg, xCenter - iconSize / 2, padding.top + 8, iconSize, iconSize);
                    }
                } else {
                    graphCtx.font = `${marker.iconFontSize || 16}px Arial`;
                    graphCtx.fillText(marker.icon, xCenter, padding.top + 24);
                }

                // Label position can be overridden per marker. B10 events use
                // top position so the text does not collide with food/insulin/
                // exercise icons at the bottom of the graph.
                const labelFontSize = marker.labelFontSize || 10;
                const labelWeight = marker.labelWeight || '400';
                const labelPosition = marker.labelPosition || 'bottom';
                const labelY = labelPosition === 'top'
                    ? padding.top + (marker.labelYOffset ?? 46)
                    : labelPosition === 'middle'
                        ? bandTop + bandHeight * 0.5
                        : bgToY(marker.labelBG ?? 0.3);
                graphCtx.font = `${labelWeight} ${labelFontSize}px Inter, Segoe UI`;
                graphCtx.textBaseline = 'middle';
                graphCtx.fillStyle = marker.labelColor || 'rgba(147, 197, 253, 0.9)';
                graphCtx.fillText(t(marker.labelKey), xCenter, labelY);
                graphCtx.textBaseline = 'alphabetic';

                graphCtx.globalAlpha = 1.0;
                return;
            }

            // === POINT MARKER: dashed line + icon at a single time ===
            const markerTime = marker.timeMinutes;
            if (markerTime < currentDayStartMinutes || markerTime >= currentDayStartMinutes + totalMinutesInView) return;

            const x = padding.left + ((markerTime - currentDayStartMinutes) / totalMinutesInView) * graphWidth;

            // Fade out: regular planned hints fade after their time.
            // Persistent events remain as historical markers.
            const timePast = game.totalSimMinutes - markerTime;
            let alpha = 1.0;
            if (timePast > 0) {
                alpha = marker.persistAfterPast
                    ? (marker.pastAlpha ?? 0.8)
                    : Math.max(0, 1.0 - timePast / 30);
            }
            if (alpha <= 0) return; // Fully invisible — skip

            graphCtx.globalAlpha = alpha;

            // Dashed vertical line (blue, semi-transparent)
            graphCtx.save();
            graphCtx.setLineDash([4, 4]);
            graphCtx.strokeStyle = marker.type === 'action'
                ? 'rgba(59, 130, 246, 0.5)' : 'rgba(156, 163, 175, 0.4)';
            graphCtx.lineWidth = 1.5;
            graphCtx.beginPath();
            graphCtx.moveTo(x, padding.top + 30);
            graphCtx.lineTo(x, bgToY(0.8));
            graphCtx.stroke();
            graphCtx.restore(); // Restores solid line

            // Icon above the line — use image icons where available, emoji as fallback.
            graphCtx.textAlign = 'center';
            if (marker.icon === '💉' && marker.syringeColor && _syringeIcons[marker.syringeColor]) {
                const syrImg = _syringeIcons[marker.syringeColor];
                if (syrImg.complete) {
                    const iconSize = marker.syringeColor === 'blue' ? 28 : 24;
                    graphCtx.drawImage(syrImg, x - iconSize / 2, padding.top + 10, iconSize, iconSize);
                }
            } else if (typeof marker.icon === 'string' && /\.(png|webp|svg)$/i.test(marker.icon)) {
                const markerImg = _getFoodIconImage(marker.icon);
                const iconSize = marker.iconSize || 26;
                if (markerImg.complete && markerImg.naturalWidth > 0) {
                    graphCtx.drawImage(markerImg, x - iconSize / 2, padding.top + 8, iconSize, iconSize);
                }
            } else {
                graphCtx.font = '16px Arial';
                graphCtx.fillText(marker.icon, x, padding.top + 24);
            }

            // Label below the icon by default. Unexpected B10 events can move
            // the label up below the top icon so it does not overlap event icons.
            const pointLabelFontSize = marker.labelFontSize || 10;
            const pointLabelWeight = marker.labelWeight || '400';
            const pointLabelPosition = marker.labelPosition || 'bottom';
            const pointLabelY = pointLabelPosition === 'top'
                ? padding.top + (marker.labelYOffset ?? 46)
                : bgToY(marker.labelBG ?? 0.3);
            graphCtx.font = `${pointLabelWeight} ${pointLabelFontSize}px Inter, Segoe UI`;
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = marker.labelColor || (marker.type === 'action'
                ? 'rgba(147, 197, 253, 0.9)' : 'rgba(209, 213, 219, 0.7)');
            graphCtx.fillText(t(marker.labelKey), x, pointLabelY);
            graphCtx.textBaseline = 'alphabetic';

            graphCtx.globalAlpha = 1.0;
        });
    }

    // --- Current time marker ---
    // Two mint-green triangles (matching the target zone colour) point inward from
    // the top and bottom graph edges. Between the tips: a soft vertical glow line
    // in the same style as the graph's horizontal boundary lines (fade gradient, low alpha).
    if (isCurrentDay) {
        graphCtx.save();
        const triH = 10;
        const triW = 8;
        const mr = 134, mg = 239, mb = 172; // mint — target zone colour
        const triAlpha = 0.45;

        // Top triangle: points DOWN
        graphCtx.beginPath();
        graphCtx.moveTo(nowX - triW, padding.top);
        graphCtx.lineTo(nowX + triW, padding.top);
        graphCtx.lineTo(nowX, padding.top + triH);
        graphCtx.closePath();
        graphCtx.fillStyle = `rgba(${mr}, ${mg}, ${mb}, ${triAlpha})`;
        graphCtx.fill();

        // Bottom triangle: points UP
        graphCtx.beginPath();
        graphCtx.moveTo(nowX - triW, padding.top + graphHeight);
        graphCtx.lineTo(nowX + triW, padding.top + graphHeight);
        graphCtx.lineTo(nowX, padding.top + graphHeight - triH);
        graphCtx.closePath();
        graphCtx.fillStyle = `rgba(${mr}, ${mg}, ${mb}, ${triAlpha})`;
        graphCtx.fill();

        // Soft glow line between the triangle tips (vertical fade gradient)
        const lineAlpha = 0.16;
        const lineGrad = graphCtx.createLinearGradient(
            0, padding.top + triH, 0, padding.top + graphHeight - triH
        );
        lineGrad.addColorStop(0, `rgba(${mr}, ${mg}, ${mb}, 0)`);
        lineGrad.addColorStop(0.12, `rgba(${mr}, ${mg}, ${mb}, ${lineAlpha})`);
        lineGrad.addColorStop(0.50, `rgba(${mr}, ${mg}, ${mb}, ${lineAlpha})`);
        lineGrad.addColorStop(0.88, `rgba(${mr}, ${mg}, ${mb}, ${lineAlpha})`);
        lineGrad.addColorStop(1, `rgba(${mr}, ${mg}, ${mb}, 0)`);
        graphCtx.strokeStyle = lineGrad;
        graphCtx.lineWidth = 2;
        graphCtx.beginPath();
        graphCtx.moveTo(nowX, padding.top + triH);
        graphCtx.lineTo(nowX, padding.top + graphHeight - triH);
        graphCtx.stroke();

        graphCtx.restore();
    }

    // --- Temporary graph messages (reminders, warnings) ---
    // Two categories:
    //   1) Tips (isGameTip || isTutorialTip): top-left, sorted by priority
    //      (lowest = most important), max 3 at once. Animated: new ones slide in
    //      from the top, existing ones smoothly shift to new positions, expired ones fade out.
    //   2) Standard reminders (non-tip system messages): centred with
    //      pulsating yellow glow — preserves the existing visual style.
    // zZzz messages are skipped entirely (sleep bubbles in drawSymptomOverlay show night).

    // Animation constants for tip transitions
    const TIP_ENTER_MS = 2000;      // Slide-in duration (slow, calm)
    const TIP_ENTER_PX = 50;        // Slide-in distance from the top
    const TIP_FADE_OUT_MS = 2000;   // Fade-out duration (matches simulator.js)
    const TIP_Y_LERP = 0.04;        // Per-frame lerp factor for position shift (slow)
    const tipNowMs = performance.now();

    // Collect + sort tips (including fading-out tips that still need to be rendered)
    // resetGame() redraws the empty graph after setting game = null. Keep the
    // canvas renderer total in that state, so DOM guide links can be cleaned up.
    const graphMessages = (game && Array.isArray(game.graphMessages))
        ? game.graphMessages
        : [];
    const tipMessages = graphMessages
        .filter(m => (m.isGameTip || m.isTutorialTip) && !m.text.startsWith("zZzz") && isGraphTipMessageEnabled(m))
        .sort((a, b) => {
            // Fading tips sorted last (they slide out at the bottom)
            if (a._fadingOut !== b._fadingOut) return a._fadingOut ? 1 : -1;
            const pa = (a.priority != null) ? a.priority : 5;
            const pb = (b.priority != null) ? b.priority : 5;
            if (pa !== pb) return pa - pb;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

    // Active (non-fading) tips: max 3
    const activeTips = tipMessages.filter(m => !m._fadingOut).slice(0, 3);
    // Fading tips: render these too (they fade out gradually)
    const fadingTips = tipMessages.filter(m => m._fadingOut);

    const tipSlotOpacity = [1.0, 0.75, 0.50];

    // Render function for a single tip box
    function _renderTipBox(msg, yPos, opacity) {
        const xLeft = padding.left + 15;
        const isTutorial = !!msg.isTutorialTip;
        const isEventTip = !!msg.isEventTip;
        const tipColor = isEventTip
            ? { r: 251, g: 191, b: 36 }
            : isTutorial
            ? { r: 96, g: 165, b: 250 }
            : { r: 52, g: 211, b: 153 };

        graphCtx.font = "bold 13px Inter, Segoe UI";
        graphCtx.textAlign = "left";

        // Multiline support: split on \n if the text contains line breaks
        const lines = msg.text.split('\n');
        const lineHeight = 18;
        const maxLineWidth = Math.max(...lines.map(l => graphCtx.measureText(l).width));

        const iconSpace = 24;
        const boxW = maxLineWidth + iconSpace + 22;
        const boxX = xLeft;
        const boxH = lines.length === 1 ? 34 : 16 + lines.length * lineHeight;
        const boxY = yPos - boxH / 2;
        const radius = 12;

        if (msg.guideSection && opacity > 0.35 && !msg._fadingOut) {
            msg._guideLinkRect = {
                x: boxX + boxW + 8,
                y: boxY + boxH / 2 - 13,
                section: msg.guideSection,
            };
        } else {
            delete msg._guideLinkRect;
        }

        graphCtx.save();
        graphCtx.shadowColor = `rgba(${tipColor.r}, ${tipColor.g}, ${tipColor.b}, ${0.20 * opacity})`;
        graphCtx.shadowBlur = 10;
        graphCtx.shadowOffsetX = 0; graphCtx.shadowOffsetY = 0;
        graphCtx.beginPath();
        graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
        graphCtx.fillStyle = `rgba(21, 30, 48, ${0.92 * opacity})`;
        graphCtx.fill();
        graphCtx.restore();

        graphCtx.beginPath();
        graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
        graphCtx.strokeStyle = `rgba(${tipColor.r}, ${tipColor.g}, ${tipColor.b}, ${0.55 * opacity})`;
        graphCtx.lineWidth = 1.5;
        graphCtx.stroke();

        if (_graphTipIconImg.complete && _graphTipIconImg.naturalWidth > 0) {
            graphCtx.save();
            graphCtx.globalAlpha = opacity;
            graphCtx.drawImage(_graphTipIconImg, boxX + 6, yPos - 11, 22, 22);
            graphCtx.restore();
        }

        graphCtx.fillStyle = `rgba(${tipColor.r}, ${tipColor.g}, ${tipColor.b}, ${opacity})`;
        graphCtx.textBaseline = "middle";
        if (lines.length === 1) {
            graphCtx.fillText(msg.text, boxX + iconSpace + 8, yPos);
        } else {
            // Centre lines vertically in the box
            const textBlockTop = boxY + (boxH - lines.length * lineHeight) / 2 + lineHeight / 2;
            lines.forEach((line, i) => {
                graphCtx.fillText(line, boxX + iconSpace + 8, textBlockTop + i * lineHeight);
            });
        }
        graphCtx.textBaseline = "alphabetic";
    }

    // Render active tips with enter animation and smooth repositioning
    // Accumulate Y-offset so multiline tips do not overlap
    let tipCumulativeY = padding.top + 25;
    activeTips.forEach((msg, idx) => {
        const slotOpacity = tipSlotOpacity[idx];
        const lines = msg.text.split('\n');
        const tipHeight = lines.length === 1 ? 34 : 16 + lines.length * 18;
        const targetY = tipCumulativeY;
        tipCumulativeY += tipHeight + 6;

        // First time the tip is rendered: record enter time and start Y above the graph
        if (!msg._animEnterTime) {
            msg._animEnterTime = tipNowMs;
            msg._animY = targetY - TIP_ENTER_PX;
        }

        // Enter animation: cubic ease-out (0 → 1 over TIP_ENTER_MS)
        const enterElapsed = tipNowMs - msg._animEnterTime;
        const enterT = Math.min(1, enterElapsed / TIP_ENTER_MS);
        const enterEase = 1 - Math.pow(1 - enterT, 3);

        // Smooth Y reposition: lerp toward target (handles tips being pushed down)
        msg._animY += (targetY - msg._animY) * TIP_Y_LERP;
        // Snap to rest once within a sub-pixel of target. A plain lerp only
        // approaches the target asymptotically, so without this the tip (and the
        // DOM guide-link button positioned on top of it) keeps creeping a tiny
        // fraction of a pixel every frame forever. A perpetually moving button
        // often fails to register clicks (the element shifts between mousedown
        // and mouseup), which made the tip guide links feel broken.
        if (Math.abs(targetY - msg._animY) < 0.5) msg._animY = targetY;

        const yPos = msg._animY;
        const opacity = slotOpacity * enterEase;

        if (opacity > 0.01) _renderTipBox(msg, yPos, opacity);
    });

    // Render fading-out tips (fade in place — no movement)
    fadingTips.forEach(msg => {
        if (!msg._fadeStartTime) return;
        const fadeElapsed = tipNowMs - msg._fadeStartTime;
        const fadeDurationMs = msg._fadeDurationMs || TIP_FADE_OUT_MS;
        const fadeT = Math.min(1, fadeElapsed / fadeDurationMs);
        const fadeEase = 1 - fadeT * fadeT;

        const yPos = msg._animY || (padding.top + 25);
        const opacity = fadeEase * 0.6;

        if (opacity > 0.01) _renderTipBox(msg, yPos, opacity);
    });

    // Standard messages (non-tip, non-sleep): centred pulsating yellow style
    const standardMessages = graphMessages.filter(
        m => !(m.isGameTip || m.isTutorialTip) && !m.text.startsWith("zZzz")
    );
    standardMessages.forEach((msg, idx) => {
        const xCenter = padding.left + graphWidth / 2;
        // Stack standard messages below any tips
        const yPos = padding.top + 25 + (activeTips.length + idx) * 40;

        graphCtx.textAlign = "center";
        graphCtx.font = "bold 13px Inter, Segoe UI";
        const textWidth = graphCtx.measureText(msg.text).width;
        const boxX = xCenter - textWidth / 2 - 14;
        const boxY = yPos - 18;
        const boxW = textWidth + 28;
        const boxH = 34;
        const radius = 12;

        // Pulsating glow: sine wave varying glow intensity
        const pulsePhase = Math.sin(game.totalSimMinutes * 0.8) * 0.5 + 0.5;
        const glowAlpha = 0.15 + pulsePhase * 0.25;
        const glowSpread = 8 + pulsePhase * 12;

        graphCtx.save();
        graphCtx.shadowColor = `rgba(251, 191, 36, ${glowAlpha})`;
        graphCtx.shadowBlur = glowSpread;
        graphCtx.shadowOffsetX = 0;
        graphCtx.shadowOffsetY = 0;
        graphCtx.beginPath();
        graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
        graphCtx.fillStyle = "rgba(21, 30, 48, 0.92)";
        graphCtx.fill();
        graphCtx.restore();

        const borderAlpha = 0.4 + pulsePhase * 0.3;
        graphCtx.beginPath();
        graphCtx.roundRect(boxX, boxY, boxW, boxH, radius);
        graphCtx.strokeStyle = `rgba(251, 191, 36, ${borderAlpha})`;
        graphCtx.lineWidth = 1.5;
        graphCtx.stroke();

        const textAlpha = 0.85 + pulsePhase * 0.15;
        graphCtx.fillStyle = `rgba(251, 191, 36, ${textAlpha})`;
        graphCtx.fillText(msg.text, xCenter, yPos);
    });

    renderGraphTipGuideLinks(graphMessages);

    // --- Floating labels (animated measurement results) ---
    // Rendered as DOM elements ON TOP of the canvas (z-index: 20) so they appear above
    // the CGM hero (z-index: 10) and points overlay (z-index: 10).
    // Used for finger pricks and ketone tests — game-style visual feedback.
    // Uses real time (performance.now) for smooth animation independent of sim speed.
    renderFloatingLabels(padding, graphWidth, graphHeight, range, currentDayStartMinutes, totalMinutesInView, bgToY);

    // Insights-overlay: den stiplede referencekurve, redigerbare hændelser og
    // inspektionsmarkøren tegnes oven på den fælles graf med præcis samme akser.
    // Kun Insights sætter en ikke-live graphViewOverride, så almindeligt gameplay
    // berøres ikke af denne gren.
    if (!view.isLive && typeof Editor !== 'undefined' && Editor.drawOverlay) {
        Editor.drawOverlay(graphCtx, {
            padding, graphWidth, graphHeight, bgToY, timeToX,
            startMin: currentDayStartMinutes, widthMin: totalMinutesInView, viewEndMin,
            activityBandY, bandScale, anyBandsActive, carbBandVisible,
            yAxisMin, yAxisMax
        });
    }

}

// =============================================================================
// renderGraphTipGuideLinks — DOM link buttons beside graph tips
// =============================================================================
//
// Tips are drawn on canvas, but buttons must be real DOM elements to be
// clickable and accessible. Small link buttons are therefore layered on top
// of the canvas using the hitbox coordinates computed by _renderTipBox.
// =============================================================================
// =============================================================================
// buildDoseStepper — a speed-stepper-styled fine adjuster for an insulin dose
// slider. Renders "-1 -½ [value] +½ +1" buttons (whole + half steps) that nudge
// the bound <input type=range> and re-dispatch its 'input' event, so the slider,
// its value display and the give-action all stay in sync. Reused by the game's
// insulin dock and the editor's insulin edit popups. Returns the stepper element.
// =============================================================================
function buildDoseStepper(slider, opts) {
    if (!slider) return null;
    opts = opts || {};
    const half = opts.half != null ? opts.half : (parseFloat(slider.step) || 0.5);
    const whole = opts.whole != null ? opts.whole : Math.max(half * 2, 1);
    const min = parseFloat(slider.min), max = parseFloat(slider.max);
    const unit = opts.unit || '';
    const decimals = opts.decimals != null ? opts.decimals : (half < 1 ? 1 : 0);
    const lbl = v => (v === 0.5 ? '½' : String(v));        // ½ reads cleaner than 0.5
    const fmt = v => v.toFixed(decimals) + (unit ? ' ' + unit : '');
    const wrap = document.createElement('div');
    wrap.className = 'dose-stepper';
    wrap.innerHTML =
        '<button type="button" class="ds-btn" data-d="-w">-' + lbl(whole) + '</button>' +
        '<button type="button" class="ds-btn ds-half" data-d="-h">-' + lbl(half) + '</button>' +
        '<span class="ds-val"></span>' +
        '<button type="button" class="ds-btn ds-half" data-d="+h">+' + lbl(half) + '</button>' +
        '<button type="button" class="ds-btn" data-d="+w">+' + lbl(whole) + '</button>';
    const valEl = wrap.querySelector('.ds-val');
    const sync = () => { valEl.textContent = fmt(parseFloat(slider.value) || 0); };
    const nudge = d => {
        let v = (parseFloat(slider.value) || 0) + d;
        v = Math.round(v / half) * half;                  // snap to the half-unit grid
        v = Math.max(min, Math.min(max, v));
        slider.value = v;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        sync();
    };
    wrap.querySelectorAll('.ds-btn').forEach(b => b.addEventListener('click', () => {
        const d = b.dataset.d;
        nudge(d === '-w' ? -whole : d === '-h' ? -half : d === '+h' ? half : whole);
    }));
    slider.addEventListener('input', sync);
    sync();
    return wrap;
}

function renderGraphTipGuideLinks(messages) {
    const container = document.getElementById('graph-area-container');
    if (!container) return;

    if (!Array.isArray(messages) || typeof showGuidePopup !== 'function') {
        container.querySelectorAll('.graph-tip-guide-link').forEach(button => button.remove());
        return;
    }

    const visibleMessages = messages
        .filter(message => message._guideLinkRect && !message._fadingOut && isGraphTipMessageEnabled(message))
        .slice(0, 3);
    const visibleIds = new Set(visibleMessages.map((message, index) =>
        String(message.id || `${message.createdAt || 0}_${index}`)
    ));

    container.querySelectorAll('.graph-tip-guide-link').forEach(button => {
        if (!visibleIds.has(button.dataset.guideMessageId)) button.remove();
    });

    visibleMessages.forEach((message, index) => {
        const rect = message._guideLinkRect;
        const lang = (appSettings.language === 'en') ? 'en' : 'da';
        const messageId = String(message.id || `${message.createdAt || 0}_${index}`);
        let button = Array.from(container.querySelectorAll('.graph-tip-guide-link'))
            .find(existingButton => existingButton.dataset.guideMessageId === messageId);

        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'graph-tip-guide-link';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                showGuidePopup(button.dataset.guideSection || 'overview');
            });
            container.appendChild(button);
        }

        button.dataset.guideMessageId = messageId;
        const section = rect.section || 'overview';
        const iconSrc = (typeof guideIconForSection === 'function')
            ? guideIconForSection(section)
            : '';
        if (!iconSrc) {
            button.remove();
            return;
        }
        // Only (re)build the button's contents when the target section changes,
        // NOT every frame. renderGraphTipGuideLinks runs each frame from
        // drawGraph; rewriting innerHTML every frame destroyed and recreated the
        // <img> the user clicks, so the element under the cursor changed between
        // mousedown and mouseup and the click silently failed (the link only
        // opened ~1 in 5 tries, and never stabilised since it happened every
        // frame). The click listener lives on the button itself, so reusing the
        // same <img> lets clicks register reliably.
        if (button.dataset.guideSection !== section) {
            button.dataset.guideSection = section;
            button.innerHTML = `<img src="${iconSrc}" alt="">`;
            button.title = lang === 'da' ? 'Læs mere i spilguiden' : 'Read more in the game guide';
            button.setAttribute('aria-label', button.title);
        }
        // Round to whole pixels. The underlying tip box eases toward its resting
        // spot sub-pixel by sub-pixel, so an unrounded position would rewrite
        // button.style every frame and keep the element microscopically in
        // motion — a moving target drops clicks (the button shifts between
        // mousedown and mouseup). Rounding keeps the DOM button stationary while
        // the canvas tip still animates smoothly behind it.
        button.style.left = `${Math.round(Math.min(rect.x, container.clientWidth - 30))}px`;
        button.style.top = `${Math.round(Math.max(4, rect.y))}px`;
        });
}

function isGraphTipMessageEnabled(message) {
    const id = String(message?.id || '');
    const scope = message?.tipScope || (id.includes('global_') ? 'global' : 'level');
    if (scope === 'global') return appSettings.globalTipsEnabled !== false;
    return appSettings.levelTipsEnabled !== false;
}

// =============================================================================
// renderFloatingLabels — Draw animated measurement results as DOM elements
// =============================================================================
//
// Rather than drawing on canvas (where they are obscured by the CGM hero/points overlay),
// <div> elements are created in #graph-area-container at z-index: 20.
// Each label element is reused via a _domEl reference on the label object.
// Elements are removed automatically when the animation completes.
// =============================================================================
// =============================================================================
// drawSymptomOverlay — Subtle physiological symptom texts in the graph background
// =============================================================================
//
// Draws blurred, faintly pulsating symptom texts that drift slowly across the
// graph background. Targeting peripheral awareness — the player should sense
// "something is wrong" without being bombarded with popups.
//
// Four states with progressive symptoms:
//
// 1. HYPOGLYCAEMIA (BG < 4.0):
//    3.5-4.0: autonomic (sweating, palpitations, tremor)
//    3.0-3.5: early neuroglycopenic (dizziness, difficulty concentrating)
//    2.5-3.0: moderate (confusion, blurred vision, speech disturbance)
//    < 2.5: severe (seizures, loss of consciousness) — brainEnergyDeficit takes over
//
// 2. DKA / KETONES (acidosisLoad > 0):
//    10-30%: early (thirst, fatigue, frequent urination)
//    30-60%: moderate (nausea, abdominal pain, acetone odour)
//    60-100%: severe (vomiting, Kussmaul breathing, confusion)
//
// 3. HYPERGLYCAEMIA (BG > 14.0):
//    14-18: mild (thirst, frequent urination)
//    18-22: moderate (fatigue, blurred vision)
//    > 22: severe (dry mouth, nausea)
//
// 4. HUNGER (weight loss from caloric deficit):
//    -0.5 kg: hunger (subtle)
//    -1.0 kg: weakness
//    -1.5 kg: irritability
//    -2.0 kg: headache
//    Daytime only (07:00-22:00)
//
// Each symptom has:
//   - A unique phase offset (so they do not overlap)
//   - Slow horizontal drift (sine wave)
//   - Faint vertical drift
//   - Pulsating opacity (breathing rhythm)
//   - Large font with blur effect (CSS filter simulated via globalAlpha)
//
// Symptoms are shown ONLY within the chart area (clipped by the roundRect clip).
// =============================================================================
function drawSymptomOverlay(ctx, padding, graphWidth, graphHeight) {
    if (!game) return;

    const animTime = performance.now() / 1000; // Seconds (real time for smooth animation)

    // Fælles resolver holder tærskler, overlap og intensitet ens på desktop,
    // mobil, lyd og tips. UI-laget oversætter kun textKey til det valgte sprog.
    const symptomState = resolveSymptomState(game);
    const symptoms = symptomState.symptoms.map(symptom => ({
        text: t(symptom.textKey),
        intensity: symptom.intensity,
        phase: symptom.phase,
        color: symptom.color,
    }));

    // --- Night detection: show sleep texts at night (22:00-07:00) ---
    const simHour = Math.floor(game.timeInMinutes / 60);
    const isNight = (simHour >= 22 || simHour < 7);

    // Compute total symptom intensity (used to fade sleep texts out)
    const totalSymptomIntensity = symptoms.reduce((sum, s) => sum + s.intensity, 0);
    const symptomFade = Math.min(1.0, totalSymptomIntensity * 0.5); // 0=no symptoms, 1=fully suppressed

    // Night-sleep overlay: zzZzz rise from trueBG like cartoon sleep bubbles.
    //
    // Spawned small and sharp near the trueBG position, they rise upward and become
    // progressively larger and more diffuse (blur). Cartoon perspective.
    //
    // On a nocturnal intervention: all bubbles pop (scale up + fade out),
    // then gradually fade back in over ~5 real-time seconds.
    //
    // The anchor position uses a smoothed trueBG (exponential moving average)
    // to avoid jumping from CGM noise.
    //
    // IMPORTANT: Pop and recovery use REAL TIME (performance.now), NOT sim time,
    // so animations are visible at any simulation speed (even at 720×).
    // The "fill from bottom" gate ensures bubbles are spawned from the bottom
    // and gradually fill upward — not pre-distributed across the whole screen.
    if (isNight && symptomFade < 0.95) {
        // Smoke-like funnel from trueBG: many short particles, light blue
        const sleepTexts = [
            { text: 'z',    phase: 0.0 },
            { text: 'zZ',   phase: 1.0 },
            { text: 'z',    phase: 2.0 },
            { text: 'Zz',   phase: 3.0 },
            { text: 'z',    phase: 4.0 },
            { text: 'zZz',  phase: 5.0 },
            { text: 'z',    phase: 6.0 },
            { text: 'Zz',   phase: 7.0 },
            { text: 'z',    phase: 8.0 },
            { text: 'zZ',   phase: 9.0 },
        ];
        const sleepColor = [200, 225, 255];  // Light blue-white for good visibility against the darker night overlay

        // --- Smoothed anchor position (avoids jumps from CGM noise) ---
        if (typeof drawSymptomOverlay._smoothBG === 'undefined') drawSymptomOverlay._smoothBG = game.trueBG;
        drawSymptomOverlay._smoothBG += (game.trueBG - drawSymptomOverlay._smoothBG) * 0.05;
        const anchorBG = drawSymptomOverlay._smoothBG;

        const totalMinutesInView = 24 * 60;
        const anchorX = padding.left + (game.timeInMinutes / totalMinutesInView) * graphWidth;
        const anchorY = padding.top + graphHeight - ((anchorBG - (drawSymptomOverlay._yAxisMin || 0)) / (drawSymptomOverlay._range || 16)) * graphHeight;

        // --- Real-time tracking for pop and "fill from bottom" ---
        const nowReal = performance.now();

        // Detect night-start transition (first frame of a new night)
        if (!drawSymptomOverlay._wasNight) {
            const SNORE_STARTUP_DELAY = 1500; // 1.5 sek ved spilstart/nat-overgang
            drawSymptomOverlay._nightStartReal = nowReal + SNORE_STARTUP_DELAY;
        }
        drawSymptomOverlay._wasNight = true;

        // --- Pop og recovery ---
        const popRealTime = drawSymptomOverlay._popRealTime || 0;
        const realSecSincePop = (nowReal - popRealTime) / 1000;
        const POP_DURATION = 0.5;

        const isPopping = popRealTime > 0 && realSecSincePop < POP_DURATION;
        const popProgress = isPopping ? 1.0 - (realSecSincePop / POP_DURATION) : 0;

        // Motorens fælles tilstand afgør, om karakteren er vågen. Dermed bruger
        // bobler, portræt, søvntab og nattebaggrund præcis samme grænse.
        const BUBBLE_DELAY_MS = 1000;
        const isAwake = typeof game.isNightAwake === 'function'
            ? game.isNightAwake()
            : false;

        // recoveryFactor: 0 = awake → bubbles gone, 1 = asleep again
        const FADE_IN_DURATION = 5.0;
        let recoveryFactor;
        if (isAwake) {
            recoveryFactor = 0;
            drawSymptomOverlay._sleepResumedReal = null;
        } else if (popRealTime > 0) {
            if (!drawSymptomOverlay._sleepResumedReal) {
                drawSymptomOverlay._sleepResumedReal = nowReal;
                if (typeof playSound === 'function') playSound('sleepStart');
            }
            const realSecSinceResume = (nowReal - drawSymptomOverlay._sleepResumedReal) / 1000 - (BUBBLE_DELAY_MS / 1000);
            recoveryFactor = Math.min(1.0, Math.max(0, realSecSinceResume) / FADE_IN_DURATION);
        } else {
            recoveryFactor = 1.0;
        }

        // --- "Fill from bottom" gate ---
        const nightStartReal = drawSymptomOverlay._nightStartReal || 0;
        const fillSource = Math.max(nightStartReal, drawSymptomOverlay._sleepResumedReal || 0) + BUBBLE_DELAY_MS;
        const realSecSinceFill = (nowReal - fillSource) / 1000;
        const FILL_TIME = 4.0;
        const maxAllowedFrac = Math.min(1.0, realSecSinceFill / FILL_TIME);

        const sleepBaseAlpha = 0.55 * (1.0 - symptomFade) * recoveryFactor;

        // Exclusion zone for the points panel REMOVED:
        // pointsOverlay is now in #capsule-bar (below the graph), not as an overlay
        // on the graph. The old exclusion zone incorrectly blocked all bubbles
        // in the right side of the graph (22:00-24:00) because the panel sits bottom-right.

        if (sleepBaseAlpha > 0.01 || isPopping) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(padding.left, padding.top, graphWidth, graphHeight);
            ctx.clip();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            sleepTexts.forEach((sl) => {
                const phaseT = animTime + sl.phase * 10;
                const cycleTime = 25;
                const frac = ((animTime + sl.phase * cycleTime / sleepTexts.length) % cycleTime) / cycleTime;

                if (frac > maxAllowedFrac && !isPopping) return;

                // Smoke-like funnel: starts narrow at trueBG, spreads upward
                // Wind blows toward the graph centre (so bubbles are not clipped at edges)
                // Stronger drift when the anchor is near the edge (e.g. 22:00-24:00)
                const graphCenter = padding.left + graphWidth / 2;
                const windDir = anchorX > graphCenter ? -1 : 1;
                const distFromCenter = Math.abs(anchorX - graphCenter) / (graphWidth / 2);
                const windStrength = 65 + distFromCenter * 100;
                const windDrift = windDir * frac * frac * windStrength;
                const wobble = Math.sin(phaseT * 0.3 + sl.phase * 2.5) * (3 + frac * 15);
                const x = anchorX + windDrift + wobble;
                const riseHeight = graphHeight * 0.50;
                const y = anchorY - frac * riseHeight;

                const fontSize = 12 + frac * 20;
                ctx.font = `italic bold ${fontSize.toFixed(0)}px Inter, Segoe UI`;

                const blur = 2 + frac * 22;
                const fadeIn = Math.min(1.0, frac * 4);
                const fadeOut = Math.min(1.0, (1.0 - frac) * 3);
                const breathe = 0.7 + 0.3 * Math.sin(phaseT * 0.5);

                let alpha, scale;
                if (isPopping) {
                    scale = 1.0 + popProgress * 2.0;
                    alpha = 0.30 * (1.0 - popProgress);
                } else {
                    scale = 1.0;
                    alpha = sleepBaseAlpha * fadeIn * fadeOut * breathe;
                }

                if (alpha < 0.01) return;

                ctx.save();
                if (scale !== 1.0) {
                    ctx.translate(x, y);
                    ctx.scale(scale, scale);
                    ctx.translate(-x, -y);
                }

                ctx.shadowColor = `rgba(${sleepColor[0]}, ${sleepColor[1]}, ${sleepColor[2]}, ${alpha * 0.8})`;
                ctx.shadowBlur = blur;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                const textOpacity = alpha * (0.9 - frac * 0.5);
                ctx.fillStyle = `rgba(${sleepColor[0]}, ${sleepColor[1]}, ${sleepColor[2]}, ${textOpacity})`;
                ctx.fillText(sl.text, x, y);
                ctx.restore();
            });

            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.restore();
        }
    } else {
        // Reset night tracking when it becomes day, so the next night
        // starts the bubbles fresh from the bottom.
        drawSymptomOverlay._wasNight = false;
    }

    if (symptoms.length === 0) return;

    // --- Continuous visibility per symptom (no discrete jumps) ---
    // Each symptom has its own slow sine-wave cycle controlling visibility.
    // The phase offset (s.phase) ensures symptoms are staggered in time.
    // With many symptoms, typically only 2-3 are visible simultaneously
    // because the sine waves are offset → natural "rotation" without jumps.

    // --- Draw symptoms as drifting, blurred texts ---
    ctx.save();

    // Clip to the chart area so symptoms do not leak out
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, graphWidth, graphHeight);
    ctx.clip();

    ctx.font = 'bold 24px Inter, Segoe UI';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    symptoms.forEach((s, i) => {
        // Use phase offset to distribute symptoms in time and space
        const phaseT = animTime + s.phase * 10; // Phase offset in seconds

        // Visibility cycle: slow sine wave (~18 sec period per symptom).
        // Each symptom fades smoothly in and out. Phase offset ensures staggering.
        const visWave = 0.5 + 0.5 * Math.sin(phaseT * 0.35);
        // Only visible when the wave exceeds 0.3 → ~60% of the time visible per symptom
        if (visWave < 0.3) return;
        // Smooth fade from 0.3→1.0 (normalised to 0→1)
        const visFade = (visWave - 0.3) / 0.7;

        // Slow horizontal drift (sine wave, ~120 sec period)
        const xDrift = Math.sin(phaseT * 0.05) * graphWidth * 0.3;
        const x = padding.left + graphWidth * 0.5 + xDrift;

        // Vertical position: uses the symptom's PHASE as a stable slot, not a
        // dynamic counter slot. Prevents symptoms from jumping position when
        // other symptoms fade in/out (the classic slot-hopping problem).
        const stableSlot = s.phase; // Unique per symptom, never changes
        const baseY = padding.top + graphHeight * (0.20 + 0.12 * (stableSlot % 6));
        const yDrift = Math.sin(phaseT * 0.035 + s.phase) * graphHeight * 0.08;
        const y = baseY + yDrift;

        // Total alpha: intensity × visibility-fade × global max
        const alpha = Math.min(0.55, s.intensity * 0.55 * visFade);

        if (alpha < 0.02) return; // Skip invisible

        // Glow via shadowBlur — brighter and less diffuse
        ctx.shadowColor = `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, ${alpha * 0.8})`;
        ctx.shadowBlur = 10 + (1 - s.intensity) * 6; // Base 10, max 16
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // The text itself — clearer (alpha × 0.9)
        ctx.fillStyle = `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, ${alpha * 0.9})`;
        ctx.fillText(s.text, x, y);
    });

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
}

// =============================================================================
// updateSymptomAudio — Sound effects tied to physiological symptoms
// =============================================================================
//
// Runs only via the game loop while the game is not paused. The mute rule
// itself lives in playSound(): peeSymptom is not a CGM sound and therefore
// follows the "Sound effects" setting.
// =============================================================================
function updateSymptomAudio() {
    if (!game || typeof playSound !== 'function') return;

    const symptomState = resolveSymptomState(game);

    // Lyden følger nu det samme deduplikerede symptom som grafens tekst. Det
    // forhindrer, at lyd og tekst bruger forskellige tærskler for vandladning.
    const urinationSymptomActive = symptomState.symptoms.some(
        symptom => symptom.concept === 'urination'
    );
    if (urinationSymptomActive) {
        playSound('peeSymptom');
    }

    const illnessAudioActive = symptomState.groups.illness.active;
    if (illnessAudioActive) {
        playSound('illnessSymptom');
    }
}

function renderFloatingLabels(padding, graphWidth, graphHeight, range, currentDayStartMinutes, totalMinutesInView, bgToY) {
    if (!game || !game.floatingLabels) return;
    const container = document.getElementById('graph-area-container');
    if (!container) return;

    const FLOAT_DURATION_MS = 3000; // 3 seconds real time
    const nowMs = performance.now();

    // Cleanup: remove labels that have expired
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
        // Only show labels from the current day
        if (lbl.time < currentDayStartMinutes || lbl.time >= currentDayStartMinutes + totalMinutesInView) {
            if (lbl._domEl) lbl._domEl.style.display = 'none';
            return;
        }

        // Compute position (same coordinate system as canvas, but in CSS pixels)
        const progress = Math.min(1, (nowMs - lbl._realCreatedAt) / FLOAT_DURATION_MS);
        const x = padding.left + ((lbl.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
        const baseY = bgToY(lbl.value);
        const yOffset = -30 - 25 * progress;
        const alpha = 1.0 - progress * 0.8;
        const y = baseY + yOffset;

        if (y < padding.top - 20 || y > padding.top + graphHeight + 20) {
            if (lbl._domEl) lbl._domEl.style.display = 'none';
            return;
        }

        // Create DOM element on first render
        if (!lbl._domEl) {
            const el = document.createElement('div');
            el.className = 'floating-label';
            el.textContent = lbl.text;
            el.style.borderColor = lbl.color;
            el.style.color = lbl.color;
            container.appendChild(el);
            lbl._domEl = el;
        }

        // Update position and opacity
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
/**
 * formatVersionDate — Short date format for compact history lines.
 */
function formatVersionDate(dateString, lang) {
    const parts = String(dateString || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dateString || '';
    const [year, month, day] = parts;
    const daMonths = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (lang === 'da') return `${day}. ${daMonths[month - 1]} ${year}`;
    return `${enMonths[month - 1]} ${day}, ${year}`;
}

/**
 * formatVersionMonth — Month label for the compact, grouped part of history.
 */
function formatVersionMonth(monthString, lang) {
    const [year, month] = String(monthString || '').split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) return monthString || '';
    const daMonths = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
    const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${lang === 'da' ? daMonths[month - 1] : enMonths[month - 1]} ${year}`;
}

/**
 * renderVersionHistory — Build the help popup's version history from js/version-data.js.
 */
function renderVersionHistory(container, versionInfo, lang) {
    if (!container) return;
    const history = Array.isArray(versionInfo.history) ? versionInfo.history : [];
    const featuresLabel = lang === 'da' ? 'Nyt:' : 'Highlights:';
    const fixesLabel = lang === 'da' ? 'Vigtige bugfixes:' : 'Key bug fixes:';
    const unavailable = lang === 'da'
        ? 'Versionshistorikken kunne ikke indlæses.'
        : 'Version history could not be loaded.';

    if (history.length === 0) {
        const version = versionInfo.version ? `v${escapeHtml(versionInfo.version)}` : unavailable;
        const date = versionInfo.date ? ` — ${escapeHtml(versionInfo.date)}` : '';
        container.innerHTML = `<p><strong style="font-size: 15px;">${version}${date}</strong></p>`;
        return;
    }

    const htmlParts = [];
    const compactLines = [];

    history.forEach((entry, index) => {
        const version = escapeHtml(entry.version || '');
        const date = escapeHtml(entry.date || '');
        const features = entry.features && Array.isArray(entry.features[lang]) ? entry.features[lang] : [];
        const fixes = entry.fixes && Array.isArray(entry.fixes[lang]) ? entry.fixes[lang] : [];
        const summary = entry.summary && entry.summary[lang] ? entry.summary[lang] : '';

        // Kun de to nyeste offentlige udgivelser vises med punktlister. Resten
        // er bevidst samlet pr. måned, så Hjælp ikke bliver en teknisk changelog.
        if (index < 2 && (features.length || fixes.length)) {
            htmlParts.push(`<p><strong style="font-size: 15px;">v${version} — ${date}</strong></p>`);
            if (features.length) {
                htmlParts.push(`<p style="font-size: 13px;"><em>${featuresLabel}</em></p>`);
                htmlParts.push(`<ul style="font-size: 13px;">${features.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
            }
            if (fixes.length) {
                htmlParts.push(`<p style="font-size: 13px;"><em>${fixesLabel}</em></p>`);
                htmlParts.push(`<ul style="font-size: 13px;">${fixes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
            }
        } else if (entry.month && summary) {
            compactLines.push(`<strong>${escapeHtml(formatVersionMonth(entry.month, lang))}</strong> — ${escapeHtml(summary)}`);
        } else if (summary) {
            compactLines.push(`<strong>v${version}</strong> (${escapeHtml(formatVersionDate(entry.date, lang))}) — ${escapeHtml(summary)}`);
        }
    });

    if (compactLines.length) {
        htmlParts.push('<hr style="margin: 10px 0; border: none; border-top: 1px solid rgba(255,255,255,0.06);">');
        htmlParts.push(`<p style="font-size: 12px; color: var(--text-muted); line-height: 1.8;">${compactLines.join('<br>')}</p>`);
    }

    container.innerHTML = htmlParts.join('');
}

// =============================================================================
// createPopup — shared scaffold for all modal popups
// =============================================================================
// Builds the standard .popup-overlay > .popup-content structure and appends it
// to <body>. Returns the two elements plus close() (removes the overlay).
// Callers fill `content` and wire their own dismiss/keyboard behaviour, which
// is intentionally varied per popup (some must not be dismissable, others close
// on backdrop click or Escape). Options:
//   overlayClass / contentClass  extra classes appended after the base class
//   maxWidth                     inline max-width on the content box
// =============================================================================
function createPopup(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay' + (options.overlayClass ? ' ' + options.overlayClass : '');
    const content = document.createElement('div');
    content.className = 'popup-content' + (options.contentClass ? ' ' + options.contentClass : '');
    if (options.maxWidth) content.style.maxWidth = options.maxWidth;
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    return { overlay, content, close };
}

function showHelpPopup() {
    if(document.querySelector('.popup-overlay')) return; // Prevent duplicate popups
    if (game && !isPaused) togglePause(); // Pause the game while reading help

    const { overlay, content } = createPopup({ contentClass: 'help-popup' });

    // Help text is fetched from <template id="help-content-template"> in index.html.
    // Template tags are invisible in the browser but readable by JavaScript.
    // Edit the text directly in index.html under the template tag.
    // Select help template based on active language
    const lang = appSettings.language || 'da';
    const template = document.getElementById(`help-content-${lang}`) || document.getElementById('help-content-da');
    content.innerHTML = template.innerHTML + `
        <div class="popup-button-row">
            <button id="help-ok-button">${t('popup.close')}</button>
        </div>
    `;

    const historyContainer = content.querySelector(`#version-history-${lang}`);
    loadVersionInfo()
        .then(versionInfo => renderVersionHistory(historyContainer, versionInfo, lang))
        .catch(() => {
            if (historyContainer) {
                historyContainer.innerHTML = lang === 'da'
                    ? '<p style="font-size: 13px;">Versionshistorikken kunne ikke indlæses.</p>'
                    : '<p style="font-size: 13px;">Version history could not be loaded.</p>';
            }
        });

    // Accordion with animation: only one <details> panel can be open at a time.
    // Uses the Web Animations API to animate height on open/close.
    const ACCORDION_MS = 500;
    const allDetails = content.querySelectorAll('details.help-section');

    function animateOpen(det) {
        det.open = true;
        const summaryH = det.querySelector('summary').offsetHeight;
        const fullH = det.scrollHeight;
        det.style.overflow = 'hidden';
        const anim = det.animate(
            [{ height: summaryH + 'px' }, { height: fullH + 'px' }],
            { duration: ACCORDION_MS, easing: 'ease-out' }
        );
        anim.onfinish = () => { det.style.overflow = ''; det.style.height = ''; };
    }

    function animateClose(det) {
        const startH = det.offsetHeight;
        const summaryH = det.querySelector('summary').offsetHeight;
        det.style.overflow = 'hidden';
        const anim = det.animate(
            [{ height: startH + 'px' }, { height: summaryH + 'px' }],
            { duration: ACCORDION_MS, easing: 'ease-out' }
        );
        anim.onfinish = () => { det.open = false; det.style.overflow = ''; det.style.height = ''; };
    }

    allDetails.forEach(det => {
        det.querySelector('summary').addEventListener('click', (e) => {
            e.preventDefault();
            if (det.open) {
                animateClose(det);
            } else {
                allDetails.forEach(other => { if (other !== det && other.open) animateClose(other); });
                animateOpen(det);
            }
        });
    });
    const closeHelp = () => {
        document.body.removeChild(overlay);
        if (game && isPaused && !game.isGameOver) togglePause();
    };
    document.getElementById('help-ok-button').addEventListener('click', closeHelp);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHelp(); });
}

/**
 * showGuidePopup — Open the lay-person-friendly game guide.
 *
 * The guide is a single scrollable document but can be opened directly at a
 * specific section from tips, level intros, or game-over popups. It uses
 * GUIDE_SECTIONS from js/guide-data.js and follows the app's current language.
 *
 * @param {string} sectionId - Optional section id, e.g. 'basal' or 'cgm'.
 */
function showGuidePopup(sectionId = 'overview') {
    if (typeof GUIDE_SECTIONS === 'undefined') return;

    // Open the guide on top of whatever popup is already showing (level intro,
    // game over, failed/complete, help). Hide that popup instead of destroying
    // it, and restore it when the guide closes — so closing the guide returns to
    // where you came from rather than a stuck, dead screen. Separately, if the
    // game was running with no blocking popup (e.g. opened from a tip icon mid
    // play), the guide pauses it and resumes it again on close.
    const underlyingPopup = document.querySelector('.popup-overlay');
    const gameWasRunning = !!(game && !game.isGameOver && !isPaused);
    if (underlyingPopup) underlyingPopup.style.display = 'none';
    if (gameWasRunning) togglePause();

    const lang = (appSettings.language === 'en') ? 'en' : 'da';
    const { overlay, content } = createPopup({ contentClass: 'guide-popup' });

    const title = lang === 'da' ? 'Spilguide' : 'Game guide';
    const subtitle = lang === 'da'
        ? 'Læs guiden samlet, eller brug links fra spillet som opslag.'
        : 'Read it as one guide, or use in-game links as quick lookup.';
    const closeLabel = t('popup.close');
    const tocLabel = lang === 'da' ? 'Afsnit' : 'Sections';
    const renderGuideKeywordText = (html) => String(html || '').replace(
        /<button class="guide-term" data-guide-term="[^"]*">([\s\S]*?)<\/button>/g,
        '<span class="guide-keyword">$1</span>'
    );

    const tocHtml = GUIDE_SECTIONS.map(section => `
        <button class="guide-toc-link" data-guide-target="${section.id}">
            <img class="guide-section-icon" src="${guideIconForSection(section.id)}" alt="">
            ${section.title[lang] || section.title.en}
        </button>
    `).join('');

    const sectionsHtml = GUIDE_SECTIONS.map(section => `
        <section class="guide-section" id="guide-section-${section.id}" data-guide-section="${section.id}">
            <h3>
                <img class="guide-section-icon" src="${guideIconForSection(section.id)}" alt="">
                ${section.title[lang] || section.title.en}
            </h3>
            <div class="guide-section-body">${renderGuideKeywordText(section.body[lang] || section.body.en)}</div>
        </section>
    `).join('');

    content.innerHTML = `
        <div class="guide-header">
            <div>
                <h2>${title}</h2>
                <p>${subtitle}</p>
            </div>
            <button class="guide-close-btn" id="guideCloseBtn" aria-label="${closeLabel}">×</button>
        </div>
        <div class="guide-layout">
            <aside class="guide-sidebar">
                <h3>${tocLabel}</h3>
                <nav class="guide-toc">${tocHtml}</nav>
            </aside>
            <div class="guide-document" id="guideDocument">${sectionsHtml}</div>
        </div>
        <div class="popup-button-container">
            <button id="guideOkButton" class="popup-btn-primary">${closeLabel}</button>
        </div>
    `;


    const guideDocument = content.querySelector('#guideDocument');

    function scrollToGuideSection(targetId, behavior = 'smooth') {
        const target = content.querySelector(`#guide-section-${targetId}`);
        if (!target || !guideDocument) return;
        // Use layout offsets (offsetTop), NOT getBoundingClientRect(): when the
        // guide is opened directly at a section, the popup is still mid entrance
        // animation (popup-pop applies a scale() transform), which scales the
        // rect-based distance and lands the scroll ~200px short (and varies frame
        // to frame, so it feels unstable). offsetTop is unaffected by transforms,
        // so the target lands correctly even during the open animation. target
        // and guideDocument share the same offsetParent (.popup-content), so the
        // difference of their offsetTops is the target's position within the
        // scroll container.
        const targetTop = target.offsetTop - guideDocument.offsetTop - 8;
        guideDocument.scrollTo({
            top: Math.max(0, targetTop),
            behavior,
        });
        content.querySelectorAll('.guide-toc-link').forEach(link => {
            link.classList.toggle('active', link.dataset.guideTarget === targetId);
        });
    }

    content.querySelectorAll('.guide-toc-link').forEach(link => {
        link.addEventListener('click', () => scrollToGuideSection(link.dataset.guideTarget));
    });

    const closeGuide = () => {
        if (overlay.parentNode) overlay.remove();
        if (underlyingPopup) underlyingPopup.style.display = '';
        if (gameWasRunning && game && isPaused && !game.isGameOver) togglePause();
    };
    content.querySelector('#guideCloseBtn').addEventListener('click', closeGuide);
    content.querySelector('#guideOkButton').addEventListener('click', closeGuide);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeGuide(); });

    requestAnimationFrame(() => scrollToGuideSection(sectionId, 'auto'));
}

// Global delegation: all guide links in dynamic HTML can open the same popup.
document.addEventListener('click', (event) => {
    const guideButton = event.target.closest('.guide-link-btn[data-guide-section]');
    if (!guideButton) return;
    event.preventDefault();
    event.stopPropagation();
    showGuidePopup(guideButton.dataset.guideSection || 'overview');
});

// Hjælp-popupen åbner velkomstskærmen, så spilleren får samme indgang til
// intro-touren som ved opstart. Det undgår et omvendt flow, hvor en direkte
// startet tour først viser velkomsten, når rundturen afsluttes.
document.addEventListener('click', (event) => {
    const welcomeButton = event.target.closest('[data-show-welcome-tour]');
    if (!welcomeButton) return;
    event.preventDefault();
    event.stopPropagation();

    const popup = welcomeButton.closest('.popup-overlay');
    if (popup) popup.remove();

    if (typeof WelcomeTour !== 'undefined' && typeof WelcomeTour.show === 'function') {
        WelcomeTour.show({ force: true });
    }
});


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
    // If a game-over popup needs to be shown, remove any existing popup first
    // (otherwise game over can never appear if a DKA warning is open)
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) {
        if (isGameOverPopup) {
            document.body.removeChild(existingPopup);
        } else {
            return; // Non-game-over popups do not stack
        }
    }

    if (shouldPause && game && !isPaused) togglePause();

    // Build popup DOM elements
    const { overlay, content } = createPopup();

    const h2 = document.createElement('h2'); h2.textContent = title;
    if (isEventPopup) h2.classList.add('event-title');   // Blue title for events
    if (isGameOverPopup) h2.classList.add('danger-title');   // Red title for game over (.danger-title → var(--red))
    const p = document.createElement('p'); p.innerHTML = message;
    content.appendChild(h2); content.appendChild(p);

    // Action button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-button-container';
    const button = document.createElement('button');
    button.textContent = isGameOverPopup ? t('popup.resetGame') : t('popup.ok');
    button.onclick = () => {
        document.body.removeChild(overlay);
        if (isGameOverPopup) resetGame();
        else if (shouldPause && game && !game.isGameOver && isPaused) togglePause();
    };
    buttonContainer.appendChild(button);
    content.appendChild(buttonContainer);

    // Play a notification sound (unless it's a game over or pure info popup)
    if (!isGameOverPopup && !isInfoPopup) playSound('intervention', 'C5');
}


// =============================================================================
// PURPOSE AND LIMITS POPUP — Shown before the first game, stored in localStorage
// =============================================================================
// Returnerer true, hvis informationen om formål og grænser allerede er bekræftet.
// Callback onAccept() is called when the user accepts.
// =============================================================================
function showDisclaimerPopup(onAccept) {
    // Already accepted → skip
    if (localStorage.getItem('disclaimerAccepted') === 'true') {
        onAccept();
        return;
    }

    const { overlay, content } = createPopup();
    content.style.maxWidth = '480px';

    // Title
    const h2 = document.createElement('h2');
    h2.textContent = t('disclaimer.title');
    content.appendChild(h2);

    // Body text
    const p = document.createElement('p');
    p.innerHTML = t('disclaimer.text');
    p.style.lineHeight = '1.6';
    content.appendChild(p);

    // Checkbox row
    const checkLabel = document.createElement('label');
    checkLabel.style.cssText = 'display:flex; align-items:center; gap:10px; margin:18px 0 8px; cursor:pointer; font-size:14px; color:var(--text-secondary);';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.cssText = 'width:18px; height:18px; cursor:pointer; accent-color:var(--blue); flex-shrink:0;';
    const labelText = document.createElement('span');
    labelText.textContent = t('disclaimer.accept');
    checkLabel.appendChild(checkbox);
    checkLabel.appendChild(labelText);
    content.appendChild(checkLabel);

    // Accept button (disabled until checkbox is ticked)
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-button-container';
    const button = document.createElement('button');
    button.textContent = '▶ Start';
    button.disabled = true;
    button.style.opacity = '0.4';
    button.style.cursor = 'not-allowed';

    checkbox.addEventListener('change', () => {
        button.disabled = !checkbox.checked;
        button.style.opacity = checkbox.checked ? '1' : '0.4';
        button.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
    });

    button.onclick = () => {
        if (!checkbox.checked) return;
        localStorage.setItem('disclaimerAccepted', 'true');
        document.body.removeChild(overlay);
        onAccept();
    };

    buttonContainer.appendChild(button);
    content.appendChild(buttonContainer);
}


// =============================================================================
// MODE SELECTION POPUP — Choose game mode (Campaign / Box Challenge)
// =============================================================================
//
// Vises efter formålsinformationen, når spilleren trykker Start. Den offentlige
// app tilbyder kampagne og Box Challenge.
// =============================================================================

// buildModeCardsHtml — render the mode-card buttons for one picker group from the
// GAME_MODES registry (game.js), filtreret efter gruppe og sorteret efter order.
// En ny offentlig tilstand kræver derfor kun én
// registry entry — no hand-written card markup here.
function buildModeCardsHtml(group) {
    return Object.keys(GAME_MODES)
        .map(key => ({ key, m: GAME_MODES[key] }))
        .filter(({ m }) => m.group === group)
        .sort((a, b) => (a.m.order || 0) - (b.m.order || 0))
        .map(({ key, m }) => `
                <button class="mode-card mode-${key}" data-mode="${key}">
                    <span class="mode-icon"><img class="mode-icon-img" src="assets/icons/app/${m.icon}" alt=""></span>
                    <span class="mode-name">${t(m.labelKey)}</span>
                    <span class="mode-desc">${t(m.descKey)}</span>
                </button>`).join('');
}

// buildCharacterPairCardsHtml — samler de seks faste karakterer i tre tydelige
// kropsgrupper. Hver gruppe indeholder de to karakterer, der deler modelprofil,
// så spilleren først aflæser Barn / Voksen / Kraftig voksen og derefter personen.
// Den valgte gruppe og karakter får hver sin markering i CSS'en.
function buildCharacterPairCardsHtml(selectedCharacterId, disabled) {
    const bodyOrder = ['child', 'adult', 'large'];

    return bodyOrder.map(bodyId => {
        const characters = CHARACTERS.filter(character => character.archetype === bodyId);
        const groupIsSelected = characters.some(character => character.id === selectedCharacterId);
        const characterButtons = characters.map(character => `
            <button type="button" class="archetype-card${character.id === selectedCharacterId ? ' selected' : ''}"
                    data-character-id="${character.id}" ${disabled ? 'disabled' : ''}>
                <img class="archetype-icon-img" src="assets/icons/app/character-${character.id}.png" alt="" onerror="this.style.display='none'">
                <span class="archetype-name">${character.name}</span>
            </button>
        `).join('');

        return `
            <section class="character-pair${groupIsSelected ? ' selected' : ''}" data-archetype-id="${bodyId}">
                <div class="character-pair-title">${t(`archetype.${bodyId}.name`)}</div>
                <div class="character-pair-choices">${characterButtons}</div>
            </section>
        `;
    }).join('');
}

function showModeSelectionPopup(onSelect, options = {}) {
    const { overlay, content } = createPopup({ contentClass: 'mode-select-popup' });

    // A4b: character and mode are picked on ONE screen. Character comes first,
    // because the player chooses whom to play before choosing which game to start.
    // The mode card is the "go" action, so the chosen character is saved when a
    // mode is clicked. The last-used character is preselected.
    let selectedCharacterId = getSavedCharacterId();

    content.innerHTML = `
        <div class="mode-character-section">
            <div class="mode-group-label">${t('profile.character')}</div>
            <div class="archetype-cards" id="modeCharacterCards"></div>
        </div>
        <div class="mode-group mode-group-play">
            <div class="mode-group-label">${t('mode.group.play')}</div>
            <div class="mode-cards">${buildModeCardsHtml('play')}</div>
        </div>
        <div class="popup-button-container"><button id="modeCloseBtn">${t('popup.close')}</button></div>
    `;

    // --- Character grid: same cards/visuals as the standalone picker ---
    const cardsContainer = content.querySelector('#modeCharacterCards');
    function renderCharacterCards() {
        cardsContainer.innerHTML = buildCharacterPairCardsHtml(selectedCharacterId, false);
        cardsContainer.querySelectorAll('.archetype-card').forEach(card => {
            card.addEventListener('click', () => {
                selectedCharacterId = card.getAttribute('data-character-id');
                renderCharacterCards();
            });
        });
    }
    renderCharacterCards();

    // Click handlers for the active cards
    content.querySelectorAll('.mode-card:not([disabled])').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            // Persistér kun karakter-id'et. startGame() opløser selv de faste
            // modelparametre fra archetypes.js umiddelbart før motorstart.
            saveCharacterSelection(selectedCharacterId);
            if (typeof updateFoodChips === 'function') updateFoodChips();
            if (typeof updateCgmCharacter === 'function') updateCgmCharacter();
            overlay.remove();
            playSound('menuOpen');

            // Every game mode passes through the same start gate. options.beforeStart
            // bruges af main.js til formålsinformationen: spilleren vælger først en
            // tilstand, og informationen vises første gang inden et spil starter.
            const continueAfterGate = () => {
                // Campaign: show level-select popup instead of starting directly
                if (mode === 'campaign') {
                    // campaignEngine is constructed at load time in campaign.js.
                    campaignEngine.showLevelSelectPopup((levelIndex) => {
                        campaignEngine.loadLevel(levelIndex);
                        onSelect('campaign');
                    });
                    return;
                }

                onSelect(mode);
            };

            if (typeof options.beforeStart === 'function') {
                options.beforeStart(mode, continueAfterGate);
            } else {
                continueAfterGate();
            }
        });
    });

    // Close button
    content.querySelector('#modeCloseBtn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

}


// =============================================================================
// BOX CHALLENGE ANIMATIONS — Life-loss and level-bonus effects
// =============================================================================

/**
 * showLifeLostAnimation — Popup: "You lost a life!" with hearts and an OK button.
 * Game is paused (already done in loseLife), popup shown, player presses OK to continue.
 */
function showLifeLostAnimation(remainingLives, reason, details) {
    // Remove any existing popup (avoid double popup on rapid hits)
    const existing = document.querySelector('.popup-overlay.life-lost-popup-overlay');
    if (existing) existing.remove();

    // Red flash background (disappears quickly behind the popup)
    const flash = document.createElement('div');
    flash.className = 'life-lost-flash';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 600);

    // Build cause/explanation/tips HTML (same format as sandbox game over)
    let detailsHTML = '';
    if (details && details.name) {
        // Cause title (e.g. "Severe Hypoglycaemia", "Diabetic Ketoacidosis")
        detailsHTML += `<div class="go-cause" style="margin-top:8px;">${details.name}</div>`;
        detailsHTML += `<p class="go-cause-detail">${details.cause}</p>`;

        // "What happened?" — explanation
        if (details.explanation) {
            detailsHTML += `
                <div class="go-section">
                    <div class="go-section-title">${t('game.over.whatHappened')}</div>
                    <p>${details.explanation}</p>
                </div>`;
        }

        // "How to avoid this" — tips
        if (details.tips && details.tips.length > 0) {
            detailsHTML += `
                <div class="go-section">
                    <div class="go-section-title">${t('game.over.howToAvoid')}</div>
                    <ul>${details.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
                </div>`;
        }
    }

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay life-lost-popup-overlay';
    const hearts = '❤️'.repeat(Math.max(0, remainingLives)) + '🖤'.repeat(Math.max(0, 3 - remainingLives));
    overlay.innerHTML = `
        <div class="popup-content life-lost-popup">
            <div class="life-lost-hearts">${hearts}</div>
            <div class="life-lost-title">${t('boxchallenge.lifeUsed')}</div>
            ${detailsHTML}
            <div class="popup-button-container">
                <button id="lifeLostOkBtn">${t('boxchallenge.continue')}</button>
            </div>
            <div class="popup-button-container">
                <button id="lifeLostQuitBtn" class="popup-btn-link" style="background:none; border:none; color:var(--text-muted); font-size:0.85em; cursor:pointer;">${t('campaign.quit')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // OK button: close popup and resume game
    document.getElementById('lifeLostOkBtn').addEventListener('click', () => {
        overlay.remove();
        if (isPaused && game && !game.isGameOver) togglePause();
    });

    // Quit button: back to start screen
    document.getElementById('lifeLostQuitBtn').addEventListener('click', () => {
        overlay.remove();
        if (typeof resetGame === 'function') resetGame();
    });
}

/**
 * runSyncedTirAnimation — Shared animation helper for level-complete popups.
 *
 * Used by both the campaign popup (levels) and the box-challenge day popup.
 * Assumes content contains the following elements (campaign-* classes):
 *   .campaign-tir-value         — TIR percentage counter
 *   .campaign-stars-inline .campaign-star  — 3 star elements
 *   .campaign-points-breakdown  — container with breakdown rows (optional)
 *   .campaign-pts-row[data-row="base"|"stars"|"total"]
 *   .campaign-pts-total .campaign-pts-value — total counter
 *
 * Animation sequence:
 *   1. Base row (Points) is visible from the start (CSS).
 *   2. TIR counts from 0 → tirTarget with a 2-phase ramp:
 *      a) Phase 1 (0 → tirTarget-20): fast constant ~12 ms/%
 *      b) Phase 2 (tirTarget-20 → tirTarget): linear decelerating ease-out
 *      Tick sound on each integer crossing (lower pitch in phase 2).
 *   3. Each time the counter crosses 70/85/95 the corresponding star pops
 *      in with a "ding" sound (synchronised with the counter).
 *   4. When the counter reaches its target: empty stars are revealed, then
 *      stars row + total row fade in, total counts up, fanfare plays.
 *   5. ESC skips the entire animation (jumps to end state).
 *
 * @param {HTMLElement} content - Popup content element with the above structure
 * @param {HTMLElement} overlay - Modal overlay (used for live-check)
 * @param {object} opts
 * @param {number} opts.tir   - TIR value (0-100, assumed float, rounded to int)
 * @param {number} opts.total - Final total (base + star bonus)
 * @param {number} opts.stars - Number of stars earned (0-3)
 */
function runSyncedTirAnimation(content, overlay, { tir, total, stars }) {
    const tirEl = content.querySelector('.campaign-tir-value');
    const totalEl = content.querySelector('.campaign-pts-total .campaign-pts-value');
    const starEls = content.querySelectorAll('.campaign-stars-inline .campaign-star');
    const breakdown = content.querySelector('.campaign-points-breakdown');
    const baseRow = content.querySelector('.campaign-pts-row[data-row="base"]');
    const starsRow = content.querySelector('.campaign-pts-row[data-row="stars"]');
    const totalRow = content.querySelector('.campaign-pts-row[data-row="total"]');
    const hasBreakdown = !!breakdown;

    // Show the breakdown container + base row immediately. Stars+total are revealed later.
    if (breakdown) breakdown.classList.add('revealed');
    if (baseRow) baseRow.classList.add('revealed');

    const timers = [];
    let cancelled = false;
    const isLive = () => !cancelled && document.body.contains(overlay);

    const tirTarget = Math.round(tir);
    const STAR_THRESHOLDS = [70, 85, 95];

    // ESC = skip animation (set end state directly)
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelled = true;
            timers.forEach(id => clearTimeout(id));
            if (tirEl) tirEl.textContent = `${tirTarget}%`;
            starEls.forEach(el => el.classList.add('revealed'));
            if (hasBreakdown) {
                if (starsRow) starsRow.classList.add('revealed');
                if (totalRow) totalRow.classList.add('revealed');
                if (totalEl) totalEl.textContent = total.toFixed(1);
            }
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // ---- Counter ramp: fast phase + linear deceleration phase ----
    // bend = the point where we switch from fast to slow.
    // For low targets (target < 20) there is no fast phase — the entire count
    // is the slow deceleration phase.
    const bend = Math.max(0, tirTarget - 20);
    const fastDur = bend > 0 ? Math.max(200, bend * 12) : 0;
    const slowDistance = tirTarget - bend;
    const slowDur = slowDistance > 0 ? Math.max(700, slowDistance * 80) : 0;

    let lastInt = 0;
    let startTs = null;

    function frame(ts) {
        if (!isLive()) return;
        if (startTs === null) startTs = ts;
        const elapsed = ts - startTs;
        let val;
        if (elapsed < fastDur) {
            // Phase 1: linear fast from 0 to bend
            val = (elapsed / fastDur) * bend;
        } else if (elapsed < fastDur + slowDur) {
            // Phase 2: ease-out (1 - (1-t)^2) → linearly decelerating speed
            const t = (elapsed - fastDur) / slowDur;
            const eased = 1 - Math.pow(1 - t, 2);
            val = bend + eased * slowDistance;
        } else {
            val = tirTarget;
        }
        const intVal = Math.min(tirTarget, Math.floor(val));
        if (tirEl) tirEl.textContent = `${intVal}%`;

        // Integer crossings since last frame: tick sound + threshold check
        while (lastInt < intVal) {
            lastInt++;
            const slow = elapsed >= fastDur;
            if (typeof playLevelTick === 'function') playLevelTick(slow);
            const idx = STAR_THRESHOLDS.indexOf(lastInt);
            if (idx >= 0 && idx < stars) {
                const starEl = starEls[idx];
                if (starEl) {
                    starEl.classList.add('revealed');
                    if (typeof playStarDing === 'function') playStarDing(idx);
                }
            }
        }

        if (intVal < tirTarget) {
            requestAnimationFrame(frame);
        } else {
            // Counter done — post-roll
            if (tirEl) tirEl.textContent = `${tirTarget}%`;
            // Reveal any unearned (empty) stars to fill the space
            starEls.forEach(el => {
                if (!el.classList.contains('revealed')) el.classList.add('revealed');
            });
            // Bonus + total rows fade in, total counts up, fanfare plays
            timers.push(setTimeout(() => {
                if (!isLive()) return;
                if (hasBreakdown) {
                    if (starsRow) starsRow.classList.add('revealed');
                    if (totalRow) totalRow.classList.add('revealed');
                }
                if (typeof playLevelFanfare === 'function') playLevelFanfare(stars);
                if (hasBreakdown && totalEl) {
                    const totalDur = 600;
                    const t0 = performance.now();
                    const totalStep = (now) => {
                        if (!isLive()) return;
                        const tt = Math.min(1, (now - t0) / totalDur);
                        const eased = 1 - Math.pow(1 - tt, 2);
                        totalEl.textContent = (total * eased).toFixed(1);
                        if (tt < 1) requestAnimationFrame(totalStep);
                        else totalEl.textContent = total.toFixed(1);
                    };
                    requestAnimationFrame(totalStep);
                }
                timers.push(setTimeout(() => {
                    document.removeEventListener('keydown', escHandler);
                }, 800));
            }, 400));
        }
    }
    requestAnimationFrame(frame);
}

/**
 * showLevelCompleteAnimation — Show "Day N complete!" with star animation.
 *
 * Pauses the game and displays:
 *   1. Title + percentage
 *   2. Stars pop in one at a time (0.8s interval)
 *   3. Each star → "+5" floater that drifts upward
 *   4. Bonus total (if > 0)
 *   5. "Next day →" button
 *
 * The game resumes when the player clicks "Next day".
 */
function showLevelCompleteAnimation(completedDay, stars, bonus, tir, dayPoints, total) {
    // Pause the game while level-complete is shown
    if (typeof togglePause === 'function' && !isPaused) togglePause();

    // Reuse the campaign popup structure to get the same layout and to call
    // the shared runSyncedTirAnimation. Differences from campaign: header says
    // "DAY N" instead of "LEVEL N", title says "Day N complete!" instead of
    // a level theme, breakdown uses "Today" instead of
    // "Base points".
    const characterHtml = (typeof getCampaignCharacterFigureHtml === 'function')
        ? getCampaignCharacterFigureHtml(
            typeof getCampaignCharacterDescriptor === 'function'
                ? getCampaignCharacterDescriptor()
                : null,
            stars > 0 ? 'celebrate' : 'concern'
        )
        : '';

    // Stars — all start invisible, revealed by animation
    const starsHtml = [1, 2, 3].map(i => {
        const earned = i <= stars;
        return `<span class="campaign-star ${earned ? 'earned' : ''}" data-idx="${i-1}">${earned ? '⭐' : '☆'}</span>`;
    }).join('');

    const { overlay, content } = createPopup();
    if (stars === 0) content.classList.add('campaign-poor-pass');

    content.innerHTML = `
        <div class="campaign-intro-header">
            ${characterHtml}
            <h2 class="campaign-day-number">${t('boxchallenge.dayLabel', {day: completedDay})}</h2>
        </div>
        <h3 class="campaign-day-title campaign-day-title-centered">${t('boxchallenge.levelComplete', {day: completedDay})}</h3>
        <div class="campaign-tir-stars">
            <span class="campaign-tir-label">TIR</span>
            <span class="campaign-tir-value" data-target="${tir.toFixed(0)}">0%</span>
            <span class="campaign-stars-inline">${starsHtml}</span>
        </div>
        <div class="campaign-points-breakdown">
            <div class="campaign-pts-row" data-row="base">
                <span class="campaign-pts-label">${t('boxchallenge.dayPoints')}</span>
                <span class="campaign-pts-value">${dayPoints.toFixed(1)}</span>
            </div>
            <div class="campaign-pts-row" data-row="stars">
                <span class="campaign-pts-label">⭐ × ${stars}</span>
                <span class="campaign-pts-value campaign-pts-bonus">+${bonus.toFixed(1)}</span>
            </div>
            <div class="campaign-pts-row campaign-pts-total" data-row="total">
                <span class="campaign-pts-label">${t('boxchallenge.total')}</span>
                <span class="campaign-pts-value" data-target="${total.toFixed(1)}">0.0</span>
            </div>
        </div>
        <div class="popup-button-row">
            <button id="boxNextDayBtn" class="popup-btn-primary">${t('boxchallenge.nextDay')}</button>
        </div>
        <div class="popup-button-container">
            <button id="boxQuitBtn" class="popup-btn-link">${t('campaign.quit')}</button>
        </div>
    `;


    // "Next day" button — generate new boxes and resume the game.
    content.querySelector('#boxNextDayBtn').addEventListener('click', () => {
        overlay.remove();
        if (game && typeof game.startNextDay === 'function') {
            game.startNextDay();
        }
        if (typeof togglePause === 'function' && isPaused) togglePause();
    });

    // "Quit" button — back to start screen
    content.querySelector('#boxQuitBtn').addEventListener('click', () => {
        overlay.remove();
        if (typeof resetGame === 'function') resetGame();
    });

    // Run the shared animation — TIR counter with synchronised star pop
    if (typeof runSyncedTirAnimation === 'function') {
        runSyncedTirAnimation(content, overlay, { tir, total, stars });
    }
}


// =============================================================================
// GAME OVER POPUP — Structured game-over screen with star animation
// =============================================================================
//
// Displayed in order:
//   1. "Game over because: [cause]"
//   2. Points with pulsating star animation
//   3. Explanation (what happened)
//   4. Tips (how to avoid it)
//   5. Reset button
//
// @param {string} cause     - Cause name (e.g. "Severe Hypoglycaemia")
// @param {object} details   - { cause, explanation, tips[] }
// @param {number} points    - Player's points
// =============================================================================
function showGameOverPopup(cause, details, points) {
    // Remove any existing popup (e.g. DKA warning)
    const existing = document.querySelector('.popup-overlay');
    if (existing) document.body.removeChild(existing);

    if (game && !isPaused) togglePause();

    // Reset visual symptom effects so the player can see the game-over popup clearly
    const vfxC = document.getElementById('game-container');
    const vfxV = document.getElementById('symptom-vignette');
    if (vfxC) vfxC.style.filter = '';
    if (vfxV) vfxV.style.opacity = '0';
    _vfxCurrentBlur = 0; _vfxCurrentSaturation = 1; _vfxCurrentVignette = 0;
    _vfxEpisodeActive = false;

    const { overlay, content } = createPopup({ contentClass: 'game-over-popup' });

    // Fetch day number from the simulator
    const dayReached = game ? game.day : 1;

    // A4: pre-fill the highscore field with the player's last-used SIGNATURE (their
    // own name), kept separately from the character — see sounds.js.
    const defaultSignature = (typeof getPlayerSignature === 'function') ? getPlayerSignature() : '';

    // A4f: identify the character that was just played (for the leaderboard tag).
    // Read from the saved profile that the start-flow character step wrote.
    const playedCharacter = (typeof getActiveCharacter === 'function')
        ? getActiveCharacter()
        : { id: 'erik', name: 'Erik' };
    const fullBodySrc = playedCharacter.fullBody && playedCharacter.fullBody.concern;
    const characterSrc = fullBodySrc || `assets/icons/app/character-${playedCharacter.id}.png`;
    const characterFormatClass = fullBodySrc ? ' is-full-body' : ' is-portrait-fallback';
    const guideSections = (typeof guideSectionsForGameOverDetails === 'function')
        ? guideSectionsForGameOverDetails(details)
        : ['overview'];
    const guideLinksHtml = (typeof renderGuideLinkRow === 'function')
        ? renderGuideLinkRow(guideSections)
        : '';

    // Build content — the selected fictional character gets the portrait panel.
    content.innerHTML = `
        <h2 class="go-title">${t('game.over.title')}</h2>
        <div class="go-cause">${cause}</div>
        <p class="go-cause-detail">${details.cause}</p>

        <div class="go-hero-grid">
            <div class="go-character-panel" aria-label="${playedCharacter.name}">
                <div class="go-character-portrait${characterFormatClass}">
                    <img class="go-character${characterFormatClass}" src="${characterSrc}" alt="${playedCharacter.name}">
                </div>
            </div>

            <div class="go-result-panel">
                <div class="go-points-container">
                    <div class="go-points-num">${points.toFixed(1)}</div>
                    <div class="go-points-label">${t('game.over.pointsLabel')}</div>
                </div>
                <div id="goSaveForm" class="go-save-form"></div>
                <div id="goSaveResult" class="go-save-result"></div>
            </div>
        </div>

        <div class="go-section">
            <div class="go-section-title">${t('game.over.whatHappened')}</div>
            <p>${details.explanation}</p>
        </div>

        <div class="go-section">
            <div class="go-section-title">${t('game.over.howToAvoid')}</div>
            <ul>${details.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
        </div>

        ${guideLinksHtml}
        <p class="go-physiology-tip">${t('game.over.physiologyTip')}</p>
        <div class="popup-button-container"><button id="gameOverCloseBtn">${t('popup.close')}</button></div>
    `;


    // A4d: the player signs the score with their OWN name here (editable field,
    // pre-filled with the last-used signature). Nothing is saved until they press
    // Save — so the signature is a deliberate choice, not a silent carry-over.
    // If physiology training mode was used this session, the score is NOT savable.
    // The "not saved" note is only shown when physiology was toggled on after start;
    // if the attempt started with physiology on, the player already saw the reason.
    const resultDiv = document.getElementById('goSaveResult');
    const saveForm = document.getElementById('goSaveForm');
    if (typeof trainingModeUsedThisSession !== 'undefined' && trainingModeUsedThisSession) {
        const startedWithPhysiology = typeof trainingModeStartedThisSession !== 'undefined'
            && trainingModeStartedThisSession;
        if (startedWithPhysiology) {
            resultDiv.hidden = true;
        } else {
            resultDiv.textContent = t('ui.physiology.scoreNotSaved');
        }
    } else {
        const gm = (typeof currentGameMode !== 'undefined') ? currentGameMode : 'sandbox';
        // Editable signature field + Save button.
        saveForm.innerHTML = `
            <label class="go-save-label" for="goSignatureInput">${t('game.over.saveLabel')}</label>
            <div class="go-save-row">
                <input type="text" id="goSignatureInput" maxlength="20" placeholder="${t('profile.name.placeholder')}" value="${escapeHtml(defaultSignature)}">
                <button id="goSaveBtn" class="go-save-btn">${t('game.over.saveBtn')}</button>
            </div>`;
        const sigInput = document.getElementById('goSignatureInput');
        const saveBtn = document.getElementById('goSaveBtn');
        const doSave = () => {
            const typed = (sigInput.value || '').trim();
            // Remember the signature for next time (even if blank → cleared).
            if (typeof setPlayerSignature === 'function') setPlayerSignature(typed);
            const finalName = typed || t('stats.player.anonymous');
            const rank = saveHighscore(finalName, points, dayReached, cause, gm, playedCharacter);
            // Lock the form so the score can only be saved once.
            sigInput.disabled = true;
            saveBtn.disabled = true;
            saveBtn.textContent = t('game.over.savedBtn');
            resultDiv.textContent = rank > 0 ? t('game.over.savedRank', { rank }) : t('game.over.saved');
        };
        saveBtn.addEventListener('click', doSave);
        sigInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    }

    // Close button: closes the popup and shows the graph with the GAME OVER banner.
    // The start button (restored to green) starts a new game.
    // Profile, Help and Highscore work normally.
    document.getElementById('gameOverCloseBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        enterGameOverView(null, cause, details.cause);
    });
}


// =============================================================================
// GAME OVER VIEW MODE — Lets the player view the graph while game over is active
// =============================================================================
//
// When the player clicks "View graph" from the game-over popup:
//   - The start button is converted to a pulsating green "Try again"
//   - A "Show result" button is added beside it
//   - Both are cleaned up on reset/new game
// =============================================================================

function enterGameOverView(popupOverlay, causeTitle, causeDetail) {
    // Restore the start button to its normal start style (green/neutral).
    // Its click handler in main.js sees game.isGameOver===true → else-branch
    // → formålsinformation → valg af tilstand → nyt spil. Ingen særlig handler nødvendig.
    // Profile, Help and Highscore work normally.
    startButton.classList.remove('game-running');
    startButton.textContent = t('ui.btn.start');
    startButton.title = t('ui.title.start');

    // Pulsating game-over cause shown on top of the graph.
    // Centred over the graph area, matches the popup's typography.
    let goBanner = document.getElementById('goGraphBanner');
    if (!goBanner) {
        goBanner = document.createElement('div');
        goBanner.id = 'goGraphBanner';
        goBanner.innerHTML = `
            <div class="go-banner-title">GAME OVER</div>
            <div class="go-banner-cause">${causeTitle}</div>
        `;
        // Place inside the graph container so it follows the graph's position
        const graphContainer = document.getElementById('graph-area-container');
        if (graphContainer) {
            graphContainer.appendChild(goBanner);
        } else {
            document.body.appendChild(goBanner);
        }
    }
}

function exitGameOverView() {
    // Remove game-over banner from the graph
    const goBanner = document.getElementById('goGraphBanner');
    if (goBanner) goBanner.remove();
}


// =============================================================================
// HIGHSCORE POPUP — Show local highscore list
// =============================================================================
//
// Shows a table with the top 10 scores from localStorage.
// Pauses the game while the popup is open (like the help popup).
// Opened via the Highscore button in the top bar.
// =============================================================================
function showHighscorePopup() {
    if (document.querySelector('.popup-overlay')) return; // Only one popup at a time
    if (game && !isPaused) togglePause();

    const { overlay, content } = createPopup({ contentClass: 'help-popup' });

    // Active tab = current gameMode, but only if that mode is a currently-enabled
    // play mode (it has a visible tab). Otherwise fall back to the first enabled
    // play mode — this keeps the default valid when a mode is hidden (e.g. the
    // sandbox is currently off, so the old 'sandbox' default would show an empty
    // table with no matching tab).
    const enabledPlayModes = Object.keys(GAME_MODES)
        .filter(key => GAME_MODES[key].group === 'play'
            && (typeof GAME_MODES[key].enabled !== 'function' || GAME_MODES[key].enabled()))
        .sort((a, b) => (GAME_MODES[a].order || 0) - (GAME_MODES[b].order || 0));
    let activeTab = (typeof currentGameMode !== 'undefined') ? currentGameMode : null;
    if (!enabledPlayModes.includes(activeTab)) activeTab = enabledPlayModes[0] || 'campaign';

    // Medal icons for top 3 instead of numbers
    const rankDisplay = (i) => {
        if (i === 0) return '<img class="hs-rank-medal" src="assets/icons/app/medal-gold.png" alt="">';
        if (i === 1) return '<img class="hs-rank-medal" src="assets/icons/app/medal-silver.png" alt="">';
        if (i === 2) return '<img class="hs-rank-medal" src="assets/icons/app/medal-bronze.png" alt="">';
        return (i + 1).toString();
    };

    // Generate table HTML for a given gameMode
    function buildTableHTML(mode) {
        // Campaign: show level grid instead of table
        if (mode === 'campaign') {
            return buildCampaignHighscoreHTML();
        }

        const scores = loadHighscores(mode);
        if (scores.length === 0) {
            return `<p style="text-align:center; color:var(--text-muted);">${t('highscore.noScores')}</p>`;
        }
        // A4f: one combined board per mode, with a character tag per row (showing
        // which fixed character was played) instead of splitting the board per
        // character. Older entries without a character show a dash.
        const charCell = (s) => s.character
            ? `<span class="hs-char-tag"><img class="hs-char-icon" src="assets/icons/app/character-${s.character.id}.png" alt="" onerror="this.style.display='none'">${escapeHtml(s.character.name)}</span>`
            : '<span class="hs-char-tag hs-char-none">—</span>';
        return `
        <table class="highscore-table">
            <thead>
                <tr>
                    <th>${t('highscore.col.rank')}</th>
                    <th>${t('highscore.col.name')}</th>
                    <th>${t('highscore.col.character')}</th>
                    <th>${t('highscore.col.points')}</th>
                    <th>${t('highscore.col.day')}</th>
                    <th>${t('highscore.col.gameOver')}</th>
                    <th>${t('highscore.col.date')}</th>
                </tr>
            </thead>
            <tbody>
                ${scores.map((s, i) => `
                <tr${i === 0 ? ' class="hs-gold"' : i === 1 ? ' class="hs-silver"' : i === 2 ? ' class="hs-bronze"' : ''}>
                    <td>${rankDisplay(i)}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${charCell(s)}</td>
                    <td>${s.points.toFixed(1)}</td>
                    <td>${s.day}</td>
                    <td style="font-size:0.8em;">${escapeHtml(s.cause || '')}</td>
                    <td style="font-size:0.8em; color:var(--text-muted);">${s.date || ''}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    }

    // Campaign highscore: level grid with best scores
    function buildCampaignHighscoreHTML() {
        // Read campaign progress directly from localStorage (works without an active campaignEngine)
        let progress;
        try {
            const stored = localStorage.getItem('t1dSimCampaignProgress');
            progress = stored ? { ...{ levels: {}, currentLevel: 0 }, ...JSON.parse(stored) } : { levels: {}, currentLevel: 0 };
            // Migration from old format
            if (progress.days && !progress.levels) { progress.levels = progress.days; }
            if (progress.currentDay !== undefined && progress.currentLevel === undefined) { progress.currentLevel = progress.currentDay; }
        } catch (e) { progress = { levels: {}, currentLevel: 0 }; }

        // Check whether there are any scores at all
        const hasAnyScore = Object.values(progress.levels).some(lp => lp.bestPoints > 0);
        if (!hasAnyScore) {
            return `<p style="text-align:center; color:var(--text-muted);">${t('highscore.noScores')}</p>`;
        }

        // Fallback name: the player's last-used signature if bestName is missing
        // (older completions). A4: the signature is no longer stored on the profile.
        const signatureName = (typeof getPlayerSignature === 'function') ? getPlayerSignature() : '';

        // Build 4×4 grid
        const TOTAL_SLOTS = 16;
        let html = '<div class="hs-campaign-grid">';
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const level = (typeof CAMPAIGN_LEVELS !== 'undefined') ? CAMPAIGN_LEVELS[i] : null;
            if (level) {
                const lp = progress.levels[level.id] || { completed: false, stars: 0, bestPoints: 0 };
                const stars = lp.stars || 0;
                const starsHtml = [1, 2, 3].map(s =>
                    `<span class="lc-star ${s <= stars ? 'earned' : ''}">${s <= stars ? '⭐' : '☆'}</span>`
                ).join('');
                const stateClass = lp.completed ? 'completed' : 'no-score';
                // Show bestName, or the player's signature as fallback, or "Anonymous"
                const displayName = lp.bestName || (lp.completed ? (signatureName || t('stats.player.anonymous')) : '');
                // A4f: character tag for the best run (older completions have none).
                const charTag = lp.bestCharacter
                    ? `<span class="hs-char-tag"><img class="hs-char-icon" src="assets/icons/app/character-${lp.bestCharacter.id}.png" alt="" onerror="this.style.display='none'">${escapeHtml(lp.bestCharacter.name)}</span>`
                    : '';
                html += `<div class="hs-level-card ${stateClass}">
                    <span class="lc-number">${level.number}</span>
                    <span class="lc-title">${t(level.titleKey)}</span>
                    <div class="lc-stars">${starsHtml}</div>
                    ${lp.bestPoints > 0 ? `<span class="lc-score">${lp.bestPoints.toFixed(1)} pts</span>` : '<span class="lc-score" style="opacity:0.3;">—</span>'}
                    ${displayName ? `<span class="hs-lc-name">${displayName}</span>` : ''}
                    ${charTag}
                </div>`;
            } else {
                html += `<div class="hs-level-card construction">
                    <span class="lc-number">${i + 1}</span>
                    <span class="lc-construction"><img class="lc-state-icon" src="assets/icons/app/level-construction.png" alt=""></span>
                </div>`;
            }
        }
        html += '</div>';
        return html;
    }

    // Render entire popup content with tabs
    function renderContent() {
        const scores = loadHighscores(activeTab);
        // Tabs are driven by the GAME_MODES registry — the SAME source, order and icons as
        // the mode-selection picker (buildModeCardsHtml): play-group modes sorted by order,
        // each gated by its optional enabled(). So the highscore tab order matches the mode
        // picker (Campaign, Sandbox, Box Challenge) and uses the real mode PNG icons
        // instead of ad-hoc emoji.
        const hsTabsHtml = Object.keys(GAME_MODES)
            .map(key => ({ key, m: GAME_MODES[key] }))
            .filter(({ m }) => m.group === 'play' && (typeof m.enabled !== 'function' || m.enabled()))
            .sort((a, b) => (a.m.order || 0) - (b.m.order || 0))
            .map(({ key, m }) => `<button class="top-btn profile-btn hs-tab${activeTab === key ? ' active' : ''}" data-mode="${key}"><img class="hs-tab-icon" src="assets/icons/app/${m.icon}" alt="">${t('highscore.tab.' + key)}</button>`)
            .join('');
        content.innerHTML = `
            <div class="hs-header">
                <span class="hs-trophy"><img class="hs-trophy-img" src="assets/icons/app/highscore-trophy.png" alt=""></span>
                <h2>${t('highscore.title')}</h2>
            </div>
            <div class="hs-tabs">
                ${hsTabsHtml}
            </div>
            <div id="hs-table-container">${buildTableHTML(activeTab)}</div>
            <div class="popup-button-container" style="margin-top:18px;">
                <button id="hs-close-btn">${t('highscore.close')}</button>
            </div>
            ${scores.length > 0 ? `<div style="text-align:right; margin-top:12px;"><a href="#" id="hs-clear-btn" style="font-size:0.75em; color:var(--text-muted); text-decoration:underline; cursor:pointer;">${t('highscore.clearAll')}</a></div>` : ''}
        `;

        // Tab click handlers
        content.querySelectorAll('.hs-tab:not([disabled])').forEach(tab => {
            tab.addEventListener('click', () => {
                activeTab = tab.dataset.mode;
                renderContent();
            });
        });

        // Close button + click outside
        const closeHS = () => {
            document.body.removeChild(overlay);
            if (game && isPaused && !game.isGameOver) togglePause();
        };
        document.getElementById('hs-close-btn').addEventListener('click', closeHS);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHS(); });

        // Clear button (clears the active tab's data)
        const clearBtn = document.getElementById('hs-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm(t('highscore.confirmClear'))) {
                    const key = _highscoreStorageKey(activeTab);
                    try { localStorage.removeItem(key); } catch (e) {}
                    renderContent(); // Re-render with empty list
                }
            });
        }
    }

    renderContent();
}

/**
 * escapeHtml — Safe HTML escaping of user input (names in the highscore list).
 * Prevents XSS by replacing <, >, &, " and ' with HTML entities.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
        case 'food': icon = details.icon || '🍲'; break;
        case 'motion': icon = (details && details.icon) || '🏃'; break;
        case 'motion-end': icon = '⏹'; break;
        case 'insulin-fast': icon = '💉'; break;   // Syringe for rapid insulin
        case 'insulin-basal': icon = '💉'; break;  // Syringe for basal insulin
    }
    // _visibleAfter: delays graph icon rendering until the fly-in animation is done (1200ms)
    const visibleAfter = performance.now() + 1200;
    game.logHistory.push({ time: game.totalSimMinutes, message, type, icon, details, _visibleAfter: visibleAfter });

    // Update lastActionTime for player actions (used by the GLOBAL idle tip)
    const playerActionTypes = ['food', 'motion', 'motion-end', 'insulin-fast', 'insulin-basal', 'fingerprick'];
    if (playerActionTypes.includes(type)) {
        game.lastActionTime = game.totalSimMinutes;
    }
}


// =============================================================================
// FOOD & EXERCISE DISPLAY HELPERS
// =============================================================================

/**
 * updateFoodDisplay — Update the calorie display for custom meals.
 *
 * Called whenever the food sliders change. Shows:
 *   - Total kcal: carbs*4 + protein*4 + fat*9 (standard Atwater factors)
 */
function updateFoodDisplay() {
    foodKcalDisplay.textContent = ((parseInt(carbsSlider.value) * 4) + (parseInt(proteinSlider.value) * 4) + (parseInt(fatSlider.value) * 9)).toFixed(0);
}

/**
 * updateMotionKcal — Update estimated calorie burn based on selected
 * activity type, intensity and duration.
 *
 * Reads kcalPerMin from AKTIVITETSTYPER and multiplies by duration.
 * When duration is open-ended, only the rate (kcal/min) is shown.
 */
function updateMotionKcal() {
    // Find selected activity type from chips
    const selectedChip = document.querySelector('.activity-type-chip.selected');
    const type = selectedChip ? selectedChip.dataset.type : 'cardio';
    const typeDef = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[type] : null;
    const intensitet = motionIntensitySelect.value;

    const kcalPerMinute = typeDef ? (typeDef.kcalPerMin[intensitet] || 7) : 7;

    // Find selected duration
    const durationChip = document.querySelector('.duration-chip.selected');
    const duration = durationChip ? durationChip.dataset.duration : '30';

    if (duration === 'open') {
        motionKcalDisplay.textContent = `~${kcalPerMinute}/min`;
    } else {
        motionKcalDisplay.textContent = (kcalPerMinute * parseInt(duration)).toFixed(0);
    }
}


// =============================================================================
// EVENT LOG — REMOVED
// Code is preserved in mockups/event-log-backup.txt if it needs to be restored.
// Events are now shown via glow-ring timers directly on the graph icons.


// =============================================================================
// DAILY MAX POINTS — Tracking and star burst on new high score
// =============================================================================
//
// Tracks the highest points score the player has achieved during a day.
// When the player beats their daily high score a short star-burst animation
// plays near the points display and a sound is triggered.
// =============================================================================

// Stores the daily max and the day it belongs to
let _dailyMaxPoints = 0;
let _dailyMaxPointsDay = 1;

function updateDailyMaxPoints() {
    if (!game) return;

    // Reset on day change
    if (game.day !== _dailyMaxPointsDay) {
        _dailyMaxPoints = 0;
        _dailyMaxPointsDay = game.day;
    }

    // Check whether the player has beaten their daily high score
    if (game.normoPoints > _dailyMaxPoints) {
        const wasZero = _dailyMaxPoints === 0;
        const improvement = game.normoPoints - _dailyMaxPoints;
        _dailyMaxPoints = game.normoPoints;

        // Show star burst only on noticeable gains (at least 5 points)
        // and not at game start (wasZero)
        if (!wasZero && improvement >= 5) {
            spawnStarBurst();
            playSound('intervention', 'E5');
        }
    }
}

/**
 * spawnStarBurst — Animate a star burst around the points display.
 * Creates 5-8 star elements that fly out from the points badge.
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
        // Remove after animation
        setTimeout(() => star.remove(), 900);
    }
}


// =============================================================================
// updateCgmCharacter — refresh the character header inside the BG fragment (A4b)
// =============================================================================
// Reads the saved character and shows its avatar + (fixed) name above the blood-
// sugar readout, so the BG panel belongs to the played character. Called at game
// start and on load. Safe to call before any game (shows the last-used character).
// =============================================================================
function updateCgmCharacter() {
    const portrait = document.getElementById('cgmCharacterPortrait');
    const nameEl = document.getElementById('cgmCharacterName');
    if (!portrait || !nameEl) return;
    const character = (typeof getActiveCharacter === 'function')
        ? getActiveCharacter()
        : null;
    if (!character) {
        nameEl.textContent = '—';
        portrait.style.display = 'none';
        return;
    }
    nameEl.textContent = character.name;
    portrait.dataset.characterId = character.id;
    const rootSrc = typeof getCharacterMoodPortrait === 'function'
        ? getCharacterMoodPortrait(character, 'neutral')
        : `assets/icons/app/character-${character.id}.png`;
    setCharacterPortraitCrossfade(portrait, rootSrc, 'neutral', character.name, true);
    portrait.style.display = '';

    // Indlæs karakterens små mood-assets på forhånd. Første hypo eller natligt
    // billedskift bliver dermed øjeblikkeligt i stedet for at blinke tomt.
    if (character.moodPortraits && portrait.dataset.moodsPreloadedFor !== character.id) {
        Object.values(character.moodPortraits).forEach(src => {
            const preload = new Image();
            preload.src = src;
        });
        portrait.dataset.moodsPreloadedFor = character.id;
    }
}


// =============================================================================
// updateCgmCharacterMood — dynamisk nærportræt i BG-hero
// =============================================================================
// Den fælles resolver bor i archetypes.js, så desktop og mobil bruger samme
// prioritet, BG-hysterese og søvnlogik. Alle seks karakterer bruger samme
// tilstandsnøgler, men hver deres portræt-assets.
// =============================================================================
function updateCgmCharacterMood() {
    const portrait = document.getElementById('cgmCharacterPortrait');
    if (!portrait || !game || typeof resolveCharacterMood !== 'function'
        || typeof getCharacterMoodPortrait !== 'function') return;

    const characterId = portrait.dataset.characterId
        || (typeof getActiveCharacter === 'function' ? getActiveCharacter().id : 'erik');
    const character = typeof getCharacter === 'function' ? getCharacter(characterId) : null;
    if (!character) return;

    const previousMood = portrait.dataset.mood || 'neutral';
    const mood = resolveCharacterMood(game, previousMood);
    const src = getCharacterMoodPortrait(character, mood);

    setCharacterPortraitCrossfade(portrait, src, mood, character.name);
}


// =============================================================================
// CHARACTER POPUP — Choose a fixed fictional character
// =============================================================================
//
// Shows six fixed characters. The public selection stores only characterId;
// weight/ICR/ISF are resolved from archetypes.js when a session starts.
//
// @param {object} options - Optional settings
// @param {boolean} options.readOnly - Lock the picker while a game is running
// =============================================================================
function showProfilePopup(options) {
    options = options || {};

    // Prevent duplicate popup
    if (document.querySelector('.popup-overlay')) return;

    // Load saved profile from localStorage (or use defaults)
    // getSavedCharacterId() håndterer både det nye id-only format og migration
    // fra ældre rå profiler uden at returnere de gamle tal til appen.
    let selectedCharacterId = getSavedCharacterId();

    // Build popup DOM
    const { overlay, content } = createPopup({ contentClass: 'profile-popup' });

    // A4: the popup is a CHARACTER picker, not a personal profile — the player's own
    // name no longer lives here (it is a highscore signature, entered at game over).
    // Opened from the top-bar "Karakter" button to view/change the character
    // (read-only while a game is running). The start flow picks the character on the
    // mode-selection screen, not here.
    content.innerHTML = `
        <h5 class="profile-title">${t('profile.character')}</h5>
        ${options.readOnly ? `<p class="profile-readonly-notice">${t('profile.readonlyNotice')}</p>` : ''}

        <div class="profile-form">
            <!-- Character selector (A4): pick one of the six fixed characters to play
                 instead of typing body weight / ISF / ICR. Reuses .mode-card visuals. -->
            <div class="profile-field">
                <div class="archetype-cards" id="profileArchetypeCards"></div>
            </div>
        </div>

        <div class="popup-button-container" style="display:flex; gap:10px; justify-content:center;">
            ${options.readOnly ? '' : `<button id="profileResetButton" class="profile-reset-btn">${t('profile.reset')}</button>`}
            ${options.readOnly ? '' : `<button id="profileSaveButton" class="profile-save-btn">${t('profile.save')}</button>`}
        </div>
    `;


    // Click on overlay (outside popup) closes popup
    // Close on overlay background click — but ONLY if mousedown also started
    // on the overlay. Prevents text selection ending outside the popup from
    // inadvertently closing it.
    let mouseDownOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mouseDownOnOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && mouseDownOnOverlay) {
            document.body.removeChild(overlay);
        }
    });

    // Reference til karakterkortene. I læsetilstand under et aktivt spil er
    // kortene låst, fordi et karakterskift ellers ville kræve en genstart.
    const cardsContainer = document.getElementById('profileArchetypeCards');
    const saveButton = document.getElementById('profileSaveButton');

    // Render the character cards (selected one highlighted). Clicking a card selects
    // it and refreshes the starting figures. Cards are disabled in read-only mode.
    function renderCards() {
        cardsContainer.innerHTML = buildCharacterPairCardsHtml(selectedCharacterId, options.readOnly);
        if (!options.readOnly) {
            cardsContainer.querySelectorAll('.archetype-card').forEach(card => {
                card.addEventListener('click', () => {
                    selectedCharacterId = card.getAttribute('data-character-id');
                    renderCards();
                });
            });
        }
    }

    renderCards();

    // Helper: collect the chosen profile (selected character only). A4: no player
    // name here — the name is a highscore signature now, entered at game over.
    function collectProfile() {
        return characterToProfile(selectedCharacterId);
    }

    // Helper: save profile to localStorage
    function saveProfile(profile) {
        saveCharacterSelection(profile.characterId);
    }

    // "Reset" button: back to the default character (keeps the typed name).
    // Not rendered in read-only mode, so guard the reference.
    const resetButton = document.getElementById('profileResetButton');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            selectedCharacterId = DEFAULT_CHARACTER_ID;
            renderCards();
        });
    }

    // Save button: persist the chosen character as the last-used default and refresh
    // the character display. Not rendered in read-only mode, so guard the reference.
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const profile = collectProfile();
            saveProfile(profile);
            // Tekster med {characterName} skal straks følge den nye karakter.
            if (typeof translateDOM === 'function') translateDOM();
            if (typeof updateFoodChips === 'function') updateFoodChips();
            if (typeof updateCgmCharacter === 'function') updateCgmCharacter();
            document.body.removeChild(overlay);
        });
    }
}


// =============================================================================
// PHYSIOLOGY EFFECTS PANEL — Real-time overview of BG-influencing forces
// =============================================================================
//
// Shows a sorted list of physiological forces with arrows and a strength bar.
// Updated every tick (from updateUI), but with hysteresis to avoid visual
// noise — the DOM is only updated on significant changes (>15%).
//
// Global variables:
//   physiologyEffectsEnabled: whether the panel is visible
//   _lastEffectsUpdate: timestamp of the most recent DOM update
//   _lastEffectsData: previous forces array for change detection
// =============================================================================
let physiologyEffectsEnabled = false;
let showInsulinBand = false;
let showCarbBand = false;
let showISFLine = false;
let showKetoneLine = false;   // ketone (BHB) line in the negative zone — shared by game + editor
let _lastEffectsUpdate = 0;
let _lastEffectsData = [];
let physiologyWindow = null;

// --- Tooltips and GitHub links for each physiological force ---
// Structured bullet-point info:
//   • What happens physiologically?
//   • How does it affect BG?
//   • Can the player do anything?
// Shown on mouseover (title), click opens the BG-SCIENCE.md section on GitHub.
const _forceInfo = {
    egp: {
        da: '• Leveren frigiver glukose fra glykogenlagre\n• Stiger ved stress, dawn-effekt og lav insulin\n• Kontrol: Delvis — insulin undertrykker det',
        en: '• Liver releases glucose from glycogen stores\n• Rises with stress, dawn effect, and low insulin\n• Control: Partial — insulin suppresses it',
        section: '#hepatic-glucose-production'
    },
    carbAbsorption: {
        da: '• Kulhydrater absorberes fra tarmen til blodet\n• Hastighed afhænger af madtype (sukker > stivelse)\n• Kontrol: Ja — vælg hvad og hvornår karakteren spiser',
        en: '• Carbs are absorbed from gut into blood\n• Rate depends on food type (sugar > starch)\n• Control: Yes — choose what and when the character eats',
        section: '#carbohydrates'
    },
    insulinAction: {
        da: '• Insulin transporterer glukose ind i celler\n• Virker på muskler, lever og fedtvæv via GLUT4\n• Kontrol: Ja — bolus og basalinsulin',
        en: '• Insulin transports glucose into cells\n• Acts on muscles, liver and fat via GLUT4\n• Control: Yes — bolus and basal insulin',
        section: '#insulin-pharmacology'
    },
    basalInsulin: {
        da: '• Langvirkende insulin giver baggrundsvirkning over mange timer\n• Sænker blodsukker langsomt og jævnt\n• Du vælger basaldosis og tidspunkt',
        en: '• Long-acting insulin provides background action for many hours\n• Lowers blood sugar slowly and steadily\n• You choose the basal dose and timing',
        section: '#insulin-pharmacology'
    },
    bolusInsulin: {
        da: '• Hurtigvirkende insulin — til måltider og korrektioner\n• Peak effekt 1-2 timer, varighed 3-5 timer\n• Kontrol: Ja — du vælger dosis og timing',
        en: '• Rapid-acting insulin — for meals and corrections\n• Peak effect 1-2 hours, duration 3-5 hours\n• Control: Yes — you choose dose and timing',
        section: '#insulin-pharmacology'
    },
    exerciseUptake: {
        da: '• Motion forstærker insulins effekt på muskler\n• Glukose optages hurtigere under og efter træning\n• Kontrol: Ja — du starter og stopper motion',
        en: '• Exercise amplifies insulin effect on muscles\n• Glucose is absorbed faster during and after exercise\n• Control: Yes — you start and stop exercise',
        section: '#aerobic-exercise'
    },
    stressHormones: {
        da: '• Adrenalin/glukagon får leveren til at frigive glukose\n• Aktiveres automatisk ved lavt blodsukker og hård motion\n• Kontrol: Nej — kroppens nødberedskab',
        en: '• Adrenaline/glucagon cause liver to release glucose\n• Activated automatically by low blood sugar and intense exercise\n• Control: No — body\'s emergency response',
        section: '#counterregulatory-hormones'
    },
    dawnEffect: {
        da: '• Kortisol stiger naturligt kl. 04-08 (døgnrytme)\n• Øger insulinresistens → blodsukker stiger om morgenen',
        en: '• Cortisol rises naturally 04-08 (circadian rhythm)\n• Increases insulin resistance → blood sugar rises in the morning',
        section: '#dawn-phenomenon'
    },
    renalExcretion: {
        da: '• Nyrerne filtrerer glukose ud i urinen\n• Kun aktiv ved blodsukker over ~10 mmol/L (nyretærskel)\n• Udskillelsen stiger, jo højere blodsukkeret er',
        en: '• Kidneys filter glucose into urine\n• Only active when blood sugar exceeds ~10 mmol/L (renal threshold)\n• Excretion increases as blood sugar rises',
        section: '#renal-glucose-handling'
    },
    brainConsumption: {
        da: '• Forbrug der ikke kræver insulin: hjerne (~120g/dag) + røde blodlegemer + nyremedulla + dele af hjertet\n• Hjernen er den dominerende forbruger (~70%); de øvrige væv tegner sig for resten\n• Konstant rate ved normalt blodsukker; reduceres ved hypo via GLUT1-mætning\n• Kontrol: Nej — altid aktiv',
        en: '• Tissues that take up glucose without insulin: brain (~120g/day) + red blood cells + renal medulla + parts of the heart\n• The brain dominates (~70%); the other tissues account for the remainder\n• Constant rate at normal blood sugar; reduced during hypo via GLUT1 saturation\n• Control: No — always active',
        section: '#brain-glucose-consumption'
    },
    proteinGlucagon: {
        da: '• Aminosyrer fra protein stimulerer glukagon\n• Forsinket blodsukkerstigning: onset 1-2t, peak 3-4t\n• Kontrol: Delvis — afhænger af proteinindtag',
        en: '• Amino acids from protein stimulate glucagon\n• Delayed blood sugar rise: onset 1-2h, peak 3-4h\n• Control: Partial — depends on protein intake',
        section: '#fat-and-protein'
    },
    ffaResistance: {
        da: '• Fedt fra mad → frie fedtsyrer (FFA) i blodet\n• FFA reducerer insulins virkning gradvist over timer\n• Blodsukkeret kan derfor stige senere efter et fedtrigt måltid',
        en: '• Dietary fat → free fatty acids (FFA) in blood\n• FFA gradually reduce insulin effectiveness over hours\n• Blood sugar can therefore rise later after a high-fat meal',
        section: '#fat-and-protein'
    },
    glucotoxicity: {
        da: '• Vedvarende højt blodsukker (>10 mmol/L) skader cellernes insulinsignalering\n• Oxidativt stress → GLUT4-nedregulering → insulin virker dårligere\n• Ond cirkel: højt blodsukker → resistens → endnu højere blodsukker\n• Insulinfølsomheden bedres gradvist over 1-2 dage efter normalisering',
        en: '• Sustained high blood sugar (>10 mmol/L) damages cellular insulin signaling\n• Oxidative stress → GLUT4 downregulation → insulin works less effectively\n• Vicious cycle: high blood sugar → resistance → even higher blood sugar\n• Insulin sensitivity improves gradually over 1-2 days after normalization',
        section: '#glucotoxicity'
    }
};
// Language-dependent URL: Danish user → Danish science doc, otherwise English.
// BG-SCIENCE.md is maintained in English only (clinicians/researchers/modeller knowledge base),
// so both Danish and English UI open the same English reference.
const _bgScienceBaseUrls = {
    da: 'https://github.com/krauhe/t1d-simulator/blob/main/docs/BG-SCIENCE.md',
    en: 'https://github.com/krauhe/t1d-simulator/blob/main/docs/BG-SCIENCE.md'
};

/**
 * updateEffectsPanel — Updates the physiology effects panel with current forces.
 *
 * Called from updateUI() every frame, but the DOM is only updated every ~500ms
 * and only when data has changed significantly (hysteresis).
 *
 * Visual balance: up/down groups are scaled proportionally to their total
 * flux, so the visual "weight" matches the actual BG direction.
 * Up forces are shown at top (largest first), down forces at bottom (largest last).
 */
// Placeholder HTML for the BG forces panel when the game is not running.
// Shows grey arrows + dashes — indicates the panel is active but waiting for data.
function _effectsPlaceholderHTML() {
    const rows = [
        { arrow: '▲', cls: 'up' },
        { arrow: '▲', cls: 'up' },
        { arrow: '▼', cls: 'down' },
        { arrow: '▼', cls: 'down' },
        { arrow: '▼', cls: 'down' },
    ];
    return rows.map(r =>
        `<div class="effect-row effect-placeholder">` +
        `<span class="effect-arrow ${r.cls}">${r.arrow}</span>` +
        `<span class="effect-name">– – – – –</span>` +
        `</div>`
    ).join('');
}

function updateEffectsPanel(snapshotOverride) {
    // The Scenarie editor feeds the hovered frame's snapshot directly (its
    // scrubber inspects any minute, not "now"). In that mode we bypass the
    // game-only gates and the 500ms time-throttle so scrubbing stays responsive;
    // the significant-change hysteresis below still prevents needless rebuilds.
    const isEditor = !!snapshotOverride;
    const now = performance.now();
    if (!isEditor) {
        if (!physiologyEffectsEnabled || !game) return;
        // Hysteresis: at most one DOM update per 500ms
        if (now - _lastEffectsUpdate < 500) return;
    }

    const snapshot = snapshotOverride || game.getPhysiologySnapshot();
    if (!snapshot || !snapshot.forces) return;

    // Select at most 5 rows total (fixed count prevents vertical jitter).
    // Actual flux forces are prioritised over modifier rows, so FFA/glucotoxicity
    // cannot push larger direct BG forces out of the panel.
    const MAX_ROWS = 5;
    const allForces = snapshot.forces;
    const fluxForces = allForces
        .filter(f => f.kind !== 'modifier')
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, MAX_ROWS);
    const modifierForces = allForces
        .filter(f => f.kind === 'modifier')
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, Math.max(0, MAX_ROWS - fluxForces.length));
    const selectedForces = [...fluxForces, ...modifierForces];

    const upForces = selectedForces
        .filter(f => f.direction === 'up')
        .sort((a, b) => b.magnitude - a.magnitude);
    // Down forces: sort ASCENDING so the LARGEST ends up at the BOTTOM of the panel
    const downForces = selectedForces.filter(f => f.direction === 'down');
    downForces.sort((a, b) => a.magnitude - b.magnitude); // smallest first, largest last
    const forces = [...upForces, ...downForces];

    // Check whether data has changed significantly
    let changed = forces.length !== _lastEffectsData.length;
    if (!changed) {
        for (let i = 0; i < forces.length; i++) {
            const prev = _lastEffectsData[i];
            const curr = forces[i];
            if (!prev || prev.name !== curr.name || prev.direction !== curr.direction ||
                prev.cause !== curr.cause ||
                Math.abs(prev.magnitude - curr.magnitude) > prev.magnitude * 0.15) {
                changed = true;
                break;
            }
        }
    }
    if (!changed) return;

    _lastEffectsData = forces.map(f => ({...f}));
    _lastEffectsUpdate = now;

    const effectsList = document.getElementById('effectsList');
    if (!effectsList) return;

    // --- Continuous normalisation: all arrows on the same scale ---
    // The largest force gets MAX_ARROW px; all others are scaled linearly.
    // Result: arrow heights are directly comparable across direction.
    const MIN_ARROW = 4, MAX_ARROW = 15;
    const fluxMag = forces.filter(f => f.kind !== 'modifier').map(f => f.magnitude);
    const maxMag = Math.max(...fluxMag, 0.001);

    const currLang = (typeof appSettings !== 'undefined' && appSettings.language) || 'da';

    let html = '';
    forces.forEach(f => {
        const arrow = f.direction === 'up' ? '▲' : '▼';
        const name = t('force.' + f.name);

        const rawSize = (f.magnitude / maxMag) * MAX_ARROW;
        const modifierCap = f.kind === 'modifier' ? MAX_ARROW * 0.65 : MAX_ARROW;
        const arrowSize = Math.round(Math.max(MIN_ARROW, Math.min(modifierCap, rawSize)));

        // Tooltip: structured bullet format (physiology + control) + click link
        const info = _forceInfo[f.name];
        const tooltip = info ? (currLang === 'da' ? info.da : info.en) : '';
        const link = info ? (_bgScienceBaseUrls[currLang] || _bgScienceBaseUrls.en) + info.section : '';

        // Cause (only for EGP — shows what drives liver production, indented on a new line)
        const causeLine = f.cause
            ? `<div class="effect-cause">${t('force.cause.' + f.cause)}</div>` : '';

        html += `<div class="effect-row" title="${tooltip}" data-link="${link}">` +
            `<span class="effect-arrow ${f.direction}" style="font-size:${arrowSize}px">${arrow}</span>` +
            `<span class="effect-name">${name}${causeLine}</span>` +
            `</div>`;
    });
    effectsList.innerHTML = html;

    // Click handler: open the BG-SCIENCE.md section on GitHub
    effectsList.querySelectorAll('.effect-row[data-link]').forEach(row => {
        row.addEventListener('click', () => {
            const link = row.getAttribute('data-link');
            if (link) window.open(link, '_blank');
        });
    });
}


/**
 * openPhysiologyDashboard — Opens the separate physiology dashboard window.
 *
 * Uses window.open() to create an independent browser window.
 * The dashboard window fetches data via window.opener.game.getPhysiologySnapshot().
 */
function openPhysiologyDashboard() {
    // If the window is already open, focus it
    if (physiologyWindow && !physiologyWindow.closed) {
        physiologyWindow.focus();
        return;
    }
    physiologyWindow = window.open(
        'physiology-dashboard.html',
        'physiologyDashboard',
        'width=520,height=850,resizable=yes,scrollbars=yes'
    );

    // Monitor whether the window closes (update toggle button + appSettings)
    const checkClosed = setInterval(() => {
        if (!physiologyWindow || physiologyWindow.closed) {
            clearInterval(checkClosed);
            physiologyWindow = null;
            // Sync appSettings so the toggle button shows the correct state
            if (typeof appSettings !== 'undefined') {
                appSettings.physiologyDashboard = false;
                if (typeof saveSettings === 'function') saveSettings(appSettings);
            }
            syncPhysiologyToggles();
        }
    }, 500);  // Check every 500ms for faster response
}


/**
 * syncPhysiologyToggles — Synchronise the toggle buttons with the current state.
 *
 * Same pattern as syncSoundToggles() — sets the 'active' class
 * based on whether the effects panel / dashboard is active.
 */
function syncPhysiologyToggles() {
    // Physiology button (top-bar) — active when at least one physiology feature is on
    const physBtn = document.getElementById('physiologyToggle');
    const anyActive = showInsulinBand || showCarbBand || showISFLine || showKetoneLine || physiologyEffectsEnabled;
    if (physBtn) physBtn.classList.toggle('active', anyActive);
    // Dashboard toggle in the Developer section
    const dashToggle = document.getElementById('dashboardToggle');
    if (dashToggle) dashToggle.classList.toggle('active', !!(physiologyWindow && !physiologyWindow.closed));
}


// =============================================================================
// VISUAL SYMPTOM EFFECTS — CSS filter + vignette overlay
// =============================================================================
//
// Simulates physiological symptoms visually using an EPISODIC approach:
//   The screen is normally clear. Periodic "episodes" of blurred vision come
//   and go (typically ~5 sec duration), as real hypoglycaemia is felt in waves.
//
// Episodic design:
//   - Between episodes: screen is completely normal (no permanent blur)
//   - During episode: blur fades in, holds briefly, fades out
//   - Frequency and intensity increase with severity
//   - Slight baseline desaturation at severe hypo/DKA (subtle, not blocking)
//
// Drivers (all from simulator.js):
//   - trueBG:              Hypo episodes when BG < 3.5
//   - brainEnergyDeficit:  Tunnel vision (vignette) at accumulated deficit
//   - acidosisLoad:        DKA episodes with desaturation
//   - glucotoxicLoad:      Periodic subtle blur during prolonged hyperglycaemia
//
// Called from: mainGameLoop() in game.js after drawGraph()
// =============================================================================

// Episode state: tracks when the next episode starts and how far along we are
let _vfxEpisodeActive = false;   // Is an episode in progress?
let _vfxEpisodeStart = 0;        // performance.now() when the episode started
let _vfxEpisodeDuration = 0;     // Duration of this episode (ms)
let _vfxEpisodePeak = 0;         // Max blur for this episode (px)
let _vfxNextEpisodeTime = 0;     // performance.now() for the next episode

// Smoothed current values (lerp)
let _vfxCurrentBlur = 0;
let _vfxCurrentSaturation = 1;
let _vfxCurrentVignette = 0;

// DOM cache
let _vfxContainer = null;
let _vfxVignette = null;

function updateSymptomEffects() {
    // VFX disabled: reset everything
    if (typeof vfxEnabled === 'undefined' || !vfxEnabled) {
        if (_vfxContainer) _vfxContainer.style.filter = '';
        if (_vfxVignette) _vfxVignette.style.opacity = '0';
        _vfxCurrentBlur = 0;
        _vfxCurrentSaturation = 1;
        _vfxCurrentVignette = 0;
        _vfxEpisodeActive = false;
        return;
    }

    // Cache DOM references
    if (!_vfxContainer) _vfxContainer = document.getElementById('game-container');
    if (!_vfxVignette) _vfxVignette = document.getElementById('symptom-vignette');
    if (!_vfxContainer) return;

    const now = performance.now();

    // Fælles VFX-driver holder desktop, mobil og symptomtips synkroniseret.
    const vfxState = resolveSymptomVfxState(game);
    const brainDeficit = vfxState.brainDeficit;
    const BRAIN_THRESHOLD = 8.0;
    const ACIDOSIS_THRESHOLD = game && game.ACIDOSIS_THRESHOLD
        ? game.ACIDOSIS_THRESHOLD
        : 600;
    const acidosis = vfxState.acidRatio * ACIDOSIS_THRESHOLD;

    // =========================================================================
    // COMPUTE EPISODE PARAMETERS based on physiological state
    // =========================================================================
    // severity: 0 = no effect, 1 = maximum (near game over)
    // Higher severity → more frequent and stronger episodes

    let severity = vfxState.severity;
    let isHypoActive = vfxState.hypoActive;
    let isDkaActive = vfxState.ketoneActive;

    // =========================================================================
    // EPISODE LOGIC: start/stop episodes based on severity
    // =========================================================================
    // Interval between episodes: 25s at severity=0.1, 6s at severity=1.0
    // Duration per episode: 3s at low severity, 6s at high
    // Peak blur: 1.5px at low severity, 4px at high

    let targetBlur = 0;
    let targetSaturation = 1.0;
    let targetVignette = 0;

    // Minimum severity 0.05 to avoid weak, barely visible flicker episodes
    // that feel like bright flashes rather than blurred vision
    if (severity > 0.05) {
        // Episode parameters scaled by severity
        const episodeInterval = 25000 - severity * 19000;  // 25s → 6s
        const episodeDuration = 3000 + severity * 3000;    // 3s → 6s
        const episodePeakBlur = 1.5 + severity * 2.5;      // 1.5px → 4px

        // Start a new episode when the time arrives
        if (!_vfxEpisodeActive && now >= _vfxNextEpisodeTime) {
            _vfxEpisodeActive = true;
            _vfxEpisodeStart = now;
            _vfxEpisodeDuration = episodeDuration;
            _vfxEpisodePeak = episodePeakBlur;
        }

        // Compute episode envelope (fade in → hold → fade out)
        if (_vfxEpisodeActive) {
            const elapsed = now - _vfxEpisodeStart;

            if (elapsed >= _vfxEpisodeDuration) {
                // Episode end — schedule the next one
                _vfxEpisodeActive = false;
                _vfxNextEpisodeTime = now + episodeInterval;
            } else {
                // Envelope: sine wave (smooth hump) over the episode duration
                // 0 → peak → 0 as a soft arc
                const progress = elapsed / _vfxEpisodeDuration;
                const envelope = Math.sin(progress * Math.PI); // 0→1→0

                targetBlur = envelope * _vfxEpisodePeak;
            }
        }

        // --- Persistent subtle desaturation (NOT episodic) ---
        // Slight fade always present during hypo/DKA, but unobtrusive
        if (isHypoActive) {
            // Hypo: slight desaturation, stronger at lower BG
            const desat = severity * 0.25;  // Max 25% desaturation
            targetSaturation *= (1.0 - desat);
        }
        if (isDkaActive) {
            // DKA: stronger desaturation (world turns greyish)
            const acidRatio = Math.min(1.0, acidosis / ACIDOSIS_THRESHOLD);
            targetSaturation *= (1.0 - acidRatio * 0.35);
        }

        // --- Vignette (tunnel vision): only at severe brain energy deficit ---
        // Not episodic — this is persistent when the brain lacks energy
        if (brainDeficit > BRAIN_THRESHOLD * 0.35) {
            const vignetteRatio = (brainDeficit - BRAIN_THRESHOLD * 0.35) /
                                  (BRAIN_THRESHOLD * 0.65);
            targetVignette = Math.min(0.7, vignetteRatio * 0.7);
        }
        // DKA vignette at severe acidosis (>60%)
        if (acidosis > ACIDOSIS_THRESHOLD * 0.6) {
            const dkaVigRatio = (acidosis - ACIDOSIS_THRESHOLD * 0.6) /
                                (ACIDOSIS_THRESHOLD * 0.4);
            targetVignette = Math.max(targetVignette, Math.min(0.5, dkaVigRatio * 0.5));
        }
    } else {
        // No symptoms — reset episode state
        _vfxEpisodeActive = false;
    }

    // Clamp
    targetBlur = Math.min(targetBlur, 4.0);
    targetSaturation = Math.max(targetSaturation, 0.4);
    targetVignette = Math.min(targetVignette, 0.7);

    // =========================================================================
    // SMOOTH LERP
    // =========================================================================
    const lerpUp = 0.08;    // Fast fade-in (episode starts quickly)
    const lerpDown = 0.04;  // Slower fade-out (episode tapers off)

    const blurLerp = targetBlur > _vfxCurrentBlur ? lerpUp : lerpDown;
    _vfxCurrentBlur += (targetBlur - _vfxCurrentBlur) * blurLerp;
    _vfxCurrentSaturation += (targetSaturation - _vfxCurrentSaturation) * 0.03;
    _vfxCurrentVignette += (targetVignette - _vfxCurrentVignette) * 0.04;

    // =========================================================================
    // APPLY TO DOM
    // =========================================================================
    const hasBlur = _vfxCurrentBlur > 0.08;
    const hasDesat = Math.abs(_vfxCurrentSaturation - 1) > 0.01;

    if (hasBlur || hasDesat) {
        let filterStr = '';
        if (hasBlur) filterStr += `blur(${_vfxCurrentBlur.toFixed(1)}px) `;
        if (hasDesat) filterStr += `saturate(${_vfxCurrentSaturation.toFixed(2)})`;
        _vfxContainer.style.filter = filterStr.trim();
    } else {
        _vfxContainer.style.filter = '';
    }

    if (_vfxVignette) {
        _vfxVignette.style.opacity = _vfxCurrentVignette > 0.01
            ? _vfxCurrentVignette.toFixed(3) : '0';
    }
}
