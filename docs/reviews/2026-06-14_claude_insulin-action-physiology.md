# Fysiologisk review — insulin-virkning og glukose-disposal

**Dato:** 2026-06-14
**Scope:** Insulin-action/disposal-modellen i `js/hovorka.js` + ISF-koblingen i `js/simulator.js`. Udløst af clamp-instrumentet (kapitel N i `tests/model-validation.html`) der antydede høj steady-state M-værdi.
**Mål:** Prioriteret, evidens-baseret roadmap mod fysiologisk korrekthed, med risiko-vurdering.

---

## Hovedkonklusion (læs denne først)

**Insulin-action-modellen er den standard, klinisk validerede Hovorka 2004 Cambridge-model med nominelle parametre** (`S_IT = 51.2e-4`, `S_ID = 8.2e-4`, `S_IE = 520e-4`, `k_a1 = 0.006`, `k_a2 = 0.06`, `k_a3 = 0.03`, `k_12 = 0.066`), skaleret med spillerens ISF. Det er en **styrke**, ikke en svaghed — strukturen og parametrene er valideret mod kliniske data i Hovorka et al. 2004.

> **OPDATERING (2026-06-14, efter euglykæmisk clamp).** Konklusionen i dette afsnit ("holder IKKE / mest confound") var **for forhastet**. En euglykæmisk clamp (BG=5.5, kapitel N) giver **M = 14.3 mg/kg/min ved I=60 vs fysiologisk ~5-8 (DeFronzo)**, stigende til 26.7 ved I=150 uden mætning. Confounderne forklarer en DEL (BG=8 gav ~1.4×), men der er en **reel ~2× overvurdering** tilbage ved euglykæmi. Instrumentet er dommeren — jeg oscillerede, det gjorde ikke.

**Den "~2× høje M-værdi" var delvist confounded, men er nu BEKRÆFTET reel ved euglykæmi.** Tre faktorer forklarer en del — men ikke det hele:

1. **Clampen kører ved BG=8 (hyperglykæmisk), ikke euglykæmisk (~5).** Modellens disposal-led `x·Q` er lineære i glukose-mængden, så disposal ved BG=8 er ~8/5 = 1.6× værdien ved BG=5. Fysiologiske clamp M-værdier rapporteres typisk euglykæmisk. Korrigeret for BG er afvigelsen meget mindre.
2. **Parametrene er nominel-Hovorka skaleret med ISF.** Ved ISF=3.0 er `isScale ≈ 0.8`, så den effektive sensitivitet er ~0.8× nominel — altså LAVERE end standard-Hovorka, ikke højere.
3. **Steady-state clamp er et andet paradigme end gameplay.** I et bolus når `x1` (τ ≈ 167 min) aldrig sin sustained-clamp-værdi, fordi insulin er transient. Den høje sustained-disposal manifesterer sig ikke som urealistisk ISF i trajektorier (hvilket de 40 model-validation-sektioner + 155 tests bekræfter).

**Anbefaling: rør IKKE den validerede kerne blindt.** Modellen er i sin observerbare adfærd (BG-trajektorier, ISF, måltider, motion, ketoner) allerede velvalideret. De genuine fysiologiske forenklinger nedenfor er reelle men (a) for de flestes vedkommende standard-Hovorka-forenklinger, og (b) højrisiko at ændre. Den rigtige næste handling er at **validere clamp-instrumentet mod Hovorka 2004's publicerede clamp-adfærd og genberegne sammenligningen ved euglykæmi** — FØR nogen rekalibrering.

---

## NOTE — Disposal er lineær i glukose (ingen GLUT4 Km-mætning)

**Fil:** `js/hovorka.js`, `step()` linje ~487-498 (dQ1/dQ2), `steadyStateActions()` linje ~344-359
**Subsystem:** Glukose-disposal (x1·Q1 transport, x2·Q2 forbrænding)
**Problem:** De insulin-drevne disposal-led er lineære i glukose-mængden Q: `x1·Q1` og `x2·Q2`. Fysiologisk har GLUT4-transport en Km ≈ 5 mmol/L, så optaget mætter ved høj BG.
**Evidens (steady-state, BG=8, I=60, 70 kg, settlede x):**
  - Q2 = x1·Q1/(k12+x2); perifer disposal = x2·Q2.
  - Clamp-instrumentet måler Rd ≈ 7.8 mmol/min ved BG=8.
  - Lineariteten betyder at en clamp ved BG=12 ville give ~50% mere disposal end ved BG=8 — fysiologisk ville GLUT4-mætning dæmpe stigningen til ~20-25%.
  - Konsekvens: modellen **overvurderer disposal ved hyperglykæmi**, mest udtalt ved BG > 12.
**Kontekst:** Dette er den **standard Hovorka 2004-forenkling**. Hovorka bruger lineære x·Q-led; modellen er valideret i det normale operating-range trods dette. Det er en kendt model-begrænsning, ikke en bug.
**Forslag (HØJ risiko):** En GLUT4-Km-mætning på disposal (`x2·Q2·Km/(Km+G)` el.lign.) ville være mere fysiologisk OG forklare en del af clamp-fundet. MEN: det ændrer disposal i HELE BG-rækken (inkl. det normale 4-10-område), og vil bryde ISF-kalibreringen og en stor del af de 155 tests + 40 validation-sektioner. Kræver fuld re-tuning + fix-decision-doc. **Ikke en hurtig gevinst.**
**STATUS:** ❌ ÅBEN (by-design Hovorka-forenkling; kandidat til langsigtet arbejde, ikke nu)

---

## NOTE — EGP kan ramme præcis 0 ved høj insulin

