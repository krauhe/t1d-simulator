# Basal dose contract fix

**Dato:** 2026-07-22
**Type:** Beslutnings-doc for modelkontrakt og flerdøgnskalibrering
**Status:** ✅ FIKSET (lokale ændringer, ikke committet)
**Berørte områder:** fysiologimotor, Simulator-facade, bane 1, modeldokumentation og tests

## Bagrund

Det fysiologiske review 2026-07-21 fandt, at `basalDose` blev beregnet som det
effektive døgninput til Hovorka-modellen, mens en efterfølgende spillerinjektion
blev multipliceret med basalinsulinens faste biotilgængelighed på 0,82. Den skjulte
startdosis blev derimod skaleret med den inverse biotilgængelighed og gav derfor
korrekt steady state.

For standardprofilen betød det, at motoren fandt et effektivt behov på 13,48 U/døgn,
viste 13 U som spilledosis og kun sendte 10,66 U videre fra en ny spillerinjektion.
Bane 1's interval blev dermed bygget omkring en anden størrelse end den dosis,
spilleren faktisk skulle vælge.

## Diagnose

Den eksisterende steady-state-søgning returnerer en rate i mU/min. Omregningen
`rate x 1440 / 1000` er derfor det effektive insulininput pr. døgn, ikke den
subkutant injicerede dosis. Når basal-depotet anvender en fast biotilgængelighed
på 0,82, skal den injicerede mængde være større med faktoren `1 / 0,82`.

Den eksisterende værdi 0,82 er ikke ændret eller nykalibreret i dette fix. Fixet
gør alene en allerede anvendt parameter konsekvent på begge sider af API-kontrakten.

| Kropsprofil | Effektivt behov | Tidligere spilledosis | Korrekt injektionsbehov | Afrundet spilledosis |
|---|---:|---:|---:|---:|
| Barn, 40 kg | 5,95 U/døgn | 6 U | 7,25 U/døgn | 7 U |
| Voksen, 70 kg | 13,48 U/døgn | 13 U | 16,44 U/døgn | 16 U |
| Stor, 100 kg | 27,68 U/døgn | 28 U | 33,76 U/døgn | 34 U |

## Løsning

Motoren eksponerer nu tre adskilte størrelser:

```text
effectiveBasalRequirement = steadyStateBasalRate x 1440 / 1000
basalInjectionRequirement = effectiveBasalRequirement / sessionBioavBasal
basalDose                  = round(basalInjectionRequirement)
```

- `effectiveBasalRequirement` er det kontinuerlige modelinput efter absorption.
- `basalInjectionRequirement` er den kontinuerlige subkutane mængde før absorption.
- `basalDose` er den afrundede spilledosis, som kontroller, automatiske events og
  bane 1's interval bruger.

De skjulte start- og respawn-depoter er fortsat kalibreret direkte til den fundne
steady-state-rate. Deres fysiologiske starttilstand ændres derfor ikke af den nye
spilledosis.

## Verifikation

Et deterministisk bane 1-forløb blev kørt i 3 døgn uden dawn-effekt og med en ny
basaldosis kl. 08:00 hvert døgn. Tabellen viser slut-BG med den gamle og den nye
kontrakt; start-BG var 6,0 mmol/L.

| Kropsprofil | Gammel dosis og slut-BG | Ny dosis og BG-interval | Ny slut-BG |
|---|---:|---:|---:|
| Barn | 6 U, 9,51 mmol/L | 7 U, 3,54-6,88 mmol/L | 6,10 mmol/L |
| Voksen | 13 U, 9,94 mmol/L | 16 U, 3,54-6,70 mmol/L | 5,91 mmol/L |
| Stor | 28 U, 9,34 mmol/L | 34 U, 3,51-6,05 mmol/L | 5,29 mmol/L |

Den automatiske regression kræver nu, at alle tre profiler slutter mindre end
1,0 mmol/L fra steady-state-målet 5,5 mmol/L og forbliver i intervallet
3,5-7,0 mmol/L gennem det samme forløb.

### Brugervendt præsentation

De interne spilledoser 7, 16 og 34 E bevares, men vises ikke som anbefalinger.
Bane 1 viser i stedet et groft afprøvningsinterval knyttet til den valgte fiktive
karakter:

| Kropsprofil | Vist interval | Afrundingsgrænse |
|---|---:|---:|
| Barn | 5-10 E/dag | 5 E |
| Voksen | 10-20 E/dag | 10 E |
| Stor | 30-40 E/dag | 10 E |

Desktop og mobil deler nu `js/dose-controls.js`, så loft, preset-knapper og interval
beregnes ens. Mobilens præcise "Anbefalet"-tekst og dens direkte 100 %-knap er fjernet.
Eksempel på den nye tekst: "Afprøv i scenariet med Erik: 10-20 E/dag."

## Sub-agent input

Ingen sub-agenter blev brugt.

## Files cited

- `js/physiology-engine.js`: profilinitialisering, `initSteadyState()`, fast basal-biotilgængelighed og basal-depot.
- `js/simulator.js`: facade-proxyer samt skjult start- og respawn-depot.
- `js/campaign-core.js`: beregning af bane 1's afrundede basalinterval.
- `js/dose-controls.js`: fælles grove basalintervaller, lofter og preset-doser.
- `mobile/mobile.js` og `mobile/index.html`: mobilens karakterbaserede interval og fælles presets.
- `tests/simulation.test.js`: kontrakttest og deterministisk 3-døgnstest for de tre kropsprofiler.
- `tests/dose-controls.test.js`: regressionstest af de fælles brugervendte basalværdier.
- `docs/MODEL-IMPLEMENTATION.md`: basalprofil og den offentlige dosis-kontrakt.
- `docs/reviews/2026-07-21_codex_full-physiology-logical-consistency.md`: oprindeligt fund, ADVARSEL 4.
