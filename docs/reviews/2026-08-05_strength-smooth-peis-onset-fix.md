# Smooth resistance-exercise PEIS onset decision

**Date:** 2026-08-05  
**Type:** Physiological timing calibration and implementation decision  
**Status:** Implemented and verified locally; not committed or pushed  
**Scope:** Resistance-exercise insulin-sensitivity onset, component cutoffs, E5 validation, regression fixtures and model documentation

## 1. Background

Visual validation E5 showed effective ISF remaining exactly flat for two hours
after resistance exercise started and then rising at the annotated minute-120
boundary. The user correctly questioned whether a physiological response should
begin at one exact minute.

The implementation contained two distinct causes:

1. resistance exercise used a pure `insulinSensitivityDelayMin = 120`, so all
   insulin-mediated exercise components were exactly zero through minute 120;
2. each component was added only after exceeding a hard `0.005` cutoff, which
   introduced a small value discontinuity even though the underlying response
   equation was value-continuous.

E5 made the transition look larger by sampling the ISF curve every five
minutes: the first plotted post-boundary point was minute 125, where effective
ISF had already risen from 3.000 to approximately 3.150 mmol/L/U.

The complete pre-fix review is
[`2026-08-05_codex_e5-isf-delay.md`](2026-08-05_codex_e5-isf-delay.md).

## 2. Diagnosis

### Evidence traceability

| Claim or mechanism | Population and protocol | External target | Source | Implementation equation | Parameter and unit | Test | Status |
|---|---|---|---|---|---|---|---|
| No large early resistance-specific IMGU gain | 25 adults with T1D; 45 min moderate/high resistance exercise under three insulin-infusion clamps | IMGU unchanged during the bout; NIMGU rose and returned toward baseline approximately 30 min after exercise | Young et al. 2023 | Strength fast scale = 0; smooth latency multiplies early/late PEIS | `fastSensitivityScaling = 0`; onset half-time 150 min | 45-min and 30-min-recovery PEIS bounds in `tests/simulation.test.js` | PASS |
| Recovery effect should emerge over hours, not at one exact minute | 9 healthy young men; resistance exercise followed for 2 h | Leg glucose uptake elevated in recovery; AS160 phosphorylation increased at 1 h and remained elevated at 2 h | Dreyer/Vissing et al. 2008 | Fourth-order Hill latency gate | Hill n = 4; time measured from bout start | E5 minute curve and 119/120/121 slope test | PASS, qualitative population holdout only |
| Late resistance PEIS persists into the next day | Healthy men; resistance exercise followed by next-day glucose challenge | Approximately 12% greater glucose disappearance at 24 h | Breen et al. 2011 | Existing late component with 18-h half-life, now multiplied by a gate that is effectively 1 at 24 h | `lateSensitivityScaling = 0.45`; decay half-life 1080 min | 24-h EC50-shift and Hovorka x2 disposal test | PASS: disposal ratio 1.111 |
| Start, former delay boundary and stop must not create state jumps | Mathematical implementation invariant | Value continuity and stable finite-difference slope | Mechanistic/numerical requirement | No thresholded addition; analytic gate and response | Dimensionless response; all times in minutes | dt 1 and 0.25 min; manual/automatic stop matrix | PASS |

Young et al. is the T1D-specific early-window calibration source. The
Dreyer/Vissing result constrains only the qualitative recovery timing because
it was measured in healthy men and did not isolate insulin-mediated uptake.
Breen's 24-hour endpoint was already used to calibrate the existing late scale;
it is therefore a preservation target, not an independent validation claim.

### Original design versus evidence

The pure delay was a conservative transport approximation, not a parameter
identified by Young et al. Young supports suppressing a large early IMGU
increase but does not support a universal zero-to-nonzero switch at 120 minutes.
The project's science document already described the exact delay as an
implementation choice rather than a measured molecular constant.

The hard component cutoffs were computational conveniences. They were not
physiological thresholds and were unnecessary because expired session records
already have a bounded lifetime. Applying the cutoffs inside the sum changed
the displayed physiology discontinuously when a component crossed 0.005.

### Pre-fix event-boundary reality check

For a deterministic 70 kg reference profile with base ISF 3.0 mmol/L/U and a
continuous 180-minute medium-strength session:

| Minute | Pre-fix effective ISF | Interpretation |
|---:|---:|---|
| 119 | 3.000000 | Exactly flat |
| 120 | 3.000000 | Pure delay boundary |
| 121 | 3.031425 | First included component after cutoff |
| 125 | 3.149570 | First post-boundary point in the old E5 plot |
| 150 | 3.685397 | Delayed response established |

The 119→120 rise was zero, whereas the 120→121 rise was 0.031425 mmol/L/U.
This was a model-shape artifact rather than timestep instability.

## 3. Solution

### Smooth latency gate

The pure delay is replaced by a fourth-order Hill gate:

```text
r = ageMin / insulinSensitivityOnsetHalfMin

onsetGate(ageMin) = r^4 / (1 + r^4)     when onsetHalfMin > 0
onsetGate(ageMin) = 1                    when onsetHalfMin = 0 and ageMin > 0
```

`ageMin` and `insulinSensitivityOnsetHalfMin` are both measured in minutes, so
`r` and the gate are dimensionless. With exponent 4, the function has value 0
and derivative 0 at activity start. It remains differentiable for all positive
ages and approaches 1 asymptotically.

The parameter is explicitly a half-onset time, not a delay:

| Activity type | Half-onset time |
|---|---:|
| Cardio | 0 min (immediate gate) |
| Mixed | 10 min |
| Resistance | 150 min |
| Relaxation | 0 min, but all PEIS scales are zero |

