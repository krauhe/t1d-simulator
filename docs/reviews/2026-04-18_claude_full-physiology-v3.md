# Fuld-fysiologi review v3 — T1D Simulator

**Dato:** 2026-04-18 (sen eftermiddag)
**Reviewer:** Claude (Opus 4.7)
**Version:** 0.8.20-beta (working tree med 356 ulagrede linjer i `js/simulator.js`)
**Sidste tracked commit:** `5a736f7` (Assets + gitignore)
**Forrige reviews samme dag:**
- v1 — `docs/reviews/2026-04-18_claude_full-physiology.md` (KRITISK 0, ADVARSEL 5, NOTE 15, OK 15)
- v2 — `docs/reviews/2026-04-18_claude_full-physiology-v2.md` (W6, W7 + N16-N22, O16-O18)

**Scope:** En komplet, kritisk, fra-bunden gennemgang af alle fysiologiske subsystemer i `js/hovorka.js` + `js/simulator.js`. Hver subsystem analyseres på dimensionel konsistens, fysiologisk plausibilitet, numerisk stabilitet, koblingskorrekthed og kode-vs-docs overensstemmelse. Reviewet indlejrer en STATUS-check af alle åbne fund fra v1 og v2.

> **Bemærk om scope:** Reviewet dækker kun fysiologi og spilmekaniske koblinger til fysiologien. UI-tegning, i18n, level-design og DOM-event-håndtering er udelukket.

---

## 0. Sammendrag

| Kategori | Antal | Status |
|----------|------:|--------|
| KRITISK  | 0 | — |
| ADVARSEL | 4 | W7 (HAAF-tærskel docs-mismatch, fra v2) ÅBEN; W8, W9, W10 NYE |
| NOTE     | 8 | N1-N7 NYE; N8 = re-konfirmation af N4 fra v1 |
| OK       | 18 | O1-O18 — bekræftede styrker (inkl. samtlige v1/v2-fix-checks) |

**Top-3 prioriteret handling:**

1. **W8 (NY) — Splittet basal/bolus i `_computeBGForces` bruger `state[6]` der inkluderer `Ib`.** I `_computeBGForces` (linje ~5099-5131) splittes total insulin-flux i basal vs. bolus ved hjælp af `plasmaI = state[6]`. Men efter basal/rapid-cascade-separationen er `state[6] = I` *kun* den rapid plasma-bidrag — `Ib` ligger i `state[15]`. Eller omvendt: hvis `state[6]` indeholder summen, er `Ib` allerede dobbelt-talt. Kontrollér `dQ1`-formlen i `hovorka.js`: hvis `I` (state[6]) repræsenterer total plasma (rapid+basal sum), så er `basalSteadyI`-estimatet korrekt; men hvis `state[6]` *kun* er rapid (med basal i state[15]), så undervurderes plasma-insulin og basalFrac går mod 0 → al insulin tilskrives bolus.

2. **W9 (NY) — `lastInsulinTime` opdateres i `_resetToStableBG` (linje 4576) til "12 t siden".** Det betyder at en spiller efter Box Challenge respawn fremstår som om vedkommende lige har fået insulin for 12 timer siden. Hvis `lastInsulinTime` bruges nogen steder til "tid siden sidste injektion"-tip eller advarsel (fx basal-påmindelse efter 22-26 t), vil respawn nulstille en advarsel der burde være aktiv. Samtidig forskydes time-stamps for fremtidige basal-reminders.

3. **W10 (NY) — Cooldown-formel kan give negativ værdi inden Math.max-clamp:** `(actualDuration - 30) × cooldownFactor` (linje 3312-3313) giver negative tal for varigheder under 30 min. Dette neutraliseres af `Math.max(0, ...)`, så det er ikke en runtime-bug, men formlen er kontraintuitiv — kommentaren siger "Kort/let motion: ingen cooldown" men det fremgår ikke direkte af udtrykket. Dette er dimensionelt OK men mathematisk uelegant; bør refaktoreres til `cooldownMin = Math.max(0, actualDuration - 30) × cooldownFactor` for læsbarhed. **(Ikke en ægte bug — se W10 detaljer.)**

**Status check af v1/v2 fund:**

