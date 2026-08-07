# Weight Tracker

A kilojoule and weight tracker built around one idea: **most weeks are the same week**, so
logging one should take a single tap.

No account, no server, no subscription. Everything lives in your browser's storage on your
own device. Add it to your home screen and it behaves like an app, offline included.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 75 tests over the energy and trend maths
npm run build    # static site in dist/
```

## Why not just use MyFitnessPal

Four things, in order of how much they matter.

**One tap logs a whole day.** Monday, Tuesday and Friday are the same day. Wednesday is
Wednesday. Those are saved as *day templates* — tap "Gym day" and the whole day is logged,
then fix whatever was different. Logging becomes confirming a prediction instead of
reconstructing a memory, which is the difference between a habit that survives three months
and one that doesn't. Fixing a portion afterwards is one tap and no keyboard: **Smaller**,
**As usual**, **Bigger**.

**The budget is weekly, not daily.** A restaurant Wednesday against a flat daily target is a
red number and a ruined evening, fifty-two times a year — and weekly energy balance is what
actually drives fat loss anyway. So the week gets the budget, split by day weights you
control. Wednesday is set to 1.35× and the quiet days pay for it. Go over anyway and the
remaining days quietly shrink to absorb it; nothing turns red and nothing is "ruined".

**Nothing is judged on a single weigh-in.** Day-to-day weight swings 1–2 kg on water alone,
while a hard week of dieting moves it 0.7 kg. An app that headlines this morning's reading is
showing you pure noise and inviting you to draw conclusions from it. Here the headline is the
smoothed trend, with the raw readings kept visible underneath so you can see for yourself how
little they mean.

**It tells you when your own numbers don't add up.** After a few weeks it works out what you
actually burn from your intake and your weight change, rather than trusting a textbook
equation. If that comes out far below what someone your size plausibly burns, it says so —
because the usual cause is food that never made it into the log, and "eat less" and "log
better" are opposite responses to the same symptom.

## Things it deliberately doesn't do

- **Credit exercise back to your budget.** Your walks and gym sessions are already in the
  activity multiplier. Adding them again is double-counting worth over 1,000 kJ a day, and
  it's why people eat their deficit and conclude that counting doesn't work for them.
- **Demand grams.** You can't weigh a meal someone else cooked, or a restaurant plate. Every
  food has a described serving — "1 dinner plate", "1 can (237 ml)" — and portions scale off
  it. Roughly right every day beats exactly right for a week.
- **Pad the search results.** 134 curated foods, one row per food. Not twenty crowd-sourced
  entries for "Big Mac" at fifteen different values.
- **Reward you for not logging.** A past day with nothing in it is charged its planned share,
  not zero. Otherwise skipping your biggest day would hand its whole budget to the rest of
  the week.

## How the numbers work

`src/lib/energy.ts` and `src/lib/trend.ts` hold all of it, and every claim below has a test.

**Resting metabolism** — Mifflin-St Jeor. Better validated than Harris-Benedict for
non-obese adults, and unlike Katch-McArdle it needs no body-fat measurement.

**Expenditure** — resting rate × an activity multiplier, described by what a week actually
looks like rather than by labels like "moderately active" that everyone rounds up. Averaged
between your current weight and your goal weight, because a lighter body costs less to run
and a target set against today's figure runs slightly generous for the whole cut.

**The thermic effect of food** — about 10% of what you eat is spent digesting it. An
activity-multiplier "TDEE" is really *maintenance intake*, so it already contains digestion
priced at a maintenance-sized meal. Eat less and you digest less, so:

```
naive:   intake = maintenance − deficit          ← gives back a tenth of the deficit
correct: intake = maintenance − deficit / (1 − 0.10)
```

That's ~350 kJ/day here, or about a kilogram over a three-month cut — invisible until the
goal date arrives and the scale disagrees with you.

**The trend** — an exponentially weighted average of your weigh-ins, α = 0.2, about a
nine-day window. It's what gets drawn, because it's the honest thing to *look* at. It is
**not** what gets judged, because an average of a falling weight always reads high: it lags
by roughly four days, or 0.4 kg at a normal rate of loss, which is enough to tell someone
losing weight exactly on plan that they're falling behind. Every judgement uses a
least-squares fit through the raw readings evaluated at today, which has no lag.

**Rate and projection** — least-squares regression over 21 days. Below three weigh-ins it
says so rather than guessing. Position against the schedule and pace are reported as separate
things, because early on they disagree: you can be sitting on the goal line on day three
while losing at half the rate you need.

**A safety floor.** Whatever the goal date demands, the target never goes below the floor in
your profile. When the floor bites, the app says which date is actually reachable instead of
prescribing an intake below your resting metabolism. The right response to being behind is
more walking, not less food — and the Plan tab prices that out in kilometres.

## The food database

134 Australian foods in `src/data/foods.ts`, generated by `scripts/build-foods.mjs` from
`scripts/food-research.json`. Every correction applied to the raw research is a named entry
in that script with its evidence, so any number can be traced back.

It's worth knowing why that audit trail exists. The generic AUSNUT-derived half of the
research came back sound. The branded half — the half you actually eat from — did not:

| Item | Researched | Actual | Why |
|---|---|---|---|
| Sausage & Egg McMuffin | 1,900 kJ | 1,620 kJ | 17% high — impossible against McDonald's own *Double* at 2,130 kJ |
| Bacon & Egg McMuffin | 1,560 kJ | 1,230 kJ | 27% high, same contradiction |
| Frozen Coke, medium | 840 kJ | 580 kJ | 45% high — carbohydrate inferred wrongly |
| OREO McFlurry | 1,560 kJ | 1,300 kJ | 20% high, guessed from a band |
| Egg McMuffin | 1,210 kJ | — | Removed: a US product McDonald's Australia doesn't sell |
| Craft Boss 500 ml bottles | 50–670 kJ | — | Removed: Japanese SKUs not sold here |

Every one of those was labelled high confidence.

Two defences are now permanent. `confidence` is honest — `high` means a published panel
confirmed twice, `low` means an estimate, and the app warns you when you log one. And every
food carrying all three macros must reconcile with its stated kilojoules (protein 17 kJ/g,
carbs 17, fat 37) to within 20%; that check runs in the build script and again as a test.
It's what caught the McMuffins.

## Layout

```
src/lib/        types · date · energy · trend · storage · search · format   (+ tests)
src/data/       foods.ts (generated) · templates.ts · profile.ts
src/components/ TodayView · WeightView · FoodsView · PlanView
                WeightChart · WeekChart · LogFoodSheet · CustomFoodForm · Sheet
