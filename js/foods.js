// =============================================================================
// FOODS.JS — Food items and carbohydrate types
// =============================================================================
//
// This file has two responsibilities:
//   1) FOODS — data table for the ready-made food buttons in the UI.
//      Each food item has macros (carbs/protein/fat), total weight, an icon and
//      a carb type (carbType). Button handlers in js/main.js look up the
//      table instead of hardcoding numbers directly in each event listener.
//
//   2) CARB_TYPES — physiological parameters for each carb type.
//      Used by Simulator.addFood() to fill the stomach "mix state"
//      (stomachCarbsSimple, stomachFiber, stomachRetentionWeight) and by
//      _substepFatProteinFFA() to compute the dynamic τG (gastric emptying).
//
// EU/DK carb convention (IMPORTANT — applied throughout the simulator):
// -----------------------------------------------------------------------
// We follow the European/Danish nutritional labelling convention where:
//     carbs  = sugar + starch  (digestible carbohydrates)
//     fiber  = indigestible fibre (separate nutrient field, NOT part of carbs)
//
// This differs from the US USDA convention where "total carbohydrate"
// includes fibre as a sub-category. Under the EU convention there is NO
// "bioavailability correction" needed: food.carbs = what can be digested.
//
// Implications for the model:
//   * food.carbs  fed directly into Hovorka D1/D2 (fully bioavailable)
//   * food.fiber  recorded separately in stomachFiber and influences τG via fiberMod
//   * CARB_TYPES.fiberPerGram means "grams of fibre per gram of digestible carb"
//   * simpleFraction = sugar / (sugar + starch)  (fraction of digestible carb)
//
// Design principle — "one bag always mixed":
// The stomach is modelled as a CSTR (continuous stirred-tank reactor):
// everything ingested mixes with what was already there, and the mix's overall
// composition determines τG each tick. We do NOT track each food item as
// a separate compartment — that would be complex and is physiologically unnecessary
// (the stomach actually has peristaltic mixing).
//
// Scaling during emptying:
// When the stomach's total gram content falls by a factor (X grams → X*r grams),
// all mix variables (carbs, simple, fiber, retentionWeight) are scaled by the
// same factor r. This preserves ratios — so simpleFraction and fiberPerGram
// remain constant during emptying until the next meal changes the mix.
//
// Carb-type parameters (calibrated 2026-04-11 against frida.fooddata.dk + literature):
//   simpleFraction: sugar / (sugar + starch)
//                   1.0 = pure sugar, 0.0 = pure starch, 0.2 = "mixed" default
//   fiberPerGram:   g fibre per g digestible carb (EU convention)
//                   Typical values: sugar 0.00, white bread 0.05, rye bread 0.20,
//                   fruit 0.16, vegetables often >0.5 (low-carb + high fibre).
//   retentionFactor:   1.0 = solid food (normal gastric retention)
//                   <1.0 = liquid (passes pylorus faster — pyloric sieve)
//                   Example: cola/juice = 0.4 → empties ~2.5x faster
//
// Sources (see docs/references/ and docs/BG-SCIENCE.md §22 for full discussion):
//   Wolever 2008       — International GI Tables (sugar, bread, fruit, pasta)
//   Jenkins 1981       — Original glycemic index paper
//   Würsch 1997        — β-glucan and postprandial glucose response
//   Marathe 2013       — Liquid vs. solid glucose absorption, pyloric sieve
//   Mendoza 2008       — Fibre and gastric emptying rate
//   Kong & Singh 2008  — Mechanical breakdown in the stomach (liquid vs solid)
//   Horowitz 1991      — Gastric emptying in diabetic patients, baseline
//   frida.fooddata.dk  — Danish food database (DTU National Food Institute)
//
// =============================================================================

