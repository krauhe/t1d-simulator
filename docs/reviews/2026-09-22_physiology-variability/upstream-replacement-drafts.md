# Upstream replacement drafts: contextual variability and safety

Date: 2026-09-22. Status: **all twelve substantive correction groups integrated locally on 2026-09-22; BG-SCIENCE released to root after verification**. Scope: BG-SCIENCE §§11–27 excluding §22. These blocks correct specific claims; they do not certify the remaining text or authorize model changes. Integration changed only §§11–15, §§17–19 and §§23–27. Other section hashes and the v2 version marker were preserved. See `integration-verification.json` and the audit status summary for the root handoff and residual editorial follow-ups. Match headings and quoted anchors, not line numbers, because other agents are editing earlier sections.

## 1. §11.1, §11.4, §11.5 and §11.6: counterregulatory thresholds

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** healthy/T1D adrenaline and cortisol thresholds are reversed; the GH comparison and a universal symptom hierarchy are also incorrect. Source: Verhulst et al. 2022, full article main text read, PDF physical pp. 2–10, Results, Figs. 1–2 and Discussion. Human stepped hyperinsulinaemic hypoglycaemic clamps; 63 articles. Estimates are medians and IQRs, not means or individual action thresholds. The paper itself reports 559 T1D participants in its abstract versus 599 in Results/Table 1; do not propagate an unqualified denominator.

**Replace §11.1's numerical threshold synthesis and §11.6's threshold columns with:**

> Experimental thresholds depend on the population, antecedent hypoglycaemia, awareness status, glucose-sampling method and clamp protocol. In the systematic review by Verhulst et al. (2022), counterregulatory hormone and symptom responses generally appeared at lower glucose concentrations in T1D than in people without diabetes. The values below are pooled median thresholds with interquartile ranges from stepped hypoglycaemic clamps. They are not universal biological switches or clinical treatment thresholds.
>
> | Response | Without diabetes, mmol/L | T1D, mmol/L |
> |---|---:|---:|
> | Adrenaline | 3.8 (3.2–4.2) | 3.4 (2.8–3.9) |
> | Noradrenaline | 3.2 (3.2–3.7) | 3.0 (2.8–3.1) |
> | Cortisol | 3.5 (3.2–4.2) | 2.8 (2.8–3.4) |
> | Growth hormone | 3.8 (3.3–3.8) | 3.2 (3.0–3.3) |
>
> The review found no significant separation between autonomic and neuroglycopenic symptom thresholds within either population. Symptom reporting and objectively measured cognitive impairment are distinct outcomes. A T1D glucagon threshold could not be reliably estimated because responses were frequently absent or insufficiently reported. These data therefore do not supply a universal duration-of-diabetes rule for loss of glucagon responses.

**Replace §11.4's sentence beginning “pooled adrenaline threshold rises…” with:**

> The pooled median adrenaline threshold was lower in T1D than in participants without diabetes (3.4 versus 3.8 mmol/L). Response amplitude and the glucose threshold for initiating a response are separate properties: attenuated counterregulation may involve either or both. Antecedent hypoglycaemia and impaired awareness can shift responses to still lower glucose levels.

**Replace §11.5's opening threshold sentence with:**

> Cortisol and GH thresholds should not be inferred from the speed of their downstream actions. Verhulst et al. reported median thresholds of 3.5 and 3.8 mmol/L, respectively, without diabetes, and 2.8 and 3.2 mmol/L in T1D. Their slower metabolic actions distinguish them from the rapid glucagon and sympathoadrenal contributions; a low numerical threshold in one population does not establish delayed secretion in every individual.

Do not retain the unverified half-lives, peak times and exact effect-onset ranges merely because the threshold columns have been corrected. McCrimmon and Sherwin 2010, pp. 2333–2335, explicitly distinguish human physiology from rodent mechanistic evidence. Its correct DOI is 10.2337/db10-0103 (not db09-0942).

## 2. §§12–13: dawn physiology and post-hypoglycaemic hyperglycaemia

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** §13 overstates definitive disconfirmation and invents a <5–10% frequency estimate; CGM trajectories are treated as uniquely diagnostic of mechanisms. The table's automatic treatment choices exceed those data. Porcellati 2013 main text/Fig. 1 read; González-Vidal 2025 main text, methods, results, Tables 1–3 and limitations read (PDF pp. 1–10).

