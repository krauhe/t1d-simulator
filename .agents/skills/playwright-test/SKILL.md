---
name: playwright-test
description: >
  Browser-baseret test af T1D-simulatoren via Playwright MCP.
  Brug denne skill når brugeren beder om at teste simulatoren i browseren:
  gameplay, fysiologi-validering, grafisk layout, tekst-synlighed, menuer,
  responsivt design, game modes, baner, game over, mad, high score,
  eller end-to-end flows. Trigger også ved "test i browser",
  "playtest", "tjek UI", "ser det rigtigt ud", "virker det", "screenshot",
  "test menuer", "test gameplay", "test baner", "test campaign".
---

# Playwright Test — T1D Simulator Browser Testing Skill

**ultrathink** — dette kræver systematisk testning, dyb observation og grundig analyse.
Brug altid max effort / highest reasoning level tilgængeligt.

Du er en QA-tester af en T1D diabetes-simulator der kører som en lokal HTML-fil
i browseren. Du bruger Playwright MCP-værktøjerne til at interagere med og
verificere simulatoren.

**Du er IKKE en ja-siger.** Din værdi ligger i at finde problemer.
Når noget virker korrekt, notér det kort. Brug din tid på det der er forkert,
uventet, eller visuelt problematisk. En test der finder 0 issues er mistænkelig —
kig igen.

---

## OPSÆTNING

### Åbn simulatoren
Start en lokal server fra projektroden og navigér altid til denne URL:
```
http://127.0.0.1:8765/index.html
```

Standardserver:
```
python -m http.server 8765 --bind 127.0.0.1
```

Brug ikke `file://` i Playwright-tests. Codex/Playwright MCP kan blokere
file-protokollen, og browser-tests bliver mere stabile via lokal HTTP.

### Vigtige browser-indstillinger
- Standardstørrelse: 1280×800 (laptop). Test også 1920×1080 og 375×667 (mobil).
- Simulatoren bruger dansk som default-sprog.

### Genstart mellem tests
Mellem uafhængige test-suiter: reload siden (`browser_navigate` til URL igen)
for at få en frisk tilstand. Simulatoren har global state der ikke nulstilles
uden page reload.

### Output-mappe
**VIGTIGT:** Opret en dedikeret mappe til HVER evaluering:
```
tests/playwright/YYYY-MM-DD_HH-MM/
```
**ALLE output fra evalueringen** gemmes i denne mappe — både screenshots OG
rapport-filen (txt). Intet gemmes i projektroden.
```
tests/playwright/2026-04-07_14-30/
  01_startskærm.png
  02_sandbox_baseline.png
  03_ISSUE_tekst_klippet_dock.png
  04_campaign_bane1_start.png
  ...
  rapport.txt                    ← rapporten gemmes OGSÅ her
```

**Issues-screenshots:** Når du finder et problem, tag ALTID et screenshot med
præfiks `ISSUE_` i filnavnet og en kort beskrivelse af problemet.
Tag også gerne et "forventet" screenshot fra en tilstand der fungerer korrekt,
som kontrast.

---

## TEST-SUITER

Brugeren kan bede om specifikke suiter eller "kør alt". Vælg den relevante
suite baseret på brugerens forespørgsel. Hvis brugeren ikke specificerer,
spørg hvilken suite de vil køre.

---

### Suite 1: SMOKE TEST (hurtig — ~2 min)
**Formål:** Verificér at simulatoren starter og basale funktioner virker.

1. **Indlæsning**
   - Navigér til index.html
   - Tag screenshot af startskærm
   - Verificér at `#startButton` er synligt
   - Verificér at der IKKE er JavaScript-fejl i konsollen
   - Tjek at Tone.js loaded (netværksforespørgsel til CDN)

2. **Start spillet**
   - Klik `#startButton`
   - Vent 2 sekunder
   - Verificér at `#cgmValueDisplayGraph` viser et tal (ikke "-.-")
   - Verificér at `#dayDisplay` viser "Dag 1" eller "Day 1"
   - Verificér at `#timeDisplay` viser et klokkeslæt
   - Tag screenshot af kørende spil

3. **Grundlæggende interaktion**
   - Klik på mad-dock-item → verificér at `#dock-panel-food` åbner
   - Klik på insulin-dock-item → verificér at `#dock-panel-insulin` åbner
   - Klik på motion-dock-item → verificér at `#dock-panel-motion` åbner
   - Luk paneler igen

4. **Konsol-fejl**
   - Hent alle konsol-fejl (`browser_console_messages` med level "error")
   - Rapportér eventuelle fejl

---

### Suite 2: GAMEPLAY & FYSIOLOGI (~5-10 min)
**Formål:** Verificér at gameplay virker og fysiologiske responser er korrekte.

1. **Start og baseline**
   - Start spillet i sandbox-mode
   - Sæt hastighed til max (klik `#speedUp` flere gange)
   - Vent til BG stabiliserer (~30 sim-min)
   - Aflæs baseline BG via `game.trueBG` (evaluate)
   - **Forventet:** BG ~4.5-7.0 mmol/L (faste-niveau med korrekt basal)

2. **Insulin-respons**
   - Aflæs nuværende BG
   - Giv 2E hurtigvirkende insulin (åbn insulin-panel, sæt slider, klik giv)
   - Vent ~60-120 sim-min (speed up)
   - Aflæs BG igen
   - **Forventet:** BG faldet med ~ISF×2 mmol/L (typisk 3-10 mmol/L fald)
   - Tjek IOB-display viser > 0

3. **Mad-respons**
   - Aflæs nuværende BG
   - Giv mad: klik pizza-knappen (eller brug custom food med 60g KH)
   - Vent ~30-60 sim-min
   - Aflæs BG igen
   - **Forventet:** BG steget mærkbart (>2 mmol/L over 60 min for 60g KH)
   - Tjek COB-display viser > 0

