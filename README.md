# Bloom

Training and nutrition, coached to your goals. A mobile-first web app (installable to the
home screen) built with React + TypeScript + Vite + Tailwind, backed by Supabase, deployed
to GitHub Pages.

## What's in this version (v0.4)

- Sign in with email + password, with a Show / Hide button on password boxes (each person gets their own private data)
- First-time setup: goal, where you train, optional nutrition targets, a suggested plan
- Suggested plans come from simple rules (goal + days per week + experience + equipment), not AI
- My plan: any split (push/pull/legs, upper/lower, full body, your own), exercises picked by
  muscle group, your own custom exercises, fixed / rotation / flexible scheduling
- Train: every set logged separately, "last time" hints, add an exercise for today only or every time,
  delete a set (button or swipe left, with Undo)
- Progress: per-exercise chart, a flat-for-3-sessions flag, and a History log (by date or by exercise)

Coming next: Coach (stall alerts, plan changes you approve), Eat (calories, protein, carbs, fat),
Apple Health sync via an iPhone Shortcut.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/migrations/0002_bloom_foundation.sql` → Run.
   (This removes the old Lift Log tables. Your sign-in accounts are not affected.)
3. **Project Settings → API**: copy the Project URL and the `anon` `public` key.
4. **Authentication → URL Configuration**: set **Site URL** and add a **Redirect URL** of
   `https://<your-github-username>.github.io/gym-tracker-v2/`.
5. **Authentication → Sign In / Providers**: Email is on by default.

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
  and will be replaced when Coach is built.
