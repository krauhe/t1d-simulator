# Evidensprincipper for T1D Simulatorens spilleroplevelse

## Indhold

1. Evidensniveauer
2. Onboarding og klikfriktion
3. Motivation og engagement
4. Læring og feedback
5. T1D, børn og etisk design
6. Målinger
7. Centrale kilder

## 1. Evidensniveauer

1. Direkte evidens: studier af spil, tutorials eller T1D-læringsspil med relevante deltagere og udfald.
2. Nærliggende evidens: lærings-, motivations- eller HCI-forskning fra beslægtede kontekster.
3. Industri-praksis: authoritative platformguides. Brug som heuristik, ikke som kausal dokumentation.
4. Designinferens: projektspecifik hypotese, der skal efterprøves med kodeaudit, brugertest eller eksperiment.

## 2. Onboarding og klikfriktion

### Start med handling, men mål mere end klik

Andersen et al. testede otte tutorialdesigns i tre spil med over 45.000 spillere. Tutorials hjalp det mest komplekse spil, Foldit, men gav ikke samme fordel i to enklere spil. I Foldit gav kontekstnære instruktioner 16 % mere spilletid og 40 % mere fremskridt end instruktioner uden for kontekst. Der var ikke støtte for, at blokerende tutorials generelt forbedrede adfærden.

Designinferens for T1D Simulator: Første handling bør være en sikker, konkret spilsituation. Introducér insulin, mad, aktivitet og avanceret fysiologi, når de bliver relevante. Bevar en genfindelig, valgfri fuld tour.

### Reducér beslutningskompleksitet

Flere valg kan øge reaktionstid, men choice overload er ikke universel. Scheibehenne et al. fandt næsten ingen gennemsnitlig effekt på tværs af 63 betingelser, men stor variation. Chernev et al. fandt, at kompleksitet, svær opgave og usikre præferencer gør overbelastning mere sandsynlig.

Designinferens: Én tydelig primær handling er ofte bedre i startflowet, men et ekstra klik kan være nyttigt, hvis det forhindrer fejl eller gør et nødvendigt valg forståeligt.

### Brug synlige og reversible standardvalg

Jachimowicz et al. fandt en betydelig gennemsnitlig effekt af defaults på valg, men også stor heterogenitet. Defaults kan blive opfattet som en anbefaling.

Designinferens: En standardkarakter og næste anbefalede bane kan skabe hurtigstart, hvis valget vises tydeligt og kan ændres uden tab. Brug ikke defaults til samtykke, personlige helbredsdata eller medicinske valg.

### Skeln mellem nye og tilbagevendende spillere

Dette er primært industri-praksis og designinferens. Nye spillere har brug for orientering; tilbagevendende spillere har brug for `Fortsæt`. En afsluttet eller fravalgt tutorial bør fortsat kunne findes i Hjælp, men ikke blokere hvert besøg.

## 3. Motivation og engagement

### Understøt autonomi, kompetence og relation

==Self-Determination Theory (SDT)== beskriver autonomi, kompetence og relation som centrale psykologiske behov. Ryan et al. fandt i fire studier, at især autonomi og kompetence hang sammen med spilglæde, præference og lyst til fremtidigt spil. Overførsel til T1D Simulator er nærliggende evidens, ikke bevis for en bestemt UI-løsning.

Designinferens:

1. Autonomi: tilbyd reversible valg, valgfri hjælp og mulighed for at eksperimentere.
2. Kompetence: giv en tidlig, opnåelig udfordring og forklar konsekvenser konkret.
3. Relation: brug de fiktive karakterer og genkendelige hverdagssituationer, men undgå lange historieintroer før første handling.

### Beløn læring, ikke loyalitet

Meta-analyser finder gennemsnitlige læringsgevinster ved digitale læringsspil, men store forskelle mellem design. Gamification i sundhed har lovende, men blandet evidens; Johnson et al. fandt 59 % positive og 41 % blandede eller neutrale resultater i 19 studier, oftest med moderat eller lavere evidenskvalitet.

