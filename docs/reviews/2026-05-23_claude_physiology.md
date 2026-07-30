# Fysiologisk Model-Review — 2026-05-23

**Reviewer:** Claude (Opus 4.6, 4 parallelle sub-agenter)
**Scope:** Fuld model-review — alle subsystemer i `hovorka.js` og `simulator.js`
**Metode:** Dimensionel analyse, steady-state verifikation, klinisk plausibilitet, edge cases, subsystem-koblinger

---

## Oversigt

| Prioritet  | Antal |
|-----------|-------|
| KRITISK   | 1     |
| ADVARSEL  | 3     |
| NOTE      | 5     |
| OK        | 9     |

---

## KRITISK

### [KRITISK] CGM drift-periode er ~6× for lang (manglende 2π)

**Fil:** simulator.js, linje 2050
**Subsystem:** CGM-simulation (sinusbølge-drift)
**Problem:** `Math.sin(totalSimMinutes / cgmSystemicPeriod)` mangler `2 * Math.PI` faktor. `Math.sin(x)` har periode 2π ≈ 6.283, ikke 1. Resultatet er at driften har en faktisk periode på `cgmSystemicPeriod × 2π` = 1508–3016 minutter = **25–50 timer** i stedet for de tilsigtede 4–8 timer (240–480 min).

**Evidens:**
- Constructor linje 392: `this.cgmSystemicPeriod = (4 + Math.random() * 4) * 60` → 240–480 min
- Kommentar linje 2049: "periode 4-8 timer" — tiltænkt adfærd
- Formel linje 2050: `Math.sin(totalSimMinutes / 360)` (eksempel ved midtpunkt) → fuld periode = 360 × 2π ≈ 2262 min ≈ 37.7 timer
- Korrekt formel: `Math.sin(2 * Math.PI * totalSimMinutes / cgmSystemicPeriod)`
- Konsekvens: CGM-driften er næsten konstant over et normalt 24t-simulationsforløb, så spilleren oplever reelt ingen sinus-drift — kun støj og diskontinuiteter.

**Forslag:** Ret til `Math.sin(2 * Math.PI * this.totalSimMinutes / this.cgmSystemicPeriod)`

**STATUS:** ✅ FIKSET (2026-05-23)

---

## ADVARSEL

### [ADVARSEL] Muskelglykogen-resynthesis kan give urealistisk hurtige BG-fald

**Fil:** simulator.js, linje 3290–3344
**Subsystem:** Muskelglykogen-resynthesis (post-exercise BG-drain)
**Problem:** Ved fuld depletion (emptyFraction ≈ 1.0) + stort måltid (COB > 50g) + nylig motion (fastPhaseActivity ≈ 1.0) + god insulin + BG > 8 summerer de tre faser til op til ~1.5 g/min total resynthesis. Det svarer til ~8.5 mmol/min BG-drain fra Q1. Ved BG=7 (Q1 ≈ 78 mmol for 70 kg) ville det give et fald på ~0.75 mmol/L per minut — BG fra 7 til 3 på ~5 minutter.

**Evidens:**
- Konstanter (linje 193–195): FAST=0.8, SLOW=0.3, CHO=0.5 g/min
- Peak scenario: `(0.8 + 0.3×1.0×1.0 + 0.5×1.0×1.0) × 1.0 = 1.6 g/min`
- BG-drain: `1.6 / 0.18016 = 8.9 mmol/min`
- Ivy 1988 rapporterer 0.8 g/min peak total glycogen-syntese — men dette inkluderer laktat-recycling, ikke udelukkende plasma-glukose
- emptyFraction-scaling dæmper hurtigt (pool fyldes → factor falder), og BG ≤ 3.5 → drain = 0

**Forslag:** Cap total `resynthesis_gPerMin` (den BG-drænende del) til fx 0.5–0.7 g/min (svarende til ~3–4 mmol/min fra plasma). En del af resynthesen sker fysiologisk fra laktat og andre substrater, ikke direkte fra blodsukker.

**STATUS:** ❌ ÅBEN

---

### [ADVARSEL] Mulig triple insulin-amplifikation under motion

**Fil:** simulator.js linje 1208–1314 + 3950–3977; hovorka.js linje 424–488
**Subsystem:** Motion → insulinvirkning
**Problem:** Tre separate mekanismer forstærker insulins virkning under motion:

