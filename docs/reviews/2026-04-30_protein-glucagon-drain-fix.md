# Fix-decision: Protein-glucagon glycogenolyse trak ikke fra glykogen-pool

**Genereret:** 2026-04-30
**Status:** ✅ FIKSET (commit: pending)
**Relateret review:** [docs/reviews/2026-04-30_claude_bg-science-vs-implementation.md](2026-04-30_claude_bg-science-vs-implementation.md) — Finding **K1b**
**Søsker-decision:** [2026-04-30_glycogen-drain-fix.md](2026-04-30_glycogen-drain-fix.md) — K1 (acute-stress glycogenolyse)

---

## 1. Baggrund

### Symptom

Under implementeringen af K1-fixet (acute-stress glycogenolyse drainede 1.67× for hurtigt) blev det opdaget at den **modsatte** bookkeeping-uoverensstemmelse eksisterede for protein-glucagon-bidraget:

- **Blod-bidraget** ([simulator.js:1852-1853](../../js/simulator.js)) decomponerer `proteinGlucagonLevel` 50/50:
  - 50% glycogenolyse (afhænger af reserve)
  - 50% gluconeogenese (uafhængig af reserve)

- **Glykogen-pool drain-bogføringen** ([simulator.js:3015+](../../js/simulator.js)) inkluderede **ikke** protein-glucagon overhovedet.

Resultat: glycogenolyse-komponenten (50% × proteinGlucagonLevel × reserve) leveres til blodet uden at debitere lever-poolen — modsat K1, hvor poolen blev *over*-debiteret.

### Hvem opdagede det

Claude (Opus 4.7) under implementeringen af K1-fixet 2026-04-30. Bug'en blev flagget som "K1b — relateret fund" i K1's decision-doc og som åbent punkt i original review-rapporten, før det blev taget op i en separat fix-runde.

### Hvorfor er det fysiologisk relevant?

Aminosyrer fra protein-måltider stimulerer pancreas-glukagon (også i T1D, hvor glukagon-respons paradoksalt nok bevares lang tid efter diagnosen). Glukagonen får leveren til at producere glukose via en **omtrent 50/50-fordeling** mellem hurtig glycogenolyse og langsom gluconeogenese ([Paterson 2015](../references/), [Bell 2015/2020](../references/), [Bengtsen 2021](../references/)).

I en T1D-patient uden bolus-dækning af protein-måltidet vil dette være den primære årsag til den **forsinkede postprandiale BG-stigning** (peak 3-4t post-måltid) ved fx en ribeye eller proteinrig drink. Klinisk genkendt fænomen, citeret som rationel for "Warsaw method" eller dual-wave bolus-strategier.

---

## 2. Diagnose

### Litteratur-evidens

**Glukagon-stimuleret hepatisk glukoseproduktion — fordeling** ([BG-SCIENCE.md §16-17](../BG-SCIENCE.md), Petersen 2017):

Glukagon aktiverer leverens glykogen-fosforylase (glycogenolyse) og PEPCK/G6PC (gluconeogenese) parallelt. Den relative fordeling afhænger af glykogen-status og varigheden af stimulation, men i postabsorptiv tilstand med fyldt glykogen tilskrives ~50% af det glukagon-stimulerede output glycogenolyse, og ~50% gluconeogenese ([Roden 2001](../references/Roden_2001_HepaticGlucoseProduction.html)).

Aminosyre-stimuleret glukagon-frigivelse er kvantificeret af Paterson et al. (2015), der demonstrerede en peak-effekt på ~+1.7 mmol/L over 3-4 timer ved 75g rent protein-måltid uden carbs. Simulatoren matcher dette via `PROTEIN_GLUCAGON_MAX = 0.25` (max bidrag til stressMultiplier) og Hill-kinetik på `aminoAcidsBlood` med EC50 = 8g.

### Original design vs faktisk implementering

| Aspekt | Design (intent) | Faktisk implementering før fix |
|---|---|---|
| Blod-bidrag fra protein-glucagon | `proteinGlucagonLevel × (0.5 + 0.5 × reserve)` | ✅ Korrekt (linje 1852-1853) |
| Drain fra glykogen-pool | `EGP_0 × proteinGlucagonLevel × 0.5 × reserve × G_PER_MMOL` | ❌ Ingen drain — protein blev ikke nævnt i `updateGlycogenReserve` |

Designintentionen er klar fra blod-bidragets struktur (50/50 split), men drain-bogføringen blev formentlig "glemt" da protein-glucagon-modellen blev tilføjet (efter den oprindelige glykogen-pool-implementering).