**Replace §13's population-frequency paragraph and “CGM allows them to be separated cleanly” interpretation with:**

> Morning hyperglycaemia cannot establish whether nocturnal hypoglycaemia occurred or whether a subsequent rise was caused by endogenous counterregulatory hormones. Continuous monitoring can document a low-to-high sequence, but insulin delivery, carbohydrate treatment, meals, activity and sensor artifacts remain alternative or interacting explanations.
>
> González-Vidal et al. (2025) retrospectively examined 14-day sensor records from 755 adults with T1D at one Spanish centre. At least one nocturnal glucose value below 70 mg/dL followed by a value above 180 mg/dL before 06:00 occurred in 248 participants (32.8%). The sequence occurred on 405 of 10,268 observed nights (3.9%), or 20.2% of the 2,009 nights containing hypoglycaemia. These denominators answer different questions. No minimum duration was required, and carbohydrate intake and hormonal responses were not available to distinguish treatment-related hyperglycaemia from endogenous rebound. The study establishes that post-hypoglycaemic nocturnal hyperglycaemia can occur; it neither establishes its hormonal mechanism nor makes it the default explanation of fasting hyperglycaemia.
>
> Dawn-related changes in insulin action and waning insulin delivery should likewise remain separate mechanisms. The dawn response can occur without insulin waning. A glucose trajectory narrows the possible explanations but does not, by itself, identify a treatment adjustment.

**Additional §12 correction:** Porcellati's Fig. 1 illustrates three T1D groups of six; the glargine observation is explicitly unpublished and shows no dawn rise in that illustration. Do not describe the figure as matched published cohorts all showing a 15–25 mg/dL rise. Remove the unsupported universal 40–60% night-to-night CV and the fixed number of monitoring nights unless an original study supplying those estimates is appraised. Standardize insulin-to-carbohydrate ratio units: units/g and g/unit are reciprocals, so “higher ICR” has opposite meanings under the two definitions.

## 3. §14: disposition index and diurnal interpretation

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** disposition index is incorrectly described as secretion divided by sensitivity; the text claims opposing rhythms where the cited study found higher morning β-cell responsiveness and sensitivity. Source: Saad et al. 2012, XML Methods (“Models”), Results and Figs. 3–5 inspected; **20 healthy participants**, not T1D. Other §14 original studies were not reappraised.

**Replacement:**

> In the oral minimal-model analysis used by Saad et al. (2012), the disposition index is the product of insulin sensitivity and an index of β-cell responsiveness. Among 20 healthy participants studied with identical meals, both insulin sensitivity and β-cell responsiveness were generally higher at breakfast than later meals; individual patterns varied. This result should not be described as two opposing rhythms or transferred as a fixed diurnal insulin requirement in T1D. Prior meals and fasting duration can modify the observed meal response, so a breakfast–dinner contrast does not isolate circadian phase unless these influences are controlled.

Delete the unsupported direction claim that ordinary daytime feeding necessarily exaggerates circadian deterioration while matched preloads necessarily underestimate it. The paragraph's own account of a beneficial second-meal effect implies the opposite under that simplified comparison; a protocol-specific result is required.

## 4. §15: menstrual-cycle effect size and prevalence

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** the systematic review is misrepresented as uniformly very small studies and as establishing numerical prevalence/dose multipliers. Source: Gamarra and Trimboli 2023, full body sections 1–5 read, including search methods and quality appraisal; study-level appendices not individually reappraised.

**Replacement for quantitative prevalence/effect-size and universal dosing prose:**

> Gamarra and Trimboli (2023) included 14 studies with individual sample sizes of 4–124 participants. Definitions of menstrual phase, glucose outcomes and insulin sensitivity varied, risk of bias was generally high, and the authors did not perform a quantitative meta-analysis. Several studies found higher glucose exposure or reduced insulin sensitivity in the luteal phase, whereas others found no significant phase difference. The review does not establish a population-wide prevalence, a common percentage change in insulin requirement, or a fixed rate of change at menstruation. Fasting and postprandial effects may differ, and individual patterns require observation across cycles. A universal phase-based dose template cannot be inferred from this evidence.

