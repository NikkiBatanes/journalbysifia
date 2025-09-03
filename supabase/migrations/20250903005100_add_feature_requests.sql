-- Create feature_requests table for in-app feature suggestions
create extension if not exists pgcrypto;

create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  category text not null,
  platform text,
  os_version text,
  screen text,
  app_version text,
  extra jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists feature_requests_created_at_idx on public.feature_requests(created_at desc);
create index if not exists feature_requests_user_id_idx on public.feature_requests(user_id);
create index if not exists feature_requests_status_idx on public.feature_requests(status);
create index if not exists feature_requests_category_idx on public.feature_requests(category);

-- Enable RLS
alter table public.feature_requests enable row level security;

-- Policies
-- Insert for authenticated users
drop policy if exists feature_requests_insert_authenticated on public.feature_requests;
create policy feature_requests_insert_authenticated
  on public.feature_requests
  for insert
  to authenticated
  with check (true);

-- Select own rows
drop policy if exists feature_requests_select_own on public.feature_requests;
create policy feature_requests_select_own
  on public.feature_requests
  for select
  to authenticated
  using (auth.uid() = user_id);
