# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Codex-samarbejde på dette projekt

Codex skal behandle denne fil som den primære arbejdsaftale for fremtidige sessioner i T1D Simulator-projektet. `CLAUDE.md` kan bruges som historisk reference, men hvis der er forskel, har `AGENTS.md` forrang for Codex.

### Arbejdsform
- Start med at læse den relevante kode/dokumentation før du konkluderer. Projektet er stort, og mange valg er allerede truffet med vilje.
- Forklar kort hvad du undersøger, før du læser mange filer eller kører tests.
- Diskutér findings og mulige løsninger før implementering, medmindre brugeren tydeligt beder om at ændre koden.
- Hold ændringer snævert knyttet til brugerens konkrete ønske. Undgå opportunistiske refaktoreringer.
- Bevar brugerens og andre agenters ændringer. Revert aldrig noget, medmindre brugeren eksplicit beder om det.
- Når en opgave er implementeret, kør den mindste relevante verifikation og sig ærligt hvis noget ikke kunne testes.

### Codex-specifik brug af værktøjer
- Brug `rg` / `rg --files` til søgning, og læs flere uafhængige filer parallelt når det giver mening.
- Brug `apply_patch` til manuelle filændringer.
- Brug projektets skills når de matcher opgaven:
  - `phys-reviewer` til kritisk fysiologisk review af model/kode.
  - `science-reviewer` til videnskabelig research og `docs/BG-SCIENCE.md`.
  - `playwright-test` til browser-/UI-/gameplay-test.
  - `diagrammaker` til fysiologiske SVG-diagrammer.
  - `facebook-post` til opslag om simulatoren.
- Ved browserbaseret test: foretræk projektets Playwright/browser-skill frem for ad hoc screenshots.
- Ved GitHub- eller push-relateret arbejde: husk versionreglerne i `js/version-data.js`.

### ElevenLabs intro-tour lyd
- Intro-tour lydfiler ligger i `sounds/tour/<sprog>/`. Dansk generation logges i `sounds/tour/da/generation-log.txt`.
- Før ethvert API-kald, der genererer eller regenererer en lydfil, skal Codex vise brugeren det præcise filnavn og manuskript og bede om udtrykkelig tilladelse. Et tidligere generelt "go" eller en bred implementeringsopgave er ikke tilladelse til et betalt lydkald. `-DryRun` må køres uden ny tilladelse, fordi det ikke kalder API'et.
- Generér ALTID kun én lydfil ad gangen med `-Only`, fx `-Only 08` eller `-Only 08-food-sugars.mp3`. Kør ALDRIG hele `-Language da` uden `-Only`, fordi det kan overskrive allerede godkendte filer.
- Brug fuldt filnavn når flere filer deler prefix. Fx matcher `-Only 09` både `09-food-meals.mp3` og `09-food-lowcarb.mp3`; brug derfor `-Only 09-food-meals.mp3` eller `-Only 09-food-lowcarb.mp3`.
- På Windows PowerShell 5 må `tools/generate-tour-audio.ps1` IKKE køres med almindelig `powershell -File`, fordi UTF-8 uden BOM kan blive læst forkert før API-kaldet. Symptomet er mojibake i dry-run, fx `åbner` bliver til `Ã¥bner`.
- Brug i stedet denne præcise UTF-8 scriptblock-kørsel:
  ```powershell
  $script = [IO.File]::ReadAllText('.\tools\generate-tour-audio.ps1', [Text.Encoding]::UTF8); $block = [scriptblock]::Create($script); & $block -Language da -Only 08
  ```
- Før API-kald: kør samme kommando med `-DryRun`, kontroller at dansk tekst vises med korrekte `æ`, `ø`, `å`, og at kun den ønskede fil står som `Generating ...`.
- TTS-tekst til dansk skal bruge rigtig dansk tegnsætning med `æ`, `ø`, `å`. Brug ikke Latiniseret `ae/oe/aa`.
- Brug cifre ved alle tal i dansk TTS-tekst. Skriv fx `1`, `2`, `3`, `15 minutter`, `30 minutter`, `60 minutter` i stedet for talord.
- Hvis overskriften lyder som en gentagelse af første sætning, skal overskriften udelades fra TTS-teksten.
- Standardindstillinger der aktuelt virker bedst for dansk Peter-stemmen: `VoiceId=qhEux886xDKbOdF7jkFP`, `ModelId=eleven_multilingual_v2`, `Stability=0.34`, `SimilarityBoost=0.78`, `Style=0.85`, `language_code=da`, `use_speaker_boost=true`.
- Efter generation: log filen som `REVIEW` med dato, bytes, indstillinger og `-Only`-nummer. Vent på brugerens lyttevurdering. Marker først som `OK`, når brugeren eksplicit siger at filen er godkendt.
- Hvis en fil skal prøves igen, overskriv kun den samme fil med samme `-Only`-filter, og skriv i loggen hvad der virkede eller ikke virkede.

