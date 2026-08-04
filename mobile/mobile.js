// =============================================================================
// MOBILE.JS — Mobile shell behaviour (Phase 1: live engine wired)
// =============================================================================
// Runs the SHARED physiology engine (js/simulator.js + hovorka + physiology-
// engine) inside the mobile shell: a sandbox Simulator driven by a rAF loop,
// with the HUD + 12h rolling graph fed from live state. Graph dot colours and
// trend arrow reuse the shared getBGZone()/cgmTrendForRate() (js/graph-renderer.js)
// so the look cannot drift from desktop.
//
// SHIMS: the shared engine expects a few globals that normally live in
// sounds.js/main.js/ui.js (not loaded here). We provide minimal stand-ins so the
// engine runs standalone. Lifting logEvent (and friends) into a shared module is
// the documented Phase-0 follow-up (see MOBILE-DESIGN.md §2.2).
//
// STILL TODO: campaign mode + level select, mode/stats wired to richer
// state, building the sheets from shared FOODS/i18n, and (optionally) reusing the
// full desktop drawGraph once it is migrated into graph-renderer.js.
// =============================================================================

// --- Shims / globals the shared engine references ---------------------------
// NOTE: appSettings is owned by sounds.js (loaded first) — do NOT redeclare it here
// (a second declaration would be a fatal syntax error). The mobile shell forces
// Danish + leaves bgUnit to the user (see the load handler).
var cgmDataPoints = [];                                  // live CGM dots {time,value}
var trueBgPoints = [];                                   // true BG line points
var physiologyDataPoints = [];                           // engine.step onSample sink
// Start PAUSED: the shell lands on the start screen, so the sim must not advance
// until the player picks a mode. (Without this the rAF loop ran the sandbox for the
// frames before the load handler showed the start screen — a confusing flash of a
// live sandbox that then "stops".) startScreenChoose() resumes on mode pick.
var isPaused = true;
// Desktop-parity boot: nothing is "started" until the sim first runs. While false the
// graph shows ONLY the empty zone backdrop (no curve/markers/now-line) and the HUD shows
// dashes — exactly like the desktop's blank pre-game state (game===null there). The loop
// flips it true on the first unpaused update, which covers every start path (mode pick,
// play button, campaign, restart). Closing the landing leaves it false → empty graph.
var _started = false;
var _welcomeTipArmed = false;                            // per-run first-start init done (reset on restart/new level)
var _physStartChecked = false;                           // per-run: physiology "score not saved" start-warning done (reset on restart/new level)
var _appEl = null;                                       // cached #app (toggles the 'pre-start' class)
// Tip hold: suppress every tip for the first 20s (real time) of a run, so a game never
// opens with a tip. Set to now+TIP_START_DELAY_MS on each first-start; Infinity means
// "no tip yet" (pre-start, and between a restart and the next first-start).
var TIP_START_DELAY_MS = 20000;
var _tipsAllowedAtMs = Infinity;
// Physiology "training mode" (desktop parity, js/main.js + game.js): the physiology
// overlay reveals insight you don't have in real life, so a run that used it does NOT
// record a highscore. Set true if the overlay is on at any point during a run; reset per
// run. A confirm dialog explains it on enable; a graph watermark indicates it's active.
var trainingModeUsedThisSession = false;
function isPhysiologyOn() { return !!(showInsulinBand || showCarbBand || showISFLine || showKetoneLine); }
var speedSelector = { value: '240' };                    // read by the Simulator ctor (4t/min)
var MAX_GRAPH_POINTS_PER_DAY = 288;                      // graph history cap (from main.js)
var KCAL_PER_KG_WEIGHT = 7700;                           // weight<->calorie constant (from main.js)
// Unguarded DOM-element globals the engine writes to (live in main.js/ui.js on the
// desktop). Minimal stubs absorb the writes; the mobile HUD reads game state directly.
var normoPointsWeighting = { textContent: '' };
var pointsBadge = { classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } } };
var steepDropWarningDiv = { style: {} };
function showPopup() {}                                  // engine warning popups (DKA etc.) — not surfaced on mobile yet
function updateUI() {}                                   // engine UI hook; the mobile HUD uses updateHud() instead
// playSound() and appSettings come from sounds.js (loaded first); not shimmed here.
// showGameOverPopup() is defined below (real mobile overlay), not a noop.
function logEvent(message, type, details) {              // minimal port of ui.js logEvent
  if (!window.game) return;
  game.logHistory = game.logHistory || [];
  game.logHistory.push({ time: game.totalSimMinutes, message: message, type: type, details: details || {} });
  var playerActions = ['food', 'motion', 'motion-end', 'insulin-fast', 'insulin-basal', 'fingerprick'];
  if (playerActions.indexOf(type) >= 0) game.lastActionTime = game.totalSimMinutes;
}

// --- Fixed character profile (shared localStorage key with desktop) ----------
// Den offentlige storage indeholder kun characterId. Weight/ICR/ISF opløses fra
// archetypes.js, så ændrede rå felter i localStorage aldrig sendes til motoren.
// Function declaration → hoisted, so it is callable just below.
function loadSavedProfile() {
  try { return loadFixedCharacterProfile(); }
  catch (e) { return { weight: 70, icr: 10, isf: 3.0, characterId: 'erik' }; }
}

// --- Sandbox simulator instance ---------------------------------------------
var game = new Simulator(loadSavedProfile(), 'sandbox', {});
window.game = game;

// --- Campaign engine (shared CampaignCore) ----------------------------------
// Mobile builds its own thin UI on the SAME DOM-free engine the desktop uses
// (js/campaign-core.js). The host adapter is how the core reaches this shell:
// it reads game/settings, plays sounds, and emits plain-data descriptors the
// mobile UI renders. The core pushes tip messages straight onto
// game.graphMessages (the existing seam) — those are rendered by syncTipBar().
// P0 wires the engine + global tips; the screen/popup/gating emits below are
// filled in across P2-P4 (level select, run-a-level, event popups).
var mobileHost = {
  getGame: function () { return game; },
  getSettings: function () {
    var settings = (typeof appSettings !== 'undefined') ? appSettings : {};
    return Object.assign({}, settings, {
      vfxEnabled: (typeof vfxEnabled === 'undefined') ? true : vfxEnabled,
    });
  },
  playSound: function (type) { if (typeof playSound === 'function') playSound(type); },
  flyIconToGraph: function () { /* mobile has no fly-in animation; the graph icon + tip carry the cue */ },
  showActivityActive: function () { refreshActivityUI(); },   // reflect the running activity in the sheet
  // Re-entrancy guard for event popups + the core's "is a screen up?" checks. True
  // when any blocking overlay or open bottom-sheet is showing, so the core won't
  // stack an event popup on top (and falls back to a graph tip instead).
  isPopupOpen: function () {
    return !!document.querySelector(
      '#onboarding.open, #gameOverOverlay.open, #campaignResult.open, #campaignIntro.open, #levelSelect.open, .sheet.open'
    );
  },
  emitGating: function (gatingState) { mobileApplyGating(gatingState); },
  // Event popups are deferred on mobile: returning false makes the core fall back
  // to a graph tip (rendered by syncTipBar via the tip bar). The re-entrancy
  // guard above is still honoured. See the return report for the rationale.
  emitPopup: function (/* descriptor */) { return false; },
  emitScreen: function (descriptor) {
    switch (descriptor.kind) {
      case 'intro':       showCampaignIntro(descriptor); break;
      case 'complete':    showCampaignComplete(descriptor); break;
      case 'failed':      showCampaignFailed(descriptor); break;
      case 'gameover':    showCampaignGameOver(descriptor); break;
      case 'levelSelect': openLevelSelect(); break;   // "back to levels" from a result
    }
  },
  storage: {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  },
  // Boot a campaign run. Mirrors the desktop requestStart (resetGame + startGame),
  // but synchronously — the mobile shell needs no setTimeout. startCampaign() below
  // does the equivalent of desktop startGame('campaign').
  requestStart: function (/* mode */) { startCampaign(); },
  // Physiology viewing this run = practice mode: the core then skips recording the
  // level's stars/best score (same rule as the sandbox highscore block). Set by the
  // loop via trainingModeUsedThisSession, reset in restartGame/startCampaign.
  isScoreBlocked: function () { return !!trainingModeUsedThisSession; }
};
var campaignEngine = (typeof CampaignCore === 'function') ? new CampaignCore(mobileHost) : null;
window.campaignEngine = campaignEngine;

// Speed: same family + visual feedback as the desktop speed-stepper (js/main.js).
// The state icon shows arrows for the speed level (▶ … ▶▶▶▶) and PULSES at a rate
// matching the speed (slow sim = slow pulse), or a static ⏸ when paused — the
// pulsing "heartbeat" is the cue that sim-time is advancing.
var SPEED_VALUES = [60, 240, 720, 1440];
// Speed labels come from i18n (m.speed.<value>); see updateSpeedUI().
var SPEED_ARROWS = { 60: '▶', 240: '▶▶', 720: '▶▶▶', 1440: '▶▶▶▶' };
var SPEED_PULSE  = { 60: '3', 240: '1.5', 720: '0.6', 1440: '0.3' };   // pulse seconds per speed
var speedIndex = 1;                                      // 240 = 4t/min
game.simulationSpeed = SPEED_VALUES[speedIndex];

// --- HUD update from live state ---------------------------------------------
var ZONE_VAR = { danger: 'var(--red)', elevated: 'var(--orange)', target: 'var(--green)' };
// BG zone -> the desktop .cgm-number colour class + the #cgm-hero glow class. Using the
// class approach (not inline style.color) matches desktop exactly (js/ui.js updateUI).
var ZONE_NUM_CLASS = { danger: 'bg-danger', elevated: 'bg-elevated', target: 'bg-target' };
var ZONE_GLOW_CLASS = { danger: 'glow-danger', elevated: 'glow-elevated', target: 'glow-target' };
var lastNight = null;                                    // day/night icon state (avoid churn)
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function updateHud() {
  if (!game) return;
  // Pre-game idle state (desktop parity): before a mode is started the HUD shows
  // dashes, not the booted-but-paused sandbox values. Mirrors the desktop blank HUD.
  if (!_started) {
    var ibg = document.getElementById('bgValue');
    if (ibg) { ibg.textContent = '– . –'; ibg.classList.remove('bg-target', 'bg-elevated', 'bg-danger', 'bg-offline'); ibg.classList.add('bg-offline'); }
    var ihero = document.getElementById('cgm-hero');
    if (ihero) { ihero.classList.remove('glow-target', 'glow-elevated', 'glow-danger'); ihero.classList.add('glow-target'); }
    var itr = document.getElementById('bgTrend'); if (itr) { itr.textContent = ''; }
    var iiob = document.getElementById('iob'); if (iiob) iiob.textContent = '0.0';
    var icob = document.getElementById('cob'); if (icob) icob.textContent = '0';
    var iclk = document.getElementById('clock'); if (iclk) iclk.textContent = '00:00';
    var iday = document.getElementById('dayNum'); if (iday) iday.textContent = game.day;
    var dash = '<span class="sfv-num">—</span><span class="stats-frag-unit"></span>';
    var itir = document.getElementById('tir'); if (itir) { itir.innerHTML = dash; itir.style.color = 'var(--text-muted)'; }
    var iavg = document.getElementById('avgBg'); if (iavg) { iavg.innerHTML = dash; iavg.style.color = 'var(--text-muted)'; }
    var ikc = document.getElementById('kcalBal'); if (ikc) { ikc.innerHTML = dash; ikc.style.color = 'var(--text-muted)'; }
    var ipts = document.getElementById('points'); if (ipts) ipts.innerHTML = dash;
    return;
  }
  var bg = game.cgmBG;
  var zone = (typeof getBGZone === 'function') ? getBGZone(bg) : 'target';
  var bgEl = document.getElementById('bgValue');
  bgEl.textContent = (typeof displayBG === 'function') ? displayBG(bg) : bg.toFixed(1);
  // Zone colour via class (desktop parity), not inline style.color.
  bgEl.classList.remove('bg-target', 'bg-elevated', 'bg-danger', 'bg-offline');
  bgEl.classList.add(ZONE_NUM_CLASS[zone] || 'bg-target');
  // BG-hero panel glow follows the same zone (desktop #cgm-hero.glow-*).
  var heroEl = document.getElementById('cgm-hero');
  if (heroEl) {
    heroEl.classList.remove('glow-target', 'glow-elevated', 'glow-danger');
    heroEl.classList.add(ZONE_GLOW_CLASS[zone] || 'glow-target');
  }

  // Samme levende karakterportræt som på desktop. Resolveren i archetypes.js
  // sørger for ens prioritet og hysterese på tværs af de to skærme.
  updateMobileCharacterMood();

  // Trend arrow — rate of change over a 30-min window, averaging the two readings at
  // each end for noise robustness (mirrors desktop updateCgmTrendArrow in js/ui.js).
  // A raw 2-point delta was too jumpy: it flipped ↓↑ on every new reading.
  var trendEl = document.getElementById('bgTrend');
  if (trendEl && cgmDataPoints.length >= 4 && typeof cgmTrendForRate === 'function') {
    var nowT = cgmDataPoints[cgmDataPoints.length - 1].time;
    var tp = cgmDataPoints.filter(function (p) { return p.time >= nowT - 30; });
    if (tp.length >= 4) {
      var n = tp.length;
      var firstVal = (tp[0].value + tp[1].value) / 2, firstTime = (tp[0].time + tp[1].time) / 2;
      var lastVal = (tp[n - 1].value + tp[n - 2].value) / 2, lastTime = (tp[n - 1].time + tp[n - 2].time) / 2;
      var dtMin = lastTime - firstTime;
      if (dtMin > 0) {
        var tr = cgmTrendForRate((lastVal - firstVal) / dtMin);
        if (tr) { trendEl.textContent = tr.arrow; trendEl.style.color = tr.color; }
      }
    }
  }

  document.getElementById('iob').textContent = (game.iob || 0).toFixed(1);
  document.getElementById('cob').textContent = Math.round(game.cob || 0);

  var tod = Math.floor(game.timeInMinutes);              // minutes since midnight
  var hr = Math.floor(tod / 60);
  document.getElementById('clock').textContent = pad2(hr) + ':' + pad2(tod % 60);
  document.getElementById('dayNum').textContent = game.day;
  // Day/night icon (sun/moon) — night is 22:00–07:00, same as the desktop graph.
  var night = (hr >= 22 || hr < 7);
  if (night !== lastNight) {
    lastNight = night;
    var dn = document.getElementById('dnIcon');
    if (dn) dn.setAttribute('src', '../assets/icons/' + (night ? 'moon' : 'sun') + '.svg');
    var dw = document.getElementById('dnWrap');
    if (dw) { dw.classList.toggle('is-night', night); dw.classList.toggle('is-day', !night); }
  }

  // Points: number in .sfv-num + an EMPTY unit column so it lines up under the unit-bearing values.
  document.getElementById('points').innerHTML = '<span class="sfv-num">' + Math.round(game.normoPoints || 0).toLocaleString('da-DK') + '</span><span class="stats-frag-unit"></span>';

  // TIR + average BG from the CGM history (live)
  if (cgmDataPoints.length) {
    var inRange = 0, sum = 0;
    for (var i = 0; i < cgmDataPoints.length; i++) {
      var v = cgmDataPoints[i].value; sum += v;
      if (v >= 4 && v <= 10) inRange++;
    }
    var tirPct = Math.round(100 * inRange / cgmDataPoints.length);
    var tirEl = document.getElementById('tir');
    tirEl.innerHTML = '<span class="sfv-num">' + tirPct + '</span><span class="stats-frag-unit">%</span>';
    // TIR coloured by a published reference threshold (Battelino 2019, same as desktop): >=70%
    // good (green), >=50% borderline (orange), else poor (red) — like the zone-coloured BG.
    tirEl.style.color = tirPct >= 70 ? 'var(--green)' : tirPct >= 50 ? 'var(--orange)' : 'var(--red)';
    var avg = sum / cgmDataPoints.length;
    var avgEl = document.getElementById('avgBg');
    var avgUnit = (typeof bgUnitLabel === 'function') ? bgUnitLabel() : 'mmol/L';
    avgEl.innerHTML = '<span class="sfv-num">' + ((typeof displayBG === 'function') ? displayBG(avg) : avg.toFixed(1)) + '</span><span class="stats-frag-unit">' + avgUnit + '</span>';
    var avgZone = (typeof getBGZone === 'function') ? getBGZone(avg) : 'target';
    avgEl.style.color = ZONE_VAR[avgZone];          // BSgns coloured by zone, like the hero BG
  }

  // kcal balance (net consumed - burned) — drives the weight game-over criterion.
  var nk = (game.totalKcalConsumed || 0) - ((game.totalKcalBurnedBase || 0) + (game.totalKcalBurnedMotion || 0));
  var kEl = document.getElementById('kcalBal');
  if (kEl) {
    kEl.innerHTML = '<span class="sfv-num">' + (nk >= 0 ? '+' : '') + (Math.round(nk / 10) * 10) + '</span><span class="stats-frag-unit">kcal</span>';
    var ak = Math.abs(nk);
    kEl.style.color = ak > 1200 ? 'var(--red)' : ak > 600 ? 'var(--orange)' : 'var(--green)';
  }
  // Hide the kcal row when the energy balance isn't relevant yet (campaign before a
  // minCalories level, e.g. level 1 which focuses on basal + speed) — same shared
  // policy as desktop via shouldShowCalorieBalanceUI() in campaign-core.js.
  var kRow = document.getElementById('kcalRow');
  if (kRow && typeof shouldShowCalorieBalanceUI === 'function') {
    kRow.style.display = shouldShowCalorieBalanceUI() ? '' : 'none';
  }
}

// --- Dynamic y-axis (mirrors desktop updateYAxisScale in js/ui.js) ----------
// The top of the graph grows when BG rises so hyper/DKA values aren't clipped,
// then shrinks back after a delay. Scale-up is immediate; scale-down waits ~5 s
// (hysteresis) so the axis doesn't jitter up/down.
// Floor 11 mmol/L (lower than desktop's 16): on a phone, dropping the top to ~11
// whenever the whole visible window is below target frees vertical space for the
// data, the physiology bands and the event icons. Hard cap 36 (DKA range).
var Y_AXIS_FLOOR = 11, Y_AXIS_HARD_MAX = 36, Y_SHRINK_DELAY_FRAMES = 300; // ~5 s @ 60 fps
var yAxisMax = Y_AXIS_FLOOR, yAxisTarget = Y_AXIS_FLOOR, yShrinkTimer = 0;
function updateYAxisScale(maxCGM) {
  // Needed top = tallest visible value + 2 mmol headroom, rounded up to nearest 2.
  var needed = Math.ceil((maxCGM + 2) / 2) * 2;
  var clamped = Math.max(Y_AXIS_FLOOR, Math.min(Y_AXIS_HARD_MAX, needed));
  if (clamped > yAxisTarget) { yAxisTarget = clamped; yShrinkTimer = 0; }   // scale up now
  else if (maxCGM < yAxisTarget - 3 && yAxisTarget > Y_AXIS_FLOOR) {        // scale down (delayed)
    if (++yShrinkTimer >= Y_SHRINK_DELAY_FRAMES) { yAxisTarget = clamped; yShrinkTimer = 0; }
  } else { yShrinkTimer = 0; }
  var diff = yAxisTarget - yAxisMax;                                        // eased lerp
  if (Math.abs(diff) > 0.05) yAxisMax += diff * 3.0 * 0.016; else yAxisMax = yAxisTarget;
}

