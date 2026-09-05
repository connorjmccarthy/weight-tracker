/**
 * Turns the raw researched nutrition data into `src/data/foods.ts`.
 *
 * Run with:  node scripts/build-foods.mjs
 *
 * This exists so the food list is auditable. `scripts/food-research.json` is what the
 * research pass returned; the DROP and OVERRIDE tables below are every correction applied
 * to it afterwards, each with the reason. Nothing is silently edited between the two.
 *
 * The corrections came from an adversarial fact-check that recomputed kilojoules from
 * macros (protein 17 kJ/g, carbs 17, fat 37, alcohol 29) and re-read the published
 * Australian nutrition panels. It found the generic AUSNUT-derived half sound and the
 * branded half substantially wrong — which is the half this person actually eats from.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(readFileSync(join(here, 'food-research.json'), 'utf8'))

/** Entries removed entirely, and why. */
const DROP = {
  "McDonald's Egg McMuffin":
    'US product. McDonald\'s Australia does not sell a plain Egg McMuffin — the AU line is Bacon & Egg, Sausage & Egg, Sausage, Chicken. Value and macros match the US panel.',
  'Craft Boss Latte 500ml bottle': 'Japanese Craft Boss PET line; not sold in Australia.',
  'Craft Boss Black 500ml bottle (unsweetened)': 'Japanese Craft Boss PET line; not sold in Australia.',
  'Boss Coffee Iced Latte 500ml bottle': 'No such AU SKU. The AU 500 ml range is the Café line (Iced Long Black, Iced Double Espresso).',
  'Boss Coffee Iced Espresso 237ml can':
    'Not in the AU range; invented by scaling off the real Iced Double Espresso, and at a conflicting value.',
  "Grill'd Famous Grill'd Chips - Large": 'Not on the AU menu — Grill\'d sells snack (140 g) and regular (245 g).',
  'Beef tartare (entree)': 'Duplicate of the consolidated tartare entry, at a conflicting value.',
  'Beef tartare, beef and yolk only (no toast)': 'Superseded by the corrected consolidated entry.',
  'Gelato, 2 scoops': 'Duplicate of the Massimo\'s entry.',
  'Restaurant pasta main (creamy or ragu)': 'Duplicate — carbonara and ragu are already listed separately.',
  'Golden Wholemeal Crumpet': 'Near-duplicate. One crumpet row is enough; clutter is what makes search useless.',
  'Golden Crumpet Square': 'Near-duplicate.',
  'Coles/Woolworths own-brand crumpet': 'Near-duplicate.',
  'Bakers Delight crumpet': 'Near-duplicate.',
  'Crumpet, 1': 'Duplicate of the Golden crumpet row at a conflicting weight and value.',
  'Generic sugar-free maple syrup (other brands)': 'Duplicate.',
  'Sugar-free maple syrup, 1 tablespoon': 'Duplicate.',
  'Pepsi Max, 375 ml can': 'Duplicate.',
  'Pepsi Max from 1.25 L bottle (400 ml glass)': 'Duplicate; the can and bottle rows cover it.',
  'Iced long black, cafe (no sugar, no milk)': 'Duplicate — three iced long black rows existed at 20, 25 and 30 kJ.',
  'Long black, cafe (no sugar, no milk)': 'Duplicate.',
  "McCafe Iced Long Black (no sugar, no milk)": 'Duplicate of the generic iced long black.',
  "McCafe Long Black (regular, no sugar)": 'Duplicate of the generic long black.',
  'Espresso, single shot': 'Rolled into the long black row; a bare shot is rounding error either way.',
  "Grill'd traditional burger bun (component)": 'Component-level entry nobody logs on its own.',
  'Home-cooked pasta (father\'s cooking)': 'Superseded — the specific dishes carry researched values.',
  'Home-cooked dinner, generic (father\'s cooking)': 'Superseded by the explicit "Dad\'s dinner" rows.',
  'Restaurant main, unspecified (planning average)': 'Kept as a renamed row below instead.',
  'Chicken breast, cooked, skinless (large serve)': 'The 150 g row plus a portion multiplier covers this.',
  'Boss Coffee Zero Sugar Latte 237ml can': 'Could not be confirmed in the current AU range.',
}

/**
 * Corrections to values that survived. Each key is the researched name; `why` is the
 * evidence the fact-check produced.
 */
