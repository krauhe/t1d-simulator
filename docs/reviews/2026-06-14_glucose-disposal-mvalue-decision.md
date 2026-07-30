# Glukose-disposal M-værdi — recalibrerings-beslutning

**Dato:** 2026-06-14
**Type:** Beslutnings-doc (forslag — afventer godkendelse + et verifikations-skridt FØR implementering)
**Status:** ✅ AFKLARET (2026-06-14) — §1-verifikation gennemført: M-værdi-adfærden er BY DESIGN i den validerede Hovorka 2004. **Beslutning: Mulighed C — behold kernen, dokumentér. INGEN rekalibrering.** Se §1-RESULTAT.
**Berørte filer (potentielt):** `js/hovorka.js` (disposal-led + insulin-aktions-kinetik), `tests/simulation.test.js`, `tests/model-validation.html`, `docs/MODEL-IMPLEMENTATION.md`
**Måleværktøj:** stepped euglykæmisk clamp, kapitel N i `tests/model-validation.html`
**Relateret:** [2026-06-14_claude_insulin-action-physiology.md](2026-06-14_claude_insulin-action-physiology.md)

---

## Baggrund — det bekræftede fund

Det euglykæmiske clamp-instrument (BG=5.5, deterministisk, ingen circadian) måler modellens steady-state glukose-disposal som klinisk M-værdi:

| Insulin (mU/L) | Model M (mg/kg/min) | Fysiologisk (DeFronzo clamp) |
|---|---|---|
| 30 | 6.0 | — |
| 60 | **14.3** | **~5-8** |
| 90 | 20.2 | ~8-10 |
| 150 | 26.7 | loft ~12-15 |

**Fundet:** modellens insulin-stimulerede disposal er **~2-2.5× fysiologisk** ved fast insulin, og M-værdien **mætter ikke** (stiger lineært mod et urealistisk højt loft). Målt ved euglykæmi, så det er ikke BG=8-confounderen.

**Vigtigt forbehold:** dette er den **validerede Hovorka 2004 Cambridge-model** med nominelle parametre. ISF og BG-trajektorier er korrekte (155 tests + 40 validation-sektioner). Diskrepansen er specifik for det *steady-state clamp*-paradigme.

## Den centrale fysiologiske spænding

ISF (korrekt) og M-værdi (2× høj) er **begge** "disposal ved BG~5.5" — men i to regimer:

- **ISF** = BG-fald fra et **transient** bolus. Insulin-aktionerne x1/x2 (τ_x1 ≈ 167 min) når aldrig deres fulde værdi i et bolus, så det er INTEGRALET af disposal over bolussen der bestemmer ISF.
- **M-værdi** = disposal ved **vedvarende** (clamp) insulin, hvor x1/x2 er fuldt engageret.

Modellen rammer korrekt ISF med **høj per-insulin gain + langsom kinetik** (x engagerer langsomt og delvist i et bolus). Fysiologien har **lavere gain + hurtigere kinetik**. De to kan kun matche BEGGE paradigmer hvis kinetik OG gain rebalanceres samtidigt — det er kernen i udfordringen.

**Konsekvens for gameplay:** for typiske boluser er ISF korrekt (transient). For STORE/vedvarende insulin-niveauer (stacked boluser, høj basal) sænker modellen BG for hurtigt.

## Rod-årsager (to, delvist uafhængige)

1. **Disposal-leddene `x·Q` er lineære i glukose** — ingen GLUT4-Km-mætning (Km ≈ 5 mmol/L). Dette giver intet fysiologisk loft: M stiger uden grænse med både BG og insulin. (Standard Hovorka-forenkling.)
2. **Gain/kinetik-balancen** giver høj sustained-disposal (det transient-vs-sustained-problem ovenfor).

---

## §1 — KRITISK FØRSTE SKRIDT (verifikation, FØR nogen kode-ændring)

**Spørgsmål: er M ~14 mg/kg/min ved I=60 en accepteret egenskab ved publiceret Hovorka 2004, eller en afvigelse i VORES implementering/parametrisering?**

