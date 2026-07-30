# diagrammaker DSL — schema

The `diagrammaker` skill takes a JSON specification and produces an SVG diagram.
Specs live in `docs/diagrams/<slug>/spec.json`. The renderer is at
`tools/diagrammaker/render.js`.

## Top-level fields

```json
{
  "type":          "compartment-diagram",
  "title":         "Human-readable title",
  "direction":     "left-to-right" | "top-to-bottom",
  "straightLines": true,
  "compartments":  [ ... ],
  "flows":         [ ... ],
  "caption": {
    "scope":     "1-2 sentence intro of the figure's scope",
    "variables": [ "X: definition", "Y: definition", ... ]
  }
}
```

- `type`: only `"compartment-diagram"` is supported in v1. Future types will use
  the same spec file with a different `type` value (e.g. `"pathway"`,
  `"state-machine"`).
- `direction`: `"left-to-right"` (default, abbreviated `"lr"`) flows input from
  the left, output to the right. `"top-to-bottom"` (`"tb"`) is for vertical
  layouts.
- `straightLines`: optional, default `true`. When `true`, edges are drawn as
  polylines with straight `L`-segments between dagre's routing points (clean,
  flow-chart style). Set to `false` to fall back to Catmull-Rom-to-Bezier
  smoothing — only useful for diagrams where curved aesthetics are explicitly
  desired.

## Compartments

Each compartment is a box. Required fields: `id`, `label`. Other fields are
optional but recommended.

```json
{
  "id":    "I",                  // unique identifier, used in flows
  "label": "Plasma insulin",     // human-readable name shown inside the box
  "var":   "I",                  // mathematical variable shown bold below label
  "unit":  "mU/L",               // optional unit shown beneath the variable
  "color": "insulin-fast",       // logical entity name (see palette below)
  "type":  "plasma",             // styling hint: depot | plasma | effect | tissue | external
  "rank":  "max"                 // optional rank constraint (see below)
}
```

`type` controls border style:
- `depot`, `plasma`, `tissue` -> solid border
- `effect` -> dashed border (signal-driven, not mass-storage)
- `external` -> dotted border

If `color` is omitted the compartment uses the neutral grey palette.
If `var` is omitted only the label is shown.

`rank` is an optional layout-constraint passed to dagre:
- `"min"` or `"source"`: place at the figure's input edge (top in TB, left in LR)
- `"max"` or `"sink"`: place at the figure's output edge (bottom in TB, right in LR)
- omitted (default): dagre decides the rank automatically from the flow graph

Use `rank: "max"` to **group multiple final-output compartments** at the same
edge (e.g. Q1 and Q2 both at the bottom of an insulin-action figure).
Use `rank: "min"` rarely — it's usually better to let inputs flow in via
`"from": "external"` flows (which are auto-pinned to the input edge by the
renderer).

## Flows

Each flow is an arrow between two compartments.

```json
{
  "from":          "S2",                    // compartment id, or "external"
  "to":            "I",                     // compartment id, or "external"
  "label":         "U_I = S2/τ_I·pulse",    // flow rate expression (mid-arrow)
  "externalLabel": "injection (rapid bolus)", // source/destination name (only on external flows)
  "kind":          "mass",                  // mass | signal | equilibrium | input | elimination
  "color":         "insulin"                // optional override; default = source compartment's color
}
```

`kind` controls arrow style:
- `mass` -> solid line, single arrowhead (physical transport)
- `signal` -> dashed line (insulin effect on a process, etc.)
- `equilibrium` -> double-headed (bidirectional equilibrium)
- `input` -> arriving from `"external"`, single arrowhead
- `elimination` -> leaving to `"external"`, single arrowhead

Using `"external"` as `from` or `to` creates an arrow that enters or leaves the
diagram from outside the system. Each `"external"` reference produces an
independent anchor, so multiple inputs/outputs do not collapse into one point.

**Two labels per flow** — split into rate and source/destination:

- `label` = flow-rate expression (placed mid-arrow). On internal flows this is
  the only label. On external flows it's optional; if there is no rate
  expression for an input (e.g. a discrete injection), set `"label": ""`.
