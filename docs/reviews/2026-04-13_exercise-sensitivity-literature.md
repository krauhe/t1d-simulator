# Exercise-induced insulin sensitivity — litteratur-review

**Dato:** 2026-04-13
**Formål:** Fastlægge parametre for en to-komponent model af motions-induceret insulinfølsomhed i T1D-simulatoren — en akut kontraktions-medieret komponent (AMPK/GLUT4) og en langsom post-exercise insulin sensitivity komponent (PEIS).

---

## 1. Baggrund

Skeletmuskel optager glukose via to delvist uafhængige signalveje:

- **Insulin/Akt-pathway:** Insulin → IRS-1 → PI3K → Akt → AS160/TBC1D4 → GLUT4-translokation. Kræver funktionel insulin-signalering og er svækket ved insulinresistens.
- **Kontraktions-pathway:** Muskelkontraktion → AMPK + Ca²⁺/CaMKII + Rac1 → (også TBC1D4/AS160) → GLUT4-translokation. Insulin-uafhængig og bevaret selv ved T2D-insulinresistens (Sylow 2017).

De to veje konvergerer delvist ved TBC1D4/AS160, men har forskellige tidskonstanter:

- **Akut komponent (kontraktion):** Under og umiddelbart efter motion. Glukoseoptag stiger op til 50x. AMPK-aktivering falder tilbage mod baseline i løbet af 30-60 min efter motion slutter (Cartee 2015).
- **Langsom komponent (PEIS):** AS160-fosforylering og muskel-insulin-sensitivitet forbliver forhøjet i timer til dage efter motion. Mekanismen involverer persistent AS160-fosforylering, GLUT4-redistribution og glykogen-depletion (Cartee 2015; Mikines 1988; Maarbjerg 2011).

Den nuværende simulator har kun én komponent (t½ ~8-12 t), som er for langsom til at fange det akutte BG-dyk under motion når der er aktivt bolus-insulin, og samtidig for hurtig til at fange den biphasiske nat-hypo-risiko (McMahon 2007).

---

## 2. Kilder og metrics

| Kilde | N | Population | Protokol | Målt effekt | Varighed | Amplitude |
|---|---|---|---|---|---|---|
| Richter & Hargreaves 2013 (Physiol Rev, review) | - | Menneske/dyr | Review af GLUT4-signalering | AMPK, Ca²⁺, NOS som proximale signalveje; GLUT4-translokation under kontraktion | Ikke kvantificeret eksplicit | Kvalitativt |
| Sylow et al. 2017 (Nat Rev Endocrinol, review) | - | Menneske/dyr | Review | Glukoseoptag under motion 50x. Insulin-uafhængig. Rac1, AMPK, CaMK | Ikke eksplicit for PEIS | 50-fold peak |
| Cartee 2015 (AJPEM, review) | - | Menneske/rotter | Review af AS160/GLUT4 | Post-exercise ISGU forhøjet; AS160-fosforylering persisterer 3-27 timer; AMPK reverserer 30-60 min; kulhydrat-indtag reverserer effekten via glykogen-supercompensation | 24-48 t | Kvalitativt "substantially elevated" |
| Mikines et al. 1988 (AJP) | 7 | Utrænede mænd (raske) | 60 min ergometer ved 150 W; euglykæmisk clamp rest / umiddelbart post / 48 t / 5 dage | Km ↓ (52→40 μU/mL), Vmax ↑ (9.5→10.7 mg/min/kg) | 48 t, fraværende ved 5 dage | Km ~23% reduktion, Vmax ~13% stigning |
| Riddell et al. 2017 (Lancet D&E, konsensus) | - | T1D | Consensus guidelines | "Increased insulin sensitivity lasts up to 24-48 h following exercise" | 24-48 t | Konkrete dose-reduktions-anbefalinger: 25%/50%/75% bolus-reduktion for let/moderat/intens motion |
| Little et al. 2010 (J Physiol) | 7 | Utrænede | HIIT 6 sessioner/2 uger; 8-12 x 60 s @ 100% Wpeak, 75 s hvile | GLUT4 +119%, mitokondrie-markører +20-40% | Adaptationer efter 2 uger | GLUT4 mere end fordoblet |
| Gillen & Gibala 2014 (APNM, review) | - | Varierede | Review af praktisk HIIT | ≤10 min intens @ 3x/uge giver cardiometabolic forbedring | Uger (kronisk) | "similar to" høj-volumen træning |
| McMahon et al. 2007 (JCEM) | 9 | T1D adolescenter (16 år) | 45 min ved 95% af LT (eftermiddag); glukose-infusion for at holde euglycæmi i 18 t | BIFASISK glukosebehov: (1) under/lige efter motion og (2) fornyet 7-11 t efter | Biphasic; anden top ved 7-11 t post-exercise | Ikke rapporteret som single-faktor |
| Maarbjerg 2011 (Acta Physiol, review) | - | Menneske/dyr | Review | TBC1D4 som regulerende post-exercise insulin sensitivity kandidat; GLUT4-translokation central | Ikke eksplicit | - |
| Mann et al. "nothing lasts forever" review (PMC8352615) | - | Meta | Review af acute vs chronic | Op til 72 t; nogle studier 14 t men ikke 38 t; andre 48 t men ikke 120 t; CHO-indtag halverer effekten (48→18 t i dyrestudier) | 24-72 t (kontekst-afhængigt) | Untrænede/insulinresistente: +25-50% |

