# Fysiologisk review — model-implementering (logisk + videnskabeligt grundlag)

**Dato:** 2026-06-08
**Reviewer:** Claude (phys-review skill)
**Scope:** Fuld gennemgang af `js/hovorka.js` + `js/simulator.js` med fokus på,
om de valgte løsninger har et konsistent logisk og videnskabeligt grundlag.
Kryds-tjekket mod `docs/MODEL-IMPLEMENTATION.md` og `docs/BG-SCIENCE.md`.

**Læst kode:** hele `hovorka.js` (625 linjer); `simulator.js` constructor,
`update()`-loop + substepping, `_substepFatProteinFFA`, `_substepRapidInsulin`,
`_substepKetones`, `updateStressHormones`, `updateHAAF`, `updateBrainEnergyDeficit`,
`updateAcidosisLoad`, `updateGlucotoxicity`, `updateGlycogenReserve`,
`updateMuscleGlycogen`, `currentISF`-getter.

---

## Samlet vurdering

Modellen er moden og veldokumenteret. Kernen (Hovorka 2004) er korrekt porteret,
enhederne balancerer, integrationen er substeppet til dt ≤ 1 min, og alle masser
clampes til ≥ 0. De fysiologiske udvidelser (ketoner, FFA-resistens, protein-glukagon,
lever-/muskel-glykogen, HAAF, acidose, glukotoksicitet) er hver især koblet til
navngivne kilder og kvantitativt kalibreret. Jeg fandt **ingen enheds-fejl, ingen
NaN/division-by-zero i de aktuelle parametergrænser, og ingen brud på massebalancen.**

De fund jeg har er: **én reel arkitektur-svaghed** (hastigheds-afhængig granularitet
i skades-/kontraregulerings-akkumulatorerne) og en række **dokumentations-drift-noter**
fra de iterative keton-kalibreringer. Ingen af dem er akut.

Tæller: **0 KRITISK · 1 ADVARSEL · 4 NOTE · 4 OK**

---

## OK — bekræftede korrekte løsninger

### OK — EGP-reformuleringen er matematisk konsistent med Hovorka
**Fil:** `hovorka.js:422`
Den nye `EGP = max(0, EGP_0 × (stressMultiplier − x3))` er **identisk** med Hovorkas
oprindelige `EGP_0 × (1 − x3)` når `stressMultiplier = 1.0` (baseline). Suppressions-
hældningen ift. x3 er uændret (EGP_0). Ændringen påvirker kun adfærden når stress ≠ 1,
hvor den korrekt lader kontraregulering (glukagon/adrenalin) overvinde insulin-
suppression — den gamle `EGP_0 × stress × (1−x3)` clampede til 0 så snart x3 > 1 og
gjorde glukagon virkningsløst under hypo. Godt begrundet, korrekt implementeret.
**STATUS:** ⚠️ BY DESIGN

### OK — Keton-pathway er bounded og kan ikke løbe løbsk
**Fil:** `simulator.js:4291-4339`
Ved I=0 (pumpesvigt): steady-state `ffaLipolysis = LIPOLYSIS_MAX / (ln2/120) ≈ 15.6`,
produktion ≈ `BHB_PROD_RATE × 15.6 × 1.0 = 0.0187` mmol/L/min. Maks clearance =
`BHB_VMAX + BHB_RENAL_VMAX = 0.016 + 0.005 = 0.021` mmol/L/min > produktion → BHB
plateauer (~9–10 mmol/L) i stedet for at ramme 20-clampen. Faste-/keto-ketose
(BHB < 3) udløser korrekt **ingen** acidose pga. den dobbelte gate (BHB > 3 OG lav
insulin). Skelnen faste-ketose vs. DKA er fysiologisk korrekt. Veldesignet.
**STATUS:** ⚠️ BY DESIGN

### OK — Per-bolus rapid-depots + basal-skygge-kaskade
**Fil:** `hovorka.js:505-540`, `simulator.js:4190-4239`
Superpositionen `I_total = I_basal + I_rapid` udnytter at insulin-ODE'erne er lineære,
og giver eksakt kilde-attribution uden estimation. Euler-stabilitet er verificeret
(stepDt/tauI ≤ 0.037 ≪ 1). pulsFaktor påvirker begge depoter ens — fysiologisk korrekt.
**STATUS:** ⚠️ BY DESIGN

