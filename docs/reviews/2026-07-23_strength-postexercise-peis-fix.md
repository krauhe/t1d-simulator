# Strength post-exercise sensitivity and glycogen-allocation decision

> **Status update (2026-08-05):** The pure 120-minute strength delay documented
> below has been superseded by a smooth fourth-order Hill latency gate with a
> 150-minute half-onset time. Small PEIS components are now summed without hard
> cutoffs. See `2026-08-05_strength-smooth-peis-onset-fix.md`.

**Date:** 2026-07-23
**Type:** Physiology calibration decision and post-mortem
**Status:** Implemented locally; not yet committed
**Scope:** Strength PEIS timing, component scaling, muscle-glycogen bookkeeping and validation

## 1. Background

The acute resistance-exercise calibration produced the intended educational
rise during a 60-minute session. The recovery trajectory, however, fell too
rapidly after exercise. A medium session starting from exact steady state
reached 6.04 mmol/L at 60 minutes but fell to 4.72 mmol/L by minute 180.

Two independent mechanisms caused that result:

1. strength inherited the full fast, early and late post-exercise insulin
   sensitivity amplitudes through one shared scale; and
2. muscle-glycogen resynthesis subtracted glucose directly from plasma Q1 even
   though Hovorka x1/x2 and exercise E1 already represented whole-body muscle
   glucose uptake.

The result was not merely a strong aftereffect. It counted part of the same
glucose destination twice.

## 2. Diagnosis

### Literature evidence

Young et al. (2023) separated insulin-mediated glucose utilization (IMGU) from
non-insulin-mediated glucose utilization (NIMGU) in 25 adults with T1D during
45 minutes of resistance exercise under three insulin infusion rates. NIMGU
rose during exercise and returned to baseline approximately 30 minutes later,
whereas IMGU did not differ from baseline throughout the study, including the
post-exercise observation period. This directly supports contraction-mediated
uptake during the bout without an immediate strength-specific insulin-mediated
gain.

Vissing et al. (2008) observed increased leg glucose uptake and
AS160/TBC1D4 phosphorylation at 1-2 hours after heavy resistance exercise in
nine healthy men. The study did not isolate insulin-mediated uptake and cannot
be transferred quantitatively to T1D, but it supports a recovery response that
emerges after rather than during the bout.

Breen et al. (2011) measured approximately 12% greater glucose disappearance
24 hours after resistance exercise in healthy men, together with increased
basal and insulin-stimulated AS160/TBC1D4 phosphorylation. This is the
quantitative late-phase target. It is not T1D-specific, so the target is used
as a restrained educational calibration rather than an individual prediction.

Cartee (2015) describes glycogen restoration as a destination of
exercise-enhanced glucose uptake. It does not justify adding a second plasma
sink after whole-body glucose disposal has already been calculated.

### Original design versus implementation

The continuous delayed rectangular-response structure was sound: an activity
session creates its response at start, and stopping only freezes duration.
The defect was in the strength parameter contract and the glycogen allocation:

| Mechanism | Previous strength implementation | Consequence |
|---|---|---|
| Fast PEIS | Full shared scale | Acute insulin-mediated gain contradicted the T1D clamp |
| Early PEIS | Full shared scale | Excess recovery disposal |
| Late PEIS | Full shared scale | Larger 24-hour effect than the resistance-specific target |
| Glycogen refill | Explicit negative Q1 flux | Uptake already represented by x1/x2 and E1 was counted again |

### Quantitative reality check

Ablation of a 60-minute medium-strength scenario at exact steady state showed:

| PEIS | Separate glycogen Q1 drain | BG at minute 180 |
|---|---|---:|
| On | On | 4.72 mmol/L |
| Off | On | 5.82 mmol/L |
| On | Off | 5.85 mmol/L |
| Off | Off | 7.36 mmol/L |

Each mechanism independently removed approximately 1.5 mmol/L relative to the
fully ablated trajectory. Their combination therefore obscured the intended
post-strength hepatic rise and overstated recovery disposal.

## 3. Solution

### Independent sensitivity-component scales

Every activity type now supplies three independent parameters:

```text
fastBoost  = A_fast  × fastSensitivityScaling  × durationFactor × response_fast
earlyBoost = A_early × earlySensitivityScaling × durationFactor × response_early
             × (1 - muscleGlycogenReserve)
lateBoost  = A_late  × lateSensitivityScaling  × durationFactor × response_late
```

Strength uses:

| Parameter | Value | Rationale |
|---|---:|---|
| `fastSensitivityScaling` | 0.00 | No measurable IMGU rise during or immediately after the T1D clamp |
| `earlySensitivityScaling` | 0.45 | Moderate recovery response without importing the full aerobic amplitude |
| `lateSensitivityScaling` | 0.45 | Calibrates 24-hour muscle disposal near the 12% Breen endpoint |
| `insulinSensitivityDelayMin` | 120 min from exercise onset | Keeps the 45-minute bout and first 45 minutes of recovery near baseline IMGU |

