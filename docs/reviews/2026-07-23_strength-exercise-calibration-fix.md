# Strength-exercise calibration decision

**Date:** 2026-07-23
**Status:** Superseded by `2026-07-23_exercise-model-continuity-fix.md`
**Scope:** Acute resistance-exercise glucose response and separation of live versus post-exercise insulin sensitivity

> Historical decision: this document describes the first calibration that was
> pushed as v0.9.103-beta. Its stop-gated sensitivity design was subsequently
> found to be discontinuous and has been replaced. Use the superseding decision
> document for the current equations, parameters and verification.

## Background

The visual validation page showed that 60 minutes of medium resistance exercise from exact basal steady state produced only a small transient peak and ended below its starting BG. The model nevertheless showed a strong catecholamine/stress response and increased endogenous glucose production (EGP). The discrepancy was traced to the exercise-sensitivity implementation: the same `e2Scaling = 0.9` parameter was applied both during resistance exercise and after it. Consequently, resistance exercise received almost the same live insulin-sensitivity amplification as cardio, although the parameter was originally intended to describe post-exercise insulin sensitivity (PEIS).

The documentation compounded the problem by transferring a fasted-HIIT result (+3.7 ± 1.6 mmol/L) to resistance exercise generally and stating that heavy resistance exercise typically raised BG by 2–5 mmol/L. This was not supported by the resistance-exercise studies.

## Diagnosis

### Literature evidence

Three complementary T1D studies define the acute resistance-exercise target:

1. **Yardley et al. (2013):** 45 minutes of resistance exercise reduced plasma glucose from 8.4 ± 2.7 to 6.8 ± 2.3 mmol/L (−1.6 mmol/L), compared with −3.4 mmol/L during matched-duration aerobic running. Resistance exercise was less glucose-lowering than aerobic exercise, but not hyperglycemic in that fed protocol.
2. **Young et al. (2023):** 25 adults with T1D performed moderate- or high-intensity resistance exercise at three insulin infusion rates during a tracer clamp. Mean BG did not change. EGP AUC increased by 1.04 mmol/L (95% CI 0.65–1.43), while glucose-disposal AUC increased by 1.26 mmol/L (95% CI 0.41–2.10). Non-insulin-mediated utilization increased, but insulin-mediated utilization remained unchanged during exercise. No difference was detected between the moderate- and high-resistance groups.
3. **Toghi-Eshghi and Yardley (2019):** the same approximately 40-minute resistance protocol raised plasma glucose by 0.9 mmol/L in the fasted morning condition and lowered it by 0.8 mmol/L in the afternoon.

Riddell et al. (2019) measured +3.7 ± 1.6 mmol/L during repeated fasted HIIT sessions. That result is retained as a HIIT reference and is no longer used as the ordinary resistance-exercise calibration target.

### Original design versus implementation

The model already had two physiologically distinct mechanisms:

- `e1Scaling`: contraction-mediated, insulin-independent muscle uptake during activity;
- `e2Scaling`: exercise-induced insulin sensitivity intended to persist after activity.

In practice, `currentISF` also used `e2Scaling` during an active session. Resistance exercise therefore received `0.9` of the cardio live-sensitivity signal at the same time that `e1Scaling = 0.3` and stress-linked EGP were active. This forced the net BG response downward and contradicted Young et al.'s finding that insulin-mediated utilization was unchanged during resistance exercise.

The former strength stress rates (`0.008 / 0.015 / 0.025 min⁻¹`) also made low and medium exercise approach or reach the common acute-stress ceiling. The resulting intensity relationship was poorly resolved: low and medium could produce stress levels close to high intensity.

## Solution

### Mathematical structure

A new activity parameter separates sensitivity during the bout from sensitivity after it:

```text
during activity:
    sensitivity amplitude = liveSensitivityScaling

after stopActivity():
    frozen PEIS amplitude = e2Scaling
```

Resistance exercise now uses:

| Parameter | Low | Medium | High |
|---|---:|---:|---:|
| `e1Scaling` | 0.3 | 0.3 | 0.3 |
| `liveSensitivityScaling` | 0.0 | 0.0 | 0.0 |
| `e2Scaling` | 0.9 | 0.9 | 0.9 |
| `stressPerMin` | 0.002 | 0.008 | 0.025 |

The zero live value does not mean that working muscle stops taking up glucose. The existing `e1Scaling = 0.3` term continues to represent the increased non-insulin-mediated utilization measured by Young et al. The zero applies only to the additional insulin-mediated sensitivity multiplier during the session. At exercise cessation, `e2Scaling = 0.9` still generates fast, early and late PEIS components.

