# Serious Games for Type 1 Diabetes Education and Self-Management: Evidence, Availability, and Design Lessons

**A structured scoping review and evidence map**  
**Search closed:** 24 August 2026  
**Scientific source language:** English  
**Intended readership:** clinicians, researchers, health-game designers and advanced readers  
**Companion data:** [`t1d-games-catalog.json`](../game-literature/t1d-games-catalog.json) and [`SOURCES.md`](../game-literature/SOURCES.md)

## Abstract

Serious games are proposed as a means of converting type 1 diabetes (T1D) education from passive information delivery into active, repeatable and emotionally tolerable practice. This structured scoping review uses Nørlev et al.'s mechanism review as an anchor, retrieves or documents the status of all 18 included game-related articles, cross-checks forward citations in two indexes, and independently maps research and public products through 24 August 2026. Forty-four games, prototypes and explicitly labelled adjacent products were catalogued.

The evidence supports a limited but useful conclusion. Serious games can be acceptable and can improve short-term, test-proximal knowledge or procedural performance. A small randomised trial of Packy & Marlon reported improvements in self-care and parent communication but not glycated haemoglobin (HbA1c) or diabetes knowledge. A 30-child trial of the Koodak-e-Tavana injection game found reduced observed injection distress after one week. Several recent single-group studies report large immediate knowledge changes, but lack of control groups, ceiling effects and short follow-up prevent causal or durable-effect claims. A 2025 randomised study of a combined digital game and animation reported favourable quality-of-life and HbA1c differences, but the abstract does not report the magnitude and the game cannot be separated from the animation. A mixed-diabetes meta-analysis found no statistically significant HbA1c effect (mean difference −0.09 percentage points, 95% confidence interval −0.29 to 0.10; P=.36).

Availability is a separate failure point. Reinders et al. found that 21 of 23 research-origin games were not publicly available in 2024, while app-store products were more accessible but generally unevaluated. The present audit identifies modern public products—notably Level One, AvaType1, FlightGlucose, MyDiabetic, Rufus, GlucoZor, Novi-Chek and Sweet Strategy—but no product combines public, low-friction access; mechanistically deep simulation; independent comparative evaluation; long-term maintenance evidence; broad language coverage; and demonstrated transfer to unfamiliar self-management scenarios.

T1D Simulator occupies a distinctive but currently unevaluated position: it is a public browser-based causal simulation using fixed fictional characters, Campaign and Box Challenge modes, an optional counterfactual “What If” view and a documented mechanistic glucose model. Its relative strengths are systems-level causal exploration, no dependence on personal health data, and potential coverage of interacting food, insulin, activity, sleep and stress mechanisms. Its principal liabilities are the absence of peer-reviewed user-outcome evidence, a broader and potentially more cognitively demanding interface than microgames, limited formal co-design evidence, and no demonstrated educational transfer or sustained engagement. These are design and evaluation priorities, not claims of superiority.

## 1. Executive synthesis

### 1.1 Principal conclusions

1. **The field demonstrates short-term learning more often than durable competence.** Knowledge gains are common when post-tests closely resemble the game content. Far fewer studies test delayed retention, transfer to unfamiliar scenarios, behaviour outside the game or clinical outcomes.
2. **Acceptability is not effectiveness.** High usability scores, satisfaction and completion indicate that an intervention can be used; they do not establish that it changes self-management or HbA1c.
3. **The best early controlled evidence was behavioural and relational.** Packy & Marlon improved reported self-care and parent communication without improving HbA1c or knowledge. This pattern is consistent with games influencing rehearsal, confidence and conversation before measurable physiology.
4. **Anxiety-focused games may have a narrower, more testable causal pathway.** Koodak-e-Tavana targeted one stressful procedure—insulin injection—and reported reduced observed distress. Narrow goals can be evaluated more credibly than claims that one game improves “diabetes management” globally.
5. **Clinical benefit remains unestablished for the category.** The pooled HbA1c estimate from broader diabetes game studies was small and non-significant. One recent T1D randomised trial is promising but compound and underreported.
6. **The research-to-publication pipeline frequently stops before public delivery.** Research prototypes commonly disappear when grants, trials or student projects end. The 2024 accessibility audit is unusually important because it tested whether named games could actually be obtained.
7. **Public products and evaluated products are largely different sets.** Current app-store games may be attractive and maintained but lack independent trials. Evaluated academic prototypes may have publications but no public build, support channel or maintenance owner.
8. **Adults, newly diagnosed people and caregivers are underserved.** The Nørlev review focused on ages 8–14, and much subsequent research remains paediatric. Adult simulation, family co-learning and diagnosis-stage emotional needs receive less sustained attention.
9. **Experiential games are under-indexed.** Small independent works about chronicity, interruption, identity and distress may contribute empathy and recognition even when they do not teach dosing or physiology. They require a separate evidence vocabulary.
10. **A useful public directory should report uncertainty, not merely list titles.** Current availability, price, language, region, provenance, evidence level, personal-data use and verification date are necessary fields.

### 1.2 What is established, plausible, unsupported or unknown

| Epistemic category | Conclusion |
|---|---|
| **Established** | Games can deliver repeated interactive practice; several small studies show immediate knowledge/procedure gains; individual products can be acceptable; research-game public availability is poor. |
| **Plausible, with partial evidence** | Well-aligned simulations can strengthen causal mental models; narratives can support identification and discussion; narrow procedural games can reduce task-related distress; caregiver play can support communication. |
| **Unsupported as a general claim** | “Gamification” reliably improves HbA1c; high satisfaction proves learning; app-store ratings demonstrate clinical benefit; a realistic model automatically produces understanding. |
| **Unknown** | Which mechanisms produce durable transfer; optimal dosing and duration of play; comparative effectiveness between game genres; effects in newly diagnosed adults; long-term harms, disengagement and equity; whether any currently public T1D game improves clinical outcomes independently. |

## 2. Definitions and conceptual boundaries

A ==serious game== is a complete game whose primary intended outcome extends beyond entertainment, for example knowledge, procedural competence, coping or professional training. The “serious” purpose does not require a sombre tone and does not guarantee educational quality.

==Gamification== is the use of selected game-design elements—points, badges, streaks, quests or leaderboards—in a non-game activity. A quiz with points may be gamified education without being a coherent game. This distinction matters because many diabetes apps reward logging but do not create a model in which the player can reason about consequences.

A ==simulation== is an interactive representation of a system. A simulation may become a serious game when it adds goals, constraints, progression, feedback and meaningful player agency. Physiological fidelity and pedagogical fidelity are distinct: a model can be scientifically sophisticated yet educationally opaque, or simplified yet highly effective for a carefully bounded learning objective.

An ==experiential game== is designed primarily to represent what an experience feels like or demands, including interruption, uncertainty, identity or social burden. Its appropriate outcomes may be empathy, recognition or reflection rather than factual knowledge or HbA1c.

==Transfer== denotes successful application of learning beyond the practised task. Near transfer applies to similar examples; far transfer applies to unfamiliar situations or real-world behaviour. Immediate recall is not transfer.

==Self-efficacy== is confidence in one's capability to perform a specified behaviour. It should not be conflated with general enjoyment or factual knowledge. ==Diabetes distress== is the emotional burden specifically associated with living with and managing diabetes; it is not synonymous with depression or anxiety disorder.

## 3. Methods

### 3.1 Review design

This work is presented as a structured scoping review and evidence map, not a formal systematic review. It uses reproducible query families, explicit inclusion categories, dual-index forward-citation checking, DOI/PMID/title deduplication, full-text status tracking and a structured product catalogue. It was not prospectively registered; screening was conducted by one reviewing agent; and a second independent reviewer did not duplicate selection or extraction.

### 3.2 Anchor and extension strategy

Nørlev et al. searched to 23 September 2020 and addressed game mechanisms for children aged 8–14. The anchor was used for backward chaining and for a complete acquisition audit of its 18 included game-related articles. It was not assumed to be exhaustive outside that age band or after the cutoff.

