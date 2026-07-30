# PhysiologyEngine som generel, fleksibel standalone-model (S9)

**Dato:** 2026-06-16
**Type:** Arkitektur-/implementeringsplan + testplan
**Status:** Plan — afventer go til implementering.
**Gren:** `physiology-engine`
**Baggrund:** `2026-06-16_physiology-engine-external-api-plan.md` (S8, standalone-API
færdig), `physiology-engine-LOG.md` (løbende log).
**Formål:** Lukke de tre huller fra S8-vurderingen, så `PhysiologyEngine` fremstår
som en *generel* fysiologi-model — ikke en motor skræddersyet til Diabetes-Dysten.
En fremmed udvikler (nyt spil, model-laboratorium, scenarie-værktøj) skal kunne
oprette motoren, få en realistisk steady-state uden at kende spillets interne
kalibreringstal, modtage kliniske hændelser uden at polle, og bruge et
forudsigeligt API. **Spillet skal forblive klinisk uændret** (helst bit-identisk).

---

## Udgangspunkt: de tre huller (fra S8-vurderingen)

S8 gav engine et komplet standalone-API: `createEngine`, `step → {state, events}`,
interventioner, læse-API i tre granulariteter, `exportState`/`importState`,
event-buffer, ingen DOM/globals. Det fungerer. Men tre ting gør det stadig
spil-bundet snarere end generelt:

1. **Engine er ikke selvstændig omkring Hovorka + steady-state (størst).**
   En ekstern bruger skal selv skrive `new HovorkaModel(weight, {insulinSensitivityScale: isf/3.75})`
   (det magiske `3.75` er en kalibrerings-reference-ISF) og `attachHovorka(...)`,
   og får så en motor *uden* steady-state og *uden* basal-insulin → BG driver.
   Hele steady-state-initialiseringen (`initializeSteadyState`, basal-IOB-baseline,
   `trueBG`-synk) bor i `Simulator`-konstruktøren ([js/simulator.js:943-1016](../../js/simulator.js)),
   ikke i engine.

2. **Ingen fysiologiske tærskel-/severity-events.** Engine emitterer kun
   spil-/UI-events (`food-sound`, `cgm-sample`, `exercise-max-duration`).
   `game-over-condition` afgøres af *facaden*. En standalone-forbruger må selv
   polle `getState()` for `trueBG`/`ketoneLevel`/`acidosisLoad`/`brainEnergyDeficit`
   — der er ingen ren "sig til når noget klinisk sker"-kanal.

3. **Ergonomi.** Blandede argument-former (`addFood({...})`/`startActivity({...})`
   tager objekter, men `addRapidInsulin(units)`/`addBasalInsulin(units, time, silent)`
   er positionelle). `startActivity` kræver et udokumenteret `typeDef`-objekt uden
   default-katalog. Ingen `reset()`. Profil-kontrakten (`createEngine(profile)`) er
   ikke formaliseret/dokumenteret.

---

## Designprincipper (uændret + ét nyt)

- **Engine er ren:** ingen DOM, lyd, log, game-over, i18n, globals. (uændret fra S0-S8)
- **Spil-indhold bliver på facaden:** `CARB_TYPES`, `AKTIVITETSTYPER`,
  `campaignEngine`, Box Challenge, popups. (uændret)
- **NYT — engine ejer FYSIOLOGIEN fuldt, facaden lægger SPILLET ovenpå.** Alt der er
  generel patientfysiologi (Hovorka-konstruktion, steady-state, kliniske tærskler,
  et basalt aktivitetskatalog) flyttes ind i engine. Alt der er spil-specifik
  *kalibrering oven på fysiologien* (basal-depotets trapez-profil, circadian-justeret
  startdosis, campaign-startBG-override) bliver i facaden som et lag ovenpå engines
  generelle steady-state.
- **Klinisk ens, ikke nødvendigvis bit-identisk.** Rene flytninger holdes
  bit-identiske som hidtil. Tilføjelser der *kan* røre event-strømmen (kliniske
  events) gøres **opt-in** så spillets event-strøm er uændret. Hvor en ændring
  uundgåeligt bryder bit-identitet, er gaten i stedet **klinisk ækvivalens** med
  eksplicitte tolerancer (se Del 2).
