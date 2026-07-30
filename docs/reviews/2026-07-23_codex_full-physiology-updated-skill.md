# Fysiologisk helhedsreview med opdateret phys-reviewer-skill

**Dato:** 2026-07-23
**Reviewer:** Codex
**Scope:** Hovorka-kernen, den udvidede fysiologimotor, simulatorfacaden, campaign-starttilstande, Box Challenge-respawn, interventions-API'er, dokumentation og testbevis
**Kodeændringer:** Ingen. Denne fil er kun en reviewrapport.
**Snapshot:** Git `321fa7f1b359c214e865e44939e7396605818b5c` plus samtidige, ikke-committede motionændringer aflæst og testet kl. 13:22.

De fire vigtigste snapshot-hashes er:

- `hovorka.js`: `75FCF67A`
- `physiology-engine.js`: `2D6B918D`
- `simulator.js`: `6063C205`
- `simulation.test.js`: `B300B3C6`

## Samlet vurdering

Den numeriske kerne fremstår stabil i de undersøgte normal-, ekstrem- og tidsstegsscenarier. Hovorka-ligningerne, den bare `PhysiologyEngine` og `Simulator`-facaden er fortsat indbyrdes konsistente. Der blev ikke fundet en ny numerisk ustabilitet eller en ny fortegns-/enhedsfejl i Hovorka-kernen.

Reviewet fandt fem problemer i tilstandsinitialisering, respawn, inputvalidering og valideringsdesign. Startbasal-, respawn- og inputvalideringsfundene er efterfølgende rettet lokalt:

- **KRITISK: 0 åbne, 1 fikset**
- **ADVARSEL: 0 åbne, 3 fikset**
- **NOTE: 0 åbne, 1 fikset**
- **OK/BY DESIGN: 4 grupper**

Det vigtigste fund er, at campaign level 2 konfigurerer `basalPreInjected: false`, men konstruktøren opretter den skjulte basaldosis alligevel. Spilleren bliver samtidig bedt om selv at tage basal. I et deterministisk 24-timers forsøg sænkede dobbelt basal nadir fra 5,75 til 3,20 mmol/L.

Det næstvigtigste fund var, at Box Challenge-respawn kunne initialisere insulinvirkning ud fra fysiologiske modifikatorer fra før livstabet. Fundet er efterfølgende rettet og regressionsbeskyttet ved to tidssteg.

Cardio/styrke/mix var under aktiv omskrivning, mens reviewet blev udført. Reviewet har derfor kontrolleret integration, kontinuitet, ablation og numerisk robusthed i det konkrete snapshot, men betragter ikke motionskalibreringen som endeligt valideret mod litteraturen.

## Metode

Reviewet fulgte den opdaterede skills krav om at spore:

1. subsystem og ejerskab af tilstand;
2. kilde → ligning/mekanisme → parameter → test;
3. enheder, fortegn, clamps og koblinger mellem subsystemer;
4. normale scenarier, ekstremer, interaktioner, ablationer og eventgrænser;
5. numerisk følsomhed ved mindst to tidssteg;
6. overensstemmelse mellem kode, `BG-SCIENCE.md`, `MODEL-IMPLEMENTATION.md`, beslutningsdokumenter og automatiske tests.

Der er ikke ændret kode, parametre, dokumentation eller testfixturer.

## Subsystem- og tilstandskort

