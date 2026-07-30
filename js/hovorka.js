// =============================================================================
// HOVORKA.JS — Hovorka 2004 glucose-insulin model (Cambridge model)
// =============================================================================
//
// This file implements the published Hovorka model for simulation of
// glucose-insulin dynamics in subjects with type 1 diabetes.
//
// Model based on:
//   Hovorka R, Canonico V, Chassin LJ, et al. (2004)
//   "Nonlinear model predictive control of glucose concentration in
//   subjects with type 1 diabetes." Physiological Measurement, 25(4):905-920.
//
// Extended with exercise effects from:
//   Resalat N, El Youssef J, Reddy R, Jacobs PG. (2020)
//   "Simulation Software for Assessment of Nonlinear and Adaptive
//   Multivariable Control Algorithms." PMC7449052.
//
// JavaScript port partially based on the Python implementation:
//   https://github.com/jonasnm/svelte-flask-hovorka-simulator
//   by Jonas Nordhassel Myhre (MIT license assumed)
//
// The model consists of 16 differential equations (ODEs):
//   D1, D2      — Gut compartments (carbohydrate absorption)
//   S1, S2      — Subcutaneous RAPID insulin (subcutaneous depot)
//   Q1, Q2      — Glucose in plasma and peripheral tissues
//   I           — Plasma insulin concentration (total: rapid + basal)
//   x1,x2,x3   — Insulin action on transport, disposal, and hepatic production
//   C           — CGM sensor value (with delay)
//   E1, E2      — Contraction uptake state + filtered exercise telemetry
//   S1b, S2b    — Subcutaneous BASAL insulin (shadow cascade, fixed baseTauI=55 min)
//   Ib          — Basal plasma insulin (tracks the basal contribution to I)
//
// Exports (global): HovorkaModel class
// =============================================================================


// State-vector index map for the 16 ODE states (this.state, Float64Array(16)).
// Use these named indices instead of magic numbers when reading/writing the
// model state from anywhere (engine, simulator, debug UI, future apps), e.g.
// hovorka.state[HOVORKA_STATE_IDX.I] for plasma insulin. The numeric layout is
// fixed and shared by every consumer.
//   D1,D2   carb gut compartments         S1,S2   subcutaneous RAPID insulin depot
//   Q1,Q2   plasma / peripheral glucose   I       plasma insulin
//   x1,x2,x3 insulin action (transport / disposal / EGP suppression)
//   C       CGM sensor value              E1,E2   exercise effect (short / long)
//   S1b,S2b,Ib  subcutaneous BASAL insulin shadow cascade
const HOVORKA_STATE_IDX = Object.freeze({
    D1: 0, D2: 1, S1: 2, S2: 3, Q1: 4, Q2: 5, I: 6,
    x1: 7, x2: 8, x3: 9, C: 10, E1: 11, E2: 12,
    S1b: 13, S2b: 14, Ib: 15,
});

class HovorkaModel {

