# Gastric transport and product-specific downstream glucose appearance

Date: 2026-10-25. **Implemented locally; no push or publication.**

Follow-up evidence status, 2026-10-25: **❌ ÅBEN — quantitative validation of changed meal kinetics.** The [historical calibration audit](2026-10-25_codex_food-kinetics-calibration-audit.md) found literature-informed heuristic tuning rather than a reproducible product-specific fit. Faster mixed-meal responses are not established as more accurate; gastric-only fibre effects require reassessment. Numerical implementation tests remain distinct from this unresolved evidence question.

Release follow-up: [targeted meal/fibre checks and the beta release decision](2026-10-25_release-acceptance.md) retain the provisional parameters, correct the public diagnostic and update only the affected clinical-equivalence regression scenario. Quantitative calibration remains open.

Authorization: the owner approved the [implementation proposal](2026-10-25_codex_gastric-intestinal-proposal.md), requested substantial sensible delegation, and then requested a commit first. Checkpoint **e4b8494** records the preceding tested work and proposal. The implementation described here is subsequent, uncommitted work. Gummy candy is retained.

## 1. Background

The existing dextrose tablet and gummy candy used the same sugar category. More fundamentally, a time constant calculated from the current stomach mixture controlled both gastric delivery and the disappearance of carbohydrate already in the downstream compartment. The owner wanted these processes separated and glucose represented in custom food as well as the catalog.

The [feasibility report](2026-10-25_codex_glucose-feasibility.md) appraised the available evidence and ran sensitivity experiments. This implementation reuses that work and its limitations. No new original clinical evidence was appraised here, and no glucose-specific speed advantage was calibrated.

## 2. Diagnosis and evidence boundary

1. **Shared parameter: ✅ FIKSET locally, 2026-10-25.** Gastric modifiers no longer rewrite the downstream time of existing intestinal-profile contents.
2. **Glucose identity and custom food: ✅ FIKSET locally, 2026-10-25.** Dextrose, table sugar and gummy candy have distinct profile identifiers and appropriate identity metadata. Catalog, kit, keyboard and custom paths use shared food definitions.
3. **Clinical kinetic differentiation: ❌ ÅBEN.** Slama 1990 and the other direct comparisons in the feasibility report were available as original abstracts; their full-text quantitative appraisal remains incomplete. The gummy product fractions are unknown. Gray 1966's perfusion findings do not identify oral tablet kinetics. No arbitrary glucose boost or compulsory long sucrose-digestion delay is introduced.
4. **Full systemic yield: ⚠️ BY DESIGN.** The existing `A_G=1` glucose-equivalent appearance assumption is preserved. Nutritional carbohydrate labels do not establish systemic glucose yield. The new downstream pool remains an effective product model, not a chemical fructose or enterocyte model.

## 3. Implemented solution

`HovorkaModel.carbPools[profileId]` owns `stomachGrams`, `intestinalGrams`, `appearanceTauMin`, `deliveredGrams` and `appearedGrams`. Shared `tauGastric` controls the first transfer; the profile's time and existing splanchnic exercise modifier control the second. D1/D2 are aggregate mmol views and do not integrate a second time.

```text
dS_p/dt = u_p - S_p/tauGastric
dI_p/dt = S_p/tauGastric - I_p/appearanceTauMin_p * mAbs
U_G = A_G / 0.18016 * sum_p(realizedAppearanceGrams_p / dt)
```

All inputs and pool inventories are in model carbohydrate grams. `0.18016 g/mmol` is the shared conversion constant exposed by `HovorkaModel.GLUCOSE_G_PER_MMOL`. This replaces the proposal's rounded `0.180` and removes the old discrepancy between intake conversion and COB conversion. Actual realized transfer is used in both the donor-pool subtraction and plasma input. The linear two-stage solution uses an equal/near-equal-rate limit and `expm1` to avoid numerical cancellation. Zero downstream flux retains mass.

The engine has one `activeIntake` queue. Physical stomach contents and carbohydrate use the same frozen gastric coefficient and continuous-input exponential over the same interval. Intake steps are at most 0.1 minute and split at eating boundaries; the final positive remainder is delivered before queue removal. After intake, the existing maximum one-minute physiological substep remains. Substep rate diagnostics are integrated and exposed as outer-step mean rates; using the last tiny substep's rate had initially broken the observable mass/flux accounting and was fixed before final verification.

COB now comes from ingested gastric plus downstream inventory, excluding the not-yet-eaten queue. Snapshot format 3 explicitly contains profiles, rates, coefficients and last appearance flux. Core reset and simulator respawn clear both inventories and pending input. The old scalar `carbRate`, `activeFood` and `tau_G` model paths have been removed; saved format 2 is not migrated.