**Intensitets-tærskel:** 70% VO₂max giver effekt der 40% ikke gør, trods samme energiforbrug. Energi-tærskel ~900 kcal (~3.77 MJ) nævnt i en sub-kohorte (Mann review).

---

## 3. Akut komponent (kontraktions-medieret)

**Mekanisme:** AMPK + Ca²⁺/CaMKII + Rac1 → GLUT4-translokation. Insulin-uafhængig.

**Aktiveringstid:** Stort set øjeblikkelig (sekunder til minutter) ved motions-start.

**Deaktiveringstid:** AMPK-fosforylering reverserer inden for 30-60 min efter motion ophører (Cartee 2015). Den direkte insulin-uafhængige glukose-optag dimensionen reverserer på ~2-3 timer.

**Foreslåede parametre:**

| Parameter | Forslag | Kilde |
|---|---|---|
| t½ (efter motion slut) | 10-20 min | Cartee 2015 (AMPK decay 30-60 min → t½ ~15 min) |
| Peak amplitude ved moderat motion (50% VO₂max) | 3-5x basal glukose-optag | Sylow 2017 (op til 50x, men reel T1D-kontekst lavere) |
| Peak amplitude ved intens motion (>75% VO₂max) | 8-15x basal | Sylow 2017 |
| Duration-scaling | Plateau efter ~10-15 min motion | Konsensus: kontraktions-signalet er i steady-state under vedvarende motion |
| Intensitet-scaling | Sigmoid/Hill; steiler stigning 40-70% VO₂max | Mann review (70% trigger > 40%) |

Den akutte komponent forklarer hvorfor BG kan falde hurtigt under motion selv uden at PEIS er "opbygget" endnu — muskelen optager glukose bypasset insulin-signaleringen.

---

## 4. Langsom komponent (PEIS)

**Mekanisme:** Persistent AS160/TBC1D4-fosforylering + GLUT4-redistribution + glykogen-depletion. Kræver insulin for at manifestere sig som øget glukose-optag (det er insulin-sensitivitet, ikke basal-optag).

**Aktiveringstid:** Stiger under motion og peaker kort efter motion slut. Kinetikken er ikke godt karakteriseret — litteraturen måler typisk ved diskrete tidspunkter (0, 4, 24, 48 t).

**Deaktiveringstid:** Gradvis decay. Mikines 1988: klar effekt ved 48 t, ingen effekt ved 5 dage (120 t). Riddell konsensus: 24-48 t. Flere studier refereret i Mann-review: 14-72 t. Kulhydrat-genopfyldning accelererer decay (48 t → 18 t).

**Foreslåede parametre:**

| Parameter | Forslag | Kilde |
|---|---|---|
| t½ | 12-18 t (default 14 t) | Mikines 1988 (effekt ved 48 t men ikke 120 t → t½ ~15-20 t passer) |
| Peak amplitude (% stigning i insulinfølsomhed) ved 60 min moderat motion | +20-30% | Mikines 1988 (Vmax +13%, Km -23% ⇒ netto ~25%) |
| Peak amplitude ved HIIT / intens (45 min @ 95% LT) | +30-50% | McMahon 2007 biphasic behov; Little 2010 GLUT4 +119% efter HIIT-træning (akut respons skaleret ned) |
| Duration-scaling | Sqrt eller log — mættende | Energi-tærskel 900 kcal antyder ikke-lineær. Praktisk: proportional med motion-varighed op til ~60 min, derefter plateau |
| Intensitet-scaling | Hill-kurve med EC50 ~55% VO₂max | Mann review |
| Biphasic peak 2 (kun T1D-børn?) | 7-11 t post-motion | McMahon 2007 — kan være counter-regulation rebound eller glykogen-resynthesis fase |

---

## 5. Relativ fordeling mellem komponenter

**Under motion (t < motions-varighed + 30 min):**
- Akut komponent dominerer (3-15x glukose-optag over basal)
- PEIS bidrager mindre fordi insulin-niveauet ofte er lavt (eller bolus fra sidste måltid)

**Umiddelbart efter motion (0-4 t):**
- Akut komponent decaye hurtigt (t½ 10-20 min)
- PEIS peaker og dominerer derfra

