# Kreative spilidéer

Opdateret: 2026-09-05

## Formål

Denne fil samler spekulative og legende idéer til T1D Simulator. En idé i filen er **ikke** en planlagt funktion, en implementeringsbeslutning eller et løfte om at inkludere den i det offentlige spil.

Idéerne kan senere udvikles, kombineres, afvises eller flyttes til `TODO.txt`, hvis projektejeren udtrykkeligt beslutter, at de skal undersøges eller implementeres.

## Idéstatus

1. **Brainstorm:** Registreret, men ikke vurderet.
2. **Undersøg:** Udvalgt til design- eller evidensreview, men ikke godkendt til implementering.
3. **Kandidat:** Vurderet som tilstrækkeligt lovende til en senere implementeringsbeslutning.
4. **Parkeret:** Bevares som inspiration, men forfølges ikke aktuelt.
5. **Afvist:** Vurderet og bevidst fravalgt med en dokumenteret begrundelse.

## Idéer

### Diabetes Bowling

**Tilføjet:** 2026-09-05  
**Status:** Brainstorm  
**Oprindelse:** Inspireret af reviewet af serious games

10 bowlingkegler placeres som mål på grafen for kontinuerlig glukosemåling (CGM). Før en tydeligt markeret startlinje præsenteres spilleren for en fast defineret hændelse, for eksempel et måltid eller fysisk aktivitet, og kan vælge en eller flere tilladte handlinger, såsom at give insulin. Efter startlinjen fortsætter den simulerede CGM-kurve uden yderligere indgreb og kan ramme nogle eller alle keglerne.

Keglernes antal og placering kan repræsentere forskellige udfordringer, eksempelvis at forudsige glukoseresponsens retning, timing eller størrelse. Konceptet omsætter forudsigelsen af et dynamisk fysiologisk forløb til et tydeligt visuelt spilresultat.

**Åbne designspørgsmål:**

1. Skal målet være at ramme alle kegler, udvalgte kegler eller en målkorridor?
2. Hvordan undgår placeringen af kegler at antyde, at kun ét præcist glukoseforløb er klinisk korrekt?
3. Skal spilleren kunne vælge én handling eller en kort rækkefølge af handlinger før startlinjen?
4. Skal feedback forklare, hvorfor den observerede kurve afveg fra spillerens forventning?
5. Kan faste variationer demonstrere, at identiske handlinger kan give forskellige resultater på tværs af karakterer eller situationer?

### Glucose Runner - fysiologisk platformspil i 1990'er-stil

**Tilføjet:** 2026-09-05  
**Status:** Brainstorm  
**Oprindelse:** Forslag fra projektejeren; visuelt inspireret af klassiske europæiske platformspil fra Amiga- og 16-bit-perioden

Et originalt platformspil med farverig pixelgrafik og tydelig 1990'er-arkadestemning. Referencen til *The Great Giana Sisters* bruges kun som en løs beskrivelse af tempo, perspektiv og tidsperiode. Figurer, baner, musik, grafik og særprægede designelementer skal være originale.

Spilleren bevæger sig gennem baner, samtidig med at en lille kontinuerlig glukosemåling (CGM) viser det simulerede glukoseforløb. Bevægelsesformen påvirker fysiologien: løb repræsenterer primært aerob aktivitet, mens klatring, tunge skub og andre styrkeopgaver repræsenterer modstandsarbejde. Banens udfordring er både fysisk navigation og planlægning af mad, insulin, pauser og aktivitet, så karakteren kan gennemføre med et stabilt glukoseforløb.

Mad og behandlingsressourcer er kontekstafhængige værktøjer frem for universelle power-ups. Hurtigt sukker kan afhjælpe eller forebygge lav glukose, men uhensigtsmæssig brug kan give en efterfølgende høj værdi. Et blandet måltid, eksempelvis en bøf med tilbehør, kan give langsommere og mere langvarige effekter. Insulin kan være nødvendigt, men for meget aktivt insulin før løb kan gøre en ellers enkel passage vanskelig. Spilleren skal derfor aflæse situationen og ikke blot samle flest mulige genstande.