// --- Graph event icons (food / insulin / activity / measurements) -----------
// Bitmap icons drawn on the graph at each logged event's time, mirroring the desktop
// graph (js/ui.js). A shared cache avoids re-creating Image objects every frame.
var _gIconCache = {};
function _gIcon(src) {
  // The engine stores repo-root-relative asset paths ("assets/..."); the mobile shell
  // lives in /mobile/, so those need a "../" prefix to resolve.
  var path = (src && src.indexOf('assets/') === 0) ? '../' + src : src;
  if (!_gIconCache[path]) { var im = new Image(); im.src = path; _gIconCache[path] = im; }
  return _gIconCache[path];
}
// Draw an icon with its BOTTOM edge at bottomY, centred on cx.
function _gDrawIcon(ctx, src, cx, bottomY, size) {
  var im = _gIcon(src);
  if (im.complete && im.naturalWidth > 0) ctx.drawImage(im, cx - size / 2, bottomY - size, size, size);
}
// Count-up progress ring around the most recent food / rapid-insulin icon (port of
// desktop _drawGlowRing): fills clockwise over fadeMinutes of sim-time, then fades.
function _gGlowRing(ctx, cx, cy, minutesSince, color, fadeMinutes) {
  if (minutesSince < 0 || minutesSince > fadeMinutes) return;
  var R = 13, W = 2.5, fadeStart = fadeMinutes * 0.8;
  ctx.save();
  ctx.globalAlpha = minutesSince > fadeStart ? 1 - (minutesSince - fadeStart) / (fadeMinutes - fadeStart) : 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = W; ctx.stroke();
  var prog = minutesSince / fadeMinutes;
  if (prog > 0.005) {
    var a0 = -Math.PI / 2, a1 = a0 + prog * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1, false); ctx.strokeStyle = color; ctx.lineWidth = W; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    ctx.shadowBlur = 6; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(cx + R * Math.cos(a1), cy + R * Math.sin(a1), 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// Real-time clock for the night sleep animation (independent of sim speed).
function _perfNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0; }
// zZz bubble pop state: when a night awakening fires the bubbles "pop" for ~0.5 s.
var _zzzPopUntil = 0, _zzzLastWakeT = 0;
// Smoothed anchor BG (exponential moving average, like desktop _smoothBG): without
// it the bubble cluster jumps every time a new (stepped) CGM point lands.
var _zzzSmoothBG = null;
// Awake-window state (desktop parity): while the player is awake at night (inside a
// nightAwakening interval — "lights on") the zZz bubbles stay suppressed; on the
// awake->asleep transition they fade back in over ~5 real seconds, like the desktop
// overlay (ui.js drawSymptomOverlay recoveryFactor). Without this the bubbles popped
// for 0.5 s and then returned immediately, showing "sleep" while the character was up.
var _zzzWasAwake = false, _zzzSleepResumedReal = null;

// --- Diffuse symptom texts (port of desktop ui.js drawSymptomOverlay's text layer) -----
// Drifting, faintly pulsating symptom words in the graph background that surface
// hypo / DKA / hyper / hunger / illness symptoms. Peripheral awareness: the player senses
// "something is off" without a popup — and the tips reference these same symptoms,
// so they must be visible. Mobile already draws the night-sleep "zZz" bubbles separately;
// this only adds the symptom-word layer. Called inside the active chart clip in renderGraph
// (background, behind markers + CGM dots). Same thresholds/phases/colours as desktop.
function drawSymptomTexts(ctx, padL, padT, gW, gH) {
  if (!game) return;
  // Fælles resolver sikrer samme tærskler, overlap og farver som på desktop.
  var symptoms = resolveSymptomState(game).symptoms.map(function (symptom) {
    return {
      text: t(symptom.textKey),
      intensity: symptom.intensity,
      phase: symptom.phase,
      color: symptom.color,
    };
  });
  if (!symptoms.length) return;
  // Drifting, blurred texts (the chart clip is already active in renderGraph).
  var animTime = _perfNow() / 1000;
  ctx.save();
  ctx.font = 'bold 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  symptoms.forEach(function (s) {
    var phaseT = animTime + s.phase * 10;
    var visWave = 0.5 + 0.5 * Math.sin(phaseT * 0.35);
    if (visWave < 0.3) return;
    var visFade = (visWave - 0.3) / 0.7;
    var cx = padL + gW * 0.5 + Math.sin(phaseT * 0.05) * gW * 0.3;
    var cy = padT + gH * (0.20 + 0.12 * (s.phase % 6)) + Math.sin(phaseT * 0.035 + s.phase) * gH * 0.08;
    var alpha = Math.min(0.55, s.intensity * 0.55 * visFade);
    if (alpha < 0.02) return;
    ctx.shadowColor = 'rgba(' + s.color[0] + ',' + s.color[1] + ',' + s.color[2] + ',' + (alpha * 0.8) + ')';
    ctx.shadowBlur = 10 + (1 - s.intensity) * 6;
    ctx.fillStyle = 'rgba(' + s.color[0] + ',' + s.color[1] + ',' + s.color[2] + ',' + (alpha * 0.9) + ')';
    ctx.fillText(s.text, cx, cy);
  });
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.restore();
}

