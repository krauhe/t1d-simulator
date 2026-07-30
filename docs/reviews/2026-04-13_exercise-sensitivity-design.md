# Exercise-induced insulin sensitivity — design-specifikation

**Dato:** 2026-04-13
**Fase:** 2 af 4 (litteratur → **design** → kode → docs)
**Forudgående:** `2026-04-13_exercise-sensitivity-literature.md`
**Status:** Forslag — afventer brugerens godkendelse før Fase 3 (implementering).

---

## 1. Formål og problem

Nuværende model har ÉN post-exercise komponent med t½ 8-12 t. Testen `tests/exercise-timing-test.html` viser at motion uafhængig af timing i forhold til bolus-peak (60/90/120 min efter 2E) giver `sensitivityMultiplier = 1.20` — fordi multiplikatoren kun afhænger af (intensitet, varighed, tid siden motion), ikke af aktiv insulin.

Klinisk erfaring (og litteraturen, Sylow 2017 / Cartee 2015): Motion under aktiv bolus giver et kraftigt, hurtigt BG-dyk der forsvinder inden for 30-60 min efter motion slutter. Post-exercise er der en separat, mindre og langsommere insulinfølsomheds-forøgelse der varer 12-48 t (Mikines 1988, Riddell 2017).

**Løsning:** Opdel i to uafhængige komponenter — en **akut kontraktions-komponent** og en **langsom PEIS-komponent** — der summeres.

---

## 2. Matematisk formulering

### 2.1 Overordnet form

```
sensitivityIncreaseFactor = 1 + fastBoost(t) + slowBoost(t)
```

`currentISF`-getteren erstatter `Math.max` over motion-sessioner med en **sum** over alle aktive sessioner af de to komponenter:

```
sensitivityIncreaseFactor = 1
for hver session s i activeMotion ∪ {activeAktivitet}:
    sensitivityIncreaseFactor += fastBoost_s(t) + slowBoost_s(t)
clamp sensitivityIncreaseFactor ∈ [1.0, 4.0]   // safety cap
```

Summation (ikke max) afspejler at to samtidige sessioner additivt bidrager til GLUT4-translokation og AS160-fosforylering indtil mættning — cap'en forhindrer urealistiske værdier ved stablede motions-events.

### 2.2 Fast component (akut kontraktion / AMPK)

**Under motion** (τ = tid siden motion start, i minutter):
```
fastBoost = A_fast(intensitet, type) · rampUp(τ)
rampUp(τ)  = 1 - exp(-τ / τ_activation)     // τ_activation = 2 min
```

**Efter motion** (τ_post = tid siden motion slut):
```
fastBoost = A_fast(intensitet, type) · rampUp(D) · 0.5^(τ_post / t½_fast)
```
hvor `D` er motions-varighed. Cut-off ved `fastBoost < 0.005`.

**Amplitude `A_fast`** (dimension: dimensionsløs ISF-multiplikator minus 1):

| Intensitet | cardio (e2=1.0) | blandet (e2=0.85) | styrke (e2=0.90) | afslapning (e2=0) |
|---|---|---|---|---|
| Lav    | 0.30 | 0.25 | 0.27 | 0 |
| Medium | 0.80 | 0.68 | 0.72 | 0 |
| Høj    | 1.50 | 1.28 | 1.35 | 0 |

Formel: `A_fast = base_A_fast(intensitet) · e2Scaling`.
Base-værdier: Lav 0.30, Medium 0.80, Høj 1.50.

**Tidskonstanter:**
- `τ_activation = 2 min` (rampUp er ~95% ved 6 min — stort set øjeblikkelig)
- `t½_fast = 15 min` (Cartee 2015: AMPK decay 30-60 min ⇒ t½ ~15 min)

**Varigheds-skalering:** Ingen eksplicit duration-scaling af peak — `rampUp(D)` plateauer efter ~10 min. Kort motion (< 5 min) får naturligt lavere peak via rampUp.

### 2.3 Slow component (PEIS / AS160 / glykogen)

**Under motion** (build-up):
```
slowBoost = A_slow(intensitet, type, D) · (1 - exp(-τ / τ_buildup))
τ_buildup = 30 min
```

**Efter motion:**
```
slowBoost = A_slow · (1 - exp(-D / τ_buildup)) · 0.5^(τ_post_h / t½_slow_h)
```

Cut-off ved `slowBoost < 0.005`.

**Amplitude `A_slow`** (fuld plateau-værdi, varigheds-skaleret):
```
A_slow = base_A_slow(intensitet) · e2Scaling · sqrt(D / 60)
```
(samme sqrt-duration-scaling som den nuværende model — matcher Mikines 1988 hvor 60 min ergometer giver ~25% PEIS).