Hvis glukosen bevæger sig uden for banens sikkerhedsramme, går spillet i en neutral hjælpe- eller checkpointtilstand. Karakteren dør ikke. Spillet viser den sandsynlige årsag, lader spilleren anvende en relevant sikkerhedshandling og tilbyder et hurtigt nyt forsøg. Dermed bevares spændingen uden at gøre hypoglykæmi eller diabeteshåndtering til en dødsmetafor.

**Mulige baneelementer:**

1. Konditionsstrækninger, hvor løbehastighed og varighed øger glukoseforbruget.
2. Klatrevægge og tunge objekter, der repræsenterer styrkepræget aktivitet med et andet og mindre entydigt glukoseforløb.
3. Måltidsporte, hvor spilleren skal vælge tidspunkt, portionsstørrelse eller bolus, før vejen åbnes.
4. Forsinkede madbølger, eksempelvis pizza eller fedt- og proteinrige måltider, som først påvirker en senere del af banen.
5. Insulin-on-board-blokke, der synliggør tidligere doser og gør insulin-stacking til et planlægningsproblem.
6. Stresszoner, søvnunderskud, sygdom og varme som modifikatorer af en ellers kendt bane.
7. Pumpesvigt, sensorudfald, lavt batteri eller manglende udstyr som problemløsningssekvenser.
8. Forgrenede ruter, hvor en kort og intensiv vej samt en længere og roligere vej giver forskellige fysiologiske belastninger.
9. Pausesteder, hvor spilleren kan observere tendenspil, glukose og aktivt insulin, før næste sektion vælges.
10. Videnskort eller forklaringsbrikker, der låser korte kausale forklaringer op efter en konkret oplevelse i banen.

**Mulige ressourcer og symboler:**

1. Glukosetabletter, bolsjer eller juice som hurtigtvirkende kulhydrat.
2. Brød, frugt, pasta og blandede måltider med forskellige absorptionsprofiler.
3. Insulinpenne, pumpeampuller eller infusionssæt som begrænsede behandlingsressourcer.
4. Glukagon, ketonstrimler, reservekanyler, vand og opladet telefon som sikkerhedsudstyr.
5. CGM-sensorer og tendenspile som informationsressourcer snarere end pointgenstande.
6. Tid-i-målområdet-stjerner, hypotesebrætter eller erfaringspoint som belønning for forståelse og ikke for en enkelt perfekt glukoseværdi.

**Mulige modstandere og forhindringer:**

1. Rullende kulhydratbølger, der repræsenterer måltidets tidsprofil.
2. Forsinkede dobbelttoppe efter fedt- og proteinrige måltider.
3. Insulin-stacking-skygger, som følger efter gentagne doser.
4. Stressskyer og søvntåge, der ændrer responsen uden at være egentlige monstre.
5. Sensorstøj, signaltab og kompressionsalarmer, der gør informationen usikker.
6. Okklusionsgear og tomme ampuller som tekniske problemer, der kræver korrekt fejlfinding.
7. Tidsporte, hvor præbolus, måltid og aktivitet skal koordineres.
8. Variabilitetskopier af samme bane, hvor identiske handlinger ikke nødvendigvis giver helt samme kurve.

**Åbne designspørgsmål:**

1. Skal CGM-forløbet køre kontinuerligt i realtid, i komprimeret tid eller kun mellem banens checkpoints?
2. Hvordan kobles platformfærdighed og diabetesforståelse, så gode reflekser ikke kan erstatte den tilsigtede læring?
3. Skal spilleren planlægge hele sektioner på forhånd eller kunne reagere løbende?
4. Hvordan forklares aerob aktivitet, modstandsarbejde og forsinkede effekter uden at gøre banen teksttung?
5. Hvordan vises biologisk variation, uden at spilleren oplever udfaldet som tilfældigt eller uretfærdigt?
6. Hvilke fejl skal udløse øjeblikkelig feedback, og hvilke skal først blive synlige senere i banen?
7. Kan baner bygges omkring én tydelig hypotese ad gangen, så gentagelse bliver et kontrolleret eksperiment?
8. Hvordan undgås det, at insulin fremstilles som gift, kulhydrat som medicin i alle situationer eller bestemte fødevarer som moralsk gode eller dårlige?
9. Kan spillet have en rent underholdende grundmekanik, som stadig fungerer, når forklaringer og undervisningslag slås fra?
10. Skal konceptet være en selvstændig spiltilstand, korte bonusbaner eller et helt separat projekt?
