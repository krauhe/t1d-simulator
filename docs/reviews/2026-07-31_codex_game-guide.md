# Game Guide review before public What If merge

**Generated:** 2026-07-31  
**Branch reviewed:** `codex/public-insights`  
**Status:** Review complete; findings remain open  
**Scope:** `js/guide-data.js`, related tips and i18n text, guide mappings and intended-purpose consistency

**Rewrite draft:** A complete shorter Danish proposal is available in `docs/reviews/2026-07-31_game-guide-rewrite-proposal-da.md`. The active bilingual guide has not yet been changed.

## Conclusion

The guide has a useful overall structure and Danish and English are broadly aligned. It should not be merged unchanged:

- public What If is not explained;
- at least four tips or levels link to missing or wrong guide sections;
- basal, illness, ketone and glucagon passages can read as general treatment guidance;
- several sections are too long and technically dense for children, newly diagnosed people and relatives.

The Danish guide contains approximately 1,779 words. The existing content can be shortened by about 30-35%. After adding one short What If section, the full guide should still be approximately 25-30% shorter.

## Must be fixed before merge

### 1. Add a short What If section

**Status:** ❌ OPEN  
**Severity:** High  
**Files:** `js/guide-data.js:71`, `index.html:1434`, `js/i18n.js:373+`

Explain only that What If:

1. uses the already selected fixed character;
2. lets the player alter actions in a simulated course;
3. compares alternatives without selecting a best choice;
4. does not transfer changes back to the paused game.

Keep What If separate from the two game modes; it is a learning view opened from an active game, not a third mode.

### 2. Correct guide mappings and add a mapping test

**Status:** ❌ OPEN  
**Severity:** High  
**File:** `js/guide-data.js:408-446`

Confirmed mapping problems:

1. `campaign.level1.tip.splitDose` matches generic `dose` and opens `rapid-iob`, although it concerns basal insulin.
2. `campaign.level2.tip.onsetUncertainty` matches generic `onset` and opens `rapid-iob`, although it concerns dawn effect.
3. `tips.nightAction` matches no guide rule.
4. Level 5 includes `stress-dawn-illness` despite being the low-carb level.

Use explicit exceptions before generic substring rules and add an automated test covering every active tip key and level link.

### 3. Rewrite treatment-like passages as character-bound experiments

**Status:** ❌ OPEN  
**Severity:** High  
**Files:** `js/guide-data.js:136`, `js/guide-data.js:205`, `js/guide-data.js:268`, `js/guide-data.js:289-298`

Rewrite:

- basal drift and dose splitting;
- illness and insulin need;
- glucagon as a general backup;
- “if ketones rise, give the character insulin”.

Describe the model mechanism first, then the observation the player can make in the game. Keep insulin choices in third person and tied to the fixed character.

### 4. Remove inaccessible game-over mechanics

**Status:** ❌ OPEN  
**Severity:** High  
**File:** `js/guide-data.js:389-402`

Remove the public guide paragraphs about 7% weight change and a seven-day mean above 15 mmol/L. The current public campaign lasts three days, weight game-over is disabled there, and Box Challenge is a daily challenge.

### 5. Reduce the longest sections

**Status:** ❌ OPEN  
**Severity:** High  
**Files:** `js/guide-data.js:90`, `js/guide-data.js:150`, `js/guide-data.js:173`, `js/guide-data.js:389`

Targets:

1. `controls`: reduce by 35-40%; remove duplicate shortcut explanations.
2. `rapid-iob`: reduce by 25-30%; keep the short IOB definition and move or remove secondary concepts.
3. `food`: reduce by 35-40%; remove repeated explanations of fast/slow food and fat/protein.
4. `levelend`: retain only mechanics the player actually meets.

## Additional findings

### 6. Physiology-view scoring text is inconsistent

**Status:** ❌ OPEN  
**Severity:** Medium  
**File:** `js/guide-data.js:106`

English says the view pauses scoring; Danish says the run does not count. The game still calculates points but does not save the result. Use in both languages: “When Physiology view is used, the experiment's points are not saved.”

### 7. Third-person perspective breaks in sensitive sections

**Status:** ❌ OPEN  
**Severity:** Medium

Use “the character's blood glucose”, “in the model”, “in the level” or “the game action” whenever insulin choices are discussed. Avoid generic instructions about dose, need or correction.

### 8. Too many specialist terms are concentrated in short passages

**Status:** ❌ OPEN  
**Severity:** Medium

ISF, ICR, IOB, stacking, glucotoxicity, fat-induced insulin resistance, glycogenolysis and counter-regulation appear densely. Keep only terms needed to understand the visible game. ICR is a strong candidate for removal because it is no longer an active player concept elsewhere.

### 9. “Change one thing at a time” is repeated and unnecessarily prescriptive

**Status:** ❌ OPEN  
**Severity:** Medium  
**Files:** `js/guide-data.js:58`, `js/i18n.js:684`

Suggested direction: “Try actions and see what changes the character's blood glucose.”

### 10. The points section can resemble dose optimisation

**Status:** ❌ OPEN  
**Severity:** Medium  
**File:** `js/guide-data.js:368`

Replace the list of timing, dose, food and activity as optimisation targets with: “A low score means the level can be tried again with different game actions.”

### 11. Remove vague or AI-like wording

**Status:** ❌ OPEN  
**Severity:** Low

Examples include “practice room”, “hidden model layers”, “the later curve”, “an extra look later in the evening”, “the brain's reserve runs out” and the English word “cooldown” in Danish text. Prefer concrete references to blood glucose, model processes, later in the course and waiting time.

### 12. Resolve language inconsistencies

**Status:** ❌ OPEN  
**Severity:** Low

Use one Danish spelling of glucagon/glukagon and replace the English `Settings` label in Danish.

## Sections worth preserving

1. `cgm`: concrete distinction between CGM and fingerprick.
2. `body-signals`: symptom list and overlapping causes.
3. `activity`: distinction between cardio, strength exercise and delayed effects.
4. `energy`: direct relationship between food, activity and energy balance.
5. The first three paragraphs of `ketones`.
6. The IOB definition in `rapid-iob`.
7. The Box Challenge description in `modes`.

## Verification required after rewriting

1. Synchronise English and Danish text and version markers.
2. Run `bash tests/check-text-sync.sh`.
3. Run `tests/.bin/node.exe tests/check-intended-purpose-text.js`.
4. Add and run a complete guide-tip mapping test.
5. Syntax-check `js/guide-data.js`, `js/i18n.js` and any changed guide UI file.
6. Browser-test guide links, What If help and the longest sections on desktop and mobile.
