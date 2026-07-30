# Codex physiological review - strength post-exercise response

**Date:** 2026-07-23
**Scope:** Strength PEIS timing, muscle-glycogen allocation, recovery trajectory and test coverage
**Verdict:** Two material internal inconsistencies were fixed; resistance-specific long-term evidence remains limited

## Summary

The acute strength model already separated contraction uptake from hepatic
glucose production. The recovery path did not preserve that separation:
strength inherited the full aerobic-like PEIS response, and glycogen refill
removed plasma glucose a second time after whole-body muscle disposal had
already been calculated.

The revised model keeps the same continuous start/stop equation but gives each
activity independent fast, early and late sensitivity scales. Strength has no
fast insulin-mediated component, uses reduced early and late components and
delays them until 120 minutes from exercise onset. Glycogen refill remains an
intracellular state and no longer creates an additional Q1 sink.

## Findings and status

### 1. Strength inherited an unsupported fast insulin-mediated component

**Severity:** High
**Status:** ✅ FIKSET (2026-07-23, local)

Young et al. (2023) found unchanged insulin-mediated glucose utilization during
and after the 45-minute T1D resistance protocol. The previous shared scale
activated the same large fast component used for cardio. Strength now sets
`fastSensitivityScaling = 0`.

### 2. One scale prevented mechanism-specific calibration

**Severity:** Medium
**Status:** ✅ FIKSET (2026-07-23, local)

`insulinSensitivityScaling` controlled fast, glycogen-coupled early and
AS160-associated late responses together. It has been replaced by three
explicit scales in both the standalone engine and game catalogue.

### 3. Glycogen resynthesis duplicated muscle glucose disposal

**Severity:** High
**Status:** ✅ FIKSET (2026-07-23, local)

The pool update subtracted Q1 while Hovorka x1/x2 and exercise E1 already
represented the associated whole-body uptake. The pool now allocates that
existing disposal to intracellular glycogen without changing Q1 directly.

### 4. A stop event must not create physiology

**Severity:** High
**Status:** ✅ FIKSET (2026-07-23)

The response is still created at activity start. A 120-minute delay suppresses
the strength-specific insulin-mediated gain in the early observation window,
but a session lasting longer than 120 minutes develops the response while it
is still active. Manual and automatic stop remain continuous.

### 5. The 24-hour resistance target is not T1D-specific

**Severity:** Medium
**Status:** ⚠️ DELVIST (2026-07-23)

The approximately 12% glucose-disappearance endpoint comes from healthy men
(Breen et al., 2011), while the strongest direct T1D evidence covers the bout
and early recovery (Young et al., 2023). The calibration is therefore a
conservative educational stereotype. It must not be interpreted as an
individual athlete prediction.

### 6. Glycogen resynthesis is not mass-balanced to a named uptake sub-flux

**Severity:** Medium
**Status:** ⚠️ ÅBEN

Removing the duplicate Q1 drain restores whole-body consistency, but the pool
refill rate is still heuristic bookkeeping rather than an explicit partition
of x1, x2 and E1. A future compartment extension could divide muscle uptake
between oxidation and glycogen storage while conserving mass exactly. That
would require a larger model change and should not be folded into this
calibration.

## Logical-consistency assessment

- Contraction-mediated uptake remains in E1.
- Insulin-mediated uptake remains in Hovorka x1/x2, modified by PEIS.
- Exercise hepatic output remains a separate transient source.
- Glycogen consumption is an intracellular substrate state.
- Glycogen resynthesis no longer creates a second whole-body sink.
- Activity start defines the full response; stop only freezes duration.
- The standalone and gameplay activity catalogues use the same parameters.
- Tests link the 24-hour parameter choice to an explicit disposal endpoint.

## Status summary

- Critical findings: 0
- High findings: 3 fixed
- Medium findings: 1 fixed, 1 partial, 1 open
- Automated simulation tests: 183/183 passing before full regression

The implementation and quantitative rationale are recorded in
`2026-07-23_strength-postexercise-peis-fix.md`.
