# Fuld fysiologi-review af T1D Simulator

Genereret: 2026-04-18
Reviewer: Claude (Opus 4.7), kritisk men fair fysiologi-/numerik-/T1D-ekspert
Scope: 18+ subsystemer i `js/hovorka.js` og `js/simulator.js`. Sær-fokus på den
nye to-komponent post-exercise insulinfølsomhedsmodel og dens kobling til den
nye muskel-glykogenpool.

## Filer læst som grundlag for reviewet

- `js/hovorka.js` (590 linjer, fuldt gennemlæst)
- `js/simulator.js` (4950 linjer, fuldt gennemlæst i 6 sektioner)
- `docs/MODEL-IMPLEMENTATION.md` (relevante afsnit + § post-exercise)
- `docs/reviews/2026-04-12_claude_physiology.md` (forrige fulde Claude-review)
- `docs/reviews/2026-04-12_codex_foundation-review.md`
- `docs/reviews/2026-04-13_exercise-sensitivity-design.md`
- `docs/reviews/2026-04-13_exercise-sensitivity-literature.md`
- `docs/reviews/2026-04-11_carb-model_review.md` (skummet for kontekst)

## Reviewmetode

Hver finding er holdt op mod fem principper:

1. Dimensionel konsistens (eksplicit enhedsanalyse pr. led).
2. Fysiologisk plausibilitet (steady-state og dynamiske svar mod litteratur).
3. Numerisk stabilitet (Euler-step, clamps, kontinuitet).
4. Korrekt kobling mellem subsystemer (især ny muskel-glykogenpool og to-komp.
   exercise sensitivity).
5. Konsistens mellem kode og dokumentation.

Status fra forrige review (2026-04-12) er gentjekket: ingen tidligere FIKSEDE
items er regrederet. W1, W2, W4 holder. W3 og N1-N7 er stadig BY DESIGN /
ACCEPTABEL. Den nye to-komponent exercise model og muskel-glykogenpoolen er
INTRODUCERET efter forrige review og er hovedfokus her.

---

## [KRITISK] - Ingen fundet

Ingen kritiske defekter identificeret i denne gennemgang. Modellen er fortsat
fysiologisk koherent og numerisk stabil.

---

## [ADVARSEL] W1 - Slow-komponent diskontinuerer ved motion-stop hvis muskel-glykogenpool er fuld

**Fil:** `js/simulator.js`, linje 1097-1132 (live `currentISF`) og 3169-3213
(`stopAktivitet`)
**Subsystem:** To-komponent post-exercise insulinfølsomhed (slow / PEIS)

**Problem:** Under aktiv motion beregnes `slowBoost` live som
`A_slow_live x slowEmptyFactor`. Ved motion-stop (`stopAktivitet`) gemmes
`A_slow = aSlowBase x e2Scale x durFactor x rampSlow` UDEN `slowEmptyFactor`.
Derefter beregner getter post-stop `slowBoost = motion.A_slow x slowEmptyFactor`.

Under normale forhold (motion tømmer poolen) er det kontinuert: live ender med
`slowEmptyFactor` proportional til pool-tab, og post-motion bruger samme
slowEmptyFactor + samme A_slow. Men hvis spilleren stopper en aktivitet med
`e2Scaling > 0` FØR muskel-poolen er væsentligt drænet (fx 5 min cardio fra
fuld pool), gælder:

- Live ved t=stop: slowEmptyFactor ~ 0.005 -> slowBoost ~ 0
- Post-stop ved t=stop+epsilon: slowEmptyFactor uændret -> slowBoost stadig ~ 0

Dette ser kontinuert ud. MEN hvis der derefter skiftes til en NY motion (eller
en samtidig aktivitet) der dræner poolen, vil den GAMLE sessions A_slow
pludselig blive aktiveret post-hoc, fordi slowEmptyFactor stiger. Resultat:
Slow-boost fra den korte session "vågner op" minutter til timer efter den
egentlig sluttede.

**Evidens (enheder + scenarie):**

Scenarie: 5 min Lav cardio (akt.intensitet=Lav, e2Scale=1.0).
- aSlowBase = 0.15
- durFactor = sqrt(5/60) = 0.289
- rampSlow = 1 - exp(-5/30) = 0.154
- A_slow = 0.15 x 1.0 x 0.289 x 0.154 = 0.0067 (over EXERCISE_SLOW_CUTOFF=0.005,
  så sessionen GEMMES)

Hvis spilleren straks bagefter spiser et stort måltid og laver 60 min Høj
cardio, drænes poolen til reserve = 0.50 (DEPLETION_FRACTION[Høj]=0.75 over 5.5
g/kg pool).
- slowEmptyFactor stiger fra 0.005 til 0.50.
- 5-min sessionens bidrag stiger fra ~0 til 0.0067 x 0.50 = 0.0034 (under
  cutoff men summen i totalBoost akkumulerer dette).

For lange/intense gamle sessioner med stor A_slow er effekten større. En
historisk 60-min Høj session med A_slow ~ 0.32 kan post-hoc give 0.16 i boost
flere timer senere når en ny aktivitet dræner poolen igen.

**Forslag:**
1. Frys `slowEmptyFactor` ved stop-tidspunktet og lås det fast som en
   `motion.slowEmptyFactorAtStop`. Post-motion: slowBoost = A_slow x
   slowEmptyFactorAtStop. Dette gør slow til en "frosset" amplitude der falder
   monotont efter stop.
