# Review: model-validation exercise and test structure

**Date:** 2026-07-23
**Scope:** `tests/model-validation.html`, exercise-model coupling, deterministic/stochastic test setup, chapter organization
**Reviewer:** Codex using the project `phys-reviewer` workflow

> **Status: ⚠️ SUPERSEDED (2026-07-23).** This report records the first
> strength-calibration pass. The subsequent source-fidelity and event-continuity
> revision replaced `e1Scaling`/`liveSensitivityScaling`/`e2Scaling` with
> mechanism-specific parameters and removed the stop-triggered sensitivity
> transition. Current results and tests are in
> `2026-07-23_exercise-model-continuity-fix.md`.

## Summary

The validation page now contains 44 sections in nine consecutive chapters (A-I). The exercise chapter has an isolated four-scenario experiment plus a dedicated low/medium/high strength-calibration experiment from exact steady state.

The former live/post-exercise sensitivity mismatch is fixed. Resistance exercise now separates contraction-mediated uptake, live insulin-mediated sensitivity and delayed PEIS. Production physiology, tests and documentation were calibrated together; see `2026-07-23_strength-exercise-calibration-fix.md`.

## Findings

### 1. Strength training does not produce a clearly visible acute BG rise

**Status: ✅ FIKSET (v0.9.103-beta, 2026-07-23)**

The isolated E.1 experiment uses Erik's fixed model parameters, exact steady state, no dawn effect, no food, no bolus and no stochastic variation. All activity scenarios run for 60 minutes at medium intensity and are observed for eight hours. The table below records the pre-calibration result that triggered the fix.

| Scenario | Peak BG, 0-60 min | BG at 60 min | Peak stress | Peak EGP | Peak direct uptake | ISF at 60 min | ISF at 8 h |
|---|---:|---:|---:|---:|---:|---:|---:|
| Control | 5.50 | 5.50 | 0.000 | 0.748 | 0.000 | 3.00 | 3.00 |
| Cardio | 5.50 | 2.55 | 0.187 | 0.830 | 0.948 | 6.76 | 3.95 |
| Strength | 5.59 | 5.33 | 0.400 | 1.129 | 0.046 | 6.36 | 3.82 |
| Mixed | 5.50 | 3.78 | 0.269 | 0.913 | 0.488 | 6.19 | 3.79 |

The strength pathway therefore behaves partly as intended:

- acute stress reaches its cap;
- EGP rises from 0.748 to 1.129 mmol/min;
- direct exercise uptake is much smaller than during cardio.

However, effective ISF rises from 3.00 to 6.36 mmol/L/U during the session. The live fast/early/late exercise boost in `currentISF` is multiplied by the strength activity's `e2Scaling=0.9`, and this effect dominates the catecholamine-driven EGP response.

The new implementation uses `liveSensitivityScaling = 0.0` during strength training, retains `e2Scaling = 0.9` after exercise, and reduces low/medium stress accumulation. The deterministic post-calibration 60-minute changes are −0.04, +0.33 and +0.58 mmol/L for low, medium and high strength. The visual page now tests these explicit ranges and exposes EGP, uptake, stress and delayed ISF.

Relevant locations:

- `tests/model-validation.html:3038` - isolated steady-state exercise test
- `tests/model-validation.html:3194` - explicit mismatch conclusion
- `js/physiology-engine.js:229` - strength `e2Scaling=0.9`
- `js/physiology-engine.js:2395` - combined live and post-exercise ISF calculation
- `docs/MODEL-IMPLEMENTATION.md:1463` - documented 2-5 mmol/L acute rise for heavy strength/HIIT

### 2. Existing automated “strength raises BG” test did not test BG

**Status: ✅ FIKSET (v0.9.103-beta, 2026-07-23)**

`tests/simulation.test.js:1198` is named “Strength training raises BG acutely due to stress response”, but its only assertion checks that `acuteStressLevel` rises. It can pass even when BG does not visibly rise.

