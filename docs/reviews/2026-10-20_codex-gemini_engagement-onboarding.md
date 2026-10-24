# T1D Simulator: samlet forslag til engagement, onboarding og læring

Dato: 2026-10-20  
Status: Beslutningsoplæg. Ingen forslag er implementeret.  
Udarbejdet af: Codex med kritisk sammenstilling af Codex- og Argon Gemini-rapporterne.

**Anbefalingen er ét fælles spil med en kort, aktiv indgang, genkendelige fiktive personer og valgfri hjælp og faglig dybde.** Spilleren skal tidligt opleve en interessant sammenhæng og få lyst til at undersøge et andet valg. Detaljerne skal være tilgængelige, når spørgsmålet opstår.

De to rapporter er overvejende forenelige. Gemini tilfører især et tydeligere persongalleri, en metode til at udvikle hverdagscases og en stærkere idé om støtte undervejs. Codex tilfører kortlægning af det eksisterende startflow, uafhængige valg af hjælp og dybde, målbare afprøvninger og mere forsigtige regulatoriske konklusioner.

**En vigtig rettelse til Codex-rapporten:** Spillet har allerede en omfattende desktopfunktion til at undersøge alternative handlinger: **Indsigt → Hvad Nu Hvis**. Forslag A6 i den første rapport overvurderede derfor behovet for ny funktionalitet. Den første prioritet bør være at gøre den eksisterende funktion let at opdage og forstå og kontrollere, at sammenligningerne understøtter den forklaring, spilleren får.

## 1. De seks vigtigste beslutninger

1. **Giv en direkte start med en gyldig standardkarakter.** Vis et kort første forløb som primær indgang. Bevar adgang til rundtur, andre karakterer og øvrige cases. Tilbagevendende spillere skal have en relevant »Fortsæt«-vej.
2. **Brug hjælp, forklaring og casekompleksitet som tre forskellige muligheder.** Undgå at kræve et valg mellem »rookie« og »geek« før start. En person kan have brug for hjælp til knapperne og samtidig ønske en avanceret forklaring.
3. **Gør første læringsforløb kort og aktivt.** Sigt i en prototype mod handling, observation og et nyt valg inden for 2–3 minutter. Dette er et testmål, ikke en forskningsbestemt optimal varighed.
4. **Brug Hvad Nu Hvis som en central læringsaktivitet.** Vis først én ændring og to forståelige kurver. Bevar den fulde analyse som en frivillig mulighed.
5. **Lad spændingen komme fra meningsfulde valg og genkendelige situationer.** Udbyg de eksisterende fiktive personer med korte hverdagsmål. Beløn observation, forståelse og lyst til at prøve igen.
6. **Præcisér den eksisterende disclaimer, og hold produktets funktioner og markedsføring i samme retning.** Fiktive personer og en advarsel er relevante, men er ikke en garanti for en bestemt FDA- eller EU-klassifikation.

## 2. Grundlag og rettelser

### 2.1 De to rapporter

1. [Codex: Forslag til engagement, onboarding og læring i T1D Simulator](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/docs/reviews/2026-10-20_codex_engagement-onboarding.md>), 20. oktober 2026.
2. [Argon Gemini: Strategisk Udvikling af T1D-Simulatoren: Engagement, Onboarding og Regulatorisk Compliance](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/developer input/2026-10-20 gemini Deep Research - Strategisk Udvikling af T1D .docx>), modtaget i `developer input`.

Geminis dokument er læst i sin helhed som tekst, inklusive dets linkhenvisninger. Eksportens henvisninger er Google-omdirigeringer med `chip:`-identifikatorer og sammenløbne referencetal. De giver ikke en brugbar, kontrollerbar litteraturliste. Rapportens idéer behandles derfor som forslag; dens påstande bliver ikke evidens alene ved at være forsynet med et referencetal.

Den samlede vurdering bygger desuden på den aktuelle lokale kode, inklusive eksisterende ikke-committede ændringer, og de kontrollerede forsknings- og myndighedskilder nedenfor. Der er ikke gennemført browserafprøvning, målgruppetest, fysiologisk validering eller juridisk klassifikation som del af sammenstillingen.

### 2.2 Hvad beholdes, tilpasses og fravælges?

