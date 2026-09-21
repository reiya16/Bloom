-- =============================================================================
-- Bloom v0.1: database foundation
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- WARNING: this REMOVES the old Lift Log tables (workouts, exercises, entries)
-- and everything in them. Your sign-in account is not touched.
-- =============================================================================

drop table if exists public.entries cascade;
drop table if exists public.exercises cascade;
drop table if exists public.workouts cascade;
drop table if exists public.session_sets cascade;
drop table if exists public.sessions cascade;
drop table if exists public.workout_exercises cascade;
drop table if exists public.profiles cascade;

-- helper: keep updated_at fresh
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROFILES: one row per person (goal, equipment, unit, schedule style, targets)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  goal               text check (goal in ('build_muscle','get_stronger','lose_fat','stay_fit')),
  experience         text check (experience in ('never','under_1','1_3','3_plus')),
  equipment          text check (equipment in ('full_gym','home_dumbbells','bodyweight','mix')),
  workouts_per_week  int  check (workouts_per_week between 1 and 7),
  weight_unit        text not null default 'kg' check (weight_unit in ('kg','lb')),
  schedule_mode      text not null default 'rotation' check (schedule_mode in ('fixed','rotation','flexible')),
  calorie_target     int  check (calorie_target > 0),
  protein_target_g   int  check (protein_target_g > 0),
  body_weight_kg     numeric check (body_weight_kg > 0),
  onboarding_done    boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- EXERCISES: built-in list (user_id is null) plus each person's own custom ones
-- ---------------------------------------------------------------------------
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  slug         text,
  name         text not null,
  muscle_group text not null check (muscle_group in
                 ('chest','back','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','core')),
  kind         text not null default 'weight_reps' check (kind in ('weight_reps','bodyweight_reps','time')),
  equipment    text not null default 'gym' check (equipment in ('gym','dumbbell','bodyweight')),
  priority     int  not null default 50,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index exercises_builtin_slug on public.exercises (slug) where user_id is null;
create index exercises_user on public.exercises (user_id);

-- ---------------------------------------------------------------------------
-- WORKOUTS and the exercises inside each one (this is "My plan")
-- ---------------------------------------------------------------------------
create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  weekdays    int[],                       -- 0 = Monday ... 6 = Sunday (used by 'fixed' schedules)
  created_at  timestamptz not null default now()
);
create index workouts_user on public.workouts (user_id);

create table public.workout_exercises (
  id             uuid primary key default gen_random_uuid(),
  workout_id     uuid not null references public.workouts(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id) on delete restrict,
  sort_order     int  not null default 0,
  target_sets    int  not null default 3 check (target_sets > 0),
  target_reps    int  check (target_reps > 0),
  target_seconds int  check (target_seconds > 0),
  optional       boolean not null default false,
  archived       boolean not null default false,   -- removed from the plan, but history is kept
  created_at     timestamptz not null default now()
);
create unique index workout_exercises_active on public.workout_exercises (workout_id, exercise_id) where not archived;
create index workout_exercises_workout on public.workout_exercises (workout_id);

-- ---------------------------------------------------------------------------
-- SESSIONS (a workout you did) and SETS (every set, logged separately)
-- weights are always stored in kg; the app converts to lb for display
-- ---------------------------------------------------------------------------
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workout_id   uuid references public.workouts(id) on delete set null,
  workout_name text not null,
  date         date not null default current_date,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index sessions_user_date on public.sessions (user_id, date desc);

create table public.session_sets (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number  int  not null check (set_number > 0),
  weight_kg   numeric check (weight_kg >= 0),
  reps        int  check (reps >= 0),
  seconds     int  check (seconds >= 0),
  is_extra    boolean not null default false,       -- added for this session only
  created_at  timestamptz not null default now()
);
create index session_sets_session on public.session_sets (session_id);
create index session_sets_exercise on public.session_sets (user_id, exercise_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY: everyone can only see and change their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_sets      enable row level security;

create policy "own profile" on public.profiles
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "read built-in and own exercises" on public.exercises
  for select using (user_id is null or user_id = (select auth.uid()));
create policy "add own exercises" on public.exercises
  for insert with check (user_id = (select auth.uid()));
create policy "change own exercises" on public.exercises
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "remove own exercises" on public.exercises
  for delete using (user_id = (select auth.uid()));

create policy "own workouts" on public.workouts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own workout exercises" on public.workout_exercises
  for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id
                and (e.user_id is null or e.user_id = (select auth.uid())))
  );

create policy "own sessions" on public.sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own sets" on public.session_sets
  for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- BUILT-IN EXERCISE LIST
