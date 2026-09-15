---
name: game-text-writer
description: >
  Kvalitetssikr og skriv spiller-vendt tekst til T1D Simulator, især sammenhæng
  mellem korte graf-tips og de dybere spilguide/Additional info-afsnit. Brug
  denne skill når Codex skal sikre at tips, guide-links, baneintroer,
  game-over feedback og help-tekst stemmer overens, har korrekt niveau,
  er mindre AI-agtige, er tosprogede i js/i18n.js, og giver praktiske
  spilstrategier uden at lave fysiologisk review. Ved videnskabelig research
  eller dyb fysiologi bruges science-reviewer i stedet.
---

# Game Text Writer

Denne skill bruges til at sikre kvalitet og sammenhæng i spiller-vendt
undervisningstekst i T1D Simulator. Den skal især kontrollere at et kort tip,
dets info-ikon/link og det tilsvarende spilguide-afsnit fortæller samme historie
på forskellige dybdeniveauer.

Denne skill er ikke en fysiologisk review-skill. Brug `science-reviewer` til
videnskabelig research, litteratur, BG-SCIENCE og nye fysiologiske påstande.

## Før Du Skriver

Læs den relevante tekst- og UI-kontekst først:

- `docs/INTENDED-PURPOSE.md` for produktets formål og grænse mod individuel
  beslutningsstøtte.
- `js/guide-data.js` for spilguide-afsnit, guide-id'er og ikon-mapping.
- `js/levels.js` for tip-timing, level-tema og hvilke mekanikker spilleren har.
- `js/i18n.js` for eksisterende tone og oversættelsesnøgler.
- Den aktuelle HTML og relevante UI-kode for knapnavne, adgang og funktion.
  Ældre guides og reviews er ikke bevis for, hvordan spillet virker nu.
- `docs/MODEL-IMPLEMENTATION.md` kun hvis teksten skal matche en eksisterende
  simulator-mekanik.

Læs kun `docs/BG-SCIENCE.md`, hvis der allerede findes en relevant kildepassage
der skal parafraseres. Hvis opgaven kræver ny fysiologisk research, stop og brug
`science-reviewer`.

## Kerneopgave: Tip Guide Sammenhæng

For hvert tip eller guide-link, kontrollér:

1. Tippet siger kun den korte observation eller handling.
2. Mappingen, inklusive nøglespecifikke undtagelser, linker til et afsnit der
   faktisk forklarer tippets emne. Et fælles ord som "dosis" er ikke nok.
3. Guide-afsnittet uddyber samme pointe med mere praktisk kontekst.
4. Teksten lover ikke mere end simulatoren faktisk viser.
5. Dansk og engelsk version har samme mening og omtrent samme tone.

Hvis et tip ikke kan uddybes i et eksisterende guide-afsnit, foreslå eller opret
et nyt guide-afsnit eller en relevant udvidelse af et eksisterende. Link ikke
til et uvedkommende afsnit blot for at få en mappingkontrol til at bestå.

## To Tekstniveauer

Vælg niveau efter hvor teksten vises.

### 1. Graf-tip

Formål: Spilleren skal hurtigt forstå hvad de kan lægge mærke til.

Krav:
- Én sætning, helst under 120 tegn.
- Nævn højst én mekanik.
- Skriv konkret: "Cardio kan sænke BG mere, når der er aktiv hurtiginsulin."
- Undgå lange forklaringer, parenteser og flere råd i samme tip.
- Link til spilguiden via eksisterende guide-mapping, ikke ved at skrive hele
  forklaringen i tippet.

### 2. Spilguide / Additional Info

Formål: Det dybere spiller-vendte lag. Forklar hvad spilleren kan observere,
hvad det betyder i spillet, og hvad de kan prøve næste gang.

Forbind observation, forklaring og mulige valg i korte afsnit. Lad en sætning
føre frem til den næste: hvad sker der, hvorfor, og hvad betyder det for det
spilleren kan opleve? Det er ikke en obligatorisk skabelon med fire overskrifter.
Guiden skal forklare mere end tippet, ikke bare samle flere korte tips.

