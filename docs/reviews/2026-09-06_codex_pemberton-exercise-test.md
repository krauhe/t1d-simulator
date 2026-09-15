# Study-informed exercise test: Pemberton 2025

> Source-link access update, 2026-09-15: the PMC link below is not fully verified as currently accessible from the local PC. See the [release access check](2026-09-15_codex_release-check.md#external-source-access-status); the earlier archive/retrieval record is retained.

Generated: 2026-09-06

Scope: test the current engine against conditions reported in the short-activity study. No physiological parameters, production files, or public HTML tests changed. This is a sensitivity experiment, not a reconstruction of the study cohort or an individual treatment prediction.

## External reference and endpoints

[Pemberton et al., 2025, DOI 10.1111/dme.70146](https://pmc.ncbi.nlm.nih.gov/articles/PMC12628732/) reports 1546 matched activity/rest periods from 482 people with T1D. Activity lasted 10–30 minutes (median 23); start sensor glucose exceeded 10 mmol/L. The endpoint is activity duration **plus 20 minutes**, not 20 minutes from onset. Mean changes were −2.2 mmol/L with activity and −0.3 without; adjusted difference −1.9 (95% CI −2.1 to −1.8).

Reported starting medians: sensor glucose 11.7 mmol/L, IOB 0.01 U/kg, glucose slope approximately zero. Starting-glucose IQR 10.7–13.1 and IOB IQR 0–0.03 inform the sensitivity grid. IOB was estimated using four-hour linear decay. The study is retrospective, mostly pump-treated; it does not provide a single meal/bolus protocol. Its confidence interval describes an estimated population mean, not an acceptance interval for one fictional character. Timing and count inconsistencies in the paper remain flagged in the preceding review.

Full text archived and locally title/DOI-verified at `docs/references/Pemberton_2025_GlucoseLoweringMatchedPairs.html`.

## Implemented protocol

Test: `tests/exercise-pemberton-review.cjs`.

1. Erik/Eva physiology: 70 kg, ISF 3, ICR 10. Deterministic engine; dawn, insulin variability, sleep disruption and CGM faults disabled. Basal insulin remains present. Activity occurs in daytime. Existing exercise, gut, insulin, renal and counterregulatory mechanisms remain enabled.
2. One bolus at −120 minutes in the main comparison. To match the study's IOB definition, 0.7 U remaining after 120 minutes corresponds to 1.4 U injected: `1.4 × (1 − 120/240) = 0.7`. The engine's native IOB is separately reported: 0.42965 U. Neither number is plasma insulin.
3. **Meal-free preparation:** search initial steady-state BG until sensor glucose at exercise onset is 11.7. This selects an initial condition, not a model parameter. The resulting prior 15-minute sensor slope is −0.03099 mmol/L/min, so this does not reproduce the cohort median flat slope.
4. **Approximately flat pre-activity preparation:** independently solve initial BG and prior carbohydrate quantity for sensor glucose 11.7 and zero net sensor change over the preceding 15 minutes. A synthetic carbohydrate meal starts at −45 minutes and lasts five minutes; 24.36561 g carbohydrate, no protein/fat, mixed-carbohydrate defaults and food mass twice carbohydrate mass. Initial steady BG 13.48866; starting sensor glucose 11.69863, plasma glucose 11.80440, slope −0.00006 and prior-hour five-minute-sampled CV 3.49387%. This is a constructed history, not a meal documented in the study. A flat preceding sensor slope does not imply physiological steady state or a flat subsequent resting trajectory.
5. Clone the complete prepared engine into activity and rest arms. No further food or bolus is given. Start/stop are explicit; stop is automatic after the requested duration. No state reset at exercise onset.
6. Primary output is the continuous noise-free interstitial sensor signal. Report true BG and the actual five-minute-sampled display separately. At minute 43, the display's last sample is three minutes old; treating that sample as a new endpoint would underestimate the effect. This continuous sensor approximation is not a reproduction of the study's device processing.
7. Duration grid 10/15/20/23/30 minutes at low/medium/high cardio. Context grid crosses starting CGM 10.7/11.7/13.1, study-IOB 0/0.01/0.03 U/kg, and bolus age 60/120/180 minutes. Medium mixed/strength included as descriptive checks, not assumed equivalent to the study's activity classifications.

## Main results

All changes below are sensor mmol/L. Negative values indicate falling glucose. Extra effect equals activity endpoint minus the endpoint of its identical resting control.

### 23-minute activity, endpoint at minute 43

| Preparation | Intensity | Activity change | Rest change | Extra activity effect |
|---|---|---:|---:|---:|
| Meal-free, initially falling | Low | −1.553 | −0.922 | −0.631 |
| Meal-free, initially falling | Medium | −2.111 | −0.922 | −1.189 |
| Meal-free, initially falling | High | −2.470 | −0.922 | −1.549 |
| Prior meal, initially approximately flat | Low | +0.246 | +0.917 | −0.671 |
| Prior meal, initially approximately flat | Medium | −0.503 | +0.917 | −1.420 |
| Prior meal, initially approximately flat | High | −1.221 | +0.917 | −2.137 |

The apparent match of the meal-free medium activity's total −2.111 to the paper's total decline is misleading: the resting decline is also greater. The controlled difference, not the total decline alone, is the relevant comparison.

For the approximately flat preparation, high intensity produces an extra effect around the reported group effect, but the resting arm rises as carbohydrate absorption continues. This illustrates why matching start sensor glucose and estimated IOB cannot uniquely reconstruct an entire physiological state.

### Duration sensitivity: extra activity effect

Meal-free preparation, identical onset state for all rows; endpoint is always duration plus 20 minutes.

| Duration, min | Low cardio | Medium cardio | High cardio |
|---:|---:|---:|---:|
| 10 | −0.189 | −0.361 | −0.467 |
| 15 | −0.339 | −0.645 | −0.839 |
| 20 | −0.515 | −0.975 | −1.269 |
| 23 | −0.631 | −1.189 | −1.549 |
| 30 | −0.920 | −1.727 | −2.241 |

Across the achievable 23-minute medium-cardio context grid, extra effects range from −0.943 to −1.665. Six combinations cannot attain the requested elevated sensor glucose from the chosen meal-free history within the bounded initial steady-state search (upper BG 19.5); they are explicitly reported as excluded. This is a limitation of this preparation, not a claim those physiological conditions are impossible with food or other histories. No missing scenario is counted as passed.

At 23 minutes with the main meal-free preparation, medium mixed activity gives −0.607 extra and strength +0.120. These are descriptive; the observational study is not grounds for forcing the simulator's three activity types to have identical responses.

## Verification and traceability

47 paired evaluations completed, including repeated conditions for numerical checks; six preparation exclusions. Technical assertions pass: identical onset measurements after full-state cloning, no instantaneous BG jump at start, exact automatic stop at tested event-aligned time steps, finite Hovorka states, nonnegative glucose compartments.

Medium cardio extra effect at dt 1/0.25/0.125 minutes: −1.21671/−1.19332/−1.18932. Approximately flat preparation at dt 0.25/0.125: −1.42557/−1.42023. Fine-step differences below 0.006 mmol/L; discretisation does not explain the effect-size gap.

| Requirement | Model pathway | Verification | Status |
|---|---|---|---|
| Sensor endpoint after activity | `js/hovorka.js` dC, `ka_int`; engine sensor sampling | Continuous and displayed sensor vs true BG, duration+20 | ⚠️ DELVIST: device processing not replicated |
| Extra effect versus rest | `js/hovorka.js` Q1/Q2, beta·E1 and x1/x2; engine exercise sensitivity and insulin PK | Full-state clone pairs | ✅ FIKSET (test coverage, 2026-09-06) |
| Study IOB definition | Four-hour linear estimator vs native `activeFastInsulin` kinetics | Both reported, no substitution of engine IOB | ⚠️ DELVIST: measured plasma insulin unavailable |
| Short-event numerical integrity | `js/physiology-engine.js` startActivity/stopActivity/step | Event-aligned dt convergence | ✅ FIKSET (test coverage, 2026-09-06) |
| Mechanistic attribution | Contraction uptake, PEIS and PK are separate pathways | Prior `exercise-short-bout-review.cjs` ablations | ⚠️ DELVIST: not identified from this observational endpoint |

Current engine hashes (SHA-256):

```text
js/hovorka.js
ab51b800e151d67624af81801cda9c13a51e6a4de04d40a5a5972ff66416bfab
js/physiology-engine.js
1a2a7664801a25edde0c7f9c619c8f469682c2059672c506b209911bda8fde24
```

Run `tests/.bin/node.exe tests/exercise-pemberton-review.cjs --json` for all per-minute paired traces, onset details, exclusions and hashes. Existing unrelated working-tree edits were preserved. Neither engine file has a working-tree diff.

## Findings and next decision

1. **[OK] Additional activity effect is present.** ✅ FIKSET (test coverage, 2026-09-06). A future change must not assume that the engine only shifts bolus timing; the earlier mechanism ablations also establish a non-PK contribution.
2. **[ADVARSEL] Low/moderate activity is weaker than the aggregate reference in these constructed histories.** ❌ ÅBEN. Moderate 23-minute cardio gives about 1.2–1.4 extra sensor mmol/L versus the reported 1.9 group effect. This is a reason for further investigation, not a defensible universal multiplier or individual pass/fail threshold. Prior meal history, actual workload, population composition and sensor processing are not fully matched.
3. **[NOTE] Full cohort replication remains unavailable.** ⚠️ DELVIST. No participant-level joint distribution or histories were reconstructed; no artificial cohort mean was created by averaging this convenience grid. Technical test success is not physiological validation.

Overall: 0 critical findings, 1 warning, 1 note, 1 confirmed property. Study-informed comparison completed; exact cohort validation and any calibration remain open. Production model unchanged. No commit or push.
