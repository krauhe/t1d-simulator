<!-- doc-version: 2026-03-13-v1 -->
# Blood Glucose Regulation in Type 1 Diabetes -- A Complete Knowledge Overview

*This guide covers all known factors that affect blood glucose in people with type 1 diabetes. It is written for patients, family members, and healthcare professionals -- with scientific depth for those who want it.*

This document serves as a knowledge base for the T1D Simulator, but also covers topics not yet implemented in the game. Think of it as a reference work: you don't need to read it from start to finish, but can look up the topics that are relevant to you.

**What do the status markers mean?**

- **Active in simulator** -- this factor is modeled and affects the game
- **Partially modeled** -- a simplified version is implemented
- **Not implemented** -- documented here as knowledge, but not (yet) part of the game

---

## Table of Contents

**Part 1: The Fundamental Processes**
1. [How glucose moves through the body](#1-how-glucose-moves-through-the-body)
2. [Insulin -- from injection to effect](#2-insulin--from-injection-to-effect)
3. [Carbohydrates -- from mouth to blood glucose](#3-carbohydrates--from-mouth-to-blood-glucose)
4. [Fat and protein -- the forgotten macronutrients](#4-fat-and-protein--the-forgotten-macronutrients)
5. [Hepatic glucose production](#5-hepatic-glucose-production)
6. [The role of the kidneys -- a natural safety valve](#6-the-role-of-the-kidneys--a-natural-safety-valve)
7. [The brain's glucose consumption](#7-the-brains-glucose-consumption)

**Part 2: Physical Activity**
8. [Aerobic exercise -- running, cycling, swimming](#8-aerobic-exercise--running-cycling-swimming)
9. [Anaerobic training -- resistance training and sprinting](#9-anaerobic-training--resistance-training-and-sprinting)
10. [Exercise-induced inflammation -- when exercise hurts](#10-exercise-induced-inflammation--when-exercise-hurts)
10b. [Relaxation, yoga, and meditation](#10b-relaxation-yoga-and-meditation--stress-reduction-and-blood-glucose)

**Part 3: Hormones and Circadian Rhythm**
11. [Counterregulatory hormones -- the body's defense against low blood glucose](#11-counterregulatory-hormones--the-bodys-defense-against-low-blood-glucose)
12. [The dawn phenomenon -- morning blood glucose rise](#12-the-dawn-phenomenon--morning-blood-glucose-rise)
13. [The Somogyi effect -- rebound after nocturnal hypoglycemia](#13-the-somogyi-effect--rebound-after-nocturnal-hypoglycemia)
14. [Diurnal variation in insulin sensitivity](#14-diurnal-variation-in-insulin-sensitivity)
15. [Menstrual cycle and insulin requirements](#15-menstrual-cycle-and-insulin-requirements)
16. [Seasonal variation](#16-seasonal-variation)

**Part 4: Lifestyle and External Factors**
17. [Illness and infection](#17-illness-and-infection)
18. [Sleep and sleep deprivation](#18-sleep-and-sleep-deprivation)
19. [Alcohol](#19-alcohol)
20. [Psychological stress](#20-psychological-stress)
21. [Temperature and climate](#21-temperature-and-climate)
22. [Injection site](#22-injection-site)

**Part 5: Complications and Warning Signs**
23. [Ketone bodies and diabetic ketoacidosis](#23-ketone-bodies-and-diabetic-ketoacidosis)
24. [Insulin overdose and the limitations of counterregulation](#24-insulin-overdose-and-the-limitations-of-counterregulation)
25. [Non-linearity in insulin action -- threshold effects](#25-non-linearity-in-insulin-action--threshold-effects)

**Part 6: Technology and Research Models**
26. [CGM technology -- continuous glucose monitoring](#26-cgm-technology--continuous-glucose-monitoring)
27. [Mathematical models used in research](#27-mathematical-models-used-in-research)

---

# Part 1: The Fundamental Processes

These processes are the foundation of all blood glucose management. They run continuously in the body and form the basis for everything that follows in the rest of this document.

---

## 1. How glucose moves through the body

**Active in simulator (Hovorka 2004 model)**

Glucose -- the sugar the body uses as fuel -- is not located in just one place in the body. It is distributed between two "compartments":

**The blood (plasma glucose):** This is where we measure blood glucose, and this is where the brain, muscles, and all organs obtain their energy. When you take a blood glucose measurement, you are seeing the glucose concentration in this compartment.

**The body's tissues (muscles, adipose tissue, etc.):** Glucose moves somewhat more slowly here from the blood. This occurs partly through simple diffusion and partly through insulin-mediated transport. Think of it as a buffer -- when blood glucose rises, the tissues draw glucose in, and when it falls, they release it again.

The exchange between the two compartments determines how quickly blood glucose changes after a meal or an insulin dose. The glucose concentration in the blood is calculated from the amount of glucose and the body's size (distribution volume is approximately 0.16 liters per kilogram of body weight).

In the simulator, this is modeled using Hovorka's two-compartment model, which describes the flow of glucose between blood and tissue with mathematical equations. This is the model that "knows" your blood glucose in the game.

> **Source:** Hovorka R, Canonico V, Chassin LJ, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

---

## 2. Insulin -- from injection to effect

**Active in simulator (Hovorka 2004 subcutaneous model)**

When you inject insulin, nothing happens immediately. The insulin must first travel from the subcutaneous adipose tissue (where the needle delivers it) into the blood, and then from the blood out to the cells that need to use it. This entire process takes time -- and that is why timing is so important in type 1 diabetes.

### From injection to the bloodstream

Insulin is injected under the skin, where it forms a small depot. From there, it is gradually absorbed into the bloodstream. For rapid-acting insulin such as NovoRapid, absorption reaches its peak after approximately 110 minutes (just under 2 hours). This is why it is recommended to give a bolus 15-20 minutes before a meal -- so the insulin is "ready" when the glucose from the food begins to reach the blood.

### From the blood to effect

Even when insulin is in the blood, it does not work immediately. It must first bind to receptors on cells and initiate a chain of signals. This delay is modeled with three parallel "effect channels":

1. **Glucose transport** -- insulin helps glucose move from the blood into muscles
2. **Glucose utilization** -- insulin increases muscle glucose oxidation
3. **Hepatic glucose production** -- insulin suppresses the liver's release of glucose

The three channels have slightly different speeds, and together they produce the broad, gradual insulin effect we know clinically.

### Insulin types

Different insulin preparations have vastly different profiles:

| Type | Category | Onset | Peak | Duration |
|------|----------|-------|------|----------|
| NovoRapid (aspart) | Rapid-acting | 10-20 min | 1-2 hours | 3-5 hours |
| Humalog (lispro) | Rapid-acting | 10-15 min | 1-2 hours | 3-4 hours |
| Fiasp (faster aspart) | Ultra-rapid | 2-5 min | 1-1.5 hours | 3-4 hours |
| Lantus (glargine) | Long-acting | 1-2 hours | Nearly flat | approx. 24 hours |
| Tresiba (degludec) | Ultra-long-acting | 1-2 hours | Nearly flat | over 42 hours |

The faster the insulin works, the easier it is to match a meal -- but also the easier it is to make mistakes. Long-acting insulin covers the body's basal needs and should ideally provide a steady background coverage.

> **Sources:**
> - Hovorka et al. (2004), see above.
> - Heise T, et al. (2015). "Pharmacokinetic and pharmacodynamic properties of faster-acting insulin aspart versus insulin aspart across a clinically relevant dose range." *Clinical Pharmacokinetics*, 56(6):649-660.

---

## 3. Carbohydrates -- from mouth to blood glucose

**Active in simulator (Hovorka 2004 gut model)**

When you eat carbohydrates, they undergo a journey before they affect blood glucose:

1. **Chewing and stomach:** The food is broken down mechanically and enzymatically. The stomach releases food into the small intestine at a rate of 1-4 kcal per minute. This gastric emptying rate is actually the factor that most often limits how quickly blood glucose rises.

2. **Small intestine:** Here glucose is absorbed and transported via the blood to the liver, and from there to the rest of the body.

Not all carbohydrate becomes glucose in the blood. Approximately 80% is absorbed (the rest passes through or is consumed by the intestinal cells themselves). For fast carbohydrates like white bread or juice, glucose reaches the blood after about 20-30 minutes. For slow carbohydrates like whole grains or legumes, it can take 60-90 minutes.

### Glycemic index -- what it's really about

The glycemic index (GI) is essentially a measure of how quickly food empties from the stomach and is digested. Foods with low GI (whole grains, legumes) produce a lower and broader blood glucose peak. Foods with high GI (white bread, juice) produce a high, sharp peak. For T1D patients, this means that insulin timing must be adapted to the type of food -- not just the amount of carbohydrate.

> **Sources:**
> - Hovorka et al. (2004), see section 1.
> - Haidar A, et al. (2014). "Mathematical Model of Glucose-Insulin Metabolism in Type 1 Diabetes Including Digestion and Absorption of Carbohydrates." *SICE Journal of Control, Measurement, and System Integration*, 7(6):314-325.
> - Bornhorst GM, et al. (2016). "A mechanistic model of intermittent gastric emptying and glucose-insulin dynamics following a meal containing milk components." *PLOS ONE*, 11(6):e0156443.

---

## 4. Fat and protein -- the forgotten macronutrients

**Partially modeled**

Most newly diagnosed patients learn to count carbohydrates -- but fat and protein also affect blood glucose. Many people don't know this, and it can lead to unexplained blood glucose rises hours after a meal.

### Fat delays gastric emptying

Fat in a meal significantly slows gastric emptying. The mechanism is that fat triggers hormones from the small intestine (GLP-1, GIP, and cholecystokinin) that signal the stomach to slow down. The result is that carbohydrates from the same meal are absorbed more slowly -- blood glucose rises later, but also over a longer period. A high-fat meal (e.g., pizza) can therefore produce a blood glucose peak 3-4 hours after eating, whereas a low-fat meal with the same carbohydrate content would peak after 1-2 hours.

### Protein contributes to glucose

Approximately 50-60% of amino acids in protein are "glucogenic" -- they can be converted to glucose in the liver via gluconeogenesis. However, the actual conversion is far smaller than the theoretical maximum, and the primary mechanism by which protein raises BG in T1D is not gluconeogenesis but rather unopposed glucagon secretion.

#### The "Bernstein 25% rule" -- what does the evidence show?

Dr. Richard Bernstein popularized the claim that approximately 36% of ingested protein converts to glucose (sometimes cited as ~25% converting to glucose that raises BG). The theoretical biochemistry supports that 50-80 g glucose *could* be derived from 100 g protein. However, isotope tracer studies show the actual conversion is dramatically lower:

| Study | Protein ingested | Glucose from protein | Conversion rate |
|-------|-----------------|---------------------|-----------------|
| Fromentin et al. 2013 | 23 g egg protein | 3.9 g over 8 h | ~17% |
| Nuttall & Gannon 2001 | 50 g cottage cheese (healthy) | 9.7 g over 8 h | ~19% |
| Nuttall & Gannon 2001 | 50 g beef (T2D) | 2.0 g over 8 h | ~4% |

Fromentin et al. (2013) used doubly-labeled (^15N, ^13C) egg protein with isotope dilution and found that only 3.9 +/- 0.7 g glucose out of 50.4 +/- 7.7 g total glucose produced came from dietary amino acids -- just 8% of total glucose production, peaking at 12.1% contribution at 4.5 hours. The remaining amino acid carbon was oxidized directly as fuel (CO2), not converted to glucose.

**Conclusion:** The Bernstein 25% rule overstates gluconeogenesis from protein by 2-6 fold. The actual glucose produced from protein is modest (~4-10 g from a 50 g protein load). The BG-raising effect of protein in T1D is primarily driven by glucagon, not gluconeogenesis.

#### Why protein raises BG in T1D but not in healthy people

The critical mechanism is **unopposed glucagon secretion**:

1. Amino acids from digested protein stimulate alpha-cell glucagon secretion (glutamine, arginine, and alanine can increase glucagon up to 10-fold at physiological concentrations)
2. In healthy people, the same amino acids also stimulate beta-cell insulin secretion, which (a) suppresses glucagon and (b) counteracts hepatic glucose output. Net effect on BG: minimal.
3. In T1D, there is no endogenous insulin response. Glucagon is unopposed and drives hepatic glucose production (both glycogenolysis and gluconeogenesis) without any counterbalancing insulin signal.

This is why protein can substantially raise BG in T1D while having little or no effect in non-diabetic individuals. The effect is fundamentally a *hormonal* problem (glucagon/insulin imbalance), not primarily a *substrate* problem (amino acids converting to glucose).

#### Time course of protein's effect on BG

Protein's glycemic effect is markedly slower and more prolonged than carbohydrates:

| Parameter | Carbohydrate (20 g glucose) | Protein (75-100 g whey, alone) |
|-----------|---------------------------|-------------------------------|
| Onset | ~15 min | ~90-100 min |
| Peak | ~60 min | ~180 min |
| Duration | ~2-3 h | > 5 h (still elevated at 300 min) |
| Shape | Sharp spike | Slow, sustained rise |

Key timing data from Paterson et al. (2016): BG initially *decreased* from 0-90 min (likely due to GLP-1/GIP incretins delaying gastric emptying and modestly stimulating residual beta cells), then began rising after ~100 min, with the excursion continuing through the entire 300-minute study period.

#### Dose-response: how much protein affects BG?

**Protein alone (no carbs, no insulin)** -- Paterson et al. 2016 (T1D, whey isolate):

| Protein dose | BG effect 60-120 min | BG effect 180-240 min | BG effect 240-300 min | Significant? |
|-------------|---------------------|----------------------|----------------------|-------------|
| 12.5 g | 0.00 mmol/L | +0.21 mmol/L | +0.43 mmol/L | No |
| 25 g | -1.06 mmol/L | -1.38 mmol/L | -1.70 mmol/L | Yes (lower) |
| 50 g | -0.26 mmol/L | +0.28 mmol/L | +0.50 mmol/L | No |
| 75 g | -1.10 mmol/L | +0.71 mmol/L | +1.65 mmol/L | Yes (higher) |
| 100 g | -1.22 mmol/L | +1.06 mmol/L | +1.72 mmol/L | Yes (higher) |

Critical finding: the response is **not linear**. It appears to have a **threshold effect**: doses below ~75 g had no significant BG-raising effect when consumed alone, while >= 75 g produced a clear, delayed, sustained excursion. The 25 g dose actually *lowered* BG, possibly via incretin effects.

**Protein in mixed meals (with carbs)** -- the threshold is much lower:

In carbohydrate-containing meals, as little as 12.5 g of additional protein affected postprandial glucose (Paterson 2019 systematic review). This is because the carbohydrate already provides the gluconeogenic substrate context, and the glucagon from protein adds on top.

#### Protein + fat: the effect is additive

Smart et al. (2013) demonstrated additivity with exact numbers in children with T1D (same carbs in all meals):

| Meal type | BG excursion at 180 min | Time to peak BG | BG excursion at 300 min |
|-----------|------------------------|-----------------|------------------------|
| Low fat + Low protein (baseline) | +0.5 mmol/L | 79 min | baseline |
| Low fat + High protein (40 g) | +2.4 mmol/L | 96 min | elevated |
| High fat (35 g) + Low protein | +1.8 mmol/L | 126 min | elevated |
| High fat + High protein | +4.2 mmol/L | 143 min | +5.4 mmol/L vs baseline |

The HF/HP excursion (4.2 mmol/L) equals the sum of HF alone (1.8) + HP alone (2.4) -- confirming pure additivity with no interaction (P > 0.05 for interaction term). This also extended the time to peak from 79 min (baseline) to 143 min (HF/HP).

Notably, high-protein meals *reduced* hypoglycemia risk (OR 0.16, P < 0.001) -- likely because the glucagon response prevents early postprandial lows.

#### Does insulin-on-board affect whether protein raises BG?

This is a critical question with limited direct evidence, but the mechanistic answer is clear:

- In T1D, the protein -> glucagon -> hepatic glucose output pathway is only problematic because there is **no matching endogenous insulin response** to counteract it
- When exogenous insulin is sufficient (high IOB), it suppresses hepatic glucose production and enhances peripheral glucose uptake, potentially negating the glucagon-driven glucose rise
- When exogenous insulin is low (low IOB, e.g., hours after last bolus), glucagon acts unopposed

The Paterson 2016 study gave protein **without insulin** -- an extreme "zero IOB" condition -- which likely maximized the glycemic effect. In clinical practice, a protein-rich meal consumed shortly after a carb-covering bolus (when IOB is high) would likely show a smaller protein effect.

This is supported indirectly by the dose-response threshold: protein alone needs >= 75 g to raise BG (the incretin/residual beta cell effect partially compensates), whereas protein in a mixed meal (where carb bolus insulin is present but may be insufficient for the protein component) affects BG from >= 12.5 g.

#### Protein type matters: absorption speed affects glucagon response

Dao et al. (2025) showed postprandial glycemia varied almost 2-fold across protein sources in T1D:

| Protein source | Glucose iAUC (mmol-min/L) | Relative effect |
|---------------|--------------------------|-----------------|
| Chicken | 203 +/- 66 | Lowest |
| Egg | 263 +/- 100 | Low |
| Beef | 309 +/- 89 | Medium |
| Salmon | 338 +/- 83 | Medium-high |
| Whey | 397 +/- 115 | Highest |

Fast-absorbing proteins (whey) cause a larger, earlier glucagon spike than slow-absorbing proteins (chicken, casein). This is clinically relevant: a whey protein shake will have a faster, larger BG impact than a chicken breast with the same protein content.

#### Clinical insulin dosing recommendations for protein

There is no consensus algorithm yet (ADA 2026 guidelines), but several evidence-based approaches exist:

**1. Fat-Protein Unit (FPU) method (Pankowska):**
- 1 FPU = 100 kcal from fat + protein = 10 g carb equivalent in insulin need
- Example: 26 g protein + 22 g fat = 302 kcal = 3 FPU = 30 g carb equivalent
- Deliver as extended/dual-wave bolus over 3-8 hours
- **Caution:** increases hypoglycemia risk with normal-sized meals (~33% hypo rate)

**2. Percentage increase method (Bell et al. / ISPAD 2022):**
- For meals with > 40 g fat AND > 25 g protein: increase carb-calculated dose by 25-35%
- Split: 50% upfront, 50% extended over 2-2.5 hours
- ISPAD 2022 suggests starting with 20% extra for high-fat/high-protein meals

**3. New Zealand method (for low-carb diets <= 100 g CHO/day):**
- Use ICR x 2 for protein (e.g., if ICR = 1:10 for carbs, use 1:20 for protein)
- Example: 60 g protein / 20 = 3 units

**4. Timing-based approach (Campbell):**
- Do NOT give extra insulin at meal start (60% experienced hypoglycemia)
- Give 30% additional insulin 3 hours after the meal (0% hypoglycemia)

**5. Quantitative estimate from clinical data:**
- Total meal insulin increased by ~0.12 units per gram of protein in mixed meals
- Approximately 1 unit correction insulin per 8 g protein in a carb-containing meal
- Bell et al.: high-fat/high-protein meals required 65% more insulin (range 17-124%)

**Key clinical takeaway:** The protein insulin should be delivered *late* (extended bolus or delayed injection), not upfront, to match the 2-5 hour time course of protein's glycemic effect.

#### Summary table: protein's glycemic effect in T1D

| Question | Answer |
|----------|--------|
| Does protein raise BG in T1D? | Yes, significantly and consistently |
| Primary mechanism | Unopposed glucagon secretion (not gluconeogenesis) |
| Actual glucose from gluconeogenesis | ~4-10 g per 50 g protein (8-19% conversion, not 25-36%) |
| Onset | ~90-100 min (vs ~15 min for carbs) |
| Peak | ~3 hours (vs ~1 hour for carbs) |
| Duration | > 5 hours |
| Threshold (protein alone) | >= 75 g for significant effect |
| Threshold (with carbs) | >= 12.5 g for significant effect |
| Dose-response | Non-linear, threshold-like (not proportional) |
| Protein + fat | Additive effects |
| Extra insulin needed | ~20-35% more for high-protein meals, delivered extended |
| Effect of protein type | Whey (fast) > beef > egg > chicken (slow) |

> **Sources:**
> - Paterson MA, Smart CEM, Lopez PE, et al. (2016). "Influence of dietary protein on postprandial blood glucose levels in individuals with Type 1 diabetes mellitus using intensive insulin therapy." *Diabetic Medicine*, 33(5):592-598.
> - Paterson MA, King BR, Smart CEM, et al. (2019). "Impact of dietary protein on postprandial glycaemic control and insulin requirements in Type 1 diabetes: a systematic review." *Diabetic Medicine*, 36(12):1585-1599.
> - Smart CEM, Evans M, O'Connell SM, et al. (2013). "Both dietary protein and fat increase postprandial glucose excursions in children with type 1 diabetes, and the effect is additive." *Diabetes Care*, 36(12):3897-3902.
> - Gannon MC, Nuttall FQ. (2013). "Dietary protein and the blood glucose concentration." *Diabetes*, 62(5):1371-1372.
> - Fromentin C, Tome D, Nau F, et al. (2013). "Dietary proteins contribute little to glucose production, even under optimal gluconeogenic conditions in healthy humans." *Diabetes*, 62(5):1435-1442.
> - Bell KJ, Smart CEM, Steil GM, et al. (2015). "Impact of fat, protein, and glycemic index on postprandial glucose control in type 1 diabetes: implications for intensive diabetes management in the continuous glucose monitoring era." *Diabetes Care*, 38(6):1008-1015.
> - Bell KJ, Barclay AW, Petocz P, et al. (2020). "Factors beyond carbohydrate to consider when determining mealtime insulin doses: protein, fat, timing, and technology." *Diabetes Technology & Therapeutics*, 22(4):286-297.
> - Dao L, Kowalski GM, Bruce CR, et al. (2025). "The glycemic impact of protein ingestion in people with type 1 diabetes." *Diabetes Care*, 48(4):509-520.
> - Pankowska E, Blazik M, Groele L. (2012). "Does the fat-protein meal increase postprandial glucose level in type 1 diabetes patients on insulin pump?" *Diabetes Technology & Therapeutics*, 14(1):16-22.
> - Bisgaard Bengtsen M, Moller N. (2021). "Mini-review: Glucagon responses in type 1 diabetes -- a matter of complexity." *Physiological Reports*, 9(16):e15009.
> - Campbell MD, Walker M, King D, et al. (2016). "Carbohydrate counting at meal time followed by a small secondary bolus may be an effective strategy for managing postprandial hyperglycaemia following a high-fat meal in type 1 diabetes." *Diabetic Medicine*, 33(Suppl 1).

---

## 5. Hepatic glucose production

**Active in simulator (Hovorka 2004 + stress hormones)**

The liver is the body's "glucose factory." Even when you are not eating, the liver keeps blood glucose up by constantly releasing glucose into the blood. It does this in two ways:

**Glycogenolysis (breakdown of glycogen stores):** The liver stores approximately 80-100 grams of glucose as glycogen -- a starch-like reserve. This reserve can be mobilized quickly (within minutes) and is the body's first defense against low blood glucose.

**Gluconeogenesis (de novo glucose synthesis):** The liver can also build glucose from scratch, using lactate, amino acids, and glycerol. This process is slower but has practically unlimited capacity as long as raw materials are available.

On a daily basis, the liver produces approximately 160 mg of glucose per minute for a 70 kg person. That is enough to keep blood glucose stable between meals.

### Insulin suppresses the liver

Insulin is the liver's most important signal to reduce glucose production. At normal basal insulin levels, the liver produces approximately 40-60% of its maximum capacity. When you give a bolus and insulin levels rise, hepatic production is suppressed almost completely. This is one of the three ways insulin lowers blood glucose.

### Stress hormones speed up the liver

Counterregulatory hormones (adrenaline, glucagon, cortisol -- see section 11) do the opposite of insulin: they cause the liver to produce more glucose. This is the body's defense mechanism against low blood glucose, but it is also the reason that stress, illness, and the morning dawn phenomenon can drive blood glucose up.

> **Source:** Hovorka et al. (2004). Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *Journal of Clinical Investigation*, 64(1):62-71.

---

## 6. The role of the kidneys -- a natural safety valve

**Active in simulator (Hovorka 2004)**

The kidneys constantly filter the blood, and normally they reabsorb all glucose -- nothing is lost in the urine. But there is a limit. When blood glucose exceeds the so-called "renal threshold" (approximately 9 mmol/L, but varies from 6-14 mmol/L between individuals), the kidney transporters cannot keep up, and glucose begins to leak into the urine.

This is a natural "safety valve" that sets a ceiling on how high blood glucose can rise. But it comes at a cost: the glucose pulls water with it into the urine (osmotic diuresis), which leads to:

- Frequent urination
- Thirst
- Dehydration

These are the classic symptoms of untreated or poorly controlled diabetes. When blood glucose is persistently high, the body literally loses energy and water through the urine.

> **Sources:**
> - Hovorka et al. (2004).
> - Johansen OE, et al. (1984). "Variations in renal threshold for glucose in Type 1 diabetes mellitus." *Diabetologia*, 26(3):180-183.
> - NCBI StatPearls. "Physiology, Glycosuria."

---

## 7. The brain's glucose consumption

**Active in simulator (Hovorka 2004)**

The brain is the body's largest glucose consumer at rest -- it uses approximately 120 grams of glucose per day (approximately 5 grams per hour), even though it makes up only 2% of body weight. The important thing is that the brain's glucose uptake is nearly independent of insulin. The brain has its own transporters (GLUT1 and GLUT3) that extract glucose directly from the blood.

But when blood glucose falls, the brain's glucose supply also falls. The brain's transporters saturate at low concentrations, and during severe hypoglycemia (below approximately 2.5 mmol/L), the brain cannot maintain normal function. This is why hypoglycemia causes symptoms such as:

- Difficulty concentrating and confusion
- Visual disturbances
- Seizures
- Loss of consciousness

And in the extreme: death. The brain's total dependence on glucose is the fundamental reason why low blood glucose is acutely dangerous.

> **Source:** Hovorka et al. (2004). Magistretti PJ, Allaman I. (2015). "A cellular perspective on brain energy metabolism and functional imaging." *Neuron*, 86(4):883-901.

---

# Part 2: Physical Activity

Exercise is one of the most complicated factors to manage for T1D patients, because it affects blood glucose in many ways simultaneously -- and because aerobic and anaerobic exercise have completely opposite acute effects.

---

## 8. Aerobic exercise -- running, cycling, swimming

**Active in simulator (Resalat 2020 extended Hovorka model)**

Aerobic exercise is the type of exercise most people think of: running, cycling, swimming, brisk walking. The overall effect is that blood glucose falls -- but the mechanisms behind it are surprisingly complex.

### Muscles take up glucose without insulin

When muscles work, they activate a signaling pathway (AMPK) that transports glucose into muscle cells entirely without insulin's help. This occurs via GLUT4 transporters that are moved to the cell surface by the muscle contraction itself. This is why exercise can lower blood glucose even when there is almost no insulin in the body -- and it is also why exercise is so effective.

This effect starts quickly (within minutes) and stops relatively quickly after exercise ceases (time constant approximately 20 minutes).

### Insulin sensitivity improves -- for hours

In addition to direct glucose uptake, exercise also improves insulin's effectiveness. The muscles become more sensitive to the insulin already in the blood. This effect builds up slowly and lasts for hours after training has ended (time constant approximately 200 minutes).

It is this long-lasting effect that explains why many T1D patients experience low blood glucose 4-12 hours after exercise -- not only during the training itself.

### Insulin is absorbed faster

Increased blood flow and higher temperature in the subcutaneous tissue during exercise cause insulin to be absorbed faster from the injection site. At a heart rate of 120 beats per minute, the absorption rate increases by approximately 50% compared to rest. This can mean that insulin you gave 2 hours ago suddenly "kicks in" much more strongly during exercise.

### Delayed hypoglycemia -- the hidden danger

The enhanced insulin sensitivity after exercise lasts 2-12 hours. This means that an afternoon or evening training session can cause hypoglycemia in the middle of the night -- when you are sleeping and cannot feel it. This is one of the most important things for T1D patients to understand and plan for.

> **Sources:**
> - Resalat N, et al. (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms." *IFAC-PapersOnLine*, 53(2):16025-16030.
> - Kudva YC, et al. (2021). "Exercise effect on insulin-dependent and insulin-independent glucose utilization." *Am J Physiol Endocrinol Metab*, 321(2):E230-E237.
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes: a consensus statement." *Lancet Diabetes Endocrinol*, 5(5):377-390.

---

## 9. Anaerobic training -- resistance training and sprinting

**Partially modeled (via acute stress)**

Resistance training, sprinting, and HIIT (high-intensity interval training) have a completely different acute effect on blood glucose than aerobic exercise. Many T1D patients are surprised that blood glucose rises during resistance training.

### Blood glucose rises acutely

Intense anaerobic activity triggers a powerful stress response in the body. Adrenaline and noradrenaline are released massively, causing the liver to dump large amounts of glucose into the blood (via glycogenolysis). At the same time, catecholamines inhibit muscle glucose uptake. The net result is that hepatic glucose production exceeds muscle consumption, and blood glucose rises -- typically by 2-5 mmol/L.

### Blood glucose falls hours later

2-6 hours after resistance training, the picture reverses: muscles need to replenish their glycogen stores (they "refuel"), insulin sensitivity increases, and the catecholamine effect has subsided. Blood glucose falls, and the risk of hypoglycemia increases.

### What it means in practice

The confusing pattern -- rise during training, fall hours after -- leads many to react incorrectly. If you give correction insulin during resistance training because blood glucose is high, you risk hypoglycemia a few hours later when the delayed effect kicks in. The general recommendation is to wait with correction until after training and monitor blood glucose for the following hours.

> **Sources:**
> - Riddell MC, et al. (2017). "Exercise management in type 1 diabetes." *Lancet Diabetes Endocrinol*, 5(5):377-390.
> - Yardley JE, et al. (2013). "Resistance versus aerobic exercise: acute effects on glycemia in type 1 diabetes." *Diabetes Care*, 36(3):537-542.

### Lactate and the Cori cycle -- an additional BG rise

During anaerobic training, muscles produce large amounts of **lactate (lactic acid)** as a byproduct of glycolysis without oxygen. The lactate is transported via the blood to the liver, where it is converted to glucose via the **Cori cycle** (gluconeogenesis from lactate). This newly produced glucose is released into the blood and contributes to the acute BG rise during resistance training.

HIIT data (Bally et al. 2015, Rempel et al. 2018) show:
- BG rose in **97% of HIIT sessions** in T1D patients (average +3.7 mmol/L)
- The rise in plasma lactate correlates with the BG rise
- High reproducibility within individuals (your body responds the same way each time)

**Status in simulator:** Lactate/Cori cycle is not explicitly modeled as a separate process. The effect is captured indirectly via the acute stress response (catecholamines -> increased hepatic glucose production). A future extension could model lactate as a separate state variable with hepatic turnover.

> **Additional sources:**
> - Bally L, et al. (2015). "Effects of HIIT vs moderate continuous exercise on glucose homeostasis and hormone response in T1DM." *PLOS ONE*, 10(8):e0136489.
> - Rempel M, et al. (2018). "Reproducibility in the cardiometabolic responses to HIIT in adults with T1D." *Diabetes Metab Res Rev*, 35(4):e3134.

---

## 10. Exercise-induced inflammation -- when exercise hurts

**Not implemented**

Most people associate exercise with better insulin sensitivity -- and that is the general rule. But there is an important exception: excessive or unaccustomed exercise can temporarily increase insulin requirements instead of reducing them.

### The mechanism

Intense or prolonged training sessions (marathon, unaccustomed resistance training, overtraining) cause microscopic muscle damage. The body sends repair crews in the form of inflammatory cells and signaling molecules:

1. Proinflammatory cytokines (IL-6, TNF-alpha, IL-1-beta) are released -- IL-6 can rise up to 100 times above normal levels during exercise
2. The liver initiates an acute phase response
3. The cytokines inhibit insulin's signaling pathways in muscles
4. The effect can last 24-72 hours

### The paradox

- **Moderate, regular exercise:** Anti-inflammatory in the long term -- improves insulin sensitivity
- **Excessive or unaccustomed exercise:** Proinflammatory in the short term -- increases insulin requirements for days afterward

The transition depends on your fitness level. A 10 km run can cause significant inflammation in an untrained person but almost no effect in a trained runner.

### What it means for T1D

- After an unusually hard training session, insulin requirements can increase by 10-30% for 1-2 days
- Muscle soreness (DOMS -- delayed onset muscle soreness) is often accompanied by increased insulin resistance
- It is important to distinguish this from the normal post-exercise insulin sensitivity that occurs after moderate exercise

> **Sources:**
> - Pedersen BK, Febbraio MA. (2008). "Muscle as an endocrine organ: focus on muscle-derived interleukin-6." *Physiol Rev*, 88(4):1379-1406.
> - Petersen AMW, Pedersen BK. (2005). "The anti-inflammatory effect of exercise." *J Appl Physiol*, 98(4):1154-1162.

---

## 10b. Relaxation, yoga, and meditation -- stress reduction and blood glucose

**Implemented (via stress reduction and vasodilation)**

Most people think of physical activity as the primary means of affecting blood glucose. But relaxation techniques such as yoga, meditation, and stretching can also have a measurable effect -- primarily via stress reduction.

### The mechanisms

1. **Parasympathetic activation:** Yoga and meditation activate the parasympathetic nervous system ("rest and digest") and dampen the sympathetic ("fight or flight"). This reduces HPA axis (hypothalamus-pituitary-adrenal) activity.

2. **Cortisol reduction:** Lower HPA axis activity -> lower cortisol -> lower hepatic glucose production (EGP). For T1D patients with elevated stress, this means a measurable BG reduction.

3. **Peripheral vasodilation:** Relaxation and slow stretching increase blood flow to peripheral tissues. Increased blood flow to muscles and adipose tissue modestly improves insulin's effect (insulin-mediated vasodilation is functionally linked to glucose uptake).

### Evidence

- A meta-analysis (PMC10534311, 2023) shows that mindfulness improves glycemic control as measured by HbA1c, primarily via stress reduction and better self-management.
- An RCT from 2025 (Diabetology & Metabolic Syndrome) with T1D teenagers showed that 3 months of yoga resulted in lower HbA1c and reduced insulin requirements.
- The evidence is stronger for T2D than T1D, but the mechanisms (stress reduction, vasodilation) are relevant for both.

### What it means for T1D

- Relaxation does not replace insulin or exercise, but can help reduce stress-induced hyperglycemia.
- Particularly relevant during periods of elevated stress (illness, exams, sleep deprivation) when BG is otherwise difficult to control.
- In the simulator, relaxation is modeled as stress reduction (acute + chronic) with a mild vasodilation bonus.

> **Sources:**
> - Pascoe MC, et al. (2023). "The Effects of Mindfulness on Glycemic Control in People with Diabetes: An Overview of Systematic Reviews and Meta-Analyses." *Nutrients*, 15(19):4085.
> - Shree Ganesh HR, et al. (2022). "Impact of an Integrated Yoga Therapy Protocol on Insulin Resistance and Glycemic Control in Patients with T2DM." *Int J Yoga*, 15(1):54-60.
> - Mahmoud AA, et al. (2025). "The impact of three months of adjuvant yoga intervention on glycemic control among adolescents with type 1 diabetes." *Diabetol Metab Syndr*, 17:42.
> - Baron AD, et al. (1999). "Insulin-Mediated Vasodilation and Glucose Uptake Are Functionally Linked in Humans." *Hypertension*, 33(1):554-558.

---

# Part 3: Hormones and Circadian Rhythm

Blood glucose is affected not only by food, insulin, and exercise. The body's own hormones play a major role -- and many of them follow circadian rhythms that can explain seemingly "unexplainable" blood glucose patterns.

---

## 11. Counterregulatory hormones -- the body's defense against low blood glucose

**Active in simulator (two-layer stress system)**

The body has a hierarchical defense system that is activated when blood glucose falls. It is designed to prevent the brain from running out of fuel. The system consists of four hormones that are activated in a specific order:

### Glucagon -- the first line of defense

Glucagon is released from the pancreatic alpha cells when blood glucose falls below approximately 3.8 mmol/L. It acts quickly (within 2-5 minutes) and causes the liver to release glucose from its glycogen stores. Glucagon can increase hepatic glucose production 3-5 times above the basal level.

**Important for T1D:** In most T1D patients, the glucagon response is impaired or completely absent after 5 or more years of disease. The alpha cells survive -- they are not destroyed by the autoimmune attack -- but they lose the paracrine signal from neighboring beta cells (local insulin, GABA, zinc) that normally coordinates glucagon release. This "switch-off hypothesis" (Unger & Orci 2010, Brissova 2005) explains why alpha cells can still produce glucagon in response to other stimuli (e.g., arginine) but do not respond correctly to low blood glucose. This means that the T1D patient's most important acute defense against low blood glucose is missing.

### Adrenaline -- the secondary defense

Adrenaline is activated when blood glucose falls below approximately 3.6 mmol/L. It stimulates hepatic glucose production and reduces muscle glucose uptake. Adrenaline is also the hormone that produces the well-known warning symptoms: sweating, palpitations, tremor, and hunger.

In T1D patients with "hypoglycemia unawareness" (inability to feel low blood glucose), the adrenaline response is also impaired. This creates a dangerous situation where the patient has neither glucagon nor adrenaline as defense.

### Cortisol -- the slow defense

Cortisol is released during prolonged hypoglycemia, stress, and illness. It increases hepatic glucose production and reduces insulin sensitivity. But it acts slowly (1-2 hours) and is therefore not enough to stop an acute blood glucose drop. On the other hand, it has a long duration (8-12 hours of biological effect).

### Growth hormone

Growth hormone stimulates fat oxidation, reduces muscle glucose uptake, and increases hepatic glucose production. It acts even more slowly than cortisol and is most significant during prolonged hypoglycemia and during sleep.

### How it is modeled in the simulator

The simulator simplifies the four hormones into a two-layer system:

- **Acute stress** (adrenaline + glucagon): acts quickly, halves in approximately 60 minutes
- **Chronic stress** (cortisol): acts slowly, halves in approximately 12 hours

Together they drive hepatic glucose production up, which is the primary mechanism for counteracting low blood glucose.

> **Sources:**
> - Cryer PE. (2013). "Glucose counterregulatory responses to hypoglycemia." *Pediatric Endocrinology Reviews*, 11(Suppl 1):26-37.
> - Rizza RA, et al. (1979). "Role of glucagon, catecholamines, and growth hormone in human glucose counterregulation." *J Clin Invest*, 64(1):62-71.

---

## 12. The dawn phenomenon -- morning blood glucose rise

**Active in simulator (sine wave model)**

Many T1D patients experience blood glucose rising in the early morning hours (approximately 04:00-08:00) -- without having eaten anything, and without nocturnal hypoglycemia having occurred. This is called the dawn phenomenon, and it is a completely normal physiological process.

### Why it happens

The body prepares to wake up. In the early morning hours, cortisol (the stress hormone) rises as part of the natural circadian rhythm, and growth hormone is released in pulses during the late phase of sleep. Both hormones:

- Increase hepatic glucose production
- Reduce insulin sensitivity

In healthy people, the pancreas automatically compensates with more insulin. In T1D patients, this compensation is missing, and blood glucose typically rises 1-3 mmol/L between 04:00 and 08:00.

### Why it is important to understand

The dawn phenomenon is not the patient's fault. It is not because you ate the wrong thing the evening before or gave too little insulin. It is a biological process that requires active management -- either via higher basal insulin in the early morning hours (possible with an insulin pump) or via a morning bolus.

In the simulator, the dawn phenomenon is modeled as a sinusoidal cortisol rise that starts at 04:00, peaks at 08:00, and disappears by 12:00. The amplitude corresponds to approximately 30% increased hepatic glucose production at the peak.

> **Sources:**
> - Bolli GB, et al. (1984). "Demonstration of a dawn phenomenon in normal human volunteers." *Diabetes*, 33(12):1150-1153.
> - Porcellati F, et al. (2013). "Thirty years of research on the dawn phenomenon: lessons to optimize blood glucose control in diabetes." *Diabetes Care*, 36(12):3860-3862.

---

## 13. The Somogyi effect -- rebound after nocturnal hypoglycemia

**Active in simulator (via automatic acute stress during hypoglycemia)**

The Somogyi effect describes the phenomenon where nocturnal hypoglycemia can be followed by morning hyperglycemia. The mechanism is:

1. Blood glucose falls below approximately 3.5 mmol/L during the night
2. Counterregulatory hormones are released massively
3. Hepatic glucose production increases dramatically
4. Blood glucose rises rapidly and overshoots to hyperglycemic levels

The result is that the patient wakes up with high blood glucose -- and the natural reaction is to increase the insulin dose, which paradoxically can worsen the problem by causing even deeper nocturnal hypoglycemia.

### Is it really that common?

The clinical relevance of the Somogyi effect is debated. More recent studies with CGM (continuous glucose monitoring) show that most cases of morning hyperglycemia are actually caused by the dawn phenomenon or insufficient basal insulin -- not by rebound from nocturnal hypoglycemia. The effect exists physiologically, but its practical significance may be overestimated. CGM has made it possible to distinguish the two -- if you see a nocturnal dip followed by a rise, it is Somogyi; if you see a gradual rise from 04:00, it is dawn.

> **Sources:**
> - Guillod L, et al. (2007). "Nocturnal hypoglycaemias in type 1 diabetic patients: what can we learn with continuous glucose monitoring?" *Diabetes Metab*, 33(5):360-365.
> - NCBI StatPearls. "Somogyi Phenomenon."

---

## 14. Diurnal variation in insulin sensitivity

**Implemented (hybrid model: HGP + ISF)**

In addition to the dawn phenomenon, the body's insulin sensitivity varies throughout the day:

- **In the morning (approximately 08:00):** Insulin sensitivity is at its lowest -- up to 30-50% lower than average. You need more insulin per gram of carbohydrate for breakfast than for dinner.
- **In the evening (approximately 19:00):** Insulin sensitivity is at its highest. The same insulin dose has a greater effect.

This variation is caused by the circadian system (the body's internal clock) that controls cortisol rhythm, growth hormone, the autonomic nervous system, and hepatic insulin clearance.

### Evidence and its limitations

The evidence for diurnal variation in ISF is surprisingly unclear, especially for T1D:

**Healthy individuals (Saad 2012, n=20):** SI was *highest* in the morning and lower the rest of the day. Identical meals at 07/13/19 showed the best glucose tolerance at breakfast. But these are healthy individuals -- they have a functioning beta cell response that compensates.

**T1D patients (Hinshaw 2013, n=19):** The SI pattern was *reversed* compared to healthy individuals -- lowest in the morning (5.1), highest at lunch (7.6). **However**: the difference was *not* statistically significant (P=0.34), and the authors' main conclusion was that *"any diurnal pattern of SI in type 1 diabetes is individual specific"* -- it **cannot** be generalized to the population. Furthermore, they found hepatic insulin resistance in the morning: EGP was less suppressed despite higher insulin levels.

**T1D children/adolescents (Sohag 2022, n=93):** Real-life correction doses showed morning ISF ~50 mg/dL, evening ~75 mg/dL -- approximately 50% difference. Suggests differentiated formulas: morning=1736/TDD, evening=2035/TDD. But the study is pediatric, single center, Egypt.

**Modeling (Toffanin 2013):** Constructed a circadian ISF curve based on published studies (piecewise cubic interpolation, 7 segments). Sensitivity factor: 0.4 (nadir at 08:00) to 1.4 (peak at midnight). Validated *in silico* (UVA/Padova simulator, 100 virtual patients) -- not on real patients. Resulted in 6-40% fewer hypoglycemic episodes in the simulation.

**Clinical practice (Scheiner 2020):** Describes basal rate patterns with morning peak in insulin requirements -- a universal clinical observation from thousands of pump users. No precise SI curves, but strong clinical experience.

### What it means in practice

- The insulin-to-carb ratio (ICR) should ideally be lower in the morning (more insulin per gram of carbohydrate) and higher in the evening
- Many insulin pumps are programmed with 2-3 different basal rates throughout the day
- It explains why it can be easier to keep blood glucose stable in the evening than in the morning
- ~40% extra morning insulin is a realistic magnitude based on clinical experience

### Implementation in the simulator

The simulator uses a **hybrid model** that splits the morning effect between two mechanisms:

1. **HGP increase (hepatic production):** `circadianKortisolNiveau` -- sine arc 04:00-12:00, amplitude reduced to 0.15 (from 0.30). The liver produces up to 15% more glucose in the morning.

2. **ISF reduction (peripheral insulin resistance):** `circadianISF` -- diurnal curve with ISF factor 0.70 in the morning (insulin works 30% worse) and 1.20 in the evening (insulin works 20% better). Inspired by Toffanin 2013, dampened to 50% amplitude.

**Combined morning effect (08:00):** HGP x1.15 + ISF x0.70 -> the player needs ~43% more insulin for breakfast. **Combined evening effect (19:00):** HGP x1.0 + ISF x1.20 -> insulin works ~17% better in the evening.

### Honest assessment of model quality

This implementation is built on **insufficient scientific evidence** combined with clinical experience from T1D patients. The most important caveats:

- Hinshaw 2013 explicitly concludes that the ISF pattern is individual and not generalizable for T1D
- The Toffanin 2013 curve is a synthetic construction validated on virtual patients (circular validation)
- The chosen amplitude (50% of Toffanin) and split between HGP/ISF is based on clinical intuition, not precise measurements
- The model should be updated if better quantitative data for diurnal variation in T1D become available

> **Sources:**
> - Saad A, et al. (2012). "Diurnal pattern to insulin secretion and insulin action in healthy individuals." *Diabetes*, 61(11):2691-2700.
> - Hinshaw L, et al. (2013). "Diurnal pattern of insulin action in type 1 diabetes." *Diabetes*, 62(7):2223-2229.
> - Toffanin C, et al. (2013). "Dynamic insulin on board: incorporation of circadian insulin sensitivity variation." *J Diabetes Sci Technol*, 7(4):928-940.
> - El-Rasheedy FI, et al. (2022). "Diurnal variation of real-life insulin sensitivity factor among children and adolescents with type 1 diabetes." *Front Pediatr*, 10:854972.
> - Scheiner G. (2020). *Think Like a Pancreas: A Practical Guide to Managing Diabetes with Insulin*. 3rd ed. Da Capo Lifelong Books.

---

## 15. Menstrual cycle and insulin requirements

**Not implemented (planned)**

For women with T1D, the menstrual cycle is an often overlooked factor in blood glucose regulation. Sex hormones have a significant effect on insulin sensitivity, and many women experience recurring periods of "unexplainably" high blood glucose.

### Follicular phase (days 1-14 of the cycle)

In the first half of the cycle, estrogen dominates. Insulin sensitivity is normal to slightly elevated, and blood glucose control is relatively stable. This is often the "good" period.

### Luteal phase (days 15-28)

In the second half, progesterone rises significantly, and it has a direct negative effect on insulin's signaling pathways in cells. Research shows that insulin sensitivity can decrease by up to 50%. One study measured a drop in insulin sensitivity index from 5.03 to 2.22 -- more than halving.

Clinically, this means that many women with T1D need 15-30% more insulin in the week before menstruation. When menstruation starts and progesterone drops, insulin sensitivity normalizes -- and there is a risk of hypoglycemia if the insulin dose is not reduced again.

### What it means in practice

- To master blood glucose, it is important to know your cycle and anticipate changes in requirements
- A cycle diary combined with blood glucose data can reveal individual patterns
- Some women adjust their basal rate upward by 10-20% during the luteal phase

> **Sources:**
> - Yeung EH, et al. (2024). "Menstrual Cycle Effects on Insulin Sensitivity in Women with Type 1 Diabetes: A Pilot Study." *Diabetes Care*.
> - Trout KK, et al. (2023). "Menstrual Cycle, Glucose Control and Insulin Sensitivity in Type 1 Diabetes: A Systematic Review." *J Pers Med*, 13(2):374.
> - Kelliny C, et al. (2014). "Alteration of insulin sensitivity by sex hormones during the menstrual cycle." *Physiol Rev*, 94(3):793-834.

---

## 16. Seasonal variation

**Not implemented (low priority)**

Insulin requirements also vary with the seasons, although it can be difficult to separate this from behavioral changes.

### Winter

HbA1c is typically higher in winter. A study with T1D adolescents showed 9.1% in winter versus 7.7% in summer. Possible explanations include: reduced physical activity, increased caloric intake, reduced vitamin D synthesis, and shorter days that may affect the body's circadian rhythm.

### Summer

Insulin requirements are typically lower in summer. Increased physical activity and heat accelerate insulin absorption. On the other hand, there are also more episodes of low blood glucose -- the combination of better insulin sensitivity and faster absorption is a risk factor.

Seasonal variation is likely a combination of physiological and lifestyle factors and is difficult to isolate in controlled studies.

> **Source:** Mianowska B, et al. (2011). "HbA1c levels in schoolchildren with type 1 diabetes are seasonally variable and dependent on weather conditions." *Diabetologia*, 54(4):749-756.

---

# Part 4: Lifestyle and External Factors

In addition to physiological processes, there are a number of lifestyle and environmental factors that affect blood glucose -- often in ways that surprise newly diagnosed patients.

---

## 17. Illness and infection

**Partially modeled (via chronic stress)**

When the body fights an infection, insulin requirements increase significantly. This is one of the most common causes of unexpected high blood glucose and -- in the worst case -- ketoacidosis.

### Why illness drives blood glucose up

**Cytokines (inflammatory mediators):** The immune system releases signaling molecules such as TNF-alpha, IL-1, and IL-6 when fighting infection. These substances inhibit insulin's signaling pathways in muscles and increase hepatic glucose production. The effect is a direct, physiological insulin resistance.

**Stress hormones:** Illness activates the stress response. Cortisol, adrenaline, and growth hormone all rise, and they all counteract insulin (see section 11).

**Fever:** Fever itself increases metabolism by approximately 10-13% per degree above 37 degrees Celsius. But the dominant effect is the insulin resistance from cytokines and stress hormones, not the fever itself.

### Sick day rules for T1D

- Insulin requirements can increase 50-100% during acute illness
- Monitor blood glucose more frequently (at least every 2-3 hours)
- Measure ketones (see section 23)
- Increase basal insulin by 10-20% (or more as needed)
- Keep fluid intake up -- dehydration worsens the situation
- The risk of DKA increases significantly during illness due to the combination of increased insulin requirements and decreased appetite

> **Sources:**
> - Dungan KM, et al. (2009). "Stress hyperglycaemia." *Lancet*, 373(9677):1798-1807.
> - Holt RIG, et al. (2024). "Diabetes and infection: review of the epidemiology, mechanisms and principles of treatment." *Diabetologia*.

---

## 18. Sleep and sleep deprivation

**Active in simulator (nocturnal interventions cause chronic stress and insulin resistance)**

Poor sleep affects blood glucose more than most people think. The research is clear: sleep deprivation causes insulin resistance.

### What the research shows

- Restriction to 4-5.5 hours of sleep reduces insulin sensitivity by 16-24%
- Even a single night of poor sleep produces measurably increased insulin resistance
- The metabolic effect of sleep deprivation resembles type 2 diabetes: muscles take up less glucose, the liver produces more, and the entire system functions worse

### The mechanisms

Sleep deprivation disrupts the body at multiple levels:
- Cortisol rises, especially in the evening (disrupted circadian rhythm)
- The sympathetic nervous system (fight-or-flight) is overactive
- The body's internal clock falls out of sync
- Inflammatory markers rise

### What it means for T1D

- Sleep deprivation can explain unexplained morning hyperglycemia
- Shift work is associated with poorer blood glucose control
- For optimal control, more than 7 hours of sleep is recommended
- The combination of sleep deprivation and the dawn phenomenon can produce particularly high morning BG

### How it works in the simulator

In the game, nocturnal interruptions (between 22:00 and 07:00) are modeled as sleep disturbances. Each time you wake up to manage your blood glucose, it costs sleep quality. In the morning, the sleep loss is converted to chronic stress, which increases insulin resistance for the following hours. At maximum sleep loss (4 hours), this produces approximately 24% increased insulin resistance -- which matches clinical studies.

> **Sources:**
> - Spiegel K, et al. (2005). "Sleep loss: a novel risk factor for insulin resistance and Type 2 diabetes." *J Appl Physiol*, 99(5):2008-2019.
> - Donga E, et al. (2010). "Partial Sleep Restriction Decreases Insulin Sensitivity in Type 1 Diabetes." *Diabetes Care*, 33(7):1573-1577.
> - Zheng H, et al. (2017). "Poor Sleep Quality Is Associated with Dawn Phenomenon and Impaired Circadian Clock Gene Expression." *Int J Endocrinol*.

---

## 19. Alcohol

**Not implemented (planned)**

Alcohol is one of the most complex and potentially dangerous factors for T1D patients. The acute effect is the opposite of what many believe -- alcohol lowers blood glucose.

### The acute effect: the liver is occupied

When you drink alcohol, the liver prioritizes breaking down the alcohol (which is a toxin) above everything else. This blocks the liver's ability to produce new glucose (gluconeogenesis) and can deplete the liver's glycogen stores. The result is that the glucose production that normally keeps blood glucose up between meals slows or stops completely.

### The delayed danger: 6-12 hours after

The most clinically dangerous effect is delayed hypoglycemia. Moderate alcohol consumption in the evening can trigger hypoglycemia the next morning (07:00-11:00), because:
- The liver's glycogen stores are partially depleted
- Gluconeogenesis is still inhibited
- Counterregulation (the body's defense against low blood glucose) is also impaired by alcohol

### With or without food makes a huge difference

- **With food:** Moderate alcohol has limited effect on blood glucose
- **Without food:** Alcohol can induce deep, dangerous hypoglycemia

### Why it is so dangerous

Alcohol is one of the most common causes of severe hypoglycemia in young adults with T1D. The problem is compounded by the fact that hypoglycemia symptoms (confusion, unsteady gait, slurred speech) can be mistaken for intoxication -- both by the patient and by those around them. This delays treatment and can in the worst case be life-threatening.

> **Sources:**
> - Emanuele NV, et al. (2019). "Consequences of Alcohol Use in Diabetics." *Alcohol Health Res World*, 22(3):211-219.
> - Turner BC, et al. (2001). "The effect of evening alcohol consumption on next-morning glucose control in type 1 diabetes." *Diabetes Care*, 24(11):1888-1893.
> - Kerr D, et al. (2007). "Impact of Alcohol on Glycemic Control and Insulin Action." *Biomolecules*, 5(4):2223-2245.

---

## 20. Psychological stress

**Partially modeled (via chronic stress)**

Psychological stress -- exams, work pressure, conflicts, anxiety -- affects blood glucose via the same hormone systems as physical stress.

### The mechanisms

**Acute stress (adrenaline):** A stressful situation triggers adrenaline, which causes the liver to release glucose. Blood glucose can rise quickly.

**Chronic stress (cortisol):** Prolonged stress keeps cortisol levels elevated, which increases hepatic glucose production and reduces insulin sensitivity. The effect is sustained and can produce chronically elevated blood glucose.

**Behavioral effect:** Stress also changes eating patterns, sleep quality, and exercise habits -- all with indirect effects on blood glucose.

### Individual variation

The stress response's effect on blood glucose varies significantly between individuals. Some T1D patients primarily experience hyperglycemia during stress, others notice minimal effect, and a few actually experience hypoglycemia (due to changed eating patterns with decreased appetite).

> **Source:** Surwit RS, et al. (2002). "Stress management improves long-term glycemic control in type 2 diabetes." *Diabetes Care*, 25(1):30-34.

---

## 21. Temperature and climate

**Not implemented (low priority)**

Ambient temperature affects insulin absorption and thus blood glucose control -- something that is particularly relevant during holidays and outdoor activities.

### Heat increases insulin action

- Sauna (85 degrees Celsius) increases insulin absorption from the injection site by 110%, and blood glucose drops by 3 mmol/L or more
- Local warming (40 degrees Celsius) reduces time to peak insulin action from 111 to 77 minutes
- The mechanism is vasodilation -- increased blood flow in the subcutaneous tissue moves insulin into the bloodstream faster

### Cold slows insulin action

- Cooling of the injection site reduces insulin concentration by over 40% and increases blood glucose by approximately 3 mmol/L
- Vasoconstriction (blood vessels constrict) slows insulin transport

### Insulin does not tolerate heat or cold well

Insulin is a protein and is sensitive to temperature extremes:
- Below 2 degrees Celsius: crystal structure is irreversibly destroyed
- Above 30 degrees Celsius: accelerated degradation
- Direct sunlight: rapid denaturation

### What it means in practice

- Summer holidays and beach visits: faster insulin action, risk of hypoglycemia
- Winter sports: slower insulin action, risk of hyperglycemia
- Storage of insulin in heat/cold can render it ineffective -- and this can lead to ketoacidosis

> **Sources:**
> - Berger M, et al. (1981). "A rise in ambient temperature augments insulin absorption in diabetic patients." *Metabolism*, 30(5):393-396.
> - Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.
> - Vimalavathini R, et al. (2021). "Thermal stability and storage of human insulin." *Indian J Med Res*, 154(6):849-857.

---

## 22. Injection site

**Partially modeled (in the simulator's compartment model)**

Where on the body you place your insulin injection affects how quickly the insulin works. This is something many newly diagnosed patients don't know, and it can explain unpredictable insulin action.

### Absorption rate by site

| Site | Relative speed | Explanation |
|------|----------------|-------------|
| Abdomen | 1.0 (fastest -- reference) | Thinnest fat layer, most blood flow |
| Upper arm | approx. 0.85 | Medium fat layer |
| Buttock | approx. 0.75 | Deep subcutaneous depot |
| Thigh | approx. 0.70 (slowest) | Thickest fat layer, least blood flow |

### Other factors

- **Lipohypertrophy:** Repeated injections in exactly the same spot can form fat lumps under the skin. Insulin injected into such a lump is absorbed unpredictably -- sometimes too fast, other times not at all. This is one of the most common causes of "mysterious" blood glucose variation.
- **Exercise in nearby muscle groups:** Running increases absorption from the thigh, arm exercises from the upper arm.
- **Massage of the injection site:** Significantly accelerates absorption.

> **Source:** Heinemann L, et al. (2020). "Factors Influencing Insulin Absorption Around Exercise in Type 1 Diabetes." *Front Endocrinol*, 11:573275.

---

# Part 5: Complications and Warning Signs

This part covers the acutely dangerous situations in T1D and the physiological mechanisms behind them.

---

## 23. Ketone bodies and diabetic ketoacidosis

**Active in simulator (simplified model)**

Ketone bodies are a topic that often creates confusion. They are not inherently dangerous -- in fact, they are a normal part of the body's energy system. But during insulin deficiency, ketone production can spiral out of control and become life-threatening.

### Normal ketogenesis -- the body's reserve fuel

When the body does not have enough glucose available (during fasting, with low carbohydrate intake), it switches to burning fat. Fatty acids are broken down in the liver, and a byproduct is ketone bodies (primarily beta-hydroxybutyrate). The brain and muscles can use ketone bodies as fuel -- this is a survival mechanism that has served humanity well during periods of food scarcity.

During normal fasting ketosis, ketones rise moderately (0.5-3 mmol/L) and are harmless.

### Pathological ketoacidosis (DKA) -- when it spirals out of control

During absolute insulin deficiency -- e.g., forgotten insulin, pump failure, or new-onset T1D -- the following cascade occurs:

1. **Uncontrolled fat breakdown:** Without insulin, there is no signal to stop. Massive amounts of fatty acids are released.
2. **Overproduction of ketone bodies:** The liver produces far more ketone bodies than the body can consume.
3. **Metabolic acidosis:** Ketone bodies are acids. When they accumulate, blood pH drops -- the body literally becomes acidic.
4. **Dehydration:** High blood glucose drives glucose and water into the urine (osmotic diuresis).
5. **Electrolyte disturbances:** Sodium and potassium are lost in the urine, which can cause cardiac arrhythmias.
6. **Without treatment:** Coma and death.

### When should you act?

| Ketone level (BHB) | Category | Action |
|--------------------|----------|--------|
| Below 0.6 mmol/L | Normal | No action needed |
| 0.6-1.5 mmol/L | Mildly elevated | Drink water, give insulin, measure again in 1-2 hours |
| 1.5-3.0 mmol/L | Risk of DKA | Contact physician, give insulin, drink plenty |
| Above 3.0 mmol/L | DKA likely | Acute hospital admission |

### Important distinction: fasting ketosis is NOT the same as DKA

Ketones that rise because you are fasting or eating very few carbohydrates are physiologically normal and harmless (as long as you have insulin in your body). DKA is driven by **absolute insulin deficiency** and is an acute, life-threatening condition.

| Parameter | Fasting ketosis | DKA |
|-----------|----------------|-----|
| Insulin present | Yes (reduced, but present) | No / minimal |
| BG level | Normal / low | Very high (>14-20) |
| Ketones (BHB) | 0.5-3 mmol/L (possibly 5-7 during prolonged fasting) | 3-25+ mmol/L |
| Blood pH | Normal (>7.35) | Low (<7.3, acidosis) |
| Dangerous? | No | Yes, life-threatening |
| Mechanism | Controlled fat burning | Uncontrolled lipolysis |

### The central driver: insulin, not blood glucose

The primary driver of ketogenesis is **insulin level**, not blood glucose. Lipolysis
(fat breakdown) is extremely insulin-sensitive -- it is the *first* process to activate
when insulin falls. The EC50 for insulin's suppression of lipolysis is only ~100 pmol/L
(7-24 mU/L), far lower than for glucose uptake (~300-400 pmol/L).

The cascade is:
1. **Low insulin** -> lipolysis increases (fat cells release fatty acids)
2. **Free fatty acids (FFA)** stream to the liver
3. **Beta-oxidation** in the liver produces acetyl-CoA
4. **Ketogenesis**: excess acetyl-CoA is converted to ketone bodies (BHB, acetoacetate)

During fasting/low-carb, you take *less* insulin because you eat fewer carbohydrates.
The lower insulin allows controlled fat burning -- that is precisely the intention.
During DKA, there is *no* insulin, and lipolysis runs completely out of control.

Protein also plays a role: glucogenic amino acids are converted to glucose via
gluconeogenesis, which consumes oxaloacetate from the citric acid cycle. This pushes
even more acetyl-CoA toward ketogenesis. In other words, gluconeogenesis and ketogenesis are
**parallel processes that reinforce each other** during insulin deficiency.

### DKA treatment: sugar + insulin

An important clinical point: during DKA treatment, insulin is given to stop
ketogenesis, but insulin also lowers blood glucose. Therefore, **intravenous glucose
is given** simultaneously (when BG falls below ~14 mmol/L) to prevent
hypoglycemia during treatment. Sugar and insulin must be given *together* --
this is relevant for the simulator, where the player must understand that you cannot
simply "insulin" your way out of DKA without also eating.

### Typical ketone levels in different states

| State | BHB (mmol/L) | Insulin status |
|-------|-------------|----------------|
| Normal, fed | < 0.1 | Normal |
| Overnight fast (12 h) | 0.1-0.4 | Slightly reduced |
| 24-hour fast | 1-2 | Reduced |
| Ketogenic diet (sustained) | 0.5-3 | Reduced but present |
| 72-hour fast | 5-7 | Markedly reduced |
| Mild DKA | 1.5-3 | Very low / absent |
| Severe DKA | 3-25+ | Absent |

### Ketone clearance

Ketones are eliminated via two mechanisms:
- **Muscle and brain consumption**: ketones are used as fuel (replacing glucose)
- **Renal excretion**: at high levels, ketones are excreted in the urine

Half-life of BHB: 0.8-3.1 hours, but clearance is **saturable** -- at
high concentrations (DKA), elimination is slower due to Michaelis-Menten
kinetics (Clarke et al. 2012: CL = 10.9 L/h + Vmax component).

### Low-carb and BG control

A low-carb diet results in significantly easier BG control in T1D because:
- Fewer and smaller carbohydrate boluses -> less variability
- Less "curve error" from misestimated carbohydrates
- Smoother BG profile with fewer spikes
- Ketones as alternative fuel reduce the brain's glucose dependence

The downside: requires attention to protein insulin (protein is partially converted to
glucose, ~25-50% depending on amount) and may require adjustment of basal doses.

### Published mathematical ketone models

There are relatively few models in the literature:

1. **Pinnaro, Christensen & Curtis (2021):** "Modeling Ketogenesis for Use in
   Pediatric Diabetes Simulation." *JDST*, 15(2):303-308. -- **Most relevant for
   our simulator.** IOB-driven model: ketones rise when IOB < threshold, fall
   when IOB > threshold. Calibrated to DKA within 1-2 days of complete insulin deficiency.
   Ketones modulate insulin sensitivity (ketoacidosis requires more insulin).

2. **Balasse & Fery (1984):** "Ketone body kinetics in humans: a mathematical model."
   *J Lipid Res*, Feb 1984. -- 5-compartment model with rate constants for BHB/acetoacetate
   interconversion and clearance.

3. **Roy & Parker (2006):** "Dynamic Modeling of Free Fatty Acid, Glucose, and Insulin."
   *Diabetes Technol Ther*, 8:617-626. -- FFA dynamics model for T1D, upstream precursor
   to ketones.

4. **Cobelli/Dalla Man (2023):** FFA kinetics model with Hill function for insulin's
   suppression of lipolysis. *Am J Physiol*.

Remarkably: neither the UVA/Padova simulator nor the Hovorka group have
published integrated ketone models in their T1D simulators.

### Fasting and insulin sensitivity

Surprisingly, research shows that short-term fasting (<=24 hours) actually
**decreases** insulin sensitivity by up to 54%. Only fasting >6 days shows
improved insulin sensitivity in controlled trials. Intermittent fasting over
12+ weeks yields moderate improvement.

This is counterintuitive and important: a single fasting day makes it *harder* to
control BG, not easier -- while sustained low-carb/ketogenic diet over weeks
gradually improves insulin sensitivity via keto-adaptation.

> **Sources:**
> - Kitabchi AE, et al. (2009). "Hyperglycemic Crises in Adult Patients With Diabetes." *Diabetes Care*, 32(7):1335-1343.
> - Dhatariya KK, et al. (2023). "Comprehensive review of diabetic ketoacidosis: an update." *Ann Med Surg*, 85(6):2802-2807.
> - Laffel L. (1999). "Ketone bodies: a review of physiology, pathophysiology and application of monitoring to diabetes." *Diabetes Metab Res Rev*, 15(6):412-426.
> - Pinnaro L, Christensen CL, Curtis MD. (2021). "Modeling Ketogenesis for Use in Pediatric Diabetes Simulation." *JDST*, 15(2):303-308. [PubMed](https://pubmed.ncbi.nlm.nih.gov/31608650/)
> - Balasse EO, Fery F. (1984). "Ketone body kinetics in humans: a mathematical model." *J Lipid Res*, Feb 1984. [PubMed](https://pubmed.ncbi.nlm.nih.gov/6707525/)
> - Roy A, Parker RS. (2006). "Dynamic Modeling of Free Fatty Acid, Glucose, and Insulin." *Diabetes Technol Ther*, 8:617-626. [PubMed](https://pubmed.ncbi.nlm.nih.gov/17109593/)
> - Clarke K, et al. (2012). "Kinetics, safety and tolerability of (R)-3-hydroxybutyl (R)-3-hydroxybutyrate." *Regul Toxicol Pharmacol*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/22561291/)
> - Suppression of lipolysis by insulin. *JCEM* 2000, 85(10):3740-3745.

---

## 24. Insulin overdose and the limitations of counterregulation

**Active in simulator (hypo game over + impaired counterregulation in T1D)**

Insulin overdose is one of the most important acute dangers in type 1 diabetes. To understand why it is dangerous, it is necessary to understand what happens when blood glucose falls -- and why the body's defense mechanisms are not always sufficient.

### The body's defense in healthy individuals

In healthy individuals, a hierarchy of defense mechanisms is activated when blood glucose falls:

| Blood glucose level | What happens |
|---------------------|--------------|
| Approx. 4.6 mmol/L | The pancreas reduces insulin production |
| Approx. 3.8 mmol/L | Glucagon and adrenaline are released -- acute defense |
| Approx. 3.7 mmol/L | Cortisol and growth hormone rise -- slower defense |
| Approx. 3.2 mmol/L | Symptoms: sweating, palpitations, hunger |
| Approx. 2.8 mmol/L | Neuroglycopenia: confusion, seizures |

### Why T1D patients are so vulnerable

In type 1 diabetes, this defense system is fundamentally impaired:

1. **Glucagon is gone:** In most T1D patients, the glucagon response is impaired or absent after 5 or more years of disease. The most important acute line of defense is missing.

2. **Adrenaline can be impaired:** Repeated episodes of low blood glucose "reset" the brain's glucose sensors downward. This is called hypoglycemia unawareness (HAAF) and means that the body only responds at even lower blood glucose levels -- or not at all.

3. **Cortisol and growth hormone act too slowly:** They take hours to reach full effect and cannot rescue an acute situation.

The result is that a T1D patient typically only has adrenaline as an acute defense -- and even that can be impaired.

### Hypoglycemia unawareness (HAAF) -- the vicious cycle

HAAF is a syndrome where repeated hypoglycemia progressively weakens the body's response:

- The brain's glucose sensors "get used to" low blood glucose
- The thresholds for hormone response shift downward
- Warning symptoms disappear
- The patient only notices hypoglycemia when it is already dangerous (confusion, seizures)
- Approximately 25% of T1D patients have significant HAAF
- Patients with HAAF have a 25-fold increased risk of severe hypoglycemia

**The good news: HAAF is reversible.** Research consistently shows that 2-3 weeks of strict avoidance of hypoglycemia can restore the adrenaline response and warning symptoms. Dagogo-Jack et al. (1993) demonstrated that the threshold for hormone response rose from approximately 2.8 mmol/L back toward 3.8 mmol/L. The important thing, however, is that any new hypoglycemia during the recovery period can reactivate HAAF.

The glucagon response (which is lost due to beta cell destruction) is not restored, however -- it is permanently lost.

### What does the research say about dosing?

There is no simple "lethal dose" for insulin -- outcomes depend on many factors: starting blood glucose, active insulin already present, whether there is food in the stomach, the state of counterregulation, and how quickly treatment is given. Studies of intentional overdoses show that deaths are primarily caused by delayed treatment rather than absolute dose.

### How it is modeled in the simulator

The simulator models the impaired counterregulation in T1D in three ways:

1. **Reduced stress ceiling:** Acute stress (counterregulation) is limited to 1.0 instead of approximately 5.0 that a healthy person would have. This reflects the loss of the glucagon response.

2. **HAAF model:** A continuous model where the severity of previous hypoglycemia episodes accumulates and reduces counterregulation. Deep hypoglycemia (BG 1.5 mmol/L) causes three times more "damage" per minute than mild hypoglycemia (BG 2.5 mmol/L). Recovery occurs gradually with a half-life of 3 game days.

3. **No insulin protection during low blood glucose:** Insulin's effect is not reduced during hypoglycemia in the model -- because that mechanism is primarily glucagon-mediated and thus lost in T1D.

> **Sources:**
> - Cryer PE (2013). "Mechanisms of Hypoglycemia-Associated Autonomic Failure in Diabetes." *N Engl J Med*, 369:362-372.
> - Dagogo-Jack SE, et al. (1993). "Reversal of hypoglycemia unawareness, but not defective glucose counterregulation, in IDDM." *Diabetes*, 42(12):1683-1689.
> - Cranston I, et al. (1994). "Restoration of hypoglycaemia awareness in patients with long-duration insulin-dependent diabetes." *Lancet*, 344(8918):283-287.
> - Bengtsen MB, Moller N (2021). "Mini-review: Glucagon responses in type 1 diabetes -- a matter of complexity." *Physiol Rep*, 9(16):e14969.
> - Rzepczyk S, et al. (2022). "The Other Face of Insulin--Overdose and Its Effects." *Toxics*, 10(3):123.
> - Megarbane B, et al. (2007). "Intentional insulin overdose: prognostic factors and toxicokinetic/toxicodynamic profiles." *Crit Care*, 11(5):R115.

---

## 25. Non-linearity in insulin action -- threshold effects

**Not implemented (important clinical phenomenon)**

This is one of the most frustrating aspects of daily T1D management: insulin's action is not linear. That is, twice as much insulin does not necessarily produce twice the effect -- and small doses may seemingly not work at all.

### Different organs have different thresholds

Insulin acts on multiple organs, but they respond at different insulin concentrations. Rizza et al. (1981) performed 8-hour sequential insulin clamps in 15 healthy subjects and found markedly different EC50 values (the concentration at which half the maximum effect is achieved):

| Effect | EC50 (half-maximal) | Full effect at | Receptor occupancy |
|--------|---------------------|----------------|-------------------|
| Suppression of lipolysis (adipose tissue) | ~44-68 pmol/L (~8-11 microU/mL) | ~150 pmol/L | Very low |
| Suppression of hepatic glucose production (EGP) | ~174 pmol/L (~29 microU/mL) | ~360 pmol/L (~60 microU/mL) | 11% |
| Stimulation of peripheral glucose uptake (muscle) | ~330 pmol/L (~55 microU/mL) | ~1200-4200 pmol/L (~200-700 microU/mL) | 49% |

The crucial point: **the liver responds at half as much insulin as muscles.** Adipose tissue responds even earlier. This creates a hierarchy of insulin effects sorted by sensitivity:

1. Fat breakdown is inhibited (lowest threshold)
2. Hepatic glucose production is inhibited
3. Muscle glucose uptake is activated (highest threshold)

### The S-shaped dose-response curve

Insulin's action follows an S-shaped (sigmoid) curve, typically modeled with a Hill function:

```
Effect(I) = Emax × I^n / (EC50^n + I^n)
```

where Emax is the maximum effect, EC50 is the half-maximal concentration, and n is the Hill coefficient (the steepness of the curve). This means:

- **Below threshold:** Almost no measurable effect
- **Around threshold:** Rapidly increasing effect (the "steep" part of the S-curve)
- **Above saturation:** Additional insulin gives diminishing additional effect (the curve flattens)

Prager et al. (1986) found that despite the different EC50 values, the *time constants* for hepatic and peripheral insulin action are remarkably similar (~43-45 min half-life). Both effects likely share a common rate-limiting step: insulin transport from plasma to interstitial fluid.

### What it means in daily life: the "dead zone"

This explains a very common T1D experience:

1. Your blood glucose is 12 mmol/L. You give 1 unit of correction insulin. Nothing happens.
2. You wait 2 hours and give 1 more unit. Still nothing.
3. In frustration, you give 2 units. Blood glucose plummets to 4 mmol/L.
4. In total, 4 units have produced an effect far greater than 4 times your ISF.

The explanation: the first 2 units were below the muscle threshold and primarily affected the liver (which was already partially suppressed). The last 2 units brought the concentration above the muscle threshold, and total glucose uptake increased dramatically. In the "zone" between the two thresholds, a "dead zone" is experienced where insulin seemingly does not work -- the liver is already suppressed, but the muscles are not yet activated.

### Insulin resistance widens the gap

During insulin resistance (illness, inactivity, stress), the dose-response curves shift to the right -- more insulin is required for the same effect. But the shift is **not equal** across all tissues:

- **Peripheral (muscle) insulin resistance** is typically the primary defect and accounts for approximately **2/3** of total glucose dysregulation (DeFronzo & Tripathy 2009)
- **Hepatic insulin resistance** accounts for approximately **1/3**

This means that during insulin resistance, the distance between liver and muscle thresholds grows. The "dead zone" becomes wider. In practice:

- **Normal state:** EC50-liver ~174, EC50-muscle ~330 pmol/L -> gap ~156 pmol/L
- **Insulin resistant (illness):** EC50-liver ~250, EC50-muscle ~600 pmol/L -> gap ~350 pmol/L (more than double)

This is why "couch days" and sick days can produce such frustrating blood glucose control: the dose that normally works fine now lands in the widened gap where the liver is suppressed but the muscles are inactive.

### Selective hepatic insulin resistance

A remarkable paradox within the liver cell itself (Brown & Goldstein 2008): during insulin resistance, insulin loses the ability to suppress gluconeogenesis (the desired effect), but **retains** the ability to stimulate fat synthesis (lipogenesis). This "selective hepatic insulin resistance" creates the combination of hyperglycemia + hypertriglyceridemia -- high blood glucose and high blood fat simultaneously.

### Basu et al. (2004): Measured difference in T2D

In a 3-step insulin clamp study, Basu et al. compared healthy individuals with T2D patients:

| Insulin level | Healthy: EGP | T2D: EGP | Healthy: Muscle uptake | T2D: Muscle uptake |
|---------------|-------------|----------|----------------------|---------------------|
| Low (~150 pmol/L) | Partially suppressed | Insufficient suppression | Minimal | Minimal |
| Moderate (~350 pmol/L) | Complete suppression | Still not complete | Moderate | Reduced |
| High (~700 pmol/L) | Complete | Complete | High | Still reduced |

Key finding: muscle uptake was reduced at **all** tested insulin levels in T2D, while EGP suppression was only significantly worse at the lowest level. This confirms that muscle resistance is the dominant defect.

### Limitation in the simulator

The Hovorka model uses linear insulin effect equations (x1, x2, x3 are all proportional to insulin concentration), which do not capture this threshold behavior. This is one of the most important limitations of the current simulator and an obvious candidate for future improvement -- e.g., by replacing the linear effect equations with sigmoid (Hill-type) functions with separate EC50 values for each effect.

> **Sources:**
> - Rizza RA, Mandarino LJ, Gerich JE. (1981). "Dose-response characteristics for effects of insulin on production and utilization of glucose in man." *Am J Physiol*, 240(6):E630-E639.
> - Basu R, Basu A, Johnson CM, Schwenk WF, Rizza RA. (2004). "Insulin dose-response curves for stimulation of splanchnic glucose uptake and suppression of endogenous glucose production differ in nondiabetic humans and are abnormal in people with type 2 diabetes." *Diabetes*, 53(8):2042-2050.
> - Prager R, Wallace P, Olefsky JM. (1986). "Dynamics of hepatic and peripheral insulin effects suggest common rate-limiting step in vivo." *Diabetes*, 35(9):1042-1048.
> - DeFronzo RA, Tripathy D. (2009). "Skeletal muscle insulin resistance is the primary defect in type 2 diabetes." *Diabetes Care*, 32(Suppl 2):S157-S163.
> - Brown MS, Goldstein JL. (2008). "Selective versus total insulin resistance: a pathogenic paradox." *Cell Metab*, 7(2):95-96.
> - Stumvoll M, et al. (2000). "Suppression of systemic, intramuscular, and subcutaneous adipose tissue lipolysis by insulin in humans." *J Clin Endocrinol Metab*, 85(10):3740-3745.
> - Natali A, et al. (2000). "Dose-response characteristics of insulin action on glucose metabolism: a non-steady-state approach." *Am J Physiol Endocrinol Metab*, 278(5):E794-E801.
> - Kolterman OG, et al. (1981). "Receptor and postreceptor defects contribute to the insulin resistance in noninsulin-dependent diabetes mellitus." *J Clin Invest*, 68(4):957-969.
> - Bergman RN. (2005). "Minimal model: perspective from 2005." *Horm Res*, 64(Suppl 3):8-15.
> - Thiebaud D, et al. (1982). "The effect of graded doses of insulin on total glucose uptake, glucose oxidation, and glucose storage in man." *Diabetes*, 31(11):957-963.

---

# Part 6: Technology and Research Models

---

## 26. CGM technology -- continuous glucose monitoring

**Active in simulator (delay + noise + drift)**

A CGM (Continuous Glucose Monitor) is the sensor many T1D patients wear on their body to continuously follow blood glucose. But CGM does not measure blood glucose directly -- and the delay and inaccuracy in the measurement matter for how you interpret the numbers.

### What CGM actually measures

The CGM sensor sits in the subcutaneous adipose tissue and measures glucose in the interstitial fluid (the fluid between cells) -- not in the blood. The glucose must first diffuse from the bloodstream to the sensor's location, and that takes time.

### The delay is real

- Average delay from blood to sensor: 5-6 minutes at rest
- Total delay including sensor processing: 7-11 minutes
- During rapid changes (after a meal, during exercise): 10-15 minutes

This means that when your CGM shows 5.0 mmol/L and falling, your actual blood glucose may already be 4.0 mmol/L. That delay is critical to understand during rapid blood glucose changes.

### Accuracy

Modern CGM systems (Dexcom G7, Libre 3) have a mean absolute relative difference (MARD) of approximately 8-10%. Older models (Libre 1) were at 11-14%. Accuracy worsens during rapid changes and in the low range (below 4 mmol/L) -- precisely where accuracy is most critical.

### Noise sources

- **Electronic noise:** Random variation from the sensor's electronics (approximately plus/minus 0.3 mmol/L)
- **Biological variation:** Local blood flow, pressure on the sensor, fluid balance
- **Drift:** Slow systematic deviation over the sensor's lifetime (typically 7-14 days)

### How it is modeled in the simulator

The simulator models the CGM delay as a first-order filter with a time constant of approximately 7 minutes, plus realistic noise and slow drift. This produces a CGM reading that resembles reality: it "lags slightly behind" the true blood glucose and fluctuates slightly around the correct value.

> **Sources:**
> - Schrangl P, et al. (2015). "Time Delay of CGM Sensors: Relevance, Causes, and Countermeasures." *J Diabetes Sci Technol*, 9(5):1006-1015.
> - Sinha M, et al. (2017). "A Comparison of Time Delay in Three Continuous Glucose Monitors." *J Diabetes Sci Technol*, 11(5):1001-1007.
> - Ajjan RA, et al. (2018). "Accuracy of flash glucose monitoring and continuous glucose monitoring technologies." *Diabet Vasc Dis Res*, 15(3):175-184.

---

## 27. Mathematical models used in research

The simulator is built on the Hovorka 2004 model, but several models exist in the research world. Here is a brief overview for the curious:

### Hovorka 2004 (Cambridge model) -- used in the simulator

The model the simulator is built on. It consists of 11 differential equations and is clinically validated with over 1000 citations. The model was developed for research in closed-loop control (artificial pancreas) and is a good balance between realism and computational simplicity.

> Hovorka R, et al. (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.

### UVA/Padova (Dalla Man 2007/2014)

The most recognized model in the field. It is FDA-approved as a substitute for animal testing in insulin pump trials. More detailed than Hovorka (over 300 parameters) and includes incretin hormones and glucagon. Too complex for our purposes, but the scientific gold standard.

> Dalla Man C, et al. (2007). "Meal simulation model of the glucose-insulin system." *IEEE Trans Biomed Eng*, 54(10):1740-1749.

### Bergman Minimal Model (1979)

The simplest validated model with only 4 parameters. Used primarily for analysis of intravenous glucose tolerance tests (IVGTT), not for simulation of daily T1D management. Historically important as the first mathematical model of glucose-insulin dynamics.

> Bergman RN, et al. (1979). "Quantitative estimation of insulin sensitivity." *Am J Physiol*, 236(6):E667-E677.

### Sorensen (1985)

The most detailed multi-organ model with 19 compartments. Includes liver, kidneys, periphery, brain, and gut as separate units. Too complex for real-time simulation, but valuable as a reference for physiological correctness.

> Sorensen JT. (1985). PhD Thesis, MIT.

## 28. Glucotoxicity -- when high blood sugar causes insulin resistance

Glucotoxicity is the phenomenon where sustained hyperglycemia itself causes insulin resistance. The tissues become less responsive to insulin -- not because there is too little insulin, but because chronic high glucose has damaged the intracellular signaling pathways. This creates a vicious cycle: high blood sugar → insulin resistance → even higher blood sugar → more resistance.

For T1D patients this is clinically very important: a period of poor control (illness, forgotten basal, pump failure) can lead to unexpectedly high insulin requirements that persist for days to weeks even after the original cause is resolved.

### Mechanisms

Brownlee (2001, 2005) proposed a unifying mechanism: all major pathways of hyperglycemic damage stem from **overproduction of superoxide by the mitochondrial electron transport chain**. When excess glucose floods the cell, the mitochondria generate excessive reactive oxygen species (ROS), which then activate four damaging pathways:

**1. Hexosamine biosynthesis pathway (HBP)**

Normally ~2-5% of intracellular glucose enters this pathway. During hyperglycemia the flux increases substantially. The end product (UDP-GlcNAc) drives O-GlcNAcylation of key insulin signaling proteins, impairing IRS-1 phosphorylation and GLUT4 translocation. In cell studies, 8 hours of 25 mM glucose reduced maximal insulin-stimulated glucose transport by 40-50% (Marshall 1991, Buse 2006).

**2. Protein Kinase C (PKC) activation**

Hyperglycemia increases diacylglycerol (DAG) synthesis from glycolytic intermediates. DAG activates PKC isoforms (especially PKC-β and PKC-θ), which phosphorylate IRS-1 on inhibitory serine residues, blocking downstream Akt signaling. PKC also stimulates NADPH oxidase, generating more superoxide in a positive feedback loop.

**3. Advanced Glycation End Products (AGEs)**

Free glucose reacts with proteins to form AGEs, mediated by the precursor methylglyoxal. AGE-RAGE signaling activates NF-κB and JNK pathways, causing chronic inflammation and reduced GLUT4 protein content (~30% reduction in animal models).

**4. Polyol pathway**

Aldose reductase converts excess glucose to sorbitol, consuming NADPH. This depletes the cell's antioxidant capacity (less reduced glutathione), leaving it vulnerable to oxidative damage.

**5. GLUT4 downregulation**

All pathways converge on reduced GLUT4 transporter expression and impaired translocation to the cell membrane. Both the number of transporters and their ability to reach the membrane surface are compromised (Yki-Järvinen 1992).

### Time course

The effect develops and resolves on multiple time scales:

| Time scale | Development | Resolution |
|------------|-------------|------------|
| Hours | 24h of hyperglycemia (~20 mmol/L) reduced whole-body glucose disposal by 26% and nonoxidative disposal by 54% in T1D patients (Vuorinen-Markkola 1992) | Acute GLUT4 translocation defect partially reversible within hours of normoglycemia |
| Days | Progressive worsening with continued hyperglycemia | Near-normoglycemia for 24h doubled postprandial glycogen synthesis |
| Weeks–months | Full glucotoxic insulin resistance established | HbA1c < 7% for > 1 year needed to normalize hepatic glycogen synthesis |
| Years | Epigenetic changes (DNA methylation, histone modification) — "metabolic memory" | DCCT/EDIC: prior hyperglycemia effects persist years after normalization |

### Magnitude

Poorly controlled T1D patients (HbA1c > 9%) typically require **30-50% more insulin** than expected, partly due to glucotoxicity. Even moderate hyperglycemia has a measurable effect: the German Diabetes Study found insulin sensitivity inversely correlated with fasting glycemia even at near-normal levels (HbA1c ~6.7%).

Key experimental results:

- **24h at 20 mmol/L**: 26% reduction in whole-body glucose disposal in T1D (Vuorinen-Markkola 1992)
- **Long-standing T1D**: ~40% lower insulin-stimulated glucose disposal vs. healthy controls
- **Phlorizin normalization**: reversing hyperglycemia immediately restored insulin sensitivity in diabetic rats (Rossetti 1987)

### Distinction from lipotoxicity (FFA-induced insulin resistance)

| Feature | Glucotoxicity | Lipotoxicity |
|---------|---------------|--------------|
| Primary trigger | Chronic hyperglycemia | Elevated free fatty acids |
| Key mediators | ROS, hexosamine products, AGEs | DAG from lipid metabolism, ceramides |
| Signaling block | Downstream at Akt; GLUT4 translocation | Upstream at IRS-1; PKC-θ serine phosphorylation |
| Time to develop | Hours (24h measurable) | Hours (2-6h after fat meal/lipid infusion) |
| Reversibility | Hours to months depending on severity | Hours after FFA normalization (acute component) |

The two mechanisms interact: Monaco et al. (2017) proposed that glucotoxicity drives intramuscular lipid accumulation in T1D ("glucolipotoxicity"), potentially explaining why even well-controlled T1D patients show elevated intramyocellular lipids.

### Clinical relevance for T1D

- **Sick days / pump failures**: After prolonged hyperglycemia, total daily insulin requirements may increase 30-50%. Patients should anticipate needing more insulin than usual for days after regaining control.
- **The vicious cycle**: If a patient does not increase their insulin dose in response to glucotoxic resistance, BG stays high, further worsening resistance. Breaking the cycle — even briefly — begins reversing the acute component within hours.
- **"Metabolic memory"**: The DCCT/EDIC study showed that periods of poor control leave lasting epigenetic marks that increase complication risk for years, even after subsequent improvement. Early tight control matters disproportionately.
- **Newly diagnosed patients**: Insulin sensitivity often improves in the first months after diagnosis (honeymoon period) partly because correcting chronic hyperglycemia reverses glucotoxicity.

### Simulator implementation notes

Glucotoxicity could be modeled as a **dynamic ISF modifier** driven by recent glycemic history:

- Track a rolling average of BG over the past 24-72 hours
- When the rolling average exceeds a threshold (~10-12 mmol/L), apply a progressive ISF reduction
- Maximum effect: ~30-40% ISF reduction at sustained BG > 20 mmol/L
- Resolution: exponential decay with t½ of ~24-48 hours after normalization
- This would interact with (but be separate from) FFA-induced resistance (section 9d in the todo list)

### References

> Rossetti L, Giaccari A, DeFronzo RA. (1990). "Glucose Toxicity." *Diabetes Care*, 13(6):610-630. — The foundational review establishing glucose toxicity as a concept.

> Brownlee M. (2001). "Biochemistry and molecular cell biology of diabetic complications." *Nature*, 414(6865):813-820. — Unifying mechanism: mitochondrial superoxide overproduction.

> Brownlee M. (2005). "The Pathobiology of Diabetic Complications: A Unifying Mechanism." *Diabetes*, 54(6):1615-1625. DOI: 10.2337/diabetes.54.6.1615.

> Rossetti L, Smith D, Shulman GI, et al. (1987). "Correction of hyperglycemia with phlorizin normalizes tissue sensitivity to insulin in diabetic rats." *J Clin Invest*, 79(5):1510-1515. DOI: 10.1172/JCI112981. — First in vivo evidence that hyperglycemia per se causes insulin resistance.

> Vuorinen-Markkola H, Koivisto VA, Yki-Järvinen H. (1992). "Mechanisms of hyperglycemia-induced insulin resistance in whole body and skeletal muscle of type I diabetic patients." *Diabetes*, 41(5):571-580. — 24h hyperglycemia study in T1D.

> Yki-Järvinen H. (1990). "Acute and chronic effects of hyperglycaemia on glucose metabolism." *Diabetologia*, 33:579-585.

> Buse MG. (2006). "Hexosamines, insulin resistance and the complications of diabetes: current status." *Am J Physiol Endocrinol Metab*, 290:E1-E8.

> Monaco CMF, et al. (2017/2024). "Mechanisms of insulin resistance in type 1 diabetes mellitus: A case of glucolipotoxicity in skeletal muscle." *J Cell Physiol*.

> Apostolopoulou M, et al. (2025). "Insulin Resistance in Type 1 Diabetes: Pathophysiological, Clinical, and Therapeutic Relevance." *Endocrine Reviews*, 46(3):317. — Comprehensive 2025 review covering glucotoxicity in T1D.

> DCCT/EDIC Research Group. "Understanding Metabolic Memory: The Prolonged Influence of Glycemia During the Diabetes Control and Complications Trial on Future Risks of Complications During EDIC." — Epigenetic metabolic memory.

---

*Last updated: March 2026*

*This document is continuously expanded. Contributions and corrections are welcome. Contact us via GitHub: https://github.com/krauhe/t1d-simulator*