### Provisional parameter table

| Profile | Downstream time (min) | Basis and limitation |
|---|---:|---|
| Glucose, sucrose, gummy/mixed solid sugar | 25 | Inherited unmodified solid-sugar baseline; separate identity, no asserted speed ranking. |
| Mixed sugar drink | 16 | Inherited effective product baseline from `25 * 0.64`; not evidence of intrinsically faster intestinal uptake of liquid. |
| Fruit | 27.5 | Inherited `25 + 25*(1-simpleFraction)`, excluding gastric fibre/retention modifiers. |
| White flour | 48.75 | Same inherited heuristic, not an identified hydrolysis time. |
| Wholegrain | 48 | Same inherited heuristic. |
| Vegetables | 33.75 | Same inherited heuristic. |
| Mixed meal | 45 | Same inherited heuristic and default food profile. |
| Explicit gastric-only custom API input | 40 | Documented generic fallback when no appearance identity/time is specified. Catalog/custom UI supplies full profiles. |

These are starting parameters for a local structural prototype. Removing gastric fibre/fat/hyperglycaemia effects from the downstream stage changes meal responses even without a glucose speed bonus. A drink's 16-minute effective product time is retained to avoid simultaneously replacing all product calibration assumptions; it must be revisited before claiming a mechanistically measured intestinal model. No extra starch-hydrolysis stage is added on top of the inherited gastric base.

### Custom food

The existing chip design now presents Dextrose and Table sugar separately in Danish and English. Eight choices use two rows of four. The existing glucose-tablet icon is reused. Glucose/sucrose custom weight is `carbs + (protein + fat)/0.4`; this is a continuous estimated-weight rule, so adding a tiny amount of fat does not suddenly dilute the entire sugar portion. Other custom types retain their existing weight estimate. Eating duration remains explicit estimated metadata: a valid chemical comparison must match dose, form, weight and eating schedule. Tooltips make no speed-superiority claim. No water or glucose-drink button was added.

## 4. Verification and before/after effects

`tests/gastric-intestinal-comparison.cjs` loads baseline code directly from `git show e4b8494`; it does not reset the checkout. Each version uses its own food definitions. The experiment runs 48 arms: two versions, three time steps (1, 0.5 and 0.1 min), and eight scenarios including matched no-food controls. Profile: 70 kg, ISF 3, ICR 10, the same initialized basal-insulin/action states, no meal bolus, no exercise and no sensor noise. Sugar arms have 15 g carbohydrate; oatmeal and burger have 30 g, with their catalog macros/weight scaled proportionally and eating duration retained. Follow-up tablet is given at 60 min. This is an architecture comparison, not a clinical calibration experiment.

At dt=0.1 min, changes in food effect (new minus old, each relative to its own no-food control), mmol/L:

| Scenario and endpoint | Plasma BG difference | CGM difference |
|---|---:|---:|
| Tablet, 15 min | +0.005 | +0.003 |
| Gummy, 15 min | +0.006 | +0.003 |
| Mixed drink, 60 min | +0.106 | +0.104 |
| Oatmeal, 120 min | +0.888 | +0.898 |
| Burger, 120 min | +1.027 | +0.993 |
| Oatmeal then tablet, 120 min | +1.226 | +1.142 |
| Burger then tablet, 120 min | +1.616 | +1.438 |

No-food traces were identical. Every arm delivered its full input; maximum absolute carbohydrate mass residual in the primary agent's final rerun was `9.948e-14 g`. Across sampled endpoints, the largest difference between coarser steps and dt=0.1 was 0.0209 mmol/L plasma / 0.0240 CGM for the new model, versus 0.0784 / 0.0688 for baseline. Several meal maxima occur at the 240-minute window end; they are not established final peaks. These results demonstrate substantial mixed-meal changes and negligible early tablet/gummy differentiation, not proof of physiological correctness.

Completed focused controls:

1. 14 mechanism checks: analytical impulse/constant-input limits, equal/near-equal time constants, per-profile conservation, gastric/downstream isolation, zero downstream rate, yield applied once, eating remainders, custom-weight continuity, snapshot continuation and reset.
2. 18 model-review regressions, including full 600-minute intake and actual Q1 flux accounting.
3. 34 engine API checks and all 197 existing simulation tests. Tests referring to removed `activeFood`, `tau_G` or snapshot version 2 were updated to the new contract; their physiological acceptance ranges were not loosened.
4. Ten engine/facade parity scenarios. Basal, bolus, exercise, sleep, ketone and CGM-noise golden references were unchanged. Only `meal-fat-protein.json` required regeneration after the measured intended change; the full seven-scenario golden check then passed without tolerance relaxation.
5. Independent code review found no blocking P1/P2 issue in the bounded core/facade scope. Four hundred additional numerical cases exercised coincident and widely separated rates with zero/full pools and very small steps; all retained mass within `1e-8 g`.

