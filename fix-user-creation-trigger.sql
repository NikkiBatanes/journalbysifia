-- Fix the handle_new_user() function to match the ACTUAL user_profiles schema
-- This should resolve the "Database error saving new user" issue

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Extract names from user metadata or email
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    split_part(NEW.email, '@', 1)
  );
  
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    ''
  );

  -- Insert user profile with the ACTUAL schema fields
  INSERT INTO user_profiles (
    id,
    email,
    username,
    first_name,
    last_name,
    avatar_url,
    bio,
    phone,
    website,
    preferences,
    notification_preferences,
    faith_points,
    growth_level,
    total_faith_points_earned,
    current_streak,
    longest_streak,
    last_activity_date,
    gamification_stats,
    email_verified,
    last_login_at,
    last_active_at,
    last_notification_check,
    created_at,
    updated_at,
    country_code,
    timezone,
    locale,
    onboarding_completed
  ) VALUES (
    NEW.id,
    NEW.email,
    NULL, -- username (nullable)
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'avatar_url',
    NULL, -- bio (nullable)
    NULL, -- phone (nullable)
    NULL, -- website (nullable)
    -- Default preferences (matches schema default)
    '{"content": {"language": "en", "bible_version": "NIV"}, "privacy": {"activity_status": true, "profile_visibility": "private"}, "appearance": {"theme": "system", "font_size": "medium", "reduced_motion": false}, "notifications": {"push": true, "email": true, "marketing": false, "reminder_time": "09:00"}}'::jsonb,
    -- Default notification_preferences (matches schema default)
    '{"bible": {"preferredVersion": "NIV", "availableVersions": ["NIV", "ESV", "NASB", "KJV", "NKJV", "NLT", "CSB", "MSG"]}, "theme": "system", "system": {"timezone": "UTC", "pushEnabled": true, "emailEnabled": true}, "prayers": {"actsReminders": {"enabled": true, "schedule": [{"time": "07:00", "type": "adoration"}, {"time": "12:00", "type": "confession"}, {"time": "15:00", "type": "thanksgiving"}, {"time": "19:00", "type": "supplication"}]}, "unprayedPeople": {"time": "09:00", "enabled": true, "frequency": "daily"}, "prayNowReminders": {"time": "08:00", "enabled": true}, "answeredPrayersReview": {"time": "10:00", "enabled": true, "dayOfWeek": 0, "frequency": "weekly", "reviewPeriods": ["week", "month", "quarter", "halfYear", "year"]}}, "fontSize": "medium", "todayWin": {"dailyReminder": {"time": "19:00", "enabled": true}, "missedDayReminder": {"time": "21:30", "enabled": true}}, "devotions": {"unprayedPrayers": {"time": "18:00", "enabled": true}, "unansweredQuestions": {"time": "17:00", "enabled": true}}, "gratitude": {"dailyReminder": {"time": "20:00", "enabled": true, "minEntries": 3}, "missedDayReminder": {"time": "21:00", "enabled": true}}, "actionSteps": {"remindProgress": {"time": "12:00", "enabled": true, "frequency": "daily"}, "remindUnfinishedSubtasks": {"time": "18:00", "enabled": true, "remindAfterHours": 24}}, "colorScheme": "default", "affirmations": {"time": "08:00", "enabled": true, "sources": ["favorites", "recent"]}, "reflectionLog": {"guidedPrompts": {"time": "08:30", "enabled": true, "frequency": "daily"}}, "lookingForward": {"eveningReminder": {"time": "21:00", "enabled": true}, "nextDayReminder": {"time": "07:00", "enabled": true}}, "playbookChallenges": {"acceptedChallenge": {"enabled": true, "reminderTime": "10:00", "remindBeforeEnd": 1, "progressThresholds": [25, 50, 75]}, "incompleteChallenge": {"enabled": true, "reminderTime": "11:00", "remindAfterDaysInactive": 3}}}'::jsonb,
    0, -- faith_points
    'Seedling', -- growth_level
    0, -- total_faith_points_earned
    0, -- current_streak
    0, -- longest_streak
    NULL, -- last_activity_date (nullable)
    -- Default gamification_stats (matches schema default)
    '{"weekly_stats": {"week_start_date": null, "prayers_this_week": 0, "devotionals_this_week": 0, "gratitude_days_this_week": 0, "journal_entries_this_week": 0, "todos_completed_this_week": 0, "priorities_completed_this_week": 0}, "badges_earned": [], "monthly_stats": {"month_start_date": null, "prayers_this_month": 0, "devotionals_this_month": 0, "gratitude_days_this_month": 0, "goals_completed_this_month": 0, "todos_completed_this_month": 0, "financial_activities_this_month": 0, "priorities_completed_this_month": 0}, "daily_tracking": {"last_gratitude_date": null, "last_win_recorded_date": null, "last_todo_completed_date": null, "last_looking_forward_date": null, "last_daily_goals_check_date": null, "last_financial_activity_date": null, "last_priority_completed_date": null}, "donations_made": 0, "daily_goals_met": 0, "financial_stats": {"tithing_entries": 0, "financial_goals_met": 0, "savings_goals_achieved": 0, "stewardship_activities": 0, "budget_entries_completed": 0, "charitable_giving_entries": 0, "debt_reduction_milestones": 0, "financial_prayers_recorded": 0}, "goals_completed": 0, "journal_entries": 0, "prayer_sessions": 0, "tasks_completed": 0, "themes_unlocked": ["pink"], "todos_completed": 0, "answered_prayers": 0, "playbooks_shared": 0, "gratitude_entries": 0, "people_prayed_for": 0, "playbooks_created": 0, "daily_goals_streak": 0, "devotionals_prayed": 0, "subtasks_completed": 0, "templates_unlocked": [], "daily_wins_recorded": 0, "milestones_achieved": [], "min_words_journaled": 0, "total_people_prayed": 0, "devotionals_finished": 0, "priorities_completed": 0, "total_donated_amount": 0, "daily_todos_completed": 0, "devotional_day_streaks": 0, "gratitude_daily_streak": 0, "prayer_requests_prayed": 0, "looking_forward_entries": 0, "longest_gratitude_streak": 0, "longest_devotional_streak": 0, "daily_priorities_completed": 0, "devotionals_per_day_record": 0, "longest_daily_goals_streak": 0, "journaled_questions_pondered": 0, "gratitude_days_with_min_3_items": 0}'::jsonb,
    FALSE, -- email_verified
    NOW(), -- last_login_at
    NOW(), -- last_active_at
    NULL, -- last_notification_check (nullable)
    NOW(), -- created_at
    NOW(), -- updated_at
    COALESCE(NEW.raw_user_meta_data->>'country', 'US'), -- country_code
    'UTC', -- timezone
    'en', -- locale
    FALSE -- onboarding_completed
  );
  
  -- Start trial automatically (keep existing subscription logic)
  INSERT INTO subscriptions (
    user_id,
    tier,
    status,
    trial_started_at,
    trial_ends_at,
    market
  ) VALUES (
    NEW.id,
    'free_trial',
    'active',
    NOW(),
    NOW() + INTERVAL '3 days',
    COALESCE(NEW.raw_user_meta_data->>'country', 'US')
  );
  
  -- Initialize usage tracking (keep existing logic)
  INSERT INTO usage_tracking (user_id, subscription_id)
  SELECT NEW.id, s.id FROM subscriptions s WHERE s.user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' SECURITY DEFINER;

-- The trigger should already exist, but recreate it to be sure
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