- `externalLabel` = source or destination name (placed near the figure edge,
  not mid-arrow). Only used on external flows. For inputs, names where the
  arrow originates ("injection (rapid bolus)", "from gut"). For outputs,
  names where it goes ("urine / clearance", "to peripheral tissues").

Never combine rate and source/destination into a single string — they belong
in different fields and are rendered at different positions on the figure.

**Edge geometry** — auto-snap to perpendicular:

The renderer detects when source and target boxes overlap in the direction
perpendicular to the flow axis (horizontally in TB, vertically in LR) and
snaps the edge to a clean straight line through the overlap zone instead of
routing diagonally to box-center. No spec field is needed; this happens
automatically. If you want more vertical/horizontal arrows, order
`compartments` so related pairs sit in the same column (TB) or row (LR).

## Color palette (logical entity names)

| Name | Hex | Source |
|---|---|---|
| `insulin` / `insulin-fast` | `#7dd3fc` | sim CSS `--blue` |
| `insulin-basal` | `#5eeadc` | basal teal from graph |
| `carb` / `glucose` | `#4ade80` | sim `--macro-carb` |
| `protein` | `#60a5fa` | sim `--macro-protein` |
| `fat` / `adipose` | `#f59e0b` | sim `--macro-fat` |
| `ketone` | `#c4b5fd` | sim `--purple` |
| `stress` | `#f472b6` | sim stress-pink |
| `plasma` | `#ef4444` | sim `--red` (blood) |
| `liver` | `#b45309` | new |
| `muscle` | `#84cc16` | new |
| `kidney` | `#9ca3af` | new |
| `brain` | `#8b5cf6` | new |
| `gut` | `#a3a3a3` | new |
| `external` | `#6b7280` | outside system |
| `neutral` | `#9ca3af` | catch-all |

## Caption block

`caption.scope` is a 1-2 sentence intro that explains what the figure shows.
`caption.variables` is an array of variable definitions, one per non-obvious
symbol. Each variable is a structured object:

```json
{
  "symbol":     "U_I",                    // the symbol as it appears in the figure
  "category":   "flow",                   // see below — "compartment" or "flow"
  "definition": "rapid absorption rate = S2 / τ_I · pulseFactor"
}
```

`category` matches the graphical element where the variable lives:

- `"compartment"` — the variable is a state held in a box. Examples: `S1`,
  `S2`, `I`, `Q1`, `Q2`, `x1`. These are the time-varying quantities the
  ODE-system integrates.
- `"flow"` — the variable lives on (or inside) an arrow. This includes both
  the rate-expression itself (`U_I = S2/τ_I·pulse`) AND any constants and
  multipliers that appear inside that expression (`τ_I`, `pulseFactor`,
  `k_e`). Even though those constants don't have their own arrow, they
  belong conceptually to the arrow whose rate they govern.

This two-category split mirrors the two graphical elements in the figure
(boxes vs. arrows) — making the variable table directly clickable from any
visual element. See SKILL.md for guidance on categorization edge cases.

Both `caption.scope` and `caption.variables` are used by the skill to
generate two outputs:

- `caption.md` — single italic Markdown paragraph with `**symbol**: def;`
  pairs joined together (categories are flattened — categorization only
  matters for `preview.html`).
- `preview.html` — interactive HTML mockup with figure + scope + a
  variables table grouped by category.

## Layout hints (optional, for future use)

The current renderer does pure auto-layout via dagre. If a layout is suboptimal
the spec can override per-compartment with:

```json
{ "id": "I", "label": "...", "layer": 2, "order": 0 }
```

These hints are recognised but currently ignored by the renderer; manual
overrides will be added in a later version when needed.

## Validation rules

After rendering, `tools/diagrammaker/validate.js` checks:

- No text overlaps a foreign box (text is allowed to sit inside its owner box)
- No arrow path passes through a non-endpoint box
- No two arrows cross each other (other than at shared endpoints)
- No edge label overlaps with any box or any other edge label

Errors fail the validation; warnings are listed but do not fail.

## Example

See `docs/diagrams/insulin-pk/spec.json` for a complete worked example.
