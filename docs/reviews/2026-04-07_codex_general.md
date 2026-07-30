# Glucose Model Review

Date: 2026-04-07
Scope: `js/hovorka.js`, `js/simulator.js`, validation/tests
Focus: physiological correctness, numerical stability, model-structure risks

## Overall assessment

The simulator has a thoughtful Hovorka-based core and good local test coverage, but several important physiological and numerical issues remain in the glue code around the core ODEs.

The most important problems are not simple syntax bugs. They are structural modeling choices that can produce plausible-looking curves while violating mass balance or physiology in edge cases.

## Highest-priority findings

### 1. Hepatic glycogen can refill rapidly during absolute insulin deficiency

Files:
- `js/simulator.js:2707`
- `js/simulator.js:2710`

Problem:
- `postprandialStorage` is triggered purely by `trueBG > 5.0` and available liver capacity.
- There is no insulin gate, no hepatic insulin signal, and no suppression when the liver is already in an insulin-deficient glucose-export state.
- As a result, the model can synthesize liver glycogen during severe insulinopenia and rising hyperglycemia.

Why this matters:
- In T1D with poor insulinization, hepatic glycogen synthesis is reduced, not accelerated.
- This error preserves or restores glycogen reserves in exactly the states where the liver should be failing to store glucose.
- It can make later rebound hyperglycemia, exercise support, and counterregulation look stronger than they should.

Local reproduction:
- With plasma insulin forced to 0, BG set to 18 mmol/L, and liver glycogen set to 20 g, `updateGlycogenReserve(60)` raised glycogen to 80 g in one hour.
- A full 60-minute simulation produced the same 20 g -> 80 g refill while BG rose from 18.0 to 20.3 mmol/L.

Recommendation:
- Gate glycogen synthesis on insulin availability and hepatic state, not BG alone.
- Minimum fix: require plasma insulin or hepatic insulin effect (`x3`) above a threshold before allowing storage.
- Better fix: make glycogen synthesis proportional to both hyperglycemia and an insulin-dependent synthesis term, while suppressing it when net hepatic output is positive.

### 2. A bolus injection changes the absorption time constant for all subcutaneous insulin, including basal

Files:
- `js/simulator.js:1366`
- `js/hovorka.js:405`
- `js/hovorka.js:409`

Problem:
- Fast-insulin variability is implemented by overwriting the global `hovorka.tau_I`.
- The same `tau_I` drives all S1/S2 depot fluxes in the Hovorka model.
- That means one rapid bolus with an extreme `tauFactor` changes the kinetics of background basal insulin and any other insulin already in the depot.

Why this matters:
- Absorption variability is injection-specific and site-specific.
- A fresh fast bolus should not globally re-time the absorption of older or basal depot insulin.
- This creates hidden coupling between unrelated doses.

Local reproduction:
- I compared two identical simulations differing only by a tiny `0.01 U` fast-insulin entry with `tauFactor = 0.5` versus `1.6`.
- After 60 minutes, plasma insulin was `7.61 mU/L` in the “fast” case and `3.93 mU/L` in the “slow” case.
- A `0.01 U` dose is far too small to explain that swing by itself. The background depot is being dragged by the bolus-specific `tau_I`.

Recommendation:
- Separate basal and bolus depot states if variability is to remain injection-specific.
- Best fix: represent each bolus as its own depot pair or use a small bank of depot states with per-dose `tau_I`.
- Minimum fix: do not let bolus `tauFactor` modify long-acting/basal kinetics.

### 3. Start-BG overrides only update plasma glucose (Q1), leaving the rest of the glucose subsystem out of equilibrium

Files:
- `js/simulator.js:871`

Problem:
- Campaign start BG overrides write only `Q1 = BG * V_G`.
- `Q2` and the rest of the steady-state balance remain at the old 5.5 mmol/L equilibrium.

Why this matters:
- The simulation starts with an internal inconsistency: plasma says one thing, peripheral glucose says another.
- That creates an artificial transient immediately after level start.

Local reproduction:
- Setting start BG to 9.0 by changing Q1 alone made BG fall to about 8.30 mmol/L within 15 minutes.
- In a comparison run where Q2 was scaled in the same direction, BG stayed near 9.09 mmol/L.

Recommendation:
- Re-equilibrate the glucose subsystem after a forced start BG.
- Minimum fix: adjust Q2 consistently when Q1 is overridden.
- Better fix: run a short constrained equilibration around the requested start state.

## Medium-priority findings

### 4. The core integrator uses a hard physiological floor of 0.5 mmol/L for plasma glucose

Files:
- `js/hovorka.js:512`
- `js/hovorka.js:513`

Problem:
- After every Euler step, Q1 is clamped to a minimum equivalent to `0.5 mmol/L`.

Why this matters:
- This improves numerical robustness, but it also changes the model itself.
- Severe hypoglycemia trajectories can never go below that floor, so the deepest part of insulin-overdose dynamics is artificially flattened.
- That affects near-terminal hypo behavior, counterregulatory drive, and brain-deficit integration.

Recommendation:
- Prefer numerical stabilization over a physiological hard floor.
- Options:
  - keep only a non-negative mass clamp (`Q1 >= 0`) and let the game-over system handle lethality;
  - reduce substep size adaptively during fast drops;
  - switch the glucose subsystem to a more stable integrator.

### 5. The circadian insulin-sensitivity curve is strong, fixed, and not well individualized

Files:
- `js/simulator.js:1193`
- `js/simulator.js:1204`
- `js/simulator.js:1206`
- `js/simulator.js:1586`

Problem:
- The model hard-codes a universal circadian pattern with a strong morning nadir (`0.70` at 08:00) and an evening peak (`1.20` at 19:00), and then feeds that directly into the insulin-action ODEs.

Why this matters:
- This is a large physiological commitment.
- It may work as a gameplay heuristic, but it is not robust enough to present as a general T1D physiology rule.
- The literature is mixed and substantially more individual-specific than this implementation suggests.

Recommendation:
- Treat this as a profile parameter or optional mode, not a universal default.
- Reduce the amplitude unless it is validated against the intended target phenotype.
- If dawn is the main target, shift more of the morning effect to hepatic output and keep peripheral ISF modulation modest.

## Lower-priority observations

### 6. Review/test wording is inconsistent with the implemented hypo floor

Files:
- `js/hovorka.js:512`
- `tests/simulation.test.js:571`
- `tests/simulation.test.js:582`

Problem:
- The code clamps plasma glucose to `0.5 mmol/L`, while the test description still says the physiological floor is `0.1`.

Why this matters:
- It makes future review and calibration harder because the test narrative no longer matches the implementation.

Recommendation:
- Align the test wording with the actual clamp, or remove the physiological claim entirely if the clamp is meant as a numerical safeguard.

## Suggested improvement order

1. Fix hepatic glycogen synthesis gating under insulin deficiency.
2. Decouple per-bolus absorption variability from the global subcutaneous depot.
3. Rework start-state overrides so Q1/Q2 are internally consistent.
4. Replace the hard 0.5 mmol/L floor with a numerically safer but less distortive approach.
5. Make circadian ISF configurable, lower-amplitude, or phenotype-specific.

## What is already good

- The model uses substepping (`dt <= 1 min`) in the core update loop, which is the right direction for numerical stability.
- The Hovorka core, stress/ketone extensions, and validation harness are documented better than in most browser-based physiology simulators.
- The local automated suite is broad and useful. The remaining issues are mainly structural edge cases that the current tests do not target.
