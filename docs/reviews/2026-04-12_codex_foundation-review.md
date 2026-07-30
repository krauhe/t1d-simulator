# Review Report - Foundation for Full Remediation

Date: 2026-04-12
Author: Codex
Scope: Documentation, logic, realism, internal consistency, repo process

## Purpose

This report consolidates the findings from a broad repository review and turns them into a practical foundation for a later full clean-up pass.

The goal is not just to list isolated bugs, but to identify the structural issues that currently weaken trust in the simulator:

- places where code and documentation disagree
- places where the UI teaches the wrong physiology
- places where project rules contradict each other
- places where maintenance process is too brittle to keep things in sync

## Review basis

The review was based on:

- `CLAUDE.md` as the stated standard for how the project should be maintained
- `README.md`
- `docs/MODEL-IMPLEMENTATION.md`
- `docs/MODEL-IMPLEMENTERING.da.md`
- `docs/BG-SCIENCE.md`
- `docs/BG-VIDENSKAB.da.md`
- `index.html` help content
- `js/simulator.js`
- `js/hovorka.js`
- `tests/simulation.test.js`

Validation performed:

- `node tests/simulation.test.js` was run successfully
- Result observed: `122/122 tests passed`

Constraint:

- `bash tests/check-text-sync.sh` could not be run in the current environment because `bash` was not available, so text sync was checked manually instead.

## Executive summary

The core simulation engine currently looks materially stronger than the surrounding documentation/process layer.

The main problem is not that the physiological engine is broadly broken. The main problem is that the repository increasingly contains multiple conflicting "truths" about how the simulator works.

At the moment:

- the code is often ahead of the docs
- the Danish docs are not reliably synced to the English source despite sync markers claiming that they are
- the help popup and README contain stale product claims
- `CLAUDE.md` contains contradictory maintenance rules
- at least one concrete logic bug exists in the pedagogical force display

This means a future remediation effort should start with consistency and trust repair, not with deeper physiology expansion.

## High-priority findings

### 1. FFA resistance is shown as active even at baseline

Severity: High
Type: Logic bug in pedagogical UI/physiology display

In `_computeBGForces()` the code currently adds an `ffaResistance` upward force whenever:

`this.ffaResistanceFactor > 0.01`

But baseline is `1.0`, which means the force appears even when there is no real FFA-induced resistance.

The magnitude is also computed from the full factor:

`this.ffaResistanceFactor * this.hovorka.EGP_0 * 0.3`

instead of from the excess above baseline.

Observed effect:

- the physiology panel/dashboard teaches that FFA resistance is always active
- the display overstates pathology at rest
- the "forces" view becomes less trustworthy as an explanatory tool

Relevant file:

- `js/simulator.js`

Recommended correction:

- only show FFA resistance when the factor is meaningfully above baseline, for example `> 1.01`
- compute magnitude from `(ffaResistanceFactor - 1.0)`, not from the full factor
- add regression tests to prevent the same type of mistake in other derived force displays

**STATUS:** ✅ FIKSET (2026-04-12) — Condition changed to > 1.01, magnitude uses (factor - 1.0)

### 2. Danish DKA documentation is materially out of sync with the actual implementation

Severity: High
Type: Documentation correctness / translation sync failure

The Danish model documentation claims:

- `ACIDOSIS_THRESHOLD = 1800`
- acidosis only accumulates when `insulinSuppression > 0.3`

But the actual code now uses:

- `ACIDOSIS_THRESHOLD = 600`
- a smooth transition gate based on `smoothstep`, not the old hard threshold

The English model doc appears updated, while the Danish doc is still describing an older implementation.

This is especially problematic because the Danish file starts with a translated-from marker claiming it matches the English source version.

Observed effect:

- a Danish reader gets the wrong explanation of how dangerous DKA becomes
- the project's own sync metadata becomes unreliable
- "English is source of truth" is not being enforced in practice

Relevant files:

