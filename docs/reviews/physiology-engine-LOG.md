# Fysiologi-engine refaktorering — arbejdslog

**Formål med denne fil:** Løbende fælles log for udskillelsen af den fysiologiske
model til en selvstændig engine (se planen: `2026-06-14_physiology-engine-api-plan.md`).
Projektet bruger BÅDE Claude Code og Codex, og brugeren skifter mellem dem (typisk
når token-budgettet løber tør). Denne log er hukommelsen på tværs af værktøjer og
sessioner: hvert værktøj skriver hvad det har lavet, hvilken slice vi er på, og hvad
næste skridt er — så det andet værktøj kan fortsætte uden samtale-kontekst.

**Skriveregler for denne log:**

- Opdatér loggen LØBENDE under arbejdet — ikke kun ved sessionsafslutning. Hvis
  en session afbrydes (fx token-stop midt i en slice), skal "Status nu" + sidste
  log-blok altid afspejle den FAKTISKE tilstand, så det andet værktøj (Codex)
  kan overtage koldt uden samtale-kontekst.
- Tilføj en ny dateret blok øverst i LOG-sektionen ved hver arbejds-session.
- Opdatér altid "Status nu"-blokken, så toppen viser hvor vi er.
- Skriv selvstændigt: ingen "som vi talte om" — en anden læser har ingen kontekst.
- Notér bevidste model-ændringer (hvor golden-master forventes at afvige) eksplicit,
  med begrundelse, så det ikke forveksles med en fejl.
- Format som resten af projektet: dansk, korrekt æ/ø/å, ingen AI-cliché-metaforer.

---

## Status nu

- **Gren:** `physiology-engine` (`main` urørt, intet pushet)
- **Aktuelt:** S9 I GANG — engine gøres til en GENEREL standalone-model (S9.0-S9.3
  færdige + verificerede; S9.4 docs; S9.5 playtest+merge mangler). S8 FÆRDIG —
  ekstern API. S7 FÆRDIG:
  - **S7.1** `engine.step(simMinutes)` + `attachStepper()`-bro; `update()`-krop
    ekstraheret til `Simulator._stepPhysiology()`.
  - **S7.2** tidsbogføring (`totalSimMinutes`/`timeInMinutes`/`day` + resting-kcal)
    fremskrives i `engine.step()`.
  - **S7.3** pre-loop insulin-rate-prep → `engine._prepInsulinRates()`.
  - **S7.4** (a/b/c) ALLE ~40 fysiologi-instans-konstanter flyttet til engine +
    getter-proxy. (FUND: konstanter er forudsætning for metode-flytning; doc-
    rækkefølge rettet — se fix-decision-doc.)
  - **S7.5** (a-e) ALLE 12 leaf-fysiologi-metoder (`_substep*`/`update*`) flyttet
    til engine; Simulator har kun tynde delegerende wrappers. Modul-globalen
    GLUCOSE_G_PER_MMOL har en engine-kopi (`ENGINE_GLUCOSE_G_PER_MMOL`); de 6
    MUSCLE_GLYCOGEN_* rate-konstanter flyttet til engine-modul-scope.
  Alt verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7, suite 155/155,
  browser-smoke OK. Fix-decision-doc:
  `docs/reviews/2026-06-16_physiology-engine-step-loop-decision.md`.
  - **S7.6a** FÆRDIG: getter/circadian-cluster flyttet til engine.
  - **S7.6c** FÆRDIG: substep-integrations-løkken flyttet til
    `engine._runSubstepLoop()` (graf-sampling via onSample-callback; box-sweep +
    prep bevidst på facaden). Engine ejer nu hele substep-fysikken.
  - **S7.7** FÆRDIG: CGM-signal-fysik flyttet til `engine._computeCgmBG()`.
  - **S7.8** FÆRDIG: scenario-bro-step ryddet op.
- **S8 FÆRDIG — ekstern standalone-API.** PhysiologyEngine kan nu bruges uden
  facaden (nye apps/labs). Plan: `2026-06-16_physiology-engine-external-api-plan.md`.
  - **A:** engine-native interventioner (`addFood`/`addRapidInsulin`/`addBasalInsulin`/
    `startActivity`/`stopActivity`/`useGlucagon`); facaden delegerer + beholder
    spil-bogføring (onAccept-hook bevarer RNG/event-rækkefølge).
  - **B:** læse-API (`getState`/`getFluxSnapshot`/`getPhysiologySnapshot` +
    `basalPlasmaInsulinBaseline`) på engine; facaden delegerer.
  - **C1-C3:** `engine.step(simMinutes,{onSample})` ejer HELE fysiologi-tikket
    (prep+løkke+IOB+CGM) standalone og returnerer `{state,events}`. Carb/puls-prep
    → `_prepStepInputs`; CGM-gate → `_sampleCgm` (emitterer `cgm-sample`);
    `totalExerciseMinutes` engine-ejet; logHistory-motion-patch → activity-ended-
    handler. Facadens `_stepPhysiology` → `_postStep`; `update()`/`_stepEngineScenario`
    deler `_tickPhysiology`. attachStepper-bro fjernet fra wiring.
  - **C4:** `attachStepper`/`physicsStepper` fjernet; opt-in `attachDefaultRunner()`
    + `_applyScenarioEvent()` gør `runScenario` standalone (no-runner kaster fortsat).
  - Tests: 5 nye engine-direkte API-tests. Docs: MODEL-API.md + MODEL-IMPLEMENTATION.md (v4).
  - Verificeret bit-identisk efter hver under-slice: engine-API 12/12, golden-master
    7/7 bit-identisk, suite 155/155, browser-smoke (standalone engine + spil-facade).