| Subsystem | Primær tilstand | Primær implementering | Vigtigste koblinger | Reviewstatus |
|---|---|---|---|---|
| Hovorka-glukose/insulin | `Q1`, `Q2`, `D1`, `D2`, `S1/S2`, `S1b/S2b`, `I/Ir/Ib`, `x1/x2/x3`, `C` | `js/hovorka.js` | Måltid, insulin, EGP, renal clearance, motion, CGM | OK i undersøgte scenarier |
| Måltid, protein og fedt | Mave-/tarmdepoter, aminosyrer, FFA, `tau_G`, COB | `js/physiology-engine.js` | Hovorka `D1`, protein-glukagon, FFA-resistens, ketoner | OK i eksisterende tests |
| Stress, dawn og HAAF | Akut/kronisk stress, pending-pulje, counter-regulation, circadian faktorer | `js/physiology-engine.js` og facade-API i `js/simulator.js` | EGP, insulinresistens, leverglykogen | Inputkontrakt fikset og regressionsbeskyttet |
| Motion | `activeAktivitet`, `activeMotion`, `E1/E2`, muskelglykogen, `exerciseHepaticDrive` | Begge modelfiler samt aktivitetskatalog i `js/simulator.js` | Muskeloptag, EGP, PEIS, stress, mavetømning | API-integration fikset; kalibrering fortsat igangværende |
| Lever/glykogen/glukagon | Leverreserve, `glycogenReserve`, aktiv glukagonfrigivelse | `js/physiology-engine.js` | Stress, motion, protein, EGP og rescue | Kernetests OK; browservalidering er konfunderet |
| Ketoner og acidose | FFA-lipolyse, BHB, acidosebelastning | `js/physiology-engine.js` | Plasma-insulin, motion, DKA-game-over | OK og tidsstegsrobust |
| Game/campaign-start | Level-config, skjult basalhistorik, starttid | `js/levels.js` og `js/simulator.js` | Basal-PK, læringsmål, tips | Kritisk starttilstandsfejl |
| Box Challenge-respawn | Hovorka-state samt alle udvidede fysiologitilstande | `Simulator._resetToStableBG()` | Alle aktive og forsinkede fysiologieffekter | Ufuldstændigt reset |

## Evidensspor

| Kilde/vidensgrundlag | Mekanisme i modellen | Parameter/struktur | Testbevis og begrænsning |
|---|---|---|---|
| Hovorka et al. 2004 | 16 ODE-tilstande for glukose, insulin, tarm og insulinvirkning | `V_G`, `V_I`, `k_12`, `k_e`, `k_a*`, `k_b*`, `F01`, `EGP0` m.fl. | 180/180 Node-tests, paritet og tidsstegsforsøg bestod |
| Young 2023, Yardley 2013, T1DEXI og Rempel 2018 | Type- og intensitetsspecifik motion med separat kontraktionsoptag og leverrespons | `contractionUptakeScaling`, `hepaticDriveRate`, `hepaticDriveCeiling` | Nye styrke-, ablations- og tidsstegstests bestod; ekstern matrix er ikke frosset |
| Cartee 2015, Mikines 1988 og Riddell 2017 | Hurtig, tidlig og sen efterfølgende insulinfølsomhed | Forsinket rektangulær respons, halveringstider og type-skalering | Kontinuitet og +24/+48/+120 timers kontrakter består; uafhængig holdout mangler |
| Carstensen 1994-framing i projektdokumentationen | Glukagon frigiver op til 35 g via en trekantprofil | Peak-frigivelse ved 12 min, samlet varighed 45 min | Node-test med IOB består; F.4/F.5 i browsertesten isolerer ikke mekanismen |
| Projektets tidligere reviews og beslutningsdokumenter | Bevidste forenklinger i lever, nyre, hjerneproxy og ikke-lineær insulinvirkning | Dokumenterede clamps og kalibreringsvalg | Genfundet som kendte grænser, ikke nye fejl |

---

## KRITISK 1 — `basalPreInjected: false` ignoreres i campaign level 2

**STATUS: ✅ FIKSET (2026-07-23, lokal ændring på `codex/physiology-followups`)**

Startdepotet oprettes nu kun, når `basalPreInjected !== false`. Et eksplicit
`false` bevarer den fysiologiske plasma-/effekttilstand fra steady state som en
aftagende overgang, men opretter ingen skjult aktiv injektion. Regressionstests
dækker `false`, `true`, manglende felt og præcis ét depot efter spillerens første
basaldosis. Se `docs/reviews/2026-07-23_campaign-start-basal-fix.md`.