4. **Motion-respons**
   - Aflæs nuværende BG
   - Start cardio-motion: vælg type "cardio", intensitet "medium", varighed 30 min
   - Verificér at aktivitets-overlay vises (`#activity-overlay`)
   - Vent til motion er slut
   - Aflæs BG
   - **Forventet:** BG faldet under cardio (GLUT4-effekt)

5. **T1D Kit**
   - Klik fingerprick → verificér at popup viser et BG-tal
   - Klik ketontest → verificér at popup viser et keton-niveau
   - Tjek glucagon-knap er tilgængelig

6. **Hastigheds-kontrol**
   - Test pause/resume (klik `#pauseButton`)
   - Verificér at BG IKKE ændrer sig under pause
   - Test speed up/down
   - Verificér at `#speedLabel` opdateres

7. **Fysiologisk sanity check (via evaluate)**
   ```javascript
   ({
     trueBG: game.trueBG,
     cgmBG: game.cgmBG,
     iob: game.iob,
     cob: game.cob,
     ketones: game.ketoneLevel,
     day: game.day,
     time: game.timeInMinutes,
     weight: game.weight,
     isf: game.currentISF,
     brainDeficit: game.brainEnergyDeficit,
     acidosis: game.acidosisLoad
   })
   ```
   **Verificér:**
   - trueBG mellem 1.5 og 35 (clamp-grænser)
   - cgmBG tæt på trueBG (±2 mmol/L typisk)
   - iob ≥ 0, cob ≥ 0, ketoner ≥ 0
   - brainDeficit ≥ 0, acidosis ≥ 0

---

### Suite 3: GRAFISK LAYOUT & SKALERING (~5 min)
**Formål:** Verificér at alle UI-elementer vises korrekt og skalerer.

1. **Desktop layout (1280×800)**
   - Resize browser til 1280×800
   - Start spillet
   - Tag fullpage screenshot
   - Verificér via snapshot:
     - Top-bar er synlig med alle elementer
     - Graf/canvas fylder korrekt
     - Bottom-bar/dock er synlig
     - Ingen elementer overlapper
     - Ingen scrollbar (alt passer i viewport)

2. **Stor skærm (1920×1080)**
   - Resize til 1920×1080
   - Tag screenshot
   - Verificér at layout skalerer korrekt
   - Ingen store tomme områder

3. **Lille skærm (1024×768)**
   - Resize til 1024×768
   - Tag screenshot
   - Verificér at alt stadig er synligt og brugbart

4. **Mobil (375×667)**
   - Resize til 375×667
   - Tag screenshot
   - Verificér at layoutet tilpasser sig
   - Dock-knapper stadig klikbare

5. **Ultrawide (2560×1080)**
   - Resize til 2560×1080
   - Tag screenshot
   - Verificér at layoutet håndterer bredden

6. **Element-specifik screenshot-test**
   For hvert element, tag screenshot og verificér visuelt:
   - `#cgm-hero` — CGM-display synligt, tal læsbare
   - `#pointsOverlay` — points-display synligt
   - `#capsule-bar` — bottom bar korrekt layout
   - `#top-bar` — top bar korrekt layout
   - `#life-bars-panel` — life bars synlige og korrekte

---

### Suite 4: TEKST & LÆSBARHED (~3 min)
**Formål:** Verificér at al tekst er synlig, læsbar og ikke klippet.

1. **Hovedskærm — tekst-check**
   - Start spillet
   - Tag snapshot (accessibility tree)
   - Verificér at følgende tekster er til stede og ikke tomme:
     - Brand-tekst ("T1D SIMULATOR" eller "DIABETES-DYSTEN")
     - Dag/tid display
     - CGM-værdi
     - IOB/COB labels og værdier
     - Points-display
     - Speed-label
     - Dock-item labels

2. **Hjælp-popup**
   - Åbn hjælp (klik `#helpButton` eller find help-knap)
   - Tag screenshot
   - Verificér at teksten er til stede og formateret
   - Verificér at scrolling virker (hvis indholdet er langt)
   - Luk popup

3. **Profil-popup**
   - Åbn profil (klik `#profileButton`)
   - Tag screenshot
   - Verificér at alle labels er synlige
   - Verificér at input-felter har synlige værdier/placeholders
   - Luk popup

4. **Settings-dropdown**
   - Åbn settings (klik `#topSettingsButton`)
   - Tag screenshot
   - Verificér at alle toggles og labels er synlige
   - Luk dropdown

5. **Sprogskift**
   - Skift til engelsk via settings
   - Tag screenshot
   - Verificér at UI-tekster er skiftet (Day/Dag, Points/Point osv.)
   - Skift tilbage til dansk

6. **Tekst-overflow check**
   - Via evaluate: find elementer med overflow:hidden der har text-overflow
   - Tjek om noget tekst er klippet (scrollWidth > clientWidth)

---

### Suite 5: MENUER & NAVIGATION (~5 min)
**Formål:** Verificér at alle menuer åbner, lukker og fungerer korrekt.

1. **Dock-paneler (åbn/luk)**
   For hvert dock-panel (insulin, food, motion, kit):
   - Klik dock-item → verificér panel åbner
   - Klik igen → verificér panel lukker
   - Klik et ANDET dock-item → verificér at forrige panel lukker
     og nyt åbner (mutual exclusion)

2. **Insulin-panel detaljer**
   - Åbn insulin-panel
   - Verificér at preset-knapper (1, 2, 4, 8E) er synlige
   - Klik preset 4E → verificér slider opdateres til 4
   - Verificér at "Giv insulin"/"Give insulin" knap er synlig
   - Test slider: træk til min og max

3. **Mad-panel detaljer**
   - Åbn mad-panel
   - Verificér at alle mad-knapper er synlige med ikoner
   - Klik en mad-knap (pizza) → verificér at info opdateres
   - Toggle custom food → verificér at sliders vises
   - Test carbs/protein/fat sliders

4. **Motion-panel detaljer**
   - Åbn motion-panel
   - Verificér at type-chips er synlige (cardio, styrke, blandet, afslapning)
   - Klik en type → verificér selection state
   - Klik en intensity → verificér selection
   - Klik en duration → verificér selection
   - Start-knap tilgængelig efter alle tre valgt

