# Meals, insulin and activity: source and editorial audit

Date: 2026-09-22. Reviewer scope: KB `knowledge/physiology/meals-insulin-exercise.qmd`; simulator `docs/BG-SCIENCE.md` §§5–9 and §22. Targeted correction of an inherited synthesis, not a systematic search update. Historical evidence coverage is retained.

**Final root integration, 22 September 2026:** P01 and P23 are now fixed in canonical prose. Kwiatek replaces the incorrect Marciani attribution, the disputed calorie coefficient is withheld, and the unsupported individual HIIT range is removed. The residual universal protein-threshold table row and calibration claim were also removed. P07 source-identity reconciliation remains open; the individual study appraisal boundaries below are unchanged.

## 1. Outcome and authority

The KB chapter was revised locally. Following root approval of P01–P24, six upstream sections were integrated with `apply_patch` and released to root. No model code, MODEL-IMPLEMENTATION, version marker, build configuration, shared wishlist, commit or push was changed by this task. Root owns subsequent integration and publication checks.

The user-requested science-reviewer and KB scientific-review skills informed the work: compare evidence by endpoint and mechanism; verify important claims against originals where accessible; preserve unavailable full texts as gaps. Root's narrower authority overrode the skill defaults for version changes and the shared wishlist. No new agents were spawned.

Status is attached to every P-item in `upstream-replacement-drafts.md`. P07 remains partly open for source identity. Root's final read also found a residual P01 paragraph: `kwiatek-followup.md` supplies the correction and P01 is marked partly fixed until root applies it. P23 is partly fixed pending removal of an individual HIIT-response range not present in the verified abstract; root was notified. All other FIXED labels mean the approved bounded correction was integrated, not that every original source in the section received a new full appraisal.

## 2. Explicit text coverage

| Coverage ID | Assigned text | Inspection | Evidence-appraisal boundary |
|---|---|---|---|
| PHY-KB | Entire meals-insulin-exercise.qmd, including references, matrix and game-design section | Read in full before revision and reread after revision | Principal meal/exercise comparisons checked as below; inherited background references were not all fully reappraised |
| PHY-05 | BG-SCIENCE §5, Carbohydrates, all prose/tables/references/footer | Read in full | Targeted gastric, incretin, absorption-endpoint and mathematical claims; much transporter, gastroparesis and variability literature remains inherited |
| PHY-06 | §6, Fat and protein, all content | Read in full | Smart, Paterson, Fromentin and Roden principal claims checked; other glucagon/protein-source claims remain bounded by source access |
| PHY-07 | §7, Insulin pharmacology, all content | Read in full | Formulation/site/route/endpoints appraised via Gradel and Famulla abstract; not a fresh appraisal of every insulin registration trial |
| PHY-08 | §8, Aerobic exercise, all content | Read in full | Cartee, Mikines, Pitt, Romeres, Yardley; inherited Sylow molecular and blood-flow ranges not independently rederived |
| PHY-09 | §9, Resistance/interval exercise, all content | Read in full | McClure and Yardley interpretation; fixed recovery parameters removed; Young, Price, Sigal and other originals not newly fully appraised |
| PHY-22 | §22, Injection site/technique/lipohypertrophy, all content | Read in full | Famulla endpoints; formulation-specific extrapolation; unsupported technique/wear/regression precision removed; not a current guideline update |

MODEL-IMPLEMENTATION was read only to verify relevant existing footer targets: `#food`, `#insulin`, `#activity` and `#variability`. Reading every assigned paragraph is not equivalent to independently verifying each inherited citation.

## 3. Source–claim ledger

Access levels: **O** = relevant original full-text Methods/Results inspected; **R** = relevant full-text review sections inspected, underlying originals not thereby verified; **A** = indexed abstract/metadata; **P** = partial original text exposed online, complete independent full-text acquisition unresolved. Each entry names the endpoint actually supported.