Eksempel på sammenhæng: "Leveren frigiver glukose mellem måltiderne.
Basalinsulin dæmper denne frigivelse. Derfor kan blodsukkeret stige uden mad,
hvis karakteren mangler basalinsulin."

## Praktisk Læringsniveau

Tekster må gerne hjælpe med spilstrategi, men skal konsekvent handle om en fast,
fiktiv karakter og observationer i simulatoren. De må ikke omsætte karakterens
parametre eller resultater til spillerens behandling.

Gode formuleringer:
- "I spillet kan du prøve..."
- "Prøv samme situation med [karakterens navn]..."
- "Læg mærke til..."
- "Se, om blodsukkeret falder hurtigere under motion, når karakteren har
  aktiv hurtiginsulin."

Undgå:
- "Gør altid..."
- "Tag X enheder..."
- "Din dosis", "dit blodsukker" eller "din insulinfølsomhed".
- Regnestykker, der udleder en insulindosis fra kulhydrat, ICR, ISF eller vægt.
- "Dette er farligt" som standardformulering.
- Skyld, dom eller skræmmende sprog.

Karakteren får mad og insulin; spilleren vælger handlingerne. Når konteksten er
klar, brug naturlige stedord frem for at gentage karakterens navn, "fiktiv" eller
"i spillet" i hver sætning.

## Emne-specifikke Kvalitetskrav

### Cardio

Sørg for at tip og guide hænger sammen om:
- BG kan falde mere under cardio, især med aktiv hurtiginsulin.
- Effekten kan fortsætte efter aktiviteten.
- Spilleren bør kigge på IOB, trend og timing.

Spilråd:
- Kig på karakterens IOB før motion.
- Følg karakterens trend, ikke kun den aktuelle værdi.
- Prøv samme løbetur med og uden aktiv insulin og sammenlign kurverne.

### Styrketræning / Høj Intensitet

Sørg for at tip og guide hænger sammen om:
- BG kan stige kortvarigt ved høj intensitet/styrke.
- Blodsukkeret kan falde senere, når insulinfølsomheden er øget.

Spilråd:
- Forklar både den mulige stigning under træningen og faldet bagefter.
- Sammenlign cardio og styrke fra samme simulerede udgangspunkt.

### Mad

Sørg for at tip og guide hænger sammen om:
- Madens sammensætning påvirker, hvor hurtigt blodsukkeret stiger.
- Fedt forsinker mavetømningen; protein kan bidrage til en senere stigning.
- Forklar disse forskellige virkninger frem for blot at kalde maden "langsom".

Spilråd:
- Brug karakterens trend og COB, ikke kun tallet lige nu.
- Prøv forskellig bolus-timing i simulatoren.
- Lad spilleren sammenligne et par madtyper med samme kulhydratmængde og se
  forskellen på blodsukkerkurven. Brug eksemplet ét sted — gentag ikke samme
  sammenligning i flere afsnit (jf. §7).

### Insulin

Sørg for at tip og guide hænger sammen om:
- Hurtiginsulin virker med forsinkelse.
- IOB hjælper spilleren med at se aktiv insulin.
- Basalinsulin dæmper leverens glukosefrigivelse over længere tid.

Spilråd:
- Brug karakterens IOB til at se overlap mellem doser.
- Ved basalbaner: se på stabilitet over timer, ikke minutter.

### CGM

Sørg for at tip og guide hænger sammen om:
- CGM er forsinket i forhold til sand BG.
- Fingerprik i spillet er en mere præcis kontrol.
- Overraskende CGM-bevægelse bør vurderes sammen med trend, IOB og mad.

Spilråd:
- Undersøg en pludselig CGM-bevægelse med spillets fingerprik.
- Sammenhold karakterens CGM med trend, mad, IOB og aktivitet.

