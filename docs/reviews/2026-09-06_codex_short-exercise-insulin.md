# Short exercise, active insulin and additional glucose uptake

> Source-link access update, 2026-09-15: the PMC links below are not fully verified as currently accessible from the local PC. See the [release access check](2026-09-15_codex_release-check.md#external-source-access-status); earlier archive/retrieval records are retained.

Date: 2026-09-06. Reviewer: Codex, using phys-reviewer.
Scope: current local working tree, version 0.9.119-beta, HEAD 5f5ac22 plus existing uncommitted changes. Diagnostic review, not a parameter calibration or a clinical prediction. No production physiology or existing HTML tests changed.

## Conclusion

The model does more than accelerate subcutaneous insulin absorption: contraction removes glucose, and activity also increases insulin-mediated action. Nevertheless, a three-minute bout has almost no additional effect on plasma glucose during those three minutes. Its measurable effect mostly occurs later. The physiological direction is supported by literature; the specific three-minute onset/amplitude is not externally established by the existing tests.

The user's observation is therefore a useful short-bout test hypothesis, not evidence that exercise-mediated uptake is absent, and not a justified universal target of a 3–4 mmol/L fall in three minutes.

## External anchors and applicability

1. **Gao et al. (1994):** anaesthetised rats, electrically stimulated muscle, extremely high insulin (2,635 ± 638 microU/mL). Sarcolemmal GLUT4 increased 70% with insulin, 113% with contractions and 185% with both. This supports additive recruitment, not a universally supra-additive response. These percentages are not transferable to human BG changes. DOI: 10.1152/jappl.1994.77.4.1597. Abstract inspected and archived.
2. **Romeres et al. (2021):** tracer/clamp data from six adults with T1D and six controls, 60 minutes at 65% VO2max under low/high insulin and different glucose conditions. Model selection favoured a near-immediate insulin-independent component plus delayed insulin-dependent enhancement. Estimated T1D increases were 66–82% and 81–155%, respectively. These are model-derived components, not directly counted GLUT4 transporters or single three-minute outcomes. [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/).
3. **Shetty et al. (2021):** nine participants with T1D, 40-minute exercise under high-insulin euglycaemic clamp. Extra glucose infusion requirements were 1.8, 3.0, 4.2 and 3.5 mg/kg/min at 35%, 50%, 65% and 80% VO2peak. This demonstrates increased net glucose requirement beyond resting insulin action, but GIR combines uptake and hepatic output; it does not uniquely identify GLUT4 synergy. Only two completed the full 80% condition. DOI: 10.1210/clinem/dgaa768.
4. **Campbell et al. (2023), SIT-LESS:** 32 adults with T1D; repeated three-minute walking breaks every 30 minutes, not one isolated bout. Total mean glucose across the study observation was 8.2 versus 6.9 mmol/L. Supports short repeated bouts as a meaningful exposure, not an acute 1.3 mmol/L response to each break. DOI: 10.1111/dom.15254.

Insulin and contraction can recruit GLUT4 through partly distinct upstream pathways. Additional muscle glucose uptake is not simply insulin becoming faster. Delivery of glucose and insulin, membrane transport, intracellular metabolism, and hepatic glucose production all matter. Additivity means their increments can sum; synergy in the strict sense requires an interaction exceeding that sum. A BG trajectory alone cannot identify the underlying molecular interaction.

## Traceability

| Claim / target | Implementation and parameter | Evidence / test | Status |
|---|---|---|---|
| Faster insulin appearance during exercise | Heart-rate multiplier on rapid and basal absorption; engine `_substepRapidInsulin`, Hovorka `step` | Matched absorption-ablation below | Present; not the only mechanism |
| Independent contraction uptake | `dQ2 -= beta*E1`; beta 0.78 mmol/min at 70 kg; E1 tau 5 min | Gao mechanism; Romeres independent component; contraction ablation | Present; three-minute kinetics need external testing |
| Additional insulin-mediated response | Activity factor lowers muscle EC50 in `steadyStateActions`; target passed through x1/x2 kinetics | Romeres delayed insulin-dependent response; sensitivity ablation | Present, empirical short-bout calibration open |
| Fast onset | Heart-rate rise half-time 2 min, then E1 tau 5 min, then Q2-to-Q1 exchange | Romeres favours a relatively immediate independent response | Potential serial-delay mismatch, not proven by parameter names alone |
| Fast sensitivity amplitude for short bouts | `sqrt(duration/60)` times activation `1-exp(-age/2)`; high-cardio fast amplitude 1 | Three-minute versus 15/60-minute diagnostic | Strong duration attenuation; no short-bout target identified |
| Exercise effect under unchanged plasma insulin | Same basal plasma insulin clamped in exercise/rest pair | New diagnostic: -0.133 mmol/L at +60 min | Extra effect exists without accelerated absorption |
| Single three-minute skipping bout | No skipping-specific workload or external endpoint | Three-minute high cardio is only a proxy | Not validated |

## Experiments and results

Reproduce with `tests/.bin/node.exe tests/exercise-short-bout-review.cjs`.

Protocol: Erik's existing 70 kg / ISF 3 / ICR 10 profile; exact model initialisation at BG 10 mmol/L at -90 minutes; basal insulin retained; fixed seed; sensor noise, dawn, insulin variability and sleep disruption disabled. No meal. Optional 1 E bolus at -60/-30/0/+30. Activity begins at 0 and auto-stops after three minutes. Follow-up to +120. No BG resets at activity onset. Primary dt = 0.125 minute. Resting control drifts only +0.006 mmol/L over the full 210-minute observation.

All following BG differences are **exercise minus the matched no-exercise run with the same bolus**, not the total fall from starting BG. Negative means lower BG with exercise.

| Three-minute high cardio | At +3 min | +15 min | +30 min | +60 min | +120 min |
|---|---:|---:|---:|---:|---:|
| Basal only, no additional bolus | +0.001 | -0.084 | -0.206 | -0.280 | -0.199 |
| 1 E at -60 min | +0.000 | -0.121 | -0.314 | -0.445 | -0.349 |
| 1 E at -30 min | +0.000 | -0.122 | -0.320 | -0.467 | -0.367 |
| 1 E at 0 | +0.001 | -0.095 | -0.268 | -0.416 | -0.342 |
| 1 E at +30 min | +0.001 | -0.084 | -0.206 | -0.282 | -0.211 |

At -30 timing, IOB at activity onset is 0.726 E and BG is 9.899. BG at the end of activity is 9.866: the approximately 0.033 mmol/L fall is almost entirely already present in the resting bolus comparison. Positive sub-millimolar differences rounded above are effectively zero, not a meaningful initial spike.

At +3 minutes the exercise sensitivity factor is 1.1904. This is a 19% change in the EC50 modifier, **not** a measured 19% increase in actual glucose clearance or BG reduction. `x1` has a 166.7-minute time constant (`1/0.006`), and `x2` 16.7 minutes. This strongly delays the expression of a rapidly changing sensitivity target; it does not imply that insulin has a pure 167-minute dead time.

The three-minute bout's integrated direct contraction sink through +120 is 0.275 g glucose. Q2 remains positive (>25 mmol), so Q2 clipping does not explain the weak response in this protocol. Direct contraction glucose first leaves Q2; its effect on plasma Q1 depends on compartment exchange. High cardio also introduces a small opposing hepatic drive.

### Mechanism ablations, bolus at -30

| Variant | Extra exercise effect at +60, mmol/L |
|---|---:|
| Full model | -0.467 |
| No direct contraction sink | -0.383 |
| No exercise sensitivity modifier | -0.304 |
| No exercise-driven absorption acceleration | -0.192 |

The ablations are local runtime wrappers in the diagnostic script. They preserve the rest of the engine, including heart-rate-dependent contraction input when absorption acceleration is disabled. The differences **must not be added as independent percentage contributions**: this is a nonlinear coupled model.

The four-arm interaction `(bolus+exercise - bolus+rest) - (basal+exercise - basal+rest)` is -0.187 mmol/L at +60; with absorption acceleration disabled it is still -0.059. This establishes a non-PK interaction in this model/context, not a GLUT4-specific measurement.

### Duration, intensity and numerical checks

With bolus at -30 and high cardio, the +60 difference is -0.467 after a three-minute bout, -2.278 after a 15-minute bout, and -5.282 after a 60-minute bout. Longer runs can become hypoglycaemic and recruit counterregulation; they are unmanaged diagnostics, not recommended scenarios.

For three-minute cardio, +60 differences at low/medium/high are -0.182/-0.358/-0.467. Strength and mixed were also run at all three intensities and remained finite. They should not be treated as interchangeable proxies for skipping.

At three-minute duration, dt 1/0.25/0.125 gives +60 differences -0.490/-0.470/-0.467. The qualitative conclusion is stable. Non-binary dt 0.1 causes stop at 3.1 instead of 3.0 minutes in this run (floating-point boundary comparison), with -0.483 at +60. The same extra-step effect occurs at 15 and 60 minutes. No event creates an instantaneous BG jump.

## Findings

1. **[ADVARSEL] Short-bout onset is insufficiently evidenced.** ❌ ÅBEN. Serial heart-rate, E1, compartment and insulin-action kinetics produce almost no additional plasma BG movement in the first three minutes. This is a candidate mismatch for short-bout physiology, not proof that the entire exercise model is wrong. Do not globally raise beta or insulin sensitivity to fit one personal observation: that would also change longer exercise and delayed hypoglycaemia.
2. **[ADVARSEL] HTML comparison does not establish synergy.** ❌ ÅBEN. `tests/model-validation.html` E4 compares bolus timing with 60-minute cardio in every arm. It lacks corresponding non-exercise curves. The separate `tests/exercise-timing-test.html` does have a non-exercise control, but uses ten-minute bouts; its variable named `glut` is an activity-type scaling constant, not measured or modelled surface GLUT4. Neither answers the three-minute question.
3. **[NOTE] Existing automated coverage is broader than E4, but misses this timescale.** ⚠️ DELVIST. `tests/activity-validation.js` includes matched controls, insulin-amplification checks and a 30/60/90-minute context matrix. Current run: 11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL. Its Romeres component decomposition is explicitly NOT TESTABLE, and the known absolute resting GIR mismatch remains PARTIAL. These are not passed clinical validations.
4. **[NOTE] Fractional-step stop boundary.** ❌ ÅBEN. Floating-point time accumulation can extend activity by one integration chunk. Small here, but matters proportionally for very brief exposures. No production fix made in this analysis-only task.
5. **[ADVARSEL] Source attribution in BG-SCIENCE needs correction before further calibration.** ❌ ÅBEN. Section 8 attributes PMC8321821 to “Boiroux & Lichtenstein”; the actual authors are Romeres, Schiavon, Basu, Cobelli, Basu and Dalla Man. PMID 34128839, attached to another exercise citation there, actually identifies a tuberculosis paper. The percentages must be traced to the verified source, not these incorrect bibliographic labels. Existing user edits in BG-SCIENCE were preserved.

## Recommended next revision and acceptance plan

1. Add visible 1/3/5/10/30/60-minute matched-rest experiments, with activity start/end, bolus and meal markers. Include a no-additional-bolus reference without removing basal insulin. Plot first 15 minutes at sufficient resolution plus later follow-up.
2. Add fixed-insulin and preferably glucose-clamp flux experiments at multiple insulin levels. Compare net uptake and hepatic output as well as BG. Keep short-bout independent uptake distinct from delayed insulin-mediated sensitisation. Do not duplicate the sensitivity component already implemented.
3. Check whether contractile drive should follow workload more directly instead of serially following heart rate. Test a candidate with a faster independent uptake onset while preserving mass balance and long-bout integral. Keep chronic insulin-action constants untouched until their separate clamp issue is addressed.
4. Reproduce published protocols before selecting amplitudes: Romeres' low/high insulin comparison, Shetty's resting and incremental GIR, and repeated three-minute walking from SIT-LESS. A meal-free single-bout experiment cannot be calibrated from SIT-LESS's whole-study mean. Add postprandial cases, depleted/replete glycogen, prior exercise, and rising/falling glucose as separate contexts.
5. Before accepting any calibration, require unchanged resting controls, finite/nonnegative compartments, convergence with event-aligned step sizes, continuous automatic/manual stopping, no artificial effect switched on at stopping, and protection of established strength/mixed and delayed-response checks. Record literature population/protocol/endpoint and uncertainty beside every numerical assertion.

### User clarification and late-bolus follow-up

The user clarified that the observation is **2–3 mmol/L on CGM within approximately 15 minutes**, following three minutes of hard cardio (or approximately 15 minutes of vacuuming), after a bolus has produced an insufficient glucose fall and its plasma concentration is expected to be declining. This is not a claim of a three-minute plasma glucose fall. The intended comparison is the rapid effect of movement using the existing physiological state versus the slower response to a new bolus. The user's plasma insulin is estimated, not measured.

The diagnostic now also tests 1 E at -60/-120/-180/-240/-300, with a shared -330-minute start and three/four-minute high-cardio bouts. It records both pre-exercise BG slope and CGM. No meal is included, so this is a late-bolus mechanism probe, not a reconstruction of the user's experience.

At -240 timing, pre-exercise BG is essentially flat (+0.00089 mmol/L over the preceding ten minutes), plasma insulin is 7.12 mU/L and IOB 0.059 E. At +15, three-minute cardio gives an extra plasma reduction of only 0.078 mmol/L; four minutes gives 0.110. For the four-minute bout, the continuous interstitial difference is 0.030 mmol/L; the latest displayed CGM difference is 0.008, with that sample 4.875 minutes old because of the five-minute sampling gate. Sensor noise is off; physiological interstitial delay remains active (`ka_int = 0.073/min`, time constant 13.7 minutes). These CGM numbers describe this model's filter, not a universal real-sensor delay.

A flat glucose trajectory means net appearance and disappearance are approximately balanced; it does not establish that insulin is absent or inactive. Exercise can increase disappearance while existing insulin still suppresses production and supports uptake. A delayed CGM signal cannot uniquely identify onset or the counterfactual no-exercise trajectory. The model does not reproduce the reported rapid magnitude in these controlled late-bolus cases. This supports investigating short-bout kinetics, but not imposing the reported personal amplitude as a universal calibration. The 15-minute vacuuming alternative and a meal-matched reconstruction remain untested here.

### Closer clinical evidence identified on follow-up

Follow-up testing completed in [Pemberton study-informed comparison](2026-09-06_codex_pemberton-exercise-test.md): 47 paired evaluations, six explicit preparation exclusions; no production calibration. This does not close the separate three-minute evidence gap.

**STATUS: ⚠️ DELVIST — supports the phenomenon, not the three-minute target.**

[Pemberton et al. (2025), DOI 10.1111/dme.70146](https://pmc.ncbi.nlm.nih.gov/articles/PMC12628732/): retrospective within-person matching; 482 participants, 1546 bouts, 10–30 minutes, median 23. Sensor glucose fell 2.2 mmol/L versus 0.3 at rest; adjusted difference −1.9 (95% CI −2.1 to −1.8). Endpoint: **20 minutes after activity**, not 20 minutes after onset. Higher estimated IOB predicted greater lowering. Residual confounding and simplified IOB remain limitations. Methods and discussion differ in timing claims; section 3.6 also contains inconsistent event counts.

This is a closer literature anchor than prolonged clamp experiments, but not a direct test of three-minute skipping or a GLUT4 interaction measurement. Reproduce its observation window and physiological context before considering calibration. The user's experience remains hypothesis-generating, not a numerical acceptance criterion. Check reporting inconsistencies against supplementary data before adopting exact targets.

Full text locally verified (HTTP 200, matching title/DOI) and archived as `docs/references/Pemberton_2025_GlucoseLoweringMatchedPairs.html`. The PDF endpoint returned a browser-challenge HTML document; that invalid download was removed, not retained as a PDF. No production model changes.

## Files and source verification

1. `js/hovorka.js`: 116 (x1 kinetics), 143 (muscle EC50), 184 (beta), 421–452 (sensitivity coupling), 496 (absorption multiplier), 631–642 (Q1/Q2 balance), 661–677 (action and E1/E2 kinetics).
2. `js/physiology-engine.js`: 188–195 (response amplitudes), 1680–1750 (heart rate and contractile input), 2055 (rapid PK multiplier), 2622–2715 (sensitivity response), 3580–3603 (plasma insulin clamp).
3. `tests/model-validation.html`: 3476 onwards (exercise chapter), 3970 onwards (E4). `tests/exercise-timing-test.html`: 141–230 (ten-minute protocol), 196 and 345 (GLUT4-labelled surrogate).
4. `tests/activity-validation.js`: 42 (30/60/90-minute matrix), 610 onwards (insulin comparisons). `tests/fixtures/activity-literature-targets.json`: existing frozen targets were not modified.
5. New `tests/exercise-short-bout-review.cjs`: all new reproducible diagnostics. No browser rendering was tested; both HTML files were inspected as source.
6. Local full-text archive: `docs/references/Romeres_2021_ExerciseInsulinDependentIndependent.html`. Retrieved from the concrete PMC URL on this PC, HTTP 200, title and main-text protocol checked.
7. Local abstract archives: `Gao_1994_GLUT4_Additivity_Abstract.json`, `Campbell_2023_SIT_LESS_Abstract.json`, `Shetty_2021_ExerciseIntensity_Abstract.json` in `docs/references/`. Retrieved from Europe PMC's core-record API with `EXT_ID:<PMID> AND SRC:MED`; HTTP 200 and titles/DOIs checked. Original PubMed pages returned a challenge, and Wiley/OUP returned HTTP 403 locally. Those full-text/landing links are therefore **not fully verified locally**. Shetty full text was readable through web retrieval; Campbell findings used here are supported by its verified abstract. No inaccessible full text is claimed as downloaded.

Overall status: **PARTIAL — extra effect verified, short-bout calibration open.** Production changes: none. Added diagnostic and review plus reference downloads only. No commit or push.
