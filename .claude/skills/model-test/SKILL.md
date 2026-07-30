---
name: model-test
description: >
  Tilføj et komplet, konsistent test-batteri til tests/model-validation.html
  for en fysiologisk model i T1D-simulatoren. Brug denne skill når brugeren
  beder om at "lave model tests for X", "tilføje tests for [model]",
  "teste [fænomen] i model validation", eller når en nyligt tilføjet
  fysiologisk model mangler validerings-tests. Skillen sikrer ens varighed,
  y-akser, farver, tids-akse-mærkning og gruppering på tværs af tests, og
  tilføjer nødvendige `phys.<X>Enabled`-flags i js/simulator.js så test kan
  isolere ét fænomen ad gangen. Skillen kører kun manuelt (brugeren beder
  eksplicit om det) — ikke proaktivt.
---

# Model-test — Skill for konsistente fysiologi-tests

Du tilføjer test-batterier til `tests/model-validation.html`. Målet er at hver
fysiologisk model i simulatoren får et komplet, sammenligneligt sæt tests der
ser konsistente ud og kører på en kendt skala.

Denne skill **kører kun manuelt** når brugeren beder om det. Den foreslår ikke
proaktivt nye tests.

---

## Forhold til andre skills

- **`model-test` (denne)**: Tilføjer/redigerer tests i `tests/model-validation.html`. Visualisering, struktur, gruppering, isolerings-flags.
- **`science-reviewer`**: Litteratur-research for `docs/BG-SCIENCE.md`. Bruges som vidensbase for hvilke tal en test skal kalibreres mod.
- **`t1d-physiology-reviewer`** / **`review`**: Reviewer modellen og dens implementering. Skill'en her bruges typisk i forlængelse — først reviewer, så tests.

---

## TRIN 0 — DISCOVERY

Før du foreslår nogen tests, læs:

1. **Modellens kode** i `js/simulator.js` og evt. `js/hovorka.js` — hvor er den implementeret, hvilke state-variable og getters har den, hvilke parametre kan brugeren se?
2. **`docs/MODEL-IMPLEMENTATION.md`** — er der allerede dokumenteret hvilke kalibreringspunkter modellen skal ramme?
3. **`docs/BG-SCIENCE.md`** — kvantitativ litteratur for fænomenet (tidskonstanter, EC50, plateau-værdier).
4. **Eksisterende kapitler i `tests/model-validation.html`** — er der allerede tests der berører fænomenet? Skal den nye gruppe ind i et eksisterende kapitel, eller fortjener den et nyt?
5. **Hvilke `phys.<X>Enabled`-flags findes allerede?** Grep `js/simulator.js` for `Enabled` og se hvad der kan slås fra. Eksisterende kendte: `dawnEffectEnabled`, `weightTrackingEnabled`.

Identificér:

- Hvad er modellens **karakteristiske dynamik**? (Akut respons inden for timer? Plateau over døgn? Akkumulering ved gentagne events?)
- Hvilken **graf-template** passer? (24h med klokketid? 72h med timer-fra-start? Egen skala?)
- Hvilke **andre fænomener** kan forstyrre og bør slås fra under testen? (Døgnvariation, stress, dawn, glykogen-dynamik, ketoner...)
- Findes der allerede et flag for hver af de fænomener du vil slå fra? Hvis ikke — skal du tilføje dem.

---

## TRIN 1 — FORESLÅ TEST-BATTERIET (vent på godkendelse)

Skriv en kort plan til brugeren med:

1. Foreslået kapitel-titel (hvis nyt) eller hvor de føjes ind.
2. Liste over tests (titel + 1-linje formål for hver).
3. Valgt graf-template (24h klokketid / 72h timer-fra-start / afvigelse + begrundelse).
4. Hvilke `phys.*Enabled`-flags der mangler og skal tilføjes.
5. Hvilke litteratur-kilder kalibreringen baseres på.

**Pre-draft IKKE kode-blokken.** Bare planen. Vent på "go" / "gør det" / imperativt godkendelse-signal (per CLAUDE.md-reglen).

---

