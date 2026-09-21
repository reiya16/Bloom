-- =============================================================================
-- Bloom v0.5: Eat (food log) and Coach (chat messages)
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- This only ADDS two tables. Nothing you already have is changed or removed,
-- and it is safe to run more than once.
-- =============================================================================

create table if not exists public.food_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  meal        text not null check (meal in ('breakfast','lunch','dinner','snack')),
  name        text not null,
  brand       text,
  fdc_id      bigint,                                   -- USDA FoodData Central id, when picked from the database
  grams       numeric check (grams > 0),
  state       text not null default 'unknown' check (state in ('raw','cooked','unknown')),
  calories    numeric not null check (calories >= 0),   -- totals for what was eaten, saved at the time
  protein_g   numeric not null default 0 check (protein_g >= 0),
  carbs_g     numeric not null default 0 check (carbs_g >= 0),
  fat_g       numeric not null default 0 check (fat_g >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists food_log_user_date on public.food_log (user_id, date desc);

create table if not exists public.coach_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  thread          text not null default 'coach' check (thread in ('coach','plan_setup')),
  role            text not null check (role in ('user','coach')),
  content         text not null,
  proposal        jsonb,                                -- a plan change Coach suggests; only applied when you tap Apply
  proposal_status text check (proposal_status in ('pending','applied','dismissed')),
  created_at      timestamptz not null default now()
);
create index if not exists coach_messages_thread on public.coach_messages (user_id, thread, created_at);

alter table public.food_log       enable row level security;
alter table public.coach_messages enable row level security;

drop policy if exists "own food log" on public.food_log;
create policy "own food log" on public.food_log
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own coach messages" on public.coach_messages;
create policy "own coach messages" on public.coach_messages
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
