-- ====================================================================
-- 日程調整アプリ用 Supabase スキーマ
-- Supabase の SQL Editor で実行してください
-- ====================================================================

drop table if exists public.responses cascade;
drop table if exists public.participants cascade;
drop table if exists public.time_slots cascade;
drop table if exists public.dates cascade;
drop table if exists public.events cascade;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  slot_minutes integer not null default 30,
  created_at timestamptz not null default now()
);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.time_slots(event_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);
create index on public.participants(event_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  time_slot_id uuid not null references public.time_slots(id) on delete cascade,
  status text not null check (status in ('ok', 'ng')),
  updated_at timestamptz not null default now(),
  unique (participant_id, time_slot_id)
);
create index on public.responses(participant_id);

-- RLS（anon で全許可）
alter table public.events enable row level security;
alter table public.time_slots enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;

create policy "anon all" on public.events for all using (true) with check (true);
create policy "anon all" on public.time_slots for all using (true) with check (true);
create policy "anon all" on public.participants for all using (true) with check (true);
create policy "anon all" on public.responses for all using (true) with check (true);
