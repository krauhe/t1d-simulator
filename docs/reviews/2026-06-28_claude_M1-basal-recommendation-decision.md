# M1 — Anbefalet basal vs. modellens faktiske basal-behov (review + fix-decision-doc)

**Dato:** 2026-06-28
**Type:** Model-/motor-ændring (motor-lag) — rammer både desktop og mobil
**Gren:** `mobile-version`
**Forfatter:** Claude (fysiologi-review skill)

> Fælles dokument for Claude Code og Codex. Skrevet selvstændigt — ingen samtale-kontekst.
> Et værktøj kan overtage koldt. Dette dokument fungerer som BÅDE fysiologi-reviewet og
> fix-decision-doc'et for M1.

---

## Baggrund / scope

Symptom rapporteret af brugeren: på kampagnebane 2 ender blodsukkeret på ~13 mmol/L før
opvågning pga. dawn-effekten, selv når man følger den anbefalede basal — "ret voldsomt".

Hypotese (fra git-arkæologi): commit `a8a8bff` (2026-06-14) skiftede muskel-glukoseoptaget
fra lineært til ikke-lineært (Hill, `EC50_muscle=55`, `n=1.5`), kalibreret til at matche den
gamle lineære respons ved bolus-toppen (`IREF_MUSCLE=35` mU/L). Ved basal-koncentrationer
(~6-8 mU/L) er muskel-optaget nu meget svagere — en "dead zone". Den anbefalede basal
(`basalDose = round(min(100/ISF, vægt·0.55)·0.45)` i `js/physiology-engine.js:377-380`) blev
aldrig koblet om. Hypotesen var: anbefalet basal er nu for lav → BG kører højt.

Reviewet læste `js/hovorka.js` (Hill-led + `steadyStateActions` + `initializeSteadyState`)
og `js/physiology-engine.js` (basal-anbefaling), og kørte kvantitative steady-state- og
natte-simuleringer for at teste hypotesen.

---

## OK — Muskel-Hill "dead zone" er fysiologisk KORREKT (skal ikke fjernes)

**Fil:** `js/hovorka.js:120-149, 365-376`

Hill anvendes KUN på muskel-kanalen (x1, x2 = glukose-Rd). Leveren (x3 = EGP-suppression)
holdes **lineær**. Det er fysiologisk rigtigt:

- Perifert (muskel) glukoseoptag rekrutteres **sent** — dosis-respons EC50 ~50-60 mU/L
  (Rizza et al. 1981, *Am J Physiol* — insulin dose-response for glucose disposal). Ved
  faste/hvile og basal-insulin er muskel-Rd lille; det meste faste-glukoseforbrug er
  insulin-uafhængigt (hjerne ~120 g/døgn).
- Hepatisk EGP-suppression rekrutteres **tidligt** — EC50 ~30 mU/L, halv-maksimal allerede
  ved lav-normale insulin-niveauer (Rizza 1981; Edgerton et al. 2006). At holde x3 lineær
  betyder at basal-insulin STADIG undertrykker leverens glukoseproduktion ved basal-niveau,
  hvilket er den dominerende basal-effekt fysiologisk.

Den gamle lineære muskel-model OVERvurderede basal-muskel-optaget. Hill-ændringen gjorde
muskel-fysiologien mere korrekt. **At sænke `EC50_muscle` eller fjerne dead-zonen ville
gøre muskel-optaget urealistisk stærkt ved hvile — det er den forkerte rettelse.**

**STATUS:** ⚠️ BY DESIGN — bevares.

---

## ADVARSEL (KERNEFUNDET) — Den anbefalede basal er AFKOBLET fra modellens faktiske basal-behov

**Fil:** `js/physiology-engine.js:377-380` (heuristik) vs. `js/hovorka.js:241-288`
(`initializeSteadyState` → `steadyStateBasalRate`)