### OK — Massebalance i lever-glykogen-poolen
**Fil:** `simulator.js:3259-3387`
Glukose opstår aldrig fra ingenting: al glykogenolyse trækkes fra poolen og skaleres
med `glycogenReserve`, så pool-drain matcher det faktiske EGP-bidrag til blodet.
Stress-dekomponeringen (60% glycogenolyse / 40% GNG) og protein-glukagon (50/50) er
konsistente mellem pool-forbrug og EGP-formel. Insulin-gate på glykogen-syntese
(GS kræver Akt/GSK3β-signalering) er korrekt ISF-normaliseret.
**STATUS:** ⚠️ BY DESIGN

---

## ADVARSEL

### ADVARSEL — Skades-/kontrareguleringsakkumulatorer er hastigheds-afhængige
**Fil:** `simulator.js:1705, 1991, 2125, 2319-2320, 2947`
**Subsystem:** updateStressHormones (kontraregulering), updateBrainEnergyDeficit,
updateAcidosisLoad, updateGlucotoxicity, updateGlycogenReserve

**Problem:** Disse akkumulatorer kører **én gang per tick** med hele
`simulatedMinutesPassed`, mens BG-kernen substepper ved dt ≤ 1 min. Vigtigst:
`stressBase` (som driver EGP-kontraregulering) beregnes **én gang før** substep-løkken
(linje 1991) og er frosset for hele tick'et. Hypo-kontrareguleringen, der opbygges i
`updateStressHormones`, ser derfor først en hypo udviklet *inden i* et tick ved
**næste** tick.

**Evidens:**
- Frame-cap er `deltaTime ≤ 0.5 s` (game.js:87). Ved maks hastighed (1440 sim-min/real-sek)
  bliver et tick op til `0.5 × 1440 / 60 = 12` sim-minutter.
- Ved 1t/min (speed=60) er et tick ≤ 0.5 sim-min; ved 24t/min (speed=1440) op til 12 sim-min.
  Forholdet er 24×.
- Konsekvens: en spiller, der kører hurtigt under en udviklende hypo, får
  kontraregulerings-EGP'en til at "halte" op til ~12 min bagefter, mens en spiller på
  lav hastighed får respons inden for <1 min. **Fysikken bør ikke afhænge af den
  hastighed spilleren vælger.** Samme granularitets-forskel gælder akkumuleringen af
  brain-deficit, acidose og glukotoksicitet (alle bruger ét BG-snapshot × op til 12 min
  som rektangel-approksimation).
- Teamet har allerede erkendt mønsteret: `updateMuscleGlycogen` blev *flyttet ind* i
  substep-løkken (linje 2056) netop for at undgå single-tick BG-spikes. De øvrige
  akkumulatorer — inkl. den BG-koblede stress→EGP-sti — er endnu ikke flyttet.
  Review-historikken markerer stress-delen som "W3 accepteret Euler-artefakt", men det
  blev vurderet før hastigheds-skævheden var kvantificeret.

**Forslag:** Diskutér om kontrareguleringen (hypo-stress → `stressBase`-komponenten) og
de tre skades-akkumulatorer (brain/acidose/glukotoks) bør flyttes ind i substep-løkken,
så de integreres med samme dt ≤ 1 min som BG. Alternativt: behold dem per-tick men gør
det til en bevidst, dokumenteret beslutning at hypo-respons er en tick forsinket.
Eksponentielle recovery-led (`*= exp(−k·dt)`) er eksakte for vilkårlig dt og behøver
**ikke** flyttes — kun de akkumulerende led og det frosne `stressBase`.

**STATUS:** ✅ FIKSET (2026-06-08) — `updateStressHormones` (inkl. HAAF + lever-glykogen),
`stressBase`, motions-stress-akkumulering, samt `updateBrainEnergyDeficit`,
`updateAcidosisLoad` og `updateGlucotoxicity` er flyttet ind i substep-løkken i
`update()` og kører nu med dt ≤ 1 min. `trueBG` opdateres sidst i hvert substep, så de
eksisterende delsystemer beholder deres start-of-step BG (uændret 1-substep-adfærd),
mens skades-modellerne ser frisk post-step BG. Frame-loftet (0,5 s, game.js:87) er
bevaret som spiral-beskyttelse.

**Verifikation:**
- Hele test-suiten kører **155/155** uændret — single-substep-stien (speed=60,
  `update(1.0)`) er numerisk identisk, som designet.