**Sen post-exercise (4-48 t):**
- Kun PEIS tilbage; ekspontiel decay med t½ ~14 t

**Ratio ved moderat motion:** Grov praktisk tommelfinger — akut peak er ~3-5x PEIS peak i magnitude, men akut varer minutter mens PEIS varer timer. Integreret over tid bliver AUC'erne ofte sammenlignelige.

**Intensitets-afhængighed af ratio:**
- Lav intensitet (<40% VO₂max): Primært akut komponent, PEIS minimal (under 900 kcal-tærskel)
- Moderat (50-70% VO₂max): Begge komponenter, ratio ~2:1 akut:PEIS i peak
- Høj intensitet / HIIT: Akut komponent maksimal, men øget counter-regulation kan maske effekten; PEIS robust pga. glykogen-depletion

---

## 6. T1D-specifikke hensyn

1. **Øget insulin-absorption fra subkutant depot under motion** (ikke dækket af de fundne reviews — tilføj separat kilde): Øget perifer blodgennemstrømning udvasker insulin hurtigere → akut insulin-peak. Dette forstærker den akutte BG-drop ved motion med aktivt bolus.

2. **Nat-hypo-risiko biphasic (McMahon 2007):** T1D-adolescenter viste øget glukose-behov 7-11 t efter eftermiddag-motion. Mekanisme formentlig glykogen-resynthesis der tømmer cirkulerende glukose. Simulator bør have en forsinket PEIS-sub-komponent eller en separat "glykogen-resynthesis-drain" for at fange dette.

3. **Counter-regulation under intens motion (T1D):** Ved >80% VO₂max ses epinephrin-/glukagon-peak der hæver BG. T1D har ofte svækket glukagon-respons men bevaret adrenalin. Dette kan sløre den akutte glukose-optags-effekt under HIIT (Bally 2016 — allerede i reference-mappen).

4. **Fravær af endogen insulin-regulering:** Hos raske falder insulin-sekretion under motion. T1D kan ikke reducere eget insulin → bolus/basal må manuelt reduceres. Riddell 2017 anbefaler 25-75% bolus-reduktion og 20% nat-basal-reduktion.

---

## 7. Foreslåede modelparametre

```
// Akut kontraktions-medieret komponent
ACUTE_UPTAKE_PEAK_FACTOR_MODERATE = 4.0   // x basal muskel-glukose-optag ved 50% VO2max
ACUTE_UPTAKE_PEAK_FACTOR_HIGH     = 10.0  // x basal ved 80%+ VO2max
ACUTE_ACTIVATION_TAU_MIN          = 2     // minutter til peak (tæt på øjeblikkelig)
ACUTE_DECAY_HALFLIFE_MIN          = 15    // t1/2 efter motion slut (range 10-20)
ACUTE_INTENSITY_HILL_EC50         = 0.55  // fraction VO2max (55%)
ACUTE_INTENSITY_HILL_N            = 3     // stejl Hill-kurve

// Langsom post-exercise insulin sensitivity (PEIS) komponent
PEIS_PEAK_AMPLITUDE_MODERATE_60MIN = 0.25 // +25% insulin-sensitivity ved 60 min moderat motion
PEIS_PEAK_AMPLITUDE_HIIT_45MIN     = 0.45 // +45% ved 45 min HIIT
PEIS_DURATION_SCALING              = sqrt // amplitude ∝ sqrt(motion_varighed_min/60)
PEIS_INTENSITY_HILL_EC50           = 0.55 // samme tærskel som akut
PEIS_DECAY_HALFLIFE_H              = 14   // timer (range 12-18)
PEIS_BUILDUP_DURING_EXERCISE_TAU_MIN = 30 // bygger op over ~30 min til plateau

// Biphasic T1D-effekt (McMahon)
NOCTURNAL_REBOUND_PEAK_H   = 9    // timer efter eftermiddag-motion (7-11 range)
NOCTURNAL_REBOUND_AMPLITUDE = 0.15 // +15% ekstra glukose-drain i 2-3 timer
NOCTURNAL_REBOUND_WIDTH_H  = 4
```

**Implementerings-skitse:**

```
totalInsulinSensitivityMultiplier = 1 + acute(t) + peis(t)
muscleGlucoseUptake = baselineUptake * (1 + acuteContractionFactor(intensity, t)) * (1 + insulinEffect * insulinSensitivityMultiplier)
```

Hvor `acute` og `peis` er separate kompartmenter med forskellige tidskonstanter, begge drevet af motion-input (intensitet × tid).

---

## 8. Åbne spørgsmål / svagheder i litteraturen

1. **Få humane T1D-studier med timeserie-clamps.** Mest af tidsforløbs-data kommer fra raske (Mikines) eller dyr. T1D-specifikke tidskonstanter er ekstrapoleret.

