# Renal and cerebral glucose physiology: targeted claim audit

Date: 2026-09-22. Scope: the complete KB chapter `knowledge/physiology/glucose-insulin-system.qmd` and upstream `BG-SCIENCE.md` §§3–4, identified by the `renal-glucose-handling` and `brain-glucose-consumption` anchors. This is a targeted correction and appraisal, not a systematic review or comprehensive currency update.

## Delivery and status

1. **Implemented locally:** the KB chapter now distinguishes renal production, metabolic uptake, filtration/reabsorption and excretion; adds cerebral transport and glycogen synthesis; corrects the implication that glucagon necessarily precedes adrenaline; and consolidates design proposals into one final paragraph. Inherited quantitative anchors and their appraisal limits remain.
2. **Integrated by root on 22 September 2026:** both approved replacement blocks now appear in canonical BG-SCIENCE §§3–4. The Part 2 heading, carbohydrate anchor and v2 version marker were preserved. The blocks include references, abbreviation lists and separate implementation footers.
3. **Not modified:** `BG-SCIENCE.md`, model documentation, simulator code, other KB chapters, shared wishlists/source indexes/navigation, or build output. No commit, push or build was performed. Concurrent changes were preserved.
4. **Evidence boundary:** claims relying on original abstracts are marked beside the result. Unverified detailed claims were removed or recorded as gaps. An inspected review is not equivalent to independent appraisal of every primary study it cites.

The simulator science-reviewer skill and the KB scientific-review skill, including all four routed references, were read completely. The KB chapter and the full upstream text scope were read. Relevant model-documentation sections were consulted read-only to distinguish measurements from implementation parameters. The earlier learning-design task's evidence-map/discussion reading was not treated as physiology evidence.

## Principal corrections

1. T1D renal outcomes were overstated: the post-hoc DEPICT analysis found an albuminuria signal at the higher dose, but did not demonstrate an eGFR difference or fewer kidney-failure events.
2. Poudel's 52–85 g/day glucosuria and 0.9–1.7 mmol/L fasting-glucose reductions came from T2D trials. They were replaced by actual T1D DEPICT results, with separate efficacy/safety denominators and observation times.
3. The fixed 15 mL water/g glucose conversion and its 25 mmol/L → 200–500 g/day → 3–7 L/day chain lacked a valid physiological basis. Water balance depends on total solute excretion, urine concentration, intake and other losses.
4. An approximate brain energy share had become a glucose-disposal share. Unit conversion was also inconsistent: 5.6 mg/100 g/min gives about 113 g/day for an assumed 1.4-kg brain; 25–30 μmol/100 g/min gives about 91–109 g/day.
5. Glycogen concentration, symptoms, coma, seizures and DKA oedema cannot be combined into a universal concentration-to-injury rule. Mechanistic detail is retained without those unsupported thresholds.
6. Two local HTML files contain unrelated articles, and numerous upstream identifiers point to other publications. Existing files were preserved; corrections and acquisition status are recorded below.

## Upstream §3 claim ledger

“Corrected” refers to the approved blocks, now integrated by root. Repeated numerical-table cells are covered by their corresponding prose row.

