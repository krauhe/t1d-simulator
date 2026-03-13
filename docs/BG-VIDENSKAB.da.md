<!-- translated-from: BG-SCIENCE.md doc-version: 2026-03-12-v2 -->
# Blodsukkerregulering ved Type 1 Diabetes -- En Komplet Vidensoversigt

*Denne guide gennemgår alle kendte faktorer der påvirker blodsukkeret hos personer med type 1 diabetes. Den er skrevet til patienter, pårørende og sundhedspersonale -- med videnskabelig dybde for dem der ønsker det.*

Dokumentet fungerer som en vidensbase for T1D Simulator, men dækker også emner der endnu ikke er implementeret i spillet. Tænk på det som et opslagsværk: du behøver ikke læse det fra ende til anden, men kan slå op i de emner der er relevante for dig.

**Hvad betyder statusmarkeringerne?**

- **Aktiv i simulatoren** -- denne faktor er modelleret og påvirker spillet
- **Delvist modelleret** -- en forenklet version er implementeret
- **Ikke implementeret** -- dokumenteret her som viden, men ikke (endnu) en del af spillet

---

## Indholdsfortegnelse

**Del 1: De grundlæggende processer**
1. [Hvordan glukose bevæger sig i kroppen](#1-hvordan-glukose-bevæger-sig-i-kroppen)
2. [Insulin -- fra injektion til virkning](#2-insulin--fra-injektion-til-virkning)
3. [Kulhydrater -- fra mund til blodsukker](#3-kulhydrater--fra-mund-til-blodsukker)
4. [Fedt og protein -- de glemte makronæringsstoffer](#4-fedt-og-protein--de-glemte-makronæringsstoffer)
5. [Leverens glukoseproduktion](#5-leverens-glukoseproduktion)
6. [Nyrernes rolle -- en naturlig sikkerhedsventil](#6-nyrernes-rolle--en-naturlig-sikkerhedsventil)
7. [Hjernens glukoseforbrug](#7-hjernens-glukoseforbrug)

**Del 2: Fysisk aktivitet**
8. [Aerob motion -- løb, cykling, svømning](#8-aerob-motion--løb-cykling-svømning)
9. [Anaerob træning -- styrketræning og sprint](#9-anaerob-træning--styrketræning-og-sprint)
10. [Motionsinduceret inflammation -- når motion gør ondt](#10-motionsinduceret-inflammation--når-motion-gør-ondt)
10b. [Afslapning, yoga og meditation](#10b-afslapning-yoga-og-meditation--stressreduktion-og-blodsukker)

**Del 3: Hormoner og døgnrytme**
11. [Kontraregulatoriske hormoner -- kroppens forsvar mod lavt blodsukker](#11-kontraregulatoriske-hormoner--kroppens-forsvar-mod-lavt-blodsukker)
12. [Dawn-fænomenet -- morgenens blodsukkerstigning](#12-dawn-fænomenet--morgenens-blodsukkerstigning)
13. [Somogyi-effekten -- rebound efter natlig hypoglykæmi](#13-somogyi-effekten--rebound-efter-natlig-hypoglykæmi)
14. [Døgnvariation i insulinfølsomhed](#14-døgnvariation-i-insulinfølsomhed)
15. [Menstruationscyklus og insulinbehov](#15-menstruationscyklus-og-insulinbehov)
16. [Sæsonvariation](#16-sæsonvariation)

**Del 4: Livsstil og ydre faktorer**
17. [Sygdom og infektion](#17-sygdom-og-infektion)
18. [Søvn og søvnmangel](#18-søvn-og-søvnmangel)
19. [Alkohol](#19-alkohol)
20. [Psykologisk stress](#20-psykologisk-stress)
21. [Temperatur og klima](#21-temperatur-og-klima)
22. [Injektionssted](#22-injektionssted)

**Del 5: Komplikationer og faresignaler**
23. [Ketonstoffer og diabetisk ketoacidose](#23-ketonstoffer-og-diabetisk-ketoacidose)
24. [Insulinoverdosis og kontrareguleringens begrænsninger](#24-insulinoverdosis-og-kontrareguleringens-begrænsninger)
25. [Ikke-linearitet i insulinvirkning -- tærskeleffekter](#25-ikke-linearitet-i-insulinvirkning--tærskeleffekter)

**Del 6: Teknologi og forskningsmodeller**
26. [CGM-teknologi -- kontinuerlig glukosemåling](#26-cgm-teknologi--kontinuerlig-glukosemåling)
27. [Matematiske modeller brugt i forskningen](#27-matematiske-modeller-brugt-i-forskningen)

---

# Del 1: De grundlæggende processer

Disse processer er fundamentet for al blodsukkerstyring. De kører hele tiden i kroppen og danner grundlaget for alt det der følger i resten af dokumentet.

---

## 1. Hvordan glukose bevæger sig i kroppen

**Aktiv i simulatoren (Hovorka 2004-modellen)**

Glukose -- det sukker kroppen bruger som brændstof -- befinder sig ikke bare et sted i kroppen. Det fordeles mellem to "rum":

**Blodet (plasmaglukose):** Det er her vi måler blodsukkeret, og det er herfra hjernen, musklerne og alle organer henter deres energi. Når du tager en blodsukkermåling, er det glukosekoncentrationen i dette rum du ser.

**Kroppens væv (muskler, fedtvæv m.m.):** Glukose bevæger sig lidt langsommere hertil fra blodet. Det sker dels ved simpel diffusion, dels ved insulinstyret transport. Man kan tænke på det som en buffer -- når blodsukkeret stiger, trækker vævene glukose til sig, og når det falder, afgiver de det igen.

Udvekslingen mellem de to rum bestemmer hvor hurtigt blodsukkeret ændrer sig efter et måltid eller en insulindosis. Glukosekoncentrationen i blodet beregnes ud fra mængden af glukose og kroppens størrelse (distributionsvolumen er ca. 0.16 liter per kilo kropsvægt).

I simulatoren er dette modelleret med Hovorkas tokammer-model, der beskriver strømmen af glukose mellem blod og væv med matematiske ligninger. Det er denne model der "kender" dit blodsukker i spillet.

> **Kilde:** Hovorka R, Canonico V, Chassin LJ, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

---

## 2. Insulin -- fra injektion til virkning

**Aktiv i simulatoren (Hovorka 2004 subkutan model)**

Når du injicerer insulin, sker der ikke noget med det samme. Insulinet skal først rejse fra det subkutane fedtvæv (der hvor nålen sætter det) og ind i blodet, og derefter fra blodet ud til de celler der skal bruge det. Hele denne proces tager tid -- og det er derfor timing er så vigtigt ved type 1 diabetes.

### Fra injektion til blodet

Insulinet injiceres under huden, hvor det danner et lille depot. Herfra absorberes det gradvist ind i blodbanen. For hurtigvirkende insulin som NovoRapid når absorptionen sit højdepunkt efter ca. 110 minutter (knap 2 timer). Det er derfor man anbefaler at give bolus 15-20 minutter før et måltid -- så insulinet er "klar" når glukosen fra maden begynder at ramme blodet.

### Fra blodet til virkning

Selv når insulinet er i blodet, virker det ikke med det samme. Det skal først binde sig til receptorer på cellerne og sætte en kæde af signaler i gang. Denne forsinkelse er modelleret med tre parallelle "effektkanaler":

1. **Glukosetransport** -- insulin hjælper glukose med at komme fra blodet ind i musklerne
2. **Glukoseforbrug** -- insulin øger musklernes forbrænding af glukose
3. **Leverens glukoseproduktion** -- insulin bremser leverens frigivelse af glukose

De tre kanaler har lidt forskellige hastigheder, og tilsammen giver de den brede, gradvise insulinvirkning vi kender klinisk.

### Insulintyper

Forskellige insulinpræparater har vidt forskellige profiler:

| Type | Kategori | Virker efter | Højdepunkt | Varighed |
|------|----------|-------------|------------|----------|
| NovoRapid (aspart) | Hurtigvirkende | 10-20 min | 1-2 timer | 3-5 timer |
| Humalog (lispro) | Hurtigvirkende | 10-15 min | 1-2 timer | 3-4 timer |
| Fiasp (faster aspart) | Ultrahurtig | 2-5 min | 1-1.5 timer | 3-4 timer |
| Lantus (glargin) | Langvirkende | 1-2 timer | Næsten flad | ca. 24 timer |
| Tresiba (degludec) | Ultralangvirkende | 1-2 timer | Næsten flad | over 42 timer |

Jo hurtigere insulinet virker, jo nemmere er det at matche et måltid -- men også jo nemmere er det at lave fejl. Langvirkende insulin dækker kroppens basale behov og skal helst give en jævn baggrundsdækning.

> **Kilder:**
> - Hovorka et al. (2004), se ovenfor.
> - Heise T, et al. (2015). "Pharmacokinetic and pharmacodynamic properties of faster-acting insulin aspart versus insulin aspart across a clinically relevant dose range." *Clinical Pharmacokinetics*, 56(6):649-660.

---

## 3. Kulhydrater -- fra mund til blodsukker

**Aktiv i simulatoren (Hovorka 2004 tarmmodel)**

Når du spiser kulhydrater, gennemgår de en rejse før de påvirker blodsukkeret:

1. **Tygning og mavesæk:** Maden nedbrydes mekanisk og enzymatisk. Mavesækken slipper maden ud i tyndtarmen med en hastighed på 1-4 kcal per minut. Denne mavetømningshastighed er faktisk den faktor der oftest begrænsende for, hvor hurtigt blodsukkeret stiger.

2. **Tyndtarmen:** Her absorberes glukosen og transporteres via blodet til leveren, og derfra ud i resten af kroppen.

Ikke al kulhydrat bliver til glukose i blodet. Ca. 80% absorberes (resten passerer videre eller forbruges af tarmens egne celler). For hurtige kulhydrater som hvidt brød eller juice når glukosen blodet efter ca. 20-30 minutter. For langsomme kulhydrater som fuldkorn eller bælgfrugter kan det tage 60-90 minutter.

### Glykæmisk indeks -- hvad det egentlig handler om

Glykæmisk indeks (GI) er i bund og grund et mål for, hvor hurtigt maden tømmes fra mavesækken og fordøjes. Fødevarer med lavt GI (fuldkorn, bælgfrugter) giver et lavere og bredere blodsukker-peak. Fødevarer med højt GI (hvidt brød, juice) giver et højt, spidst peak. For T1D-patienter betyder det, at insulintimingen skal tilpasses madens type -- ikke kun mængden af kulhydrat.

> **Kilder:**
> - Hovorka et al. (2004), se afsnit 1.
> - Haidar A, et al. (2014). "Mathematical Model of Glucose-Insulin Metabolism in Type 1 Diabetes Including Digestion and Absorption of Carbohydrates." *SICE Journal of Control, Measurement, and System Integration*, 7(6):314-325.
> - Bornhorst GM, et al. (2016). "A mechanistic model of intermittent gastric emptying and glucose-insulin dynamics following a meal containing milk components." *PLOS ONE*, 11(6):e0156443.

---

## 4. Fedt og protein -- de glemte makronæringsstoffer

**Delvist modelleret**

De fleste nydiagnosticerede lærer at tælle kulhydrater -- men fedt og protein påvirker også blodsukkeret. Det ved mange ikke, og det kan føre til uforklarlige blodsukkerstigninger timer efter et måltid.

### Fedt forsinker mavetømningen

Fedt i et måltid bremser mavetømningen markant. Mekanismen er, at fedtet udløser hormoner fra tyndtarmen (GLP-1, GIP og cholecystokinin) som signalerer til mavesækken om at bremse. Resultatet er, at kulhydraterne fra det samme måltid absorberes langsommere -- blodsukkeret stiger senere, men også over længere tid. Et fedtholdigt måltid (fx pizza) kan derfor give et blodsukker-peak 3-4 timer efter spisning, hvor et fedtfattigt måltid med samme kulhydratmængde ville peake efter 1-2 timer.

### Protein bidrager til glukose

Ca. 50-60% af aminosyrerne i protein er "glukogene" -- de kan omdannes til glukose i leveren via glukoneogenese. Men den faktiske konvertering er langt mindre end det teoretiske maksimum, og den primære mekanisme hvormed protein hæver BG ved T1D er ikke glukoneogenese, men derimod umodvirket glukagonsekretion.

#### "Bernstein 25%-reglen" -- hvad viser forskningen?

Dr. Richard Bernstein populariserede påstanden om at ca. 36% af indtaget protein konverteres til glukose (nogle gange citeret som ~25%). Den teoretiske biokemi understøtter at 50-80 g glukose *kan* udvindes af 100 g protein. Men isotopspor-studier viser at den faktiske konvertering er dramatisk lavere:

| Studie | Protein indtaget | Glukose fra protein | Konverteringsrate |
|--------|-----------------|---------------------|-------------------|
| Fromentin et al. 2013 | 23 g æggeprotein | 3,9 g over 8 t | ~17% |
| Nuttall & Gannon 2001 | 50 g hytteost (raske) | 9,7 g over 8 t | ~19% |
| Nuttall & Gannon 2001 | 50 g oksekød (T2D) | 2,0 g over 8 t | ~4% |

Fromentin et al. (2013) brugte dobbeltmærket (^15N, ^13C) æggeprotein med isotopfortynding og fandt at kun 3,9 +/- 0,7 g glukose ud af 50,4 +/- 7,7 g total glukoseproduktion stammede fra aminosyrer -- kun 8% af den totale glukoseproduktion, med peak-bidrag på 12,1% ved 4,5 timer. De resterende aminosyre-kulstofatomer blev oxideret direkte som brændstof (CO2), ikke konverteret til glukose.

**Konklusion:** Bernsteins 25%-regel overvurderer glukoneogenese fra protein med 2-6 gange. Den faktiske glukoseproduktion fra protein er beskeden (~4-10 g fra en 50 g proteinmængde). Den BG-hævende effekt af protein ved T1D drives primært af glukagon, ikke glukoneogenese.

#### Hvorfor protein hæver BG ved T1D men ikke hos raske

Den afgørende mekanisme er **umodvirket glukagonsekretion**:

1. Aminosyrer fra fordøjet protein stimulerer alfa-cellernes glukagonsekretion (glutamin, arginin og alanin kan øge glukagon op til 10 gange ved fysiologiske koncentrationer)
2. Hos raske stimulerer de samme aminosyrer også beta-cellernes insulinsekretion, som (a) undertrykker glukagon og (b) modvirker leverens glukoseproduktion. Nettoeffekt på BG: minimal.
3. Ved T1D er der ingen endogen insulinrespons. Glukagon virker umodvirket og driver leverens glukoseproduktion (både glykogenolyse og glukoneogenese) uden modvægt fra insulin.

Det er derfor protein kan hæve BG markant ved T1D mens det har lille eller ingen effekt hos ikke-diabetikere. Effekten er fundamentalt et *hormonelt* problem (glukagon/insulin-ubalance), ikke primært et *substrat*-problem (aminosyrer der konverteres til glukose).

#### Tidsforløb for proteins effekt på BG

Proteins glykæmiske effekt er markant langsommere og mere langvarig end kulhydraters:

| Parameter | Kulhydrat (20 g glukose) | Protein (75-100 g whey, alene) |
|-----------|---------------------------|-------------------------------|
| Onset | ~15 min | ~90-100 min |
| Peak | ~60 min | ~180 min |
| Varighed | ~2-3 t | > 5 t (stadig forhøjet ved 300 min) |
| Form | Skarp spids | Langsom, vedvarende stigning |

Vigtige tidsdata fra Paterson et al. (2016): BG faldt faktisk *initialt* fra 0-90 min (sandsynligvis pga. GLP-1/GIP inkretiner der forsinker mavetømning og moderat stimulerer resterende beta-celler), og begyndte først at stige efter ~100 min, med stigningen fortsættende gennem hele den 300-minutters studieperiode.

#### Dosis-respons: hvor meget protein påvirker BG?

**Protein alene (ingen kulhydrat, ingen insulin)** -- Paterson et al. 2016 (T1D, whey-isolat):

| Proteindosis | BG-effekt 60-120 min | BG-effekt 180-240 min | BG-effekt 240-300 min | Signifikant? |
|-------------|---------------------|----------------------|----------------------|-------------|
| 12,5 g | 0,00 mmol/L | +0,21 mmol/L | +0,43 mmol/L | Nej |
| 25 g | -1,06 mmol/L | -1,38 mmol/L | -1,70 mmol/L | Ja (lavere) |
| 50 g | -0,26 mmol/L | +0,28 mmol/L | +0,50 mmol/L | Nej |
| 75 g | -1,10 mmol/L | +0,71 mmol/L | +1,65 mmol/L | Ja (højere) |
| 100 g | -1,22 mmol/L | +1,06 mmol/L | +1,72 mmol/L | Ja (højere) |

Afgørende fund: responsen er **ikke lineær**. Den ser ud til at have en **tærskeleffekt**: doser under ~75 g havde ingen signifikant BG-hævende effekt alene, mens >= 75 g producerede en klar, forsinket, vedvarende stigning. 25 g-dosen sænkede faktisk BG, muligvis via inkretineffekter.

**Protein i blandede måltider (med kulhydrat)** -- tærsklen er meget lavere:

I kulhydratholdige måltider påvirkede så lidt som 12,5 g ekstra protein det postprandielle blodsukker (Paterson 2019 systematisk review). Det skyldes at kulhydratet allerede giver den glukoneogene substrat-kontekst, og glukagonet fra protein lægges oven i.

#### Protein + fedt: effekten er additiv

Smart et al. (2013) demonstrerede additivitet med præcise tal hos børn med T1D (samme kulhydrat i alle måltider):

| Måltidstype | BG-stigning ved 180 min | Tid til peak BG | BG-stigning ved 300 min |
|-------------|------------------------|-----------------|------------------------|
| Lav fedt + Lavt protein (baseline) | +0,5 mmol/L | 79 min | baseline |
| Lav fedt + Højt protein (40 g) | +2,4 mmol/L | 96 min | forhøjet |
| Høj fedt (35 g) + Lavt protein | +1,8 mmol/L | 126 min | forhøjet |
| Høj fedt + Højt protein | +4,2 mmol/L | 143 min | +5,4 mmol/L vs baseline |

HF/HP-stigningen (4,2 mmol/L) er lig summen af HF alene (1,8) + HP alene (2,4) -- bekræfter ren additivitet uden interaktion (P > 0,05 for interaktionsleddet). Dette forlængede også tid til peak fra 79 min (baseline) til 143 min (HF/HP).

Bemærkelsesværdigt reducerede proteinrige måltider hypoglykæmirisikoen (OR 0,16, P < 0,001) -- sandsynligvis fordi glukagonresponsen forhindrer tidlige postprandielle lavninger.

#### Påvirker insulin-on-board om protein hæver BG?

Et kritisk spørgsmål med begrænset direkte evidens, men det mekanistiske svar er klart:

- Ved T1D er protein -> glukagon -> leverens glukoseproduktion kun problematisk fordi der **ingen matchende endogen insulinrespons** er til at modvirke den
- Når eksogen insulin er tilstrækkelig (høj IOB), undertrykker den leverens glukoseproduktion og øger perifer glukoseoptagelse, hvilket potentielt ophæver den glukagondrevne glukosestigning
- Når eksogen insulin er lav (lav IOB, fx timer efter sidste bolus), virker glukagon umodvirket

Paterson 2016-studiet gav protein **uden insulin** -- en ekstrem "nul IOB"-betingelse -- hvilket sandsynligvis maksimerede den glykæmiske effekt. I klinisk praksis ville et proteinrigt måltid indtaget kort efter en kulhydrat-dækkende bolus (når IOB er høj) sandsynligvis vise en mindre proteineffekt.

#### Proteintype har betydning: absorptionshastighed påvirker glukagonrespons

Dao et al. (2025) viste at postprandiel glykæmi varierede næsten 2-fold på tværs af proteinkilder ved T1D:

| Proteinkilde | Glukose iAUC (mmol-min/L) | Relativ effekt |
|-------------|--------------------------|----------------|
| Kylling | 203 +/- 66 | Lavest |
| Æg | 263 +/- 100 | Lav |
| Oksekød | 309 +/- 89 | Medium |
| Laks | 338 +/- 83 | Medium-høj |
| Whey | 397 +/- 115 | Højest |

Hurtigt absorberbare proteiner (whey) forårsager en større, tidligere glukagonspids end langsomt absorberbare proteiner (kylling, casein). Dette er klinisk relevant: en whey-proteinshake vil have en hurtigere, større BG-påvirkning end et kyllingebryst med samme proteinindhold.

#### Kliniske insulindoseringsanbefalinger for protein

Der er endnu ingen konsensusalgoritme (ADA 2026-retningslinjer), men flere evidensbaserede tilgange findes:

**1. Fat-Protein Unit (FPU) metoden (Pankowska):**
- 1 FPU = 100 kcal fra fedt + protein = 10 g kulhydratækvivalent i insulinbehov
- Eksempel: 26 g protein + 22 g fedt = 302 kcal = 3 FPU = 30 g kulhydratækvivalent
- Leveres som forlænget/dual-wave bolus over 3-8 timer
- **Advarsel:** øger hypoglykæmirisiko ved normalt store måltider (~33% hypofrekvens)

**2. Procenttillægsmetoden (Bell et al. / ISPAD 2022):**
- For måltider med > 40 g fedt OG > 25 g protein: øg kulhydratberegnet dosis med 25-35%
- Split: 50% upfront, 50% forlænget over 2-2,5 timer
- ISPAD 2022 foreslår at starte med 20% ekstra for fedt-/proteinrige måltider

**3. New Zealand-metoden (til lavkulhydratdiæter <= 100 g KH/dag):**
- Brug ICR x 2 til protein (fx hvis ICR = 1:10 for kulhydrat, brug 1:20 for protein)
- Eksempel: 60 g protein / 20 = 3 enheder

**4. Timing-baseret tilgang (Campbell):**
- Giv IKKE ekstra insulin ved måltidsstart (60% oplevede hypoglykæmi)
- Giv 30% ekstra insulin 3 timer efter måltidet (0% hypoglykæmi)

**5. Kvantitativt estimat fra kliniske data:**
- Totalt måltidsinsulin steg med ~0,12 enheder per gram protein i blandede måltider
- Ca. 1 enhed korrektionsinsulin per 8 g protein i et kulhydratholdigt måltid
- Bell et al.: fedt-/proteinrige måltider krævede 65% mere insulin (spredning 17-124%)

**Klinisk hovedkonklusion:** Proteininsulin bør leveres *sent* (forlænget bolus eller forsinket injektion), ikke upfront, for at matche det 2-5 timers tidsforløb for proteins glykæmiske effekt.

#### Oversigtstabel: proteins glykæmiske effekt ved T1D

| Spørgsmål | Svar |
|-----------|------|
| Hæver protein BG ved T1D? | Ja, signifikant og konsistent |
| Primær mekanisme | Umodvirket glukagonsekretion (ikke glukoneogenese) |
| Faktisk glukose fra glukoneogenese | ~4-10 g per 50 g protein (8-19% konvertering, ikke 25-36%) |
| Onset | ~90-100 min (vs ~15 min for kulhydrat) |
| Peak | ~3 timer (vs ~1 time for kulhydrat) |
| Varighed | > 5 timer |
| Tærskel (protein alene) | >= 75 g for signifikant effekt |
| Tærskel (med kulhydrat) | >= 12,5 g for signifikant effekt |
| Dosis-respons | Non-lineær, tærskel-lignende (ikke proportional) |
| Protein + fedt | Additive effekter |
| Ekstra insulin nødvendigt | ~20-35% mere for proteinrige måltider, leveret forlænget |
| Effekt af proteintype | Whey (hurtig) > oksekød > æg > kylling (langsom) |

> **Kilder:**
> - Paterson MA, Smart CEM, Lopez PE, et al. (2016). "Influence of dietary protein on postprandial blood glucose levels in individuals with Type 1 diabetes mellitus using intensive insulin therapy." *Diabetic Medicine*, 33(5):592-598.
> - Paterson MA, King BR, Smart CEM, et al. (2019). "Impact of dietary protein on postprandial glycaemic control and insulin requirements in Type 1 diabetes: a systematic review." *Diabetic Medicine*, 36(12):1585-1599.
> - Smart CEM, Evans M, O'Connell SM, et al. (2013). "Both dietary protein and fat increase postprandial glucose excursions in children with type 1 diabetes, and the effect is additive." *Diabetes Care*, 36(12):3897-3902.
> - Gannon MC, Nuttall FQ. (2013). "Dietary protein and the blood glucose concentration." *Diabetes*, 62(5):1371-1372.
> - Fromentin C, Tome D, Nau F, et al. (2013). "Dietary proteins contribute little to glucose production, even under optimal gluconeogenic conditions in healthy humans." *Diabetes*, 62(5):1435-1442.
> - Bell KJ, Smart CEM, Steil GM, et al. (2015). "Impact of fat, protein, and glycemic index on postprandial glucose control in type 1 diabetes: implications for intensive diabetes management in the continuous glucose monitoring era." *Diabetes Care*, 38(6):1008-1015.
> - Bell KJ, Barclay AW, Petocz P, et al. (2020). "Factors beyond carbohydrate to consider when determining mealtime insulin doses: protein, fat, timing, and technology." *Diabetes Technology & Therapeutics*, 22(4):286-297.
> - Dao L, Kowalski GM, Bruce CR, et al. (2025). "The glycemic impact of protein ingestion in people with type 1 diabetes." *Diabetes Care*, 48(4):509-520.
> - Pankowska E, Blazik M, Groele L. (2012). "Does the fat-protein meal increase postprandial glucose level in type 1 diabetes patients on insulin pump?" *Diabetes Technology & Therapeutics*, 14(1):16-22.
> - Bisgaard Bengtsen M, Moller N. (2021). "Mini-review: Glucagon responses in type 1 diabetes -- a matter of complexity." *Physiological Reports*, 9(16):e15009.
> - Campbell MD, Walker M, King D, et al. (2016). "Carbohydrate counting at meal time followed by a small secondary bolus may be an effective strategy for managing postprandial hyperglycaemia following a high-fat meal in type 1 diabetes." *Diabetic Medicine*, 33(Suppl 1).

---

## 5. Leverens glukoseproduktion

**Aktiv i simulatoren (Hovorka 2004 + stresshormoner)**

Leveren er kroppens "glukosefabrik." Selv når du ikke spiser, holder leveren blodsukkeret oppe ved konstant at frigive glukose til blodet. Den gør det på to måder:

**Glykogenolyse (nedbrydning af glykogenlagre):** Leveren lagrer ca. 80-100 gram glukose som glykogen -- en slags stivelse-lignende lager. Denne reserve kan mobiliseres hurtigt (på minutter) og er kroppens første forsvar mod lavt blodsukker.

**Glukoneogenese (nydannelse af glukose):** Leveren kan også bygge glukose fra bunden, ud fra laktat, aminosyrer og glycerol. Denne proces er langsommere men har praktisk talt ubegrænset kapacitet, så længe der er råvarestoffer.

Til daglig producerer leveren ca. 160 mg glukose per minut for en person på 70 kg. Det er nok til at holde blodsukkeret stabilt mellem maltiderne.

### Insulin bremser leveren

Insulin er leverens vigtigste signal om at bremse glukoseproduktionen. Ved normale basale insulinniveauer producerer leveren ca. 40-60% af sin maksimale kapacitet. Når du giver en bolus og insulinniveauet stiger, undertrykkes leverens produktion næsten fuldstændigt. Det er en af de tre måder insulin sænker blodsukkeret på.

### Stresshormoner speeder leveren op

Kontraregulatoriske hormoner (adrenalin, glukagon, kortisol -- se afsnit 11) gør det modsatte af insulin: de får leveren til at producere mere glukose. Det er kroppens forsvarsmekanisme mod lavt blodsukker, men det er også grunden til at stress, sygdom og morgenens dawn-fænomen kan drive blodsukkeret op.

> **Kilde:** Hovorka et al. (2004). Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *Journal of Clinical Investigation*, 64(1):62-71.

---

## 6. Nyrernes rolle -- en naturlig sikkerhedsventil

**Aktiv i simulatoren (Hovorka 2004)**

Nyrerne filtrerer blodet konstant, og normalt genoptager de al glukosen -- intet går tabt i urinen. Men der er en grænse. Når blodsukkeret overstiger den såkaldte "renale tærskel" (ca. 9 mmol/L, men varierer fra 6-14 mmol/L mellem personer), kan nyrernes transportere ikke følge med, og glukose begynder at sive ud i urinen.

Det er en naturlig "sikkerhedsventil" der sætter et loft på, hvor højt blodsukkeret kan stige. Men den har en pris: glukosen trækker vand med sig ud i urinen (osmotisk diurese), hvilket fører til:

- Hyppig vandladning
- Tørst
- Dehydrering

Disse er de klassiske symptomer på ubehandlet eller dårligt reguleret diabetes. Når blodsukkeret er vedvarende højt, taber kroppen bogstaveligt talt energi og vand med urinen.

> **Kilder:**
> - Hovorka et al. (2004).
> - Johansen OE, et al. (1984). "Variations in renal threshold for glucose in Type 1 diabetes mellitus." *Diabetologia*, 26(3):180-183.
> - NCBI StatPearls. "Physiology, Glycosuria."

---

## 7. Hjernens glukoseforbrug

**Aktiv i simulatoren (Hovorka 2004)**

Hjernen er kroppens største glukoseforbruger i hvile -- den bruger ca. 120 gram glukose om dagen (ca. 5 gram i timen), selv om den kun udgør 2% af kropsvægten. Det vigtige er, at hjernens glukoseoptag er næsten uafhængigt af insulin. Hjernen har sine egne transportere (GLUT1 og GLUT3) der henter glukose direkte fra blodet.

Men når blodsukkeret falder, falder hjernens glukoseforsyning også. Hjernens transportere mættes ved lave koncentrationer, og ved svær hypoglykæmi (under ca. 2.5 mmol/L) kan hjernen ikke opretholde normal funktion. Det er derfor hypoglykæmi giver symptomer som:

- Koncentrationsbesvær og forvirring
- Synsforstyrrelser
- Kramper
- Bevidsthedstab

Og i yderste konsekvens: død. Hjernens totale afhængighed af glukose er den fundamentale grund til, at lavt blodsukker er akut farligt.

> **Kilde:** Hovorka et al. (2004). Magistretti PJ, Allaman I. (2015). "A cellular perspective on brain energy metabolism and functional imaging." *Neuron*, 86(4):883-901.

---

# Del 2: Fysisk aktivitet

Motion er en af de mest komplicerede faktorer at håndtere for T1D-patienter, fordi den påvirker blodsukkeret på mange måder samtidig -- og fordi aerob og anaerob motion har helt modsatte akutte effekter.

---

## 8. Aerob motion -- løb, cykling, svømning

**Aktiv i simulatoren (Resalat 2020 udvidet Hovorka-model)**

Aerob motion er den type motion de fleste tænker på: løb, cykling, svømning, rask gang. Den samlede effekt er, at blodsukkeret falder -- men mekanismerne bag er overraskende komplekse.

### Musklerne henter glukose uden insulin

Når muskler arbejder, aktiverer de en signalvej (AMPK) der transporterer glukose ind i muskelcellerne helt uden insulins hjælp. Det sker via GLUT4-transportere der flyttes til cellens overflade af selve muskelkontraktionen. Det er derfor motion kan sænke blodsukkeret selv når der næsten ikke er insulin i kroppen -- og det er også derfor motion er så effektivt.

Denne effekt starter hurtigt (inden for minutter) og stopper relativt hurtigt efter motion ophører (tidskonstant ca. 20 minutter).

### Insulinfølsomheden forbedres -- i timevis

Ud over det direkte glukoseoptag forbedrer motion også insulins effekt. Musklerne bliver mere følsomme over for den insulin der allerede er i blodet. Denne effekt bygger sig langsomt op og varer i timer efter træning er slut (tidskonstant ca. 200 minutter).

Det er denne langvarige effekt der forklarer, hvorfor mange T1D-patienter oplever lavt blodsukker 4-12 timer efter motion -- ikke kun under selve træningen.

### Insulinet absorberes hurtigere

Øget blodgennemstrømning og højere temperatur i underhuden under motion får insulin til at absorberes hurtigere fra injektionsstedet. Ved en puls på 120 slag i minuttet øges absorptionshastigheden med ca. 50% sammenlignet med hvile. Det kan betyde, at insulin du har givet for 2 timer siden pludselig "sparker ind" meget kraftigere under motion.

### Forsinket hypoglykæmi -- den skjulte fare

Den forstærkede insulinfølsomhed efter motion varer 2-12 timer. Det betyder, at et træningstapas om eftermiddagen eller aftenen kan give hypoglykæmi midt om natten -- når du sover og ikke mærker det. Det er en af de vigtigste ting for T1D-patienter at forstå og planlægge efter.

> **Kilder:**
> - Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030.
> - Kudva YC, et al. (2021). "Exercise effect on insulin-dependent and insulin-independent glucose utilization." *Am J Physiol Endocrinol Metab*, 321(2):E230-E237.
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes: a consensus statement." *Lancet Diabetes Endocrinol*, 5(5):377-390.

---

## 9. Anaerob træning -- styrketræning og sprint

**Delvist modelleret (via akut stress)**

Styrketræning, sprint og HIIT (højintensitetstræning) har en helt anden akut effekt på blodsukkeret end aerob motion. Mange T1D-patienter bliver overraskede over, at blodsukkeret stiger under styrketræning.

### Blodsukkeret stiger akut

Intensiv anaerob aktivitet udløser en kraftig stressrespons i kroppen. Adrenalin og noradrenalin frigives massivt, og de får leveren til at dumpe store mængder glukose i blodet (via glykogenolyse). Samtidig bremser katekolaminerne musklernes glukoseoptag. Nettoresultatet er, at leverens glukoseproduktion overstiger musklernes forbrug, og blodsukkeret stiger -- typisk med 2-5 mmol/L.

### Blodsukkeret falder timer senere

2-6 timer efter styrketræning vender billedet: musklerne skal genopfylde deres glykogenlagre (de "tanker op"), insulinfølsomheden stiger, og katekolamineffekten er aftaget. Blodsukkeret falder, og risikoen for hypoglykæmi øges.

### Hvad det betyder i praksis

Det forvirrende mønster -- stigning under træning, fald timer efter -- får mange til at reagere forkert. Hvis du giver korrektionsinsulin under styrketræning fordi blodsukkeret er højt, risikerer du hypoglykæmi nogen timer senere, når den forsinkede effekt sætter ind. Den generelle anbefaling er at vente med korrektion til efter træning og holde øje med blodsukkeret de følgende timer.

> **Kilder:**
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes." *Lancet Diabetes Endocrinol*, 5(5):377-390.
> - Yardley JE, et al. (2013). "Resistance versus aerobic exercise: acute effects on glycemia in type 1 diabetes." *Diabetes Care*, 36(3):537-542.

### Laktat og Cori-cyklus -- en ekstra BG-stigning

Under anaerob træning producerer musklerne store mængder **laktat (mælkesyre)** som biprodukt af glykolyse uden ilt. Laktaten transporteres via blodet til leveren, hvor den omdannes til glukose via **Cori-cyklus** (glukoneogenese fra laktat). Denne nyproducerede glukose frigives til blodet og bidrager til den akutte BG-stigning under styrketræning.

HIIT-data (Bally et al. 2015, Rempel et al. 2018) viser:
- BG steg i **97% af HIIT-sessioner** hos T1D-patienter (gennemsnit +3.7 mmol/L)
- Stigningen i plasma-laktat korrelerer med BG-stigningen
- Høj reproducerbarhed inden for individer (din krop reagerer ens hver gang)

**Status i simulatoren:** Laktat/Cori-cyklus er ikke eksplicit modelleret som separat proces. Effekten fanges indirekte via den akutte stress-respons (katekolaminer → øget hepatisk glukoseproduktion). En fremtidig udvidelse kunne modellere laktat som separat state-variabel med omsætning i leveren.

> **Ekstra kilder:**
> - Bally L, et al. (2015). "Effects of HIIT vs moderate continuous exercise on glucose homeostasis and hormone response in T1DM." *PLOS ONE*, 10(8):e0136489.
> - Rempel M, et al. (2018). "Reproducibility in the cardiometabolic responses to HIIT in adults with T1D." *Diabetes Metab Res Rev*, 35(4):e3134.

---

## 10. Motionsinduceret inflammation -- når motion gør ondt

**Ikke implementeret**

De fleste forbinder motion med bedre insulinfølsomhed -- og det er også hovedreglen. Men der er en vigtig undtagelse: overdreven eller uvant motion kan midlertidigt øge insulinbehovet i stedet for at reducere det.

### Mekanismen

Intense eller langvarige træningstapas (maraton, uvant styrketræning, overtraining) forårsager mikroskopisk muskelskade. Kroppen sender reparationshold i form af betændelsesceller og signalstoffer:

1. Proinflammatoriske cytokiner (IL-6, TNF-alfa, IL-1-beta) frigives -- IL-6 kan stige op til 100 gange over normalniveau under motion
2. Leveren starter en akutfaserespons
3. Cytokinerne hæmmer insulins signalveje i musklerne
4. Effekten kan vare 24-72 timer

### Paradokset

- **Moderat, regelmæssig motion:** Antiinflammatorisk på lang sigt -- forbedrer insulinfølsomheden
- **Overdreven eller uvant motion:** Proinflammatorisk på kort sigt -- øger insulinbehovet i dage efter

Overgangen afhænger af din træningstilstand. En 10 km løbetur kan give markant inflammation hos en utrænet person men næsten ingen effekt hos en trænet løber.

### Hvad det betyder for T1D

- Efter en usædvanligt hård træning kan insulinbehovet stige 10-30% i 1-2 dage
- Muskelømhed (DOMS -- delayed onset muscle soreness) er ofte ledsaget af øget insulinresistens
- Det er vigtigt at skelne dette fra den normale post-exercise insulinfølsomhed der sker efter moderat motion

> **Kilder:**
> - Pedersen BK, Febbraio MA. (2008). "Muscle as an endocrine organ: focus on muscle-derived interleukin-6." *Physiol Rev*, 88(4):1379-1406.
> - Petersen AMW, Pedersen BK. (2005). "The anti-inflammatory effect of exercise." *J Appl Physiol*, 98(4):1154-1162.

---

## 10b. Afslapning, yoga og meditation -- stressreduktion og blodsukker

**Implementeret (via stressreduktion og vasodilatation)**

De fleste tænker på fysisk aktivitet som det primære middel til at påvirke blodsukker. Men afslapningsteknikker som yoga, meditation og udstrækning kan også have en målbar effekt -- primært via stressreduktion.

### Mekanismerne

1. **Parasympatisk aktivering:** Yoga og meditation aktiverer det parasympatiske nervesystem ("rest and digest") og dæmper det sympatiske ("fight or flight"). Dette reducerer HPA-aksens (hypothalamus-hypofyse-binyre) aktivitet.

2. **Kortisol-reduktion:** Lavere HPA-akse-aktivitet → lavere kortisol → lavere hepatisk glukoseproduktion (EGP). For T1D-patienter med forhøjet stress betyder dette et målbart BG-fald.

3. **Perifer vasodilatation:** Afslapning og langsom udstrækning øger blodgennemstrømningen i perifere væv. Øget blodflow til muskler og fedtvæv forbedrer insulins virkning en smule (insulin-medieret vasodilatation er funktionelt koblet til glukoseoptag).

### Evidens

- En meta-analyse (PMC10534311, 2023) viser at mindfulness forbedrer glykæmisk kontrol målt ved HbA1c, primært via stressreduktion og bedre selvhåndtering.
- Et RCT fra 2025 (Diabetology & Metabolic Syndrome) med T1D-teenagere viste at 3 måneders yoga gav lavere HbA1c og reduceret insulinbehov.
- Evidensen er stærkere for T2D end T1D, men mekanismerne (stressreduktion, vasodilatation) er relevante for begge.

### Hvad det betyder for T1D

- Afslapning erstatter ikke insulin eller motion, men kan hjælpe med at reducere stressinduceret hyperglykæmi.
- Særligt relevant i perioder med forhøjet stress (sygdom, eksamener, søvnmangel) hvor BG ellers er svær at kontrollere.
- I simulatoren modelleres afslapning som stressreduktion (akut + kronisk) med en mild vasodilatation-bonus.

> **Kilder:**
> - Pascoe MC, et al. (2023). "The Effects of Mindfulness on Glycemic Control in People with Diabetes: An Overview of Systematic Reviews and Meta-Analyses." *Nutrients*, 15(19):4085.
> - Shree Ganesh HR, et al. (2022). "Impact of an Integrated Yoga Therapy Protocol on Insulin Resistance and Glycemic Control in Patients with T2DM." *Int J Yoga*, 15(1):54-60.
> - Mahmoud AA, et al. (2025). "The impact of three months of adjuvant yoga intervention on glycemic control among adolescents with type 1 diabetes." *Diabetol Metab Syndr*, 17:42.
> - Baron AD, et al. (1999). "Insulin-Mediated Vasodilation and Glucose Uptake Are Functionally Linked in Humans." *Hypertension*, 33(1):554-558.

---

# Del 3: Hormoner og døgnrytme

Blodsukkeret påvirkes ikke kun af mad, insulin og motion. Kroppens egne hormoner spiller en stor rolle -- og mange af dem følger døgnrytmer der kan forklare tilsyneladende "uforklarlige" blodsukkermønstre.

---

## 11. Kontraregulatoriske hormoner -- kroppens forsvar mod lavt blodsukker

**Aktiv i simulatoren (to-lags stresssystem)**

Kroppen har et hierarkisk forsvarssystem der aktiveres når blodsukkeret falder. Det er designet til at forhindre, at hjernen løber tør for brændstof. Systemet består af fire hormoner, der aktiveres i en bestemt rækkefølge:

### Glukagon -- første forsvarslinje

Glukagon frigives fra bugspytkirtlens alfa-celler når blodsukkeret falder under ca. 3.8 mmol/L. Det virker hurtigt (inden for 2-5 minutter) og får leveren til at frigive glukose fra sine glykogenlagre. Glukagon kan øge leverens glukoseproduktion 3-5 gange over det basale niveau.

**Vigtigt for T1D:** Hos de fleste T1D-patienter er glukagonresponset svækket eller helt fraværende efter 5 eller flere års sygdom. Alfacellerne overlever — de ødelægges ikke af det autoimmune angreb — men de mister det parakrine signal fra de nærliggende betaceller (lokal insulin, GABA, zink) der normalt koordinerer glukagonfrigivelsen. Denne "switch-off hypotese" (Unger & Orci 2010, Brissova 2005) forklarer hvorfor alfacellerne stadig kan producere glukagon ved andre stimuli (fx arginin), men ikke reagerer korrekt på lavt blodsukker. Det betyder, at T1D-patientens vigtigste akutte forsvar mod lavt blodsukker mangler.

### Adrenalin -- det sekundære forsvar

Adrenalin aktiveres når blodsukkeret falder under ca. 3.6 mmol/L. Det stimulerer leverens glukoseproduktion og reducerer musklernes glukoseoptag. Adrenalin er også det hormon der giver de velkendte advarselssymptomer: svedtendens, hjertebanken, rysten og sultfølelse.

Hos T1D-patienter med "hypoglykæmi-unawareness" (manglende evne til at mærke lavt blodsukker) er også adrenalinresponset svækket. Det skaber en farlig situation hvor patienten hverken har glukagon eller adrenalin som forsvar.

### Kortisol -- det langsomme forsvar

Kortisol frigives ved vedvarende hypoglykæmi, stress og sygdom. Det øger leverens glukoseproduktion og reducerer insulinfølsomheden. Men det virker langsomt (1-2 timer) og er derfor ikke nok til at stoppe et akut blodsukker-fald. Til gengæld har det en lang varighed (8-12 timer biologisk virkning).

### Væksthormon

Væksthormon stimulerer fedtforbrænding, reducerer musklernes glukoseoptag og øger leverens glukoseproduktion. Det virker endnu langsommere end kortisol og har størst betydning ved vedvarende hypoglykæmi og under søvn.

### Hvordan det er modelleret i simulatoren

Simulatoren forenkler de fire hormoner til et to-lags system:

- **Akut stress** (adrenalin + glukagon): virker hurtigt, halveres på ca. 60 minutter
- **Kronisk stress** (kortisol): virker langsomt, halveres på ca. 12 timer

Tilsammen driver de leverens glukoseproduktion op, hvilket er den primære mekanisme for at modvirke lavt blodsukker.

> **Kilder:**
> - Cryer PE. (2013). "Glucose counterregulatory responses to hypoglycemia." *Pediatric Endocrinology Reviews*, 11(Suppl 1):26-37.
> - Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *J Clin Invest*, 64(1):62-71.

---

## 12. Dawn-fænomenet -- morgenens blodsukkerstigning

**Aktiv i simulatoren (sinusmodel)**

Mange T1D-patienter oplever, at blodsukkeret stiger i de tidlige morgentimer (ca. kl. 04-08) -- uden at de har spist noget, og uden at der har været natlig hypoglykæmi. Det kaldes dawn-fænomenet, og det er en helt normal fysiologisk proces.

### Hvorfor det sker

Kroppen forbereder sig på at vågne. I de tidlige morgentimer stiger kortisol (stresshormonet) som del af den naturlige døgnrytme, og væksthormon frigives pulsatilt under den sene del af søvnen. Begge hormoner:

- Øger leverens glukoseproduktion
- Reducerer insulinfølsomheden

Hos raske mennesker kompenserer bugspytkirtlen automatisk med mere insulin. Hos T1D-patienter mangler denne kompensation, og blodsukkeret stiger typisk 1-3 mmol/L mellem kl. 04 og 08.

### Hvorfor det er vigtigt at forstå

Dawn-fænomenet er ikke patientens skyld. Det er ikke fordi du har spist forkert aftenen før eller givet for lidt insulin. Det er en biologisk proces der kræver aktiv håndtering -- enten via højere basalinsulin i de tidlige morgentimer (muligt med insulinpumpe) eller via et morgenbolus.

I simulatoren er dawn-fænomenet modelleret som en sinusformet kortisolstigning der starter kl. 04, topper kl. 08 og er forsvundet kl. 12. Amplitude svarer til ca. 30% øget leverglukoseproduktion på toppen.

> **Kilder:**
> - Bolli GB, et al. (1984). "Demonstration of a dawn phenomenon in normal human volunteers." *Diabetes*, 33(12):1150-1153.
> - Porcellati F, et al. (2013). "Thirty years of research on the dawn phenomenon: lessons to optimize blood glucose control in diabetes." *Diabetes Care*, 36(12):3860-3862.

---

## 13. Somogyi-effekten -- rebound efter natlig hypoglykæmi

**Aktiv i simulatoren (via automatisk akut stress ved hypoglykæmi)**

Somogyi-effekten beskriver det fænomen, at natlig hypoglykæmi kan efterfølges af morgenhyperglykæmi. Mekanismen er:

1. Blodsukkeret falder under ca. 3.5 mmol/L om natten
2. Kontraregulatoriske hormoner frigives massivt
3. Leverens glukoseproduktion øges kraftigt
4. Blodsukkeret stiger hurtigt og overshooter til hyperglykæmisk niveau

Resultatet er, at patienten vågner med højt blodsukker -- og den naturlige reaktion er at øge insulindosis, hvilket paradoksalt nok kan forstærke problemet ved at forårsage endnu dybere natlig hypoglykæmi.

### Er det virkelig så almindeligt?

Somogyi-effektens kliniske relevans er omdiskuteret. Nyere studier med CGM (kontinuerlig glukosemåling) viser, at de fleste tilfælde af morgenhyperglykæmi faktisk skyldes dawn-fænomenet eller utilstrækkelig basalinsulin -- ikke rebound fra natlig hypoglykæmi. Effekten eksisterer fysiologisk, men dens praktiske betydning er muligvis overvurderet. CGM har gjort det muligt at skelne de to -- ser man et natligt dyk efterfulgt af stigning, er det Somogyi; ser man en gradvis stigning fra kl. 04, er det dawn.

> **Kilder:**
> - Guillod L, et al. (2007). "Nocturnal hypoglycaemias in type 1 diabetic patients: what can we learn with continuous glucose monitoring?" *Diabetes Metab*, 33(5):360-365.
> - NCBI StatPearls. "Somogyi Phenomenon."

---

## 14. Døgnvariation i insulinfølsomhed

**Implementeret (hybrid model: HGP + ISF)**

Ud over dawn-fænomenet varierer kroppens insulinfølsomhed over hele døgnet:

- **Om morgenen (ca. kl. 08:00):** Insulinfølsomheden er lavest -- op til 30-50% lavere end gennemsnittet. Du har brug for mere insulin per gram kulhydrat til morgenmaden end til aftensmaden.
- **Om aftenen (ca. kl. 19:00):** Insulinfølsomheden er højest. Samme insulindosis har en større effekt.

Denne variation skyldes det cirkadiske system (kroppens indre ur) der styrer kortisolrytme, væksthormon, det autonome nervesystem og leverens insulinnedbrydning.

### Evidens og dens begrænsninger

Evidensen for døgnvariation i ISF er overraskende uklar, især for T1D:

**Raske personer (Saad 2012, n=20):** SI var *højest* om morgenen og lavere resten af dagen. Identiske måltider kl. 07/13/19 viste bedst glukosetolerance til morgenmad. Men dette er raske — de har et fungerende beta-cellerespons der kompenserer.

**T1D-patienter (Hinshaw 2013, n=19):** SI-mønstret var *omvendt* sammenlignet med raske — lavest om morgenen (5.1), højest til frokost (7.6). **Men**: forskellen var *ikke* statistisk signifikant (P=0.34), og forfatternes hovedkonklusion var at *"any diurnal pattern of SI in type 1 diabetes is individual specific"* — det kan **ikke** generaliseres til populationen. Derudover fandt de hepatisk insulinresistens om morgenen: EGP var mindre supprimeret trods højere insulinniveauer.

**T1D børn/unge (Sohag 2022, n=93):** Real-life korrektionsdoser viste morgen-ISF ~50 mg/dL, aften ~75 mg/dL — ca. 50% forskel. Foreslår differenterede formler: morgen=1736/TDD, aften=2035/TDD. Men studiet er pædiatrisk, ét center, Egypten.

**Modellering (Toffanin 2013):** Konstruerede en cirkadisk ISF-kurve baseret på publicerede studier (piecewise kubisk interpolation, 7 segmenter). Sensitivitetsfaktor: 0.4 (nadir kl. 08) til 1.4 (peak midnat). Valideret *in silico* (UVA/Padova-simulator, 100 virtuelle patienter) — ikke på rigtige patienter. Resulterede i 6-40% færre hypo-episoder i simulationen.

**Klinisk praksis (Scheiner 2020):** Beskriver basalrate-mønstre med morgen-peak i insulinbehov — universel klinisk observation fra tusindvis af pumpebrugere. Ingen præcise SI-kurver, men stærk klinisk erfaring.

### Hvad det betyder i praksis

- Insulin-til-kulhydrat-ratioen (ICR) bør ideelt set være lavere om morgenen (mere insulin per gram kulhydrat) og højere om aftenen
- Mange insulinpumper programmeres med 2-3 forskellige basalrater over døgnet
- Det forklarer, hvorfor det kan være lettere at holde blodsukkeret stabilt om aftenen end om morgenen
- ~40% ekstra morgeninsulin er en realistisk størrelsesorden baseret på klinisk erfaring

### Implementering i simulatoren

Simulatoren bruger en **hybrid model** der deler morgeneffekten mellem to mekanismer:

1. **HGP-stigning (leverproduktion):** `circadianKortisolNiveau` — sinusbue kl. 04-12, amplitude reduceret til 0.15 (fra 0.30). Leveren producerer op til 15% mere glukose om morgenen.

2. **ISF-reduktion (perifer insulinresistens):** `circadianISF` — døgnkurve med ISF-faktor 0.70 om morgenen (insulin virker 30% dårligere) og 1.20 om aftenen (insulin virker 20% bedre). Inspireret af Toffanin 2013, dæmpet til 50% amplitude.

**Samlet morgeneffekt (kl. 08):** HGP ×1.15 + ISF ×0.70 → spilleren skal bruge ~43% mere insulin til morgenmaden. **Samlet afteneffekt (kl. 19):** HGP ×1.0 + ISF ×1.20 → insulin virker ~17% bedre om aftenen.

### Ærlig vurdering af modellens kvalitet

Denne implementering er bygget på **mangelfuld videnskabelig evidens** kombineret med klinisk erfaring fra T1D-patienter. De vigtigste forbehold:

- Hinshaw 2013 konkluderer eksplicit at ISF-mønstret er individuelt og ikke generaliserbart for T1D
- Toffanin 2013-kurven er en syntetisk konstruktion valideret på virtuelle patienter (cirkulær validering)
- Den valgte amplitude (50% af Toffanin) og split mellem HGP/ISF er baseret på klinisk intuition, ikke præcise målinger
- Modellen bør opdateres hvis bedre kvantitative data for døgnvariation i T1D bliver tilgængelige

> **Kilder:**
> - Saad A, et al. (2012). "Diurnal pattern to insulin secretion and insulin action in healthy individuals." *Diabetes*, 61(11):2691-2700.
> - Hinshaw L, et al. (2013). "Diurnal pattern of insulin action in type 1 diabetes." *Diabetes*, 62(7):2223-2229.
> - Toffanin C, et al. (2013). "Dynamic insulin on board: incorporation of circadian insulin sensitivity variation." *J Diabetes Sci Technol*, 7(4):928-940.
> - El-Rasheedy FI, et al. (2022). "Diurnal variation of real-life insulin sensitivity factor among children and adolescents with type 1 diabetes." *Front Pediatr*, 10:854972.
> - Scheiner G. (2020). *Think Like a Pancreas: A Practical Guide to Managing Diabetes with Insulin*. 3rd ed. Da Capo Lifelong Books.

---

## 15. Menstruationscyklus og insulinbehov

**Ikke implementeret (planlagt)**

For kvinder med T1D er menstruationscyklussen en ofte overset faktor i blodsukkerreguleringen. Kønshormoner har en markant effekt på insulinfølsomheden, og mange kvinder oplever tilbagevendende perioder med "uforklarligt" højt blodsukker.

### Follikulærfasen (dag 1-14 i cyklussen)

I første halvdel af cyklussen dominerer østrogen. Insulinfølsomheden er normal til let forhøjet, og blodsukkerkontrol er relativt stabil. Det er ofte den "gode" periode.

### Lutealfasen (dag 15-28)

I anden halvdel stiger progesteron markant, og det har en direkte negativ effekt på insulins signalveje i cellerne. Forskning viser, at insulinfølsomheden kan falde med op til 50%. Et studie målte et fald i insulinfølsomhedsindeks fra 5.03 til 2.22 -- mere end en halvering.

Klinisk betyder det, at mange kvinder med T1D har brug for 15-30% mere insulin i ugen op til menstruation. Når menstruationen starter og progesteron falder, normaliseres insulinfølsomheden -- og der er risiko for hypoglykæmi hvis insulindosis ikke reduceres igen.

### Hvad det betyder i praksis

- For at mestre blodsukkeret er det vigtigt at kende sin cyklus og anticipere behovsændringer
- En cyklusdagbog kombineret med blodsukkerdata kan afsløre individuelle mønstre
- Nogle kvinder justerer deres basalrate med 10-20% op i lutealfasen

> **Kilder:**
> - Yeung EH, et al. (2024). "Menstrual Cycle Effects on Insulin Sensitivity in Women with Type 1 Diabetes: A Pilot Study." *Diabetes Care*.
> - Trout KK, et al. (2023). "Menstrual Cycle, Glucose Control and Insulin Sensitivity in Type 1 Diabetes: A Systematic Review." *J Pers Med*, 13(2):374.
> - Kelliny C, et al. (2014). "Alteration of insulin sensitivity by sex hormones during the menstrual cycle." *Physiol Rev*, 94(3):793-834.

---

## 16. Sæsonvariation

**Ikke implementeret (lav prioritet)**

Insulinbehovet varierer også med årstiderne, selv om det kan være svært at adskille fra ændringer i adfærd.

### Vinter

HbA1c er typisk højere om vinteren. Et studie med T1D-unge viste 9.1% om vinteren versus 7.7% om sommeren. Mulige forklaringer omfatter: reduceret fysisk aktivitet, øget kalorieindtag, reduceret D-vitaminsyntese og kortere dage der kan påvirke kroppens døgnrytme.

### Sommer

Insulinbehovet er typisk lavere om sommeren. Øget fysisk aktivitet og varme accelererer insulinabsorption. Til gengæld er der også flere episoder med lavt blodsukker -- kombinationen af bedre insulinfølsomhed og hurtigere absorption er en risikofaktor.

Sæsonvariationen er sandsynligvis en kombination af fysiologiske og livsstilsfaktorer og er svær at isolere i kontrollerede studier.

> **Kilde:** Mianowska B, et al. (2011). "HbA1c levels in schoolchildren with type 1 diabetes are seasonally variable and dependent on weather conditions." *Diabetologia*, 54(4):749-756.

---

# Del 4: Livsstil og ydre faktorer

Ud over de fysiologiske processer er der en række livsstils- og miljøfaktorer der påvirker blodsukkeret -- ofte på måder der overrasker nydiagnosticerede.

---

## 17. Sygdom og infektion

**Delvist modelleret (via kronisk stress)**

Når kroppen bekæmper en infektion, stiger insulinbehovet markant. Det er en af de hyppigste årsager til uventet højt blodsukker og -- i værste fald -- ketoacidose.

### Hvorfor sygdom driver blodsukkeret op

**Cytokiner (betændelsesstoffer):** Immunsystemet frigiver signalstoffer som TNF-alfa, IL-1 og IL-6 når det bekæmper infektion. Disse stoffer hæmmer insulins signalveje i musklerne og øger leverens glukoseproduktion. Effekten er en direkte, fysiologisk insulinresistens.

**Stresshormoner:** Sygdom aktiverer stressresponsen. Kortisol, adrenalin og væksthormon stiger alle, og de modvirker alle insulin (se afsnit 11).

**Feber:** Feber i sig selv øger stofskiftet med ca. 10-13% per grad over 37 grader Celsius. Men den dominerende effekt er insulinresistensen fra cytokiner og stresshormoner, ikke selve feberen.

### Sygedagsregler for T1D

- Insulinbehovet kan stige 50-100% under akut sygdom
- Mål blodsukker hyppigere (mindst hver 2.-3. time)
- Mål ketoner (se afsnit 23)
- Øg basalinsulin med 10-20% (eller mere efter behov)
- Hold væskeindtaget oppe -- dehydrering forværrer situationen
- Risikoen for DKA stiger markant ved sygdom pga. kombinationen af øget insulinbehov og nedsat appetit

> **Kilder:**
> - Dungan KM, et al. (2009). "Stress hyperglycaemia." *Lancet*, 373(9677):1798-1807.
> - Holt RIG, et al. (2024). "Diabetes and infection: review of the epidemiology, mechanisms and principles of treatment." *Diabetologia*.

---

## 18. Søvn og søvnmangel

**Aktiv i simulatoren (natlige interventioner giver kronisk stress og insulinresistens)**

Dårlig søvn påvirker blodsukkeret mere end de fleste tror. Forskningen er klar: søvnmangel giver insulinresistens.

### Hvad forskningen viser

- Restriktion til 4-5.5 timers søvn reducerer insulinfølsomheden med 16-24%
- Allerede en enkelt nats dårlig søvn giver målbar øget insulinresistens
- Den metaboliske effekt af søvnmangel minder om type 2 diabetes: musklerne optager mindre glukose, leveren producerer mere, og hele systemet fungerer dårligere

### Mekanismerne

Søvnmangel forstyrrer kroppen på flere niveauer:
- Kortisol stiger, især om aftenen (forstyrret døgnrytme)
- Det sympatiske nervesystem (kamp-eller-flugt) er overaktivt
- Kroppens indre ur kommer ud af takt
- Betændelsesmarkorer stiger

### Hvad det betyder for T1D

- Søvnmangel kan forklare uforklarlig morgenhyperglykæmi
- Skifteholdsarbejde er associeret med dårligere blodsukkerkontrol
- For optimal regulering anbefales mere end 7 timers søvn
- Kombinationen af søvnmangel og dawn-fænomenet kan give særlig høj morgen-BG

### Hvordan det fungerer i simulatoren

I spillet modelleres natlige afbrydelser (mellem kl. 22 og 07) som søvnforstyrrelser. Hver gang du vågner for at håndtere dit blodsukker, koster det søvnkvalitet. Om morgenen omsættes søvntabet til kronisk stress, som øger insulinresistensen de følgende timer. Ved maksimalt søvntab (4 timer) giver det ca. 24% øget insulinresistens -- hvilket matcher kliniske studier.

> **Kilder:**
> - Spiegel K, et al. (2005). "Sleep loss: a novel risk factor for insulin resistance and Type 2 diabetes." *J Appl Physiol*, 99(5):2008-2019.
> - Donga E, et al. (2010). "Partial Sleep Restriction Decreases Insulin Sensitivity in Type 1 Diabetes." *Diabetes Care*, 33(7):1573-1577.
> - Zheng H, et al. (2017). "Poor Sleep Quality Is Associated with Dawn Phenomenon and Impaired Circadian Clock Gene Expression." *Int J Endocrinol*.

---

## 19. Alkohol

**Ikke implementeret (planlagt)**

Alkohol er en af de mest komplekse og potentielt farlige faktorer for T1D-patienter. Den akutte effekt er det modsatte af hvad mange tror -- alkohol sænker blodsukkeret.

### Den akutte effekt: leveren er optaget

Når du drikker alkohol, prioriterer leveren at nedbryde alkoholen (som er et giftstof) over alt andet. Det blokerer leverens evne til at producere ny glukose (glukoneogenese) og kan udtømme leverens glykogenlager. Resultatet er, at den glukoseproduktion der normalt holder blodsukkeret oppe mellem maltider, bremses eller stopper helt.

### Den forsinkede fare: 6-12 timer efter

Den mest klinisk farlige effekt er forsinket hypoglykæmi. Moderat alkoholforbrug om aftenen kan udløse hypoglykæmi næste morgen (kl. 07-11), fordi:
- Leverens glykogenlager er delvist tomt
- Glukoneogenesen er stadig hæmmet
- Kontraregulationen (kroppens forsvar mod lavt blodsukker) er også svækket af alkohol

### Med eller uden mad gør en kæmpe forskel

- **Med mad:** Moderat alkohol har begrænset effekt på blodsukkeret
- **Uden mad:** Alkohol kan inducere dyb, farlig hypoglykæmi

### Hvorfor det er så farligt

Alkohol er en af de hyppigste årsager til svær hypoglykæmi hos unge voksne med T1D. Problemet forstærkes af, at hypoglykæmi-symptomer (forvirring, usikker gang, sløret tale) kan forveksles med beruselse -- både af patienten selv og af omgivelserne. Det forsinker behandlingen og kan i værste fald være livstruende.

> **Kilder:**
> - Emanuele NV, et al. (2019). "Consequences of Alcohol Use in Diabetics." *Alcohol Health Res World*, 22(3):211-219.
> - Turner BC, et al. (2001). "The effect of evening alcohol consumption on next-morning glucose control in type 1 diabetes." *Diabetes Care*, 24(11):1888-1893.
> - Kerr D, et al. (2007). "Impact of Alcohol on Glycemic Control and Insulin Action." *Biomolecules*, 5(4):2223-2245.

---

## 20. Psykologisk stress

**Delvist modelleret (via kronisk stress)**

Psykologisk stress -- eksaminer, arbejdspres, konflikter, angst -- påvirker blodsukkeret via de samme hormonsystemer som fysisk stress.

### Mekanismerne

**Akut stress (adrenalin):** En stressende situation udløser adrenalin, som får leveren til at frigive glukose. Blodsukkeret kan stige hurtigt.

**Kronisk stress (kortisol):** Langvarig stress holder kortisolniveauet forhøjet, hvilket øger leverens glukoseproduktion og reducerer insulinfølsomheden. Effekten er vedvarende og kan give kronisk forhøjet blodsukker.

**Adfærdsmæssig effekt:** Stress ændrer også spisemønstre, søvnkvalitet og motionsvaner -- alle med indirekte effekter på blodsukkeret.

### Individuel variation

Stressresponsens effekt på blodsukkeret varierer markant mellem personer. Nogle T1D-patienter oplever primært hyperglykæmi ved stress, andre mærker minimal effekt, og et fåtal oplever faktisk hypoglykæmi (pga. ændret spisemønster med nedsat appetit).

> **Kilde:** Surwit RS, et al. (2002). "Stress management improves long-term glycemic control in type 2 diabetes." *Diabetes Care*, 25(1):30-34.

---

## 21. Temperatur og klima

**Ikke implementeret (lav prioritet)**

Omgivelsestemperaturen påvirker insulinabsorption og dermed blodsukkerkontrol -- noget der er særligt relevant på ferier og ved udendørs aktiviteter.

### Varme øger insulinvirkning

- Sauna (85 grader Celsius) øger insulinabsorptionen fra injektionsstedet med 110%, og blodsukkeret falder med 3 mmol/L eller mere
- Lokal opvarmning (40 grader Celsius) reducerer tid til højeste insulinvirkning fra 111 til 77 minutter
- Mekanismen er vasodilatation -- øget blodgennemstrømning i underhuden får insulinet hurtigere ud i blodbanen

### Kulde bremser insulinvirkning

- Afkøling af injektionsstedet reducerer insulinkoncentrationen med over 40% og øger blodsukkeret med ca. 3 mmol/L
- Vasokonstriktion (blodkarrene trækker sig sammen) bremser insulintransporten

### Insulin tåler ikke godt varme eller kulde

Insulin er et protein og er følsomt over for temperaturekstremer:
- Under 2 grader Celsius: krystalstrukturen ødelægges irreversibelt
- Over 30 grader Celsius: accelereret nedbrydning
- Direkte sollys: hurtig denaturering

### Hvad det betyder i praksis

- Sommerferie og strandbesøg: hurtigere insulinvirkning, risiko for hypoglykæmi
- Vintersport: langsommere insulinvirkning, risiko for hyperglykæmi
- Opbevaring af insulin i varme/kulde kan gøre det uvirksomt -- og det kan føre til ketoacidose

> **Kilder:**
> - Berger M, et al. (1981). "A rise in ambient temperature augments insulin absorption in diabetic patients." *Metabolism*, 30(5):393-396.
> - Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.
> - Vimalavathini R, et al. (2021). "Thermal stability and storage of human insulin." *Indian J Med Res*, 154(6):849-857.

---

## 22. Injektionssted

**Delvist modelleret (i simulatorens kompartmentmodel)**

Hvor på kroppen du sætter din insulininjektion har betydning for, hvor hurtigt insulinet virker. Det er noget mange nydiagnosticerede ikke ved, og det kan forklare uforudsigelig insulinvirkning.

### Absorptionshastighed efter sted

| Sted | Relativ hastighed | Forklaring |
|------|-------------------|------------|
| Maven | 1.0 (hurtigst -- reference) | Tyndest fedtlag, mest blodgennemstrømning |
| Overarm | ca. 0.85 | Medium fedtlag |
| Balde | ca. 0.75 | Dybt subkutant depot |
| Lår | ca. 0.70 (langsomst) | Tykkest fedtlag, mindst blodgennemstrømning |

### Andre faktorer

- **Lipohypertrofi:** Gentagne injektioner i præcis det samme sted kan danne fedtknuder under huden. Insulin injiceret i en sådan knude absorberes uforudsigeligt -- nogle gange for hurtigt, andre gange slet ikke. Det er en af de hyppigste årsager til "mystisk" blodsukkervariation.
- **Motion i nærliggende muskelgruppe:** Løbetræning øger absorptionen fra låret, armøvelser fra overarmen.
- **Massage af injektionsstedet:** Accelererer absorptionen markant.

> **Kilde:** Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.

---

# Del 5: Komplikationer og faresignaler

Denne del dækker de akut farlige situationer ved T1D og de fysiologiske mekanismer bag dem.

---

## 23. Ketonstoffer og diabetisk ketoacidose

**Aktiv i simulatoren (forenklet model)**

Ketonstoffer er et emne der ofte skaber forvirring. De er ikke i sig selv farlige -- faktisk er de en normal del af kroppens energisystem. Men ved insulinmangel kan ketonproduktionen løbe løbsk og blive livstruende.

### Normal ketogenese -- kroppens reservebrændstof

Når kroppen ikke har nok glukose til rådighed (under faste, ved lav kulhydratindtag), skifter den til at brænde fedt. Fedtsyrerne nedbrydes i leveren, og et biprodukt er ketonstoffer (primært beta-hydroxybutyrat). Hjernen og musklerne kan bruge ketonstoffer som brændstof -- det er en overlevelsesmekanisme der har tjent menneskeheden godt i perioder med fødevareknaphed.

Ved normal faste-ketose stiger ketonerne moderat (0.5-3 mmol/L) og er uskadelige.

### Patologisk ketoacidose (DKA) -- når det løber løbsk

Ved absolut insulinmangel -- fx glemt insulin, pumpesvigt eller ny-debut T1D -- sker følgende kaskade:

1. **Ukontrolleret fedtnedbrydning:** Uden insulin er der intet signal om at stoppe. Massive mængder fedtsyrer frigives.
2. **Overproduktion af ketonstoffer:** Leveren producerer langt flere ketonstoffer end kroppen kan forbruge.
3. **Metabolisk acidose:** Ketonstoffer er syrer. Når de hober sig op, falder blodets pH -- kroppen bliver bogstaveligt talt sur.
4. **Dehydrering:** Det høje blodsukker driver glukose og vand ud i urinen (osmotisk diurese).
5. **Elektrolytforstyrrelser:** Natrium og kalium forsvinder med urinen, hvilket kan give hjerterytmeforstyrrelser.
6. **Uden behandling:** Koma og død.

### Når skal du reagere?

| Ketonniveau (BHB) | Kategori | Handling |
|--------------------|----------|----------|
| Under 0.6 mmol/L | Normalt | Ingen handling nødvendig |
| 0.6-1.5 mmol/L | Let forhøjet | Drik vand, giv insulin, mål igen om 1-2 timer |
| 1.5-3.0 mmol/L | Risiko for DKA | Kontakt læge, giv insulin, drik rigeligt |
| Over 3.0 mmol/L | DKA sandsynlig | Akut sygehusindlæggelse |

### Vigtig skelnen: fasteketose er IKKE det samme som DKA

Ketoner der stiger fordi du faster eller spiser meget lidt kulhydrat er fysiologisk normalt og uskadeligt (så længe du har insulin i kroppen). DKA er drevet af **absolut insulinmangel** og er en akut, livstruende tilstand.

| Parameter | Faste-ketose | DKA |
|-----------|-------------|-----|
| Insulin til stede | Ja (nedsat, men til stede) | Nej / minimalt |
| BG-niveau | Normalt / lavt | Meget højt (>14-20) |
| Ketoner (BHB) | 0.5-3 mmol/L (evt. 5-7 ved lang faste) | 3-25+ mmol/L |
| Blodets pH | Normal (>7.35) | Lav (<7.3, acidose) |
| Farligt? | Nej | Ja, livstruende |
| Mekanisme | Kontrolleret fedtforbrænding | Ukontrolleret lipolyse |

### Den centrale driver: insulin, ikke blodsukker

Den primære driver af ketogenese er **insulinniveau**, ikke blodglukose. Lipolyse
(fedtnedbrydning) er ekstremt insulinfølsom — det er den *første* proces der aktiveres
når insulin falder. EC50 for insulins suppression af lipolyse er kun ~100 pmol/L
(7-24 mU/L), langt lavere end for glukoseoptag (~300-400 pmol/L).

Kaskaden er:
1. **Lav insulin** → lipolyse øges (fedtcellerne frigiver fedtsyrer)
2. **Frie fedtsyrer (FFA)** strømmer til leveren
3. **Beta-oxidation** i leveren producerer acetyl-CoA
4. **Ketogenese**: overskydende acetyl-CoA omdannes til ketonlegemer (BHB, acetoacetat)

Ved faste/low-carb tager man *mindre* insulin, fordi man spiser færre kulhydrater.
Den lavere insulin tillader kontrolleret fedtforbrænding — det er netop meningen.
Ved DKA er der *ingen* insulin, og lipolysen løber fuldstændigt løbsk.

Protein spiller også en rolle: glukogene aminosyrer omdannes til glukose via
glukoneogenese, som forbruger oxaloacetat fra citronsyrecyklus. Det presser
endnu mere acetyl-CoA mod ketogenese. Dvs. glukoneogenese og ketogenese er
**parallelle processer der forstærker hinanden** ved insulinmangel.

### DKA-behandling: sukker + insulin

En vigtig klinisk pointe: ved DKA-behandling gives insulin for at stoppe
ketogenesen, men insulin sænker også blodsukkeret. Derfor gives **glukose
intravenøst** samtidig (når BG falder under ~14 mmol/L) for at undgå
hypoglykæmi under behandlingen. Sukker og insulin skal gives *sammen* —
dette er relevant for simulatoren, hvor spilleren skal forstå at man ikke
bare kan "insuline" sig ud af DKA uden også at spise.

### Typiske ketonniveauer ved forskellige tilstande

| Tilstand | BHB (mmol/L) | Insulin-status |
|----------|-------------|----------------|
| Normal, mæt | < 0.1 | Normal |
| Nattefaste (12 t) | 0.1-0.4 | Let nedsat |
| 24 timers faste | 1-2 | Nedsat |
| Ketogen diæt (vedvarende) | 0.5-3 | Nedsat men til stede |
| 72 timers faste | 5-7 | Markant nedsat |
| Mild DKA | 1.5-3 | Meget lav / fraværende |
| Svær DKA | 3-25+ | Fraværende |

### Keton-clearance

Ketoner elimineres via to mekanismer:
- **Muskel- og hjerneforbrug**: ketoner bruges som brændstof (erstatter glukose)
- **Renal udskillelse**: ved høje niveauer udskilles ketoner i urinen

Halveringstid for BHB: 0.8-3.1 timer, men clearance er **mætnelig** — ved
høje koncentrationer (DKA) er eliminationen langsommere pga. Michaelis-Menten
kinetik (Clarke et al. 2012: CL = 10.9 L/t + Vmax-komponent).

### Low-carb og BG-kontrol

Low-carb kost giver markant lettere BG-kontrol ved T1D fordi:
- Færre og mindre kulhydrat-boluser → mindre variabilitet
- Mindre "kurvefejl" fra fejlestimerede kulhydrater
- Jævnere BG-profil med færre spikes
- Ketoner som alternativt brændstof reducerer hjernens glukoseafhængighed

Ulempen: kræver opmærksomhed på protein-insulin (protein omdannes delvist til
glukose, ~25-50% afhængig af mængde) og kan kræve justering af basal-dosis.

### Publicerede matematiske keton-modeller

Der er relativt få modeller i litteraturen:

1. **Pinnaro, Christensen & Curtis (2021):** "Modeling Ketogenesis for Use in
   Pediatric Diabetes Simulation." *JDST*, 15(2):303-308. — **Mest relevant for
   vores simulator.** IOB-dreven model: ketoner stiger når IOB < tærskel, falder
   når IOB > tærskel. Kalibreret til DKA inden 1-2 dage ved komplet insulinmangel.
   Ketoner modulerer insulinfølsomhed (ketoacidose kræver mere insulin).

2. **Balasse & Féry (1984):** "Ketone body kinetics in humans: a mathematical model."
   *J Lipid Res*, Feb 1984. — 5-kompartment model med rate-konstanter for BHB/acetoacetat
   interkonversion og clearance.

3. **Roy & Parker (2006):** "Dynamic Modeling of Free Fatty Acid, Glucose, and Insulin."
   *Diabetes Technol Ther*, 8:617-626. — FFA-dynamik model for T1D, upstream precursor
   til ketoner.

4. **Cobelli/Dalla Man (2023):** FFA-kinetik model med Hill-funktion for insulins
   suppression af lipolyse. *Am J Physiol*.

Bemærkelsesværdigt: hverken UVA/Padova-simulatoren eller Hovorka-gruppen har
publiceret integrerede ketonmodeller i deres T1D-simulatorer.

### Faste og insulinfølsomhed

Overraskende nok viser forskningen at kortvarig faste (≤24 timer) faktisk
**nedsætter** insulinfølsomheden med op til 54%. Kun faste >6 dage viser
forbedret insulinfølsomhed i kontrollerede forsøg. Intermittent fasting over
12+ uger giver moderat forbedring.

Dette er kontraintuitivt og vigtigt: en enkelt fastedag gør det *sværere* at
styre BG, ikke lettere — mens vedvarende low-carb/ketogen kost over uger
gradvist forbedrer insulinfølsomheden via ketoadaptation.

> **Kilder:**
> - Kitabchi AE, et al. (2009). "Hyperglycemic Crises in Adult Patients With Diabetes." *Diabetes Care*, 32(7):1335-1343.
> - Dhatariya KK, et al. (2023). "Comprehensive review of diabetic ketoacidosis: an update." *Ann Med Surg*, 85(6):2802-2807.
> - Laffel L. (1999). "Ketone bodies: a review of physiology, pathophysiology and application of monitoring to diabetes." *Diabetes Metab Res Rev*, 15(6):412-426.
> - Pinnaro L, Christensen CL, Curtis MD. (2021). "Modeling Ketogenesis for Use in Pediatric Diabetes Simulation." *JDST*, 15(2):303-308. [PubMed](https://pubmed.ncbi.nlm.nih.gov/31608650/)
> - Balasse EO, Féry F. (1984). "Ketone body kinetics in humans: a mathematical model." *J Lipid Res*, Feb 1984. [PubMed](https://pubmed.ncbi.nlm.nih.gov/6707525/)
> - Roy A, Parker RS. (2006). "Dynamic Modeling of Free Fatty Acid, Glucose, and Insulin." *Diabetes Technol Ther*, 8:617-626. [PubMed](https://pubmed.ncbi.nlm.nih.gov/17109593/)
> - Clarke K, et al. (2012). "Kinetics, safety and tolerability of (R)-3-hydroxybutyl (R)-3-hydroxybutyrate." *Regul Toxicol Pharmacol*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/22561291/)
> - Suppression of lipolysis by insulin. *JCEM* 2000, 85(10):3740-3745.

---

## 24. Insulinoverdosis og kontrareguleringens begrænsninger

**Aktiv i simulatoren (hypo game over + svækket kontraregulering ved T1D)**

Insulinoverdosis er en af de vigtigste akutte farer ved type 1 diabetes. For at forstå hvorfor det er farligt, er det nødvendigt at forstå, hvad der sker når blodsukkeret falder -- og hvorfor kroppens forsvarsmekanismer ikke altid er nok.

### Kroppens forsvar hos raske mennesker

Hos raske mennesker aktiveres et hierarki af forsvarsmekanismer når blodsukkeret falder:

| Blodsukkerniveau | Hvad der sker |
|------------------|---------------|
| Ca. 4.6 mmol/L | Bugspytkirtlen reducerer insulinproduktionen |
| Ca. 3.8 mmol/L | Glukagon og adrenalin frigives -- akut forsvar |
| Ca. 3.7 mmol/L | Kortisol og væksthormon stiger -- langsommere forsvar |
| Ca. 3.2 mmol/L | Symptomer: svedtendens, hjertebanken, sult |
| Ca. 2.8 mmol/L | Neuroglykopeni: forvirring, kramper |

### Hvorfor T1D-patienter er så sårbare

Ved type 1 diabetes er dette forsvarssystem fundamentalt svækket:

1. **Glukagon er væk:** Hos de fleste T1D-patienter er glukagonresponset svækket eller fraværende efter 5 eller flere års sygdom. Den vigtigste akutte forsvarslinje mangler.

2. **Adrenalin kan svækkes:** Gentagne episoder med lavt blodsukker "nulstiller" hjernens glukose-sensorer nedad. Det kaldes hypoglykæmi-unawareness (HAAF) og betyder, at kroppen reagerer forst ved endnu lavere blodsukkerniveauer -- eller slet ikke.

3. **Kortisol og væksthormon virker for langsomt:** De tager timer om at have fuld effekt og kan ikke redde en akut situation.

Resultatet er, at en T1D-patient typisk kun har adrenalin som akut forsvar -- og det kan også være svækket.

### Hypoglykæmi-unawareness (HAAF) -- den onde cirkel

HAAF er et syndrom hvor gentagen hypoglykæmi progressivt svækker kroppens respons:

- Hjernens glukose-sensorer "vænner sig" til lavt blodsukker
- Tærsklerne for hormonrespons forskydes nedad
- Advarselssymptomerne forsvinder
- Patienten mærker først hypoglykæmien når det allerede er farligt (forvirring, kramper)
- Ca. 25% af T1D-patienter har signifikant HAAF
- Patienter med HAAF har 25 gange øget risiko for svær hypoglykæmi

**Den gode nyhed: HAAF er reversibel.** Forskning viser konsekvent, at 2-3 ugers strikt undgåelse af hypoglykæmi kan genoprette adrenalinresponset og advarsels-symptomerne. Dagogo-Jack et al. (1993) demonstrerede, at tærsklen for hormonrespons steg fra ca. 2.8 mmol/L tilbage mod 3.8 mmol/L. Det vigtige er dog, at enhver ny hypoglykæmi under recovery-perioden kan genaktivere HAAF.

Glukagonresponset (som er tabt pga. betacelle-destruktion) genoprettes derimod ikke -- det er permanent tabt.

### Hvad siger forskningen om dosis?

Der er ingen enkel "dødelig dosis" for insulin -- udfald afhænger af mange faktorer: start-blodsukker, aktiv insulin i forvejen, om der er mad i maven, kontraregulationens tilstand og hvor hurtigt der behandles. Studier af intentionelle overdoser viser, at dødsfald primært skyldes forsinket behandling snarere end absolut dosis.

### Hvordan det er modelleret i simulatoren

Simulatoren modellerer den svækkede kontraregulering ved T1D på tre måder:

1. **Reduceret stressloft:** Akut stress (kontraregulering) er begrænset til 1.0 i stedet for ca. 5.0 som en rask person ville have. Det afspejler tabet af glukagonrespons.

2. **HAAF-model:** En kontinuert model hvor alvorligheden af tidligere hypoglykæmier akkumuleres og reducerer kontraregulationen. Dyb hypoglykæmi (BG 1.5 mmol/L) giver tre gange mere "skade" per minut end mild hypoglykæmi (BG 2.5 mmol/L). Recovery sker gradvist med en halveringstid på 3 spildage.

3. **Ingen insulinbeskyttelse ved lavt blodsukker:** Insulinets virkning reduceres ikke ved hypoglykæmi i modellen -- fordi den mekanisme primært er glukagon-medieret og dermed tabt ved T1D.

> **Kilder:**
> - Cryer PE (2013). "Mechanisms of Hypoglycemia-Associated Autonomic Failure in Diabetes." *N Engl J Med*, 369:362-372.
> - Dagogo-Jack SE, et al. (1993). "Reversal of hypoglycemia unawareness, but not defective glucose counterregulation, in IDDM." *Diabetes*, 42(12):1683-1689.
> - Cranston I, et al. (1994). "Restoration of hypoglycaemia awareness in patients with long-duration insulin-dependent diabetes." *Lancet*, 344(8918):283-287.
> - Bengtsen MB, Moller N (2021). "Mini-review: Glucagon responses in type 1 diabetes -- a matter of complexity." *Physiol Rep*, 9(16):e14969.
> - Rzepczyk S, et al. (2022). "The Other Face of Insulin--Overdose and Its Effects." *Toxics*, 10(3):123.
> - Megarbane B, et al. (2007). "Intentional insulin overdose: prognostic factors and toxicokinetic/toxicodynamic profiles." *Crit Care*, 11(5):R115.

---

## 25. Ikke-linearitet i insulinvirkning -- tærskeleffekter

**Ikke implementeret (vigtigt klinisk fænomen)**

Dette er et af de mest frustrerende aspekter ved daglig T1D-behandling: insulins virkning er ikke lineær. Det vil sige, at dobbelt så meget insulin ikke nødvendigvis giver dobbelt så stor effekt -- og små doser kan tilsyneladende ikke virke overhovedet.

### Forskellige organer har forskellige tærskler

Insulin virker på flere organer, men de reagerer ved forskellige insulinkoncentrationer. Rizza et al. (1981) udførte 8-timers sekventielle insulin-clamps i 15 raske forsøgspersoner og fandt markant forskellige EC50-værdier (den koncentration hvor halvdelen af den maksimale effekt opnås):

| Effekt | EC50 (halvmaksimal) | Fuld effekt ved | Receptor-besættelse |
|--------|---------------------|-----------------|---------------------|
| Suppression af lipolyse (fedtvæv) | ~44-68 pmol/L (~8-11 μU/mL) | ~150 pmol/L | Meget lav |
| Suppression af leverens glukoseproduktion (EGP) | ~174 pmol/L (~29 μU/mL) | ~360 pmol/L (~60 μU/mL) | 11% |
| Stimulation af perifer glukoseoptagelse (muskel) | ~330 pmol/L (~55 μU/mL) | ~1200-4200 pmol/L (~200-700 μU/mL) | 49% |

Det afgørende: **leveren reagerer ved halvt så meget insulin som musklerne.** Fedtvævet reagerer endnu tidligere. Det giver et hierarki af insulineffekter sorteret efter følsomhed:

1. Fedtnedbrydning bremses (laveste tærskel)
2. Leverens glukoseproduktion bremses
3. Musklernes glukoseoptag aktiveres (højeste tærskel)

### Den S-formede dosis-respons-kurve

Insulins virkning følger en S-formet (sigmoid) kurve, typisk modelleret med en Hill-funktion:

```
Effekt(I) = Emax × I^n / (EC50^n + I^n)
```

hvor Emax er den maksimale effekt, EC50 er halvmaksimal koncentration, og n er Hill-koefficienten (kurvens stejlhed). Det betyder:

- **Under tærskel:** Næsten ingen målbar effekt
- **Omkring tærskel:** Kraftigt stigende effekt (den "stejle" del af S-kurven)
- **Over mætning:** Ekstra insulin giver aftagende ekstra effekt (kurven flader ud)

Prager et al. (1986) fandt at trods de forskellige EC50-værdier er *tidskonstanterne* for hepatisk og perifer insulinvirkning bemærkelsesværdigt ens (~43-45 min halveringstid). Begge effekter deler sandsynligvis et fælles rate-limiting step: insulintransport fra plasma til interstitielt væv.

### Hvad det betyder i dagligdagen: "dødzonen"

Dette forklarer en meget almindelig T1D-oplevelse:

1. Dit blodsukker er 12 mmol/L. Du giver 1 enhed korrektionsinsulin. Intet sker.
2. Du venter 2 timer og giver 1 enhed mere. Stadig intet.
3. I frustration giver du 2 enheder. Blodsukkeret styrtdykker til 4 mmol/L.
4. I alt 4 enheder har givet en effekt der er langt større end 4 gange din ISF.

Forklaringen: de første 2 enheder var under musklernes tærskel og påvirkede primært leveren (som allerede var delvist bremset). De sidste 2 enheder bragte koncentrationen over musklernes tærskel, og det samlede glukoseoptag steg dramatisk. I "zonen" mellem de to tærskler opleves en "dødzone" hvor insulin tilsyneladende ikke virker — leveren er allerede supprimeret, men musklerne er endnu ikke aktiveret.

### Insulinresistens vokser gabet

Ved insulinresistens (sygdom, inaktivitet, stress) forskydes dosis-respons-kurverne mod højre — der kræves mere insulin for samme effekt. Men forskydningen er **ikke ens** for alle væv:

- **Perifer (muskel) insulinresistens** er typisk den primære defekt og tegner sig for ca. **2/3** af den totale glukose-dysregulering (DeFronzo & Tripathy 2009)
- **Hepatisk insulinresistens** tegner sig for ca. **1/3**

Det betyder at under insulinresistens vokser afstanden mellem leverens og musklernes tærskler. "Dødzonen" bliver bredere. I praksis:

- **Normal tilstand:** EC50-lever ~174, EC50-muskel ~330 pmol/L → gab ~156 pmol/L
- **Insulinresistent (sygdom):** EC50-lever ~250, EC50-muskel ~600 pmol/L → gab ~350 pmol/L (mere end dobbelt)

Det er derfor "sofadage" og sygdomsdage kan give så frustrerende blodsukkerregulering: den dosis der normalt virker fint, lander nu midt i det udvidede gab hvor leveren er bremset men musklerne er inaktive.

### Selektiv hepatisk insulinresistens

Et bemærkelsesværdigt paradoks inden for selve levercellen (Brown & Goldstein 2008): under insulinresistens mister insulin evnen til at supprimere glukoneogenese (den ønskede effekt), men **bevarer** evnen til at stimulere fedtsyntese (lipogenese). Denne "selektive hepatiske insulinresistens" skaber kombinationen af hyperglykæmi + hypertriglyceridæmi — højt blodsukker og højt fedt i blodet samtidig.

### Basu et al. (2004): Målt forskel i T2D

I et 3-trins insulin-clamp-studie sammenlignede Basu et al. raske med T2D-patienter:

| Insulin-niveau | Raske: EGP | T2D: EGP | Raske: Muskeloptagelse | T2D: Muskeloptagelse |
|----------------|-----------|----------|----------------------|---------------------|
| Lavt (~150 pmol/L) | Delvist supprimeret | Utilstrækkelig suppression | Minimal | Minimal |
| Moderat (~350 pmol/L) | Fuldstændig suppression | Stadig ikke fuldstændig | Moderat | Nedsat |
| Højt (~700 pmol/L) | Fuldstændig | Fuldstændig | Høj | Stadig nedsat |

Nøglefund: muskeloptagelsen var nedsat ved **alle** testede insulinniveauer hos T2D, mens EGP-suppression kun var signifikant værre ved det laveste niveau. Det bekræfter at muskelresistens er den dominerende defekt.

### Begrænsning i simulatoren

Hovorka-modellen bruger lineære insulin-effektligninger (x1, x2, x3 er alle proportionale med insulinkoncentrationen), som ikke fanger denne tærskeladfærd. Det er en af de vigtigste begrænsninger i den nuværende simulator og en oplagt kandidat til fremtidig forbedring — fx ved at erstatte de lineære effektligninger med sigmoid (Hill-type) funktioner med separate EC50-værdier for hver effekt.

> **Kilder:**
> - Rizza RA, Mandarino LJ, Gerich JE. (1981). "Dose-response characteristics for effects of insulin on production and utilization of glucose in man." *Am J Physiol*, 240(6):E630-E639.
> - Basu R, Basu A, Johnson CM, Schwenk WF, Rizza RA. (2004). "Insulin dose-response curves for stimulation of splanchnic glucose uptake and suppression of endogenous glucose production differ in nondiabetic humans and are abnormal in people with type 2 diabetes." *Diabetes*, 53(8):2042-2050.
> - Prager R, Wallace P, Olefsky JM. (1986). "Dynamics of hepatic and peripheral insulin effects suggest common rate-limiting step in vivo." *Diabetes*, 35(9):1042-1048.
> - DeFronzo RA, Tripathy D. (2009). "Skeletal muscle insulin resistance is the primary defect in type 2 diabetes." *Diabetes Care*, 32(Suppl 2):S157-S163.
> - Brown MS, Goldstein JL. (2008). "Selective versus total insulin resistance: a pathogenic paradox." *Cell Metab*, 7(2):95-96.
> - Stumvoll M, et al. (2000). "Suppression of systemic, intramuscular, and subcutaneous adipose tissue lipolysis by insulin in humans." *J Clin Endocrinol Metab*, 85(10):3740-3745.
> - Natali A, et al. (2000). "Dose-response characteristics of insulin action on glucose metabolism: a non-steady-state approach." *Am J Physiol Endocrinol Metab*, 278(5):E794-E801.
> - Kolterman OG, et al. (1981). "Receptor and postreceptor defects contribute to the insulin resistance in noninsulin-dependent diabetes mellitus." *J Clin Invest*, 68(4):957-969.
> - Bergman RN. (2005). "Minimal model: perspective from 2005." *Horm Res*, 64(Suppl 3):8-15.
> - Thiebaud D, et al. (1982). "The effect of graded doses of insulin on total glucose uptake, glucose oxidation, and glucose storage in man." *Diabetes*, 31(11):957-963.

---

# Del 6: Teknologi og forskningsmodeller

---

## 26. CGM-teknologi -- kontinuerlig glukosemåling

**Aktiv i simulatoren (forsinkelse + støj + drift)**

En CGM (Continuous Glucose Monitor) er den sensor mange T1D-patienter bærer på kroppen for løbende at følge blodsukkeret. Men CGM måler ikke blodsukkeret direkte -- og den forsinkelse og unøjagtighed der er i målingen har betydning for, hvordan man fortolker tallene.

### Hvad CGM faktisk måler

CGM-sensoren sidder i det subkutane fedtvæv og måler glukose i den interstitielle væske (væsken mellem cellerne) -- ikke i blodet. Glukosen skal først diffundere fra blodbanen ud til sensorens placering, og det tager tid.

### Forsinkelsen er reel

- Gennemsnitlig forsinkelse fra blod til sensor: 5-6 minutter i hvile
- Total forsinkelse inklusiv sensor-processing: 7-11 minutter
- Ved hurtige ændringer (efter maltid, under motion): 10-15 minutter

Det betyder, at når din CGM viser 5.0 mmol/L og faldende, kan dit faktiske blodsukker allerede være 4.0 mmol/L. Den forsinkelse er kritisk at forstå ved hurtige blodsukkerændringer.

### Nøjagtighed

Moderne CGM-systemer (Dexcom G7, Libre 3) har en gennemsnitlig afvigelse (MARD) på ca. 8-10%. Ældre modeller (Libre 1) lå på 11-14%. Nøjagtigheden forværres ved hurtige ændringer og i det lave område (under 4 mmol/L) -- altså præcis der, hvor nøjagtighed er mest afgørende.

### Støjkilder

- **Elektronisk støj:** Random variation fra sensorens elektronik (ca. plus/minus 0.3 mmol/L)
- **Biologisk variation:** Lokalt blodflow, tryk pa sensoren, væskebalance
- **Drift:** Langsom systematisk afvigelse over sensorens levetid (typisk 7-14 dage)

### Hvordan det er modelleret i simulatoren

Simulatoren modellerer CGM-forsinkelsen som et førsteordens filter med en tidskonstant på ca. 7 minutter, plus realistisk støj og langsom drift. Det giver en CGM-aflæsning der ligner virkeligheden: den "hænger lidt efter" det sande blodsukker og svinger lidt omkring den rigtige værdi.

> **Kilder:**
> - Schrangl P, et al. (2015). "Time Delay of CGM Sensors: Relevance, Causes, and Countermeasures." *J Diabetes Sci Technol*, 9(5):1006-1015.
> - Sinha M, et al. (2017). "A Comparison of Time Delay in Three Continuous Glucose Monitors." *J Diabetes Sci Technol*, 11(5):1001-1007.
> - Ajjan RA, et al. (2018). "Accuracy of flash glucose monitoring and continuous glucose monitoring technologies." *Diabet Vasc Dis Res*, 15(3):175-184.

---

## 27. Matematiske modeller brugt i forskningen

Simulatoren bygger på Hovorka 2004-modellen, men der findes flere modeller i forskningsverden. Her er en kort oversigt for de videbegærlige:

### Hovorka 2004 (Cambridge-modellen) -- bruges i simulatoren

Den model simulatoren bygger på. Den består af 11 differentialligninger og er klinisk valideret med over 1000 citationer. Modellen blev udviklet til forskning i lukket kredslobskontrol (kunstig bugspytkirtel) og er en god balance mellem realisme og beregningsmæssig enkelhed.

> Hovorka R, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

### UVA/Padova (Dalla Man 2007/2014)

Den mest anerkendte model i feltet. Den er FDA-godkendt som erstatning for dyreforsøg i insulinpumpe-afprøvninger. Mere detaljeret end Hovorka (over 300 parametre) og inkluderer inkretinhormoner og glukagon. For kompleks til vores formål, men den videnskabelige guldstandard.

> Dalla Man C, et al. (2007). "Meal simulation model of the glucose-insulin system." *IEEE Trans Biomed Eng*, 54(10):1740-1749.

### Bergman Minimal Model (1979)

Den simpleste validerede model med kun 4 parametre. Bruges primært til analyse af intravenøse glukosetolerancetest (IVGTT), ikke til simulation af daglig T1D-behandling. Historisk vigtig som den første matematiske model af glukose-insulin-dynamik.

> Bergman RN, et al. (1979). "Quantitative estimation of insulin sensitivity." *Am J Physiol*, 236(6):E667-E677.

### Sorensen (1985)

Den mest detaljerede multi-organ-model med 19 kompartmenter. Inkluderer lever, nyrer, periferi, hjerne og tarm som separate enheder. For kompleks til realtidssimulation, men værdifuld som reference for fysiologisk korrekthed.

> Sorensen JT. (1985). PhD Thesis, MIT.

---

*Sidst opdateret: Marts 2026*

*Dette dokument udvides løbende. Bidrag og rettelser er velkomne. Kontakt os via GitHub: https://github.com/krauhe/t1d-simulator*
