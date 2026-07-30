# 2026-06-04 Muscle Glycogen and Glucagon Fix Decision

## Bagrund

Claude-reviewet `docs/reviews/2026-06-02_claude_full-project.md` fandt et kritisk problem i muskelglykogen-resynthesis: plasma-drain fra Q1 kunne toppe omkring 1.6 g/min og blev kaldt uden for substep-løkken. Det kunne give hastighedsafhængige, ikke-glatte BG-fald. Samme review pegede også på at emergency glucagon var modelleret som en instant BG-stigning på 10-15 mmol/L.

## Diagnose

Muskelglykogen-resynthesis blandede to størrelser: faktisk glykogensyntese i musklen og den del af syntesen der bør trækkes direkte fra plasma-glukose. Ivy 1988 beskriver høj total glykogensyntese efter motion, men den kan ikke antages at komme fuldt fra plasma; lactat-recycling og andre substrater bidrager også. Derfor blev Q1-drainen for høj, især ved tom muskelglykogen-pool, aktiv COB og normal insulin.

Glucagon-fundet var en separat model-fidelity-fejl. Den gamle `useGlucagon()` lagde glukose direkte i Q1 som et instant spring. Det gav spil-feedback med det samme, men underviste ikke i at glucagon virker over minutter og afhænger af leverens glykogenlager.

## Løsning

Muskelglykogen:

- `MUSCLE_GLYCOGEN_RESYNTH_PLASMA_CAP = 0.6 g/min` begrænser kun plasma-drain.
- Selve muskelglykogen-poolen fyldes stadig med fuld resynthesis-rate, fordi poolen kan bruge ikke-plasma substrater.
- `updateMuscleGlycogen(stepDt)` er flyttet ind i substep-løkken, så Q1-drain integreres med `dt <= 1 min`.

Glucagon:

- `activeGlucagon` trackes som en aktiv injektion med `totalRelease_g`, `releasedSoFar_g`, `duration_min` og `peakMin`.
- `useGlucagon()` mobiliserer op til 35 g glukose, begrænset af `liverGlycogenGrams`.
- `_substepGlucagon(dt)` bruger en trekant-profil over 45 min med peak ved 12 min.
- Hvert gram frigivet trækkes fra `liverGlycogenGrams` og lægges i Q1 som mmol, så massebalancen er eksplicit.

Hyperglykæmi-mavetømning og stress-docs:

- `hyperMod`-tabellen er rettet til den faktiske formel.
- BG-SCIENCE-afsnittet om akut hyperglykæmi og gastric emptying er udvidet med læsning af T1D-specifik acceleration/delay.
- `acuteStressLevel`-kommentaren beskriver nu cap = 0.4 som et bevidst T1D-svækket kontraregulationsvalg.
- CGM-kommentaren beskriver nu 2.2-30.0 mmol/L som simulatorens visningsgrænse.

## Verifikation

Automatisk test:

- `tests/simulation.test.js`: 155/155 passed.

Nye eller udvidede testområder:

- Graduel glucagon-glykogenolyse med normal, post-motion og faste-tømt lever.
- Brutto-release omkring 35 g ved fuld lever.
- Lever-glykogen recovery efter glucagon.
- Klinisk IOB-scenarie hvor glucagon giver moderat netto BG-stigning.
- 24 timers glucagon-cooldown.
- Trekant-profil uden instant spike.
- Muscle glycogen pool capacity, depletion og resynthesis.

## Files cited

- `js/simulator.js:204` - plasma-drain cap.
- `js/simulator.js:1980` - muskelglykogen i substep-løkken.
- `js/simulator.js:3340` - `updateMuscleGlycogen()`.
- `js/simulator.js:3430` - cap på Q1-drain.
- `js/simulator.js:3941` - rettet `hyperMod`-tabel.
- `js/simulator.js:4414` - `useGlucagon()`.
- `js/simulator.js:4478` - `_substepGlucagon()`.
- `tests/simulation.test.js:3099` - glucagon-testblok.
- `docs/MODEL-IMPLEMENTATION.md:652` - hyperMod-dokumentation.
- `docs/MODEL-IMPLEMENTATION.md:1534` - muskelglykogen-dokumentation.
- `docs/MODEL-IMPLEMENTATION.md:1788` - glucagon-dokumentation.
- `docs/BG-SCIENCE.md:501` - akut hyperglykæmi og gastric emptying.
- `docs/reviews/2026-06-02_claude_full-project.md:64` - review-status for kritisk fund.
