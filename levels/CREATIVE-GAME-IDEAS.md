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
