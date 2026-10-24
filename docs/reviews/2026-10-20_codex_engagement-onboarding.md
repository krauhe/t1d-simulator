# Forslag til engagement, onboarding og læring i T1D Simulator

Dato: 2026-10-20  
Status: Beslutningsoplæg. Forslagene er ikke implementeret.  
Forfatter: Codex

**Min anbefaling er at gøre den første læringsoplevelse kortere og mere aktiv og derefter lade spilleren vælge hjælp, faglig dybde og udfordring hver for sig.** Den detaljerede simulation er en styrke. Den bør blive tilgængelig i takt med spillerens spørgsmål, frem for at hele brugergrænsefladen skal forstås før første interessante oplevelse.

Start med tre ændringer: en direkte startvej, en kort første opgave og en tydelig formulering om fiktive personer og egen medicin. Udbyg derefter muligheden for at gentage et forsøg og sammenligne resultater. Det kan skabe nysgerrighed, meningsfulde valg og oplevelsen af at blive klogere.

## 1. Målgruppen behøver forskellige indgange

Antagelsen om, at nydiagnosticerede uden akademisk baggrund kan have den sværeste indgang, er en god hypotese at undersøge. Den bør ikke blive en fast kategorisering af brugerne. Uddannelse fortæller ikke alene, hvor godt man læser en graf, hvor tryg man er ved diabetes, eller hvor vant man er til computerspil.

En erfaren person med diabetes kan kende hverdagens mønstre uden at kende fagordene. En læge kan kende fysiologien, men være usikker på spillets knapper. En nydiagnosticeret kan have lyst til en detaljeret forklaring fra første dag. Og samme person kan have overskud til fordybelse den ene dag og kun til en kort opgave den næste.

| Nr. | Behov i den aktuelle situation | God indgang | Mulig barriere |
|---|---|---|---|
| 1 | Ny i diabetes og usikker på begreberne | Én konkret situation, synlig hjælp, korte forklaringer | Mange forkortelser, talvalg og vurderinger på én gang |
| 2 | Pårørende, der vil forstå hverdagen | Genkendelige situationer og mulighed for at spille sammen | At skulle kunne beregne doser, før noget giver mening |
| 3 | Erfaren person med T1D | Direkte adgang til interessante scenarier og sammenligninger | Obligatorisk gennemgang af basal viden |
| 4 | Sundhedsprofessionel eller underviser | Cases, tydelige modelantagelser og spørgsmål til diskussion | At skulle gennemføre en lang kampagne for at finde relevant indhold |
| 5 | Nysgerrig spiller med interesse for detaljer | Forklaring af mekanismer, tidsforløb og modellens begrænsninger | At dybden er skjult bag et bestemt niveau eller en identitetslabel |

**Designprincip:** Tilpas støtten til den konkrete opgave. Lad være med at kræve, at spilleren først beskriver sin diagnose, uddannelse eller medicinske erfaring.

## 2. Hvad der allerede fungerer, og hvor starten bliver tung

Vurderingen bygger på den lokale kode den 20. oktober 2026, inklusive eksisterende, ikke-committede ændringer. Den offentlige version kan være anderledes. Flowene er udledt af kode; der er ikke gennemført en browsertest eller en observeret brugertest som del af denne rapport.

Kodehenvisningerne C1–C14 findes i afsnit 11.

### 2.1 Styrker, som forslagene kan bygge videre på

1. **Faste, fiktive karakterer.** Den offentlige profil gemmer karakterens ID og slår modelparametre op fra faste definitioner. Det understøtter læringsformålet og adskillelsen fra personlige behandlingsværktøjer. [C8]
2. **Gradvis introduktion af værktøjer.** Campaign begrænser handlinger og madkategorier i de første baner. Der er allerede et fundament for at lære én ting ad gangen. [C5]
3. **Hjælp i flere lag.** Baneintroen kan genåbnes under spillet og indeholder links til mere information. [C1, C4]
4. **Genkendelige komponenter.** Karakterkort, banekort, info-knapper, paneler og popups kan genbruges. Et redesign behøver ikke et nyt visuelt system. [C2, C4, C7]
5. **Kontekstuelle tips.** De første tips kan pege på en konkret knap og udløses efter en handling. Det er et godt udgangspunkt for aktiv onboarding. [C5]

### 2.2 Nuværende vej til kørende spil

Her betyder »startet«, at simulationen kører, og spilleren kan handle. Et oprettet spil bag en blokerende baneintro tæller ikke som startet.

Tallene forudsætter, at den forvalgte karakter beholdes, og at der ikke er aktiveret en ekstra fysiologivisning med en særskilt advarsel om highscore. Et karaktervalg eller en frivillig tour kommer oveni.

| Nr. | Flow | Minimumsinteraktioner | Trin |
|---|---|---:|---|
| 1 | Ny desktopspiller, genvej fra velkomsten | 5 | Start bane 1 → gem karakter → markér »Forstået« → Start → Start bane |
| 2 | Ny desktopspiller, Campaign via normal Start | 7 | Luk velkomst → Start → Campaign → markér »Forstået« → Start → vælg bane → Start bane |
| 3 | Ny desktopspiller, Box Challenge | 5 | Luk velkomst → Start → Box Challenge → markér »Forstået« → Start |
| 4 | Tilbagevendende desktopspiller, velkomst vist, genvej til bane 1 | 3 | Start bane 1 → gem karakter → Start bane; genvejen vælger stadig bane 1 |
| 5 | Tilbagevendende desktopspiller, velkomst fravalgt, Campaign | 4 | Start → Campaign → vælg bane → Start bane |
| 6 | Tilbagevendende desktopspiller, velkomst fravalgt, Box Challenge | 2 | Start → Box Challenge |
| 7 | Ny mobilspiller, Campaign fra velkomsten | 4 | Campaign → Forstået → vælg bane → Start bane |
| 8 | Tilbagevendende mobilspiller, velkomst vist og information accepteret | 3 | Campaign → vælg bane → Start bane |