### Observation

Level 2 (`dag2_dawn`) angiver eksplicit:

```js
basalPreInjected: false // Player still administers basal themselves
```

I konstruktørens første behandling af campaign-konfigurationen forsøges den præinjicerede basal fjernet med `this.activeLongInsulin = []`. På dette tidspunkt er depotlisten endnu ikke blevet oprettet.

Senere kaldes `engine.initSteadyState({ establishDepot: false })`, hvorefter konstruktøren ubetinget kalder `addLongInsulin(...)` og efterjusterer det nye depot. Der er ingen ny betingelse på `basalPreInjected`. Resultatet er, at `false` og `true` giver samme skjulte aktive dosis.

### Direkte test

Med identisk profil og seed gav både `basalPreInjected: false` og `true`:

- 1 aktiv langtidsinsulindosis;
- alder 16 timer;
- dosis 12,697 U.

I level 2 bliver spillerens registrerede handling undersøgt separat af campaign-tiplogikken. Den skjulte konstruktørdosis tæller derfor ikke som spillerens basal, og spilleren kan blive bedt om at tage en ny fuld dosis oven i den skjulte.

### Kvantitativ konsekvens

Deterministisk 24-timers forløb med 70 kg, ISF 3 og ICR 10:

| Forløb | Nadir | Tidspunkt for nadir | Maksimum | BG efter 24 timer |
|---|---:|---:|---:|---:|
| Aktuel kode: skjult basal + spillerbasal ved start | 3,195 mmol/L | 271 min | 9,21 | 7,86 |
| Kontrol: skjult depot fjernet + én spillerbasal | 5,751 mmol/L | 68 min | 12,21 | 8,32 |

Hvis spilleren venter til kl. 08:00 med den tilsigtede basaldosis, er BG ved dosering 8,53 mmol/L med den skjulte dosis mod 16,70 mmol/L uden den. Den skjulte basal maskerer dermed den fysiologiske og pædagogiske konsekvens af manglende basal med cirka 8,2 mmol/L på dette tidspunkt.

### Hvorfor det er kritisk

Fejlen kan både:

- fremkalde næsten-hypoglykæmi, når spilleren følger den tilsigtede handling;
- lære spilleren en forkert årsagssammenhæng, fordi manglende basal allerede er skjult kompenseret;
- gøre campaign-tip og fysiologisk state uenige.

### Anbefalet løsning og regressionstest

Oprettelsen af startdepotet skal betinges dér, hvor depotet faktisk oprettes. Det skal samtidig besluttes eksplicit, om `basalPreInjected: false`:

1. kun fjerner injektionshistorikken, men beholder en basal steady-state i Hovorka-skyggekaskaden; eller
2. starter uden både depot og residual basalvirkning.

Tilføj en regressionstest, der sammenligner `false`, `true` og manglende felt, samt en level 2-test der verificerer præcis ét depot efter spillerens første basalhandling.

**Kode:** `js/levels.js:346`, `js/simulator.js:644-650`, `js/simulator.js:880-900`.

---

## ADVARSEL 1 — Box Challenge-respawn afhænger af fysiologien før livstabet

**STATUS: ✅ FIKSET (2026-07-23, lokal ændring på `codex/physiology-followups`)**

Alle skjulte motions-, stress- og resistensdrivere nulstilles nu før
`steadyStateActions()` og Q2 beregnes. Hovorka-modifikatorerne genopbygges
eksplicit fra den rene post-respawn-tilstand, mens den aktuelle døgnvariation
bevares. `exerciseHepaticDrive` og ventende kronisk stress nulstilles også.
En invarians-test sammenligner ren og kraftigt kontamineret før-tilstand efter
120 minutter ved tidssteg 1,0 og 0,25 minutter. Se
`docs/reviews/2026-07-23_box-respawn-state-fix.md`.

### Observation A: insulinvirkning beregnes før modifikatorerne ryddes

