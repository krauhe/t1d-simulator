# BG-SCIENCE: evidence audit after the October literature intake

Scientific audit · 3 October 2026 · Source version 2026-09-22-v2

## Executive assessment

BG-SCIENCE contains substantial physiological detail, but several conclusions remain stronger than their cited evidence. The most consequential problems are incorrect source identities, unannounced transfers between populations, and confusion between measured outcomes and proposed mechanisms. The new full texts make these problems identifiable and also confirm several earlier corrections. The appropriate response is targeted correction and deeper synthesis, not wholesale replacement or indiscriminate shortening.

All 30 sections were read across four bounded reviews. Original-source checks were selective, prioritising newly acquired papers and claims with consequences for physiological interpretation. The audit records 27 items requiring correction, qualification or useful evidence updates; these are not 27 demonstrated errors. Section-by-section coverage and unverified claims remain visible in the four supporting reports.

The original audit made no chapter changes. Following authorisation, its documented corrections were implemented locally in BG-SCIENCE version **2026-10-03-v1**. The findings below describe the audited baseline; the status summary and supporting reports record subsequent corrections. No implementation documentation, simulator code or model calibration was changed. No commit or push was performed.

## Correction status — 3 October 2026

1. **✅ FIKSET:** FS01–FS06, MA01–MA07, RH01–RH08, EM01–EM03 and EM05: 25 of the 27 principal findings. Corrections include source identities, population and endpoint distinctions, quantitative interpretation and supported additions from newly acquired originals. Supporting check SC02 was also updated with Bergman's original animal-study methods.
2. **⚠️ DELVIST:** EM04 and EM06. The incorrect Ceriello attribution and unsupported general temperature/device coefficients have been removed or narrowed. Independent T1D vascular-recovery estimates and product-specific thermal effects still require their own original-source appraisal.
3. **Remaining evidence gaps:** Sjöstrand and Reschke full texts, other explicitly unverified inherited claims and source-specific follow-up remain open. Correcting a statement does not mean all evidence in its chapter has been independently certified.
4. **Scope:** scientific documentation only. The Knowledge Base imports the corrected canonical source through its existing synchronisation script; no physiological implementation changes follow automatically from this audit. The originally generated audit PDF is a pre-correction snapshot; this Markdown report and its refreshed HTML carry the correction status.

## Corrections with the greatest scientific consequence

### 1. Repair source identity before revising physiology

The insulin concentration–response section cites the wrong year, muscle and PubMed identifier for Sjöstrand's muscle-microdialysis study. The intended paper is from 1999, samples medial quadriceps, and has identifier 9886961; the current identifier 9886964 refers to osteocytes. The abstract establishes a plasma–interstitial concentration difference, but is insufficient to establish the section's stronger claim of saturable transport. Its full text remains requested. See FS01 in the [foundations and sensors audit](2026-10-03_bg-science-evidence-audit/foundations-sensors.md).

Two other incorrect identifiers connect physiological claims to unrelated publications. The Englyst banana paper is identifier 3014853, not 3789750; the latter concerns carcinogenic risk. The Ceriello nitrotyrosine paper is from 2001, identifier 11508267; identifier 11935147 concerns encapsulated pancreatic-islet transplantation. The seasonal-onset paper attributed to Kamrath is by Reschke et al. (2022), identifier 36166593. These are identity errors, not merely broken links (MA01, EM04, RH08).

### 2. Preserve population and endpoint boundaries

The distress section places the 3D study's 84.1% and 66.7% depression/distress overlap estimates immediately after a paragraph about ==type 1 diabetes (T1D)==, without identifying the population change. The cited review explicitly describes 502 adults with ==type 2 diabetes (T2D)== followed for 18 months. The association remains informative, but not as a T1D-specific estimate ([Fisher et al., 2014](../references/Fisher_2014_RW_DepressionDistressDiabetes.pdf), p. 769; EM01).

