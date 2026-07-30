# Fuld fysiologisk gennemgang — Claude (v2, supplement til v1)

**Dato:** 2026-04-18
**Reviewer:** Claude (Sonnet 4.5)
**Version:** 0.8.20-beta (kode-snapshot 2026-04-18)
**Scope:** Hele den fysiologiske kerne — kun NYE findings ift. v1 (`2026-04-18_claude_full-physiology.md`)

## Formål

Denne v2-rapport komplementerer v1-rapporten fra samme dato. Der er IKKE genoptaget findings allerede dækket i v1 — kun nye observationer og enkelte status-korrektioner til v1-findings hvor min nye gennemgang afslører at v1 var faktuelt unøjagtig.

Reviewen er baseret på fuld kode-gennemlæsning af `js/simulator.js` (5024 linjer), `js/hovorka.js` (593 linjer), samt cross-check mod alle eksisterende reviews i `docs/reviews/`.

## Resumé af nye findings

| Severity | Antal | Items |
|----------|-------|-------|
| KRITISK  | 0     | — |
| ADVARSEL | 2     | W6 ✅ FIKSET (2026-04-18), W7 (HAAF tærskel-dokumentation 3.0 vs 3.9) ÅBEN |
| NOTE     | 7     | N16-N22 ÅBEN |
| OK       | 3     | O16-O18 |

Hovedindtryk: Engine-kvaliteten er stadig høj. De nye findings er primært rest-state håndtering (Box Challenge respawn), enkelte stilistiske diskontinuiteter (point-vægte, cooldown), og nogle kalibrerings-noter (BHB-clamp, lever-glykogen kapacitet vs vægt). Ingen findings rokker ved den centrale Hovorka-kerne eller insulin/karbohydrat-flowet.

---

## [ADVARSEL] W6 — loseLife/respawn nulstiller insulin og bolus, men IKKE undigested mad → fysiologisk inkonsistent post-respawn state

**Fil:** `js/simulator.js`, linje 4471-4547 (`loseLife`) + linje 4397-4455 (`_resetToStableBG`)
**Subsystem:** Box Challenge respawn / state-konsistens

**Observation:** Ved hypo/dka-respawn kalder loseLife → `_resetToStableBG`, som:
- nulstiller `activeFastInsulin = []`
- sætter `iob = 0`
- nulstiller `state[2..3]` (rapid bolus depot)
- sætter Q1, Q2 og insulinkompartmenter til steady-state

…men EFTERLADER følgende state intakt:
- `stomachContentGrams`, `stomachCarbsTotal`, `stomachCarbsSimple`, `stomachFiber`, `stomachRetentionWeight` (mavens indhold)
- `fatStomach`, `fatIntestine`, `ffaBlood`, `ffaResistanceFactor` (fedt-pipeline)
- `proteinStomach`, `proteinGut`, `aminoAcidsBlood`, `proteinGlucagonLevel` (protein-pipeline)
- `cob` (carbs on board, beregnet fra `activeFoods`)
- `activeFoods` (mad-list — bruges til cob-beregning)
- Hovorkas D1/D2 (state[0..1] — kulhydrat-tarm-kompartmenter)

**Konkret konsekvens:** Hvis spilleren tabte et liv pga. hypo efter en bolus med stort måltid, og mad stadig var under absorption: efter respawn er bolus VÆK men kulhydraterne fortsætter med at strømme ind. BG vil så stige fra carb-absorption alene uden modsvarende insulin → spilleren får i praksis et "gratis" hyperglykæmisk spike efter respawn.

Tilsvarende ved DKA-respawn: hvis ffaBlood var højt (typisk i DKA), bevares ffaResistanceFactor > 1.0 efter respawn, så spillerens efterfølgende insulin virker svagere end nominal — uden at noget i UI viser hvorfor.

**Bemærkning ift. v1:** v1's N14 hævder at "ALL aktive boluser, motion-records, glykogen-state og cob/iob nulstilles" — dette er FAKTUELT FORKERT på mindst 4 punkter (cob bevares, glykogen-state bevares, motion-records bevares, mave-stack bevares). Det er ikke kun motion-records og glykogen-staten der bevares (delvist BY DESIGN); det er hele den dietære absorption-pipeline der bevares mens insulin nulstilles. Den kombination skaber den asymmetri.

