# Separate gastric delivery and intestinal appearance: implementation proposal

Date: 2026-10-25. Proposal based on the current working tree; no application changes made for this proposal.

Decision status: **The owner has decided to retain gummy candy for now.** The architecture, custom-food changes and parameter choices below are recommendations awaiting implementation approval. Request: propose a concrete separation of gastric emptying and intestinal absorption, including dextrose in catalog and custom food.

Approval update, 2026-10-25: the owner approved local implementation of this plan and sensible delegation, then requested a commit checkpoint first. This authorizes implementation and testing, not push/publication or an unsupported kinetic speed claim. The proposal-stage statements below record the state before approval; measured parameter validity remains to be established.

Implementation update, 2026-10-25: checkpoint e4b8494 was created first. The
[implementation decision and verification record](2026-10-25_gastric-intestinal-fix.md)
documents the completed local model, inherited parameters, exact numerical
transport, shared 0.18016 g/mmol conversion and continuous custom-weight rule.
It supersedes the proposal-stage implementation status below.

Related work: [feasibility and source appraisal](2026-10-25_codex_glucose-feasibility.md), [initial brief](2026-10-25_glucose-model-plan.md), [review index](INDEX.md). This proposal reuses that appraisal; it does not constitute new clinical calibration. The earlier candyfloss replacement suggestion is not pursued.

## 1. Recommended scope

1. Keep one shared stomach-mixture model and the existing gummy food, macros, portions and icon. Track carbohydrate identity within that mixture and preserve it after transfer to the intestine.
2. Replace the shared `tau_G` with a dynamic gastric-transfer time and separate downstream profile parameters. Do not make a newly ingested food change the parameter of carbohydrate already in the intestine.
3. Give the existing dextrose tablet an explicit glucose profile. Keep gummy candy a product profile with incompletely known sugar composition. Do not declare gummy carbohydrate to be pure sucrose.
4. Expose dextrose and table sugar separately in custom food, using the same profile definitions as the model. Separate chemical identity from physical form in data, without adding a water simulator or a new liquid-form control in this first release.
5. Build and assess the revision locally before any publication. The currently public simulator is unaffected by writing this proposal or by local experiments.

## 2. Diagnosis and model boundary

**ADVARSEL — Shared gastric and downstream parameter. STATUS: ❌ ÅBEN.** `js/physiology-engine.js:2170` computes a meal-dependent time constant; `js/hovorka.js:499,629,632` uses it both for D1-to-D2 transfer and D2-to-blood appearance. This is the specific coupling to remove.

**ADVARSEL — Chemistry and calibrated kinetics are different information. STATUS: ❌ ÅBEN.** Free-glucose identity can be specified for the tablet, but the available clinical comparisons do not justify an arbitrary universal speed advantage over sucrose or all gummy products. See the feasibility report, sections 3 and 7, for evidence coverage and calibration limits.

The first version remains a reduced model. Its downstream pool represents effective intestinal processing and systemic glucose appearance, not a literal measurement of portal absorption. A profile may summarize digestion and subsequent conversion. It does not explicitly model sucrose hydrolysis, fructose transport or hepatic fructose metabolism. These limits must be named in model documentation and diagnostic labels.

The inherited full glucose-equivalent appearance assumption is retained explicitly for this bounded experiment. It is not established by nutritional-label rules and is not a new claim that every gram of sucrose immediately becomes a gram of plasma glucose. Do not add or remove a fructose fraction, change total yield, or recalibrate insulin sensitivity to compensate for this structural change.

## 3. State and equations

Use a small fixed set of profile identifiers, rather than an ever-growing compartment per eating event. For profile `p`, maintain `stomachCarbs[p] = S_p` and `intestinalCarbs[p] = I_p`, both in grams of the model's digestible-carbohydrate accounting units. Different profiles share a stomach environment; they are not independent stomachs. Two intakes with the same resolved profile can share pools.

Define:

```text
u_p(t)      = delivered carbohydrate intake for profile p       [g/min]
tauG(t)     = shared gastric-transfer time                       [min]
tauA_p      = fixed effective downstream time for profile p      [min]
mAbs(t)     = existing, separate splanchnic exercise modifier    [dimensionless]

Jgastric_p  = S_p / tauG(t)                                     [g/min]
Jappear_p   = I_p / tauA_p * mAbs(t)                            [g/min]

dS_p/dt     = u_p(t) - Jgastric_p
dI_p/dt     = Jgastric_p - Jappear_p

U_G(t)      = (1000 / 180) * A_G * sum_p(Jappear_p)             [mmol/min]
```

