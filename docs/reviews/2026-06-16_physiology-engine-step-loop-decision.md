# S7 — Engine ejer step-/update-loopet (fix-decision-doc)

**Dato:** 2026-06-16
**Type:** Arkitektur-beslutning + sub-slice-plan
**Gren:** `physiology-engine`
**Arbejdslog:** `docs/reviews/physiology-engine-LOG.md`
**Overordnet plan:** `docs/reviews/2026-06-14_physiology-engine-api-plan.md`
**Forfatter:** Claude

> Fælles dokument for Claude Code og Codex. Alt skrevet selvstændigt — ingen
> samtale-kontekst. Et værktøj kan overtage koldt midt i fasen.

---

## Baggrund

Slices S0-S6 fra den overordnede plan er LUKKET og verificeret bit-identisk
(engine-API 7/7, golden-master 7/7, fuld suite 155/155). `PhysiologyEngine`
ejer i dag al fysiologisk state (via proxy-mønstret), event-bufferen og
Lab-API'et (`exportState`/`importState`/`setBG`/`setNoise`/`setPlasmaInsulinClamp`/
`runScenario`).

**Men ét kerne-mål fra planen mangler.** Planen (linje 141 + 160) kræver:

> "Engine ejer substep-opdelingen ... selve dt <= 1 min-substep-loekken bor i
> engine, fordi den er fysiologi. Facaden kalder `engine.step(simMinutes)`."

I dag er det ikke sandt:

- `js/physiology-engine.js` har INGEN `step()`/`update()`-metode.
- Hele fysiologi-beregningen bor i `Simulator.update(deltaTimeSeconds)`
  (`js/simulator.js`, ~770 linjer, linje ~2205-2977): tidsbogføring,
  insulin-rate-beregning, substep-loekken (`hovorka.step()` + alle
  `_substep*`/`update*`-kald) og post-loop CGM/vægt/checks/graf-sampling.
- `runScenario()` virker kun fordi engine kalder TILBAGE til Simulator via
  `scenarioRunner`-broen (`_stepEngineScenario` -> `this.update(minutes)`).

Engine kan altså holde state og afvikle Lab-API, men kan IKKE selv regne
fysiologi uden facaden. Den er ikke reelt selvstændig — hvilket var hele
formålet (genbrug uden for spil-UI, labs, andre spil).

## Beslutning

Gennemfør **S7: flyt step-/update-loopet ind i `PhysiologyEngine`**, så
`engine.step(simMinutes)` til sidst ejer hele fysiologi-tikket, og
`Simulator.update(deltaTimeSeconds)` kun konverterer vægur-sekunder ->
sim-minutter og kalder engine.

Dette er planens hoejeste-risiko-zone (substep-rækkefølgen, se invarianter
nedenfor). Derfor gøres det som de tidligere faser: **små, bit-identiske
trin**, hver verificeret mod golden-master FØR næste trin. Ingen stor samlet
omskrivning.

Mønstret genbruges fra S3.1 (event-buffer-skelet før migration) og S5.4
(`attachHovorka`-bro før beregning flyttes): først etableres API-sømmen
(`engine.step()` + en facade-stepper-bro), DEREFTER flyttes beregnings-blokkene
ind i engine ét trin ad gangen.

## Invarianter der SKAL bevares (bit-identisk)

Fra planens risiko-afsnit og koden i `update()`:

1. **Substep-rækkefølge i loekken (dt <= 1 min):**
   - `_processActiveIntake` (mad-dryp) FØR `_substepFatProteinFFA` (so tau_G er frisk).
   - Fedt/protein (`_substepFatProteinFFA`) FØR `hovorka.step()` (påvirker tau_G, stress, ISF).
   - Ketoner (`_substepKetones`) EFTER `hovorka.step()` (kræver frisk plasmaInsulin).
   - Stress-hormoner, muskelglykogen, glukagon kører PER SUBSTEP, ikke per tick
     (bevidst valg, fund #1 i `2026-06-08_claude_model-implementation.md`, så
     hypo-modregulering ikke bliver hastigheds-/hardware-afhængig).
   - `trueBG` opdateres SIDST i hvert substep; skades-akkumulatorer
     (`updateBrainEnergyDeficit`/`updateAcidosisLoad`/`updateGlucotoxicity`)
     læser den friske post-step-værdi.
2. **RNG-rækkefølge:** ingen ny `this.rng()`/`gaussRand()`-træk må indsættes
   mellem eksisterende træk. Ren kode-flytning ændrer ikke trækkenes rækkefølge.
3. **`physiologyDataPoints`-sampling** (hvert sim-minut) bevares uændret.
4. **Plasma-insulin-clamp** kaldes FØR og EFTER `hovorka.step()`.

## Verifikations-politik

- Hver S7-slice: `tests/.bin/node.exe tests/run-physiology-regression.js` skal
  give engine-API 7/7, golden-master **7/7 bit-identisk (tolerance 0)**, suite
  155/155.
- Ren kode-flytning -> bit-identisk er et KRAV, ikke en målsætning. Enhver
  afvigelse betyder en utilsigtet ændring og skal undersøges, ikke accepteres.
- Browser-smoke efter strukturelle slices: sandkasse starter, mad/insulin/motion
  virker, grafen opdaterer.

## Sub-slice-plan