5. **Side-drawers**
   - Klik stats-drawer tab (`#statsDrawerTab`) → verificér drawer åbner
   - Klik igen → verificér drawer lukker
   - Klik debug-drawer tab (`#debugDrawerTab`) → verificér drawer åbner
   - Verificér debug-værdier opdateres under kørende spil

6. **Popup-flow**
   - Åbn profil-popup → verificér formular vises
   - Ændr en værdi → gem → verificér at værdien er opdateret
   - Åbn hjælp-popup → naviger mellem sektioner
   - Luk popup med X-knap eller klik udenfor

7. **Keyboard shortcuts**
   - Test Escape lukker åbne popups
   - Test andre eventuelle keyboard shortcuts

---

### Suite 6: SANDBOX-MODE END-TO-END (~10 min)
**Formål:** Simulér et realistisk gameplay-scenarie i sandbox og verificér hele flowet.

**Scenarie: "En morgen med T1D"**

1. Start spillet i sandbox-mode
2. Giv basal insulin (20E Lantus)
3. Vent til morgentid (~07:00, speed up)
4. Observer dawn-effekt (BG bør stige lidt)
5. Spis morgenmad (60g KH — cereal eller brød)
6. Giv bolus insulin (baseret på ICR — typisk 4-6E for 60g KH)
7. Observer BG-stigning fra mad, derefter fald fra insulin
8. Start 30 min cardio-motion
9. Observer BG-fald under motion
10. Tjek points-display undervejs
11. Lad simulationen køre til middag (~12:00)
12. Tag screenshot af grafen (viser hele morgenen)
13. Verificér at grafen har data fra hele perioden
14. Aflæs fysiologiske værdier og verificér plausibilitet

**Forventet tidslinje:**
- 00:00-07:00: Stabil BG med dawn-stigning
- 07:00-07:30: BG stiger fra morgenmad
- 07:30-09:00: Insulin bremser stigning, BG begynder at falde
- 09:00-09:30: Motion accelererer BG-fald
- 09:30-12:00: BG stabiliserer

---

### Suite 7: CAMPAIGN-MODE — ALLE BANER (~15-20 min)
**Formål:** Gennemspil alle 3 campaign-baner og verificér mekanik, restriktioner og scoring.

#### Fælles setup
Start spillet med campaign-mode. Flowet er:
Start → Disclaimer → Vælg "Campaign" (🎯) → Profil loaded → Bane starter.

Campaign bruger `levels.js` med 3 baner. Brug `browser_evaluate` til at tjekke
intern state og skifte mellem baner.

#### 7A. Bane 1: Basal Insulin (`dag1_basal`)
**Config:** 3 dage, start kl. 05:00, start-BG 9.0, dawn OFF

**Restriktioner at verificére:**
- ✅ Basal insulin TILGÆNGELIG (dock-item synligt og klikbart)
- ❌ Hurtigvirkende insulin LÅST (dock-item enten skjult eller disabled)
- ❌ Motion LÅST
- ✅ Mad TILGÆNGELIG
- ✅ T1D Kit TILGÆNGELIGT

**Test-flow:**
1. Start campaign-mode, verificér bane 1 loader
2. Tag screenshot — verificér campaign-UI (objectives overlay `#campaign-objectives`)
3. Verificér start-BG er ~9.0 mmol/L: `game.trueBG`
4. Verificér starttid er ~05:00 (300 min): `game.timeInMinutes`
5. Verificér at hurtigvirkende insulin-knap er disabled/skjult
6. Verificér at motion-knap er disabled/skjult
7. Giv basal insulin (via basal-slider + knap)
8. Verificér at objective "Giv basal insulin" markeres som opfyldt
9. Avancér 1 dag (speed up)
10. Verificér at BG stabiliserer med korrekt basal (4.5-8.0 mmol/L)
11. Spis mad undervejs — verificér at det er tilladt
12. Kør igennem alle 3 dage
13. Verificér level-complete popup med stjerne-vurdering
14. **Stjerne-tærskler:** TIR ≥85% = ⭐, ≥90% = ⭐⭐, ≥95% = ⭐⭐⭐
15. Tag screenshot af resultater

#### 7B. Bane 2: Dawn Effect (`dag2_dawn`)
**Config:** 3 dage, start kl. 05:00, start-BG 6.0, dawn ON

**Nye elementer vs. bane 1:**
- ✅ Hurtigvirkende insulin nu TILGÆNGELIG
- Dawn-effekt AKTIV (BG bør stige ~04:00-08:00)

**Test-flow:**
1. Verificér bane 2 starter (efter bane 1 complete, eller via evaluate)
2. Verificér start-BG er ~6.0: `game.trueBG`
3. Verificér at hurtigvirkende insulin NU er tilgængelig
4. Verificér at motion STADIG er låst
5. Avancér til kl. 04:00-08:00, observer dawn-effekt:
   ```javascript
   // Tjek cortisol-påvirkning:
   game.circadianKortisolNiveau  // Bør være > 0 mellem 04:00-12:00
   ```
6. Giv basal + bolus insulin, spis mad
7. Verificér at dawn giver mærkbar BG-stigning om morgenen
8. Kør 3 dage, tag screenshot af resultat
9. **Stjerne-tærskler:** TIR ≥80% = ⭐, ≥85% = ⭐⭐, ≥90% = ⭐⭐⭐

#### 7C. Bane 3: Bolus & Meals (`dag3_bolus`)
**Config:** 1 dag, start kl. 07:00, start-BG 5.5, basal PRE-INJECTED, dawn ON

**Nye elementer:**
- Basal allerede givet (pre-injected 16 timer før)
- Fokus på bolus-timing til måltider
- Objectives: mindst 1× bolus + mindst 2× mad

