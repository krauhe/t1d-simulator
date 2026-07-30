# Insulin-clamp audit

**Date:** 2026-07-23  
**Scope:** Sustained insulin action at rest, the Shetty et al. (2021) clamp comparison, and the relation between the profile ISF and Hovorka insulin-action parameters.  
**Method:** `phys-reviewer` trace from primary literature target to equation, parameter, executable diagnostic and regression coverage.

## Executive conclusion

The current discrepancy is real, but it does **not** show that ordinary basal insulin is generally too potent.

The pharmacokinetic side of the virtual clamp is internally and externally plausible. For the Shetty cohort's mean height and weight, the study infusion of 30 mU·m⁻²·min⁻¹ corresponds to approximately 58.0 mU/min. With the model's insulin distribution volume and elimination rate, this gives approximately 46.1 mU/L (277 pmol/L), close to the study's measured pre-exercise free-insulin values of 269-343 pmol/L.

At those measured concentrations, however, the reference profile (76 kg, ISF 3.0 mmol/L/U) predicts a resting glucose infusion rate (GIR) of 10.5-13.8 mg·kg⁻¹·min⁻¹. Shetty et al. measured 4.4 ± 0.4 mg·kg⁻¹·min⁻¹. The model therefore predicts approximately 2.4-3.1 times the observed sustained glucose requirement.

The mismatch is located primarily in **sustained peripheral insulin-mediated glucose disposal**, not insulin concentration, exercise, PEIS, or hepatic glucose production. It predates the recent exercise calibration and is slightly reduced, not caused, by the muscle Hill curve.

## Evidence chain

### Primary study

Shetty et al. used a primed continuous Humalog infusion of 30 mU·m⁻²·min⁻¹. Exercise began after at least 2 hours of clamp exposure and after glucose had been stable at 5-6 mmol/L for at least 30 minutes. The actually measured free-insulin concentrations before the four exercise trials were 343, 299, 278 and 269 pmol/L. The pooled resting GIR was 4.4 ± 0.4 mg·kg⁻¹·min⁻¹.