- **S9 — GENEREL standalone-model.** Plan: `2026-06-16_physiology-engine-general-purpose-plan.md`.
  Lukker S8-vurderingens 3 huller, så engine fremstår generel (ikke spil-skræddersyet).
  - **S9.0:** klinisk-ækvivalens-testnet (`tests/clinical-equivalence.js`) + frossen
    baseline (`tests/fixtures/clinical-baseline.json`). Komplementært til golden-master:
    sammenligner med KLINISKE tolerancer (|ΔtrueBG|≤0.1, TIR ±1pp, IOB/COB ±2%), så
    "klinisk ens" kan bevises når bit-identitet ikke kan garanteres.
  - **S9.1:** engine ejer Hovorka (bygges i konstruktøren; `HOVORKA_REFERENCE_ISF`
    erstatter magisk 3.75) + selvbærende `initSteadyState()` (etablerer basal-depot,
    så bar engine HOLDER niveauet i stedet for at drive). `createEngine(.,{steadyState:true})`.
    Facaden bit-identisk (`establishDepot:false` + egen pre-injektion). `this.hovorka` = proxy.
  - **S9.2:** ergonomi — insulin-interventioner til objekt-form (`addRapidInsulin({units})`);
    default-aktivitetskatalog (`ENGINE_DEFAULT_ACTIVITIES`, fallback i `startActivity`); `reset()`.
  - **S9.3:** opt-in kliniske tærskel-/severity-events i `step()` (`{clinicalEvents:true}`);
    kant-trigget via `_clinicalZones`; default off → spillet uberørt.
  - **S9.4:** profil-kontrakt + options dokumenteret; MODEL-API.md + MODEL-IMPLEMENTATION.md (v5).
  - **S9.5 (delvist):** standalone-paritets-test (`tests/standalone-parity.js`) kører det
    SAMME batteri via bar engine vs facade i samme proces. Engine-stien aligner facade-
    konstruktørens setup-RNG (_boxSeed + 2 dawn-træk) + replikerer basal-pre-injektionen,
    og begge kører støj-fri. Resultat: den bare engine reproducerer facadens SANDE fysiologi
    EKSAKT (trueBG/iob/cob/ketoner/acidose/hjerne Δ0.0000 i alle 9 scenarier). cgmBG udeladt
    af gaten (facade-sensor-selvtest er præsentationslag, ikke kerne-fysiologi). Klinisk-
    ækvivalens + standalone-paritet wiret ind i `run-physiology-regression.js`.
  - Version bumpet til 0.9.4-beta og grenen pushet til origin (main urørt).
  - **S9.6:** dawn-init flyttet HELT ind i motoren — konstruktøren kalder nu
    `regenerateDawn()`, så en bar engine har gyldig dag-1 dawn (før: facaden trak
    `_dawnAmplitude`/`_dawnPeakMinutes` på simulator.js:839-841; en bar engine stod
    med `undefined` indtil første dagsskift). FØRSTE bevidste brud på bit-identitet
    (gate = klinisk ækvivalens, ikke bit-identitet). RNG-reorder: dawn trækkes nu i
    position 1-4 i stedet for 2-5 (efter `_boxSeed`); alt nedstrøms uændret. Effekt:
    7/9 klinisk-ækvivalens-scenarier forblev bit-identiske; kun `basal-24h` og
    `ketones-dka` (de eneste der krydser DAG-1's dawn-vindue) afveg, og kun dér
    (Δ≤1.0 i vinduet, middel ~0.3) — inden for dawns naturlige variation (amplitude
    CV ~20%) og faktisk mere korrekt (dag-1 dawn respekterer nu samme [0.05,0.35]-
    clamp som øvrige dage). Golden-master + klinisk-baseline re-baselinet. Standalone-
    paritet opdateret (engine-stien gen-trækker ikke længere dawn manuelt).
  - Verificeret: API 15/15, golden-master 7/7, klinisk 9/9, standalone-paritet 9/9, suite 155/155.
  - **S9.7:** CGM-sensor-tilstandsmaskinen flyttet helt ind i motoren. Motoren får
    `startCgmSelfTest()`/`startCgmSensorLoss()` (kerne-state + emit, ingen UI), og
    auto-selvtest-triggeren (mærkeligt signal → "checking", inkl. rng-træk) flyttet
    fra facadens `_applyCgmSample` ind i `engine._sampleCgm`. En bar motor ejer nu HELE
    sensor-tilstanden (status/selvtest/sensor-tab) uden facaden. Facade-metoderne er
    tynde wrappers (engine-kald + flush); floating-label flyttet til event-handlerne
    (`cgm-self-test-started`/`cgm-sensor-lost`) så manuel + auto-trigger giver ét label.
    Selvtest-rng-trækket landede på SAMME punkt i rng-strømmen → golden-master forblev
    BIT-IDENTISK (7/7); spillet uberørt. Verificeret standalone (bar motor udløser selv-
    test + sensor-tab deterministisk; auto-trigger nåbar i `step()`).
  - **S9.8:** søvnforstyrrelses-fysikken flyttet helt ind i motoren — den SIDSTE
    facade-koblede fysiologi. Motoren får `registerNightIntervention()` (vågen-accrual,
    gaussRand-søvntab), `applySleepDebt()` (morgen-konvertering → kronisk stress) og
    `_processSleepCrossings()` (22:00 nat-reset + 07:00 morgen, kaldt fra `step()`).
    De 5 engine-interventioner (mad/hurtig/basal/motion/glucagon) selv-trigger accrualen
    på onAccept-positionen; facaden kalder kun en tynd `handleNightIntervention`-wrapper
    for SPIL-handlinger uden engine-modstykke (fingerprik, keton-test) + campaign. Søvn-
    events (sleep-started/-disruption/-pop/morning-alarm/good-sleep/sleep-debt) emitteres
    nu fra motoren; facadens event-handlere laver lyd + graf-UI (vågne-striber,
    pop-animation, nat-reset af `nightAwakenings`). Krydsningerne trækker ingen RNG og
    nat-accrualen ligger på samme rng-position → golden-master BIT-IDENTISK (7/7).
    Nat-scenarie tilføjet til standalone-paritet (bolus kl. 03:00) — bar motor
    reproducerer facaden Δ0.0000; verificeret at søvngæld faktisk hæver chronicStress.
  - Verificeret: API 15/15, golden-master 7/7, klinisk 9/9, standalone-paritet 10/10, suite 155/155.
  - **MOTOREN ER NU SELVBÆRENDE UDEN FORBEHOLD** for fysiologien: dawn (S9.6), CGM-sensor
    (S9.7) og søvn (S9.8) er den sidste facade-koblede fysiologi, nu i motoren.
  - **S9.9:** standalone-API hærdet (ikke-fysiologiske forbehold): (1) exportState/importState
    inkluderer nu Hovorka-ODE-kernen (format version 2) → snapshot round-tripper; (2) step()
    underinddeler i ≤1-min bidder så ur-krydsninger ikke springes over ved store steps; (3)
    input-validering (profil + interventioner) kaster TypeError/RangeError med klare beskeder;
    (4) glucagon: ingen kode-ændring (fysiologien er glykogen-grænsen i motoren; cooldown er
    game-only) — doc-note i MODEL-API.md. Golden-master bit-identisk; 3 nye tests.
  - **S9.10:** toggleable fysiologi-moduler — `createEngine(.,{modules:{...}})` med 8 toggles
    (dawn, dawnVariability, stressResponse, glucotoxicity, ketones, sleepDisruption,
    cgmSensorFaults, insulinVariability), alle default true. Isolerer/forenkler modellen til
    labs/teaching/easy-mode. Subsumerer det gamle `_campaignDisableDawn` (#5: nu et alias over
    `modules.dawn`). CGM-støj er fortsat det separate `noiseEnabled`/`setNoise`. Easy mode =
    spil-mekanik (facaden vælger kombinationen), ikke en motor-option. Default-on → golden-master
    bit-identisk; validering afviser ukendte/ikke-boolean toggles; reset() bevarer konfigurationen.
  - **S9.11:** de sidste to modul-toggles tilføjet — `fatProtein` (fedt/protein-måltidseffekter:
    off → carbs-only, nulstillet i addFood) og `ffaResistance` (FFA-induceret resistens: off →
    FFA akkumulerer stadig men giver ingen ISF-reduktion, gated i currentISF + flux-display).
    Modul-sættet er nu komplet (10 toggles). Default-on → golden-master bit-identisk.
  - Verificeret (S9.9+S9.10+S9.11): API 19/19, golden-master 7/7 bit-identisk, klinisk 9/9,
    standalone-paritet 10/10, suite 155/155. Browser-smoke: spil uændret (10 moduler on),
    module-off engine virker standalone (fatProtein off → protein-glukagon 0, FFA-faktor 1.0).
  - **NÆSTE:** grundig browser-playtest, `bash tests/check-text-sync.sh`, merge
    `physiology-engine` → `main`. (Alle S9-forbehold lukket — fysiologi + standalone-API.)
- **Slice:** S2 KLAR TIL LUKNING. Under-slice 2.1 FÆRDIG: patientparametre (weight, ISF,
  ICR, gramsPerMmolRise) flyttet til engine via proxy-accessorer. Under-slice
  2.2 FÆRDIG: CGM-state flyttet til engine via samme proxy-mønster. Under-slice
  2.3 FÆRDIG: insulin/IOB-state flyttet til engine via samme proxy-mønster.
  Under-slice 2.4 FÆRDIG: rene keton-/acidose-akkumulatorer flyttet til engine
  via samme proxy-mønster. Under-slice 2.5 FÆRDIG: vægt/kalorie-state flyttet
  til engine via samme proxy-mønster. Under-slice 2.6 FÆRDIG: mad-/mave-/
  kulhydrat-state flyttet til engine via samme proxy-mønster. Under-slice 2.7
  FÆRDIG: fedt/protein/FFA-state flyttet til engine via samme proxy-mønster.
  Under-slice 2.8 FÆRDIG: motion-state flyttet til engine via samme proxy-
  mønster. Under-slice 2.9 FÆRDIG: muskelglykogen-state flyttet til engine via
  samme proxy-mønster. Under-slice 2.10 FÆRDIG: leverglykogen-state flyttet
  til engine via samme proxy-mønster. Foreslået næste S2-grupper:
  stress/hjerne/glukotoksicitet-state. Under-slice 2.11 FÆRDIG:
  stress/resistens/HAAF-state flyttet til engine via samme proxy-mønster.
  Under-slice 2.12 FÆRDIG: hjerneenergi-deficit-state flyttet til engine via
  samme proxy-mønster. Under-slice 2.13 FÆRDIG: aktiv glucagon-state flyttet
  til engine via samme proxy-mønster. Under-slice 2.14 FÆRDIG: `trueBG`
  flyttet til engine via samme proxy-mønster. Under-slice 2.15 FÆRDIG:
  afledte profil-/basalparametre flyttet til engine via samme proxy-mønster.
  Under-slice 2.16 FÆRDIG: søvnunderskuds-state flyttet til engine via samme
  proxy-mønster. Under-slice 2.17 FÆRDIG: dawn-state flyttet til engine via
  RNG-bevarende proxy-mønster. Under-slice 2.18 FÆRDIG: afledte fysiologi-/
  debugværdier flyttet til engine via proxy-mønster. Rest-inventar FÆRDIG:
  tilbageværende `Simulator`-felter er primært konstanter, facade-/grafstate,
  cooldowns/tests, score/game-state, side-effect guards og UI/Box Challenge-
  state. Arbejdsvurdering: S2 kan lukkes; næste fase bør være S3
  side-effects → events. S3.1 FÆRDIG: event-buffer/API-skelet tilføjet i
  `PhysiologyEngine` uden at flytte konkrete side-effects endnu. S3.2 FÆRDIG:
  stress-logevents migreret til engine-event → facade-handler. S3.3 FÆRDIG:
  CGM-logevents migreret til engine-event → facade-handler. S3.4 FÆRDIG:
  mad-logevent migreret til engine-event → facade-handler. S3.5 FÆRDIG:
  insulin-logevents migreret til engine-event → facade-handler. S3.6 FÆRDIG:
  glucagon-logevents migreret til engine-event → facade-handler. S3.7 FÆRDIG:
  fingerprik-logevent migreret til engine-event → facade-handler. S3.8 FÆRDIG:
  keton-test-logevent migreret til engine-event → facade-handler. S3.9 FÆRDIG:
  søvn-logevents (sleepStart, goodSleep, sleepDisruption, sleepDebt) migreret
  til engine-event → facade-handler. S3.10 FÆRDIG: mave-logevent (stomachFull)
  migreret til engine-event → facade-handler. S3.11 FÆRDIG: simple motion-
  logevents (exerciseMaxDuration, exerciseCooldown) migreret. S3.12 FÆRDIG:
  activityStart/activityEnd migreret (rå data i event, i18n bygges i handleren).
  ALLE S3-logevents er nu migreret. S3.13 FÆRDIG: tre lavrisiko `playSound`-
  side-effects (`stomach-full`, `basal-insulin-added`, `activity-started`) er
  flyttet til eksisterende engine-event handler-cases i facaden. S3.14 FÆRDIG:
  `sleep-started` spiller nu `sleepStart` fra facade-handleren før loggen, så
  gammel rækkefølge er bevaret. S3.15 FÆRDIG: `morningAlarm` spiller nu via
  nyt sound-only engine-event `morning-alarm`, før `good-sleep`/`sleep-debt`
  håndteres. S3.16 FÆRDIG: `sleepPop` spiller nu via sound-only event
  `sleep-pop`, før den eksisterende nat-pop timing sættes. Tilbage i S3: øvrige
  `playSound`-kald med rækkefølge-/state-hensyn, DOM-status og `gameOver` —
  egen delplan. S3.17 FÆRDIG: mad-, hurtiginsulin-, fingerprik- og keton-test-
  lyde flyttet til sound-only events ved de gamle lydplaceringer. Box Challenge-
  log bliver på facaden. S3.18 FÆRDIG: kit-knappernes cooldown-DOM for
  fingerprik, keton-test og glucagon flyttet til fælles facade-event
  `kit-cooldown-status`. S3.19 FÆRDIG: vægt-/kcal-DOM i `updateWeight()` flyttet
  til facade-event `weight-status`. S3.20 FÆRDIG: fysiologiske game-over-
  tærskler i `checkGameOverConditions()` emitter nu `game-over-condition`, og
  facaden afgør Box Challenge-livstab vs. egentlig game over. S3.21 FÆRDIG:
  steep-drop advarsels-overlay/lyd flyttet til facade-event
  `steep-drop-warning`. S3.22 FÆRDIG: stats-/debug-DOM i `updateStats()` flyttet
  til facade-event `stats-status`. S3 LUKKET: tilbageværende `logEvent`,
  `playSound`, DOM og `gameOver`/`loseLife` i `js/simulator.js` er bevidst
  facade-/UI-/score-/Box Challenge-side-effects. Næste fase: S4 — graf-
  historik/snapshot-grænse. S4.1 FÆRDIG: `nightAwakenings` flyttet ud af engine
  og tilbage til Simulator-facaden som visuel graf-historik. S4 LUKKET:
  `js/physiology-engine.js` ejer ikke længere graf-/visuel historik. Næste fase:
  S5 — Lab-API.
- **Golden-master:** 7 scenarier, bit-identisk baseline. `check` = 7/7.
- **Spillet virker:** ja (155/155 Node + 7/7 golden-master + browser-smoke OK)

## Sådan kører du regressionen

- Eksisterende suite: `tests/.bin/node.exe tests/simulation.test.js`
- Golden-master (bit-identisk): `tests/.bin/node.exe tests/golden-master.js check`
- Efter en BEVIDST model-ændring: regenerér baseline med
  `tests/.bin/node.exe tests/golden-master.js generate` og notér ændringen her.
- Til ren kode-flytning (S1+): `check` SKAL forblive bit-identisk (ingen --tol).

---

## Slice-oversigt (fra planen)

- S0 — Determinisme (seedet RNG) + golden-master-fixturer + fuld global-inventar
- S1 — Engine-skelet + `Simulator` delegerer
- S2 — Flyt model-state ind i engine
- S3 — Side-effects → events (logEvent/playSound/gameOver/DOM ud af fysiologien)
- S4 — Flyt graf-historik ud af engine
- S5 — Lab-API (export/import, runScenario, setNoise, setBG, clamp)
- S6 — Ompeg tests til engine, fjern DOM-mocks, skriv docs/MODEL-API.md

---

## Log

### 2026-06-16 — Claude — S9.9 + S9.10: standalone-API hærdet + toggleable fysiologi-moduler

**Baggrund.** Efter at al facade-koblet fysiologi var flyttet ind i motoren (S9.6-S9.8),
afdækkede et review fem ikke-fysiologiske forbehold for ekstern brug. Bruger bad om at
lukke dem.

**S9.9 — hærdning (js/physiology-engine.js + tests + MODEL-API.md):**
- **Snapshot round-trip:** `exportState`/`importState` udelod Hovorka-objektet, så ODE-
  kernen (Q1/Q2/plasma-insulin) ikke blev gemt; `trueBG` gen-udledes fra Hovorka hvert
  step, så en import snappede tilbage til live-state. Nu eksporteres `hovorka.state` +
  transiente inputs; format bumpet til **version 2** (importState kræver v2 + hovorka).
- **Store steps:** `step(simMinutes)` underinddeler nu i ≤1-min bidder (`_stepChunk`), så
  søvn-krydsninger (22/07) + CGM-5-min-gaten ikke springes over. `step(≤1)` = én bid =
  uændret; tests kører 1-min steps → bit-identisk. `simMinutes≤0` no-op; ikke-tal kaster.
- **Input-validering:** ny `requireNumber()`; konstruktør-profil (weight/isf/icr) +
  interventioner (addFood/addRapidInsulin/addBasalInsulin/startActivity) kaster
  `TypeError`/`RangeError` med felt-navn i stedet for at degradere lydløst (fx `NaN`
  carbs → 0). Bløde game-gates (mave fuld, cooldown) returnerer fortsat false. setBG
  validerede allerede.
- **Glucagon:** ingen kode-ændring — den fysiologiske grænse (tømt lever-glykogen →
  reduceret effekt) er allerede i motoren; 24t-cooldown er korrekt game-only. Doc-note.

**S9.10 — toggleable moduler (samme fil + tests + MODEL-API.md):**
- `MODULE_DEFAULTS` + `createEngine(profile, { modules: { <key>: false } })`. 8 toggles,
  alle default true: `dawn`, `dawnVariability`, `stressResponse`, `glucotoxicity`,
  `ketones`, `sleepDisruption`, `cgmSensorFaults`, `insulinVariability`.
- Hver gates ét sted (skip akkumulering / fast værdi / neutral faktor). Default-on →
  alle gates tager "on"-grenen = original kode → golden-master bit-identisk.
- `_campaignDisableDawn` er nu et getter/setter-alias over `modules.dawn` (#5 løst for
  dawn; `_campaignDisableWeight` er facade-side og rørt ikke). CGM-**støj** er fortsat det
  separate `noiseEnabled`/`setNoise` (ikke et modul).
- Validering: ukendt modul-navn → RangeError; ikke-boolean → TypeError. `reset()` videre-
  giver nu `modules` (bevares). **Easy mode er IKKE en motor-option** — facaden/spillet
  vælger kombinationen (bruger-beslutning).
- S9.11 (samme dag): tilføjede de sidste to toggles `fatProtein` (off → carbs-only via addFood)
  + `ffaResistance` (off → FFA giver ingen ISF-reduktion, gated i currentISF). Modul-sættet er nu
  komplet (10 toggles). Golden-master bit-identisk; module-test udvidet.

**Verifikation (begge):** API 19/19 (4 nye tests: snapshot-ODE-round-trip, stort-step-
krydsning, input-validering, module-toggles), golden-master 7/7 bit-identisk, klinisk 9/9,
standalone-paritet 10/10, suite 155/155. Browser-smoke: spillet uændret (alle moduler on),
module-off engine virker standalone (dawn off → kortisol 0).

### 2026-06-16 — Claude — S9.8: søvnforstyrrelses-fysikken flyttet helt ind i motoren (sidste facade-koblede fysiologi)

**Baggrund.** Efter S9.6 (dawn) og S9.7 (CGM-sensor) var søvnforstyrrelse den sidste
fysiologiske mekanisme der stadig boede i Simulator-facaden. `handleNightIntervention`
(vågen-accrual: gaussRand-søvntab når spilleren handler kl. 22:00-07:00) og
`applySleepDebt` (morgen-konvertering af søvntab → kronisk stress → insulinresistens +
forstærket dawn) lå i facaden, og 22:00/07:00-krydsningerne kørte i facadens `_postStep`.
Motoren HAVDE state-felterne (`lostSleepHoursTonight`, `chronicStressLevel`) og læste dem
(dawn forstærkes af søvntab), men intet udfyldte dem i en bar motor → en ekstern udvikler
der gav insulin kl. 03 fik ikke søvngæld-effekten. Dette var S-vurderingens sidste reelle
fysiologiske forbehold.

**Ændring.**
- `js/physiology-engine.js`:
  - `registerNightIntervention()`: nat-gate (22-07) + ny-vågenhed-gate (>30 min) +
    gaussRand-søvntab-accrual; emitterer `sleep-disruption` {hours, sleepLoss} (ny
    vågenhed) + `sleep-pop` (hver nat-handling).
  - `applySleepDebt()`: søvntab → `_pendingChronicStress` (0.06/time, cap 0.30);
    emitterer `sleep-debt`; én gang/dag.
  - `_processSleepCrossings()` (kaldt sidst i `step()`): 22:00 → nat-reset + `sleep-started`
    (springes over under aktiv motion); 07:00 → `morning-alarm` + (`sleep-debt` via
    applySleepDebt hvis søvntab, ellers `good-sleep`). Nye guards `_sleepStartedForDay`/
    `_morningProcessedForDay`.
  - De 5 engine-interventioner kalder selv `registerNightIntervention()` på onAccept-
    positionen (addRapidInsulin/addBasalInsulin[!silent]/useGlucagon i toppen,
    addFood/startActivity efter gate) → samme rng-position som facadens gamle trigger.
- `js/simulator.js`:
  - `handleNightIntervention`/`applySleepDebt` → tynde delegater (bevarer facade-API for
    fingerprik/keton-test/campaign-kald uden engine-modstykke).
  - Nat-kaldene fjernet fra de 5 interventions-wrappers (motoren gør det nu).
  - `_postStep`'s 22:00/07:00-blokke fjernet (motoren driver dem via events).
  - Søvn-event-handlerne udvidet: `sleep-started` nulstiller `nightAwakenings` (UI);
    `sleep-disruption` pusher graf-besked + vågne-stribe (bruger event-data sleepLoss/hours);
    `sleep-pop` sætter pop-animations-timing (`drawSymptomOverlay._popRealTime`/
    `window._nightPopActiveUntil`).

**Bit-identitet bevaret.** Krydsningerne trækker ingen RNG; nat-accrualens gaussRand ligger
på samme rng-position som før (facadens trigger kørte på samme sted i interventionen).
Golden-master-scenarierne har ingen nat-INTERVENTIONER → accrualen fyrer ikke der, og
krydsningerne er fysiologiske no-ops (søvntab = 0) → golden-master forblev BIT-IDENTISK (7/7).

**Verifikation.**
- Fuld regression: API 15/15, golden-master 7/7 (bit-identisk), klinisk 9/9,
  standalone-paritet 10/10, suite 155/155.
- Nyt standalone-paritet-scenarie `night-sleep-disruption` (bolus kl. 03:00, kører gennem
  07:00-morgen): bar motor reproducerer facaden Δ0.0000. Header-noten om "kun dagtids-
  interventioner" opdateret (nat-stien er nu dækket).
- Standalone-tjek: bolus kl. 03:00 → `sleep-disruption` (0.78t) → kl. 07:00 `morning-alarm`
  + `sleep-debt` → `chronicStressLevel` 0.036 (>0 = søvngæld slår igennem). Mekanismen er
  altså ikke vacuøs.
- Browser-smoke: nat-bolus i sandkasse → `lostSleepHoursTonight` 0→0.465, `nightAwakenings`
  0→1, graf-besked tilføjet, ingen console-fejl.

**Status:** ALLE fysiologiske facade-koblinger er nu lukket (dawn/CGM/søvn). Motoren er
selvbærende uden fysiologiske forbehold. Tilbageværende forbehold er ikke-fysiologiske:
ikke npm-pakket (semver/TS-typer) og ikke klinisk valideret.

### 2026-06-16 — Claude — S9.7: CGM-sensor-tilstandsmaskinen flyttet helt ind i motoren

**Baggrund.** Efter S9.6 var den sidste facade-koblede del af CGM-laget *auto-
selvtest-triggeren*: motoren ejede al sensor-STATE (`cgmSensorStatus`,
`cgmSelfTestUntil` m.fl.) og kunne læse status (`getCgmSensorStatus`) + sample
(`_sampleCgm`), men selve BESLUTNINGEN om at gå i "checking"-tilstand ved et
usandsynligt signal — inkl. rng-trækket — lå i facadens `_applyCgmSample`. En bar
motor gik derfor aldrig selv i selvtest; sensoren forblev "active". Desuden lå
`startCgmSelfTest`/`startCgmSensorLoss` som facade-metoder (state-mutation + emit +
UI blandet sammen).

**Ændring.**
- `js/physiology-engine.js`:
  - Nye motor-metoder `startCgmSelfTest(durationMinutes)` og
    `startCgmSensorLoss(offlineMinutes, warmupMinutes)` — ren kerne-state-transition
    (timere + status) + `emitEvent`. Ingen UI, ingen flush. `startCgmSelfTest` beholder
    "kun når active"-guarden.
  - Auto-selvtest-triggeren flyttet ind i `_sampleCgm` (lige efter `_computeCgmBG`):
    `cgmJump`/`cgmLag`/`selfTestCandidate` + cooldown + `rng() < 0.25` →
    `this.startCgmSelfTest(15 + rng()*15)`.
- `js/simulator.js`:
  - `_applyCgmSample`: selvtest-blokken fjernet (motoren gør det nu).
  - `startCgmSelfTest`/`startCgmSensorLoss`: tynde wrappers → `this.engine.startCgmX();
    this._flushEngineEvents();`.
  - Floating-label flyttet til event-handlerne `cgm-self-test-started` /
    `cgm-sensor-lost`, så både auto-trigger (motor-emit) og manuelt kald
    (campaign → facade-wrapper → motor-emit) giver præcis ÉT label.

**Bit-identitet bevaret.** Selvtest-rng-trækket flyttede fra "facadens cgm-sample-
handler (efter step)" til "slutningen af `_sampleCgm` (inde i step)" — men der er
ingen rng-forbruger imellem de to punkter, så rng-strømmens position er uændret.
Golden-master forblev BIT-IDENTISK (7/7); ingen re-baseline nødvendig (modsat S9.6).

**Verifikation.**
- Fuld regression: API 15/15, golden-master 7/7 (bit-identisk), klinisk 9/9,
  standalone-paritet 9/9, suite 155/155.
- Standalone (bar motor, ingen facade): `startCgmSelfTest` → status active→checking
  + emit; `startCgmSensorLoss` → offline med korrekte 45/60-timere + emit; auto-trigger
  nåbar i `step()` (provokeret jump via C-kompartment udløste selvtest).
- Browser-smoke: facade-wrapper i sandkasse → active→checking, ingen console-fejl.

**Status:** S9-hullerne (Hovorka+steady-state, kliniske events, ergonomi, dawn, CGM-
sensor) er nu lukket. Motoren er selvbærende. NÆSTE: browser-playtest + check-text-sync
+ merge til main (afventer brugerens test).

### 2026-06-16 — Claude — S9.6: dawn-init flyttet helt ind i motoren (første bevidste bit-identitets-brud)

**Baggrund.** En bar PhysiologyEngine (uden Simulator-facaden) havde ikke gyldig
dawn på dag 1: konstruktøren satte `_dawnAmplitude`/`_dawnPeakMinutes` til
`undefined`, og facaden trak dem efterfølgende i sin egen konstruktør
(simulator.js:839-841) udelukkende for at bevare RNG-rækkefølgen. En ekstern bruger
af motoren fik derfor `undefined` dawn-parametre indtil første dagsskift (hvor
`regenerateDawn` kaldes via `circadianKortisolNiveau`). Det er den facade-koblede
halv-implementering gate-beslutningen peger på.

**Ændring.**
- `js/physiology-engine.js`: konstruktørens dawn-state-blok kalder nu
  `this.regenerateDawn()` (2 gaussRand-træk) i stedet for at sætte feltene til
  `undefined`. Motoren er selvbærende — dag-1 dawn er gyldig fra første `step()`.
- `js/simulator.js`: facadens dawn-træk (de tre linjer ved 839-841) fjernet;
  kommentar henviser til motorens dawn-state-blok.

**Bevidst bit-identitets-brud (gate = klinisk ækvivalens).** Dette er det FØRSTE
bevidste brud på golden-master-bit-identitet i refaktoreringen. Dawn trækkes nu i
RNG-position 1-4 (i motor-konstruktøren) i stedet for 2-5 (efter facadens `_boxSeed`
på simulator.js:700). `_boxSeed` flyttede IKKE — den er game-mekanik og forbliver i
facaden, nu efter dawn. Alt nedstrøms RNG-position 5 er uændret.

**Verifikation (klinisk ækvivalens, ikke bit-identitet).**
- Klinisk-ækvivalens FØR re-baseline: 7/9 scenarier forblev BIT-IDENTISKE (Δ0.000).
  De 2 der afveg — `basal-24h` (start kl. 00:00, 24t) og `ketones-dka` (start kl.
  08:00) — er præcis dem der krydser DAG-1's dawn-vindue, og afvigelsen ligger KUN
  dér (trueBG Δ≤1.0 i vinduet, middel Δ~0.3). `sleep-dawn` (krydser kun dawn på
  DAG 2, hvor `regenerateDawn` trækker friske, position-identiske værdier) matchede
  eksakt — bekræfter at kun dag-1-samplet ændrede sig. Afvigelsen er et andet gyldigt
  dawn-sample inden for naturlig dag-til-dag-variation (amplitude CV ~20%), ikke en
  modelfejl. Faktisk mere korrekt: dag-1 dawn respekterer nu samme [0.05, 0.35]-clamp
  som alle øvrige dage (facadens gamle linje 839 var u-clampet).
- `tests/standalone-parity.js` opdateret: engine-stien gen-trækker ikke længere dawn
  manuelt (motor-konstruktøren gør det nu for begge stier); replikerer kun facadens
  `_boxSeed`-træk. Resultat: bar engine reproducerer facaden EKSAKT (fysiologi
  Δ0.0000) i alle 9 scenarier.
- Golden-master + klinisk-baseline RE-BASELINET (bevidst, korrekthedsdrevet ændring).
- Fuld regression efter re-baseline: API 15/15, golden-master 7/7, klinisk 9/9,
  standalone-paritet 9/9, suite 155/155.

**Næste kandidat:** flyt CGM-sensor-tilstandsmaskinen (warmup/selvtest/status) ind i
motoren for fuld standalone-fidelity (i dag præsentationslag på facaden).

### 2026-06-16 — Claude — S8: ekstern standalone-API (Fase A+B+C)

MILEPÆL: `PhysiologyEngine` er nu en standalone fysiologisk motor, der kan bruges
af nye applikationer/labs uden `Simulator`-facaden. Plan + fix-decision:
`docs/reviews/2026-06-16_physiology-engine-external-api-plan.md`.

- **Fase A — engine-native interventioner.** `addFood`, `addRapidInsulin`,
  `addBasalInsulin`, `startActivity`, `stopActivity`, `useGlucagon` på engine
  (ren fysiologi + events). Facaden delegerer og beholder spil-bogføring
  (campaign-recordAction, handleNightIntervention, glucagon-cooldown, DOM-status).
  Catalog-globals (CARB_TYPES/AKTIVITETSTYPER/estimateEatTimeMin) slås op i facaden
  og sendes opløst ind → engine læser ingen globals. `onAccept`-hook indsætter
  facadens bogføring efter afvisnings-gaten, før side-effekter → RNG/event-rækkefølge
  bit-identisk. (handleNightIntervention trækker gaussRand ved nat-opvågning, så
  rækkefølgen var følsom.)
- **Fase B — læse-API.** `getPhysiologySnapshot()` + `_computeBGForces()` flyttet til
  engine; facaden delegerer (tests + dashboard kalder `game.getPhysiologySnapshot()`).
  Nye: `getState()` (kompakt kerne-state), `getFluxSnapshot()`, engine-getter
  `basalPlasmaInsulinBaseline`.
- **Fase C — standalone step().** `engine.step(simMinutes, {onSample})` ejer nu HELE
  tikket (tidsbogføring → `_prepInsulinRates` → `_prepStepInputs` → `_runSubstepLoop`
  → `_recomputePostStepIOB` → `_sampleCgm`) og returnerer `{state, events}`.
  - C1: carb-/puls-/motions-prep + auto-stop → `_prepStepInputs`; `totalExerciseMinutes`
    engine-ejet (proxy); logHistory-motion-bånd-patch flyttet til `activity-ended`-
    handleren (både manuel + auto-stop patcher korrekt; `startTime` tilføjet til eventet).
  - C2: 5-min CGM-gate → `_sampleCgm` (emitterer `cgm-sample`); `getCgmSensorStatus`
    flyttet til engine; facadens `_applyCgmSample` laver graf/lyd/selvtest (rng-træk
    sidst → uændret rækkefølge).
  - C3: facadens `_stepPhysiology` omdøbt til `_postStep` (steep-drop/graf/søvn/
    score/vægt/game-over/Box Challenge). Box-sweep-prev fanges i `_tickPhysiology`
    FØR `engine.step`. `update()` + `_stepEngineScenario` deler `_tickPhysiology`,
    så scenario-samples ser samme state (fx `weightChangeKg`). attachStepper-bro
    fjernet fra wiring.
  - C4: `attachStepper`/`physicsStepper` fjernet (også fra export/import-skip);
    opt-in `attachDefaultRunner()` + `_applyScenarioEvent()` gør `runScenario`
    standalone (startActivity kræver `event.typeDef`; no-runner kaster fortsat).
- **Verifikation:** bit-identisk efter HVER under-slice — engine-API 12/12 (5 nye
  standalone-tests), golden-master 7/7 bit-identisk, suite 155/155. Browser-smoke:
  standalone engine (engine+hovorka, ingen facade) kan `addFood`/`addRapidInsulin` +
  `step(1,{onSample})` over 120 min og returnere `{state,events}`; standalone
  `attachDefaultRunner` + `runScenario(3 events,180 min)` → 40 samples; spillet via
  facade-`update()` uændret. Ingen konsol-fejl.
- **Docs:** `docs/MODEL-API.md` (fuldt eksternt API + standalone-eksempel + step→
  {state,events} + interventioner + læse-API + attachDefaultRunner);
  `docs/MODEL-IMPLEMENTATION.md` doc-version v4 (engine standalone).
- **NÆSTE:** playtest spillet grundigt; `bash tests/check-text-sync.sh` + version-bump;
  merge `physiology-engine` → `main`.

### 2026-06-16 — Claude — S7.8: scenario-bro-oprydning + docs-opdatering

- `_stepEngineScenario` forenklet: det gamle speed=60-trick (der fik
  `update(deltaSeconds)` til at give 1 sek = 1 sim-min) er erstattet af et direkte
  `this.engine.step(minutes)`-kald. `isGameOver`-guarden bevaret. Matematisk
  identisk (`update(minutes)`@speed60 = `engine.step(minutes)`).
- Scenario-runner-broen (`attachScenarioRunner`) bevares bevidst: `applyEvent`/
  `getSample` har legitimt brug for facade-metoder (`addFood` osv.), og engine-API-
  testen bruger en fake runner. Kun step-mekanikken er ryddet op.
- Verificeret: golden-master 7/7 bit-identisk, suite 155/155. Browser: `runScenario`
  via den RIGTIGE Simulator-runner kører (180 min, 40 samples, BG 5.5→4.44 med
  carbs+insulin), ingen konsol-fejl.
- Docs opdateret til engine-arkitekturen: `docs/MODEL-API.md` (engine.step/
  _runSubstepLoop/_computeCgmBG/_recomputePostStepIOB + facade/engine-grænse) og
  `docs/MODEL-IMPLEMENTATION.md` (PhysiologyEngine ejer nu fysiologien).
- NOTE: facade-wrappers i js/simulator.js beholder deres oprindelige physiology-
  doc-prosa som dokumentation (modellen bor nu i engine med kondenserede kommentarer
  + docs/). En evt. fuld kommentar-flytning er kosmetisk og udskudt.

### 2026-06-16 — Claude — S7.7: CGM-signal-fysik flyttet til engine._computeCgmBG

- Ekstraheret den rene CGM-signal-beregning til `PhysiologyEngine._computeCgmBG()`:
  interstitiel BG (hovorka.cgmValue) + proportional støj + langsom drift +
  diskontinuitet + kompression → clampet cgmBG. Bruger kun engine-state (cgm-params
  S2.2, noiseEnabled S5.3, rng, hovorka). Returnerer `{previousCgmBG, interstitialBG,
  discontinuity}` til facadens selvtest-/spring-detektion.
- Orkestreringen BLIVER bevidst på facaden (planen: kun fysiologi flyttes):
  sampling-gating (hvert 5. min), sensor-status (`getCgmSensorStatus`), graf-push
  (`cgmDataPoints`/`trueBgPoints`/`bgHistoryForStats`), buffer-trimning, `playSound('tick')`,
  selvtest-trigger. RNG-rækkefølgen (gaussRand + 2 rng-træk) er uændret.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk (inkl.
  cgm-noise + sensor-loss/self-test-tests), fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl; `_computeCgmBG` på engine; CGM-kurve
  stiger realistisk efter måltid og lagger let bag trueBG (17.2 vs 17.9);
  cgmDataPoints fyldes (37 punkter).
- OGSÅ (S7.7): post-loop IOB-genberegningen (iob/displayIOB fra post-ODE Hovorka-
  tilstand) flyttet til `engine._recomputePostStepIOB()`. Bit-identisk (155/155,
  golden-master 7/7). Dermed er den sidste rene fysiologi i post-loop'en i engine;
  resten (steep-drop/vægt/game-over/normo/graf) er facade/spil-state.
- NÆSTE: resten af post-loop (steep-drop/vægt/game-over/normo/graf) er facade/spil-
  state (events fra S3 hvor relevant) — bliver på facaden. S7.8: fjern scenario-broen
  når hele step-flowet kan køre engine-internt. Prep-orkestrering bliver facade.

### 2026-06-16 — Claude — S7.6c: substep-løkken flyttet til engine._runSubstepLoop (kernen)

MILEPÆL: engine ejer nu selve substep-integrations-løkken (`while remaining > 0`).

- Tilføjet `PhysiologyEngine._runSubstepLoop(simulatedMinutesPassed,
  exerciseStressRate, exerciseStressRedRate, onSample)`. Løkke-kroppen er kopieret
  EKSAKT fra `Simulator._stepPhysiology` (via node-script, ingen manuel repro), med
  kun to transforme: `this.engine.applyPlasmaInsulinClamp()` → `this.apply...` og
  `physiologyDataPoints.push(...)` → `onSample(...)`.
- Rækkefølge-invarianterne er bevaret 1:1 (linje-for-linje kopi): stress/exercise-
  stress øverst, `_processActiveIntake` → `_substepFatProteinFFA` FØR `hovorka.step()`,
  `_substepKetones`/`updateMuscleGlycogen`/`_substepGlucagon` EFTER, trueBG sidst,
  skades-akkumulatorer på frisk post-step BG.
- **Designvalg (planen tillader "orkestrering på facaden"):**
  - Graf-sampling: engine bygger sample-objektet (læser hovorka-state, basalRate,
    currentISF, EGP, UG) og kalder `onSample(sample)`; facaden leverer
    `sample => physiologyDataPoints.push(sample)`. `physiologyDataPoints` forbliver
    facade/UI-state (S4). Sampling-cadencen `_lastPhysioRecordTime` flyttet til engine.
  - `exerciseStressRate`/`exerciseStressRedRate` beregnes stadig i facade-prep'en
    (motion/aktivitet) og sendes som argumenter.
  - Box-sweep (`_prevTrueBG`/`_prevTimeInMinutes`) + carb/τG/puls-prep + auto-stop
    (`stopAktivitet`) bliver BEVIDST på facaden (Box Challenge + campaign-koblet).
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk (ALLE 7
  scenarier), fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl; `onSample` fylder `physiologyDataPoints`
  korrekt (121 samples/120 min, alle felter til stede); `_lastPhysioRecordTime` på
  engine; kørende sandbox-spil renderer grafen korrekt (screenshot).
- NÆSTE: S7.7 (post-loop: CGM-sim → engine; steep-drop/vægt/game-over/normo/graf
  → facade via events). S7.8 (fjern scenario-bro når hele step-flowet er engine-ejet).
  Prep-orkestreringen bliver bevidst på facaden — kun ren fysiologi flyttes.

### 2026-06-16 — Claude — S7.6a: getter/circadian-cluster til engine

Flyttede den getter-web som substep-løkken bruger, til `PhysiologyEngine` (to
verificerede del-trin, begge bit-identiske):

- **S7.6a-1 (dawn/circadian):** `regenerateDawn`, `circadianKortisolNiveau`,
  `circadianISF` flyttet til engine. `_campaignDisableDawn` flyttet til engine
  (default false) + facade get/set-proxy (campaign-constructor skriver via proxy).
  `regenerateDawn` kaldes KUN internt af `circadianKortisolNiveau` (på dagsskift) —
  RNG-rækkefølgen (2 gaussRand-træk) er uændret. `dawnAmplitude` (uden underscore)
  sættes aldrig → altid undefined → `amp=1.0` i begge tilfælde (ingen proxy nødvendig).
  Facade beholder getter-proxyer for circadianKortisolNiveau/circadianISF
  (læses i main.js debug); `regenerateDawn` fjernet fra facaden (ingen eksterne kaldere).
- **S7.6a-2 (currentISF):** `currentISF` + `currentCarbEffect` flyttet til engine
  via node-script (kopierer kode direkte, EXERCISE_* → ENGINE_EXERCISE_*-kopier).
  De 12 PEIS-konstanter currentISF bruger fik `ENGINE_`-kopier i engine-modul-scope
  (de bruges fortsat i `stopAktivitet` på facaden → kan ikke redeklareres pga.
  browserens delte globale scope; samles når motion-setup flyttes). `currentISF`
  sætter fortsat `_lastPeisFactor` (engine-state, S2.18). Facade-proxyer beholdt
  (main.js debug + løkken).
- Verificeret BIT-IDENTISK efter hvert: engine-API 7/7, golden-master 7/7
  bit-identisk (inkl. sleep-dawn + ISF/PEIS-tests), fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl/SyntaxError (nye ENGINE_EXERCISE_*-consts
  OK); alle 4 getter-proxyer === engine-værdi; motion hæver currentISF (3.6→5.1,
  PEIS-faktor 1.42); `_lastPeisFactor` på engine.
- NÆSTE (S7.6b): flyt carb-rate/τG/puls-prep ind i engine.step(). Facade-bits:
  `totalExerciseMinutes` (→ engine eller event), `stopAktivitet`/auto-stop (→ event),
  box-sweep `_prevTrueBG`/`_prevTimeInMinutes` (bliver facade), GLUCOSE_G_PER_MMOL
  i carb-rate (→ ENGINE-kopi). Derefter S7.6c: selve løkke-kroppen + graf-sampling.

### 2026-06-16 — Claude — S7.6 KORTLÆGNING (afhængigheds-analyse, ingen kode ændret)

Før S7.6 (flyt substep-løkken + prep ind i engine.step()) kortlagde jeg
afhængighederne. S7.6 er IKKE en mekanisk flytning som S7.5 — substep-løkken og
prep'en er viklet sammen med en getter-web + delte konstanter + graf/facade-state.
Det skal deles op og tages forsigtigt. Konkret skal følgende løses FØR/UNDER
løkke-flytningen:

1. **Getter-web brugt INDE i løkken/prep:**
   - `currentISF` (stor getter, simulator.js ~1121): bruger `activeMotion`,
     `muscleGlycogenReserve`, resistensfaktorer (alt engine), MEN også modul-
     globalerne `EXERCISE_FAST/EARLY/LATE_*` + `EXERCISE_SENS_CAP`, og kalder
     `circadianISF`. Sætter `_lastPeisFactor`.
   - `circadianISF` + `circadianKortisolNiveau` (~2082/~1995): bruger dawn-state
     (engine, S2.17), `timeInMinutes`/`day` (engine), MEN kalder `regenerateDawn()`
     (facade-metode, bruger rng/gaussRand) og læser `_campaignDisableDawn`
     (campaign-flag) + `dawnAmplitude`.
   - `currentCarbEffect` (= currentISF/ICR).
2. **Delte konstanter (browser-kollision):** `EXERCISE_*` bruges BÅDE i currentISF
   (skal flyttes) OG i `stopAktivitet` (facade, bliver). De kan derfor ikke
   redeklareres i engine.js — kræver `ENGINE_`-kopier (som ENGINE_GLUCOSE_G_PER_MMOL).
3. **Facade-entanglement i prep'en (lige før løkken, ~2270-2380):**
   - `totalExerciseMinutes +=` (facade/campaign-mål — bevidst ikke flyttet i S2.8).
   - `this.stopAktivitet()` + `emitEvent('exercise-max-duration')`+flush (auto-stop
     ved 4t/varighed).
   - box-sweep `_prevTrueBG`/`_prevTimeInMinutes` (facade/Box Challenge).
   - carb-rate bruger `GLUCOSE_G_PER_MMOL` (→ ENGINE_-kopi findes).
4. **Graf-sampling i løkken (~2491-2516):** `physiologyDataPoints.push(...)` (global,
   graf/UI — facade per S4) + `_lastPhysioRecordTime` (facade graf-state). Skal
   BLIVE på facaden eller gå via en engine-sample-buffer som facaden dræner.

**Foreslået S7.6-opdeling (hver bit-identisk, verificér efter hver):**
- **S7.6a:** flyt `regenerateDawn` + `circadianKortisolNiveau` + `circadianISF` +
  `currentISF` + `currentCarbEffect` til engine. EXERCISE_* som `ENGINE_`-kopier;
  `_campaignDisableDawn`/`dawnAmplitude` afklares (proxy). Getter-proxyer på Simulator.
- **S7.6b:** flyt carb-rate/τG/puls-prep ind i engine.step(). Facade-bits løses:
  `totalExerciseMinutes` → engine (proxy) eller event; `stopAktivitet`/auto-stop →
  emit event som facaden håndterer; box-sweep `_prev*` bliver facade (sættes i
  facade-stepperen FØR engine.step(), eller via event).
- **S7.6c:** flyt selve `while`-løkke-kroppen ind i engine.step(). Graf-sampling
  enten på facaden (engine eksponerer en per-substep sample-hook) eller via buffer.
  Rækkefølge-invarianterne (fedt/protein FØR hovorka.step, ketoner EFTER, trueBG
  sidst) holdes 1:1.
- **S7.7/S7.8:** post-loop split + fjern scenario-bro (uændret fra plan).

INGEN kode ændret i denne blok. Sidste kode-slice (S7.5e) verificeret:
golden-master 7/7 bit-identisk, suite 155/155.

### 2026-06-16 — Claude — S7.5e: resterende leaf-metoder til engine (S7.5 komplet)

- Flyttet de sidste leaf-fysiologi-metoder til `PhysiologyEngine` med facade-wrappers:
  `_processActiveIntake`, `updateStressHormones`, `updateHAAF`,
  `updateGlycogenReserve`, `_substepGlucagon`.
- Stress-klyngen (`updateStressHormones` → `updateHAAF` + `updateGlycogenReserve`)
  blev flyttet samlet via et Node-script der kopierer metode-teksten direkte fra
  simulator.js til engine (ingen manuel reproduktion). Scriptet håndterer at de
  to filer har FORSKELLIGE linjeendelser (simulator.js = CRLF, engine.js = LF) ved
  at detektere EOL pr. fil og normalisere den indsatte kode.
- `updateGlycogenReserve` og `_substepGlucagon` brugte modul-globalen
  `GLUCOSE_G_PER_MMOL` → erstattet med engine-kopien `ENGINE_GLUCOSE_G_PER_MMOL`
  (tilføjet i S7.5c).
- S7.5 KOMPLET: alle 12 leaf-fysiologi-metoder (`_substep*`/`update*`) bor nu i
  engine. Simulator har kun tynde delegerende wrappers tilbage. Substep-løkken i
  `_stepPhysiology` kalder dem stadig via `this.X` (wrappers → engine).
- Verificeret BIT-IDENTISK efter hver: engine-API 7/7, golden-master 7/7
  bit-identisk (alle 7 scenarier), fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl/SyntaxError; 12/12 flyttede metoder
  ligger på engine; fuldt multi-feature-scenarie (burger + 5E bolus + cardio +
  glukagon over 160 sim-min) gav konsistente værdier.
- NÆSTE (S7.6): flyt selve substep-løkken (`while remaining > 0`) + carb/τG/puls-
  prep ind i `engine.step()`. STORT/følsomt trin — facade-rest i prep'en
  (`totalExerciseMinutes`, `stopAktivitet`, box-sweep `_prevTrueBG`/
  `_prevTimeInMinutes`, GLUCOSE_G_PER_MMOL i carb-rate) skal afklares. Bør tages
  forsigtigt, evt. delt op (prep / loop-krop / post-loop).

### 2026-06-16 — Claude — S7.5d: substep-ODE-metoder til engine (ketoner, rapid-insulin, fedt/protein)

- Flyttet tre rene substep-ODE-metoder til `PhysiologyEngine` med facade-wrappers:
  `_substepKetones`, `_substepRapidInsulin`, `_substepFatProteinFFA`.
- Alle tre læser kun engine-state + engine-konstanter (LIPOLYSIS_*/CPT1_*/BHB_*
  fra S7.4a, STOMACH_*/TAU_*/FFA_*/AA_* fra S7.4b) + hovorka. Ingen bare-globals,
  emit/flush, DOM eller facade-getters. (De emit/flush jeg først troede lå i dem
  viste sig at tilhøre nabometoderne performKetoneTest/addFastInsulin — bekræftet
  ved at læse hver metode fuldt.)
- `_substepFatProteinFFA` (218 linjer) blev flyttet via et lille Node-script
  (CRLF-aware tekst-replace) i stedet for manuel reproduktion, for at undgå
  copy-fejl i den lange kommenterede metode. Kode flyttet eksakt; kommentarer
  kondenseret (påvirker ikke adfærd).
- Verificeret BIT-IDENTISK efter hver: engine-API 7/7, golden-master 7/7
  bit-identisk (inkl. meal-fat-protein + fat-delay-tests), fuld suite 155/155.
- NÆSTE (S7.5e): `_processActiveIntake` + `updateStressHormones` (begge rene
  per bounded analyse), derefter `_substepGlucagon` (bruger GLUCOSE_G_PER_MMOL +
  ev. KCAL_PER_KG_WEIGHT — kræver ENGINE_-kopi som S7.5c).

### 2026-06-16 — Claude — S7.5c: updateMuscleGlycogen til engine (+ konstant-konsolidering)

- Flyttet `updateMuscleGlycogen` til `PhysiologyEngine`. Læser kun engine-state
  (muskelglykogen-pool, activeAktivitet, cob, ISF, hovorka).
- De 6 `MUSCLE_GLYCOGEN_*` rate-konstanter (DEPLETION_FRACTION, FAST_PHASE_RATE,
  SLOW_PHASE_RATE, CHO_ACCEL_RATE, FAST_PHASE_HL_MIN, RESYNTH_PLASMA_CAP) blev
  KUN brugt af denne metode → flyttet som modul-konstanter til toppen af
  physiology-engine.js og fjernet fra simulator.js (samme navne, ingen kollision
  da de ikke længere findes i simulator.js).
- KONSOLIDERING: den midlertidige `ENGINE_MUSCLE_GLYCOGEN_G_PER_KG` (S2.9-duplikat)
  erstattet af `MUSCLE_GLYCOGEN_G_PER_KG` i engine; den døde kopi i simulator.js
  (0 brug) fjernet. S2.9-TODO løst.
- `GLUCOSE_G_PER_MMOL` bruges fortsat ~8 steder i simulator.js og kan IKKE
  redeklareres i engine.js (browseren deler globalt lexical scope -> SyntaxError).
  Engine fik derfor `ENGINE_GLUCOSE_G_PER_MMOL` (samme værdi). Samles til én kilde
  når de resterende GLUCOSE_G_PER_MMOL-metoder er flyttet.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk
  (inkl. exercise-cardio), fuld suite 155/155.
- Browser-smoke (:3000): KRITISK redeklarations-tjek bestået — ingen SyntaxError,
  alle globals (Simulator/T1DPhysiologyEngine/GLUCOSE_G_PER_MMOL) loadet; motion
  tømmer + post-motion resynthesis fylder muskelglykogen; kapacitet 385 (70×5.5).
- NÆSTE (S7.5d): de resterende leaf-metoder med facade-kald: `_substepKetones`,
  `_substepRapidInsulin`, `_substepGlucagon` (sidstnævnte emitter weight-status
  + flusher), `_substepFatProteinFFA`, `_processActiveIntake` (emitter insulin-
  events), `updateStressHormones`. Kræver håndtering af emit/flush og bare-globals.

### 2026-06-16 — Claude — S7.5b: updateBrainEnergyDeficit + updateAcidosisLoad til engine

- Flyttet de to skades-akkumulatorer `updateBrainEnergyDeficit` og
  `updateAcidosisLoad` til `PhysiologyEngine`. Begge læser kun engine-state
  (`trueBG`, `hovorka.F_01`/`plasmaInsulin`, `ketoneLevel`) + engine-konstanter
  (BRAIN_*/ACIDOSIS_*).
- Deres interne 50%-guards `brainDeficitWarningGiven` og `acidosisWarningGiven`
  er flyttet til engine (de er nu rent self-gating — popup fjernet, læses kun i
  egen metode). Simulator eksponerer dem via get/set-proxy, så reset-steder
  (`resetForRespawn`, fuld reset) skriver uændret via `this.X`.
- Simulator beholder tynde delegerende wrappers for begge metoder.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk
  (inkl. ketones-dka/pump-failure), fuld suite 155/155.
- NÆSTE (S7.5c): `updateMuscleGlycogen` — bruger modul-globale `MUSCLE_GLYCOGEN_*`
  + `GLUCOSE_G_PER_MMOL`, som skal flytte med til engine (eller duplikeres som i
  S2.9). Tjek også activity-typedef-reference.

### 2026-06-16 — Claude — S7.5a: updateGlucotoxicity flyttet til engine

- Start på S7.5 (fysiologi-metoder ind i engine, leaf-first med facade-delegering).
- Flyttet `updateGlucotoxicity(simulatedMinutesPassed)` til `PhysiologyEngine`.
  Metoden er helt ren: læser kun engine-state (`trueBG`, `glucotoxicLoad`) +
  engine-konstanter (GLUCOTOX_*, flyttet i S7.4c) og skriver engine-state
  (`glucotoxicLoad`, `glucotoxicResistanceFactor`). Ingen facade-flag, globals
  eller side-effects.
- `Simulator.updateGlucotoxicity()` er nu en tynd wrapper:
  `return this.engine.updateGlucotoxicity(...)`. Substep-løkken kalder den
  uændret -> bit-identisk.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk,
  fuld suite 155/155.
- NÆSTE (S7.5b): `updateBrainEnergyDeficit` + `updateAcidosisLoad`. Deres interne
  guard-flag (`brainDeficitWarningGiven`/`acidosisWarningGiven`) er nu rent
  self-gating (popup fjernet, læses kun i egen metode) og flyttes til engine med.

### 2026-06-16 — Claude — S7.4c: brain/glukotoks/HAAF/leverglykogen-konstanter (S7.4 komplet)

- Flyttet sidste instans-konstant-gruppe fra Simulator-konstruktøren til
  `PhysiologyEngine`: BRAIN_DEFICIT_THRESHOLD, BRAIN_CRISIS_BG, BRAIN_RECOVERY_HALF,
  GLUCOTOX_BG_THRESHOLD, GLUCOTOX_RATE, GLUCOTOX_RECOVERY_HALF, GLUCOTOX_MAX_RESIST,
  GLUCOTOX_EC50, GLUCOTOX_HILL_N, HAAF_DAMAGE_SCALE, HAAF_RECOVERY_HALFLIFE,
  LIVER_GLYCOGEN_MAX, GLYCOGEN_STRESS_THRESHOLD. Getter-proxy på Simulator.
- S7.4 KOMPLET: alle fysiologi-instans-konstanter (~40) ejes nu af engine.
  Tilbageværende facade-bare-globale (`GLUCOSE_G_PER_MMOL`, `MUSCLE_GLYCOGEN_*`,
  `KCAL_PER_KG_WEIGHT`, `WEIGHT_GAMEOVER_FRACTION`, `AKTIVITETSTYPER`,
  `EXERCISE_*`) flyttes sammen med de metoder der bruger dem i S7.5.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk,
  fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl; konstanter via proxy uden shadowing;
  hypo (BG 2.0, 1t) -> brainEnergyDeficit 0.5; hyper (BG 18, 2t) ->
  glucotoxicLoad 1.55; HAAF_RECOVERY_HALFLIFE = 3*24*60.
- NÆSTE (S7.5): flyt leaf-fysiologi-metoder ind i engine, én gruppe ad gangen,
  med facade-delegering. Start med en selvstændig leaf (fx updateGlucotoxicity/
  updateAcidosisLoad/updateBrainEnergyDeficit) der nu kun læser engine-konstanter
  + engine-state. Håndtér bare-globale + facade-kald (`_flushEngineEvents`) ved
  de metoder der har dem.

### 2026-06-16 — Claude — S7.4b: fedt/protein/mave/FFA-resistens-konstanter til engine

- Flyttet fedt/protein/mave/FFA-resistens-instans-konstanter fra Simulator-
  konstruktøren til `PhysiologyEngine`: STOMACH_CAPACITY_PER_KG, STOMACH_HYSTERESIS,
  TAU_FAT_ABS, FFA_CLEARANCE_HALF, FFA_RESIST_MAX, FFA_EC50, FFA_HILL_N,
  TAU_PROT_ABS, AA_DECAY_RATE, AA_EC50, AA_HILL_N, PROTEIN_GLUCAGON_MAX.
- Getter-proxy på Simulator (immutable). Den konceptuelle mekanisme-prosa
  (mave-CSTR, pizza-effekt/FFA-resistens-flow, protein-glukagon-HGP-flow med
  kilder) blev BEVARET i js/simulator.js ved metoderne; kun konstant-linjerne
  er erstattet af pointers. Metoderne læser `this.X` uændret.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk
  (inkl. meal-fat-protein), fuld suite 155/155.
- Browser-smoke (:3000): ingen konsol-fejl; konstanter via proxy uden shadowing;
  pizza-måltid (40/40/40) -> ffaResistanceFactor 1.34, proteinGlucagonLevel 0.15,
  AA_DECAY_RATE = ln(2)/60 — alt konsistent.
- NÆSTE (S7.4c): brain/glukotoks/HAAF/leverglykogen-konstanter (BRAIN_*,
  GLUCOTOX_*, HAAF_*, LIVER_GLYCOGEN_MAX, GLYCOGEN_STRESS_THRESHOLD) — samme
  mønster. Derefter er S7.4 (instans-konstanter) lukket og S7.5 (metoder) kan
  begynde.

### 2026-06-16 — Claude — S7.4a: keton/lipolyse/acidose-konstanter flyttet til engine

- Rettede S7-rækkefølgen i fix-decision-doc'en: konstant-flytningen er en
  FORUDSÆTNING for at flytte fysiologi-metoderne (de læser `this.GLUCOTOX_*`/
  `this.LIPOLYSIS_*`/... der bor på Simulator). Ny rækkefølge: S7.4 konstanter
  (grupperet a/b/c) -> S7.5 metoder -> S7.6 løkke -> S7.7 post-loop -> S7.8 bro.
- S7.4a: flyttet keton/lipolyse/acidose-instans-konstanter fra Simulator-
  konstruktøren til `PhysiologyEngine`-konstruktøren: ACIDOSIS_THRESHOLD,
  ACIDOSIS_BHB_THRESHOLD, ACIDOSIS_RECOVERY_HALF, ACIDOSIS_BASE_RATE,
  ACIDOSIS_ACCEL_RATE, LIPOLYSIS_MAX, LIPOLYSIS_EC50, LIPOLYSIS_HILL_N,
  CPT1_EC50, CPT1_HILL_N, CPT1_MAX_SUPP, FFA_LIPO_CLEAR_HALF, BHB_PROD_RATE,
  BHB_DIET_FAT_FRAC, BHB_VMAX, BHB_KM, BHB_RENAL_THR, BHB_RENAL_VMAX, BHB_RENAL_KM.
- Simulator eksponerer dem via GETTER-proxy (immutable konstanter; ingen setter).
  Metoderne (stadig på facaden) læser `this.X` uændret -> bit-identisk, ingen
  call-site- eller metode-ændringer.
- Fuld kalibreringsprosa i Simulator erstattet af pointer til engine + docs/
  (BG-SCIENCE.md §23-25, MODEL-IMPLEMENTATION.md Step 3, git-historik). Værdier
  og inline-essens følger med konstanterne i engine.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk
  (inkl. ketones-dka), fuld suite 155/155.
- Browser-smoke (static-server :3000): ingen konsol-fejl; konstanter læses fra
  engine via proxy uden own-property-shadowing; pumpesvigt 10t -> BHB 1.47,
  acidose 0 (BHB < tærskel), BG stiger uden insulin — alt konsistent.
- NÆSTE (S7.4b): fedt/protein/mave/FFA-resistens-konstanter (STOMACH_*,
  TAU_FAT_ABS, FFA_CLEARANCE_HALF/RESIST_MAX/EC50/HILL_N, TAU_PROT_ABS, AA_*,
  PROTEIN_GLUCAGON_MAX) — samme mønster.

### 2026-06-16 — Claude — S7.3: insulin-rate-prep flyttet til engine

- Ekstraheret pre-loop insulin-blokken (basal-trapez-rate, direkte bolus-
  deponering i s1, 6-timers filtrering, rapid-IOB + displayIOB/bioavScale) fra
  `Simulator._stepPhysiology()` til ny metode `PhysiologyEngine._prepInsulinRates()`.
- `_stepPhysiology()` kalder nu `this.engine._prepInsulinRates()` på PRÆCIS samme
  position som den gamle inline-blok — ingen omrokering, ren ekstraktion.
- Al berørt state er engine-ejet (`activeFastInsulin`/`activeLongInsulin`/`iob`/
  `displayIOB`/`basalInsulinRate`/`bioavScale` fra S2.3) og Hovorka tilgås via
  `this.hovorka` (attachHovorka, S5.4). `this` i metoden = engine.
- Den lokale `totalInsulinRate` blev verificeret ubrugt efter beregning (kun
  2 referencer); beholdt verbatim for bit-identisk flytning, ikke fjernet.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk,
  fuld suite 155/155.
- Browser-smoke (static-server :3000): ingen konsol-fejl; 4E bolus + 40g carbs,
  IOB-kurve aftager realistisk (3.12 -> 0.39 over 3t); iob/displayIOB/
  basalInsulinRate ejet af engine; `_prepInsulinRates` til stede.
- NÆSTE (S7.4): selve substep-løkken (`while remaining > 0` med `hovorka.step()`
  + alle `_substep*`/`update*`-kald). STORT og følsomt — substep-rækkefølgen er
  kritisk (se invarianter i fix-decision-doc). Bør pauses for review/go og evt.
  deles yderligere (pre-step-prep / loop-krop / post-loop).

### 2026-06-16 — Claude — S7.2: tidsbogføring flyttet til engine.step()

- Flyttet `totalSimMinutes`, `timeInMinutes` og `day` til `PhysiologyEngine`
  (init i konstruktøren). `Simulator` eksponerer dem via get/set-proxyer, så
  campaign-start-override (totalSimMinutes/timeInMinutes ved levelstart) og alle
  øvrige `this.X`-referencer er uændrede.
- `engine.step(simMinutes)` fremskriver nu uret FØR facade-stepperen:
  `totalSimMinutes += simMinutes`, `timeInMinutes = total % 1440`,
  `day = floor(total/1440)+1`, og `totalKcalBurnedBase += restingKcalPerMinute *
  simMinutes` (begge sidstnævnte felter var allerede engine-ejet fra S2.5/S2.15).
- `Simulator._stepPhysiology()` starter nu direkte ved stress-/currentHour-blokken;
  de fire tids-/kcal-linjer er fjernet derfra. Rækkefølgen ift. resten af tikket
  er uændret (uret fremskrives stadig allerførst, nu blot i engine).
- Ingen RNG-træk eller substep-orden ændret.
- Verificeret BIT-IDENTISK: engine-API 7/7, golden-master 7/7 bit-identisk,
  fuld suite 155/155.
- Browser-smoke (static-server :3000): ingen konsol-fejl; tidsfelter ejet af
  engine (`s.totalSimMinutes === s.engine.totalSimMinutes`); 130x update(1)
  advancerer 130 min; resting-kcal = 1.5278 kcal/min korrekt; midnats-wrap via
  proxy-setter (total=1450 -> timeInMinutes=10, day=2).
- NÆSTE (S7.3): flyt insulin-rate-prep (basal-trapez-rate, bolus-deponering,
  IOB-beregning pre-loop) ind i engine. Hold logEvent/lyd i facaden (allerede
  events fra S3) og bevar RNG-/rækkefølge bit-identisk.

### 2026-06-16 — Claude — S7.1: step-søm + facade-stepper-bro (ingen beregning flyttet)

- Start på S7-fasen (engine ejer step-/update-loopet). Fuld sub-slice-plan og
  invarianter i `docs/reviews/2026-06-16_physiology-engine-step-loop-decision.md`.
- `js/physiology-engine.js`: tilføjet `attachStepper(fn)` og `step(simMinutes)`.
  `step()` delegerer uændret til den tilknyttede facade-stepper (`physicsStepper`).
  `physicsStepper` tilføjet til export/import-skip-listen (facade-reference,
  ikke engine-ejet state — som `hovorka`/`scenarioRunner`).
- `js/simulator.js`: konstruktøren kalder nu
  `this.engine.attachStepper(min => this._stepPhysiology(min))` (lige efter
  `attachScenarioRunner`). `update()`-kroppen (~770 linjer) er ekstraheret 1:1
  til ny metode `_stepPhysiology(simulatedMinutesPassed)`. `update(deltaTimeSeconds)`
  er nu kun: `isGameOver`-guard, `simulatedMinutesPassed = deltaSeconds * speed/60`
  og `this.engine.step(simulatedMinutesPassed)`.
- Ren ekstraktion + indirektion. Ingen fysiologi-matematik, RNG-rækkefølge eller
  substep-orden ændret. `_stepEngineScenario` (speed=60-broen) er uændret og
  virker stadig via `update()` -> `engine.step()`.
- Verificeret BIT-IDENTISK: `tests/.bin/node.exe tests/run-physiology-regression.js`
  = engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- Browser-smoke (static-server :3000): ingen konsol-fejl; ny Simulator(seed=42)
  -> 30x update(1) ved speed=60 advancerer totalSimMinutes=30, BG 5.5 -> 5.404;
  `engine.step`/`physicsStepper`/`_stepPhysiology` til stede; `exportState()`
  lækker hverken `physicsStepper` eller `scenarioRunner`.
- NÆSTE (S7.2): flyt tidsbogføring (`totalSimMinutes`/`timeInMinutes`/`day`-
  fremskrivning + resting-kcal-burn) ind i `engine.step()`. Hold rækkefølge og
  RNG-træk uændret; verificér bit-identisk.

### 2026-06-15 — Codex — S6 lukket for regression/API/testloader-sporet

- S6-status efter S6.1-S6.12:
  - `tests/physiology-engine-api.test.js` tester direkte engine-API uden DOM.
  - `tests/run-physiology-regression.js` samler engine-API, golden-master og fuld
    Node-suite.
  - `docs/MODEL-API.md` dokumenterer den aktuelle Lab-API, Hovorka-bro,
    scenario-runner, events og testkommandoer.
  - README linker til API-dokumentet og den samlede regression.
  - `js/foods.js`, `js/hovorka.js`, `js/physiology-engine.js` og
    `js/simulator.js` har guarded CommonJS-export til Node-tests/labs.
  - `tests/*.js` bruger ikke længere eval-tail til centrale model-filer.
- Samlet verifikation fra S6.12 er fortsat gældende:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE arkitekturskridt bør vælges ud fra planen:
  1. Enten fortsætte mod en mere selvstændig engine ved at flytte Hovorka/step-loop
     fra `Simulator` til `PhysiologyEngine`.
  2. Eller tage en mindre oprydningsslice først, hvor scenario-runner-broen og
     facade-grænserne dokumenteres/testes yderligere.

### 2026-06-15 — Codex — S6.12: sidste eval-loader fjernet fra tests/*.js

- Omskrevet `tests/peis-verification.js` til `require('./harness.js')` i stedet
  for `loadJs(...)` + eval-load af `foods.js`, `hovorka.js` og `simulator.js`.
- Scriptets ekstra standalone-mocks (`window`, `localStorage`, `performance`,
  CSV-relaterede globals og UI-hooks) er bevaret, så eksperimentets runtime-miljø
  stadig matcher det tidligere script.
- Verificeret at scriptet fuldfører og producerer CSV-output med:
  `tests/.bin/node.exe tests/peis-verification.js`.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- Rest-inventar: `rg "eval\\(|eval-tail|evalIntoGlobal" tests -g "*.js"` bør nu
  være tomt. S6-loader-sporet er dermed rent; næste arbejde bør være enten at
  lukke S6 formelt i loggen eller starte næste arkitekturslice fra planen.

### 2026-06-15 — Codex — S6.11: ketone-calibration genbruger fælles harness

- Omskrevet `tests/ketone-calibration.js` til `require('./harness.js')` i stedet
  for lokal DOM-mock + eval-load af `hovorka.js` og `simulator.js`.
- Script-logik, scenarier og modelparametre er ikke ændret; kun loader/setup er
  samlet.
- Verificeret at scriptet starter og fuldfører med:
  `tests/.bin/node.exe tests/ketone-calibration.js`.
  Scriptet returnerer fortsat exit 1, fordi dets egne kalibreringsmål rapporterer
  2/4 scenarier som FAIL. Det er ikke en loader-fejl og blev ikke forsøgt rettet i
  denne refaktor-slice.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): `tests/peis-verification.js` er eneste resterende eval-loader i
  `tests/*.js`. Den har bredere standalone-mocks (`window`, `localStorage`,
  `performance`, ekstra UI-hooks) og bør tages som en særskilt sidste loader-slice.

