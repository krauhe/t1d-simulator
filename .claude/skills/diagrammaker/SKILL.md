---
name: diagrammaker
description: >
  Generér SVG-illustrationer af fysiologiske og implementerede modeller fra
  JSON-spec. Brug denne skill når brugeren beder om at "tegne en model",
  "lave et diagram", "illustrere en pathway", "vise compartments", eller når
  et docs/-afsnit ville have gavn af en visuel figur. Skill'en producerer
  spec.json + figure.svg + caption.md + <slug>-diagram.html pr. figur.
  HTML-siden er primær visningsmetode; screenshot (validation.png) er valgfrit.
  Trigger ved "tegn", "diagram", "illustrer", "compartment-figur", "lav SVG
  af modellen", "visualiser pathway", "tegn modellen", "diagrammaker".
---

# diagrammaker — SVG-illustrations-skill for T1D-simulatoren

Denne skill bruges når brugeren vil have en visuel figur til
`docs/MODEL-IMPLEMENTATION.md`, `docs/BG-SCIENCE.md` eller andre dokumenter.
Figurer bor i `docs/diagrams/<slug>/` med fuld kilde, render og validering.

## Stack

- **Renderer:** `tools/diagrammaker/render.js` (Node, bruger vendored dagre)
- **Validator:** `tools/diagrammaker/validate.js` (geometric overlap-tjek)
- **DSL-spec:** `tools/diagrammaker/schema.md` — læs den FØR du skriver en spec
- **Visuelt sprog:** `docs/diagrams/README.md` — farvepalet og embedding-mønster
- **Node-binær:** `tests/.bin/node.exe` (portable, projektets standard)
- **Browser til screenshot:** Chrome headless (`/c/Program Files/Google/Chrome/Application/chrome.exe`)

## Arbejdsgang — følg trinene i rækkefølge

### 1. Afklar med brugeren

Før du skriver noget, sørg for at have:
- **Slug** — kort kebab-case-navn til mappen (`insulin-pk`, `ketone-pathway`,
  `stress-axis`...)
- **Titel** — fuld engelsk titel
- **Type** — i v1 altid `"compartment-diagram"`
- **Retning** — `left-to-right` (default, brug ved sekventielle flows) eller
  `top-to-bottom` (brug ved hierarkiske/regulatoriske kaskader). NB: når én
  knude har 3+ parallelle udgående grene (fx Plasma insulin → x1/x2/x3/elim),
  giver LR ofte en for bred figur — vælg TB i stedet, eller acceptér at du
  skal folde grenene (se "Aspekt-ratio" nedenfor).
- **Compartments** — id, label, var, evt. unit, color, type
- **Flows** — fra/til, label (rate-konstant), kind (mass/signal/...)
- **Brug af eksisterende kode?** — hvis figuren illustrerer noget i
  `js/hovorka.js` eller `js/simulator.js`, læs den relevante kode FØRST og
  match variabel-navne præcist

Hvis brugeren beder om "et diagram af X" uden detaljer: foreslå et udkast
ud fra koden eller `docs/BG-SCIENCE.md`, og vent på godkendelse.

### 2. Skriv `docs/diagrams/<slug>/spec.json`

Brug `tools/diagrammaker/schema.md` som reference. Eksempel:
`docs/diagrams/insulin-pk/spec.json`.