6. Twenty exercise-conservation tests and the food-catalog tests passed. Danish/English text synchronization passed with 854 keys in each language. `git diff --check` found no whitespace errors in the implementation diff.
7. Browser verification passed all six language/viewport cases plus the clean-console/resource check: desktop Danish/English at 1280x800 and 1920x1080, mobile Danish/English at 375x667. Real custom, catalog and kit clicks delivered the expected glucose/sucrose/gummy profiles and amounts; all eight custom choices fit. The primary agent also visually inspected Danish desktop, English desktop and Danish mobile captures. Desktop custom food was tested through Box Challenge because existing Campaign gating disables that row; campaign access rules were not changed. Tone.js was stubbed, so this is not an audio test. Outputs: `tests/playwright/2026-10-25_gut-ui/rapport.txt`, `results.json` and screenshots. Early ISSUE captures record test-setup mistakes (gated Campaign row and startup timing), not unresolved application defects; the final result has no JavaScript errors or missing local resources.

The primary agent read the comparison script and reran all 48 arms on the final core, obtaining the values above. No claim of clinical validation is made.

## 5. Delegated review and decisions

Separate Codex agents owned core/engine/facade and food/UI files. A third agent independently reviewed parameter choices, implemented the baseline comparison, and reviewed the finished core. The primary agent checked changes, wrote independent mechanism tests, integrated layout, corrected the continuous custom-weight rule, and owns documentation and final verification.

Gemini 4 Argon (`gemini-4-argon-high`) reviewed a bounded private brief and the proposal through Antigravity, exit code 0 with explicit read coverage. It did not inspect source code or original studies. Retained concerns: confluent-rate numerical handling, identical realized flux into Q1, immutable profile parameters, matched physical-stomach integration, snapshot/reset coverage and the custom-weight discontinuity. These were verified against actual implementation/tests. Its suggestion to store both remaining grams and remaining duration was not adopted: one authoritative rate and remaining interval avoid redundant state, and remainder/conservation tests passed. Its categorical rejection of the inherited drink parameter was not treated as new physiological evidence; the parameter remains an explicitly provisional effective-product choice with the limitation described above. No universal liquid/glucose speed ordering is inferred.

Private provenance and detailed results: `.local-artifacts/2026-10-25-gut-implementation/` contains the brief, stdout/stderr, model/exit metadata and `comparison.json`/`.md` including source hashes and all resolved inputs. Public summaries contain judged conclusions rather than raw model output. Baseline is reconstructible from e4b8494; the committed proposal and original feasibility report retain the earlier reasoning.

## 6. Remaining limits and next decision

1. **Clinical calibration remains open:** the local implementation must not be described as a validated demonstration that druesukker works faster than the retained gummy candy.
2. Shared gastric mixing remains a reduced approximation. Current food-class/fibre and drink parameters have not become independently measured gastric/intestinal values merely because their code responsibilities are separated.
3. No separate fructose metabolism, water volume/osmolality, tablet dissolution or transporter saturation is modelled.
4. Before public release, review gameplay effects of the earlier mixed-meal response and decide whether to release this structural prototype or wait for better product-specific calibration. This turn does not publish it.

## 7. Files and sources

Implementation: `js/hovorka.js` (profile solver, shared conversion, aggregate views); `js/physiology-engine.js` (single intake, physical transport, flux means, snapshots); `js/simulator.js` (facade defaults, reset, COB); `js/foods.js` (profiles and custom resolver); `js/main.js`, `js/i18n.js`, `index.html`, `mobile/mobile.js`, `style.css`, `physiology-dashboard.html` (controls and diagnostics).

Verification: `tests/gastric-intestinal.test.cjs`, `tests/gastric-intestinal-comparison.cjs`, `tests/gastric-intestinal-browser.cjs`, `tests/food-catalog.test.js`, `tests/physiology-engine-api.test.js`, `tests/simulation.test.js`, the existing model-review/parity/golden suites and one updated meal fixture. Scientific references and coverage: [feasibility report, references and sections 3–7](2026-10-25_codex_glucose-feasibility.md). Current model description: [MODEL-IMPLEMENTATION.md](../MODEL-IMPLEMENTATION.md#carbohydrate-absorption). The historical static digestion diagrams are labelled as predating this separation.

Overall: **local implementation and numerical verification completed; kinetic calibration and public release remain open.**
