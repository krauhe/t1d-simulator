# Cardio, mixed-activity and context validation

**Date:** 2026-07-23
**Scope:** Continuous cardio, mixed/intermittent activity and metabolic-context
holdouts after the exercise-continuity revision
**Status:** ⚠️ PARTIAL — represented endpoints pass, but explicit intervals,
the 65% V̇O₂peak condition and a study-compatible glucose-disposal
decomposition are not testable with the current model.

## Background

The preceding exercise revision corrected duplicated and discontinuous activity
effects and calibrated resistance exercise against measured glucose-production
and glucose-disposal fluxes. Cardio and mixed activity still required a separate
check against evidence that had not been used to set their parameters. The
review also needed to test whether active insulin, meal state, time of day and
recent exercise produce the expected context dependence.

This review uses deterministic matched controls. It evaluates an educational
population model, not individual prediction accuracy or treatment decisions.

## Evidence partition

The targets are frozen in
`tests/fixtures/activity-literature-targets.json` before any further activity
parameter changes.

- **Mechanistic calibration reference:** Romeres et al. and Boiroux &
  Lichtenstein for insulin-independent and insulin-dependent glucose disposal
  during 60 min at 65% V̇O₂max.
- **External cardio holdout:** Shetty et al. for glucose infusion requirements
  during 40 min at 35%, 50%, 65% and 80% V̇O₂peak under high insulin.
- **External cross-type holdout:** T1DEXI for approximately 30-min aerobic,
  interval and resistance sessions.
- **Mixed-activity protocol holdout:** Rempel et al. for six explicit 60-s
  vigorous intervals within moderate walking.
- **Context benchmark:** Toghi-Eshghi and Yardley for the direction reversal
  between fasted morning and fed afternoon resistance exercise.

## Deterministic core results

The reference adult starts at exact basal steady state. Dawn, sensor noise and
stochastic insulin variability are disabled. Values are changes relative to a
time-matched inactive control after 60 min.

| Activity | Low | Medium | High |
|---|---:|---:|---:|
| Cardio | -1.85 mmol/L | -3.01 mmol/L | -3.41 mmol/L |
| Mixed | -0.97 mmol/L | -1.62 mmol/L | -1.87 mmol/L |
| Resistance | +0.07 mmol/L | +0.16 mmol/L | +0.36 mmol/L |

All nine simulations remain finite. Cardio glucose lowering increases from low
to medium and then approaches a plateau at high intensity. Mixed activity lies
between continuous cardio and resistance in this isolated context.

## External holdouts

### T1DEXI cross-type outcomes

Thirty-minute medium-intensity simulations were run for the child, reference
adult and large-adult archetypes.

| Activity | Model mean across 3 archetypes | T1DEXI mean ± SD |
|---|---:|---:|
| Aerobic/cardio | -1.18 mmol/L | -1.00 ± 2.17 mmol/L |
| Interval/mixed | -0.50 mmol/L | -0.78 ± 1.78 mmol/L |
| Resistance | +0.04 mmol/L | -0.50 ± 2.00 mmol/L |

**Result: ⚠️ PARTIAL.** The ordering is correct and all model means fall inside
the broad observed one-SD intervals. Three fixed archetypes are not a
representative virtual population, so the comparison cannot validate the
clinical distribution or its mean precisely.

### Shetty hyperinsulinaemic-euglycaemic clamp

The virtual clamp uses a fixed model plasma-insulin input of 60 mU/L and adds
glucose to keep BG in the clamp range. Exercise evidence is evaluated as the
additional glucose infusion rate (GIR) relative to the model's matched resting
control.

| Represented game intensity | Model GIR increment | Study target, mean ± SEM |
|---|---:|---:|
| Low / 35% V̇O₂peak | +1.16 mg·kg⁻¹·min⁻¹ | +1.8 ± 0.4 |
| Medium / 50% V̇O₂peak | +2.19 mg·kg⁻¹·min⁻¹ | +3.0 ± 0.4 |
| High / 80% V̇O₂peak | +2.83 mg·kg⁻¹·min⁻¹ | +3.5 ± 0.7 |

**Exercise increment result: ⚠️ PARTIAL.** All represented values fall within
the corresponding study mean ± 2 SEM intervals. The game has no separate 65%
condition, so the observed 65-to-80% plateau cannot be independently tested.

**Absolute clamp result: ⚠️ PARTIAL / OPEN FINDING.** The model's resting
control requires approximately 14.5 mg·kg⁻¹·min⁻¹, whereas Shetty reports
4.4 ± 0.4 mg·kg⁻¹·min⁻¹. The study used an insulin infusion of
30 mU·m⁻²·min⁻¹ and targeted plasma insulin of 300-550 pmol/L. Control
subtraction isolates the exercise increment, but it does not validate the
absolute insulin-dose response. This discrepancy belongs to a separate review
of the base Hovorka insulin-action/clamp calibration and must not be hidden by
retuning exercise parameters.

### Resistance context reversal

| Context | Model within-session BG change | Published direction |
|---|---:|---|
| Fasted morning, 08:00 | +0.63 mmol/L | Rise; approximately +0.9 mmol/L |
| Fed afternoon, 16:00 | -0.91 mmol/L | Fall; approximately -0.8 mmol/L |

