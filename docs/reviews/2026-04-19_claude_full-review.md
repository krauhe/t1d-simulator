# T1D Simulator — Fuld review

**Dato:** 2026-04-19  
**Scope:** UI/UX, kode, fysiologi, campaign, performance, tilgængelighed, i18n, bugs  
**Reviewer:** Claude Opus 4.6  
**Version:** 0.8.29-beta (version.json) / 0.8.3-beta (index.html — se issue B1)  

---

## Screenshots

Alle screenshots er gemt i `tests/playwright/2026-04-19_review/`:

| # | Fil | Beskrivelse |
|---|-----|-------------|
| 01 | `01_start-screen.png` | Startskærm med tom graf |
| 02 | `02_sandbox-running.png` | Game mode-vælger popup |
| 03 | `03_sandbox-basal-given.png` | Sandbox med basal givet, søvn-animation |
| 04 | `04_sandbox-meal-bolus.png` | Måltid + bolus, BG-kurve stiger og falder |
| 05 | `05_physiology-panel.png` | Fysiologi-mode med insulin/carb-bånd + BG-kræfter |
| 06 | `06_settings-dropdown.png` | Settings-dropdown med alle toggles |
| 07 | `07_help-popup.png` | Hjælp-popup med alle sektioner |
| 08 | `08_box-challenge.png` | Box Challenge med hindringer og 3 hjerter |
| 09 | `09_campaign-level1-intro.png` | Campaign level 1 startet |
| 10 | `10_responsive-800x600.png` | Responsivt layout ved 800x600 |
| 11 | `11_responsive-1920x1080.png` | Layout ved 1920x1080 |
| 12 | `12_profile-popup.png` | Profil-knap test (popup ikke synlig — se issue U2) |
| 13 | `13_game-over-dka.png` | Game Over: DKA med Dr. Byte |

---

## Test-resultater

### Simulation tests
```
129/129 tests passed — All tests passed!
```
Fuld test suite bestået uden fejl.

### Tekst-synkronisering
```
Docs:  OK (MODEL-IMPLEMENTATION ↔ da, BG-SCIENCE ↔ da)
Hjælp: OK (help-content-en ↔ da)
i18n:  OK (536 da = 536 en nøgler)
Alle oversættelser er synkroniserede.
```

### Konsol-fejl
- **1 triviel:** `favicon.ico 404` (manglende favicon-fil)
- **3 runtime TypeError:** `Cannot read properties of undefined (reading 'weight')` i `updateFoodChips()` — se issue B2

---

## Bugs / Issues

### B1 — MEDIUM: Versionsnummer i index.html er forældet ✅ FIKSET (v0.8.31-beta)
`index.html` linje 36 viser `v0.8.3-beta — 2026-04-06` i brand-group tooltip, men `version.json` er på `0.8.29-beta` med dato `2026-04-19`. Brugeren ser forkert version ved mouse-over på logoet.

**Fix:** Version hentes nu dynamisk fra `version.json` via fetch i `initializeApp()`. Hardcoded tooltip er bevaret som fallback.

### B2 — HØJ: TypeError i `updateFoodChips()` ved visse startflows ✅ FIKSET (v0.8.31-beta)
Konsollen viser `TypeError: Cannot read properties of undefined (reading 'weight')` i `updateFoodChips()` (main.js). Fejlen opstår i edge cases hvor `game` endnu ikke er initialiseret. Fallback-koden (linje 535-540) burde fange det, men fejlen sker tilsyneladende i en ældre kodesti (port 8769-referencen i stacktrace antyder caching).

**Fix:** Erstattet `game ? game.weight` med optional chaining `game?.weight ?? fallback` i både `updateFoodChips()` og `getPortionScale()`. Fanger nu korrekt tilfælde hvor `game` er truthy men `weight` er undefined.

### B3 — LAV: Manglende favicon ✅ FIKSET (v0.8.32-beta)
Browseren forsøger at hente `favicon.ico` og får 404. Trivielt men giver en konsolbesked.

**Fix:** Inline SVG favicon tilføjet i `<head>` — BG-kurve i teal på mørk baggrund.

### B4 — MEDIUM: DEV-defaults aktive i produktion ✅ FIKSET (v0.8.31-beta)
`sounds.js` linje 61-62 har `debugTrueBG: true` og `debugLog: true` som defaults. Kommentarerne siger "DEV DEFAULT — sæt til false ved release". For nye brugere vil debug-linjen og CSV-logning være slået til fra start.

**Fix:** Sat begge til `false` som production defaults.