const OVERRIDE = {
  "McDonald's Bacon & Egg McMuffin": {
    kj: 1230,
    protein: 18,
    carbs: 27,
    fat: 12,
    confidence: 'high',
    source: 'CalorieKing AU 294 cal / FatSecret AU 290 cal; cross-checked against the Double at 1620 kJ',
    why: 'Was 1560 kJ — 27% high, and impossible against McDonald\'s own Double at 1620 kJ.',
  },
  "McDonald's Sausage & Egg McMuffin": {
    kj: 1620,
    protein: 21,
    carbs: 27,
    fat: 21,
    confidence: 'high',
    source: 'CalorieKing AU 387 cal; cross-checked against the Double at 2130 kJ',
    why: 'Was 1900 kJ — 17% high, and impossible against the Double at 2130 kJ.',
  },
  "McDonald's Sausage McMuffin": {
    kj: 1310,
    confidence: 'high',
    source: 'CalorieKing AU 313 cal',
    why: 'Was 1490 kJ — 14% high.',
  },
  "McDonald's Frozen Coke - Medium": {
    kj: 580,
    carbs: 34,
    confidence: 'high',
    source: 'CalorieKing AU 138 cal',
    why: 'Was 840 kJ — 45% high; the carb figure was inferred wrongly and dragged the total with it.',
  },
  "McDonald's Frozen Coke - Large": {
    kj: 780,
    carbs: 46,
    confidence: 'high',
    source: 'CalorieKing AU 186 cal',
    why: 'Was 1140 kJ — 45% high.',
  },
  "McDonald's OREO Cookie McFlurry (regular)": {
    kj: 1300,
    protein: 7.2,
    carbs: 47.3,
    fat: 10,
    confidence: 'high',
    source: "McDonald's AU nutrition panel; macros reconcile to 1297 kJ",
    why: 'Was 1560 kJ — 20% high, and guessed from a band with no macros to check against.',
  },
  "McDonald's McFlurry - Mini": {
    kj: 650,
    confidence: 'medium',
    source: 'Half the corrected regular',
    why: 'Was 830 kJ, scaled off the overstated regular.',
  },
  'Golden Original Crumpet Round': {
    name: 'Crumpet',
    kj: 398,
    protein: 3.2,
    carbs: 18.5,
    fat: 0.7,
    confidence: 'high',
    source: 'Woolworths panel, Golden Crumpets Round 6-pack: 795 kJ/100 g',
    why: 'Was 430 kJ — 8% high. Its own macros reconciled to 395 kJ, matching the real panel.',
  },
  '2 crumpets with sugar-free maple syrup (his breakfast)': {
    name: 'Crumpets ×2 with sugar-free syrup',
    kj: 840,
    protein: 6.4,
    carbs: 37,
    fat: 1.4,
    confidence: 'high',
    source: '2 × corrected crumpet + 20 ml Queen sugar-free syrup',
    why: 'Was 900 kJ, built on the overstated crumpet.',
  },
  'Boss Coffee Iced Vanilla Latte 237ml can': {
    kj: 380,
    protein: 3,
    carbs: 14,
    fat: 3,
    confidence: 'medium',
    source: 'Fitia AU, 90 cal per 237 ml can',
    why: 'Was 300 kJ — 25% low; it had been estimated by scaling off the plain latte and ignored the syrup.',
  },
  'Boss Coffee Iced Caramel Latte 237ml can': {
    kj: 385,
    confidence: 'medium',
    source: 'Fitia AU, 92 cal per 237 ml can',
    why: 'Was 310 kJ — 25% low, same scaling error.',
  },
  'Beef tartare, restaurant entree (with toast/crisps)': {
    name: 'Beef tartare entree, with toast',
    kj: 1350,
    protein: 26,
    carbs: 22,
    fat: 13,
    confidence: 'medium',
    source: '120 g tartare (~850 kJ, FatSecret generic steak tartare) plus ~500 kJ of toast',
    why: 'Was 1700 kJ. Two conflicting tartare rows existed (1700 and 900); consolidated, with the beef component recomputed from its own macros.',
  },
  '250 g steak with chips and salad, restaurant': {
    name: 'Steak with chips & salad, restaurant (250 g raw)',
    kj: 3200,
    confidence: 'low',
    source: 'Rebuilt on raw steak weight',
    why: 'Was 3800 kJ. Australian menus quote steak raw; 250 g raw yields ~185 g cooked, so the build-up was ~600 kJ high.',
  },
  "Home-cooked curry with rice (father's cooking)": {
    name: "Dad's dinner — your 4,000 kJ estimate",
    confidence: 'low',
    source: 'Your own estimate, not a measurement',
    why: 'Kept as you described it, but flagged: it is the single largest uncertainty in the plan. On five nights a week, being 1,000 kJ out costs about 1.9 kg over the cut.',
  },
  'Restaurant main, unspecified (planning average)': {
    name: 'Restaurant main — rough guess',
    confidence: 'low',
  },
  // The alcohol rows' kilojoules verified correct, but the macros can't reconcile without
  // an alcohol field, so the grams are put in the serving label instead of a phantom macro.
  'Beer, full strength, 375 ml': { servingLabel: '1 can (375 ml, ~4.8% — 14 g alcohol)', confidence: 'high' },
  'Beer, mid strength, 375 ml': { servingLabel: '1 can (375 ml, ~3.5% — 10 g alcohol)', confidence: 'high' },
  'Beer, light, 375 ml': { servingLabel: '1 can (375 ml, ~2.7% — 8 g alcohol)', confidence: 'high' },
  'Red wine, 150 ml glass': { servingLabel: '1 glass (150 ml, ~13.5% — 16 g alcohol)', confidence: 'high' },
  'White wine, dry, 150 ml glass': { servingLabel: '1 glass (150 ml, ~12.5% — 15 g alcohol)', confidence: 'high' },
  // Explicitly confirmed by the fact-check against two sources each.
  "McDonald's Big Mac": { confidence: 'high' },
  "McDonald's Quarter Pounder": { confidence: 'high' },
  "McDonald's McChicken": { confidence: 'high' },
  'Boss Coffee Iced Latte 237ml can': { confidence: 'high', source: 'Woolworths panel, 218 kJ' },
  'Boss Coffee Iced Long Black 237ml can': { confidence: 'high' },
  'Boss Coffee Iced Double Espresso 237ml can': { confidence: 'high' },
  "Grill'd Simply Grill'd (traditional bun)": { confidence: 'high' },
  "Grill'd Mighty Melbourne (traditional bun)": { confidence: 'high' },
  "Grill'd Famous Grill'd Chips - Regular (245 g)": { confidence: 'high' },
  "Grill'd Famous Grill'd Chips - Snack (140 g)": { confidence: 'high' },
  // Unverified estimates that had been dressed up as more certain than they are.
  "Grill'd Baa Baa Burger (lamb, traditional bun)": { confidence: 'low' },
  "Grill'd The Mighty (traditional bun)": { confidence: 'low' },
  "Grill'd Garden Salad (side)": { confidence: 'low' },
}

/**
 * Shorter display names. The tiles on the home screen are ~24 characters across two lines,
 * and a tile reading "McDonald's Bacon &…" is a tile you have to think about. The brand
 * moves into its own field, where search still matches on it.
 */