`U_G` enters the existing plasma-glucose equation once. The conversion is the simulator's glucose-equivalent bookkeeping, not molecular accounting for each sugar. Keep the current `A_G` setting explicit and unchanged; if it were later below one, the nonappearing fraction would need its own accounted sink. Do not apply `A_G` at both intake and output.

The model must conserve delivered carbohydrate as `sum(S_p + I_p) + cumulative sum(Jappear_p dt)`, with queued, not-yet-eaten carbohydrate accounted separately. No carbohydrates disappear when a food event expires.

The Hovorka core owns these pool equations and their numerical update. D1/D2, where needed for existing diagnostics, become derived aggregate views in their documented units, not additional integrating states. Existing code already uses aggregate rapid-insulin depot views; use that ownership pattern. Remove the old D1/D2 derivatives and scalar intake path when the new path is integrated. Do not maintain two physiological versions or introduce compatibility adapters for old saved games.

## 4. Parameter responsibility and mixed meals

| Component | Gastric transfer | Downstream appearance | Treatment in the first prototype |
|---|---|---|---|
| Current physical stomach mixture, retention and fibre heuristic | Affects `tauG` | Does not rewrite `tauA_p` | Initially retain as an explicit inherited approximation; audit mixed-meal changes. |
| Existing intestinal-fat feedback to stomach | Affects `tauG` | No direct new multiplier | Preserve feedback; do not accidentally remove the fat delay. |
| Current hyperglycaemia modifier | Affects `tauG` | No copied multiplier | Existing mechanism retained, without claiming fresh parameter validation. |
| Current exercise gastric modifier | Affects `tauG` | No copied multiplier | Separate from the next row. |
| Current exercise splanchnic modifier | No extra gastric effect | Multiplies `Jappear_p` | Preserve once, with remaining carbohydrate retained in the pool. |
| Resolved glucose/gummy/other food profile | Contributes existing physical mixture metadata | Selects `tauA_p` | Retain profile after gastric transfer. |

The existing `carbBase = 25 + (1 - simpleFraction) * 25` blends assumptions about chemistry and physical processing. Keeping it initially is a controlled structural experiment, not validation as a pure gastric-emptying law. Do not add a new starch-digestion penalty downstream on top of it without checking double counting. Fibre remains an acknowledged limitation: this proposal does not claim that all fibre effects are gastric, or that downstream local mixture effects never exist. Future intestinal interactions require explicit intestinal states, not the current stomach average.

Example: dextrose eaten after pizza still encounters the shared stomach environment. It does not bypass the pizza by having a glucose label. After a portion of that glucose has reached the intestine, a later food action cannot relabel it or replace its `tauA_p`. Whole-body conditions such as the separate exercise modifier can still affect it.

## 5. Intake, snapshots and resets

1. Resolve each food's gastric metadata and downstream profile once when accepting its intake. Validate the identifier and parameter bounds before side effects. Keep a single authoritative intake schedule for carbohydrate and physical meal contributions.
2. Replace the current split between whole-step `activeFood` carbohydrate-rate calculation and substep `activeIntake` delivery. For every substep, deliver exactly `rate * overlapWithEatingInterval`. Split at intake start/end boundaries when necessary; do not spread a 0.3-minute tablet over an entire one-minute step.
3. Use the same gastric-transfer coefficients and numerical convention for carbohydrate pools and physical stomach-mixture tracking. Derive aggregate stomach carbohydrate from the pools rather than maintaining an independently drifting copy. Add assertions relating the inventory views. Never increment carbohydrate once through a queue and again through the old `carbRate` path.
4. Export/import every pool, intake profile, remaining intake duration and resolved parameter needed for exact continuation. The existing export of Hovorka's numeric `state` array is insufficient for new profile pools; add them explicitly. Test What If replay and seed/RNG continuity.
5. Reset and respawn must clear pools and pending intake together. Replace direct D1/D2 writes in simulator reset paths with the owning core's reset operation. Update COB and physiology-dashboard readers to consume aggregate views once.
6. Keep numerical flows nonnegative and mass-conserving. For fixed substep coefficients, an exact linear-compartment update is an option; otherwise use a documented bounded substep method and convergence tests. Do not hide large-step errors with independent `max(0, ...)` clamps that create or destroy carbohydrate.

The shared update order must be explicit: split the time interval at intake boundaries; determine intake rates for that interval; read one common start-state and compute coefficients/transfer fluxes; advance core carbohydrate pools and physical stomach components over that same interval; then commit aggregate views. Do not update the physical stomach first and calculate carbohydrate transfer from a different state. Any higher-order predictor must be shared by both owners. Require `stomachCarbsTotal = sum(S_p)` after each committed substep because the proposed pools use grams. The existing D1/D2 views require their separate gram-to-mmol conversion.

