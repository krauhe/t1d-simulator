# Food kinetics: historical calibration and evidence after separating gastric transport

Date: 2026-10-25

Analysis status: complete within the bounded historical and qualitative evidence scope below

Decision status: recalibration recommended; no parameter changes approved by this report

Implementation: documentation only in this follow-up

Commit and publication: checkpoint e4b8494 precedes the local uncommitted model implementation; no push or publication

Related report: [implemented structure, parameters and comparisons](2026-10-25_gastric-intestinal-fix.md).

Release follow-up, 2026-10-25: the owner subsequently prioritized publication. The [release assessment](2026-10-25_release-acceptance.md) documents targeted meal/fibre checks, corrected documentation and acceptance as a heuristic learning beta without new parameter tuning. It narrows the immediate release gate; it does not close the quantitative validation question below.

## 1. Question and conclusion

The owner asked whether the changed responses to other foods still agree with literature, what evidence exists, and how the previous model was calibrated.

**Neither the inherited parameter values nor the newly accelerated mixed-meal responses have a demonstrated quantitative validation chain in the material examined.** The previous model was manually tuned using literature-informed expectations and internal tests. Separating gastric transport from downstream appearance gives independent control of the processes, but does not establish that the resulting meal curves are more accurate. Passing numerical and regression tests does not resolve this question.

This audit does not fit parameters, establish clinical reference ranges, or change the model. It is not a systematic literature review. The finding is that no reproducible protocol-matched parameter fit was found in the inspected history, not proof that no relevant material exists elsewhere.

## 2. Historical parameter provenance

| Component | Traceable history | Calibration assessment |
|---|---|---|
| Shared two-stage time, initially 40 min | e6933d9, 2026-03-06, historical js/hovorka.js | Effective two-compartment appearance model. Its two states were not independently measured anatomical compartments. |
| Sugar/starch base, now 25–50 min | e069913 began at 15–50; c8f4106 changed to 25–50 on 2026-04-10 | Manual adjustment after sugar responses appeared too fast. Comments cited plasma glucose/OGTT peak times. No identified estimation translating those peaks into these exact time constants. |
| Drink retention value 0.4 | e069913 used 0.4; c8f4106 changed to 0.5; 3ddd959 restored 0.4 | Form proxy. With the actual modifier, 25*(0.4+0.6*0.4)=16 min. Historical wording about a 2.5-fold acceleration did not describe this formula. |
| Fibre multiplier 1+0.5*ln(1+F/2) | 3ddd959, 2026-04-11, replaced 1+0.05*F | Commit/code explicitly connected lower glucose AUC and GI to larger tau. No justified mapping or fitted values for 0.5 and 2 g was found. Total fibre conflates viscosity and food matrix. |
| Fat delay 18*ln(1+fatIntestine/10) | f551aa0, 2026-03-12 | Literature-informed delayed response; no fitted derivation of 18 min and 10 g identified. The model uses current intestinal fat, not the ingested dose used in trials. |
| Product composition | April food-category changes and September food-catalog review | Nutrient databases/declarations inform grams and portions. They do not identify gastric or systemic appearance time constants. |

Historical tests checked ordering, slopes, glucose excursions and broad AUC consistency. In 3ddd959, AUC spread tolerance was changed to 35%; this was not a fit to observed curves from seven food products. Later deterministic tests improved reproducibility, not clinical identification.

The [April review](2026-04-11_carb-model_review.md), especially sections 1, 3 and 4, already identified incomplete source provenance, aggressive fibre tuning and semiempirical parametrization. These concerns remain relevant; older positive review language is not independent experimental validation.

## 3. Why endpoint distinctions matter

A plasma glucose curve reflects carbohydrate appearance, insulin action, hepatic production and glucose disposal. A CGM curve adds sensor dynamics. GI or glucose iAUC therefore cannot uniquely determine a gastric time constant. Halving glucose iAUC does not generally imply doubling tau.

For a single exponential gastric pool with constant tau, its half-emptying time is ln(2)*tau. For two equal constant-time compartments after an instantaneous input, peak appearance occurs at tau and half cumulative appearance at approximately 1.678*tau. These are different endpoints. MODEL-IMPLEMENTATION.md:1007–1011 links a stated gastric half-time of 90–120 min to tau around 60 without a defensible mapping: 60 could approximately match a two-stage cumulative endpoint, but not a single gastric half-time. The cited clinical half-time itself was not reappraised in this audit.

Calling the former shared modifier a proven physiological "double delay" would be too strong. A shared parameter can be legitimate in an empirical response model. The problem is interpreting it as two separately identified processes and retaining its calibration claims after changing its application.

## 4. Evidence inspected and its limits

