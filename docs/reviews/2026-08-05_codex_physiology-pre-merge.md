# Kritisk fysiologisk pre-merge-review

**Dato:** 2026-08-05  
**Reviewer:** Codex (`phys-reviewer`)  
**Branch:** `codex/public-insights`  
**Git-basis:** `8c82b2115260ca714054d6f823cea265eb8fdd52` plus den aktuelle, ikke-committede working tree  
**Scope:** Hovorka-kernen, PhysiologyEngine, Simulator-facaden, exercise/stress/sleep/PEIS, Hvad Nu Hvis-genberegning, eventgrænser, numerisk stabilitet samt sporbarhed mellem kode, dokumentation og tests  
**Ændringer foretaget af reviewet:** Kun denne rapport

## Samlet konklusion

Den aktuelle fysiologiske motor er overordnet logisk sammenhængende og numerisk
stabil ved de testede offentlige input. Den nye glatte styrke-PEIS-onset løser det
tidligere kunstige 120-minutters knæk uden at skabe et stop-tidsspring, og de
eksisterende regressions-, paritets- og aktivitetskontroller består.

Der er imidlertid **én merge-blokerende fejl** i forbindelsen mellem spillet og
Hvad Nu Hvis: En handling foretaget ved banestart kan blive indbygget i det
første engine-snapshot og derefter blive filtreret ud af listen over redigerbare
handlinger. Hvad Nu Hvis starter dermed fra en fysiologisk tilstand, som allerede
indeholder handlingen, men spilleren kan ikke flytte, ændre eller slette den.
Fejlen rammer netop sandsynlige bane-1-handlinger som basalinsulin ved 00:00.

Derudover er der tre ikke-blokerende fysiologi-/valideringsadvarsler: det gamle
PEIS-eksperiment standser reelt ved game over og producerer derfor falske
36/48/72-timers rækker; PEIS-sessionens 96-timers oprydning giver stadig et lille
ISF-spring; og den allerede dokumenterede akutte stressmodel øger kun leveroutput
og ikke eISF-resistens.

### Statusoptælling

| Kategori | Antal | Åbne | Merge-blokerende |
|---|---:|---:|---:|
| KRITISK | 1 | 0 | 0 |
| ADVARSEL | 3 | 3 | 0 |
| NOTE | 2 | 2 | 0 |
| OK | 7 | 0 | 0 |

**Fysiologisk merge-anbefaling:** **MERGE-BLOKEREN ER FJERNET.** KRITISK 1 er
rettet og beskyttet af regressionstests for alle fire handlingstyper ved
banestart. De øvrige fund kan planlægges separat, men ADVARSEL 1 bør rettes før
`peis-verification.js` igen bruges som evidens.

## Metode og dækningsområde

Reviewet fulgte den fulde `phys-reviewer`-arbejdsgang:

1. Kortlægning af working-tree-diff og tidligere reviews, så løste fund ikke
   blev genrapporteret.
2. Gennemlæsning af Hovorka-kernen, engine-livscyklus, integrationsrækkefølge,
   interventions-API'er, snapshot/import/export, aktivitets- og søvntilstande.
3. Kontrol af aktuelle dokumentationsændringer og de to nye
   styrke-PEIS-beslutningsdokumenter.
4. Kørsel af den samlede fysiologi-regression, dokumentmarkørkontrol,
   release-boundary-test og afgrænsede read-only-eksperimenter.
5. Særskilte eventgrænsetjek ved banestart, aktivitetens stop, den tidligere
   120-minuttersgrænse og PEIS-sessionens 96-timers oprydning.

### Centrale filer gennemgået

