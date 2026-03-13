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

### Ændringsregler
- **Ændr KUN det brugeren specifikt beder om** — lav ikke ekstra rettelser, refaktoreringer eller "forbedringer" medmindre de er direkte nødvendige for opgaven
- Ved tvivl: spørg i stedet for at antage

### Kommunikation
- Svar altid på dansk
- Forklar hvad du har ændret og hvorfor efter hver opgave
- Ved større ændringer: vis plan først, kód bagefter
- Foreslå gerne forbedringer men implementer dem ikke uden godkendelse
- Bevar altid simulationslogikken intakt ved UI-ændringer
- **Foreslå ALTID at committe og pushe før store ændringer** — så der altid er et sikkert fallback-punkt
- **Dokumentation: engelsk er primær, dansk er oversættelse.**
  - Opdatér altid den engelske version først: `docs/MODEL-IMPLEMENTATION.md` og `docs/BG-SCIENCE.md`
  - Bump `<!-- doc-version: YYYY-MM-DD-vN -->` markøren i toppen ved indholdsmæssige ændringer
  - Danske oversættelser (`docs/MODEL-IMPLEMENTERING.da.md`, `docs/BG-VIDENSKAB.da.md`) har en `<!-- translated-from: FILE doc-version: ... -->` markør der skal matche den engelske version
  - Kør `bash tests/check-doc-sync.sh` for at tjekke at danske docs er i sync med engelske
  - Opdatér `docs/BG-SCIENCE.md` løbende med nye emner der er relevante for blodglukoseregulering — også selvom de ikke implementeres i simulatoren. Dokumentet skal være en komplet videnskabelig oversigt over alle faktorer der påvirker BG ved T1D.
- **Hent ALTID relevante videnskabelige artikler** ned i `docs/references/` når nye emner tilføjes eller researches. Kilder skal så vidt muligt downloades som PDF. Filnavns-format: `Efternavn_Årstal[_RW]_Titel.ext` (fx `Hovorka_2004_NonlinearMPC.pdf`, `Cryer_2013_RW_GlucoseCounterregulation.pdf`). RW tilføjes kun ved review-artikler. Hvis PDF ikke er tilgængelig, gem som `.html` fra PMC eller lignende.

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