- Granularitets-test (samme hypo-scenarie kørt med 1-min vs 6-min vs 12-min ticks,
  al stokastik fjernet) viser at grov-tick nu sporer fin-tick:
  - Realistisk område (BG ≥ ~3): **|Δ nadir| ≈ 0,01 mmol/L**, |Δ final| ≈ 0,0001.
  - Mild hypo (nadir ~1,8): **|Δ| ≈ 0,002 mmol/L**.
  - Et lille residual (|Δ| ≤ 0,15–0,29 mmol/L) optræder **kun** når BG drives under
    ~1 mmol/L (dyb, allerede-fatal hypo). Det stammer fra at insulin-/carb-/puls-
    *rate*-beregningen stadig laves én gang per tick; i det stive sub-1-mmol/L-regime
    forstærkes den lille forskel. Vurderet acceptabel: spilleren er der i game-over-
    territorium, og at substeppe hele input-rate-beregningen ville være en langt
    større ændring uden praktisk gevinst i normalt spil.

**Substep-størrelse-konvergens (worst case):** Substeppet er `min(remaining, 1.0)` —
højst 1 min, finere ved langsom hastighed. Den groveste fysik (1-min Euler-steps,
som ved en frame-hitch ved max fart) blev testet mod en meget finere reference ved at
variere dt fra 1,0 → 0,0625 min ved fast hastighed (substep = dt, så Euler-truncation
isoleres fra input-rate-frysningen). Resultat: ved dt = 1,0 min ligger trueBG inden for
**0,005–0,022 mmol/L** af 0,0625-min-referencen i ALLE scenarier (inkl. game-over-
crashet), og fejlen halveres monotont når dt halveres (ren førsteordens-konvergens).
**Konklusion: 1-min-steppet er allerede præcist — `maxStepSize` behøver ikke sænkes.**
Det residual der ses i grov-vs-fin-testen ovenfor stammer derfor IKKE fra substep-
størrelsen (begge bruger 1-min substeps) men udelukkende fra input-rate-frysning (b),
som kun bider under BG ≈ 1 mmol/L. Begge fejlkilder ved absolut worst case (12-min
hitch ved 24t/min):

| Fejlkilde | BG ≥ 2–3 (normalt spil) | BG < 1 (fatal hypo) |
|-----------|-------------------------|---------------------|
| (a) 1-min Euler-truncation | ~0,02 mmol/L | ~0,005 mmol/L |
| (b) input-rater frosset ≤ 12 min | < 0,01 mmol/L | ≤ 0,29 mmol/L |

Beslutning (2026-06-08): issue **lukket**. (a) er ubetydelig og kræver ingen handling;
(b) accepteres bevidst (`⚠️ ACCEPTABEL`) — den optræder kun i allerede-fatal hypo og
ville kræve at flytte hele insulin/carb/puls-rate-blokken (~150 linjer inkl. auto-stop
og logning) ind i substep-løkken for nul praktisk gevinst i normalt spil.

---

## NOTE

### NOTE — Stale EC50-værdier i keton-kommentarer (doc-drift)
**Fil:** `simulator.js:681-707` (constructor) og `3107-3110` (updateAcidosisLoad)
**Problem:** De iterative keton-rekalibreringer (8 → 6 → 5) har efterladt modstridende
EC50-værdier i kommentarerne, mens `this.LIPOLYSIS_EC50 = 5` (linje 701):
- Linje 684: "...10 er et kompromis der giver tilstrækkeligt faste-ketose..."
- Linje 688: tabel-header "Lipolyse ved forskellige insulin-niveauer (EC50=6, n=3)"
- Linje 3109: "...Lipolyse EC50 (=10) er justeret for faste-ketose, men acidose-tærsklen
  skal forblive lav..."