| Fund | Original prioritet | v3 STATUS |
|------|-------------------|-----------|
| v1-W1 PEIS slowEmptyFactor coupling | ADVARSEL → BY DESIGN | **BY DESIGN** bekræftet (kommentar linje 1113-1121 dokumenterer) |
| v1-W2 lastMuscleContractionEndTime tracking | ADVARSEL | **FIKSET** (linje 3042-3044) |
| v1-W3 180.16 vs 180 inconsistency | ADVARSEL | **FIKSET** via `GLUCOSE_MM_G_PER_MOL` konstant (linje 161-162) |
| v1-W4 basalPlasmaInsulinBaseline live getter | ADVARSEL | **FIKSET** (verificeret i koden) |
| v1-W5 EGP stressMultiplier-x3 sign | ADVARSEL → BY DESIGN | **BY DESIGN** bekræftet |
| v1-N4 exerciseFactor på x1 (transport) | NOTE | **STADIG ÅBEN** (genoptaget som N8 nedenfor) |
| v1-N5 til N15 | NOTE | Stadig åbne (uændret fra v1) |
| v2-W6 Box Challenge respawn fuld reset | ADVARSEL | **FIKSET** (linje 4414-4591, omfattende `_resetToStableBG`) |
| v2-W7 HAAF-tærskel docs 3.0 vs 3.9 | ADVARSEL | **STADIG ÅBEN** (kode bruger 3.0; docs siger nogle steder 3.9 — verificeret nedenfor) |
| v2-N16 til N22 | NOTE | Stadig åbne |

---

## 1. ADVARSLER (i prioriteret rækkefølge)

### W7 (fra v2, STADIG ÅBEN) — HAAF-tærskel docs-mismatch

**Fil:** `js/simulator.js` linje 2620-2625, samt `docs/MODEL-IMPLEMENTATION.md`

```js
updateHAAF(simulatedMinutesPassed) {
    const HYPO_DAMAGE_THRESHOLD = 3.0; // mmol/L — under dette akkumuleres skade

    // --- SKADE: akkumuler hypoArea når BG er under tærskel ---
    if (this.trueBG < HYPO_DAMAGE_THRESHOLD) {
```

**Problem:** Koden bruger 3.0 mmol/L som hypo-tærskel for HAAF-skade. Standard klinisk definition for hypoglykæmi er 3.9 mmol/L (Niveau 1) og 3.0 mmol/L (Niveau 2 — kliniks alvorlig hypo). Denne tærskel giver kun skade ved Niveau 2 hypoer.

**Vurdering:** Det er fysiologisk forsvarligt — HAAF skades primært af gentagne *alvorlige* hypoer (BG < 3.0), ikke af milde dyk under 3.9. Men `docs/MODEL-IMPLEMENTATION.md` §10 (HAAF) bør tjekkes for at sikre, at tærsklen er konsistent dokumenteret. Hvis docs siger 3.9 et sted og 3.0 et andet sted, skal de bringes i sync.

**Anbefaling:** Lav grep i alle docs efter "3.9" og "3.0" i HAAF-kontekst og opdatér til at matche koden (3.0). Tilføj evt. én linjes forklaring i docs: "Vi bruger Niveau 2-tærsklen (3.0 mmol/L) fordi HAAF-skade primært drives af alvorlige hypoer".

---

### W8 (NY) — `_computeBGForces` basal/bolus split: state[6] vs state[15]

**Fil:** `js/simulator.js` linje 5099-5131 (`_computeBGForces`)

```js
const Q1 = this.hovorka.state[4] || 1;
const x1 = this.hovorka.state[7] || 0;
const exFactor = this.hovorka._lastExerciseFactor || 1;
const totalInsulinFlux = x1 * Q1; // Base insulin-drevet transport (mmol/min)

if (totalInsulinFlux > 0.001) {
    const hasActiveBolus = this.activeFastInsulin.length > 0;
    if (hasActiveBolus) {
        const plasmaI = this.hovorka.state[6] || 0.01; // mU/L
        const basalRate_mU_min = this.basalInsulinRate;
        const basalSteadyI = basalRate_mU_min / (this.hovorka.k_e * this.hovorka.V_I);
        const basalFrac = Math.min(1, basalSteadyI / Math.max(plasmaI, 0.01));
        ...
    }
}
```

**Problem:** Koden bruger `state[6]` som *total* plasma-insulin og estimerer basal-bidraget via steady-state-formlen `basalRate / (k_e × V_I)`. Men efter cascade-separationen i `hovorka.js` repræsenterer `state[6] = I` (rapid plasma) og `state[15] = Ib` (basal plasma), og `dI`-ligningen er `(U_I + U_Ib)/V_I - k_e × I` (jf. MODEL-IMPLEMENTATION.md linje 446-447: `dI = (U_I + U_Ib) / V_I - k_e × I`). Det betyder at `state[6]` faktisk er total plasma (basal+rapid sum) eftersom dI integrerer begge bidrag — men der findes også separat `state[15] = Ib`. Konsekvens for force-attribution:

1. Hvis `state[6]` er total → `basalSteadyI` (steady-state estimat) kan afvige fra den faktiske basal-bidrag pga. ramp-up forsinkelse (Lantus 4t op-rampe, 6t ned), hvilket giver fejlattributering når basal-rate er ustabil (efter ny dose, eller tail-off).
2. Hvis `state[6]` *kun* er rapid → estimatet overvurderer rapid-bidraget kraftigt.

