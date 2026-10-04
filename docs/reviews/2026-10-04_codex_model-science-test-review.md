# Implementation, physiological evidence and validation coverage: T1D Simulator

Date: 4 October 2026. Reviewed working tree: `4ca3d73`, version `0.9.126-beta`, including the revised `BG-SCIENCE.md` (`2026-10-04-v1`). This was an audit, not a model-repair task. Existing uncommitted changes were preserved.

## Principal findings

The simulator has substantial automated coverage, particularly for activity, engine–facade consistency, insulin bookkeeping and sensor behaviour. It is not, however, quantitatively validated across all implemented physiological mechanisms. Several tests confirm a chosen implementation or reproduce a calibration scenario rather than test an independent physiological prediction.

Two reproducible conservation defects deserve priority: contraction-mediated uptake becomes unrealised when the peripheral glucose compartment empties, and rapid-insulin depots lose their remaining mass at six hours. The revised science reference also no longer supports several claims still presented as established physiology in the implementation description: a small-bolus insulin “dead zone”, a specific protein-to-glucagon explanation for the observed meal response, and the numerical partition of dietary fat into ketogenesis.

The HTML validation page is broad but insufficient as a validation report. It completed 51 sections with one execution error and warnings in three other sections. One recovery warning is itself a test-analysis error. A completed page or successful regression command must not be read as scientific approval.

Finding totals at the audit baseline: **2 CRITICAL, 10 WARNING, 3 NOTE; initially all 15 open.** The follow-up adds F15 and extends F13. Severity refers to modelling or validation integrity, not an estimate of clinical harm. Original measurements below describe that baseline; dated STATUS annotations record subsequent repairs. Current status: **9 fixed, 5 partial, 1 open**. See the [repair decision record](2026-10-04_model-review-fixes.md).

## Scope and verification

The physiological owner is now `js/physiology-engine.js`; `js/simulator.js` supplies the game-facing facade, intervention dispatch and post-processing. Reviewing only the latter would miss most active mechanisms. The audit followed the Hovorka state equations, engine substeps, intervention methods, parameter definitions, relevant facade paths, `MODEL-IMPLEMENTATION.md`, the corresponding revised BG Science sections, and the HTML/Node test suites. UI rendering and unrelated game logic were not exhaustively reviewed.

The review distinguished literature endpoints (L), mathematical/mechanistic checks (M), and regression checks (R). It did not assume that BG Science, the review skill, code comments or another model were authoritative sources. Primary-source checks were targeted, not a new systematic search of every physiological topic.

Notation: BG, blood glucose; ISF, insulin sensitivity factor (mmol/L per unit of insulin); ICR, insulin-to-carbohydrate ratio (g per unit); EGP, endogenous glucose production; Rd, glucose disappearance rate; GIR, glucose infusion rate; SC, subcutaneous; IOB, insulin on board; FFA, free fatty acids; BHB, β-hydroxybutyrate; DKA, diabetic ketoacidosis; PEIS, post-exercise insulin sensitivity; HAAF, hypoglycaemia-associated autonomic failure; CGM, continuous glucose monitoring. Q1 and Q2 are model glucose amounts, not concentrations. In the coverage table, CHO denotes carbohydrate and AA denotes amino acids. EC50 is the concentration producing half-maximal effect; SEM is the standard error of the mean.

### Executed checks

| Check | Result | What the result establishes |
|---|---|---|
| `tests/run-physiology-regression.js` | Exit 0 | The runner's existing failure conditions were not triggered; it permits scientific PARTIAL results. |
| Engine API | 34/34 | Input contracts, state handling, selected boundaries and sensor behaviour. |
| Golden master | 7/7 | Agreement with frozen internal outputs. |
| “Clinical equivalence” | 8/8 | Agreement with a frozen simulation baseline within selected tolerances; **not** equivalence to clinical observations. |
| Standalone–facade parity | 10/10 | The standalone engine reproduces the game facade in the selected scenarios. |
| Simulation suite | 197/197 | Existing assertions pass; their scientific interpretation still depends on the endpoint and comparator. |
| Activity validation | 11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL | Includes 486 finite context scenarios; absolute clamp calibration and several protocol features remain unresolved. |
| `tests/model-validation.html`, installed Chrome | 51 sections; C.3 execution error; warnings in G.5, I.6 and K.3 | Actual browser execution, not a source-only inspection. The unrelated favicon request returned 404. |
| New diagnostic probes | Reproducible results below | Conservation, expiry, reinitialisation, intake boundaries, percentage denominators and selected numerical convergence. |

The [diagnostic script](2026-10-04_model-review-probes.cjs) runs unchanged model code. It is not an acceptance suite: several experiments deliberately expose failures and therefore report measurements rather than make the process fail. Private complete logs, source images, browser results and Gemini packets are retained under `tests/playwright/2026-10-04-model-review/`.

## Located findings

### F01 — CRITICAL: contraction uptake exceeds the glucose available to its compartment

Location: `js/hovorka.js:630–644, 717–726`; engine exercise input at `js/physiology-engine.js:1724–1755`.

The peripheral balance is `dQ2/dt = x1·Q1 − k12·Q2 − x2·Q2 − β·E1`. The last term remains a positive disposal rate when Q2 is empty. Negative updated states are subsequently clamped to zero. Consequently, the reported sink and the realised mass change disagree. At zero insulin action, the model also lacks a contraction-mediated route from plasma Q1 to replenish Q2: its nominally insulin-independent uptake is limited by insulin-dependent transport.

In a deliberately insulin-free boundary state, 70 kg, initial BG 5.5 mmol/L, 60 minutes of high cardio, the glucose-balance residual was +58.54 mmol (10.55 g) at a 1-minute step and +57.71 mmol (10.40 g) at 0.1 minute. Q2 repeatedly reached zero. The matched basal-insulin condition conserved the traced glucose to floating-point precision. This is not merely coarse integration, and it does not mean that the stored Q2 actually becomes negative: the clamp hides the invalid attempted flux.

Required resolution: define substrate-limited realised contraction uptake and its transport coupling, then check the combined Q1/Q2 balance. Merely deleting the non-negativity clamp or subtracting the missing sink arbitrarily from Q1 would not constitute a validated repair. Acceptance tests should cover normal, low-insulin and depleted-Q2 states, exercise ablation and onset/offset at multiple actual substep sizes.

STATUS: ❌ ÅBEN (2026-10-04). Structural transport/substrate-limitation choice deferred by the user. The unchanged diagnostic still shows a 10.40 g residual at dt=0.1 min.

### F02 — CRITICAL: six-hour bolus cleanup destroys residual insulin

Location: `js/physiology-engine.js:1560–1624, 1765–1777`; per-bolus absorption in `_substepRapidInsulin`.

