<!-- doc-version: 2026-07-30-v2 -->
# Physiology engine API

This document describes the API surface of `js/physiology-engine.js`.

> Language note: this file is **English-only** (like `MODEL-IMPLEMENTATION.md` and
> `BG-SCIENCE.md`), because it is the reference for external developers building on the
> engine. The engine's own in-code comments remain in Danish (project convention).

**Architecture (after S9).** `PhysiologyEngine` is a **self-contained, general-purpose
physiology engine**: it owns the simulation clock, all physiological state and constants,
its own `HovorkaModel` ODE core, the entire physiology tick (`step()`: insulin prep,
carb/heart-rate prep, the substep loop, post-IOB, CGM signal), steady-state
initialization (`initSteadyState`/`reset`), the interventions (food/insulin/activity/
glucagon, with a built-in activity catalog), a read API (`getState`/`getFluxSnapshot`/
`getPhysiologySnapshot`), opt-in clinical events, and the lab API (determinism, `setBG`,
plasma clamp, `exportState`/`importState`, `runScenario`).
It also owns the mechanisms that used to be triggered from the facade — day-1 dawn
seeding, the CGM sensor state machine (auto self-test, sensor loss) and sleep
disruption (night-time interventions accrue sleep loss that converts to chronic
stress the next morning) — so a bare engine reproduces the full game physiology
without any facade help.
The engine has no DOM, sound, i18n, score or globals dependencies; it speaks only
mmol/L, raw numbers and structured events. It builds its own Hovorka instance from the
profile (mapping the simulated subject's ISF via `HOVORKA_REFERENCE_ISF`), so a caller never needs
to know about the ODE core.

The `Simulator` facade is still the **game's** public surface and owns the game/UI layer:
each tick it calls `engine.step()`, supplies the graph-sampling `onSample` callback, and
runs the game post-processing (`_postStep`: graph data, sound, log, score, game-over, DOM,
Box Challenge). The facade delegates interventions and snapshots to the engine and adds
its game bookkeeping (campaign, cooldowns, game-specific basal pre-injection). The
sleep-disruption mechanism itself is engine-owned; the facade only triggers it for
game-only actions without an engine intervention (fingerstick, ketone test). New
applications can use `PhysiologyEngine` directly without the facade — see the
"Standalone use" example below.

See also:

- `docs/reviews/2026-06-14_physiology-engine-api-plan.md`
- `docs/reviews/physiology-engine-LOG.md`
- `tests/physiology-engine-api.test.js`

## Loading and creation

In the browser the engine is exported globally via a script tag:

```js
const engine = T1DPhysiologyEngine.createEngine(profile, options);
```

In Node tests and labs the core model files can be loaded with CommonJS `require()`:

```js
const { FOODS, CARB_TYPES } = require('../js/foods.js');
const { createEngine } = require('../js/physiology-engine.js');
const { HovorkaModel } = require('../js/hovorka.js');
const { Simulator } = require('../js/simulator.js');

const engine = createEngine(
    { weight: 70, isf: 3.0, icr: 10 },
    { seed: 123, noiseEnabled: true, steadyState: true }
);
```

### Profile contract

`profile` describes the simulated subject. In the game, each fixed fictional character supplies one such profile. All fields are optional with sensible defaults:

| Field    | Meaning                                     | Default |
|----------|---------------------------------------------|---------|
| `weight` | Body weight [kg]                            | 70      |
| `isf`    | Insulin sensitivity factor [mmol/L per U]   | 3.0     |
| `icr`    | Insulin-to-carb ratio [g per U]             | 10      |

Derived quantities (basal dose, TDD, resting kcal, the Hovorka insulin-sensitivity
scale) are computed from the profile in the constructor.

This is the **engine contract**, not the public game's input contract. The public web
application persists only a fixed fictional `characterId` and resolves weight, ISF and
ICR from `js/archetypes.js` immediately before constructing the engine. Raw profile
arguments are retained here for reproducible tests, calibration and model laboratories.
They configure a hypothetical model subject; the engine has not been
validated to predict an individual, even if a caller supplies values copied from a real
person.

### Options

| Option           | Meaning                                                          | Default |
|------------------|------------------------------------------------------------------|---------|
| `seed`           | Deterministic RNG sequence. Without a seed a random one is used. | random  |
| `noiseEnabled`   | Whether CGM sensor noise is applied (`!== false` ⇒ on).          | `true`  |
| `steadyState`    | `true` ⇒ `createEngine` calls `initSteadyState()` immediately, so the engine is at equilibrium with its own basal depot and does not drift. | `false` |
| `clinicalEvents` | `true` ⇒ `step()` emits edge-triggered clinical events (see Events). | `false` |
| `modules`        | Object of module toggles to dial/isolate physiology modules (see below). Unknown keys, out-of-range numbers or wrong types throw. | all full |

### Modules — dialing and isolating physiology

`options.modules` dials individual physiology mechanisms up or down, for labs, teaching or
a simplified game mode. Eight modules are **0..1 intensity scalars** (default `1` = full
effect; `0` = off; `0.5` = half strength); two are plain **booleans** (default `true`).
A boolean is also accepted for a scalar key and coerced (`true`→1, `false`→0), so existing
`{ dawn: false }`-style opt-outs keep working. All default to full strength, so the all-on
default — and golden-master bit-identity — is unchanged (every scalar enters as `× 1.0`).
Defining an "easy mode" is a game decision — the engine only exposes the switches.

```js
const engine = createEngine({}, { modules: { dawn: 0.5, ketones: 0, fatProtein: false } });
```

| Module              | Kind    | Scaling / off behaviour                                                  |
|---------------------|---------|--------------------------------------------------------------------------|
| `dawn`              | scalar  | Dawn phenomenon (morning cortisol HGP) + circadian ISF swing (× scale).  |
| `dawnVariability`   | scalar  | Day-to-day random variation in dawn amplitude/peak (0 ⇒ fixed mean).     |
| `stressResponse`    | scalar  | Acute counter-regulation, chronic stress and HAAF — both HGP and ISF effects (× scale; not the dawn cortisol). |
| `glucotoxicity`     | scalar  | Hyperglycemia-induced insulin resistance (resistance factor lerped to neutral). |
| `ketones`           | scalar  | Ketone production / DKA acidosis load (BHB production × scale; 0 ⇒ stays at baseline). |
| `sleepDisruption`   | scalar  | Night-intervention sleep loss → next-day chronic stress (sleep loss × scale). |
| `cgmSensorFaults`   | boolean | CGM warmup / auto self-test / sensor loss (off ⇒ sensor always `active`).|
| `insulinVariability`| scalar  | Per-injection PK randomness (τ/duration spread × scale; 0 ⇒ fixed τ and basal duration). |
| `fatProtein`        | boolean | Fat/protein meal effects — off ⇒ meals are carbs-only (no pizza-effect gastric slowing, no FFA, no protein-glucagon). |
| `ffaResistance`     | scalar  | FFA-induced insulin resistance — FFA still accumulates; resistance factor lerped to neutral by the scalar. |

Notes: the two boolean modules (`cgmSensorFaults`, `fatProtein`) are structural/discrete
and have no meaningful intermediate intensity. CGM sensor **noise** is the separate
`noiseEnabled`/`setNoise()` control, not a module. Disabling a module that uses RNG (dawn variability, insulin variability, CGM
faults) removes its RNG draws, so a seeded run differs from the all-on default — that is
expected; the all-on default is unchanged and bit-identical. `reset()` preserves the
module configuration. Weight/calorie tracking is toggled by the game facade, not here.

## The physiology tick: step()

`engine.step(simMinutes, options)` runs ONE complete physiology tick standalone and
returns `{ state, events }`:

```js
const { state, events } = engine.step(simMinutes, {
    onSample: sample => myGraphBuffer.push(sample) // optional per-minute graph callback
});
```

`step()` does the following in order (the ordering invariants are critical and preserved 1:1):

1. **Time bookkeeping:** advances `totalSimMinutes`, `timeInMinutes`, `day` and
   `totalKcalBurnedBase` (resting kcal).
2. **`_prepInsulinRates()`** — basal trapezoid rate, direct bolus deposition, rapid IOB.
3. **`_prepStepInputs(simMinutes)`** — carb rate into Hovorka D1/D2 (step-overlap
   weighted), COB, heart rate (gliding toward the activity target, hypo-reduced), exercise
   exercise-specific hepatic-drive rates, calorie/time accumulation and auto-stop
   (fixed duration or the 4 h limit → `stopActivity()` +
   `exercise-max-duration` event). Sets
   `hovorka.insulinRate/carbRate/heartRate/exerciseInput`.
4. **`_runSubstepLoop(...)`** — the substep integration (dt ≤ 1 min): stress hormones,
   food drip, fat/protein/FFA BEFORE `hovorka.step()` (plasma clamp before/after),
   ketones/muscle glycogen/glucagon AFTER, `trueBG` refresh + damage accumulators last.
   `onSample(sample)` is called ~1/min with graph data (the engine does not own the graph
   history).
5. **`_recomputePostStepIOB()`** — `iob`/`displayIOB` from the post-ODE state.
6. **`_sampleCgm()`** — 5-minute CGM sampling gate: sensor status + `_computeCgmBG()`
   (interstitial + noise + drift + jumps + compression), emits `cgm-sample`.
7. **`_emitClinicalEvents()`** — only if `clinicalEvents` is enabled: edge-triggered
   clinical events (glucose/ketones/acidosis/brain energy). Draws no RNG.

`events` is a copy of the engine event buffer (same as `peekEvents()`); call
`consumeEvents()` to drain it. `state` is `getState()` (see Read API).

## Steady state and reset

```js
engine.initSteadyState({ targetBG, establishDepot, preInjectAgeHours }); // → trueBG
engine.reset({ seed, steadyState });                                     // → this
```

`initSteadyState()` brings the engine to physiological equilibrium: it finds the basal
rate that yields `targetBG` (default 5.5), and — if `establishDepot !== false` (default
true) — establishes a basal insulin depot sized so the engine *holds* its level when
stepped instead of drifting. Without this a bare engine would start with an empty depot
→ basal rate 0 → BG climbs. The game facade calls it with `establishDepot:false` and
makes its own game-specific basal pre-injection. A basal depot always decays eventually;
very long standalone runs must receive another basal input because the modeled depot is finite.

`reset()` resets the engine to a fresh start with the same profile (all dynamic state,
clock, event buffer and Hovorka back to constructor defaults). Useful for labs running
many scenarios in a row. `reset({ steadyState: true })` brings it to equilibrium
immediately.

Physiological getters can be read directly: `currentISF`, `currentCarbEffect`,
`circadianISF`, `circadianKortisolNiveau`, `basalPlasmaInsulinBaseline`.

## Interventions

Pure physiological inputs. Catalog lookups (`CARB_TYPES`, `AKTIVITETSTYPER`,
`estimateEatTimeMin`) are game content and do not live in the engine — resolved values
are passed in (the engine carries sensible defaults). They emit structured events that a
UI can translate to sound/log.

All interventions follow the same pattern: one object with named fields.

```js
engine.addFood({ carbs, protein, fat, weight, eatTimeMin, carbParams, icon }); // → bool (false if stomach full)
engine.addRapidInsulin({ units });                          // rapid-acting bolus
engine.addBasalInsulin({ units, injectionTime, silent });   // long-acting basal
engine.startActivity({ type, intensity, durationMin, typeDef }); // → bool
engine.stopActivity();
engine.useGlucagon();                                       // → actualRelease_g (limited by liver glycogen)
```

`carbParams = { simpleFraction, fiberPerGram, retentionFactor }` (default = mixed).

`startActivity`: if `typeDef` is omitted, `type` is looked up in the engine's built-in
default catalog `ENGINE_DEFAULT_ACTIVITIES` (`cardio`, `styrke`, `blandet`, `afslapning`;
intensities `Lav`/`Medium`/`Høj`), so a standalone caller need not know the `typeDef`
contract. The game facade always passes the game's `AKTIVITETSTYPER[type]` and therefore
never touches the catalog.

`addFood`/`addRapidInsulin`/`startActivity` accept an optional `onAccept` callback (called
after the rejection gate, before side effects) which the game facade uses to insert its
own bookkeeping without changing the RNG/event order.

**Input validation.** The constructor (profile `weight`/`isf`/`icr`) and the interventions
validate their numeric inputs and throw a `TypeError` (non-number/`NaN`/`Infinity`) or
`RangeError` (out of range) with a message naming the field — a malformed call fails fast
instead of silently degrading (e.g. `addFood({ carbs: NaN })` would otherwise collapse to
0). Soft domain gates are unchanged: `addFood` returns `false` when the stomach is full and
`startActivity` returns `false` on cooldown or an unknown activity type.

**Glucagon.** `useGlucagon()` has no cooldown in the engine — the physiological limit is the
available liver glycogen (`useGlucagon` releases up to ~35 g, capped by `liverGlycogenGrams`,
so a depleted depot gives a reduced or absent effect). The 24-hour single-kit cooldown is a
game rule and lives in the `Simulator` facade, not the engine.

## Read API

```js
engine.getState();              // compact numeric core state (BG, iob, cob, ketones, weight, time, …)
engine.getFluxSnapshot();       // BG flux/modifier decomposition (up/down forces, sorted)
engine.getPhysiologySnapshot(); // full grouped snapshot (insulin/food/stress/liver/ketones/…)
```

All three are pure derivations (no mutation, no RNG). `exportState()` is the full
serialization snapshot with metadata; these are readable slices for UI/labs.

## Standalone use (without the Simulator facade)

The engine builds its own Hovorka core and can start at equilibrium — no `attachHovorka`,
no manual `setBG` needed:

```js
const { createEngine } = require('../js/physiology-engine.js');

// steadyState:true → the engine is at equilibrium with its own basal depot from the start.
// clinicalEvents:true → step() reports clinical events.
const engine = createEngine(
    { weight: 70, isf: 3.0, icr: 10 },
    { seed: 42, steadyState: true, clinicalEvents: true }
);

engine.addFood({ carbs: 40 });
engine.addRapidInsulin({ units: 4 });

for (let min = 0; min < 180; min++) {
    const { state, events } = engine.step(1);
    for (const e of events) {
        if (e.type === 'glucose-low') console.log(`min ${min}: hypo (${e.severity}) ${e.data.trueBG.toFixed(1)}`);
    }
    console.log(min, state.trueBG.toFixed(2), state.iob.toFixed(2));
    engine.consumeEvents(); // drain the buffer (step returns a copy, does not drain)
}
```

In the browser use `T1DPhysiologyEngine.createEngine(...)` the same way (Hovorka is loaded
via `hovorka.js` before `physiology-engine.js`).

## Determinism

The engine distinguishes two independent controls:

- `seed`: reproducible randomness sequence.
- `noiseEnabled`: whether CGM sensor noise is applied.

```js
engine.setNoise(false); // clean CGM signal with no proportional noise, drift or discontinuity
engine.setNoise(true);  // normal sensor noise
```

`setNoise()` draws no RNG and does not change the seed. The default `true` is
bit-identical with normal game behavior.

## Snapshot

`exportState()` returns a read-only snapshot of engine-owned state:

```js
const snapshot = engine.exportState();
```

Format:

```js
{
    version: 1,
    seed: 123,
    rngState: 123456789,
    eventCount: 0,
    state: {
        trueBG: 5.5,
        cgmBG: 5.5,
        // other engine-owned physiology fields
    }
}
```

The snapshot copy is deep for arrays and plain objects and preserves values like
`Infinity` and `undefined`. That is why JSON stringify/parse is not used for the copy.

The following fields are not exported as state:

- `rng`: the RNG function is exported via `seed` and `rngState`.
- `events`: the event buffer is exported only as `eventCount`.
- `hovorka`: engine-owned Hovorka object (built in the constructor; not serialized).
- `scenarioRunner`: optional runner bridge for `runScenario` (not physiological state).

`importState(snapshot)` restores engine state from the version 1 format:

```js
engine.importState(snapshot);
```

The import preserves the existing `rng`, `hovorka` and `scenarioRunner` references, so the
Simulator facade does not lose its callbacks/references. The event buffer is cleared on
import, because concrete events are not stored in snapshot v1.

## Hovorka ownership

The engine owns its own Hovorka ODE core (S9.1). It is built in the constructor from the
profile:

```js
this.hovorka = new HovorkaModelClass(this.weight, {
    insulinSensitivityScale: this.ISF / HOVORKA_REFERENCE_ISF  // 3.75
});
```

The `HovorkaModel` class is found via global (browser) or `require` (Node). The engine
drives `hovorka.step()` inside `_runSubstepLoop()` and uses Hovorka in lab API methods
(`setBG`, `setPlasmaInsulinClamp`) and ketone/CGM calculations. `attachHovorka(model)`
still exists for advanced use (overriding the engine's own instance, e.g. a test that
wants to inject a preconfigured model), but is normally not needed.

## setBG

`setBG(mmolL)` sets the starting BG for lab use:

```js
engine.setBG(8.0);
```

The method:

- requires a positive, finite mmol/L number
- requires an attached Hovorka model
- sets `engine.trueBG`
- sets `engine.cgmBG`
- scales Hovorka Q1 (`state[4]`) to `mmolL * V_G`
- scales Hovorka Q2 (`state[5]`) proportionally
- sets the CGM compartment C (`state[10]`) to the same BG

`setBG()` does not reset insulin, food, activity, stress, ketones or other physiological
effects. It is therefore an initialization/lab method, not a respawn reset.

## Plasma insulin clamp

`setPlasmaInsulinClamp(valueOrNull)` holds Hovorka's plasma insulin `state[6]` in mU/L:

```js
engine.setPlasmaInsulinClamp(20);  // active clamp
engine.setPlasmaInsulinClamp(null); // normal Hovorka dynamics
```

When the clamp is active the engine calls `applyPlasmaInsulinClamp()` just before and just
after each `hovorka.step(stepDt)` inside `_runSubstepLoop()`. This means the Hovorka action
variables and the ketone model see the clamped plasma insulin value.

The default is `null`, so normal simulation is unchanged.

## Events

The engine has an internal event buffer for physiological events:

```js
engine.emitEvent('food-added', { carbs: 20 });
const events = engine.consumeEvents();
```

Methods:

- `emitEvent(type, data, severity)`
- `peekEvents()`
- `consumeEvents()`

Engine events are machine-readable and use raw data. The Simulator facade translates them
into i18n, log, sound, DOM, score, life loss and game-over.

The engine must not call `logEvent`, `playSound`, `document`, `window`, `gameOver` or UI
functions directly.

### Clinical events (opt-in)

With `clinicalEvents: true` the `step()` emits edge-triggered physiological events (only on
zone TRANSITIONS, not per tick), so a standalone consumer can subscribe instead of polling
`getState()`:

| Event                    | severity                          | Trigger |
|--------------------------|-----------------------------------|---------|
| `glucose-low`            | `mild` / `significant` / `severe` | BG < 3.9 / 3.0 / 2.5 mmol/L |
| `glucose-high`           | `mild` / `high` / `severe`        | BG > 10 / 13.9 / 20 mmol/L |
| `glucose-in-range`       | `info`                            | back in 3.9-10 mmol/L |
| `ketones-elevated`       | `mild` / `high` / `severe`        | BHB > 0.6 / 1.5 / 3.0 mmol/L |
| `ketones-normal`         | `info`                            | BHB < 0.6 mmol/L |
| `acidosis-risk`          | `warning` / `severe`              | acidosisLoad > 25% / 60% of threshold |
| `acidosis-cleared`       | `info`                            | acidosisLoad < 25% of threshold |
| `brain-energy-low`       | `warning` / `severe`              | brainEnergyDeficit > 25% / 60% of threshold |
| `brain-energy-recovered` | `info`                            | brainEnergyDeficit < 25% of threshold |

Default OFF: the game facade does not use them, so the game's event stream is unchanged.

## runScenario

`runScenario(events, durationMinutes, stepMinutes)` runs a lab scenario via a registered
runner:

```js
const result = engine.runScenario([
    { time: 0, type: 'setBG', value: 8.0 },
    { time: 30, type: 'food', carbs: 40, protein: 10, fat: 5 },
    { time: 45, type: 'rapidInsulin', units: 3 }
], 240, 5);
```

Returns:

```js
{
    durationMinutes: 240,
    stepMinutes: 5,
    samples: [
        { time: 0, trueBG: 8.0, cgmBG: 8.0, iob: 0, cob: 0 }
    ],
    finalState: engine.exportState()
}
```

Event time can be given as `time`, `minute`, `at` or `t`. The time is in sim-minutes from
scenario start. Events are sorted by time and then original order.

The event schema supports:

- `{ type: 'setBG', value }`
- `{ type: 'setNoise', enabled }`
- `{ type: 'setPlasmaInsulinClamp', value }`
- `{ type: 'food', carbs, protein, fat, icon, weight, carbType, eatTimeMin }`
- `{ type: 'rapidInsulin', units }`
- `{ type: 'basalInsulin', units, injectionTime, silent }`
- `{ type: 'activity', activityType, intensity, durationMin }`
- `{ type: 'stopActivity' }`
- `{ type: 'glucagon' }`

Aliases:

- `addFood` = `food`
- `fastInsulin` / `bolus` = `rapidInsulin`
- `longInsulin` = `basalInsulin`
- `startActivity` = `activity`

Unknown event types throw an error. This is deliberate, so mistakes in lab scenarios are
not silent.

## Scenario runner

The Simulator registers the runner:

```js
engine.attachScenarioRunner({
    step: minutes => simulator._stepEngineScenario(minutes),
    applyEvent: event => simulator._applyEngineScenarioEvent(event),
    getSample: () => simulator._getEngineScenarioSample()
});
```

The game runner is a bridge to the Simulator methods, so scenario interventions run the
game's campaign/log/sound bookkeeping. `step` calls `engine.step(minutes)` (via
`_tickPhysiology`, so scenario samples see the same state as the game), while
`applyEvent`/`getSample` use the facade methods.