1. **exerciseFactor** (hovorka.js L424): `1 + α × E2²` — forstærker x1/x2 transport+disposal (GLUT4). Ved Høj cardio (E2 ≈ 45): `1 + 0.012 × 2025 ≈ 25.3`. Meget kraftig — men dette er det Resalat 2020-design der primært driver BG-faldet under motion.
2. **pulsFaktor** (simulator.js L3952): `1 + (HR-HR_base)/HR_base × 0.5` — accelererer subkutan insulinabsorption. Ved HR=150: `1 + (150-72)/72 × 0.5 ≈ 1.54`. Gælder AL insulin i depotet. Separat fysiologisk mekanisme (øget SC perfusion ≠ GLUT4).
3. **currentISF boost** (simulator.js L1208–1311): 3-komponent PEIS (fast AMPK + early glycogen + late AS160). Cap ved `EXERCISE_SENS_CAP = 4.0`. Giver op til 4× ISF-multiplikator.

Under aktiv høj-intensitet motion med fuldt opbygget PEIS:
- exerciseFactor ≈ 25 (dQ2: muskeloptag × 25)
- pulsFaktor ≈ 1.5 (insulin leveres 50% hurtigere til plasma)
- ISF-boost ≈ 2–4× (sensitivityIncreaseFactor)

**Vurdering:** exerciseFactor og ISF-boost er IKKE rent multiplikative over insulins BG-effekt — exerciseFactor virker på Q2-kinetik (perifert glukose-optag), mens ISF-boost skalerer Hovorkas x1/x2/x3 effekt-beregning via SI-parameteren. Hvis de var fuldt uafhængige ville det give urealistisk stacking, men fordi exerciseFactor allerede dominerer Q2-dynamikken under aktiv motion, og ISF-boost primært er relevant POST-exercise (når exerciseFactor = 1), er interaktionen mere sekventiel end multiplikativ.

pulsFaktor er en separat mekanisme (SC absorption, ikke muskeloptag) og stacker legitimt.

**Risiko:** Ved overlappende sessioner + høj intensitet + fuld PEIS kan det samlede system give for kraftige BG-fald. EXERCISE_SENS_CAP=4.0 er højere end litteraturen støtter (~2.0–2.5× for post-exercise sensitivity alene, Mikines 1988, Cartee 2015).

**Forslag:** Reducér EXERCISE_SENS_CAP til 2.5 og FAST Høj amplitude fra 1.50 til 1.00.

**STATUS:** ✅ FIKSET (2026-05-23) — EXERCISE_SENS_CAP 4.0→2.5, FAST Høj 1.50→1.00. MODEL-IMPLEMENTATION.md opdateret inkl. eksempel-tabel og late-amplituder synkroniseret med kode.

---

### [ADVARSEL] Acidose-kommentarer er forældede (3× hurtigere DKA end dokumenteret)

**Fil:** simulator.js, linje 616–621
**Subsystem:** DKA / acidosis progression
**Problem:** Kommentarerne i constructoren beskriver tidsforløb for game-over baseret på BASE_RATE=0.1 og ACCEL_RATE=0.015 (gamle værdier). De aktuelle konstanter er BASE_RATE=0.3 og ACCEL_RATE=0.05 — dvs. DKA-progression er ~3× hurtigere end dokumenteret.

**Evidens:**
- Kommentar L617: "BHB 3.5: load ~0.05/min → game over ~200 timer"
- Med aktuelle BASE=0.3: BHB 3.5 → `0.3 × (3.5/3.0)^2 = 0.3 × 1.36 = 0.41/min` → game over ~24 timer (THRESHOLD=600)
- Kommentarens 200 timer passer til gamle BASE=0.1: `0.1 × 1.36 = 0.136/min → 73 timer` — stadig ikke 200, men tættere
- Alle tidsestimater i kommentaren er 3–6× for langsomme ift. aktuel kode

**Forslag:** Opdatér kommentaren med korrekte estimater for de nuværende konstanter.

**STATUS:** ✅ FIKSET (2026-05-23) — Kommentarer opdateret med korrekte tidsestimater for BASE=0.3, ACCEL=0.05.

---

## NOTE

### [NOTE] gaussRand NaN-risiko ved Math.random()=0

**Fil:** simulator.js, linje 1336–1339
**Subsystem:** Tilfældig variation (Box-Muller)
**Problem:** `Math.log(u1)` er `-Infinity` når `u1 = 0`. `Math.sqrt(-2 * -Infinity)` = `Infinity`. `Infinity × Math.cos(...)` = `±Infinity` eller `NaN`. Resultatet propagerer til CGM-værdien.