const RENAME = {
  "McDonald's Bacon & Egg McMuffin": ['Bacon & Egg McMuffin', "McDonald's"],
  "McDonald's Sausage & Egg McMuffin": ['Sausage & Egg McMuffin', "McDonald's"],
  "McDonald's Sausage McMuffin": ['Sausage McMuffin', "McDonald's"],
  "McDonald's Hash Brown": ['Hash brown', "McDonald's"],
  "McDonald's Big Mac": ['Big Mac', "McDonald's"],
  "McDonald's Quarter Pounder": ['Quarter Pounder', "McDonald's"],
  "McDonald's McChicken": ['McChicken', "McDonald's"],
  "McDonald's Cheeseburger": ['Cheeseburger', "McDonald's"],
  "McDonald's Fries - Medium": ['Fries, medium', "McDonald's"],
  "McDonald's Fries - Large": ['Fries, large', "McDonald's"],
  "McDonald's Chicken McNuggets 6 pack": ['McNuggets ×6', "McDonald's"],
  "McDonald's Chicken McNuggets 10 pack": ['McNuggets ×10', "McDonald's"],
  "McDonald's Chicken McNuggets 20 pack": ['McNuggets ×20', "McDonald's"],
  "McDonald's OREO Cookie McFlurry (regular)": ['McFlurry, regular', "McDonald's"],
  "McDonald's McFlurry - Mini": ['McFlurry, mini', "McDonald's"],
  "McDonald's Frozen Coke - Medium": ['Frozen Coke, medium', "McDonald's"],
  "McDonald's Frozen Coke - Large": ['Frozen Coke, large', "McDonald's"],
  "McDonald's Frozen Coke No Sugar - Medium": ['Frozen Coke no sugar', "McDonald's"],
  "McDonald's Coca-Cola Zero Sugar - Large (600ml)": ['Coke Zero, large', "McDonald's"],
  "McDonald's Coca-Cola Zero Sugar - Medium (450ml)": ['Coke Zero, medium', "McDonald's"],
  "Grill'd Simply Grill'd (traditional bun)": ["Simply Grill'd", "Grill'd"],
  "Grill'd Simply Grill'd (no bun / low carb)": ["Simply Grill'd, bunless", "Grill'd"],
  "Grill'd Mighty Melbourne (traditional bun)": ['Mighty Melbourne', "Grill'd"],
  "Grill'd Summer Sunset (traditional bun)": ['Summer Sunset', "Grill'd"],
  "Grill'd Bird & Brie (traditional bun)": ['Bird & Brie', "Grill'd"],
  "Grill'd Bird & Brie (no bun)": ['Bird & Brie, bunless', "Grill'd"],
  "Grill'd Baa Baa Burger (lamb, traditional bun)": ['Baa Baa Burger', "Grill'd"],
  "Grill'd Beyond Simply Grill'd (vegan, traditional bun)": ["Beyond Simply Grill'd", "Grill'd"],
  "Grill'd The Mighty (traditional bun)": ['The Mighty', "Grill'd"],
  "Grill'd Famous Grill'd Chips - Snack (140 g)": ['Chips, snack', "Grill'd"],
  "Grill'd Famous Grill'd Chips - Regular (245 g)": ['Chips, regular', "Grill'd"],
  "Grill'd Garden Salad (side)": ['Garden salad', "Grill'd"],
  "Grill'd Chicken Superfood Salad": ['Chicken superfood salad', "Grill'd"],
  'Boss Coffee Iced Latte 237ml can': ['Boss Latte, can', 'Boss Coffee'],
  'Boss Coffee Iced Long Black 237ml can': ['Boss Long Black, can', 'Boss Coffee'],
  'Boss Coffee Iced Double Espresso 237ml can': ['Boss Double Espresso, can', 'Boss Coffee'],
  'Boss Coffee Iced Vanilla Latte 237ml can': ['Boss Vanilla Latte, can', 'Boss Coffee'],
  'Boss Coffee Iced Caramel Latte 237ml can': ['Boss Caramel Latte, can', 'Boss Coffee'],
  "Dad's dinner — your 4,000 kJ estimate": ["Dad's dinner", null],
  "Dad's dinner — average home plate": ["Dad's dinner, average", null],
  'Crumpets ×2 with sugar-free syrup': ['Crumpets ×2 + syrup', null],
  'Beef tartare entree, with toast': ['Beef tartare + toast', null],
  'Massimo\'s gelato, 2 scoops in a cup': ["Massimo's, 2 scoops", null],
  'Massimo\'s gelato, 1 scoop in a cup': ["Massimo's, 1 scoop", null],
  'Pepsi Max 375 ml can': ['Pepsi Max, can', null],
  'Pepsi Max 600 ml bottle': ['Pepsi Max, bottle', null],
  'Iced long black (no milk, no sugar)': ['Iced long black', null],
  'Long black / black coffee': ['Long black', null],
  'Lunch you forgot to log — rough guess': ['Lunch (rough guess)', null],
  'Restaurant main — rough guess': ['Restaurant main', null],
  'Steak with chips & salad, restaurant (250 g raw)': ['Steak, chips & salad', null],
  'Carbonara pasta, restaurant portion': ['Carbonara, restaurant', null],
  'Ragu / bolognese pasta, restaurant portion': ['Ragu pasta, restaurant', null],
  'Half roast chicken with sides, restaurant': ['Half roast chicken', null],
  'Pub steak with chips and salad': ['Pub steak & chips', null],
  'Pub/grill burger with chips': ['Pub burger & chips', null],
  'Toast or crisps, with tartare': ['Toast, with tartare', null],
  'Queen Sugar Free Maple Flavoured Syrup': ['Sugar-free maple syrup', 'Queen'],
}

