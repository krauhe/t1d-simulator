# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Udviklerens baggrund og præferencer

### Teknisk baggrund
- Primær programmeringsbaggrund: MATLAB (ikke brugt i lang tid)
- Ikke professionel udvikler — forklar også "almen" programmeringsviden
- Kører engelsk Windows

### AI-værktøjer
- Projektet bruger **både Claude Code og Codex** som AI-assistenter. Begge arbejder på samme kodebase.
- Fælles filer (`TODO.txt`, `ISSUES.txt`) skal skrives så de er forståelige for begge værktøjer — ingen samtale-kontekst-afhængig tekst.
- Vær opmærksom på at Codex kan have lavet ændringer siden sidste Claude-session. Tjek git log ved sessionstart hvis noget ser uventet ud.

### Kodestil
- Omfattende kommentarer i ALLE filer — antag ikke forhåndskendskab
- Øverst i hver fil: overordnet beskrivelse af filens ansvar og indhold
- Kommenter ikke-åbenlys logik grundigt
- Variabelnavne skal være selvforklarende
- **Kode-kommentarer skrives på engelsk** (hele projektet). Generelt princip: al tekst tiltænkt teknisk kyndige læsere er engelsk — kode-kommentarer + videnskabelige/tekniske docs (`BG-SCIENCE.md`, `MODEL-IMPLEMENTATION.md`, `MODEL-API.md`) + **git-commit-beskeder** (udvikler-vendte; repo'et er offentligt). Kun bruger-vendt spil-tekst (UI-strenge, popups, level-tekst, hjælp til patienter/børn) er dansk (med engelsk i18n-spejl). Ny kode skrives med engelske kommentarer; eksisterende danske kommentarer oversættes løbende. NB: fordi commit-beskeder nu er engelske, undgås også æøå-encoding-problemet i terminalen (ingen `git commit -F`-omvej nødvendig).
- Kernemodel (ODE'er) i `js/hovorka.js`, al øvrig fysiologi og spilmekanik i `js/simulator.js`
- Skriv kode der er nem at udvide (tænk fremad mod baner og sandkasse)
- **Familiært design:** Når noget nyt minder om noget eksisterende, brug ALTID samme designmønster, klasser og struktur — både visuelt OG funktionelt. Genopfind ikke hjulet — genbrug det velkendte. Hvis en komponent (pil, ikon, knap, panel, animation) allerede findes ét sted i UI'et, skal den samme komponent genbruges når tilsvarende funktionalitet tilføjes andetsteds. Eksempler: nye toggles skal bruge samme knap-stil som eksisterende toggles (lyd-ikonet), dropdown-pile skal matche pilene i fysiologi-panelet, nye popups skal bruge det eksisterende popup-mønster, glaseffekt-paneler skal bruge de samme CSS-variable osv.

### Ændringsregler
- **Ændr KUN det brugeren specifikt beder om** — lav ikke ekstra rettelser, refaktoreringer eller "forbedringer" medmindre de er direkte nødvendige for opgaven
- Ved tvivl: spørg i stedet for at antage
- **Diskuter FØR du implementerer.** Når brugeren rejser et emne, en bekymring, et review-fund eller en idé: gå IKKE direkte i implementerings-mode. Diskuter emnet igennem først — analyser, undersøg, præsenter findings, foreslå muligheder. Vent på eksplicit "ja, implementer det" / "gør det" / "go" før du ændrer kode. Hvis det er uklart om brugeren vil have det implementeret, SPØRG. Dette gælder også når en undersøgelse afslører et nyt problem: rapporter findings, foreslå handling, vent på godkendelse — implementer ikke automatisk fordi "det åbenlyst er en bug". Eneste undtagelser: trivielle skrivefejl/typos i samtalens kontekst, eller når brugeren udtrykkeligt har bedt om en flerstegs-opgave på forhånd.
- **"Go"-signalet skal være imperativt — ikke en konstatering.** Eksplicit go-signal: "gør det", "ret det", "implementer", "go", "ja gør det", "kør". IKKE et go-signal: "det er beskrevet forkert", "ja det er en bug", "du har ret", "OK", "interessant", en bekræftelse af din analyse, eller et neutralt svar på et åbent spørgsmål. Når brugeren konstaterer eller bekræfter noget: betragt det som en fortsættelse af diskussionen, IKKE en kommando. Spørg "skal jeg rette det?" og vent på imperativt svar.
- **Lad være med at pre-drafte koden i dine forslag.** Når du foreslår en handling: præsenter analysen og det konceptuelle valg, og spørg om godkendelse. Skriv IKKE den eksakte erstatningstekst, kode-blok eller commit-besked op før brugeren har sagt "go". Pre-draftning skaber implicit pres mod godkendelse og forudsætter et resultat før brugeren har taget stilling. Hvis brugeren beder om at se den konkrete formulering først, så lever den — ellers ikke.
- **Ingen bagudkompatibilitet.** Simulatoren har ingen eksterne brugere eller gemt state der skal bevares på tværs af versioner. Når nye features implementeres eller eksisterende ændres: skriv den bedste implementering direkte, slet gammel kode, ret alle kald-steder. Brug IKKE tid på migrations-stier, feature flags, gamle API-skins eller "legacy"-varianter. Tilsvarende: campaign-levels, highscore-formater og localStorage-nøgler må gerne brækkes — ret dem bare samtidig.
- **Ingen app-tilpassede hacks — løs det i modellen/motoren.** Når en applikation (spillet, BG-lab, rapporter, fremtidige apps) har brug for noget den fysiologiske model/motor ikke understøtter rent: lav IKKE et lille hack i applikations-laget for at omgå det. Gør i stedet det nødvendige arbejde i selve den fysiologiske model/motor, så funktionaliteten understøttes ordentligt og kan genbruges af fremtidige applikationer. Motoren er den delte kerne — invester i den frem for at lappe rundt om den. Eksempel: BG-lab havde brug for deterministisk insulin-kinetik; den rigtige løsning var motorens `insulinVariability`-modul-toggle (en ægte motor-feature), ikke at overskrive interne felter lab-side. Hvis den rene løsning kræver et nyt motor-API/flag, så foreslå og lav det frem for et lokalt hack.

### Developer input
- Mappen `developer input/` i projektroden bruges til at dele screenshots, videoer og andre filer med Claude.
- Når brugeren siger der er nyt input (fx "der er et screenshot", "tjek developer input", "ny fil"), skal du læse de nyeste filer i mappen.

### Mockups
- UI-mockups og designskitser gemmes i mappen `mockups/` i projektroden.

### Todo-liste
- **`TODO.txt` i projektroden er den ENESTE todo-liste.** Der er ingen todo-liste i CLAUDE.md — al vedligeholdelse sker i TODO.txt.
- Både Claude Code og Codex arbejder på projektet og bruger TODO.txt som fælles opgaveliste. Skriv derfor klare item-beskrivelser der giver mening uden samtale-kontekst.
- Når brugeren beder om todo-listen: vis den i chatten OG opdatér `TODO.txt` hvis der er ændringer.
- `TODO.txt` er IKKE tracket i git — den er kun til lokal planlægning.
- **Format:** Opdel i sektioner (HØJ PRIORITET, LAV PRIORITET, POTENTIEL FEATURE Inden for hver sektion: gruppér relaterede items sammen. Ét punkt per linje, kun nummer og kort beskrivelse. Ingen FÆRDIGE-sektion.
- **Vertikal liste:** TODO-listen skal ALTID skrives som vertikal liste med linjeskift mellem hvert element — aldrig som inline/horisontal liste.
- **Dato i header:** `TODO.txt` skal altid have en `Genereret: YYYY-MM-DD` dato-linje i toppen.

### Issues-liste
- `ISSUES.txt` bruges til at samle bugs, issues og playtest-noter fra brugeren.
- Samme format-regler som `TODO.txt`: dato i header (`Genereret: YYYY-MM-DD`).
- `ISSUES.txt` er IKKE tracket i git — kun til lokal planlægning.

### Versionering
- Versionsnummer og dato bor i `version.json` i projektroden.
- Format: `"version": "X.Y.Z-beta"` og `"date": "YYYY-MM-DD"`.
- **Ved hvert git push:** bump patch-nummeret (Z+1) og opdatér datoen i `version.json`. Versionsspring skal være små og gradvise: `0.8.0 → 0.8.1 → 0.8.2 → ...`. Major-bump (Y: `0.8 → 0.9`) kun ved meget store milepæle (ny spiltilstand, fundamental arkitekturændring).
- Logoet i top-baren viser version + dato som tooltip (mouse-over).
- **Version history** i hjælp-popup'en opdateres ved hvert minor-bump (Y+1). Tilføj version-blok i `#version-history-da` + `#version-history-en` med features + vigtige bugfixes. Patch-bumps samles under næste minor. Behold fuld detalje på de 3 nyeste minor-versioner; komprimér ældre til én linje.
- **Hjælp-popup'ens model-udvidelses-liste** ("Udvidelser af modellen" / "Model extensions" i `index.html`): hvert punkt = max én linje (kort sætning + kort kilde i parentes). Kun de SIDSTE TO punkter må være flerlinje med formler/tal. Hold sektionen kort. (Se også HTML-kommentaren ved listen.)

### Sprog og tegnsætning

#### Tone i spiller-vendt tekst — VIGTIGT
- **Målgruppen omfatter børn og nydiagnosticerede voksne.** Mange er bange, frustrerede eller usikre på deres nye virkelighed med diabetes. Spillets tekster skal støtte dem, ikke forværre angsten.
- **Hold en positiv, varm og opmuntrende tone** i alle popup-tekster, mål-beskrivelser, tips, level-introer og game-over skærme.
- **Undgå dystre/dramatiske formuleringer:** ALDRIG "stay alive", "hold dig i live", "død", "farligt", "kritisk" som standard-framing. Brug i stedet: "klar dig godt igennem", "bevar god kontrol", "hold blodsukkeret stabilt", "lær at...", "udforsk".
- **Frame som læring og udforskning, ikke overlevelse.** Diabetes er en livslang ven man lærer at samarbejde med, ikke en fjende man skal "overleve".
- **Akut farlige tilstande (hypo, DKA) må gerne forklares ærligt** — men i en oplysende, ikke skræmmende tone. "BG er lavt — spis hurtigt sukker" er bedre end "Du er ved at besvime!".
- **Brug konkret, præcis sprog** — ikke vage formuleringer. Hvis basal-insulin udløber mellem kl. 8 og 14, skriv "indtil formiddag eller tidlig eftermiddag" — ikke "kun nogle få timer endnu" (det lyder mere alarmerende end det er).
- **Strukturer længere tekster i sektioner** med tydelige overskrifter (fx Situation / Eksperiment / Sikkerhedsnet / Hastighed) så det er overskueligt og ikke overvælder.

#### Undgå AI-cliché-formuleringer og metaforisk fysiologi-sprog
- **ALDRIG skriv metafor-formuleringer som lyder som AI-genereret tekst.** Disse fraser virker overfladisk levende, men er præcist det sprog en sprogmodel falder tilbage på når den ikke har konkret indhold at sige. De underminerer både videnskabelig autoritet og læser-tillid.
- **Forbudte mønstre — slet eller omskriv altid:**
  - "tug-of-war at the liver" / "tovtrækkeri i leveren"
  - "the kidneys act as a safety valve" / "nyrene fungerer som en sikkerhedsventil"
  - "dance of hormones" / "hormonernes dans"
  - "symphony of...", "orchestrates a delicate balance", "the body's wisdom"
  - "the brain's hunger for glucose" / "hjernens sult efter glukose"
  - "insulin tells cells to..." (antropomorfisering — brug i stedet "insulin binds receptors that trigger...")
  - "delicate equilibrium", "complex interplay", "intricate machinery"
- **Reglen gælder alt:** docs, kode-kommentarer, review-rapporter, commit-beskeder, alt. Spiller-vendt UI-tekst er undtagelsen (enkle metaforer OK, men undgå AI-cliché-mønstrene ovenfor).

#### Dansk tegnsætning (æ, ø, å) — ABSOLUT KRAV
- **ALDRIG skriv dansk tekst med Latiniserede erstatninger** (ae/oe/aa). Reglen gælder ALL DANSK tekst Claude genererer eller redigerer: `.md` (danske), `.txt`, `.html`, `.js` (kun dansk bruger-vendt UI-tekst — kode-kommentarer er engelske, se Kodestil), mockups, level-templates, review-rapporter, TODO.txt, ISSUES.txt, facebook-opslag, alt. (Git-commit-beskeder er nu engelske — se Kodestil — og er derfor ikke omfattet af æøå-reglen.)
- **Forbudte mønstre → korrekt erstatning:**
  - `ae` → `æ` (fx `vaere` → `være`, `maltid` → `måltid` — NB: `male` → `male` er korrekt engelsk, brug kontekst)
  - `oe` → `ø` (fx `foerste` → `første`, `foele` → `føle`, `tomning` → `tømning`)
  - `aa` → `å` (fx `paa` → `på`, `naar` → `når`, `gaa` → `gå`)
  - Specifikke ord der OFTE ses Latiniseret: Formaal→Formål, foerste→første, Naar→Når, paa→på, gaa→gå, foele→føle, vaere→være, saerre→større, rugbroed→rugbrød, maltid→måltid, toemning→tømning, traening→træning, dogn→døgn
- **Selv-tjek FØR Write/Edit:** Inden du gemmer dansk tekst, scan din egen output for ae/oe/aa-mønstre. Hvis du ser dem i danske ord, ret dem. Tvivlstilfælde løses ved at slå op (fx `male` på engelsk = OK, `male` som dansk verb skal være `male` — men `mal` præteritum hedder `malede`, og `male` er IKKE et Latiniseret `mæle`).
- **Hvis du opdager Latiniseret tekst i en eksisterende fil:** Ret det også, selvom det ikke er en del af opgaven. Det er teknisk gæld der spreder sig.

#### Encoding og specialtegn i .txt-filer
- **Alle genererede .txt-filer SKAL skrives i UTF-8 med BOM** (byte order mark) så Windows-editorer genkender encodingen korrekt.
- **Ingen unicode-specialtegn i .txt-filer:** ingen em dash (—), ingen × (gange-tegn), ingen emoji (✅❌⚠️🍕 osv.).
- **ASCII-alternativer:** `-` for tankestreg, `x` for gange, `[OK]` for check, `ISSUE` for fejl.
- NB: `.md`-filer må gerne bruge unicode-specialtegn (em dash, emoji etc.) — det er kun `.txt` der er ASCII-only.
- **Engelsk er sync-reference** for al tosproglig UI-tekst i projektet — hjælp-popup, version history, UI-tekst (i18n) osv. Videnskabelige docs (`MODEL-IMPLEMENTATION.md`, `BG-SCIENCE.md`) er kun-engelsk og har ingen dansk oversættelse.
- **Arbejdsretning (UI-tekst):** Når brugeren giver input på dansk, skriv den danske version først og oversæt derefter til engelsk. Når Claude skriver tekst fra bunden, skriv engelsk først og oversæt til dansk. I begge tilfælde: bump den engelske version-markør og synkronisér den danske `translated-from-en` markør.
- **Før merge til main:** kør `bash tests/check-text-sync.sh` og ret eventuelle uoverensstemmelser. Scriptet tjekker hjælp-templates og i18n-nøgler. Merge IKKE hvis scriptet fejler.

### Kommunikation
- Svar altid på dansk
- Forklar hvad du har ændret og hvorfor efter hver opgave
- Ved større ændringer: vis plan først, kód bagefter
- Foreslå gerne forbedringer men implementer dem ikke uden godkendelse
- Bevar altid simulationslogikken intakt ved UI-ændringer
- **Foreslå ALTID at committe og pushe før store ændringer** — så der altid er et sikkert fallback-punkt
- **Videnskabelig dokumentation: kun engelsk.**
  - `docs/MODEL-IMPLEMENTATION.md`, `docs/BG-SCIENCE.md` og `docs/MODEL-API.md` vedligeholdes kun på engelsk — ingen dansk oversættelse. Målgruppen er klinikere/forskere/modellører/eksterne udviklere der læser engelsk.
  - Bump `<!-- doc-version: YYYY-MM-DD-vN -->` markøren i toppen ved indholdsmæssige ændringer.
  - **Rolle-fordeling:**
    - `BG-SCIENCE.md` — ren fysiologisk reference på videnskabeligt review-niveau. Mekanistisk og kvantitativ. INGEN simulator-/model-referencer i prosaen. Bruges som videnskabelig vidensbase for både klinikere og modellør-arbejdet.
    - `MODEL-IMPLEMENTATION.md` — simulator-specifik implementeringsdokumentation. Her hører model/kode-referencer hjemme.
  - Opdatér `docs/BG-SCIENCE.md` løbende med nye emner der er relevante for blodglukoseregulering. Dokumentet skal være en komplet videnskabelig oversigt over alle faktorer der påvirker BG ved T1D, med kvantitative parametre der kan bruges i modellering.
  - Til omskrivning/forbedring af `BG-SCIENCE.md`: brug `science-reviewer` skillen.
- **Hent ALTID relevante videnskabelige artikler** ned i `docs/references/` når nye emner tilføjes eller researches. Kilder skal så vidt muligt downloades som PDF. Filnavns-format: `Efternavn_Årstal[_RW]_Titel.ext` (fx `Hovorka_2004_NonlinearMPC.pdf`, `Cryer_2013_RW_GlucoseCounterregulation.pdf`). RW tilføjes kun ved review-artikler. Hvis PDF ikke er tilgængelig, gem som `.html` fra PMC eller lignende.
- **Review-workflow:** Når elementer fra en review-rapport rettes, skal der tilføjes en STATUS-annotation direkte i review-filen ved hvert berørt punkt. Brug formaterne: `✅ FIKSET (commit/dato)`, `❌ ÅBEN`, `⚠️ DELVIST`, eller `⚠️ BY DESIGN`. Opdatér også den samlede status-opsummering i bunden af rapporten. Reviews bor i `docs/reviews/` (se mappe-disciplin nedenfor).
- **Fix-decision-doc** påkrævet for non-trivielle model-ændringer (kvantitativ kalibrering, litteratur→test-kobling, afvigelse fra design-spec, 3+ koordinerede filer). Kriterier, format og eksempel i memory-note `process_fix_decision_doc`.

### Sub-agent model-valg
Sonnet til afgrænsede opgaver (klart output, eksplicit scope, self-contained brief). Opus til syntese, åbne fortolkninger, stilistisk kvalitet, eller bruger-request. Phys-reviewer sub-agents: altid Opus. Detaljer i memory-note `process_subagent_model`.

---

## Projektbeskrivelse

**T1D Simulator** er et læringsspil om blodsukkerfysiologi. Spilleren hjælper faste, fiktive karakterer og udforsker, hvordan mad, insulin, aktivitet, søvn og stress påvirker deres simulerede blodsukker. Spillet er ikke individuel vejledning og bruger ikke spillerens helbredsdata.

Projektet har to spiltilstande:
1. **Sandkasse** – fri leg, afprøv hypoteser uden konsekvenser
2. **Campaign** – baner med realistiske hverdagsscenarier, objectives, stjerne-rating og neutrale tips

Derudover: **Box Challenge** — daglig udfordring med forhindringer og 3 liv.

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
index.html                  ← HTML-struktur og layout
style.css                   ← Al CSS-styling
physiology-dashboard.html   ← Separat fysiologi-dashboard (åbnes i eget vindue)
js/
  sounds.js     ← Lyd-opsætning (Tone.js) og playSound()
  i18n.js       ← Internationalisering (da/en)
  levels.js     ← Campaign-baner: CAMPAIGN_LEVELS array med level-konfigurationer
  hovorka.js    ← Hovorka 2004 glukose-insulin model (16 ODE'er, valideret)
  simulator.js  ← Simulator-klassen: bruger HovorkaModel + spilmekanik + al fysiologi
  ui.js         ← Tegning af graf, opdatering af UI, popups, logning, profil-popup
  game.js       ← Game loop, startGame, resetGame, togglePause, mode-håndtering
  campaign.js   ← CampaignEngine: level-gating, objectives, stjerner og karakterbaserede popupper
  main.js       ← Globale variable, DOM-referencer, event listeners, init
docs/
  MODEL-IMPLEMENTATION.md      ← Engelsk — simulator-specifik implementeringsdokumentation, kilder, credits
  BG-SCIENCE.md                ← Engelsk — videnskabelig review-tekst om alle faktorer der påvirker BG (klinikere/forskere/modellør-vidensbase)
  references/                  ← Hentede videnskabelige artikler. Format: Efternavn_Årstal[_RW]_Titel.ext
  references/_paywalled-wishlist.txt ← Liste over relevante artikler bag paywall (gitignored, opdateres af science-reviewer-skillen)
tests/
  simulation.test.js   ← Automatiserede tests (120+), kør med: tests/.bin/node.exe tests/simulation.test.js
  model-validation.html ← Visuel modelvalidering i browser
  check-text-sync.sh   ← Tjek at UI-oversættelser er i sync (hjælp-popup, i18n-nøgler)
  playwright/          ← Output fra Playwright-test-skill (gitignored)
  .bin/node.exe        ← Portable Node v24.15.0 (gitignored). Hvis fraværende: hent zip fra https://nodejs.org/dist/v24.15.0/node-v24.15.0-win-x64.zip og udpak node.exe til tests/.bin/node.exe
docs/reviews/   ← ALLE reviews (Claude, Codex, UI, playtest). Format: YYYY-MM-DD_<scope>.md
mockups/        ← UI-mockups (HTML + screenshots). Gitignored. Underordnet datostempling: YYYY-MM-DD_<topic>/
levels/         ← Level-planlægningsmateriale (skabeloner, ideer)
assets/         ← Produktive assets brugt af appen (icons/, insulin-sets/, food/)
sounds/         ← Lyd-assets brugt af appen
graphics/       ← (eksisterer ikke længere — flyttet til old/graphics/)
developer input/ ← Screenshots/videoer/filer brugeren deler med Claude. Gitignored
facebook posts/ ← Facebook-opslag og tilhørende screenshots. Underordnet: YYYY-MM-DD/
old/            ← Arkiverede gamle filer + referencer + dropbox-konflikter. Gitignored
```

Script-load rækkefølge i index.html (rækkefølgen er vigtig, da filer deler globalt scope):
`sounds.js` → `i18n.js` → `levels.js` → `hovorka.js` → `simulator.js` → `ui.js` → `game.js` → `campaign.js` → `main.js`

---

## Mappe-disciplin

**Aldrig løse filer i projektroden.** Placér filer efter type:

| Indhold | Placering | Format |
|---------|-----------|--------|
| Reviews | `docs/reviews/` | `YYYY-MM-DD_<author>_<scope>.md` |
| Mockups | `mockups/<YYYY-MM-DD>_<topic>/` | HTML, CSS, screenshots (gitignored) |
| Playwright-screenshots | `tests/playwright/<YYYY-MM-DD_HH-MM>/` | Screenshots + rapport.txt (gitignored) |
| Facebook-opslag | `facebook posts/<YYYY-MM-DD>/` | + `post-log.txt` |
| Level-planlægning | `levels/` | UTF-8 m. BOM, ASCII-only |
| Arkiv/gamle filer | `old/<undermappe>/` | Gitignored; ved tvivl: `old/` snarere end slet |
| Dropbox-konflikter | `old/dropbox-conflicts/` | Flyt straks fra kode-mapper |

Ved tvivl: produktion → `js/`/`assets/`/`docs/`; dev-arbejde → `mockups/`/`old/`; ellers spørg brugeren. Detaljer i memory-note `reference_mappe_disciplin`.

---

## Arkitektur

Appen følger et Model-View-Controller mønster:

- **Model:** `Simulator`-klassen (`js/simulator.js`) — ejer al spiltilstand og kører den fysiologiske simulation hvert tick. Nøgleegenskaber: `trueBG`, `cgmBG`, `iob`, `cob`, `weightChangeKg`. Indeholder al fysiologi: stresshormoner, ketoner, brain energy deficit, protein/fedt-modeller, glukotoksicitet, FFA-resistens m.m.
- **View:** `drawGraph()` tegner canvas-grafen; `updateUI()` opdaterer DOM-elementer. Begge i `js/ui.js`.
- **Controller:** Event listeners i `js/main.js` håndterer brugerinterventioner (mad, insulin, motion) og spilkontrol.
- **Campaign:** `CampaignEngine` (`js/campaign.js`) styrer level-progression, objectives, stjerne-rating, tips og karakterbaserede popupper. Level-definitioner i `js/levels.js`.
- **Game modes:** `startGame(mode)` i `js/game.js` — modes: `sandbox` (fri leg), `campaign` (baner), `boxchallenge` (daglig udfordring).

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

## Todo-liste

Se `TODO.txt` i projektroden — den er den eneste todo-liste og vedligeholdes af både Claude og Codex.

---

## GitHub

Repository: https://github.com/krauhe/t1d-simulator