### 2026-06-15 — Codex — S6.10: kalibreringsscripts genbruger fælles harness

- Omskrevet tre simple, headless scripts til `require('./harness.js')` i stedet
  for lokal DOM-mock + eval-load af `foods.js`, `hovorka.js` og `simulator.js`:
  - `tests/calibrate-ketone-diet-fat.js`
  - `tests/calibrate-ketone-pathway.js`
  - `tests/evaluate-n4-exercise-factor.js`
- Script-logik, scenarier og modelparametre er ikke ændret; kun loader/setup er
  samlet.
- `tests/peis-verification.js` og `tests/ketone-calibration.js` er ikke flyttet i
  denne slice, fordi de har bredere standalone browser-mocks (`window`,
  `localStorage`, ekstra UI-hooks) og bør tages særskilt.
- Verificeret at de tre scripts fuldfører med:
  `tests/.bin/node.exe tests/evaluate-n4-exercise-factor.js`,
  `tests/.bin/node.exe tests/calibrate-ketone-pathway.js` og
  `tests/.bin/node.exe tests/calibrate-ketone-diet-fat.js`.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): enten tage de to mere komplekse standalone scripts med en særskilt
  plan, eller lukke S6 som færdig for regression/API-sporet.

### 2026-06-15 — Codex — S6.9: simulation.test genbruger fælles harness