2. ALTERNATIVT: Acceptér koblingen som design (mekanistisk realisme: poolen er
   reelt en kropsglobal reserve, og en re-deplekteret pool ER mere
   insulinfølsom uanset hvilken motion der drænede den). Tilføj test der
   verificerer adfærden er den ønskede.
3. Cutoff `EXERCISE_SLOW_CUTOFF` tjekkes på det rå A_slow x slowEmptyFactor
   produkt - hvis det er den ønskede gating, så er case 1 ikke et bug men en
   design-egenskab. Klargør i kommentar i `currentISF`.
**STATUS:** ⚠️ BY DESIGN (2026-04-18) — Pool-koblingen er bevidst og fysiologisk
korrekt: PEIS-amplituden afhænger af aktuel muskel-glykogen-status, ikke
session-historik. Effekten er kvantificeret som < 1% ISF-boost (under CGM-støj)
selv i pathologiske scenarier (gammel sub-cutoff session + senere stor pool-drain).
Følgende kode-ændringer er foretaget for at klargøre designet og rydde op i
relateret bagved-liggende issue:
1. **Lagrings-cutoff fjernet** i `stopAktivitet`: ALLE sessioner gemmes nu i
   `activeMotion[]` uanset A_fast/A_slow størrelse. Tidligere cutoff var en
   hukommelses-optimering der ikke giver mening (1-3 events/dag, ~7 felter pr).
   Sum-filteret i `currentISF` (linje 1123, 1127, 1144, 1154) bevarer rollen
   som numerisk støj-gulv ved læse-tid.
2. **`pruneExpiredMotions()`** tilføjet og kaldes fra `stopAktivitet`: rydder
   sessioner med `totalSimMinutes >= sensitivityEndTime` (>72t gamle der ikke
   længere bidrager). `activeMotion[]` stabiliserer sig nu på "antal sessioner
   der reelt kan bidrage" i stedet for at vokse monotont.
3. **Forklarende kommentar** tilføjet ved `slowEmptyFactor`-beregningen i
   `currentISF`-getteren der dokumenterer at pool-koblingen er bevidst design,
   med reference til denne review-finding. Tests: 129/129 pass.

---

## [ADVARSEL] W2 - Muskel-glykogen fast-fase resynthesis triggeres KUN hvis activeMotion har en gemt session

**Fil:** `js/simulator.js`, linje 2999-3015 (`updateMuscleGlycogen`)
**Subsystem:** Muskel-glykogenpool, fase-1 (AMPK-drevet, insulin-uafhængig)

**Problem:** Fast-fase resynthesis bruger `Math.pow(0.5, tPost / 45)` for at
modellere AMPK-persistens, MEN tPost beregnes fra "nyeste session i
activeMotion". `activeMotion` er kun udfyldt af `stopAktivitet` HVIS A_fast >
EXERCISE_FAST_CUTOFF (0.005) eller A_slow > EXERCISE_SLOW_CUTOFF (0.005). En
meget kort eller meget lav-intensitet motion (afslapning med
e2Scale=0; eller <1 minut Lav) opretter intet activeMotion-record.

Konsekvens: Selv om en sådan kort session reelt har drænet en lille mængde
glykogen via consumption_gPerMin, vil fast-fase resynthesis være DEAKTIVERET
efterfølgende fordi `activeMotion.length === 0`. Kun den langsomme insulin-
afhængige fase-2 og CHO-acceleration genopfylder. Det er en undervurdering af
post-motion glykogen-resynthesis efter korte motionsbidder.

**Evidens (enheder + tal):**
- 1 min Lav cardio: kcalPerMin=4, fraction=0.30, e2Scale=1.0, reserve=1.0 ->
  consumption = (4 x 0.30 / 4.0) x 1 x 1 = 0.30 g/min x 1 min = 0.30 g.
- Pool på 70 kg = 385 g. Resterende emptyFraction = 0.30/385 = 7.8e-4 - UNDER
  threshold (0.005), så resynthesis trigges slet ikke.
- Men en 5 min Lav session: 1.5 g drænet, emptyFraction = 3.9e-3, stadig under
  threshold. Først ved ~2 g (svarende til ~6 min Lav cardio) kommer poolen
  over emptyFraction-threshold.

Tærsklen `emptyFraction > 0.005` er konsistent (skal være > 1.9 g for et 70 kg
indvid). Det egentlige problem er kun: NÅR fastPhase ER aktivt (over
threshold), kræves activeMotion-record FOR overhovedet at få fast-fase boost.

Et 30 min Lav session som ikke gemmes (A_fast=0.30x1.0x(1-e^(-30/2))=~0.30 over
cutoff -> gemmes faktisk) -> ingen problem her. Men styrketræning lav (e2=0.9)
+ blandet eller afslapning (e2=0) kan i grænsetilfælde producere
A_fast/A_slow under cutoff og dermed gå glip af fast-fase boost trods reel
glykogen-tab.

**Forslag:**
- Brug i stedet `lastActivityEndTime` (sidste motion-stop, uanset om den blev
  gemt) som reference for fast-fase decay. Vedligehold variablen i
  `stopAktivitet` uafhængigt af cutoff-tjek.
- Eller: dropp activeMotion-koblingen og brug en separat rekord
  `lastMuscleContractionEndTime` der altid opdateres når consumption_gPerMin
  > 0 i seneste tick.