-- equipment: gym = needs a gym, dumbbell = dumbbells are enough, bodyweight = no equipment
-- priority: lower number = suggested first
-- ---------------------------------------------------------------------------
insert into public.exercises (slug, name, muscle_group, kind, equipment, priority) values
  ('barbell-bench-press', 'Barbell bench press', 'chest', 'weight_reps', 'gym', 10),
  ('dumbbell-bench-press', 'Dumbbell bench press', 'chest', 'weight_reps', 'dumbbell', 16),
  ('chest-press', 'Chest press', 'chest', 'weight_reps', 'gym', 14),
  ('push-ups', 'Push-ups', 'chest', 'bodyweight_reps', 'bodyweight', 18),
  ('incline-dumbbell-press', 'Incline dumbbell press', 'chest', 'weight_reps', 'dumbbell', 12),
  ('incline-chest-press', 'Incline chest press', 'chest', 'weight_reps', 'gym', 22),
  ('dumbbell-fly', 'Dumbbell fly', 'chest', 'weight_reps', 'dumbbell', 30),
  ('cable-crossover', 'Cable crossover', 'chest', 'weight_reps', 'gym', 32),
  ('pec-deck', 'Pec deck', 'chest', 'weight_reps', 'gym', 34),
  ('chest-dips', 'Chest dips', 'chest', 'bodyweight_reps', 'bodyweight', 36),
  ('decline-push-ups', 'Decline push-ups', 'chest', 'bodyweight_reps', 'bodyweight', 38),
  ('incline-push-ups', 'Incline push-ups', 'chest', 'bodyweight_reps', 'bodyweight', 40),
  ('lat-pulldown', 'Lat pulldown', 'back', 'weight_reps', 'gym', 10),
  ('pull-ups', 'Pull-ups', 'back', 'bodyweight_reps', 'bodyweight', 13),
  ('one-arm-dumbbell-row', 'One-arm dumbbell row', 'back', 'weight_reps', 'dumbbell', 14),
  ('seated-row', 'Seated row', 'back', 'weight_reps', 'gym', 12),
  ('barbell-row', 'Barbell row', 'back', 'weight_reps', 'gym', 16),
  ('deadlift', 'Deadlift', 'back', 'weight_reps', 'gym', 18),
  ('chest-supported-row', 'Chest-supported row', 'back', 'weight_reps', 'gym', 22),
  ('inverted-row', 'Inverted row', 'back', 'bodyweight_reps', 'bodyweight', 24),
  ('face-pull', 'Face pull', 'back', 'weight_reps', 'gym', 30),
  ('straight-arm-pulldown', 'Straight-arm pulldown', 'back', 'weight_reps', 'gym', 34),
  ('back-extension', 'Back extension', 'back', 'bodyweight_reps', 'bodyweight', 40),
  ('superman-hold', 'Superman hold', 'back', 'time', 'bodyweight', 50),
  ('dumbbell-shoulder-press', 'Dumbbell shoulder press', 'shoulders', 'weight_reps', 'dumbbell', 10),
  ('barbell-overhead-press', 'Barbell overhead press', 'shoulders', 'weight_reps', 'gym', 14),
  ('shoulder-press', 'Shoulder press', 'shoulders', 'weight_reps', 'gym', 22),
  ('lateral-raise', 'Lateral raise', 'shoulders', 'weight_reps', 'dumbbell', 12),
  ('pike-push-ups', 'Pike push-ups', 'shoulders', 'bodyweight_reps', 'bodyweight', 20),
  ('reverse-fly', 'Reverse fly', 'shoulders', 'weight_reps', 'dumbbell', 18),
  ('arnold-press', 'Arnold press', 'shoulders', 'weight_reps', 'dumbbell', 26),
  ('cable-lateral-raise', 'Cable lateral raise', 'shoulders', 'weight_reps', 'gym', 28),
  ('front-raise', 'Front raise', 'shoulders', 'weight_reps', 'dumbbell', 30),
  ('biceps-curl', 'Biceps curl', 'biceps', 'weight_reps', 'dumbbell', 10),
  ('hammer-curl', 'Hammer curl', 'biceps', 'weight_reps', 'dumbbell', 12),
  ('barbell-curl', 'Barbell curl', 'biceps', 'weight_reps', 'gym', 14),
  ('chin-ups', 'Chin-ups', 'biceps', 'bodyweight_reps', 'bodyweight', 16),
  ('cable-curl', 'Cable curl', 'biceps', 'weight_reps', 'gym', 18),
  ('incline-dumbbell-curl', 'Incline dumbbell curl', 'biceps', 'weight_reps', 'dumbbell', 20),
  ('preacher-curl', 'Preacher curl', 'biceps', 'weight_reps', 'gym', 22),
  ('triceps-pushdown', 'Triceps pushdown', 'triceps', 'weight_reps', 'gym', 10),
  ('overhead-triceps-extension', 'Overhead triceps extension', 'triceps', 'weight_reps', 'dumbbell', 12),
  ('close-grip-bench-press', 'Close-grip bench press', 'triceps', 'weight_reps', 'gym', 18),
  ('diamond-push-ups', 'Diamond push-ups', 'triceps', 'bodyweight_reps', 'bodyweight', 20),
  ('lying-triceps-extension', 'Lying triceps extension', 'triceps', 'weight_reps', 'dumbbell', 22),
  ('bench-dips', 'Bench dips', 'triceps', 'bodyweight_reps', 'bodyweight', 24),
  ('triceps-kickback', 'Triceps kickback', 'triceps', 'weight_reps', 'dumbbell', 30),
  ('barbell-back-squat', 'Barbell back squat', 'quads', 'weight_reps', 'gym', 10),
  ('goblet-squat', 'Goblet squat', 'quads', 'weight_reps', 'dumbbell', 16),
  ('bodyweight-squat', 'Bodyweight squat', 'quads', 'bodyweight_reps', 'bodyweight', 17),
  ('leg-press', 'Leg press', 'quads', 'weight_reps', 'gym', 12),
  ('bulgarian-split-squat', 'Bulgarian split squat', 'quads', 'weight_reps', 'dumbbell', 14),
  ('walking-lunges', 'Walking lunges', 'quads', 'weight_reps', 'dumbbell', 18),
  ('bodyweight-lunges', 'Bodyweight lunges', 'quads', 'bodyweight_reps', 'bodyweight', 20),
  ('front-squat', 'Front squat', 'quads', 'weight_reps', 'gym', 22),
  ('hack-squat', 'Hack squat', 'quads', 'weight_reps', 'gym', 24),
  ('step-ups', 'Step-ups', 'quads', 'weight_reps', 'dumbbell', 24),
  ('leg-extension', 'Leg extension', 'quads', 'weight_reps', 'gym', 26),
  ('wall-sit', 'Wall sit', 'quads', 'time', 'bodyweight', 40),
  ('romanian-deadlift', 'Romanian deadlift', 'hamstrings', 'weight_reps', 'gym', 10),
  ('dumbbell-romanian-deadlift', 'Dumbbell Romanian deadlift', 'hamstrings', 'weight_reps', 'dumbbell', 14),
  ('leg-curl', 'Leg curl', 'hamstrings', 'weight_reps', 'gym', 12),
  ('single-leg-romanian-deadlift', 'Single-leg Romanian deadlift', 'hamstrings', 'weight_reps', 'dumbbell', 20),
  ('slider-leg-curl', 'Slider leg curl', 'hamstrings', 'bodyweight_reps', 'bodyweight', 26),
  ('nordic-curl', 'Nordic curl', 'hamstrings', 'bodyweight_reps', 'bodyweight', 30),
  ('hip-thrust', 'Hip thrust', 'glutes', 'weight_reps', 'gym', 10),
  ('dumbbell-hip-thrust', 'Dumbbell hip thrust', 'glutes', 'weight_reps', 'dumbbell', 16),
  ('glute-bridge', 'Glute bridge', 'glutes', 'bodyweight_reps', 'bodyweight', 14),
  ('sumo-squat', 'Sumo squat', 'glutes', 'weight_reps', 'dumbbell', 18),
  ('single-leg-glute-bridge', 'Single-leg glute bridge', 'glutes', 'bodyweight_reps', 'bodyweight', 20),
  ('cable-glute-kickback', 'Cable glute kickback', 'glutes', 'weight_reps', 'gym', 12),
  ('curtsy-lunge', 'Curtsy lunge', 'glutes', 'weight_reps', 'dumbbell', 26),
  ('hip-abduction-machine', 'Hip abduction machine', 'glutes', 'weight_reps', 'gym', 28),
  ('standing-calf-raise', 'Standing calf raise', 'calves', 'weight_reps', 'gym', 10),
  ('dumbbell-calf-raise', 'Dumbbell calf raise', 'calves', 'weight_reps', 'dumbbell', 12),
  ('bodyweight-calf-raise', 'Bodyweight calf raise', 'calves', 'bodyweight_reps', 'bodyweight', 12),
  ('seated-calf-raise', 'Seated calf raise', 'calves', 'weight_reps', 'gym', 14),
  ('plank', 'Plank', 'core', 'time', 'bodyweight', 10),
  ('cable-crunch', 'Cable crunch', 'core', 'weight_reps', 'gym', 14),
  ('side-plank', 'Side plank', 'core', 'time', 'bodyweight', 16),
  ('crunch', 'Crunch', 'core', 'bodyweight_reps', 'bodyweight', 18),
  ('hanging-knee-raise', 'Hanging knee raise', 'core', 'bodyweight_reps', 'bodyweight', 20),
  ('lying-leg-raise', 'Lying leg raise', 'core', 'bodyweight_reps', 'bodyweight', 20),
  ('dead-bug', 'Dead bug', 'core', 'bodyweight_reps', 'bodyweight', 22),
  ('russian-twist', 'Russian twist', 'core', 'bodyweight_reps', 'bodyweight', 24),
  ('pallof-press', 'Pallof press', 'core', 'weight_reps', 'gym', 28),
  ('ab-wheel-rollout', 'Ab wheel rollout', 'core', 'bodyweight_reps', 'gym', 30),
  ('mountain-climbers', 'Mountain climbers', 'core', 'bodyweight_reps', 'bodyweight', 32),
  ('bird-dog', 'Bird dog', 'core', 'bodyweight_reps', 'bodyweight', 34);
