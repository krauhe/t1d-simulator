# Fysiologisk Model-Review — 2026-06-02

**Reviewer:** Claude (Opus 4.7)
**Scope:** Fuld projekt-gennemgang — hovorka.js + simulator.js + sammenhæng med docs og forrige reviews.
**Metode:** Læsning af aktuel kildekode, sammenligning med forrige reviews (særligt 2026-05-23 og 2026-06-01), dimensionel analyse, steady-state, edge cases og koblinger.
**Forrige status:** 2026-05-23 efterlod ét ÅBEN punkt (muskelglykogen-resynthesis). 2026-06-01 fikset alle UI/docs-issues.

---

## Oversigt

| Prioritet | Antal |
|-----------|-------|
| KRITISK   | 1     |
| ADVARSEL  | 3     |
| NOTE      | 5     |
| OK        | 10    |

Status efter 2026-06-04-fix: det kritiske muskelglykogen-fund, de tre advarsler og CGM-kommentar-mismatch er rettet. `bolusToRate()` og protein-glucagon-fordelingen står fortsat som åbne oprydnings-/dokumentationspunkter.

---

## KRITISK

### [KRITISK] Muskelglykogen-resynthesis BG-drain er stadig ÅBEN og forværret af manglende substep-integration

**Fil:** [simulator.js:3276–3362](js/simulator.js#L3276), kaldt fra [simulator.js:2812](js/simulator.js#L2812) inde i `updateStressHormones()`
**Subsystem:** Muskelglykogen-pool, post-exercise resynthesis-drain af Q1

**Problem (del A — kalibrering, uændret fra 2026-05-23):**
Ved fuld depletion + nylig motion + COB ≥ 50g + normal insulin + BG > 8 mmol/L summerer de tre faser i `updateMuscleGlycogen()` til:

```
fastPhase = 0.8 × 1.0      = 0.80 g/min
slowBase  = 0.3 × 1.0 × 1.0 = 0.30 g/min
choAccel  = 0.5 × 1.0 × 1.0 = 0.50 g/min
sum × emptyFraction(=1.0)   = 1.60 g/min
```

Konvertering til BG-drain via Q1: 1.60 g/min × (1/0.18016) ≈ 8.9 mmol/min. For 70 kg (V_G = 11.2 L) bliver BG-fald ≈ 0.79 mmol/L/min — BG fra 7 til 3 på ~5 minutter er stadig muligt.

**Problem (del B — nyt fund: ikke substep-integreret):**
`updateMuscleGlycogen()` kaldes via `updateStressHormones()` ved [simulator.js:1592](js/simulator.js#L1592) — dvs. FØR substep-løkken og med fuld `simulatedMinutesPassed`-dt. Substep-løkken (max 1.0 min) beskytter ikke denne drain.

Konsekvenser ved standard hastighed (1s real = 1 sim-min):
- BG-drop pr. tick op til 0.79 mmol/L
- Numerisk semi-implicit Euler er stadig stabil, men single-tick-drops på 0.8 mmol/L bryder den forventede "glat kurve"-præmis

Konsekvenser ved højere simulationshastigheder (4–10× via speedSelector):
- BG-drop pr. tick proportionelt skaleret (3–8 mmol/L i ekstreme tilfælde)
- `q1Min = V_G × 1.0` (linje 3355) capper kun hvis Q1 ville blive under 11.2 mmol — det er en sikkerhedsnet, ikke en fysiologisk grænse, og giver et "knæk" på grafen ved BG=1.0

**Evidens:**
- Substep-løkke: [simulator.js:1901–1971](js/simulator.js#L1901). Bruger maxStepSize = 1.0 for Hovorka + fedt/protein/FFA + ketoner.
- updateMuscleGlycogen kaldes UDEN for denne løkke: [simulator.js:2812](js/simulator.js#L2812)
- BG-drain: [simulator.js:3351–3357](js/simulator.js#L3351) — `mmolUptaken = resynthesis_gPerMin * dt / GLUCOSE_G_PER_MMOL` med dt = fuld tick-dt.
- Q1-floor (linje 3355): `q1Min = V_G * 1.0` — kun fysisk minimum, ingen rate-cap.
- Ivy 1988 rapporterer 0.8 g/min peak total glykogen-syntese, men dette inkluderer laktat-recycling og glykogensyntase-aktivitet på substrater der IKKE er direkte plasma-glukose. Plasma-disposal er typisk halvdelen (~0.3–0.5 g/min).

**Forslag (to-trins):**
1. **Kalibrering:** Cap `resynthesis_gPerMin` (BG-drænende del) til 0.5–0.7 g/min — svarende til 2.8–3.9 mmol/min plasma-drain. En del af resynthesen sker fysiologisk fra laktat, glycerol og andre substrater, ikke direkte fra plasma-glukose.
2. **Substep-integration:** Flyt `updateMuscleGlycogen()` ind i substep-løkken (lig fedt/protein/FFA) eller alternativt opdel kun BG-drain-delen så Q1-drain integreres med dt ≤ 1 min. Dette gør grafen glat og fjerner speed-afhængig adfærd.

**STATUS:** ✅ FIKSET (2026-06-04) — BG-drain fra muskelglykogen-resynthesis er cap'et ved 0.6 g/min, mens pool-resynthesis fortsat bruger fuld metabolisk rate. `updateMuscleGlycogen()` er flyttet ind i substep-løkken, så Q1-drain integreres med `dt ≤ 1 min`.

---

## ADVARSEL

### [ADVARSEL] Hyperglykæmi-medieret mavetømningsdelay: kommentar-tabel overstater faktisk formelværdi

**Fil:** [simulator.js:3856–3875](js/simulator.js#L3856)
**Subsystem:** Mavetømning (τG) — hyperglykæmi-feedback

**Problem:** Kommentarens kvantitative tabel matcher ikke den faktiske formel `1 + 0.6 × hyperExcess / (hyperExcess + 6)`.

| BG | hyperExcess | Faktisk hyperMod | Comment claims |
|----|-------------|------------------|----------------|
| 10 | 2  | 1.15 | 1.15 ✓ |
| 12 | 4  | 1.24 | 1.30 (overstated) |
| 15 | 7  | 1.32 | 1.42 (overstated) |
| 20 | 12 | 1.40 | 1.50 (overstated) |

Værdiafvigelsen er konsistent ~0.08–0.10 ved højere BG. Ikke en fysisk fejl — formlen ER monotont stigende mod 1.60 (asymptote) — men kommentar-tabellen blev sandsynligvis genereret med en ældre formel-variant. Det forvirrer fremtidige reviewere og kalibrerings-arbejde.

**Evidens:** Direkte indsætning i `1 + 0.6 × x / (x + 6)`. Tjekket BG=15: 0.6 × 7/13 = 0.323 → 1.323, ikke 1.42.

**Forslag:** Opdater kommentartabellen til den faktiske formel-værdi, ELLER ret formel-konstanterne hvis det tilsigtede target var Schvarcz 1997's +60–75% ved BG=8 flydende.

**STATUS:** ✅ FIKSET (2026-06-04) — kommentar-tabellen er rettet til de faktiske værdier fra `1 + 0.6 · x / (x + 6)`, og MODEL-IMPLEMENTATION beskriver evidensgrundlag og begrænsninger.

---

### [ADVARSEL] acuteStressLevel cap = 0.4, men docs beskriver cap som 1.0 (= "double production")

**Fil:** [simulator.js:905–924](js/simulator.js#L905) (docs), [simulator.js:2796](js/simulator.js#L2796), [simulator.js:3379–3382](js/simulator.js#L3379) (cap)
**Subsystem:** Stresshormoner (akut) → EGP

**Problem:** Constructor-dokumentationen siger:
> "stressMultiplier = 1.0 + acuteStressLevel + chronicStressLevel + circadianKortisolNiveau"
> "At acuteStress = 1.0: double production (multiplier = 2.0)."

Men koden cap'er `acuteStressLevel` ved 0.4 både i hypo-respons-grenen (linje 2796) og i den public `addAcuteStress()` API (linje 3380). Det betyder den øvre grænse er reelt 1.4 EGP-multiplikator fra akut alene, ikke 2.0.

**Konsekvens:** Eksterne scenarier (campaign-tips, future "fight-or-flight"-features) kan ikke nå den dokumenterede max-effekt. Også: kontraregulering i T1D-modellen er allerede svækket via counterRegFactor (HAAF) og glycogenReserve — det dobbelte cap (×0.4 fra konstant + ×counterRegFactor + ×reserve) gør stressforsvaret meget svagt. Det er en BEVIDST pædagogisk pointe (kommentar linje 2780–2791: "hypo ER farligt ved T1D, spilleren skal lære at undgå det"), men dokumentationen i constructor-kommentaren afspejler ikke koden.

**Forslag:** Opdater constructor-kommentar 909–924 så den siger "cap = 0.4 (T1D-svækket respons)", ELLER hæv cap'en hvis 2.0-eksempel var målet.

**STATUS:** ✅ FIKSET (2026-06-04) — constructor-kommentaren beskriver nu `acuteStressLevel` cap = 0.4 som et bevidst T1D-svækket kontraregulationsvalg.

---

### [ADVARSEL] Glucagon-injektion: +10–15 mmol/L er højere end klinisk evidens

**Fil:** [simulator.js:4290–4309](js/simulator.js#L4290)
**Subsystem:** Emergency glucagon

**Problem:** `useGlucagon()` tilføjer `deltaBG = 10 + random()×5` mmol/L instantant til Q1. Kommentar 4283 siger "instantly raises BG by 10-15 mmol/L".

Litteraturen er mere moderat:
- Carstensen et al. 1994: 1 mg glucagon hos T1D giver +3–8 mmol/L over 20–30 min
- Pearson 2008 (mini-dose glucagon): +2–5 mmol/L for 150 µg
- Total liver glycogen ~80–100 g → maks ~440–550 mmol → fordelt på V_G=11.2 L = teoretisk +40 mmol/L hvis ALT frigives øjeblikkeligt og uden samtidig periferi-clearance

Inden for "akut emergency-bolus uden samtidig glukose-clearance" er +10–15 mmol/L muligt men i overkanten af litteraturen. Vigtigere: effekten er øjeblikkelig (single-tick) i modellen, mens reelt forløb er 5–15 min via leverens glykogenolyse.

**Konsekvens:** Spilleren kan "redde" sig fra dybe hypoer hurtigere end realistisk. Pædagogisk: lærer ikke at glucagon tager tid at virke.

**Forslag:** Enten reducer til +5–10 mmol/L, ELLER konverter til en gradvis effekt (fx tilføj som 0.3–0.5 mmol/min over 15 min via stressMultiplier-bidrag). Sidstnævnte er mere fysiologisk men kræver state-tracking.

**STATUS:** ✅ FIKSET (2026-06-04) — instant `+10-15 mmol/L` er erstattet af en graduel, mass-conserving glucagon-injektion der mobiliserer op til 35 g fra `liverGlycogenGrams` over en trekant-profil.

---

## NOTE

### [NOTE] CGM upper clamp = 30, men dokumentation siger 25

**Fil:** [simulator.js:2086](js/simulator.js#L2086)
**Subsystem:** CGM-simulation

**Problem:** Faktisk clamp: `Math.max(2.2, Math.min(30.0, this.cgmBG))`. Inline-kommentar siger "(hævet fra 25 for bedre synlighed på grafen)". Men block-kommentaren i sektionen ([simulator.js:2036](js/simulator.js#L2036)) siger "Resultatet clampes til 2.2-25.0 mmol/L (reelt sensorinterval)" — uforanderet siden den oprindelige værdi.

Reelle CGM-sensorer har clinical range 2.2–22.2 mmol/L (Dexcom G6/G7, Libre 2/3) — ingen sensor måler over 25 i praksis. Hævelsen til 30 er en spil-pragmatisk beslutning, ikke en kalibrerings-ændring.

**Forslag:** Opdater block-kommentar 2036 til "(hævet fra 22.2 til 30 for grafvisning ved svær hyperglykæmi)".

**STATUS:** ✅ FIKSET (2026-06-04) — block-kommentaren siger nu 2.2-30.0 mmol/L og forklarer at 30 er en spilvisningsgrænse, ikke et reelt sensorinterval.

---

### [NOTE] hovorka.js `bolusToRate()` er dead code

**Fil:** [hovorka.js:589–591](js/hovorka.js#L589)
**Subsystem:** Bolus-konvertering

**Problem:** Metoden er bibeholdt fra før per-bolus depots blev introduceret (codex review 2026-04-07 followup, issue 3). Simulator deponerer nu direkte i ins.s1 ([simulator.js:1675–1681](js/simulator.js#L1675)) og bruger ikke længere `bolusToRate()`. Grep over hele kodebasen viser kun definitionen, ingen kald.

**Forslag:** Slet metoden — ingen bagudkompatibilitet at bevare (jf. AGENTS-regel "Ingen bagudkompatibilitet"). Hvis den efterlades, bør den have en kommentar om at den er deprecated og hvad alternativet er.

**STATUS:** ❌ ÅBEN

---

### [NOTE] F_01 (hjerneforbrug) overstiger Hovorka 2004 / litteratur slightly

**Fil:** [hovorka.js:57](js/hovorka.js#L57)
**Subsystem:** Insulin-uafhængigt glukoseforbrug

**Problem:** `F_01 = 0.0097 × BW` matcher Hovorka 2004 præcist. Men ved 70 kg giver det 0.679 mmol/min → 0.122 g/min → 7.3 g/time → 175 g/dag.

Litteratur:
- Cerebral glucose oxidation: ~120 g/dag (raske voksne, McCall 1988)
- F_01 dækker også RBC, nyremedulla, andre insulin-uafhængige væv (Hovorka definerer som "non-insulin-mediated glucose disposal")
- Samlet ikke-insulin-medieret disposal: ~155 g/dag (Best 1996 isotop)

7.3 g/time er moderat over den øvre litteratur-grænse for kombineret CMRglc+RBC+nyremedulla. Den oprindelige Hovorka-parameter er sandsynligvis kalibreret til hans MPC-kohorte, ikke til populations-mean. Effekten på BG-trajektorierne er lille (~5–10% overschätzung af basal disposal), og fordi simulator-ISF er kalibreret empirisk omkring denne F_01, er det ikke en akut fejl.

**Forslag:** Ingen ændring nødvendig — Hovorka 2004's originale parameter bevares for konsistens med kilden. Tilføj eventuelt note i `MODEL-IMPLEMENTATION.md` §4 om at F_01 lå let over populationsmean i kohorten.

**STATUS:** ⚠️ ACCEPTABEL (bevidst Hovorka-fidelity)

---

### [NOTE] Protein-glucagon vs. acute-stress: forskellig glycogen/GNG-fordeling

**Fil:** [simulator.js:1875–1880](js/simulator.js#L1875) (acuteStress 60/40), [simulator.js:1918–1919](js/simulator.js#L1918) (proteinGlucagon 50/50)
**Subsystem:** EGP-dekomponering på glycogenolysis vs. gluconeogenese

**Problem:** De to subsystemer bruger forskellig fordeling:
- Akut stress: `× (0.6 × reserve + 0.4)` → 60% glycogenolysis, 40% GNG ved fuld reserve
- Protein-glukagon: `× (0.5 × reserve + 0.5)` → 50% glycogenolysis, 50% GNG ved fuld reserve

Ingen kommentar forklarer hvorfor protein-glukagon er mindre glycogen-afhængig end akut adrenalin/glukagon-respons. Klinisk er det plausibelt: aminosyre-induceret glukagon er mere relateret til substrat-tilstedeværelse (GNG-driver), mens akut adrenalin er hurtig glycogen-mobilisering. Men ingen kilder citeres for præcis 50/50 vs 60/40.

**Forslag:** Tilføj inline-kommentar med fysiologisk begrundelse eller kilde-reference. Eller harmoniser til 60/40 hvis forskellen ikke er begrundet.

**STATUS:** ❌ ÅBEN (dokumentations-/kalibrerings-spørgsmål)

---

### [NOTE] Combined ISF-swing teoretisk op til ~6× (sensitivity × resistance)

**Fil:** [simulator.js:1320–1325](js/simulator.js#L1320)
**Subsystem:** currentISF — samlet skalering

**Problem:** Final ISF beregnes som:
```
(ISF × circadianISF × vasodilatationFaktor × sensitivityIncreaseFactor) / combinedResistance
```

Med:
- circadianISF: 0.70–1.20
- sensitivityIncreaseFactor cap: 2.5 (EXERCISE_SENS_CAP)
- combinedResistance cap: 2.5

I teoretisk worst-case (aften, post-massiv-motion, ingen resistance): ISF × 1.20 × 2.5 = 3× nominalt.
I teoretisk worst-case (morgen, max stress+FFA+glucotox, ingen motion): ISF × 0.70 / 2.5 = 0.28× nominalt.

Total range: 3 / 0.28 = ~10.7× swing mellem extremerne. Det er KUN nåbart i ekstreme samtidige tilfælde, men det giver et meget bredt operativt vindue. Klinisk evidens (Hinshaw 2013, Sohag 2022) finder typisk 1.5–2× døgnvariation alene; 10× combined er ud over publiceret evidens.

**Vurdering:** Hvert enkelt subsystem er kalibreret mod sin egen kilde, og cap'ene er individuelt forsvarlige. Den kombinerede effekt er emergent og kan i praksis sjældent nås (alle ekstremer på samme tid). Værd at være opmærksom på hvis fremtidige scenarier samler flere stressors.

**Forslag:** Ingen kode-ændring. Tilføj evt. en sanity-test der verificerer at currentISF i typiske gameplay-scenarier holder sig inden for 0.4–2.0× ISF.

**STATUS:** ⚠️ ACCEPTABEL

---

## OK — Verificerede subsystemer

### [OK] CGM-drift med korrekt 2π-faktor

**Fil:** [simulator.js:2062](js/simulator.js#L2062)
Formlen er nu `Math.sin(2 * Math.PI * totalSimMinutes / cgmSystemicPeriod)`. KRITISK-fund fra 2026-05-23 forblivar fikset.

### [OK] Per-bolus rapid insulin depots

**Fil:** [simulator.js:4004–4053](js/simulator.js#L4004), [hovorka.js:359](js/hovorka.js#L359)
Hver bolus integreres med egen tauI. Mass-balance verificeret: ds1 + ds2 = -s2/tauI × pulsFaktor → total mU forlader korrekt. Total U_I = Σ s2_i / tauI_i × pulsFaktor.

### [OK] Insulin trapez effective-area normalisering

**Fil:** [simulator.js:1639–1641](js/simulator.js#L1639)
`effectiveArea = totalDuration - rampUp/2 - tailOff/2` matcher trapez-arealets analytiske formel. Bioavailable insulin går ikke tabt.

### [OK] Acidose-kommentarer matcher nu kode

**Fil:** [simulator.js:616–621](js/simulator.js#L616)
Kvantitativ tabel BHB 3.5–15 verificeret mod BASE=0.3, ACCEL=0.05, THRESHOLD=600. Alle 5 datapunkter matcher inden for 1 minut.

### [OK] Brain energy deficit kalibrering

**Fil:** [simulator.js:577–581](js/simulator.js#L577), [simulator.js:2900–2935](js/simulator.js#L2900)
Game-over tidsestimater verificeret (BG=2.0 → 59 min, BG=1.5 → 29 min). F_01 = 0.679 (70 kg) × (1-BG/2.5) giver korrekte rates.

### [OK] Lipolyse/CPT-1 kalibrering matcher kommentar-tabel

**Fil:** [simulator.js:680–700](js/simulator.js#L680), [simulator.js:4105–4130](js/simulator.js#L4105)
Verificeret: I=0 → 0.090/min, I=9 → 0.037/min (41%), I=15 → 0.012/min (13%), I=25 → 0.003/min (3%). Hill n=3, EC50=8 giver de dokumenterede værdier.

### [OK] Glucotoxicitet kalibrering mod Vuorinen-Markkola 1992

**Fil:** [simulator.js:3044–3079](js/simulator.js#L3044)
24t ved BG=20: load = 0.0004 × 100 × 1440 = 57.6 → Hill_N=1.5, EC50=50 → factor = 1 + 0.40 × 0.553 = 1.22 (22% ISF-reduktion vs. target 26%). Bevidst headroom under literatur-target (jf. C-A6.a-rationale).

### [OK] Glykogen-pool massebalance (lever)

**Fil:** [simulator.js:3119–3247](js/simulator.js#L3119)
Drain × reserve matcher blood-bidrag × reserve for hver kilde (basal, stress, protein, motion). Reserve-skalering og GNG-uafhængighed konsistent.

### [OK] HAAF areal-baseret model

**Fil:** [simulator.js:2853–2878](js/simulator.js#L2853)
Skade ∝ (3.0 - BG) × dt under tærskel; recovery eksponentiel t½=3 dage over BG=4.0. Sigmoid counterRegFactor = 0.3 + 0.7 × exp(-area/30) går korrekt 1.0 → 0.3.

### [OK] Hovorka 16-state ODE dimensionel konsistens

**Fil:** [hovorka.js:315–574](js/hovorka.js#L315)
Alle ODE'er har korrekt enheder: insulin (mU/min), glukose (mmol/min), tid (min). Per-bolus rapid + basal-skygge-kaskade adskilt korrekt. Superposition gælder pga. lineære insulin-ODE'er.

---

## Samlet status-opsummering

| # | Prioritet | Titel | Status |
|---|-----------|-------|--------|
| 1 | KRITISK  | Muskelglykogen-resynthesis BG-drain (kalibrering + ikke substep-integreret) | ✅ FIKSET |
| 2 | ADVARSEL | hyperMod kommentar overstater faktisk værdi | ✅ FIKSET |
| 3 | ADVARSEL | acuteStressLevel cap=0.4 vs. docs der antyder 1.0 | ✅ FIKSET |
| 4 | ADVARSEL | Glucagon +10–15 mmol/L instantant: høj og ikke graduel | ✅ FIKSET |
| 5 | NOTE | CGM upper clamp 30, docs siger 25 | ✅ FIKSET |
| 6 | NOTE | hovorka.js bolusToRate() er dead code | ❌ ÅBEN |
| 7 | NOTE | F_01 lidt over populations-mean (Hovorka-fidelity) | ⚠️ ACCEPTABEL |
| 8 | NOTE | Protein-glucagon 50/50 vs. stress 60/40 — ingen begrundelse | ❌ ÅBEN |
| 9 | NOTE | Combined ISF-swing teoretisk op til ~10× | ⚠️ ACCEPTABEL |
| 10–18 | OK | 9 subsystemer verificeret konsistente | — |

---

## Prioriteret anbefaling efter 2026-06-04-fix

1. **Kritisk fund er rettet.** Muskelglykogen-resynthesis har nu både plasma-drain cap og substep-integration.
2. **Glucagon-advarslen er rettet.** Emergency glucagon er nu graduel og mass-conserving mod leverglykogen-poolen.
3. **Resterende åbne punkter er oprydning.** `bolusToRate()` kan slettes i en senere lille kodeoprydning, og protein-glucagon 50/50-fordelingen bør enten kommenteres bedre eller harmoniseres.
4. **Combined ISF-swing bør stadig monitoreres.** Lav en scenarie-test der monitorerer `combinedResistance × sensitivityIncreaseFactor` over typisk gameplay, så den teoretiske ~10x-range ikke skjuler sig i praktiske baner.
