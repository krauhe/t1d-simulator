# Late-phase PEIS fix — three-component sensitivity model

**Dato:** 2026-04-29
**Type:** Beslutnings-doc + post-mortem på fysiologisk model-fejl
**Status:** ✅ FIKSET (2026-04-29)
**Berørte filer:** `js/simulator.js`, `tests/simulation.test.js`, `docs/MODEL-IMPLEMENTATION.md`

---

## Bagrund

Brugeren bemærkede under en sandkasse-session at Resist.-linjen i fysiologi-mode "kommer for hurtigt op igen" efter motion. En fysiologisk gennemgang viste at den slow PEIS-komponent var koblet UDELUKKENDE til muskel-glykogen-reserven, og dermed kollapsede til baseline indenfor 3-6 t når patienten spiste CHO efter motion — i strid med Mikines 1988 og Cartee 2015's målinger af 25-50% øget insulin-følsomhed der persisterer i 24-48 t.

## Diagnose

### Litteratur-evidens (BG-SCIENCE.md §8)

Litteraturen identificerer **to fysiologisk distinkte post-exercise insulinfølsomhed-faser**:

- **Early phase (~1-4 t):** Mediated by enhanced insulin-stimulated glucose uptake without proximal signaling amplification. Glykogen-depletion er en "permissive condition" — CHO-refeeding "rapidly reverses the increment" (Wojtaszewski 2000, n=8 untrained men, one-legged exercise paradigm).

- **Late phase (~24-48 t):** *"Mediated by enhanced AS160 phosphorylation downstream of an unchanged proximal insulin signaling cascade"* (BG-SCIENCE.md linje 706, citing Cartee 2015 / Wojtaszewski 2000). Mikines 1988 (n=7 untrained men, sequential clamp) målte Km 52±3 → 40±3 μU/mL ved 48 t (-23%), Vmax 9.5±0.8 → 10.7±0.8 mg·min⁻¹·kg⁻¹ (+13%). Effekten ikke detekterbar ved 5 dage.

### Original design vs. faktisk implementering

Det oprindelige design fra `2026-04-13_exercise-sensitivity-design.md` linje 96-110 specificerede **fast eksponentiel decay med t½=14 t** for slow-komponenten, eksplicit citerende Mikines 1988. Dette var korrekt valgt.

Imellem 2026-04-13 og 2026-04-18 blev koden refaktoreret til at koble slow-komponenten til muskel-glykogen-pool: `slowBoost = A_slow × (1 - muscleGlycogenReserve)`. Argumentet i `2026-04-18_claude_full-physiology.md` (W1) var "PEIS-amplituden afhænger af aktuel muskel-glykogen-status, ikke session-historik." Beslutningen blev markeret som **BY DESIGN**.

Denne refactoring kollapsede de to fysiologisk distinkte faser i én glykogen-koblet komponent. **Det fjernede stille late-fasens kanal**, idet AS160-medieret PEIS er en covalent/fosforylerings-hukommelse uafhængig af glykogen-flux-signaler.

### Eksperimentel verifikation (før fix)

Headless Node-eksperiment i `tests/peis-verification.js` viste:

| Tid post-motion (Cardio Medium 30 min) | Mål (Cartee/Mikines) | Gammel model | Diskrepans |
|---|---|---|---|
| +1 t | 1.20-1.30 | 1.06 | -14% pp |
| +4 t (Wojtaszewski 4h target) | 1.10-1.18 | 1.00 | -10% pp |
| +5.5 t (klinisk nat-hypo-vindue) | ≥1.07 | 1.00 | klinisk relevant under-modellering |
| +24 t | 1.10-1.15 | 1.00 | -10 til -15% pp |
| +48 t (Mikines target) | 1.05-1.10 | 1.00 | -5 til -10% pp |

**Klinisk konsekvens:** BG-SCIENCE.md §8 punkt 4 (nat-hypo efter aften-motion via PEIS-overlap med søvn-tidens basalinsulin) kunne **ikke reproduceres**. McMahon 2007's biphasiske 7-11 t glukose-need peak var heller ikke modelleret. Riddell 2017's anbefaling om 20% basal-reduktion efter aften-motion havde ingen in-simulator basis.

## Løsning — tre-komponent model

### Matematisk struktur

```
sensitivityIncreaseFactor = 1 + sum_sessions(fastBoost + earlyBoost + lateBoost)
                          → capped at EXERCISE_SENS_CAP = 4.0×
```

| Komponent | Mekanisme | Tidskonstant | Kobling | Litteratur |
|---|---|---|---|---|
| **Fast (AMPK)** | GLUT4-translokation via kontraktion | aktivering τ=2 min, decay t½=15 min | — | Cartee 2015 |
| **Early-slow** | Glykogen-permissiv, Wojtaszewski-fase | opbygning τ=30 min, decay = pool-refill | (1 - glycogenReserve) | Wojtaszewski 2000 |
| **Late-slow** | AS160-fosforylering, Mikines-fase | opbygning τ=30 min, decay t½=18 t | UAFHÆNGIG | Mikines 1988, Cartee 2015 |

### Konstanter (`js/simulator.js`)

