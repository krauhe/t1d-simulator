# Sleep/wake state implementation decision

Date: 2026-07-27

## Background

Night-time physical activity could be rendered as sleep while the activity was still active. Sleep loss was assigned as a random amount when the activity started and therefore did not reflect the actual duration. Character mood, sleep bubbles and night shading used separate definitions of wakefulness.

## Diagnosis

The physiological downstream path was already present: at 07:00, accumulated sleep loss is converted to pending chronic stress, which later changes insulin resistance. The defect was upstream state ownership. `lastNightAwakeningTime`, facade-owned visual intervals and activity state could disagree.

The scientific magnitude remains the existing documented heuristic. Donga et al. (2010) supports reduced insulin sensitivity after partial sleep restriction in T1D, but does not define minute-level effects of a single night-time activity. The 30-minute post-activity wake period is therefore a game-model assumption, not a literature-derived physiological constant.

## Solution

`PhysiologyEngine` now owns:

- `nightAwakeUntil` for time-limited awakenings;
- `sleepAwakeOpen` while a physical activity has no known end;
- `sleepAwakeIntervals` as merged absolute-time history;
- minute-by-minute accumulation of overlap with 22:00-07:00.

Cardio, resistance exercise and mixed exercise open the interval at activity start. Manual and automatic stop close it 30 minutes after the stop time. Relaxation remains a short ordinary night intervention. Overlapping interventions merge, so each night minute is counted at most once.

Desktop, mobile, character mood, sleep bubbles, night shading, campaign tips and the editor now consume the same engine-owned history or current wake state.

## Verification

Direct engine tests cover:

- cardio, resistance and mixed activity;
- manual and automatic stop parity;
- activity through midnight;
- the 07:00 boundary;
- overlapping bolus and activity;
- one-minute substeps and a large-step crossing test.

Results on 2026-07-27:

- `tests/physiology-engine-api.test.js`: 27/27 passed.
- `tests/simulation.test.js`: 188/188 passed.

Browser verification remains part of the final integration gate.

## Files cited

- `js/physiology-engine.js`
- `js/simulator.js`
- `js/archetypes.js`
- `js/ui.js`
- `mobile/mobile.js`
- `js/campaign-core.js`
- `js/editor.js`
- `tests/physiology-engine-api.test.js`
- `tests/e2e/smoke.spec.js`
- `docs/MODEL-IMPLEMENTATION.md`
- `docs/reviews/2026-07-23_codex_sleep-state.md`
- Donga E et al. (2010), *Diabetes Care* 33:1573-1577.