| Source and identity | Level; locator | Claim and appraisal decision | Action |
|---|---|---|---|
| Smart et al. 2013; PMID 24170749; DOI 10.2337/dc13-1195 | O; Methods, Results, figures | n = 33, age 8–17; 12 received 75% portions. CGM excursions differ from between-meal contrasts. At 300 min, 5.4 mmol/L is combined meal minus low-fat/low-protein comparator. No significant interaction supports compatibility with additivity, not exact linearity. Post-treated-hypoglycaemia observations were excluded | P09/P11, KB meal comparison rewritten; CIs and portion denominator retained |
| Paterson et al. 2016; PMID 26499756; DOI 10.1111/dme.13011 | O; Methods, Results/Table 2 | n = 27 completers, mean age 21.7; whey four hours after insulin-covered dinner, without additional bolus. 75 g versus water: +1.65 mmol/L (95% CI 0.93–2.36) during 240–300 min. Still rising at 300 min, not a measured 180-min peak; glucagon/fluxes unmeasured | P09/P10, KB protocol and mechanism boundaries |
| Fromentin et al. 2013; PMID 23274906 | O; Methods, Results, Discussion | n = 8 healthy adults; four eggs, 23 g protein plus 19 g fat after 12-h fast. Over 8 h, 3.9 ± 0.7 g dietary-amino-acid-derived glucose versus 50.4 ± 7.7 g total glucose production (SD). Approximately 8% of production; 3.9/23 is not percent protein carbon | P13; preserve integrated quantities, remove universal conversion/constant-rate inference |
| Roden et al. 1996; PMID 8675698; DOI 10.1172/JCI118742 | A; retained page is abstract, not full text | n = 9 healthy participants in six-hour lipid-infusion clamp. Early transport/phosphorylation limitation does not mean oxidation was unaffected: approximately 40% lower oxidation from third hour | P14; separate mechanism timing and T1D-meal extrapolation |
| Marathe et al. 2013; PMID 23613599; PMCID PMC3631884 | R; gastric-emptying, glycaemia and incretin sections | Broad gastric delivery range is not fixed per-meal flux. GLP-1 slows emptying; do not attribute the same effect to GIP. Delayed emptying does not establish irreversible vagal neuropathy. Distinguish acute glucose perturbation from between-cohort phenotype | P01/P03/P04/P05; KB endpoint framing |
| Qamar and Read 1987; PMID 3596339; PMCID PMC1432887; DOI 10.1136/gut.28.5.583 | A; indexed abstract | Doppler superior mesenteric artery flow in 16 participants after 15-min treadmill exercise fell 43% immediately, 29% at 5 min, 24% at 10 min. Not measured glucose absorption or post-exercise overshoot | P06; corrected erroneous identifiers and removed proportional absorption inference |
| Hovorka et al. 2004 | O, limited to equation 4/Table 1, PDF pp. 908–909 | Original carbohydrate bioavailability A_G = 0.8 is not attributed to UK versus EU fibre labelling. Impulse-response peak is τ; finite uniform ingestion has a different peak expression | P08; removed model-specific duplicate block and unsupported modifier tables from §5; mathematical check in drafts |
| Gradel et al. 2018; PMID 30116732; PMCID PMC6079517 | R; absorption process, §§4.2/4.2.1/4.5 | Regular-insulin healthy-subject site comparison: Cmax lower 32% thigh/42% deltoid versus abdomen, no difference in total exposure. IM time to 50% absorption is not plasma Tmax. Aspart LH 25% Cmax/22% exposure contrasts are not Famulla lispro's variability experiment | P15–P17, KB PK/PD boundaries; primary regional/bioavailability studies remain unacquired |
| Famulla et al. 2016; PMID 27411698; DOI 10.2337/dc16-0610 | A; indexed abstract | n = 13 T1D, 0.15 U/kg lispro LH versus normal. Insulin AUC 131/165, Cmax 61/79; CVs 52/11 and 55/15%. GIR AUC 625/775 mg/kg is action, not insulin exposure. Glucose AUC 731/513 mg·h/dL is +42.5%; +26.8% applies to peak glucose. Insulin Tmax not different | P17; §7/§22 endpoint corrections, abstract-only visible |
| Cartee 2015; PMCID PMC4816200 | R; human/animal context, signalling discussion and conclusion | Persistence sometimes 24–48 h, not universal T1D half-life. AS160 phosphorylation association is not proof of every causal step; phosphorylation relieves inhibitory Rab-GAP restraint, not activates it | P16/P19, KB recovery distinction |
| Mikines et al. 1988; PMID 3126668; DOI 10.1152/ajpendo.1988.254.3.E248 | A; indexed abstract | n = 7 untrained men without T1D, 60 min at 150 W; apparent Km 52 ± 3 at rest versus 40 ± 3 μU/mL at 48 h; Vmax 9.5 ± 0.8 versus 10.7 ± 0.8 mg/min/kg. Additional five-day group n = 3. Sparse visits do not identify decay constant | P19; preserved protocol-specific parameters and uncertainty |
| Pitt et al. 2020; DOI 10.3389/fendo.2020.573275 | R; acquired PDF pp. 1–7, Table 2 | Narrative mini-review, not meta-analysis. Table combines depot disappearance and plasma insulin endpoints and includes null results. No pooled 1.5–3-fold acceleration or proven independent warming–hexamer-dissociation mechanism | P20; new lawful source retained; no primary trial appraisal claimed |
| Romeres et al. 2021; PMID 33998292; PMCID PMC8321821; DOI 10.1152/ajpendo.00084.2021 | A/P; abstract plus online Methods | n = 6 T1D and 6 controls, three clamp conditions, 60 min at 65% VO2max. Model-derived insulin-independent +66–82% versus +67–97%; dependent +81–155% versus +10–40%. Not independently measured component fluxes or universal population multiplier | P21; merged two erroneous citations into correct identity; complete full-text gap visible |
| Yardley et al. 2013; PMID 23172972; PMCID PMC3579339 | O; Methods, Results, Tables/CGM outcomes | n = 12 managed crossover. Acute plasma glucose 9.2→5.8 aerobic, 8.4→6.8 resistance. Later CGM lower after resistance at 4.5–6 h. Nocturnal excursions 9 resistance/4 aerobic/4 rest, differences nonsignificant; some CGM missing; rest first, exercise order randomised | P22, KB comparison; no overnight safety ranking or disposal-flux inference |
| McClure et al. 2023; PMID 36549943; DOI 10.1016/j.jcjd.2022.11.006 | A; indexed systematic-review abstract | 19 interventions/15 reports; overall −1.3 mmol/L (95% CI −2.3 to −0.2), I² 84%. Fasted +1.7 versus postprandial −2.1 are heterogeneous-intervention contrasts, not one matched randomised meal-state protocol | P23; retain intervals, withhold trial-level risk-of-bias appraisal |
| Dao et al. 2025; PMID 39951019; DOI 10.2337/dci24-0096 | A; metadata/abstract | Review, not the described five-protein randomised experiment; indexed abstract does not supply the food-specific iAUC ranking | P12; withheld unsupported iAUC 203–397 ranking; original comparison remains unidentified |
| Bell et al. 2015; PMID 25998293; DOI 10.2337/dc15-0100 | A only | Systematic-review abstract supports variability across meal/insulin protocols, not a universal dosing pattern. Full text not acquired | KB abstract-only explicit |
| Paterson et al. 2015; PMID 26202844; PMCID PMC4512569; DOI 10.1007/s11892-015-0630-5 | R; retained file labelled Bell is actually this review | “The Role of Dietary Protein and Fat in Glycaemic Control in Type 1 Diabetes: Implications for Intensive Diabetes Management.” Its Smart compression illustrates why review prose must be checked against original timing/endpoints | Correct identity logged; do not count this file as Bell full-text access |
| Kwiatek et al. 2009; PMID 19779010; DOI 10.1152/ajpgi.00117.2009 | A/P; local metadata, publisher Methods/Results/Table 4 via search | Existing “Marciani” reference is wrong; energy and volume effects are protocol-specific and opposing. Indexed-abstract direction conflicts with Results/table | P01 follow-up sent to root; complete acquisition unresolved |