// -----------------------------------------------------------------------------
// CARB_TYPES — Physiological parameters per carb type
// -----------------------------------------------------------------------------
// Used as a lookup table: CARB_TYPES[food.carbType] → { simpleFraction, fiberPerGram, retentionFactor }
//
// When a player eats a food item, the stomach mix variables are filled as:
//   stomachCarbsSimple   += carbs * simpleFraction
//   stomachFiber         += carbs * fiberPerGram
//   stomachRetentionWeight  += foodWeight * retentionFactor
//
// IMPORTANT: Under the EU convention "carbs" = sugar + starch (digestible).
// fiberPerGram is therefore the ratio fibre/digestible-carb — not fibre/total.
// Example: Rye bread 100g ≈ 40g digestible carb + 8g fibre → fiberPerGram = 0.20
//
// The default type 'mixed' is used when none is specified — preserves existing
// calls (e.g. from older tests or campaign events) without changing behaviour.
//
// Calibrated 2026-04-11 against frida.fooddata.dk and Wolever 2008.
const CARB_TYPES = {
    // Pure sugar (solid): glucose tablets, honey, candy
    // 100% simple, no fibre, normal gastric retention
    // frida: table sugar = 100g sugar/100g, 0 starch, 0 fibre
    sukker_fast: {
        simpleFraction: 1.00,
        fiberPerGram:   0.00,
        retentionFactor:   1.0,
    },

    // Pure sugar (liquid): juice, cola, sports drink
    // 100% simple, no fibre, LIQUID → passes pylorus quickly
    // retentionFactor 0.4 = ~2.5x faster gastric emptying than solid food
    // Calibrated against Marathe 2013: liquid glucose T_peak ~30 min (BG)
    // Kong & Singh 2008: pyloric sieve allows particles <2 mm to pass
    sukker_flydende: {
        simpleFraction: 1.00,
        fiberPerGram:   0.00,
        retentionFactor:   0.4,
    },

    // Fruit (apple, banana, pear): mixed fructose/glucose + skin fibre
    // frida apple: 11g carb, 0.05g starch, 2g fibre per 100g
    //   → simpleFraction = 10.95/11 ≈ 1.0 (almost entirely sugar)
    //   → fiberPerGram = 2/11 ≈ 0.18
    // frida banana: 20g carb, ~3g starch, 1.9g fibre per 100g
    //   → simpleFraction = 17/20 ≈ 0.85
    //   → fiberPerGram = 1.9/20 ≈ 0.10
    // Weighted average taken (apple dominates in the FOODS table).
    frugt: {
        simpleFraction: 0.90,
        fiberPerGram:   0.16,
        retentionFactor:   1.0,
    },

    // White flour (white bread, pasta, pizza, cake): almost pure starch
    // frida white bread: 46g carb, ~2g sugar, 3g fibre per 100g
    //   → simpleFraction = 2/46 ≈ 0.04
    //   → fiberPerGram = 3/46 ≈ 0.07
    // frida cooked pasta: 29g carb, <1g sugar, 1.8g fibre per 100g
    //   → simpleFraction ≈ 0.03
    //   → fiberPerGram ≈ 0.06
    // Average: white bread 0.065, pasta 0.06, pizza ~0.06, cake ~0.04 → 0.05.
    hvidt_mel: {
        simpleFraction: 0.05,
        fiberPerGram:   0.05,
        retentionFactor:   1.0,
    },

    // Whole grain (rye bread, oatmeal): starch + high fibre → slow
    // frida rye bread: 38g carb, ~3g sugar, 8g fibre per 100g
    //   → simpleFraction = 3/38 ≈ 0.08
    //   → fiberPerGram = 8/38 ≈ 0.21
    // frida oatmeal (dry): 58g carb, ~1g sugar, 10g fibre per 100g
    //   → simpleFraction ≈ 0.02
    //   → fiberPerGram ≈ 0.17
    // Rye bread is the typical reference for "whole grain" in Denmark.
    fuldkorn: {
        simpleFraction: 0.08,
        fiberPerGram:   0.20,
        retentionFactor:   1.0,
    },

    // Vegetables (salad, carrot, broccoli): low-carb + high fibre ratio
    // frida broccoli: 2g carb, 0.6g sugar + 1.4g starch, 3g fibre per 100g
    //   → simpleFraction = 0.6/2 ≈ 0.30
    //   → fiberPerGram = 3/2 = 1.50 (!) — fibre > digestible carb
    // frida carrot: 7g carb, 5g sugar + 2g starch, 2.8g fibre per 100g
    //   → simpleFraction = 5/7 ≈ 0.71
    //   → fiberPerGram = 2.8/7 = 0.40
    // frida iceberg lettuce: 1.5g carb, 1g sugar + 0.5g starch, 1.2g fibre
    //   → simpleFraction ≈ 0.67
    //   → fiberPerGram ≈ 0.80
    // A typical "salad plate" mix is used as the reference.
    // Note: fiberPerGram >> 0 for vegetables is normal under the EU convention
    //       because the carb content itself is so low.
    grøntsag: {
        simpleFraction: 0.65,
        fiberPerGram:   0.75,
        retentionFactor:   1.0,
    },

    // Default when type is absent: typical mixed meal (rice/pasta + vegetables + meat)
    // Low sugar fraction (starch dominates), some fibre from vegetables
    mixed: {
        simpleFraction: 0.20,
        fiberPerGram:   0.08,
        retentionFactor:   1.0,
    },
};