- **NYT — modellen er selv-dokumenterende ved koden.** Hver offentlig engine-metode
  får en header-kommentar der dokumenterer hele kontrakten: signatur, hvert argument/
  felt, defaults, returværdi og hvilke events den kan emittere. Profil- og
  options-kontrakten dokumenteres ved `createEngine`/konstruktøren. `MODEL-API.md` er
  det eksterne *spejl* af disse kommentarer, ikke det eneste sted kontrakten findes.
  En fremmed bruger skal kunne forstå et kald uden at slå op i en ekstern fil.

---

# Del 1 — Designplan (generel model)

## G1 — Engine ejer Hovorka + steady-state

**Mål:** `createEngine(profile)` returnerer en motor der allerede er i fysiologisk
ligevægt for profilens patient, uden at kalderen kender til Hovorka eller `3.75`.

- **Engine bygger selv Hovorka.** Profilen bærer `weight` + `isf` (+ `icr`,
  `basalDose` osv.). Engine konstruerer internt `HovorkaModel` og afleder
  insulinfølsomheds-skalaen fra en **navngivet engine-konstant**
  (`HOVORKA_REFERENCE_ISF = 3.75`) i stedet for at kalderen skal kende tallet.
  `attachHovorka` bliver et internt skridt (eller fjernes som offentligt API);
  facadens `this.hovorka` bliver en getter-proxy til `this.engine.hovorka`.
- **Præcisering: basal-insulinets OPTAGELSE er allerede i engine.** Beholderen
  `activeLongInsulin`, injektionen `addBasalInsulin()` og selve optagelses-modellen
  (trapez-profilen: 2t ramp-up, plateau, 6t tail-off, areal-normalisering) i
  `_prepInsulinRates()` bor allerede i engine og fodrer Hovorkas `basalInsRate` hvert
  tik. Det skal ikke flyttes. Det eneste basal-relaterede der i dag bor i facaden er
  *spil-opstarten* (se nedenfor) — ikke fysiologien.
- **`engine.initSteadyState({targetBG = 5.5, ...opstartsparametre})`** — ny offentlig
  metode der gør engine **selvbærende**: (1) kør Hovorkas `initializeSteadyState` for
  at finde steady-state basal-raten, (2) **etablér et basal-depot** (`addBasalInsulin`,
  pre-aldret til plateau) sized så `_prepInsulinRates` reproducerer netop den rate —
  så en bar engine *holder* niveauet når den steppes, i stedet for at drive (tomt
  `activeLongInsulin` → rate 0 → BG kravler op), (3) gem `hovorkaSteadyStateBasalRate`
  + `basalIOBbaseline`, synk `trueBG`/`cgmBG`. **RNG-neutral** (binær søgning, ingen
  `gaussRand`) → bit-identisk muligt. `createEngine` kalder den som standard (option
  `{steadyState:false}` for at springe over).
- **Arbejdsdeling:** engine giver den *generelle* selvbærende ligevægt (steady-state
  + basal-depot der holder den). Facaden sender kun sine *spil-specifikke
  opstartsparametre* ind — depotets alder (16t før spilstart), circadian-ISF-justering
  af dosis ved midnat, og campaign-startBG-override. Da `initializeSteadyState`-
  resultatet er uafhængigt af `basalRateGuess` (binær søgning overskriver gættet
  straks), er flytningen en ren relokering for spillet.
- **Resultat for ekstern bruger:** `createEngine({weight:70, isf:3})` giver en motor
  der af sig selv har et basal-depot, holder ~5.5 mmol/L i faste og *ikke* driver når
  man stepper den — uden at kalderen kender til Hovorka, `3.75` eller basal-pre-injektion.

## G2 — Kliniske tærskel-/severity-events (opt-in)

**Mål:** En standalone-forbruger kan abonnere på kliniske hændelser i stedet for at
polle. Spillets event-strøm forbliver uændret (opt-in → bit-identisk for spillet).

- **Aktiveres via** `createEngine(profile, {clinicalEvents:true})` (default `false`).
  Facaden sætter den ikke → ingen nye events i spillets buffer.
- **Kant-trigget tilstandsmaskine** (ikke per-tik-spam). Engine holder en lille
  intern klinisk zone-state og emitterer kun ved *overgange*. Ingen `gaussRand` →
  påvirker ikke BG-banen.