## TRIN 2 — STANDARD TEST-BATTERI

Hver model skal som udgangspunkt have **4-6 tests** i denne rækkefølge inden
for sit eget kapitel (afvig kun hvis modellen ikke understøtter alle typer):

1. **Baseline** — model OFF (eller min. aktivering). Etablerer null-hypothesis: intet sker når fænomenet ikke er aktivt.
2. **Single typical event** — ét realistisk input mod en konkret litteratur-værdi (kalibrerings-punkt).
3. **Dosis-/intensitets-respons** — 3-5 niveauer af samme intervention. Bruger tone-gradient af samme base-farve (mørk → lys).
4. **Long-term plateau** — kun hvis modellen kan akkumulere eller stabilisere. Kør altid 72h.
5. **Edge case** — max-dose, fjern modstand, ekstrem brugsmønster, failure mode.
6. **Interaktions-test** — kun hvis modellen kobler målbart med anden eksisterende fysiologi.

Punkterne 1-3 skal **altid** med. 4-6 tilføjes hvis relevant for modellen.

---

## TRIN 3 — VISUALISERINGS-REGLER (strikt)

### Graf-templates — vælg ÉN per gruppe

| Template | Varighed | X-akse | BG y-max | BHB y-max | Bruges til |
|----------|----------|--------|----------|-----------|------------|
| **24h** (`acute`/`daily`) | 24h | Klokketid (HH:00) — `xRange < 36*60` trigger | 16 | 4 | Single intervention, dose-response, dawn, post-prandial |
| **72h** (`multi-day`) | 72h | Timer fra start (0h, 12h, 24h...) | 16 | 4 | Plateau, fasting, low-carb, accumulation |
| **Custom (afvigelse)** | — | — | Højere | Højere | Kun ved klar grund (fx DKA der går over standard-skalaen) |

**Skift ikke template midt i et kapitel** — alle tests i samme gruppe SKAL have samme varighed og samme y-akse. Hvis én test i gruppen kræver afvigelse, isoler den til slutningen af kapitlet OG kommentér i koden hvorfor (som G.6 gør i forhold til G.1-G.5).

### X-akse-tekst i intro — OBLIGATORISK

Intro-teksten i hver test skal eksplicit nævne hvilken x-akse der bruges:

- 24h-tests: skriv fx _"X-axis shows clock time (start at 07:00, end at 07:00 next day)"_.
- 72h-tests: skriv fx _"X-axis shows hours from sim start (0h = 08:00 day 1)"_.

Læseren skal ikke gætte. (Konventionen `useClockTime = xRange < 36*60` er hardcoded i `drawDualAxisChart`.)

### X-akse-label (xLabel-opts) — OBLIGATORISK

Hver `drawChart`/`drawDualAxisChart`-kald skal sætte `xLabel` så aksen er selv-forklarende:

| Scenario | xLabel-værdi |
|----------|--------------|
| Klokketid, ≤24h (`xIsClockTime` default true) | `'Time of Day'` |
| Multi-day (>36h, falder tilbage på relativ visning i `drawDualAxisChart`) | `'Hours after start'` |
| Relativ tid efter event (`xIsClockTime: false`), vindue ≥ 3h | `'Hours after intervention'` |
| Relativ tid efter event, kort vindue (< 3h) | `'Minutes after intervention'` |

"Intervention" kan erstattes af et mere specifikt ord når det er klart hvilken event x-aksen er relativ til, fx `'Minutes after injection'` eller `'Hours after meal'`. Standard er `intervention` når der ikke er én tydelig event.

### Farve-konvention

- BG-serier: grøn `#22c55e`
- BHB: orange `#f97316`
- Insulin (bolus): blå `#3b82f6`
- Insulin (basal): mørk blå `#1e40af`
- Kulhydrater: amber `#f59e0b`
- Fedt: warm brown `#a16207`
- Protein: lilla `#a855f7`
- Stresshormoner: rød `#dc2626`
- Andre nye modeller: vælg én unik base og dokumentér valget i kapitel-kommentaren.

### Dosis-/intensitets-tone-gradient