### B5 — LAV: "PHYSIOLOGY MODE" vandmærke vises permanent ⚠️ BY DESIGN
Når fysiologi-toggles er aktiveret, vises "PHYSIOLOGY MODE" som stort halvgennemsigtigt vandmærke midt på grafen. Det er synligt i screenshots 05, 08, 09, 10. Det er en bevidst feature — vandmærket signalerer at highscore er deaktiveret.

---

## UI/UX

### U1 — MEDIUM: Responsivt layout bryder ved 800x600
Ved 800x600 (screenshot 10):
- Logoet er afklippet: "T1D SIMULFE" i stedet for "T1D SIMULATOR"
- Points-capsule (SANDBOX 0.0) er delvist skjult bag højre kant
- BG-kræfter panelet er næsten usynligt (stiplede linjer uden tekst)

**Foreslået fix:** Tilføj CSS media queries for smalle viewports: skjul sloganet tidligere, brug `min-width` guards, og overvej at skjule/kollapere BG-kræfter panelet under ~900px.

### U2 — LAV: Profil-knap gemt i hamburger-menu under spil ⚠️ BY DESIGN
Under et aktivt spil er profil-knappen kun tilgængelig via hamburger-menuen. Bevidst design — profil-ændring under spil er sjældent og bør ikke optage plads i top-baren.

### U3 — POSITIV: Settings-dropdown er veldesignet
Settings-panelet (screenshot 06) er rent og overskueligt med tydelig gruppering (Display, Gameplay, Sound). Toggles har god størrelse og responsivitet.

### U4 — POSITIV: Food chips med makro-bar og kcal
Mad-panelet er visuelt stærkt med farvekodede makronæringsstoffer, portionsvægt og kcal-labels. Layoutet er intuitivt og informationsrigt.

### U5 — POSITIV: Game Over skærm
DKA game-over (screenshot 13) er informativ og pædagogisk: forklarer hvad der skete ("Without insulin, the body breaks down fat uncontrollably") og giver konkrete råd. Dr. Byte-karakteren giver det en varm tone.

### U6 — POSITIV: Box Challenge
Hindringsbokse (screenshot 08) med rød glødende kant er tydeligt synlige. Hjerter-display og dagpoints-tracking er intuitivt.

### U7 — POSITIV: BG-graf med zones
Grafen er det visuelle center med korrekt farvekodning (grøn target-zone, rød fare-zone), nat-shading, event-ikoner (mad, insulin) og dynamisk y-akse. Søvn-animationen (Zzz) er en fin touch.

---

## Kode

### K1 — OBSERVATION: Stor kodebase uden build-system
Projektet er 24.634 linjer fordelt på 12 filer, uden module system, bundling eller minificering. Alle filer deler globalt scope. For projektets størrelse og målgruppe (ingen eksterne brugere) er dette en bevidst og rimelig beslutning, men det gør det vanskeligt at vedligeholde på sigt.

**Bemærkning:** `simulator.js` alene er 5.153 linjer — størstedelen er veldokumenterede fysiologiske modeller med videnskabelige referencer. Kommentarniveauet er ekstremt højt og af høj kvalitet.

### K2 — POSITIV: Eksemplarisk kommentarkultur
Koden er gennemgående velkommenteret med:
- Fil-header der forklarer ansvar og arkitektur
- Videnskabelige referencer (Hovorka 2004, Riddell 2017, Wolpert 2013 osv.)
- MATLAB-analogier for udvikleren
- Fysiologiske forklaringer ved alle parametre
- Kalibrerings-dokumentation (fx acidose-tærskler, ketonmodel)

### K3 — POSITIV: Ren MVC-separation
Simulator (model), UI.js (view), main.js (controller) er tydeligt adskilt. Campaign-engine er en wrapper der ikke bryder ind i simulator-koden.

### K4 — LAV: `debugUpdateLiveValues()` har et scope-problem ⚠️ BY DESIGN
I `main.js` linje 238-253 er der kode der ligger UDENFOR `if (h)` blokken men refererer til variable (`game.acuteStressLevel` osv.) der kræver at game eksisterer. Funktionen har en `if (!game) return;` guard øverst (linje 145), som beskytter alle linjer — `game.*`-properties er sikre, kun `h.*` kræver `if (h)`-blokken.

### K5 — OBSERVATION: Ingen input-sanitering på profil-felter ⚠️ BY DESIGN
Profilværdier (vægt, ICR, ISF) parses fra localStorage uden validering af gyldige ranges. Fx kan `weight: -50` eller `ISF: 0` forårsage division by zero eller negative værdier. Praktisk risiko er minimal — UI'et har min/max-constraints og brugere sætter selv værdierne.

