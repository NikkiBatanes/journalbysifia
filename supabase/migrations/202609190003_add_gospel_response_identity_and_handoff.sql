alter table public.gospel_shared_responses
  add column if not exists responder_name text,
  add column if not exists spiritual_birthday date,
  add column if not exists claim_token_hash text unique,
  add column if not exists claimed_at timestamptz;

alter table public.gospel_shared_responses
  add constraint gospel_shared_response_name_length
  check (responder_name is null or char_length(responder_name) between 1 and 80);
