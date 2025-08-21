-- Enforce uniqueness for devotional prayers to prevent duplicates created by rapid taps
-- Unique on (user_id, prayer_type, selected_date, devotional_title, day_number) when prayer_type = 'devotional'

create unique index if not exists prayers_devotional_unique_idx
on public.prayers (user_id, prayer_type, selected_date, devotional_title, day_number)
where prayer_type = 'devotional';
