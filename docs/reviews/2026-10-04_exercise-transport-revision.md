# Exercise transport revision: conserved, insulin-independent glucose uptake

Date: 4 October 2026. Parent checkpoint: `3969eac`. Status: implemented locally; this revision is not committed or pushed. Scope: audit F01 and the immediately dependent tests, explanation panel and implementation documentation. Glycogen accounting (F06) and joint bolus/clamp calibration (F03) remain separate work.

## 1. Background and diagnosis

The [model audit](2026-10-04_codex_model-science-test-review.md) found that the exercise term `β E1` drained Q2 even when Q2 was empty. Clamping the resulting negative state to zero created a discrepancy between reported uptake and actual glucose loss. Q2 was replenished only through insulin-dependent `x1 Q1`, so this was also a structural failure of the intended insulin-independent pathway.

Removing the clamp would permit negative glucose. Capping the Q2 sink preserves arithmetic but cannot sustain independent uptake when insulin action and Q2 are zero. An explicit insulin-independent net uptake from accessible glucose addresses both defects.

### Evidence and scope

BG Science §6 describes distinct contraction-mediated and insulin-mediated uptake. Romeres et al. (2021) modelled tracer/clamp data from six participants with type 1 diabetes and six without diabetes, including 60 min exercise at 65% maximal oxygen uptake. Their equations 4 and 11 express independent disposal as a glucose-mass-proportional flux: `p1ex = p1(1 + p5 E)` and `IIRd = p1ex Q`. The selected model separated an immediate independent response from a delayed insulin-dependent response. Endogenous production was supplied as a measured input, not jointly estimated as in this simulator.

The current revision borrows the glucose-dependent net-flux structure, not the complete model or its parameter estimates. Romeres' component partition is model-derived; its small clamp study does not identify the simulator's β, establish a universal response, or validate extrapolation to severe hypoglycaemia. The original archived HTML Methods, equations, Results and limitations were consulted. The previous E1 time constant and β originate from the simulator's Resalat-based implementation; they were retained, not independently refitted here.

## 2. Equations and parameter decisions

Before numerical source limitation, the new term is

```
G = Q1 / V_G
U_ex = β E1 G / G_ref
β = 0.78 (body weight / 70 kg) mmol/min
G_ref = 5.5 mmol/L
dE1/dt = (exerciseInput − E1) / 5 min

dQ1/dt = U_G + EGP − F01c − F_R − x1 Q1 + k12 Q2 − U_ex
dQ2/dt = x1 Q1 − k12 Q2 − x2 Q2
```

`G/G_ref` is dimensionless; U_ex is in mmol/min. G_ref normalises the retained β amplitude at the existing reference glucose. It is not a measured Michaelis constant. E1 already contains activity type and filtered heart-rate input, so neither enters the uptake equation twice. Q2 retains the insulin-mediated route. Direct uptake aggregates cellular transport and utilisation rather than adding another anatomical compartment.

For each Euler substep, sum all outgoing fluxes from each glucose pool. Multiply those fluxes by `min(1, pool/(dt × outgoing sum))`. Apply the same realised intercompartment flux at both ends. Incoming mass becomes available on the next substep, avoiding double credit between the two pools. Thus

```
Δ(Q1 + Q2) = dt (U_G + EGP − F01c − F_R − disposal − contraction).
```

The limiter is a numerical safeguard, not a physiological allocation rule under glucose scarcity. Diagnostics and the effects panel use realised fluxes. Contraction now has its own downward flux arrow; sensitivity modifiers remain distinct from fluxes. Existing low-glucose activity, glycogen and insulin-response rules are otherwise unchanged.

## 3. Candidate comparison and consequences

`tests/experiments/exercise-balance.cjs` reconstructs three alternatives in isolated instances: the pre-revision Q2 equation, source-limited Q2 uptake, and direct Q1 uptake. It does not provide production feature flags. All non-glucose state equations remain shared.

The boundary experiment uses 70 kg, initial steady-state BG 5.5 mmol/L, high-intensity cardio for 60 min followed by 60 min recovery, with dawn, stress response, ketones and glucotoxicity disabled. The zero-insulin condition deletes insulin depots/action states but retains the initial Q2 amount; it is a mathematical boundary experiment, not pump interruption. Values below use dt=0.1 min. Integrated contraction includes the recovery tail.

| Insulin condition | Uptake candidate | BG at 60 min (mmol/L) | BG at 120 min | 120-min glucose-balance residual (g) | Recorded contraction uptake (g) |
|---|---|---:|---:|---:|---:|
| Zero insulin/action | Original Q2 | 8.658 | 10.686 | +11.568 | 13.388, partly unrealised |
| Zero insulin/action | Source-limited Q2 | 8.658 | 10.685 | <10⁻⁸ | 1.820 |
| Zero insulin/action | Direct Q1, selected | 3.965 | 6.074 | <10⁻⁸ | 12.428 |
| Basal insulin | Original Q2 | 1.501 | 1.576 | <10⁻⁸ | 11.494 |
| Basal insulin | Direct Q1, selected | 1.955 | 2.080 | <10⁻⁸ | 6.882 |