Desktopgenvejen gennemløber tre efterfølgende popups: karakter, formålsinformation og baneintro. Normal Campaign-start har desuden en tilstands- og en banevælger. Mobil bruger en separat startflade og har Campaign som offentlig indgang; Box Challenge er ikke koblet på mobilens startflow. Derfor skal onboarding vurderes særskilt på de to flader. [C1–C4, C6–C7]

De relevante valg er karakter, aktivitet/spiltilstand og bane. Bekræftelse af en allerede gyldig standardkarakter er ikke et nyt meningsfuldt valg. Checkbox og Start i samme disclaimer er to handlinger omkring samme budskab.

### 2.3 De vigtigste findings

| ID | Prioritet | Observation | Sandsynlig betydning |
|---|---|---|---|
| F1 | Høj | Desktopvelkomsten anbefaler rundtur før spil. Touren har 21 trin og vender tilbage til velkomsten, når den afsluttes. [C3] | Spilleren kan modtage meget information uden endnu at have prøvet en meningsfuld handling. |
| F2 | Høj | Velkomstgenvejen kræver karakterens »Gem« og starter altid bane 1. [C1] | Unødvendig bekræftelse for nye spillere og en dårlig genvej for tilbagevendende spillere. |
| F3 | Høj | Bane 1 starter kl. 00:00 og varer 4.320 simulerede minutter, altså 3 døgn. Basalprofilens plateau slutter omkring 08:30, og halen omkring 14:30. [C5] | Den første opgave har en langsom mekanisme og et fjernt slutmål. Spilleren skal selv forstå, hvornår tiden bør accelereres. |
| F4 | Høj | Første banes eneste konfigurerede hovedmål er at komme gennem perioden; stjernerne afhænger af tid i målområdet med tærskler på 70, 85 og 95 %. [C5] | En gennemført bane dokumenterer ikke i sig selv, at spilleren har forstået basalinsulin. Et højt resultat kan blive forvekslet med læring. |
| F5 | Høj | Den eksisterende disclaimer beskriver allerede fiktive karakterer og fravær af personlig vejledning. README forbyder desuden brug til virkelig insulindosering. [C9, C12] | Der er brug for en præcisering og ensartet placering; der er ikke behov for en helt ny advarselskæde. |
| F6 | Mellem | Desktopbanen forbliver pauset under introens afsluttende animation; koden bruger 1,2 sekunders bevægelse og en fallback på 1,8 sekunder. Mobil genoptager straks. [C4, C7] | Den samme startkommando reagerer forskelligt. Det bør måles og afprøves, om desktopanimationen føles som ventetid. |
| F7 | Mellem | Fysiologivisning indgår i reglerne for, om en highscore må gemmes. [C10] | En ny »dybde«-indstilling må skelne mellem forklarende tekst og adgang til skjulte simulationstal. Ellers kan ønsket om forklaring opleves som straf. |

Tourens `durationMs`-værdier er fallbacktider, og timeren anvender en faktor på 1,6. Lyd og manuel navigation påvirker varigheden. Rapporten fra august beskrev summen af grundtiderne; den bør ikke læses som en målt varighed af den aktuelle tour. Der er heller ikke målt faktisk ventetid eller frafald i denne gennemgang. [C3, C14]

## 3. Rookie og geek eller en anden opdeling?

Der er to rimelige hovedløsninger:

| Nr. | Løsning | Fordel | Ulempe |
|---|---|---|---|
| 1 | To samlede tilstande, fx »Guidet« og »Fordybelse« | Let at forklare; få indstillinger | Sammenblander viden, hjælp, tempo og lyst til detaljer. Kan føre til to parallelle oplevelser, der skal vedligeholdes. |
| 2 | Fælles spil med uafhængig hjælp, forklaring og casekompleksitet | Passer bedre til skiftende behov; samme indhold kan bruges af flere grupper | Kræver et klart standardvalg, så indstillingerne ikke selv bliver en adgangsbarriere. |

**Jeg anbefaler løsning 2 med en enkel standardopsætning.** »Rookie« og »geek« kan være charmerende interne arbejdstitler, men de siger noget om personen frem for om den hjælp, der tilbydes. »Geek« kan også få faglig dybde til at virke som en nicheklub.

### 3.1 De tre valg

| Nr. | Valg | Eksempel på visning | Hvad det ændrer |
|---|---|---|---|
| 1 | Hjælp undervejs | »Vis næste trin« / »Hjælp, når jeg beder om den« | Fremhævning af knapper, korte instruktioner og tilbud om demonstration |
| 2 | Forklaring | »Kort forklaring« / »Se mekanismen« | Tekstens dybde, begrebsforklaring og adgang til modelantagelser |
| 3 | Udfordring | Case med én påvirkning / case med flere samtidige påvirkninger | Opgavens kompleksitet, ikke personens status eller skjulte modelparametre |

