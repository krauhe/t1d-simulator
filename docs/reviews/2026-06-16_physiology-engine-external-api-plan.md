# Standalone ekstern API for PhysiologyEngine (S8)

**Dato:** 2026-06-16
**Type:** Arkitektur-/implementeringsplan
**Status:** Plan — go givet til "lav plan og implementer".
**Gren:** `physiology-engine`
**Baggrund:** `2026-06-14_physiology-engine-api-plan.md` (oprindelig plan, S0-S7),
`physiology-engine-LOG.md` (løbende log).
**Formål:** Lukke de sidste huller, så `PhysiologyEngine` kan bruges direkte
udefra (nye spil, model-laboratorier, scenarie-værktøjer) UDEN
`Simulator`-facaden — inputs, outputs og et selvstændigt step.

---

## Udgangspunkt: hvad mangler

S0-S7 har givet engine: al fysiologi-BEREGNING (konstanter, leaf-metoder,
substep-løkken `_runSubstepLoop`, CGM-signal `_computeCgmBG`, post-IOB), samt
determinisme/lab-kontroller (`setNoise`, `setBG`, `setPlasmaInsulinClamp`,
`exportState`/`importState`, `runScenario`) og event-bufferen.

Men det eksterne INTERAKTIONS-lag bor stadig på facaden:

1. **Inputs (interventioner):** `addFood`, `addFastInsulin`, `addLongInsulin`,
   `startAktivitet`/`stopAktivitet`, `useGlucagon` er `Simulator`-metoder. Engine
   har ingen måde at modtage mad/insulin/motion/glukagon på.
2. **Outputs (læse-API):** `getPhysiologySnapshot()` (+ `_computeBGForces()`) er
   facade-metoder. Engine har intet kurateret læse-API (`exportState` er et
   serialiserings-snapshot med metadata, ikke et aflæsnings-API). `getState()` og
   `getFluxSnapshot()` fra v1-API'et findes slet ikke.
3. **Standalone step:** `engine.step()` kaster fejl uden `attachStepper()`, og
   stepperen ER facadens `_stepPhysiology`. Dele af det tik er ren fysiologi
   (carb-rate/τG/puls-prep, CGM-sampling) men ligger på facaden. `runScenario`
   er heller ikke ægte standalone — dens runner-bro dispatcher til facade-metoder.

v1-API'et fra den oprindelige plan (linje 152-174 dér):
`createEngine`, `step→{state,events}`, `addFood`, `addRapidInsulin`,
`addBasalInsulin`, `startActivity`, `useGlucagon`, `getState`,
`getPhysiologySnapshot`, `getFluxSnapshot`, `exportState`/`importState`,
`setNoise`/`setPlasmaInsulinClamp`/`setBG`/`runScenario`.

---

## Designprincipper (uændret fra S0-S7)

- **Engine er ren:** ingen DOM, lyd, `logEvent`, `gameOver`, i18n eller globals.
  Catalog-globals (`CARB_TYPES`, `AKTIVITETSTYPER`, `estimateEatTimeMin`) er
  spil-indhold, ikke fysiologi — facaden slår dem op og sender opløste tal/objekter
  ind i engine-metoderne. Engine bærer fornuftige defaults (mixed-carb,
  vægt-heuristik) så en standalone-kalder kan nøjes med `engine.addFood({carbs:40})`.
- **Side-effects → events:** interventioner emitterer strukturerede events
  (`stomach-full`, `food-added`, `activity-started`, ...). Facaden oversætter til
  lyd/log/popup (allerede etableret i S3).
- **Facaden delegerer, beholder spil-wrapper:** `campaignEngine.recordAction`,
  `handleNightIntervention`, DOM-status (`updateGlucagonStatus`), `logHistory`,
  Box Challenge bliver på facaden. Den kalder engine-metoden og flusher events.
- **Bit-identisk golden-master (tolerance 0)** efter hver slice. Ren kode-flytning
  må ALDRIG ændre output. Verificér med
  `tests/.bin/node.exe tests/run-physiology-regression.js` (engine-API 7/7,
  golden-master 7/7 bit-identisk, suite 155/155) + browser-smoke.
- **Linjeendelser:** `simulator.js` = CRLF, `physiology-engine.js` = LF. Store
  metode-flytninger via CRLF-aware node-script (kopiér tekst, repro ikke manuelt).

---

## Faser

### Fase A — Engine-native interventioner

Tilføj rene fysiologi-metoder til `PhysiologyEngine`; facaden beholder spil-wrapper
og delegerer. Hver under-slice bit-identisk.

- **A1 `engine.addFood({carbs, protein, fat, weight, eatTimeMin, carbParams})`**
  → boolean. Mave-kapacitetstjek (emit `stomach-full`), kcal-akkumulering, push
  `activeFood` + `activeIntake`. `carbParams = {simpleFraction, fiberPerGram,
  retentionFactor}` (default mixed). Facaden slår `CARB_TYPES[carbType]` +
  `estimateEatTimeMin` op og sender dem ind.
