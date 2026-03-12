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
- **Opdater `docs/VIDENSKAB.md`** løbende med nye emner der er relevante for blodglukoseregulering — også selvom de ikke implementeres i simulatoren. Dokumentet skal være en komplet videnskabelig oversigt over alle faktorer der påvirker BG ved T1D.
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
  FYSIOLOGI.md  ← Beskrivelse af fysiologiske modeller, videnskabelige kilder, credits
  VIDENSKAB.md  ← Systematisk gennemgang af ALLE faktorer der påvirker BG (23+ emner med referencer)
  references/   ← Hentede videnskabelige artikler. Format: Efternavn_Årstal[_RW]_Titel.ext
tests/
  simulation.test.js  ← Automatiserede tests (28 stk), kør med: node tests/simulation.test.js
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

### Basale forbedringer (gør først)
1. Moderne brugerinterface — ikke 90'er-stil
2. "Du døde"-skærm med forklaring på dødsårsag (hypoglykæmi, ketoacidose osv.)
   - 2b: Bedre definition af ketoacidose med symptomindikation før død
   - 2c: Mulighed for ketose-stik måling
3. ~~Personprofil — bruger kan indtaste vægt, ICR og ISF så simulatoren matcher deres egen diabetes~~ ✅ IMPLEMENTERET
   - ~~3b: Spillet initieres fra midnat med stabilt blodsukker baseret på ICR og korrekt basal forudindgivet~~ ✅ IMPLEMENTERET
   - Profil-popup vises ved klik på "Start Simulation" med vægt, ICR, ISF
   - Basal dosis beregnes via 100-reglen: TDD = 100/ISF, basal = 45% af TDD
   - Hvileforbrug skaleres med vægt (2200 kcal/dag ved 70 kg)
   - Profil gemmes i localStorage og huskes mellem sessioner
   - Vægt, basal dosis og hvileforbrug vises i stats-panelet

### Mellemfristede features
4. Highscore-liste med navn
5. Sandkasse-tilstand med scenarier/forhindringer man kan aktivere