Dette afgør alt. Hvis research-Hovorka selv giver ~14, så er det en kendt model-karakteristik (valideret til MPC/kontrol, ikke til clamp-M), og en rekalibrering ville **afvige fra den validerede standard** — potentielt gøre modellen mindre, ikke mere, valideret. Hvis research-Hovorka giver ~6-7, er vores implementering drevet væk og bør korrigeres.

**Handling:** Læs `docs/references/Hovorka_2004_NonlinearMPC.pdf` + evt. Hovorka's senere clamp/validerings-papers. Find publicerede disposal/M-værdier eller SI-parametre, og sammenlign vores effektive disposal med deres. Brug clamp-instrumentet til at reproducere et publiceret Hovorka-scenarie hvis muligt.

Først NÅR dette er afklaret giver det mening at vælge mellem mulighederne nedenfor.

### §1-RESULTAT (2026-06-14) — afgørende

Læst `Hovorka_2004_NonlinearMPC.pdf`. Svaret er entydigt: **M-værdi-adfærden er en accepteret, bevidst egenskab ved den validerede Hovorka 2004-model — ikke en afvigelse i vores implementering.**

1. **Vores parametre er EKSAKT Hovorka 2004's nominelle.** Table 1 + 2 i papiret: `S_IT = 51.2e-4`, `S_ID = 8.2e-4`, `S_IE = 520e-4`, `k_a1 = 0.006`, `k_a2 = 0.06`, `k_a3 = 0.03`, `k_12 = 0.066`, `k_e = 0.138`, `V_I = 0.12`, `V_G = 0.16`, `EGP_0 = 0.0161`, `F_01 = 0.0097`, `t_max,I = 55` — alle identiske med vores. Glukose-ligningerne (eq. 1) og disposal-strukturen (`x2·Q2`, lineær i glukose) er identiske.

2. **Den ikke-mættende disposal ved høj insulin er BY DESIGN.** Hovorka §2.6 ordret: *"when insulin-dependent disposal dominates such as at postprandial conditions (plasma insulin >50 mU L⁻¹) insulin has a nearly proportional effect on whole-body glucose disposal."* Den manglende GLUT4-Km-mætning (rod-årsag 1) er altså et eksplicit modelvalg, ikke en fejl. Vores clamp-fund (M stiger lineært ved I>50) er præcis den tilsigtede adfærd.

3. **Nonlineariteten er kalibreret til rigtige tracer-data** (Hovorka 2002 dobbelt-tracer IVGTT): insulin-afhængigt optag ~13% af total glukose-turnover ved basal; +50% basal-insulin → +7% whole-body disposal. Disposal-parametrene er altså IKKE frie tal — de er fittet til human glukose-kinetik.

4. **Modellen er valideret** mod 15 kliniske eksperimenter (Clarke error grid: 95% zone A) — men for glukose-*prædiktion/kontrol*, ikke mod euglykæmiske clamp-M-værdier.

**Konsekvens:** vores ~2× afvigelse fra DeFronzo-clamp-M er den validerede Hovorka-models egen adfærd (T1D-model fittet til tracer-data vs. healthy-subject-clamp — delvist æbler/pærer), OG den bevidste mangel på høj-insulin-mætning. At rekalibrere (Mulighed A eller B) ville **afvige fra den validerede standard-model** → potentielt gøre modellen mindre, ikke mere, fysiologisk forankret. Verifikationen forhindrede altså en uforsvarlig ændring af en valideret kerne — præcis hvorfor §1 skulle laves først.

**Beslutning: Mulighed C.** Behold Hovorka-kernen uændret. Dokumentér clamp-M-karakteristikken som en kendt, by-design model-begrænsning (gælder kun vedvarende suprafysiologisk insulin, som ikke optræder i normalt gameplay). Trajektorie/ISF-validering — som allerede er opnået — er det rigtige mål for spillets formål.