| ID / original claim | Population, measurement and locator | Disposition |
|---|---|---|
| R01. Three renal processes, all altered in T1D | Gerich 2010, renal gluconeogenesis and Table 2; human physiology and T2D comparisons | Retain production, uptake and excretion; remove blanket T1D quantification. Gross production differs from net balance. |
| R02. GFR 180 L/day filters 180 g/day | Gerich, renal reabsorption section; adult example at plasma glucose about 5.5 mmol/L | Supply concentration and explicit calculation: 178.4 g/day. Filtration is not disposal. |
| R03. SGLT2 90%, SGLT1 10%, low SGLT1 capacity | Correct Ghezzi 2018 XML, transport/function/pharmacology sections; expression systems, animal studies and human synthesis | Preserve serial locations and normal SGLT2 dominance. Fixed split is not a directly established human constant; downstream SGLT1 reserve is substantial. |
| R04. Km 5 versus 0.4 mmol/L, coupling 1:1 versus 2:1 | Ghezzi, functional properties/Figure 3; expressed human transporters, 150 mmol/L sodium, −50 mV, 37°C | Source reports approximately 5 versus 2 mmol/L under these conditions. Retain stoichiometry; distinguish molecular affinity from a renal threshold. |
| R05. GLUT2 basolateral exit | Ghezzi, renal transport sections | Retain; distinguish facilitative exit from apical sodium coupling. |
| R06. Renal production 20–25%, 2–2.5 μmol/kg/min, substrate/hormone regulation | Gerich, renal gluconeogenesis/Table 2; overnight-fasted human synthesis | Retain with fasting and secondary-source boundaries. T2D production is not numerically imputed to T1D. |
| R07. Excretion only starts above aggregate Tm; threshold 10–11; normalized/absolute Tm combined | Gerich and Poudel, reabsorption/splay sections | Correct onset before whole-kidney saturation. Keep illustrative absolute Tm only; do not mix normalization or label an example a population mean. |
| R08. Healthy uptake 103±10 μmol/min as a norm | Gerich's summary of the Meyer T2D/control experiment | Remove normative anchor; primary denominator/protocol not checked. Preserve simultaneous uptake and production. |
| R09. n=23, threshold 6–14.3, Tm 0.93–1.98 | Johansen 1984 original abstract; gradual intravenous glucose infusion, earliest detectable urinary glucose | Retain ranges with inline abstract limitation. Omit correlations: abstract has suspicious coefficient signs/magnitudes requiring the original PDF. |
| R10. Hyperfiltration 10–67%, up to 162, mean 27% higher | Tonneijck 2017 Table 1; heterogeneous T1D cohorts and methods | Retain prevalence heterogeneity as a review finding, not an individual risk. Omit universal 27% and ceiling of 162. |
| R11. Tubular, vascular and structural mechanisms; hypertrophy precedes function | Tonneijck, pathogenesis sections | Retain mechanisms; temporal precedence is principally animal evidence, not established human sequence. |
| R12. HbA1c 10→7, GFR 149→129 equals 16% | Tonneijck narrative, reference 36; primary pump experiment not inspected | Correct arithmetic to 13.4%; retain as explicitly review-reported example, not a calibrated effect. |
| R13. Hyperfiltration independently causes/predicts nephropathy | Tonneijck, clinical significance/Table 2 | Compare positive measured-GFR cohorts with inconsistent larger estimated-GFR studies; no unqualified causal conclusion. |
| R14. SGLT2 expression increases Tm 20% in both diabetes types | Poudel, diabetes section; cultured urinary tubular cells from T2D and historical diabetic Tm studies | Do not recast T2D cells as intact T1D kidneys. Remove fixed 20% pending primary appraisal; Tm does not identify its molecular cause. |
| R15. Fixed 15 mL/g and daily glucose/water ranges at 25 mmol/L | No supporting source; dimensional and mass-balance assessment | Remove. Explain total osmoles, concentrating ability and fluid balance; no fabricated coefficient. |
| R16. Class clinical effects, >80% inhibition, SGLT1 upregulation | Poudel's clinical trials were T2D; Ghezzi explains reserve; Phillip 2021 supplies T1D data | Replace population-mismatched effects; reserve need not imply expression upregulation. Sotagliflozin identified as dual SGLT1/2. |
| R17. HbA1c −0.5%, DKA 2–4-fold, current approvals | Phillip, Methods §2.5, Results §3.2, Table 2; n=1591 efficacy, n=1646 safety; 24/52 weeks | Report actual changes and absolute DKA risks. Remove jurisdictional statements from physiology rather than invent a comprehensive 2026 regulatory update. |
| R18. Euglycaemic DKA <11 mmol/L in 30–40%; universal mechanism | Phillip Table 2 footnote uses <250 mg/dL near peak β-hydroxybutyrate; Ogawa review mixes contexts | Make definition dependence explicit. Retain insufficient insulin plus glucosuria mechanism; no universal percentage or T2D beta-cell explanation for T1D. |
| R19. Nephropathy 30% over 20–30 years; SGLT2 slows decline in T1D | Old incidence uncited; Groop 2020 original abstract, n=251 with baseline UACR≥30 mg/g, 52 weeks | Remove unsupported incidence. Report dose-specific UACR and eGFR intervals; no T1D hard-outcome conclusion. |
| R20. Implementation is only a threshold | MODEL §3, read-only | Describe threshold within the renal excretion term; no code-validation claim. |