**Standalone (without the facade):** `engine.attachDefaultRunner()` wires an internal
runner to the pure engine methods (`step` + interventions + `getState`), so `runScenario`
can run entirely without the Simulator:

```js
const engine = createEngine({ weight: 70, isf: 3.0, icr: 10 }, { seed: 1, steadyState: true });
engine.attachDefaultRunner();
const result = engine.runScenario([
    { time: 0,  type: 'food', carbs: 50, protein: 10, fat: 5 },
    { time: 0,  type: 'rapidInsulin', units: 5 },
    { time: 90, type: 'glucagon' }
], 180, 5);
```

`startActivity` events use `event.typeDef` if given, otherwise `activityType` is looked up
in the engine's default catalog (cardio/styrke/blandet/afslapning); if the type is unknown
and no `typeDef` is given, an error is thrown (lab safety). `runScenario` still throws if
no runner is registered — `attachScenarioRunner`/`attachDefaultRunner` are both explicit.

## Test commands

Full physiology regression:

```powershell
tests/.bin/node.exe tests/run-physiology-regression.js
```

Direct engine API test without DOM mocks:

```powershell
tests/.bin/node.exe tests/physiology-engine-api.test.js
```

Golden master:

```powershell
tests/.bin/node.exe tests/golden-master.js check
```

Existing full suite:

```powershell
tests/.bin/node.exe tests/simulation.test.js
```
