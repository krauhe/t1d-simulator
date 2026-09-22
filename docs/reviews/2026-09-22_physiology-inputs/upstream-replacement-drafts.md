# Meals, insulin and activity: upstream replacement drafts

Date: 2026-09-22. Target: `docs/BG-SCIENCE.md`, §§5–9 and §22 only. The root approved these bounded edits and authorised integration into the six assigned sections. **Status: integrated locally on 2026-09-22; no commit or build. P07 remains partly open for source identity.** Locators use section headings and distinctive text because concurrent work changes line numbers. Existing historical search coverage is not advanced by this targeted check.

## 1. §5: nutrient delivery, concentration and endpoint boundaries

### P01 — caloric feedback is not a universal constant flux

**STATUS: FIXED (2026-09-22, root integration).** Caloric-clamp framing and volume direction corrected; false Marciani attribution replaced by Kwiatek. The numerical calorie coefficient was withheld because indexed and partial original text disagree. See `kwiatek-followup.md`; original full-text acquisition remains open.

Locator: `Cephalic phase and gastric processing`, paragraph beginning `A central physiological feature is caloric clamping`; corresponding `Caloric delivery rate to duodenum` table row.

Replace the paragraph with:

> Small-intestinal nutrient exposure inhibits further gastric delivery through neural and hormonal feedback, including cholecystokinin, glucagon-like peptide-1 and peptide YY. Gastric energy delivery in healthy adults is often summarised as approximately 1–4 kcal/min, but this is a broad physiological range rather than an invariant clamp across meal size, physical form and composition. Larger meals can take longer to empty without implying a fixed linear relation between calories and emptying time. Gastric delivery is also distinct from systemic glucose appearance, which incorporates digestion, absorption and splanchnic metabolism (Marathe et al., 2013).

Table population/interpretation: `Broad range in health; not a fixed rate for each meal or a T1D-specific maximum glucose appearance rate.`

Basis: retained Marathe full-text XML, `Gastric emptying in health and diabetes` and `Impact of gastric emptying on glycemia and incretin hormones`. Review-supported, not a newly appraised original cohort.

### P02 — glucose does not require disaccharidase hydrolysis; food-peak table is overprecise

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: table row `Glucose tablets, honey` and neighbouring food-specific peak ranges.

Replace explanation with `Glucose is already a monosaccharide; dissolution and gastric delivery precede absorption. Honey is a variable mixture of sugars and should not be assigned the same fixed kinetic profile.` Remove fixed peak ranges for individual foods unless each row is tied to an original study with population, meal dose and endpoint. A CGM peak is not a glucose-appearance peak.

Use this table introduction instead:

> Food structure, processing, viscosity and nutrient feedback alter carbohydrate delivery, but a food name or glycaemic-index value does not determine a unique time to peak systemic glucose appearance. Quantitative food comparisons require an identified preparation, portion, study population and measurement method.

### P03 — distinguish GIP from GLP-1

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: T1D-specific point 1, `these gut hormones continue to slow gastric emptying`.

Replace the point with:

> **Loss of incretin-amplified insulin secretion does not abolish gastrointestinal feedback.** In T1D, loss of functional β-cell mass limits the insulin-secretory component of the incretin response. GLP-1 can still slow gastric emptying; this effect should not be assigned to GIP, which did not slow emptying in the human studies reviewed by Marathe and colleagues. Gastric emptying in T1D may be normal, delayed or accelerated, depending on the population and physiological state. These responses should not be reduced to one normal absorption curve lacking only its accompanying insulin pulse (Marathe et al., 2013).

Basis: Marathe full text explicitly contrasts endogenous/exogenous GLP-1 with GIP. Original GIP experiments were not independently acquired.

### P04 — prevalence, natural history and hyperglycaemia are separate questions

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: T1D-specific gastroparesis point, `Prevalence and epidemiology`, `irreversible`/`permanent`; modulator 5, `adds a further` and `effect direction is reversed`.

Replacement epidemiological qualification:

> Estimates of gastroparesis depend on whether a study requires symptoms, objectively delayed emptying, or both, and whether participants are community-dwelling or referred for gastrointestinal symptoms. The cited 5.2% ten-year cumulative incidence is not a point-prevalence estimate and should not be pooled informally with prevalence figures. Delayed emptying is not synonymous with inevitable irreversible autonomic neuropathy; the pathogenesis is heterogeneous, and longitudinal behaviour cannot be inferred from cross-sectional early- versus late-duration cohorts (Marathe et al., 2013).

Replacement modulator 5:

> Acute hyperglycaemia can slow gastric emptying in controlled clamp studies. The effects at different glucose targets were obtained in different protocols and should not be added as sequential increments. Faster average emptying in a separate early-T1D cohort does not show that acute hyperglycaemia accelerates emptying in that cohort. Baseline disease phenotype and the within-person effect of an acute glucose change must remain distinct.

Retain Schvarcz's identified n=8 healthy/n=9 T1D, 4-versus-8 mmol/L clamp results with their existing abstract-only qualification. Remove the causal inference that the between-group difference proves pre-existing autonomic damage. Do not convert severity categories into universal model time constants or label gastroparesis parameters permanently fixed. Choung/Ye/Camilleri originals were not newly appraised here; their individual percentages remain a source gap, not verified errors apart from the incidence/prevalence conflation.

### P05 — fibre and gastric modulators: preserve mechanism, remove unsupported prescriptions/precision

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: `Carbohydrate counting and fibre`; viscous-fibre paragraph/table calling 4.5–5.5 g the EFSA threshold; gastric modulators 1–10 and their percentage table.

Replace the clinical fibre timing sentence with:

> Fibre content and food structure can change the time course of carbohydrate delivery. This does not by itself prescribe a longer pre-bolus interval or a fixed subtraction from an individual insulin dose; treatment decisions depend on the person's regimen, glucose trajectory and clinical guidance.

The 1997 review cannot verify a later EFSA regulatory threshold. Remove the `EFSA threshold` attribution and the 17%/31%/saturation numeric sequence until its actual meta-analysis and regulatory source have been checked. Retain the qualitative viscous-fibre mechanism with an explicit review citation.

Replace the unsupported general modulator percentages with:

> Exercise intensity, stress, time of day, nutrient composition and gastrointestinal disease may alter gastric emptying, but the effects are protocol- and endpoint-dependent. Percentage changes in solid-meal retention, liquid emptying half-time and plasma glucose cannot be treated as interchangeable modifiers. In particular, evening-versus-morning meals do not isolate an effect of sleep, and a gastric-emptying study in healthy or type 2 diabetic participants does not provide a calibrated multiplier for all meals in T1D.

Specific unresolved values to remove or explicitly quarantine as unvalidated assumptions: chronic-stress 10–30%; fasting 10–20%; exercise 20–50%; circadian/sleep 35–50%; universal protein ranking; alcohol 15–40%; osmolality 30–50%. This audit has not independently verified their original experiments. In the protein-modulator paragraph, the 55 g whey-preload example resembles the type 2 diabetes protocol described by Marathe, not evidence for a generic healthy/T1D effect. Do not preserve the population label or precise 39-to-87 min values without the actual original source.

### P06 — mesenteric blood flow is not an absorption-rate measurement

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: `Intestinal absorption rate modulators`, especially the first three paragraphs and the four-row quantitative table.

Replace those paragraphs/table with:

> Exercise changes mesenteric perfusion, but the percentage change in blood flow is not a measured percentage change in glucose absorption. In Qamar and Read's study, Doppler-measured superior mesenteric artery flow fell by 43% immediately after 15 min of treadmill exercise, with reductions of 29% and 24% at five and ten minutes. The experiment measured blood flow, not intestinal glucose uptake or systemic glucose appearance. Its abstract therefore supports exercise-related hypoperfusion but not a 40–60% absorption reduction or a post-exercise absorption overshoot. Meal-related hyperaemia likewise demonstrates a vascular response, not a proportional increase in absorption. Gastric delivery, transporter activity, mucosal metabolism and perfusion should be distinguished when interpreting exercise-related glucose appearance (Qamar and Read, 1987; abstract-only appraisal).

