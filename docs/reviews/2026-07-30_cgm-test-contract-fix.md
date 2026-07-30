# CGM-testkontrakt - adskillelse af fysiologi og sensorstøj

**Dato:** 2026-07-30
**Type:** Beslutningsnotat for koordineret testrettelse
**Status:** FIKSET (denne commit/2026-07-30)
**Berørte filer:** Test-harness, klinisk baseline, golden-master-fixturer,
standalone-paritet, engine-API-tests og visuel modeltest.

---

## Bagrund

Den kliniske regressionstest fejlede i 3 af 9 scenarier alene på `cgmBG`, mens
`trueBG` og de fysiologiske aggregater var uændrede. En analyse viste, at den
frosne baseline var lavet med `cgmSensorFaults=true` i sandbox. Den nuværende
produktkontrakt aktiverer kun sensorfejl i kampagnebane 10. Forskellen ændrede
antallet af RNG-træk og forskød derfor den efterfølgende CGM-støjsekvens.

Analysen fandt samtidig, at testhjælperen `setSimulatorBG()` kun ændrede Q1,
`trueBG` og `cgmBG`. Q2 og det interstitielle CGM-kompartment C beholdt deres
gamle værdier. Scenarier med et ændret start-BG begyndte derfor i en fysisk
inkonsistent tilstand.

## Diagnose

### Udgået sensor-kontrakt

Med den gamle indstilling `cgmSensorFaults=true` reproducerede den aktuelle kode
den gamle CGM-baseline nøjagtigt. Med den tilsigtede sandbox-indstilling
`cgmSensorFaults=false` opstod 29-44 punktvise CGM-afvigelser i de tre undersøgte
scenarier, uden nogen ændring i `trueBG`. Fejlen lå derfor i testkontrakten og
ikke i glukosefysiologien.

### Kunstig initial transient

Motorens offentlige `setBG()` skalerer Q1 og Q2 proportionalt og sætter C,
`trueBG` og `cgmBG` samlet. Den tidligere testhjælper ændrede kun Q1. Når
scenarierne blev kørt med den korrekte initialisering, ændrede deres
fysiologiske forløb sig. De gamle fixturer havde dermed frosset en testartefakt.

## Løsning

1. `setSimulatorBG()` delegerer nu til `sim.engine.setBG(targetBG)`.
2. Den kliniske fysiologibaseline kører med `setNoise(false)` og kræver
   `cgmSensorFaults=false`.
3. `cgmBG` beholdes i fysiologibaselinen som et deterministisk interstitielt
   signal med lag. Det stokastiske `cgm-noise`-scenarie er fjernet fra denne
   baseline.
4. Sensorens stokastiske og diskrete mekanismer testes separat: lag,
   seed-reproducerbarhed, proportional støj ved BG 5/10/15, drift, sensorområde,
   kompression og automatisk selvtest.
5. Standalone-pariteten bruger samme `setBG()`-kontrakt på facade- og engine-stien.
   Deterministisk `cgmBG` er derfor igen en del af paritets-gaten.
6. Den visuelle måltidstest viser fortsat lag og støj, men bruger ikke længere ét
   seks-timers forløb som en påstået klinisk MARD-validering.

Ingen fysiologiske parametre eller produktionskode er ændret.

## Verifikation

### Fysiologiske aggregater før og efter korrekt initialisering

| Scenarie | Middel før | Middel efter | Min før/efter | Maks før/efter | TIR-ændring |
|---|---:|---:|---:|---:|---:|
| basal-24h | 11,81 | 11,81 | 4,97 / 4,97 | 19,22 / 19,22 | 0,0 pp |
| bolus-2u | 8,73 | 10,02 | 6,77 / 7,91 | 15,00 / 15,00 | -16,4 pp |
| meal-fat-protein | 19,92 | 20,12 | 6,90 / 7,00 | 29,51 / 29,69 | 0,0 pp |
| exercise-cardio | 7,38 | 8,03 | 5,80 / 6,46 | 9,57 / 10,18 | -4,1 pp |
| sleep-dawn | 11,32 | 11,20 | 5,66 / 5,77 | 18,87 / 18,03 | 0,0 pp |
| ketones-dka | 19,45 | 21,06 | 16,27 / 19,29 | 20,73 / 21,87 | 0,0 pp |
| hypo-overbolus | 4,95 | 5,13 | 2,42 / 2,53 | 8,54 / 8,61 | +1,6 pp |
| glucagon-rescue | 9,59 | 9,84 | 3,56 / 3,86 | 14,04 / 14,23 | +3,3 pp |

Ændringerne er størst ved store spring fra steady state, fordi den gamle Q2-værdi
gav den stærkeste kunstige udligning netop dér. Basal-scenariet ændres ikke,
fordi det ikke overskriver start-BG.

### Testresultater

- `tests/physiology-engine-api.test.js`: 34/34 bestået.
- `tests/simulation.test.js`: 190/190 bestået.
- `tests/clinical-equivalence.js check`: 8/8 bestået.
- `tests/golden-master.js check`: 7/7 bit-identiske.
- `tests/standalone-parity.js --verbose`: 10/10 bestået; maksimal afvigelse
  mellem facade og bar engine er 0 for alle målte værdier, inklusive `cgmBG`.

## Sub-agent input

Ingen sub-agent blev brugt. Gennemgangen fulgte projektets `phys-reviewer`-workflow.

## Files cited

- [`tests/harness.js`](../../tests/harness.js) - fælles BG-initialisering.
- [`tests/clinical-equivalence.js`](../../tests/clinical-equivalence.js) - deterministisk fysiologibaseline.
- [`tests/physiology-engine-api.test.js`](../../tests/physiology-engine-api.test.js) - separate CGM-komponenttests.
- [`tests/standalone-parity.js`](../../tests/standalone-parity.js) - fælles facade/engine-kontrakt.
- [`tests/model-validation.html`](../../tests/model-validation.html) - kvalitativ lag/støj-figur uden MARD-pass/fail.
- [`tests/fixtures/clinical-baseline.json`](../../tests/fixtures/clinical-baseline.json) - baseline version 2.
- [`tests/fixtures/golden-master/`](../../tests/fixtures/golden-master/) - regenererede bit-fixturer.
- [`js/physiology-engine.js`](../../js/physiology-engine.js) - `setBG()`, `_computeCgmBG()` og `_sampleCgm()`.
- [`js/hovorka.js`](../../js/hovorka.js) - interstitielt lag `dC/dt = ka_int * (G-C)`.
- [`docs/BG-SCIENCE.md`](../BG-SCIENCE.md) - CGM-forsinkelse, støj og MARD-baggrund.
