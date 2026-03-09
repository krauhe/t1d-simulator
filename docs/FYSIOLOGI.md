# Fysiologisk Model -- Diabetes-Dysten

*Denne side er den tekniske dokumentation af simulatorens fysiologiske motor.
Den beskriver hvordan hver model er implementeret, hvorfor den er bygget som den er,
og hvilke videnskabelige kilder den hviler pa. Dokumentet henvender sig til patienter,
parorende og sundhedspersonale der onsker at forsta hvad der sker "under motorhjelmen".*

**Vigtig disclaimer:** Diabetes-Dysten er et uddannelsesspil -- IKKE et medicinsk device.
Brug aldrig simulatoren som grundlag for medicinske beslutninger. Folg altid din laeges anbefalinger.

---

## Indhold

1. [Overblik -- Hvad simulerer vi?](#overblik)
2. [Kernemodellen: Hovorka 2004](#kernemodellen)
3. [Glukose -- Kroppens braendstof](#glukose)
4. [Insulin -- Noglen til cellerne](#insulin)
5. [Mad -- Fra tallerken til blodbane](#mad)
6. [Motion -- Musklerne som glukosesvamp](#motion)
7. [Stresshormoner -- Kroppens modspil](#stresshormoner)
8. [Dawn-faenomenet -- Morgenkortisol](#dawn)
9. [Sovnforstyrrelse -- Natlige indgreb koster](#sovn)
10. [Hypoglykaeми-unawareness (HAAF)](#haaf)
11. [Ketoner og ketoacidose (DKA)](#ketoner)
12. [CGM-simulation -- Sensorens begr nsninger](#cgm)
13. [Vaegt og kaloriеbalance](#vaegt)
14. [Scoring og game over](#scoring)
15. [Begraensninger og forbehold](#begraensninger)
16. [Videnskabelige referencer](#referencer)
17. [Open source-software der er brugt](#open-source)

---

<a name="overblik"></a>
## 1. Overblik -- Hvad simulerer vi?

Diabetes-Dysten simulerer glukose-insulin-dynamikken hos en person med type 1 diabetes (T1D).
Simulationen modellerer de vigtigste fysiologiske processer der pavirker blodsukkeret:

1. **Glukose-kinetik** -- hvordan glukose fordeles og forbruges i kroppen
2. **Insulin-farmakokinetik** -- hvordan injiceret insulin optages og virker
3. **Kulhydrat-absorption** -- hvordan mad fordojes og glukose optages i blodet
4. **Motionseffekter** -- hvordan fysisk aktivitet pavirker blodsukkeret
5. **Stresshormoner** -- hvordan kortisol, adrenalin og glukagon pavirker leveren
6. **Ketonstofskifte** -- hvordan insulinmangel forer til ketoacidose
7. **CGM-simulation** -- realistisk sensor-forsinkelse og stoj

Alle disse systemer er forbundet. Insulin saenker blodsukkeret, men motion forandrer
hvor hurtigt insulinet virker. Stresshormoner far leveren til at frigive ekstra glukose.
Sovnmangel gor insulin mindre effektivt. Simulatoren forsøger at fange dette samspil
sa realistisk som muligt -- inden for rammerne af et spil.

### Hvordan er simulatoren bygget op?

Simulatoren korer som et ur der "tikker" hvert par sekunder i reel tid. For hvert
tik beregner den:

- Hvor meget insulin der er aktivt i kroppen lige nu
- Hvor meget glukose der kommer ind fra maden
- Hvor meget glukose leveren producerer (pavirket af stresshormoner)
- Hvor meget glukose musklerne optager (pavirket af motion)
- Hvad CGM-sensoren ville vise (med forsinkelse og stoj)

Resultatet er et nyt blodsukkerniveau der vises pa grafen.

---

<a name="kernemodellen"></a>
## 2. Kernemodellen: Hovorka 2004 (Cambridge-modellen)

### Hvorfor netop denne model?

Simulationens kerne er baseret pa **Hovorka et al. (2004)** -- en model udviklet
ved University of Cambridge til forskning i kunstig bugspytkirtel. Vi valgte den fordi:

- **Klinisk valideret** -- testet mod rigtige T1D-patienter i kontrollerede forsog
- **Veletableret** -- over 1000 citationer i den videnskabelige litteratur
- **Velbalanceret** -- kompleks nok til realistisk adfaerd, simpel nok til at kore i realtid i en browser
- **Veldokumenteret** -- alle parametre og ligninger er publiceret

### Modellens grundide

Hovorka-modellen beskriver kroppen som en raekke forbundne "rum" (kompartmenter).
Glukose og insulin bevager sig mellem disse rum med hastigheder bestemt af
differentialligninger -- matematiske udtryk der beskriver *hvordan noget aendrer sig over tid*.

Modellen har 13 tilstandsvariable fordelt pa fire subsystemer:

- **Glukose-subsystemet** (2 kompartmenter: plasma og perifere vaev)
- **Insulin-subsystemet** (3 kompartmenter: to subkutane depoter og plasma)
- **Insulin-aktions-subsystemet** (3 effektvariable)
- **Tarm-absorptions-subsystemet** (2 kompartmenter)
- **CGM-sensor** (1 variabel med forsinkelse)
- **Motionseffekter** (2 tilstandsvariable)

For den matematisk interesserede: modellen loses med Euler-integration, hvor vi
opdaterer tilstanden hvert minut (simuleret tid):

```
Ny vaerdi = gammel vaerdi + aendringsrate * tidsstep
```

Dette er den simpleste numeriske metode, men den er tilstraekkelig praecis for
vores formaal. Mere avancerede metoder (fx Runge-Kutta 4) kunne give bedre
praecision, men Euler er hurtigere og helt fin til et spil.

---

<a name="glukose"></a>
## 3. Glukose -- Kroppens braendstof

### Hvad er modelleret?

Glukose i kroppen er fordelt i to "rum":

- **Q1 (plasma):** Glukose i blodet -- det du maler med en blodsukkermaler.
  Blodsukkerniveauet i mmol/L beregnes som Q1 divideret med glukosens
  fordelingsvolumen (ca. 11.2 liter ved 70 kg).

- **Q2 (perifere vaev):** Glukose i muskler og fedtvaev. Denne pulje er ikke
  direkte malbar, men spiller en vigtig rolle fordi insulin driver glukose
  fra blodet (Q1) ud i vaevene (Q2), og motion oger musklernes optag.

### Hvad pavirker blodsukkeret?

Den centrale ligning for plasma-glukose (Q1) beskriver en balance mellem
alt det der **tilfojer** glukose til blodet og alt det der **fjerner** det:

**Tilforsel:**
- *Mad (UG):* Glukose fra tarmen efter et maltid
- *Leveren (EGP):* Leverens glukoseproduktion (stimuleret af stresshormoner,
  haemmet af insulin)
- *Tilbagestrøm fra vaev (k12 * Q2):* Glukose der vender tilbage fra muskler

**Fjernelse:**
- *Hjernens forbrug (F01c):* Hjernen bruger ca. 120 gram glukose om dagen --
  uanset om der er insulin tilstede eller ej. Ved lavt blodsukker reduceres
  forbruget (hjernen far simpelthen ikke nok)
- *Nyrerne (FR):* Over ca. 9 mmol/L begynder nyrerne at udskille glukose i
  urinen. Dette er en naturlig beskyttelsesmekanisme mod ekstremt hojt blodsukker
- *Insulin-drevet optag:* Insulin transporterer glukose fra blodet ud i
  muskler og fedtvaev

### Hvorfor er det vigtigt at forsta?

Blodsukkeret er altid resultatet af en **balance** mellem tilforsel og fjernelse.
Nar tilforsel overstiger fjernelse, stiger blodsukkeret. Nar fjernelse overstiger
tilforsel, falder det. En person med T1D mangler kroppens egen insulin, sa uden
injiceret insulin er der intet til at drive glukose ind i cellerne -- og blodsukkeret
stiger ukontrolleret.

### Nogleparametre (skaleret med kropvaegt)

| Parameter | Hvad den gor | Typisk vaerdi (70 kg) |
|-----------|-------------|----------------------|
| VG | Hvor meget blod glukosen fordeler sig i | 0.16 * vaegt = 11.2 L |
| F01 | Hjernens glukoseforbrug per minut | 0.0097 * vaegt = 0.68 mmol/min |
| EGP0 | Leverens basale glukoseproduktion per minut | 0.0161 * vaegt = 1.13 mmol/min |
| R_thr | Nyretaerskel for glukoseudskillelse | 9 mmol/L |

---

<a name="insulin"></a>
## 4. Insulin -- Noglen til cellerne

### Hvordan virker insulin i modellen?

Nar du injicerer insulin under huden, skal det forst transporteres til blodet
for det kan virke. Modellen beskriver dette som en rejse gennem flere "stationer":

**Station 1 og 2: Under huden (S1 og S2)**

Insulinet sidder forst i et depot under huden (S1) og bevager sig gradvist
videre til et andet depot (S2). Herfra optages det i blodbanen. Tiden til
maksimal absorption er ca. 55 minutter for hurtigvirkende insulin som NovoRapid.

**Station 3: I blodet (I)**

Fra blodet fordeler insulinet sig med et fordelingsvolumen pa ca. 8.4 liter
(ved 70 kg). Kroppen fjerner ogsa insulin fra blodet loebende (elimination).

**Station 4-6: Effekt pa glukose (x1, x2, x3)**

Selv nar insulinet er i blodet, virker det ikke ojeblikkelig. Der er en
yderligere forsinkelse fra insulin i blod til den faktiske virkning pa glukose.
Tre separate effektvariable modellerer denne forsinkelse:

- **x1 (transport):** Insulin gor det lettere for glukose at komme fra blodet ud
  i musklerne
- **x2 (forbraending):** Insulin far musklerne til at braende mere glukose
- **x3 (leversuppression):** Insulin far leveren til at producere mindre glukose

Disse tre effekter arbejder sammen, men med lidt forskellige hastigheder.
Det er derfor insulin har en kompleks virkningsprofil -- det starter langsomt,
topper efter 1-2 timer og aftager gradvist over 3-5 timer.

### Insulin-folsomhedsparametre

Hvor kraftigt insulin pavirker de tre processer bestemmes af tre folsomhedsparametre:

| Parameter | Hvad den styrer | Typisk vaerdi |
|-----------|----------------|---------------|
| SIT | Insulins effekt pa transport | 51.2 * 10^-4 L/min/mU |
| SID | Insulins effekt pa muskelforbraending | 8.2 * 10^-4 L/min/mU |
| SIE | Insulins effekt pa leversuppression | 520 * 10^-4 1/mU |

Alle tre parametre skaleres med spillerens ISF (Insulin Sensitivity Factor).
En hojere ISF betyder at insulin virker kraftigere -- alle tre parametre
multipliceres med en skaleringsfaktor:

```
skaleringsfaktor = spillerens ISF / 3.75
```

Referencen 3.75 mmol/L per enhed er den effektive ISF som Hovorka-modellens
standard-parametre giver. Sa en spiller med ISF = 3.0 far en skaleringsfaktor
pa 0.80 (lidt mindre folsom end gennemsnittet), og en spiller med ISF = 5.0
far 1.33 (mere folsom).

### Hurtigvirkende vs. langtidsvirkende insulin

**Hurtigvirkende (bolus):** Injiceres som en kort puls over 5 simulerede
minutter. Hovorka-modellens S1- og S2-kompartmenter handterer resten:
absorption, fordeling og effekt-forsinkelse. Typisk profil: onset 10-15 min,
peak 1-2 timer, varighed 3-5 timer.

**Langtidsvirkende (basal):** Modelleres med en trapez-profil der ramper op
over 4 timer, holder et stabilt plateau i 18 timer, og aftager gradvist.
Total varighed: 24-36 timer (med lidt tilfaeldig variation, ligesom i
virkeligheden). Basal insulin feedes direkte ind i Hovorka-modellens
insulin-rate -- det giver en langsom, jaevn tilforsel.

### IOB -- Insulin On Board

IOB (aktiv insulin i kroppen) beregnes direkte fra Hovorka-modellens
insulin-kompartmenter. Vi viser kun bolus-IOB til spilleren -- basal
insulin er en stabil baggrund der ikke er relevant for doserings-beslutninger.

### Hvorfor er det vigtigt at forsta?

Forstaelsen af insulin-farmakokinetik er afgorende for god blodsukkerstyring:

- **Stacking:** Hvis du giver en ny dosis for den forrige er udvirket, far du
  "insulin-stacking" -- mere aktiv insulin end tilsigtet, med risiko for
  hypoglykaemi. IOB hjaelper dig med at undga dette.
- **Timing:** Insulin virker ikke med det samme. Hvis du venter med at give
  insulin til blodsukkeret allerede er hojt, vil du vaere bagud i timer.
- **Variabilitet:** Selv den samme dosis insulin virker ikke ens hver gang.
  Modellen simulerer dette med tilfaeldig variation i onset og varighed.

---

<a name="mad"></a>
## 5. Mad -- Fra tallerken til blodbane

### Kulhydrat-absorption

Nar du spiser kulhydrater, optages de ikke med det samme. Mave-tarm-kanalen
modelleres som to kompartmenter:

- **D1 (maven):** Maden ankommer her og bevager sig gradvist videre
- **D2 (tyndtarmen):** Herfra optages glukose i blodet

Hastigheden bestemmes af parameteren tau_G (tid til maksimal absorption),
som er sat til 40 minutter. Kun 80% af kulhydraterne optages (bioavailability = 0.8) --
resten passerer uabsorberet.

I praksis betyder det at efter et maltid stiger blodsukkeret gradvist, topper
efter ca. 40-60 minutter og flader ud over 2-3 timer.

### Fedtindhold forsinker absorptionen

Fedt i et maltid forsinker mavetomningen, hvilket gor at kulhydraterne optages
langsommere. I modellen oger fedtindholdet tau_G-vaerdien, sa
absorptionstoppen kommer senere og er lavere -- men varer laengere.

Dette er grunden til at en pizza (hojt fedtindhold) giver et anderledes
blodsukkerforloeb end en skive hvidt brod (lavt fedtindhold), selvom
kulhydratindholdet matte vaere det samme.

### Protein-effekt

Protein bidrager ogsa til blodsukker-stigningen, men langsommere og i mindre
grad. Ca. 25% af proteinet konverteres til glukose via glukoneogenese i leveren,
med en forsinkelse pa ca. 30 minutter og en absorptionstid pa ca. 60 minutter.

Sa et maltid med 40 gram protein vil pavirke blodsukkeret som yderligere
10 gram kulhydrater -- bare forsinket med en halv time.

### Hvorfor er det vigtigt at forsta?

- Et maltid med hojt fedtindhold kan kraeve en anderledes insulinstrategi
  (fx delt bolus eller forsinket bolus)
- Protein-effekten forklarer hvorfor et stykke kod uden tilbehor stadig kan
  pavirke blodsukkeret
- Timing af insulin i forhold til maltid er afgorende: for tidligt giver
  risiko for hypo for maden naar blodet, for sent giver et unodvendigt hojt peak

---

<a name="motion"></a>
## 6. Motion -- Musklerne som glukosesvamp

### Grundideen

Motion pavirker blodsukkeret pa flere mader samtidig. Modellens motionseffekter
er baseret pa udvidelsen beskrevet i **Resalat et al. (2020)**, som tilfojer
to ekstra tilstandsvariable drevet af hjertefrekvens:

- **E1 (kortvarig effekt):** Stiger hurtigt under traening (tidskonstant 20 min),
  falder hurtigt efter. Repraesenterer direkte muskel-glukoseoptag via
  GLUT4-translokation -- en mekanisme der virker UDEN insulin.

- **E2 (langvarig effekt):** Stiger langsomt (tidskonstant 200 min) og falder
  langsomt. Repraesenterer den forstoerkede insulinfolsomhed der varer timer
  efter traening er slut.

### Aerob traening (loeb, cykling)

Ved aerob traening dominerer to mekanismer:

1. **Direkte muskeloptag (E1):** Musklerne optager glukose direkte fra blodet
   under traening, helt uden insulin. Jo hojere puls, jo mere optag.
2. **Forstoerket insulinvirkning (E2):** Insulin virker bedre under og efter
   traening. Matematisk multipliceres insulins transport-effekt (x1) med
   faktoren (1 + alpha * E2^2), hvor alpha = 1.79.

Nettoresultat: blodsukkeret **falder** under aerob traening.

### Anaerob traening (styrke, sprint)

Ved hoj intensitet udloses en katekolamin-respons (adrenalin). I modellen
tilfojes akut stress (0.02 per simuleret minut ved hoj intensitet), som oger
leverens glukoseproduktion. Denne effekt kan midlertidigt **overskride**
det faldende blodsukker fra muskeloptaget.

Nettoresultat: blodsukkeret kan **stige akut** under anaerob traening, men
falder efterfolgende nar stresshormonerne aftager og den forstoerkede
insulinfolsomhed tager over.

### Puls-model

Pulsen stiger og falder gradvist via eksponentiel udjaevning:

- Under motion: halveringstid ca. 2 minutter (hurtig stigning)
- Efter motion: halveringstid ca. 5 minutter (gradvis recovery)

Intensiteten mappes til malpuls:
- Lav: 100 bpm
- Medium: 130 bpm
- Hoj: 160 bpm

### Post-exercise insulinfolsomhed

Efter traening er insulinfolsomheden forhojet i en periode der afhaenger
af intensiteten:

| Intensitet | Folsomheds-boost | Varighed efter traening |
|------------|-------------------|------------------------|
| Lav | +50% | 1 * traeningsvarighed |
| Medium | +75% | 2 * traeningsvarighed |
| Hoj | +100% | 4 * traeningsvarighed |

Boostet aftager lineaert fra maksimum til normal over perioden.

### Hvorfor er det vigtigt at forsta?

- **Hypo-risiko:** Aerob traening med aktiv bolus-insulin kan give alvorlig
  hypoglykaemi. Reducer bolus eller spis ekstra for traening.
- **Forsinket hypo:** 6-12 timer efter intensiv traening kan blodsukkeret
  falde pludseligt, isaer om natten.
- **Styrketraening er anderledes:** Forvent en akut blodsukkerstigning under
  styrketraening -- det er normalt og forbigaende.
- **Motion om aftenen:** Forhojet insulinfolsomhed om natten oger risikoen
  for natlig hypoglykaemi.

---

<a name="stresshormoner"></a>
## 7. Stresshormoner -- Kroppens modspil

### Grundideen

Kroppen har et system af hormoner (glukagon, adrenalin, kortisol) der
modarbejder insulins effekt ved at stimulere leverens glukoseproduktion.
Dette er en livsvigtig beskyttelsesmekanisme mod lavt blodsukker --
men det komplicerer ogsa blodsukkerstyringen for T1D-patienter.

### To-lags stresssystem

Modellen skelner mellem to typer stress med vidt forskellige tidshorisonter:

**Akut stress (adrenalin og glukagon)**
- Halveringstid: ca. 60 simulerede minutter
- Udloses af: hypoglykaemi (Somogyi-effekten), intensiv motion
- Virkning: hurtig, kraftig stigning i leverens glukoseproduktion
- Begraenset til maks 0.4 for T1D (glukagon-respons er tabt,
  kun svag adrenalin-respons er tilbage)

**Kronisk stress (kortisol)**
- Halveringstid: ca. 12 simulerede timer
- Udloses af: sovnmangel, sygdom (planlagt fremtidig feature)
- Virkning: langvarig, moderat forhojelse af leverens glukoseproduktion
  samt oget insulinresistens

### Stress-multiplikatoren

Begge stressniveauer feedes ind i en samlet multiplikator der pavirker
leverens glukoseproduktion (EGP):

```
stressMultiplikator = 1.0 + akutStress + kroniskStress + cirkadiskKortisol
```

Ved normal tilstand (ingen stress) er multiplikatoren 1.0 -- leveren
producerer sin normale maengde glukose. Ved akut stress pa 0.4 stiger
den til 1.4 -- leveren producerer 40% mere glukose.

### Samspillet mellem stress og insulin

Den effektive leverproduktion beregnes som:

```
EGP = EGP0 * max(0, stressMultiplikator - x3)
```

Her er x3 insulins bremsende effekt pa leveren. Formlen betyder at
stress og insulin "traekker i hver sin retning":

- **Normal dag:** stress = 1.0, x3 = 0.3: EGP = EGP0 * 0.7 (moderat produktion)
- **Efter bolus:** stress = 1.0, x3 = 1.3: EGP = 0 (insulin undertrykker leveren)
- **Hypo + kontraregulering:** stress = 1.4, x3 = 1.3: EGP = EGP0 * 0.1
  (stresshormoner "slar igennem" trods aktiv insulin)
- **Massiv overdosis:** x3 >> stress: EGP = 0 (insulin vinder -- farligt!)

Denne formel er en forbedring i forhold til den originale Hovorka-model,
hvor formlen var EGP0 * stressMultiplikator * (1 - x3). Problemet med den
originale formel var at nar x3 oversteg 1.0, blev leverens produktion
klippet til nul -- og stresshormoner kunne aldrig slaa igennem. Det betod
at kontraregulering var virkningslos under hypoglykaemi, hvilket ikke
svarer til virkeligheden.

### Kontraregulering ved T1D

Modellen tager hojde for at T1D-patienter har svaekket kontraregulering:

- Glukagon-respons er typisk tabt inden 1-5 ar efter diagnose
- Adrenalin-respons er bevaret men kan svaekkes ved gentagne hypoer (se HAAF)
- Stress-cap sat til 0.4 (vs. ca. 5.0 hos raske) for at afspejle dette

Den praktiske konsekvens: en insulinoverdosis kan ikke "reddes" af kroppens
egen hormon-respons. Spilleren skal laere at forebygge hypoglykaemi --
ikke stole pa at kroppen klarer det.

### Hvorfor er det vigtigt at forsta?

- **Somogyi-effekten:** Natlig hypoglykaemi kan udlose kontraregulering der
  giver hojt blodsukker om morgenen. Det kan forveksles med for lidt insulin,
  men arsagen er det modsatte -- for MEGET insulin om natten.
- **Motion og stress:** Hoj intensitets-traening udloser adrenalin-respons
  der kan give akut blodsukkerstigning, selvom motionen ogsa saenker blodsukker.
- **Sygdom:** Kronisk stress fra sygdom giver oget insulinresistens der
  kan vare hele dagen.

---

<a name="dawn"></a>
## 8. Dawn-faenomenet -- Morgenkortisol

### Hvad er dawn-faenomenet?

Mange T1D-patienter oplever at deres blodsukker stiger om morgenen -- selvom
de ikke har spist noget. Dette skyldes kroppens naturlige kortisol-rytme:
kortisol stiger i timerne for opvagning som del af den cirkadiske rytme,
og kortisol stimulerer leverens glukoseproduktion.

### Hvordan er det modelleret?

Kortisol-kurven er modelleret med kvart-sinuskurver for en blod, fysiologisk
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
pa toppen af dawn-effekten. Denne effekt adderes til den samlede
stress-multiplikator -- sa hvis patienten ogsa har kronisk stress fra
sovnmangel, forstierkes morgenproblematikken yderligere.

### Hvorfor er det vigtigt at forsta?

Dawn-faenomenet er en af de mest frustrerende udfordringer for T1D-patienter.
Det er vigtigt at forsta at hojt blodsukker om morgenen **ikke er patientens
skyld** -- det er en naturlig fysiologisk proces. Strategier til at handtere
det inkluderer justering af basal insulin-dosis eller timing.

---

<a name="sovn"></a>
## 9. Sovnforstyrrelse -- Natlige indgreb koster

### Videnskabeligt grundlag

Donga et al. (2010, Diabetes Care) viste at en enkelt nat med delvis
sovnrestriktion reducerer insulinfolsomheden med ca. 21% hos T1D-patienter.
Zheng et al. (2017) fandt at darlig sovnkvalitet forstierker dawn-faenomenet.

### Hvordan er det modelleret?

Nar spilleren udforer en handling mellem kl. 22:00 og 07:00 (mad, insulin,
malinger), taeller det som en vagen-haendelse der koster 1 times sovn:

- Haendelser inden for 30 minutter af hinanden taeller som en enkelt
  vagenhed (man er allerede vagen)
- Maksimalt 4 timers sovntab per nat
- Om morgenen (kl. 07:00) konverteres sovntabet til kronisk stress:

```
kroniskStress += tabt_sovn_i_timer * 0.06
```

Effekten i praksis:
- 1 times tabt sovn: +6% oget insulinresistens
- 2 timers tabt sovn: +12% oget insulinresistens
- 4 timers tabt sovn (maksimum): +24% oget insulinresistens

Da kronisk stress har en halveringstid pa 12 timer, aftager effekten
naturligt gennem dagen og er naesten vaek ved naeste aften.

### Hvorfor er det vigtigt at forsta?

- Natlige blodsukkermålinger har en reel omkostning (forstyrret sovn)
- Darlig sovn forstierker dawn-faenomenet (kronisk stress + cirkadisk
  effekt adderes)
- Spilleren maa afveje vaerdien af natlig kontrol mod konsekvenserne af
  forstyrret sovn

---

<a name="haaf"></a>
## 10. Hypoglykaemi-unawareness (HAAF)

### Hvad er HAAF?

HAAF (Hypoglycemia-Associated Autonomic Failure) er et faenomen hvor
gentagne hypoglykaemi-episoder svaekker kroppens evne til at reagere pa
lavt blodsukker. Kontrareguleringen bliver svagere, og patienten maerker
ikke symptomerne sa tydeligt. Det er en af de mest frygtede komplikationer
ved intensiv insulinbehandling.

### Hvordan er det modelleret?

I stedet for at taelle diskrete "hypo-episoder" bruger modellen en
kontinuert, areal-baseret tilgang med to modstridende kraefter:

**Skade (hypoArea):**
Nar blodsukkeret er under 3.0 mmol/L, akkumuleres "hypo-belastning"
proportionelt med dybden:

```
hypoArea += max(0, 3.0 - blodsukker) * tidsstep
```

Jo dybere og laengere hypoglykaemien er, jo mere skade. Et blodsukker
pa 2.0 i 30 minutter giver (3.0 - 2.0) * 30 = 30 enheder skade.
Et blodsukker pa 2.8 i 10 minutter giver kun (3.0 - 2.8) * 10 = 2 enheder.

**Recovery:**
Nar blodsukkeret er over 4.0, falder hypoArea eksponentielt med en
halveringstid pa 3 simulerede dage. Klinisk svarer dette til den
observation at 2-3 ugers hypo-fri periode genopretter awareness
(Dagogo-Jack 1993, Cranston 1994).

**Effekt pa kontraregulering:**
Akkumuleret hypoArea reducerer kontrareguleringens styrke via en
sigmoid-funktion:

```
counterRegFactor = 0.3 + 0.7 * exp(-hypoArea / 30)
```

Denne kurve gar fra 1.0 (fuld respons) mod 0.3 (svaer HAAF -- 70% reduktion)
asymptotisk. Gulvet pa 0.3 sikrer at kontrareguleringen aldrig forsvinder
helt -- selv ved svaer HAAF har kroppen en minimal respons.

Kalibreringen er sat sa:
- En kort hypo (blodsukker 2.5 i 20 minutter) giver ca. 20% reduktion
- To hypoer samme dag giver ca. 40-50% reduktion
- 3 simulerede dage uden hypo giver naesten fuld genopretning

### Fordele ved denne model

Sammenlignet med simpel episode-taelling har denne tilgang flere fordele:

- **Proportionel:** En dyb hypo (1.5 mmol/L) giver langt mere skade end en
  mild (2.8 mmol/L)
- **Kontinuert:** Ingen arbitraer taerskel for hvad der "taeller" som en episode
- **Reversibel:** Recovery sker gradvist nar man undgar hypo
- **Realistisk:** En kort, mild hypo har lille effekt; en langvarig, dyb hypo
  har stor, langvarig effekt

### Hvorfor er det vigtigt at forsta?

HAAF illustrerer en vigtig ond cirkel i T1D-behandling: hypoer gor det
svaerere at opdage og modvirke fremtidige hypoer. Modellen laerer spilleren
at undgaelse af hypoglykaemi ikke bare er vigtigt i oejeblikket -- det
beskytter ogsa mod fremtidige problemer.

---

<a name="ketoner"></a>
## 11. Ketoner og ketoacidose (DKA)

### Hvad er ketoner?

Nar kroppen ikke har nok insulin til at bruge glukose som braendstof, skifter
den til at braende fedt. Biproduktet er ketoner (syrer i blodet). Uden insulin
kan dette eskalere til diabetisk ketoacidose (DKA) -- en livstruende tilstand.

### Kliniske graensevaerdier

| Niveau | Vaerdi (mmol/L) | Betydning |
|--------|----------------|-----------|
| Normal | Under 0.6 | Alt er fint |
| Forhojet | 0.6 - 1.5 | Tag ekstra insulin, drik vand |
| Farligt | 1.5 - 3.0 | Sog laege, giv insulin |
| DKA | Over 3.0 | Akut livsfarligt |

### Hvordan er det modelleret?

Keton-modellen er bevidst forenklet (den fulde fysiologi er langt mere
kompleks):

**Ketonproduktion:** Ketoner stiger nar to betingelser er opfyldt samtidig:
1. Insulinmangel (IOB under 0.1 enhed OG ingen aktiv basal insulin)
2. Hojt blodsukker (over 12 mmol/L)

Stigningshastigheden er proportional med hvor hojt blodsukkeret er:
maksimalt ca. 0.5 mmol/L per time ved blodsukker over 20.

**Keton-clearance:** Nar der er tilstraekkeligt insulin tilstede, falder
ketoner med en halveringstid pa ca. 2 timer.

**Clamping:** Keton-niveauet holdes inden for 0.0 - 10.0 mmol/L for at
undga numeriske artefakter.

### DKA som game over-betingelse

Nar alle folgende betingelser er opfyldt samtidig:
- Blodsukker over 12 mmol/L
- IOB under 0.1 enhed
- Ingen aktiv basal insulin
- Sidste insulin for mere end 8 timer siden

...starter en DKA-timer. Efter 6 timer kommer en advarsel. Efter yderligere
12 timer (total 18 timer) er det game over. At give insulin pa ethvert
tidspunkt nulstiller timeren.

### Hvorfor er det vigtigt at forsta?

DKA er den hyppigste akutte dodsarsag ved T1D. Den udvikler sig over timer --
ikke minutter -- sa der er tid til at handle. Men den kraever aktiv
opmaerksomhed: man skal give insulin og drikke vand. Modellen laerer
spilleren at genkende tegnene (hojt blodsukker + insulinmangel) og handle
i tide.

---

<a name="cgm"></a>
## 12. CGM-simulation -- Sensorens begraensninger

### Hvad er en CGM?

En CGM (Continuous Glucose Monitor) er en sensor der sidder under huden og
maler glukose-koncentrationen i vaevsvaeske hvert 5. minut. Det er det
primaere vaerktoj de fleste T1D-patienter bruger til at folge deres blodsukker.

Men CGM-vaerdien er IKKE det samme som det sande blodsukker. Der er tre
vigtige afvigelser som modellen simulerer:

### 1. Sensor-forsinkelse (5-10 minutter)

CGM'en maler glukose i vaevsvaeske (interstitiel vaeske), ikke direkte i
blodet. Glukose skal forst diffundere fra blodet ud i vaevet, hvilket tager
5-10 minutter. Det betyder at CGM-vaerdien altid er "bagud" -- isaer nar
blodsukkeret aendrer sig hurtigt.

I modellen opslaar vi det sande blodsukker fra 5-10 minutter (tilfaeldigt)
tidligere.

### 2. Tilfaeldig stoj

Sensorelektronikken introducerer maleusikkerhed. Modellen bruger
normalfordelt stoj der skalerer med BG-niveauet (kalibreret fra ca.
34.000 rigtige Libre 2-malinger over et ar):

- Ved blodsukker 5 mmol/L: standardafvigelse ca. 0.15 mmol/L
- Ved blodsukker 10 mmol/L: standardafvigelse ca. 0.30 mmol/L

Stojen genereres med Box-Muller-transformation for en realistisk normalfordeling.

### 3. Systematisk drift

CGM-sensorer har en langsom, systematisk afvigelse der varierer over timer.
Modellen simulerer dette som en sinusbolge med:
- Periode: 4-8 timer (tilfaeldigt ved simulationsstart)
- Amplitude: 0.3-0.7 mmol/L (tilfaeldigt)

### 4. Diskontinuiteter

Lejlighedsvise pludselige spring i CGM-vaerdien (ca. 0.7 per dag). Disse
skyldes fx kompression af sensoren (man ligger pa den), kalibreringsjusteringer
eller forbigaende sensor-fejl. I modellen giver de et spring pa op til
+/- 2 mmol/L.

### Fingerprik vs. CGM

Spilleren kan ogsa foretage en fingerprik-maling der maler blodsukker
direkte (ikke vaevsvaeske). Det er mere praecist men stadig med +/- 5%
maleusikkerhed.

### Hvorfor er det vigtigt at forsta?

- CGM-vaerdien er et **estimat** -- ikke en eksakt maling
- Ved hurtigt faldende blodsukker viser CGM'en en hojere vaerdi end
  virkeligheden (forsinkelsen)
- Pludselige hop i CGM-vaerdien er normalt og skyldes ikke noedvendigvis
  en reel aendring i blodsukker
- Fingerprik giver en mere palidelig maeling i tvivlstilfaelde

---

<a name="vaegt"></a>
## 13. Vaegt og kaloriebalance

### Grundideen

Vaegt aendrer sig baseret pa kaloriebalance:

```
nettokalorieR = spist - (hvileforbrug + motionforbrug)
vaegtaendring_kg = nettokalorieR / 7700
```

7700 kcal svarer omtrent til 1 kg kropsvagt (standard ernaeringsapproksimation).

### Hvileforbrug (BMR)

Beregnes proportionelt med kropsvagt:
- Ved 70 kg: 2200 kcal/dag
- Ved 80 kg: ca. 2514 kcal/dag
- Ved 50 kg: ca. 1571 kcal/dag

### Motionforbrug

Ekstra kalorieforbraending fra motion:
- Lav intensitet: 4 kcal/min
- Medium intensitet: 7 kcal/min
- Hoj intensitet: 10 kcal/min

### Hvorfor er det vigtigt at forsta?

Vaegt er en del af det samlede billede i T1D-styring. For meget insulin uden
tilstraekkelig motion kan fore til vaegtoeging. For lidt mad kan fore til
vaegttab. Simulatoren giver game over ved +/- 5 kg vaegtaendring for at
illustrere vigtigheden af balance.

---

<a name="scoring"></a>
## 14. Scoring og game over

### Pointsystem

Spilleren optjener points baseret pa tid tilbragt i forskellige blodsukker-zoner:

| Zone | Blodsukker | Points per time |
|------|-----------|-----------------|
| Bonus (stramt kontrolleret) | 5.0 - 6.0 mmol/L | 2.0 |
| Normal (i mal) | 4.0 - 10.0 mmol/L | 1.0 |
| Forhojet (orange zone) | 10.0 - 14.0 mmol/L | 0.5 |
| Hypo eller hoj hyper | Under 4.0 eller over 14.0 | 0 |

Asymmetrien afspejler klinisk virkelighed: hypoglykaemi er akut farligt
(kramper, besvimelse), mens moderat hyperglykaemi (10-14) er skadeligt pa
sigt men ikke akut livstruende.

Zoneinddelingen er baseret pa den internationale konsensus om Time in Range
(Battelino et al. 2019).

### Game over-betingelser

Spillet slutter ved fire scenarier:

1. **Svaer hypoglykaemi:** Blodsukker under 1.5 mmol/L (hjernedod)
2. **Ekstrem vaegtaendring:** Mere end 5 kg til- eller fragang
3. **Diabetisk ketoacidose (DKA):** Langvarig insulinmangel + hojt blodsukker
4. **Kroniske komplikationer:** 14-dages gennemsnit over 15 mmol/L (efter dag 14)

---

<a name="begraensninger"></a>
## 15. Begraensninger og forbehold

Diabetes-Dysten er et **uddannelsesvaerktoj og spil** -- IKKE et medicinsk device.
Vigtige begraensninger:

1. **Forenklinger:** Modellen er en forenkling af virkeligheden. Rigtige patienter
   har individuel variation der ikke fanges fuldt af modellen.

2. **Parametre:** Standardparametre repraesenterer en "gennemsnitlig" T1D-patient.
   Individuelle parametre (ISF, ICR) kan variere markant fra person til person
   og fra dag til dag.

3. **Ikke-modellerede faktorer:** Alkohol, menstruation, temperatur, sygdom
   (udover generel stress), og mange andre faktorer pavirker blodsukker i
   virkeligheden men er ikke (endnu) inkluderet i simulatoren.

4. **Keton-model:** Forenklet i forhold til den fulde fysiologi. Rigtig
   ketoacidose involverer pH-aendringer, dehydrering og elektrolytforstyrrelser
   der ikke er modelleret.

5. **Motion:** Modellerer aerob og anaerob som separate mekanismer, men
   virkeligheden er et spektrum. Individuel variation i motionsrespons er stor.

6. **Insulintyper:** Kun en generel hurtigvirkende og en generel langtidsvirkende
   insulin er modelleret. Forskelle mellem specifikke praeparater (NovoRapid vs.
   Fiasp, Lantus vs. Tresiba) er ikke inkluderet.

7. **Ingen pumpe-model:** Insulinpumper (kontinuerlig subkutan insulin-infusion)
   er ikke modelleret.

**Brug ALDRIG denne simulator som grundlag for medicinske beslutninger.
Folg altid din laeges anbefalinger.**

---

<a name="referencer"></a>
## 16. Videnskabelige referencer

### Primaere kilder

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
   - UVA/Padova-modellen -- FDA-godkendt som erstatning for dyreforsog i
     insulin-pumpe trials

4. **Dalla Man C et al.** (2025). "Simulation of High-Fat High-Protein Meals Using
   the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.
   - Mixed meals med fedt- og protein-effekter pa glukose-absorption

### Sekundaere kilder

5. **Kudva YC, et al.** (2021). "Exercise effect on insulin-dependent and
   insulin-independent glucose utilization in healthy individuals and individuals
   with type 1 diabetes." *American Journal of Physiology -- Endocrinology and
   Metabolism*, 321(2):E230-E237.
   - Insulin-afhaengig vs. insulin-uafhaengig glukoseoptag under motion
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
   - Sovnrestriktion og insulinresistens

9. **Dagogo-Jack SE, Craft S, Cryer PE.** (1993). "Hypoglycemia-associated
   autonomic failure in insulin-dependent diabetes mellitus." *Journal of Clinical
   Investigation*, 91(3):819-828.
   - HAAF -- gentagne hypoer svaekker kontraregulering

10. **Cryer PE.** (2013). "Mechanisms of hypoglycemia-associated autonomic failure
    in diabetes." *New England Journal of Medicine*, 369(4):362-372.
    - Oversigt over HAAF-mekanismer og kontraregulerings-taerskler

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
    - Glukagon-respons ved T1D (tab af respons efter 1-5 ar)

---

<a name="open-source"></a>
## 17. Open source-software der er brugt

### Direkte implementationer

- **[svelte-flask-hovorka-simulator](https://github.com/jonasnm/svelte-flask-hovorka-simulator)**
  af Jonas Nordhassel Myhre
  - Python-implementation af Hovorka-modellens differentialligninger
  - Vores JavaScript-port er baseret pa denne implementation
  - Licens: MIT (antagelse -- ingen eksplicit licens i repo)

### Afhaengigheder

- **[Tone.js](https://tonejs.github.io/)** v14.8.49 -- Web Audio framework til lydeffekter
  - Licens: MIT

---

*Sidst opdateret: Marts 2026*