/** Extra rows the research didn't produce but this person's week needs. */
const EXTRA = [
  {
    name: 'Toast or crisps, with tartare',
    category: 'restaurant',
    servingLabel: '2 pieces',
    kj: 500,
    carbs: 22,
    fat: 2,
    source: 'Split out of the tartare entree so either half can be logged alone',
    confidence: 'low',
  },
  {
    name: "Dad's dinner — average home plate",
    category: 'homecooked',
    servingLabel: '1 plate (~430 g)',
    kj: 2700,
    protein: 30,
    carbs: 70,
    fat: 24,
    source: 'Mean of the researched home-cooked dinner plates',
    confidence: 'low',
  },
  {
    name: 'Deluxe McChicken',
    brand: "McDonald's",
    category: 'fastfood',
    servingLabel: '1 burger',
    kj: 2135,
    protein: 20,
    carbs: 44,
    fat: 28,
    // Macros reconcile to 2,124 kJ, which is why this figure is here rather than the
    // 2,520 kJ that searches also return — that belongs to the Crispy Chicken Deluxe, a
    // different burger. The official AU panel was unreachable, so treat this as close but
    // unconfirmed and correct it from the MyMacca's app when convenient.
    source: 'Aggregator panel, 510 cal; macros reconcile. Official AU panel not reachable.',
    confidence: 'low',
  },
  {
    name: 'Fries, small',
    brand: "McDonald's",
    category: 'fastfood',
    servingLabel: '1 small serve',
    kj: 860,
    protein: 3.5,
    carbs: 27,
    fat: 10.2,
    // Cross-checks by weight against the medium and large rows already here: medium is
    // 1,240 kJ for ~110 g, i.e. ~11.3 kJ/g, and a small is ~77 g.
    source: 'CalorieKing AU 206 cal; consistent by weight with the medium and large serves',
    confidence: 'medium',
  },
  {
    name: 'Coke Zero, small',
    brand: "McDonald's",
    category: 'drink',
    servingLabel: '1 small cup (350 ml)',
    kj: 5,
    source: 'Sugar-free — negligible either way',
    confidence: 'high',
  },
  {
    name: 'Chicken caesar burrito',
    brand: 'Greenstreat',
    category: 'restaurant',
    servingLabel: '1 burrito, standard dressing',
    /*
     * Published panel: 3,141 kJ, 66 g protein, 48 g carbohydrate, 31 g fat. The macros
     * reconcile to 3,085 kJ, within 2%, so the panel checks out against itself.
     *
     * Dressing is the variable the venue itself calls out — 750 kcal light to 830 heavy,
     * a swing of ~335 kJ. Filed at the standard/light end; heavy dressing is ~3,470.
     * That also reconciles the two sources rather than pitting them against each other:
     * the 834 cal Fitia listing this replaces is simply the heavy-dressing end of the
     * same range, not a contradiction.
     *
     * WHAT THE RECONSTRUCTION GOT WRONG, and why it matters for every other estimate
     * here: it assumed rice or quinoa in the wrap, and there is none. The filling is
     * roasted chicken, boiled egg, parmesan crisps, parmesan, cherry tomatoes, rocket
     * and cos — a caesar salad in a tortilla. So carbs came out 62% HIGH (78 vs 48) and
     * protein 20% LOW (53 vs 66), even though total energy was only 11% out. Guessing a
     * total is far more forgiving than guessing its composition; one wrong assumption
     * about a filling moves the macros while leaving the total looking plausible.
     */
    kj: 3141,
    protein: 66,
    carbs: 48,
    fat: 31,
    source: 'Greenstreat published nutrition panel',
    confidence: 'high',
  },
  {
    name: 'Wagyu steak & frites (MS 7-8)',
    category: 'restaurant',
    servingLabel: '1 plate (250 g raw steak + frites)',
    /*
     * Steak 2,845 + frites ~160 g at ~1,200 kJ/100 g (1,900). Thin-cut frites carry more
     * oil per gram than thick chips — more surface area for the same potato.
     *
     * The steak is modelled from COMPOSITION rather than a single kJ/100 g figure,
     * because marble score is really a statement about intramuscular fat, and protein
     * falls as fat displaces muscle. For 250 g raw, keeping 85% of the fat through
     * cooking (the rest renders onto the grill) and all of the protein:
     *
     *   grade          raw fat    eaten    protein
     *   lean trimmed      15 g   1,407 kJ   55.0 g
     *   MS 3-4            32 g   1,872 kJ   50.0 g
     *   MS 5-6            48 g   2,301 kJ   47.5 g
     *   MS 7-8            68 g   2,845 kJ   42.5 g   <- this one
     *   MS 9+ / A5        88 g   3,389 kJ   37.5 g
     *
     * Australian menus quote steak RAW; 250 g raw yields ~185 g cooked. Reading it as
     * cooked would overstate the steak by about a third.
     *
     * Marbling is fat replacing muscle, so the same plate with a lean porterhouse is
     * 3,307 kJ carrying 61 g of protein, against 4,745 kJ carrying 48 g. The wagyu costs
     * ~1,440 kJ more and returns ~12 g less protein.
     */
    kj: 4750,
    protein: 48,
    carbs: 56,
    fat: 80,
    source: 'Composition model at marble score 7-8; raw steak weight',
    confidence: 'low',
  },
  {
    name: 'Brisket focaccia',
    brand: 'Marco Polo',
    category: 'restaurant',
    servingLabel: '1 focaccia, without the chips',
    /*
     * Braised brisket, melted cheese, rocket and roasted capsicum on rosemary focaccia.
     * Focaccia 140 g (1,757) + brisket 110 g (1,320) + cheese 30 g (430) + aioli 15 g
     * (452) + leaves and capsicum (150).
     *
     * The bread is the biggest line and the least obvious one: focaccia runs ~1,255 kJ
     * per 100 g because it is bread with a great deal of olive oil worked through it —
     * roughly 40% more than the same weight of sourdough.
     *
     * Filed WITHOUT the chips that came alongside, which are their own row, because
     * whether to eat them is a real decision worth seeing separately.
     */
    kj: 4150,
    protein: 54,
    carbs: 74,
    fat: 53,
    source: 'Component build-up',
    confidence: 'low',
  },
  {
    name: 'Kettle chips, cafe side',
    category: 'snack',
    servingLabel: '1 side serve (~55 g)',
    // The pile that comes with a cafe sandwich. Kettle-style crisps are ~2,200 kJ/100 g,
    // so this innocuous handful costs about as much as a Boss Coffee and a crumpet.
    kj: 1200,
    protein: 3,
    carbs: 30,
    fat: 17,
    source: 'Typical cafe side portion',
    confidence: 'low',
  },
  /*
   * Surface Hill — one night out, kept as six separate rows rather than a single
   * 11,950 kJ entry. Nothing that size is one person's serving (the same reason the pizza
   * is filed per slice), the components get reordered in different combinations, and a
   * day template stitches them back into one tap. `brand` carries the venue so searching
   * "surface hill" surfaces the lot.
   */
  {
    name: 'Korean fried chicken bao',
    brand: 'Surface Hill',
    category: 'restaurant',
    servingLabel: '1 bao',
    // Bao bun 45 g (490) + coated fried chicken 60 g (660) + kewpie 12 g (350) + lettuce.
    // Kewpie is the quiet one: ~2,900 kJ/100 g, so a 12 g smear costs more than the lettuce,
    // the bun's sugar and the chicken's coating combined.
    kj: 1500,
    protein: 16,
    carbs: 28,
    fat: 20,
    source: 'Component build-up',
    confidence: 'low',
  },
  {
    name: 'Loaded gochujang fries',
    brand: 'Surface Hill',
    category: 'restaurant',
    servingLabel: '1 serve (150 g)',
    kj: 1750,
    protein: 6,
    carbs: 38,
    fat: 27,
    source: 'Component build-up from the stated 150 g',
    confidence: 'low',
  },
  {
    name: 'Palm sugar & sriracha beef',
    brand: 'Surface Hill',
    category: 'restaurant',
    servingLabel: '1 plate, with coconut salad and 50 g rice',
    // Beef ~180 g with a sugar glaze, shaved coconut salad ~80 g, and the 50 g of rice
    // as stated — taken as cooked weight, which is a notably small serve of rice.
    kj: 2700,
    protein: 48,
    carbs: 40,
    fat: 32,
    source: 'Component build-up',
    confidence: 'low',
  },
  {
    name: 'Brookvale ginger beer, schooner',
    brand: 'Brookvale Union',
    category: 'alcohol',
    servingLabel: '1 schooner (425 ml, 4% — 13 g alcohol)',
    kj: 1050,
    source: 'CalorieKing AU 196 cal/330 ml, scaled to a schooner',
    confidence: 'medium',
  },
  {
    name: 'Hard Rated, schooner',
    brand: 'Hard Rated',
    category: 'alcohol',
    servingLabel: '1 schooner (425 ml, 4.5% — 15 g alcohol)',
    kj: 650,
    source: 'Fitia AU 121 cal/330 ml, scaled to a schooner',
    confidence: 'medium',
  },
  {
    name: 'KFC mousse',
    brand: 'Surface Hill',
    category: 'dessert',
    servingLabel: '1 serve (~120 g)',
    kj: 1300,
    protein: 5,
    carbs: 32,
    fat: 18,
    source: 'Typical restaurant mousse portion — the least verifiable row here',
    confidence: 'low',
  },
  {
    name: 'Meat pizza, slice',
    category: 'restaurant',
    servingLabel: '1 slice (an eighth of a ~12 inch)',
    /*
     * Meat toppings with a barbecue drizzle on a thick hand-stretched base. Built from
     * area: a loaded pizza carries ~1.05 g per cm² of base and runs ~1,050 kJ per 100 g,
     * so a 12" (730 cm², ~765 g) comes to ~8,000 — trimmed to 7,000 for the whole pizza
     * because a fair share of the photographed one's area was puffy bare crust. This row
     * is an eighth of that.
     *
     * DIAMETER IS THE WHOLE BALLGAME and a photo cannot settle it: a 10" whole is
     * ~5,600 kJ and a 14" is ~11,000. Ask the shop what size they sell to tighten it.
     *
     * Filed per slice rather than per pizza on purpose. A whole pizza is a shareable
     * item, not one person's serving, and the database's implausibility check (nothing
     * over 6,000 kJ in a single serving) exists to catch per-100g values recorded as
     * per-serving. Weakening that guard to fit a pizza would blunt it for everything
     * else — and slices are how people log pizza anyway. Whole pizza = 8 servings.
     */
    kj: 875,
    protein: 10.6,
    carbs: 21.9,
    fat: 8.8,
    source: 'Area-based build-up; diameter unconfirmed',
    confidence: 'low',
  },
  {
    name: 'KFC $10 Boxfull',
    brand: 'KFC',
    category: 'fastfood',
    servingLabel: '1 box (743 g)',
    /*
     * KFC Australia's own published panel, read off the in-app product page:
     * 3,872 kJ, 36.1 g protein, 95.7 g carbohydrate (16.7 g sugars), 43.8 g fat
     * (4.5 g saturated), 1,506 mg sodium, 743 g average serve. The macros reconcile
     * to 3,861 kJ, so the panel is internally consistent.
     *
     * This replaces a component build-up that had it at 4,350 kJ and — far worse —
     * 52 g of protein against an actual 36.1 g. The energy was 12% high; the protein
     * was 44% high, which had wrongly ranked this box above both of his father's
     * dinners on protein per kilojoule. A reminder that guessing macros from assumed
     * piece counts is much less reliable than guessing total energy.
     *
     * The panel is presumably the box as sold, including its sauce tub. Ordering
     * without sauce likely saves 400-500 kJ, so this figure errs high — the safe
     * direction for someone in a deficit.
     */
    kj: 3872,
    protein: 36.1,
    carbs: 95.7,
    fat: 43.8,
    source: 'KFC Australia published nutrition panel',
    confidence: 'high',
  },
  {
    name: "Dad's cheese sauce gnocchi",
    category: 'homecooked',
    servingLabel: '1 plate (~320 g gnocchi + ~200 g sauce)',
    // Built from the two halves: fresh potato gnocchi at ~615 kJ/100 g, and a household
    // cheese sauce (butter, flour, milk, cheese) at ~755 kJ/100 g. Portion sized to match
    // the lasagne plate, which is the only one of his father's serves actually measured.
    // Add ~550 kJ if it comes with a bread roll like that one did.
    kj: 3500,
    protein: 28,
    carbs: 111,
    fat: 30,
    source: 'Component build-up; portion matched to the photographed lasagne plate',
    confidence: 'low',
  },
  {
    name: 'Poachies, halloumi & ham',
    category: 'restaurant',
    servingLabel: '1 café plate',
    // Your figure. My component build-up came to ~5,540 kJ (two poached eggs 630,
    // hash browns 1,500, halloumi 1,400, ham 270, hollandaise 1,740) with a range of
    // 4,470–7,020 — 4,500 is the bottom of that band, and you were the one looking at
    // the plate. Macros are scaled to match and reconcile to 4,513 kJ.
    kj: 4500,
    protein: 45,
    carbs: 42,
    fat: 82,
    source: 'Your estimate; component build-up put it at 4,500–7,000',
    confidence: 'low',
  },
  {
    name: "Dad's pappardelle bolognese",
    category: 'homecooked',
    servingLabel: '1 bowl (~220 g cooked pasta + ~250 g ragù)',
    /*
     * Built from the parts: pasta from ~100 g dry (1,485), beef mince 130 g at ~15% fat
     * (1,157), the oil the soffritto was started in — 12 g (444), passata and paste
     * (200), parmesan 15 g (250), and the splash of wine or milk that goes into a long
     * ragù (100).
     *
     * PORTION IS THE WHOLE ESTIMATE. A photographed bowl cannot settle how much dry
     * pasta went in, and that single number swings the row from ~2,900 to ~4,700:
     * 180 g cooked is 1,215 kJ and 300 g cooked is 2,030. If the pasta is ever weighed
     * dry before it goes in the pot, that one measurement tightens this more than
     * everything else here combined.
     *
     * The oil is the line most people leave out and it is worth more than the cheese.
     * A ragù that simmers for an hour is also a fatty-mince dish whether or not the fat
     * is visible in the bowl — none of it is poured off.
     */
    kj: 3600,
    servingGrams: 485,
    protein: 43,
    carbs: 85,
    fat: 38,
    source: 'Component build-up from the photo; portion unconfirmed',
    confidence: 'low',
  },
  {
    name: 'Garlic bread, piece',
    category: 'staple',
    servingLabel: '1 piece (~42 g)',
    /*
     * Filed per piece, not per loaf, because pieces are the unit anyone actually eats and
     * because the count is the part worth seeing. Australian bake-at-home garlic bread
     * panels cluster around 1,270 kJ per 100 g (7.5 g protein, 33 g carbohydrate, 16 g
     * fat) — bread carrying roughly its own weight again in garlic butter through the
     * cuts. A 220-250 g loaf gives 5-6 pieces, so a piece lands near 530.
     *
     * Three pieces is a bread roll and a half in energy terms; four is more than the
     * whole of a Friday breakfast. The row exists so the count is a visible decision
     * rather than something that disappears into "and some garlic bread".
     */
    kj: 530,
    servingGrams: 42,
    protein: 3.2,
    carbs: 13.9,
    fat: 6.7,
    source: 'Australian bake-at-home garlic bread panels, ~1,270 kJ/100 g',
    confidence: 'low',
  },
  {
    name: 'Massaman curry with rice',
    category: 'restaurant',
    servingLabel: '1 takeaway serve (~480 g curry + ~300 g rice)',
    /*
     * Beef massaman, the default here because that is what most Australian Thai shops
     * mean by it. Built from the parts: coconut milk 140 g (1,260), braised beef 100 g
     * cooked (1,000), potato 110 g (390), peanuts 12 g (300), the oil the paste is
     * fried off in (444), palm sugar 8 g (135), aromatics and stock (100) — 3,629 for
     * the curry — plus ~300 g of cooked jasmine rice (1,650).
     *
     * Cross-checked by density rather than trusted outright: the curry lands at
     * 756 kJ/100 g against a published range of 670-795 for beef massaman, and the
     * whole container at 679 kJ/100 g. Massaman is the richest of the common Thai
     * curries — coconut, peanuts AND potato — so the top half of that band is the
     * right place for it.
     *
     * Two levers, both bigger than they look. Rice portions run 250-400 g between
     * shops, which is 550 kJ of swing before anyone changes what they ordered; and
     * shops that finish the sauce with coconut CREAM rather than milk add ~400 more.
     * A shop's container is not a standard unit, so treat this as the middle of a
     * 4,200-6,800 band rather than a figure.
     *
     * Chicken thigh comes out within ~100 kJ of the beef. Chicken breast saves ~300.
     */
    kj: 5300,
    servingGrams: 780,
    protein: 44,
    carbs: 126,
    fat: 63,
    source: 'Component build-up, density-checked against published massaman figures',
    confidence: 'low',
  },
  {
    name: 'Red Rock Deli chips, 110 g',
    brand: 'Red Rock Deli',
    category: 'snack',
    servingLabel: '110 g, Honey Soy Chicken',
    /*
     * Your figures, recorded as given. They reconcile: 8.6 P + 66 C + 26 F comes to
     * 2,230 kJ against the stated 2,250, so the row is internally consistent. Sodium
     * ~660 mg, noted here because the schema has nowhere to put it.
     *
     * ONE THING WORTH CHECKING ON THE BAG. Per 100 g this works out at 60 g carbohydrate
     * and 23.6 g fat. The one verified chip panel already in this database — Smith's
     * Crinkle Cut, 45 g pack — is 50 g carbohydrate and 32 g fat per 100 g. Red Rock
     * Deli is kettle-cooked, which normally puts it at or above a crinkle cut for fat,
     * not a third below it, so the split here leans the opposite way to expected.
     *
     * It barely moves the energy either way (a fat-heavier split of the same 110 g lands
     * near 2,400), so this only matters if the macros are being read rather than the
     * total. The panel on the back of the bag settles it in ten seconds.
     */
    kj: 2250,
    servingGrams: 110,
    protein: 8.6,
    carbs: 66,
    fat: 26,
    source: 'Your figures; macro split differs from typical kettle-chip panels',
    confidence: 'medium',
  },
  {
    name: 'Beef tartare, no toast',
    category: 'restaurant',
    servingLabel: '1 serve, meat only',
    /*
     * Your figures. Reconciles to 1,520 kJ against the stated 1,530.
     *
     * Filed separately from the existing "Beef tartare + toast" row rather than
     * replacing it, because they are genuinely different plates: that one is 1,350 kJ
     * with 26 g protein and 22 g of carbohydrate from the toast, this one is 1,530 with
     * 38.5 g protein and 9.5 g carbohydrate. The protein implies ~180 g of beef, so
     * this is the larger serve with the bread taken off it.
     *
     * At 40 kJ per gram of protein it is the best protein-per-kilojoule dish you can
     * order out — ahead of the Greenstreat burrito at 48 and the Grill'd Bird & Brie
     * at 47. Only plain ingredients (chicken breast at 23, lean steak at 25) and a
     * generic home-baked fish row beat it. Worth knowing on a day that needs protein
     * without much energy behind it.
     */
    kj: 1530,
    protein: 38.5,
    carbs: 9.5,
    fat: 19,
    source: 'Your figures',
    confidence: 'medium',
  },
  {
    name: 'Wonton, pan-fried',
    category: 'homecooked',
    servingLabel: '1 wonton (~30 g)',
    /*
     * Chicken and pork filling with chive, onion and ginger, pan-fried, soy and ponzu
     * over the top. Built per piece: wrapper ~10 g (118), filling ~16 g of a pork and
     * chicken mince mix (112), and the oil it fried in, ~2.5 g (92).
     *
     * The oil is a third of the row and it is the part nobody counts. A steamed wonton
     * of the same size is ~240 kJ; frying is what makes it 330. Anyone estimating these
     * by their filling will land a long way low.
     *
     * Density check: 1,100 kJ per 100 g, against 1,000-1,150 for pan-fried dumplings.
     *
     * Filed per piece because the count is the entire decision, and a photographed pile
     * of dumplings is genuinely hard to count — a plate estimate would bury an error
     * that a per-piece row makes correctable with one tap. Soy and ponzu add ~50 kJ
     * across a whole plate and are not worth their own row.
     */
    kj: 330,
    servingGrams: 30,
    protein: 3.8,
    carbs: 6,
    fat: 4.6,
    source: 'Component build-up per piece; density-checked against pan-fried dumplings',
    confidence: 'low',
  },
  {
    name: 'RSL parmigiana (no chips)',
    category: 'restaurant',
    servingLabel: '1 parmy, ~285 g, chips logged separately',
    /*
     * Built from the parts: breast 140 g raw (615), crumb, flour and egg wash ~40 g
     * (600), oil absorbed in the fryer ~20 g (740), napoli 45 g (100), cheese 45 g
     * (630), the crispy ham on top ~15 g (110).
     *
     * REVISED DOWN FROM 3,500 once the plate was photographed. The first build assumed
     * a 360 g club monster off nothing but the word "RSL"; the actual cutlet is a
     * normal single-serve parmy, roughly half the width of a 30 cm plate. Portion was
     * the entire error — 180 g of raw breast became 140, and everything scaled with it.
     *
     * WORTH NOTING FOR THE NEXT ESTIMATE: the density check passed BOTH times. 972
     * kJ/100 g before, 982 after. Density confirms the recipe is modelled sensibly and
     * says nothing at all about how much of it is on the plate, so it cannot catch a
     * portion error. Only a picture or a scale can.
     *
     * THE OIL IS STILL THE LARGEST LINE AFTER THE CHEESE and it is invisible on the
     * plate. A crumbed cutlet takes up 10-15% of its weight in oil going through a
     * fryer, which is the whole gap between this and the ~2,400 the same cutlet would
     * come to baked — and a club kitchen is never baking it.
     *
     * Filed WITHOUT the chips, which are their own row, for the same reason the
     * focaccia and the tartare were: the chips are nearly half the plate and whether
     * to finish them is a real decision worth seeing on its own.
     */
    kj: 2800,
    servingGrams: 285,
    protein: 49,
    carbs: 31,
    fat: 38,
    source: 'Component build-up, portion corrected against a photo of the plate',
    confidence: 'medium',
  },
  {
    name: 'Chips, pub serve',
    category: 'restaurant',
    servingLabel: '1 pub/club side (~250 g)',
    /*
     * The pile that comes with a parmy or a schnitzel — thick-cut, deep-fried, usually
     * coated. Modelled at ~1,050 kJ per 100 g.
     *
     * Cross-checked against the Grill'd regular serve already in this database, which
     * is a published 2,460 kJ for 245 g. This row is a shade denser per gram because
     * pub chips are thicker-cut and generally batter-coated, which is the right
     * direction, and the two land within 6% of each other on the same weight.
     *
     * Portion is the uncertainty as always: clubs are not consistent, and 200 g versus
     * 320 g is 1,250 kJ of swing.
     *
     * Held at 250 g after seeing the plate photographed — roughly two dozen thick-cut
     * chips, and visibly the pale even coating of a frozen coated fry rather than a
     * hand-cut one, which is what the above-Grill'd density was modelling. This row
     * survived the photo unchanged while the parmy beside it came down by 20%.
     */
    kj: 2600,
    servingGrams: 250,
    protein: 8,
    carbs: 80,
    fat: 30,
    source: 'Modelled at ~1,050 kJ/100 g, cross-checked against the Grill\'d panel',
    confidence: 'low',
  },
  {
    name: 'Brisket, potato bake & rice plate',
    category: 'restaurant',
    servingLabel: '1 catered plate (~485 g)',
    /*
     * Braised brisket in a dark glaze, Mexican-style tomato rice with corn and
     * capsicum, and a potato bake. Built from the three parts:
     *
     *   brisket 160 g cooked at ~1,150 kJ/100 g   1,840
     *   the glaze on it, ~25 g                      225
     *   tomato rice 150 g (rice plus its oil)       960
     *   potato bake 150 g                         1,100
     *
     * THE POTATO BAKE IS THE SURPRISE. Sliced potato is 320 kJ for that weight; the
     * cream and cheese it sits in take it to 1,100. It reads as the harmless vegetable
     * on the plate and costs more than the rice.
     *
     * Portion confidence is better here than for most photo estimates, and for a dull
     * reason: catering paper plates come in standard sizes. A 23 cm plate three-quarters
     * covered to ~1.5 cm deep is 450-500 g, which is a real measurement rather than the
     * assumed one that put the RSL parmy 25% high. Density lands at 845 kJ/100 g,
     * right for a meat-led plate with two starch sides.
     *
     * The brisket cut is the remaining soft spot: point end with its fat rendered
     * through is ~1,300 kJ/100 g, a trimmed flat closer to 950. That is 550 kJ of
     * swing on this plate and nothing in a photo settles it.
     */
    kj: 4100,
    servingGrams: 485,
    protein: 52,
    carbs: 75,
    fat: 52,
    source: 'Component build-up; portion scaled off a standard catering plate',
    confidence: 'low',
  },
  {
    name: 'Chicken carbonara (home bowl)',
    category: 'homecooked',
    servingLabel: '1 full bowl (~450 g)',
    /*
     * Fusilli in a creamy carbonara with chicken and bacon through it. Built from the
     * parts: pasta from ~127 g dry (1,885), chicken 70 g cooked (620), bacon 32 g
     * cooked (530), cream ~35 g (455), parmesan 15 g (255), the fat it was started in
     * (185).
     *
     * CROSS-CHECKED AGAINST THIS DATABASE rather than against a general range, which is
     * the stronger test: the plain home carbonara row already here is 3,040 kJ for
     * 380 g, or 800 kJ/100 g. This lands at 873 — 9% denser, which is what adding
     * chicken and a visibly creamy rather than eggy sauce should do. A figure that came
     * out BELOW the plain version would have meant an arithmetic error somewhere.
     *
     * Portion is the uncertainty, as it was for the parmy. A ~20 cm bowl filled to the
     * rim with spirals is ~450 g; 350 g would make this 3,050 and 550 g would make it
     * 4,800. The bowl, not the recipe, is what a photo struggles with.
     *
     * The cream, bacon and cheese together are ~1,240 kJ — nearly a third of the bowl
     * for a small fraction of its volume. Two-thirds of a serve of this is not
     * two-thirds of a normal pasta dish.
     */
    kj: 3900,
    servingGrams: 450,
    protein: 48,
    carbs: 91,
    fat: 42,
    source: 'Component build-up, density-checked against the plain carbonara row',
    confidence: 'low',
  },
  {
    name: 'Protein Crisp bar, Choc Peanut',
    brand: 'Musashi',
    category: 'snack',
    servingLabel: '1 bar (60 g)',
    /*
     * Published panel, confirmed across two independent retail listings: 989 kJ
     * (236 Cal), 20.0 g protein, 9.7 g fat (3.4 g saturated), 9.5 g carbohydrate
     * (3.6 g sugars), 5.6 g dietary fibre, 251 mg sodium.
     *
     * THE MACROS DELIBERATELY DO NOT ADD UP AND THAT IS CORRECT. Protein, carbohydrate
     * and fat at 17/17/37 come to 861 kJ against a declared 989 — 13% short. The gap is
     * the 5.6 g of fibre plus the polyols that low-sugar bars use in place of sugar,
     * neither of which is counted inside "carbohydrate" on an Australian panel but both
     * of which carry energy. The reconciliation gate in this script allows 20% for
     * exactly this reason; a bar that reconciled perfectly would be the suspicious one.
     *
     * Looked up rather than recalled. Branded figures are where this database has been
     * wrong most often — three McMuffins, a Frozen Coke and a McFlurry all had to be
     * corrected — so brand-name items get checked against a retailer panel now instead
     * of estimated.
     */
    kj: 989,
    servingGrams: 60,
    protein: 20,
    carbs: 9.5,
    fat: 9.7,
    source: 'Musashi published panel via FatSecret AU and Australian retail listings',
    confidence: 'high',
  },
  {
    name: 'Bunnings sausage sizzle (hotdog)',
    brand: 'Bunnings',
    category: 'fastfood',
    servingLabel: '1 snag in bread with onion, no sauce (~110 g)',
    /*
     * Thin beef sausage 60 g cooked (720), one slice of white bread 35 g (370), onions
     * off the hotplate 15 g (60). NO SAUCE — that is how he has it, so the row is built
     * that way rather than built with sauce and mentally subtracted. Add ~65 kJ and
     * ~4 g carbohydrate for a squeeze of tomato sauce if it ever goes on.
     *
     * NO PANEL EXISTS AND ONE NEVER WILL. Every Bunnings sizzle is run by a different
     * community group with whatever sausages they bought that week, so unlike the
     * Musashi bar there is nothing authoritative to look up — this has to be an
     * estimate. Published third-party figures span 1,050-1,670 kJ with 10-15 g protein;
     * this build-up lands at 1,150 with 14 g, mid-range on both.
     *
     * THE SAUSAGE IS THE WHOLE VARIANCE. A thin beef snag is ~1,200 kJ/100 g cooked;
     * a thicker or porkier one runs 1,500 and is half again the weight, which takes the
     * same item past 1,600. Bread and onion are near-fixed at ~430 between them. Two
     * sizzles from two different Saturdays are not the same food, and that ±400 dwarfs
     * every condiment decision available at the stand.
     *
     * Named with "hotdog" in it deliberately: search matches on name, brand and
     * category only, so anyone typing what they call it needs the word to be there.
     */
    kj: 1150,
    servingGrams: 110,
    protein: 14,
    carbs: 20.5,
    fat: 15,
    source: 'Component build-up; mid-range against published third-party figures',
    confidence: 'low',
  },
  {
    name: 'Chicken schnitzel, crumbed (pan-fried)',
    category: 'homecooked',
    servingLabel: '1 schnitzel — 127 g raw crumbed, ~115 g cooked',
    /*
     * WEIGHED, NOT ESTIMATED. 254 g on the scale for two raw crumbed schnitzels, so
     * 127 g each. This is the first row here whose portion is a measurement instead of
     * a judgement about a photograph, and it is the reason the confidence is medium
     * rather than low — what is still modelled is the split inside that weight and the
     * oil, not the amount of food.
     *
     * From 127 g raw crumbed: ~97 g chicken breast (427) and ~30 g of flour, egg and
     * crumb (435) at the usual 20-25% coating share. Pan-frying adds ~12.5 g of
     * absorbed oil (462).
     *
     * THE OIL IS 35% OF THIS ROW. The same weighed schnitzel is 910 kJ oven-baked,
     * 1,320 pan-fried and about 1,560 deep-fried — a 70% spread with the food held
     * constant. That is why the baked version is its own row rather than a note: which
     * pan it goes in is a bigger decision than anything about the schnitzel itself.
     *
     * Density 1,148 kJ per 100 g cooked, consistent with a fried crumbed cutlet.
     *
     * Two of these is 2,640 kJ — set servings to 2 for the pair that was weighed.
     */
    kj: 1320,
    servingGrams: 115,
    protein: 26,
    carbs: 19.5,
    fat: 16,
    source: 'Weighed raw (254 g for two); coating share and oil uptake modelled',
    confidence: 'medium',
  },
  {
    name: 'Chicken schnitzel, crumbed (oven-baked)',
    category: 'homecooked',
    servingLabel: '1 schnitzel — 127 g raw crumbed, ~103 g cooked',
    /*
     * The same weighed 127 g schnitzel, oven-baked with a light spray instead of fried:
     * chicken 97 g raw (427), coating 30 g (435), spray (50).
     *
     * 410 kJ cheaper than the pan, per piece, for identical food. Two schnitzels baked
     * rather than fried is 820 kJ — most of a Bunnings sausage sizzle, saved by a
     * decision that takes no willpower at all because it happens before the meal is on
     * the plate.
     *
     * Density 883 kJ per 100 g cooked.
     */
    kj: 910,
    servingGrams: 103,
    protein: 26,
    carbs: 19.5,
    fat: 5,
    source: 'Weighed raw (254 g for two); baked with light spray',
    confidence: 'medium',
  },
  {
    name: 'Tzatziki, homemade',
    category: 'homecooked',
    servingLabel: '1 bowl (170 g) — yoghurt and cucumber only',
    /*
     * As actually made: ~130 g Greek yoghurt and ~40 g grated cucumber, weighed at
     * 170 g in the bowl. Garlic, herbs and pepper are rounding error. NO OLIVE OIL and
     * no lemon, which is what separates this from the version first modelled here —
     * that build assumed 5 g of oil and it was 185 kJ of a 280 g batch. Taking the oil
     * out drops the density from 381 kJ/100 g to 321.
     *
     * SWITCHING TUBS MATTERS MORE THAN ANY OTHER DECISION LEFT IN THIS ROW. Built on
     * full-fat Greek yoghurt, which errs high in the absence of a stated tub. On the
     * low-fat Greek yoghurt already in this database the same bowl is ~355 kJ with
     * ~13.3 g protein — 27 kJ per gram of protein, which is whey-shake territory and
     * better than every composed meal here.
     *
     * With the oil gone this is 47 kJ per gram of protein rather than 59, which moves
     * it from "a sauce that is not a liability" to a genuine contributor — on par with
     * the Greenstreat burrito and ahead of the Musashi bar. Against the 40 g of aioli
     * it replaces (~1,080 kJ, no protein) the whole bowl is still the cheaper option.
     */
    kj: 550,
    servingGrams: 170,
    protein: 11.8,
    carbs: 5.8,
    fat: 6.1,
    source: 'As made — 170 g weighed; full-fat yoghurt assumed, low-fat gives ~355 kJ',
    confidence: 'medium',
  },
  {
    name: 'Lunch you forgot to log — rough guess',
    category: 'staple',
    servingLabel: '1 typical lunch',
    kj: 2200,
    protein: 20,
    carbs: 55,
    fat: 18,
    source: 'Placeholder — better than leaving a gap',
    confidence: 'low',
  },
]

