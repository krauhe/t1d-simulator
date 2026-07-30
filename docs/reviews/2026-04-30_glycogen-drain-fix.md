# Fix-decision: Glykogen-pool drainede 1.67× for hurtigt under acute stress

**Genereret:** 2026-04-30
**Status:** ✅ FIKSET (commit: pending)
**Relateret review:** [docs/reviews/2026-04-30_claude_bg-science-vs-implementation.md](2026-04-30_claude_bg-science-vs-implementation.md) — Finding **K1**

---

## 1. Baggrund

### Symptom

Det fysiologiske review (Claude, t1d-physiology-reviewer skill, 2026-04-30) opdagede en matematik-uoverensstemmelse mellem hvordan **acute stress** dekomponeres i to forskellige steder af koden:

- **Blod-bidraget** (i `update()`, [simulator.js:1809-1810](../../js/simulator.js)) splitter acute stress 60/40:
  - 60% glycogenolyse (afhænger af glykogen-reserve)
  - 40% gluconeogenese (uafhængig af reserve)

- **Glykogen-pool drain-bogføringen** (i `updateGlycogenReserve()`, [simulator.js:3029, 3060](../../js/simulator.js)) trak **100%** af acute stress × reserve fra poolen.

Resultat: poolen drainede `1/0.6 = 1.67×` for hurtigt under hypo-perioder med kontraregulering.

### Hvem opdagede det

Claude (Opus 4.7) identificerede det via systematisk sammenligning af blod-bidraget (linje 1809-1810) mod drain-bogføringen (linje 3029, 3060) i `phys-reviewer`-flowet. Bug'en er ikke fanget af eksisterende tests fordi de kun tester at glykogen falder ("> 2g over 60 min"), ikke om raten er kvantitativt korrekt.

---

## 2. Diagnose

### Litteratur-evidens