### Kvantitativt reality-check

**Per protein-rigt måltid (75g protein, peak proteinGlucagonLevel ≈ 0.20):**

- Peak-rate: `EGP_0 × 0.20 × 0.5 × G_PER_MMOL = 1.127 × 0.10 × 0.180 = 0.0203 g/min ≈ 1.22 g/time`
- Postprandial vindue (proteinGlucagonLevel henfalder via aminoAcidsBlood-decay, t½ ~60 min): `≈ 2-3 g cumulative drain per måltid`

**Over en hel dag med 3 protein-rige måltider:**
- ~7-10 g phantom-glycogen der ikke blev debiteret

### Konsekvens for spilleroplevelsen og modellen

1. **Mass balance brudt**: glukose leveres til blodet via glycogenolyse uden modsvarende debitering af lager.
2. **Glykogen-pool forbliver kunstigt fyldt** efter protein-rige måltider.
3. **Stress-EGP-tapering forsinkes**: hvis spilleren får hypo efter et protein-rigt måltid, leverer modellen mere kontraregulatorisk EGP end fysiologisk berettiget (fordi glycogenReserve er over-estimeret).
4. **Long-running scenarier divergerer**: i Box Challenge eller multi-dages campaign-baner akkumuleres fejlen.

Effekten er mindre end K1's (~10g/døgn vs. K1's potentielt 5-10g/time under hypo) men eksisterer kontinuert ved alle protein-måltider, ikke kun ved hypo-events.

---

## 3. Løsning

### Matematisk struktur

Tilføj eksplicit protein-glycogenolyse-drain som "FORBRUG 4" i `updateGlycogenReserve()`, spejlet eksakt fra K1-fixets struktur:

**Tilføjet:**
```js
// FORBRUG 4: Protein-glucagon glycogenolyse — 50% af bidrag, skaleres med reserve
const proteinGlycogenolysis_gPerMin =
    this.hovorka.EGP_0 * this.proteinGlucagonLevel * 0.5 * GLUCOSE_G_PER_MMOL;
const scaledProtein = proteinGlycogenolysis_gPerMin * this.glycogenReserve;
const totalConsumption = scaledBasal + scaledStress + scaledProtein + scaledExercise;
```

Strukturen matcher K1-fixet:
- Konstant `0.5` afspejler glycogenolyse-andelen i blod-bidragets dekomponering
- `× this.glycogenReserve` skalerer drain proportionalt med tilgængelig pool

### Konstanter og kalibrerings-targets

| Parameter | Værdi | Begrundelse |
|---|---|---|
| Protein-glucagon glycogenolyse-andel | **0.5** | Matcher `effectiveProteinGlucagon = proteinGlucagonLevel × (0.5 + 0.5 × reserve)` ved [simulator.js:1852-1853](../../js/simulator.js). Ingen ændring i blod-bidragets struktur — kun konsistent bogføring. |
| Protein-glucagon GNG-andel | **0.5** | Implicit; bidrager til blod uden glykogen-drain (uændret) |

### Forventede drain-værdier efter fix

**Kombineret K1+K1b-baseline (BG=2.0, acute=0.4 pinnet, proteinGlucagonLevel=0.20, fuld glykogen, 70 kg, 60 min):**
- Total drain post-fix: **~10.2 g**
- Pre-fix (kun K1 fixed, K1b ikke fixed): **~9.0 g**
- Marginal protein-bidrag: **~1.2 g**

**Realistisk protein-måltid (75g protein, ingen acute stress, normal BG):**
- Cumulative drain over 4-timers postprandial vindue: **~2-3 g**
- Pre-fix: **0 g** (protein-glucagon ikke bookkept)

---

## 4. Verifikation

### Eksperimentel før/efter-tabel

Test-scenario: 70 kg patient, BG=2.0 mmol/L, `addAcuteStress(0.4)` (pinnet via BG-feedback), `proteinGlucagonLevel = 0.20` (pinnet manuelt over 60 iterationer), fuld glykogen-pool. 60 minutters simulation via `updateStressHormones(1.0) × 60`.

| Metrik | Pre-fix | Post-fix | Litteratur-target |
|---|---|---|---|
| Total glykogen-drain over 60 min | **9.01 g** | **10.23 g** | Roden 2001 / Paterson 2015: 50% glycogenolyse-andel ved aminosyre-stimuleret glukagon — modelleret rate er konsistent |
| Marginal protein-bidrag | 0 g | 1.22 g | (Eksakt match til analytisk: 1.127 × 0.20 × 0.5 × 0.180 × 60 = 1.22 g) |
| Massebalance | Glycogenolyse leveret til blod uden pool-debit | Glycogenolyse debiteret korrekt fra pool | ❌ Brudt | ✅ Restaureret |

