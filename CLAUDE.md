# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Om udvikleren
- Primær programmeringsbaggrund: MATLAB (ikke brugt i lang tid)
- Ønsker mange uddybende kommentarer i alle filer
- Hver fil skal starte med en overordnet beskrivelse af hvad filen gør
- Forklar også "almen" programmeringsviden — antag ikke forhåndskendskab
- Svar og kommenter på dansk

## Projektbeskrivelse

**Diabetes-Dysten** er et uddannelsesspil/simulator til nydiagnosticerede type 1 diabetes patienter. Spilleren lærer at kontrollere blodglukose via insulin, mad og motion i et sikkert simuleret miljø med hurtig feedback.

Projektet har to tilstande (fremtidigt):
1. **Sandkasse** – fri leg, afprøv hypoteser uden konsekvenser
2. **Baner** – realistiske hverdagsscenarier spilleren skal klare

## Nuværende tech stack

- HTML / CSS / JavaScript (ingen frameworks, ingen build-trin)
- Åbn `index.html` direkte i en browser — ingen server eller npm nødvendigt
- Ekstern afhængighed: Tone.js 14.8.49 (lyd, loaded fra CDN)

## Fil-struktur

```
index.html      ← HTML-struktur og layout
style.css       ← Al CSS-styling
js/
  sounds.js     ← Lyd-opsætning (Tone.js) og playSound()
  simulator.js  ← Simulator-klassen: al fysiologisk modellering og spilmekanik
  ui.js         ← Tegning af graf, opdatering af UI, popups, logning
  game.js       ← Game loop, startGame, resetGame, togglePause
  main.js       ← Globale variable, DOM-referencer, event listeners, init
old/            ← Original enkeltfil-version (TB1Sim v42 beta.html) + referencefiler
```

Script-load rækkefølge i index.html (rækkefølgen er vigtig, da filer deler globalt scope):
`sounds.js` → `simulator.js` → `ui.js` → `game.js` → `main.js`

## Arkitektur

Appen følger et Model-View-Controller mønster:

- **Model:** `Simulator`-klassen (`js/simulator.js`) — ejer al spiltilstand og kører den fysiologiske simulation hvert tick. Nøgleegenskaber: `trueBG`, `cgmBG`, `iob`, `cob`, `weightChangeKg`.
- **View:** `drawGraph()` tegner canvas-grafen; `updateUI()` opdaterer DOM-elementer. Begge i `js/ui.js`.
- **Controller:** Event listeners i `js/main.js` håndterer brugerinterventioner (mad, insulin, motion) og spilkontrol.

## Fysiologiske parametre (vigtigt for simulationslogik)

- **ICR** (Insulin-to-Carb Ratio): gram kulhydrat dækket af 1 enhed insulin
- **ISF** (Insulin Sensitivity Factor): hvor meget 1 enhed insulin sænker blodglukose (mmol/L)
- **Basal insulin:** baggrundsinsulin med effekt over mange timer
- **Bolus insulin:** måltidsinsulin med hurtig effekt (onset 10–15 min, varighed 2–6 t)
- **Målzone:** 4–10 mmol/L
- **Hypoglykæmi:** < 4 mmol/L (akut farligt pga. besvimelse og koma)
- **Hyperglykæmi:** > 10 mmol/L (skadeligt på sigt)

Game mechanics skal så vidt muligt baseres på modeller af de fysiske processer. Fx påvirker motion insulinoptagelsen fordi øget blodgennemstrømning udvasker insulin hurtigere til blodet (compartment-model tankegang).

## Kodestil og kommentarer

- Omfattende kommentarer på dansk i alle filer
- Øverst i hver fil: overordnet beskrivelse af filens ansvar
- Kommenter ikke-åbenlys logik grundigt — antag MATLAB-baggrund, ikke JS-baggrund
- Variabelnavne skal være selvforklarende
- Saml al fysiologisk modellering i `js/simulator.js`
- Skriv kode der er nem at udvide (tænk fremad mod baner og sandkasse)

## Prioriteret todo-liste

### Basale forbedringer (gør først)
1. Moderne brugerinterface — ikke 90'er-stil
2. "Du døde"-skærm med forklaring på dødsårsag (hypoglykæmi, ketoacidose osv.)
   - 2b: Bedre definition af ketoacidose med symptomindikation før død
   - 2c: Mulighed for ketose-stik måling
3. Personprofil — bruger kan indtaste vægt, ICR og ISF så simulatoren matcher deres egen diabetes
   - 3b: Spillet initieres fra midnat med stabilt blodsukker baseret på ICR og korrekt basal forudindgivet

### Mellemfristede features
4. Highscore-liste med navn
5. Sandkasse-tilstand med scenarier/forhindringer man kan aktivere

