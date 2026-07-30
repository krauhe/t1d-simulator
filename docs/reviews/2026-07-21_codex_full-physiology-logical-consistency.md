# Fuld fysiologisk og logisk konsistensreview — T1D Simulator

**Dato:** 2026-07-21
**Reviewer:** Codex (GPT-5.6), `phys-reviewer`-workflow
**Branch:** `codex/remove-dr-kai-character`
**Scope:** Den aktuelle lokale kode, inklusive ikke-publicerede ændringer. Reviewet omfatter `js/hovorka.js`, `js/physiology-engine.js`, Simulator-facaden, fysiologiske tests samt konsistens med `docs/MODEL-IMPLEMENTATION.md` og `docs/BG-SCIENCE.md`. MDR og regulatorisk framing er bevidst udsat.

## Samlet vurdering

Den normale browsermodel er teknisk moden. Hovorka-kernens 16 tilstande, enheder og integrationsrækkefølge er sammenhængende, alle BG-koblede udvidelser afvikles med deltrin på højst 1 simuleret minut, og de etablerede referenceforløb er uændrede. Jeg fandt **ingen kritiske fejl**, der i sig selv viser, at almindelige spilforløb beregnes fundamentalt forkert.

Modellen er dog ikke fuldt logisk konsistent i alle lag. Reviewet finder **5 advarsler** og **3 noter**; fire advarsler er siden rettet, og leverdepotet er accepteret som en eksplicit dokumenteret forenkling. De vigtigste er:

1. **FIKSET 2026-07-22:** Den selvstændige Node-API kunne ikke køre `step()` uden testharnessens globale hjælp.
2. **BY DESIGN 2026-07-22:** Leverens glykogendepot er et estimeret kapacitetsdepot; motionstømning og måltidslagring er ikke koblet tilsvarende til blodets glukosemasse.
3. **FIKSET 2026-07-22:** Effektivt basalbehov og injiceret basaldosis har nu hver sin eksplicitte størrelse, og spilledosis kompenserer for 0,82-biotilgængeligheden.
4. **FIKSET 2026-07-22:** Ugyldige indlejrede måltidsparametre kunne sprede `NaN` gennem hele ODE-tilstanden.
5. **FIKSET 2026-07-22:** Steady-state-søgningen kunne ramme sin grænse og stadig returnere en tilstand langt fra mål-BG uden fejl eller advarsel.

Det oprindelige review ændrede ingen fysiologisk kode. Statusopdateringen 2026-07-22 retter kun standalone-modulbindingen og ændrer ingen ligninger eller parametre.

## Metode og evidens

- Kortlægning af alle 16 Hovorka-tilstande og deres strømme: tarm, insulin-depoter, plasma/perifert glukose, insulinvirkning, CGM, motion og basalinsulin.
- Gennemgang af motorens deltrinsrækkefølge: stress/glykogen, fødeindtag, fedt/protein, ISF-modifikatorer, insulinabsorption, Hovorka-step, ketoner, muskelglykogen, glucagon og skade-/game-over-modeller.
- Dimensions- og fortegnskontrol af de vigtigste BG-koblede strømme.
- Sammenligning mellem kode, implementeringsdokument og videnskabsdokument.
- Automatiske regressionstests og målrettede numeriske prober.
- Kontrol mod den oprindelige Hovorka-model og primære humanstudier af motion og endogen glukoseproduktion.

Primære kilder anvendt som reference:

- [Hovorka et al. 2004 — Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes](https://pubmed.ncbi.nlm.nih.gov/15382830/)
- [Mallad et al. 2015 — Exercise effects on postprandial glucose metabolism in type 1 diabetes](https://pubmed.ncbi.nlm.nih.gov/25898950/)
- [Yardley et al. 2020 — Hyperglycemia but not hyperinsulinemia is favorable for exercise in type 1 diabetes](https://pubmed.ncbi.nlm.nih.gov/32661106/)
- [Heise et al. 2003 — Subcutaneous absorption of insulin glargine and NPH insulin](https://pubmed.ncbi.nlm.nih.gov/12931275/)

## Verifikationsresultater

| Test | Resultat | Fortolkning |
|---|---:|---|
| `tests/simulation.test.js` | 166/166 | Normal Simulator-facade og gameplay-scenarier består |
| `tests/golden-master.js check` | 7/7 bit-identiske | De etablerede referencekurver er uændrede |
| `tests/clinical-equivalence.js check` | 9/9 | Klinisk scenarie-output matcher baseline |
| `tests/standalone-parity.js` | 10/10 | Harness-understøttet engine matcher Simulator-facaden |
| `tests/physiology-engine-api.test.js` | 21/21 (2026-07-22) | Node-import, indlejret inputvalidering og steady-state-grænser består |
| `tests/check-text-sync.sh` | OK | Dansk og engelsk UI-tekst har samme 892 nøgler |

Før rettelsen skjulte paritetstesten fund 1, fordi `tests/harness.js` eksplicit lagde både `HovorkaModel` og `HOVORKA_STATE_IDX` i globalt scope før engine-koden blev kørt.

## Arkitektur og det, der er konsistent

### Hovorka-kernen

De 16 tilstande har en klar og intern konsistent rolle:

- `D1`, `D2`: glukose i tarmens absorptionskæde.
- `S1`, `S2`, `I`: hurtigt subkutant insulin og plasma-insulin.
- `Q1`, `Q2`: tilgængelig og perifer glukosemasse.
- `x1`, `x2`, `x3`: insulinmedieret transport, forbrug og hæmning af endogen glukoseproduktion.
- `C`: forsinket CGM-signal.
- `E1`, `E2`: kort og længere motionsvirkning.
- `S1b`, `S2b`, `Ib`: separat basalinsulinkæde.

Masse- og koncentrationsenhederne i kernens differentialligninger stemmer. Fortegnene for tarmtilførsel, renal clearance, insulinmedieret transport og EGP er logiske. Ikke-negative fysiske tilstande clamps efter hvert Euler-deltrin.

### Integrationsrækkefølge

Motorens rækkefølge i `PhysiologyEngine._runSubstepLoop()` er fornuftig: ændringer i maveindhold, FFA, aminosyrer, stress og ISF når at påvirke det samme deltrins Hovorka-beregning. Glucagon tilføjer eksplicit glukose til `Q1` og trækker samme masse fra leverglykogenet. Det er den tydeligste fuldt massebevarende udvidelse uden for selve Hovorka-kernen.

### Normalområdets stabilitet

De seks aktuelle karakterprofiler ligger inden for steady-state-søgerens arbejdsområde. Standardmoduler med skalering 1,0 passerer alle regressionsforløb. De fundne randproblemer ændrer derfor ikke konklusionen om, at den almindelige spilmodel er reproducerbar og testmæssigt stabil.

## Fund

### ADVARSEL 1 — Direkte Node-API mangler `HOVORKA_STATE_IDX`

**Filer:** `js/physiology-engine.js:251-259`, første brug ved `:745`; `js/hovorka.js:47-66`; `tests/physiology-engine-api.test.js`
**STATUS:** ✅ FIKSET (2026-07-22, lokal ændring; ikke committet)

`resolveHovorkaModel()` importerer kun `HovorkaModel` fra `hovorka.js`. Engine-metoderne refererer samtidig direkte til det separate symbol `HOVORKA_STATE_IDX`, som derfor ikke eksisterer ved normal `require('./js/physiology-engine.js')`.

Konsekvensen er 11 API-testfejl med `HOVORKA_STATE_IDX is not defined`. Browseren virker, fordi begge scripts deler globalt scope, og paritetstesten virker, fordi harnessen manuelt opretter globalen. Det er en arkitekturfejl i den selvstændige engine-kontrakt, ikke en fysiologisk ligningsfejl.

Den tolvte API-testfejl er en forældet forventning: testen forventer `TypeError` for en ikke-boolesk dawn-værdi, mens dawn nu med vilje er et 0..1-modul og korrekt kaster `RangeError` for en værdi uden for intervallet.

**Anbefaling:** Importér modelklasse og state-indeks samlet i Node-miljøet, og lad API-testen køre uden globale testhjælpere. Opdatér samtidig den forældede modultest.

**Løsning og verifikation (2026-07-22):** `physiology-engine.js` resolver nu
`HovorkaModel` og `HOVORKA_STATE_IDX` som ét bindingspar: fra browserens fælles
script-scope eller via en eksplicit CommonJS-import. Alle engine-opslag bruger den
resolverede indeksmappe. De to forældede scalar-modulforventninger i API-testen er
synkroniseret med den dokumenterede 0..1-repræsentation. Direkte
`createEngine(...).step(1)` består uden globale hjælpere; API-testen består nu 21/21,
og den fulde simulationssuite består 166/166.

### ADVARSEL 2 — Indlejrede måltidsparametre kan gøre hele modellen til `NaN`

**Filer:** `js/physiology-engine.js:2878-2933`; `js/hovorka.js:624-653`
**STATUS:** ✅ FIKSET (2026-07-22, lokal ændring; ikke committet)

`addFood()` validerer makronæringsstoffer, vægt og spisetid, men ikke felterne i `carbParams`: `simpleFraction`, `fiberPerGram` og `retentionFactor`. En enkelt `NaN` i `simpleFraction` går videre til mavekompartmentet, dynamisk `tau_G`, tarmtilførsel og derefter alle glukosetilstande.

Numerisk probe:

```text
addFood({ carbs: 10, carbParams: { simpleFraction: NaN, ... } })
step(2)
=> trueBG=NaN, tau_G=NaN, D1=NaN, stomachCarbsSimple=NaN
```

JSON viser disse værdier som `null`, men de underliggende JavaScript-værdier er `NaN`. Den efterfølgende ikke-negativ-clamp fanger dem ikke, fordi sammenligning med `NaN` altid er falsk.

Det normale madkatalog leverer gyldige værdier, så standardspillet rammes ikke. Problemet er vigtigt for editor, labs og fremtidig offentlig engine-brug, hvor motoren lover fail-fast-inputvalidering.

**Anbefaling:** Validér alle tre felter med endelige tal og fysiologiske intervaller, og indfør en invariantkontrol efter hvert offentligt `step()`, der kaster en præcis fejl ved en ikke-endelig kernetilstand.

**Løsning og verifikation (2026-07-22):** Et helt `carbParams`-objekt kan fortsat
udelades og bruger da `mixed`-standardværdierne. Leveres objektet, kræves alle tre
felter som endelige tal før måltids-state, events eller callbacks oprettes:
`simpleFraction` [0,1], `fiberPerGram` [0,10] og `retentionFactor` [0,10]. De brede
øvre grænser beskytter API'et uden at afvise fiberrige fødevarer. Efter hvert
offentligt step kontrolleres desuden alle 16 Hovorka-tilstande, `tau_G` og `trueBG`;
fejlen navngiver den første ikke-endelige tilstand. API-testen dækker NaN, Infinity,
manglende felter, negative værdier, sideeffektfri afvisning, en gyldig
høj-fiber-værdi og en bevidst forgiftet Q1-state.

### ADVARSEL 3 — Leverens glykogendepot er ikke fuldt massebalanceret

**Filer:** `js/physiology-engine.js:1152-1166`, `:2080-2215`; `js/simulator.js:758-779`; `docs/MODEL-IMPLEMENTATION.md` afsnittet om leverglykogen
**STATUS:** ⚠️ BY DESIGN (2026-07-22) — bevaret som dokumenteret kapacitetsestimat; fuld massebalance er planlagt som en senere modeludvidelse

Depotet er internt bogført i gram, men to væsentlige strømme mangler den modsatte side i blodets glukosemasse:

- `scaledExercise` indgår i `totalConsumption` og tømmer leverdepotet under motion, men der tilføjes ingen tilsvarende glukose til `Q1` eller til Hovorkas EGP. Den blodvendte `stressBase` indeholder basal glykogenolyse, GNG, stress og dawn, men ingen direkte motions-`exerciseEGP`.
- `postprandialStorage` fylder leverdepotet ved høj BG og tilstrækkeligt `x3`, men den lagrede glukose trækkes ikke fra `Q1`.

Glucagon-injektionen er derimod korrekt dobbeltbogført: gram trækkes fra depotet, omregnes til mmol og tilføjes `Q1`.

Primære tracerstudier viser, at endogen glukoseproduktion ændres under motion og bidrager direkte til plasma-glukosebalancen. Den aktuelle motionsdrænning fungerer derfor som en heuristisk ændring af fremtidig EGP-kapacitet, ikke som en massebalanceret akut leverstrøm.

**Impact:** Modellen kan undervurdere leverens akutte bidrag under motion og samtidig reducere den efterfølgende modregulation via et tømt depot. Efter et måltid kan den skabe leverglykogen uden at dæmpe blodkurven tilsvarende. Størrelsen afhænger af scenariet og kræver før/efter-kalibrering.

**Anbefaling:** Vælg eksplicit mellem:

1. et heuristisk kapacitetsdepot, hvor “mass-balanced” fjernes fra kode og dokumentation, eller
2. et reelt massebalanceret depot, hvor alle leverstrømme kobles til `Q1`/EGP og kalibreres igen mod måltids- og motionstests.

Mulighed 2 er en non-triviel modelændring og kræver et decision-doc samt nye kvantitative regressionsmål.

**Beslutning og dokumentation (2026-07-22):** Den nuværende mekanisme bevares
uden ændring af ligninger eller kalibrering. `liverGlycogenGrams` betegnes nu som
et estimeret kapacitetsdepot. Dokumentation, kodekommentarer og testnavne angiver
eksplicit, at motionsdrænet ikke har et modsvarende akut Q1-input, og at
postprandial lagring ikke trækkes fra Q1. Kun glucagoninjektionens overførsel fra
leverdepot til Q1 beskrives som massebevarende. En fuldt massebalanceret levermodel
forbliver et særskilt fremtidigt arbejde med ny kalibrering.

### ADVARSEL 4 — Vist basaldosis og faktisk injektionsinput har forskellige definitioner

**Filer:** `js/physiology-engine.js:716-745`, `:1295-1310`, `:2943-2997`; `js/hovorka.js:241-287`
**STATUS:** ✅ FIKSET (2026-07-22, lokal ændring; ikke committet)

Efter steady-state-søgningen sættes:

```text
basalDose = round(steadyStateBasalRate × 1440 / 1000)
```

For standardprofilen giver det 13 U/døgn fra et nødvendigt effektivt input på 13,48 U/døgn. En ny spillerinjektion får samtidig fast `sessionBioavBasal = 0.82`, så en vist dosis på 13 U kun leverer cirka 10,66 effektive enheder til depotberegningen. Den skjulte initiale preload kompenserer derimod ved at dividere med biotilgængeligheden og starter derfor korrekt ved steady state.

Det betyder, at “modellens steady-state-behov” og “den dosis spilleren skal injicere for at levere dette behov” ikke er samme størrelse, selv om UI- og testkommentarer behandler dem som samme tal.

Det er ikke forsvarligt blot at ændre tallet til `dose/0.82`: døgnprofil, afrunding, timing, dawn og den empiriske PK-kalibrering påvirker den dosis, der giver den ønskede kurve. Først skal projektet beslutte, om 0,82 repræsenterer en reel tabt fraktion, eller om den er en intern amplitudefaktor, som allerede er absorberet i den øvrige kalibrering.

**Anbefaling:** Definér separat `effectiveBasalRequirement` og `displayedInjectionDose`, og kalibrér spillerens anbefalede interval mod gentagne døgn i den faktiske engine for hver karakter.

**Løsning og verifikation (2026-07-22):** Motoren skelner nu mellem
`effectiveBasalRequirement`, `basalInjectionRequirement` og den afrundede
`basalDose`. Injektionsbehovet beregnes som det effektive behov divideret med
`sessionBioavBasal = 0.82`. En deterministisk 3-døgnstest giver 7, 16 og 34 U for
de tre kropsprofiler og slutter henholdsvis ved 6,10, 5,91 og 5,29 mmol/L mod et
steady-state-mål på 5,5 mmol/L. Den tidligere kontrakt sluttede ved 9,51, 9,94 og
9,34 mmol/L. De præcise interne værdier vises ikke som anbefalinger. Bane 1 viser
i stedet et groft interval knyttet til den valgte karakter ved navn: 5-10 E for
barnet, 10-20 E for den voksne og 30-40 E for den store voksne. Desktop og mobil
bruger de samme grove kontrolværdier fra `js/dose-controls.js`. Se
`docs/reviews/2026-07-22_basal-dose-contract-fix.md`.

### ADVARSEL 5 — Steady-state-søgningen kan fejle lydløst

**Filer:** `js/hovorka.js:241-287`; `js/physiology-engine.js:360-365`, `:716-729`
**STATUS:** ✅ FIKSET (2026-07-22, lokal ændring; ikke committet)

Den binære søgning er fastlåst til 0,5–20,0 mU/min og kontrollerer ikke, om mål-BG faktisk er nået. Samtidig accepterer engine-API'en profiler op til 500 kg og ISF ned til 0,1 mmol/L/U.

Målrettet probe:

| Profil | Returneret rate | Slut-BG efter “steady state” |
|---|---:|---:|
| 100 kg, ISF 2,0 | 19,22 mU/min | 5,50 mmol/L |
| 150 kg, ISF 1,0 | 20,00 mU/min | 15,70 mmol/L |
| 200 kg, ISF 0,5 | 20,00 mU/min | 18,45 mmol/L |

De to sidste profiler er ekstreme, men gyldige efter den offentlige validering. Motoren returnerede dem som initialiseret steady state uden at gøre opmærksom på restfejlen. De korrekte adaptive rater er henholdsvis 54,01 og 141,87 mU/min.

**Løsning og verifikation (2026-07-22):** Den historiske søgning i 0,5–20 mU/min
bevares uændret for normale profiler. Kun hvis slutresultatet ligger ved en grænse
og afviger mere end 0,02 mmol/L fra mål-BG, udvides intervallet adaptivt mod 0 eller
op til et eksplicit loft på 500 mU/min. Uopnåelige mål kaster `RangeError` med
grænse og opnået BG; øvrig manglende konvergens kaster en fejl med rate og restfejl.
Standardprofilens rate er fortsat bit-identisk (9,36295843124390 mU/min). Tests
dækker en profil under den gamle nedre grænse, en over den gamle øvre grænse,
rate-loftet og et mål over den insulinfrie ligevægt. Golden master 7/7,
simulation 166/166, klinisk ækvivalens 9/9 og standalone-paritet 10/10 består.

**Anbefaling:** Udvid søgeintervallet adaptivt, og kast en tydelig fejl hvis rategrænsen nås eller `abs(BG-target)` overstiger en fast tolerance. Tilføj tests ved både nedre og øvre profilgrænse.

### NOTE 1 — Dawn-variation når ikke circadian-ISF

**Fil:** `js/physiology-engine.js:2282-2337`
**STATUS:** ✅ FIKSET (2026-07-22, lokale ændringer)

Git-historikken viste, at `_dawnAmplitude` er en additiv HGP-amplitude omkring 0,15,
mens `dawnAmplitude` uden underscore blev indført som en separat, normaliseret
ISF-amplitude fra 0 til 1. De to størrelser kan derfor ikke kobles direkte.

Den døde reference er fjernet. `circadianISF` bruger nu eksplicit dawn-modulets
0 til 1-skalering: standardkurven forbliver 0,70 til 1,20, mens et halvt modul
giver 0,85 ved morgen-nadir og et slukket modul giver neutral 1,0. Daglig variation,
søvntab og kronisk stress varierer kun HGP-komponenten. Kodekommentarer,
MODEL-IMPLEMENTATION og regressionstests er synkroniseret.

### NOTE 2 — Delvis stressmodulskalering tømmer leverdepotet for hurtigt

**Fil:** `js/physiology-engine.js:1133-1166`, `:2100-2162`
**STATUS:** ✅ FIKSET (2026-07-22, lokale ændringer)

Ved `modules.stressResponse = 0.5` skaleres blodsidens akutte og kroniske stressbidrag til HGP med 0,5. Leverens stressbetingede glykogenforbrug beregnes derimod fra hele `acuteStressLevel` uden samme modulskala. Depotet kan derfor miste omtrent fuldt stressrelateret glykogen, mens blodet kun modtager det halve stressbidrag.

Standardspillet bruger 1,0 og påvirkes ikke. Fejlen vedrører den dokumenterede 0..1-labfunktion.

**Anbefaling:** Brug samme effektive stresskomponent på begge sider af koblingen, eller begræns modulet til boolesk on/off, hvis fractional physiology ikke skal understøttes.

**Løsning og verifikation:** `stressResponse`-skalaren føres nu til
`updateGlycogenReserve`, så det marginale akutte stressdræn skalerer lineært med
blodsidens stressbidrag. Ved modul 0 fortsætter leverens basal-, protein-, motions-
og recoveryflows; kun stress/HAAF-udvikling og stressdræn er slået fra.
Regressionstests verificerer 100 %, 50 % og 0 % stress samt motion ved slukket
stressmodul.

### NOTE 3 — Dokumentation og testnavne beskriver ældre modelversioner

**Filer:** `docs/MODEL-IMPLEMENTATION.md:193`, `:257-258`, `:571`, `:1529-1605`; `js/physiology-engine.js:2346-2417`; `tests/simulation.test.js` motionsafsnittet
**STATUS:** ✅ FIKSET (2026-07-22, lokale ændringer)

Konkrete uoverensstemmelser:

- Oversigtstabellen kalder motions-ISF en to-komponentmodel; det senere afsnit og koden bruger tre komponenter.
- Oversigten siger, at `kb1/kb2/kb3` skaleres direkte hver tick; den aktuelle muskelkanal bruger Hill-parametre (`xmax`/`EC50`) og en separat hepatisk kanal.
- Basalteksten siger 4 timers ramp-up; koden bruger 2 timer.
- Kodekommentarer omtaler sen PEIS-halveringstid som 14 timer; konstanten og hoveddokumentationen bruger 18 timer.
- Flere tests består stadig med labels som “to-komponent model”.
- “Mass-balanced” om leverdepotet er for stærkt formuleret, jf. advarsel 3.

Det ændrer ikke beregningen, men gør modellen sværere at auditere og kan få en senere udvikler til at “rette” den forkerte version.

**Anbefaling:** Synk dokument og kommentarer efter modelbeslutningerne ovenfor. Dokumentationsoprydningen bør først ske efter den eventuelle lever-/basalændring, så teksten ikke omskrives to gange.

**Løsning og verifikation (2026-07-22):** Oversigtstabellen og modeldiagrammet
beskriver nu muskelkanalernes Hill-respons, den lineære leverkanal og PEIS som en
tre-komponentmodel. Kodekommentarerne bruger den implementerede sene halveringstid
på 18 timer, og testnavnene siger tre komponenter. Basalens ramp-up er synkroniseret
til 2 timer. Leverdepotet kaldes konsekvent et kapacitetsestimat; den
massebevarende betegnelse er afgrænset til glucagonoverførslen og det separate
muskelglykogendepot.

## Kendte og accepterede modelbegrænsninger

Følgende tidligere fund er stadig til stede. De er ikke nye regressionsfejl:

- **F01c ved høj BG:** Den glatte funktion kan overstige basal F01 med cirka 7–14 % ved markant hyperglykæmi. **STATUS:** ⚠️ BY DESIGN / dokumenteret forenkling.
- **Renal glukoseudskillelse:** Den lineære clearance er relativt svag ved alvorlig hyperglykæmi og modellerer ikke personvariation i nyretærskel. **STATUS:** ⚠️ BY DESIGN.
- **Brain-energy-deficit:** Bruger hele Hovorkas F01-pulje som proxy, selv om F01 også omfatter erytrocytter, nyremarv og andet insulin-uafhængigt forbrug. Game-over-tærsklen er empirisk kalibreret til denne proxy. **STATUS:** ⚠️ BY DESIGN; kommentarer bør være præcise.
- **EGP og perifer disposition:** EGP kan clamps til nul ved stærk insulinvirkning, og perifer disposition har ikke eksplicit GLUT4-/substratmætning. Det er simplificeringer tæt på den oprindelige kontrolmodel, ikke fulde organmodeller. **STATUS:** ⚠️ BY DESIGN.

## Prioriteret opfølgning

1. **FIKSET 2026-07-22:** Standalone-importen og de forældede API-forventninger er rettet uden ændring af fysiologien.
2. **FIKSET 2026-07-22:** `NaN`-hullet er lukket, og finite-state-invarianten er indført.
3. **FIKSET 2026-07-22:** Steady-state-søgningen er adaptiv og verificerer konvergens.
4. **FIKSET 2026-07-22:** Basaldosis-kontrakten er opdelt i effektivt behov og injektionsbehov og verificeret i faktiske flerdøgnsforløb.
5. **BY DESIGN 2026-07-22:** Leverens nuværende reserve bevares som et dokumenteret kapacitetsestimat. En senere reel massebalance kræver litteraturtargets, decision-doc og før/efter-regressioner.
6. **FIKSET 2026-07-22:** Dokumentation, kodekommentarer og testnavne er synkroniseret.

## Konklusion

Der er god logisk konsistens i Hovorka-kernen, integrationsrækkefølgen og de normale gameplay-scenarier. Testdækningen er usædvanligt stærk for et browserbaseret fysiologisk spil. Den overordnede model kan derfor fortsat bruges som en stabil uddannelsessimulator for fiktive karakterer.

Det svageste resterende område er ikke kernens ODE'er, men kontrakten mellem leverglykogen-reserven og blodets glukosemasse. Begrænsningen er nu eksplicit dokumenteret: den nuværende reserve estimerer kapacitet, mens en senere fuld levermodel skal koble alle relevante strømme til Q1 og kalibreres på ny.

## Status-opsummering

- Fikset: 4 advarsler (direkte Node-API, `carbParams`/finite-state, steady-state-konvergens og basaldosis-kontrakten) samt 3 noter (dawn-amplituder, fractional stresskobling og dokumentationsdrift).
- Åbne advarsler: 0.
- Åbne noter: 0.
- Accepterede modelbegrænsninger: 5, inklusive leverens kapacitetsestimat.
