# En gradvis pilot for onboarding og de første spilopgaver

Dato: 2026-10-25  
Status: Lokalt beslutningsoplæg og klikbar skitse. Ingen af nedenstående baneforslag er implementeret i den offentlige simulator.  
Udarbejdet af: Codex med afgrænset kritik fra Gemini 4 Argon via Antigravity.

**Start med én kort frokostcase med synlig baggrundsinsulin, og brug den til at afprøve indgangen, grafen og et ændret tidspunkt.** Afprøv derefter en kort situation mellem måltiderne. Behold den nuværende kampagne, indtil disse forsøg har vist, hvad der faktisk bliver lettere at forstå. Tre skitser er ikke en bestilling på tre færdige baner på én gang.

Den lokale mockup ligger i `mockups/2026-10-25_onboarding/index.html`. Den har dansk og engelsk tekst, tre frit tilgængelige situationer, valgfri hjælp og en illustreret sammenligning. Kurverne er tydeligt mærket som skitser. Den indlæser ingen simulatorkode og skriver ikke til browserens gemte spil. Mappen er ignoreret af Git og ligger uden for udgivelsesværktøjets tilladte runtimefiler.

## 1. Hvad testnoterne ændrer i prioriteringen

1. **Måltidet skal være synligt tidligt.** Kritikken handler ikke kun om klik før start. Den første oplevelse skal ligne en forståelig situation, hvor karakteren faktisk spiser.
2. **Insulin mellem måltider kræver en konkret forklaring.** Et kort tidsudsnit med synlige måltider før og efter er lettere at fortolke end tre døgn uden almindelige måltider. Dette er en designhypotese, der skal afprøves.
3. **Det er vigtigt at beskrive den nuværende bane præcist.** Bane 1 har adgang til hurtige kulhydrater; den har ikke almindelige måltider eller automatiske måltidshændelser. `durationMinutes: 4320` giver tre simulerede døgn. Kalorie/vægt-sporing og dawn-effekt er slået fra. Se [levels.js, bane 1](../../js/levels.js#L98), især linje 103–138.
4. **Dagens produktrettelser og onboardingforsøget er adskilte leverancer.** Først færdiggøres den fejlrettede offentlige udgave. Pilotarbejdet fortsætter lokalt. Talende tips, dosisbegrænsede udfordringer og en særskilt væk-knap fra noternes TODO-del er ikke med i piloten.

## 2. Hvad knowledgebasen tilfører

De to rapporter fra 20. oktober er allerede overvejende enige: kort aktiv start, genkendelige personer, hjælp ved behov og et nyt forsøg efter en observation. Knowledgebasen gør især **testens læringsmål** mere præcist.

| Nr. | Princip og evidensniveau | Konsekvens for piloten |
|---|---|---|
| K1 | Interaktionsfriktion og fagligt arbejde er forskellige. Designinferens fra knowledgebasens onboardingkapitel. | Fjern overflødig karakterbekræftelse; fjern ikke automatisk et nyttigt forudsigelsesspørgsmål for at spare et klik. |
| K2 | Tutorialeffekter varierer mellem spil. Nærliggende empirisk evidens. | Forklar knappen, når den skal bruges. Antag ikke, at alle skal gennem en lang tour, eller at en kompleks simulation kan undvære hjælp. |
| K3 | Feedback bør forklare den aktuelle observation; virkningen afhænger af opgave og bruger. Nærliggende evidens. | Vis én kort forklaring ved grafen og gør mere dybde valgfri. En stjerne er ikke en forklaring. |
| K4 | Hjælp til betjening kan skjule manglende faglig forståelse. Designinferens fra lærings- og evalueringskapitlerne. | Efter øvelsen bruges en ny beslægtet situation uden et hint, der afslører svaret. Bevar tilgængelighedshjælp. |
| K5 | Umiddelbar gentagelse, senere erindring og anvendelse i en ny situation er forskellige mål. Knowledgebasens syntese af nærliggende læringsforskning. | Sammenligning af to kurver tester ikke i sig selv varig læring eller evne til at håndtere virkelig diabetes. |
| K6 | Hvis både startflow, indhold og længde ændres, evalueres en samlet pakke. Metodisk designprincip. | En bedre pilot kan begrunde næste iteration, men ikke påstanden »to færre klik gav bedre læring«. |

K2 er kontrolleret mod [Andersen m.fl. (2012), *The Impact of Tutorials on Games of Varying Complexity*](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf). Studiet måler engagement og progression i andre spil, ikke uafhængig diabetesforståelse. K3 er kontrolleret mod [Shute (2008), *Focus on Formative Feedback*](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf); reviewet giver ikke én universel regel for tekstmængde eller timing. Begge URL'er er hentet fra brugerens pc med HTTP 200 og verificeret dokumenttitel den 25. oktober 2026.

De øvrige pointer anvendes som **design- og evalueringsforslag**, ikke som nye kvantitative effektpåstande. Der er ikke gennemført en ny systematisk litteratursøgning.

## 3. Slogan og den konkrete læringssekvens

**Dansk:** Eksperimentér. Observér. Lær. Gentag.  
**Engelsk:** Experiment. Observe. Learn. Repeat.

Det er et brugbart kort slogan. Knowledgebasens figur beskriver en mere udfoldet sekvens: *forudsig, handl, observér, forklar, gentag og variér*. Kapitlet kalder selv sekvensen en designinferens, der ikke er valideret som en samlet T1D-intervention. Den bør derfor ikke markedsføres som en dokumenteret, bestemt læringscyklus.

I den konkrete brugerflade bliver »lær« til en handling: **Hvad forventer du? → Prøv → Hvad ser du? → Hvad kan forklare forskellen?** Sloganet behøver ikke rumme alle disse instruktioner. Et efterfølgende forsøg skal ændre noget meningsfuldt; »gentag« skal ikke blot betyde flere identiske klik.

## 4. To mulige retninger

| Nr. | Retning | Fordel | Tradeoff |
|---|---|---|---|
| A | Korte indledende situationer med genbrug af graf, karakter, tidskontrol og tips | Kan afgrænse ét spørgsmål og give en tidlig afslutning; påvirker ikke eksisterende baner under udviklingen | Kræver en ny caseopsætning og en afprøvet overgang til kampagnen |
| B | Tilføj måltider og forberedt måltidsbehandling til eksisterende bane 1 | Bevarer én indgang og gør døgnforløbet mere genkendeligt | Måltidsoptagelse, tidligere insulin og basalvirkning kan blive svære at skille ad; kræver mere modelkontrol end blot at tilføje mad |

**A anbefales til første forsøg.** B er en reel mulighed, hvis brugertesten viser, at en kort introduktion efterfulgt af den eksisterende bane stadig føles som to forskellige spil. Der er endnu ikke grundlag for at erstatte hele kampagnestrukturen eller ændre fysiologien for at gøre den lettere.

## 5. Tre pilotdele, implementeret i små skridt

### P1. Eriks frokost — første modeltilkoblede forsøg

1. **Situation:** Erik skal spise et klargjort måltid. Det er synligt, at han allerede har baggrundsinsulin, og hvilke andre handlinger der er forberedt. Ingen personlige data eller egne behandlingsparametre.
2. **Læringsmål:** Spilleren kan forbinde en hændelsesmarkør med simuleret tid og det efterfølgende forløb. Baggrundsinsulin introduceres som en del af situationen, så frokosten ikke antyder, at insulin kun hører til måltider.
3. **Handling:** Et kort forudsigelsesvalg eller »Jeg vil se først«, ét måltidsvalg og styret tidsfremrykning til et observationspunkt. En bruger, som vælger »Se først«, skal senere inviteres til at forudsige et nyt forsøg; vedkommende skal ikke blokeres eller skammes.
4. **Feedback:** Én konkret observation og én forklaring ved grafen. Baggrund, tidligere handlinger og begrænsninger kan åbnes i et dybere lag.
5. **Mindste test:** Kan personen finde måltidet på grafen, skelne virkelig tid fra simuleret tid og forklare, at karakterens behandling er forberedt? Registrér selvstændige svar og hjælp hver for sig.
6. **Tradeoff:** En forberedt situation giver mindre frit valg. Den skal derfor hurtigt tilbyde et relevant alternativ, og den forberedte insulin må ikke fremstå som en generel dosisopskrift.

### P2. Mellem måltiderne — næste afgrænsede spørgsmål

1. **Situation:** Et kort udsnit af en dag. Morgenmad og næste måltid fremgår på tidslinjen; karakteren fremstilles ikke som fastende i flere døgn.
2. **Læringsmål:** Forklare, hvorfor baggrundsinsulin stadig har en rolle mellem måltider. Den eksisterende spilguide kan genbruges til forklaringen om leverens glukosefrigivelse og basalinsulin.
3. **Handling:** Forudsig et forløb mellem måltider og undersøg én foruddefineret kontrast. Den konkrete kontrast og dens tidsrum vælges først efter beregning med modellen.
4. **Mindste test:** Kan spilleren forklare relationen uden at gentage et knapnavn? Kan samme relation genkendes i en ny kort morgen-/eftermiddagssituation?
5. **Tradeoff:** Måltidsrester og tidligere insulin kan forklare noget af kurven. En tydelig fortælling er ikke nok til at tillægge hele ændringen basalinsulin. Ingen fast »stigning kl. 15« loves på forhånd.

### P3. Ét andet tidspunkt — udbygning af P1, ikke en ny motor

1. **Situation:** Gentag P1 med én ændret hændelsestid. Bevar relevante startforhold og øvrige hændelser.
2. **Læringsmål:** Skelne det ændrede input fra den observerede forskel og begrænse forklaringen til det, sammenligningen faktisk viser.
3. **Handling:** Vis to kurver på samme akser med begge hændelsestidspunkter. Spilleren kan vende tilbage til det oprindelige forsøg.
4. **Mindste test:** Før brugertest skal samme input give samme beregnede referenceforløb under de eksplicit kontrollerede forudsætninger. Ved én ændring må der ikke samtidig skiftes skjulte modelantagelser eller tilfældighedsforløb. Afvigelser skal måles numerisk, ikke skjules af afrunding.
5. **Tradeoff:** Eksisterende Hvad Nu Hvis er et oplagt udgangspunkt, men en uændret genberegning må først kontrolleres mod dens egen reference. To forskellige beregningsgrundlag er ikke et kontrolleret forsøg. Ingen ny generel tilbagespolingsfunktion er bestilt.

## 6. Rækkefølge og beslutningspunkter

1. **Afslut dagens udgivelse.** Rettelser fra testnoterne verificeres, og den udvalgte version offentliggøres efter projektets udgivelsesregler. Pilotfiler indgår ikke.
2. **Gennemgå den lokale skitse.** Vælg mellem A og B. Vurdér om første situation er forståelig og for teksttung. Den leverede mockup demonstrerer P1–P3, men er alene en visuel diskussion af retningen.
3. **Kontrollér én case i modellen før yderligere polering.** P1's starttilstand, baggrundsbehandling og hændelser verificeres. Giv faktisk modelberegnede snapshots tydelige akser, hændelser og simuleret tid. De må gerne være fastfrosne i næste UI-prototype, hvis det er tydeligt, at fri simulering ikke er tilgængelig endnu.
4. **Byg én lokal modeltilkoblet pilot.** Genbrug eksisterende komponenter og tilføj den mindste P3-sammenligning. Placér forventning, tidskontrol og forklaring på samme spilflade. Undgå en ny kæde af modalvinduer.
5. **Observer brugere før flere baner.** Første indholdstest kan afgrænses til desktop, mens layout og betjening fortsat kontrolleres på mobil. Medtag personer med forskellige forudsætninger; børns forståelse kan ikke antages ud fra voksnes svar.
6. **Udbyg kun det, testen begrunder.** P2 eller en omlægning af bane 1 vælges efter konkrete misforståelser. En kort situation må også være en fuldendt session; der kræves ingen genbesøgsbelønning.

Før større implementering bør den allerede autoriserede udgivelse være et verificeret Git-checkpoint. Det er ikke nødvendigt at publicere eksperimenterne for at afprøve dem lokalt.

## 7. Hvad skal måles?

| Nr. | Mål | Konkret observation |
|---|---|---|
| M1 | Adgang til aktiv opgave | Antal nødvendige startinteraktioner, tilbageklik og steder, hvor testleder må hjælpe. I skitsen: Start og Forstået før forventningsvalget. |
| M2 | Første faglige handling | Første selvstændige forudsigelse eller valg af en sammenligning, hvor personen kan sige, hvad der undersøges. Et »Giv frokost«-klik alene tæller som betjening. |
| M3 | Handling til observation | Kan personen finde hændelsesmarkøren, læse tidsskalaen og beskrive kurven? Dette kræver modelkurver med relevante akser; den nuværende skitse kan ikke bestå den faglige test. |
| M4 | Forklaring og nyt valg | Kan personen begrunde næste forsøg og skelne ændret input fra ændret resultat? Registrér brug af faglige svarhint. |
| M5 | Selvstændig anvendelse | Ny beslægtet situation uden hint, som afslører svaret. Et senere forsøg undersøger fastholdelse særskilt. |
| M6 | Oplevelse og grænser | Oplevet kontrol, lyst til et forsøg mere, mulighed for at stoppe, og forståelse af fiktiv person og manglende personlig dosisvejledning. |

Ingen bestemt varighed, stikprøvestørrelse eller succesprocent præsenteres som forskningsbestemt standard. Et mål som »to startklik« er et produktvalg. Permanente analytics er ikke nødvendige for denne første kvalitative runde.

## 8. Hvad blev ændret efter Argons kritik?

1. **Beholdt:** Tydeligere definition af første faglige handling; et skærm-/tekstbudget; synlig baggrundsinsulin i P1; kontrol af referenceforløb; kun én modeltilkoblet pilot ad gangen.
2. **Præciseret:** Den statiske mockup kan afprøve tekst og navigation, men ikke grafkompetence eller tidsforståelse. Næste prototype bør bruge modelberegnede forløb før faglig brugertest.
3. **Fravalgt:** Argons konkrete forslag om frokost efterfulgt af en basalbetinget stigning på bestemte klokkeslæt. Ingen simulering eller originalkilde i reviewet underbyggede netop det forløb. Det må undersøges frem for at blive skrevet som facit.
4. **Beholdt trods kritik:** »Jeg vil se først« er fortsat tilgængelig. Et frivilligt første observationsforsøg er et rimeligt designvalg; om det reducerer fagligt arbejde skal undersøges. Selvstændig forudsigelse måles senere særskilt.
5. **Dækning:** Argon læste hele den afgrænsede packet A–F og afleverede en eksplicit dækningsliste. Den læste ikke originale kodefiler, rapporter, testnoter, knowledgebasekapitler eller artikler. Dens rolle var kritik af Codex' sammenfatning, ikke uafhængig evidenssøgning. Rå output og packet bevares privat.

## 9. Verifikation og begrænsninger

1. **Browserkontrol:** Chrome, 1280 × 800, 1920 × 1080 og 375 × 667. Alle tre cases er gennemgået på dansk og engelsk, inklusive modalens Escape/tilbage, forventningsfravalg, tidsknap, sammenligning, næste case, sprogomskiftning og hjælp til/fra. Ingen JavaScript-fejl eller vandret overflow blev registreret. `localStorage` var uændret. Screenshots og maskinlæsbart resultat ligger lokalt under mockuppens `validation/`.
2. **Visuel kontrol:** Desktopgraf og mobilvelkomst blev set som screenshots. Første kontrol afslørede en forskel mellem tegnede tidsmarkører og labels; de er rettet, og browserkontrollen er gentaget. Hjælpeteksten ændrer sig nu med det aktuelle trin.
3. **Kontrolgrænse:** Ingen brugerundersøgelse, fysiologisk validering af pilotcases eller ændring af den offentlige onboarding. Skitsekurver har ingen glukoseakse og må ikke bruges som fysiologisk undervisningsresultat. Grafens billedbeskrivelse er derfor også mærket som illustration.
4. **Arkiv:** Read-only arkivtjek fandt 173 eksisterende læsekopier, én udestående Mergenthaler-artikel og ingen blokerede filer. Den udestående artikel er ikke anvendt her. Relevante Andersen- og Shute-originaler findes allerede i knowledgebasens private artikelarkiv. Konverteringsadvarsler om tabeller/tekstoverlap er inspiceret; ingen tabeller eller effektstørrelser er genberegnet eller brugt i dette oplæg.
5. **Kilder og dækning:** Relevante afsnit i de to rapporter fra 20. oktober, original Gemini-rapports brødtekst, knowledgebasens lærings-, onboarding- og evalueringsafsnit samt de nævnte kodeindgange er læst. Hele knowledgebasen, alle refererede primærstudier og alle simulatorens startveje er ikke genvurderet.

## 10. Lokale kilder og indgange til næste implementation

1. [Samlet Codex–Gemini-rapport, 20. oktober](2026-10-20_codex-gemini_engagement-onboarding.md), især afsnit 3–7 og 11–12.
2. [Første Codex-rapport, 20. oktober](2026-10-20_codex_engagement-onboarding.md), især afsnit 2, 4–7.
3. Knowledgebase: `knowledge/design/learning-science.qmd`, afsnittet **Application to causal-learning simulations** (linje 103); `knowledge/human-factors/onboarding-and-accessibility.qmd`, **Remove barriers without removing the learning task** (linje 7) og **Implications for a first-session study** (linje 88); `knowledge/design/evaluation.qmd`, **Comparators determine the causal question** og **Independent capability, measurement validity and time**.
4. [Produktets tilsigtede formål](../INTENDED-PURPOSE.md), herunder faste karakterer og begrænset Hvad Nu Hvis.
5. [levels.js](../../js/levels.js#L98): caseindhold; [main.js](../../js/main.js#L1338): startkontrol og karaktergenvej; [campaign.js](../../js/campaign.js#L260): baneintro; [ui.js](../../js/ui.js#L3378): formålsinformation; [editor.js](../../js/editor.js#L46): eksisterende sammenligning. Linjerne er indgange, som kan flytte sig ved dagens øvrige rettelser.

**Samlet status:** Lokal skitse og beslutningsoplæg færdige. Retning A anbefales. P1–P3 er fortsat åbne implementeringsforslag; offentlig onboarding og banefysiologi er ikke ændret af denne delopgave.
