# MDR review of the public What If branch

**Generated:** 2026-07-31  
**Branch reviewed:** `codex/public-insights`  
**Status:** Merge-gate findings 1, 3 and 5 fixed locally; finding 2 partially fixed  
**Scope:** Public game, mobile UI, What If, Game Guide, welcome tour, README, intended purpose and intended-purpose tests

## Conclusion

The current branch still presents primarily as an educational game rather than individual medical decision-support software. Its strongest safeguards are functional rather than disclaimer-based:

- the public UI uses six fixed fictional characters;
- it accepts no personal CGM data or treatment profile;
- weight, ISF and ICR cannot be entered through the public UI;
- What If starts from an already played fictional scenario;
- changes made in What If are not transferred back to the paused game.

No single finding makes the current version obviously medical-device software. The model-calculated basal range has now been removed, What If points have been disabled, the intended purpose describes the restricted feature, and the automated release boundary has been expanded. TIR and mean glucose remain visible in What If pending a broader UI decision, and the basal wording in the tour and Game Guide still needs revision before merge.

This is a cautious product interpretation, not legal advice or a binding regulatory classification.

## Regulatory basis

Under Articles 2(1) and 2(12) of [Regulation (EU) 2017/745](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745), software qualification depends on the manufacturer's intended purpose as expressed through labelling, instructions, promotional material and the software's actual function.

[MDCG 2019-11 rev. 1](https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf) distinguishes software acting for the benefit of individual patients from generic educational or population-level tools. The guidance is not legally binding, but it is the relevant official interpretation framework. Free hobby distribution does not by itself remove or create medical-device status.

## Merge gate

### 1. Model-calculated basal range resembles a dose calculation

**Status:** ✅ FIKSET (lokalt, 2026-07-31)  
**Severity:** High  
**Files:** `mobile/index.html:196`, `mobile/mobile.js:2434`, `js/dose-controls.js:35`

The displayed range in E/day is calculated around the engine's internal steady-state basal requirement. Although it is attached to a fictional character, it presents a calculated range that looks like a correct dose interval.

**Before merge:** Remove the displayed numerical range and `getBasalTrialRangeForCharacter()`. Keep coarse dose buttons as game actions. Explain only the observable model behaviour: insufficient basal effect produces an upward tendency and excessive basal effect a downward tendency.

The range helper, mobile range display and unused campaign descriptor values were removed. Character-scaled coarse buttons remain.

### 2. What If provides numerical optimisation feedback

**Status:** ⚠️ DELVIST (lokalt, 2026-07-31)  
**Severity:** High  
**Files:** `js/editor.js:1965-1990`, `js/editor.js:2149-2152`, `js/i18n.js:415`

What If can vary insulin amount and timing while displaying whole-period TIR, mean glucose and points. The code itself calls this summary “optimisation feedback”. This makes it easy to rank alternatives and identify an apparently optimal insulin action.

**Before merge:** Hide points, TIR and mean glucose in What If. Keep the alternative curves, reference course, target band and event variation. A visual target band is less directive than a numerical ranking.

What If no longer calculates or displays a points total; the points panel is greyed out. TIR and mean glucose remain while the project owner considers removing those metrics from the whole game to reduce information overload.

### 3. Intended purpose does not describe the public What If feature

**Status:** ✅ FIKSET (lokalt, 2026-07-31)  
**Severity:** High  
**Files:** `docs/INTENDED-PURPOSE.md:21-25`, `README.md:272-278`, `index.html:144-164`

The documents state that unrestricted scenario-authoring tools are not distributed, but they do not describe the new restricted public feature.

**Before merge:** Add a short positive description of public What If: it uses the already selected fixed character, starts from a played course, accepts no personal parameters, has no import/export, does not modify the paused game and simulates only six hours beyond the played point.

`docs/INTENDED-PURPOSE.md` and `README.md` now describe this restricted public contract.

### 4. Basal text reads as general dose-adjustment guidance