- `docs/MODEL-IMPLEMENTERING.da.md`
- `docs/MODEL-IMPLEMENTATION.md`
- `js/simulator.js`

Recommended correction:

- re-translate the DKA section from the current English source
- update the threshold from `1800` to `600`
- describe the smooth insulin gate correctly
- only keep the `translated-from` marker if the content is actually brought into sync

**STATUS:** ✅ FIKSET (2026-04-12) — ACIDOSIS_THRESHOLD=600, smoothstep gate, version markers synced

## Medium-priority findings

### 3. Model documentation contradicts itself about DKA game over

Severity: Medium
Type: Internal documentation inconsistency

One section correctly describes DKA as driven by an acidosis load model.

Another section in the limitations/caveats still says the DKA game over condition is "timer-based rather than directly tied to BHB levels".

Those two statements cannot both be true in the current implementation.

Observed effect:

- readers cannot tell whether DKA is actually modeled or just approximated by a timer
- the docs weaken confidence in the simulation's explanatory precision

Recommended correction:

- rewrite the limitation to say that acid burden is modeled indirectly via load accumulation
- clarify what is not explicitly modeled: blood pH, dehydration, electrolyte disturbance, DKA-induced insulin resistance feedback

**STATUS:** ✅ FIKSET (2026-04-12) — "timer-based" rewritten to "acidosis load accumulation" in both EN and DA docs

### 4. Repo-wide drift in reported test count

Severity: Medium
Type: Product/documentation drift

The repo currently reports multiple different numbers for automated tests:

- `CLAUDE.md`: 111
- `README.md`: 95 in one place
- `README.md`: 100 in another place
- help popup in `index.html`: 100
- actual current suite run: 122

Observed effect:

- easy-to-verify claims are visibly inconsistent
- this reduces trust in harder-to-verify scientific claims
- maintenance looks less disciplined than the underlying code actually is

Recommended correction:

- standardize all user-facing references
- preferable wording: `120+ automated tests`
- avoid hardcoding exact counts in many files unless there is a release checklist that updates them all together

**STATUS:** ✅ FIKSET (2026-04-12) — All references updated to "120+"

### 5. `CLAUDE.md` is not reliable as a single standard because it contains contradictory rules

Severity: Medium
Type: Process/maintainability issue

Examples of contradiction:

- it says all physiological modeling should be collected in `js/simulator.js`
- but the actual architecture includes a dedicated core engine in `js/hovorka.js`

It also appears to describe two incompatible review file conventions:

- reviews in `docs/reviews/`
- review reports in the project root with another naming style

Observed effect:

- later contributors cannot tell which rules are current
- repo hygiene becomes dependent on memory and interpretation
- review findings become harder to close systematically

Recommended correction:

- reduce `CLAUDE.md` to current authoritative rules only
- explicitly state the real architecture:
  - `js/hovorka.js` = validated ODE core
  - `js/simulator.js` = higher-level physiology orchestration and gameplay physiology
- choose one rule for review-file storage and delete the stale one

**STATUS:** ✅ FIKSET (2026-04-12) — Architecture clarified, stale review rule removed, ODE count corrected

## Low-priority findings

### 6. Metadata drift in docs

Severity: Low
Type: Documentation hygiene

`docs/MODEL-IMPLEMENTATION.md` has:

- `doc-version: 2026-04-12-v1`

but still ends with:

- `Last updated: March 2026`

Observed effect:

- version metadata cannot be trusted at a glance
- makes translation/version workflow look weaker than intended

Recommended correction:

- either remove the human-readable "Last updated" line entirely
- or enforce that it always matches the doc version date

**STATUS:** ✅ FIKSET (2026-04-12) — "Last updated" removed from both EN and DA docs

### 7. Help-template version markers are stale

Severity: Low
Type: Process/documentation hygiene

The help templates in `index.html` still carry version markers from `2026-04-10-v5`, while the docs have moved on.

Observed effect:

- help content can drift silently
- sync markers no longer prove anything