Vis ikke tre indstillingspaneler før start. Start med hjælp slået til og korte forklaringer. Gør »Forklar mere« synlig ved det aktuelle spørgsmål. Lad spilleren vælge en mere kompleks case, når der er en grund til det.

Man skal kunne få meget hjælp til knapperne og samtidig læse en avanceret forklaring. Man skal også kunne spille uden hints og holde forklaringerne korte. Ændringer skal kunne foretages uden at miste forsøget.

### 3.2 Samme hændelse, flere forklaringslag

Et eksempel ved en allerede udført insulinhandling i spillet:

1. **Handling og observation:** »Se, hvordan Eriks kurve ændrer sig over tid.«
2. **Kort forklaring:** »Insulin virker gradvist. Kurven ændrer derfor ikke retning med det samme.«
3. **Mekanisme:** En forklaring af optagelse, forsinket virkning og andre samtidige påvirkninger.
4. **Modelindsigt:** Modellens variable, antagelser og begrænsninger samt relevante kilder.

De sidste to lag kan genbruge spilguide og eksisterende fysiologivisning. Forklarende tekst bør være frit tilgængelig. Visning af eksempelvis modellens skjulte »sande« glukoseværdi kan fortsat have særskilte konkurrenceregler, som forklares før aktivering.

Fysiologien bør ikke blive skjult »nemmere«, når hjælp slås til. Hvis en undervisningscase bevidst fjerner variation eller andre påvirkninger, skal dens forenkling fremgå kort og kunne uddybes.

## 4. En første oplevelse på få minutter

Tiderne nedenfor er **mål til en prototype**, ikke dokumenterede optimale tider eller en måling af det nuværende spil.

### 4.1 Ny spiller

1. **Velkomst med én anbefalet handling.** Et kort viser en fast fiktiv karakter, en konkret situation og knappen »Prøv din første situation«. Karakteren kan ændres, men valget behøver ingen separat gemmeskærm. »Vælg case« og »Se rundturen« er synlige alternativer.
2. **Kort formålsinformation ved første start.** Brug teksten i afsnit 8 og én knap, »Forstået – start«. Den er ikke en test af juridisk samtykke. Bekræftelsen er et interfacevalg; ingen af de gennemgåede myndighedskilder dokumenterer et generelt krav om den nuværende dobbelte checkbox/knap.
3. **En mikrosituation på cirka 2–3 minutter.** Start i en forberedt, afprøvet situation, hvor spilleren kan foretage én handling og se en relevant ændring uden først at planlægge 3 døgn.
4. **Ét resultat og ét nyt valg.** Markér hændelsen på grafen, forklar en observation og tilbyd »Prøv igen« eller »Næste situation«.

Et mål er 2 nødvendige startinteraktioner fra velkomst til den aktive mikrosituation. Det efterfølgende valg i selve opgaven er gameplay, ikke setup.

### 4.2 Konkret prototype: »Eriks frokost«

Karakter, starttilstand og baggrundsinsulin er på forhånd defineret. En afprøvning skal sikre, at den valgte situation faktisk demonstrerer det tilsigtede mønster.

| Trin | Hvad spilleren gør | Hvad spilleren skal opdage |
|---|---|---|
| 1 | Ser Erik, tidspunktet og én sætning om frokost | Det er en fiktiv situation med et afgrænset spørgsmål |
| 2 | Åbner madpanelet med hjælp og vælger det forberedte måltid | En handling kan knyttes til en markør på grafen |
| 3 | Vælger eventuelt en forventning til kurvens udvikling; »Se først« er muligt | Man må være usikker og undersøge et spørgsmål |
| 4 | Bruger en tydelig »Se tiden gå«-handling | Fysiologiske virkninger udfolder sig over simuleret tid |
| 5 | Ser den beregnede kurve og en kort forklaring | Sammenhængen mellem handling, tid og observeret forløb |
| 6 | Prøver den samme situation igen eller går videre | Et forsøg kan gentages uden tab eller en lang genstart |

Første case behøver ikke kræve, at brugeren selv vælger en insulindosis. Målet er først at forstå graf, tid og handling. Senere cases kan introducere insulinvalg for den fiktive karakter.

»Se tiden gå« må ikke blot tegne en på forhånd besluttet kurve. Den skal accelerere eller beregne den samme model og pause ved et defineret observationspunkt. Det skal fremgå, hvor meget simuleret tid der er gået. Hurtig grafbevægelse må ikke give indtryk af øjeblikkelig insulinvirkning.

### 4.3 Bevar basalbanen som en længere opgave

Basalinsulin er et centralt emne, men det lange døgnforløb behøver ikke være spillerens allerførste opgave. Efter mikrosituationen kan en kort basalcase vise én del af sammenhængen. Den eksisterende 3-døgnsbane kan derefter bruges til at afprøve gentagelse og planlægning.

Et billigere alternativ er at ændre bane 1's starttid, mål og delmål. Det giver mindre nyt indhold, men blander introduktion til brugerfladen med læring af en langsom insulinmekanisme. Jeg anbefaler en separat mikrosituation, hvis en lille prototype viser en mærkbar fordel.

### 4.4 Tilbagevendende spiller

Vis »Næste bane: …« eller »Spil bane …« med den sidst valgte karakter. Brug den gemte progression. [C13]

Brug kun ordet »Genoptag«, hvis et igangværende forsøg faktisk kan gendannes med simulationstilstand, tid og handlinger. Den gennemgåede kampagneprogression er ikke dokumentation for en sådan gemmefunktion. At kunne vælge næste bane og at kunne genoptage midt i en bane er to forskellige funktioner.