`_prepInsulinRates` removes boluses at age 360 minutes, irrespective of their remaining `s1+s2`. Aggregate rapid compartments are then reconstructed from retained boluses. The removed mass is neither absorbed nor assigned to a documented elimination process.

| Injected dose | Absorption time constant | Effective dose after bioavailability | Unaccounted depot mass at 360 min, dt=1 | dt=0.5 |
|---|---:|---:|---:|---:|
| 10 U | 55 min | 7.8 U | 0.082 U | 0.083 U |
| 10 U | 88 min, an allowed slow-absorption value | 7.8 U | 0.661 U | 0.662 U |

The second case loses approximately 8.5% of bioavailable insulin. This is a dynamical tail truncation, not just removal of an old graph marker.

Required resolution: retain absorption state until its remaining mass is negligible under a stated tolerance, or transfer it to a conserved residual compartment. Test total injected, unavailable, absorbed and remaining mass across the expiry boundary, including slow absorption, stacking and exercise-accelerated absorption. Display-history retention should be independent of physiological retention.

STATUS: ✅ FIKSET (2026-10-04, working tree). Retain depots beyond 360 min until below 10^-6 mU; preserve IOB scaling. Mass balance passes at dt=1/0.5 min, including stacked doses, accelerated absorption and eventual cleanup.

### F03 — WARNING: the insulin “dead zone” is overinterpreted, and sustained action remains miscalibrated

Location: `js/hovorka.js:120–150, 436–451`; `MODEL-IMPLEMENTATION.md:527–574`; HTML K.1–K.5; `tests/insulin-clamp-validation.js`.

