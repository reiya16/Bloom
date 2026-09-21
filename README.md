# Bloom

Training and nutrition, coached to your goals. A mobile-first web app (installable to the
home screen) built with React + TypeScript + Vite + Tailwind, backed by Supabase, deployed
to GitHub Pages.

## What's in this version (v0.5)

- Sign in with email + password, with a Show / Hide button on password boxes (each person gets their own private data)
- First-time setup: goal, where you train, optional nutrition targets, a suggested plan
- Suggested plans come from simple rules (goal + days per week + experience + equipment), not AI
- My plan: any split (push/pull/legs, upper/lower, full body, your own), exercises picked by
  muscle group, your own custom exercises, fixed / rotation / flexible scheduling
- Train: every set logged separately, "last time" hints, add an exercise for today only or every time,
  delete a set (button or swipe left, with Undo)
- Progress: per-exercise chart, a flat-for-3-sessions flag, and a History log (by date or by exercise)

- Eat: log food by searching the USDA FoodData Central database (raw or cooked, grams or ounces), by
  tapping a recent food, or by typing numbers in. Daily calories and protein goals; Coach watches carbs
  (usual 45-65% of calories) and fat (20-35%) and flags drift
- Coach: rule-based alerts (stalled lifts, missed workouts, nutrition drift) plus a chat powered by
  Google Gemini. Coach can suggest plan changes, but nothing changes until you tap Apply
- "Talk to Coach" during first-time setup: describe your routine and get a draft plan to approve

Coming next: Apple Health sync via an iPhone Shortcut.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/migrations/0002_bloom_foundation.sql` → Run.
   (This removes the old Lift Log tables. Your sign-in accounts are not affected.)
3. **Project Settings → API**: copy the Project URL and the `anon` `public` key.
4. **Authentication → URL Configuration**: set **Site URL** and add a **Redirect URL** of
   `https://<your-github-username>.github.io/gym-tracker-v2/`.
5. **Authentication → Sign In / Providers**: Email is on by default.

### Coach and Eat (server functions)

Run `supabase/migrations/0003_coach_and_eat.sql` in the SQL Editor (it only adds two tables).

Then create two Edge Functions (**Edge Functions -> Deploy a new function -> Via Editor**), pasting in the code
from `supabase/functions/<name>/index.ts`:

| Function name | Needs secret |
|---|---|
| `food-search` | `USDA_API_KEY` (free: fdc.nal.usda.gov/api-key-signup) |
| `coach` | `GEMINI_API_KEY` (free: aistudio.google.com/app/apikey), optional `GEMINI_MODEL` |

Add secrets under **Edge Functions -> Secrets**. `GEMINI_MODEL` defaults to `gemini-flash-latest`, which always
points at Google's current Flash model, so it survives model retirements.

## Deploy (GitHub Pages)

Add two repository secrets (**Settings → Secrets and variables → Actions**):
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. In **Settings → Pages**, set Source to
**GitHub Actions**. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.

## Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
npm run typecheck            # optional type check
```

## Notes

- Weights are stored in kg and shown in kg or lb per person's choice.
- Removing an exercise from a plan archives it (history is kept), it is never hard-deleted.
- `supabase/functions/ai-coach` is the old Lift Log coach function. It is not used by this version
  (replaced by `coach`) and can be deleted from Supabase.