Forward citations were cross-checked through OpenAlex and Semantic Scholar and supplemented with exact-title/DOI searches. OpenAlex returned 36 raw citing records and Semantic Scholar 24. The discrepancy was retained because index coverage differs; citing records were then classified as updated reviews, new interventions/outcomes, design/theory extensions or peripheral citations.

Independent searches covered PubMed/PubMed Central (PMC), Crossref/OpenAlex, JMIR, the Association for Computing Machinery (ACM), the Institute of Electrical and Electronics Engineers (IEEE), ClinicalTrials.gov, app stores, official product sites and independent distribution platforms through 24 August 2026. Full queries, dates, eligibility rules, the 18-article status table and image provenance are in `SOURCES.md`.

### 3.3 Evidence and product-status coding

Outcome evidence was separated into controlled studies; uncontrolled pre/post and feasibility studies; usability and participatory co-design; development/conceptual descriptions; public products without peer-reviewed evaluation; and marketing/developer claims. Product accessibility was coded independently as public, region/device limited, study-only, prototype, archived, discontinued or uncertain.

No game was playtested during this phase. Gameplay descriptions derive from publications, official listings and documented media. Accordingly, the catalogue records `not_playtested` for every product. This prevents desk research from being mistaken for direct usability assessment.

## 4. Historical development and recurrent design patterns

### 4.1 Console era: complete games, limited distribution

Captain Novolin (1992) and Packy & Marlon (1994) were complete Super Nintendo Entertainment System (SNES) games rather than short clinical exercises. Captain Novolin combined platform action with food collection, insulin and questions. Packy & Marlon integrated diabetes tasks into an adventure featuring elephant protagonists. Their value was cultural as well as educational: diabetes knowledge appeared inside a mainstream entertainment form rather than only in a clinic booklet.

The designs also expose persistent problems. Educational questions could interrupt rather than constitute play. Food was often moralised as good or bad. Hardware distribution was costly, localisation limited and updates effectively impossible after cartridge release. Both titles are now obtainable only through collector markets or legally sourced archival environments.

Packy & Marlon remains consequential because it was evaluated. In 59 participants aged 8–16 over six months, Brown et al. reported improved parent communication (P=.025) and self-care (P=.003), with a non-significant trend in urgent visits (P=.08), but no difference in diabetes knowledge or HbA1c. The result does not justify a clinical-effect claim; it suggests that contextual rehearsal and conversation may change before knowledge tests or physiology.

### 4.2 Device-linked reward systems

GlucoBoy, DIDGET and Monster Manor linked real glucose checks to game rewards. This architecture can make an aversive or repetitive action immediately consequential. It can also optimise the proxy—logging or checking—without teaching interpretation. Proprietary hardware, accounts and sponsor support created fragile dependencies. Monster Manor, despite strong organisational partners, was no longer publicly available by the 2024 audit.

### 4.3 Academic prototype era

From approximately 2010 onward, research diversified into food quizzes, augmented reality (AR), mobile coaching, social learning, virtual pets, participatory frameworks and robot-assisted ecosystems. These projects generated useful requirements and mechanism descriptions. However, most were not maintained as public products. Reinders et al.'s audit found that 21 of 23 research-origin games were unavailable; no identified web or personal computer (PC) research game could be located.

The recurrent academic pattern is: co-design or feasibility study; a small, short evaluation; publication; then loss of the build, server, app signing credentials or institutional owner. This is not evidence that research teams were negligent. Public maintenance requires funding, privacy governance, support, platform updates, localisation, liability decisions and organisational ownership—deliverables that conventional grants and papers seldom reward.

### 4.4 Contemporary public products

Current public offerings divide into several models:

1. **Micro-level causal games:** Level One presents short glucose-management puzzles with progressive difficulty.
2. **Broad educational simulations:** AvaType1, FlightGlucose and MyDiabetic cover multiple self-management topics through simulation, scenarios or daily-life routines.
3. **Character-care systems:** Rufus and GlucoZor use a persistent companion to support younger children.
4. **Educational utilities with mini-games:** Novi-Chek and Sweet Strategy combine reference content, food tools and game elements.
5. **Gamified management services:** eddii links a character and rewards to real monitoring and commercial virtual care; it is adjacent to, not equivalent to, a stand-alone serious game.
6. **Independent experiential games:** Hell Hath No Insulin, Permanence and Holesome represent aspects of living with T1D that biomedical databases rarely index.

Public access is improving, but evaluation has not caught up. Store ratings and download counts provide adoption signals, not estimates of learning, behaviour or safety.

## 5. Learning, motivational and psychological mechanisms

### 5.1 Simulation and deliberate practice

==Deliberate practice== is repeated performance of a defined task with informative feedback and opportunities to correct errors. T1D is well suited to low-consequence simulation because many important relationships are dynamic: carbohydrate appearance, subcutaneous insulin action, activity effects and delayed responses unfold over different time scales. Real-life trial and error is slow, confounded and potentially unsafe; a simulation can compress time and permit reset.

Educational value depends on alignment. The player must make the decision that the learning objective concerns, observe a legible consequence, and receive enough explanation to distinguish mechanism from coincidence. If a player can win through rapid clicking, memorising a level script or exploiting a scoring rule, performance may not reflect a causal mental model.

Short puzzle structures such as Level One can minimise cognitive load and support repeated mastery. Broad simulators can expose interactions and delayed effects but require scaffolding, visual explanation and a carefully staged curriculum. Neither structure is intrinsically superior; they address different forms of learning.

### 5.2 Feedback and explanatory causal models

Outcome feedback (“glucose rose”) is insufficient when several causes are possible. ==Explanatory feedback== identifies the relevant relationship, for example that rapid insulin is still active, activity increased disposal, or fat delayed glucose appearance. Feedback should be proximal enough to support attribution but should not eliminate productive prediction.

A useful loop is: predict, act, observe, explain, retry and vary. Prediction makes the learner's prior model explicit. Variation tests whether the learner can generalise rather than repeat a solution. Counterfactual comparison—replaying the same situation with one changed action—is particularly valuable for delayed systems.

### 5.3 Narrative and character identification

Narrative can supply purpose, social context and memory cues. Packy & Marlon embedded self-care in an adventure; I Got This represented diagnosis and everyday life; emoTICare uses a time-travel adventure for socioemotional skills. Characters can also create psychological distance: a newly diagnosed player may find it easier to help a fictional character than to be told that every error is personally theirs.

Narrative is not automatically educational. If plot and learning task are separable, players may treat educational interruptions as a toll for accessing the game. Character identification should be evaluated for the intended age and culture rather than assumed.

### 5.4 Progression, goals and difficulty

Goals focus attention; levels sequence prerequisites; difficulty supports mastery when the challenge remains achievable. Guan et al. found goals, challenges and “fun” in 96% of included interventions, but only 35% used social features and 70% reported no explicit theoretical basis. Feature frequency is not evidence of causal value.

Progress should represent growing competence rather than only accumulated activity. Unlocking an advanced scenario because a player demonstrated transfer is more defensible than unlocking it after an arbitrary number of taps. Failure should produce diagnostic feedback and a low-friction retry, not shame or catastrophic framing.

### 5.5 Repetition and retrieval practice

==Retrieval practice== strengthens memory by requiring recall rather than re-reading. Quizzes can be useful when spaced, varied and followed by corrective feedback. They are weaker when attached to an unrelated game or when immediate post-test items reproduce the same questions. Procedural and scenario-based retrieval—selecting an action in context—is more proximal to self-management competence than factual recall alone.

### 5.6 Social learning and caregiver participation

Children's diabetes management occurs within families, schools and clinical teams. Qare and Qure, PAL and the Norwegian social platform explicitly represented shared roles. Packy & Marlon's parent-communication result provides limited controlled evidence that a game can change conversation.