### Layout-regler
- **Alle UI-elementer har runde hjørner** — paneler, graf, chart-område, knapper, badges. Brug CSS-variablerne `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px), `--radius-xl` (18px).
- Canvas-grafens interne chart-område (zoner, nat-shading) klippes med `roundRect` clip-path så det matcher grafens border-radius.
- BG-panelet (#cgm-hero) er placeret INDEN FOR det farvede chart-område, ikke uden for det.
- Alle tal-displays bruger `font-variant-numeric: tabular-nums` med Inter-fonten (Orbitron understøtter IKKE tabular-nums og må kun bruges til logo/brand).
- **Top-bar paneler skal have samme højde og flugte i top og bund.** Top-bar har ingen baggrund — de individuelle paneler (time-control, datetime-badge, points, settings) svæver frit med egen baggrund/border.
- **Ensartet spacing:** Alle paneler skal have den samme afstand imellem hinanden OG imellem panelerne og browserens ydre kant. Brug CSS-variablen `--panel-gap` til dette.
- **Paneler over grafen skal være halvgennemsigtige + blurrede** — CGM hero, points overlay og dock-paneler bruger `--bg-card-glass` (50% alpha) + `backdrop-filter: blur(24px)` så man kan se grafen opdatere bagved. Brand/slogan-teksten skal ALDRIG wrappe (`white-space: nowrap`).

---

## Fil-struktur

```
index.html      ← HTML-struktur og layout
style.css       ← Al CSS-styling
js/
  sounds.js     ← Lyd-opsætning (Tone.js) og playSound()
  hovorka.js    ← Hovorka 2004 glukose-insulin model (11 ODE'er, valideret)
  simulator.js  ← Simulator-klassen: bruger HovorkaModel + spilmekanik
  ui.js         ← Tegning af graf, opdatering af UI, popups, logning, profil-popup
  game.js       ← Game loop, startGame, resetGame, togglePause
  main.js       ← Globale variable, DOM-referencer, event listeners, init
docs/
  MODEL-IMPLEMENTATION.md      ← Engelsk (primær) — fysiologiske modeller, videnskabelige kilder, credits
  BG-SCIENCE.md         ← Engelsk (primær) — systematisk gennemgang af ALLE faktorer der påvirker BG
  MODEL-IMPLEMENTERING.da.md    ← Dansk oversættelse af MODEL-IMPLEMENTATION.md
  BG-VIDENSKAB.da.md    ← Dansk oversættelse af BG-SCIENCE.md
  references/        ← Hentede videnskabelige artikler. Format: Efternavn_Årstal[_RW]_Titel.ext
tests/
  simulation.test.js   ← Automatiserede tests (47 stk), kør med: node tests/simulation.test.js
  model-validation.html ← Visuel modelvalidering i browser
  check-doc-sync.sh    ← Tjek at danske docs matcher engelske versioner
old/            ← Original enkeltfil-version (TB1Sim v42 beta.html) + referencefiler
```

Script-load rækkefølge i index.html (rækkefølgen er vigtig, da filer deler globalt scope):
`sounds.js` → `hovorka.js` → `simulator.js` → `ui.js` → `game.js` → `main.js`

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

### Basale forbedringer
5. Sandkasse-tilstand med scenarier/forhindringer man kan aktivere

### Høj prioritet (fysiologisk vigtig)
6. Non-lineær insulin dosis-respons (sigmoid/Hill-kurver)
    - Lever, muskel og fedtvæv har forskellige aktiveringstærskler (EC50-værdier)
    - Lever: EC50 ~29 μU/mL, Muskel: EC50 ~55 μU/mL (Rizza 1981)
    - Under insulinresistens vokser gabet → "dødzone" hvor insulin tilsyneladende ikke virker
    - Implementering: erstat lineære x1/x2/x3-effektligninger med Hill-funktioner
    - Kræver re-kalibrering af alle parametre og nye tests
    - Se BG-SCIENCE.md afsnit 25 for fuld videnskabelig baggrund
7. Insulin-kurver på grafen (visuelt overlay)
    - To linjer: hurtigvirkende (fx blå) og langtidsvirkende (fx lilla)
    - Tykkelse/amplitude proportional med aktiv insulin i systemet
    - Skygge-estimat fremad i tid: beregnet fra forventet absorption UDEN motion
    - Reel kurve fyldes ind efterhånden og afspejler faktisk absorption (med HR/pulsFaktor)
    - Forskellen mellem skygge og reel kurve visualiserer motionens effekt på absorption
    - Sekundær y-akse eller normaliseret overlay oven på BG-grafen
8. Fysiologi-panel — "motorhjelmen"
    - Realtidsvisning af alle fysiologiske processer der påvirker BG lige nu
    - Pile op/ned med størrelse proportional til processens styrke:
      - ↑ Leverproduktion (EGP) — stor pil om morgenen (dawn), lille i hvile
      - ↑ Mad-absorption (UG) — stor pil efter måltid
      - ↓ Insulinvirkning (x1+x2+x3) — stor pil efter bolus
      - ↓ Muskeloptag (E1) — stor pil under motion
      - ↑ Stresshormoner — pil ved hypo/motion
      - ↓ Nyreudskillelse (FR) — pil ved højt BG
      - ↓ Hjerneforbrug (F01c) — konstant lille pil
    - Netto-pil der viser den samlede retning (stiger/falder/stabilt)
    - Evt. fold-ud panel ved siden af/under grafen
    - Centralt pædagogisk værktøj: spilleren ser HVORFOR BG ændrer sig
9. Easy mode — sværhedsgrad for nybegyndere
    - Ingen variabilitet: bioavailability=1.0, tauFactor=1.0, fast basal-varighed
    - Ingen CGM-støj/drift/diskontinuiteter — CGM viser sandt BG
    - Fysiologi-hjælp: popup-tips der forklarer hvad der sker
    - Fysiologi-panelet (TODO #8) altid synligt i easy mode
9b. ~~Protein-modellering — protein → glukoneogenese → forsinket BG-stigning~~ ✅ IMPLEMENTERET
    - Kompartmentmodel: proteinStomach →(τG)→ proteinGut →(τProtAbs=90min)→ aminoAcidsBlood
    - Aminosyrer stimulerer glukagonsekretion via Hill-funktion (EC50=8g, n=2, max=0.25)
    - Glukagon driver HGP via stressMultiplier (IKKE direkte kulhydrat-ækvivalent)
    - Onset ~60-90 min, peak ~150-180 min, varighed >5 timer (matcher Paterson 2016)
    - Tærskeleffekt: <10g protein = minimal effekt, ≥75g = signifikant BG-stigning
    - Glykogen-afhængig: ~50% glycogenolyse + ~50% gluconeogenese
    - Kilder: Paterson 2016, Smart 2013, Fromentin 2013, Gannon 2001/2013, Bell 2015/2020
9c. ~~Fedt-forsinkelse af kulhydratabsorption ("pizza-effekten")~~ ✅ IMPLEMENTERET
    - Fedt-kompartmentmodel: fatStomach →(τG)→ fatIntestine →(τFatAbs=150min)→ absorberet
    - τG = 40 + 18 × ln(1 + fatIntestine / 10) — logaritmisk mætning
    - Kalibreret mod Smart 2013 (35g fedt → ~47 min forsinkelse)
    - Mad-interaktion (TODO #37): fedt fra tidligere måltid forsinker efterfølgende automatisk
9d. FFA-induceret insulinresistens (forsinket fedt-effekt)
    - Frie fedtsyrer fra fordøjelse hæmmer insulinvirkning i muskel
    - Effekt starter ~2-4 timer efter fedt-måltid, peak ~5-6 timer
    - Wolpert 2013: 60g fedt → 42% mere insulin nødvendigt, effekt 5-10 timer
    - Implementering: ISF-reduktion proportional med absorberet fedt, forsinket
    - Giver "anden bølge" af pizza-effekten (sen hyperglykæmi)

9e2. Glukotoksicitet — hyperglykæmi-induceret insulinresistens
    - Vedvarende højt BG (>10-12 mmol/L) forværrer insulinfølsomhed progressivt
    - 24 timer ved 20 mmol/L → 26% reduktion i glukoseoptagelse (Vuorinen-Markkola 1992)
    - Dårligt reguleret T1D (HbA1c >9%) → 30-50% mere insulin nødvendigt
    - Mekanismer: oxidativt stress, hexosamin-pathway, AGEs, PKC-aktivering, GLUT4-nedregulering
    - Implementering: dynamisk ISF-modifikator baseret på rullende BG-gennemsnit (24-72 timer)
    - Tærskel ~10-12 mmol/L, maks ~30-40% ISF-reduktion ved BG >20 mmol/L
    - Opløsning: eksponentiel decay med t½ ~24-48 timer efter normalisering
    - Interagerer med (men separat fra) FFA-induceret resistens (9d)
    - Se BG-SCIENCE.md afsnit 28 for fuld videnskabelig baggrund

30. Udvidet ketonmodel (IOB-drevet, ikke BG-drevet)
    - **Nuværende model er forkert:** ketoner stiger kun ved insulinmangel + BG > 12
    - **Korrekt:** ketogenese drives af lavt INSULIN-niveau, ikke højt blodsukker
    - Kaskade: lav insulin → lipolyse → FFA → beta-oxidation → ketoner
    - Lipolyse har laveste EC50 af alle insulin-processer (~100 pmol/L vs ~300 for glukose)
    - **To ketose-typer der skal modelleres:**
      - Faste/low-carb ketose: kontrolleret, 0.5-3 mmol/L, uskadelig, insulin til stede
      - DKA-ketose: ukontrolleret, 3-25+ mmol/L, livstruende, ingen insulin
    - **Design (inspireret af Pinnaro 2021):**
      - Ketonproduktion = f(IOB) — stiger når IOB < tærskel (fx 1.5 × basalrate)
      - BG er IKKE en input til ketonproduktion
      - Keton-clearance: mætnelig (Michaelis-Menten) — langsommere ved høje niveauer
    - Se BG-SCIENCE.md afsnit 23 for fuld videnskabelig baggrund og referencer

### Fremtidige features (tænk fremad i arkitekturen)
9e. Fysiologisk ordbog / glossar
    - In-game opslagsværk over underliggende fysiologiske effekter (dawn, Somogyi, pizza, HAAF, FFA-resistens...)
    - Tilgængelig fra hjælp-popup eller som selvstændigt panel
4. Global/delt highscore-liste (online leaderboard)
10. Baner — realistiske hverdagsscenarier
11. Standard Diabetes-rapport (AGP)
12. Multiplayer/familie-konkurrence
15. Kønsvalg (mand/kvinde) — påvirker BMR-beregning og evt. fysiologiske parametre
18. Mad-billede upload (genkend makronæring fra foto — AI-integration)
23. Væskebalance-model (lav prioritet — mest relevant for DKA-advarsler)
24. Menstruationscyklus-effekt på insulinfølsomhed
    - Kræver kønsvalg (TODO 15) + cykluslængde-input
    - Reference: Yeung et al. 2024, Diabetes Care
26. Alders-afhængigt insulinbehov
27. Sæsonvariation i insulinbehov
28. Alkohol-effekt på blodsukker
29. Bruger-styret søvn/vågentid
31. Symptom-indikationer på grafen (hypo + DKA)
    - Hypo-symptomer afhængig af HAAF/counterRegFactor
    - DKA-symptomer fader gradvist ind som tekst-overlays
34. Fysiologi-dokumenter som læsbare tekster
35. UI-redesign: RTS-inspireret layout
36. Lyd-redesign
37. Mad-interaktion: tidligere måltider påvirker efterfølgende
38. Differentierede sukkertyper (glukose/saccharose/stivelse → forskellige τG-værdier)
39. Bane-intro med fysiologi-tips
40. Glidende graf (LibreLink-stil)
41. "Dino-bane" — arkade-mode med forhindringer (kræver #40)

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