Designinferens: Point, stjerner og progression bør afspejle forståelige observationer, hypoteser og mestring. Undgå tabstruede streaks, kunstig knaphed, gentagne lokkepåmindelser og sessionstid som hovedmål.

### Brug spænding som spørgsmål og konsekvens

Fortælling kan skabe relevans, men forskning giver ikke sikker støtte for, at mere historie automatisk forbedrer læring eller motivation. Brug korte, konkrete situationer med et åbent spørgsmål: Hvad sker der, hvis spilleren ændrer tidspunkt, madtype eller aktivitet? Vis derefter konsekvensen hurtigt.

## 4. Læring og feedback

### Luk et kort feedbackloop

Shutes review viser, at formativ feedback bør være specifik, støttende, målrettet og leveret i håndterbare mængder. Feedback, der kun siger korrekt eller forkert, er mindre læringsrig end feedback, som forklarer den konkrete respons eller misforståelse.

Anbefalet tidligt loop:

1. Ét tydeligt mål.
2. Ét meningsfuldt spiller-valg.
3. En synlig fysiologisk konsekvens.
4. Én konkret forklaring.
5. Et nyt lille mål eller mulighed for at prøve igen.

### Placer information tæt ved anvendelsen

Just-in-time-princippet reducerer behovet for at huske instruktioner fra en lang forhåndstour. Det betyder ikke, at al baggrund skal skjules. Nødvendigt formål, sikkerhed og læringsmål kan vises før handling; procedureinformation bør typisk vises, når handlingen bliver mulig.

### Bevar adgang til dybden

Progressiv afsløring er kun god, hvis den dybere information er tydeligt tilgængelig. Brug spillets eksisterende Campaign-info, Hjælp, spilguide og Indsigt som genfindelige lag. Skjul aldrig information, som er nødvendig for et sikkert eller informeret valg.

## 5. T1D, børn og etisk design

### Brug personcentreret og ikke-dømmende sprog

Dickinson et al. anbefaler diabetes-sprog, der er neutralt, faktabaseret, styrkebaseret, respektfuldt, håbefuldt og personcentreret. ISPAD anbefaler alderssvarende, respektfuld og autonomistøttende kommunikation samt realistiske glukoseforventninger.

Designinferens:

1. Beskriv fysiologi og handlinger, ikke spillerens karakter eller moral.
2. Gør fejl til data og læringsmuligheder.
3. Undgå "dårlig diabetiker", skam, skyld og dramatisk standardframing.
4. Akutte tilstande må forklares præcist, men ikke bruges som retentionmekanik.

### T1D-spil har lovende, men begrænset evidens

Nørlev et al. identificerede narrative kontekster, feedback, avatarer, simulationer, mål, levels og sociale interaktioner i T1D-spil for børn. Den bedste kombination er endnu ikke fastlagt. Brug derfor ikke en tjekliste af game mechanics som garanti for effekt.

### Undgå dark patterns

OECD beskriver dark patterns som digitale praksisser, der udnytter bias og kan medføre økonomisk, privatlivsmæssig eller psykologisk skade. Børn er særligt sårbare. EU's retningslinjer for mindreårige fremhæver alderssvarende design og risici ved manipulerende eller afhængighedsskabende mekanikker.

For T1D Simulator betyder det:

1. Ingen falsk akuthed eller nedtælling, der presser et valg.
2. Ingen tab af streak, points eller adgang for at holde pause.
3. Ingen skjult eller besværlig afslutning.
4. Ingen konkurrerende rangliste, der ligner en vurdering af virkelig diabeteskontrol.
5. Ingen indsamling af helbredsdata eller fritekst til engagementanalyse.
6. Ingen lyd, animation eller karakterreaktion, der skaber skyld for at forlade spillet.

