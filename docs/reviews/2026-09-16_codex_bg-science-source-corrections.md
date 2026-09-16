# BG-SCIENCE source corrections and knowledge-base synchronisation

Date: 16 September 2026. Status: **FIXED locally; not committed or published.**

## Scope

The owner requested that identified errors be corrected in the canonical physiological text before importing that text into the T1D Serious Games Knowledge Base. This is a targeted correction pass, not a complete revalidation of the document or its reference library. No physiological model code, parameters or game behaviour were changed.

## Corrections

1. **FIXED — bibliographic identities.** Corrected the identified Chadt, Rizza, Haahr, Gradel, DeFronzo, Søeborg, Lieber, Cobelli and Kovatchev references. Removed unmatched Cryer/Wolever/Bondia records rather than replacing them with unrelated publications. Corrected the year and bibliographic details of the Hovorka model-predictive-control paper in §25. Repairing an identifier does not establish support for every nearby numerical assertion.
2. **FIXED — unsupported quantitative attribution.** Removed selected percentages, oligomer-specific kinetic values, lipolysis/receptor-occupancy entries and Hill-coefficient ranges whose cited originals were not available or did not establish those results. Preserved explicit abstract-only qualifications for Rizza's healthy-participant endpoints. This does not imply that every removed value is false; it means the previous attribution was insufficient.
3. **FIXED — dose-response mathematics in §25.** The ratio 55/29 is approximately 1.90, not three. For the displayed Hill equation the low-concentration response scales with concentration to the power n, not generally linearly. Half-maximal concentration is not necessarily the location of maximum slope on a linear axis. A change in disposal at one insulin concentration does not identify the same percentage change in half-maximal concentration.
4. **FIXED — state identity and mechanistic framing.** Hovorka Q2 is a glucose pool, not an insulin compartment. Corrected the direction of FoxO1 transcriptional regulation. Separated receptor cooperativity from fitted whole-body response slopes, and labelled dose-size illustrations as hypotheses rather than clinical dosing rules.
5. **FIXED — degludec outcome identity in §7.** The 20% versus 82% variability comparison concerns pharmacodynamic glucose infusion rate area under the curve, not plasma-insulin exposure. Haahr and Heise's full text describes daily 0.4 U/kg dosing in T1D and repeated steady-state clamps on days 6, 9 and 12. The comparison is now consistently labelled in prose, table and variability discussion.
6. **FIXED — model and regulatory overstatements in §§28–29.** Removed an unsupported universal requirement to test precisely 300 virtual subjects, a claim to represent all T1D physiology, an unsupported product ranking/time-saving estimate, and an exhaustive assertion that no long-term models exist. Specific preclinical regulatory use is distinguished from general medical-device approval. Remaining model-history and distribution claims are not represented as newly comprehensively checked.
7. **FIXED — source ownership.** Removed affiliated implementation wording from two scientific-prose passages. Existing implementation footers remain in this source; the knowledge-base structural importer excludes them. Scientific corrections belong here, not in the generated knowledge-base chapters.

## Evidence and verification limits

The source-correction agent inspected the relevant source sections and the prior knowledge-base citation audit. The main agent reviewed the proposed patch and independently checked the Haahr variability passage against retained full text. The known identity corrections, new retrieval attempts, unresolved full-text identities and detailed correction ledger are retained with the knowledge-base restoration record. The source version advances from `2026-09-15-v1` to `2026-09-16-v1`.

Existing sources include [Haahr and Heise (2014)](https://pubmed.ncbi.nlm.nih.gov/25179915/), [Rizza et al. (1981)](https://pubmed.ncbi.nlm.nih.gov/7018254/), [Gradel et al. (2018)](https://pubmed.ncbi.nlm.nih.gov/30116732/) and [Hovorka et al. (2004)](https://pubmed.ncbi.nlm.nih.gov/15382830/). Local PubMed access is not fully verified for every identifier because challenge responses occur; full-text/abstract reading status is distinct from link reachability. The original document retains additional claims requiring future appraisal. No comprehensive freshness, source-support or clinical validation claim is made.

## Status summary

All seven correction groups above are implemented locally. No simulator code changed. The knowledge base consumes the corrected document through a deterministic local build hook with source and output fingerprints; it is a derived publication, not a second independently maintained physiological text.
