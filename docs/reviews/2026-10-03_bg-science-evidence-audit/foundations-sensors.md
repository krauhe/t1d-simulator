# Foundations, insulin concentration–response and glucose sensing: evidence audit

Date: 2026-10-03. Sections read: 1–4, 25 and 27 of `BG-SCIENCE.md`, baseline version 2026-09-22-v2. This report records selected claim-level checks, not verification of every claim. The authorised correction pass implemented FS01–FS06 in version 2026-10-03-v1; no model changes were made. Findings below preserve the original observations and locations.

## Findings and additions

### FS01 — Incorrect insulin-microdialysis citation, year and anatomical site

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** Corrected identity/site and limited transport interpretation to the abstract; full-text acquisition remains open.

**Priority: correction.** Baseline locations: §25, lines 2162, 2226 and 2247.

The intended study is **Sjöstrand, Holmäng and Lönnroth (1999)**, *Measurement of interstitial insulin in human muscle*, DOI `10.1152/ajpendo.1999.276.1.E151`, PubMed identifier 9886961. The cited identifier 9886964 instead identifies Ajubi et al., *Signal transduction pathways involved in fluid flow-induced PGE2 production by cultured osteocytes*. Both identities were checked against Europe PMC records fetched from the local computer.

The intended study's abstract specifies **medial quadriceps femoris**, not forearm muscle, and 11 participants. At the lower insulin step it reports plasma insulin 155 ± 17 mU/L and interstitial insulin 67 ± 19 mU/L, with nine observations for that comparison; the higher-step values are 379 ± 58 and 180 ± 40 mU/L. Ratios of these reported means are approximately 0.43 and 0.47, respectively. These calculated ratios are not the distribution of individual participant ratios.

Correct the identifier, year and site in the document and the existing acquisition-wishlist entry. The full text was not obtained: the publisher returned HTTP 403, and Europe PMC lists subscription access. The abstract supports a plasma–interstitial concentration difference; it does **not by itself establish saturable transendothelial transport kinetics**. Do not preserve the stronger kinetic assertion solely on this citation.

### FS02 — An absolute compartment-scaling warning contradicts the qualified account nearby

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** Replaced the absolute error claim with compatible-scale and effect-state requirements.

**Priority: correction of reasoning.** Baseline location: §25, line 2226; compare line 2232.

The assertion that applying plasma-referenced half-maximal effective concentrations (EC50 values) to an effect compartment necessarily introduces systematic error is too broad. An effect compartment can be defined in plasma-equivalent concentration units and calibrated accordingly; it need not represent measured interstitial insulin. The necessary question is whether the input variable, units and calibration match the fitted concentration–response relationship. The section's subsequent modelling paragraph already makes this distinction correctly.

This is a dimensional/modelling inference, not a new physiological measurement. Replace the absolute statement with the specific requirement for compatible concentration scales. It does not justify changing the simulator's equations or parameters without a separate implementation review.

### FS03 — Basu full text upgrades the lag evidence, but contains unresolved reporting differences

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** §§1/27 now specify tracer means, sampling correction and inconsistent maxima; no universal sensor constant is inferred.

**Priority: substantive evidence update.** Baseline locations: §§1 and 27, especially lines 122, 138, 2378–2390 and 2436.

The current text accurately reproduces the abstract of **Basu et al. (2015)**: six fasting adults with type 1 diabetes (T1D), intravenous insulin, and a reported median appearance delay of 6.8 minutes (range 4.8–9.8). The newly available original provides information that materially changes how these numbers should be used:

1. The endpoint is first detectable enrichment of infused glucose tracers in abdominal microdialysate, not lag estimated from a consumer continuous glucose monitoring (CGM) trace during a meal or exercise.
2. The analysis corrects for **6.2 minutes of catheter dead-space transit**; that correction must not be added to a physiological delay parameter.
3. The Results give tracer-specific **mean (standard error)** delays of **7.1 (0.8)** and **8.1 (1.0) minutes**. These are not interchangeable with the abstract's median.
4. The Results mention complete detection by **10.8 minutes** for one tracer and **9.8 minutes** for the other, then call 9.8 minutes the overall maximum. This inconsistency is present on the original page, not merely an extraction error.

Original PDF pages 1 and 3 were inspected, including the printed Results on page 65; methods were also retrieved from the full-text extraction. Replace the obsolete abstract-only label with a concise account of the actual endpoint and tracer-specific estimates. Do not silently reconcile the conflicting maximum or use 9.8 minutes as a universal physiological ceiling. The experiment does not identify the time constant of a first-order sensor filter.