| Nr. | Idé | Beslutning | Begrundelse |
|---|---|---|---|
| S1 | Gradvis introduktion af funktioner, foreslået i begge rapporter | **Behold** | Introducér et værktøj, når spilleren har en konkret anledning til at bruge det. |
| S2 | Valgfri støtte, særligt fremhævet af Gemini | **Behold og præcisér** | Støtte til betjening og forståelse skal kunne vælges uden skjult ændring af fysiologien. |
| S3 | Gennemgående personer og en kort »karakterbibel« fra Gemini | **Behold** | Byg videre på de eksisterende seks fiktive personer. Få genkendelige detaljer er nok. |
| S4 | »Tidsmaskine« og sammenligning af valg | **Genbrug det eksisterende** | Hvad Nu Hvis findes allerede. Det udforsker alternativer, mens den oprindelige bane er pauset; alternativerne overføres ikke tilbage til banen. |
| S5 | Avancerede oplysninger låses op med erfaring | **Tilpas** | Hold den første visning enkel, men lad interesserede åbne detaljerne fra begyndelsen. Faglig dybde bør ikke kræve kampagneprogression. |
| S6 | Automatisk basalinsulin | **Kun som tydeligt beskrevet caseopsætning** | En kort case kan have forberedt baggrundsbehandling. Det må ikke fremstå som en universel automatisk doseringsfunktion. |
| S7 | Hjælp, der fjerner fedt/protein, hormoner eller CGM-forsinkelse | **Fravælg som almindelig hjælp** | Det ændrer det, spilleren lærer om. Eventuelle forenklede modeløvelser skal være særskilt mærket og fagligt vurderet. |
| S8 | Øjeblikkelig, perfekt feedback efter insulin | **Skeln mellem handling og virkning** | Bekræft straks, at en handling er registreret. Vis dens simulerede virkning med det korrekte tidsforløb. |
| S9 | Pizzaøvelse med én anbefalet løsning | **Tilpas til sammenligning** | Undersøg konkrete alternativer for en fiktiv person. Undgå at præsentere én strategi som en generel behandlingsregel. |
| S10 | En disclaimer, der juridisk fjerner risikoen | **Fravælg konklusionen** | Klassifikation afhænger af det tilsigtede formål og funktionerne; teksten er kun en del af vurderingen. |
| S11 | Kryptografisk accept, udløbsdato og tvungen onboarding ved alle indgange | **Erstat med enkel, dækkende visning** | Saml de legitime startveje om samme besked. Et lokalt »vist«-flag er ikke juridisk beskyttelse eller bevis på forståelse. |
| S12 | Ombygning til ECS/MVC og offentlig GitHub-produktion af cases | **Udskyd ombygning; behold caseformatet** | Der findes allerede adskilte model-, Campaign- og visningsdele. Et stort arkitekturskifte er ikke en forudsætning for bedre onboarding. |

## 3. Den aktuelle indgang: hvad er problemet?

Den første Codex-rapport kortlagde minimumsinteraktioner til en **kørende simulation, hvor spilleren kan handle**. Optællingen forudsætter standardkarakter, ingen frivillig rundtur og ingen ekstra fysiologiadvarsel. Den er kodebaseret, ikke observeret brugertid.

| Nr. | Indgang | Minimum | Vigtigste friktion |
|---|---|---:|---|
| N1 | Ny desktopspiller, »Start bane 1« fra velkomsten | 5 | Start → gem karakter → checkbox → start → start bane |
| N2 | Ny desktopspiller, Campaign via almindelig Start | 7 | Ekstra vej gennem tilstandsvalg og banevalg |
| N3 | Ny desktopspiller, Box Challenge | 5 | Velkomst, tilstandsvalg og todelt disclaimerbekræftelse |
| N4 | Tilbagevendende desktopspiller via velkomstens genvej | 3 | Genvejen vælger fortsat bane 1 og kræver karakterbekræftelse |
| N5 | Tilbagevendende desktopspiller uden velkomst, Campaign / Box | 4 / 2 | Campaign kræver fortsat flere starttrin |
| N6 | Ny / tilbagevendende mobilspiller, Campaign fra velkomst | 4 / 3 | Separat mobilflow; første start indeholder formålsinformation |

Desuden har den anbefalede rundtur 21 trin. Bane 1 varer tre simulerede døgn og handler om et langsomt basalforløb; stjernerne bygger på tid i målområdet. Det kan være relevant senere, men er en krævende første demonstration af, hvorfor spillet er interessant. [K1–K4]

**Hvert tidligt trin bør enten give et nødvendigt valg eller hjælpe spilleren med den aktuelle opgave.** Bekræftelse af en allerede gyldig karakter og to handlinger om samme disclaimer er oplagte steder at begynde.

## 4. En bred målgruppe uden faste personkategorier

Uddannelsesbaggrund er en mulig forklaringsfaktor, men ikke en sikker indikator for, hvem der får svært ved spillet. Grafvante sundhedsprofessionelle kan være uvante med spil; erfarne personer med T1D kan forstå hverdagsmønstre uden at bruge fagord; en nydiagnosticeret kan ønske meget detaljeret viden.

