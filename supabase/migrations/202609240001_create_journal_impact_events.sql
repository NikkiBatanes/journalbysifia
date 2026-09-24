create extension if not exists pgcrypto;

create table if not exists public.journal_impact_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null unique,
  event_type text not null check (event_type in (
    'gospel_shared',
    'accepted_jesus',
    'morning_completed',
    'evening_completed',
    'prayer_created',
    'prayer_answered',
    'bible_study_created',
    'bible_study_completed',
    'gratitude_saved',
    'win_saved'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  method text not null,
  platform text,
  install_id_hash text,
  user_id uuid references auth.users(id) on delete set null,
  source_product text not null default 'journal_by_sifia',
  constraint journal_impact_client_event_id_length check (char_length(client_event_id) between 3 and 200),
  constraint journal_impact_method_length check (char_length(method) between 1 and 40)
);

alter table public.journal_impact_events enable row level security;

-- Clients write only through the validating journal-impact Edge Function.
-- The service role can ingest and aggregate; no direct client table policy is granted.

create index if not exists journal_impact_events_type_occurred_idx
  on public.journal_impact_events(event_type, occurred_at desc);

create index if not exists journal_impact_events_occurred_idx
  on public.journal_impact_events(occurred_at desc);

create index if not exists journal_impact_events_install_idx
  on public.journal_impact_events(install_id_hash, occurred_at desc)
  where install_id_hash is not null;