`_resetToStableBG()` beregner `x1/x2/x3` via:

```js
const ssAct = this.hovorka.steadyStateActions(I_ss);
```

På dette tidspunkt kan Hovorka stadig have `_amplitudeMod` og `_peisMuscleFactor` fra stress, FFA-/glukotoksisk resistens, circadian variation eller motion før livstabet. Først bagefter ryddes aktivitet, stress og resistens.

Det betyder, at respawnens `x1/x2/x3` og afledte `Q2` kan blive initialiseret forskelligt ved samme mål-BG, alene afhængigt af den skjulte state før livstabet.

### Kontrolleret ablation

Ved mål-BG 7,0 mmol/L blev et rent reset sammenlignet med et reset, hvor Hovorka før kaldet havde:

- amplitude-modifikator 0,48;
- PEIS-faktor 1,8.

BG efter 120 minutter:

| Tidssteg | Rent reset | Reset fra gamle modifikatorer | Forskel |
|---:|---:|---:|---:|
| 1,00 min | 6,0449 | 6,5219 | +0,4770 |
| 0,50 min | 6,0466 | 6,5233 | +0,4767 |
| 0,25 min | 6,0474 | 6,5241 | +0,4767 |

Forskellen er konvergent på tværs af tidssteg og er derfor ikke Euler-støj.

### Observation B: `exerciseHepaticDrive` nulstilles ikke

Respawn rydder `activeAktivitet`, `activeMotion`, E1/E2, stress og flere andre effekter, men ikke `exerciseHepaticDrive`. En høj styrkesession kan legitimt nå loftet 1,0.

Med `exerciseHepaticDrive = 1` umiddelbart før respawn:

- blev værdien bevaret efter reset;
- var BG efter 30 minutter 8,339 mod 6,665 mmol/L i kontrol;
- var BG efter 120 minutter 8,575 mod 6,045 mmol/L i kontrol;
- var leverdriveren stadig 0,0625 efter 120 minutter.

Det giver 2,53 mmol/L forskel to timer efter et reset, der beskrives som en fysiologisk frisk start.

### Testhul

Den eksisterende Box Challenge-test kontrollerer umiddelbar BG, hjerneunderskud og antal liv. Den kontrollerer ikke:

- at forsinkede fysiologiske drivere er nul;
- at insulinvirkningsstate er uafhængig af state før livstabet;
- at BG-forløbet forbliver ens de efterfølgende timer.

### Anbefalet løsning og regressionstest

Alle tilstande, der skal ryddes, bør nulstilles før steady-state-handlinger beregnes. Hovorka-modifikatorerne bør sættes eksplicit til den valgte post-respawn-baseline, før `steadyStateActions()` og `Q2` beregnes. `exerciseHepaticDrive` skal indgå i resetkontrakten.

Tilføj en invarians-test med flere før-tilstande og mindst tidssteg 1,0 og 0,25 min. Sammenlign både umiddelbar state og to timers drift.

**Kode:** `js/simulator.js:3529`, `js/simulator.js:3606-3607`; initialisering og brug af leverdriver i `js/physiology-engine.js:657`, `js/physiology-engine.js:1269`.

---

## ADVARSEL 2 — Stress-API'et kan injicere NaN eller negative puljer

**STATUS: ✅ FIKSET (2026-07-23, lokal ændring på `codex/physiology-followups`)**

Stressinterventionerne ejes nu af `PhysiologyEngine`, som validerer endelige,
ikke-negative værdier og dokumenterede maksimummer før mutation eller event.
Facaden delegerer til disse atomare metoder. Tests sammenligner komplet
engine-snapshot før og efter NaN, negative og for store input. Se
`docs/reviews/2026-07-23_intervention-atomicity-fix.md`.

### Observation

De engine-native API'er for mad og insulin bruger `requireNumber()` før sideeffekter. Facadens stressmetoder gør ikke:

```js
addAcuteStress(amount) {
    this.acuteStressLevel = Math.min(0.4, this.acuteStressLevel + amount);
}

addChronicStress(amount) {
    this._pendingChronicStress += amount;
}
```

### Grænsetest

- `addAcuteStress(NaN)` spredte NaN til Hovorka `Q1`; næste engine-step stoppede på ikke-endelig state.
- `addAcuteStress(-1)` blev først korrigeret tilbage mod nul under næste opdatering.
- `addChronicStress(NaN)` efterlod pending-puljen som NaN og deaktiverede i praksis efterfølgende kronisk stress uden et tydeligt stop.
- `addChronicStress(-1)` kunne modregne senere legitim positiv stress.
- Store positive værdier accepteres uden den API-grænse, som kommentarerne beskriver.

De nuværende campaign-events sender positive, endelige værdier, så dette er ikke en påvist fejl i de nuværende baner. Det er et numerisk integritetsproblem i en offentlig interventionsvej, som også er relevant for fremtidig editor, sygdom og søvnevents.

### Anbefalet løsning og regressionstest

Stressinterventioner bør følge samme kontrakt som mad og insulin:

- kræv endeligt tal;
- kræv ikke-negativ værdi;
- dokumentér og håndhæv eventuelt maksimum;
- mutér ikke state og emit ikke event ved afvisning.

**Kode:** `js/simulator.js:2432-2450`.

---

## ADVARSEL 3 — Aktivitets-API'et har sideeffekter før validering og accepterer en tvetydig nulvarighed

**STATUS: ✅ FIKSET (2026-07-23, lokal ændring på `codex/physiology-followups`)**

Aktivitetstype, intensitet, varighed og alle fysiologiske typefelter valideres nu
før callback, søvnregistrering, RNG og event-emission. `null` betyder fortsat en
åben session, mens `0` afvises tydeligt. Atomaritets-tests dækker ukendt type,
ukendt intensitet, ufuldstændig type-definition og nulvarighed. Se
`docs/reviews/2026-07-23_intervention-atomicity-fix.md`.

### Observation A: ukendt aktivitet giver sideeffekter

`startActivity()` validerer cooldown og kalder derefter `onAccept()` samt `registerNightIntervention()`. Først bagefter slås aktivitetstypen op. En ukendt type returnerer derfor `false`, men kan allerede have påvirket spil- og søvnstate.

Direkte test kl. 00:00 med ukendt aktivitet:

- returværdi: `false`;
- `onAccept()` blev kaldt én gang;
- tabt søvn steg fra 0 til 0,938 timer;
- events `sleep-disruption` og `sleep-pop` blev udsendt.

En afvist intervention er dermed ikke atomar.

### Observation B: `durationMin: 0` betyder ikke nul minutter

Valideringen tillader minimum 0. Auto-stop bruger derimod:

```js
if ((akt.varighed && elapsed >= akt.varighed) || elapsed >= 240)
```

Fordi `0` er falsy, stopper sessionen ikke ved nul. Den fortsætter til det hårde loft på 240 minutter, medmindre spilleren stopper den manuelt.

Direkte test viste, at aktiviteten stadig var aktiv efter første minut.

### Scope i forhold til den samtidige motionsrevurdering

Dette fund handler om interventionskontrakten og eventrækkefølgen, ikke om cardio/styrke/mix-parametrenes fysiologiske kalibrering. Den nuværende UI sender kendte typer og positive standardvarigheder, men standalone-API'et og fremtidige events er eksponerede.

### Anbefalet løsning og regressionstest

Slå type og intensitet op, og valider hele specifikationen, før callback, RNG, søvnregistrering eller event-emission. Vælg én tydelig kontrakt:

- `durationMin` skal være større end 0; eller
- `null` er open-ended, mens 0 afsluttes uden fysiologisk eksponering.

Tilføj atomaritets-tests, som sammenligner hele state og eventbuffer før og efter afviste kald.