Claims that hormonal contraception is a preferred solution, or that a dosing template has been shown ineffective, require directly appraised intervention evidence. They do not follow from this review's uncertainty about oral contraceptives or intrapersonal variability.

## 5. §17: gastrointestinal illness, insulin need and ketosis

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Source:** Phelan et al. 2022, pediatric consensus, sections 2–4, pp. 912–916; Glaser et al. 2022, sections 2–4, pp. 835–838. This is pediatric guidance, not a randomized estimate of an illness multiplier.

**Replacement:**

> Febrile illness often increases insulin requirements through counterregulatory responses and impaired insulin action. Gastrointestinal illness may instead lower glucose through reduced intake, delayed gastric emptying or impaired absorption. Insulin requirements can therefore increase or decrease; continued need for insulin is not evidence that basal requirements invariably rise. The ISPAD sick-day guidance emphasizes ongoing insulin delivery together with glucose, ketone and hydration assessment. Ketonaemia in the presence of low or normal glucose may reflect reduced intake and insulin deficiency, but ketone concentration alone does not diagnose euglycaemic DKA: metabolic acidosis and the clinical context must also be established.

Replace the unqualified instruction to give carbohydrate whenever ketones exceed 1.5 mmol/L with a guideline-linked explanation that fluid carbohydrate content and insulin adjustments depend on glucose, intake, ketones and clinical assessment. Keep personal treatment regimens out of the physiological summary.

## 6. §18: direct T1D sleep experiment

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Source:** Donga et al. 2010, Methods, Results, Table 1 and Discussion read from retained XML. Randomized crossover; nine enrolled, seven analyzed; adults on insulin pumps, BMI <26 kg/m², no recognized autonomic neuropathy; one exclusion for nocturnal hypoglycaemia/hyperglycaemia and one for sleep apnea.

**Replacement:**

> Donga et al. (2010) obtained paired clamp data in seven adults with T1D after normal sleep and sleep restricted to four hours. Glucose disposal during the clamp fell from 25.5 ± 2.6 to 22.0 ± 2.1 μmol·kg lean body mass⁻¹·min⁻¹ (approximately 14%; P=0.04). Glucose infusion required to maintain euglycaemia fell from 19.0 ± 2.9 to 14.9 ± 2.1 in the same units (approximately 21%; P=0.04). Values are means ± SEM. Basal endogenous glucose production and its suppression during the clamp did not differ significantly. The experiment supports an acute reduction in peripheral insulin action under its conditions; it does not establish a proportional change in daily insulin dose or an effect per hour of lost sleep.

Delete the synthetic “5–15% per hour” dose–response. Chronic restriction, circadian misalignment and slow-wave suppression are different interventions and cannot be pooled informally into that slope. Remove advice to widen sensor alarm bands for sleep unless supported by appropriately qualified clinical guidance.

## 7. §19: alcohol, gluconeogenesis and total production

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** the Siler experiment has the wrong identity, route, protocol and result. Primary source access is **abstract only**, locally identity-verified as PMID 9815011, DOI 10.1152/ajpendo.1998.275.5.E897. Original full text not obtained. Steiner 2015 sections 2.1–2.3, 5–6 read as a mechanistic review, with human/animal evidence kept separate.

**Replacement for the Siler numerical paragraph:**

> Siler et al. (1998) studied 48 g oral alcohol in overnight-fasted normal men, not an intravenous ethanol clamp in T1D. The indexed abstract reports a 45% lower gluconeogenic flux relative to placebo and a 12% reduction in hepatic glucose output within the alcohol condition, from 2.03 ± 0.21 to 1.79 ± 0.21 mg/kg/min, without a change in plasma glucose. These abstract-level data support inhibition of gluconeogenesis with compensating changes elsewhere in glucose flux; they do not support a 50% suppression of total endogenous glucose production or a near-complete blockade in T1D. The original full text is required for detailed protocol appraisal.

**Replacement for fixed suppression/delay mechanisms:**

