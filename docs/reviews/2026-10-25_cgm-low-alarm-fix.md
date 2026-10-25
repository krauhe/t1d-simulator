# CGM low alarm and night waking

Date: 2026-10-25

## 1. Background

The owner reported that low glucose did not produce an audible hypo alarm and
that a night alarm should wake the fictional character and reduce sleep.

## 2. Diagnosis

The old warning in `Simulator.updateNormoPoints()` used hidden `trueBG < 4.5`
and a falling-glucose test against `lastTrueBGForDropCheck`. `_postStep()` had
already updated that reference at its one-minute check. At one-minute updates,
the two values were equal and the warning condition could not pass. At smaller
updates the result depended on which tick crossed the threshold. The warning
also never invoked the engine's existing waking logic.

**F1 status: ✅ FIKSET (2026-10-25).** Replaced this unreliable trigger with an
engine CGM-sample event and verified the boundary, plateau and rearming cases.

This is a device/game-state fix. The 4.0 mmol/L alert and 4.5 mmol/L rearming
boundary are explicit gameplay settings, not newly fitted clinical parameters.
Existing sensor delay, sleep-loss sampling and stress conversion are unchanged.
BG-SCIENCE's CGM and sleep discussions provide background; they do not validate
these particular alert settings or guarantee awakening in real people.

## 3. Solution

1. `_sampleCgm()` evaluates fresh, active CGM samples. Below 4.0 it emits
   `cgm-low-alarm` once, with the displayed CGM value. At or above 4.5 the next
   episode is armed. A falling trend is unnecessary.
2. The event uses the existing `cgmAlarm` audio and a short translated graph/log
   message. Audio muting does not change the simulated sleep state.
3. A sleeping character enters the existing engine waking pathway. Actual
   overlap with the 22:00–07:00 window accrues sleep loss. Further actions use
   the existing interval-merging behavior; no duplicate one-hour penalty is added.
   A new alarm episode may bypass the ordinary action cooldown only when the
   character has already fallen asleep again.
4. The alarm latch is engine-owned and therefore part of `exportState()` /
   `importState()`. This keeps live play and deterministic What If on the same
   behavioral rules, while their existing noise settings can still differ.

## 4. Verification

| Check | Before | After |
|---|---|---|
| Low plateau / one-minute tick | Falling-reference test could suppress alarm | Fresh CGM below 4.0 emits an alarm |
| Alarm source | Hidden plasma BG | Displayed CGM sample |
| Offline/warmup/self-test | Independent true-BG warning path | No low alarm from stale CGM |
| Night alert | No waking call | One shared waking interval |
| One hour awake, dt 1 and 0.5 min | Not coupled to warning | Exactly one hour accrued in both checks |
| Alert at 06:59 | No waking call | One minute of night sleep loss |
| Restore during low episode | Facade-only warning state | Snapshot preserves episode latch |

1. `tests/cgm-low-alarm.test.cjs`: 8 checks passed.
2. `tests/physiology-engine-api.test.js`: 34/34 passed.
3. `tests/model-review-regression.test.js`: 18/18 passed.
4. Browser integration and final release validation are recorded in the release
   verification report; the unit tests above do not verify physical audibility.

## 5. Review input

No external model chose the alarm settings. A separate Codex agent reviewed
browser integration and found a short-waking edge case: a new low episode could
occur after a brief waking interval ended but before the ordinary 30-minute
action cooldown elapsed. The new alarm then played without waking the character.
The fix gives only new alarm episodes an explicit `forceWake` option when asleep.
An eighth regression check reproduces that sequence.

**F2 status: ✅ FIKSET (2026-10-25).** A new low episode now wakes an already
sleeping character despite that action cooldown.

The same review found a pre-existing visual timestamp mismatch in What If:
absolute waking intervals from a later-day snapshot were being drawn on a
timeline starting at zero. This affects visibility of the new alarm's waking
interval. A separate editor correction rebases only the display copies and
preserves the absolute engine state; its browser verification is recorded in
the release report.

## 6. Files cited

1. `js/physiology-engine.js:501`: CGM alarm state; `:1269` waking pathway;
   `:2934` low-alarm evaluation. Existing accumulation and snapshot methods are
   unchanged.
2. `js/simulator.js:1222`: event handling; `:1922` removal of the old warning.
3. `js/i18n.js:731` and `:1708`: translated alarm text.
4. `tests/cgm-low-alarm.test.cjs:1`: standalone regression checks.
5. `docs/MODEL-IMPLEMENTATION.md:2929`: CGM low-alarm subsection.

Overall status: F1 and F2 fixed; no new physiological calibration performed.