**Tilpas til behovet i situationen.** Kræv ikke oplysning om diagnose, uddannelse eller erfaring for at vælge den rette indgang.

### 4.1 To mulige løsninger

| Nr. | Løsning | Fordel | Ulempe |
|---|---|---|---|
| M1 | To samlede tilstande: »Guidet« og »Fordybelse« | Let at præsentere | Sammenblander hjælp, viden og udfordring; kan blive to parallelle spil |
| M2 | Fælles spil med uafhængige muligheder | Passer til blandede og skiftende behov | Kræver gode standardvalg, så indstillingerne ikke overvælder |

**M2 anbefales.** Start med korte forklaringer og synlig hjælp. Vis først flere valgmuligheder, når de er relevante.

| Nr. | Mulighed | Spillerens valg | Hvad ændres? |
|---|---|---|---|
| M3 | Hjælp til næste handling | »Vis næste trin« / »Jeg prøver selv« | Fremhævning, demonstration og korte instruktioner |
| M4 | Faglig forklaring | »Kort forklaring« / »Forklar mere« | Begreber, mekanismer og modelbegrænsninger |
| M5 | Casekompleksitet | Én tydelig påvirkning / flere samtidige påvirkninger | Opgavens indhold, tidshorisont og antal beslutninger |

Lad hjælp kunne genaktiveres midt i en svær case. En avanceret bane skal ikke automatisk fjerne støtte. Forklarende tekst bør ikke koste point. Adgang til skjulte modelvariable kan fortsat have særskilte konkurrenceregler, som skal forklares tydeligt.

Giv tal sammen med deres betydning, og brug enheder konsekvent. Forklar forkortelser ved første brug. Lad farve supplere tekst og symboler. Kort tekst, valgfri oplæsning, pause og genfindelig hjælp kan være nyttige på tværs af målgrupper; ingen af delene bør kræve, at man identificerer sig som begynder.

## 5. Første oplevelse: et lille forsøg, der giver lyst til ét mere

Der er to rimelige veje:

1. **Forkort og omarbejd den eksisterende bane 1.** Mindre nyt indhold, men det langsomme basalforløb er fortsat vanskeligt at gøre umiddelbart forståeligt.
2. **Tilføj en kort indledende case og flyt det længere basalforløb senere.** Mere indholdsarbejde, men lettere at afgrænse ét læringsmål og genbruge casen i undervisning.

**Afprøv løsning 2 som prototype først.** Valget af fagligt indhold skal respektere modellens tidsforløb. Man må gerne accelerere simuleret tid og vise det tydeligt.

| Trin | Oplevelse | Formål |
|---|---|---|
| O1 | »Prøv en kort case« med synlig standardkarakter; alternativt »Vælg case« og »Vis mig rundt« | Giver en klar første handling og en vej for erfarne |
| O2 | Den korte formålsinformation og én knap: »Forstået – start« | Afklarer grænsen uden endnu en introduktion |
| O3 | En kort situation med ét spørgsmål, eksempelvis: »Erik skal spise. Se, hvordan kurven udvikler sig i dette forløb.« | Et konkret fokus uden lange forudsætninger |
| O4 | Spilleren udfører én afgrænset handling; den markeres straks i grafen | Viser, at handlingen er registreret |
| O5 | Tiden accelereres synligt eller via »Se forløbet«; spilleren kan pause | Gør konsekvensen synlig uden at forfalske forsinkelser |
| O6 | Ét spørgsmål om observationen og en kort forklaring | Knytter handling og resultat sammen |
| O7 | »Prøv et andet valg« åbner en guidet sammenligning | Giver en meningsfuld grund til at fortsætte |
| O8 | »Næste case«, »Forklar mere« eller »Afslut her« | Giver et naturligt stop og frivillig fordybelse |

En helt ny spiller behøver ikke forudsige et resultat før første demonstration. Efter den første observation kan spillet spørge: »Hvad forventer du, hvis tidspunktet flyttes?« Lad svaret kunne være »Det ved jeg ikke endnu« uden pointtab.

For tilbagevendende spillere bør hovedhandlingen være »Fortsæt« til relevant progression. Hvis et igangværende forsøg ikke faktisk gemmes, må knappen ikke love at genoptage netop det forsøg.

## 6. Hvad Nu Hvis: den største mulighed findes allerede

### 6.1 Hvad den nuværende kode gør

