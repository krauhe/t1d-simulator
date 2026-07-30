<!-- doc-version: 2026-06-23-v1 -->
# T1D Simulator — Mobile Version: Design & Implementation Strategy

Status: **design / planning** (no production mobile code yet). Working branch: `mobile-version`.
Interactive mockup: [`mockups/2026-06-23_mobil-layout/index.html`](../mockups/2026-06-23_mobil-layout/index.html) (self-contained, phone-testable).

This document captures the agreed direction for a dedicated mobile version of the
T1D Simulator, distilled from the design thread + playtest feedback on the mockup.
It is the single reference for the design language and the build plan. (Technical
doc → English, per the project language policy.)

---

## 1. Why a mobile version

- **~70% of front-page visitors arrive on mobile**, and the current desktop layout
  only degrades onto small screens — it does not convert them.
- The educational mission depends on reach: getting newly-diagnosed T1D patients
  (and children) to actually *try* the simulator.
- **Strategic framing — mobile as a familiar on-ramp.** A great mobile first-touch
  can later convert players to the richer *desktop* version (which keeps the editor,
  dashboard, deep tour, and more). That hand-off only works if mobile feels
  **familiar** — same look, same icons, same graph, same mental model. Therefore:
  reuse as many desktop design references as possible. Familiarity is a feature.

---

## 2. Architecture: shared core + dedicated mobile shell

Decision (locked): **one shared core, one purpose-built mobile view layer.** Not a
responsive single codebase (would contort the 7.5k-line desktop CSS and compromise
the touch UX); not a separate re-implementation (would duplicate the physiology).

The split is at the View/Controller boundary. The expensive, frequently-changing
layer (physiology, engine, data, strings, design tokens, graph renderer) is shared
single-source; only the cheap, slow-changing view layer is built fresh for mobile.

### 2.1 Shared 100% (zero divergence)

| Module | Why it just works |
|---|---|
| `js/hovorka.js`, `js/physiology-engine.js`, `js/simulator.js` | Pure model, no DOM. Mobile calls the same `addFood()` / `giveInsulin()` / activity actions. |
| `js/campaign.js`, `js/levels.js` | Level gating, objectives, stars, characters and tips = data + logic. Only the level-select *markup* needs mobile styling. |
| `js/foods.js`, `js/guide-data.js`, `js/version-data.js` | Pure data (incl. food categories + icon paths). |
| `js/i18n.js` (all da/en strings) | Huge win — all game text shared, no translation drift. |
| `js/sounds.js` | Audio independent of layout. |
| CSS `:root` design tokens, Inter/Orbitron fonts, `assets/` icons | The visual DNA — reused, not copied. |

### 2.2 Shared after a small enabler refactor

- **Graph renderer.** Extract `drawGraph()` + its helpers from `js/ui.js` into a new
  `js/graph-renderer.js` that both shells load. It is already viewport-agnostic
  (reads `getBoundingClientRect`, DPR-aware) and already supports an arbitrary view
  window via `graphViewOverride` (used by the editor) — see §7.
- **Domain logic currently misfiled in `ui.js`.** These are pure/stateful logic, not
  rendering, and should move to the shared layer so both shells share one implementation:
  - Pure: `getBGZone()`, `cgmTrendForRate()`, `shouldShowCalorieBalanceUI()`, `escapeHtml()`.
  - State-mutating (belong in `simulator.js` per "fix it in the engine, not the app"):
    `logEvent()` (pushes to `game.logHistory`, sets `lastActionTime`), the daily-max /
    star-burst trigger logic, the KE/kcal food math.
  - Net effect: mobile's `updateUI` equivalent becomes thin — *read game state + call
    shared helpers + write mobile DOM*. The intelligence stays single-source.

### 2.3 Built fresh for mobile (the bounded duplication)

- `mobile.html` — portrait HUD shell
- `mobile.css` — layout only; imports the shared `:root` tokens
- mobile `updateUI` (DOM binding to mobile elements)
- mobile touch event wiring (no keyboard shortcuts)
- bottom-sheet interaction panels
- mobile onboarding (replaces the desktop graph-overlay tour)
- mobile-sized popups (mode select, level select, game over) — content reused, restyled