The resistance value 150 min was chosen before inspecting regression fixtures
against the following calibration constraints:

| Target | Model result |
|---|---:|
| 45-min resistance bout: PEIS within 0.5% of baseline | 1.0012 |
| 30 min recovery after a 45-min bout: PEIS within 1% of baseline | 1.0089 |
| Long bout: response already increasing at minute 90 | 1.0314 |
| Long bout: moderate response at minute 120, no special event | 1.0960 |
| Long bout: response >15% at minute 150 | 1.1795 |

For the standard 45-minute protocol, 150 minutes from activity start equals
105 minutes into recovery. The gate is already nonzero earlier; 150 minutes is
only its 50% point.

### Component response and decay

The existing rectangular exposure response is retained without an internal
delay:

```text
while active:
    response = 1 - exp(-age / buildTau)

after stop:
    response = (1 - exp(-duration / buildTau))
               * 0.5^((age - duration) / decayHalfLife)

componentBoost = amplitude * typeScale * durationFactor
                 * response * onsetGate
```

The fast, early and late component amplitudes and half-lives are unchanged.
The early component remains gated by current muscle-glycogen depletion. The
late component remains independent of glycogen state.

### Removal of hard contribution cutoffs

All finite component boosts are now summed, including values below 0.005. Old
session records are still removed after the 96-hour maximum lifetime. This
separates numerical cleanup from the physiological output and eliminates the
threshold-induced value jump.

## 4. Verification

### Former minute-120 boundary

For the same deterministic 180-minute medium-strength session:

| Minute | Pre-fix ISF | Post-fix ISF | Post-fix PEIS factor |
|---:|---:|---:|---:|
| 90 | 3.000000 | 3.094125 | 1.031375 |
| 119 | 3.000000 | 3.279811 | 1.093270 |
| 120 | 3.000000 | 3.288072 | 1.096024 |
| 121 | 3.031425 | 3.296433 | 1.098811 |
| 150 | 3.685397 | 3.538470 | 1.179490 |
| 180 | 3.948402 | 3.738123 | 1.246041 |

Post-fix finite differences at dt = 1 min are:

```text
ISF(120) - ISF(119) = 0.008261
ISF(121) - ISF(120) = 0.008362
```

The slope changes by approximately 1.2%, rather than switching from zero to a
large positive value. Results at dt = 0.25 min differ by less than 0.00001
mmol/L/U at these checkpoints.

### Preserved calibration endpoints

| Endpoint | Post-fix result | Accepted target |
|---|---:|---:|
| 60-min low resistance ΔBG | +0.260 mmol/L | Educational calibrated range |
| 60-min medium resistance ΔBG | +0.538 mmol/L | Educational calibrated range |
| 60-min high resistance ΔBG | +0.936 mmol/L | Educational calibrated range |
| 24-h resistance PEIS EC50 factor | 1.077 | 1.05–1.11 |
| 24-h Hovorka x2 disposal ratio at 8 mU/L | 1.111 | 1.08–1.16; Breen centre ≈1.12 |

Removing cutoffs changed the cardio golden-master trajectory by at most 0.004
mmol/L. The clinical-equivalence tolerance accepted the change. The cardio
fixture was then regenerated intentionally so the bit-identical baseline now
describes the continuous implementation.

### Automated verification

- Full simulation suite: **196/196 passed**.
- PhysiologyEngine API: **34/34 passed**.
- Golden master: **7/7 bit-identical after intentional fixture update**.
- Clinical equivalence: **8/8 within tolerances**.
- Activity validation: **11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL**.
- Context matrix: **486/486 finite**; all 162 mixed responses remained inside
  the matched cardio/resistance envelope.

The remaining PARTIAL and NOT TESTABLE activity findings predate this change
and concern population representativeness, the absolute clamp baseline and
protocol states not represented by the three-level game catalogue.

## 5. Sub-agent input

No sub-agent was used. The implementation and review were performed directly
with the project's physiology-review workflow.

## 6. Files cited

- `js/physiology-engine.js:189-252` — onset gate, rectangular response and constants.
- `js/physiology-engine.js:267-299` — activity-type onset parameters.
- `js/physiology-engine.js:2636-2714` — PEIS component calculation without cutoffs.
- `js/physiology-engine.js:3417-3470` — activity-session lifecycle and cleanup.
- `js/simulator.js:46-170` — matching game activity catalogue.
- `js/hovorka.js:403-450` — muscle-specific PEIS EC50 shift and x2 endpoint.
- `tests/simulation.test.js:1364-1402` — Young early-window constraints.
- `tests/simulation.test.js:1667-1728` — long-session and 119/120/121 continuity tests.
- `tests/simulation.test.js:3370-3397` — 24-hour resistance disposal target.
- `tests/model-validation.html:3984-4105` — E5 minute-resolution visual validation.
- `tests/fixtures/golden-master/exercise-cardio.json` — intentional continuous-output baseline.
- `docs/MODEL-IMPLEMENTATION.md:1474-1533` and `1639-1860`.
- `docs/BG-SCIENCE.md:1030-1134`.
- `docs/references/Young_2023_ResistanceExerciseGlucoseDynamicsT1D.html`.
- `docs/references/Vissing_2008_ResistanceExerciseAS160Recovery.html`.
- `docs/references/Breen_2011_ResistanceExerciseGlycemicControl.html`.

## Status summary

- Fixed warnings: 1
- Fixed numerical discontinuities: 1
- Open defects introduced by this change: 0
- Known evidence limitations retained: healthy-subject recovery timing and
  group-average calibration cannot represent every individual resistance bout