- **Hændelsessæt** (alle med `severity` på det eksisterende `emitEvent(type, data, severity)`):
  - `glucose-low` — severity `mild` (<3.9), `significant` (<3.0), `severe` (<2.5 / hypo-grænse).
  - `glucose-high` — severity `mild` (>10), `high` (>15), `very-high` (>20).
  - `glucose-in-range` — tilbage i 3.9-10 (recovery-overgang).
  - `ketones-elevated` — severity ud fra `ketoneLevel` (>1.5 forhøjet, >3.0 høj).
  - `acidosis-risk` — `acidosisLoad` som fraktion af `ACIDOSIS_THRESHOLD` (advarsel/kritisk).
  - `brain-energy-low` — `brainEnergyDeficit` som fraktion af `BRAIN_DEFICIT_THRESHOLD`.
  - Tærsklerne læses fra de engine-konstanter der allerede findes — ingen nye magiske tal.
- **Emitteres fra `engine.step()`** efter BG-/keton-/acidose-opdatering, så de afspejler
  tikkets slut-tilstand.

## G3 — Ergonomi: aktivitetskatalog, signaturer, reset, profil

**Mål:** Forudsigeligt, selvforklarende API uden udokumenterede kontrakter.

- **Default-aktivitetskatalog i engine.** Engine får et lille indbygget katalog
  (fx `walk`, `run`, `cycle`, `strength`) med fornuftige `typeDef`-værdier
  (hrTarget, e1/e2-scaling, stress). `startActivity({type:'run', durationMin:30})`
  slår op i kataloget; en eksplicit `typeDef` kan stadig sendes med og override'r.
  Spillets `AKTIVITETSTYPER` bliver fortsat sendt ind fra facaden uændret → spillet
  bit-identisk; kataloget bruges kun når kalderen *ikke* selv giver en `typeDef`.
- **Konsistente signaturer (VALGT — objekt-form).** Alle interventioner følger samme
  mønster: ét objekt med navngivne felter. Insulin normaliseres fra positionelt til
  `addRapidInsulin({units})` og `addBasalInsulin({units, injectionTime, silent})`, så
  de matcher `addFood({...})`/`startActivity({...})`. Facadens kaldsteder rettes med.
  Ren ergonomi — ingen fysiologi ændres.
- **`engine.reset()`** — geninitialisér til frisk steady-state med samme profil +
  re-seed RNG. Til labs der kører mange scenarier i træk.
- **Formaliseret profil-kontrakt.** Dokumentér `createEngine(profile, options)`:
  hvilke felter profilen tager (`weight`, `isf`, `icr`, `basalDose`, ...), hvilke der
  er påkrævede vs. har defaults, og hvilke `options` der findes (`seed`,
  `noiseEnabled`, `steadyState`, `clinicalEvents`).

---

# Del 2 — Implementerings- og testplan

Kernekrav fra brugeren: vi skal *vide* at modellen efter ændringerne er **klinisk
ens** med før — også de steder hvor den ikke er bit-identisk.

## Hvad "klinisk ens" betyder (kvantitative tolerancer)

Tolerancerne ligger bevidst under klinisk/CGM-måleopløsning, så afvigelser derunder
er klinisk betydningsløse (CGM MARD ~9 %, display-granularitet 0.1 mmol/L):

- **Punktvis** ved matchede tidspunkter: `|ΔtrueBG| ≤ 0.1 mmol/L` over hele forløbet.
- **Aggregeret** over et scenarie:
  - Middel-BG inden for ±0.1 mmol/L.
  - Min/max-BG inden for ±0.2 mmol/L.
  - Time-in-Range (3.9-10) inden for ±1 procentpoint.
  - IOB/COB inden for ±2 % ved matchede tidspunkter.
  - `ketoneLevel`/`acidosisLoad` inden for ±2 %.
- **Kvalitativ identitet:** samme udfald (samme hypo/DKA/brain-deficit-episoder,
  ingen ny eller forsvunden game-over-tilstand).

Hvor en slice forventes bit-identisk, er gaten stadig tolerance 0 (golden-master).
Klinisk-tolerancen er kun "sikkerhedsnet" for de slices der bevidst bryder bit-identitet.

## Test-infrastruktur (ny)