**Test-flow:**
1. Verificér start-BG ~5.5, tid ~07:00
2. Verificér at basal allerede er aktiv: `game.activeLongInsulin.length > 0`
3. Verificér objectives vises: "Giv bolus" + "Spis måltider" (med min-krav)
4. Spis morgenmad (brød/cereal, ~25-30g KH)
5. Giv matchende bolus (KH / ICR enheder)
6. Observer BG-respons: stigning fra mad, derefter fald fra bolus
7. Spis frokost kl. ~12:00 (opfylder 2-mad kravet)
8. Giv bolus igen
9. Verificér at begge objectives er opfyldt
10. Kør dagen færdig
11. **Stjerne-tærskler:** TIR ≥25% = ⭐, ≥45% = ⭐⭐, ≥65% = ⭐⭐⭐
12. Tag screenshot af resultater og samlet campaign-progression

#### Campaign-specifik verifikation
- Points beregnes: base normoPoints + (5.0 × antal stjerner) + TIR-bonus
- Level-progression: bane 2 låses op efter bane 1 complete
- Game over i campaign: håndteres per level (infinite lives, men game over afslutter level)

---

### Suite 8: BOX CHALLENGE-MODE (~10-15 min)
**Formål:** Test box challenge-mekanikken inkl. bokse, lives, respawn og daglig progression.

#### 8A. Start og grundmekanik
1. Start spillet i box challenge-mode (📦)
2. Verificér at 3 lives vises: `game.lives === 3`
3. Verificér at life-bars panel viser alle 3 bars (brain, acid, weight)
4. Tag screenshot af startskærm med mode-indikator

#### 8B. Boks-generering og kollision
1. Avancér til dag 1, kl. ~08:00 (bokse genereres 02:00-23:00)
2. Aflæs bokse:
   ```javascript
   game.boxes.map(b => ({
     startTime: b.startTime,
     endTime: b.endTime,
     bgLow: b.bgLow,
     bgHigh: b.bgHigh
   }))
   ```
3. **Dag 1 forventet:** 1 boks, ~8% coverage, max højde 1.5 mmol/L
4. Verificér at bokse vises på grafen (tag screenshot)
5. Styr BG ind i en boks (via mad eller manglende insulin):
   - Avancér tid til boksens startTime
   - Sørg for at BG er inden for boksens BG-range
6. Verificér kollisionsrespons:
   - Life tabt: `game.lives` reduceret
   - Respawn: BG flyttes til sikkert niveau (basal steady state)
   - Respawn-immunitet: 30 sim-min
7. Tag screenshot efter life-tab

#### 8C. Daglig progression (sværhedsgrad)
Brug evaluate til at springe til dag 5 og dag 10 og verificér skalerng:

```javascript
// Simulér dag-skift og check nye bokse:
(() => {
  // Returner boks-statistik for næste dag
  const boxes = game.boxes;
  return {
    day: game.day,
    boxCount: boxes.length,
    totalCoverage: boxes.reduce((sum, b) =>
      sum + (b.endTime - b.startTime), 0) / 1260,
    lives: game.lives
  };
})()
```

**Forventede skaleringer:**

| Dag | Bokse | Coverage | Max højde |
|-----|-------|----------|-----------|
| 1   | 1     | ~8%      | 1.5       |
| 5   | 2     | ~16%     | 1.9       |
| 10  | 3     | ~28%     | 2.5       |
| 15+ | 4     | ~38%     | 2.5       |

Verificér at boks-antal og coverage matcher forventningerne (±20% tolerance).

#### 8D. Respawn-scenarier
Test alle 4 respawn-typer:

1. **Box-respawn:** Styr BG ind i boks → respawn til sikkert BG, 30 min immunitet
2. **Hypo-respawn:** Lad BG falde < 2.5 i lang tid → respawn til sikkert BG,
   brainDeficit nulstilles, 30 min immunitet
3. **DKA-respawn:** Stop al insulin, vent til ketoner stiger → ketoner+acidosis nulstilles,
   15 min immunitet
4. **Weight-respawn:** Spis intet i lang tid → weight-change penalty, 15 min immunitet
   (INGEN BG-respawn — kun straf)

For hvert respawn-scenarie:
- Verificér at `game.lives` tælles ned
- Verificér at respawn-popup vises (tag screenshot)
- Verificér immunitet-periode (nye kollisioner ignoreres)
- Tjek konsol for fejl under respawn

#### 8E. Game over (0 lives)
1. Provokér 3 life-tab (gentag boks-kollisioner)
2. Verificér at game over-popup vises
3. Verificér at high score-indtastning tilbydes
4. Tag screenshot af game over-skærm

---

### Suite 9: PROFIL-VARIATIONER — ISF OG VÆGT (~10 min)
**Formål:** Verificér at forskellige profil-indstillinger giver korrekt fysiologisk respons.

#### Profil-opsætning via evaluate
Brug evaluate til at sætte profil og starte spil programmatisk:
```javascript
// Sæt profil direkte i localStorage og reload:
(() => {
  const profile = { name: 'Test', weight: 70, icr: 10, isf: 3.0 };
  localStorage.setItem('diabetesDystenProfile', JSON.stringify(profile));
  return profile;
})()
```
Reload siden efter profil-ændring, start sandbox-mode.

#### 9A. ISF-variationer
Test 3 forskellige ISF-værdier og verificér insulin-respons:

| Profil | ISF | Forventet BG-fald per 1E | TDD |
|--------|-----|--------------------------|-----|
| Høj følsomhed | 5.0 | ~5 mmol/L | 20E |
| Normal | 3.0 | ~3 mmol/L | 33E |
| Lav følsomhed | 1.5 | ~1.5 mmol/L | 67E |

**For hver ISF-profil:**
1. Sæt profilen (via evaluate + reload)
2. Start sandbox, giv basal, vent til stabil BG
3. Aflæs BG
4. Giv 1E hurtigvirkende insulin
5. Avancér 120 sim-min
6. Aflæs BG igen
7. Beregn fald: `delta = startBG - endBG`
8. **Verificér:** delta ≈ ISF (±30% tolerance pga. non-lineær dynamik)
9. Verificér at høj ISF giver større fald end lav ISF