The generic 95–100% carbohydrate-to-portal-blood estimate is not established by the cited banana ileostomy experiment. That study measured terminal-ileal recovery in three ileostomists, not portal appearance. Resistant starch, digestible carbohydrate, portal delivery and systemic glucose appearance require separate denominators. This is an attribution and measurement problem; it does not prove that every estimate near 100% absorption of an appropriately defined digestible fraction is false ([Englyst and Cummings, 1986](../references/Englyst_1986_BananaCarbohydrateDigestion.pdf), p. 46; MA01).

The glucotoxicity section combines vascular-cell injury, lipid-induced muscle insulin resistance and T1D dose requirements too readily. Du's endothelial experiments and Szendroedi's human lipid-infusion study address different tissues, exposures and outcomes. They cannot jointly establish a universal T1D hyperglycaemia-to-insulin-resistance curve. The original Ceriello paper measures plasma nitrotyrosine in 40 participants with T2D and 35 controls, not the claimed time course of T1D flow-mediated vasodilation ([Ceriello et al., 2001](../references/Ceriello_2001_NitrotyrosineDiabeticPlasma.pdf), p. 834; EM03–EM04).

### 3. Separate clock effects, sleep loss and observed glucose patterns

The sleep chapter describes the Scheer forced-desynchrony experiment as misalignment with adequate sleep. The original reports sleep efficiency of 67% under misalignment versus 84% under alignment. Its glucose and insulin changes cannot therefore be attributed to misalignment independently of sleep loss on that experiment alone. The reported 6% glucose increment is averaged across the behavioural cycle, not a universal postprandial or T1D effect ([Scheer et al., 2009](../references/Scheer_2009_CircadianMisalignmentMetabolicConsequences.pdf), p. 4454; RH06).

Likewise, a low-to-high ==continuous glucose monitoring (CGM)== trace is not sufficient to diagnose endogenous hormonal rebound. The dawn section labels such a sequence a Somogyi pattern, whereas the subsequent chapter correctly separates temporal sequence from cause. The definite coordinated T1D tissue-sensitivity curve in the diurnal section also exceeds the experimental evidence. These internal inconsistencies should be corrected before adding further mechanistic detail (RH02–RH04).

## What the new articles add

### More useful quantitative interpretation

The Basu full text distinguishes tracer first appearance from sensor delay and from a model time constant. Its Results report tracer-specific mean delays of 7.1 and 8.1 minutes after correcting for catheter dead-space transit. The abstract uses a different summary statistic, and the Results contain inconsistent maximum-delay statements. These differences are visible in the original; they should be reported rather than silently reconciled into one supposedly universal parameter ([Basu et al., 2015](../references/Basu_2015_IntravascularInterstitialGlucoseLag.pdf), pp. 63, 65; FS03).

The Beck full text strengthens the existing distinction between ==time in range (TIR)== and ==glycated haemoglobin (HbA1c)==. There are 545 observations at six months but 455 in the change analysis. A 10-percentage-point TIR increase corresponds to predicted HbA1c change of −0.57 percentage points, with individual prediction limits from −1.74 to +0.60. The estimate includes a regression intercept; it is not a universal conversion slope or a randomised intervention effect. One such numerical example is more informative than repeated generic warnings ([Beck et al., 2019](../references/Beck_2019_TimeInRangeAndHbA1c.pdf), Tables 4–5; FS04).

### Better comparisons, not more isolated numbers

The exercise chapter can contrast controlled eccentric exercise, ordinary activity and marathon recovery. Kirwan's healthy-adult comparison and Tuominen's post-marathon observations show why glycogen depletion alone does not determine subsequent insulin action. Asp's original confirms that the reported dispersion is ==standard error of the mean (SEM)== and preserves the difference between local muscle findings and whole-body maximal-clamp effects. These studies improve mechanistic discrimination; they do not supply a general T1D post-exercise dosing multiplier (MA05–MA07).

The formerly unidentified five-protein trial is Li, Wainwright et al. (2025), not the Dao review that cites it. Its original Results report no statistically significant difference between the five protein meals. The full XML article is now archived. Exact table-cell verification remains separate from identifying the study and reading its reported comparison. The finding should replace the obsolete “unidentified study” note, not become a ranked set of protein-source coefficients (MA02–MA03).