Apply each realized gastric transfer as the identical subtraction/addition on its two pools, and each realized appearance as the identical pool subtraction and converted plasma input. Check conservation per profile as well as in total. Deliver the final intake remainder before removing a queue entry; a short-duration cutoff must not discard food. Preserve queue-inclusive stomach capacity and rejected-action atomicity: rejection must not add carbohydrate, calories or partial events.

Define COB as `sum(S_p + I_p)` for already eaten carbohydrate, with not-yet-eaten queued carbohydrate separate. Remove the competing elapsed-time COB estimate from `activeFood` when integrating this change. Test core reset, simulator respawn, and snapshot restore into both the same and a freshly constructed engine.

## 6. Food data and custom-food UI

Use resolved profile metadata with distinct fields such as `sugarIdentity`, `physicalForm`, `gastricProfileId` and `appearanceProfileId`. Profile IDs are product/model categories, not claims about measured molecular fractions. Catalog and custom-food input must pass through one shared resolver.

| Entry | Identity and preparation | Recommendation |
|---|---|---|
| Existing dextrose tablet | Free glucose; chewed tablet; current portion and eating time | Assign a dedicated glucose appearance profile. Keep T1D-kit and keyboard actions aligned. |
| Existing gummy candy | Mixed sugars, exact fractions unknown; gummy solid | Preserve the item; assign a gummy product profile without inventing proportions. |
| Custom “Druesukker” / “Dextrose” | Free glucose; solid default | Add a chip using the existing chip design and glucose-tablet asset. |
| Custom “Hvidt sukker” / “Table sugar” | Sucrose; solid default | Rename the current ambiguous “Sukker” choice and give it its own explicit profile. |
| Existing custom “Drik” / “Drink” | Generic sugar mixture; liquid preset | Retain as an explicitly mixed-sugar drink, not pure glucose or pure sucrose. |
| Other existing foods | Existing food-class composition and physical assumptions | Map explicitly to documented effective profiles; review their response after decoupling. |

In custom food, carbohydrate grams remain the existing carbohydrate field. Choosing glucose does not add grams on top. Fat and protein entered alongside glucose still affect the shared meal. For an equivalence test against five existing tablets, set 15 g carbohydrate, zero fat/protein, matching physical weight and the same total eating duration; otherwise eating-time defaults confound the comparison.

Do not add a universal “fast” multiplier, claim water makes glucose maximally fast, or expose guessed glucose/sucrose percentages for gummy candy. A solid/liquid selector for chemically defined glucose drinks can be a later extension when formulation is specified. Separating identity and form in the data now keeps that extension possible without confusing the current drink preset with a chemical category.

## 7. Parameter and release gates

1. **Structural control:** for a synthetic, constant-coefficient single-profile test, set both time constants to the old same value (for example 25 minutes). The old two-stage solution should be recovered at matched numerical accuracy. This is a mathematical regression control, not a proposed physiological calibration or a promise of whole-simulator parity.
2. **Gastric/appearance separation:** retain the present gastric calculation only as the initial comparator. Select profile-specific downstream values using the existing feasibility report's source limitations and appropriately appraised data. Do not freeze an arbitrary 10-, 15- or 20-minute glucose constant now.
3. **Identifiability:** BG alone cannot uniquely determine two sequential time constants, especially alongside insulin and hepatic responses. If separate gastric measurements are unavailable, document the fixed gastric assumption and interpret the fitted downstream value as effective, not independently measured absorption.
4. **Visibility:** report the actual difference in plasma BG, continuously filtered interstitial BG and sampled CGM separately. Do not require the tablet to lead gummy candy by a prescribed number of minutes or mmol/L. A small or uncertain difference is a permissible finding.
5. **Release:** publish no claimed glucose-specific speed advantage until the chosen contrast has a defensible source-to-parameter-to-test record. If data cannot identify a useful difference, report that outcome and discuss whether to release the structural improvement alone. Do not ship cosmetic chemistry choices advertised as different while hiding identical unsupported kinetics.

## 8. Verification plan and acceptance criteria

These are planned checks, not completed tests of an implementation.