Source: [Shetty et al. (2021), Journal of Clinical Endocrinology & Metabolism](https://academic.oup.com/jcem/article/106/1/e83/5937229).

### Model pathway

1. `js/physiology-engine.js:238-243` defines `HOVORKA_REFERENCE_ISF = 3.75`.
2. `js/physiology-engine.js:464-473` maps profile ISF to all three Hovorka insulin-sensitivity parameters using `ISF / 3.75`.
3. `js/hovorka.js:88-91` scales `S_IT`, `S_ID` and `S_IE` together.
4. `js/hovorka.js:143-149` constructs the muscle Hill response, calibrated to the previous linear response at 35 mU/L.
5. `js/hovorka.js:441-450` calculates steady-state `x1`, `x2` and `x3`.
6. `js/hovorka.js:574` suppresses EGP to zero when `x3 >= 1` at rest.
7. `js/hovorka.js:630-643` applies `x1` transport and `x2` peripheral disposal to the glucose compartments.
8. `tests/insulin-clamp-validation.js:38-55` solves the corresponding analytical steady-state glucose flux.

At steady state:

```text
Q2 = x1 * Q1 / (k12 + x2)
GIR = F01c + x2 * Q2 - EGP
```

This is algebraically consistent with the two glucose-compartment ODEs. The dynamic clamp in `tests/activity-validation.js:372-428` independently reproduces the same 14.50 mg·kg⁻¹·min⁻¹ at 60 mU/L, so the discrepancy is not an error in the analytical helper.

## Quantitative results

| Shetty trial | Measured insulin | Model GIR, ISF 3.0 | Model / observed mean | ISF scale that would match 4.4* |
|---|---:|---:|---:|---:|
| 35% trial | 343 pmol/L (57.17 mU/L) | 13.79 | 3.13x | 1.26 |
| 50% trial | 299 pmol/L (49.83 mU/L) | 11.85 | 2.69x | 1.42 |
| 65% trial | 278 pmol/L (46.33 mU/L) | 10.88 | 2.47x | 1.51 |
| 80% trial | 269 pmol/L (44.83 mU/L) | 10.46 | 2.38x | 1.56 |
| Mean insulin | 297 pmol/L (49.54 mU/L) | 11.77 | 2.67x | 1.42 |

\*Diagnostic inversion of the current equations only; **not** a proposed profile or calibration.

At 50 mU/L and profile ISF 3.0, the model flux decomposes to:

| Flux | Model value |
|---|---:|
| Insulin-independent disposal (`F01c`) | 1.74 mg·kg⁻¹·min⁻¹ |
| Peripheral insulin-mediated disposal (`x2 * Q2`) | 10.16 mg·kg⁻¹·min⁻¹ |
| EGP | 0.00 mg·kg⁻¹·min⁻¹ |
| Required GIR | 11.90 mg·kg⁻¹·min⁻¹ |

The study protocol deliberately used insulin levels expected to suppress EGP completely. The model agrees on that point. The excess therefore sits in the peripheral term.

The pre-Hill linear muscle response would produce 12.52 mg·kg⁻¹·min⁻¹ at 50 mU/L, compared with 11.90 in the current model. The Hill implementation reduces this clamp discrepancy by about 5%; it did not create it.

## Findings

### 1. Sustained peripheral insulin action is not jointly calibrated with the profile ISF

**Severity:** High  
**Status:** ❌ ÅBEN

The `ISF / 3.75` mapping was empirically introduced to approximate the transient glucose effect of a subcutaneous bolus. It was not derived from clamp data. The same multiplier now controls the sustained `x1`/`x2` response, although a clinical ISF and a clamp-derived M-value are related but not interchangeable parameters.

The present automated bolus assertion is also too broad to constrain this coupling: `tests/simulation.test.js:205-224` accepts a 1 U isolated effect anywhere from 1 to 8 mmol/L. A deterministic reproduction gave approximately 2.43 mmol/L for the nominal ISF 3.0 profile. Reducing the global sensitivity to the clamp-implied ISF near 1.4 would reduce that bolus effect to approximately 1.3 mmol/L and would therefore break the intended ISF semantics.

**Interpretation:** The model needs a joint transient-bolus and sustained-clamp calibration. Simply reducing profile ISF or all three Hovorka sensitivity parameters is not an acceptable fix.

### 2. The clamp diagnostic uses the intended insulin target range, not the achieved concentrations

**Severity:** Medium  
**Status:** ❌ ÅBEN

`tests/insulin-clamp-validation.js:85-90` evaluates 50, 60 and 92 mU/L by converting the protocol's intended 300-550 pmol/L range. The study's measured pre-exercise concentrations were instead 269-343 pmol/L (44.8-57.2 mU/L). Including 92 mU/L exaggerates the upper discrepancy and does not represent the reported baseline measurements.

Correcting the test range will not remove the finding: the model remains 2.4-3.1 times above the study mean across the achieved range.

### 3. One small exercise study is insufficient as the sole absolute clamp calibration target

**Severity:** Medium  
**Status:** ⚠️ DELVIST

Shetty et al. studied nine lean, recreationally active young adults and did not report their clinical ISF values. The paper is a strong holdout for exercise-induced **increments**, but its resting GIR should not by itself define the entire simulator's insulin dose-response curve.

The absolute calibration needs additional primary T1D clamp datasets at comparable plasma-insulin concentrations. Normalisation must be kept consistent (kg body weight versus kg fat-free mass), and actual measured insulin concentrations must be used rather than nominal infusion rates alone.

### 4. The recent exercise and PEIS calibration is not the cause

**Severity:** Informational  
**Status:** ✅ VERIFICERET

The resting analytical diagnostic has no activity and a neutral PEIS factor. The excessive resting GIR exists in the original linear Hovorka response and is modestly reduced by the current muscle Hill saturation. Exercise increments may therefore remain useful after subtraction of the matched resting control, while absolute resting-clamp validation remains open.

## Recommended next implementation

Do not change model parameters yet. First create a joint calibration package:

1. Replace the clamp diagnostic's 50/60/92 mU/L points with the study's four measured insulin means and their pooled mean.
2. Add a flux-decomposition assertion (`F01c`, `x2*Q2`, EGP) so a future change cannot hide the mechanism.
3. Tighten deterministic bolus tests for at least ISF 1.5, 3.0 and 5.0, with 1 U and 3 U doses and explicit 5-hour endpoints.
4. Add at least two independent primary T1D clamp datasets spanning lower and higher insulin plateaus.
5. Jointly fit or redesign the mapping from profile ISF to hepatic and peripheral action. Candidate parameters are separate channel gains plus the muscle `EC50`, Hill coefficient and maximum response; do not assume one multiplier must scale all three tissues.
6. Reserve one dataset as a true holdout, then run the full physiology regression and campaign-level checks.

Because this will alter several coupled model parameters, tests and documentation, an implementation requires a dedicated fix-decision document under the repository rules.

## Status summary

- ❌ **Open:** sustained peripheral insulin action versus absolute T1D clamp GIR.
- ❌ **Open:** achieved rather than intended insulin concentrations in the diagnostic.
- ⚠️ **Partial:** external evidence base is too narrow for parameter fitting.
- ✅ **Verified:** insulin PK/unit conversion is plausible; clamp algebra and dynamic runner agree; recent exercise/PEIS changes did not cause the resting discrepancy.