// -----------------------------------------------------------------------------
// FOODS — Data table for the food buttons in the UI
// -----------------------------------------------------------------------------
// Each entry has:
//   carbs    — grams of carbohydrate
//   protein  — grams of protein
//   fat      — grams of fat
//   weight   — total food weight (grams) — used by stomach capacity check
//   carbType — lookup in CARB_TYPES (default 'mixed' if omitted)
//   icon     — emoji or image path for graph and log
//
// The FOODS table is the source of truth for food buttons. js/main.js uses
// addFoodFromKey(key) → FOODS[key] → game.addFood(...) so macros, weight and
// carbType are kept in one place. Each row in the table corresponds to a row in the UI:
//   1) Low-carb      — protein/fat-rich foods that barely move BG
//   2) Meals         — composite meals where the carb type controls τG
//   3) Adjustments/snacks — fast sugar, fruit and light foods
// Standard child portion scale (used when weight < 45 kg).
// Individual foods can override via the childScale property.
// Eggs and glucose tablets are not scaled (one egg is one egg, one tablet is one tablet).
// Fruit and drinks are scaled more mildly (0.67 / 0.60) as portions
// are naturally somewhat smaller for children, but not halved.
const CHILD_PORTION_SCALE = 0.55;

// eatTimeMin — how many sim-minutes the meal drips into the stomach.
// Models chewing/drinking over time rather than consuming everything in one tick.
// Prevents discontinuities in the carb absorption band by letting τG change
// gradually as a new meal is mixed in. If omitted → estimateEatTimeMin() is used.
const FOODS = {
    // ───── Row 1: Low-carb (Eggs, Nuts, Salad, Salmon & avocado, Eggs & bacon, Steak & béarnaise) ─────
    // Low carbs → minimal BG impact. Protein/fat give a small delayed effect
    // via gluconeogenesis and fat-mediated insulin resistance. The two bitmap dishes
    // are composite low-carb meals, making the level feel more like everyday food.
    æg:            { carbs: 1,  protein: 7,  fat: 5,  weight: 50,  carbType: 'mixed',    icon: 'assets/icons/food/egg.png', childScale: 1.0, eatTimeMin: 2 },
    nødder:        { carbs: 6,  protein: 8,  fat: 25, weight: 40,  carbType: 'mixed',    icon: 'assets/icons/food/nuts.png', eatTimeMin: 3 },
    salat:         { carbs: 5,  protein: 2,  fat: 1,  weight: 200, carbType: 'grøntsag', icon: 'assets/icons/food/salad.png', eatTimeMin: 5 },
    laksAvocado:   { carbs: 5,  protein: 30, fat: 28, weight: 300, carbType: 'grøntsag', icon: 'assets/icons/food/lowcarb-salmon-avocado.png', eatTimeMin: 7 },
    ægBacon:       { carbs: 2,  protein: 25, fat: 32, weight: 180, carbType: 'mixed',    icon: 'assets/icons/food/lowcarb-eggs-bacon.png', eatTimeMin: 6 },
    bøfBearnaise:  { carbs: 4,  protein: 35, fat: 38, weight: 320, carbType: 'grøntsag', icon: 'assets/icons/food/lowcarb-steak-bearnaise.png', eatTimeMin: 8 },

    // ───── Row 2: Meals (Curry & rice, Oatmeal, Burger, Pasta, Pizza, Cake) ─────
    // Composite meals. Carb type (fuldkorn vs hvidt_mel) controls dynamic τG:
    //   fuldkorn → high fibre → delayed gastric emptying
    //   hvidt_mel → low fibre → faster gastric emptying (but fat still delays)
    // Note: bollerIKarry assumes brown rice (whole grain) to maintain the pedagogical
    // balance in the row (2 whole grain + 4 white flour meals).
    bollerIKarry:   { carbs: 50, protein: 25, fat: 15, weight: 350, carbType: 'fuldkorn',  icon: 'assets/icons/food/curry-rice.png', eatTimeMin: 8 },
    havregryn:      { carbs: 30, protein: 8,  fat: 2,  weight: 250, carbType: 'fuldkorn',  icon: 'assets/icons/food/oatmeal.png', eatTimeMin: 5 },
    burger:         { carbs: 40, protein: 40, fat: 40, weight: 300, carbType: 'hvidt_mel', icon: 'assets/icons/food/burger.png', eatTimeMin: 6 },
    pasta:          { carbs: 50, protein: 10, fat: 5,  weight: 300, carbType: 'hvidt_mel', icon: 'assets/icons/food/pasta.png', eatTimeMin: 6 },
    pizza:          { carbs: 55, protein: 20, fat: 25, weight: 150, carbType: 'hvidt_mel', icon: 'assets/icons/food/pizza.png', eatTimeMin: 5 },
    lagkage:        { carbs: 60, protein: 5,  fat: 25, weight: 150, carbType: 'hvidt_mel', icon: 'assets/icons/food/cake.png', eatTimeMin: 4 },

    // ───── Row 3: Fast carbs (Glucose tablets, Candy, Juice, Cola, Banana, Chocolate) ─────
    // Fast sugars + fruit + sweet snack. retentionFactor on cola/juice means they
    // empty ~2x faster than solid glucose tablets — visible in T_peak on the BG graph.
    // Candy (sucrose bar) replaces apple — apple was too close to banana in sugar content,
    // and candy covers a completely different, didactically important category (a handful
    // of candy = 20g carbs, same substance as glucose tablets but in a much higher dose).
    // Glucose tablets intentionally have a short eatTimeMin (dissolves on the tongue)
    // so they retain their value as fast hypo treatment.
    // Chocolate bar uses sukker_fast as carb type (sucrose dominates carbs),
    // but the high fat content delays gastric emptying via the fat pathway.
    druesukker: { carbs: 3,  protein: 0, fat: 0,  weight: 3,   carbType: 'sukker_fast',     icon: 'assets/icons/food/glucose-tablets.png', childScale: 1.0, eatTimeMin: 0.3 },
    slik:       { carbs: 20, protein: 0, fat: 0,  weight: 25,  carbType: 'sukker_fast',     icon: 'assets/icons/food/candy.png', eatTimeMin: 1 },
    juice:      { carbs: 25, protein: 0, fat: 0,  weight: 250, carbType: 'sukker_flydende', icon: 'assets/icons/food/juice.png', childScale: 0.60, eatTimeMin: 1 },
    cola:       { carbs: 27, protein: 0, fat: 0,  weight: 250, carbType: 'sukker_flydende', icon: 'assets/icons/food/cola.png', childScale: 0.60, eatTimeMin: 1 },
    banan:      { carbs: 25, protein: 1, fat: 0,  weight: 120, carbType: 'frugt',           icon: 'assets/icons/food/banana.png', childScale: 0.67, eatTimeMin: 3 },
    chokolade:  { carbs: 22, protein: 3, fat: 12, weight: 40,  carbType: 'sukker_fast',     icon: 'assets/icons/food/chocolate.png', eatTimeMin: 2 },
};

