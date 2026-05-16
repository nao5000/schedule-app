-- ====================================================================
-- 日程調整アプリ用 Supabase スキーマ
-- Supabase の SQL Editor で実行してください
-- ====================================================================

-- 既存テーブルを削除する場合は以下のコメントを外してください
-- drop table if exists public.responses cascade;
-- drop table if exists public.participants cascade;
-- drop table if exists public.time_slots cascade;
-- drop table if exists public.events cascade;

-- イベント（日程調整ページ）
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  memo text,
  slot_minutes integer not null default 30,
  created_at timestamptz not null default now()
);

-- 候補時間（時間枠）
create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists time_slots_event_id_idx on public.time_slots(event_id);

-- 参加者（名前のみ、イベントごと一意）
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);
create index if not exists participants_event_id_idx on public.participants(event_id);

-- 回答（time_slot × participant）
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  time_slot_id uuid not null references public.time_slots(id) on delete cascade,
  status text not null check (status in ('ok', 'ng')),
  updated_at timestamptz not null default now(),
  unique (participant_id, time_slot_id)
);
create index if not exists responses_participant_id_idx on public.responses(participant_id);
create index if not exists responses_time_slot_id_idx on public.responses(time_slot_id);

-- ====================================================================
-- Row Level Security
-- ログイン不要のため anon ロールで read/write を許可します
-- 本番運用ではより厳しいポリシーに変更してください
-- ====================================================================

alter table public.events enable row level security;
alter table public.time_slots enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;

drop policy if exists "events anon all" on public.events;
create policy "events anon all" on public.events
  for all using (true) with check (true);

drop policy if exists "time_slots anon all" on public.time_slots;
create policy "time_slots anon all" on public.time_slots
  for all using (true) with check (true);

drop policy if exists "participants anon all" on public.participants;
create policy "participants anon all" on public.participants
  for all using (true) with check (true);

drop policy if exists "responses anon all" on public.responses;
create policy "responses anon all" on public.responses
  for all using (true) with check (true);