1. **Gemmer den oprindelige bane i pause.** Det eksisterende spilobjekt bevares, mens spilleren undersøger et alternativ. [K5]
2. **Eksporterer karakter, historik, modeltilstand og relevante bundne hændelser.** Funktionen er knyttet til det spillede forløb. [K6]
3. **Lader spilleren ændre handlinger og genberegne kurver.** Der findes også sammenligninger af flere tidspunkter eller værdier for én handling. [K7]
4. **Vender tilbage til den oprindelige bane.** Alternativerne anvendes ikke som ændringer af den oprindelige gennemspilning. Det er derfor mere præcist at kalde funktionen »undersøg et alternativ« end »fortryd din handling«. [K5]

Det er en stærk eksisterende funktion, som begge rapporters idéer kan samles omkring. Der mangler ikke nødvendigvis en ny sammenligningsmotor; der mangler især en enkel undervisningsvej ind i den.

### 6.2 Et forslag til den første sammenligning

1. Tilbyd funktionen lige efter en relevant observation: »Vil du se, hvad et andet tidspunkt ændrer for Erik?«
2. Vis én markeret handling og ét valg, eksempelvis »tidligere / som før / senere«.
3. Vis to tydeligt navngivne kurver: **Samme forløb uden ændringen** og **Forløbet med dit nye valg**.
4. Peg på en konkret forskel og lad spilleren beskrive den. Tilbyd derefter en kort forklaring.
5. Vis »Tilbage til banen« med en kort oplysning om, at banen fortsætter, hvor den blev sat på pause.
6. Tilbyd den fulde analyse via »Undersøg flere muligheder«.

### 6.3 En vigtig faglig præcisering

Insights bruger faste beregningsindstillinger, hvor blandt andet variation mellem insulininjektioner og mellem dages morgenstigning er slået fra. Ved import af en modeltilstand overstyres disse indstillinger, og tilfældighedsgeneratoren nulstilles. Den oprindeligt registrerede kurve kan derfor afvige fra en genberegning, selv uden en ændret spillerhandling. Det er et kodefund, hvis synlige omfang ikke er målt her. [K7]

En undervisningsforklaring må derfor ikke uden videre sige: »Hele forskellen mellem den grå og blå kurve skyldes dit nye valg.« En kontrolleret sammenligning skal bruge:

1. En **uændret genberegning** under de samme sammenligningsindstillinger.
2. En **genberegning med én ændring** under disse samme indstillinger.
3. Eventuelt det **oprindeligt spillede forløb** som særskilt reference, tydeligt navngivet.

Den enkle visning bør begynde med de to første. Kontrollér også, om visningen viser sensorværdi eller modellens glukoseværdi; kildekurven eksporteres her fra modelhistorikken. Flere beregnede alternativer er ikke et statistisk konfidensinterval og bør ikke præsenteres som en sandsynlighedsprognose.

Dette skal først afprøves med en uændret handling og derefter én ændring. Den eksisterende desktopfunktion er undersøgt; tilsvarende funktionalitet på mobil er ikke dokumenteret i denne gennemgang. En mobilprototype bør begynde med den enkle sammenligning, frem for at hele desktopeditoren nødvendigvis overføres.

## 7. Hjælp skal gøre opgaven forståelig

Geminis forslag om moduler for assistance er brugbart, hvis tre forskellige ting holdes adskilt:

| Nr. | Type | Egnet eksempel | Grænse |
|---|---|---|---|
| H1 | Hjælp til betjening og forståelse | Fremhæv næste knap, forklar enheden, tilbyd pause eller demonstration | Ændrer ikke modellens respons |
| H2 | Forberedt undervisningscase | Kort tidsvindue med angivet baggrundsbehandling og få planlagte hændelser | Forudsætningerne skal være synlige og må ikke ligne skjult automatisk problemløsning |
| H3 | Eksperiment med en forenklet model | Sammenligning med en bestemt modelkomponent deaktiveret | Kræver tydelig mærkning, faglig begrundelse og særskilt review |

**Prioritér H1 og afgrænsede H2-cases.** Hvis en begyndercase skal undgå komplekse måltider, kan den vælge en enklere situation. Der er ikke behov for at få en pizza til at opføre sig som flydende glukose.

En »perfekt CGM« er heller ikke blot mere hjælp: den kan ændre, hvad spilleren lærer om måling, forsinkelse og variation. Hvis sand modelglukose vises som forklaring, skal det fremgå, hvad kurven repræsenterer.

Det er heller ikke det samme at dæmpe variation i en kontrolleret sammenligning og at lære spilleren, at variation ikke findes. Den eksisterende Insights-funktion viser netop, hvorfor formålet med en forenkling skal forklares.

## 8. Genkendelige personer og bedre cases

### 8.1 En lille karakterbibel

Geminis idé om en »Lore Bible« kan omsættes til et kort arbejdsdokument for de eksisterende karakterer. Der er ikke behov for en omfattende fiktiv verden.

For hver karakter beskrives:

1. **Faste oplysninger:** Navn, eksisterende karakter-ID og henvisning til den godkendte modelprofil.
2. **Hverdagskontekst:** Et par interesser, rutiner og situationer, som kan vende tilbage.
3. **Typiske spilsituationer:** Eksempelvis måltid, transport, fritidsaktivitet eller en ændret plan.
4. **Fortælletone:** Personen har interesser og mål ud over sin diabetes og kan spørge, observere og lære.
5. **Grænser:** Fortællingens forfatter må ikke frit ændre karakterens fysiologiske parametre eller gøre personen til en kopi af spilleren.

Genkendelse er en designhypotese. Nogle vil foretrække at gå direkte til grafen. Hold derfor historien kort og tilgængelig igen undervejs; den skal ikke være en lang obligatorisk adgangstekst.

### 8.2 En genbrugelig skabelon til nye cases

| Felt | Hvad forfatteren udfylder |
|---|---|
| C1. Situation | Hvad vil den fiktive person gøre, og hvad er ændret i dagens plan? |
| C2. Ét centralt læringsmål | Hvad skal spilleren kunne observere eller forklare bagefter? |
| C3. Forudsætninger | Starttilstand, tidsvindue, baggrundsbehandling og faste hændelser |
| C4. Spillerens valg | Ét eller få valg med meningsfuldt forskellige konsekvenser |
| C5. Støtte | Første hint, demonstration og dybere forklaring |
| C6. Sammenligning | Hvad kan ændres i Hvad Nu Hvis, og hvad holdes ens? |
| C7. Opsamling | Observation, mulig forklaring, begrænsning og næste forsøg |
| C8. Kontrol | Modelreview, tekstkontrol, reproducérbarhed og brugertest efter behov |

Et eksempel er **»Eriks eftermiddag ændrer sig«**: Et forberedt forløb indeholder et måltid og en planlagt aktivitet. Først undersøger spilleren én af påvirkningerne. Senere vises samme situation med ændret tidspunkt. En avanceret variant tilføjer endnu en kendt påvirkning. Alle varianter bruger en fast fiktiv profil; der gives ingen anvisning om spillerens egen dosis.

### 8.3 Pårørende og sundhedsprofessionelle

1. **Spil sammen:** Den ene vælger et alternativ, den anden beskriver forventningen. Byt roller efter observationen. Brug samme skærm; en ny multiplayerfunktion er ikke nødvendig.
2. **Undervisning:** Giv direkte adgang til udvalgte cases med læringsmål, forudsætninger og diskussionsspørgsmål. Undervisere skal ikke spille hele kampagnen for at finde et bestemt emne.
3. **Klinisk refleksion:** Spørg både »Hvad viser modellen?« og »Hvad kan denne simulation ikke afgøre?«. Det støtter faglig diskussion uden at gøre spillet til et behandlingsværktøj.

Geminis idé om at indsamle cases kan senere bruges i en afgrænset proces. Start med lokale udkast og redaktionel gennemgang. En offentlig GitHub-skabelon må bede om **fiktive scenarieidéer**, ikke personlige helbredsdata, CGM-udtræk eller identificerbare patienthistorier. Indhold fra bidragydere kræver fortsat faglig og sproglig kontrol; det er ikke automatisk valideret undervisningsmateriale.

## 9. Engagement og spilteori omsat til konkrete greb

Teori er nyttig til at begrunde et forsøg og vælge målinger. Den dokumenterer ikke på forhånd, at netop denne ændring virker i T1D Simulator.

| Nr. | Inspiration og evidensniveau | Anvendelse | Hvad vi ikke kan konkludere |
|---|---|---|---|
| T1 | **Self-Determination Theory:** forskning i spil knytter oplevelser af kompetence, autonomi og relation til motivation. Nærliggende evidens. | Forståelig feedback, frivillige valg, mulighed for at prøve igen og relevante personer | At alle nydiagnosticerede har samme motivationsbehov, eller at fortælling nødvendigvis virker bedre end grafer |
| T2 | **Kontekstuel introduktion og gradvis støtte:** forskning i tutorials viser, at virkningen afhænger af spillets kompleksitet og introduktionens udformning. Nærliggende evidens. | Lær én handling, når den skal bruges; tilbyd fuld rundtur som alternativ | At tutorials generelt bør fjernes, eller at alle skal gennem samme forløb |
| T3 | **Formativ feedback:** forskningsoversigt om feedback, der hjælper den lærende videre. Nærliggende evidens. | Forklar en observeret forskel, giv et forståeligt næste forsøg, undgå vurdering af personen | At en hurtig pointreaktion er det samme som læring |
| T4 | **MDA: Mechanics, Dynamics, Aesthetics.** Begrebsramme for design. | Vurder, hvordan regler skaber adfærd og oplevelse: giver tre liv nysgerrighed, forsigtighed eller utryghed? | At rammen i sig selv dokumenterer en forbedring |
| T5 | **Flow og passende udfordring.** Her anvendt som designheuristik. | Tilbyd et næste skridt, der kan forstås, og adgang til hjælp eller større kompleksitet | At der findes én perfekt balance, som kan udledes automatisk af fejl eller spiltid |