// --- 12h rolling graph (live CGM trail) -------------------------------------
// Styling mirrors desktop drawGraph(): pastel zone gradient, faded 4/10/14
// boundary lines, the 5-6 sweet-spot band, night shading, CGM dots via getBGZone.
function renderGraph() {
  var c = document.getElementById('graph'); if (!c) return;
  var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (r.width === 0) return;
  c.width = r.width * dpr; c.height = r.height * dpr;
  var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  var W = r.width, H = r.height, padL = 42, padR = 10, padT = 12, padB = 32;
  var gW = W - padL - padR, gH = H - padT - padB;
  var now = game ? game.totalSimMinutes : 0;
  var viewW = 720;                                       // 12h window
  var viewStart = Math.max(0, now - 600);                // 10h back, fills then scrolls
  var viewEnd = viewStart + viewW;
  // Dynamic top from the tallest CGM value currently in view.
  var maxCGM = 0;
  for (var mi = 0; mi < cgmDataPoints.length; mi++) {
    var mp = cgmDataPoints[mi];
    if (mp.time >= viewStart && mp.time <= viewEnd && mp.value > maxCGM) maxCGM = mp.value;
  }
  updateYAxisScale(maxCGM);
  var yMax = yAxisMax;
  // Physiology overlay reserves negative space below BG=0 for the DOWNWARD bands
  // (insulin + eISF). The carb band grows upward and the ketone line sits inside the
  // negative zone, so neither adds floor space — mirrors desktop ui.js:650-658.
  var _downwardBands = (showInsulinBand ? 1 : 0) + (showISFLine ? 1 : 0);
  var yMin = _downwardBands > 0 ? -(0.5 + _downwardBands * 1.0) : 0;
  var range = yMax - yMin;
  var Y = function (v) { return padT + gH - ((v - yMin) / range) * gH; };
  var X = function (m) { return padL + ((m - viewStart) / viewW) * gW; };
  x.clearRect(0, 0, W, H);
  x.save(); x.beginPath(); x.roundRect(padL, padT, gW, gH, 12); x.clip();

  // Day/night tint is drawn AFTER the zone gradient (just below) so it is not
  // diluted by the gradient and the day/night contrast stays clear.

  // Vertical pastel zone gradient with soft 0.8 mmol transitions at 14/10/4
  var grad = x.createLinearGradient(0, padT, 0, padT + gH);
  var stop = function (bg) { return 1 - ((bg - yMin) / range); };
  var c01 = function (v) { return Math.max(0, Math.min(1, v)); };
  var pink = 'rgba(255,150,170,0.12)', mint = 'rgba(134,239,172,0.12)',
      amber = 'rgba(253,224,130,0.10)', peach = 'rgba(255,180,170,0.08)', hT = 0.4;
  grad.addColorStop(0, peach);
  grad.addColorStop(c01(stop(14 + hT)), peach); grad.addColorStop(c01(stop(14 - hT)), amber);
  grad.addColorStop(c01(stop(10 + hT)), amber); grad.addColorStop(c01(stop(10 - hT)), mint);
  grad.addColorStop(c01(stop(4 + hT)), mint);   grad.addColorStop(c01(stop(4 - hT)), pink);
  grad.addColorStop(1, pink);
  x.fillStyle = grad; x.fillRect(padL, padT, gW, gH);

  // Day/night tint — drawn ON TOP of the zone gradient so the contrast reads clearly
  // on a small phone screen: night (22:00–07:00) is shaded distinctly darker, day
  // (07:00–22:00) is tinted a touch lighter than the neutral baseline. Per day the
  // 12 h window touches. (Stronger separation than desktop — the small screen needs it.)
  var d0 = Math.floor(viewStart / 1440), d1 = Math.floor(viewEnd / 1440);
  var fillRectMin = function (a, b, fill) {
    var s = Math.max(a, viewStart), e = Math.min(b, viewEnd);
    if (e <= s) return;
    x.fillStyle = fill; x.fillRect(X(s), padT, X(e) - X(s), gH);
  };
  // Motor-ejede vågenintervaller: samme historik bruges af søvntab, portræt,
  // Zzz og nattens lyse felter på både desktop og mobil.
  var awakeIv = [];
  if (game && game.sleepAwakeIntervals) {
    for (var ai = 0; ai < game.sleepAwakeIntervals.length; ai++) {
      var aw = game.sleepAwakeIntervals[ai];
      awakeIv.push([aw.startMin, aw.endMin == null ? game.totalSimMinutes : aw.endMin]);
    }
  }
  // Draw a dark night band [a,b] but cut out the awake intervals (they stay light —
  // "lights on" — revealing the lighter day gradient, like the desktop holes).
  var nightBand = function (a, b) {
    var segs = [[a, b]];
    for (var k = 0; k < awakeIv.length; k++) {
      var w0 = awakeIv[k][0], w1 = awakeIv[k][1], next = [];
      for (var s = 0; s < segs.length; s++) {
        var s0 = segs[s][0], s1 = segs[s][1];
        if (w1 <= s0 || w0 >= s1) { next.push([s0, s1]); continue; }   // no overlap
        if (w0 > s0) next.push([s0, w0]);                              // left remainder
        if (w1 < s1) next.push([w1, s1]);                             // right remainder
      }
      segs = next;
    }
    for (var s2 = 0; s2 < segs.length; s2++) fillRectMin(segs[s2][0], segs[s2][1], 'rgba(10,10,40,0.55)');
  };
  for (var d = d0; d <= d1; d++) {
    var base = d * 1440;
    nightBand(base, base + 420);                                   // 00:00–07:00 night (dark, holes when awake)
    nightBand(base + 1320, base + 1440);                           // 22:00–24:00 night
    fillRectMin(base + 420, base + 1320, 'rgba(255,247,224,0.06)'); // 07:00–22:00 day (light)
  }
  // Warm "lamp on" glow over each awakening, with soft horizontal edges.
  for (var wi = 0; wi < awakeIv.length; wi++) {
    var a0 = Math.max(awakeIv[wi][0], viewStart), a1 = Math.min(awakeIv[wi][1], viewEnd);
    if (a1 <= a0) continue;
    var gx0 = X(a0), gw = X(a1) - gx0;
    if (gw <= 0) continue;
    var fadeW = Math.min(gw * 0.3, 14), f0 = fadeW / gw;
    var glow = x.createLinearGradient(gx0, 0, gx0 + gw, 0);
    glow.addColorStop(0, 'rgba(255,221,150,0)');
    glow.addColorStop(f0, 'rgba(255,221,150,0.16)');
    glow.addColorStop(1 - f0, 'rgba(255,221,150,0.16)');
    glow.addColorStop(1, 'rgba(255,221,150,0)');
    x.fillStyle = glow; x.fillRect(gx0, padT, gw, gH);
  }

  // Solid boundary lines at 4 / 10 / 14 (full width — no horizontal fade, which
  // looked odd as the rolling data travelled across the faded ends).
  [[4, [255, 150, 170], 0.20], [10, [134, 239, 172], 0.18], [14, [253, 224, 130], 0.15]].forEach(function (b) {
    var y = Y(b[0]);
    x.strokeStyle = 'rgba(' + b[1][0] + ',' + b[1][1] + ',' + b[1][2] + ',' + b[2] + ')';
    x.lineWidth = 2; x.beginPath(); x.moveTo(padL, y); x.lineTo(padL + gW, y); x.stroke();
  });

  // Sweet-spot band 5–6 (solid full width)
  x.fillStyle = 'rgba(134,239,172,0.11)';
  x.fillRect(padL, Y(6), gW, Y(5) - Y(6));

  // --- Physiology-view watermark (desktop parity, ui.js 869-887) ----------------
  // Faint rotated stamp reminding the player that scores are not saved while the
  // physiology overlay is on. Drawn behind the data, only during a live run.
  if (_started && isPhysiologyOn()) {
    x.save();
    x.translate(padL + gW / 2, padT + gH / 2);
    x.rotate(-Math.PI / 12);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.06)';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    // Short mobile-only label (the shared ui.physiology.watermark is longer and stays on
    // desktop). Auto-scale the font down so it never overflows the narrow mobile chart.
    var wmText = (typeof t === 'function') ? t('m.physiology.watermark') : 'Fysiologi';
    var wmFs = 28, wmMaxW = gW * 0.86;
    x.font = 'bold ' + wmFs + 'px Inter, sans-serif';
    var wmW = x.measureText(wmText).width;
    if (wmW > wmMaxW) { wmFs = Math.max(12, Math.floor(wmFs * wmMaxW / wmW)); x.font = 'bold ' + wmFs + 'px Inter, sans-serif'; }
    x.fillText(wmText, 0, 0);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.restore();
  }

  // --- Physiology overlay (port of desktop drawGraph bands, ui.js 1262-1615) ----
  // Insulin (basal+rapid), carb absorption, eISF and ketone layers drawn from
  // physiologyDataPoints (fed by the engine's onSample, same array as desktop). The
  // downward bands live in the negative-BG zone reserved above (yMin<0); the carb band
  // grows upward from BG=0. Drawn under the markers + CGM dots. Labels are COLLECTED here
  // and drawn later in the y-axis margin (left of the axis) AFTER the chart clip is
  // released — drawing them at padL-4 inside the clip would crop them.
  // Right boundary is X(now) — bands are never drawn into the future.
  var _physLabels = [];                                       // {txt, color, y} drawn after the clip
  if (_started && (showInsulinBand || showCarbBand || showISFLine || showKetoneLine)
      && game && physiologyDataPoints.length > 2) {
    var nowX = Math.min(X(now), padL + gW);
    var negPx = Y(yMin) - Y(0);                              // negative-zone pixel height
    var bandScale = Math.max(0.3, Math.min(1.0, negPx / 70));
    var phLabel = function (txt, color, ly) { _physLabels.push({ txt: txt, color: color, y: ly }); };
    // Collect visible points (single scalar) extended to [padL, nowX] to avoid edge gaps.
    var phCollect = function (valueFn) {
      var pts = [];
      for (var pi = 0; pi < physiologyDataPoints.length; pi++) {
        var pp = physiologyDataPoints[pi];
        if (pp.time < viewStart || pp.time >= viewEnd) continue;
        pts.push({ x: X(pp.time), v: valueFn(pp) });
      }
      if (pts.length >= 1) {
        if (pts[0].x > padL + 2) pts.unshift({ x: padL, v: pts[0].v });
        if (pts[pts.length - 1].x < nowX - 2) pts.push({ x: nowX, v: pts[pts.length - 1].v });
      }
      return pts;
    };

    // 1) Insulin band: basal (blue) + rapid (teal) stacked DOWNWARD from BG=0.
    if (showInsulinBand) {
      var insMaxH = 28 * bandScale, cY = Y(0);
      var basalBaseline = game.basalPlasmaInsulinBaseline || 75;
      var ke = (game.hovorka && game.hovorka.k_e) || 0.138;
      var tauI = (game.hovorka && game.hovorka.tau_I) || 55;
      var icr = game.ICR || 10;
      var rapidPeakMU = ((50 / icr) * 780) * 0.368 / (tauI * ke);
      var sharedNorm = Math.max(basalBaseline, rapidPeakMU) * 1.3, clipF = 2.0;
      var ip = [];
      for (var ii = 0; ii < physiologyDataPoints.length; ii++) {
        var dp = physiologyDataPoints[ii];
        if (dp.time < viewStart || dp.time >= viewEnd) continue;
        ip.push({ x: X(dp.time), b: dp.basalPlasmaMU != null ? dp.basalPlasmaMU : basalBaseline, r: dp.rapidPlasmaMU != null ? dp.rapidPlasmaMU : 0 });
      }
      if (ip.length >= 1) {
        if (ip[0].x > padL + 2) ip.unshift({ x: padL, b: ip[0].b, r: ip[0].r });
        if (ip[ip.length - 1].x < nowX - 2) ip.push({ x: nowX, b: ip[ip.length - 1].b, r: ip[ip.length - 1].r });
      }
      if (ip.length >= 2) {
        var bH = function (b) { return Math.min(insMaxH * clipF, (b / sharedNorm) * insMaxH); };
        x.beginPath(); x.moveTo(ip[0].x, cY);
        for (var a = 0; a < ip.length; a++) x.lineTo(ip[a].x, cY + bH(ip[a].b));
        x.lineTo(ip[ip.length - 1].x, cY); x.closePath();
        x.fillStyle = 'rgba(96,165,250,0.50)'; x.fill();
        x.beginPath();
        for (var a2 = 0; a2 < ip.length; a2++) { var yb = cY + bH(ip[a2].b); if (a2 === 0) x.moveTo(ip[a2].x, yb); else x.lineTo(ip[a2].x, yb); }
        for (var a3 = ip.length - 1; a3 >= 0; a3--) x.lineTo(ip[a3].x, cY + bH(ip[a3].b) + bH(ip[a3].r));
        x.closePath(); x.fillStyle = 'rgba(94,234,212,0.50)'; x.fill();
        phLabel('Basal', 'rgba(96,165,250,0.85)', cY + insMaxH * 0.35);
        phLabel('Rapid', 'rgba(94,234,212,0.85)', cY + insMaxH * 0.85);
      }
    }

    // 2) Carb absorption band (green) grows UPWARD from BG=0.
    if (showCarbBand) {
      var carbMaxH = 17 * bandScale, ccY = Y(0);
      var cp = phCollect(function (p) { return p.carbAbsorption || 0; });
      if (cp.length >= 2) {
        x.beginPath(); x.moveTo(cp[0].x, ccY);
        for (var b1 = 0; b1 < cp.length; b1++) x.lineTo(cp[b1].x, ccY - (cp[b1].v / 1.0) * carbMaxH);
        x.lineTo(cp[cp.length - 1].x, ccY); x.closePath();
        x.fillStyle = 'rgba(74,222,128,0.50)'; x.fill();
        phLabel('Carbs', 'rgba(74,222,128,0.85)', ccY - carbMaxH * 0.35);
      }
    }

    // 3) eISF line (pink, tanh-normalised, dashed profile reference) in the neg. zone.
    if (showISFLine) {
      var negTop = Y(0), negBot = Y(yMin), negH = Math.max(1, negBot - negTop);
      var isfCY = negTop + negH * (showInsulinBand ? 0.68 : 0.50);
      var isfMaxH = Math.max(6, Math.min(22 * bandScale, negH * (showInsulinBand ? 0.22 : 0.38)));
      var baseISF = game.ISF || 2.0;
      var sp = phCollect(function (p) { return (p.currentISF || baseISF) / baseISF; });
      if (sp.length >= 2) {
        x.save(); x.setLineDash([4, 4]); x.strokeStyle = 'rgba(244,114,182,0.30)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(padL, isfCY); x.lineTo(padL + gW, isfCY); x.stroke(); x.restore();
        x.beginPath(); x.moveTo(sp[0].x, isfCY);
        for (var d1 = 0; d1 < sp.length; d1++) x.lineTo(sp[d1].x, isfCY - isfMaxH * Math.tanh((sp[d1].v - 1.0) * 1.35));
        x.lineTo(sp[sp.length - 1].x, isfCY); x.closePath();
        x.fillStyle = 'rgba(244,114,182,0.35)'; x.fill();
        // Border line (mirrors desktop ui.js) — keeps the eISF trace visible even when
        // eISF == profile ISF (deviation 0 → the filled area collapses onto the centerline).
        x.beginPath();
        for (var d2 = 0; d2 < sp.length; d2++) {
          var ey = isfCY - isfMaxH * Math.tanh((sp[d2].v - 1.0) * 1.35);
          if (d2 === 0) x.moveTo(sp[d2].x, ey); else x.lineTo(sp[d2].x, ey);
        }
        x.strokeStyle = 'rgba(244,114,182,0.50)'; x.lineWidth = 1; x.stroke();
        phLabel('eISF', 'rgba(244,114,182,0.85)', isfCY - isfMaxH * 0.45);
      }
    }

    // 4) Ketone line (violet, dashed 0.5 mmol/L renal-threshold ref) near the bottom.
    if (showKetoneLine) {
      var nT = Y(0), nB = Y(yMin), nH = Math.max(1, nB - nT);
      var kBaseY = nT + nH * 0.94, kMaxH = Math.max(6, Math.min(18 * bandScale, nH * 0.34));
      var kHOf = function (k) { return kMaxH * Math.min(1, Math.max(0, k) / 3.0); };
      var kp = phCollect(function (p) { return p.ketoneLevel || 0; });
      if (kp.length >= 2) {
        x.beginPath(); x.moveTo(kp[0].x, kBaseY);
        for (var e1 = 0; e1 < kp.length; e1++) x.lineTo(kp[e1].x, kBaseY - kHOf(kp[e1].v));
        x.lineTo(kp[kp.length - 1].x, kBaseY); x.closePath();
        x.fillStyle = 'rgba(167,139,250,0.28)'; x.fill();
        // Border line (mirrors desktop ui.js) — keeps the ketone trace visible even at 0
        // (a flat line on the baseline) instead of an invisible zero-height area.
        x.beginPath();
        for (var e2 = 0; e2 < kp.length; e2++) {
          var ky = kBaseY - kHOf(kp[e2].v);
          if (e2 === 0) x.moveTo(kp[e2].x, ky); else x.lineTo(kp[e2].x, ky);
        }
        x.strokeStyle = 'rgba(167,139,250,0.6)'; x.lineWidth = 1; x.stroke();
        x.save(); x.setLineDash([3, 3]); x.strokeStyle = 'rgba(167,139,250,0.30)';
        var thY = kBaseY - kHOf(0.5); x.beginPath(); x.moveTo(padL, thY); x.lineTo(padL + gW, thY); x.stroke(); x.restore();
        phLabel((typeof appSettings !== 'undefined' && appSettings.language === 'en') ? 'Ketone' : 'Keton', 'rgba(167,139,250,0.85)', kBaseY - kMaxH * 0.5);
      }
    }
    x.setLineDash([]);                                        // defensive reset
  }

  // Diffuse symptom texts — background layer (behind markers + CGM dots), clipped to chart.
  if (_started) drawSymptomTexts(x, padL, padT, gW, gH);

  // --- Campaign timeline markers (foresight hints) ------------------------------
  // Port of desktop drawGraph (ui.js 2000-2162): while a campaign level is active the
  // engine exposes upcoming/active events as markers — interval bands (with dashed
  // boundaries) and point markers (dashed line), each with an icon + i18n label. Drawn
  // before the CGM dots so the live curve stays on top. Reuses the local X/Y helpers and
  // chart rect; _gDrawIcon handles image-path icons, emoji are drawn as text. Marker times
  // are sim-minutes (same space as `now`). All label i18n keys already exist (da + en).
  if (_started && typeof campaignEngine !== 'undefined' && campaignEngine && campaignEngine.levelActive
      && typeof campaignEngine.getTimelineMarkers === 'function') {
    var _mks = campaignEngine.getTimelineMarkers(game) || [];
    // When the physiology overlay is on, stop the marker band/lines at the BG=0 line
    // (Y(0)) so they sit ABOVE the physiology bands in the negative zone instead of
    // overlapping them — the event icons themselves already live in the top row.
    var _physOn = showInsulinBand || showCarbBand || showISFLine || showKetoneLine;
    // Push the marker icon/label row DOWN so it clears the level-info button in the graph's
    // top-right corner (markers only draw in campaign, where that button is always shown).
    var MK_INSET = 30;
    var mkTop = padT + 26 + MK_INSET, mkH = _physOn ? Math.max(20, Y(0) - mkTop) : gH - 40 - MK_INSET;  // band spans below the icon row, above the axis (or above the physiology zone)
    var _drawMkIcon = function (icon, syringeColor, cx, size, fontSize) {
      if (icon === '💉') {
        _gDrawIcon(x, syringeColor === 'blue' ? 'assets/icons/app/basal-syringe-clock.png' : 'assets/icons/app/rapid-syringe.png', cx, padT + 8 + size + MK_INSET, size);
      } else if (/\.(png|webp|svg)$/i.test(icon || '')) {
        _gDrawIcon(x, icon, cx, padT + 8 + size + MK_INSET, size);
      } else if (icon) {
        x.textBaseline = 'alphabetic'; x.font = (fontSize || 16) + 'px Arial'; x.fillText(icon, cx, padT + 24 + MK_INSET);
      }
    };
    _mks.forEach(function (m) {
      if (!m) return;
      var iconSize = m.iconSize || 22;
      var labelFont = (m.labelWeight || '400') + ' ' + (m.labelFontSize || 10) + 'px Inter, Segoe UI';
      x.textAlign = 'center';
      if (m.type === 'interval') {
        if (m.endMinutes < viewStart || m.startMinutes >= viewEnd) return;     // cull off-screen
        var xs = X(Math.max(m.startMinutes, viewStart)), xe = X(Math.min(m.endMinutes, viewEnd)), cx = (xs + xe) / 2;
        var past = now - m.endMinutes;
        var a = past <= 0 ? 1 : (m.persistAfterPast ? (m.pastAlpha != null ? m.pastAlpha : 0.55) : Math.max(0, 1 - past / 60));  // fade over 60 sim-min
        if (a <= 0) return;
        x.save(); x.globalAlpha = a;
        x.fillStyle = m.bandColor || 'rgba(59,130,246,0.07)'; x.fillRect(xs, mkTop, xe - xs, mkH);
        x.save(); x.setLineDash([4, 4]); x.strokeStyle = m.lineColor || 'rgba(59,130,246,0.35)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(xs, mkTop); x.lineTo(xs, mkTop + mkH); x.stroke();
        x.beginPath(); x.moveTo(xe, mkTop); x.lineTo(xe, mkTop + mkH); x.stroke(); x.restore();
        _drawMkIcon(m.icon, m.syringeColor, cx, iconSize, m.iconFontSize);
        x.font = labelFont; x.textBaseline = 'middle'; x.fillStyle = m.labelColor || 'rgba(147,197,253,0.9)';
        var ly = m.labelPosition === 'top' ? padT + Math.min(m.labelYOffset || 46, 44) + MK_INSET
               : m.labelPosition === 'middle' ? mkTop + mkH * 0.5
               : Y(m.labelBG != null ? m.labelBG : 0.3);
        x.fillText((typeof t === 'function') ? t(m.labelKey) : m.labelKey, cx, ly);
        x.textBaseline = 'alphabetic'; x.restore();
      } else {                                                    // point marker: 'action' / 'info'
        if (m.timeMinutes < viewStart || m.timeMinutes > viewEnd) return;
        var px = X(m.timeMinutes);
        var past2 = now - m.timeMinutes;
        var a2 = m.persistAfterPast ? (m.pastAlpha != null ? m.pastAlpha : 0.8) : Math.max(0, 1 - past2 / 30);  // fade over 30 sim-min
        if (a2 <= 0) return;
        x.save(); x.globalAlpha = a2;
        x.save(); x.setLineDash([4, 4]); x.strokeStyle = m.type === 'action' ? 'rgba(59,130,246,0.5)' : 'rgba(156,163,175,0.4)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(px, mkTop); x.lineTo(px, Y(0.8)); x.stroke(); x.restore();
        _drawMkIcon(m.icon, m.syringeColor, px, iconSize, m.iconFontSize);
        x.font = labelFont; x.textBaseline = 'middle';
        x.fillStyle = m.labelColor || (m.type === 'action' ? 'rgba(147,197,253,0.9)' : 'rgba(209,213,219,0.7)');
        var ly2 = m.labelPosition === 'top' ? padT + Math.min(m.labelYOffset || 46, 44) + MK_INSET : Y(m.labelBG != null ? m.labelBG : 0.3);
        x.fillText((typeof t === 'function') ? t(m.labelKey) : m.labelKey, px, ly2);
        x.textBaseline = 'alphabetic'; x.restore();
      }
    });
    x.globalAlpha = 1; x.setLineDash([]);                 // defensive reset
  }

  // Live CGM dot trail, coloured via the shared getBGZone() — every visible point
  // is drawn (same as desktop). Fingerprick points are skipped (they get the toast).
  var zoneColor = { danger: '#ef4444', elevated: '#fb923c', target: '#4ade80' };
  for (var i = 0; _started && i < cgmDataPoints.length; i++) {
    var p = cgmDataPoints[i];
    if (p.time < viewStart || p.time > viewEnd || p.type === 'fingerprick') continue;
    var v = p.value, px = X(p.time), py = Y(v), sweet = v >= 5 && v <= 6;
    var zone = (typeof getBGZone === 'function') ? getBGZone(v) : 'target';
    if (sweet) { x.save(); x.shadowColor = 'rgba(134,239,172,0.8)'; x.shadowBlur = 10; }
    x.beginPath(); x.arc(px, py, sweet ? 3.5 : 3, 0, 2 * Math.PI); x.fillStyle = zoneColor[zone] || '#4ade80'; x.fill();
    if (sweet) { x.restore(); }
  }

  // --- Event icons: food / insulin / activity / measurements ------------------
  // Each logged action gets its bitmap icon at its time, a value label, a dashed
  // guide line down to the time axis, an activity duration bar, and a count-up glow
  // ring on the most recent food / rapid-insulin event. Icons stack upward (greedy
  // slot sweep) when several land close together. Mirrors the desktop graph.
  if (_started && game && game.logHistory && game.logHistory.length) {
    var ICON_HALF = 15, SLOT_STEP = 24, MAX_SLOTS = 4, baseIconY = padT + gH - 14;
    var latestFood = -Infinity, latestFast = -Infinity;
    for (var li = 0; li < game.logHistory.length; li++) {
      var lev = game.logHistory[li];
      if (lev.type === 'food' && lev.time > latestFood) latestFood = lev.time;
      else if (lev.type === 'insulin-fast' && lev.time > latestFast) latestFast = lev.time;
    }
    var evItems = [];
    for (var ei = 0; ei < game.logHistory.length; ei++) {
      var e = game.logHistory[ei];
      if (e.type === 'event' || e.type === 'motion-end') continue;
      if (e.time < viewStart || e.time > viewEnd) continue;
      evItems.push({ e: e, ix: X(e.time), slot: 0 });
    }
    evItems.sort(function (a, b) { return a.ix - b.ix; });
    for (var p1 = 0; p1 < evItems.length; p1++) {       // greedy upward slot sweep
      var occ = [];
      for (var p2 = p1 - 1; p2 >= 0; p2--) {
        if (evItems[p1].ix - evItems[p2].ix > ICON_HALF * 2) break;
        occ.push(evItems[p2].slot);
      }
      var sl = 0; while (occ.indexOf(sl) !== -1 && sl < MAX_SLOTS) sl++;
      evItems[p1].slot = Math.min(sl, MAX_SLOTS - 1);
    }
    var nowMin = game.totalSimMinutes;
    x.textAlign = 'center';
    evItems.forEach(function (it) {
      var e = it.e, ix = it.ix, yP = baseIconY - it.slot * SLOT_STEP, d = e.details || {};
      x.save(); x.strokeStyle = 'rgba(190,210,235,0.22)'; x.lineWidth = 1; x.setLineDash([3, 4]);
      x.beginPath(); x.moveTo(ix, yP); x.lineTo(ix, padT + gH); x.stroke(); x.restore();
      if (e.type === 'food') {
        _gDrawIcon(x, d.icon, ix, yP, 32);
        if (e.time === latestFood) _gGlowRing(x, ix, yP - 16, nowMin - e.time, '#e8c87a', 60);
      } else if (e.type === 'insulin-fast' || e.type === 'insulin-basal') {
        var basal = e.type === 'insulin-basal';
        _gDrawIcon(x, basal ? 'assets/icons/app/basal-syringe-clock.png' : 'assets/icons/app/rapid-syringe.png', ix, yP, basal ? 27 : 23);
        x.font = 'bold 11px Inter'; x.fillStyle = basal ? '#3b82f6' : '#2dd4bf';
        x.fillText((d.dose != null ? d.dose : 0).toFixed(basal ? 0 : 1), ix, yP + 11);
        if (!basal && e.time === latestFast) _gGlowRing(x, ix, yP - 14, nowMin - e.time, '#2dd4bf', 60);
      } else if (e.type === 'glucagon') {
        _gDrawIcon(x, 'assets/icons/app/glucagon-pen.png', ix, yP, 26);
        x.font = 'bold 10px Inter'; x.fillStyle = '#f87171'; x.fillText('GLU', ix, yP - 30);
      } else if (e.type === 'ketone-test') {
        _gDrawIcon(x, 'assets/icons/app/ketone-reagent.png', ix, yP, 24);
        x.font = 'bold 10px Inter'; x.fillStyle = '#a78bfa'; x.fillText(d.value != null ? d.value : '', ix, yP - 28);
      } else if (e.type === 'motion') {
        _gDrawIcon(x, d.icon, ix, yP, 28);
        var active = game.activeAktivitet && game.activeAktivitet.startTime === e.time;
        var durMin = (d.duration > 0) ? d.duration : (active ? nowMin - e.time : null);
        var farve = (typeof AKTIVITETSTYPER !== 'undefined' && AKTIVITETSTYPER[d.type]) ? AKTIVITETSTYPER[d.type].farve : '#10b981';
        if (durMin != null && durMin > 0) {
          var xEnd = X(Math.min(viewEnd, e.time + durMin)), barW = Math.max(8, xEnd - ix);
          x.save(); x.fillStyle = farve + (active ? '90' : '70');
          x.beginPath(); x.roundRect(ix - 4, yP + 4, barW + 4, 4, 2); x.fill(); x.restore();
          var dr = Math.round(durMin);
          var durLbl = dr >= 60 ? (Math.floor(dr / 60) + 't' + (dr % 60 > 0 ? (dr % 60) + 'm' : '')) : (dr + 'm');
          x.font = 'bold 10px Inter'; x.fillStyle = 'rgba(200,210,230,0.9)'; x.fillText(durLbl, ix, yP - 30);
        }
      }
    });
  }

  // --- Night zZz sleep bubbles -------------------------------------------------
  // During night (22:00–07:00) soft "zZz" bubbles rise from the current point. They
  // pop (scale out + fade) for ~0.5 s when a night awakening fires — the engine logs
  // those automatically when you intervene at night. Mirrors the desktop sleep overlay.
  var simHour = game ? Math.floor((game.timeInMinutes || 0) / 60) : 12;
  if (game && game.lastNightAwakeningTime && game.lastNightAwakeningTime !== _zzzLastWakeT) {
    _zzzLastWakeT = game.lastNightAwakeningTime;
    _zzzPopUntil = _perfNow() + 500;                 // 0.5 s pop
  }
  if (_started && game && (simHour >= 22 || simHour < 7)) {
    // Ease the anchor toward trueBG so the cluster glides instead of snapping to each
    // new (stepped) CGM reading. trueBG is continuous, so the EMA stays very smooth.
    if (_zzzSmoothBG === null) _zzzSmoothBG = game.trueBG;
    else _zzzSmoothBG += (game.trueBG - _zzzSmoothBG) * 0.05;
    var nowReal = _perfNow(), ax = X(now), ay = Y(_zzzSmoothBG);
    if (ax >= padL && ax <= padL + gW) {
      var popping = nowReal < _zzzPopUntil;
      // Awake-window suppression (desktop parity): if the current sim-minute falls
      // inside a nightAwakening interval the character is up ("lights on"), so the zZz
      // bubbles stay hidden — the pop already played. Reuses awakeIv, the same intervals
      // drawn as night-band holes above. On the awake->asleep edge, start a 5 s real-
      // time fade-in (mirrors desktop drawSymptomOverlay recoveryFactor).
      var awakeNow = typeof game.isNightAwake === 'function'
        ? game.isNightAwake()
        : false;
      if (_zzzWasAwake && !awakeNow) _zzzSleepResumedReal = nowReal;
      _zzzWasAwake = awakeNow;
      var resumeFactor = 1;
      if (_zzzSleepResumedReal !== null) {
        resumeFactor = Math.min(1, (nowReal - _zzzSleepResumedReal) / 5000);   // 5 s fade-in
        if (resumeFactor >= 1) _zzzSleepResumedReal = null;
      }
      if (!awakeNow || popping) {                       // suppressed while awake (unless mid-pop)
        var ZT = ['z', 'zZ', 'Zz', 'zZz', 'z'];
        x.save(); x.textAlign = 'center';
        for (var zi = 0; zi < ZT.length; zi++) {
          var cyc = 15000, fr = ((nowReal + zi * cyc / ZT.length) % cyc) / cyc;  // 0..1 rise progress over 15 s
          var by = ay - 6 - fr * gH * 0.42;
          var bx = ax + (ax > padL + gW / 2 ? -1 : 1) * fr * fr * 18 + Math.sin(fr * 6.28 + zi) * (3 + fr * 9);
          var fs = 11 + fr * 13, alpha = 0.5 * Math.min(1, fr * 4) * Math.min(1, (1 - fr) * 3) * resumeFactor, scale = 1;
          if (popping) { var pp = (_zzzPopUntil - nowReal) / 500; scale = 1 + (1 - pp) * 1.6; alpha = 0.4 * pp; }
          if (alpha <= 0.01) continue;
          x.font = 'italic bold ' + Math.round(fs * scale) + 'px Inter';
          x.shadowColor = 'rgba(200,225,255,' + (alpha * 0.8).toFixed(3) + ')'; x.shadowBlur = 4 + fr * 10;
          x.fillStyle = 'rgba(200,225,255,' + alpha.toFixed(3) + ')';
          x.fillText(ZT[zi], bx, by);
        }
        x.restore();
      }
    }
  }

  // --- PAUSE overlay (port of desktop drawGraph ui.js:906-958) ------------------
  // Dim the plot + a pulsing pause icon and "PAUSE" label, centred. Only while paused
  // and not game over. renderGraph runs every frame (even paused), so the pulse animates.
  if (_started && typeof isPaused !== 'undefined' && isPaused && game && !game.isGameOver) {
    x.save();
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(padL, padT, gW, gH);
    var pulse = 0.55 + 0.40 * (0.5 + 0.5 * Math.cos(((_perfNow() / 1500) % 1) * Math.PI * 2));  // 0.55..0.95, 1.5s cycle
    var cxP = padL + gW / 2, cyP = padT + gH / 2, barW = 12, barH = 50, barGap = 9;
    x.globalAlpha = pulse;
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(cxP - barGap - barW, cyP - barH / 2, barW, barH, 4); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(cxP + barGap, cyP - barH / 2, barW, barH, 4); x.fill(); x.stroke();
    x.font = 'bold 18px Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
    if ('letterSpacing' in x) x.letterSpacing = '4px';
    x.strokeText('PAUSE', cxP, cyP + barH / 2 + 12);
    x.fillText('PAUSE', cxP, cyP + barH / 2 + 12);
    x.restore();
  }

  x.restore();   // end chart clip

  // Physiology band labels — drawn in the y-axis margin (left of the axis), OUTSIDE the
  // chart clip and right-aligned like the y-axis numbers (collected during the band block).
  if (_physLabels.length) {
    x.save(); x.font = 'bold 9px Inter, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
    for (var _pl = 0; _pl < _physLabels.length; _pl++) {
      x.fillStyle = _physLabels[_pl].color;
      x.fillText(_physLabels[_pl].txt, padL - 4, _physLabels[_pl].y);
    }
    x.restore();
  }

  // Current-time marker — two mint-green triangles pointing inward from the top and
  // bottom edges + a soft vertical glow line between the tips (matches desktop drawGraph).
  var nx = X(now);
  if (nx >= padL && nx <= padL + gW) {
    var triH = 10, triW = 8, mint = '134,239,172';
    x.fillStyle = 'rgba(' + mint + ',0.45)';
    x.beginPath(); x.moveTo(nx - triW, padT); x.lineTo(nx + triW, padT); x.lineTo(nx, padT + triH); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(nx - triW, padT + gH); x.lineTo(nx + triW, padT + gH); x.lineTo(nx, padT + gH - triH); x.closePath(); x.fill();
    var lg = x.createLinearGradient(0, padT + triH, 0, padT + gH - triH);
    lg.addColorStop(0, 'rgba(' + mint + ',0)'); lg.addColorStop(0.12, 'rgba(' + mint + ',0.16)');
    lg.addColorStop(0.5, 'rgba(' + mint + ',0.16)'); lg.addColorStop(0.88, 'rgba(' + mint + ',0.16)');
    lg.addColorStop(1, 'rgba(' + mint + ',0)');
    x.strokeStyle = lg; x.lineWidth = 2;
    x.beginPath(); x.moveTo(nx, padT + triH); x.lineTo(nx, padT + gH - triH); x.stroke();
  }

  // Axis labels (outside the clip) — clinical thresholds plus higher ticks that
  // appear only when the axis has scaled up to show them.
  x.fillStyle = 'rgba(196,213,232,0.85)'; x.font = '600 11px Inter'; x.textAlign = 'right';
  [0, 4, 10, 14, 20, 28, 36].forEach(function (v) {
    if (v <= yMax + 0.01) x.fillText((typeof displayBGValue === 'function') ? displayBGValue(v) : v, padL - 6, Y(v) + 4);
  });
  // y-axis unit (rotated, like the desktop graph) — respects the chosen BG unit
  x.save(); x.translate(14, padT + gH / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center';
  x.fillStyle = 'rgba(143,168,200,0.7)'; x.font = '600 9px Inter';
  var yUnit = (typeof bgUnitLabel === 'function') ? bgUnitLabel() : 'mmol/L';
  x.fillText((typeof t === 'function') ? t('graph.yAxisLabel', { unit: yUnit }) : 'Blodsukker (' + yUnit + ')', 0, 0); x.restore();
  // X-axis hour ticks (every 2 h) + a "Tid" caption, mirroring the y-axis unit.
  x.textAlign = 'center'; x.fillStyle = 'rgba(196,213,232,0.85)'; x.font = '600 11px Inter';
  var firstLabel = Math.ceil(viewStart / 120) * 120;
  for (var m = firstLabel; m <= viewEnd; m += 120) {
    x.fillText(pad2(Math.floor((m % 1440) / 60)), X(m), H - 16);
  }
  x.fillStyle = 'rgba(143,168,200,0.7)'; x.font = '600 9px Inter';
  x.fillText(t('m.graph.timeAxis'), padL + gW / 2, H - 3);
}