Correct reference identity: Qamar MI, Read AE (1987), *Effects of exercise on mesenteric blood flow in man*, Gut 28:583–587; DOI `10.1136/gut.28.5.583`, PMID `3596339`, PMCID `PMC1432887`. Current PMID3678950/PMC1432905 are not this verified identity. The correct identity was checked locally through Europe PMC (HTTP200); original full text has not been independently appraised. Do not retain the SGLT1 `glucose-gradient/product inhibition` explanation: SGLT1 is sodium-coupled, and the cited perfusion experiment does not identify that proposed mechanism.

### P07 — source links with conflicting identities

**STATUS: PARTLY FIXED (2026-09-22).** Unsupported modifiers removed and unresolved identity conflicts explicitly flagged in §5; original-source reconciliation remains OPEN.

Locator: §5 source list versus inline citations. These require correction from an identity-checked record, not copying a different existing ID blindly.

| Citation | Inline identifier | Different identifier in existing source list | Action |
|---|---|---|---|
| Mönnikes 2001 | 11283195 | 11752839 | Verify title/authors before choosing either |
| Thompson 1983 | 6411484 | 6832623 | Verify original before retaining stress multiplier |
| Leiper | 11310927, dated 2001 | 26290294, dated 2015 | Do not merge different papers/years |
| Goo 1987 | 3692672 | 3609660 | Verify original; evening-meal comparison is not a sleep intervention |
| Deloose 2012 | 22407798 | 22450306 | Verify before retaining fasting multiplier |
| Otte 2001 | 11310927 | 11457804 | A gastric-ischaemia study does not establish a glucose-absorption overshoot |

These are detected internal conflicts, not a claim that the second ID is correct. Put unresolved originals on the private wishlist rather than claiming complete verification.

### P08 — Hovorka error and modelling-specific duplication

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: `Modelling-relevant parameter summary`, `Hovorka 2004 model`, modifier tables and modelling caveats.

Remove the `A_G = 0.8 under UK labelling / 1.0 under EU/DK` explanation. Hovorka's original equation 4 and table 1 call A_G carbohydrate bioavailability and cite Livesey; no national labelling explanation is supplied.

Recommended editorial action agreed with root: keep model-specific material in §§28–29 or the implementation footer, not duplicate it in the physiology body. Replace the lengthy model/modifier section in §5 with:

> **Measurement and modelling boundary.** Gastric emptying, intestinal absorption and systemic glucose appearance are related but distinct processes. A fitted meal-response time constant combines several of them and cannot automatically inherit the numerical change measured in a different endpoint. Independent multiplication of meal, exercise, stress and glycaemic-state modifiers is a modelling assumption requiring validation, not a demonstrated physiological law. Model structures and their calibration are discussed in §§28–29.

For the merger's mathematical check only, not additional §5 prose: Hovorka equation 4 is `U_G(t)=D_G A_G t exp(−t/τ)/τ²`; impulse-response peak is exactly `t=τ`. For uniform ingestion over duration T, the post-meal peak is `T/(1−exp(−T/τ))`; τ=40 min and T=15 min gives 47.97 min, not 55–80 min or 2τ. A continuing step has no finite transient peak. The original model fixes τ=40 min and A_G=0.8 (PDF pp. 908–909). Remove any claim that unverified gastric/vascular percentage tables provide validated modifiers for this model.

## 2. §6: fat and protein

### P09 — meal glucose curves do not identify the dominant mechanism

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: opening paragraph, protein mechanism 2, additivity interpretation, T1D-specific points 1/4.

Replace the claim that glucagon is the quantitatively established dominant driver with:

> Dietary amino acids can supply gluconeogenic substrate and stimulate glucagon, while fat can delay nutrient delivery and, in suitable experimental conditions, reduce insulin-stimulated glucose disposal. These mechanisms plausibly contribute to delayed glycaemia, but the cited Smart and Paterson meal studies measured glucose responses rather than simultaneously quantifying glucagon, endogenous glucose production and peripheral disposal. Their results therefore do not establish the relative contribution of these pathways in each meal.

Do not infer measured hormonal mediation from Smart's lower hypoglycaemia odds. Describe the hormonal explanation as a hypothesis. Avoid a fixed 60–90 min peak-action/3–4 h duration for every rapid-acting analogue when drawing a universal meal mismatch.

### P10 — Paterson protocol, early falls and observation window

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: `Incretin effect and modest gastric-emptying delay`, `Time course`, protein time-course table, T1D-specific point 2.

Replace the Paterson mechanistic/time-course account with:

> Paterson and colleagues studied protein-only drinks in a randomised crossover protocol completed by 27 participants with T1D (mean age 21.7±11.7 years). Drinks containing 0–100 g whey protein or 10/20 g glucose were consumed four hours after a standardised, insulin-covered evening meal; no additional insulin bolus was given for the test drink. Participants were not insulin-free. With 75 and 100 g protein, glucose was higher than after water during 180–300 min and continued rising at 300 min. At 240–300 min, differences from water were 1.65 mmol/L (95% CI 0.93–2.36) and 1.72 mmol/L (1.04–2.41), respectively. Early negative differences also occurred at high doses: at 60–120 min they were −1.10 mmol/L after 75 g and −1.22 mmol/L after 100 g. The experiment did not measure the hormonal mechanism of those early falls (Paterson et al., 2016, Methods and Table 2).

Table corrections: `without an additional bolus`, not `no insulin`; `continued rise at 300 min; peak not established`, not `peak 180`; `75/100 g doses showed delayed elevation in this protocol`, not a universal minimum dose. Remove the sentence that early lowering is absent above 50 g and the unmeasured residual-β-cell/paracrine explanation. The glucose endpoint was CGM-derived, not serial plasma glucose.

### P11 — Smart: denominator, portion and endpoint corrections

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: `Additivity of fat and protein effects` and its table rows.

Replace the two paragraphs with:

> In Smart and colleagues' randomised crossover trial, 33 young people with T1D (8–17 years) received four breakfasts with carbohydrate held constant within each participant. Full portions contained 30 g carbohydrate, 4 or 35 g fat, and 5 or 40 g protein; 12 participants weighing ≤45 kg received 75% portions. At 180 min, mean changes from pre-meal glucose were 2.4 mmol/L (95% CI 1.1–3.7) after low-fat/high-protein and 0.5 mmol/L (−0.8 to 1.8) after low-fat/low-protein meals (P=.02). At 210 min, high-fat/low-protein and low-fat/low-protein excursions were 1.8 mmol/L (0.3–3.2) and−0.5 mmol/L (−1.9 to 0.8), respectively (P=.01). The combined high-fat/high-protein meal exceeded all other meals from 180 to 300 min. At 300 min its excursion was 5.4 mmol/L greater than the low-fat/low-protein comparator, not 5.4 mmol/L above the pre-meal baseline (Smart et al., 2013).
>
> At 180 min the combined excursion was 4.2 mmol/L, compared with 1.8 and 2.4 mmol/L in the single high-fat and high-protein conditions. These are within-meal excursions, not three independently reported effects relative to the low-fat/low-protein comparator. The nonsignificant interaction was consistent with additivity in this experiment, but does not establish exact linearity across doses or identify non-overlapping organ mechanisms. Hypoglycaemia was less frequent after high-protein meals (OR 0.16, 95% CI 0.06–0.41); observations after treated hypoglycaemia were excluded from subsequent glucose analysis.

Keep time-to-peak as a **glucose-concentration** endpoint:79 min (95% CI 68–89) versus 143 min (112–174), not a direct appearance-rate measurement. Label the OR as odds, not a risk ratio or a measured glucagon effect.

### P12 — Dao is a review, not the claimed five-protein trial

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: `Protein source: absorption kinetics shape the glucagon response`, iAUC table row and source-list annotation.