    // =========================================================================
    // CONSTRUCTOR — Create a new Hovorka model with subject-specific parameters
    // =========================================================================
    //
    // @param {number} bodyWeight - Simulated subject body weight in kg
    // @param {object} options    - Optional parameters to override defaults
    // =========================================================================
    constructor(bodyWeight = 70, options = {}) {
        this.BW = bodyWeight;

        // -----------------------------------------------------------------
        // SUBJECT-DEPENDENT PARAMETERS (scale with body weight)
        // -----------------------------------------------------------------
        // These parameters determine the model's fundamental scale and are
        // proportional to body size.
        // -----------------------------------------------------------------
        this.V_I = 0.12 * this.BW;     // Insulin distribution volume [L]
        this.V_G = 0.16 * this.BW;     // Glucose distribution volume [L]
        this.F_01 = 0.0097 * this.BW;  // Insulin-independent glucose consumption (brain + RBC etc.) [mmol/min]
        this.EGP_0 = 0.0161 * this.BW; // Basal hepatic glucose production [mmol/min]

        // -----------------------------------------------------------------
        // INSULIN SENSITIVITY PARAMETERS
        // -----------------------------------------------------------------
        // SIT, SID, SIE determine how strongly insulin affects the three
        // glucose processes. These can be varied to model individual
        // insulin sensitivity (ISF).
        //
        // options.insulinSensitivityScale: multiplier for all three parameters.
        // Used to map the player's ISF to the model's parameters:
        //   ISF > default (3.0) → scale > 1.0 → more insulin sensitive
        //   ISF < default (3.0) → scale < 1.0 → less insulin sensitive
        // -----------------------------------------------------------------
        const isScale = options.insulinSensitivityScale || 1.0;
        this.S_IT = 51.2e-4 * isScale;  // Sensitivity: transport (blood → muscle) [L/min/mU]
        this.S_ID = 8.2e-4 * isScale;   // Sensitivity: disposal (oxidation in muscle) [L/min/mU]
        this.S_IE = 520e-4 * isScale;   // Sensitivity: EGP suppression (liver) [L/mU]

        // -----------------------------------------------------------------
        // TIME CONSTANTS
        // -----------------------------------------------------------------
        this.tau_G = options.tau_G || 40;   // Time to peak carbohydrate absorption [min]
        this.tau_I = options.tau_I || 55;   // Time to peak insulin absorption [min] — modified by bolus tauFactor
        this.baseTauI = 55;                // Fixed basal tau_I [min] — unaffected by bolus variability

        // -----------------------------------------------------------------
        // REMAINING CONSTANTS
        // -----------------------------------------------------------------
        // Carbohydrate bioavailability [dimensionless]. EU convention: "carbohydrate"
        // on food labels already denotes digestible carbohydrate (fibre
        // subtracted), so ~100% is absorbed. Hovorka 2004 used A_G = 0.8
        // (UK convention: total carbohydrate including fibre). See MODEL-IMPLEMENTATION.md
        // §5 "Carb convention: EU/DK" for full discussion. BG-SCIENCE §5 cites
        // 95-100% bioavailability for digestible CHO (Englyst & Cummings 1986).
        this.A_G = 1.0;
        this.k_12 = 0.066;            // Glucose transfer peripheral → plasma [1/min]

        // Insulin action constants:
        // ka = deactivation rate (how quickly the insulin effect decays).
        // Activation is NO LONGER linear (kb·I) — it is sigmoid (Hill),
        // see HILL DOSE-RESPONSE below.
        this.k_a1 = 0.006;            // Deactivation: transport [1/min]
        this.k_a2 = 0.06;             // Deactivation: disposal [1/min]
        this.k_a3 = 0.03;             // Deactivation: EGP [1/min]

        // -----------------------------------------------------------------
        // HILL DOSE-RESPONSE (BG-SCIENCE §25, Rizza 1981) — implemented for #6
        // -----------------------------------------------------------------
        // Only the MUSCLE channel (x1, x2 = glucose Rd) receives a non-linear Hill response.
        // That is where the "dead zone" resides: §25 shows that muscle Rd is recruited LATE
        // (high EC50), while hepatic EGP and lipolysis respond EARLY (low EC50).
        // Muscle steady-state target:
        //   x_target = amplitudeMod · x_max · I^n / (EC50_eff^n + I^n)
        // → sub-linear at small doses (dead zone for corrections) and saturation at
        //   large doses. EC50_eff is shifted left by PEIS (see setInsulinModifiers).
        //
        // LIVER (x3) is kept LINEAR (x3 = amplitudeMod · S_IE · I). Rationale:
        // the model's basal insulin (I_ss ~6 mU/L) lies well below the systemic
        // Rizza liver EC50 (29 mU/L), so a literal Hill either under-suppresses at
        // basal (raises I_ss → breaks the DKA gate) or over-suppresses the mid-range
        // (deeper hypos, shifted glucagon response). The liver is an early responder
        // with a low effective threshold — proportional response is a good approximation at
        // the model's insulin scale, and the liver-muscle gap (dead-zone driver) is preserved
        // because the muscle has the high threshold.
        //
        // x_max is calibrated so muscle-Hill = old linear (S·I) at a typical bolus
        // peak (IREF_MUSCLE) — so meal doses are ~unchanged while small corrections
        // fall in the dead zone. The S factors still carry the simulated subject's ISF.
        this.EC50_muscle = options.EC50_muscle || 55;   // mU/L — muskel Rd, Rizza 1981
        this.hillN_muscle = options.hillN_muscle || 1.5;
        const IREF_MUSCLE = 35;                          // mU/L — typisk bolus-peak (matche-punkt)
        const hillMuscRef = Math.pow(IREF_MUSCLE, this.hillN_muscle) /
            (Math.pow(this.EC50_muscle, this.hillN_muscle) + Math.pow(IREF_MUSCLE, this.hillN_muscle));
        this.x1max = this.S_IT * IREF_MUSCLE / hillMuscRef;   // transport-loft
        this.x2max = this.S_ID * IREF_MUSCLE / hillMuscRef;   // disposal-loft

        // Dynamic insulin modifiers (set by Simulator.setInsulinModifiers):
        //   _amplitudeMod:     scales effect for ALL channels (circadian ISF,
        //                      vasodilation, stress/FFA/glucotox resistance).
        //   _peisMuscleFactor: post-exercise insulin sensitivity (PEIS). Shifts ONLY
        //                      muscle EC50 left (EC50_eff = EC50/peis).
        this._amplitudeMod = 1.0;
        this._peisMuscleFactor = 1.0;

        this.k_e = 0.138;             // Insulin elimination rate from plasma [1/min]

        // CGM sensor delay constant
        this.ka_int = 0.073;           // CGM interstitial delay [1/min]

        // Renal clearance (kidneys excrete glucose above threshold)
        this.R_cl = 0.003;             // Clearance rate [1/min]
        this.R_thr = 9;                // Threshold for renal excretion [mmol/L]
                                        // (Set to 9 mmol/L — physiologically correct.
                                        //  Python code used 14, which is too high.)

        // -----------------------------------------------------------------
        // EXERCISE PARAMETERS (adapted from Resalat et al. 2020)
        // -----------------------------------------------------------------
        // beta: insulin-independent glucose uptake in muscle during exercise.
        // Resalat's separate E2 insulin-action multiplier is intentionally not used:
        // the engine's delayed PEIS model already shifts muscle insulin sensitivity,
        // and retaining both pathways double-counted the same response.
        // -----------------------------------------------------------------
        // Resalat rapporterer beta som en absolut, person-tilpasset flux
        // (median 0,78 mmol/min). Simulatoren har kun vægtbaserede profiler og
        // ingen separat muskelmasse, så 0,78 bruges som 70-kg-reference og
        // skaleres lineært med kropsvægten. Ellers bliver samme absolutte optag
        // uforholdsmæssigt kraftigt ved 40 kg og for svagt ved 100 kg.
        const betaAt70Kg = options.beta || 0.78;
        this.beta = betaAt70Kg * (this.BW / 70); // Direct muscle glucose uptake [mmol/min]
        this.HR_base = options.HR_base || 60; // Resting heart rate [bpm]

        // -----------------------------------------------------------------
        // STATE VARIABLES (state vector, 16 elements)
        // -----------------------------------------------------------------
        // These are the model's "memory" — everything it needs to continue running.
        // Indices: 0=D1, 1=D2, 2=S1, 3=S2, 4=Q1, 5=Q2, 6=I, 7=x1, 8=x2, 9=x3,
        //          10=C (CGM), 11=E1 (exercise short), 12=E2 (exercise long),
        //          13=S1b, 14=S2b, 15=Ib (basal shadow compartments)
        //
        // S1b/S2b/Ib is a parallel cascade that receives ONLY basal insulin.
        // Because the insulin ODEs are linear, superposition holds:
        //   I_total = I_basal + I_rapid  (exact)
        // The shadow cascade uses baseTauI (fixed 55 min), k_e, and pulsFaktor.
        // The rapid cascade uses tau_I which varies with active injections' tauFactor.
        // This gives exact source attribution for the graph overlay without estimation.
        // -----------------------------------------------------------------
        this.state = new Float64Array(16);

        // -----------------------------------------------------------------
        // INPUTS (changed externally by the Simulator class)
        // -----------------------------------------------------------------
        this.insulinRate = 0;           // Current TOTAL insulin infusion rate [mU/min]
        this.basalInsRate = 0;          // Current BASAL insulin rate [mU/min] — for shadow cascade
        this.carbRate = 0;              // Current carbohydrate ingestion rate [mmol/min]
        this.heartRate = this.HR_base;  // Current heart rate [bpm] — set by exercise model
        // Dimensionless contraction stimulus: max(0, (HR-HRbase)/HRbase) multiplied
        // by the activity type's contraction-uptake scaling. Set to zero as soon as
        // muscular work stops; E1 itself decays continuously.
        this.exerciseInput = 0;
        this.splanchnicAbsorbMod = 1.0; // Splanchnic absorption modifier (0-1) — set by Simulator

        // Per-bolus rapid insulin absorption [mU/min]. Computed by Simulator
        // in _substepRapidInsulin() before each hovorka.step() as the sum of
        // each active bolus' own (s1, s2, tauI). Replaces the old
        // S2/tau_I calculation that required a single shared tau_I across all boluses.
        // (codex review 2026-04-07 followup, issue 3)
        this.rapidU_I = 0;

        // -----------------------------------------------------------------
        // Stress multiplier for EGP (set by Simulator)
        // -----------------------------------------------------------------
        this.stressMultiplier = 1.0;
    }


