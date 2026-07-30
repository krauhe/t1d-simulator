# Selvstændig fysiologi-engine med API (kombineret plan)

**Dato:** 2026-06-14
**Type:** Arkitekturplan
**Status:** Plan — ikke implementeret (afventer go til S0)
**Forfattere:** Codex (oprindelig plan) + Claude (review og udvidelse), samlet 2026-06-14
**Arbejdslog:** `docs/reviews/physiology-engine-LOG.md` — løbende fælles log på tværs af værktøjer og sessioner. Læs og opdatér den ved hver arbejds-session.
**Formål:** Gøre den fysiologiske model genbrugelig uden for det nuværende spil-UI, så den kan bruges til andre spil, model-laboratorier, scenarie-værksted og mere robuste tests.

> Denne fil er en fælles plan for både Claude Code og Codex. Skriv alt selvstændigt — ingen samtale-kontekst-afhængig tekst.

---

## Analyse

Den fysiologiske model er allerede delvist adskilt: `js/hovorka.js` er en relativt ren ODE-kerne, men den samlede model ligger i praksis i `js/simulator.js` (5983 linjer).

`Simulator` er i dag både:

- fysiologisk motor
- spiltilstand
- score, game-over og lives
- UI-logik
- lyd og popups
- graf-data producent
- campaign-interface
- test-target

Det betyder, at modellen kan kaldes udefra, men kun ved at mocke mange browser-globals. Konkret bekræftet i koden:

- **64 UI-koblinger** i `js/simulator.js` (`logEvent`, `playSound`, `document.getElementById`, `this.gameOver`, `speedSelector`).
- **Begge** testmiljøer betaler samme pris: `tests/model-validation.html` mocker ~70 DOM-navne via en `mockElement()`-fabrik + et dusin funktioner; `tests/simulation.test.js` (Node) gør det samme via `global.*`. Det er et tydeligt tegn på, at modellen bør have et rent API.

---

## Mål

Lav en selvstændig fysiologi-engine, som kan bruges af:

- det nuværende simulator-spil
- model-tests uden UI-mocks
- fremtidige laboratorier og grafværktøjer
- andre spil eller læringsværktøjer
- et senere scenarie-værksted, hvor mad, insulin og aktivitet kan flyttes rundt og genberegnes

Den nye engine skal kunne køre helt uden DOM, lyd, canvas, campaign, score eller browser-UI — og kunne `require()`'es i Node.

---

## Arbejds-setup: grene og sikkerhed

**Mekanisme: en almindelig git-gren — ingen worktree, ingen mappe-kopi.**

Projektet ligger i Dropbox og har ingen deployment (intet GitHub Pages, ingen CNAME, ingen workflow — spillet er rent lokalt: `index.html` åbnes i browser). En fysisk mappe-kopi eller worktree i samme Dropbox-mappe er en konflikt-fælde.

- **`main`** = det stabile, kørende spil. Røres ikke under arbejdet.
- **`physiology-engine`** = al refactor-arbejdet.

Begge AI-værktøjer (Claude + Codex) arbejder i **samme mappe på samme gren** (`git checkout physiology-engine`). Ingen sti-forvirring. At push'e `physiology-engine` rører aldrig `main`, så det stabile spil forbliver intakt indtil bevidst merge.

"Sammenlign at resultaterne er ens undervejs" løses ikke ved en kørende parallel-kopi, men ved golden-master-testen (se nedenfor) + bit-identisk tolerance-politik.

---

## Forudsætning: determinisme og seedet RNG (S0)

Dette er **det første skridt** og en forudsætning for alt det andet. Uden det kan output fra to kørsler aldrig sammenlignes — `js/simulator.js` har i dag **11 spredte `Math.random()`-kald** (CGM-systemisk drift/amplitude/støj, sensor-discontinuity, box-seed, fingerprick-fejl ±5%, ketone-test-fejl ±10%, Box-Muller for støj).

To distinkte begreber — de bygger oven på hinanden, de er ikke alternativer:

1. **Seedet RNG (fundament, obligatorisk):** Erstat alle `Math.random()` med ét injicerbart `this.rng()` (fx mulberry32/LCG). Tilfældigheden er stadig til stede (støj rasler stadig realistisk), men samme seed afspiller samme sekvens. Dette gør golden-master mulig: *samme profil + samme seed + samme input = bit-identisk output.*