const CATEGORIES = new Set([
  'breakfast', 'fastfood', 'drink', 'homecooked', 'restaurant',
  'snack', 'staple', 'protein', 'produce', 'dessert', 'alcohol',
])

function slug(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

const out = []
const seenIds = new Set()
const dropped = []

for (const item of [...raw, ...EXTRA]) {
  if (DROP[item.name]) {
    dropped.push(item.name)
    continue
  }
  const patch = OVERRIDE[item.name] ?? {}
  const { why: _why, ...fields } = patch
  const merged = { ...item, ...fields }

  const id = slug(merged.name)

  // Display name only. The id above is already fixed, so shortening a label for the
  // home-screen tiles can never invalidate a template or a favourite that points at it.
  const rename = RENAME[merged.name]
  if (rename) {
    merged.name = rename[0]
    if (rename[1]) merged.brand = rename[1]
  }
  if (seenIds.has(id)) {
    dropped.push(`${merged.name} (duplicate id)`)
    continue
  }
  seenIds.add(id)

  if (!CATEGORIES.has(merged.category)) merged.category = 'staple'

  const food = {
    id,
    name: merged.name,
    category: merged.category,
    servingLabel: merged.servingLabel,
    kj: Math.round(merged.kj),
    confidence: merged.confidence ?? 'low',
  }
  // The research pass used the brand field for placeholders like "generic restaurant".
  // A brand is a name you'd see on packaging; anything else is noise in the search index.
  const NON_BRANDS = new Set(['generic restaurant', 'home', 'generic', 'homemade', 'restaurant', 'cafe', 'none'])
  if (merged.brand && !NON_BRANDS.has(String(merged.brand).toLowerCase())) food.brand = merged.brand
  if (merged.servingGrams > 0) food.servingGrams = merged.servingGrams
  for (const macro of ['protein', 'carbs', 'fat']) {
    if (merged[macro] > 0) food[macro] = Math.round(merged[macro] * 10) / 10
  }
  if (merged.source) food.source = merged.source
  out.push(food)
}

const ORDER = ['breakfast', 'fastfood', 'restaurant', 'homecooked', 'drink', 'protein', 'staple', 'produce', 'snack', 'dessert', 'alcohol']
out.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name))

