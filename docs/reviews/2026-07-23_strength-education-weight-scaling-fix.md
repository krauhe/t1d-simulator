# Shared resistance-exercise learning calibration

**Date:** 2026-07-23
**Scope:** Weight scaling of contraction uptake and the shared acute
resistance-exercise response
**Status:** Implemented locally; not committed or pushed

## Background

The resistance model was initially calibrated around the 70 kg reference
profile. A parameter sweep across the three fixed weight profiles revealed that
the same 60-minute high-intensity session changed BG by -0.62 mmol/L at 40 kg,
+0.36 mmol/L at 70 kg and +0.72 mmol/L at 100 kg. The direction therefore
depended on body weight even though the character system intentionally has one
shared physiology with weight as its only profile axis.

The game is an educational model rather than an individualized response
predictor. Its shared resistance scenario should make the possibility of an
exercise-driven hepatic rise visible without introducing responder phenotypes.

## Diagnosis

Resalat et al. report the contraction parameter `beta` as an absolute,
subject-fitted uptake flux with a median of 0.78 mmol/min and an observed
parameter interval of 0.57-1.03 mmol/min. The simulator reused exactly
0.78 mmol/min at every body weight:

```text
direct contraction uptake = beta x E1
beta = 0.78 mmol/min
```

The principal Hovorka body fluxes and distribution volumes scale with body
weight, but this exercise flux did not. Consequently, direct uptake per litre
was 2.5 times larger at 40 kg than at 100 kg for the same normalized E1 signal.

The former optional `exerciseHepaticResponseScale` could compensate
numerically, but doing so represented different response phenotypes. That is
outside the intended fixed educational design and was removed.

## Solution

### Weight-scaled contraction flux

The Resalat median is retained exactly at the 70 kg reference:

```text
beta(BW) = 0.78 mmol/min x BW / 70 kg
```

This is an adapted body-size approximation, not a direct Resalat equation.
Total body weight is used as a proxy because the simulator has no independent
lean-mass compartment. It gives one shared qualitative exercise model across
the three fixed weight profiles.

### Shared educational hepatic calibration

Only the resistance activity's hepatic-drive rate and ceiling were raised by
25 percent:

| Intensity | Previous rate | New rate | Previous ceiling | New ceiling |
|---|---:|---:|---:|---:|
| Low | 0.008/min | 0.010/min | 0.25 | 0.3125 |
| Medium | 0.016/min | 0.020/min | 0.60 | 0.75 |
| High | 0.025/min | 0.03125/min | 1.00 | 1.25 |

The contraction scaling, PEIS scaling, PEIS delay, heart-rate targets and
glycogen-use scaling are unchanged.

## Verification

### Before and after at 60 minutes

| Weight | Intensity | Before | After |
|---:|---|---:|---:|
| 40 kg | Low | -0.27 | +0.27 mmol/L |
| 40 kg | Medium | -0.50 | +0.56 mmol/L |
| 40 kg | High | -0.62 | +0.96 mmol/L |
| 70 kg | Low | +0.07 | +0.26 mmol/L |
| 70 kg | Medium | +0.16 | +0.54 mmol/L |
| 70 kg | High | +0.36 | +0.94 mmol/L |
| 100 kg | Low | +0.20 | +0.25 mmol/L |
| 100 kg | Medium | +0.41 | +0.52 mmol/L |
| 100 kg | High | +0.72 | +0.91 mmol/L |

The after-values are intentionally narrow across weight:

- low: +0.25 to +0.27 mmol/L;
- medium: +0.52 to +0.56 mmol/L;
- high: +0.91 to +0.96 mmol/L.

### Literature and context checks

- The 70 kg medium-strength 45-minute contraction AUC remains
  1.23 mmol/L because `beta(70 kg)` is unchanged.
- The corresponding exercise-specific EGP AUC is 1.35 mmol/L, within the
  Young et al. 2023 interval of 0.65-1.43 mmol/L.
- Fasted morning medium resistance changes BG by +0.76 mmol/L, while the fed
  afternoon scenario changes BG by -0.91 mmol/L. The context-dependent
  direction reversal is preserved.
- The activity matrix remains finite in 486/486 scenarios. All 162 mixed
  scenarios remain between matched cardio and resistance scenarios.
- The automated simulation suite passes 181/181 tests.

The targets are a transparent educational calibration, not a claim that every
real resistance session raises BG.

## Sub-agent input

No sub-agents were used.

## Files cited

- `js/hovorka.js` - body-weight scaling of the Resalat beta flux.
- `js/physiology-engine.js` - standalone resistance activity parameters and
  removal of the profile response scale.
- `js/simulator.js` - game resistance activity parameters and facade cleanup.
- `js/main.js` - physiology display uses the shared hepatic drive directly.
- `tests/simulation.test.js` - weight-scaling invariant and nine
  weight-by-intensity learning targets.
- `tests/activity-validation.js` - shared hepatic-drive diagnostics.
- `tests/model-validation.html` - low/medium/high shared resistance display.
- `docs/MODEL-IMPLEMENTATION.md` - implementation contract.
- `docs/BG-SCIENCE.md` - implementation cross-reference.
- Resalat N, El Youssef J, Reddy R, et al. (2020). Extended Hovorka exercise
  model, `docs/references/PMC7449052_ExtendedHovorka_Exercise.html`.
- Young AJ, et al. (2023). Resistance-exercise glucose flux study; quantitative
  targets summarized in `docs/BG-SCIENCE.md`.

## Status summary

- **KRITISK:** 0
- **ADVARSEL:** 0 open for this calibration
- **NOTE:** Linear weight scaling is an explicit approximation for missing
  lean-mass state
- **OK:** Shared learning response, context reversal and regression verified
