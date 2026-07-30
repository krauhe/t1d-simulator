# Glucose Model Re-Review

Date: 2026-04-07
Scope: `js/hovorka.js`, `js/simulator.js`, validation/tests
Focus: physiological correctness, numerical stability, follow-up after prior fixes

## Overall assessment

The simulator is in a better state than in the previous review. Several of the earlier high-priority issues appear to be fixed:

- basal insulin is now separated from bolus-specific `tauFactor` via the shadow cascade (`S1b/S2b/Ib`);
- start-BG initialization now updates both `Q1` and `Q2`;
- the hard `0.5 mmol/L` glucose floor in the Hovorka core is gone;
- ketones are now updated in the substep loop instead of once per coarse tick.

That said, the latest refactor has introduced new inconsistencies around rescue/reset logic, and one important structural modeling issue remains in the rapid-insulin system.

## Findings

### 1. Rescue/reset writes "basal steady state" into the rapid depot instead of the basal shadow depot

**✅ FIKSET (2026-04-10)** — `_resetToStableBG()` skriver nu basal steady state til `state[13..15]` (S1b/S2b/Ib), holder rapid-depotet tomt (`state[2]=state[3]=0`), og sætter insulin-action states (`x1/x2/x3`) korrekt fra steady state.


Files:
- `js/simulator.js:3949`
- `js/simulator.js:3966`
- `js/simulator.js:3967`
- `js/hovorka.js:487`
- `js/hovorka.js:493`

Severity:
- High

Problem:
- `_resetToStableBG()` claims to restore a basal steady state after hypo/DKA rescue.
- But the function writes `ssRate * tau_I` into `state[2]` and `state[3]`, which are the rapid compartments `S1/S2`.
- The actual basal system after the refactor lives in `state[13..15]` (`S1b/S2b/Ib`), and those states are not reinitialized here.

Why this matters:
- The rescue creates a hidden rapid-insulin bolus immediately after the player is "stabilized".
- On the next updates, that insulin starts entering plasma as if the game had injected a fresh fast bolus.
- This is not only physiologically wrong; it also breaks the clean basal/bolus separation that the rest of the refactor introduced.

Local reproduction:
- Right before `_resetToStableBG(7.0)`, a fresh box-challenge simulator had `rapidDepot = 0` and `basalDepot = 0.905 U`.
- Immediately after reset, `rapidDepot` jumped to `0.906 U` while `basalDepot` stayed unchanged.
- After one minute, the model reported `0.0082 U` rapid plasma insulin and `iob = 0.906 U`, even though `activeFastInsulin` had been cleared.
- Over the next hour, BG drifted `7.00 -> 7.50 -> 6.08 mmol/L`, which is not a stable rescue state.

Recommendation:
- If the intention is true basal steady state, initialize `state[13]`, `state[14]`, and `state[15]`, not `state[2]` and `state[3]`.
- Keep the rapid depot empty after rescue unless the design explicitly wants a fast rescue bolus.
- Recompute `iob` from the corrected state after reset rather than zeroing it optimistically.

### 2. Rescue/reset still overfills the peripheral glucose compartment (`Q2`)

**✅ FIKSET (2026-04-10)** — `Q2` beregnes nu fra de opdaterede insulin-action states via Hovorka steady state: `Q2 = x1 · Q1 / (k_12 + x2)`. Den hardkodede `0.8 · Q1`-regel er væk.


Files:
- `js/simulator.js:3951`
- `js/simulator.js:3953`

Severity:
- High

Problem:
- `_resetToStableBG()` sets `Q2 = 0.8 * Q1` as a hard-coded proportional rule.
- In the actual Hovorka rest state, the steady ratio is not fixed at `0.8`; it depends on the current action states through roughly `Q2/Q1 = x1 / (k_12 + x2)`.
- In a normal initialized state, the model's own equilibrium was around `Q2/Q1 = 0.412`.
- Even after the reset's current insulin-action states, the implied steady ratio was about `0.488`, still far from `0.8`.

Why this matters:
- The reset injects too much glucose mass into the peripheral compartment.
- That artificially increases the `k_12 * Q2` backflux into plasma and pushes BG upward immediately after rescue.
- So even if the insulin reset were corrected, the glucose subsystem would still start from a non-equilibrium state.

Local reproduction:
- After `_resetToStableBG(7.0)`, the current code produced `BG = 7.1276 mmol/L` after one minute.
- In a comparison run where only `Q2` was changed to the model-implied steady ratio, BG after one minute was `6.9834 mmol/L`.
- The wrong `Q2` alone therefore added about `0.144 mmol/L` of artificial upward drift in the first minute.

Recommendation:
- Compute `Q2` from the current action state instead of using `0.8 * Q1`.
- Better: derive a constrained steady state for `Q1/Q2/x1/x2/x3` at the target BG before returning control to the game.

### 3. Rapid boluses still share one global `tau_I`, so doses are not kinetically independent

**✅ FIKSET (2026-04-10)** — Hver rapid bolus har nu sit eget depot-par (`s1`, `s2`) og sin egen `tauI`. `_substepRapidInsulin()` itererer over alle aktive boluser og summerer bidragene til `rapidU_I`, som Hovorka-modellen læser. `state[2]`/`state[3]` bruges nu kun som cache til IOB-display og respawn-logik.


Files:
- `js/simulator.js:1348`
- `js/simulator.js:1378`
- `js/simulator.js:1382`
- `js/hovorka.js:409`
- `js/hovorka.js:413`

Severity:
- Medium

Problem:
- Basal insulin is now decoupled from bolus variability, which is good.
- But all active rapid injections still collapse into one shared `tau_I`, set as a weighted average of their `tauFactor`.
- That means a later slow bolus can retroactively slow an earlier fast bolus that is already sitting in `S1/S2`, and vice versa.

