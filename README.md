# T1D Simulator

**Play it safe, before it really counts.**

T1D Simulator is an educational game for newly diagnosed Type 1 Diabetes patients. The player learns to manage blood glucose through insulin, food and exercise in a safe simulated environment with rapid feedback — no real-world consequences.

> **⚠️ Medical Disclaimer — see [below](#-license--disclaimer)**

## Try it

**[Play online](https://krauhe.github.io/t1d-simulator/)** — no installation required.

Or clone/download and open `index.html` in a browser. No server, no build step needed.

## What is simulated?

- **Glucose-insulin dynamics** based on [Hovorka et al. (2004)](https://doi.org/10.1109/TBME.2004.827938) — a clinically validated model from Cambridge
- **Carbohydrate absorption** with variable gastric emptying
- **Fat compartment model** — two-compartment (stomach → intestine) with CCK/GLP-1 feedback slowing carb absorption ("pizza effect")
- **Protein glucagon model** — amino acid absorption driving glucagon-stimulated hepatic glucose production via Hill function
- **Insulin pharmacokinetics** with subcutaneous depot, plasma and effect compartments
- **Four activity types** (cardio, strength training, mixed sport, relaxation) with distinct physiology
- **Stress hormones** (cortisol, adrenaline) with dawn phenomenon and Somogyi effect
- **Circadian ISF variation** — morning insulin resistance vs. evening sensitivity
- **CGM simulation** with realistic sensor delay, noise and drift
- **Ketone metabolism** and DKA progression during insulin deficiency
- **Hypoglycemia unawareness (HAAF)** — impaired counter-regulation after repeated hypos
- **Liver glycogen pool** — mass-balanced with glycogenolysis and replenishment
- **Sleep disruption** — nocturnal interventions increase next-day insulin resistance
- **Weight & calorie model** — energy balance with BMR scaling and exercise expenditure

## Screenshots

*(coming soon)*

## Tech stack

- Vanilla HTML / CSS / JavaScript — no frameworks, no build step
- [Tone.js](https://tonejs.github.io/) for sound effects (loaded from CDN)
- Hovorka 2004 ODE model (11 state variables) solved with Euler integration

## Documentation

- [Physiological model](docs/MODEL-IMPLEMENTATION.md) — How the simulator engine works (Hovorka 2004, insulin, exercise, stress hormones)
- [Scientific overview](docs/BG-SCIENCE.md) — All factors affecting blood sugar in T1D (25+ topics with references)
- [Fysiologisk model (dansk)](docs/MODEL-IMPLEMENTERING.da.md) | [Videnskabelig oversigt (dansk)](docs/BG-VIDENSKAB.da.md)
- [Automated tests](tests/simulation.test.js) — 57 unit tests, run with `node tests/simulation.test.js`
- [Visual model validation](tests/model-validation.html) — 17 test scenarios with plotted BG curves (open in browser)

## File structure

```
index.html          ← Open this in a browser
style.css           ← All styling
js/
  sounds.js         ← Sound effects (Tone.js)
  i18n.js           ← Internationalization (Danish/English)
  hovorka.js        ← Hovorka 2004 glucose-insulin ODE model
  simulator.js      ← Simulator class: physiology + game mechanics
  ui.js             ← Graph, UI updates, popups
  game.js           ← Game loop, start/reset/pause
  main.js           ← Event listeners, DOM references, init
docs/
  MODEL-IMPLEMENTATION.md     ← Technical model description (English, primary)
  BG-SCIENCE.md        ← Scientific background (English, primary)
  MODEL-IMPLEMENTERING.da.md   ← Danish translation of MODEL-IMPLEMENTATION.md
  BG-VIDENSKAB.da.md   ← Danish translation of BG-SCIENCE.md
  references/       ← Downloaded scientific articles
tests/
  simulation.test.js   ← Automated unit tests
  model-validation.html ← Visual model validation (browser)
```

## Credits

**Idea, design & physiological modelling**

Kristian R. Harreby — with AI-assisted research and implementation (Claude, Anthropic & Gemini, Google).

*Note: Source code and automated tests are primarily generated via AI and have not undergone a complete manual audit.*

**Core model**

- **[Hovorka et al. (2004)](https://doi.org/10.1109/TBME.2004.827938):** Glucose-insulin ODE model with 11 state variables — covers insulin pharmacokinetics, carbohydrate absorption, and glucose kinetics.
- **Open source foundation:** Inspired by [svelte-flask-hovorka-simulator](https://github.com/JonasNM/svelte-flask-hovorka-simulator) by Jonas Nordhassel Myhre.

**Model extensions** (Kristian R. Harreby, AI-assisted)

- **Exercise model:** Two extra compartments (E1/E2) with four activity types (cardio, strength, mixed, relaxation) — based on Resalat et al. 2020, Riddell et al. 2017.
- **Stress hormone system:** Acute stress (adrenaline/glucagon, t½ 60 min) and chronic stress (cortisol, t½ 12 hours) with automatic Somogyi response during hypoglycaemia.
- **Dawn phenomenon:** Circadian cortisol peak (04:00→08:00) increasing hepatic glucose production in the morning. Regenerates daily with individual variation.
- **Circadian ISF:** Diurnal variation in insulin sensitivity (0.70–1.20) — morning insulin resistance vs. evening sensitivity. Based on Toffanin 2013, Hinshaw 2013.
- **HAAF model:** Hypo unawareness based on accumulated hypoglycaemia burden. Repeated hypos progressively impair counter-regulation — based on Cryer 2013.
- **Ketone model:** Production during insulin deficiency, clearance with sufficient insulin. DKA progression with warnings.
- **Liver glycogen pool:** Mass-balanced (0–100 g) with consumption via glycogenolysis and replenishment via gluconeogenesis + food.
- **Sleep disruption:** Nocturnal interventions cost sleep → elevated chronic stress and amplified dawn effect next morning.
- **Weight & calorie model:** Energy balance with BMR scaling and exercise expenditure → weight change over time.
- **Fat compartment model:** Two-compartment (stomach → intestine) with dynamic gastric emptying. Intestinal fat triggers CCK/GLP-1 feedback slowing carb absorption (pizza effect). τG = 40 + 18×ln(1 + fatIntestine/10). Based on Smart 2013, Wolpert 2013.
- **Protein glucagon model:** Three-compartment amino acid absorption (stomach → gut → blood) driving glucagon-stimulated hepatic glucose production via Hill function. Replaces the old 25% carb-equivalent rule. Based on Paterson 2016, Fromentin 2013, Gannon 2013.

**Technologies**

- **Sound:** [Tone.js](https://tonejs.github.io/)
- **License:** [GNU General Public License v3 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html)

### Development Status & AI Disclosure

**This simulator is an experimental prototype.**

All design and architecture decisions are made by the project owner (Kristian R. Harreby). The codebase — including mathematical models, game logic and automated tests — is primarily generated using AI (Claude/Anthropic and Gemini/Google). Code is reviewed, tested and adapted by the project owner, but a line-by-line audit has not been performed.

The project includes 57 automated unit tests and 17 visual validation scenarios to verify physiological behaviour.

## ⚖️ License & Disclaimer

### License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify and redistribute this software under the terms of the GPLv3. Any derivative work must also be distributed under GPLv3.

Copyright © 2025–2026 Kristian R. Harreby

### Medical Disclaimer

**This software is NOT a medical device** as defined by the EU Medical Device Regulation (MDR 2017/745) or any equivalent regulation. It is an **educational simulator** developed for learning purposes only.

- **Do not** use this simulator to calculate insulin doses, adjust treatment plans, or make any clinical decisions.
- The physiological models are simplified approximations of human metabolism. They do not account for individual variation and are not validated for clinical use.
- **Always** consult your physician, endocrinologist, or diabetes care team before making changes to your diabetes management.
- The authors accept no liability for any harm resulting from the use or misuse of this software.

---

## Support the project

If T1D Simulator has been useful to you or your family, you can support further development via MobilePay:

[![Support via MobilePay](https://img.shields.io/badge/MobilePay-T1DSim-7B68EE?style=for-the-badge)](https://qr.mobilepay.dk/box/0946757d-b34b-4b1e-8302-f0a67fc49c69/pay-in)

All donations go towards hosting, scientific articles and continued development.
