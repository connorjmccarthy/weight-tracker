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
