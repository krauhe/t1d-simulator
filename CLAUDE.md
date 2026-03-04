# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Udviklerens baggrund og præferencer

### Teknisk baggrund
- Primær programmeringsbaggrund: MATLAB (ikke brugt i lang tid)
- Ikke professionel udvikler — forklar også "almen" programmeringsviden
- Kører engelsk Windows

### Kodestil
- Omfattende kommentarer i ALLE filer — antag ikke forhåndskendskab
- Øverst i hver fil: overordnet beskrivelse af filens ansvar og indhold
- Kommenter ikke-åbenlys logik grundigt
- Variabelnavne skal være selvforklarende
- Skriv kommentarer på dansk
- Saml al fysiologisk modellering i `js/simulator.js`
- Skriv kode der er nem at udvide (tænk fremad mod baner og sandkasse)

### Kommunikation
- Svar altid på dansk
- Forklar hvad du har ændret og hvorfor efter hver opgave
- Ved større ændringer: vis plan først, kód bagefter
- Foreslå gerne forbedringer men implementer dem ikke uden godkendelse
- Bevar altid simulationslogikken intakt ved UI-ændringer

---

## Projektbeskrivelse

**Diabetes-Dysten** er et uddannelsesspil/simulator til nydiagnosticerede type 1 diabetes patienter. Spilleren lærer at kontrollere blodglukose via insulin, mad og motion i et sikkert simuleret miljø med hurtig feedback.

Projektet har to tilstande (fremtidigt):
1. **Sandkasse** – fri leg, afprøv hypoteser uden konsekvenser
2. **Baner** – realistiske hverdagsscenarier spilleren skal klare

---

## Nuværende tech stack

- HTML / CSS / JavaScript (ingen frameworks, ingen build-trin)
- Åbn `index.html` direkte i en browser — ingen server eller npm nødvendigt
- Ekstern afhængighed: Tone.js 14.8.49 (lyd, loaded fra CDN)

---

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

---

## Arkitektur

Appen følger et Model-View-Controller mønster:

- **Model:** `Simulator`-klassen (`js/simulator.js`) — ejer al spiltilstand og kører den fysiologiske simulation hvert tick. Nøgleegenskaber: `trueBG`, `cgmBG`, `iob`, `cob`, `weightChangeKg`.
- **View:** `drawGraph()` tegner canvas-grafen; `updateUI()` opdaterer DOM-elementer. Begge i `js/ui.js`.
- **Controller:** Event listeners i `js/main.js` håndterer brugerinterventioner (mad, insulin, motion) og spilkontrol.

---

## Fysiologiske parametre (vigtigt for simulationslogik)

- **ICR** (Insulin-to-Carb Ratio): gram kulhydrat dækket af 1 enhed insulin
- **ISF** (Insulin Sensitivity Factor): hvor meget 1 enhed insulin sænker blodglukose (mmol/L)
- **Basal insulin:** baggrundsinsulin med effekt over mange timer
- **Bolus insulin:** måltidsinsulin med hurtig effekt (onset 10–15 min, varighed 2–6 t)
- **Målzone:** 4–10 mmol/L
- **Hypoglykæmi:** < 4 mmol/L (akut farligt pga. besvimelse og koma)
- **Hyperglykæmi:** > 10 mmol/L (skadeligt på sigt)

Game mechanics skal så vidt muligt baseres på modeller af de fysiske processer. Fx påvirker motion insulinoptagelsen fordi øget blodgennemstrømning udvasker insulin hurtigere til blodet (compartment-model tankegang).

---

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

---

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
Godt læringspoint for nydiagnosticerede — mange ved ikke at injektionssted påvirker insulinets virkningstidspunkt.

### Insulintyper og parametre

#### Hurtigvirkende analoger (bolus)
| Type      | Onset    | Peak   | Varighed | ka t½      |
|-----------|----------|--------|----------|------------|
| NovoRapid | 10–20min | 1–2t   | 3–5t     | ~60–90 min |
| Humalog   | 10–15min | 1–2t   | 3–4t     | ~50–80 min |
| Fiasp     | 2–5min   | 1–1.5t | 3–4t     | ~30–50 min |

#### Langvirkende basal insulin

**Insulin glargin (Lantus/Toujeo):**
- Næsten flad profil over 24 timer (peakless)
- Nuværende implementation: rektangulær approksimation — bevar indtil videre
- Kan senere raffineres med langsom kompartmentmodel (ka t½ ~4–6 timer)
- Toujeo (300 E/ml) endnu fladere og længere