The delay is a conservative transport-model choice. It is not presented as a
measured molecular time constant. A three-hour session still develops the
response while exercise is continuing, so no effect is switched on by the stop
event.

### Intracellular glycogen bookkeeping

`muscleGlycogenGrams` still drains during activity, refills after activity and
gates the early sensitivity component. Refilling no longer subtracts Q1
directly. The pool records how already-modelled muscle glucose disposal is
allocated intracellularly:

```text
whole-body muscle uptake = Hovorka x1/x2 + exercise E1
glycogen pool refill     = allocation within that uptake, not an extra flux
```

This removes the duplicate sink while retaining the pool's educational and
mechanistic functions.

## 4. Verification

### Recovery trajectory

The deterministic 70 kg profile starts at 5.50 mmol/L with unrelated
variability disabled:

| Time from start | Low strength | Medium strength | High strength |
|---:|---:|---:|---:|
| 60 min | 5.76 | 6.04 | 6.44 |
| 120 min | 6.13 | 6.87 | 7.78 |
| 180 min | 6.31 | 7.26 | 8.37 |
| 360 min | 5.96 | 6.59 | 7.15 |
| 720 min | 6.35 | 6.38 | 6.21 |

The table is a deterministic educational scenario, not a population prediction.
The post-exercise curve first retains the hepatic rise and then turns downward
as delayed sensitivity develops. Context-dependent food, insulin and circadian
states remain active in normal gameplay.

### Literature-linked endpoint

For medium strength with the glycogen pool forced full to isolate the late
component:

| Endpoint at 24 h | Model | Target |
|---|---:|---:|
| PEIS EC50-shift factor | 1.072 | 1.05-1.11 implementation range |
| Hovorka x2 disposal ratio at plasma insulin 8 mU/L | 1.103 | 1.08-1.16, centred on Breen's approximately 12% |

### Automated checks

The test suite now verifies:

1. no strength-specific PEIS during the 45-minute bout;
2. no discontinuity at manual or automatic stop;
3. delayed sensitivity developing during a three-hour session;
4. the 24-hour resistance disposal endpoint;
5. independent ablation of uptake, hepatic drive, PEIS and glycogen use; and
6. glycogen refill without a direct Q1 change.

The complete physiology regression passes after the intentional exercise
fixtures were regenerated:

- 7/7 bit-identical golden-master scenarios;
- 9/9 clinical-baseline scenarios;
- 10/10 standalone-engine versus Simulator-facade scenarios;
- 21/21 standalone API tests; and
- 183/183 full simulation tests.

The activity validation has 8 PASS, 3 PARTIAL, 3 NOT TESTABLE and 0 FAIL. The
remaining partial results concern known population and external-clamp
limitations, not a regression introduced by this change.

Browser validation of `tests/model-validation.html` initially exposed stale
cached model scripts. Cache-busting the model files made the visual page agree
with the engine: low, medium and high strength changed BG by +0.26, +0.54 and
+0.94 mmol/L at 60 minutes, all six exercise conclusions passed, and the
browser console contained no errors.

## 5. Sub-agent input

No sub-agent was used. The diagnosis came from direct code tracing, mechanism
ablation, the project's existing evidence base and the primary studies listed
below.

## 6. Files cited

- `js/physiology-engine.js` - activity contract, `currentISF()` and glycogen-pool update
- `js/simulator.js` - game activity catalogue and engine delegation
- `tests/simulation.test.js` - timing, ablation, 24-hour disposal and Q1-allocation tests
- `tests/physiology-engine-api.test.js` - standalone activity-contract coverage
- `tests/model-validation.html` - browser-rendered exercise and strength checks
- `tests/fixtures/golden-master/exercise-cardio.json` - intentional new whole-body trajectory
- `tests/fixtures/clinical-baseline.json` - intentional new exercise baseline
- `docs/MODEL-IMPLEMENTATION.md` - equations, parameters and pool interpretation
- `docs/diagrams/exercise/` - visual model and caption
- `docs/references/Young_2023_ResistanceExerciseGlucoseDynamicsT1D.html`
- `docs/references/Vissing_2008_ResistanceExerciseAS160Recovery.html`
- `docs/references/Breen_2011_ResistanceExerciseGlycemicControl.html`
- Cartee GD. Mechanisms for greater insulin-stimulated glucose uptake in normal and insulin-resistant skeletal muscle after acute exercise. *American Journal of Physiology - Endocrinology and Metabolism*. 2015;309:E949-E959. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4816200/)