Social systems introduce material risks: disclosure of health information, moderation, comparison pressure, safeguarding and unequal family availability. A caregiver mode or shared debrief can deliver social learning without an open social network. The intended role of each participant should be explicit.

### 5.7 Coping, resilience and distress

Most early games focused on knowledge or routine adherence. Koodak-e-Tavana targeted injection distress through simulated procedural rehearsal; emoTICare targets illness perception, emotional awareness and social skills; experiential games address chronicity and interruption. These objectives require measures distinct from knowledge tests.

Games should not frame distress as a failure to be sufficiently motivated. They can normalise difficulty, offer controllable practice and support reflection, but they are not substitutes for psychological care. Claims about resilience or distress require validated instruments, adequate controls and follow-up.

### 5.8 Ethical motivational design

The objective is voluntary learning, not maximal screen time. Streak loss, variable-ratio rewards, social pressure and punitive notifications can produce compulsion or guilt. This is particularly problematic where the game is linked to real glucose data or a child's care tasks. Ethical design supports autonomy, permits stopping, avoids monetising health anxiety, and clearly separates fictional simulation from personal treatment advice.

## 6. Evidence by outcome domain

### 6.1 T1D knowledge

Immediate knowledge is the most frequently positive outcome. DiaPed reported a rise from 29.8±6.02 to 68.6±1.58 out of 70 (P<.001; reported d=6.72). Tangbao Superman Transformation reported significant improvements across educational domains (all P<.001; standardised effects 0.78–1.27). MyDiabetic reported improvement after one week.

These findings are compatible with learning, but effect size is not equivalent to evidential strength. DiaPed's post-test clustered near the maximum, creating a marked ceiling effect, and lacked a control group. Tangbao was also uncontrolled. Repeated exposure to the same or closely aligned questions, attention from researchers and regression can inflate pre/post changes. Delayed testing and parallel-form assessments are needed.

Packy & Marlon did not improve diabetes knowledge despite behavioural changes. This should not be interpreted as failure: it demonstrates that knowledge instruments and practical outcomes are not interchangeable.

### 6.2 Practical self-management competence

Evidence is limited but more informative when tasks are specific. The Koodak-e-Tavana game rehearsed insulin injection and reduced observed behavioural distress in a 30-child randomised one-week study (within intervention P=.001; between groups P=.03). Packy & Marlon improved reported self-care (P=.003). These outcomes are closer to behaviour than a fact quiz, although each trial was small and context-specific.

Many studies describe “self-management” without objective performance assessment. A more rigorous test would present a novel scenario, require the player to explain the causal basis for an action, score procedural safety and repeat assessment after a delay.

### 6.3 Transfer to unfamiliar scenarios

Direct evidence of transfer is sparse. Most interventions test the material they teach, soon after exposure. Simulation has theoretical advantages for transfer because it can vary meals, timing, activity and uncertainty while preserving underlying principles. That advantage remains a hypothesis until tested against unfamiliar cases and, where appropriate, observed real-world behaviour.

### 6.4 Self-efficacy and autonomy

Packy & Marlon reported a trend for self-efficacy (P=.07), not conventional statistical significance. Several feasibility studies report confidence or perceived competence, but small samples and multiple outcomes limit inference. Autonomy is also a design property: optional exploration, reversible choices and transparent explanations may support agency even before an outcome effect is demonstrated.

### 6.5 Diabetes distress, coping and injection-related anxiety

The strongest narrow result is Koodak-e-Tavana's reduction in observed injection distress. emoTICare's n=44 quasi-experimental study reported reduced perceived illness threat and preliminary changes in emotional awareness/social skills. These findings justify further trials, not a general claim that serious games reduce diabetes distress.

Experiential games may support recognition and empathy, but no peer-reviewed outcome evaluation was located for the independent titles catalogued here. Their value should be described as artistic and experiential unless measured otherwise.

### 6.6 Engagement and sustained use

Tangbao reported 95% completion and a child System Usability Scale score of 86/100 over four weeks. WeCan reported 82% satisfaction among respondents but only 20 of 31 intervention participants completed (64.52%). The contrast demonstrates why satisfaction among completers can coexist with substantial attrition.

App-store ratings, downloads and positive testimonials measure neither representative engagement nor learning. Minimum reporting should include exposure offered, starts, active return, completion, reasons for discontinuation and usage distribution—not only means among completers.

### 6.7 Behaviour and clinical endpoints

Packy & Marlon improved reported self-care and communication but not HbA1c. The 2025 Turkish single-blind randomised trial (n=55) reported higher quality of life and a favourable HbA1c direction in the combined digital-game/video group versus control (P<.05). The abstract does not provide the HbA1c magnitude, and the game effect cannot be isolated from animation.

Yao et al.'s meta-analysis across diabetes types found no significant HbA1c effect: mean difference −0.09 percentage points (95% confidence interval −0.29 to 0.10; P=.36; I²=37%; seven studies, n=607). Physical activity improved (standardised mean difference 0.84, 95% confidence interval 0.30–1.38; P=.002), but heterogeneity was high (I²=85%) and the set included exergames and mixed diabetes populations.

The responsible conclusion is therefore: games may improve selected proximal educational or behavioural outcomes; clinical benefit for T1D serious games as a class has not been demonstrated.

### 6.8 Evidence ladder and claim discipline

| Observation | Permitted conclusion | Conclusion not permitted |
|---|---|---|
| Users rate a game highly | Acceptable to surveyed users | Effective education or treatment |
| Immediate post-test rises | Test-proximal learning occurred or is compatible with the data | Durable competence or transfer |
| Logging increases | The rewarded action increased | Understanding or safer management improved |
| HbA1c changes in a compound intervention | The combined intervention may have affected HbA1c | The game component caused the change |
| A mechanistic model is validated against literature | The simulated relationships meet specified model tests | Users understand them or will change behaviour |

## 7. Accessibility, sustainability and routine-care adoption

### 7.1 The accessibility paradox

Reinders et al. reviewed 21 studies, 23 research games and 13 app-store games. Twenty-one of 23 research-origin games were not public. None of the identified web/PC research games could be located; only one of 11 research mobile games was free in Google Play. Conversely, all 13 app-store games were visible in iOS, five in Google Play and 11 were free, but the public products generally lacked peer-reviewed evaluation.

Thus, peer review and public access are negatively coupled in much of the observed field: evaluated products disappear, while maintained products are not evaluated. This is a structural property of funding and publication systems, not a verdict on a particular developer.

### 7.2 Why serious games are rarely offered at diagnosis

The literature and product audit support several system-level barriers:

1. **No stable procurement object.** A clinician cannot recommend a prototype that requires a trial login, obsolete device or non-existent server.
2. **Weak product-level evidence.** Reviews aggregate heterogeneous games, ages, mechanisms and outcomes. This rarely tells a clinic which current product to use for which learner.
3. **Paediatric concentration.** Child-focused designs may appear irrelevant or patronising to newly diagnosed adults.
4. **Guideline mismatch.** Clinical guidelines specify education content and multidisciplinary support but rarely evaluate named games with current versions and regional availability.
5. **Maintenance and localisation costs.** Operating-system updates, accessibility, translations, support and clinical-content review continue after the research grant ends.
6. **Privacy and liability.** Apps linked to real glucose or insulin data create data-protection, security, medical-device and professional-trust questions.
7. **Workflow constraints.** Diagnosis education is time-critical and emotionally demanding. Staff need a short, reliable, explainable resource that fits existing teaching, not another unsupported platform.
8. **Discovery failure.** Public products are inconsistently indexed. Biomedical databases omit indie games; app stores provide weak evidence metadata; academic papers omit surviving access links.
9. **Professional trust.** Games may be perceived as trivialising a serious condition, especially when food is moralised, failure is punitive or scientific provenance is unclear.
10. **Equity.** Hardware, language, age, reading level, sensory accessibility and regional stores determine who can use the product.