**Status:** ❌ ÅBEN  
**Severity:** High  
**Files:** `js/i18n.js:893-896`, `js/guide-data.js:136`

“Assess the dose from quiet periods” and the general description of splitting basal into one or two doses can be applied outside the game.

**Before merge:** Bind the text to the named character and the experiment. For example: “In the game, compare how different basal doses and times affect {characterName}'s blood glucose during quiet periods. One combined and two split game actions produce different insulin profiles.”

A complete Danish rewrite proposal has been prepared in `docs/reviews/2026-07-31_game-guide-rewrite-proposal-da.md`; active guide and tour text have not yet been changed.

### 5. The intended-purpose test misses the new risk surfaces

**Status:** ✅ FIKSET (lokalt, 2026-07-31)  
**Severity:** High  
**File:** `tests/check-intended-purpose-text.js:21-34`

The current test does not scan `js/editor.js`, `js/game.js`, `js/main.js`, `mobile/mobile.js` or `js/dose-controls.js`. It therefore cannot detect a model-calculated basal recommendation, public profile controls, import/export or optimisation feedback.

**Before merge:** Expand the test with structural checks for:

1. no public profile input;
2. no model-calculated basal recommendation;
3. no public editor import/export API;
4. editor scenarios containing `characterId`, but not weight, ISF or ICR;
5. no numerical optimisation summary in the public What If view.

The intended-purpose scan now includes editor, game, main, simulator, mobile and dose-control code. Structural release-boundary tests verify fixed character IDs, the six-hour limit and the absence of public file/profile APIs. The points calculation is also removed; TIR and mean glucose are tracked under finding 2.

## Important, but not merge-blocking

### 6. Some level and guide text remains treatment-like

**Status:** ❌ OPEN  
**Severity:** Medium  
**Files:** `js/i18n.js` campaign descriptions; `js/guide-data.js:268`

Phrases such as “use rapid insulin to keep blood glucose stable” and “may need more insulin” are attached to characters, but still sound like treatment goals. Replace them with character-bound experiments that ask the player to compare simulated effects.

### 7. Ketone and effective-ISF text provides precise clinical action signals

**Status:** ❌ OPEN  
**Severity:** Medium  
**Files:** `js/i18n.js:265`, `index.html:513`

Bind ketone wording explicitly to the game. Consider presenting effective insulin sensitivity as a relative model effect rather than an absolute current mmol/L/U value.

### 8. The public editor file still contains inactive developer scenario functions

**Status:** ❌ OPEN  
**Severity:** Medium  
**Files:** `js/editor.js:2503-2507`, `js/editor.js:2525+`, `js/editor.js:2942+`, public API near `js/editor.js:2980`

The ordinary public UI does not expose new/load/save/export/print, but much of the old scenario I/O remains distributed, including profile serialization and mutable debug state. Remove or move this dead developer code as architectural hardening.

### 9. README documents a general engine with free model parameters

**Status:** ❌ OPEN  
**Severity:** Medium  
**File:** `README.md:143-189`

This does not automatically make the public game medical-device software. Clarify that the engine is a separate development and research component for hypothetical model subjects, and retain the statement that modified products require their own purpose assessment.

### 10. Internal language retains unnecessary clinical or validation claims

**Status:** ❌ OPEN  
**Severity:** Low  
**Examples:** `js/levels.js:155`, `docs/INTENDED-PURPOSE.md:41`, older review documents

Prefer “game target informed by TIR literature” over “clinically recommended target”, and “population model supported by published literature” over “well-validated model”.

## Deferred enhancement

Monte Carlo uncertainty bands in What If would reinforce that the displayed course is not a precise prediction. This is educationally valuable but is not required for the first merge if the five merge-gate findings above are resolved.

## Recommended order of work

1. Decide whether TIR and mean glucose should be removed from the whole game.
2. Rewrite basal wording in the tour and guide.
3. Complete the Game Guide fixes in the companion review.
4. Run text-sync, guide mapping and browser regression tests before merge.