## Sætnings-disciplin (linjeniveau)

Disse regler gælder al spiller-tekst, men er især vigtige i spilguiden, hvor en
nydiagnosticeret læser (også børn og bange voksne) tager ordene bogstaveligt.
Målet er at hver linje giver læseren noget konkret: en observation, en mekanisme
eller et næste valg.

### 1. Vær konkret. Kan det siges mere præcist, så gør det

Erstat generelle ord med det spilleren faktisk ser eller gør. Generel fysiologi
må gerne forklares, men hver sætning skal bidrage til forståelsen af emnet.

- Vagt: "Mixed meals often rise more slowly."
- Konkret: "Bread, pasta and mixed meals raise blood sugar more slowly than
  juice, because they have to be digested first."

### 2. Intet implicit. Sig hvad der sker, og hvad det sker med

Maden, måltidet eller snacken stiger ikke. Blodsukkeret gør. Et udeladt eller
forkert subjekt lærer læseren en forkert model og koster tillid. Samme med uklare
stedord (it / that / det / den): det skal være tydeligt hvad de peger på.

- Forkert: "...while the meal is rising." / "Faste snaks stiger langsommere."
- Rigtigt: "...while blood sugar is still rising after the meal." / "Faste snaks
  hæver blodsukkeret langsommere."

### 3. Forklar nødvendige forkortelser lokalt

Læseren blev måske diagnosticeret for få dage siden, så en uforklaret forkortelse
er en mur. Brug almindelige ord, når forkortelsen ikke hjælper. Hvis spilleren
skal genkende en forkortelse fra skærmen, forklar den ved første brug i afsnittet,
fx "aktiv hurtiginsulin (IOB)". Man kan lande direkte i afsnittet via et tip.

Brug `<strong>` til passiv fremhævelse. Den nuværende guide gør gamle
`guide-term`-knapper til fed tekst, ikke klikbare definitioner. Lov aldrig en
ordforklaring eller anden funktion, som læseren ikke kan åbne.

### 4. Hver sætning og delsætning skal bidrage

Test: hvis du sletter sætningen, mister læseren så en konkret observation,
mekanisme eller handling? Hvis ikke, så slet den. AI-fyld lyder ofte støttende
eller "runder af", men tilføjer intet, fx "Det er vigtigt at forstå at...",
"Husk at alle er forskellige." eller "Dette er en vigtig del af at styre
diabetes." Skær dem væk, og gør den resterende sætning skarpere.

Læs derefter hele afsnittet højt: følger forklaringen naturligt, eller springer
teksten mellem løsrevne råd? Bevar de forbindende ord, der forklarer årsagen.
Kortere tekst og lavere LIX er hjælpemidler, ikke mål der må koste forståelse.

### 5. Ingen dårlige AI-metaforer

Se Tone nedenfor. Undgå de forbudte mønstre i AGENTS.md ("tovtrækkeri i leveren",
"sikkerhedsventil", "hormonernes dans"). De lyder levende, men er præcis det sprog
en model falder tilbage på uden konkret indhold. "Basal er den rolige baggrund"
forklarer heller ikke virkningen; beskriv i stedet leverens glukosefrigivelse.

Brug "blodsukkeret", når det er den størrelse der ændres. Brug kun "grafen"
eller "linjen", når du henviser til tegningen. Foretræk "simulatoren" frem for
"modellen" i spillertekst. Undgå indforståede omskrivninger som "skjulte
modellag", "insulinen slipper" og "en lang høj-periode".

Det gælder også menneskeliggørelse af apparater og begreber: en CGM, en
model-værdi eller "kroppen" får ikke menneske-verber (halter, kæmper, vil,
prøver, ved). Brug det præcise ord i stedet.

- Forkert: "CGM halter efter." / "Insulin vil sænke blodsukkeret."
- Rigtigt: "CGM er forsinket." / "CGM måler med forsinkelse." / "Insulin sænker
  blodsukkeret."