```javascript
// Fast (uændret)
EXERCISE_FAST_BASE_AMPLITUDE = { Lav: 0.30, Medium: 0.80, Høj: 1.50 };
EXERCISE_FAST_TAU_ACTIVATION_MIN = 2;
EXERCISE_FAST_HALFLIFE_MIN = 15;

// Tidlig fase — glykogen-permissiv
EXERCISE_EARLY_BASE_AMPLITUDE = { Lav: 0.10, Medium: 0.18, Høj: 0.30 };
EXERCISE_EARLY_TAU_BUILDUP_MIN = 30;

// Sen fase — AS160 (NY)
EXERCISE_LATE_BASE_AMPLITUDE = { Lav: 0.22, Medium: 0.37, Høj: 0.58 };
EXERCISE_LATE_TAU_BUILDUP_MIN = 30;
EXERCISE_LATE_HALFLIFE_MIN = 18 * 60;        // 1080 min

// Cleanup
EXERCISE_SENSITIVITY_MAX_LIFETIME_MIN = 96 * 60;  // 4 dage
```

### Kalibrering

For 60 min Cardio Medium (e2Scaling=1.0) med fyldt glykogen-pool (efter CHO):

| Tid post | Late-bidrag (model) | Cartee/Mikines target | Status |
|---|---|---|---|
| +0 t | 32.0% | ~peak | ✓ |
| +24 t | 12.7% | 10-15% | ✓ |
| +48 t | 5.0% | 5-10% (lower edge) | ✓ |
| +72 t | 2.0% | <5% | ✓ |
| +120 t | 0.3% | undetekterbar | ✓ |

t½ = 18 t er midt i Cartee 2015's litteratur-range (12-24 t). Amplituderne er kalibreret så +24 t og +48 t hitter Mikines/Cartee målepunkterne med fyldt glykogen-pool — dvs. den late-komponent bærer "alene" den langsomme decay, mens early-komponenten dør hurtigt med CHO-refeeding.

## Eksperimentel verifikation (efter fix)

Re-kørsel af `tests/peis-verification.js` (Cardio Medium 30 min, scenario A uden CHO):

| Tid post | Gammel model | Ny model | Status |
|---|---|---|---|
| +0 t | 1.86 | 1.86 | uændret peak |
| +1 t | 1.06 ❌ | 1.21 ✓ | FIX |
| +2 t | 1.01 ❌ | 1.15 ✓ | FIX |
| +4 t | 1.00 ❌ | 1.14 ✓ | FIX |
| +5.5 t (sengetid) | 1.00 ❌ | 1.13 ✓ | FIX — nat-hypo nu modelleret |
| +8 t | 1.00 ❌ | 1.12 ✓ | FIX |
| +12 t | 1.00 ❌ | 1.08 ✓ | FIX |

Visualisering: `developer input/peis-decay-comparison.html` viser før/efter med litteratur-overlay.

## Tests

5 nye kalibreringstests tilføjet i `tests/simulation.test.js`:

1. `Late-fase: 60 min Cardio Medium giver +24t boost i Cartee-range (10-15%)` ✓
2. `Late-fase: 60 min Cardio Medium giver +48t boost i Mikines-range (5-10%)` ✓
3. `Late-fase decay-monotonicitet: +12t > +24t > +48t > +72t` ✓
4. `Late-fase: aften-motion → boost detektérbar ved nat-tid (Riddell 2017 nat-hypo target)` ✓
5. `Late-fase: glykogen-pool refill ELIMINERER early men ikke late` ✓

To eksisterende tests opdaterede ranges (de var kalibreret mod den gamle under-modellerende implementering):
- `24h decay`: 1.05-1.30 → 1.15-1.45
- `48h decay`: 0.97-1.25 → 1.08-1.35

Et eksisterende `120h decay` test omskrevet til at bruge direkte tidsmanipulation (undgår game-over fra urealistiske BG-trajektorier i lange test-vinduer).

**Resultat: 135/135 tests passerer.**

## Sub-agent input

Critical physiology review udført af Opus-sub-agent (model: opus, ~125 sek runtime, evidens-forankret 1500-ords rapport). Agenten:
- Bekræftede at BG-SCIENCE.md §8's to-fase distinktion ikke var afspejlet i koden
- Udførte kvantitativ reality-check af glykogen-refill-rates vs litteratur
- Anbefalede konkret tre-komponent model med initiale parametre

Min efterfølgende kalibrering justerede agentens initiale amplituder opad (0.08/0.12/0.20 → 0.22/0.37/0.58) og tidskonstanten fra 14 t til 18 t for at hitte både Cartee +24t og Mikines +48t targets. Sub-agentens analytiske framework og evidens-forankring var fundamentet; mine eksperimentelle data drev finkalibreringen.

## Files cited

- [`docs/BG-SCIENCE.md`](../BG-SCIENCE.md) §8 (linjer 706, 725-729, 770)
- [`docs/reviews/2026-04-13_exercise-sensitivity-literature.md`](2026-04-13_exercise-sensitivity-literature.md)
- [`docs/reviews/2026-04-13_exercise-sensitivity-design.md`](2026-04-13_exercise-sensitivity-design.md) (linjer 96, 178)
- [`docs/reviews/2026-04-18_claude_full-physiology.md`](2026-04-18_claude_full-physiology.md) (linjer 45-106)
- [`docs/reviews/2026-04-18_claude_full-physiology-v3.md`](2026-04-18_claude_full-physiology-v3.md)
- [`js/simulator.js`](../../js/simulator.js) (linjer 75-160 konstanter, 1112-1230 currentISF, 3220-3300 stopAktivitet)
- [`tests/peis-verification.js`](../../tests/peis-verification.js) (eksperiment)
- [`developer input/peis-decay-comparison.html`](../../developer input/peis-decay-comparison.html) (visualisering)