## Upstream §4 claim ledger

| ID / original claim | Population, measurement and locator | Disposition |
|---|---|---|
| B01. 1.4 kg, 2% body mass, 20–25% glucose disposal, obligate fuel | Mergenthaler 2013 introduction and metabolism sections | Distinguish energy share from glucose flux. Use 1.4 kg as an assumed mass for conversion; alternative fuels preclude an absolute glucose-only claim. |
| B02. Insulin-independent means no insulin sensitivity/signalling | Mergenthaler transport/signalling; McCrimmon 2010 | Distinguish dominant GLUT1/3 from insulin-triggered GLUT4. Exogenous insulin is not itself the brain's glucose substrate. |
| B03. Seizures/coma below 2 mmol/L; oedema fatality | Sprague clinical definitions; Azova introduction | Remove universal failure threshold. Keep oedema case fatality distinct from mortality among all DKA episodes. |
| B04. GLUT1 55/45 kDa, GLUT3, abluminal density 2.5× | Devraj 2011 Methods/EM Results/Discussion; rat capillaries, bovine membranes | Retain transporter loci; 1:1:2.45 is rat labelling, not human flux. Phosphorylation affects antibody recognition. Correct authors. |
| B05. GLUT3 Km 1–2 supplies a safety margin | Cited Simpson local file is unrelated; Mergenthaler supports transporter location | Remove exact Km/protection claim pending correct full text. Preserve mechanism. |
| B06. Human Kt 1.5–3.5 mmol/L | Duarte 2009 Figure 2/Table 1: human Gruetter, rat Choi and rat Morgenthaler datasets | Correct mixed-species range. Human four-state Kt=2.1±5.2 mmol/L (SE; reported CI 0–12.6). Earlier preliminary “rat-only” shorthand was corrected after full table inspection. |
| B07. Near-saturation at 5–7, fixed brain:plasma ratios and limitation below 4/3 | Duarte derivations/Figure 2; tissue-water and lumped-compartment assumptions | Explain reversible transport and approximate linearity. Do not equate bulk tissue, intracellular, interstitial and tracer measurements; remove fixed transition points. |
| B08. 25–30 μmol equals 5 mg and 110–120 g/day | Mergenthaler gives about 5.6 mg/100 g/min; independent unit conversion | Correct to 31.1 μmol and 112.9 g/day at 1.4 kg. Alternative 25–30 μmol range gives 90.8–109.0 g/day. |
| B09. OGI 5.5 means 10% lactate; exact ATP allocation | Mergenthaler energetics | Retain predominantly oxidative metabolism and ion-gradient demand. Biosynthesis also consumes carbon; remove exact lactate percentage and unnecessary ATP-allocation precision. |
| B10. Gray:white ratio 3–4 and regional ranking | Primary quantitative imaging source not identified | Retain regional heterogeneity; ratio/ranking are explicit evidence gaps. |
| B11. Glycogen 1–2 g/kg gives <10 min reserve | Öz 2009 original, paired n=5 healthy adults, occipital MRS, two-hour clamps | Model pool about 3.5 μmol glucosyl/g; about 0.57 g/kg. Blood remains principal source. No fixed injury timer. Old pool/time were also arithmetically inconsistent. |
| B12. ANLS transport direction, oxidation by LDH, established consensus | Mergenthaler neuroenergetic models; corrected Pellerin/Dienel identities | LDH forms pyruvate before mitochondrial oxidation. Distinguish lactate use from obligatory astrocyte-to-neuron flux; do not label unread reviews fully appraised. |
| B13. Threshold staircase through symptoms, confusion, coma | Sprague threshold section gives symptoms around 2.8–3.0, not the old 3.2–3.6 range | Keep illustrative counterregulatory/symptom values as secondary synthesis. Severe events are assistance-based, not universally concentration-defined. |
| B14. Ketone fraction 50–60%/two-thirds and adaptation in 3–7 days | Owen 1967, all seven pages; three adults with obesity, 38–41-day fast, sedation, flow measured in two; Table V | Calculated ketone oxygen equivalents 1.77/2.96≈60%. Not an acute T1D rescue fraction or adaptation clock. 24 g/day is estimated oxidation after lactate/pyruvate efflux, not gross uptake. |
| B15. HAAF requires ≥60 min; glucagon lost at five years | McCrimmon pp.2333–2338; Sprague; Dagogo-Jack | Retain exposure/context dependence and multiple mechanisms; remove universal qualifying duration/anniversary. |
| B16. Unawareness 25-fold risk; reversal after 2–3 weeks | Sprague distinguishes defective counterregulation and impaired awareness; Dagogo-Jack describes recovery of components | Do not interchange phenotypes. Remove unappraised primary risk ratio; retain possible partial reversibility as historical review evidence. |
| B17. Boyle intensive-therapy experiment at 2.5 mmol/L proves GLUT1 adaptation | Correct Boyle original abstract: n=24 stratified by HbA1c, n=15 controls, about 3.0 mmol/L; McCrimmon p.2337 counterevidence | Correct population/concentration; not randomized therapy or a molecular measurement. No unverified “tracer” method or universal protection claim. |
| B18. GLUT1 downregulation causes neuroglycopenia at 5–6 | Sprague supports shifted symptom responses, not direct human GLUT1 evidence | Relative symptoms do not prove cerebral deprivation or a transporter mechanism. |
| B19. Age-six boundary, specific anatomical damage, IQ −4–6 | Wrong Languren identifier; correct review identity found, full text not appraised | Remove detailed causal values. Need primary paediatric data separating hypoglycaemia, hyperglycaemia, DKA and age at onset. |
| B20. DCCT 18-year null implies no adult effect | Jacobson 2021 original abstract: n=1051, 32 years, median age 27→59 | Add later associations with HbA1c, severe hypoglycaemia and pressure; observational, not causal. Do not extend an early null indefinitely. |
| B21. Swelling in most children at presentation; clinical rate 0.2–1% | Azova introduction/fluid sections | Use review range 0.3–1%; distinguish during-treatment imaging from pretreatment findings. |
| B22. Ischaemia–reperfusion is settled; rapid fluids cause injury | Azova §3.4/conclusions; Kuppermann original abstract, 13-centre factorial trial, 1255 children/1389 episodes | Retain multifactorial hypotheses; human ischaemia not demonstrated as in some rodents. No significant tested fluid contrasts; 12 clinical injuries do not establish equivalence of all regimens. |
| B23. Acidosis, hypocapnia, urea, bicarbonate and adult rarity | Azova clinical/mechanistic sections | Retain presentation associations, not bicarbonate causation. Do not invent adult risk estimates. |
| B24. Dead-in-bed 6%, arrhythmia/orexin, device effects | Correct Tanenberg abstract: one 23-year-old man's CGM case; Tu identity only | Case supports possible hypoglycaemia contribution, not incidence or terminal mechanism. Remove unappraised orexin and device-effect claims. |
| B25. CNS insulin cannot alter whole-brain CMR | Mergenthaler insulin-signalling discussion | Remove absolute no-effect claim; distinguish signalling from dominant glucose transport. |
| B26. F01 represents brain alone | MODEL §3 includes brain, erythrocytes and other insulin-independent use | Correct footer: a lumped disposal term is not a direct cerebral rate or injury threshold. |