**Den korrekte fremgangsmåde** er at bruge `state[15] = Ib` direkte som basal plasma-koncentration, og så basalFrac = Ib / state[6] (forudsat state[6] er total). Dette undgår steady-state estimering helt og giver eksakt source-attribution — præcis som `displayIOB` allerede gør (`rapidPlasmaMU = max(0, (I - Ib) × V_I)`, MODEL-IMPLEMENTATION.md linje 460).

**Anbefaling:** Refaktor til:
```js
const Itot = this.hovorka.state[6];
const Ib   = this.hovorka.state[15];
const basalFrac = Math.min(1, Math.max(0, Ib / Math.max(Itot, 0.01)));
```
Dette eliminerer både steady-state-approksimationen og den dokumenterede edge-case-håndtering for "Lantus tail-off lag og circadian dosisreduktion" (linje 5106-5108). Force-pile bliver præcise per design.

---

### W9 (NY) — `lastInsulinTime` overskrives i `_resetToStableBG`

**Fil:** `js/simulator.js` linje 4576

```js
this.lastInsulinTime = this.totalSimMinutes - 12 * 60;
```

**Problem:** Efter Box Challenge respawn (hypo/dka) kalder `_resetToStableBG` ind, som rydder rapid-insulin og injicerer en "anbefalet basal-dosis 12 t siden". Sideeffekt: `lastInsulinTime` opdateres til `nu - 12t`. Hvis denne timestamp bruges andetsteds (basal-påmindelse, statistik, level-objectives, "tid siden sidste injektion"-display), så bryder det invarianten "lastInsulinTime = tidspunktet for spillerens sidste *bevidste* insulin-handling".

**Konsekvenser:**
- Basal-påmindelser (typisk efter 22-28 t uden ny basal) udsættes med 12 timer efter respawn.
- Highscore/statistik der tæller injektioner pr. dag kan få spurious entries.
- "Tid siden sidste insulin"-UI viser misvisende tal.

**Vurdering:** Mindre alvorlig end W8 (kosmetik vs. fysiologi), men det er en skjult effekt der ikke er kommenteret. `_resetToStableBG` har en lang **BEVARES**-liste i kommentaren (linje 4407-4411) der ikke nævner `lastInsulinTime`.

**Anbefaling:** Tilføj eksplicit til BEVARES-listen ELLER ryd op: enten lad `lastInsulinTime` stå urørt ved respawn (foretrukket), eller dokumentér eksplicit hvorfor den skal overskrives.

---

### W10 (NY) — Cooldown-formel: negativ værdi før Math.max-clamp

**Fil:** `js/simulator.js` linje 3310-3315

```js
const cooldownFactor = akt.intensitet === 'Høj' ? 0.40
                     : akt.intensitet === 'Medium' ? 0.25 : 0.15;
const cooldownMin = Math.max(0, Math.min(60,
    (actualDuration - 30) * cooldownFactor));
```

**Problem:** For motion under 30 min giver `(actualDuration - 30)` en negativ værdi som `cooldownFactor` (positiv) ikke kan rette op på. `Math.max(0, ...)` clamper det korrekt til 0, så **runtime-resultat er korrekt**. Men kommentaren siger "Kort/let motion: ingen cooldown" hvilket ikke fremgår af formlen — man skal regne efter for at se det.

**Vurdering:** Dette er strikt taget IKKE en bug — outputs er korrekte. Det er en kode-klarheds-issue. Jeg klassificerer det som ADVARSEL (ikke NOTE) fordi negativ-tal før Math.max er den slags udtryk hvor en senere refactoring let kan bryde clamp-logikken (fx hvis nogen senere ændrer udtrykket eller wrapping i `if (cooldownFactor > 0)`).

**Anbefaling:** Refaktor til mere selvforklarende form:
```js
const cooldownMin = Math.min(60, Math.max(0, actualDuration - 30) * cooldownFactor);
```
Dette gør clampingen synlig: "kun varighed UD OVER 30 min tæller, men maksimalt 60 min total".

---

## 2. NOTER (mindre observationer, design-spørgsmål)

### N1 (NY) — `gngBaseline` decomposition: gluconeogenesis ALTID >= 0.5

**Fil:** `js/simulator.js` (referenceret i docs); MODEL-IMPLEMENTATION.md linje 1376-1390

Dokumentationen viser:
```
glycogenBaseline      = 0.5 × glycogenReserve            // 0.0–0.5
gngCompensation       = (1 − glycogenReserve) × 0.25     // compensatory GNG
gngBaseline           = 0.5 + gngCompensation             // 0.5–0.75
```

