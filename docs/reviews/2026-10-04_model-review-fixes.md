# Model-review repairs: conservation bookkeeping, diagnostics and documentation

Date: 4 October 2026. Baseline checkpoint: `1c8243e`. Status: verified repair checkpoint; no push. The user authorised unambiguous fixes and deferred structural model choices during this repair stage.

## Background

The [implementation/science/test audit](2026-10-04_codex_model-science-test-review.md) identified 15 findings. This repair separates executable bookkeeping defects from disputed physiological structure and calibration. No physiological gain, half-life, EC50, bioavailability fraction or glycogen-capacity constant was retuned. BG-SCIENCE and the Knowledge Base were not edited in this repair stage.

## Diagnosis and evidence

The original audit supplies source appraisal, original measurements and baseline file hashes. Its checks against [Hovorka et al. (2004), Shetty et al. (2021), Paterson et al. (2016), Wolpert et al. (2013), and Umpierrez et al. (2024)](2026-10-04_codex_model-science-test-review.md#references) govern the documentation corrections. Relevant revised BG-SCIENCE sections are glucose distribution/production, fat and protein, insulin non-linearity, exercise, counterregulation, ketogenesis and glucotoxicity. No new study was used to derive a replacement parameter in this stage.

The code defects were independent of clinical calibration:

1. Rapid-insulin cleanup deleted a non-empty depot at 360 min.
2. The steady-state search inherited a cached rapid-insulin input from a previous state.
3. Food-event cleanup at 360 min truncated an API-supported 600-minute intake.
4. Effects-panel input counted net Q1 transport, Q2 disposal and suppressed EGP together, while already using insulin-suppressed EGP as the source.
5. HTML execution success was conflated with physiological acceptance; a stale food key and an invalid recovery-time calculation were hidden by the aggregate message.

## Repair decisions

### Insulin and food bookkeeping

A rapid depot is retained while its age is below 360 min **or** its residual `s1+s2` exceeds `10^-6 mU` (`10^-9 U`). That tolerance is numerical cleanup, not a clinical duration of action. At most that mass is discarded per expired depot. IOB scaling includes all retained doses, preventing a six-hour discontinuity. The absorption equations, dose bioavailability and timing constants are unchanged.

`initializeSteadyState()` now clears `rapidU_I` for each candidate basal-rate evaluation. Food delivery schedules remain active until `max(360, eatingDuration)`; glucose already in D1/D2 continues independently after schedule cleanup.

### Effects-panel accounting

Fluxes are recorded at the same start-of-substep state used by explicit Euler integration:

```
netTransport = x1 × Q1 − k12 × Q2
dQ1/dt = UG + EGP − F01c − FR − netTransport + rescue
```

Q2 disposal is not an additional Q1 sink. Insulin suppression is already present in EGP and is not subtracted twice. A negative net transport is shown as return from tissues. Glucagon-mediated addition is measured separately after the Hovorka step. Any numerical Q1 clamp correction is identified as numerical, not physiological.

The basal/rapid split remains a display convention based on the plasma source fractions; it is not causal attribution of delayed action to individual doses. Exercise and resistance modifiers have a diamond symbol, explanatory tooltips and no quantitatively scaled flux arrow. Only five rows are visible, with minimum arrow sizes, so the rendered subset is not a complete balance ledger. The underlying signed dataset is tested against actual Q1 change.

This does **not** fix F01's separate Q2 conservation defect. An accurate Q1 explanation cannot validate an erroneous peripheral sink.

### Diagnostics and interpretation

1. C.3 uses the current yoghurt preset consistently. Unknown food keys produce an explicit error.
2. Each HTML section records execution, failed checks, warnings and descriptive status in `window.modelValidation`. The final status reports all four rather than claiming that completion means validation.
3. G.5 sets its 65 g initial liver state immediately before glucagon, requires a subsequent depletion episode and reports the first return to 65 g. No observed depletion and no recovery within observation are distinct outcomes. A later new depletion cannot erase a previously observed recovery. The old 4–8 h acceptance target was not supported for this protocol and is removed, not widened.
4. K.1 reports differences from the zero-dose control and incremental response per unit. K.4/K.5 describe selected equations rather than passing an assumed insulin “dead zone”. K.3 plots positive EGP and Rd; net infusion is Rd−EGP, not their sum. The independent clamp discrepancy remains visible. The command-line overlap predicate now requires an actual sampled value within the interval, including tests for all-below, all-above and straddling-but-not-overlapping cases.
5. I.6 is labelled zero-insulin-state ablation, not pump interruption. Its BHB values no longer receive protocol-mismatched clinical timing grades or diagnose DKA. The displayed lag is read from the current 120-minute constant. Legacy Node BHB intervals are labelled historical regression, not independent validation.
6. H.3 checks the configured resistance equation and reports `1−1/R` as ISF reduction. Its graph also needed a fixed fractional axis and rounded tick labels; the generic glucose-axis padding had produced overlapping labels.
7. J.1–J.3 retain stochastic variation but use explicit, distinct seeds. An earlier unseeded J.2 run failed its unchanged spread threshold; seven random traces are not a distributional validation. Date-based seed blocks were specified before rerunning, without selecting favourable outcomes. The browser check now verifies identical J.1–J.3 results with and without the unrelated C.3 fault. K.2's interval is corrected to seven hours after exercise ends, and K.4/K.5 identify the muscle action-function EC50 rather than implying half-maximal whole-body disposal.

The implementation description and review skill now distinguish original parameters, simulator adaptations, measured endpoints and capacity proxies. Corrections include F01 units, zero-insulin EGP0, carbohydrate appearance, fixed insulin bioavailability, Hill versus linear action targets, Paterson's late comparator-adjusted endpoint, filter time constant, counterregulation phenotype and the absent SGLT2/acid–base models.

## Verification

### Before and after

Unless stated otherwise, these are deterministic diagnostic cases, not patient predictions. Baseline values are retained in the original audit; after-values come from rerunning its unchanged probe script against the repaired engine.

| Check | Before | After |
|---|---:|---:|
| Unaccounted depot insulin at 360 min, 10 U, τ=55 min, dt=1 | 0.0822 U | <10^-14 U |
| Same, τ=88 min, dt=1 | 0.6608 U | <10^-14 U |
| Same, τ=55/88 min, dt=0.5 | 0.0834 / 0.6624 U | <10^-14 U each |
| 60 g carbohydrate over 600 min, integrated appearance + gut remainder | 36 g | 60 g at dt=1 and 0.5 |
| Basal-rate search after cached rapid inputs 0/3/10 mU/min | Input-dependent | 9.362958 mU/min in all three |
| Near-steady effects-dataset signed sum | −0.451980 mmol/min | −0.000389517 mmol/min |
| Actual Q1 change in that one-minute case | −0.000389517 mmol | −0.000389517 mmol |
| G.5 measured initial liver amount | 92.5 g despite a 65 g target | 65.0 g in both arms |
| G.5 reported recovery | Zero elapsed misreported as >12 h | Meals 1.2 h; fasting no return within 12 h |
| HTML sections | 51 processed, 1 hidden execution error | 51 processed, 0 execution errors; 3 warning sections, 6 descriptive |
| Deliberately injected missing food key | No truthful aggregate verdict | Exactly 1 execution error in aggregate and section record |

The insulin-tail correction can change later glucose trajectories. That is intended: the previously deleted insulin now continues to absorb. The seven frozen golden scenarios nevertheless remain bit-identical; this establishes coverage of those scenarios only, not absence of effects beyond them.

### Test results

1. Review regression: **18/18**. Includes dt=1/0.5, slow and normal depots, stacked doses, accelerated absorption, eventual cleanup, three intake durations, reinitialisation, recovery analysis, clamp classification, dynamic Q1 accounting and state export/import.
2. Existing suites: **34/34** engine API; **7/7** golden scenarios; **8/8** baseline-equivalence scenarios; **10/10** engine/facade comparisons; **197/197** simulation tests.
3. Activity validation remains **11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL**. Resting insulin-clamp diagnostic remains **PARTIAL**. Neither status was changed to green by retuning a target.
4. Installed Chrome: all 51 HTML sections execute, with zero failed sections, three warning sections and six descriptive sections in the final seeded run; the missing-key fault is detected. J.1/J.2 spreads are 3.3/1.4 mmol/L for the specified samples, identical in both runs; their thresholds are unchanged. This resolves reproducibility, not the adequacy of those diagnostic thresholds or population variability. C.3, G.5, H.3, I.6, K.1 and K.3 screenshots inspected; H.3 axis defect repaired and rechecked. The actual app's effects renderer was tested with labelled synthetic rows, separately from physiological tests.
5. Danish/English text-sync, guide-link and intended-purpose checks pass. Review skill passes `quick_validate.py`. JavaScript syntax and Git whitespace checks pass.

The unchanged mixed meal/bolus/activity convergence probe gives final BG 6.7326, 6.6981 and 6.6719 mmol/L at dt=1, 0.5 and 0.1 min. This documents finite-step differences, not a claim of exact convergence. F01 remains independently reproducible: its no-insulin exercise case has a 10.40 g glucose-balance residual at dt=0.1 min.

Reproduction commands:

```powershell
& './tests/.bin/node.exe' 'tests/run-physiology-regression.js'
& './tests/.bin/node.exe' 'docs/reviews/2026-10-04_model-review-probes.cjs'
& './tests/.bin/node.exe' 'tests/model-review-browser.cjs'
```

Generated logs and screenshots are retained locally in `tests/playwright/2026-10-04-model-fixes/`. No generated file is required for the regression scripts to run.

## Deferred model choices

1. **Exercise transport (F01):** Limiting the existing Q2 sink to available substrate would prevent overdraw, but would leave plasma-to-tissue transport dependent on insulin. A substrate-limited contraction-mediated transport/disposal pathway is the more complete candidate; it changes the structure and needs joint Q1/Q2 conservation, low-insulin, onset/offset and independent exercise-target tests before adoption.
2. **Glycogen (F06, related F12):** Retain explicitly limited capacity proxies, or introduce conserved storage/precursor allocation coupled to uptake and hepatic output. The latter is required before claiming quantitative fasting/refeeding and rescue predictions, but changes downstream PEIS and glucagon behaviour. Low-BG activity throttling should be assessed in the same revision rather than adjusted independently without examining these couplings.
3. **Insulin response (F03):** Jointly fit transient bolus and sustained clamp responses across specified virtual profiles. Do not simply reduce the reference ISF to fit one clamp, nor infer an ineffective bolus threshold from tissue EC50 values. Any separation of action-channel gains requires a documented rationale and held-out evaluation.

F04's protocol-matched insulin-withdrawal/ketone validation and F05's protein-meal validation also remain unfinished. Accurate wording is not their quantitative repair. No structural choice above has been implemented without the user's next decision.

## External-model and sub-agent input

No new sub-agent or Gemini task was run during these repairs. The two archived Gemini reports had already been adjudicated in the audit. Their unsupported blanket validity claims, alleged large-Euler-step fast-forward defect and claim that the engine could not run headlessly were not adopted. Repair decisions follow reproduced code behaviour and the audit's source checks.

## Files cited

Line numbers refer to this repair working tree; named functions are stable navigation targets.

1. `js/hovorka.js`, `initializeSteadyState`, line 272: clear cached rapid input; A_G comment, line 103.
2. `js/physiology-engine.js`, lines 1459–1504: recorded Q1 balance; `_prepInsulinRates`, line 1561; food retention, line 1700; `_computeBGForces`, line 3057.
3. `js/ui.js`, `updateEffectsPanel`, line 4768; `_forceInfo` tooltips. `js/i18n.js`: three new labels in both languages.
4. `tests/model-review-regression.test.js`; `tests/validation-metrics.js`; `tests/model-review-browser.cjs`; runner addition in `tests/run-physiology-regression.js`, line 26.
5. `tests/model-validation.html`, C.3/C.6/G.1/G.5/H.3/I.5/I.6/J.1–J.3/K.1–K.5 and `runTestQueue`, line 6351; `tests/insulin-clamp-validation.js`; `tests/simulation.test.js`.
6. `docs/MODEL-IMPLEMENTATION.md`, version `2026-10-04-v1`; `.agents/skills/review/SKILL.md`; [original review and references](2026-10-04_codex_model-science-test-review.md#references).

Current status: **9 fixed, 5 partial, 1 open**. These categories track the specific findings, not clinical certification of the simulator.
