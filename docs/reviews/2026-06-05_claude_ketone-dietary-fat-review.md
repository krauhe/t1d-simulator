# Ketone model — does dietary fat need to feed ketogenesis?

**Author:** Claude (Opus 4.7)
**Date:** 2026-06-05
**Scope:** Physiology of dietary fat in the ketone subsystem of `js/simulator.js`.
**Files reviewed:**
- `js/simulator.js` (lines 488–525, 650–740, 1955–1990, 3870–4103, 4196–4271, 5170–5225)
- `docs/MODEL-IMPLEMENTATION.md` §11 (Ketones and Ketoacidosis), §5 (FFA Resistance)
- `docs/BG-SCIENCE.md` §23 (Ketone bodies and DKA), §10/§24 (sick-day ketogenesis)
- `tests/model-validation.html` chapter G (G.1–G.6)

---

## 1. Current implementation summary

The simulator has **two completely separate FFA pools**, by design:

| Pool | Source | Half-life | Used for | State reset (line 5177–5180, 5223) |
|---|---|---|---|---|
| `ffaBlood` | Dietary fat absorbed from intestine (`fatIntestine` → ffaBlood at τ_FAT_ABS = 150 min) | t½ = 180 min (FFA_CLEARANCE_HALF) | FFA-induced insulin resistance (`ffaResistanceFactor`, Hill on EC50=8 g) | reset to 0 |
| `ffaLipolysis` | Adipose lipolysis, driven by `lipolyseRate = LIPOLYSIS_MAX × EC50ⁿ / (EC50ⁿ + Iⁿ)` (Hill on plasma insulin; EC50=8 mU/L, n=3) | t½ = 60 min (FFA_LIPO_CLEAR_HALF) | Ketone production (`bhbProduced`) | reset to 0 |

Ketone production formula (`_substepKetones`, line 4253):
```
bhbProduced = BHB_PROD_RATE × ffaLipolysis × cpt1Activity × dt
```
where `cpt1Activity = 1 − 0.95 × Iⁿ/(EC50_CPT1ⁿ + Iⁿ)` with EC50=5 mU/L, n=5.
`ffaBlood` is **not** an argument anywhere in `_substepKetones`. Dietary fat reaches `ffaBlood` only at line 4075 and only sets `ffaResistanceFactor` (line 4081).

Both compartments are zero-initialized on reset; the pools never communicate.

---

## NOTE — Dietary fat does not enter ketogenesis (intentional but underspecified)

**Files:** `js/simulator.js:4075` (`ffaBlood` updated), `js/simulator.js:4253` (BHB formula uses only `ffaLipolysis`)
**Subsystem:** Ketone model / FFA pools.

### Problem
The model implements a hard separation: dietary fat contributes zero substrate to hepatic β-oxidation/ketogenesis, even when basal insulin is low and CPT-1 is partially open. In the keto-diet test scenario (G.3 — ~135 g/day fat, ~15 g/day carb, basal + 0.5 U bolus per meal) the model is structurally near-flat on BHB because plasma insulin from basal + tiny boluses (estimate I ≈ 9–13 mU/L while basal is active) suppresses `lipolyseRate` to ~30–40 % of max, and `ffaLipolysis` is the only substrate that can multiply with `cpt1Activity`.

The MODEL-IMPLEMENTATION.md §11 explicitly states the two pools are "different physiological sources: endogenous (adipose lipolysis) vs. exogenous (dietary fat absorption)." This is correct as a sourcing statement, but the **destination** is what matters for ketogenesis: hepatic mitochondria do not distinguish between FFA arriving from adipose albumin-FFA and FFA arriving from chylomicron-remnant or VLDL hydrolysis. Both routes ultimately produce intra-hepatocyte fatty acyl-CoA that competes for CPT-1.

### Physiological evidence