Sørg for at:
- Alle `id` er unikke
- Alle `from`/`to` peger på eksisterende ids eller `"external"`
- Variabel-symboler matcher koden/litteraturen præcist (hvis figuren
  refererer til Hovorka-modellen, brug Hovorka's variabel-navne)
- `caption.scope` er 1-2 sætninger der forklarer hvad figuren viser
- `caption.variables` definerer ALLE ikke-åbenlyse symboler systematisk
  som strukturerede objekter med `symbol`, `category`, `definition`. **To
  kategorier** der matcher figurens grafiske elementer:
  - `"compartment"` — variablen er en state i en kasse (fx `S1`, `S2`,
    `I`, `Q1`, `x1`)
  - `"flow"` — variablen lever på en pil (rate-udtryk som `U_I`) ELLER
    er en konstant/parameter inde i et rate-udtryk (`τ_I`,
    `pulseFactor`, `k_e`, `kb1`, `ka1` osv.)
  Tjek-regel: hvis variablen står som `var` på en compartment i
  `compartments`-arrayet, er den `compartment`. Ellers er den `flow`.
  Eksempel:
  ```json
  "variables": [
    { "symbol": "S1, S2", "category": "compartment", "definition": "rapid SC depot stages (mU)" },
    { "symbol": "U_I",    "category": "flow",        "definition": "rapid absorption rate = S2/τ_I·pulseFactor" },
    { "symbol": "τ_I",    "category": "flow",        "definition": "rapid time constant (mean 55 min)" }
  ]
  ```
- **Eksterne flows skal have TO labels** — adskil flow-rate og kilde/
  destination i to felter på flow-objektet:
  - `label` = flow-rate-udtryk (placeres på pilens midte, som internt flow)
  - `externalLabel` = kilde- eller destinations-navn (placeres ved figurens
    kant, nær den eksterne ende — top/venstre for inputs, bund/højre for
    outputs)
  Eksempler:
  ```json
  // Input: kun kilde-navn i externalLabel — label SKAL være ""
  { "from": "external", "to": "scFast",
    "label": "",
    "externalLabel": "rapid (D_bolus)",
    "kind": "input" }

  // Output: rate på pilen + destination ved kanten
  { "from": "I", "to": "external",
    "label": "k_e · I",
    "externalLabel": "urine / clearance",
    "kind": "elimination" }
  ```
  ALDRIG bland rate og destination i ét label (fx `"k_e · I → urine"` er
  forbudt — det skal være to felter). Læseren skal straks kunne se "HVOR
  fra / til" ved kanten og "HVAD bevæger sig" på pilen.

  **Input-pile kan IKKE have `label`** — rendereren placer external
  input-ankeret kun 18 px over target-boksen, så ethvert `label` på en
  input-pil lander direkte oven på target-kassens øverste kant og giver
  `text-overlaps-foreign-box`-fejl. Sæt ALTID `"label": ""` på input-flows.
  Vil du vise et dose-udtryk (fx `D_bolus`), inkludér det i `externalLabel`
  i stedet: `"externalLabel": "rapid (D_bolus)"` — det vises som kilde-
  tekst OVER pilen uden geometrisk konflikt.

  **KRITISK:** `externalLabel` virker KUN på flows hvor `from` eller `to`
  er `"external"`. På inter-compartment flows (begge endepunkter er rigtige
  compartments) placerer rendereren externalLabel ved pilens midtpunkt —
  præcis oven på `label` — og giver to hvide bokse oven i hinanden.
  Rendereren ignorerer nu `externalLabel` stille på inter-compartment flows
  (ingen fejl, men ingen rendering heller), men spec-forfatteren skal ALDRIG
  sætte `externalLabel` på et sådant flow. Hvis du vil have to tekstlinjer
  på én pil: sæt al tekst i `label` (evt. forkortet) og beskriv detaljerne
  i `caption.variables`.
- **Kant-konvention for eksterne flows:**
  - **Inputs** (`from: "external"`) skal lande på figurens **øverste** eller
    **venstre** kant.
  - **Outputs** (`to: "external"`) skal forlade figurens **højre** eller
    **nederste** kant.
  Dette er mest stabilt når retningen er konsistent med flow-naturen:
  i `left-to-right` figurer bør eksterne inputs være tidlige (få indgående
  flows fra ikke-eksterne kilder) og outputs sene; i `top-to-bottom` figurer
  skal inputs typisk være compartments med `flows[from=external]` placeret
  først i `compartments`-arrayet (dagre's barycenter ordering).

### 3. Render

```bash
tests/.bin/node.exe tools/diagrammaker/render.js docs/diagrams/<slug>/spec.json
```

Output: `figure.svg` i samme mappe. Fejl → tjek JSON-syntax og at alle ids er
unikke.

### 4. Validér geometrisk

```bash
tests/.bin/node.exe tools/diagrammaker/validate.js docs/diagrams/<slug>/figure.svg
```

Output: `validation.json` + console-rapport. Validering tjekker:
- Tekst overlapper ikke fremmede kasser
- Pile går ikke gennem ikke-endepunkts-kasser
- Pile krydser ikke hinanden
- Pil-labels overlapper ikke kasser eller andre labels

Hvis status er **FAIL**: justér layout (se "Fejl-rettelse" nedenfor).
Maksimum 3 forsøg — derefter, hvis det stadig fejler: rapportér til brugeren
med screenshots og lad dem beslutte næste skridt. Lever IKKE en figur med
geometriske konflikter uden at flage dem først.

### 5. Tag visuel screenshot *(valgfrit — HTML-siden er nu primær visningsmetode)*

HTML-siden (`<slug>-diagram.html`, se trin 7) er den primære måde at se diagrammet på.
Screenshot-trinnet er valgfrit, men nyttigt til at fange geometriske problemer
som validatoren ikke opdager (aspekt-ratio, labels afskåret, dårlig symmetri).

Kør det **kun** hvis:
- Validatoren rapporterer WARNINGs du er usikker på, eller
- Du har mistanke om et visuelt problem (for bred figur, kasser klemt together osv.)

Headless Chrome-kommando til `validation.png`:

```bash
# Find SVG'ens dimensioner i figure.svg's første linje (width/height attributter)
# Tilpas window-size til SVG'ens størrelse + lidt padding

"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless --disable-gpu --hide-scrollbars \
  --screenshot="C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/docs/diagrams/<slug>/validation.png" \
  --window-size=<W>,<H> \
  "file:///C:/Dropbox/Kristian/Diabetes/Diabetes%20Simulator%20-%20Virtuel%20udforskning%20af%20din%20virkelighed/docs/diagrams/<slug>/figure.svg"
```

Læs PNG'en bagefter med `Read`-tool og kig efter:
- Alle labels læsbare (ikke afskårne, ikke skjult bag pile)
- Visuel hierarki (input til venstre/oven, output til højre/under)
- Konsistente farver pr. entitet
- Rimelige proportioner (ingen kæmpe huller eller voldsomt smalle kasser)
- **Aspekt-ratio og pladsudnyttelse** (se "Aspekt-ratio" nedenfor)
- **Lige linjer** — pile bør have få knæk; lange zigzag-stier er tegn på
  dårlig kompartment-rækkefølge. Hvis et flow gør en U-vending, prøv at
  skifte rækkefølgen i `compartments`-arrayet eller skifte retning.
- **Symmetri** — compartments på samme logiske niveau (fx `x1`, `x2`, `x3`)
  bør ligge på samme rang og være lige langt fra deres fælles forælder. Hvis
  én af dem er forskudt, justér rækkefølgen.
- **Eksterne flows er labeled** — pile fra/til `external` skal have label
  der navngiver kilde/destination ("from gut", "to urine" osv.).
- **Kant-konvention** — eksterne inputs lander på top/venstre kant; outputs
  forlader højre/bund. Hvis en ekstern pil kommer ind fra en "forkert" side,
  ompositionér ved at flytte den modtagende compartment i arrayet.

Hvis screenshot afslører noget validator'en ikke fanger (f.eks. dårlig
æstetik, forvirrende layout), justér spec'en og kør hele pipelinen igen.

#### Aspekt-ratio — figuren skal være kompakt, helst kvadratisk

Tjek SVG'ens dimensioner i første linje af `figure.svg` (`width=...`,
`height=...`). Beregn `ratio = width / height`.