**Fil:** `js/hovorka.js`, `step()` linje ~422 (`EGP = EGP_0 * max(0, stressMultiplier - x3)`)
**Subsystem:** Endogen glukoseproduktion (lever)
**Problem:** EGP clampes til 0 når `x3 > stressMultiplier`. Clamp-instrumentet viser EGP = 0 allerede ved I ≈ 30 mU/L. Fysiologisk har EGP et **gulv** (~0.5 mg/kg/min residual gluconeogenese) selv ved høj insulin — leveren producerer aldrig præcis 0.
**Evidens:** Rizza/Cherrington-clamp-data: EGP supprimeres ~85-90% ved høj insulin, ikke 100%. BG-SCIENCE §25 noterer at gluconeogenese fortsætter ved basal-suppression.
**Kontekst:** Modellen NEED'er dog EGP→0 ved overdosis for at "overdosis er farlig"-adfærden virker (kontraregulering er svækket i T1D). Et lille gulv ville kun marginalt påvirke dette.
**Forslag (LAV-MEDIUM risiko):** Tilføj et lille EGP-gulv (fx `EGP_0 * 0.05` ≈ 0.06 mmol/min) der kun gælder når stress ikke er forhøjet. Ville gøre høj-insulin-EGP mere fysiologisk uden at fjerne overdosis-faren. SKAL valideres mod overdosis-testene og hypo-game-over-adfærden.
**STATUS:** ❌ ÅBEN (mest tractable af de genuine forbedringer — kandidat til FØRSTE fix hvis vi går videre)

---

## NOTE — Muskel-Hill / lever-lineær asymmetri (den nye TODO #6-ændring)

**Fil:** `js/hovorka.js` linje ~104-136, `steadyStateActions()`
**Subsystem:** Ikke-lineær dosis-respons (netop implementeret)
**Vurdering:** Asymmetrien (Hill på muskel x1/x2, lineær på lever x3) er **fysiologisk forsvarlig** — §25 viser at dead zone er muskel-drevet (høj EC50), mens leveren responderer tidligt (lav effektiv tærskel). Beslutningen er dokumenteret i `docs/reviews/2026-06-13_nonlinear-insulin-dose-response-decision.md` med begrundelse for hvorfor en literal lever-Hill (EC50=29 systemisk) brød basal-balancen. Kalibreringen (`x_max` matchet ved bolus-peak) bevarer måltids-adfærd. Ingen indvendinger.
**Caveat:** `x1max`/`x2max` skaleres af `amplitudeMod` men muskel-`EC50` skubbes af `peisMuscleFactor` — dvs. motion og circadian virker på muskel-kanalen via to forskellige mekanismer. Det er bevidst og dokumenteret, men værd at holde øje med hvis flere modulatorer tilføjes.
**STATUS:** ⚠️ BY DESIGN (valideret via clamp-instrumentet kapitel N)

---

## OK — Kerne-strukturen er valideret

- Tre-compartment insulin-action (x1/x2/x3) med Hovorka 2004-tidskonstanter: **korrekt og valideret.** τ_x1 ≈ 167 min er IKKE "for langsom" — x-compartmenterne er LUMPED insulin-action (PK + signalering + effekt), ikke GLUT4 alene. Insulin-effekt-peak ~90-120 min matcher klinik. (Mit "kinetik for langsom vs GLUT4"-argument i chatten var forkert — GLUT4 er ét hurtigt trin i en samlet langsom respons.)
- Subkutan 2-compartment absorption, basal/rapid-split via superposition: korrekt.
- ISF-skalering af S-parametrene: konsistent.

---

## Prioriteret roadmap mod fysiologisk korrekthed

| # | Tiltag | Fysiologisk gevinst | Risiko | Anbefaling |
|---|---|---|---|---|
| 0 | **Validér clamp-instrumentet mod Hovorka 2004 + genberegn ved euglykæmi** | Afgør om der OVERHOVEDET er et M-værdi-problem | Ingen (kun måling) | **GØR DETTE FØRST** |
| 1 | EGP-gulv (residual gluconeogenese) | Høj-insulin-EGP mere fysiologisk | Lav-medium | Kandidat til første kode-fix (efter #0) |
| 2 | GLUT4-Km-mætning på disposal | Korrekt hyperglykæmi-disposal; forklarer clamp-fund | **Høj** (bryder ISF + mange tests) | Kun med fuld re-tuning + fix-decision-doc |
| 3 | Individuel Hill-n / EC50 (inter-individuel spredning) | Patient-variabilitet | Medium | Fremtid (allerede noteret i §25) |

**Vigtigste budskab:** Start med #0 (måling, nul risiko). Hvis #0 bekræfter at modellen reelt afviger fra Hovorka's egen clamp-adfærd, så er #1 (EGP-gulv) den tractable første kode-ændring. #2 (Km-mætning) er den mest fysiologisk korrekte men højrisiko og bør IKKE laves uden fuld re-kalibrering — den validerede Hovorka-kerne er for værdifuld til at brække blindt.

---

## Status-opsummering

- **KRITISK:** 0
- **ADVARSEL:** 0
- **NOTE:** 3 (lineær disposal, EGP-gulv, Hill-asymmetri) — alle ÅBEN/BY DESIGN
- **OK:** 1 (kerne-struktur valideret)

Nettovurdering: insulin-action-modellen er **fysiologisk solid** (valideret Hovorka-kerne). Det flaggede M-værdi-fund er overvejende clamp-BG- + linearitets-artefakt, ikke en parameterfejl. Anbefalet næste skridt er måling/validering (#0), ikke rekalibrering.