- `js/hovorka.js`
- `js/physiology-engine.js`
- `js/simulator.js`
- `js/editor.js`
- `docs/MODEL-IMPLEMENTATION.md`
- `docs/BG-SCIENCE.md`
- `docs/reviews/2026-07-23_codex_full-physiology-updated-skill.md`
- `docs/reviews/2026-07-23_strength-postexercise-peis-fix.md`
- `docs/reviews/2026-08-03_codex_level9-stress-event.md`
- `docs/reviews/2026-08-05_codex_e5-isf-delay.md`
- `docs/reviews/2026-08-05_strength-smooth-peis-onset-fix.md`
- `tests/physiology-engine-api.test.js`
- `tests/simulation.test.js`
- `tests/activity-validation.js`
- `tests/insulin-clamp-validation.js`
- `tests/peis-verification.js`
- `tests/golden-master.js`
- `tests/clinical-equivalence.js`
- `tests/standalone-parity.js`
- `tests/model-validation.html`
- `tests/public-release-boundary.test.js`

## Testresultater

### Automatiserede pakker

| Test | Resultat | Vurdering |
|---|---:|---|
| PhysiologyEngine API | 34/34 bestået | Grøn |
| Golden master | 7/7 bit-identiske | Grøn efter tilsigtet opdatering af cardio-fixture |
| Klinisk ækvivalens | 8/8 inden for tolerancer | Grøn |
| Standalone engine vs. facade | 10/10 | Grøn |
| Fuld simulationssuite | 197/197 | Grøn |
| Aktivitetsvalidering | 11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL | Samlet PARTIAL |
| Aktivitets-kontekstmatrix | 486/486 finite | Grøn numerisk robusthed |
| Offentlig release-grænse | Alle kontroller bestået | Grøn, men tester ikke fysiologisk snapshotgrænse |
| Dokumentmarkører | 2/2 gyldige | Grøn |

### Ekstern clamp-diagnostik

Den kendte absolutte clamp-afvigelse er uændret:

| Plasma-insulin | Model-GIR | Shetty hvile-reference |
|---:|---:|---:|
| 50 mU/L | 11,90 mg/kg/min | 4,4 ± 0,4 mg/kg/min |
| 60 mU/L | 14,50 mg/kg/min | 4,4 ± 0,4 mg/kg/min |
| 92 mU/L | 20,85 mg/kg/min | 4,4 ± 0,4 mg/kg/min |

Dette er allerede dokumenteret som en absolut baseline-begrænsning. De
motionsudløste *inkrementer* ligger bedre, men testen kan ikke kaldes en fuld
ekstern validering af den absolutte insulinvirkning. Fundet genåbnes ikke her,
fordi der ikke er sket en ny ændring af Hovorkas grundrespons.

---

## Fund

## KRITISK 1 - Første handling kan forsvinde fra Hvad Nu Hvis

**STATUS: ✅ FIKSET (2026-08-05) - start-snapshot + fire eventgrænsetests**

### Problem

Det første engine-snapshot oprettes ikke ved initialisering, men i den første
`_postStep()` efter at simulationen er begyndt (`js/simulator.js:1696-1701`).
Spilleren kan nå at give mad, basal eller bolus ved 00:00 før denne første tick.
Snapshot'et indeholder da allerede interventionens fysiologiske state.

Ved eksport vælges snapshot-tidspunktet som `windowStartMin`, og kun handlinger
med `event.t >= windowStartMin` eksporteres (`js/simulator.js:2104-2114`). En
handling ved minut 0 falder derfor ud, når det første snapshot er taget ved
minut 1. `hasMeaningfulInsightsCourse()` ser stadig handlingen i `scenarioLog`,
så Hvad Nu Hvis kan åbnes, men det modtager ingen redigerbar handling.

### Reproduktion

Et deterministisk, read-only Node-eksperiment udførte hver handling ved minut 0,
avancerede ét minut og eksporterede scenariet:

| Handling ved 00:00 | Snapshot | `playedUntilMin` | Loggede handlinger | Redigerbare handlinger | Effekt allerede i snapshot |
|---|---:|---:|---:|---:|---|
| 2 E bolus | minut 1 | 0 | 1 | 0 | 1 aktiv bolus |
| 20 E basal | minut 1 | 0 | 1 | 0 | 2 aktive basaldoser inkl. startdepot |
| Måltid | minut 1 | 0 | 1 | 0 | Aktivt måltid og aktiv mavekø |