// #app må aldrig være den scrollende flade. Indhold med egen scrolling, fx
// baneoversigten og panelerne, håndterer selv deres scroll. Chrome kan ellers
// automatisk ændre #app.scrollTop, når en fokuseret overlay-knap fjernes.
function pinAppViewport() {
  var app = document.getElementById('app');
  if (!app) return;
  if (app.scrollTop !== 0) app.scrollTop = 0;
  if (app.scrollLeft !== 0) app.scrollLeft = 0;
}
function pinAppViewportAfterLayout() {
  pinAppViewport();
  requestAnimationFrame(pinAppViewport);
}

// --- Bottom-sheet two-step flow (same for all four actions) -----------------
function openSheet(id) {
  closeSheets();
  if (id === 'food') { toLevel1(id); }        // only Food uses the category sub-step
  if (id === 'activity') { refreshActivityUI(); } // setup vs. active (stop) view
  if (id === 'profile') { openProfileSheet(); }   // fill inputs from the saved profile
  if (id === 'settings') { refreshSoundUI(); }     // reflect current sound state
  if (id === 'highscore') { renderHighscores(); }  // rebuild the list from localStorage
  document.getElementById('scrim').classList.add('open');
  document.getElementById('sheet-' + id).classList.add('open');
  pinAppViewportAfterLayout();
}
function closeSheets() {
  document.getElementById('scrim').classList.remove('open');
  document.querySelectorAll('.sheet').forEach(function (s) { s.classList.remove('open'); });
  pinAppViewportAfterLayout();
}
function toLevel1(id) {
  var s = document.getElementById('sheet-' + id);
  s.querySelectorAll('.level').forEach(function (l) { l.classList.remove('show'); });
  s.querySelector('[data-level1]').classList.add('show');
  var b = s.querySelector('.back'); if (b) { b.style.display = 'none'; }
  s.querySelector('h3').lastChild.textContent = t('m.sheet.' + id);
  if (id === 'food') renderFoodRecents();             // refresh the per-category "recently chosen" strips
}
function toLevel2(id, cat, titleKey) {
  var s = document.getElementById('sheet-' + id);
  s.querySelectorAll('.level').forEach(function (l) { l.classList.remove('show'); });
  var lvl = s.querySelector('[data-level2="' + cat + '"]'); if (lvl) { lvl.classList.add('show'); }
  var b = s.querySelector('.back'); if (b) { b.style.display = 'block'; }
  s.querySelector('h3').lastChild.textContent = t(titleKey);   // titleKey is an i18n key
}

// --- Combined speed control (mirrors the desktop speed-stepper) -------------
// Refresh the stepper's icon/label/classes from the current speed + pause state.
function updateSpeedUI() {
  var stepper = document.getElementById('speedStepper');
  var icon = document.getElementById('spIc');
  var lbl = document.getElementById('spLbl');
  var up = document.getElementById('spUp');
  if (!stepper) return;
  var val = SPEED_VALUES[speedIndex];
  lbl.textContent = isPaused ? t('m.speed.pause') : t('m.speed.' + val);
  up.disabled = (speedIndex >= SPEED_VALUES.length - 1);   // ▶ greyed at top speed
  if (isPaused) {
    icon.innerHTML = '⏸';                             // ⏸ static
    stepper.classList.remove('playing'); stepper.classList.add('paused');
    icon.classList.remove('pulsing'); icon.style.animationDuration = '';
  } else {
    icon.innerHTML = SPEED_ARROWS[val];
    stepper.classList.remove('paused'); stepper.classList.add('playing');
    icon.classList.add('pulsing');                         // pulse rate matches speed
    icon.style.animationDuration = SPEED_PULSE[val] + 's';
  }
}
// ◀/▶ change speed; the leftmost step pauses, ▶ from paused resumes at slowest
// (same behaviour as the desktop stepper so the control feels identical).
function stepSpeed(d) {
  // Den pausede boot-Simulator er kun et tomt UI-underlag. Før en offentlig
  // bane er valgt, åbner play-kontrollerne banevælgeren i stedet for at starte
  // den interne sandbox-instans.
  if (!_started) { isPaused = true; updateSpeedUI(); openLevelSelect(); return; }
  if (d < 0 && speedIndex <= 0) { if (!isPaused) togglePlay(); return; }   // ◀ at slowest → pause
  if (d > 0 && isPaused) { speedIndex = 0; game.simulationSpeed = SPEED_VALUES[0]; togglePlay(); return; }
  var ni = speedIndex + d;
  if (ni < 0 || ni >= SPEED_VALUES.length) return;
  speedIndex = ni; game.simulationSpeed = SPEED_VALUES[speedIndex];
  updateSpeedUI();
}
// Centre button = pause/resume, keeping the current speed. Pre-start routes to
// campaign level selection; free play is not a public mobile mode.
function togglePlay() {
  if (!_started) { isPaused = true; updateSpeedUI(); openLevelSelect(); return; }
  isPaused = !isPaused;
  updateSpeedUI();
}

// Real-time toast lifetime for a tip. The bar is a fixed UI element, so —
// unlike the desktop canvas tips that ride the (scrolling) sim clock — it must clear
// on a real-time timer too, otherwise it hangs while paused or at low sim speed.
var TIP_BAR_AUTO_DISMISS_MS = 12000;
var _tipBarDismissTimer = null;

// Tip bar: fade out then hide. Called by the × and by the auto-dismiss timer.
function dismissTip() {
  if (_tipBarDismissTimer) { clearTimeout(_tipBarDismissTimer); _tipBarDismissTimer = null; }
  var t = document.getElementById('tipBar');
  if (!t) return;
  t.style.opacity = '0';
  setTimeout(function () { t.style.display = 'none'; }, 400);
}