## Source identity repairs

Identifiers below establish citation identity, not fully working public article pages. Concrete local URL results and independent Europe PMC records are retained separately in JSON.

| Intended source | Old problem | Correct identity |
|---|---|---|
| Ghezzi 2018 | PMC6133540/local HTML is an unrelated herbal-insomnia article | PMID 30132032; **PMC6133168**; new verified XML |
| Poudel 2013 | PMID 24014904 is unrelated drug-permeation research | **23961473**, PMC3743357; local body correct |
| Ogawa/Sakaguchi | PMID 27042271 is unrelated; online year confused with issue year | **27042263**, PMC4773669; issue **2016**, 7:135–138 |
| Mergenthaler 2013 | PMID 23933069 is a Gbx2 development article | **23968694**, PMC3900881; local body correct |
| “Barros 2009” | Wrong authors and PMID 19890463 (SPECT paper) | **Duarte JMN et al.**, PMID 20027232, PMC2795468; local filename misleading, body correct |
| “Vannucci 2011” | Wrong author list | **Devraj K et al.**, PMID 21910135, PMC3835747; local body correct |
| Simpson | Wrong year and PMC2890218; local body is tRNA research | **2007**, PMID 17579656, PMC2094104; correct full text not retained |
| Pellerin 2012 | Wishlist says paywall despite a PMC identifier | PMID 22027938, PMC3390819; no full appraisal this pass |
| Boyle 1995 | PMID 8544261 is an AMA/tobacco paper | **7491135**, DOI 10.1056/NEJM199512283332602 |
| Cryer 2013 NEJM | PMID 24095133 is a different Cryer book chapter | **23883381**; KB citation already correct |
| “Hirsch/Skyler 2016” | Wrong authors, year, pagination and PMID 27288006 | **Dagogo-Jack S, 2015**, PMID 26604275, PMC4876742; *Diabetes Care*38:2193–2199 |
| Sprague 2011 | PMID 24015370 is a neonatal tetanus article | **22783644**, PMC3755377;463–473, quiz 474–475 |
| McCrimmon/Sherwin | PMID 20723825 is a different review | **20876723**, DOI 10.2337/db10-0103; local PDF correct |
| Cahill 2006 | Identifier correct; selected PDF pages yielded no extracted text | PMID 16848698; not used for new numerical claims; Owen original substituted |
| Languren 2013 | PMID 24018961 is fungal genetics | **23876631**, DOI 10.1016/j.neuint.2013.06.018; identity only |
| Glaser 2001 | Identifier correct | PMID 11172153; no new full-text appraisal; Azova/PECARN used instead |
| Azova 2021 | PMID 33289956 is ovarian cancer | **33197066**, PMC10127934; local body correct |
| Tu 2010 | PMID 19604134 is a different dead-in-bed paper | **18676043**, DOI 10.1016/j.ijcard.2008.06.021; identity only |
| Tanenberg 2010 | PMID 20223987 is EphA2 research | **19833577**, DOI 10.4158/EP09260.CR; abstract inspected |
| Dienel 2017 | PMID 28028821 is sarcopenia/liver fibrosis | **28151548**, DOI 10.1002/jnr.24015; abstract inspected, not primary basis for synthesis |
| Gerich 2010/2001, Tonneijck | Supplied identifiers correct | 20546255/11213896/28143897; Gerich (2001) not newly full-text read |