Den faktiske værdi er 5 alle tre steder. Acidose-kommentarens ræsonnement ("acidose-EC50
skal være LAVERE end lipolyse-EC50") er nu **misvisende**, fordi begge nu er 5
(`ACIDOSIS_INSULIN_EC50 = 5` == `LIPOLYSIS_EC50 = 5`). En fremtidig modellør, der læser
kommentaren, vil tro de to er bevidst adskilt med en faktor 2.
**Forslag:** Ret de tre kommentarer til at afspejle 5, og omformulér acidose-rationalet
(at de tilfældigvis koincidere nu, og hvorfor acidose-gaten alligevel er konceptuelt
uafhængig). Ren kommentar-ændring, ingen adfærdsændring.
**STATUS:** ✅ FIKSET (2026-06-08) — `js/simulator.js`-kommentarerne er opdateret til
EC50=5, tabellen er justeret til den aktuelle Hill-kurve, og acidose-rationalet siger
nu eksplicit at acidose-gaten er konceptuelt uafhængig af lipolyse-EC50. En nærliggende
CPT-1-kommentar med `LIPOLYSIS_EC50=6` blev også rettet.

### NOTE — Kontrareguleringscap-kommentar modsiger koden
**Fil:** `simulator.js:2909` vs. `2937`
**Problem:** Forklaringsblokken siger "Cap sat til 2.0 (vs. ~5.0 hos raske)", men
implementeringen capper `acuteStressLevel` til `Math.min(0.4, …)` (linje 2937), og en
senere kommentar (linje 2921) siger korrekt "Cap sat lavt (0.4)". De to tal (2.0 og 0.4)
i samme metode forvirrer.
**Forslag:** Fjern/ret "2.0"-referencen så den matcher den faktiske 0.4-cap.
**STATUS:** ✅ FIKSET (2026-06-08) — `js/simulator.js` angiver nu samme 0.4-cap i begge
kommentarblokke.

### NOTE — F_01c tillader let superbasal hjerneforbrug ved hyperglykæmi
**Fil:** `hovorka.js:385-386`
**Problem:** `F_01c = (F_01/0.85) × G/(G+1)` giver ~1.07× F_01 ved G=10 og asymptotisk
1.18× F_01. BG-SCIENCE §4 holder CMRglc tilnærmelsesvis konstant — hjernens
glukoseforbrug stiger ikke ved hyperglykæmi. Effekten er lille (≤18%) og allerede
selv-noteret i koden som en mulig fremtidig forbedring.
**Forslag:** Overvej en clamp `F_01c = min(F_01, F_01s × G/(G+1))` hvis man vil fjerne
den lille superbasal-drift. Lav prioritet — påvirkningen på BG er marginal.
**STATUS:** ⚠️ ACCEPTABEL

### NOTE — Basal-rate-divisor er ikke robust over for korte basal-varigheder
**Fil:** `simulator.js:1752-1753`
**Problem:** `effectiveArea = totalDuration − timeToPlateau/2 − tailOffDuration/2 =
totalDuration − 240 min`. Hvis en basal-insulin nogensinde fik `totalDuration < 4 t`,
ville `rate` blive negativ/uendelig. I dag er det sikkert, fordi `addLongInsulin`
clamper varigheden til 22–38 t (linje 2823). Men hvis der senere tilføjes en kort-
virkende "basal" (fx NPH ~12 t er stadig ok, men en hypotetisk <4 t ville fejle), er
der ingen guard.
**Forslag:** Tilføj `effectiveArea = Math.max(rampUp/2 + tailOff/2 + 1, …)` eller en
eksplicit guard, hvis valgbare insulintyper (TODO linje 1734) implementeres. Ingen
handling nødvendig for nuværende parametre.
**STATUS:** ⚠️ ACCEPTABEL

---

## Samlet status-opsummering

| # | Niveau | Fund | Status |
|---|--------|------|--------|
| 1 | ADVARSEL | Hastigheds-afhængig granularitet i skades-/kontrareg-akkumulatorer | ✅ FIKSET |
| 2 | NOTE | Stale lipolyse-EC50 i kommentarer (10/8/6 vs. faktisk 5) | ✅ FIKSET |
| 3 | NOTE | Kontrareg-cap-kommentar siger 2.0, koden capper 0.4 | ✅ FIKSET |
| 4 | NOTE | F_01c let superbasal ved hyperglykæmi (≤18%) | ⚠️ ACCEPTABEL |
| 5 | NOTE | Basal-rate-divisor ikke robust ved varighed < 4 t (ingen aktuel risiko) | ⚠️ ACCEPTABEL |
| — | OK | EGP-reformulering matematisk konsistent med Hovorka | ⚠️ BY DESIGN |
| — | OK | Keton-pathway bounded, faste-ketose ≠ DKA korrekt | ⚠️ BY DESIGN |
| — | OK | Per-bolus depots + basal-skygge-kaskade (superposition) | ⚠️ BY DESIGN |
| — | OK | Lever-glykogen massebalance + insulin-gates | ⚠️ BY DESIGN |

**Hovedanbefaling:** Fund #1 (ADVARSEL) er nu implementeret — skades- og
kontrareguleringsmodellerne integreres per substep (dt ≤ 1 min) uafhængigt af
spilhastighed/hardware, verificeret mod fin-tick-referencen. Fund #2–#3 var ren
kommentar-oprydning og er fikset. Fund #4–#5 er lav-risiko og kan udskydes.
