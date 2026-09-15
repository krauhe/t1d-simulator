# Spilguide: lettere tekst og fungerende opslag

Genereret: 2026-09-06

## Status og omfang

TODO 33 er implementeret lokalt. Alle 16 afsnit er gennemgået på dansk og engelsk med game-text-writer-skillen: observation, forklaring og en relevant måde at undersøge sammenhængen. Simulatorens fysiologi er ikke ændret. Intet er committet eller pushet i denne opgave.

TODO 34 er delvist afsluttet: kode-, tekst- og browserkontrollerne nedenfor består. Den særskilte mobilapp mangler fortsat Spilguide og Hvad Nu Hvis. Læsernes forståelse kan ikke dokumenteres med automatiske tests.

## Tekstændringer

1. Gentagne genvejsforklaringer, løse formaninger og vage henvisninger til kurven er fjernet. Spilleren bruger kontrollerne; karakteren modtager mad og insulin.
2. Basalinsulin forklares fra leverens glukosefrigivelse til den langsomme virkning gennem dagen. Hurtiginsulin forklares fra forsinkelse til overlappende doser og senere fald.
3. Mad forklares i rækkefølgen kulhydrat, fedt, protein og low carb. Hvert afsnit bygger videre på det foregående uden at indføre ICR-beregninger.
4. Aktivitet forklarer samspillet med insulin, forskellene på cardio/styrke/blandet og virkninger bagefter. CGM-afsnittet skelner mellem sensorafvigelse og faktisk ændring i simuleret blodsukker.
5. Ketoner og symptomer beskrives konkret, uden instruktioner til læserens egen behandling. De overflødige tekniske begreber og utilgængelige vægt-/syvdagesafslutninger er fjernet.
6. Hvad Nu Hvis har et kort selvstændigt afsnit: adgang efter en handling, samme karakter, redigering i spillet tid, seks ekstra timer, låste hændelser, Variationer og tilbagevenden uden at overføre ændringer.
7. Resultatfeedback adskilles fra forklaringen: hvad skete der, hvad gik forud, hvad vil spilleren undersøge næste gang, og hvordan startes et nyt forsøg?
8. Den danske guide bruger de faktiske menunavne **Insights** og **Settings**. En oversættelse kun i guiden ville gøre knapperne sværere at finde.

Ord er talt i afsnittenes brødtekst efter fjernelse af HTML; overskrifter er ikke medregnet:

| Sprog | Før | Eksisterende afsnit nu | Inklusive nyt Hvad Nu Hvis |
|---|---:|---:|---:|
| Dansk | 1.781 | 1.333 (-25,2 %) | 1.424 (-20,0 %) |
| Engelsk | 1.977 | 1.503 (-24,0 %) | 1.602 (-19,0 %) |

Den samlede reduktion er lidt mindre end det oprindelige ønske om 25-30 %, fordi Hvad Nu Hvis er tilføjet, og de nyttige fysiologiske forklaringer er bevaret. Ordantal er ikke i sig selv et mål for læsbarhed.

## Fejl og verifikation

1. **FIKSET:** Basaldeling, dawn-start og nathandlinger åbner nu de relevante afsnit. Bane 5 linker til mad, hurtiginsulin og energi, ikke stress/sygdom. Præcise undtagelser har forrang for generiske orddele.
2. **FIKSET:** Indholdsfortegnelsens nederste afsnit kunne ligge uden for vinduet ved 1280 x 800. Den kan nu rulles separat fra brødteksten. Det eksisterende popup-design er bevaret.
3. **BESTÅET:** `tests/guide-links.test.js`: 16 tosprogede afsnit og ikoner, 87 aktive tipnøgler, alle 10 baneintroers links og 14 indholdsspecifikke regressionscases. Begge guideversionsmarkører matcher.
4. **BESTÅET:** `tests/check-text-sync.sh`, `tests/check-intended-purpose-text.js`, `tests/symptoms.test.js` og `tests/public-release-boundary.test.js`.
5. **BESTÅET:** Syntakskontrol af guide-data, i18n, ui og browsertesten. Afgrænset `git diff --check` på denne opgaves guide/i18n/CSS/testfiler. Et generelt diff-check peger på eksisterende whitespace i den andens ændringer i `levels/CREATIVE-GAME-IDEAS.md`; de er ikke ændret her.
6. **BESTÅET:** `tests/guide-browser-smoke.cjs`: 96 opslag (16 afsnit x 2 sprog x 3 skærmstørrelser: 1280 x 800, 1920 x 1080, 375 x 667). Hvert afsnits overskrift er synlig efter rulning, og popupen holder sig inden for skærmen. Ingen JavaScript-sidefejl i disse flows.
7. **BESTÅET:** Kampagne → Hvad Nu Hvis → guide → oprindelig pauset kampagne. Fast karakter bevaret; en ændret insulinhændelse i editoren overføres ikke til banen. Samme oprindelige Simulator-objekt, simulationstid og blodsukker gendannes. Ingen alternativ pointscore; 20 spillede minutter giver 381 samples inklusive startpunkt og seks ekstra timer.
8. **BESTÅET:** Resultatskærm → relevant guide → samme resultatskærm → Prøv igen → ny baneintro. Tabshændelsen var en kontrolleret testfikstur, ikke en fysiologisk kalibreringstest.

Browseren var headless, isoleret fra brugerens profiler og startet med `--mute-audio`; alle tre lydindstillinger var desuden slået fra. Skærmbilleder ligger lokalt i `tests/playwright/2026-09-06_guide/`, især `guide-1280-da.png`, `guide-375-da.png` og `what-if-desktop.png`. Tidlige `ISSUE-`-billeder viser diagnostik før rettelse eller før afsluttet rulleanimation, ikke uløste slutresultater.

## Resterende arbejde

1. **ÅBEN, TODO 34:** `/mobile/` indlæser ikke Spilguide/Hvad Nu Hvis. Browserkontrollen fandt hverken `showGuidePopup` eller `Editor` dér. Mobilbredde-testen ovenfor gælder den fælles desktop-version; den må ikke omtales som en færdig mobilapp-integration. At tilføje funktionerne til den særskilte shell er en separat implementeringsopgave.
2. **ÅBEN, TODO 34:** Test med læsere, om forklaringerne er forståelige, og om forskellen mellem den fiktive karakter og egen behandling er tydelig. Intended-purpose-testen finder kendte uønskede formuleringer; den er ikke en juridisk vurdering eller dokumentation for brugerforståelse.

Det historiske review `2026-07-31_codex_game-guide.md` er statusopdateret ved hvert punkt. Den gamle danske kladde er markeret som erstattet. TODO 33 er flyttet til færdige; TODO 34 beskriver kun den resterende del.