Det er ikke blot en visningsfejl. Editorens genberegning importerer snapshot'et
som starttilstand (`js/editor.js:212-225`) og genafspiller kun de eksporterede
handlinger (`js/editor.js:290-340`). Den manglende handling er derfor fysiologisk
til stede, men kan ikke varieres eller fjernes.

### Konsekvens

- Bane 1 inviterer naturligt til basalinsulin straks ved start, så fejlen rammer
  en central læringssituation.
- Den uændrede Hvad Nu Hvis-kurve er ikke en genberegning fra et ægte
  før-handlingstidspunkt.
- Variationer kan fejlagtigt tolkes som alternative forløb, selv om den vigtigste
  første intervention er låst usynligt i starttilstanden.
- De nuværende tests kontrollerer kontraktens felter, men ikke at alle handlinger
  efter den valgte fysiologiske baseline faktisk kan redigeres.

### Anbefalet rettelsesretning

1. Opret et eksplicit engine-snapshot ved simulationens start **før** nogen
   spillerintervention kan ske.
2. Definér én konsekvent grænsekontrakt: snapshot'et er state umiddelbart før
   alle events med lokal tid 0, og disse events genafspilles præcis én gang.
3. Tilføj end-to-end-tests for mad, basal, bolus og aktivitet ved minut 0, ved
   første tick og ved midnatsskift.
4. Test både, at uændret genafspilning starter fra korrekt state, og at sletning
   af første handling reelt fjerner dens fysiologiske effekt.

### Implementeret løsning og verifikation

Simulatoren tager nu et engine-snapshot ved det færdiginitialiserede
starttidspunkt, før spilleren kan handle. Regressionstesten udfører mad, basal,
bolus og aktivitet ved minut 0, kører én simulationstick og kontrollerer for
hver handling, at den eksporteres ved lokalt minut 0, mens start-snapshot'et er
uændret.

---

## ADVARSEL 1 - `peis-verification.js` producerer ugyldige sene målepunkter

**STATUS: ❌ ÅBEN**

`tests/peis-verification.js` beskriver sig selv som et 36/48/72-timers
PEIS-eksperiment, men bruger `Simulator.update()` uden basalinsulin. BG stiger,
game over aktiveres, og `Simulator.update()` returnerer derefter uden at avancere
fysiologien (`js/simulator.js:1658-1661`). Scriptet kontrollerer ikke, om tiden
faktisk nåede målet.

Ved den aktuelle kørsel blev outputtet:

- Scenarie A frøs ved absolut minut 2135; rækkerne 24, 36, 48 og 72 timer havde
  samme tid, BG, ISF og glykogenværdi.
- Scenarie B frøs ved absolut minut 2336; rækkerne 36, 48 og 72 timer var
  identiske.

Scriptet kan derfor ikke bruges som evidens for sen PEIS-decay i sin nuværende
form. De egentlige automatiserede 12/24/48/72-timers tests består, så dette
blokerer ikke merge, men det svækker eksperimentel sporbarhed.

### Anbefaling

Flyt eksperimentet til den bare `PhysiologyEngine`, eller hold referenceforløbet
fysiologisk levedygtigt med en dokumenteret basal-/clamp-protokol. Assertér for
hver række, at `totalSimMinutes` svarer til det angivne tidspunkt, og stop med
fejl hvis simulationen er afsluttet tidligt.

---

## ADVARSEL 2 - 96-timers PEIS-oprydning skaber stadig et hårdt ISF-spring

**STATUS: ❌ ÅBEN**

De nye komponent-cutoffs er korrekt fjernet, men hele motionssessionen ignoreres
brat, når `totalSimMinutes >= sensitivityEndTime`
(`js/physiology-engine.js:2652-2654`). `sensitivityEndTime` sættes til præcis 96
timer efter stop (`js/physiology-engine.js:3468-3470`).

Med fuldt muskelglykogendepot, så kun den sene komponent er relevant, gav et
60-minutters medium pas følgende PEIS-fald ved grænsen:

| Aktivitet | PEIS lige før 96 t | PEIS ved 96 t | Relativt spring |
|---|---:|---:|---:|
| Cardio | 1,01072 | 1,00000 | -1,06 % |
| Styrke | 1,00483 | 1,00000 | -0,48 % |
| Blandet | 1,00911 | 1,00000 | -0,90 % |

Springet er lille og ligger sent, men dokumentationen siger aktuelt, at
session-oprydningen “prevents threshold-induced jumps in effective ISF”
(`docs/MODEL-IMPLEMENTATION.md:1675-1677`). Beslutningsdokumentet siger ligeledes,
at fjernelsen af komponent-cutoffs eliminerer springet, selv om der fortsat er
et session-cutoff ved 96 timer.

Den eksisterende “120h decay”-test kontrollerer kun, at effekten er lille ved
fem dage. Den sampler ikke umiddelbart før og efter 96-timersgrænsen og opdager
derfor ikke springet.

### Anbefaling

Brug en glat slut-taper eller behold sessionen, indtil bidraget er under en
meget lille dokumenteret tolerance. Tilføj en grænsetest ved
`endTime - ε`, `endTime` og `endTime + ε`. Hvis det hårde cutoff bevares som et
bevidst performancevalg, skal dokumentationen beskrive det ærligt.

---

## ADVARSEL 3 - Akut stress påvirker stadig ikke eISF

**STATUS: ❌ ÅBEN (tidligere dokumenteret; status bekræftet uændret)**

Dette er det åbne fund fra
`docs/reviews/2026-08-03_codex_level9-stress-event.md`, ikke et nyt fund.
`acuteStressLevel` øger leverens stressmultiplier og dermed EGP, men den
implementerede insulinresistens bruger kun `chronicStressLevel`. Den aktuelle
regressionstest fastslår direkte, at akut stress ikke må ændre eISF.

Det er internt konsistent med den nuværende bane-9-implementering, men
`BG-SCIENCE.md` beskriver også kortvarig katekolaminmedieret reduktion i
insulinmedieret glukoseudnyttelse. Modellen dækker derfor kun leverdelen af den
akutte stressrespons.

### Anbefaling

Bevar fundet som en eksplicit modelbegrænsning, indtil en separat litteraturbundet
kalibrering kan skelne akut leverrespons fra perifer insulinresistens. Det skal
ikke løses ved blot at genbruge den kroniske stressfaktor uden nye endpoints.

---

## NOTE 1 - Brugerdefinerede aktivitetstyper valideres kun som endelige tal

**STATUS: ❌ ÅBEN**

`startActivity()` kræver, at type-definitionens felter er finite, men kontrollerer
ikke fysiologiske fortegn eller rimelige intervaller
(`js/physiology-engine.js:3347-3380`). Et afgrænset eksperiment viste, at en
custom type med negative skalaer, negativ onset-halvtid og `kcalPerMin = -7`
accepteres. Efter 30 minutter registrerede engine `-210 kcal` for aktiviteten.

Den offentlige simulator bruger det faste aktivitetskatalog og er derfor ikke
direkte udsat. Noten gælder det dokumenterede program-API og fremtidige labs.

### Anbefaling

Definér intervalkontrakter for alle typefelter: positive puls- og kcal-værdier,
ikke-negative respons-/glykogen-/onsetskalaer samt ikke-negative leverrater og
lofter. Udvid den eksisterende atomiske inputtest med negative, ekstreme og
forkert ordnede værdier.

---

## NOTE 2 - Enkelte PEIS-kommentarer beskriver stadig en ren delay

**STATUS: ❌ ÅBEN**

Den primære dokumentation er opdateret til den glatte Hill-gate, men enkelte
kodekommentarer er ikke fulgt med:

- `js/physiology-engine.js:212` bruger eksemplet “120 min”, mens styrkeprofilen
  nu bruger 150 minutter.
- `js/physiology-engine.js:3426-3428` kalder fortsat mekanismen en
  “type-specific physiological delay”.
- Kommentarerne omkring `currentISF` omtaler samme “delayed rectangular
  response”, selv om latenstid nu multipliceres separat som en glat gate.