Replace with:

> Protein source, digestion and amino-acid composition may influence glycaemic responses, but a quantitative ranking across foods requires a directly identified controlled experiment. Dao and colleagues'2025 article is a review of physiological mechanisms and clinical implications, not the randomised five-protein experiment described here. Its indexed abstract does not contain the chicken/egg/beef/salmon/whey iAUC estimates previously attributed to it. Those estimates are therefore withheld pending identification and appraisal of the original study (Dao et al., 2025; abstract-only appraisal).

Delete the iAUC203–397 mmol·min/L row and change the source annotation to `Review; indexed abstract inspected; full-text and any underlying protein-source comparison remain unresolved.` Verified identity: PMID39951019, DOI10.2337/dci24-0096.

### P13 — tracer production is not a universal conversion factor

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: protein mechanism 1 and Fromentin table row `~17% of carbon`.

Replacement:

> In eight healthy young adults, a four-egg meal supplied 23 g intrinsically labelled protein and 19 g fat after a 12-hour fast. Over 8 h, total endogenous glucose production was 50.4±7.7 g and 3.9±0.7 g originated from dietary amino acids. Thus dietary amino acids supplied about 8% of glucose production under these conditions. The simple ratio 3.9/23 is a mass ratio of glucose to ingested protein, not a measured 17% conversion of protein carbon. The experiment did not study T1D or isolate a universal percentage for insulin dosing (Fromentin et al., 2013, Methods and Results).

Remove the claim that this experiment disproves clinical conversion heuristics by a fixed factor 2–6, and do not turn an 8-hour integral into a demonstrated constant 0.5–1.5 g/h trajectory. Preserve the original quantities with meal/population boundaries.

### P14 — Roden: impaired oxidation did occur

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: fat paragraph sentence `transport/phosphorylation, not impaired oxidation`.

Replace with:

> Roden and colleagues' lipid-infusion clamp experiment supports transport/phosphorylation inhibition as an early limiting step, rather than the original proposal of primary inhibition of pyruvate oxidation. Glucose oxidation nevertheless also decreased, by approximately 40% from the third hour, while glucose uptake and glycogen synthesis fell later. These results were obtained in nine healthy participants exposed to high circulating free fatty acids during a six-hour hyperinsulinaemic clamp, not after a mixed meal in T1D (Roden et al., 1996; indexed abstract and retained abstract page inspected; original PDF not acquired).

Retained `Roden_1996_FFAInsulinResistanceMechanism.html` contains an abstract and a PDF link, not the full methods/results. Do not call it full-text-appraised. PMC and JCI PDF-viewer acquisition attempts returned non-PDF HTML; gap remains.

## 3. §7 and §22: insulin formulation, site and endpoint

### P15 — do not generalise glulisine's bioavailability to all soluble insulins

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: §7 `Absolute SC bioavailability of soluble rapid-acting analogues is ~70%` and table row.

Replace with:

> Absolute subcutaneous bioavailability is formulation- and protocol-specific and must be distinguished from relative exposure between two subcutaneous formulations. The approximately 70% estimate cited here pertains to insulin glulisine; a near-unity faster-aspart/aspart exposure ratio is relative bioavailability and cannot establish either product's absolute fraction absorbed. No single 70% value should be assigned to regular insulin and all soluble analogues from these comparisons.

Primary glulisine/analogue studies were not newly appraised; retain product-specific values only with their actual study or regulatory source. Avoid `both routes share` when both comparators use the same subcutaneous route.

### P16 — regular-insulin site effects, intramuscular half-absorption and molecular direction

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §7 regional paragraph/table and T1D-specific point 5; molecular-signalling sentence `releasing its Rab-GAP activity`.

Replacement regional/route summary:

> In the healthy-subject regular-human-insulin comparison summarised by Gradel and colleagues, thigh and deltoid injection reduced peak concentration by 32% and 42% relative to abdominal injection, with later peak timing but no difference in total exposure. These percentages should not be extended to all rapid-acting analogues. The intramuscular comparison discussed in the same review concerned a shorter time to 50% absorption, not a universal halving of time to peak plasma concentration (Gradel et al., 2018, §§4.2–4.2.1).