These barriers plausibly explain why modern interactive learning is not routinely presented during diagnosis education. They cannot establish why any individual clinical team did or did not offer a game to a particular person.

### 7.3 Availability snapshot

| Product | Core purpose | Public status, 24 Aug 2026 | Cost/status caveat | Peer-reviewed product outcome evidence |
|---|---|---|---|---|
| Level One | Short causal glucose puzzles | iOS/Android | Free; account; region completeness uncertain | None located |
| AvaType1 | Broad child-focused education/simulation | iOS/iPadOS | Free; English; new product | None located |
| FlightGlucose | Browser scenario simulation | Public web/PWA | Free-for-patients claim; provenance/evaluation incomplete | None located |
| MyDiabetic | Daily-life child simulation | iOS/Android | Free; English/Czech | Co-design and short feasibility evidence |
| Rufus | Character care and procedures | iOS/Android/Amazon | Free app; optional physical bear | No controlled product trial located |
| GlucoZor | Child education ecosystem | Official French site | Free claim; current store access uncertain | Development/evaluation evidence limited |
| Novi-Chek | Teen/young-adult education and mini-games | French Android listing | Free; regional/language limited | No controlled product trial located |
| Sweet Strategy | Food/daily-life education and mini-games | Taiwan iOS listing | Free; Traditional Chinese; regional | No controlled product trial located |
| Monster Manor | Rewarded glucose checks | Discontinued | Formerly free | Development description only |
| Packy & Marlon | Narrative self-care adventure | Discontinued SNES | Collector/historical access | Small six-month randomised trial |

## 8. Comparative Positioning of T1D Simulator

### 8.1 Purpose and comparison method

This chapter compares the present T1D Simulator project with representative products, not with an imagined ideal. T1D Simulator features were verified from the repository's intended-purpose document, interface and Campaign configuration. Comparator features derive from publications and official product material; none of the products, including T1D Simulator, was directly playtested during this review.

The comparison separates four evidence bases:

1. **Verified implementation:** a feature is present in the current repository or documented public product.
2. **Direct evidence:** a T1D game study measured the relevant outcome.
3. **Adjacent evidence or industry practice:** a plausible design pattern is supported outside a directly comparable T1D trial.
4. **Design inference:** a recommendation follows from alignment between the product architecture and learning objective but remains untested.

T1D Simulator is not entered into an effectiveness ranking. It has no peer-reviewed user-outcome study, while many public comparators are equally unevaluated and several research comparators are inaccessible. A feature-rich system should not be described as superior to a smaller game unless comparative evidence supports that conclusion.

### 8.2 What T1D Simulator currently is

The project is a browser-based educational game for exploring glucose-regulation mechanisms through fixed fictional characters. It deliberately does not ingest personal continuous glucose monitor (CGM), insulin, weight, insulin sensitivity factor or insulin-to-carbohydrate ratio data. The public interface allows the player to act on a predefined character and observe simulated consequences.

The implemented public learning structures include:

1. **Campaign:** staged scenarios with objectives, tips, progression and star ratings based partly on time in range.
2. **Box Challenge:** a bounded daily challenge structure with obstacles and limited lives.
3. **What If:** a restricted counterfactual view opened from an active Campaign or Box Challenge session; the player can alter already played actions and compare the simulated course without changing the original session.
4. **Mechanistic breadth:** food, rapid and basal insulin, activity, stress, sleep-related effects, hypoglycaemia, hyperglycaemia and diabetic ketoacidosis are represented in the documented model scope.
5. **Fixed fictional characters:** the learning target is a model subject, not a personal treatment recommendation.

This architecture makes T1D Simulator a causal systems-learning environment rather than a quiz, adherence reward system or real-data management app.

### 8.3 Comparative matrix

| Dimension | T1D Simulator | Level One | MyDiabetic | FlightGlucose | Rufus / Jerry | Packy & Marlon | emoTICare | Academic prototypes as a group |
|---|---|---|---|---|---|---|---|---|
| Primary learning form | Mechanistic simulation plus scenarios | Short causal puzzles | Daily-life care simulation | Compressed scenario simulation | Character care/procedural play | Narrative adventure | Socioemotional narrative | Heterogeneous, often one mechanism |
| Access | Browser; no installation | iOS/Android | iOS/Android | Browser/PWA | Mobile; optional toy | Discontinued SNES | Trial-only | Usually unavailable |
| Personal health data | Deliberately excluded | No real-data dependence identified | No real-data dependence identified | No personal-data requirement claimed | May log tasks, not necessarily clinical data | None | Research data | Variable |
| Curriculum breadth | High: interacting physiology and daily factors | Moderate/high, level-based | High procedural breadth | High scenario breadth | Child procedures and routines | Contextual self-care | Coping/social-emotional | Usually narrow to moderate |
| Session granularity | Broad interface plus levels/challenges | Very short levels | Routine/task sequences | Scenario sessions | Short tasks/stories | Longer adventure play | Structured intervention sessions | Variable |
| Counterfactual comparison | Explicit What If feature | Retry/level variation | Limited/unclear | Scenario replay | Limited | Limited | Not central | Rarely explicit |
| Narrative/character identity | Fixed characters; campaign framing | Light | Strong daily-life character | Limited scenario framing | Strong | Strong | Strong | Variable |
| Caregiver role | Intended audience; limited explicit paired play | Explicit audience | Peers included in design | Possible learner/caregiver use | Strong family orientation | Parent communication measured | Not primary | Qare/Qure and PAL explicit |
| Psychological coping | Indirect through safe experimentation; no validated intervention | Not primary | Some daily-life context | Crisis/scenario focus | Normalisation through care | Relational/contextual | Primary target | Koodak targets procedure distress |
| Peer-reviewed product outcomes | None | None located | Short co-design/feasibility | None located | None controlled located | Small randomised controlled trial (RCT) | Small quasi-experimental study | Often feasibility only |
| Clinical endpoint evidence | None | None | None | None | None | No HbA1c effect | None | Rare and heterogeneous |
| Maintenance model | Active open project | Commercial/nonprofit partnership | Academic/public app | Independent public site | Commercial/nonprofit | Historical commercial | Grant/trial | Commonly grant-limited |

### 8.4 Relative strengths of T1D Simulator

**1. Mechanistic and temporal integration (verified implementation; design inference).** Many games teach isolated facts, procedures or a simplified single relationship. T1D Simulator is designed to show interacting effects over time. This creates an opportunity to learn why the same meal or activity can produce different trajectories under different conditions. The opportunity is not proof that players perceive the intended mechanisms.

**2. Counterfactual reasoning (verified implementation; adjacent evidence).** The What If view operationalises a strong learning loop: retain the situation, alter a prior action and compare outcomes. This is closer to causal inquiry than replaying an unrelated quiz. Adult WST research supports the relevance of counterfactual simulation, but does not validate the T1D Simulator implementation.

**3. Separation from personal treatment data (verified implementation; safety/design inference).** Fixed fictional characters allow concrete insulin actions inside the game while avoiding personal dose calculation. This reduces privacy, device-integration and individualised-treatment risks that accompany gamified management services. It also limits personal realism, so the distinction must remain prominent.

**4. Browser access and platform longevity (verified implementation; industry practice).** A static browser application can avoid app-store region restrictions, installation and proprietary hardware. It still requires maintenance, accessibility testing and stable hosting. “Runs in a browser” does not guarantee low onboarding friction.

**5. Multiple learning modes (verified implementation; design inference).** Campaign supplies scaffolding and goals; Box Challenge adds bounded tension; What If supports reflection. Few comparators combine all three. The cost is choice complexity and a risk that new users encounter too many decisions before meaningful play.

**6. Open scientific inspectability (verified implementation).** The model and intended purpose are documented in the repository. Public inspectability supports scientific critique and correction, although it is not equivalent to independent validation or clinical endorsement.

### 8.5 Relative weaknesses and risks

