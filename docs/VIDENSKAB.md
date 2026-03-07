# Fysiologiske Faktorer i Blodglukoseregulering ved Type 1 Diabetes

*En systematisk gennemgang af de processer og faktorer der påvirker blodglukoseniveauet hos personer med type 1 diabetes, med videnskabelige referencer.*

**Status:** Dette dokument udvides løbende efterhånden som simulatoren udvides. Faktorer markeret med [IMPLEMENTERET] er aktive i simulatoren; [DELVIST] er delvist modelleret; [PLANLAGT] er på roadmap; [IKKE IMPLEMENTERET] er dokumenteret for fuldstændighedens skyld.

---

## Indholdsfortegnelse

1. [Glukose-kinetik](#1-glukose-kinetik)
2. [Insulin-farmakokinetik](#2-insulin-farmakokinetik)
3. [Kulhydrat-absorption og gastric emptying](#3-kulhydrat-absorption-og-gastric-emptying)
4. [Fedt og protein](#4-fedt-og-protein)
5. [Endogen glukoseproduktion](#5-endogen-glukoseproduktion-hepatisk)
6. [Renal glukose-clearance](#6-renal-glukose-clearance)
7. [Cerebral glukoseforbrug](#7-cerebral-glukoseforbrug)
8. [Fysisk aktivitet — aerob](#8-fysisk-aktivitet--aerob-motion)
9. [Fysisk aktivitet — anaerob](#9-fysisk-aktivitet--anaerob-styrketraening)
10. [Kontraregulatoriske hormoner](#10-kontraregulatoriske-hormoner)
11. [Dawn-fænomenet](#11-dawn-faenomenet-cirkadisk-kortisolpeak)
12. [Somogyi-effekten](#12-somogyi-effekten-rebound-hyperglykæmi)
13. [Døgnvariation i insulinfølsomhed](#13-dognvariation-i-insulinfølsomhed)
14. [Menstruationscyklus](#14-menstruationscyklus)
15. [Sæsonvariation](#15-saesonvariation)
16. [Sygdom og infektion](#16-sygdom-og-infektion)
17. [Søvn og søvnmangel](#17-sovn-og-sovnmangel)
18. [Alkohol](#18-alkohol)
19. [Temperatur og klima](#19-temperatur-og-klima)
20. [Ketonstofskifte og diabetisk ketoacidose](#20-ketonstofskifte-og-diabetisk-ketoacidose-dka)
21. [CGM-teknologi](#21-cgm-teknologi-continuous-glucose-monitoring)
22. [Stress (psykologisk)](#22-stress-psykologisk)
23. [Injektionssted](#23-injektionssted)

---

## 1. Glukose-kinetik
**[IMPLEMENTERET — Hovorka 2004]**

Glukose i kroppen fordeles mellem to kompartmenter:

- **Q1 (plasma/blod):** Det målbare blodsukker. Glukose her er tilgængeligt for hjernen, muskler og organer.
- **Q2 (perifere væv):** Glukose i muskler, fedtvæv og andre væv. Udveksles med plasma via diffusion og insulin-medieret transport.

Den matematiske beskrivelse:

```
dQ1/dt = -(F01c + FR) - x1·Q1 + k12·Q2 + UG + EGP0·(1 - x3)
dQ2/dt = x1·Q1 - (k12 + x2)·Q2
```

Hvor `k12` er transferkonstanten mellem kompartmenterne (0.066 min⁻¹), `x1` og `x2` er insulin-afhængige transportrater, og `F01c` og `FR` er henholdsvis cerebral forbrug og renal clearance (se afsnit 6 og 7).

Glukosekoncentrationen beregnes som `G = Q1 / (VG · BW)`, hvor VG = 0.16 L/kg er glukosens distributionsvolumen.

**Kilde:** Hovorka R, Canonico V, Chassin LJ, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920. [PDF](http://www.stat.yale.edu/~jtc5/diabetes/NonlinearModelPredictiveControl_Hovorka_04.pdf)

---

## 2. Insulin-farmakokinetik
**[IMPLEMENTERET — Hovorka 2004 subkutan model]**

Subkutant injiceret insulin gennemgår en flertrinsprocces før det påvirker blodsukkeret:

### 2.1 Absorption (depot → plasma)

Insulin injiceres subkutant og absorberes via to seriekoblede kompartmenter:

```
dS1/dt = u(t) - S1/τI
dS2/dt = S1/τI - S2/τI
dI/dt  = S2/(VI·τI) - ke·I
```

- **S1, S2:** Subkutane depoter. Den tokammerede model giver en realistisk forsinket peak.
- **I:** Plasma insulin-koncentration (mU/L).
- **τI:** Tid til maksimal absorption (~55 min for hurtigvirkende analoger som NovoRapid).
- **ke:** Insulin-eliminationskonstant (0.138 min⁻¹).
- **VI:** Insulin-distributionsvolumen (0.12 L/kg).

Peak plasma-insulin indtræder ved ca. `2 × τI` ≈ 110 minutter efter injektion, hvilket stemmer overens med kliniske observationer for insulin aspart/lispro.

### 2.2 Insulin-aktion (forsinkelse fra plasma til effekt)

Insulin i plasma påvirker ikke glukose instantant. Tre "effektkompartmenter" modellerer forsinkelsen:

```
dx1/dt = -ka1·x1 + kb1·I    (glukose-transport: blod → muskler)
dx2/dt = -ka2·x2 + kb2·I    (glukose-disposal i muskler)
dx3/dt = -ka3·x3 + kb3·I    (suppression af lever-EGP)
```

Disse tre parallelle veje giver en samlet insulineffekt der er bredere og mere gradvis end plasma-insulin-profilen alene.

**Insulinfølsomhed** bestemmes af forholdet kb/ka for hvert kompartment:
- S_IT = kb1/ka1 = 51.2 × 10⁻⁴ L/mU/min (transport)
- S_ID = kb2/ka2 = 8.2 × 10⁻⁴ L/mU/min (disposal)
- S_IE = kb3/ka3 = 520 × 10⁻⁴ /mU (EGP-suppression)

### 2.3 Insulintyper

Forskellige insulinpræparater har forskellige farmakokinetiske profiler:

| Type | Kategori | Onset | Peak | Varighed |
|------|----------|-------|------|----------|
| Insulin aspart (NovoRapid) | Hurtigvirkende | 10-20 min | 1-2 t | 3-5 t |
| Insulin lispro (Humalog) | Hurtigvirkende | 10-15 min | 1-2 t | 3-4 t |
| Faster aspart (Fiasp) | Ultrahurtig | 2-5 min | 1-1.5 t | 3-4 t |
| Insulin glargin (Lantus) | Langvirkende | 1-2 t | Peakless | ~24 t |
| Insulin degludec (Tresiba) | Ultralangvirkende | 1-2 t | Peakless | >42 t |

**Kilder:**
- Hovorka et al. (2004), se ovenfor.
- Heise T, et al. (2015). "Pharmacokinetic and pharmacodynamic properties of faster-acting insulin aspart versus insulin aspart across a clinically relevant dose range." *Clinical Pharmacokinetics*, 56(6):649-660.

---

## 3. Kulhydrat-absorption og gastric emptying
**[IMPLEMENTERET — Hovorka 2004 tarmmodel]**

Kulhydrater fra mad gennemgår en flertrinsprocces:

1. **Mastikation og mavepassage:** Maden nedbrydes mekanisk og enzymatisk. Mavetømningshastigheden er typisk 1-4 kcal/min og er rate-limiterende for glukoseoptag.
2. **Intestinal absorption:** Glukose absorberes i tyndtarmen og transporteres til leveren via portalvenen.

Modelleret med to seriekoblede kompartmenter:

```
dD1/dt = AG·d(t) - D1/τG
dD2/dt = D1/τG - D2/τG
UG = D2/τG
```

- **AG:** Kulhydrat-bioavailability (0.8 — ca. 80% af indtaget kulhydrat absorberes som glukose)
- **τG:** Tid til maksimal glukose-absorption (~40 min)
- **UG:** Glukose-absorptionsrate ind i plasma (mmol/min)

### Glykæmisk indeks (GI)

GI afspejler primært forskelle i mavetømningshastighed og digestionsrate. Fødevarer med lavt GI (fx fuldkorn, bælgfrugter) har langsommere mavetømning og giver et lavere, bredere glukose-peak. Dette kan modelleres ved at justere τG:

- Højt GI (hvidt brød, juice): τG ≈ 20-30 min
- Medium GI (pasta, ris): τG ≈ 40-50 min
- Lavt GI (bælgfrugter, fuldkorn): τG ≈ 60-90 min

**Kilder:**
- Hovorka et al. (2004), se afsnit 1.
- Haidar A, et al. (2014). "Mathematical Model of Glucose-Insulin Metabolism in Type 1 Diabetes Including Digestion and Absorption of Carbohydrates." *SICE Journal of Control, Measurement, and System Integration*, 7(6):314-325.
- Bornhorst GM, et al. (2016). "A mechanistic model of intermittent gastric emptying and glucose-insulin dynamics following a meal containing milk components." *PLOS ONE*, 11(6):e0156443. [PMC](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0156443)

---

## 4. Fedt og protein
**[DELVIST IMPLEMENTERET]**

### 4.1 Fedt forsinker kulhydratabsorption

Fedt i et måltid forsinker mavetømningen markant. Mekanismen er primært via frigivelse af inkretinhormoner (GLP-1, GIP) og CCK (cholecystokinin) fra tyndtarmen, som signalerer til pylorus-sphinkteren om at bremse mavetømningen.

Effekten: et måltid med højt fedtindhold giver et lavere men mere udtrukket glukose-peak sammenlignet med samme kulhydratmængde uden fedt.

### 4.2 Protein bidrager til glukose via glukoneogenese

Ca. 50-60% af protein-aminosyrer er glukogene og kan konverteres til glukose i leveren via glukoneogenese. Den klinisk relevante effekt er:

- Ca. 20-35% af proteinets energi bidrager til glukose
- Effekten er forsinket 3-5 timer efter måltidet
- Effekten er additiv med kulhydraternes glukose-bidrag

Et studie med T1D-børn viste at tilføjelse af 35g protein til 30g kulhydrat øgede det postprandiale glukose-areal med 49% i tidsvinduet 3-5 timer efter måltidet.

### 4.3 Fat-Protein Units (FPU)

Klinisk bruges FPU-konceptet til at beregne ekstra insulin til fedt og protein:
- 1 FPU = 100 kcal fra fedt+protein
- 1 FPU ≈ 10g kulhydrat-ækvivalent (doseres som ekstra insulin, men forsinket 3-5 timer)

Et randomiseret crossover-studie viste at FPU-algoritmen krævede 47% mere insulin til fedt- og proteinrige måltider sammenlignet med ren kulhydrattælling.

**Kilder:**
- Smart CEM, et al. (2013). "Both dietary protein and fat increase postprandial glucose excursions in children with type 1 diabetes, and the effect is additive." *Diabetes Care*, 36(12):3897-3902. [PMC3836096](https://pmc.ncbi.nlm.nih.gov/articles/PMC3836096/)
- Bell KJ, et al. (2020). "Insulin dosing for fat and protein: Is it time?" *Diabetes Care*, 43(1):13-15.
- Dalla Man C, et al. (2025). "Simulation of High-Fat High-Protein Meals Using the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.

---

## 5. Endogen glukoseproduktion (hepatisk)
**[IMPLEMENTERET — Hovorka 2004 + stresshormoner]**

Leveren producerer glukose via to mekanismer:

1. **Glykogenolyse:** Nedbrydning af leverglykogen til glukose. Hurtigt tilgængeligt (minutter), men begrænset lager (~80-100g).
2. **Glukoneogenese:** Nysyntese af glukose fra laktat, aminosyrer og glycerol. Langsommere men ubegrænset kapacitet.

Den basale hepatiske glukoseproduktion (EGP0) er ca. 0.0161 mmol/min/kg (svarende til ~1.6 mg/min/kg eller ~160 mg/min for en 70 kg person).

### Insulinsuppression af EGP

Insulin undertrykker hepatisk glukoseproduktion kraftigt via effektkompartment x3:

```
EGP = EGP0 · stressMultiplikator · (1 - x3)
```

Ved normale basale insulinniveauer er x3 ≈ 0.4-0.6, dvs. leveren producerer ca. 40-60% af sin maksimale kapacitet. Ved forhøjet insulin (efter bolus) undertrykkes EGP næsten fuldstændigt (x3 → 1).

### Stresshormoner øger EGP

Kontraregulatoriske hormoner (se afsnit 10) øger EGP via `stressMultiplikator`:

```
stressMultiplikator = 1.0 + akutStress + kroniskStress + cirkadiskKortisol
```

**Kilde:** Hovorka et al. (2004). Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *Journal of Clinical Investigation*, 64(1):62-71.

---

## 6. Renal glukose-clearance
**[IMPLEMENTERET — Hovorka 2004]**

Nyrerne filtrerer glukose frit i glomerulus. Under normale omstændigheder reabsorberes al glukose i de proximale tubuli via SGLT2-transportere. Når blodglukose overstiger den renale tærskel, mættes transportererne og glukose udskilles i urinen (glukosuri).

```
FR = 0.003 · (G - R_thr) · VG    når G > R_thr
FR = 0                            når G ≤ R_thr
```

- **R_thr:** Renal tærskel ≈ 9 mmol/L (Hovorka) — klinisk varierer den fra 6-14 mmol/L mellem individer
- **0.003:** Renal clearance-koefficient (min⁻¹)
- Den maksimale tubulære glukose-reabsorptionskapacitet (TmG) er 0.9-2.0 mmol/min

Renal glukose-clearance fungerer som en naturlig "sikkerhedsventil" der begrænser hyperglykæmi, men medfører osmotisk diurese (øget urinproduktion, tørst, dehydrering) — kardinalsymptomer ved ubehandlet diabetes.

**Kilder:**
- Hovorka et al. (2004), se afsnit 1.
- Johansen OE, et al. (1984). "Variations in renal threshold for glucose in Type 1 diabetes mellitus." *Diabetologia*, 26(3):180-183. [PubMed](https://pubmed.ncbi.nlm.nih.gov/6714538/)
- NCBI StatPearls. "Physiology, Glycosuria." [NBK557441](https://www.ncbi.nlm.nih.gov/books/NBK557441/)

---

## 7. Cerebral glukoseforbrug
**[IMPLEMENTERET — Hovorka 2004]**

Hjernen er den største forbruger af glukose i hvile — ca. 120g/dag (~5g/time). Cerebral glukoseoptag er primært insulin-uafhængigt (via GLUT1 og GLUT3 transportere) men mættes ved lave glukosekoncentrationer:

```
F01c = F01s · G / (G + 1)    når G ≥ 4.5 mmol/L
F01c = F01s · 4.5 / 5.5      når G < 4.5 mmol/L
```

- **F01s:** Ikke-insulin-afhængigt glukoseforbrug = 0.0097 mmol/min/kg ≈ 0.68 mmol/min for 70 kg
- Mætningsfunktionen `G/(G+1)` sikrer at cerebral forbrug falder ved hypoglykæmi (hjernebeskyttelse)
- Ved G < 4.5 mmol/L fikseres forbruget for at undgå numerisk instabilitet

Klinisk konsekvens: ved svær hypoglykæmi (< 2.5 mmol/L) kan hjernen ikke opretholde normal funktion, hvilket fører til kramper, bevidsthedstab og potentielt død.

**Kilde:** Hovorka et al. (2004), se afsnit 1. Magistretti PJ, Allaman I. (2015). "A cellular perspective on brain energy metabolism and functional imaging." *Neuron*, 86(4):883-901.

---

## 8. Fysisk aktivitet — aerob motion
**[IMPLEMENTERET — Resalat 2020 udvidet Hovorka-model]**

Aerob motion (løb, cykling, svømning) påvirker blodsukkeret via flere samtidige mekanismer:

### 8.1 Insulin-uafhængigt glukoseoptag (GLUT4)

Muskelkontraktion aktiverer AMPK-signalvejen, som uafhængigt af insulin translokerer GLUT4-transportere til muskelcellens overflade. Dette øger glukoseoptaget i arbejdende muskler markant.

Modelleret via tilstandsvariabel E1 (kortvarig effekt):

```
dE1/dt = (PVO2 - E1) / τE1
```

- **PVO2:** Procentdel af VO2max, estimeret fra hjertefrekvens
- **τE1:** Tidskonstant ≈ 20 min (hurtig onset/offset)
- E1 driver direkte glukose-clearance fra Q2: `β · E1 / HR_base`

### 8.2 Forstærket insulinfølsomhed

Motion forstærker insulins effekt på glukose-transport via E2 (langvarig effekt):

```
dE2/dt = (PVO2 - E2) / τE2
```

- **τE2:** Tidskonstant ≈ 200 min (langsom onset, varer timer efter træning)
- E2 forstærker insulineffekten kvadratisk: `(1 + α·E2²) · x1·Q1`

### 8.3 Øget insulinabsorption

Øget blodgennemstrømning og temperatur i subkutant væv accelererer insulinabsorption fra injektionsstedet. Ved puls 120 bpm øges absorptionshastigheden med ca. 50% sammenlignet med hvile.

### 8.4 Post-exercise hypoglykæmi

Forstærket insulinfølsomhed (E2) persisterer 2-12 timer efter træning, hvilket øger risikoen for forsinket hypoglykæmi — især om natten efter eftermiddags/aftentræning.

**Kilder:**
- Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030. [PMC7449052](https://pmc.ncbi.nlm.nih.gov/articles/PMC7449052/)
- Kudva YC, et al. (2021). "Exercise effect on insulin-dependent and insulin-independent glucose utilization." *Am J Physiol Endocrinol Metab*, 321(2):E230-E237. [PMC8321821](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)
- Agianniotis A, et al. (2021). "Modelling glucose dynamics during moderate exercise in individuals with type 1 diabetes." *PLOS ONE*, 16(3):e0248280.
- Riddell MC, et al. (2017). "Exercise management in type 1 diabetes: a consensus statement." *Lancet Diabetes Endocrinol*, 5(5):377-390.

---

## 9. Fysisk aktivitet — anaerob styrketræning
**[DELVIST IMPLEMENTERET — via akut stress]**

Anaerob/højintensitets træning (styrketræning, sprint, HIIT) har en markant anderledes effekt på blodsukkeret end aerob motion:

### 9.1 Akut BG-stigning

Intensiv anaerob aktivitet udløser en kraftig sympatisk respons med frigivelse af katekolaminer (adrenalin, noradrenalin) og glukagon. Disse stimulerer:

- **Hepatisk glykogenolyse:** Hurtig frigivelse af glukose fra leverens glykogendepot
- **Hepatisk glukoneogenese:** Øget nysyntese af glukose
- **Reduceret perifer glukoseoptag:** Katekolaminer hæmmer insulin-medieret glukoseoptag i muskler

Nettoresultat: hepatisk glukoseproduktion overstiger musklernes forbrug → akut BG-stigning (typisk 2-5 mmol/L).

### 9.2 Forsinket BG-fald

2-6 timer efter styrketræning falder BG grundet:
- Glykogen-resyntese i muskler (trækker glukose fra blodet)
- Forstærket insulinfølsomhed (samme mekanisme som aerob motion)
- Udtømning af katekolamineffekt

### 9.3 Klinisk implikation

Mange T1D-patienter oplever forvirrende BG-mønstre ved styrketræning: stigning under træning efterfulgt af fald timer senere. Korrektionsinsulin under træning risikerer at forårsage hypoglykæmi senere.

**Kilder:**
- Riddell MC, et al. (2017). "Exercise management in type 1 diabetes." *Lancet Diabetes Endocrinol*, 5(5):377-390.
- Yardley JE, et al. (2013). "Resistance versus aerobic exercise: acute effects on glycemia in type 1 diabetes." *Diabetes Care*, 36(3):537-542.

---

## 10. Kontraregulatoriske hormoner
**[IMPLEMENTERET — to-lags stresssystem]**

Kroppen har et hierarkisk forsvarssystem mod hypoglykæmi bestående af fire hormoner:

### 10.1 Glukagon (primært forsvar)

- **Trigger:** BG < 3.8 mmol/L
- **Effekt:** Stimulerer hepatisk glykogenolyse og glukoneogenese
- **Onset:** 2-5 minutter, peak 10-20 minutter
- **Kapacitet:** Kan øge hepatisk glukoseproduktion 3-5× basalt

**Vigtigt for T1D:** Glukagonresponset er typisk svækket eller fraværende efter 5+ års sygdom pga. autoimmun destruktion af α-celler og defekt glukose-sensing.

### 10.2 Adrenalin (sekundært forsvar)

- **Trigger:** BG < 3.6 mmol/L
- **Effekt:** Hepatisk glykogenolyse, reduceret perifer glukoseoptag, lipolyse, symptomer (svedtendens, hjertebanken, tremor)
- **Onset:** Minutter
- **Halveringstid:** ~2-3 minutter i plasma, men virkningsvarighed ~60 min

Hos T1D-patienter med hypoglycemia unawareness er adrenalinresponset også svækket (defekt kontraregulation), hvilket skaber en "dobbelt-fejl" der øger risikoen for svær hypoglykæmi markant.

### 10.3 Kortisol (tertiært forsvar)

- **Trigger:** Vedvarende hypoglykæmi, stress, sygdom
- **Effekt:** Øger hepatisk glukoneogenese, reducerer perifer insulinfølsomhed
- **Onset:** 1-2 timer
- **Halveringstid:** 60-90 min i plasma, biologisk virkning 8-12 timer

### 10.4 Væksthormon (GH)

- **Trigger:** Hypoglykæmi, motion, søvn (pulsatil sekretion)
- **Effekt:** Stimulerer lipolyse, reducerer perifer glukoseoptag, øger hepatisk glukoneogenese
- **Onset:** Timer
- **Halveringstid:** ~20 min, men biologisk virkning 4-6 timer

### Modellering i simulatoren

Simulatoren bruger et forenklet to-lags system:

```
akutStress  (adrenalin + glukagon):  t½ ≈ 60 sim-min
kroniskStress (kortisol):            t½ ≈ 12 sim-timer
stressMultiplikator = 1.0 + akutStress + kroniskStress + cirkadiskKortisol
```

**Kilder:**
- Cryer PE. (2013). "Glucose counterregulatory responses to hypoglycemia." *Pediatric Endocrinology Reviews*, 11(Suppl 1):26-37. [PMC3755377](https://pmc.ncbi.nlm.nih.gov/articles/PMC3755377/)
- Cryer PE. (2012). "The physiology and pathophysiology of the neural control of the counterregulatory response." *Am J Physiol Regul Integr Comp Physiol*, 303(11):R1119-R1122.
- Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *J Clin Invest*, 64(1):62-71.

---

## 11. Dawn-fænomenet (cirkadisk kortisolpeak)
**[IMPLEMENTERET — sinusmodel]**

Dawn-fænomenet er en stigning i blodsukkeret i de tidlige morgentimer (ca. kl. 04-08) uden forudgående hypoglykæmi. Det skyldes:

1. **Kortisol-peak:** Det cirkadiske kortisolrytme har et naturligt peak i de tidlige morgentimer, som stimulerer hepatisk glukoneogenese.
2. **Væksthormon (GH):** Pulsatil GH-sekretion under den sene del af søvnen (typisk kl. 00-04) øger hepatisk glukoseproduktion med en forsinkelse på 2-4 timer.
3. **Nedsat insulinfølsomhed:** Begge hormoner reducerer perifer insulinfølsomhed.

Hos raske individer kompenserer pancreas med øget insulinsekretion. Hos T1D-patienter mangler denne kompensation, og BG stiger med typisk 1-3 mmol/L mellem kl. 04 og 08.

### Modellering

```
cirkadiskKortisol = 0.3 · sin(π/2 · (t - 04:00) / 4)    kl. 04:00-08:00 (stigende)
cirkadiskKortisol = 0.3 · cos(π/2 · (t - 08:00) / 4)    kl. 08:00-12:00 (faldende)
cirkadiskKortisol = 0                                      kl. 12:00-04:00
```

Amplitude 0.3 svarer til ca. 30% øget hepatisk glukoseproduktion på toppen.

**Kilder:**
- Bolli GB, et al. (1984). "Demonstration of a dawn phenomenon in normal human volunteers." *Diabetes*, 33(12):1150-1153. [PubMed](https://pubmed.ncbi.nlm.nih.gov/6389230/)
- Porcellati F, et al. (2013). "Thirty years of research on the dawn phenomenon: lessons to optimize blood glucose control in diabetes." *Diabetes Care*, 36(12):3860-3862.
- ScienceDirect Topics. "Dawn Phenomenon." [Link](https://www.sciencedirect.com/topics/medicine-and-dentistry/dawn-phenomenon)

---

## 12. Somogyi-effekten (rebound-hyperglykæmi)
**[IMPLEMENTERET — via automatisk akut stress ved hypoglykæmi]**

Somogyi-effekten (også kaldet rebound-hyperglykæmi) beskriver fænomenet hvor natlig hypoglykæmi efterfølges af morgenhyperglykæmi pga. kontraregulatorisk hormonrespons.

Mekanisme:
1. BG falder under ~3.5 mmol/L (typisk pga. for meget basal- eller bolusinsulin)
2. Kontraregulatoriske hormoner frigives massivt (adrenalin, glukagon, kortisol, GH)
3. Hepatisk glukoseproduktion øges markant
4. BG stiger hurtigt og overskydes til hyperglykæmisk niveau

### Kontrovers

Somogyi-effektens kliniske relevans er omdiskuteret. Nyere studier med CGM viser at de fleste tilfælde af morgenhyperglykæmi skyldes dawn-fænomenet eller utilstrækkelig basalinsulin — ikke rebound fra natlig hypoglykæmi. Effekten eksisterer fysiologisk, men dens praktiske betydning er muligvis overvurderet.

**Kilder:**
- Guillod L, et al. (2007). "Nocturnal hypoglycaemias in type 1 diabetic patients: what can we learn with continuous glucose monitoring?" *Diabetes Metab*, 33(5):360-365.
- NCBI StatPearls. "Somogyi Phenomenon." [NBK551525](https://www.ncbi.nlm.nih.gov/books/NBK551525/)

---

## 13. Døgnvariation i insulinfølsomhed
**[IKKE IMPLEMENTERET — planlagt]**

Insulinfølsomheden varierer markant over døgnet, uafhængigt af dawn-fænomenet:

- **Lavest insulinfølsomhed:** Om morgenen, ca. kl. 08:30 (ISF op til 30-40% lavere end gennemsnittet)
- **Højest insulinfølsomhed:** Om aftenen, ca. kl. 19:00

Denne variation skyldes det cirkadiske system i hypothalamus (SCN) der styrer:
- Kortisol-døgnrytme (peak om morgenen)
- Væksthormon-pulsatilitet (natlig)
- Autonom nervesystem-tonus (sympatisk dominans om morgenen)
- Hepatisk insulinclearance (30-40% højere om natten)

### Klinisk relevans

- Insulin-til-kulhydrat-ratio (ICR) bør ideelt set være lavere om morgenen (mere insulin per gram kulhydrat) og højere om aftenen
- Mange insulinpumper programmeres med 2-3 forskellige basalrater over døgnet
- Gary Scheiner ("Think Like a Pancreas") beskriver dette baseret på klinisk erfaring med pumpeindstillinger

**Kilder:**
- Saad A, et al. (2012). "Diurnal pattern to insulin secretion and insulin action in healthy individuals." *Diabetes*, 61(11):2691-2700.
- Hinshaw L, et al. (2013). "Diurnal pattern of insulin action in type 1 diabetes." *Diabetes*, 62(7):2223-2229.
- Scheiner G. (2020). *Think Like a Pancreas: A Practical Guide to Managing Diabetes with Insulin*. 3rd ed. Da Capo Lifelong Books.

---

## 14. Menstruationscyklus
**[IKKE IMPLEMENTERET — planlagt]**

Kønshormoner har en markant effekt på insulinfølsomheden hos kvinder med T1D:

### 14.1 Follikulærfasen (dag 1-14)

- Østrogen dominerer
- Insulinfølsomheden er normal til let forhøjet
- BG-kontrol er relativt stabil

### 14.2 Lutealfasen (dag 15-28)

- Progesteron stiger markant
- Insulinfølsomheden falder med op til 50% — et studie viste Si fald fra 5.03 til 2.22
- Mekanisme: progesteron hæmmer PI3K-signalvejen i insulinreceptoren og supprimerer PI3K-uafhængige signalveje
- Klinisk konsekvens: mange kvinder med T1D behøver 15-30% mere insulin i ugen op til menstruation
- HOMA-IR stiger fra 1.35 (midfolliculær) til 1.59 (tidlig luteal) — en stigning på ca. 18%

### 14.3 Menstruation (dag 1-5)

- Progesteron falder hurtigt
- Insulinfølsomheden normaliseres
- Risiko for hypoglykæmi hvis insulindosis ikke reduceres

### Modellering (foreslået)

```
// Simpel sinusmodel baseret på cyklusdag
cyklusdag = (simDag - menstruationsStart) % cyklusLængde
if (cyklusdag > 14) {
    // Lutealfase: reduceret insulinfølsomhed
    progesteronEffekt = 0.3 · sin(π · (cyklusdag - 14) / 14)
    ISF_faktor = 1.0 - progesteronEffekt  // op til 30% reduktion
}
```

**Kilder:**
- Yeung EH, et al. (2024). "Menstrual Cycle Effects on Insulin Sensitivity in Women with Type 1 Diabetes: A Pilot Study." *Diabetes Care*.
- Trout KK, et al. (2023). "Menstrual Cycle, Glucose Control and Insulin Sensitivity in Type 1 Diabetes: A Systematic Review." *J Pers Med*, 13(2):374. [PMC9962060](https://pmc.ncbi.nlm.nih.gov/articles/PMC9962060/)
- Kelliny C, et al. (2014). "Alteration of insulin sensitivity by sex hormones during the menstrual cycle." *Physiol Rev*, 94(3):793-834. [PMC4014963](https://pmc.ncbi.nlm.nih.gov/articles/PMC4014963/)

---

## 15. Sæsonvariation
**[IKKE IMPLEMENTERET — lav prioritet]**

Insulinbehovet varierer med årstiderne:

### Vinter
- **Højere HbA1c:** Et studie med T1D-unge viste 9.1% om vinteren vs. 7.7% om sommeren
- Mulige mekanismer: reduceret fysisk aktivitet, øget kalorieindtag, reduceret D-vitaminsyntese, kortere dage (cirkadisk påvirkning)

### Sommer
- **Lavere insulinbehov:** Øget fysisk aktivitet, varme accelererer insulinabsorption
- **Flere hypoer:** Kombination af øget insulinfølsomhed og hurtigere absorption
- Soleksponering og vitamin D kan have en modulerende effekt på insulinfølsomhed

Sæsonvariationen er svær at isolere fra adfærdsændringer (kost, aktivitet) og er sandsynligvis en kombination af fysiologiske og livsstilsfaktorer.

**Kilde:** Mianowska B, et al. (2011). "HbA1c levels in schoolchildren with type 1 diabetes are seasonally variable and dependent on weather conditions." *Diabetologia*, 54(4):749-756.

---

## 16. Sygdom og infektion
**[DELVIST IMPLEMENTERET — via kronisk stress]**

Infektion og feber øger insulinbehovet markant via flere mekanismer:

### 16.1 Cytokin-medieret insulinresistens

Infektion aktiverer immunsystemet, som frigiver pro-inflammatoriske cytokiner (TNF-α, IL-1, IL-6). Disse:
- Hæmmer insulinsignalering via interferon-JAK-STAT-pathway
- Reducerer GLUT4-translokation i muskler
- Øger hepatisk glukoneogenese

### 16.2 Kontraregulatoriske hormoner

Stress-responsen ved sygdom øger kortisol, adrenalin og væksthormon, som alle modvirker insulin (se afsnit 10).

### 16.3 Feber

Feber i sig selv øger metabolismen med ca. 10-13% per °C over 37°C, hvilket øger glukoseomsætningen. Men den dominerende effekt er insulinresistensen fra cytokiner og stresshormoner.

### Klinisk konsekvens

- Insulinbehovet kan stige 50-100% under akut sygdom
- "Sygedags-regler" for T1D: øg basal med 10-20%, mål BG hyppigere, mål ketoner
- Risiko for DKA stiger markant ved sygdom pga. kombinationen af øget insulinbehov og nedsat appetit/væskeindtag

**Kilder:**
- Dungan KM, et al. (2009). "Stress hyperglycaemia." *Lancet*, 373(9677):1798-1807.
- Holt RIG, et al. (2024). "Diabetes and infection: review of the epidemiology, mechanisms and principles of treatment." *Diabetologia*. [Springer](https://link.springer.com/article/10.1007/s00125-024-06102-x)

---

## 17. Søvn og søvnmangel
**[IMPLEMENTERET — natlige interventioner → kronisk stress → insulinresistens]**

Søvnmangel har dokumenterede effekter på glukosemetabolisme:

### 17.1 Insulin sensitivity

- Restriktion til 4-5.5 timers søvn reducerer insulinfølsomheden med 16-24%
- Allerede én nats dårlig søvn giver målbar øget perifer insulinresistens
- Den metaboliske fænotype ved søvnmangel ligner type 2 diabetes: reduceret muskel-glukoseoptag, øget hepatisk glukoseproduktion, utilstrækkelig insulinsekretion

### 17.2 Mekanismer

- Øget kortisol (især om aftenen — forstyrretet cirkadisk mønster)
- Øget sympatisk nervesystem-aktivitet
- Cirkadisk misalignment (skift i melatonin-timing)
- Inflammation (forhøjet CRP, IL-6)
- Ændret GLP-1-sekretion

### 17.3 Klinisk relevans for T1D

- Søvnmangel kan forklare uforklarlig morgenhyperglykæmi
- Skifteholdsarbejde er associeret med dårligere glykæmisk kontrol
- For optimal BG-kontrol anbefales > 7 timers søvn

### 17.4 Implementation i simulatoren

Natlige interventioner (22:00-07:00) modelleres som søvnforstyrrelse:
- Hver vågen-hændelse koster 1 times søvn (max 4 timer pr. nat)
- Hændelser inden for 30 min tæller som samme vågenhed
- Om morgenen (kl. 07) konverteres søvntab til kronisk stress:
  `chronicStress += lostSleepHours × 0.06`
- Ved max tab (4t): ~24% øget insulinresistens, aftager over ~12 timer
- Forstærker dawn-fænomenet (kronisk stress adderes til cirkadisk kortisol)

Kalibrering: Donga et al. 2010 viste ~21% reduktion i insulinfølsomhed ved
delvis søvnrestriktion hos T1D. Vores max-effekt på 24% ved 4t tabt søvn
matcher dette godt.

**Kilder:**
- Spiegel K, et al. (2005). "Sleep loss: a novel risk factor for insulin resistance and Type 2 diabetes." *J Appl Physiol*, 99(5):2008-2019. [APS](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00660.2005)
- Donga E, et al. (2010). "A single night of partial sleep deprivation induces insulin resistance in multiple metabolic pathways in healthy subjects." *J Clin Endocrinol Metab*, 95(6):2963-2968.
- Donga E, et al. (2010). "Partial Sleep Restriction Decreases Insulin Sensitivity in Type 1 Diabetes." *Diabetes Care*, 33(7):1573-1577. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2890361/)
- Zheng H, et al. (2017). "Poor Sleep Quality Is Associated with Dawn Phenomenon and Impaired Circadian Clock Gene Expression." *Int J Endocrinol*. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5352967/)
- Reutrakul S, et al. (2018). "Sleep influences on obesity, insulin resistance, and risk of type 2 diabetes." *Metabolism*, 84:56-66.
- Buxton OM, et al. (2010). "Sleep Restriction for 1 Week Reduces Insulin Sensitivity in Healthy Men." *Diabetes*, 59(9):2126-2133.

---

## 18. Alkohol
**[IKKE IMPLEMENTERET — planlagt]**

Alkohol har en kompleks og potentielt farlig effekt på blodsukkeret ved T1D:

### 18.1 Akut effekt: hæmmet glukoneogenese

Ethanolmetabolisme i leveren øger NADH/NAD+-ratioen, som:
- **Blokerer hepatisk glukoneogenese** fra laktat (den vigtigste præcursor)
- **Udtømmer leverglykogen** via øget glykogen-fosforylase-aktivitet
- Leveren prioriterer alkohol-metabolisme (som detoksifikation) over glukose-homøostase

Nettoresultat: **hypoglykæmi-risiko**, især i fastende tilstand eller efter motion.

### 18.2 Forsinket hypoglykæmi (6-12 timer)

Den mest klinisk farlige effekt: moderat alkoholforbrug om aftenen kan udløse hypoglykæmi næste morgen (kl. 07-11). Mekanisme:
- Hepatisk glykogendepot er delvist udtømt af ethanolmetabolisme
- Glukoneogenese er stadig hæmmet
- Kontraregulatorisk respons er svækket af alkohol

### 18.3 Fed vs. fastende tilstand

- **Med mad:** Moderat alkohol (1 g/kg) har begrænset effekt på BG
- **Uden mad:** Alkohol kan inducere dyb hypoglykæmi

### 18.4 Kronisk alkohol

Kronisk alkoholforbrug kan paradoksalt øge insulinresistens, hvilket fører til hyperglykæmi. Mekanismen er ikke fuldt klarlagt.

### 18.5 Klinisk relevans

Alkohol er en af de hyppigste årsager til svær hypoglykæmi hos unge voksne med T1D. Hypoglykæmi-symptomer kan forveksles med beruselse, hvilket forsinker behandling.

**Kilder:**
- Emanuele NV, et al. (2019). "Consequences of Alcohol Use in Diabetics." *Alcohol Health Res World*, 22(3):211-219. [PMC6761899](https://pmc.ncbi.nlm.nih.gov/articles/PMC6761899/)
- Kerr D, et al. (2007). "Impact of Alcohol on Glycemic Control and Insulin Action." *Biomolecules*, 5(4):2223-2245. [PMC4693236](https://pmc.ncbi.nlm.nih.gov/articles/PMC4693236/)
- Turner BC, et al. (2001). "The effect of evening alcohol consumption on next-morning glucose control in type 1 diabetes." *Diabetes Care*, 24(11):1888-1893. [ADA](https://diabetesjournals.org/care/article/24/11/1888/24724/)
- Ismail D, et al. (2006). "Modelling the effect of alcohol on blood glucose in type 1 diabetes." *Int J Med Inform*, 72(1-3):61-69. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1386505603000388)

---

## 19. Temperatur og klima
**[IKKE IMPLEMENTERET — lav prioritet]**

Omgivelsestemperatur påvirker insulinabsorption og BG-kontrol:

### 19.1 Varme

- **Øget insulinabsorption:** Sauna (85°C) øger insulin-forsvinden fra injektionsstedet med 110% og BG falder ≥ 3 mmol/L
- **Lokal opvarmning:** En hudvarmende enhed (40°C) reducerer tid til peak insulin fra 111 til 77 minutter
- **Vasodilatation:** Øget blodgennemstrømning i subkutant væv accelererer insulintransport til plasma

### 19.2 Kulde

- **Nedsat insulinabsorption:** Afkøling af injektionsstedet reducerer insulinkoncentrationen med over 40% og øger BG med ~3 mmol/L
- **Vasokonstriktion:** Reduceret blodflow bremser insulinabsorption

### 19.3 Insulinstabilitet

Insulin denatureres ved ekstreme temperaturer:
- < 2°C: Krystalstruktur ødelægges (irreversibelt)
- > 30°C: Accelereret degradering
- Direkte sollys: Hurtig denaturering

### 19.4 Klinisk relevans

- Sommerferie, strandbesøg: hurtigere insulinvirkning → hypo-risiko
- Vintersport: langsommere insulinvirkning → hyperglykæmi
- Opbevaring af insulin i varme/kulde → uvirksom insulin → DKA-risiko

**Kilder:**
- Berger M, et al. (1981). "A rise in ambient temperature augments insulin absorption in diabetic patients." *Metabolism*, 30(5):393-396. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/0026049581901220)
- Frier BM, et al. (2019). "Effect of Injection Site Cooling and Warming on Insulin Glargine Pharmacokinetics and Pharmacodynamics." *Diabetes Technol Ther*, 21(6):327-334. [PubMed](https://pubmed.ncbi.nlm.nih.gov/31067999/)
- Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275. [PMC7609903](https://pmc.ncbi.nlm.nih.gov/articles/PMC7609903/)
- Vimalavathini R, et al. (2021). "Thermal stability and storage of human insulin." *Indian J Med Res*, 154(6):849-857. [PMC8721649](https://pmc.ncbi.nlm.nih.gov/articles/PMC8721649/)

---

## 20. Ketonstofskifte og diabetisk ketoacidose (DKA)
**[IMPLEMENTERET — forenklet model]**

### 20.1 Normal ketogenese

I faste eller ved lav insulintilgængelighed skifter kroppen fra glukose til fedtsyrer som primær energikilde:

1. **Lipolyse:** Insulinmangel ophæver hæmningen af hormon-sensitiv lipase i fedtvæv → frie fedtsyrer (FFA) frigives
2. **Beta-oxidation:** FFA transporteres til leverens mitokondrier via carnitin-shuttle og oxideres
3. **Ketogenese:** Overskydende acetyl-CoA (fra beta-oxidation) konverteres til ketonstoffer: acetoacetat, beta-hydroxybutyrat (BHB) og aceton
4. **Ketonstoffer som brændstof:** Hjerne og muskler kan bruge BHB som energikilde

### 20.2 Patologisk ketoacidose (DKA)

Ved absolut insulinmangel (fx glemt insulin, pumpesvigt, ny-debut T1D):

1. Ukontrolleret lipolyse → massiv FFA-frigivelse
2. Hepatisk ketogenese overstiger perifer ketonforbrug
3. Ketonstoffer er syrer → metabolisk acidose (pH falder)
4. Osmotisk diurese (fra hyperglykæmi) → dehydrering
5. Elektrolytforstyrrelser (kalium, natrium) → hjerterytmeforstyrrelser
6. Uden behandling: koma og død

### 20.3 Kliniske grænseværdier

| Keton-niveau (BHB) | Kategori | Handling |
|---------------------|----------|----------|
| < 0.6 mmol/L | Normal | Ingen |
| 0.6-1.5 mmol/L | Let forhøjet | Drik vand, giv insulin, mål igen om 1-2 timer |
| 1.5-3.0 mmol/L | Risiko for DKA | Kontakt læge, giv insulin, drik rigeligt |
| > 3.0 mmol/L | DKA | Akut sygehusindlæggelse |

### 20.4 Modellering i simulatoren

Forenklet model baseret på insulintilgængelighed og BG:

```
Ketonstigning: 0.008 · bgFaktor mmol/min   (når IOB < tærskel OG BG > 12)
Ketonfald:     0.006 mmol/min               (når IOB > tærskel)
```

Denne model fanger det klinisk vigtigste (sammenhængen mellem insulinmangel og ketonstigning) men forenkler den fulde biokemi markant.

**Kilder:**
- Kitabchi AE, et al. (2009). "Hyperglycemic Crises in Adult Patients With Diabetes." *Diabetes Care*, 32(7):1335-1343.
- Dhatariya KK, et al. (2023). "Comprehensive review of diabetic ketoacidosis: an update." *Ann Med Surg*, 85(6):2802-2807. [PMC10289692](https://pmc.ncbi.nlm.nih.gov/articles/PMC10289692/)
- Laffel L. (1999). "Ketone bodies: a review of physiology, pathophysiology and application of monitoring to diabetes." *Diabetes Metab Res Rev*, 15(6):412-426. [Wiley](https://onlinelibrary.wiley.com/doi/full/10.1002/(SICI)1520-7560(199911/12)15:6%3C412::AID-DMRR72%3E3.0.CO;2-8)

---

## 21. CGM-teknologi (Continuous Glucose Monitoring)
**[IMPLEMENTERET — forsinkelse + støj + drift]**

### 21.1 Måleprincip

CGM-sensorer måler glukose i **interstitiel væske** (ISF) i det subkutane fedtvæv — ikke direkte i blodet. Glukose diffunderer fra kapillærer gennem interstitialrummet til sensoren, hvilket introducerer en tidsforsinkelse.

### 21.2 Tidsforsinkelse

- **Fysiologisk forsinkelse:** Gennemsnitlig tid for glukose at diffundere fra blod til ISF er 5-6 minutter i hvile
- **Total forsinkelse** (inkl. sensor-processing): 7-11 minutter afhængig af sensor-type og tilstand
- **Forsinkelsen er størst ved hurtige ændringer** — fx efter et måltid eller under motion kan den effektive forsinkelse være 10-15 minutter
- Konsekvens: CGM "hænger efter" virkeligheden, hvilket er kritisk ved hurtig BG-ændring

### 21.3 Nøjagtighed (MARD)

Mean Absolute Relative Difference (MARD) er standardmetrikken for CGM-nøjagtighed:
- Moderne CGM'er (Dexcom G7, Libre 3): MARD ~8-10%
- Ældre generation (Libre 1): MARD ~11-14%
- MARD forværres ved hurtige glukoseændringer og i hypoglykæmisk range

### 21.4 Støjkilder

- **Elektronisk støj:** Random variation fra sensor-elektronik (~±0.3 mmol/L)
- **Biologisk variation:** Lokal blodflow, tryk på sensor, hydreringsstatus
- **Drift:** Langsom systematisk afvigelse over sensorens levetid (typisk 7-14 dage)

### Modellering i simulatoren

```
dC/dt = (G - C) / τCGM           // førstordens forsinkelse
CGM_aflæsning = C + støj + drift  // tilføj realistisk støj
```

- τCGM ≈ 7 min (sensorforsinkelse)
- Støj: ±0.5 mmol/L (uniform random)
- Drift: sinusbølge med periode 4-8 timer, amplitude 0.3-0.7 mmol/L

**Kilder:**
- Schrangl P, et al. (2015). "Time Delay of CGM Sensors: Relevance, Causes, and Countermeasures." *J Diabetes Sci Technol*, 9(5):1006-1015. [PMC4667340](https://pmc.ncbi.nlm.nih.gov/articles/PMC4667340/)
- Sinha M, et al. (2017). "A Comparison of Time Delay in Three Continuous Glucose Monitors." *J Diabetes Sci Technol*, 11(5):1001-1007.
- Ajjan RA, et al. (2018). "Accuracy of flash glucose monitoring and continuous glucose monitoring technologies." *Diabet Vasc Dis Res*, 15(3):175-184. [SAGE](https://journals.sagepub.com/doi/full/10.1177/1479164118756240)

---

## 22. Stress (psykologisk)
**[DELVIST IMPLEMENTERET — via kronisk stress]**

Psykologisk stress (eksaminer, arbejdspres, angst) aktiverer det sympatiske nervesystem og HPA-aksen:

### Mekanisme

1. **Akut stress:** Adrenalin → hepatisk glykogenolyse → BG stiger hurtigt
2. **Kronisk stress:** Kortisol → øget glukoneogenese + reduceret insulinfølsomhed → vedvarende BG-stigning
3. **Adfærdsmæssig:** Stress ændrer spisemønstre, søvnkvalitet og motion — indirekte BG-effekter

### Individuel variation

Stressresponsens effekt på BG varierer markant mellem individer. Nogle T1D-patienter oplever primært hyperglykæmi, andre mærker minimal effekt, og et fåtal oplever hypoglykæmi (pga. ændret spisemønster).

**Kilde:** Surwit RS, et al. (2002). "Stress management improves long-term glycemic control in type 2 diabetes." *Diabetes Care*, 25(1):30-34.

---

## 23. Injektionssted
**[DELVIST IMPLEMENTERET — i vores kompartmentmodel]**

Insulinabsorptionshastigheden varierer med injektionssted pga. forskelle i subkutant blodflow og fedtvævstykkelse:

| Sted | Relativ absorptionshastighed | Forklaring |
|------|------------------------------|------------|
| Abdomen | 1.0× (reference) | Tyndest fedtlag, mest blodflow |
| Overarm | ~0.85× | Medium fedtlag |
| Lår | ~0.70× | Tykkest fedtlag, mindst blodflow |
| Glutealt | ~0.75× | Dybt subkutant depot |

Andre faktorer der påvirker absorption fra injektionsstedet:
- **Lipohypertrofi:** Gentagne injektioner i samme område → fedtknuder → uforudsigelig absorption
- **Motion i nærliggende muskelgruppe:** Løb øger absorption fra lår, armøvelser fra overarm
- **Massage af injektionsstedet:** Accelererer absorption markant

**Kilde:** Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275. [PMC7609903](https://pmc.ncbi.nlm.nih.gov/articles/PMC7609903/)

---

## Appendiks: Modeller brugt i forskning

### A. Hovorka 2004 (Cambridge-modellen)
- 11 ODE'er, klinisk valideret, 1000+ citationer
- Bruges i Diabetes-Dysten som kernemodel
- [Hovorka et al. 2004](http://www.stat.yale.edu/~jtc5/diabetes/NonlinearModelPredictiveControl_Hovorka_04.pdf)

### B. UVA/Padova (Dalla Man 2007/2014)
- FDA-godkendt som erstatning for dyreforsøg i insulinpumpe-trials
- Mere detaljeret end Hovorka (300+ parametre), inkl. inkretiner og glukagon
- [Dalla Man et al. 2007](https://ieeexplore.ieee.org/document/4303268)

### C. Bergman Minimal Model (1979)
- Den simpleste validerede model (4 parametre)
- Bruges primært til IVGTT-analyse, ikke til simulation
- [Bergman et al. 1979](https://journals.physiology.org/doi/abs/10.1152/ajpendo.1979.236.6.E667)

### D. Sorensen (1985)
- Den mest detaljerede multi-organ model (19 kompartmenter)
- Inkluderer lever, nyrer, periferi, hjerne, tarm separat
- For kompleks til real-time simulation
- [Sorensen JT, PhD Thesis, MIT 1985]

---

*Sidst opdateret: Marts 2026*
*Dette dokument udvides løbende. Bidrag og rettelser er velkomne.*