## Appraisal, acquisitions and wishlist fragment

Existing full-text claim sections were inspected in Gerich (2010), Poudel (2013), Tonneijck (2017), Mergenthaler (2013), Duarte (2009), Devraj (2011), Sprague (2011), McCrimmon (2010), Dagogo-Jack (2015) and Azova (2021). Some local filenames misidentify authors, as above. Newly acquired, identity-verified and substantively used physiology sources are:

1. `Ghezzi_2018_RW_RenalGlucoseHandling_VERIFIED.xml` — official Europe PMC XML; transport/function/pharmacology sections inspected.
2. `Phillip_2021_Pooled52WeekDEPICT.pdf` — public institutional published version; eligibility, methods, analysis sets, efficacy and DKA Table 2 inspected.
3. `Oz_2009_HumanBrainGlycogenHypoglycemia.xml` — official Europe PMC XML; methods, results and discussion inspected.
4. `Owen_1967_BrainMetabolismDuringFasting.pdf` — public JCI PDF; all seven pages inspected.

All are in simulator `docs/references/`, not the games collection. Acquisition URLs, UTC times, status, size and SHA-256 are in the acquisition JSONs and final-link log. Original abstracts were inspected for Johansen (1984), Groop (2020), Boyle (1995), Jacobson (2021), Kuppermann (2018) and Tanenberg (2010); their prose use is explicitly qualified.

Ordinary PMC article requests returned HTTP 200 challenge pages, which were rejected as non-articles and not saved. Official XML returned 500 for Simpson, Kuppermann, Jacobson and Vallon; the Dandona publisher PDF and Kuppermann eScholarship route returned 403. No challenge, authentication or browser restriction was bypassed.