## 5. Spænding, der samtidig giver læring

### 5.1 P1: Gør hvert forsøg til et tydeligt spørgsmål

En kurve bliver mere interessant, når spilleren har en forventning til den. En case kan eksempelvis undersøge, om to måltider med samme kulhydratmængde giver samme forløb, eller om samme aktivitet giver samme forløb på to forskellige tidspunkter.

Spørgsmålet skal være bundet til en fast, fiktiv case og dens startbetingelser. Brug ikke generelle facitlister, hvor et bestemt måltid eller en bestemt handling altid fremstilles som rigtig.

Forventet mekanisme: nysgerrighed og et konkret observationsmål. Risiko: for mange obligatoriske spørgsmål kan gøre spillet til en quiz. Lad derfor spilleren vælge »Se først«, og brug kun en kort forudsigelse ved centrale læringspunkter.

### 5.2 P2: »Prøv et andet valg« med sammenligning

Efter en case: gentag præcis samme udgangspunkt og ændr én ting, fx tidspunktet for en handling. Vis de to kurver med samme akser og tydelige hændelsesmarkører.

Forventet mekanisme: spilleren kan undersøge en årsag frem for blot at optimere en score. Dette er særligt attraktivt for nysgerrige spillere og fagpersoner, men kan forklares visuelt uden formler.

Risiko: hvis tilfældig variation ændres samtidig, kan forskellen fejlagtigt tilskrives spillerens valg. Sammenligningsfunktionen kræver derfor samme udgangspunkt og samme tilfældighedsforløb, hvor det er relevant. »Samme scenario« skal omfatte aktivt insulin, mad i optagelse, tidligere aktivitet og øvrig modeltilstand.

**Start med genstart af en kort case.** Vilkårlig tilbagespoling i en lang simulation er væsentligt mere omfattende og kræver særskilt design og verifikation.

### 5.3 P3: Giv karakteren et konkret hverdagsmål

Brug en kort situation: frokost før en gåtur, en fødselsdag, en ændret dagsplan eller en morgen med en uventet kurve. Lad spilleren vælge og observere konsekvenserne.

Karakteren kan reagere med en kort observation og et nyt spørgsmål. Undgå reaktioner, der lægger skyld på spilleren eller antyder, at karakteren bliver svigtet, når man holder pause.

Fortællingen skal gøre opgaven forståelig. En længere historie er ikke automatisk mere engagerende. Nye karaktertegninger og meget voice-over bør komme efter test af selve opgaven.

### 5.4 P4: Del de lange baner i forståelige delmål

De eksisterende baner kan have korte afslutninger ved meningsfulde tidspunkter: »Du har nu set morgenforløbet« eller »Sammenlign før og efter aktiviteten«. Vis, hvad næste del undersøger, og giv en naturlig mulighed for at stoppe.

Progression bør efterhånden afspejle emner, spilleren har undersøgt: tidsforsinkelse, måltider, aktivitet og kombinationer. En frivillig ekstra udfordring kan skabe genspilning uden at tvinge alle til samme præstationskrav.

Risiko: markører kan ligne dokumentation for klinisk kompetence. Beskriv dem som gennemførte spilopgaver eller undersøgte fænomener. Et spilresultat er ikke et bevis på, at man kan dosere medicin i virkeligheden.

### 5.5 P5: Lad resultatet forklare noget

Efter en case bør resultatet rumme én konkret observation, en kort forklaring og et forslag til næste forsøg. Point kan stadig vises, men bør ikke være den eneste feedback.

Tid i målområdet kan være relevant at observere. Men 95 % som toppræstation i en forenklet bane må ikke blive fremstillet som et krav til et menneskes virkelige diabetes. Brug ord som »i dette forsøg« og »i denne model« ved resultatfortolkningen.

En forklaring skal have belæg i den faktiske situation. Hvis flere påvirkninger er aktive, bør den ikke udpege én årsag med falsk sikkerhed. En påstand som »den lavere top skyldtes dit tidligere valg« er stærkere, når spillet har beregnet en kontrolleret sammenligning.

### 5.6 P6: Gør sværhed til flere samtidige hensyn

Øg gradvist antallet af påvirkninger, graden af usikkerhed og behovet for planlægning. Varslede ændringer kan senere suppleres med uventede hændelser. Bevar pause og adgang til hjælp.

Box Challenge kan være et frivilligt sted for mere tempo og konkurrence. Det bør være klart, at bokse og liv er spilregler, og at en høj score ikke er et behandlingsmål.

Lav ikke automatisk skjulte ændringer af insulinfølsomhed eller glukoserespons, fordi spilleren klarer sig dårligt. Tilbyd i stedet mere støtte, et nyt forsøg eller en enklere case.

### 5.7 P7: Tilbyd fælles udforskning uden et multiplayerprojekt

To personer kan se samme case og skiftes til at foreslå en forventning og betjene spillet. En pårørende kan hjælpe med at beskrive grafen. En underviser kan stoppe ved et observationspunkt og samle flere bud.

Det kræver i første omgang korte cases og gode diskussionsspørgsmål, ikke konti, chat eller netværkskode. Test først med eksisterende skærmdeling eller én fælles skærm.

## 6. Teorier og forskning som konkret inspiration

Evidensen nedenfor begrunder principper og spørgsmål til designet. Den dokumenterer ikke, at netop de foreslåede ændringer vil virke i T1D Simulator.

