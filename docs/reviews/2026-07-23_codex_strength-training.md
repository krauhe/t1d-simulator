# Codex physiological review - resistance-exercise calibration

> **Status update (2026-07-23):** The optional high-responder profile described
> below has been removed. The game now uses one shared resistance physiology
> across its weight-based profiles, with weight-scaled contraction uptake and
> a mild intensity-graded educational rise. See
> `2026-07-23_strength-education-weight-scaling-fix.md`.
>
> **Post-exercise update (2026-07-23):** The single sensitivity scale and
> separate plasma drain from glycogen resynthesis described below have been
> superseded. Strength now uses independent fast, early and late sensitivity
> scales with a 120-minute delay from exercise onset, and glycogen resynthesis
> is intracellular bookkeeping rather than an additional Q1 sink. See
> `2026-07-23_strength-postexercise-peis-fix.md`.

**Date:** 2026-07-23
**Scope:** `js/simulator.js`, `js/physiology-engine.js`, exercise tests, visual validation and exercise documentation
**Verdict:** The stop discontinuity and source-equation defects are fixed; protocol and context generalisation remain limited

## 1. Summary verdict

The previous resistance-exercise implementation contained a real internal inconsistency: `e2Scaling`, documented as post-exercise insulin sensitivity, was also applied during the active session. This gave strength training almost the same acute insulin-sensitivity amplification as cardio and could suppress the intended hepatic-output signal. The associated automated test only checked stress accumulation despite claiming that BG rose.

The implementation now distinguishes contraction-mediated uptake,
exercise-driven hepatic production, delayed insulin-mediated sensitivity and
muscle-glycogen use. This matches the best direct tracer evidence found for T1D
resistance exercise: non-insulin-mediated utilization rises during the bout,
insulin-mediated utilization remains unchanged during a 45-minute protocol, and
EGP rises at the same time. The delayed sensitivity state begins from exercise
onset and can become active during a long bout.

The acute flux balance is suitable for an educational comparison of exercise
mechanisms when presented as a deterministic stereotype rather than an
individual prediction. The model should not be presented as a validated
athlete-dose decision model.

## 2. Findings and status

### 2.1 Live and post-exercise sensitivity were conflated

**Severity:** High
**Status:** ✅ FIKSET (v0.9.103-beta, 2026-07-23)

The former `e2Scaling` and `liveSensitivityScaling` split has been replaced.
`insulinSensitivityScaling` now controls one delayed response created at
activity start, and `insulinSensitivityDelayMin` controls onset. Stop only
freezes duration.

### 2.2 Strength stress rates saturated too early

**Severity:** Medium
**Status:** ✅ FIKSET (v0.9.103-beta, 2026-07-23)

Exercise-driven hepatic response is now separate from hypo-/illness-related
`acuteStressLevel`. The resistance rates are `0.008 / 0.016 / 0.025 min^-1`
with separate ceilings `0.25 / 0.60 / 1.00`. This prevents exercise calibration
from changing the 0.4 cap on hypoglycaemic counter-regulation.

### 2.3 Documentation transferred HIIT magnitude to resistance exercise

**Severity:** High
**Status:** ✅ FIKSET (v0.9.103-beta, 2026-07-23)

The previous statement that HIIT and heavy strength “typically” raise BG by 2–5 mmol/L used a +3.7 mmol/L fasted-HIIT result as a generic strength target. Controlled resistance studies instead show a context-dependent range from −1.6 mmol/L through no mean change to approximately +0.9 mmol/L.

`BG-SCIENCE.md` and `MODEL-IMPLEMENTATION.md` now distinguish resistance exercise from HIIT and describe the roles of insulin, prandial state and time of day.

### 2.4 The automated “strength raises BG” test did not assert BG

**Severity:** Medium
**Status:** ✅ FIKSET (v0.9.103-beta, 2026-07-23)

The old test asserted only that acute stress increased. It has been replaced by explicit 60-minute BG ranges for low, medium and high strength and a mechanism-level test of the live/post sensitivity split.

