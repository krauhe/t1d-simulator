# Relaxation GLUT4 Adjustment

## Background

The relaxation activity covered yoga, meditation, breathing exercises, and stretching, but the implementation treated all of them as having zero active GLUT4-mediated muscle uptake. The user asked for one conservative combined representation, without adding more activity types.

## Diagnosis

The existing stress-reduction mechanism is still appropriate for meditation and breathing. However, yoga and stretching can include mechanical strain or light muscle work. Kerris et al. 2019 reported that passive stretching can stimulate skeletal muscle glucose uptake in isolated mouse muscle, while Pascoe et al. 2017 found yoga interventions associated with lower stress-related physiological markers and lower fasting glucose compared with active controls.

This supports a small active component, but not a full exercise-like response. The evidence is indirect for T1D gameplay dosing, so the implementation should remain conservative.

## Solution

`afslapning` now keeps one shared activity type:

- `e1Scaling = 0.10`, representing a weak active GLUT4 component during yoga/stretching.
- `e2Scaling = 0.0`, so there is still no post-exercise insulin-sensitivity boost.
- Heart-rate targets are now 58 / 65 / 75 bpm for low / medium / high. Low remains below baseline and therefore produces no direct E1 effect; medium/high represent gentle or dynamic yoga/stretching.

This keeps the model distinct from cardio, strength, and mixed sport while allowing yoga/stretching to affect BG a little through active muscle uptake.

## Verification

Added an automated test that compares E1 during medium relaxation, quiet relaxation, and medium cardio. The intended behavior is:

- medium relaxation produces slightly more E1 than quiet relaxation;
- medium relaxation remains under 5% of medium cardio E1.

## Sub-agent Input

No sub-agent was used.

## Files Cited

- `js/simulator.js:257` - relaxation activity definition
- `js/simulator.js:262` - relaxation heart-rate targets
- `js/simulator.js:263` - relaxation E1 scaling
- `tests/simulation.test.js:1208` - regression test for small active relaxation E1
- `docs/MODEL-IMPLEMENTATION.md:1261` - relaxation model documentation
- `docs/MODEL-IMPLEMENTATION.md:1288` - stretch/yoga rationale
- `docs/MODEL-IMPLEMENTATION.md:1460` - parameter overview table

## Sources

- Kerris JP, Betik AC, Li J, McConell GK. 2019. Passive stretch regulates skeletal muscle glucose uptake independent of nitric oxide synthase. PubMed: https://pubmed.ncbi.nlm.nih.gov/30236052/
- Pascoe MC, Thompson DR, Ski CF. 2017. Yoga, mindfulness-based stress reduction and stress-related physiological measures: A meta-analysis. PubMed: https://pubmed.ncbi.nlm.nih.gov/28963884/
