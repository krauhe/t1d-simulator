# Next model revision: glycogen accounting and joint insulin calibration

Date: 4 October 2026. Status: design work, not implemented. This follows the user-approved sequence and the [exercise transport repair](2026-10-04_exercise-transport-revision.md). No parameter values below are proposed as established physiological estimates.

## 1. Why a local cap is insufficient

`updateMuscleGlycogen()` currently computes replenishment from glucose, insulin action, carbohydrate on board and elapsed time. It does not bound storage by realised uptake. `updateGlycogenReserve()` computes liver depletion before insulin-suppressed EGP is known, and its replenishment is not coupled to a matching glucose source. These states influence early post-exercise sensitivity and liver output, so correcting them can alter both fasting equilibrium and recovery.

The required accounting unit is glucose-equivalent mass. The existing conversion is 0.18016 g per mmol glucose; reported glycogen polymer mass must not silently be treated as the same quantity. Original study methods must identify the convention before capacities or rates are transferred.

## 2. Proposed accounting contract

1. Calculate requested flows from the common start-of-substep state.
2. Apply source and destination-capacity limits to obtain realised flows.
3. Apply every internal transfer equally and oppositely at its two endpoints.
4. Record oxidation, renal loss and external precursor-derived glucose separately.
5. Update reserve fractions and dependent sensitivity only after the transfers.

Muscle storage must receive an identified fraction of realised uptake, not subtract the same glucose from Q1 a second time. The remainder is non-stored disposal. Because Q2 includes more than muscle, its full disposal cannot automatically be assigned to muscle glycogen.

Hepatic output must expose separate glycogenolysis and gluconeogenesis before adding them to Q1. Glycogenolysis and injected-glucagon release share the liver's available glucose budget. Plasma-derived liver storage is an explicit Q1-to-liver transfer, unless primary evidence supports its allocation from an already-accounted uptake channel. Unmatched exercise depletion is removed or given a stated destination.

Without explicit lactate, glycerol and amino-acid pools, gluconeogenesis remains an external input to the traced system. Such an open-system balance can be checked; it is not whole-body carbon conservation.

## 3. Evidence required before parameter selection

1. Liver capacity and the glycogenolysis/gluconeogenesis split in matching T1D fasting and exercise protocols, including insulin exposure.
2. Direct versus indirect liver storage, and whether existing uptake terms already include it.
3. Muscle uptake allocated to oxidation versus storage during exercise and recovery; meal and insulin conditions must match.
4. Quantitative depletion/repletion endpoints withheld from calibration for independent checks.
5. Joint effects on the existing no-bolus-controlled bolus response and sustained insulin-clamp GIR. A group-average clamp target does not identify an individual correction factor.

Existing glycogen tests will be classified before revision. Tests that enforce unconditional refill or constant artificial carbohydrate availability cannot establish conservation. Mass-balance assertions, event continuity and source-bound constraints can be fixed in advance; numeric physiological targets require original-study verification. Regression curves are updated only after those checks, with departures documented.

## 4. Code and test map

At creation, primary code anchors are `js/physiology-engine.js:1942` (`updateMuscleGlycogen`), `:2364` (`updateGlycogenReserve`), `:2532` (conserved glucagon transfer), `:2662` (reserve-dependent early sensitivity), and the substep ordering near `:1385–1503`. The names, rather than line numbers, are stable anchors.

Dependent assertions include `tests/simulation.test.js` liver-pool tests near 1851–2023, PEIS and muscle-pool tests near 3236–3627, glucagon recovery near 3974–4031, and stress-module depletion near 4168–4202. `tests/activity-validation.js`, `tests/peis-verification.js` and HTML G.5/I.5 also observe these states.

A read-only agent mapped these dependencies; the main agent accepted the need for explicit source allocation, not unverified numerical parameter recommendations. Implementation and original-source calibration remain outstanding.