### 6. Kvantificér observationer, ikke behandlingsberegninger

Brug gerne tal til at beskrive det spilleren faktisk ser i modellen, fx tid,
kulhydratmængde, IOB eller ændringen i en kurve. Undlad regnestykker, der kan
læses som en metode til at beregne insulin til en virkelig person. ICR, ISF og
basalbehov kan omtales som faste modelparametre for karakteren, når begrebet er
nødvendigt for at forstå forsøget.

- Uklart: "Insulinen virker senere."
- Konkret, hvis det er kontrolleret: "I dette forsøg begynder blodsukkeret at
  falde omkring 30 minutter efter dosen til karakteren."
- Undgå: "Med ICR 10 giver 60 g kulhydrat en dosis på 6 enheder."

Opfind ikke faste ventetider eller forsøgsregler. "Følg mindst fire timer" og
"ændr kun én ting" kræver en konkret begrundelse i opgaven. Beskriv relevante
tidlige og sene virkninger uden at bestemme, hvordan spilleren skal løse banen.
En stigning på et bestemt tidspunkt beviser heller ikke én bestemt årsag;
flere påvirkninger kan være til stede samtidig.

### 7. Fjern gentagelser, men bevar selvstændigt forståelige afsnit

§4 fjerner fyld inden i en sætning; denne fjerner fyld på tværs af afsnit. Sig
samme pointe eller samme stok-eksempel én gang. Hvis juice/brød/pizza-
sammenligningen allerede er lavet i et afsnit, så genbrug den ikke i det næste —
byg videre på den eller skær afsnittet. Et afsnit der gentager et tidligere
afsnits pointe med andre ord tilføjer intet. En kort definition eller nødvendig
kontekst må dog gentages ved direkte indgange fra tips; læseren har ikke
nødvendigvis læst guiden fra begyndelsen.

### 8. Fagord skal hjælpe, ikke pynte

Tilføj ikke automatisk "glukotoksicitet", "glykogenolyse" eller andre fagord i
parentes efter en allerede forståelig forklaring. Behold fagord, når læseren
skal genkende dem i spillet, eller de er nødvendige for at forstå emnet.
Forklar dem med almindelige ord dér, hvor de bruges. Guide-dybde kommer fra
forklaring af årsag og virkning, ikke fra antallet af tekniske betegnelser.

### Revisions-pass før du er færdig

Selv-review er den svage del: den samme model der skrev fyldet, bedømmer let sit
eget fyld som "fint". Skift derfor rolle — gå fra forfatter til **kritiker med
slette-bias**. Behandl hver eksisterende sætning som skyldig indtil den er bevist
konkret:

- Slet sætningen i hovedet. Mistede læseren en observation, mekanisme eller
  handling? Hvis nej, så slet den rigtigt.
- Scan omkring stiger/falder/rise/fall for udeladte subjekter (skal være
  blodsukkeret, ikke maden/snacken).
- Bekræft at hver forkortelse er skrevet ud første gang i sit afsnit.
- Tjek for gentaget pointe eller stok-eksempel på tværs af afsnit (§7).
- Tjek for menneske-verber på apparater/begreber (§5).
- Fjern fagord, der ikke hjælper forståelsen (§8).
- Læs sætningerne i rækkefølge: fører hver sætning frem til den næste?
- Kontrollér faktiske knapnavne og virkninger. "Point beregnes ikke" og "point
  gemmes ikke" er forskellige påstande. Oversæt ikke et knapnavn i guiden alene.

Hvis et helt afsnit ikke består testen, så fjern det — færre, tættere sætninger
slår flere tomme.

### Kalibrerede eksempler (rigtige før/efter)

Brug disse som målestok i stedet for abstrakte adjektiver. Alle er ægte rettelser
fra guiden.

Varm luft (§4) — slet:
- ✗ "Blandede måltider kan give energi senere, men de er ofte for langsomme til et
  lavt tal lige nu."