The exact source locators, replacement prose and numerical derivations are in `upstream-replacement-drafts.md`. Inherited sources with identity checks but without new full-text appraisal include Haahr, Heinemann, Horowitz, Jenkins, Sylow and Würsch. Identity verification does not upgrade their appraisal level.

## 4. Review-writing benchmarks actually inspected

1. **Gradel:** use formulation, injection route, population and endpoint as the comparison structure. A review table must not collapse regular insulin, aspart and lispro into one common effect. Applied in the PK section and LH corrections.
2. **Marathe:** separate gastric delivery from postprandial concentration and distinguish experimental perturbation from disease phenotype. Applied in §5 and the KB meal introduction.
3. **Cartee:** separate acute contraction from recovery insulin sensitivity, and human observations from animal signalling experiments. Preserve mechanistic depth while stating unresolved causality.
4. **Paterson 2015 review:** useful organisation by meal components and clinical implications, but its local mislabelling and compression of Smart's time points are warnings against relying on filename or a review's numerical paraphrase.
5. **Pitt:** useful explicit heterogeneity across formulation/site and proposed mechanisms; the original text does not support describing its table as pooled evidence.
6. **Bell:** the indexed abstract was inspected, but unavailable full text cannot honestly serve as a fully inspected prose benchmark. This limitation was not concealed by substituting the mislabeled Paterson file.