Grænsen mellem facade og engine følger planens tabel (fysiologi vs. spil).
Post-loop-arbejde der er facade (graf-sampling, game-over-checks, DOM via
events, normo-points/score) bliver i Simulator eller går via events; kun
fysiologi flyttes ind i `engine.step()`.

**RETTET RÆKKEFØLGE (2026-06-16, efter S7.3).** Den oprindelige plan havde
konstant-flytningen som sidste trin (S7.8). Det er forkert: undersøgelse efter
S7.3 viste at ALLE `_substep*`/`update*`-metoder og pre-loop-prep'en læser
fysiologi-konstanter der bor på `Simulator` — dels som instans-felter
(`this.GLUCOTOX_*`, `this.LIPOLYSIS_*`, `this.BRAIN_*`, `this.ACIDOSIS_*`,
`this.HAAF_*`, `this.TAU_*`, `this.STOMACH_*`, `this.CPT1_*`, `this.FFA_*`,
`this.BHB_*`, `this.LIVER_GLYCOGEN_*`), dels som modul-globale bare-navne
(`GLUCOSE_G_PER_MMOL`, `MUSCLE_GLYCOGEN_*`, `KCAL_PER_KG_WEIGHT`). Flyttes en
metode til engine før konstanterne, bliver `this.X` `undefined`, og de modul-
globale findes ikke i engine.js' Node-scope (jf. S2.9). **Konstant-flytningen
er derfor en FORUDSÆTNING for at flytte fysiologien**, ikke en finish.

- **S7.1 — FÆRDIG.** Step-søm + facade-bro (`engine.step()` + `attachStepper()`;
  `update()`-krop -> `Simulator._stepPhysiology()`). Bit-identisk.

- **S7.2 — FÆRDIG.** Tidsbogføring (`totalSimMinutes`/`timeInMinutes`/`day` +
  resting-kcal) flyttet ind i `engine.step()`. Bit-identisk.

- **S7.3 — FÆRDIG.** Insulin-rate-prep (basal-trapez, bolus-deponering, IOB)
  -> `engine._prepInsulinRates()`. Bit-identisk.

- **S7.4 — Fysiologi-instans-konstanter -> engine (unblocker).**
  Flyt `this.X`-konstanterne til engine-konstruktøren + getter-proxy på
  `Simulator`, så metoderne (stadig på facaden) læser `this.X` uændret. Ingen
  call-site- eller metode-ændringer -> ren ownership-flytning, bit-identisk.
  Grupperet i commits efter subsystem:
  - **S7.4a:** keton/lipolyse/acidose (LIPOLYSIS_*, CPT1_*, FFA_LIPO_CLEAR_HALF,
    BHB_*, ACIDOSIS_*).
  - **S7.4b:** fedt/protein/mave/FFA-resistens (STOMACH_*, TAU_FAT_ABS, FFA_*,
    TAU_PROT_ABS, AA_*, PROTEIN_GLUCAGON_MAX).
  - **S7.4c:** brain/glukotoks/HAAF/leverglykogen (BRAIN_*, GLUCOTOX_*, HAAF_*,
    LIVER_GLYCOGEN_MAX, GLYCOGEN_STRESS_THRESHOLD).

- **S7.5 — `_substep*`/`update*`-fysiologimetoder ind i engine.**
  Flyt `_processActiveIntake`, `_substepFatProteinFFA`, `_substepRapidInsulin`,
  `_substepKetones`, `updateMuscleGlycogen`, `_substepGlucagon`,
  `updateStressHormones`, `updateBrainEnergyDeficit`, `updateAcidosisLoad`,
  `updateGlucotoxicity` ind i engine ét ad gangen. De modul-globale bare-navne
  (`GLUCOSE_G_PER_MMOL`, `MUSCLE_GLYCOGEN_*`, `KCAL_PER_KG_WEIGHT`) flytter
  sammen med den/de metode(r) der bruger dem, og facade-kald i metoderne
  (`_flushEngineEvents`, `stopAktivitet`) bro-håndteres. `Simulator` beholder en
  tynd delegerende wrapper pr. flyttet metode.

- **S7.6 — Substep-loekken + pre-loop-prep ind i engine.step().**
  Flyt `while (remaining > 0)`-loekken og carb-rate/τG/puls-prep'en ind i engine.
  Facade-rest i prep'en (`totalExerciseMinutes`, `stopAktivitet`, box-sweep
  `_prevTrueBG`/`_prevTimeInMinutes`) afklares via events eller ved at lade
  orkestreringen blive på facaden og kun fysiologien flytte. Invarianterne 1:1.

- **S7.7 — Post-loop: fysiologi vs. facade-split.**
  CGM-simulation -> engine; steep-drop-advarsel/vægt-DOM/game-over-checks/
  normo-points/graf-sampling -> facade (events fra S3/S4 hvor muligt).

- **S7.8 — Fjern scenario-runner-broen.**
  Når engine selv stepper, kalder `runScenario()` `engine.step()` direkte.
  Fjern `attachScenarioRunner`/`_stepEngineScenario`-omvejen.

Når S7.8 er lukket, kan `PhysiologyEngine` køre et helt fysiologi-tick uden
`Simulator`. Det opfylder planens hovedmål.

## Status

- **S7.1:** se LOG.