**Insulin degludec (Tresiba):**
- Varighed > 40 timer, akkumulerer over 2–3 dage ved daglig dosering
- Kræver multi-dags kompartmentmodel
- TODO: implementer akkumuleringsmodel

**Insulin detemir (Levemir):**
- Varighed ~18–24 timer, svagt peak
- Kan approksimeres med langsom kompartmentmodel

### Arkitektur — insulintyper som objekter
```javascript
const insulinTyper = {
  novorapid: {
    navn: "NovoRapid",
    type: "bolus",
    model: "compartment",
    ka:  0.025,   // min⁻¹ — absorptionskonstant depot→plasma
    ke:  0.025,   // min⁻¹ — clearancekonstant plasma
    keo: 0.015,   // min⁻¹ — forsinkelse plasma→effekt
    pulsPåvirkning: true
  },
  lantus: {
    navn: "Lantus",
    type: "basal",
    model: "rectangular",  // nuværende approksimation
    varighed: 1440,         // minutter (24 timer)
    pulsPåvirkning: false   // minimal effekt ved basal
    // TODO: opgrader til langsom kompartmentmodel
  },
  tresiba: {
    navn: "Tresiba",
    type: "basal",
    model: "accumulating",  // kræver multi-dags model
    varighed: 2400,          // minutter (~40 timer)
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

---

## Motionsmodel — cardio vs. styrketræning

### Fælles effekter for al motion
- ↑ Absorptionshastighed af subkutant insulin (varme, øget blodflow)
- ↑ Insulinfølsomhed (ISF forbedres under og timer efter træning)
- ↑ Puls (vigtig visuel feedback parameter i UI)

### Cardio (aerob) — nettoresultat: BG FALDER
- ↑ Glukoseoptag i muskler via GLUT4 translokation (insulinuafhængigt)
- Glukagonrespons moderat og vedvarende
- Ved langvarig cardio (> 60–90 min): glykogenreserver udtømmes → fedtoxidation dominerer
  → glukagonrespons stiger → BG-fald bremses eller vender
  → paradoks BG-stigning mulig ved meget langvarig cardio

### Styrketræning (anaerob) — nettoresultat: BG STIGER akut
- Kraftig akut stigning i glukagon og katekolaminer (adrenalin)
- ↑ Hepatisk glukoseproduktion (HGP) via glykogenolyse
- HGP >> glukoseklarering → akut BG-stigning
- Timer efter træning: insulinfølsomhed stiger → forsinket BG-fald
- Ved gentagen styrketræning samme dag: glykogenreserver delvist udtømte → mindre akut BG-stigning

### JavaScript modelstruktur
```javascript
motionEffekt = {
    // Fælles
    insulinAbsorptionFaktor: 1.2-1.5,     // hurtigere subkutant optag
    ISF_faktor: 1.2-1.4,                   // bedre insulinfølsomhed

    // Type-specifikt
    glukoseKlarering: cardio ? høj : lav,  // GLUT4 muskeloptag
    HGP_stigning:     cardio ? lav : høj,  // glukagon/adrenalin respons

    // Forsinkede effekter (timer efter træning)
    postMotionISF_boost: begge,            // øget følsomhed efterfølgende
    glykogenRestitution: begge             // genopfyldning over timer
}
```

### Vigtige læringspoints for nydiagnosticerede
- Cardio uden bolus-justering → hypoglykæmirisiko
- Styrketræning kan kræve korrektionsinsulin efterfølgende
- Motion om aftenen → øget natlig hypoglykæmirisiko
- Forsinket hypoglykæmi 6–12 timer efter intensiv træning

---

## Stresshormon-system (implementeret)

### Oversigt
`js/simulator.js` har et to-lags stresshormon-system der driver hepatisk glukoseproduktion (HGP):

```javascript
// I Simulator-konstruktøren:
this.acuteStressLevel  = 0.0;  // adrenalin/glukagon — t½ ~60 sim-min
this.chronicStressLevel = 0.0; // kortisol — t½ ~12 sim-timer
```

`stressMultiplikator = 1.0 + acuteStressLevel + chronicStressLevel + circadianKortisolNiveau`
bruges i `update()` til at skalere HGP: `liverGlucoseProduction = 0.02 × stressMultiplikator`

### circadianKortisolNiveau (getter — erstatter gammelt dawnFaktor)
Modellerer det fysiologiske kortisol-døgnrytme-peak om morgenen med kvart-sinuskurver:
- Stiger 04:00 → peak 08:00 (sinuskurve fremgang)
- Falder 08:00 → nul kl. 12:00 (cosinuskurve)
- Amplitude: 0.3 (svarer til ~30% øget HGP på toppen)

### Washout (eksponentiel henfald i updateStressHormones)
```javascript
akutHenfaldskonstant  = ln(2) / 60         // t½ = 60 sim-min
kroniskHenfaldskonstant = ln(2) / (12×60)  // t½ = 12 sim-timer
```

### Automatiske triggers
- `trueBG < 3.5` → Somogyi: akutStress += 0.015–0.04 per sim-min
- Høj intensitets-motion → akutStress += 0.02 per sim-min (katekolamin-respons)

### insulinResistanceFactor
Tidligere dead code (altid 1.0). Nu dynamisk i `currentISF` getter:
`insulinResistanceFactor = 1.0 + chronicStressLevel × 0.5`

### Offentlige API-metoder til baner/scenarier
```javascript
simulator.addAcuteStress(amount)    // fx styrketræning, chok
simulator.addChronicStress(amount)  // fx sygdom, søvnmangel
```

---

## Rettede bugs (session marts 2026)

| Bug | Fil | Beskrivelse |
|-----|-----|-------------|
| `showPopup()` viste intet | `js/ui.js` | `document.body.appendChild(overlay)` manglede |
| Motion-knap låste op for tidligt | `js/simulator.js` | `setTimeout` brugte real-tid; erstattet med `updateMotionButtonStatus()` der tjekker simuleret tid hvert tick |
| `yAxisMax` nulstiltes ikke | `js/game.js` | Tilføjet `yAxisMax = 12.0` i `resetGame()` |
| `insulinResistanceFactor` var dead code | `js/simulator.js` | Altid 1.0; nu koblet til `chronicStressLevel × 0.5` |

---

## GitHub

Repository: https://github.com/krauhe/t1d-simulator

---

## Fysiologisk modelarkitektur — langsigtet vision

### "Motorhjælmen" — visualisering af interne processer
Et centralt pædagogisk mål er at brugeren kan åbne et panel der viser de fysiologiske processer i realtid — pile, flux og værdier mellem modulerne. Kræver modulær arkitektur fra starten.

### Hierarkisk modulstruktur
```
GLUCOSE MODULE
- Input:  insulin (IOB), kulhydrater, motion, HGP
- Output: BG (mmol/L)
- Clamp:  1.5–35 mmol/L