Recommended correction:

- treat help content as part of the same documentation sync workflow
- bump help version markers whenever docs/help text is materially changed

**STATUS:** ✅ FIKSET (2026-04-12) — Help markers bumped to 2026-04-12-v1

## What appears strong today

This review also found important strengths that should be preserved during remediation:

- the simulation test suite is broad and currently passes in full
- the core physiological engine appears structurally coherent
- several nuanced systems are already in place:
  - fat delay and FFA resistance
  - protein-glucagon pathway
  - ketone/acidosis separation
  - HAAF
  - glycogen tracking
  - exercise subtype behavior
  - glucotoxicity

Implication:

- a later remediation should avoid destabilizing the engine unnecessarily
- focus first on consistency, correctness of explanation, and a few targeted logic fixes

## Foundation for a later full remediation

The future clean-up should be organized in stages.

### Stage 1. Trust repair

Goal:

- make the repo stop contradicting itself

Work:

- fix the FFA force display bug
- sync English and Danish DKA documentation
- harmonize test counts in README/help/docs
- fix stale metadata and version markers

### Stage 2. Process repair

Goal:

- reduce the probability of future drift

Work:

- clean up `CLAUDE.md`
- define one source of truth for repo/process rules
- define one source of truth for product claims like test coverage
- add a lightweight consistency checklist for future merges

### Stage 3. Regression protection

Goal:

- ensure explanatory/UI logic is tested, not only physiological internals

Work:

- add tests for `_computeBGForces()`
- add checks for documentation/version sync where practical
- consider replacing the Bash-only text sync script with a Windows-friendly implementation

### Stage 4. Optional deeper realism pass

Only after the above is stable.

Potential later targets:

- review any remaining mismatches between docs and code for exercise, glycogen, glucotoxicity, and help text
- decide whether all user-facing texts should use precise numbers or "soft" product claims
- consider whether more automated extraction of counts/metadata is worth the maintenance cost

## Concrete remediation backlog

### A. Code corrections

1. Fix FFA force visibility logic in `js/simulator.js`
2. Review the same method for other baseline-as-pathology display errors
3. Add regression tests for force-panel behavior in `tests/simulation.test.js`

### B. Documentation corrections

4. Sync English DKA documentation with current code wording
5. Re-sync Danish DKA documentation from English
6. Remove the "timer-based DKA game over" wording from limitations
7. Fix stale `Last updated` metadata

### C. Product text corrections

8. Harmonize automated test count across README/help/repo docs
9. Update help-template version markers in `index.html`

### D. Process corrections

10. Clean up contradictory rules in `CLAUDE.md`
11. Standardize review file location rules
12. Add a simple consistency checklist
13. Replace or supplement `tests/check-text-sync.sh` with a Windows-compatible alternative

## Suggested commit plan for the future cleanup

### Commit 1

Title:

- `Fix force-panel baseline false positive for FFA resistance`

Contents:

- `js/simulator.js`
- `tests/simulation.test.js`

### Commit 2

Title:

- `Sync DKA model documentation with current implementation`

Contents:

- `docs/MODEL-IMPLEMENTATION.md`
- `docs/MODEL-IMPLEMENTERING.da.md`

### Commit 3

Title:

- `Harmonize test coverage and help/documentation metadata`

Contents:

- `README.md`
- `index.html`
- version markers / metadata only

### Commit 4

Title:

- `Clean up maintenance rules and add consistency workflow notes`

Contents:

- `CLAUDE.md`
- optional new checklist file in `docs/` or `tests/`

## Closing assessment

The simulator does not currently look like a failing physiology project. It looks like a project whose engine has outgrown its maintenance discipline.

That is good news, because it means the most valuable next work is not a risky rewrite. It is a controlled consistency pass:

- fix the few known logic leaks
- restore trust between code and docs
- tighten the maintenance workflow so future improvements do not create more drift

If those steps are done first, a later deeper remediation can build on a much more stable foundation.