Replace `releasing its Rab-GAP activity` with `relieving Rab-GAP-mediated restraint on GLUT4 trafficking`. Cartee's signalling account supports phosphorylation-related relief of inhibition, not activation of the inhibitory GAP. Retain detailed molecular claims only insofar as their cited review supports the direction and tissue/model.

### P17 — distinguish aspart and lispro lipohypertrophy studies

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §7 T1D point 4 and §22 `Lipohypertrophy and absorption variability`.

Replacement:

> Injection into lipohypertrophic tissue can reduce insulin exposure and increase within-person variability, but the reported magnitudes come from different preparations and experiments. Gradel's review reports 25% lower peak concentration and 22% lower four-hour exposure for an insulin-aspart comparison. In Famulla and colleagues' crossover study of 13 people with T1D given 0.15 U/kg lispro, four-hour insulin exposure was 131 versus 165 h·mU/L and peak concentration 61 versus 79 mU/L in lipohypertrophic versus normal tissue. Coefficients of variation were 52% versus 11% for insulin exposure and 55% versus 15% for peak concentration. The five-hour post-meal glucose AUC was 731 versus 513 mg·h/dL, approximately 43% higher;26% describes the smaller proportional contrast in peak glucose, not that AUC. Insulin time-to-peak did not differ. These Famulla results were checked against the indexed abstract; full-text appraisal remains pending (Gradel et al., 2018; Famulla et al., 2016).

Do not imply that Famulla established a universal 25% reduction or delayed insulin Tmax. Its clamp action AUC was 625 versus 775 mg/kg; this is a different endpoint from insulin concentration AUC. Abstract calculations: insulin AUC−20.6%, peak−22.8%, action AUC−19.4%, glucose AUC+42.5%.

### P18 — site guidance and pump wear need bounded claims

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §22 `Inadvertent intramuscular injection` final caveat, `Rotation strategy`, `Pump cannula sites`, opening±50% claim and final `Modern guidance` claims.

Replace the thin-child 4-mm/45° prescription with:

> Needle length, skinfold technique and injection angle jointly determine the risk of intramuscular or intradermal delivery. These are clinical-technique recommendations rather than a consequence that can be inferred from subcutis thickness alone; the appropriate technique should be checked against the original injection guidance and the device specification. The 2016 consensus full text was not independently available in this appraisal.

This deliberately withholds an unverified specific technique; it is not a new injection instruction. The current sentence recommending 45° specifically for a 4-mm needle is not supported by the cited inspected material.

Rotation paragraph: change `developed LH` to `had LH` for the cross-sectional Blanco comparison, and explicitly state that `5% of correct rotators with LH` and `98% of people with LH rotating incorrectly` have different denominators and are not a prospective risk ratio. Avoid claiming that this observational association establishes the optimal fixed region for every modern formulation.

Replace the uncited pump-wear trajectory with:

> Infusion-set wear introduces possible inflammation, leakage, occlusion and tissue changes, but these phenomena do not establish a uniform progressive 10–30% reduction in insulin AUC by day 3. Absorption kinetics and mechanical set failure must be evaluated separately, with the insulin, device and wear protocol specified. The cited material here does not support a single numerical wear multiplier.

Remove uncited±50% day-to-day absorption, universal 6–12-month regression, and `48 h reduces variability` claims unless a directly applicable original is supplied. Do not present 2010/2016 guidance as a comprehensive current-guideline review; this is a targeted historical appraisal.

## 4. §§8–9: exercise protocol and time course

### P19 — post-exercise insulin sensitivity is not a fixed half-life

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §8 opening fixed three-phase account, T1D point 4, and §9 post-exercise sensitivity paragraphs.

Replacement:

> Contraction-mediated glucose uptake and increased insulin-stimulated uptake during recovery are distinguishable processes whose time courses can overlap. Human and animal experiments reviewed by Cartee show enhanced insulin-stimulated uptake lasting into recovery, sometimes to 24–48 h, but do not establish a universal 12–24-hour decay half-life in T1D. Mikines and colleagues' clamp study involved seven untrained men without T1D after 60 min cycling at 150 W; effects were measured immediately and at 48 h, with only three men in the additional five-day experiment. Sparse sampling of this kind cannot identify a general exponential decay constant (Cartee, 2015; Mikines et al., 1988, abstract-only appraisal).

Keep the verified Mikines apparent Km/Vmax observations with population, visit and uncertainty; remove the automatic translation to a fixed T1D sensitivity curve. The association between AS160 phosphorylation and sensitisation in the 2015 review is not definitive proof of every causal step.

### P20 — Pitt is a heterogeneous narrative synthesis, not a pooled 1.5–3-fold effect

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locator: §8 `Subcutaneous insulin absorption accelerates`, its table row and causal statements.

Replacement:

> Exercise can increase circulating exogenous insulin, but the response varies with formulation, injection site and depth, dose and protocol. Pitt and colleagues' narrative review reports heterogeneous findings, including studies with no significant exercise-related increase. Its Table 2 combines labelled-depot disappearance rates and plasma insulin concentrations, not a pooled common endpoint. For example, one healthy-subject experiment reported thigh disappearance rates of 1.12 versus 0.68%/min during exercise and rest, whereas the abdominal comparison was not significant; glargine studies generally found no significant change. These comparisons do not establish a universal 1.5–3-fold acceleration of either appearance or Tmax. Capillary recruitment, local mechanical effects and temperature are proposed contributors, but their independent contributions during exercise remain incompletely resolved (Pitt et al., 2020, pp. 5–7 and Table 2).

Full-text review acquired and read for this check: `docs/references/Pitt_2020_RW_FactorsInfluencingInsulinAbsorptionAroundExercise.pdf`; primary experiments in its table were not independently reappraised. Remove the claim that increased temperature was proven to reduce in-vivo hexamer dissociation time; the review specifically notes the lack of experiments separating temperature from blood-flow effects.

### P21 — Romeres source identity and model-derived decomposition

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §8 table, T1D-specific point 2 and source-list entries for `Romeres...population perspective` and `Boiroux & Lichtenstein`.

Replace those two source entries with one verified record:

> Romeres D, Schiavon M, Basu A, Cobelli C, Basu R, Dalla Man C (2021). Exercise effect on insulin-dependent and insulin-independent glucose utilization in healthy individuals and individuals with type 1 diabetes: a modeling study. *American Journal of Physiology-Endocrinology and Metabolism*, 321(1):E122–E129. DOI10.1152/ajpendo.00084.2021; PMID33998292; PMCIDPMC8321821.

PMID34128839 is an unrelated tuberculosis article by Reichmann and colleagues. PMC8525018 was not verified as the claimed source. PMC8321821 is the Romeres modelling paper, not a Boiroux/Lichtenstein paper. Local Europe PMC metadata/abstract were verified HTTP200; the PMC full-text request returned nonmatching HTML, so complete independent full-text appraisal remains unresolved.

Replace the physiological generalisation with:

> A model fitted to labelled-glucose clamp data from six adults with T1D and six without diabetes separated immediate insulin-independent from delayed insulin-dependent effects during 60 min exercise at 65% maximal oxygen uptake under three glucose/insulin conditions. The model predicted increases in insulin-independent disposal of 66–82% in T1D and 67–97% without diabetes, and insulin-dependent increases of 81–155% and 10–40%, respectively. These are model-dependent decompositions from a small, specific protocol, not separately measured component fluxes or a population-wide T1D multiplier (Romeres et al., 2021; indexed abstract plus online Methods inspected, full-text appraisal pending).

Remove the generic 6–10 mg·kg⁻¹·min⁻¹ table row if no correctly identified source independently establishes it. Model validation against total Rd does not independently validate the latent insulin-dependent/independent split.