2. **Ren/deterministisk mode (feature ovenpå, valgfrit):** Når al RNG går gennem ét sted, er det trivielt at tilbyde:
   - **fast seed** → reproducerbare kørsler (støj stadig til),
   - **støj helt fra** (`noiseEnabled: false`) → glat, ren fysiologisk kurve uden CGM-rasl, til lab-plots.

S0 ændrer **ikke** fysiologien — kun hvordan tilfældighed trækkes. Spillet skal opføre sig som før (visuelt uændret), men være reproducerbart med et seed. Det er en isoleret, selvstændig, commit-bar ændring.

---

## Sikkerhedsnet: golden-master regression

Mekanismen bag "resultaterne skal være ens undervejs":

1. **Frys reference fra `main`:** Med seedet RNG, kør den *nuværende* `Simulator` på et fast scenarie-sæt og gem de eksakte tidsserier (BG, trueBG, IOB, COB, ketoner, vægt) som **committet fixtur** (fx `tests/fixtures/golden-master/*.json`).
2. **Diff efter hvert skridt:** Efter hvert migrations-skridt, kør den nye engine på samme scenarier og sammenlign mod fixturen.

Scenarie-sættet (samme som risiko-listen nedenfor):

- basal steady state (24 t uden input)
- bolusrespons
- måltidsoptag (carb + fedt/protein)
- motion (aerob + anaerob)
- søvn og stress
- ketoner og DKA (insulinmangel)
- CGM-delay og støj
- campaign-start + almindelige spillerhandlinger

Dette kører i Node (`tests/.bin/node.exe`) og kan køres på hvert commit — mere pålideligt end at sammenligne to browser-vinduer med øjet.

---

## Tolerance-politik (vigtigt)

Skarpere end "accepter kun små numeriske forskelle":

- **Ren kode-flytning** (flyt funktion/state ned i engine uden at røre matematikken) → **tolerance = 0, bit-identisk.** Hvis output afviger, har du ved et uheld ændret noget. En "lille forskel" må aldrig accepteres tavst — den kan skjule en bug.
- **Bevidst model-ændring** (fx omarrangeret substep-rækkefølge) → epsilon-tolerance tilladt, men forskellen skal forklares i commit-beskeden og noteres i arbejdsloggen.

Dette er kritisk, fordi `update()` har meget specifik rækkefølge (se Risici). Bit-identisk golden-master fanger rækkefølge-fejl med det samme.

---

## Foreslået design

Tilføj en ny fil: `js/physiology-engine.js`.

Den eksporterer både som browser-global (no-build) og i Node:

```js
// Dual-export: browser-global + Node require()
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createEngine, PhysiologyEngine };
}
if (typeof window !== 'undefined') {
    window.T1DPhysiologyEngine = { createEngine, PhysiologyEngine };
}
```

`js/hovorka.js` bevares som ODE-kernen (får tilsvarende Node-export-shim, som den mangler i dag). Den nye engine bruger `HovorkaModel`, men ejer al fysiologi omkring den:

- mad, kulhydratoptag, protein og fedt
- insulin PK/PD, IOB og basal
- motion, muskelglykogen og aktivitetsfølsomhed
- stress, dawn, søvn og hyporespons
- CGM-delay, støj og drift
- ketoner, DKA-progression og insulinmangel
- glukotoksicitet, vægt og kalorie-model
- random variation via injicerbar/seedet RNG

**Engine ejer substep-opdelingen.** Konvertering fra vægur-sekunder → sim-minutter sker i facaden (`Simulator`); selve dt ≤ 1 min-substep-løkken bor i engine, fordi den er fysiologi. Facaden kalder `engine.step(simMinutes)`.

**Globals → constructor-options.** Engine må ikke læse globals. Konstanter som modellen i dag henter fra globalt scope skal blive til options/config. Startliste (fra mock-inventaret, suppleres ved fuld gennemgang i S0):