### Kommunikation
- Svar på dansk når brugeren skriver dansk.
- Nummerér altid forslag, valgmuligheder og emnelister, så brugeren kan referere til dem med et nummer.
- Brug konkrete filstier og linjer når du forklarer kode.
- Forklar almindelige programmeringsbegreber kort, når de er relevante, da projektets ejer ikke er professionel udvikler.
- Vær direkte om risici, især fysiologiske modeller, medicinsk framing, børnevenlig tone og tests.
- Når en opgave er færdig, afspil en kort, lav afslutningstone på 250 Hz i 2 sekunder.

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
- Kernemodel (ODE'er) i `js/hovorka.js`, al øvrig fysiologi og spilmekanik i `js/simulator.js`
- Skriv kode der er nem at udvide (tænk fremad mod baner og sandkasse)
- **Familiært design:** Når noget nyt minder om noget eksisterende, brug ALTID samme designmønster, klasser og struktur — både visuelt OG funktionelt. Genopfind ikke hjulet — genbrug det velkendte. Hvis en komponent (pil, ikon, knap, panel, animation) allerede findes ét sted i UI'et, skal den samme komponent genbruges når tilsvarende funktionalitet tilføjes andetsteds. Eksempler: nye toggles skal bruge samme knap-stil som eksisterende toggles (lyd-ikonet), dropdown-pile skal matche pilene i fysiologi-panelet, nye popups skal bruge det eksisterende popup-mønster, glaseffekt-paneler skal bruge de samme CSS-variable osv.

### Ændringsregler
- **Ændr KUN det brugeren specifikt beder om** — lav ikke ekstra rettelser, refaktoreringer eller "forbedringer" medmindre de er direkte nødvendige for opgaven
- Ved tvivl: spørg i stedet for at antage
- **Implementér små, entydige rettelser direkte.** Når brugeren forelægger et konkret issue, og løsningen er ligefrem, snæver og uden væsentlige tradeoffs, må Codex undersøge, implementere og verificere rettelsen med det samme. Fortæl kort undervejs hvad der gøres og bagefter hvad der er gjort. Dette gælder fx en forkert UI-tilstand, en afgrænset layoutfejl, en tydelig tekstfejl eller en simpel inkonsistens med eksisterende design/logik.
- **Diskutér FØR større eller tvetydige ændringer.** Diskutér først når der er flere rimelige løsninger, væsentlige design-/fysiologi-/MDR-/sikkerhedsmæssige tradeoffs, usikkert scope eller risiko for at ændre noget ud over brugerens konkrete ønske. Præsentér findings og muligheder, og vent på eksplicit "ja, implementer det" / "gør det" / "go". Nye problemer fundet under review skal også diskuteres før implementering, medmindre de falder under reglen om små, entydige rettelser ovenfor.
- **"Go" betyder ikke commit/push.** Ord som "go", "yes go", "gør det" og "implementer" betyder kun: lav ændringen lokalt og kør relevant verifikation. De må ALDRIG tolkes som tilladelse til at committe, pushe, publicere eller sende ændringer til GitHub. Commit/push må kun ske når brugeren eksplicit skriver fx "commit og push", "publicér", "send til GitHub", "lav en sikker version", eller på anden måde tydeligt beder om Git-publicering. Hvis et checkpoint virker klogt, foreslå det og vent på svar.
- **Ingen bagudkompatibilitet.** Simulatoren har ingen eksterne brugere eller gemt state der skal bevares på tværs af versioner. Når nye features implementeres eller eksisterende ændres: skriv den bedste implementering direkte, slet gammel kode, ret alle kald-steder. Brug IKKE tid på migrations-stier, feature flags, gamle API-skins eller "legacy"-varianter. Tilsvarende: campaign-levels, highscore-formater og localStorage-nøgler må gerne brækkes — ret dem bare samtidig.

### Developer input
- Mappen `developer input/` i projektroden bruges til at dele screenshots, videoer og andre filer med Codex.
- Når brugeren siger der er nyt input (fx "der er et screenshot", "tjek developer input", "ny fil"), skal du læse de nyeste filer i mappen.

### Mockups
- UI-mockups og designskitser gemmes i mappen `mockups/` i projektroden.

### Todo-liste
- Når brugeren beder om todo-listen, gør BEGGE dele:
  1. **Vis listen i chatten** (markdown-formateret)
  2. **Skriv den til `TODO.txt`** i projektroden (overskriver hver gang)
- `TODO.txt` er IKKE tracket i git — den er kun til brugerens lokale planlægning mens Codex arbejder.
- **Format:** Opdel i sektioner (KRITISK, HØJ PRIORITET, FREMTIDIGE FEATURES, FÆRDIGE). Inden for hver sektion: gruppér relaterede items sammen (fx alle audio-items efter hinanden, alle UI-items efter hinanden). Ét punkt per linje, kun nummer og kort beskrivelse.
- **Færdige:** List kun numrene kommasepareret, ikke hver på sin linje.
- **Vertikal liste:** TODO-listen skal ALTID skrives som vertikal liste med linjeskift mellem hvert element — aldrig som inline/horisontal liste (undtagen færdige-numre).
- **Dato i header:** `TODO.txt` skal altid have en `Genereret: YYYY-MM-DD` dato-linje i toppen (ligesom review-rapporterne).

### Issues-liste
- `ISSUES.txt` bruges til at samle bugs, issues og playtest-noter fra brugeren.
- Samme format-regler som `TODO.txt`: dato i header (`Genereret: YYYY-MM-DD`).
- `ISSUES.txt` er IKKE tracket i git — kun til lokal planlægning.

### Versionering
- Versionsnummer, dato og hjælp-popupens versionshistorik bor i `js/version-data.js`.
- Format: `version: 'X.Y.Z-beta'` og `date: 'YYYY-MM-DD'` i `APP_VERSION_INFO`.
- **Ved hvert git push:** bump patch-nummeret (Z+1) og opdatér datoen i `js/version-data.js`. Versionsspring skal være små og gradvise: `0.8.0 → 0.8.1 → 0.8.2 → ...`. Major-bump (Y: `0.8 → 0.9`) kun ved meget store milepæle (ny spiltilstand, fundamental arkitekturændring).
- Ved hvert git push skal `?v=`-cacheversionerne for lokale CSS- og JavaScript-filer i `index.html` og `mobile/index.html` matche versionsnummeret uden `-beta`.
- Logoet i top-baren viser version + dato som tooltip (mouse-over).
- **Version history** i hjælp-popup'en renderes fra `APP_VERSION_INFO.history` i `js/version-data.js`. Ved hvert minor-bump (Y+1): tilføj ny version-blok øverst i `history` med:
  - Overskrift: `vX.Y.Z-beta — YYYY-MM-DD`
  - *Features:* — de vigtigste nye funktioner
  - *Vigtige bugfixes:* / *Key bug fixes:* — kun de mest synlige/kritiske rettelser
- Skriv kun versionshistorik som er interessant for spillere/brugere: nye baner, nye værktøjer, bedre feedback, tydelige gameplay-ændringer og vigtige bugfixes. Drop interne ændringer, små label-omdøbninger, refaktoreringer, dokumentationsarbejde og detaljer man må formode at de fleste vil finde kedelige, medmindre de direkte ændrer brugeroplevelsen.
- Patch-bumps (Z+1) samles under næste minor-version.
- **Komprimering af ældre versioner:** Behold fuld detalje (features + bugfixes lister) på de 3 nyeste minor-versioner. Ældre versioner komprimeres til én linje hver: `<strong>vX.Y.Z</strong> (dato) — kort opsummering`. Dette holder historikken i hjælp-popup'en overskuelig. Fuld historik er altid tilgængelig på GitHub.
- **Model-udvidelses-listen i hjælp-popup'en** ("Udvidelser af modellen" / "Model extensions" i `index.html`): hvert punkt = max én linje (kort sætning + kort kilde i parentes). Kun de SIDSTE TO punkter må være flerlinje med formler/tal. Engelsk er primær — synk dansk. (Se HTML-kommentaren ved listen.)

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
- **Skriv i stedet videnskabeligt præcist:**
  - DÅRLIGT: *"The liver acts as a glucose buffer in a tug-of-war between insulin and glucagon."*
  - GODT: *"Hepatic glucose output is determined by the balance between insulin (suppressing EGP via x3) and counter-regulatory hormones (raising glycogenolysis and gluconeogenesis)."*
  - DÅRLIGT: *"Nyrene fungerer som en sikkerhedsventil ved høje BG-niveauer."*
  - GODT: *"Ved plasma-glukose over 10 mmol/L reabsorberer nyrerne ikke al filtreret glukose, og overskuddet udskilles i urinen (renal threshold)."*
- **Reglen gælder alt:** `docs/*.md` (især `MODEL-IMPLEMENTATION.md` og `BG-SCIENCE.md`), kode-kommentarer, figur-titler, caption-tekster, review-rapporter, commit-beskeder, facebook-opslag, alt.
- **Spiller-vendt UI-tekst er undtagelsen:** Her kan enkelt og levende sprog være velvalgt, men undgå stadig de specifikke AI-cliché-mønstre ovenfor.
- **Selv-tjek:** Hvis en sætning du har skrevet kunne stå uændret i 50 forskellige fysiologi-tekster fra 50 forskellige forfattere, er den sandsynligvis indholdsløs. Skriv konkret, kvantitativt, og med eksplicit reference til den specifikke mekanisme.
- **"Flødeskum uden kage"-testen:** Undgå venlige, luftige formuleringer der lyder støttende, men ikke giver spilleren en konkret handling, observation eller næste forståelige valg. DÅRLIGT: "Lad os starte roligt." BEDRE: "Jeg viser dig rundt." eller "Start med en kort rundtur."

#### Dansk tegnsætning (æ, ø, å) — ABSOLUT KRAV
- **ALDRIG skriv dansk tekst med Latiniserede erstatninger** (ae/oe/aa). Reglen gælder ALLE filer Codex genererer eller redigerer: `.md`, `.txt`, `.html`, `.js` (kommentarer + UI-strenge), mockups, level-templates, review-rapporter, TODO.txt, ISSUES.txt, facebook-opslag, commit-beskeder, alt.
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
- **Arbejdsretning (UI-tekst):** Når brugeren giver input på dansk, skriv den danske version først og oversæt derefter til engelsk. Når Codex skriver tekst fra bunden, skriv engelsk først og oversæt til dansk. I begge tilfælde: bump den engelske version-markør og synkronisér den danske `translated-from-en` markør.
- **Før merge til main:** kør `bash tests/check-text-sync.sh` og ret eventuelle uoverensstemmelser. Scriptet tjekker hjælp-templates og i18n-nøgler. Merge IKKE hvis scriptet fejler.

### Kommunikation
- Svar altid på dansk
- Forklar hvad du har ændret og hvorfor efter hver opgave
- Ved større ændringer: vis plan først, kód bagefter
- Foreslå gerne forbedringer men implementer dem ikke uden godkendelse
- Bevar altid simulationslogikken intakt ved UI-ændringer
- **Foreslå ALTID at committe og pushe før store ændringer** — så der altid er et sikkert fallback-punkt
- **Videnskabelig dokumentation: kun engelsk.**
  - `docs/MODEL-IMPLEMENTATION.md` og `docs/BG-SCIENCE.md` vedligeholdes kun på engelsk — ingen dansk oversættelse. Målgruppen er klinikere/forskere/modellører der læser engelsk.
  - Bump `<!-- doc-version: YYYY-MM-DD-vN -->` markøren i toppen ved indholdsmæssige ændringer.
  - **Rolle-fordeling:**
    - `BG-SCIENCE.md` — ren fysiologisk reference på videnskabeligt review-niveau. Mekanistisk og kvantitativ. INGEN simulator-/model-referencer i prosaen. Bruges som videnskabelig vidensbase for både klinikere og modellør-arbejdet.
    - `MODEL-IMPLEMENTATION.md` — simulator-specifik implementeringsdokumentation. Her hører model/kode-referencer hjemme.
  - Opdatér `docs/BG-SCIENCE.md` løbende med nye emner der er relevante for blodglukoseregulering. Dokumentet skal være en komplet videnskabelig oversigt over alle faktorer der påvirker BG ved T1D, med kvantitative parametre der kan bruges i modellering.
  - Til omskrivning/forbedring af `BG-SCIENCE.md`: brug `science-reviewer` skillen.
- **Hent ALTID relevante videnskabelige artikler** ned i `docs/references/` når nye emner tilføjes eller researches. Kilder skal så vidt muligt downloades som PDF. Filnavns-format: `Efternavn_Årstal[_RW]_Titel.ext` (fx `Hovorka_2004_NonlinearMPC.pdf`, `Cryer_2013_RW_GlucoseCounterregulation.pdf`). RW tilføjes kun ved review-artikler. Hvis PDF ikke er tilgængelig, gem som `.html` fra PMC eller lignende.
- **Review-workflow:** Når elementer fra en review-rapport rettes, skal der tilføjes en STATUS-annotation direkte i review-filen ved hvert berørt punkt. Brug formaterne: `✅ FIKSET (commit/dato)`, `❌ ÅBEN`, `⚠️ DELVIST`, eller `⚠️ BY DESIGN`. Opdatér også den samlede status-opsummering i bunden af rapporten. Reviews bor i `docs/reviews/` (se mappe-disciplin nedenfor).
- **Fix-decision-doc — påkrævet for non-trivielle model-ændringer.** Status-annotationer i review-filer er nok for små rettelser, men når ÉN af følgende kriterier er opfyldt, skal der skrives et dedikeret decision-doc i `docs/reviews/YYYY-MM-DD_<scope>-fix.md`:
  - **Kvantitativ kalibrering mod litteratur** — fix'et indebærer parameter-valg (amplituder, tidskonstanter, tærskler) hvor begrundelsen er forankret i specifikke kvantitative endpoints fra videnskabelige kilder. Hvis du ikke kan svare "hvorfor er denne værdi præcis 0.37 og ikke 0.30?" uden at re-derivere fra git-historik, kræves et decision-doc.
  - **Litteratur-target → test-assertion-kobling** — fix'et tilføjer eller justerer test-assertions hvor ranges er udledt fra forskningskilder (fx "ratio 1.10-1.18 ved +24t fra Cartee 2015"). Koblingen skal kunne genfindes uden at læse hele test-filen.
  - **Afvigelse fra initial review-anbefaling eller eksisterende design-spec** — sub-agent eller tidligere design-doc anbefalede én tilgang, men implementeringen valgte noget andet (fx anden t½, anden amplitude, anden mekanistisk struktur). Beslutningen og dens begrundelse skal dokumenteres.
  - **Eksperimentel verifikation før+efter** — fix'et er valideret med scriptet eksperiment (fx `tests/peis-verification.js`) der producerer kvantitativ før/efter-sammenligning. Resultaterne skal samles ét sted.
  - **Tre eller flere filer ændret som koordineret enhed** — fix berører fx både `js/simulator.js`, `tests/simulation.test.js` og `docs/MODEL-IMPLEMENTATION.md` med indbyrdes afhængigheder. Commit-beskeder fanger ikke helheden.
- **Format for fix-decision-doc:**
  1. **Bagrund** — hvad var symptomet, hvem opdagede det
  2. **Diagnose** — litteratur-evidens (med eksplicitte BG-SCIENCE/refs-citater), original design vs faktisk implementering, kvantitativ reality-check
  3. **Løsning** — matematisk struktur, konstanter, kalibrerings-tabeller med litteratur-targets
  4. **Verifikation** — eksperimentelle resultater (før/efter-tabel), test-resultater
  5. **Sub-agent input** (hvis brugt) — hvad agenten anbefalede, hvor jeg afveg og hvorfor
  6. **Files cited** — alle berørte filer + linjenumre + alle litteratur-referencer
- **Eksempel på et komplet fix-decision-doc:** [`docs/reviews/2026-04-29_late-phase-peis-fix.md`](docs/reviews/2026-04-29_late-phase-peis-fix.md). Brug det som template.
- **Hvornår er decision-doc IKKE påkrævet:** typo-fixes, oprydning, refactoring uden semantik-ændring, UI-tweaks, små bugs hvor symptomet og fix'et er åbenlyst fra koden. I disse tilfælde rækker commit-besked + STATUS-annotation i den oprindelige review-fil.

### Sub-agent og skill-brug i Codex

Codex må kun bruge sub-agenter når brugeren eksplicit beder om parallelle agenter, delegation eller lignende. Almindelig grundig analyse, review eller research er ikke i sig selv tilladelse til at spawne sub-agenter.

Når sub-agenter bruges, skal opgaven være afgrænset og selvstændig:

1. Output-formatet skal være klart specificeret.
2. Input-scope skal være eksplicit: filer, sektioner eller konkrete spørgsmål.
3. Brief'en skal kunne forstås uden hele samtalehistorikken.
4. Succeskriteriet skal være målbart.

Brug Codex' `explorer`-agent til afgrænsede kodebase-spørgsmål og `worker`-agent til klart ejede kodeændringer. Ved kodeændringer skal hver worker have et disjunkt write-scope og instrueres i ikke at overskrive andres arbejde.

For fysiologisk review, videnskabelig research, browser-test, diagrammer og Facebook-opslag skal de lokale skills bruges først, fordi de indeholder projektets domænespecifikke arbejdsgange.

**Undtagelse — `phys-reviewer`-skill:** Brug altid denne skill ved kritisk fysiologisk kode-review. Opgaven er at finde subtile logiske fejl på tværs af `js/hovorka.js`, `js/simulator.js`, parametre og ODE'er, og den kræver projektets specialiserede review-workflow.

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
  version-data.js ← App-version, dato og versionshistorik (eneste versionskilde)
  levels.js     ← Campaign-baner: CAMPAIGN_LEVELS array med level-konfigurationer
  foods.js      ← Madkatalog og makrodata
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
developer input/ ← Screenshots/videoer/filer brugeren deler med Codex. Gitignored
facebook posts/ ← Facebook-opslag og tilhørende screenshots. Underordnet: YYYY-MM-DD/
old/            ← Arkiverede gamle filer + referencer + dropbox-konflikter. Gitignored
```

Script-load rækkefølge i index.html (rækkefølgen er vigtig, da filer deler globalt scope):
`sounds.js` → `i18n.js` → `version-data.js` → `levels.js` → `foods.js` → `hovorka.js` → `simulator.js` → `ui.js` → `game.js` → `campaign.js` → `main.js`

---

## Mappe-disciplin (HVOR ting skal hen)

For at undgå at projekt-roden bliver fyldt med løse filer, gælder følgende regler — håndhæv dem ALTID både når du skriver nye filer OG når du rydder op:

### Reviews (Claude, Codex, UI, playtest)
- **Hvor:** `docs/reviews/`
- **Filnavn:** `YYYY-MM-DD_<author>_<scope>.md` (fx `2026-04-10_codex_general.md`, `2026-04-03_claude_ui.md`)
- **Aldrig:** I projektroden eller i en daterede topmappe (`2026-04-07 codex review/` etc.)

### Mockups (UI-design-eksperimenter)
- **Hvor:** `mockups/<YYYY-MM-DD>_<topic>/` (fx `mockups/2026-04-10_basal-icon/`)
- **Filtyper:** HTML, CSS, screenshots — alt der hører til en mockup-session
- **Status:** Gitignored — design-eksperimenter, ikke produktion
- **Aldrig:** I `ui-review/` (mappen findes ikke længere) eller i projektroden

### Screenshots fra Playwright-tests
- **Hvor:** `tests/playwright/<YYYY-MM-DD_HH-MM>/`
- **Filer:** Screenshots + `rapport.txt` (alt fra én test-session bor i samme mappe)
- **Status:** Gitignored
- **Aldrig:** I projektroden eller i `developer input/`

### Stray screenshots (debug, work-in-progress, før/efter)
- **Hvor:** `developer input/` hvis brugeren delte dem, ellers `old/screenshots/` for dev-artefakter
- **Aldrig:** I projektroden — selv ikke midlertidigt

### Facebook-opslag
- **Hvor:** `facebook posts/<YYYY-MM-DD>/` (én mappe per opslag)
- **Også:** `facebook posts/post-log.txt` (linje per opslag, nyeste sidst)
- **Skill:** `facebook-post` håndhæver formatet

### Level-planlægning
- **Hvor:** `levels/` (skabeloner, ideer, før de oversættes til `js/levels.js`)
- **Format:** UTF-8 m. BOM, ingen emoji/em-dash/× (samme regler som TODO.txt)

### Gamle filer / arkiv
- **Hvor:** `old/` med passende undermappe (`screenshots/`, `graphics/`, `dropbox-conflicts/`, etc.)
- **Status:** Gitignored — bevarer historik uden at fylde i workspace
- **Brug:** Når du er i tvivl om noget stadig bruges, læg det i `old/` snarere end at slette

### Dropbox-konflikter
- **Filer:** `* (NK2s modstridende kopi YYYY-MM-DD).js` osv.
- **Hvor:** Flyt straks til `old/dropbox-conflicts/` — de hører ALDRIG hjemme i `js/` eller andre kode-mapper

### Når der opstår tvivl
1. Skal filen være tracket i Git? → Kig på `.gitignore`-mønstre
2. Er det produktion (bruges af appen)? → Hører i `js/`, `assets/`, `sounds/`, `docs/`
3. Er det dev-arbejde? → `mockups/`, `developer input/`, `tests/playwright/`, `old/`
4. Er det dokumentation/reviews? → `docs/` eller `docs/reviews/`
5. Hvis stadig i tvivl: spørg brugeren før du gemmer en ny fil i roden

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

## Prioriteret todo-liste

### Færdige features (implementeringsdetaljer er i koden)
- ~~9b. Protein-modellering~~ ✅
- ~~9c. Fedt-forsinkelse / pizza-effekten~~ ✅
- ~~9d. FFA-induceret insulinresistens~~ ✅
- ~~9e1. Keton/acidose-kalibrering~~ ✅ (re-kalibreret 2026-03-22)
- ~~9e2. Glukotoksicitet~~ ✅
- ~~10. Baner / campaign-system~~ ✅
- ~~30. Udvidet ketonmodel (IOB-drevet)~~ ✅
- ~~32. Hjerne-energi-deficit model~~ ✅
- ~~33. Bolus-puls overlap-beregning~~ ✅
- ~~42. DKA game-over koblet til ketonmodel~~ ✅
- ~~43. IOB-beregning inkl. plasma-insulin~~ ✅

### Basale forbedringer
5. Sandkasse-tilstand med scenarier/forhindringer man kan aktivere

### Høj prioritet
6. Non-lineær insulin dosis-respons (sigmoid/Hill-kurver)
    - Lever, muskel og fedtvæv har forskellige aktiveringstærskler (EC50-værdier)
    - Lever: EC50 ~29 μU/mL, Muskel: EC50 ~55 μU/mL (Rizza 1981)
    - Implementering: erstat lineære x1/x2/x3-effektligninger med Hill-funktioner
    - Se BG-SCIENCE.md afsnit 25 for fuld videnskabelig baggrund
47. Campaign abilities — belønninger for god præstation (unlockable features)

### Fremtidige features
44. Valgbar basalinsulin-type i profilen (Tresiba, Levemir, Toujeo — kræver nye PK-modeller)
9\. Easy mode — sværhedsgrad for nybegyndere (ingen variabilitet, ingen CGM-støj)
9e. Fysiologisk ordbog / glossar
11. Standard Diabetes-rapport (AGP)
15. Kønsvalg (mand/kvinde) — påvirker BMR-beregning
24. Menstruationscyklus-effekt på insulinfølsomhed (kræver #15)
28. Alkohol-effekt på blodsukker
29. Bruger-styret søvn/vågentid
31. Symptom-indikationer på grafen (hypo + DKA — progressive tekst-overlays)
38. Differentierede sukkertyper (glukose/saccharose/stivelse → forskellige τG-værdier)
39. Bane-intro med fysiologi-tips
40. Glidende graf (LibreLink-stil)

### Parkeringsplads (lav prioritet / uafklaret scope)
4. Global/delt highscore-liste (online leaderboard)
12. Multiplayer/familie-konkurrence
23. Væskebalance-model
26. Alders-afhængigt insulinbehov
27. Sæsonvariation i insulinbehov
48. Nightmare mode — campaign bane 12. Randomiserede events (dårlig insulin, glemt basal, CGM-udfald, løb efter bus, ligget på arm, sygdom). DOOM-inspireret kaos som belønning for at gennemføre alle 11 læringsbaner. Låses op via campaign-gating.

---

## GitHub

Repository: https://github.com/krauhe/t1d-simulator
