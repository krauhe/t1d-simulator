# BG Science: post-correction scientific and editorial review

4 October 2026 · Review only · Baseline `2026-10-03-v2`

## Principal assessment

BG Science is not ready to be described as fully verified. Recent corrections have improved several passages, but the same unsupported estimates and incompatible interpretations survive elsewhere, particularly in tables and later summaries. A separate bibliographic screen also found widespread disagreement between quoted article titles and linked PubMed identifiers. The next revision should repair evidence traceability and cross-section consistency before polishing prose.

The strongest passages distinguish measured flux from concentration, population observations from individual prediction, and physiological mechanism from model identifiability. Preserve that depth. The main weakness is uneven integration: carefully appraised paragraphs sit beside older assertions that contradict their qualifications. Concision alone will not resolve this.

No scientific source text, simulator code or model parameters were changed during this review. Findings below require an authorised correction pass. This is not a new systematic literature search or a claim that every underlying paper has been reappraised.

## Methods and scope

The canonical source was `docs/BG-SCIENCE.md`, SHA-256 `D45EB7D53C58FA4803E122D8C7ED4BC745125CAF643092FF0AD00DE37C739702`. Numbered sections total 30 because §10b supplements §§1–29. Line locators below refer to this baseline.

The review used the local `science-reviewer` skill and the Knowledge Base's updated academic-review-writing criteria. External reviewers received the current source introduction, complete numbered sections in bounded packets and the same writing guide. They were explicitly told not to change files, treat their scientific suspicions as verified findings, delete consequential uncertainty or turn the physiology reference into game-design guidance. The writing guide, rather than the full writing-method articles, was supplied.

Opus 5.5 High provided chapter-specific assessments for §§1–10 in two packets, then returned `RESOURCE_EXHAUSTED` before §10b. Calls to that model stopped. Gemini 3.1 Pro High reviewed §§28–29 and was used for the remaining sections. Actual final coverage is recorded at the end; a model's claim of reading is not original-source verification.

The coordinating reviewer checked the principal findings against the canonical passages, independently identified residual reference errors and retrieved bibliographic records from Europe PMC on the user's PC. No full original-paper reappraisal was performed in this pass. The local archive check reported 165 cached PDFs and one pending file, the previously recorded Mergenthaler pseudo-PDF problem; it did not certify their scientific contents.

## Findings requiring correction

### BG26-01 — High priority: bibliographic identities remain unreliable

Status: OPEN. Basis: direct local retrieval of indexed records, followed by manual comparison of candidate titles.

A reproducible screen examined 294 quoted-title reference occurrences containing PubMed URLs in blockquote bibliographies, representing 284 unique identifiers. Europe PMC returned 282 records. A title-similarity screen flagged 77 occurrences. Manual inspection classified 71 as a different indexed title, three as harmless title abbreviations, one as a related-title discrepancy requiring further bibliographic investigation, and two as unresolved because no record was returned. These are reference occurrences, not 71 independent physiological errors. The screen does not cover all inline citations, ordinary non-blockquote bibliographies, DOI/PMC links, author/year fields or claim support.

Examples independently checked outside the automated screen:

| Location | Cited identity | Linked identifier actually identifies | Repair direction |
|---|---|---|---|
| §23, line 1994; bibliography line 2064 | Rizza et al., insulin dose response | PMID 7014664: *Keloids: a review* | Rizza's record is PMID 7018254; fixing the link does not establish the lipolysis estimate |
| §17 opening, line 1559 | Maahs et al., international paediatric DKA comparison | PMID 26055086: *Recent developments in high-quality drying of vegetables, fruits, and aquatic products* | DOI 10.2337/dc15-0780 identifies PMID 26283737; other Maahs occurrences also need reconciliation |
| §23 bibliography, line 2055 and associated prose | Wolfsdorf et al., ISPAD DKA guidance | PMID 29956180: *Identification of Novel Mycobacterial Targets for Murine CD4+ T-Cells by IFNγ ELISPOT* | Correct indexed identifier: 29900641, already used elsewhere in the document |
| §23 bibliography, line 2059 | Glaser et al., cerebral oedema risk factors | PMID 11419433: *Optimal treatment of acute coronary syndromes—an evolving strategy* | The listed DOI identifies PMID 11172153 |
| §23 bibliography, line 2060 | Kuppermann et al., paediatric fluid trial | PMID 30088006: *Opioids vs Nonopioids for Chronic Back, Hip, or Knee Pain—Reply* | The DOI in the reference is also inconsistent with the publisher's trial identity; verify both together |
| §17, Fever as multiplier of metabolic demand | “Manthous 1995” | PMID 3621073: Baracos, Whitmore and Gale (1987), *The metabolic cost of fever* | Determine the intended experiment and which source supports the numerical statement |