1. **Scenarie-batteri** (deterministisk: fast seed, `noiseEnabled:false`) der dækker
   de fysiologiske veje: faste-baseline (hold steady-state 24 t), måltid + bolus,
   hypo fra over-bolus, motion + post-exercise, DKA-progression (manglende basal),
   pizza/fedt, protein, glukagon-rescue. Genbruger scenarie-runneren.
2. **Baseline-capture (FØR kodeændring):** kør batteriet på nuværende kode og frys
   output som golden-trace-JSON (`tests/fixtures/clinical-baseline.json`). Dette er
   "før"-referencen.
3. **Klinisk-ækvivalens-sammenligner:** efter hver slice køres batteriet igen og
   sammenlignes mod den frosne baseline med tolerancerne ovenfor. Rapporterer
   max-afvig per metrik.
4. **Standalone-paritet (det vigtigste bevis):** kør det SAMME batteri via den
   *bare* engine (`createEngine` + `attachDefaultRunner`, ingen facade) og assertér
   at standalone-tracen matcher facade-tracen inden for tolerance. Dette beviser
   direkte at motoren alene reproducerer spillets kliniske adfærd — altså at den er
   brugbar generelt.

## Slices (commit per slice, verificér efter hver)

- **S9.0 — Testinfrastruktur + baseline.** Byg batteri + sammenligner + frys baseline.
  *Ingen* engine-ændring endnu. Verificér at sammenligneren giver 0 afvig mod sig selv.
- **S9.1 — G1: engine ejer Hovorka + `initSteadyState()`.** Flyt Hovorka-konstruktion
  + steady-state ind i engine; facaden delegerer; `this.hovorka` bliver proxy.
  Gate: golden-master bit-identisk (forventet) + klinisk baseline 0-afvig.
- **S9.2 — G3: aktivitetskatalog + `reset()` + signatur-normalisering.** Gate:
  bit-identisk for spillet (facaden sender stadig egne `typeDef` ind); nye
  API-tests for katalog/reset.
- **S9.3 — G2: kliniske events (opt-in).** Default off → spillet bit-identisk.
  Nye tests: events fyrer ved korrekte tærskler/severity når slået til.
- **S9.4 — G1-profil-kontrakt + dokumentation.** Formalisér profil; opdatér
  `docs/MODEL-API.md` (fuldt API + standalone Node-eksempel der viser createEngine →
  steady-state → events uden facade) + `docs/MODEL-IMPLEMENTATION.md` (doc-version-bump).
- **S9.5 — Standalone-paritet + playtest + merge-prep.** Kør standalone-paritets-test;
  browser-playtest (sandbox + en campaign-bane + Box Challenge); `bash tests/check-text-sync.sh`;
  version-bump i `version.json`; opdatér LOG. Derefter klar til merge `physiology-engine` → `main`.

## Verifikations-kommandoer

- Regression/golden-master/suite: `tests/.bin/node.exe tests/run-physiology-regression.js`
- Klinisk batteri + baseline-sammenligning: nyt script (S9.0), fx
  `tests/.bin/node.exe tests/run-clinical-equivalence.js`
- API-tests: indgår i regression-runneren (`tests/physiology-engine-api.test.js`)
- Tekst-sync (før merge): `bash tests/check-text-sync.sh`
- Browser-smoke: static-preview (portable node http-server, port 3000)

---

## Rækkefølge og risiko

S9.0 (ingen risiko, bygger sikkerhedsnettet) → S9.1 (moderat: arkitektur-flytning,
men RNG-neutral → bør være bit-identisk) → S9.2/S9.3 (lav: opt-in/additive) → S9.4
(dokumentation) → S9.5 (verifikation + merge). Den væsentlige nye værdi ligger i
S9.0-sikkerhedsnettet og S9.5-standalone-pariteten: tilsammen beviser de "klinisk ens"
hvor bit-identitet ikke kan garanteres.

## Beslutninger

1. **Insulin-signaturer — AFKLARET (2026-06-16):** normaliseres til objekt-form
   (`addRapidInsulin({units})` osv.). Se G3.
2. **Aktivitetskatalogets indhold — ÅBEN (afklares ved S9.2):** hvilke aktiviteter +
   hvilke typeDef-værdier skal default-kataloget have? Udgangspunkt: afled dem af
   spillets `AKTIVITETSTYPER`.
