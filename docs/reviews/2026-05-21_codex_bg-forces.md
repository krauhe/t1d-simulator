# Kritisk revision: BG forces

Genereret: 2026-05-21

## Konklusion

BG-forces-panelet underviser lige nu forkert om hurtig insulin. Den underliggende simulation ser ikke ud til at være årsagen; problemet ligger i den forklarende beregning og den måde kræfterne vælges til panelet på.

Det vigtigste fund er, at `Hurtiginsulin` kun beregnes som netto transport fra plasma til perifert væv (`x1 * Q1 - k12 * Q2`). Det udelader den insulin-drevne disposal i Q2 (`x2 * Q2`) og den insulin-drevne hæmning af leverproduktion (`x3`). Derfor kan hurtig insulin vises som en lille pil, selv når aktiv rapid-insulin er den vigtigste årsag til at BG falder.

## Findings

### 1. KRITISK - Hurtiginsulin viser ikke samlet insulin-effekt

**Status:** ✅ FIKSET (2026-05-21)

**Kode:** `js/simulator.js`, `_computeBGForces()`, omkring linje 5333-5356.

Den viste insulin-kraft er:

```js
const netInsulinFlux = x1 * Q1 - k12Q2;
```

Det er kun nettoeffekten på plasma-kompartmentet Q1. I Hovorka-modellen virker insulin også gennem:

- `x2 * Q2`: insulin-drevet disposal i perifert væv.
- `x3`: suppression af endogen glukoseproduktion i leveren.

Det betyder, at panelet kan vise `Hurtiginsulin` som lille, selv om rapid-insulin fysiologisk dominerer situationen. En testkørsel med 4E rapid-insulin og IOB omkring 2E gav:

| Signal | Ca. størrelse |
|---|---:|
| Vist `Hurtiginsulin` | 0,09-0,14 mmol/min |
| Insulin-drevet Q2-disposal | 0,32-0,38 mmol/min |
| Insulin-drevet lever-suppression | ca. 0,9-1,0 mmol/min |

Det matcher brugerens screenshot: IOB er høj, BG er lav/faldende, men hurtiginsulin-pilen bliver lille.

**Anbefaling:** Beslut om panelet skal vise strengt øjeblikkelige Q1-fluxer eller pædagogiske årsagskræfter. Til spiller-UI bør `Hurtiginsulin` sandsynligvis være en samlet insulin-effekt:

```js
insulinEffect = max(0, exerciseFactor * x1 * Q1 - k12 * Q2)
              + exerciseFactor * x2 * Q2
```

Lever-suppression via `x3` bør enten vises som en del af leverlinjen eller som separat forklaring, ikke skjult i en lille insulinpil.

### 2. KRITISK - Basal/bolus-splittet bruger en heuristik, selvom modellen har eksakt kilde-split

**Status:** ✅ FIKSET (2026-05-21)

**Kode:** `js/simulator.js`, omkring linje 5345-5350. Tidligere review: `docs/reviews/2026-04-18_claude_full-physiology-v3.md`, W8.

Koden beregner basal-andel sådan:

```js
const basalSteadyI = basalRate_mU_min / (this.hovorka.k_e * this.hovorka.V_I);
const basalFrac = Math.min(1, basalSteadyI / Math.max(plasmaI, 0.01));
```

Det er et steady-state-estimat baseret på aktuel basal-rate. Men modellen har allerede en separat basal shadow-cascade:

- `state[6]`: total plasma-insulin.
- `state[15]`: basal plasma-insulin (`Ib`).

Andre steder i simulatoren bruges den korrekte separation allerede:

```js
rapidPlasmaMU = max(0, (I - Ib) * V_I)
```

**Konsekvens:** Når basal er på vej op eller ned, kan basal-andelen i forces-panelet blive forkert. Rapid-andelen kan derfor blive undervist for lille eller for stor afhængigt af timing.

**Anbefaling:** Brug `Ib` direkte:

```js
const totalI = Math.max(this.hovorka.state[6], 0.01);
const basalI = Math.min(this.hovorka.state[15] || 0, totalI);
const basalFrac = basalI / totalI;
const bolusFrac = 1 - basalFrac;
```

### 3. ADVARSEL - Panelet blander faktiske fluxer og konstruerede modifier-kræfter

**Status:** ✅ FIKSET (2026-05-21)