    // =========================================================================
    // initializeSteadyState — Find the basal rate that yields target BG
    // =========================================================================
    //
    // Finds the steady state for a given basal insulin rate,
    // OR (if targetBG is provided) automatically searches for the rate that yields
    // the desired blood glucose level.
    //
    // The Hovorka model's insulin parameters do not necessarily match the configured
    // subject ISF directly. We therefore use a simple binary search
    // to find the rate that produces the desired steady-state BG.
    //
    // @param {number} basalRate - Initial guess for basal insulin rate [mU/min]
    // @param {number} targetBG  - Desired steady-state BG [mmol/L] (default: 5.5)
    // @returns {number} Steady-state BG in mmol/L
    // =========================================================================
    initializeSteadyState(basalRate, targetBG = 5.5) {
        if (typeof basalRate !== 'number' || !Number.isFinite(basalRate)) {
            throw new TypeError('HovorkaModel.initializeSteadyState: basalRate skal være et endeligt tal');
        }
        if (basalRate < 0) {
            throw new RangeError('HovorkaModel.initializeSteadyState: basalRate må ikke være negativ');
        }
        if (typeof targetBG !== 'number' || !Number.isFinite(targetBG)) {
            throw new TypeError('HovorkaModel.initializeSteadyState: targetBG skal være et endeligt tal');
        }
        if (targetBG < 0.1) {
            throw new RangeError('HovorkaModel.initializeSteadyState: targetBG skal være mindst 0,1 mmol/L');
        }

        const ITERATIONS = 20;
        const TARGET_TOLERANCE = 0.02;       // mmol/L; tighter than any displayed BG precision
        const ORIGINAL_MIN_RATE = 0.5;       // preserves bit-identical normal-profile search
        const ORIGINAL_MAX_RATE = 20.0;
        const ABSOLUTE_MAX_RATE = 500.0;     // 720 U/day; hard safety ceiling for extreme API profiles
        const SETTLE_MINUTES = 2000;

        // Reset and run the autonomous fasting model at one constant basal rate.
        // All insulin is basal, so only the shadow cascade (S1b/S2b/Ib) receives input;
        // the rapid cascade remains empty. This helper is deterministic and draws no RNG.
        const evaluateRate = rate => {
            this.state.fill(0);
            this.insulinRate = 0;      // Rapid depot: no input at steady state
            this.basalInsRate = rate;  // Basal → shadow cascade
            this.carbRate = 0;
            this.heartRate = this.HR_base;
            this.splanchnicAbsorbMod = 1.0;
            this.stressMultiplier = 1.0;

            const dt = 1.0;
            for (let i = 0; i < SETTLE_MINUTES; i++) this.step(dt);

            const bg = this.glucoseConcentration;
            if (!Number.isFinite(bg)) {
                throw new Error(
                    `HovorkaModel.initializeSteadyState: ikke-endelig BG ved basalRate ${rate} mU/min`);
            }
            return bg;
        };

        // Search one bracket. The final evaluateRate call leaves the Hovorka state
        // consistent with the returned rate, which initSteadyState() relies on.
        const searchBracket = (initialLo, initialHi) => {
            let lo = initialLo;
            let hi = initialHi;
            let rate = basalRate;
            let bg = NaN;
            for (let iter = 0; iter < ITERATIONS; iter++) {
                rate = (lo + hi) / 2;
                bg = evaluateRate(rate);

                // More insulin lowers BG: BG above target raises the lower rate bound.
                if (bg > targetBG) lo = rate;
                else hi = rate;
            }
            return { rate, bg };
        };

        // Keep the historical 0.5-20 mU/min search unchanged for normal profiles.
        // This preserves the established curves bit-for-bit. Only a failed boundary
        // result activates the adaptive extension.
        let result = searchBracket(ORIGINAL_MIN_RATE, ORIGINAL_MAX_RATE);
        let residual = Math.abs(result.bg - targetBG);

        if (residual > TARGET_TOLERANCE && result.bg > targetBG
                && result.rate > ORIGINAL_MAX_RATE - 0.01) {
            // Too little insulin at the old upper bound. Double the bracket until the
            // target is crossed or the explicit safety ceiling is reached.
            let lo = ORIGINAL_MAX_RATE;
            let hi = ORIGINAL_MAX_RATE * 2;
            let hiBG = evaluateRate(hi);
            while (hiBG > targetBG && hi < ABSOLUTE_MAX_RATE) {
                lo = hi;
                hi = Math.min(ABSOLUTE_MAX_RATE, hi * 2);
                hiBG = evaluateRate(hi);
            }
            if (hiBG > targetBG + TARGET_TOLERANCE) {
                throw new RangeError(
                    `HovorkaModel.initializeSteadyState kunne ikke nå targetBG ${targetBG} mmol/L ` +
                    `inden for basalRate 0-${ABSOLUTE_MAX_RATE} mU/min ` +
                    `(BG ${hiBG.toFixed(3)} mmol/L ved øvre grænse)`);
            }
            result = searchBracket(lo, hi);
            residual = Math.abs(result.bg - targetBG);
        } else if (residual > TARGET_TOLERANCE && result.bg < targetBG
                && result.rate < ORIGINAL_MIN_RATE + 0.01) {
            // Too much insulin at the old lower bound. Zero is the physiological
            // minimum; if zero insulin still lies below target, the target is unreachable.
            const zeroRateBG = evaluateRate(0);
            if (zeroRateBG < targetBG - TARGET_TOLERANCE) {
                throw new RangeError(
                    `HovorkaModel.initializeSteadyState kunne ikke nå targetBG ${targetBG} mmol/L ` +
                    `(højeste insulinfrie steady-state BG er ${zeroRateBG.toFixed(3)} mmol/L)`);
            }
            result = searchBracket(0, ORIGINAL_MIN_RATE);
            residual = Math.abs(result.bg - targetBG);
        }

        if (residual > TARGET_TOLERANCE) {
            throw new Error(
                `HovorkaModel.initializeSteadyState konvergerede ikke mod targetBG ${targetBG} mmol/L ` +
                `(BG ${result.bg.toFixed(3)}, restfejl ${residual.toFixed(3)} mmol/L, ` +
                `basalRate ${result.rate.toFixed(6)} mU/min)`);
        }

        // Store both the calibrated rate and diagnostics for labs/audits. State and
        // returned BG correspond to the same final rate because searchBracket's last
        // evaluation is retained.
        this.steadyStateBasalRate = result.rate;
        this.steadyStateTargetBG = targetBG;
        this.steadyStateResidualBG = result.bg - targetBG;

        return result.bg;
    }


