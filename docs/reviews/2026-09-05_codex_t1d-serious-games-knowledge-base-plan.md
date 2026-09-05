# T1D Serious Games Knowledge Base: Repository, Editorial and Publication Plan

**Document type:** Technical and scientific implementation plan  
**Date:** 5 September 2026  
**Provisional repository name:** `t1d-serious-games-knowledge-base`  
**Provisional site title:** *T1D Serious Games Knowledge Base*  
**Initial repository visibility:** Private  
**Primary audiences:** Serious-game developers, diabetes researchers, clinicians, educators, patient organisations, students and future maintainers  
**Language:** Scientific English only during the initial phase

## 1. Executive recommendation

Create a new, independent private GitHub repository and use **Quarto** to build a static, searchable scientific website. The repository should treat the website, structured game catalogue, bibliography, evidence tables and original figures as different views of one version-controlled knowledge base rather than as unrelated documents.

The project should not function as a promotional site for T1D Simulator. Its primary purpose should be to make it easier to find, understand, compare, design, evaluate and maintain serious games for type 1 diabetes (T1D). T1D Simulator should be catalogued as one game among the others, using exactly the same profile structure, evidence requirements and availability checks. It should not receive a separate implementation section or privileged case-study status.

The initial private phase should use local Quarto previews and private GitHub Actions build artefacts. GitHub Pages should not be enabled until site visibility, screenshot rights, licensing and scientific review have been checked. A private repository does not automatically imply a privately accessible Pages website: private Pages access control requires an eligible organisation on GitHub Enterprise Cloud ([GitHub Docs, 2026](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)). GitHub Pages can be built from private repositories on eligible paid plans, but the intended visibility of the generated site must be decided separately ([GitHub Docs, 2026](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)).

## 2. Purpose and boundaries

### 2.1 Primary purpose

The knowledge base should support four recurring tasks:

1. **Discover:** identify T1D games, simulations and relevant adjacent interventions, including products that are archived, discontinued, geographically restricted or available only to research participants.
2. **Interpret:** understand what each product attempts to teach, how its game mechanics are expected to support learning, and what evidence does or does not support those assumptions.
3. **Design:** translate evidence from learning science, human-computer interaction, game design, behavioural science and T1D education into testable design patterns.
4. **Sustain:** document why serious-game projects disappear and provide practical patterns for governance, technical maintenance, succession, open standards and responsible artificial-intelligence-assisted maintenance.

### 2.2 Explicit boundaries

The site should:

1. Address education, self-management learning, psychological coping, experiential understanding and professional training where these are relevant to T1D.
2. Include children, adolescents, adults, caregivers and clinicians, while making population differences explicit.
3. Distinguish serious games, simulations, gamified health utilities, exergames, experiential games and clinician-training products.
4. Present educational and design evidence without giving individual treatment advice.
5. Exclude personal health data and personalised dose recommendations.
6. Avoid ranking products with a single composite score. Availability, evidence quality, usability, learning scope and sustainability answer different questions and should remain separate dimensions.
7. Treat marketing statements as product claims, not as evidence of effectiveness.

## 3. Recommended technical architecture

### 3.1 Why Quarto is the preferred foundation

