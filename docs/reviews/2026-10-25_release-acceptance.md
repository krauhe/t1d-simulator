# Release acceptance: current gameplay and separated meal transport

Date: 2026-10-25. Scope: final preparation of 0.9.129-beta as one public learning-game release. This records the pre-publication assessment; deployment success must be established separately from the Actions run and live release manifest.

## 1. Decision and boundary

The owner requested prompt publication of the current gameplay and completion of necessary work now, before later gameplay experiments. The earlier request specified one public GitHub version. Campaign/Box Challenge progression is unchanged; onboarding proposals and mockups remain outside the runtime package.

**Release decision:** retain the approved separate gastric/downstream architecture and inherited provisional parameters for this educational beta. Do not add an arbitrary glucose advantage or a new fibre-delay mechanism to imitate the old curves. Targeted checks found no new reversal of the tested meal-composition effects. This is a bounded engineering release decision, **not quantitative clinical validation**.

This narrows the earlier [calibration audit](2026-10-25_codex_food-kinetics-calibration-audit.md)'s recommendation to complete quantitative calibration before publication: the immediate gate is verified numerical operation, retained learning directions and accurate documentation. Product-specific fitting remains research work. The decision changed because the owner prioritized release and the targeted checks below did not identify a defensible corrective parameter adjustment. The unresolved evidence is not being relabelled as validated.

## 2. Necessary corrections

1. **Public model diagnostic crash — ✅ FIKSET locally, 2026-10-25.** tests/model-validation.html still read the removed tau_G field and called toFixed on undefined. It now reads tauGastric, displays the independent downstream time, and uses the actual dextrose profile. Inline JavaScript syntax and the actual C.4 callback were checked; all seven selected profiles returned finite values.
2. **Unsupported calibration claims — ✅ FIKSET locally, 2026-10-25.** The diagnostic no longer claims a non-existent intestinal fibre/transporter mechanism or a clinically derived 35% AUC tolerance. MODEL-IMPLEMENTATION.md now distinguishes composition data from kinetics, removes the invalid gastric half-time mapping and corrects the fibre/form/fat descriptions. Logarithms have diminishing slope, not a finite saturation limit. No physiology parameters were changed during this release preparation.
3. **Meal regression reference — ✅ FIKSET locally, 2026-10-25.** clinical-equivalence.js initially reported 106 differences in its meal-fat-protein scenario, with maximum plasma difference 2.956 mmol/L and mean difference 1.438 mmol/L. Its 60 g carbohydrate / 20 g protein / 30 g fat meal has no meal bolus and is not the Smart protocol below. After accepting the intended architecture change, only this scenario was regenerated. The other seven scenarios were verified structurally identical; all tolerances stayed unchanged. The command now supports a single-scenario filter. Golden-master's meal reference had already been updated and all seven golden scenarios match.
4. **Player release history — ✅ FIKSET locally, 2026-10-25.** Today's entry includes custom dextrose/table sugar and the possibility of an earlier mixed-meal rise. It does not promise faster dextrose than gummy candy. Origin remained 0.9.128-beta; the prepared 0.9.129-beta is the next patch, with matching desktop/mobile cache versions.

## 3. Targeted physiological checks

### Fat and protein

tests/meal-literature-release-check.cjs defines qualitative targets before running the comparison. Original archived Smart 2013 methods/results supplied the factorial meal structure: 30 g carbohydrate, fat 4/35 g, protein 5/40 g, 20-minute ingestion and the same carbohydrate-based bolus 10 minutes before each meal. A smaller illustration uses the study's reduced-portion rule. No clinical amplitude range was invented.

128 arms cover two code versions (checkpoint e4b8494/current), two illustrative profiles, two composition proxies, two initial glucose values, two time steps and four meals. All 32 factorial groups retain the five directional checks. Primary current-model contrasts are +0.808 mmol/L for high versus low protein at 180 minutes and +0.980 mmol/L for high versus low fat at 210 minutes. The combined meal is higher than each comparator at the five selected late points. Early fat suppression remains, but is smaller than before. Maximum CGM endpoint difference between dt 1 and 0.5 is about 0.0205 mmol/L. No simulated plasma value fell below the protocol's 3.6 mmol/L censoring threshold.