### 2.5 A single strength category still covers heterogeneous exercise

**Severity:** Medium
**Status:** ⚠️ DELVIST (2026-07-23)

The “strength” category includes light weights, conventional resistance exercise, heavy lifting and CrossFit. These differ in set structure, lactate production, catecholamine response and aerobic contribution. The three intensity levels provide an educational approximation, but they cannot reproduce every protocol.

A future dedicated HIIT activity type would be cleaner than raising the high-strength target to match HIIT studies.

### 2.6 Individual athlete response remains underdetermined

**Severity:** High if used clinically; acceptable for the game
**Status:** ⚠️ BY DESIGN

Human data show that time of day, prandial state, insulin on board, starting BG,
training status and protocol structure can reverse the response direction. The
engine now supports an `exerciseHepaticResponseScale` from 0.25 to 3.0. It
reproduces a +5.02 mmol/L high-responder scenario while the standard profile
rises +0.36 mmol/L. The six fixed characters still all use scale 1.0, and the
model is not fitted to an individual athlete.

The clinical presentation should explicitly describe curves as mechanistic examples from fixed fictional profiles, not treatment predictions.

### 2.7 Post-exercise sensitivity is activated discontinuously by `stopActivity()`

**Severity:** High

**Status:** ✅ FIKSET (2026-07-23)

The response is now a delayed rectangular-response state created at exercise
start. A 45-minute resistance bout still has no additional insulin-mediated
sensitivity, while a three-hour bout develops it before stopping. Stop freezes
only the elapsed duration and creates no amplitude.

Manual and automatic stop are continuous and equivalent at 1, 5, 30, 45, 60,
180 and 240 minutes. The equations and quantitative verification are recorded
in `2026-07-23_exercise-model-continuity-fix.md`.

## 3. Logical consistency after the change

- Non-insulin-mediated uptake uses the normalised Resalat E1 equation and
  `contractionUptakeScaling = 0.55`.
- EGP increases through a separate exercise-driven hepatic state.
- No additional insulin-mediated sensitivity is present by minute 45.
- Delayed sensitivity develops during longer work and persists after it.
- Stop creates no amplitude and no instantaneous change.
- Standalone engine and game catalogues contain matching parameters.
- Automated and visual tests use exact steady state and disable unrelated variability.

## 4. Quantitative verification

For a 70 kg fixed profile at exact basal steady state:

| Intensity | ΔBG at 60 min | Accepted range |
|---|---:|---:|
| Low | +0.07 mmol/L | −0.5 to +0.5 |
| Medium | +0.16 mmol/L | +0.1 to +1.0 |
| High | +0.36 mmol/L | +0.3 to +1.5 |
| High responder (scale 3.0) | +5.02 mmol/L | +4.0 to +5.5 |

For medium strength, the model's 45-minute EGP AUC is +1.04 mmol/L and direct
uptake AUC is +1.23 mmol/L, compared with Young et al.'s +1.04 and +1.26
mmol/L endpoints.

## 5. Test status

- PhysiologyEngine API: 21/21 passed.
- Simulation suite: 180/180 passed.
- Event-boundary, ablation and timestep tests were added.
- Browser revalidation passed for E.1 and E.2: all curves, tables and assertions
  rendered, and no JavaScript console errors were recorded.

## 6. Remaining recommendations

1. Add a dedicated HIIT type if the game needs to teach the larger fasted-HIIT
   hyperglycemic response.
2. Retain the visual flux table during clinical demonstrations; BG alone cannot
   show whether a stable curve reflects no physiology or balanced EGP and
   disposal.
3. Do not tighten the current BG ranges until a specific exercise protocol and
   insulin condition are chosen.

## Overall status

- Fixed findings: 5
- Partly addressed limitations: 1
- By-design limitations: 1
- Open implementation defects in reviewed scope: 0
- Browser verification failures: 0
