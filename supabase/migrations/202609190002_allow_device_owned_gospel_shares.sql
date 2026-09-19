-- Journal by SiFia does not require accounts. A device-owned secret lets a
-- person create private Gospel links without creating an auth user.
alter table public.gospel_share_links
  alter column sender_user_id drop not null;

alter table public.gospel_share_links
  add column if not exists owner_key_hash text;

create index if not exists gospel_share_links_owner_key_idx
  on public.gospel_share_links(owner_key_hash, created_at desc)
  where owner_key_hash is not null;
