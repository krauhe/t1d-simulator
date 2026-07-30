# S9.12 — Fysiologi-moduler som 0..1 intensitets-skalarer (fix-decision-doc)

**Dato:** 2026-06-17
**Type:** Model-/motor-API-ændring (motor-lag)
**Gren:** `ui-polish`
**Forfatter:** Claude

> Fælles dokument for Claude Code og Codex. Skrevet selvstændigt — ingen
> samtale-kontekst. Et værktøj kan overtage koldt.

---

## Baggrund

`PhysiologyEngine` har 10 til/fra-moduler (`MODULE_DEFAULTS`, S9.10/S9.11) som
en caller kan slå fra via `createEngine(profile, { modules: { <key>: false } })`
for at isolere eller forenkle modellen (labs, undervisning, kampagne/easy-mode).
De var rene booleans: enten fuld effekt eller helt slukket.

Brugeren ønskede finere kontrol: kunne man skrue effekterne op og ned i stedet
for kun til/fra? En 0..1 værdi i stedet for en boolean, med default 1 (= fuld
fysiologi som i dag).

## Beslutning

Lav de moduler der har en meningsfuld "styrke" om til **0..1 intensitets-skalarer**
(default 1.0), og behold de strukturelle/diskrete moduler som booleans.

**8 skalar-moduler** (default `1`):
`dawn`, `dawnVariability`, `stressResponse`, `glucotoxicity`, `ketones`,
`sleepDisruption`, `insulinVariability`, `ffaResistance`.

**2 boolean-moduler** (default `true`) — ingen meningsfuld mellem-intensitet:
- `cgmSensorFaults` — diskrete sensor-hændelser (warmup/self-test/tab).
- `fatProtein` — en hel delmodel (fedt/protein-håndtering) der enten er med eller ej.

**Interval:** `[0, 1]`. Default 1 = dagens fulde fysiologi, 0 = slukket, 0.5 =
halv styrke. Forstærkning (>1) er bevidst UDE af scope i v1 (navnet er "0-til-1");
det er en triviel cap-ændring senere hvis ønsket.

**Coercion:** en boolean accepteres stadig for en skalar-nøgle og oversættes
(`true`→1, `false`→0), så eksisterende `{ dawn: false }`-opt-outs (inkl.
`_campaignDisableDawn`-aliaset og lab-kald) virker uændret.

## Skalerings-strategi per modul

To mønstre, valgt så **skala 1 er bit-identisk** (IEEE: `x * 1.0 === x`, og
`1 + (f-1)*1 === f` for `f ∈ [1,2]` jf. Sterbenz):

| Modul | Mønster | Effekt-sted |
|-------|---------|-------------|
| dawn | gang amplitude × scale | `circadianKortisolNiveau` (HGP) + `circadianISF` |
| stressResponse | gang HGP-termer × scale; lerp ISF-faktor | substep-loop (akut+kronisk) + `currentISF` (`insulinResistanceFactor`) |
| glucotoxicity | lerp resistens-faktor | `currentISF` (`glucotoxicResistanceFactor`) |
| ffaResistance | lerp resistens-faktor | `currentISF` (`ffaResistanceFactor`) |
| ketones | gang BHB-produktion × scale | `_substepKetones` (`bhbProduced`) |
| sleepDisruption | gang sleepLoss × scale | `registerNightIntervention` |
| dawnVariability | lerp gaussRand-sample mod fast middel | `regenerateDawn` (amplitude + peak) |
| insulinVariability | lerp gaussRand-sample mod fast 1.0/28 t | `addFastInsulin` (tau), `addBasalInsulin` (varighed) |

- **gang** (`effect * scale`): magnitude-moduler. Ved scale 0 gates substeppet/
  blokken FØR (`if (scale <= 0) skip`), så RNG-strømmen for den slukkede sti er
  uændret ift. den gamle boolean-off.
- **lerp** (`1 + (factor - 1) * scale`): resistens-faktorer der ganges ind i
  effektiv ISF. Ved scale 0 → 1.0 (neutral, = gammel off); scale 1 → faktoren.
- **variance-lerp** (`sample * scale + mean * (1 - scale)`): variabilitets-moduler.
  Ved scale 1 → præcis sample (bit-identisk); ved scale 0 springes gaussRand over
  (RNG matcher gammel off). Mellem-skala bruger samme RNG-position som on-stien.

Stress har to effekt-veje (HGP via `stressBase` + ISF via `insulinResistanceFactor`);
begge skaleres med `stressResponse`-skalaren, så effekten er konsistent halveret ved 0.5.

## Implementering

- `MODULE_DEFAULTS`: blandede typer; nyt `MODULE_IS_SCALAR`-map (udledt af typen).
- Per-nøgle validering i konstruktøren: skalar-nøgle accepterer tal i [0,1] eller
  boolean (coerce); boolean-nøgle accepterer kun boolean; ukendt nøgle kaster.
- Ny metode `moduleScale(key)` (boolean→1/0, ellers tallet) brugt på alle effekt-steder.
- `_campaignDisableDawn`-setter gemmer nu 0/1 i stedet for boolean.

## Verifikation

- **Golden-master: 7/7 bit-identisk ved `--tol=0`** (basal, bolus, fat-protein,
  exercise, sleep-dawn, ketones-dka, cgm-noise) — defaultfysiologien er uændret.
- **Fuld suite: 161/161** (155 eksisterende + 6 nye MODULE-tests).
- Nye tests dækker: defaults, fraktionel værdi, boolean-coercion, out-of-range/
  type-validering, boolean-nøgle afviser tal, ukendt nøgle kaster, og at
  `ketones`-skalaren skalerer produktionen monotont (fuld > halv > off).

## Åbne punkter / ude af scope

- **UI mangler.** Dette er kun motor-laget (API + validering). Hvor man skruer på
  skalarerne (udvikler-panel, settings, scenarie-editor) er et separat skridt.
- **Forstærkning >1** er ikke understøttet (interval [0,1]). Triviel udvidelse.
- Ingen call-sites uden for motoren læser individuelle modul-værdier i dag, så
  facaden/spillet kræver ingen ændring (booleans coerces).