[Rizza et al. (1981)](#references) studied sequential insulin clamps in 15 healthy participants. Different half-maximal concentrations for suppression of production and stimulation of utilisation do not establish a small-injection threshold in T1D, nor identify the simulator's Hill coefficient of 1.5. The revised BG Science §25 correctly separates these claims. The implementation still states that small corrections leave BG almost unchanged until a muscle threshold is crossed.

The current K.1 output is particularly instructive: 1 U lowers BG by 2.93 mmol/L relative to its rising no-bolus control, whereas 2 U lowers it by 6.1 mmol/L. Calling the first response a dead zone because final BG is still above its initial value confuses background glucose drift with incremental insulin efficacy. These results do not demonstrate negligible low-dose action.

There is also a separate, already acknowledged quantitative discrepancy. At BG 5.5 mmol/L and the reference ISF of 3 mmol/L/U, predicted resting glucose infusion rates are 11.90, 14.50 and 20.85 mg/kg/min at insulin concentrations of 50, 60 and 92 mU/L. [Shetty et al. (2021)](#references) reported 4.4 ± 0.4 mg/kg/min (mean ± standard error) while targeting 300–550 pmol/L insulin. The model is above the selected mean ± 2 SEM interval throughout this represented range. Participants' individual correction factors are unavailable, so this does not prove that every virtual phenotype is wrong or justify fitting ISF alone to 4.4.

Required resolution: jointly assess transient bolus effects and sustained clamp fluxes. Relabel the low-dose experiments as model dose-response tests; retain the no-bolus comparator and report incremental effect per unit. The clamp diagnostic's status predicate also needs a genuine overlap check: `not all above` currently implies PASS even if every future result were below the target interval.

STATUS: ⚠️ DELVIST (2026-10-04). K.1/K.2/K.4/K.5 and implementation prose now distinguish control-adjusted response from a hypothesised threshold. Clamp status requires a sampled value inside the target interval. Joint bolus/clamp calibration remains open.

### F04 — WARNING: ketone calibration combines incompatible endpoints and an artificial withdrawal protocol

Location: engine ketone constants `js/physiology-engine.js:558–578`, `_substepKetones:1988–2093`, acidosis logic `1856–1909`; implementation §11; HTML I.5–I.6 (`5627–5747`).

I.6 does not simulate interruption of an actual pump or omission of an injection. It instantaneously deletes all insulin depots, plasma insulin and insulin-action states. The simulator explicitly has no pump model. This is a useful extreme zero-insulin experiment, but not a faithful pump-occlusion protocol: stopping delivery leaves previously administered insulin and its effects in the body.

In the browser, I.6 produced BHB 1.82, 3.22 and 4.37 mmol/L at 4, 8 and 12 hours after that reset. The page accepts the early result against a range widened to accommodate its own scenario and labels BHB exceeding 3 mmol/L as DKA. [Umpierrez et al. (2024)](#references) require metabolic acidosis as well as the relevant diabetes/glucose and ketone criteria. Neither BHB alone nor the game's arbitrary accumulated-acidosis score is a measured pH or bicarbonate endpoint. The displayed ramp explanation also says the lipolysis-pool half-life is 180 minutes; code uses 120 minutes.

The dietary-fat coefficient has a further provenance problem. Implementation §11 relates `BHB_DIET_FAT_FRAC=0.35` to hepatic dietary-fat uptake and a unit conversion, citing liver-triglyceride source studies. Revised BG Science §23 explicitly rejects deriving a T1D ketogenic source fraction from those measurements. The code adds gram-scale `ffaBlood` to an arbitrary-scale lipolysis pool: the coefficient is an effective empirical mapping, not a dimensionless measured hepatic fraction. Likewise, healthy-participant lipolysis EC50 values cannot identify a universal plasma-insulin threshold for DKA.

Required resolution: separate complete insulin removal, retained-depot interruption and missed basal-dose protocols; label the first honestly. Maintain distinct targets for ketone concentration, production/clearance, and clinical acid–base diagnosis. Describe the fat coefficient and acidosis gate as heuristics until protocol-matched evidence supports them. Reproducing a previously fitted BHB trace is calibration, not independent validation.

STATUS: ⚠️ DELVIST (2026-10-04). I.6 is labelled state ablation, unsupported clinical pass criteria removed, the 120-minute parameter read from code, and BHB distinguished from DKA. Dietary-fat mapping is identified as phenomenological. Matched interruption protocols and ketone/acid–base calibration remain open.

### F05 — WARNING: the protein endpoint is not the claimed timing or mechanism

Location: `MODEL-IMPLEMENTATION.md:1064–1085, 1181–1206`; engine `_substepFatProteinFFA`; HTML G.1 and C.6.

[Paterson et al. (2016)](#references) reported the often-cited +1.65 mmol/L as the 75 g protein versus water difference during 240–300 minutes, with glucose still rising late in observation. The study does not establish a universal peak at 150–180 minutes. Its protocol involved protein drinks without an additional bolus, not the absence of basal insulin; “75 g protein (no insulin)” is therefore an inadequate comparator description. Nor can the glucose response alone identify what proportion was caused by glucagon versus substrate-derived gluconeogenesis.

The implementation currently assigns the dominant pathway to glucagon-driven hepatic output and calls the profile calibrated to Paterson. The browser's G.1 instead compares 60 g protein with 15 g carbohydrate, reports the time of maximum BG slope, and infers an approximately 90-minute onset from that slope maximum. Maximum slope, onset, peak concentration and a late comparator-adjusted mean are different endpoints. This test cannot validate the stated clinical correspondence.

Required resolution: reproduce the actual source's meal, background insulin, water comparator and measurement windows. Test both isolated protein and mixed meals; keep gastric transit, amino-acid appearance and glucagon gain distinguishable. Present the selected pathway as an implementation hypothesis, not a causal partition established by the glucose trial.

STATUS: ⚠️ DELVIST (2026-10-04). Corrected Paterson's comparator, background basal insulin and 240–300 min endpoint; removed the inference of onset from peak slope. Selected protein-to-glucagon routing is labelled a model hypothesis. Protocol-matched quantitative validation remains open.

### F06 — WARNING: glycogen pools are capacity proxies, not substrate-constrained tissue balances

Location: `js/physiology-engine.js:1913–1985, 2347–2478`; implementation §6 muscle pool and §7 hepatic capacity; HTML I.5.

The hepatic capacity limitation is now explicitly documented: exercise-related depletion and high-BG replenishment do not form a complete balance with plasma Q1. That declaration is appropriate and should not be mistaken for a newly discovered missing Q1 subtraction.

The muscle description is less precise. It calls replenishment a destination for glucose uptake already represented by x1/x2/E1, but the replenishment rate is not bounded by those fluxes. An isolated, deliberately depleted post-exercise pool at BG 6 mmol/L, with x1=x2=x3=E1=0, gains 0.8 g in one minute. A comment permits other substrates such as lactate, but no precursor budget represents them. This can be a capacity heuristic; it cannot demonstrate a quantified allocation of traced glucose uptake.

The fasting illustration also merits attention: I.5 ends its 72-hour fast with the liver pool at its 120 g ceiling and still prints favourable ketone checks. This reflects the capacity-refill rules and fixed basal scenario, not independent evidence that the physiological glycogen trajectory is credible. Changing the wording alone would not validate its downstream effect on simulated glucagon rescue.

Required resolution: define which pools are estimated capacities and which are conserved masses. Add a long-fast/refeeding validation with protocol-matched evidence, inspect downstream rescue responses, and audit glucose allocation if tissue mass balance is intended. Do not reintroduce an additional plasma drain without first avoiding double-counting.

STATUS: ⚠️ DELVIST (2026-10-04). Both pools are described as capacity proxies, unsupported muscle-allocation wording removed, and the 72-hour fasting discrepancy is visible. Conserved tissue balances and their downstream rescue/PEIS consequences require a separate model choice.

### F07 — WARNING: resistance multipliers are confused with reductions in sensitivity

Location: `js/physiology-engine.js:590–616, 1786–1821, 2734–2763`; implementation FFA summary/parameter table; HTML H.3.

When sensitivity is divided by a resistance factor R, its fractional reduction is `1−1/R`, not `R−1`.

| Model quantity | Actual interpretation | Incorrect wording still present |
|---|---|---|
| FFA ceiling R=1.42 | 29.6% reduction in sensitivity | “Max 42% ISF reduction” |
| Glucotoxicity ceiling R=1.40 | 28.6% reduction in sensitivity | “Max 40% ISF reduction” |
| 24 h at BG 20 mmol/L: R=1.221 | 18.1% reduction in sensitivity | Code calibration comment: approximately 26% reduction |

H.3 correctly prints 18.1% in its table but declares agreement with its calibration range by testing the multiplier instead. [Wolpert et al. (2013)](#references) measured increased insulin requirements after a higher-fat meal, not a 42% isolated sensitivity reduction or the simulator's gram-scale FFA response. Different meal processes contributed to the observed outcome. BG Science §26 also identifies unresolved source-level limitations for the inherited glucotoxicity number; it must not become a fit target merely because it appears in an old comment.

Required resolution: choose and name the endpoint consistently in code comments, docs and assertions. Verify any replacement physiological target before recalibrating. Do not mechanically replace 0.42 with a larger coefficient to make the label true.

STATUS: ✅ FIKSET (2026-10-04, working tree). Comments, implementation and H.3 distinguish R from 1−1/R. H.3 checks the configured equation rather than claiming clinical calibration. No resistance coefficient changed.

### F08 — WARNING: the HTML suite has a broken section and no truthful aggregate verdict

Location: `tests/model-validation.html:1004–1006, 2464–2469, 6381–6427`; `js/foods.js:210–216`.

C.3 still requests `validationFood('æg', 'Egg')`, but that standalone food no longer exists. Accessing its icon throws; the current catalogue includes Greek yoghurt instead. The runner catches the error, displays it within the section, then unconditionally ends with “51 test sections completed”. The Node regression runner does not execute this HTML page, so its green result misses the failure.

Required resolution: make the preset selection follow current identifiers, assert that every requested fixture exists, and expose structured section-level execution and validation states. A browser smoke test should fail on an uncaught section error. Keep scientific PARTIAL/NOT TESTABLE separate from software failure; do not silently count any of these as PASS.

STATUS: ✅ FIKSET (2026-10-04, working tree). Replaced obsolete egg references consistently; unknown food keys fail clearly. Structured section/aggregate status distinguishes execution, failed checks, warnings and descriptive output. Browser: 51 sections, zero execution errors; injected missing-key fault gives exactly one error. J.1–J.3 use explicit distinct seeds and reproduce across both runs; this fixes repeatability, not distributional validation (see decision record).

### F09 — WARNING: the liver-recovery test reports zero elapsed time as failure to recover

Location: `tests/model-validation.html:4835–4930` (G.5).

The current run starts both sampled curves at 92.5 g while `refillTarget=65`. `findRefillTime` therefore returns zero. The renderer and success predicates require `t>0`, so zero is printed as “>12 h”. This is not evidence of slow replenishment. The test sets the pool to 65 g before 30 minutes of intervening simulation, not at the start of a confirmed depleted recovery phase.

Required resolution: define recovery after the post-glucagon nadir or another explicitly depleted state; record the actual pre-intervention target and separate initial-state failure, already-at-target, recovered and not-recovered. Then reassess the expected 4–8 h recovery range against its cited protocol. Merely changing `>` to `>=` would correct display arithmetic but leave an invalid recovery experiment.

STATUS: ✅ FIKSET (2026-10-04, working tree). Set 65 g immediately before glucagon; require observed depletion before recovery. Distinguish no depletion from no recovery, and preserve an observed first recovery despite later depletion. Corrected experiment gives 1.2 h with meals and no return within 12 h fasting; unsupported clinical time targets removed.

### F10 — WARNING: steady-state reinitialisation can inherit a phantom rapid-insulin input

Location: `js/hovorka.js:271–288`; engine `initSteadyState:817–827`.

`initializeSteadyState` clears the state vector and ordinary insulin/carbohydrate inputs but not cached `rapidU_I`. A retained value is therefore supplied throughout its 2000-minute basal search. With the reference 70 kg profile, the basal solution changes from 9.363 to 6.353 mU/min when stale rapid input is 3 mU/min; at 10 mU/min, the search throws an unreachable-target error.

Fresh construction sets this input to zero, so the experiment does not establish a normal-startup failure. It establishes a reused-model/API precondition defect. The existing tests cover fresh steady-state searches and bounds, not this history-dependent call.

Required resolution: define whether reinitialisation resets all exogenous inputs and modifiers or rejects a non-fresh state. Test reinitialisation after bolus, exercise and meal histories against a new-model reference. Do not assume that changing a live player's profile currently invokes this path; no such gameplay call was demonstrated.

STATUS: ✅ FIKSET (2026-10-04, working tree). Reset rapidU_I inside the steady-state search. Prior inputs 0/3/10 mU/min now give the same basal rate, 9.362958 mU/min.

### F11 — WARNING: the accepted long-intake API silently omits part of carbohydrate delivery

Location: `js/physiology-engine.js:1640–1675, 3179–3248`.

The food API permits `eatTimeMin` up to 600 minutes, but `activeFood` is removed at age 360 minutes while the separate physical-intake queue continues. A 60 g carbohydrate intake spread over 600 minutes delivers only 36 g when integrated plasma appearance and retained D1/D2 mass are added. Results are identical at 1- and 0.5-minute steps. A normal ten-minute intake accounts for all 60 g.

This is an accepted API boundary defect, not a claim that ordinary food presets lose 40% of their carbohydrates. Their intake durations are much shorter.

Required resolution: retain the delivery entry until its intake is complete, or narrow and document the accepted duration. Test intake mass at 359/360/361 minutes, completion and overlapping meals; check the separate calorie and protein/fat bookkeeping.

STATUS: ✅ FIKSET (2026-10-04, working tree). Retain the food delivery schedule through eatingDuration. At 600 min intake, all 60 g are accounted for instead of 36 g; dt=1/0.5 min and 10/360/600 min intake tested.

### F12 — NOTE: low-BG exercise throttling is only partly coupled to the rest of the session

Location: `js/physiology-engine.js:1702–1755, 1917–1985, 2630–2745`; implementation §6 heart-rate description.

Below BG 3.5 mmol/L, the target heart-rate excess is multiplied by `(BG−1.5)/2`, with a floor of 0.05. This lowers contraction input and changes insulin perfusion after heart-rate smoothing. Calorie expenditure, glycogen-use rates and duration-based post-exercise sensitivity are not reduced by that same factor. The description mentions heart-rate smoothing but omits this capacity rule.

Required resolution: document the rule as a modelling choice and test its coupled consequences. If it represents reduced performed work, workload-dependent expenditure and adaptation need a consistent interpretation. If it represents only one physiological response, supporting evidence is needed. The initial Gemini claim that all exercise effects fall by 95% was incorrect.

STATUS: ⚠️ DELVIST (2026-10-04). Implementation scope now explicitly identifies which activity pathways the low-BG heart-rate throttle does and does not affect. Whether to couple the remaining outputs is deferred with the structural activity revision.

### F13 — NOTE: several equations, units and visual explanations lag behind the science or code

1. **EGP0 is not observed basal T1D production.** `MODEL-IMPLEMENTATION.md:385–390` describes 0.0161 mmol/kg/min as measured basal EGP and a characteristic T1D elevation. Hovorka's original Table 2 defines it as production extrapolated to **zero insulin**. The realised output additionally depends on insulin and the extension multipliers. Revised BG Science §2 also distinguishes systemic endogenous production from strictly hepatic production.
2. **F01 conversion is wrong.** At `MODEL-IMPLEMENTATION.md:392`, 0.0097 mmol/kg/min equals 9.7, not 14, µmol/kg/min. The approximately 176 g/day calculation at 70 kg is consistent with 9.7. F01 includes non-brain tissues, whereas the separate brain-deficit score uses the complete F01 as a proxy.
3. **Carbohydrate bioavailability needs an explicit adaptation rationale.** Original Hovorka Table 1 has AG=0.8, cited to Livesey, for systemic carbohydrate appearance. Current code uses AG=1.0. European digestible-carbohydrate labels alone do not establish complete systemic glucose appearance, and the implementation's statement that first-pass effects are absorbed into AG conflicts with its present value. The original paper does not give the code comment's UK-fibre explanation. Retain this as an adaptation requiring meal validation, not as a faithful original constant.
4. **Insulin variability descriptions disagree.** Implementation §4 describes a random bioavailable fraction per injection; the engine fixes it at 0.78 for rapid and 0.82 for basal insulin and varies absorption timing. §13 is closer to the code. Likewise, the generic linear x1/x2 equations need qualification now that muscle targets are Hill functions.
5. **K.3's graph gap is not its M-value.** The table correctly calculates glucose infusion as Rd−EGP. Plotting +EGP and −Rd makes the vertical distance Rd+EGP. Near basal insulin, EGP≈Rd and required infusion≈0 despite a large visual gap. Plot both unsigned fluxes on the same axis or show net infusion explicitly.
6. **Time constants and comments need arithmetic checks.** `ka_int=0.073/min` gives a 13.7-minute time constant; a sustained ramp tends to that lag before additional sampling effects, not a universal 5–10 minutes. The acute-stress comment at engine line 2286 says BG 3.5 reaches the 0.4 cap in 89 minutes but ignores washout: the continuous asymptote is 0.3895 and a 600-minute discrete test gives 0.3914. This is an acute-stress comment error, not a HAAF-equation defect.
7. **The fixed counterregulatory phenotype is presented too generally.** Gemini's earlier suggestion to distinguish disease duration exposes a documentation discrepancy: implementation lines 2036–2076 describe a progressive, irreversible loss of hypoglycaemic glucagon responses and use this to explain the fixed acute-stress ceiling of 0.4. Revised BG Science §§2,4,11 instead distinguishes stimulus, individual response and antecedent hypoglycaemia; it does not identify this numerical ceiling or a universal time since diagnosis. The engine (`2258–2301`) has a lumped response with HAAF, not separate endogenous glucagon, residual β-cell secretion and disease-duration models. First describe the chosen fictional phenotype and heuristic ceiling accurately. Adding a honeymoon model would be a separate extension; diagnosis date alone is not a validated parameterisation.
8. **SGLT2-associated euglycaemic DKA is not validated by glucose-independent ketogenesis.** Implementation lines 3265–3266 say that euglycaemic DKA, including an SGLT2-inhibitor example, would emerge naturally. The current renal model has no drug-specific glucose transport effect, and the acidosis score is not blood pH or bicarbonate. Revised BG Science §23 already covers euglycaemic DKA and SGLT2 exposure; the remaining discrepancy is the implementation's generalisation, not a missing scientific heading. Keep the pharmacological scenario outside the validated scope. This supplements F04, not a request to implement medication effects.

Required resolution: reconcile the description with executable equations and distinguish original constants, adaptations and scenario calibrations. No physiological parameter should change merely to match an outdated explanation.

STATUS: ✅ FIKSET (2026-10-04, working tree). Corrected the eight listed description/arithmetic discrepancies: EGP0, F01, AG adaptation, fixed bioavailability/Hill targets, clamp plot, filter/stress timing, selected counterregulatory phenotype and SGLT2 scope. This does not validate unchanged parameters or historical figures.

### F14 — NOTE: the review skill itself retains outdated scientific shortcuts

Location: `.agents/skills/review/SKILL.md`, domain-knowledge section, particularly lines 361–382 and 418–470.

The workflow correctly requires original-source checking, traceability, ablation and convergence. Its embedded domain summary nevertheless repeats several propositions now qualified in BG Science: fixed absorption percentages, protein peaking at 150–180 minutes, uniform morning sensitivity, and an unqualified glucotoxicity target. These could lead later reviews to certify the same assumptions they should test. Some nominal “always” sanity ranges also conflate states and populations.

Required resolution: retain the workflow, but replace unqualified physiological constants with links to appraised, protocol-specific source records and distinguish heuristic defaults. The present audit treated this summary as a list of questions, not as evidence. The skill has not been edited in this review task.

STATUS: ✅ FIKSET (2026-10-04, working tree). Skill now requires protocol-specific targets and original-source appraisal rather than universal shortcuts; added conservation checks and corrected Euler stability dimensions. Skill validator passes.

### F15 — WARNING: the existing causal display does not represent a glucose balance

Location: `js/physiology-engine.js:3045–3155`, especially `3104–3123`; `js/ui.js:4727–4735, 4817–4823`; `tests/simulation.test.js:2811–2931`.

The earlier Gemini report proposes a new flux display, but `_computeBGForces()` already supplies the effects panel. Its quantities mix realised fluxes and attributed effects. The insulin entry adds net Q1-to-Q2 transport, peripheral disposal and suppression of EGP, while the upward EGP entry already contains that suppression. In a Q1 balance, peripheral disposal is not an additional direct plasma drain; in a total Q1+Q2 balance, transport cancels. Adding both, together with already-accounted hepatic suppression, does not give either balance.

The diagnostic script's basal-only, 70 kg, near-steady-state case gives:

| Quantity | Result |
|---|---:|
| BG before and after one minute | 5.499976 → 5.499941 mmol/L |
| Actual Q1 change during that minute | −0.000390 mmol |
| EGP shown as upward flux | +0.748320 mmol/min |
| F01c shown as downward flux | −0.675927 mmol/min |
| Combined basal-insulin entry | −0.524373 mmol/min |
| Signed sum of entries labelled `flux` | −0.451980 mmol/min |

The additional insulin terms include 0.072911 mmol/min peripheral disposal and 0.378680 mmol/min hepatic suppression. Thus a nearly balanced model produces a markedly unbalanced display dataset. This is a diagnostic of the panel's input and arithmetic, not a newly captured browser screenshot. It does not alter the integrated glucose trajectory.

Existing tests check structure, sorting and relative basal/bolus attribution; they do not assert agreement with the integrated balance. The UI comment nevertheless says the visual weight matches actual BG direction. Magnitude thresholds and the five-row selection also prevent the displayed subset from serving as a complete balance.

Required resolution: choose either a signed Q1 or Q1+Q2 flux accounting, or explicitly separate causal attribution from physical fluxes. Do not stack insulin-mediated suppression on top of already-suppressed EGP as another realised sink. Add a near-steady-state balance test and dynamic meal/bolus/exercise cases, with consistent sampling time and explicit treatment of omitted terms. Changes belong to the explanatory display, not an unmotivated retuning of the physiological ODEs.

STATUS: ✅ FIKSET (2026-10-04, working tree). Effects use the last substep's signed Q1 balance, with rescue and numerical corrections explicit. Mechanisms use a diamond, not a second flux arrow. Near-steady net −0.000389517 mmol/min matches Q1 change; dynamic dt=1/0.5 tests and renderer checks pass. Five-row selection and basal/rapid attribution remain documented display conventions.

## Mechanism-to-evidence and test-coverage map

A = adapted published model; H = heuristic extension; M/R = existing mechanism/regression coverage, not external validation. “Partial” below is not a pass. Named studies not included in the source-appraisal list below remain comparator candidates rather than newly reverified evidence.

| Mechanism / classification | Population or protocol; target and source | Active equation / principal parameters | Implementation / BG Science | Existing tests | Remaining discriminating checks and status |
|---|---|---|---|---|---|
| Distribution, disposal and basal balance / A | Hovorka model constants and estimation priors; original tables checked | Q1/Q2 balance; VG=0.16 L/kg, k12=0.066/min; F01=0.0097 mmol/kg/min | §§3–4 / §§1–4,29 | A.1, D; API steady-state; baseline regression | Adapted F01 and exercise sink need a shared flux-residual assertion. F01/F13; partial. |
| Rapid absorption and IOB / A | SC absorption kinetics; preparation- and protocol-dependent, not one universal duration | Two depots per bolus; τ=55×[0.5,1.6] min; availability0.78; rapid plasma I−Ib | §4,13 / §7 | B.1–B.2, J.1; IOB assertions | Dose conservation across expiry, perfusion and stacking. F02; partial. |
| Basal delivery / H+A | Generic fictional long-acting preparation, not a specific marketed analogue | 22–38 h trapezoid plus a 55-min cascade; availability0.82 | §4 / §7 | B.3; basal contract/character tests | Source-matched onset/tail; missed dose retaining existing state. No preparation-specific validation. |
| Insulin concentration–response / A | Rizza: healthy clamps; Shetty: nine T1D adults, resting GIR4.4±0.4 before exercise | Muscle HillEC50=55mU/L,n1.5; linear hepatic x3 | §4 / §25 | K.1–K.5; clamp diagnostic | Joint transient/steady calibration, new holdout, correct incremental interpretation. F03; partial. |
| Carbohydrate delivery / A | Systemic appearance after a specified digestible meal; original AG0.8, current1.0 | Intake→D1→D2→plasma; shared variableτG | §5 / §5 | C.1–C.5; stomach/input tests | Full mass balance, long intake and mixed-meal sequence. F11/F13; partial. |
| Gastric/intestinal modifiers / H | Separate meal composition, high BG and exercise protocols | τG depends on mixture/fibre/fat/BG; splanchnic factor0.45–1 | §5 / §§5,8 | C.5–C.6; activity context matrix | Isolate each modifier and test a second meal after the first reaches D2. Current sharedτG changes both compartments; not a validated spatial transit model. |
| Protein / H | Paterson protein-versus-water late windows; Smart mixed-meal design | Gutτ90min; AA half-life60min; HillEC50=8g,n2; maximum hepatic-drive increment0.25 | §5 / §6 | C.6–C.7, G.1 | Matched source protocol, control subtraction, early and late windows; hormone mechanism ablation. F05; partial. |
| Dietary fat and FFA resistance / H | Wolpert: higher versus lower fat, equal CHO/protein; insulin requirement, not isolated FFA kinetics | Gutτ150min; effective FFA half-life180min; resistance divisor≤1.42 | §5 / §6 | C.6,C.8; Node FFA tests | Separate gastric-delay and resistance ablations; dose/time holdout. F07; partial. |
| Contraction uptake and perfusion / A+H | Exercise with controlled insulin/glucose; distinguish direct uptake from additional GIR | βE1 sink; E1 activationτ5min; HR-based perfusion multiplier | §6 / §§8–9 | E.1–E.5; 486 activity contexts | Empty-Q2 mass balance; separate perfusion/E1 ablation; low-BG workload coupling. F01/F12. |
| Exercise hepatic drive / H | Activity type and feeding/insulin context; direction is not universally positive | Separate drive by activity, exponential decay; additive contribution to EGP | §§6–7 / §§8–9,11 | Activity intensity and context reversal | Endogenous flux target independent of netBG; current clamp flux decomposition not testable. Partial. |
| Post-exercise sensitivity / H | Heterogeneous exercise studies do not identify universal three-phase constants | Fast/early/late session responses; late half-life18h; early glycogen gate; total cap2.5 | §6 / §§8–9 | E.5; stop/long-session continuity; prior-exercise test | Protocol-matched late holdout; isolate phases and repeated sessions. Existing event tests are a strength, not clinical validation. |
| Muscle glycogen / H | Depletion/refeeding depends on exercised muscle and substrate | Capacity5.5g/kg; fast refill≤0.8g/min; slow/CHO components | §6 / §§8–9 | Node pool/repletion tests | Precursor or uptake bounds, exercised-muscle scaling; F06. |
| Hepatic reserve and rescue glucagon / H | Liver glycogen and measured rescue responses under specified fasting/insulin states | Capacity≤120g; rescue transfers≤35g over45min; ongoing capacity refill | §7 / §§2,11,24 | G.2–G.6; matched glucagon controls; release tests | Glucagon transfer is locally mass-conserving, whole hepatic pool is not. Repair G.5; validate long-fast rescue independently. F06/F09. |
| Acute/chronic stress / H | Hormone and illness responses differ in kinetics and pathway effects | Acute cap0.4, half-life60min; chronic pendingτ30min and half-life12h | §7 / §§11,17,20 | F.1,H.1; Node stress tests | Hypo-clamped amplitude, interaction/ablation and true quantitative hormone target. Comment arithmetic F13. |
| HAAF / H | Repeated hypoglycaemia and recovery; no newly verified universal numerical curve | Low-BG exposure area; factor0.3+0.7exp(−area/30); recovery half-life3days | §10 / §§11,24 | Node HAAF tests; no focused HTML chapter | Repeated-hypo versus isolated-hypo controls, recovery days/weeks and counterregulatory output. M/R only. |
| Dawn and circadian sensitivity / H | T1D rhythms vary; selected curve is not a universal phenotype | Daily hepatic amplitude0.15; separate ISF curve0.70–1.20 | §8 / §§12–14 | A.2–A.6; Node rhythm/module tests | Quantitative phenotype bounds; overlap with basal-tail effects. Midnight amplitude caching versus later-night sleep loss needs a targeted check. |
| Sleep disruption / H | Donga sleep restriction is not a measured linear penalty per awakening | Merged22:00–07:00 awake intervals; morning stress increment0.06/losth, cap0.3 | §9 / §18 | H.2; overlap/07:00 API tests | Sleep duration→measured sensitivity endpoint; separate dawn and chronic-stress effects. M/R adequate for bookkeeping only. |
| Relaxation / H | Adjacent autonomic/intervention evidence; immediate percentage gain unverified | Stress reduction; active-session vasodilation gain2–5% | §6 / §10b | Selected Node activity/glycogen checks | Dedicated HTML comparison; onset/stop and independent evidence for immediate gain. Not quantitatively validated. |
| Glucotoxicity / H | Source endpoint and full-text qualification unresolved in revised§26 | Quadratic exposure above10mmol/L; divisor≤1.4; recovery half-life24h | Code/comments; no full standalone implementation chapter / §26 | H.3; Node exposure/recovery | Correct denominator; source-matched clamp outcome and recovery holdout. F07. |
| Ketogenesis / H | Feeding, fasting and retained-state insulin withdrawal must be separate | LipolysisEC50=5mU/L,n3; effective CPT1EC50=7,n2.5; saturating BHB clearance | §11 / §23,25 | I.1–I.6; Node ketones | Joint insulin/FFA/BHB trajectories and independent protocol; source partition unsupported. F04. |
| Acidosis and neuroglycopenia / H, game endpoints | Clinical DKA requires acid–base evidence; time-to-incapacity is not identified here | Arbitrary acidosis threshold600; brain-deficit threshold8mmol, BGtrigger2.5 | §§11,15 / §§4,23–24 | Node accumulation/recovery/game-over | Dedicated HTML ablation/boundary panels; no conversion of game score into measured pH or brain glycogen. |
| Renal glucose handling / A | Renal threshold/splay vary; original model is a lumped approximation | Threshold9mmol/L; linear clearance above it | §3 / §3 | F.2 | Continuity/mass balance at threshold across weights; no CKD/SGLT2 validation implied. |
| CGM and fingerstick / A+H | Measured sensor errors differ from biological variability | First-orderka0.073/min; 5min sampling; proportional noise/drift/compression | §12 / §27 | J.3; extensive API sensor tests | Ramp/step lag, joint drift/noise distribution and device holdout. Good M/R coverage; not clinical accuracy certification. |
| Weight, calories and phenotype scaling / H | Linear energy approximation, not a validated dynamic weight model | Netkcal/7700; BW-scaled compartments; resting/exercise expenditure | §14 / no dedicated BG weight chapter | D; Node expenditure/weight tests | Long-run energy consistency; low-BG workload coupling. ICR changes its informational getter, not the meal ODE: clarify this API scope rather than interpreting the getter test as meal-response validation. |
| Explanatory flux display / derived attribution | Algebraic consistency with the chosen compartment balance, not a clinical outcome | Actual EGP plus mixed transport/disposal/suppression entries | Engine `_computeBGForces`; UI effects panel | Node structure and basal/bolus attribution tests | Displayed signed sum versus Q1 or Q1+Q2 derivative; steady-state and dynamic comparisons. F15; absent from HTML validation. |

None of these rows receives blanket physiological approval. For most extensions, a complete normal/extreme/interaction/ablation/event-boundary set with an independent literature target is still missing.

### Numerical checks and parameter coupling

The new composite meal–bolus–exercise scenario used actual 1, 0.5 and 0.1 minute engine steps. End BG was 6.733, 6.698 and 6.672 mmol/L; minima were 2.850, 2.863 and 2.873 mmol/L. This selected case converged reasonably. It does not establish convergence of every extension. Comparing outer calls of 5 versus 1 minutes alone is inadequate because the engine already subdivides those into at most one-minute steps.

The archived Gemini software review instead attributes a large Euler step directly to fast-forward or frame lag. Current code clamps wall-clock frame duration to 0.5 seconds (`js/game.js:81–96`) and subdivides physiological time into chunks no larger than one minute (`js/physiology-engine.js:1008–1019,1365–1368`). A new deterministic meal/bolus test calls `engine.step(240)` once and compares it with 240 calls to `step(1)`: both end at BG 6.441592 mmol/L, with zero difference in the Hovorka state vector. Instrumentation records 240 Hovorka calls, maximum dt=1 minute. This rejects the proposed large-step pathway for the current engine; it does not replace the finer-step convergence tests above. Runge–Kutta order four (RK4) would still have truncation error and cannot repair the mass-removal defects in F01/F02 by itself.

Important couplings are intentional but need explicit validation: a common gastric τ affects both stomach and intestinal carbohydrate compartments; systemic insulin is used to control both muscle and hepatic actions; the same effective dietary-fat pool drives resistance and ketogenic substrate; and estimated muscle glycogen modulates early post-exercise sensitivity. Matching a netBG curve cannot uniquely identify each of these components. The exercise separation into contraction, hepatic drive, glycogen use and sensitivity is a useful design improvement that should be preserved.

## Recommended repair and validation order

1. Repair the deterministic conservation/boundary defects (F01, F02, F10, F11), with failing-before/passing-after tests and no unrelated recalibration. F01 requires an explicit model-design decision, not just a clamp change.
2. Repair the test harness and misleading analyses (F08, F09, K.3 in F13), and the explanatory flux accounting (F15). Make execution failure and scientific uncertainty separately visible in the page and machine-readable output.
3. Reconcile the scientific claims in implementation docs and the review skill. Remove unsupported inference; preserve clearly labelled heuristics. Do not change the model merely to reproduce an old comment.
4. Define protocol-specific insulin, protein/fat and ketone calibration targets and independent holdouts. Reassess the joint clamp/bolus discrepancy before retuning exercise to compensate for it.
5. Add focused HTML panels for HAAF, isolated sensor error/lag, FFA ablation, neuroglycopenia/acidosis game scores and true retained-state withdrawal. Reuse executable test definitions instead of maintaining a second, drifting narrative test catalogue.

Each substantive model repair should have a decision document linking source endpoint, chosen equation/parameter, changed assertions and before/after results. None of these repairs has been authorised or implemented by this review alone.

## Gemini input and adjudication

Gemini `gemini-3.1-pro-high`, effort high, was used for two bounded code/document packets and a subsequent eight-point adjudication. Raw output and prompts remain private. The first core response's coverage table omitted supplied engine excerpts; its results were not treated as a complete review. The extensions response explicitly lacked the muscle-glycogen implementation, which was inspected separately here. The final response appraised the supplied diagnostic reasoning, not primary papers.

Gemini contributed the residual-input hypothesis, the exercise boundary concern and the dietary-fat provenance discrepancy. Its IOB objection was rejected: displayed IOB uses rapid depots plus plasma I−Ib; the all-insulin Hovorka getter is not the display path. Its prediction of negative stored Q2 was corrected to a clamped balance residual. Its “HAAF” calculation concerned an acute-stress comment. Its later description of the HTML insulin reset as a critical engine pump-failure bug was also rejected: the reset is in the test fixture, not a production pump implementation. Agreement between models was not used as scientific evidence.

### Follow-up: two reports archived on 3 October

Both [the literature, physiology and usability report](2026-10-03_Gemini_litteratur-og-brugervenlighed.md) and [the software report](2026-10-03_gemini-3.1_software-review.md) were read in full. The latter's original review date and code revision are unknown; 3 October is its receipt date. These are pre-existing critiques, not additional model consultations in this follow-up. Their blanket claims of peer-review quality, superiority to other simulators and complete physiological correctness are not adopted: neither report supplies a comparative evaluation establishing them.

| Earlier topic | Check against the current project | Disposition in this review |
|---|---|---|
| Euler instability from fast-forward; replace with RK4 | Current bounded substeps and the new 240-minute batch probe contradict the claimed large-step pathway. Negative-state clamping also does not itself prevent NaN. | Reject as an established fast-forward defect. Retain convergence and positivity/mass-balance testing; F01/F02 remain independent of solver order. |
| Engine cannot run independently of browser/UI | `createEngine` is exported for Node; both the prior regression suite and this follow-up run without a DOM. Engine events are emitted and buffered, then processed by the facade. | Reject the claimed headless limitation. A new EventBus or ES-module conversion is not a necessary physiological repair. Global application state remains an architectural topic, not a demonstrated corruption bug. |
| Low-glucose denominator and zero-state checks | The implemented F01c expression has denominator G+1 and tends to zero at G=0. The original review gives no reproducer of its proposed division failure. | Retain invariant tests already requested in F01, not an invented singularity or the unsupported equation of numerical Q1=0 with instantaneous clinical death. |
| Incretins and GLP-1 receptor agonists | BG Science §5 already discusses GLP-1, distinguishes GIP and qualifies physiological versus drug effects. | A preparation-specific adjunct-therapy review could extend coverage; absence of such a drug model is not a defect in the currently declared generic model. Do not adopt the report's unsupported prevalence claim. |
| Ultra-rapid insulin | BG Science §7 already includes faster aspart. Implementation limitations explicitly exclude differences between marketed preparations (`3273–3275`). | Optional source-led pharmacokinetic/pharmacodynamic extension. Do not adopt the review's generic 15–30 minute peak; formulation, dose and appearance versus action endpoints must first be verified. |
| SGLT2 inhibition and euglycaemic DKA | BG Science §23 already covers the topic. The model does not implement the drug's renal effect or measured acid–base variables. | Add the implementation-scope discrepancy to F13.8 and retain F04's endpoint distinctions. |
| Disease duration, residual secretion and glucagon | Fixed stress ceiling and lumped HAAF response are not a duration-dependent or residual-secretion model; current documentation overgeneralises its phenotype. | Add F13.7. A future phenotype extension requires source-defined parameters, not a universal diagnosis-year threshold. |
| Physiological uncertainty bands | Stochastic absorption timing, sensor error and between-person parameter variation are distinct. Existing variability is not a validated joint prediction distribution. | Retain as a possible evaluation/visualisation extension. Name any band by what is sampled; a simulation envelope is not automatically a confidence interval or a clinical prediction interval. First fix F13.4's inconsistent variability description. |
| New flux/causal display | An effects panel and physiology dashboard already exist. Inspection prompted a new balance probe, which found double-counting in panel inputs. | F15: repair and test the existing explanation before adding another display. |
| Quick start, contextual tips and dominant-cause indicators | These are UX/design proposals, not evidence of physiological validity. Dominant-cause indicators also depend on correct attribution. | Outside this physiological audit; not turned into new implementation tasks. Existing flux attribution is assessed in F15. |

No new clinical endpoint was accepted from these older reports. The follow-up checks code and consistency with the revised BG Science; proposed new medications, insulin preparations and phenotype models still need their own primary-source appraisal before implementation.

<a id="references"></a>

## Source appraisal and references

Original Hovorka PDF p.909 Tables1–2 were visually inspected. The cached original Shetty HTML abstract/methods/results and Paterson Table2 with its surrounding text were inspected; original HTML regions were also rendered for visual checking. Wolpert's full-text XML results/discussion and the relevant 2024 consensus were consulted. Rizza was checked at abstract level only. This list is the boundary of renewed primary-source appraisal, not a claim that every cited paper in BG Science was reread.

1. Hovorka R, Canonico V, Chassin LJ, et al. (2004). Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes. *Physiological Measurement*, 25:905–920. [DOI](https://doi.org/10.1088/0967-3334/25/4/010). Local DOI resolution returned the matching publisher page (HTTP 200); archived PDF used for table verification.
2. Rizza RA, Mandarino LJ and Gerich JE (1981). Dose-response characteristics for effects of insulin on production and utilization of glucose in man. *American Journal of Physiology*,240:E630–E639. [Verified Europe PMC record and abstract](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:7018254%20AND%20SRC:MED&format=json&resultType=core). Full text not acquired; already retained on the project wishlists. PubMed returned a browser challenge locally.
3. Shetty VB, Fournier PA, Paramalingam N, et al. (2021). Effect of exercise intensity on exogenous glucose requirements to maintain stable glycemia at high insulin levels in type 1 diabetes. *Journal of Clinical Endocrinology & Metabolism*, 106:e83–e93. [Publisher](https://academic.oup.com/jcem/article/106/1/e83/5937229); [verified indexed record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33097945%20AND%20SRC:MED&format=json&resultType=core). Publisher HTTP 403 on this PC during this audit; previously archived complete HTML read instead. The publisher link is therefore not represented as currently unrestricted.
4. Paterson MA, Smart CE, Lopez PE, et al. (2016; online 2015). Influence of dietary protein on postprandial blood glucose levels in individuals with Type 1 diabetes mellitus using intensive insulin therapy. *Diabetic Medicine*, 33:592–598. [Open full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5064639/fullTextXML). Identity and full-text endpoint verified locally, HTTP 200.
5. Wolpert HA, Atakov-Castillo A, Smith SA and Steil GM (2013; online 2012). Dietary fat acutely increases glucose concentrations and insulin requirements in patients with type 1 diabetes. *Diabetes Care*, 36:810–816. [Open full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3609492/fullTextXML). HTTP 200 and identity verified locally; newly archived as `docs/references/Wolpert_2013_DietaryFatInsulinRequirementsT1D.xml`, with a private intake record. Searchable XML is not passed through the PDF converter.
6. Umpierrez GE, Davis GM, ElSayed NA, et al. (2024). Hyperglycaemic crises in adults with diabetes: a consensus report. *Diabetologia*,67:1455–1479. [Open full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11343900/fullTextXML). HTTP200 and article identity verified locally; an existing local XML copy is available.

The archive preflight and post-acquisition read-only check found 165 cached PDF extractions and one pending, identity-unverified Mergenthaler file. No refresh or successful conversion of that file is claimed. It was not used as evidence for the brain-score calibration. All article files and original-page images remain outside the version-controlled report.

## Reproducibility and status

Commands used from the simulator root:

```powershell
& './tests/.bin/node.exe' 'tests/run-physiology-regression.js'
& './tests/.bin/node.exe' 'docs/reviews/2026-10-04_model-review-probes.cjs'
```

The private browser helper served the existing page on `127.0.0.1:8765` and used installed Chrome. It closed the browser and server after execution. Browser outcomes above are from the completed run, not from the two preliminary helper failures (missing bundled Chromium and an overly broad section selector).

Reviewed raw-file SHA-256 values:

| File | SHA-256 |
|---|---|
| `js/hovorka.js` | `ab51b800e151d67624af81801cda9c13a51e6a4de04d40a5a5972ff66416bfab` |
| `js/physiology-engine.js` | `1a2a7664801a25edde0c7f9c619c8f469682c2059672c506b209911bda8fde24` |
| `js/simulator.js` | `6ac24a86f4275b516a78242eef54eff199b613a109a9a12cb56d7bb84e09be31` |
| `docs/MODEL-IMPLEMENTATION.md` | `cdc332143c709e5570750a939e98c3385c28c097e20d503a385b7a08dc18b5ab` |
| `docs/BG-SCIENCE.md` | `dce6d03d5c7f9f48fc42e9412adb86d72d72dbc7806f9fbdbd4929779f1bfd27` |
| `tests/model-validation.html` | `ffda024249db4bd69ec3ccb422b4e342c6101bdb339a043b4a927ec80fe2de6c` |

Repair status, 4 October 2026: **9 fixed** (F02, F07–F11, F13–F15), **5 partial** (F03–F06, F12), **1 open** (F01). The hashes above identify the pre-repair audit, not the modified files. Checkpoint `1c8243e` precedes the repairs; the subsequent repair checkpoint contains the dated fixes below. The [decision record](2026-10-04_model-review-fixes.md) documents verification and the deferred choices. Passing regression checks does not close the remaining physiological calibration or conservation findings.