- `KCAL_PER_KG_WEIGHT`, `RESTING_KCAL_PER_DAY`, `RESTING_KCAL_PER_MINUTE` → engine-config
- `speedSelector.value` → forsvinder; bliver `step(minutes)`-argument
- `appSettings.bgUnit`, `I18N`, `t()`, `displayBG`, `bgUnitLabel` → bliver i facaden (UI/i18n, ikke fysiologi)
- `cgmDataPoints`, `trueBgPoints`, `physiologyDataPoints`, `MAX_GRAPH_POINTS_PER_DAY` → graf-historik, bliver i facaden/UI

---

## API

Minimum API for v1:

```js
const engine = T1DPhysiologyEngine.createEngine(profile, options);
// options: { seed, noiseEnabled = true, kcalPerKgWeight, restingKcalPerDay, ... }

engine.step(minutes);                 // returnerer { state, events } — se nedenfor

engine.addFood(foodEvent);
engine.addRapidInsulin({ units });
engine.addBasalInsulin({ units });
engine.startActivity({ type, intensity, durationMin });
engine.useGlucagon(options);

engine.getState();                    // numerisk kerne-state
engine.getPhysiologySnapshot();       // genbrug eksisterende shape fra simulator.js
engine.getFluxSnapshot();             // genbrug eksisterende shape

engine.exportState();
engine.importState(state);
```

Til model-tests og laboratorier:

```js
engine.setNoise(false);               // ren/glat signal (præcist defineret: noise off)
engine.setPlasmaInsulinClamp(valueOrNull);
engine.setBG(mmolL);
engine.runScenario(events, durationMinutes, stepMinutes);
```

> Determinisme: reproducerbarhed styres af `seed` i `createEngine`-options (fundament). `setNoise(false)`/`noiseEnabled` styrer om støj overhovedet påføres. Dette erstatter det vage `setDeterministic(true)` med to præcise, uafhængige knapper.

`step()` returnerer ikke bare ny BG, men også maskinlæsbare events:

```js
{
    state,
    events: [
        { type: 'hypo', severity: 'mild', data: {...} },
        { type: 'ketone-rise', severity: 'info', data: {...} }
    ]
}
```

Engine må aldrig selv kalde `logEvent`, `playSound`, `showPopup`, `t()`, `document`, `window`, `gameOver` eller UI-funktioner. **i18n bliver i facaden:** engine emitterer strukturerede events med rå data (`{type:'food', data:{carbs,protein,fat}}`); facaden bygger den lokaliserede log-streng. Engine taler kun mmol/L og rå tal.

---

## Hvad er fysiologi vs. spil (grænse-afgørelser)

Mønster: **engine beregner kontinuerte fysiologiske mængder og emitterer tærskel-events; facaden afgør hvad der er "game over", score og lyd.** Konkrete afgørelser for de tvetydige tilfælde i nuværende kode:

| Element | Engine (fysiologi) | Facade (spil) |
|---|---|---|
| Vægt-model (`weightChangeKg`, kalorie-balance) | beregner vægtændring | game-over-på-vægt-tjek |
| Glukotoksicitet / komplikationsrisiko | akkumulerer risiko | game-over-beslutning |
| DKA-progression | beregner ketoner/DKA-stadie, emitterer event | game-over-beslutning, popup |
| Hypo | beregner BG, emitterer `hypo`-event m. severity | lyd, popup, lives, game-over |
| HbA1c-estimat | beregner (afledt metrik i snapshot) | display |
| CGM vs. trueBG | leverer begge tal | ejer graf-historik-arrays |
| Box challenge (`_boxSeed`, boks-placering, lives) | — (rent spil) | alt |

`this.gameOver()` kaldes i dag direkte nede fra modellen (hypo, vægt, DKA, komplikationer, box). Disse erstattes af events; facaden oversætter til game-over.

---

## Migration i grønne commits

Hvert skridt er et selvstændigt commit hvor (a) spillet stadig virker og (b) golden-master består (bit-identisk for ren-flytning). Det giver de checkpoints "sammenlign undervejs" kræver.

