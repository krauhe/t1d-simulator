# Vidensrapport: Færre klik og stærkere engagement i diabetes-simulatoren

Dato: 2026-08-05

## Scope og kildenote

Denne rapport undersøger, hvordan ==type 1 diabetes (T1D)== Simulator kan få spillere hurtigere fra side-load til meningsfuldt gameplay og samtidig blive mere engagerende, forståelig og tryg. Rapporten kombinerer tre spor: et read-only kodeaudit af det aktuelle desktop-flow, forskning i software- og spildesign samt forskning i motivation, læring, sundhedskommunikation og etisk design for børn og nydiagnosticerede voksne.

Kodeauditten er udført på den lokale working tree den 5. august 2026. Den indeholder allerede brugerændringer, og nogle fund kan derfor afvige fra seneste offentlige version. Klikforløbene er udledt af kode; de er ikke observeret i browser eller valideret på mobil. Forskningslitteraturen dokumenterer ikke et universelt optimalt antal klik. Konkrete mål som "3 klik for en ny spiller" er derfor designhypoteser, som skal testes.

## Samlet konklusion

Den største mulighed er ikke at gøre spillet overfladisk enklere. Den er at lade spilleren lære ved at spille tidligere.

Den anbefalede retning er:

1. Giv nye spillere én tydelig, anbefalet vej direkte til bane 1 med en synlig standardkarakter.
2. Giv tilbagevendende spillere en adaptiv `Fortsæt bane N`-vej, der bruger gemt progression.
3. Flyt karaktervalg, banevalg og den fulde intro-tour ud af den hurtigste vej, men behold dem som tydelige, reversible alternativer.
4. Erstat forhåndsforklaring med et kort loop: forudsig, vælg, observer, forklar og prøv igen.
5. Skab engagement gennem autonomi, tidlig kompetence, nysgerrighed og fysiologiske konsekvenser; ikke gennem streaks, kunstig knaphed, skyld eller dramatisk diabetes-framing.
6. Mål tid til første meningsfulde handling og første gennemførte læringsloop, ikke kun klik og sessionstid.

Et realistisk første designmål er højst 3 nødvendige interaktioner fra page-load til kørende Campaign for en ny spiller og 1-2 for en tilbagevendende spiller. Det er ikke en forskningsbaseret tærskel, men en afprøvbar produkthypotese.

## 1. Nuværende startflow

### 1.1 Hvad koden gør nu

1. Appen kalder velkomstskærmen ved hvert load, medmindre spilleren selv har fjernet markeringen `Vis ved opstart` (js/main.js:1372-1378; js/welcome-tour.js:429-442 og 2067-2069).
2. Velkomsten tilbyder en anbefalet intro-tour eller `Start bane 1`; Box Challenge er ikke synlig her (js/welcome-tour.js:491-519).
3. Intro-touren har 21 trin. De planlagte varigheder summerer til 191 sekunder, og spillerteksten beskriver cirka 4 minutter (js/welcome-tour.js:140-360; js/i18n.js:849-853).
4. Når touren slutter, åbnes velkomsten igen i stedet for at starte et spil (js/welcome-tour.js:1891-1904).
5. Velkomstens Campaign-genvej åbner altid et separat karakter-popup og kræver `Gem`, selv om en gyldig standard eller gemt karakter allerede findes (js/main.js:1359-1369; js/ui.js:4509-4602).
6. Første spil kræver både en checkbox og en separat startknap i formåls- og grænseinformationen (js/ui.js:3361-3417).
7. Den normale Start-knap samler karakter og spiltilstand på én skærm, hvilket er et godt eksisterende mønster. Sidst brugte karakter er allerede forvalgt (js/main.js:1380-1387; js/ui.js:3473-3516).
8. Campaign åbner derefter en banevælger, opretter spillet og viser en blokerende baneintro. Simulationen kører først, når spilleren trykker `Start bane` (js/ui.js:3519-3529; js/campaign.js:602-620 og 262-306).
9. Den gemte Campaign-progress indeholder næste aktuelle bane, men velkomstgenvejen starter altid bane 1 (js/campaign-core.js:584-590 og 1503-1507; js/main.js:1359-1367).
10. Det offentlige desktop-register indeholder kun Campaign og Box Challenge. Ældre projektbeskrivelser, som antydede en yderligere offentlig spiltilstand, var forældede og er blevet rettet (js/game.js:137-149 og 162-166).

### 1.2 Minimumsforløb til kørende gameplay