**Kode:** `js/physiology-engine.js:3228-3248`, auto-stop ved `js/physiology-engine.js:1592-1600`.

---

## NOTE 1 — Glukagonens visuelle peakvalidering isolerer ikke glukagoneffekten

**STATUS: ✅ FIKSET (2026-07-23, lokal ændring på `codex/physiology-followups`)**

F.4 og F.5 bruger nu deterministiske, matchede kontrolarme med samme seed,
klokkeslæt, start-BG, basalstate og leverpulje. Testene måler inkrementel
`ΔBG(t)`, inkrementel AUC, tid til maksimal kurveforskel og kumuleret frigivet
masse. F.5 er samtidig omformuleret som en kapacitets-ablation og hævder ikke
længere, at 5 g-armen alene reproducerer faste- eller alkoholhypoglykæmi.
Browserkontrol viste 44/44 renderede testsektioner uden konsolfejl.

### Observation

F.4 i `tests/model-validation.html` starter ved lav BG, giver glukagon og sammenligner tidspunktet for det absolutte BG-maksimum med Carstensen-framingen på 20-30 minutter. Testen har ingen matchet kontrol uden glukagon.

Det absolutte BG-forløb påvirkes samtidig af:

- basalinsulin og eventuel aktiv insulinvirkning;
- hypo-modregulation;
- basal EGP;
- renal clearance;
- den valgte starttilstand.

Glukagonfrigivelsen varer desuden 45 minutter. Et absolut BG-maksimum kan derfor ligge senere end selve den inkrementelle glukagoneffekt, uden at frigivelsesprofilen nødvendigvis er forkert.

F.5 varierer leverpuljen til 90, 15 og 5 g, men bruger igen absolut BG-stigning uden matchet kontrol. Scenariet med 5 g betegnes som langvarig faste, selv om alkohol og andre årsager til klinisk glukagonsvigt ikke er modelleret.

### Hvad der allerede er dækket

Node-suiten har separate tests for:

- frigivet masse;
- glat trekantprofil;
- leverpuljebegrænsning;
- IOB-scenarie med BG-stigning i den dokumenterede Carstensen-range.

Fundet betyder derfor ikke, at glukagonmodellen er påvist forkert. Det betyder, at F.4/F.5 ikke kan bruges som et rent evidensbevis for peakkinetik eller klinisk svigt.

### Anbefalet validering

Kør matchet kontrol med samme seed, state og insulin, men uden glukagon. Mål:

- inkrementel `ΔBG(t)` mod kontrol;
- frigivelsesflux og kumuleret frigivet masse;
- inkrementel AUC;
- tid til peak i den inkrementelle kurve;
- særskilt protocol-match til insulininduceret hypo.

**Kode:** `tests/model-validation.html:3613-3653` og `tests/model-validation.html:3663-3709`.

---

## Igangværende motionsrevurdering — ikke lukket af dette review

De samtidige ændringer omlagde motionen, mens reviewet kørte. Snapshot'et indeholder blandt andet:

- separat `contractionUptakeScaling`;
- separat motionsudløst leverdriver;
- PEIS som forskydning af muskelkanalens EC50;
- en kontinuerlig forsinket respons, der oprettes ved aktivitetsstart;
- nye type-/intensitetskalibreringer for cardio, styrke og mix.

De aktuelle interne kontrakter er stærkere end før:

- styrke/live-optag og forsinket følsomhed testes separat;
- manuelt stop og auto-stop sammenlignes;
- optag, leverrespons, følsomhed og glykogen kan ablateres hver for sig;
- høj styrke er testet ved tidssteg 1,0, 0,5 og 0,25 min;
- der er ikke længere et stop-udløst spring i PEIS-testen.

Efter review-snapshot'et blev motionens parametersæt frosset og den planlagte
ikke-redundante kontekstmatrix blev gennemført:

- `tests/activity-validation.js` og de frosne mål i
  `tests/fixtures/activity-literature-targets.json` findes nu;