// estimateEatTimeMin — Fallback formula for foods without an explicit eatTimeMin
// (typically custom food from the "Lav selv" panel). Weight-based heuristic:
//   - Liquid (sukker_flydende): drunk in max 2 min, min 0.5 min
//   - Solid food: ~50 g/min eating rate, clamped between 0.5 and 10 min
function estimateEatTimeMin(food) {
    if (food.eatTimeMin !== undefined && food.eatTimeMin !== null) {
        return Math.max(0.1, food.eatTimeMin);
    }
    const w = food.weight || (food.carbs + food.protein + food.fat) || 50;
    if (food.carbType === 'sukker_flydende') {
        return Math.min(2, Math.max(0.5, w / 125));
    }
    return Math.max(0.5, Math.min(10, w / 50));
}


// -----------------------------------------------------------------------------
// Export for both browser and Node test environment
// -----------------------------------------------------------------------------
// Browser: files are loaded via <script> in index.html → globals accessed directly.
// Node test: require('../js/foods.js') returns the same constants directly.
// The explicit 'window' assignment ensures other modules can check for
// existence with typeof FOODS !== 'undefined'.
if (typeof window !== 'undefined') {
    window.FOODS = FOODS;
    window.CARB_TYPES = CARB_TYPES;
    window.CHILD_PORTION_SCALE = CHILD_PORTION_SCALE;
    window.estimateEatTimeMin = estimateEatTimeMin;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FOODS,
        CARB_TYPES,
        CHILD_PORTION_SCALE,
        estimateEatTimeMin,
    };
}