Kilder til T1–T4: [Ryan, Rigby og Przybylski, 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [Andersen m.fl., 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [Shute, 2008](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf) og [Hunicke, LeBlanc og Zubek, 2004](https://users.cs.northwestern.edu/~hunicke/pubs/MDA.pdf). T5 er ikke brugt som en dokumenteret effektpåstand.

### 9.1 Hvor spændingen kan komme fra

1. **Et tydeligt spørgsmål:** »Hvilket af de to forløb forventer du giver den seneste ændring i kurven?«
2. **Et valg med en forklarlig konsekvens:** Flyt én handling og se forskellen.
3. **En ny situation med kendte værktøjer:** En plan ændres, eller en kendt påvirkning møder en anden.
4. **Synlig mestring:** Vis, hvilke sammenhænge spilleren har undersøgt, og hvad en ny case bygger videre på.
5. **Et naturligt næste forsøg:** Resultatskærmen tilbyder et konkret spørgsmål at udforske, frem for blot »Prøv igen«.

Bevar eventuelt TIR og stjerner som resultater af en simuleret bane, men supplér med læringsfeedback. En høj TIR dokumenterer ikke i sig selv forståelse, og et lavere resultat fortæller ikke, at spilleren er dårlig til at leve med diabetes.

Box Challenge kan være en frivillig udfordring for dem, der ønsker tidspres og konkurrence. Undersøg særskilt, om tre liv opleves som motiverende eller hæmmende. Undgå tabstruede daglige serier, straf for pauser og ranglister, der fremstiller resultater som medicinsk dygtighed.

## 10. Én præcis disclaimer og en sammenhængende produktgrænse

### 10.1 Foreslået dansk tekst

> T1D Simulator er et læringsspil med fiktive personer. Brug ikke spillet til at beregne eller ændre din egen eller andres dosis af insulin eller anden medicin. Spillet giver ikke personlig behandlingsvejledning.

### 10.2 Tilsvarende engelsk tekst

> T1D Simulator is a learning game with fictional people. Do not use the game to calculate or change your own or anyone else’s dose of insulin or other medication. The game does not provide personal treatment advice.

### 10.3 Placering og startflow

1. Erstat eller præcisér teksten i den eksisterende første-start-popup. Brug én bekræftelse: **»Forstået – start«**.
2. Genbrug samme ordlyd under **Hjælp / Om spillet**. Hold »fiktiv karakter« synligt ved personprofilen.
3. Lad alle legitime startveje bruge samme kontrol, også eventuelle fremtidige direkte links til cases.
4. Gem eventuelt, hvilken version af formålsinformationen der er vist. En væsentligt ændret tekst kan vises igen; almindelig tilbagevenden behøver ikke udløse hele onboardingforløbet.
5. Betragt ikke et klik, en kryptografisk markering eller `localStorage` som bevis på forståelse eller juridisk samtykke. Test forståelsen med brugere.

Desktop og mobil har allerede startkontroller for disclaimeren. Det konkrete arbejde er at præcisere teksten, mindske dobbeltbekræftelse og kontrollere dækningen, ikke at indføre en ny routingarkitektur. [K1, K4]

### 10.4 Hvad FDA og EU-kilderne faktisk understøtter

FDA nævner generel patientuddannelse og uddannelsesværktøjer for sundhedsprofessionelle blandt eksempler på softwarefunktioner, som ikke er medicinsk udstyr. Det er relevant for projektets uddannelsesformål, men ikke en konkret afgørelse om T1D Simulator. »Ikke medicinsk udstyr« og »udstyr, hvor FDA udøver enforcement discretion« er forskellige kategorier. [FDA: eksempler](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices), [FDA: overordnet politik](https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications).

EU's MDCG 2019-11 rev. 1 beskriver kvalifikation og klassifikation af software under MDR/IVDR. Det tilsigtede formål omfatter producentens oplysninger, herunder markedsføring, og skal vurderes sammen med funktionerne. Regel 11 bliver relevant, når softwaren først er kvalificeret som medicinsk udstyrssoftware. Vejledningen er ikke i sig selv juridisk bindende. [MDCG 2019-11 rev. 1, juni 2025](https://health.ec.europa.eu/system/files/2025-06/mdcg_2019_11_en.pdf).

**Praktisk designkonsekvens:** Bevar faste fiktive profiler og et tydeligt læringsformål. Undgå indtastning af virkelige patientdata, personlige doseringsanbefalinger, profiltilpasning til brugerens egen behandling og markedsføring som behandlingsstøtte. At sundhedsprofessionelle er en målgruppe gør ikke alene et undervisningsspil til et behandlingsværktøj.

Geminis garanti om juridisk beskyttelse fravælges. Disclaimeren er en konkret kommunikationsforbedring; den samlede klassifikation kan ikke fastslås ud fra teksten alene.

## 11. Prioritering og mindste relevante afprøvning

Størrelserne er relative vurderinger af arbejdet, ikke tidsestimater. Alle effekter nedenfor er designhypoteser.

| ID | Prioritet / størrelse | Ændring og forventet virkning | Mindste test | Hvad skal samtidig beskyttes? |
|---|---|---|---|---|
| P1 | Høj / lille | Præcis disclaimer og én bekræftelse: klar grænse med færre trin | Førstegangsstart på desktop og mobil; forklaring med egne ord | Ingen opfattelse af personlig doseringsvejledning |
| P2 | Høj / mellem | Direkte start og relevant »Fortsæt«: hurtigere adgang | Nyt og tilbagevendende flow, inkl. afbrydelse og tilbagevej | Adgang til karaktervalg, andre cases og hjælp |
| P3 | Høj / mellem | Kort første case: tidlig handling og forståelig konsekvens | Observeret sammenligning med nuværende første oplevelse | Korrekt forståelse af tid og forsinkelser |
| P4 | Høj / mellem, afhængigt af genbrug | Guidet Hvad Nu Hvis: lavere barriere for eksperimenter | Uændret genberegning, ét ændret valg og brugerens forklaring | Sammenlignelige forudsætninger; oprindelig bane gendannes korrekt |
| P5 | Høj / mellem | Uafhængig hjælp og dybde: plads til blandede behov | Find mere forklaring og slå hjælp til/fra midt i en case | Ingen skjulte modelændringer eller tab af adgang |
| P6 | Høj / mellem | Resultat med observation, forklaring og næste forsøg | Ny beslægtet case efter feedback | Ingen udokumenteret enkeltårsag eller personlig præstationsdom |
| P7 | Mellem / lille til mellem | Karakterbibel og 2–3 cases efter samme skabelon | Samme indhold med nye, erfarne og pårørende | Kort fortælling, faste profiler og redaktionel kvalitet |
| P8 | Mellem / lille prototype | Direkte underviseradgang og spil sammen | Én undervisningssession og én pårørende-session | Ingen krav om egne helbredsdata eller kampagnegrind |
| P9 | Lav / større | Nye konkurrencesystemer, omfattende arkitekturskifte og offentlig caseproduktion | Overvej først efter ovenstående afprøvning | Undgå at større kompleksitet kommer før dokumenteret behov |

**Foreslået rækkefølge:** Lav en samlet prototype af P1–P3. Undersøg sideløbende, hvor enkelt P4 kan bygges på den eksisterende funktion. Afprøv første læringsforløb inklusive én sammenligning, før mere indhold produceres. Indarbejd P5–P6 i de komponenter, der allerede anvendes. Udvid derefter med P7–P8.

Teknisk bør arbejdet genbruge karakterkort, introer, info-knapper, grafmarkører og eksisterende popups. `campaign-core.js`, `physiology-engine.js` og `editor.js` giver allerede en del af den adskillelse, Gemini efterlyser. Adskillelse af ansvar er nyttig, men gør ikke indhold eller fysiologi fejlfri.

Før større kodeændringer anbefales et særskilt godkendt commit og push som sikkerhedskopi. Denne rapport bestiller ingen implementering, commit eller publicering.

## 12. Sådan afgør vi, om det faktisk bliver bedre

### 12.1 En lille kvalitativ første runde

Afprøv eksempelvis med 12–16 deltagere med variation i T1D-erfaring, læse- og talfærdigheder samt erfaring med grafer og spil. Medtag nydiagnosticerede, pårørende, erfarne personer med T1D og sundhedsprofessionelle. Det kan finde problemer og udfordre antagelser; det kan ikke dokumentere klinisk effekt eller sikre repræsentative undergruppeforskelle.

Børn kræver en særskilt alderssvarende afprøvning og relevant vokseninddragelse. Test både desktop og mobil. Variér rækkefølgen mellem eksisterende og nyt flow, og registrér, hvornår testlederen hjælper.

| Nr. | Måling | Foreløbigt mål eller beslutningsregel |
|---|---|---|
| V1 | Tid til første meningsfulde handling | Sigt mod median under 60 sekunder; medtag hele starten |
| V2 | Adgang til kørende spil | Registrér alle stoptrin, tilbageklik og behov for hjælp |
| V3 | Første læringsforløb | Sigt mod handling, observation og nyt valg på 2–3 minutter |
| V4 | Forståelse | Lad deltageren forklare en forventning i en ny, beslægtet case |
| V5 | Hvad Nu Hvis | Kan deltageren forklare, hvad der blev ændret, og at den oprindelige bane er bevaret? |
| V6 | Grænse til behandling | Kan alle forklare, at spillets doser og resultater ikke bruges til virkelig medicindosering? Undersøg enhver misforståelse |
| V7 | Hjælp og dybde | Kan både nye og erfarne finde passende hjælp uden at begynde forfra? |
| V8 | Motivation | Spørg til oplevet kontrol, forståelse og lyst til ét forsøg mere; brug ikke sessionstid alene |
| V9 | Tilbagevenden | Mål adgang til relevant næste case særskilt fra første start |
| V10 | Inklusion og fastholdt forståelse | Gennemgå fund efter behov og enhed; lav senere en kort test med en ny case |

Brug først observerede sessioner og få nødvendige noter. Permanent analytics er ikke en forudsætning. Indsaml ikke patientdata eller fritekst om egen behandling for at måle onboarding.

Stop og revidér en prototype, hvis hurtigere start giver dårligere forståelse, hvis hjælp føles stigmatiserende, hvis karakteren opfattes som en model af brugeren, eller hvis en kurveforklaring tillægger én ændring en effekt, sammenligningen ikke kan understøtte.

## 13. Kodehenvisninger og kontrolstatus

Linjerne angiver indgange til de gennemgåede funktioner i den lokale version. Senere ændringer kan flytte dem.

| ID | Sted | Hvad henvisningen understøtter |
|---|---|---|
| K1 | [main.js:1338](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/main.js:1338>), [ui.js:3378](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/ui.js:3378>) | Startkontrol, velkomstgenvej og disclaimerbekræftelse |
| K2 | [welcome-tour.js:479](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/welcome-tour.js:479>) | Velkomst og adgang til rundtur; tourdefinitionerne findes i samme fil |
| K3 | [levels.js:97](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/levels.js:97>), [campaign.js:260](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/campaign.js:260>) | Første banes opsætning og desktopintro |
| K4 | [mobile.js:1175](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/mobile/mobile.js:1175>), [mobile.js:1807](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/mobile/mobile.js:1807>) | Separat mobilstart og baneintro |
| K5 | [game.js:429](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:429>), [game.js:457](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:457>), [game.js:526](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:526>) | Pause, tilbagevenden og åbning af Hvad Nu Hvis |
| K6 | [simulator.js:2104](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/simulator.js:2104>) | Adgangsbetingelse og eksport af det spillede forløb |
| K7 | [editor.js:46](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/editor.js:46>), [editor.js:128](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/editor.js:128>), [editor.js:199](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/editor.js:199>), [editor.js:396](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/editor.js:396>) | Faste indstillinger, sammenligning af alternativer, import og genberegning |
| K8 | [main.js:1493](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/main.js:1493>), [i18n.js:377](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/i18n.js:377>) | Indsigt-menu og forklaring af Hvad Nu Hvis |
| K9 | [archetypes.js:1](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/archetypes.js:1>), [campaign-core.js:1](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/campaign-core.js:1>), [physiology-engine.js:3715](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/physiology-engine.js:3715>) | Faste karakterprofiler, fælles Campaign-logik og modeltilstand |

1. **Kildekontrol:** De syv eksterne kildelinks er kontrolleret fra brugerens pc for HTTP-status, endelig destination og dokumentidentitet. Forskningskilderne understøtter generelle principper; ingen dokumenterer effekten af de konkrete forslag i dette spil.
2. **Regulatorisk afgrænsning:** FDA- og EU-vejledningerne anvendes til at korrigere for bastante udsagn, ikke til at udstede en klassifikation.
3. **Teknisk begrænsning:** Startflows og Insights er vurderet ud fra kode. Den observerbare forskel mellem oprindelig og uændret genberegnet kurve skal måles før ændring af forklaringer.
4. **Dokumentstatus:** Dette dokument er det samlede beslutningsgrundlag og korrigerer især A6 i den første Codex-rapport. Begge originalrapporter bevares som kildemateriale.
5. **Implementeringsstatus:** P1–P9 er åbne forslag. Ingen spilfunktioner, modelparametre, lydfiler eller publicerede versioner er ændret i denne opgave.