- 486/486 unikke fysiologiske scenarier var numerisk endelige;
- aktiv insulin forstærkede cardiofaldet i 54/54 sammenligninger;
- mixed-responsen lå mellem cardio og styrke i 162/162 sammenligninger;
- aktivitetsvalideringen gav 8 PASS, 3 PARTIAL, 3 NOT TESTABLE og 0 FAIL;
- golden master matcher 7/7 bit-identisk, og clinical equivalence matcher 9/9.

Den samlede motionsstatus er fortsat **PARTIAL**, ikke fordi en repræsenteret
mekanisme fejler, men fordi tre eksterne protokoller ikke kan identificeres med
den nuværende uddannelsesmodel: en særskilt 65 % VO₂peak-tilstand, eksplicitte
arbejds-/pauseintervaller og en Romeres-kompatibel IIRd/IDRd-dekomponering.
Den absolutte hvile-GIR i den virtuelle clamp er desuden et åbent fund i
grundmodellens insulinrespons og må ikke skjules ved at retune motionsparametre.

## Testresultater

### Automatiske suites

| Test | Resultat | Fortolkning |
|---|---:|---|
| `tests/physiology-engine-api.test.js` | 23/23 bestået | Offentlig engine-state, import/export, moduler og atomare interventioner |
| `tests/simulation.test.js` | 187/187 bestået | Bred fysiologi, motion, DKA, mad, insulin, glykogen, glukagon og moduler |
| `tests/standalone-parity.js` | 10/10 bestået | Bar engine og facade gav identiske fysiologiske resultater i scenarierne |
| `tests/character-moods.test.js` | Bestået | Ikke-fysiologisk støttecheck |
| `node --check` på centrale modelfiler | Bestået | Ingen syntaksfejl |

### Frosne baselines

- Golden master: 7/7 scenarier matcher den frosne post-revision-baseline bit-identisk.
- Clinical equivalence: 9/9 scenarier matcher den frosne post-revision-baseline.
- Standalone-pariteten for det nye motionssnapshot var stadig 10/10.

Baseline-afvigelserne er ikke i sig selv en fysiologisk fejl, men de viser, at motionsændringen endnu ikke er frosset som ny reference.

### Tidsstegsfølsomhed

| Scenarie | Metrik | dt 1,0 min | dt 0,5 min | dt 0,25 min |
|---|---|---:|---:|---:|
| Måltid + bolus, 360 min | Slut-BG | 6,6705 | 6,6489 | 6,6381 |
| Måltid + bolus, 360 min | Maks-BG | 7,2415 | 7,2541 | 7,2610 |
| Pumpesvigt, 720 min | Slut-BG | 19,0109 | 19,0081 | 19,0067 |
| Pumpesvigt, 720 min | Ketoner | 3,5745 | 3,5683 | 3,5652 |
| Pumpesvigt, 720 min | Acidosebelastning | 10,4137 | 10,1349 | 9,9971 |

Forløbene konvergerer uden fortegnsskift eller runaway. Acidosebelastningen er mest tidsstegsfølsom, men forskellen er lille i absolut størrelse og ændrer ikke den kliniske klassifikation i forsøget.

## Kendte, accepterede modelgrænser

Følgende blev kontrolleret mod de seneste reviews og tælles ikke som nye fejl:

1. **OK/BY DESIGN — Ikke-lineær insulinvirkning:** Muskelkanalerne bruger Hill-respons og PEIS-forskydning, mens leverens `x3` fortsat er en dokumenteret lineær tidlig-respons-approksimation.
2. **OK/BY DESIGN — Leverreserve:** Leverens glykogenpulje er fortsat et kapacitetsestimat og ikke fuldt massebalanceret mod alle blodvendte flows.
3. **OK/BY DESIGN — F01c, nyre og hjerneproxy:** Suprabasal F01c ved høj BG, relativt svag lineær renal clearance og brug af hele F01 som hjernebehovsproxy er kendte, dokumenterede forenklinger.
4. **OK/BY DESIGN — EGP og perifer disposition:** EGP-clamp ved nul og manglende eksplicit substratmætning er kendte grænser i den valgte kontrolmodel.