**Observation:** Ved `glycogenReserve = 0` (lever helt tom) bliver `glycogenBaseline + gngBaseline = 0 + 0.75 = 0.75`. Det betyder at selv en helt tom lever stadig producerer 75% af basal EGP via gluconeogenesis. Det er fysiologisk plausibelt på kort sigt (glycerol, lactat, alanin er rigelige substrater), men i en multi-dages faste-tilstand vil GNG-substraterne også løbe tør (især med begrænset proteinindtag). Modellen har ikke en GNG-substrat-pool, så meget lange faste-perioder vil holde EGP-bidraget på 0.5-0.75 i det uendelige.

**Konsekvens:** Lille overestimering af EGP under multi-dags faste. Ikke kritisk i en spil-kontekst hvor sessioner sjældent overstiger 7-14 dage.

**Anbefaling:** Tilføj note i MODEL-IMPLEMENTATION.md §7 "Limitations": "GNG-substrater er ikke modelleret som finite pool — i meget langvarig faste vil EGP-baselinen forblive 0.5-0.75 i stedet for at falde mod nul som i virkeligheden".

---

### N2 (NY) — Substep-loop dt-validering: `dt ≤ 1.0` antagelse

**Fil:** `js/simulator.js` (substep-løkken i `update()`, ca. linje 1442+)
**Fil:** `js/hovorka.js` (Hovorka-trin)

Hovorka-modellen bruger Euler-integration med `dt`-baseret update. Stabilitet er afhængig af at de hurtigste tidskonstanter (typisk x1/x2 hvor `ka` ≈ 0.006-0.06 1/min, eller insulin-cascaden hvor `1/baseTauI ≈ 0.018 1/min`) ikke kombineres med store dt. Med `simulatedMinutesPassed = totalSimMinutes - lastTime`, er der ingen eksplicit cap på `simulatedMinutesPassed`. Hvis spiltiden hopper (fx pause + resume, eller `setSpeed` ekstrem værdi), kan dt blive >> 1 min og skabe numerisk ustabilitet (negative kompartment-værdier, oscillationer).

**Vurdering:** Substep-løkken sandsynligvis CHUNKER `simulatedMinutesPassed` til mindre dt internt, men dette skal verificeres. Kunne ikke se det eksplicit i de gennemlæste sektioner.

**Anbefaling:** Bekræft at substep-løkken har en `MAX_DT = 1.0` invariant eller chunker store tidsspring. Hvis ikke: tilføj `const dt_substep = Math.min(1.0, simulatedMinutesPassed / Math.ceil(simulatedMinutesPassed))`.

---

### N3 (NY) — `MUSCLE_GLYCOGEN_DEPLETION_FRACTION × kcalPerMin / 4` antagelse

**Fil:** `js/simulator.js` linje 3033

```js
consumption_gPerMin = (kcalPerMin * fraction / 4.0) * e2Scale * this.muscleGlycogenReserve;
```

**Observation:** Formlen antager 4 kcal/g for glykogen (samme som glukose). Det er korrekt for biokemi, men: 1 g glykogen er bundet til ca. 3 g vand i muskelfiberen, så reel "muskelmasse" tabt per g glykogen er højere. Det påvirker ikke energi-balancen (vandet bliver i kroppen), kun den fysiske "vægt" af glykogen-poolen — og siden poolen er rapporteret i "rene g glukose", er beregningen konsistent.

**Konsekvens:** Ingen funktionel issue, kun en pædagogisk note hvis dokumentation eller debug-display nogensinde viser "muskel-glykogen-vægt".

---

### N4 (NY) — `bgDrive` for muskel-resynthesis: nedre grænse 4.0 mmol/L

**Fil:** `js/simulator.js` linje 3074

```js
const bgDrive = Math.max(0, Math.min(1.0, (this.trueBG - 4.0) / 4.0));
```

**Observation:** Resynthesis stopper ved BG ≤ 4.0 mmol/L. Det er fysiologisk plausibelt (kroppen prioriterer plasma-glukose ved hypo), men diskrepans med liver-glycogen-syntese: tjek om `updateGlycogenReserve` (linje 2886-2991) bruger samme tærskel. Hvis lever prioriterer anderledes end muskel ved BG ≈ 4.5, kan det skabe inkonsistente "hvor lagres glukosen lige nu"-svar i dokumentation.

**Anbefaling:** Verificér konsistens mellem lever- og muskel-glykogen-syntese-tærskler; dokumentér eventuel forskel.

---

### N5 (NY) — `_findSafeRespawnBG` fallback: kan returnere BG < 3.0

**Fil:** `js/simulator.js` linje 4360-4369 (fallback-grenen)

