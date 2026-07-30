# Box Challenge respawn-state fix

**Dato:** 2026-07-23  
**Branch:** `codex/physiology-followups`  
**Status:** Implementeret lokalt og verificeret; ikke committet

## Bagrund

Det fysiologiske helhedsreview fandt, at Box Challenge beskrev respawn som en
frisk start, men kunne arve skjult fysiologi fra det tabte liv. Gamle
insulinmodifikatorer blev brugt til at beregne x1, x2, x3 og Q2, og den
motionsudløste leverdriver blev slet ikke nulstillet.

## Diagnose

`_resetToStableBG()` beregnede `steadyStateActions(I_ss)`, før aktivitet,
PEIS, stress, FFA-resistens og glukotoksisk resistens blev ryddet. Hovorka
beholdt derfor `_amplitudeMod` og `_peisMuscleFactor` fra det tidligere liv.

`exerciseHepaticDrive` havde samtidig ingen resetlinje og kunne fortsætte med
at hæve leverproduktionen efter respawn. Det oprindelige review målte op til
2,53 mmol/L forskel efter to timer.

## Løsning

Følgende state nulstilles nu før insulinvirkning og Q2 beregnes:

- aktiv aktivitet og forsinkede motionssessioner;
- motionsudløst leverdriver og aktivitets-cooldown;
- akut, kronisk og ventende kronisk stress;
- stress-, FFA- og glukotoksisk insulinresistens.

Tiden nulstilles ikke i Box Challenge. Den aktuelle døgnvariation bevares
derfor som tilsigtet kontekst. Efter de øvrige drivere er ryddet, genberegnes
den rene amplitude og PEIS-faktor, og de sættes eksplicit med
`setInsulinModifiers()` før `steadyStateActions()`.

## Verifikation

En ren simulator blev sammenlignet med en simulator, der før respawn havde:

- Hovorka-amplitude 0,48 og PEIS-faktor 1,8;
- `exerciseHepaticDrive = 1,0`;
- aktiv forsinket motionssession;
- akut, kronisk og ventende stress;
- FFA- og glukotoksisk resistens.

| Endpoint | Resultat |
|---|---|
| Q1, Q2, x1, x2 og x3 umiddelbart efter reset | Identiske inden for 1e-12 |
| `exerciseHepaticDrive` | 0 |
| `activeMotion` | Tom |
| `_pendingChronicStress` | 0 |
| Hovorka PEIS-faktor | 1 |
| BG-forskel efter 120 min, dt 1,0 | Under 1e-9 mmol/L |
| BG-forskel efter 120 min, dt 0,25 | Under 1e-9 mmol/L |
| Samlet Node-suite | 186/186 bestået |

`node --check js/simulator.js` og `git diff --check` består også.

## Sub-agent input

Ingen sub-agent blev brugt til denne rettelse.

## Files cited

- `js/simulator.js:3504` - tidlig nulstilling af skjulte drivere
- `js/simulator.js:3524` - eksplicit post-respawn-modifikation
- `tests/simulation.test.js:2515` - invarians- og tidsstegstest
- `docs/reviews/2026-07-23_codex_full-physiology-updated-skill.md:135` - oprindeligt fund og status