Tallene antager, at spilleren accepterer den forvalgte karakter. Et karaktersskift koster mindst ét ekstra klik.

1. Ny spiller, Campaign via velkomstgenvej: 5 interaktioner.
   - Start bane 1.
   - Gem karakter.
   - Markér checkbox.
   - Start fra disclaimer.
   - Start bane.
2. Ny spiller, Campaign via normal Start: 7 interaktioner.
   - Luk velkomst.
   - Start.
   - Campaign.
   - Markér checkbox.
   - Start fra disclaimer.
   - Vælg bane.
   - Start bane.
3. Ny spiller, Box Challenge: 5 interaktioner.
4. Tilbagevendende spiller med velkomst aktiv, Campaign via normal Start: 5 interaktioner.
5. Tilbagevendende spiller med velkomst fravalgt, Campaign: 4 interaktioner.
6. Tilbagevendende spiller med velkomst fravalgt, Box Challenge: 2 interaktioner.
7. Interne udviklings- og testveje er ikke offentlige spiltilstande.

Det mest belastende er ikke hvert enkelt klik. Det er, at spilleren skal forstå flere valg og skærme, før spillet har demonstreret sin værdi.

### 1.3 Positive mønstre, der bør bevares

1. Mode og karakter er allerede samlet i normalflowet.
2. Sidst brugte karakter er allerede forvalgt.
3. Campaign kan låse værktøjer op gradvist.
4. Campaign-info-knappen kan genåbne objectives og forklaring under spillet.
5. Der findes allerede velkomstkort, modekort, karakterkort, banekort og fælles popup-/primærknap-styling, som kan genbruges (style.css:2701-2787, 2889-2983, 4975-5047, 5691-5725 og 6984-7043).

## 2. Hvad forskningen siger

### 2.1 Første meningsfulde handling er vigtigere end en lang forhåndstour