Modellen beregner ALLEREDE den korrekte basal: `initializeSteadyState()` løser via
binær-søgning for den basal-rate (`steadyStateBasalRate`, mU/min) der holder BG på 5.5.
Men den player-vendte anbefaling bruger en uafhængig klinisk heuristik (`TDD·0.45`) der
ikke er koblet til den. De to divergerer — og **i begge retninger** afhængigt af profilen:

| Profil (vægt/ISF) | Anbefalet (U/døgn) | Modellens flade-BG-behov (U/døgn) | Ratio | Konsekvens |
|---|---|---|---|---|
| 70 / 3.0 (standard) | 15 | 13.5 | 1.11 (11% OVER) | Natlig nadir 3.3 (let hypo) |
| 60 / 4.0 (følsom)   | 11 | 8.9  | 1.23 (23% OVER) | Endnu mere over-doseret |
| 90 / 2.0 (resistent)| 22 | 24.9 | 0.88 (12% UNDER) | BG kører højt |

**Evidens (natte-simulering, standard-profil, anbefalet basal 15 U, ingen mad):**
BG 5.5 → nadir **3.3 @ kl. 04** (let hypo) → dawn løfter til 5.4 @ kl. 09 → drift 4-5 resten
af dagen. Dvs. for standard-patienten er den anbefalede basal snarere **lidt for stærk** —
ikke for svag. Dawn-stigningen er blid og realistisk (3.8→5.4), IKKE 13.

Den oprindelige hypotese ("basal for lav → BG 13") holder altså **kun for insulin-resistente
profiler** (hvor heuristikken under-anbefaler). For standard/følsom er den OVER, hvilket giver
en uopdaget natlig hypo. Brugerens BG-13 er profil-specifik og forstærkes sandsynligvis af
bane 2's `physics.basalPreInjected` (basal pre-injiceret ved start) + brugerens egne handlinger.

**STATUS:** ✅ FIKSET (2026-07-22) — A1e koblede i 2026-06-29 tallet til
`steadyStateBasalRate`, men manglede korrektionen for 0,82-biotilgængelighed.
Opfølgningen skelner nu eksplicit mellem effektivt behov og injektionsbehov.

---

## NOTE — Sekundære fund

- **Basal-depot har en peak:** Natte-nadiren (3.3) ved en ENKELT lang-virkende injektion
  tyder på at depot-kinetikken har en peak/trough frem for en flad rate. Adskilt fra
  total-dosen; relevant hvis natlige hypoer skal undgås. **STATUS:** ❌ ÅBEN (lav prioritet).
- **Dawn-magnitude:** I alle test var dawn-stigningen blid (≤ +2-3 mmol/L) med tilstrækkelig
  basal. Dawn er ikke i sig selv årsag til BG-13. **STATUS:** ⚠️ ACCEPTABEL.
- **`basalPreInjected` (bane 2):** levelen pre-injicerer basal; samspillet med den viste
  anbefaling bør verificeres mod brugerens faktiske profil for at reproducere BG-13 præcist.
  **STATUS:** ❌ ÅBEN (opfølgning).

---

## Beslutning (implementeret 2026-06-29, korrigeret 2026-07-22)

**Kobl den anbefalede basal til modellens egen `steadyStateBasalRate`** i stedet for
`TDD·0.45`-heuristikken. Konkret: udled `basalDose` (U/døgn) fra `steadyStateBasalRate`
(mU/min × 1440 / 1000), evt. med en lille margin, så den anbefalede basal er den dosis der
faktisk holder BG fladt i modellen.

**Hvorfor denne retning (hverken ren A eller ren B):**
- Det er den fysiologisk ærlige løsning: anbefalingen = modellens sande basal-behov.
- Det retter BEGGE fejl-retninger på én gang (resistent under-dosering OG standard/følsom
  over-dosering → den natlige hypo).
- Det respekterer den fysiologisk korrekte muskel-dead-zone (rører den ikke).
- Det er "løs det i motoren" (CLAUDE.md): motoren har allerede svaret — eksponér det.
- **Afvist:** (A) blindt skrue anbefalingen op — for standard/følsom er den allerede over.
  (B) sænke `EC50_muscle` / fjerne dead-zonen — fysiologisk forkert (muskel-Rd skal være
  lille ved hvile).