    // =========================================================================
    // COMPUTED PROPERTIES — Read important values from the state vector
    // =========================================================================

    /** Plasma glucose concentration [mmol/L] — the "true" blood glucose */
    get glucoseConcentration() {
        return this.state[HOVORKA_STATE_IDX.Q1] / this.V_G;  // Q1 / VG
    }

    /** CGM sensor value [mmol/L] — with delay and drift */
    get cgmValue() {
        return Math.max(0, this.state[HOVORKA_STATE_IDX.C]);  // C (clamped to >= 0)
    }

    /** Plasma insulin concentration [mU/L] */
    get plasmaInsulin() {
        return this.state[HOVORKA_STATE_IDX.I];  // I
    }

    /** Insulin On Board — total active insulin in the body [mU]
     *  Includes BOTH depots: rapid (S1+S2) + basal (S1b+S2b) + plasma (I × V_I).
     *  Plasma insulin has a short half-life (~5 min via k_e), but at large
     *  doses or during exercise there can be a significant amount in plasma that
     *  would otherwise appear as "used" in the IOB display. */
    get insulinOnBoard() {
        return this.state[HOVORKA_STATE_IDX.S1] + this.state[HOVORKA_STATE_IDX.S2]    // Rapid depot (S1+S2)
             + this.state[HOVORKA_STATE_IDX.S1b] + this.state[HOVORKA_STATE_IDX.S2b]  // Basal depot (S1b+S2b)
             + this.state[HOVORKA_STATE_IDX.I] * this.V_I;        // Plasma (I × V_I)
    }

