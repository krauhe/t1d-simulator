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
13. [Vægt og kaloriebalance](#vaegt)
14. [Scoring og game over](#scoring)
15. [Begrænsninger og forbehold](#begraensninger)
16. [Videnskabelige referencer](#referencer)
17. [Open source-software der er brugt](#open-source)

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

Disse tre effekter arbejder sammen, men med lidt forskellige hastigheder.
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
  Modellen simulerer dette med tilfældig variation i onset og varighed.

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

1. **Direkte muskeloptag (E1):** Musklerne optager glukose direkte fra blodet
   under træning, helt uden insulin. Jo højere puls, jo mere optag.
2. **Forstærket insulinvirkning (E2):** Insulin virker bedre under og efter
   træning. Matematisk multipliceres insulins transport-effekt (x1) med
   faktoren (1 + alpha * E2^2), hvor alpha = 1.79.

Nettoresultat: blodsukkeret **falder** under aerob træning.

### Anaerob træning (styrke, sprint)

Ved høj intensitet udløses en katekolamin-respons (adrenalin). I modellen
tilføjes akut stress (0.02 per simuleret minut ved høj intensitet), som øger
leverens glukoseproduktion. Denne effekt kan midlertidigt **overskride**
det faldende blodsukker fra muskeloptaget.

Nettoresultat: blodsukkeret kan **stige akut** under anaerob træning, men
falder efterfølgende når stresshormonerne aftager og den forstærkede
insulinfølsomhed tager over.

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

### Kontraregulering ved T1D

Modellen tager højde for at T1D-patienter har svækket kontraregulering:

- Glukagon-respons er typisk tabt inden 1-5 år efter diagnose
- Adrenalin-respons er bevaret men kan svækkes ved gentagne hypoer (se HAAF)
- Stress-cap sat til 0.4 (vs. ca. 5.0 hos raske) for at afspejle dette

Den praktiske konsekvens: en insulinoverdosis kan ikke "reddes" af kroppens
egen hormon-respons. Spilleren skal lære at forebygge hypoglykæmi --
ikke stole på at kroppen klarer det.

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
## 8. Dawn-fænomenet -- Morgenkortisol

### Hvad er dawn-fænomenet?

Mange T1D-patienter oplever at deres blodsukker stiger om morgenen -- selvom
de ikke har spist noget. Dette skyldes kroppens naturlige kortisol-rytme:
kortisol stiger i timerne før opvågning som del af den cirkadiske rytme,
og kortisol stimulerer leverens glukoseproduktion.

### Hvordan er det modelleret?

Kortisol-kurven er modelleret med kvart-sinuskurver for en blød, fysiologisk
plausibel form:

```
00:00 - 04:00:  Baseline -- kortisol er lavt, ingen ekstra leverglukose
04:00 - 08:00:  Stigende fase -- sinuskurve fra 0 til peak
08:00 - 12:00:  Faldende fase -- cosinuskurve fra peak til 0
12:00 - 24:00:  Baseline -- kortisol er lavt resten af dagen
```

Visuel fremstilling (amplitude = 0.3):

```
  0.30 |         ^ peak kl. 08:00
       |       /   \
  0.15 |     /       \
       |   /           \
  0.00 |---              ---------------
       +----------------------------> tid
      00   04   08   12   16   20   24
```

Amplituden 0.3 betyder at leverens glukoseproduktion stiger med op til 30%
på toppen af dawn-effekten. Denne effekt adderes til den samlede
stress-multiplikator -- så hvis patienten også har kronisk stress fra
søvnmangel, forstærkes morgenproblematikken yderligere.

### Hvorfor er det vigtigt at forstå?

Dawn-fænomenet er en af de mest frustrerende udfordringer for T1D-patienter.
Det er vigtigt at forstå at højt blodsukker om morgenen **ikke er patientens
skyld** -- det er en naturlig fysiologisk proces. Strategier til at håndtere
det inkluderer justering af basal insulin-dosis eller timing.

---

<a name="sovn"></a>
## 9. Søvnforstyrrelse -- Natlige indgreb koster

### Videnskabeligt grundlag

Donga et al. (2010, Diabetes Care) viste at en enkelt nat med delvis
søvnrestriktion reducerer insulinfølsomheden med ca. 21% hos T1D-patienter.
Zheng et al. (2017) fandt at dårlig søvnkvalitet forstærker dawn-fænomenet.

### Hvordan er det modelleret?

Når spilleren udfører en handling mellem kl. 22:00 og 07:00 (mad, insulin,
målinger), tæller det som en vågen-hændelse der koster 1 times søvn:

- Hændelser inden for 30 minutter af hinanden tæller som en enkelt
  vågenhed (man er allerede vågen)
- Maksimalt 4 timers søvntab per nat
- Om morgenen (kl. 07:00) konverteres søvntabet til kronisk stress:

```
kroniskStress += tabt_sovn_i_timer * 0.06
```

Effekten i praksis:
- 1 times tabt søvn: +6% øget insulinresistens
- 2 timers tabt søvn: +12% øget insulinresistens
- 4 timers tabt søvn (maksimum): +24% øget insulinresistens

Da kronisk stress har en halveringstid på 12 timer, aftager effekten
naturligt gennem dagen og er næsten væk ved næste aften.

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

### 1. Sensor-forsinkelse (5-10 minutter)

CGM'en måler glukose i vævsvæske (interstitiel væske), ikke direkte i
blodet. Glukose skal først diffundere fra blodet ud i vævet, hvilket tager
5-10 minutter. Det betyder at CGM-værdien altid er "bagud" -- især når
blodsukkeret ændrer sig hurtigt.

I modellen opslår vi det sande blodsukker fra 5-10 minutter (tilfældigt)
tidligere.

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

<a name="vaegt"></a>
## 13. Vægt og kaloriebalance

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
## 14. Scoring og game over

### Pointsystem

Spilleren optjener points baseret på tid tilbragt i forskellige blodsukker-zoner:

| Zone | Blodsukker | Points per time |
|------|-----------|-----------------|
| Bonus (stramt kontrolleret) | 5.0 - 6.0 mmol/L | 2.0 |
| Normal (i mål) | 4.0 - 10.0 mmol/L | 1.0 |
| Forhøjet (orange zone) | 10.0 - 14.0 mmol/L | 0.5 |
| Hypo eller høj hyper | Under 4.0 eller over 14.0 | 0 |

Asymmetrien afspejler klinisk virkelighed: hypoglykæmi er akut farligt
(kramper, besvimelse), mens moderat hyperglykæmi (10-14) er skadeligt på
sigt men ikke akut livstruende.

Zoneinddelingen er baseret på den internationale konsensus om Time in Range
(Battelino et al. 2019).

### Game over-betingelser

Spillet slutter ved fire scenarier:

1. **Svær hypoglykæmi:** Blodsukker under 1.5 mmol/L (hjernedød)
2. **Ekstrem vægtændring:** Mere end 5 kg til- eller fragang
3. **Diabetisk ketoacidose (DKA):** Langvarig insulinmangel + højt blodsukker
4. **Kroniske komplikationer:** 14-dages gennemsnit over 15 mmol/L (efter dag 14)

---

<a name="begraensninger"></a>
## 15. Begrænsninger og forbehold

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

4. **Keton-model:** Forenklet i forhold til den fulde fysiologi. Rigtig
   ketoacidose involverer pH-ændringer, dehydrering og elektrolytforstyrrelser
   der ikke er modelleret.

5. **Motion:** Modellerer aerob og anaerob som separate mekanismer, men
   virkeligheden er et spektrum. Individuel variation i motionsrespons er stor.

6. **Insulintyper:** Kun en generel hurtigvirkende og en generel langtidsvirkende
   insulin er modelleret. Forskelle mellem specifikke præparater (NovoRapid vs.
   Fiasp, Lantus vs. Tresiba) er ikke inkluderet.

7. **Ingen pumpe-model:** Insulinpumper (kontinuerlig subkutan insulin-infusion)
   er ikke modelleret.

**Brug ALDRIG denne simulator som grundlag for medicinske beslutninger.
Følg altid din læges anbefalinger.**

---

<a name="referencer"></a>
## 16. Videnskabelige referencer

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
## 17. Open source-software der er brugt

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