**Forslag — diskuter før implementer:**
A) Tilstræb fuld konsistens: nulstil også `stomach*`, `fat*`, `protein*`, `aminoAcidsBlood`, `proteinGlucagonLevel`, `activeFoods`, Hovorka D1/D2, og `ffaBlood`/`ffaResistanceFactor` ved hypo/dka-respawn. Det matcher det "frisk start"-design v1 N14 antager.
B) Eller bevar det BY DESIGN, men opdater v1 N14's beskrivelse + tilføj UI-hint efter respawn der forklarer at "kroppen husker sidste måltid — vent på at det fordøjes før du tager mere insulin".

**Severity:** ADVARSEL fordi dette skaber gameplay-feedback der ikke er forklaret nogen steder, og fordi en post-DKA respawn med høj ffaResistance kan give spilleren det indtryk at deres ICR/ISF er forkert beregnet.

**STATUS:** ✅ FIKSET (2026-04-18) — `_resetToStableBG()` udvidet til komplet fysiologisk reset (Option A): nulstiller nu mave/tarm-pipeline (stomach/fat/protein/FFA/aminoSyrer), Hovorka D1/D2 carb-depot, motion (E1/E2/puls/activeAktivitet/activeMotion/cooldown), stress (akut/kronisk/hypoArea/counterReg), insulinresistens (FFA/glucotox/IR), glykogen (lever+muskel) til fuldt fyldt, brain/acidose/ketoner, og CGM-kompartment til ny trueBG. Yderligere: basal-historikken nulstilles og erstattes med én anbefalet basal-dosis "injiceret 12 timer siden" — giver matematisk konsistent steady-state nu og naturligt cue til at tage frisk basal indenfor 6-12t. Ny i18n-string `boxchallenge.respawn.basalTip` informerer spilleren om dette ved respawn. Verificeret med 129/129 tests inkl. `loseLife hypo-respawn`-testen.

---

## [ADVARSEL] W7 — HAAF-dokumentationsdrift: kode bruger 3.0 mmol/L tærskel, v1 prose siger 3.9

**Filer:**
- `js/simulator.js`, linje 851-852, 856, 2596-2597, 2623-2626 (kode + kommentarer — alle siger 3.0)
- `docs/reviews/2026-04-18_claude_full-physiology.md`, linje 452-454 (v1 N6 prose siger 3.9)

**Observation:** Koden bruger konsekvent `3.0` mmol/L som tærskel for hypoArea-akkumulering:
```
const deficit = Math.max(0, 3.0 - this.trueBG);
this.hypoArea += deficit * simulatedMinutesPassed;
```
Og kommentarer i samme blok citerer Cryer 2013 for at "neuronale adaptation primært sker" ved 3.0.

v1's N6 ([NOTE] N6 - HAAF area-akkumulering bruger 1-min ticks) skriver:
> `hypoArea += (3.9 - trueBG) * dt` integreres pr. substep.
> Hvor stort steady-state hypo over 60 min ved BG=2.5: hypoArea-bidrag = (3.9 - 2.5) x 60 = 84 enheder.

Det reelle tal med 3.0-tærsklen er (3.0 - 2.5) × 60 = 30 enheder, hvilket giver counterRegFactor = 0.3 + 0.7 × exp(-30/30) = 0.557 (ikke 0.34 som v1 angiver). Forskellen er stor (counterReg-output ved samme stress: 56% vs 34%).

**Konsekvens:** v1's analyse af HAAF-tidskonstanter er kvantitativt forkert. Reviewen er ikke ugyldig som principle (areal-baseret model er korrekt), men de konkrete tal kan ikke bruges som reference.