> Ethanol oxidation raises the NADH/NAD⁺ ratio and can inhibit gluconeogenesis, but its effect depends on precursor, nutritional state and experimental conditions. Gluconeogenesis, glycogenolysis, whole-body glucose production and glucose disposal are distinct endpoints. Steiner et al. (2015) summarize human studies in which glucose production is unchanged or decreases together with disposal, and animal or isolated-tissue experiments showing substrate-dependent inhibition. These findings cannot justify a universal percentage suppression, an obligatory glycogen-depletion time overnight, or a fixed 6–12-hour glycaemic response in insulin-treated T1D.

Do not retain the 19–25% attributable fraction, “dominant risk factor” for dead-in-bed, 30–60% severe-hypoglycaemia frequency, or hormone/symptom percentage suppressions without original sources. A low laboratory glucose value alone does not define a severe episode requiring external assistance. Those claims remain unresolved, not disproved by this bounded review.

## 8. §23: DKA diagnosis, treatment units and resolution

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Sources:** Glaser et al. 2022 pediatric guideline pp. 835–838; Umpierrez et al. 2024 adult consensus XML sections 2–3, Potassium, Criteria for resolution, and SGLT2 risk paragraphs. These are population-specific recommendations, not simulation thresholds.

**Replacement for diagnostic framing:**

> DKA requires ketosis and metabolic acidosis in the relevant diabetes context. The 2024 adult consensus requires all three components: glucose ≥11.1 mmol/L or a prior history of diabetes irrespective of presenting glucose; significant ketosis; and metabolic acidosis. The ketone criterion is β-hydroxybutyrate ≥3.0 mmol/L or, when blood measurement is unavailable, urine ketones ≥2+. Acidosis is venous pH <7.3 and/or bicarbonate <18 mmol/L. The 2022 pediatric ISPAD guideline similarly uses glucose >11 mmol/L, venous pH <7.3 or bicarbonate <18 mmol/L, and ketonaemia or moderate/large ketonuria. Markedly elevated glucose is not necessary in euglycaemic presentations. Ketonaemia without acidosis should not be labeled DKA solely because insulin deficiency is possible.

**Replace the adult potassium statement “20–40 mEq/h” and mixed adult/pediatric recipe with:**

> Potassium replacement is a monitored component of hospital DKA treatment, not a fixed hourly dose independent of fluid delivery and renal function. The 2024 adult consensus states that 20–30 mmol potassium **per litre of intravenous fluid** is sufficient for most patients requiring replacement. In adults presenting with potassium <3.5 mmol/L, it recommends beginning replacement at 10 mmol/h and delaying insulin until potassium exceeds 3.5 mmol/L. These conditional adult recommendations must not be combined with pediatric thresholds or used without serial electrolyte monitoring. The pediatric ISPAD protocol must be consulted separately.

**Replace the urinary-ketone and anion-gap resolution claims with:**

> Urine ketone tests primarily detect acetoacetate rather than β-hydroxybutyrate. They can underestimate ketonaemia early and overestimate persistent ketosis during recovery as β-hydroxybutyrate is converted to acetoacetate. The 2024 adult consensus defines DKA resolution by plasma ketones <0.6 mmol/L together with venous pH ≥7.3 or bicarbonate ≥18 mmol/L; glucose should ideally also be <11.1 mmol/L. It advises against using the anion gap or urine ketones as resolution criteria because hyperchloraemic acidosis and ketone interconversion can mislead interpretation.

**SGLT2 population correction:** the adult consensus describes DKA in approximately 4% of SGLT2-treated people with T1D, whereas its incidence range of 0.6–4.9 events/1,000 patient-years concerns T2D. Do not label an approximately 2/1,000 patient-year estimate as T1D risk. These are different measures and populations; the 4% figure does not supply a person-time rate. Regulatory authorization also requires jurisdiction-specific checking.

## 9. §23 dietary substrate table: avoid fabricated flux fractions

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** the table assigning hepatic acetyl-CoA/ketogenic input fractions to fasting, mixed diet and T1D ketogenic diet is not supported by a measured T1D substrate-flux dataset; the text itself acknowledges this. Donnelly's fatty-acid contribution to hepatic triglyceride in NAFLD is not a measurement of ketogenic acetyl-CoA flux in T1D. Donnelly and St-Pierre originals were not reappraised here.

