# Scientific revision of glucose–insulin model chapters

Date: 22 September 2026. Scope: `docs/BG-SCIENCE.md` sections 28–29 and their knowledge-base derivatives. Canonical version: `2026-09-22-v1`.

## Checkpoint and scope

The simulator worktree was clean at `4e3b9b0`; the knowledge-base worktree was clean at `2550fbe`. No empty checkpoint commit was created and nothing was pushed. This is an authorised documentation revision, not a physiological-code review or a comprehensive update of every modern model.

Section 28 now explains representation, identifiability, experimental evidence and validation. Section 29 holds one comparison table and seven consistently structured profiles, including Al Ahdab's T2D model. The knowledge-base orientation page retains educational appraisal recommendations rather than another model catalogue. Other physiology chapters are unchanged scientifically.

## Claim corrections

| ID | Prior claim or weakness | Evidence and correction | Status |
|---|---|---|---|
| M01 | Hovorka k12 = 0.066 min−1 described as a gut rate | Original equations and Table 1: Q2-to-Q1 glucose transfer. Meal appearance uses tmax,G = 40 min and AG = 0.8. | ✅ FIKSET (2026-09-22) |
| M02 | Approximately 30 fully identifiable Hovorka parameters; clinical control treated as blanket validation | Tables 1–2 distinguish fixed constants and six adaptive parameters. Report 15 experiments/10 people, fasting-oriented protocol, prediction assessment after 240 min and correlated prediction pairs. | ✅ FIKSET (2026-09-22) |
| M03 | Too many parameters called proof of structural non-identifiability | Wanika et al. (2024): structural analysis depends on equations, inputs and observed outputs; practical estimation depends on the dataset. No unsupported model-wide identifiability verdict retained. | ✅ FIKSET (2026-09-22) |
| M04 | Four independent Bergman parameters included SI and both p2/p3; insulin treated as necessarily predicted | SI is derived as p3/p2; measured insulin is an input to the glucose minimal model. Original dog experiments distinguished from later clinical uses. | ✅ FIKSET (2026-09-22) |
| M05 | Sorensen called ground truth and never intended for control | Thesis abstract explicitly describes insulin-therapy/control design; model reconstruction is evidence about a representation, not physiological ground truth. | ✅ FIKSET (2026-09-22) |
| M06 | UVA/Padova: 30-to-300 expansion in 2014, individually fitted virtual people, incretin additions | S2008 already had 300 virtual subjects sampled from distributions. S2013 introduced hypoglycaemia/glucagon components. Measured component cohorts separated from virtual populations. | ✅ FIKSET (2026-09-22) |
| M07 | Michaelis–Menten utilization described as insulin-dose saturation, with plasma glucose in the equation | Dalla Man 2007/2014: tissue glucose is the substrate in the denominator; displayed utilization capacity is linear in delayed insulin action. | ✅ FIKSET (2026-09-22) |
| M08 | Cambridge: 18 clinical adults, 20% circadian amplitude, random walk | Wilinska 2010: 18 synthetic subjects; selected parameters vary with 5% amplitude/3 h period. Clinical comparator is 12 children/adolescents. Quantitative Table 3 results and non-equivalence caveat retained. | ✅ FIKSET (2026-09-22) |
| M09 | Al Ahdab missing from research-model comparison | Final 2021 article added; T2D scope, glucose-only meals, combined drugs/activity/stress, >120 parameters, hypothetical subjects and validation gap distinguished. | ✅ FIKSET (2026-09-22) |
| M10 | Superiority, universal population/access and machine-learning claims lacked traceable evidence | Removed rather than replaced with speculative modern claims. Version-specific access and the absence of a harmonised benchmark are explicit appraisal limits. | ✅ FIKSET (2026-09-22) |
| M11 | Repeated model history/tables across sections 28, 29 and KB overview | Purpose/method material, model profiles and educational recommendations now have distinct homes. | ✅ FIKSET (2026-09-22) |
| M12 | Broken implementation anchor and implication that all research models were implemented | One scoped footer now targets `MODEL-IMPLEMENTATION.md#core-model`; importer omits it from the knowledge base. | ✅ FIKSET (2026-09-22) |