Koden og hoveddokumentationen er enige; dette er en sporbarheds- og
vedligeholdelsesnote, ikke en modeldefekt.

---

## Bekræftede OK-forhold

## OK 1 - Hovorka-kernen og integrationsrækkefølgen er stabile

**STATUS: ✅ FIKSET/OK**

`PhysiologyEngine.step()` opdeler alle eksterne steps i højst ét minuts chunks,
og Hovorka-kernen kører Euler-integration på samme skala. Store steps springer
ikke søvn-, CGM- eller auto-stop-grænser over. Alle 486 aktivitets-/kontekstscenarier
forblev finite, og API'et fejler hurtigt ved NaN i kernestate.

## OK 2 - Den nye styrke-PEIS-onset er glat ved minut 120

**STATUS: ✅ FIKSET (2026-08-05)**

Den rene 120-minutters delay er erstattet af en fjerdeordens Hill-gate med
150 minutters half-onset for styrke. ISF stiger på begge sider af minut 120,
hældningen ændres kun cirka 1,2 %, og dt = 1 mod 0,25 minut afviger mindre end
0,00001 mmol/L/U ved kontrolpunkterne.

## OK 3 - Aktivitetens start og stop tænder ikke PEIS som en kontakt

**STATUS: ✅ FIKSET/OK**

Følsomhedssessionen oprettes ved start, og stop fryser kun den faktiske varighed.
Manuelt og automatisk stop giver samme fysiologi ved 1, 5, 30, 45, 60, 180 og
240 minutter. Et tre-timers styrkepas udvikler følsomhed, mens det stadig kører.

## OK 4 - Exercise-subsystemerne er adskilt og ablationsbeskyttet

**STATUS: ✅ OK**

Kontraktionsmedieret E1-optag, motionsudløst leverdrive, fast/early/late PEIS og
muskelglykogen kan slås fra hver for sig. Mixed ligger i den matchede
cardio/styrke-envelope i 162/162 kontekster, og aktiv hurtiginsulin forstærker
bevægelsens BG-sænkning i alle testede cardio-kontekster.

## OK 5 - Søvn og natlig aktivitet har én sammenhængende tilstand

**STATUS: ✅ FIKSET/OK**

Cardio, styrke og mixed holder karakteren vågen under aktiviteten og 30 minutter
efter stop. Overlap mellem motion og andre natlige handlinger dobbelttæller ikke
søvntab. Et pas over 07:00 tæller kun natligt overlap, og søvngæld overføres
gradvist til kronisk stress.

## OK 6 - Stresshændelser følger med som låste Hvad Nu Hvis-events

**STATUS: ✅ FIKSET (2026-08-03)**

Akut og kronisk stress eksporteres separat fra spillerhandlinger, genafspilles i
den kanoniske kurve og variationerne og kan ikke flyttes eller slettes. Den
offentlige kontrakt tillader kun disse faste stress-events med finite tid og
styrke. KRITISK 1 gælder dog stadig events/handlinger ved selve snapshotgrænsen.

## OK 7 - Kode, videnskabelige kilder og styrke-PEIS-tests er overvejende sporbare

**STATUS: ✅ OK**

De nye styrkeparametre er koblet til Young 2023 for det tidlige T1D-vindue,
Vissing/Dreyer 2008 for kvalitativ recovery-timing og Breen 2011 for 24-timers
respons. Kilderne findes lokalt i `docs/references/`, og
`2026-08-05_strength-smooth-peis-onset-fix.md` dokumenterer ligning,
parameterbegrundelse, før/efter-data og tests. Begrænsningen er ærligt angivet:
Vissing er en rask population, og Breen-endepunktet er et kalibreringsmål, ikke
uafhængig validering.

---

## Sporbarhedsmatrix for centrale subsystemer