**1. No user-outcome evidence (direct evidence gap).** T1D Simulator has not demonstrated knowledge gain, transfer, self-efficacy, distress reduction, sustained use or clinical benefit. This is the most important difference from Packy & Marlon, Koodak-e-Tavana and evaluated modern prototypes. Model validation and software tests answer different questions.

**2. Potential onboarding and cognitive-load disadvantage (verified complexity; design inference).** Level One's micro-level loop and Rufus's concrete character-care tasks communicate an immediate action. A broad simulator asks the player to understand controls, time compression, a graph, character state, objectives and interacting physiological concepts. The project owner's concern about too many clicks before play is therefore consistent with the comparative architecture, even before formal usability testing.

**3. Limited documented participatory co-design (evidence gap).** Nørlev's prototype, MyDiabetic, PAL and Sparapani's framework systematically elicited child or family requirements. T1D Simulator has a lived-experience origin and iterative development, but this review did not locate a documented, methodical co-design programme spanning children, newly diagnosed adults, caregivers and clinicians.

**4. Reward validity (design risk).** Time-in-range stars and points can focus attention, but they may also teach optimisation of the game score rather than explanation of mechanisms. A high score should not imply that a fictional action is a transferable personal dose. Scoring should reward prediction, explanation, recovery and learning—not only the final trace.

**5. Breadth can obscure the lesson (design risk).** Scientific model breadth is valuable for advanced exploration but can produce ambiguous attribution. Beginner scenarios should constrain degrees of freedom, make the active mechanism legible and introduce interactions progressively.

**6. Psychological scope is limited (comparison finding).** emoTICare and experiential indie games treat illness perception, emotion and identity as primary content. T1D Simulator primarily teaches physiology and management causality. It should not claim psychological benefit without a dedicated, evaluated intervention; a future directory can recommend complementary games.

**7. Accessibility and localisation remain product requirements (industry practice).** Public browser access does not address reading level, keyboard/screen-reader use, colour vision, motor access, language, low-bandwidth devices or cultural food contexts. Novi-Chek, Sweet Strategy and GlucoZor demonstrate the value—and regional limitation—of localisation.

### 8.6 Comparative opportunities for improvement

| Priority | Proposed direction | Basis | Evaluation needed |
|---:|---|---|---|
| 1 | Reduce the path from landing to first meaningful action; offer one clearly recommended start | Industry practice plus direct comparison with micro-level products | Median clicks/time to first action; first-session abandonment |
| 2 | Start with a constrained 2–3 minute causal level before presenting mode choice | Cognitive-load/design inference; Level One comparator | Randomised onboarding test; comprehension and continuation |
| 3 | Make predict–act–observe–explain–retry the explicit level loop | Adjacent learning evidence and simulation rationale | Novel-scenario transfer and delayed retention |
| 4 | Use What If as the debrief after errors, not as an expert-only side feature | Design inference; adult WST adjacency | Whether players identify the changed causal factor |
| 5 | Add competence-based progression alongside points and time in range | Retrieval/mastery evidence | Mastery validity against parallel-form tasks |
| 6 | Conduct structured co-design with newly diagnosed adults, children and caregivers separately | Direct participatory-design evidence | Documented thematic saturation and usability changes |
| 7 | Define a minimal evidence programme before clinical promotion | Evidence gap | Preregistered feasibility, delayed knowledge and transfer study |
| 8 | Build the game directory as a neutral complement, not a funnel | Accessibility evidence and ethical practice | Link integrity, update process and user trust |

### 8.7 Minimum evaluation programme for T1D Simulator

A proportionate sequence would be:

1. **Instrumented usability:** time and clicks to first meaningful action, task completion, error recovery, abandonment and accessibility barriers.
2. **Think-aloud causal comprehension:** whether participants attribute simulated changes to the intended mechanisms rather than superficial graph patterns.
3. **Pre-registered pilot with parallel-form tests:** immediate and four-week knowledge, near transfer, unfamiliar-scenario transfer, self-efficacy and avoidable misconceptions.
4. **Comparative onboarding experiment:** current start flow versus a one-click recommended learning path.
5. **Only after feasibility:** a sufficiently powered controlled study against an appropriate educational comparator. HbA1c should not be the primary endpoint unless exposure duration, expected pathway and sample size make a clinical effect plausible.

Clinical outcomes are downstream of many factors that the game cannot control. A negative HbA1c result would not invalidate learning; a positive result would require careful attribution. The most defensible first claim is that a player can better reason about specified glucose mechanisms after use.

## 9. Design implications for T1D Simulator

### 9.1 Direct evidence

1. Contextual games can affect self-care and parent communication even without knowledge or HbA1c change (Packy & Marlon).
2. Narrow procedural rehearsal can reduce observed injection distress over a short interval (Koodak-e-Tavana).
3. Short-term knowledge gains are repeatedly observed, but designs without controls and delayed tests overestimate certainty.
4. Attrition must be reported independently of satisfaction (WeCan).
5. Public availability cannot be inferred from publication; it must be maintained and reverified (Reinders et al.).

### 9.2 Adjacent evidence

1. Prediction, explanatory feedback, retrieval and varied practice are plausible mechanisms for causal learning.
2. Counterfactual replay may help learners isolate causes, but the specific interface requires testing.
3. Character distance can reduce threat and support discussion, particularly for younger users.
4. Structured caregiver debrief may deliver social learning without the governance burden of an open social network.

### 9.3 Industry practice

1. Immediate, short sessions and a clear recommended start reduce activation energy.
2. App-store availability, live version updates and a stable owner are necessary for clinical recommendability.
3. Product pages should disclose language, age, evidence, personal-data use, price and maintenance date.
4. Analytics should be privacy-minimised and should measure learning-flow failure, not manipulate return frequency.

### 9.4 Design inference

1. T1D Simulator's principal differentiator should be causal exploration of interacting physiology—not a larger list of facts.
2. Campaign should provide a clearly recommended novice route before presenting advanced choices.
3. Campaign levels should constrain variables early and progressively expose delayed interactions.
4. The What If view should be positioned as a core reflection tool and introduced through a concrete example.
5. Points and stars should be supplemented with feedback about the mechanism understood, uncertainty and alternative safe strategies.
6. Emotional and lived-experience content should be co-designed, bounded and evaluated; the simulator can also direct users to complementary games rather than attempting to absorb every purpose.

## 10. Complete game and product evidence map

The table is intentionally inclusive. Scope labels prevent clinician training, exergames, physical toys and lightly gamified utilities from being mistaken for directly comparable patient-facing T1D serious games. “Public” denotes verified access, not endorsement.