**⚠️ DELVIST:** These checks approximate the protocol, not its participants or measured response magnitude. Carbohydrate composition, physical weight, basal state and simulator CGM are assumptions. The combined meal continues rising at the 300-minute boundary in both versions; its final peak is unidentified and not quantitatively validated. Wolpert's closed-loop protocol and Bell's different bolus regimen were not reproduced. No mechanistic partition can be fitted from these results alone.

### Fibre

tests/meal-fiber-release-check.cjs isolates the existing fibre proxy in a constructed 30 g carbohydrate meal, with the same starch fraction/downstream time and 0/3/6 g fibre. At both dt 0.5 and 0.1, more fibre delays cumulative systemic appearance at 30/60/120 minutes. Mass balance remains within 1e-8 g; the largest time-step difference in cumulative appearance is 0.002684 g.

**⚠️ BY DESIGN:** This is a mechanism check, not a reproduction of the Wolever beta-glucan trial. Total fibre remains a crude gastric proxy without a separate intestinal viscosity state. No evidence-based coefficient for a new intestinal term was identified, so none was invented. Product-specific timings and glucose/sucrose differentiation remain open research questions.

## 4. Final local checks

| Check | Result |
|---|---|
| Gastric/downstream mechanism suite | 14 passed |
| Fibre release mechanism check | Passed at both time steps |
| Clinical-equivalence reference regression | 8/8 after the selective accepted update |
| Golden-master regression | 7/7, bit-identical to current accepted references |
| Model-review regression | 18/18 |
| Public release boundary | Passed |
| Intended-purpose text | Passed, 17 active files plus structure |
| Food catalog/custom definitions | Passed |
| Version history | Passed, 9 records / 7 monthly summaries |
| Text synchronization | Passed, 854 keys per language and matching help markers |
| Release builder | 9/9 |
| Git whitespace check | Passed |

The earlier [implementation report](2026-10-25_gastric-intestinal-fix.md) records broader unchanged-engine tests and the seven desktop/mobile food UI checks. The earlier [release report](2026-10-25_release-verification.md) records UI fixes, link verification and known audio limitations. These checks are engineering evidence, not clinical certification.

## 5. Publication controls and remaining limitations

GitHub Pages was checked as workflow-based, with the github-pages environment restricted to main. The single-release builder copies an explicit runtime allowlist; old preview entry points redirect to the root. Private scientific copies, model-review packets and mockups are excluded. No working-tree package may be uploaded. The committed package must pass the browser smoke test, and the workflow repeats that check before deployment. Confirm the actual deployed commit/version in the live release-manifest.json after the run.

Existing tour audio was not regenerated; paid voice calls still require explicit per-file manuscript approval. Release smoke tests stub Tone.js and do not certify audible playback. The identified text/audio differences are retained as a known limitation, not silently claimed fixed. Quantitative food kinetics remain **❌ ÅBEN**; current-gameplay release acceptance does not close that research question.

## 6. Review provenance and reusable artifacts

Two bounded Codex agents checked meal literature/protocol behavior and release readiness. Root reviewed their source changes, experiment assumptions/results, ran independent fibre tests and the final checks, and corrected model documentation. No external-model recommendation was treated as evidence and no new API quota was purchased.

Private outputs: .local-artifacts/2026-10-25-release-meal-check/ contains complete traces, source hashes and detailed protocol limitations; .local-artifacts/2026-10-25-final-release/ contains final test logs. Public reproducible inputs are the two release-check scripts and the existing comparison script. Original source coverage is recorded in the calibration audit; this review adds no new literature claim or coefficient.

Status summary: two concrete diagnostic/documentation faults corrected, the intended meal reference updated selectively, and current gameplay accepted for beta release with explicit model limitations. Committed-artifact browser verification and actual deployment remain separate execution gates after this preflight record.