The complete candidate/adjudication ledger is [the identity-screen JSON](2026-10-04_bg-science-editorial-identity-screen.json). Private batch records preserve exact queries and returned metadata. Do not replace links by selecting a vaguely similar paper: locate the intended publication, inspect it and check the associated claim. A successful HTTP response is not bibliographic verification.

### BG26-02 — High priority: corrected Rizza boundaries are not propagated

Status: OPEN. Basis: internal contradiction; indexed abstract checked, full text not newly appraised.

§7 line 703 explicitly says the inspected Rizza abstract does not establish a lipolysis threshold. §25 narrows its numerical use to production and utilisation. Yet §7 line 763 still attributes a lipolysis EC50 of 8–11 μU/mL to Rizza, and §23 line 1994 repeats the corresponding range with the wrong identifier. The later §25 discussion also retains broader tissue/threshold assertions after explaining the narrow evidence basis.

Find a source actually measuring the relevant lipolysis endpoint or remove the unsupported attribution and estimate. Reconcile every table and repeated summary, not just the first corrected paragraph. The correctness of a numerical value and the correctness of its citation are separate questions.

### BG26-03 — High priority: the gastric-emptying table conflicts with its prose

Status: OPEN. Basis: direct text comparison, prompted by Opus.

§5 lines 519–531 gives approximately 40% intersubject variability for Desai in prose but 47% in its table. The text identifies normal-emptying participants as a subgroup of a symptomatic clinical cohort, whereas the table puts their 12% within-person estimate under “Healthy subjects”. A stated 12–24% range also precedes a 28% subgroup estimate. These cannot be resolved by stylistic editing.

Re-extract the original study's populations, outcome definitions and within-/between-person statistics into one matrix. Then generate prose and table from the same interpretation. Normal gastric emptying is not synonymous with healthy recruitment. Do not silently choose either existing number as correct.

### BG26-04 — High priority: insulin summaries change denominators and formulations

Status: OPEN. Basis: internal quantitative inconsistency, prompted by Opus.

§7 line 732 describes pulsatile delivery as producing 50–80% higher phosphorylation than constant delivery; line 765 describes constant delivery as producing 50–80% lower phosphorylation. Those are not equivalent denominators: if the first comparison is correct, the reverse reduction is approximately 33–44%. The original experiment must determine which description to retain.

The lipohypertrophy table at line 758 combines an aspart comparison with variability estimates that line 769 explicitly assigns to a separate lispro experiment. Separate the experiments and identify each formulation, endpoint and denominator. Also repair the phrase “absorption rate constant (typically 30–90 min…)” at line 726: time and inverse-time quantities are different.

### BG26-05 — High priority: the exercise argument states a reconciliation it has not established

Status: OPEN. Basis: textual reasoning check; original experiments require appraisal.

§9 line 911 quotes a review reporting negative human tests of catecholamine involvement above 80% maximal oxygen uptake, then states that a reconciliation has emerged in which a catecholamine-driven effect becomes detectable above that intensity. It ends by calling the issue unresolved. The text does not show what experiment resolves the quoted objection.

Organise this passage by the actual contrasts: associations, infusion experiments testing sufficiency, and blockade or clamp experiments testing necessity under specified conditions. Keep species, exercise intensity and insulin/glucagon conditions attached to each result. An intervention reproducing a response does not by itself establish the necessary cause of that response during unmanipulated exercise.