#### 9B. Vægt-variationer
Test 3 forskellige kropsvægte:

| Profil | Vægt | Forventet BMR (kcal/dag) | Effekt |
|--------|------|--------------------------|--------|
| Let | 50 kg | ~1571 | Hurtigere vægt-tab ved faste |
| Normal | 70 kg | ~2200 | Reference |
| Tung | 120 kg | ~3771 | Langsommere vægt-tab |

**For hver vægt-profil:**
1. Sæt profilen (ISF=3.0, ICR=10, men skift vægt)
2. Start sandbox, giv basal
3. Verificér at `game.weight` matcher profilen
4. Verificér kalorieforbrug via evaluate: `game.restingKcalPerMin`
5. Vent 24 sim-timer UDEN mad
6. Tjek vægtændring: `game.weightChangeKg`
7. **Verificér:** lettere person taber relativt mere vægt ved faste

#### 9C. Profil-edge cases
1. **Minimum-profil:** weight=30, ISF=0.5, ICR=3
   - Start spil → verificér at det starter uden crash
   - Giv insulin → verificér respons (meget lille BG-fald per enhed)
   - TDD = 100/0.5 = 200E — verificér at basal beregnes korrekt
2. **Maximum-profil:** weight=200, ISF=10, ICR=30
   - Start spil → verificér at det starter uden crash
   - Giv insulin → verificér respons (stort BG-fald per enhed)
   - TDD = 100/10 = 10E — verificér basal
3. **Profil med ugyldige værdier:**
   - Prøv at gemme weight=0, ISF=-1 via profil-popup
   - Verificér at validering fanger det (hard limits: weight 30-200, ISF 0.5-10)
   - Verificér at "Gem" knap er disabled eller viser fejl

---

### Suite 10: GAME OVER-SCENARIER (~10-15 min)
**Formål:** Test alle game over-typer og verificér korrekt håndtering.

#### 10A. Hypo game over (brain energy deficit)
**Mekanisme:** BG < 2.5 mmol/L → brainEnergyDeficit akkumulerer → game over ved ≥8.0

1. Start sandbox-mode
2. Giv stor bolus insulin (fx 20E) UDEN mad
3. Avancér tid — BG vil falde drastisk
4. Monitor løbende:
   ```javascript
   ({
     bg: game.trueBG,
     brainDeficit: game.brainEnergyDeficit,
     isGameOver: game.isGameOver,
     pct: (1 - game.brainEnergyDeficit / 8.0) * 100
   })
   ```
5. Verificér at life-bar (brain) viser advarsel ved 50% (deficit=4.0)
6. Verificér at life-bar viser "danger" ved 25% (deficit=6.0)
7. Verificér game over ved deficit ≥ 8.0
8. Verificér game over-popup vises med årsag ("hypo" / "hjernens energi")
9. Tag screenshot af game over-skærm
10. Verificér at spillet stopper (ingen yderligere BG-opdateringer)
11. **Tidsforventet:** BG 2.0 → game over ~59 min, BG 1.0 → ~20 min

#### 10B. DKA game over (acidosis)
**Mekanisme:** Insulinmangel → ketoner stiger → acidosisLoad ≥ 600 → game over

1. Start sandbox-mode
2. Giv INGEN insulin (hverken basal eller bolus)
3. Avancér tid i store spring (timer)
4. Monitor:
   ```javascript
   ({
     bg: game.trueBG,
     ketones: game.ketoneLevel,
     acidosis: game.acidosisLoad,
     isGameOver: game.isGameOver,
     pct: (1 - game.acidosisLoad / 600) * 100
   })
   ```
5. Verificér at ketoner stiger progressivt (lav insulin → lipolyse)
6. Verificér at acidosis-life-bar falder
7. Verificér advarsel ved 50% (acidosis=300)
8. Verificér game over ved acidosis ≥ 600
9. Verificér game over-popup med årsag ("DKA" / "ketoacidose")
10. Tag screenshot
11. **Tidsforventet:** Total insulinmangel → DKA game over efter mange timer

#### 10C. Vægt-tab game over
**Mekanisme:** weightChangeKg ≤ -5.0 kg → game over

1. Start sandbox-mode med 70kg profil
2. Giv basal insulin (for at undgå DKA)
3. Spis INGEN mad
4. Avancér tid (flere dage)
5. Monitor:
   ```javascript
   ({
     weight: game.weight,
     weightChange: game.weightChangeKg,
     isGameOver: game.isGameOver,
     pct: ((game.weightChangeKg + 5) / 10) * 100  // centreret
   })
   ```
6. Verificér at weight-life-bar viser progressivt tab
7. Verificér game over ved weightChange ≤ -5.0
8. Tag screenshot
9. **Tidsforventet:** Afhænger af BMR — ~70kg bruger ~2200 kcal/dag → ~5 kg tab ~17 dage

#### 10D. Komplikations game over (kronisk hyperglykæmi)
**Mekanisme:** Gennemsnitlig BG > 15 mmol/L over 7+ dage → game over

1. Start sandbox-mode
2. Giv KUN basal insulin (utilstrækkeligt)
3. Spis store måltider uden bolus → kronisk højt BG
4. Avancér 7+ dage
5. **Verificér:** game over trigger KUN efter dag 7 med vedvarende BG > 15
6. Tag screenshot

#### 10E. Game over recovery-check
1. Efter hvert game over: verificér at "Prøv igen"/"Start ny" knap virker
2. Verificér at profil bevares
3. Verificér at high score-indtastning tilbydes (se Suite 11)

---

### Suite 11: HIGH SCORE-SYSTEMET (~5 min)
**Formål:** Verificér at high score gemmes, vises og sorteres korrekt.