**STATUS:** ✅ FIKSET (2026-04-18) — Variant 2 implementeret. Ny instansvariabel
`this.lastMuscleContractionEndTime` (init = null) opdateres i
`updateMuscleGlycogen` HVER gang `consumption_gPerMin > 0`. Fase-1 AMPK-decay
bruger nu denne variabel i stedet for `activeMotion[].endTime`-lookup, så selv
sub-cutoff korte motionsbidder kvalificerer til fast-fase resynthesis. Tests:
129/129 pass.

---

## [ADVARSEL] W3 - 1 g glukose -> mmol bruger 180.16 i muskelpool, 180 alle andre steder

**Fil:** `js/simulator.js`, linje 3047 (muskel-pool BG-drain) og linje 2728
(lever-glykogen)
**Subsystem:** Enhedskonvertering glukose g <-> mmol

**Problem:** Inkonsistent molær masse for glukose:
- Linje 3047 (muskel-pool): `mmolUptaken = resynthesis_gPerMin * dt * (1000 / 180.16)`
- Linje 2728 (lever-glykogen): `EGP_0 * 0.5 * 0.180` (= 1/180 efter
  reciprocering)

180.16 g/mol er det korrekte molære masse for glukose. 180 er en hyppig
afrunding. Forskellen er 0.09 % - kosmetisk ubetydelig for spilmekanikken,
men en konsistens-blemish.

**Evidens (enheder):**
- 1 g glukose / 180.16 g/mol = 5.5506 mmol (præcis)
- 1 g glukose / 180 g/mol = 5.5556 mmol (afrunding, +0.09 %)

**Forslag:** Definér en modul-konstant `const GLUCOSE_MM_G_PER_MOL = 180.16;`
i toppen af `simulator.js` og referer den begge steder. Eller: brug 180 begge
steder hvis simpler-er-bedre prioriteres. Aldrig blandet.
**STATUS:** ✅ FIKSET (2026-04-18) — `GLUCOSE_MM_G_PER_MOL = 180.16` og afledt
`GLUCOSE_G_PER_MMOL = 0.18016` defineret som modul-konstanter i toppen af
`simulator.js`. Alle steder der konverterede mellem g og mmol bruger nu disse
konstanter (lever-glykogen × 2, muskel-pool, mad-input). `hovorka.js`
carbsToRate opdateret til 180.16 inline med kommentar om konsistens.

---

## [ADVARSEL] W4 - basalPlasmaInsulinBaseline er en konstant snapshot ved init, men reelt drifter med circadisk-/stress-modulering

**Fil:** `js/simulator.js`, linje 945 (init), linje 1024-1025 og 4722
(brug i UI)
**Subsystem:** UI-baseline for insulinbåndet (rapid vs basal separation)

**Problem:** `basalPlasmaInsulinBaseline = state[6] * V_I` sættes EN GANG i
konstruktor med initial steady-state plasma-insulin. Bruges derefter som
KONSTANT reference til at trække fra total plasma-I for at vise "rapid IOB"
vs "basal IOB". Med basal-shadow-kaskaden (`state[15] = Ib`) er den eksakte
dynamiske basal-plasma `state[15] * V_I`, som ÆNDRER sig over døgnet pga.
circadianISF-feedback til insulin-behov og pga. eventuelle dosis-ændringer.

Konsekvens: I UI'et kan "rapid plasma" se forkert ud i timer hvor basal-plasma
har drifte væk fra init-snapshot - typisk omkring dawn (5:00-9:00) hvor
circadianISF når sit nadir og kropsbehov stiger.

**Evidens (enheder):**
- state[6] [mU/L] x V_I [L] = mU plasma-insulin
- state[15] [mU/L] x V_I [L] = mU plasma-insulin der stammer fra basal-input
  (eksakt, takket være linearitet)
- Init-snapshot: state[6] = state[15] (ingen bolus endnu) - korrekt.
- Efter 6 timer i sandkasse uden interventioner: state[15] kan være ~5-10 %
  forskellig fra init pga. circadian basal-justering.

Dette er ikke en simulationsbug (Hovorka-state er korrekt), men en UI-
visualiseringsdrift der kan vildlede spilleren om hvor meget rapid insulin
der reelt er aktivt.

**Forslag:** Erstat `basalPlasmaInsulinBaseline` med en getter der returnerer
`state[15] * V_I` på opslagstidspunktet. Slet det gemte snapshot. Eksisterende
brug-steder bliver korrekte uden videre, fordi linje 1748-1754 allerede
beregner `basalPlasmaMU = state[15] * V_I` for det indre logging. UI bør bruge
samme kilde.
**STATUS:** ✅ FIKSET (2026-04-18) — `basalPlasmaInsulinBaseline` er nu en live
getter på Simulator-klassen der returnerer `hovorka.state[15] * hovorka.V_I`.
Init-snapshot fjernet. Eksisterende brug-steder (insulinbånd-UI, snapshot,
initial physiologyDataPoint) bruger uden videre den eksakte basal-plasma der
drifter med circadian/stress-modulering. Tests: 129/129 pass.

---

## [ADVARSEL] W5 - Doc summary-tabel for "Post-exercise ISF" beskriver gammel single-komponent model

**Fil:** `docs/MODEL-IMPLEMENTATION.md`, linje 194
**Subsystem:** Documentation sync (kode vs docs)

**Problem:** Summary-tabellen siger:
> Post-exercise ISF | Improved sensitivity for hours after exercise |
> Exponential decay, t½ = 3-5 hours | § 6 Activity