Et stort feltstudie med over 45.000 spillere testede otte tutorialdesigns. Tutorials forbedrede engagement og fremdrift i det komplekse Foldit, men ikke i to enklere spil. I Foldit gav kontekstnære instruktioner 16 % mere spilletid og 40 % mere fremskridt end instruktioner uden for kontekst; blokerende tutorials gav ingen generel fordel ([Andersen et al., 2012](https://doi.org/10.1145/2207676.2207687)).

Det direkte forskningsresultat er ikke "fjern alle tutorials". Det er, at behovet afhænger af kompleksiteten, og at relevant støtte tæt på handlingen kan være mere værdifuld end en lang introduktion.

Designinferens for simulatoren: Campaign bane 1 er allerede et gradvist læringsforløb. Den bør være den primære onboarding. Den fulde tour bør være valgfri, genfindelig og opdelt, så en spiller kan lære graf, insulin, mad og aktivitet, når funktionerne bliver relevante.

### 2.2 Reducér beslutningskompleksitet, ikke blindt alle klik

Forskning i choice overload er blandet. En meta-analyse af 63 betingelser fandt næsten nul gennemsnitseffekt, men stor variation ([Scheibehenne et al., 2010](https://doi.org/10.1086/651235)). En senere meta-analyse fandt større risiko for overbelastning, når valgsættet er komplekst, opgaven er svær, og brugeren endnu ikke har klare præferencer ([Chernev et al., 2015](https://doi.org/10.1016/j.jcps.2014.08.002)).

En ny spiller kender endnu ikke forskellen mellem Campaign, Box Challenge, karakterarketyper, levels og avancerede værktøjer. Derfor bør startsiden give en anbefalet vej og gøre alternativer synlige, men sekundære. Et ekstra klik er acceptabelt, hvis det beskytter forståelse eller sikkerhed; et klik, der blot bekræfter en allerede gyldig standard, er en stærk kandidat til at blive fjernet.

### 2.3 Synlige, reversible defaults kan forkorte flowet

En meta-analyse af 58 datasæt med i alt 73.675 deltagere fandt en betydelig gennemsnitlig default-effekt, men også stor variation ([Jachimowicz et al., 2019](https://doi.org/10.1017/bpp.2018.43)). Defaults kan opleves som en anbefaling og skal derfor bruges åbent og ansvarligt.

Designinferens for simulatoren:

1. Brug gemt karakter eller en tydeligt vist standardkarakter.
2. Brug næste anbefalede Campaign-bane som standard for tilbagevendende spillere.
3. Vis valget direkte på startkortet med en mindre `Skift`-handling.
4. Brug aldrig defaults til samtykke, personlige helbredsdata eller behandlingsvalg.

### 2.4 Engagement styrkes af autonomi og kompetence

==Self-Determination Theory (SDT)== beskriver autonomi, kompetence og samhørighed som centrale psykologiske behov. I fire videospilstudier hang især autonomi og kompetence sammen med nydelse, præference og lyst til at spille igen ([Ryan, Rigby & Przybylski, 2006](https://doi.org/10.1007/s11031-006-9051-8)). SDT-baserede sundhedsinterventioner viser små, men robuste adfærdseffekter på tværs af kontekster, hvor autonom motivation og oplevet kompetence er vigtige mekanismer ([Ntoumanis et al., 2021](https://doi.org/10.1080/17437199.2020.1718529); [Sheeran et al., 2020](https://doi.org/10.1037/ccp0000501)).

Designinferens for simulatoren:

1. Autonomi: tilbyd `Lad mig prøve`, `Vis mig` og `Forklar mere`.
2. Kompetence: lad den første udfordring kunne løses uden kendskab til hele brugergrænsefladen.
3. Samhørighed: brug de faste karakterer og konkrete hverdagssituationer som motivation, ikke som en lang adgangsbarriere.
4. Kontrol: gør pause, genstart, hjælp og afslutning tydelige og uden straf.

### 2.5 Feedback skal forklare årsag, virkning og næste forsøg

Formativ feedback er mest nyttig, når den er specifik, opgaveorienteret, støttende og leveret i håndterbare mængder. Ren resultatmarkering er mindre læringsrig end feedback, der forklarer responsen eller misforståelsen ([Shute, 2008](https://doi.org/10.3102/0034654307313795); [Hattie & Timperley, 2007](https://doi.org/10.3102/003465430298487)). Scaffolding i digitale læringsspil har en moderat gennemsnitlig effekt på læring, men med betydelig heterogenitet ([Cai et al., 2022](https://doi.org/10.1007/s10648-021-09655-0)).

Et anbefalet loop i simulatoren er:

1. Forudsig: Hvad tror du, der sker?
2. Vælg: Gør én fysiologisk meningsfuld handling.
3. Observer: Se graf og status ændre sig.
4. Forklar: Vis én konkret mekanisme.
5. Prøv igen: Skift timing, dosis i spillet eller en anden relevant faktor.

Det loop gør selve simulationen til engagementmekanikken.

### 2.6 Nysgerrighed kan gøre fysiologien spændende

Eksperimentel forskning viser, at høj nysgerrighed kan forbedre både umiddelbar og forsinket hukommelse ([Gruber, Gelman & Ranganath, 2014](https://doi.org/10.1016/j.neuron.2014.08.060)). En nyere meta-analyse fandt en moderat sammenhæng mellem tilstandsnysgerrighed og hukommelse for den information, nysgerrigheden var rettet mod, men studierne var typisk korte laboratorieopgaver ([Radhakrishna & Padakannaya, 2026](https://doi.org/10.3758/s13423-025-02800-8)).

Designinferens: Start en bane med et fysiologisk spørgsmål, ikke kun en instruktion. Eksempler er forsinket pizzaeffekt, aktivitet med insulin on board eller forskel mellem faktisk blodsukker og ==continuous glucose monitoring (CGM)==. Lad spilleren markere en forventning og sammenligne den med det simulerede forløb. Tilbagehold aldrig akut sikkerhedsinformation for at skabe nysgerrighed.

### 2.7 Sværhedsgrad skal ændre støtte, ikke skjult fysiologi

Balance mellem oplevet udfordring og færdighed har en moderat sammenhæng med flow, men klare mål, oplevet kontrol og feedback er også nødvendige ([Fong, Zaleski & Leach, 2015](https://doi.org/10.1080/17439760.2014.967799)).

Designinferens: Skaler sværhed gennem antal samtidige påvirkninger, krav til planlægning, mængde af hints og tempo. Ændr ikke skjult den fysiologiske respons for at gøre banen lettere. En nybegynder kan få mere hjælp til samme model; en erfaren spiller kan få flere samtidige mekanismer og mindre støtte.

### 2.8 Fortælling skal skabe relevans, ikke forsinke spillet

Narrative sundhedsspil kan forbedre adfærd, viden, self-efficacy og nydelse, men effekterne varierer med alder, genre og design ([Zhou et al., 2020](https://doi.org/10.1080/10810730.2019.1701586)). Generelle meta-analyser viser små til moderate læringsgevinster ved digitale spil, men ikke en sikker motivationsfordel i alle sammenligninger ([Clark, Tanner-Smith & Killingsworth, 2016](https://doi.org/10.3102/0034654315582065); [Wouters et al., 2013](https://doi.org/10.1037/a0031311)).

Designinferens: Brug korte hverdagsscenarier som morgenmad, skole, sport, fødselsdag, sygdom eller en nat med sensoralarm. Giv karakteren et konkret hverdagsmål og lad fysiologien skabe konsekvenserne. Undgå lange historieafsnit før første valg.

### 2.9 Point og stjerner er støtte, ikke selve motivationen

Meta-analyser af gamification finder små positive gennemsnitseffekter, men stor variation. I studier af højere metodisk kvalitet er effekter på motivation og adfærd mindre sikre ([Sailer & Homner, 2020](https://doi.org/10.1007/s10648-019-09498-w)). Et sundhedsreview fandt 59 % positive og 41 % blandede eller neutrale resultater blandt 19 studier, overvejende med moderat eller lavere evidenskvalitet ([Johnson et al., 2016](https://doi.org/10.1016/j.invent.2016.10.002)).

Forventede, kontrollerende ydre belønninger kan reducere frivillig interesse, mens informativ positiv feedback kan styrke den ([Deci, Koestner & Ryan, 1999](https://doi.org/10.1037/0033-2909.125.6.627)).

Designinferens: Beløn gode observationer, begrundede valg, nye hypoteser og mestring. Undgå at belønne længst mulig session, dagligt fremmøde eller perfekt glukosekontrol som et moralsk ideal.

### 2.10 T1D-spil har potentiale, men evidensen er begrænset

Et review af ni game-baserede interventioner til børn og unge med T1D fandt lovende resultater for viden, adfærd og engagement, men moderat til lav evidenskvalitet og inkonsistent brug af teori ([Pendergrass & Crawford, 2020](https://doi.org/10.1097/CIN.0000000000000646)). En T1D-specifik scoping review identificerede fortælling, feedback, avatarer, simulationer, mål, levels og sociale interaktioner som hyppige mekanikker, men kunne ikke fastslå den optimale kombination ([Nørlev et al., 2022](https://doi.org/10.1177/19322968211018236)).

ISPAD anbefaler, at diabetesundervisning bevæger sig fra enkelt til komplekst i små trin, er interaktiv, alderssvarende og knyttet til problemløsning ([Lindholm Olinder et al., 2022](https://doi.org/10.1111/pedi.13418)).

Konsekvensen er, at simulatoren bør måles på læring og forståelse, ikke kun engagement. Der bør ikke loves kliniske resultater eller bedre virkelig glukosekontrol på baggrund af spilbrug.

### 2.11 Tone og psykisk tryghed er en del af designet

==International Society for Pediatric and Adolescent Diabetes (ISPAD)== anbefaler personcentreret, alderssvarende, respektfuld og autonomistøttende kommunikation samt realistiske glukoseforventninger ([de Wit et al., 2022](https://doi.org/10.1111/pedi.13428)). Diabetes-sprog bør være neutralt, faktabaseret, styrkebaseret, respektfuldt, håbefuldt og personcentreret ([Dickinson et al., 2017](https://doi.org/10.2337/dci17-0041)).

Designinferens:

1. Beskriv handlingen og fysiologien, ikke spillerens moral eller identitet.
2. Gør fejl til data og mulighed for et nyt forsøg.
3. Forklar lavt blodsukker og ==diabetic ketoacidosis (DKA)== ærligt og handlingsorienteret, men brug dem ikke som dramatisk retentionmekanik.
4. Bevar tydeligt skel mellem den fiktive karakter og spillerens egen behandling.
5. Brug ikke frygt, skyld eller skam som standardmotivation.

### 2.12 Etisk engagement betyder, at det er let at stoppe

==Organisation for Economic Co-operation and Development (OECD)== beskriver dark patterns som praksisser, der udnytter bias og kan medføre økonomisk, privatlivsmæssig eller psykologisk skade; børn er særligt sårbare ([OECD, 2022](https://doi.org/10.1787/44f5e846-en)). EU-Kommissionens retningslinjer for mindreårige fremhæver alderssvarende design og beskyttelse mod manipulerende eller afhængighedsskabende mekanikker ([European Commission, 2025](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors)).

Etiske guardrails for simulatoren:

1. Ingen streak-tab, falsk tidspres, kunstig knaphed eller "bare én bane mere" efter et stopvalg.
2. Ingen loot boxes, tilfældige belønningsodds eller pres for deling.
3. Ingen rangliste, der ligner en vurdering af virkelig diabeteskontrol.
4. Ingen skyldreaktion fra karakteren, når spilleren pauser eller forlader spillet.
5. Ingen skjult sværhedsjustering af fysiologien.
6. Ingen indsamling af virkelige helbredsdata eller fritekst til engagementanalyse.
7. Pause, afslutning, hjælp og genstart skal være synlige og uden straf.

## 3. Anbefalet redesignretning

### 3.1 En adaptiv velkomst med én primær handling

For en ny spiller:

1. Primær: `Start bane 1 - Basalinsulin`.
2. På samme kort: portræt og navn på standardkarakteren samt et mindre `Skift karakter`.
3. Sekundær: `Box Challenge`.
4. Tertiær: `Intro-tour` og `Vælg bane`.

For en tilbagevendende spiller:

1. Primær: `Fortsæt bane N - <titel>` med gemt karakter og progression.
2. Sekundær: `Vælg bane`.
3. Sekundær: `Box Challenge`.
4. Tertiær: `Skift karakter`, `Intro-tour` og andre indstillinger.

Dette genbruger de eksisterende velkomst-, mode-, karakter- og banekort. Det kræver ikke en ny visuel familie.

### 3.2 En kort første-session-vej

Anbefalet designhypotese for ny Campaign-spiller:

1. Tryk `Start bane 1`.
2. Hvis formålsinformationen ikke er accepteret: læs den korte tekst og tryk én tydelig `Jeg forstår - start bane 1`-knap. Fjern kun checkboxen, hvis der ikke findes et konkret dokumenteret krav om separat markering.
3. Vis en komprimeret baneintro med ét mål og `Start`.

Karaktervalg og fuld banevælger er stadig tilgængelige, men ikke obligatoriske. Dermed falder minimum fra 5 til 3 interaktioner via velkomsten. En tilbagevendende spiller kan komme ned på 1-2.

### 3.3 En tour, der supplerer spillet

1. Gør `Start bane 1` til den anbefalede handling i stedet for den fulde tour.
2. Del den 21-trins tour i korte moduler: graf, insulin, mad, aktivitet og avancerede værktøjer.
3. Vis moduler ved første relevante brug og fra Hjælp.
4. Lad tourens sidste trin fortsætte direkte til bane 1 i stedet for at genåbne velkomsten.
5. Brug den eksisterende completed-markør til ikke automatisk at vise samme onboarding igen.

### 3.4 Et mere engagerende første loop

Et muligt første Campaign-loop kan være:

1. Situation: Karakterens første morgen efter diagnosen eller et andet roligt, genkendeligt scenario.
2. Spørgsmål: `Hvad tror du sker frem mod frokost, hvis der ikke gives basalinsulin?`
3. Forudsigelse: Spilleren vælger mellem tre kurveforløb eller markerer retning.
4. Handling: Spilleren vælger mellem to tydelige dosis-/timingmuligheder i spillet.
5. Observation: Grafen kører hurtigt nok til, at konsekvensen bliver synlig.
6. Forklaring: Én konkret sætning om mekanismen og link til mere.
7. Nyt forsøg: `Prøv samme morgen med det andet tidspunkt`.

Den præcise dosis og fysiologiske framing skal reviewes med `phys-reviewer`, før sådan et loop implementeres.

### 3.5 Offentlig mode-afgrænsning

**STATUS: ✅ FIKSET (2026-08-24)**

Den offentlige app tilbyder Campaign og Box Challenge. Interne udviklings- og testveje er ikke produktfunktioner og må ikke beskrives som valgmuligheder for spilleren. Denne afgrænsning skal bevares i startflow, dokumentation og fremtidige reviews.

## 4. Prioriteret handlingsplan

### Høj prioritet: reducer eksisterende friktion

1. Gør velkomstens primære handling adaptiv: bane 1 for nye spillere, næste bane for tilbagevendende.
2. Brug gemt/default-karakter direkte og vis `Skift karakter` som sekundær handling.
3. Stop automatisk genvisning af velkomsten efter afsluttet eller fravalgt tour; behold den i Hjælp.
4. Lad tourens afslutning fortsætte til spillet.
5. Gør Box Challenge synlig som sekundært valg på velkomsten.
6. Forkort baneintroen til titel, ét mål og Start; flyt detaljer til Campaign-info.

### Høj prioritet: ret flowfejl før redesign

1. Flyt Campaigns `attempts`-optælling til det faktiske Start-bane-øjeblik; nu tælles et forsøg allerede ved load af banen (js/campaign-core.js:727-731).
2. Lad Escape og klik-udenfor bruge popupens rigtige cleanup, så Campaign ikke kan efterlades synlig men pauset (js/campaign.js:262-306; js/main.js:2485-2489).
3. Reducér eller skjul den 1,2-1,8 sekunders forsinkelse mellem Start-bane-klikket og kørende simulation (js/campaign.js:299-335).

### Mellem prioritet: gør læringen mere engagerende

1. Indfør forudsig-observer-forklar-prøv-igen i én bane eller én mikroudforing.
2. Giv hjælp i trin og i kontekst.
3. Beløn forklaring, hypotese og mestring frem for kun slutresultat.
4. Brug korte hverdagsmål for karaktererne.
5. Giv spilleren et naturligt afslutningspunkt uden tab eller pres.

### Senere: valider og skalér

1. Test først et klikbart mockup og én ændret startvej.
2. Test derefter en enkelt spilbar første-bane-variant.
3. Udvid først, når både startfriktion, forståelse og tryghed er forbedret.

## 5. Måleplan

### 5.1 Primære mål

1. Tid fra interaktiv side til første fysiologisk meningsfulde handling.
2. Tid til første synlige konsekvens.
3. Andel af landinger, der når en kørende simulation.
4. Andel, der gennemfører første loop: handling, konsekvens og næste valg.
5. Frafald pr. velkomst-, disclaimer-, karakter-, mode-, bane- og introtrin.

### 5.2 Læringsmål

1. Korrekt forudsigelse før handling.
2. Spillerens forklaring af, hvorfor kurven ændrede sig.
3. Transfer til et nyt scenario med andre tal eller en anden karakter.
4. Kort forsinket test, hvis et egentligt studie gennemføres.

### 5.3 Spilleroplevelse

1. Et frivilligt spørgsmål: `Jeg havde lyst til at prøve ét valg mere`.
2. Oplevet kompetence: `Jeg forstod, hvad mit valg gjorde`.
3. Oplevet autonomi: `Jeg kunne selv vælge, hvad jeg ville undersøge`.
4. Hjælpåbninger, tilbageklik, fejl og genstarter.
5. Tilbagevendende spilleres tid til næste handling.

==Player Experience Inventory (PXI)== kan bruges som forskningsinspiration til mastery, autonomi, nysgerrighed, mening og brugervenlighed, men en oversat børneversion må ikke kaldes valideret uden reel validering ([Vanden Abeele et al., 2020](https://doi.org/10.1016/j.ijhcs.2019.102370)).

### 5.4 Sikkerheds- og etikmål

1. Forstår spilleren, at resultatet gælder en fiktiv karakter?
2. Forstår spilleren, at spillet ikke giver personlig behandlingsvejledning?
3. Udløser tekst eller mekanik unødig uro, skyld eller skam?
4. Kan spilleren let pause og stoppe?
5. Er hjælp og forklaring tilgængelig uden straf?
6. Er fysiologien uændret mellem sværhedsgrader?

### 5.5 Analytics

Koden registrerer aktuelt spilstart pr. mode/level i GoatCounter, men ikke den fulde startfunnel (js/game.js:228-245). En mulig anonym eventrække er:

1. Landing klar.
2. Primær start trykket.
3. Starttrin vist.
4. Spil startet.
5. Første handling.
6. Første feedback.
7. Første loop gennemført.
8. Hjælp åbnet.
9. Session afsluttet.

Log kun hændelsestype, anonym variant, mode, sprog og enhedstype. Log ikke simulerede blodsukkerværdier, virkelige helbredsdata, navne eller fritekst.

## 6. Teststrategi

1. Begynd med modererede tests af nuværende flow og en simpel prototype. 5-8 personer pr. vigtig målgruppe er nyttigt til problemfinding, men giver ikke statistisk dokumentation.
2. Adskil børn, teenagere, nydiagnosticerede voksne, erfarne voksne og forældre. De har forskellige forudsætninger.
3. Test først med voksne og fageksperter. Test med børn kræver alderssvarende information, barnets assent, forældres samtykke, dataminimering og klare stopkriterier.
4. Når trafikken er stor nok, kør en ==A/B-test== mellem nuværende flow og en ekspresstart med reversible defaults og kontekstuel hjælp.
5. Vælg på forhånd ét primært produktmål, ét læringsmål og sikkerheds-guardrails. Stop ikke tidligt ved et tilfældigt lovende resultat.
6. En variant vinder kun, hvis den reducerer friktion uden at forringe forståelse, frivillighed eller sikkerhedsbudskaber.

## 7. Begrænsninger

1. Der er ikke udført browser- eller mobiltest i denne rapport.
2. Kliktal er udledt af desktop-koden og kan påvirkes af localStorage, privat browsing og fysiologi-visning.
3. Ingen studie fastslår det optimale antal klik for T1D Simulator.
4. Mange spil- og gamificationstudier bruger korte forløb, små samples eller selvrapporteret motivation.
5. T1D-spil til børn er et lille og heterogent forskningsfelt.
6. Viden, self-efficacy, faktisk adfærd og klinisk glukosekontrol er forskellige udfald og må ikke blandes sammen.
7. Anbefalingerne om adaptiv velkomst, hurtigstart og mikroudforing er designinferenser, der kræver test.
8. Den offentlige mode-afgrænsning er fastlagt til Campaign og Box Challenge.

## 8. Anbefalet næste beslutning

Det bedste næste skridt er et lille designarbejde, ikke en stor implementering:

1. Lav to HTML-mockups i projektets eksisterende visuelle sprog:
   - Adaptiv velkomst for ny spiller.
   - Adaptiv `Fortsæt`-velkomst for tilbagevendende spiller.
2. Gennemgå mockups med 5-8 førstegangstestere og mål tid til valgt startvej, forståelse og oplevet pres.
3. Implementér derefter kun den vindende startvej og ret de tre flowfejl.
4. Brug en separat, godkendt opgave til det nye forudsig-observer-forklar-loop, fordi det kræver både game-design- og fysiologisk review.

<!-- pagebreak -->

## Referencer

1. [Andersen, E. et al. (2012), "The Impact of Tutorials on Games of Varying Complexity", CHI '12, pp. 59-68.](https://doi.org/10.1145/2207676.2207687)
2. [Cai, Z. et al. (2022), "Effects of Scaffolding in Digital Game-Based Learning on Student's Achievement", Educational Psychology Review, 34, pp. 537-574.](https://doi.org/10.1007/s10648-021-09655-0)
3. [Chernev, A., Böckenholt, U. and Goodman, J. (2015), "Choice Overload: A Conceptual Review and Meta-analysis", Journal of Consumer Psychology, 25(2), pp. 333-358.](https://doi.org/10.1016/j.jcps.2014.08.002)
4. [Clark, D.B., Tanner-Smith, E.E. and Killingsworth, S.S. (2016), "Digital Games, Design, and Learning: A Systematic Review and Meta-Analysis", Review of Educational Research, 86(1), pp. 79-122.](https://doi.org/10.3102/0034654315582065)
5. [Deci, E.L., Koestner, R. and Ryan, R.M. (1999), "A Meta-Analytic Review of Experiments Examining the Effects of Extrinsic Rewards on Intrinsic Motivation", Psychological Bulletin, 125(6), pp. 627-668.](https://doi.org/10.1037/0033-2909.125.6.627)
6. [de Wit, M. et al. (2022), "ISPAD Clinical Practice Consensus Guidelines 2022: Psychological Care of Children, Adolescents and Young Adults with Diabetes", Pediatric Diabetes, 23(8), pp. 1373-1389.](https://doi.org/10.1111/pedi.13428)
7. [Dickinson, J.K. et al. (2017), "The Use of Language in Diabetes Care and Education", Diabetes Care, 40, pp. 1790-1799.](https://doi.org/10.2337/dci17-0041)
8. [European Commission (2025), "Guidelines on the Protection of Minors".](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors)
9. [Fong, C.J., Zaleski, D.J. and Leach, J.K. (2015), "The Challenge-Skill Balance and Antecedents of Flow", Journal of Positive Psychology, 10(5), pp. 425-446.](https://doi.org/10.1080/17439760.2014.967799)
10. [Gruber, M.J., Gelman, B.D. and Ranganath, C. (2014), "States of Curiosity Modulate Hippocampus-Dependent Learning", Neuron, 84(2), pp. 486-496.](https://doi.org/10.1016/j.neuron.2014.08.060)
11. [Hattie, J. and Timperley, H. (2007), "The Power of Feedback", Review of Educational Research, 77(1), pp. 81-112.](https://doi.org/10.3102/003465430298487)
12. [Jachimowicz, J.M. et al. (2019), "When and Why Defaults Influence Decisions", Behavioural Public Policy, 3(2), pp. 159-186.](https://doi.org/10.1017/bpp.2018.43)
13. [Johnson, D. et al. (2016), "Gamification for Health and Wellbeing", Internet Interventions, 6, pp. 89-106.](https://doi.org/10.1016/j.invent.2016.10.002)
14. [Lindholm Olinder, A. et al. (2022), "ISPAD Clinical Practice Consensus Guidelines 2022: Diabetes Education in Children and Adolescents", Pediatric Diabetes, 23(8), pp. 1229-1242.](https://doi.org/10.1111/pedi.13418)
15. [Nørlev, J. et al. (2022), "Game Mechanisms in Serious Games That Teach Children with Type 1 Diabetes How to Self-Manage", Journal of Diabetes Science and Technology, 16(5), pp. 1253-1269.](https://doi.org/10.1177/19322968211018236)
16. [Ntoumanis, N. et al. (2021), "A Meta-analysis of Self-determination Theory-informed Intervention Studies in the Health Domain", Health Psychology Review, 15(2), pp. 214-244.](https://doi.org/10.1080/17437199.2020.1718529)
17. [OECD (2022), "Dark Commercial Patterns", OECD Digital Economy Papers, 336.](https://doi.org/10.1787/44f5e846-en)
18. [Pendergrass, T.M. and Crawford, S. (2020), "Type I Diabetes Self-management With Game-Based Interventions for Pediatric and Adolescent Patients", Computers, Informatics, Nursing, 38(7), pp. 333-341.](https://doi.org/10.1097/CIN.0000000000000646)
19. [Radhakrishna, P. and Padakannaya, P. (2026), "Mnemonic Benefits of State Curiosity - A Meta-analysis", Psychonomic Bulletin & Review, 33(3), article 97.](https://doi.org/10.3758/s13423-025-02800-8)
20. [Ryan, R.M., Rigby, C.S. and Przybylski, A.K. (2006), "The Motivational Pull of Video Games", Motivation and Emotion, 30, pp. 344-360.](https://doi.org/10.1007/s11031-006-9051-8)
21. [Sailer, M. and Homner, L. (2020), "The Gamification of Learning: A Meta-analysis", Educational Psychology Review, 32, pp. 77-112.](https://doi.org/10.1007/s10648-019-09498-w)
22. [Scheibehenne, B., Greifeneder, R. and Todd, P.M. (2010), "Can There Ever Be Too Many Options?", Journal of Consumer Research, 37(3), pp. 409-425.](https://doi.org/10.1086/651235)
23. [Sheeran, P. et al. (2020), "Self-determination Theory Interventions for Health Behavior Change", Journal of Consulting and Clinical Psychology, 88(8), pp. 726-737.](https://doi.org/10.1037/ccp0000501)
24. [Shute, V.J. (2008), "Focus on Formative Feedback", Review of Educational Research, 78(1), pp. 153-189.](https://doi.org/10.3102/0034654307313795)
25. [Vanden Abeele, V. et al. (2020), "Development and Validation of the Player Experience Inventory", International Journal of Human-Computer Studies, 135, 102370.](https://doi.org/10.1016/j.ijhcs.2019.102370)
26. [Wouters, P. et al. (2013), "A Meta-analysis of the Cognitive and Motivational Effects of Serious Games", Journal of Educational Psychology, 105(2), pp. 249-265.](https://doi.org/10.1037/a0031311)
27. [Zhou, C. et al. (2020), "A Meta-analysis of Narrative Game-based Interventions for Promoting Healthy Behaviors", Journal of Health Communication, 25(1), pp. 54-65.](https://doi.org/10.1080/10810730.2019.1701586)

## Forkortelsesordliste

1. A/B-test - Et kontrolleret eksperiment, hvor brugere fordeles mellem to varianter.
2. CGM - Continuous glucose monitoring. En sensorbaseret glukosemåling, der i simulatoren har forsinkelse og støj i forhold til den simulerede blodglukose.
3. DKA - Diabetic ketoacidosis. En akut tilstand med insulinmangel, ketoner og acidose; i spillet skal den forklares præcist uden dramatisk standardframing.
4. ISPAD - International Society for Pediatric and Adolescent Diabetes. Et internationalt fagligt selskab, der udgiver retningslinjer for diabetes hos børn og unge.
5. OECD - Organisation for Economic Co-operation and Development. En international organisation, som blandt andet samler evidens om digitale forbrugerpraksisser.
6. PXI - Player Experience Inventory. Et valideret instrument til flere dimensioner af spilleroplevelsen.
7. SDT - Self-Determination Theory. En motivationsteori om autonomi, kompetence og samhørighed.
8. T1D - Type 1 diabetes. Autoimmun diabetes med behov for tilført insulin.
