# Exercise model continuity and source-fidelity decision

> **Status update (2026-07-23):** The high-responder extension documented in
> this historical decision record has been superseded and removed. The current
> shared weight-based calibration is documented in
> `2026-07-23_strength-education-weight-scaling-fix.md`.
>
> **Post-exercise update (2026-07-23):** The continuous response equation is
> retained, but the strength contract is now three independent component
> scales (`0 / 0.45 / 0.45`) with a 120-minute delay from exercise onset.
> Muscle-glycogen resynthesis no longer subtracts plasma Q1 a second time.
> See `2026-07-23_strength-postexercise-peis-fix.md`.

**Date:** 2026-07-23
**Scope:** Acute contraction uptake, exercise-driven hepatic glucose production, delayed insulin sensitivity, event continuity and resistance-exercise calibration
**Status:** Implemented locally; not committed or pushed

## Background

The resistance-exercise validation initially showed a modest glucose rise during
the bout, followed by an immediate increase in insulin sensitivity when
`stopActivity()` was called. The user correctly challenged that structure: a
physiological effect should not be created by pressing stop, and a person who
continues exercising for three hours should not have to stop before delayed
sensitivity can begin.

A source-level review then identified two additional problems:

1. Hovorka E1 was multiplied by heart-rate excess twice. E1 was already driven
   by heart rate, but the direct uptake flux multiplied `beta * E1` by heart
   rate again.
2. Insulin-mediated exercise sensitivity was represented twice: once by the
   Hovorka `1 + alpha * E2^2` gain and once by the engine's muscle-EC50 shift.

The previous implementation also used one activity scaling parameter for
contraction uptake, insulin sensitivity and muscle-glycogen use. That prevented
mechanism-specific calibration and ablation.

## Diagnosis

### Evidence traceability

| Model output or mechanism | Source endpoint | Evidence class | Implementation or test |
|---|---|---|---|
| Acute contraction uptake | Resalat et al. (2020): `dE1/dt = (deltaHR - E1)/5` and direct uptake `beta * E1 / HRbase` | L; adapted by normalising E1 to heart-rate excess | `js/hovorka.js`; exact Euler-equation and no-second-HR-factor tests |
| Resistance EGP response | Young et al. (2023): EGP AUC +1.04 mmol/L, 95% CI 0.65-1.43 over 45 min | L | Medium strength calibration and literature-range test |
| Resistance non-insulin-mediated uptake | Young et al. (2023): NIMGU AUC +1.26 mmol/L, 95% CI 0.41-2.10 | L | `contractionUptakeScaling = 0.55`; literature-range test |
| No extra insulin-mediated uptake during a 45-min resistance bout | Young et al. (2023): IMGU unchanged during exercise | L | 60-min resistance delay; test at minute 45 |
| Average acute resistance response | Young et al. (2023): mean BG unchanged; Toghi-Eshghi and Yardley (2019): approximately +0.9 mmol/L fasted morning and -0.8 mmol/L afternoon | L/M | Standard profile stays near stable; context remains a holdout |
| High-responder acute rise | Riddell et al. (2019): HIIT +3.7 +/- 1.6 mmol/L; user reports +4-5 mmol/L/h during heavy sets with 3-min rests | L plus observed user phenotype | Optional `exerciseHepaticResponseScale`; 60-min test target 4.0-5.5 mmol/L |
| Delayed sensitivity during and after long exercise | Mikines et al. (1988), Cartee (2015), Wojtaszewski et al. (2000) | L/M | Delayed rectangular-response model; 45-min, 3-h, 24-h and 48-h tests |
| Stop continuity | Mathematical invariant, not a clinical endpoint | R | Manual/auto-stop equivalence at 1, 5, 30, 45, 60, 180 and 240 min |
| Separate activity mechanisms | Identifiability and software invariant | R | Four-way ablation test |

Evidence classes follow the physiology-review skill: L = literature endpoint,
M = mechanistic constraint, R = regression or implementation invariant.

### Source-equation fidelity

The Resalat E1 pathway is an **adapted source equation**, not a direct copy.
Resalat represents E1 in beats per minute:

```text
dE1_source/dt = (deltaHR - E1_source) / 5 min
direct uptake = beta * E1_source / HRbase
```

The simulator uses a dimensionless state:

```text
u_contraction = max(0, (HR - HRbase) / HRbase) * contractionUptakeScaling
dE1/dt = (u_contraction - E1) / 5 min
direct uptake = beta * E1
```

These forms are algebraically equivalent when
`E1 = E1_source / HRbase`, apart from the explicit activity-type scaling.
The former extra multiplication by heart rate was not part of the source
equation and has been removed.

