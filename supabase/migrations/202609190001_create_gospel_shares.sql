create extension if not exists pgcrypto;

create table if not exists public.gospel_share_links (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_display_name text,
  person_id text,
  token_hash text not null unique,
  source_product text not null default 'journal_by_sifia',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  constraint gospel_share_sender_name_length check (char_length(sender_display_name) <= 80)
);

create table if not exists public.gospel_shared_responses (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null unique references public.gospel_share_links(id) on delete cascade,
  response text not null check (response in ('trusted_jesus_today', 'has_questions', 'not_ready', 'already_follows_jesus')),
  optional_message text check (char_length(optional_message) <= 1000),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.gospel_share_links enable row level security;
alter table public.gospel_shared_responses enable row level security;

create policy "Senders can read their Gospel links"
on public.gospel_share_links for select to authenticated
using (sender_user_id = auth.uid());

create policy "Senders can revoke their Gospel links"
on public.gospel_share_links for update to authenticated
using (sender_user_id = auth.uid())
with check (sender_user_id = auth.uid());

create policy "Senders can read consented Gospel responses"
on public.gospel_shared_responses for select to authenticated
using (exists (
  select 1 from public.gospel_share_links link
  where link.id = share_link_id and link.sender_user_id = auth.uid()
));

create index if not exists gospel_share_links_sender_created_idx
on public.gospel_share_links(sender_user_id, created_at desc);

