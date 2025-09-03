-- Create bug_reports table for in-app bug submissions
-- Safe to run multiple times
create extension if not exists pgcrypto;

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  platform text,
  os_version text,
  screen text,
  app_version text,
  extra jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists bug_reports_created_at_idx on public.bug_reports(created_at desc);
create index if not exists bug_reports_user_id_idx on public.bug_reports(user_id);

-- Enable RLS
alter table public.bug_reports enable row level security;

-- Policies
-- Allow authenticated users to insert bug reports
drop policy if exists bug_reports_insert_authenticated on public.bug_reports;
create policy bug_reports_insert_authenticated
  on public.bug_reports
  for insert
  to authenticated
  with check (true);

-- Allow users to select only their own bug reports
drop policy if exists bug_reports_select_own on public.bug_reports;
create policy bug_reports_select_own
  on public.bug_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Optional: allow service_role full access (handled implicitly by service key)