**Verifikation før implementering:** at den udledte U/døgn er klinisk plausibel
(~0.3-0.5 U/kg/døgn basal) på tværs af profiler, og at den lukker BG-13 på bane 2 med
brugerens profil uden at skabe natlig hypo.

**Resterende, separat:** basal-depotets peak/trough-form (natlig nadir) + `basalPreInjected`-
samspillet på bane 2.

---

## Samlet status

| Fund | Prioritet | Status |
|---|---|---|
| Muskel-Hill dead-zone | — | ⚠️ BY DESIGN (bevares) |
| Anbefalet basal afkoblet fra modellens behov | ADVARSEL | ✅ FIKSET 2026-07-22 (effektivt behov + injektionsbehov) |
| Basal-depot peak → natlig nadir | NOTE | ❌ ÅBEN (lav) |
| Dawn-magnitude | NOTE | ⚠️ ACCEPTABEL |
| `basalPreInjected` bane 2-samspil | NOTE | ❌ ÅBEN (opfølgning) |

---

## Implementering (2026-06-29) — A1e

Fix landet: `js/physiology-engine.js` `initSteadyState()` sætter nu
`basalDose = max(1, round(hovorkaSteadyStateBasalRate × 1440 / 1000))` umiddelbart efter
steady-state-søgningen, i stedet for konstruktørens kliniske `TDD·0.45`. `estimatedTDD`
beholder det kliniske estimat (vises ikke længere til spilleren). Basal-DEPOTET var allerede
kalibreret til `steadyStateBasalRate` (simulator.js pre-injektion L870), så **sim-dynamikken
er uændret** — kun det anbefalede/viste tal. Verificeret: 161/161 tests (test
`estimatedTDD uses min-of-two-rules; basalDose is the model steady-state need` omskrevet til
at asserte steady-state-kontrakten i stedet for den gamle formel), ingen konsol-fejl,
profil-UI bekræftet i preview i begge shells.

Effekt pr. arketype (vist anbefalet basal, før → efter):

| Arketype | Vægt/ISF | Klinisk (før) | Steady-state (efter) |
|---|---|---|---|
| Barn | 40 / 4.0 | 10 E | 6 E |
| Voksen | 70 / 3.0 | 15 E | 13 E |
| Kraftig voksen | 100 / 2.0 | 23 E | 28 E |

Bekræfter begge fejl-retninger: klinisk **overdoserede** følsom/standard, **underdoserede**
resistent — A1e retter begge.

### Opfølgende korrektion (2026-07-22)

A1e var kun delvist korrekt: `steadyStateBasalRate x 1440 / 1000` er den effektive
mængde, som Hovorka-modellen skal modtage. En spillerinjektion passerer derefter
gennem `sessionBioavBasal = 0.82`, så 13 U leverede kun 10,66 effektive enheder for
standardprofilen. Kontrakten er derfor suppleret med:

```text
effectiveBasalRequirement = steadyStateBasalRate x 1440 / 1000
basalInjectionRequirement = effectiveBasalRequirement / 0.82
basalDose                  = round(basalInjectionRequirement)
```

De tre aktuelle kropsprofiler bruger nu 7, 16 og 34 U. I det deterministiske
3-døgnsforløb fra bane 1 slutter de ved 6,10, 5,91 og 5,29 mmol/L og forbliver i
intervallet 3,5-7,0 mmol/L. Se den fulde diagnose og før/efter-verifikation i
`docs/reviews/2026-07-22_basal-dose-contract-fix.md`.

Resterende (separat, uændret): basal-depotets peak/trough → natlig nadir; `basalPreInjected`
bane 2-samspil.

**Kilder:** Rizza RA et al. 1981, *Am J Physiol* 240:E630 (insulin dose-response, hepatisk vs.
perifer glukose-disposal, EC50'er); Edgerton DS et al. 2006 (hepatisk insulin-følsomhed).
