# Fysiologisk Model-Review — Marts 2026

Gennemgang af de fysiologiske modeller i `js/simulator.js` med fokus på korrekthed, forenklinger og forbedringsmuligheder.

---

## 1. MODELFEJL: Kulhydrat-effekt skaleres forkert med insulinfølsomhed

**Kritisk — det mest alvorlige problem i hele modellen.**

**Fil:** `simulator.js:67` og `:167-168`

```javascript
get currentCarbEffect() { return this.currentISF / this.ICR; }
// ...
bgChangeThisFrame += absorbAmount * this.currentCarbEffect;
```

`currentISF` ændrer sig dynamisk (motion, stress). Når motion fordobler ISF (mere insulinfølsom), sker der:
- Insulin sænker BG **dobbelt** så meget → **korrekt** (det ER hvad insulinfølsomhed betyder)
- Kulhydrater hæver BG **dobbelt** så meget → **forkert**

I virkeligheden er BG-stigningen fra kulhydrater fysiologisk uafhængig af insulinfølsomhed hos en T1D-patient (der ingen endogen insulinproduktion har). 10g kulhydrat hæver BG med det samme beløb uanset om du netop har løbet en tur.

Formlen `ISF/ICR` er et klinisk doseringsværktøj ("hvor meget insulin skal jeg tage til dette måltid?"), ikke en fysiologisk model af hvordan kulhydrater påvirker blodsukker.

**Konsekvens i spillet:** Efter motion hæver mad BG urimeligt meget, hvilket straffer spilleren for at spise efter træning — det modsatte af virkeligheden, hvor post-exercise GLUT4 faktisk gør musklerne bedre til at optage glukose.

**Fix (trivielt):** Brug base-ISF/ICR til kulhydrat-effekt:
```javascript
get currentCarbEffect() { return this.ISF / this.ICR; } // base-værdier, ikke dynamiske
```

**Sværhedsgrad:** Trivielt — én linje kodeændring.

---

## 2. Motionens BG-fald er alt for aggressivt

**Betydelig — påvirker gameplay markant.**

**Fil:** `simulator.js:208-209`

```javascript
let bgDropPer10min = (motion.intensity === "Lav") ? 1.0 : (motion.intensity === "Medium") ? 2.0 : 3.0;
```

Ved høj intensitet: netto (3.0/10 - 0.05) = **0.25 mmol/L/min**. Over 30 min = **7.5 mmol/L fald**.

I virkeligheden falder BG typisk 2-4 mmol/L over 30 min intens træning. Lav intensitet (0.1/min → 3 mmol/L/30min) er den eneste der er nogenlunde realistisk.

**Endnu vigtigere:** Faldet er uafhængigt af aktuelt BG-niveau. I virkeligheden er musklernes glukoseoptag gradient-drevet (GLUT4): hurtigere ved højt BG, langsommere ved lavt BG. Det er en naturlig beskyttelsesmekanisme mod hypo under motion. Den nuværende model crasher villigt BG til 0.1.

**Forslag:**
- Halver raterne (0.5/1.0/1.5 per 10 min)
- Gør faldet BG-afhængigt: `bgDrop *= Math.max(0.2, (this.trueBG - 3.0) / 5.0)`
  - Ved BG=8: faktor = (8-3)/5 = 1.0 (fuld effekt)
  - Ved BG=4: faktor = (4-3)/5 = 0.2 (næsten stoppet)
  - Modellerer naturlig GLUT4 gradient-afhængighed

**Sværhedsgrad:** Let — ændring af konstanter + én ekstra linje.

---

## 3. Kontraregulering starter for sent

**Betydelig — mangler realistisk tidlig glukagon-respons.**

**Fil:** `simulator.js:403`

```javascript
if (this.trueBG < 3.5) { ... }
```

I virkeligheden sker kontrareguleringen i trin:

| BG (mmol/L) | Respons |
|---|---|
| ~3.9 | Glukagonfrigivelse starter |
| ~3.5 | Adrenalin kicks in |
| ~3.0 | Kortisol og væksthormon |
| ~2.5 | Kognitiv påvirkning |

Den nuværende model springer direkte til fuld stress-respons ved 3.5. Der mangler et tidligt, blødt glukagon-respons i området 3.5-4.0 som giver en mere realistisk, gradvis modregulering.

**Forslag:**
```javascript
if (this.trueBG < 4.0) {
    let hypoStressRate;
    if (this.trueBG < 2.5) hypoStressRate = 0.04;       // svær hypo — kraftig reaktion
    else if (this.trueBG < 3.0) hypoStressRate = 0.025;  // kortisol + væksthormon
    else if (this.trueBG < 3.5) hypoStressRate = 0.015;  // adrenalin
    else hypoStressRate = 0.005;                          // tidlig glukagon (3.5–4.0)
    this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + hypoStressRate * simulatedMinutesPassed);
}
```

**Sværhedsgrad:** Let — udvid eksisterende if-blok.

---

## 4. Kulhydratabsorption er lineær (burde være klokkeformet)

**Moderat — påvirker BG-kurvens form men ikke den totale mængde.**

**Fil:** `simulator.js:166-169`

```javascript
const absorbAmount = Math.min(food.carbs - food.carbsAbsorbed,
    (food.carbs / carbAbsorptionDuration) * simulatedMinutesPassed);
```

Absorption er konstant rate fra start til slut. I virkeligheden accelererer absorption gradvist, topper, og aftager — en skæv klokke-kurve. Den lineære model giver en forkert BG-profil: for brat stigning i starten, for lang hale.