| Nr. | Teori eller forskning | Hvad den bidrager med | Konkret anvendelse | Evidensniveau |
|---|---|---|---|---|
| 1 | Self-Determination Theory, SDT | Autonomi, kompetence og relation som motivationsbehov | Reversible valg, opnåelige første opgaver og karakterer med forståelige situationer | Empirisk forskning i videospil; nærliggende evidens for dette spil |
| 2 | MDA: Mechanics, Dynamics, Aesthetics | Forbindelsen mellem regler, det der sker under spil, og spillerens oplevelse | Design en sammenligningsfunktion for at skabe undersøgelse og overraskelse; vurder om den faktisk gør det | Designramme, ikke en effektundersøgelse |
| 3 | Kontekstnær instruktion og gradvis støtte | Instruktioners værdi afhænger af spillets kompleksitet og placering | Vis hjælpen ved den handling, hvor den skal bruges; behold en valgfri oversigt | Direkte evidens om spilintroduktion, overført til T1D Simulator |
| 4 | Formativ feedback | Feedback skal hjælpe spilleren med at forstå og forbedre næste forsøg | En konkret observation, en afgrænset forklaring og mulighed for at prøve igen | Review af læringsforskning; nærliggende evidens |
| 5 | Deltagerbaseret design af et T1D-spil | Målgruppens forhåndsviden kan gøre samme indhold relevant eller for basalt | Afprøv samme prototype med nye og erfarne brugere og tillad direkte adgang til mere krævende cases | Direkte relevant målgruppe, men et lille prototypestudie |

**SDT:** Ryan, Rigby og Przybylski undersøgte motivation i videospil og fandt sammenhænge mellem behovstilfredsstillelse, spilglæde og motivation. Det støtter at undersøge spillerens oplevelse af kontrol og mestring frem for alene at tælle point eller minutter. Det er ikke dokumentation for en bestemt knap eller karakterhistorie. [Ryan et al., 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf).