## §2 — Løsningsmuligheder (afhænger af §1)

**Mulighed A — GLUT4-Km-mætning på disposal (fysiologisk forankret).**
Erstat `x·Q` med `x·Q·Km/(Km+G)` (Km ≈ 5 mmol/L). Giver et fysiologisk loft og BG-mætning. NB: ved fast euglykæmi (G=5.5) er Km-faktoren en konstant (~0.48), så den ALENE ændrer ikke den euglykæmiske M-værdi hvis gainet samtidig retunes for at bevare trajektorier — men den retter det manglende loft og BG-afhængigheden (rod-årsag 1). Medium risiko.

**Mulighed B — kinetik/gain-rebalancing (adresserer rod-årsag 2).**
Hurtigere insulin-aktions-kinetik (højere k_a) + lavere gain (lavere S), retunet så ISF bevares men sustained-M sænkes. Høj risiko: rører den validerede Hovorka-kinetik, ændrer onset/peak/varighed af insulin-effekt, og bryder sandsynligvis mange af de 155 tests + trajektorie-sektioner.

**Mulighed C — accepter som model-begrænsning, dokumentér den.**
Hvis §1 viser at det er en accepteret Hovorka-egenskab, og det ikke mærkbart skader gameplay: dokumentér diskrepansen i MODEL-IMPLEMENTATION.md og lad kernen være. (Lav risiko, ærlig.)

## §3 — Valideringsstrategi (dobbelt-binding)

Enhver ændring SKAL valideres mod BEGGE:
1. **Clamp-instrumentet (kapitel N):** M-værdi-kurven skal lande i fysiologisk range (~5-8 ved I=60, loft ~12-15) OG mætte.
2. **De 155 tests + nøgle-trajektorie-sektioner:** ISF (~3 mmol/L/E), måltids-respons, motion, ketoner — skal forblive inden for tolerance.

Dette er en **constrained re-tuning** (Km, S, k_a per kanal mod to sæt mål), ikke et simpelt parameter-skift. Forventeligt iterativt.

## §4 — Risiko-vurdering

| Mulighed | Fysiologisk gevinst | Risiko | Bryder sandsynligvis |
|---|---|---|---|
| A (Km-mætning) | BG-loft + saturation | Medium | Hyperglykæmi-disposal-tests, FFA/glucotox-interaktion |
| B (kinetik/gain) | Korrekt sustained-M | **Høj** | ISF-tests, insulin onset/peak/varighed, mange trajektorier |
| C (accepter) | Ærlighed | Lav | Intet |

## §5 — Anbefaling

**Lav §1 (verifikation) FØRST.** Det er nul-risiko og kan ændre hele billedet. Min hypotese: en del af de 2× er en accepteret Hovorka-clamp-egenskab (modellen er valideret til kontrol, ikke clamp-M), OG en del er den manglende GLUT4-Km-mætning. Hvis det holder, er **Mulighed A** (Km-mætning, medium risiko, fysiologisk klart) den rigtige første kode-ændring, og **Mulighed B** (kinetik/gain) bør kun overvejes hvis A ikke er nok OG §1 viser en reel afvigelse fra standard-Hovorka.

**Rør IKKE den validerede Hovorka-kinetik (Mulighed B) før §1 + A er afklaret.** Kernens validering er for værdifuld til at brække for en metrik der ikke manifesterer sig i normalt gameplay.

## Åbne spørgsmål / beslutningspunkter

1. Skal jeg udføre §1 (læs Hovorka 2004 + reproducer publiceret clamp-adfærd) som næste handling?
2. Afhængigt af §1: går vi efter Mulighed A (Km-mætning), B (fuld re-tuning), eller C (dokumentér som begrænsning)?
3. Er clamp-level fysiologisk korrekthed et reelt mål, eller er trajektorie/ISF-korrekthed (allerede opnået) tilstrækkeligt for spillets formål?

---

*Næste handling afventer brugerens svar på §1-spørgsmålet. Ingen kode-ændringer foretaget.*