**Kode:** `js/simulator.js`, omkring linje 5251 og 5312-5322.

Kommentaren siger at alle magnituder er faktiske glukose-fluxer i mmol/min. Men `ffaResistance` og `glucotoxicity` beregnes som konstruerede pædagogiske værdier:

```js
const ffaFlux = (this.ffaResistanceFactor - 1.0) * this.hovorka.EGP_0 * 0.3;
const gtoxFlux = (this.glucotoxicResistanceFactor - 1.0) * this.hovorka.EGP_0 * 0.5;
```

De er ikke direkte fluxer i Hovorka-ligningen. Når de skaleres sammen med faktiske fluxer, kan de få en pilstørrelse der ser mere præcis ud end den er.

**Anbefaling:** Enten:

1. Hold BG-forces til faktiske fluxer og flyt FFA/glukotoksicitet til fysiologi-/eISF-forklaringen.
2. Eller markér dem som `kind: 'modifier'` og giv dem en separat visuel skala, så de ikke konkurrerer direkte med insulin, mad, leverproduktion og hjerneforbrug.

### 4. ADVARSEL - UI-udvælgelsen kan droppe en større nedadgående kraft

**Status:** ✅ FIKSET (2026-05-21)

**Kode:** `js/ui.js`, omkring linje 3894-3899.

UI’et vælger først op til tre op-kræfter og tre ned-kræfter, og skærer derefter ned til fem rækker:

```js
const upForces = allForces.filter(f => f.direction === 'up').slice(0, 3);
const downForces = allForces.filter(f => f.direction === 'down').slice(0, 3);
const forces = [...upForces, ...downForces].slice(0, MAX_ROWS);
```

Da op-kræfter altid lægges først, kan en mindre op-kraft få plads mens en større ned-kraft bliver fjernet.

**Anbefaling:** Vælg top 5 globalt efter magnitude først, og gruppér dem derefter visuelt efter retning hvis layoutet stadig skal have op øverst og ned nederst.

### 5. ADVARSEL - Testene fanger kun struktur, ikke fysiologisk korrekt ranking

**Status:** ⚠️ DELVIST (2026-05-21)

**Kode:** `tests/simulation.test.js`, omkring linje 2020-2082.

De eksisterende tests tjekker at `forces` findes, har felter og er sorteret. De tester ikke:

- at rapid-insulin bliver større end basal efter en nylig bolus.
- at rapid-insulin bliver tydeligt ved høj IOB.
- at FFA/glukotoksicitet ikke dominerer faktiske fluxer på en misvisende måde.
- at UI’et ikke dropper en stor nedadgående kraft.

Der er også en forældet kommentar i testen der siger at EGP er fjernet, selvom `egp` faktisk stadig er med i `_computeBGForces()`.

**Anbefaling:** Tilføj målrettede regressionstests før/under fix:

- Basal-only: viser basalinsulin, ikke hurtiginsulin.
- Recent bolus + basal: viser hurtiginsulin som klart større end basal.
- Recent bolus + lav BG: samlet insulin-effekt må ikke kollapses til en mikropil.
- Mixed forces: top-5-udvælgelsen må ikke droppe en større ned-kraft.

## Foreslået fix-rækkefølge

1. Ret basal/bolus-attribution til at bruge `state[15]` (`Ib`) direkte.
2. Ændr insulin-kraften fra netto Q1-transport til samlet insulin-effekt med mindst `x2 * Q2` inkluderet.
3. Flyt eller adskil FFA/glukotoksicitet fra direkte flux-skalaen.
4. Ret UI-udvælgelsen til top 5 efter magnitude.
5. Tilføj regressionstests for de konkrete scenarier.

## Berørte filer

- `js/simulator.js`
- `js/ui.js`
- `tests/simulation.test.js`

## Status efter fix 2026-05-21

- ✅ FIKSET: 1, 2, 3, 4.
- ⚠️ DELVIST: 5. Der er tilføjet regressionstests for basal-only og recent-bolus force-attribution, men der er ikke lavet en separat automatiseret UI-test for top-5-udvælgelsen. UI’et er verificeret manuelt i browser via et bolus-scenarie.
- Verifikation: `tests\.bin\node.exe --check js\simulator.js`, `tests\.bin\node.exe --check js\ui.js`, `tests\.bin\node.exe --check tests\simulation.test.js`, `tests\.bin\node.exe tests\simulation.test.js` (140/140).