### 2.4 Excluded from mobile v1

Scenario editor (`js/editor.js`), physiology dashboard (`physiology-dashboard.html`),
the graph-overlay welcome tour (`js/welcome-tour.js`), debug sidebar, physiology band
overlays. These stay desktop-only (and are part of "desktop can do more"). Box
Challenge: keep — a daily 3-life loop suits mobile; evaluate during build.

---

## 3. Scope: lean playable core

Sandbox + campaign core loop fully playable on a phone: live BG graph, CGM reading,
give insulin (bolus + basal), eat, exercise, day/time progression, speed control,
star rating, neutral tips, game over. Deep/authoring features stay on desktop.

---

## 4. Portrait layout (the HUD)

Top → bottom, filling `100dvh`. "The graph dominates" — same principle as desktop.

```
┌──────────────────────────────────┐
│ ☰      Dag 3 · 14:20           ⚙ │  1 Top strip (menu / day·time / settings)
├──────────────────────────────────┤
│ 8.4 ↗ │ IOB 2.1  ┊  TIR 78%      │  2 CGM hero = stats hub:
│ mmol/L│ COB 30   ┊  Snit 7.9      │    current (left) ┊ global (right)
│       │          ┊  Point 1.240   │
├──────────────────────────────────┤
│         [ BG graph 12h ]          │  3 Graph — 12h rolling (§7), dominates
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │  4 Dock panel (blue glow, desktop look):
│ │ 💉      🍽      🏃      🧰    │ │    themed icon tiles + labels…
│ │Insulin Mad  Aktiv.  Kit       │ │
│ │ ───────────────────────────   │ │    …and the speed control on the
│ │      ◀   ▶ 4 t/min   ▶        │ │    SAME panel (divided by a hairline)
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

1. **Top strip** — `☰` menu · center shows the **game mode** (e.g. "Kampagne",
   or the level name) on a small line *above* "Dag N · HH:MM" · `⚙` settings. Thin,
   glass panels. (In campaign the day can show day/total, e.g. "Dag 3 / 7".)
2. **CGM hero = the single stats hub.** Large Orbitron BG number + trend (zone-
   coloured) on the far left, then all stats as pills (like IOB/COB): **current
   values on the left** (IOB, COB) and **global level stats on the right** (TIR,
   Snit BS, Point), separated by a small vertical divider. The divider encodes the
   distinction: left = "now / current", right = "global for this level". (This
   replaced the separate stats strip — folding stats into the hero frees vertical
   space for the graph. The old life-bars are dropped; danger states become
   *contextual* alerts.)
3. **Graph** — the play field; gets the most vertical space. See §7.
4. **Bottom dock panel** — one panel styled like the **desktop dock** (`--bg-elevated`
   bg, `--border-subtle`, `radius-xl`, `blur(10px)`, **blue glow** box-shadow). It
   holds the 4 themed icon tiles (135° gradients per type + uppercase labels, exactly
   like the desktop dock icons) AND the **speed control on the same panel** (a
   `◀  ▶/⏸ + rate  ▶` stepper below a hairline divider) — mirroring the desktop
   dock-container where the dock and the speed-stepper sit together. Speed lives at
   the bottom (used often) and reuses the desktop speed-stepper pattern.

---

## 5. Interaction model

### 5.1 Unified two-step bottom sheets

Tapping an action opens a full-width bottom sheet with the **same flow everywhere**:
**tap → pick sub-category → reduced detail** (with a back arrow). One action on
screen at a time; big touch targets; no keyboard-shortcut labels. This is the central
simplification of the wide desktop dock panels.

- **Insulin** → Hurtig (bolus) / Basal → stepper + presets + CTA.
- **Mad** → the **same 3 desktop categories** (familiar): **Lav-kulhydrat /
  Måltider / Hurtige kulhydrater** → the same 6 desktop foods per category, with the
  **real food icons** (`assets/icons/food/*`) and carb grams from `js/foods.js`.
- **Aktivitet** → **Cardio / Styrke / Blandet** (3 types; yoga/relaxation dropped to
  match the desktop chips) → intensity (Let / Middel / Hård) → start. Real activity
  icons (`activity-shoe`, `activity-strength`, `activity-ball`).

### 5.2 T1D Kit — deliberate exception: flat symmetric 2×2

Kit is NOT two-step. It is a flat 2×2 grid so emergency items are one tap, not two:

```
[ Fingerprik ]   [ Keton-test ]     ← measurement (top)
[ Glukagon   ]   [ Druesukker  ]    ← emergency (bottom, easiest thumb reach)
```

Measurement on top, emergency on the bottom row (closest to the thumb). Glukagon
bottom-left, Druesukker bottom-right. Rationale: in a hypo, speed matters — two taps
is wrong. (Labels stay neutral; no "easiest to reach" wording in the UI.)

### 5.3 Neutral tip bar

Dismissible tip pinned to the **top** of the graph (so it never covers the x-axis or
the recent curve), reusing the desktop lightbulb icon + the graph-tip pattern.

---

## 6. Familiar-design principle

When anything resembles the desktop, reuse the exact pattern, class structure, colour,
and asset — visually *and* functionally. Concretely for mobile: same `:root` tokens
(dark theme, `--green/orange/red`, insulin-blue / food-amber / activity-green /
kit-slate dock themes, blue glow), Inter + Orbitron, the real app + food icons, the
CGM hero with Orbitron number, and the graph rendered by the shared renderer (§7).
Hide keyboard-shortcut indicators (`.pc-key` / `.dock-key`) on mobile.

---

## 7. Graph fidelity + 12-hour rolling window

### 7.1 Mirror desktop styling exactly

The mobile graph must look like the desktop graph (`drawGraph()` in `js/ui.js`). The
mockup reproduces it verbatim:

- **Vertical pastel zone gradient** with soft 0.8 mmol/L transitions at 4 / 10 / 14:
  pink `rgba(255,150,170,.12)` (hypo) · mint `rgba(134,239,172,.12)` (target 4–10) ·
  amber `rgba(253,224,130,.10)` (elevated 10–14) · peach `rgba(255,180,170,.08)` (hyper).
- **Faded boundary lines** at 4 / 10 / 14 (2px, horizontal gradient — strongest at
  centre, transparent at the edges): pink α.20 / mint α.18 / amber α.15.
- **5–6 "sweet spot" band** — mint `rgba(134,239,172,.11)` with the same horizontal
  fade. Marks the 2-points/hour scoring zone (`BG_ZONES`, `updateNormoPoints`).
- **Night shading** 22:00–07:00 at `rgba(10,10,40,.55)`.
- **CGM dots**, not a connected line (live play shows dots): dense zone-coloured dots
  (green `#4ade80` / orange `#fb923c` / red `#ef4444`); dots in 5–6 get a mint glow
  (`shadowColor rgba(134,239,172,.8)`, blur 10) and radius 3.5 vs 3. The blue
  `rgba(130,165,255,.95)` line is debug/editor only.

### 7.2 Proposed mobile default: 12-hour rolling window

Instead of a static 24h day squeezed into ~360px, **show 12 hours and scroll**: the
graph always shows a 12h window that rolls forward through the day and continues into
the next night (12h at a time). Benefits on a small screen: ~2× the horizontal
resolution per hour, so the CGM trail and recent events read clearly.

- **Feasibility — no model change.** The desktop renderer already takes a view window:
  `const view = graphViewOverride || { startMin, widthMin, isLive }` (`js/ui.js`,
  ~line 679; the editor already supplies non-day-aligned windows that span midnight,
  and night shading already loops per day in view). Mobile supplies a rolling 12h
  window (`widthMin: 720`) — a **view config**, reused from the shared renderer.
- **Anchoring (to decide):** keep "now" at ~80–90% from the left so a little future
  space is visible, scrolling continuously; or page in 12h steps. The mockup shows a
  static 03:00–15:00 snapshot (now 14:20) to illustrate.
- **Decided:** desktop keeps its **24h day-aligned** window for now; mobile uses the
  **12h rolling** window. Both render through the *same* shared renderer — the window
  is just a per-shell view config, so no shared engine-level 12h feature is needed yet.

---

## 8. Going fullscreen — PWA / app

The mobile browser chrome wastes vertical space. Path:

1. **PWA (primary).** A web app manifest with `display: standalone` (+ the
   `mobile-web-app-capable` / apple meta tags, `theme-color`, safe-area insets) lets
   users **"Add to home screen"** and run the game with **no browser bar**, like an
   app, with its own icon. Requires https — GitHub Pages already serves https; does
   not work on `file://`. The mockup already includes the manifest + meta hooks.
2. **Fullscreen API** as an in-session option (user gesture; https/localhost).
3. **Later:** wrap as a real app (TWA / Capacitor) for App Store / Play if desired —
   PWA gets ~90% of the benefit for free first.

---

## 9. Implementation plan (phases)

A quick **CSS-triage** of the current page can run as a cheap parallel track ("stop
the bleeding" so the 70% don't bounce on a broken layout, and to measure the effect)
before the real shell lands.

- **Phase 0 — enabler refactor.** Extract `graph-renderer.js` from `ui.js`; lift the
  misfiled domain logic (§2.2) into the shared layer. No desktop behaviour change;
  commit first for a safe fallback point.
  - *Started 2026-06-23:* `js/graph-renderer.js` created and now owns `BG_ZONES`,
    `getBGZone`, `CGM_TREND_LEVELS`, `cgmTrendForRate` (loaded before `ui.js` in
    `index.html`). Verified: desktop loads clean (no console errors, helpers resolve
    and return correct zones), and 161/161 model tests pass. **Next:** migrate
    `drawGraph` + its drawing helpers (updateYAxisScale, drawSymptomOverlay,
    renderFloatingLabels, icon/image caches) into this file, then the misfiled
    state-mutating logic (logEvent, daily-max trigger, KE/kcal math).
- **Phase 1 — mobile shell skeleton.** `mobile.html` + `mobile.css` portrait HUD;
  device routing; reuse the shared game loop; get a live BG graph (12h window)
  rendering and ticking on a phone.
  - *Started 2026-06-23:* `mobile/index.html` + `mobile/mobile.css` + `mobile/mobile.js`
    + `mobile/manifest.webmanifest` created — the real shell foundation. Portrait HUD
    with the agreed design, reusing the real `../assets/` icons and the shared
    `getBGZone()` for dot colours. Working bottom-sheets (two-step + Kit 2x2) and
    speed control. Verified: loads clean, 0 broken icons, graph paints, interactions
    work.
  - *Engine wired 2026-06-23:* `mobile/index.html` loads the shared model (i18n,
    foods, hovorka, physiology-engine, simulator); `mobile.js` provides the host
    globals the engine expects (appSettings, cgmDataPoints/trueBgPoints/
    physiologyDataPoints, speedSelector, logEvent, MAX_GRAPH_POINTS_PER_DAY,
    KCAL_PER_KG_WEIGHT, + stubs for the unguarded DOM-element globals
    normoPointsWeighting / pointsBadge / steepDropWarningDiv) and drives a sandbox
    Simulator on a rAF loop. The HUD (BG/IOB/COB/clock/day/TIR/BSgns/Point/trend)
    and the 12h rolling graph are fed from LIVE state; dot colours + trend reuse the
    shared getBGZone/cgmTrendForRate. Speed control + pause drive
    game.simulationSpeed / isPaused. Added a PC-test frame (phone-sized box on a wide
    browser, full-screen on a phone — phone Dropbox sync was dropping files).
    Verified by driving 24 sim-hours headless: ticks clean (no errors), 289 CGM
    points, BG evolves, HUD + graph update. (rAF only ticks in a *visible* tab — same
    as desktop — so it runs live on the user's PC browser, not in headless eval.)
  - **Next:** wire the bottom-sheet actions (eat / insulin / activity / kit) to the
    Simulator methods (addFood / giveInsulin / startActivity / …); then campaign mode
    + level select, mode + character from live state, and optionally reuse the full
    desktop drawGraph once migrated.
- **Phase 2 — core interactions.** Bottom sheets for insulin / food / activity, the
  Kit 2×2, the bottom speed control; wire to `simulator` actions + `foods.js`.
  - *Done 2026-06-23 (commit 9d43c74):* all four sheets drive the shared Simulator —
    food (`addFood` with macros from `FOODS`), insulin (`addFastInsulin` bolus /
    `addLongInsulin` basal, with the same coarse presentation caps and presets as desktop
    from `js/dose-controls.js`), activity
    (`startAktivitet(type, intensity, 30)`), kit (`performFingerprick` /
    `performKetoneTest` / `useGlucagon` / dextrose). Each action closes the sheet +
    refreshes the HUD. Verified in-browser: eat → COB↑, bolus → IOB↑, basal dose
    given, activity starts, fingerprick adds a measurement; no console errors.
    **→ The sandbox lean core is now playable on mobile (PC test frame too).**
- **Phase 3 — mode flow.** Mode select, campaign level select, game over + stars +
  character scenes — content reused, restyled as sheets.
- **Phase 4 — onboarding.** Lightweight 3-card mobile intro (replaces the tour).
- **Phase 5 — polish + PWA.** Manifest/standalone, landscape handling, performance,
  cross-device testing.

---

## 10. Decided / open

**Decided:** portrait-only (no landscape — a 12h portrait graph gives more room than
cramming into landscape); 12h rolling for mobile, 24h day for desktop (§7.2); stats
folded into the CGM hero as current-left / global-right pills (§4); bottom dock panel
mirrors the desktop dock + speed on the same panel.

**Still open:**
- **Two-step "extra tap"** on the most-used action (eat/bolus): accept it, or land on
  the most-used category directly (e.g. Mad → Måltider with the others as tabs), or
  add a "Seneste / favoritter" shortcut row? (Lean toward favourites.)
- **12h window anchoring:** continuous scroll vs 12h paging; where to fix "now"
  (e.g. ~80–90% from the left).
- **Stats labels for a lay audience:** "TIR" matches real CGM apps (educational) but
  is jargon — keep, or use a plainer label?

---

## 11. Feedback log (mockup iterations)

- **v1** — first portrait HUD (frame + caption, emoji icons, 24h static graph).
- **v2** — removed life-bar strip; unified two-step sheets; combined speed pill;
  bigger axis labels; dismissible tip bar; self-contained icons; PWA hooks.
- **v3** — stats gathered (TIR · Snit BS · Point); speed moved to the bottom; Kit as
  a flat 2×2 (emergency on the bottom row).
- **v4** — real desktop food icons + the 3 desktop food categories; yoga dropped
  (3 activity types); removed "nemmest at nå" label; **12h rolling graph**; graph
  reproduces the desktop zone gradient / boundary lines / 5–6 sweet-spot band / CGM
  dot trail verbatim.
- **v5** — bottom menu is now a **desktop-dock-style panel** (blue glow, themed icon
  tiles) with the **speed control on the same panel**; **stats moved into the CGM
  hero** (current left ┊ global right, divider); portrait-only + 12h/24h split locked.
  Hero verified no-overflow down to 360px width.
- **v6** — game **mode shown above the day label** (e.g. "Kampagne" over "Dag 3 ·
  14:20"); **speed control restyled to the exact desktop speed-stepper** (glow pill,
  `◀ ▶/state 4t/min ▶`) on the dock panel; **Point coloured `#fbbf24`** (the desktop
  points yellow). Verified at 360px: 0 broken icons, no overflow.
- **v7** — avg-BS pill labelled **"BSgns"** (desktop term); **day shows total**
  ("Dag 3/7"); **Point moved to the top** of the global column; speed control made a
  fully-rounded **capsule** (border-radius 999px). All verified.
