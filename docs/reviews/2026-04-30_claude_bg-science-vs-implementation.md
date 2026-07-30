# Kritisk fysiologi-review: BG-SCIENCE.md vs implementering vs MODEL-IMPLEMENTATION.md

**Genereret:** 2026-04-30
**Reviewer:** Claude (t1d-physiology-reviewer skill, Opus 4.7)
**Scope:** [docs/BG-SCIENCE.md](../BG-SCIENCE.md) v9 (2026-04-29), [docs/MODEL-IMPLEMENTATION.md](../MODEL-IMPLEMENTATION.md) v1 (2026-04-29), [js/hovorka.js](../../js/hovorka.js), [js/simulator.js](../../js/simulator.js)

---

## Sammenfatning

BG-SCIENCE.md er på et imponerende videnskabeligt niveau med konsistent metodisk redelighed (caveats om sample size, paywall-noter, kontroverser). Implementeringen er ligeledes solid og veldokumenteret. Reviewet har fundet:

- **2 KRITISKE problemer** (matematik-fejl med direkte effekt på BG-trajektorier)
- **6 ADVARSLER** (kalibrerings-mismatch eller dokumentations-modstrid)
- **4 NOTER** (mindre forbedringspunkter)

Kerneberegningerne (Hovorka ODE'er, kompartmenter, stoichiometri) er overvejende korrekte.

### Status-opsummering

| ID | Niveau | Titel | Status |
|----|--------|-------|--------|
| K1 | KRITISK | Glykogen-pool drainer 1.67× for hurtigt under acute stress | ✅ FIKSET (2026-04-30, decision-doc + regression-test) |
| K1b | NY | Protein-glucagon glycogenolyse trækker IKKE fra pool (relateret fund) | ✅ FIKSET (2026-04-30, decision-doc + regression-test, søster til K1) |
| K2 | KRITISK | F_01c kommentar matcher ikke implementering | ✅ FIKSET (2026-04-30, kommentar opdateret + designvalg dokumenteret) |
| A1 | ADVARSEL | Intern modstrid i BG-SCIENCE om lipolyse-EC50 (§7 vs §23) | ✅ FIKSET (2026-04-30, §7 harmoniseret til Rizza 1981 ~8-11 µU/mL) |
| A2 | ADVARSEL | Morgen-effekt-matematik i MODEL-IMPL er forkert (43% vs 64%) | ✅ FIKSET (2026-04-30, MODEL-IMPL §8 rettet) |
| A3 | ADVARSEL | Sen-fase PEIS-amplitude under Mikines/Cartee target | ✅ FIKSET (2026-04-30, A_late_peak hævet 0.37→0.50 → mid-Cartee) |
| A4 | ADVARSEL | Subkutan bioavailability over BG-SCIENCE reference | ✅ FIKSET (2026-04-30, eksplicit kalibrerings-kommentar tilføjet — bevidst empirisk valg) |
| A5 | ADVARSEL | circadianISF amplitude overstiger evidensgrundlag | ✅ FIKSET (2026-04-30, BG-SCIENCE §14 implementation-note tilføjet) |
| A6 | ADVARSEL | Glucotoxicity kalibrering rammer 21% af 26% target | ✅ FIKSET (2026-04-30, eksplicit dokumentation af multi-faktor balancering) |
| C1 | NY | brainConsumption label/forklaring var fysiologisk upræcis | ✅ FIKSET (2026-04-30, label → "Insulin-uafhængigt forbrug" + udvidet mouse-over) |
| N1 | NOTE | EGP_0 = 0.0161 er T1D-værdi, ikke healthy | ✅ FIKSET (2026-04-30, MODEL-IMPL §3 note tilføjet) |
| N2 | NOTE | F_01 inkluderer mere end hjerne | ✅ FIKSET (2026-04-30, MODEL-IMPL §3 omskrevet) |
| N3 | NOTE | A_G = 1.0 vs Hovorka 2004's A_G = 0.8 | ✅ FIKSET (2026-04-30, hovorka.js kommentar udvidet) |
| N4 | NOTE | Konsistens-bekræftelser (parametre der MATCHER) | ✅ OK |

---

## KRITISK 1 — Glykogen-poolen drainer 1.67× hurtigere end stress-EGP-bidraget

**Filer:** [js/simulator.js:1809-1810](../../js/simulator.js) og [js/simulator.js:3029, 3060](../../js/simulator.js)
**Subsystem:** Lever-glykogenpool + acute stress-EGP

### Problem

I `update()` opsplittes acute stress i 60% glycogenolyse og 40% gluconeogenese:

```js
const effectiveAcuteStress = this.acuteStressLevel *
    (0.6 * this.glycogenReserve + 0.4);   // BLOD-bidrag
```

Kun `0.6 × reserve × acuteStress`-komponenten skal trække fra glykogen-poolen. Men `updateGlycogenReserve()` drainer:

```js
const stressEGP_gPerMin = this.hovorka.EGP_0 * this.acuteStressLevel * GLUCOSE_G_PER_MMOL;
const scaledStress = stressEGP_gPerMin * this.glycogenReserve;   // = full × reserve
```

Manglende faktor `0.6`. Drainen er altså faktor `1/0.6 = 1.67×` for høj.

### Evidens (unit analysis)

- Bidrag til blod fra stress-glycogenolyse: `EGP_0 × acute × 0.6 × reserve` [mmol/min]
- Bidrag til blod fra stress-GNG: `EGP_0 × acute × 0.4` [mmol/min] (kræver IKKE glykogen)
- Faktisk drain i koden: `EGP_0 × acute × reserve × G_PER_MMOL` [g/min]
- Korrekt drain: `EGP_0 × acute × 0.6 × reserve × G_PER_MMOL` [g/min]

Massebalance brydes: 40% GNG-komponenten af acute stress trækker fejlagtigt fra poolen i koden.

### Konsekvens

Ved længere hypo-perioder med kontraregulering (BG<4) tømmes glykogenpoolen for hurtigt. Eksempel ved acute=0.4, reserve=1.0, EGP_0=1.13 (70 kg):

- Faktisk drain: 1.13 × 0.4 × 1.0 × 0.18 = **0.0814 g/min ≈ 4.9 g/t**
- Korrekt drain: 0.0814 × 0.6 = **2.9 g/t**

Effekt: hypo-recovery kollapser hurtigere når glykogenet "løber tør", og spiller-oplevelsen af forsinket BG-faldsacceleration er mere udtalt end fysiologien retfærdiggør.

### Forslag

Ret [js/simulator.js:3029](../../js/simulator.js) til:

```js
const stressEGP_gPerMin = this.hovorka.EGP_0 * this.acuteStressLevel * 0.6 * GLUCOSE_G_PER_MMOL;
```

(eller fjern `× this.glycogenReserve` på linje 3060 og lad den `0.6` indgå direkte).

Bemærk: `basalGlycogenolysis_gPerMin` (linje 3023) er allerede korrekt — den bruger `× 0.5` matchende `glycogenBaseline = 0.5 × glycogenReserve` (basal er 50/50 split, ikke 60/40 som acute stress).

**Kræver fix-decision-doc** ifølge CLAUDE.md: kvantitativ kalibrering mod fysiologisk reference + tre+ filer ændret som koordineret enhed (kode + tests + evt. doc).

**✅ FIKSET 2026-04-30** — Se [2026-04-30_glycogen-drain-fix.md](2026-04-30_glycogen-drain-fix.md) for fuld decision-doc med kvantitativ verifikation. Stress-glycogenolyse-komponenten ganges nu eksplicit med 0.6 i `updateGlycogenReserve()`, hvilket bringer drain-bogføringen i overensstemmelse med blod-bidrags-dekomponeringen. Regression-test tilføjet i `tests/simulation.test.js` ("K1 regression: glycogen drain matches blood-side acute-stress decomposition (60/40)"). Test-suite: 136/136 passed.

---

## NY (K1b) — Protein-glucagon glycogenolyse trækker ikke fra glykogen-pool

**Filer:** [js/simulator.js:1852-1853](../../js/simulator.js) vs [js/simulator.js:3015+](../../js/simulator.js)
**Subsystem:** Lever-glykogenpool + protein-drevet glukagon
**Status:** ❌ ÅBEN (identificeret under K1-fix-implementering 2026-04-30)

### Problem

Tilsvarende K1-bookkeeping-uoverensstemmelse, men i modsat retning:

I `update()`'s substep-løkke ([simulator.js:1852-1853](../../js/simulator.js)) splittes `proteinGlucagonLevel` 50/50 mellem glycogenolyse og GNG:

```js
const effectiveProteinGlucagon = this.proteinGlucagonLevel *
    (0.5 + 0.5 * this.glycogenReserve);
```

Dette bidrager til `stressMultiplier` (og dermed EGP til blodet). Men `updateGlycogenReserve()` bogfører **slet ikke** denne glycogenolyse-komponent som drain fra poolen.

### Konsekvens

`proteinGlucagonLevel × 0.5 × glycogenReserve` mængde glukose leveres til blod via glycogenolyse, men trækkes ikke fra glykogen-poolen. Dette er det modsatte af K1-bug'en (poolen drainer for *lidt* her, ikke for meget).

Effekten er moderat i størrelse — `proteinGlucagonLevel` er bounded af `PROTEIN_GLUCAGON_MAX` (Hill-kinetik fra aminosyrer), og protein-rige måltider er ikke konstante. Men over en længere periode med kontinuerlig protein-indtagelse (sport-shake, drink-måltid) akkumuleres der en lille uoverensstemmelse.

### Forslag

Tilføj til `updateGlycogenReserve()`:
```js
const proteinGlucagonGlycogenolysis_gPerMin =
    this.hovorka.EGP_0 * this.proteinGlucagonLevel * 0.5 * GLUCOSE_G_PER_MMOL;
const scaledProteinDrain = proteinGlucagonGlycogenolysis_gPerMin * this.glycogenReserve;
// Inkludér i totalConsumption
```

**Kræver fix-decision-doc** hvis fikset (kvantitativ kalibrering, koordineret fil-sæt). Kan eventuelt grupperes med andre minor-bookkeeping-fixes til en samlet "glykogen-bookkeeping-konsistens"-runde.

**✅ FIKSET 2026-04-30** — Se [2026-04-30_protein-glucagon-drain-fix.md](2026-04-30_protein-glucagon-drain-fix.md) for fuld decision-doc. Tilføjet "FORBRUG 4: Protein-glucagon glycogenolyse" i `updateGlycogenReserve()` med struktur spejlet fra K1-fixet. Regression-test "K1b regression" verificerer marginalt protein-bidrag på +1.22 g/time (vs. pre-fix 0). Test-suite: 137/137 passed. Med K1+K1b begge fixed har glykogen-pool-bogføringen nu fuld konsistens med blod-bidragets dekomponering på tværs af basal, acute stress, protein-glucagon og motion.

---

## KRITISK 2 — F_01c-formel: kommentar matcher ikke implementering

**Fil:** [js/hovorka.js:354-358](../../js/hovorka.js)
**Subsystem:** Hjernens glukoseforbrug (F_01c)

### Problem

Koden:
```js
const F_01s = this.F_01 / 0.85;
const F_01c = F_01s * G / (G + 1);
```

Kommentaren oplyser:
- `G = 5 mmol/L → F_01c ≈ 0.95 * F_01` (faktisk: 1.176 × 5/6 = **0.98**)
- `G = 2 mmol/L → F_01c ≈ 0.67 * F_01` (faktisk: 1.176 × 2/3 = **0.78**)
- `G = 0.5 mmol/L → F_01c ≈ 0.33 * F_01` (faktisk: 1.176 × 0.5/1.5 = **0.39**)

Ingen af de anførte værdier matcher formlen. Yderligere: ved G→∞ giver formlen `F_01c → 1.176 × F_01` (17.6% over baseline), hvilket er fysiologisk usandsynligt — Hovorka 2004 har et plateau ved F_01.

### Evidens — sammenligning med Hovorka 2004

Originalformlen i Hovorka 2004:
```
F_01c = F_01           hvis G ≥ 4.5
F_01c = F_01 × G/4.5   hvis G < 4.5
```

Sammenligning:

| G [mmol/L] | Hovorka 2004 | Kode-formel | Kommentar i kode |
|-----------:|-------------:|------------:|-----------------:|
| 10 | 1.00 × F_01 | 1.07 × F_01 | (ikke nævnt) |
| 5 | 1.00 × F_01 | 0.98 × F_01 | 0.95 × F_01 |
| 4.5 | 1.00 × F_01 | 0.96 × F_01 | (ikke nævnt) |
| 2 | 0.44 × F_01 | 0.78 × F_01 | 0.67 × F_01 |
| 0.5 | 0.11 × F_01 | 0.39 × F_01 | 0.33 × F_01 |

Implementeringen er en *anden* (smoothere) formulering end Hovorka 2004. Det er ikke nødvendigvis forkert — `G/(G+1)` afspejler GLUT1 saturation med Km≈1 mmol/L, hvilket faktisk passer med BG-SCIENCE §1's GLUT1 Km ≈ 1-2 mmol/L. Men:

1. **Kommentarens tal er forkerte** (ren regnefejl).
2. **Hjernens forbrug stiger over baseline ved højt BG**, hvilket BG-SCIENCE §4 ikke understøtter (CMRglc er stort set konstant; mætning af GLUT1 betyder at forbrug = baseline ved euglykæmi og kun reduceres ved <3 mmol/L).
3. **Hypo-respons ved BG=2 er meget mildere end Hovorka 2004 forudsiger** (0.78 vs 0.44 × F_01) — hjernen bevarer forbrug bedre i den nuværende implementering, hvilket gør hypo lidt mere "fair" men afviger fra litteraturen.

### Forslag

1. **Ret kommentaren** så den matcher den faktiske formel (eller fjern de specifikke talværdier).
2. **Overvej clamp på F_01c ≤ F_01** (capping ved baseline) for at undgå urealistisk superbasal hjerneforbrug ved hyperglykæmi.
3. **Eller dokumentér eksplicit** hvorfor `0.85`-divisionen vælges (kalibreringsbegrundelse) og hvorfor formlen afviger fra Hovorka 2004's piecewise definition.

---

## ADVARSEL 1 — Intern modstrid i BG-SCIENCE.md om lipolyse-EC50

**Filer:** [docs/BG-SCIENCE.md §7](../BG-SCIENCE.md) vs [docs/BG-SCIENCE.md §23](../BG-SCIENCE.md)

§7 (linje 626 ca.):
> *"Insulin ED50, suppression of adipocyte lipolysis | ~20 μU/mL"*

§23 (linje 1961 ca.):
> *"Insulin suppresses adipose lipolysis with an EC50 of approximately 44–68 pmol/L (~8–11 μU/mL) (Rizza et al., 1981)"*

Konvertering: 20 μU/mL ≈ 120 pmol/L; 8-11 μU/mL ≈ 50-66 pmol/L. Det er en faktor ~2 forskel mellem to sektioner i samme dokument. Begge citerer i sidste ende Rizza 1981 / Petersen-Shulman 2018 som autoritet.

### Konsekvens for koden

Implementeringen bruger `LIPOLYSIS_EC50 = 8 mU/L`, hvilket matcher §23. Hvis §7 tages bogstaveligt, ville EC50 være 20 mU/L og fasteketose-niveauerne (BHB ved I=9) skulle reberegnes.

### Forslag

Harmoniser §7's tabel-værdi med §23. Den lavere værdi (8-11 µU/mL) er det dominerende tal i nyere reviews (Petersen-Shulman 2018) — overvej at konvergere på "~10 µU/mL ≈ 60 pmol/L".

---

## ADVARSEL 2 — Morgen-effekt-matematik i MODEL-IMPLEMENTATION er forkert

**Fil:** [docs/MODEL-IMPLEMENTATION.md:1624-1628](../MODEL-IMPLEMENTATION.md)

> ```
> 08:00 (morning):   HGP ×1.15  +  ISF ×0.70  →  ~43% more insulin needed
> ```

### Problem

Beregningen ignorerer at de to effekter **multiplicerer**. For at kompensere:

- HGP ×1.15: kræver 15% mere insulin alene.
- ISF ×0.70: kræver 1/0.70 = 43% mere insulin alene.
- **Kombineret: 1.15/0.70 = 1.643 → 64% mere insulin nødvendigt**, ikke 43%.

(Den "43%" i dokumentet er faktisk kun ISF-komponenten alene.)

### Forslag

Ret til:
> `08:00 (morning): HGP ×1.15 × ISF ×(1/0.70) → ~64% more insulin needed`

Dette er ikke en kode-fejl — koden bruger HGP og ISF i kombination via `circadianKortisolNiveau` (additivt i `stressMultiplier`) og `circadianISF` (multiplikativt på `k_b1/2/3`). Selve simulationen er konsistent, men den dokumenterede effekt-størrelse er underestimeret.

---

## ADVARSEL 3 — Sen-fase PEIS-amplitude under Mikines/Cartee-target

**Filer:** [js/simulator.js:120-128](../../js/simulator.js) og [docs/reviews/2026-04-29_late-phase-peis-fix.md](2026-04-29_late-phase-peis-fix.md)
**Subsystem:** Late-fase post-exercise insulin sensitivity

### Litteratur-target

**Mikines 1988** (replikeret af Cartee 2015): 60 min cykel ved ~150W →
- V_max stiger 9.5 → 10.7 mg·min⁻¹·kg⁻¹ (+13% ved +48t)
- Apparent K_m falder 52 → 40 µU/mL (−23% ved +48t)
- Cartee 2015 syntese: "+25-50% disposal at 16-48h"

### Implementering

Medium cardio, 60 min, e2=1.0:
```
A_late_peak = 0.37 × 1.0 × √(60/60) × (1-e^-2) = 0.32
+24 t: 0.32 × 0.5^(24/18) = 12.7%
+48 t: 0.32 × 0.5^(48/18) =  5.0%
```

Ved 48t leverer modellen +5% ISF-boost. Mikines viste +13% V_max og K_m-skift svarende til +25% effektiv sensitivitet ved sub-maksimale insulinkoncentrationer. Den dokumenterede `+5%` ved 48t er i den lave ende — men det er konsistent med Cartee's 10-15% range som dokumenteret i koden, så kalibreringen er forsvarlig hvis "kun late, ingen early-tilbageblussen".

### Note om early-komponent interaktion

Hvis muskel-glykogen ikke er fuldt re-fyldt ved 48t (fx efter aften-motion uden CHO-genopfyldning), giver early-komponenten yderligere boost. Da late-amplituden alene matcher den nedre ende af litteraturen, vil tendensen være at undervurdere Mikines/Cartee-resultaterne hos en fastende eller atletisk forsøgsperson.

### Forslag

Verificer mod Cartee 2015's `25-50%` figure ved 16-48t. Hvis kalibreret mod den nedre ende, dokumentér valget eksplicit i `late-phase-peis-fix.md`. Overvej alternativt at hæve `A_late_peak` for medium-intensity til ~0.55-0.60 (giver ~12-15% ved 48t).

---

## ADVARSEL 4 — Subkutan bioavailability over BG-SCIENCE-reference

**Filer:** [js/simulator.js:1026-1027](../../js/simulator.js), [docs/MODEL-IMPLEMENTATION.md:2220-2221](../MODEL-IMPLEMENTATION.md)

### Implementering

```js
this.sessionBioavFast = 0.78;
this.sessionBioavBasal = 0.82;
```

### BG-SCIENCE referencer

[BG-SCIENCE §7](../BG-SCIENCE.md):
> *"Insulin absolute SC bioavailability (regular and analogues, soluble) | ~70%"*
> *"Falls modestly with dose volume and depot pooling"* — Becker 2007.

[MODEL-IMPL §13](../MODEL-IMPLEMENTATION.md):
> *"Absolute bioavailability for subcutaneous insulin has been measured at 55-77% (insulin lispro, FDA label), up to 84% in individual studies (Gradel et al. 2018)."*

### Vurdering

78% (rapid) ligger lige over Becker's 70% og inden for FDA-label-rangen 55-77%. Værdien er ved den øvre ende af det publicerede interval. 82% (basal) er over begge intervaller fra BG-SCIENCE.

### Forslag

Hvis 78%/82% er kalibreret empirisk for at give realistiske spillerelaterede BG-trajektorier (efter `displayIOB`-inflation), så tilføj eksplicit kommentar om at værdien er kalibreringsmæssigt valgt frem for litteratur-medianer. Alternativt: sænk til ~70%/75% og kompensér via insulinsensitivitet eller dosis-skalering.

---

## ADVARSEL 5 — circadianISF amplitude overstiger evidensgrundlag i BG-SCIENCE

**Filer:** [js/simulator.js:1466-1473](../../js/simulator.js), [docs/BG-SCIENCE.md §14](../BG-SCIENCE.md)

⚠️ **BY DESIGN (erkendt)** — denne advarsel er en konsistens-tjek snarere end en bug.

### Implementering

circadianISF: 1.20 (nat) → 0.70 (morgen) → 1.20 (aften) — et 50%-swing.

### BG-SCIENCE-modstand

[BG-SCIENCE §14](../BG-SCIENCE.md):
> *"Hinshaw et al. studied 19 adults with long-standing T1D under triple-tracer mixed-meal protocols and **did not find a statistically significant population-wide diurnal SI rhythm**"*

> *"Many model-based diurnal-ISF curves used in algorithm design (e.g. Toffanin and colleagues) are synthetic constructions fitted within virtual-patient simulators and validated by hypoglycaemia reduction in those same simulators — useful as engineering heuristics but **not direct human validation of the underlying physiological curve**"*

### Konsistens-status

Implementeringen er i god tro (Toffanin 2013-inspireret, dæmpet 50%) og **er erkendt som et empirisk valg** i [js/simulator.js:1446-1448](../../js/simulator.js):
> *"VIGTIGT: Denne model er bygget på mangelfuld evidens og klinisk erfaring. Bør opdateres hvis bedre kvantitative data bliver tilgængelige."*

**Konsistens er OK** — kode og MODEL-IMPLEMENTATION er ærlige om begrænsningen. Men: BG-SCIENCE's afsnit kunne **eksplicit fremhæve** at simulatoren bruger en 50%-amplitude som engineering heuristik der ikke er population-niveau-valideret i T1D, så læseren ikke fejlagtigt antager kvantitativ validitet.

### Forslag

Tilføj en note i BG-SCIENCE §14's *Implementation*-footer der eksplicit oplyser amplituden 50% er en heuristik snarere end en valideret population-værdi.

---

## ADVARSEL 6 — Glucotoxicity-kalibrering rammer kun 21% af 26%-target

**Filer:** [js/simulator.js:833-839](../../js/simulator.js), [docs/BG-SCIENCE.md §26](../BG-SCIENCE.md)

### Litteratur-target

Vuorinen-Markkola 1992 (T1D-specifik clamp): *"24 hours of maintained hyperglycemia at ~20 mmol/L reduced whole-body glucose disposal by 26%"*

### Kodens kalibrering

```
24t × 60min × 0.0004 × (20-10)² = 57.6 load
→ sigmoid 57.6/(57.6+50) = 0.535 → 0.535 × 0.40 = 0.214 → faktor 1.21
```

Modellen rammer **21% reduktion**, mens target er **26%**. Forskellen er ~25% under target. Koden erkender det selv ("Tæt på de 26%"), men differensen er ikke triviel.

### Forslag

Hvis 26% er det egentlige target, juster `GLUCOTOX_MAX_RESIST` op til ~0.50 og re-kalibrer EC50 så samme "57.6 load" giver `1.26` i stedet for `1.21`. Alternativt: hold `0.40` cap og dokumentér eksplicit at modellen bevidst undervurderer (fx for at give plads til kombineret effekt med FFA og kronisk stress, hvor `combinedResistance` cap'es ved 2.5).

---

## NOTE 1 — EGP_0 = 0.0161 er T1D-værdi, ikke "healthy"

**Filer:** [js/hovorka.js:58](../../js/hovorka.js), [docs/BG-SCIENCE.md §2](../BG-SCIENCE.md)

Implementeringen: `EGP_0 = 0.0161 mmol/kg/min = 16.1 µmol/kg/min`.

[BG-SCIENCE §2](../BG-SCIENCE.md):
- Healthy basal EGP: 1.8-2.2 mg/kg/min ≈ 11-12 µmol/kg/min
- T1D poorly controlled: 13-17 µmol/kg/min (~60% over control)

Hovorka 2004 valgte `0.0161` for T1D-kalibrering — men [docs/MODEL-IMPLEMENTATION.md:296](../MODEL-IMPLEMENTATION.md) angiver det som "Liver's basal glucose production per minute" uden at notere at det er T1D-niveau snarere end "healthy".

### Forslag

Tilføj note i MODEL-IMPL der eksplicit oplyser at `EGP_0` matcher T1D-niveau (Kacerovsky 2011, Petersen 2004), hvilket er konsistent med simulatorens målgruppe.

---

## NOTE 2 — F_01 inkluderer mere end hjerne

**Filer:** [js/hovorka.js:57](../../js/hovorka.js), [docs/BG-SCIENCE.md §4](../BG-SCIENCE.md)

`F_01 = 0.0097 mmol/kg/min × 70 = 0.679 mmol/min × 1440 = 977 mmol/døgn / 5.55 = 176 g/døgn`.

[BG-SCIENCE §4](../BG-SCIENCE.md): brain alene = ~110-120 g/døgn.

176-120 = 56 g/døgn for "andre insulin-uafhængige forbrug" (RBC, hjerte, nyremedulla). [docs/MODEL-IMPLEMENTATION.md:262](../MODEL-IMPLEMENTATION.md) kalder F_01 "Brain glucose consumption" hvilket er en lille forenkling.

### Forslag

I MODEL-IMPL §3 omdøb til "Insulin-uafhængigt glukoseforbrug (hjerne + RBC + andre)". Bevarer fysiologisk akkuratesse uden at ændre kode.

---

## NOTE 3 — A_G = 1.0 vs Hovorka 2004's A_G = 0.8

**Filer:** [js/hovorka.js:87](../../js/hovorka.js), [docs/MODEL-IMPLEMENTATION.md:2308-2316](../MODEL-IMPLEMENTATION.md)

⚠️ **BY DESIGN (dokumenteret)** — denne note bekræfter at valget er korrekt begrundet.

Koden: `A_G = 1.0`. Hovorka 2004: `A_G = 0.8`.

MODEL-IMPL forklarer logikken (EU-konvention vs UK-konvention på fiber-bogføring) overbevisende. **Konvergent med BG-SCIENCE §5** der citerer 95-100% bioavailability for fordøjeligt KH (Englyst & Cummings 1986). Konsistent. Bare en forskel fra Hovorka-baseline der bør være meget eksplicit i koden — i øjeblikket står den næsten uden begrundelse i [hovorka.js:87](../../js/hovorka.js) ("EU-konvention").

### Forslag (mindre)

Udvid kommentaren i hovorka.js til at henvise til MODEL-IMPLEMENTATION §5's "Carb convention: EU/DK"-afsnit.

---

## NOTE 4 — Konsistens-bekræftelser (OK)

✅ Centrale parametre matcher Hovorka 2004 og BG-SCIENCE:

| Parameter | Kode | Hovorka 2004 / BG-SCIENCE | Status |
|-----------|------|---------------------------|--------|
| V_G | 0.16 L/kg | 0.16 L/kg | ✅ |
| V_I | 0.12 L/kg | 0.12 L/kg | ✅ |
| k_12 | 0.066 min⁻¹ | 0.066 min⁻¹ (BG-SCIENCE §1) | ✅ |
| k_e | 0.138 min⁻¹ | Hovorka 2004 | ✅ |
| τ_I (rapid) | 55 min | Hovorka 2004; BG-SCIENCE §7 (Tmax aspart 50-60) | ✅ |
| τ_G (default) | 40 min | Hovorka 2004 (statisk) | ✅ (udvidet dynamisk) |
| R_thr | 9 mmol/L | BG-SCIENCE §3 (population mean 10-11) | ✅ rimelig |
| BHB renal threshold | 0.5 mmol/L | BG-SCIENCE §23 ("ketonuri ~0.5") | ✅ |
| Lever-glykogen | 90g start, 120g max | BG-SCIENCE §2 (80-100g fed) | ✅ |
| Muskel-glykogen | 5.5 g/kg | BG-SCIENCE (Jensen 2011) | ✅ |
| Stress-cap T1D | 0.4 (vs ~5 raske) | BG-SCIENCE §11 (svækket kontraregulering) | ✅ |
| HAAF damage threshold | 3.0 mmol/L | BG-SCIENCE §11 (neuronal adaption) | ✅ |
| LIPOLYSIS_EC50 | 8 mU/L | BG-SCIENCE §23 (8-11 µU/mL) | ✅ |
| FFA_RESIST_MAX | 0.42 | BG-SCIENCE §6 (Wolpert 60g→42%) | ✅ |
| Late-PEIS t½ | 18 t | BG-SCIENCE §8 + Cartee 2015 mid (12-24t) | ✅ |
| Q1/Q2 ODE'er | exerciseFactor på x1·Q1 og x2·Q2 | Resalat 2020 + Hovorka 2004 | ✅ |
| Per-bolus rapid + skygge-basal | Linær superposition i I | Mathematically exakt | ✅ |
| EGP-formel | `max(0, stressMultiplier - x3)` | Tug-of-war (BG-SCIENCE §11) | ✅ (afvigelse fra original Hovorka som er forsvarlig) |
| Acidose-gate Hermite smoothstep | C¹-kontinuert | Numerisk velkonstrueret | ✅ |
| CGM-lag (ka_int=0.073) | t½≈9.5 min | BG-SCIENCE §27 (5-8 steady, 15-25 rapid) | ✅ |
| Insulin variabilitet (CV~25% τ_I) | Heinemann 2002 (CV 20-30%) | Konsistent | ✅ |

---

## Anbefalede prioriteringer

1. **STRAKS** ([KRITISK 1](#kritisk-1--glykogen-poolen-drainer-167-hurtigere-end-stress-egp-bidraget)): Ret stress-glykogen-drain-faktoren — det er en reel matematik-fejl der påvirker BG-trajektorier under hypo. Lille kode-ændring, betydelig fysiologisk effekt. **Kræver et fix-decision-doc** (kvantitativ kalibrering, koordineret berørt fil-sæt).

2. **HØJ** ([KRITISK 2](#kritisk-2--f_01c-formel-kommentar-matcher-ikke-implementering)): Ret F_01c-kommentaren OG enten dokumentér 0.85-divisionsbegrundelsen eller cap F_01c ved F_01 for høje BG.

3. **HØJ** ([ADVARSEL 1](#advarsel-1--intern-modstrid-i-bg-sciencemd-om-lipolyse-ec50)): Harmoniser BG-SCIENCE §7's lipolyse-EC50 med §23.

4. **MEDIUM** ([ADVARSEL 2](#advarsel-2--morgen-effekt-matematik-i-model-implementation-er-forkert)): Ret 43%→64% i MODEL-IMPL §8.

5. **MEDIUM** ([ADVARSEL 3](#advarsel-3--sen-fase-peis-amplitude-under-mikinescartee-target)): Verificer late-PEIS amplitude mod Mikines/Cartee target.

6. **LAV** ([ADVARSEL 4](#advarsel-4--subkutan-bioavailability-over-bg-science-reference), [ADVARSEL 6](#advarsel-6--glucotoxicity-kalibrering-rammer-kun-21-af-26-target)): Dokumentér eller juster.

7. **LAV** (NOTER 1-3): Tilføj kontekstualiserende kommentarer.

---

## Reviewerens overordnede vurdering

BG-SCIENCE.md er bemærkelsesværdigt grundig og videnskabeligt redelig. Implementeringen har solid Hovorka-basis med velbegrundede udvidelser (per-bolus depots, skygge-basal-kaskade, dynamisk τ_G, tre-komponent PEIS, FFA-drevet keton). Hovedproblemet er den ene matematik-fejl i glykogen-stress-konservering, som ellers undgås konsekvent i resten af systemet (massebalance er korrekt overalt). Dokumentations-mismatches er små men bør rettes for at bevare den høje kalibreringsstandard projektet stræber efter.

---

## Files cited

### Source code
- [js/hovorka.js](../../js/hovorka.js) — linje 57 (F_01), 58 (EGP_0), 87 (A_G), 354-358 (F_01c-formel)
- [js/simulator.js](../../js/simulator.js) — linje 120-128 (PEIS late), 833-839 (glucotoxicity), 1026-1027 (bioavailability), 1466-1473 (circadianISF), 1809-1810 (effectiveAcuteStress), 3023-3060 (glykogen-drain)

### Documentation
- [docs/BG-SCIENCE.md](../BG-SCIENCE.md) — §2 (EGP), §4 (brain), §7 (insulin pharm), §11 (counterreg), §14 (diurnal ISF), §23 (ketones), §26 (glucotoxicity)
- [docs/MODEL-IMPLEMENTATION.md](../MODEL-IMPLEMENTATION.md) — §3 (glucose), §5 (food), §8 (dawn), §11 (ketones), §13 (variability)
- [docs/reviews/2026-04-29_late-phase-peis-fix.md](2026-04-29_late-phase-peis-fix.md) — late-PEIS kalibreringsdesign

### Litteratur (citeret via BG-SCIENCE/MODEL-IMPL)
- Hovorka R et al. (2004). *Physiol Meas* 25:905-920.
- Resalat N et al. (2020). PMC7449052.
- Mikines KJ et al. (1988). *Am J Physiol* 254:E248-E259.
- Cartee GD (2015). *Am J Physiol Endocrinol Metab* 309:E949-E959.
- Rizza RA et al. (1981). *Am J Physiol* 240:E630-E639.
- Vuorinen-Markkola H et al. (1992). *Diabetes* 41:571-580.
- Wolpert HA et al. (2013). *Diabetes Care* 36:810-816.
- Becker RHA (2007). *Diabetes Technol Ther* 9:109-121.
- Heinemann L (2002). *Diabetes Technol Ther* 4:673-682.
- Petersen MC, Vatner DF, Shulman GI (2017). *Nat Rev Endocrinol* 13:572-587.
- Petersen MC, Shulman GI (2018). *Physiol Rev* 98:2133-2223.
- Kacerovsky M et al. (2011). *Diabetes* 60:1752-1758.
- Petersen KF et al. (2004). *J Clin Endocrinol Metab* 89:4656-4664.
- Toffanin C et al. (2013). *J Diabetes Sci Technol* 7:928-940.
- Hinshaw L et al. (2013). *Diabetes* 62:2223-2229.