// --- Campaign / global tips -> the tip bar ----------------------------------
// The shared CampaignCore pushes plain message objects onto game.graphMessages
// (the SAME seam the desktop uses; ui.js draws them on canvas there). Mobile
// shows ONE tip at a time — the highest-priority, newest — in the #tipBar
// instead of drawing on the canvas. The bar shows plain neutral observations.
var _tipShownMsgId = null;
function syncTipBar() {
  if (!game || !game.graphMessages) return;
  var bar = document.getElementById('tipBar');
  if (!bar) return;
  var now = game.totalSimMinutes;
  var msgs = game.graphMessages.filter(function (m) {
    return (m.isGameTip || m.isTutorialTip) && (m.expireTime === undefined || m.expireTime > now);
  });

  if (!msgs.length) {
    // The dynamic tip we were showing has expired -> fade it out once. The
    // static welcome tip (no msg id) is left alone.
    if (_tipShownMsgId !== null) { _tipShownMsgId = null; dismissTip(); }
    return;
  }

  // Lower priority number = more urgent; newest wins within the same priority.
  msgs.sort(function (a, b) {
    var pa = a.priority !== undefined ? a.priority : 5;
    var pb = b.priority !== undefined ? b.priority : 5;
    if (pa !== pb) return pa - pb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  var top = msgs[0];
  if (top.id === _tipShownMsgId) return;   // already showing this one — avoid churn
  _tipShownMsgId = top.id;

  var span = bar.querySelector('.txt span');
  if (span) { span.removeAttribute('data-i18n'); span.textContent = top.text; }
  // Restore visibility (dismissTip / the auto-dismiss timer may have hidden it).
  bar.style.display = '';
  bar.style.opacity = '1';

  // Start the real-time auto-dismiss for this freshly shown tip. Sim-time expiry
  // (the filter above) still clears it too; this is the floor so it never hangs.
  if (_tipBarDismissTimer) clearTimeout(_tipBarDismissTimer);
  _tipBarDismissTimer = setTimeout(dismissTip, TIP_BAR_AUTO_DISMISS_MS);
}

// --- Onboarding -------------------------------------------------------------
// A light 3-card first-touch intro (the desktop graph-overlay tour is desktop-only).
// Warm, learning-framed tone for newly-diagnosed players. Shown once; the sim is
// paused behind it so no time passes while reading.
// Card text comes from i18n (m.ob.<n>.title/.body) so it follows the language toggle.
var OB_CARDS = [
  { key: 1 },
  { key: 2 },
  { key: 3 }
];
function getMobileActiveCharacter() {
  if (typeof getActiveCharacter === 'function') return getActiveCharacter();
  var id = 'erik';
  return { id: id, name: id.charAt(0).toUpperCase() + id.slice(1) };
}

// Standardtippet skal handle om den figur, spilleren faktisk styrer. Vi sætter
// teksten efter translateDOM(), fordi almindelige data-i18n-attributter ikke kan
// udfylde den dynamiske {characterName}-variabel på egen hånd. Et aktivt bane-tip
// må aldrig overskrives af denne reservetekst.
function updateMobileWelcomeTipText() {
  if (_tipShownMsgId !== null) return;
  var span = document.querySelector('#tipBar .txt span');
  if (!span) return;
  var character = getMobileActiveCharacter();
  span.setAttribute('data-i18n', 'm.tip.welcome');
  span.textContent = t('m.tip.welcome', { characterName: character.name });
}
function mobileCharacterAsset(character, scene) {
  var fullBodySrc = character && character.fullBody && character.fullBody[scene];
  return {
    src: fullBodySrc ? '../' + fullBodySrc : '../assets/icons/app/character-' + character.id + '.png',
    isFullBody: !!fullBodySrc
  };
}
function setMobileCharacterImage(image, character, scene) {
  if (!image || !character) return;
  var asset = mobileCharacterAsset(character, scene);
  image.src = asset.src;
  image.alt = character.name;
  image.classList.toggle('is-full-body', asset.isFullBody);
}
var obIndex = 0;
function obRender() {
  var c = OB_CARDS[obIndex];
  var character = getMobileActiveCharacter();
  var portrait = document.getElementById('obCharacter');
  setMobileCharacterImage(portrait, character, 'intro');
  document.getElementById('obTitle').textContent = t('m.ob.' + c.key + '.title');
  document.getElementById('obBody').textContent = t('m.ob.' + c.key + '.body');
  document.getElementById('obBtn').textContent = (obIndex === OB_CARDS.length - 1) ? t('m.ob.start') : t('m.ob.next');
  var dots = document.getElementById('obDots'); dots.innerHTML = '';
  for (var i = 0; i < OB_CARDS.length; i++) {
    var d = document.createElement('span'); d.className = 'ob-dot' + (i === obIndex ? ' on' : ''); dots.appendChild(d);
  }
}
function obNext() { if (obIndex < OB_CARDS.length - 1) { obIndex++; obRender(); } else { obFinish(); } }
function obFinish() {
  try { localStorage.setItem('t1dMobileOnboarded', '1'); } catch (e) {}
  document.getElementById('onboarding').classList.remove('open');
  isPaused = false; updateSpeedUI();                 // resume the sim that was paused behind it
}
function maybeShowOnboarding() {
  var seen = false;
  try { seen = localStorage.getItem('t1dMobileOnboarded') === '1'; } catch (e) {}
  if (seen) return;
  obIndex = 0; obRender();
  isPaused = true; updateSpeedUI();                  // hold time while the player reads
  document.getElementById('onboarding').classList.add('open');
}

// --- Start screen (mobile LANDING) ------------------------------------------
// Shown ONCE on load (not re-shown mid-session). Mirrors the desktop welcome +
// mode-selection popup. The sim is PAUSED behind it so no time passes; the overlay
// covers the graph so the paused flat state isn't visible. The two mode cards route:
//   sandbox  -> first-time player: the 3-card onboarding (which pauses+resumes);
//               returning player: just resume the sandbox.
//   campaign -> open the level-select overlay.
// Persist the "show welcome on startup" preference from the landing checkbox.
function _persistShowWelcome() {
  var chk = document.getElementById('startShowWelcome');
  if (chk) { try { localStorage.setItem('t1dMobileShowWelcome', chk.checked ? '1' : '0'); } catch (e) {} }
}
function showStartScreen() {
  // Reflect the saved "show welcome on startup" preference in the checkbox.
  var chk = document.getElementById('startShowWelcome');
  if (chk) { var pref = true; try { pref = localStorage.getItem('t1dMobileShowWelcome') !== '0'; } catch (e) {} chk.checked = pref; }
  isPaused = true; updateSpeedUI();                  // hold time behind the landing
  document.getElementById('startScreen').classList.add('open');
}
function startScreenChoose(mode) {
  _persistShowWelcome();                             // honour the checkbox even when picking a mode
  _withFirstStartDisclaimer(function () { _doStartChoose(mode); });
}
function _doStartChoose(mode) {
  document.getElementById('startScreen').classList.remove('open');
  if (mode === 'campaign') {
    openLevelSelect();                               // -> intro pauses, Start resumes
    return;
  }
  // Sandbox: the game already booted as a sandbox at load. First run shows the
  // 3-card onboarding (it re-pauses + resumes on finish); returning players resume.
  var seen = false;
  try { seen = localStorage.getItem('t1dMobileOnboarded') === '1'; } catch (e) {}
  if (!seen) {
    maybeShowOnboarding();                           // pauses behind it, resumes on finish
  } else {
    isPaused = false; updateSpeedUI();              // resume the sandbox
    lastFrameTime = 0;                               // avoid a big dt jump after the pause
  }
}

// Skip the landing to reach the menus WITHOUT starting anything. The sandbox booted
// paused behind the landing; closing here just reveals that surface (hamburger menu +
// dock) and leaves the sim PAUSED — no game is started. The first-start purpose note is
// therefore NOT shown here; it fires when the player actually picks a mode (and the
// persistent purpose note stays visible in the menu meanwhile).
function closeStartScreen() {
  // Just close the landing — no game starts (desktop parity). The sim stays paused and
  // _started stays false, so the surface shows the empty zone graph + dashed HUD, exactly
  // like the desktop's blank pre-game state. Pick a mode (or press play) to begin.
  _persistShowWelcome();                            // remember the "show on startup" choice
  document.getElementById('startScreen').classList.remove('open');
  isPaused = true; updateSpeedUI();
  updateHud();                                      // paint the idle/dashed HUD right away
}

// --- First-start information about purpose and limits -----------------------
// Shown ONCE, the first time the player leaves the landing into a game (any path).
// Runs the pending start action only after the player accepts. Same wording as the
// menu information (m.disclaimer.*), persisted via t1dMobileDisclaimerSeen.
var _pendingStartAction = null;
function _withFirstStartDisclaimer(proceed) {
  var seen = false;
  try { seen = localStorage.getItem('t1dMobileDisclaimerSeen') === '1'; } catch (e) {}
  if (seen) { proceed(); return; }
  _pendingStartAction = proceed;
  document.getElementById('disclaimerOverlay').classList.add('open');
}
function acceptDisclaimer() {
  try { localStorage.setItem('t1dMobileDisclaimerSeen', '1'); } catch (e) {}
  document.getElementById('disclaimerOverlay').classList.remove('open');
  var fn = _pendingStartAction; _pendingStartAction = null;
  if (typeof fn === 'function') fn();
}

// --- Menu (hamburger) -------------------------------------------------------
// Funnel: get phone users onto the full DESKTOP version. Since they're on a phone,
// the best path is to share the link to themselves (email/messages) and open it on
// a computer. Web Share opens the native share sheet; clipboard is the fallback.
var DESKTOP_URL = 'https://krauhe.github.io/t1d-simulator/';
function shareDesktop() {
  closeSheets();
  var payload = { title: 'T1D Simulator', text: t('m.menu.share.help'), url: DESKTOP_URL };
  if (navigator.share) {
    navigator.share(payload).catch(function () {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(DESKTOP_URL).then(
      function () { showMeasurement(t('m.toast.linkCopied'), 'var(--green)'); },
      function () { showMeasurement(DESKTOP_URL, 'var(--text-secondary)'); }
    );
  } else {
    showMeasurement(DESKTOP_URL, 'var(--text-secondary)');
  }
}

// Switch THIS device to the full desktop version. Records the platform preference so
// the root's auto-redirect (index.html) keeps us on desktop next time, then navigates
// to the parent path. Relative '../' works both locally and under the Pages subpath
// (unlike DESKTOP_URL, which is the absolute production URL used only for sharing).
function switchToDesktop() {
  try { localStorage.setItem('t1d_platform', 'desktop'); } catch (e) {}
  // Target index.html explicitly: '../' resolves to the directory, which a plain local
  // file server renders as a directory listing (only GitHub Pages auto-serves index.html).
  location.href = '../index.html';
}

// Escape a string for safe innerHTML insertion (player name on level cards etc.).
// ui.js has its own escapeHtml but is desktop-only, so the mobile shell needs its own.
function escapeHtmlM(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- Profile editor ---------------------------------------------------------
function clampNum(v, lo, hi, dflt) { v = parseFloat(v); if (isNaN(v)) return dflt; return Math.max(lo, Math.min(hi, v)); }
// Character selector (A4): pick one of the six fixed characters to play, instead of
// typing in weight/ICR/ISF. Mirrors the desktop character picker. The chosen id is
// held here and written to the shared profile on Save.
var _selectedCharacterId = DEFAULT_CHARACTER_ID;

// updateMobileCharacter — refresh the character shown in the BG-hero from the saved
// profile (A4). Full figure + (fixed) name, so the BG panel belongs to the character.
function updateMobileCharacter() {
  var portrait = document.getElementById('cgmCharacterPortrait');
  var nameEl = document.getElementById('cgmCharacterName');
  if (!portrait || !nameEl) return;
  var character = (typeof getActiveCharacter === 'function') ? getActiveCharacter() : null;
  if (!character) { nameEl.textContent = '—'; portrait.style.display = 'none'; return; }
  nameEl.textContent = character.name;
  portrait.dataset.characterId = character.id;
  var rootSrc = (typeof getCharacterMoodPortrait === 'function')
    ? getCharacterMoodPortrait(character, 'neutral')
    : 'assets/icons/app/character-' + character.id + '.png';
  setCharacterPortraitCrossfade(portrait, '../' + rootSrc, 'neutral', character.name, true);
  portrait.style.display = '';
  updateMobileWelcomeTipText();

  // Cache alle karakterens mood-portrætter, så første tilstandsskift ikke giver et tomt
  // billede på langsommere mobilforbindelser.
  if (character.moodPortraits && portrait.dataset.moodsPreloadedFor !== character.id) {
    Object.keys(character.moodPortraits).forEach(function (key) {
      var preload = new Image();
      preload.src = '../' + character.moodPortraits[key];
    });
    portrait.dataset.moodsPreloadedFor = character.id;
  }
}

// Dynamisk BG-hero-portræt. Kun src ændres, når mood ændrer sig; funktionen er
// derfor billig nok til updateHud()-loopet. Karakterer uden mood-assets falder
// tilbage til deres nuværende neutrale ikon.
function updateMobileCharacterMood() {
  var portrait = document.getElementById('cgmCharacterPortrait');
  if (!portrait || !game || typeof resolveCharacterMood !== 'function'
      || typeof getCharacterMoodPortrait !== 'function') return;

  var characterId = portrait.dataset.characterId || getMobileActiveCharacter().id;
  var character = (typeof getCharacter === 'function') ? getCharacter(characterId) : null;
  if (!character) return;

  var previousMood = portrait.dataset.mood || 'neutral';
  var mood = resolveCharacterMood(game, previousMood);
  var src = '../' + getCharacterMoodPortrait(character, mood);
  setCharacterPortraitCrossfade(portrait, src, mood, character.name);
}

function openProfileSheet() {
  // Den fælles helper migrerer gamle profiler og returnerer kun et gyldigt,
  // fast characterId til vælgeren.
  _selectedCharacterId = getSavedCharacterId();
  // Read-only while a game is running (desktop parity): changing the character would
  // restart the run. Editable only when idle (not started) or after game over — the
  // setup window. Locks the cards, hides Reset/Save, shows the notice.
  var ro = _started && game && !game.isGameOver;
  var notice = document.getElementById('pfReadonlyNotice'); if (notice) notice.style.display = ro ? '' : 'none';
  var sub = document.getElementById('pfSub'); if (sub) sub.style.display = ro ? 'none' : '';
  var acts = document.querySelector('#sheet-profile .pf-actions'); if (acts) acts.style.display = ro ? 'none' : '';
  renderArchetypeCards(ro);
}

// Render the character cards (selected one highlighted). Tapping a card selects it
// and refreshes the starting figure. Cards are disabled in read-only mode.
function renderArchetypeCards(readOnly) {
  var box = document.getElementById('pfArchetypeCards');
  if (!box) return;
  var bodyOrder = ['child', 'adult', 'large'];
  box.innerHTML = bodyOrder.map(function (bodyId) {
    var characters = CHARACTERS.filter(function (character) { return character.archetype === bodyId; });
    var groupIsSelected = characters.some(function (character) { return character.id === _selectedCharacterId; });
    var characterButtons = characters.map(function (character) {
      return '<button type="button" class="pf-archetype-card' + (character.id === _selectedCharacterId ? ' selected' : '') + '"'
        + ' data-character-id="' + character.id + '"' + (readOnly ? ' disabled' : '') + '>'
        + '<img class="pf-archetype-icon" src="../assets/icons/app/character-' + character.id + '.png" alt="" onerror="this.style.display=\'none\'">'
        + '<span class="pf-archetype-name">' + character.name + '</span>'
        + '</button>';
    }).join('');
    return '<section class="pf-character-pair' + (groupIsSelected ? ' selected' : '') + '" data-archetype-id="' + bodyId + '">'
      + '<div class="pf-character-pair-title">' + t('archetype.' + bodyId + '.name') + '</div>'
      + '<div class="pf-character-pair-choices">' + characterButtons + '</div>'
      + '</section>';
  }).join('');
  if (!readOnly) {
    box.querySelectorAll('.pf-archetype-card').forEach(function (card) {
      card.addEventListener('click', function () {
        _selectedCharacterId = card.getAttribute('data-character-id');
        renderArchetypeCards(false);
      });
    });
  }
}

function saveProfile() {
  // Gem kun karakter-id'et. De faste modelværdier opløses ved næste motorstart.
  saveCharacterSelection(_selectedCharacterId);
  closeSheets();
  // Opdatér statiske tekster, der viser den valgte karakters navn.
  if (typeof translateDOM === 'function') translateDOM();
  if (typeof updateMobileCharacter === 'function') updateMobileCharacter();
  restartGame();                                   // fresh, paused pre-game state
}


// --- Settings ---------------------------------------------------------------
// Fullscreen: reclaim the browser chrome (the player asked to drop the top bar).
function toggleFullscreen() {
  var el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
  }
}
function syncFullscreenToggle() {
  var t = document.getElementById('fullscreenToggle');
  if (t) t.classList.toggle('active', !!(document.fullscreenElement || document.webkitFullscreenElement));
}
document.addEventListener('fullscreenchange', syncFullscreenToggle);
document.addEventListener('webkitfullscreenchange', syncFullscreenToggle);

// BG unit: drives the shared displayBG()/bgUnitLabel() so the HUD, the graph axis
// and the measurement toast all switch between mmol/L and mg/dL together.
// Sound settings — wired to the shared sounds.js (isMuted / isCgmMuted are its
// top-level lets; toggleCgm/toggleMusic/setMusicVolume are its functions).
function refreshSoundUI() {
  var sfx = document.getElementById('sfxToggleM'); if (sfx) sfx.classList.toggle('active', !appSettings.muted);
  var cgm = document.getElementById('cgmToggleM'); if (cgm) cgm.classList.toggle('active', !appSettings.cgmMuted);
  var mus = document.getElementById('musicToggleM'); if (mus) mus.classList.toggle('active', !appSettings.musicMuted);
  var vol = document.getElementById('musicVolM'); if (vol) vol.value = (appSettings.musicVolume != null ? appSettings.musicVolume : 25);
  var vfx = document.getElementById('vfxToggleM'); if (vfx) vfx.classList.toggle('active', vfxEnabled);
  var phys = document.getElementById('physToggleM'); if (phys) phys.classList.toggle('active', showInsulinBand);
  var tips = document.getElementById('tipsToggleM'); if (tips) tips.classList.toggle('active', (appSettings.levelTipsEnabled !== false) || (appSettings.globalTipsEnabled !== false));
  syncShowWelcomeToggle();
}
// "Show welcome on startup" settings toggle — lets the player re-enable the landing
// after turning it off from the landing checkbox. Persisted in t1dMobileShowWelcome.
function syncShowWelcomeToggle() {
  var t = document.getElementById('showWelcomeToggleM'); if (!t) return;
  var on = true; try { on = localStorage.getItem('t1dMobileShowWelcome') !== '0'; } catch (e) {}
  t.classList.toggle('active', on);
}
function toggleShowWelcomeMobile() {
  var on = true; try { on = localStorage.getItem('t1dMobileShowWelcome') !== '0'; } catch (e) {}
  try { localStorage.setItem('t1dMobileShowWelcome', on ? '0' : '1'); } catch (e) {}
  syncShowWelcomeToggle();
}
// Master tips toggle (mirrors desktop main.js): one switch for ALL tips — level.tips +
// tutorial popups AND the global gameplay/UI hints. Both flags move together; reads as on
// when any tips are enabled. The core (campaign-core.js) gates on both flags via host.getSettings.
function toggleTipsMobile() {
  var currentlyOn = (appSettings.levelTipsEnabled !== false) || (appSettings.globalTipsEnabled !== false);
  var next = !currentlyOn;
  appSettings.levelTipsEnabled = next;
  appSettings.globalTipsEnabled = next;
  if (typeof saveSettings === 'function') saveSettings(appSettings);
  refreshSoundUI();          // updates the #tipsToggleM switch visual
}
// Symptom-VFX toggle (mirrors desktop main.js): persist + apply/reset immediately.
function toggleVfxMobile() {
  vfxEnabled = !vfxEnabled;
  try { localStorage.setItem('vfxEnabled', vfxEnabled); } catch (e) {}
  updateSymptomEffects();    // apply (or clear the filter/vignette) right away
  refreshSoundUI();
}

// --- Physiology overlay toggle ----------------------------------------------
// One switch flips all four band layers together (mirrors desktop's all-or-nothing
// activatePhysiologyMode). The bands themselves are drawn in renderGraph() from
// physiologyDataPoints. Persisted in localStorage; default OFF (advanced/learning view).
var showInsulinBand = false, showCarbBand = false, showISFLine = false, showKetoneLine = false;
(function loadPhysiologyPref() {
  try {
    var on = localStorage.getItem('physiologyEnabled') === 'true';
    showInsulinBand = showCarbBand = showISFLine = showKetoneLine = on;
  } catch (e) {}
})();
function togglePhysiologyMobile() {
  var turningOn = !showInsulinBand;
  // First time it's switched on this run, explain that the score won't be saved
  // (mirrors desktop showPhysiologyConfirmDialog). Already-used or turning off: no dialog.
  if (turningOn && !trainingModeUsedThisSession) {
    showPhysiologyConfirm(function () { _applyPhysiologyMobile(true); });
  } else {
    _applyPhysiologyMobile(!showInsulinBand);
  }
}
function _applyPhysiologyMobile(on) {
  showInsulinBand = showCarbBand = showISFLine = showKetoneLine = on;
  try { localStorage.setItem('physiologyEnabled', on); } catch (e) {}
  // Mark the run as training mode the moment it's enabled during live play (the loop
  // also catches it each tick, e.g. when it was already on at start).
  if (on && _started && game && !game.isGameOver) trainingModeUsedThisSession = true;
  refreshSoundUI();          // updates the #physToggleM switch visual
  syncPhysiologyIndicator(); // top-bar active badge follows the setting
}
// Light the dock physiology toggle amber while the view is enabled (mirrors desktop's
// .physiology-btn.active). The orange state is the "practice mode (score not saved)" cue.
function syncPhysiologyIndicator() {
  var el = document.getElementById('physToggleDock');
  if (el) el.classList.toggle('active', isPhysiologyOn());
}
// Confirm dialog before enabling physiology — same wording as desktop (ui.physiology.confirm.*).
// Built dynamically on the shared .ob-overlay/.ob-card pattern; body contains <br> markup.
// Physiology "score not saved" dialog. onYes = keep/activate physiology; onNo (optional) =
// continue WITHOUT physiology (when omitted the No button just dismisses, e.g. the toggle
// case where declining simply leaves physiology off). titleKey lets the start-of-run warning
// use a context title ("Physiology Mode is active") instead of the activate title.
function showPhysiologyConfirm(onYes, onNo, titleKey) {
  var ov = document.createElement('div');
  ov.className = 'ob-overlay open';
  ov.innerHTML = '<div class="ob-card">' +
    '<h2 class="ob-title">' + t(titleKey || 'ui.physiology.confirm.title') + '</h2>' +
    '<p class="ob-body">' + t('ui.physiology.confirm.body') + '</p>' +
    '<button class="cta green" id="_physYes">' + t('ui.physiology.confirm.yes') + '</button>' +
    '<button class="ob-skip" id="_physNo">' + t('ui.physiology.confirm.no') + '</button>' +
    '</div>';
  document.body.appendChild(ov);
  ov.querySelector('#_physYes').addEventListener('click', function () { document.body.removeChild(ov); onYes(); });
  ov.querySelector('#_physNo').addEventListener('click', function () { document.body.removeChild(ov); if (typeof onNo === 'function') onNo(); });
}
function toggleSfxMobile() {
  isMuted = !isMuted; appSettings.muted = isMuted;
  if (typeof saveSettings === 'function') saveSettings(appSettings);
  if (typeof Tone !== 'undefined' && Tone.Destination) Tone.Destination.mute = isMuted && isCgmMuted;
  refreshSoundUI();
}
function toggleCgmMobile() { if (typeof toggleCgm === 'function') toggleCgm(); refreshSoundUI(); }
function toggleMusicMobile() { if (typeof toggleMusic === 'function') toggleMusic(); refreshSoundUI(); }
function setMusicVolMobile(v) { if (typeof setMusicVolume === 'function') setMusicVolume(parseInt(v)); }

// Clear every saved highscore (the shared t1dSimHighscores keys across all modes).
// Asks for confirmation first; scoped to highscores only — leaves profile + settings
// untouched. The key family is shared with desktop, so this clears both shells' scores.
function clearHighscores() {
  if (!window.confirm(t('m.settings.clearHs.confirm'))) return;
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('t1dSimHighscores') === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) { /* localStorage unavailable */ }
  if (typeof showMeasurement === 'function') showMeasurement(t('m.settings.clearHs.done'), 'var(--green)');
  renderHighscores();   // reflect the cleared list if the Highscore sheet is open
}

// Highscore list (menu -> Highscore). Mobilens offentlige flow tilbyder kampagnen,
// så listen viser ét bedste resultat pr. bane og ingen historisk sandkassefane.
function openHighscores() { openSheet('highscore'); }   // openSheet calls renderHighscores

function renderHighscores() {
  var sub = document.getElementById('hsSub');
  if (sub && typeof t === 'function') sub.textContent = t('m.highscore.subCampaign');
  renderHighscoreCampaign();
}

// Campaign highscore view: one row per scored level (level order, not points-ranked —
// levels differ in difficulty, so per-level best is the meaningful unit, mirroring the
// desktop campaign grid). Shows stars, best points and the record holder's name.
// Reads the live campaign descriptor (bestPoints / bestName / stars per slot).
function renderHighscoreCampaign() {
  var listEl = document.getElementById('hsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  var slots = (campaignEngine && campaignEngine.buildLevelSelectDescriptor)
    ? campaignEngine.buildLevelSelectDescriptor().slots : [];
  var scored = slots.filter(function (s) { return s.exists && s.bestPoints > 0; });
  if (!scored.length) {
    var empty = document.createElement('p');
    empty.className = 'hs-empty';
    empty.textContent = (typeof t === 'function') ? t('highscore.noScores') : 'No scores yet.';
    listEl.appendChild(empty);
    return;
  }
  scored.forEach(function (slot) {
    var row = document.createElement('div');
    row.className = 'hs-row';
    var rank = document.createElement('span');
    rank.className = 'hs-rank';
    rank.textContent = slot.number;                 // level number in the rank cell
    var main = document.createElement('div'); main.className = 'hs-main';
    var line = document.createElement('div'); line.className = 'hs-line';
    var nm = document.createElement('span'); nm.className = 'hs-name';
    nm.textContent = (typeof t === 'function') ? t(slot.titleKey) : slot.titleKey;
    var pts = document.createElement('span'); pts.className = 'hs-pts';
    pts.textContent = slot.bestPoints.toFixed(1);
    line.appendChild(nm); line.appendChild(pts);
    var meta = document.createElement('div'); meta.className = 'hs-meta';
    var stars = ''; for (var s = 1; s <= 3; s++) stars += (s <= slot.stars ? '★' : '☆');
    var starsSpan = document.createElement('span'); starsSpan.className = 'hs-stars'; starsSpan.textContent = stars;
    meta.appendChild(starsSpan);
    if (slot.bestName) meta.appendChild(document.createTextNode('  ·  ' + slot.bestName));
    main.appendChild(line);
    // A4f: tag the record run with the character that achieved it.
    if (slot.bestCharacter) main.appendChild(buildCharTag(slot.bestCharacter));
    main.appendChild(meta);
    row.appendChild(rank); row.appendChild(main);
    listEl.appendChild(row);
  });
}

// buildCharTag — a small "icon + fixed name" chip for the played character, shared by
// the sandbox and campaign leaderboards (A4f). Mirrors the desktop .hs-char-tag.
function buildCharTag(character) {
  var tag = document.createElement('span'); tag.className = 'hs-char-tag';
  var img = document.createElement('img'); img.className = 'hs-char-icon';
  img.src = '../assets/icons/app/character-' + character.id + '.png'; img.alt = '';
  img.onerror = function () { this.style.display = 'none'; };
  tag.appendChild(img);
  tag.appendChild(document.createTextNode(character.name));
  return tag;
}

function setBgUnit(u) {
  appSettings.bgUnit = u;
  document.getElementById('unitMmol').classList.toggle('selected', u === 'mmol');
  document.getElementById('unitMg').classList.toggle('selected', u === 'mg');
  var unitEl = document.querySelector('#cgm-hero .cgm-unit');
  if (unitEl && typeof bgUnitLabel === 'function') unitEl.textContent = bgUnitLabel();
  updateHud();
}

// Language: switch the whole shell between Danish and English. Re-applies the static
// [data-i18n] markup via translateDOM() and re-renders every dynamic string. The
// choice is stored in the shared appSettings (so it carries over to/from desktop).
function setLang(lang) {
  appSettings.language = (lang === 'en') ? 'en' : 'da';
  if (typeof saveSettings === 'function') saveSettings(appSettings);
  if (typeof translateDOM === 'function') translateDOM();
  updateMobileWelcomeTipText();
  refreshLangUI();
  updateSpeedUI();                                 // speed label
  enrichFoodChips();                               // food chip names
  applyCampaignHeader();                           // mode label (sandbox/level) follows the language
  syncLevelInfoBtn();                             // show/hide the campaign level-info button
  refreshInsulinUI();
  if (typeof refreshActivityUI === 'function') refreshActivityUI();   // active-activity label
  var ob = document.getElementById('onboarding');
  if (ob && ob.classList.contains('open')) obRender();               // re-render open onboarding card
  updateHud();
}
function refreshLangUI() {
  var da = document.getElementById('langDa'), en = document.getElementById('langEn');
  var isEn = (appSettings.language === 'en');
  if (da) da.classList.toggle('selected', !isEn);
  if (en) en.classList.toggle('selected', isEn);
}

// --- Game over --------------------------------------------------------------
// The engine's Simulator.gameOver() calls the global showGameOverPopup() (and sets
// isGameOver + isPaused). On the desktop that lives in ui.js; here we render the
// mobile overlay. The selected fictional character remains the visual subject;
// the text explains the simulated outcome without an authority figure.
function showGameOverPopup(cause, details, points) {
  details = details || {};
  var character = getMobileActiveCharacter();
  var portrait = document.getElementById('goCharacter');
  var characterCaption = document.getElementById('goCharacterCaption');
  setMobileCharacterImage(portrait, character, 'concern');
  // Denne generelle popup bruges også i sandkassen. Baneversionen viser selv
  // karakterteksten, mens sandkassen ikke skal ligne en bane-popup.
  if (characterCaption) characterCaption.hidden = true;
  // The engine's localised strings may contain <br> markup, so render as HTML
  // (these are our own i18n strings, never user input).
  document.getElementById('goCause').textContent = cause || '';
  document.getElementById('goCauseDetail').innerHTML = details.cause || '';
  document.getElementById('goPoints').textContent = (points || 0).toFixed(1);
  document.getElementById('goExplain').innerHTML = details.explanation || '';
  var tipsEl = document.getElementById('goTips');
  tipsEl.innerHTML = '';
  (details.tips || []).forEach(function (tp) {
    var li = document.createElement('li'); li.innerHTML = tp; tipsEl.appendChild(li);
  });
  // A4d: the player signs the sandbox score with their OWN name here (separate from the
  // character) — a deliberate Gem, nothing saved until pressed. Mirrors desktop ui.js.
  // The form shows only for a savable sandbox run; campaign-active runs use the campaign
  // result flow, and physiology (training) runs don't write a sandbox highscore.
  var saveForm = document.getElementById('goSaveForm');
  var saveResultEl = document.getElementById('goSaveResult');
  var sigInput = document.getElementById('goSignatureInput');
  var saveBtn = document.getElementById('goSaveBtn');
  var isCampaignRun = !!(campaignEngine && campaignEngine.levelActive);
  if (saveForm) saveForm.hidden = true;
  if (saveResultEl) { saveResultEl.hidden = true; saveResultEl.textContent = ''; }
  if (trainingModeUsedThisSession) {
    // Physiology run — score not saved (desktop parity). Show the note instead of the form.
    if (saveResultEl) { saveResultEl.textContent = t('ui.physiology.scoreNotSaved'); saveResultEl.hidden = false; }
  } else if (!isCampaignRun && saveForm && sigInput && saveBtn && typeof saveHighscore === 'function') {
    // Identify the played character for the leaderboard tag (A4f).
    var playedCharacter = null;
    if (typeof getActiveCharacter === 'function') {
      var ch = getActiveCharacter();
      playedCharacter = { id: ch.id, name: ch.name };
    }
    // Re-arm the reused static form (pre-fill last signature, re-enable input + button).
    sigInput.value = (typeof getPlayerSignature === 'function') ? getPlayerSignature() : '';
    sigInput.disabled = false; saveBtn.disabled = false; saveBtn.textContent = t('game.over.saveBtn');
    saveForm.hidden = false;
    var doSaveGo = function () {
      var typed = (sigInput.value || '').trim();
      if (typeof setPlayerSignature === 'function') setPlayerSignature(typed);
      var finalName = typed || ((typeof t === 'function') ? t('stats.player.anonymous') : 'Anonym');
      var rank = saveHighscore(finalName, points || 0, (game && game.day) || 1, cause || '', 'sandbox', playedCharacter);
      sigInput.disabled = true; saveBtn.disabled = true; saveBtn.textContent = t('game.over.savedBtn');
      if (saveResultEl) { saveResultEl.textContent = rank > 0 ? t('game.over.savedRank', { rank: rank }) : t('game.over.saved'); saveResultEl.hidden = false; }
    };
    // onclick/onkeydown (not addEventListener): the static form is reused across
    // game-overs, so assign — don't stack — the handler.
    saveBtn.onclick = doSaveGo;
    sigInput.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); doSaveGo(); } };
  }
  closeSheets();
  document.getElementById('gameOverOverlay').classList.add('open');
}

// Restart: return to a paused pre-game state. The internal sandbox Simulator is
// only a rendering/bootstrap object; _started=false and the play controls route
// to level selection, so it cannot become a public free-play session.
function restartGame() {
  game = new Simulator(loadSavedProfile(), 'sandbox', {});
  window.game = game;
  cgmDataPoints.length = 0; trueBgPoints.length = 0; physiologyDataPoints.length = 0;
  _started = false;
  isPaused = true;
  speedIndex = 1; game.simulationSpeed = SPEED_VALUES[speedIndex];
  yAxisMax = Y_AXIS_FLOOR; yAxisTarget = Y_AXIS_FLOOR; yShrinkTimer = 0;
  lastFrameTime = 0;
  _tipShownMsgId = null;
  trainingModeUsedThisSession = false;            // fresh run — physiology score-block resets
  _welcomeTipArmed = false; _tipsAllowedAtMs = Infinity;   // re-arm the start-of-run tip hold
  _physStartChecked = false;                              // re-arm the physiology "score not saved" start warning
  // Leave any active campaign level; no replacement mode starts until the player
  // chooses a new level.
  if (campaignEngine) campaignEngine.levelActive = false;
  document.getElementById('fastSlider').value = 4;            // reset custom bolus
  document.getElementById('gameOverOverlay').classList.remove('open');
  document.getElementById('campaignResult').classList.remove('open');
  document.getElementById('campaignIntro').classList.remove('open');
  clearCampaignGating();                                       // drop any leftover disabled state
  applyCampaignHeader();                                       // sandbox label + hide day total
  refreshInsulinUI(); updateSpeedUI(); refreshActivityUI(); syncLevelInfoBtn(); updateMobileCharacter(); updateHud();
}


// =============================================================================
// CAMPAIGN — boot, level select, intro, gating, objectives HUD, result screens
// =============================================================================
// The mobile shell builds its own thin UI on the SHARED CampaignCore. The host
// adapter (mobileHost above) routes the core's emit* calls here. These functions
// MIRROR the desktop adapter (js/campaign.js) in spirit: same gating rules, same
// descriptor consumption, same flow — just rendered with the mobile components.
// =============================================================================

// --- BOOT: start a campaign run (mirrors desktop startGame('campaign'),
// game.js:295-370). Synchronous — no setTimeout needed on mobile. ----------------
function startCampaign() {
  if (!campaignEngine) return;
  // Configure the core for the selected level (resets objectives/events/tips).
  campaignEngine.loadLevel(campaignEngine.currentLevelIndex);

  // Fresh Simulator in campaign mode with the level's physics/config injected
  // (the same {levelConfig} the desktop passes), so the model matches desktop.
  game = new Simulator(loadSavedProfile(), 'campaign', { levelConfig: campaignEngine.levelConfig });
  window.game = game;

  // Reset graph arrays IN PLACE (the engine pushes to these exact references),
  // then seed the start point — same as desktop's cgmDataPoints/trueBgPoints reset.
  cgmDataPoints.length = 0; trueBgPoints.length = 0; physiologyDataPoints.length = 0;
  cgmDataPoints.push({ time: 0, value: game.cgmBG });
  trueBgPoints.push({ time: 0, value: game.trueBG });

  isPaused = false;
  speedIndex = 1; game.simulationSpeed = SPEED_VALUES[speedIndex];
  yAxisMax = Y_AXIS_FLOOR; yAxisTarget = Y_AXIS_FLOOR; yShrinkTimer = 0;
  lastFrameTime = 0;
  _tipShownMsgId = null;
  _welcomeTipArmed = false; _tipsAllowedAtMs = Infinity;   // re-arm the start-of-run tip hold
  _physStartChecked = false;                              // re-arm the physiology "score not saved" start warning

  // Tear down any open menus / overlays from the previous screen.
  closeSheets();
  closeLevelSelect();
  document.getElementById('gameOverOverlay').classList.remove('open');
  document.getElementById('campaignResult').classList.remove('open');

  // Campaign top-bar header (level label + /Y day total) and a refreshed HUD.
  applyCampaignHeader();
  refreshInsulinUI(); updateSpeedUI(); refreshActivityUI(); updateHud();

  // Hand off to the core: emits gating + the intro screen (which pauses the sim).
  campaignEngine.startCampaignLevel();
  syncLevelInfoBtn();
}

// --- TOP-BAR HEADER: campaign shows "Level X" + theme/title and "/Y" day total;
// sandbox keeps the plain label and hides the total. ----------------------------
function applyCampaignHeader() {
  var modeEl = document.getElementById('modeLabel');
  var dayTot = document.getElementById('dayTotal');
  // No mode label before a mode has actually started (the app just opened → blank
  // pre-game state, like desktop where no game exists yet). The label fills in once
  // _started flips true — the loop re-calls this on that transition.
  if (!_started) { modeEl.textContent = ''; if (dayTot) dayTot.style.display = 'none'; return; }
  var inCampaign = !!(game && game.gameMode === 'campaign' && campaignEngine && campaignEngine.levelConfig);
  if (inCampaign) {
    var cfg = campaignEngine.levelConfig;
    // Mode label = "LEVEL X · <title>" (the dt-mode style upper-cases it).
    modeEl.textContent = t('campaign.levelLabel', { n: cfg.number }) + ' · ' + t(cfg.titleKey);
    if (dayTot) {
      var totalDays = Math.round((cfg.durationMinutes || 1440) / 1440);
      dayTot.textContent = '/' + totalDays;
      dayTot.style.display = '';
    }
  } else {
    modeEl.textContent = t('m.mode.sandbox');
    if (dayTot) dayTot.style.display = 'none';
  }
}

// --- LEVEL SELECT --------------------------------------------------------------
// Reads the core state DIRECTLY (getProgress + isLevelUnlocked + buildLevelSelect
// Descriptor) so it can open without depending on an emitScreen round-trip. Builds
// 10 cards mirroring the desktop buildLevelCardsHtml states (unlocked / locked /
// completed-with-stars / under-construction).
function openLevelSelect() {
  if (!campaignEngine) return;
  closeSheets();
  var grid = document.getElementById('lsGrid');
  var slots = campaignEngine.buildLevelSelectDescriptor().slots;
  grid.innerHTML = '';

  slots.forEach(function (slot) {
    var card = document.createElement('button');
    card.className = 'lc';

    if (!slot.exists) {
      // Under construction — number + a glyph, dimmed and non-tappable.
      card.className += ' construction';
      card.disabled = true;
      card.innerHTML =
        '<span class="lc-number">' + t('campaign.levelLabel', { n: slot.number }) + '</span>' +
        '<span class="lc-glyph"><img class="lc-glyph-img" src="../assets/icons/app/level-construction.png" alt=""></span>' +
        '<span class="lc-score">' + t('m.campaign.construction') + '</span>';
    } else if (!slot.unlocked) {
      // Locked — number + lock glyph, dimmed and non-tappable.
      card.className += ' locked';
      card.disabled = true;
      card.innerHTML =
        '<span class="lc-number">' + t('campaign.levelLabel', { n: slot.number }) + '</span>' +
        '<span class="lc-glyph"><img class="lc-glyph-img" src="../assets/icons/app/level-locked.png" alt=""></span>' +
        '<span class="lc-score">' + t('m.campaign.locked') + '</span>';
    } else {
      // Playable — number, title, best stars, best score (if any). Tapping starts it.
      if (slot.completed) card.className += ' completed';
      var starsHtml = '';
      for (var s = 1; s <= 3; s++) {
        starsHtml += '<span class="lc-star ' + (s <= slot.stars ? 'earned' : '') + '">' + (s <= slot.stars ? '★' : '☆') + '</span>';
      }
      card.innerHTML =
        '<span class="lc-number">' + t('campaign.levelLabel', { n: slot.number }) + '</span>' +
        '<span class="lc-title">' + t(slot.titleKey) + '</span>' +
        '<div class="lc-stars">' + starsHtml + '</div>' +
        (slot.bestPoints > 0 ? '<span class="lc-score">' + slot.bestPoints.toFixed(1) + ' pts</span>' : '') +
        // Record holder's name (set on the player's best run) — mirrors the desktop
        // level cards. textContent-safe values come straight from the saved profile name.
        (slot.bestName ? '<span class="lc-name">' + escapeHtmlM(slot.bestName) + '</span>' : '');
      (function (index) {
        card.addEventListener('click', function () {
          closeLevelSelect();
          campaignEngine.startLevel(index);   // -> requestStart -> startCampaign()
        });
      })(slot.index);
    }
    grid.appendChild(card);
  });

  document.getElementById('levelSelect').classList.add('open');
  pinAppViewportAfterLayout();
}
function closeLevelSelect() {
  document.getElementById('levelSelect').classList.remove('open');
  pinAppViewportAfterLayout();
}

// --- INTRO --------------------------------------------------------------------
// The selected fictional character represents the level scenario. The sim is
// PAUSED while shown; Start resumes it.
// Consumes the core's intro descriptor (textVars feeds the dynamic description).
function showCampaignIntro(descriptor) {
  if (!descriptor) return;
  isPaused = true; updateSpeedUI();          // hold time behind the intro

  var introCharacter = getMobileActiveCharacter();
  var introPortrait = document.getElementById('ciCharacter');
  setMobileCharacterImage(introPortrait, introCharacter, 'intro');
  document.getElementById('ciCharacterCaption').textContent =
    t('campaign.playingCharacter', { characterName: introCharacter.name });
  document.getElementById('ciLevel').textContent = t('campaign.levelLabel', { n: descriptor.level.number });
  document.getElementById('ciTitle').textContent = t(descriptor.level.titleKey);
  document.getElementById('ciDesc').innerHTML = t(descriptor.level.descriptionKey, descriptor.textVars || {});

  var list = document.getElementById('ciObjList');
  list.innerHTML = '';
  descriptor.objectives.forEach(function (obj) {
    var li = document.createElement('li');
    if (obj.completed) li.className = 'done';
    li.innerHTML = '<span class="obj-mark">' + (obj.completed ? '✓' : '○') + '</span><span>' + t(obj.descriptionKey, descriptor.textVars || {}) + '</span>';
    list.appendChild(li);
  });

  // Start button label switches to "Return to level" when reopened mid-level.
  document.getElementById('ciStartBtn').textContent = t(descriptor.isReopen ? 'campaign.returnToLevel' : 'campaign.startLevel');

  syncLevelInfoBtn();                          // ensure the level-info button is present to expand from / return to
  var overlay = document.getElementById('campaignIntro');
  overlay.classList.add('open');
  // Expand the card OUT from the level-info button so the intro appears to live there
  // (mirrors desktop's open-from-icon). Failsafe resets styles if transitionend is missed.
  var card = overlay.querySelector('.ci-card');
  var btn = document.getElementById('levelInfoBtn');
  if (card && btn && btn.offsetParent !== null) {
    var cardRect = card.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    var dx = (btnRect.left + btnRect.width / 2) - (cardRect.left + cardRect.width / 2);
    var dy = (btnRect.top + btnRect.height / 2) - (cardRect.top + cardRect.height / 2);
    var startScale = Math.max(0.04, btnRect.width / cardRect.width);
    card.style.transformOrigin = 'center center';
    card.style.transition = 'none';
    card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + startScale + ')';
    card.style.opacity = '0';
    void card.offsetWidth;                     // reflow so the next state animates from here
    card.style.transition = 'transform 0.5s cubic-bezier(0.2,0.7,0.3,1), opacity 0.4s ease-out';
    card.style.transform = 'translate(0,0) scale(1)';
    card.style.opacity = '1';
    var clear = function () { card.style.transition = ''; card.style.transform = ''; card.style.opacity = ''; card.style.transformOrigin = ''; };
    card.addEventListener('transitionend', clear, { once: true });
    setTimeout(clear, 700);
  }
}
function closeCampaignIntro() {
  var overlay = document.getElementById('campaignIntro');
  var card = overlay ? overlay.querySelector('.ci-card') : null;
  var btn = document.getElementById('levelInfoBtn');
  // Resume the sim immediately so the graph runs live behind the collapsing card (and the
  // graph's PAUSE overlay does not flash during the animation).
  isPaused = false; updateSpeedUI();
  lastFrameTime = 0;                          // avoid a big dt jump after the pause
  var finish = function () {
    overlay.classList.remove('open');
    if (card) { card.style.transition = ''; card.style.transform = ''; card.style.opacity = ''; card.style.willChange = ''; card.style.transformOrigin = ''; }
    overlay.style.transition = ''; overlay.style.backgroundColor = '';
  };
  // Fly the card down into the level-info button (mirrors desktop's collapse-to-icon).
  // Slow, deliberate easing so the movement reads. Needs the button visible to measure.
  if (card && btn && btn.offsetParent !== null) {
    var cardRect = card.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    var dx = (btnRect.left + btnRect.width / 2) - (cardRect.left + cardRect.width / 2);
    var dy = (btnRect.top + btnRect.height / 2) - (cardRect.top + cardRect.height / 2);
    var targetScale = Math.max(0.04, btnRect.width / cardRect.width);
    card.style.transformOrigin = 'center center';
    card.style.willChange = 'transform, opacity';
    card.style.transition = 'transform 1.2s cubic-bezier(0.55,0,0.85,0.25), opacity 1.6s ease-in';
    overlay.style.transition = 'background-color 1.4s ease-in';
    void card.offsetWidth;                    // reflow so the transition starts from the current state
    card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + targetScale + ')';
    card.style.opacity = '0';
    overlay.style.backgroundColor = 'transparent';
    var done = false;
    var cleanup = function () { if (done) return; done = true; finish(); };
    card.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 1800);               // failsafe (slightly longer than the longest transition)
  } else {
    finish();
  }
}
// Reopen the intro mid-level (objectives-HUD info button). Mirrors the desktop
// campaign info button: rebuilds the descriptor with isReopen=true.
function reopenLevelIntro() {
  if (!campaignEngine || !campaignEngine.levelConfig) return;
  showCampaignIntro(campaignEngine.buildIntroDescriptor(true));
}

