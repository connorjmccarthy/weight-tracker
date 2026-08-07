import type { DayTemplate, Id } from '../lib/types'

/**
 * Day templates: a whole day of food logged in one tap.
 *
 * This is the feature the app is built around. Five of seven days are near-identical, so
 * reconstructing them from memory every evening — six searches, six portion decisions,
 * forty-odd taps — is pure waste. Tapping "Gym day" in the morning turns logging from
 * *recalling* a day into *confirming a prediction*, and corrections afterwards are one tap
 * each. Time spent logging is the single strongest predictor of whether someone is still
 * logging in three months.
 *
 * These are seeded from the week as described. They're meant to be edited.
 */
export const DEFAULT_TEMPLATES: DayTemplate[] = [
  {
    id: 'tpl_gym_day',
    name: 'Gym day',
    emoji: '🏋',
    suggestOn: [1, 2, 5], // Mon, Tue, Fri
    items: [
      { foodId: 'crumpets-2-with-sugar-free-syrup', servings: 1, meal: 'breakfast' },
      { foodId: 'boss-coffee-iced-double-espresso-237ml-can', servings: 1, meal: 'breakfast' },
      // No lunch on these days — breakfast, then straight through to dinner.
      { foodId: 'dads-dinner-your-4-000-kj-estimate', servings: 1, meal: 'dinner' },
      { foodId: 'pepsi-max-375-ml-can', servings: 1, meal: 'snack' },
    ],
  },
  {
    id: 'tpl_wednesday',
    name: 'Wednesday out',
    emoji: '🍔',
    suggestOn: [3],
    items: [
      { foodId: 'mcdonalds-bacon-egg-mcmuffin', servings: 1, meal: 'breakfast' },
      { foodId: 'boss-coffee-iced-double-espresso-237ml-can', servings: 1, meal: 'breakfast' },
      { foodId: 'grilld-simply-grilld-traditional-bun', servings: 1, meal: 'lunch' },
      { foodId: 'beef-tartare-entree-with-toast', servings: 1, meal: 'dinner' },
      { foodId: 'carbonara-pasta-restaurant-portion', servings: 1, meal: 'dinner' },
    ],
  },
  {
    id: 'tpl_thursday',
    name: 'Thursday',
    emoji: '🍟',
    suggestOn: [4],
    items: [
      { foodId: 'iced-long-black-no-milk-no-sugar', servings: 1, meal: 'breakfast' },
      { foodId: 'grilld-simply-grilld-traditional-bun', servings: 1, meal: 'lunch' },
      { foodId: 'mcdonalds-big-mac', servings: 1, meal: 'dinner' },
      { foodId: 'mcdonalds-fries-medium', servings: 1, meal: 'dinner' },
    ],
  },
  {
    id: 'tpl_weekend',
    name: 'Weekend',
    emoji: '🏠',
    suggestOn: [6, 0],
    items: [
      { foodId: 'boss-coffee-iced-double-espresso-237ml-can', servings: 1, meal: 'breakfast' },
      { foodId: 'dads-dinner-your-4-000-kj-estimate', servings: 1, meal: 'dinner' },
    ],
  },
]

/**
 * The tiles on the home screen before there's any history to rank by. Chosen to cover the
 * things eaten most often, so the first week of logging needs almost no searching.
 */
export const STARTER_FAVOURITE_IDS: Id[] = [
  'crumpets-2-with-sugar-free-syrup',
  'boss-coffee-iced-double-espresso-237ml-can',
  'boss-coffee-iced-long-black-237ml-can',
  'dads-dinner-your-4-000-kj-estimate',
  'grilld-simply-grilld-traditional-bun',
  'mcdonalds-bacon-egg-mcmuffin',
  'mcdonalds-big-mac',
  'mcdonalds-fries-medium',
  'pepsi-max-375-ml-can',
  'iced-long-black-no-milk-no-sugar',
  'beef-tartare-entree-with-toast',
  'massimos-gelato-2-scoops-in-a-cup',
]