## 6. Målinger

### Primære produktmål

1. Tid til første meningsfulde handling.
2. Tid til første synlige konsekvens.
3. Andel af landinger, der når en kørende simulation.
4. Andel, der gennemfører det første feedbackloop.
5. Setup-frafald pr. trin.

### Læring og oplevelse

1. Kort prædiktion før handling og beslægtet transfer-opgave efter feedback.
2. Frivilligt spørgsmål: "Jeg havde lyst til at prøve ét valg mere."
3. Korte mål for forståelse, kompetence og autonomi.
4. Hjælpåbninger, fejlgenopretning og tilbageklik.

### Guardrails

1. Forståelse af, at simulationen bruger fiktive karakterer og ikke giver personlig behandlingsvejledning.
2. Ingen forringelse af nødvendig sikkerhedsforståelse.
3. Ingen stigning i stress, skyld eller oplevet pres.
4. Ingen forringelse af tastatur-, skærmlæser- eller reduceret-bevægelse-adfærd.

Lang sessionstid er tvetydig og kan skyldes forvirring. Kliktal er diagnostisk, ikke et selvstændigt kvalitetsmål.

## 7. Centrale kilder

1. [Andersen, E. et al. (2012), "The Impact of Tutorials on Games of Varying Complexity", CHI '12.](https://doi.org/10.1145/2207676.2207687)
2. [Cai, Z. et al. (2022), "Effects of Scaffolding in Digital Game-Based Learning on Student's Achievement", Educational Psychology Review, 34.](https://doi.org/10.1007/s10648-021-09655-0)
3. [Chernev, A., Böckenholt, U. and Goodman, J. (2015), "Choice Overload: A Conceptual Review and Meta-analysis", Journal of Consumer Psychology, 25(2).](https://doi.org/10.1016/j.jcps.2014.08.002)
4. [Clark, D.B., Tanner-Smith, E.E. and Killingsworth, S.S. (2016), "Digital Games, Design, and Learning", Review of Educational Research, 86(1).](https://doi.org/10.3102/0034654315582065)
5. [de Wit, M. et al. (2022), "ISPAD Clinical Practice Consensus Guidelines 2022: Psychological care of children, adolescents and young adults with diabetes".](https://doi.org/10.1111/pedi.13428)
6. [Dickinson, J.K. et al. (2017), "The Use of Language in Diabetes Care and Education", Diabetes Care, 40.](https://doi.org/10.2337/dci17-0041)
7. [Jachimowicz, J.M. et al. (2019), "When and Why Defaults Influence Decisions", Behavioural Public Policy, 3(2).](https://doi.org/10.1017/bpp.2018.43)
8. [Johnson, D. et al. (2016), "Gamification for Health and Wellbeing", Internet Interventions, 6.](https://doi.org/10.1016/j.invent.2016.10.002)
9. [Nørlev, J. et al. (2022), "Game Mechanisms in Serious Games That Teach Children with Type 1 Diabetes How to Self-Manage", Journal of Diabetes Science and Technology, 16(5).](https://doi.org/10.1177/19322968211018236)
10. [OECD (2022), "Dark Commercial Patterns", OECD Digital Economy Papers, 336.](https://doi.org/10.1787/44f5e846-en)
11. [Ryan, R.M., Rigby, C.S. and Przybylski, A. (2006), "The Motivational Pull of Video Games", Motivation and Emotion, 30.](https://doi.org/10.1007/s11031-006-9051-8)
12. [Scheibehenne, B., Greifeneder, R. and Todd, P.M. (2010), "Can There Ever Be Too Many Options?", Journal of Consumer Research, 37(3).](https://doi.org/10.1086/651235)
13. [Shute, V.J. (2008), "Focus on Formative Feedback", Review of Educational Research, 78(1).](https://doi.org/10.3102/0034654307313795)
14. [European Commission (2025), "Guidelines on the protection of minors".](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors)