// --- OBJECTIVES HUD -----------------------------------------------------------
// Compact strip above the graph. Lists the active level's objectives with a live
// progress/target or a done check. Hidden in sandbox. Called every tick.
// Show the graph-corner level-info button only while a campaign level is active. The
// objectives themselves are no longer shown as an always-on strip (they overflowed with
// multiple objectives); they live in the intro card, reopened via this button — mirroring
// desktop's campaignInfoBtn + collapse-to-icon flow.
function syncLevelInfoBtn() {
  var btn = document.getElementById('levelInfoBtn');
  if (!btn) return;
  var inCampaign = !!(game && game.gameMode === 'campaign' && campaignEngine && campaignEngine.levelConfig && campaignEngine.levelActive);
  btn.style.display = inCampaign ? 'inline-flex' : 'none';
}

// --- RESULT: complete ---------------------------------------------------------
function showCampaignComplete(descriptor) {
  isPaused = true; updateSpeedUI();
  var card = document.getElementById('campaignResult');
  var completeCharacter = getMobileActiveCharacter();
  var completePortrait = document.getElementById('crCharacter');
  setMobileCharacterImage(
    completePortrait,
    completeCharacter,
    descriptor.stars > 0 ? 'celebrate' : 'concern'
  );
  document.getElementById('crCharacterCaption').textContent =
    t('campaign.playingCharacter', { characterName: completeCharacter.name });
  document.getElementById('crLevel').textContent = t('campaign.levelLabel', { n: descriptor.level.number });
  document.getElementById('crHeadline').textContent = t('m.campaign.complete');
  document.getElementById('crSubtitle').textContent = t(descriptor.level.titleKey);

  document.getElementById('crComplete').classList.add('show');
  document.getElementById('crFailed').classList.remove('show');

  // Stars
  var starsEl = document.getElementById('crStars');
  starsEl.innerHTML = '';
  for (var s = 1; s <= 3; s++) {
    starsEl.innerHTML += '<span class="lc-star ' + (s <= descriptor.stars ? 'earned' : '') + '">' + (s <= descriptor.stars ? '★' : '☆') + '</span>';
  }
  document.getElementById('crTir').textContent = Math.round(descriptor.tir) + '%';
  document.getElementById('crBase').textContent = descriptor.points.toFixed(1);
  document.getElementById('crStarLabel').textContent = '⭐ × ' + descriptor.stars;
  document.getElementById('crBonus').textContent = '+' + descriptor.starBonus.toFixed(1);
  document.getElementById('crTotal').textContent = descriptor.total.toFixed(1);

  // A4d: sign the campaign score. saveLevelResult already stored the existing signature;
  // this lets a campaign-only player type/confirm their name so the grid shows it.
  // Physiology (practice) run: stars/best score were not recorded — show the note instead.
  var crSave = document.getElementById('crSaveResult');
  var crForm = document.getElementById('crSaveForm');
  var crSig = document.getElementById('crSignatureInput');
  var crBtn = document.getElementById('crSaveBtn');
  if (crForm) crForm.hidden = true;
  if (crSave) crSave.hidden = true;
  if (descriptor.scoreBlocked) {
    if (crSave) { crSave.textContent = t('ui.physiology.scoreNotSaved'); crSave.hidden = false; }
  } else if (crForm && crSig && crBtn) {
    // Re-arm the reused static form (pre-fill last signature, re-enable input + button).
    crSig.value = (typeof getPlayerSignature === 'function') ? getPlayerSignature() : '';
    crSig.disabled = false; crBtn.disabled = false; crBtn.textContent = t('game.over.saveBtn');
    crForm.hidden = false;
    var doSaveCr = function () {
      var typed = (crSig.value || '').trim();
      if (typeof setPlayerSignature === 'function') setPlayerSignature(typed);
      if (campaignEngine && campaignEngine.updateBestNameForCurrentLevel) campaignEngine.updateBestNameForCurrentLevel(typed);
      crSig.disabled = true; crBtn.disabled = true; crBtn.textContent = t('game.over.savedBtn');
    };
    crBtn.onclick = doSaveCr;
    crSig.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); doSaveCr(); } };
  }

  // Buttons: Replay, Next (if hasNext), Levels.
  var btns = document.getElementById('crButtons');
  btns.innerHTML = '';
  if (descriptor.hasNext) {
    btns.appendChild(crButton(t('campaign.nextLevel'), 'cr-btn-primary', function () {
      hideCampaignResult();
      campaignEngine.startLevel(campaignEngine.currentLevelIndex + 1);
    }));
  }
  btns.appendChild(crButton(t('campaign.replay'), descriptor.hasNext ? 'cr-btn-secondary' : 'cr-btn-primary', function () {
    hideCampaignResult();
    campaignEngine.retryCurrentLevel();
  }));
  btns.appendChild(crButton(t('m.campaign.levels'), 'cr-btn-secondary', function () {
    hideCampaignResult();
    openLevelSelect();
  }));
  card.classList.add('open');
}