- ✓ slettet — "kan give energi senere" siger intet konkret, og "for langsomme"
  stod allerede.

Menneskeliggørelse (§5):
- ✗ "CGM kan halte efter, så de nyeste punkter kan stadig ligge lavt..."
- ✓ "CGM er forsinket..." — eller fjern helt, hvis afsnittet ikke handler om CGM.

Kvantificér observation, ikke dosisberegning (§6):
- ✗ "Med ICR 10 dækker 1 enhed 10 g, så 60 g giver en dosis på 6 enheder."
- ✓ "Prøv forskellige tidspunkter for dosen til karakteren, og sammenlign hvor
  hurtigt blodsukkeret stiger efter måltidet."

Gentagelse på tværs af afsnit (§7):
- ✗ Slut-afsnit der siger "Sammenlign samme mængde kulhydrat fra juice, brød og
  pizza", når samme sammenligning allerede åbnede sektionen.
- ✓ slettet slut-afsnittet — sammenligningen var allerede lavet.

Uklart subjekt (§2):
- ✗ "...hvor høj den bliver og hvor længe den varer." (hvad er "den"?)
- ✓ "...hvor højt blodsukkeret når op, og hvor længe stigningen varer."

## Tone

Skriv på dansk når brugeren skriver dansk. Ved tosproget UI-tekst: skriv dansk
først når brugerinput er dansk, og tilføj derefter engelsk version i samme stil.

Spiller-vendt tekst skal være:
- varm og rolig
- konkret og handlingsnær
- lærende, ikke belærende
- børnevenlig uden at tale ned
- fri for AI-clicheer og dramatisk fysiologi-sprog

Undgå de forbudte metaforer i `AGENTS.md`, fx "tovtrækkeri i leveren",
"sikkerhedsventil", "hormonernes dans" og lignende generiske formuleringer.

## Kvalitetscheck

Før du er færdig, tjek:

- Har hvert nyt tip et relevant guide-afsnit via mappingen?
- Forklarer guiden mere end tippet uden at blive BG Science?
- Er de danske og engelske nøgler synkroniseret semantisk?
- Passer teksten til de handlinger spilleren faktisk har adgang til i banen?
- Er platformen kontrolleret? Responsiv desktopvisning er ikke nødvendigvis
  den separate mobilversion, og en funktion kan være tilgængelig kun ét sted.
- Er tonen rolig, konkret og ikke-dømmende?
- Er der ingen nye medicinske instruktioner som "tag X enheder"?

## Implementering

Når teksten skal ind i spillet, ret kun de relevante filer:

- Tilføj/ret nøgler i `js/i18n.js` på både dansk og engelsk.
- Tilføj/ret tip-definitioner i `js/levels.js`.
- Tilføj/ret guide-afsnit og mapping i `js/guide-data.js`.
- Brug eksisterende guide-id'er, hvis emnet passer. Opret kun nye guide-afsnit,
  hvis emnet ikke kan dækkes ordentligt af de eksisterende.
- Opdater mappingregler og eventuelle nøglespecifikke undtagelser. Test
  forventet destinationsafsnit, ikke kun at der findes en destination.
- Kør mindst:
  - `tests/.bin/node.exe --check js/i18n.js`
  - `tests/.bin/node.exe --check js/levels.js`
  - `tests/.bin/node.exe --check js/guide-data.js`
  - `tests/.bin/node.exe tests/guide-links.test.js`
  - `tests/.bin/node.exe tests/check-intended-purpose-text.js`

Ved ændrede guide-links, struktur eller rendering bruges `playwright-test`
til relevant browserkontrol. Tekstkontroller fanger kendte fejlmønstre; de er
ikke dokumentation for læsbarhed eller juridisk godkendelse.

Kør simulationstesten ved ændringer i campaign/tips-flow:
`tests/.bin/node.exe tests/simulation.test.js`

Hvis `bash` findes, kør også:
`bash tests/check-text-sync.sh`