**Forslag:** Brug en trekant-profil (som allerede bruges til insulin) eller en simpel sigmoid:
```javascript
// Sigmoid-baseret absorption (0→1 over varigheden)
const progress = (timeSinceConsumption - delay) / carbAbsorptionDuration;
const sigmoidRate = 4 * progress * (1 - progress); // peak ved midtpunktet
const absorbAmount = Math.min(remaining, food.carbs * sigmoidRate / carbAbsorptionDuration * dt);
```

**Sværhedsgrad:** Moderat — kræver lidt mere omtanke for at sikre total absorption matcher.

---

## 5. Ingen forskel på glykæmisk indeks

**Moderat — vigtig for pædagogisk værdi.**

Alle kulhydrater behandles ens: 50g sukker = 50g havregryn. I virkeligheden:
- Simple kulhydrater (sodavand, dextro): peak efter ~15-20 min
- Komplekse kulhydrater (havregryn, fuldkorn): peak efter ~40-60 min

Food-presets har allerede emoji-ikoner og navne — man kunne tilknytte en `absorptionSpeed`-faktor per preset.

**Forslag:** Tilføj en `giIndex`-parameter til food-presets:
```javascript
// Preset-eksempler:
dextro:    { carbs: 3,  protein: 0, fat: 0,  gi: 1.5 }  // hurtig absorption
havregryn: { carbs: 30, protein: 8, fat: 2,  gi: 0.6 }  // langsom absorption
sodavand:  { carbs: 35, protein: 0, fat: 0,  gi: 1.3 }  // hurtig
burger:    { carbs: 40, protein: 30, fat: 30, gi: 0.8 }  // medium (fedt forsinker yderligere)
```

GI-faktoren multipliceres på absorptionsraten og inverteres på varigheden.

**Sværhedsgrad:** Moderat — kræver ændring af addFood() og food-presets.

---

## 6. HGP er ikke insulin-reguleret

**Større arkitekturændring — men vigtig for realistisk DKA.**

**Fil:** `simulator.js:144-145`

```javascript
let liverGlucoseProduction = 0.02 * stressMultiplikator;
```

Hepatisk glukoseproduktion er konstant (kun skaleret af stress). I virkeligheden er den primære regulator af HGP **insulin**:
- Høj portal-insulin → HGP undertrykkes kraftigt
- Lav insulin → HGP stiger markant
- Ingen insulin → HGP eksploderer (det der driver DKA)

Nuværende DKA-model er en ren tidsbaseret tæller ("6 timer med højt BG + insulinmangel → advarsel"). En HGP der reagerer på insulin-niveau ville give en mere realistisk og pædagogisk korrekt DKA-spiral: ingen insulin → HGP stiger → BG stiger → mere ketoner → acidose.

**Forslag:**
```javascript
// Insulin-suppressionsfaktor: høj IOB+basal → HGP undertrykkes
const totalInsulinEffect = this.iob + this.getBasalInsulinRate();
const insulinSuppression = 1.0 / (1.0 + totalInsulinEffect * 0.5); // sigmoid-agtigt
let liverGlucoseProduction = 0.02 * stressMultiplikator * insulinSuppression;

// Ved total insulinmangel: insulinSuppression → 1.0 (ingen suppression)
// Ved normal basal: insulinSuppression → ~0.5 (halveret HGP, balanceret)
// Ved høj IOB: insulinSuppression → ~0.3 (kraftigt undertrykt)
```

**Sværhedsgrad:** Større — kræver kalibrering af hele BG-balancen og DKA-modellen.

---

## 7. Akut stress halveringstid er for lang for adrenalin

**Mindre — påvirker tidsprofilen af kontraregulering.**

**Fil:** `simulator.js:390`

Halveringstid 60 min. Real adrenalin: t½ ~2-3 min. Glukagon metabolisk effekt: ~20-60 min.

De er lumpet sammen, men 60 min giver for langvarig virkning. Overvej 20-30 min, eller split dem i to separate variable i fremtiden.

**Sværhedsgrad:** Trivielt at ændre konstanten, men kræver play-testing for at kalibrere.

---

## Ting der er godt modelleret

- **CGM-modellen** er overraskende god: 5 min samples, 5-10 min forsinkelse, systematisk drift (sinusoidalt), random noise. MARD ~13% er realistisk.
- **Basal insulin trapez-profil** er rimelig for Lantus.
- **Stresshormon-systemet** med to tidskonstanter er arkitektonisk elegant og fysiologisk korrekt i sin grundtanke.
- **circadianKortisolNiveau** med kvart-sinus-kurven er en fin model af dawn-fænomenet.
- **Fedt forsinker kulhydratabsorption** — modelleres korrekt og er et vigtigt læringspoint.
- **Protein's 25% bidrag** ("TAG-metoden") er i tråd med klinisk praksis.
- **Hurtigvirkende insulin** — trekant-profil med dosis-afhængig varighed og peak er en god approksimation. Matematikken sikrer at total BG-sænkning = dosis × ISF.
- **Vægtmodellen** er simpel men funktionel for et spil.

---

## Prioriteret anbefaling

| # | Problem | Sværhedsgrad | Effekt |
|---|---------|-------------|--------|
| 1 | carbEffect skaleres forkert med ISF | Trivielt (1 linje) | Kritisk — modellen er forkert |
| 2 | Motion BG-fald for aggressivt + BG-uafhængigt | Let | Stor gameplay-forbedring |
| 3 | Kontraregulering starter for sent | Let | Mere realistisk hypo-oplevelse |
| 4 | Lineær kulhydratabsorption | Moderat | Mere realistiske BG-kurver |
| 5 | Ingen GI-forskel på mad-typer | Moderat | Pædagogisk værdi |
| 6 | HGP ikke insulin-reguleret | Større | Nødvendig for realistisk DKA |
| 7 | Akut stress t½ for lang | Trivielt | Mindre kalibrering |
