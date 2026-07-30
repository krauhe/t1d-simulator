# Activity simulation and validation plan

**Date:** 2026-07-23
**Scope:** Cardio, resistance exercise and mixed/intermittent activity at low,
medium and high intensity
**Status:** ⚠️ PARTIALLY EXECUTED (2026-07-23) — the current equations and
resistance calibration are documented in
`2026-07-23_exercise-model-continuity-fix.md`. Cardio, mixed-activity and
context-holdout results are documented in
`2026-07-23_cardio-mixed-context-validation.md`. Explicit interval scheduling,
the 65% V̇O₂peak condition, a Romeres-compatible flux decomposition and the
construction of a variable virtual population remain open. The planned
972 character-labelled context scenarios collapse to 486 unique physiological
scenarios because each male/female character pair shares the same body profile;
all 486 unique scenarios have been executed.

## 1. Objective

The objective is to determine whether the simulator reproduces the direction,
magnitude, timing and physiological mechanisms of glycaemic responses to three
activity types across intensity levels in type 1 diabetes (T1D).

The protocol separates three questions:

1. **Verification:** Does the implementation execute its equations consistently,
   conserve physiological quantities and remain numerically stable?
2. **Calibration:** Can a limited, declared set of studies identify plausible
   activity parameters?
3. **External validation:** Does the frozen model reproduce independent clinical
   observations that were not used to tune those parameters?

Passing this protocol would support use as an educational physiology model. It
would not constitute clinical validation, validation of individual predictions,
or validation for insulin-dosing decisions.

## 2. Current activity representation

The activity catalogue currently separates contraction-mediated glucose uptake,
three timed post-exercise insulin-sensitivity components, muscle-glycogen use
and an activity-specific hepatic drive.

| Activity | Contraction uptake | Fast / early / late sensitivity | Sensitivity delay | Glycogen use | Hepatic-drive rate, low / medium / high (min⁻¹) | Heart-rate targets, low / medium / high (bpm) |
|---|---:|---|---:|---:|---|---|
| Cardio | 1.00 | 1.00 / 1.00 / 1.00 | 0 min | 1.00 | 0 / 0 / 0.005 | 100 / 130 / 160 |
| Resistance | 0.55 | 0 / 0.45 / 0.45 | 120 min | 0.90 | 0.010 / 0.020 / 0.03125 | 85 / 110 / 135 |
| Mixed | 0.45 | 0.85 / 0.85 / 0.85 | 10 min | 0.85 | 0.003 / 0.006 / 0.012 | 105 / 135 / 165 |

These labels are educational categories, not direct measurements of percentage
of maximal oxygen uptake (V̇O₂peak), heart-rate reserve (HRR), one-repetition
maximum (1RM), lactate threshold or external work. The validation runner must
therefore record both the game label and the literature protocol it is intended
to approximate.

## 3. Evidence partition

### 3.1 Calibration set

Only the following evidence may be used for parameter tuning:

- **Aerobic mechanism:** Boiroux and Lichtenstein (2021), using tracer-clamp
  data from 60 min at 65% V̇O₂max, for separation of insulin-independent and
  insulin-dependent glucose disposal.
- **Resistance mechanism:** Young et al. (2023), for simultaneous changes in
  endogenous glucose production (EGP) and rate of glucose disappearance (Rd),
  and for the absence of an additional insulin-mediated disposal component
  during resistance exercise.
- **Post-exercise sensitivity:** Mikines et al. (1988) and Cartee (2015), for
  the persistence and approximate magnitude of post-exercise insulin
  sensitivity.

Any further adjustment must list the source, target, fitted parameter and
pre-fit/post-fit result in a dedicated decision document.

### 3.2 Holdout validation set

The following studies should be treated as holdout observations and must not be
used to tune the first frozen parameter set:

- **T1DEXI (Riddell et al., 2023):** 2,756 sessions from 497 adults, comparing
  30-min aerobic, interval and resistance sessions in free-living conditions.