### P22 — Yardley did not show more nocturnal hypoglycaemia after aerobic exercise

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: §8 T1D point 4; §9 T1D points 3/6 and `post-exercise disposal is larger`.

Replacement:

> In Yardley and colleagues' small crossover study, 12 physically active people with T1D performed 45 min aerobic exercise, resistance exercise or rest with protocolised insulin adjustment and glucose supplementation when needed. Plasma glucose fell more during aerobic than resistance exercise (9.2 to 5.8 versus 8.4 to 6.8 mmol/L), but mean interstitial glucose was lower after resistance exercise at 4.5–6 h. Nocturnal hypoglycaemic excursions numbered 9 after resistance exercise and 4 after either aerobic exercise or rest; differences were not statistically significant. This supports different acute and delayed concentration profiles, not a proven overnight safety ranking or a directly measured difference in post-exercise glucose-disposal flux (Yardley et al., 2013, Methods and Results).

Change point 6 heading to `Acute and delayed concentration responses differ between exercise modes`. Remove the claim that a specific algorithm necessarily under-predicts late risk: no such algorithm was tested. Note that no-exercise sessions occurred first; only the order of the exercise conditions was randomised, and post-exercise CGM was missing for some sessions.

### P23 — intensity terminology and prandial meta-analysis

**STATUS: FIXED (2026-09-22, root integration).** Intensity wording, pooled estimates and prandial interpretation integrated. Root removed the individual-response range −0.3 to +9.0 mmol/L because it is absent from the verified McClure abstract. Original full-text appraisal remains an acquisition task.

Locator: §9 opening `Supramaximal exercise (>80% VO2 max)` and the McClure paragraph/table.

Change `Supramaximal exercise (>80% VO2 max)` to `High-intensity exercise`;87% VO2 max is not supramaximal. Avoid treating resistance exercise as metabolically equivalent to supramaximal sprinting.

Replacement McClure interpretation:

> McClure and colleagues' meta-analysis included 19 interventions from 15 reports. Overall glucose changed by−1.3 mmol/L (95% CI−2.3 to−0.2), with high heterogeneity (I²=84%). Fasted interventions averaged+1.7 mmol/L (0.4–3.0), whereas postprandial interventions averaged−2.1 mmol/L (−2.8 to−1.4). The contrast is between heterogeneous interventions, not a randomised comparison of meal state under one identical exercise protocol; it does not independently isolate insulin, catecholamines or feeding as the causal mediator. Appraisal here is limited to the indexed abstract (McClure et al., 2023).

### P24 — remaining §9 mechanistic precision

**STATUS: FIXED (2026-09-22, local edits).** Approved bounded prose/endpoint corrections integrated. Full-text and original-source gaps stated below remain open where specified.

Locators: claims of universal 4–12 h hypoglycaemia, fixed+45% sensitivity, lactate correlations `justifying individual algorithms`, and correction-bolus consequences.

Replacement qualification:

> Acute glycaemia and delayed hypoglycaemia depend jointly on insulin exposure, food intake, activity protocol and recovery. Specific glucose responses, glycogen-resynthesis rates and correlations should remain attached to the original population and measurement window. They do not establish a universal post-exercise sensitivity increase, an individual prediction rule, or a general correction-dose instruction.

Preserve source-specific Price/Young/Sigal quantities only with existing abstract/full-text status; those originals were not deeply reappraised in this bounded pass. The recent muscle-fibre glycogen percentages and conversion from glycogen depletion to a universal 24–48-hour risk curve remain unresolved, not validated by citing Cartee or Yardley.

## Integration rule

Apply confirmed identity/endpoint corrections first (P03, P06, P08, P10–P14, P16–P17, P20–P23). For unresolved numerical detail, replace false precision with the bounded physiological statement above and keep the missing-source task visible. Do not silently convert an abstract or a review's reference table into a full appraisal of the original experiment. Preserve the original quantitative values when their actual endpoint and population are identifiable; remove duplicate policy/model prescriptions from pure physiological prose.
