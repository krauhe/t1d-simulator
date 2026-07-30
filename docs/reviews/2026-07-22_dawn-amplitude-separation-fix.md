# Dawn amplitude separation fix

**Date:** 2026-07-22
**Type:** Model-contract decision and consistency fix
**Status:** Fixed locally; not committed
**Files:** `js/physiology-engine.js`, `tests/simulation.test.js`, `tests/exercise-timing-test.html`, `tests/model-validation.html`, `docs/MODEL-IMPLEMENTATION.md`

## Background

The physiology review found that `circadianISF` read `this.dawnAmplitude`, a
property that was never initialised, while daily dawn generation wrote
`this._dawnAmplitude`. The fallback value of 1.0 preserved the documented
0.70–1.20 ISF curve, but the dead reference made the intended model contract
unclear.

## Diagnosis

Git history shows that the two names represented different quantities:

- `_dawnAmplitude` is the additive HGP amplitude generated around 0.15, with
  day-to-day variation and amplification from sleep loss and chronic stress.
- `dawnAmplitude` was introduced as a normalised 0–1 control for the strength
  of the circadian-ISF curve. It was never wired to a constructor, profile or
  campaign configuration, so standard gameplay always used its 1.0 fallback.

Directly replacing `this.dawnAmplitude` with `this._dawnAmplitude` would be
dimensionally inappropriate. At the typical HGP value 0.15 it would shrink the
documented ISF range from 0.70–1.20 to approximately 0.955–1.03.

The evidence cited in the model documentation supports circadian variation in
both HGP and insulin sensitivity but does not provide a calibrated covariance
that would justify making both daily amplitudes vary together. They therefore
remain separate model components.

## Solution

`circadianISF` now uses `modules.dawn` directly as its explicit normalised
amplitude. This preserves the standard curve exactly:

| Dawn module | 08:00 ISF factor | 00:00 ISF factor |
|---:|---:|---:|
| 1.0 | 0.70 | 1.20 |
| 0.5 | 0.85 | 1.10 |
| 0.0 | 1.00 | 1.00 |

Daily random variation, sleep loss and chronic stress continue to affect only
the HGP amplitude and peak timing. The shared dawn module can attenuate both
the HGP and ISF mechanisms for laboratory and campaign scenarios.

## Verification

Regression tests verify:

1. The default ISF endpoints remain 0.70 and 1.20.
2. Changing `_dawnAmplitude` from 0.05 to 0.35 does not alter circadian ISF.
3. A dawn module scalar of 0.5 interpolates the morning factor to 0.85.
4. A disabled dawn module returns neutral circadian ISF of 1.0.

All verification suites passed:

| Suite | Result |
|---|---:|
| Simulation | 163/163 |
| Physiology engine API | 21/21 |
| Golden master | 7/7, bit-identical |
| Clinical equivalence | 9/9 |
| Standalone parity | 10/10 |

## Sub-agent input

No sub-agents were used.

## Files cited

- `js/physiology-engine.js`, dawn generation and circadian getters
- `js/simulator.js`, historical facade comments and circadian proxies
- `docs/MODEL-IMPLEMENTATION.md`, section 8
- `docs/BG-SCIENCE.md`, section 14
- Git commit `ae2a9e2`, which introduced the separate normalised ISF control
- Git commit `40bb0b0`, which moved the unchanged getter into the engine