- **Shetty et al. (2021):** 40 min continuous aerobic exercise at 35%, 50%, 65%
  and 80% V̇O₂peak under hyperinsulinaemic-euglycaemic clamp conditions.
- **Turner et al. (2016):** work-matched resistance exercise at 30% and 60% 1RM.
- **Rempel et al. (2018):** moderate walking with intervals at 70%, 80% and 90%
  HRR, including 12-h post-exercise CGM outcomes.

Yardley et al. (2013), Toghi-Eshghi and Yardley (2019) and Riddell et al.
(2019) have already informed interpretation of the resistance implementation.
They remain useful reproduction benchmarks but are not independent holdouts.

## 4. Operational intensity mapping

### 4.1 Cardio

| Game level | Literature protocol for validation |
|---|---|
| Low | Continuous activity near 35% V̇O₂peak |
| Medium | Continuous activity at 50-65% V̇O₂peak |
| High | Continuous activity near 80% V̇O₂peak, without sprint intervals |

High continuous cardio must not be treated as equivalent to HIIT. The Shetty
data predict a plateau or partial reversal above moderate intensity under high
insulin, not an indefinitely increasing glucose-disposal response.

### 4.2 Resistance exercise

| Game level | Literature protocol for validation |
|---|---|
| Low | Approximately 30% 1RM, high repetitions |
| Medium | Approximately 60% 1RM, moderate repetitions |
| High | Approximately 80% 1RM, low repetitions / high load |

Work must be reported separately from intensity. Turner et al. matched total
mass lifted between 30% and 60% 1RM and observed similar glycaemic responses.
Young et al. found no detectable difference between moderate- and
high-intensity groups under their clamp protocol. A strictly monotonic BG
response is therefore not a universal physiological requirement.

### 4.3 Mixed/intermittent activity

| Game level | Literature protocol for validation |
|---|---|
| Low | Continuous aerobic base without vigorous intervals |
| Medium | Aerobic base at 45-55% HRR plus intervals near 70% HRR |
| High | Same aerobic base plus intervals near 80-90% HRR |

The current mixed model is a weighted continuous combination of aerobic uptake
and stress. It does not represent interval timing explicitly. Until an interval
schedule is implemented, mixed-activity validation must be interpreted as an
envelope test of net glucose response, not as reproduction of second-to-second
football, handball or interval-training dynamics.

## 5. Simulation design

### 5.1 Stage A: numerical and implementation verification

For every activity type and intensity:

1. Start from an exact 5.5 mmol/L basal steady state.
2. Run an inactive control with the same profile and clock time.
3. Verify activity onset, target heart rate, auto-stop and post-exercise state.
4. Confirm that exercise uptake, EGP, acute stress, insulin absorption,
   muscle-glycogen use and post-exercise sensitivity are finite and
   non-negative.
5. Compare 1.0-, 0.5- and 0.25-min integration steps. End-of-activity BG should
   differ by less than 0.10 mmol/L and each flux AUC by less than 2%.
6. Verify that the game and standalone-engine activity catalogues are identical.
7. Verify that zero-duration, missing-type, invalid-intensity and repeated-start
   calls fail safely.

### 5.2 Stage B: deterministic 3 × 3 core experiment

Run all nine combinations of:

- activity: cardio, resistance, mixed;
- intensity: low, medium, high.

Use a no-exercise control, 60-min activity, exact basal steady state, no meal,
no bolus, no dawn effect, no stochastic variation and 48 h follow-up.

Record:

- BG at 0, 15, 30, 45 and 60 min;
- peak, nadir, time-to-peak/nadir and ΔBG at 60 min;
- BG AUC relative to the matched control at 0-60 min, 0-120 min and 0-8 h;
- peak and AUC for EGP, exercise uptake and acute stress;
- effective ISF at 0, 60 min, 2 h, 8 h, 24 h and 48 h;
- plasma insulin, insulin-depot absorption and total IOB;
- liver- and muscle-glycogen change;
- minutes below 3.9 mmol/L and above 10 mmol/L.

This stage is a mechanistic fingerprint. Its values are not population
predictions because the exact steady-state scenario deliberately removes the
clinical contexts responsible for much observed variability.

