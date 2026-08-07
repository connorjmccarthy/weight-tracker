import type { DayWeights, Profile } from '../lib/types'

/**
 * Starting values. Everything here is editable in the Plan tab — these are just the
 * numbers the app opens with rather than an empty form.
 */

/**
 * The week's energy split.
 *
 * Not flat, on purpose. Wednesday is a restaurant night and Thursday is takeaway; a flat
 * daily target would mark both as failures every single week, and "the day is already
 * ruined" is the most reliable way to lose someone from a food diary. Weighting Wednesday
 * up and paying for it across the quieter days produces exactly the same weekly deficit
 * with none of the manufactured failure. The weights sum to 7, so the average day is
 * unchanged.
 */
export const DEFAULT_DAY_WEIGHTS: DayWeights = {
  1: 0.93, // Monday — gym, breakfast at home, dinner at home
  2: 0.93, // Tuesday — same
  3: 1.35, // Wednesday — McMuffin, Grill'd, tartare and a restaurant main
  4: 1.05, // Thursday — Grill'd lunch, McDonald's dinner
  5: 0.93, // Friday — same as Monday
  6: 0.93, // Saturday
  0: 0.88, // Sunday
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 27,
  heightCm: 175,
  startKg: 78.5,
  startDate: '2026-08-07',
  goalKg: 70,
  goalDate: '2026-11-01',

  /*
   * 1.41, built from the actual week rather than picked off a table: a 3.4 km walk five
   * days (≈590 kJ net each), three 40-minute easy gym sessions (≈600 kJ net each), and
   * desk-level movement otherwise. The standard tables tempt you to "moderately active" at
   * 1.55 because that counts *sessions* — but volume is what matters, and 1.55 would
   * overstate the daily burn by about 1,050 kJ and quietly sink the whole plan.
   */
  activityFactor: 1.41,

  /*
   * A hard floor of 7,000 kJ (≈1,670 kcal). Reaching 70 kg by 1 November would need about
   * 6,530 kJ/day, which is below resting metabolism and leaves no room to correct if the
   * estimate is off. The app will say so plainly and offer the date it *can* hit instead.
   * The right response to being behind is more walking, not less food.
   */
  floorKj: 7000,

  /*
   * 150 g. Roughly 2.4 g per kg of lean mass, at an assumed 20% body fat. High, and
   * deliberately so: at a steep deficit with three easy gym sessions a week, protein and
   * keeping the weights heavy are the only two things standing between losing fat and
   * losing the muscle that's worth keeping.
   */
  proteinTargetG: 150,

  units: 'kj',
  dayWeights: DEFAULT_DAY_WEIGHTS,
  useAdaptiveTdee: true,
}