// --- RESULT: failed -----------------------------------------------------------
function showCampaignFailed(descriptor) {
  isPaused = true; updateSpeedUI();
  var card = document.getElementById('campaignResult');
  var failedCharacter = getMobileActiveCharacter();
  var failedPortrait = document.getElementById('crCharacter');
  setMobileCharacterImage(failedPortrait, failedCharacter, 'concern');
  document.getElementById('crCharacterCaption').textContent =
    t('campaign.playingCharacter', { characterName: failedCharacter.name });
  document.getElementById('crLevel').textContent = t('campaign.levelLabel', { n: descriptor.level.number });
  document.getElementById('crHeadline').textContent = t(descriptor.level.titleKey);
  document.getElementById('crSubtitle').textContent = '';

  document.getElementById('crComplete').classList.remove('show');
  document.getElementById('crFailed').classList.add('show');
  var crSaveF = document.getElementById('crSaveResult'); if (crSaveF) crSaveF.hidden = true;  // no score to block on a failed level

  // Missing objectives with progress/target where available.
  var missing = document.getElementById('crMissing');
  missing.innerHTML = '';
  descriptor.missingObjectives.forEach(function (obj) {
    var li = document.createElement('li');
    var prog = (obj.progress !== null && obj.target !== null)
      ? '<span class="obj-prog">' + obj.progress + '/' + obj.target + '</span>' : '';
    li.innerHTML = '<span class="obj-mark">○</span><span>' + t(obj.descriptionKey, descriptor.textVars || {}) + '</span>' + prog;
    missing.appendChild(li);
  });

  // Buttons: Retry, Levels.
  var btns = document.getElementById('crButtons');
  btns.innerHTML = '';
  btns.appendChild(crButton(t('campaign.retry'), 'cr-btn-primary', function () {
    hideCampaignResult();
    campaignEngine.retryCurrentLevel();
  }));
  btns.appendChild(crButton(t('m.campaign.levels'), 'cr-btn-secondary', function () {
    hideCampaignResult();
    openLevelSelect();
  }));
  card.classList.add('open');
}

// --- RESULT: game over (player died mid-level) --------------------------------
// Route through the existing mobile game-over overlay, but use the campaign
// descriptor's title/cause/explanation/tips. In campaign the replay
// button retries the level instead of starting a fresh sandbox.
function showCampaignGameOver(descriptor) {
  var gameOverCharacter = getMobileActiveCharacter();
  var gameOverPortrait = document.getElementById('goCharacter');
  var gameOverCaption = document.getElementById('goCharacterCaption');
  setMobileCharacterImage(gameOverPortrait, gameOverCharacter, 'concern');
  if (gameOverCaption) {
    gameOverCaption.textContent =
      t('campaign.playingCharacter', { characterName: gameOverCharacter.name });
    gameOverCaption.hidden = false;
  }
  document.getElementById('goCause').textContent = descriptor.title || '';
  document.getElementById('goCauseDetail').innerHTML = descriptor.cause || '';
  document.getElementById('goPoints').textContent = Math.round((game && game.normoPoints) || 0).toString();
  document.getElementById('goExplain').innerHTML = descriptor.explanation || '';
  var tipsEl = document.getElementById('goTips');
  tipsEl.innerHTML = '';
  (descriptor.tips || []).forEach(function (tp) {
    var li = document.createElement('li'); li.innerHTML = tp; tipsEl.appendChild(li);
  });
  // Swap the replay button to retry the level (restore to sandbox restart on close).
  var btn = document.querySelector('#gameOverOverlay .cta.green');
  if (btn) btn.setAttribute('onclick', 'campaignRetryFromGameOver()');
  closeSheets();
  document.getElementById('gameOverOverlay').classList.add('open');
}
function campaignRetryFromGameOver() {
  document.getElementById('gameOverOverlay').classList.remove('open');
  // Restore the sandbox restart handler for the next (non-campaign) game over.
  var btn = document.querySelector('#gameOverOverlay .cta.green');
  if (btn) btn.setAttribute('onclick', 'restartGame()');
  if (campaignEngine) campaignEngine.retryCurrentLevel();
}

function hideCampaignResult() {
  document.getElementById('campaignResult').classList.remove('open');
}
// Small helper: build a result-card button with a class + click handler.
function crButton(label, cls, onClick) {
  var b = document.createElement('button');
  b.className = cls; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
// =============================================================================
// CAMPAIGN GATING — consume the core's plain gatingState, apply to dock + sheets
// =============================================================================
// Mirrors desktop desktopApplyDockGating (js/campaign.js) in spirit, mapped to the
// mobile dock/sheets:
//   - dock buttons: disable food/activity/kit per their action flag; insulin only
//     when BOTH fast & basal are off.
//   - insulin sheet: disable the fast / basal sections individually; clamp the fast
//     presets + slider to maxBolusDose.
//   - food sheet: show only chips whose desktop row is in enabledFoodRows (mapped
//     to the mobile categories low/meal/fast — see FOOD_ROW_TO_CATEGORY below).
//   - activity sheet: lock intensity to lockedIntensity.
// When no level is active, clearCampaignGating() removes all of it.
// =============================================================================

// Mobile food categories <-> desktop food rows. The mobile food sheet groups chips
// by data-level2 category (low/meal/fast), which map 1:1 to the desktop row ids:
//   lowCarb     -> 'low'   (egg, nuts, salad, salmon&avocado, eggs&bacon, steak)
//   meals       -> 'meal'  (curry, oatmeal, burger, pasta, pizza, cake)
//   adjustments -> 'fast'  (dextro, candy, juice, cola, banana, chocolate)
// e.g. level 1 enabledFoodRows ['adjustments'] -> only the 'fast' (fast-sugar) chips.
var FOOD_ROW_TO_CATEGORY = { lowCarb: 'low', meals: 'meal', adjustments: 'fast' };

// The food categories the active level currently allows (low/meal/fast), or null when
// no level is gating food. Set by mobileApplyGating, cleared by clearCampaignGating.
// This is the queryable source of truth for both the visual gate (campaign-disabled on
// chips, incl. freshly re-rendered "recently chosen" chips) and the behavioural gate in
// eatFood — so a gated food can never be added regardless of DOM/render timing.
var _campaignAllowedFoodCats = null;

// foodCatAllowed(cat) — true when no food gating is active, or the category is allowed.
function foodCatAllowed(cat) {
  return !_campaignAllowedFoodCats || _campaignAllowedFoodCats.indexOf(cat) !== -1;
}

function mobileApplyGating(gating) {
  if (!gating) { clearCampaignGating(); return; }
  var actions = gating.actions || {};
  var fastAllowed = actions.fastInsulin !== false;
  var basalAllowed = actions.basalInsulin !== false;

  // Dock buttons. Insulin button only disabled when BOTH fast and basal are off.
  setDisabled('.mdock-item.d-food', actions.food === false);
  setDisabled('.mdock-item.d-activity', actions.exercise === false);
  setDisabled('.mdock-item.d-kit', actions.kit === false);
  setDisabled('.mdock-item.d-insulin', !fastAllowed && !basalAllowed);

  // Insulin sheet: fast / basal sections + their labels individually.
  setDisabled('.dp-insulin-basal', !basalAllowed);
  setDisabledAll('.dp-section-label', false);     // reset both labels first
  // Label order in the sheet: [0] = Basal, [1] = Fast.
  var labels = document.querySelectorAll('#sheet-insulin .dp-section-label');
  if (labels[0]) labels[0].classList.toggle('campaign-disabled', !basalAllowed);
  if (labels[1]) labels[1].classList.toggle('campaign-disabled', !fastAllowed);
  setDisabled('.dp-insulin-fast', !fastAllowed);
  setDisabled('.dp-fast-hint', !fastAllowed);
  setDisabled('#sheet-insulin .dp-divider', !fastAllowed && !basalAllowed);

  // Fast-bolus cap: hide/disable presets above maxBolusDose, clamp the slider.
  var maxDose = gating.maxBolusDose;
  var presets = [
    { dose: 0.5, idx: 0 }, { dose: 1, idx: 1 }, { dose: 2, idx: 2 }, { dose: 4, idx: 3 }, { dose: 8, idx: 4 }
  ];
  var fastChips = document.querySelectorAll('#sheet-insulin .insulin-preset-fast');
  presets.forEach(function (p) {
    if (fastChips[p.idx]) fastChips[p.idx].classList.toggle('campaign-disabled', fastAllowed && p.dose > maxDose);
  });
  var fastSlider = document.getElementById('fastSlider');
  if (fastSlider) {
    var effMax = (maxDose < Infinity) ? maxDose : 10;          // default slider max = 10 E
    fastSlider.max = effMax;
    if (parseFloat(fastSlider.value) > effMax) {
      fastSlider.value = effMax;
      var disp = document.getElementById('fastSliderVal');
      if (disp) disp.textContent = parseFloat(effMax).toFixed(1);
    }
  }

  // Food sheet: show only chips whose row is in enabledFoodRows. The category tile
  // is also dimmed when none of its chips are allowed (and the chips themselves are
  // disabled so a deep-linked tap is blocked too).
  var allowedRows = gating.enabledFoodRows;                    // string[] | null
  var allowedCats = allowedRows ? allowedRows.map(function (r) { return FOOD_ROW_TO_CATEGORY[r]; }) : null;
  _campaignAllowedFoodCats = allowedCats;                      // remember for eatFood + recents re-render
  document.querySelectorAll('#sheet-food .level[data-level2]').forEach(function (level) {
    var cat = level.getAttribute('data-level2');
    var disabled = !foodCatAllowed(cat);
    level.querySelectorAll('.chip').forEach(function (chip) {
      chip.classList.toggle('campaign-disabled', disabled);
    });
  });
  // Category tiles (level-1 picker) — dim the ones with no allowed chips.
  var catTiles = document.querySelectorAll('#sheet-food .cat-tile');
  var TILE_CAT = ['low', 'meal', 'fast'];                      // tile order in the markup
  catTiles.forEach(function (tile, i) {
    tile.classList.toggle('campaign-disabled', !foodCatAllowed(TILE_CAT[i]));
  });
  // "Sidste valgte" recent strips (level-1 picker) — these are NOT inside .level[data-
  // level2], so disable them per their category here too. Each strip carries its
  // category in data-recents; a gated strip's chips get campaign-disabled (pointer-
  // events:none) so a recent tap can't bypass the gate.
  document.querySelectorAll('#sheet-food .cat-recents').forEach(function (strip) {
    var disabled = !foodCatAllowed(strip.getAttribute('data-recents'));
    strip.querySelectorAll('.chip').forEach(function (chip) {
      chip.classList.toggle('campaign-disabled', disabled);
    });
  });

  // Activity sheet: lock intensity to lockedIntensity (dim the others, select it).
  var locked = gating.lockedIntensity;                         // 'Lav' | 'Medium' | 'Høj' | null
  var INTENSITY_MAP = { 'Lav': 0, 'Medium': 1, 'Høj': 2 };
  var intensityRow = document.querySelectorAll('#sheet-activity .preset-row')[1];  // [0]=type, [1]=intensity
  if (intensityRow) {
    var chips = intensityRow.querySelectorAll('.chip');
    var values = ['Lav', 'Medium', 'Høj'];
    chips.forEach(function (chip, i) {
      var isLocked = !!locked && values[i] !== locked;
      chip.classList.toggle('campaign-disabled', isLocked);
    });
    if (locked && INTENSITY_MAP[locked] !== undefined) {
      chips.forEach(function (c) { c.classList.remove('sel'); });
      if (chips[INTENSITY_MAP[locked]]) chips[INTENSITY_MAP[locked]].classList.add('sel');
      selectedIntensity = locked;
    }
  }
}

// Remove ALL campaign-disabled state (returning to sandbox or no active level).
function clearCampaignGating() {
  _campaignAllowedFoodCats = null;                              // food gate off
  document.querySelectorAll('.campaign-disabled').forEach(function (el) {
    el.classList.remove('campaign-disabled');
  });
  // Restore the fast slider's default max (gating may have clamped it).
  var fastSlider = document.getElementById('fastSlider');
  if (fastSlider) fastSlider.max = 10;
}

// Small DOM helpers for gating.
function setDisabled(selector, disabled) {
  var el = document.querySelector(selector);
  if (el) el.classList.toggle('campaign-disabled', !!disabled);
}
function setDisabledAll(selector, disabled) {
  document.querySelectorAll(selector).forEach(function (el) {
    el.classList.toggle('campaign-disabled', !!disabled);
  });
}

// --- Player actions wired to the shared Simulator ---------------------------
// All four sheets call into the SAME Simulator methods the desktop uses, so the
// physiology is identical. After an action we close the sheet and refresh the HUD.
function afterAction() { closeSheets(); updateHud(); }

// actionsLive — true only once a mode has actually started (the loop sets _started
// after the first unpaused update). Mirrors the desktop "if (!game || game.isGameOver)
// return" guard at the top of every action: pre-game the dock is clickable and the
// sheets open, but every action no-ops, so poking around never silently mutates the
// paused boot sandbox. The player starts a mode via play (▶) or a mode pick.
function actionsLive() { return _started && game && !game.isGameOver; }

// FOOD — reuse the shared FOODS table (foods.js) for macros/icon/carbType.
function eatFood(key) {
  var f = (typeof FOODS !== 'undefined') ? FOODS[key] : null;
  if (!f || !actionsLive()) return;
  // Campaign gate (the REAL gate, independent of any DOM class): block foods whose
  // category the active level disallows, so no path — recent chip, deep chip or a
  // stale handler — can slip a gated food past the gating.
  if (!_foodCategory) buildFoodCategoryMap();
  if (!foodCatAllowed(_foodCategory[key])) return;
  game.addFood(f.carbs, f.protein, f.fat, f.icon, f.weight, f.carbType, f.eatTimeMin);
  recordFoodRecent(key);                              // remember it for the category's "recently chosen" strip
  afterAction();
}

// --- FOOD "recently chosen" (per category) -----------------------------------
// Each category row shows the up-to-2 most recently eaten items from that category,
// so common picks are one tap away without drilling into the full list. The food's
// category (low/meal/fast) is derived once from the level-2 chip grouping in the
// food sheet (single source of truth = the HTML), and the per-category recents are
// persisted in localStorage so they survive a restart.
var _foodCategory = null;
function buildFoodCategoryMap() {
  _foodCategory = {};
  var sections = document.querySelectorAll('#sheet-food .level[data-level2]');
  for (var i = 0; i < sections.length; i++) {
    var cat = sections[i].getAttribute('data-level2');
    var chips = sections[i].querySelectorAll('.chip[data-food]');
    for (var j = 0; j < chips.length; j++) _foodCategory[chips[j].getAttribute('data-food')] = cat;
  }
}
var FOOD_RECENTS_KEY = 't1dMobileFoodRecents';
function getFoodRecents() {
  try { var r = JSON.parse(localStorage.getItem(FOOD_RECENTS_KEY) || '{}'); return (r && typeof r === 'object') ? r : {}; }
  catch (e) { return {}; }
}
function recordFoodRecent(key) {
  if (!_foodCategory) buildFoodCategoryMap();
  var cat = _foodCategory[key]; if (!cat) return;
  var all = getFoodRecents();
  var list = (all[cat] || []).filter(function (k) { return k !== key; });   // dedup: move to front
  list.unshift(key);
  all[cat] = list.slice(0, 2);                                              // keep the 2 most recent
  try { localStorage.setItem(FOOD_RECENTS_KEY, JSON.stringify(all)); } catch (e) {}
}
// Fill each category row's "recently chosen" strip with up to 2 compact chips (icon +
// name), or a visible dashed empty placeholder when the category has no picks yet.
function renderFoodRecents() {
  if (typeof FOODS === 'undefined') return;
  var all = getFoodRecents();
  var strips = document.querySelectorAll('#sheet-food .cat-recents');
  for (var i = 0; i < strips.length; i++) {
    var strip = strips[i], cat = strip.getAttribute('data-recents');
    var list = all[cat] || [];
    strip.innerHTML = '';
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'cat-recents-empty';
      empty.textContent = t('m.food.recent.empty');
      strip.appendChild(empty);
      continue;
    }
    for (var j = 0; j < list.length; j++) {
      var key = list[j], f = FOODS[key]; if (!f) continue;
      var name = FOOD_I18N[key] ? t(FOOD_I18N[key]) : key;
      var btn = document.createElement('button');
      btn.className = 'chip recent-chip';
      btn.setAttribute('data-food', key);
      // Re-apply the active food gate to this freshly built chip (the strip is rebuilt
      // on every sheet-open, after mobileApplyGating ran) so a gated recent stays muted
      // + non-interactive. eatFood also guards behaviourally as a backstop.
      if (!foodCatAllowed(cat)) btn.classList.add('campaign-disabled');
      btn.onclick = (function (k) { return function () { eatFood(k); }; })(key);
      btn.innerHTML = '<img src="../' + f.icon + '"><div class="nm">' + escapeHtmlM(name) + '</div>';
      strip.appendChild(btn);
    }
  }
}

// Decorate each food chip with the same nutrition info the desktop food buttons
// show: portion weight, a carb/protein/fat macro-bar, the macro grams and kcal.
// Pulled from the shared FOODS table so the figures cannot drift from desktop.
// kcal = 4·carbs + 4·protein + 9·fat (Atwater factors; matches the desktop tooltips).
// data-food (FOODS key) → shared i18n name key (food.*), so chip names follow the
// language toggle. enrichFoodChips() rebuilds the chip, so the name must come from
// here rather than a data-i18n attribute (which the rebuild would drop).
var FOOD_I18N = {
  'æg': 'food.egg', 'nødder': 'food.nuts', 'salat': 'food.salad', 'laksAvocado': 'food.salmonAvocado',
  'ægBacon': 'food.eggsBacon', 'bøfBearnaise': 'food.steakBearnaise', 'bollerIKarry': 'food.curry',
  'havregryn': 'food.cereal', 'burger': 'food.burger', 'pasta': 'food.pasta', 'pizza': 'food.pizza',
  'lagkage': 'food.cake', 'druesukker': 'food.dextro', 'slik': 'food.candy', 'juice': 'food.juice',
  'cola': 'food.cola', 'banan': 'food.banana', 'chokolade': 'food.chocolate'
};
function enrichFoodChips() {
  if (typeof FOODS === 'undefined') return;
  var chips = document.querySelectorAll('.chip[data-food]');
  for (var i = 0; i < chips.length; i++) {
    var chip = chips[i], key = chip.getAttribute('data-food'), f = FOODS[key];
    if (!f) continue;
    var nmEl = chip.querySelector('.nm'), imgEl = chip.querySelector('img');
    var name = FOOD_I18N[key] ? t(FOOD_I18N[key]) : (nmEl ? nmEl.textContent : key);
    var icon = imgEl ? imgEl.getAttribute('src') : f.icon;
    var c = f.carbs || 0, p = f.protein || 0, ft = f.fat || 0;
    var kcal = Math.round(c * 4 + p * 4 + ft * 9);
    var unit = (f.carbType === 'sukker_flydende') ? ' ml' : ' g';   // liquids shown in ml
    chip.innerHTML =
      '<img src="' + icon + '">' +
      '<div class="nm">' + name + '</div>' +
      '<div class="wt">' + f.weight + unit + '</div>' +
      '<div class="macro-bar">' +
        '<span class="mb-carb" style="flex:' + c + '"></span>' +
        '<span class="mb-protein" style="flex:' + p + '"></span>' +
        '<span class="mb-fat" style="flex:' + ft + '"></span>' +
      '</div>' +
      '<div class="macros"><span class="m-c">' + c + '</span><span class="m-p">' + p + '</span><span class="m-f">' + ft + '</span></div>' +
      '<div class="kc">' + kcal + ' kcal</div>';
  }
}

