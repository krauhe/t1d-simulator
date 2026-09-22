# Physiological foundations: source appraisal and correction record

Date: 22 September 2026. Status: **targeted corrections integrated locally; source-access gaps remain documented below**.

## Scope and reading boundary

The main reviewer read BG-SCIENCE §§1–2, 10 and 10b in full and revised their transport, compartment, hepatic-flux, exercise-inflammation and relaxation evidence. This is documentation work only. No physiological model, game code or MODEL-IMPLEMENTATION text was modified. Existing implementation anchors `glucose` and `stress-hormones` were confirmed.

The revision follows the science-reviewer workflow and the knowledge-base critical-synthesis approach: identify the measured quantity and population, compare apparently conflicting evidence, and remove unsupported numerical precision rather than replacing it with another unsourced value. It is not a systematic literature update of all glucose physiology.

## Corrections

| ID | Original problem | Resolution and source | Status |
|---|---|---|---|
| PHY-F01 | Rodent pancreatic GLUT2 distribution generalised to human β-cells | Holman's 2020 transporter review explicitly distinguishes mouse from human pancreatic glucose sensing | FIXED 2026-09-22 |
| PHY-F02 | Transporter affinity used to claim saturated neuronal uptake during hypoglycaemia and linear whole-body GLUT4 disposal | Distinguish apparent transport affinity from tissue uptake, substrate delivery and phosphorylation | FIXED 2026-09-22 |
| PHY-F03 | Unsupported 95% intracellular GLUT4, fixed recruitment multipliers and translocation times | Retain verified signalling/translocation mechanism; remove unverified kinetic precision; older primary-source gaps remain | FIXED 2026-09-22 |
| PHY-F04 | Hovorka's accessible-pool V_G called a total distribution volume, and fitted Q2 assigned a literal anatomical composition | Remove duplicate modelling paragraph/rows from physiological §1; correct definitions already exist in model chapters. Original Hovorka pp. 907–909 confirms V_G is accessible-pool volume and Q2 is non-accessible, not an identified anatomical compartment | FIXED 2026-09-22 |
| PHY-F05 | Healthy tracer study extrapolated to an asserted generic 7–10-minute T1D delay and treatment advice | Add original six-person fasting T1D abstract result: median 6.8, range 4.8–9.8 min; identify time-to-detection, IV insulin context and abstract-only access; remove dosing/treatment inference | FIXED claim; FULL TEXT OPEN |
| PHY-F06 | All endogenous insulin asserted absent; peripheral disposal called dominant explanation in every case | Remove universal statements and distinguish appearance, disposal and adequacy of insulin availability | FIXED 2026-09-22 |
| PHY-F07 | 80–100 g hepatic glycogen equated with 6 g/kg liver; unsupported fixed depletion schedule | Remove erroneous conversion and generic schedule; retain direct net-flux measurements with experimental context | FIXED 2026-09-22 |
| PHY-F08 | Calmodulin mislabelled as γ subunit; PDK1 assigned both Akt phosphorylation sites | Replace decorative, inaccurate residue/subunit detail with supported pathway-level account, retaining named enzymes and signalling nodes | FIXED 2026-09-22 |
| PHY-F09 | Canine direct/indirect insulin observations presented as human time constants | Identify conscious-dog protocol; compare with glycogen-depleted rodent experiments and distinguish hepatic glycogen flux from gluconeogenesis | FIXED 2026-09-22 |
| PHY-F10 | Kacerovsky EGP increase stated as 60%; incompatible percentages combined into GNG:GLY ratios | Use original Table 1/Results: 16.5 versus 11.6 µmol/kg/min = approximately 42% higher; show absolute fluxes and separate net-glycogenolysis fractions 20%, 41%, 35% | FIXED 2026-09-22 |
| PHY-F11 | Treatment improvement described without responder selection and overlapping groups | Explain 22 individuals, group observations 10/8/8, four restudied responders, six excluded non-responders and four additional pump users | FIXED 2026-09-22 |
| PHY-F12 | Systemic tracer EGP treated as exclusively hepatic; phosphorylase and net glycogenolysis conflated | Explain renal assumption and glycogen cycling; retain direct subgroup comparison 43 ± 8% versus 20 ± 9% | FIXED 2026-09-22 |
| PHY-F13 | Glucagon loss called universal by five years and conflated with HAAF | Use stimulus-specific account and distinguish persistent glucagon defect from partially reversible adrenergic/symptom adaptation | FIXED 2026-09-22 |
| PHY-F14 | Eccentric-exercise response assigned a universal 24–48-hour resistance phase and 10–30% insulin adjustment | Replace with study-specific maximal/submaximal clamp and OGTT evidence; no T1D dose rule follows | FIXED 2026-09-22 |
| PHY-F15 | Philippe participants misidentified as women; equal-speed uphill/downhill treated as matched metabolic work | Seven healthy men; fixed order; non-damaging protocol; between-condition effect not significant | FIXED 2026-09-22 |
| PHY-F16 | Marathon cytokines used to demonstrate insulin resistance or a universal cytokine-decay constant | Separate observational biomarkers from measured insulin action; distinguish standardised effects from fold changes | FIXED 2026-09-22 |
| PHY-F17 | Local files labelled Emanuelli 2001 and Bekos 2022 contained different articles | Cite actual originals: Ueki, Kondo and Kahn (2004), PMC419873; Alves et al. (2022), PMC8893166. Preserve files and record identity mismatch | FIXED citation; original filenames retained |
| PHY-F18 | Six breaths/minute equated with high-frequency HRV | 0.1 Hz lies in the conventional low-frequency band; report Laborde's RMSSD measure with respiratory context | FIXED 2026-09-22 |
| PHY-F19 | Mindfulness/yoga estimates pooled or generalised across T1D/T2D, repeated reviews and acute breathing | Separate the intervention, population, outcome and follow-up; remove unverified cortisol percentage and acute glucose effect | FIXED 2026-09-22 |
| PHY-F20 | Maurya trial presented without baseline imbalance, attrition and inconsistent reporting | State 92 randomised, 46 completers, imbalanced baseline HbA1c, reported ITT plus completer analyses and internal duration/imputation inconsistencies; do not reproduce implausible insulin units as a valid dose | FIXED 2026-09-22 |