HORMONE MODULE  ← delvist implementeret (se Stresshormon-system ovenfor)
- Variable: glukagon, kortisol, adrenalin, væksthormon
- Samlet stressLevel (0-1) driver alle proportionalt
- Stimuli:  hypoglykæmi, motion, sygdom, søvnmangel,
            dawn-fænomen, Somogyi rebound
- To tidskonstanter (IMPLEMENTERET):
  acuteStressLevel  (adrenalin/glukagon): t½ ~60 sim-min
  chronicStressLevel (kortisol):          t½ ~12 sim-timer

INSULIN MODULE
- IOB, absorption, clearance
- Kompartmentmodel per insulintype (se ovenfor)

KETON MODULE
- Input:  IOB, stressLevel, fasteperiode, kulhydratindtag
- Drives primært af insulinmangel — ikke direkte af BG
- Clamp:  0–20 mmol/L
- Edge cases: starvation ketose, pumpesvigt
```

### Dawn-fænomenet (IMPLEMENTERET som circadianKortisolNiveau)
- Kortisol-peak modelleret med kvart-sinuskurve: stiger 04:00 → peak 08:00 → nul kl. 12:00
- Feeds direkte ind i stressMultiplikator (samme pipeline som acuteStress og chronicStress)
- Vigtigt læringspoint: høj morgen-BG er ikke patientens skyld

### Somogyi-effekten (IMPLEMENTERET i updateStressHormones)
- Natlig hypoglykæmi → kontraregulatorisk akutStress-stigning → rebound hyperglykæmi
- Omdiskuteret i litteraturen — implementer med forbehold

### Stabilitet
- Alle moduler har fysiologiske clamp-værdier
- Positive feedback loops (fx ketoacidose-spiral) skal have eksplicitte break-betingelser
- Reference for valideret T1D-model: Hovorka 2004 (bruges i closed-loop/kunstig bugspytkirtel forskning)

### Modulgrænseflader (JavaScript)
```javascript
// Hvert modul eksponerer:
getCurrentState()  // realtidsværdier til UI og motorhjælm
getFlux()          // aktuelle rates til visualisering af pile
update(dt)         // opdater med tidsstep dt (minutter)
```