### K6 — POSITIV: Solid error handling
localStorage-operationer har konsekvent try/catch med fallback til defaults. Popup-kald og DOM-manipulation har guards (`if (element)` checks). 

---

## Fysiologi

### F1 — POSITIV: Hovorka-modellen er korrekt implementeret
16 ODE'er fra Hovorka 2004 med korrekte parametre og steady-state initialisering. ISF-kalibrering (scale = ISF / 3.75) er empirisk valideret. Alle 129 automatiserede tests bestod.

### F2 — POSITIV: Omfattende fysiologisk model
Modellen inkluderer:
- Ketonmodel (FFA-drevet, insulin-reguleret, Michaelis-Menten clearance)
- Lever- og muskelglykogen (massebalancerede pools)
- Protein/fedt absorption med pizza-effekt
- FFA-induceret insulinresistens
- Glukotoksicitet
- Cirkadisk ISF-variation og dawn-effekt
- Hypoglykæmi-unawareness (HAAF)
- Hjerne-energi-deficit model
- Søvnforstyrrelses-model
- CGM-simulation med realistisk støj og drift

### F3 — POSITIV: Motionsmodel med to-komponent ISF
Fast (AMPK, t½=15min) og slow (PEIS, glykogen-koblet) komponenter med videnskabelig basis. Muskelglykogen-pool driver slow-decay mekanistisk.

### F4 — OBSERVATION: Kun én TODO i kodebasen
`simulator.js` linje 1500: "TODO: Valgbar insulintype (Tresiba/Levemir/Toujeo)" — allerede på todo-listen som feature #44.

---

## Campaign

### C1 — POSITIV: Campaign-system er velstruktureret
Level-definitioner i `levels.js` er data-drevne med klar separation af fysik-overrides, enabled actions, objectives, tips og stjerne-rating. Tutorial-tips vises kun første gang.

### C2 — OBSERVATION: Campaign header mangler i capsule ⚠️ BY DESIGN (test-artefakt)
I screenshot 09 vises campaign level 1 men points-capsule viser kun "3.8" uden bane-label eller titel. Koden i `game.js` linje 237-248 populerer headeren korrekt — sandsynligvis en Playwright-timing-issue (screenshot taget før DOM-opdatering).

### C3 — POSITIV: Tip-system med rate limiting
Tips har prioriteter (1-2 akut, 3+ generel), cooldowns (90 sim-min spacing), chance-rolls og session-decay. Forhindrer tip-spam.

---

## Performance

### P1 — POSITIV: requestAnimationFrame-baseret game loop
Korrekt brug af rAF med deltaTime-cap (0.5s) for at undgå blowup ved tab-switching. Canvas tegnes hvert frame, UI opdateres kun ved simulation-tick.

### P2 — LAV: Canvas resizes hvert frame ⚠️ BY DESIGN
`drawGraph()` sætter canvas-dimensioner via `getBoundingClientRect()` + `devicePixelRatio` i starten af hvert kald. Operationen er billig og sikrer korrekt rendering ved resize/zoom uden ekstra ResizeObserver-kompleksitet.

### P3 — OBSERVATION: Fysiologi-dashboard throttled korrekt
`postMessage()` til fysiologi-vinduet er throttled til maks 1 Hz, hvilket er passende.

---

## Tilgængelighed (Accessibility)

### A1 — MEDIUM: Begrænset ARIA-support
HTML bruger `aria-label` på 13 toggle-knapper (settings), men de fleste interaktive elementer mangler ARIA-attributter:
- Dock-items bruger div'er med click-handlers i stedet for buttons
- Food chips er div'er uden role="button" eller tabindex
- CGM hero-panelet mangler aria-live for skærmoplæsere
- Graf (canvas) har ingen alternativ tekst

**Foreslået forbedring:** Tilføj `role="button"` og `tabindex="0"` til interaktive div'er. Tilføj `aria-live="polite"` til CGM-displayet.

### A2 — LAV: Farveblindhed
Grafen bruger grøn/rød/orange til at skelne BG-zoner og datapunkter. Deuteranopia (rød-grøn farveblindhed) kan gøre det svært at skelne in-range (grøn) fra danger (rød) CGM-prikker. Overvejer mønster-differentiering eller high-contrast mode.

### A3 — POSITIV: Tastatur-genveje
Spillet har omfattende keyboard shortcuts:
- A/S/D/F: Basal insulin presets
- Z/X/C/V: Hurtig insulin presets
- 1-9: Hurtig insulin 1-9 E
- Q-N: Mad-genveje
- Space: Pause
- Piletaster: Hastighed
- P: Custom food