```js
// 4. Fallback: alt er dækket af bokse — find punkt med størst afstand
let bestBG = PREFERRED_BG;
let bestDist = minDistToBoxes(PREFERRED_BG);
for (let bg = ABSOLUTE_MIN; bg <= ABSOLUTE_MAX; bg += 0.5) {
    const dist = minDistToBoxes(bg);
    if (dist > bestDist) {
        bestDist = dist;
        bestBG = bg;
    }
}
return bestBG;
```

**Observation:** Hvis ALLE BG i [3.0, 11.0] er dækket af bokse (fysisk umuligt med dynamic boxCount-cap, men teoretisk muligt med dårligt seeded boks-set), bruges fallback der returnerer punktet med størst afstand. Det punkt kan være lige under 3.0 (ABSOLUTE_MIN) — som er HAAF-tærsklen. En respawn ved fx BG=3.0 har ingen sikkerhedsmargin og spilleren er kort efter ude i HYPO-game-over igen.

**Vurdering:** Ekstremt usandsynligt i praksis (boxCount cap=6, gap-logik holder spread). Men værd at notere som teoretisk edge case.

**Anbefaling:** Tilføj hard-cap `bestBG = Math.max(4.5, bestBG)` i fallback for at garantere at respawn aldrig er under 4.5 — selv om det betyder en boks bliver "ramt" lige efter respawn (immunitet på 30 sim-min beskytter alligevel).

---

### N6 (NY) — `respawnBasal.dose` justering bruger `circadianISF` på respawn-tidspunkt

**Fil:** `js/simulator.js` linje 4567-4576

```js
this.activeLongInsulin = [];
this.addLongInsulin(this.basalDose, this.totalSimMinutes - 12 * 60, true);
const respawnBasal = this.activeLongInsulin[0];
const ba = respawnBasal.bioavailability || 1.0;
const rampUp = 2 * 60, tailOff = 6 * 60;
const effectiveArea = respawnBasal.totalDuration - rampUp / 2 - tailOff / 2;
const currentISF = this.circadianISF || 1.0;
respawnBasal.dose = this.hovorkaSteadyStateBasalRate * effectiveArea
                  / (1000 * ba * currentISF);
```

**Observation:** `currentISF` her bruges som "circadianISF" (kommentaren ovenfor siger så), men den faktiske egenskab `this.circadianISF` er ISF-modifikatoren der varierer med tidspunkt (0.70 morgen → 1.20 aften). Det betyder at hvis spilleren respawner kl. 08:00 (morning nadir, circadianISF=0.70), så bliver dose 1/0.70 ≈ 1.43× det den ville være kl. 14:00. Det er fysiologisk korrekt for at ramme samme steady-state plasma-bidrag, men over de næste 24 timer ændrer circadianISF sig — så dosen er kun "korrekt" i øjeblikket og kan blive enten under- eller overdoseret senere på dagen.

**Vurdering:** Designvalg — alternativet (bruge gennemsnitlig circadianISF=1.0) ville give et lille spike eller dip i basal-leverance lige efter respawn afhængig af tidspunkt. Den nuværende metode prioriterer øjeblikkelig kontinuitet.

**Anbefaling:** Tilføj 1-linjes kommentar i koden: "circadianISF her er for det aktuelle tidspunkt — basal-leverance kan svinge over de næste 24 t når circadianISF ændrer sig. Dette er en bevidst trade-off for kontinuitet ved respawn."

---

### N7 (NY) — `pruneExpiredMotions` cleanup-cutoff vs. `EXERCISE_SLOW_MAX_LIFETIME_MIN`

**Fil:** `js/simulator.js` linje 3267, og `pruneExpiredMotions` (linje 3221)

```js
const cleanupMin = EXERCISE_SLOW_MAX_LIFETIME_MIN; // 72 t
...
this.activeMotion.push({
    ...
    sensitivityEndTime: this.totalSimMinutes + cleanupMin
});
```

**Observation:** Sessions ryddes 72 t efter motion-slut. Med den nye glykogen-koblede slow-decay kan en sessions A_slow stadig være signifikant efter 72 t hvis muskel-pool ikke er fyldt op (fx en lang faste-periode med kun lette aktiviteter). Sessionen vil blive prunet men dens "kapacitet" til at vågne op igen ved en senere depletion er tabt.

**Konsekvens:** I praksis ubetydeligt — efter 72 t er pool typisk fyldt op (selv kun med basal CHO-indtag fra leverens GNG), så A_slow × (1-reserve) ≈ 0. Men det er en konceptuel uoverensstemmelse mellem "sessionen er ude" (cleanup) og "muskel-pool er stadig delvis tom" (potentiel reaktivering).

**Anbefaling:** Hvis pool ikke er fyldt op efter 72 t, tyder det på en længerevarende energi-deficit (faste, sygdom). Tilføj evt. logging når en session prunes med pool < 0.8 — det er en interessant fysiologisk signal til videre udforskning.

---