### Stronger methods appraisal of historical studies

Boyle's original confirms the corrected 3.0 mmol/L brain-uptake interpretation. It additionally reveals that healthy control results came from a previously reported protocol with a different starting glucose concentration. Widom's approximately 19% luteal disposal difference has a within-subgroup p-value of 0.09 and comes from participants selected for previously reported premenstrual deterioration. These details determine how the findings can be used; they are not dispensable disclaimers (FS05, RH05).

Acquisition labels are now obsolete for several papers, including Søeborg, Asp, Frid, Boyle, Beck and Bergman. Removing an access caveat should follow the actual source check, not merely successful download. Frid's consensus recommendations and Bergman's original animal model-identification experiment should remain recognisable as different evidence types (MA04–MA05, EM02, SC02).

### Explicit validation boundaries for research models

The 2014 UVA/Padova article states that the S2008 and S2013 versions were validated and accepted by the ==United States Food and Drug Administration (FDA)== for a single-meal scenario only. That publication does not establish realistic unrestricted day-to-day simulation or the status of later versions. The model comparison should state this specific boundary alongside its existing version distinctions ([Dalla Man et al., 2014](../references/DallaMan_2014_UVAPadovaT1DSimulator.pdf), p. 32; EM05).

## Revision order

1. Correct identifiers, authors, years and study populations; resolve the Somogyi cross-chapter inconsistency and the Scheer sleep-control description. These changes prevent readers from drawing conclusions from the wrong experiment.
2. Rework the glucotoxicity, diurnal-sensitivity and meal-appearance passages around actual measurements. Separate tissue, exposure, population, flux and concentration outcomes. Retain quantitative uncertainty where it changes interpretation.
3. Replace stale acquisition notes and integrate the new comparisons: exercise recovery, protein sources, brain uptake, renal-production denominators and CGM prediction uncertainty. Avoid adding a standalone paragraph for every newly obtained paper.
4. Continue source-level verification of unresolved temperature, illness, high-intensity-exercise and inherited parameter claims. No contrary evidence was established for every unsupported number; absence of verification is not proof that a number is wrong.
5. Only after the scientific correction pass, evaluate whether any finding warrants a simulator change. Documented model implications are not automatic parameter prescriptions. Take a commit/push checkpoint before a substantial rewrite, if authorised.

## Coverage and audit trail

The supporting reports preserve exact source-document locations, original-page checks, findings and remaining gaps:

1. [Foundations and sensors](2026-10-03_bg-science-evidence-audit/foundations-sensors.md): §§1–4, 25, 27; six items FS01–FS06. [Claim records](2026-10-03_bg-science-evidence-audit/foundations-sensors-claims.json).
2. [Meals, insulin and activity](2026-10-03_bg-science-evidence-audit/meals-activity.md): §§5–10 and 10b; seven items MA01–MA07. [Claim records](2026-10-03_bg-science-evidence-audit/meals-activity-claims.json).
3. [Rhythms and hormones](2026-10-03_bg-science-evidence-audit/rhythms-hormones.md): §§11–18; eight items RH01–RH08. [Claim records](2026-10-03_bg-science-evidence-audit/rhythms-hormones-claims.json).
4. [External factors and research models](2026-10-03_bg-science-evidence-audit/external-models.md): §§19–24, 26, 28–29; six items EM01–EM06 and two supporting checks SC01–SC02. [Claim records](2026-10-03_bg-science-evidence-audit/external-models-claims.json).

Three bounded agents performed independent topic reviews. The coordinating reviewer read their complete reports, compared findings with the source document, and independently inspected original pages for Englyst, Asp, Fisher, Scheer, Szendroedi and Dalla Man. The Ceriello original and the misattributed Reschke record were additionally checked during integration. This control corrected overstatements in the draft audit itself, including an unsupported “underpowered” description and a claim of broader visual verification than had occurred.