- **S0 — Determinisme + golden-master.** Seedet RNG erstatter alle `Math.random()`. Fuld global-inventar færdiggøres. Generér og commit golden-master-fixturer fra `main`-fysiologien. Ingen fysiologi-ændring. (Forudsætning for alt.)
- **S1 — Engine-skelet + delegering.** Opret `js/physiology-engine.js` som ren model-adapter omkring eksisterende fysiologi. `Simulator` opretter internt `this.engine` og delegerer. Flyt først kun de mest selvstændige fysiologiske helpers. Bit-identisk.
- **S2 — Flyt model-state.** Flyt fysiologiske state-felter ind i engine; `Simulator` proxyer. Bit-identisk.
- **S3 — Side-effects → events.** Erstat direkte `logEvent`/`playSound`/`gameOver`/DOM-kald i fysiologien med event-emission; facaden oversætter (inkl. i18n). Bit-identisk for fysiologi; events verificeres.
- **S4 — Flyt graf-historik ud.** Engine leverer snapshots; `Simulator`/UI ejer `cgmDataPoints`, `trueBgPoints`, visuelle historikker.
- **S5 — Lab-API.** `exportState()`/`importState()`, `runScenario()`, `setNoise()`, `setBG()`, `setPlasmaInsulinClamp()`.
- **S6 — Tests + docs.** Ompeg `tests/model-validation.html`, `tests/simulation.test.js` og labs til engine direkte; fjern DOM-mocks for model-tests (behold gameplay-tests mod `Simulator`). Skriv `docs/MODEL-API.md` (events, state-format, seed/noise, scenarie-kørsel).

`Simulator` forbliver spillets offentlige facade gennem hele migrationen — UI, campaign og game loop taler stadig med `game`.

---

## Risici

Den største risiko er ikke selve API'et, men at `js/simulator.js` blander fysiologi og spilmekanik tæt sammen. En stor samlet omskrivning vil være risikabel. Den sikre strategi er derfor: først facade-design, derefter gradvis flytning, hele tiden golden-master-sammenligning.

**Højeste-risiko-zone — substep-rækkefølge.** `update()` har præcis, kommenteret rækkefølge der SKAL bevares ved flytning:

- Fedt/protein opdateres **før** `hovorka.step()` (påvirker τG, stress, ISF).
- Ketoner opdateres **efter** `hovorka.step()` (kræver opdateret plasmaInsulin).
- Stress-hormoner, muskelglykogen, glukagon kører **per substep** (dt ≤ 1 min), ikke per tick — bevidst valg (se `docs/reviews/2026-06-08_claude_model-implementation.md`, fund #1) så hypo-modregulering ikke bliver hastigheds-/hardware-afhængig.

**Skjulte global-reads.** Ud over de 64 grep-træf kan modellen læse globals indirekte. Fuld inventar i S0 er nødvendig — ellers dukker de op som runtime-fejl senere.

Det er særligt vigtigt at teste (se Testplan): basal steady state, bolusrespons, måltidsoptag, motion, søvn og stress, ketoner og DKA, CGM-delay og støj, campaign-start og almindelige spillerhandlinger.

---

## Testplan

**Golden-master regression (primær):**

- sammenlign nye engine-scenarier mod committede `main`-fixturer
- ren-flytning: bit-identisk (tolerance 0); bevidst ændring: forklaret epsilon

**Automatiske tests (engine direkte, ingen UI-mocks):**

- engine kan køre 24 timer basal uden UI
- samme profil + samme seed + samme input → identisk output
- bolus sænker BG inden for forventet ISF-område
- måltid øger COB og BG realistisk
- aktivitet ændrer insulinrespons og glukoseforbrug
- ketoner stiger ved insulinmangel
- `exportState()`/`importState()` giver reproducerbar fortsættelse
- `runScenario()` kan afvikle en hel dag med events

**Browser smoke test:**

- sandbox starter; mad, insulin og motion virker; grafen opdateres
- fysiologi-dashboard kan stadig læse snapshot
- campaign første bane starter
- model-validation kører uden store UI-mocks

---

## Antagelser

- Projektet beholder nuværende no-build arkitektur med almindelige script-tags.
- `Simulator` bevares som spillets offentlige facade gennem hele migrationen.
- Den nye engine er ren JavaScript uden DOM-afhængigheder, loadbar i både browser og Node.
- Ingen bagudkompatibilitet med gammel intern struktur kræves, men UI'et skal virke efter hvert skridt.
- Arbejdet sker på grenen `physiology-engine`; `main` holdes stabil.
- Implementering sker i separate opgaver, slice for slice, med go fra brugeren før hver (eller en aftalt flerstegs-kørsel). S0 er først.