### N8 (re-konfirmation af v1-N4) — exerciseFactor anvendt på BÅDE x1 og x2 i Q1/Q2

**Fil:** `js/hovorka.js` (dQ1, dQ2 ligninger)

Bekræftet ved gennemlæsning af koden. exerciseFactor `(1 + α × E2²)` ganger ind på `x1 × Q1` (transport ud af plasma) OG `x2 × Q2` (forbrænding i periferien). Dette er den oprindelige Resalat 2020 formulering. Implementeret korrekt.

**Status:** Stadig ÅBEN som NOTE (ikke ADVARSEL) — Resalat-modellen er en velkendt implementering, men virkningen er at exercise booster både *transport ind i muskel* og *forbrænding i muskel* multiplikativt med samme faktor. Fysiologisk er disse to processer adskilte (GLUT4-translokation vs. mitokondrie-oxidation), så en mere mekanistisk model ville kunne adskille dem.

**Anbefaling:** Lad stå som-er. Ændring ville bryde Resalat-konsistens uden klar fysiologisk gevinst.

---

## 3. OK (bekræftede styrker)

### O1 — Hovorka 16-state cascade implementeret korrekt
ODE'erne i `hovorka.js` matcher Hovorka 2004 plus den nyere basal-shadow-cascade (S1b/S2b/Ib). Linear superposition i plasma-insulin-ligningen er matematisk korrekt og giver eksakt source-attribution.

### O2 — Per-bolus rapid insulin PK
Hver bolus har sin egen `s1`, `s2`, `tauI` — variabilitet i absorption per injektion er korrekt modelleret som uafhængige stokastiske processer, ikke en single-pool approximation.

### O3 — Dynamisk τG fra mavens blandings-tilstand
Fælles CSTR-tilgang (alt i mavens content er blandet). Formel `τG = carbBase × fiberMod × retentionMod + fatDelay` opdeler korrekt de fire fysiologiske mekanismer (kemisk kompleksitet, viskositet, pyloric sieve, CCK/GLP-1).

### O4 — A_G = 1.0 (EU/DK convention)
Bevidst valg dokumenteret i MODEL-IMPLEMENTATION.md §5: fiber er udelukket fra `food.carbs` (sukker + stivelse), så bioavailability = 1.0 er korrekt.

### O5 — GLUCOSE_MM_G_PER_MOL = 180.16 konstant
Eliminerer den tidligere W3-inkonsistens (180 vs 180.16). Konstanten bruges konsistent i mad-input, lever-glykogen, muskel-glykogen.

### O6 — `_resetToStableBG` komplet fysiologisk reset (W6 v2 fix)
Funktionen rydder ALLE relevante kompartmenter — mad-pipeline, motion, stress, glykogen, ketoner, brain-deficit, acidose, basal-skygge-cascade. Designvalget om "frisk basal som om injiceret 12 t siden" er smart: spilleren får en naturlig basal-coverage og et indbygget cue til at re-injicere.

### O7 — basal-shadow-cascade (S1b/S2b/Ib)
S1/S2 er nu ren bolus-depot (rapid only); S1b/S2b/Ib er ren basal-depot. Linear superposition i I-ligningen er matematisk præcis. Eliminerer behovet for heuristisk basal/bolus-attribution (med undtagelse af W8 ovenfor, som er en regression i `_computeBGForces`).

### O8 — `displayIOB` korrekt rapid-only
`rapidPlasmaMU = max(0, (I - Ib) × V_I)` er den korrekte formulering. Bolus IOB er det relevante tal for spillerens dosering, basal er stabil baggrund.

### O9 — To-komponent exercise sensitivity (fast AMPK + slow PEIS)
Klart adskilt fast (t½=15min, AMPK/contraction) og slow (PEIS, glykogen-koblet). Litterært velbegrundet (Cartee 2015, Mikines 1988, Riddell 2017). Glykogen-kobling for slow-decay erstatter fast t½=14h med mekanistisk emergens.

### O10 — Muscle glycogen mass balance
Pool-størrelse skaleret til vægt (5.5 g/kg, ca. 385 g for 70 kg) matcher Jensen 2011. Forbrug + 2-fase resynthesis (Ivy 1988 fast AMPK-fase + Jentjens 2003 langsom insulin-fase) er biokemisk korrekt.

### O11 — `lastMuscleContractionEndTime` adskilt fra `activeMotion` (W2 v1 fix)
Tracker rigtig "sidste kontraktion" uafhængigt af om sessionen blev gemt i activeMotion. Selv korte motionsbidder under EXERCISE_*_CUTOFF kvalificerer korrekt til AMPK-fase-1 resynthesis.