**MDA:** Hunicke, LeBlanc og Zubek beskriver en måde at arbejde fra konkrete regler til den oplevelse, de skaber. For dette projekt kan en mekanik være »gentag med ét ændret tidspunkt«, dynamikken være sammenligning af forløb, og den ønskede oplevelse være nysgerrighed og forståelse. Dette er vores designanvendelse af rammen. [Hunicke et al., 2004](https://users.cs.northwestern.edu/~hunicke/pubs/MDA.pdf).

**Tutorials:** Andersen og kollegers feltstudie fandt forskellige effekter på tværs af tre spil. Det komplekse Foldit havde gavn af instruktion, især tæt på anvendelsen; de enklere spil viste ikke samme gevinst. Det begrunder ikke at fjerne hjælp fra en kompleks diabetessimulation. Det begrunder at afprøve aktiv, kontekstnær hjælp frem for at antage, at en lang forhåndstour er bedst. [Andersen et al., 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf).

**Feedback:** Shutes review fremhæver specifik, støttende og passende timet feedback og beskriver, at effekten afhænger af både opgaven og den lærende. Derfor anbefales feedback, som forklarer forsøget, med mulighed for mere støtte. En stjerne eller et »forkert« forklarer ikke i sig selv en misforståelse. [Shute, 2008](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf).

**T1D-målgruppen:** Nørlev og kollegers lille, deltagerbaserede prototypestudie viste en positiv modtagelse, men indholdet var for basalt for deltagere med længere erfaring med T1D. Det er en relevant illustration af problemet, ikke en dokumenteret opskrift for alle aldre eller faggrupper. De relevante resultater er kontrolleret i artiklen, som også findes i det private arkiv; forlagets URL kunne ikke verificeres fuldt fra denne pc, som modtog et tomt HTTP 202-svar. [Nørlev et al., 2022 – lokalt link ikke fuldt verificeret](https://games.jmir.org/2022/1/e33955/).

## 7. Inklusion kræver også en læsbar og tilgængelig brugerflade

1. **Begynd med hverdagssprog.** Skriv fx »insulin, der stadig virker« før forkortelsen IOB. Vis fagordet sammen med forklaringen, så spilleren kan lære det.
2. **Lad lyd supplere tekst.** Ingen nødvendig information må kun blive sagt. Spilleren skal kunne stoppe oplæsning, læse i eget tempo og genfinde forklaringen.
3. **Undgå børnesprog som standard.** Konkrete sætninger, billeder og korte opgaver kan fungere for både børn og voksne. Voksne behøver ikke en infantiliserende udgave for at få en enkel indgang.
4. **Forklar grafen gennem handling.** Fremhæv tidspunkt, hændelse og efterfølgende forløb. Et farvet område er ikke tilstrækkelig forklaring alene.
5. **Understøt betjening uden præcision eller hastværk.** Test store trykflader, tastatur, fokusmarkering, tekstforstørrelse, skærmlæser og reduceret bevægelse. Mobilens canvasgraf skal have en brugbar tekstlig opsummering.
6. **Gør pause og afslutning legitime.** Ingen tabstruede streaks, skyld fra karakterer eller nødvendige daglige besøg. En kort gennemført opgave skal opleves som tilstrækkelig.
7. **Åbn relevante cases direkte.** Et bibliotek eller underviserlink kan supplere kampagnens anbefalede rækkefølge. Basal hjælp og faglige forklaringer skal ikke optjenes gennem høj score.

## 8. Én kort disclaimer og en tydelig produktgrænse

### 8.1 Foreslået tekst

**Dansk:**

> T1D Simulator er et læringsspil med fiktive personer. Brug ikke spillet til at beregne eller ændre din egen eller andres dosis af insulin eller anden medicin. Spillet giver ikke personlig behandlingsvejledning.

**Engelsk:**

> T1D Simulator is a learning game with fictional people. Do not use the game to calculate or change your own or anyone else’s dose of insulin or other medication. The game does not provide personal treatment advice.

Det er en præcisering af den eksisterende tekst, ikke en foreslået ekstra popup. Den direkte formulering »Brug ikke …« gør den ønskede grænse tydeligere end alene at beskrive, hvad spillet ikke leverer.

### 8.2 Placering

1. Erstat den eksisterende tekst i »Om simulatoren« ved første spilstart på både desktop og mobil.
2. Brug én bekræftelsesknap. Saml formål, grænse og start på denne skærm.
3. Lad samme tekst kunne genfindes i Hjælp/Om. Brug én fælles tekstkilde, så kopierne ikke driver fra hinanden.
4. Bevar karakterens navn og en diskret identifikation som fiktiv karakter tæt ved spillet. Gentag ikke hele disclaimeren ved hver insulinhandling.

Hvis teksten ændres væsentligt, bør en allerede gemt gammel bekræftelse ikke automatisk betyde, at spilleren har set den nye tekst. En fremtidig implementering bør gemme en tekstversion frem for kun `true`. Det er en produktbeslutning om synlighed, ikke en påstand om et bestemt lovkrav.

### 8.3 Hvad FDA og EU betyder for beslutningen

**En disclaimer kan ikke i sig selv sikre, at software falder uden for reglerne om medicinsk udstyr.** Den skal stemme med funktioner, tilsigtet brug og produktets samlede udsagn.

FDA beskriver generel patientuddannelse og uddannelsesværktøjer til sundhedsprofessionelle som eksempler, der kan være uden for device-definitionen, når de ikke har de angivne individuelle kliniske funktioner. Det understøtter et klart uddannelsesformål; det er ikke en individuel vurdering af dette spil. [FDA: eksempler på software, der ikke er medicinsk udstyr](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices).

EU's MDCG 2019-11 rev.1 beskriver kvalifikation ud fra bl.a. tilsigtet formål og funktion. Definitionen af tilsigtet formål omfatter også oplysninger i markedsføring. Beslutningstrinnet om individuelle patienter og den efterfølgende klassifikation er forskellige spørgsmål: Regel 11 er ikke en automatisk klassifikation af alle sundhedsspil. Først vurderes, om softwaren overhovedet kvalificerer som medicinsk udstyr. Vejledningen er ikke selv en bindende myndighedsafgørelse. [MDCG 2019-11 rev.1, især afsnit 2, 3.3 og 4.2.1](https://health.ec.europa.eu/system/files/2025-06/mdcg_2019_11_en.pdf).

FDA skelner desuden mellem software uden for device-definitionen og devices, hvor myndigheden udøver håndhævelsesmæssig tilbageholdenhed. De to situationer bør ikke omtales som det samme. [FDA: oversigt over softwarepolitikken](https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications).

**Anbefalet produktgrænse for dette projekt:**

1. Bevar faste fiktive personer og forberedte undervisningscases.
2. Undgå indtastning af spillerens egne behandlingsparametre, import af egne CGM-data og outputs beregnet til valg af virkelig dosis.
3. Formulér formålet som at undersøge og forstå generelle sammenhænge. Undgå løfter om at optimere brugerens behandling eller forudsige vedkommendes blodsukker.
4. En avanceret visning til sundhedspersonale skal fortsat handle om undervisningscases. En professionel målgruppe er ikke i sig selv en undtagelse fra reglerne.
5. Vurder nye funktioner særskilt, hvis de bevæger sig mod virkelige patientdata, individuel forudsigelse eller behandlingsbeslutninger. Få da en konkret regulatorisk vurdering før offentlig lancering af den funktion.

Dette er et begrundet designoplæg. Det fastslår ikke, at hele produktet er undtaget fra FDA- eller EU-regler.

## 9. Prioriteret gennemførelsesplan

Forslagene er beslutningspunkter, ikke en bestilling af kodeændringer. »Størrelse« er relativt implementeringsomfang, ikke et tidsestimat.

| Nr. | Prioritet og størrelse | Forslag og forventet virkning | Mindste relevante test | Hvad der samtidig skal beskyttes | Berørte områder |
|---|---|---|---|---|---|
| A1 | Høj / lille | Præcisér den eksisterende disclaimer og saml bekræftelsen; tydeligere grænse med mindre setup | Lad nye brugere forklare formålet med egne ord efter første start | Forståelse af, at spillets doser ikke må bruges til egen eller andres behandling | `i18n`, disclaimer-popup, mobilens overlay, Hjælp [C2, C6, C9, C12] |
| A2 | Høj / mellem | Direkte start med synlig standardkarakter og genvej til næste bane | Gennemfør nyt og tilbagevendende flow på begge flader; mål tid og tilbageklik | Karaktervalg og alternative aktiviteter skal fortsat være lette at finde | Velkomst, startflow, banevalg, gemt progression [C1–C3, C6–C7, C13] |
| A3 | Høj / mellem | Prototype af én kort første case; tidlig handling og synlig konsekvens | Sammenlign med den eksisterende første oplevelse i observerede sessioner | Korrekt tidsforståelse og ingen forventning om øjeblikkelig insulinvirkning | Banedefinitioner, kontekstuelle tips, startflow og tekst [C1, C5, C9] |
| A4 | Høj / mellem | Uafhængig hjælp og faglig forklaring; plads til blandede behov | Lad nye og erfarne brugere slå hjælp til/fra og finde dybde uden at miste forsøget | Fysiologisk modeladfærd og eksisterende highscoreregler må ikke ændres utilsigtet | Info-knapper, guide, indstillinger og fysiologivisning [C4, C9–C10] |
| A5 | Høj / mellem | Resultat med observation, forklaring og nyt forsøg; synlig læring | En beslægtet opgave efter feedback, hvor spilleren skal forklare en forventning | Ingen udokumenteret enkeltårsag og ingen vurdering af virkelig diabeteskompetence | Campaign-resultater, måldefinitioner og oversættelser [C4–C5, C9, C13] |
| A6 | Mellem / større | Gentag samme korte case med ét ændret valg og sammenlign kurver | Kontrollér identiske gentagelser og derefter en kendt ændring; test om spilleren kan forklare forskellen | Samme starttilstand, hændelser og relevant tilfældighed; tydelig modelafgrænsning | Campaign-core, graf, modeltilstand og tests [C11, C13] |
| A7 | Mellem / mellem | Cases med hverdagsmål og delmål; bedre relevans og naturlige stop | Afprøv to korte cases med forskellige grupper | Ingen skyld, skjult sværhedsændring eller obligatorisk lang historie | Baner, karaktervisning og tekst [C4–C5, C8–C9] |
| A8 | Mellem / lille prototype | Fælles udforskning og underviservej; bredere anvendelighed | En pårørende-session og en undervisningssession med samme case | Fiktive cases, forståeligt sprog og adgang uden kampagnegrind | Casevalg og diskussionskort [C4, C7, C13] |
| A9 | Lav / større | Mere konkurrence, flere animationer og nye belønningssystemer | Kun efter at start og læringsloop fungerer | Ingen pres for fremmøde eller medicinsk præstationsrangliste | Box Challenge og resultatvisning |

A1–A5 er konkrete designhypoteser støttet af kodefund og principperne i afsnit 6. Ingen af dem har endnu målt effekt i dette spil. A6 har stor mulig læringsværdi, men kræver mere teknisk arbejde og bør begynde med én afgrænset case.

**Anbefalet rækkefølge:** Lav først en klikbar prototype af A1–A3. Afprøv den med forskellige brugere. Justér og implementér det bedste flow. Tilføj A4–A5 og derefter en enkelt sammenligningscase fra A6. Udvid først indholdet, når de grundlæggende forløb fungerer.

Før en større implementering anbefales et eksplicit godkendt commit og push som sikkerhedskopi af det nuværende arbejde. Denne rapport indebærer ingen tilladelse til commit, push eller publicering.

## 10. Hvordan forslagene kan afprøves

### 10.1 Første kvalitative runde

Rekruttér eksempelvis 12–16 deltagere fordelt på nye i T1D, pårørende, erfarne personer med T1D og sundhedsprofessionelle. Sørg for variation i læse-, tal- og spilfærdigheder. Børn bør indgå i en særskilt alderssvarende afprøvning med relevant vokseninddragelse. Et sådant antal kan finde brugbarhedsproblemer; det kan ikke dokumentere klinisk effekt eller sikre resultater for hver undergruppe.

Brug den samme korte opgave. Giv en neutral introduktion uden at forklare knapperne på forhånd. Registrér, hvornår testlederen må hjælpe. Afprøv både den eksisterende og den foreslåede indgang, med forskellig rækkefølge mellem deltagere for at mindske øvelseseffekt.

Test først i observerede sessioner med minimale noter. Et permanent analytics-system er ikke en forudsætning.

### 10.2 Mål og foreløbige succeskriterier

Tallene er projektets foreslåede mål for en prototype og skal justeres efter den første runde.

| Nr. | Mål | Foreløbigt kriterium | Fortolkning |
|---|---|---|---|
| 1 | Tid til første meningsfulde handling | Median under 60 sekunder | Medtag hele starten; gennemløbne popups tæller ikke som en faglig handling |
| 2 | Første fulde læringsforløb | Handling, observation og et nyt valg inden for cirka 3 minutter | Hurtig start er utilstrækkelig, hvis konsekvensen forbliver uforståelig |
| 3 | Adgang til kørende gameplay | Registrér hvor mange der kommer frem uden hjælp, samt hvert stoptrin | Undersøg konkrete forhindringer frem for blot et gennemsnit |
| 4 | Første forståelse | En beslægtet, ny situation og en kort forklaring med egne ord | Adskiller en lært sammenhæng fra gentagelse af en knapfølge |
| 5 | Sikkerhedsforståelse | Alle skal kunne forklare, at spillets resultater ikke bruges til virkelig medicindosering | En misforståelse udløser undersøgelse og rettelse; et lille perfekt resultat beviser ikke generel sikkerhed |
| 6 | Oplevet kontrol og lyst | Kort vurdering af hjælp, tempo og lyst til at prøve et andet valg | Lang sessionstid kan skyldes forvirring og er ikke alene succes |
| 7 | Tilbagevendende spiller | Direkte adgang til den relevante næste opgave med højst 1–2 startinteraktioner | Vurder særskilt fra første besøg |
| 8 | Inklusion | Gennemgå fund efter behovsgruppe, mobil/desktop og sprog | Et bedre gennemsnit må ikke skjule, at en gruppe stadig sidder fast |

Gennemfør en kort genbesøgstest senere med en ny case for at undersøge, om forståelsen holder. Hold læringsmåling adskilt fra mål om virkelig behandling, som denne rapport ikke afprøver.

### 10.3 Stopkriterier for et designforslag

1. Brugere opfatter faste karakterdata som en måde at finde deres egen dosis på.
2. En bruger kommer hurtigt gennem introduktionen, men forstår ikke tidsforløbet eller grafens betydning.
3. Mere hjælp opleves som skamfuldt eller som tab af adgang til interessant indhold.
4. En forklaring påstår en årsag, som den konkrete simulation ikke kan understøtte.
5. Nye trin fungerer med mus, men bliver en barriere på mobil eller med tastatur.

## 11. Kodegrundlag

Henvisningerne er til den gennemgåede lokale version. De angivne linjer er indgange til de relevante funktioner eller konfigurationer.

| ID | Fil og sted | Grundlag |
|---|---|---|
| C1 | [main.js:1338](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/main.js:1338>) | Disclaimer-gate, normal start og velkomstgenvej til bane 1 |
| C2 | [ui.js:3378](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/ui.js:3378>) og [ui.js:3490](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/ui.js:3490>) | Checkbox/knap og samlet tilstands-/karaktervalg |
| C3 | [welcome-tour.js:99](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/welcome-tour.js:99>), [welcome-tour.js:479](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/welcome-tour.js:479>) og [welcome-tour.js:1869](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/welcome-tour.js:1869>) | Timerfaktor, velkomstvalg og tourens start/afslutning; trin i samme fils `TOURS` |
| C4 | [campaign.js:260](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/campaign.js:260>) | Desktopintro, pause, info-links og afsluttende animation |
| C5 | [levels.js:97](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/levels.js:97>) | Første banes tid, basalprofil, handlinger, mål, stjerner og tips |
| C6 | [mobile.js:1175](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/mobile/mobile.js:1175>) og [mobile/index.html:501](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/mobile/index.html:501>) | Mobilvelkomst, Campaign-indgang og første formålsinformation |
| C7 | [mobile.js:1807](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/mobile/mobile.js:1807>) | Mobilens banevalg, intro og genoptagelse efter intro |
| C8 | [archetypes.js:1](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/archetypes.js:1>) | Faste profiler, karakter-ID og begrænsninger ved modelprofiler |
| C9 | [i18n.js:843](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/i18n.js:843>) | Dansk disclaimer og velkomst; mobiltekst ved linje 1008, engelske tekster senere i filen |
| C10 | [game.js:33](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:33>) og [game.js:249](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:249>) | Fysiologivisning og highscorestatus |
| C11 | [game.js:49](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/game.js:49>) og [main.js:1597](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/main.js:1597>) | Spiltid og hastighedstrin |
| C12 | [README.md:275](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/README.md:275>) og [index.html:1137](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/index.html:1137>) | Eksisterende formålsgrænse og hjælpetekst |
| C13 | [campaign-core.js:588](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/campaign-core.js:588>) og [campaign-core.js:1504](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/js/campaign-core.js:1504>) | Gemt progression og åbning af næste bane |
| C14 | [Rapport fra 2026-08-05](<C:/Dropbox/Kristian/Diabetes/Diabetes Simulator - Virtuel udforskning af din virkelighed/docs/reviews/2026-08-05_codex_onboarding-engagement.md>) | Tidligere analyse; aktuelle fund er kontrolleret mod kode på ny |

## 12. Kildekontrol og begrænsninger

1. **Afgrænset research:** Rapporten er en designanalyse med udvalgte forsknings- og myndighedskilder, ikke en systematisk litteraturgennemgang, fysiologisk validering eller juridisk klassifikation.
2. **Lokale links:** De anvendte PDF'er fra Washington, Self-Determination Theory, Northwestern, Florida State University og EU-Kommissionen samt de to FDA-sider blev hentet fra brugerens pc med HTTP 200 og kontrolleret for dokumentidentitet. Nørlev-linket er særskilt markeret som ikke fuldt lokalt verificeret. EUR-Lex gav tomme HTTP 202-svar og er ikke brugt som et lokalt verificeret direkte link.
3. **Privat litteraturarkiv:** Lokale arkivkopier og indeks er identificeret for Andersen, Ryan, Nørlev og Shute. MDA-artiklen er tilføjet med rå original, SHA-256 og kildeoplysninger og har fået en søgbar læsekopi. Arkivopdateringen genbrugte 172 eksisterende udtræk og konverterede denne ene artikel. Den fandt også en eksisterende, ugyldig PDF-fil, `Mergenthaler_2013_RW_SugarForBrainEnergyMetabolism.pdf`, som nu står blokeret; den er ikke brugt i rapporten. Maskinudtræk er ikke betragtet som faglig godkendelse, og de eksisterende udtræksadvarsler om tabeller, ligninger og tekstoverlap er ikke brugt som grundlag for kvantitative påstande.
4. **Ingen målgruppetest endnu:** Forslagenes effekt på nydiagnosticerede, pårørende, børn og sundhedsprofessionelle skal undersøges. Ingen af grupperne har godkendt dette oplæg.
5. **Ingen implementering:** Kode, lyd, fysiologiske parametre og offentlig version er ikke ændret som del af rapporten.

Samlet status: F1–F7 er åbne observationer til beslutning. A1–A9 er forslag til prioritering og afprøvning.