Cardio, mixed activity and relaxation receive explicit `liveSensitivityScaling` values equal to their previous live behavior, so the structural change is isolated to resistance exercise.

### Calibration targets

No single deterministic curve can represent the complete human response distribution. The exact-steady-state tests therefore use broad targets that cover a modest basal/fasted response without claiming individual prediction:

| 60-minute strength condition | Model target ΔBG |
|---|---:|
| Low | −0.5 to +0.5 mmol/L |
| Medium | +0.1 to +1.0 mmol/L |
| High | +0.3 to +1.5 mmol/L |

These targets deliberately exclude the +3–4 mmol/L fasted-HIIT response. Active bolus insulin, meals, time of day, starting BG and individual physiology remain capable of reversing the net direction.

## Verification

### Deterministic before/after experiment

Profile: 70 kg, ISF 3.0 mmol/L/U, ICR 10 g/U, exact basal steady state at 5.50 mmol/L, no dawn effect, no meal, no bolus, no insulin variability, fixed seed, 60-minute session.

| Intensity | ΔBG before | ΔBG after | Peak stress before | Peak stress after | ISF at +8 h before | ISF at +8 h after |
|---|---:|---:|---:|---:|---:|---:|
| Low | +0.306 | −0.042 | 0.348 | 0.087 | 3.449 | 3.449 |
| Medium | −0.165 | +0.329 | 0.400 | 0.348 | 3.825 | 3.824 |
| High | −0.758 | +0.583 | 0.400 | 0.400 | 4.396 | 4.394 |

The post-exercise ISF values are unchanged to rounding, demonstrating that the calibration changes live exercise behavior without removing delayed sensitivity.

### Automated tests

- `tests/physiology-engine-api.test.js`: 21/21 passed.
- `tests/simulation.test.js`: 172/172 passed.
- New regression tests cover the three 60-minute ΔBG ranges.
- A mechanism test verifies a live PEIS factor of 1.0 during medium resistance exercise and a >20% ISF increase immediately after the session stops.

### Visual validation

`tests/model-validation.html` now contains:

- the four-scenario exercise comparison (control, cardio, strength, mixed);
- a dedicated resistance-intensity section with low, medium and high targets;
- EGP, stress, direct uptake and ISF output alongside BG.

## Sub-agent input

No sub-agents were used. The project-specific `phys-reviewer` and `science-reviewer` workflows were followed directly.

## Limitations

- “High strength” remains a broad game category that includes heavy weights and CrossFit; it is not a dedicated HIIT protocol.
- The model aggregates catecholamine and Cori-cycle contributions into stress-linked EGP and does not represent lactate as a state variable.
- The deterministic calibration is a model-validation scenario, not an individual response predictor.
- Resistance volume, set/rest structure, training status and sex are not explicit inputs.
- Follow-up testing found that effective ISF changes discontinuously when
  `stopActivity()` creates the completed-session PEIS amplitudes. The acute
  flux calibration remains valid, but the temporal transition is an open defect
  documented in `2026-07-23_codex_strength-training.md` and requires a
  continuous delayed state before long-duration sessions are considered
  physiologically timed.

## Files cited

- `js/simulator.js:53-136` - activity parameters and game catalogue.
- `js/physiology-engine.js:212-244` - standalone activity catalogue.
- `js/physiology-engine.js:2395-2515` - live and post-exercise sensitivity calculation.
- `tests/simulation.test.js:1200-1265` - acute ranges and mechanism regression.
- `tests/model-validation.html:3030-3375` - browser validation.
- `docs/MODEL-IMPLEMENTATION.md:1451-1501` and `1570-1815` - implementation description.
- `docs/BG-SCIENCE.md:1028-1132` - scientific synthesis and references.
- Yardley JE et al. *Diabetes Care.* 2013;36:537–542. DOI: 10.2337/dc12-0963.
- Young GM et al. *Am J Physiol Endocrinol Metab.* 2023;325:E192–E206. DOI: 10.1152/ajpendo.00298.2022.
- Toghi-Eshghi SR, Yardley JE. *J Clin Endocrinol Metab.* 2019;104:5217–5224. DOI: 10.1210/jc.2018-02384.
- Riddell MC et al. *Diabetes Res Clin Pract.* 2019;148:137–143. DOI: 10.1016/j.diabres.2019.01.010.