## Literature and search record

This was targeted source reconciliation and gap-filling, not a systematic database search or an independent human double review. No historical search date was changed.

Executed web-search queries on 22 September 2026:

1. `Bergman Ider Bowden Cobelli 1979 quantitative estimation insulin sensitivity dogs 7 full text`
2. `Wilinska 2010 Simulation environment evaluate closed loop 18 14 children PMC`
3. `Dalla Man 2014 UVA PADOVA simulator new features PMC`
4. `Pompa 2021 Sorensen Hovorka comparison glucose models`
5. `Raue 2009 structural practical identifiability profile likelihood PMC`
6. `Dalla Man Rizza Cobelli 2007 meal simulation model pdf`
7. `Hovorka 2004 Nonlinear model predictive control 6 subjects validation`
8. `Raue 2009 btp358 pdf bioinformatics Timmer`
9. `Sorensen 1985 physiologic model glucose 15234 pdf`
10. `Dalla Man Rizza Cobelli 2007 Meal simulation pdf 204 normal`

Europe PMC REST core-record searches used `EXT_ID:<PMID> AND SRC:MED` for 443421, 17926672, 19444330, 20167177, 24876534 and 20936056. Metadata confirmed identities and acquisition routes; it was not treated as validation of full-text claims.

Ten publications substantively support the revision. Seven full texts are retained: two reused (Hovorka and the final Al Ahdab article) and five newly acquired (Cobelli, Dalla Man 2007, Sorensen, Pompa and Wanika). Bergman is abstract-only; Wilinska and Dalla Man 2014 were read through the web-accessible full text but could not be retained locally. All three gaps are on the existing wishlist. Sorensen's scan was inspected at title/abstract level; the detailed comparative appraisal uses Pompa's reconstruction. A retained file is not a claim that every page or cited reference was reviewed.

Raue 2009 and Kovatchev 2009/2023 were acquisition/search candidates but are not relied upon as uninspected supporting sources in the revised chapters. Wanika supplies the accessible identifiability discussion. Kovatchev 2009 remains a historical acquisition gap elsewhere in the KB. The Al Ahdab arXiv copy was not substituted for the final publication.

The [source register](2026-09-22_model-chapters/source-register.json) records per-source reading boundaries, local file hashes and local URL checks. The [initial acquisition log](2026-09-22_model-chapters/acquisition.json) and [alternative-route log](2026-09-22_model-chapters/acquisition-alternatives.json) distinguish valid documents from challenge pages. An earlier successful Cobelli retrieval was retained even though a later request failed; the source register records the actual file. Duplicate identity is assessed by publication identifiers, not by treating alternative URLs as independent studies.

## Verification and residual limits

Scientific changes are restricted to sections 28–29 plus the document-version marker. The previous chapters contained 7,323 whitespace-delimited words; the revised count is recorded in the source-register verification output. Compression removes repeated history and unsupported assertions while retaining equations, quantitative results and critical comparison.

Local access to several PubMed/PMC and publisher routes remains unreliable. Challenges, HTTP failures and a Python certificate error are not labelled paywalls. Public chapter references explicitly qualify access; source identity, actual reading and technical reachability remain separate observations.

The existing physiology sync and its integrity, idempotence, overwrite-protection and offline-snapshot tests passed. Private site and standalone tablet builds passed, as did the KB validation and PDF-export structural tests. Visual browser inspection remains outstanding because the browser security policy blocked the local file URL; no alternative route was used to circumvent that restriction. No new PDF or browser print-layout validation was performed. The [KB revision record](../../../t1d-serious-games-knowledge-base/docs/reviews/2026-09-22_model-chapters.md) records the output counts. No claim is made that this work completes a whole-base scientific audit, verifies all modern model releases or establishes educational efficacy.

**Status summary:** M01–M12 fixed locally. Three full-text-retention gaps remain. Broader contemporary-model coverage, licensed-distribution testing and a harmonised external benchmark remain outside this targeted revision.