**Evidens:**
- `Math.random()` returnerer `[0, 1)` — dvs. 0 er muligt men ekstremt sjældent (~1 per ~2^53 kald)
- I praksis: ~1e-15 sandsynlighed per kald. Med ~1440 kald/simuleret dag er det ~1 per 7×10¹¹ dage
- Konsekvens ved udløsning: CGM-værdien bliver NaN → visuelt forsvinder CGM-punktet

**Forslag:** `const u1 = Math.random() || 1e-10;` — triviel fix, minimal risiko.

**STATUS:** ✅ FIKSET (2026-05-23)

---

### [NOTE] F_01c clampes ikke ved F_01 under hyperglykæmi

**Fil:** hovorka.js, linje 380–381
**Subsystem:** Hovorka core — hjernens glukoseforbrug
**Problem:** Michaelis-Menten formlen `F_01s × G / (G + 1)` har asymptote ved `F_01/0.85 ≈ 1.18 × F_01`. Ved BG > 10 mmol/L er F_01c op til 18% over F_01. BG-SCIENCE §4 beskriver cerebral metabolisk rate som tilnærmelsesvist konstant.

**Evidens:**
- Kommentar L370: "G=10 → 1.07 × F_01 (let superbasal ved hyperglykæmi)"
- Kommentar L377–379 anerkender dette: "en clamp ved F_01 kan overvejes som fremtidig forbedring"
- Kvantitativ effekt: ~7–18% over baseline. For 70 kg (F_01 ≈ 0.95 mmol/min): max overskud ≈ 0.17 mmol/min ≈ 2.7 mmol/L/dag
- Original Hovorka 2004 bruger samme formel uden clamp

**Vurdering:** Bevidst design-valg, anerkdent i kommentar. Kvantitativ effekt er lille. Hovorka original gør det samme.

**STATUS:** ⚠️ BY DESIGN

---

### [NOTE] BMR opdateres ikke med vægtændring

**Fil:** simulator.js (constructor BMR-beregning)
**Subsystem:** Energibalance / kalorieforbrænding
**Problem:** BMR beregnes én gang i constructoren baseret på startvægten. Hvis spilleren taber/tager på (via `weightChangeKg`), opdateres BMR ikke.

**Evidens:**
- Typisk vægtændring i en 24t-simulation er < 0.5 kg
- BMR-effekt af 0.5 kg: ~5–7 kcal/dag — negligibelt
- Over multi-dags kampagnebaner (bane 9: 3 døgn) kan ændringen i princippet nå 1–2 kg, men selv da er BMR-effekten < 20 kcal/dag

**Vurdering:** Negligibelt for spillets tidshorisont. Kun relevant ved evt. fremtidige uge-lange simulationer.

**STATUS:** ⚠️ ACCEPTABEL

---

### [NOTE] Kommentar-inkonsistens i hovorka.js EGP-eksempler

**Fil:** hovorka.js, linje 400 vs 405
**Subsystem:** EGP-dokumentation
**Problem:** Linje 400 bruger "stress=1.5" som stressMultiplier direkte (1.5 → EGP = EGP_0 × 0.2), mens linje 405 bruger "stress=0.4" som et additivt bidrag (0.4 → stressMultiplier = 1.4 → EGP = EGP_0 × 0.1). Notationen er inkonsistent.

**Forslag:** Brug konsistent notation med stressMultiplier som samlet værdi i alle eksempler.

**STATUS:** ✅ FIKSET (2026-05-23) — Alle eksempler bruger nu "stressMultiplier=X" konsistent, med forklaring af hvad bidraget er over baseline 1.0.

---

### [NOTE] netKcal beregnes to steder med identisk formel

**Fil:** simulator.js, linje 4262 og 4279
**Subsystem:** Energibalance / UI
**Problem:** `netKcal = totalKcalConsumed - totalKcalBurnedBase - totalKcalBurnedMotion` beregnes to gange — først i model-update (L4262 → weightChangeKg) og igen i UI-blokken (L4279 → textContent). Identisk formel, ingen fejl, men redundant.

**Vurdering:** L4262 er model-logik (skal altid køre), L4279 er UI-visning (kun ved synlig stats-panel). Duplikering er harmløs og giver klarhed i begge kontekster.

**STATUS:** ⚠️ ACCEPTABEL

---

## OK — Verificerede subsystemer

### [OK] Hovorka ODE-model: dimensionel konsistens