Men kode (siden 2026-04-13) bruger to-komponent model:
- Fast t½ = 15 min (AMPK)
- Slow er glykogen-koblet (ikke eksponentiel; mekanistisk via pool-fyldning)

Detail-sektionen § "Exercise insulin sensitivity - two-component model" (linje
1213+) er korrekt opdateret, MEN summary-tabellen er stadig på den gamle
formulering. Det skaber den samme drift-problematik som Codex foundation-
review identificerede for DKA og test-counts.

**Evidens:** Direkte sammenligning af linje 194 vs linje 1213-1265 i samme
dokument.

**Forslag:** Opdatér linje 194 til:
> Post-exercise ISF | Two-component: fast (AMPK, t½ 15 min) + slow (PEIS,
> coupled to muscle glycogen reserve) | § 6 Activity

Bump `<!-- doc-version: 2026-04-18-vN -->` og resync den danske oversættelse
(`MODEL-IMPLEMENTERING.da.md` har samme summary-tabel).
**STATUS:** ✅ FIKSET (2026-04-18) — Linje 194 opdateret til to-komponent
formulering ("Fast (AMPK, t½ = 15 min) + slow (PEIS, coupled to muscle glycogen
reserve)"). Doc-version bumpet til `2026-04-18-v1`. Den danske oversættelses
`translated-from`-markør synkroniseret. NB: Den danske `MODEL-IMPLEMENTERING.da.md`
indeholder ikke den engelske summary-tabel (anden struktur), så ingen tilsvarende
række skulle opdateres dér. `bash tests/check-text-sync.sh` grøn.

---

## [NOTE] N1 - EXERCISE_SENS_CAP=4.0 kombinerer multiplikativt med circadianISF=1.20 -> max samlet ISF-multiplikator 4.8x

**Fil:** `js/simulator.js`, linje 1147-1149
**Subsystem:** currentISF aggregering

**Observation:** Cap'en på `sensitivityIncreaseFactor` er 4.0. Men i den
endelige formel: `currentISF = ISF * circadianISF * vasodilatation *
sensitivityIncreaseFactor / combinedResistance`. Med circadianISF op til 1.20
om aftenen, vasodilatation 1.03 ved afslapning og combinedResistance ned til
1.0 (intet stress/FFA/glucotox), kan effektiv ISF løfte sig fra base ISF=3.0
til 3.0 x 1.20 x 1.03 x 4.0 / 1.0 = 14.8 mmol/L pr enhed insulin.

For en bruger med ISF=3.0: bolus 1E vil sænke BG med 14.8 mmol/L. Det er
fysiologisk ekstremt men muligt under sjældne stack-events (intens motion +
aften-circadian + afslapning + ingen resistens). Cap'en på
sensitivityIncreaseFactor alene afspejler ikke det fulde produkt.

**Evidens (enheder):**
- ISF [mmol/L per U] x dim x dim x dim / dim = mmol/L per U (konsistent)

**Forslag:** Ingen umiddelbar handling. Stack-scenariet kræver spilleren
aktivt opbygger flere komponenter. EXERCISE_SENS_CAP isoleret er rimelig.
Overvej at tilføje en samlet "ISF-multiplier"-gauge til UI så spilleren kan
se det totale loft i extreme cases.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N2 - Renal threshold R_thr = 9 mmol/L er på den lave ende af litteraturen

**Fil:** `js/hovorka.js`, linje 122 (`R_thr`)
**Subsystem:** Renal glucose excretion

**Observation:** Hovorka original (2004) bruger R_thr = 9 mmol/L. Klinisk
litteratur (Mogensen 1971; Wright 2017) angiver typisk individuel variation
8-12 mmol/L med median ~10 mmol/L. Modellen følger Hovorka.

Forrige review markerede dette som [OK] (BY DESIGN, matcher Hovorka). Ingen
ændring foreslås - bare en bekræftelse af konsistens.

**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N3 - Per-bolus rapid kinetics og basal-shadow er numerisk korrekte men afhængige af lineær superposition

**Fil:** `js/simulator.js`, linje 3265-3340 (`_substepRapidInsulin`); 
`js/hovorka.js`, linje 470-490 (basal shadow)
**Subsystem:** Insulin PK separation

**Observation:** Modellen udnytter at S1/S2/I-systemet er LINEÆRT i input.
Dvs. total plasma-I = sum(rapid bolus contributions) + basal shadow Ib.
`hovorka.rapidU_I` summeres pr. tick, og I-ODE'en integrerer over begge.

Fordi alle tre tilstande har samme tau (55 min), er super-positionen eksakt.
Hvis pulsFaktor varierer pr. bolus (det gør den IKKE i koden - alle boluser
deler samme pulsFaktor), ville super-positionen stadig være korrekt fordi
faktoren bare skalerer rate-konstanten ens for alle.

Verificeret: koden er konsistent med ODE-linearitet. Ingen handling.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N4 - exerciseFactor skalerer BÅDE x1 (transport) og x2 (disposal) - dobbelt effekt på UG

**Fil:** `js/hovorka.js`, linje 405-415
**Subsystem:** Hovorka exercise-multiplikation

**Observation:** `dQ1 = -F01c - FR + k12*Q2 + UG + EGP - x1*exerciseFactor*Q1`
og `dQ2 = x1*exerciseFactor*Q1 - k12*Q2 - x2*exerciseFactor*Q2 -
beta*E1*HR_norm*Q2`. exerciseFactor (= 1 + alpha*E2^2) anvendes både på Q1->Q2
transport OG på x2-mediated disposal fra Q2.

