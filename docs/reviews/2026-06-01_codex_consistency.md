# Codex review - projektkonsistens, GitHub-tekst, hjælp og fysiologi

Dato: 2026-06-01

Scope:
- Tværgående konsistens mellem README/GitHub-tekst, `index.html` hjælp-popup, versionsmarkører, filstruktur og den faktiske kode.
- Kritisk model/fysiologi-review efter `phys-reviewer`-skillens principper: kode læst før vurdering, kode/docs-match, plausibilitet og tests.
- Ingen kodeændringer er lavet i dette review.

Verifikation:
- `tests/.bin/node.exe tests/simulation.test.js`: 146/146 tests passed.
- `tests/check-text-sync.sh`: OK, men kun når Git Bash køres med `tests/.bin` i `PATH`, så scriptet finder den portable Node.
- `tests/check-doc-sync.sh`: fejler, fordi scriptet forventer danske dokumentationsfiler, som projektets nuværende regler siger ikke længere skal findes.

Samlet status:
- KRITISK: 0
- ADVARSEL: 3
- NOTE: 6
- OK: 6

---

## [ADVARSEL] - README/GitHub-teksten er ikke up to date med filstruktur og model

**Fil:** `README.md`, linje 63, 69-90, 107; `index.html`, linje 1251
**Subsystem:** GitHub/README-dokumentation
**Problem:** README beskriver Hovorka-kernen som 11 state variables, men den faktiske model og `MODEL-IMPLEMENTATION.md` beskriver 16 ODE-state variables med basal shadow-kaskade og motion-state. README linker også til danske docs, som ikke findes: `docs/MODEL-IMPLEMENTERING.da.md` og `docs/BG-VIDENSKAB.da.md`.
**Evidens:**
- `js/hovorka.js` beskriver og opretter `new Float64Array(16)`.
- `docs/MODEL-IMPLEMENTATION.md` linje 73-80 og 163-178 beskriver 16 state variables.
- `Test-Path docs/MODEL-IMPLEMENTERING.da.md` og `Test-Path docs/BG-VIDENSKAB.da.md` returnerede `False`.
**Forslag:** Opdater README og hjælpens Credits til 16 ODE'er, fjern danske doc-links eller marker dem som historiske/fjernede, og tilføj `js/foods.js`, `js/levels.js` og `js/campaign.js` i filstrukturen.
**STATUS:** ✅ FIKSET (2026-06-01) - README og hjælpens Credits er opdateret til 16 state variables, døde danske doc-links er fjernet fra README, og README's filstruktur nævner `levels.js`, `foods.js` og `campaign.js`.

## [ADVARSEL] - Versioner er ude af sync på tværs af app-version, `package.json`, HTML fallback og hjælpens historik

**Fil:** tidligere `version.json` linje 2, `package.json` linje 3, `index.html` linje 38 og 1205/1448
**Subsystem:** Versionering og release-tekst
**Problem:** Den aktuelle app-version er `0.8.52-beta` i `version.json`, men `package.json` står på `0.8.47-beta`, HTML fallback-tooltip står på `v0.8.3-beta - 2026-04-06`, og hjælp-popupens version history viser stadig kun `v0.8.0-beta - 2026-04-01`.
**Evidens:**
- `js/main.js` linje 1270-1273 henter `version.json` runtime, så fallbacken ses især hvis fetch fejler, men teksten er stadig stale.
- Hjælpens `#version-history-da` og `#version-history-en` stopper ved `v0.8.0-beta`.
**Forslag:** Saml app-tooltip og hjælpens version history i én kilde, fjern app-versionen fra `package.json`, og hold HTML fallback neutral. Da appen skal kunne åbnes direkte som `index.html`, bør kilden være en script-fil og ikke en JSON-fil der kræver `fetch` fra `file://`.
**STATUS:** ✅ FIKSET (2026-06-01) - `js/version-data.js` er nu eneste kilde til aktuel version, dato og version history. `package.json`/`package-lock.json` har ikke længere app-version, `version.json` er fjernet, HTML fallback-tooltip er neutral, og hjælpens version history renderes dynamisk fra `APP_VERSION_INFO`.