Base-værdier:
- Lav: 0.15
- Medium: 0.25
- Høj: 0.45

**Tidskonstant:** `t½_slow = 14 t = 840 min` for alle intensiteter (Mikines: effekt ved 48 t, ikke ved 120 t ⇒ t½ 14-18 t).

**Cut-off:** `sensitivityEndTime = motion_slut + 7 · t½_slow ≈ 98 t` (derefter < 0.8% — fjernes fra `activeMotion`).

### 2.4 Eksempler (60 min medium cardio, e2=1.0)

| Tid | fastBoost | slowBoost | total ISF-multiplikator |
|---|---|---|---|
| +0 min (peak, motion slut) | 0.80 | 0.25·(1-e⁻²) ≈ 0.216 | **1 + 1.016 ≈ 2.02** |
| +15 min | 0.40 | 0.21 | 1.61 |
| +30 min | 0.20 | 0.21 | 1.41 |
| +60 min | 0.05 | 0.20 | 1.25 |
| +4 t | < 0.001 | 0.17 | 1.17 |
| +14 t | 0 | 0.11 | 1.11 |
| +48 t | 0 | 0.02 | 1.02 |

### 2.5 Eksempler (10 min høj cardio efter 60 min = nuværende test-scenarie)

Ved motion-slut:
- `rampUp(10) = 1 - e⁻⁵ ≈ 0.993`
- `fastBoost = 1.50 · 0.993 ≈ 1.49`
- `slowBoost = 0.45 · 0.993 · sqrt(10/60) · (1-e⁻¹/³) ≈ 0.45 · 0.408 · 0.283 ≈ 0.052`
- `total = 2.54` — meget stærkere akut effekt end nu (1.20)

Ved +30 min efter motion slut:
- `fastBoost = 1.49 · 0.5² = 0.37`
- `slowBoost ≈ 0.048`
- `total ≈ 1.42`

Ved +2 t:
- `fastBoost ≈ 0.0006` (cut-off)
- `slowBoost ≈ 0.037`
- `total ≈ 1.04`

---

## 3. Implementerings-placering

| Fil / funktion | Ændring |
|---|---|
| `js/simulator.js`, `get currentISF()` (linje ~956-1015) | Erstat `Math.max`-loop med sum af `fastBoost + slowBoost` pr. session. Fjern nuværende ramp-up-blok (flytter ind i komponenterne). |
| `js/simulator.js`, `stopAktivitet()` (linje ~2945-3005) | Udskift beregning af `sensitivityHalfLife` og `maxSensitivityIncreaseFactor` med lagring af: `{A_fast, A_slow, t_halfFast=15, t_halfSlow=840, duration, endTime, rampUpFactor=rampUp(D)}`. |
| `js/simulator.js`, konstanter | Tilføj `EXERCISE_SENS_PARAMS` objekt øverst i klassen eller som modul-konstant. |
| `tests/exercise-timing-test.html` | Opdatér forventningerne. Tilføj 4. scenarie: 10 min motion ved +30 min (mellem insulin-peak og de øvrige). |
| `tests/simulation.test.js` | Tilføj tests: (a) fast component decay t½ ≈ 15 min; (b) slow component t½ ≈ 14 t; (c) motion ved insulin-peak giver markant større BG-fald end motion +2 t. |

**Ingen bagudkompatibilitet:** Eksisterende `motion.sensitivityHalfLife` og `motion.maxSensitivityIncreaseFactor` fjernes. `activeMotion`-records får ny struktur.

### 3.1 Ny activeMotion-record

```js
{
  intensity: "Høj",
  type: "cardio",
  startTime: 420,         // sim-minutter
  endTime: 430,
  duration: 10,
  A_fast: 1.49,           // inkl. rampUp(D) og e2Scale
  A_slow: 0.052,          // inkl. rampUp-ish, e2Scale og sqrt(D/60)
  t_halfFast_min: 15,
  t_halfSlow_min: 840,
  sensitivityEndTime: 430 + 7*840  // 98 t
}
```

### 3.2 activeAktivitet (under motion)

Under igangværende motion beregnes `fastBoost` og `slowBoost` direkte fra `activeAktivitet.startTime`, `intensitet`, `typeDef.e2Scaling`. Når motion stopper, frys værdierne ind i `activeMotion`-record'en (så decay er kontinuert).

---

## 4. Validerings-kriterier

Design er gyldigt når:

1. **Timing-afhængighed eksisterer:** 10 min høj cardio ved +60 min efter 2E bolus (insulin-peak) giver **markant** lavere BG-nadir end samme motion ved +2 t (insulin næsten tom).
   - Forventet: nadir ved +60-scenarie ≥ 1.0 mmol/L lavere end +2 t-scenarie.

2. **Kontrol-scenarie uændret:** Ingen motion → identisk BG-kurve som nuværende model (begge boosts = 0).

3. **Fast-decay realistisk:** Efter 10 min høj motion, fastBoost falder fra ~1.49 til < 0.1 inden for 60 min (4 halveringstider).

4. **Slow-decay matcher Mikines:** 60 min medium cardio → slowBoost ved +48 t ≈ 0.025 (+2-3% ISF) — svagt mærkbar, i tråd med "klar effekt ved 48 t, ingen effekt ved 5 dage".

5. **Daglig motion-akkumulation (Riddell 2017):** 60 min medium hver dag i 7 dage → baseline ISF-multiplikator ~1.10-1.20 pga. overlappende slow-haler. TDD-reduktion ~10-15% matcher klinisk observation.

6. **Intensitets-gradient:** Lav < Medium < Høj amplitude i begge komponenter. Høj > 3x Lav.

7. **Afslapning = nul:** `e2Scaling=0` → begge komponenter 0.

---

## 5. Eksplicit UDEN FOR scope i Fase 3

Følgende punkter fra litteratur-reviewet implementeres **IKKE** nu — notér dem som fremtidige TODOs:

- **CHO-accelereret PEIS-decay** (48→18 t ved kulhydrat-indtag, Mann 2021).
- **Biphasic nat-hypo (McMahon 2007)** — 9 t forsinket peak. Kræver separat glykogen-resynthesis-model.
- **Hill-intensitets-kurve (EC50=55% VO₂max).** Vi bruger stadig de 3 diskrete intensitetsniveauer som UI'et tilbyder. Kan tilføjes senere når/hvis kontinuerlig intensitet eksponeres.
- **Counter-regulation ved HIIT** (Bally 2016). Stress-hormon-modellen er separat og ændres ikke her.
- **Subkutan insulin-udvaskning under motion.** `pulsFaktor` findes allerede for dette og røres ikke.

---

## 6. Parameter-tabel (samlet)

```js
// js/simulator.js — modul-konstanter
const EXERCISE_FAST = {
  baseAmplitude: { Lav: 0.30, Medium: 0.80, Høj: 1.50 },
  tauActivation_min: 2,
  halfLife_min: 15,
  cutoff: 0.005
};

const EXERCISE_SLOW = {
  baseAmplitude: { Lav: 0.15, Medium: 0.25, Høj: 0.45 },
  tauBuildup_min: 30,
  halfLife_min: 840,  // 14 t
  cutoff: 0.005,
  endMultiplier: 7    // cleanup ved 7 × t½
};

const EXERCISE_SENS_CAP = 4.0; // total ISF-multiplikator kan ikke overstige 4x
```

`e2Scaling` og `intensitet` hentes fra `typeDef` / `activity` objekterne som nu.

---

## 7. Forventede effekter på eksisterende tests

- `tests/simulation.test.js`: Tests der assertion'er specifik ISF-multiplikator efter motion skal opdateres. Daglig TDD-drop efter uge med motion bliver måske lidt større (~12% vs. ~8%).
- Campaign-baner med motion (ingen i nuværende 3-baners pakke): Ingen.
- Box challenge: Motion-dyk bliver mere dramatisk hvis der er aktiv bolus — kan gøre bokse sværere at undgå. Ikke umiddelbart problematisk; spilleren har agency over timing.

---

## 8. Åbne beslutninger til bruger

1. **Cap-værdi:** `EXERCISE_SENS_CAP = 4.0` — skal ISF-multiplikatoren kunne blive endnu højere ved stacked motion? 4.0x virker rimeligt (Sylow 2017 nævner 50x glukose-optag men det er andet kompartment).
2. **Base-amplitude for Høj fast:** 1.50 (dvs. peak ISF ×2.5 ved høj cardio). Literature range Sylow 8-15x glukose-optag. Vi har konverteret dette til ISF-multiplikator ved empirisk vurdering — mulig justering efter validerings-testen.
3. **τ_activation = 2 min:** Meget hurtig. Kunne være 5 min. Påvirker kun meget korte motion-bursts.

Godkendelse eller ændringsforslag til disse tre punkter ønskes før Fase 3 (implementering) påbegyndes.
