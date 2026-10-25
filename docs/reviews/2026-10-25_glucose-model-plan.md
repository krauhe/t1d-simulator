# Glucose tablets: model distinction and evidence requirements

Date: 2026-10-25  
Status: **❌ ÅBEN — no carbohydrate model change implemented.**

Follow-up analysis: [Glucose-specific kinetics: feasibility and visible learning value](2026-10-25_codex_glucose-feasibility.md). That report contains the subsequent evidence appraisal and sensitivity experiments; this document preserves the initial brief. The model change remains undecided.

## 1. Requested behavior and current implementation

The owner wants the existing dextrose-tablet food to represent glucose rather
than behaving identically to generic solid sugar, so its role can be explored
in the educational game.

`FOODS.druesukker` currently uses `CARB_TYPES.sukker_fast`: simple fraction 1,
no fibre and retention factor 1. Candy and chocolate use that same carbohydrate
type, with their own fat, protein, portion and eating-time values. All ingested
carbohydrate enters shared Hovorka D1/D2 compartments. The engine computes one
dynamic `tau_G` from the stomach mixture and uses it for both stomach transit
and intestinal appearance. There is no separate glucose, sucrose or fructose
handling. The existing food labels therefore distinguish products more finely
than the carbohydrate chemistry does.

## 2. Evidence appraisal so far

1. **Slama et al. (1990): original abstract checked through Europe PMC.** The
   experiment compared several oral carbohydrate preparations during induced
   hypoglycaemia in T1D. The abstract reports similar glucose/sucrose responses
   under its tested conditions. It does not justify a universal speed multiplier
   making glucose faster than sucrose. Full text and figures have not been
   appraised. [Verified abstract record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:2310277%20AND%20SRC:MED&format=json&resultType=core).
2. **McTavish and Wiltshire (2011): original abstract checked through Europe
   PMC.** In the camp study, jellybeans gave the slowest response; glucose
   tablets did not differ significantly from orange juice or the tested sugar
   mints. Lack of a significant difference does not establish exact equivalence,
   but it prevents claiming an established universal hierarchy. Full text has
   not been appraised. [Verified abstract record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:21443586%20AND%20SRC:MED&format=json&resultType=core).
3. **Taleb et al. (2023): full-text XML acquired and identity checked.** The
   randomized crossover trial compares two amounts of glucose tablets at
   different hypoglycaemia ranges. It is a possible independent response check,
   not a direct glucose-versus-sucrose kinetic calibration. The article is stored
   privately as `docs/references/Taleb_2023_NonSevereHypoglycemiaOralCarbohydrates.xml`.
   Numerical endpoints and original page images have not yet been appraised.
   [Verified full-text XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10272543/fullTextXML).

The existing BG-SCIENCE section on carbohydrate digestion distinguishes free
glucose from disaccharides and starch. Mechanistic differences alone do not
identify the simulator's lumped time constants. The implementation description
that treats both glucose and sucrose as needing no digestion should be corrected
as part of the eventual carbohydrate-model decision.

## 3. External criticism and decisions

Gemini 3.8 Flash, through the owner's Antigravity account, read a bounded packet
containing the current equations, food parameters and explicitly unverified
source leads. It did not read original research or the source files. Raw output,
brief and metadata remain private.

1. **Retained:** changing a shared stomach/transit parameter can affect all
   concurrently present food; mixtures must be tested, not only isolated tablets.
2. **Rejected:** the suggested tablet retention factor 0.7–0.8 had no source-based
   parameter derivation. It is not applied.
3. **Rejected:** a mandatory ranking of all liquid sugar above tablets and all
   tablets above sucrose is not established by the checked evidence.
4. **Deferred:** a separate intestinal path may be useful, but adding states does
   not itself provide validated kinetic parameters. The scope and calibration
   must be settled before coding.

## 4. Proposed next model task

1. Obtain and inspect the primary comparison papers, keeping product form,
   carbohydrate composition, insulin background and measurement endpoint
   separate. Record inaccessible full texts rather than reconstructing figures.
2. Define mechanistic targets before choosing parameters: mass conservation,
   explicit glucose identity, no instantaneous plasma jump, no forced universal
   superiority, and appropriate interaction with gastric emptying.
3. Compare a bounded food-specific appearance model with separate intestinal
   glucose handling. Document which observations can identify each parameter.
4. Reserve an independent study/protocol as validation rather than using every
   endpoint for both fitting and a success claim.
5. Test isolated and mixed meals, long eating windows, first/last intake step,
   two integration steps, snapshot continuation, What If recomputation and
   unchanged unrelated foods. Report response curves and uncertainty.

No new absorption constant, carbohydrate type or treatment instruction has been
added. In response to #08, the owner requested a feasibility analysis, including
perceptibility and water co-ingestion. That analysis is now recorded in
[Glucose-specific kinetics: feasibility and visible learning value](2026-10-25_codex_glucose-feasibility.md).
It includes equal-carbohydrate engine experiments and further primary-source
checks. Implementation and publication remain pending; no numeric speed factor
has been accepted.

## 5. Coverage and archive status

Code read: the relevant food definitions, D1/D2 integration and engine meal-input,
stomach-mixture, snapshot and sampling paths. This is not a full model review.
Archive read-only checks before and after acquisition reported 173 cached PDFs,
one unrelated pending Mergenthaler conversion and zero blocked files. XML is
outside that PDF conversion pipeline; acquisition does not imply scientific
validation. Overall: one open model-design issue, no calibrated fix claimed.