### BG26-06 — High priority: several mechanistic claims still need source-level review

Status: OPEN; verification candidates, not all demonstrated errors.

1. §23 line 1994: a specified portal-insulin threshold for DKA and “glucagon excess is a necessary co-driver”. The linked source identities are unreliable, and the text needs direct support for the claimed necessity and threshold.
2. §23 line 2006: “invariably” depleted potassium and the “most common cause of iatrogenic mortality” assertion. These universal/ranking claims require defined populations and supporting outcome data; the nearby ISPAD link points to another article.
3. §26 line 2277: serine O-GlcNAc modification said to “directly compete” with activating tyrosine phosphorylation, followed by numerical cell-study claims and a causal conclusion from mouse overexpression. Specify whether competition means the same modification site, an indirect signalling effect, or a measured association. Do not infer a human T1D effect from the animal manipulation.
4. §5 line 404: the passage moves from mouse knockout percentages to an “obligate” pathway in humans. Distinguish species and genetic disease evidence.
5. §17 cytokine and fever paragraphs: general numerical ranges and comparative causal importance are stated without adequately identifiable protocol-specific support.

These issues warrant targeted original-source work before a replacement scientific assertion is written. A model's plausible explanation is not a substitute.

### BG26-07 — Medium priority: correction history interrupts scientific explanation

Status: OPEN. Basis: direct inspection, independently raised by both models.

Examples include “not 60%”, “the inherited table”, “not the previously described 20% circadian sensitivity oscillation” and repeated accounts of local retrieval failures. Readers do not need the earlier erroneous draft to understand the final result.

State the supported result and its consequential boundary. Move obsolete-number rebuttals and acquisition history into audit records. Retain real scientific distinctions, such as concentration versus flux, virtual subjects versus clinical participants, and component validation versus whole-system prediction. The shared grammatical form “X, not Y” is not itself grounds for deletion.

### BG26-08 — Medium priority: duplication allows scientific drift

Status: OPEN. Basis: checked examples in §§5, 7–9 and 25.

Numbers are repeated in prose, summary tables and T1D-specific lists, sometimes with a changed population or interpretation. Yardley's exercise comparison and degludec variability recur several times. Give each full comparison one primary location, use tables for aligned quantities, and use prose to explain the comparison rather than recite the cells. Cross-reference related sections while retaining enough context for standalone reading.

### BG26-09 — Medium priority: the introduction promises more than the document delivers

Status: OPEN. Basis: direct inspection.

The introduction says numerical values throughout have primary citations, but numerous passages explicitly rely on reviews, abstracts or unverified inherited estimates. Replace this blanket assurance with the actual evidence approach. Remove self-assessment such as “peer-review depth”. The opening's premise about physiology being inadequately articulated outside specialist literature also needs support or a narrower statement of this reference's purpose.

An introduction can explain the clinical problem and scope without claiming completed source certification. Align roadmap labels with the actual contents and preserve the distinction between a scientific reference and individual treatment guidance.

### BG26-10 — Medium priority: source-to-publication boundaries remain inconsistent

Status: OPEN. Basis: direct inspection and rendering-code inspection.

§26 still begins “Active in simulator”. Several implementation footers contain long inventories of simulator mechanisms, whereas the reference's agreed purpose is general physiology. Keep a short permitted implementation cross-link where appropriate; move implementation explanations to their owning document through a separately authorised change.

Arbitrary bold emphasis remains in models and physiology. Gemini also called `==` markup residual syntax; inspection of the Knowledge Base build shows it deliberately becomes HTML `<mark>`. It is therefore a presentation choice, not broken markup. Assess whether the highlighting serves the intended scientific style rather than deleting it on a false technical premise.

### BG26-11 — Review records contain a stale completion statement

Status: OPEN. Basis: direct inspection of the previous audit.

The 3 October audit's status summary says 25 findings were fixed and two partly addressed, but its conclusion still says “All 27 audit items remain open”. Reconcile this historical report when implementing the new findings. Do not interpret the stale concluding sentence as evidence that the earlier corrections were never made.