2. **Intensitet-respons-kurven for PEIS er dårligt kvantificeret.** Vi ved 40% ≠ 70%, men har ingen EC50-værdi publiceret. Vi har gættet 55% VO₂max baseret på diskrete tærskler.

3. **Duration-scaling er heuristisk.** Energi-tærsklen på 900 kcal er nævnt i én undergruppe, men om effekten er sqrt, log eller sigmoid over motions-varighed er ikke direkte målt.

4. **Biphasic-mekanismen (McMahon 7-11 t) er debatteret.** Kan være glykogen-resynthesis, dissoceret counter-regulation, eller nedsat hepatic glukose-output. Vores "rebound"-parameter er en empirisk fit snarere end mekanistisk.

5. **Samspil med kulhydrat-indtag post-exercise:** Mann review antyder CHO halverer PEIS-varighed (48→18 t). Dette er ikke med i simulatorens model og bør overvejes.

6. **HIIT vs kontinuerlig moderat motion:** Gillen/Gibala og Little viser at HIIT giver ligeværdig eller større PEIS trods lavere total-volumen. Vores sqrt-duration-scaling undervurderer HIIT.

7. **Ikke fundet / ikke downloadet:**
   - Originale Bergouignan 2011 — fundet Maarbjerg 2011 (Acta Physiol) som nærmest relaterede candidate-review i stedet
   - Richter 2013 PDF kunne ikke downloades direkte (Cloudflare på journals.physiology.org; PubMed abstract-only). Indhold uddraget fra abstract + sekundære kilder.
   - Gillen 2014 PDF kunne ikke downloades (paywall); indhold uddraget fra abstract.
   - Mikines 1988 PDF kunne ikke downloades (gammel artikel, ikke fri på PMC); indhold fra PubMed abstract.
   - McMahon 2007 PDF kunne ikke downloades (OUP paywall); indhold fra PubMed abstract.

---

## 9. Referencer

**Gemt i `docs/references/`:**

- `Cartee_2015_RW_MechanismsPostExerciseInsulinStimulatedGlucoseUptake.html` — Cartee GD. AJPEM 2015; 309(12):E949-E959. PMID 26487009. PMC4816200.
- `Little_2010_HIITMitochondrialBiogenesis.html` — Little JP et al. J Physiol 2010; 588(6):1011-1022. PMC2849965.
- `Sylow_2017_RW_ExerciseStimulatedGlucoseUptakeRegulation.html` — Sylow L, Kleinert M, Richter EA, Jensen TE. Nat Rev Endocrinol 2017; 13:133-148. DOI 10.1038/nrendo.2016.162.
- `Riddell_2017_RW_ExerciseManagementInType1Diabetes.pdf` — Riddell MC et al. Lancet Diabetes Endocrinol 2017; 5:377-390. (Allerede i mappen før dette review; indhold ekstraheret.)

**Ikke downloadet som fil (indhold indhentet via PubMed-abstracts / review-citationer):**

- Richter EA, Hargreaves M. "Exercise, GLUT4, and skeletal muscle glucose uptake." Physiol Rev 2013; 93:993-1017. PMID 23899560. DOI 10.1152/physrev.00038.2012.
- Mikines KJ, Sonne B, Farrell PA, Tronier B, Galbo H. "Effect of physical exercise on sensitivity and responsiveness to insulin in humans." Am J Physiol 1988; 254:E248-E259. PMID 3126668.
- McMahon SK et al. "Glucose requirements to maintain euglycemia after moderate-intensity afternoon exercise in adolescents with type 1 diabetes are increased in a biphasic manner." J Clin Endocrinol Metab 2007; 92(3):963-968. PMID 17118993.
- Gillen JB, Gibala MJ. "Is high-intensity interval training a time-efficient exercise strategy to improve health and fitness?" Appl Physiol Nutr Metab 2014; 39(3):409-412. PMID 24552392.
- Maarbjerg SJ, Sylow L, Richter EA. "Current understanding of increased insulin sensitivity after exercise — emerging candidates." Acta Physiol 2011. PMID 21352505. (Fundet som erstatning for Bergouignan 2011; samme tematiske review-område.)
- Mann S et al. "The acute vs. chronic effect of exercise on insulin sensitivity: nothing lasts forever." 2021. PMC8352615. (Supplerende review for decay-kinetik.)

---

**Anbefaling til næste fase (Fase 2 — implementering):**
Parametre ovenfor er klar til kodning. Start med kalibrering mod Mikines 1988 (60 min @ 150 W → +25% ISI ved 48 t) og McMahon 2007 biphasic (45 min @ 95% LT → glukosebehov-peak ved 9 t post). Validér mod Riddell 2017 dose-reduktionstabel: 50% bolus-reduktion skal holde BG stabil ved 60 min moderat motion.
