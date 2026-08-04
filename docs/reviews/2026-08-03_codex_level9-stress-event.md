# Review: Level 9 stress event and Hvad Nu Hvis continuity

**Date:** 2026-08-03  
**Reviewer:** Codex (`phys-reviewer`)  
**Scope:** Level 9 acute/chronic stress response, graph history and locked replay in Hvad Nu Hvis

## Executive summary

The small eISF response during the day-1 event is not caused by an already-reduced baseline. The event uses `acuteStress`, which changes hepatic glucose output but does not enter the implemented eISF resistance factor. Only `chronicStress`, used for the day-2 illness event, reduces eISF. The implementation is internally consistent with the current level text, but it is a physiological simplification because the science review also describes transient catecholamine-mediated impairment of insulin action during acute psychological stress.

The disappearing graph interval was a separate UI defect: ordinary campaign markers faded after their end. The level-9 stress and illness markers now remain as historical markers. Both stress events are also exported as locked scenario events and replayed by the shared physiology engine in Hvad Nu Hvis; they are kept outside the editable action array and therefore cannot be moved, deleted or varied.

## Findings

### 1. Day-1 acute stress does not reduce eISF

**Severity:** Medium (model-completeness gap, not a runtime defect)  
**STATUS:** ❌ OPEN

- Level 9 injects `acuteStress = 0.30` at 10:30 (`js/levels.js:1181`).
- The eISF resistance term is `1 + chronicStressLevel x 0.5`; acute stress is absent (`js/physiology-engine.js:2306`, `js/physiology-engine.js:2609`).
- A deterministic check gave identical eISF immediately before and after acute stress. In contrast, `chronicStress = 0.40` reduced eISF by 11.2% after 30 minutes and 14.5% after 60 minutes.
- The acute level decays with a 60-minute half-life: 0.30 at 10:30 becomes approximately 0.106 at 12:00 and 0.027 at 13:58. The screenshot was therefore taken after most of the hepatic stress signal had washed out.
- `BG-SCIENCE.md` section 20 reports that acute psychological stress can delay postprandial glucose decline and describes transient catecholamine-mediated reduction in insulin-mediated disposal. Adding this mechanism would require a separately calibrated model change and literature-linked tests; it was not introduced as part of this UI/history fix.

### 2. The level-9 marker disappeared after the event

**Severity:** High (the player loses the causal history needed for learning)  
**STATUS:** ✅ FIKSET (2026-08-03, local working tree)

- The 10:30-12:00 interval used the default campaign-marker fade and was invisible 60 minutes after its end.
- Both level-9 markers now use `persistAfterPast`, matching the existing historical-marker design (`js/levels.js:1213`, `js/levels.js:1222`).

### 3. Stress physiology was absent from Hvad Nu Hvis replay

**Severity:** High (alternative curves were generated from a different physiological scenario)  
**STATUS:** ✅ FIKSET (2026-08-03, local working tree)

- The scenario export previously contained only player actions and Box Challenge geometry.
- Campaign now exposes fired, explicitly locked physiological events (`js/campaign-core.js:1738`).
- Simulator export translates those events onto the local scenario timeline (`js/simulator.js:2101`, `js/simulator.js:2132`).
- Hvad Nu Hvis replays them in both the canonical curve and every variation, but stores them outside `events[]`, so they receive no hit box or editor menu (`js/editor.js:303`, `js/editor.js:398`).
- Their interval/point markers are rendered through a non-interactive under-curve hook (`js/editor.js:1365`, `js/ui.js:986`).

## Verification

- `node --check` passed for all six changed JavaScript files.
- `tests/simulation.test.js`: 195/195 passed.
- New regression checks confirm:
  - acute stress leaves eISF unchanged while chronic stress reduces it;
  - locked campaign stress is exported separately from editable actions;
  - event type, amount, time and historical interval are preserved.
- Manual browser verification in campaign level 9 confirmed that the 10:30-12:00 stress interval remains visible after the event has ended.
- Opening Hvad Nu Hvis later the same day preserved the stress interval and replayed the locked event in the alternative curve. Clicking and dragging the marker did not open an editor menu or move the event.
- Browser console verification found no JavaScript errors. Tone.js only reported the expected suspended-audio warning while music was disabled.
- `tests/public-release-boundary.test.js` passed and now verifies that locked scenario events are limited to the two fixed stress types with finite time and strength; no weight, ISF or ICR is exported.

## Status summary

- Fixed: 2
- Open model decision: 1
- Blocked: 0

## Files cited

- `js/levels.js:1181`, `js/levels.js:1213`, `js/levels.js:1222`
- `js/campaign-core.js:1738`
- `js/game.js:555`
- `js/simulator.js:2101`, `js/simulator.js:2132`
- `js/editor.js:303`, `js/editor.js:398`, `js/editor.js:1365`
- `js/ui.js:986`, `js/ui.js:2063`, `js/ui.js:2141`
- `js/physiology-engine.js:2306`, `js/physiology-engine.js:2609`
- `tests/simulation.test.js:4239`
- `docs/BG-SCIENCE.md:1961`
- `docs/MODEL-IMPLEMENTATION.md:1888`