### 5.3 Stage C: literature-reproduction experiments

#### Cardio intensity clamp

Implement a virtual euglycaemic clamp that adds glucose each minute to maintain
5.0-6.0 mmol/L while plasma insulin is fixed at the source protocol level.
Record glucose infusion rate (GIR) in mg·kg⁻¹·min⁻¹.

Shetty et al. reported exercise-related GIR increments of:

| V̇O₂peak | GIR increment, mean ± SEM (mg·kg⁻¹·min⁻¹) |
|---:|---:|
| 35% | 1.8 ± 0.4 |
| 50% | 3.0 ± 0.4 |
| 65% | 4.2 ± 0.7 |
| 80% | 3.5 ± 0.7 |

Primary pass criterion: every modeled mean falls within the study mean ± 2 SEM
after conversion to the same insulin and duration conditions. Secondary
criterion: the model reproduces the rise from 35% to 65% and the absence of a
further increase at 80%.

At 65% V̇O₂max, the model should also reproduce Boiroux and Lichtenstein's
mechanistic ranges: insulin-independent disposal +66% to +82% and
insulin-dependent disposal +81% to +155% in T1D. These are calibration checks,
not holdout results.

#### Resistance flux and intensity experiments

Reproduce three separate contexts:

1. **Tracer-clamp:** moderate and high resistance with fixed glucose and
   multiple insulin levels, matched to Young et al. The primary targets are EGP
   AUC +1.04 mmol/L (95% CI 0.65-1.43), Rd AUC +1.26 mmol/L (95% CI 0.41-2.10),
   unchanged mean BG and no detectable intensity-group difference.
2. **Work-matched fasted morning:** 30% 1RM and 60% 1RM matched for total mass,
   corresponding to Turner et al. The model should not impose a large
   low-to-medium difference when total work is held constant.
3. **Context reversal:** reproduce the direction of Toghi-Eshghi and Yardley:
   approximately +0.9 mmol/L during fasted morning exercise and approximately
   -0.8 mmol/L during afternoon fed exercise.

The current isolated steady-state targets (low -0.5 to +0.5, medium +0.1 to
+1.0 and high +0.3 to +1.5 mmol/L) remain internal calibration checks. They
must not substitute for the context-specific external tests above.

#### Mixed/intermittent experiment

Reproduce the Rempel protocol: 45 min at 45-55% HRR with six 60-s intervals
every four minutes at 70%, 80% or 90% HRR. Compare with continuous
moderate-intensity exercise.

Primary targets:

- no forced monotonic difference in mean BG across interval intensities;
- no claim that vigorous intervals protect against delayed hypoglycaemia;
- a higher frequency of post-exercise hypoglycaemic events in the 90% condition
  should be possible in population/stochastic runs.

Exact reproduction requires interval scheduling. Before that feature exists,
the current mixed category should only be tested against the direction and
distribution of net responses.

### 5.4 Stage D: context and profile stress matrix

**✅ EXECUTED (2026-07-23):** All 486 non-redundant physiological scenarios
passed finite-state checks. Running all six named characters would produce
972 labels but duplicate each of the three body-profile trajectories exactly.
Active insulin increased total cardio lowering in 54/54 matched comparisons,
and mixed activity remained between cardio and resistance in 162/162
comparisons. See `2026-07-23_cardio-mixed-context-validation.md`.

Run:

- 3 activity types;
- 3 intensities;
- 3 durations: 30, 60 and 90 min;
- 3 metabolic contexts:
  - fasted basal insulin,
  - euglycaemia with elevated circulating insulin,
  - 90 min after a standardized mixed meal and bolus;
- 2 start times: 08:00 and 16:00;
- all 6 fictional character profiles.

This produces 972 deterministic activity scenarios plus matched controls.

The matrix tests whether:

- active insulin increases the glucose-lowering effect of cardio;
- morning/afternoon physiology can reverse resistance-exercise direction;
- duration increases total flux without producing discontinuities;
- body size and insulin sensitivity change magnitude without changing units or
  causing numerical instability;