| Subsystem | Kode | Videnskabelig/dokumenteret kontrakt | Testdækning | Status |
|---|---|---|---|---|
| Hovorka Q1/Q2 + insulinhandling | `js/hovorka.js` | MODEL §2-4; Hovorka 2004 | Golden master, klinisk ækvivalens, clamp-diagnostik | OK med kendt absolut clamp-afvigelse |
| Mad/fedt/protein | `js/physiology-engine.js` | MODEL §5; BG-SCIENCE madsektioner | Måltid, τG, FFA, protein, massebalance | OK |
| Akut exercise-optag | Hovorka E1 + engine input | MODEL §6; Young/Resalat | Intensitet, E1-decay, vægtskalering, ablation | OK |
| Exercise leverdrive | `exerciseHepaticDrive` | MODEL §6; Young/Yardley | Styrke-kalibrering, kontekstreversal, ablation | OK |
| PEIS | `currentISF` + muskel-EC50 | MODEL §6; Young/Vissing/Breen/Cartee | Onset, stop, 24/48/72 h, dt, disposal | OK bortset fra 96 h cleanup og gammelt script |
| Stress | `updateStressHormones` | MODEL §7; BG-SCIENCE stress | Decay, pending pool, EGP, API-input | PARTIAL: akut perifer resistens mangler |
| Søvn | sleep interval/crossing state | MODEL §9; Donga/Zheng | Natgrænser, overlap, auto/manual stop | OK |
| Ketoner/DKA | FFA/BHB/acidosis states | MODEL §11 | Pipeline, tærskler, recovery, calibration | OK |
| Hvad Nu Hvis | snapshot + replay | Intern fysiologisk genberegningskontrakt | State-roundtrip, eksportform og fire minut-0-handlinger | OK |

## Tidligere fund kontrolleret uden genrapportering

Følgende tidligere fund er kontrolleret i den aktuelle working tree og forbliver
løst:

1. `basalPreInjected: false` respekteres i campaign level 2.
2. Box Challenge-respawn nulstiller gamle insulinmodifikatorer og
   motionsleverdrive før steady state beregnes.
3. Stress-API'et afviser NaN, negative og for store puljer atomisk.
4. `startActivity()` afviser ukendt type/intensitet, ufuldstændige type-definitioner
   og nulvarighed uden delvis state-mutation.
5. Glukagonens automatiske test isolerer det inkrementelle bidrag.
6. Den tidligere præcise 120-minutters styrke-delay og komponent-cutoffs er
   fjernet.

Følgende allerede dokumenterede modelbegrænsninger er uændrede og er ikke
genåbnet som nye fund:

- Leverens glykogendepot er et heuristisk kapacitetsdepot og ikke et fuldt
  massebalanceret levercompartment.
- `F_01c` kan ligge cirka 7-18 % over `F_01` ved høj BG.
- Renal glukoseudskillelse og personvariation er simplificeret.
- Brain deficit bruger den samlede insulin-uafhængige `F_01c` som proxy.
- Hovorka-grundmodellen mangler eksplicit GLUT4-/substratmætning, og den absolutte
  clamp-GIR er for høj.

## Krav før merge

1. **Færdig:** KRITISK 1 - præ-interventionssnapshot ved banestart og
   eventgrænsetests for mad, basal, bolus og aktivitet.
2. **Bør rettes snart:** gør `peis-verification.js` fail-fast ved game over eller
   flyt det til engine-native afvikling.
3. **Kan planlægges:** glat 96-timers PEIS-cleanup, akut stress/eISF-beslutning,
   stærkere custom-activity-validering og oprydning af gamle delay-kommentarer.

## Samlet status

- **KRITISK:** 0 åbne; den tidligere merge-blokering er rettet og testet.
- **ADVARSEL:** 3 åbne, ikke merge-blokerende hver for sig.
- **NOTE:** 2 åbne.
- **OK:** 7 bekræftede områder.
- **Automatiserede regressioner:** Alle obligatoriske pakker bestod.
- **Ekstern validering:** Fortsat PARTIAL på absolut insulin-clamp og enkelte
  aktivitetsprotokoller.
- **Endelig anbefaling:** Ingen fysiologisk merge-blokering fra Hvad Nu Hvis.