- Opdateret `tests/harness.js`, så den også eksporterer `FOODS`, `CARB_TYPES`,
  `CHILD_PORTION_SCALE` og `estimateEatTimeMin`.
- Omskrevet toppen af `tests/simulation.test.js`, så den bruger
  `require('./harness.js')` til browser-mocks, globals og module-load i stedet
  for sin egen duplikerede setup-blok.
- Testfilens egne helpers (`createCleanSimulator`, `setSimulatorBG`,
  `simulateMinutes`) er bevidst bevaret i denne slice, så eksisterende
  testadfærd og tolerancer ikke ændres af loader-oprydningen.
- Verificeret direkte med:
  `tests/.bin/node.exe tests/simulation.test.js`.
  Resultat: fuld suite 155/155.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): overvej om `tests/simulation.test.js` også skal bruge de fælles
  helper-funktioner fra harness, eller om S6 er stærk nok til at lukke med den
  nuværende API-doc og regression runner.

### 2026-06-15 — Codex — S6.8: simulator.js CommonJS-export og eval-tail fjernet fra model-tests

- Tilføjet guarded CommonJS-export i `js/simulator.js`: `{ Simulator }`.
  Browserens globale script-flow er uændret, fordi eksporten kun aktiveres når
  `module.exports` findes.