#### 11A. Score-akkumulering under spil
1. Start sandbox-mode, spil i 2-3 sim-timer med god BG-kontrol
2. Verificér at points tælles op:
   ```javascript
   ({
     normoPoints: game.normoPoints,
     day: game.day,
     timeInRange: game.timeInMinutes
   })
   ```
3. **Points-regler:**
   - BG 5.0-6.0: 2.0 point/time (optimal)
   - BG 4.0-10.0: 1.0 point/time (i range)
   - BG 10.0-14.0: 0.5 point/time (let forhøjet)
   - BG <4.0 eller >14.0: 0 point/time
4. Verificér at `#normoPointsDisplay` opdateres i UI

#### 11B. High score ved game over
1. Spil til game over (eller brug evaluate til at triggere det)
2. Verificér at high score-popup vises
3. Indtal navn og gem
4. Verificér at scoren gemmes i localStorage:
   ```javascript
   JSON.parse(localStorage.getItem('t1dSimHighscores'))
   ```
5. Tag screenshot af high score-popup

#### 11C. High score-visning
1. Klik `#highscoreButton` (i top-bar eller efter game over)
2. Verificér at high score-liste vises
3. Verificér at listen er sorteret (højeste først)
4. Verificér at den viser: navn, points, dag, årsag, dato
5. Tag screenshot

#### 11D. High score per mode
1. Spil og gem scores i ALLE 3 modes:
   - Sandbox → `'t1dSimHighscores'`
   - Box Challenge → `'t1dSimHighscores_boxchallenge'`
   - Campaign → `'t1dSimHighscores_campaign'`
2. Verificér at scores holdes adskilte per mode
3. Verificér at max 10 scores gemmes per mode

#### 11E. Score-reset og version
1. Verificér at score-data har `version: '1.0'`
2. Test med korrumperet/gammel data:
   ```javascript
   localStorage.setItem('t1dSimHighscores', JSON.stringify({version:'0.9'}));
   ```
3. Reload → verificér at gammel data cleares

---

### Suite 12: MAD-TYPER — ALLE 14 PRESET + CUSTOM (~10 min)
**Formål:** Test alle madvarer og verificér fysiologisk korrekt respons.

#### Referencedata for alle 14 preset-madvarer:

| Mad | Emoji | KH | Protein | Fedt | Forventet effekt |
|-----|-------|----|---------|------|------------------|
| Pizza | 🍕 | 55g | 20g | 25g | Stor stigning + fed-forsinkelse, "pizza-effekt" |
| Pasta | 🍝 | 50g | 10g | 5g | Stor stigning, moderat varighed |
| Kage | 🍰 | 60g | 5g | 25g | Hurtig stigning + sen fed-resistens |
| Is | 🍦 | 25g | 3g | 12g | Moderat stigning, fedt forsinker |
| Chokolade | 🍫 | 30g | 3g | 15g | Moderat stigning, kort |
| Brød | 🍞 | 25g | 8g | 3g | Moderat stigning, protein-effekt |
| Morgenmad | 🥣 | 30g | 8g | 2g | Moderat stigning |
| Kylling | 🍗 | 2g | 30g | 15g | Minimal KH, forsinket protein→glukagon |
| Ost | 🧀 | 0g | 13g | 15g | Ingen KH-stigning, protein+fedt effekt |
| Avocado | 🥑 | 5g | 5g | 25g | Minimal stigning, stor fed-resistens |
| Dextrose | ▫️ | 3g | 0g | 0g | Ultra-hurtig lille stigning (3 min) |
| Æble | 🍎 | 20g | 0g | 0g | Ren KH, moderat stigning |
| Juice | 🥛 | 25g | 0g | 0g | Ren KH, hurtig stigning |
| Salat | 🥗 | 5g | 2g | 1g | Næsten ingen effekt |

#### 12A. Hurtige kulhydrater vs. langsomme
1. Start sandbox, stabil BG (~6.0 mmol/L)
2. **Test 1: Dextrose** — giv dextrose, avancér 15 min
   - Forventet: hurtig men lille stigning (3g KH → ~1 mmol/L)
   - Onset: ~3 min (ultra-hurtig)
3. **Test 2: Juice** — reset, giv juice, avancér 30 min
   - Forventet: moderat stigning (25g KH → ~3-5 mmol/L peak)
4. **Test 3: Pasta** — reset, giv pasta, avancér 60 min
   - Forventet: stor stigning (50g KH → ~5-8 mmol/L peak)
5. **Verificér:** dextrose peak FØRST, derefter juice, derefter pasta

#### 12B. Pizza-effekten (fedt-forsinkelse)
1. Start sandbox, stabil BG
2. Giv pizza (55g KH + 25g fedt)
3. Avancér 4-6 timer
4. Monitor BG-kurve:
   ```javascript
   // Aflæs hvert 30 sim-min:
   ({
     time: game.timeInMinutes,
     bg: game.trueBG,
     cob: game.cob,
     ffaResistance: game.ffaResistanceFactor || 'N/A'
   })
   ```
5. **Forventet:** KH-peak ved ~40-60 min, derefter ANDEN bølge
   fra FFA-induceret insulinresistens ved ~4-6 timer
6. Tag screenshot af BG-kurve der viser dobbelt-peak

#### 12C. Protein-effekt (sen stigning via glukagon)
1. Start sandbox, stabil BG
2. Giv kylling (2g KH, 30g protein, 15g fedt)
3. Avancér 3-4 timer
4. **Forventet:** Minimal initial stigning (2g KH), derefter
   forsinket stigning efter ~60-90 min fra protein→glukagon→HGP
5. Effekten bør være moderat (~1-2 mmol/L for 30g protein)

#### 12D. Ren fedt (insulinresistens uden KH)
1. Start sandbox, stabil BG
2. Giv avocado (5g KH, 5g protein, 25g fedt) eller ost (0g KH, 13g protein, 15g fedt)
3. Avancér 5-6 timer
4. **Forventet:** Minimal BG-stigning fra KH, men FFA-resistens
   gør efterfølgende insulindoser MINDRE effektive