The following is a **wishlist fragment for root**, not an edit to the shared wishlist. Unavailable here does not necessarily mean paywalled.

| Priority / source | Remaining need and access status |
|---|---|
| High — Groop (2020), DOI 10.1016/S2213-8587(20)30280-1 | Full renal endpoint, missing-data and analysis appraisal; original abstract retained. |
| High — Boyle (1995), DOI 10.1056/NEJM199512283332602 | Uptake method, exposure ascertainment and functional interpretation; abstract corrects 2.5→3.0 mmol/L. |
| High — Jacobson (2021), PMC8583716 | Full adjustment, attrition and severe-event definitions; PMC challenge/XML500. |
| High — Kuppermann (2018), PMC6051773 | Full protocol, exclusions and confidence intervals; PMC challenge/XML500/eScholarship403. Abstract and Azova protocol appraisal used. |
| Medium — Johansen (1984), DOI 10.1007/BF00252403 | Threshold assay/Tm method and suspicious abstract correlations. |
| Medium — Tonneijck reference 36 | Original pump experiment behind GFR 149→129; needed before calibration. Review's 16% conflicts with arithmetic. |
| Medium — Simpson (2007), PMC2094104 | Replace unrelated local file; correct full text unavailable through attempted routes. Exact GLUT3 Km omitted. |
| Medium — Languren (2013), PMID 23876631 | Correct review and underlying paediatric cohorts; separate hypoglycaemia from hyperglycaemia, DKA and age at onset. |
| Medium — Meyer experiment cited by Gerich | Primary denominator/protocol for uptake 103±10; not retained as a norm. |
| Lower — Dandona (2018), DOI 10.2337/dc18-1087 | Publisher403; accessible pooled Phillip original suffices for current efficacy/safety correction. |
| Lower — Pellerin (2012)/PMC3390819 and Dienel (2017)/PMID 28151548 | Deeper ANLS comparison; present synthesis uses appraised Mergenthaler. Do not automatically call Pellerin paywalled. |
| Lower — Tu (2010)/18676043 and Tanenberg (2010)/19833577 | Full case/registry appraisal before adding incidence or arrhythmic mechanism claims. |

Do not reuse the two demonstrably unrelated local HTML files as support. They were preserved; quarantine/replacement and shared reference-index reconciliation require root coordination.

## KB coverage and writing acceptance

| Chapter portion | Action / boundary |
|---|---|
| Flux balance and insulin pathways | Retained three-pathway synthesis; added renal production/recycling distinction. Rizza remains explicitly abstract-level. |
| T1D route and HAAF | Retained portal/exogenous exposure and existing Cryer/Najjar appraisal; no fixed new portal ratio. |
| Counterregulation | Removed unnecessary glucagon-before-adrenaline sequence; no deterministic failure threshold. |
| Brain | Added transport, measurement and glycogen distinctions with healthy-human/T1D boundaries. |
| Sensor and quantitative anchors | Preserved Basu n=8 and 5.3–6.2 min; Rizza 29±2 versus 55±7 with inherited limitations. Not newly rederived in this organ audit. |
| Design inference | One final paragraph explains the physiological-to-educational inferential bridge; not claimed experimentally validated. |
| Metadata and sources | Actual targeted date; local destination limitations visible; physiology sources kept in their owning collection. |

The editorial benchmarks were the complete relevant mechanism/appraisal sections of Tonneijck (2017) and Azova (2021). Their comparison of mechanisms with observational and experimental limitations informed the revision. Their wording was not copied, and their conclusions were not accepted uncritically: the arithmetic discrepancy in Tonneijck and the distinction between human hypoxia and demonstrated ischaemia in Azova were explicitly appraised.