**Result: ✅ PASS for direction and approximate magnitude.** The same resistance
model can produce opposite net BG directions through metabolic context rather
than through a hard-coded switch at exercise cessation.

## Context stress tests

- **Full unique-physiology matrix:** The six named characters share three body
  profiles in pairs. Testing both members of each pair would duplicate every
  physiological trajectory exactly. The non-redundant matrix therefore contains
  486 paired activity/control scenarios rather than 972 character-labelled
  duplicates: 3 body profiles × 3 activity types × 3 intensities × 3 durations
  × 3 metabolic contexts × 2 start times. All 486 remain finite. The observed
  BG range is 0.10-9.88 mmol/L. In total, 239 scenarios cross 3.9 mmol/L and
  116 cross 2.5 mmol/L. These are deliberately unmanaged stress runs beginning
  near euglycaemia, often with active insulin and up to 90 min of exercise.
  Their low minima are not clinically safe exercise protocols or treatment
  recommendations.
- **Active insulin across the matrix:** Active insulin produces at least as
  much total within-session cardio lowering in 54/54 matched comparisons.
- **Mixed envelope across the matrix:** Mixed activity lies between matched
  cardio and resistance effects in 162/162 comparisons.
- **Active insulin:** Thirty-minute medium cardio changes BG by -1.07 mmol/L in
  the basal context and -2.84 mmol/L with active bolus insulin. This passes the
  expected amplification check.
- **Prior exercise:** Twelve hours after medium cardio, effective ISF is 1.27
  times baseline and a repeated bout remains finite. This passes the persistence
  and numerical-stability check.
- **Profile dependence:** Child, reference-adult and large-adult runs remain
  finite and preserve the broad cardio > mixed > resistance glucose-lowering
  ordering. Magnitudes differ, as expected.

## Not-testable mechanisms

### Explicit mixed-activity intervals

**Status: ❌ NOT TESTABLE.** The current mixed category applies a continuous
weighted average of contraction uptake and hepatic stress. Rempel's protocol
contains six timed 60-s work intervals with recovery periods. A continuous
average cannot test interval peaks, recovery kinetics or interval-order
effects. No mixed parameters were retuned against that protocol.

### Romeres-compatible glucose-disposal decomposition

**Status: ❌ NOT TESTABLE.** The engine exposes direct contraction uptake and
insulin-mediated action, but it does not report resting and exercise
insulin-independent and insulin-dependent rates of disappearance with the same
definitions and denominators as the tracer-clamp analysis. The published
+66% to +82% and +81% to +155% targets therefore remain mechanistic references,
not passed assertions.

### Separate 65% V̇O₂peak condition

**Status: ❌ NOT TESTABLE.** Three discrete game intensities cannot identify
both the 65% maximum and the 80% plateau. Treating high as both conditions would
be circular and would overstate validation.

## Decision

No cardio or mixed parameter was changed in this phase.

The represented cardio increments, 30-min cross-type ordering and metabolic
context responses are plausible. More precise tuning would currently overfit
broad population observations while the decisive protocol details are absent
from the model.

The next justified model steps are:

1. review the absolute Hovorka insulin-dose response and virtual-clamp
   construction independently of exercise;
2. add an explicit work/recovery interval schedule before claiming
   mixed-activity protocol validation;
3. expose a documented glucose-disposal decomposition if Romeres-compatible
   mechanistic validation is required;
4. expand fixed archetypes into a declared virtual-population design before
   comparing population means and variability.

## Automated verification

`tests/activity-validation.js` produces machine-readable output with `--json`
and human-readable output by default. It reports PASS, PARTIAL, FAIL or
NOT TESTABLE for every claim. It is included in
`tests/run-physiology-regression.js`.

Current activity-validation result:

- 8 PASS
- 3 PARTIAL
- 3 NOT TESTABLE
- 0 FAIL

The complete physiology regression also passes:

- 21/21 direct engine-API tests
- 7/7 bit-identical golden-master scenarios
- 9/9 clinical-equivalence scenarios
- 10/10 standalone-engine/facade parity scenarios
- 180/180 full simulation tests

The intentionally changed cardio trajectory was refreshed in
`tests/fixtures/golden-master/exercise-cardio.json` and in the cardio block of
`tests/fixtures/clinical-baseline.json`. Regeneration left all other scenario
outputs unchanged.

## Sub-agent input

No sub-agents were used. The local `phys-reviewer` and `science-reviewer`
workflows were applied directly.

## Files cited

- `tests/fixtures/activity-literature-targets.json`
- `tests/activity-validation.js`
- `tests/run-physiology-regression.js`
- `js/hovorka.js`
- `js/physiology-engine.js`
- `js/simulator.js`
- `docs/BG-SCIENCE.md`
- `docs/MODEL-IMPLEMENTATION.md`
- `docs/references/Shetty_2021_ExerciseIntensityGlucoseRequirementsT1D.html`
- `docs/references/T1DEXI_2023_ExerciseTypesT1D.html`
- `docs/references/Rempel_2018_VigorousIntervalsT1D.html`
- `docs/references/PMC8321821_Exercise_InsulinDependent.html`
- `docs/references/Yardley_2013_ResistanceVsAerobicExerciseT1D.html`