- Opdateret `tests/harness.js`, så `Simulator` loades via `require()` i stedet
  for `evalIntoGlobal()`. Den gamle eval-helper og ubrugte `fs`/`path` imports
  er fjernet.
- Opdateret `tests/simulation.test.js` på samme måde. Testmiljøet lægger stadig
  `FOODS`, `CARB_TYPES`, `HovorkaModel`, `PhysiologyEngine`, `createEngine` og
  `Simulator` eksplicit på `global`, så Node-testene matcher browserens
  script-rækkefølge.
- Opdateret `docs/MODEL-API.md`, så Node-load-eksemplet viser `foods`,
  `physiology-engine`, `hovorka` og `simulator`.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): overvej at samle den duplikerede browser-mock/testloader mellem
  `tests/harness.js` og `tests/simulation.test.js`, eller stoppe ved dette
  stærke dokumenterede API/test-punkt.

### 2026-06-15 — Codex — S6.7: foods.js CommonJS-export og testloader-oprydning

- Tilføjet guarded CommonJS-export i `js/foods.js`:
  `{ FOODS, CARB_TYPES, CHILD_PORTION_SCALE, estimateEatTimeMin }`.
- Opdateret `tests/harness.js`, så madkataloget loades via `require()` og
  derefter lægges på `global` for at matche browserens globale script-miljø.
- Opdateret `tests/simulation.test.js` på samme måde. Dermed er `foods`,
  `hovorka` og `physiology-engine` nu modul-loadet i Node-testene; kun
  `simulator.js` bruger stadig eval-tail.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): overvej om `simulator.js` skal have en meget forsigtig guarded
  export. Det er mere følsomt end de øvrige filer, fordi `Simulator` stadig er
  facaden mellem fysiologi, UI, lyd, score, Box Challenge og browser-globals.

### 2026-06-15 — Codex — S6.6: test-harness bruger require for engine/Hovorka

- Opdateret `tests/harness.js`, så `js/hovorka.js` og
  `js/physiology-engine.js` loades via CommonJS `require()` i stedet for eval.
- Opdateret `tests/simulation.test.js` på samme måde.
- `foods.js` og `simulator.js` bruger stadig eval-tail i disse tests, fordi de
  endnu ikke har CommonJS-export. Den grænse er bevidst holdt ude af denne slice.
- Verificeret med samlet regression:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
  Resultater: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): enten stoppe ved et stærkt rent punkt, eller tage en særskilt
  loader-slice for `foods.js`/`simulator.js` hvis det ønskes. Simulator-export er
  mere følsomt, fordi filen stadig er spillets facade og deler mange globals.

### 2026-06-15 — Codex — S6.5: CommonJS-export for engine og Hovorka

- Tilføjet guarded CommonJS-export i `js/physiology-engine.js`:
  `{ createEngine, PhysiologyEngine, makeRng }`.
- Tilføjet guarded CommonJS-export i `js/hovorka.js`: `{ HovorkaModel }`.
- Omskrevet `tests/physiology-engine-api.test.js` til almindelig `require()` i
  stedet for eval-tail. Det gør den direkte engine-test tættere på fremtidige
  Node-labs og reducerer special-harness.
- Opdateret `docs/MODEL-API.md`, så Node-load beskrives med `require()` og ikke
  længere som udskudt `module.exports`.
- Verificeret: `tests/.bin/node.exe tests/physiology-engine-api.test.js` = 7/7.
  Samlet regression `tests/.bin/node.exe tests/run-physiology-regression.js`
  bestod: engine-API 7/7, golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): overvej om `tests/harness.js` og `tests/simulation.test.js` kan
  bruge `require()` for `hovorka.js`/`physiology-engine.js` i stedet for eval,
  men gør det i en lille slice og verificér hele regressionen bagefter.

### 2026-06-15 — Codex — S6.4: samlet physiology regression runner

- Tilføjet `tests/run-physiology-regression.js`.
- Scriptet kører i rækkefølge:
  1. `tests/physiology-engine-api.test.js`
  2. `tests/golden-master.js check`
  3. `tests/simulation.test.js`
- Scriptet bruger `process.execPath`, så det genbruger den Node-runtime der
  startede scriptet, typisk `tests/.bin/node.exe`.
- Opdateret `README.md` og `docs/MODEL-API.md` med den samlede kommando:
  `tests/.bin/node.exe tests/run-physiology-regression.js`.
- Verificeret: samlet regression bestod. Resultater: engine-API 7/7,
  golden-master 7/7 bit-identisk, fuld suite 155/155.
- NÆSTE (S6): ompeg udvalgte eksisterende tests/labs til engine-API'et direkte
  og vurder hvor DOM-mocks kan fjernes uden at miste gameplay-testdækning.

### 2026-06-15 — Codex — S6.3: README viser engine-API og testkommandoer

- Opdateret `README.md` i fysiologi-/testafsnittet.
- Tilføjet link til `docs/MODEL-API.md`.
- Tilføjet link og kommando til `tests/physiology-engine-api.test.js`.
- Opdateret eksisterende automatiseret testkommando til portable Node-formen:
  `tests/.bin/node.exe tests/simulation.test.js`.
- Tilføjet `js/physiology-engine.js` og `tests/physiology-engine-api.test.js`
  til README-filstrukturen.
- Verificeret sanity: `tests/.bin/node.exe tests/physiology-engine-api.test.js`
  = 7/7. Dokumentationsændringen ændrer ingen simulationstal.
- NÆSTE (S6): ompeg konkrete eksisterende modeltests/labs til engine-API'et, eller
  lav en samlet standard-testkommando/script hvis projektet skal køre
  engine-API-test + golden-master + fuld suite med én kommando.

### 2026-06-15 — Codex — S6.2: første MODEL-API dokumentation

- Tilføjet `docs/MODEL-API.md`.
- Dokumentet beskriver den aktuelle engine-API under migration: `createEngine`,
  seed/noise-determinisme, `exportState()`/`importState()` snapshot-format,
  Hovorka-broen, `setBG()`, `setPlasmaInsulinClamp()`, event-bufferen,
  `runScenario()` og scenario-runnerens midlertidige begrænsninger.
- Dokumentet noterer eksplicit at `hovorka` og `scenarioRunner` er bro-referencer,
  ikke serialiseret engine-state, og at engine stadig ikke må kalde DOM, lyd,
  i18n, game-over eller UI direkte.
- Verificeret sanity: `tests/.bin/node.exe tests/physiology-engine-api.test.js`
  = 7/7. Dokumentationsændringen ændrer ingen simulationstal.
- NÆSTE (S6): ompeg udvalgte eksisterende modeltests/labs til engine-API'et,
  eller opdatér testkommandoer/README hvis projektet skal køre den nye
  `physiology-engine-api.test.js` som fast del af standardverifikationen.

### 2026-06-15 — Codex — S6.1: direkte engine-API-test uden DOM-mocks

- Tilføjet `tests/physiology-engine-api.test.js`.
- Testfilen loader kun `js/physiology-engine.js` og `js/hovorka.js` via eval,
  ikke `tests/harness.js` og ikke `Simulator`/DOM-/lyd-/i18n-mocks.
- Dækker `exportState()`/`importState()` med RNG-fortsættelse og eventCount,
  dyb kopi med `Infinity`/`undefined`, `setNoise()`, `setBG()`,
  `setPlasmaInsulinClamp()`, `runScenario()` via fake runner og tydelige fejl
  ved ugyldige Lab-API-kald.
- Testen bekræfter også at `scenarioRunner` ikke eksporteres som snapshot-state.
- Verificeret: `tests/.bin/node.exe tests/physiology-engine-api.test.js` = 7/7.
  Golden-master `check` = 7/7 bit-identisk. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S6): enten ompeg udvalgte eksisterende tests/labs til engine-API'et,
  eller skriv første version af `docs/MODEL-API.md` med API-format, event-skema,
  snapshots, seed/noise og scenario-runner-begrænsninger.

### 2026-06-15 — Codex — S5.7: runScenario() via midlertidig scenario-runner

- Tilføjet `scenarioRunner = null` og `PhysiologyEngine.attachScenarioRunner()`.
  Runneren er en midlertidig bro, ikke engine-ejet fysiologisk state.
- `Simulator` registrerer runneren efter Hovorka-oprettelse. Runneren har tre
  callbacks:
  `step(minutes)`, `applyEvent(event)` og `getSample()`.
- Tilføjet `PhysiologyEngine.runScenario(events, durationMinutes, stepMinutes)`.
  Metoden sorterer events efter `time`/`minute`/`at`/`t`, stepper til event-tider
  og returnerer `{ durationMinutes, stepMinutes, samples, finalState }`.
- Første event-skema understøtter: `setBG`, `setNoise`,
  `setPlasmaInsulinClamp`, `food`/`addFood`, `rapidInsulin`/`fastInsulin`/`bolus`,
  `basalInsulin`/`longInsulin`, `activity`/`startActivity`, `stopActivity` og
  `glucagon`. Ukendte typer fejler tydeligt.
- `exportState()` og `importState()` springer `scenarioRunner` over, ligesom
  `hovorka`, så snapshots ikke indeholder facade-callbacks.
- Målrettet Node-tjek: scenarie med `setBG`, mad, hurtiginsulin og clamp; samples
  ved start/slut; finalState; runner udeladt fra export og bevaret over import;
  ukendt event-type fejler.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- Arbejdsvurdering: S5 Lab-API er funktionelt dækket. NÆSTE bør være S6:
  ompeg relevante model-/lab-tests til engine-API direkte, fjern unødvendige
  DOM-mocks hvor det er sikkert, og skriv `docs/MODEL-API.md`.

### 2026-06-15 — Codex — S5.6: plasma-insulin clamp

- Tilføjet `plasmaInsulinClamp = null` som engine-state. `null` betyder normal
  Hovorka-dynamik og er standard, så almindeligt spil er uændret.
- Tilføjet `PhysiologyEngine.setPlasmaInsulinClamp(valueOrNull)`. `null` slår
  clamp fra; et ikke-negativt mU/L-tal aktiverer clampen og anvender den straks
  på Hovorkas plasma-insulin `state[6]`.
- Tilføjet `PhysiologyEngine.applyPlasmaInsulinClamp()` som intern hook til
  Simulator-substeps. Den returnerer `false` når clamp er inaktiv.
- Simulator kalder clamp-hooket lige før og lige efter `hovorka.step(stepDt)`.
  Dermed bruger Hovorka-aktionsvariablerne den clampede insulinværdi, og
  ketonmodellen læser også den clampede plasma-insulinværdi efter step.
- Målrettet Node-tjek: clamp returnerer `this`, gemmer state, anvendes straks,
  fastholder `hovorka.state[6]` gennem simulation, `null` slår fra, og ugyldige
  værdier/manglende Hovorka-reference afvises.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S5): `runScenario()` er den resterende store Lab-API-del, men den
  kræver en tydelig beslutning om hvor meget af Simulatorens `update()`-loop og
  intervention-API der skal pakkes ind i engine. Anbefaling: stop her eller lav
  først en lille plan/inventar for `runScenario()` i stedet for at implementere
  den direkte.

### 2026-06-15 — Codex — S5.5: setBG(mmolL) med Hovorka-synkronisering

- Tilføjet `PhysiologyEngine.setBG(mmolL)` som lille Lab-API-slice efter
  Hovorka-broen. Metoden er til laboratorieinitialisering af start-BG og rydder
  ikke insulin, mad, motion, stress eller andre fysiologiske effekter.
- Metoden validerer at input er et positivt, endeligt mmol/L-tal og kræver en
  tilknyttet Hovorka-model.
- Hovorka Q1 (`state[4]`) og Q2 (`state[5]`) skaleres proportionalt ligesom
  eksisterende campaign startBG-override, så plasma- og perifær glukose ikke
  starter inkonsistent. CGM-kompartmentet C (`state[10]`) sættes til samme BG.
- Engine-state synkroniseres direkte: `trueBG = mmolL` og `cgmBG = mmolL`.
  Metoden returnerer `this` for kæde-kald.
- Målrettet Node-tjek: kæde-return, `trueBG`/`cgmBG`, Q1, Q2, C og fejl ved
  ugyldig værdi/manglende Hovorka-reference.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S5): overvej at ompege test-hjælperne `setSimulatorBG()` til
  `sim.engine.setBG()` som lille test-infrastruktur-slice, eller planlæg næste
  Lab-API-metode (`setPlasmaInsulinClamp()`/`runScenario()`). Clamp og scenario
  berører update-flowet mere og bør deles op.

### 2026-06-15 — Codex — S5.4: Hovorka-reference som lille bro til Lab-API

- Valgt den lille arkitekturvej (a) fra S5.3-loggen: engine får en reference til
  den eksisterende `HovorkaModel`, mens ejerskab og `update()`-loop stadig bliver
  i Simulator-facaden. Der er ingen fysiologisk beregning flyttet i denne slice.
- Tilføjet `PhysiologyEngine.attachHovorka(hovorka)`, som gemmer referencen og
  returnerer `this`.
- Simulator kalder nu `this.engine.attachHovorka(this.hovorka)` lige efter
  `new HovorkaModel(...)`. Det oplåser næste små Lab-API-slices som `setBG()`,
  fordi engine nu kan synkronisere `trueBG`/`cgmBG` med Hovorka Q1.
- `exportState()` og `importState()` springer eksplicit `hovorka` over. Hovorka
  er en bro-reference, ikke engine-ejet serialiseret state i snapshot v1.
- Målrettet Node-tjek: `engine.hovorka === sim.hovorka`, `exportState()` udelader
  `hovorka`, og `importState()` bevarer Hovorka-referencen.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S5): implementér `setBG(mmolL)` som lille Lab-API-slice. Den skal
  validere input og synkronisere både engine-BG (`trueBG`/`cgmBG`) og Hovorka
  Q1/C-state, så næste Hovorka-step ikke trækker BG tilbage mod gammel intern
  tilstand.

### 2026-06-15 — Claude — S5.3: setNoise() / noiseEnabled (lab-API)

- Tilføjet `noiseEnabled` (default true via `options.noiseEnabled !== false`) og
  `setNoise(enabled)` til `PhysiologyEngine` (returnerer `this`).
- I Simulators CGM-calc (`update`) gates de tre sensorstøj-kilder på
  `this.engine.noiseEnabled`: proportional støj (randomNoise), langsom drift
  (systemicDeviation) og diskontinuitet. Når true (default) er udtrykkene
  uændrede → bit-identisk; når false bliver cgmBG = rent interstitielt signal.
- Determinisme-opdelingen fra planen er nu komplet: seed = reproducerbar rng-
  sekvens; noiseEnabled = om støj påføres.
- Bevidst IKKE gated (uden for "sensorstøj"): kompressions-event (B10),
  CGM-selvtest-trigger, samt målefejl på fingerprik/keton og fysiologisk
  gaussRand-variation (dawn/søvn). Kan tilføjes senere hvis et lab-behov opstår.
