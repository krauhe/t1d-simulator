# Blodsukkerregulering ved Type 1 Diabetes -- En Komplet Vidensoversigt

*Denne guide gennemgar alle kendte faktorer der pavirker blodsukkeret hos personer med type 1 diabetes. Den er skrevet til patienter, parorende og sundhedspersonale -- med videnskabelig dybde for dem der onsker det.*

Dokumentet fungerer som en vidensbase for Diabetes-Dysten simulatoren, men dækker ogsa emner der endnu ikke er implementeret i spillet. Tænk pa det som et opslagsværk: du behover ikke læse det fra ende til anden, men kan sla op i de emner der er relevante for dig.

**Hvad betyder statusmarkeringerne?**

- **Aktiv i simulatoren** -- denne faktor er modelleret og pavirker spillet
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
8. [Aerob motion -- lob, cykling, svomning](#8-aerob-motion--lob-cykling-svomning)
9. [Anaerob træning -- styrketræning og sprint](#9-anaerob-træning--styrketræning-og-sprint)
10. [Motionsinduceret inflammation -- nar motion gor ondt](#10-motionsinduceret-inflammation--nar-motion-gor-ondt)

**Del 3: Hormoner og dognrytme**
11. [Kontraregulatoriske hormoner -- kroppens forsvar mod lavt blodsukker](#11-kontraregulatoriske-hormoner--kroppens-forsvar-mod-lavt-blodsukker)
12. [Dawn-fænomenet -- morgenens blodsukkerstigning](#12-dawn-fænomenet--morgenens-blodsukkerstigning)
13. [Somogyi-effekten -- rebound efter natlig hypoglykæmi](#13-somogyi-effekten--rebound-efter-natlig-hypoglykæmi)
14. [Dognvariation i insulinfolsomhed](#14-dognvariation-i-insulinfolsomhed)
15. [Menstruationscyklus og insulinbehov](#15-menstruationscyklus-og-insulinbehov)
16. [Sæsonvariation](#16-sæsonvariation)

**Del 4: Livsstil og ydre faktorer**
17. [Sygdom og infektion](#17-sygdom-og-infektion)
18. [Sovn og sovnmangel](#18-sovn-og-sovnmangel)
19. [Alkohol](#19-alkohol)
20. [Psykologisk stress](#20-psykologisk-stress)
21. [Temperatur og klima](#21-temperatur-og-klima)
22. [Injektionssted](#22-injektionssted)

**Del 5: Komplikationer og faresignaler**
23. [Ketonstoffer og diabetisk ketoacidose](#23-ketonstoffer-og-diabetisk-ketoacidose)
24. [Insulinoverdosis og kontrareguleringens begrænsninger](#24-insulinoverdosis-og-kontrareguleringens-begrænsninger)
25. [Ikke-linearitet i insulinvirkning -- tærskeleffekter](#25-ikke-linearitet-i-insulinvirkning--tærskeleffekter)

**Del 6: Teknologi og forskningsmodeller**
26. [CGM-teknologi -- kontinuerlig glukosemaling](#26-cgm-teknologi--kontinuerlig-glukosemaling)
27. [Matematiske modeller brugt i forskningen](#27-matematiske-modeller-brugt-i-forskningen)

---

# Del 1: De grundlæggende processer

Disse processer er fundamentet for al blodsukkerstyring. De korer hele tiden i kroppen og danner grundlaget for alt det der folger i resten af dokumentet.

---

## 1. Hvordan glukose bevæger sig i kroppen

**Aktiv i simulatoren (Hovorka 2004-modellen)**

Glukose -- det sukker kroppen bruger som brændstof -- befinder sig ikke bare et sted i kroppen. Det fordeles mellem to "rum":

**Blodet (plasmaglukose):** Det er her vi maler blodsukkeret, og det er herfra hjernen, musklerne og alle organer henter deres energi. Nar du tager en blodsukkermaling, er det glukosekoncentrationen i dette rum du ser.

**Kroppens væv (muskler, fedtvæv m.m.):** Glukose bevæger sig lidt langsommere hertil fra blodet. Det sker dels ved simpel diffusion, dels ved insulinstyret transport. Man kan tænke pa det som en buffer -- nar blodsukkeret stiger, trækker vævene glukose til sig, og nar det falder, afgiver de det igen.

Udvekslingen mellem de to rum bestemmer hvor hurtigt blodsukkeret ændrer sig efter et maltid eller en insulindosis. Glukosekoncentrationen i blodet beregnes ud fra mængden af glukose og kroppens størrelse (distributionsvolumen er ca. 0.16 liter per kilo kropsvægt).

I simulatoren er dette modelleret med Hovorkas tokammer-model, der beskriver strommen af glukose mellem blod og væv med matematiske ligninger. Det er denne model der "kender" dit blodsukker i spillet.

> **Kilde:** Hovorka R, Canonico V, Chassin LJ, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

---

## 2. Insulin -- fra injektion til virkning

**Aktiv i simulatoren (Hovorka 2004 subkutan model)**

Nar du injicerer insulin, sker der ikke noget med det samme. Insulinet skal forst rejse fra det subkutane fedtvæv (der hvor nalen sætter det) og ind i blodet, og derefter fra blodet ud til de celler der skal bruge det. Hele denne proces tager tid -- og det er derfor timing er sa vigtigt ved type 1 diabetes.

### Fra injektion til blodet

Insulinet injiceres under huden, hvor det danner et lille depot. Herfra absorberes det gradvist ind i blodbanen. For hurtigvirkende insulin som NovoRapid nar absorptionen sit hojdepunkt efter ca. 110 minutter (knap 2 timer). Det er derfor man anbefaler at give bolus 15-20 minutter for et maltid -- sa insulinet er "klar" nar glukosen fra maden begynder at ramme blodet.

### Fra blodet til virkning

Selv nar insulinet er i blodet, virker det ikke med det samme. Det skal forst binde sig til receptorer pa cellerne og sætte en kæde af signaler i gang. Denne forsinkelse er modelleret med tre parallelle "effektkanaler":

1. **Glukosetransport** -- insulin hjælper glukose med at komme fra blodet ind i musklerne
2. **Glukoseforbrug** -- insulin oger musklernes forbrænding af glukose
3. **Leverens glukoseproduktion** -- insulin bremser leverens frigivelse af glukose

De tre kanaler har lidt forskellige hastigheder, og tilsammen giver de den brede, gradvise insulinvirkning vi kender klinisk.

### Insulintyper

Forskellige insulinpræparater har vidt forskellige profiler:

| Type | Kategori | Virker efter | Hojdepunkt | Varighed |
|------|----------|-------------|------------|----------|
| NovoRapid (aspart) | Hurtigvirkende | 10-20 min | 1-2 timer | 3-5 timer |
| Humalog (lispro) | Hurtigvirkende | 10-15 min | 1-2 timer | 3-4 timer |
| Fiasp (faster aspart) | Ultrahurtig | 2-5 min | 1-1.5 timer | 3-4 timer |
| Lantus (glargin) | Langvirkende | 1-2 timer | Næsten flad | ca. 24 timer |
| Tresiba (degludec) | Ultralangvirkende | 1-2 timer | Næsten flad | over 42 timer |

Jo hurtigere insulinet virker, jo nemmere er det at matche et maltid -- men ogsa jo nemmere er det at lave fejl. Langvirkende insulin dækker kroppens basale behov og skal helst give en jævn baggrundsdækning.

> **Kilder:**
> - Hovorka et al. (2004), se ovenfor.
> - Heise T, et al. (2015). "Pharmacokinetic and pharmacodynamic properties of faster-acting insulin aspart versus insulin aspart across a clinically relevant dose range." *Clinical Pharmacokinetics*, 56(6):649-660.

---

## 3. Kulhydrater -- fra mund til blodsukker

**Aktiv i simulatoren (Hovorka 2004 tarmmodel)**

Nar du spiser kulhydrater, gennemgar de en rejse for de pavirker blodsukkeret:

1. **Tygning og mavesæk:** Maden nedbrydes mekanisk og enzymatisk. Mavesækken slipper maden ud i tyndtarmen med en hastighed pa 1-4 kcal per minut. Denne mavetomningshastighed er faktisk den faktor der oftest begrænsende for, hvor hurtigt blodsukkeret stiger.

2. **Tyndtarmen:** Her absorberes glukosen og transporteres via blodet til leveren, og derfra ud i resten af kroppen.

Ikke al kulhydrat bliver til glukose i blodet. Ca. 80% absorberes (resten passerer videre eller forbruges af tarmens egne celler). For hurtige kulhydrater som hvidt brod eller juice nar glukosen blodet efter ca. 20-30 minutter. For langsomme kulhydrater som fuldkorn eller bælgfrugter kan det tage 60-90 minutter.

### Glykæmisk indeks -- hvad det egentlig handler om

Glykæmisk indeks (GI) er i bund og grund et mal for, hvor hurtigt maden tommes fra mavesækken og fordojes. Fodevarer med lavt GI (fuldkorn, bælgfrugter) giver et lavere og bredere blodsukker-peak. Fodevarer med hojt GI (hvidt brod, juice) giver et hojt, spidst peak. For T1D-patienter betyder det, at insulintimingen skal tilpasses madens type -- ikke kun mængden af kulhydrat.

> **Kilder:**
> - Hovorka et al. (2004), se afsnit 1.
> - Haidar A, et al. (2014). "Mathematical Model of Glucose-Insulin Metabolism in Type 1 Diabetes Including Digestion and Absorption of Carbohydrates." *SICE Journal of Control, Measurement, and System Integration*, 7(6):314-325.
> - Bornhorst GM, et al. (2016). "A mechanistic model of intermittent gastric emptying and glucose-insulin dynamics following a meal containing milk components." *PLOS ONE*, 11(6):e0156443.

---

## 4. Fedt og protein -- de glemte makronæringsstoffer

**Delvist modelleret**

De fleste nydiagnosticerede lærer at tælle kulhydrater -- men fedt og protein pavirker ogsa blodsukkeret. Det ved mange ikke, og det kan fore til uforklarlige blodsukkerstigninger timer efter et maltid.

### Fedt forsinker mavetomningen

Fedt i et maltid bremser mavetomningen markant. Mekanismen er, at fedtet udloser hormoner fra tyndtarmen (GLP-1, GIP og cholecystokinin) som signalerer til mavesækken om at bremse. Resultatet er, at kulhydraterne fra det samme maltid absorberes langsommere -- blodsukkeret stiger senere, men ogsa over længere tid. Et fedtholdigt maltid (fx pizza) kan derfor give et blodsukker-peak 3-4 timer efter spisning, hvor et fedtfattigt maltid med samme kulhydratmængde ville peake efter 1-2 timer.

### Protein bidrager til glukose

Ca. 50-60% af aminosyrerne i protein er "glukogene" -- de kan omdannes til glukose i leveren. Den klinisk relevante effekt er:

- Ca. 20-35% af proteinets energi ender som glukose
- Effekten er forsinket 3-5 timer efter maltidet
- Den lægges oven i kulhydraternes bidrag

Et studie med born med T1D viste, at tilfojelse af 35 gram protein til 30 gram kulhydrat ogede den samlede blodsukkerstigning med 49% i tidsvinduet 3-5 timer efter maltidet.

### Fat-Protein Units (FPU) -- en praktisk tommelfingerregel

Klinisk bruges FPU-konceptet til at beregne ekstra insulin til fedt og protein:
- 1 FPU = 100 kcal fra fedt og protein
- 1 FPU svarer til ca. 10 gram kulhydrat i insulinbehov, men med 3-5 timers forsinkelse

Et randomiseret studie viste, at fedt- og proteinrige maltider krævede 47% mere insulin end ren kulhydrattælling ville tilsige. Det er derfor mange erfarne T1D-patienter ogsa "tæller" fedt og protein i store maltider.

> **Kilder:**
> - Smart CEM, et al. (2013). "Both dietary protein and fat increase postprandial glucose excursions in children with type 1 diabetes, and the effect is additive." *Diabetes Care*, 36(12):3897-3902.
> - Bell KJ, et al. (2020). "Insulin dosing for fat and protein: Is it time?" *Diabetes Care*, 43(1):13-15.
> - Dalla Man C, et al. (2025). "Simulation of High-Fat High-Protein Meals Using the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.

---

## 5. Leverens glukoseproduktion

**Aktiv i simulatoren (Hovorka 2004 + stresshormoner)**

Leveren er kroppens "glukosefabrik." Selv nar du ikke spiser, holder leveren blodsukkeret oppe ved konstant at frigive glukose til blodet. Den gor det pa to mader:

**Glykogenolyse (nedbrydning af glykogenlagre):** Leveren lagrer ca. 80-100 gram glukose som glykogen -- en slags stivelse-lignende lager. Denne reserve kan mobiliseres hurtigt (pa minutter) og er kroppens forste forsvar mod lavt blodsukker.

**Glukoneogenese (nydannelse af glukose):** Leveren kan ogsa bygge glukose fra bunden, ud fra laktat, aminosyrer og glycerol. Denne proces er langsommere men har praktisk talt ubegrænset kapacitet, sa længe der er ravarestoffer.

Til daglig producerer leveren ca. 160 mg glukose per minut for en person pa 70 kg. Det er nok til at holde blodsukkeret stabilt mellem maltiderne.

### Insulin bremser leveren

Insulin er leverens vigtigste signal om at bremse glukoseproduktionen. Ved normale basale insulinniveauer producerer leveren ca. 40-60% af sin maksimale kapacitet. Nar du giver en bolus og insulinniveauet stiger, undertrykkes leverens produktion næsten fuldstændigt. Det er en af de tre mader insulin sænker blodsukkeret pa.

### Stresshormoner speeder leveren op

Kontraregulatoriske hormoner (adrenalin, glukagon, kortisol -- se afsnit 11) gor det modsatte af insulin: de far leveren til at producere mere glukose. Det er kroppens forsvarsmekanisme mod lavt blodsukker, men det er ogsa grunden til at stress, sygdom og morgenens dawn-fænomen kan drive blodsukkeret op.

> **Kilde:** Hovorka et al. (2004). Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *Journal of Clinical Investigation*, 64(1):62-71.

---

## 6. Nyrernes rolle -- en naturlig sikkerhedsventil

**Aktiv i simulatoren (Hovorka 2004)**

Nyrerne filtrerer blodet konstant, og normalt genoptager de al glukosen -- intet gar tabt i urinen. Men der er en grænse. Nar blodsukkeret overstiger den sakaldte "renale tærskel" (ca. 9 mmol/L, men varierer fra 6-14 mmol/L mellem personer), kan nyrernes transportere ikke folge med, og glukose begynder at sive ud i urinen.

Det er en naturlig "sikkerhedsventil" der sætter et loft pa, hvor hojt blodsukkeret kan stige. Men den har en pris: glukosen trækker vand med sig ud i urinen (osmotisk diurese), hvilket forer til:

- Hyppig vandladning
- Torst
- Dehydrering

Disse er de klassiske symptomer pa ubehandlet eller darligt reguleret diabetes. Nar blodsukkeret er vedvarende hojt, taber kroppen bogstaveligt talt energi og vand med urinen.

> **Kilder:**
> - Hovorka et al. (2004).
> - Johansen OE, et al. (1984). "Variations in renal threshold for glucose in Type 1 diabetes mellitus." *Diabetologia*, 26(3):180-183.
> - NCBI StatPearls. "Physiology, Glycosuria."

---

## 7. Hjernens glukoseforbrug

**Aktiv i simulatoren (Hovorka 2004)**

Hjernen er kroppens storste glukoseforbruger i hvile -- den bruger ca. 120 gram glukose om dagen (ca. 5 gram i timen), selv om den kun udgor 2% af kropsvægten. Det vigtige er, at hjernens glukoseoptag er næsten uafhængigt af insulin. Hjernen har sine egne transportere (GLUT1 og GLUT3) der henter glukose direkte fra blodet.

Men nar blodsukkeret falder, falder hjernens glukoseforsyning ogsa. Hjernens transportere mættes ved lave koncentrationer, og ved svær hypoglykæmi (under ca. 2.5 mmol/L) kan hjernen ikke opretholde normal funktion. Det er derfor hypoglykæmi giver symptomer som:

- Koncentrationsbesvær og forvirring
- Synsforstyrrelser
- Kramper
- Bevidsthedstab

Og i yderste konsekvens: dod. Hjernens totale afhængighed af glukose er den fundamentale grund til, at lavt blodsukker er akut farligt.

> **Kilde:** Hovorka et al. (2004). Magistretti PJ, Allaman I. (2015). "A cellular perspective on brain energy metabolism and functional imaging." *Neuron*, 86(4):883-901.

---

# Del 2: Fysisk aktivitet

Motion er en af de mest komplicerede faktorer at handtere for T1D-patienter, fordi den pavirker blodsukkeret pa mange mader samtidig -- og fordi aerob og anaerob motion har helt modsatte akutte effekter.

---

## 8. Aerob motion -- lob, cykling, svomning

**Aktiv i simulatoren (Resalat 2020 udvidet Hovorka-model)**

Aerob motion er den type motion de fleste tænker pa: lob, cykling, svomning, rask gang. Den samlede effekt er, at blodsukkeret falder -- men mekanismerne bag er overraskende komplekse.

### Musklerne henter glukose uden insulin

Nar muskler arbejder, aktiverer de en signalvej (AMPK) der transporterer glukose ind i muskelcellerne helt uden insulins hjælp. Det sker via GLUT4-transportere der flyttes til cellens overflade af selve muskelkontraktionen. Det er derfor motion kan sænke blodsukkeret selv nar der næsten ikke er insulin i kroppen -- og det er ogsa derfor motion er sa effektivt.

Denne effekt starter hurtigt (inden for minutter) og stopper relativt hurtigt efter motion ophorer (tidskonstant ca. 20 minutter).

### Insulinfolsomheden forbedres -- i timevis

Ud over det direkte glukoseoptag forbedrer motion ogsa insulins effekt. Musklerne bliver mere folsomme over for den insulin der allerede er i blodet. Denne effekt bygger sig langsomt op og varer i timer efter træning er slut (tidskonstant ca. 200 minutter).

Det er denne langvarige effekt der forklarer, hvorfor mange T1D-patienter oplever lavt blodsukker 4-12 timer efter motion -- ikke kun under selve træningen.

### Insulinet absorberes hurtigere

Oget blodgennemstromning og hojere temperatur i underhuden under motion far insulin til at absorberes hurtigere fra injektionsstedet. Ved en puls pa 120 slag i minuttet oges absorptionshastigheden med ca. 50% sammenlignet med hvile. Det kan betyde, at insulin du har givet for 2 timer siden pludselig "sparker ind" meget kraftigere under motion.

### Forsinket hypoglykæmi -- den skjulte fare

Den forstærkede insulinfolsomhed efter motion varer 2-12 timer. Det betyder, at et træningstapas om eftermiddagen eller aftenen kan give hypoglykæmi midt om natten -- nar du sover og ikke mærker det. Det er en af de vigtigste ting for T1D-patienter at forstå og planlægge efter.

> **Kilder:**
> - Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030.
> - Kudva YC, et al. (2021). "Exercise effect on insulin-dependent and insulin-independent glucose utilization." *Am J Physiol Endocrinol Metab*, 321(2):E230-E237.
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes: a consensus statement." *Lancet Diabetes Endocrinol*, 5(5):377-390.

---

## 9. Anaerob træning -- styrketræning og sprint

**Delvist modelleret (via akut stress)**

Styrketræning, sprint og HIIT (hojintensitetstræning) har en helt anden akut effekt pa blodsukkeret end aerob motion. Mange T1D-patienter bliver overraskede over, at blodsukkeret stiger under styrketræning.

### Blodsukkeret stiger akut

Intensiv anaerob aktivitet udloser en kraftig stressrespons i kroppen. Adrenalin og noradrenalin frigives massivt, og de far leveren til at dumpe store mængder glukose i blodet (via glykogenolyse). Samtidig bremser katekolaminerne musklernes glukoseoptag. Nettoresultatet er, at leverens glukoseproduktion overstiger musklernes forbrug, og blodsukkeret stiger -- typisk med 2-5 mmol/L.

### Blodsukkeret falder timer senere

2-6 timer efter styrketræning vender billedet: musklerne skal genopfylde deres glykogenlagre (de "tanker op"), insulinfolsomheden stiger, og katekolamineffekten er aftaget. Blodsukkeret falder, og risikoen for hypoglykæmi oges.

### Hvad det betyder i praksis

Det forvirrende monster -- stigning under træning, fald timer efter -- far mange til at reagere forkert. Hvis du giver korrektionsinsulin under styrketræning fordi blodsukkeret er hojt, risikerer du hypoglykæmi nogen timer senere, nar den forsinkede effekt sætter ind. Den generelle anbefaling er at vente med korrektion til efter træning og holde oje med blodsukkeret de folgende timer.

> **Kilder:**
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes." *Lancet Diabetes Endocrinol*, 5(5):377-390.
> - Yardley JE, et al. (2013). "Resistance versus aerobic exercise: acute effects on glycemia in type 1 diabetes." *Diabetes Care*, 36(3):537-542.

---

## 10. Motionsinduceret inflammation -- nar motion gor ondt

**Ikke implementeret**

De fleste forbinder motion med bedre insulinfolsomhed -- og det er ogsa hovedreglen. Men der er en vigtig undtagelse: overdreven eller uvant motion kan midlertidigt oge insulinbehovet i stedet for at reducere det.

### Mekanismen

Intense eller langvarige træningstapas (maraton, uvant styrketræning, overtraining) forårsager mikroskopisk muskelskade. Kroppen sender reparationshold i form af betændelsesceller og signalstoffer:

1. Proinflammatoriske cytokiner (IL-6, TNF-alfa, IL-1-beta) frigives -- IL-6 kan stige op til 100 gange over normalniveau under motion
2. Leveren starter en akutfaserespons
3. Cytokinerne hæmmer insulins signalveje i musklerne
4. Effekten kan vare 24-72 timer

### Paradokset

- **Moderat, regelmæssig motion:** Antiinflammatorisk pa lang sigt -- forbedrer insulinfolsomheden
- **Overdreven eller uvant motion:** Proinflammatorisk pa kort sigt -- oger insulinbehovet i dage efter

Overgangen afhænger af din træningstilstand. En 10 km lobetur kan give markant inflammation hos en utrænet person men næsten ingen effekt hos en trænet lober.

### Hvad det betyder for T1D

- Efter en usædvanligt hard træning kan insulinbehovet stige 10-30% i 1-2 dage
- Muskelomhed (DOMS -- delayed onset muscle soreness) er ofte ledsaget af oget insulinresistens
- Det er vigtigt at skelne dette fra den normale post-exercise insulinfolsomhed der sker efter moderat motion

> **Kilder:**
> - Pedersen BK, Febbraio MA. (2008). "Muscle as an endocrine organ: focus on muscle-derived interleukin-6." *Physiol Rev*, 88(4):1379-1406.
> - Petersen AMW, Pedersen BK. (2005). "The anti-inflammatory effect of exercise." *J Appl Physiol*, 98(4):1154-1162.

---

# Del 3: Hormoner og dognrytme

Blodsukkeret pavirkes ikke kun af mad, insulin og motion. Kroppens egne hormoner spiller en stor rolle -- og mange af dem folger dognrytmer der kan forklare tilsyneladende "uforklarlige" blodsukkermonstre.

---

## 11. Kontraregulatoriske hormoner -- kroppens forsvar mod lavt blodsukker

**Aktiv i simulatoren (to-lags stresssystem)**

Kroppen har et hierarkisk forsvarssystem der aktiveres nar blodsukkeret falder. Det er designet til at forhindre, at hjernen lober tor for brændstof. Systemet består af fire hormoner, der aktiveres i en bestemt rækkefølge:

### Glukagon -- forste forsvarslinje

Glukagon frigives fra bugspytkirtlens alfa-celler nar blodsukkeret falder under ca. 3.8 mmol/L. Det virker hurtigt (inden for 2-5 minutter) og far leveren til at frigive glukose fra sine glykogenlagre. Glukagon kan oge leverens glukoseproduktion 3-5 gange over det basale niveau.

**Vigtigt for T1D:** Hos de fleste T1D-patienter er glukagonresponset svækket eller helt fraværende efter 5 eller flere ars sygdom. Det skyldes, at den autoimmune proces der odlægger betacellerne ogsa pavirker alfacellerne. Det betyder, at T1D-patientens vigtigste akutte forsvar mod lavt blodsukker mangler.

### Adrenalin -- det sekundære forsvar

Adrenalin aktiveres nar blodsukkeret falder under ca. 3.6 mmol/L. Det stimulerer leverens glukoseproduktion og reducerer musklernes glukoseoptag. Adrenalin er ogsa det hormon der giver de velkendte advarselssymptomer: svedtendens, hjertebanken, rysten og sultfolelse.

Hos T1D-patienter med "hypoglykæmi-unawareness" (manglende evne til at mærke lavt blodsukker) er ogsa adrenalinresponset svækket. Det skaber en farlig situation hvor patienten hverken har glukagon eller adrenalin som forsvar.

### Kortisol -- det langsomme forsvar

Kortisol frigives ved vedvarende hypoglykæmi, stress og sygdom. Det oger leverens glukoseproduktion og reducerer insulinfolsomheden. Men det virker langsomt (1-2 timer) og er derfor ikke nok til at stoppe et akut blodsukker-fald. Til gengæld har det en lang varighed (8-12 timer biologisk virkning).

### Væksthormon

Væksthormon stimulerer fedtforbrænding, reducerer musklernes glukoseoptag og oger leverens glukoseproduktion. Det virker endnu langsommere end kortisol og har størst betydning ved vedvarende hypoglykæmi og under sovn.

### Hvordan det er modelleret i simulatoren

Simulatoren forenkler de fire hormoner til et to-lags system:

- **Akut stress** (adrenalin + glukagon): virker hurtigt, halveres pa ca. 60 minutter
- **Kronisk stress** (kortisol): virker langsomt, halveres pa ca. 12 timer

Tilsammen driver de leverens glukoseproduktion op, hvilket er den primære mekanisme for at modvirke lavt blodsukker.

> **Kilder:**
> - Cryer PE. (2013). "Glucose counterregulatory responses to hypoglycemia." *Pediatric Endocrinology Reviews*, 11(Suppl 1):26-37.
> - Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *J Clin Invest*, 64(1):62-71.

---

## 12. Dawn-fænomenet -- morgenens blodsukkerstigning

**Aktiv i simulatoren (sinusmodel)**

Mange T1D-patienter oplever, at blodsukkeret stiger i de tidlige morgentimer (ca. kl. 04-08) -- uden at de har spist noget, og uden at der har været natlig hypoglykæmi. Det kaldes dawn-fænomenet, og det er en helt normal fysiologisk proces.

### Hvorfor det sker

Kroppen forbereder sig pa at vagne. I de tidlige morgentimer stiger kortisol (stresshormonet) som del af den naturlige dognrytme, og væksthormon frigives pulsatilt under den sene del af sovnen. Begge hormoner:

- Oger leverens glukoseproduktion
- Reducerer insulinfolsomheden

Hos raske mennesker kompenserer bugspytkirtlen automatisk med mere insulin. Hos T1D-patienter mangler denne kompensation, og blodsukkeret stiger typisk 1-3 mmol/L mellem kl. 04 og 08.

### Hvorfor det er vigtigt at forstå

Dawn-fænomenet er ikke patientens skyld. Det er ikke fordi du har spist forkert aftenen for eller givet for lidt insulin. Det er en biologisk proces der kræver aktiv handtering -- enten via hojere basalinsulin i de tidlige morgentimer (muligt med insulinpumpe) eller via et morgenbolus.

I simulatoren er dawn-fænomenet modelleret som en sinusformet kortisolstigning der starter kl. 04, topper kl. 08 og er forsvundet kl. 12. Amplitude svarer til ca. 30% oget leverglukoseproduktion pa toppen.

> **Kilder:**
> - Bolli GB, et al. (1984). "Demonstration of a dawn phenomenon in normal human volunteers." *Diabetes*, 33(12):1150-1153.
> - Porcellati F, et al. (2013). "Thirty years of research on the dawn phenomenon: lessons to optimize blood glucose control in diabetes." *Diabetes Care*, 36(12):3860-3862.

---

## 13. Somogyi-effekten -- rebound efter natlig hypoglykæmi

**Aktiv i simulatoren (via automatisk akut stress ved hypoglykæmi)**

Somogyi-effekten beskriver det fænomen, at natlig hypoglykæmi kan efterfolges af morgenhyperglykæmi. Mekanismen er:

1. Blodsukkeret falder under ca. 3.5 mmol/L om natten
2. Kontraregulatoriske hormoner frigives massivt
3. Leverens glukoseproduktion oges kraftigt
4. Blodsukkeret stiger hurtigt og overshooter til hyperglykæmisk niveau

Resultatet er, at patienten vagner med hojt blodsukker -- og den naturlige reaktion er at oge insulindosis, hvilket paradoksalt nok kan forstærke problemet ved at forårsage endnu dybere natlig hypoglykæmi.

### Er det virkelig sa almindeligt?

Somogyi-effektens kliniske relevans er omdiskuteret. Nyere studier med CGM (kontinuerlig glukosemaling) viser, at de fleste tilfælde af morgenhyperglykæmi faktisk skyldes dawn-fænomenet eller utilstrækkelig basalinsulin -- ikke rebound fra natlig hypoglykæmi. Effekten eksisterer fysiologisk, men dens praktiske betydning er muligvis overvurderet. CGM har gjort det muligt at skelne de to -- ser man et natligt dyk efterfulgt af stigning, er det Somogyi; ser man en gradvis stigning fra kl. 04, er det dawn.

> **Kilder:**
> - Guillod L, et al. (2007). "Nocturnal hypoglycaemias in type 1 diabetic patients: what can we learn with continuous glucose monitoring?" *Diabetes Metab*, 33(5):360-365.
> - NCBI StatPearls. "Somogyi Phenomenon."

---

## 14. Dognvariation i insulinfolsomhed

**Ikke implementeret (planlagt)**

Ud over dawn-fænomenet varierer kroppens insulinfolsomhed over hele dognet:

- **Om morgenen (ca. kl. 08:30):** Insulinfolsomheden er lavest -- op til 30-40% lavere end gennemsnittet. Du har brug for mere insulin per gram kulhydrat til morgenmaden end til aftensmaden.
- **Om aftenen (ca. kl. 19:00):** Insulinfolsomheden er hojest. Samme insulindosis har en storre effekt.

Denne variation skyldes det cirkadiske system (kroppens indre ur) der styrer kortisolrytme, væksthormon, det autonome nervesystem og leverens insulinnedbrydning.

### Hvad det betyder i praksis

- Insulin-til-kulhydrat-ratioen (ICR) bor ideelt set være lavere om morgenen (mere insulin per gram kulhydrat) og hojere om aftenen
- Mange insulinpumper programmeres med 2-3 forskellige basalrater over dognet
- Det forklarer ogsa, hvorfor det kan være lettere at holde blodsukkeret stabilt om aftenen end om morgenen

> **Kilder:**
> - Saad A, et al. (2012). "Diurnal pattern to insulin secretion and insulin action in healthy individuals." *Diabetes*, 61(11):2691-2700.
> - Hinshaw L, et al. (2013). "Diurnal pattern of insulin action in type 1 diabetes." *Diabetes*, 62(7):2223-2229.
> - Scheiner G. (2020). *Think Like a Pancreas: A Practical Guide to Managing Diabetes with Insulin*. 3rd ed. Da Capo Lifelong Books.

---

## 15. Menstruationscyklus og insulinbehov

**Ikke implementeret (planlagt)**

For kvinder med T1D er menstruationscyklussen en ofte overset faktor i blodsukkerreguleringen. Konshormoner har en markant effekt pa insulinfolsomheden, og mange kvinder oplever tilbagevendende perioder med "uforklarligt" hojt blodsukker.

### Follikulærfasen (dag 1-14 i cyklussen)

I forste halvdel af cyklussen dominerer ostrogen. Insulinfolsomheden er normal til let forhojet, og blodsukkerkontrol er relativt stabil. Det er ofte den "gode" periode.

### Lutealfasen (dag 15-28)

I anden halvdel stiger progesteron markant, og det har en direkte negativ effekt pa insulins signalveje i cellerne. Forskning viser, at insulinfolsomheden kan falde med op til 50%. Et studie malte et fald i insulinfolsomhedsindeks fra 5.03 til 2.22 -- mere end en halvering.

Klinisk betyder det, at mange kvinder med T1D har brug for 15-30% mere insulin i ugen op til menstruation. Nar menstruationen starter og progesteron falder, normaliseres insulinfolsomheden -- og der er risiko for hypoglykæmi hvis insulindosis ikke reduceres igen.

### Hvad det betyder i praksis

- For at mestre blodsukkeret er det vigtigt at kende sin cyklus og anticipere behovsændringer
- En cyklusdagbog kombineret med blodsukkerdata kan afsløre individuelle monstre
- Nogle kvinder justerer deres basalrate med 10-20% op i lutealfasen

> **Kilder:**
> - Yeung EH, et al. (2024). "Menstrual Cycle Effects on Insulin Sensitivity in Women with Type 1 Diabetes: A Pilot Study." *Diabetes Care*.
> - Trout KK, et al. (2023). "Menstrual Cycle, Glucose Control and Insulin Sensitivity in Type 1 Diabetes: A Systematic Review." *J Pers Med*, 13(2):374.
> - Kelliny C, et al. (2014). "Alteration of insulin sensitivity by sex hormones during the menstrual cycle." *Physiol Rev*, 94(3):793-834.

---

## 16. Sæsonvariation

**Ikke implementeret (lav prioritet)**

Insulinbehovet varierer ogsa med arstiderne, selv om det kan være svært at adskille fra ændringer i adfærd.

### Vinter

HbA1c er typisk hojere om vinteren. Et studie med T1D-unge viste 9.1% om vinteren versus 7.7% om sommeren. Mulige forklaringer omfatter: reduceret fysisk aktivitet, oget kalorieindtag, reduceret D-vitaminsyntese og kortere dage der kan pavirke kroppens dognrytme.

### Sommer

Insulinbehovet er typisk lavere om sommeren. Oget fysisk aktivitet og varme accelererer insulinabsorption. Til gengæld er der ogsa flere episoder med lavt blodsukker -- kombinationen af bedre insulinfolsomhed og hurtigere absorption er en risikofaktor.

Sæsonvariationen er sandsynligvis en kombination af fysiologiske og livsstilsfaktorer og er svær at isolere i kontrollerede studier.

> **Kilde:** Mianowska B, et al. (2011). "HbA1c levels in schoolchildren with type 1 diabetes are seasonally variable and dependent on weather conditions." *Diabetologia*, 54(4):749-756.

---

# Del 4: Livsstil og ydre faktorer

Ud over de fysiologiske processer er der en række livsstils- og miljøfaktorer der pavirker blodsukkeret -- ofte pa mader der overrasker nydiagnosticerede.

---

## 17. Sygdom og infektion

**Delvist modelleret (via kronisk stress)**

Nar kroppen bekæmper en infektion, stiger insulinbehovet markant. Det er en af de hyppigste arsager til uventet hojt blodsukker og -- i værste fald -- ketoacidose.

### Hvorfor sygdom driver blodsukkeret op

**Cytokiner (betændelsesstoffer):** Immunsystemet frigiver signalstoffer som TNF-alfa, IL-1 og IL-6 nar det bekæmper infektion. Disse stoffer hæmmer insulins signalveje i musklerne og oger leverens glukoseproduktion. Effekten er en direkte, fysiologisk insulinresistens.

**Stresshormoner:** Sygdom aktiverer stressresponsen. Kortisol, adrenalin og væksthormon stiger alle, og de modvirker alle insulin (se afsnit 11).

**Feber:** Feber i sig selv oger stofskiftet med ca. 10-13% per grad over 37 grader Celsius. Men den dominerende effekt er insulinresistensen fra cytokiner og stresshormoner, ikke selve feberen.

### Sygedagsregler for T1D

- Insulinbehovet kan stige 50-100% under akut sygdom
- Mal blodsukker hyppigere (mindst hver 2.-3. time)
- Mal ketoner (se afsnit 23)
- Og basalinsulin med 10-20% (eller mere efter behov)
- Hold væskeindtaget oppe -- dehydrering forværrer situationen
- Risikoen for DKA stiger markant ved sygdom pga. kombinationen af oget insulinbehov og nedsat appetit

> **Kilder:**
> - Dungan KM, et al. (2009). "Stress hyperglycaemia." *Lancet*, 373(9677):1798-1807.
> - Holt RIG, et al. (2024). "Diabetes and infection: review of the epidemiology, mechanisms and principles of treatment." *Diabetologia*.

---

## 18. Sovn og sovnmangel

**Aktiv i simulatoren (natlige interventioner giver kronisk stress og insulinresistens)**

Darlig sovn pavirker blodsukkeret mere end de fleste tror. Forskningen er klar: sovnmangel giver insulinresistens.

### Hvad forskningen viser

- Restriktion til 4-5.5 timers sovn reducerer insulinfolsomheden med 16-24%
- Allerede en enkelt nats darlig sovn giver malbar oget insulinresistens
- Den metaboliske effekt af sovnmangel minder om type 2 diabetes: musklerne optager mindre glukose, leveren producerer mere, og hele systemet fungerer darligere

### Mekanismerne

Sovnmangel forstyrrer kroppen pa flere niveauer:
- Kortisol stiger, især om aftenen (forstyrretet dognrytme)
- Det sympatiske nervesystem (kamp-eller-flugt) er overaktivt
- Kroppens indre ur kommer ud af takt
- Betændelsesmarkorer stiger

### Hvad det betyder for T1D

- Sovnmangel kan forklare uforklarlig morgenhyperglykæmi
- Skifteholdsarbejde er associeret med darligere blodsukkerkontrol
- For optimal regulering anbefales mere end 7 timers sovn
- Kombinationen af sovnmangel og dawn-fænomenet kan give særlig hoj morgen-BG

### Hvordan det fungerer i simulatoren

I spillet modelleres natlige afbrydelser (mellem kl. 22 og 07) som sovnforstyrrelser. Hver gang du vagner for at handtere dit blodsukker, koster det sovnkvalitet. Om morgenen omsættes sovntabet til kronisk stress, som oger insulinresistensen de folgende timer. Ved maksimalt sovntab (4 timer) giver det ca. 24% oget insulinresistens -- hvilket matcher kliniske studier.

> **Kilder:**
> - Spiegel K, et al. (2005). "Sleep loss: a novel risk factor for insulin resistance and Type 2 diabetes." *J Appl Physiol*, 99(5):2008-2019.
> - Donga E, et al. (2010). "Partial Sleep Restriction Decreases Insulin Sensitivity in Type 1 Diabetes." *Diabetes Care*, 33(7):1573-1577.
> - Zheng H, et al. (2017). "Poor Sleep Quality Is Associated with Dawn Phenomenon and Impaired Circadian Clock Gene Expression." *Int J Endocrinol*.

---

## 19. Alkohol

**Ikke implementeret (planlagt)**

Alkohol er en af de mest komplekse og potentielt farlige faktorer for T1D-patienter. Den akutte effekt er det modsatte af hvad mange tror -- alkohol sænker blodsukkeret.

### Den akutte effekt: leveren er optaget

Nar du drikker alkohol, prioriterer leveren at nedbryde alkoholen (som er et giftstof) over alt andet. Det blokerer leverens evne til at producere ny glukose (glukoneogenese) og kan udtomme leverens glykogenlager. Resultatet er, at den glukoseproduktion der normalt holder blodsukkeret oppe mellem maltider, bremses eller stopper helt.

### Den forsinkede fare: 6-12 timer efter

Den mest klinisk farlige effekt er forsinket hypoglykæmi. Moderat alkoholforbrug om aftenen kan udlose hypoglykæmi næste morgen (kl. 07-11), fordi:
- Leverens glykogenlager er delvist tomt
- Glukoneogenesen er stadig hæmmet
- Kontraregulationen (kroppens forsvar mod lavt blodsukker) er ogsa svækket af alkohol

### Med eller uden mad gor en kaompe forskel

- **Med mad:** Moderat alkohol har begrænset effekt pa blodsukkeret
- **Uden mad:** Alkohol kan inducere dyb, farlig hypoglykæmi

### Hvorfor det er sa farligt

Alkohol er en af de hyppigste arsager til svær hypoglykæmi hos unge voksne med T1D. Problemet forstærkes af, at hypoglykæmi-symptomer (forvirring, usikker gang, sloret tale) kan forveksles med beruselse -- bade af patienten selv og af omgivelserne. Det forsinker behandlingen og kan i værste fald være livstruende.

> **Kilder:**
> - Emanuele NV, et al. (2019). "Consequences of Alcohol Use in Diabetics." *Alcohol Health Res World*, 22(3):211-219.
> - Turner BC, et al. (2001). "The effect of evening alcohol consumption on next-morning glucose control in type 1 diabetes." *Diabetes Care*, 24(11):1888-1893.
> - Kerr D, et al. (2007). "Impact of Alcohol on Glycemic Control and Insulin Action." *Biomolecules*, 5(4):2223-2245.

---

## 20. Psykologisk stress

**Delvist modelleret (via kronisk stress)**

Psykologisk stress -- eksaminer, arbejdspres, konflikter, angst -- pavirker blodsukkeret via de samme hormonsystemer som fysisk stress.

### Mekanismerne

**Akut stress (adrenalin):** En stressende situation udloser adrenalin, som far leveren til at frigive glukose. Blodsukkeret kan stige hurtigt.

**Kronisk stress (kortisol):** Langvarig stress holder kortisolniveauet forhøjet, hvilket oger leverens glukoseproduktion og reducerer insulinfolsomheden. Effekten er vedvarende og kan give kronisk forhojet blodsukker.

**Adfærdsmæssig effekt:** Stress ændrer ogsa spisemonstre, sovnkvalitet og motionsvaner -- alle med indirekte effekter pa blodsukkeret.

### Individuel variation

Stressresponsens effekt pa blodsukkeret varierer markant mellem personer. Nogle T1D-patienter oplever primært hyperglykæmi ved stress, andre mærker minimal effekt, og et fatal oplever faktisk hypoglykæmi (pga. ændret spisemonster med nedsat appetit).

> **Kilde:** Surwit RS, et al. (2002). "Stress management improves long-term glycemic control in type 2 diabetes." *Diabetes Care*, 25(1):30-34.

---

## 21. Temperatur og klima

**Ikke implementeret (lav prioritet)**

Omgivelsestemperaturen pavirker insulinabsorption og dermed blodsukkerkontrol -- noget der er særligt relevant pa ferier og ved udendors aktiviteter.

### Varme oger insulinvirkning

- Sauna (85 grader Celsius) oger insulinabsorptionen fra injektionsstedet med 110%, og blodsukkeret falder med 3 mmol/L eller mere
- Lokal opvarmning (40 grader Celsius) reducerer tid til hojeste insulinvirkning fra 111 til 77 minutter
- Mekanismen er vasodilatation -- oget blodgennemstromning i underhuden far insulinet hurtigere ud i blodbanen

### Kulde bremser insulinvirkning

- Afkoling af injektionsstedet reducerer insulinkoncentrationen med over 40% og oger blodsukkeret med ca. 3 mmol/L
- Vasokonstriktion (blodkarrene trækker sig sammen) bremser insulintransporten

### Insulin taler ikke godt varme eller kulde

Insulin er et protein og er folsomt over for temperaturekstremer:
- Under 2 grader Celsius: krystalstrukturen odelaegges irreversibelt
- Over 30 grader Celsius: accelereret nedbrydning
- Direkte sollys: hurtig denaturering

### Hvad det betyder i praksis

- Sommerferie og strandbesog: hurtigere insulinvirkning, risiko for hypoglykæmi
- Vintersport: langsommere insulinvirkning, risiko for hyperglykæmi
- Opbevaring af insulin i varme/kulde kan gore det uvirksomt -- og det kan fore til ketoacidose

> **Kilder:**
> - Berger M, et al. (1981). "A rise in ambient temperature augments insulin absorption in diabetic patients." *Metabolism*, 30(5):393-396.
> - Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.
> - Vimalavathini R, et al. (2021). "Thermal stability and storage of human insulin." *Indian J Med Res*, 154(6):849-857.

---

## 22. Injektionssted

**Delvist modelleret (i simulatorens kompartmentmodel)**

Hvor pa kroppen du sætter din insulininjektion har betydning for, hvor hurtigt insulinet virker. Det er noget mange nydiagnosticerede ikke ved, og det kan forklare uforudsigelig insulinvirkning.

### Absorptionshastighed efter sted

| Sted | Relativ hastighed | Forklaring |
|------|-------------------|------------|
| Maven | 1.0 (hurtigst -- reference) | Tyndest fedtlag, mest blodgennemstromning |
| Overarm | ca. 0.85 | Medium fedtlag |
| Balde | ca. 0.75 | Dybt subkutant depot |
| Lar | ca. 0.70 (langsomst) | Tykkest fedtlag, mindst blodgennemstromning |

### Andre faktorer

- **Lipohypertrofi:** Gentagne injektioner i præcis det samme sted kan danne fedtknuder under huden. Insulin injiceret i en sadan knude absorberes uforudsigeligt -- nogle gange for hurtigt, andre gange slet ikke. Det er en af de hyppigste arsager til "mystisk" blodsukkervariation.
- **Motion i nærliggende muskelgruppe:** Lobetræning oger absorptionen fra laret, armovelser fra overarmen.
- **Massage af injektionsstedet:** Accelererer absorptionen markant.

> **Kilde:** Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.

---

# Del 5: Komplikationer og faresignaler

Denne del dækker de akut farlige situationer ved T1D og de fysiologiske mekanismer bag dem.

---

## 23. Ketonstoffer og diabetisk ketoacidose

**Aktiv i simulatoren (forenklet model)**

Ketonstoffer er et emne der ofte skaber forvirring. De er ikke i sig selv farlige -- faktisk er de en normal del af kroppens energisystem. Men ved insulinmangel kan ketonproduktionen lose lob og blive livstruende.

### Normal ketogenese -- kroppens reservebrændstof

Nar kroppen ikke har nok glukose til rådighed (under faste, ved lav kulhydratindtag), skifter den til at brænde fedt. Fedtsyrerne nedbrydes i leveren, og et biprodukt er ketonstoffer (primært beta-hydroxybutyrat). Hjernen og musklerne kan bruge ketonstoffer som brændstof -- det er en overlevelsesmekanisme der har tjent menneskeheden godt i perioder med fodevareknaphed.

Ved normal faste-ketose stiger ketonerne moderat (0.5-3 mmol/L) og er uskadelige.

### Patologisk ketoacidose (DKA) -- nar det lober lob

Ved absolut insulinmangel -- fx glemt insulin, pumpesvigt eller ny-debut T1D -- sker folgende kaskade:

1. **Ukontrolleret fedtnedbrydning:** Uden insulin er der intet signal om at stoppe. Massive mængder fedtsyrer frigives.
2. **Overproduktion af ketonstoffer:** Leveren producerer langt flere ketonstoffer end kroppen kan forbruge.
3. **Metabolisk acidose:** Ketonstoffer er syrer. Nar de hobber sig op, falder blodets pH -- kroppen bliver bogstaveligt talt sur.
4. **Dehydrering:** Det hoje blodsukker driver glukose og vand ud i urinen (osmotisk diurese).
5. **Elektrolytforstyrrelser:** Natrium og kalium forsvinder med urinen, hvilket kan give hjerterytmeforstyrrelser.
6. **Uden behandling:** Koma og dod.

### Nar skal du reagere?

| Ketonniveau (BHB) | Kategori | Handling |
|--------------------|----------|----------|
| Under 0.6 mmol/L | Normalt | Ingen handling nodvendig |
| 0.6-1.5 mmol/L | Let forhojet | Drik vand, giv insulin, mal igen om 1-2 timer |
| 1.5-3.0 mmol/L | Risiko for DKA | Kontakt læge, giv insulin, drik rigeligt |
| Over 3.0 mmol/L | DKA sandsynlig | Akut sygehusindlæggelse |

### Vigtig skelnen: fasteketose er IKKE det samme som DKA

Ketoner der stiger fordi du faster eller spiser meget lidt kulhydrat er fysiologisk normalt og uskadeligt (sa længe du har insulin i kroppen). DKA er drevet af insulinmangel og er en akut, livstruende tilstand. I simulatoren stiger ketoner aktuelt kun ved insulinmangel kombineret med hojt blodsukker -- fasteketose er endnu ikke modelleret.

> **Kilder:**
> - Kitabchi AE, et al. (2009). "Hyperglycemic Crises in Adult Patients With Diabetes." *Diabetes Care*, 32(7):1335-1343.
> - Dhatariya KK, et al. (2023). "Comprehensive review of diabetic ketoacidosis: an update." *Ann Med Surg*, 85(6):2802-2807.
> - Laffel L. (1999). "Ketone bodies: a review of physiology, pathophysiology and application of monitoring to diabetes." *Diabetes Metab Res Rev*, 15(6):412-426.

---

## 24. Insulinoverdosis og kontrareguleringens begrænsninger

**Aktiv i simulatoren (hypo game over + svækket kontraregulering ved T1D)**

Insulinoverdosis er en af de vigtigste akutte farer ved type 1 diabetes. For at forstå hvorfor det er farligt, er det nodvendigt at forstå, hvad der sker nar blodsukkeret falder -- og hvorfor kroppens forsvarsmekanismer ikke altid er nok.

### Kroppens forsvar hos raske mennesker

Hos raske mennesker aktiveres et hierarki af forsvarsmekanismer nar blodsukkeret falder:

| Blodsukkerniveau | Hvad der sker |
|------------------|---------------|
| Ca. 4.6 mmol/L | Bugspytkirtlen reducerer insulinproduktionen |
| Ca. 3.8 mmol/L | Glukagon og adrenalin frigives -- akut forsvar |
| Ca. 3.7 mmol/L | Kortisol og væksthormon stiger -- langsommere forsvar |
| Ca. 3.2 mmol/L | Symptomer: svedtendens, hjertebanken, sult |
| Ca. 2.8 mmol/L | Neuroglykopeni: forvirring, kramper |

### Hvorfor T1D-patienter er sa sarbare

Ved type 1 diabetes er dette forsvarssystem fundamentalt svækket:

1. **Glukagon er væk:** Hos de fleste T1D-patienter er glukagonresponset svækket eller fraværende efter 5 eller flere ars sygdom. Den vigtigste akutte forsvarslinje mangler.

2. **Adrenalin kan svækkes:** Gentagne episoder med lavt blodsukker "nulstiller" hjernens glukose-sensorer nedad. Det kaldes hypoglykæmi-unawareness (HAAF) og betyder, at kroppen reagerer forst ved endnu lavere blodsukkerniveauer -- eller slet ikke.

3. **Kortisol og væksthormon virker for langsomt:** De tager timer om at have fuld effekt og kan ikke redde en akut situation.

Resultatet er, at en T1D-patient typisk kun har adrenalin som akut forsvar -- og det kan ogsa være svækket.

### Hypoglykæmi-unawareness (HAAF) -- den onde cirkel

HAAF er et syndrom hvor gentagen hypoglykæmi progressivt svækker kroppens respons:

- Hjernens glukose-sensorer "vænner sig" til lavt blodsukker
- Tærsklerne for hormonrespons forskydes nedad
- Advarselssymptomerne forsvinder
- Patienten mærker forst hypoglykæmien nar det allerede er farligt (forvirring, kramper)
- Ca. 25% af T1D-patienter har signifikant HAAF
- Patienter med HAAF har 25 gange oget risiko for svær hypoglykæmi

**Den gode nyhed: HAAF er reversibel.** Forskning viser konsekvent, at 2-3 ugers strikt undgaelse af hypoglykæmi kan genoprette adrenalinresponset og advarsels-symptomerne. Dagogo-Jack et al. (1993) demonstrerede, at tærsklen for hormonrespons steg fra ca. 2.8 mmol/L tilbage mod 3.8 mmol/L. Det vigtige er dog, at enhver ny hypoglykæmi under recovery-perioden kan genaktivere HAAF.

Glukagonresponset (som er tabt pga. betacelle-destruktion) genoprettest derimod ikke -- det er permanent tabt.

### Hvad siger forskningen om dosis?

Der er ingen enkel "dodelig dosis" for insulin -- udfald afhænger af mange faktorer: start-blodsukker, aktiv insulin i forvejen, om der er mad i maven, kontraregulationens tilstand og hvor hurtigt der behandles. Studier af intentionelle overdoser viser, at dodsfald primært skyldes forsinket behandling snarere end absolut dosis.

### Hvordan det er modelleret i simulatoren

Simulatoren modellerer den svækkede kontraregulering ved T1D pa tre mader:

1. **Reduceret stressloft:** Akut stress (kontraregulering) er begrænset til 1.0 i stedet for ca. 5.0 som en rask person ville have. Det afspejler tabet af glukagonrespons.

2. **HAAF-model:** En kontinuert model hvor alvorligheden af tidligere hypoglykæmier akkumuleres og reducerer kontraregulationen. Dyb hypoglykæmi (BG 1.5 mmol/L) giver tre gange mere "skade" per minut end mild hypoglykæmi (BG 2.5 mmol/L). Recovery sker gradvist med en halveringstid pa 3 spildage.

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

Dette er et af de mest frustrerende aspekter ved daglig T1D-behandling: insulins virkning er ikke lineær. Det vil sige, at dobbelt sa meget insulin ikke nodvendigvis giver dobbelt sa stor effekt -- og sma doser kan tilsyneladende ikke virke overhovedet.

### Forskellige organer har forskellige tærskler

Insulin virker pa flere organer, men de reagerer ved forskellige insulinkoncentrationer:

| Organ | Hvad insulin gor | Folsomhed |
|-------|-----------------|-----------|
| Lever | Bremser glukoseproduktion | Hoj -- reagerer forst, ved lave niveauer |
| Fedtvæv | Bremser fedtnedbrydning | Hoj -- reagerer ogsa tidligt |
| Muskler | Oger glukoseoptag | Lav -- kræver mere insulin |

Det betyder, at ved lave insulinniveauer bremser leveren allerede sin glukoseproduktion, men musklerne optager stadig ikke glukose effektivt. Nettoresultatet kan være minimal ændring i blodsukkeret, fordi de to effekter delvist ophæver hinanden.

### Den S-formede dosis-respons-kurve

Insulins virkning folger en S-formet (sigmoid) kurve. Det betyder:
- **Under tærskel:** Næsten ingen malbar effekt
- **Omkring tærskel:** Kraftigt stigende effekt
- **Over mætning:** Ekstra insulin giver aftagende ekstra effekt

### Hvad det betyder i dagligdagen

Dette forklarer en meget almindelig T1D-oplevelse:

1. Dit blodsukker er 12 mmol/L. Du giver 1 enhed korrektionsinsulin. Intet sker.
2. Du venter 2 timer og giver 1 enhed mere. Stadig intet.
3. I frustration giver du 2 enheder. Blodsukkeret styrtdykker til 4 mmol/L.
4. I alt 4 enheder har givet en effekt der er langt storre end 4 gange din ISF.

Forklaringen: de forste 2 enheder var under musklernes tærskel og påvirkede primært leveren (som allerede var delvist bremset). De sidste 2 enheder bragte koncentrationen over musklernes tærskel, og det samlede glukoseoptag steg dramatisk.

### Inaktivitet gor det værre

Ved fysisk inaktivitet (stillesiddende dag, sygdom) falder musklernes insulinfolsomhed, og tærsklen rykker endnu hojere. Der skal endnu mere insulin til for musklerne begynder at reagere. Det er derfor "sofadage" kan give sa frustrerende blodsukkerregulering.

### Begrænsning i simulatoren

Hovorka-modellen bruger lineære insulin-effektligninger, som ikke fanger denne tærskeladfærd. Det er en af de vigtigste begrænsninger i den nuværende simulator og en oplagt kandidat til fremtidig forbedring.

> **Kilder:**
> - Rizza RA, et al. (1981). "Dose-response characteristics for effects of insulin on production and utilization of glucose in man." *Am J Physiol*, 240(6):E630-E639.
> - Kolterman OG, et al. (1981). "Receptor and postreceptor defects contribute to the insulin resistance in noninsulin-dependent diabetes mellitus." *J Clin Invest*, 68(4):957-969.
> - Bergman RN. (2005). "Minimal model: perspective from 2005." *Horm Res*, 64(Suppl 3):8-15.
> - Thiebaud D, et al. (1982). "The effect of graded doses of insulin on total glucose uptake, glucose oxidation, and glucose storage in man." *Diabetes*, 31(11):957-963.

---

# Del 6: Teknologi og forskningsmodeller

---

## 26. CGM-teknologi -- kontinuerlig glukosemaling

**Aktiv i simulatoren (forsinkelse + stoj + drift)**

En CGM (Continuous Glucose Monitor) er den sensor mange T1D-patienter bærer pa kroppen for lobende at folge blodsukkeret. Men CGM maler ikke blodsukkeret direkte -- og den forsinkelse og unøjagtighed der er i malingen har betydning for, hvordan man fortolker tallene.

### Hvad CGM faktisk maler

CGM-sensoren sidder i det subkutane fedtvæv og maler glukose i den interstitielle væske (væsken mellem cellerne) -- ikke i blodet. Glukosen skal forst diffundere fra blodbanen ud til sensorens placering, og det tager tid.

### Forsinkelsen er reel

- Gennemsnitlig forsinkelse fra blod til sensor: 5-6 minutter i hvile
- Total forsinkelse inklusiv sensor-processing: 7-11 minutter
- Ved hurtige ændringer (efter maltid, under motion): 10-15 minutter

Det betyder, at nar din CGM viser 5.0 mmol/L og faldende, kan dit faktiske blodsukker allerede være 4.0 mmol/L. Den forsinkelse er kritisk at forstå ved hurtige blodsukkerændringer.

### Nøjagtighed

Moderne CGM-systemer (Dexcom G7, Libre 3) har en gennemsnitlig afvigelse (MARD) pa ca. 8-10%. Ældre modeller (Libre 1) la pa 11-14%. Nøjagtigheden forværres ved hurtige ændringer og i det lave omrade (under 4 mmol/L) -- altsa præcis der, hvor nøjagtighed er mest afgørende.

### Stojkilder

- **Elektronisk stoj:** Random variation fra sensorens elektronik (ca. plus/minus 0.3 mmol/L)
- **Biologisk variation:** Lokalt blodflow, tryk pa sensoren, væskebalance
- **Drift:** Langsom systematisk afvigelse over sensorens levetid (typisk 7-14 dage)

### Hvordan det er modelleret i simulatoren

Simulatoren modellerer CGM-forsinkelsen som et forstordens filter med en tidskonstant pa ca. 7 minutter, plus realistisk stoj og langsom drift. Det giver en CGM-aflæsning der ligner virkeligheden: den "hænger lidt efter" det sande blodsukker og svinger lidt omkring den rigtige værdi.

> **Kilder:**
> - Schrangl P, et al. (2015). "Time Delay of CGM Sensors: Relevance, Causes, and Countermeasures." *J Diabetes Sci Technol*, 9(5):1006-1015.
> - Sinha M, et al. (2017). "A Comparison of Time Delay in Three Continuous Glucose Monitors." *J Diabetes Sci Technol*, 11(5):1001-1007.
> - Ajjan RA, et al. (2018). "Accuracy of flash glucose monitoring and continuous glucose monitoring technologies." *Diabet Vasc Dis Res*, 15(3):175-184.

---

## 27. Matematiske modeller brugt i forskningen

Simulatoren bygger pa Hovorka 2004-modellen, men der findes flere modeller i forskningsverden. Her er en kort oversigt for de videbegærlige:

### Hovorka 2004 (Cambridge-modellen) -- bruges i simulatoren

Den model simulatoren bygger pa. Den bestaar af 11 differentialligninger og er klinisk valideret med over 1000 citationer. Modellen blev udviklet til forskning i lukket kredslobskontrol (kunstig bugspytkirtel) og er en god balance mellem realisme og beregningsmæssig enkelhed.

> Hovorka R, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

### UVA/Padova (Dalla Man 2007/2014)

Den mest anerkendte model i feltet. Den er FDA-godkendt som erstatning for dyreforsog i insulinpumpe-afprovninger. Mere detaljeret end Hovorka (over 300 parametre) og inkluderer inkretinhormoner og glukagon. For kompleks til vores formal, men den videnskabelige guldstandard.

> Dalla Man C, et al. (2007). "Meal simulation model of the glucose-insulin system." *IEEE Trans Biomed Eng*, 54(10):1740-1749.

### Bergman Minimal Model (1979)

Den simpleste validerede model med kun 4 parametre. Bruges primært til analyse af intravenoose glukosetolerancetest (IVGTT), ikke til simulation af daglig T1D-behandling. Historisk vigtig som den forste matematiske model af glukose-insulin-dynamik.

> Bergman RN, et al. (1979). "Quantitative estimation of insulin sensitivity." *Am J Physiol*, 236(6):E667-E677.

### Sorensen (1985)

Den mest detaljerede multi-organ-model med 19 kompartmenter. Inkluderer lever, nyrer, periferi, hjerne og tarm som separate enheder. For kompleks til realtidssimulation, men værdifuld som reference for fysiologisk korrekthed.

> Sorensen JT. (1985). PhD Thesis, MIT.

---

*Sidst opdateret: Marts 2026*

*Dette dokument udvides lobende. Bidrag og rettelser er velkomne. Kontakt os via GitHub: https://github.com/krauhe/t1d-simulator*
