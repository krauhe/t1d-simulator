# Search, access and verification log

Date: 2026-10-03. Purpose: targeted evidence audit of BG-SCIENCE following the local October intake. This was not an exhaustive update search or systematic review.

## Local search and selection

1. Read the source document's 30 numbered sections (1–29 plus 10b), version 2026-09-22-v2. Partitioned sections between four reviewers; reviewed the September 22 audits before reporting new findings.
2. Inspected the shared archive index and October intake register. The register contained 60 physiology records classified as canonical reading copies; this is an inventory count, not 60 completed article appraisals.
3. Used filename/title searches and targeted text retrieval to locate originals for meals, insulin delivery, exercise recovery, circadian and menstrual physiology, organ fluxes, sensing, distress and research models. The claim JSON files identify the exact selected sources and pages.
4. Checked original PDF page images for numerical and table claims. Identical source hashes identify the same byte version across the two repositories. Did not treat conversion status as scientific verification.

## Recorded coordinating-reviewer online queries

1. `"Time Lag of Glucose From Intravascular to Interstitial Compartment in Type 1 Diabetes" Basu 2015`
2. `"Measurement of interstitial insulin in human muscle" Sjostrand`
3. `"The Relationships Between Time in Range, Hyperglycemia Metrics, and HbA1c" Beck 2019`
4. Europe PMC REST: `EXT_ID:<identifier> AND SRC:MED`, for identifiers 9886961, 9886964, 25305282, 30636519, 7491135, 11213896, 11508267 and 11935147.
5. Europe PMC REST: `TITLE:"The COVID-19 Pandemic Affects Seasonality"`, identifying Reschke et al., PMID 36166593.

These exact queries cover the coordinating review, not a reconstructed complete search history for all agents. The scoped reports additionally document their source-specific searches and checks. Candidate retrieval was purposive, not screened to a systematic-review eligibility protocol.

## Local-computer access results

| Resource / route | Result | Consequence |
|---|---|---|
| PubMed HTML pages for Sjöstrand, Basu, Beck, Boyle and Gerich | HTTP 203; generic title; expected article content absent | Not certified as readable local destinations |
| Europe PMC REST metadata for the eight identifiers above | HTTP 200; title, authors, year and identifiers matched | Identity verified; metadata is not full-text appraisal |
| Sjöstrand publisher DOI route | HTTP 403 | Full text still pending; existing wishlist identifier corrected |
| Li/Wainwright PMC HTML | Agent observed matching title; coordinating retry returned HTTP 200 with reCAPTCHA rather than article | Access is variable; the later result is not called successful content retrieval |
| Li/Wainwright MDPI route | Agent local check HTTP 403 | Not a verified readable route |
| `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12158204/fullTextXML` | HTTP 200; original title/DOI/PMID, body, three tables and 33 references present | Archived 114027-byte XML; SHA-256 05e8d5fd8b5c70e19cab43556f21072a798d6fe944794eb461a1f7a067c67c9b |
| `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7906317/fullTextXML` | HTTP 200; Manousaki title/DOI/PMID, body and 51 references present | Archived 201951-byte XML; SHA-256 07163ada7c32d1d0a64be31aa1cdbb767314bd1a1d2f91a71708516840ffcea7 |
| `https://link.springer.com/content/pdf/10.1007/s001250100529.pdf` | HTTP 200; valid five-page PDF despite cookie-error query appended to final URL | Ceriello original visually identified on page 1 and archived; 86553 bytes; SHA-256 e2eb183704540d3591a88747cb39713bc52ea43687aa4f94af86bad79b1712a8 |
| `https://doi.org/10.2337/dc22-0278` | HTTP 403 | Reschke full text added to wishlist; indexed abstract only |

The Ceriello PDF's embedded text initially appeared as glyph codes, so the title and population were verified visually rather than inferred from that extraction. The shared archive updater successfully converted it, bringing the reading index to 161 cached PDFs. Its nonzero exit status reflected the pre-existing invalid Mergenthaler pseudo-PDF still pending, not failure of the new conversion. Original XML files are already searchable text and are not sent through the PDF converter.

## Integration quality control

1. Independently inspected original pages underlying Englyst MA01, Asp MA05, Fisher EM01, Scheer RH06, Szendroedi EM03 and Dalla Man EM05.
2. Added original Ceriello page-1 verification of EM04 and local metadata verification identifying the unrelated currently linked article.
3. Corrected draft-review overstatements: no unsupported power classification of Li; no claim that the Somogyi 1959 case paper was the first formulation of the hypothesis; no assertion that the BG paragraph explicitly calls the 3D cohort T1D; no certification of model component values only located in extraction.
4. Identified Reschke as the correct authorship of the paper attributed to Kamrath, and had the scoped report updated accordingly.
5. Confirmed direct local-source links in the main report exist. Source access failures and scientific uncertainty remain separate categories.

## Open acquisition / appraisal work

1. Obtain Sjöstrand's full text before making a strong kinetic transport claim.
2. Obtain Reschke's full text before appraising its modelling and registry limitations beyond the abstract.
3. Visually verify Li's original PDF tables before quoting exact cells as PDF-checked. The archived original XML is available now; no equivalence conclusion follows from a nonsignificant comparison.
4. Locate the actual T1D endothelial-function study, if the old percentage and recovery-time claims are to be retained. Ceriello 2001 is not that study.
5. Appraise remaining inherited claims listed in each section-coverage matrix. Untested source links and unchecked study claims were not silently promoted to verified status.