## [ADVARSEL] - Fysiologi-dashboardets GitHub-links peger på gamle/forkerte anchors

**Fil:** `index.html`, linje 367-505; `docs/MODEL-IMPLEMENTATION.md`, linje 249, 321, 528, 1569, 1881, 2007, 2254, 2519, 2556
**Subsystem:** Hjælp/debug-links til modeldokumentation
**Problem:** Mange dashboard-links bruger danske anchors som `#glukose`, `#mad`, `#ketoner`, `#kernemodellen`, `#stresshormoner` og `#sovn`, men `MODEL-IMPLEMENTATION.md` bruger engelske anchors som `#glucose`, `#food`, `#ketones`, `#core-model`, `#stress-hormones` og `#sleep`.
**Evidens:** `rg` fandt dashboard-links i `index.html` linje 367-505 og de faktiske `<a name="...">` anchors i `MODEL-IMPLEMENTATION.md`.
**Forslag:** Ret links til de engelske anchors. Det er en lavrisiko UI/docs-fix, men brugeren bør godkende før ændring.
**STATUS:** ✅ FIKSET (2026-06-01) - Alle 18 berørte dashboard-links i index.html er opdateret til de engelske anchors (#glucose, #food, #ketones, #core-model, #activity, #stress-hormones, #sleep). Verificeret at alle 12 unikke anchors matcher faktiske `<a name="...">`-tags i MODEL-IMPLEMENTATION.md.

## [ADVARSEL] - Danske BG-SCIENCE-links i fysiologi-panelet peger på en ikke-eksisterende fil

**Fil:** `js/ui.js`, linje 4149-4150
**Subsystem:** Fysiologi-kraft-panel, GitHub-kilder
**Problem:** `BG_SCIENCE_BASE_URLS.da` peger på `docs/BG-VIDENSKAB.da.md`, men projektets nuværende regel siger at `BG-SCIENCE.md` kun vedligeholdes på engelsk, og filen findes ikke.
**Evidens:** `Test-Path docs/BG-VIDENSKAB.da.md` returnerede `False`. `AGENTS.md` specificerer at `BG-SCIENCE.md` og `MODEL-IMPLEMENTATION.md` er kun-engelsk.
**Forslag:** Lad både dansk og engelsk UI åbne `docs/BG-SCIENCE.md`, eller vis dansk tooltip men link til engelsk videnskabelig reference.
**STATUS:** ✅ FIKSET (2026-06-01) - `_bgScienceBaseUrls.da` peger nu på samme engelske `BG-SCIENCE.md` som `.en`, med inline-kommentar der forklarer at docs vedligeholdes kun-engelsk.

## [ADVARSEL] - `tests/check-doc-sync.sh` afspejler en gammel dokumentationsstrategi

**Fil:** `tests/check-doc-sync.sh`, linje 4-17 og 95-107; `AGENTS.md`, videnskabelig dokumentation-reglen
**Subsystem:** Dokumentationsverifikation
**Problem:** Scriptet forventer danske oversættelser af `MODEL-IMPLEMENTATION.md` og `BG-SCIENCE.md`, men projektreglen siger nu at disse to docs vedligeholdes kun på engelsk. Scriptet fejler derfor korrekt efter gammel regel, men forkert efter nuværende regel.
**Evidens:** Kørsel gav `MISSING: MODEL-IMPLEMENTERING.da.md does not exist` og `MISSING: BG-VIDENSKAB.da.md does not exist`.
**Forslag:** Opdater eller pensionér `check-doc-sync.sh`, så det ikke blokerer en korrekt kun-engelsk docs-strategi. `check-text-sync.sh` er stadig relevant for UI/i18n.
**STATUS:** ✅ FIKSET (2026-06-01) - `check-doc-sync.sh` omskrevet: kontrollerer nu at `MODEL-IMPLEMENTATION.md` og `BG-SCIENCE.md` (kun-engelsk) har et gyldigt `<!-- doc-version: YYYY-MM-DD-vN -->`-marker på linje 1. Forventer ikke længere DA-oversættelser. Help-template-synk håndteres af `check-text-sync.sh` (ikke duplikeret). Begge scripts exit code 0 efter ændring.

## [NOTE] - Hjælp-teksten er generelt synkroniseret, men “validated” kan misforstås

**Fil:** `index.html`, linje 1184, 1427; `README.md`, linje 7 og 38
**Subsystem:** Hjælp-popup og GitHub-framing
**Problem:** Hjælpen siger “built on validated physiological models”, mens samme popup og README også siger at simulatoren ikke er klinisk valideret. Det er teknisk rigtigt hvis der menes Hovorka-kernen, men kan læses som at hele simulatoren er valideret.
**Evidens:** Hovorka 2004 er valideret i litteraturen, men simulatorens mange extensions og game mechanics er egne modeller.
**Forslag:** Skriv fx “built on published physiological models and scientific literature; the full simulator is not clinically validated.”
**STATUS:** ✅ FIKSET (2026-06-01) - "validated" omformuleret til "published" + tilføjet eksplicit clausul "selve simulatoren er ikke klinisk valideret" / "the full simulator is not clinically validated" i begge sprog (index.html linje 1184 + 1396). Help-version bumpet til 2026-06-01-v3.

## [NOTE] - Spiller-vendt akuttekst bryder den varme tone-regel enkelte steder

**Fil:** `js/i18n.js`, linje 740, 767, 1550, 1577
**Subsystem:** Spiller-vendt sikkerhedstekst
**Problem:** De fleste campaign-tekster er varme og læringsorienterede, men advarslerne bruger “farligt”, “du har kun få minutter” og “sværere bliver det at overleve”. AGENTS-reglen forbyder især “overleve” som standard-framing og beder om oplysende, ikke skræmmende akuttekst.
**Evidens:** `acidosis.warning.message` bruger direkte “overleve” på dansk og “survive” på engelsk.
**Forslag:** Bevar akuthed, men omskriv til handlingsorienteret sprog: “jo længere du venter, jo mere støtte kræver kroppen for at komme tilbage i balance.”
**STATUS:** ✅ FIKSET (2026-06-01) - `brain.deficit.warning.message` og `acidosis.warning.message` (DA + EN) fjerner de problematiske afslutningssætninger ("Du har kun få minutter!", "the longer you wait, the harder it becomes to survive") og bevarer den oplysende del + handlings-call. i18n-paritet bevaret (695 = 695 nøgler). Note: `campaign.levelN.obj.survive` er kun et internt key-navn — værdierne er allerede varme ("Bevar god blodsukkerkontrol").

## [NOTE] - Modeldocs indeholder forbudte metafor-formuleringer og antropomorfisering

**Fil:** `docs/MODEL-IMPLEMENTATION.md`, linje 172, 322, 380, 384, 393-403, 1652; `docs/diagrams/protein-glucagon/caption.md`, linje 1
**Subsystem:** Videnskabelig dokumentation og diagramtekster
**Problem:** AGENTS forbyder specifikt kampmetaforer om EGP-regulering og antropomorf fysiologisprog. Modeldocs og diagramcaption bruger netop den type formuleringer om stressMultiplier, x3, leverrespons og GLUT4.
**Evidens:** En målrettet søgning efter forbudte formuleringer fandt konkrete matches i docs og diagramcaption.
**Forslag:** Omskriv til mekanistisk sprog: `EGP = EGP0 * max(0, stressMultiplier - x3)` og beskriv x3 som insulin-medieret suppression af hepatisk glukoseproduktion.
**STATUS:** ✅ FIKSET (2026-06-01) - Alle berørte sektioner i `docs/MODEL-IMPLEMENTATION.md` omskrevet til mekanistisk sprog: state-tabel description-kolonne (linje 170-172), section title (linje 322 "From Injection to Effect"), effect-mechanism table (linje 380-382), den store EGP-sektion (linje 384-410) og duplikat længere nede (linje 1645-1660). `docs/diagrams/protein-glucagon/caption.md` "tug-of-war" omskrevet til "EGP balance". Doc-version bumpet til `2026-06-01-v1`. Final grep for tug-of-war/wins/pulls/break-through-mønstre i `MODEL-IMPLEMENTATION.md` og `BG-SCIENCE.md`: ingen matches.

## [NOTE] - `levels.js` top-kommentar beskriver en gammel campaign-progression

**Fil:** `js/levels.js`, linje 14-18, 336-363, 493-516
**Subsystem:** Campaign-dokumentation i kode
**Problem:** Top-kommentaren siger “Bane 2: Dawn-effekt + mad” og “Bane 3: Bolus insulin”, men den aktuelle bane 2 har kun `enabledFoodRows: ['adjustments']` og introducerer hurtiginsulin til dawn-korrektion; bane 3 introducerer hurtige snacks/drikke og ICR.
**Evidens:** `js/levels.js` linje 352-363 og 507-516.
**Forslag:** Opdater kommentaren, så den matcher den faktiske læringsprogression.
**STATUS:** ✅ FIKSET (2026-06-01) - Top-kommentaren i `js/levels.js` matcher nu de faktiske i18n-titler ("Basal-insulin", "Dawn-effekten", "Hurtige kulhydrater") og beskriver hvad hver bane faktisk introducerer (basal → hurtiginsulin til dawn-korrektion → ICR + snacks-dosering). Tilføjet linje om at videre baner findes i `CAMPAIGN_LEVELS`-arrayet, så kommentaren ikke skal vedligeholdes ved hver ny bane.

## [NOTE] - Root indeholder stray temp-filer i strid med mappe-disciplinen

**Fil:** projektroden
**Subsystem:** Repo-hygiejne
**Problem:** Der ligger utrackede temp-filer i roden: `.claude/launch.json`, `CLAUDE.md.tmp.10968.e9c812f05ee1`, `TODO.txt.tmp.13980.1b13d76c2095`, `TODO.txt.tmp.29592.729c68dbf9b3`. De er ikke nødvendigvis farlige, men roden bør holdes fri for løse artefakter.
**Evidens:** `git status --short`.
**Forslag:** Flyt relevante temp-filer til `old/` eller slet dem efter godkendelse. `.gitignore` er også ændret lokalt og bør vurderes separat, før der ryddes op.
**STATUS:** ✅ FIKSET (2026-06-01) - De 3 `.tmp.*`-crash-artefakter slettet (CLAUDE.md.tmp.10968.*, TODO.txt.tmp.13980.*, TODO.txt.tmp.29592.*). `.gitignore` udvidet med `*.tmp.*` (Dropbox/editor-crash-mønster) og `.claude/launch.json` (lokal Claude Preview-konfiguration). De lokale `Video/`/`video/`-linjer fra en sideløbende session er nu også committet.

## [NOTE] - Portable Node bruges af tests, men shell-scripts antager global `node`

**Fil:** `tests/check-text-sync.sh`, linje 78-103
**Subsystem:** Testværktøjer
**Problem:** `check-text-sync.sh` kalder `node` direkte. I dette Windows-miljø virker scriptet først, når `tests/.bin` manuelt tilføjes `PATH`.
**Evidens:** Første kørsel med Git Bash fejlede uden i18n-output; kørsel med `PATH="$PWD/tests/.bin:..."` gav OK.
**Forslag:** Opdater scripts til at bruge `tests/.bin/node.exe` når den findes, med fallback til global `node`.
**STATUS:** ✅ FIKSET (2026-06-01) - `check-text-sync.sh` `check_i18n_keys` finder nu portable Node automatisk: prøver `tests/.bin/node.exe`, så `tests/.bin/node`, ellers fallback til global `node`. Verificeret at i18n-paritets-check nu rapporterer "695 nøgler" uden manuel PATH-opsætning.

## [OK] - Fysiologisk kernemodel og testpakke er konsistent på de dækkede scenarier

**Fil:** `js/hovorka.js`, `js/simulator.js`, `tests/simulation.test.js`
**Subsystem:** Model/fysiologi
**Problem:** Ingen kritisk fejl fundet i dækkede scenarier.
**Evidens:** `146/146` tests passerer, inklusive basal steady state, bolus ISF, motion, HAAF, ketoner/DKA, FFA-resistens, glukotoksicitet, carb-typer, muskelglykogen og campaign/Box Challenge mekanik.
**Forslag:** Bevar testene som minimumsbarriere før større tekst- eller modelændringer.
**STATUS:** ⚠️ ACCEPTABEL

## [OK] - Kode og MODEL-IMPLEMENTATION er grundlæggende synkroniseret om 16-state Hovorka-udvidelsen

**Fil:** `js/hovorka.js`, linje 20-31 og 137-156; `docs/MODEL-IMPLEMENTATION.md`, linje 73-80 og 163-178
**Subsystem:** ODE-state dokumentation
**Problem:** Ingen mismatch fundet for state-vectorens hovedstruktur.
**Evidens:** Begge beskriver D1, D2, S1, S2, Q1, Q2, I, x1, x2, x3, C, E1, E2, S1b, S2b og Ib.
**Forslag:** README og hjælpens Credits skal bringes op på samme niveau.
**STATUS:** ⚠️ ACCEPTABEL

## [OK] - UI i18n-nøgler og hjælp-template-versioner er synkroniserede

**Fil:** `index.html`, `js/i18n.js`, `tests/check-text-sync.sh`
**Subsystem:** UI-tekst-synkronisering
**Problem:** Ingen synkroniseringsfejl fundet, når scriptet køres med korrekt Node-path.
**Evidens:** `help-content-da matcher help-content-en (2026-04-12-v1)` og `da (695 nøgler) = en (695 nøgler)`.
**Forslag:** Scriptet bør selv finde portable Node, så testen ikke kræver manuel `PATH`.
**STATUS:** ⚠️ ACCEPTABEL

## [OK] - Dokumenterne har aktuelle doc-version markører

**Fil:** `docs/MODEL-IMPLEMENTATION.md`, linje 1; `docs/BG-SCIENCE.md`, linje 1
**Subsystem:** Videnskabelige docs
**Problem:** Ingen manglende doc-version markører fundet.
**Evidens:** `MODEL-IMPLEMENTATION.md` har `2026-05-24-v1`; `BG-SCIENCE.md` har `2026-05-23-v5`.
**Forslag:** Hvis indholdsmæssige docs-fixes laves efter dette review, bump markøren efter projektreglen.
**STATUS:** ⚠️ ACCEPTABEL

---

## Prioriteret anbefaling

1. Ret først de resterende bruger-/GitHub-synlige stale links: dashboard anchors og `js/ui.js` BG-SCIENCE-base-url.
2. Ret derefter sproglige policybrud i `MODEL-IMPLEMENTATION.md`, diagramcaption og de mest dramatiske akuttekster i `js/i18n.js`.
3. Opdater test/scripts: `check-doc-sync.sh` skal matche kun-engelsk docs-reglen, og `check-text-sync.sh` bør finde portable Node.
4. Ryd roden for temp-filer efter eksplicit godkendelse, da der allerede findes lokale/uafklarede ændringer.