**Forslag — diskuter:**
- Beslut: er tærsklen 3.0 (kode + kode-kommentar + Cryer 3.2) eller 3.9 (Cryer's glukagon/adrenalin-tærskel)? De to citater fra Cryer 2013 (linje 2528-2529 i simulator.js) angiver hhv. 3.8 (glukagon/adrenalin) og 3.2 (kortisol). 3.0 er konservativt under begge — det er en bevidst keuze.
- Hvis 3.0 er det rigtige: opdater v1's N6 prose med korrekte tal. Hvis 3.9 er det fysiologisk korrekte: ret koden.

Min vurdering: 3.0 i koden er den korrekte tærskel for "neuronal adaptation" (HAAF), mens 3.9 er tærsklen for "akut counterregulatorisk respons" (et helt andet system). De skal ikke være samme tal. Men koden burde citere kilderne entydigt.

**Severity:** ADVARSEL fordi det er en doc/code-konsistens-fejl der fik en review-forfatter (mig selv i v1) til at lave forkert kvantitativ analyse.

**STATUS:** ÅBEN

---

## [NOTE] N16 — `displayIOB` bioavScale-diskontinuitet ved 6 t cutoff (samme bug som N15 men tidsafhængig)

**Fil:** `js/simulator.js`, linje 1561-1574 (substep-loop bruger samme mønster ved linje 1818-1826)
**Subsystem:** IOB display / UI

**Observation:**
```javascript
let _injected = 0, _effective = 0;
for (const ins of this.activeFastInsulin) {
    if (this.totalSimMinutes - ins.injectionTime < 360) {
        _injected += ins.dose;
        _effective += ins.dose * (ins.bioavailability || 1.0);
    }
}
const bioavScale = _effective > 0 ? _injected / _effective : 1.0;
this.displayIOB = Math.max(0, this.iob * bioavScale);
```

Den pr-bolus rapid-PK fortsætter ud over 6 timer (særligt ved langsom tauFactor=1.6 → tauI=88 min, hvor 6 timer = 4 tau, dvs. e^-4 = 1.8% rest). Når sidste bolus krydser 6h-grænsen falder bioavScale fra ~1.28 til 1.0 i én tick — og displayIOB falder dermed med ~22% øjeblikkeligt. Reel rapid-IOB ER stadig ~0.02-0.05 E lige efter cutoff'en.

Talmæssigt er effekten lille (få tiendedel-E forskel). Men det er en synlig diskontinuitet i et tal der præsenteres til brugeren som "Insulin On Board" — og det er en visuel bug, ikke en fysiologisk.

**Forslag:** Erstat hård 360-grænse med eksponentiel vægtning (samme henfaldsprofil som plasma-rapid: ~6t halveringstid på reststand). Eller cache `bioavScale` baseret på de seneste effektivt aktive boluser uden tids-cutoff og lad pruning af `activeFastInsulin` (linje 1552: `< 6 * 60`) selv styre listen.

**Severity:** Note (UI-glat-bug, ingen fysiologisk konsekvens)

**STATUS:** ÅBEN

---

## [NOTE] N17 — `effectiveAcuteStress` evalueres OUTSIDE substep-loop, mens `effectiveProteinGlucagon` evalueres INSIDE → coupling-asymmetri

**Fil:** `js/simulator.js`, linje 1721-1722 (uden for loop) vs 1758-1759 (inde i loop)
**Subsystem:** Stress-multiplier opbygning

**Observation:**
```javascript
// LINJE 1721-1722 — evalueres ÉN gang, før substep-loop:
const effectiveAcuteStress = this.acuteStressLevel *
    (0.6 * this.glycogenReserve + 0.4);
const stressBase = glycogenBaseline + gngBaseline + effectiveAcuteStress + ...

// LINJE 1758-1759 — evalueres PER substep:
const effectiveProteinGlucagon = this.proteinGlucagonLevel *
    (0.5 + 0.5 * this.glycogenReserve);
this.hovorka.stressMultiplier = stressBase + effectiveProteinGlucagon;
```

Begge formler bruger `this.glycogenReserve` til at gate hormon-effekten på leveren. Men `effectiveAcuteStress` fryser glycogenReserve-værdien fra start af tick'et, mens `effectiveProteinGlucagon` opdaterer den hver substep.

**Konkret konsekvens:** I en typisk 5-min tick med 5 substeps á 1 min er forskellen lille — glycogenReserve ændres typisk under 1% pr. min. Men ved særlige scenarier (hypo med samtidig stort proteinmåltid og glykogen-tømning over et par timer i 240x-speed → hver tick = 4 min, glycogenReserve kan ændres 5-10% pr. tick), bliver de to leddene asynkrone i op til 1 fuld tick.

Det er ikke en fejl, kun en konsistens-asymmetri. Hvis principet er "alle hormon-gates skal evalueres med samme glycogen-snapshot", bør begge være enten inden for eller uden for løkken.

**Forslag — diskuter:** Flyt `effectiveAcuteStress`-beregningen ind i substep-løkken (linje 1758) sammen med `effectiveProteinGlucagon`. Det er den lette ændring og giver konsistent per-substep coupling. Performance-omkostningen er triviel (én multiplikation pr. substep).

**Severity:** Note (subtil, men berører review-princippet om "korrekt coupling")

**STATUS:** ÅBEN

---

## [NOTE] N18 — Cooldown-formel `(varighed - 30) × intensitet` har en tærskel-knækk ved præcis 30 min

**Fil:** `js/simulator.js`, linje 3309-3315
**Subsystem:** Post-exercise cooldown (HR-tilbagefald + heart rate UI gating)

**Observation:**
```javascript
const cooldownFactor = akt.intensitet === 'Høj' ? 0.40
                     : akt.intensitet === 'Medium' ? 0.25 : 0.15;
const cooldownMin = Math.max(0, Math.min(60,
    (actualDuration - 30) * cooldownFactor));
```

- 29 min Lav: cooldown = 0
- 30 min Lav: cooldown = 0
- 30.001 min Lav: cooldown ≈ 0
- 60 min Lav: cooldown = 4.5 min
- 60 min Høj: cooldown = 12 min
- 30 min Høj: cooldown = 0

Ved Høj 30→31 min: cooldown jumper fra 0 → 0.4 min. Discontinuity i derivativet, ikke i værdien. Ikke en bug, men en knæk der ikke afspejler fysiologien (en hård-træning på 25 min har stadig en målbar HR-recovery — sub-lineær men > 0).

**Sammenlign med:** Glycogen, FFA, ketone, og stress-hormoner bruger alle eksponentielt henfald (kontinuerte i derivat). Cooldown er det eneste motion-relaterede tidskonstant der bruger en tærskel-baseret knæk.

**Forslag — diskuter:** Erstat med eksponentiel form: `cooldownMin = max_cool × intensity_factor × (1 - exp(-duration/30))`, så 5 min Lav giver 0.13 min cooldown og 60 min Høj giver fuld cooldown. Eller behold tærskel-form (det er kalibreret efter brugeroplevelse, ikke fysiologi) og NOTÉR i kommentaren at den ikke er fysiologisk afledt.

**Severity:** Note (gameplay-baseret, ikke fysiologisk fejl)

**STATUS:** ÅBEN

---

## [NOTE] N19 — `LIVER_GLYCOGEN_MAX = 120 g` er hardcoded, ikke vægt-skaleret (modsætning til muskel-pool)

**Fil:** `js/simulator.js`, linje 922-923
**Subsystem:** Lever-glykogen massebalance

**Observation:** Lever-glykogenkapacitet er hardcoded til 120 g uafhængigt af kropsvægt:
```javascript
this.liverGlycogenGrams = 90;           // Start: 90g (normal postabsorptiv voksen)
this.LIVER_GLYCOGEN_MAX = 120;          // Max kapacitet [g]
```

Til sammenligning er muskel-glykogen vægt-skaleret:
```javascript
this.muscleGlycogenCapacity = MUSCLE_GLYCOGEN_G_PER_KG * weight; // 5.5 g/kg
```

**Litteratur:** Lever-glykogen skalerer med levermasse, som er ~2.5% af kropsvægten. Normal lever-glykogen-kapacitet:
- 50 kg voksen: ~75-90 g (Petersen 2004 lower bound)
- 70 kg voksen: ~100-130 g
- 100 kg voksen: ~140-180 g (Roden 2001 obese cohort)

**Konsekvens:** En 100 kg patient i simulatoren har samme glykogen-kapacitet som en 50 kg patient. Det betyder at den større patient når "tom pool" (= stress-EGP afbrydes) lige så hurtigt som den mindre patient — ikke fysiologisk korrekt. Effekten er lille i de fleste scenarier (90g start er tæt på max for små patienter), men kan ses ved langvarig faste eller intensiv motion hos høj-vægt-patienter.

**Forslag — diskuter:** Skalér `LIVER_GLYCOGEN_MAX = 120 × (weight/70)` (eller mere konservativt: `100 + 0.4 × (weight - 70)`). Skalér også startværdien `liverGlycogenGrams = 0.75 × LIVER_GLYCOGEN_MAX` (75% fyldt = postabsorptiv).

**Severity:** Note (vægt-præcision, lille klinisk effekt)

**STATUS:** ÅBEN

---

## [NOTE] N20 — BHB-clamp `Math.min(20.0, ...)` overstiger klinisk ekstrem-værdi (~15 mmol/L)

**Fil:** `js/simulator.js`, linje 3724
**Subsystem:** Ketone-model BHB clamp

**Observation:** `this.ketoneLevel = Math.max(0.0, Math.min(20.0, this.ketoneLevel));`

Klinisk reference (Laffel 1999, Misra 2015):
- Normal: < 0.6
- Mild DKA: 3-6
- Moderat DKA: 6-10
- Svær DKA: 10-15
- Maximum dokumenteret i levende patient: ~16-18 mmol/L (Wolfsdorf 2014)
- 20 mmol/L vil typisk være ledsaget af multi-organ-svigt og IKKE kompatibelt med viderlevende klinisk præsentation.

I praksis nås 20 aldrig i simulatoren fordi game over (BRAIN_DEFICIT eller acidosisLoad) udløses langt før — så clamp'en er bare en sikkerhedsforanstaltning. Men den anvender en urealistisk værdi. Ved BHB > 15 burde game over allerede være sket, og clamp'en burde reflektere "fysisk umuligt at nå" frem for "tag toppen af absurd".

**Forslag:** Sænk clamp til 18 mmol/L (matcher litteraturens øvre grænse for overlevelsessager). Funktionelt ingen forskel da game over altid sker først, men koden bliver et bedre referencepunkt.

**Severity:** Note (kosmetisk, ingen kørsel-effekt)

**STATUS:** ÅBEN

---

## [NOTE] N21 — `bgWeight` step-funktion ved 4.0 / 10.0 / 14.0 mmol/L giver ikke-glat point-rate (gameplay-design, men værd at notere)

**Fil:** `js/simulator.js`, linje 2137-2146
**Subsystem:** Normo-points / gameplay-scoring

**Observation:**
```javascript
let bgWeight = 0;
if (inBonusNow) bgWeight = 2;                                    // BG 5.0-6.0
else if (this.trueBG >= 4.0 && this.trueBG <= 10.0) bgWeight = 1;
else if (this.trueBG > 10.0 && this.trueBG <= 14.0) bgWeight = 0.5;
else bgWeight = 0;
```

Step-funktion ved 4.0 (0→1), 5.0 (1→2), 6.0 (2→1), 10.0 (1→0.5), 14.0 (0.5→0). En spiller hvis BG svæver omkring 10.0 vil opleve at point-raten skifter brat fra 1× til 0.5× pr. tick — visuelt vises det som hyppige pts-on/pts-half klasse-skift på badge'en.

Dette er sandsynligvis BY DESIGN (pædagogisk klar separation: "i mål", "lidt for højt", "for højt"). Men hvis der er ønske om jævnere feedback, kunne overgangene være lineære:
- 9.5-10.5: lineær interpolation 1.0 → 0.5
- 13.5-14.5: lineær interpolation 0.5 → 0.0

Note frem for advarsel fordi dette er gameplay-policy, ikke fysiologi-fejl.

**Severity:** Note (info-only)

**STATUS:** ÅBEN

---

## [NOTE] N22 — `awardLevelBonus` floor `Math.max(1.0, dayTheoreticalMax)` kan give kunstigt høj % på heavily-boxed dage

**Fil:** `js/simulator.js`, linje 4628-4629
**Subsystem:** Box Challenge level bonus

**Observation:**
```javascript
const theoreticalMax = Math.max(1.0, this.dayTheoreticalMax);
const percentage = Math.min(100, (dayPoints / theoreticalMax) * 100);
```

Floor 1.0 beskytter mod division by zero, men kan også klippe legitime lave maxer:
- dayTheoreticalMax = 0.5 (mange bokse dækker bonus + grøn): floor til 1.0
- Hvis spilleren scorer 0.5 dayPoints (alle ledige punkter taget): percentage = 50% → 1 stjerne
- Uden floor: percentage = 100% → 3 stjerner

Det er nok BY DESIGN at floor'en eksisterer (undgå at trivialisere meget korte dage), men den specifikke effekt — at en helt perfekt spillet "umulig" dag IKKE giver 3 stjerner — kan være overraskende for spilleren.

Tilsvarende kan dayTheoreticalMax = 1.5 (rimeligt boxed) give percentage = 33% selv ved fuldt-tagne 0.5 punkter — som så ikke kvalificerer til stjerne.

**Forslag — diskuter:**
- Hvis floor er BY DESIGN: dokumentér eksplicit i kommentar at "lave maxer absorberes af 1.0-floor for at undgå false-perfect-stars".
- Eller: separat regel for ekstreme dage (hvis dayTheoreticalMax < 2.0: skip bonus-vurdering helt).

**Severity:** Note (gameplay-edge-case)

**STATUS:** ÅBEN

---

## [OK] O16 — Substepping af karbohydrat-rate via Hovorka D1/D2 er numerisk stabil

Verificeret: `_substepFatProteinFFA` opdaterer `hovorka.tau_G` per substep, og `hovorka.step()` integrerer D1/D2 med samme dt ≤ 1 min. Kombineret giver det at en variabel τG (40-100+ min) ikke skaber numerisk instabilitet — det rammer ikke Euler-grænsen `dt/τ < 1` selv ved minimum τG=25 min.

---

## [OK] O17 — Per-bolus rapid PK med fælles pulsFaktor er korrekt model

Verificeret: `_substepRapidInsulin` (linje 3582-3631) bruger en delt `pulsFaktor` (motion-induceret subkutan perfusion) på alle aktive boluser. Det er fysiologisk korrekt — øget blodflow påvirker alle SC-depoter ens, uafhængigt af alder. Tidligere bekymring om "ny bolus ændrer kinetik for gammel bolus" er løst korrekt med separate (s1, s2, tauI) per bolus.

---

## [OK] O18 — Combined resistance cap 2.5 er eksplicit dokumenteret med worst-case analyse

Verificeret: Linje 1184-1188 har præcis kommentar:
> Individuelle max: stress 1.50, FFA 1.42, glucotox 1.40 → produkt op til ~3.0.
> Cap 2.5 sikrer effektiv ISF aldrig under ~40% af nominal.

Cap'en er aktiv (2.98 worst-case > 2.5), men dokumenteret. Tidligere bekymring om "skjult clipping" er ikke valid — det er bevidst designet og tydeligt kommentereret.

---

## Sammenfatning og handling

### Status-korrektioner til v1

- **v1 N6** (HAAF area-akkumulering): den kvantitative analyse er forkert pga. tærskel-forveksling. Se W7.
- **v1 N14** (Box Challenge respawn): "cob/iob nulstilles" er faktuelt forkert — se W6 for fuld liste over hvad der reelt nulstilles vs bevares.

### Anbefalet prioritering

1. **W6 (loseLife reset)** — diskuter design-intentionen først. Hvis "frisk start" er ønsket: udvid `_resetToStableBG` til at nulstille mave/tarm-pipeline. Hvis nuværende adfærd er BY DESIGN: opdater v1 N14 + tilføj UI-hint.
2. **W7 (HAAF tærskel-doc)** — opdater v1 N6 med korrekte tal (3.0-tærsklen). Ingen kode-ændring nødvendig hvis 3.0 er den ønskede neuronale-adaptation-tærskel.
3. **N17 (effectiveAcuteStress placering)** — flyt ind i substep-løkken. Triviel kode-ændring, marginal præcision-gevinst.
4. **N16 (bioavScale diskontinuitet)** — kosmetisk fix, ikke akut.
5. **N19 (lever-glykogen vægt-skalering)** — kvalitets-forbedring, ikke akut.
6. **N18, N20, N21, N22** — kosmetiske/dokumentation-forbedringer.

### Hvad er stadig stærkt

- Hovorka-kerne, basal/rapid separation, per-bolus PK: solidt, ingen nye findings.
- Carb-model (dynamisk τG), fedt-pipeline, protein-glucagon-akse: korrekt.
- Glykogen massebalance (lever + muskel): korrekt struktur, kun N19 vægt-issue.
- Keton/acidose: korrekt, kun N20 clamp-værdi-detalje.
- HAAF, glucotoxicitet, brain energy deficit, FFA-resistens: alle korrekte design.

### Generel observation

Engine'en er på et niveau hvor de fleste reelle findings nu er state-management ved respawn, edge-cases i UI-display og dokumentations-konsistens. Den centrale fysiologiske kerne kører stabilt. Næste store kvalitetsløft kommer sandsynligvis fra automatiserede tests af respawn-state-konsistens (pendant til W6) snarere end fra justering af enkelte parametre.