| Product | Scope | Audience | Platform | Access on 24 Aug 2026 | Highest evidence category |
|---|---|---|---|---|---|
| Level One: A Diabetes Game | Current core | Children, adults, caregivers | iOS/Android | Public, free | Unevaluated public product |
| AvaType1 | Current core | Primarily 6–12; tiered content | iOS/iPadOS | Public, free | Unevaluated public product |
| FlightGlucose | Current core | Unspecified learner/caregiver | Browser/PWA | Public, free claim | Unevaluated public product |
| MyDiabetic | Current core | Children 5–12 | iOS/Android | Public, free | Co-design/short feasibility |
| Rufus, the Bear with Diabetes | Current core | Young children/families | Mobile; optional bear | Public, free app | Unevaluated public product |
| GlucoZor | Current core | Children 9–11 | Web; historical mobile | Official site; store status incomplete | Unevaluated public product |
| Novi-Chek | Companion | Ages 13–25 | Mobile | French Android listing | Unevaluated public product |
| Sweet Strategy | Companion | Children/adolescents | iOS/iPadOS | Taiwan listing, free | Unevaluated public product |
| eddii | Gamified management | Children/adults | iOS/Android | Public US service | Product-related evidence; efficacy unestablished |
| Captain Novolin | Historical core | Children | SNES | Discontinued | Development history |
| Packy & Marlon | Historical core | Ages 8–16 | SNES | Discontinued | Small randomised trial |
| Monster Manor | Historical core | Children | Mobile | Discontinued | Development description |
| Koodak-e-Tavana | Research prototype | Children | PC | Study-only | Small randomised trial |
| AR Diabetes Education Game | Research prototype | Children | Tablet/AR cards | Study-only | Feasibility/usability |
| Food Quiz | Research prototype | Children | PC/web | Unavailable | Development/conceptual |
| Social Diabetes Learning Platform | Research prototype | Children/adolescents | Web/mobile concept | Unavailable | Participatory design |
| PAL | Research prototype | Children/care team | Robot/tablet/web | Study-only | Feasibility/co-design |
| Diaquarium | Research prototype | Children | Mobile | Unavailable | Design/usability |
| Diabetic Mario | Research prototype | Children | PC | Unavailable | Small short evaluation |
| Virtual Coach | Research prototype | Children | Web | Unavailable | Development/feasibility |
| Tako Dojo | Research prototype | Adolescents | Mobile | Study-only | Pre/post evaluation |
| Qare and Qure | Research prototype | Child/caregiver | Mobile | Unavailable | Development evaluation |
| Sparapani framework | Research framework | School-age children | Concept/prototype | Not a public product | Qualitative framework |
| Tangbao Superman Transformation | New research | Ages 4–9 | Virtual reality (VR) | Study-only | Uncontrolled pre/post |
| DiaPed | New research | Children/adolescents | Mobile | Study-only | Uncontrolled pre/post |
| WeCan | New research | Adolescents | Mobile | Study-only | Two-arm feasibility |
| emoTICare | New research | Adolescents | Computer/tablet | Trial-only | Quasi-experimental |
| Nørlev smartphone prototype | New research | Ages 8–12 | Smartphone | Study-only | Participatory co-design |
| Turkish game/video intervention | New research | Children | Digital game/video | Trial-only | Small randomised trial |
| GlucoBoy / DIDGET | Historical hardware | Children | Game Boy/DS hardware | Discontinued | Development history |
| Mundo Carakuato | Secondary app | Children | Mobile | Uncertain | Unevaluated public product |
| Xugarhero | Secondary app | Children | Mobile | Uncertain | Unevaluated public product |
| Jerry the Bear | Physical game | Young children/families | Interactive toy | Uncertain; Rufus successor active | Limited formal evidence |
| DiabetesSpel | Secondary app | Children/families | Mobile | Uncertain | Unevaluated public product |
| Diabetes Academy | Secondary app | Unspecified | Mobile | Uncertain | Unevaluated public product |
| Diabetic's Diner | Secondary app | Unspecified | Mobile | Uncertain | Unevaluated public product |
| I Got This | Experiential | Adolescents/peers | Mobile | Store status uncertain | Unevaluated public product |
| Hell Hath No Insulin | Experiential | Teens/adults | Windows/itch.io | Public | Unevaluated indie product |
| Permanence | Experiential | Teens/adults | Browser/PC | Public | Unevaluated indie product |
| Holesome | Experiential | Teens/adults | itch.io | Public | Unevaluated indie product |
| stable T1D | Gamified utility | Teens/adults | Web/mobile | Public web presence | Unevaluated utility |
| Web-based Simulation Training | Simulation-adjacent | Adults with T1D | Web | Trial-only | Small pilot |
| ExerT1D | Exergame | Adolescents | Exercise platform | Research-only | Protocol/qualitative co-design |
| InsuOnline | Clinician training | Professionals | Online | Trial/research | Controlled professional education |

The machine-readable catalogue provides aliases, release history, developer classification, documented lived-experience involvement, core loop, price, region, accounts, hardware, links, screenshot provenance, methodological limitations and design relevance for every row.

## 11. Expanded profiles

### 11.1 Level One: A Diabetes Game

Level One is the clearest contemporary example of a low-friction, level-based causal T1D game. Food particles enter a stylised bloodstream and the player times insulin or rapid carbohydrate to manage glucose across more than 60 levels. The design covers carbohydrate counting, ratios, sensitivity, CGM interpretation, ketones and exercise. The game is free on iOS and Android; an account was introduced during product evolution. The developer collaboration includes Level Ex/Relevate, Breakthrough T1D and Beyond Type 1, and the origin story is explicitly lived-experience-led through a founder whose daughter developed T1D.

Its major strength is granularity: the first learning unit can be short and visually causal. Limitations are an abstract representation, possible explanation/pacing problems reported in public reviews, English-language restriction and absence of independent outcome evaluation. It is the strongest comparator for shortening T1D Simulator's time to first meaningful action.

![Official Level One gameplay image](../game-literature/screenshots/level-one_official-gameplay.jpg)

### 11.2 AvaType1

AvaType1 is a free iOS/iPadOS educational game released in 2026, principally for children aged 6–12, with teen, adult and technical lesson tiers. It combines simulated T1D decisions with arcade-style activities. The independent developer reports living with T1D since 1992 and developing the game after a daughter's diagnosis in 2022. No peer-reviewed evaluation was located. Its tiered explanation model is relevant to a simulator that must serve both children and advanced adults without forcing one reading level on everyone.

![Official AvaType1 gameplay image](../game-literature/screenshots/ava-type-1_official-gameplay.jpg)

### 11.3 FlightGlucose

FlightGlucose is a free browser-based progressive web application (PWA) scenario simulation with 13 scenarios covering basal and bolus insulin, insulin on board, hypoglycaemia, ketones/diabetic ketoacidosis, exercise and alcohol. It offers unusually low access friction and broad scenario coverage. No peer-reviewed outcome evaluation or sufficiently clear clinical provenance was located. Some public framing emphasises danger and survival; that may create urgency but can increase anxiety or narrow motivation, especially at diagnosis. No screenshot was retained because reuse provenance was not sufficiently clear.

### 11.4 MyDiabetic

MyDiabetic is a public, free Czech/English iOS and Android game for children aged approximately 5–12. Players follow a character through daily care, obtain food and supplies, use pens, pumps, meters and CGM, and manage simulated glucose. Unlike most public products, it has a peer-reviewed co-design and feasibility publication: 32 children across iterative phases plus five peers, with a short one-week educational improvement. There was no controlled long-term or clinical endpoint.

The game demonstrates how procedures and devices can be introduced through a coherent daily routine. T1D Simulator offers deeper dynamic physiology; MyDiabetic offers a more concrete life-world and procedural curriculum.

![Official MyDiabetic gameplay image](../game-literature/screenshots/mydiabetic_official-gameplay.jpg)

### 11.5 Rufus, the Bear with Diabetes

Rufus is a free mobile character-care game supported by Breakthrough T1D and developed through Empath Labs/Sproutel. Children check a bear's glucose, prepare insulin and meals, complete tasks and unlock animated stories. A physical bear can provide tangible role play. Google Play showed more than 10,000 downloads and an update in December 2025. Controlled educational outcome evidence was not located.

The character makes procedures concrete and potentially less threatening. The principal limitations are young-child specificity, less emphasis on interacting physiology and uncertainty about what is learned beyond completing care routines.

![Official Rufus Google Play image](../game-literature/screenshots/rufus_official-google-play.jpg)

### 11.6 GlucoZor, Novi-Chek and Sweet Strategy

These products demonstrate localisation and age segmentation. GlucoZor is a French child-focused ecosystem developed through a commercial/clinical/nonprofit collaboration; its official site remained active, but mobile-store availability was incompletely verified. Novi-Chek is a free French educational companion for ages 13–25 with a verified Android listing. Sweet Strategy is a free Traditional Chinese iOS companion combining food and daily-life content with mini-games. No independent controlled product-level evaluation was located for these current versions.

![Official GlucoZor representative image](../game-literature/screenshots/glucozor_official-representative.png)

![Official Novi-Chek representative image](../game-literature/screenshots/novi-chek_official-representative.png)