**Replacement for the percentage table and numerical extrapolation:**

> Adipose-derived nonesterified fatty acids and dietary lipid can both contribute substrate to hepatic fatty-acid oxidation. Dietary lipid reaches the liver through remnant uptake and through fatty-acid spillover after lipoprotein-lipase-mediated hydrolysis; medium-chain fatty acids have different transport kinetics. The relative contribution of these routes depends on feeding, insulin availability and lipid handling. Percentages of hepatic triglyceride derived from dietary or circulating fatty acids are not interchangeable with percentages of acetyl-CoA entering ketogenesis. In the absence of direct tracer measurements in the specified T1D state, no numerical source partition is assigned here.

This correction preserves the routes without inventing calibrated fractions. Detailed biochemical claims (including CPT1 as an exclusive rate-limiting step and the AMPK wording) remain flagged for a ketogenesis-specific source review, not certified by the clinical guidelines.

## 10. §24: units, glycogen and overdose cohort

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Arithmetic correction:** at 70 kg, 2 mg/kg/min is 140 mg/min = 0.14 g/min = 8.4 g/h. A three- to fivefold flux is 420–700 mg/min, not 20–40 mg/min. This dimensional calculation is not a prediction of actual counterregulatory output or glycogen exhaustion.

**Replacement for “2 g/min” and “fully depleted in 50–100 min”:**

> Counterregulatory glucose production has finite capacity and depends on insulin exposure, hormone responses, hepatic glycogen and gluconeogenic substrate supply. At a reference basal glucose turnover of 2 mg/kg/min, a 70-kg adult has a turnover of 0.14 g/min (8.4 g/h). This total-body flux cannot be equated with net hepatic glycogen loss: gluconeogenesis, renal production and ongoing substrate use also contribute. A fixed glycogen depletion time cannot be calculated by dividing an assumed liver glycogen store by total glucose turnover.

**Replacement for Mégarbane cohort and blanket zero-order claim:**

> Mégarbane et al. (2007) prospectively studied 25 ICU patients with intentional insulin overdose, of whom 13 had diabetes. Four had an unfavorable outcome, including two deaths; the four unfavorable outcomes represent 16%, not a 16% mortality rate. The kinetic substudy comprised six patients: two with T1D, one with T2D and three without diabetes. Their terminal insulin decline was described by first-order kinetics, with a median terminal half-life of 3.8 hours (interquartile range 1.5–4.6). Glucose infusion requirements varied substantially, and the small, heterogeneous sample does not establish a general kinetic switch above a particular injected dose or a universally safe concentration. Findings from overdose treatment cannot determine ordinary insulin dosing relationships.

Source locator: retained PDF pp. 1–3 and 7–9, Table 2 referenced by Results; pp. 4–6 were not fully reread in this pass. Remove unsourced surgical-excision thresholds and do not derive emergency treatment recommendations from isolated cases.

## 11. §§25–26: endpoints, glucotoxicity and diabetes population

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Replacement for direct sensitivity-to-dose conversion claims:**

> Insulin sensitivity is operationally defined by the measurement protocol. Glucose disposal at one insulin concentration, half-maximal concentration, maximal response and total daily insulin requirement are not interchangeable. An observed change in one does not uniquely identify a shift in another. Increased glucose uptake during contraction also does not, by itself, demonstrate a leftward shift in an insulin concentration–response curve. Changes in usual insulin dose additionally reflect glucose targets, intake, delivery, absorption and endogenous glucose production.

**Garvey correction:** locally verified indexed abstract, PMID 3882489, DOI 10.2337/diab.34.3.222. Fourteen **T2D**, not T1D, participants; three weeks of CSII; original full text not acquired. Replace any attribution to insulin-treated T1D with:

> Garvey et al. (1985) studied 14 participants with type 2 diabetes before and after three weeks of continuous subcutaneous insulin infusion. Their findings concern this population and include changes in endogenous insulin secretion as well as insulin action. They cannot quantify reversible glucotoxicity in T1D or establish a universal daily insulin-dose multiplier. The experimental effects of hyperglycaemia in T1D should be evaluated separately using T1D-specific protocols.