1. **Smart et al. (2013), DOI 10.2337/dc13-1195.** Original archived full HTML, methods/results and discussion inspected. Matched-carbohydrate meals with varied fat/protein and individually standardized insulin in young people with T1D produced later glycaemic effects. This supports testing meal composition and late responses; it does not identify our fat-delay coefficient or isolate intestinal carbohydrate transport. [Original full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC3836096/).
2. **Wolpert et al. (2013), DOI 10.2337/dc12-0092.** Original archived full XML inspected for protocol and conclusions. High/low-fat dinners had matched carbohydrate and protein, with closed-loop insulin adjustment. Glucose and insulin requirements changed. Because insulin also changed, this is not a direct measurement of absorption kinetics. Local source: docs/references/Wolpert_2013_DietaryFatInsulinRequirementsT1D.xml.
3. **Bell et al. (2020), DOI 10.2337/dc19-0687, PMID 31455688.** Original abstract only. At the same insulin dose, increasing meal fat reduced early glucose iAUC and increased later iAUC in adults with T1D. This supplies a useful qualitative comparison target; quantitative fitting requires the full protocol and results. Archived as docs/references/Bell_2020_DietaryFatDoseT1D_Abstract.html.
4. **Wolever et al. (2020), DOI 10.1093/ajcn/nqz285, PMID 31828287.** Original abstract only. A crossover breakfast study in people without diabetes varied oat beta-glucan viscosity; gastric and glycaemic effects differed when viscosity was reduced despite retaining the beta-glucan amount. This argues against treating all fibre grams identically. It does not establish T1D product-specific constants or partition the effect between stomach and intestine. Archived as docs/references/Wolever_2020_OatBetaGlucanViscosity_Abstract.html.
5. **Historical Würsch 1997 local HTML is an internal abstract/citation note, not full text.** It contains a model interpretation relating reduced glycaemia to doubled tau. That interpretation must not be treated as a measured finding from the paper. Its claim about intestinal viscosity needs full-text and primary-source appraisal before a downstream mechanism is calibrated.

No original figure digitization, numerical table extraction or literature-derived assertion range was performed. These sources support qualitative constraints, not exact replacements for the current constants.

## 5. Consequences for the current local implementation

Current code: js/physiology-engine.js:2123–2135 retains the gastric base, fibre multiplier and fat delay. js/foods.js:93–224 supplies separate provisional downstream times. Fibre no longer modifies the downstream rate and no separate intestinal viscosity state was introduced.

The existing before/after experiment found approximately +0.89 mmol/L for oatmeal and +1.03 mmol/L for burger at 120 minutes, new minus old food effect at dt=0.1 min. These were matched 30 g carbohydrate simulations **without meal bolus**, not clinical trials or meal-versus-meal equivalence tests. They demonstrate a material change requiring explanation, not better clinical accuracy. Exact setup and complete results remain in the linked implementation report and tests/gastric-intestinal-comparison.cjs.

**Status: ❌ ÅBEN — quantitative food-kinetics validation.** Removing a shared modifier may remove an artefact, a useful empirical approximation, or both. In particular, gastric-only fibre effects must not be assumed sufficient. Conversely, reinstating the same fibre multiplier in both stages would not constitute an evidence-based correction either.

## 6. Recommended next validation and decision log

1. Retain the separate-process architecture for the local prototype, with explicit provisional parameter labels.
2. Select a small set of original meal studies with usable full protocols: a simple carbohydrate reference, a defined starch/fibre comparison, and matched carbohydrate meals differing in fat. Match dose, form, ingestion duration, insulin, baseline glucose and observation window.
3. Assess gastric measurements separately from systemic appearance and plasma/CGM endpoints. Identify which parameters the available data can actually constrain. Do not fit every model mechanism to the same glucose peak.
4. Assess fibre type/viscosity and food matrix explicitly before selecting a downstream term. Avoid translating generic GI into tau.
5. Predefine literature targets and tolerances, document fitted versus assumed parameters, and validate on a different scenario before publication. Do not tune only to preserve the old curves.

| Date | Decision and authority | Reopening criterion |
|---|---|---|
| 2026-10-25 | User requested this audit. No new kinetic adjustment authorized by the question. | A specific approved calibration scope and sufficiently detailed original data. |
| 2026-10-25 | Recommendation: complete targeted validation before publishing the changed meal kinetics. | Documented protocol-matched comparison and acceptable results. |

## 7. Provenance and reusable status

An independent Codex agent audited historical commits, tests and reviews without changing files. The primary agent checked the key fibre-calibration diff, current formulas, April review and original-source passages. No external AI opinion was used as scientific evidence in this follow-up.

Archive checks before and after acquisition: the first reported 173 cached PDF conversions, three pending and none blocked; the two new sources are HTML abstract snapshots, not new full-text PDFs. Private retrieval responses and source metadata are in .local-artifacts/2026-10-25-food-kinetics-audit/. Full text for the two new studies was not obtained or appraised.

Local link verification: Smart PMC returned HTTP 200 with the correct article title. PubMed pages for Bell/Wolever returned HTTP 203 without article content; Europe PMC article pages returned 403. Their Europe PMC REST responses were accessible, with matching PMID, title, authors, DOI and abstract, and were retained privately. Public article-page links for those two sources are therefore not certified locally; consult the archived abstracts by identifier.

Reusable conclusion: **literature-informed heuristic tuning, not demonstrated product-specific calibration.** Numerical verification is complete for the implementation scope described elsewhere; quantitative literature validation remains open. No simulator code or parameters were changed by this audit.