### Høj prioritet (fysiologisk vigtig)
6. Non-lineær insulin dosis-respons (sigmoid/Hill-kurver)
    - Lever, muskel og fedtvæv har forskellige aktiveringstærskler (EC50-værdier)
    - Lever: EC50 ~29 μU/mL, Muskel: EC50 ~55 μU/mL (Rizza 1981)
    - Under insulinresistens vokser gabet → "dødzone" hvor insulin tilsyneladende ikke virker
    - Implementering: erstat lineære x1/x2/x3-effektligninger med Hill-funktioner
    - Kræver re-kalibrering af alle parametre og nye tests
    - Se VIDENSKAB.md afsnit 25 for fuld videnskabelig baggrund
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
    - Fysiologi-hjælp: popup-tips der forklarer hvad der sker ("Din insulin er ved at peake", "Motion sænker dit BG pga. tre mekanismer: ...")
    - Evt. foreslåede handlinger ("Du bør overveje at spise noget inden motion")
    - Fysiologi-panelet (TODO #8) altid synligt i easy mode
    - God onboarding for spillere der aldrig har styret T1D

9b. Fedt-forsinkelse af kulhydratabsorption ("pizza-effekten")
    - **STATUS: IKKE IMPLEMENTERET** — koden accepterer `fat` parameter men justerer IKKE τG
    - Eksponeret af modelvalidering (test 13): fedt-kurve er identisk med ren KH-kurve
    - Fedt bør forsinke mavetømning → højere τG → bredere, lavere BG-peak
    - Implementering: dynamisk τG baseret på måltidets fedtindhold (fx τG = 40 + fat * 0.5)
    - Klinisk vigtigt: "pizza-effekten" er et af de mest forvirrende fænomener for T1D-patienter
    - Se også TODO #37 (mad-interaktion) og #38 (differentierede sukkertyper)

### Fremtidige features (tænk fremad i arkitekturen)
10. Baner — realistiske hverdagsscenarier, fx:
    - "Du løber 10 km til skolernes idrætsdag kl. 11–12"
    - "Du glemte din insulin hjemmefra"
    - "Du har feber" (øget insulinbehov)
    - Uforudsete hændelser midt i en bane (fx uvirksom insulin pga. varme/kulde)
    - Grafiske illustrationer af fysiologiske processer til ikke-fagkyndige
11. Standard Diabetes-rapport (AGP):
    - Estimeret HbA1c / GMI: `GMI = 3.31 + 0.02392 × mean_glucose_mg/dL`
    - Gennemsnitlig glukosekurve med percentiler (25/50/75)
    - TIR (4–10 mmol/L), TAR (> 10), TBR (< 4)
    - Samlet insulinforbrug
12. Multiplayer/familie-konkurrence om bedste blodsukkerkontrol
13. Giv adgang til fysiologi-dokumenterne (docs/FYSIOLOGI.md og docs/VIDENSKAB.md) et sted i spillet — fx en "Videnskab"-knap i hjælp-popuppen eller en separat side
14. Mere prominent disclaimer med flueben der skal bekræftes før spillet starter
15. Kønsvalg (mand/kvinde) — påvirker BMR-beregning og evt. fysiologiske parametre
16. Sprogskift (dansk/engelsk)
    - **UI-labels:** Opret `js/i18n.js` med alle UI-strings i ét objekt per sprog (`da`, `en`)
    - Alle hardcoded tekster i HTML/JS erstattes med `i18n[lang].nøgle`
    - Sprogskifter-knap i settings-området (fx flag-ikon 🇩🇰/🇬🇧)
    - Gem valgt sprog i localStorage
    - **Docs:** Skriv FYSIOLOGI.md og VIDENSKAB.md på engelsk (primært sprog, bredere publikum)
    - Evt. dansk version som `FYSIOLOGI.da.md` / `VIDENSKAB.da.md` (lavere prioritet)
    - **README.md:** Engelsk (GitHub-standard)
    - Script-load rækkefølge: `i18n.js` → `sounds.js` → ... (skal loades først)
17. Avanceret debug-panel med alle interne variable synlige
18. Mad-billede upload (genkend makronæring fra foto — AI-integration)
19. ~~Styrketræning som separat motionstype (anaerob → akut BG-stigning)~~ ✅ IMPLEMENTERET
    - Fire aktivitetstyper: Cardio, Styrketræning, Blandet sport, Afslapning
    - Hver type har unik fysiologisk profil (e1Scaling, stress, stressReduction)
    - Parametre defineret i AKTIVITETSTYPER-objekt i simulator.js
20. ~~Stop/afbryd motion-knap~~ ✅ IMPLEMENTERET
    - Stop-knap i dock-panel + floating overlay på grafen
    - Varighed-valg: 15/30/60/åben (∞)
    - Auto-stop ved planlagt varighed, manuel stop når som helst
21. Ketonmåling med omkostning (begrænset antal stik eller tidscooldown)
22. Fingerprik med omkostning (simuler at strimler koster penge)
23. Væskebalance-model (lav prioritet — mest relevant for DKA-advarsler)
24. Menstruationscyklus-effekt på insulinfølsomhed
    - Lutealfasen (ca. dag 15–28): insulinfølsomhed falder ~50% (progesteron-drevet)
    - Follikulærfasen (dag 1–14): normal/øget insulinfølsomhed
    - Kræver kønsvalg (TODO 15) + cykluslængde-input
    - Klinisk relevant: mange kvinder med T1D oplever uforklarlig hyperglykæmi før menstruation
    - Reference: Yeung et al. 2024, Diabetes Care — Si falder fra 5.03 til 2.22 i lutealfase
25. ~~Døgnvariation i insulinfølsomhed (cirkadisk ISF)~~ ✅ IMPLEMENTERET
    - Hybrid model: HGP dawn (amplitude halveret til 0.15) + circadianISF (0.70–1.20)
    - Morgen kl. 08: ISF ×0.70 + HGP ×1.15 → ~43% mere insulin nødvendigt
    - Aften kl. 19: ISF ×1.20 → insulin virker ~17% bedre
    - Inspireret af Toffanin 2013, dæmpet 50%, justeret efter klinisk erfaring
    - Bygget på mangelfuld evidens — bør opdateres ved bedre data (Hinshaw 2013: mønster er individuelt)
26. Alders-afhængigt insulinbehov
    - Børn/teenagere: højere insulinresistens pga. væksthormon → højere basalbehov per kg
    - Voksne: relativt stabilt insulinbehov
    - Ældre (>65): øget insulinfølsomhed, men også nedsat kontraregulering
    - Puberteten: op til 50% øget insulinbehov (væksthormon-peak)
    - Kunne implementeres som aldersjusteret ISF/ICR i profil-popup
    - Reference: Scheiner "Think Like a Pancreas", kapitel om livsaldre
27. Sæsonvariation i insulinbehov
    - HbA1c typisk højere om vinteren (9.1% vs 7.7% i en ungdomsstudie)
    - Flere hypoglykæmi-episoder om sommeren (øget aktivitet, varme)
    - Lav prioritet — mest relevant for langvarige simulationer
    - Osmotisk diurese ved BG > 10 mmol/L (tørst, hyppig vandladning)
    - Dehydrering forværrer DKA-forløb
    - Kunne forbedre symptom-advarsler, men risikerer at forstyrre gameplay
    - Overvej kun til "avanceret" tilstand eller baner med sygdomsscenarier
28. Alkohol-effekt på blodsukker
    - Akut: alkohol hæmmer glukoneogenese i leveren → hypoglykæmirisiko
    - Forsinket effekt: op til 12-24 timer efter indtagelse
    - Klinisk relevant: T1D-patienter skal være særligt opmærksomme
29. Bruger-styret søvn/vågentid
    - Spiller bestemmer selv hvornår de "går i seng" og "står op"
    - Påvirker dawn-fænomenet, søvnkvalitet, og natlige interventioner
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
      - Protein-gluconeogenese driver indirekte ketogenese (oxaloacetat-forbrug)
    - **DKA-behandling i spillet:** spilleren skal give sukker + insulin sammen
      (insulin stopper ketoner, men sukker forhindrer hypo under behandling)
    - **Pædagogisk mål:** vis at ketoner 1-3 ved faste/low-carb er normalt og uskadeligt
    - **Low-carb fordel:** simulér at færre kulhydrater = jævnere BG, mindre variabilitet
    - Se VIDENSKAB.md afsnit 23 for fuld videnskabelig baggrund og referencer
31. Symptom-indikationer på grafen (hypo + DKA)
    - **Hypo-symptomer** (trueBG < ~3.5-3.8): svedtendens, rysten, hjertebanken, sultfølelse
      - Afhængig af HAAF/counterRegFactor: jo mere svækket → jo svagere/senere symptomer
      - Ved intakt counterRegFactor (~1.0): tydelige symptomer ved BG 3.5-3.8
      - Ved svækket counterRegFactor (<0.5): symptomer først ved BG < 3.0 ("unawareness")
    - **DKA-symptomer** (ketoner > 1.5–3.0): tørst, kvalme, mavesmerter, hurtig vejrtrækning, acetonlugt
      - Fader gradvist ind på grafen som tekst-overlays ("Tørst...", "Kvalme...")
      - Intensitet proportional med ketonniveau
      - Pædagogisk: spilleren lærer at genkende tidlige DKA-tegn INDEN det bliver kritisk
    - Visuelt: halvgennemsigtige tekst-labels der fader ind over grafen, evt. med pulserende effekt og lyd
    - Pædagogisk: spilleren lærer at symptomer er kroppens alarm — og at de kan slukkes af gentagne hypoer (HAAF)
    - Kobling til HAAF-model: `counterRegFactor` bestemmer tærskel og intensitet for hypo-symptomer
32. Kalorieindhold vist på mad (kcal-mål synligt ved måltider)
33. Game over-betingelser skal være synlige i spillet
    - Spilleren skal kunne se alle metrics der kan føre til game over
    - 7-dages gennemsnit BG skal vises i statistik (allerede delvist implementeret)
    - Vægtændring slider allerede synlig
    - Keton-niveau bør være synligt (ikke kun ved stik)
    - Evt. "faresignaler" i UI når man nærmer sig game over-grænser
34. Fysiologi-dokumenter som læsbare tekster
    - FYSIOLOGI.md og VIDENSKAB.md skal omskrives til egentlige tekster for mennesker
    - Ikke kun interne AI-noter — skal kunne læses af patienter, pårørende og sundhedspersonale
    - På sigt tilgængelige fra spillet (se TODO #13)
35. UI-redesign: RTS-inspireret layout
    - Grafen som hovedvisning (svarende til "spillefeltet")
    - Interventioner som ikoner med undermenuer i kanterne
    - Statistik i fold-ind/ud panel
    - Plads til bane-valg/præsentation i fremtiden
    - Mørkt, konsekvent farveskema (CGM-app møder spil-HUD)
    - Mockup: `mockups/rts-layout.html`
36. Lyd-redesign
    - Revurder hele lydsiden som del af UI-løftet
    - Feedback-jingles: positiv lyd i target range, advarselstoner ved farezoner
    - Kontekstuelle lyde: insulin-injektion, madspising, motion-start
    - Stigende intensitet ved faldende/stigende BG (ikke bare én alarm)
    - Ambient/baggrundslyd til at indikere generel tilstand (rolig=godt, urolig=fare)
    - Vigtigt: lyde skal være subtile og ikke irriterende — spilleren skal VILLE have dem tændt
37. Mad-interaktion: tidligere måltider påvirker efterfølgende
    - Fedt i et måltid forsinker mavetømning → næste måltid kort efter absorberes også langsommere?
    - Undersøg hvad nuværende implementering understøtter (D1/D2 kompartmenter deles allerede)
    - Fiber før kulhydrat: bremser glukoseoptag (klinisk anbefalet strategi)
38. Differentierede sukkertyper
    - Glukose (dextrose): absorberes direkte, hurtigst mulige BG-stigning (τG ~10-15 min)
    - Saccharose (bordsukker, lakridskonfekt): skal spaltes først → lidt langsommere (τG ~25-35 min)
    - Stivelse (brød, ris): endnu langsommere (τG ~40-60 min)
    - Klinisk relevant: glukose til akut hypo-korrektion, langsommere sukker når der er tid
    - Kunne implementeres som forskellige τG-værdier per madtype
39. Bane-intro med fysiologi-tips
    - Før en bane starter: vis kort beskrivelse af relevant fysiologi og tricks
    - Fx motion-bane: "Motion sænker BG mest med aktiv insulin. Overvej at reducere bolus eller spise ekstra."
    - Pædagogisk funktion: spilleren lærer fysiologien INDEN de møder udfordringen
40. Glidende graf (LibreLink-stil)
    - Når grafen er fyldt: nye data skubbes ind fra højre, gamle data glider ud til venstre
    - Nuværende tid altid ved højre kant
    - Giver en "levende" fornemmelse i stedet for statisk fyld-fra-venstre
    - Som i Freestyle LibreLink appen — spilleren kender konceptet fra sin CGM
    - Mockups: `mockups/hud-overlay.html`, `mockups/card-dock.html`
41. "Dino-bane" — arkade-mode med forhindringer
    - Glidende graf + forhindringer der kommer ind fra højre (som Googles offline dino-spil)
    - Spilleren skal styre BG-kurven gennem åbninger (target range)
    - Forhindringer tvinger til hurtige beslutninger (insulin/mad/motion)
    - Fjollet/sjov bane der træner reaktionsevne og intuition for BG-dynamik
    - Kræver glidende graf (TODO #40) som fundament

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
