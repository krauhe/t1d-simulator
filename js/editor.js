// =============================================================================
// EDITOR.JS — karakterbundet Insights-visning af et spillet forløb
// =============================================================================
//
// A static blood-sugar curve editor delivered as a MODE inside the game (mode
// key 'editor'). Unlike the real-time game it has no "now": you place food /
// insulin / activity events on a 24/48/72 h timeline and the physiology engine
// recomputes the WHOLE curve on every edit. Drag a marker to move it in time,
// hover the curve to inspect the physiology at any minute, read a whole-period
// summary (time-in-range, mean, min/max).
//
// HOW IT REUSES THE GAME (no re-authoring of UI):
//   - It runs inside the real index.html: the same top-bar, graph canvas, dock
//     panels (foods, custom builder, insulin doses, activity setup, kit),
//     profile popup, BG-forces panel and glass styling are reused verbatim.
//   - The dock action buttons ("Spis" / "Giv insulin" / "Vælg aktivitet") call
//     game.addFood() / game.addFastInsulin() / game.startAktivitet() etc. In
//     editor mode `game` is a small EDITOR FACADE (this file): those same calls
//     place an event at the cursor time instead of injecting "now". So the dock
//     works unchanged — zero edits to the ~12 dock handlers.
//   - drawGraph() in ui.js delegates to Editor.draw() while in editor mode, so
//     every render path (resize, band toggles, …) renders the editor safely.
//
// MODEL LAYER ONLY: like the game, the editor talks to the physiology engine
// (js/physiology-engine.js) + foods (js/foods.js) + AKTIVITETSTYPER. It does NOT
// construct a real Simulator and never starts mainGameLoop (it is static).
//
// DETERMINISM (the reason for a dedicated engine config): the editor recomputes
// the whole curve on every edit, so any per-injection / per-day RNG would make a
// drag re-roll physiology — moving a bolus one minute would re-draw its
// absorption tau and jump the curve ~1.7 mmol/L (not physiologically plausible).
// The engine's S9.10/S9.12 module scalars turn that randomness OFF: with
// insulinVariability:0 the bolus tau is fixed (no gaussRand), dawnVariability:0
// fixes the dawn each day. sleepDisruption stays ON (1): acting at night must wake
// the simulated character and cost sleep, exactly like the game — but the engine uses a FIXED
// sleep loss when noiseEnabled is false (no gaussRand), so it is deterministic and
// drag-stable. All other physiology (dawn, stress, ketones, fat/protein, FFA) is
// ON, so the curve responds only to the user's actions and their timing (incl.
// night). (Future: show the variability as an uncertainty "cloud".)
// =============================================================================