    /** Carbs On Board — unabsorbed carbohydrate in the gut [mmol] → convert to grams */
    get carbsOnBoard() {
        return (this.state[HOVORKA_STATE_IDX.D1] + this.state[HOVORKA_STATE_IDX.D2]) * 180 / 1000;  // D1+D2 in mmol → grams
    }


    // =========================================================================
    // setInsulinModifiers — Dynamic modulation of insulin dose-response (#6)
    // =========================================================================
    //
    // Splits the dynamic insulin sensitivity into two physiologically distinct parts:
    //   amplitudeMod:     scales x_max for ALL three channels (circadian ISF,
    //                     vasodilation, stress/FFA/glucotox resistance). A pure
    //                     gain scaling — same role as the old setISFModifier.
    //   peisMuscleFactor: post-exercise insulin sensitivity (PEIS). Shifts ONLY
    //                     muscle EC50 left (EC50_eff = EC50/peis), so
    //                     muscle is recruited at lower insulin after exercise.
    //                     PEIS is muscle-specific (AS160/GLUT4) and does not affect liver.
    //
    // Called from Simulator.update() each tick.
    //
    // @param {number} amplitudeMod     - x_max scaling factor (>0)
    // @param {number} peisMuscleFactor - muscle EC50 left-shift factor (≥1)
    // =========================================================================
    setInsulinModifiers(amplitudeMod, peisMuscleFactor) {
        this._amplitudeMod = amplitudeMod;
        this._peisMuscleFactor = peisMuscleFactor;
    }

    // =========================================================================
    // steadyStateActions — Hill steady-state targets for insulin actions (x1,x2,x3)
    // =========================================================================
    //
    // Single source of the Hill dose-response mathematics (#6, BG-SCIENCE §25).
    // Used both by step() (as the target for the action ODEs) and at warm-start/
    // respawn (to initialise x1/x2/x3 at steady state).
    //
    //   x_target = amplitudeMod · x_max · I^n / (EC50^n + I^n)
    //
    // Muscle EC50 is shifted left by PEIS: EC50_eff = EC50_muscle / peis.
    //
    // @param {number} I - Plasma insulin [mU/L]
    // @returns {{x1:number, x2:number, x3:number}} steady-state action targets
    // =========================================================================
    steadyStateActions(I) {
        // Muscle (x1, x2): Hill with EC50 shifted left by PEIS.
        const ec50Musc = this.EC50_muscle / this._peisMuscleFactor;
        const hillMusc = Math.pow(I, this.hillN_muscle) /
            (Math.pow(ec50Musc, this.hillN_muscle) + Math.pow(I, this.hillN_muscle));
        return {
            x1: this._amplitudeMod * this.x1max * hillMusc,
            x2: this._amplitudeMod * this.x2max * hillMusc,
            // Liver (x3): linear — early responder, low effective threshold (see constructor).
            x3: this._amplitudeMod * this.S_IE * I
        };
    }