- mixed activity generally lies between matched continuous cardio and
  resistance responses, while allowing context-dependent overlap.

### 5.5 Stage E: stochastic population experiment

For selected boundary scenarios, run at least 100 seeds per fictional profile
with insulin absorption, insulin bioavailability, dawn and CGM variation
enabled. The deterministic physiology must be evaluated using true BG; CGM
outputs are evaluated separately.

Report medians, 5th-95th percentiles and the fraction of runs with:

- BG decline, stability or rise;
- BG <3.9 mmol/L;
- BG >10 mmol/L;
- delayed nadir at 2-12 h and 12-24 h.

Do not tune stochastic spread to T1DEXI before the first holdout comparison.
T1DEXI's very large within-type standard deviations and low within-person
reproducibility (intraclass correlation 0.12) provide an external test of
whether the model's variation is too narrow.

## 6. Cross-type population validation

T1DEXI reported the following mean ± SD change during approximately 30-min
sessions:

| Activity | Δ glucose (mg/dL) | Δ glucose (mmol/L) |
|---|---:|---:|
| Aerobic | -18 ± 39 | -1.00 ± 2.17 |
| Interval | -14 ± 32 | -0.78 ± 1.78 |
| Resistance | -9 ± 36 | -0.50 ± 2.00 |

The primary external criterion is the population ordering:

`aerobic decline > interval decline > resistance decline`

The model should reproduce the adjusted pairwise direction, but not necessarily
the raw mean from a single deterministic profile. Validation uses the simulated
population distribution after matching duration and approximate peak heart
rate. Report bias, root-mean-square error, 95% interval coverage and the
fraction of observed study means contained in the simulated 95% interval.

Yardley et al. provide a controlled secondary comparison: 45 min resistance
exercise changed plasma glucose by -1.6 mmol/L, compared with -3.4 mmol/L during
60% V̇O₂max aerobic exercise. This validates relative ordering but has already
contributed to model interpretation and is not a strict holdout.

## 7. Acceptance rules

Freeze these rules before generating the final validation output:

1. **Numerical verification:** all Stage A checks pass.
2. **Mechanistic validity:** flux directions and activity-specific mechanisms
   match the declared model structure.
3. **Quantitative reproduction:** source-specific outcomes fall within reported
   95% confidence intervals, or mean ± 2 SEM when no CI is available.
4. **Population validity:** holdout study means fall within simulated 95%
   intervals and the cross-type ordering is correct.
5. **Context validity:** the model reproduces documented reversals rather than
   enforcing one universal BG direction.
6. **No hidden retuning:** any change made after inspecting holdout results
   converts that dataset from validation to calibration; a new holdout must then
   be selected.

Classify every result:

- **PASS:** quantitative interval and direction both match;
- **PARTIAL:** direction matches but magnitude does not;
- **FAIL:** direction, timing or mechanism conflicts with evidence;
- **NOT TESTABLE:** the simulator lacks a required state or protocol.

Do not average failures into a single overall score. A good aggregate RMSE
cannot compensate for a wrong mechanism or a reversed clinical response.

## 8. Required implementation artifacts

1. `tests/activity-validation.js` -- headless protocol runner.
2. `tests/fixtures/activity-literature-targets.json` -- frozen targets,
   populations, units, protocol details and source URLs.
3. A machine-readable result file containing model version, commit, profile,
   seed, modules, initial state and all outcome metrics.
4. A new 3 × 3 activity-intensity section in `tests/model-validation.html`.
5. A final report in `docs/reviews/` with PASS/PARTIAL/FAIL/NOT TESTABLE for
   every target.
6. A decision document for every subsequent parameter change.

## 9. Figures for clinical review

Prepare four figures:

1. **3 × 3 acute-response heatmap:** ΔBG at 60 min for activity and intensity.
2. **Context panels:** fasted/basal, high-insulin and fed/bolus curves.
3. **Mechanism panel:** EGP, exercise uptake and insulin-mediated disposal AUC.
4. **Recovery panel:** BG and effective ISF at 2, 8, 24 and 48 h.