### 11.7 Historical profiles

**Captain Novolin.** The 1992 SNES platform game integrated diabetes facts and actions into a commercial console format through Sculptured Software, Raya Systems, Novo Nordisk and a US public-health partner. It is discontinued and has no located controlled product-specific outcome trial. Its historical importance exceeds its evidence.

![Captain Novolin historical gameplay image](../game-literature/screenshots/captain-novolin_wikipedia-gameplay.png)

**Packy & Marlon.** The 1994 SNES adventure remains the best-known early controlled case. Its randomised trial suggests improved self-care and parent communication without knowledge or HbA1c benefit. It is discontinued and inaccessible to ordinary contemporary users.

![Packy & Marlon historical cover image](../game-literature/screenshots/packy-and-marlon_wikipedia-cover.jpg)

**Monster Manor.** The Ayogo/Sanofi/Diabetes UK mobile game rewarded glucose checks through monster collection. It illustrates both a strong habit loop and sustainability failure: development was documented, controlled evidence was not located and the game was unavailable by the 2024 audit.

![Monster Manor figure from the scholarly product description](../game-literature/screenshots/monster-manor_jmir-figure-1.jpg)

### 11.8 Consequential research prototypes

**Koodak-e-Tavana** is consequential because it tested a narrow psychological/procedural target in a randomised design. Its one-week distress result is promising, although sample size and durability are limited. It was not released publicly.

![Koodak-e-Tavana article figure](../game-literature/screenshots/koodak-e-tavana_article-figure-3.jpg)

**The augmented-reality food game** used tangible markers and a tablet to connect physical objects with educational feedback. It demonstrated feasibility but required specialised setup and was not maintained publicly.

![Augmented-reality diabetes game article figure](../game-literature/screenshots/ar-diabetes-game_plos-figure-3.jpg)

**PAL, Diaquarium, Diabetic Mario, Tako Dojo, Qare and Qure and the social diabetes platform** collectively demonstrate robot coaching, virtual-pet care, integrated platform play, adolescent theming, paired caregiver roles and moderated social learning. Their contributions are primarily design and feasibility knowledge because public continuity and long-term outcomes are absent.

**Tangbao Superman Transformation, DiaPed, WeCan and emoTICare** show that the post-2020 field is diversifying into VR, localisation, implementation metrics and socioemotional outcomes. The same inferential limitations remain: small samples, short exposure, weak controls or inaccessible products.

## 12. Appendices by boundary category

### 12.1 Mixed T1D/T2 or gamified management products

eddii and stable T1D are relevant to engagement, self-monitoring and real-data integration but should not be merged with stand-alone T1D educational games. Their privacy, commercial and potential medical-device boundaries differ. Diabetes Academy and Diabetic's Diner have insufficiently verified T1D specificity.

### 12.2 Clinician-training games

InsuOnline uses simulated clinical cases for professional insulin decision training. Its learning principles may inform case-based design, but its users, outcomes and liability context differ from patient education.

### 12.3 Physical games and toys

Jerry the Bear and historical GlucoBoy/DIDGET systems combine tangible hardware with role play or reward. Physicality may support young children, but cost, logistics and proprietary dependency reduce reach and sustainability.

### 12.4 Exergames

ExerT1D targets physical activity and exercise confidence. Broader diabetes exergame evidence may improve physical activity, but it should not be interpreted as evidence that screen-based simulation produces exercise or clinical benefit.

### 12.5 Experiential games

I Got This, Hell Hath No Insulin, Permanence and Holesome address diagnosis, burden, identity or empathy. They should be indexed by intended experiential outcome and lived-experience provenance, not ranked against carbohydrate-counting simulations by HbA1c.

### 12.6 Weakly gamified utilities

Points, quizzes or a mascot do not necessarily constitute a game. Novi-Chek, Sweet Strategy and some app-store titles combine useful reference material with mini-games. Their educational content may be valuable, but the game contribution has not been isolated.

## 13. Framework for a future public T1D game directory

The directory should help users find an appropriate product, including a product other than T1D Simulator. It should not imply that inclusion is endorsement.

### 13.1 Required public fields

1. Title, aliases and stable product identifier.
2. Intended audience, age, role and whether content is T1D-specific.
3. Learning purpose: knowledge, practical competence, causal simulation, coping, empathy, professional training or activity.
4. Platform, language, region, accessibility requirements and device dependencies.
5. Current access link, price, subscription, advertisements, in-app purchases and account requirement.
6. Personal-data use, real-health-data integration and privacy-policy link.
7. Developer/owner type and documented lived-experience involvement.
8. Evidence level, study population, sample size, measured outcomes and limitations.
9. Distinction between independent evidence, developer evaluation and marketing claim.
10. Availability verification date and confidence; automatic “stale” status after a defined interval.
11. Screenshot source, copyright holder and permission status.
12. Direct statement of whether the review team has playtested the current version.

### 13.2 Neutral recommendation logic

Filtering should begin with user need rather than product popularity. A person seeking injection practice should not receive a generic food quiz; an adult seeking lived-experience recognition should not be routed only to a child mascot; a clinician game should not appear in a patient list. Evidence, availability and fit should be displayed as separate dimensions.

Products should not receive a single composite score. A high-evidence discontinued prototype and a public unevaluated app have different strengths and failures that a single rating conceals. Recommended labels include:

- **Evidence:** controlled / uncontrolled / co-design / descriptive / unevaluated.
- **Access:** public / region-limited / study-only / discontinued / uncertain.
- **Purpose:** knowledge / procedure / simulation / coping / empathy / professional.
- **Data boundary:** fictional only / manual self-tracking / connected health data.
- **Review status:** desk-researched / playtested / independently evaluated.

### 13.3 Maintenance process

Active entries should be rechecked at least every six months and after reported link failure. A removal should not erase history; it should change the status to discontinued with the last verified date and an archived link where lawful. Product owners may submit corrections, but evidence classification should remain editorially independent.

## 14. Limitations and research gaps

1. The review was not prospectively registered and did not use duplicate independent screening or extraction.
2. App stores are personalised by region, device, age rating and account. Absence from one storefront does not prove global absence.
3. Several conference papers and chapters were access-restricted. Metadata and abstracts were used without bypassing access controls.
4. Product names are unstable; different papers may describe iterations rather than identical builds.
5. No product was directly playtested. Usability and content descriptions therefore rely on published or official representations.
6. Screenshots are retained for private scholarly review; most are not cleared for public redistribution.
7. The catalogue includes boundary cases to expose gaps, but inclusion does not mean equivalent purpose or evidence.
8. T1D Simulator comparisons are feature-based. No head-to-head user study exists.
9. The search was broad but cannot guarantee discovery of every small, non-English, school-distributed or independently hosted game.
10. Publication bias likely favours positive feasibility outcomes; discontinuation and null results are poorly reported.

Priority research gaps are delayed retention; transfer to unfamiliar scenarios; adult and diagnosis-stage education; caregiver outcomes; accessibility; adverse emotional effects; component-level comparisons; transparent attrition; economic and maintenance evaluation; and controlled studies of currently public products.

## 15. Conclusions

Serious games can make T1D learning active, repeatable and less dependent on a single clinical teaching encounter. The evidence is strongest for feasibility, acceptability and some short-term or narrow outcomes. It is insufficient for a general clinical-benefit claim. The field's central implementation failure is not merely a shortage of ideas: evaluated prototypes commonly vanish, while accessible products commonly lack evaluation.

T1D Simulator contributes a comparatively unusual combination of browser access, fixed fictional characters, mechanistic simulation, staged scenarios, free exploration and counterfactual replay. Those properties create a credible platform for causal learning, but they do not establish that learning occurs. The highest priorities are lower-friction onboarding, progressive constraint, explicit prediction and explanation, structured co-design and a pre-registered evaluation focused on causal reasoning and transfer.