    // =========================================================================
    // step — A single simulation step (Euler integration)
    // =========================================================================
    //
    // Computes the 16 time derivatives (dX/dt) and updates the state vector.
    //
    // We use simple Euler integration: X(t+dt) = X(t) + dX/dt * dt
    // This is sufficiently accurate for our time step (~0.1-1.0 min).
    // For more accurate integration one could upgrade to RK4 (Runge-Kutta 4),
    // but Euler is faster and adequate for a game.
    //
    // @param {number} dt - Time step in minutes (simulated time)
    // =========================================================================
    step(dt) {
        // Extract state variables for readability
        const D1 = this.state[HOVORKA_STATE_IDX.D1];   // Gut compartment 1 [mmol]
        const D2 = this.state[HOVORKA_STATE_IDX.D2];   // Gut compartment 2 [mmol]
        const S1 = this.state[HOVORKA_STATE_IDX.S1];   // Subcutaneous insulin depot 1 [mU]
        const S2 = this.state[HOVORKA_STATE_IDX.S2];   // Subcutaneous insulin depot 2 [mU]
        const Q1 = this.state[HOVORKA_STATE_IDX.Q1];   // Plasma glucose [mmol]
        const Q2 = this.state[HOVORKA_STATE_IDX.Q2];   // Peripheral glucose [mmol]
        const I  = this.state[HOVORKA_STATE_IDX.I];   // Plasma insulin [mU/L]
        const x1 = this.state[HOVORKA_STATE_IDX.x1];   // Insulin action: transport
        const x2 = this.state[HOVORKA_STATE_IDX.x2];   // Insulin action: disposal
        const x3 = this.state[HOVORKA_STATE_IDX.x3];   // Insulin action: EGP suppression
        const C  = this.state[HOVORKA_STATE_IDX.C];  // CGM sensor value [mmol/L]
        const E1 = this.state[HOVORKA_STATE_IDX.E1];  // Exercise: short-term effect
        const E2 = this.state[HOVORKA_STATE_IDX.E2];  // Exercise: long-term effect

        // -----------------------------------------------------------------
        // DERIVED QUANTITIES
        // -----------------------------------------------------------------

        // Plasma glucose concentration [mmol/L]
        const G = Q1 / this.V_G;

        // Glucose absorption from the gut [mmol/min]
        // splanchnicAbsorbMod (0-1): reduces absorption during exercise due to
        // splanchnic blood flow redistribution to muscle (Qamar & Read 1987).
        // 1.0 = rest (normal absorption), 0.45 = intense exercise (-55%).
        const U_G = D2 / this.tau_G * this.splanchnicAbsorbMod;

        // Heart-rate-driven insulin absorption — increased subcutaneous perfusion during exercise.
        // At elevated heart rate, more blood flows through subcutaneous tissue, which
        // washes out insulin faster from the depot into plasma.
        // pulsFaktor = 1.0 at rest, ~1.5 at HR 120, ~1.83 at HR 160.
        // Sensitivity 0.5 means a doubling of HR above rest gives +50%.
        // Important: this affects ALL insulin in the depot — both bolus and basal!
        const pulsFaktor = 1 + Math.max(0, (this.heartRate - this.HR_base) / this.HR_base) * 0.5;

        // Insulin absorption from subcutaneous rapid depot [mU/min].
        // Per-bolus depots (codex review 2026-04-07 followup, issue 3):
        // Each active rapid bolus has its own (s1, s2, tauI), so absorption
        // is computed per dose in Simulator._substepRapidInsulin() and the sum
        // is set on this.rapidU_I before each step. The global S2/tau_I is no
        // longer used — two overlapping boluses with different tauFactor no
        // longer interfere with each other's kinetics.
        const U_I = this.rapidU_I;

        // Insulin-independent glucose consumption (brain + RBC + renal medulla + other).
        // Depends on available blood glucose via GLUT1 saturation.
        //
        // Implemented formula: F_01c = (F_01 / 0.85) × G / (G + 1)
        //
        // Design choice: we deviate from Hovorka 2004's piecewise definition
        // [F_01c = F_01 if G≥4.5; F_01 × G/4.5 if G<4.5] and instead use
        // a smooth Michaelis-Menten form with Km≈1 mmol/L. This reflects
        // GLUT1 saturation (BG-SCIENCE §1: GLUT1 Km ≈ 1-2 mmol/L)
        // and gives C¹-continuous reduction at hypoglycaemia without a breakpoint.
        //
        // The 0.85 division calibrates the formula so F_01c = F_01 at physiological
        // baseline (~5-6 mmol/L), since the factor G/(G+1) ≈ 0.83-0.86 in this
        // range. Actual values (relative to F_01):
        //   G = 10  mmol/L → 1.07 × F_01  (slightly suprabasal at hyperglycaemia)
        //   G = 5   mmol/L → 0.98 × F_01  (≈ baseline at euglycaemia)
        //   G = 4.5 mmol/L → 0.96 × F_01
        //   G = 2   mmol/L → 0.78 × F_01  (milder than Hovorka 2004's 0.44)
        //   G = 0.5 mmol/L → 0.39 × F_01  (strongly reduced)
        //   G → ∞          → 1.18 × F_01  (asymptote)
        //
        // Note: the implementation allows a slight (~7-18%) suprabasal consumption
        // at hyperglycaemia. BG-SCIENCE §4 holds CMRglc approximately
        // constant; a clamp at F_01 can be considered as a future improvement.
        const F_01s = this.F_01 / 0.85;
        const F_01c = F_01s * G / (G + 1);

        // Renal clearance — kidneys excrete glucose when BG exceeds the threshold.
        // Above ~9 mmol/L the kidneys begin to "spill" glucose into the urine.
        // This is an important protective mechanism against extreme hyperglycaemia.
        const F_R = (G >= this.R_thr) ? this.R_cl * (G - this.R_thr) * this.V_G : 0;

        // Endogenous glucose production (EGP) — hepatic glucose output.
        // EGP is a balance between insulin suppression (x3) and stimulation
        // from counter-regulatory hormones (stressMultiplier: glucagon, adrenaline).
        //
        // Formula: EGP = EGP_0 * max(0, stressMultiplier - x3)
        //
        // stressMultiplier = 1.0 (baseline) + acute stress + chronic stress + dawn + protein.
        // At rest without stress: stressMultiplier = 1.0.
        //
        // Examples (all use stressMultiplier as the combined value):
        //
        // Normal state (stressMultiplier=1.0, x3=0.3):
        //   EGP = EGP_0 * 0.7 — liver produces moderately (normal)
        //
        // Active bolus (stressMultiplier=1.0, x3=1.3):
        //   EGP = EGP_0 * 0 — insulin fully suppresses hepatic production
        //
        // Hypoglycaemia in healthy person (stressMultiplier=1.5, x3=1.3):
        //   EGP = EGP_0 * 0.2 — glucagon+adrenaline contribute +0.5 above baseline,
        //   partially overcoming insulin suppression. Physiologically correct:
        //   during hypo the glucagon signal dominates at hepatic glucagon receptors.
        //
        // Hypoglycaemia in T1D (stressMultiplier=1.4, x3=1.3):
        //   EGP = EGP_0 * 0.1 — glucagon is lost (T1D), only weak adrenaline
        //   contributes +0.4 above baseline. Very weak counter-regulation.
        //   At overdose: x3 >> stressMultiplier → EGP ≈ 0 → BG crashes.
        // Previous formula was: EGP_0 * stressMultiplier * (1 - x3)
        // Problem: when x3 > 1.0, EGP was clamped to 0 and stressMultiplier
        // could NEVER override — glucagon was ineffective during hypo!
        const EGP = Math.max(0, this.EGP_0 * (this.stressMultiplier - x3));

        // Store derived quantities so they can be read externally (e.g. for physiology dashboard).
        // These are updated on every step() call and reflect the most recent computation.
        this._lastEGP = EGP;
        this._lastF01c = F_01c;
        this._lastFR = F_R;
        this._lastUG = U_G;

        // Insulin-mediated exercise sensitivity is applied once, as a muscle-EC50
        // shift through setInsulinModifiers(). Keep this diagnostic value neutral so
        // force decomposition and dashboards do not count a second exercise gain.
        const exerciseFactor = 1.0;
        this._lastExerciseFactor = exerciseFactor;

        // -----------------------------------------------------------------
        // DIFFERENTIAL EQUATIONS (dX/dt for all 16 state variables)
        // -----------------------------------------------------------------

        // Gut compartment 1: food in, passage to compartment 2
        const dD1 = this.A_G * this.carbRate - D1 / this.tau_G;

        // Gut compartment 2: from compartment 1, absorption into blood
        const dD2 = D1 / this.tau_G - U_G;

        // Rapid depots S1/S2 (state[2]/state[3]) are NO LONGER updated here.
        // Per-bolus integration (codex review 2026-04-07 followup, issue 3):
        // Simulator._substepRapidInsulin() owns each bolus' own (s1, s2)
        // and writes the sum back into state[2]/state[3] after integration
        // (cached for IOB display and respawn logic). dS1/dS2 are therefore 0 here.

        // --- Insulin action at low BG (T1D) ---
        // NOTE: Hypo-guard has been REMOVED for T1D simulation.
        //
        // In healthy individuals the body reduces peripheral glucose uptake at
        // hypoglycaemia via glucagon-mediated hepatic insulin resistance and
        // GLUT4 downregulation. But in T1D this protection is impaired:
        //   - Glucagon response lost within 1-5 years of diagnosis
        //   - Adrenaline response often blunted (HAAF)
        //   - At supraphysiological insulin (>50-60 μU/mL) EGP is suppressed
        //     completely regardless of counter-regulatory hormones
        //
        // Consequence: massive insulin overdose (e.g. 9 U from BG=6) should be
        // lethal because insulin's clearance effect remains active even at
        // very low BG. Counter-regulation (via stressMultiplier in EGP)
        // is the only defence, and it is insufficient at large doses.
        //
        // Sources: Bengtsen 2021, Reno 2013, Rzepczyk 2022

        // Plasma glucose (Q1): THE central equation
        //   + U_G: glucose from the gut (food)
        //   + EGP: glucose from the liver
        //   + k_12 * Q2: glucose returning from peripheral tissues
        //   - F_01c: brain consumption
        //   - F_R: renal excretion
        //   - x1 * Q1: insulin-driven transport to periphery
        const dQ1 = -(F_01c + F_R) - x1 * Q1
                    + this.k_12 * Q2 + U_G + EGP;

        // Peripheral glucose (Q2): muscle and adipose tissue
        //   + x1 * Q1: inflow from plasma (insulin-driven transport)
        //   - k_12 * Q2: passive diffusion back to plasma (NOT exercise-affected)
        //   - x2 * Q2: insulin-driven oxidation in muscle. Motionsbetinget
        //     insulinfølsomhed er allerede indbygget i x1/x2-målene via EC50.
        //   - beta * E1: direct muscle uptake during exercise (insulin-independent).
        // E1 is already the filtered normalized contraction stimulus, equivalent to
        // Resalat's beta * E1_bpm / HR_base. Multiplying by heart rate again would
        // square the stimulus.
        const dQ2 = x1 * Q1 - this.k_12 * Q2
                    - x2 * Q2
                    - this.beta * E1;

        // Plasma insulin: inflow from BOTH depots (rapid + basal), elimination.
        // S1/S2 (rapid) and S1b/S2b (basal) are separate depots with their own tau_I.
        // U_Ib is computed below in the basal cascade — forward reference is OK
        // since Euler integration uses values from the start of the time step.
        const S1b_val = this.state[HOVORKA_STATE_IDX.S1b];
        const S2b_val = this.state[HOVORKA_STATE_IDX.S2b];
        const U_Ib_pre = S2b_val / this.baseTauI * pulsFaktor;
        const dI = (U_I + U_Ib_pre) / this.V_I - this.k_e * I;

        // Insulin action variables: delay between plasma insulin and metabolic effect.
        // Non-linear (Hill) dose-response — see constructor + steadyStateActions
        // (#6, BG-SCIENCE §25). x_target is the steady-state target for each
        // action; ka sets the time constant of approach toward the target:
        //   dx = ka · (x_target − x)
        const xTarget = this.steadyStateActions(I);
        const dx1 = this.k_a1 * (xTarget.x1 - x1);
        const dx2 = this.k_a2 * (xTarget.x2 - x2);
        const dx3 = this.k_a3 * (xTarget.x3 - x3);

        // CGM sensor: tracks plasma glucose with a delay
        const dC = this.ka_int * (G - C);

        // Exercise state variables.
        // E1 follows the dimensionless contraction input with Resalat's 5 min
        // immediate-effect constant. With input zero after work, E1 falls below
        // 2% after about 30 min, consistent with Young et al. 2023.
        // E2 remains a filtered telemetry state for existing state snapshots; it has
        // no glucose-flux effect. Delayed insulin sensitivity is owned by the engine.
        const tau_E1 = 5;    // Time constant for contraction-mediated uptake [min]
        const tau_E2 = 200;  // Time constant for long-term effect [min]
        const dE1 = (this.exerciseInput - E1) / tau_E1;
        const dE2 = (E1 - E2) / tau_E2;

        // --- Basal cascade (S1b → S2b → Ib) ---
        // Separate depot that receives ONLY basal insulin with fixed baseTauI (55 min).
        // Decoupled from bolus tauFactor (codex review 2026-04-07, issue 2):
        // bolus variability changes tau_I for the rapid depot (S1/S2), but basal
        // is always absorbed with standard kinetics.
        // pulsFaktor (exercise) affects both depots identically — physiologically correct.
        const S1b = this.state[HOVORKA_STATE_IDX.S1b];
        const S2b = this.state[HOVORKA_STATE_IDX.S2b];
        const Ib  = this.state[HOVORKA_STATE_IDX.Ib];
        const U_Ib = S2b / this.baseTauI * pulsFaktor;  // Basal absorption
        const dS1b = this.basalInsRate - S1b / this.baseTauI * pulsFaktor;
        const dS2b = S1b / this.baseTauI * pulsFaktor - U_Ib;
        const dIb  = U_Ib / this.V_I - this.k_e * Ib;

        // -----------------------------------------------------------------
        // EULER INTEGRATION: X(t+dt) = X(t) + dX/dt * dt
        // -----------------------------------------------------------------
        this.state[HOVORKA_STATE_IDX.D1]  += dD1 * dt;
        this.state[HOVORKA_STATE_IDX.D2]  += dD2 * dt;
        // state[2] (S1) and state[3] (S2) are updated by Simulator
        // (per-bolus rapid depots, see issue 3 above)
        this.state[HOVORKA_STATE_IDX.Q1]  += dQ1 * dt;
        this.state[HOVORKA_STATE_IDX.Q2]  += dQ2 * dt;
        this.state[HOVORKA_STATE_IDX.I]  += dI  * dt;
        this.state[HOVORKA_STATE_IDX.x1]  += dx1 * dt;
        this.state[HOVORKA_STATE_IDX.x2]  += dx2 * dt;
        this.state[HOVORKA_STATE_IDX.x3]  += dx3 * dt;
        this.state[HOVORKA_STATE_IDX.C] += dC  * dt;
        this.state[HOVORKA_STATE_IDX.E1] += dE1 * dt;
        this.state[HOVORKA_STATE_IDX.E2] += dE2 * dt;
        this.state[HOVORKA_STATE_IDX.S1b] += dS1b * dt;
        this.state[HOVORKA_STATE_IDX.S2b] += dS2b * dt;
        this.state[HOVORKA_STATE_IDX.Ib] += dIb  * dt;

        // -----------------------------------------------------------------
        // CLAMP — Physiological bounds to prevent numerical artefacts
        // -----------------------------------------------------------------
        // Negative values are not meaningful for masses and concentrations.
        // Non-negative clamp only — no physiological floor for Q1.
        // Severe hypo dynamics (BG < 0.5) are modelled correctly:
        //   - F_01c → 0 as G→0 (brain consumption stops)
        //   - EGP can still raise BG (counter-regulation)
        //   - The game-over system handles lethal hypoglycaemia
        // (codex review 2026-04-07, issue 4)
        for (let i = 0; i < 16; i++) {
            if (this.state[i] < 0) this.state[i] = 0;
        }
    }