| Check | Acceptance criterion |
|---|---|
| Mass and units | Input equals queued + gastric + intestinal + cumulative output within numerical tolerance; no duplicate `A_G` or glucose conversion. |
| Late meal isolation | With intestinal state and `mAbs` held equal, changing only stomach contents leaves immediate intestinal output unchanged. Future gastric input may differ. |
| Separate mechanisms | Changing only `tauG` changes gastric transfer; changing only `tauA_p` changes downstream outflow for that profile. Exercise-path ablations show no copied multiplier. |
| Eating boundaries | No food at `t-epsilon`; correct cumulative dose through `t+epsilon` and final intake boundary; short tablets are not diluted across a larger simulation step. |
| Mixed meal | Tablet alone, tablet with pizza and tablet after pizza conserve each profile; gastric interaction remains, with no downstream relabelling. |
| State continuation | Mid-intake and mixed-pool export/import, What If replay and respawn work with all profiles and the same RNG state. |
| Catalog/custom consistency | Identical resolved composition, form, dose and eating schedule give identical physiology across custom food, catalog, kit, keyboard and mobile. |
| Numerical sensitivity | Compare 1, 0.5 and 0.1 minute steps with event boundaries resolved; quantify errors and investigate negative inventories before interpreting small contrasts. |
| Clinical scope | Reuse equal-carbohydrate comparisons; add insulin-induced low-BG scenarios and matched no-food controls. Calibrate and validate against separately declared endpoints; do not turn the prior artificial low-BG run into clinical validation. |
| Visibility | Show continuous underlying curves and sampled/noisy CGM separately, across sampling phases. Sampling steps must not be explained as the physiological delay itself. |
| Broader effects | Inspect ordinary bread/juice/mixed-meal trajectories, exercise, basal/bolus and standalone-engine parity; explain deliberate changes before updating golden references. |

## 9. Implementation sequence and files

1. Before a large implementation, propose an authorized commit/push checkpoint of the independently ready work; an instruction to implement is not publication permission. Keep the public package separate from local prototype work.
2. Implement pool ownership, decoupled rates and one intake schedule in `js/hovorka.js` and `js/physiology-engine.js`. Update snapshot/import/reset operations at the same time. First pass the structural and mass-balance controls.
3. Define product profiles in `js/foods.js`; update the facade and scenario-event schema in `js/simulator.js`, catalog/kit/keyboard/custom paths in `js/main.js`, replay callers and `mobile/mobile.js`. Inventory all `addFood`, `carbRate`, D1/D2 and `tau_G` readers before editing.
4. Add the custom chips and explanatory text in `index.html` and `js/i18n.js`, using existing components. Update dashboard labels and existing mobile catalog callers; do not create an unrelated mobile custom-food feature.
5. Run targeted carbohydrate tests plus relevant existing suites (`tests/physiology-engine-api.test.js`, `tests/food-catalog.test.js`, `tests/simulation.test.js`, `tests/standalone-parity.js`, `tests/golden-master.js`). Add browser verification for new custom controls and text sync when implementation exists.
6. Record chosen constants, supporting endpoints, uncertainty, before/after results and approval in a dedicated fix-decision document before release. Update `docs/MODEL-IMPLEMENTATION.md`, including the incorrect no-hydrolysis claim for sucrose and the incorrect 2.5-times liquid comment in food metadata. Change `BG-SCIENCE.md` only if separately appraised new science warrants it.

## 10. Code baseline, provenance and open status

Read from HEAD `a858b1e6be3b11a3a337375cff63a143110d2679` plus existing uncommitted project changes. Relevant SHA-256 values at inspection:

| File | SHA-256 |
|---|---|
| `js/hovorka.js` | `A0CF92D2821B5F1AA974FFBD4B4344B2EA74B611F59537688E6F22EA6108E28B` |
| `js/physiology-engine.js` | `559C83784EBEFA0CA3294DD2CC23CF74C237444C6818BC821A74AAC1B1A0B692` |
| `js/foods.js` | `6AFD890017B4C6BF9088B833A9C05DB33EAB1620270468F805FE046999BAD029` |

Located code: `js/hovorka.js:499,629,632,718`; `js/physiology-engine.js:1675,2170,2237,3202,3262,3732,3771`; `js/simulator.js:2054,3608`; `js/main.js:650,1836,1986`; `index.html:791`; `mobile/mobile.js:2304`. Scientific background was reused from the feasibility report and its appraised references; current documentation checked at `docs/MODEL-IMPLEMENTATION.md` gastric-emptying section and `docs/BG-SCIENCE.md` physiological-modulators section. Reading was limited to this subsystem, not a fresh full-model audit.

Independent review: a Codex sub-agent read the existing feasibility report and relevant Hovorka/engine intake, pool and snapshot code. It found the shared-stomach/profile design coherent for a prototype and identified five implementation risks: synchronized physical/carbohydrate updates, final intake remainders, per-profile realized-flux conservation, explicit new-pool snapshot/reset coverage, and ambiguous absorption/COB accounting. These were checked against the cited code and incorporated into sections 2, 3 and 5. It made no file changes, reviewed no new primary literature and did not validate kinetic parameters.

Overall status: proposal complete with bounded independent architecture review; **0 new critical defects established, 2 open warnings carried forward** (coupled parameter and unresolved kinetic calibration). Retaining gummy candy is the only new approved product decision. Implementation, parameter approval, runtime verification and publication remain open.