### FS04 — Beck supports population associations, not a universal TIR-to-HbA1c conversion

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** Added analysed denominators, prediction interval, regression intercept/slope and baseline-stratified estimates in §27.

**Priority: substantive evidence update.** Baseline location: §27, lines 2421–2425 and source list.

The current distinction between cross-sectional and longitudinal associations is sound. The newly available **Beck et al. (2019)** full text supplies the missing denominators and prediction uncertainty. Original PDF pages 2, 7 and 9 were inspected.

1. The pooled analysis uses participants from **CGM intervention arms of four trials**, rather than randomisation to a specified change in time in range (TIR). There are **545** observations at six months, but **455** for baseline and change analyses. Adults required at least 14 days of CGM data at six months and 10 days at baseline for baseline/change analyses.
2. At baseline, TIR 50% corresponds to predicted glycated haemoglobin (HbA1c) **7.9%**, with a reported 95% interval for an individual predicted value of **6.6–9.2%**. At six months the corresponding estimate is **7.6% (6.7–8.6%)**. A confidence interval for the population mean is much narrower and must not substitute for individual prediction uncertainty (Table 4).
3. For a **10-percentage-point** TIR increase, Table 5 predicts a mean HbA1c change of **−0.57 percentage points**, with individual prediction limits **−1.74 to +0.60**. Estimates depend on baseline HbA1c: **−0.40** for baseline 7.0–7.9%, versus **−0.99** for baseline ≥8.0%.
4. The reported overall regression is ΔHbA1c = −0.24 − 0.033 × ΔTIR, with TIR expressed in percentage points. Thus the estimate at +10 points is **not a slope of −0.06 per TIR point**: it includes an intercept. The reverse prediction is a separately fitted regression, not algebraic inversion.

Add the denominators and one useful prediction-interval example. Preserve the existing warning against individual conversion, but replace generic caution with these quantitative results. These are associations in selected trial participants, not proof that increasing TIR by an intervention causes a fixed HbA1c reduction.

### FS05 — Boyle confirms the corrected interpretation and adds important design limitations

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** §4 now distinguishes historical control protocols, preceding hypoglycaemia and uptake from transporter expression.

**Priority: evidence-status update.** Baseline location: §4, line 338 and source list.

**Boyle et al. (1995)** was previously available only through its abstract. Original PDF pages 2–4 now confirm 24 participants with T1D, divided into three HbA1c groups of eight, and 15 controls. Brain glucose uptake was calculated from the arterial–jugular glucose difference and cerebral blood flow; it was **not a direct measurement of glucose transporter expression**.

The T1D protocol lowered plasma glucose from approximately 105 to 54 mg/dL (5.8 to 3.0 mmol/L), with equilibration and uptake measurements at the plateaus. The low-HbA1c group had no statistically significant reduction in uptake; this does not establish equivalence or a universal protective threshold. The current 3.0 mmol/L interpretation should be retained.

The full text identifies a further limitation absent from the current description: **control results came from a previously reported study**, using glucose values of 85 and 55 mg/dL for comparison. The baseline glucose exposure was therefore not identical. The low-HbA1c group also reported more preceding hypoglycaemia. These observations support an association with adaptation but cannot isolate whether HbA1c, recurrent hypoglycaemia or another correlated exposure caused it. Replace the obsolete access label and add the historical-control limitation; do not restore earlier claims of directly demonstrated transporter upregulation.

### FS06 — Renal estimates can be made more informative without replacing a reasonable summary

**STATUS: ✅ FIKSET (2026-10-03; local, uncommitted).** §3 retains the conditional summary and adds the ten-study range, unweighted mean and denominator distinction.

**Priority: optional quantitative context.** Baseline locations: §§2–3, particularly line 253.

The current distinction between endogenous and hepatic glucose production, and between gross renal production and net renal balance, is appropriate. The newly supplied **Gerich et al. (2001)** review documents why a single renal fraction is uncertain. Original PDF page 5, printed page 386, was checked: Table 2 summarises ten studies with renal contributions of **5–28%** of total release in normal postabsorptive humans, with an **unweighted study mean of 20%**. It is not a patient-level pooled estimate or a T1D reference interval.

The same page explains that approximately 20% of total production can correspond to approximately 40% of total gluconeogenesis when gluconeogenesis supplies roughly half of total production. Those percentages have different denominators. This supports the present 20–25% summary as a useful conditional approximation, while providing a better account of measurement heterogeneity. It does not establish a fixed renal share during insulin-deficient T1D. Underlying studies were not independently re-appraised in this pass.