The delayed sensitivity and exercise-driven hepatic-response equations are
**heuristic extensions calibrated to literature endpoints**. They must not be
described as equations from Resalat, Young, Mikines or Cartee.

## Solution

### 1. Four independent activity parameters

Each activity now has separate parameters for:

| Parameter | Sole responsibility |
|---|---|
| `contractionUptakeScaling` | Insulin-independent `beta * E1` glucose uptake |
| `insulinSensitivityScaling` | Muscle insulin-response EC50 shift |
| `insulinSensitivityDelayMin` | Delay before the sensitivity response begins |
| `glycogenUseScaling` | Muscle-glycogen consumption |
| `hepaticDriveRate` and `hepaticDriveCeiling` | Exercise-driven hepatic glucose production |

No parameter in this table controls another listed mechanism.

### 2. Continuous delayed sensitivity

The sensitivity session is created when activity starts. For component `j`,
age `a`, delay `d`, completed duration `T`, build constant `tau_j` and decay
half-life `h_j`, the response is:

```text
r_j(a) = 0                                             for a <= d
r_j(a) = 1 - exp(-(a-d)/tau_j)                         while delayed work is active
r_j(a) = (1-exp(-T/tau_j)) * 2^(-(a-d-T)/h_j)          after delayed work ends
```

The component amplitude is:

```text
B_j = A_j(intensity)
      * insulinSensitivityScaling
      * min(sqrt(T/60), 1.5)
      * r_j(a)
```

The early component is additionally multiplied by the current muscle-glycogen
empty fraction. The fast, early and late half-lives are 15 min, 4 h and 18 h.
Strength has a 60-min delay. Consequently:

- no additional insulin-mediated sensitivity is present at minute 45;
- a three-hour strength session develops delayed sensitivity while still active;
- stopping freezes duration but does not create an amplitude;
- the response is continuous at manual and automatic stop.

### 3. Separate exercise-driven hepatic response

Exercise catecholamines are no longer stored in `acuteStressLevel`, which is
reserved for hypo- and illness-related stress. The activity state follows:

```text
dH_ex/dt = hepaticDriveRate - ln(2)/30 * H_ex
0 <= H_ex <= hepaticDriveCeiling
```

After activity, only the 30-min half-life washout remains. Its hepatic
contribution is:

```text
H_effective =
    exerciseHepaticResponseScale
    * H_ex
    * (0.6 * liverGlycogenReserve + 0.4)
```

The same effective drive is used in the blood-side EGP term and the matching
60% liver-glycogen capacity drain. Hypoglycaemic counter-regulation retains its
independent 0.4 cap.

`exerciseHepaticResponseScale` defaults to 1.0 and accepts 0.25-3.0 in the
engine profile. It changes only the exercise-related hepatic response. The six
fixed game characters currently all use 1.0; the high-responder setting is
available to tests and future fixed scenarios, not as a personal input.

### 4. Resistance calibration

| Parameter | Low | Medium | High |
|---|---:|---:|---:|
| Target HR, bpm | 85 | 110 | 135 |
| Contraction uptake scaling | 0.55 | 0.55 | 0.55 |
| Hepatic-drive rate, min^-1 | 0.008 | 0.016 | 0.025 |
| Hepatic-drive ceiling | 0.25 | 0.60 | 1.00 |
| Sensitivity scaling | 0.90 | 0.90 | 0.90 |
| Sensitivity delay | 60 min | 60 min | 60 min |
| Glycogen-use scaling | 0.90 | 0.90 | 0.90 |

The medium values were selected against Young's 45-min flux endpoints, not
against the final BG curve alone.

## Verification

### Quantitative results

All runs use a 70-kg, ISF 3, ICR 10 profile at exact basal steady state, with
dawn, stochastic insulin variability and sensor noise disabled.

| Scenario | Delta BG at 60 min | EGP AUC at 45 min | Direct uptake AUC at 45 min |
|---|---:|---:|---:|
| Strength low, scale 1.0 | +0.07 mmol/L | +0.52 mmol/L | +0.62 mmol/L |
| Strength medium, scale 1.0 | +0.16 mmol/L | +1.04 mmol/L | +1.23 mmol/L |
| Strength high, scale 1.0 | +0.36 mmol/L | +1.64 mmol/L | +1.85 mmol/L |
| Strength high, hepatic scale 3.0 | +5.02 mmol/L | +5.46 mmol/L | +1.85 mmol/L |

Young's medium-resistance targets are +1.04 mmol/L for EGP AUC and +1.26
mmol/L for NIMGU AUC. The standard model therefore reproduces the measured
near-cancellation of those two fluxes. The high-responder phenotype changes
only hepatic production, not contraction uptake or delayed sensitivity.

### Automated verification

`tests/simulation.test.js` now includes:

