# Fysiologisk Model -- T1D Simulator

*Denne side er den tekniske dokumentation af simulatorens fysiologiske motor.
Den beskriver hvordan hver model er implementeret, hvorfor den er bygget som den er,
og hvilke videnskabelige kilder den hviler på. Dokumentet henvender sig til patienter,
pårørende og sundhedspersonale der ønsker at forstå hvad der sker "under motorhjelmen".*

**Vigtig disclaimer:** T1D Simulator er et uddannelsesspil -- IKKE et medicinsk device.
Brug aldrig simulatoren som grundlag for medicinske beslutninger. Følg altid din læges anbefalinger.

---

## Indhold

1. [Overblik -- Hvad simulerer vi?](#overblik)
2. [Kernemodellen: Hovorka 2004](#kernemodellen)
3. [Glukose -- Kroppens brændstof](#glukose)
4. [Insulin -- Nøglen til cellerne](#insulin)
5. [Mad -- Fra tallerken til blodbane](#mad)
6. [Motion -- Musklerne som glukosesvamp](#motion)
7. [Stresshormoner -- Kroppens modspil](#stresshormoner)
8. [Dawn-fænomenet -- Morgenkortisol](#dawn)
9. [Søvnforstyrrelse -- Natlige indgreb koster](#sovn)
10. [Hypoglykæmi-unawareness (HAAF)](#haaf)
11. [Ketoner og ketoacidose (DKA)](#ketoner)
12. [CGM-simulation -- Sensorens begrænsninger](#cgm)
13. [Variabilitet -- Hvorfor virker det ikke ens hver gang?](#variabilitet)
14. [Vægt og kaloriebalance](#vaegt)
15. [Scoring og game over](#scoring)
16. [Begrænsninger og forbehold](#begraensninger)
17. [Videnskabelige referencer](#referencer)
18. [Open source-software der er brugt](#open-source)

---

<a name="overblik"></a>
## 1. Overblik -- Hvad simulerer vi?

T1D Simulator simulerer glukose-insulin-dynamikken hos en person med type 1 diabetes (T1D).
Simulationen modellerer de vigtigste fysiologiske processer der påvirker blodsukkeret:

1. **Glukose-kinetik** -- hvordan glukose fordeles og forbruges i kroppen
2. **Insulin-farmakokinetik** -- hvordan injiceret insulin optages og virker
3. **Kulhydrat-absorption** -- hvordan mad fordøjes og glukose optages i blodet
4. **Motionseffekter** -- hvordan fysisk aktivitet påvirker blodsukkeret
5. **Stresshormoner** -- hvordan kortisol, adrenalin og glukagon påvirker leveren
6. **Ketonstofskifte** -- hvordan insulinmangel fører til ketoacidose
7. **CGM-simulation** -- realistisk sensor-forsinkelse og støj

Alle disse systemer er forbundet. Insulin sænker blodsukkeret, men motion forandrer
hvor hurtigt insulinet virker. Stresshormoner får leveren til at frigive ekstra glukose.
Søvnmangel gør insulin mindre effektivt. Simulatoren forsøger at fange dette samspil
så realistisk som muligt -- inden for rammerne af et spil.

### Hvordan er simulatoren bygget op?

Simulatoren kører som et ur der "tikker" hvert par sekunder i reel tid. For hvert
tik beregner den:

- Hvor meget insulin der er aktivt i kroppen lige nu
- Hvor meget glukose der kommer ind fra maden
- Hvor meget glukose leveren producerer (påvirket af stresshormoner)
- Hvor meget glukose musklerne optager (påvirket af motion)
- Hvad CGM-sensoren ville vise (med forsinkelse og støj)

Resultatet er et nyt blodsukkerniveau der vises på grafen.

---

<a name="kernemodellen"></a>
## 2. Kernemodellen: Hovorka 2004 (Cambridge-modellen)

### Hvorfor netop denne model?

Simulationens kerne er baseret på **Hovorka et al. (2004)** -- en model udviklet
ved University of Cambridge til forskning i kunstig bugspytkirtel. Vi valgte den fordi:

- **Klinisk valideret** -- testet mod rigtige T1D-patienter i kontrollerede forsøg
- **Veletableret** -- over 1000 citationer i den videnskabelige litteratur
- **Velbalanceret** -- kompleks nok til realistisk adfærd, simpel nok til at køre i realtid i en browser
- **Veldokumenteret** -- alle parametre og ligninger er publiceret

### Modellens grundidé

Hovorka-modellen beskriver kroppen som en række forbundne "rum" (kompartmenter).
Glukose og insulin bevæger sig mellem disse rum med hastigheder bestemt af
differentialligninger -- matematiske udtryk der beskriver *hvordan noget ændrer sig over tid*.

Modellen har 13 tilstandsvariable fordelt på fire subsystemer:

- **Glukose-subsystemet** (2 kompartmenter: plasma og perifere væv)
- **Insulin-subsystemet** (3 kompartmenter: to subkutane depoter og plasma)
- **Insulin-aktions-subsystemet** (3 effektvariable)
- **Tarm-absorptions-subsystemet** (2 kompartmenter)
- **CGM-sensor** (1 variabel med forsinkelse)
- **Motionseffekter** (2 tilstandsvariable)

For den matematisk interesserede: modellen løses med Euler-integration, hvor vi
opdaterer tilstanden hvert minut (simuleret tid):

```
Ny værdi = gammel værdi + ændringsrate * tidsstep
```

Dette er den simpleste numeriske metode, men den er tilstrækkelig præcis for
vores formål. Mere avancerede metoder (fx Runge-Kutta 4) kunne give bedre
præcision, men Euler er hurtigere og helt fin til et spil.

---

<a name="glukose"></a>
## 3. Glukose -- Kroppens brændstof

### Hvad er modelleret?

Glukose i kroppen er fordelt i to "rum":

- **Q1 (plasma):** Glukose i blodet -- det du måler med en blodsukkermåler.
  Blodsukkerniveauet i mmol/L beregnes som Q1 divideret med glukosens
  fordelingsvolumen (ca. 11.2 liter ved 70 kg).

- **Q2 (perifere væv):** Glukose i muskler og fedtvæv. Denne pulje er ikke
  direkte målbar, men spiller en vigtig rolle fordi insulin driver glukose
  fra blodet (Q1) ud i vævene (Q2), og motion øger musklernes optag.

### Hvad påvirker blodsukkeret?

Den centrale ligning for plasma-glukose (Q1) beskriver en balance mellem
alt det der **tilfører** glukose til blodet og alt det der **fjerner** det:

**Tilførsel:**
- *Mad (UG):* Glukose fra tarmen efter et måltid
- *Leveren (EGP):* Leverens glukoseproduktion (stimuleret af stresshormoner,
  hæmmet af insulin)
- *Tilbagestrøm fra væv (k12 * Q2):* Glukose der vender tilbage fra muskler

**Fjernelse:**
- *Hjernens forbrug (F01c):* Hjernen bruger ca. 120 gram glukose om dagen --
  uanset om der er insulin tilstede eller ej. Ved lavt blodsukker reduceres
  forbruget (hjernen får simpelthen ikke nok)
- *Nyrerne (FR):* Over ca. 9 mmol/L begynder nyrerne at udskille glukose i
  urinen. Dette er en naturlig beskyttelsesmekanisme mod ekstremt højt blodsukker
- *Insulin-drevet optag:* Insulin transporterer glukose fra blodet ud i
  muskler og fedtvæv

### Hvorfor er det vigtigt at forstå?

Blodsukkeret er altid resultatet af en **balance** mellem tilførsel og fjernelse.
Når tilførsel overstiger fjernelse, stiger blodsukkeret. Når fjernelse overstiger
tilførsel, falder det. En person med T1D mangler kroppens egen insulin, så uden
injiceret insulin er der intet til at drive glukose ind i cellerne -- og blodsukkeret
stiger ukontrolleret.

### Nøgleparametre (skaleret med kropvægt)

| Parameter | Hvad den gør | Typisk værdi (70 kg) |
|-----------|-------------|----------------------|
| VG | Hvor meget blod glukosen fordeler sig i | 0.16 * vægt = 11.2 L |
| F01 | Hjernens glukoseforbrug per minut | 0.0097 * vægt = 0.68 mmol/min |
| EGP0 | Leverens basale glukoseproduktion per minut | 0.0161 * vægt = 1.13 mmol/min |
| R_thr | Nyretærskel for glukoseudskillelse | 9 mmol/L |

---

<a name="insulin"></a>
## 4. Insulin -- Nøglen til cellerne

### Hvordan virker insulin i modellen?

Når du injicerer insulin under huden, skal det først transporteres til blodet
før det kan virke. Modellen beskriver dette som en rejse gennem flere "stationer":

**Station 1 og 2: Under huden (S1 og S2)**

Insulinet sidder først i et depot under huden (S1) og bevæger sig gradvist
videre til et andet depot (S2). Herfra optages det i blodbanen. Tiden til
maksimal absorption er ca. 55 minutter for hurtigvirkende insulin som NovoRapid.

**Puls-accelereret absorption:** Når hjertefrekvensen stiger (fx under motion),
øges blodgennemstrømningen i det subkutane væv. Det udvasker insulin hurtigere
fra depoterne til blodbanen. Modellen beregner en pulsFaktor:

```
pulsFaktor = 1 + max(0, (puls - hvilepuls) / hvilepuls) × 0.5
```

Ved hvilepuls (60 bpm) er faktoren 1.0 -- ingen ændring. Ved puls 120 er den
1.5 (50% hurtigere absorption), og ved puls 160 er den ca. 1.83. Denne effekt
gælder **al insulin i depotet** -- både bolus og basal. Det er en vigtig grund
til at motion kan føles så kraftig: selv uden nylig bolus har du altid
basal-insulin under huden, og den accelereres også. Kombinationen af
hurtigere insulinabsorption og motionens direkte muskeloptag (se afsnit 6)
giver den markante BG-sænkning mange T1D-patienter oplever under træning.

**Station 3: I blodet (I)**

Fra blodet fordeler insulinet sig med et fordelingsvolumen på ca. 8.4 liter
(ved 70 kg). Kroppen fjerner også insulin fra blodet løbende (elimination).

**Station 4-6: Effekt på glukose (x1, x2, x3)**

Selv når insulinet er i blodet, virker det ikke øjeblikkeligt. Der er en
yderligere forsinkelse fra insulin i blod til den faktiske virkning på glukose.
Tre separate effektvariable modellerer denne forsinkelse:

- **x1 (transport):** Insulin gør det lettere for glukose at komme fra blodet ud
  i musklerne
- **x2 (forbrænding):** Insulin får musklerne til at brænde mere glukose
- **x3 (leversuppression):** Insulin får leveren til at producere mindre glukose

Alle tre følger samme matematiske mønster: `dx = kb × I - ka × x`, hvor `kb × I`
er aktiveringen (jo mere insulin i blodet, jo stærkere signal) og `ka × x` er
den naturlige aftagen over tid. Men de har forskellige hastigheder (ka og kb),
som giver dem lidt forskellige tidsprofiler.

Her er en samlet oversigt over insulins tre effektmekanismer og hvor de optræder
i modellens ligninger:

| Variabel | Effekt | Hvor den virker | I koden |
|----------|--------|-----------------|---------|
| **x1** | **Transport:** flytter glukose fra blod til periferi | dQ1: `-x1 × Q1` (ud af plasma) | Insulin åbner GLUT4-transportører i muskler |
| **x2** | **Forbrænding:** øger musklernes glukoseforbrug | dQ2: `-x2 × Q2` (forbrændes) | Musklerne bruger den glukose de har fået |
| **x3** | **Lever-suppression:** dæmper leverens glukoseproduktion | EGP-formlen (se nedenfor) | Insulin bremser leverens glukose-frigivelse |

### EGP-formlen -- tovtrækning mellem insulin og stresshormoner

Leverens glukoseproduktion (EGP) er en af de vigtigste processer i modellen.
Den styres af en simpel men elegant formel:

```
EGP = EGP_0 × max(0, stressMultiplier - x3)
```

Formlen er en **tovtrækning** mellem to modsatrettede kræfter:

- **stressMultiplier** (normalt ≥ 1.0) trækker OP: "Lever, producer mere glukose!"
  Dette signal kommer fra glukagon, adrenalin, kortisol og dawn-fænomenet.
- **x3** (insulins lever-effekt) trækker NED: "Lever, stop produktionen!"

| Situation | stress | x3 | EGP | Hvad sker der? |
|-----------|--------|----|-----|----------------|
| Normal hvile | 1.0 | 0.3 | EGP_0 × 0.7 | Moderat produktion (normalt) |
| Efter bolus | 1.0 | 1.3 | 0 | Insulin vinder — leveren stopper |
| Hypo + kontraregulering | 1.5 | 1.3 | EGP_0 × 0.2 | Glukagon vinder lidt — leveren frigiver glykogen trods aktiv insulin |
| Insulin-overdosis (T1D) | 1.4 (cap) | 3.0 | 0 | Insulin overvælder alt — BG crasher mod game over |

Formlen fanger det vigtige fysiologiske princip at kontraregulatoriske hormoner
kan "kæmpe imod" insulin i leveren. Ved hypoglykæmi hos en rask person ville
stressMultiplier stige til 3-5 og overvinde selv høj insulin. Men ved T1D er
kontrareguleringen begrænset (cap ved ~1.4) fordi glukagon-responset er tabt —
derfor er en insulinoverdosis langt farligere.

Disse tre effekter (x1, x2, x3) arbejder sammen med lidt forskellige hastigheder.
Det er derfor insulin har en kompleks virkningsprofil -- det starter langsomt,
topper efter 1-2 timer og aftager gradvist over 3-5 timer.

### Insulin-følsomhedsparametre

Hvor kraftigt insulin påvirker de tre processer bestemmes af tre følsomhedsparametre:

| Parameter | Hvad den styrer | Typisk værdi |
|-----------|----------------|---------------|
| SIT | Insulins effekt på transport | 51.2 * 10^-4 L/min/mU |
| SID | Insulins effekt på muskelforbrænding | 8.2 * 10^-4 L/min/mU |
| SIE | Insulins effekt på leversuppression | 520 * 10^-4 1/mU |

Alle tre parametre skaleres med spillerens ISF (Insulin Sensitivity Factor).
En højere ISF betyder at insulin virker kraftigere -- alle tre parametre
multipliceres med en skaleringsfaktor:

```
skaleringsfaktor = spillerens ISF / 3.75
```

Referencen 3.75 mmol/L per enhed er den effektive ISF som Hovorka-modellens
standard-parametre giver. Så en spiller med ISF = 3.0 får en skaleringsfaktor
på 0.80 (lidt mindre følsom end gennemsnittet), og en spiller med ISF = 5.0
får 1.33 (mere følsom).

### Hurtigvirkende vs. langtidsvirkende insulin

**Hurtigvirkende (bolus):** Injiceres som en kort puls over 5 simulerede
minutter. Hovorka-modellens S1- og S2-kompartmenter håndterer resten:
absorption, fordeling og effekt-forsinkelse. Typisk profil: onset 10-15 min,
peak 1-2 timer, varighed 3-5 timer.

**Langtidsvirkende (basal):** Modelleres med en trapez-profil der ramper op
over 4 timer, holder et stabilt plateau i 18 timer, og aftager gradvist.
Total varighed: 24-36 timer (med lidt tilfældig variation, ligesom i
virkeligheden). Basal insulin feedes direkte ind i Hovorka-modellens
insulin-rate -- det giver en langsom, jævn tilførsel.

### IOB -- Insulin On Board

IOB (aktiv insulin i kroppen) beregnes direkte fra Hovorka-modellens
insulin-kompartmenter. Vi viser kun bolus-IOB til spilleren -- basal
insulin er en stabil baggrund der ikke er relevant for doserings-beslutninger.

### Hvorfor er det vigtigt at forstå?

Forståelsen af insulin-farmakokinetik er afgørende for god blodsukkerstyring:

- **Stacking:** Hvis du giver en ny dosis før den forrige er udvirket, får du
  "insulin-stacking" -- mere aktiv insulin end tilsigtet, med risiko for
  hypoglykæmi. IOB hjælper dig med at undgå dette.
- **Timing:** Insulin virker ikke med det samme. Hvis du venter med at give
  insulin til blodsukkeret allerede er højt, vil du være bagud i timer.
- **Variabilitet:** Selv den samme dosis insulin virker ikke ens hver gang.
  Modellen simulerer dette på tre måder:
  1. **Bioavailability (gennemsnit 78%, std 8%):** Ikke al injiceret insulin
     når blodbanen. En del nedbrydes lokalt af proteaser i det subkutane
     væv. Modellen trækker en normalfordelt bioavailability per injektion
     (clamped til 55-95%). Det betyder at af fx 5 enheder injiceret insulin
     når reelt ca. 3.5-4.5 enheder blodet — og det varierer fra gang til gang.
  2. **Absorptionshastighed (CV ~25%):** Tidskonstanten tau_I varierer fra
     injektion til injektion, modelleret med en normalfordeling omkring
     standardværdien (mean 1.0, std 0.25, clamped 0.50-1.60). Det afhænger
     af injektionsdybde, lokalt blodflow, temperatur og evt. lipodystrofi
     (fortykkede områder under huden fra gentagne injektioner). Én injektion
     kan peake efter 35 min, den næste efter 70 min — selv med samme dosis
     og samme sted. Extremer (fx intramuskulær injektion) giver meget
     hurtigere absorption.
  3. **Varighed (basal):** Langtidsvirkende insulins varighed varierer med
     normalfordeling (mean 28 timer, std 3 timer, clamped 22-38 timer).
  Variabiliteten er kalibreret til at matche den intra-individuelle CV
  på 20-30% der er dokumenteret for hurtigvirkende insulinanaloger
  (Heinemann 2002).

---

<a name="mad"></a>
## 5. Mad -- Fra tallerken til blodbane

### Kulhydrat-absorption

Når du spiser kulhydrater, optages de ikke med det samme. Mave-tarm-kanalen
modelleres som to kompartmenter:

- **D1 (maven):** Maden ankommer her og bevæger sig gradvist videre
- **D2 (tyndtarmen):** Herfra optages glukose i blodet

Hastigheden bestemmes af parameteren tau_G (tid til maksimal absorption),
som er sat til 40 minutter. Kun 80% af kulhydraterne optages (bioavailability = 0.8) --
resten passerer uabsorberet.

I praksis betyder det at efter et måltid stiger blodsukkeret gradvist, topper
efter ca. 40-60 minutter og flader ud over 2-3 timer.

### Fedtindhold forsinker absorptionen

Fedt i et måltid forsinker mavetømningen, hvilket gør at kulhydraterne optages
langsommere. I modellen øger fedtindholdet tau_G-værdien, så
absorptionstoppen kommer senere og er lavere -- men varer længere.

Dette er grunden til at en pizza (højt fedtindhold) giver et anderledes
blodsukkerforløb end en skive hvidt brød (lavt fedtindhold), selvom
kulhydratindholdet måtte være det samme.

### Protein-effekt

Protein bidrager også til blodsukker-stigningen, men langsommere og i mindre
grad. Ca. 25% af proteinet konverteres til glukose via glukoneogenese i leveren,
med en forsinkelse på ca. 30 minutter og en absorptionstid på ca. 60 minutter.

Så et måltid med 40 gram protein vil påvirke blodsukkeret som yderligere
10 gram kulhydrater -- bare forsinket med en halv time.

### Hvorfor er det vigtigt at forstå?

- Et måltid med højt fedtindhold kan kræve en anderledes insulinstrategi
  (fx delt bolus eller forsinket bolus)
- Protein-effekten forklarer hvorfor et stykke kød uden tilbehør stadig kan
  påvirke blodsukkeret
- Timing af insulin i forhold til måltid er afgørende: for tidligt giver
  risiko for hypo før maden når blodet, for sent giver et unødvendigt højt peak

---

<a name="motion"></a>
## 6. Motion -- Musklerne som glukosesvamp

### Grundidéen

Motion påvirker blodsukkeret på flere måder samtidig. Modellens motionseffekter
er baseret på udvidelsen beskrevet i **Resalat et al. (2020)**, som tilføjer
to ekstra tilstandsvariable drevet af hjertefrekvens:

- **E1 (kortvarig effekt):** Stiger hurtigt under træning (tidskonstant 20 min),
  falder hurtigt efter. Repræsenterer direkte muskel-glukoseoptag via
  GLUT4-translokation -- en mekanisme der virker UDEN insulin.

- **E2 (langvarig effekt):** Stiger langsomt (tidskonstant 200 min) og falder
  langsomt. Repræsenterer den forstærkede insulinfølsomhed der varer timer
  efter træning er slut.

### Aerob træning (løb, cykling)

Ved aerob træning dominerer to mekanismer:

**1. Direkte muskeloptag (E1) -- virker UDEN insulin:**

Musklerne optager glukose direkte fra blodet under træning via
GLUT4-translokation -- en mekanisme der **ikke kræver insulin**. Fysisk
kontraktion af muskelfibrene alene er nok til at trække GLUT4-transportører
op til celleoverfladen. Jo højere puls, jo mere optag.

I modellen repræsenteres dette af tilstandsvariablen **E1** (kortvarig
motionseffekt). E1 stiger hurtigt når pulsen er over hvileniveau
(tidskonstant 20 min) og falder hurtigt efter træning. E1 trækker glukose
ud af de perifere væv (Q2) direkte:

```
dQ2 = ... - beta × E1 × HR_effect
```

Her er `beta = 0.78` (optag-styrke) og `HR_effect` er den relative
pulsstigning over hvile: `(puls - hvilepuls) / hvilepuls`. Ved puls 120
og hvilepuls 60 er HR_effect = 1.0. Ved puls 160 er den ~1.67.

**2. Forstærket insulinvirkning (E2) -- "exerciseFactor":**

Motion gør insulin mere effektivt. Under og efter træning åbner musklerne
flere kapillærer (øget perfusion), og cellernes insulinreceptorer bliver
mere følsomme. Det betyder at det insulin der allerede er i blodet --
**både bolus og basal** -- pludselig virker kraftigere.

I modellen repræsenteres dette af tilstandsvariablen **E2** (langvarig
motionseffekt). E2 stiger langsomt (tidskonstant 200 min, dvs. ~3.3 timer)
og falder langsomt efter træning. Det er derfor insulinfølsomheden er
forhøjet **timer efter** træning er slut.

E2 påvirker blodsukkeret via **exerciseFactor**, en multiplikator der
forstærker insulins transport-effekt (x1):

```
exerciseFactor = 1 + alpha × E2²
```

Lad os pakke den ud:

- **alpha = 1.79** er en konstant fra Resalat et al. (2020) der bestemmer
  hvor kraftigt motion forstærker insulin.
- **E2** er den akkumulerede langvarige motionseffekt. Den starter på 0
  ved hvile og stiger gradvist under træning.
- **E2²** (E2 i anden potens) giver en progressiv kurve: lidt motion giver
  lidt forstærkning, men meget motion giver *uforholdsmæssigt meget*
  forstærkning. Det afspejler at kroppen åbner stadig flere kapillærer og
  aktiverer flere GLUT4-receptorer jo længere træningen varer.
- Resultatet ganges på **x1** i Q1-ligningen:
  `dQ1 = ... - exerciseFactor × x1 × Q1`
  Så insulin-drevet transport af glukose fra blod til muskler multipliceres
  med exerciseFactor.

**Konkret eksempel:** Efter 60 min moderat løb (puls 130) er E2 ca. 0.45.
exerciseFactor = 1 + 1.79 × 0.45² = 1 + 1.79 × 0.20 = **1.36** -- insulin
virker 36% kraftigere. Efter 2 timer intensiv træning kan E2 nå ~0.8,
og exerciseFactor = 1 + 1.79 × 0.64 = **2.15** -- insulin virker mere end
dobbelt så kraftigt.

**Samlet motionseffekt -- tre mekanismer der stacker:**

Under motion rammes blodsukkeret af tre samtidige mekanismer:

1. **Direkte muskeloptag (E1)** -- insulin-uafhængigt, virker kun under
   træning
2. **Forstærket insulinvirkning (exerciseFactor via E2)** -- forstærker al
   aktiv insulin, varer timer efter træning
3. **Accelereret insulinabsorption (pulsFaktor)** -- hurtigere udvaskning
   fra subkutant depot, gælder al insulin (bolus + basal)

Det er kombinationen af alle tre der giver den voldsomme BG-sænkning
mange T1D-patienter oplever under motion.

Nettoresultat: blodsukkeret **falder** under aerob træning.

### Anaerob træning (styrke, sprint)

Ved høj intensitet udløses en katekolamin-respons (adrenalin). I modellen
tilføjes akut stress (0.02 per simuleret minut ved høj intensitet), som øger
leverens glukoseproduktion. Tallet 0.02 betyder at hvert simuleret minut
med høj intensitet lægger 0.02 til det akutte stressniveau -- efter 10 min
er akutStress = 0.20, hvilket øger leverens glukoseproduktion med 20%.
Stresshormonerne har en halveringstid på ~60 min, så effekten aftager
gradvist efter træning.

Denne stress-effekt kan midlertidigt **overskride** det faldende blodsukker
fra muskeloptaget.

Nettoresultat: blodsukkeret kan **stige akut** under anaerob træning, men
falder efterfølgende når stresshormonerne aftager og den forstærkede
insulinfølsomhed (E2) tager over.

### Puls-model

Pulsen stiger og falder gradvist via eksponentiel udjævning:

- Under motion: halveringstid ca. 2 minutter (hurtig stigning)
- Efter motion: halveringstid ca. 5 minutter (gradvis recovery)

Intensiteten mappes til målpuls:
- Lav: 100 bpm
- Medium: 130 bpm
- Høj: 160 bpm

### Post-exercise insulinfølsomhed

Efter træning er insulinfølsomheden forhøjet i en periode der afhænger
af intensiteten:

| Intensitet | Følsomheds-boost | Varighed efter træning |
|------------|-------------------|------------------------|
| Lav | +50% | 1 * træningsvarighed |
| Medium | +75% | 2 * træningsvarighed |
| Høj | +100% | 4 * træningsvarighed |

Boostet aftager lineært fra maksimum til normal over perioden.

### Hvorfor er det vigtigt at forstå?

- **Hypo-risiko:** Aerob træning med aktiv bolus-insulin kan give alvorlig
  hypoglykæmi. Reducer bolus eller spis ekstra før træning.
- **Forsinket hypo:** 6-12 timer efter intensiv træning kan blodsukkeret
  falde pludseligt, især om natten.
- **Styrketræning er anderledes:** Forvent en akut blodsukkerstigning under
  styrketræning -- det er normalt og forbigående.
- **Motion om aftenen:** Forhøjet insulinfølsomhed om natten øger risikoen
  for natlig hypoglykæmi.

---

<a name="stresshormoner"></a>
## 7. Stresshormoner -- Kroppens modspil

### Grundidéen

Kroppen har et system af hormoner (glukagon, adrenalin, kortisol) der
modarbejder insulins effekt ved at stimulere leverens glukoseproduktion.
Dette er en livsvigtig beskyttelsesmekanisme mod lavt blodsukker --
men det komplicerer også blodsukkerstyringen for T1D-patienter.

### To-lags stresssystem

Modellen skelner mellem to typer stress med vidt forskellige tidshorisonter:

**Akut stress (adrenalin og glukagon)**
- Halveringstid: ca. 60 simulerede minutter
- Udløses af: hypoglykæmi (Somogyi-effekten), intensiv motion
- Virkning: hurtig, kraftig stigning i leverens glukoseproduktion
- Begrænset til maks 0.4 for T1D (glukagon-respons er tabt,
  kun svag adrenalin-respons er tilbage)

**Kronisk stress (kortisol)**
- Halveringstid: ca. 12 simulerede timer
- Udløses af: søvnmangel, sygdom (planlagt fremtidig feature)
- Virkning: langvarig, moderat forhøjelse af leverens glukoseproduktion
  samt øget insulinresistens

### Stress-multiplikatoren

Begge stressniveauer feedes ind i en samlet multiplikator der påvirker
leverens glukoseproduktion (EGP):

```
stressMultiplikator = 1.0 + akutStress + kroniskStress + cirkadiskKortisol
```

Ved normal tilstand (ingen stress) er multiplikatoren 1.0 -- leveren
producerer sin normale mængde glukose. Ved akut stress på 0.4 stiger
den til 1.4 -- leveren producerer 40% mere glukose.

### Samspillet mellem stress og insulin

Den effektive leverproduktion beregnes som:

```
EGP = EGP0 * max(0, stressMultiplikator - x3)
```

Her er x3 insulins bremsende effekt på leveren. Formlen betyder at
stress og insulin "trækker i hver sin retning":

- **Normal dag:** stress = 1.0, x3 = 0.3: EGP = EGP0 * 0.7 (moderat produktion)
- **Efter bolus:** stress = 1.0, x3 = 1.3: EGP = 0 (insulin undertrykker leveren)
- **Hypo + kontraregulering:** stress = 1.4, x3 = 1.3: EGP = EGP0 * 0.1
  (stresshormoner "slår igennem" trods aktiv insulin)
- **Massiv overdosis:** x3 >> stress: EGP = 0 (insulin vinder -- farligt!)

Denne formel er en forbedring i forhold til den originale Hovorka-model,
hvor formlen var EGP0 * stressMultiplikator * (1 - x3). Problemet med den
originale formel var at når x3 oversteg 1.0, blev leverens produktion
klippet til nul -- og stresshormoner kunne aldrig slå igennem. Det betød
at kontraregulering var virkningsløs under hypoglykæmi, hvilket ikke
svarer til virkeligheden.

### Kontraregulering ved T1D -- hvorfor er den så svag?

T1D-patienter har dramatisk svækket kontraregulering. Den vigtigste årsag
er **tabet af glukagonrespons på hypoglykæmi**, som sker overraskende
hurtigt efter diagnosen:

**Tidslinje:**
- Inden for den første måned kan glukagonresponset allerede være nedsat
- Inden for 1-5 år er det fraværende hos de fleste patienter (Gerich 1988)
- Tabet er progressivt og irreversibelt (undtagen ved ø-transplantation)

**Mekanisme -- "switch-off"-hypotesen:**

Alfacellerne (der producerer glukagon) dør **ikke** — de overlever og
fungerer stadig. Problemet er at de mangler det rigtige *signal* til at
reagere på lavt blodsukker. I en normal bugspytkirtel sidder alfa- og
betaceller tæt sammen i øer (islets). Når blodsukkeret falder, **stopper
betacellerne med at secernere insulin**. Dette fald i *lokalt* insulin
er selve signalet til alfacellerne om at frigive glukagon. Betacellerne
co-secernerer også GABA og zink, som normalt hæmmer alfacellerne —
når de stopper, løftes hæmningen.

I T1D er betacellerne ødelagt af immunforsvaret → der er ingen lokal
insulinsekretion at "slukke for" → alfacellerne modtager aldrig
switch-off-signalet → glukagonresponset udebliver. Eksogent insulin
(injiceret under huden) kan ikke replikere dette, fordi det ikke skaber
det lokale, pulserende fald *inde i øen*.

**Bevis for switch-off-hypotesen:** Ø-transplantation (Rickels 2015, 2016)
genopretter delvist glukagonresponset — når betaceller genintroduceres,
vender signalet tilbage.

**Hvad er bevaret:**
- Glukagonrespons på **aminosyrer** (protein) — stadig intakt
- Glukagonrespons på **motion** — delvist bevaret (via katekolaminer)
- **Adrenalinrespons** — initialt bevaret, men kan svækkes af HAAF

**I modellen:** Stress-cap sat til 0.4 (vs. ca. 5.0 hos raske) for at
afspejle dette massive tab. Den praktiske konsekvens: en insulinoverdosis
kan ikke "reddes" af kroppens egen hormon-respons. Spilleren skal lære
at forebygge hypoglykæmi — ikke stole på at kroppen klarer det.

### Hvorfor er det vigtigt at forstå?

- **Somogyi-effekten:** Natlig hypoglykæmi kan udløse kontraregulering der
  giver højt blodsukker om morgenen. Det kan forveksles med for lidt insulin,
  men årsagen er det modsatte -- for MEGET insulin om natten.
- **Motion og stress:** Høj intensitets-træning udløser adrenalin-respons
  der kan give akut blodsukkerstigning, selvom motionen også sænker blodsukker.
- **Sygdom:** Kronisk stress fra sygdom giver øget insulinresistens der
  kan vare hele dagen.

---

<a name="dawn"></a>
## 8. Dawn-fænomenet og cirkadisk insulinfølsomhed

### Hvad er dawn-fænomenet?

Mange T1D-patienter oplever at deres blodsukker stiger om morgenen -- selvom
de ikke har spist noget. Dette skyldes kroppens naturlige kortisol-rytme:
kortisol stiger i timerne før opvågning som del af den cirkadiske rytme,
og kortisol stimulerer leverens glukoseproduktion.

Men dawn-fænomenet er kun halvdelen af historien. Insulinfølsomheden varierer
også over hele døgnet: om morgenen virker insulin dårligere (perifer
insulinresistens), og om aftenen virker det bedre. Disse to mekanismer
arbejder sammen om at gøre morgenerne sværere for T1D-patienter.

### Hybrid model: to mekanismer

Simulatoren modellerer morgeneffekten som en kombination af to separate
fysiologiske processer:

**Mekanisme 1 — HGP-stigning (leverproduktion):**
Kortisol og væksthormon får leveren til at producere mere glukose. BG stiger
uanset insulinniveau. Modelleret via `circadianKortisolNiveau` (sinusbue
kl. 04-12). Spilleren kan korrigere med insulin — insulinet virker normalt.

**Mekanisme 2 — ISF-reduktion (perifer insulinresistens):**
Kroppens celler reagerer dårligere på insulin om morgenen. Samme dosis
sænker BG mindre. Modelleret via `circadianISF` (døgnkurve). Spilleren
skal bruge mere insulin for at opnå samme BG-sænkning.

Den samlede morgeneffekt:
```
Kl. 08 (morgen):  HGP ×1.15  +  ISF ×0.70  →  ~43% mere insulin nødvendigt
Kl. 14 (efterm.): HGP ×1.00  +  ISF ×1.00  →  normalt (baseline)
Kl. 19 (aften):   HGP ×1.00  +  ISF ×1.20  →  ~17% mindre insulin nødvendigt
```

### HGP-komponent (leverproduktion via kortisol)

Kortisol-kurven er modelleret med en symmetrisk sinusbue (kvart-sinus op,
spejlet kvart-sinus ned). Kurven har tre parametre der varierer fra dag til dag:

| Parameter | Mean | Std | Clamp | Beskrivelse |
|-----------|------|-----|-------|-------------|
| Amplitude | 0.15 | 0.03 | [0.05, 0.35] | Hvor kraftig HGP-stigningen er (CV ~20%) |
| Peak-tidspunkt | 08:00 | 30 min | [06:30, 09:30] | Hvornår peak rammer |
| Stigning/fald | ±4 timer | — | — | Symmetrisk: stiger 4t før peak, falder 4t efter |

```
HGP-komponent (amplitude ~0.15, peak 08:00):

  0.15 |         ^ peak kl. 08:00
       |       /   \
  0.08 |     /       \
       |   /           \
  0.00 |---              ---------------
       +----------------------------> tid
      00   04   08   12   16   20   24
```

Amplituden var tidligere 0.30 da den alene dækkede hele morgeneffekten.
Den er reduceret til 0.15 fordi den anden halvdel nu håndteres af ISF-kurven.

### ISF-komponent (cirkadisk insulinfølsomhed)

Insulinfølsomheden varierer over hele døgnet — ikke bare om morgenen.
Kurven bruger cosinus-interpolation mellem kontrolpunkter for glatte overgange:

| Kl. | ISF-faktor | Betydning |
|------|-----------|-----------|
| 00:00-04:00 | 1.20 | Nat: høj følsomhed |
| 04:00→08:00 | 1.20→0.70 | Dawn-drop: følsomheden falder markant |
| 08:00 | 0.70 | Morgen nadir: lavest følsomhed |
| 08:00→14:00 | 0.70→1.00 | Gradvis normalisering |
| 14:00-15:00 | 1.00 | Eftermiddag: nominelt (baseline) |
| 15:00→19:00 | 1.00→1.20 | Stigning mod aftenens peak |
| 19:00-00:00 | 1.20 | Aften/nat: højest følsomhed |

```
ISF-faktor over døgnet:

  1.20 |****                                       ********
       |     *                                   **
  1.10 |      *                                *
       |       *                             *
  1.00 |── ── ──*── ── ── ── ── ── ── ──*── ── ── ── ── ── ──
       |         *                     *
  0.90 |          *                  *
       |           *               *
  0.80 |            *            *
       |             **       **
  0.70 |               *******
       ├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──┤
      00   02   04   06   08   10   12   14   16   18   20  24
```

ISF-faktor 0.70 betyder at insulin virker 30% dårligere. I praksis: hvis
en bolus normalt sænker BG med 3.0 mmol/L, sænker den kun 2.1 mmol/L om
morgenen. For at opnå samme effekt skal spilleren bruge ~43% mere insulin
(1/0.70 = 1.43).

### Hvad forstærker dawn-effekten?

HGP-amplituden påvirkes af to faktorer der beregnes ved dagsskift (midnat):

1. **Dårlig søvn:** +12% amplitude per mistet time søvn.
   Ved 4 timers tabt søvn (max): +48% → amplitude ~0.22 i stedet for 0.15.
   Baseret på Leproult et al. (1997) der fandt at søvndeprivation øger
   morgenkortisolpeak med 30-50%.

2. **Kronisk stress fra forrige dag:** +30% amplitude ved chronicStress = 1.0.
   Kronisk stress (t½ = 12 timer) er delvist henfaldet ved næste morgen,
   men der er stadig nok til at forstærke dawn-effekten mærkbart — især
   efter sygdomsdage eller flere nætter med dårlig søvn i træk.

Den samlede formel ved dagsskift:
```
dawnAmplitude = basisAmplitude × (1 + mistetSøvn × 0.12) × (1 + kroniskStress × 0.30)
```

*Kode: `regenerateDawn()`, `circadianKortisolNiveau` og `circadianISF` i
[simulator.js](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js).*

### Evidens og ærlig vurdering

Denne hybrid model er bygget på **mangelfuld videnskabelig evidens**
kombineret med input fra egne erfaringer som T1D-patient:

- Hinshaw 2013 (n=19 T1D) konkluderer at ISF-mønstret er *individuelt
  specifikt* og ikke kan generaliseres til T1D-populationen
- Toffanin 2013-kurven (som ISF-komponenten er inspireret af) er en
  syntetisk konstruktion valideret på virtuelle patienter — cirkulær evidens
- Den valgte amplitude (50% af Toffanin) og split mellem HGP/ISF er
  baseret på klinisk intuition og erfaring med ~40% ekstra morgeninsulin
- Sohag 2022 (n=93 T1D børn) viste ~50% morgen/aften-forskel i real-life
  korrektionsdoser, hvilket understøtter størrelsesordenen

**Modellen bør opdateres** hvis bedre kvantitative data for cirkadisk
insulinfølsomhed ved T1D bliver tilgængelige. Indtil da er den et
kvalificeret bud baseret på den bedste tilgængelige viden.

### Hvorfor er det vigtigt at forstå?

Dawn-fænomenet og cirkadisk ISF-variation er blandt de mest frustrerende
udfordringer for T1D-patienter. Det er vigtigt at forstå at højt blodsukker
om morgenen **ikke er patientens skyld** -- det er en naturlig fysiologisk
proces. Strategier til at håndtere det inkluderer justering af basal
insulin-dosis, timing af morgenbolus, og accept af at morgeninsulin
simpelthen skal være højere end afteninsulin.

Variationen fra dag til dag forklarer hvorfor morgen-blodsukkeret kan svinge
markant selv med identisk insulin-timing: en kombination af dårlig søvn,
stress og naturlig tilfældig variation gør at dawn-effekten aldrig er helt ens.

---

<a name="sovn"></a>
## 9. Søvnforstyrrelse -- Natlige indgreb koster

### Videnskabeligt grundlag

Donga et al. (2010, Diabetes Care) viste at en enkelt nat med delvis
søvnrestriktion reducerer insulinfølsomheden med ca. 21% hos T1D-patienter.
Zheng et al. (2017) fandt at dårlig søvnkvalitet forstærker dawn-fænomenet.

### Hvordan er det modelleret?

Når spilleren udfører en handling mellem kl. 22:00 og 07:00 (mad, insulin,
målinger), tæller det som en vågen-hændelse der koster søvn:

- Hændelser inden for 30 minutter af hinanden tæller som en enkelt
  vågenhed (man er allerede vågen)
- **Varians per opvågning:** Søvntabet per hændelse er normalfordelt med
  mean 1.0 time og std 0.3 timer (clamp [0.3, 1.8]). Nogle nætter falder
  man hurtigt i søvn igen (~0.5t tabt), andre ligger man længe vågen (~1.5t).
- Maksimalt 4 timers søvntab per nat
- Om morgenen (kl. 07:00) konverteres søvntabet til kronisk stress:

```
kroniskStress += tabt_sovn_i_timer * 0.06
```

Effekten i praksis:
- 1 times tabt søvn: +6% øget insulinresistens
- 2 timers tabt søvn: +12% øget insulinresistens
- 4 timers tabt søvn (maksimum): +24% øget insulinresistens

Derudover forstærker søvntabet også næste morgens **dawn-effekt** direkte
(+12% amplitude per mistet time — se afsnit 8). Den samlede effekt af dårlig
søvn er altså dobbelt: både øget insulinresistens OG stærkere morgen-BG-stigning.

Da kronisk stress har en halveringstid på 12 timer, aftager insulinresistens-
effekten naturligt gennem dagen. Men dawn-amplituden er sat for hele morgenen,
så en dårlig nat mærkes mest tydeligt i de tidlige timer.

### Hvorfor er det vigtigt at forstå?

- Natlige blodsukkermålinger har en reel omkostning (forstyrret søvn)
- Dårlig søvn forstærker dawn-fænomenet (kronisk stress + cirkadisk
  effekt adderes)
- Spilleren må afveje værdien af natlig kontrol mod konsekvenserne af
  forstyrret søvn

---

<a name="haaf"></a>
## 10. Hypoglykæmi-unawareness (HAAF)

### Hvad er HAAF?

HAAF (Hypoglycemia-Associated Autonomic Failure) er et fænomen hvor
gentagne hypoglykæmi-episoder svækker kroppens evne til at reagere på
lavt blodsukker. Kontrareguleringen bliver svagere, og patienten mærker
ikke symptomerne så tydeligt. Det er en af de mest frygtede komplikationer
ved intensiv insulinbehandling.

### Hvordan er det modelleret?

I stedet for at tælle diskrete "hypo-episoder" bruger modellen en
kontinuert, areal-baseret tilgang med to modstridende kræfter:

**Skade (hypoArea):**
Når blodsukkeret er under 3.0 mmol/L, akkumuleres "hypo-belastning"
proportionelt med dybden:

```
hypoArea += max(0, 3.0 - blodsukker) * tidsstep
```

Jo dybere og længere hypoglykæmien er, jo mere skade. Et blodsukker
på 2.0 i 30 minutter giver (3.0 - 2.0) * 30 = 30 enheder skade.
Et blodsukker på 2.8 i 10 minutter giver kun (3.0 - 2.8) * 10 = 2 enheder.

**Recovery:**
Når blodsukkeret er over 4.0, falder hypoArea eksponentielt med en
halveringstid på 3 simulerede dage. Klinisk svarer dette til den
observation at 2-3 ugers hypo-fri periode genopretter awareness
(Dagogo-Jack 1993, Cranston 1994).

**Effekt på kontraregulering:**
Akkumuleret hypoArea reducerer kontrareguleringens styrke via en
sigmoid-funktion:

```
counterRegFactor = 0.3 + 0.7 * exp(-hypoArea / 30)
```

Denne kurve går fra 1.0 (fuld respons) mod 0.3 (svær HAAF -- 70% reduktion)
asymptotisk. Gulvet på 0.3 sikrer at kontrareguleringen aldrig forsvinder
helt -- selv ved svær HAAF har kroppen en minimal respons.

Kalibreringen er sat så:
- En kort hypo (blodsukker 2.5 i 20 minutter) giver ca. 20% reduktion
- To hypoer samme dag giver ca. 40-50% reduktion
- 3 simulerede dage uden hypo giver næsten fuld genopretning

### Fordele ved denne model

Sammenlignet med simpel episode-tælling har denne tilgang flere fordele:

- **Proportionel:** En dyb hypo (1.5 mmol/L) giver langt mere skade end en
  mild (2.8 mmol/L)
- **Kontinuert:** Ingen arbitrær tærskel for hvad der "tæller" som en episode
- **Reversibel:** Recovery sker gradvist når man undgår hypo
- **Realistisk:** En kort, mild hypo har lille effekt; en langvarig, dyb hypo
  har stor, langvarig effekt

### Hvorfor er det vigtigt at forstå?

HAAF illustrerer en vigtig ond cirkel i T1D-behandling: hypoer gør det
sværere at opdage og modvirke fremtidige hypoer. Modellen lærer spilleren
at undgåelse af hypoglykæmi ikke bare er vigtigt i øjeblikket -- det
beskytter også mod fremtidige problemer.

---

<a name="ketoner"></a>
## 11. Ketoner og ketoacidose (DKA)

### Hvad er ketoner?

Når kroppen ikke har nok insulin til at bruge glukose som brændstof, skifter
den til at brænde fedt. Biproduktet er ketoner (syrer i blodet). Uden insulin
kan dette eskalere til diabetisk ketoacidose (DKA) -- en livstruende tilstand.

### Kliniske grænseværdier

| Niveau | Værdi (mmol/L) | Betydning |
|--------|----------------|-----------|
| Normal | Under 0.6 | Alt er fint |
| Forhøjet | 0.6 - 1.5 | Tag ekstra insulin, drik vand |
| Farligt | 1.5 - 3.0 | Søg læge, giv insulin |
| DKA | Over 3.0 | Akut livsfarligt |

### Hvordan er det modelleret?

Keton-modellen er bevidst forenklet (den fulde fysiologi er langt mere
kompleks):

**Ketonproduktion:** Ketoner stiger når to betingelser er opfyldt samtidig:
1. Insulinmangel (IOB under 0.1 enhed OG ingen aktiv basal insulin)
2. Højt blodsukker (over 12 mmol/L)

Stigningshastigheden er proportional med hvor højt blodsukkeret er:
maksimalt ca. 0.5 mmol/L per time ved blodsukker over 20.

**Keton-clearance:** Når der er tilstrækkeligt insulin tilstede, falder
ketoner med en halveringstid på ca. 2 timer.

**Clamping:** Keton-niveauet holdes inden for 0.0 - 10.0 mmol/L for at
undgå numeriske artefakter.

### DKA som game over-betingelse

Når alle følgende betingelser er opfyldt samtidig:
- Blodsukker over 12 mmol/L
- IOB under 0.1 enhed
- Ingen aktiv basal insulin
- Sidste insulin for mere end 8 timer siden

...starter en DKA-timer. Efter 6 timer kommer en advarsel. Efter yderligere
12 timer (total 18 timer) er det game over. At give insulin på ethvert
tidspunkt nulstiller timeren.

### Hvorfor er det vigtigt at forstå?

DKA er den hyppigste akutte dødsårsag ved T1D. Den udvikler sig over timer --
ikke minutter -- så der er tid til at handle. Men den kræver aktiv
opmærksomhed: man skal give insulin og drikke vand. Modellen lærer
spilleren at genkende tegnene (højt blodsukker + insulinmangel) og handle
i tide.

---

<a name="cgm"></a>
## 12. CGM-simulation -- Sensorens begrænsninger

### Hvad er en CGM?

En CGM (Continuous Glucose Monitor) er en sensor der sidder under huden og
måler glukose-koncentrationen i vævsvæske hvert 5. minut. Det er det
primære værktøj de fleste T1D-patienter bruger til at følge deres blodsukker.

Men CGM-værdien er IKKE det samme som det sande blodsukker. Der er tre
vigtige afvigelser som modellen simulerer:

### 1. Interstitiel forsinkelse (fysiologisk kompartment-model)

CGM'en måler glukose i vævsvæske (interstitiel væske), ikke direkte i
blodet. Glukose skal først diffundere fra blodkapillærer ud i den
interstitielle væske. Denne forsinkelse er modelleret som et selvstændigt
kompartment i Hovorka-modellen med en differentialligning:

```
dC/dt = ka_int × (G - C)
```

hvor G er plasma-glukose (det "sande" blodsukker) og C er den interstitielle
glukose-koncentration (det CGM'en måler). Konstanten `ka_int = 0.073 min⁻¹`
giver en tidskonstant på ~14 minutter.

Dette er *ikke* en simpel tidsforskydning — det er et førsteordens lavpasfilter.
Forskellen er vigtig:

- **Hurtigt stigende BG (fx efter mad):** CGM halter bagefter → viser lavere end
  virkeligheden. Jo hurtigere stigning, jo større forsinkelse.
- **Hurtigt faldende BG (fx efter insulin):** CGM halter bagefter → viser *højere*
  end virkeligheden. **Farligt:** du kan reelt være i hypo mens CGM stadig viser 4-5.
- **Stabilt BG:** CGM = sandt BG. Ingen forsinkelse ved steady state.

Den effektive forsinkelse er typisk 5-10 minutter ved normale ændringshastigheder,
men kan føles længere ved hurtige BG-ændringer (fx post-bolus eller under motion).

*Kode: `dC = ka_int * (G - C)` i Hovorka ODE step,
[hovorka.js](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js) linje 398.*

### 2. Tilfældig støj

Sensorelektronikken introducerer måleusikkerhed. Modellen bruger
normalfordelt støj der skalerer med BG-niveauet (kalibreret fra ca.
34.000 rigtige Libre 2-målinger over et år):

- Ved blodsukker 5 mmol/L: standardafvigelse ca. 0.15 mmol/L
- Ved blodsukker 10 mmol/L: standardafvigelse ca. 0.30 mmol/L

Støjen genereres med Box-Muller-transformation for en realistisk normalfordeling.

### 3. Systematisk drift

CGM-sensorer har en langsom, systematisk afvigelse der varierer over timer.
Modellen simulerer dette som en sinusbølge med:
- Periode: 4-8 timer (tilfældigt ved simulationsstart)
- Amplitude: 0.3-0.7 mmol/L (tilfældigt)

### 4. Diskontinuiteter

Lejlighedsvise pludselige spring i CGM-værdien (ca. 0.7 per dag). Disse
skyldes fx kompression af sensoren (man ligger på den), kalibreringsjusteringer
eller forbigående sensor-fejl. I modellen giver de et spring på op til
+/- 2 mmol/L.

### Fingerprik vs. CGM

Spilleren kan også foretage en fingerprik-måling der måler blodsukker
direkte (ikke vævsvæske). Det er mere præcist men stadig med +/- 5%
måleusikkerhed.

### Hvorfor er det vigtigt at forstå?

- CGM-værdien er et **estimat** -- ikke en eksakt måling
- Ved hurtigt faldende blodsukker viser CGM'en en højere værdi end
  virkeligheden (forsinkelsen)
- Pludselige hop i CGM-værdien er normalt og skyldes ikke nødvendigvis
  en reel ændring i blodsukker
- Fingerprik giver en mere pålidelig måling i tvivlstilfælde

---

<a name="variabilitet"></a>
## 13. Variabilitet -- Hvorfor virker det ikke ens hver gang?

En af de mest frustrerende aspekter ved T1D er at **det samme aldrig virker ens to gange**. Du kan give præcis den samme insulindosis, spise præcis den samme mad, og alligevel få et helt andet blodsukkerforløb. Simulatoren modellerer denne variabilitet bevidst, fordi den er en central del af T1D-oplevelsen.

### Kilder til variabilitet i simulatoren

Modellen har fire uafhængige variabilitetskilder:

#### 1. Insulin-bioavailability (lokal nedbrydning)

Ikke al injiceret insulin når blodbanen. En del nedbrydes af proteaser (enzymer) i det subkutane væv inden det absorberes. Modellen trækker en normalfordelt bioavailability per injektion:

- **Hurtigvirkende (bolus):** gennemsnit 78%, std 8% (clamped 55-95%)
- **Langtidsvirkende (basal):** gennemsnit 82%, std 8% (clamped 60-95%)

Absolut biotilgængelighed for subkutan insulin er målt til **55-77%** (insulin lispro, FDA label), op til 84% i enkelte studier (Gradel et al. 2018). Det betyder at af 5E injiceret bolus-insulin når reelt ca. 3-4E blodet. Resten nedbrydes lokalt af enzymer (proteaser) i det subkutane væv, eller akkumuleres i depotet uden at nå blodbanen.

> **Implementering:** [`js/simulator.js` — addFastInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1041) og [`addLongInsulin()`](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

#### 2. Absorptionshastighed (tau_I-variation)

Tidskonstanten for insulinabsorption (tau_I, normalt 55 min) varierer fra injektion til injektion. Modellen trækker en normalfordelt skaleringsfaktor:

- **tauFactor:** mean 1.0, std 0.25 (CV ~25%), clamped 0.50-1.60

En tauFactor på 0.7 giver peak efter ~38 min i stedet for ~55 min. En tauFactor på 1.4 giver peak efter ~77 min. Årsagerne i virkeligheden:

| Faktor | Effekt på absorption | Kilde |
|--------|---------------------|-------|
| Injektionsdybde | IM = meget hurtigere; 8mm nål giver >10x højere risiko for IM vs. 4mm | Gradel 2018 |
| Injektionssted | Abdomen hurtigst (reference), arm 30% langsommere, lår **86% langsommere** | [Koivisto 1980](https://pubmed.ncbi.nlm.nih.gov/7042427/) |
| Lokalt blodflow | Varme/motion øger; sauna: absorption **110% hurtigere** | [Koivisto 1981](https://pubmed.ncbi.nlm.nih.gov/7000239/) |
| Lipodystrofi | Cmax **25% lavere**, AUC **22-46% lavere**, BG ~40% højere i 5+ timer | [Tian 2023](https://journals.sagepub.com/doi/10.1177/19322968231187661) |
| Dosis-størrelse | Større depot = langsommere absorption (lavere overflade:volumen-ratio) | Heinemann 2002 |
| Temperatur | 35°C vs. 20°C: insulinabsorption **50-60% hurtigere** ved varme | [Sindelka 1994](https://pubmed.ncbi.nlm.nih.gov/7010077/) |
| Rygning | Nikotin → kutan vasokonstriktion → reduceret absorption + øget insulinresistens | [Bergman 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3501865/) |

Når flere injektioner er aktive samtidig, beregnes tau_I som et vægtet gennemsnit af alle aktive injektioners tauFactor.

> **Implementering:** [`js/simulator.js` — update() insulin-sektion](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L531) og [`js/hovorka.js` — S1/S2 differentialligninger](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L344)

#### 3. Puls-accelereret absorption (pulsFaktor)

Øget hjertefrekvens under motion øger blodgennemstrømningen i det subkutane væv, hvilket udvasker insulin hurtigere fra depotet. Dette er **ikke** tilfældig variabilitet men en deterministisk mekanisme der afhænger af aktivitet:

```
pulsFaktor = 1 + max(0, (puls - hvilepuls) / hvilepuls) × 0.5
```

| Puls | pulsFaktor | Effekt |
|------|------------|--------|
| 60 (hvile) | 1.00 | Normal absorption |
| 100 | 1.33 | 33% hurtigere |
| 120 | 1.50 | 50% hurtigere |
| 160 | 1.83 | 83% hurtigere |

Denne effekt gælder **al insulin i depotet** — både bolus og basal. Det er en vigtig grund til at motion kan give uventet kraftige BG-fald.

> **Implementering:** [`js/hovorka.js` — pulsFaktor i derivatives()](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L272)

Bemærk den enorme forskel mellem insulintyper — Tresiba (degludec) er markant
mere forudsigelig end Lantus (glargin), som har dramatisk variabilitet efter 8 timer:

| Insulin | CV (dag-til-dag) | Kilde |
|---------|-------------------|-------|
| NPH | 59-68% | [Heise 2004](https://pubmed.ncbi.nlm.nih.gov/15161770/) |
| Lantus (glargin U100) | 46-82% | [Heise 2012](https://pubmed.ncbi.nlm.nih.gov/22594461/) |
| Toujeo (glargin U300) | Lavere end U100 | [Heise 2017](https://pubmed.ncbi.nlm.nih.gov/28295934/) |
| Levemir (detemir) | 27% | [Heise 2004](https://pubmed.ncbi.nlm.nih.gov/15161770/) |
| Tresiba (degludec) | 20% | [Heise 2012](https://pubmed.ncbi.nlm.nih.gov/22594461/) |

> **Implementering:** [`js/simulator.js` — addLongInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

#### 4. CGM-sensor variabilitet

CGM-værdien afviger fra det sande blodsukker på fire måder:

| Kilde | Hvad | Parametre |
|-------|------|-----------|
| Sensor-forsinkelse | Glukose skal diffundere fra blod til vævsvæske | 5-10 min (tilfældigt) |
| Tilfældig støj | Elektrisk og biologisk støj i sensoren | 2.5-4.0% af BG (normalfordelt) |
| Systematisk drift | Langsom sinusbølge fra sensor-degradering | Periode 4-8t, amplitude 0.3-0.7 mmol/L |
| Diskontinuiteter | Pludselige spring (kompression, kalibrering) | ~0.7 per dag, op til ±2 mmol/L |

Støj-parametrene er kalibreret fra ca. 34.000 Freestyle Libre 2-målinger over et år fra en rigtig T1D-patient.

Til sammenligning, officielle MARD-værdier (Mean Absolute Relative Difference) for aktuelle CGM-sensorer:

| Sensor | MARD | Kilde |
|--------|------|-------|
| FreeStyle Libre 2 | 9.2% | [Alva 2022](https://pubmed.ncbi.nlm.nih.gov/32954812/) |
| FreeStyle Libre 3 | 7.9% | Abbott 2022 |
| Dexcom G6 | 9.9% | Welsh 2024 |
| Dexcom G7 | 8.2% (arm) | [Shah 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9208857/) |

Bemærk: den fysiologiske forsinkelse (5-6 min hos raske, **7-8 min ved T1D**) er kun en del af den totale CGM-forsinkelse. Fibrøs indkapsling af sensoren er den dominerende kilde til forsinkelse ([Helton 2019](https://diabetesjournals.org/diabetes/article/68/10/1892/35372/)).

> **Implementering:** [`js/simulator.js` — CGM-beregning i update()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L737)

#### 5. Kulhydrat-bioavailability (A_G)

Ikke alle kulhydrater optages. Modellen bruger en fast bioavailability på 80% (A_G = 0.8) fra Hovorka-modellen. I virkeligheden varierer dette kraftigt:

| Madtype | Estimeret bioavailability |
|---------|--------------------------|
| Glukosedrik / cola | ~95-100% |
| Hvidt brød, ris | ~85-90% |
| Blandet måltid | ~75-85% |
| Fuldkorn med fiber | ~60-75% |

Variabel A_G per madtype er planlagt som fremtidig feature (se TODO 31 i CLAUDE.md).

> **Implementering:** [`js/hovorka.js` — A_G konstant](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L83)

#### 6. Basal-insulin varighed

Langtidsvirkende insulins varighed varierer med normalfordeling:

- **Mean:** 28 timer, **std:** 3 timer (clamped 22-38 timer)

Dette afspejler at Lantus/Levemir ikke har en perfekt forudsigelig varighed — nogle dage varer det 25 timer, andre 31. Tresiba har endnu længere og mere stabil varighed (>40 timer), men er ikke separat modelleret endnu.

> **Implementering:** [`js/simulator.js` — addLongInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

### Samlet variabilitets-budget

For en typisk bolus-injektion er den samlede effekt-variation ca.:

| Kilde | CV | Type |
|-------|----|------|
| Bioavailability | ~10% | Tilfældig per injektion |
| Absorptionshastighed (tau_I) | ~25% | Tilfældig per injektion |
| Puls (motion) | 0-83% | Deterministisk, afhænger af aktivitet |
| CGM-aflæsning | ~3-4% | Tilfældig per måling |
| **Samlet tilfældig** | **~27%** | Stacker (root-sum-of-squares) |

Den samlede tilfældige CV på ~27% matcher Heinemann 2002's rapporterede intra-individuelle variation på 20-30% for hurtigvirkende insulinanaloger.

### Hvorfor er det vigtigt at forstå?

- **"Samme dosis, forskelligt resultat"** er normalt — det er ikke din skyld
- Insulins effekt kan variere op til ±50% fra gang til gang (2 standardafvigelser)
- Motion forstærker variabiliteten yderligere via accelereret absorption
- CGM-værdien er et estimat med sin egen usikkerhed oven i insulinens
- God T1D-kontrol handler om at navigere i denne usikkerhed — ikke om at eliminere den

> **Kilder:**
>
> *Insulin-variabilitet:*
> - Heinemann L. (2002). "Variability of insulin absorption and insulin action." *Diabetes Technol Ther*, 4(5):673-682. [PubMed](https://pubmed.ncbi.nlm.nih.gov/12450450/)
> - Gradel AKJ, et al. (2018). "Factors Affecting the Absorption of Subcutaneously Administered Insulin." *J Diabetes Res*. [PMC6079517](https://pmc.ncbi.nlm.nih.gov/articles/PMC6079517/)
> - Heise T, et al. (2004). "Lower within-subject variability of insulin detemir vs NPH and glargine." *Diabetes*, 53(Suppl 2). [PubMed](https://pubmed.ncbi.nlm.nih.gov/15161770/)
> - Heise T, et al. (2012). "Insulin degludec: four times lower pharmacodynamic variability than insulin glargine." *Diabetes Obes Metab*, 14(9):859-64. [PubMed](https://pubmed.ncbi.nlm.nih.gov/22594461/)
> - Heise T, et al. (2017). "Insulin degludec vs insulin glargine U300: day-to-day variability." *Diabetes Obes Metab*, 19(7):1032-1039. [PubMed](https://pubmed.ncbi.nlm.nih.gov/28295934/)
>
> *Injektionssted og absorption:*
> - Koivisto VA, Felig P. (1980). "Alterations in insulin absorption and blood glucose control associated with varying insulin injection sites." *Ann Intern Med*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7042427/)
> - Koivisto VA. (1981). "Sauna-induced acceleration in insulin absorption from subcutaneous injection site." *BMJ*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7000239/)
> - Sindelka G, et al. (1994). "Effect of temperature on insulin absorption." *Diabetologia*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7010077/)
> - McCarthy O, et al. (2020). "Factors Influencing Subcutaneous Insulin Absorption Around Exercise in T1D." *Front Endocrinol*. [PMC7609903](https://pmc.ncbi.nlm.nih.gov/articles/PMC7609903/)
> - Tian T, et al. (2023). "Lipohypertrophy and insulin: update from DTS." *J Diabetes Sci Technol*. [Sagepub](https://journals.sagepub.com/doi/10.1177/19322968231187661)
>
> *CGM-nøjagtighed:*
> - Alva S, et al. (2022). "Accuracy of a 14-day factory-calibrated CGM." *J Diabetes Sci Technol*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/32954812/)
> - Shah VN, et al. (2022). "Accuracy and safety of Dexcom G7 in adults." *Diabetes Technol Ther*. [PMC9208857](https://pmc.ncbi.nlm.nih.gov/articles/PMC9208857/)
> - Helton KL, et al. (2019). "Fibrotic encapsulation is the dominant source of CGM delays." *Diabetes*, 68(10):1892. [Diabetes](https://diabetesjournals.org/diabetes/article/68/10/1892/35372/)
> - Basu A, et al. (2013). "Time lag of glucose from intravascular to interstitial compartment." *Diabetes*. [PMC3837059](https://pmc.ncbi.nlm.nih.gov/articles/PMC3837059/)
>
> *Kulhydrat-biotilgængelighed:*
> - Livesey G. (2005). "Low-glycaemic diets and health." *Br J Nutr*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/16115326/)
>
> *Simuleringsmodeller:*
> - Hovorka R, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiol Meas*, 25(4):905-920.
> - Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030. [PMC7449052](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7449052/)

---

<a name="vaegt"></a>
## 14. Vægt og kaloriebalance

### Grundidéen

Vægt ændrer sig baseret på kaloriebalance:

```
nettokalorieR = spist - (hvileforbrug + motionforbrug)
vægtændring_kg = nettokalorieR / 7700
```

7700 kcal svarer omtrent til 1 kg kropsvægt (standard ernæringsapproksimation).

### Hvileforbrug (BMR)

Beregnes proportionelt med kropsvægt:
- Ved 70 kg: 2200 kcal/dag
- Ved 80 kg: ca. 2514 kcal/dag
- Ved 50 kg: ca. 1571 kcal/dag

### Motionforbrug

Ekstra kalorieforbrænding fra motion:
- Lav intensitet: 4 kcal/min
- Medium intensitet: 7 kcal/min
- Høj intensitet: 10 kcal/min

### Hvorfor er det vigtigt at forstå?

Vægt er en del af det samlede billede i T1D-styring. For meget insulin uden
tilstrækkelig motion kan føre til vægtøgning. For lidt mad kan føre til
vægttab. Simulatoren giver game over ved +/- 5 kg vægtændring for at
illustrere vigtigheden af balance.

---

<a name="scoring"></a>
## 15. Scoring og game over

### Klinisk baggrund: Time in Range (Battelino et al. 2019)

Spillets pointsystem er baseret på den internationale konsensus om "Time in
Range" (TIR) — den mest anerkendte standard for CGM-baseret glukosekontrol.
Konsensussen definerer fem zoner med mål for hvor stor en del af døgnet man
bør tilbringe i hver:

| Zone | BG-interval | Klinisk mål | Svarer til |
|------|------------|-------------|------------|
| **Meget lav** (TBR Level 2) | <3.0 mmol/L (<54 mg/dL) | <1% | <15 min/dag |
| **Lav** (TBR Level 1) | 3.0-3.9 mmol/L (54-70 mg/dL) | <4% | <1 time/dag |
| **I mål** (TIR) | 3.9-10.0 mmol/L (70-180 mg/dL) | >70% | >16.8 timer/dag |
| **Høj** (TAR Level 1) | 10.0-13.9 mmol/L (180-250 mg/dL) | <25% | <6 timer/dag |
| **Meget høj** (TAR Level 2) | >13.9 mmol/L (>250 mg/dL) | <5% | <1.2 timer/dag |

Nøglepointen: >70% af tiden bør være i mål (3.9-10.0), og <5% bør være "meget
høj" (>13.9). Lavt blodsukker er akut farligt, mens højt blodsukker er skadeligt
på sigt (øjne, nyrer, nerver) — men ikke akut livstruende.

### Pointsystem i simulatoren

Spillets scoring-zoner er forenklet fra TIR-tabellen med 14 mmol/L som grænse
(tæt på den kliniske 13.9):

| Zone | Blodsukker | Points per time | Klinisk baggrund |
|------|-----------|-----------------|------------------|
| Bonus (stram kontrol) | 5.0-6.0 mmol/L | 2.0 | Tæt på normalt — svært at opnå |
| Normal (i mål) | 4.0-10.0 mmol/L | 1.0 | TIR-zonen — målet er >70% her |
| Forhøjet (orange) | 10.0-14.0 mmol/L | 0.5 | TAR Level 1 — tilladt op til 25% |
| Ingen points | <4.0 eller >14.0 | 0 | Hypo eller TAR Level 2 — farligt |

Asymmetrien er bevidst: hypoglykæmi (<4.0) giver 0 points fordi det er akut
farligt (kramper, besvimelse, koma), mens moderat hyperglykæmi (10-14) stadig
giver halve points fordi det er acceptabelt i kortere perioder — præcis som
den kliniske konsensus tillader op til 6 timer/dag i TAR Level 1.

### Game over-betingelser

Spillet slutter ved fire scenarier:

1. **Svær hypoglykæmi:** Blodsukker under 1.5 mmol/L (hjernedød)
2. **Ekstrem vægtændring:** Mere end 5 kg til- eller fragang
3. **Diabetisk ketoacidose (DKA):** Langvarig insulinmangel + højt blodsukker
4. **Kroniske komplikationer:** 14-dages gennemsnit over 15 mmol/L (efter dag 14)

---

<a name="begraensninger"></a>
## 16. Begrænsninger og forbehold

T1D Simulator er et **uddannelsesværktøj og spil** -- IKKE et medicinsk device.
Vigtige begrænsninger:

1. **Forenklinger:** Modellen er en forenkling af virkeligheden. Rigtige patienter
   har individuel variation der ikke fanges fuldt af modellen.

2. **Parametre:** Standardparametre repræsenterer en "gennemsnitlig" T1D-patient.
   Individuelle parametre (ISF, ICR) kan variere markant fra person til person
   og fra dag til dag.

3. **Ikke-modellerede faktorer:** Alkohol, menstruation, temperatur, sygdom
   (udover generel stress), og mange andre faktorer påvirker blodsukker i
   virkeligheden men er ikke (endnu) inkluderet i simulatoren.

4. **Kropsbygning og muskelmasse:** ISF fanger den statiske insulinfølsomhed,
   men ikke dynamikken ved motion. I virkeligheden betyder mere muskelmasse:
   større GLUT4-optag under motion (E1-effekten burde skalere med muskelmasse),
   større glykogenlagre (længere tid før udtømning under cardio), højere
   basalstofskifte, og større perifert fordelingsvolumen (Q2 i Hovorka). To
   personer med samme ISF men meget forskellig kropsbygning ville reagere markant
   forskelligt på træning.

5. **Graviditet:** Markant øget insulinresistens i 2. og 3. trimester, strammere
   BG-mål (3.5-7.8 mmol/L per Battelino 2019), risiko for gestationel diabetes.
   Ville kræve dynamisk ISF-ændring over uger/måneder — for komplekst til
   nuværende simulering.

6. **Hypoxi og højdeophold:** Hypoxi (lav iltmætning) øger musklernes
   glukoseoptag via AMPK-aktivering (samme pathway som motion), og røde
   blodlegemer forbruger mere glukose under hypoxi. Desuden bliver CGM-sensorer
   mindre pålidelige ved lav iltmætning. Relevant for bjergbestigning, flyrejser
   og lungesygdomme — men sjældent nok til at prioritere i simulatoren.

7. **Keton-model:** Forenklet i forhold til den fulde fysiologi. Nuværende model
   bruger BG > 12 som trigger, men ketogenese drives primært af insulinniveau
   (se afsnit 11 og VIDENSKAB.md afsnit 23). Faste-ketose er ikke modelleret.
   Rigtig ketoacidose involverer pH-ændringer, dehydrering og
   elektrolytforstyrrelser der ikke er modelleret.

8. **Motion:** Modellerer aerob og anaerob som separate mekanismer, men
   virkeligheden er et spektrum. Individuel variation i motionsrespons er stor.

9. **Insulintyper:** Kun en generel hurtigvirkende og en generel langtidsvirkende
   insulin er modelleret. Forskelle mellem specifikke præparater (NovoRapid vs.
   Fiasp, Lantus vs. Tresiba) er ikke inkluderet.

10. **Ingen pumpe-model:** Insulinpumper (kontinuerlig subkutan insulin-infusion)
    er ikke modelleret.

**Brug ALDRIG denne simulator som grundlag for medicinske beslutninger.
Følg altid din læges anbefalinger.**

---

<a name="referencer"></a>
## 17. Videnskabelige referencer

### Primære kilder

1. **Hovorka R, Canonico V, Chassin LJ, et al.** (2004). "Nonlinear model
   predictive control of glucose concentration in subjects with type 1 diabetes."
   *Physiological Measurement*, 25(4):905-920.
   - Kernemodellen for glukose-insulin dynamik
   - [PDF (Yale)](http://www.stat.yale.edu/~jtc5/diabetes/NonlinearModelPredictiveControl_Hovorka_04.pdf)

2. **Resalat N, El Youssef J, Reddy R, Jacobs PG.** (2020). "Simulation Software
   for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms:
   Glucose-Insulin Dynamics in Type 1 Diabetes." *IFAC-PapersOnLine*, 53(2):16025-16030.
   - Udvidet Hovorka-model med motionseffekter (E1, E2 tilstandsvariable)
   - [PMC7449052](https://pmc.ncbi.nlm.nih.gov/articles/PMC7449052/)

3. **Dalla Man C, Rizza RA, Cobelli C.** (2007). "Meal Simulation Model of the
   Glucose-Insulin System." *IEEE Transactions on Biomedical Engineering*, 54(10):1740-1749.
   - UVA/Padova-modellen -- FDA-godkendt som erstatning for dyreforsøg i
     insulin-pumpe trials

4. **Dalla Man C et al.** (2025). "Simulation of High-Fat High-Protein Meals Using
   the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.
   - Mixed meals med fedt- og protein-effekter på glukose-absorption

### Sekundære kilder

5. **Kudva YC, et al.** (2021). "Exercise effect on insulin-dependent and
   insulin-independent glucose utilization in healthy individuals and individuals
   with type 1 diabetes." *American Journal of Physiology -- Endocrinology and
   Metabolism*, 321(2):E230-E237.
   - Insulin-afhængig vs. insulin-uafhængig glukoseoptag under motion
   - [PMC8321821](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)

6. **Agianniotis A, et al.** (2021). "Modelling glucose dynamics during moderate
   exercise in individuals with type 1 diabetes." *PLOS ONE*, 16(3):e0248280.
   - Detaljeret model af glukosedynamik under moderat motion

7. **Ajmera I, et al.** (2021). "A comparison among three maximal mathematical
   models of the glucose-insulin system." *PLOS ONE*, 16(9):e0257789.
   - Sammenligning af Hovorka, UVA/Padova og Sorensen-modellerne

8. **Donga E, et al.** (2010). "A single night of partial sleep deprivation
   induces insulin resistance in multiple metabolic pathways in healthy subjects."
   *Diabetes Care*.
   - Søvnrestriktion og insulinresistens

9. **Dagogo-Jack SE, Craft S, Cryer PE.** (1993). "Hypoglycemia-associated
   autonomic failure in insulin-dependent diabetes mellitus." *Journal of Clinical
   Investigation*, 91(3):819-828.
   - HAAF -- gentagne hypoer svækker kontraregulering

10. **Cryer PE.** (2013). "Mechanisms of hypoglycemia-associated autonomic failure
    in diabetes." *New England Journal of Medicine*, 369(4):362-372.
    - Oversigt over HAAF-mekanismer og kontraregulerings-tærskler

### Supplerende litteratur

11. **Bergman RN, Ider YZ, Bowden CR, Cobelli C.** (1979). "Quantitative estimation
    of insulin sensitivity." *American Journal of Physiology*, 236(6):E667-E677.
    - Den originale "Bergman Minimal Model"

12. **Sorensen JT.** (1985). "A Physiologic Model of Glucose Metabolism in Man and
    Its Use to Design and Assess Improved Insulin Therapies for Diabetes."
    PhD Thesis, MIT.
    - Den mest detaljerede multi-organ model

13. **Battelino T, et al.** (2019). "Clinical Targets for Continuous Glucose
    Monitoring Data Interpretation." *Diabetes Care*, 42(8):1593-1603.
    - International konsensus om Time in Range (TIR), TAR og TBR

14. **Bengtsen MB, Moller N.** (2021). "Mini-review: Glucagon responses in type 1
    diabetes -- a matter of complexity." *Physiological Reports*.
    - Glukagon-respons ved T1D (tab af respons efter 1-5 år)

---

<a name="open-source"></a>
## 18. Open source-software der er brugt

### Direkte implementationer

- **[svelte-flask-hovorka-simulator](https://github.com/jonasnm/svelte-flask-hovorka-simulator)**
  af Jonas Nordhassel Myhre
  - Python-implementation af Hovorka-modellens differentialligninger
  - Vores JavaScript-port er baseret på denne implementation
  - Licens: MIT (antagelse -- ingen eksplicit licens i repo)

### Afhængigheder

- **[Tone.js](https://tonejs.github.io/)** v14.8.49 -- Web Audio framework til lydeffekter
  - Licens: MIT

---

*Sidst opdateret: Marts 2026*