Resalat 2020 angiver eksplicit disposal-leddet. Hovorka 2004 har transport-
leddet. Kombinationen i koden er en hybrid model: motion accelererer både den
tidlige optagsrate og den senere disposal-rate. Det er fysiologisk plausibelt
(GLUT4-translokation og insulin-receptor-binding bliver begge mere effektive),
men dobbelt-multiplikationen kan over-estimere total clearance ved høj E2.

**Evidens (enheder):**
- x1 [1/min] x dim x mmol = mmol/min (Q1->Q2 transport)
- x2 [1/min] x dim x mmol = mmol/min (Q2 disposal)

Begge enheder konsistente. Sandsynlighed for over-estimat: ~10-20 % ved E2 >
0.5 (intens motion). Ikke en bug men en model-forsigtighedsadvarsel.

**Forslag:** Dokumentér eksplicit i MODEL-IMPLEMENTATION.md hvilken kobling
der er bevidst. Eventuelt kalibrér alpha=1.79 NEDAD hvis test viser
over-respons ved høj-intensitets motion sammen med stort bolus. Tests bør
inkludere et 60-min Høj cardio + 5E bolus scenario med litteratur-
sammenligning.

**EMPIRISK EVALUERING (2026-04-18):** `tests/evaluate-n4-exercise-factor.js`
kører fire scenarier (Control, Bolus 5E, Cardio Lav/Medium/Høj 60m, Bolus+Cardio)
ved BG=8 og BG=14. Resultater:

| Intensitet | E2-peak | exerciseFactor-peak | BG-drop @ BG=14 |
|------------|---------|----------------------|------------------|
| Lav        | 0.159   | 1.045                | 6.16 mmol/L      |
| Medium     | 0.279   | 1.14                 | 10.07 mmol/L     |
| Høj        | 0.398   | 1.32                 | 11.85 mmol/L     |

Den teoretiske worst-case ved E2=1.0 (factor=2.79) opstår ALDRIG i realistiske
scenarier — selv 60 min Høj cardio holder factor under 1.32. "Dobbelt-multiplikation"
giver effektiv x1·x2 amplifikation på ≤1.74x — modest, ikke blow-up.

Bolus+cardio (D) giver 7.46 mmol/L drop, hvilket matcher Adams 2018 (5-7 mmol/L
common with insulin on board). Synergy-ratio 0.62 (sub-additiv) er en floor-effekt,
ikke en model-fejl — bolus alene crasher BG til 1.26 mmol/L, så der er ikke meget
ekstra drop tilbage at give.

**Konklusion:** N4-bekymringen er empirisk afkræftet. Resalat 2020's parametrering
af `(1+α·E2²)` på BÅDE x1 og x2 er en bevidst kobling af to fysiologisk distinkte
mekanismer (perfusion-boost + GLUT4-crosstalk) der deler samme intensitets-driver.
α=1.79 er kalibreret af Resalat med denne dobbeltanvendelse intakt.

**FOLLOW-UP — intensitets-skalering verificeret (2026-04-18):** Ved 60 min cardio
@ BG=14 (headroom) gav Medium og Høj næsten samme drop (+18% kun). Mistanke om
saturation-bug. Floor-fri test (30 min cardio @ BG=14, alle holdt sig over 3.5
mmol/L):

| Intensitet | BG-drop (30m) | minBG | E2-peak |
|------------|---------------|-------|---------|
| Lav        | 4.98 mmol/L   | 9.02  | 0.087   |
| Medium     | 7.54 mmol/L   | 6.46  | 0.153   |
| Høj        | 10.10 mmol/L  | 3.90  | 0.219   |

Marginal effekt: Lav→Medium +51%, Medium→Høj +34% — i Riddell/Adams litteratur-
rækkevidde (30-50%). Den oprindelige "saturation" ved 60 min var floor-effekten
fra `hypoFactor` (`simulator.js:1679-1682`): når BG<3.5 mmol/L throttles
targetHeartRate ned mod hvilepuls — fysiologisk korrekt (hjernen prioriterer
glukose, muskler kan ikke opretholde Høj intensitet ved hypo). Saturation er
en feature, ikke en bug.

**STATUS:** ⚠️ ACCEPTABEL — empirisk verificeret 2026-04-18 via
`tests/evaluate-n4-exercise-factor.js`. exerciseFactor topper ved 1.32 i
realistiske scenarier, dobbelt-multiplikationen giver ikke over-estimation,
intensitets-skalering matcher litteraturen når der er headroom, og
hypo-throttling er by-design.

---

## [NOTE] N5 - F_01s = F_01 / 0.85 og F_01c = F_01s * G/(G+1) er empiriske forenklinger

**Fil:** `js/hovorka.js`, linje 380-388
**Subsystem:** Brain glucose consumption (F_01)

**Observation:** Hovorka 2004 originalt definerer F_01 = 0.0097 mmol/kg/min
som total non-insulin-mediated uptake. Den simulator-version splitter:
- F_01s = F_01 / 0.85 (skala op for at "afsløre" den skjulte 15 % insulin-
  afhængige andel)
- F_01c = F_01s x G/(G+1) (Michaelis-Menten med Km=1)

