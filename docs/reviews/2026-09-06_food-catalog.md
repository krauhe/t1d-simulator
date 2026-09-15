# Snack catalog and icon revision

Date: 2026-09-06

## Scope and portion definitions

Replace soda with an unsweetened caffè latte, reduce candy and milk chocolate to **6 g total food weight per click**, and arrange the row as dextrose, candy, chocolate, juice, banana, latte. Six grams does not mean six grams of carbohydrate. The dextrose tablet remains the existing 3 g portion.

| Food | Reference portion (g) | Carbohydrate (g) | Protein (g) | Fat (g) | Child scale |
|---|---:|---:|---:|---:|---:|
| Dextrose tablet | 3 | 3 | 0 | 0 | 1 |
| Gummy candy | 6 | 4.6 | 0.4 | 0 | 1 |
| Milk chocolate | 6 | 3.2 | 0.5 | 1.9 | 1 |
| Orange juice | 250 | 24 | 1.5 | 0.5 | 0.60 |
| Banana, edible part | 120 | 23.6 | 1.3 | 0.2 | 0.67 |
| Caffè latte | 230 | 9.4 | 7 | 3 | 0.60 |

These are reference foods, not exact values for every brand. Adult reference portions are shown above. Existing desktop child scaling is retained for fruit and drinks; candy and chocolate remain 6 g for every character. The separate mobile shell still uses its existing unscaled catalog portions. Both shells therefore deliver the same 6 g candy/chocolate portion. The broader mobile portion-scaling difference is outside this change.

Drinks are labelled in grams because both the source data and the simulator's stomach input use mass. No unverified density conversion to millilitres is introduced. Banana weight excludes peel.

## Nutritional sources and calculation

Values were checked on 2026-09-06. All five links below returned HTTP 200 from the local PC with the expected product/food title and nutritional content. Banana was additionally checked in a rendered browser.

1. [HARIBO Goldbears](https://www.haribo.com/da-dk/produkter/haribo/goldbears): per 100 g, carbohydrate 77 g, protein 6.9 g, fat <0.5 g. Multiply by 0.06. Fat is below 0.03 g per portion and rounds to zero.
2. [Matvaretabellen: milk chocolate](https://www.matvaretabellen.no/sjokolade-melkesjokolade/): per 100 g, carbohydrate 53.1 g, protein 8.1 g, fat 32.3 g. Multiply by 0.06.
3. [Matvaretabellen: orange juice from concentrate](https://www.matvaretabellen.no/appelsinjuice-fra-konsentrat/): per 100 g, carbohydrate 9.6 g, protein 0.6 g, fat 0.2 g. Multiply by 2.5.
4. [Matvaretabellen: raw banana](https://www.matvaretabellen.no/banan-ra/): per 100 g edible portion, carbohydrate 19.7 g, protein 1.1 g, fat 0.2 g. Multiply by 1.2.
5. [Arla milk, 1.5% fat](https://www.arla.dk/produkter/arla-maelk/let-15-16742/): per 100 g, carbohydrate 4.7 g, protein 3.5 g, fat 1.5 g. Latte recipe is 200 g milk plus 30 g espresso. The small espresso macro contribution is omitted; values are approximate. There is no added sugar.

Round macros to one decimal gram. Calories retain the simulator's existing 4/4/9 calculation, rounded to a whole kcal; they are not separately copied from food labels and exclude a separate fibre-energy contribution. This is why calculated calories can differ slightly from a source's energy field.

The old Frida food URLs 675 and 1863 were investigated but currently redirect to the new database search page from the local PC. They are not used as verified source links here. The cached chocolate entry also mixed carbohydrate measures in a way that could make summed macros exceed total mass; the internally consistent Norwegian reference was selected instead.

## Implementation boundaries

1. `js/foods.js` remains the catalog source of truth. `foodMacroAmount()` preserves decimal macros in desktop chip labels and actual food delivery; integer rounding previously turned 0.4 g protein into zero.
2. Existing carbohydrate types and absorption parameters are unchanged. Latte uses the existing liquid carbohydrate path with its protein and fat. No caffeine response or new milk-specific absorption mechanism is introduced.
3. Six transparent PNGs use the existing icon filenames, plus `caffe-latte.png`. Three gummy bears and two small chocolate squares communicate small servings; artwork is illustrative, not a weighing scale.
4. Desktop and mobile row order, names, macros and Z/X/C/V/B/N shortcuts are updated. The visual food comparison uses the live catalog and no longer references the removed soda entry.
5. Danish and English tour text and generation scripts no longer mention soda. The two old `08-food-sugars.mp3` recordings are retained on disk but not played or preloaded. This step temporarily uses text only. Regeneration requires explicit paid-API approval.

## Verification

1. `tests/food-catalog.test.js`: passed; portions, source calculations, mass sanity check, decimal preservation, row order and asset references. All six portions are accepted by the actual simulator and retain macros, weight and icon in the Hvad Nu Hvis action history.
2. `tests/simulation.test.js`: 197/197 passed.
3. `tests/check-text-sync.sh`: passed; matching help markers and 848 keys in each language.
4. `tests/food-browser-smoke.cjs`: passed; desktop adult/child clicks, all six shortcuts, mobile clicks, Danish/English names and no JavaScript exceptions.
5. Icons checked on dark/light backgrounds at 36, 42 and 96 px in the shared icon gallery. No checkerboard or magenta background remains. Desktop and mobile macro labels are legible. Screenshots: `tests/playwright/2026-09-06_food/`.

No commit, push, publication or paid audio generation was performed.