Når en test viser flere niveauer af SAMME intervention (3-5 serier),
brug samme base-farve med kontinuert tone-variation fra mørk til lys.

Hjælpefunktionen `toneGradient(baseHex, n)` findes i `tests/model-validation.html`. Konvention:
**i=0 = lyseste, i=n-1 = mørkeste**. Dvs. tildel `colors[i]` til dosis-array i stigende
rækkefølge, så lille dosis bliver lys og stor dosis bliver mørk. Det matcher det
intuitive "mere = mørkere" (intens dose).

Brug den fx sådan:

```js
const doses = [2, 4, 6, 8, 10];
const colors = toneGradient('#3b82f6', doses.length);
const series = doses.map((d, i) => ({ label: `${d} U`, data: results[i], color: colors[i] }));
```

### Layout-konventioner (side-niveau)

Disse er fastlagt i `tests/model-validation.html`'s CSS og `addChapter`/`addSection`
helpers. Skill'en skal **ikke** ændre dem, men de er dokumenteret her som
referenceramme — så nye tests/kapitler følger samme look:

- **Body-bredde begrænset til ~880px** (`body { max-width: 880px; margin: 0 auto }`)
  så canvas + vertikal legend lige passer side-om-side (600 + 16 + 200 ≈ 820px
  content area). Tekst-paragraffer wrapper i samme bredde og forbliver læsbare
  på store skærme.
- **Legend STÅR TIL HØJRE for grafen som en VERTIKAL liste** (ikke under,
  ikke over). Implementeret via `.chart-row { display: flex }` der wrapper
  `<canvas>` + `<div class="legend-column">` (hvor legend-column indeholder
  legend øverst og conditions-blokken nederst). Hver legend-row har en
  SVG-linje der rendrer den FAKTISKE stroke-dasharray fra series-konfig —
  så solid/dashed/dotted i legenden visuelt matcher kurverne. På skærme
  < 760px wrappes legend-column under canvas via media-query (horisontal
  liste, som original). `buildLegend()` håndterer SVG-generering — kald den
  med samme series-array som du sender til `drawChart`/`drawDualAxisChart`.

- **Conditions-blok UNDER legenden (samme højre-kolonne)**: standardiseret
  beskrivelse af test-tilstande. Hver test får automatisk en linje a la
  `SIMULATION: Whole model · Deterministic` hvis testen ikke selv sætter
  conditions. testFn'en modtager `conditionsDiv` som 5. arg — override ved
  at sætte `conditionsDiv.innerHTML = simulationConditions([...])`.

  **Standard-fraser** (brug disse formuleringer, så test-læseren ikke skal
  parse fri-form tekst):
  - `'Whole model'` — ingen `phys.*Enabled = false`
  - `'Disabled: dawn'` / `'Disabled: stress'` / `'Disabled: glucotoxicity'` etc. — pr. flag der er slået fra
  - `'Deterministic'` — createSim default (gaussRand fixed)
  - `'Stochastic'` — gaussRand restored (typisk kun Kapitel H)
  - `'Stochastic (full constructor)'` — `new Simulator()` direkte uden createSim's overrides
  - `'BG clamped at X.X'` — clampBG() brugt i setup
  - `'Basal pre-injected (X U, -Yh)'` — addLongInsulin før observation
  - `'Scheduled meals + daily basal'` — runSchedule med måltider og re-injektioner
  - `'No bolus'` — ingen addFastInsulin
  - `'No food'` — ingen addFood (faste)
  - `'Pump failure at hour X'` — al insulin cleared midt i simulationen
  - `'Pre-set glycogen: X g'` — manuel `sim.liverGlycogenGrams = X`

  Eksempel: `simulationConditions(['Whole model', 'Deterministic', 'Basal pre-injected (14 U, -2h)', 'BG clamped at 6.0', 'No food (72h fast)'])`.