Why this matters:
- Injection-site variability is dose-specific, not a global property of the entire rapid depot.
- Two boluses at different sites should add, not alter each other's absorption constants.
- The current implementation introduces nonlinear interaction between otherwise independent doses.

Local reproduction:
- Scenario A: `1.0 U` rapid bolus with `tauFactor = 0.5` at `t=0`.
- Scenario B: same bolus, plus `0.25 U` with `tauFactor = 1.6` at `t=30 min`.
- Scenario C: only the delayed `0.25 U` slow bolus at `t=30 min`.
- At `t=60`, rapid-insulin mass was:
  - A: `0.428 U`
  - B: `0.728 U`
  - C: `0.243 U`
- If doses were kinetically independent, B should be close to `A + C = 0.670 U`. Instead it was `0.728 U`, about `0.058 U` higher.
- Over the same interval, the shared `tau_I` jumped from `27.5 min` to `40.5 min` when the second bolus was introduced.

Recommendation:
- Give each rapid bolus its own depot pair, or use a small bank of rapid depots with per-dose `tau_I`.
- If that is too heavy for gameplay, accept a shared rapid profile and remove per-injection `tauFactor` rather than pretending the kinetics are independent.

### 4. Acidosis accumulation has a hard insulin cutoff on top of a continuous suppression curve

**✅ FIKSET (2026-04-10)** — Den hårde `insulinSuppression > 0.3` gate er erstattet af en C¹-kontinuerlig Hermite smoothstep over intervallet [0.3, 0.5]. Diskontinuiteten ved plasma I ≈ 7.64 mU/L er væk uden at påvirke randtilfældene (I=0 giver stadig fuld rate, I≥8 giver stadig rate=0 → faste-ketose forbliver ufarlig).


Files:
- `js/simulator.js:2525`
- `js/simulator.js:2527`
- `js/simulator.js:2531`

Severity:
- Medium

Problem:
- `updateAcidosisLoad()` first computes a smooth insulin-suppression factor.
- But it then applies a hard gate: acidosis only accumulates when `insulinSuppression > 0.3`.
- This creates a discontinuity near plasma insulin `~7.64 mU/L` for the current formula.

Why this matters:
- The rate already scales continuously with insulin.
- The extra threshold means a tiny insulin change can flip acid generation from a substantial positive value to exactly zero.
- That is both numerically brittle and physiologically implausible; DKA risk should taper, not switch.

Local reproduction:
- With `BHB = 5 mmol/L`, the model gives:
  - `I = 7.60 mU/L` -> `insulinSuppression = 0.302` -> positive acidosis rate
  - `I = 7.64 mU/L` -> `insulinSuppression = 0.300` -> rate becomes exactly `0`
- So a `0.04 mU/L` insulin change flips the model from ongoing acid accumulation to none at all.

Recommendation:
- Remove the extra `insulinSuppression > 0.3` gate and let the continuous suppression term control the rate.
- If a lower bound is needed for gameplay reasons, smooth it with another sigmoid instead of a hard switch.

## Lower-priority observation

### 5. The old coarse-step ketone updater still exists as dead duplicate logic

**✅ FIKSET (2026-04-10)** — `updateKetones()` metoden er slettet (~73 linjer død kode). Den store KETONE MODEL-dokumentationsblok er flyttet til over `_substepKetones()` så den aktive implementation har den fulde fysiologi-dokumentation.


Files:
- `js/simulator.js:1826`
- `js/simulator.js:3126`
- `js/simulator.js:3215`

Severity:
- Low

Problem:
- The update loop now correctly states that ketones are updated in `_substepKetones()`.
- But the old `updateKetones(simMinutes)` implementation still exists and duplicates the same model structure.
- A code search in the current simulator found no active call sites for `updateKetones()`.

Why this matters:
- It is not an active runtime bug today.
- But duplicate physiology code is a calibration risk: the two versions can silently drift apart and future changes may touch the wrong one.

Recommendation:
- Delete the unused method, or keep only a thin wrapper that forwards to the substep implementation.

## Suggested next improvement order

1. Fix `_resetToStableBG()` so basal goes into `S1b/S2b/Ib` and rapid stays empty.
2. Recompute `Q2` from the current state instead of using the fixed `0.8 * Q1` rule.
3. Decide whether rapid insulin should be modeled as truly per-bolus PK or as one shared depot, and make the implementation consistent with that choice.
4. Remove the hard acidosis cutoff and rely on a smooth insulin-dependent rate.
5. Remove the dead duplicate ketone updater.

## Validation performed

- `node tests/simulation.test.js` -> `109/109 tests passed`
- Additional targeted local probes were run for:
  - rescue/reset state consistency;
  - rapid-insulin interaction between overlapping boluses;
  - acidosis threshold continuity.

## Bottom line

The core model is stronger than in the previous review, and the last fix round clearly improved it. The remaining issues are now concentrated in transition logic and state-reset logic rather than in the core ODE loop itself. The rescue/reset path is the most important thing to fix next.

---

## Status-opsummering (2026-04-10)

| # | Issue | Status |
|---|---|---|
| 1 | Respawn/reset skriver til rapid depot | ✅ FIKSET |
| 2 | Respawn/reset sætter Q2 = 0.8 · Q1 | ✅ FIKSET |
| 3 | Rapid boluser deler én global tau_I | ✅ FIKSET |
| 4 | Hård acidose-cutoff ved insulinSuppression > 0.3 | ✅ FIKSET |
| 5 | Død duplikat updateKetones() metode | ✅ FIKSET |

**Alle 5 punkter i rapporten er lukket.** Tests: 109/109 passerer efter alle fixes.