The KB revision consequently organises evidence around equal-carbohydrate meal comparisons, separately consumed protein, PK versus pharmacodynamics, and immediate versus delayed activity outcomes. It retains quantitative depth where measurement and comparator are identified; it removes repeated generic warnings and false food-specific precision.

## 5. Retained material and acquisition record

Reused simulator originals: `Smart_2013_ProteinFatAdditiveT1D.html`, `Paterson_2016_ProteinPostprandialBGinT1D.html`, `Fromentin_2013_DietaryProteinsContributeLittleToGlucose.html`, `Yardley_2013_ResistanceVsAerobicExerciseT1D.html`, and the specified pages of `Hovorka_2004_NonlinearMPC.pdf`.

Reused reviews: `Gradel_2018_RW_InsulinAbsorptionVariability.xml`, `Cartee_2015_RW_MechanismsPostExerciseInsulinStimulatedGlucoseUptake.html`, the Marathe XML in KB `private-literature/articles/`, and the mislabeled `Bell_2015_RW_FatProteinGIPostprandialT1D.html` (actual Paterson 2015). The retained Roden HTML is an abstract page, not full text.

One new full text was successfully acquired:
`docs/references/Pitt_2020_RW_FactorsInfluencingInsulinAbsorptionAroundExercise.pdf`.
Publisher PDF, HTTP 200, 1,944,325 bytes; SHA-256 `558ee1c935c2fcbda07052e5920b6e2336cdefde7e8fffdf4378599ca4d14c45`. The requested Frontiers article PDF redirected to the corresponding journal article PDF; PDF signature and article title/authors were checked. Methods/Results-style trial appraisal does not apply to this narrative review.

| Attempt | Actual result | Disposition |
|---|---|---|
| Bell DOI | HTTP 403 | No file; full text unresolved |
| Famulla DOI and journal PDF | HTTP 403 | No file; abstract-only |
| Dao DOI | HTTP 403 | No file; review and underlying protein comparison unresolved |
| Mikines DOI | HTTP 403 | No file; abstract-only |
| Roden PMC PDF route | HTTP 200, 1,817-byte HTML, not PDF | Rejected; no file |
| Roden JCI PDF viewer | HTTP 200, 21,925-byte HTML viewer, not PDF | Rejected; no original PDF |
| Romeres PMC8321821 | HTTP 200, 21,313-byte nonmatching/challenge HTML | Rejected; no full text |
| Kwiatek publisher PDF and full HTML | Both HTTP 403 | No file; partial online original text only |

No access controls were bypassed, no purchased access was used, and error/challenge pages were not retained as scientific articles.

## 6. Local URL identity verification

`url-checks.json` records 40 local GET attempts with requested/final URL, status, title/context and metadata where applicable: 16 PubMed challenge responses (203), four DOI failures (403), 16 successful Europe PMC metadata/abstract identities, and four successful PMC identities including Cartee. A status of 200 was not accepted without content identity. Public PubMed access remains explicitly unverified in the KB note.

Additional local Europe PMC checks established Qamar, Roden and Romeres identity. PMID 34128839 is an unrelated Reichmann tuberculosis paper (PMCID PMC8321576), not Romeres; PMCID PMC8321821 is the actual Romeres paper. The later Kwiatek check returned HTTP 200 and verified author/title/pages; publisher access remained blocked as above. These supplemental checks were performed separately and are described here, not falsely counted among the original 40 JSON entries.

This was a complete check of distinct external source destinations in the revised KB chapter, not a fresh link audit of every inherited upstream reference. The six §5 bibliography conflicts listed in P07 remain unresolved and are flagged visibly upstream.

## 7. Actual search log

Date for all searches: 2026-09-22. Searches were targeted to contested claims and acquisition, not exhaustive disease/topic retrieval. Primary publisher/PMC records and local originals supported conclusions; nonprimary search hits were not used as scientific authority.

