# Exercise visual-validation follow-up

Generated: 2026-07-28

## Scope

Focused review of Chapter E in `tests/model-validation.html`, prompted by the
apparent discontinuity in E.5, the obsolete relaxation test, and the visibility
of the insulin-exercise interaction test. This review changes presentation and
coverage only; no physiological equations or parameters were changed.

## Findings and status

### 1. Apparent E.5 discontinuity

**STATUS: ✅ FIXED (2026-07-28)**

The vertical cyan line at the right edge of E.5 was not part of the effective-ISF
series. It was the secondary y-axis, which used the same cyan colour as the ISF
curve and therefore looked like a sudden drop at 6 hours. The right-axis line is
now neutral grey while its labels retain the series colour.

The model state is continuous across the automatic stop:

| Minute from activity start | Effective ISF (mmol/L/U) | Activity active |
|---:|---:|:---:|
| 179 | 3.943 | yes |
| 180 | 3.948 | no |
| 181 | 3.953 | no |

The change in slope at 120 minutes is separate and expected: medium strength has
a documented 120-minute sensitivity delay. The delayed rectangular response is
zero through minute 120 and then builds continuously; it is now explicitly
annotated in the plot.

### 2. Exercise interventions were not visible in time-series plots

**STATUS: ✅ FIXED (2026-07-28)**

The shared chart renderer now supports shaded intervention windows with labelled
start and stop boundaries plus separate mechanism annotations. E.1 and E.2 mark
activity from 0 to 60 minutes. E.5 marks strength from 0 to 180 minutes and the
120-minute sensitivity-delay boundary.

### 3. Insulin-exercise interaction was difficult to identify

**STATUS: ✅ FIXED (2026-07-28)**

The first E.4 revision still compressed the interaction into an abstract
"additional BG reduction" versus intensity plot and reset BG at activity start.
That made the actual trajectories and the timing of the interventions difficult
to inspect.

E.4 is now a conventional multi-curve BG time series. All runs begin from the
same exact 10.0 mmol/L steady state at -90 minutes. Medium cardio runs from 0 to
60 minutes, and the plot compares no additional rapid insulin with a fixed 1 U
model input at -60, -30, 0 and +30 minutes. BG is not reset at exercise start.
The x-axis shows minutes relative to exercise onset, every intervention is
marked, and the y-axis is fitted to the observed trajectories with a small
margin. E.3 retains the separate type-by-intensity comparison.

### 4. Obsolete relaxation test

**STATUS: ✅ FIXED FOR PUBLIC VALIDATION (2026-07-28)**

E.6 was inconsistent with the current public game, which exposes cardio,
strength and mixed activity only. E.6 and the public README claim of four activity
types have been removed. Chapter E now contains five tests and the full page
contains 51 visual test sections.

### 5. Residual internal relaxation implementation

**STATUS: ⚠️ BY DESIGN / OUT OF SCOPE**

`js/simulator.js` and the standalone engine fallback catalogue still contain the
internal `afslapning` activity definition. Removing that internal API path would
be a separate physiological/API change affecting automated tests and technical
documentation. It was not required to remove the stale public visual test and
was therefore left unchanged in this follow-up.

## Verification

- Browser run completed all 51 visual test sections without a runtime error.
- E.4 was visually checked as a five-curve BG time series with explicit bolus
  markers, a 0-60 minute activity window, relative-time ticks, and fitted y-axis.
- The targeted Playwright model-validation smoke test passed (1/1) with no
  page errors, console errors, or failing visual conclusions.
- The automated model suite passed 190/190 tests and the standalone engine API
  suite passed 27/27 tests.
- E.5 was visually checked with the activity interval, sensitivity-delay marker,
  and neutral secondary-axis line.
- Minute-level E.5 values were independently reproduced with the standalone
  physiology engine.

## Files cited

- `tests/model-validation.html:596` - shared chart renderer
- `tests/model-validation.html:3789` - E.4 insulin-cardio interaction
- `tests/model-validation.html:3968` - E.5 continuity test
- `js/physiology-engine.js:207` - continuous delayed rectangular response
- `js/physiology-engine.js:281` - 120-minute strength sensitivity delay
- `js/physiology-engine.js:303` - residual internal relaxation fallback
- `js/simulator.js:157` - residual game-side relaxation definition
- `README.md:45` - public three-activity description

## Summary

Fixed: 4 findings. By design/out of scope: 1 residual internal API finding.