- **Mål-zone:** `0.5 ≤ ratio ≤ 2.0` (fra 1:2-stående til 2:1-liggende). Det
  vigtige er at figuren er kompakt og kan overskues på en hjemmeside uden
  at læseren skal zoome ud. 4×6, 6×4, kvadratisk osv. — alle OK.
- **Acceptabelt:** `0.4 ≤ ratio < 0.5` eller `2.0 < ratio ≤ 2.5` — kun hvis
  indholdet naturligt er sekventielt/hierarkisk og ikke kan foldes.
- **Skal rettes:** `ratio < 0.4` (ekstremt høj/smal) eller `ratio > 2.5`
  (ekstremt bred). Disse tvinger zoom-out og taber læseren. Brug pladsen.

**Fix-strategier ved for bred figur (`ratio > 2.0`):**

1. **Skift retning** — prøv `top-to-bottom` i stedet for `left-to-right`.
   Ofte den hurtigste fix når LR har trukket parallelle grene ud i én lang
   linje. Render igen og tjek ny ratio.
2. **Fold parallelle grene** — hvis én knude har 3+ udgående grene til
   samme rang (fx Plasma insulin → x1, x2, x3, eliminationspil), opdél dem
   så et par knuder ligger på rang `n+1` og resten på `n+2` (justér
   compartments-rækkefølgen så dagre placerer dem som ønsket).
3. **Split i to figurer** — hvis figuren rammer >12 compartments eller
   >16 flows, er den sandsynligvis to delprocesser i én. Foreslå
   brugeren at splitte (fx "SC-kaskade + plasma" som én figur,
   "effekt-compartments + EGP-tug-of-war" som en anden).

**Fix-strategier ved for høj figur (`ratio < 0.5`):** spejlvend strategi 1
(prøv LR), eller fold sekventielle led i to kolonner.

Maksimum 2 omrender-forsøg på aspekt-ratio. Hvis ratio stadig er ude af
mål-zonen efter to forsøg, rapportér til brugeren med begge varianter og
lad dem vælge — eller foreslå split.