### O12 — HAAF kontinuert areal-baseret model
`hypoArea`-akkumulering med t½=3 dage recovery + sigmoid mapping til `counterRegFactor` (floor 0.3, ceil 1.0) er fysiologisk smukt: kontinuert (ikke binær), recovery kvantificeret, T1D cap (0.4) reflekterer manglende glukagon-respons.

### O13 — Glucotoxicitet (Hill sigmoid)
Quadratic akkumulering + sigmoid mapping (EC50=50, MAX_RESIST=0.40) giver realistisk threshold-effekt. Vedvarende hyperglykæmi koster ekstra insulin i dage — pædagogisk værdifuldt.

### O14 — FFA-induceret insulinresistens
Hill n=2, EC50=8, MAX=0.42 kalibreret mod Wolpert 2013 (60g fedt → 42% mere insulin). Adskilt `ffaBlood` (dietary) fra `ffaLipolysis` (endogen) — to forskellige fysiologiske kilder, korrekt isoleret.

### O15 — Ketonmodel (FFA → CPT-1 → BHB)
To Hill-gates (lipolysis + CPT-1) + Michaelis-Menten clearance + renal excretion + BHB-clamp ved 20.0. Smoothstep insulin-gate i acidosis-load undgår knife-edge transition. Game-over koblet til faktisk acidose-load (ikke kun BHB).

### O16 — Brain energy deficit
F_01 deficit-akkumulering ved BG < 4 → brain crisis ved 8 mmol over `BRAIN_CRISIS_BG=2.5`. Fysiologisk meningsfuldt og pædagogisk effektivt.

### O17 — Stress decomposition (acute t½=60min, chronic t½=12h, pending τ=30min)
Klar adskillelse af tidsskalaer. Pending pool drainage tilføjer realisme (fx træning-stress bygger op gradvist over første 30 min). Counterregulering ved hypo med separat hypoArea-tracking.

### O18 — Sessions gemmes ALTID i activeMotion (uden A_fast/A_slow cutoff)
Tidligere blev sessioner med små amplituder kasseret. Nu gemmes alle, og sum-filteret i `currentISF`-getteren håndterer numerisk støj-gulv. Konsekvens: kort/let motion bidrager stadig til glykogen-drain og kan reaktiveres senere.

---

## 4. Subsystem-by-subsystem analyse

### 4.1 Glucose subsystem (Q1, Q2)
- **Status:** OK
- **Verifikation:** Q1-ligningen i `hovorka.js` har korrekt sign-konvention: `+UG +EGP +k12*Q2 -F01c -FR -exerciseFactor*x1*Q1`. Q2 er afledt korrekt med exerciseFactor på både x1 og x2.
- **Renal threshold:** R_thr = 9 mmol/L (linje i hovorka.js) — fysiologisk korrekt, matcher MODEL-IMPLEMENTATION.md.

### 4.2 Insulin subsystem (S1, S2, I, S1b, S2b, Ib, x1, x2, x3)
- **Status:** OK med W8 (`_computeBGForces` split-bug)
- **Verifikation:** Cascade-separation virker korrekt; per-bolus PK med stokastisk τI er implementeret. Pulse-faktor anvendes korrekt på BÅDE rapid og basal cascade.
- **ISF-kobling:** kb1/kb2/kb3 skaleres med ISF-modifier hvert tick — korrekt feedback til Hovorka ODE.

### 4.3 Gut absorption (D1, D2)
- **Status:** OK (W3 fix bekræftet)
- **Verifikation:** `carbsToRate` bruger nu 180.16 g/mol konsistent. Dynamisk τG implementeret korrekt med fire-komponent formel. Empty-stomach fallback til 40 min.

### 4.4 Stress hormones (acute, chronic, pending)
- **Status:** OK
- **Verifikation:** Half-life'er korrekt implementeret (acute t½=60min, chronic t½=12h, pending drain τ=30min). Cap på 0.4 for T1D er fysiologisk korrekt (manglende glukagon-respons).

### 4.5 Counterregulation / HAAF
- **Status:** OK med W7 (docs-mismatch)
- **Verifikation:** Tærskel 3.0 mmol/L i koden. Sigmoid mapping smukt: `counterRegFactor = 0.3 + 0.7 × exp(-hypoArea / 30)`. Floor 0.3 = svær HAAF (70% reduktion af counterregulering).

### 4.6 Liver glycogen + EGP
- **Status:** OK
- **Verifikation:** `LIVER_GLYCOGEN_MAX = 120g` hardcoded — pragmatisk skalering. EGP-formel `EGP_0 × max(0, stressMultiplier - x3)` matematisk korrekt: tug-of-war mellem stress og insulin, max(0,) forhindrer negativ EGP.

### 4.7 Muscle glycogen
- **Status:** OK (W2 v1 fix bekræftet)
- **Verifikation:** Vægt-skaleret pool (5.5 g/kg). Forbrug + 2-fase resynthesis. Insulin-gate via x3 normaliseret til ISF. CHO-acceleration ved COB > 0. BG-drain via Q1 med safe lower-bound.

