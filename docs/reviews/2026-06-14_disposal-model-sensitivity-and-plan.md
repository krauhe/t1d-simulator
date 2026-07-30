# Disposal-model — sensitivitets-analyse + ændrings-plan

**Dato:** 2026-06-14
**Type:** Planlægnings-/beslutnings-doc med sensitivitets-analyse
**Status:** ❌ ÅBEN (forslag — afventer beslutning)
**Måleværktøj:** euglykæmisk stepped clamp (kapitel N i `tests/model-validation.html`)
**Relaterede:** [insulin-action-review](2026-06-14_claude_insulin-action-physiology.md), [M-værdi-beslutning](2026-06-14_glucose-disposal-mvalue-decision.md), [dead-zone/Hill-beslutning](2026-06-13_nonlinear-insulin-dose-response-decision.md)

## Formål

Vurdere kandidat-ændringer til muskel-disposal-modellen gennem **to filtre samtidig**:
1. **Fysiologisk korrekthed** (mod clamp-litteratur).
2. **Åbner det for ny læring af et fænomen?** (brugerens eksplicitte krav: kompleksitet er kun det værd hvis den lærer spilleren noget nyt).

## Sensitivitets-analyse (faktiske tal)

Euglykæmisk clamp (BG=5.5), M-værdi i mg/kg/min. Fysiologisk ~5-8 ved I=60, loft ~12-15. "Dead-zone-index" = M@20/M@60 (lav = stærk dead zone). Baseline matcher N.3-instrumentet (M@60≈14.3).

| Parametersæt | M@10 | M@20 | M@30 | M@60 | M@90 | M@150 | dead-zone-idx |
|---|---|---|---|---|---|---|---|
| Baseline (EC50=55, n=1.5, gain=1.0) | 0.4 | 3.2 | 6.2 | 14.5 | 20.5 | 27.0 | 0.22 |
| Skarpere n=2.5 | 0.1 | 1.9 | 5.2 | **24.5** | 39.5 | **50.6** | 0.08 |
| Højere EC50=80 | 0.3 | 2.9 | 6.0 | 16.8 | 26.9 | 40.1 | 0.17 |
| Lavere gain ×0.5 | 0.1 | 1.8 | 3.0 | **5.6** | 7.6 | **9.9** | 0.31 |
| Dead-zone combo (80, 2.5, 1.0) | 0.1 | 1.8 | 4.9 | **35.1** | 75.8 | **122.1** | 0.05 |
| Fys+deadzone (80, 2.5, 0.5) | 0.1 | 1.4 | 2.6 | 12.9 | 29.0 | **48.7** | 0.11 |

### Det centrale fund — et hårdt trade-off

**Man kan ikke få både en skarp dead zone OG en fysiologisk M-værdi med disposal-parametrene:**

- **Skarpere dead zone (højere n/EC50) får M-værdien til at EKSPLODERE ved høj insulin.** n=2.5 → M@150 = 50.6; dead-zone-combo → M@150 = 122 (absurd). En skarp dead zone er fysiologisk uholdbar.
- **Kun lavere gain (×0.5) giver fysiologisk M** (M@60=5.6, M@150=9.9 — i/nær range) — men det **svækker dead zone** (idx 0.31) OG halverer ISF (kræver kinetik-retuning for at bevare ISF).
- **Ingen af parametrene tilføjer et høj-insulin LOFT.** M bliver ved at stige (kun lavere gain bremser den). Et ægte fysiologisk disposal-loft kræver GLUT4-Km-mætning — men ved fast clamp-BG er Km en konstant, så den ændrer ikke clamp-M-kurvens stigning med insulin.

**Fysiologien siger: dead zone ER blød.** Rizza-n≈1.5 (baseline idx 0.22) er en gradvis S-kurve. At gøre den dramatisk (idx <0.1) kræver n≥2.5 — som hverken er fysiologisk (muskel-Rd er ikke en kontakt) eller M-værdi-foreneligt.

## Kandidat-ændringer gennem dobbelt-filteret

| Ændring | Fysiologisk gevinst | Åbner ny læring? | Risiko | Verdikt |
|---|---|---|---|---|
| **Skærp dead zone** (n↑/EC50↑) | NEGATIV (M eksploderer) | "Dead zone" tydeligere | Høj | **NEJ** — bryder fysiologi |
| **Lavere gain → fys. M** (+kinetik-retune) | Ja (M→5.6) | NEJ — clamp er ikke gameplay; spilleren mærker ikke sustained-M | Høj (ISF, kinetik, 155 tests) | **NEJ** — ingen ny læring, høj risiko |
| **GLUT4-Km-mætning** | Ja (BG-loft på disposal) | Marginalt — "høj BG → korrektion mindre effektiv" læres ALLEREDE via `glucotoxicResistanceFactor` | Medium (rør hypo-regime; se note) | **MARGINAL** — overlapper glucotox |
| **EGP-gulv** (residual GNG) | Lille | Næsten ingen | Lav | **NEJ** — for lille gevinst |

**Note (GLUT4-Km hypo-fælde):** En naiv Km-faktor øger disposal i hypo-området (matematisk verificeret) — farligt. En korrekt implementering skal håndtere hele BG-rækken, hvilket gør den medium-risiko, ikke triviel.

## Hvad får vi — ærligt

**Ingen af kandidaterne passerer klart begge dine filtre.** Konkret:

- En **tydelig dead zone** kan ikke laves uden at bryde fysiologien (skarp n) — så den må forblive blød. Det er det fysiologien faktisk siger.
- **Fysiologisk M-værdi** kan opnås (lavere gain), men det åbner **ingen ny læring** (spilleren laver ikke clamps; effekten ses kun ved store/vedvarende insulin-niveauer som er sjældne i spil) og er højrisiko.
- **GLUT4-Km** ville lære "korrektioner er mindre effektive ved høj BG" — men det fænomen er **allerede** i spillet via glukotoksicitet. Lav merlæring.

## Anbefaling

**Behold disposal-modellen som den er.** Begrundelse, gennem dine egne filtre:
1. Dead zone er reel og til stede (blødt, fysiologisk korrekt — N.1/N.3 viser det). At gøre den dramatisk ville være un-fysiologisk.
2. De fysiologiske forfininger (M-værdi, Km, EGP-gulv) åbner ikke nye lærbare fænomener der ikke allerede er dækket — så kompleksiteten er ikke det værd (dit eget kriterium).
3. Clamp-instrumentet (kapitel N) er den blivende gevinst: vi kan nu MÅLE enhver fremtidig ændring mod fysiologi.

**Hvis dead zone skal være mere mærkbar for spilleren**, er det rigtige håndtag **ikke** at gøre fysiologien skarpere, men **UI/feedback** — fx en visuel/tekstuel hint når en lille korrektion lander i dead zone og en efterfølgende dosis så crasher BG (insulin-stacking-læringen). Det er en separat, lav-risiko UI-opgave der lærer fænomenet UDEN at forfalske fysiologien.

## Åbne spørgsmål

1. Er du enig i "behold modellen + flyt dead-zone-læringen til UI/feedback"? Eller vil du have en af de fysiologiske ændringer alligevel (fx GLUT4-Km for konsistensens skyld, selv med lav merlæring)?
2. Hvis UI/feedback-vejen: skal jeg lave et separat forslag for en dead-zone/stacking-hint i spillet?
