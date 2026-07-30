# Intervention atomicity fix

**Dato:** 2026-07-23  
**Branch:** `codex/physiology-followups`  
**Status:** Implementeret lokalt og testet

## 1. Bagrund

Det fulde fysiologireview fandt to beslægtede API-problemer:

1. Stressinterventioner kunne acceptere `NaN`, negative værdier og værdier over
   de dokumenterede grænser.
2. `startActivity()` kunne registrere tabt søvn og kalde en callback, før den
   opdagede en ukendt aktivitetstype. En varighed på `0` blev desuden fortolket
   som en aktivitet, der fortsatte til sikkerhedsgrænsen på 240 minutter.

Begge fejl brød interventionskontrakten: et afvist input kunne enten forurene
fysiologien eller efterlade sideeffekter.

## 2. Diagnose

Stress blev tidligere muteret direkte gennem `Simulator`-facaden uden
`requireNumber()`. Derfor kunne ikke-endelige værdier nå stressmultiplikatoren og
videre ind i Hovorka-kernen.

Aktivitetsmetoden udførte callback og `registerNightIntervention()` før opslag og
validering af type-definitionen. Auto-stop brugte samtidig varigheden som en
boolesk værdi, så `0` sprang den tilsigtede varighedsgrænse over.

Dette er et API-integritetsfix, ikke en ny fysiologisk kalibrering. De eksisterende
stressgrænser bevares:

- akut stressincrement: `0-0,4`, aktiv state capped ved `0,4`;
- kronisk stressincrement: `0-1,5`, pending-pulje capped ved `1,5`;
- aktivitet: positiv varighed op til 1440 minutter eller `null` for open-ended.

## 3. Løsning

- `PhysiologyEngine.addAcuteStress()` og `addChronicStress()` validerer hele
  inputtet før state og eventbuffer ændres.
- `Simulator` delegerer til engine-metoderne og videresender deres returværdi.
- `startActivity()` validerer varighed, type, intensitet og alle fysiologiske
  felter i type-definitionen før callbacks, søvnregistrering og events.
- `durationMin: 0` kaster en tydelig fejl; `null` er fortsat en åben session.
- Auto-stop sammenligner eksplicit med `null` i stedet for at bruge varigheden
  som en boolesk værdi.

## 4. Verifikation

Direkte API-tests sammenligner et komplet eksporteret engine-snapshot før og
efter afviste kald. Dermed dækkes fysiologisk state, RNG-position og eventantal.
Derudover kontrolleres callback, søvntab og aktiv motionsstate eksplicit gennem
det uændrede snapshot.

| Test | Resultat |
|---|---:|
| `tests/.bin/node.exe tests/physiology-engine-api.test.js` | 23/23 bestået |
| `tests/.bin/node.exe tests/simulation.test.js` | 187/187 bestået |
| JavaScript syntakskontrol | Bestået med projektets portable Node |
| `git diff --check` | Bestået |

## 5. Sub-agent input

Ingen sub-agent blev brugt til dette fix.

## 6. Files cited

- `js/physiology-engine.js:1600` - eksplicit auto-stop-kontrakt.
- `js/physiology-engine.js:3215-3283` - atomare stress- og aktivitetsmetoder.
- `js/simulator.js:2449-2468` - facade-delegering.
- `tests/physiology-engine-api.test.js:411-510` - direkte atomaritets-tests.
- `tests/simulation.test.js:781-801` - facade-regressionstest.
- `docs/reviews/2026-07-23_codex_full-physiology-updated-skill.md` - oprindelige findings og status.
