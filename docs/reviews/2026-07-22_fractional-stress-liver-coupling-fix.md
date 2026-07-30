# Fractional stress and liver-reserve coupling fix

**Date:** 2026-07-22
**Type:** Coupled-model consistency fix
**Status:** Fixed locally; not committed
**Files:** `js/physiology-engine.js`, `tests/simulation.test.js`, `docs/MODEL-IMPLEMENTATION.md`

## Background

The physiology review found an asymmetric application of the laboratory
`stressResponse` scalar. A value of 0.5 halved the acute and chronic stress
contributions to blood-side HGP, but the liver-reserve bookkeeping still used
the full acute stress level.

## Diagnosis

The blood-side acute contribution was:

```text
acute HGP signal = acuteStress × (0.6 × reserve + 0.4) × stressScale
```

The corresponding glycogen-dependent reserve drain omitted `stressScale`:

```text
stress drain = EGP0 × acuteStress × 0.6 × glucoseMassConversion
```

At 70 kg and `acuteStress = 0.4`, the full marginal drain is approximately
2.92 g/h. The old model therefore removed approximately 2.92 g/h at both 100 %
and 50 % module strength, even though the blood-side signal was halved.

At module strength zero, the substep loop skipped `updateStressHormones`
entirely. Because liver-reserve updating was nested inside that method, this
also froze unrelated basal, protein, exercise and recovery flows.

## Solution

The same normalised `stressScale` is now passed to the liver-reserve update:

```text
stress drain = EGP0 × acuteStress × stressScale × 0.6 × glucoseMassConversion
```

The zero-strength path explicitly updates the liver reserve with
`stressScale = 0`. Stress and HAAF state remain frozen as intended, while all
non-stress liver flows continue.

This changes only fractional or disabled laboratory configurations.
Standard gameplay uses `stressResponse = 1` and is mathematically unchanged.

## Verification

Regression scenarios verify:

1. A 50 % stress module produces 50 % of the marginal stress-dependent drain.
2. A disabled stress module produces no marginal stress-dependent drain.
3. Medium cardio still depletes the liver reserve when stress response is off.

All verification suites passed:

| Suite | Result |
|---|---:|
| Simulation | 165/165 |
| Physiology engine API | 21/21 |
| Golden master | 7/7, bit-identical |
| Clinical equivalence | 9/9 |
| Standalone parity | 10/10 |

## Sub-agent input

No sub-agents were used.

## Files cited

- `js/physiology-engine.js`, substep stress orchestration and liver-reserve update
- `docs/MODEL-IMPLEMENTATION.md`, stress multiplier decomposition
- `docs/BG-SCIENCE.md`, stress hormones and hepatic glucose production
- `docs/reviews/2026-07-21_codex_full-physiology-logical-consistency.md`, NOTE 2
