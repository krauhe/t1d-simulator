<!-- doc-version: 2026-03-12-v1 -->
# Physiological Model — T1D Simulator

*This page is the technical documentation of the simulator's physiological engine.
It describes how each model is implemented, why it is built the way it is,
and which scientific sources it rests on. The document is intended for patients,
relatives, and healthcare professionals who want to understand what happens "under the hood."*

**Important disclaimer:** T1D Simulator is an educational game — NOT a medical device.
Never use the simulator as a basis for medical decisions. Always follow your doctor's recommendations.

---

## Table of Contents

1. [Overview — What do we simulate?](#overview)
2. [The Core Model: Hovorka 2004](#core-model)
3. [Glucose — The Body's Fuel](#glucose)
4. [Insulin — The Key to the Cells](#insulin)
5. [Food — From Plate to Bloodstream](#food)
6. [Activity — Four Activity Types with Different Physiology](#activity)
7. [Stress Hormones — The Body's Counterplay](#stress-hormones)
8. [The Dawn Phenomenon — Morning Cortisol](#dawn)
9. [Sleep Disruption — Nighttime Interventions Come at a Cost](#sleep)
10. [Hypoglycemia Unawareness (HAAF)](#haaf)
11. [Ketones and Ketoacidosis (DKA)](#ketones)
12. [CGM Simulation — The Sensor's Limitations](#cgm)
13. [Variability — Why Doesn't It Work the Same Every Time?](#variability)
14. [Weight and Calorie Balance](#weight)
15. [Scoring and Game Over](#scoring)
16. [Limitations and Caveats](#limitations)
17. [Scientific References](#references)
18. [Open Source Software Used](#open-source)

---

<a name="overview"></a>
## 1. Overview — What do we simulate?

T1D Simulator simulates the glucose-insulin dynamics in a person with type 1 diabetes (T1D).
The simulation models the most important physiological processes that affect blood glucose:

1. **Glucose kinetics** — how glucose is distributed and consumed in the body
2. **Insulin pharmacokinetics** — how injected insulin is absorbed and takes effect
3. **Carbohydrate absorption** — how food is digested and glucose is absorbed into the blood
4. **Exercise effects** — how physical activity affects blood glucose
5. **Stress hormones** — how cortisol, adrenaline, and glucagon affect the liver
6. **Ketone metabolism** — how insulin deficiency leads to ketoacidosis
7. **CGM simulation** — realistic sensor delay and noise

All these systems are interconnected. Insulin lowers blood glucose, but exercise changes
how quickly insulin takes effect. Stress hormones cause the liver to release extra glucose.
Sleep deprivation makes insulin less effective. The simulator attempts to capture this interplay
as realistically as possible — within the constraints of a game.

### How is the simulator structured?

The simulator runs like a clock that "ticks" every few seconds in real time. For each
tick it calculates:

- How much insulin is currently active in the body
- How much glucose is coming in from food
- How much glucose the liver is producing (influenced by stress hormones)
- How much glucose the muscles are taking up (influenced by exercise)
- What the CGM sensor would show (with delay and noise)

The result is a new blood glucose level that is displayed on the graph.

---

<a name="core-model"></a>
## 2. The Core Model: Hovorka 2004 (The Cambridge Model)

### Why this particular model?

The simulation's core is based on **Hovorka et al. (2004)** — a model developed
at the University of Cambridge for research into the artificial pancreas. We chose it because:

- **Clinically validated** — tested against real T1D patients in controlled trials
- **Well-established** — over 1000 citations in the scientific literature
- **Well-balanced** — complex enough for realistic behavior, simple enough to run in real time in a browser
- **Well-documented** — all parameters and equations are published

### The model's basic idea

The Hovorka model describes the body as a series of connected "rooms" (compartments).
Glucose and insulin move between these rooms at rates determined by
differential equations — mathematical expressions that describe *how something changes over time*.

The model has 13 state variables distributed across four subsystems:

- **Glucose subsystem** (2 compartments: plasma and peripheral tissues)
- **Insulin subsystem** (3 compartments: two subcutaneous depots and plasma)
- **Insulin action subsystem** (3 effect variables)
- **Gut absorption subsystem** (2 compartments)
- **CGM sensor** (1 variable with delay)
- **Exercise effects** (2 state variables)

For the mathematically inclined: the model is solved with Euler integration, where we
update the state every minute (simulated time):

```
New value = old value + rate of change * time step
```

This is the simplest numerical method, but it is sufficiently accurate for
our purposes. More advanced methods (e.g., Runge-Kutta 4) could provide better
precision, but Euler is faster and perfectly adequate for a game.

---

<a name="glucose"></a>
## 3. Glucose — The Body's Fuel

### What is modeled?

Glucose in the body is distributed across two "rooms":

- **Q1 (plasma):** Glucose in the blood — what you measure with a blood glucose meter.
  The blood glucose level in mmol/L is calculated as Q1 divided by the glucose
  distribution volume (approximately 11.2 liters at 70 kg).

- **Q2 (peripheral tissues):** Glucose in muscles and adipose tissue. This pool is not
  directly measurable, but plays an important role because insulin drives glucose
  from the blood (Q1) out into the tissues (Q2), and exercise increases muscle uptake.

### What affects blood glucose?

The central equation for plasma glucose (Q1) describes a balance between
everything that **adds** glucose to the blood and everything that **removes** it:

**Addition:**
- *Food (UG):* Glucose from the gut after a meal
- *The liver (EGP):* The liver's glucose production (stimulated by stress hormones,
  inhibited by insulin)
- *Return flow from tissues (k12 * Q2):* Glucose returning from muscles

**Removal:**
- *Brain consumption (F01c):* The brain uses approximately 120 grams of glucose per day —
  regardless of whether insulin is present or not. At low blood glucose, consumption
  is reduced (the brain simply doesn't get enough)
- *The kidneys (FR):* Above approximately 9 mmol/L, the kidneys begin to excrete glucose
  in the urine. This is a natural protective mechanism against extremely high blood glucose
- *Insulin-driven uptake:* Insulin transports glucose from the blood into
  muscles and adipose tissue

### Why is this important to understand?

Blood glucose is always the result of a **balance** between addition and removal.
When addition exceeds removal, blood glucose rises. When removal exceeds
addition, it falls. A person with T1D lacks the body's own insulin, so without
injected insulin there is nothing to drive glucose into the cells — and blood glucose
rises uncontrollably.

### Key parameters (scaled with body weight)

| Parameter | What it does | Typical value (70 kg) |
|-----------|-------------|----------------------|
| VG | How much blood glucose distributes into | 0.16 * weight = 11.2 L |
| F01 | Brain glucose consumption per minute | 0.0097 * weight = 0.68 mmol/min |
| EGP0 | Liver's basal glucose production per minute | 0.0161 * weight = 1.13 mmol/min |
| R_thr | Renal threshold for glucose excretion | 9 mmol/L |

---

<a name="insulin"></a>
## 4. Insulin — The Key to the Cells

### How does insulin work in the model?

When you inject insulin under the skin, it must first be transported to the blood
before it can take effect. The model describes this as a journey through several "stations":

**Stations 1 and 2: Under the skin (S1 and S2)**

The insulin first sits in a depot under the skin (S1) and gradually moves
onward to a second depot (S2). From there it is absorbed into the bloodstream. The time to
peak absorption is approximately 55 minutes for rapid-acting insulin such as NovoRapid.

**Pulse-accelerated absorption:** When heart rate increases (e.g., during exercise),
blood flow in the subcutaneous tissue increases. This washes insulin out faster
from the depots into the bloodstream. The model calculates a pulseFactor:

```
pulseFactor = 1 + max(0, (heartRate - restingHeartRate) / restingHeartRate) × 0.5
```

At resting heart rate (60 bpm) the factor is 1.0 — no change. At heart rate 120 it is
1.5 (50% faster absorption), and at heart rate 160 it is approximately 1.83. This effect
applies to **all insulin in the depot** — both bolus and basal. This is an important reason
why exercise can feel so powerful: even without a recent bolus, you always have
basal insulin under the skin, and it is accelerated too. The combination of
faster insulin absorption and exercise's direct muscle uptake (see section 6)
produces the marked BG reduction many T1D patients experience during exercise.

**Station 3: In the blood (I)**

From the blood, insulin distributes with a volume of distribution of approximately 8.4 liters
(at 70 kg). The body also continuously removes insulin from the blood (elimination).

**Stations 4-6: Effect on glucose (x1, x2, x3)**

Even when insulin is in the blood, it does not work instantaneously. There is an
additional delay from insulin in the blood to the actual effect on glucose.
Three separate effect variables model this delay:

- **x1 (transport):** Insulin makes it easier for glucose to move from the blood into
  the muscles
- **x2 (disposal):** Insulin causes the muscles to burn more glucose
- **x3 (liver suppression):** Insulin causes the liver to produce less glucose

All three follow the same mathematical pattern: `dx = kb × I - ka × x`, where `kb × I`
is the activation (the more insulin in the blood, the stronger the signal) and `ka × x` is
the natural decay over time. However, they have different rates (ka and kb),
which give them slightly different time profiles.

Here is a summary of insulin's three effect mechanisms and where they appear
in the model's equations:

| Variable | Effect | Where it acts | In the code |
|----------|--------|---------------|-------------|
| **x1** | **Transport:** moves glucose from blood to periphery | dQ1: `-x1 × Q1` (out of plasma) | Insulin opens GLUT4 transporters in muscles |
| **x2** | **Disposal:** increases muscle glucose consumption | dQ2: `-x2 × Q2` (consumed) | Muscles use the glucose they have received |
| **x3** | **Liver suppression:** dampens the liver's glucose production | EGP formula (see below) | Insulin inhibits the liver's glucose release |

### The EGP formula — tug of war between insulin and stress hormones

The liver's glucose production (EGP) is one of the most important processes in the model.
It is governed by a simple but elegant formula:

```
EGP = EGP_0 × max(0, stressMultiplier - x3)
```

The formula is a **tug of war** between two opposing forces:

- **stressMultiplier** (normally ≥ 1.0) pulls UP: "Liver, produce more glucose!"
  This signal comes from glucagon, adrenaline, cortisol, and the dawn phenomenon.
- **x3** (insulin's liver effect) pulls DOWN: "Liver, stop production!"

| Situation | stress | x3 | EGP | What happens? |
|-----------|--------|----|-----|---------------|
| Normal rest | 1.0 | 0.3 | EGP_0 × 0.7 | Moderate production (normal) |
| After bolus | 1.0 | 1.3 | 0 | Insulin wins — the liver stops |
| Hypo + counterregulation | 1.5 | 1.3 | EGP_0 × 0.2 | Glucagon wins slightly — the liver releases glycogen despite active insulin |
| Insulin overdose (T1D) | 1.4 (cap) | 3.0 | 0 | Insulin overwhelms everything — BG crashes toward game over |

The formula captures the important physiological principle that counterregulatory hormones
can "fight against" insulin in the liver. During hypoglycemia in a healthy person,
stressMultiplier would rise to 3-5 and overcome even high insulin. But in T1D,
counterregulation is limited (capped at ~1.4) because the glucagon response is lost —
therefore an insulin overdose is far more dangerous.

These three effects (x1, x2, x3) work together with slightly different speeds.
This is why insulin has a complex action profile — it starts slowly,
peaks after 1-2 hours, and tapers off gradually over 3-5 hours.

### Insulin sensitivity parameters

How strongly insulin affects the three processes is determined by three sensitivity parameters:

| Parameter | What it controls | Typical value |
|-----------|----------------|---------------|
| SIT | Insulin's effect on transport | 51.2 * 10^-4 L/min/mU |
| SID | Insulin's effect on muscle disposal | 8.2 * 10^-4 L/min/mU |
| SIE | Insulin's effect on liver suppression | 520 * 10^-4 1/mU |

All three parameters are scaled with the player's ISF (Insulin Sensitivity Factor).
A higher ISF means insulin works more potently — all three parameters
are multiplied by a scaling factor:

```
scalingFactor = player's ISF / 3.75
```

The reference of 3.75 mmol/L per unit is the effective ISF that the Hovorka model's
default parameters produce. So a player with ISF = 3.0 gets a scaling factor
of 0.80 (slightly less sensitive than average), and a player with ISF = 5.0
gets 1.33 (more sensitive).

### Rapid-acting vs. long-acting insulin

**Rapid-acting (bolus):** Injected as a short pulse over 5 simulated
minutes. The Hovorka model's S1 and S2 compartments handle the rest:
absorption, distribution, and effect delay. Typical profile: onset 10-15 min,
peak 1-2 hours, duration 3-5 hours.

**Long-acting (basal):** Modeled with a trapezoidal profile that ramps up
over 4 hours, maintains a stable plateau for 18 hours, and tapers off gradually.
Total duration: 24-36 hours (with some random variation, just like in
reality). Basal insulin is fed directly into the Hovorka model's
insulin rate — providing a slow, steady supply.

### IOB — Insulin On Board

IOB (active insulin in the body) is calculated directly from the Hovorka model's
insulin compartments. We only show bolus IOB to the player — basal
insulin is a stable background that is not relevant for dosing decisions.

### Why is this important to understand?

Understanding insulin pharmacokinetics is crucial for good blood glucose management:

- **Stacking:** If you give a new dose before the previous one has worn off, you get
  "insulin stacking" — more active insulin than intended, with risk of
  hypoglycemia. IOB helps you avoid this.
- **Timing:** Insulin does not work immediately. If you wait to give
  insulin until blood glucose is already high, you will be behind for hours.
- **Variability:** Even the same dose of insulin does not work identically every time.
  The model simulates this in three ways:
  1. **Bioavailability (mean 78%, std 8%):** Not all injected insulin
     reaches the bloodstream. Some is degraded locally by proteases in the subcutaneous
     tissue. The model draws a normally distributed bioavailability per injection
     (clamped to 55-95%). This means that of e.g. 5 units of injected insulin,
     approximately 3.5-4.5 units actually reach the blood — and it varies from time to time.
  2. **Absorption rate (CV ~25%):** The time constant tau_I varies from
     injection to injection, modeled with a normal distribution around
     the default value (mean 1.0, std 0.25, clamped 0.50-1.60). It depends
     on injection depth, local blood flow, temperature, and possible lipodystrophy
     (thickened areas under the skin from repeated injections). One injection
     may peak after 35 min, the next after 70 min — even with the same dose
     and the same site. Extremes (e.g., intramuscular injection) give much
     faster absorption.
  3. **Duration (basal):** Long-acting insulin's duration varies with
     a normal distribution (mean 28 hours, std 3 hours, clamped 22-38 hours).
  The variability is calibrated to match the intra-individual CV
  of 20-30% documented for rapid-acting insulin analogs
  (Heinemann 2002).

---

<a name="food"></a>
## 5. Food — From Plate to Bloodstream

### Carbohydrate absorption

When you eat carbohydrates, they are not absorbed immediately. The gastrointestinal tract
is modeled as two compartments:

- **D1 (stomach):** Food arrives here and gradually moves onward
- **D2 (small intestine):** From here glucose is absorbed into the blood

The rate is determined by the parameter tau_G (time to peak absorption),
which is set to 40 minutes. Only 80% of the carbohydrates are absorbed (bioavailability = 0.8) —
the rest passes through unabsorbed.

In practice this means that after a meal, blood glucose rises gradually, peaks
after approximately 40-60 minutes, and levels off over 2-3 hours.

### Fat content delays absorption

Fat in a meal delays gastric emptying, causing carbohydrates to be absorbed
more slowly. In the model, fat content increases the tau_G value, so
the absorption peak comes later and is lower — but lasts longer.

This is the reason why a pizza (high fat content) produces a different
blood glucose profile than a slice of white bread (low fat content), even if
the carbohydrate content might be the same.

### Protein effect

Protein also contributes to blood glucose elevation, but more slowly and to a lesser
degree. Approximately 25% of protein is converted to glucose via gluconeogenesis in the liver,
with a delay of approximately 30 minutes and an absorption time of approximately 60 minutes.

So a meal with 40 grams of protein will affect blood glucose like an additional
10 grams of carbohydrates — just delayed by half an hour.

### Why is this important to understand?

- A meal with high fat content may require a different insulin strategy
  (e.g., split bolus or delayed bolus)
- The protein effect explains why a piece of meat with no side dishes can still
  affect blood glucose
- Timing of insulin relative to the meal is crucial: too early carries
  risk of hypo before the food reaches the blood, too late produces an unnecessarily high peak

---

<a name="activity"></a>
## 6. Activity — Four Activity Types with Different Physiology

### The basic idea

Physical activity affects blood glucose in several ways simultaneously — and the effect
depends strongly on the **type** of activity. The simulator models four
activity types that cover the entire spectrum from intense muscle work to
relaxation:

| Type | Icon | Examples | BG effect |
|------|------|----------|-----------|
| **Cardio** | 🏃 | Running, cycling, swimming | BG drops |
| **Strength training** | 💪 | Weight training, crossfit | BG rises acutely, drops later |
| **Mixed sports** | ⚽ | Football, badminton, handball | BG relatively stable |
| **Relaxation** | 🧘 | Yoga, meditation, stretching | BG drops slightly |

The first three types are variations of exercise with different blends
of aerobic and anaerobic activity. The fourth (relaxation) works via an entirely
different physiological system: stress reduction and parasympathetic activation.

### The exercise model: E1 and E2

The exercise effects are based on the extension described in **Resalat et al. (2020)**,
which adds two extra state variables driven by heart rate:

- **E1 (short-term effect, τ = 20 min):** Rises quickly during exercise,
  falls quickly afterward. Represents direct muscle glucose uptake via
  GLUT4 translocation — a mechanism that works WITHOUT insulin.

- **E2 (long-term effect, τ = 200 min):** Rises slowly and falls
  slowly. Represents the enhanced insulin sensitivity that persists for hours
  after exercise ends.

The key innovation in the simulator is the parameter **e1Scaling** which scales
how much heart rate drives GLUT4 uptake for each activity type. Strength training
has low e1Scaling (0.3) because the muscles work in short bursts, not
continuously as with cardio (e1Scaling = 1.0).

**Important:** e1Scaling affects ONLY GLUT4 muscle uptake (E1). It does
NOT affect **pulseFactor** (accelerated insulin absorption from the subcutaneous depot).
PulseFactor is always driven by the raw heart rate increase, regardless of activity type —
because increased blood flow washes out insulin regardless of the reason for the
elevated heart rate.

### Three mechanisms that stack

During physical activity, blood glucose is hit by three simultaneous mechanisms:

**1. Direct muscle uptake (E1) — works WITHOUT insulin:**

Muscles take up glucose directly from the blood during exercise via
GLUT4 translocation. Physical contraction of muscle fibers alone is enough to
pull GLUT4 transporters up to the cell surface. In the model:

```
HR_effect_raw = (heartRate - restingHeartRate) / restingHeartRate
HR_effect = HR_effect_raw × e1Scaling          ← scaled per activity type
dQ2 = ... - beta × E1 × HR_effect
```

At heart rate 120 and resting heart rate 60: HR_effect_raw = 1.0.
Cardio (e1Scaling=1.0): HR_effect = 1.0 → full GLUT4 effect.
Strength (e1Scaling=0.3): HR_effect = 0.3 → only 30% GLUT4 effect.

**2. Enhanced insulin action (E2) — "exerciseFactor":**

Exercise makes insulin more effective. During and after exercise, muscles open
more capillaries (increased perfusion), and the cells' insulin receptors become
more sensitive. In the model:

```
exerciseFactor = 1 + alpha × E2²
```

- **alpha = 1.79** (Resalat et al. 2020) determines the amplification
- **E2²** gives a progressive curve: a little exercise gives a little amplification,
  but a lot of exercise gives *disproportionately* more amplification

**Concrete example:** After 60 min of moderate running (heart rate 130), E2 is approximately 0.45.
exerciseFactor = 1 + 1.79 × 0.20 = **1.36** — insulin works 36% more potently.

**3. Accelerated insulin absorption (pulseFactor):**

Increased blood flow washes insulin out faster from the subcutaneous depot.
This effect uses the raw heart rate increase (NOT scaled with e1Scaling):

```
pulseFactor = 1 + HR_effect_raw × pulseSensitivity
```

At heart rate 120 → pulseFactor ≈ 1.5× normal absorption rate.
Applies to all insulin (bolus + basal) and all activity types.

---

### 🏃 Cardio (aerobic exercise)

**Parameters:** e1Scaling = 1.0, e2Scaling = 1.0, stress = 0/0/0.005

During aerobic exercise, GLUT4 uptake (E1) and enhanced insulin action
(E2) dominate. All three mechanisms work in the same direction: blood glucose **drops**.

Cardio is the activity type with the greatest BG-lowering effect. In T1D, the
effect is even stronger than in healthy individuals, because the injected insulin
cannot be "turned off" like endogenous insulin (Riddell et al. 2017). PulseFactor
also washes out the subcutaneous depot faster → more circulating insulin
during exercise.

**Net result:** BG drops, often markedly.

**Heart rate targets:**
- Low: 100 bpm (walking, easy cycling)
- Medium: 130 bpm (jogging, moderate cycling)
- High: 160 bpm (running, hard cycling, swimming)

---

### 💪 Strength training (anaerobic exercise)

**Parameters:** e1Scaling = 0.3, e2Scaling = 0.9, stress = 0.008/0.015/0.025

Strength training has an entirely different physiological profile than cardio:

**Acute BG rise via catecholamine response:**
Muscle contractions under high load activate the sympathetic nervous system
and trigger adrenaline and noradrenaline (catecholamines). These stimulate
the liver to release glucose via glycogenolysis. In the model,
acute stress is added at ALL intensities (0.008–0.025 per sim-minute).

HIIT and heavy strength training typically produce a BG rise of 2–5 mmol/L
(Bally et al. 2015: average +3.7 mmol/L during HIIT).

**Lactate and the Cori cycle (further contributes to BG rise):**
During anaerobic exercise, muscles produce lactate. Via the Cori cycle,
lactate is transported to the liver, where it is used as substrate for
gluconeogenesis (production of new glucose). This contributes further
to the BG rise beyond the direct catecholamine effect.

**Lower GLUT4 uptake:**
Strength training is interval-based (sets + rest), not continuous
muscle work. Therefore e1Scaling is only 0.3 — muscles take up 70% less
glucose directly than during cardio.

**Delayed BG drop:**
After strength training, stress hormones decline (half-life ~60 min),
and the enhanced insulin sensitivity (E2, e2Scaling = 0.9) takes over.
BG gradually falls back — and may fall below the starting point due to
post-exercise insulin sensitivity (Yardley et al. 2013).

**Net result:** BG rises acutely, drops subsequently.

**Heart rate targets:**
- Low: 85 bpm (light weights, machines)
- Medium: 110 bpm (moderate load)
- High: 135 bpm (heavy load, crossfit)

---

### ⚽ Mixed sports

**Parameters:** e1Scaling = 0.65, e2Scaling = 0.85, stress = 0.003/0.006/0.012

Mixed sports (football, badminton, handball) combine aerobic and anaerobic
elements: a cardio base (running, movement) interrupted by intermittent
sprints, jumps, and contact. In the model this is approximated as a weighted
blend (~65% cardio / ~35% anaerobic).

**Riddell et al. (2017, Lancet)** consensus: "mixed activities are associated
with glucose stability" — because the BG-lowering (GLUT4, E2) and BG-raising
(stress) mechanisms partially cancel each other out.

**Net result:** BG relatively stable — less drop than pure cardio,
less rise than pure strength.

**Heart rate targets:**
- Low: 105 bpm (warm-up, easy play)
- Medium: 135 bpm (normal play)
- High: 165 bpm (intense play, match)

---

### 🧘 Relaxation (yoga, meditation, stretching)

**Parameters:** e1Scaling = 0.0, e2Scaling = 0.0, stressReduction = 0.005/0.01/0.015

Relaxation works via an entirely different physiological system than the other three
activity types. There is no muscle-based GLUT4 effect (e1Scaling = 0),
no post-exercise insulin sensitivity (e2Scaling = 0), and heart rate is at
or below resting level.

**Parasympathetic activation and stress reduction:**
Yoga, meditation, and breathing exercises activate the parasympathetic
nervous system and dampen the HPA axis (hypothalamic-pituitary-adrenal axis).
This reduces circulating cortisol and catecholamines. In the model,
both `acuteStressLevel` and `chronicStressLevel` are reduced per sim-minute.

Meta-analysis (Pascoe et al. 2023): yoga interventions significantly reduce cortisol
and improve glycemic control in T2D patients. For T1D, the
evidence is limited, but the mechanism (stress reduction → lower HGP) applies.

**Peripheral vasodilation:**
Relaxation exercises increase peripheral blood flow (vasodilation), which
provides a mild improvement in insulin sensitivity during the activity
(2–5% ISF boost). This effect ceases when the activity stops.

**Net result:** BG drops slightly, primarily via reduced liver production
(lower stress → lower HGP). The effect is greatest if the player already
has an elevated stress level.

**Heart rate targets (at/below resting):**
- Low: 58 bpm (light stretching)
- Medium: 55 bpm (yoga flow)
- High: 52 bpm (deep meditation, body scan)

---

### Heart rate model

Heart rate rises and falls gradually via exponential smoothing:

- During activity: half-life approximately 2 minutes (rapid rise)
- After activity: half-life approximately 5 minutes (gradual recovery)

The target heart rate depends on activity type and intensity (see tables above).

### Post-exercise insulin sensitivity

After exercise, insulin sensitivity is elevated for a period that depends
on intensity. The boost's magnitude is scaled by the activity type's
**e2Scaling** — so cardio (1.0) gives full boost, strength (0.9) nearly
full, mixed (0.85) slightly less, and relaxation (0.0) no boost.

| Intensity | Sensitivity boost | Duration after exercise |
|-----------|-------------------|------------------------|
| Low | +50% × e2Scaling | 1 × exercise duration |
| Medium | +75% × e2Scaling | 2 × exercise duration |
| High | +100% × e2Scaling | 4 × exercise duration |

The boost decays linearly from maximum to normal over the period.

### Parameter overview

| Parameter | Cardio | Strength | Mixed | Relaxation |
|-----------|--------|----------|-------|------------|
| e1Scaling (GLUT4) | 1.0 | 0.3 | 0.65 | 0.0 |
| e2Scaling (post-ex ISF) | 1.0 | 0.9 | 0.85 | 0.0 |
| Stress (High) | 0.005 | 0.025 | 0.012 | 0 |
| StressReduction (High) | 0 | 0 | 0 | 0.015/min |
| Vasodilation (High) | 0 | 0 | 0 | 5% ISF |
| Kcal/min (High) | 10 | 8 | 12 | 2.5 |

### Why is this important to understand?

- **Hypo risk:** Aerobic exercise with active bolus insulin can cause severe
  hypoglycemia. Reduce bolus or eat extra before exercise.
- **Delayed hypo:** 6–12 hours after intense exercise, blood glucose can
  drop suddenly, especially at night.
- **Strength training is different:** Expect an acute blood glucose rise during
  strength training — it is normal and temporary (Bally 2015).
- **Mixed sports provide stability:** Football/handball typically produces more
  stable BG than pure cardio due to intermittent anaerobic elements (Riddell 2017).
- **Stress and BG are connected:** Yoga/meditation can lower BG indirectly
  by reducing stress hormones. Particularly useful when stress levels are elevated.
- **Evening exercise:** Elevated insulin sensitivity at night increases the risk
  of nocturnal hypoglycemia — regardless of activity type.

---

<a name="stress-hormones"></a>
## 7. Stress Hormones — The Body's Counterplay

### The basic idea

The body has a system of hormones (glucagon, adrenaline, cortisol) that
counteract insulin's effect by stimulating the liver's glucose production.
This is a vital protective mechanism against low blood glucose —
but it also complicates blood glucose management for T1D patients.

### Two-layer stress system

The model distinguishes between two types of stress with vastly different time horizons:

**Acute stress (adrenaline and glucagon)**
- Half-life: approximately 60 simulated minutes
- Triggered by: hypoglycemia (the Somogyi effect), intense exercise
- Effect: rapid, powerful increase in the liver's glucose production
- Capped at max 0.4 for T1D (glucagon response is lost,
  only a weak adrenaline response remains)

**Chronic stress (cortisol)**
- Half-life: approximately 12 simulated hours
- Triggered by: sleep deprivation, illness (planned future feature)
- Effect: prolonged, moderate elevation of the liver's glucose production
  as well as increased insulin resistance

### The stress multiplier

Both stress levels feed into a combined multiplier that affects
the liver's glucose production (EGP):

```
stressMultiplier = 1.0 + acuteStress + chronicStress + circadianCortisol
```

In a normal state (no stress), the multiplier is 1.0 — the liver
produces its normal amount of glucose. With acute stress at 0.4, it rises
to 1.4 — the liver produces 40% more glucose.

### The interplay between stress and insulin

The effective liver production is calculated as:

```
EGP = EGP0 * max(0, stressMultiplier - x3)
```

Here x3 is insulin's inhibitory effect on the liver. The formula means that
stress and insulin "pull in opposite directions":

- **Normal day:** stress = 1.0, x3 = 0.3: EGP = EGP0 * 0.7 (moderate production)
- **After bolus:** stress = 1.0, x3 = 1.3: EGP = 0 (insulin suppresses the liver)
- **Hypo + counterregulation:** stress = 1.4, x3 = 1.3: EGP = EGP0 * 0.1
  (stress hormones "break through" despite active insulin)
- **Massive overdose:** x3 >> stress: EGP = 0 (insulin wins — dangerous!)

This formula is an improvement over the original Hovorka model,
where the formula was EGP0 * stressMultiplier * (1 - x3). The problem with the
original formula was that when x3 exceeded 1.0, the liver's production was
clipped to zero — and stress hormones could never break through. This meant
that counterregulation was ineffective during hypoglycemia, which does not
correspond to reality.

### Counterregulation in T1D — why is it so weak?

T1D patients have dramatically impaired counterregulation. The most important cause
is the **loss of the glucagon response to hypoglycemia**, which occurs surprisingly
quickly after diagnosis:

**Timeline:**
- Within the first month, the glucagon response may already be reduced
- Within 1-5 years, it is absent in most patients (Gerich 1988)
- The loss is progressive and irreversible (except with islet transplantation)

**Mechanism — the "switch-off" hypothesis:**

The alpha cells (which produce glucagon) do **not** die — they survive and
still function. The problem is that they lack the correct *signal* to
react to low blood glucose. In a normal pancreas, alpha and
beta cells sit close together in islets. When blood glucose falls, **the
beta cells stop secreting insulin**. This fall in *local* insulin
is the very signal to the alpha cells to release glucagon. The beta cells
also co-secrete GABA and zinc, which normally inhibit the alpha cells —
when they stop, the inhibition is lifted.

In T1D, the beta cells are destroyed by the immune system → there is no local
insulin secretion to "switch off" → the alpha cells never receive
the switch-off signal → the glucagon response fails to occur. Exogenous insulin
(injected under the skin) cannot replicate this, because it does not create
the local, pulsatile drop *inside the islet*.

**Evidence for the switch-off hypothesis:** Islet transplantation (Rickels 2015, 2016)
partially restores the glucagon response — when beta cells are reintroduced,
the signal returns.

**What is preserved:**
- Glucagon response to **amino acids** (protein) — still intact
- Glucagon response to **exercise** — partially preserved (via catecholamines)
- **Adrenaline response** — initially preserved, but can be weakened by HAAF

**In the model:** Stress cap set to 0.4 (vs. approximately 5.0 in healthy individuals) to
reflect this massive loss. The practical consequence: an insulin overdose
cannot be "rescued" by the body's own hormonal response. The player must learn
to prevent hypoglycemia — not rely on the body handling it.

### Why is this important to understand?

- **The Somogyi effect:** Nocturnal hypoglycemia can trigger counterregulation that
  produces high blood glucose in the morning. This can be mistaken for too little insulin,
  but the cause is the opposite — too MUCH insulin at night.
- **Exercise and stress:** High-intensity exercise triggers an adrenaline response
  that can cause acute blood glucose rise, even though exercise also lowers blood glucose.
- **Illness:** Chronic stress from illness produces increased insulin resistance that
  can last all day.

---

<a name="dawn"></a>
## 8. The Dawn Phenomenon and Circadian Insulin Sensitivity

### What is the dawn phenomenon?

Many T1D patients experience their blood glucose rising in the morning — even though
they have not eaten anything. This is due to the body's natural cortisol rhythm:
cortisol rises in the hours before awakening as part of the circadian rhythm,
and cortisol stimulates the liver's glucose production.

But the dawn phenomenon is only half the story. Insulin sensitivity also varies
throughout the day: in the morning insulin works less effectively (peripheral
insulin resistance), and in the evening it works better. These two mechanisms
work together to make mornings harder for T1D patients.

### Hybrid model: two mechanisms

The simulator models the morning effect as a combination of two separate
physiological processes:

**Mechanism 1 — HGP increase (liver production):**
Cortisol and growth hormone cause the liver to produce more glucose. BG rises
regardless of insulin level. Modeled via `circadianKortisolNiveau` (sine arc
at 04-12). The player can correct with insulin — the insulin works normally.

**Mechanism 2 — ISF reduction (peripheral insulin resistance):**
The body's cells respond less well to insulin in the morning. The same dose
lowers BG less. Modeled via `circadianISF` (diurnal curve). The player
must use more insulin to achieve the same BG reduction.

The combined morning effect:
```
08:00 (morning):   HGP ×1.15  +  ISF ×0.70  →  ~43% more insulin needed
14:00 (afternoon): HGP ×1.00  +  ISF ×1.00  →  normal (baseline)
19:00 (evening):   HGP ×1.00  +  ISF ×1.20  →  ~17% less insulin needed
```

### HGP component (liver production via cortisol)

The cortisol curve is modeled with a symmetrical sine arc (quarter-sine up,
mirrored quarter-sine down). The curve has three parameters that vary from day to day:

| Parameter | Mean | Std | Clamp | Description |
|-----------|------|-----|-------|-------------|
| Amplitude | 0.15 | 0.03 | [0.05, 0.35] | How strong the HGP increase is (CV ~20%) |
| Peak time | 08:00 | 30 min | [06:30, 09:30] | When the peak hits |
| Rise/fall | ±4 hours | — | — | Symmetrical: rises 4h before peak, falls 4h after |

```
HGP component (amplitude ~0.15, peak 08:00):

  0.15 |         ^ peak at 08:00
       |       /   \
  0.08 |     /       \
       |   /           \
  0.00 |---              ---------------
       +----------------------------> time
      00   04   08   12   16   20   24
```

The amplitude was previously 0.30 when it alone covered the entire morning effect.
It has been reduced to 0.15 because the other half is now handled by the ISF curve.

### ISF component (circadian insulin sensitivity)

Insulin sensitivity varies throughout the day — not just in the morning.
The curve uses cosine interpolation between control points for smooth transitions:

| Time | ISF factor | Meaning |
|------|-----------|---------|
| 00:00-04:00 | 1.20 | Night: high sensitivity |
| 04:00→08:00 | 1.20→0.70 | Dawn drop: sensitivity falls markedly |
| 08:00 | 0.70 | Morning nadir: lowest sensitivity |
| 08:00→14:00 | 0.70→1.00 | Gradual normalization |
| 14:00-15:00 | 1.00 | Afternoon: nominal (baseline) |
| 15:00→19:00 | 1.00→1.20 | Rise toward evening peak |
| 19:00-00:00 | 1.20 | Evening/night: highest sensitivity |

```
ISF factor over the day:

  1.20 |****                                       ********
       |     *                                   **
  1.10 |      *                                *
       |       *                             *
  1.00 |── ── ──*── ── ── ── ── ── ── ──*── ── ── ── ── ── ──
       |         *                     *
  0.90 |          *                  *
       |           *               *
  0.80 |            *            *
       |             **       **
  0.70 |               *******
       ├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──┤
      00   02   04   06   08   10   12   14   16   18   20  24
```

ISF factor 0.70 means that insulin works 30% less effectively. In practice: if
a bolus normally lowers BG by 3.0 mmol/L, it only lowers it by 2.1 mmol/L in
the morning. To achieve the same effect, the player must use ~43% more insulin
(1/0.70 = 1.43).

### What amplifies the dawn effect?

The HGP amplitude is affected by two factors calculated at the day change (midnight):

1. **Poor sleep:** +12% amplitude per lost hour of sleep.
   With 4 hours of lost sleep (max): +48% → amplitude ~0.22 instead of 0.15.
   Based on Leproult et al. (1997) who found that sleep deprivation increases
   morning cortisol peak by 30-50%.

2. **Chronic stress from the previous day:** +30% amplitude at chronicStress = 1.0.
   Chronic stress (t½ = 12 hours) has partially decayed by the next morning,
   but there is still enough to noticeably amplify the dawn effect — especially
   after sick days or several nights of poor sleep in a row.

The combined formula at day change:
```
dawnAmplitude = baseAmplitude × (1 + lostSleep × 0.12) × (1 + chronicStress × 0.30)
```

*Code: `regenerateDawn()`, `circadianKortisolNiveau` and `circadianISF` in
[simulator.js](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js).*

### Evidence and honest assessment

This hybrid model is built on **incomplete scientific evidence**
combined with input from personal experience as a T1D patient:

- Hinshaw 2013 (n=19 T1D) concludes that the ISF pattern is *individually
  specific* and cannot be generalized to the T1D population
- The Toffanin 2013 curve (which the ISF component is inspired by) is a
  synthetic construct validated on virtual patients — circular evidence
- The chosen amplitude (50% of Toffanin) and the split between HGP/ISF is
  based on clinical intuition and experience with ~40% extra morning insulin
- Sohag 2022 (n=93 T1D children) showed ~50% morning/evening difference in real-life
  correction doses, which supports the order of magnitude

**The model should be updated** if better quantitative data for circadian
insulin sensitivity in T1D become available. Until then, it is an
informed estimate based on the best available knowledge.

### Why is this important to understand?

The dawn phenomenon and circadian ISF variation are among the most frustrating
challenges for T1D patients. It is important to understand that high blood glucose
in the morning **is not the patient's fault** — it is a natural physiological
process. Strategies for managing it include adjusting basal
insulin dose, timing of morning bolus, and acceptance that morning insulin
simply needs to be higher than evening insulin.

The day-to-day variation explains why morning blood glucose can swing
markedly even with identical insulin timing: a combination of poor sleep,
stress, and natural random variation means the dawn effect is never exactly the same.

---

<a name="sleep"></a>
## 9. Sleep Disruption — Nighttime Interventions Come at a Cost

### Scientific basis

Donga et al. (2010, Diabetes Care) showed that a single night of partial
sleep restriction reduces insulin sensitivity by approximately 21% in T1D patients.
Zheng et al. (2017) found that poor sleep quality amplifies the dawn phenomenon.

### How is it modeled?

When the player performs an action between 22:00 and 07:00 (food, insulin,
measurements), it counts as a waking event that costs sleep:

- Events within 30 minutes of each other count as a single
  waking period (you are already awake)
- **Variance per awakening:** Sleep loss per event is normally distributed with
  mean 1.0 hour and std 0.3 hours (clamp [0.3, 1.8]). Some nights you
  fall back asleep quickly (~0.5h lost), other nights you lie awake for a long time (~1.5h).
- Maximum 4 hours of sleep loss per night
- In the morning (07:00) the sleep loss is converted to chronic stress:

```
chronicStress += lost_sleep_in_hours * 0.06
```

The effect in practice:
- 1 hour of lost sleep: +6% increased insulin resistance
- 2 hours of lost sleep: +12% increased insulin resistance
- 4 hours of lost sleep (maximum): +24% increased insulin resistance

In addition, sleep loss also directly amplifies the next morning's **dawn effect**
(+12% amplitude per lost hour — see section 8). The total effect of poor
sleep is therefore twofold: both increased insulin resistance AND a stronger morning BG rise.

Since chronic stress has a half-life of 12 hours, the insulin resistance
effect naturally diminishes through the day. But the dawn amplitude is set for the entire morning,
so a bad night is felt most clearly in the early hours.

### Why is this important to understand?

- Nighttime blood glucose measurements have a real cost (disrupted sleep)
- Poor sleep amplifies the dawn phenomenon (chronic stress + circadian
  effect add up)
- The player must weigh the value of nighttime monitoring against the consequences of
  disrupted sleep

---

<a name="haaf"></a>
## 10. Hypoglycemia Unawareness (HAAF)

### What is HAAF?

HAAF (Hypoglycemia-Associated Autonomic Failure) is a phenomenon where
repeated hypoglycemia episodes weaken the body's ability to respond to
low blood glucose. Counterregulation becomes weaker, and the patient does not
notice the symptoms as clearly. It is one of the most feared complications
of intensive insulin therapy.

### How is it modeled?

Instead of counting discrete "hypo episodes," the model uses a
continuous, area-based approach with two opposing forces:

**Damage (hypoArea):**
When blood glucose is below 3.0 mmol/L, "hypo burden" accumulates
proportionally with depth:

```
hypoArea += max(0, 3.0 - bloodGlucose) * timeStep
```

The deeper and longer the hypoglycemia, the more damage. A blood glucose
of 2.0 for 30 minutes gives (3.0 - 2.0) * 30 = 30 units of damage.
A blood glucose of 2.8 for 10 minutes gives only (3.0 - 2.8) * 10 = 2 units.

**Recovery:**
When blood glucose is above 4.0, hypoArea decays exponentially with a
half-life of 3 simulated days. Clinically this corresponds to the
observation that 2-3 weeks of hypo-free period restores awareness
(Dagogo-Jack 1993, Cranston 1994).

**Effect on counterregulation:**
Accumulated hypoArea reduces counterregulation strength via a
sigmoid function:

```
counterRegFactor = 0.3 + 0.7 * exp(-hypoArea / 30)
```

This curve goes from 1.0 (full response) toward 0.3 (severe HAAF — 70% reduction)
asymptotically. The floor of 0.3 ensures that counterregulation never disappears
entirely — even with severe HAAF, the body has a minimal response.

The calibration is set so that:
- A short hypo (blood glucose 2.5 for 20 minutes) gives approximately 20% reduction
- Two hypos the same day give approximately 40-50% reduction
- 3 simulated days without hypo gives nearly full recovery

### Advantages of this model

Compared to simple episode counting, this approach has several advantages:

- **Proportional:** A deep hypo (1.5 mmol/L) causes far more damage than a
  mild one (2.8 mmol/L)
- **Continuous:** No arbitrary threshold for what "counts" as an episode
- **Reversible:** Recovery occurs gradually when hypos are avoided
- **Realistic:** A short, mild hypo has little effect; a prolonged, deep hypo
  has a large, lasting effect

### Why is this important to understand?

HAAF illustrates an important vicious cycle in T1D management: hypos make it
harder to detect and counteract future hypos. The model teaches the player
that avoiding hypoglycemia is not just important in the moment — it also
protects against future problems.

---

<a name="ketones"></a>
## 11. Ketones and Ketoacidosis (DKA)

### What are ketones?

When the body does not have enough insulin to use glucose as fuel, it switches
to burning fat. The byproduct is ketones (acids in the blood). Without insulin,
this can escalate to diabetic ketoacidosis (DKA) — a life-threatening condition.

### Clinical thresholds

| Level | Value (mmol/L) | Meaning |
|-------|----------------|---------|
| Normal | Below 0.6 | Everything is fine |
| Elevated | 0.6 - 1.5 | Take extra insulin, drink water |
| Dangerous | 1.5 - 3.0 | Seek medical attention, give insulin |
| DKA | Above 3.0 | Acutely life-threatening |

### How is it modeled?

The ketone model is deliberately simplified (the full physiology is far more
complex):

**Ketone production:** Ketones rise when two conditions are met simultaneously:
1. Insulin deficiency (IOB below 0.1 units AND no active basal insulin)
2. High blood glucose (above 12 mmol/L)

The rate of rise is proportional to how high blood glucose is:
maximum approximately 0.5 mmol/L per hour at blood glucose above 20.

**Ketone clearance:** When there is sufficient insulin present, ketones
decline with a half-life of approximately 2 hours.

**Clamping:** The ketone level is kept within 0.0 - 10.0 mmol/L to
avoid numerical artifacts.

### DKA as a game over condition

When all of the following conditions are met simultaneously:
- Blood glucose above 12 mmol/L
- IOB below 0.1 units
- No active basal insulin
- Last insulin more than 8 hours ago

...a DKA timer starts. After 6 hours a warning appears. After an additional
12 hours (total 18 hours) it is game over. Giving insulin at any
point resets the timer.

### Why is this important to understand?

DKA is the most common acute cause of death in T1D. It develops over hours —
not minutes — so there is time to act. But it requires active
attention: you must give insulin and drink water. The model teaches
the player to recognize the signs (high blood glucose + insulin deficiency) and act
in time.

---

<a name="cgm"></a>
## 12. CGM Simulation — The Sensor's Limitations

### What is a CGM?

A CGM (Continuous Glucose Monitor) is a sensor that sits under the skin and
measures glucose concentration in interstitial fluid every 5 minutes. It is the
primary tool most T1D patients use to track their blood glucose.

But the CGM value is NOT the same as true blood glucose. There are three
important deviations that the model simulates:

### 1. Interstitial delay (physiological compartment model)

The CGM measures glucose in interstitial fluid (interstitial fluid), not directly in
the blood. Glucose must first diffuse from blood capillaries into the
interstitial fluid. This delay is modeled as a separate
compartment in the Hovorka model with a differential equation:

```
dC/dt = ka_int × (G - C)
```

where G is plasma glucose (the "true" blood glucose) and C is the interstitial
glucose concentration (what the CGM measures). The constant `ka_int = 0.073 min⁻¹`
gives a time constant of ~14 minutes.

This is *not* a simple time shift — it is a first-order low-pass filter.
The difference is important:

- **Rapidly rising BG (e.g., after food):** CGM lags behind → shows lower than
  reality. The faster the rise, the greater the delay.
- **Rapidly falling BG (e.g., after insulin):** CGM lags behind → shows *higher*
  than reality. **Dangerous:** you can actually be in hypo while the CGM still shows 4-5.
- **Stable BG:** CGM = true BG. No delay at steady state.

The effective delay is typically 5-10 minutes at normal rates of change,
but can feel longer during rapid BG changes (e.g., post-bolus or during exercise).

*Code: `dC = ka_int * (G - C)` in the Hovorka ODE step,
[hovorka.js](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js) line 398.*

### 2. Random noise

The sensor electronics introduce measurement uncertainty. The model uses
normally distributed noise that scales with the BG level (calibrated from approximately
34,000 real Libre 2 measurements over a year):

- At blood glucose 5 mmol/L: standard deviation approximately 0.15 mmol/L
- At blood glucose 10 mmol/L: standard deviation approximately 0.30 mmol/L

The noise is generated with the Box-Muller transform for a realistic normal distribution.

### 3. Systematic drift

CGM sensors have a slow, systematic deviation that varies over hours.
The model simulates this as a sine wave with:
- Period: 4-8 hours (random at simulation start)
- Amplitude: 0.3-0.7 mmol/L (random)

### 4. Discontinuities

Occasional sudden jumps in the CGM value (approximately 0.7 per day). These
are caused by e.g., compression of the sensor (lying on it), calibration adjustments,
or transient sensor errors. In the model they produce a jump of up to
+/- 2 mmol/L.

### Fingerstick vs. CGM

The player can also perform a fingerstick measurement that measures blood glucose
directly (not interstitial fluid). It is more accurate but still has +/- 5%
measurement uncertainty.

### Why is this important to understand?

- The CGM value is an **estimate** — not an exact measurement
- During rapidly falling blood glucose, the CGM shows a higher value than
  reality (the delay)
- Sudden jumps in the CGM value are normal and are not necessarily caused by
  a real change in blood glucose
- A fingerstick provides a more reliable measurement in case of doubt

---

<a name="variability"></a>
## 13. Variability — Why Doesn't It Work the Same Every Time?

One of the most frustrating aspects of T1D is that **the same thing never works the same way twice**. You can give exactly the same insulin dose, eat exactly the same food, and still get a completely different blood glucose profile. The simulator deliberately models this variability, because it is a central part of the T1D experience.

### Sources of variability in the simulator

The model has four independent sources of variability:

#### 1. Insulin bioavailability (local degradation)

Not all injected insulin reaches the bloodstream. Some is degraded by proteases (enzymes) in the subcutaneous tissue before it is absorbed. The model draws a normally distributed bioavailability per injection:

- **Rapid-acting (bolus):** mean 78%, std 8% (clamped 55-95%)
- **Long-acting (basal):** mean 82%, std 8% (clamped 60-95%)

Absolute bioavailability for subcutaneous insulin has been measured at **55-77%** (insulin lispro, FDA label), up to 84% in individual studies (Gradel et al. 2018). This means that of 5U injected bolus insulin, approximately 3-4U actually reach the blood. The rest is degraded locally by enzymes (proteases) in the subcutaneous tissue, or accumulates in the depot without reaching the bloodstream.

> **Implementation:** [`js/simulator.js` — addFastInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1041) and [`addLongInsulin()`](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

#### 2. Absorption rate (tau_I variation)

The time constant for insulin absorption (tau_I, normally 55 min) varies from injection to injection. The model draws a normally distributed scaling factor:

- **tauFactor:** mean 1.0, std 0.25 (CV ~25%), clamped 0.50-1.60

A tauFactor of 0.7 gives a peak after ~38 min instead of ~55 min. A tauFactor of 1.4 gives a peak after ~77 min. The causes in reality:

| Factor | Effect on absorption | Source |
|--------|---------------------|--------|
| Injection depth | IM = much faster; 8mm needle gives >10x higher risk of IM vs. 4mm | Gradel 2018 |
| Injection site | Abdomen fastest (reference), arm 30% slower, thigh **86% slower** | [Koivisto 1980](https://pubmed.ncbi.nlm.nih.gov/7042427/) |
| Local blood flow | Heat/exercise increases; sauna: absorption **110% faster** | [Koivisto 1981](https://pubmed.ncbi.nlm.nih.gov/7000239/) |
| Lipodystrophy | Cmax **25% lower**, AUC **22-46% lower**, BG ~40% higher for 5+ hours | [Tian 2023](https://journals.sagepub.com/doi/10.1177/19322968231187661) |
| Dose size | Larger depot = slower absorption (lower surface:volume ratio) | Heinemann 2002 |
| Temperature | 35°C vs. 20°C: insulin absorption **50-60% faster** in heat | [Sindelka 1994](https://pubmed.ncbi.nlm.nih.gov/7010077/) |
| Smoking | Nicotine → cutaneous vasoconstriction → reduced absorption + increased insulin resistance | [Bergman 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3501865/) |

When multiple injections are active simultaneously, tau_I is calculated as a weighted average of all active injections' tauFactor.

> **Implementation:** [`js/simulator.js` — update() insulin section](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L531) and [`js/hovorka.js` — S1/S2 differential equations](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L344)

#### 3. Pulse-accelerated absorption (pulseFactor)

Increased heart rate during exercise increases blood flow in the subcutaneous tissue, which washes insulin out faster from the depot. This is **not** random variability but a deterministic mechanism that depends on activity:

```
pulseFactor = 1 + max(0, (heartRate - restingHeartRate) / restingHeartRate) × 0.5
```

| Heart rate | pulseFactor | Effect |
|------------|------------|--------|
| 60 (resting) | 1.00 | Normal absorption |
| 100 | 1.33 | 33% faster |
| 120 | 1.50 | 50% faster |
| 160 | 1.83 | 83% faster |

This effect applies to **all insulin in the depot** — both bolus and basal. This is an important reason why exercise can produce unexpectedly strong BG drops.

> **Implementation:** [`js/hovorka.js` — pulseFactor in derivatives()](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L272)

Note the enormous difference between insulin types — Tresiba (degludec) is markedly
more predictable than Lantus (glargine), which has dramatic variability after 8 hours:

| Insulin | CV (day-to-day) | Source |
|---------|-----------------|--------|
| NPH | 59-68% | [Heise 2004](https://pubmed.ncbi.nlm.nih.gov/15161770/) |
| Lantus (glargine U100) | 46-82% | [Heise 2012](https://pubmed.ncbi.nlm.nih.gov/22594461/) |
| Toujeo (glargine U300) | Lower than U100 | [Heise 2017](https://pubmed.ncbi.nlm.nih.gov/28295934/) |
| Levemir (detemir) | 27% | [Heise 2004](https://pubmed.ncbi.nlm.nih.gov/15161770/) |
| Tresiba (degludec) | 20% | [Heise 2012](https://pubmed.ncbi.nlm.nih.gov/22594461/) |

> **Implementation:** [`js/simulator.js` — addLongInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

#### 4. CGM sensor variability

The CGM value deviates from true blood glucose in four ways:

| Source | What | Parameters |
|--------|------|-----------|
| Sensor delay | Glucose must diffuse from blood to interstitial fluid | 5-10 min (random) |
| Random noise | Electrical and biological noise in the sensor | 2.5-4.0% of BG (normally distributed) |
| Systematic drift | Slow sine wave from sensor degradation | Period 4-8h, amplitude 0.3-0.7 mmol/L |
| Discontinuities | Sudden jumps (compression, calibration) | ~0.7 per day, up to ±2 mmol/L |

The noise parameters are calibrated from approximately 34,000 Freestyle Libre 2 measurements over a year from a real T1D patient.

For comparison, official MARD values (Mean Absolute Relative Difference) for current CGM sensors:

| Sensor | MARD | Source |
|--------|------|--------|
| FreeStyle Libre 2 | 9.2% | [Alva 2022](https://pubmed.ncbi.nlm.nih.gov/32954812/) |
| FreeStyle Libre 3 | 7.9% | Abbott 2022 |
| Dexcom G6 | 9.9% | Welsh 2024 |
| Dexcom G7 | 8.2% (arm) | [Shah 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9208857/) |

Note: the physiological delay (5-6 min in healthy individuals, **7-8 min in T1D**) is only a part of the total CGM delay. Fibrous encapsulation of the sensor is the dominant source of delay ([Helton 2019](https://diabetesjournals.org/diabetes/article/68/10/1892/35372/)).

> **Implementation:** [`js/simulator.js` — CGM calculation in update()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L737)

#### 5. Carbohydrate bioavailability (A_G)

Not all carbohydrates are absorbed. The model uses a fixed bioavailability of 80% (A_G = 0.8) from the Hovorka model. In reality this varies substantially:

| Food type | Estimated bioavailability |
|-----------|--------------------------|
| Glucose drink / cola | ~95-100% |
| White bread, rice | ~85-90% |
| Mixed meal | ~75-85% |
| Whole grains with fiber | ~60-75% |

Variable A_G per food type is planned as a future feature (see TODO 31 in CLAUDE.md).

> **Implementation:** [`js/hovorka.js` — A_G constant](https://github.com/krauhe/t1d-simulator/blob/main/js/hovorka.js#L83)

#### 6. Basal insulin duration

Long-acting insulin's duration varies with a normal distribution:

- **Mean:** 28 hours, **std:** 3 hours (clamped 22-38 hours)

This reflects that Lantus/Levemir do not have perfectly predictable duration — some days it lasts 25 hours, others 31. Tresiba has even longer and more stable duration (>40 hours), but is not separately modeled yet.

> **Implementation:** [`js/simulator.js` — addLongInsulin()](https://github.com/krauhe/t1d-simulator/blob/main/js/simulator.js#L1095)

### Overall variability budget

For a typical bolus injection, the total effect variation is approximately:

| Source | CV | Type |
|--------|----|------|
| Bioavailability | ~10% | Random per injection |
| Absorption rate (tau_I) | ~25% | Random per injection |
| Heart rate (exercise) | 0-83% | Deterministic, depends on activity |
| CGM reading | ~3-4% | Random per measurement |
| **Total random** | **~27%** | Stacks (root-sum-of-squares) |

The total random CV of ~27% matches Heinemann 2002's reported intra-individual variation of 20-30% for rapid-acting insulin analogs.

### Why is this important to understand?

- **"Same dose, different result"** is normal — it is not your fault
- Insulin's effect can vary by up to ±50% from time to time (2 standard deviations)
- Exercise further amplifies variability via accelerated absorption
- The CGM value is an estimate with its own uncertainty on top of insulin's
- Good T1D management is about navigating this uncertainty — not eliminating it

> **Sources:**
>
> *Insulin variability:*
> - Heinemann L. (2002). "Variability of insulin absorption and insulin action." *Diabetes Technol Ther*, 4(5):673-682. [PubMed](https://pubmed.ncbi.nlm.nih.gov/12450450/)
> - Gradel AKJ, et al. (2018). "Factors Affecting the Absorption of Subcutaneously Administered Insulin." *J Diabetes Res*. [PMC6079517](https://pmc.ncbi.nlm.nih.gov/articles/PMC6079517/)
> - Heise T, et al. (2004). "Lower within-subject variability of insulin detemir vs NPH and glargine." *Diabetes*, 53(Suppl 2). [PubMed](https://pubmed.ncbi.nlm.nih.gov/15161770/)
> - Heise T, et al. (2012). "Insulin degludec: four times lower pharmacodynamic variability than insulin glargine." *Diabetes Obes Metab*, 14(9):859-64. [PubMed](https://pubmed.ncbi.nlm.nih.gov/22594461/)
> - Heise T, et al. (2017). "Insulin degludec vs insulin glargine U300: day-to-day variability." *Diabetes Obes Metab*, 19(7):1032-1039. [PubMed](https://pubmed.ncbi.nlm.nih.gov/28295934/)
>
> *Injection site and absorption:*
> - Koivisto VA, Felig P. (1980). "Alterations in insulin absorption and blood glucose control associated with varying insulin injection sites." *Ann Intern Med*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7042427/)
> - Koivisto VA. (1981). "Sauna-induced acceleration in insulin absorption from subcutaneous injection site." *BMJ*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7000239/)
> - Sindelka G, et al. (1994). "Effect of temperature on insulin absorption." *Diabetologia*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/7010077/)
> - McCarthy O, et al. (2020). "Factors Influencing Subcutaneous Insulin Absorption Around Exercise in T1D." *Front Endocrinol*. [PMC7609903](https://pmc.ncbi.nlm.nih.gov/articles/PMC7609903/)
> - Tian T, et al. (2023). "Lipohypertrophy and insulin: update from DTS." *J Diabetes Sci Technol*. [Sagepub](https://journals.sagepub.com/doi/10.1177/19322968231187661)
>
> *CGM accuracy:*
> - Alva S, et al. (2022). "Accuracy of a 14-day factory-calibrated CGM." *J Diabetes Sci Technol*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/32954812/)
> - Shah VN, et al. (2022). "Accuracy and safety of Dexcom G7 in adults." *Diabetes Technol Ther*. [PMC9208857](https://pmc.ncbi.nlm.nih.gov/articles/PMC9208857/)
> - Helton KL, et al. (2019). "Fibrotic encapsulation is the dominant source of CGM delays." *Diabetes*, 68(10):1892. [Diabetes](https://diabetesjournals.org/diabetes/article/68/10/1892/35372/)
> - Basu A, et al. (2013). "Time lag of glucose from intravascular to interstitial compartment." *Diabetes*. [PMC3837059](https://pmc.ncbi.nlm.nih.gov/articles/PMC3837059/)
>
> *Carbohydrate bioavailability:*
> - Livesey G. (2005). "Low-glycaemic diets and health." *Br J Nutr*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/16115326/)
>
> *Simulation models:*
> - Hovorka R, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiol Meas*, 25(4):905-920.
> - Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030. [PMC7449052](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7449052/)

---

<a name="weight"></a>
## 14. Weight and Calorie Balance

### The basic idea

Weight changes based on calorie balance:

```
netCalorieRate = eaten - (restingExpenditure + exerciseExpenditure)
weightChange_kg = netCalorieRate / 7700
```

7700 kcal corresponds approximately to 1 kg of body weight (standard nutritional approximation).

### Resting expenditure (BMR)

Calculated proportionally to body weight:
- At 70 kg: 2200 kcal/day
- At 80 kg: approximately 2514 kcal/day
- At 50 kg: approximately 1571 kcal/day

### Exercise expenditure

Extra calorie burn from exercise:
- Low intensity: 4 kcal/min
- Medium intensity: 7 kcal/min
- High intensity: 10 kcal/min

### Why is this important to understand?

Weight is part of the overall picture in T1D management. Too much insulin without
sufficient exercise can lead to weight gain. Too little food can lead to
weight loss. The simulator gives game over at +/- 5 kg weight change to
illustrate the importance of balance.

---

<a name="scoring"></a>
## 15. Scoring and Game Over

### Clinical background: Time in Range (Battelino et al. 2019)

The game's scoring system is based on the international consensus on "Time in
Range" (TIR) — the most recognized standard for CGM-based glucose control.
The consensus defines five zones with targets for how much of the day one
should spend in each:

| Zone | BG interval | Clinical target | Corresponds to |
|------|------------|-----------------|----------------|
| **Very low** (TBR Level 2) | <3.0 mmol/L (<54 mg/dL) | <1% | <15 min/day |
| **Low** (TBR Level 1) | 3.0-3.9 mmol/L (54-70 mg/dL) | <4% | <1 hour/day |
| **In range** (TIR) | 3.9-10.0 mmol/L (70-180 mg/dL) | >70% | >16.8 hours/day |
| **High** (TAR Level 1) | 10.0-13.9 mmol/L (180-250 mg/dL) | <25% | <6 hours/day |
| **Very high** (TAR Level 2) | >13.9 mmol/L (>250 mg/dL) | <5% | <1.2 hours/day |

Key point: >70% of time should be in range (3.9-10.0), and <5% should be "very
high" (>13.9). Low blood glucose is acutely dangerous, while high blood glucose is harmful
in the long term (eyes, kidneys, nerves) — but not acutely life-threatening.

### Scoring system in the simulator

The game's scoring zones are simplified from the TIR table with 14 mmol/L as the boundary
(close to the clinical 13.9):

| Zone | Blood glucose | Points per hour | Clinical background |
|------|--------------|-----------------|---------------------|
| Bonus (tight control) | 5.0-6.0 mmol/L | 2.0 | Close to normal — hard to achieve |
| Normal (in range) | 4.0-10.0 mmol/L | 1.0 | The TIR zone — target is >70% here |
| Elevated (orange) | 10.0-14.0 mmol/L | 0.5 | TAR Level 1 — allowed up to 25% |
| No points | <4.0 or >14.0 | 0 | Hypo or TAR Level 2 — dangerous |

The asymmetry is deliberate: hypoglycemia (<4.0) gives 0 points because it is acutely
dangerous (seizures, fainting, coma), while moderate hyperglycemia (10-14) still
gives half points because it is acceptable for shorter periods — exactly as
the clinical consensus allows up to 6 hours/day in TAR Level 1.

### Game over conditions

The game ends in four scenarios:

1. **Severe hypoglycemia:** Blood glucose below 1.5 mmol/L (brain death)
2. **Extreme weight change:** More than 5 kg gain or loss
3. **Diabetic ketoacidosis (DKA):** Prolonged insulin deficiency + high blood glucose
4. **Chronic complications:** 14-day average above 15 mmol/L (after day 14)

---

<a name="limitations"></a>
## 16. Limitations and Caveats

T1D Simulator is an **educational tool and game** — NOT a medical device.
Important limitations:

1. **Simplifications:** The model is a simplification of reality. Real patients
   have individual variation that is not fully captured by the model.

2. **Parameters:** Default parameters represent an "average" T1D patient.
   Individual parameters (ISF, ICR) can vary markedly from person to person
   and from day to day.

3. **Unmodeled factors:** Alcohol, menstruation, temperature, illness
   (beyond general stress), and many other factors affect blood glucose in
   reality but are not (yet) included in the simulator.

4. **Body composition and muscle mass:** ISF captures the static insulin sensitivity,
   but not the dynamics during exercise. In reality, more muscle mass means:
   greater GLUT4 uptake during exercise (the E1 effect should scale with muscle mass),
   larger glycogen stores (longer time before depletion during cardio), higher
   basal metabolic rate, and greater peripheral distribution volume (Q2 in Hovorka). Two
   people with the same ISF but very different body composition would respond markedly
   differently to exercise.

5. **Pregnancy:** Markedly increased insulin resistance in the 2nd and 3rd trimester, tighter
   BG targets (3.5-7.8 mmol/L per Battelino 2019), risk of gestational diabetes.
   Would require dynamic ISF changes over weeks/months — too complex for
   the current simulation.

6. **Hypoxia and altitude exposure:** Hypoxia (low oxygen saturation) increases muscle
   glucose uptake via AMPK activation (same pathway as exercise), and red
   blood cells consume more glucose under hypoxia. Additionally, CGM sensors
   become less reliable at low oxygen saturation. Relevant for mountain climbing, air travel,
   and lung diseases — but rare enough not to prioritize in the simulator.

7. **Ketone model:** Simplified compared to the full physiology. The current model
   uses BG > 12 as a trigger, but ketogenesis is primarily driven by insulin levels
   (see section 11 and VIDENSKAB.md section 23). Fasting ketosis is not modeled.
   Real ketoacidosis involves pH changes, dehydration, and
   electrolyte disturbances that are not modeled.

8. **Exercise:** Models aerobic and anaerobic as separate mechanisms, but
   reality is a spectrum. Individual variation in exercise response is large.

9. **Insulin types:** Only a general rapid-acting and a general long-acting
   insulin are modeled. Differences between specific preparations (NovoRapid vs.
   Fiasp, Lantus vs. Tresiba) are not included.

10. **No pump model:** Insulin pumps (continuous subcutaneous insulin infusion)
    are not modeled.

**NEVER use this simulator as a basis for medical decisions.
Always follow your doctor's recommendations.**

---

<a name="references"></a>
## 17. Scientific References

### Primary sources

1. **Hovorka R, Canonico V, Chassin LJ, et al.** (2004). "Nonlinear model
   predictive control of glucose concentration in subjects with type 1 diabetes."
   *Physiological Measurement*, 25(4):905-920.
   - The core model for glucose-insulin dynamics
   - [PDF (Yale)](http://www.stat.yale.edu/~jtc5/diabetes/NonlinearModelPredictiveControl_Hovorka_04.pdf)

2. **Resalat N, El Youssef J, Reddy R, Jacobs PG.** (2020). "Simulation Software
   for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms:
   Glucose-Insulin Dynamics in Type 1 Diabetes." *IFAC-PapersOnLine*, 53(2):16025-16030.
   - Extended Hovorka model with exercise effects (E1, E2 state variables)
   - [PMC7449052](https://pmc.ncbi.nlm.nih.gov/articles/PMC7449052/)

3. **Dalla Man C, Rizza RA, Cobelli C.** (2007). "Meal Simulation Model of the
   Glucose-Insulin System." *IEEE Transactions on Biomedical Engineering*, 54(10):1740-1749.
   - The UVA/Padova model — FDA-approved as a substitute for animal trials in
     insulin pump trials

4. **Dalla Man C et al.** (2025). "Simulation of High-Fat High-Protein Meals Using
   the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.
   - Mixed meals with fat and protein effects on glucose absorption

### Secondary sources

5. **Kudva YC, et al.** (2021). "Exercise effect on insulin-dependent and
   insulin-independent glucose utilization in healthy individuals and individuals
   with type 1 diabetes." *American Journal of Physiology — Endocrinology and
   Metabolism*, 321(2):E230-E237.
   - Insulin-dependent vs. insulin-independent glucose uptake during exercise
   - [PMC8321821](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)

6. **Agianniotis A, et al.** (2021). "Modelling glucose dynamics during moderate
   exercise in individuals with type 1 diabetes." *PLOS ONE*, 16(3):e0248280.
   - Detailed model of glucose dynamics during moderate exercise

7. **Ajmera I, et al.** (2021). "A comparison among three maximal mathematical
   models of the glucose-insulin system." *PLOS ONE*, 16(9):e0257789.
   - Comparison of the Hovorka, UVA/Padova, and Sorensen models

8. **Donga E, et al.** (2010). "A single night of partial sleep deprivation
   induces insulin resistance in multiple metabolic pathways in healthy subjects."
   *Diabetes Care*.
   - Sleep restriction and insulin resistance

9. **Dagogo-Jack SE, Craft S, Cryer PE.** (1993). "Hypoglycemia-associated
   autonomic failure in insulin-dependent diabetes mellitus." *Journal of Clinical
   Investigation*, 91(3):819-828.
   - HAAF — repeated hypos weaken counterregulation

10. **Cryer PE.** (2013). "Mechanisms of hypoglycemia-associated autonomic failure
    in diabetes." *New England Journal of Medicine*, 369(4):362-372.
    - Overview of HAAF mechanisms and counterregulation thresholds

### Supplementary literature

11. **Bergman RN, Ider YZ, Bowden CR, Cobelli C.** (1979). "Quantitative estimation
    of insulin sensitivity." *American Journal of Physiology*, 236(6):E667-E677.
    - The original "Bergman Minimal Model"

12. **Sorensen JT.** (1985). "A Physiologic Model of Glucose Metabolism in Man and
    Its Use to Design and Assess Improved Insulin Therapies for Diabetes."
    PhD Thesis, MIT.
    - The most detailed multi-organ model

13. **Battelino T, et al.** (2019). "Clinical Targets for Continuous Glucose
    Monitoring Data Interpretation." *Diabetes Care*, 42(8):1593-1603.
    - International consensus on Time in Range (TIR), TAR, and TBR

14. **Bengtsen MB, Moller N.** (2021). "Mini-review: Glucagon responses in type 1
    diabetes — a matter of complexity." *Physiological Reports*.
    - Glucagon response in T1D (loss of response after 1-5 years)

---

<a name="open-source"></a>
## 18. Open Source Software Used

### Direct implementations

- **[svelte-flask-hovorka-simulator](https://github.com/jonasnm/svelte-flask-hovorka-simulator)**
  by Jonas Nordhassel Myhre
  - Python implementation of the Hovorka model's differential equations
  - Our JavaScript port is based on this implementation
  - License: MIT (assumed — no explicit license in repo)

### Dependencies

- **[Tone.js](https://tonejs.github.io/)** v14.8.49 — Web Audio framework for sound effects
  - License: MIT

---

*Last updated: March 2026*