### 6. Skriv `caption.md`

Format: én italic Markdown-paragraf, ingen frontmatter, ingen nummerering.
Mønster:

```markdown
*<scope-sætning(er)>. **<symbol1>**: <definition>; **<symbol2>**: <definition>;
... osv.*
```

`caption.md` skal være self-contained — læseren skal kunne forstå alle
symboler uden at åbne andre dokumenter.

### 7. Lav `<slug>-diagram.html` — standalone diagram-side

Skill'en producerer en HTML-side der viser figuren, scope-tekst og en
struktureret variabel-tabel. Siden bruges som "klik-baseret figur-reference"
fra `docs/MODEL-IMPLEMENTATION.md` eller `docs/BG-SCIENCE.md` — i stedet for
at indlejre alle figurerne direkte (det bliver for voldsomt med mange
figurer), linker man til disse standalone-sider.

**Filplacering:** `docs/diagrams/<slug>/<slug>-diagram.html` —
HTML-siden bor INDE i slug-mappen sammen med alle andre figur-relaterede
filer (spec.json, figure.svg, caption.md, validation.png, validation.json).
Reglen er: alt der hører til én specifik figur ligger i samme mappe.

```
docs/diagrams/<slug>/
├── spec.json
├── figure.svg
├── caption.md
├── validation.png
├── validation.json
└── <slug>-diagram.html       ← standalone-side, refererer figure.svg lokalt
```

Linkning fra docs-filer:
```markdown
[See diagram: insulin action and EGP](diagrams/insulin-action-egp/insulin-action-egp-diagram.html)
```

HTML-siden refererer assets med rene relative stier (samme mappe):
`figure.svg`, `validation.png`.