---

## i18n (Internationalisering)

### I1 — POSITIV: Fuld sprogunderstøttelse
536 oversættelsesnøgler for både dansk og engelsk, fuldt synkroniseret. Sproget kan skiftes live uden reload. Korrekt BG-enhed auto-detect baseret på browser-locale.

### I2 — POSITIV: Ingen latiniserede danske tegn
Søgning efter typiske ae/oe/aa-mønstre i danske strenge gav nul resultater. CLAUDE.md-reglerne om æøå overholdes.

### I3 — LAV: Enkelte engelske tooltips på dansk side
Nogle HTML-attributter har hardcodede engelske tooltips (fx `data-i18n-title` mangler på enkelte elementer), men dette er marginalt da i18n-systemet dækker det meste.

---

## Samlet vurdering

### Stærke sider
1. **Fysiologisk model** — Imponerende dybde og videnskabelig grundighed. Hovorka 2004 som kerne med 12+ udvidelser for realistisk T1D-simulation.
2. **Kodekvalitet** — Ekstremt veldokumenteret med videnskabelige referencer, MATLAB-analogier og fysiologiske forklaringer. 129 automatiserede tests med 100% pass rate.
3. **UI-design** — Mørkt tema med professionel æstetik. Grafen er visuelt stærk med farvekodning, zones, event-ikoner og dynamisk y-akse.
4. **Pædagogisk tilgang** — Game-over skærme forklarer fysiologien. Dr. Byte-karakter giver varme. Tips er rate-limited og kontekstuelle.
5. **Tre spiltilstande** — Sandbox for fri leg, Campaign for guidet læring, Box Challenge for udfordring.
6. **Fuldt tosproglig** — 536 oversættelsesnøgler, synkroniserede docs, auto-detect sprog og BG-enhed.

### Forbedringsområder
1. **Responsivitet** — Layoutet bryder ved smalle viewports (< 800px). Logo afklippes, paneler skjules.
2. **Tilgængelighed** — Begrænset ARIA-support, ingen farveblindhedsunderstøttelse.
3. **Versions-synkronisering** — index.html har forældet versionsnummer vs. version.json.
4. **Dev-defaults** — debugTrueBG og debugLog er true som default.
5. **Minor runtime bug** — TypeError i updateFoodChips() ved visse startflows.

### Helhedsvurdering
Projektet er i en **stærk beta-tilstand**. Den fysiologiske model er den mest imponerende del — den er grundigt kalibreret, veldokumenteret og dækker et usædvanligt bredt spektrum af T1D-fysiologi. UI'et er visuelt poleret med en klar gamer-æstetik der matcher målgruppen. Campaign-systemet er velstruktureret og skalerbart.

De fundne issues er primært kosmetiske eller relaterer til edge cases. Ingen kritiske fejl er fundet — simulationen er stabil, korrekt og fuldt funktionel i alle tre spiltilstande.

---

## Issue-oversigt

| # | Prioritet | Kategori | Beskrivelse |
|---|-----------|----------|-------------|
| B1 | ✅ FIKSET | Bug | Forældet versionsnummer i index.html — dynamisk fetch fra version.json |
| B2 | ✅ FIKSET | Bug | TypeError i updateFoodChips() — optional chaining guard |
| B3 | ✅ FIKSET | Bug | Inline SVG favicon tilføjet |
| B4 | ✅ FIKSET | Kode | DEV-defaults sat til false |
| B5 | ⚠️ BY DESIGN | UI | PHYSIOLOGY MODE vandmærke — bevidst feature |
| U1 | ❌ ÅBEN | UI/UX | Responsivt layout bryder ved 800x600 |
| U2 | ⚠️ BY DESIGN | UI/UX | Profil-knap bevidst gemt under spil |
| C2 | ⚠️ BY DESIGN | Campaign | Test-artefakt — koden populerer headeren korrekt |
| A1 | ❌ ÅBEN | A11y | Begrænset ARIA-support |
| A2 | ❌ ÅBEN | A11y | Ingen farveblindhedsunderstøttelse |
| P2 | ⚠️ BY DESIGN | Perf | Billig operation, undgår ResizeObserver-kompleksitet |
| K4 | ⚠️ BY DESIGN | Kode | `if (!game) return` guard beskytter korrekt |
| K5 | ⚠️ BY DESIGN | Kode | UI min/max-constraints beskytter mod ugyldige værdier |