- `exportState`/`importState` IKKE rørt (noiseEnabled er en runtime-toggle, ikke
  del af det deterministiske snapshot v1). Kan medtages ved en senere version-bump.
- Verificeret: golden-master 7/7, suite 155/155, målrettet tjek (default on,
  setNoise returnerer this, on≠off, off deterministisk).
- VIGTIGT FUND (arkitektur-blocker): De resterende S5-metoder (`setBG`,
  `runScenario`, `setPlasmaInsulinClamp`) er BLOKERET af at engine endnu IKKE
  ejer/driver Hovorka-modellen eller `update()`-loopet — begge bor stadig på
  Simulator (`this.hovorka` oprettes i Simulator-konstruktøren linje ~370; engine
  har ingen hovorka-reference). `setBG` skal synke Hovorka Q1
  (`hovorka.state[4] = mmolL * hovorka.V_G`), ellers er den fysiologisk brudt
  (Hovorka trækker BG tilbage ved næste step). Kun at sætte `trueBG/cgmBG` er
  derfor IKKE nok.
- ANBEFALING (diskuter med bruger før implementering): næste slice bør være en
  lille arkitektur-beslutning — enten (a) giv engine en reference til Hovorka
  (`engine.hovorka = this.hovorka`, sat af Simulator), så `setBG`/`clamp` kan
  synke Q1/plasma-insulin, eller (b) flyt Hovorka-ejerskab + step-loop ind i
  engine (større slice, mod S5/S6-målet om en fuldt selvstændig engine). FØR
  dette giver setBG/runScenario/clamp ikke mening at implementere.

### 2026-06-15 — Codex — S5.2: importState() for export-formatet

- Tilføjet intern `_setState()` på den seedede RNG-funktion. Det gør det muligt
  at flytte RNG-positionen ved import uden at udskifte funktionsobjektet, så
  `Simulator.rng` og `engine.rng` fortsat peger på samme funktion.
- Tilføjet `PhysiologyEngine.importState(snapshot)` for `exportState()` version 1.
  Metoden gendanner engine-ejede felter med dyb kopi, sætter `_seed` og
  `rngState`, og returnerer et nyt `exportState()` snapshot af den importerede
  tilstand.
- Event-bufferen ryddes ved import. `exportState()` gemmer kun `eventCount` som
  metadata, ikke de konkrete side-effect-events, så import forsøger ikke at
  genafspille gamle facade-events.
- Målrettet Node-tjek: import gendanner `weight`, `trueBG` og `cgmBG`, bevarer
  `Simulator.rng === engine.rng`, fortsætter samme RNG-sekvens som kilden,
  rydder event-bufferen og dybkopierer arrays.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S5): næste lille Lab-API-bid kan være `setNoise(false)`/`noiseEnabled`
  som præcis støj-kontakt, eller `setBG(mmolL)` hvis planen prioriterer
  laboratorieinitialisering af start-BG.

### 2026-06-15 — Codex — S5.1: read-only exportState()

- Tilføjet `_state` på den seedede RNG-funktion, så engine kan eksportere den
  aktuelle RNG-position til senere `importState()`/fortsættelse. Selve
  mulberry32-sekvensen er uændret og bit-identisk.
- Tilføjet `_cloneForExport()` i `PhysiologyEngine`, så snapshot-kopier bevarer
  værdier som `Infinity` og `undefined` i stedet for at gå gennem JSON.
- Tilføjet `exportState()` med `version`, `seed`, `rngState`, `eventCount` og
  dybt kopieret `state`. Funktionen er read-only: den muterer ikke engine-state
  og tømmer ikke event-bufferen.
- Målrettet Node-tjek: samme seed giver samme sekvens, metadata er korrekt,
  dyb kopi virker, `Infinity`/`undefined` bevares, og `peekEvents()` viser at
  events stadig ligger i bufferen efter export.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S5): vælg næste lille Lab-API-slice. Forslag: `importState()` for
  samme export-format, eller en read-only/ikke-muterende `runScenario()` hvis
  planen prioriterer scenarieafvikling før state-import.

### 2026-06-15 — Codex — S4 lukket: graf-/visuel historik ligger uden for engine

- Rest-inventar efter S4.1: `js/physiology-engine.js` indeholder ingen
  `cgmDataPoints`, `trueBgPoints`, `physiologyDataPoints`, `bgHistoryForStats`,
  `graphMessages`, `floatingLabels` eller `nightAwakenings`.
- Grafserier og visuel historik ejes nu af Simulator/UI-laget:
  `cgmDataPoints`, `trueBgPoints`, `physiologyDataPoints`, `bgHistoryForStats`,
  `graphMessages`, `floatingLabels` og `nightAwakenings`.
- Arbejdsvurdering: S4 kan lukkes. Næste fase ifølge planen er S5 Lab-API:
  `exportState()`/`importState()`, `runScenario()`, `setNoise()`, `setBG()` og
  `setPlasmaInsulinClamp()`. Anbefaling: start med et lille API-inventar og én
  read-only/export-funktion før muterende import/klamp.
- Ingen kodeændring i denne blok; sidste verificerede gates fra S4.1:
  golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S4.1: nightAwakenings tilbage til facaden

- S4-inventar: globale grafserier (`cgmDataPoints`, `trueBgPoints`,
  `physiologyDataPoints`) og øvrige graf-/UI-historikker (`graphMessages`,
  `floatingLabels`, `bgHistoryForStats`) ligger allerede uden for engine.
- `nightAwakenings` var eneste tydelige visuelle graf-historik, der stadig lå i
  `PhysiologyEngine` via proxy. Den bruges af UI til natlige vågen-striber og
  zzZzz-recovery, ikke som fysiologisk model-state.
- Flyttet `nightAwakenings` ud af `js/physiology-engine.js`, fjernet proxy-
  accessorer i `Simulator`, og initialiseret `this.nightAwakenings = []` direkte
  i Simulator sammen med `graphMessages`/`floatingLabels`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3 lukket: rest-side-effects er facade/gameplay

- Rest-inventar efter S3.22:
  - `logEvent`/`playSound` i `_handleEngineEvent()` og facade-helpers er
    bevidst facade-oversættelse fra engine-events.
  - `playSound('tick')`, score-zone-lyde (`bonus`, `hypoWarn`, `inRange`,
    `hyperWarn`) og points-badge DOM er score-/gameplay-feedback og bliver på
    facaden.
  - `loseLife('box')`, Box Challenge-log, `loseLife()` og `gameOver()` er
    spilmekanik/facade. De fysiologiske tærskler går nu via
    `game-over-condition`.
  - `document.getElementById(...)` findes kun i facade-helpers for
    kit-cooldown, vægtstatus og stats/debug-visning.
- Arbejdsvurdering: S3 kan lukkes. Næste fase bør være S4: gennemgå
  graf-historik/snapshot-grænsen (`cgmDataPoints`, `trueBgPoints`,
  `physiologyDataPoints`, `bgHistoryForStats`, visuelle historikker) og flyt kun
  hvis planen stadig kræver det efter nuværende S2/S3-arkitektur.
- Ingen kodeændring i denne blok; sidste verificerede gates fra S3.22:
  golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.22: stats/debug DOM via engine-event

- Flyttet direkte DOM-opdatering for stats-fragmentet (`statsTirValue`,
  `statsAvgBgValue`) og debug-GMI (`dbgEHbA1c`) ud af `updateStats()`.
- `updateStats()` beregner fortsat TIR, gennemsnitlig CGM, farver og GMI, og
  emitter derefter `stats-status` for 24h- og 7d-visningerne.
- Tilføjet `_applyStatsStatus(data)` som facade-DOM handler. Den håndterer
  capsule-barens 24h TIR/gennemsnit samt debug-panelets 7d GMI.
- Målrettet Node-tjek: fake DOM for `statsTirValue`, `statsAvgBgValue` og
  `dbgEHbA1c`; bekræftet tekst og farver med kontrollerede historikdata.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.21: steep-drop advarsel via engine-event

- Flyttet direkte DOM/lyd/timeout side-effects fra `showSteepDropWarning()` til
  ny facade-helper `_applySteepDropWarning()`.
- `showSteepDropWarning()` emitter nu `steep-drop-warning` og flusher straks.
  Det bevarer triggerens gamle placering i `update()`, men flytter overlay,
  `playSound('intervention', 'A5', '2n')` og timeout til event-handleren.
- Målrettet Node-tjek: fake `steepDropWarningDiv`, `playSound` og `setTimeout`;
  bekræftet lyd, overlay-visning, timeout-skjul og guard når overlay allerede er
  synligt.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.20: fysiologiske game-over-tærskler via engine-event

- Migreret direkte `this.gameOver(...)` / `this.loseLife(...)` fra
  `checkGameOverConditions()` for de fire fysiologiske tærskler: hypo
  (brainEnergyDeficit), vægt, DKA/acidosisLoad og kroniske komplikationer.
- `checkGameOverConditions()` emitter nu `game-over-condition` med rå data
  (`type`, BG, vægt, ketoner eller 7-dages gennemsnit) og flusher straks.
- Tilføjet `_handleGameOverCondition(data)` som facade-handler. Den afgør om
  eventet betyder `loseLife(type)` i Box Challenge eller `gameOver(...)` med
  samme i18n-tekst, detaljer og tips som før.
- `gameOver()` og `loseLife()` er bevidst ikke flyttet i denne slice; de er
  facade-/gameplay-funktioner og håndterer lyd, pause, popups og liv.
- Målrettet Node-tjek: testet hypo sandbox, hypo Box Challenge-livstab, vægt,
  DKA og komplikationer via `checkGameOverConditions()`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.19: vægt-status DOM via engine-event

- Flyttet direkte DOM-opdatering for vægtændring (`weightChangeValue`) og
  kcal-fragmentet (`statsWeightValue`) ud af `updateWeight()`.
- `updateWeight()` beregner fortsat `netKcal` og `weightChangeKg`, og emitter
  derefter `weight-status` med rå tal (`weightChangeKg`, `weightLimitKg`,
  `netKcal`).
- Tilføjet `_applyWeightStatus(data)` som facade-DOM handler. Den sætter
  vægttekst, kcal-tekst og farver med samme tærskler som før.
- Målrettet Node-tjek: fake DOM for `weightChangeValue` og `statsWeightValue`;
  bekræftet tekst og farve for vægt/kcal.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.18: kit-cooldown DOM-status via engine-event

- Flyttet direkte DOM-opdatering for kit-knappernes cooldown-visning ud af
  `updateFingerprickStatus()`, `updateKetoneTestStatus()` og
  `updateGlucagonStatus()`.
- De tre metoder beregner fortsat cooldown-state (`onCooldown`, procent og
  resterende tid) og opdaterer egne state-flag hvor de allerede fandtes
  (`fingerprickOnCooldown`, `ketoneTestOnCooldown`). Derefter emitter de et
  fælles `kit-cooldown-status` event.
- Tilføjet `_applyKitCooldownStatus(data)` som facade-DOM handler. Den håndterer
  `document.getElementById`, `on-cooldown` CSS-klassen, pointer-events,
  `--cooldown-pct` og label-tekst for knapperne.
- Målrettet Node-tjek: fake DOM-knapper for fingerprik, keton-test og glucagon;
  bekræftet cooldown/ready states, lagkageprocent og labeltekst.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.17: intervention-lyde via sound-only engine-events

- Flyttet fire direkte `playSound`-kald fra fysiologiske/interventions-metoder
  til sound-only engine-events håndteret i `_handleEngineEvent()`:
  `food-sound` → `eating`, `fast-insulin-sound` → `insulinPen`,
  `fingerprick-sound` → `intervention/B4`, `ketone-test-sound` →
  `intervention/B4`.
- Events emitteres præcis på de gamle lydplaceringer i `addFood()`,
  `addFastInsulin()`, `performFingerprick()` og `performKetoneTest()`. Det
  bevarer rækkefølgen omkring lokale state-opdateringer, activeIntake,
  insulin-depot, floating labels og cooldown-state.
- Bevidst IKKE brugt de eksisterende logevents til disse lyde, fordi flere af
  lydkaldende lå efter state-mutationer mens logevents lå tidligere i metoden.
  Direkte flytning til logevent-handleren ville derfor have ændret
  side-effect-rækkefølgen.
- Målrettet Node-tjek: kaldt de fire faktiske metoder med stubbet
  `logEvent`/`playSound` og bekræftet log → lyd i den forventede rækkefølge.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.16: sleepPop playSound via sound-only engine-event

- Tilføjet nyt engine-event `sleep-pop`, som håndteres i `_handleEngineEvent()`
  med `playSound('sleepPop')`.
- Call-site i natlig søvnforstyrrelse emitter og flusher nu `sleep-pop` præcis
  hvor `playSound('sleepPop')` stod før. Den eksisterende visuelle timing
  (`drawSymptomOverlay._popRealTime` og `window._nightPopActiveUntil`) kører
  stadig efter lyden, så gammel rækkefølge er bevaret.
- Bevidst IKKE flyttet i samme slice: selve nat-pop DOM/window-timingen. Den
  hører til den senere DOM-status/visuel side-effect delplan.
- Målrettet Node-tjek: stubbet `playSound`, `performance`, `window` og
  `drawSymptomOverlay`; bekræftet at `sleep-pop` spiller lyd før visuel timing.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.15: morningAlarm playSound via sound-only engine-event

- Tilføjet nyt engine-event `morning-alarm`, som håndteres i
  `_handleEngineEvent()` med `playSound('morningAlarm')`.
- Call-site i morgenblokken (`currentHour >= 7 && currentHour < 8`) emitter og
  flusher nu `morning-alarm` før den eksisterende søvnvurdering. Dermed bevares
  gammel rækkefølge: alarmlyd før `good-sleep`-log eller `applySleepDebt()` /
  `sleep-debt`-log.
- Bevidst IKKE flyttet i samme slice: `sleepPop`, da den er koblet til visuel
  nat-pop timing (`drawSymptomOverlay._popRealTime` og
  `window._nightPopActiveUntil`).
- Målrettet Node-tjek: stubbet `logEvent`/`playSound`; bekræftet at
  `morning-alarm` kun spiller alarmlyd, og at morgen-update med god søvn giver
  `morningAlarm` før `goodSleep`-loggen.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.14: sleep-started playSound via engine-event

- Flyttet `playSound('sleepStart')` fra søvn-start call-site i `update()` til
  den eksisterende `_handleEngineEvent()` case for `sleep-started`.
- Handleren spiller lyden før `logEvent(t('log.sleepStart'), 'event')`, så den
  gamle rækkefølge (lyd → log) er bevaret.
- Bevidst IKKE flyttet i samme slice: `morningAlarm` og `sleepPop`, fordi
  førstnævnte kræver egen lyd-event ved alarmtidspunktet, og sidstnævnte er
  koblet til visuel nat-pop timing via `window._nightPopActiveUntil`.
- Målrettet Node-tjek: stubbet `logEvent`/`playSound` og bekræftet lyd → log
  for `sleep-started`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Codex — S3.13: lavrisiko playSound via eksisterende engine-events

- Inventar over direkte `playSound` i `js/simulator.js` viste 18 kald. Første
  slice tog kun de tre lavrisiko-kald hvor eventet allerede fandtes, og hvor
  der ikke lå anden kode mellem `_flushEngineEvents()` og lydkaldet:
  `stomach-full` → `invalid`, `basal-insulin-added` → `insulinPen`,
  `activity-started` → `intervention/F4`.
- Flyttet lydafspilningen ind i `_handleEngineEvent()` for de tre cases, så
  fysiologikoden ikke længere kalder `playSound` direkte for disse events.
  Rækkefølgen er bevaret som log → lyd, ligesom før.
- Bevidst IKKE flyttet endnu: `food-added`, `fast-insulin-added`,
  fingerprik/keton-test, søvnlyde, scoring/CGM/UI-lyde og `gameOver`. Flere af
  dem ligger efter state-mutationer, floating labels eller DOM/gameplay-kode og
  kræver enten separat sound-event eller egen lille rækkefølge-slice.
- Målrettet Node-tjek: stubbet `logEvent`/`playSound` og bekræftet log → lyd
  for `stomach-full`, `basal-insulin-added` og `activity-started`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.

### 2026-06-15 — Claude — S3.12: activity-logevents via engine-event (logevents FÆRDIG)

- Migreret `activityStart`/`activityEnd` (multi-linje, byggede flere i18n-strenge).
  Call-site sender nu RÅ data i eventet (`type`, `intensity`, `duration`, `kcal`,
  `icon`); handleren bygger `activity.name.*`, `activity.intensity.*`,
  `log.activity.duration.*`, `log.activity.kcal` og `log.activityStart/End`.
- Events: `'activity-started'` (kat `motion`), `'activity-ended'` (kat `motion-end`).
  Metadata-objektet (type/intensity/duration/kcalBurned/icon) genskabes identisk
  i handleren.
- Lokale i18n-konstanter (actName/actIntensity/durationStr/kcalStr/endActName/
  endActIntensity) fjernet fra call-sites (verificeret kun brugt i logEvent-kaldet).
- Verificeret BIT-IDENTISK: golden-master 7/7, suite 155/155. Målrettet tjek:
  begge events → korrekt nøgle, kategori og fuld metadata.
- MILEPÆL: ALLE direkte fysiologi-logevents er nu migreret til engine-events.
  Tilbage i S3: de tungere side-effects — `playSound`, DOM-status og `gameOver`
  ud af fysiologikoden. Anbefaling: lav en lille S3-delplan for hver (de er
  ikke ren tekst og kræver omtanke om rækkefølge/spil-grænse). Box Challenge-log
  bliver bevidst på facaden.

### 2026-06-15 — Claude — S3.11: simple motion-logevents via engine-event

- Migreret `exerciseMaxDuration` → `'exercise-max-duration'` (kat `motion-end`)
  og `exerciseCooldown` → `'exercise-cooldown'` `{ min }` (kat `warning`).
  Nye cases i `_handleEngineEvent`; cooldown sender rå `min`.
- Bevidst IKKE flyttet: `return false` (cooldown-blokering) og motion-state.
- Verificeret BIT-IDENTISK: golden-master 7/7, suite 155/155. Målrettet tjek:
  begge events → korrekt nøgle og kategori.
- Tilbage i S3-logevents: KUN `activityStart`/`activityEnd` (multi-linje, bygger
  flere i18n-strenge: navn/intensitet/varighed/kcal). Næste bid: send rå data
  (type, intensitet, varighed, kcal) i event og byg `activity.name.*`,
  `activity.intensity.*`, `log.activity.duration.*`, `log.activity.kcal` +
  `log.activityStart/End` i handleren. Derefter: tunge side-effects (lyd/DOM/
  gameOver) med egen delplan.

### 2026-06-15 — Claude — S3.10: mave-logevent (stomachFull) via engine-event