The misleading test was replaced by explicit low/medium/high BG ranges and a mechanism test that verifies no added live insulin-mediated sensitivity during strength exercise and preserved PEIS after the session.

### 3. Chapter E contained unrelated tests

**Status: ✅ FIKSET (2026-07-23)**

The previous Exercise chapter mixed exercise, profile sensitivity, macronutrients, low-carb insulin sweeps and IOB accumulation. Tests are now grouped as:

- A: baseline and circadian rhythm
- B: insulin response
- C: food and macronutrients
- D: fixed characters and model parameters
- E: exercise
- F: physiological limits and safety
- G: ketones
- H: stochastic variability
- I: non-linear insulin response

The former N chapter is now I, so the sequence is continuous.

### 4. Deterministic and stochastic test setup was not reliably separated

**Status: ✅ FIKSET (2026-07-23)**

Patching `Simulator.prototype.gaussRand` was not sufficient because `PhysiologyEngine` owns its own RNG. Deterministic comparisons now use a fixed engine seed, fixed mean dawn values, disabled variability modules and disabled CGM noise.

Chapter H now uses a separate `createStochasticSim()` helper. Browser verification showed:

- seven identical 3 U inputs produced a 4.0 mmol/L nadir spread;
- the CGM comparison produced visible noise/lag and MARD 7.2%.

Relevant locations:

- `tests/model-validation.html:435` - deterministic helper
- `tests/model-validation.html:480` - stochastic helper

### 5. Several comparisons measured effect at the wrong point

**Status: ✅ FIKSET (2026-07-23)**

Small insulin inputs were previously evaluated at the intervention curve's nadir. If BG rose throughout the window, the nadir was the starting point and the reported insulin effect became 0.0 even when the curve remained clearly below its matched control.

The new `maxEffectVsControl()` helper evaluates paired curves at the same timestamps and reports their largest separation. Browser verification now reports:

- B.1, 1 U: 2.5 mmol/L maximum effect versus control;
- D.1: Oscar 5.8, Erik 2.5 and Frank 1.1 mmol/L for the same 1 U input.

Relevant location: `tests/model-validation.html:1335`.

### 6. Character boundary tests contradicted the baseline test

**Status: ✅ FIKSET (2026-07-23)**

D.3 and D.4 previously required a 24-hour basal-only trajectory to remain in a narrow BG range, while A.1 explicitly documents that basal-only is expected to drift because of dawn and circadian effects.

The boundary tests now check numerical integrity (finite, non-negative, bounded values) and compare insulin inputs against matched controls. Physiological drift remains visible rather than being misclassified as numerical instability.

### 7. Existing model warnings outside the exercise scope remain visible

**Status: ❌ ÅBEN**

The complete browser run still reports these pre-existing warnings:

- F.4: glucagon peak at 59 min versus the stated 20-30 min target;
- F.5: fasting-state glucagon rise is labelled “minimal” at +3.79 mmol/L;
- F.7: liver-pool recovery with meals does not reach the stated target within 12 h;
- G.6: pump-failure day-one BHB baseline is 0.50 mmol/L, above the section's expectation;
- I.3: clamp M-value at 60 mU/L is 14.5 mg/kg/min versus the displayed 5-8 target (already marked as a Hovorka design limitation).

These were not changed because they require separate physiological decisions rather than test-page restructuring.

## Verification

- `tests/.bin/node.exe tests/physiology-engine-api.test.js`: 21/21 passed
- `tests/.bin/node.exe tests/simulation.test.js`: 172/172 passed
- Inline JavaScript parse: passed
- Browser run after calibration: 44/44 sections completed, 80 pass markers,
  0 fail markers and no console errors

## Overall status

- Fixed test-page/setup and exercise findings: 7
- Open physiology/model findings in exercise scope: 0
- Runtime errors: 0
- Production model changes: 2 coordinated engine/catalogue files