From `docs/BG-SCIENCE.md` §23 (the simulator's own science reference):

- The constraint on ketogenesis is **insulin's suppression of lipolysis and CPT-1**, not the source of FFA. "Even at low physiological concentrations [insulin] maintains partial CPT-1 inhibition and limits FFA flux" (BG-SCIENCE §23, "Physiological ketosis vs DKA").
- Steady-state ketosis with adequate basal insulin yields BHB 0.5–3 mmol/L (T1D with adequate exogenous basal during carb restriction).
- Ketogenic flux estimate: 10–30 µmol/kg/h in prolonged fasting, 100–200 µmol/kg/h in DKA (Laffel 1999, cited at BG-SCIENCE §23).
- BG-SCIENCE does not name dietary fat as an independent ketogenic substrate — but it does not *exclude* it either. The biochemistry is clear that chylomicron-derived FFA contributes a minority share of hepatic FFA flux in fed humans (most chylomicron-TAG is cleared peripherally via LPL; only the remnant reaches the liver), but the share grows substantially when the meal is fat-dominant (keto diet) and basal carb-driven lipogenesis is absent.

There is, however, no quantitative source in BG-SCIENCE today that pins down the dietary-fat share of hepatic ketogenic flux during keto-diet T1D. The user-cited clinical observation (real keto-diet T1D BHB 0.5–2 mmol/L) is consistent with adipose lipolysis alone if plasma insulin is at the low end of the basal range (I ≈ 7–9 mU/L). The question is whether the current parameter set produces enough adipose-FFA at the *modeled* basal insulin levels in G.3.

### Quantitative gap (G.3 keto scenario, model vs literature)

Approximate `ffaLipolysis` steady state (LIPOLYSIS_MAX=0.09, t½=60 min so τ = 87 min):
- I = 13 mU/L (postprandial after basal + 0.5 U bolus): `lipolyseRate ≈ 0.09 × 8³/(8³+13³) = 0.022/min`, SS ≈ 2.8 units. With `cpt1Activity ≈ 1 − 0.95 × 13⁵/(5⁵+13⁵) ≈ 0.058` → bhbProd ≈ 0.0028 × 2.8 × 0.058 = 0.00045 mmol/L/min.
- I = 9 mU/L (steady basal between meals): `lipolyseRate ≈ 0.09 × 8³/(8³+9³) ≈ 0.037/min`, SS ≈ 4.7 units. `cpt1Activity ≈ 1 − 0.95 × 9⁵/(5⁵+9⁵) ≈ 0.13` → bhbProd ≈ 0.0028 × 4.7 × 0.13 = 0.0017 mmol/L/min.
- Renal clearance above 0.5 mmol/L threshold and MM oxidation (Vmax 0.02, Km 2.0) clamp the steady state. Approximate balance at avg production 0.001 mmol/L/min:
  `0.001 ≈ 0.02 × BHB/(2 + BHB)` → BHB ≈ 0.10 mmol/L.

So the current model predicts **≈ 0.05–0.15 mmol/L BHB** for keto-diet G.3. This matches the test's "Expected: ~< 1 mmol/L plateau" but is at the *very low end* of the clinical 0.5–2.0 mmol/L observed in keto-diet T1D (BG-SCIENCE §23 quotes 0.5–3 mmol/L for "controlled carb restriction with adequate basal").

**Under-prediction magnitude: ~5–10× too low** compared to mid-range keto-diet clinical literature (0.8–1.5 mmol/L typical). Not catastrophic — the model is still in the "normal/mildly elevated" decision band — but it makes the keto-diet scenario indistinguishable from a fully fed scenario, which is educationally misleading.

The root cause is **not** the missing dietary-fat pathway. The dominant cause is that `LIPOLYSIS_EC50 = 8 mU/L` (already lowered from the physiological 13–18 mU/L) combined with `CPT1_EC50 = 5 mU/L, n = 5` makes both gates aggressively suppressed at typical basal insulin levels. Adding `ffaBlood` to `bhbProduced` would help keto-diet (where ffaBlood is huge), but it would **also** raise BHB on the normal-day G.1 scenario (where ffaBlood is large after each fatty meal), which is calibrated against Pinnaro 2021 well-controlled T1D ~0.05–0.15 mmol/L.

### Recommended minimum-viable modification (conceptual)

Two coexisting paths to close the gap, and they are not equivalent:

**Path A (preferred): Add a small dietary-fat contribution to `bhbProduced`, gated by CPT-1.** The hepatic FFA pool is the sum of adipose-derived and chylomicron-remnant-derived FFA. Conceptually:
```
bhbProduced = BHB_PROD_RATE × (ffaLipolysis + α × ffaBlood) × cpt1Activity × dt
```
where α is a unit-conversion + bioavailability factor that accounts for (a) peripheral LPL clearance taking most chylomicron-TAG before it reaches the liver (~70–80 % peripheral disposal in fed state), and (b) the `ffaBlood` unit is grams of dietary fat rather than the abstract "lipolysis units" used for `ffaLipolysis`. A starting estimate α ≈ 0.05–0.1 would make dietary fat contribute meaningfully only when `ffaBlood` is large (keto-diet) AND CPT-1 is open (low insulin) — preserving the dominant role of insulin gating.

This change preserves all existing physiology:
- CPT-1 is still the rate-limiting gate. At full insulin (G.1), CPT-1 ≈ 0.05 still gives ~95 % suppression regardless of dietary fat.
- During total insulin absence (G.6 pump failure), dietary fat is irrelevant because the patient is not eating; ffaLipolysis dominates.
- During overnight fast (G.4) and prolonged fast (G.5), ffaBlood ≈ 0 so the term is silent.

**Path B (alternative): Recalibrate lipolysis EC50 upward.** Push LIPOLYSIS_EC50 from 8 → 11 mU/L (closer to Nurjhan 1986 lower bound of 13 mU/L) to allow more endogenous lipolysis at basal-only insulin levels. This would lift G.3 and G.5 plateaus but would also shift the calibration for G.4 (overnight) and G.1 (normal day). The previous comment block at line 681–693 documents a prior calibration cycle here, so this is a known-volatile knob.

The two paths are physiologically complementary, but Path A is conceptually closer to the real biochemistry: hepatic mitochondria see the **sum** of FFA inflow regardless of source. Path A also explains a clinically observed pattern — high-fat meals during a missed-basal scenario produce ketones faster than high-protein meals of equal calorie content — which Path B cannot reproduce.

---

## NOTE — Test impact register

| Test | Current expected output | After Path A (α ≈ 0.05–0.1) | Risk |
|---|---|---|---|
| **G.1** Normal day (3 meals, full bolus, 48h) | Max BHB < 0.3 ✓ | Likely +0.05–0.15 — still ✓ but tighter margin. CPT-1 ≈ 0.05 at high I keeps the dietary-fat term mostly suppressed. | Low. Threshold check is `< 0.6`. |
| **G.2** Low-carb 30 g/day, modest fat, 72h | Plateau 0.5–2.0 mmol/L (target) | Likely +0.1–0.3 — moves toward target | Low to moderate. Currently the test passes only because the threshold is generous (`< 2.5`). |
| **G.3** Keto-diet < 20 g carb, high fat, 72h | Plateau "well suppressed" (model: ~0.1) | Likely 0.3–0.8 — closer to clinical 0.5–1.5 | Moderate. Test currently passes vacuously. Need to update description (text claims "Dietary fat does NOT directly produce ketones in this model"). |
| **G.4** 10h overnight fast | Max BHB < 0.6 (Pinnaro 2021 target ~0.05–0.3) | Unaffected — no recent dietary fat | None. ffaBlood ≈ 0 at start. |
| **G.5** 72h fast, no food | Plateau 0.5–2.0 mmol/L | Unaffected — no dietary fat throughout | None. |
| **G.6** Pump failure / DKA progression | BHB > 3.0 at 8h | Unaffected unless patient ate fat just before failure; usually scenario starts fasted | Very low. |

**Affected calibration constants:** Only `BHB_PROD_RATE` may need a small downward nudge (e.g., 0.0028 → 0.0025) if α is set on the high end and G.1/G.2 drift up. The CPT-1 and lipolysis Hill curves should remain untouched on this change — they're already calibrated against clinical insulin-titration data (Pinnaro 2021, Cahill 1970).

**Documentation updates required if Path A is implemented:**
- `MODEL-IMPLEMENTATION.md` §11 Step 3 — update the bhbProduced formula and add a paragraph on chylomicron-remnant contribution with a peripheral-LPL bioavailability note.
- `BG-SCIENCE.md` §23 — add a sentence on the dietary-fat share of hepatic FFA inflow (currently unstated; would be a science-reviewer task).
- `tests/model-validation.html` G.3 — rewrite description to drop "Dietary fat does NOT directly produce ketones" and replace with "Dietary fat contributes a small CPT-1-gated share to ketogenesis."

---

## NOTE — Confidence and alternate framings

The evidence base for *adding* dietary fat to ketogenesis as a coupling term is **moderate**:

- Biochemically rock-solid: hepatic mitochondria do not distinguish FFA source; both adipose-derived and chylomicron-remnant FFA enter the same acyl-CoA pool subject to CPT-1 gating. This is undergraduate biochemistry (Voet/Voet; Berg/Tymoczko/Stryer).
- Quantitatively softer: I cannot point to a tracer study that isolates the dietary-fat share of T1D ketogenic flux during keto diet. The Laffel 1999 figures cited in BG-SCIENCE §23 do not partition by FFA source.
- Empirically motivated: real keto-diet T1D BHB is 0.5–2 mmol/L, current model gives ~0.1 mmol/L → ~5–10× gap. This is the strongest argument for *some* change.

An **alternative explanation** for the gap that does *not* involve dietary fat: real keto-diet patients reduce their basal insulin dose by 20–40 % (clinical practice; ISPAD fasting guidelines, Hilliard 2017 cited at G.5). If the simulator's keto-diet scenario assumed reduced basal (e.g., 14 U → 10 U), plasma insulin would drop to ~6–7 mU/L between meals and lipolysis alone might reach BHB 0.3–0.8 mmol/L without needing dietary-fat coupling. The G.3 scenario currently keeps basal at 20 U/day — possibly the wrong scenario design rather than the wrong model.

**Recommended pre-implementation step:** Before adding the dietary-fat term, re-run G.3 with reduced basal (14 U/day) to test whether the lipolysis pathway alone gives clinically plausible keto-diet BHB. If yes, the model is correct and only the scenario needs adjustment (cheaper, lower risk). If no, Path A is the right minimum-viable change.

---

## Status summary

| Item | Status |
|---|---|
| Dietary fat → ketogenesis pathway (Path A) | ❌ ÅBEN — recommend running reduced-basal G.3 first, then deciding |
| G.3 scenario design (basal dose) | ❌ ÅBEN — possible scenario-level fix |
| `LIPOLYSIS_EC50` recalibration (Path B) | ⚠️ ACCEPTABEL — known-volatile knob, avoid unless Path A insufficient |
| MODEL-IMPLEMENTATION.md §11 wording | ❌ ÅBEN — update only after model decision |
| BG-SCIENCE.md §23 dietary-fat coverage | ❌ ÅBEN — science-reviewer task |

**Overall conclusion:** The implementation is **physiologically incomplete but not wrong**. The omission of dietary fat from ketogenesis is a defensible simplification at full insulin (the dominant clinical case) but breaks down in the keto-diet edge case. The under-prediction magnitude is ~5–10×, which is significant but not safety-critical (it under-predicts BHB, so it errs on the "no warning needed" side — the opposite of the dangerous direction).

**Recommendation:** Discuss with the user whether to (a) adjust the G.3 scenario design first (reduced basal — preserves model), (b) implement Path A (closes the gap mechanistically — minimal risk to G.1/G.4–6), or (c) both. Do not implement before getting a "go" signal — this is a non-trivial model change with calibration implications.