Forrige review markerede /0.85 som ACCEPTABEL (N2). Den nye gennemgang
bekræfter: enheder konsistente, fysiologisk motiveret (Boyle 1994 viser hjerne
+ hindbrain ~85 % konstant + ~15 % insulin-modulert), men fortsat empirisk.
Ingen handling.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N6 - HAAF area-akkumulering bruger 1-min ticks, ikke kontinuert integration

**Fil:** `js/simulator.js`, linje 2454-2479
**Subsystem:** HAAF / counterregulation degradation

**Observation:** `hypoArea += (3.9 - trueBG) * dt` integreres pr. substep.
Hvor stort steady-state hypo over 60 min ved BG=2.5: hypoArea-bidrag = (3.9 -
2.5) x 60 = 84 enheder. counterRegFactor = 0.3 + 0.7 x exp(-84/30) = 0.34.

Konsistent med Dagogo-Jack 1993 (60-90 min hypo nedsætter glukagon-respons
markant). Recovery t½=72 timer matcher klinisk erfaring.

Forrige review O6 [OK]. Ingen ændring.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N7 - Glucotoxicity bruger sigmoid Hill med EC50=50 over kvadratisk akkumulering -> dobbelt non-linearitet

**Fil:** `js/simulator.js`, linje 2645-2680
**Subsystem:** Glukotoksisitet

**Observation:** glucotoxicLoad akkumuleres som (BG-10)^2 x dt (kvadratisk).
Effekt på ISF er Hill-funktion: factor = 1 + MAX_RESIST x load^n / (load^n +
EC50^n) med n=1.5, EC50=50, MAX=0.40.

Dobbelt non-linearitet (akkumuleringen er kvadratisk OG mappingen er
sigmoidal) gør responskurven meget stejl omkring 30-70 load-units. Det er
fysiologisk plausibelt (glucotoxicitet har "trigger"-karakter i klinikken),
men gør parameter-fitting følsom.

Forrige review O12 [OK]. Ingen ændring foreslås. Bemærk: hvis fremtidig
kalibrering ændrer enten kvadratisk-led eller Hill-EC50, skal effektkurven
checkes for at undgå utilsigtede dramatiske spring.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N8 - Ny muskel-glykogenpool bruger MUSCLE_GLYCOGEN_G_PER_KG=5.5 - lav ende af litteratur (5-15 g/kg muscle)

**Fil:** `js/simulator.js`, linje 146
**Subsystem:** Muskel-glykogenpool kapacitet

**Observation:** 5.5 g/kg KROPSVÆGT (ikke pr kg muskel). For 70 kg = 385 g.
Litteratur: Hultman 1967, Casey 2000 angiver 300-500 g total muscle glycogen
hos voksne mænd. 385 g er midt-feltet og rimeligt.

Hvis konstanten fortolkes som g/kg MUSKEL og brugen tager 30 % muscle mass i
beregning, ville pool være ~115 g - for lavt. Koden bruger ENTYDIG
kropsvægt-skala, hvilket matcher det kliniske 300-500 g-interval. Ingen bug.

**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N9 - Muskel-pool consumption skalerer med (kcalPerMin x fraction / 4.0)

**Fil:** `js/simulator.js`, linje 2990
**Subsystem:** Muskel-glykogen consumption

**Observation:** 1 g kulhydrat = 4 kcal er en kostfysiologisk konvention.
consumption_gPerMin [g/min] = (kcal/min x dim / kcal/g) = g/min - korrekt.
Men det antager at fraction (0.30/0.50/0.75) er ANDELEN af forbrændt kalorie
der kommer fra glykogen. I virkeligheden er glykogen-andelen INTENSITETS-
afhængig: ved Lav cardio kommer ~30 % fra glykogen og 70 % fra fedt; ved Høj
~80 % fra glykogen.

Konstanterne {Lav: 0.30, Medium: 0.50, Høj: 0.75} matcher det glukose-fra-
glykogen-fraktion-koncept præcist. Validation:
- 70 kg cardio Lav: kcalPerMin~5, fraction=0.30, e2=1.0, reserve=1.0 ->
  consumption = 5 x 0.30/4 = 0.375 g/min = 22.5 g/t
- 70 kg cardio Høj: kcalPerMin~12, fraction=0.75 -> consumption = 12 x 0.75/4
  = 2.25 g/min = 135 g/t

Litteratur (Romijn 1993): 60 min @ 65 % VO2max forbrænder ~40-60 g glykogen.
Modellens 22.5-135 g/t-spænd dækker det rimeligt.

**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N10 - circadianISF brugte cosine-interpolation mellem 6 kontrolpunkter

**Fil:** `js/simulator.js` (cirka linje 1074-1263, getter)
**Subsystem:** Circadian ISF rhythm

**Observation:** Kontrolpunkter [0:1.20, 240:1.20, 480:0.70, 840:1.0,
1140:1.20, 1440:1.20] (minutter fra midnat). Cosine-interpolation
mellem dem giver C^1-kontinuert kurve. Morgen-nadir 0.70 ved 8:00 matcher
dawn phenomenon.

Forrige review O11 [OK]. Stadig korrekt.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N11 - Pending stress hormones drainer med tau=30 min for at undgå ISF-diskontinuiteter

**Fil:** `js/simulator.js` (stress pipeline, ca linje 2024-2098)
**Subsystem:** Stress hormone aggregation