Every figure must state:

- fictional profile or simulated population;
- starting BG, insulin condition, meal condition, clock time and duration;
- true BG versus CGM;
- whether the target was calibration or holdout validation;
- model version and commit.

## 10. Known limitations to disclose

1. Absolute heart-rate targets are not age-normalized and cannot yet be equated
   directly with HRR across child, adult and older fictional profiles.
2. The model does not contain V̇O₂peak, ventilatory threshold, external work,
   1RM, repetitions, plasma catecholamines or plasma lactate as explicit states.
3. Mixed activity is currently continuous weighted physiology rather than an
   explicit sequence of work and recovery intervals.
4. The six fictional profiles are educational stereotypes, not a statistically
   representative virtual T1D population.
5. Free-living study responses include insulin and carbohydrate decisions that
   cannot be reconstructed completely from group means.
6. Clinical studies show large inter- and intra-individual variation; one
   deterministic “correct curve” does not exist.

## 11. Recommended execution order

1. Freeze this protocol and literature-target file.
2. Implement Stage A and the deterministic 3 × 3 experiment.
3. Implement the euglycaemic-clamp test harness.
4. Run calibration-only datasets and freeze model parameters.
5. Run Shetty, Turner, Rempel and T1DEXI holdouts once.
6. Document failures before changing parameters.
7. Add interval scheduling or age-normalized intensity only if the failed test
   requires that missing mechanism.
8. Repeat with a newly declared holdout after any retuning.
9. Ask clinicians with T1D exercise expertise to review protocol mapping,
   clinical interpretation and failure thresholds.

## 12. Primary sources

1. Riddell MC, Li Z, Gal RL, et al. *Examining the Acute Glycemic Effects of
   Different Types of Structured Exercise Sessions in Type 1 Diabetes in a
   Real-World Setting: The Type 1 Diabetes and Exercise Initiative (T1DEXI).*
   Diabetes Care. 2023;46:704-713.
   [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10090894/)
2. Shetty VB, Fournier PA, Paramalingam N, et al. *Effect of Exercise Intensity
   on Exogenous Glucose Requirements to Maintain Stable Glycemia at High
   Insulin Levels in Type 1 Diabetes.* J Clin Endocrinol Metab.
   2021;106:e83-e93.
   [PubMed](https://pubmed.ncbi.nlm.nih.gov/33097945/)
3. Young AJ, et al. *Quantifying insulin-mediated and noninsulin-mediated
   changes in glucose dynamics during resistance exercise in adults with type 1
   diabetes.* Am J Physiol Endocrinol Metab. 2023.
   [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511169/)
4. Yardley JE, Kenny GP, Perkins BA, et al. *Resistance versus aerobic exercise:
   acute effects on glycemia in type 1 diabetes.* Diabetes Care.
   2013;36:537-542.
   [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3579339/)
5. Turner D, et al. *Similar magnitude of post-exercise hyperglycemia despite
   manipulating resistance exercise intensity in type 1 diabetes individuals.*
   Scand J Med Sci Sports. 2016;26:404-412.
   [PubMed](https://pubmed.ncbi.nlm.nih.gov/25919405/)
6. Rempel M, et al. *Vigorous Intervals and Hypoglycemia in Type 1 Diabetes: A
   Randomized Cross Over Trial.* Sci Rep. 2018;8:15879.
   [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6203731/)
7. Boiroux D, Lichtenstein L, et al. *Exercise effect on insulin-dependent and
   insulin-independent glucose utilization in healthy individuals and
   individuals with type 1 diabetes: a modeling study.* Am J Physiol Endocrinol
   Metab. 2021.
   [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)
8. Toghi-Eshghi SR, Yardley JE. *Morning (Fasting) vs Afternoon Resistance
   Exercise in Individuals With Type 1 Diabetes.* J Clin Endocrinol Metab.
   2019;104:5217-5224.
   [PubMed](https://pubmed.ncbi.nlm.nih.gov/31211392/)