- Migreret `stomachFull`-logeventen: `logEvent(t('log.stomachFull'), 'info')` →
  `this.engine.emitEvent('stomach-full')` + `_flushEngineEvents()`, ny case i
  `_handleEngineEvent`. Bevidst IKKE flyttet: `this.stomachFull = true`,
  `playSound('invalid')` og `return false` — bliver på facaden/fysiologi.
- Verificeret BIT-IDENTISK: golden-master 7/7, suite 155/155. Målrettet tjek:
  event → log `log.stomachFull`, kategori `info`.
- Tilbage i S3-logevents: kun motion-gruppen (`activityStart`/`End`,
  `exerciseMaxDuration`, `exerciseCooldown`). `activityStart`/`End` bygger flere
  i18n-strenge — send rå data (type, intensitet, varighed, kcal) og byg teksten
  i handleren. Box Challenge-log bliver på facaden.

### 2026-06-15 — Claude — S3.9: søvn-logevents via engine-event og facade-handler

- Migreret fire søvn-logevents fra direkte `logEvent` til engine-events +
  facade-handler (samme mønster som S3.7/S3.8):
  - `sleepStart` → `'sleep-started'`
  - `goodSleep` → `'good-sleep'`
  - `sleepDisruption` → `'sleep-disruption'` `{ hours }`
  - `sleepDebt` → `'sleep-debt'` `{ hours }`
- Nye cases i `_handleEngineEvent` bygger samme i18n-tekst (kategori `event`).
  De to hours-events sender rå tal; `.toFixed(1)` sker i handleren.
- Bevidst IKKE flyttet: `playSound('sleepStart'/'morningAlarm')`, `graphMessages`,
  søvntab-/stress-state, pending chronic stress — bliver på facaden/fysiologi.
- Verificeret BIT-IDENTISK: golden-master 7/7, suite 155/155. Målrettet tjek:
  alle fire events rammer handleren med korrekt nøgle og kategori `event`.
- Tilbage i S3-logevents: mave (`stomachFull`) + motion (`activityStart`/`End`,
  `exerciseMaxDuration`, `exerciseCooldown`). Box Challenge-log bliver på facaden.

### 2026-06-15 — Claude — S3.8: keton-test-logevent via engine-event og facade-handler

- Migreret `performKetoneTest()` fra direkte `logEvent(t('log.ketoneTest', ...))`
  til `this.engine.emitEvent('ketone-test-measured', {value, status})` efterfulgt
  af `_flushEngineEvents()`. Samme mønster som S3.7 (fingerprik).
- Tilføjet `case 'ketone-test-measured'` i `_handleEngineEvent()`, der bygger den
  samme i18n/log-tekst, kategori (`ketone-test`) og metadata (`{value}`) som før.
- `statusShort` (keton-niveau-tekst) beregnes stadig i `performKetoneTest()`, da
  den også bruges af floating-label'en; den sendes med i event-data. Fremtidig
  oprydning: når floating-label flyttes, kan tærskel→status gøres til et råt
  token i engine og i18n-resolves i handleren.
- Bevidst IKKE flyttet: floating label, keton-cooldown-state, campaign-action,
  lyd og DOM-status — bliver på facaden (samme afgrænsning som fingerprik).
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7, fuld suite 155/155.
  Målrettet tjek: logkald = nøgle `log.ketoneTest`, kat `ketone-test`, meta
  `{value}` (uændret signatur).

### 2026-06-15 — Codex — S3.7: fingerprik-logevent via engine-event og facade-handler

- Migreret `performFingerprick()` fra direkte `logEvent(t('log.fingerprick', ...))`
  til `this.engine.emitEvent('fingerprick-measured', ...)` efterfulgt af
  `_flushEngineEvents()`.
- Udvidet `_handleEngineEvent(event)` på `Simulator`, så facaden oversætter
  `fingerprick-measured` tilbage til samme i18n/log-kald og metadata som før.
- Bevidst IKKE flyttet CGM-punktet, floating label, fingerprik-cooldown,
  lyd eller DOM-knapstatus i denne slice.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: keton-test-logevent kan migreres på samme måde, men behold
  floating label, campaign-action, cooldown og DOM-status i facaden.

### 2026-06-15 — Codex — S3.6: glucagon-logevents via engine-event og facade-handler

- Migreret `useGlucagon()` fra direkte `logEvent(t('log.glucagon'), ...)` til
  `this.engine.emitEvent('glucagon-used', ...)` efterfulgt af
  `_flushEngineEvents()`.
- Migreret den reducerede-effekt-advarsel ved lav leverglykogen til
  `glucagon-reduced-effect`, som facaden oversætter tilbage til samme logtekst
  som før.
- Udvidet `_handleEngineEvent(event)` på `Simulator`, så facaden oversætter
  `glucagon-used` og `glucagon-reduced-effect` tilbage til samme logkategori
  og tekst som før.
- Bevidst IKKE flyttet cooldown, `activeGlucagon`, leverglykogen-drain,
  `updateGlucagonStatus()` eller glucagon-matematik i denne slice.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: migrér fingerprik/keton-test-logevents eller bevægelses-logevents,
  men hold visuelle labels, lyd og cooldown-DOM i facaden indtil videre.

### 2026-06-15 — Codex — S3.5: insulin-logevents via engine-event og facade-handler

- Migreret `addFastInsulin()` fra direkte `logEvent(t('log.fastInsulin', ...))`
  til `this.engine.emitEvent('fast-insulin-added', ...)` efterfulgt af
  `_flushEngineEvents()`.
- Migreret ikke-silent `addLongInsulin()` fra direkte
  `logEvent(t('log.basalInsulin', ...))` til
  `this.engine.emitEvent('basal-insulin-added', ...)` efterfulgt af
  `_flushEngineEvents()`.
- Udvidet `_handleEngineEvent(event)` på `Simulator`, så facaden oversætter
  `fast-insulin-added` og `basal-insulin-added` tilbage til samme i18n/log-
  kald og metadata som før.
- Silent basal-injektioner (`isSilent=true`) emitter fortsat ingen logevent.
- Bevidst IKKE flyttet insulinpen-lyd, DKA-reset, campaign-action, natintervention
  eller RNG for absorptionsvariabilitet i denne slice.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: migrér en mindre resterende ren logevent, fx glucagon-loggen eller
  fingerprik/keton-test-loggen, men hold visuelle labels, lyd og cooldown-DOM i
  facaden indtil videre.

### 2026-06-15 — Codex — S3.4: mad-logevent via engine-event og facade-handler

- Migreret `addFood()` fra direkte `logEvent(t('log.food', ...))` til
  `this.engine.emitEvent('food-added', ...)` efterfulgt af `_flushEngineEvents()`.
- Udvidet `_handleEngineEvent(event)` på `Simulator`, så facaden oversætter
  `food-added` tilbage til samme i18n/log-kald og metadata som før:
  kcal, kulhydrat, protein og ikon.
- Rækkefølgen er bevaret: campaign-action og natintervention håndteres først,
  kalorier lægges til, logevent skrives, derefter opdateres mad-/mave-køer, og
  spiselyden afspilles til sidst.
- Bevidst IKKE flyttet `playSound('eating')`, stomach-full-logikken eller
  activeFood/activeIntake-mutationer i denne slice.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: migrér hurtig- eller basalinsulin-logevents på samme måde, men
  bevar DKA-reset, RNG for absorption og insulinpen-lyd i facaden indtil videre.

### 2026-06-15 — Codex — S3.3: CGM-logevents via engine-event og facade-handler

- Migreret CGM-logevents fra direkte `logEvent(...)` til engine-event →
  facade-handler for:
  `cgm-compression-started`, `cgm-sensor-lost` og `cgm-self-test-started`.
- Udvidet `_handleEngineEvent(event)` på `Simulator`, så facaden oversætter
  eventene tilbage til de samme `log.cgmCompression`, `log.cgmSensorLost` og
  `log.cgmSelfTest`-kald som før.
- Bevidst IKKE flyttet `addFloatingLabel(...)` i denne slice. Visuelle labels
  bliver i facaden, mens kun den rene log-side-effect migreres.
- CGM-state, sensor-timing, self-test cooldown og floating-label timing er
  uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: vælg endnu en lille ren logevent eller begynd at gruppere
  intervention-logevents, men flyt ikke game-over, lyd eller DOM før der er en
  tilsvarende facade-handler med test.

### 2026-06-15 — Codex — S3.2: stress-logevents via engine-event og facade-handler

- Tilføjet `_handleEngineEvent(event)` og `_flushEngineEvents()` på
  `Simulator` som første facade-oversætter fra engine-events til side-effects.
- Migreret `addAcuteStress()` og `addChronicStress()` fra direkte `logEvent(...)`
  til `this.engine.emitEvent(...)` efterfulgt af `_flushEngineEvents()`.
- Facaden oversætter foreløbig kun `acute-stress-added` og
  `chronic-stress-added` tilbage til de samme i18n/log-kald som før.
- Fysiologi-state og timing er uændret: stressniveau/pending-pool opdateres før
  eventet, og loggen skrives stadig synkront i samme metodekald.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: migrér endnu én lavrisiko side-effect, fx CGM-kompression/
  sensorstatus-logevents eller en anden ren logevent, og hold hvert eventtype-
  mapping lille og testet.

### 2026-06-15 — Codex — S3.1: event-buffer/API-skelet

- Tilføjet event-buffer i `PhysiologyEngine`: `this.events`.
- Tilføjet tre små API-metoder:
  `emitEvent(type, data, severity)`, `consumeEvents()` og `peekEvents()`.
- Ingen eksisterende `logEvent`, `playSound`, `gameOver`, popup- eller DOM-kald
  er flyttet endnu. Denne slice er kun fundamentet for S3.
- Event-formatet er foreløbigt `{ type, severity, data }`, så facaden senere kan
  oversætte fysiologi-events til i18n-tekst, lyd, popup og game-mekanik.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE S3: vælg én konkret side-effect med lav risiko, fx en advarsels- eller
  info-event, og lad `Simulator` oversætte den tilbage til samme log/lyd som før.

### 2026-06-15 — Codex — S2 rest-inventar og lukningsvurdering

- Gennemgået resterende `this.*`-initialiseringer i `Simulator` efter S2.18.
- Arbejdsvurdering: S2's mål om at flytte model-state ind i engine er nået for
  de kendte fysiologiske state-grupper. Der er ikke fundet en oplagt ekstra
  lille fysiologisk state-gruppe, som bør flyttes før S3.
- Tilbageværende constructor-felter falder primært i disse grupper:
  konstanter/kalibreringsparametre, Hovorka-modelobjektet, graf-/stats-historik,
  spiller-test-cooldowns, score/game-state, campaign/Box Challenge-state,
  side-effect guards for lyd/log/advarsler og UI/visuel state.
- Følgende bør blive i facaden indtil S3/S4:
  `brainDeficitWarningGiven`, `acidosisWarningGiven`, fingerprik-/keton-test-
  cooldowns, `glucagonUsedTime`, søvn-lydguards, `bgHistoryForStats`,
  `logHistory`, `graphMessages`, `floatingLabels`, points/lives/boxes og
  `_lastPhysioRecordTime`.
- Fysiologi-konstanter (`TAU_*`, `BHB_*`, `LIPOLYSIS_*`, `GLUCOTOX_*`,
  `HAAF_*`, glykogen-/mave-konstanter osv.) er ikke state. De bør flyttes
  samlet senere som config/konstant-slice, ikke drypvis i S2.
- NÆSTE: start S3 side-effects → events. Første sikre S3-del bør være et lille
  event-buffer/API-skelet i engine/facade uden at ændre fysiologi-output.
- Ingen kode ændret i denne blok. Regressioner blev derfor ikke kørt igen;
  seneste kode-slice S2.18 var verificeret med golden-master 7/7 og
  `simulation.test.js` 155/155.

### 2026-06-15 — Codex — S2.18: afledte fysiologi-/debugværdier til engine (proxy-mønster)

- Flyttet ejerskab af afledte fysiologi-/debugværdier til `PhysiologyEngine`:
  `hovorkaSteadyStateBasalRate`, `_lastPeisFactor`, `_lastHyperMod`,
  `_lastExerciseGEMod`, `_lastSplanchnicAbsorbMod`, `_lastLipolyseRate` og
  `_lastCpt1Activity`.
- Tilføjet get/set-proxyer på `Simulator`, så steady-state-basal, PEIS-kobling,
  mave-/absorptionsmodifikatorer, keton-debug og physiology-dashboard fortsat
  bruger samme `this.X`-navne.
- Engine initialiserer felterne som `undefined`, så eksisterende fallback-
  adfærd (`|| 1` / `|| 0`) før første beregning er bevaret.
- Kun state-ejerskab er flyttet. Beregninger, snapshots, dashboard-shape og
  Hovorka-matematik er uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: lav en endelig rest-inventarliste. Tilbageværende constructor-felter
  er primært konstanter, graf-/stats-historik, test/cooldown-state,
  score/game-state, side-effect guards og UI/Box Challenge-state.

### 2026-06-15 — Codex — S2.17: dawn-state til engine (RNG-bevarende proxy-mønster)

- Flyttet dawn-state-ejerskab til `PhysiologyEngine`: `_dawnAmplitude`,
  `_dawnPeakMinutes` og `_dawnDay`.
- Tilføjet get/set-proxyer på `Simulator`, så `regenerateDawn()`,
  `circadianKortisolNiveau` og øvrig eksisterende dawn-kode fortsat bruger
  samme `this.X`-navne.
- Engine-konstruktøren initialiserer kun placeholders for `_dawnAmplitude` og
  `_dawnPeakMinutes`. De konkrete `gaussRand()`-træk bliver bevidst liggende på
  samme sted i `Simulator`-konstruktøren som før og skriver gennem proxyerne.
  Det bevarer RNG-rækkefølgen: CGM-træk → `_boxSeed` → dawn-træk.
- Kun state-ejerskab er flyttet. Dawn-matematik, campaign-disable, søvngælds-
  forstærkning og RNG-draw timing er uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: lav en endelig rest-inventarliste for S2. Det meste tilbageværende
  constructor-state ser ud til at være konstanter, facade-/grafstate,
  cooldowns, score/game-state og side-effect guards.

### 2026-06-15 — Codex — S2.16: søvnunderskuds-state til engine (proxy-mønster)

- Flyttet søvnunderskuds-state til `PhysiologyEngine`: `lostSleepHoursTonight`,
  `lastNightAwakeningTime`, `sleepDebtAppliedForDay` og `nightAwakenings`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende søvninterventioner,
  `applySleepDebt()`, dawn-forstærkning og grafens natlige vågen-historik
  fortsat bruger samme `this.X`-navne.
- Bevidst IKKE flyttet `_sleepStartPlayedForDay` eller
  `_morningAlarmPlayedForDay`, fordi de er side-effect guards for lyd/log.
- Bevidst IKKE flyttet illness symptom timers, fordi de i dag primært driver
  lyd/visuelle symptomer; den fysiologiske stress ligger allerede i
  `chronicStressLevel`/`_pendingChronicStress`.
- Kun state-ejerskab er flyttet. Søvn-RNG, logEvent/playSound,
  graphMessages/floating visuals og stressmatematik er uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: rest-inventar peger især på dawn-state (`_dawnAmplitude`,
  `_dawnPeakMinutes`, `_dawnDay`) som fysiologisk, men den kræver en
  RNG-bevarende flyttestrategi.

### 2026-06-15 — Codex — S2.15: afledte profil- og basalparametre til engine (proxy-mønster)

- Flyttet `restingKcalPerDay`, `restingKcalPerMinute`, `estimatedTDD` og
  `basalDose` til `PhysiologyEngine`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende steady-state,
  basalinsulin-, vægt- og testkode fortsat bruger samme `this.X`-navne.
- Beregningsformlerne er uændrede: resting kcal skalerer lineært med vægt,
  `estimatedTDD` er laveste af 100-reglen og vægt-reglen, og `basalDose` er
  afrundet 45% af `estimatedTDD`.
- Kun state-/parameter-ejerskab er flyttet. Hovorka-init, basalhistorik,
  doseringsflow og vægtmatematik er uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: lav rest-inventar. Oplagte ikke-flyttede grupper er fortsat dawn-state
  (kræver RNG-bevarende strategi), graf-/advarsels-state og game/UI-state.

### 2026-06-15 — Codex — S2.14: trueBG til engine (proxy-mønster)

- Flyttet `trueBG` til `PhysiologyEngine`.
- Tilføjet get/set-proxy på `Simulator`, så Hovorka-flow, campaign-startBG,
  respawn, CGM-beregning og øvrige eksisterende kald fortsat bruger
  `this.trueBG`.
- Bevidst IKKE flyttet `_lastPhysioRecordTime`, `lastTrueBGForDropCheck` eller
  `timeOfLastBGDropCheck`. De hører til graf-sampling og advarsels-/facade-logik
  og bør vurderes sammen med S3/S4.
- Bevidst IKKE flyttet dawn-state i denne slice, fordi dawn-initialisering bruger
  `gaussRand()` efter `_boxSeed` i konstruktøren. Flytning til engine-konstruktør
  uden særskilt plan ville ændre RNG-rækkefølgen.
- Kun state-ejerskab er flyttet. Hovorka-matematik, substep-rækkefølge,
  CGM-delay/støj og graf-sampling er uændret.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: lav en kort rest-inventarliste og beslut om S2 kan lukkes, eller om
  dawn-state kræver en særskilt RNG-bevarende strategi før S3.

### 2026-06-14 — Codex — S2.13: aktiv glucagon-state til engine (proxy-mønster)

- Flyttet `activeGlucagon` til `PhysiologyEngine`.
- Tilføjet get/set-proxy på `Simulator`, så eksisterende `useGlucagon()` og
  `_substepGlucagon()` fortsat bruger `this.activeGlucagon`.
- Bevidst IKKE flyttet `glucagonUsedTime`, fordi 24t-cooldownen er
  game-mekanik/facade-state.
- Kun state-ejerskab er flyttet. Glucagon-matematik, knapstatus, cooldown,
  log og lyd bliver i `Simulator`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: stop her og lav ved næste session en kort inventargennemgang af
  resterende state før flere S2-slices eller S3.

### 2026-06-14 — Codex — S2.12: hjerneenergi-deficit-state til engine (proxy-mønster)

- Flyttet hjerneenergi-deficit-state til `PhysiologyEngine`:
  `brainEnergyDeficit` og `_lowestBGDuringDeficit`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende hypo-, respawn-,
  brain-deficit- og game-over-kode fortsat bruger samme `this.X`-navne.
- Bevidst IKKE flyttet `brainDeficitWarningGiven`, da det er advarsels-/
  side-effect-state og bør vurderes sammen med S3 events.
- Kun state-ejerskab er flyttet. Brain-deficit-matematik og game-over-
  beslutninger bliver i `Simulator`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: lav en kort inventargennemgang af resterende fysiologisk state i
  `Simulator` (fx dawn-RNG-state, glucagon-state, fingerprik/keton-test-state,
  søvn/illness/game/UI-state) og beslut om S2 skal lukkes eller fortsætte med
  flere små proxy-slices før S3.