Skabelon:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{TITLE} — preview</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 1.5rem;
      color: #1f2937;
      line-height: 1.6;
      background: #ffffff;
      font-size: 17px;
    }
    h1 { font-size: 1.6rem; margin-bottom: 1.5rem; color: #111827; }
    .figure { margin: 1.5rem 0; text-align: center; }
    .figure object, .figure svg, .figure img {
      max-width: 100%; height: auto;
    }
    .scope {
      font-style: italic; font-size: 1.1rem; color: #374151;
      margin: 1rem 0 1.5rem;
    }
    h2 { font-size: 1.3rem; color: #111827; margin: 1.5rem 0 0.5rem; }
    .var-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
      margin-top: 0.5rem;
    }
    .var-grid h3 {
      font-size: 1.1rem; color: #111827; margin: 0 0 0.5rem;
      padding-bottom: 0.25rem; border-bottom: 1px solid #e5e7eb;
    }
    table.var-table { width: 100%; border-collapse: collapse; font-size: 1rem; }
    table.var-table td {
      padding: 0.45rem 0.5rem; vertical-align: top;
      border-bottom: 1px solid #f3f4f6;
    }
    table.var-table td.symbol {
      font-family: 'Cambria Math', 'Latin Modern Math', serif;
      font-weight: 700; white-space: nowrap; color: #111827;
      width: 1%;
    }
    table.var-table td.def { color: #374151; }
    hr.thin { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    @media (max-width: 720px) {
      .var-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>{TITLE}</h1>
  <div class="figure">
    <object type="image/svg+xml" data="figure.svg">
      <img src="validation.png" alt="{TITLE}">
    </object>
  </div>
  <p class="scope">{SCOPE_TEXT}</p>
  <hr class="thin">
  <h2>Variables</h2>
  <div class="var-grid">
    <div>
      <h3>Compartment variables (boxes)</h3>
      <table class="var-table">
        <!-- {COMPARTMENT_ROWS} — én <tr><td class="symbol">…</td><td class="def">…</td></tr> pr. variabel -->
      </table>
    </div>
    <div>
      <h3>Flow variables (arrows + their parameters)</h3>
      <table class="var-table">
        <!-- {FLOW_ROWS} — samme format -->
      </table>
    </div>
  </div>
</body>
</html>
```

**Sådan udfylder du skabelonen:**
- `{TITLE}` = `spec.title`
- `{SCOPE_TEXT}` = `spec.caption.scope` som-er (ren tekst, ingen markdown)
- `{COMPARTMENT_ROWS}` = HTML-rækker for hver variabel hvor `category === "compartment"`:
  ```html
  <tr><td class="symbol">S1, S2</td><td class="def">rapid SC depot stages (mU)</td></tr>
  ```
- `{FLOW_ROWS}` = samme for `category === "flow"`
- Hvis en kategori er tom, vis stadig overskriften men med `<em>(none)</em>` i tabellen.

**Bemærk:**
- `preview.html` er en **privat preview-artefakt** for brugeren — den er
  *ikke* input til docs-build og skal *ikke* indlejres i andre docs.
- Tilføj den ikke til indeks-tabellen i `docs/diagrams/README.md`.
- Den fanger ting validator/screenshot ikke fanger: hvordan figur og
  caption hænger sammen i læseflow, om caption-teksten matcher det
  brugeren ser, om symboler i figuren også er forklaret i caption.

### 8. Opdatér `docs/diagrams/README.md`

Tilføj én linje i indeks-tabellen:
```markdown
| `<slug>/` | <Titel> | (afventer link) |
```

### 9. Vis figur til bruger + rapportér stier

**ALTID, når en figur er færdig, gør disse to ting i slut-svaret:**

1. **Read `validation.png`** så den vises som billede direkte i chat-svaret.
   Brugeren kan ellers ikke se hvad du har lavet.

2. **List eksplicit alle stier** der blev oprettet/opdateret:
   ```
   docs/diagrams/<slug>/spec.json
   docs/diagrams/<slug>/figure.svg                (til embed i MD-docs hvis nødvendigt)
   docs/diagrams/<slug>/caption.md
   docs/diagrams/<slug>/validation.png            (visuel snapshot)
   docs/diagrams/<slug>/validation.json
   docs/diagrams/<slug>/<slug>-diagram.html       (standalone-side)
   ```

3. **Vis klikbart link til diagram-siden** — i slut-svaret, lige under
   billedet, indsæt en eksplicit markdown-link så brugeren med ét klik kan
   åbne diagrammet i browseren. Format:

   ```markdown
   📄 [Åbn <slug>-diagram.html](docs/diagrams/<slug>/<slug>-diagram.html) — figur + variabel-tabel
   ```

   Linket SKAL fremstå tydeligt og må ikke gemmes inde i en længere
   sti-liste; det er en separat call-to-action.

Springer du dette over, ved brugeren ikke om resultatet ser fornuftigt ud,
og kan ikke nemt åbne filerne selv.

### 10. Foreslå indlejring

Foreslå hvor figuren passer ind i andre docs:
- Implementations-detaljer (Hovorka-strukturen, IOB-beregning, osv.)
  → `docs/MODEL-IMPLEMENTATION.md`
- Ren fysiologi (pathway-oversigter, hormonregulering)
  → `docs/BG-SCIENCE.md`

Brug embedding-mønsteret:
```markdown
![<alt-tekst>](diagrams/<slug>/figure.svg)

<caption-tekst fra caption.md>
```

Når en figur indlejres flere steder kan samme caption genbruges. Opdatér
indeks-tabellen i `docs/diagrams/README.md` med indlejrings-stederne.

## Fejl-rettelse — når validering fejler

### Tekst overlapper fremmed kasse
- Reducer `nodeMinWidth` eller `nodeMinHeight` ikke — det vil sandsynligvis
  forværre det. I stedet: forkort labels eller flyt compartments længere fra
  hinanden ved at øge `STYLE.rankSep` / `STYLE.nodeSep` (i `render.js`).

### Pil går gennem fremmed kasse
- Som regel skyldes det at to compartments er på samme rank uden plads til
  pil at passere udenom. Løsninger:
  - Skift retning (LR → TB eller omvendt)
  - Omarrangér flows (måske et signal-flow er konfigureret som mass)
  - Tilføj `minlen` til den problematiske flow (kræver renderer-udvidelse)

### Pile krydser hinanden
- Dagre minimerer krydsninger automatisk men kan ikke altid eliminere dem.
  Hvis flere signal-pile fra samme node konvergerer, prøv:
  - Omordne `compartments` arrayet (rækkefølgen påvirker dagre's barycenter-
    ordering)
  - Reducere antal flows til/fra én knude (måske mangler der en mellemknude)

### Pil-label overlapper kasse
- Ofte tegn på at edge-label er for langt for det tilgængelige rum. Forkort
  label (fx `kb1` i stedet for `k_b1`) eller flyt definitionen til caption.

### To hvide label-bokse oven i hinanden på samme pil
- Skyldtes næsten altid `externalLabel` sat på et inter-compartment flow
  (begge endepunkter er rigtige compartments, ikke `"external"`).
  Rendereren ville tidligere falde tilbage til midpoint for `externalLabel`
  — præcis samme position som `label` — og tegne to rect-baggrunde der
  dækker hinanden. **Fix:** fjern `externalLabel` fra flowet. Sæt eventuelt
  al tekst i `label` (forkortet), og uddyb i `caption.variables`.
  Rendereren ignorerer nu `externalLabel` stille på inter-compartment flows,
  men spec-fejlen bør stadig rettes for at undgå forvirring.

## Vigtige principper

- **Geometric validator er ikke æstetik-validator.** Den fanger overlap, men
  ikke "ser figuren godt ud". Tag altid screenshot og kig.
- **Match koden/litteraturen.** Variabel-navne i diagrammet skal matche
  præcis det der står i `js/hovorka.js`, `js/simulator.js` eller den
  refererede artikel. Forkerte symboler er værre end ingen figur.
- **Hold figuren fokuseret.** Hvis en figur har > 10 compartments eller
  > 15 flows, overvej at splitte den i to figurer der hver illustrerer en
  delproces. Læseren kan ikke holde 25 elementer i hovedet samtidigt.
- **Kompakt aspekt-ratio.** Mål er kvadratisk (`width/height` mellem 0.7 og
  1.5). Brede figurer (`>2.0`) eller meget høje (`<0.5`) er pladsspild og
  svære at læse på små skærme — ret ved at skifte retning, folde parallelle
  grene eller splitte. Se "Aspekt-ratio" i trin 5.
- **Lige linjer og symmetri.** Foretræk et layout hvor:
  - Pile er lige (få knæk) — undgå unødvendige zigzag-stier. Dagre
    minimerer dette automatisk hvis kompartmenter er placeret rigtigt på
    samme eller tilstødende rang.
  - Compartments på samme logiske niveau (fx alle effekt-kompartmenter
    `x1`, `x2`, `x3`) ligger på samme rang og er lige langt fra hovedaksen.
    Justér `compartments`-rækkefølgen så dagre's barycenter-ordering
    placerer dem symmetrisk om en central knude.
  - Parallelle grene har ens hældning og ens længde fra deres fælles
    forælder — så øjet kan se mønstret som "tre symmetriske grene fra én
    hub" i stedet for tre tilfældige spredt ud.
  - Når 3 grene udgår fra samme knude: vælg en uneven fordeling (én
    centreret, en til hver side) eller én fælles retning — ikke en mix.
- **Eksterne kanter.** Inputs udefra skal komme fra top/venstre, outputs
  skal forlade fra højre/bund. Eksterne flow-labels skal navngive kilde/
  destination (se trin 2). Læseren skal aldrig være i tvivl om hvor pile
  fra `external` "kommer fra" eller "går hen". **Renderer-support:**
  eksterne output-ankre auto-pinnes til sidste rang (`rank: 'max'`) og
  eksterne input-ankre til første rang (`rank: 'min'`) — du behøver ikke
  konfigurere noget manuelt, men du skal sikre at flows er konfigureret
  med `from: "external"` / `to: "external"`.
- **Output-grupper på samme kant.** Når en figur har flere "endelige
  outputs" der hører naturligt sammen (fx Q1 og Q2 begge er glukose-pools
  der modtager fra modellen), skal de placeres på samme rang ved figurens
  udgangs-kant. **Sådan gør du:** sæt `"rank": "max"` på hver af de
  pågældende compartments i spec.json — de tvinges så til samme rang i
  bunden (TB) eller højre side (LR). Dagre vil forlænge edges fra de
  tidligere ranger så pilen alligevel når frem. Eksempel:
  ```json
  { "id": "Q1", "label": "Plasma glucose", "var": "Q1", "rank": "max" }
  { "id": "Q2", "label": "Peripheral glucose", "var": "Q2", "rank": "max" }
  ```
- **Lige linjer er nu standard.** Renderer'en bruger `L`-segmenter mellem
  dagre's routing-punkter (polyline-stil) — IKKE Bezier-smoothing. Det
  betyder pile er rette mellem hjørner, ikke kurvede. Hvis du vil have
  kurvede pile (sjælden æstetisk grund), sæt `"straightLines": false` på
  top-niveau i spec.json. Anbefalingen er aldrig at sætte den til false.
- **Snap-til-vinkelret pile (auto, ingen spec-felt nødvendigt).** Renderer'en
  detekterer automatisk når source-boksen og target-boksen overlapper i den
  retning der er på tværs af flow-aksen, og snapper pilen til en helt
  lodret (TB) eller vandret (LR) linje gennem overlap-zonen. Eksempel:
  to smalle SC-depoter placeret over en bredere Plasma-insulin-boks giver
  to lige lodrette pile (ikke diagonale mod box-center). Du behøver ikke
  konfigurere noget — det sker automatisk når geometrien tillader det.
  **Konsekvens for spec-forfatteren:** Hvis du vil have flere lodrette
  pile, ordn `compartments`-arrayet så relaterede par står ved siden af
  hinanden (dagre's barycenter-ordering), så de havner i samme kolonne.
- **Holde indholdet i kasser kort.** `label`, `var` og `unit` på en
  compartment skal være korte. Hvis en variabel har en lang dekomposition
  (fx `stressMultiplier = glycogenBaseline + gngBaseline + acute + chronic
  + dawn + protein-glucagon`), så placer KUN det korte symbol/navn i kassen
  og flyt dekompositionen til `caption.variables` med en udførlig
  definition. Lange tekster i kasser sprænger figuren bredt og tvinger
  hele layoutet til at vokse — selv små optimeringer her giver markant
  bedre kompakthed.
- **Foretræk fjerne nodes når deres info kan stå i en anden bokss equation.**
  Hvis en compartment kun fungerer som en ren "modifier" eller "pre-input"
  til en anden node, og det matematiske udtryk allerede står i target-
  noden (fx `EGP = EGP₀ · max(0, stress − x3)` viser allerede at stress
  er en faktor), overvej at fjerne separate-noden helt. Færre nodes →
  færre pile → simplere figur. Variablen er stadig dokumenteret i
  variabel-tabellen.
- **INGEN forsimplinger i del-modeller.** Hvis simulator-koden eller den
  fysiologiske referencemodel har separate ODE-tilstande (fx Hovorka's
  S1 og S2 i SC-kaskaden, D1/D2 i gut-kaskaden, x1/x2/x3 effekter), SKAL
  de tegnes som SEPARATE kasser med eksplicitte flow-pile imellem.
  Kombinér ALDRIG flere ODE-states i én kasse for at gøre figuren mindre —
  det skjuler modellens struktur og giver et forkert indtryk af hvor mange
  tidsforsinkelser systemet har. **Den eneste tilladte "kondensering"** er
  hvis flere states deler præcist samme rolle og parametre OG det
  matematisk er ækvivalent med én state (sjældent — næsten altid en fejl
  at antage). Reglen prioriteres OVER kompakthed: hellere lidt større
  figur end forkert struktur. Hvis figuren bliver for stor, split den i
  flere figurer (fx separate "insulin PK" og "insulin action") — det er
  korrekt løsning, ikke at kondensere kompartmenter.
- **Variabel-tabellen må KUN indeholde symboler der er synlige på figuren.**
  Hver række i variabel-tabellen skal kunne kobles til et symbol læseren
  faktisk ser i figuren — enten som `var` på en compartment, som flow-
  label på en pil, eller inde i en compartments equation-tekst (fx `EGP`
  inde i Liver EGP's `EGP = EGP₀ · max(0, stress − x3)`).
  - Hvis en kode-variabel modulerer en proces men ikke vises på figuren,
    skal den enten (a) tilføjes til den relevante flow-label (fx `pulse`
    der modulerer SC-rates → label `S1·pulse/τ_I`), ELLER (b) udelades
    helt af tabellen.
  - ALDRIG behold "skjulte" symboler i tabellen som læseren ikke kan
    finde i figuren. Det forvirrer og bryder kontrakt-princippet om at
    tabellen er en figur-ordbog.
  - **Konsistens-tjek før commit:** scan visuelt eller programmatisk
    figuren for ALLE synlige symboler, sammenlign med tabellen — der må
    ikke være forskel.
- **Konsistente symboler — figur ↔ tabel ↔ kode.** Brug PRÆCIS samme
  variabel-navn alle tre steder: figuren (kasse-var eller flow-label),
  variabel-tabellen (symbol-kolonne), og koden. Eksempel: hvis koden
  bruger `pulseFactor`, så stå der `pulseFactor` på figurens flow-labels
  OG i tabellens symbol-kolonne. ALDRIG forkort eller alias'er ("pulse"
  vs `pulseFactor`) — det skaber tvivl om hvorvidt det er samme variabel.
  Hvis figur-labelen bliver lidt længere på grund af præcist navn, er det
  acceptabelt: konsistens > kompakthed.
- **Kilde-navngivning og citation.** Når en model er baseret på en
  publiceret kilde (fx Hovorka 2004 for insulin/glukose-kaskaden, Cobelli
  for gut-modellen, Cryer for counter-regulation), brug kildens kanoniske
  navngivning og citér kilden eksplicit:
  - **Title:** Inkluder kildens navn og årstal — fx *"Hovorka 2004 insulin
    subsystem"*. Hvis modellen er udvidet, tilføj `(extended)` eller
    `(modified)` så læseren ved det er en variant.
  - **Compartment-symboler:** Match kildens notation præcist — `S1`, `S2`,
    `Q1`, `Q2`, `x1/x2/x3` osv. ALDRIG generiske navne som "Depot 1",
    "Box A" når der findes etablerede symboler i litteraturen.
  - **Caption:** Første sætning skal pege på kilden med fuld reference,
    fx: *"...Hovorka 2004 glucose-insulin model (Hovorka et al., Physiol
    Meas 25:905-920, 2004)..."*. Brug det format der allerede findes i
    `docs/references/` (filer som `Hovorka_2004_NonlinearMPC.pdf`).
  - **Udvidelser:** Hvis simulatoren har lagt noget til (extra
    compartments, extra terms i ligninger), markér eksplicit hvad der er
    KERNE-modellen og hvad der er EXTENSION i caption.scope.
- **Undgå AI-cliché-formuleringer i titler og caption-tekst.** Frasen
  "tug-of-war", "dance of...", "symphony of...", "the brain's...", "the
  body's..." og lignende metaforiske AI-sproghybrider skal undgås. Skriv
  i stedet videnskabeligt præcis, neutral engelsk:
  - DÅRLIGT: *"Insulin action subsystem and EGP regulation (tug-of-war at
    the liver)"* — metafor i parentes
  - GODT: *"Insulin action subsystem and hepatic glucose production
    regulation"* — beskrivende, præcist
  - DÅRLIGT: *"The body orchestrates a delicate balance..."*
  - GODT: *"At basal state, EGP equals peripheral disposal..."*
  Dette gælder både `title`, `caption.scope` og enhver tekst der ender i
  publikations-niveau dokumenter (`MODEL-IMPLEMENTATION.md`,
  `BG-SCIENCE.md`).
- **Engelsk overalt.** Spec, caption, README. Match docs-konventionen
  (MODEL-IMPLEMENTATION og BG-SCIENCE er kun-engelsk).
- **Rør IKKE renderer-koden uden grund.** `render.js` er kalibreret. Hvis du
  har brug for en ny visuel feature, diskutér med brugeren først.

## Sub-agents — hvornår og hvordan

Skill'en må gerne spawne sub-agenter til afgrænsede del-opgaver. **Brug
ALTID `model: "sonnet"`** når du spawner — sub-tasks i denne skill er
bounded research/skriv-arbejde der ikke kræver Opus-niveau syntese.

**Maks 5 sub-agenter ad gangen.** Hvis du har flere uafhængige del-opgaver
(fx 8 figurer der skal forberedes parallelt), batch dem i grupper af op til
5: send første batch, vent på resultater, send næste batch. Det holder
samtidigt forbrug og output-volumen håndterbart.

Typiske sub-agent-opgaver:

- **Kode-research** — læs `js/hovorka.js` eller `js/simulator.js` og udtræk
  præcise variabel-navne, kompartmenter og rate-konstanter til en spec
- **Litteratur-research** — find Hovorka 2004 / Cryer 2013 / lignende refs
  i `docs/references/` for at bekræfte symboler og kanoniske flow-strukturer
- **Variable-definition-drafting** — gennemlæs et BG-SCIENCE.md-afsnit og
  destillér en `caption.variables`-liste der dækker alle ikke-åbenlyse
  symboler i figuren
- **Spec-validering** — efter du har skrevet en spec.json, lad en sub-agent
  cross-tjekke at alle compartments og flows i koden er repræsenteret (eller
  at scope-begrænsninger er bevidste)

Eksempel-spawn:

```
Agent({
  description: "Hovorka kompartment-research",
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: "Læs js/hovorka.js og lav en præcis liste af alle compartments
  i glukose-undermodellen (Q1, Q2, evt. flere). For hver: variabel-navn,
  fysisk betydning, og hvilke flows der går ind/ud (med rate-konstant-
  navne fra koden). Output som markdown-tabel. Under 300 ord."
})
```

Hovedagenten (denne skill's orkestrator) integrerer sub-agentens output i
spec.json og kører pipelinen. Sub-agenter laver IKKE selv render/validate-
trinene — det er hovedagentens ansvar.

## Hvis Playwright MCP er tilgængelig

I sessions hvor `mcp__playwright__browser_*` tools er loadet, kan du bruge
dem som alternativ til headless Chrome (åbn figur.svg som file:// URL,
tag screenshot, gem til `validation.png`). Headless Chrome via Bash er dog
mere robust og uafhængig af MCP-tilgængelighed — brug den som default.