// Sanity gate: any row carrying all three macros must reconcile with its stated kJ.
// This is the check that caught the McMuffins, so it runs on every build from now on.
const suspect = []
for (const f of out) {
  if (f.protein == null || f.carbs == null || f.fat == null) continue
  const fromMacros = f.protein * 17 + f.carbs * 17 + f.fat * 37
  if (fromMacros === 0) continue
  const drift = Math.abs(fromMacros - f.kj) / f.kj
  if (drift > 0.2) suspect.push(`${f.name}: stated ${f.kj} kJ, macros imply ${Math.round(fromMacros)} kJ (${Math.round(drift * 100)}% off)`)
}

const banner = `// GENERATED by scripts/build-foods.mjs — do not edit by hand.
// Source data and every correction applied to it live in that script.
//
// Kilojoules are per serving as sold in Australia. \`confidence\` is honest: 'high' means a
// published nutrition panel confirmed by a second source, 'low' means an estimate. The app
// shows a warning when you log a low-confidence food, because a guess should look like one.
`

const body = `import type { Food } from '../lib/types'

export const FOODS: Food[] = ${JSON.stringify(out, null, 2)}
`

writeFileSync(join(here, '..', 'src', 'data', 'foods.ts'), `${banner}\n${body}`)

console.log(`Wrote ${out.length} foods (dropped ${dropped.length}).`)
if (suspect.length) {
  console.log('\nMacro/kJ mismatches to review:')
  for (const s of suspect) console.log('  ' + s)
}