### Fremtidige features (tænk fremad i arkitekturen)
6. Baner — realistiske hverdagsscenarier, fx:
   - "Du løber 10 km til skolernes idrætsdag kl. 11–12"
   - "Du glemte din insulin hjemmefra"
   - "Du har feber" (øget insulinbehov)
   - Uforudsete hændelser midt i en bane (fx uvirksom insulin pga. varme/kulde)
   - 6b: Grafiske illustrationer af fysiologiske processer til ikke-fagkyndige
7. Standard Diabetes-rapport (AGP):
   - Estimeret HbA1c / GMI: `GMI = 3.31 + 0.02392 × mean_glucose_mg/dL`
   - Gennemsnitlig glukosekurve med percentiler (25/50/75)
   - TIR (4–10 mmol/L), TAR (> 10), TBR (< 4)
   - Samlet insulinforbrug
8. Multiplayer/familie-konkurrence om bedste blodsukkerkontrol

## Insulinabsorptionsmodel — kompartmentstruktur

### Generel 2+1 kompartmentmodel (bolus/hurtigvirkende)
Alle hurtigvirkende insuliner modelleres med samme struktur men individuelle parametre:

```
dS/dt = -ka × S × pulsFaktor         // subkutant depot → plasma
dP/dt = ka × S × pulsFaktor - ke × P // plasma (IOB)
dE/dt = keo × (P - E)                // effektkompartment → BG-virkning

pulsFaktor = 1 + (puls - basalPuls) / basalPuls × pulsFølsomhed
// Puls 60  → ~1.0x absorption
// Puls 120 → ~1.5x absorption
// Puls 150 → ~1.7x absorption
```

### Injektionssted (påvirker ka)
```
abdomen: ka × 1.0   // hurtigst — reference
arm:     ka × 0.85
lår:     ka × 0.70  // langsomst
```
Godt læringspoint for nydiagnosticerede.

### Insulintyper — parametre

#### Hurtigvirkende analoger (bolus)
| Type      | Onset    | Peak   | Varighed | ka t½      |
|-----------|----------|--------|----------|------------|
| NovoRapid | 10–20min | 1–2t   | 3–5t     | ~60–90 min |
| Humalog   | 10–15min | 1–2t   | 3–4t     | ~50–80 min |
| Fiasp     | 2–5min   | 1–1.5t | 3–4t     | ~30–50 min |

Alle modelleres med 2+1 kompartmentmodel.

#### Langvirkende basal insulin

**Insulin glargin (Lantus/Toujeo):**
- Næsten flad profil over 24 timer (peakless)
- Approksimeres som langsom kompartmentmodel, ka t½ ~4–6 timer
- Toujeo (300 E/ml) endnu fladere og længere

**Insulin degludec (Tresiba):**
- Varighed > 40 timer, akkumulerer over 2–3 dage ved daglig dosering
- Kræver multi-dags kompartmentmodel
- Relevant at modellere akkumuleringseffekt

**Insulin detemir (Levemir):**
- Varighed ~18–24 timer, svagt peak
- Approksimeres med kompartmentmodel

**Insulin glargin U100 (Lantus) — nuværende implementation:**
- Rektangulær udskillelse er en rimelig approksimation da profilen er relativt flad
- Kan raffineres med langsom kompartmentmodel senere
- Bevar eksisterende implementation indtil videre

### Arkitekturkrav
Insulintyper defineres som objekter med individuelle parametre:

```javascript
const insulinTyper = {
  novorapid: {
    navn: "NovoRapid",
    type: "bolus",
    model: "compartment",
    ka:  0.025,   // min⁻¹
    ke:  0.025,   // min⁻¹
    keo: 0.015,   // min⁻¹
    pulsPåvirkning: true
  },
  lantus: {
    navn: "Lantus",
    type: "basal",
    model: "rectangular", // nuværende approksimation
    varighed: 1440,        // minutter (24 timer)
    // TODO: opgrader til langsom kompartmentmodel
    pulsPåvirkning: false
  },
  tresiba: {
    navn: "Tresiba",
    type: "basal",
    model: "accumulating", // kræver multi-dags model
    varighed: 2400,         // minutter (~40 timer)
    akkumuleringsDage: 3,
    pulsPåvirkning: false
    // TODO: implementer akkumuleringsmodel
  }
}
```

### Fremtidige insulintyper at overveje
- Fiasp (ultra-hurtig, relevant for moderne T1D)
- Insulin degludec/aspart kombination (Ryzodeg)
- Pumpe-insulin (kontinuerlig infusion — egen model)

## Vigtige noter til Claude Code

- Bevar altid simulationslogikken intakt ved UI-ændringer
- Forklar altid hvad du har ændret og hvorfor
- Foreslå gerne forbedringer men implementer dem ikke uden godkendelse
- Ved større ændringer: vis plan først, kód bagefter