- **A2 `engine.addRapidInsulin({units})`** (kanonisk; `addFastInsulin` alias).
  gaussRand tauFactor, push `activeFastInsulin`, `lastInsulinTime`, DKA-reset, emit.
- **A3 `engine.addBasalInsulin({units, injectionTime, silent})`**
  (`addLongInsulin` alias). gaussRand varighed, push `activeLongInsulin`, emit.
- **A4 `engine.startActivity({type, intensity, durationMin, typeDef})`** +
  `engine.stopActivity()`. start: cooldown-tjek (emit `exercise-cooldown`), sæt
  `activeAktivitet`, emit `activity-started`. stop: beregn A_fast/A_early/A_late
  (bruger `ENGINE_EXERCISE_*`, findes allerede), push `activeMotion`, prune,
  cooldown, emit `activity-ended`. Facaden beholder `logHistory`-opdatering +
  recordAction. (`EXERCISE_SENSITIVITY_MAX_LIFETIME_MIN` får evt. `ENGINE_`-kopi.)
- **A5 `engine.useGlucagon()`** → boolean. Beregn `actualRelease_g` fra
  `liverGlycogenGrams`, sæt `activeGlucagon`, emit. Facaden beholder 24t-cooldown
  (`glucagonUsedTime`) + `updateGlucagonStatus`.

### Fase B — Læse-API

- **B1 `engine.getPhysiologySnapshot()`** — flyt snapshot + `_computeBGForces()`
  til engine (ren derivation af engine-state + hovorka). Facade-wrapper bevares
  (ui.js/dashboard kalder `game.getPhysiologySnapshot()`).
- **B2 `engine.getState()`** — ny kompakt numerisk kerne-state (trueBG, cgmBG, iob,
  displayIOB, cob, ketoneLevel, acidosisLoad, weightChangeKg, totalSimMinutes, day,
  timeInMinutes, basalInsulinRate). Til lette eksterne aflæsninger/scenarie-runner.
- **B3 `engine.getFluxSnapshot()`** — returnér flux/modifier-dekompositionen
  (`_computeBGForces()`-resultatet) som selvstændigt API (v1-navn).

### Fase C — Standalone `step()`

Mål: `engine.step(simMinutes, {onSample})` kører HELE fysiologien uden facade-
stepper og returnerer `{state, events}`. Facaden gør spil-efterbehandling bagefter.
Største/følsomste fase — deles op, hver bit-identisk.

- **C1 — prep ind i engine.** Flyt carb-rate/τG/puls-prep ind i engine. Løs facade-
  entanglement: `totalExerciseMinutes` → engine-ejet (proxy); auto-stop (4t/varighed)
  → engine kalder sin egen `stopActivity()` (fra A4) + emit `exercise-max-duration`;
  box-sweep `_prevTrueBG`/`_prevTimeInMinutes` → facaden fanger dem FØR `engine.step()`
  i `update()`; `GLUCOSE_G_PER_MMOL` → `ENGINE_`-kopi (findes).
- **C2 — CGM-sampling ind i engine.** Engine producerer `cgmBG` ved 5-min-cadence
  (kalder `_computeCgmBG`), emitterer `cgm-sample`-event med data facaden bruger.
  Facaden beholder: graf-push (`cgmDataPoints`/`trueBgPoints`/`bgHistoryForStats`),
  `playSound('tick')`, selvtest-trigger (rng-træk SIDST i tikket → rækkefølge
  bevaret), sensor-status-orkestrering.
- **C3 — split + rewire.** Facadens spil-efterbehandling (steep-drop, graf-besked-
  cleanup, søvn/morgen-events, normo/vægt/stats/game-over/kit-status, Box Challenge)
  → facade `_postStep()`. `engine.step()` kalder sin egen fysiologi-krop direkte
  (ingen `attachStepper`). `update()` = guard + simMinutes + `engine.step({onSample})`
  + `_postStep()`. Rækkefølge bevaret 1:1.
- **C4 — fjern bro + standalone runScenario.** Fjern `attachStepper`/`physicsStepper`.
  Giv `runScenario` en intern default-runner (engine.step + engine-interventioner +
  engine.getState), så den kører uden `attachScenarioRunner`; facaden kan stadig
  override med sin egen runner. `step()` returnerer `{state, events}`.

### Afslutning

- Opdatér `docs/MODEL-API.md` (fuldt eksternt API + standalone Node-eksempel) +
  `docs/MODEL-IMPLEMENTATION.md` (kort: engine er nu standalone) + LOG.
- Tilføj engine-direkte API-tests (interventioner + getState + standalone step +
  standalone runScenario) til `tests/physiology-engine-api.test.js`.
- Fuld regression + browser-smoke. Bit-identisk hele vejen.

---

## Rækkefølge og risiko

A (lav-moderat risiko, høj værdi) → B (lav risiko, høj værdi) → C (høj risiko,
høj værdi). A+B er rene tilføjelser + tynd delegering. C er den egentlige
arkitektur-inversion (facade kalder engine, ikke omvendt) og kræver omhyggelig
rækkefølge-bevarelse. Commit per under-slice.