## Sources inspected in this pass

Existing files below are in the ignored `docs/references/` collection. Filenames locate reading copies, not proof of bibliographic identity.

1. **Chadt and Al-Hasani (2020)**, `Chadt_2020_RW_GlucoseTransportersAdiposeLiverMuscle.html`: relevant GLUT1–4, trafficking and metabolism paragraphs inspected. Supports mechanism and approximate affinities, not universal human translocation times.
2. **Holman (2020)**, `Holman_2020_RW_MammalianGlucoseTransporters.xml`: new lawful Europe PMC XML, DOI 10.1007/s00424-020-02411-3, PMID 32591905. Front metadata, GLUT2/3 sections and transport-kinetics discussion inspected. Human/mouse distinction traced to cited McCulloch (2011), which was not independently appraised and is not cited as a newly inspected primary study. SHA-256: `3b2ca036b64fce2242e5746e87769a450ee65a4bbb035009f1216d49c9df9e05`.
3. **Hovorka et al. (2004)**, `Hovorka_2004_NonlinearMPC.pdf`: pp. 907–909, Figure 1, equation 1 and Table 1 inspected. Accessible volume 0.16 L/kg and non-accessible-to-accessible transfer 0.066/min belong to the model description, not an anatomical human tissue-volume claim.
4. **Kacerovsky et al. (2011)**, `Kacerovsky_2011_PostprandialHepaticGlucoseFluxesT1D.html`: Methods, original table/Results and relevant Discussion inspected. This is a small partially longitudinal, responder-selected comparison, not a randomised pump trial. Values are means ± standard deviations. The phosphorylase calculation used smaller sample subsets (7/10 poor-control and 5/8 improved-control observations); it must not be assumed available for everyone.
5. **Edgerton et al. (2017)**, `Edgerton_2017_InsulinDirectHepaticEffect.html`: animal Methods, Results and timing discussion inspected. The 15/60-minute contrast is not an estimated human time constant.
6. **Petersen et al. (2017)**, `Petersen_2017_RW_HepaticGlucoseMetabolism.html`: abstract, introductory definition of net output, portal-clamp limitations and direct/indirect gluconeogenic-control sections inspected. This review provides a useful structural comparator: its treatment of apparently contradictory experiments depends on the flux and physiological context, rather than listing pathways without comparison. Later therapeutic/metformin sections were not reappraised for this revision.
7. **Hatting et al. (2017)**, `Hatting_2017_RW_InsulinRegulationGluconeogenesis.html`: direct/indirect control, PI3K/Akt/FOXO1 and substrate-control paragraphs inspected. General pathway claims retained; residue-level precision not transferred uncritically.
8. **Bisgaard Bengtsen and Møller (2021)**, `Bengtsen_2021_RW_GlucagonResponsesInType1Diabetes_v2.html`: hypoglycaemia, amino-acid, exercise/inflammation and concluding sections inspected. Review-level synthesis; underlying human trials not all independently retrieved in this pass.
9. **Basu et al. (2015)**, DOI 10.1177/1932296814554797, PMID 25305282: complete PubMed abstract and visible figure captions inspected through web access. Six fasting adults, intravenous insulin, median (range) tracer-detection lag 6.8 (4.8–9.8) min. Three ordinary full-text routes failed; wishlist updated. Local PubMed returned a restricted response. No full-text review claimed.