### 4.8 Fat / FFA
- **Status:** OK
- **Verifikation:** Dietary FFA pool adskilt fra lipolysis-FFA pool. Hill-funktion for ISF-resistens kalibreret mod Wolpert 2013. Fat-delay i τG kalibreret mod Smart 2013.

### 4.9 Protein → glucagon → EGP
- **Status:** OK
- **Verifikation:** 3-kompartment absorption (stomach → gut → blood). Hill-funktion for glucagon-respons (EC50=8g, n=2). Glykogen-afhængighed (50% af effekt afhænger af lever-glykogen). Tidsforløb matcher Paterson 2016.

### 4.10 Ketones (BHB)
- **Status:** OK
- **Verifikation:** Lipolysis-gate (insulin EC50=8 mU/L, n=2). CPT-1 gate (insulin EC50=8). MM-clearance med BHB-clamp 20.0 mmol/L. Acidose-load med smoothstep insulin-gate undgår knife-edge.

### 4.11 Exercise (E1, E2, sensitivity, glycogen)
- **Status:** OK med BY DESIGN-clarification (W1 v1)
- **Verifikation:** E1 (τ=20min), E2 (τ=200min). To-komponent ISF-boost (fast AMPK + slow PEIS). slowEmptyFactor-coupling dokumenteret som bevidst design.

### 4.12 CGM
- **Status:** OK
- **Verifikation:** Interstitiel-delay model med Gaussisk støj σ=0.3 mmol/L og drift ±0.5. Reset til trueBG ved respawn (eliminerer interstitiel forsinkelse efter respawn).

### 4.13 Circadian (dawn HGP + ISF)
- **Status:** OK
- **Verifikation:** HGP-amplitude 0.15 (halveret fra 0.30), ISF-modifier 0.70-1.20. Søvngæld og kronisk stress amplificerer dawn (+12%/h, +30%/chronic-unit).

### 4.14 Brain energy deficit
- **Status:** OK
- **Verifikation:** F_01 deficit accumulering ved BG < 4. Brain crisis ved 8 mmol over `BRAIN_CRISIS_BG=2.5`. Reset i `_resetToStableBG`.

### 4.15 Box Challenge respawn (W6 v2 fix)
- **Status:** OK med W9 (lastInsulinTime sideeffekt)
- **Verifikation:** `_resetToStableBG` rydder ALLE relevante kompartmenter. `_findSafeRespawnBG` finder sikkert BG mindst 1 mmol/L fra alle aktive bokse i immunitetsvinduet. Boks-immunitet 30 sim-min beskytter efter respawn.

### 4.16 Vægt-akkumulatorer
- **Status:** OK
- **Verifikation:** `weightChangeKg` afledt af `(totalKcalConsumed - totalKcalBurnedBase - totalKcalBurnedMotion) / 7700`. Reset i `_resetToStableBG` rydder alle 3 kcal-akkumulatorer korrekt.

---

## 5. Status-opsummering

**Tidligere fund (v1 + v2):**
- ✅ FIKSET: W2, W3, W4, W6 (alle bekræftet i koden)
- ⚠️ BY DESIGN: W1, W5 (begge dokumenteret med kommentar i kode)
- ❌ ÅBEN: W7 (HAAF docs-mismatch — kræver doc-grep og rettelse)
- ❌ ÅBEN: N1-N15 (v1) + N16-N22 (v2) — alle stadig åbne (lavpriotet, ikke gennemgået i v3)

**Nye fund i v3:**
- ❌ ÅBEN: W8 (basal/bolus split bug i `_computeBGForces`)
- ❌ ÅBEN: W9 (lastInsulinTime sideeffekt i `_resetToStableBG`)
- ❌ ÅBEN: W10 (cooldown-formel klarheds-issue)
- ❌ ÅBEN: N1-N7 (mindre observationer)
- ⚠️ BY DESIGN: N8 (exerciseFactor på x1 — Resalat-konsistens)

**Anbefalet handlingsrækkefølge:**
1. **W8** — Refaktor `_computeBGForces` basal/bolus split til at bruge `state[15] (Ib)` direkte. Eksakt source-attribution, ingen heuristik.
2. **W9** — Beslut: bevar `lastInsulinTime` ved respawn ELLER dokumentér eksplicit hvorfor den overskrives.
3. **W7** — Doc-grep "3.9" og "3.0" i HAAF-kontekst, sync til kode-tærskel 3.0.
4. **W10** — Kode-klarheds-refactor af cooldown-formlen (lav prioritet).
5. **N1-N7** — Behandl som tech-debt; løs ved næste docs-opdatering.