- exact E1 source-equation and no-second-heart-rate-factor tests;
- E1 recovery after cessation;
- Young 2023 EGP/NIMGU AUC assertions;
- average and high-responder resistance endpoints;
- a three-hour active-session test;
- manual/auto-stop equivalence at seven event boundaries;
- four-way mechanism ablation;
- numerical stability at 1, 0.5 and 0.25 min steps;
- existing 24-h, 48-h and five-day sensitivity-decay tests.

Current result: **180/180 passed**.
The standalone physiology API result is **21/21 passed**.

`tests/model-validation.html` now displays standard low/medium/high resistance,
the high-responder curve, exercise-driven hepatic response and 45-min EGP versus
uptake AUC.

Browser verification passed for exercise sections E.1 and E.2. Both sections
rendered their charts and result tables, all visible assertions passed, and the
browser console contained no JavaScript errors.

## Sub-agent input

No sub-agents were used. The local `phys-reviewer`, `science-reviewer` and
`skill-creator` workflows were applied directly.

## Remaining limitations and holdouts

1. High strength is still a broad game category. It is not a protocol-specific
   model of powerlifting, hypertrophy sets, circuit training or HIIT.
2. The high-responder scale is calibrated to a plausible observed upper-tail BG
   response, not to measured catecholamine concentrations.
3. Lactate, alanine, glycerol and explicit Cori-cycle fluxes remain aggregated
   into hepatic drive.
4. The 60-min pure delay for resistance sensitivity is a tractable transport
   approximation, not an identified molecular delay constant.
5. ⚠️ PARTIAL (2026-07-23): Mixed/intermittent activity falls inside the broad
   T1DEXI distribution and preserves cross-type ordering, but the current
   continuous-average category cannot reproduce Rempel's explicit interval
   schedule. No mixed parameters were retuned.
6. ⚠️ PARTIAL (2026-07-23): Deterministic active-insulin, fed/fasted,
   morning/afternoon and prior-exercise holdouts pass. All 486 non-redundant
   body-profile/context/type/intensity/duration/time combinations remain finite.
   A variable virtual population, rather than the six names mapped to three
   identical body profiles, remains open.
7. E2 remains in the state vector for telemetry and state compatibility but has
   no glucose-flux effect.

## Files cited

- `js/hovorka.js` - E1 equation, direct uptake and removal of duplicate E2 gain.
- `js/physiology-engine.js` - continuous delayed sensitivity, hepatic response,
  activity lifecycle and profile response scale.
- `js/simulator.js` - game activity catalogue and facade exposure.
- `tests/simulation.test.js` - literature, invariant, ablation and boundary tests.
- `tests/model-validation.html` - visual exercise validation.
- `docs/references/PMC7449052_ExtendedHovorka_Exercise.html` - Resalat et al.
- `docs/references/Young_2023_ResistanceExerciseGlucoseDynamicsT1D.html`.
- `docs/references/Yardley_2013_ResistanceVsAerobicExerciseT1D.html`.
- `docs/references/Cartee_2015_RW_MechanismsPostExerciseInsulinStimulatedGlucoseUptake.html`.
- `docs/references/Riddell_2017_RW_ExerciseManagementInType1Diabetes.pdf`.

## Literature

- Resalat N, El Youssef J, Reddy R, et al. (2020). A statistical virtual patient
  population for the glucoregulatory system in type 1 diabetes with integrated
  exercise model. *PLOS ONE*, 15:e0237511.
- Young GM, et al. (2023). Quantifying insulin-mediated and noninsulin-mediated
  changes in glucose dynamics during resistance exercise in adults with type 1
  diabetes. *American Journal of Physiology-Endocrinology and Metabolism*,
  325:E192-E206. DOI: 10.1152/ajpendo.00298.2022.
- Yardley JE, et al. (2013). Resistance versus aerobic exercise: acute effects on
  glycemia in type 1 diabetes. *Diabetes Care*, 36:537-542.
- Toghi-Eshghi SR, Yardley JE. (2019). Morning versus afternoon resistance
  exercise in type 1 diabetes. *Journal of Clinical Endocrinology & Metabolism*,
  104:5217-5224.
- Riddell MC, et al. (2019). Reproducibility in the cardiometabolic responses to
  high-intensity interval exercise in adults with type 1 diabetes.
  *Diabetes Research and Clinical Practice*, 148:137-143.
- Mikines KJ, et al. (1988). Persisting enhanced insulin sensitivity after
  exercise in humans. *American Journal of Physiology*, 254:E248-E259.
- Cartee GD. (2015). Mechanisms for greater insulin-stimulated glucose uptake in
  normal and insulin-resistant skeletal muscle after acute exercise.
  *American Journal of Physiology-Endocrinology and Metabolism*, 309:E949-E959.