#### 12E. Custom food — edge cases
1. **Max carbs:** Custom food 100g KH, 0 protein, 0 fedt
   - Forventet: meget stor BG-stigning (~10-15+ mmol/L uden insulin)
2. **Ren protein:** Custom food 0g KH, 50g protein, 0 fedt
   - Forventet: forsinket moderat stigning via glukagon
3. **Ren fedt:** Custom food 0g KH, 0g protein, 50g fedt
   - Forventet: minimal BG-stigning, men FFA-resistens
4. **Tom mad:** Custom food 0/0/0
   - Forventet: ingen effekt, ingen crash
5. Verificér at kcal-display opdateres korrekt for custom food:
   - kcal = KH×4 + protein×4 + fedt×9

---

### Suite 13: LIFE BARS & RESPAWN-SYSTEM (~8 min)
**Formål:** Verificér at alle 3 life bars fungerer korrekt med visuel feedback.

#### 13A. Brain energy bar (hypo)
1. Start sandbox, give stor insulin-overdosis
2. Avancér tid, BG falder under 2.5
3. Observer life-bar:
   ```javascript
   ({
     deficit: game.brainEnergyDeficit,
     pct: (1 - game.brainEnergyDeficit / 8.0) * 100,
     barColor: 'check visually',
     bg: game.trueBG
   })
   ```
4. **Visual check:** Screenshot ved 100%, 75%, 50% (warning), 25% (danger)
5. Verificér farveskift: grøn → gul (50%) → rød (25%)
6. **Recovery:** Giv mad/dextrose → BG stiger over 2.5 → bar begynder at fylde igen
7. Verificér recovery-rate: t½ = 45 sim-min

#### 13B. Acidosis bar (DKA)
1. Start sandbox, giv INGEN insulin
2. Avancér mange timer, ketoner stiger
3. Observer life-bar:
   ```javascript
   ({
     acidosis: game.acidosisLoad,
     ketones: game.ketoneLevel,
     pct: (1 - game.acidosisLoad / 600) * 100
   })
   ```
4. Screenshot ved 100%, 50% (warning), 25% (danger)
5. **Recovery:** Giv insulin → ketoner falder → bar begynder at fylde

#### 13C. Weight bar
1. Start sandbox, giv basal, spis INTET
2. Avancér dage
3. Observer life-bar:
   ```javascript
   ({
     weightChange: game.weightChangeKg,
     pct: ((game.weightChangeKg + 5) / 10) * 100
   })
   ```
4. Screenshot der viser weight-bar faldende
5. **Recovery:** Spis mad → kalorie-overskud → vægt stiger igen

#### 13D. Visuel integritet
1. Tag screenshot af life-bars panelet med alle 3 bars synlige
2. Verificér at:
   - Labels er synlige (hjerne/brain, syre/acid, vægt/weight)
   - Procent-tekst vises (`#life-pct-brain` osv.)
   - Fyldnings-animation er smooth
   - Farverne skifter korrekt ved tærskelværdier

---

## RAPPORTERING

### Rapport-fil
**Gem ALTID rapporten som fil:** `playwright-test YYYY-MM-DD-rapport.txt` i projektroden.
Formatet følger samme konvention som review-rapporter.

### Under test
- Tag screenshots ved HVERT vigtigt trin (gem i evaluerings-mappen)
- Issues-screenshots: præfiks `ISSUE_` i filnavnet
- Rapportér fund løbende med prioritet og status

### Fund-format (ensrettet med review-skill)
For HVERT fund, brug dette format:

```
## [KRITISK/ADVARSEL/NOTE/OK] — Kort titel

**Suite:** Suite-navn, trin X
**Element:** DOM-element eller game-state variabel
**Problem:** Hvad er galt — konkret og specifikt
**Forventet:** Hvad burde ske / hvordan det burde se ud
**Faktisk:** Hvad der faktisk skete / blev observeret
**Screenshot:** filnavn.png (i evaluerings-mappen)
**STATUS:** ❌ ÅBEN / ✅ FIKSET / ⚠️ DELVIST / ⚠️ KOSMETISK
```

**Prioritering:**
- **KRITISK**: Crash, NaN-værdier, game over virker ikke, forkert fysiologi,
  mode-specifikke features er brudt
- **ADVARSEL**: Forkert layout, tekst klippet, forkerte værdier i displays,
  manglende visuel feedback, high score gemmes ikke
- **NOTE**: Kosmetiske issues, minor spacing, forbedringsmuligheder
- **OK**: Bekræftelse af korrekt funktion (kort — maks 1 linje)

### Samlet rapport-struktur

```
========================================
PLAYWRIGHT TEST-RAPPORT — YYYY-MM-DD
========================================

Screenshots: tests/playwright/YYYY-MM-DD_HH-MM/

Kørte suiter: [liste]
Profil: weight=X, ISF=Y, ICR=Z

────────────────────────────────────────
SUITE X: [NAVN]
────────────────────────────────────────

## [KRITISK] — Titel
**Suite:** ...
**Problem:** ...
**Forventet:** ...
**Faktisk:** ...
**Screenshot:** ...
**STATUS:** ❌ ÅBEN

## [OK] — Titel
Kort bekræftelse.

[... flere fund ...]

────────────────────────────────────────
OPSUMMERING
────────────────────────────────────────

Resultater per suite:
| Suite | Tests | PASS | FAIL | KRITISK | ADVARSEL | NOTE |
|-------|-------|------|------|---------|----------|------|
| 1     | 8     | 7    | 1    | 0       | 1        | 0    |
| ...   |       |      |      |         |          |      |

Samlet: X/Y tests bestået

KRITISKE ISSUES (kræver handling):
1. [kort beskrivelse]

ADVARSLER (bør rettes):
1. [kort beskrivelse]

NOTER (nice-to-fix):
1. [kort beskrivelse]

KONSOL-FEJL:
- [liste over JS-fejl fra alle suiter]

STATUS-OVERSIGT:
✅ FIKSET: 0
❌ ÅBEN: X
⚠️ DELVIST: 0
⚠️ KOSMETISK: 0
```

