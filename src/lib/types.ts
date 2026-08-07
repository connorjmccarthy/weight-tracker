/** Core data model. Everything is stored locally; there is no server. */

export type Id = string

/** ISO local date, `YYYY-MM-DD`. Never a UTC timestamp — a food log is a *calendar* thing. */
export type DateStr = string

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type FoodCategory =
  | 'breakfast'
  | 'fastfood'
  | 'drink'
  | 'homecooked'
  | 'restaurant'
  | 'snack'
  | 'staple'
  | 'protein'
  | 'produce'
  | 'dessert'
  | 'alcohol'

export type Confidence = 'high' | 'medium' | 'low'

export interface Food {
  id: Id
  name: string
  brand?: string
  category: FoodCategory
  /** How one serving is described to a human: "1 can (237 ml)", "1 home dinner plate". */
  servingLabel: string
  /** Grams or millilitres in one serving. 0/undefined when the item isn't sold by weight. */
  servingGrams?: number
  /** Kilojoules in ONE serving. The single source of truth — kcal is derived. */
  kj: number
  protein?: number
  carbs?: number
  fat?: number
  /** Where the number came from, so a low-confidence guess is visible rather than implied. */
  source?: string
  confidence?: Confidence
  /** True for foods the user created themselves. */
  custom?: boolean
  archived?: boolean
}

/**
 * A logged entry snapshots the food's numbers at log time. Editing a food later must not
 * silently rewrite last month's totals — that is how trackers lose your trust.
 */
export interface LogEntry {
  id: Id
  date: DateStr
  foodId: Id
  /** Portion multiplier. 1 = one serving; 0.75 = "small"; 1.4 = "large". */
  servings: number
  meal: Meal
  at: number
  name: string
  kjPerServing: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface WeighIn {
  date: DateStr
  kg: number
  at: number
}

export interface TemplateItem {
  foodId: Id
  servings: number
  meal: Meal
}

/** A named set of foods logged in one tap — the whole point of the app. */
export interface DayTemplate {
  id: Id
  name: string
  emoji?: string
  items: TemplateItem[]
  /** Weekday numbers (0=Sun … 6=Sat) this template is suggested on. */
  suggestOn?: number[]
}

/** 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Relative share of the week's energy budget assigned to each weekday.
 * A restaurant Wednesday gets 1.35; a quiet Monday gets 0.85. They do not need to sum to
 * anything in particular — only the ratios matter.
 */
export type DayWeights = Record<Weekday, number>

export interface Profile {
  sex: 'male' | 'female'
  age: number
  heightCm: number
  /** Weight at the start of the plan, used to draw the goal line. */
  startKg: number
  startDate: DateStr
  goalKg: number
  goalDate: DateStr
  /** Multiplier applied to BMR. See `energy.ts` for how the default is derived. */
  activityFactor: number
  /** Never propose a daily target below this, whatever the goal date demands. */
  floorKj: number
  /** Grams of protein per day to defend lean mass in a deficit. */
  proteinTargetG: number
  units: 'kj' | 'kcal'
  dayWeights: DayWeights
  /**
   * Once there is enough logged data, measure expenditure from reality
   * (intake vs. weight change) instead of trusting the BMR equation.
   */
  useAdaptiveTdee: boolean
}

export interface AppState {
  version: number
  profile: Profile
  foods: Food[]
  log: LogEntry[]
  weighIns: WeighIn[]
  templates: DayTemplate[]
  favouriteIds: Id[]
}