## Prioriteret handlingsrækkefølge

1. **FIKSET 2026-07-23:** Campaign level 2-startbasal respekterer nu `basalPreInjected: false` og er regressionsbeskyttet.
2. **FIKSET 2026-07-23:** Box Challenge-respawn er uafhængig af pre-respawn-modifikatorer, og `exerciseHepaticDrive` nulstilles.
3. **FIKSET 2026-07-23:** Stress- og aktivitetsinterventioner er atomare og valideres før sideeffekter.
4. **FIKSET 2026-07-23:** Glukagon F.4/F.5 bruger matchede kontroller og inkrementelle endpoints.
5. **DELVIST UDFØRT 2026-07-23:** Motionens parametersæt og litteraturmål er frosset, 486-scenariers matrixen er kørt, og baselines er opdateret. Resultatet er 8 PASS, 3 PARTIAL, 3 NOT TESTABLE og 0 FAIL; fuld ekstern validitet kan ikke erklæres for protokoller, modellen ikke repræsenterer.

## Filer og lokal evidens anvendt

### Kode og tests

- `js/hovorka.js`
- `js/physiology-engine.js`
- `js/simulator.js`
- `js/levels.js`
- `js/campaign-core.js`
- `tests/simulation.test.js`
- `tests/physiology-engine-api.test.js`
- `tests/model-validation.html`
- `tests/golden-master.js`
- `tests/clinical-equivalence.js`
- `tests/standalone-parity.js`

### Dokumentation og tidligere beslutninger

- `docs/BG-SCIENCE.md`
- `docs/MODEL-IMPLEMENTATION.md`
- `docs/reviews/2026-07-21_codex_full-physiology-logical-consistency.md`
- `docs/reviews/2026-07-22_codex_nonlinear-insulin-audit.md`
- `docs/reviews/2026-07-23_codex_model-validation-exercise.md`
- `docs/reviews/2026-07-23_codex_strength-training.md`
- `docs/reviews/2026-07-23_activity-simulation-validation-plan.md`
- `docs/reviews/2026-07-23_strength-exercise-calibration-fix.md`

### Relevante lokale kilder

- `docs/references/Hovorka_2004_NonlinearMPC.pdf`
- `docs/references/Young_2023_ResistanceExerciseGlucoseDynamicsT1D.html`
- `docs/references/Yardley_2013_ResistanceVsAerobicExerciseT1D.html`
- `docs/references/T1DEXI_2023_ExerciseTypesT1D.html`
- `docs/references/Rempel_2018_VigorousIntervalsT1D.html`
- `docs/references/Riddell_2017_RW_ExerciseManagementInType1Diabetes.pdf`
- `docs/references/Cartee_2015_RW_MechanismsPostExerciseInsulinStimulatedGlucoseUptake.html`

## Statusoversigt

| Nr. | Prioritet | Finding | Status |
|---:|---|---|---|
| 1 | KRITISK | Campaign level 2 ignorerer `basalPreInjected: false` | ✅ FIKSET (2026-07-23, lokal ændring) |
| 2 | ADVARSEL | Respawn arver insulinmodifikatorer og motionsudløst leverdriver | ✅ FIKSET (2026-07-23, lokal ændring) |
| 3 | ADVARSEL | Stress-API accepterer ikke-endelige og negative værdier | ✅ FIKSET (2026-07-23, lokal ændring) |
| 4 | ADVARSEL | Aktivitets-API har sideeffekter før validering og tvetydig nulvarighed | ✅ FIKSET (2026-07-23, lokal ændring) |
| 5 | NOTE | Glukagon F.4/F.5 isolerer ikke mekanismens inkrementelle effekt | ✅ FIKSET (2026-07-23, lokal ændring) |