### STATUS-opdatering
Når issues fra en tidligere rapport rettes, opdatér STATUS-annotationen
direkte i rapport-filen:
- `❌ ÅBEN` → `✅ FIKSET (commit/dato)`
- `❌ ÅBEN` → `⚠️ DELVIST (beskrivelse)`
- `❌ ÅBEN` → `⚠️ BY DESIGN (forklaring)`

---

## TIPS TIL BRUG AF PLAYWRIGHT MCP

### Vigtige værktøjer og deres brug

| Værktøj | Hvornår |
|---------|---------|
| `browser_navigate` | Åbn simulatoren (fil-URL) |
| `browser_snapshot` | Accessibility-tree — brug til at finde elementer og refs |
| `browser_take_screenshot` | Visuelt screenshot — brug til layout-verifikation |
| `browser_click` | Klik på knapper, dock-items, chips |
| `browser_evaluate` | Aflæs game-state (`game.trueBG`, `game.iob` osv.) |
| `browser_run_code` | Kør komplekse test-scripts |
| `browser_console_messages` | Tjek for JS-fejl |
| `browser_resize` | Test responsivt design |
| `browser_wait_for` | Vent på tekst eller tid |
| `browser_fill_form` | Udfyld profil-formular |
| `browser_press_key` | Test keyboard shortcuts |

### Workflow
1. **Altid start med `browser_navigate`** til `http://127.0.0.1:8765/index.html`
2. **Brug `browser_snapshot`** til at finde element-refs (påkrævet for klik)
3. **Brug `browser_evaluate`** til at aflæse intern game-state
4. **Tag screenshots** til visuel verifikation (du kan se billeder)
5. **Tjek konsol** for fejl efter vigtige handlinger

### Tids-fremrykning
Simulatoren kører i realtid × hastighed. For at springe tid fremad:
```javascript
// Via browser_evaluate — avancér simulationen 60 sim-minutter:
(() => {
  const simMinutes = 60;
  const stepsPerMinute = 12; // 5-sekund steps
  for (let i = 0; i < simMinutes * stepsPerMinute; i++) {
    game.update(5); // 5 sekunder per step
  }
  updateUI();
  drawGraph();
  return { trueBG: game.trueBG, cgmBG: game.cgmBG, iob: game.iob, cob: game.cob };
})()
```

### Profil-opsætning via evaluate
```javascript
// Sæt profil og reload for at anvende:
(() => {
  const profile = { name: 'TestUser', weight: 70, icr: 10, isf: 3.0 };
  localStorage.setItem('diabetesDystenProfile', JSON.stringify(profile));
  return profile;
})()
// Derefter: browser_navigate til URL igen for at loade ny profil
```

### Start specifik mode via UI-flow
```
1. browser_navigate → index.html
2. browser_snapshot → find startButton ref
3. browser_click → startButton
4. browser_snapshot → find disclaimer accept-knap
5. browser_click → accept
6. browser_snapshot → find mode-valg (sandbox/campaign/boxchallenge)
7. browser_click → den ønskede mode
8. Spillet starter med valgt mode
```

### Interaktion med sliders
Sliders kan sættes via evaluate i stedet for at trække dem:
```javascript
(() => {
  const slider = document.getElementById('fastInsulinSlider');
  slider.value = 4;
  slider.dispatchEvent(new Event('input'));
})()
```

### Tjek om element er disabled/skjult
```javascript
(() => {
  const el = document.querySelector('.dock-item.d-insulin');
  return {
    visible: el.offsetParent !== null,
    disabled: el.classList.contains('disabled') || el.hasAttribute('disabled'),
    display: getComputedStyle(el).display,
    opacity: getComputedStyle(el).opacity
  };
})()
```

---

## FEJLHÅNDTERING

- Hvis `browser_navigate` fejler: tjek at den lokale HTTP-server kører på port 8765
- Hvis elementer ikke kan findes: tag en snapshot og rapportér hvad der er synligt
- Hvis spillet ikke starter: tjek konsol for fejl
- Hvis BG-værdier er NaN/undefined: rapportér som KRITISK fejl
- Hvis evaluate returnerer undefined: `game` variablen eksisterer måske ikke endnu — vent og prøv igen
- Ved timeout: simulatoren kan hænge — rapportér og tag screenshot
- Hvis mode-selection popup ikke dukker op: disclaimeren skal accepteres først
- Hvis campaign-bane ikke starter: tjek om profil er sat op korrekt

---

## META-REGLER FOR TESTEN

1. **Kør altid med max effort / ultrathink.** Denne skill kræver grundig
   observation og analyse. Overfladisk testning er værdiløs.
2. **Tag screenshots proaktivt** — ikke kun ved fejl, men også ved korrekt
   adfærd (som reference). Gem ALT i evaluerings-mappen.
3. **Sammenlign med fysiologisk forventning.** Når du observerer BG-værdier,
   spørg dig selv: "Giver dette mening for en T1D-patient?" Brug
   domæneviden fra AGENTS.md og review-skillen.
4. **Tjek konsol efter HVER handling.** JavaScript-fejl kan være "stille"
   — de crasher ikke siden, men bryder funktionalitet.
5. **Test edge cases aktivt.** Klik på ting der ikke burde klikkes,
   giv 0E insulin, spis mad under pause, osv.
6. **Dokumentér HVAD du ser, ikke hvad du tror.** Screenshots er bevis.
   "Det ser fint ud" er ikke acceptabelt — beskriv specifikt hvad du ser.
7. **Ensret med review-rapporten.** Samme prioritets-niveauer
   (KRITISK/ADVARSEL/NOTE/OK), samme status-annotationer (✅/❌/⚠️),
   samme rapport-konvention (dato i header, samlet opsummering i bund).
8. **Issues-screenshots kræver kontekst.** Tag ALTID et screenshot
   af problemet OG et screenshot af den forventede tilstand (hvis mulig).