**Fil:** hovorka.js, linje 340–540
Alle 16 ODE'er verificeret: enheder balancerer korrekt. Insulin subkutan → plasma → effektvariabler (x1/x2/x3) → glukose Q1/Q2 → BG. Tidsenhed = minutter konsekvent. Masse = mmol (glukose) og mU (insulin).

### [OK] Rapid insulin absorption (2-kompartment)

**Fil:** simulator.js, linje 3942–3991
Massebevarelse verificeret: 10U bolus → s1(0)=10000 mU → total absorption = 10000 mU → 10U. Enheder korrekt (mU/min). Peak absorption ~38 min. Edge cases beskyttet (Math.max(0,...), tom-array check).

### [OK] Fedt-absorption og FFA-induceret insulinresistens

**Fil:** simulator.js, `_substepFatProteinFFA()` linje 3780–3917
60g fedt → ffaResistanceFactor ≈ 1.36 → 36% ISF-reduktion. Wolpert 2013: 25–35%. God match. Enheder konsistente (gram). Hill-funktion med EC50=8g, n=2. Edge cases: Math.max(0,...) på alle pools.

### [OK] Protein-glucagon pathway

**Fil:** simulator.js, `_substepFatProteinFFA()` linje 3900–3917
75g protein → aminoAcidsBlood peak ~8–12g → proteinGlucagonLevel ≈ 0.125 → EGP-boost → BG-stigning ~2 mmol/L. Paterson 2016: 1.5–2.5 mmol/L. God match. Hill-funktion (n=2, EC50=8g) giver fysiologisk mætning.

### [OK] Keton-model (FFA → lipolyse → BHB)

**Fil:** simulator.js, `_substepKetones()` linje 4043–4085
Enheder korrekt (mmol/L). Michaelis-Menten clearance + renal udskillelse. 8t pumpesvigt → BHB ≈ 3.5–4.5 mmol/L (transient). Langvarig SS → BHB ~10–12 mmol/L (fysiologisk korrekt, Laffel 1999). exerciseKetoneBoost beskyttet med Math.max(1.0,...). Hard-cap ved 20 mmol/L.

### [OK] Leverglykogen-reserve

**Fil:** simulator.js, `updateGlycogenReserve()` linje 3107–3235
Enheder korrekt (g/min). Tømning ved I=0: ~20t (Petersen 2004: 24–48t — lidt hurtigt men acceptabelt for T1D). Postprandial opfyldning: 0.36 g/min ved BG=8 → 43g over 2t (Gonzalez 2016: 40–60g total). GNG-replenishment balancerer i steady-state.

### [OK] Stress-hormoner og HAAF

**Fil:** simulator.js (constructor + update)
Akut stress (adrenalin) + kronisk stress (cortisol) korrekt koblet til stressMultiplier → EGP. HAAF-svækkelse af kontraregulering med hypo-dybde × varighed. Recovery over dage. Circadian-ISF med morgen-dip og aften-boost.

### [OK] Dawn-fænomen

**Fil:** simulator.js, `circadianISF` getter linje 1501–1541
Cortisol-peak 06–10 giver ISF-reduktion. Amplitude varierer dag til dag (gaussRand). Søvndeprivation forstærker dawn (+30–50%, Leproult 1997). Korrekt koblet til circadianISF.

### [OK] CGM-model (bortset fra drift-perioden)

**Fil:** simulator.js, linje 2003–2111
Interstitiel forsinkelse (førsteordens lavpasfilter), proportional støj (3–5% CV), diskontinuiteter, kompression-lows, sensor-tab, kalibreringsjump. Alt verificeret korrekt undtagen drift-perioden (se KRITISK fund).

---

## Samlet status-opsummering

| # | Prioritet | Titel | Status |
|---|-----------|-------|--------|
| 1 | KRITISK | CGM drift mangler 2π | ✅ FIKSET |
| 2 | ADVARSEL | Muskelglykogen resynthesis for aggressiv BG-drain | ❌ ÅBEN |
| 3 | ADVARSEL | Triple insulin-amplifikation under motion | ✅ FIKSET |
| 4 | ADVARSEL | Acidose-kommentarer forældede | ✅ FIKSET |
| 5 | NOTE | gaussRand NaN-risiko | ✅ FIKSET |
| 6 | NOTE | F_01c ikke clamped ved F_01 | ⚠️ BY DESIGN |
| 7 | NOTE | BMR statisk | ⚠️ ACCEPTABEL |
| 8 | NOTE | EGP-kommentar inkonsistent | ✅ FIKSET |
| 9 | NOTE | netKcal dobbelt-beregnet | ⚠️ ACCEPTABEL |