1. Mikines 1988 “52” “40” insulin exercise 48.
2. Famulla 2016 lipohypertrophic tissue 52 11 13 insulin lispro.
3. “The glycemic impact of protein ingestion” Dao 2025 39951019.
4. Smart 2013 33 children 180 300 fat protein additive glucose.
5. “25998293” full text Bell fat protein glycemic index.
6. “39951019” Dao glycemic protein.
7. “23613599” Marathe gastric emptying GIP GLP-1.
8. “Roden” “1996” “Mechanism of free fatty acid” JCI pdf.
9. “New Insulin Delivery Recommendations” “4-mm” “90” “2016” Frid.
10. “Qamar” “1987” “mesenteric” exercise blood flow 60.
11. “Romeres” “34128839”.
12. “Romeres” “2021” exercise insulin dependent glucose uptake.
13. “19779010” “Marciani”.
14. “Marciani” “18” “6” “100 kcal” gastric emptying.
15. “Effect of meal volume and calorie load” “2009”.

The Frid search identified a need for original technique guidance, not evidence to invent a replacement needle-angle instruction. Subsequent guideline editions were not treated as a completed current-guideline review.

## 8. Wishlist fragment for root (no shared-list writes)

Deduplicate against the existing private wishlist. These are access or identity gaps, not all proven paywalls.

1. **Bell 2015**, DOI 10.2337/dc15-0100, PMID 25998293: full systematic review needed for meal/bolus synthesis. Local “Bell 2015” file is Paterson 2015, not this paper. DOI 403.
2. **Famulla 2016**, DOI 10.2337/dc16-0610, PMID 27411698: full crossover methods, variability estimates and meal analysis. DOI/PDF 403.
3. **Dao 2025**, DOI 10.2337/dci24-0096, PMID 39951019: review full text and the actual underlying five-protein comparison, if one exists. Do not label Dao itself that experiment.
4. **Mikines 1988**, DOI 10.1152/ajpendo.1988.254.3.E248, PMID 3126668: clamp and five-day subgroup details; DOI 403.
5. **Roden 1996**, DOI 10.1172/JCI118742, PMID 8675698: original PDF; current HTML is only abstract, PDF routes yielded HTML.
6. **Romeres 2021**, DOI 10.1152/ajpendo.00084.2021, PMID 33998292, PMCID PMC8321821: complete original, model assumptions and uncertainty. Correct authors include Schiavon, Basu, Cobelli and Dalla Man, not Boiroux/Lichtenstein.
7. **Qamar and Read 1987**, DOI 10.1136/gut.28.5.583, PMID 3596339, PMCID PMC1432887: original flow protocol; do not infer glucose absorption from Doppler.
8. **Kwiatek 2009**, DOI 10.1152/ajpgi.00117.2009, PMID 19779010: full original acquisition and abstract/table discrepancy. Replace false Marciani attribution.
9. **Frid 2016 injection recommendations**, PMID 27594187: original clinical technique guidance; specific 4-mm/45° statement withheld, not replaced with a new prescription.
10. **P07 identity reconciliation:** Mönnikes 11283195/11752839; Thompson 6411484/6832623; Leiper 11310927/26290294 (different years); Goo 3692672/3609660; Deloose 22407798/22450306; Otte 11310927/11457804. These pairs are conflicts to investigate, not equivalence claims.
11. **Inherited quantitative gaps:** gastroparesis epidemiology/natural-history originals; gastric-emptying variability and time-of-day source identities; recent fibre meta-analysis/actual regulatory threshold; injection-site registration/needle/pump-wear studies; recent fibre-specific glycogen depletion percentages; source for the reported individual HIIT response range. Their retention elsewhere does not mean this task independently verified them.

## 9. Verification and limitations

1. Normalised full-file comparison before/after integrating the six sections found all text outside the assigned sections identical. Version marker unchanged. A subsequent in-scope correction fixed a second `#temperature` anchor to `#temperature-climate`; no other section was touched.
2. Every internal `#anchor` in the integrated six sections was checked against BG-SCIENCE anchors; the two existing temperature links were corrected. Relevant implementation footer targets were checked read-only.
3. `git diff --check` passed for BG-SCIENCE and the KB chapter (only Git's LF/CRLF advisory). No build or code test was run because this was documentation-only and root owns the build.
4. The KB chapter was reread after editing; source identity and access limitations are visible. The user-facing recommendations remain educational design inference, not individual treatment guidance.
5. Remaining numerical statements in inherited upstream prose must not be advertised as exhaustively validated. Root identified one direct residual contradiction after integration; its concrete correction is provided transparently rather than silently changing the released file. A final abstract cross-check also found that the retained §9 individual-response range −0.3 to +9.0 mmol/L was not reported in McClure's abstract. The new label `Abstract-reported range` was therefore too strong; root was asked to remove that row. P23 records this correction openly.
6. No clinical-effect meta-analysis, updated guideline review, quantitative model calibration or simulator validation was performed.