Retain Rossetti's animal population explicitly if discussing the phlorizin experiment. Do not transform cellular or animal pathway timing into human clinical recovery constants. The Vuorinen-Markkola primary full text and the inherited 30–50% daily-dose multiplier remain unresolved; no new multiplier is proposed.

## 12. §27: CGM compartments, units and HbA1c mapping

**STATUS: ✅ FIKSET (2026-09-22; local BG-SCIENCE integration, no commit).** The block below preserves the reviewed rationale and approved correction; residual source gaps remain as stated.

**Finding:** Basu 2013 is misidentified and assigned the wrong population and method; glucose rates have mg/dL versus mmol/L errors; manufacturer properties and algorithm descriptions are overgeneralized. Basu 2015 was verified only from original indexed abstract; root has appraised Basu 2013 separately. Battelino 2019 full-text relevant sections and Table 5 read. Beck 2019 original abstract locally verified; full-text retrieval failed, including correct PMC6610606.

**Replacement for “Interstitial versus blood glucose”, the lag table and universal signal-processing constants:**

> Continuous glucose monitors estimate glucose from a local interstitial signal. Physiological transport, sensor response and digital processing contribute separately to differences between displayed and blood glucose values. Their combined effect depends on the device, glucose trajectory and experimental method; a single physiological transport estimate cannot be assigned to all displayed CGM readings.
>
> Basu et al. (2013) studied tracer transport in healthy participants, not a T1D “clamp-and-decay” experiment. A separate T1D study by Basu et al. (2015) used intravenous glucose tracers and abdominal subcutaneous microdialysis in six overnight-fasted adults maintained on intravenous insulin. Its abstract reports a median tracer appearance time of 6.8 minutes, range 4.8–9.8. Time to tracer detection is not a sensor time constant, a dynamic cross-correlation lag or a validated delay during exercise or meals. Detailed appraisal awaits the original full text.
>
> During changing glucose concentrations, interstitial and displayed values may diverge from contemporaneous blood glucose. Rate-of-change units must remain explicit: 2 mg/dL/min is approximately 0.11 mmol/L/min, not 2 mmol/L/min; 3 mg/dL/min is approximately 0.17 mmol/L/min. No universal physiological bound of 5 mmol/L/min or fixed 15–25-minute lag is inferred here. Device-specific validation is required to interpret direction, magnitude and duration of discrepancies.

Delete the example describing 40 mg/dL (2.2 mmol/L) as “acceptable”; it is well below standard hypoglycaemia reporting thresholds. Do not repair it by guessing that the author intended a different value. Device-specific emergency instructions require a validated source.

**Replacement for TIR–HbA1c mapping:**

> Time in range and HbA1c are related but noninterchangeable outcomes. Battelino et al. (2019), Table 5, distinguish a T1D dataset of 545 adults from a mixed-diabetes analysis: their tabulated cross-sectional slopes are approximately 0.5 and 0.8 HbA1c percentage points per 10 percentage points of TIR, respectively. The original Beck et al. (2019) abstract reports an average longitudinal decrease of 0.6 percentage points with a 10-percentage-point TIR increase, with wide individual variation. These different populations and contrasts should not be merged into a universal conversion table. A given TIR does not uniquely predict an individual's HbA1c.

Correct Beck's identity to **The Relationships Between Time in Range, Hyperglycemia Metrics, and HbA1c**, *Journal of Diabetes Science and Technology* 13(4):614–626, DOI 10.1177/1932296818822496, PMID 30636519, PMCID PMC6610606. The inherited title/journal/PMID/PMC combination is incorrect.

The “current devices” table should be removed or separately rebuilt from current, jurisdiction-specific manufacturer documentation and pivotal studies. This review has **not** certified its lifetimes, calibration frequencies, MARD comparisons, interference claims, universal Kalman filtering, fixed warm-up periods, or a predictable positive dehydration bias. In particular, the section contradicts its own electrochemical universal by also describing an optical sensor. Corrections to clinical outcomes do not validate those product claims.