### Test-resultater

Tilføjet ny regression-test i [tests/simulation.test.js](../../tests/simulation.test.js):

```
test('K1b regression: glycogen drain matches blood-side protein-glucagon decomposition (50/50)')
  Asserts: 9.5 < drain < 11.0 g (post-fix expected ~10.23g; pre-fix bug ~9.01g)
```

Test-suite: **137/137 passed** efter fix (136 eksisterende + 1 ny).

### Konsistens med K1

Med K1 + K1b begge fixed har glykogen-pool-bogføringen nu **fuld konsistens** med blod-bidragets dekomponering:

| EGP-kilde | Blod-bidrag | Glycogenolyse-andel (drainer pool) | GNG-andel (drainer ikke) |
|---|---|---|---|
| Basal | `0.5 + 0.5 × reserve + GNG-comp` | 0.5 × reserve | 0.5 + GNG-comp |
| Acute stress | `acute × (0.6 × reserve + 0.4)` | acute × 0.6 × reserve | acute × 0.4 |
| Protein-glucagon | `protein × (0.5 + 0.5 × reserve)` | protein × 0.5 × reserve | protein × 0.5 |
| Motion | `kcal × 0.25 / 4 × insulinGate` | hele bidrag × reserve | 0 (alt fra glykogen) |

Alle EGP-kilder er nu massebalancerede.

---

## 5. Sub-agent input

Ingen sub-agents brugt. Bug'en blev identificeret af Claude direkte under K1-fix-implementeringen via mønstergenkendelse: når én massebalance-bug findes, tjek systematisk alle andre EGP-bidragsberegninger for samme klasse fejl.

---

## 6. Files cited

### Source code (ændret)
- [js/simulator.js](../../js/simulator.js) — linje 3088-3110 (FORBRUG 4 tilføjet, totalConsumption udvidet)
- [tests/simulation.test.js](../../tests/simulation.test.js) — ny regression-test "K1b regression"

### Source code (refereret)
- [js/simulator.js:1852-1853](../../js/simulator.js) — `effectiveProteinGlucagon` blod-bidrags-dekomponering (uændret)
- [js/simulator.js:3732](../../js/simulator.js) — `proteinGlucagonLevel` Hill-kinetik fra `aminoAcidsBlood`
- [js/simulator.js:537-539](../../js/simulator.js) — `AA_EC50`, `AA_HILL_N`, `PROTEIN_GLUCAGON_MAX` konstanter

### Documentation
- [docs/reviews/2026-04-30_glycogen-drain-fix.md](2026-04-30_glycogen-drain-fix.md) — søster-fix (K1, acute-stress)
- [docs/reviews/2026-04-30_claude_bg-science-vs-implementation.md](2026-04-30_claude_bg-science-vs-implementation.md) — original review (K1b)
- [docs/BG-SCIENCE.md §16-17](../BG-SCIENCE.md) — protein-glucagon dynamik (T1D)
- [docs/BG-SCIENCE.md §11](../BG-SCIENCE.md) — counterregulation (Cryer 2013)

### Litteratur
- Paterson MA, Smart CE, Lopez PE, et al. (2015). *Diabetes Care* 38:1008-1015. *"Influence of dietary protein on postprandial blood glucose levels in individuals with type 1 diabetes mellitus..."* — kvantificering af protein-induced BG rise.
- Bell KJ, Smart CE, Steil GM, et al. (2015). *Diabetes Care* 38:1008-1015 / Bell KJ, Toschi E, Steil GM, Wolpert HA (2016). *Diabetes Care* 39:1631-1634. *"Optimized Mealtime Insulin Dosing for Fat and Protein..."*
- Bengtsen MB, Møller N. (2021). *Endocr Connect* 10:R207-R220. *"Mini-review: Glucagon responses in type 1 diabetes..."* — bevaret aminosyre-glukagon-respons i T1D.
- Roden M, Petersen KF, Shulman GI (2001). *Diabetes* 50:1612-1617. *"Glucose-induced suppression of hepatic glucose output"* — postabsorptiv glycogenolyse vs GNG-fordeling.
- Petersen MC, Vatner DF, Shulman GI (2017). *Nat Rev Endocrinol* 13:572-587. *"Regulation of hepatic glucose metabolism in health and disease"* — glukagon-action mekanismer.