Unchanged supporting citations (e.g. Ishihara, Sun, Sylow, Basu 2013, Cengiz, Rothman and portions of Edgerton 2021) retain their previous evidence/access status unless a specific reading step is recorded above. Every citation appearing in §§1–2 has not thereby become independently reverified. Priority remaining points include initial distribution-volume measurement, basal tracer-lag uncertainty, epithelial debranching/gluconeogenic pathway detail and prolonged-fasting attribution.

## Retrieval and verification

### Additional source appraisal for §§10 and 10b

1. **Asp et al. (1996):** retained PMC HTML contains the abstract, not full machine-readable methods. Seven participants, maximal whole-body clamp effect 15.7%, local leg contrast 11.9% with P = .08. The archive PDF route returned an HTML challenge, not a PDF. Full-text gap added to the wishlist; no full-text appraisal claimed.
2. **Philippe et al. (2016), PMC4885626:** Methods, Results and Discussion inspected. Seven healthy men; nonrandom fixed order; equal speed does not match energetic workload. The postexercise OGTT estimates are not a multi-day T1D effect.
3. **de Sousa et al. (2021), PMC8554198:** participant flow, timing and biomarker results inspected. Fifty-seven male finishers, with outcome-specific denominators; no insulin-sensitivity endpoint.
4. **Ueki, Kondo and Kahn (2004), PMC419873:** actual title/authors and SOCS experiments inspected. Local filename incorrectly attributed this to Emanuelli 2001. Cellular/mouse signalling experiments do not establish a post-marathon T1D dose response.
5. **Alves et al. (2022), PMC8893166:** Methods, pooled outcomes and meta-regression inspected. Seventy-six included reports, 29 in quantitative synthesis; cytokine-category meta-regression does not support a universal exponential clearance time. Local filename incorrectly attributed the paper to Bekos.
6. **Pascoe et al. (2017):** original abstract only. Forty-two randomised trials; no inspected full text supports the previously asserted 15–25% cortisol decrement.
7. **Laborde et al. (2021), PMC8656666:** new lawful XML; metadata, Methods, Results and Discussion read. Fifty-nine healthy participants, randomised order of breathing durations; RMSSD changes during breathing differ from adjusted postexercise comparisons. Diabetes was excluded. SHA-256 `30d1d6ab2700ab08a141eb32d7430db59aa8a3e1a1f3527185f1c7eaa6ee8a26`.
8. **Hamasaki (2023):** retained review's methods, five-review comparison, overlap and follow-up interpretation inspected. Predominantly T2D evidence; review estimates cannot be counted as five independent replications.
9. **Innes and Selfe (2016):** original review Methods and Results inspected: 25 studies, 2,170 participants, 12 randomised and 13 nonrandomised; ten without between-group comparisons. A cited pooled estimate belongs to another review, not this study's own meta-analysis.
10. **Maurya et al. (2025), PMC12168419:** participant flow, original tables, analysis description and limitations inspected. Confirmed first author Sonu Maurya and coauthors, rather than the inherited attribution; documented inconsistent units, imputation counts and duration descriptions.

This set is a targeted reappraisal of the chapter's claims, not a comprehensive review of exercise immunology or mind–body interventions. Source discrepancies are reported rather than resolved by inventing missing protocol details.

The acquisition script and append-preserving technical attempt log are in [the matching directory](2026-09-22_physiology-foundations/acquisition.json). Source-specific web opens: Holman PMC, Kacerovsky PubMed and Basu 2015 PubMed on 22 September 2026. These are targeted identity/retrieval operations, not a new database search.

The source version changed from `2026-09-22-v1` to `2026-09-22-v2` for this multi-section revision batch. Final knowledge-base regeneration and checks are recorded in the whole-base audit. The §1 implementation footer was reduced to its canonical documentation link to remove an incorrect description of Q2 and insulin-action states.

The dead Yale Hovorka PDF route in §§28–29 was replaced by its stable DOI. The DOI and PubMed destinations were tested locally on 22 September: the publisher returned a browser challenge and PubMed an interstitial, while the Europe PMC record confirmed PMID 15382830, title, authors and DOI. Reference entries disclose the access limit; the retained original PDF remains the appraised source.

Two read-only implementation observations remain **OPEN for a separate model-documentation task**: 0.0097 mmol/kg/min equals 9.7 µmol/kg/min, not 14; a fixed brain-glycogen reserve is not an empirical time-to-injury rule. Neither observation was implemented in model documentation or code during this literature revision.
