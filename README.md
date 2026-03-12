# T1D Simulator

**Play it safe, before it really counts.**

T1D Simulator er et uddannelsesspil for nydiagnosticerede type 1 diabetes-patienter. Spilleren styrer blodglukose via insulin, mad og motion i et sikkert simuleret miljø med hurtig feedback — uden risiko for rigtige konsekvenser.

> **Disclaimer:** T1D Simulator er et uddannelsesværktøj — IKKE et medicinsk device. Brug aldrig simulatoren som grundlag for medicinske beslutninger. Følg altid din læges anbefalinger.

## Prøv det

Åbn `index.html` i en browser. Ingen installation, ingen server, ingen build-trin.

Eller besøg den hostede version: [t1d-simulator](https://krauhe.github.io/t1d-simulator/) *(kommer snart)*

## Hvad simuleres?

- **Glukose-insulin-dynamik** baseret på Hovorka et al. (2004) — en klinisk valideret model fra Cambridge
- **Kulhydratabsorption** med variabel mavetømning
- **Insulinfarmakokinetik** med subkutant depot, plasma og effektkompartment
- **Fire aktivitetstyper** (cardio, styrketræning, blandet sport, afslapning) med distinkt fysiologi
- **Stresshormoner** (kortisol, adrenalin) med dawn-fænomen og Somogyi-effekt
- **CGM-simulation** med realistisk sensor-forsinkelse, støj og drift
- **Ketonstofskifte** og DKA-progression ved insulinmangel
- **Hypoglykæmi-unawareness (HAAF)** — svækket kontraregulering ved gentagne hypoer

## Screenshots

*(kommer snart)*

## Tech stack

- Vanilla HTML / CSS / JavaScript — ingen frameworks, ingen dependencies
- [Tone.js](https://tonejs.github.io/) til lydeffekter (loaded fra CDN)
- Hovorka 2004 ODE-model (11 tilstandsvariable) løst med Euler-integration

## Dokumentation

- [Fysiologisk model](docs/FYSIOLOGI.md) — Hvordan simulatorens motor virker
- [Videnskabelig oversigt](docs/VIDENSKAB.md) — Alle faktorer der påvirker blodsukker ved T1D (25+ emner med referencer)
- [Automatiserede tests](tests/simulation.test.js) — 42 tests, kør med `node tests/simulation.test.js`

## Fil-struktur

```
index.html          ← Åbn denne i en browser
style.css           ← Al styling
js/
  sounds.js         ← Lydeffekter (Tone.js)
  hovorka.js        ← Hovorka 2004 glukose-insulin ODE-model
  simulator.js      ← Simulator-klasse: fysiologi + spilmekanik
  ui.js             ← Graf, UI-opdatering, popups
  game.js           ← Game loop, start/reset/pause
  main.js           ← Event listeners, DOM-referencer, init
docs/
  FYSIOLOGI.md      ← Teknisk modelbeskrivelse
  VIDENSKAB.md      ← Videnskabelig baggrund (alle BG-faktorer)
  references/       ← Downloadede videnskabelige artikler
tests/
  simulation.test.js ← Automatiserede enhedstests
```

## Credits

- **Idé, design og projektledelse:** Kristian R Harreby
- **Implementering:** Kristian R Harreby med assistance fra AI-værktøjer (Claude/Anthropic, Gemini/Google)
- **Fysiologisk model:** Baseret på [Hovorka et al. (2004)](https://doi.org/10.1109/TBME.2004.827938), udvidet med motionsmodel fra [Resalat et al. (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7449052/)
- **Inspiration:** [svelte-flask-hovorka-simulator](https://github.com/JonasNM/svelte-flask-hovorka-simulator) af Jonas Nordhassel Myhre
- **Lydeffekter:** [Tone.js](https://tonejs.github.io/)

### Om AI-assistance

Dette projekt er udviklet af et menneske (Kristian R Harreby) med brug af AI som udviklingsværktøj. AI (primært Claude fra Anthropic og Gemini fra Google) er brugt til kodegenerering, fysiologisk research og dokumentation — på samme måde som man bruger en IDE, en compiler eller Stack Overflow. Alle design- og arkitekturbeslutninger er taget af projektejeren. AI-genereret kode er gennemgået, testet og tilpasset af projektejeren.

## Licens

[MIT License](LICENSE)

## Støt projektet

Hvis T1D Simulator har været nyttigt for dig eller din familie, kan du støtte videreudviklingen via MobilePay:

**MobilePay Box: T1DSim — 5540MY**

[![Støt via MobilePay](https://img.shields.io/badge/MobilePay-T1DSim%20(5540MY)-7B68EE?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6Ii8+PC9zdmc+)](https://mobilepay.dk/box/5540MY)

Alle donationer går til hosting, videnskabelige artikler og videreudvikling.
