# Verification record

Date: 2026-09-22.

## Completed checks

1. The entire owned KB chapter and upstream §§3–4 were read. Both proposed replacement blocks were reviewed and approved by the coordinating agent; abbreviation lists and source-access notes were added afterwards.
2. `git diff --check -- knowledge/physiology/glucose-insulin-system.qmd` passed. Git emitted only its normal LF-to-CRLF working-copy warning.
3. `git diff --check -- docs/reviews/2026-09-22_physiology-organs` passed. Because these audit files are newly created and may be untracked, this is supplemented by the explicit content checks below rather than treated as exhaustive validation.
4. `check_content.py` passed: valid KB front-matter delimiters; existing internal `.qmd` file links; no replacement characters or unintended CJK characters; no overlong alphabetic tokens or previously detected concatenated prose strings. The audit prose was then reread and rewritten in ordinary English; author/year and HTTP-status spacing were normalized. Automated token checks do not substitute for that editorial reading.
5. Sixteen distinct external source URLs occur in the revised KB chapter, seven in the renal block and thirteen in the brain block. All are included in `final-link-verification.json`, with additional candidate-source checks. PubMed responses were interstitials, not verified article pages; independent Europe PMC metadata confirmed citation identities. The institutional Phillip PDF and publisher Owen PDF were retrieved successfully and matched their article content. The chapter and both blocks disclose these access limits.

## Arithmetic checks

| Calculation | Result | Use |
|---|---|---|
| 180 L/day × 5.5 mmol/L × 180.16 g/mol | 178.3584 g/day | Conditional filtered glucose load |
| 5.6 mg/100 g/min × 14 × 1440 min/day | 112.896 g/day | Cerebral rate for assumed 1.4-kg brain |
| 5.6 mg ÷ 180.16 g/mol | 31.0835 μmol | Conversion per 100 g/min |
| 25–30 μmol/100 g/min, assumed 1.4-kg brain | 90.8006–108.9608 g/day | Demonstrates the old incompatible daily range |
| (149−129)/149 | 13.4228% | Correct reduction in the review-reported GFR example |
| 3.5 μmol glucosyl/g × 162.14 g/mol | 0.56749 g glycogen/kg tissue | Explicit residue-mass conversion |
| Previous value × 1.4 kg | 0.794486 g | Assumed whole-brain amount, not an injury threshold |
| (1.53+0.24)/2.96 | 59.7973% | Owen Table V ketone oxygen equivalents relative to measured oxygen extraction |

These calculations verify units and arithmetic, not the universality or clinical applicability of their inputs.

## Not performed

1. No Quarto build, browser render, localhost access, simulator execution or physiological model validation was performed under this delegated scope.
2. No commits or pushes were made.
3. Root subsequently integrated both approved blocks on 22 September 2026, after the variability task released the file. The replacement ended before the Part 2 heading; the heading and all following content were preserved. No model code was changed. Final site checks are recorded in the whole-base audit.

## Remaining evidence limitations

Johansen, Groop, Boyle, Jacobson, Kuppermann and Tanenberg are used at original-abstract level with visible qualification. Some older numerical claims were removed because their primary support was unavailable. Correcting source identity does not by itself complete source appraisal. The detailed ledger and wishlist fragment are in `audit.md`.