| Acceptance check | Result |
|---|---|
|1.Argument | **Pass:** distinct fluxes and measurements organize the answer, rather than a single concentration-to-outcome rule. |
|2.Synthesis | **Pass:** production versus uptake, reserve versus expression, surrogate versus hard outcome, and adaptation versus warning are compared. |
|3.Traceability | **Partial:** inspected sources and locators support corrections; original-abstract and primary-study gaps remain explicit. |
|4.Critical balance | **Pass:** null eGFR intervals, inconsistent hyperfiltration cohorts, transport counterevidence and fluid-trial null contrasts affect conclusions. |
|5.Applicability | **Pass:** T1D/T2D, human/rodent, healthy/diabetic, molecular/organ and acute/prolonged-fasting domains remain visible. |
|6.Editorial separation | **Pass:** synthesis in body, KB proposals once, implementation only in upstream footers, acquisition detail here. |
|7.Density and depth | **Pass:** transporter coupling, feedback, compartments, substrate flux and trial context retained; unsupported precision and repetitive tables removed. |
|8.Usability | **Partial:** definitions, source links and static checks completed; no delegated Quarto render/browser validation. Restricted landing pages are recorded honestly. |

## Verification and integration

1. `final-link-verification.json` covers every external destination in the revised KB and both drafts, plus candidate links. PubMed returned 203/interstitial; independent Europe PMC identities were recorded separately. Both retained publisher/institutional PDFs returned 200 and matched the article content. Status alone was not sufficient.
2. `verification.md` records whitespace, structure and arithmetic checks. No rendered-output claim is made.
3. **✅ FIKSET (2026-09-22, local integration):** root integrated both blocks under the existing v2 batch marker and merged priority wishlist records. Final rendering is recorded in the whole-base audit. Source-access gaps remain open as listed above.
4. Read-only observations sent to root: F01 0.0097 mmol/kg/min equals 9.7 μmol/kg/min, not 14; the gameover glycogen analogy is not an empirical injury threshold. Neither was implemented here or presented as a complete model review.

## Exact targeted search record

All queries below were run on **2026-09-22**. Additional exact Europe PMC metadata queries are retained in the scripts and JSON logs. No comprehensive currency claim is made.

1. `SGLT2 type 1 diabetes DEPICT renal post hoc albuminuria eGFR Groop 2020`
2. `brain glucose 20 percent energy 60 percent glucose Mergenthaler 2013`
3. `Kuppermann 2018 randomized trial fluid infusion rates pediatric diabetic ketoacidosis brain injury`
4. `Ghezzi Loo Wright 2018 renal glucose handling SGLT1 SGLT2 GLUT2 97 3 Km`
5. `"Supply and demand in cerebral energy metabolism" PMC`
6. `"GLUT-1 glucose transporters" "differential phosphorylation" Vannucci`
7. `"20%" "brain" "resting" "glucose" Dienel 2019`
8. `"osmotic diuresis" glucose "15" mL gram`
9. `"DEPICT-1" "52-Week" "4.0%" Dandona 2018`
10. `"DEPICT" "renal" "Groop" 2020 filetype:pdf`
11. `"osmotic diuresis" "glucose" "urine" "SGLT2" review water 2018`
12. `"Brain glucose uptake and unawareness" Boyle 1995 1726 1731`
13. `Oz 2007 human brain glycogen content metabolism hypoglycemia 3.5 umol g`
14. `"Long-term effect" "diabetes" "cognitive" "32 years" severe hypoglycemia Jacobson 2021`
15. `"Efficacy and Safety of Dapagliflozin" "52-Week" DEPICT-1 2018 Diabetes Care`
16. `site.gov.uk dapagliflozin no longer authorised type 1 diabetes October 2021`
17. `Jacobson 2021 cognitive performance 32 years DCCT EDIC PMC`
18. `Duarte Morgenthaler Lei Poitry-Yamate Gruetter 2009 brain glucose transport kinetics PMC2795468`
19. `Oz 2009 Human brain glycogen metabolism during and after hypoglycemia PMC2731528`
20. `Cahill 2006 fuel metabolism in starvation 40 grams brain glucose`
21. `"Clinical Trial of Fluid Infusion Rates" PMID`
22. `"Neuronal damage and cognitive impairment" Languren PMID`
23. `"Sugar for the brain" Mergenthaler PMID`
24. `"Dienel" "2017" "lactate" "shuttle"`
25. `Owen 1967 Brain metabolism during fasting JCI full text`
26. `Languren 2013 Neuronal damage hypoglycemia 238`
27. `Kuppermann 2018 fluid infusion trial escholarship 0zx0g82r pdf`
