# BG Science: reference and scientific corrections

4 October 2026 · Canonical source: `docs/BG-SCIENCE.md`, version `2026-10-04-v1`

## Scope

This authorised pass addresses the [4 October editorial review](2026-10-04_codex_bg-science-final-editorial-review.md). It combines bibliographic repairs, targeted original-source checks and editorial corrections. It is not a complete reappraisal of every paper cited in the reference. Simulator code, model parameters and implementation documentation were not changed.

## Reference identities

The [machine-readable correction ledger](2026-10-04_bg-science-reference-corrections.json) records 69 bibliographic substitutions, the separately corrected Bell entry, the incorrect Gorboulev PMC link and four unresolved citations removed from use. Substitutions were selected by publication identity, not accepted as support for the surrounding claim. Two identified but irrelevant references were subsequently removed from the overdose bibliography. Incorrect author/year labels were reconciled where found, including Bell, Bharucha, Hiramoto, Camilleri, Young and Dhatariya.

Indexed records were retrieved from the local computer. PubMed landing-page access remained incompletely verified: the requests did not confirm the expected article identity in returned page content. The manuscript therefore retains an explicit access qualification rather than labelling every link working. This targeted screen does not cover every DOI, PMC link or unlinked author–year citation.

## Scientific changes and evidence basis

| Topic | Correction | Evidence actually inspected |
|---|---|---|
| Gastric-emptying variability | One consistent Desai table; normal-emptying participants remain part of a symptomatic cohort | Desai 2018 indexed abstract; full text unavailable |
| Postprandial timing | Bell, not Bao; CGM peak timing is not a direct gastric-emptying measurement | Bell 2021 original XML, front matter and study description |
| Insulin pulsatility | Constant delivery produced lower signalling; rat molecular results separated from dog glucose experiments and human extrapolation | Matveyenko 2012 original XML, ten-minute protocol Results |
| Lipohypertrophy | Aspart exposure and lispro variability separated | Gradel 2018 original review XML, §4.5; this does not substitute for the primary-study appraisal |
| Dose response | Rizza glucose-flux findings separated from Stumvoll systemic, adipose and muscle lipolysis endpoints | Indexed abstracts; uncertainty notation and full methods remain outstanding |
| Exercise | Catecholamine infusion establishes capacity, not universal physiological necessity | Kreisman 2003 abstract; Wasserman 2009 original review discussion |
| DKA | Removed a supposed portal-insulin threshold and necessary-glucagon claim; corrected potassium deficit context and removed unsupported mortality ranking | Umpierrez 2024 original consensus XML, pathogenesis and potassium sections |
| Fever | Replaced a universal per-degree multiplier with a defined cooling experiment in ventilated critically ill patients | Manthous 1995 indexed abstract |
| Cytokines | Removed general concentration ranges and cortisol multipliers; distinguished hepatocyte, mouse and rat-myotube experiments | Senn 2002/2003 and de Alvaro 2004 abstracts; Holt 2024 original review XML |
| Hexosamines | Corrected substrate and exposure duration; removed direct serine–tyrosine competition and unsupported human causality | Marshall 1991 and Buse 2006 abstracts |
| Intestinal transport | Separated mouse from human inference; corrected the account of GLUT2 recruitment in the SGLT1 experiment | Gorboulev 2012 original XML and indexed abstract |

Five original XML articles were acquired for this correction work: Matveyenko, Gradel, Bell, Holt and Gorboulev. Previously archived Umpierrez and Wasserman texts were reused. Missing full texts are recorded in the existing acquisition wishlist; access failure is not labelled a subscription paywall without evidence. Private source hashes and claim-level reading records preserve the distinction between identification, acquisition and appraisal.

## Editorial changes

The introduction now describes scope and evidence limitations rather than promising universal primary-source verification or self-assessed journal quality. Arbitrary bold emphasis and simulator-status labels were removed. Long implementation footers were reduced to cross-links. Repeated insulin estimates were consolidated, and selected correction-history sentences were removed. The 3 October audit's obsolete statement that all 27 findings remained open was reconciled with its own status summary.

## External feedback and adjudication

Gemini 3.1 Pro High first reviewed a correction pilot and subsequently checked eight revised passages using the shared writing guide and specified evidence excerpts. The second response supplied a coverage table and explicitly listed unprovided sources. It did not appraise the whole document or independently obtain every original paper.

Two useful findings were implemented. The indexed Rizza abstract has inconsistent uncertainty notation; the revised passage reports the means without silently reconstructing the ambiguous dispersion. The Buse abstract does not discuss competition for tyrosine sites; that attribution was removed. The pilot's request to postpone every abstract-supported correction until full text was available was not adopted: unsupported claims can be removed, and abstract-level results can be used with their limits stated. Raw responses remain private.

## Remaining limitations

Reference-identity repair is substantially complete for the inspected candidate set, but full-text appraisal and public landing-page verification are not. Broader quantitative claims in the illness and DKA chapters, remaining within/across-chapter repetition, and residual correction-history prose still require work. The targeted scientific corrections above must not be represented as certification of those untouched claims.

## Verification

1. Knowledge Base build passed: all 30 physiological reference chapters synchronised from the canonical source, containing 69,873 whitespace-delimited words after importer exclusions. The ordinary self-contained reading edition contains 57 chapters and is 8.15 MiB. No private image build was generated.
2. Source/snapshot hash agreement passed. Final LF-normalised source SHA-256: `d4edcb84fb4d58f4e4db0d2dc7027eed0a5d59fb91a70ea5fc92244a673c971b`.
3. Repository validation passed: 53 game records, 24 study/report records, 60 rendered HTML pages and 56 navigable sources. Existing scientific-regression, reading-interface and PDF-export structural checks passed. These are not original-source or visual PDF checks; no new PDF was rendered.
4. The reference ledger parses successfully. All replaced/rejected PubMed identifiers tested are absent from the canonical text. The manuscript retains 30 numbered sections and no arbitrary bold delimiters. Three pre-existing fragment aliases were corrected to actual canonical chapter anchors.
5. `git diff --check` passed. Unrelated pre-existing source, interface and editorial changes were preserved. No commit or push is included in this pass.
6. Archive read-only check: 165 cached PDFs, one previously known pending Mergenthaler file; no new PDF conversion claimed. The five XML originals remain directly readable outside that converter. Twelve private claim-level checks were recorded with source hashes, reading basis and limitations.

Seven review findings are fixed within their stated scope; four are partial. The outstanding work is full-text/landing-page verification for remaining sources, broader illness/DKA appraisal and a further redundancy/history sweep. It is documented rather than labelled complete.