// INSULIN — samme grove basal-kontroller som desktop. Knapper og slider-loft
// udledes af det afrundede karakter-loft i dose-controls.js, så ingen knap viser
// motorens præcise dosis. Det viste interval navngiver den fiktive karakter.
// Hurtiginsulinens knapper er fortsat faste ½/1/2/4/8 E.
function refreshInsulinUI() {
  if (!game) return;
  var presets = getBasalControlPresetDoses(game.basalDose);
  var presetIds = ['bp1', 'bp2', 'bp3', 'bp4', 'bp5'];
  presetIds.forEach(function (id, index) {
    document.getElementById(id).textContent = presets[index];
  });

  var bs = document.getElementById('basalSlider');
  bs.max = getBasalControlCap(game.basalDose);
  bs.value = presets[2];
  document.getElementById('basalSliderVal').textContent = presets[2];
  var fs = document.getElementById('fastSlider');
  document.getElementById('fastSliderVal').textContent = parseFloat(fs.value).toFixed(1);
}
function onBasalSlider() { document.getElementById('basalSliderVal').textContent = document.getElementById('basalSlider').value; }
function onFastSlider() { document.getElementById('fastSliderVal').textContent = parseFloat(document.getElementById('fastSlider').value).toFixed(1); }
function giveBasalPreset(index) {
  if (!actionsLive()) return;
  var dose = getBasalControlPresetDoses(game.basalDose)[index];
  game.addLongInsulin(dose); afterAction();
}
function giveBasalSlider() { if (actionsLive()) { game.addLongInsulin(parseInt(document.getElementById('basalSlider').value)); afterAction(); } }
function giveFast(d) { if (actionsLive()) { game.addFastInsulin(d); afterAction(); } }
function giveFastSlider() { if (actionsLive()) { game.addFastInsulin(parseFloat(document.getElementById('fastSlider').value)); afterAction(); } }

// ACTIVITY — startAktivitet(type, intensitet, varighed). The player picks
// type + intensity, then a duration chip (15/30/60 min or 'open') starts it —
// same flow as the desktop duration-start chips. Open-ended (null duration)
// runs until stopActivity() calls stopAktivitet().
var selectedActivityType = 'cardio', selectedIntensity = 'Medium';
function setActType(type, el) {
  selectedActivityType = type;
  var row = el.parentNode;
  for (var i = 0; i < row.children.length; i++) row.children[i].classList.remove('sel');
  el.classList.add('sel');
}
function setIntensity(v, el) {
  selectedIntensity = v;
  var row = el.parentNode;
  for (var i = 0; i < row.children.length; i++) row.children[i].classList.remove('sel');
  el.classList.add('sel');
}
function startActivity(dur) {
  if (!actionsLive()) return;
  var varighed = (dur === 'open') ? null : dur;       // null → open-ended (stop manually)
  game.startAktivitet(selectedActivityType, selectedIntensity, varighed);
  afterAction();
}
function stopActivity() { if (game) { game.stopAktivitet(); afterAction(); } }

// Toggle the activity sheet between setup (pick + start) and active (stop) views
// based on whether an activity is currently running.
function refreshActivityUI() {
  var active = !!(game && game.activeAktivitet);
  var setup = document.getElementById('activitySetup');
  var act = document.getElementById('activityActive');
  if (setup) setup.style.display = active ? 'none' : 'block';
  if (act) act.style.display = active ? 'block' : 'none';
  if (active) {
    var a = game.activeAktivitet;
    var lbl = document.getElementById('activeActLabel');
    if (lbl) {
      var typeKey = { cardio: 'activity.cardio', styrke: 'activity.strength', blandet: 'activity.mixed' };
      var intKey = { 'Lav': 'activity.intensity.low', 'Medium': 'activity.intensity.medium', 'Høj': 'activity.intensity.high' };
      var iv = a.intensitet || a.intensity || '';
      lbl.textContent = t('m.activity.running', {
        type: typeKey[a.type] ? t(typeKey[a.type]) : (a.type || ''),
        intensity: intKey[iv] ? t(intKey[iv]) : iv
      });
    }
  }
}

// Measurement result toast — shows the measured value, then fades. Also used to
// report the remaining cooldown when a test isn't ready yet.
var _measureTimer = null;
function showMeasurement(text, color) {
  var el = document.getElementById('measureToast'); if (!el) return;
  el.textContent = text; el.style.color = color || 'var(--text-primary)';
  el.classList.add('show');
  clearTimeout(_measureTimer);
  _measureTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}
function fmtMin(m) {
  if (m <= 0) return t('m.kit.ready');
  if (m < 60) return m + ' ' + t('m.unit.min');
  var h = Math.floor(m / 60), mm = m % 60;
  return h + t('m.unit.hour') + (mm ? ' ' + mm + t('m.unit.minShort') : '');
}

// T1D KIT — measurement (with on-graph dot + a centre result toast) + emergency.
// performFingerprick/performKetoneTest are no-ops while on cooldown (3 h / 6 h) and
// push a floatingLabel with the measured value otherwise; we read that to show the
// result, or report the remaining cooldown if nothing was measured.
function kitAction(a) {
  if (!actionsLive()) return;
  if (a === 'finger' || a === 'ketone') {
    var labels = game.floatingLabels || [];
    var before = labels.length;
    if (a === 'finger') game.performFingerprick(); else game.performKetoneTest();
    closeSheets();
    labels = game.floatingLabels || [];
    if (labels.length > before) {
      var lbl = labels[labels.length - 1];
      showMeasurement(lbl.text, lbl.color);
    } else {
      var cd = (a === 'finger')
        ? { used: game.fingerprickUsedTime, total: 180, name: t('m.kit.fingerprick') }
        : { used: game.ketoneTestUsedTime, total: 360, name: t('m.kit.ketone') };
      var remain = Math.ceil(cd.total - (game.totalSimMinutes - cd.used));
      showMeasurement(t('m.kit.cooldown', { name: cd.name, time: fmtMin(remain) }), 'var(--text-muted)');
    }
    updateHud();
    return;
  }
  if (a === 'glucagon') game.useGlucagon();
  else if (a === 'dextrose' && typeof FOODS !== 'undefined') {
    var f = FOODS['druesukker'];
    if (f) game.addFood(f.carbs, f.protein, f.fat, f.icon, f.weight, f.carbType, f.eatTimeMin);
  }
  afterAction();
}

// --- Visual symptom effects (CSS blur / desaturation / vignette) ------------
// Ported verbatim from desktop ui.js updateSymptomEffects(). Episodic blurred-vision
// waves + persistent desaturation + tunnel-vision vignette, driven by trueBG /
// brainEnergyDeficit / acidosisLoad / glucotoxicLoad. The filter is applied to
// #game-view (NOT #app, so action sheets stay sharp) and opacity to #symptom-vignette.
// Gated by vfxEnabled (persisted in localStorage, toggled in Settings).
var vfxEnabled = (function () { try { return localStorage.getItem('vfxEnabled') !== 'false'; } catch (e) { return true; } })();
var _vfxEpisodeActive = false, _vfxEpisodeStart = 0, _vfxEpisodeDuration = 0, _vfxEpisodePeak = 0, _vfxNextEpisodeTime = 0;
var _vfxCurrentBlur = 0, _vfxCurrentSaturation = 1, _vfxCurrentVignette = 0;
var _vfxContainer = null, _vfxVignette = null;
function updateSymptomEffects() {
  // VFX disabled: reset everything
  if (!vfxEnabled) {
    if (_vfxContainer) _vfxContainer.style.filter = '';
    if (_vfxVignette) _vfxVignette.style.opacity = '0';
    _vfxCurrentBlur = 0; _vfxCurrentSaturation = 1; _vfxCurrentVignette = 0; _vfxEpisodeActive = false;
    return;
  }
  if (!_vfxContainer) _vfxContainer = document.getElementById('game-view');
  if (!_vfxVignette) _vfxVignette = document.getElementById('symptom-vignette');
  if (!_vfxContainer) return;

  var now = _perfNow();
  // Fælles VFX-driver holder mobil, desktop og symptomtips synkroniseret.
  var vfxState = resolveSymptomVfxState(game);
  var brainDeficit = vfxState.brainDeficit;
  var BRAIN_THRESHOLD = 8.0;
  var ACIDOSIS_THRESHOLD = game && game.ACIDOSIS_THRESHOLD ? game.ACIDOSIS_THRESHOLD : 600;
  var acidosis = vfxState.acidRatio * ACIDOSIS_THRESHOLD;

  // Severity 0..1 (1 = near game over) from whichever driver is worst.
  var severity = vfxState.severity;
  var isHypoActive = vfxState.hypoActive;
  var isDkaActive = vfxState.ketoneActive;

  var targetBlur = 0, targetSaturation = 1.0, targetVignette = 0;
  if (severity > 0.05) {                                 // min severity avoids weak flicker
    var episodeInterval = 25000 - severity * 19000;      // 25s -> 6s between episodes
    var episodeDuration = 3000 + severity * 3000;        // 3s -> 6s per episode
    var episodePeakBlur = 1.5 + severity * 2.5;          // 1.5px -> 4px peak
    if (!_vfxEpisodeActive && now >= _vfxNextEpisodeTime) {
      _vfxEpisodeActive = true; _vfxEpisodeStart = now; _vfxEpisodeDuration = episodeDuration; _vfxEpisodePeak = episodePeakBlur;
    }
    if (_vfxEpisodeActive) {
      var elapsed = now - _vfxEpisodeStart;
      if (elapsed >= _vfxEpisodeDuration) { _vfxEpisodeActive = false; _vfxNextEpisodeTime = now + episodeInterval; }
      else { var envelope = Math.sin((elapsed / _vfxEpisodeDuration) * Math.PI); targetBlur = envelope * _vfxEpisodePeak; }  // 0->peak->0 arc
    }
    // Persistent (non-episodic) desaturation during hypo / DKA.
    if (isHypoActive) targetSaturation *= (1.0 - severity * 0.25);
    if (isDkaActive) targetSaturation *= (1.0 - Math.min(1.0, acidosis / ACIDOSIS_THRESHOLD) * 0.35);
    // Vignette (tunnel vision): persistent at severe brain deficit / acidosis.
    if (brainDeficit > BRAIN_THRESHOLD * 0.35) targetVignette = Math.min(0.7, ((brainDeficit - BRAIN_THRESHOLD * 0.35) / (BRAIN_THRESHOLD * 0.65)) * 0.7);
    if (acidosis > ACIDOSIS_THRESHOLD * 0.6) targetVignette = Math.max(targetVignette, Math.min(0.5, ((acidosis - ACIDOSIS_THRESHOLD * 0.6) / (ACIDOSIS_THRESHOLD * 0.4)) * 0.5));
  } else {
    _vfxEpisodeActive = false;
  }

  targetBlur = Math.min(targetBlur, 4.0);
  targetSaturation = Math.max(targetSaturation, 0.4);
  targetVignette = Math.min(targetVignette, 0.7);

  // Smooth lerp: fast fade-in, slower fade-out.
  var blurLerp = targetBlur > _vfxCurrentBlur ? 0.08 : 0.04;
  _vfxCurrentBlur += (targetBlur - _vfxCurrentBlur) * blurLerp;
  _vfxCurrentSaturation += (targetSaturation - _vfxCurrentSaturation) * 0.03;
  _vfxCurrentVignette += (targetVignette - _vfxCurrentVignette) * 0.04;

  var hasBlur = _vfxCurrentBlur > 0.08;
  var hasDesat = Math.abs(_vfxCurrentSaturation - 1) > 0.01;
  if (hasBlur || hasDesat) {
    var filterStr = '';
    if (hasBlur) filterStr += 'blur(' + _vfxCurrentBlur.toFixed(1) + 'px) ';
    if (hasDesat) filterStr += 'saturate(' + _vfxCurrentSaturation.toFixed(2) + ')';
    _vfxContainer.style.filter = filterStr.trim();
  } else {
    _vfxContainer.style.filter = '';
  }
  if (_vfxVignette) _vfxVignette.style.opacity = _vfxCurrentVignette > 0.01 ? _vfxCurrentVignette.toFixed(3) : '0';
}

// --- Game loop (rAF, mirrors desktop game.js) -------------------------------
var lastFrameTime = 0;
function loop(now) {
  if (!lastFrameTime) lastFrameTime = now;
  var dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  if (dt < 0) dt = 0; else if (dt > 0.5) dt = 0.5;
  // First unpause of a run with physiology ON: warn that the score won't be saved BEFORE
  // any sim tick runs — so "Continue without physiology" still yields a saveable score
  // (trainingModeUsedThisSession is never set because no tick has run yet). Fires once per
  // run (reset via _physStartChecked in restartGame/startCampaign); both modes. The player
  // already accepts the same dialog when toggling physiology on mid-game, so that path is
  // covered separately — this only catches runs STARTED with physiology already on.
  if (game && !game.isGameOver && !isPaused && !_physStartChecked) {
    _physStartChecked = true;
    if (isPhysiologyOn()) {
      isPaused = true; updateSpeedUI();
      showPhysiologyConfirm(
        function () { isPaused = false; updateSpeedUI(); lastFrameTime = 0; },                                  // keep physiology — score not saved
        function () { _applyPhysiologyMobile(false); isPaused = false; updateSpeedUI(); lastFrameTime = 0; },   // play without physiology — score counts
        'ui.physiology.startWarn.title'
      );
      requestAnimationFrame(loop);
      return;                                   // skip this frame's tick until the player chooses
    }
  }
  if (game && !game.isGameOver && !isPaused) {
    _started = true;                 // first unpaused update = game has begun (desktop-parity gate)
    game.update(dt);
    // Campaign logic (objectives, events, level tips) only ticks while a level
    // is active; global tips (GLOBAL_TIPS) are evaluated in ALL modes — both
    // push messages onto game.graphMessages, which syncTipBar() then renders.
    if (campaignEngine && campaignEngine.levelActive) campaignEngine.update(game);
    if (typeof checkGlobalTipsForAllModes === 'function') checkGlobalTipsForAllModes(game);
    updateHud();
    // Hold all tips for the first TIP_START_DELAY_MS of a run — the player should get a
    // calm start, not a tip the instant a mode begins. Tips that triggered during the
    // hold still surface afterwards (syncTipBar shows the current unexpired one).
    if (now >= _tipsAllowedAtMs) syncTipBar();
    syncLevelInfoBtn();      // show/hide the campaign level-info button (campaign only)
  }
  renderGraph();
  // Pre-game (#app.pre-start while !_started): the dock LOOKS normal and stays clickable
  // so the player can open the sheets and poke around — like the desktop pre-game state.
  // The actions themselves no-op (actionsLive()), so poking never mutates the paused boot
  // sandbox. Only the tip bar is hidden by the class. Cheap no-op when already correct.
  if (!_appEl) _appEl = document.getElementById('app');
  if (_appEl) _appEl.classList.toggle('pre-start', !_started);
  // On the first start of a run: fill in the top-bar mode label, and start the tip hold
  // so NO tip shows for the first TIP_START_DELAY_MS (the player asked not to be greeted
  // by a tip — give them a calm window first). The tip bar is hidden now in case the
  // static HTML default would otherwise show when .pre-start is lifted.
  if (_started && !_welcomeTipArmed) {
    _welcomeTipArmed = true;
    applyCampaignHeader();   // show the mode label (sandbox / LEVEL X) on the first start
    _tipsAllowedAtMs = now + TIP_START_DELAY_MS;
    var _kt = document.getElementById('tipBar'); if (_kt) _kt.style.display = 'none';
  }
  // Physiology training mode: if the overlay is on during a live run, the score won't be
  // saved (set once, sticks for the run; reset in restartGame/startCampaign).
  if (_started && game && !game.isGameOver && isPhysiologyOn()) trainingModeUsedThisSession = true;
  // Visual symptom effects (CSS blur/desaturation/vignette) — every frame for smooth
  // lerp, even when paused (mirrors desktop game.js mainGameLoop).
  updateSymptomEffects();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', renderGraph);
// Start the Web Audio context (and music, if enabled) on the first user gesture —
// mobile autoplay policy blocks audio until then. playSound() also retries via
// _ensureAudioRunning(), so SFX work even before this fires.
function _armMobileAudio() {
  if (typeof Tone !== 'undefined') { try { Tone.start(); } catch (e) {} }
  // Create the <audio> element BEFORE starting it. Desktop does this at init
  // (main.js initMusic()); the mobile shell deferred all audio to the first
  // gesture but forgot initMusic(), so startMusic() was a no-op (_mInitialized
  // false) until the player manually toggled music off/on — which lazily inits.
  if (typeof initMusic === 'function') { try { initMusic(); } catch (e) {} }
  if (typeof startMusic === 'function') { try { startMusic(); } catch (e) {} }
  document.removeEventListener('pointerdown', _armMobileAudio);
}
document.addEventListener('pointerdown', _armMobileAudio);

// NOTE: the landing's open/closed decision is made in an inline <script> right after
// #startScreen in index.html — that runs during parse, BEFORE the render-blocking
// scripts (Tone.js CDN) load, so the welcome never flashes when it is off. Doing it
// here was too late (mobile.js loads last, after the CDN fetch has already painted the
// open overlay). The load handler below only acts on the "show" case.

window.addEventListener('load', function () {
  var appViewport = document.getElementById('app');
  if (appViewport) appViewport.addEventListener('scroll', pinAppViewport);
  pinAppViewportAfterLayout();

  // Language: use the shared setting (carries over from desktop), default Danish.
  if (typeof appSettings !== 'undefined' && appSettings.language !== 'da' && appSettings.language !== 'en') appSettings.language = 'da';
  if (typeof translateDOM === 'function') translateDOM();   // translate all [data-i18n] markup
  updateSpeedUI();                                // arrows + pulse from the start speed
  // Mode label + day total reflect the actual game mode (sandbox at load).
  applyCampaignHeader();
  refreshInsulinUI();
  enrichFoodChips();                              // fill food chips with FOODS nutrition info
  refreshLangUI();                                 // reflect current language in the toggle
  syncPhysiologyIndicator();                       // top-bar badge reflects the saved physiology pref
  updateMobileCharacter();                          // BG-hero shows the current/last character
  updateHud();
  // The landing's open/closed state was already decided synchronously above
  // (decideLandingVisibility). When it should show, run showStartScreen() now so the
  // sim is held paused behind it; when it is off it was already closed (no flash) and
  // the sim stays paused / _started false — the desktop-parity blank state.
  var _showWelcome = true;
  try { _showWelcome = localStorage.getItem('t1dMobileShowWelcome') !== '0'; } catch (e) {}
  if (_showWelcome) showStartScreen();             // mobile LANDING (sim paused behind it)
  // (welcome tip is not shown until a game starts — see _welcomeTipArmed in the loop)
});
requestAnimationFrame(loop);