- **Kapitel-ikoner (valgfrit, kun ved exact match)**: hvert kapitel KAN få en
  ikon foran titlen, hentet fra `assets/icons/app/`. Mapping defineres i
  `CHAPTER_ICONS`-objektet øverst i validation-filen. Ikonerne vises 36×36 px
  med CSS `object-fit: contain`.

  **Hovedregel: brug KUN en ikon hvis simulatoren bruger samme ikon til præcis
  samme emne** — så validation-siden visuelt "taler samme sprog" som spillet.
  Hvis kapitlet handler om et bredere/abstrakt emne (fx "limits & safety" eller
  "stochastic variability") uden en specifik in-game-knap eller status-indikator
  der matcher 1:1, så **lad være med at vælge en ikon der bare "ligner"** —
  spring den over (udelad bogstavet fra `CHAPTER_ICONS`). `addChapter()`
  rendrer overskriften uden ikon hvis bogstavet mangler.

  Mulige matches at konsultere — grep `assets/icons/app/[\w-]+\.(png|svg)`
  i `index.html`, `js/main.js`, `js/ui.js`, `js/simulator.js`, `js/guide-data.js`
  for at se den faktiske brug:
  - Basal/circadian → `basal-syringe-clock.png`
  - Bolus/hurtig-virkende → `rapid-syringe.png`
  - Mad/måltider → `meal-plate.png` (eller `carb-mixed.png`, `carb-sugar.png` etc. for specifikke kulhydrat-typer)
  - Motion → `activity-shoe.png` (cardio), `activity-strength.png` (styrke), `activity-ball.png` (bold), `activity-yoga.png` (yoga)
  - Intensitet → `intensity-low/medium/high.png`
  - Ketoner → `ketone-reagent.png` (test) eller `status-ketone.png` (status)
  - BG-måling → `blood-drop.png`

  Tidligere fravalgte forsøg (gem ikke disse): glucagon-pen for F (kapitlet er
  ikke specifikt om glukagon-knappens funktion), event-surprise for H (stokastik
  er ikke en in-game "surprise event").

### Gruppering i kapitlet

Tests skal stå **konsekutivt** når de tester relativt samme fænomen. Skift
mellem grupper må gerne markeres med en kommentar-blok mellem `addSection`-kald.

**Rækkefølge i et nyt kapitel** (eksempel for en hypothetisk "GLP-1-model"):

```
X.1  Baseline (GLP-1 OFF)
X.2  Single dose (kalibreringspunkt)
X.3  Dose-response (5 doser, tone-gradient)
X.4  Plateau / steady state (kun hvis relevant, 72h)
X.5  Edge case / failure mode
X.6  Interaktion med basal insulin (kun hvis relevant)
```

---

## TRIN 4 — ISOLATIONS-FLAGS (`phys.<X>Enabled`)

### Princip

En model-test skal **kun** vise dynamikken i den model den tester. Alle andre
fænomener der kunne forstyrre signalet, skal slås fra.

### Eksisterende flags (find via grep `Enabled` i `js/simulator.js`)

- `phys.dawnEffectEnabled` — slår dawn-fænomen og circadian kortisol fra (campaign bruger den)
- `phys.weightTrackingEnabled` — slår vægtspor fra
- `createSim()` overskriver allerede `gaussRand` så alle stokastiske trækninger er deterministiske

### Når et flag mangler

Hvis du vil slå et fænomen fra som ikke har et flag, **tilføj det først** i
`js/simulator.js`. Regler:

- Vælg **mindst muligt scope**: slå kun det enkelte fænomen fra, ikke hele modulet.
- Navngivning: `<modelKort>Enabled` (camelCase), fx `glucotoxicityEnabled`, `ffaResistanceEnabled`, `ketoneModelEnabled`.
- Læs `phys.<X>Enabled` i konstruktoren med `!== false` (default = aktiv): `this.glucotoxicityEnabled = phys.glucotoxicityEnabled !== false;`
- I beregningen: tidlig retur eller multiplikator-shortcut (`if (!this.glucotoxicityEnabled) return 1.0;`).
- Dokumentér flaget med en kommentar over deklarationen.
- Bagudkompatibilitet er IKKE et issue (per CLAUDE.md) — skriv det direkte.

### Aktivering i tests

Sæt flag på instansen direkte efter `createSim()`:

```js
const sim = createSim(DEFAULT_PROFILE);
sim.dawnEffectEnabled = false;
sim.glucotoxicityEnabled = false;
sim.stressEnabled = false;
// (lader kun fænomenet vi tester være aktivt)
```

### Når testen ER en variations-/døgn-test

Hvis testen specifikt tester døgnvariation, stress-respons, eller stokastik:
**lad det relevante flag stå tændt** (eller gendan `gaussRand` til original).
Skill'en gør ikke automatisk alt off — kun det der ikke skal måles.

---

## TRIN 5 — KODE-MØNSTER FOR ÉN TEST

Hver test følger dette skelet (se G.1-G.6 for komplette eksempler):

```js
addSection(
    'Kapitel.N-titel — kort scenarie-beskrivelse',
    'Intro: hvad scenariet er, hvilke interventioner og hvornår. '
    + 'OBLIGATORISK: nævn x-aksen ("clock time" eller "hours from sim start").',

    'Expected: kvantitativ forventning + reference. '
    + 'Eks: "BHB should plateau at 0.5-1.5 mmol/L after 24h (Cahill 1970, Owen 1967)."',

    async (canvas, resultDiv, conclusionDiv, legendDiv) => {
        const sim = createSim(DEFAULT_PROFILE);
        // Slå andet fra
        sim.dawnEffectEnabled = false;
        sim.stressEnabled = false;
        // (tilføj relevante flags her)

        // Setup (basal, advance til start-tid, clampBG hvis nødvendigt)
        sim.addLongInsulin(20, -2 * 60, true);
        await advanceTo(sim, 7 * 60);
        clampBG(sim, 5.5);

        // Interventions-schedule
        const schedule = [ /* ... */ ];
        const dual = await runSchedule(sim, schedule, 24 * 60); // ELLER 72*60

        // Beregn nøgletal
        const maxK = Math.max(...dual.ketoneData.map(d => d.bg));
        // ...

        // Tegn — BRUG STANDARD-SKALA HVIS GRUPPEN BRUGER STANDARD
        const bgSeries = [{ label: 'BG', data: dual.bgData, color: '#22c55e' }];
        const kSeries  = [{ label: 'BHB', data: dual.ketoneData, color: '#f97316' }];
        drawDualAxisChart(canvas, bgSeries, kSeries, { yMaxBG: 16, yMaxK: 4 });
        legendDiv.innerHTML = buildLegend([...bgSeries, ...kSeries]);

        // Result-tabel
        resultDiv.innerHTML = `<table class="results-table">
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Max BHB</td><td>${maxK.toFixed(2)} mmol/L</td></tr>
        </table>`;

        // Conclusion med pass/warn/fail klasser
        const ok = maxK < 0.6;
        conclusionDiv.innerHTML = `<p class="${ok ? 'pass' : 'fail'}">${ok ? '✓' : '✗'} Max BHB = ${maxK.toFixed(2)} mmol/L — ${ok ? 'matches expected range' : 'outside range'}</p>
        <p style="color:var(--muted)">Calibration sources: Author Year (Journal).</p>`;
    }
);
```

### Result + conclusion regler

- **Result-tabel**: nøgletal med enheder. Brug `<table class="results-table">` som G-kapitlet gør.
- **Conclusion**: brug CSS-klasser `pass` (grøn ✓), `warn` (gul ⚠), `fail` (rød ✗). Sidste linje: kalibreringskilder i `color:var(--muted)` stil.
- **Bedøm kvantitativt**: success-kriteriet skal være en konkret talgrænse (`maxK < 0.6`), ikke en kvalitativ vurdering.

---

## TRIN 6 — KØR OG VERIFICÉR

Efter tests er tilføjet:

1. Kør den grønne `tests/.bin/node.exe tests/simulation.test.js` for at sikre at `js/`-ændringerne ikke har brækket de eksisterende node-tests.
2. Bed brugeren åbne `tests/model-validation.html` i browseren og verificere visuelt at:
   - Tests står konsekutivt i kapitlet
   - Y-akser og x-akser er ens på tværs af gruppen
   - Tone-gradienterne ser monotone og læselige ud
   - Pass/warn/fail-status er rimelige