    // =========================================================================
    // bolusToRate — Convert a bolus insulin injection to a rate
    // =========================================================================
    //
    // Converts from units (U) to mU and distributes over a short time period.
    // 1 unit insulin = 1000 mU (milli-units).
    //
    // @param {number} units - Insulin in units (U)
    // @param {number} duration - Injection time in minutes (default: 2 min)
    // @returns {number} Rate in mU/min to be set as insulinRate
    // =========================================================================
    bolusToRate(units, duration = 2) {
        return (units * 1000) / duration;  // mU/min
    }


    // =========================================================================
    // carbsToRate — Convert grams of carbohydrate to mmol/min input rate
    // =========================================================================
    //
    // Carbohydrate (glucose, C6H12O6) has a molar mass of 180.16 g/mol.
    // 1 gram carbohydrate = 1000/180.16 ≈ 5.55 mmol glucose.
    // (same molar mass as ENGINE_GLUCOSE_G_PER_MMOL in physiology-engine.js —
    //  kept consistent across files.)
    //
    // @param {number} grams - Carbohydrate in grams
    // @param {number} eatingDuration - Time taken to eat [min] (default: 15)
    // @returns {number} Rate in mmol/min
    // =========================================================================
    carbsToRate(grams, eatingDuration = 15) {
        return (grams * 1000 / 180.16) / eatingDuration;  // mmol/min
    }


    // =========================================================================
    // basalToRate — Convert daily basal dose to mU/min
    // =========================================================================
    //
    // Basal insulin (Lantus, Tresiba) is delivered in units per day.
    // We convert to a constant mU/min rate.
    //
    // @param {number} dailyDose - Daily basal dose in units (U)
    // @returns {number} Rate in mU/min
    // =========================================================================
    basalToRate(dailyDose) {
        return (dailyDose * 1000) / (24 * 60);  // mU/min
    }
}

// Expose the state-index map as a static so external consumers can read it
// via HovorkaModel.STATE_IDX without importing the module-scope const.
HovorkaModel.STATE_IDX = HOVORKA_STATE_IDX;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HovorkaModel, HOVORKA_STATE_IDX };
}