## Recommendations rejected or qualified

1. Opus treats “gastric emptying is rate-limiting” and a percentage of variability in glucose response as contradictory. These are different endpoints; the more defensible problem is an unsupported claim that five meal properties account for most response variability, plus unclear distinctions among delivery, absorption and circulating concentration. Do not label every such pair a formal contradiction.
2. A review focused on T2D can cite a relevant T1D primary experiment. Opus's concern about the Evans review is a reason to inspect the relevant source, not proof that every cited value was measured in T2D.
3. A two-process explanation is not necessarily incompatible with rejecting a universal fixed sequence of phases. Revise the exercise heading only where it implies the latter.
4. Numeric equations and study limitations remain essential to a modelling reference. Neither brevity nor model preference justifies dropping them.
5. Original-source checks are still needed even where arithmetic reveals inconsistency. The correct arithmetic does not identify which reported direction was faithful to the experiment.
6. Gemini repeatedly recommends removing abstract-only and incomplete-appraisal disclosures. Move acquisition logistics out of scientific prose, but retain any limitation that changes how a claim can be used. A more authoritative tone cannot substitute for unavailable methods or unverified estimates.
7. Gemini proposes smoothing the CGM tracer paper's conflicting summary times into a single range. That could conflate different endpoints and conceal an actual reporting discrepancy. Check the original metrics before combining them; retain unresolved discrepancies when they affect interpretation.
8. Do not adopt Gemini's proposed changes of estimand or evidence type without verification: calling an SGLT2-associated percentage a prevalence, or recasting an overdose cohort as evidence from isolated adjunct-treatment case reports, can change the scientific meaning.

## Recommended correction order

1. Reconcile article identity and associated claims, prioritising insulin, DKA, overdose and carbohydrate physiology. Preserve an unresolved status where the intended publication cannot be identified.
2. Repair contradictory tables and repeated claims together. Use an occurrence search after each correction to prevent the same assertion surviving elsewhere.
3. Rebuild the few weak arguments around measurements and contrasts, especially gastric emptying, high-intensity exercise and glucotoxicity.
4. Remove revision-history prose and redundant summaries; retain the detailed physiology and necessary qualifications.
5. Synchronise the Knowledge Base from canonical BG Science, then validate the rendered sources. Do not edit generated physiological chapters independently.

Before that substantial revision, take a commit/push checkpoint if authorised. This review does not authorise publication or simulator changes.

## Final coverage and verification

All 30 numbered sections received external feedback. Coverage was divided between models, not independently duplicated across both:

| Reviewer | Sections assessed | Outcome |
|---|---|---|
| Claude Opus 5.5 High | §§1–5; §§6–10 | Two substantive responses, with chapter-specific coverage |
| Claude Opus 5.5 High | Intended continuation from §10b | Quota exhausted; no further calls to this model |
| Gemini 3.1 Pro High | §10b and §§11–14 | Substantive response |
| Gemini 3.1 Pro High | §§15–19 | Substantive response |
| Gemini 3.1 Pro High | §§20–24 | Substantive response |
| Gemini 3.1 Pro High | §§25–27 | Substantive response |
| Gemini 3.1 Pro High | §§28–29 | Substantive response |

The introduction and common writing criteria accompanied the packets. Headings at packet boundaries were not counted as reviewed chapters. Gemini's final packet explicitly identified §§28–29 as absent; those sections were reviewed in its separate earlier packet. No intended numbered section remains uncovered by external feedback.

The coordinating reviewer inspected the returned criticism, checked the priority passages against the canonical document and independently screened the specified bibliography subset. This does not certify every sentence or every original study. The 71 different-title occurrences require reconciliation; their count must not be presented as a count of false physiological claims. Findings BG26-01–11 remain OPEN, with the source-verification candidates in BG26-06 explicitly distinguished from demonstrated contradictions.

Canonical BG Science remains unchanged. No simulator code, generated website, Knowledge Base chapter or model parameter was edited; no commit or push was performed. The deliverables are this report and the linked bibliographic screening ledger. Raw model responses and review packets remain in the private editorial-review collection.