### 2026-06-14 — Codex — S2.11: stress/resistens/HAAF-state til engine (proxy-mønster)

- Flyttet stress-, resistens-, glukotoksicitet- og HAAF-state til
  `PhysiologyEngine`: `glucotoxicLoad`, `glucotoxicResistanceFactor`,
  `insulinResistanceFactor`, `acuteStressLevel`, `chronicStressLevel`,
  `_pendingChronicStress`, `hypoArea` og `counterRegFactor`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende stresshormon-,
  søvngæld-, HAAF-, currentISF-, glukotoksicitet- og snapshot-kode fortsat
  bruger samme `this.X`-navne.
- Bevidst IKKE flyttet dawn-state (`_dawnAmplitude`, `_dawnPeakMinutes`,
  `_dawnDay`), fordi initialiseringen bruger `gaussRand()` i konstruktøren.
  Flytning nu ville ændre RNG-rækkefølgen og bryde bit-identisk-reglen.
- Kun state-ejerskab er flyttet. Stress-, HAAF- og glukotoksicitetsmatematik
  samt konstanter bliver i `Simulator` indtil senere slices.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt hjerneenergi-deficit-state (`brainEnergyDeficit`,
  `_lowestBGDuringDeficit`) som lille proxy-slice. `brainDeficitWarningGiven`
  bør vurderes særskilt, da det er advarsels-/side-effect-state.

### 2026-06-14 — Codex — S2.10: leverglykogen-state til engine (proxy-mønster)

- Flyttet leverglykogen-state til `PhysiologyEngine`: `liverGlycogenGrams` og
  `glycogenReserve`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende EGP-, stress-,
  glucagon-, glycogen-recovery- og snapshot-kode fortsat bruger samme
  `this.X`-navne.
- Kun state-ejerskab er flyttet. Konstanter (`LIVER_GLYCOGEN_MAX`,
  `GLYCOGEN_STRESS_THRESHOLD`) og leverglykogen-matematik bliver i `Simulator`
  indtil senere slices.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt stress/hjerne/glukotoksicitet-state i små grupper.
  Advarselsflag og game-over-side-effects bør vurderes særskilt ift. S3.

### 2026-06-14 — Codex — S2.9: muskelglykogen-state til engine (proxy-mønster)

- Flyttet muskelglykogen-state til `PhysiologyEngine`:
  `muscleGlycogenCapacity`, `muscleGlycogenGrams`,
  `muscleGlycogenReserve`, `lastMuscleContractionEndTime`,
  `_muscleGlycogenResynthRate` og `_muscleGlycogenConsumptionRate`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende PEIS-, CHO-
  resynthesis-, campaign-startoverride- og snapshot-kode fortsat bruger samme
  `this.X`-navne.
- Midlertidigt tilføjet `ENGINE_MUSCLE_GLYCOGEN_G_PER_KG = 5.5` i
  `js/physiology-engine.js`, fordi `MUSCLE_GLYCOGEN_G_PER_KG` stadig defineres
  i `simulator.js`, som loades efter engine-filen. Når fysiologi-konstanter
  flyttes samlet, bør disse samles til én kilde.
- Kun state-ejerskab er flyttet. Muskelglykogen-matematikken og de øvrige
  `MUSCLE_GLYCOGEN_*` konstanter bliver i `Simulator`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt leverglykogen-state (`liverGlycogenGrams`,
  `glycogenReserve`) som lille proxy-slice. Behold konstanter og EGP-matematik
  i `Simulator` indtil senere slices.

### 2026-06-14 — Codex — S2.8: motion-state til engine (proxy-mønster)

- Flyttet motion-state til `PhysiologyEngine`: `activeMotion`,
  `activeAktivitet`, `exerciseCooldownUntil` og `smoothHeartRate`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende aktivitet,
  post-exercise ISF, puls, cooldown og auto-stop kode fortsat bruger samme
  `this.X`-navne.
- Bevidst IKKE flyttet `totalExerciseMinutes`, da den bruges til campaign-mål
  og ikke kun fysiologisk state. Muskelglykogen-state blev også holdt ude og
  bør flyttes i en separat slice.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt muskelglykogen-state (`muscleGlycogenCapacity`,
  `muscleGlycogenGrams`, `muscleGlycogenReserve`,
  `lastMuscleContractionEndTime`, `_muscleGlycogenResynthRate`,
  `_muscleGlycogenConsumptionRate`) som separat proxy-slice.

### 2026-06-14 — Codex — S2.7: fedt/protein/FFA-state til engine (proxy-mønster)

- Flyttet fedt/protein/FFA-state til `PhysiologyEngine`: `fatStomach`,
  `fatIntestine`, `ffaBlood`, `ffaResistanceFactor`, `proteinStomach`,
  `proteinGut`, `aminoAcidsBlood` og `proteinGlucagonLevel`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende pizza-effekt,
  FFA-resistens, protein-glukagon og ketogenese-kode fortsat bruger samme
  `this.X`-navne.
- Kun state-ejerskab er flyttet. Konstanter (`TAU_FAT_ABS`,
  `FFA_CLEARANCE_HALF`, `TAU_PROT_ABS` osv.) og absorptionsmatematik bliver
  i `Simulator` indtil senere slices.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt motion-state som lille proxy-slice, fx `activeMotion`,
  `activeAktivitet`, `exerciseCooldownUntil`, `smoothHeartRate` og evt.
  muskelglykogen-state efter separat vurdering.

### 2026-06-14 — Codex — S2.6: mad-/mave-/kulhydrat-state til engine (proxy-mønster)

- Flyttet mad-/mave-/kulhydrat-state til `PhysiologyEngine`: `activeFood`,
  `activeIntake`, `stomachContentGrams`, `stomachFull`,
  `stomachCarbsTotal`, `stomachCarbsSimple`, `stomachFiber`,
  `stomachRetentionWeight` og `cob`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende addFood-, drip-,
  mavekapacitets-, kulhydratabsorptions- og COB-kode fortsat bruger samme
  `this.X`-navne.
- Bevidst IKKE flyttet mavekonstanter (`STOMACH_CAPACITY_PER_KG`,
  `STOMACH_HYSTERESIS`) eller absorptionsmatematik. Denne slice flytter kun
  state-ejerskab.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt fedt/protein/FFA-kompartmenter som lille proxy-slice:
  `fatStomach`, `fatIntestine`, `ffaBlood`, `ffaResistanceFactor`,
  `proteinStomach`, `proteinGut`, `aminoAcidsBlood`, `proteinGlucagonLevel`.
  Konstanter og matematik kan blive i `Simulator` indtil senere slices.

### 2026-06-14 — Codex — S2.5: vægt/kalorie-state til engine (proxy-mønster)

- Flyttet vægt/kalorie-state til `PhysiologyEngine`: `totalKcalConsumed`,
  `totalKcalBurnedBase`, `totalKcalBurnedMotion` og `weightChangeKg`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende mad-, motion-,
  vægtberegnings-, respawn- og game-over-kode fortsat læser/skriver samme
  `this.X`-navne.
- Bevidst IKKE flyttet `totalExerciseMinutes`. Den bruges til campaign-mål og
  er derfor ikke kun vægtfysiologi; den bør vurderes sammen med campaign/facade-
  snittet senere.
- Kun state-ejerskab er flyttet. `updateWeight()`, DOM-opdatering,
  `weightLimitKg` og game-over-beslutninger bliver i `Simulator`.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE: S2 har nu flyttet de grupper brugeren bad om i denne runde
  (CGM-state, insulin/IOB-state, ketoner, vægt/kalorie). Før S3 bør næste agent
  lave en kort inventargennemgang af resterende fysiologisk state i
  `Simulator` og enten tage flere små S2-slices eller bede brugeren om go til
  S3 side-effects → events.

### 2026-06-14 — Codex — S2.4: keton-/acidose-state til engine (proxy-mønster)

- Flyttet rene fysiologiske keton-/acidose-akkumulatorer til
  `PhysiologyEngine`: `ketoneLevel`, `ffaLipolysis` og `acidosisLoad`.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende keton-, DKA- og
  snapshot-kode fortsat læser/skriver `this.ketoneLevel`, `this.ffaLipolysis`
  og `this.acidosisLoad`.
- Bevidst IKKE flyttet `ketoneTestUsedTime`, `ketoneTestOnCooldown`,
  `ketoneTestLastValue` eller `acidosisWarningGiven`. De styrer spillerhandling,
  cooldown, campaign-tip og advarsels-side-effects, og bør blive i facaden indtil
  S3/event-snittet er defineret.
- Keton- og acidose-konstanter bliver også i `Simulator` i denne slice. Kun
  state-ejerskab er flyttet; matematik og side-effects er uændrede.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt vægt/kalorie-state (`totalKcalConsumed`,
  `totalKcalBurnedBase`, `totalKcalBurnedMotion`, `weightChangeKg`) som lille
  proxy-slice. Vurder `totalExerciseMinutes` særskilt, da den bruges til
  campaign-mål og ikke kun vægtfysiologi.

### 2026-06-14 — Codex — S2.3: insulin/IOB-state til engine (proxy-mønster)

- Flyttet insulin/IOB-state til `PhysiologyEngine`: `activeFastInsulin`,
  `activeLongInsulin`, `iob`, `displayIOB`, `lastInsulinTime`,
  `basalIOBbaseline`, `basalInsulinRate`, `bioavScale`,
  `sessionBioavFast` og `sessionBioavBasal`.
- `Simulator` eksponerer alle felter via get/set-proxyer, så eksisterende
  insulin-flow i `simulator.js` er uændret: bolus-deponering, basalhistorik,
  displayIOB-skalering og respawn-logik skriver/læser samme `this.X`-navne.
- Kun state-ejerskab er flyttet. Selve insulinberegningerne, Hovorka-kald,
  basal-dose-logik og UI/spil-side-effects bliver i `Simulator` i denne slice.
- `basalIOBbaseline`, `basalInsulinRate` og `bioavScale` initialiseres som
  `undefined` i engine, fordi de tidligere først blev sat senere i konstruktør
  eller update-flow. Det bevarer facade-observerbar adfærd før første assignment.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt keton-state som lille proxy-slice. Start med rene statefelter
  (`ketoneLevel`, `ffaLipolysis`, keton-test-state og eventuelt acidose-state)
  men vurder grænsen mod game-over/advarselsflag før flytning.

### 2026-06-14 — Codex — S2.2: CGM-state til engine (proxy-mønster)

- Flyttet CGM-state og sensor-karakteristika til `PhysiologyEngine`:
  `cgmBG`, `lastCgmCalculationTime`, `cgmSystemicPeriod`,
  `cgmSystemicAmplitude`, `cgmNoiseScale`, `cgmDiscontinuityChance`,
  CGM-kompression (`cgmCompression*`) og sensorstatus/tidsvinduer
  (`cgmSensorOffline*`, `cgmSensorWarmup*`, `cgmSelfTest*`,
  `cgmAutoSelfTestCooldownUntil`, `cgmSensorStatus`).
- `trueBG` og `_lastPhysioRecordTime` bliver foreløbig i `Simulator`-facaden.
  `trueBG` opdateres stadig direkte gennem Hovorka-flowet i `simulator.js`, og
  `_lastPhysioRecordTime` hører til facade/graf-sampling frem til S4.
- Tilføjet get/set-proxyer på `Simulator`, så eksisterende `this.cgm...`-
  referencer er uændrede. Ingen kald-steder er omskrevet.
- RNG-rækkefølgen er bevaret: de tre CGM-init-træk flyttes tidligere ind i
  engine-konstruktøren, men der ligger ingen andre fysiologiske rng-træk imellem
  engine-oprettelsen og det tidligere init-sted. Golden-master bekræfter
  bit-identisk output.
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7. Fuld Node-suite:
  `simulation.test.js` = 155/155.
- NÆSTE (S2): flyt insulin/IOB-state som lille proxy-slice. Foreslået første
  gruppe: `iob`, `displayIOB`, `lastInsulinTime`, `activeFastInsulin`,
  `fastInsulinBioavailability`, `basalIOBbaseline` og tilknyttede rene
  insulin-statefelter. Vær opmærksom på hvilke basal-/dose-felter der er
  patientafledte eller spil/UI-facade før de flyttes.

### 2026-06-14 — Claude — S2.1: patientparametre til engine (proxy-mønster)

- Etablerer PROXY-MØNSTRET som resten af S2 genbruger: state ejes af engine,
  Simulator eksponerer det via `get/set`-accessorer, så de mange `this.X`-
  referencer i simulator.js er uændrede og bit-identiske.
- Flyttet til engine-konstruktøren: `weight`, `ISF`, `ICR`, `gramsPerMmolRise`
  (sat fra profile med samme defaults). Fjernet de tilsvarende assignments i
  Simulator-konstruktøren.
- Tilføjet proxy-gettere/settere på Simulator (lige før `get currentCarbEffect`).
- `weightLimitKg` BLIVER på facaden (spil-grænse, ikke fysiologi) — den læser
  `this.weight` via proxy.
- Verificeret BIT-IDENTISK: golden-master 7/7, suite 155/155. Browser (reload):
  `sim.weight/ISF/ICR/gramsPerMmolRise` læser fra engine, setter skriver til
  engine, gramsPerMmolRise=ICR/ISF korrekt, weightLimitKg=7% af vægt.
- NÆSTE (S2): vælg næste state-gruppe (foreslået rækkefølge: CGM-state →
  insulin/IOB → ketoner → vægt/kalorie). Samme opskrift: flyt init til engine,
  tilføj proxy-accessorer på Simulator, kør `golden-master check` (skal være
  bit-identisk), commit. Pas på rng-draw-rækkefølgen ved CGM-state (init bruger
  this.rng ved linjerne ~398-400; flyt den så ingen andre draws kommer imellem).

### 2026-06-14 — Claude — S1: engine-skelet + RNG-ejerskab

- Ny `js/physiology-engine.js`: `PhysiologyEngine`-klasse + `createEngine`-fabrik
  + `makeRng`. Browser-global eksport (`window.T1DPhysiologyEngine`); Node loades
  via eval i harness/test (module.exports udskydes til S6).
- Engine ejer indtil videre KUN den seedede RNG (`this.rng`, seed-logik) og
  `gaussRand` (Box-Muller). `makeRng` + seed-blokken fjernet fra `simulator.js`.
- `Simulator`-konstruktøren opretter `this.engine = createEngine(profile, {seed})`
  og låner rng'en: `this.rng = this.engine.rng`. De 12 rng-kald-steder er uændrede.
  `Simulator.gaussRand()` delegerer nu til `this.engine.gaussRand()`.
- Load-rækkefølge opdateret 3 steder: `index.html`, `tests/harness.js`,
  `tests/simulation.test.js` (engine FØR simulator).
- Verificeret BIT-IDENTISK: golden-master `check` = 7/7 (kode flyttet, intet
  ændret). `simulation.test.js` 155/155. Browser-smoke (static-server port 3000):
  ingen konsol-fejl, UI renderer, `sim.engine instanceof PhysiologyEngine` og
  `sim.rng === sim.engine.rng` bekræftet, RNG deterministisk pr. seed.
- OBS til senere oprydning: CLAUDE.md's load-rækkefølge-linje nævner ikke
  physiology-engine.js endnu (bør opdateres ved lejlighed; ikke gjort nu da
  CLAUDE.md er bruger-styret).

### 2026-06-14 — Claude — S0 del 2: golden-master (S0 færdig)

- Ny `tests/harness.js`: fælles hovedløs opsætning (DOM-/lyd-/i18n-mocks,
  deterministisk `performance.now()`, indlæsning af foods/hovorka/simulator,
  helpers `simulateMinutes`/`setSimulatorBG`/`resetGraphArrays`). Bruges af
  golden-master; `simulation.test.js` har stadig sin egen kopi (senere oprydning).
- Ny `tests/golden-master.js`: 7 deterministiske scenarier med fast seed —
  basal-24h, bolus-2u, meal-fat-protein, exercise-cardio, sleep-dawn,
  ketones-dka, cgm-noise. Fryser metrikkerne trueBG, cgmBG, iob, cob,
  ketoneLevel, weightChangeKg. Modes: `generate` / `check [--tol=]`.
- Fixturer committet i `tests/fixtures/golden-master/*.json`.
- Verificeret: `check` = 7/7 bit-identisk på tværs af to separate kørsler
  (= determinisme bekræftet). Falsifikations-test: korrumperet værdi blev
  fanget præcist (t/metrik/delta), derefter gendannet. `simulation.test.js`
  stadig 155/155.
- Sikkerhedsnettet for S1+ er nu på plads: enhver ren kode-flytning skal
  holde `check` bit-identisk.

### 2026-06-14 — Claude — S0 del 1: seedet RNG

- Tilføjet `makeRng(seed)` (mulberry32) øverst i `js/simulator.js` (flyttes til
  engine ved S1+).
- `Simulator`-konstruktøren tager nu `options.seed`. `this.rng()` seedes deraf;
  uden eksplicit seed vælges et tilfældigt seed, så normalt spil stadig varierer
  mellem sessioner. Tests/golden-master giver fast seed.
- Erstattet alle 12 simulations-kald til `Math.random()` med `this.rng()`
  (CGM-drift/amplitude/støj, gaussRand/Box-Muller → driver CGM-støjen,
  diskontinuitet, CGM-selvtest, boks-seed, fingerprik ±5%, keton-test ±10%).
- Eneste tilbageværende `Math.random` i filen er seed-entropien i konstruktøren.
- Verificeret: 155/155 Node-tests består. Ingen tilsigtet fysiologi-ændring;
  output varierer dog vs. før (ny talsekvens) — derfor genereres golden-master
  FRA denne seedede tilstand, ikke fra før-RNG-tilstanden.
- Næste: golden-master-harness + fixturer (scenarie-sæt, fast seed, JSON-dump
  + sammenlignings-tjek). Afklar scenarie-sæt og hvilke metrikker der fryses.

### 2026-06-14 — Claude — plan kombineret

- Codex' oprindelige plan og Claudes review samlet til én fælles plan
  (`2026-06-14_physiology-engine-api-plan.md` overskrevet med kombineret v2).
- Afklaret med bruger:
  - Arbejde på almindelig gren `physiology-engine` — INGEN worktree/mappe-kopi
    (Dropbox + to AI-værktøjer gør kopier til en konflikt-fælde; spillet har
    ingen deployment, så intet "går offline" ved gren-push).
  - Sammenligning undervejs sker via golden-master-regression + bit-identisk
    tolerance-politik, ikke via parallel kørende kopi.
  - Determinisme = to ting: seedet RNG (fundament, S0) + valgfrit noise-off-mode.
- Ingen kode ændret. Næste skridt: afvent brugerens go til S0.