The source document contains approximately 71,804 whitespace-delimited words. Its baseline SHA-256 is C6EEBAAA40056D599719E78EE9F8B02D233B987E89F131442AFCFEB0956CEBDA. Whole-section reading is not equivalent to checking all cited studies. In particular, the contextual passes through §§9, 10b, 17, 19, 21 and 23 do not establish that their remaining quantitative claims are correct.

Three additional full texts were obtained during the audit: Li (2025) and Manousaki (2021) as original XML, and Ceriello (2001) as a PDF. The acquisition register records identity, hashes and access routes. Sjöstrand remains on the wishlist with its corrected identifier; Reschke was added with its correct authors and identifier after publisher access failed. Local checks distinguished real article content from successful HTTP responses containing browser challenges. See the [search and access log](2026-10-03_bg-science-evidence-audit/search-access-log.md).

## Conclusion

The new literature supports a more discriminating review, not simply a longer one. The highest-value improvement is to keep each estimate attached to the population, protocol and endpoint that produced it, then compare genuinely comparable studies. Several existing passages already do this well. The remaining inconsistencies should be corrected before this document is treated as a dependable quantitative basis for further model development.

All 27 audit items remain open for an authorised correction pass. Confirmed statements are documented separately; no production-text fix is claimed.

## Selected references

1. [Basu, A. et al. (2015). “Time lag of glucose from intravascular to interstitial compartment in type 1 diabetes.” *Journal of Diabetes Science and Technology*, 9, 63–68.](../references/Basu_2015_IntravascularInterstitialGlucoseLag.pdf)
2. [Beck, R.W. et al. (2019). “The Relationships Between Time in Range, Hyperglycemia Metrics, and HbA1c.” *Journal of Diabetes Science and Technology*, 13, 614–626.](../references/Beck_2019_TimeInRangeAndHbA1c.pdf)
3. [Ceriello, A. et al. (2001). “Detection of nitrotyrosine in the diabetic plasma: evidence of oxidative stress.” *Diabetologia*, 44, 834–838.](../references/Ceriello_2001_NitrotyrosineDiabeticPlasma.pdf)
4. [Dalla Man, C. et al. (2014). “The UVA/PADOVA Type 1 Diabetes Simulator: New Features.” *Journal of Diabetes Science and Technology*, 8, 26–34.](../references/DallaMan_2014_UVAPadovaT1DSimulator.pdf)
5. [Englyst, H.N. and Cummings, J.H. (1986). “Digestion of the carbohydrates of banana (Musa paradisiaca sapientum) in the human small intestine.” *American Journal of Clinical Nutrition*, 44, 42–50.](../references/Englyst_1986_BananaCarbohydrateDigestion.pdf)
6. [Fisher, L., Gonzalez, J.S. and Polonsky, W.H. (2014). “The confusing tale of depression and distress in patients with diabetes: a call for greater clarity and precision.” *Diabetic Medicine*, 31, 764–772.](../references/Fisher_2014_RW_DepressionDistressDiabetes.pdf)
7. [Scheer, F.A.J.L. et al. (2009). “Adverse metabolic and cardiovascular consequences of circadian misalignment.” *Proceedings of the National Academy of Sciences*, 106, 4453–4458.](../references/Scheer_2009_CircadianMisalignmentMetabolicConsequences.pdf)

Additional source identities, original-page locators and full-text limitations are recorded with the corresponding findings in the supporting reports. Links to archived originals are for this local review and require the local article files; they are not public redistribution links.

## Abbreviations

1. CGM — continuous glucose monitoring: a sensor measurement system, not a direct measurement of glucose production or tracer transit.
2. FDA — United States Food and Drug Administration: the authority discussed in the historical simulator-validation claim.
3. HbA1c — glycated haemoglobin: an integrated glycaemic marker with substantial individual variation relative to sensor metrics.
4. SEM — standard error of the mean: uncertainty in a mean, not the standard deviation of individual observations.
5. T1D — type 1 diabetes: the target disease; evidence from other populations remains explicitly labelled.
6. T2D — type 2 diabetes: the population in several studies incorrectly generalised in the current document.
7. TIR — time in range: here the percentage of sensor observations between 70 and 180 mg/dL.