A neutral T1D game directory is justified now. Its value will depend on transparent evidence, availability and provenance—not on promoting a single product. Helping a person find another game that better matches age, language, emotional need or preferred form of learning is consistent with the educational purpose.

The plain-language and multilingual adaptation is deliberately outside this phase. This English report remains the scientific source document.

## References

Baghaei, N. et al. (2016) ‘Diabetic Mario: Designing and evaluating mobile games for diabetes education’, *Games for Health Journal*. Available at: [https://doi.org/10.1089/g4h.2015.0038](https://doi.org/10.1089/g4h.2015.0038).

Brown, S.J. et al. (1997) ‘Educational video game for juvenile diabetes: Results of a controlled trial’, *Medical Informatics*, 22(1). Available at: [https://pubmed.ncbi.nlm.nih.gov/9183781/](https://pubmed.ncbi.nlm.nih.gov/9183781/).

Calle-Bustos, A.-M. et al. (2017) ‘An augmented reality game to support therapeutic education for children with diabetes’, *PLOS ONE*, 12(9), e0184645. Available at: [https://doi.org/10.1371/journal.pone.0184645](https://doi.org/10.1371/journal.pone.0184645).

Ebrahimpour, F. et al. (2014) ‘Design and usability evaluation of an insulin injection game for children with type 1 diabetes’, *Iranian Journal of Pediatrics*. Available at: [https://pmc.ncbi.nlm.nih.gov/articles/PMC4324272/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4324272/).

Ebrahimpour, F. et al. (2015) ‘The effect of playing an insulin injection game on behavioural distress in children with type 1 diabetes’, *Iranian Journal of Pediatrics*. Available at: [https://doi.org/10.5812/ijp.25(3)2015.427](https://doi.org/10.5812/ijp.25(3)2015.427).

Guan, J. et al. (2026) ‘Gamified interventions for children and adolescents with type 1 diabetes: A scoping review’, *BMC Pediatrics*. Available at: [https://doi.org/10.1186/s12887-026-07142-5](https://doi.org/10.1186/s12887-026-07142-5).

Johnson, D. et al. (2016) ‘Gamification for health and wellbeing: A systematic review of the literature’, *Internet Interventions*, 6, pp. 89–106. Available at: [https://doi.org/10.1016/j.invent.2016.10.002](https://doi.org/10.1016/j.invent.2016.10.002).

Kamel Boulos, M.N. et al. (2015) ‘Digital games for type 1 and type 2 diabetes: Underpinning theory with three illustrative examples’, *JMIR Serious Games*, 3(1), e3. Available at: [https://doi.org/10.2196/games.3930](https://doi.org/10.2196/games.3930).

Kharrazi, H. et al. (2012/2016) ‘A scoping review of health game learning theories and diabetes applications’. Local open manuscript retained in the companion literature collection.

Koutná, V. et al. (2024) ‘MyDiabetic: Participatory design and feasibility evaluation of an educational game for children with type 1 diabetes’, *JMIR Formative Research*. Available at: [https://doi.org/10.2196/49478](https://doi.org/10.2196/49478).

Lauritzen, J. et al. (2012) ‘Social media and games for type 1 diabetes’, in *HEALTHINF 2012*. Available at: [https://doi.org/10.5220/0003874104590466](https://doi.org/10.5220/0003874104590466).

Moosa, S. et al. (2018) ‘Qare and Qure: Paired educational games for children with diabetes and caregivers’, in *COMAPP 2018*. Available at: [https://doi.org/10.1109/COMAPP.2018.8460213](https://doi.org/10.1109/COMAPP.2018.8460213).

Nørlev, J. et al. (2022a) ‘Game mechanisms in serious games that teach children with type 1 diabetes how to self-manage: A systematic scoping review’, *Journal of Diabetes Science and Technology*, 16(5), pp. 1253–1269. Available at: [https://pubmed.ncbi.nlm.nih.gov/34024156/](https://pubmed.ncbi.nlm.nih.gov/34024156/).

Nørlev, J. et al. (2022b) ‘Participatory design of a smartphone game for children with type 1 diabetes’, *JMIR Formative Research*. Available at: [https://doi.org/10.2196/33955](https://doi.org/10.2196/33955).

Reig-Ferrer, A. et al. (2025a) ‘emoTICare: Protocol for a socioemotional serious-game intervention in adolescents with type 1 diabetes’, *PLOS ONE*. Available at: [https://doi.org/10.1371/journal.pone.0325763](https://doi.org/10.1371/journal.pone.0325763).

Reig-Ferrer, A. et al. (2025b) ‘Socioemotional outcomes of emoTICare in adolescents with type 1 diabetes’, *Frontiers in Endocrinology*. Available at: [https://doi.org/10.3389/fendo.2025.1668398](https://doi.org/10.3389/fendo.2025.1668398).

Reinders, E. et al. (2024) ‘Serious digital games for children and adolescents with type 1 diabetes: Evidence and accessibility’, *Diabetes Research and Clinical Practice*, 217, 111833. Available at: [https://doi.org/10.1016/j.diabres.2024.111833](https://doi.org/10.1016/j.diabres.2024.111833).

Rønningen, I.C. et al. (2018) ‘Diaquarium: A mobile game for children with type 1 diabetes’, in *Serious Games*. Available at: [https://doi.org/10.1007/978-3-319-78759-6_40](https://doi.org/10.1007/978-3-319-78759-6_40).

Shute, V.J. (2008) ‘Focus on formative feedback’, *Review of Educational Research*, 78(1), pp. 153–189. Available at: [https://doi.org/10.3102/0034654307313795](https://doi.org/10.3102/0034654307313795).

Sparapani, V.C. et al. (2019) ‘A conceptual framework for serious games for children with type 1 diabetes’, *Revista Latino-Americana de Enfermagem*, 27, e3090. Available at: [https://pmc.ncbi.nlm.nih.gov/articles/PMC6432989/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6432989/).

Thompson, D. et al. (2010) ‘Serious video games for health: How behavioural science guided the development of a serious video game’, *Journal of Diabetes Science and Technology*, 4(3). Available at: [https://pmc.ncbi.nlm.nih.gov/articles/PMC2901054/](https://pmc.ncbi.nlm.nih.gov/articles/PMC2901054/).

Gu, H., Mohd Muhaiyuddin, N.D.B. and Shaari, N.B. (2026) ‘Narrative-driven virtual reality serious game to support type 1 diabetes self-management in children’, *Scientific Reports*, 16, 596. Available at: [https://doi.org/10.1038/s41598-025-30114-1](https://doi.org/10.1038/s41598-025-30114-1).

Yao, M. et al. (2024) ‘Effects of electronic games on diabetes self-management and outcomes: Systematic review and meta-analysis’, *Journal of Medical Internet Research*, 26, e43574. Available at: [https://doi.org/10.2196/43574](https://doi.org/10.2196/43574).

Additional product, registry and bibliographic sources are linked in `SOURCES.md` and in the JSON catalogue.

## Abbreviation glossary

| Abbreviation | Meaning |
|---|---|
| ACM | Association for Computing Machinery |
| AR | Augmented reality |
| CGM | Continuous glucose monitoring/monitor |
| CI | Confidence interval |
| DKA | Diabetic ketoacidosis |
| DOI | Digital object identifier |
| HbA1c | Glycated haemoglobin, a measure reflecting average glycaemia over approximately 2–3 months |
| IEEE | Institute of Electrical and Electronics Engineers |
| MD | Mean difference |
| PC | Personal computer |
| PMC | PubMed Central |
| PMID | PubMed identifier |
| PWA | Progressive web application |
| RCT | Randomised controlled trial |
| SD | Standard deviation |
| SMD | Standardised mean difference |
| SNES | Super Nintendo Entertainment System |
| SUS / SUS-C | System Usability Scale / child-adapted System Usability Scale |
| T1D | Type 1 diabetes |
| T2D | Type 2 diabetes |
| VR | Virtual reality |