The sign of the BG change is context-dependent: glucose dependence reduces uptake at low glucose but allows continuing uptake when the old insulin-dependent supply to Q2 was limiting. These trajectories demonstrate structural consequences, not clinical validity. With direct uptake and basal insulin, BG at 60 min was 1.931, 1.945 and 1.955 mmol/L at dt=1, 0.5 and 0.1 min, respectively.

The unchanged external activity suite returns 11 PASS, 3 PARTIAL, 3 NOT TESTABLE and 0 FAIL. Its 486 contexts remain finite. Resting GIR at insulin 60 mU/L remains 14.50 mg/kg/min versus the selected Shetty study mean of 4.4 ± 0.4: the insulin mismatch is not repaired. Predicted incremental GIR at low/medium/high exercise rises from 1.16/2.19/2.83 to 1.76/3.26/4.37 mg/kg/min; existing comparator values and tolerances were not changed. The context grid has more hypoglycaemic runs (251 versus 229); this uncontrolled simulation grid is not an estimate of clinical incidence.

### Deliberate departure from earlier educational calibration

Old steady-state strength tests required low/medium/high BG rises of +0.15–0.35, +0.40–0.70 and +0.75–1.15 mmol/L. These were chosen teaching bands, not independent clinical acceptance intervals. The new reference-profile results are +0.078/+0.175/+0.373 mmol/L. Hepatic drive was not increased to restore the older appearance. The Node and HTML tests now identify these outputs explicitly as dated model characterisations. The separate Young flux checks and external activity targets were retained; Young's contraction integral now reads the actual uptake flux rather than recalculating the obsolete β E1 term.

Only exercise-cardio outputs changed in the golden-master and combined internal baseline. Updating those regression fixtures records an intentional model change; it does not validate that change physiologically. One acute-stress isolation test now holds BG at 8 mmol/L during exercise, because otherwise secondary hypoglycaemia legitimately activates the separate counter-regulatory state.

## 4. Verification

The new `tests/exercise-conservation.test.js` has 20 checks covering zero insulin/empty Q2, absent stimulus, zero glucose, scarce source pools, weight scaling, 120-minute balance, onset and manual/automatic stop, direct-flux reporting, and step refinement. Checks use dt=1/0.5/0.1 min where applicable. They do not declare β or G_ref validated.

An independent read-only agent checked 2,835 deterministic extreme-state steps. All glucose pools remained non-negative; maximum absolute balance residual was 1.279 × 10⁻¹³ mmol. Its analytic constant-contraction test showed first-order convergence: 60-minute BG errors of −0.01245/−0.00621/−0.00124 mmol/L at dt=1/0.5/0.1. The main agent inspected the equations and executed the permanent tests independently.

| Check | Result |
|---|---|
| New conservation/continuity suite | 20/20 |
| Earlier review regressions | 18/18 |
| Engine API | 34/34 |
| Golden master after documented exercise rebaseline | 7/7 |
| Internal baseline equivalence | 8/8 |
| Standalone–facade parity | 10/10 |
| Simulation suite | 197/197 |
| External activity validation | 11 PASS; 3 PARTIAL; 3 NOT TESTABLE; 0 FAIL |
| Insulin clamp | PARTIAL; original quantitative discrepancy retained |
| HTML suite and effects renderer | 51 sections; 0 errors, 0 failed sections, 3 warnings and 6 descriptive sections; renderer passes. Injected missing food produces exactly 1 execution error. |
| Model diagrams | Both regenerated and visually inspected. Glucose diagram: geometric PASS without conflicts. Exercise overview: PASS with one crossing of dashed signal arrows; endpoints remain distinct and labels legible. |

## 5. Source record and files

Romeres D, Schiavon M, Basu A, et al. (2021). Exercise effect on insulin-dependent and insulin-independent glucose utilization in healthy individuals and individuals with type 1 diabetes: a modeling study. *American Journal of Physiology—Endocrinology and Metabolism*, 321:E122–E129. DOI 10.1152/ajpendo.00084.2021. [Europe PMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33998292%20AND%20SRC:MED&format=json&resultType=core), HTTP 200 with matching title, authors and DOI verified from this PC on 4 October 2026. A fresh full-text API request failed; the existing complete archived HTML was used instead (SHA-256 `71994b724f9d7ee4c2ba9a39f79a47c535ee983be40c503e16f2e6452ea6fbd7`).

Implementation anchors: `js/hovorka.js:188` (reference glucose), `:589–612`
(requested and realised fluxes), `:656–666` (glucose balances);
`js/physiology-engine.js:1471` (Q1 ledger), `:3147` (contraction arrow);
`js/ui.js:4691` (exercise tooltip); `js/simulator.js` (respawn equilibrium
comment). Documentation: `MODEL-IMPLEMENTATION.md` §§3/6/16 and
`diagrams/exercise/`, `diagrams/glucose-subsystem/`. Tests: conservation suite,
candidate experiment, simulation strength tests, HTML E.1/E.2, browser renderer
fixture, golden exercise fixture and combined baseline. `BG-SCIENCE.md` and
the Knowledge Base's public text are unchanged; a private claim-level
verification record links the Romeres source hash to the inspected equations
and their rendered images.

## Status

F01's conservation and insulin-independent transport defect is corrected. Absolute exercise calibration, conserved glycogen allocation, sustained insulin action, and a global low-glucose activity-capacity model remain unresolved. This revision is not a complete physiological validation.