src/state.tsx   the store — every mutation lives here
src/usePlan.ts  the one place that decides what "the plan" currently is
scripts/        build-foods.mjs + the raw research it consumes
```

Logged entries snapshot a food's kilojoules at the moment you log them. Correcting a food
tomorrow will never silently rewrite last month's totals.

## Deploying it

Any static host. The build is ~93 kB gzipped with no runtime dependencies beyond React.

```bash
npm run build          # → dist/
BASE_PATH=/weight-tracker/ npm run build    # if serving from a sub-path (GitHub Pages)
```

Open it on your phone and use "Add to Home Screen". It installs as a standalone app and works
offline.

## Back it up

Browser storage is not durable — clearing site data, a strict privacy setting, or a new phone
all wipe it. **Plan → Backup** writes a JSON file that **Restore** reads back. There's a CSV
export too, if you'd rather do your own analysis.

## Not medical advice

The kilojoule figures are published nutrition panels and population averages. Real portions
vary, and self-reported intake is under-counted by 20–30% in almost everyone — the app's job
is to make that error *consistent*, so the trend is honest even when the absolute numbers
aren't perfect.

Talk to a GP or an Accredited Practising Dietitian before a steep deficit if you take any
medication, have a thyroid, cardiac, kidney or blood-sugar condition, or any history of
disordered eating. Daily weighing and food logging are not safe for everyone.