**Acute-stress dekomponering — fysiologisk grundlag** ([BG-SCIENCE.md §11](../BG-SCIENCE.md#counterregulation), [Cryer 2013](../references/Cryer_2013_RW_GlucoseCounterregulation.html)):

Glukagon og adrenalin (de to acute kontraregulatoriske hormoner ved hypoglykæmi) virker via to kvantitativt forskellige mekanismer på leveren:

1. **Hurtig glycogenolyse** (≤15 min onset): mobilisering fra eksisterende lever-glykogen via aktivering af glykogen-fosforylase. Dette KRÆVER tilstrækkelige glykogen-reserver — en tom pool kan ikke levere glycogenolyse.
2. **Langsom gluconeogenese** (15-90 min onset): syntese fra aminosyrer, laktat og glycerol. Dette er UAFHÆNGIGT af glykogen-reserver — gluconeogenese fortsætter selv ved tom pool (Roden 2001, Petersen 2004).

I simulatoren er dette modelleret som en **60/40-fordeling** (kommentar [simulator.js:1806-1810](../../js/simulator.js)). Forholdet er tilnærmelsesvist; den præcise fordeling varierer med stress-varighed og insulin-niveau, men 60/40 er en velkendt heuristisk approximation der balancerer Cryer 2013's kvalitative beskrivelse mod Roden 2001's kvantitative endpoints.

### Original design vs faktisk implementering

| Aspekt | Design (intent) | Faktisk implementering før fix |
|---|---|---|
| Blod-bidrag fra acute stress | `acuteStress × (0.6 × reserve + 0.4)` | ✅ Korrekt (linje 1809-1810) |
| Drain fra glykogen-pool | `EGP_0 × acuteStress × 0.6 × reserve × G_PER_MMOL` | ❌ `EGP_0 × acuteStress × 1.0 × reserve × G_PER_MMOL` (manglende 0.6) |

Resultatet er at GNG-komponenten (40% af acute-stress-EGP) blev fejlagtigt **trukket fra glykogen-poolen** i bogføringen, selvom GNG fysiologisk ikke bruger glykogen.

### Kvantitativt reality-check

Ved typisk hypo-scenarie (BG=2.0 mmol/L, acuteStress=0.4, 70 kg patient, fuld glykogen, ingen motion):

**Korrekt drain (post-fix):**
- Basal glycogenolyse: `EGP_0 × 0.5 × G_PER_MMOL = 1.127 × 0.5 × 0.180 = 0.101 g/min`
- Stress glycogenolyse: `EGP_0 × 0.4 × 0.6 × G_PER_MMOL = 1.127 × 0.4 × 0.6 × 0.180 = 0.0487 g/min`
- **Total: 0.150 g/min ≈ 9.0 g/time**

**Fejlagtig drain (pre-fix):**
- Basal glycogenolyse: 0.101 g/min (uændret)
- Stress glycogenolyse: `EGP_0 × 0.4 × G_PER_MMOL = 0.0812 g/min`
- **Total: 0.182 g/min ≈ 10.96 g/time**

Pre-fix var altså **22% hurtigere total drain** ved BG=2.0+acute=0.4 — eller ekvivalent: stress-komponenten alene var 67% for høj.

### Konsekvens for spilleroplevelsen

Ved længere hypo-perioder med kontraregulering:
- Glykogen-poolen rammer 15g-tærskel (hvor reserve begynder at aftage) hurtigere
- Stress-EGP-bidraget begynder at falde tidligere
- BG-faldsacceleration ved depletion fremstår mere udtalt end fysiologien retfærdiggør

Effekten er moderat ved kortvarige hypoer (få minutter giver små drain-forskelle) men kumulativ ved længerevarende hypoer eller gentagne nat-hypoer.

---

## 3. Løsning

### Matematisk struktur

Tilføj eksplicit `0.6`-faktor til stress-komponenten i `updateGlycogenReserve()`:

**Før:**
```js
const stressEGP_gPerMin = this.hovorka.EGP_0 * this.acuteStressLevel * GLUCOSE_G_PER_MMOL;
// ...
const scaledStress = stressEGP_gPerMin * this.glycogenReserve;
```

**Efter:**
```js
// Acute stress er 60% glycogenolysis + 40% gluconeogenesis (matcher
// effectiveAcuteStress-dekomponering ved linje ~1809-1810).
// KUN glycogenolysis-komponenten (60%) trækker fra glykogen-poolen.
const stressGlycogenolysis_gPerMin = this.hovorka.EGP_0 * this.acuteStressLevel * 0.6 * GLUCOSE_G_PER_MMOL;
// ...
const scaledStress = stressGlycogenolysis_gPerMin * this.glycogenReserve;
```

Variabel-omdøbning fra `stressEGP_gPerMin` til `stressGlycogenolysis_gPerMin` reflekterer at vi nu kun bogfører glycogenolyse-komponenten, ikke det totale stress-EGP.

### Konstanter og kalibrerings-targets

| Parameter | Værdi | Begrundelse |
|---|---|---|
| Acute-stress glycogenolysis-andel | **0.6** | Matcher `effectiveAcuteStress = acute × (0.6 × reserve + 0.4)` ved [simulator.js:1809-1810](../../js/simulator.js). Ingen ændring i forholdet — kun konsistent bogføring. |
| Acute-stress GNG-andel | **0.4** | Implicit; bidrager til blod uden glykogen-drain (uændret) |
| Basal glycogenolysis-andel | **0.5** | Uændret (50/50 i postabsorptiv tilstand, Petersen 2004) |

### Forventede drain-værdier efter fix

Ved BG=2.0, acute=0.4, fuld glykogen, ingen motion, 70 kg over 60 min:
- Total drain: **~9.0 g/time** (vs. pre-fix 10.96 g/time)
- Forskel: **−1.95 g** (−18% i denne specifikke scenario)

I praksis vil reduktionen være proportional med acute stress-niveau og tid. Ved typisk Somogyi-rebound (acute=0.2-0.4 i 30-90 min) reduceres drain med ~0.5-2 g.

---

## 4. Verifikation

### Eksperimentel før/efter-tabel

Test-scenario: 70 kg patient, BG=2.0 mmol/L, `addAcuteStress(0.4)`, fuld glykogen-pool (90g start), ingen motion. 60 minutters simulation via `updateStressHormones(1.0) × 60`.

| Metrik | Pre-fix | Post-fix | Litteratur-target |
|---|---|---|---|
| Total glykogen-drain over 60 min | **10.96 g** | **9.01 g** | Cryer 2013: Somogyi rebound 5-15 g/time afhængig af stress og tid; modelleret rate er konsistent |
| Stress-glycogenolyse-komponent | 4.87 g | 2.92 g | (60% af 4.87 = 2.92 — matcher analytisk forventning) |
| Basal-komponent | 6.09 g | 6.09 g | (uændret — kun stress-komponenten påvirkes) |
| Massebalance | 60% glycogenolyse skulle drain'e poolen | 100% drain'e poolen | ❌ Brudt | ✅ Restaureret |

### Test-resultater

Tilføjet ny regression-test i [tests/simulation.test.js](../../tests/simulation.test.js):

```
test('K1 regression: glycogen drain matches blood-side acute-stress decomposition (60/40)')
  Asserts: 8.5 < drain < 9.5 g (post-fix expected ~9.01g; pre-fix bug ~10.96g)
```

Test-suite: **136/136 passed** efter fix (135 eksisterende + 1 ny).

### Litteratur-target-konsistens

Bemærk at fix'et er en **bookkeeping-konsistens-rettelse**, ikke en re-kalibrering mod nyt litteratur-target. 60/40-dekomponeringen er uændret. Den fysiologiske drain-rate post-fix matcher det allerede-eksisterende blod-bidrags-design, der i forvejen var kalibreret mod Cryer 2013 / Roden 2001.

---

## 5. Sub-agent input

Ingen sub-agents blev brugt til selve fix-implementeringen. Bug'en blev identificeret af Claude direkte i `phys-reviewer`-skill-flowet (review fra 2026-04-30).

---

## 6. Beslægtet fund (ikke fikset i denne change)

Under implementeringen blev en **relateret bookkeeping-uoverensstemmelse** identificeret:

`proteinGlucagonLevel` bidrager til `stressMultiplier` med følgende blod-fordeling ([simulator.js:1852-1853](../../js/simulator.js)):
```js
const effectiveProteinGlucagon = this.proteinGlucagonLevel *
    (0.5 + 0.5 * this.glycogenReserve);
```

Det er en 50/50-split mellem glycogenolyse (skalerer med reserve) og GNG (uafhængig). Men `updateGlycogenReserve()` **bogfører ikke** glycogenolyse-bidraget fra protein-glucagon — det er som om proteinet kun driver GNG.

Dette er et separat fund af samme natur som K1 men i modsat retning: glykogen-poolen drainer **for lidt** for protein-glucagon (specifikt: 50% × proteinGlucagonLevel × EGP_0 × reserve × G_PER_MMOL mangler i drain-bogføringen).

**Beslutning:** IKKE fikset i denne change per CLAUDE.md ("Ændr KUN det brugeren specifikt beder om"). Føjet som åbent fund i review-rapporten.

---

## 7. Files cited

### Source code (ændret)
- [js/simulator.js](../../js/simulator.js) — linje 3025-3036 (forbrug 2 — stress glycogenolyse), linje 3066-3067 (scaling)
- [tests/simulation.test.js](../../tests/simulation.test.js) — linje ~1296+ (ny regression-test "K1 regression")

### Source code (refereret)
- [js/simulator.js:1809-1810](../../js/simulator.js) — `effectiveAcuteStress` blod-bidrags-dekomponering (uændret)
- [js/simulator.js:1852-1853](../../js/simulator.js) — `effectiveProteinGlucagon` (relateret fund §6)
- [js/hovorka.js:58](../../js/hovorka.js) — `EGP_0 = 0.0161 × BW`

### Documentation
- [docs/reviews/2026-04-30_claude_bg-science-vs-implementation.md](2026-04-30_claude_bg-science-vs-implementation.md) — original review (K1)
- [docs/BG-SCIENCE.md §11](../BG-SCIENCE.md) — counterregulation (Cryer 2013)
- [docs/BG-SCIENCE.md §2](../BG-SCIENCE.md) — hepatic glucose production (Roden 2001, Petersen 2004)

### Litteratur
- Cryer PE (2013). *Diabetes* 62:759-764. *"Mechanisms of hypoglycemia-associated autonomic failure in diabetes"* — kontraregulerings-tærskler og T1D-svækkelse.
- Roden M, Petersen KF, Shulman GI (2001). *Diabetes* 50:1612-1617. *"Glucose-induced suppression of hepatic glucose output"* — postabsorptiv glycogenolyse vs GNG-fordeling.
- Petersen KF, Price TB, Bergeron R (2004). *J Clin Endocrinol Metab* 89:4656-4664. *"Regulation of hepatic glucose production during low-intensity exercise"* — gluconeogenese-kapacitet ved tom glykogen.
