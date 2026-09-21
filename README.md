# Bloom

Training and nutrition, coached to your goals. A mobile-first web app (installable to the
home screen) built with React + TypeScript + Vite + Tailwind, backed by Supabase, deployed
to GitHub Pages.

## What's in this version (v0.2)

- Sign in with Google or email + password (each person gets their own private data)
- First-time setup: goal, where you train, optional nutrition targets, a suggested plan
- Suggested plans come from simple rules (goal + days per week + experience + equipment), not AI
- My plan: any split (push/pull/legs, upper/lower, full body, your own), exercises picked by
  muscle group, your own custom exercises, fixed / rotation / flexible scheduling
- Train: every set logged separately, "last time" hints, add an exercise for today only or every time
- Progress: per-exercise chart and a flat-for-3-sessions flag

Coming next: Coach (stall alerts, plan changes you approve), Eat (calories, protein, carbs, fat),
Apple Health sync via an iPhone Shortcut.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/migrations/0002_bloom_foundation.sql` → Run.
   (This removes the old Lift Log tables. Your sign-in accounts are not affected.)
3. **Project Settings → API**: copy the Project URL and the `anon` `public` key.
4. **Authentication → URL Configuration**: set **Site URL** and add a **Redirect URL** of
   `https://<your-github-username>.github.io/gym-tracker-v2/`.
5. **Authentication → Sign In / Providers**: Email is on by default. To add Google, see below.

### Google sign-in (optional)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then set up the
   OAuth consent screen (External; app name Bloom; your email).
2. Create an **OAuth client ID** of type **Web application**.
   - Authorized JavaScript origin: `https://<your-github-username>.github.io`
   - Authorized redirect URI: the **Callback URL** shown on Supabase's Google provider page
     (looks like `https://<project-ref>.supabase.co/auth/v1/callback`)
3. Copy the Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → Google,
   switch it on and save.
4. In the Google consent screen settings, publish the app (or add friends as test users) so they can sign in.

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
