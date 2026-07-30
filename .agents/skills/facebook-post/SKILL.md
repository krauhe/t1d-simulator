---
name: facebook-post
description: >
  Generér et Facebook-opslag til T1D Simulator-gruppen med tekst og screenshots.
  Brug denne skill når brugeren beder om at lave et Facebook-opslag, en social
  media post, eller vil dele nyheder om simulatoren. Trigger ved "facebook",
  "opslag", "post", "del på facebook", "skriv et opslag", "lav en post".
---

# Facebook Post Generator — T1D Simulator

Du genererer Facebook-opslag til gruppen **T1D Simulator**
(https://www.facebook.com/groups/t1dsimulator) med tekst og screenshots
der viser simulatorens features.

---

## TRIN 0 — AFKLAR SCOPE

Før du begynder, skal du vide **hvad der er nyt siden sidste opslag**.

1. **Find dato for sidste opslag automatisk:**
   - **Primær kilde:** Læs `facebook posts/post-log.txt` — en simpel log
     over alle Facebook-opslag (også manuelle). Format per linje:
     `YYYY-MM-DD — kort beskrivelse`. Nyeste linje = sidste opslag.
   - **Sekundær kilde:** Tjek `facebook posts/`-mappen for den seneste
     daterede undermappe (format `YYYY-MM-DD`).
   - Læs evt. `facebook posts/SENESTE-DATO/post.txt` for at se hvad der
     sidst blev postet (undgå gentagelser).
   - Hvis hverken log eller mappe findes: spørg brugeren
     "Hvornår var det sidste Facebook-opslag?"
   - Facebook-gruppen (https://www.facebook.com/groups/t1dsimulator)
     kræver login og kan IKKE tilgås via WebFetch.

2. **Bekræft med brugeren:**
   - Vis den fundne dato og spørg: "Sidste opslag var YYYY-MM-DD — stemmer det?"
   - Hvis brugeren korrigerer, brug den korrigerede dato i stedet.
   - Spørg også: "Er der specifikke features eller ændringer du vil fremhæve?"

3. **Undersøg ændringer** siden sidste opslag:
   - Kør `git log --oneline --since="DATO"` for at se commits siden sidst
   - Læs `version.json` for aktuel version
   - Læs `TODO.txt` og `ISSUES.txt` hvis de eksisterer (for kontekst)
   - Tjek om der er nye campaign-levels i `js/levels.js`

4. **Præsentér en kort plan** til brugeren:
   - Hvilke features/ændringer skal fremhæves
   - Hvilke screenshots giver mening (1-4 stk)
   - Hvilken vinkel/tone opslaget skal have

**Vent på brugerens godkendelse før du fortsætter.**

---

## TRIN 1 — TAG SCREENSHOTS MED PLAYWRIGHT

### Forudsætninger
- Playwright MCP-serveren SKAL køre. Hvis værktøjerne ikke er tilgængelige,
  bed brugeren starte MCP-serveren først.
- Simulatoren tilgås via: `file:///D:/Dropbox/Kristian/Diabetes/Diabetes%20Simulator%20-%20Virtuel%20udforskning%20af%20din%20virkelighed/index.html`

### Output-mappe
Opret mappe med dato:
```
facebook posts/YYYY-MM-DD/
```
Alle screenshots og post-teksten gemmes her.

### Screenshot-indstillinger
- **Viewport:** 1280x720 (16:9 landscape — optimalt til Facebook)
- **Sprog:** Dansk (default)
- **Kvalitet:** PNG, fuld viewport (ikke element-screenshots)

### Gameplay-opskrift for gode screenshots

Målet er at vise en **levende graf** med varieret gameplay. Følg denne
opskrift, men tilpas efter hvilke features der skal fremhæves:

#### A. Start og baseline
```
1. Navigér til simulatoren
2. Resize til 1280x720
3. Klik #startButton (vælg sandbox)
4. Sæt hastighed til max (klik #speedUp 5-6 gange)
5. Vent ~15-30 sim-minutter for baseline
```

#### B. Spil en "morgen-rutine" (viser mad + insulin)
```
1. Giv basal-insulin (hvis ikke allerede aktivt)
2. Giv et morgenmåltid: åbn mad-panel, vælg fx morgenmad eller custom 50-60g KH
3. Giv bolus-insulin passende til måltidet (ICR-baseret)
4. Vent ~60-90 sim-minutter — BG stiger fra mad, falder fra insulin
5. → Screenshot her: graf viser pænt måltids-respons med ikoner
```

#### C. Tilføj motion (viser exercise-feature)
```
1. Start en cardio-session: åbn motions-panel, vælg cardio, 30-45 min
2. Vent til motion er i gang eller færdig
3. → Screenshot her: graf viser motions-effekt + duration-bar under ikon
```

#### D. Spil videre for varieret graf
```
1. Giv endnu et måltid (frokost med fedt — pizza-effekt)
2. Evt. giv korrektion-bolus hvis BG er høj
3. Vent til grafen viser 4-6 timers data med variation
4. → Screenshot her: pæn graf med flere events, scorer, og spændende kurve
```

#### E. Vis specifikke features (tilpas efter hvad der er nyt)
```
- Campaign-bane: start campaign, vis en bane med objectives
- Box Challenge: start box challenge, vis forhindringer
- Profil-popup: åbn profilen for at vise indstillinger
- Hjælp-popup: åbn for at vise dokumentation
- Nattetid: spil til nat for at vise mørk graf + søvn-effekt
- Dock-menu: vis et åbent panel (mad/insulin/motion/kit)
```

### Tips til gode screenshots
- **Vent på interessante øjeblikke:** Et screenshot er bedst når grafen
  viser tydelig variation — en stigning efter mad, et fald efter insulin,
  en dip under motion.
- **Undgå "flad" graf:** Mindst 2-3 timers gameplay giver en mere
  interessant graf.
- **Vis ikoner på grafen:** Sørg for at mad-, insulin- og motions-ikoner
  er synlige på grafen (de vises automatisk ved events).
- **Undgå overlappende paneler:** Luk dock-paneler når du vil vise
  selve grafen. Åbn kun ét panel ad gangen for feature-screenshots.
- **Tjek at BG-tallet er synligt** i CGM-hero displayet.
- **Undgå game-over:** Hold BG i et rimeligt interval. Hvis BG går
  for lavt, giv juice. Hvis BG går for højt, giv korrektion.

---

## TRIN 2 — SKRIV OPSLAGS-TEKSTEN

### Format og tone
- **Sprog:** Dansk
- **Tone:** Uformelt og personligt — som en ven der deler et projekt
  ("Hej alle! Nu har simulatoren fået...", "Vi har lige tilføjet...")
- **Længde:** 100-300 ord. Facebook-brugere scroller hurtigt — hook dem
  i de første 2 linjer.
- **Målgruppe:** T1D-patienter, forældre, pårørende, sundhedsfaglige.
  IKKE udviklere (undgå teknisk jargon).

### Struktur
```
[Kort, fængende åbning — hvad er nyt og hvorfor er det fedt]

[2-4 bullet points eller kort brødtekst om de vigtigste ændringer]

[Call to action: prøv det selv + link]

[Hashtags]
```

### Indhold
- **Fremhæv brugerværdi**, ikke tekniske detaljer
  - Godt: "Nu kan du udforske, hvordan pizza og ris påvirker en fiktiv karakters
    blodsukker forskelligt"
  - Dårligt: "Implementeret 2-kompartment fedt-absorption med CCK-feedback"
- **Brug T1D-sprog** som målgruppen kender: bolus, basal, blodsukker,
  hypo, CGM, TIR — ikke ODE'er og kompartment-modeller
- **Link til simulatoren:** https://krauhe.github.io/t1d-simulator/
- **Nævn at det er gratis og open source**

### Hashtags
Tilføj 3-5 relevante hashtags i bunden:
```
#type1diabetes #t1d #diabetessimulator #blodsukker #diabetesdk
```
Vælg dem der passer bedst til opslagets indhold. Andre muligheder:
`#insulinpumpe #CGM #diabetes #diabetestype1 #t1ddk #t1dcommunity`

### Eksempel-opslag (for inspiration)
```
Hej alle!

Simulatoren har lige fået en stor opdatering! Nu kan I bl.a.:

- Se hvordan fedt i maden (fx pizza) forsinker blodsukkerstigningen
- Opleve "dawn phenomenon" — det mystiske morgensukker
- Prøve nye udfordrings-baner med realistiske hverdagsscenarier

Alt sammen bygget på rigtig fysiologi, så I kan eksperimentere
uden konsekvenser.

Prøv det gratis her: https://krauhe.github.io/t1d-simulator/

Feedback er MEGA velkomment — skriv i kommentarerne eller send
en mail til t1d.simulator@gmail.com

#type1diabetes #t1d #diabetessimulator #blodsukker
```

---

## TRIN 3 — SAML OUTPUT

1. **Gem screenshots** i `facebook posts/YYYY-MM-DD/` med beskrivende navne:
   ```
   01_morgenrutine_graf.png
   02_motion_effekt.png
   03_campaign_bane.png
   04_fuld_dag_oversigt.png
   ```

2. **Gem opslags-teksten** som `facebook posts/YYYY-MM-DD/post.txt`:
   - UTF-8 med BOM (til Windows-editorer)
   - Ingen unicode-specialtegn (ingen em dash, ingen emoji)
   - Klar til copy-paste direkte til Facebook

3. **Vis teksten i chatten** så brugeren kan godkende/redigere den

4. **Opdatér post-loggen** — tilføj en linje til `facebook posts/post-log.txt`:
   ```
   YYYY-MM-DD — kort beskrivelse af opslagets emne
   ```
   Opret filen hvis den ikke eksisterer. UTF-8 med BOM.
   Brugeren kan også selv tilføje linjer her for manuelle opslag.

5. **Vis en oversigt:**
   - Antal screenshots + filnavne
   - Opslagets tekst
   - Foreslåede billedtekster (korte, til Facebook-billedbeskrivelser)

---

## VIGTIGT

- **Vent ALTID på brugerens godkendelse** af plan og tekst før du
  gemmer endeligt.
- **Billederne skal kunne stå alene** — en bruger der scroller forbi
  skal forstå hvad simulatoren er bare fra billedet.
- **Aldrig medicinsk rådgivning** — simulatoren er et uddannelsesværktøj,
  ikke et behandlingsværktøj. Nævn dette hvis relevant.
- **Tjek at screenshots ser gode ud** — ingen fejl, ingen overlappende
  elementer, læsbar tekst.