---

## CHECKLIST (kør gennem før du afslutter)

- [ ] Discovery: model, kode-sted, parametre, litteratur læst
- [ ] Plan godkendt af brugeren før kode-skrivning
- [ ] Tests står konsekutivt i kapitlet, samme varighed + y-akse inden for grupper
- [ ] X-akse-type nævnt eksplicit i hver intro (klokketid / timer-fra-start)
- [ ] **`xLabel`-opts sat på hver `drawChart`/`drawDualAxisChart`-kald** ('Time of Day' / 'Hours after start' / 'Hours/Minutes after intervention')
- [ ] Dosis-/intensitets-serier bruger tone-gradient af samme base
- [ ] Alle ikke-testede fænomener slået fra med `phys.*Enabled = false`
- [ ] Nye flags tilføjet i `js/simulator.js` med default = true
- [ ] Resultater har kvantitative success-kriterier + kalibreringskilder
- [ ] **Hvis nyt kapitel: ikon tilføjet i `CHAPTER_ICONS`-mapping**
- [ ] Node-tests kører stadig grønt
- [ ] Dansk tegnsætning (æ/ø/å) i kommentarer, engelsk i UI-tekst (intro/expected/conclusion matcher G-kapitlets engelske stil)
- [ ] Ingen AI-cliché-fraser ("delicate balance", "dance of hormones", osv. — se CLAUDE.md)

---

## EKSEMPEL PÅ EN PLAN-FORESLÅELSE (TRIN 1)

> Brugeren har bedt om at lave tests for en ny GLP-1-receptor-agonist-model.
> Modellen lever i `js/simulator.js` linje 4200-4300, output er `sim.glp1Effect`
> der modulerer gastrisk tømning og insulin-sekretion-mimik.
>
> **Foreslået kapitel:** "I — GLP-1 Receptor Agonist"
>
> **Tests** (alle 24h, klokketid på x-akse, BG 0-16):
> - I.1 Baseline (GLP-1 OFF) — ingen effekt på post-prandial BG
> - I.2 Single dose (1.0 mg semaglutide-equivalent) — kalibrering mod Marso 2016
> - I.3 Dose-response (0.25, 0.5, 1.0, 1.5, 2.0 mg, tone-gradient grøn)
> - I.4 Interaktion med basal insulin (klokketid, 24h)
>
> **Plateau-test** (72h, timer-fra-start, egen gruppe i slutningen):
> - I.5 Daglig dosis × 7 dage komprimeret til 72h (steady state)
>
> **Mangler at slå fra:** `glucotoxicityEnabled` flag findes ikke endnu — tilføjes.
> Eksisterende `dawnEffectEnabled`, `stressEnabled` (mangler — tilføjes) bruges.
>
> **Kalibreringskilder:** Marso 2016 (NEJM), Nauck 2009 (Diabetes Care).
>
> Sig "go" så implementerer jeg.

---

## ANTI-MØNSTRE (gør IKKE dette)

- **Lav ikke "egen skala" uden grund.** Hvis to tests viser samme fænomen ved forskellig dosis, skal de have samme y-akse — ellers kan læseren ikke sammenligne kurverne visuelt.
- **Bland ikke klokketid og timer-fra-start i samme gruppe.** Vælg én konvention per kapitel.
- **Brug ikke 5 forskellige farver til 5 doser af samme stof.** Det er tone-gradient af samme base, ikke en regnbue.
- **Lad ikke døgnvariation forstyrre en akut respons-test.** Slå dawn fra hvis du ikke specifikt tester morgentid.
- **Lad ikke stokastik forstyrre dosis-respons.** `createSim()` neutraliserer det allerede — gendan kun hvis du EKSPLICIT tester variabilitet (Kapitel H).
- **Skriv ikke kvalitativ pass/fail** ("ser rimelig ud"). Brug et konkret tal: `maxK < 0.6 ? 'pass' : 'fail'`.
- **Pre-draft ikke kode i din TRIN 1-plan.** Plan først, kode efter godkendelse.