Quarto is better aligned with this project than a conventional promotional website because it supports scholarly citations, bibliographies, equations, code, figures, tables and cross-references in the same authoring system. It can produce a searchable website with combined top and side navigation, reader mode and links to edit a page or report an issue ([Quarto, 2026a](https://quarto.org/docs/websites/website-navigation)). It also supports numbered and hyperlinked references to figures, tables, equations and sections ([Quarto, 2026b](https://quarto.org/docs/authoring/cross-references)).

| Option | Scientific authoring | Structured navigation and search | Maintenance burden | Recommendation |
|---|---:|---:|---:|---|
| Quarto | Strong native citations, figures, equations and cross-references | Strong | Moderate and well documented | **Recommended** |
| MkDocs Material | Strong developer-documentation experience; citations require additional configuration | Strong | Moderate | Viable alternative if the site becomes predominantly software documentation |
| Jekyll | Native GitHub Pages tradition; scholarly functions require more custom work | Adequate | Moderate to high for this use | Not preferred |
| Custom JavaScript application | Maximum interface freedom | Potentially strong | High; risks creating another application that needs specialist maintenance | Reserve for later interactive modules |

### 3.2 Core technology choices

1. **Authoring:** Quarto Markdown (`.qmd`) with plain Markdown where Quarto-specific features are unnecessary.
2. **Rendering:** Static HTML, with no server-side database in the first release.
3. **Styling:** A small project-specific SCSS layer built on Quarto's Bootstrap theme system.
4. **Scientific references:** BibTeX or CSL JSON as the canonical bibliography, rendered with an author-date Citation Style Language (CSL) file.
5. **Structured game data:** One YAML record per game, validated against a JSON Schema; a build script generates the combined JSON catalogue used by tables and filters.
6. **Figures:** Original SVG diagrams where possible; PNG or WebP only for raster screenshots and photographs.
7. **Automation:** GitHub Actions for validation, link checking and deterministic Quarto rendering. Deployment must be a separate, deliberately enabled job.
8. **Search:** Quarto's locally generated full-text search initially; no external search service or tracking is required ([Quarto, 2026c](https://quarto.org/docs/websites/website-search.html)).

### 3.3 Proposed repository structure

```text
t1d-serious-games-knowledge-base/
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   |-- PULL_REQUEST_TEMPLATE.md
|   `-- workflows/
|       |-- validate.yml
|       `-- publish.yml                 # Disabled until publication is approved
|-- content/
|   |-- games/
|   |-- evidence/
|   |-- learning-science/
|   |-- game-design/
|   |-- t1d-foundations/
|   |-- evaluation/
|   |-- ux-accessibility/
|   |-- psychosocial/
|   |-- safety-ethics/
|   |-- sustainability/
|   |-- case-studies/
|   |-- research-gaps/
|   `-- idea-lab/
|-- data/
|   |-- games/
|   |-- studies/
|   |-- people-organisations/
|   |-- schemas/
|   `-- generated/
|-- figures/
|   |-- original/
|   |-- game-images-cleared/
|   `-- provenance/
|-- references/
|   |-- references.bib
|   |-- source-register.yml
|   `-- styles/
|-- templates/
|-- tools/
|-- _quarto.yml
|-- index.qmd
|-- methods.qmd
|-- glossary.qmd
|-- CHANGELOG.md
|-- CITATION.cff
|-- CONTRIBUTING.md
|-- EDITORIAL-POLICY.md
|-- GOVERNANCE.md
|-- LICENSE-CODE
|-- LICENSE-CONTENT
|-- README.md
`-- .gitignore
```

Downloaded articles and uncleared third-party images should not be committed. A local `private-literature/` directory and a local `figures/game-images-review-only/` directory should be gitignored. The repository should track bibliographic metadata, access status and stable source links instead.

## 4. Information architecture for the website

The website should provide two complementary reading modes: structured chapters for study and data-driven profiles for comparison.

### 4.1 Top-level navigation

1. **Home:** purpose, audience, scope, current evidence cut-off, principal conclusions and routes into the site.
2. **Game Explorer:** searchable and filterable catalogue with a comparison view.
3. **Learning Science:** theories and mechanisms relevant to knowledge acquisition, skill transfer and retention.
4. **Design Patterns:** game mechanics, feedback, progression, narrative, deliberate practice, social learning and ethical engagement.
5. **T1D Foundations:** developer-oriented physiology and self-management concepts required to avoid educationally misleading game rules.
6. **Evaluation:** study designs, outcomes, instruments, feasibility measures, process evaluation and reporting standards.
7. **Human Factors:** onboarding, cognitive load, accessibility, age adaptation, caregiver participation and psychosocial safety.
8. **Adoption and Sustainability:** routine-care adoption, product disappearance, maintenance models, governance and succession.
9. **Comparative Analyses:** cross-product analyses selected for their scientific or design relevance, without privileging a project-affiliated game.
10. **Research Gaps and Idea Lab:** unanswered questions and explicitly labelled design hypotheses or concepts.
11. **Methods and Sources:** search methods, eligibility criteria, evidence grading, update policy, bibliography and source register.
12. **Contribute:** correction requests, submission schema, conflicts of interest and editorial workflow.

### 4.2 Initial launch corpus

The first useful private version should contain:

1. The existing 44-record structured T1D game catalogue, migrated into one validated record per product.
2. The existing serious-games review restructured into web chapters rather than copied as one long page.
3. Detailed profiles of all currently available core games.
4. Historical profiles of Captain Novolin, Packy & Marlon, Monster Manor and influential research prototypes.
5. A visual historical timeline linking platform changes to changes in educational and game design.
6. A chapter on the learning loop **Predict -> Act -> Observe -> Explain -> Retry -> Vary**.
7. A chapter distinguishing knowledge gain, practical competence, transfer, self-efficacy, engagement, behaviour change and clinical outcomes.
8. A chapter on why games are rarely used in routine diagnosis education.
9. A sustainability chapter comparing games with brochures as maintainable educational interventions.
10. A standard T1D Simulator game record and profile, included in the same catalogue and comparison views as every other product.
11. A methods page, evidence glossary and complete linked bibliography.

## 5. Scientific editorial standard

### 5.1 Citation behaviour

The rendered prose should use clear author-date citations such as **Nørlev et al. (2022)** and **(Reinders et al., 2024)**. Quarto should be configured with `link-citations: true`, `link-bibliography: true` and citation hover previews. The displayed author-year citation should link to the complete bibliography entry, and the bibliography entry should link directly to its Digital Object Identifier (DOI), PubMed Central record, PubMed record or another stable primary source. Quarto supports BibTeX/CSL bibliographies and Pandoc citation syntax ([Quarto, 2026d](https://quarto.org/docs/authoring/citations.html)).

Every substantive statement about learning, behaviour, psychological effects, clinical outcomes or product availability should have a nearby source. References should not be placed only at the end of a long paragraph containing several different claims.

Example source text:

```markdown
Nørlev et al. identified recurring combinations of feedback, simulation and
progression, but the included studies were heterogeneous and focused on children
aged 8-14 years [@norlev2022].
```

Expected rendered form:

> Nørlev et al. (2022) identified recurring combinations of feedback, simulation and progression, but the included studies were heterogeneous and focused on children aged 8-14 years.

### 5.2 Epistemic labels

Each analytical page should separate the following claim types visually and semantically:

| Label | Meaning |
|---|---|
| **Established** | Supported by convergent evidence appropriate to the claim |
| **Limited evidence** | Some empirical support, but constrained by sample, design, duration, endpoint or replication |
| **Design inference** | A reasoned implication derived from evidence but not directly tested in the proposed context |
| **Product claim** | Stated by a developer, sponsor or store listing without independent verification |
| **Hypothesis to test** | A falsifiable proposed explanation or intervention |
| **Unknown** | The available sources do not permit a responsible conclusion |
| **Idea** | Brainstorm material with no presumption that it should be implemented |

The visual treatment must not imply that an attractive interface increases evidential certainty. Evidence labels should be encoded as text as well as colour.

### 5.3 Evidence hierarchy

The evidence map should preserve study design rather than collapsing quality into a single score:

1. Controlled outcome studies, including randomised trials.
2. Pre/post, cohort and feasibility studies.
3. Usability studies and participatory co-design.
4. Development descriptions and conceptual frameworks.
5. Public products without peer-reviewed evaluation.
6. Marketing or developer claims without independent evidence.

Outcome domains must be recorded separately. A knowledge test is not evidence of practical transfer; satisfaction is not evidence of behaviour change; and an observed change in glycated haemoglobin (HbA1c) requires adequate design, sample size, duration and confounder control.

### 5.4 Page-level metadata

Every scientific page should display:

1. Author or responsible editor.
2. First publication date and last substantive update date.
3. Evidence-search cut-off date.
4. Review status: draft, internally reviewed, externally reviewed or archived.
5. Conflicts of interest and relevant project involvement.
6. Stable page identifier and suggested citation.
7. Scope limitations.

Abbreviations should be expanded at first use and collected in a site glossary. Specialist terms should receive concise functional definitions rather than general textbook digressions.

## 6. Game catalogue and profile model

### 6.1 Canonical record

Each product should have one canonical structured record. The current catalogue already contains most of the required fields and should be migrated rather than recreated. The new schema should include:

1. Stable identifier, title, aliases and release history.
2. T1D specificity, intended population, age range and user role.
3. Platform, region, language, device and account requirements.
4. Genre, learning objectives and core gameplay loop.
5. Game mechanics and proposed learning mechanisms.
6. Developer, owner, funder and organisation type.
7. Verifiable involvement of people with lived experience.
8. Evaluation studies, designs, samples, outcomes and limitations.
9. Availability, price, monetisation and verification date.
10. Official links, store links, archived pages, trial records and publications.
11. Screenshot provenance, copyright holder, licence and reuse status.
12. Design strengths, limitations and transferable lessons.
13. `not_playtested`, `desk_reviewed` or `playtested` status, with tester and date when applicable.
14. Record history and source-level provenance for material changes.

### 6.2 Standard game-profile page

Each rendered game page should answer the same questions in the same order:

1. What problem did the designers appear to address?
2. Who was the intended learner?
3. What does the player repeatedly do?
4. What is the intended learning mechanism?
5. What feedback connects action to consequence?
6. How were learning or clinical outcomes evaluated?
7. What is supported, untested or contradicted?
8. Who developed, funded and owns the product?
9. Can it currently be accessed, where, and at what cost?
10. What happened after the initial research or funding period?
11. Which ideas may transfer to other T1D games, and which contextual assumptions limit transfer?

Availability and price are point-in-time findings. Each page should therefore show a conspicuous **last checked** date and an **availability confidence** field.

## 7. Visual and graphical strategy

The site should be visually rich enough to support study without becoming an uncritical product gallery.

### 7.1 Visual types

1. **Representative game images:** one official screenshot or promotional image where public reuse is licensed or written permission has been obtained.
2. **Mechanic diagrams:** original diagrams showing the relationship between player action, simulated system state, feedback, explanation and retry.
3. **Evidence maps:** plots or matrices displaying evidence type, population, outcome domain and availability without combining them into a misleading score.
4. **Historical timelines:** release, study and discontinuation events, including changes in platforms and ownership.
5. **Comparative matrices:** consistent, accessible comparisons of audience, learning objectives, mechanics, evidence and present availability.
6. **Study-design figures:** visual explanations of feasibility studies, controlled trials, transfer tests and longitudinal evaluation.
7. **Sustainability diagrams:** dependency maps showing the technical, clinical, educational, organisational and financial capabilities required to keep a serious game alive.

### 7.2 Image and copyright policy

1. Never infer that an image is reusable merely because it can be viewed online.
2. Store the source URL, creator or copyright holder, retrieval date, licence, modifications and permission status for every image.
3. Commit third-party images only when reuse is compatible with the intended site licence or explicit permission has been retained.
4. During the private review phase, keep uncleared screenshots in a gitignored local directory.
5. If reuse is not cleared, show an **Image unavailable for republication** panel with a link to the official product page.
6. An original conceptual diagram of a game's published mechanics may be used when adequately sourced and clearly labelled as an analytical reconstruction. It must not imitate or falsely represent the game's actual interface.
7. Do not fabricate screenshots or use artificial intelligence to create substitute product images.
8. Provide descriptive alternative text, captions and source information for every published image.

Original figures should be stored as editable SVG with a short caption and source note. This will make later revisions possible when evidence or terminology changes.

## 8. Equal treatment of project-affiliated games

T1D Simulator should have one canonical game record and one standard game-profile page. The page should answer the same questions, expose the same metadata and undergo the same evidence assessment as every other product in the catalogue. Its position in tables, filters and comparative analyses should be determined by the same transparent rules used for all games.

The knowledge base should not mirror T1D Simulator's implementation documentation, code architecture, internal roadmap or model-specific decision records. Those materials belong in the simulator repository. The standard game profile may link to public technical documentation under the same developer-documentation field available to other open-source projects.

Only publicly implemented features should be described as product capabilities. Planned features may be omitted or, where historically relevant, identified as developer plans rather than product characteristics. Design sophistication, model detail and open-source status must not be presented as evidence of learning effectiveness.

Because the knowledge-base maintainer is involved in T1D Simulator, the game record should contain a conspicuous conflict-of-interest statement. When practical, substantive assessment of the game should receive independent review before public release.

## 9. Adoption and sustainability programme

The sustainability section should treat proposed explanations as hypotheses to investigate. It should compare serious games and brochures across production, review, procurement, distribution, localisation, technical dependencies, update costs and institutional accountability.

The analysis should map the dependencies required to maintain a T1D game:

1. Programming and platform maintenance.
2. T1D physiology and treatment-domain expertise.
3. Clinical review and safety communication.
4. Pedagogy and learning-science expertise.
5. Game design, user experience and accessibility.
6. Evaluation and statistical expertise.
7. Privacy, security, regulatory assessment and liability.
8. Funding, ownership, community management and succession.

Each historical game profile should ask whether the product survived the departure of a principal investigator, the end of a grant, an operating-system transition or a change in commercial strategy. Cross-case synthesis can then distinguish documented causes from plausible causes.

The repository itself should demonstrate survival practices through open formats, documented decisions, multiple maintainers where possible, contribution guidance, automated validation, release archives and a named succession procedure. Artificial intelligence may assist literature triage, link checking, code explanation and draft updates, but scientific claims and public changes require attributable human review.

## 10. Repository governance, licensing and integrity

### 10.1 Governance documents

Before public release, the repository should include:

1. `EDITORIAL-POLICY.md`: evidence rules, citation standard, correction policy and claim labels.
2. `GOVERNANCE.md`: roles, decision rights, maintainer succession and archived-project procedure.
3. `CONTRIBUTING.md`: how to propose a game, correct a record, add evidence or submit a design pattern.
4. `CITATION.cff`: how to cite the knowledge base and its releases.
5. `CHANGELOG.md`: substantive scientific, schema and availability changes.
6. Issue templates for new games, broken links, scientific corrections, accessibility problems and image-rights questions.
7. A conflict-of-interest declaration template for contributors and reviewers.

### 10.2 Licensing model

A dual-licence model should be considered before the repository becomes public:

1. A permissive software licence, such as MIT or Apache-2.0, for code and build tooling.
2. Creative Commons Attribution 4.0 (CC BY 4.0) for original written content and original figures.
3. Explicit exclusions for third-party images, publication figures and other content whose copyright is retained by its owner.
4. No redistribution of downloaded journal articles unless their licences clearly permit it.

The final licence choice should be made only after confirming whether all migrated content can legally be relicensed.

### 10.3 Responsible use of artificial intelligence

The editorial policy should record that:

1. AI output is not a scientific source.
2. AI-assisted extraction must be checked against the source document.
3. Every DOI, PMID, numerical result and quotation must be verified.
4. Automated availability checks require a verification date and must not be treated as proof of global access.
5. AI-assisted changes must preserve the distinction between evidence, inference, hypothesis and idea.
6. Named human reviewers remain responsible for published scientific conclusions.

## 11. Validation and continuous integration

Every pull request should run a small, deterministic validation pipeline:

1. Render the complete Quarto site from a clean checkout.
2. Validate every game and study record against its schema.
3. Verify that citation keys resolve and bibliography entries contain a DOI, PMID, PMCID or documented alternative stable link where available.
4. Check internal links and flag external link failures for manual assessment.
5. Check duplicate DOI, PMID, game identifiers and aliases.
6. Enforce required game fields, verification dates and image-provenance fields.
7. Reject unlabelled review-only images in the public build.
8. Run Markdown, spelling and terminology checks using a project dictionary.
9. Check headings, figure alternative text, colour-independent evidence labels and basic accessibility.
10. Upload the rendered site as a private workflow artefact during the private phase.

Quarto can publish through GitHub Actions, while GitHub's Pages deployment workflow supports a distinct build artefact and protected deployment environment ([Quarto, 2026e](https://quarto.org/docs/publishing/github-pages.html); [GitHub Docs, 2026](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)). The plan should retain this separation so that validation can run from the first commit without accidentally publishing the site.

## 12. Phased implementation roadmap

### Phase 0 - Decisions before repository creation

1. Confirm repository owner: personal account or organisation.
2. Confirm the working repository name and site title.
3. Confirm whether private collaborators need browser-based preview access.
4. Decide whether GitHub Pages will remain disabled throughout the private phase.
5. Choose provisional code and content licences, marked as non-final until the rights audit is complete.
6. Define the boundary between developer-oriented T1D foundations and the much broader physiology literature in the simulator repository.

**Exit criterion:** a one-page decision record approved by the repository owner.

### Phase 1 - Private repository scaffold

1. Create the private repository without importing the simulator's Git history.
2. Add Quarto configuration, navigation, theme, policies and directory structure.
3. Add a validation workflow but no active publication workflow.
4. Create one example scientific chapter, one game profile and one original figure.
5. Confirm local rendering and private build-artefact access.

**Exit criterion:** a fresh clone produces the same validated HTML site.

### Phase 2 - Structured migration

1. Convert the existing 44-game JSON catalogue into individually maintainable records.
2. Preserve stable identifiers and source provenance.
3. Convert the existing source index into bibliography entries and source-register records.
4. Restructure the serious-games review into web-native chapters.
5. Add redirects or stable aliases if page names change during migration.

**Exit criterion:** all current games and cited studies are represented without loss of required metadata.

### Phase 3 - Scientific and design modules

1. Complete the learning-science, game-design, outcome, human-factors and psychosocial chapters.
2. Add T1D developer foundations with explicit links to primary sources and clear scope limitations.
3. Add T1D Simulator through the standard game-record and game-profile workflow, without a separate implementation or case-study section.
4. Add adoption and sustainability analyses with documented and hypothetical explanations separated.
5. Add research gaps and an idea lab that cannot be mistaken for recommendations.

**Exit criterion:** every substantive claim is cited or explicitly labelled as inference, hypothesis, product claim or idea.

### Phase 4 - Visual system

1. Establish visual templates for game profiles, evidence maps, timelines and mechanic diagrams.
2. Produce original figures for the major conceptual chapters.
3. Complete image provenance records.
4. Seek permissions for high-value third-party screenshots where no suitable open licence exists.
5. Replace uncleared images with linked image-unavailable states before any public build.

**Exit criterion:** the public-build check contains no image with ambiguous reuse status.

### Phase 5 - Private scientific and developer review

1. Invite at least one T1D clinician or educator, one learning researcher, one game developer and one person with lived experience to review relevant sections.
2. Record disagreements and corrections rather than silently resolving substantive scientific disputes.
3. Test whether developers can locate a game, understand its evidence and extract a reusable design lesson.
4. Test keyboard navigation, mobile layout, contrast, alternative text and reading flow.

**Exit criterion:** critical scientific, safety, rights and accessibility findings are resolved or openly documented.

### Phase 6 - Publication decision

Choose one of three explicit paths:

1. **Public repository and public GitHub Pages:** simplest open-source model once the rights audit is complete.
2. **Private source repository and public site:** possible on an eligible GitHub plan, but confirm repository-plan and site-visibility behaviour before enabling Pages.
3. **Private repository and private website:** use an eligible GitHub Enterprise Cloud organisation or a separate authenticated hosting platform; ordinary private-repository status alone is insufficient.

Deployment should require manual approval until the publication model is stable.

### Phase 7 - Living maintenance cycle

1. Review broken links automatically and product availability manually.
2. Recheck active games at least every six months and historical games annually.
3. Record the search date whenever a topic review is updated.
4. Update existing topic pages before creating overlapping pages.
5. Publish versioned snapshots that can be cited.
6. Archive superseded interpretations while preserving change history.
7. Review governance and maintainer succession annually.

## 13. Acceptance criteria for the first public release

1. The site builds reproducibly from a clean checkout.
2. All scientific prose is written in high-level scientific English.
3. Author-year citations are visible, clickable and connected to stable bibliographic links.
4. All 44 migrated game records validate and retain provenance, audience, access, price, evidence and verification-date fields.
5. Evidence, product claims, design inferences, hypotheses and ideas are distinguishable.
6. Every published image has documented provenance and reuse permission; unavailable images have a consistent fallback state.
7. T1D Simulator has no privileged section and is analysed by exactly the same criteria as other games, with a conflict-of-interest statement and no unsupported effectiveness claims.
8. The website provides full-text search, responsive navigation, readable tables and keyboard access.
9. The methods, editorial policy, conflicts-of-interest process, correction route and update policy are public.
10. The repository contains no downloaded paywalled article, uncleared screenshot, personal health information, secret or private project note.
11. Automated validation and link checks pass.
12. A tagged release and `CITATION.cff` make the first public version citable.

## 14. Decisions still required from the owner

The following choices should be resolved before implementation begins:

1. Repository name and whether it belongs to a personal GitHub account or a new organisation.
2. Whether collaborators require a private browser-accessible website or whether local previews and workflow artefacts are sufficient.
3. Whether the eventual public model should expose both source and website or only the rendered website.
4. Preferred visual identity: related to T1D Simulator, clearly independent, or a neutral research-resource identity.
5. Whether T1D physiology should be a concise game-developer curriculum or a broader mirrored subset of the simulator's scientific knowledge base.
6. Whether public contributions should open immediately at launch or after a curated initial release.
7. Who may provide the first clinical, learning-science, development and lived-experience reviews.

## 15. Recommended first implementation slice

The first implementation should be deliberately small but structurally complete:

1. Private repository and Quarto scaffold.
2. Home, methods and glossary pages.
3. Searchable catalogue index generated from five representative migrated game records.
4. One complete game profile with a cleared or deliberately unavailable image state.
5. One chapter on **Predict -> Act -> Observe -> Explain -> Retry -> Vary**.
6. A second standard game profile demonstrating that project-affiliated and independent games use identical evidence-status labels and page structure.
7. One original SVG figure.
8. Bibliography with working author-date links.
9. Validation workflow and downloadable private HTML artefact.

This slice tests the repository's difficult architectural requirements before all 44 game records and the full review are migrated.

## References

[GitHub Docs (2026) “Changing the visibility of your GitHub Pages site.”](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)

[GitHub Docs (2026) “Using custom workflows with GitHub Pages.”](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

[Nørlev, J. et al. (2022) “Game mechanisms in serious games that teach children with type 1 diabetes how to self-manage: A systematic scoping review”, *Journal of Diabetes Science and Technology*, 16(5), pp. 1253-1269.](https://pubmed.ncbi.nlm.nih.gov/34024156/)

[Quarto (2026a) “Website navigation.”](https://quarto.org/docs/websites/website-navigation)

[Quarto (2026b) “Cross references.”](https://quarto.org/docs/authoring/cross-references)

[Quarto (2026c) “Website search.”](https://quarto.org/docs/websites/website-search.html)

[Quarto (2026d) “Citations.”](https://quarto.org/docs/authoring/citations.html)

[Quarto (2026e) “GitHub Pages.”](https://quarto.org/docs/publishing/github-pages.html)

[Reinders, E. et al. (2024) “Serious digital games for children and adolescents with type 1 diabetes: Evidence and accessibility”, *Diabetes Research and Clinical Practice*, 217, 111833.](https://doi.org/10.1016/j.diabres.2024.111833)

## Abbreviation glossary

| Abbreviation | Meaning and relevance |
|---|---|
| AI | Artificial intelligence. In this project, AI may assist maintenance and evidence processing but is not treated as an evidential source. |
| CC BY 4.0 | Creative Commons Attribution 4.0 International. A candidate licence for original written and graphical content. |
| CI | Continuous integration. Automated checks run when repository content changes. |
| CSL | Citation Style Language. A structured format that controls how citations and reference lists are rendered. |
| DOI | Digital Object Identifier. A persistent identifier used to link to scholarly publications. |
| HbA1c | Glycated haemoglobin. A clinical measure reflecting average glycaemia over approximately two to three months. |
| HTML | HyperText Markup Language. The primary rendered format of the website. |
| PMCID | PubMed Central identifier. An identifier for a full-text article archived in PubMed Central. |
| PMID | PubMed identifier. A stable identifier for a record in the PubMed database. |
| SCSS | Sassy Cascading Style Sheets. A maintainable source format compiled into website styling. |
| SVG | Scalable Vector Graphics. An editable vector format suitable for diagrams and accessible scientific figures. |
| T1D | Type 1 diabetes. The principal disease context of the knowledge base. |
| UX | User experience. The quality and usability of a person's interaction with a product or service. |