const Editor = (function () {
  "use strict";

  // ---- determinism config -------------------------------------------------
  // Fixed seed + noise off + the three RNG modules scaled to 0. Numbers (not
  // booleans) match the S9.12 intensity-scalar API; the engine also coerces
  // false→0, but 0 is the explicit modern form.
  const SEED = 20260616;
  const EDITOR_MODULES = {
    insulinVariability: 0,   // nominal bolus tau + basal duration (no per-injection RNG)
    dawnVariability: 0,      // same dawn amplitude/peak every day (no per-day RNG)
    sleepDisruption: 1       // night actions wake the character (sleep cost); the loss is
                             // FIXED (1.0 h, no gaussRand) because noiseEnabled is false
  };

  const MAX_VIEW_MIN = 1440; // grafen viser højst 24 timer ad gangen
  const FUTURE_MIN = 360;    // Insights fremskriver præcis 6 timer efter spillets pause
  const Y_AXIS_SHRINK_DELAY_MS = 10000; // behold den store skala 10 sekunder efter sidste ændring
  const Y_AXIS_SHRINK_RATE = 0.6;       // reducer derefter højst 0,6 mmol/L pr. sekund

  // ---- state --------------------------------------------------------------
  // Profilen må kun komme fra en af projektets seks faste karakterer. Den rå
  // profil er intern modeltilstand og kan ikke vælges eller importeres i Insights.
  let characterId = (typeof DEFAULT_CHARACTER_ID !== 'undefined') ? DEFAULT_CHARACTER_ID : 'erik';
  let profile = { weight: 70, isf: 3.0, icr: 10 };
  let engine = null;
  let events = [];
  let frames = [];
  // Referencekurven fryses ved åbning. Den ændres ikke, når spilleren flytter,
  // tilføjer eller sletter handlinger, og kan derfor bruges som ærlig sammenligning.
  let sourceEvents = [];
  // Faste fysiologiske banehændelser følger med fra Campaign, men er ikke en del
  // af events[] og får derfor aldrig hit-box, menu, træk eller variationsknap.
  let lockedEvents = [];
  let sourceBg = [];
  // Box Challenge-forhindringer følger scenariet som en separat, låst geometri.
  // De ligger aldrig i events[] og kan derfor hverken vælges, flyttes eller slettes.
  let sourceMode = 'campaign';
  let lockedBoxes = [];
  // Livstab fra det faktisk spillede Box Challenge-forløb. De tegnes på den
  // grå referencekurve og ligger aldrig i events[], så de kan ikke redigeres.
  let sourceIncidents = [];
  // Kollisioner mellem den redigerede blå kurve og de låste kasser. De beregnes
  // på ny ved hver ændring, men ændrer ikke de oprindelige kasser eller kildedata.
  let alternativeBoxHits = [];
  // Minuttet hvor banen blev sat på pause. Tiden efter grænsen viser alene
  // simulerede konsekvenser og kan ikke få tilføjet eller flyttet handlinger.
  let playedUntilMin = 0;
  let nextId = 1;

  let totalMin = FUTURE_MIN + 1;
  let viewSpanMin = FUTURE_MIN;
  let viewStart = 0;
  let cursorMin = 510;       // default inspection point: 08:30
  let showBands = true;
  // Optional engine-state snapshot to resume from (#54 Phase 3): when a scenario is
  // loaded with an `engineState` (a game saved via "Se i scenarie editor"), the replay
  // starts from this exact mid-game physiology instead of a fresh steady state. null =
  // the normal deterministic steady-state start.
  let startEngineState = null;

  let dragEv = null, dragMoved = false;
  let hoverEv = null;          // marker the mouse is hovering (PC) — shows neighbour gaps
  let rafPending = false, dirty = false;
  // When true, markers draw as plain vector dots (no PNG icons). Used while snapshotting
  // the canvas for PDF/print export: drawing external PNGs taints the canvas on file://,
  // which makes canvas.toDataURL() throw — vector-only keeps it exportable everywhere.
  let printRender = false;

  // Marker layout: targets are slot integers (0 = bottom baseline, +1 per row up);
  // the displayed slot eases toward the target so icons don't "hop" — during a
  // drag the targets are frozen, then re-stacked + animated on release.
  let levelAnimRAF = null;     // rAF id while marker slots are easing
  let lastMetrics = null;      // last graph metrics (so settleMarkers works off-frame)
  let deathInfo = null;        // { t, cause, bg, ket } when the curve stops at a fatal point
  let fadeRAF = null;          // rAF id while a deleted event's effect fades out
  let sweepAnimRAF = null;     // rAF id while a what-if sweep marker's orbit animates
  // Editorens Y-akse må vokse straks, så en ny top aldrig klippes. Når en top
  // forsvinder under træk, holdes skalaen derimod i 10 sekunder og falder derefter
  // roligt. Det forhindrer, at hele grafen hopper frem og tilbage under redigering.
  let editorYAxisMax = null;
  let editorYAxisShrinkTarget = null;
  let editorYAxisShrinkSince = 0;
  let editorYAxisLastUpdate = 0;
  let editorYAxisDelayTimer = null;
  let editorYAxisAnimRAF = null;

  // Single-event SWEEP ("slå op", #55). When active, ONE event is varied along ONE
  // dimension and the resulting BG curves are overlaid:
  //   dim 'value' — scale the event's QUANTITY (dose / portion / duration) over
  //                 SWEEP_MULTS; 0x is the control (event removed, dashed grey).
  //   dim 'time'  — shift the event's TIME by TIME_OFFSETS minutes; the unshifted
  //                 0-offset is the anchor (= the canonical curve). No off-control.
  // Only one sweep at a time — opening a sweep on another event/dimension replaces
  // this object. null = no sweep.
  //   { eventId, kind, dim, baseValue, eventT, variants:[{value,isControl,isAnchor,bg,deathT,color,lw,txtColor,label}] }
  let sweep = null;
  // Night awakenings captured during the canonical recompute: each night-time event
  // (22:00-07:00) the engine treats as an awakening that costs sleep. We mirror them
  // into the facade so drawGraph erases the night shading there (same "awake stripe"
  // as the game) and draw a "-Xh sleep" label in the overlay. { startMin, durationMin, hours }
  let sleepAwakenings = [];
  const SWEEP_MULTS = [0, 0.5, 1, 1.5, 2];      // dim 'value' multipliers; index 0 (0x) = control
  const TIME_OFFSETS = [-60, -30, 0, 30, 60];   // dim 'time' shifts (minutes); 0 = planned time (anchor)
  const INTENSITY_LEVELS = ['Lav', 'Medium', 'Høj'];   // dim 'intensity' points for activity (low→high)
  const SWEEP_PULSE_MS = 2100;               // one colour-pulse cycle of the what-if marker glow (slow, calm)

  // DOM / canvas
  let canvas = null, ctx = null;
  let scrollbarEl = null, scrollbarThumbEl = null, eventPopEl = null;
  let active = false;

  // Offentlig Insights accepterer kun den snævre interne kontrakt, der eksporteres
  // fra et aktivt spil. En vilkårlig fil med vægt/ISF/ICR kan derfor ikke åbnes.
  function isInsightsScenario(data) {
    return !!data && data.format === 't1d-insights' && Array.isArray(data.events) &&
      (!data.lockedEvents || Array.isArray(data.lockedEvents)) &&
      (!data.lockedBoxes || Array.isArray(data.lockedBoxes)) &&
      (!data.sourceIncidents || Array.isArray(data.sourceIncidents)) &&
      (!data.sourceMode || data.sourceMode === 'campaign' || data.sourceMode === 'boxchallenge') &&
      Number.isFinite(data.playedUntilMin) && data.playedUntilMin >= 0 &&
      typeof data.characterId === 'string' && typeof CHARACTERS !== 'undefined' &&
      CHARACTERS.some(character => character.id === data.characterId);
  }

  // The game's physiology-band toggles are global; the editor forces them on
  // while active and restores the player's prior values on teardown.
  let savedBands = null;

  // marker icons (reuse game assets)
  const ICONS = {};
  function loadIcons() {
    const map = {
      bolus: "rapid-syringe", basal: "basal-syringe-clock", meal: "meal-plate",
      activity: "activity-shoe", glucagon: "t1d-kit-pouch"
    };
    for (const k in map) {
      const im = new Image();
      im.onload = () => { if (active) draw(); };
      im.src = "assets/icons/app/" + map[k] + ".png";
      ICONS[k] = im;
    }
  }
  const _foodIconCache = {};
  function foodIconImage(src) {
    if (!src || !/\.(png|webp|svg)$/i.test(src)) return null;
    if (_foodIconCache[src]) return _foodIconCache[src];
    const im = new Image();
    im.onload = () => { if (active) draw(); };
    im.src = src;
    _foodIconCache[src] = im;
    return im;
  }

  // ===========================================================================
  // ENGINE + RECOMPUTE
  // ===========================================================================
  function makeEngine() {
    engine = window.T1DPhysiologyEngine.createEngine(
      { weight: profile.weight, isf: profile.isf, icr: profile.icr },
      { seed: SEED, noiseEnabled: false, modules: EDITOR_MODULES }
    );
  }

  // Put the engine into the period's START state before a replay pass. Normally a
  // fresh deterministic steady state (16 h start-basal age, like the game's day 1).
  // But when the scenario carries an engineState snapshot (#54 Phase 3), restore that
  // exact mid-game physiology instead, then re-impose the editor's determinism (the
  // snapshot carries the game's noisy config): noise off + the three RNG modules fixed
  // + a fixed seed, so the forward replay stays deterministic and drag-stable.
  function resetEngineToStart() {
    if (startEngineState && engine && typeof engine.importState === 'function') {
      engine.importState(startEngineState);
      engine.noiseEnabled = false;
      if (engine.modules) {
        engine.modules.insulinVariability = EDITOR_MODULES.insulinVariability;
        engine.modules.dawnVariability = EDITOR_MODULES.dawnVariability;
        engine.modules.sleepDisruption = EDITOR_MODULES.sleepDisruption;
      }
      if (engine.rng && engine.rng._setState) engine.rng._setState(SEED);
    } else {
      engine.reset({ seed: SEED, steadyState: true, preInjectAgeHours: 16 });
    }
  }

  // Apply one scheduled event to the engine at the current step (the recompute
  // loop calls this when the loop time reaches the event's minute, so the
  // engine's "now" IS the event time — no scheduled-time API needed).
  function applyEvent(e) {
    let ok = true;
    if (e.kind === "meal") {
      // A 0× portion (sweep control) has no food to add — treat as "no meal".
      if (!(e.weight > 0)) { e.rejected = false; return; }
      ok = engine.addFood({
        carbs: e.carbs, protein: e.protein || 0, fat: e.fat || 0, weight: e.weight,
        eatTimeMin: e.eatTimeMin,
        carbParams: (window.CARB_TYPES[e.carbType] || window.CARB_TYPES.mixed),
        icon: e.icon
      });
    } else if (e.kind === "bolus") {
      if (!(e.units > 0)) { e.rejected = false; return; }   // 0× dose (sweep control) = no insulin
      ok = engine.addRapidInsulin({ units: e.units });
    } else if (e.kind === "basal") {
      if (!(e.units > 0)) { e.rejected = false; return; }
      ok = engine.addBasalInsulin({ units: e.units });
    } else if (e.kind === "activity") {
      // A 0× duration (sweep control) means no activity at all.
      if (!(e.durationMin > 0)) { e.rejected = false; return; }
      ok = engine.startActivity({
        type: e.actType, intensity: e.intensity, durationMin: e.durationMin,
        typeDef: (typeof AKTIVITETSTYPER !== 'undefined' ? AKTIVITETSTYPER[e.actType] : undefined)
      });
    } else if (e.kind === "glucagon") {
      engine.useGlucagon();
    } else if (e.kind === "acuteStress") {
      ok = engine.addAcuteStress(e.amount);
    } else if (e.kind === "chronicStress") {
      ok = engine.addChronicStress(e.amount);
    }
    e.rejected = (ok === false);
  }

  // Build the per-minute physiology frame used by the renderer + inspection.
  function buildFrame(t, st, phys, sample) {
    return {
      t,
      bg: st.trueBG,
      carbAbs: (phys.food && phys.food.carbAbsorption) || 0,
      basalPlasma: sample ? sample.basalPlasmaMU : ((phys.insulin && phys.insulin.basalPlasmaBaseline) || 0),
      rapidPlasma: sample ? sample.rapidPlasmaMU : 0,
      iob: st.iob,
      cob: st.cob,
      currentISF: st.currentISF,
      egp: (phys.liver && phys.liver.egp) || 0,
      ket: st.ketoneLevel,
      hr: (phys.exercise && phys.exercise.heartRate) || 0,
      liverGly: (phys.liver && phys.liver.glycogen) || 0,
      // game-over state (same fields the game uses) so the curve can stop at death
      deficit: engine ? engine.brainEnergyDeficit : 0,
      acidosis: engine ? engine.acidosisLoad : 0,
      weightKg: engine ? engine.weightChangeKg : 0,
      forces: phys.forces || []
    };
  }

  // The core operation: reset to a deterministic steady state, then step the
  // whole period minute-by-minute, applying scheduled events at their minute and
  // capturing a full physiology frame each minute. ~38 ms for 24 h.
  function recompute() {
    if (!engine) return;
    // Use the engine's universal steady-state starter with the SAME start-basal
    // age the game uses (16 h ago ≈ 08:00 the previous day). So the start depot
    // fades through the morning of day 1 — identical to the game — instead of the
    // engine's default 3 h (a fresh depot that lingered past 24 h in the editor).
    resetEngineToStart();
    const evs = events.slice().sort((a, b) => a.t - b.t);
    for (const e of evs) e.rejected = false;
    // schedule = spillerens redigerbare handlinger plus banens låste fysiologiske
    // hændelser. Med ingen basalhandling falmer startdepotet fortsat som i spillet;
    // der tilføjes ingen skjult baggrundsbasal.
    const sched = evs.concat(lockedEvents).sort((a, b) => a.t - b.t);

    deathInfo = null;
    sleepAwakenings = [];
    const f = new Array(totalMin);
    let ei = 0, lastSample = null;
    for (let t = 0; t < totalMin; t++) {
      while (ei < sched.length && sched[ei].t <= t) { applyEvent(sched[ei]); ei++; }
      engine.step(1, { onSample: s => { lastSample = s; } });
      // Drain engine events for this minute. A night-time intervention emits
      // 'sleep-disruption' (a new awakening costs sleep) — record it so the editor
      // shows the sleep loss the same way the game does (awake stripe + label).
      engine.consumeEvents();
      const fr = buildFrame(t, engine.getState(), engine.getPhysiologySnapshot(), lastSample);
      f[t] = fr;
      // Stop the curve at the first fatal frame — the simulated person would not
      // continue from here. The remaining window stays empty (nothing happens).
      const cause = deathCauseAt(fr);
      if (cause) { deathInfo = { t, cause, bg: fr.bg, ket: fr.ket }; f.length = t + 1; break; }
    }
    frames = f;
    alternativeBoxHits = findAlternativeBoxHits();
    sleepAwakenings = engine.sleepAwakeIntervals.map(aw => ({
      startMin: aw.startMin,
      endMin: aw.endMin == null ? engine.totalSimMinutes : aw.endMin
    }));
    // Mirror awakenings onto the facade (= global `game`) so drawGraph erases the
    // night shading over each awake stripe — the same visual the live game uses.
    facade.sleepAwakeIntervals = engine.sleepAwakeIntervals.length
      ? engine.sleepAwakeIntervals
      : null;
    syncData();        // mirror frames into the global render arrays drawGraph reads
    updateSummary();
    // Sweep mode: after the canonical curve is in `frames`, rebuild the variant
    // curves — every recompute, including live drags of other markers, so the sweep
    // follows continuously (5 extra full sims per frame; heavier at 48/72 h).
    if (sweep) computeVariants();
  }

  // Detect the first frame the simulated person would not survive — same
  // thresholds as the game's checkGameOverConditions, read from the engine.
  function deathCauseAt(fr) {
    if (!engine) return null;
    if (fr.deficit >= engine.BRAIN_DEFICIT_THRESHOLD) return 'hypo';   // hypoglycaemic coma
    if (fr.acidosis >= engine.ACIDOSIS_THRESHOLD) return 'dka';        // ketoacidosis
    if (Math.abs(fr.weightKg) > 0.07 * (profile.weight || 70)) return 'weight';
    return null;
  }

  // Find det første sted, hvor den redigerede kurve rammer hver låst kasse.
  // Spillet bruger en sweep-kollision mellem to simulationstrin, så en hurtig
  // ændring ikke kan springe over en kasse. Editorens minutkurve undersøges på
  // samme måde med korte deltrin, også når kassen er skrå.
  function findAlternativeBoxHits() {
    if (sourceMode !== 'boxchallenge' || !lockedBoxes.length || !frames.length) return [];
    const hits = [];
    for (const box of lockedBoxes) {
      const firstMinute = Math.max(0, Math.floor(box.startMin));
      const lastMinute = Math.min(frames.length - 1, Math.ceil(box.endMin));
      let hit = null;
      for (let minute = firstMinute; minute <= lastMinute && !hit; minute++) {
        const current = frames[minute];
        const previous = frames[Math.max(0, minute - 1)];
        if (!current || !previous) continue;
        const segmentStart = Math.max(0, minute - 1);
        // 10 deltrin svarer til højst 6 sekunders opløsning og er rigeligt til
        // de langt bredere Box Challenge-forhindringer.
        for (let part = 0; part <= 10; part++) {
          const fraction = part / 10;
          const sampleTime = segmentStart + (minute - segmentStart) * fraction;
          if (sampleTime < box.startMin || sampleTime > box.endMin) continue;
          const sampleBG = previous.bg + (current.bg - previous.bg) * fraction;
          const duration = Math.max(1, box.endMin - box.startMin);
          const boxFraction = Math.max(0, Math.min(1, (sampleTime - box.startMin) / duration));
          const offset = (box.skewBG || 0) * boxFraction;
          if (sampleBG >= box.bgMin + offset && sampleBG <= box.bgMax + offset) {
            hit = { box, t: sampleTime, bg: sampleBG, cause: 'box' };
            break;
          }
        }
      }
      if (hit) hits.push(hit);
    }
    return hits;
  }

  // ===========================================================================
  // SWEEP ("slå op") — vary ONE insulin event's dose and overlay the BG curves.
  // ===========================================================================
  // simulateBg — run one full deterministic pass (engine.reset + step loop) over
  // the given sorted events and return just the per-minute BG array + death minute.
  // Truncates at the first fatal frame like recompute(). Used only for sweep
  // variants; the canonical curve is still built by recompute() into `frames`.
  function simulateBg(evs) {
    resetEngineToStart();
    evs = evs.concat(lockedEvents).sort((a, b) => a.t - b.t);
    for (const e of evs) e.rejected = false;
    const bg = new Array(totalMin);
    let ei = 0, deathT = null, cause = null, lastSample = null;
    for (let tt = 0; tt < totalMin; tt++) {
      while (ei < evs.length && evs[ei].t <= tt) { applyEvent(evs[ei]); ei++; }
      engine.step(1, { onSample: s => { lastSample = s; } });
      bg[tt] = engine.getState().trueBG;
      // Per-variant death (same thresholds as deathCauseAt) — this variant's curve
      // stops here, independent of the others (a 2x bolus may hypo where 0x does not).
      const fr = { deficit: engine.brainEnergyDeficit, acidosis: engine.acidosisLoad, weightKg: engine.weightChangeKg };
      const c = deathCauseAt(fr);
      if (c) { deathT = tt; cause = c; bg.length = tt + 1; break; }
    }
    return { bg, deathT, cause };
  }

  // fmtDose — exact dose string (NO rounding, even for basal); trim trailing zeros.
  function fmtDose(v) {
    if (Number.isInteger(v)) return String(v);
    return String(+v.toFixed(2)).replace(/\.?0+$/, '');
  }

  // Which event kinds support a what-if sweep, and what quantity each one varies.
  const SWEEPABLE_KINDS = { bolus: 1, basal: 1, meal: 1, activity: 1 };

  // sweepAccessor — per-kind getter/setter + value label for the quantity a what-if
  // sweep varies: insulin DOSE (units), meal PORTION (weight, which scales every macro
  // via applyPortion), or activity DURATION (minutes). The multipliers {0,0.5,1,1.5,2}
  // scale this one value; 0× = control. Returns null for kinds with nothing to scale.
  function sweepAccessor(ev) {
    if (ev.kind === 'bolus' || ev.kind === 'basal') {
      const u = (typeof t === 'function') ? t('editor.unit.insulin') : 'E';
      return { base: ev.units, set: v => { ev.units = v; }, label: v => fmtDose(v) + ' ' + u };
    }
    if (ev.kind === 'meal') {
      ensureMealBase(ev);   // capture the per-portion-1 macros so applyPortion scales cleanly
      return { base: ev.weight, set: v => applyPortion(ev, v), label: v => Math.round(v) + ' g' };
    }
    if (ev.kind === 'activity') {
      return { base: ev.durationMin, set: v => { ev.durationMin = Math.round(v); }, label: v => Math.round(v) + ' min' };
    }
    return null;
  }

  // offsetLabel — signed minute offset for a time-shift variant ("-30 min", "+60 min");
  // the unshifted anchor reads as "Planned" rather than "0 min".
  function offsetLabel(off) {
    if (off === 0) return t('editor.sweep.shift.planned');
    return (off > 0 ? '+' : '') + off + ' min';
  }

  // Intensity helpers — the activity intensity axis is categorical (Lav/Medium/Høj).
  function intensityRank(lvl) { const i = INTENSITY_LEVELS.indexOf(lvl); return i < 0 ? 1 : i; }
  function intensityLabel(lvl) {
    const key = lvl === 'Lav' ? 'low' : lvl === 'Høj' ? 'high' : 'medium';
    return t('activity.intensity.' + key);
  }

  // buildSweepPoints — turn a swept event + dimension into the concrete list of axis
  // values to simulate. Returns { base, set, label, points[], order[] } or null when
  // there is nothing to explore on that axis:
  //   base   — the event's current value on this axis (restored after the sweep pass)
  //   set    — write an axis value back onto the event
  //   label  — axis value → display string (dose/portion/duration text, or time offset)
  //   points — DISPLAY order: each { raw, isControl, isAnchor }
  //   order  — COMPUTE order: the anchor LAST so the shared engine ends canonical
  function buildSweepPoints(ev, dim) {
    if (dim === 'time') {
      const baseT = ev.t;
      // Keep only shifts that still fire inside the simulated window; the 0 anchor
      // is always kept. If nothing but the anchor survives there is nothing to shift.
      const offs = TIME_OFFSETS.filter(o => o === 0 ||
        (baseT + o >= 0 && baseT + o < totalMin && baseT + o <= playedUntilMin));
      if (!offs.some(o => o !== 0)) return null;
      const points = offs.map(o => ({ raw: baseT + o, isControl: false, isAnchor: o === 0, sortKey: baseT + o }));
      const order = points.slice().sort((a, b) => (a.isAnchor ? 1 : 0) - (b.isAnchor ? 1 : 0)).map(p => p.raw);
      return {
        base: baseT,
        set: v => { ev.t = Math.round(v); },
        label: v => offsetLabel(Math.round(v) - baseT),
        points, order,
      };
    }
    if (dim === 'intensity') {
      // Categorical axis — only meaningful for activities. Walk the three intensity
      // levels (Lav/Medium/Høj); the event's current level is the anchor.
      if (ev.kind !== 'activity' || !ev.intensity) return null;
      const base = ev.intensity;
      const points = INTENSITY_LEVELS.map(lvl => ({ raw: lvl, isControl: false, isAnchor: lvl === base, sortKey: intensityRank(lvl) }));
      const order = points.slice().sort((a, b) => (a.isAnchor ? 1 : 0) - (b.isAnchor ? 1 : 0)).map(p => p.raw);
      return { base, set: v => { ev.intensity = v; }, label: v => intensityLabel(v), points, order };
    }
    // dim 'value' — the existing accessor supplies the axis set + label.
    const acc = sweepAccessor(ev);
    if (!acc) return null;
    const base = acc.base;
    const points = SWEEP_MULTS.map(m => ({ raw: base * m, isControl: m === 0, isAnchor: m === 1, sortKey: base * m }));
    const order = [0, 0.5, 1.5, 2, 1].map(m => base * m);   // 1x LAST → engine ends canonical, event restored
    return { base, set: acc.set, label: acc.label, points, order };
  }

  // computeVariants — rebuild the sweep variant BG arrays from the swept event by
  // walking its dimension's points (buildSweepPoints).
  // PRECONDITION: called at the TAIL of recompute() (frames canonical, syncData done).
  // Computes the anchor LAST so the shared engine + the event are left canonical for
  // the next inspection read. Self-heals to no-sweep if the swept event is gone (or no
  // longer offers anything to explore on this axis).
  function computeVariants() {
    const ev = events.find(e => e.id === sweep.eventId);
    // Swept event gone (e.g. window-shrink dropped it): drop the sweep AND re-mirror
    // the canonical `frames` into the render arrays (syncData early-returned while
    // sweep was still set, leaving them empty → blank graph) before bailing.
    if (!ev) { sweep = null; syncData(); return; }
    const dim = sweep.dim || 'value';
    const spec = buildSweepPoints(ev, dim);
    if (!spec) { sweep = null; syncData(); return; }
    sweep.eventT = ev.t;
    sweep.baseValue = spec.base;
    const real = spec.base;
    const byRaw = new Map();
    try {
      for (const raw of spec.order) {
        spec.set(raw);
        // Re-sort every pass: a time shift can move this event past its neighbours,
        // and simulateBg() relies on the event list being in chronological order.
        const evs = events.slice().sort((a, b) => a.t - b.t);
        byRaw.set(raw, simulateBg(evs));
      }
    } finally {
      spec.set(real);   // a thrown pass must never leave the shared event mutated
    }
    // The event is back to its real axis value (anchor computed last); engine canonical.
    const n = spec.points.length;
    sweep.variants = spec.points.map((p, idx) => {
      const r = byRaw.get(p.raw);
      const value = p.raw;
      const sortKey = (p.sortKey != null) ? p.sortKey : idx;   // numeric ordering key (value is a string for 'intensity')
      const isControl = p.isControl;
      let color, lw, txtColor;
      if (isControl) {
        color = '#6b7280'; lw = 1.4; txtColor = '#cbd5e1';   // neutral grey dashed control (thin alternative)
      } else {
        // Hue ramp blue → magenta. For 'value' it climbs with the dose (idx 0 is the
        // grey control, so 0.5x→0 … 2x→1); for 'time'/'intensity' (no control) it climbs
        // earliest→latest / low→high across all points.
        const tt = (dim === 'value') ? (idx - 1) / 3 : (n > 1 ? idx / (n - 1) : 0);
        color = `hsla(${225 + 70 * tt}, ${85 + 13 * tt}%, ${72 - 9 * tt}%, 0.95)`;
        // The anchor (real value / planned time / current intensity) stands in for the
        // main BG line and keeps its weight; the alternatives are drawn thin.
        lw = p.isAnchor ? 3 : 1.4;
        txtColor = color;
      }
      return { value, sortKey, isControl, isAnchor: p.isAnchor, bg: r.bg, deathT: r.deathT, cause: r.cause, color, lw, txtColor, label: spec.label(value) };
    });
  }

  // openSweep — enter / toggle a what-if sweep on an event along ONE dimension:
  // 'value' (insulin dose / meal portion / activity duration) or 'time' (shift the
  // event earlier/later). Re-selecting the active dimension toggles the sweep off.
  function openSweep(ev, dim) {
    if (!SWEEPABLE_KINDS[ev.kind]) return;
    dim = dim || 'value';
    if (sweep && sweep.eventId === ev.id && sweep.dim === dim) {   // toggle off (same axis)
      sweep = null; closeEventPop(); recompute(); draw(); updateInspect(); return;
    }
    const spec = buildSweepPoints(ev, dim);
    if (!spec || (dim === 'value' && !(spec.base > 0))) {
      closeEventPop();
      showConfirm(t(dim === 'time' ? 'editor.sweep.notime' : 'editor.sweep.noval'), null);
      return;
    }
    // Cancel any in-flight delete cross-fade so it doesn't keep running alongside the sweep.
    if (fadeRAF) { cancelAnimationFrame(fadeRAF); fadeRAF = null; }
    sweep = { eventId: ev.id, kind: ev.kind, dim, baseValue: spec.base, eventT: ev.t, variants: [] };
    closeEventPop();                 // the graph IS the sweep UI now
    recompute(); draw(); updateInspect();
    startSweepAnim();                 // animate the active marker's pulsing glow
  }

  // valueDimLabelKey — the kind-specific name for the 'value' axis in the dimension
  // picker: insulin varies the DOSE, a meal its PORTION, an activity its DURATION.
  function valueDimLabelKey(kind) {
    if (kind === 'meal') return 'editor.dim.portion';
    if (kind === 'activity') return 'editor.dim.duration';
    return 'editor.dim.dose';
  }

  // Dimension picker — a small popover anchored to the what-if button that lets the
  // user choose WHICH axis to explore (quantity vs. time) before the sweep starts.
  let sweepMenuEl = null;
  function closeSweepMenu() {
    if (sweepMenuEl) { sweepMenuEl.remove(); sweepMenuEl = null; }
    document.removeEventListener('pointerdown', onSweepMenuOutside, true);
  }
  function onSweepMenuOutside(e) {
    if (sweepMenuEl && !sweepMenuEl.contains(e.target)) closeSweepMenu();
  }
  function openSweepMenu(ev, anchorBtn) {
    closeSweepMenu();
    if (!SWEEPABLE_KINDS[ev.kind]) return;
    const host = canvas.parentElement || document.body;
    const menu = document.createElement('div');
    menu.className = 'editor-sweep-menu';
    // Highlight the axis already being explored (if this event owns the active sweep),
    // so re-selecting it reads as "close" rather than a duplicate open.
    const activeDim = (sweep && sweep.eventId === ev.id) ? sweep.dim : null;
    const dims = [{ dim: 'value', key: valueDimLabelKey(ev.kind) }];
    if (ev.kind === 'activity') dims.push({ dim: 'intensity', key: 'editor.dim.intensity' });   // categorical axis
    dims.push({ dim: 'time', key: 'editor.dim.time' });
    menu.innerHTML =
      '<div class="esm-head">' + t('editor.dim.menu') + '</div>' +
      dims.map(d => '<button class="esm-chip' + (activeDim === d.dim ? ' esm-on' : '') +
        '" data-dim="' + d.dim + '">' + t(d.key) + '</button>').join('');
    host.appendChild(menu);
    sweepMenuEl = menu;
    // Position above the anchor button, clamped inside the host; fall below if no room.
    const hostRect = host.getBoundingClientRect();
    const br = anchorBtn.getBoundingClientRect();
    const mw = menu.offsetWidth || 160, mh = menu.offsetHeight || 90;
    let left = (br.left - hostRect.left) + br.width / 2 - mw / 2;
    let top = (br.top - hostRect.top) - mh - 8;
    if (top < 8) top = (br.bottom - hostRect.top) + 8;
    left = Math.max(8, Math.min(hostRect.width - mw - 8, left));
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
    menu.querySelectorAll('.esm-chip').forEach(btn => {
      btn.onclick = () => { const d = btn.dataset.dim; closeSweepMenu(); openSweep(ev, d); };
    });
    // Attach the outside-dismiss on the next tick so the click that opened this menu
    // doesn't immediately close it.
    setTimeout(() => document.addEventListener('pointerdown', onSweepMenuOutside, true), 0);
  }

  // closeActiveSweep — collapse the running what-if sweep (back to the single planned
  // curve). Used by the floating close chip below; equivalent to re-selecting the
  // active dimension in the picker.
  function closeActiveSweep() {
    if (!sweep) return;
    sweep = null;
    closeSweepMenu();
    recompute(); draw(); updateInspect();
  }

  // Floating "close what-if" chip — a one-tap affordance in the chart's top-right
  // corner while a sweep is active, so the user doesn't have to reopen the event
  // popup and re-pick the dimension to get out. updateSweepCloseChip() runs at the
  // end of every draw(), so it stays in sync with the sweep state (which always
  // triggers a redraw) without hooking each individual sweep = null site.
  let sweepCloseEl = null;
  let sweepCloseAnchor = null;   // {x,y} in canvas CSS px — top of the label cluster (set by drawSweep)
  function updateSweepCloseChip() {
    const host = canvas && canvas.parentElement;
    // Hide whenever there is no active sweep, no metrics, or no label cluster to anchor
    // to. Don't create the element just to hide it.
    if (!host || !sweep || !lastMetrics || !sweepCloseAnchor) {
      if (sweepCloseEl) sweepCloseEl.style.display = 'none';
      return;
    }
    if (!sweepCloseEl) {
      sweepCloseEl = document.createElement('button');
      sweepCloseEl.type = 'button';
      sweepCloseEl.className = 'editor-sweep-close';
      sweepCloseEl.innerHTML = '<img src="assets/icons/app/editor-close-whatif.png" alt="">';
      sweepCloseEl.onclick = closeActiveSweep;
      host.appendChild(sweepCloseEl);
    }
    sweepCloseEl.title = t('editor.sweep.collapse');
    sweepCloseEl.setAttribute('aria-label', t('editor.sweep.collapse'));
    sweepCloseEl.style.display = 'flex';
    // Centre the round ✕ on the cluster anchor, offset by the canvas's position inside
    // the host (CSS px). The button is translate(-50%,-50%) so left/top are its centre;
    // clamp horizontally so it never leaves the chart.
    const m = lastMetrics;
    const cx = canvas.offsetLeft, cy = canvas.offsetTop;
    const minX = cx + m.padding.left + 20, maxX = cx + m.padding.left + m.graphWidth - 20;
    const px = Math.max(minX, Math.min(maxX, cx + sweepCloseAnchor.x));
    sweepCloseEl.style.left = px + 'px';
    sweepCloseEl.style.top = (cy + sweepCloseAnchor.y) + 'px';
  }

  // drawSweep — render the control (dashed grey) + 4 gradient variant BG curves,
  // each truncated at its own death minute, with a value label 4 h after the event.
  function drawSweep(octx, m) {
    octx.save();
    // Clip to the chart area so near-floor geometry (a hypo variant's end / death
    // dot at BG≈0.1, round line-caps) never bleeds below the x-axis or outside.
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();
    octx.globalAlpha = 1; octx.shadowBlur = 0; octx.shadowColor = 'transparent';
    octx.lineCap = 'round'; octx.lineJoin = 'round';
    const tStart = Math.max(0, Math.floor(viewStart));
    const tEndView = viewStart + viewSpanMin;
    // Draw order: lowest axis value behind, climbing on top; the anchor (true BG /
    // planned time) goes LAST so its heavier line sits on top of the alternatives.
    const order = sweep.variants.slice().sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? 1 : -1;
      return a.sortKey - b.sortKey;
    });
    for (const v of order) {
      const tEnd = Math.min(tEndView, v.bg.length - 1);
      if (tEnd < tStart) continue;
      // A time variant is identical to the anchor until the EARLIER of its own event
      // time and the anchor's — before that the shared run-up is covered by the anchor
      // line alone, so start the alternative at its divergence point instead of stacking
      // N copies of the common prefix. (The value dimension shares one event time, so
      // every variant already diverges together at the dose — no per-variant start.)
      let vStart = tStart;
      if (sweep.dim === 'time' && !v.isAnchor) {
        vStart = Math.max(tStart, Math.min(sweep.eventT, v.value) - 1);
      }
      octx.strokeStyle = v.color; octx.lineWidth = v.lw;
      octx.setLineDash(v.isControl ? [6, 4] : []);
      octx.beginPath();
      let started = false;
      for (let tt = vStart; tt <= tEnd; tt++) {
        const b = v.bg[tt]; if (b == null) continue;
        const x = m.timeToX(tt), y = m.bgToY(b);
        if (!started) { octx.moveTo(x, y); started = true; } else octx.lineTo(x, y);
      }
      octx.stroke();
      octx.setLineDash([]);
    }
    octx.restore();   // end the curve clip — markers + labels draw unclipped, like the normal death marker

    const tLabel = sweep.eventT + 240;
    const xLeft = m.padding.left + 6, xRight = m.padding.left + m.graphWidth - 6;
    const yTopMin = m.padding.top + 10, yBottomMax = m.padding.top + m.graphHeight - 10;

    // Death markers (both dimensions) — a dead variant gets the SAME medical cross +
    // cause label as the normal single-curve death marker, at its death point. Deaths
    // that nearly coincide are grouped so we draw ONE cross + cause pill, not a stack.
    const dead = [];
    for (const v of sweep.variants) {
      if (v.deathT == null || v.deathT < tStart || v.deathT > tEndView || v.bg[v.deathT] == null) continue;
      dead.push({ v, dx: m.timeToX(v.deathT), dy: m.bgToY(v.bg[v.deathT]) });
    }
    dead.sort((a, b) => a.dx - b.dx);
    const PROX = 16;   // px: deaths closer than this share one marker
    const groups = [];
    for (const d of dead) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(g.dx - d.dx) < PROX && Math.abs(g.dy - d.dy) < PROX) g.items.push(d);
      else groups.push({ dx: d.dx, dy: d.dy, cause: d.v.cause, items: [d] });
    }

    octx.save();
    octx.font = 'bold 11px Inter, "Segoe UI", sans-serif';
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    // Lille farvet label til variationskurverne. Baggrunden følger kurvens farve
    // med lav opacitet, så labels læses som en del af grafen i stedet for som
    // fritsvævende sorte tekstbokse.
    const drawPill = (x, y, text, color) => {
      const tw = octx.measureText(text).width;
      octx.save();
      octx.fillStyle = color;
      octx.globalAlpha = 0.16;
      octx.beginPath(); octx.roundRect(x - tw / 2 - 6, y - 9, tw + 12, 18, 9); octx.fill();
      octx.globalAlpha = 0.45;
      octx.strokeStyle = color;
      octx.lineWidth = 1;
      octx.stroke();
      octx.globalAlpha = 1;
      octx.fillStyle = color;
      octx.fillText(text, x, y);
      octx.restore();
    };
    // ANGLED pill — text rotated by `ang` (reads up the slope), its foot anchored at
    // (footX, footY) and the pill rising along the angle. A steep slant keeps the
    // horizontal footprint narrow so several labels fit side by side at their own time
    // (used by the time dimension's per-time labels).
    const drawAngledPill = (footX, footY, text, color, ang) => {
      const tw = octx.measureText(text).width;
      octx.save();
      octx.translate(footX, footY);
      octx.rotate(ang);
      octx.fillStyle = 'rgba(15, 23, 42, 0.45)';   // light backing — just enough contrast, no heavy black block
      octx.beginPath(); octx.roundRect(-5, -8, tw + 10, 16, 8); octx.fill();
      octx.fillStyle = color; octx.textAlign = 'left'; octx.textBaseline = 'middle';
      octx.fillText(text, 0, 0);
      octx.restore();
    };

    // Collect the "head" (top point) of every label as it is drawn, so the floating
    // close-✕ can be anchored just above the TOPMOST label in the cluster (option B).
    const labelHeads = [];
    if (sweep.dim === 'time') {
      // TIME dimension: variants differ by WHEN the event fires. Stand the descriptive
      // label fully VERTICAL at the TOP of the graph, directly above its own event time —
      // a vertical label is narrow enough to sit at its exact x, so the dotted leader
      // runs straight down to where that variant's curve is at that time.
      for (const g of groups) drawDeathMark(octx, g.dx, g.dy, g.cause);   // crosses only; labels live up top
      const baseY = markerGeom(m).baseY;
      const labelFootY = m.padding.top + 56;   // foot of the vertical labels — they rise into the top margin
      const items = sweep.variants
        .map(v => ({ v, tx: m.timeToX(v.value) }))
        .filter(it => it.tx >= m.padding.left - 2 && it.tx <= m.padding.left + m.graphWidth + 2)
        .sort((a, b) => a.tx - b.tx);
      // Keep each label at its own x so the leader is vertical; only nudge feet apart in
      // a tight view (48/72 h) where the times would otherwise collide.
      const ANG = -Math.PI / 2;   // fully vertical (reads bottom→top)
      const VW = 16;              // px between adjacent label feet (≈ pill thickness)
      const labs = items.map(it => ({ tx: it.tx, x: it.tx, v: it.v }));
      for (let i = 1; i < labs.length; i++) {
        if (labs[i].x - labs[i - 1].x < VW) labs[i].x = labs[i - 1].x + VW;
      }
      for (let i = labs.length - 1; i > 0; i--) {
        if (labs[i].x > xRight) labs[i].x = xRight;
        if (labs[i].x - labs[i - 1].x < VW) labs[i - 1].x = labs[i].x - VW;
      }
      for (const L of labs) L.x = Math.max(xLeft, Math.min(xRight, L.x));
      for (const L of labs) {
        // dotted leader from the label foot down to where THIS variant's curve sits at its
        // own event time (the point the label describes) — ends at the curve, not the axis.
        const ct = Math.min(Math.max(0, Math.round(L.v.value)), L.v.bg.length - 1);
        const cb = L.v.bg[ct];
        const endY = (cb != null) ? m.bgToY(cb) : baseY - 4;
        octx.strokeStyle = L.v.color; octx.globalAlpha = 0.5; octx.lineWidth = 1.8; octx.setLineDash([2, 4]);
        octx.beginPath(); octx.moveTo(L.x, labelFootY); octx.lineTo(L.x, endY); octx.stroke();
        octx.setLineDash([]); octx.globalAlpha = 1;
        drawAngledPill(L.x, labelFootY, L.v.label, L.v.txtColor, ANG);
      }
      // Close-✕ sits to the RIGHT of the last (rightmost) label with a clear gap, its
      // height aligned to the VERTICAL CENTRE of that label.
      if (labs.length) {
        const last = labs[labs.length - 1];
        const lastW = octx.measureText(last.v.label).width;   // vertical label height (rotated text)
        const centreY = labelFootY - lastW / 2;               // mid-point of the vertical label
        sweepCloseAnchor = { x: last.x + 38, y: Math.max(m.padding.top + 2, centreY) };
      } else {
        sweepCloseAnchor = null;
      }
    } else {
      // VALUE dimension: dose/portion/duration labels at +4 h on the curve, vertically
      // de-overlapped; a variant that died before +4 h gets its label stacked above its
      // death cross instead.
      const deadLabels = [];
      for (const g of groups) {
        const pillTop = drawDeathMark(octx, g.dx, g.dy, g.cause);
        let y = pillTop - 13;
        for (const it of g.items.slice().sort((a, b) => a.v.sortKey - b.v.sortKey)) {
          if (it.v.deathT >= tLabel) continue;   // its label lives at +4 h instead
          deadLabels.push({ x: g.dx, y: Math.max(yTopMin, y), text: it.v.label, color: it.v.txtColor });
          y -= 20;
        }
      }
      const lbls = [];
      for (const v of sweep.variants) {
        if (v.deathT != null && v.deathT < tLabel) continue;   // dead-before-4h → handled above
        const tEff = Math.min(tLabel, v.bg.length - 1);
        if (tEff < tStart || tEff > tEndView || v.bg[tEff] == null) continue;
        const x = Math.max(xLeft, Math.min(xRight, m.timeToX(tEff)));
        const yCurve = m.bgToY(v.bg[tEff]);
        lbls.push({ x, yCurve, y: yCurve, text: v.label, color: v.txtColor });
      }
      lbls.sort((a, b) => a.y - b.y);
      for (let i = 1; i < lbls.length; i++) {
        if (lbls[i].y - lbls[i - 1].y < 20) lbls[i].y = lbls[i - 1].y + 20;
      }
      for (let i = lbls.length - 1; i > 0; i--) {
        if (lbls[i].y > yBottomMax) lbls[i].y = yBottomMax;
        if (lbls[i].y - lbls[i - 1].y < 20) lbls[i - 1].y = lbls[i].y - 20;
      }
      for (const L of lbls) L.y = Math.max(yTopMin, Math.min(yBottomMax, L.y));
      for (const L of lbls) {
        if (Math.abs(L.y - L.yCurve) > 6) {   // leader back to the curve if nudged
          octx.strokeStyle = L.color; octx.globalAlpha = 0.5; octx.lineWidth = 1;
          octx.beginPath(); octx.moveTo(L.x, L.yCurve); octx.lineTo(L.x, L.y); octx.stroke();
          octx.globalAlpha = 1;
        }
        drawPill(L.x, L.y, L.text, L.color);
        labelHeads.push({ x: L.x, topY: L.y - 9 });   // pill half-height ≈ 9
      }
      for (const L of deadLabels) { drawPill(L.x, L.y, L.text, L.color); labelHeads.push({ x: L.x, topY: L.y - 9 }); }
    }
    // VALUE/intensity: anchor the close-✕ just above the highest label in the cluster
    // (the time dimension sets its own anchor above, to the right of the last label).
    if (sweep.dim !== 'time') {
      if (labelHeads.length) {
        const top = labelHeads.reduce((a, b) => (b.topY < a.topY ? b : a));
        sweepCloseAnchor = { x: top.x, y: Math.max(m.padding.top + 2, top.topY - 22) };
      } else {
        sweepCloseAnchor = null;
      }
    }
    octx.restore();
  }

  // rAF-throttled recompute for smooth dragging / slider edits.
  function requestRecompute() {
    dirty = true;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (dirty) { dirty = false; recompute(); draw(); updateInspect(); }
    });
  }

  // ===========================================================================
  // EDITOR FACADE — the game-shaped object placed in the global `game` so the
  // existing dock handlers route here. Action methods place an event at the
  // cursor minute; properties are the handful the reachable game code reads.
  // ===========================================================================
  const facade = {
    isGameOver: false,
    gameMode: 'insights',
    activeAktivitet: null,   // never "active" — editor activities are placed events
    basalDose: 0,            // set from the engine after makeEngine()
    lastPauseTime: 0,
    totalSimMinutes: 0,
    glucagonUsedTime: -Infinity,  // glucagon is never on cooldown in the editor

    // Fields the game's drawGraph reads when rendering the editor. The band-norm
    // values (ICR / ISF / basal baseline) are refreshed from the engine+profile in
    // syncView(); hovorka holds the fixed Hovorka constants the game uses for its
    // band scaling. The empties keep the shared renderer from touching live-game-
    // only state (the editor draws its own markers via drawOverlay, not logHistory).
    weight: 70, ICR: 10, ISF: 3.0,
    basalPlasmaInsulinBaseline: 75,
    hovorka: { k_e: 0.138, tau_I: 55 },
    day: 1,
    logHistory: [],
    graphMessages: [],
    floatingLabels: null,
    sleepAwakeIntervals: null,
    boxes: null,

    // Measurements (fingerprick / ketone test) are meaningless in a deterministic
    // static editor — the curve IS the fully-visible truth. No-ops so the kit dock
    // never crashes; the two buttons are also hidden via body.mode-editor CSS.
    performFingerprick() { /* no-op in editor */ },
    performKetoneTest() { /* no-op in editor */ },

    addFood(carbs, protein, fat, icon, weight, carbType, eatTimeMin, name) {
      return !!placeEvent({
        kind: "meal", carbs, protein: protein || 0, fat: fat || 0,
        weight: weight || Math.max(20, (carbs + (protein || 0) + (fat || 0)) + 30),
        carbType: carbType || "mixed",
        eatTimeMin: eatTimeMin || (window.estimateEatTimeMin
          ? window.estimateEatTimeMin({ weight, carbType }) : 15),
        icon: icon, name: name || ''   // dish name (from the dock chip) for the popup title
      });
    },
    addFastInsulin(units) { return !!placeEvent({ kind: "bolus", units: +units || 0 }); },
    addLongInsulin(units) { return !!placeEvent({ kind: "basal", units: +units || 0 }); },
    startAktivitet(type, intensitet, duration) {
      // An open-ended activity (duration null) makes no sense on a static timeline —
      // default it to 120 min (2 h) instead of an unbounded session.
      return !!placeEvent({ kind: "activity", actType: type, intensity: intensitet,
                            durationMin: duration || 120 });
    },
    stopAktivitet() { /* editor activities have a fixed duration — no live stop */ },
    useGlucagon() { return !!placeEvent({ kind: "glucagon" }); }
  };

  // ===========================================================================
  // EVENT PLACEMENT / EDIT
  // ===========================================================================
  // Place a new event at the current cursor minute (the user hovers the curve to
  // choose the time, then clicks a dock action). Returns the created event.
  function placeEvent(partial) {
    if (!active) return null;
    if (cursorMin > playedUntilMin + 0.5) {
      showConfirm(t('editor.boundary.notice'), null);
      return null;
    }
    const eventMinute = Math.max(0, Math.min(totalMin - 1, playedUntilMin, Math.round(cursorMin)));
    const ev = Object.assign({ t: eventMinute }, partial);
    ev.id = nextId++;
    events.push(ev);
    recompute(); draw(); updateInspect();
    return ev;
  }

  function deleteEvent(ev) {
    // Deleting the swept event ends the sweep.
    if (sweep && sweep.eventId === ev.id) sweep = null;
    const sweepActive = !!sweep;
    const oldBg = frames.map(fr => fr ? fr.bg : null);   // snapshot pre-delete curve
    events = events.filter(x => x !== ev);
    closeEventPop();
    recompute(); draw(); updateInspect();                // frames/cgmDataPoints = new curve
    // The cross-fade blends the single trueBgPoints line; in sweep mode that array
    // is empty (the 5 variant curves render via drawOverlay), so skip the fade.
    if (!sweepActive) fadeCurve(oldBg);
  }

  // duplicateEvent — clone an event 1 hour later (clamped to the window) with a
  // fresh id. Runtime-only/layout fields are stripped so the clone recomputes and
  // re-lays-out cleanly. Works for every event kind.
  function duplicateEvent(ev) {
    const clean = Object.assign({}, ev);
    delete clean.id; delete clean._base; delete clean.rejected;
    delete clean._slot; delete clean._slotTarget; delete clean._mx; delete clean._my; delete clean._drag;
    clean.t = Math.min(totalMin - 1, playedUntilMin, ev.t + 60);
    clean.id = nextId++;
    events.push(clean);
    closeEventPop();
    recompute(); draw(); updateInspect();
  }

  // Cross-fade the rendered BG dots from the pre-delete curve to the recomputed
  // one over ~600 ms, so the curve visibly relaxes into the action being gone
  // instead of snapping. Only the rendered cgmDataPoints values are blended —
  // `frames` already holds the final curve, restored exactly when the fade ends.
  function fadeCurve(oldBg) {
    if (fadeRAF) cancelAnimationFrame(fadeRAF);
    const newBg = frames.map(fr => fr ? fr.bg : null);
    const start = performance.now();
    const DUR = 600;
    const ease = k => 1 - Math.pow(1 - k, 3);
    function step(now) {
      const k = ease(Math.min(1, (now - start) / DUR));
      for (const pt of trueBgPoints) {
        const o = oldBg[pt.time], n = newBg[pt.time];
        if (o != null && n != null) pt.value = o + (n - o) * k;
      }
      if (typeof drawGraph === 'function') drawGraph();   // render blended (no recompute)
      if (k < 1) { fadeRAF = requestAnimationFrame(step); }
      else { fadeRAF = null; syncData(); draw(); }         // settle to exact new curve
    }
    fadeRAF = requestAnimationFrame(step);
  }

  // ===========================================================================
  // INSPECTION (scrubber → BG-forces panel + readout)
  // ===========================================================================
  function fmtTime(t) {
    t = ((t % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60), m = Math.round(t % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function updateInspect() {
    const min = Math.max(0, Math.min(totalMin - 1, Math.round(cursorMin)));
    const fr = frames[min];
    if (!fr) return;
    // Feed the cursor frame's snapshot to the game's BG-forces panel so it shows
    // the forces AT THE CURSOR (not "now"); updateEffectsPanel accepts an override.
    if (typeof updateEffectsPanel === 'function') updateEffectsPanel({ forces: fr.forces });
    // Feed the game's familiar BG capsule fragment (#cgm-hero) with the values AT
    // THE CURSOR — BG (honours mmol/L vs mg/dL), trend arrow, IOB, COB. These are
    // the exact elements the live game updates, so the readout looks identical.
    const bgEl = document.getElementById('cgmValueDisplayGraph');
    if (bgEl) { bgEl.textContent = displayBG(fr.bg); bgEl.style.color = bgColor(fr.bg); }
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cgmUnitLabel', bgUnitLabel());
    set('iobDisplay', (fr.iob || 0).toFixed(1));
    set('cobDisplay', Math.round(fr.cob || 0));
    updateCursorTrend(min);
    // Feed the game's life bars (brain / acidosis / weight) with the cursor frame's
    // values + engine thresholds, then reuse the game's own updateLifeBars renderer.
    // The panel itself only shows when the player has life bars enabled (showLifeBars);
    // the editor no longer force-hides it.
    if (engine && typeof updateLifeBars === 'function') {
      facade.brainEnergyDeficit = fr.deficit || 0;
      facade.acidosisLoad = fr.acidosis || 0;
      facade.weightChangeKg = fr.weightKg || 0;
      facade.BRAIN_DEFICIT_THRESHOLD = engine.BRAIN_DEFICIT_THRESHOLD;
      facade.ACIDOSIS_THRESHOLD = engine.ACIDOSIS_THRESHOLD;
      facade.weight = profile.weight;
      facade.weightLimitKg = 0.07 * (profile.weight || 70);
      updateLifeBars();
    }
    // Show the cursor's time + day + sun/moon in the game's clock (.top-status), so
    // you can read exactly where the cursor sits. Reuses updateClockAndDayNight: feed
    // it the time-of-day (clockMin % 1440) and set the day number separately.
    // WHILE DRAGGING an event the clock follows the dragged marker instead of the
    // cursor, so you can read the event's exact time live as you move it (the
    // BG/IOB/COB tablet keeps showing the inspection cursor's values).
    const clockMin = (dragEv && dragMoved) ? dragEv.t : min;
    facade.timeInMinutes = clockMin % 1440;
    if (typeof updateClockAndDayNight === 'function') updateClockAndDayNight();
    const dayEl = document.getElementById('dayDisplay');
    if (dayEl) dayEl.textContent = Math.floor(clockMin / 1440) + 1;
  }

  // Trend arrow at the cursor — same rate→arrow mapping as the game's CGM trend
  // (updateCgmTrendArrow), computed from the deterministic curve over a 30-min window.
  function updateCursorTrend(min) {
    const el = document.getElementById('cgm-trend');
    if (!el) return;
    const t0 = Math.max(0, min - 30);
    const a = frames[t0], b = frames[min];
    if (!a || !b || min === t0) return;
    const rate = (b.bg - a.bg) / (min - t0);   // mmol/L per minute
    const trend = cgmTrendForRate(rate);   // shared mapping defined in ui.js
    el.textContent = trend.arrow; el.style.color = trend.color;
  }

  // ===========================================================================
  // RENDERER BRIDGE — the editor reuses the GAME's drawGraph() verbatim. It
  // (1) syncs its per-minute frames into the same global arrays the game's graph
  // reads (cgmDataPoints, physiologyDataPoints), (2) publishes its scroll window
  // via graphViewOverride so drawGraph renders the current dynamic time slice with
  // the game's exact zones, night shading, coordinate system and band scaling,
  // and (3) draws its own draggable markers + cursor on top via drawOverlay
  // (called at the end of drawGraph). Editor and game then look identical.
  // ===========================================================================
  const PAD = { top: 20, right: 20, bottom: 44, left: 64 }; // MUST match drawGraph

  function bgColor(bg) {
    if (bg < 4) return "#ef4444";
    if (bg > 14) return "#ef4444";
    if (bg > 10) return "#fb923c";
    return "#4ade80";
  }

  // Nødvendigt loft for hele perioden (samme afrunding som spillets graf).
  function computeRequiredYMax() {
    let m = 12;
    for (let t = 0; t < frames.length; t++) if (frames[t] && frames[t].bg > m) m = frames[t].bg;
    for (const point of sourceBg) if (point && Number.isFinite(point.bg) && point.bg > m) m = point.bg;
    for (const box of lockedBoxes) {
      const top = box.bgMax + Math.max(0, box.skewBG || 0);
      if (top > m) m = top;
    }
    // In sweep mode the 0x/½x variants can rise higher than the canonical curve —
    // scan them too so no variant clips above the y-axis.
    if (sweep && sweep.variants) {
      for (const v of sweep.variants) {
        for (let t = 0; t < v.bg.length; t++) if (v.bg[t] != null && v.bg[t] > m) m = v.bg[t];
      }
    }
    return Math.min(36, Math.max(16, Math.ceil((m + 2) / 2) * 2));
  }

  function clearYAxisAnimation() {
    if (editorYAxisDelayTimer) { clearTimeout(editorYAxisDelayTimer); editorYAxisDelayTimer = null; }
    if (editorYAxisAnimRAF) { cancelAnimationFrame(editorYAxisAnimRAF); editorYAxisAnimRAF = null; }
  }

  function resetEditorYAxisScale() {
    clearYAxisAnimation();
    editorYAxisMax = null;
    editorYAxisShrinkTarget = null;
    editorYAxisShrinkSince = 0;
    editorYAxisLastUpdate = 0;
  }

  function scheduleYAxisDraw() {
    if (editorYAxisAnimRAF || !active) return;
    editorYAxisAnimRAF = requestAnimationFrame(() => {
      editorYAxisAnimRAF = null;
      if (active) draw();
    });
  }

  // Akse-loftet vokser straks, men krymper først 10 sekunder efter den seneste
  // lavere beregning. Derefter falder det lineært og roligt, så et flyttet ikon
  // ikke får hele grafen til at springe i højde.
  function resolveEditorYMax() {
    const required = computeRequiredYMax();
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!Number.isFinite(editorYAxisMax)) {
      editorYAxisMax = required;
      editorYAxisLastUpdate = now;
      return editorYAxisMax;
    }

    if (required > editorYAxisMax) {
      clearYAxisAnimation();
      editorYAxisMax = required;
      editorYAxisShrinkTarget = null;
      editorYAxisShrinkSince = 0;
      editorYAxisLastUpdate = now;
      return editorYAxisMax;
    }

    if (required >= editorYAxisMax - 0.01) {
      clearYAxisAnimation();
      editorYAxisMax = required;
      editorYAxisShrinkTarget = null;
      editorYAxisShrinkSince = 0;
      editorYAxisLastUpdate = now;
      return editorYAxisMax;
    }

    // Under selve trækket fryses en tidligere større skala helt. Når markøren
    // slippes, starter den almindelige 10-sekunders ventetid fra begyndelsen.
    if (dragEv) {
      clearYAxisAnimation();
      editorYAxisShrinkTarget = null;
      editorYAxisShrinkSince = 0;
      editorYAxisLastUpdate = now;
      return editorYAxisMax;
    }

    if (editorYAxisShrinkTarget !== required) {
      clearYAxisAnimation();
      editorYAxisShrinkTarget = required;
      editorYAxisShrinkSince = now;
      editorYAxisLastUpdate = now;
      editorYAxisDelayTimer = setTimeout(() => {
        editorYAxisDelayTimer = null;
        editorYAxisLastUpdate = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        scheduleYAxisDraw();
      }, Y_AXIS_SHRINK_DELAY_MS);
      return editorYAxisMax;
    }

    if (now - editorYAxisShrinkSince < Y_AXIS_SHRINK_DELAY_MS) return editorYAxisMax;

    const elapsedSeconds = Math.min(0.1, Math.max(0, (now - editorYAxisLastUpdate) / 1000));
    editorYAxisLastUpdate = now;
    editorYAxisMax = Math.max(required, editorYAxisMax - Y_AXIS_SHRINK_RATE * elapsedSeconds);
    if (editorYAxisMax > required + 0.01) scheduleYAxisDraw();
    else {
      editorYAxisMax = required;
      editorYAxisShrinkTarget = null;
    }
    return editorYAxisMax;
  }

  // Mirror the frames into the global arrays the game's drawGraph reads.
  // cgmDataPoints = the BG curve as 5-min dots (game cadence/look). physiology-
  // DataPoints = per-minute band inputs in the SAME units as the game, so the
  // game's band normalisation applies unchanged → bands look exactly like the
  // game. Mutated in place so any held reference stays valid.
  function syncData() {
    // The editor shows the true-BG LINE (deterministic truth), not CGM dots — so
    // it feeds per-minute trueBgPoints and leaves cgmDataPoints empty.
    cgmDataPoints.length = 0;
    trueBgPoints.length = 0;
    physiologyDataPoints.length = 0;
    // Sweep mode draws its own 5 BG curves via drawOverlay — leave the global arrays
    // empty so drawGraph paints no single hero line and no physiology bands.
    if (sweep) return;
    for (let t = 0; t < frames.length; t++) {
      const fr = frames[t]; if (!fr) continue;
      trueBgPoints.push({ time: t, value: fr.bg });
      physiologyDataPoints.push({
        time: t,
        basalPlasmaMU: fr.basalPlasma,
        rapidPlasmaMU: fr.rapidPlasma,
        carbAbsorption: fr.carbAbs,
        currentISF: fr.currentISF,
        ketoneLevel: fr.ket
      });
    }
  }

  // Publish the scroll window + band toggles + profile-derived band-norm fields
  // so drawGraph renders this editor frame. Cheap — safe to call per draw.
  function syncView() {
    // Bands + keto line can't be stacked across sweep variants — force them off
    // while a sweep is active (BG-only mode), else follow the player's toggle.
    const bandsOn = showBands && !sweep;
    showInsulinBand = showCarbBand = showISFLine = showKetoneLine = bandsOn;
    // printMode lets drawGraph soften print-only details (e.g. the night shading,
    // which reads far heavier on a white page than over the dark UI).
    graphViewOverride = { startMin: viewStart, widthMin: viewSpanMin, isLive: false, yAxisMax: resolveEditorYMax(), printMode: printRender };
    facade.weight = profile.weight;
    facade.ICR = profile.icr;
    facade.ISF = profile.isf;
    facade.basalPlasmaInsulinBaseline = (engine && engine.basalPlasmaInsulinBaseline) || 75;
  }

  // Render = sync globals, then run the GAME's renderer. drawGraph calls
  // drawOverlay() at its end (inside its dpr transform) for the editor layer.
  function draw() {
    if (!active || !ctx || !canvas) return;
    syncView();
    if (typeof drawGraph === 'function') drawGraph();
    syncScrollbar();   // keep the scrollbar thumb correct across resizes / scrolling
    if (!printRender) updateSweepCloseChip();   // sync the floating "close what-if" chip
  }

  // drawOverlay — invoked BY drawGraph (end of frame) with the graph's exact
  // metrics { padding, graphWidth, graphHeight, bgToY, timeToX, activityBandY,
  // bandScale, anyBandsActive, carbBandVisible, yAxisMin/Max }. Draws the editor
  // layer (draggable event markers + inspection cursor) on top of the finished
  // game graph, in the game's coordinate system, so it aligns pixel-perfectly.
  function drawOverlay(octx, m) {
    octx.globalAlpha = 1; octx.shadowBlur = 0; octx.shadowColor = 'transparent'; octx.setLineDash([]);
    lastMetrics = m;
    // Static zZz sleep haze drifting up off the BG curve through the night, with a
    // clear gap wherever the character was awake. This is the sole sleep-cost cue in
    // the editor — the haze itself shows where (and how much) sleep was lost, so no
    // icon/label is drawn. Rendered on screen AND in the print snapshot. Søvnen
    // tilhører det fælles scenarie og skal derfor også være synlig, mens What-if
    // sammenligner alternative kurver.
    drawSleepBubbles(octx, m);
    drawPlayedBoundary(octx, m);
    // Den grå, stiplede reference viser det oprindeligt spillede forløb. Den
    // aktuelle blå kurve tegnes fortsat af den fælles graf-renderer.
    drawSourceCurve(octx, m);
    drawSourceIncidentMarkers(octx, m);
    drawAlternativeBoxHitMarkers(octx, m);
    // Sweep curves go UNDER the markers/cursor so the draggable icons stay on top.
    if (sweep && sweep.variants && sweep.variants.length) drawSweep(octx, m);
    drawMarkers(m);
    const gapEv = dragEv || hoverEv;   // neighbour-gap guides while dragging OR hovering
    if (gapEv) drawNeighborGaps(gapEv, m);
    drawCursor(m);
    // The single death marker belongs to the canonical curve; in sweep mode each
    // variant shows its own death dot instead.
    if (!sweep) drawDeathMarker(m);
  }

  // Tegn Box Challenge-kasser under kurverne via drawGraph-hooket. De kopieres
  // fra den pausede udfordring og har ingen hit-test eller editor-hændelse.
  function drawLockedBoxes(octx, m) {
    if (sourceMode !== 'boxchallenge' || !lockedBoxes.length) return;
    const viewEnd = viewStart + viewSpanMin;
    const visible = lockedBoxes.filter(box => box.endMin >= viewStart && box.startMin <= viewEnd);
    if (!visible.length) return;

    octx.save();
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();

    visible.forEach(box => {
      const hitByAlternative = alternativeBoxHits.some(hit => hit.box === box);
      const crossed = box.hit || hitByAlternative;
      const start = Math.max(viewStart, box.startMin);
      const end = Math.min(viewEnd, box.endMin);
      const duration = Math.max(1, box.endMin - box.startMin);
      const startFraction = (start - box.startMin) / duration;
      const endFraction = (end - box.startMin) / duration;
      const skew = box.skewBG || 0;
      const x1 = m.timeToX(start);
      const x2 = m.timeToX(end);
      const yTopL = m.bgToY(box.bgMax + skew * startFraction);
      const yBottomL = m.bgToY(box.bgMin + skew * startFraction);
      const yTopR = m.bgToY(box.bgMax + skew * endFraction);
      const yBottomR = m.bgToY(box.bgMin + skew * endFraction);

      const path = () => {
        octx.beginPath();
        octx.moveTo(x1, yTopL);
        octx.lineTo(x2, yTopR);
        octx.lineTo(x2, yBottomR);
        octx.lineTo(x1, yBottomL);
        octx.closePath();
      };

      path();
      octx.fillStyle = crossed ? 'rgba(80, 80, 80, 0.30)' : 'rgba(4, 8, 18, 0.76)';
      octx.fill();
      octx.lineWidth = crossed ? 1.5 : 2;
      octx.strokeStyle = crossed ? 'rgba(150, 150, 150, 0.48)' : 'rgba(248, 113, 113, 0.88)';
      octx.stroke();

      if (crossed) {
        octx.strokeStyle = 'rgba(255, 100, 100, 0.55)';
        octx.lineWidth = 2;
        octx.beginPath();
        octx.moveTo(x1 + 5, yTopL + 5); octx.lineTo(x2 - 5, yBottomR - 5);
        octx.moveTo(x2 - 5, yTopR + 5); octx.lineTo(x1 + 5, yBottomL - 5);
        octx.stroke();
      }

      // En lille vektorhængelås viser, at kassen er fast scenarieindhold.
      const centerX = (x1 + x2) / 2;
      const centerY = (yTopL + yTopR + yBottomL + yBottomR) / 4;
      const boxWidth = Math.abs(x2 - x1);
      const boxHeight = Math.abs(((yBottomL + yBottomR) - (yTopL + yTopR)) / 2);
      if (boxWidth >= 22 && boxHeight >= 20) {
        octx.strokeStyle = 'rgba(226, 232, 240, 0.82)';
        octx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        octx.lineWidth = 1.5;
        octx.beginPath();
        octx.arc(centerX, centerY - 4, 4, Math.PI, 0);
        octx.stroke();
        octx.beginPath();
        octx.roundRect(centerX - 6, centerY - 4, 12, 10, 2);
        octx.fill();
        octx.stroke();
      }
    });
    octx.restore();
  }

  // Tegn faste stress-/sygdomshændelser under kurverne. Markørerne kommer fra
  // den spillede bane og har med vilje ingen interaktion i Hvad Nu Hvis.
  function drawLockedEvents(octx, m) {
    if (!lockedEvents.length) return;
    const viewEnd = viewStart + viewSpanMin;

    const drawMarkerIdentity = (marker, centerX) => {
      const iconSize = marker.iconSize || 24;
      if (typeof marker.icon === 'string' && /\.(png|webp|svg)$/i.test(marker.icon) &&
          typeof _getFoodIconImage === 'function') {
        const image = _getFoodIconImage(marker.icon);
        if (image.complete && image.naturalWidth > 0) {
          octx.drawImage(image, centerX - iconSize / 2, m.padding.top + 7, iconSize, iconSize);
        }
      }

      if (marker.labelKey && typeof t === 'function') {
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.font = `${marker.labelWeight || '700'} ${marker.labelFontSize || 11}px Inter, "Segoe UI", sans-serif`;
        octx.fillStyle = marker.labelColor || 'rgba(226, 232, 240, 0.92)';
        octx.fillText(t(marker.labelKey), centerX, m.padding.top + 43);
        octx.textBaseline = 'alphabetic';
      }
    };

    octx.save();
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();

    for (const event of lockedEvents) {
      const marker = event.marker;
      if (!marker) continue;

      if (marker.type === 'interval') {
        if (marker.endMin < viewStart || marker.startMin > viewEnd) continue;
        const startMin = Math.max(viewStart, marker.startMin);
        const endMin = Math.min(viewEnd, marker.endMin);
        const x1 = m.timeToX(startMin);
        const x2 = m.timeToX(endMin);
        const bandTop = m.padding.top + 30;
        const bandBottom = m.padding.top + m.graphHeight - 25;

        octx.fillStyle = marker.bandColor || 'rgba(245, 158, 11, 0.10)';
        octx.fillRect(x1, bandTop, Math.max(1, x2 - x1), bandBottom - bandTop);
        octx.setLineDash([4, 4]);
        octx.strokeStyle = marker.lineColor || 'rgba(245, 158, 11, 0.45)';
        octx.lineWidth = 1.5;
        octx.beginPath();
        octx.moveTo(x1, bandTop); octx.lineTo(x1, bandBottom);
        octx.moveTo(x2, bandTop); octx.lineTo(x2, bandBottom);
        octx.stroke();
        octx.setLineDash([]);
        drawMarkerIdentity(marker, (x1 + x2) / 2);
      } else if (Number.isFinite(marker.timeMin) && marker.timeMin >= viewStart && marker.timeMin <= viewEnd) {
        const x = m.timeToX(marker.timeMin);
        octx.setLineDash([4, 4]);
        octx.strokeStyle = marker.lineColor || 'rgba(156, 163, 175, 0.45)';
        octx.lineWidth = 1.5;
        octx.beginPath();
        octx.moveTo(x, m.padding.top + 30);
        octx.lineTo(x, m.padding.top + m.graphHeight - 25);
        octx.stroke();
        octx.setLineDash([]);
        drawMarkerIdentity(marker, x);
      }
    }
    octx.restore();
  }

  // Gør overgangen mellem det spillede forløb og fremskrivningen synlig. Den
  // tonede højre side viser fortsat kurvens konsekvenser, men er ikke redigerbar.
  function drawPlayedBoundary(octx, m) {
    if (!Number.isFinite(playedUntilMin)) return;
    const viewEnd = viewStart + viewSpanMin;
    if (playedUntilMin < viewStart || playedUntilMin > viewEnd) return;

    const x = m.timeToX(playedUntilMin);
    const right = m.padding.left + m.graphWidth;
    octx.save();
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();

    if (x < right) {
      // Brug samme visuelle sprog som deaktiverede knapper: reducer farvemætningen
      // og mørkn området. Fremskrivningen kan stadig aflæses, men ligner ikke en
      // aktiv eller allerede spillet del af banen.
      octx.globalCompositeOperation = 'saturation';
      octx.fillStyle = 'rgba(128, 128, 128, 0.82)';
      octx.fillRect(x, m.padding.top, right - x, m.graphHeight);
      octx.globalCompositeOperation = 'source-over';
      octx.fillStyle = 'rgba(2, 6, 23, 0.24)';
      octx.fillRect(x, m.padding.top, right - x, m.graphHeight);
    }

    octx.beginPath();
    octx.moveTo(x, m.padding.top);
    octx.lineTo(x, m.padding.top + m.graphHeight);
    octx.setLineDash([]);
    octx.lineWidth = 2;
    octx.strokeStyle = 'rgba(34, 211, 238, 0.92)';
    octx.shadowColor = 'rgba(34, 211, 238, 0.45)';
    octx.shadowBlur = 8;
    octx.stroke();

    const label = t(sourceMode === 'boxchallenge' ? 'editor.boundary.box.label' : 'editor.boundary.label');
    octx.shadowBlur = 0;
    octx.font = '600 12px Inter, sans-serif';
    const labelWidth = octx.measureText(label).width + 16;
    const placeLeft = x + labelWidth + 8 > right;
    const labelX = placeLeft ? x - labelWidth - 6 : x + 6;
    const labelY = m.padding.top + 12;
    octx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    octx.beginPath();
    octx.roundRect(labelX, labelY, labelWidth, 24, 6);
    octx.fill();
    octx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    octx.lineWidth = 1;
    octx.stroke();
    octx.fillStyle = '#a5f3fc';
    octx.textBaseline = 'middle';
    octx.fillText(label, labelX + 8, labelY + 12);
    octx.restore();
  }

  function drawSourceCurve(octx, m) {
    if (!sourceBg.length) return;
    const start = Math.max(0, Math.floor(viewStart));
    const end = Math.min(totalMin - 1, Math.ceil(viewStart + viewSpanMin));
    octx.save();
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();
    octx.beginPath();
    let drawing = false;
    const visiblePoints = [];
    for (const point of sourceBg) {
      if (!point || point.t < start || point.t > end || !Number.isFinite(point.bg)) continue;
      visiblePoints.push(point);
      const x = m.timeToX(point.t);
      const y = m.bgToY(point.bg);
      if (!drawing) { octx.moveTo(x, y); drawing = true; }
      else octx.lineTo(x, y);
    }
    octx.setLineDash([8, 7]);
    octx.lineWidth = 2;
    octx.strokeStyle = 'rgba(203, 213, 225, 0.78)';
    octx.shadowColor = 'rgba(15, 23, 42, 0.75)';
    octx.shadowBlur = 3;
    octx.stroke();

    octx.restore();
  }

  // hash01 — deterministic pseudo-random in [0,1) from an integer seed. Used to
  // give the sleep glyphs an organic jitter that stays FIXED across redraws (the
  // editor curve is a static overview, so no Math.random / time-based animation).
  function hash01(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // drawSleepBubbles — the editor's static mirror of the game's rising "zZz" sleep
  // bubbles (drawSymptomOverlay in ui.js). Reuses the same glyphs, colour and glow,
  // but is fully static: a haze of small z's drifting up off the BG curve through
  // every stretch the character is ASLEEP. The asleep stretches are the night band
  // (22:00-07:00) MINUS the awake stripes (sleepAwakenings) — so a night-time wake
  // leaves a clear gap in the haze, exactly where drawGraph also erased the night
  // shading. The glyphs are pure canvas text (no PNG), so they are taint-safe and
  // render in the file:// print snapshot too — print just swaps the light-blue/glow
  // (invisible on white paper) for a muted indigo that reads on the page.
  function drawSleepBubbles(octx, m) {
    const viewEnd = viewStart + viewSpanMin;

    // 1) Night intervals (22:00->24:00 and 00:00->07:00) for every day in view.
    const night = [];
    for (let d = Math.floor(viewStart / 1440); d <= Math.floor((viewEnd - 1) / 1440); d++) {
      const base = d * 1440;
      night.push([base + 22 * 60, base + 24 * 60]);
      night.push([base, base + 7 * 60]);
    }
    // 2) Subtract the awake stripes — the character is up, so no sleep haze there.
    const holes = (sleepAwakenings || []).map(aw => [aw.startMin, aw.endMin]);
    let asleep = [];
    for (const [a0, b0] of night) {
      let segs = [[Math.max(a0, viewStart), Math.min(b0, viewEnd)]];
      for (const [h0, h1] of holes) {
        const next = [];
        for (const [s0, s1] of segs) {
          if (h1 <= s0 || h0 >= s1) { next.push([s0, s1]); continue; } // no overlap
          if (h0 > s0) next.push([s0, h0]);   // keep the part before the hole
          if (h1 < s1) next.push([h1, s1]);   // keep the part after the hole
        }
        segs = next;
      }
      asleep.push(...segs);
    }
    asleep = asleep.filter(([a, b]) => b - a > 6);   // drop sub-6-min slivers
    if (!asleep.length) return;

    octx.save();
    // Clip to the chart area so glyphs near the night edges or above a high curve
    // do not leak outside the plot (same clip the game uses for its bubbles).
    octx.beginPath();
    octx.rect(m.padding.left, m.padding.top, m.graphWidth, m.graphHeight);
    octx.clip();
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';

    // Screen: light blue-white with a soft glow over the dark night band (same as
    // the game). Print: a muted indigo with little glow and a higher base alpha, so
    // the glyphs read on a white page (light blue would vanish on paper).
    const C = printRender ? '92, 108, 168' : '200, 225, 255';
    const baseAlpha = printRender ? 0.85 : 0.55;
    const glowBase = printRender ? 0 : 3;
    const glowSpan = printRender ? 1.5 : 7;
    const GLYPHS = ['z', 'zZ', 'Zz'];
    const STEP = 24;                       // one glyph per ~24 sim-min -> a 1 h wake = clear gap
    const RISE = 22;                       // px a rising triplet climbs before it resets

    for (const [a, b] of asleep) {
      // Sample on a global grid (multiples of STEP) so glyph positions stay put
      // regardless of where a segment happens to start/end after an awakening.
      const first = Math.ceil(a / STEP) * STEP;
      let k = 0;
      for (let tt = first; tt <= b; tt += STEP, k++) {
        const fr = frames[tt];
        if (!fr) continue;
        const p = (k % 3) / 3;             // 0, 1/3, 2/3 — a little puff rising in threes
        const x = m.timeToX(tt) + (hash01(tt) - 0.5) * 10;
        const y = m.bgToY(fr.bg) - 9 - p * RISE - hash01(tt * 1.7 + 3) * 4;
        const size = 9 + p * 5;            // higher in the puff -> bigger (cartoon perspective)
        const alpha = baseAlpha * (1 - p * 0.5); // ...and fainter / more diffuse
        octx.font = `italic bold ${size.toFixed(0)}px Inter, "Segoe UI", sans-serif`;
        octx.shadowColor = `rgba(${C}, ${(alpha * 0.8).toFixed(3)})`;
        octx.shadowBlur = glowBase + p * glowSpan;
        octx.fillStyle = `rgba(${C}, ${alpha.toFixed(3)})`;
        octx.fillText(GLYPHS[k % 3], x, y);
      }
    }
    octx.shadowBlur = 0; octx.shadowColor = 'transparent';
    octx.restore();
  }

  // While dragging an event, show the time gap to the NEAREST neighbour event on
  // each side (max one before + one after) when it is within 2 hours — so you can
  // time a bolus relative to a meal, or an activity relative to carbs eaten. A thin
  // dashed line spans the two icons with the gap (e.g. "45 min", "1t 20m") on it.
  const GAP_WINDOW_MIN = 120;
  function fmtGap(min) {
    min = Math.round(min);
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), mm = min % 60;
    return h + 't' + (mm ? ' ' + mm + 'm' : '');
  }
  function drawNeighborGaps(ev, m) {
    const t0 = ev.t;
    let before = null, after = null;
    for (const e of events) {
      if (e === ev) continue;
      const dt = e.t - t0;
      if (dt < 0 && dt >= -GAP_WINDOW_MIN) { if (!before || e.t > before.t) before = e; }
      else if (dt > 0 && dt <= GAP_WINDOW_MIN) { if (!after || e.t < after.t) after = e; }
    }
    if (!before && !after) return;
    const xRef = m.timeToX(t0);
    // Draw the measuring line above the icon AND clear of its value label (which sits at
    // ~icon-top − 4, up to ~29 px above the icon centre for a meal), so the line + its
    // gap pill do not collide with the "5 E" / "250 g" labels.
    const yBase = (ev._my != null ? ev._my : (m.activityBandY - 6));
    const y = yBase - 42;
    for (const nb of [before, after]) {
      if (!nb) continue;
      drawGapConnector(m, xRef, m.timeToX(nb.t), y, Math.abs(nb.t - t0));
    }
  }
  function drawGapConnector(m, x1, x2, y, gapMin) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.setLineDash([]);
    // small end ticks
    ctx.beginPath();
    ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4);
    ctx.moveTo(x2, y - 4); ctx.lineTo(x2, y + 4);
    ctx.stroke();
    // time label in a small pill ABOVE the midpoint, so it does not cover the line itself
    const label = fmtGap(gapMin);
    ctx.font = 'bold 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const mx = (x1 + x2) / 2;
    const ly = y - 15;   // lift the pill clear of the measuring line
    ctx.fillStyle = 'rgba(20, 29, 47, 0.92)';
    ctx.beginPath(); ctx.roundRect(mx - tw / 2 - 6, ly - 9, tw + 12, 18, 9); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(label, mx, ly);
    ctx.restore();
  }

  // Death marker — the curve stops at deathInfo.t; mark it with a calm medical
  // cross (not a morbid skull) + the cause text, so the lesson is "this is where
  // it went wrong", told gently.
  // drawDeathMark — the calm medical cross + cause-label pill at (x, y) on context
  // c. Shared by the normal single-curve death marker AND each dead sweep variant,
  // so a death looks identical everywhere. Returns the pill's top y (for stacking).
  function drawDeathMark(c, x, y, cause) {
    c.save();
    c.textAlign = 'center';
    // soft halo + chip
    c.beginPath(); c.arc(x, y, 16, 0, 7); c.fillStyle = 'rgba(248,113,113,0.16)'; c.fill();
    c.beginPath(); c.arc(x, y, 11, 0, 7); c.fillStyle = 'rgba(20,29,47,0.95)'; c.fill();
    c.strokeStyle = 'rgba(248,113,113,0.85)'; c.lineWidth = 1.5; c.stroke();
    // medical cross
    c.strokeStyle = '#fca5a5'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y - 5); c.lineTo(x, y + 5);
    c.moveTo(x - 5, y); c.lineTo(x + 5, y);
    c.stroke();
    // cause label in a small pill above the marker
    const label = (typeof t === 'function' && cause) ? (t('editor.death.' + cause) || '') : '';
    let pillTop = y - 16;
    if (label) {
      c.font = 'bold 11px Inter, "Segoe UI", sans-serif';
      const tw = c.measureText(label).width;
      const ly = y - 24;
      c.fillStyle = 'rgba(20,29,47,0.92)';
      c.beginPath(); c.roundRect(x - tw / 2 - 7, ly - 9, tw + 14, 18, 9); c.fill();
      c.fillStyle = '#fecaca'; c.textBaseline = 'middle';
      c.fillText(label, x, ly);
      pillTop = ly - 9;
    }
    c.restore();
    return pillTop;
  }

  function drawDeathMarker(m) {
    if (!deathInfo || deathInfo.t < viewStart || deathInfo.t > viewStart + viewSpanMin) return;
    const x = m.timeToX(deathInfo.t);
    const fr = frames[deathInfo.t];
    const y = fr ? m.bgToY(fr.bg) : m.padding.top + m.graphHeight / 2;
    drawDeathMark(ctx, x, y, deathInfo.cause);
  }

  // Tegn låste livstab på den grå referencekurve med præcis samme rolige,
  // røde krydsmarkør som et fatalt udfald på den redigerede kurve.
  function drawSourceIncidentMarkers(octx, m) {
    if (sourceMode !== 'boxchallenge' || !sourceIncidents.length) return;
    const viewEnd = viewStart + viewSpanMin;
    for (const incident of sourceIncidents) {
      if (incident.t < viewStart || incident.t > viewEnd) continue;
      drawDeathMark(octx, m.timeToX(incident.t), m.bgToY(incident.bg), incident.cause);
    }
  }

  // Den alternative blå kurve fortsætter efter en kollision, så spilleren stadig
  // kan se de fysiologiske konsekvenser. Selve kollisionen markeres tydeligt med
  // samme røde kryds som et mistet liv i det oprindelige forløb.
  function drawAlternativeBoxHitMarkers(octx, m) {
    if (sourceMode !== 'boxchallenge' || !alternativeBoxHits.length) return;
    const viewEnd = viewStart + viewSpanMin;
    for (const hit of alternativeBoxHits) {
      if (hit.t < viewStart || hit.t > viewEnd) continue;
      drawDeathMark(octx, m.timeToX(hit.t), m.bgToY(hit.bg), 'box');
    }
  }

  // (drawBands / drawAxes / computeYRange removed — BG zones, physiology bands,
  //  boundary lines, the BG curve and the axes now all come from the game's
  //  drawGraph; see the RENDERER BRIDGE section above. Only the editor-specific
  //  markers + cursor remain, drawn on top via drawOverlay.)

  // markerPrintColor — flat colour for the vector dot a marker becomes in print-render
  // mode (one per kind; activity uses its own type colour).
  function markerPrintColor(ev) {
    if (ev.kind === 'meal') return '#f59e0b';
    if (ev.kind === 'bolus') return '#38bdf8';
    if (ev.kind === 'basal') return '#818cf8';
    if (ev.kind === 'glucagon') return '#f472b6';
    if (ev.kind === 'activity') {
      const td = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[ev.actType] : null;
      return (td && td.farve) || '#10b981';
    }
    return '#94a3b8';
  }

  function markerLabel(ev) {
    const u = t('editor.unit.insulin');
    switch (ev.kind) {
      case "bolus": return ev.units + " " + u;
      // No "Basal" word — the basal-syringe icon already says what it is.
      case "basal": return ev.units + " " + u;
      // Show the PORTION weight (the whole food), not just the carb grams.
      case "meal": return Math.round(ev.weight) + " g";
      case "activity": return (ev.durationMin || 0) + " min" + (ev.intensity ? " · " + ev.intensity : "");
      case "glucagon": return t('editor.event.glucagon');
      default: return "";
    }
  }

  // Icon-baseline geometry — based on the game's _eventLayout (ui.js): icons sit
  // just above the activity band (and above any visible physiology bands) and stack
  // upward. The editor uses a TALLER slot step than the game's 22 px: editor events
  // are placed deliberately and often land at the same time, so a bigger step keeps
  // stacked icons (+ their labels) from colliding (the game rarely stacks live).
  //
  // Stacking headroom is PER CLUSTER, not global: a stack at time t may grow upward
  // until it nears the BG curve AT THAT x. A meal+bolus+basal cluster sitting under a
  // high curve (e.g. post-spike at midday) gets plenty of slots, while one under a low
  // morning curve gets fewer. (The old code clamped EVERY stack by the single lowest
  // BG anywhere in the window, so one early-morning dip starved the whole day of slots.)
  function markerGeom(m) {
    const SLOT_STEP = 46, ICON_HALF_W = 14;
    let baseY = m.activityBandY - 6;
    if (m.anyBandsActive) {
      const bandZeroY = m.bgToY(0);
      const carbTopMargin = m.carbBandVisible ? (17 * m.bandScale) : 0;
      // Lift the baseline clear of the physiology band/lines so the lowest icon (and
      // its label, now drawn ABOVE the icon) does not sit on the Carbs/Basal/… traces.
      baseY = Math.min(baseY, bandZeroY - carbTopMargin - 14);
    }
    // How close the TOP icon may climb toward the BG curve before the stack stops
    // growing. Kept small so the stack can reach near the curve (a tall meal+bolus+
    // basal cluster gets its slots); the top icon's small label may overlap the curve
    // line a little, which reads fine — you can still see the curve behind/in front.
    const CURVE_MARGIN = 16, ABS_MAX_SLOTS = 6;
    // maxSlotsAt(t): how many stacking slots a cluster at minute t may use — derived
    // from the gap between the baseline and the local BG curve (never below BG 3, so a
    // low curve still allows the base slot).
    function maxSlotsAt(t) {
      const fr = frames[Math.round(t)];
      const bg = (fr && isFinite(fr.bg)) ? fr.bg : 3;
      const curveY = m.bgToY(Math.max(3, bg));
      const room = baseY - (curveY + CURVE_MARGIN);   // px available above slot 0
      const extra = room > 0 ? Math.floor(room / SLOT_STEP) : 0;
      return Math.max(1, Math.min(ABS_MAX_SLOTS, 1 + extra));
    }
    return { baseY, SLOT_STEP, ICON_HALF_W, maxSlotsAt };
  }

  // Greedy sweep (same algorithm as the game): assign each visible event the
  // lowest free slot among neighbours within one icon width → ev._slotTarget.
  // Each event's slot is capped by its OWN local headroom (maxSlotsAt), so events
  // under a high curve can stack tall while events under a low curve stay short.
  function assignTargets(m, g) {
    g = g || markerGeom(m);
    const vis = events.filter(e => e.t >= viewStart - 30 && e.t <= viewStart + viewSpanMin + 30)
      .map(e => ({ e, x: m.timeToX(e.t), slot: 0 })).sort((a, b) => a.x - b.x);
    for (let i = 0; i < vis.length; i++) {
      const occ = [];
      for (let j = i - 1; j >= 0; j--) { if (vis[i].x - vis[j].x > g.ICON_HALF_W * 2) break; occ.push(vis[j].slot); }
      const cap = g.maxSlotsAt(vis[i].e.t);
      let slot = 0; while (occ.includes(slot) && slot < cap) slot++;
      vis[i].slot = Math.min(slot, cap - 1);
      vis[i].e._slotTarget = vis[i].slot;
    }
  }

  function drawMarkers(m) {
    for (const e of events) e._mx = null;          // clear stale hit-boxes
    const g = markerGeom(m);
    if (!dragEv) assignTargets(m, g);              // freeze stacking while dragging
    const snap = !levelAnimRAF;                    // snap unless a settle is animating
    const vis = events.filter(e => e.t >= viewStart - 30 && e.t <= viewStart + viewSpanMin + 30);
    for (const ev of vis) {
      if (ev._slot == null) ev._slot = ev._slotTarget || 0;
      if (snap) ev._slot = ev._slotTarget || 0;
      const x = m.timeToX(ev.t);
      let my = g.baseY - ev._slot * g.SLOT_STEP;
      // Activities draw a duration bar BELOW the icon (drawOneMarker: my + size/2 -1,
      // height 4). At the baseline that bar dips into the physiology band/line zone at
      // the bottom (or past the chart edge when bands are off). Lift the activity icon
      // just enough that the whole bar clears that zone and sits in the clean plot.
      if (ev.kind === 'activity') {
        const barBottom = my + 30 / 2 + 3;                       // size 30 → my + 18
        const bandTop = m.anyBandsActive
          ? m.bgToY(0) - (m.carbBandVisible ? 17 * m.bandScale : 0)
          : (m.padding.top + m.graphHeight);
        const maxBottom = bandTop - 2;
        if (barBottom > maxBottom) my -= (barBottom - maxBottom);
      }
      drawOneMarker(m, ev, x, my);
      ev._mx = x; ev._my = my;                     // hit-box for eventAt()
    }
  }

  // One marker, drawn like the game's on-graph icons: a centred bitmap icon, a
  // label, and (for activity) a duration bar to the end time.
  function drawOneMarker(m, ev, x, my) {
    const size = ev.kind === 'meal' ? 34 : ev.kind === 'activity' ? 30 : ev.kind === 'glucagon' ? 28 : 26;
    ctx.save();
    ctx.textAlign = 'center';
    // Subtle vertical guide running the full height at the event's x: from the BG
    // curve at this time, down through the icon, to the time axis — so the marker
    // ties visually to both the curve and the clock below. Drawn first (under the
    // icon + label). Same faint dashed style as the game's marker stems.
    const gf = frames[Math.round(ev.t)];
    const curveY = (gf && isFinite(gf.bg)) ? m.bgToY(gf.bg) : my;
    const guideTopY = Math.min(curveY, my - 2);   // also cover the icon if it sits above the curve
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 210, 235, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, guideTopY);
    ctx.lineTo(x, m.padding.top + m.graphHeight);
    ctx.stroke();
    ctx.restore();
    // soft highlight when dragging or when the engine rejected the event
    if (ev._drag || ev.rejected) {
      ctx.beginPath(); ctx.arc(x, my, size / 2 + 6, 0, 7);
      ctx.fillStyle = ev.rejected ? 'rgba(239,68,68,0.18)' : 'rgba(125,211,252,0.22)';
      ctx.fill();
    }
    // Active what-if sweep marker: drawn on top of the icon by drawSweepHalo().
    const isSwept = !!(sweep && sweep.eventId === ev.id);
    // activity duration bar under the icon (same look as the game)
    if (ev.kind === 'activity' && ev.durationMin > 0) {
      const typeDef = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[ev.actType] : null;
      if (typeDef && typeDef.farve) {
        const barY = my + size / 2 - 1, barH = 4;
        const xEnd = m.timeToX(ev.t + ev.durationMin);
        const barW = Math.max(8, xEnd - x);
        ctx.fillStyle = typeDef.farve + '50';
        ctx.beginPath(); ctx.roundRect(x - 4, barY, barW + 4, barH, barH / 2); ctx.fill();
        ctx.fillStyle = typeDef.farve + '70';
        ctx.beginPath(); ctx.roundRect(x - 4, barY, barW + 4, 1.5, [barH / 2, barH / 2, 0, 0]); ctx.fill();
      }
    }
    // icon (centred at x, my). In print-render mode draw a plain vector dot instead of
    // the PNG (PNGs taint the canvas on file:// and break toDataURL — see printRender).
    if (printRender) {
      const r = Math.max(6, size / 2 - 4);
      ctx.beginPath(); ctx.arc(x, my, r, 0, 7);
      ctx.fillStyle = markerPrintColor(ev); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
    } else {
      // Aktivitetstypen ejer sit ikon i AKTIVITETSTYPER. Brug derfor samme sko,
      // vægt eller bold som i aktivitetsvælgeren og popup'en; det fælles skoikon
      // er kun fallback for gamle eller ugyldige scenariedata.
      const activityTypeDef = ev.kind === 'activity' && typeof AKTIVITETSTYPER !== 'undefined'
        ? AKTIVITETSTYPER[ev.actType]
        : null;
      const activityIcon = activityTypeDef && foodIconImage(activityTypeDef.icon);
      const im = (ev.kind === 'meal' && foodIconImage(ev.icon)) || activityIcon || ICONS[ev.kind];
      if (im && im.complete && im.naturalWidth) {
        ctx.globalAlpha = ev.rejected ? 0.55 : 1;
        ctx.drawImage(im, x - size / 2, my - size / 2, size, size);
        ctx.globalAlpha = 1;
      }
    }
    // Active what-if sweep: a soft glow ring that slowly pulses in colour between the
    // BG-curve blue and lilac. Calm, not distracting. Continuous redraw is driven by
    // startSweepAnim() while a sweep is open.
    if (isSwept) drawSweepHalo(x, my, size);
    // label just ABOVE the icon (like the game's on-graph labels) — kept close to the
    // icon. Drawn above so the bottom icon's label points up, away from the physiology
    // band/lines underneath the baseline.
    ctx.fillStyle = ev.rejected ? 'rgba(239,68,68,0.95)' : 'rgba(210,222,240,0.95)';
    ctx.font = 'bold 10px Inter, Segoe UI, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(markerLabel(ev), x, my - size / 2 - 4);
    ctx.restore();
  }

  // drawSweepHalo — the marker for the event that currently owns the what-if sweep.
  // A soft glow ring whose colour gently pulses between the BG-curve blue and lilac
  // (the warm end of the sweep palette), with the glow/alpha breathing in step. Calm
  // and quiet — just enough to say "this event is being explored".
  function drawSweepHalo(x, my, size) {
    const t = (Math.sin(performance.now() / SWEEP_PULSE_MS * Math.PI * 2) + 1) / 2;  // 0..1 pulse
    const c1 = [130, 165, 255];   // BG-curve blue (ui.js trueBg line)
    const c2 = [168, 85, 247];    // lilac
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    const col = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    const R = size / 2 + 7;
    ctx.save();
    // faint filled halo, breathing slightly with the pulse
    ctx.beginPath(); ctx.arc(x, my, R, 0, 7);
    ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (0.09 + 0.07 * t).toFixed(3) + ')';
    ctx.fill();
    // glowing ring
    ctx.beginPath(); ctx.arc(x, my, R, 0, 7);
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.shadowBlur = 5 + 5 * t; ctx.shadowColor = col;
    ctx.globalAlpha = 0.55 + 0.4 * t;
    ctx.stroke();
    ctx.restore();
  }

  // Re-stack + animate after a drag: recompute slot targets (drag is over) then
  // ease each displayed slot toward its target so icons glide, not hop (#11).
  function settleMarkers() {
    if (lastMetrics) assignTargets(lastMetrics);
    if (levelAnimRAF) cancelAnimationFrame(levelAnimRAF);
    levelAnimRAF = requestAnimationFrame(stepLevelAnim);
  }
  function stepLevelAnim() {
    let moving = false;
    for (const ev of events) {
      const tgt = ev._slotTarget != null ? ev._slotTarget : 0;
      if (ev._slot == null) { ev._slot = tgt; continue; }
      const d = tgt - ev._slot;
      if (Math.abs(d) > 0.02) { ev._slot += d * 0.28; moving = true; }
      else ev._slot = tgt;
    }
    draw();   // renders eased _slot (levelAnimRAF truthy → no snap)
    levelAnimRAF = moving ? requestAnimationFrame(stepLevelAnim) : null;
  }

  // Drive the active what-if marker's pulsing glow. Runs only while a sweep is open;
  // self-terminates the moment `sweep` is cleared (from any of the call sites that null
  // it). Throttled to ~30 fps — the pulse is slow, so full-graph redraws at 60 fps
  // would be wasteful. The pulse phase reads performance.now() directly, so it stays
  // smooth regardless of the draw cadence.
  function startSweepAnim() {
    if (sweepAnimRAF || !sweep) return;
    let last = 0;
    const step = (ts) => {
      if (!sweep) { sweepAnimRAF = null; draw(); return; }   // sweep ended → one clean final frame
      if (ts - last >= 32) { last = ts; draw(); }
      sweepAnimRAF = requestAnimationFrame(step);
    };
    sweepAnimRAF = requestAnimationFrame(step);
  }

  function drawCursor(m) {
    if (cursorMin < viewStart || cursorMin > viewStart + viewSpanMin) return;
    const x = m.timeToX(cursorMin);
    const yTop = m.padding.top, yBot = m.padding.top + m.graphHeight;
    // Ved åbning står markøren præcis ved banens pausepunkt. Her er den cyan
    // grænselinje forklaring nok; undlad en ekstra stiplet linje oven i den.
    if (Math.abs(cursorMin - playedUntilMin) > 0.5) {
      ctx.strokeStyle = "rgba(125,211,252,0.8)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
      ctx.setLineDash([]);
    }
    // The cursor BG dot sits on the single curve, which is hidden in sweep mode
    // (5 variant curves instead) — so the dot would float on an invisible line.
    // Show it only when NOT sweeping.
    const fr = frames[Math.max(0, Math.min(frames.length - 1, Math.round(cursorMin)))];
    if (fr && !sweep) {
      ctx.fillStyle = "#7dd3fc"; ctx.beginPath(); ctx.arc(x, m.bgToY(fr.bg), 5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#0a1120"; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // ===========================================================================
  // WHOLE-PERIOD SUMMARY
  // ===========================================================================
  function updateSummary() {
    const n = frames.length;
    if (!n) return;
    let inT = 0, sum = 0;
    for (let t = 0; t < n; t++) {
      const b = frames[t] ? frames[t].bg : 5.5;
      sum += b;
      if (b >= 4 && b <= 10) inT++;
    }
    const tir = inT / n;
    // Feed the game's own stats fragment + points badge with whole-period values,
    // so the editor's bottom capsule looks exactly like the game's.
    const tirEl = document.getElementById('statsTirValue');
    if (tirEl) { tirEl.textContent = Math.round(tir * 100) + '%'; tirEl.style.color = tir > 0.7 ? '#4ade80' : tir > 0.5 ? '#fbbf24' : '#ef4444'; }
    const avgEl = document.getElementById('statsAvgBgValue');
    if (avgEl) avgEl.textContent = displayBG(sum / n);   // honour mmol/L vs mg/dL
    const ptsEl = document.getElementById('normoPointsDisplay');
    if (ptsEl) ptsEl.textContent = '—';
    // (the "Total" label is shown via body.mode-editor CSS, not JS, so leaving the
    //  editor doesn't leak an inline style onto the game's points badge.)
  }

  // ===========================================================================
  // INTERACTION (pointer events — unified mouse + touch)
  // ===========================================================================
  // Strategic placement model (works identically on PC and touch):
  //   - Tap / click an empty spot on the chart → move the LOCKED inspection
  //     cursor there. It then STAYS put (it does not follow the pointer), so you
  //     can aim deliberately and then tap a dock action to insert the event AT
  //     the cursor minute.
  //   - Tap a marker  → open its edit popup.
  //   - Drag a marker → move it in time. The curve recomputes live; the
  //     anti-overlap re-stacking is deferred to drag-release + animated
  //     (settleMarkers / drawMarkers), so icons don't "hop" every frame.
  const DRAG_THRESHOLD = 4;        // px of movement before a press becomes a drag
  let downX = 0, downY = 0, downEv = null;

  function inChart(px, py) {
    const rect = canvas.getBoundingClientRect();
    return px >= PAD.left && px <= rect.width - PAD.right &&
           py >= PAD.top - 8 && py <= rect.height - PAD.bottom;
  }
  function minuteAt(px) {
    const rect = canvas.getBoundingClientRect();
    const gw = rect.width - PAD.left - PAD.right;
    return viewStart + ((px - PAD.left) / gw) * viewSpanMin;
  }
  function clampCursor(m) {
    return Math.max(viewStart, Math.min(Math.min(viewStart + viewSpanMin, totalMin - 1), m));
  }
  function eventAt(px, py) {
    // Larger hit radius than the icon so taps are forgiving (touch-friendly).
    for (const ev of events) {
      if (ev._mx == null) continue;
      if (Math.abs(px - ev._mx) < 20 && Math.abs(py - ev._my) < 20) return ev;
    }
    return null;
  }
  function coords(e) {
    const r = canvas.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  }

  function onDown(e) {
    // Ignore a second pointer (e.g. a second finger) while a drag is in progress,
    // so it can't hijack dragEv and strand the first marker's drag highlight (#5).
    if (dragEv) return;
    const { px, py } = coords(e);
    downX = px; downY = py; dragMoved = false;
    const hit = eventAt(px, py);
    downEv = hit;
    if (hit) { dragEv = hit; hit._drag = true; canvas.style.cursor = "grabbing"; }
    // Pointer capture keeps move/up coming to the canvas even if the finger /
    // mouse slips outside it mid-drag.
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
  }
  function onMove(e) {
    const { px, py } = coords(e);
    if (dragEv) {
      if (!dragMoved && Math.abs(px - downX) < DRAG_THRESHOLD && Math.abs(py - downY) < DRAG_THRESHOLD) return;
      dragMoved = true;
      dragEv.t = Math.max(0, Math.min(totalMin - 1, playedUntilMin, Math.round(minuteAt(px))));
      requestRecompute();   // curve follows the drag live; levels stay frozen
      return;
    }
    // No drag: update the hover cursor style + the neighbour-gap preview. The
    // inspection cursor is NOT moved here — placement must be a deliberate tap.
    const over = eventAt(px, py);
    if (canvas.style.cursor !== 'grabbing')
      canvas.style.cursor = over ? "grab" : (inChart(px, py) ? "crosshair" : "");
    // Hover (mouse only) over a marker shows its time-to-neighbour guides, so you
    // can read the spacing without dragging. Redraw only when the target changes.
    const newHover = (e.pointerType === 'mouse') ? (over || null) : null;
    if (newHover !== hoverEv) { hoverEv = newHover; draw(); }
  }
  function onUp(e) {
    const { px, py } = coords(e);
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (dragEv) {
      const ev = dragEv; ev._drag = false; dragEv = null;
      canvas.style.cursor = "crosshair";
      if (dragMoved) { settleMarkers(); recompute(); draw(); updateInspect(); }
      else openEventPop(ev, e);   // a tap on a marker edits it
      downEv = null;
      return;
    }
    // A tap on empty chart (no marker, no drag) places the locked cursor here.
    if (!downEv && !dragMoved && inChart(px, py)) {
      closeEventPop();
      cursorMin = clampCursor(minuteAt(px));
      draw(); updateInspect();
    }
    downEv = null;
  }
  // pointercancel = the OS aborted the gesture (palm touch, multi-touch, app
  // switch). Tear the drag state down WITHOUT acting on it — don't open a popup
  // and don't move the cursor, since the user never completed the tap (#4).
  function onCancel(e) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (dragEv) { dragEv._drag = false; dragEv = null; }
    dragMoved = false; downEv = null;
    canvas.style.cursor = 'crosshair';
    draw();
  }
  // Mouse left the chart → drop any hover neighbour-gap preview.
  function onLeave() { if (hoverEv) { hoverEv = null; draw(); } }

  // ---- event edit popup (created on demand) ----
  function ensureEventPop() {
    if (eventPopEl) return eventPopEl;
    const el = document.createElement('div');
    el.className = 'editor-event-pop';
    el.style.display = 'none';
    (canvas.parentElement || document.body).appendChild(el);
    eventPopEl = el;
    return el;
  }
  function closeEventPop() {
    if (!eventPopEl) return;
    eventPopEl.style.display = 'none';
    // Detach the outside-click dismiss listener (item 1: the popup has no close
    // button — it closes on any click outside it). Critical to remove so it never
    // leaks into the live game after leaving the editor.
    if (eventPopEl._outside) {
      document.removeEventListener('pointerdown', eventPopEl._outside, true);
      eventPopEl._outside = null;
    }
  }

  function openEventPop(ev, mouseEvt) {
    const pop = ensureEventPop();
    // Clear any stale outside-click listener from a previously open popup.
    if (pop._outside) { document.removeEventListener('pointerdown', pop._outside, true); pop._outside = null; }
    // For a meal show the dish name, for an activity the activity name (like the
    // menu chip) instead of the generic kind label; the time sits next to it.
    let title = t('editor.event.' + ev.kind);
    if (ev.kind === 'meal' && ev.name) title = ev.name;
    else if (ev.kind === 'activity') {
      const td = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[ev.actType] : null;
      if (td && td.navn) title = td.navn;
    }
    let body = '';
    if (ev.kind === 'bolus' || ev.kind === 'basal') {
      body = insulinBodyHtml(ev);
    } else if (ev.kind === 'meal') {
      ensureMealBase(ev);
      body = mealBodyHtml(ev);
    } else if (ev.kind === 'activity') {
      body = activityBodyHtml(ev);
    }
    // Variationsknap — for every sweepable kind: insulin (dose), meal
    // (portion) and activity (duration). Label/tooltip toggles to "collapse" when THIS
    // event already owns the active sweep.
    const isSweepable = !!SWEEPABLE_KINDS[ev.kind];
    const sweptThis = !!(sweep && sweep.eventId === ev.id);
    // Action buttons are icon-only (custom event-info icons) with tooltips. What-if
    // sits first and gets a cyan ring while its sweep is active.
    const ICON_DIR = 'assets/icons/app/';
    const sweepBtn = isSweepable
      ? '<button class="eep-sweep eep-icon-btn' + (sweptThis ? ' eep-sweep-on' : '') +
          '" title="' + t(sweptThis ? 'editor.sweep.collapse' : 'editor.btn.sweep') + '">' +
          '<img src="' + ICON_DIR + 'editor-what-if.png" alt="' + t('editor.btn.sweep') + '"></button>'
      : '';
    pop.innerHTML =
      '<div class="eep-head">' + (title || 'Event') +
        ' · <span class="eep-time">' + fmtTime(ev.t) + '</span></div>' +
      body +
      '<div class="eep-actions">' +
        sweepBtn +
        '<button class="eep-dup eep-icon-btn" title="' + t('editor.btn.duplicate') + '">' +
          '<img src="' + ICON_DIR + 'editor-copy-event.png" alt="' + t('editor.btn.duplicate') + '"></button>' +
        '<button class="eep-del eep-icon-btn" title="' + t('editor.btn.delete') + '">' +
          '<img src="' + ICON_DIR + 'editor-delete-event.png" alt="' + t('editor.btn.delete') + '"></button>' +
      '</div>';
    const slider = pop.querySelector('input[type=range]');
    if (slider) {
      slider.oninput = () => {
        const v = +slider.value;
        if (ev.kind === 'meal') {
          applyPortion(ev, v * ev._base.weight);  // v = portion multiplier (0–2×)
          updateMealBody(pop, ev);
        } else if (ev.kind === 'activity') {
          ev.durationMin = v;
          pop.querySelector('.eep-val').textContent = v + ' ' + slider.dataset.unit;
          updateActivityBody(pop, ev);   // kcal estimate scales with the duration
        } else {
          // Insulin: the dose value is shown by the stepper (its own input listener);
          // the chip is static (identity + action profile), so nothing to refresh here.
          ev.units = v;
        }
        requestRecompute();
      };
    }
    // Insulin dose: add the same fine stepper as the dock, above the slider.
    // Bolus is dosed in half units (-1/-½/+½/+1); long-acting basal only in whole
    // units (the basal slider is integer-stepped), so basal uses -2/-1/+1/+2.
    if ((ev.kind === 'bolus' || ev.kind === 'basal') && slider && typeof buildDoseStepper === 'function') {
      const stepOpts = ev.kind === 'basal'
        ? { half: 1, whole: 2, unit: t('editor.unit.insulin') }
        : { half: 0.5, whole: 1, unit: t('editor.unit.insulin') };
      const st = buildDoseStepper(slider, stepOpts);
      const row = slider.closest('.eep-row');
      if (st && row) row.parentNode.insertBefore(st, row);
    }
    pop.querySelector('.eep-del').onclick = () => deleteEvent(ev);
    const dupBtn = pop.querySelector('.eep-dup');
    if (dupBtn) dupBtn.onclick = () => duplicateEvent(ev);
    const swBtn = pop.querySelector('.eep-sweep');
    if (swBtn) swBtn.onclick = () => openSweepMenu(ev, swBtn);

    pop.style.display = 'block';
    const host = canvas.parentElement || document.body;
    const hostRect = host.getBoundingClientRect();
    const pw = ev.kind === 'meal' ? 240 : 220, ph = pop.offsetHeight || 130;
    let left = (mouseEvt.clientX - hostRect.left) - pw / 2;
    // Open the panel ABOVE the marker (markers sit on the bottom baseline) so the
    // icon stays uncovered and draggable while its popup is open. Clears the icon
    // by ~28 px; clamps to the view, falling back below only if there's no room up.
    let top = (mouseEvt.clientY - hostRect.top) - ph - 28;
    if (top < 8) top = (mouseEvt.clientY - hostRect.top) + 24;   // no room above → below
    left = Math.max(8, Math.min(hostRect.width - pw - 8, left));
    top = Math.max(8, Math.min(hostRect.height - ph - 8, top));
    pop.style.left = left + 'px'; pop.style.top = top + 'px';

    // Outside-click dismiss (replaces the removed close button). Attached on the
    // next tick so the very pointerdown that opened this popup doesn't close it,
    // and ignored when the click lands inside the popup (slider/stepper/buttons).
    const onOutside = (e) => {
      if (eventPopEl && eventPopEl.contains(e.target)) return;
      // A confirm/notice overlay (e.g. shorten-window, no-dose) lives outside the
      // popup but is part of the editor — don't treat clicking it as an outside click.
      if (e.target && e.target.closest && e.target.closest('.editor-confirm-overlay')) return;
      closeEventPop();
    };
    pop._outside = onOutside;
    setTimeout(() => { if (eventPopEl && eventPopEl._outside === onOutside) document.addEventListener('pointerdown', onOutside, true); }, 0);
  }
  // Slider row: label + slider, optionally with a live value readout to the right.
  // Insulin omits it (the dose stepper above shows the value); activity shows it so the
  // duration is visible while dragging — not only after the popup closes.
  function sliderRow(label, min, max, step, val, unit, showVal) {
    return '<div class="eep-row"><label>' + label + '</label>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-unit="' + unit + '">' +
      (showVal ? '<span class="eep-val">' + val + ' ' + unit + '</span>' : '') +
      '</div>';
  }

  // ---- meal editing: a portion slider (in grams) that scales every macro from
  //      the food's base composition, with a food-chip-style macro readout. ----
  // The base (= portion 1.0) is captured the first time the popup opens, so the
  // slider always scales relative to the original food, not the last edit.
  function ensureMealBase(ev) {
    if (ev.portion == null) ev.portion = 1;
    if (!ev._base) {
      const pr = ev.portion || 1;
      ev._base = {
        carbs: (ev.carbs || 0) / pr, protein: (ev.protein || 0) / pr,
        fat: (ev.fat || 0) / pr, weight: (ev.weight || 0) / pr,
        eatTimeMin: ev.eatTimeMin || 15
      };
    }
    if (!ev._base.weight || ev._base.weight <= 0) {
      ev._base.weight = Math.max(20, ev._base.carbs + ev._base.protein + ev._base.fat + 30);
    }
  }
  function applyPortion(ev, weight) {
    const b = ev._base;
    const ratio = b.weight > 0 ? weight / b.weight : 1;
    ev.weight = weight;
    ev.carbs = b.carbs * ratio;
    ev.protein = (b.protein || 0) * ratio;
    ev.fat = (b.fat || 0) * ratio;
    ev.portion = ratio;
    // eating time grows mildly with portion (a bigger plate takes a bit longer)
    if (b.eatTimeMin) ev.eatTimeMin = Math.round(b.eatTimeMin * Math.sqrt(Math.max(0.25, ratio)));
  }
  // Food info block — uses the EXACT same layout + classes as the dock's food
  // preset chips (.pc-info-row / .pc-macro-bar / .pc-macro-labels, built in
  // main.js initFoodChipUI), so a placed meal's info reads identically to the
  // picker chip. The icon sits above; below it the weight+kcal row, the macro
  // bar and the per-macro gram labels — all reflecting the current portion.
  function foodInfoHtml(ev) {
    const c = ev.carbs || 0, p = ev.protein || 0, f = ev.fat || 0;
    const kcal = Math.round(c * 4 + p * 4 + f * 9);
    const w = Math.round(ev.weight || 0);
    const unit = ev.carbType === 'sukker_flydende' ? 'ml' : 'g';
    const iconHtml = (ev.icon && /\.(png|webp|svg)$/i.test(ev.icon))
      ? '<span class="pc-emoji"><img class="pc-emoji-img" src="' + ev.icon + '" alt=""></span>'
      : '<span class="pc-emoji">🍲</span>';
    const name = ev.name || t('editor.event.meal');
    const seg = (cls, v) => '<span class="' + cls + '" style="flex:' + Math.max(0.001, v) + '"></span>';
    const lbl = (cls, v) => v > 0 ? '<span class="' + cls + '" style="flex:' + v + '">' + Math.round(v) + '</span>' : '';
    // The SAME orange chip as the food menu — identical structure + classes
    // (.preset-chip + pc-emoji/pc-name/pc-macro-wrapper), so a placed meal reads
    // exactly like its picker chip (icon, name, weight/kcal, macro bar, grams).
    return '<div class="preset-chip eep-chip">' +
      iconHtml +
      '<span class="pc-name">' + name + '</span>' +
      '<div class="pc-macro-wrapper">' +
        '<div class="pc-info-row">' +
          '<div class="pc-info-group info-left">' +
            '<span class="pc-info-value pc-weight-value">' + w + '</span>' +
            '<span class="pc-info-unit pc-weight-unit">' + unit + '</span></div>' +
          '<div class="pc-info-group info-right">' +
            '<span class="pc-info-value pc-kcal-value">' + kcal + '</span>' +
            '<span class="pc-info-unit">kcal</span></div>' +
        '</div>' +
        '<div class="pc-macro-bar">' + seg('pc-mb-carb', c) + seg('pc-mb-protein', p) + seg('pc-mb-fat', f) + '</div>' +
        '<div class="pc-macro-labels">' + lbl('ml-carb', c) + lbl('ml-protein', p) + lbl('ml-fat', f) + '</div>' +
      '</div>' +
    '</div>';
  }
  // Portion readout as a multiple of the normal portion (e.g. "× 1", "× 0.5").
  function portionStr(m) { return '× ' + (Math.round(m * 100) / 100); }
  function mealBodyHtml(ev) {
    // The slider is a PORTION MULTIPLIER from 0 to 2× the normal portion (the
    // portion the chip placed); the chip-format info above updates live with it.
    const m = ev.portion != null ? ev.portion : 1;
    return '<div class="eep-food">' + foodInfoHtml(ev) + '</div>' +
      '<div class="eep-row"><label>' + t('editor.field.portion') + '</label>' +
        '<input type="range" min="0" max="2" step="0.05" value="' + m + '" data-unit="x">' +
        '<span class="eep-val">' + portionStr(m) + '</span></div>';
  }
  function updateMealBody(pop, ev) {
    const foodEl = pop.querySelector('.eep-food');
    if (foodEl) foodEl.innerHTML = foodInfoHtml(ev);
    const val = pop.querySelector('.eep-val');
    if (val) val.textContent = portionStr(ev.portion != null ? ev.portion : 1);
  }

  // ---- activity editing: same icon-info chip as the meal popup, but for an
  //      activity (icon + name + intensity + kcal burned), with a 5–180 min
  //      duration slider. The kcal estimate (kcalPerMin[intensity] × duration)
  //      updates live as the duration slider moves, like the meal's macros. ----
  function activityInfoHtml(ev) {
    const td = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[ev.actType] : null;
    const navn = (td && td.navn) || t('editor.event.activity');
    const farve = (td && td.farve) || '#7dd3fc';
    const kcalPerMin = (td && td.kcalPerMin && td.kcalPerMin[ev.intensity]) || 0;
    const kcal = Math.round(kcalPerMin * (ev.durationMin || 0));
    const iconHtml = (td && td.icon)
      ? '<span class="pc-emoji"><img class="pc-emoji-img" src="' + td.icon + '" alt=""></span>'
      : '<span class="pc-emoji">🏃</span>';
    // Chip tinted with the activity's own colour (farve) instead of the meal's amber.
    return '<div class="preset-chip eep-chip eep-chip-activity" style="background:' + farve + '1f;border-color:' + farve + '55;">' +
      iconHtml +
      '<span class="pc-name">' + navn + '</span>' +
      '<div class="eep-act-meta">' +
        '<span class="eep-act-int" style="color:' + farve + ';">' + (ev.intensity || '') + '</span>' +
        '<span class="eep-act-kcal">' + kcal + ' kcal</span>' +
      '</div>' +
    '</div>';
  }
  function activityBodyHtml(ev) {
    return '<div class="eep-food">' + activityInfoHtml(ev) + '</div>' +
      sliderRow(t('editor.field.duration'), 5, 180, 5, ev.durationMin, 'min', true);
  }
  function updateActivityBody(pop, ev) {
    const el = pop.querySelector('.eep-food');
    if (el) el.innerHTML = activityInfoHtml(ev);
  }

  // ---- insulin editing: the SAME icon-info chip as the meal/activity popups, but
  //      for an injection — the syringe icon (rapid vs basal-with-clock, exactly the
  //      dock/marker icon), the insulin name, an action descriptor (rapid- / long-
  //      acting) and the estimated BG-lowering (dose × ISF), which updates live with
  //      the dose like the meal's macros / the activity's kcal. The chip is tinted
  //      with the insulin's own colour (teal rapid / blue basal, the graph colours). --
  function insulinInfoHtml(ev) {
    const isBasal = ev.kind === 'basal';
    const color = isBasal ? '#2563eb' : '#0d9488';   // graph insulin colours (ui.js)
    const name = t('editor.event.' + ev.kind);
    const desc = t(isBasal ? 'editor.insulin.basal' : 'editor.insulin.rapid');
    const iconSrc = 'assets/icons/app/' + (isBasal ? 'basal-syringe-clock' : 'rapid-syringe') + '.png';
    // No estimated BG-drop readout: the effect is visible on the curve, and a raw
    // "↓ X mmol/L" was an unfamiliar (and potentially misleading) number. The chip
    // shows just the insulin's identity + action profile.
    return '<div class="preset-chip eep-chip eep-chip-insulin" style="background:' + color + '1f;border-color:' + color + '55;">' +
      '<span class="pc-emoji"><img class="pc-emoji-img" src="' + iconSrc + '" alt=""></span>' +
      '<span class="pc-name">' + name + '</span>' +
      '<div class="eep-act-meta">' +
        '<span class="eep-act-int" style="color:' + color + ';">' + desc + '</span>' +
      '</div>' +
    '</div>';
  }
  function insulinBodyHtml(ev) {
    const isBasal = ev.kind === 'basal';
    return '<div class="eep-food">' + insulinInfoHtml(ev) + '</div>' +
      sliderRow(t('editor.field.dose'), isBasal ? 1 : 0.5, isBasal ? 40 : 20,
                isBasal ? 1 : 0.5, ev.units, t('editor.unit.insulin'));
  }

  // ===========================================================================
  // TIDSLINJEKONTROL
  // ===========================================================================
  function buildTimelineControls() {
    const host = canvas.parentElement || document.body;
    // Hvis det spillede forløb plus 6 timers fremskrivning er længere end ét døgn,
    // kan spilleren rulle i grafen. Periodens længde kan ikke længere vælges manuelt.
    const sb = document.createElement('div');
    sb.className = 'editor-scrollbar';
    sb.style.display = 'none';
    const thumb = document.createElement('div');
    thumb.className = 'editor-scroll-thumb';
    sb.appendChild(thumb);
    host.appendChild(sb);
    scrollbarEl = sb;
    scrollbarThumbEl = thumb;
    wireScrollbar(sb, thumb);
  }

  // Størrelse og position følger den dynamiske tidslinje. totalMin indeholder
  // både minut 0 og slutminuttet, så geometrien bruger totalMin - 1.
  function syncScrollbar() {
    const sb = scrollbarEl, thumb = scrollbarThumbEl;
    if (!sb || !thumb) return;
    const timelineEnd = Math.max(1, totalMin - 1);
    if (timelineEnd <= viewSpanMin) { sb.style.display = 'none'; return; }
    sb.style.display = 'block';
    const trackW = sb.clientWidth || sb.getBoundingClientRect().width;
    if (trackW <= 0) return;
    const thumbW = Math.max(24, (viewSpanMin / timelineEnd) * trackW);
    const scrollRange = Math.max(1, timelineEnd - viewSpanMin);
    const left = (viewStart / scrollRange) * (trackW - thumbW);
    thumb.style.width = thumbW + 'px';
    thumb.style.left = Math.max(0, Math.min(trackW - thumbW, left)) + 'px';
  }

  // Drag the thumb (or click the track) to scroll the visible 24 h window.
  function wireScrollbar(sb, thumb) {
    let dragging = false, grabDx = 0;
    const applyLeft = (leftPx) => {
      const trackW = sb.clientWidth || sb.getBoundingClientRect().width;
      const thumbW = thumb.getBoundingClientRect().width;
      const maxLeft = Math.max(0, trackW - thumbW);
      const left = Math.max(0, Math.min(maxLeft, leftPx));
      const frac = maxLeft > 0 ? left / maxLeft : 0;
      viewStart = Math.round(frac * Math.max(0, (totalMin - 1) - viewSpanMin));
      cursorMin = clampCursor(cursorMin);
      syncScrollbar(); draw(); updateInspect();
    };
    thumb.addEventListener('pointerdown', e => {
      dragging = true;
      grabDx = e.clientX - thumb.getBoundingClientRect().left;
      try { thumb.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.stopPropagation(); e.preventDefault();
    });
    thumb.addEventListener('pointermove', e => {
      if (!dragging) return;
      applyLeft(e.clientX - sb.getBoundingClientRect().left - grabDx);
    });
    const endDrag = e => { dragging = false; try { thumb.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);
    // Click on the track (not the thumb) → jump so the thumb centres on the click.
    sb.addEventListener('pointerdown', e => {
      if (e.target === thumb) return;
      const thumbW = thumb.getBoundingClientRect().width;
      applyLeft(e.clientX - sb.getBoundingClientRect().left - thumbW / 2);
    });
  }

  // Small custom confirm dialog (the codebase avoids native confirm()). Reuses
  // the editor's glass-panel styling; centred over the graph area.
  function showConfirm(message, onYes) {
    const host = canvas.parentElement || document.body;
    host.querySelectorAll('.editor-confirm-overlay').forEach(el => el.remove());
    const ov = document.createElement('div');
    ov.className = 'editor-confirm-overlay';
    ov.innerHTML =
      '<div class="editor-confirm">' +
        '<div class="ec-msg"></div>' +
        '<div class="ec-actions">' +
          '<button class="ec-cancel"></button>' +
          '<button class="ec-yes"></button>' +
        '</div>' +
      '</div>';
    ov.querySelector('.ec-msg').textContent = message;
    const close = () => ov.remove();
    // onYes omitted → a one-button notice (just OK); otherwise a yes/cancel confirm.
    if (typeof onYes === 'function') {
      ov.querySelector('.ec-cancel').textContent = t('editor.shorten.cancel');
      ov.querySelector('.ec-yes').textContent = t('editor.shorten.continue');
      ov.querySelector('.ec-cancel').onclick = close;
      ov.querySelector('.ec-yes').onclick = () => { close(); onYes(); };
    } else {
      ov.querySelector('.ec-cancel').style.display = 'none';
      ov.querySelector('.ec-yes').textContent = t('editor.notice.ok');
      ov.querySelector('.ec-yes').onclick = close;
    }
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    host.appendChild(ov);
  }

  // ===========================================================================
  // PROFILE (rebuild engine on save)
  // ===========================================================================
  function applyProfile() {
    return false;
  }

  // ===========================================================================
  // DEFAULT SCENARIO + LIFECYCLE
  // ===========================================================================
  function mealFromFood(key, t) {
    const food = window.FOODS[key];
    return {
      kind: "meal", t, foodKey: key, carbs: food.carbs, protein: food.protein, fat: food.fat,
      weight: food.weight, eatTimeMin: food.eatTimeMin, carbType: food.carbType, icon: food.icon
    };
  }

  // A realistic but gentle starting day: mild morning high (dawn), a handled
  // lunch, a light afternoon walk, and a slightly under-dosed dinner — a few
  // teaching points to optimise, no alarming severe lows. The editor starts EMPTY
  // (blank canvas); this is kept as a future "load example" entry point and is
  // exported as Editor.loadExample().
  function loadExampleScenario() {
    const have = k => window.FOODS && window.FOODS[k];
    sweep = null;   // rebuilding events[] with fresh ids — drop any open sweep
    startEngineState = null;   // example uses the deterministic steady-state start
    events = [];
    if (have('havregryn')) events.push(mealFromFood('havregryn', 450));
    events.push({ kind: 'bolus', t: 450, units: 3 });
    if (have('bollerIKarry')) events.push(mealFromFood('bollerIKarry', 720));
    events.push({ kind: 'bolus', t: 720, units: 5 });
    events.push({ kind: 'activity', t: 960, actType: 'cardio', intensity: 'Lav', durationMin: 30 });
    if (have('burger')) events.push(mealFromFood('burger', 1110));
    events.push({ kind: 'bolus', t: 1110, units: 4 });
    events.forEach(e => e.id = nextId++);
  }
  // Public hook: load the example scenario and render it.
  function loadExample() { loadExampleScenario(); recompute(); draw(); updateInspect(); }

  // ===========================================================================
  // SCENARIO FILE I/O — New / Save / Load (#54)
  // ===========================================================================
  // A scenario is fully described by its placed events + the
  // simulated-subject profile that shapes the curve. Runtime-only fields (id, cached
  // portion base, rejection flag) are stripped on save and rebuilt on load, so
  // the file is a clean, portable description of the timeline.

  // newScenario — clear the canvas back to an empty timeline (keep profile).
  function newScenario() {
    if (!active) return;
    events = [];
    sweep = null;
    startEngineState = null;   // back to the deterministic steady-state start
    closeEventPop();
    recompute(); draw(); updateInspect();
  }

  // serializeScenario — plain JSON-able snapshot of the current scenario.
  function serializeScenario() {
    return {
      format: 't1d-scenario',
      version: 1,
      profile: { weight: profile.weight, isf: profile.isf, icr: profile.icr },
      events: events.map(e => {
        // Strip runtime-only fields; keep the placement + macro/dose description.
        const { id, _base, rejected, ...clean } = e;
        return clean;
      })
    };
  }

  // File-picker identity: passing the same `id` to showSaveFilePicker AND
  // showOpenFilePicker makes the browser remember the last folder used and reopen
  // there next time (shared across save+open). `startIn: 'downloads'` is only the
  // first-use default, before any folder has been remembered.
  const SCENARIO_PICKER_ID = 't1d-scenario';
  const SCENARIO_FILE_TYPES = [{
    description: 'T1D scenario', accept: { 'application/json': ['.json'] }
  }];

  // suggestedFileName — "scenario-YYYY-MM-DD_HHMM.json".
  function suggestedFileName() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
                + '_' + pad(d.getHours()) + pad(d.getMinutes());
    return 'scenario-' + stamp + '.json';
  }

  // downloadJson — fallback save: trigger a browser download (always lands in the
  // Downloads folder; browsers don't let a download choose its directory).
  function downloadJson(json, name) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // saveScenarioObject — save ANY scenario object (editor format) to a .json file.
  // When the File System Access API is available (Chromium, secure context) this
  // opens a real "Save as" dialog so the user picks the folder + name, and the
  // folder is remembered for next time (SCENARIO_PICKER_ID). Otherwise it falls
  // back to a download. Shared by the editor's Save and the game's "Save as
  // scenario" export (#54), so both honour the same picker + remembered folder.
  async function saveScenarioObject(scenario) {
    if (!developerAccessAllowed()) return false;
    const json = JSON.stringify(scenario, null, 2);
    const name = suggestedFileName();
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          id: SCENARIO_PICKER_ID,
          startIn: 'downloads',
          types: SCENARIO_FILE_TYPES
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([json], { type: 'application/json' }));
        await writable.close();
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;   // user cancelled the dialog
        // Any other failure (e.g. permission, unsupported) → fall back to download.
      }
    }
    downloadJson(json, name);
  }

  // saveScenario — save the current EDITOR scenario (its placed events).
  function saveScenario() {
    if (!active) return;
    return saveScenarioObject(serializeScenario());
  }

  // loadScenarioData — replace the current scenario from a parsed object.
  // Returns true on success, false if the object is not a valid scenario file.
  function loadScenarioData(data) {
    if (!active || !isInsightsScenario(data)) return false;
    sweep = null;   // loading a new scenario rebuilds events[] — drop any open sweep
    // Phase 3: resume from the saved exact engine state if present, else steady state.
    startEngineState = data.engineState || null;

    // Tidslinjen slutter præcis 6 timer efter det minut, banen nåede til. Grafen
    // viser hele forløbet ved korte baner og det seneste døgn ved længere forløb.
    playedUntilMin = Math.max(0, Math.round(data.playedUntilMin));
    const timelineEnd = playedUntilMin + FUTURE_MIN;
    totalMin = timelineEnd + 1;
    viewSpanMin = Math.min(MAX_VIEW_MIN, Math.max(1, timelineEnd));
    viewStart = Math.max(0, timelineEnd - viewSpanMin);
    sourceMode = data.sourceMode === 'boxchallenge' ? 'boxchallenge' : 'campaign';
    const allowedLockedKinds = new Set(['acuteStress', 'chronicStress']);
    lockedEvents = Array.isArray(data.lockedEvents)
      ? data.lockedEvents
          .filter(event => event && allowedLockedKinds.has(event.kind) &&
            Number.isFinite(event.t) && Number.isFinite(event.amount) &&
            event.t >= 0 && event.t <= playedUntilMin)
          .map(event => ({
            t: event.t,
            kind: event.kind,
            amount: event.amount,
            marker: event.marker ? Object.assign({}, event.marker) : null
          }))
      : [];
    lockedBoxes = (sourceMode === 'boxchallenge' && Array.isArray(data.lockedBoxes))
      ? data.lockedBoxes
          .filter(box => box && Number.isFinite(box.startMin) && Number.isFinite(box.endMin) &&
            Number.isFinite(box.bgMin) && Number.isFinite(box.bgMax) &&
            box.endMin > box.startMin && box.bgMax > box.bgMin &&
            box.endMin >= 0 && box.startMin <= timelineEnd)
          .map(box => ({
            startMin: box.startMin,
            endMin: box.endMin,
            bgMin: box.bgMin,
            bgMax: box.bgMax,
            skewBG: Number.isFinite(box.skewBG) ? box.skewBG : 0,
            hit: !!box.hit
          }))
      : [];
    const allowedIncidentCauses = new Set(['box', 'hypo', 'dka', 'weight', 'complications']);
    sourceIncidents = (sourceMode === 'boxchallenge' && Array.isArray(data.sourceIncidents))
      ? data.sourceIncidents
          .filter(incident => incident && Number.isFinite(incident.t) &&
            Number.isFinite(incident.bg) && allowedIncidentCauses.has(incident.cause) &&
            incident.t >= 0 && incident.t <= playedUntilMin)
          .map(incident => ({
            t: incident.t,
            cause: incident.cause,
            bg: incident.bg
          }))
      : [];

    // Slå altid profilen op via den faste karakter-id. Dataobjektet kan ikke
    // overskrive karakterens vægt, ISF eller ICR.
    characterId = data.characterId;
    profile = characterToProfile(characterId);
    makeEngine();
    facade.basalDose = engine.basalDose;
    if (typeof updateBasalPresetUI === 'function') updateBasalPresetUI();

    // Genopbyg handlinger med nye id'er og hold dem før banens pausepunkt.
    events = data.events
      .filter(e => e && typeof e.t === 'number' && typeof e.kind === 'string')
      .map(e => {
        const { id, _base, rejected, ...clean } = e;
        clean.id = nextId++;
        clean.t = Math.max(0, Math.min(totalMin - 1, playedUntilMin, Math.round(clean.t)));
        return clean;
      });

    closeEventPop();
    cursorMin = playedUntilMin;
    resetEditorYAxisScale();
    syncScrollbar();
    recompute();
    sourceEvents = events.map(event => Object.assign({}, event));
    const playedSource = Array.isArray(data.sourceBg)
      ? data.sourceBg
          .filter(point => point && Number.isFinite(point.t) && Number.isFinite(point.bg))
          .map(point => ({
            t: Math.max(0, Math.min(playedUntilMin, point.t)),
            bg: point.bg
          }))
          .sort((a, b) => a.t - b.t)
      : [];
    // Ældre interne scenarier uden et optaget forløb får en deterministisk
    // reference fra genafspilningen. Den offentlige vej leverer altid sourceBg.
    sourceBg = playedSource.length
      ? playedSource
      : frames.map((frame, minute) => frame ? { t: minute, bg: frame.bg } : null).filter(Boolean);
    draw(); updateInspect();
    return true;
  }

  // loadFromFile — read a user-picked File and load it as a scenario.
  function loadFromFile(file) {
    if (!file || !active) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data = null;
      try { data = JSON.parse(reader.result); } catch (e) { data = null; }
      if (!loadScenarioData(data)) {
        showConfirm(t('editor.load.invalid'), null);
      }
    };
    reader.readAsText(file);
  }

  // openScenario — open a scenario from disk. With the File System Access API
  // (Chromium, secure context) this shows a real "Open" dialog that starts in the
  // last-used folder (SCENARIO_PICKER_ID, shared with save) or Downloads on first
  // use. Otherwise it falls back to a hidden <input type=file>; the browser does
  // NOT allow a file input to pick its start folder, so the OS dialog opens
  // wherever it was last — we cannot force Downloads on the fallback path.
  async function openScenario() {
    if (!active) return;
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          id: SCENARIO_PICKER_ID,
          startIn: 'downloads',
          multiple: false,
          types: SCENARIO_FILE_TYPES
        });
        const file = await handle.getFile();
        loadFromFile(file);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;   // user cancelled the dialog
        // Other failure → fall back to the hidden file input.
      }
    }
    const input = document.getElementById('editorFileInput');
    if (input) input.click();
  }

  function loadProfileFromStorage() {
    if (typeof loadDeveloperProfile === 'function') return loadDeveloperProfile();
    return { weight: 70, isf: 3.0, icr: 10 };
  }

  // init — enter editor mode. Builds the engine, the default scenario, the
  // toolbar and the canvas interaction, then renders the first curve.
  function init(scenario) {
    if (!isInsightsScenario(scenario)) {
      console.warn('Insights: et gyldigt, karakterbundet spilforløb mangler');
      return false;
    }
    // Reuse the game's graph canvas (DOM id 'bg-graph'; ui.js refers to it via
    // the global `bgGraphCanvas`). getElementById is the robust primary lookup.
    canvas = document.getElementById('bg-graph') ||
             (typeof bgGraphCanvas !== 'undefined' ? bgGraphCanvas : null);
    if (!canvas) { console.error('Editor: graph canvas (#bg-graph) not found'); return false; }
    ctx = canvas.getContext('2d');
    if (!window.T1DPhysiologyEngine) { console.error('Editor: physiology engine not loaded'); return false; }

    active = true;
    // Remember the player's physiology-band toggle state so destroy() can restore
    // it; the editor always shows its bands (showBands) while active.
    savedBands = {
      i: (typeof showInsulinBand !== 'undefined') ? showInsulinBand : false,
      c: (typeof showCarbBand !== 'undefined') ? showCarbBand : false,
      s: (typeof showISFLine !== 'undefined') ? showISFLine : false,
      k: (typeof showKetoneLine !== 'undefined') ? showKetoneLine : false
    };
    // Robustness: remove any stray editor DOM left by a prior entry that didn't
    // go through destroy() (normal flow always destroys before re-entry, but this
    // makes init idempotent so repeated entry can never accumulate toolbars/popups).
    document.querySelectorAll('.editor-toolbar, .et-windows, .editor-scrollbar, .editor-purpose-note, .editor-event-pop, .editor-confirm-overlay').forEach(el => el.remove());
    scrollbarEl = null; scrollbarThumbEl = null; eventPopEl = null;
    characterId = scenario.characterId;
    profile = characterToProfile(characterId);
    loadIcons();
    buildTimelineControls();

    // pointer interaction (mouse + touch via one Pointer Events API)
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.style.touchAction = 'none';   // we own touch drags — no page scroll/zoom
    canvas.style.cursor = 'crosshair';

    return loadScenarioData(scenario);
  }

  // destroy — leave editor mode and clean up (called from resetGame).
  function destroy() {
    active = false;
    if (canvas) {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.style.touchAction = '';
    }
    if (scrollbarEl) scrollbarEl.remove();
    scrollbarEl = null; scrollbarThumbEl = null;
    if (eventPopEl) {
      // Remove the outside-click dismiss listener so it can't leak into the game.
      if (eventPopEl._outside) document.removeEventListener('pointerdown', eventPopEl._outside, true);
      eventPopEl.remove(); eventPopEl = null;
    }
    if (canvas) {
      canvas.parentElement && canvas.parentElement.querySelectorAll('.editor-confirm-overlay').forEach(el => el.remove());
      canvas.style.cursor = '';
    }
    // Neutralise any in-flight rAF recompute so it becomes a no-op (it also
    // checks `active`/`engine`, but clearing dirty stops it doing any work).
    dirty = false; rafPending = false;
    if (levelAnimRAF) { cancelAnimationFrame(levelAnimRAF); levelAnimRAF = null; }
    if (fadeRAF) { cancelAnimationFrame(fadeRAF); fadeRAF = null; }
    if (sweepAnimRAF) { cancelAnimationFrame(sweepAnimRAF); sweepAnimRAF = null; }
    clearYAxisAnimation();
    closeSweepMenu();
    if (sweepCloseEl) { sweepCloseEl.remove(); sweepCloseEl = null; }
    sleepAwakenings = []; facade.sleepAwakeIntervals = null;
    lastMetrics = null; deathInfo = null; sweep = null; startEngineState = null;
    dragEv = null; dragMoved = false; hoverEv = null;
    events = []; frames = []; sourceEvents = []; sourceBg = []; lockedEvents = []; lockedBoxes = [];
    sourceIncidents = []; alternativeBoxHits = []; engine = null;
    resetEditorYAxisScale();
    sourceMode = 'campaign';
    playedUntilMin = 0;
    totalMin = FUTURE_MIN + 1; viewSpanMin = FUTURE_MIN; viewStart = 0; cursorMin = 0;
    // Hand the graph back to the live game: drop the view override + the editor's
    // data from the shared render arrays, and restore the band toggles.
    graphViewOverride = null;
    if (typeof cgmDataPoints !== 'undefined') cgmDataPoints.length = 0;
    if (typeof trueBgPoints !== 'undefined') trueBgPoints.length = 0;
    if (typeof physiologyDataPoints !== 'undefined') physiologyDataPoints.length = 0;
    if (savedBands) {
      showInsulinBand = savedBands.i; showCarbBand = savedBands.c; showISFLine = savedBands.s;
      showKetoneLine = savedBands.k;
      savedBands = null;
    }
  }

  // ===========================================================================
  // PDF / PRINT EXPORT (#18)
  // ---------------------------------------------------------------------------
  // One A4 page per simulated day: the day's BG graph (snapshotted from the live
  // canvas by scrolling to each 24 h slice) + a table of that day's events
  // (time · type · details). Uses the browser's native print — no library: a
  // print stylesheet hides the app and shows only #editor-print-doc, page-breaking
  // per day, so the user gets "Print → Save as PDF" for free.
  // ===========================================================================
  // KE (carb equivalents) and kcal — same formulas as the food panel.
  function mealKE(ev) { return Math.round((ev.carbs || 0) + (ev.protein || 0) * 0.25); }
  function mealKcal(ev) { return Math.round((ev.carbs || 0) * 4 + (ev.protein || 0) * 4 + (ev.fat || 0) * 9); }

  // printEventCells — the {type, det} cells for one event's table row.
  function printEventCells(ev) {
    if (ev.kind === 'meal') {
      const nm = ev.name || t('editor.event.meal');
      const det = nm + ' · ' + t('editor.print.kh') + ' ' + Math.round(ev.carbs || 0) +
        ' / ' + t('editor.print.pro') + ' ' + Math.round(ev.protein || 0) +
        ' / ' + t('editor.print.fat') + ' ' + Math.round(ev.fat || 0) + ' g · KE ' + mealKE(ev) +
        ' g · ' + Math.round(ev.weight || 0) + ' g · ' + mealKcal(ev) + ' kcal';
      return { type: t('editor.print.type.meal'), det };
    }
    if (ev.kind === 'bolus') return { type: t('editor.print.type.bolus'), det: fmtDose(ev.units) + ' ' + t('editor.unit.insulin') };
    if (ev.kind === 'basal') return { type: t('editor.print.type.basal'), det: fmtDose(ev.units) + ' ' + t('editor.unit.insulin') };
    if (ev.kind === 'activity') {
      const td = (typeof AKTIVITETSTYPER !== 'undefined') ? AKTIVITETSTYPER[ev.actType] : null;
      const nm = (td && td.navn) ? td.navn : t('editor.print.type.activity');
      return { type: t('editor.print.type.activity'), det: nm + ' · ' + intensityLabel(ev.intensity) + ' · ' + (ev.durationMin || 0) + ' min' };
    }
    if (ev.kind === 'glucagon') return { type: t('editor.print.type.glucagon'), det: '—' };
    return { type: ev.kind, det: '' };
  }

  // escape — minimal HTML-escape for user-entered dish names in the print table.
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function exportPdf() {
    if (!active || !canvas) return;
    const numDays = Math.max(1, Math.round(totalMin / 1440));
    // 1) Snapshot each 24 h day (the visible slice is always 24 h, so scrolling
    //    viewStart to each day and redrawing gives one image per day).
    //
    //    file:// taint: drawing local PNG icons onto a canvas served from file://
    //    permanently sets its origin-clean flag to false, so canvas.toDataURL() throws
    //    and the graph would silently drop out of the print. Resetting canvas.width is
    //    supposed to clear that flag, but proved unreliable in practice. The robust fix
    //    is to render the snapshots into a BRAND-NEW canvas element instead: a freshly
    //    created canvas has never drawn any image, so it can never be tainted. We clone
    //    the live graph canvas into the same DOM slot (so getBoundingClientRect inside
    //    drawGraph returns the identical size), repoint the renderer's globals + the
    //    editor's own refs at it, draw vector-only (printRender), capture, then restore
    //    the live canvas untouched.
    const savedViewStart = viewStart;
    const dayImgs = [];
    const liveCanvas = canvas, liveCtx = ctx, parent = canvas.parentNode;
    const fresh = canvas.cloneNode(false);   // pristine bitmap, same id/class/style → same layout box
    parent.replaceChild(fresh, liveCanvas);
    // Point both the shared renderer (drawGraph uses the globals) and the editor's own
    // drawing refs at the fresh canvas for the duration of the snapshot loop.
    bgGraphCanvas = fresh; graphCtx = fresh.getContext('2d');
    canvas = fresh; ctx = graphCtx;
    printRender = true;   // vector dots instead of PNG icons → fresh canvas stays clean
    try {
      for (let d = 0; d < numDays; d++) {
        viewStart = d * 1440;
        draw();
        try { dayImgs.push(canvas.toDataURL('image/png')); } catch (_) { dayImgs.push(null); }
      }
    } finally {
      printRender = false;
      // Restore the live canvas + all refs exactly as they were.
      parent.replaceChild(liveCanvas, fresh);
      bgGraphCanvas = liveCanvas; graphCtx = liveCtx;
      canvas = liveCanvas; ctx = liveCtx;
      viewStart = savedViewStart;
      draw();
    }
    // 2) Build the print document (one .ep-page per day).
    const old = document.getElementById('editor-print-doc');
    if (old) old.remove();
    const doc = document.createElement('div');
    doc.id = 'editor-print-doc';
    const p = profile || {};
    const profLine = t('editor.print.profile') + ': ' + (p.weight || '?') + ' kg · ISF ' + p.isf + ' · ICR ' + p.icr;
    let html = '';
    for (let d = 0; d < numDays; d++) {
      const startMin = d * 1440, endMin = startMin + 1440;
      const dayEvents = events.filter(e => e.t >= startMin && e.t < endMin).slice().sort((a, b) => a.t - b.t);
      const rows = dayEvents.map(e => {
        const c = printEventCells(e);
        return '<tr><td class="ep-t">' + fmtTime(e.t) + '</td><td class="ep-ty">' + escHtml(c.type) + '</td><td>' + escHtml(c.det) + '</td></tr>';
      }).join('') || '<tr><td colspan="3" class="ep-empty">' + t('editor.print.noEvents') + '</td></tr>';
      const img = dayImgs[d] ? '<img class="ep-graph" src="' + dayImgs[d] + '" alt="">' : '';
      html += '<section class="ep-page">' +
        '<header class="ep-head"><div class="ep-title">' + t('editor.print.title') + ' — ' + t('editor.print.day') + ' ' + (d + 1) + '/' + numDays + '</div>' +
        '<div class="ep-sub">' + escHtml(profLine) + '</div></header>' +
        img +
        '<table class="ep-table"><thead><tr><th>' + t('editor.print.col.time') + '</th><th>' + t('editor.print.col.type') + '</th><th>' + t('editor.print.col.details') + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '</section>';
    }
    doc.innerHTML = html;
    document.body.appendChild(doc);
    // 3) Wait for the graph images to actually DECODE before printing. The day graphs
    //    are large data-URL <img>s; calling window.print() synchronously right after
    //    setting their src lets the print engine snapshot the page before the images
    //    have been decoded, so the graph drops out of the print while the (text) table
    //    survives. Awaiting img.decode() guarantees each graph is painted first.
    const cleanup = () => { const el = document.getElementById('editor-print-doc'); if (el) el.remove(); window.removeEventListener('afterprint', cleanup); };
    const graphImgs = Array.from(doc.querySelectorAll('img.ep-graph'));
    const decoded = graphImgs.map(im =>
      (im.decode ? im.decode() : Promise.reject())
        .catch(() => new Promise(res => { im.onload = im.onerror = res; if (im.complete) res(); }))
    );
    Promise.all(decoded).then(() => {
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 60000);
    });
  }

  // Det offentlige API indeholder kun livscyklus, rendering og spillets facade.
  // Filåbning, eksport, ny tom tidslinje og profilredigering er bevidst ikke
  // tilgængelige fra den publicerede Insights-visning.
  return {
    init, destroy, draw, drawOverlay, drawLockedBoxes, drawLockedEvents, facade,
    _debug: { frames: () => frames, events: () => events, profile: () => profile,
              sourceEvents: () => sourceEvents, sourceBg: () => sourceBg,
              lockedEvents: () => lockedEvents,
              lockedBoxes: () => lockedBoxes, sourceIncidents: () => sourceIncidents,
              alternativeBoxHits: () => alternativeBoxHits,
              yAxisMax: () => editorYAxisMax,
              sourceMode: () => sourceMode,
              playedUntilMin: () => playedUntilMin,
              recompute: () => { recompute(); draw(); updateInspect(); }, bgAt: t => (frames[t] ? frames[t].bg : null),
              sweep: () => sweep, openSweep: (ev, dim) => openSweep(ev, dim) }
  };
})();

if (typeof window !== 'undefined') window.Editor = Editor;
