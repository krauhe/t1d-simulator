# Campaign start-basal fix

**Dato:** 2026-07-23  
**Branch:** `codex/physiology-followups`  
**Status:** Implementeret lokalt og verificeret; ikke committet

## Bagrund

Det fulde fysiologireview fandt, at campaign level 2 angav
`basalPreInjected: false`, mens `Simulator` alligevel oprettede et skjult aktivt
basaldepot. Spilleren blev samtidig bedt om selv at give basalinsulin. Den
samlede tilstand kunne derfor indeholde to fulde depoter, selv om UI og
campaign-logik kun registrerede spillerens dosis.

## Diagnose

Campaign-konfigurationen blev først behandlet før den egentlige startdosis blev
oprettet. Den tidlige kode forsøgte at rydde `activeLongInsulin`, men senere i
konstruktøren blev et nyt depot oprettet ubetinget og kalibreret til
steady-state-raten.

Fejlen lå i kontrolflowet, ikke i Hovorka-parametrene eller
basaldosis-kontrakten. Ingen fysiologiske konstanter er ændret.

To mulige startkontrakter blev vurderet:

1. Fjern kun det aktive subkutane depot og lad den etablerede plasma- og
   effekttilstand aftage.
2. Nulstil både depot, basal plasma-insulin og alle tre insulin-effektkanaler.

Mulighed 1 blev valgt. En person kan ikke gå fra steady state til nul
insulinvirkning øjeblikkeligt, og basalinsulinens langsomme indsættende virkning
kræver en overgang. Den eksisterende Hovorka-tilstand får derfor lov at aftage,
men den er ikke længere koblet til en skjult aktiv injektion.

## Løsning

Startdepotet oprettes nu kun, når:

```js
campaignPhysics.basalPreInjected !== false
```

Kontrakten er:

| Konfiguration | Aktivt depot ved start | Aftagende plasma-/effekttilstand |
|---|---:|---:|
| `basalPreInjected: false` | 0 | Ja |
| `basalPreInjected: true` | 1 | Ja |
| Felt mangler | 1 | Ja |

Level 2 starter dermed uden en skjult injektion. Når spilleren giver den første
basaldosis, findes præcis ét aktivt depot.

## Verifikation

| Kontrol | Før | Efter |
|---|---:|---:|
| Aktive depoter ved `false` | 1 | 0 |
| Aktive depoter efter spillerens første dosis | 2 | 1 |
| Aktive depoter ved `true` | 1 | 1 |
| Aktive depoter når feltet mangler | 1 | 1 |
| Node-tests | 183/183 i release-checkpointet | 185/185 |

De to nye regressionstests kontrollerer både konfigurationskontrakten og level
2-forløbet efter spillerens første basaldosis. `node --check js/simulator.js`
og `git diff --check` består også.

## Sub-agent input

Ingen sub-agent blev brugt til denne rettelse.

## Files cited

- `js/levels.js:334` - level 2-konfigurationen
- `js/simulator.js:895` - betinget oprettelse af startdepot
- `tests/simulation.test.js:842` - kontrakttest for `false`, `true` og manglende felt
- `tests/simulation.test.js:883` - level 2-test af spillerens første dosis
- `docs/reviews/2026-07-23_codex_full-physiology-updated-skill.md:71` - oprindeligt fund og status