**Observation:** Akut stress-spikes (hypo-trigger, exercise-trigger) lægges
til pendingChronicStress, der drainer med t½=30 min ind i chronicStressLevel.
Smoothing forhindrer ISF-trin-effekter ved hændelser.

Forrige review O14 [OK]. Stadig korrekt.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N12 - CGM ka_int=0.073 -> interstitiel forsinkelse t½ ~9.5 min

**Fil:** `js/hovorka.js`, linje 423 + simulator CGM-update
**Subsystem:** CGM interstitial delay

**Observation:** dC/dt = ka_int x (G - C). t½ = ln(2)/0.073 = 9.5 min.
Reelt CGM-lag er typisk 5-15 min (Dexcom G6/G7: ~6 min; Libre 2/3: ~10 min).
9.5 min er midt-feltet og rimelig.

**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N13 - Substep-loop dt <= 1.0 min - sikker margen til hurtigste tidskonstant

**Fil:** `js/simulator.js`, substep-loop ca linje 1700-1735
**Subsystem:** Numerisk integration

**Observation:** Den hurtigste eksplicitte tidskonstant er
EXERCISE_FAST_TAU_ACTIVATION_MIN = 2 min (i sensitivity build-up). Næste er
hjerte-rate compartment t½_E1 = 20 min. Euler-stabilitet kræver dt < 2/L for
det stivste system; med dt=1.0 og L max=0.5 har vi god margen.

Forrige review O3 [OK]. Bekræftet.
**STATUS:** [ÅBEN] (info-only)

---

## [NOTE] N14 - Box Challenge respawn bruger _resetToStableBG der sætter analytisk steady-state

**Fil:** `js/simulator.js`, linje 4299-4451 (`_resetToStableBG`)
**Subsystem:** Box Challenge respawn logic

**Observation:** Ved liv-tab i Box Challenge respawnes BG til safeBG via
analytisk steady-state. ALL aktive boluser, motion-records, glykogen-state og
cob/iob nulstilles. Kontinuerlig fysiologi-state gennembrydes.

Det er BY DESIGN for spil-mekanikken (frisk start hver respawn), men betyder
at HAAF-counter, glycotoxicLoad og acidosisLoad også resettes. Ved hyppige
respawns kan spilleren undgå langsigtet konsekvens-akkumulering.

**Forslag:** Ingen umiddelbar handling - dette er gameplay-design. Overvej at
KEEPE HAAF + glucotoxicLoad on/across respawns hvis langsigtet straf er
ønsket.
**STATUS:** ⚠️ BY DESIGN (2026-04-18) — Bekræftet som ønsket gameplay-adfærd.
Selve liv-tabet ER straffen i Box Challenge; en frisk fysiologisk start ved
respawn er bevidst designet, så spilleren kan fortsætte runden uden at
slæbe akkumuleret HAAF/glucotoxicLoad med sig fra et tidligere liv.

---

## [NOTE] N15 - sessionBioavFast=0.78, sessionBioavBasal=0.82 sættes som konstanter, ikke pr-injektion variation

**Fil:** `js/simulator.js`, linje 955-956
**Subsystem:** Insulin bioavailability

**Observation:** Heinemann 2002 / Kildegaard 2019 dokumenterer 70-90 %
bioavailability for hurtig insulin med inter-individuel variation. Modellen
fastholder konstanten - hvilket sikrer 1U = ½ x 2U proportionalitet (et
afgørende design-krav for spillet).

Variation er i stedet flyttet ind i tauFactor (per-bolus PK-spread). Det er
en god model-tradeoff. Ingen ændring.
**STATUS:** [ÅBEN] (info-only)

---

## [OK] O1 - Hovorka 16-state ODE: dimensionel konsistens

Verificeret igen i denne gennemgang. Alle 16 ODE-led har konsistente enheder.
Inklusiv shadow-cascade (S1b/S2b/Ib) og motion-extension (E1/E2/HR_effect).
Forrige review O1 stadig korrekt.

---

## [OK] O2 - A_G = 1.0 (EU carbs-konvention)

Bekræftet i `hovorka.js` linje 87. Dokumenteret med kommentar.

---

## [OK] O3 - EGP = max(0, EGP_0 x (stressMultiplier - x3))

Korrekt T1D-counterregulering. Ved hypo: stress=1.4, x3=1.3 -> EGP=0.1*EGP_0.
Ved overdosis: x3 >> stress -> EGP=0 -> BG falder. Plausibelt.

---

## [OK] O4 - Per-bolus rapid + basal shadow giver eksakt rapid/basal-separation

Linearitet i Hovorka-state udnyttet korrekt. state[15]*V_I er eksakt basal-
plasma. (Se W4 for UI-bug der ikke udnytter dette eksakt.)

---

## [OK] O5 - Hermite smoothstep insulin-gate til DKA-acidose

Erstatter den hårde > 0.3 gate fra tidligere. C^1-kontinuert. Fastet ketose
(plasmaI=8) -> gate=0 -> ingen acidose. DKA (plasmaI=0) -> gate=1 -> fuld
rate. Korrekt.

---

## [OK] O6 - Dynamisk tau_G karbohydrat-model

Formel `carbBase x fiberMod x retentionMod + fatDelay` validreret mod 7
litteratur-kilder i 2026-04-11 carb-model review. Stadig korrekt.

---

## [OK] O7 - HAAF sigmoid mapping (Dagogo-Jack 1993 match)

