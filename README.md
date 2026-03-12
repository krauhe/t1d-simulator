# T1D Simulator

**Play it safe, before it really counts.**

T1D Simulator er et uddannelsesspil for nydiagnosticerede type 1 diabetes-patienter. Spilleren styrer blodglukose via insulin, mad og motion i et sikkert simuleret miljø med hurtig feedback — uden risiko for rigtige konsekvenser.

> **⚠️ Medical Disclaimer / Medicinsk ansvarsfraskrivelse — see [below](#-license--disclaimer)**

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
- [Automatiserede tests](tests/simulation.test.js) — 47 tests, kør med `node tests/simulation.test.js`

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

### Development Status & AI Disclosure

**This simulator is an experimental prototype.**

- **AI-Generated Code:** The vast majority of the codebase, including the mathematical models and logic, has been generated using AI (primarily Claude/Anthropic and Gemini/Google).
- **Testing:** While the project includes automated tests (47 unit tests + 17 visual validation scenarios), these tests were also designed and implemented by AI.
- **Verification:** The code has not undergone a full manual audit or clinical validation. It should be treated as a "proof of concept" rather than a verified medical simulation.
- **Development Purpose:** This project is a study in using AI to build educational tools for Type 1 Diabetes (T1D). It is shared to encourage collaboration and further validation.

All design and architecture decisions are made by the project owner (Kristian R Harreby). AI-generated code is reviewed, tested and adapted by the project owner — but a line-by-line audit has not been performed.

## ⚖️ License & Disclaimer

### License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify and redistribute this software under the terms of the GPLv3. Any derivative work must also be distributed under GPLv3.

Copyright © 2026 Kristian R Harreby

### Medical Disclaimer (English)

**This software is NOT a medical device** as defined by the EU Medical Device Regulation (MDR 2017/745) or any equivalent regulation. It is an **educational simulator** developed for learning purposes only.

- **Do not** use this simulator to calculate insulin doses, adjust treatment plans, or make any clinical decisions.
- The physiological models are simplified approximations of human metabolism. They do not account for individual variation and are not validated for clinical use.
- **Always** consult your physician, endocrinologist, or diabetes care team before making changes to your diabetes management.
- The authors accept no liability for any harm resulting from the use or misuse of this software.

### Medicinsk ansvarsfraskrivelse (Dansk)

**Denne software er IKKE et medicinsk udstyr** som defineret i EU's Medical Device Regulation (MDR 2017/745) eller tilsvarende regulering. Den er en **uddannelsessimulator** udviklet udelukkende til undervisningsbrug.

- **Brug ikke** denne simulator til at beregne insulindoser, justere behandlingsplaner eller træffe kliniske beslutninger.
- De fysiologiske modeller er forenklede tilnærmelser af menneskets stofskifte. De tager ikke højde for individuel variation og er ikke valideret til klinisk brug.
- **Rådfør dig altid** med din læge, endokrinolog eller diabetesteam, før du ændrer i din behandling.
- Forfatterne påtager sig intet ansvar for skade som følge af brug eller misbrug af denne software.

---

## Støt projektet

Hvis T1D Simulator har været nyttigt for dig eller din familie, kan du støtte videreudviklingen via MobilePay:

**MobilePay Box: T1DSim — 5540MY**

[![Støt via MobilePay](https://img.shields.io/badge/MobilePay-T1DSim%20(5540MY)-7B68EE?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6Ii8+PC9zdmc+)](https://mobilepay.dk/box/5540MY)

Alle donationer går til hosting, videnskabelige artikler og videreudvikling.