## Coverage and remaining work

| Section | Reading coverage | Source-level depth in this pass |
|---|---|---|
| 1. Distribution | Entire section | Basu's tracer endpoint and reporting differences |
| 2. Liver | Entire section | Cross-checked endogenous/hepatic distinction against Gerich; no fresh verification of every glycogen or gluconeogenesis parameter |
| 3. Kidney | Entire section | Gerich historical synthesis and denominator distinction; no new primary renal dataset appraisal |
| 4. Brain | Entire section | Boyle methods, historical controls, results and interpretation |
| 25. Insulin concentration–response | Entire section | Sjöstrand identity/abstract and internal concentration-scale reasoning; full-text transport kinetics unresolved |
| 27. CGM | Entire section | Basu endpoint; Beck study selection, Tables 4–5 and prediction versus mean uncertainty |

Meier (2005), Woerle (2003) and Simpson (2007) are available follow-up candidates; availability is not recorded as completed appraisal. Selected Meier text was retrieved but no finding here relies on its numerical estimates. Remaining claims in these sections are not certified by this audit.

## Sources and access verification

The five publications below were matched to Europe PMC metadata by local HTTP requests on 2026-10-03. Their conventional PubMed page requests returned HTTP 203 without the expected article content; the publisher request for Sjöstrand returned HTTP 403. Therefore the PubMed/publisher routes are **not locally verified as readable pages**. The linked metadata endpoints below returned HTTP 200 with matching title, authors, year and identifier. Metadata access does not imply full-text access.

1. [Sjöstrand, M., Holmäng, A. and Lönnroth, P. (1999). “Measurement of interstitial insulin in human muscle.” *American Journal of Physiology*, 276, E151–E154.](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A9886961%20AND%20SRC%3AMED&format=json&resultType=core) Abstract and bibliographic identity checked; full text pending on the existing wishlist.
2. [Basu, A. et al. (2015). “Time lag of glucose from intravascular to interstitial compartment in type 1 diabetes.” *Journal of Diabetes Science and Technology*, 9, 63–68.](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A25305282%20AND%20SRC%3AMED&format=json&resultType=core) Local original: `Basu_2015_IntravascularInterstitialGlucoseLag.pdf`.
3. [Beck, R.W. et al. (2019). “The Relationships Between Time in Range, Hyperglycemia Metrics, and HbA1c.” *Journal of Diabetes Science and Technology*, 13, 614–626.](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A30636519%20AND%20SRC%3AMED&format=json&resultType=core) Local original: `Beck_2019_TimeInRangeAndHbA1c.pdf`.
4. [Boyle, P.J. et al. (1995). “Brain glucose uptake and unawareness of hypoglycemia in patients with insulin-dependent diabetes mellitus.” *New England Journal of Medicine*, 333, 1726–1731.](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A7491135%20AND%20SRC%3AMED&format=json&resultType=core) Local original: `Boyle_1995_BrainGlucoseUptakeHypoglycemia.pdf`.
5. [Gerich, J.E. et al. (2001). “Renal gluconeogenesis: its importance in human glucose homeostasis.” *Diabetes Care*, 24, 382–391.](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A11213896%20AND%20SRC%3AMED&format=json&resultType=core) Local original: `Gerich_2001_RW_RenalGluconeogenesis.pdf`. Review-level evidence.

Exact file hashes and claim-specific original-page checks are recorded in [foundations-sensors-claims.json](foundations-sensors-claims.json). No duplicate article download was needed. The invalid Mergenthaler PDF previously identified by archive maintenance was excluded; this does not invalidate the separately available HTML version.

## Abbreviations

1. CGM — continuous glucose monitoring: sensor-based glucose observation, distinct from the tracer endpoint audited here.
2. EC50 — half-maximal effective concentration: interpretable only relative to the experiment's concentration scale and response.
3. HbA1c — glycated haemoglobin: an integrated glycaemic marker, not uniquely determined by TIR.
4. T1D — type 1 diabetes: the target disease, not the population of every underlying physiology experiment.
5. TIR — time in range: here the percentage of sensor observations between 70 and 180 mg/dL.

## Status summary

Six items fixed in scientific prose. Sjöstrand full-text access and Basu's original reporting inconsistency remain unresolved and are explicitly bounded in the chapter. No numerical recalibration of the simulator was performed.