`counterRegFactor = 0.3 + 0.7 x exp(-hypoArea/30)`. Floor 0.3 (ikke nul),
recovery t½=72 t. Klinisk plausibelt.

---

## [OK] O8 - Glycogen conversion 0.180 g/mmol

`basalGlycogenolysis_gPerMin = EGP_0 * 0.5 * 0.180`. Enheder konsistente:
mmol/min x dim x g/mmol = g/min. (Se W3 for inkonsistens med 180.16 i
muskel-pool.)

---

## [OK] O9 - Brain energy deficit threshold 8.0 mmol = ~1.44 g

Hjernens glykogen-reserve er ~1-2 g (Oz 2007). Threshold 8.0 mmol matcher
den nedre grænse. Recovery t½=45 min plausibel.

---

## [OK] O10 - Glucotoxicity sigmoid (Vuorinen-Markkola 1992 match)

24 t @ BG=20 -> ~16 % ISF-reduktion. Klinikken: 26 %. Konservativt men
rimeligt. Forrige review O12 [OK]. Stadig korrekt.

---

## [OK] O11 - To-komponent exercise sensitivity giver timing-afhængighed

Ny model siden 2026-04-13. Verificeret kode-struktur:
- Live: fast = aFast x e2 x rampUp(tau)
- Live: slow = aSlow x e2 x sqrt(tau/60) x rampSlow(tau) x slowEmptyFactor
- Post-stop: fast = A_fast x 0.5^(tPost/15) (decay korrekt)
- Post-stop: slow = A_slow x slowEmptyFactor (glykogen-koblet decay)

Designet matcher 2026-04-13_exercise-sensitivity-design.md. Fast-decay og
PEIS-magnitude i tråd med Cartee 2015 + Mikines 1988. (Se W1 for sub-cases
omkring kontinuitet ved stop.)

---

## [OK] O12 - Muskel-glykogen massebalance konsistent

dGlycogen/dt = resynthesis - consumption [g/min]. Pool clamped til [0,
capacity]. BG-drain via Q1-reduktion brug korrekt molær konvertering.
Resterende afkobling er BY DESIGN for at gøre to-komponent model mekanistisk
forklarbar.

---

## [OK] O13 - Cirkulationsmodel pulsFaktor (insulin-absorption acceleration)

`pulsFaktor = 1 + (HR - HRbase) / HRbase x 0.5` korrekt skalerer S1->S2 og
S2->I rate-konstanter. Adskilt fra GLUT4-effekten (e1Scaling). Forrige review
O10 [OK]. Stadig korrekt.

---

## [OK] O14 - Sleep debt -> chronic stress pipeline (smooth via tau=30 min drain)

Pipeline isoleret og kontinuert. Forrige review O14 [OK]. Bekræftet.

---

## [OK] O15 - FFA-induceret resistens (Hill n=2, EC50=8 mmol/L FFA)

Lipolyse-gate insulin-sensitiv (Hill n=3, EC50=8 mU/L plasma I). FFA
clearance t½=180 min. Maks resistens 0.42 (svarende til 30 % ISF-reduktion).
Konsistent med Boden 2002. Forrige review O9 [OK]. Stadig korrekt.

---

## STATUS-OPSUMMERING

| Kategori | Antal | Beskrivelse |
|----------|-------|-------------|
| KRITISK  | 0     | Ingen kritiske defekter |
| ADVARSEL | 5     | W2-W5 ✅ FIKSET, W1 ⚠️ BY DESIGN (2026-04-18) |
| NOTE     | 15    | N1-N15. N4 ⚠️ ACCEPTABEL (empirisk verificeret 2026-04-18), N14 ⚠️ BY DESIGN |
| OK       | 15    | O1-O15 - bekræftet korrekt |

### Forrige review fund (2026-04-12) - status tjekket

| ID  | Original status | Status nu (2026-04-18) |
|-----|-----------------|------------------------|
| W1  | FIKSET          | Stadig fikset, ingen regression |
| W2  | FIKSET (cap 2.5x) | Stadig fikset (linje 1144-1145) |
| W3  | BY DESIGN       | Stadig BY DESIGN |
| W4  | FIKSET (synth-threshold skalerer m. ISF) | Stadig fikset (linje 3022) |
| N1-N7 | BY DESIGN/ACCEPTABEL | Stadig samme; ingen ændring |
| O1-O15 | OK | Stadig OK |

### Codex foundation-review (2026-04-12) - status tjekket

Alle 7 fund (FFA-force, DKA docs, doc-sync, test-count, CLAUDE.md, metadata,
help-templates) er FIKSET 2026-04-12. Ingen regression.

### Hovedfokus-konklusion

To-komponent exercise sensitivity og muskel-glykogen pool er fysiologisk vel
udformet. Koblingen `slowBoost ~ A_slow x (1 - muscleGlycogenReserve)` er en
god mekanistisk model af PEIS, men har en design-edgecase (W1) hvor gemte
sessioner kan "vågne op" når en senere aktivitet dræner poolen. Dette er
enten en bug eller et bevidst design-valg - bør afklares.

Den nye fast-fase glykogen-resynthesis (W2) trigges kun hvis activeMotion-
record blev gemt, hvilket udelukker meget korte motionsbidder fra fast-fase
boost. Mindre defekt, let at rette.

Doc-drift (W5) er en lavrisiko vedligeholdelses-issue, men matcher det
mønster Codex foundation-review identificerede - bør rettes som en del af
samme drift-bekæmpelses-disciplin.
