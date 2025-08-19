

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."acceptance_context" AS ENUM (
    'childhood',
    'teenager',
    'adult',
    'recent',
    'unsure',
    'not_yet'
);


ALTER TYPE "public"."acceptance_context" OWNER TO "postgres";


CREATE TYPE "public"."activity_type" AS ENUM (
    'prayer',
    'scripture',
    'reflection',
    'service',
    'worship',
    'gratitude',
    'fasting',
    'meditation'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."baptism_status" AS ENUM (
    'yes',
    'no',
    'planning',
    'not_applicable'
);


ALTER TYPE "public"."baptism_status" OWNER TO "postgres";


CREATE TYPE "public"."bible_reading_frequency" AS ENUM (
    'never',
    'rarely',
    'weekly',
    'daily',
    'multiple_daily'
);


ALTER TYPE "public"."bible_reading_frequency" OWNER TO "postgres";


CREATE TYPE "public"."challenge_difficulty" AS ENUM (
    'beginner',
    'intermediate',
    'advanced'
);


ALTER TYPE "public"."challenge_difficulty" OWNER TO "postgres";


CREATE TYPE "public"."challenge_duration_type" AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'custom'
);


ALTER TYPE "public"."challenge_duration_type" OWNER TO "postgres";


CREATE TYPE "public"."challenge_status" AS ENUM (
    'active',
    'completed',
    'paused',
    'abandoned'
);


ALTER TYPE "public"."challenge_status" OWNER TO "postgres";


CREATE TYPE "public"."church_attendance_frequency" AS ENUM (
    'never',
    'rarely',
    'monthly',
    'weekly',
    'multiple_weekly'
);


ALTER TYPE "public"."church_attendance_frequency" OWNER TO "postgres";


CREATE TYPE "public"."content_length_preference" AS ENUM (
    'short',
    'medium',
    'long'
);


ALTER TYPE "public"."content_length_preference" OWNER TO "postgres";


CREATE TYPE "public"."generation_type" AS ENUM (
    'playbook',
    'devotional',
    'expansion',
    'regeneration'
);


ALTER TYPE "public"."generation_type" OWNER TO "postgres";


CREATE TYPE "public"."intelligence_level" AS ENUM (
    'basic',
    'enhanced',
    'advanced'
);


ALTER TYPE "public"."intelligence_level" OWNER TO "postgres";


CREATE TYPE "public"."journal_type_enum" AS ENUM (
    'reflection',
    'gratitude',
    'prayer',
    'timeblock',
    'focus',
    'win',
    'forward',
    'todos',
    'financial_tithing',
    'financial_savings',
    'financial_expenses',
    'financial_investment'
);


ALTER TYPE "public"."journal_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."learning_style" AS ENUM (
    'visual',
    'auditory',
    'kinesthetic',
    'reading'
);


ALTER TYPE "public"."learning_style" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'IN_APP',
    'EMAIL',
    'PUSH',
    'SMS'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'SYSTEM',
    'REMINDER',
    'ACTIVITY',
    'ACHIEVEMENT',
    'PROMOTIONAL'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."onboarding_step_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped',
    'abandoned'
);


ALTER TYPE "public"."onboarding_step_status" OWNER TO "postgres";


CREATE TYPE "public"."personality_type" AS ENUM (
    'contemplative',
    'active',
    'social',
    'studious'
);


ALTER TYPE "public"."personality_type" OWNER TO "postgres";


CREATE TYPE "public"."prayer_frequency" AS ENUM (
    'never',
    'rarely',
    'weekly',
    'daily',
    'multiple_daily'
);


ALTER TYPE "public"."prayer_frequency" OWNER TO "postgres";


CREATE TYPE "public"."queue_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."queue_status" OWNER TO "postgres";


CREATE TYPE "public"."spiritual_maturity_level" AS ENUM (
    'new_believer',
    'growing',
    'mature',
    'leader',
    'unsure'
);


ALTER TYPE "public"."spiritual_maturity_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_faith_points"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_activity_description" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reference_type" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_old_level TEXT;
  v_new_level TEXT;
  v_current_streak INTEGER;
BEGIN
  -- Get current user stats
  SELECT faith_points, growth_level, current_streak
  INTO v_current_points, v_old_level, v_current_streak
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Calculate new points
  v_new_points := v_current_points + p_points;
  
  -- Determine new growth level
  SELECT level_name INTO v_new_level
  FROM growth_levels
  WHERE v_new_points >= min_faith_points
    AND (max_faith_points IS NULL OR v_new_points <= max_faith_points)
  ORDER BY min_faith_points DESC
  LIMIT 1;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    faith_points = v_new_points,
    total_faith_points_earned = total_faith_points_earned + GREATEST(p_points, 0),
    growth_level = COALESCE(v_new_level, growth_level),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the transaction
  INSERT INTO faith_points_log (
    user_id,
    points_earned,
    activity_type,
    activity_description,
    reference_id,
    reference_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_points,
    p_activity_type,
    p_activity_description,
    p_reference_id,
    p_reference_type,
    p_metadata,
    NOW()
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error awarding faith points: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."award_faith_points"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_activity_description" "text", "p_reference_id" "uuid", "p_reference_type" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_devotional_progress"("devotional_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_days_count INTEGER;
  completed_days_count INTEGER;
  calculated_progress INTEGER;
BEGIN
  -- Get total days
  SELECT total_days INTO total_days_count
  FROM devotionals 
  WHERE id = devotional_id;
  
  -- Count completed days from JSON
  SELECT COUNT(*)::INTEGER INTO completed_days_count
  FROM devotionals,
       jsonb_array_elements(days) AS day_elem
  WHERE id = devotional_id
    AND (day_elem->>'completed')::boolean = true;
  
  -- Calculate progress percentage
  IF total_days_count > 0 THEN
    calculated_progress := ROUND((completed_days_count::DECIMAL / total_days_count::DECIMAL) * 100);
  ELSE
    calculated_progress := 0;
  END IF;
  
  -- Update the devotional record
  UPDATE devotionals 
  SET progress = calculated_progress,
      current_day = LEAST(completed_days_count + 1, total_days_count)
  WHERE id = devotional_id;
  
  RETURN calculated_progress;
END;
$$;


ALTER FUNCTION "public"."calculate_devotional_progress"("devotional_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_onboarding_metrics"() RETURNS TABLE("step_name" "text", "completion_rate" double precision, "average_time_spent" integer, "skip_rate" double precision, "total_users" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.step_name,
    AVG(CASE WHEN sa.completion_method = 'completed' THEN 1.0 ELSE 0.0 END) as completion_rate,
    AVG(sa.time_spent_seconds)::INTEGER as average_time_spent,
    AVG(CASE WHEN sa.completion_method = 'skipped' THEN 1.0 ELSE 0.0 END) as skip_rate,
    COUNT(DISTINCT sa.user_id)::INTEGER as total_users
  FROM onboarding_step_analytics sa
  WHERE sa.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY sa.step_name
  ORDER BY sa.step_name;
END;
$$;


ALTER FUNCTION "public"."calculate_onboarding_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_playbook_progress"("playbook_uuid" "uuid") RETURNS TABLE("completed_tasks" integer, "total_tasks" integer, "progress_percentage" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    completed_count INTEGER := 0;
    total_count INTEGER := 0;
    step_record RECORD;
    subtask_count INTEGER;
    completed_subtask_count INTEGER;
BEGIN
    -- Count action steps and their sub-tasks
    FOR step_record IN 
        SELECT id, completed 
        FROM playbook_action_steps 
        WHERE playbook_id = playbook_uuid
    LOOP
        -- Check if this step has sub-tasks
        SELECT COUNT(*) INTO subtask_count
        FROM playbook_sub_tasks 
        WHERE action_step_id = step_record.id;
        
        IF subtask_count > 0 THEN
            -- Count sub-tasks for this step
            SELECT COUNT(*) INTO completed_subtask_count
            FROM playbook_sub_tasks 
            WHERE action_step_id = step_record.id AND completed = TRUE;
            
            completed_count := completed_count + completed_subtask_count;
            total_count := total_count + subtask_count;
        ELSE
            -- Count the step itself if no sub-tasks
            IF step_record.completed THEN
                completed_count := completed_count + 1;
            END IF;
            total_count := total_count + 1;
        END IF;
    END LOOP;
    
    -- Count affirmations
    SELECT 
        COUNT(*) FILTER (WHERE completed = TRUE),
        COUNT(*)
    INTO completed_subtask_count, subtask_count
    FROM playbook_affirmations 
    WHERE playbook_id = playbook_uuid;
    
    completed_count := completed_count + completed_subtask_count;
    total_count := total_count + subtask_count;
    
    -- Calculate percentage
    completed_tasks := completed_count;
    total_tasks := total_count;
    
    IF total_count > 0 THEN
        progress_percentage := ROUND((completed_count::NUMERIC / total_count::NUMERIC) * 100, 2);
    ELSE
        progress_percentage := 0;
    END IF;
    
    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."calculate_playbook_progress"("playbook_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_retention_risk"("target_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "risk_score" integer, "risk_factors" "text"[], "recommended_actions" "text"[], "last_engagement" timestamp with time zone, "value_score" integer, "tier_history" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_risk_factors TEXT[] := ARRAY[]::TEXT[];
  v_recommended_actions TEXT[] := ARRAY[]::TEXT[];
  v_last_engagement TIMESTAMPTZ;
  v_value_score INTEGER := 0;
  v_tier_history JSONB;
  v_current_tier TEXT;
  v_days_since_last_activity INTEGER;
  v_usage_count INTEGER;
BEGIN
  -- Get current subscription info
  SELECT s.tier INTO v_current_tier
  FROM subscriptions s
  WHERE s.user_id = target_user_id AND s.status = 'active'
  LIMIT 1;

  -- Get last engagement from user_events table
  SELECT MAX(ue.created_at) INTO v_last_engagement
  FROM user_events ue
  WHERE ue.user_id = target_user_id;

  -- If no user_events, try user_behavior_events
  IF v_last_engagement IS NULL THEN
    SELECT MAX(ube.created_at) INTO v_last_engagement
    FROM user_behavior_events ube
    WHERE ube.user_id = target_user_id;
  END IF;

  -- Calculate days since last activity
  v_days_since_last_activity := COALESCE(EXTRACT(DAY FROM NOW() - v_last_engagement), 999);

  -- Get usage count from usage_tracking
  SELECT COALESCE(playbooks_generated + devotionals_generated + export_count, 0) INTO v_usage_count
  FROM usage_tracking
  WHERE user_id = target_user_id
  LIMIT 1;

  -- Calculate base risk score
  v_risk_score := 0;

  -- Risk factor: Days since last activity
  IF v_days_since_last_activity > 14 THEN
    v_risk_score := v_risk_score + 30;
    v_risk_factors := array_append(v_risk_factors, 'inactive_for_2_weeks');
    v_recommended_actions := array_append(v_recommended_actions, 'send_re_engagement_email');
  ELSIF v_days_since_last_activity > 7 THEN
    v_risk_score := v_risk_score + 15;
    v_risk_factors := array_append(v_risk_factors, 'inactive_for_1_week');
    v_recommended_actions := array_append(v_recommended_actions, 'send_gentle_reminder');
  END IF;

  -- Risk factor: Low usage
  IF v_usage_count = 0 THEN
    v_risk_score := v_risk_score + 25;
    v_risk_factors := array_append(v_risk_factors, 'no_usage');
    v_recommended_actions := array_append(v_recommended_actions, 'offer_onboarding_help');
  ELSIF v_usage_count < 3 THEN
    v_risk_score := v_risk_score + 10;
    v_risk_factors := array_append(v_risk_factors, 'low_usage');
  END IF;

  -- Risk factor: Free trial user
  IF v_current_tier = 'free_trial' THEN
    v_risk_score := v_risk_score + 15;
    v_risk_factors := array_append(v_risk_factors, 'free_trial_user');
    v_recommended_actions := array_append(v_recommended_actions, 'show_upgrade_benefits');
  END IF;

  -- Calculate value score (inverse of risk, plus positive factors)
  v_value_score := 100 - v_risk_score;

  -- Positive factors for value score
  IF v_usage_count > 10 THEN
    v_value_score := v_value_score + 20;
  END IF;

  IF v_current_tier IN ('transformation', 'family') THEN
    v_value_score := v_value_score + 15;
  END IF;

  -- Cap scores
  v_risk_score := LEAST(v_risk_score, 100);
  v_value_score := GREATEST(LEAST(v_value_score, 100), 0);

  -- Build tier history from subscriptions
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier', s.tier,
      'start_date', s.created_at,
      'end_date', s.updated_at
    ) ORDER BY s.created_at
  ) INTO v_tier_history
  FROM subscriptions s
  WHERE s.user_id = target_user_id;

  -- Return results
  RETURN QUERY SELECT 
    target_user_id,
    v_risk_score,
    v_risk_factors,
    v_recommended_actions,
    v_last_engagement,
    v_value_score,
    COALESCE(v_tier_history, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."calculate_retention_risk"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_badge_achievements"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_badge RECORD;
  v_user_stats JSONB;
  v_stat_value INTEGER;
  v_badges_awarded INTEGER := 0;
BEGIN
  -- Get user's current stats
  SELECT gamification_stats INTO v_user_stats
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Check each badge requirement
  FOR v_badge IN 
    SELECT b.* FROM badges b
    WHERE b.id NOT IN (
      SELECT badge_id FROM user_badges WHERE user_id = p_user_id
    )
  LOOP
    -- Get the relevant stat value
    v_stat_value := COALESCE((v_user_stats ->> v_badge.required_activity)::INTEGER, 0);
    
    -- Check if requirement is met
    IF v_stat_value >= v_badge.required_count THEN
      -- Award the badge
      INSERT INTO user_badges (user_id, badge_id, progress_when_earned)
      VALUES (p_user_id, v_badge.id, v_user_stats)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Award FaithPoints if applicable
      IF v_badge.faith_points_reward > 0 THEN
        PERFORM award_faith_points(
          p_user_id,
          v_badge.faith_points_reward,
          'badge_earned',
          'Earned badge: ' || v_badge.name,
          v_badge.id,
          'badge',
          jsonb_build_object('badge_name', v_badge.name, 'rarity', v_badge.rarity)
        );
      END IF;
      
      -- Send notification
      PERFORM queue_notification(
        p_user_id,
        'New Badge Earned! 🏆',
        'You''ve earned the "' || v_badge.name || '" badge! ' || COALESCE(v_badge.scripture_reference, ''),
        'ACHIEVEMENT'::notification_type,
        '{IN_APP, PUSH}'::notification_channel[],
        jsonb_build_object(
          'badge_id', v_badge.id,
          'badge_name', v_badge.name,
          'scripture', v_badge.scripture_verse,
          'reference', v_badge.scripture_reference
        )
      );
      
      v_badges_awarded := v_badges_awarded + 1;
    END IF;
  END LOOP;
  
  RETURN v_badges_awarded;
END;
$$;


ALTER FUNCTION "public"."check_badge_achievements"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_daily_goals_completion"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_stats JSONB;
  v_last_check_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
BEGIN
  -- Get current stats
  SELECT gamification_stats INTO v_current_stats
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Get last check date
  v_last_check_date := (v_current_stats -> 'daily_tracking' ->> 'last_daily_goals_check_date')::DATE;
  
  -- Only process if haven't checked today
  IF v_last_check_date != CURRENT_DATE THEN
    v_current_streak := COALESCE((v_current_stats ->> 'daily_goals_streak')::INTEGER, 0);
    v_longest_streak := COALESCE((v_current_stats ->> 'longest_daily_goals_streak')::INTEGER, 0);
    
    -- Calculate new streak
    IF v_last_check_date = CURRENT_DATE - INTERVAL '1 day' THEN
      v_new_streak := v_current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
    
    -- Update stats
    PERFORM update_user_stats(p_user_id, 'daily_goals_met');
    PERFORM update_user_stats(p_user_id, 'daily_goals_streak', v_new_streak - v_current_streak);
    
    -- Update longest streak if needed
    IF v_new_streak > v_longest_streak THEN
      PERFORM update_user_stats(p_user_id, 'longest_daily_goals_streak', v_new_streak - v_longest_streak);
    END IF;
    
    -- Update last check date
    UPDATE user_profiles
    SET gamification_stats = jsonb_set(
      gamification_stats,
      '{daily_tracking,last_daily_goals_check_date}',
      to_jsonb(CURRENT_DATE::TEXT)
    )
    WHERE id = p_user_id;
    
    -- Award FaithPoints
    PERFORM award_faith_points(
      p_user_id,
      25,
      'daily_goals_met',
      'Daily goals completed',
      NULL,
      'daily_goals'
    );
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_daily_goals_completion"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_overlapping_blocks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.time_blocks
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND (
            (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
            OR 
            (start_time <= NEW.start_time AND end_time >= NEW.end_time)
            OR
            (start_time >= NEW.start_time AND end_time <= NEW.end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Time block overlaps with an existing time block';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_overlapping_blocks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_trial_expirations"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE subscriptions 
  SET 
    status = 'trial_expired',
    updated_at = NOW()
  WHERE 
    tier = 'free_trial' 
    AND status = 'active'
    AND trial_ends_at < NOW();
END;
$$;


ALTER FUNCTION "public"."check_trial_expirations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean logs older than 90 days
    DELETE FROM application_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean security events older than 1 year
    DELETE FROM security_events 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Clean performance metrics older than 30 days
    DELETE FROM performance_metrics 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Clean system health metrics older than 7 days
    DELETE FROM system_health_metrics 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  table_name TEXT;
  cutoff_date DATE := CURRENT_DATE - INTERVAL '6 months';
BEGIN
  -- Clean up old monthly partitions
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE tablename ~ '^(faith_points_transactions|user_contexts|generated_content)_[0-9]{4}_[0-9]{2}$'
    AND tablename < 'faith_points_transactions_' || TO_CHAR(cutoff_date, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', table_name);
  END LOOP;
END;
$_$;


ALTER FUNCTION "public"."cleanup_old_partitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_user_profile"("p_user_id" "uuid", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_profile_data JSONB;
BEGIN
  -- Insert the default profile
  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    bio,
    avatar_url,
    faith_points,
    growth_level,
    total_faith_points_earned,
    current_streak,
    longest_streak,
    last_activity_date,
    email_verified,
    last_login_at,
    last_active_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    'User',
    '',
    '',
    NULL,
    0,
    'Seedling',
    0,
    0,
    0,
    CURRENT_DATE,
    FALSE,
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING to_jsonb(user_profiles.*) INTO v_profile_data;
  
  RETURN v_profile_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating default profile for user %: %', p_user_id, SQLERRM;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_default_user_profile"("p_user_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_devotional_from_playbook"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT ''::"text", "p_category" "text" DEFAULT 'Growth'::"text", "p_duration" integer DEFAULT 7) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_devotional_id UUID;
  playbook_title_cache TEXT;
BEGIN
  -- Get playbook title for caching
  SELECT title INTO playbook_title_cache
  FROM playbooks 
  WHERE id = p_playbook_id;
  
  -- Create the devotional
  INSERT INTO devotionals (
    user_id,
    title,
    description,
    category,
    categories,
    playbook_id,
    playbook_title,
    total_days,
    days
  ) VALUES (
    p_user_id,
    p_title,
    p_description,
    p_category,
    ARRAY[p_category],
    p_playbook_id,
    playbook_title_cache,
    p_duration,
    -- Generate empty days structure
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'dayNumber', day_num,
          'title', 'Day ' || day_num,
          'content', '',
          'reflection', '',
          'reflectionQuestions', '[]'::jsonb,
          'prayer', '',
          'scripture', jsonb_build_object('text', '', 'reference', ''),
          'completed', false,
          'completedAt', null
        )
      )
      FROM generate_series(1, p_duration) AS day_num
    )
  )
  RETURNING id INTO new_devotional_id;
  
  RETURN new_devotional_id;
END;
$$;


ALTER FUNCTION "public"."create_devotional_from_playbook"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_duration" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_free_trial_subscription"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  v_trial_end := NOW() + INTERVAL '3 days';
  
  INSERT INTO user_subscriptions (
    user_id,
    tier,
    status,
    trial_end_date,
    end_date,
    intelligence_enabled,
    advanced_analytics,
    export_features
  ) VALUES (
    p_user_id,
    'free_trial',
    'trialing',
    v_trial_end,
    v_trial_end,
    false,
    false,
    false
  ) RETURNING id INTO v_subscription_id;
  
  -- Create initial intelligence profile
  INSERT INTO user_intelligence_profiles (user_id) VALUES (p_user_id);
  
  RETURN v_subscription_id;
END;
$$;


ALTER FUNCTION "public"."create_free_trial_subscription"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_monthly_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
  tables TEXT[] := ARRAY['faith_points_transactions', 'user_contexts', 'generated_content'];
  table_name_base TEXT;
BEGIN
  FOREACH table_name_base IN ARRAY tables
  LOOP
    FOR i IN 1..3 LOOP -- Create 3 months ahead
      start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
      end_date := start_date + INTERVAL '1 month';
      table_name := table_name_base || '_' || TO_CHAR(start_date, 'YYYY_MM');
      
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
                      FOR VALUES FROM (%L) TO (%L)', 
                     table_name, table_name_base, start_date, end_date);
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."create_monthly_partitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enable_rls_on_all_tables"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'faith_points_transactions_%'
        OR tablename LIKE 'user_behavior_events_%'
        OR tablename LIKE 'generated_content_%'
        OR tablename LIKE 'generation_queue_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE 'Enabled RLS on %', r.tablename;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."enable_rls_on_all_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_metrics"("date_range_days" integer DEFAULT 30) RETURNS TABLE("metric_name" "text", "current_value" numeric, "previous_value" numeric, "change_percentage" numeric, "trend" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_start_date TIMESTAMPTZ := NOW() - (date_range_days || ' days')::INTERVAL;
  current_end_date TIMESTAMPTZ := NOW();
  previous_start_date TIMESTAMPTZ := NOW() - (date_range_days * 2 || ' days')::INTERVAL;
  previous_end_date TIMESTAMPTZ := NOW() - (date_range_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH current_metrics AS (
    SELECT 
      'total_active_subscriptions' as metric,
      COUNT(*)::NUMERIC as value
    FROM subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(COALESCE(amount, 0))::NUMERIC / 100.0 -- Convert cents to dollars
    FROM subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM subscriptions
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'total_users',
      COUNT(DISTINCT user_id)::NUMERIC
    FROM subscriptions
    
    UNION ALL
    
    SELECT 
      'total_playbooks',
      COUNT(*)::NUMERIC
    FROM playbooks
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'total_devotionals',
      COUNT(*)::NUMERIC
    FROM devotionals
    WHERE created_at >= current_start_date
  ),
  previous_metrics AS (
    SELECT 
      'total_active_subscriptions' as metric,
      COUNT(*)::NUMERIC as value
    FROM subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(COALESCE(amount, 0))::NUMERIC / 100.0
    FROM subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM subscriptions
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_users',
      COUNT(DISTINCT user_id)::NUMERIC
    FROM subscriptions
    WHERE created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_playbooks',
      COUNT(*)::NUMERIC
    FROM playbooks
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_devotionals',
      COUNT(*)::NUMERIC
    FROM devotionals
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
  )
  SELECT 
    cm.metric::TEXT,
    COALESCE(cm.value, 0),
    COALESCE(pm.value, 0),
    CASE 
      WHEN pm.value = 0 OR pm.value IS NULL THEN 0
      ELSE ((cm.value - pm.value) / pm.value * 100)
    END,
    CASE 
      WHEN pm.value = 0 OR pm.value IS NULL THEN 'no_data'
      WHEN cm.value > pm.value THEN 'up'
      WHEN cm.value < pm.value THEN 'down'
      ELSE 'stable'
    END::TEXT
  FROM current_metrics cm
  LEFT JOIN previous_metrics pm ON cm.metric = pm.metric
  ORDER BY cm.metric;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_metrics"("date_range_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feature_analytics"("feature_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("feature_name" "text", "total_usage" bigint, "unique_users" bigint, "average_usage_per_user" numeric, "usage_by_tier" "jsonb", "average_load_time" numeric, "error_rate" numeric, "satisfaction_score" numeric, "trials_triggered" bigint, "upgrades_generated" bigint, "conversion_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH feature_events AS (
    SELECT 
      ue.event_name as feature_name,
      ue.user_id,
      s.tier,
      1 as usage_count
    FROM user_events ue
    LEFT JOIN subscriptions s ON ue.user_id = s.user_id AND s.status = 'active'
    WHERE ue.created_at >= NOW() - INTERVAL '30 days'
      AND (feature_filter IS NULL OR ue.event_name = feature_filter)
    
    UNION ALL
    
    -- Add data from user_behavior_events if available
    SELECT 
      ube.event_type as feature_name,
      ube.user_id,
      s.tier,
      1 as usage_count
    FROM user_behavior_events ube
    LEFT JOIN subscriptions s ON ube.user_id = s.user_id AND s.status = 'active'
    WHERE ube.created_at >= NOW() - INTERVAL '30 days'
      AND (feature_filter IS NULL OR ube.event_type = feature_filter)
  ),
  usage_stats AS (
    SELECT 
      fe.feature_name,
      COUNT(*) as total_usage,
      COUNT(DISTINCT fe.user_id) as unique_users,
      COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT fe.user_id), 0) as avg_usage_per_user,
      jsonb_object_agg(
        COALESCE(fe.tier, 'unknown'),
        COUNT(*)
      ) as usage_by_tier
    FROM feature_events fe
    GROUP BY fe.feature_name
  ),
  subscription_changes AS (
    SELECT 
      COUNT(CASE WHEN tier != 'free_trial' AND created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as upgrades_generated
    FROM subscriptions
  )
  SELECT 
    us.feature_name::TEXT,
    us.total_usage,
    us.unique_users,
    us.avg_usage_per_user,
    us.usage_by_tier,
    0::NUMERIC as average_load_time, -- Placeholder
    0::NUMERIC as error_rate, -- Placeholder
    75::NUMERIC as satisfaction_score, -- Placeholder
    0::BIGINT as trials_triggered, -- Placeholder
    sc.upgrades_generated,
    CASE 
      WHEN us.total_usage > 0 THEN (sc.upgrades_generated::NUMERIC / us.total_usage * 100)
      ELSE 0 
    END as conversion_rate
  FROM usage_stats us
  CROSS JOIN subscription_changes sc
  WHERE us.feature_name IS NOT NULL
  ORDER BY us.total_usage DESC;
END;
$$;


ALTER FUNCTION "public"."get_feature_analytics"("feature_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_performance_metrics"("timeframe_hours" integer DEFAULT 24) RETURNS TABLE("total_operations" bigint, "avg_duration_ms" numeric, "success_rate" numeric, "error_rate" numeric, "slowest_operations" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH perf_stats AS (
        SELECT 
            COUNT(*) as total,
            AVG(duration_ms) as avg_duration,
            COUNT(*) FILTER (WHERE success = true) as success_count,
            COUNT(*) FILTER (WHERE success = false) as error_count
        FROM performance_metrics 
        WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
    ),
    slow_ops AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'service', service,
                'operation', operation,
                'avg_duration_ms', avg_duration_ms
            ) ORDER BY avg_duration_ms DESC
        ) as operations
        FROM (
            SELECT 
                service, 
                operation, 
                AVG(duration_ms) as avg_duration_ms
            FROM performance_metrics 
            WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
            GROUP BY service, operation
            ORDER BY avg_duration_ms DESC
            LIMIT 10
        ) t
    )
    SELECT 
        perf_stats.total,
        perf_stats.avg_duration,
        CASE 
            WHEN perf_stats.total > 0 THEN (perf_stats.success_count::NUMERIC / perf_stats.total * 100)
            ELSE 0 
        END,
        CASE 
            WHEN perf_stats.total > 0 THEN (perf_stats.error_count::NUMERIC / perf_stats.total * 100)
            ELSE 0 
        END,
        COALESCE(slow_ops.operations, '[]'::jsonb)
    FROM perf_stats, slow_ops;
END;
$$;


ALTER FUNCTION "public"."get_performance_metrics"("timeframe_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_security_metrics"("timeframe_hours" integer DEFAULT 24) RETURNS TABLE("total_events" bigint, "critical_events" bigint, "high_events" bigint, "medium_events" bigint, "low_events" bigint, "top_event_types" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE severity = 'high') as high,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium,
            COUNT(*) FILTER (WHERE severity = 'low') as low
        FROM security_events 
        WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
    ),
    event_types AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'event_type', event_type,
                'count', count
            ) ORDER BY count DESC
        ) as types
        FROM (
            SELECT event_type, COUNT(*) as count
            FROM security_events 
            WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 5
        ) t
    )
    SELECT 
        event_stats.total,
        event_stats.critical,
        event_stats.high,
        event_stats.medium,
        event_stats.low,
        COALESCE(event_types.types, '[]'::jsonb)
    FROM event_stats, event_types;
END;
$$;


ALTER FUNCTION "public"."get_security_metrics"("timeframe_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_subscription_analytics"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS TABLE("tier" "text", "total_users" bigint, "active_users" bigint, "churn_rate" numeric, "average_revenue" numeric, "feature_usage" "jsonb", "conversion_rate" numeric, "retention_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH subscription_stats AS (
    SELECT 
      s.tier,
      COUNT(*) as total_users,
      COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_users,
      COUNT(CASE WHEN s.status = 'cancelled' AND s.updated_at BETWEEN start_date AND end_date THEN 1 END) as churned_users
    FROM subscriptions s
    WHERE s.created_at <= end_date
    GROUP BY s.tier
  ),
  revenue_stats AS (
    SELECT 
      s.tier,
      AVG(COALESCE(s.amount, 0)) / 100.0 as avg_revenue -- Convert cents to dollars
    FROM subscriptions s
    WHERE s.status = 'active'
    GROUP BY s.tier
  ),
  feature_usage_stats AS (
    SELECT 
      s.tier,
      jsonb_build_object(
        'playbooks_used', COALESCE(AVG(ut.playbooks_generated), 0),
        'devotionals_used', COALESCE(AVG(ut.devotionals_generated), 0),
        'exports_used', COALESCE(AVG(ut.export_count), 0),
        'api_calls_used', COALESCE(AVG(ut.api_calls_made), 0)
      ) as feature_usage
    FROM subscriptions s
    LEFT JOIN usage_tracking ut ON s.user_id = ut.user_id 
      AND ut.last_reset_date >= start_date::date
    GROUP BY s.tier
  ),
  conversion_stats AS (
    SELECT 
      s.tier,
      COUNT(CASE WHEN s.created_at BETWEEN start_date AND end_date THEN 1 END)::NUMERIC / 
      NULLIF(COUNT(CASE WHEN s.tier = 'free_trial' AND s.created_at BETWEEN start_date - INTERVAL '30 days' AND start_date THEN 1 END), 0) as conversion_rate
    FROM subscriptions s
    GROUP BY s.tier
  )
  SELECT 
    ss.tier::TEXT,
    ss.total_users,
    ss.active_users,
    CASE WHEN ss.total_users > 0 THEN (ss.churned_users::NUMERIC / ss.total_users * 100) ELSE 0 END as churn_rate,
    COALESCE(rs.avg_revenue, 0) as average_revenue,
    COALESCE(fus.feature_usage, '{}'::jsonb) as feature_usage,
    COALESCE(cs.conversion_rate * 100, 0) as conversion_rate,
    CASE WHEN ss.total_users > 0 THEN ((ss.active_users::NUMERIC / ss.total_users) * 100) ELSE 0 END as retention_rate
  FROM subscription_stats ss
  LEFT JOIN revenue_stats rs ON ss.tier = rs.tier
  LEFT JOIN feature_usage_stats fus ON ss.tier = fus.tier
  LEFT JOIN conversion_stats cs ON ss.tier = cs.tier
  ORDER BY ss.tier;
END;
$$;


ALTER FUNCTION "public"."get_subscription_analytics"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_usage_counter"("p_user_id" "uuid", "p_period" "text", "p_type" "text", "p_tokens_used" integer DEFAULT 0, "p_cost_cents" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO usage_tracking (
    user_id, 
    period, 
    playbooks_used, 
    devotionals_used,
    ai_tokens_used,
    ai_cost_cents
  )
  VALUES (
    p_user_id, 
    p_period, 
    CASE WHEN p_type = 'playbook' THEN 1 ELSE 0 END,
    CASE WHEN p_type = 'devotional' THEN 1 ELSE 0 END,
    p_tokens_used,
    p_cost_cents
  )
  ON CONFLICT (user_id, period) 
  DO UPDATE SET
    playbooks_used = CASE 
      WHEN p_type = 'playbook' THEN usage_tracking.playbooks_used + 1 
      ELSE usage_tracking.playbooks_used 
    END,
    devotionals_used = CASE 
      WHEN p_type = 'devotional' THEN usage_tracking.devotionals_used + 1 
      ELSE usage_tracking.devotionals_used 
    END,
    ai_tokens_used = usage_tracking.ai_tokens_used + p_tokens_used,
    ai_cost_cents = usage_tracking.ai_cost_cents + p_cost_cents,
    last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_usage_counter"("p_user_id" "uuid", "p_period" "text", "p_type" "text", "p_tokens_used" integer, "p_cost_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_usage_tracking"("target_user_id" "uuid", "target_period" "text", "field_name" "text", "increment_by" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert or update usage tracking record using existing schema
  INSERT INTO usage_tracking (
    user_id, 
    subscription_id,
    playbooks_generated,
    devotionals_generated,
    export_count,
    api_calls_made,
    last_reset_date,
    updated_at
  )
  VALUES (
    target_user_id,
    (SELECT id FROM subscriptions WHERE user_id = target_user_id AND status = 'active' LIMIT 1),
    CASE WHEN field_name = 'playbooks_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'devotionals_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'exports_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'api_calls_used' THEN increment_by ELSE 0 END,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (user_id, subscription_id)
  DO UPDATE SET
    playbooks_generated = CASE WHEN field_name = 'playbooks_used' THEN usage_tracking.playbooks_generated + increment_by ELSE usage_tracking.playbooks_generated END,
    devotionals_generated = CASE WHEN field_name = 'devotionals_used' THEN usage_tracking.devotionals_generated + increment_by ELSE usage_tracking.devotionals_generated END,
    export_count = CASE WHEN field_name = 'exports_used' THEN usage_tracking.export_count + increment_by ELSE usage_tracking.export_count END,
    api_calls_made = CASE WHEN field_name = 'api_calls_used' THEN usage_tracking.api_calls_made + increment_by ELSE usage_tracking.api_calls_made END,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_usage_tracking"("target_user_id" "uuid", "target_period" "text", "field_name" "text", "increment_by" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_onboarding"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_progress_id UUID;
BEGIN
  -- Create onboarding progress record
  INSERT INTO onboarding_progress (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_progress_id;
  
  -- Create empty faith journey profile
  INSERT INTO faith_journey_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create empty personalization profile
  INSERT INTO onboarding_personalization_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_progress_id;
END;
$$;


ALTER FUNCTION "public"."initialize_onboarding"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_devotional_day_complete"("p_devotional_id" "uuid", "p_day_number" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_days JSONB;
BEGIN
  -- Update the specific day in the days array
  UPDATE devotionals
  SET days = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'dayNumber')::INTEGER = p_day_number 
        THEN elem || jsonb_build_object('completed', true, 'completedAt', NOW())
        ELSE elem
      END
    )
    FROM jsonb_array_elements(days) AS elem
  )
  WHERE id = p_devotional_id
    AND auth.uid() = user_id;
  
  -- Recalculate progress
  PERFORM calculate_devotional_progress(p_devotional_id);
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_devotional_day_complete"("p_devotional_id" "uuid", "p_day_number" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_pending_notifications"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_notification RECORD;
  v_user_prefs JSONB;
  v_channel notification_channel;
  v_should_send BOOLEAN;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Process notifications that are pending and scheduled for now or earlier
  FOR v_notification IN 
    SELECT * FROM notifications 
    WHERE status = 'PENDING' 
    AND scheduled_for <= v_now
    AND (expires_at IS NULL OR expires_at > v_now)
    ORDER BY priority DESC, scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT 100  -- Process in batches
  LOOP
    -- Get user preferences (simplified example)
    SELECT notification_preferences INTO v_user_prefs 
    FROM user_profiles 
    WHERE id = v_notification.user_id;
    
    -- Process each channel
    FOREACH v_channel IN ARRAY v_notification.channels
    LOOP
      -- Check if channel is enabled in user preferences (simplified)
      v_should_send := true;  -- Default to true, implement actual checks
      
      IF v_should_send THEN
        -- Log the notification attempt
        INSERT INTO notification_logs (
          notification_id,
          user_id,
          channel,
          status
        ) VALUES (
          v_notification.id,
          v_notification.user_id,
          v_channel,
          'SENT'  -- Simplified, would be 'PENDING' for async processing
        );
      END IF;
    END LOOP;
    
    -- Mark as sent
    UPDATE notifications 
    SET status = 'SENT',
        sent_at = v_now,
        updated_at = v_now
    WHERE id = v_notification.id;
    
    v_processed_count := v_processed_count + 1;
  END LOOP;
  
  RETURN v_processed_count;
END;
$$;


ALTER FUNCTION "public"."process_pending_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "public"."notification_type", "p_channels" "public"."notification_channel"[] DEFAULT '{IN_APP}'::"public"."notification_channel"[], "p_data" "jsonb" DEFAULT NULL::"jsonb", "p_image_url" "text" DEFAULT NULL::"text", "p_action_url" "text" DEFAULT NULL::"text", "p_scheduled_for" timestamp with time zone DEFAULT "now"(), "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_priority" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    channels,
    data,
    image_url,
    action_url,
    scheduled_for,
    expires_at,
    priority
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_channels,
    p_data,
    p_image_url,
    p_action_url,
    p_scheduled_for,
    p_expires_at,
    p_priority
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "public"."notification_type", "p_channels" "public"."notification_channel"[], "p_data" "jsonb", "p_image_url" "text", "p_action_url" "text", "p_scheduled_for" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_christ_acceptance"("p_user_id" "uuid", "p_acceptance_context" "public"."acceptance_context", "p_influenced_by" "text" DEFAULT NULL::"text", "p_content_id" "uuid" DEFAULT NULL::"uuid", "p_prayer_text" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Record the acceptance event
  INSERT INTO christ_acceptance_events (
    user_id,
    acceptance_context,
    influenced_by,
    specific_content_id,
    prayer_text
  ) VALUES (
    p_user_id,
    p_acceptance_context,
    p_influenced_by,
    p_content_id,
    p_prayer_text
  ) RETURNING id INTO v_event_id;
  
  -- Update faith journey profile
  UPDATE faith_journey_profiles 
  SET 
    has_accepted_christ = TRUE,
    acceptance_date = CURRENT_DATE,
    acceptance_context = p_acceptance_context,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION "public"."record_christ_acceptance"("p_user_id" "uuid", "p_acceptance_context" "public"."acceptance_context", "p_influenced_by" "text", "p_content_id" "uuid", "p_prayer_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_daily_win"("p_user_id" "uuid", "p_entry_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update stats
  PERFORM update_user_stats(p_user_id, 'daily_wins_recorded');
  
  -- Update last win recorded date
  UPDATE user_profiles
  SET gamification_stats = jsonb_set(
    gamification_stats,
    '{daily_tracking,last_win_recorded_date}',
    to_jsonb(CURRENT_DATE::TEXT)
  )
  WHERE id = p_user_id;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    20,
    'daily_win_recorded',
    'Daily win recorded',
    p_entry_id,
    'journal'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_daily_win"("p_user_id" "uuid", "p_entry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_was_prayed" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update devotionals finished
  PERFORM update_user_stats(p_user_id, 'devotionals_finished');
  
  -- Update prayed devotionals if applicable
  IF p_was_prayed THEN
    PERFORM update_user_stats(p_user_id, 'devotionals_prayed');
  END IF;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    40,
    'devotional_completed',
    'Devotional completed',
    p_devotional_id,
    'devotional'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_was_prayed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_day_number" integer DEFAULT 1, "p_was_prayed" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_points INTEGER := 40;  -- Base points for completion
BEGIN
  -- Bonus points if prayed
  IF p_was_prayed THEN
    v_points := v_points + 10;
  END IF;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    v_points,
    'devotional_completed',
    format('Completed devotional day %s', p_day_number),
    p_devotional_id,
    'devotional'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_day_number" integer, "p_was_prayed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_devotional_creation"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_total_days" integer DEFAULT 1) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_points INTEGER;
BEGIN
  -- Calculate points based on devotional length
  CASE 
    WHEN p_total_days >= 30 THEN v_points := 100;  -- 30+ day devotional
    WHEN p_total_days >= 7 THEN v_points := 50;    -- 7+ day devotional  
    WHEN p_total_days >= 3 THEN v_points := 30;    -- 3+ day devotional
    ELSE v_points := 20;                            -- 1-2 day devotional
  END CASE;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    v_points,
    'devotional_created',
    format('Created %s-day devotional', p_total_days),
    p_devotional_id,
    'devotional'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_devotional_creation"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_total_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_financial_activity"("p_user_id" "uuid", "p_activity_id" "uuid", "p_activity_type" "text", "p_amount" numeric DEFAULT NULL::numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_faith_points INTEGER;
  v_activity_description TEXT;
BEGIN
  -- Determine FaithPoints and description based on activity type
  CASE p_activity_type
    WHEN 'tithing' THEN
      PERFORM update_user_stats(p_user_id, 'tithing_entries', 1, jsonb_build_object('financial_stats', jsonb_build_object('tithing_entries', 1)));
      v_faith_points := 50;
      v_activity_description := 'Tithing entry recorded';
    
    WHEN 'budget' THEN
      PERFORM update_user_stats(p_user_id, 'budget_entries_completed', 1, jsonb_build_object('financial_stats', jsonb_build_object('budget_entries_completed', 1)));
      v_faith_points := 30;
      v_activity_description := 'Budget entry completed';
    
    WHEN 'goal' THEN
      PERFORM update_user_stats(p_user_id, 'financial_goals_met', 1, jsonb_build_object('financial_stats', jsonb_build_object('financial_goals_met', 1)));
      v_faith_points := 100;
      v_activity_description := 'Financial goal achieved';
    
    WHEN 'giving' THEN
      PERFORM update_user_stats(p_user_id, 'charitable_giving_entries', 1, jsonb_build_object('financial_stats', jsonb_build_object('charitable_giving_entries', 1)));
      v_faith_points := 75;
      v_activity_description := 'Charitable giving recorded';
    
    WHEN 'debt_reduction' THEN
      PERFORM update_user_stats(p_user_id, 'debt_reduction_milestones', 1, jsonb_build_object('financial_stats', jsonb_build_object('debt_reduction_milestones', 1)));
      v_faith_points := 150;
      v_activity_description := 'Debt reduction milestone achieved';
    
    WHEN 'savings' THEN
      PERFORM update_user_stats(p_user_id, 'savings_goals_achieved', 1, jsonb_build_object('financial_stats', jsonb_build_object('savings_goals_achieved', 1)));
      v_faith_points := 100;
      v_activity_description := 'Savings goal achieved';
    
    WHEN 'prayer' THEN
      PERFORM update_user_stats(p_user_id, 'financial_prayers_recorded', 1, jsonb_build_object('financial_stats', jsonb_build_object('financial_prayers_recorded', 1)));
      v_faith_points := 20;
      v_activity_description := 'Financial prayer recorded';
    
    ELSE
      v_faith_points := 10;
      v_activity_description := 'Financial activity recorded';
  END CASE;
  
  -- Update last financial activity date
  UPDATE user_profiles
  SET gamification_stats = jsonb_set(
    gamification_stats,
    '{daily_tracking,last_financial_activity_date}',
    to_jsonb(CURRENT_DATE::TEXT)
  )
  WHERE id = p_user_id;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    v_faith_points,
    'financial_' || p_activity_type,
    v_activity_description,
    p_activity_id,
    'financial'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_financial_activity"("p_user_id" "uuid", "p_activity_id" "uuid", "p_activity_type" "text", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_goal_completion"("p_user_id" "uuid", "p_goal_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update stats
  PERFORM update_user_stats(p_user_id, 'goals_completed');
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    75,
    'goal_completed',
    'Goal completed successfully',
    p_goal_id,
    'goal'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_goal_completion"("p_user_id" "uuid", "p_goal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_gratitude_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_gratitude_items_count" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_stats JSONB;
  v_last_gratitude_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
  v_faith_points INTEGER := 30;
BEGIN
  -- Get current stats
  SELECT gamification_stats INTO v_current_stats
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Update gratitude entries count
  PERFORM update_user_stats(p_user_id, 'gratitude_entries');
  
  -- Get last gratitude date
  v_last_gratitude_date := (v_current_stats -> 'daily_tracking' ->> 'last_gratitude_date')::DATE;
  
  -- Check if this qualifies for minimum 3 items (only once per day)
  IF p_gratitude_items_count >= 3 AND v_last_gratitude_date != CURRENT_DATE THEN
    -- Update minimum 3 items count
    PERFORM update_user_stats(p_user_id, 'gratitude_days_with_min_3_items');
    
    -- Handle streak calculation
    v_current_streak := COALESCE((v_current_stats ->> 'gratitude_daily_streak')::INTEGER, 0);
    v_longest_streak := COALESCE((v_current_stats ->> 'longest_gratitude_streak')::INTEGER, 0);
    
    -- Calculate new streak
    IF v_last_gratitude_date = CURRENT_DATE - INTERVAL '1 day' THEN
      v_new_streak := v_current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
    
    -- Update streak stats
    PERFORM update_user_stats(p_user_id, 'gratitude_daily_streak', v_new_streak - v_current_streak);
    
    -- Update longest streak if needed
    IF v_new_streak > v_longest_streak THEN
      PERFORM update_user_stats(p_user_id, 'longest_gratitude_streak', v_new_streak - v_longest_streak);
    END IF;
    
    -- Update last gratitude date
    UPDATE user_profiles
    SET gamification_stats = jsonb_set(
      gamification_stats,
      '{daily_tracking,last_gratitude_date}',
      to_jsonb(CURRENT_DATE::TEXT)
    )
    WHERE id = p_user_id;
    
    -- Bonus points for meeting minimum 3 items
    v_faith_points := 40;
  END IF;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    v_faith_points,
    'gratitude_entry',
    'Gratitude entry with ' || p_gratitude_items_count || ' items',
    p_entry_id,
    'gratitude'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_gratitude_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_gratitude_items_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_journal_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_word_count" integer DEFAULT 0, "p_has_pondered_question" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update journal entries count
  PERFORM update_user_stats(p_user_id, 'journal_entries');
  
  -- Update word count if provided
  IF p_word_count > 0 THEN
    PERFORM update_user_stats(p_user_id, 'min_words_journaled', p_word_count);
  END IF;
  
  -- Update pondered questions if applicable
  IF p_has_pondered_question THEN
    PERFORM update_user_stats(p_user_id, 'journaled_questions_pondered');
  END IF;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    30,
    'journal_entry',
    'Journal entry written',
    p_entry_id,
    'journal'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_journal_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_word_count" integer, "p_has_pondered_question" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_looking_forward_entry"("p_user_id" "uuid", "p_entry_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update stats
  PERFORM update_user_stats(p_user_id, 'looking_forward_entries');
  
  -- Update last looking forward date
  UPDATE user_profiles
  SET gamification_stats = jsonb_set(
    gamification_stats,
    '{daily_tracking,last_looking_forward_date}',
    to_jsonb(CURRENT_DATE::TEXT)
  )
  WHERE id = p_user_id;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    25,
    'looking_forward_entry',
    'Looking forward entry recorded',
    p_entry_id,
    'journal'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_looking_forward_entry"("p_user_id" "uuid", "p_entry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_playbook_creation"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_playbook_title" "text" DEFAULT 'Playbook'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Award FaithPoints for creating a playbook
  PERFORM award_faith_points(
    p_user_id,
    75,  -- 75 points for creating a playbook
    'playbook_created',
    format('Created playbook: %s', p_playbook_title),
    p_playbook_id,
    'playbook'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_playbook_creation"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_playbook_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_prayer_activity"("p_user_id" "uuid", "p_prayer_id" "uuid", "p_activity_type" "text", "p_person_name" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  CASE p_activity_type
    WHEN 'session' THEN
      PERFORM update_user_stats(p_user_id, 'prayer_sessions');
      PERFORM award_faith_points(p_user_id, 10, 'prayer_session', 'Prayer session completed', p_prayer_id, 'prayer');
    
    WHEN 'person_prayed' THEN
      PERFORM update_user_stats(p_user_id, 'people_prayed_for');
      PERFORM update_user_stats(p_user_id, 'total_people_prayed');
      PERFORM award_faith_points(p_user_id, 15, 'person_prayed', 'Prayed for ' || COALESCE(p_person_name, 'someone'), p_prayer_id, 'prayer');
    
    WHEN 'request_prayed' THEN
      PERFORM update_user_stats(p_user_id, 'prayer_requests_prayed');
      PERFORM award_faith_points(p_user_id, 20, 'request_prayed', 'Prayed for prayer request', p_prayer_id, 'prayer');
    
    WHEN 'answered' THEN
      PERFORM update_user_stats(p_user_id, 'answered_prayers');
      PERFORM award_faith_points(p_user_id, 50, 'answered_prayer', 'Prayer answered!', p_prayer_id, 'prayer');
  END CASE;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_prayer_activity"("p_user_id" "uuid", "p_prayer_id" "uuid", "p_activity_type" "text", "p_person_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_priority_completion"("p_user_id" "uuid", "p_priority_id" "uuid", "p_is_daily_priority" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update priorities completed count
  PERFORM update_user_stats(p_user_id, 'priorities_completed');
  
  -- If it's a daily priority, track that separately
  IF p_is_daily_priority THEN
    PERFORM update_user_stats(p_user_id, 'daily_priorities_completed');
    
    -- Update last priority completed date
    UPDATE user_profiles
    SET gamification_stats = jsonb_set(
      gamification_stats,
      '{daily_tracking,last_priority_completed_date}',
      to_jsonb(CURRENT_DATE::TEXT)
    )
    WHERE id = p_user_id;
  END IF;
  
  -- Award FaithPoints (priorities worth more than todos)
  PERFORM award_faith_points(
    p_user_id,
    25,
    'priority_completed',
    CASE WHEN p_is_daily_priority THEN 'Daily priority completed' ELSE 'Priority completed' END,
    p_priority_id,
    'priority'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_priority_completion"("p_user_id" "uuid", "p_priority_id" "uuid", "p_is_daily_priority" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_todo_completion"("p_user_id" "uuid", "p_todo_id" "uuid", "p_is_daily_todo" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update todos completed count
  PERFORM update_user_stats(p_user_id, 'todos_completed');
  
  -- If it's a daily todo, track that separately
  IF p_is_daily_todo THEN
    PERFORM update_user_stats(p_user_id, 'daily_todos_completed');
    
    -- Update last todo completed date
    UPDATE user_profiles
    SET gamification_stats = jsonb_set(
      gamification_stats,
      '{daily_tracking,last_todo_completed_date}',
      to_jsonb(CURRENT_DATE::TEXT)
    )
    WHERE id = p_user_id;
  END IF;
  
  -- Award FaithPoints
  PERFORM award_faith_points(
    p_user_id,
    15,
    'todo_completed',
    CASE WHEN p_is_daily_todo THEN 'Daily todo completed' ELSE 'Todo completed' END,
    p_todo_id,
    'todo'
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_todo_completion"("p_user_id" "uuid", "p_todo_id" "uuid", "p_is_daily_todo" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_streak"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_last_activity_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
  v_streak_bonus INTEGER := 0;
BEGIN
  -- Get current streak info
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_activity_date, v_current_streak, v_longest_streak
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Calculate new streak
  IF v_last_activity_date = CURRENT_DATE THEN
    -- Already logged today, no change
    RETURN v_current_streak;
  ELSIF v_last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day, increment streak
    v_new_streak := v_current_streak + 1;
  ELSE
    -- Streak broken, reset to 1
    v_new_streak := 1;
  END IF;
  
  -- Check for streak bonuses
  IF v_new_streak % 7 = 0 THEN
    v_streak_bonus := 100;  -- Weekly streak bonus
  ELSIF v_new_streak % 3 = 0 THEN
    v_streak_bonus := 25;   -- 3-day streak bonus
  END IF;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    last_activity_date = CURRENT_DATE,
    current_streak = v_new_streak,
    longest_streak = GREATEST(v_longest_streak, v_new_streak),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Award daily login points
  PERFORM award_faith_points(
    p_user_id,
    5,
    'daily_login',
    'Daily app usage',
    NULL,
    'streak',
    jsonb_build_object('streak', v_new_streak)
  );
  
  -- Award streak bonus if applicable
  IF v_streak_bonus > 0 THEN
    PERFORM award_faith_points(
      p_user_id,
      v_streak_bonus,
      'streak_bonus',
      v_new_streak || '-day streak bonus!',
      NULL,
      'streak',
      jsonb_build_object('streak', v_new_streak, 'bonus', v_streak_bonus)
    );
  END IF;
  
  RETURN v_new_streak;
END;
$$;


ALTER FUNCTION "public"."update_daily_streak"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_devotionals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_devotionals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intelligence_profile_from_behavior"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_completion_rate FLOAT;
  v_engagement_score FLOAT;
  v_consistency_score FLOAT;
BEGIN
  -- Calculate completion rate from recent behavior
  SELECT 
    COALESCE(AVG(CASE WHEN success_indicator THEN 1.0 ELSE 0.0 END), 0)
  INTO v_completion_rate
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND event_category = 'completion'
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Calculate engagement score
  SELECT 
    COALESCE(AVG(engagement_score), 0)
  INTO v_engagement_score
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Calculate consistency (how regularly they use the app)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT DATE(created_at)) >= 20 THEN 1.0
      WHEN COUNT(DISTINCT DATE(created_at)) >= 10 THEN 0.7
      WHEN COUNT(DISTINCT DATE(created_at)) >= 5 THEN 0.4
      ELSE 0.2
    END
  INTO v_consistency_score
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Update intelligence profile
  UPDATE user_intelligence_profiles 
  SET 
    average_completion_rate = v_completion_rate,
    engagement_depth_score = v_engagement_score,
    consistency_score = v_consistency_score,
    confidence_score = LEAST(1.0, (v_completion_rate + v_engagement_score + v_consistency_score) / 3.0),
    data_points_count = (
      SELECT COUNT(*) 
      FROM user_behavior_events 
      WHERE user_id = p_user_id
    ),
    last_analysis = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Insert if doesn't exist
  INSERT INTO user_intelligence_profiles (user_id, average_completion_rate, engagement_depth_score, consistency_score)
  VALUES (p_user_id, v_completion_rate, v_engagement_score, v_consistency_score)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."update_intelligence_profile_from_behavior"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_journal_entries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_journal_entries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_journal_entry_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_journal_entry_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_onboarding_progress"("p_user_id" "uuid", "p_step_name" "text", "p_step_number" integer, "p_completion_method" "public"."onboarding_step_status", "p_time_spent" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update progress record
  UPDATE onboarding_progress 
  SET 
    current_step = GREATEST(current_step, p_step_number + 1),
    completed_steps = CASE 
      WHEN p_completion_method = 'completed' THEN 
        array_append(completed_steps, p_step_name)
      ELSE completed_steps 
    END,
    skipped_steps = CASE 
      WHEN p_completion_method = 'skipped' THEN 
        array_append(skipped_steps, p_step_name)
      ELSE skipped_steps 
    END,
    completion_rate = (array_length(completed_steps, 1) + 
      CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
    )::FLOAT / total_steps,
    time_spent_seconds = time_spent_seconds + p_time_spent,
    last_activity_at = NOW(),
    is_completed = CASE 
      WHEN (array_length(completed_steps, 1) + 
        CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
      ) >= total_steps THEN TRUE 
      ELSE FALSE 
    END,
    completed_at = CASE 
      WHEN (array_length(completed_steps, 1) + 
        CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
      ) >= total_steps THEN NOW() 
      ELSE completed_at 
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_onboarding_progress"("p_user_id" "uuid", "p_step_name" "text", "p_step_number" integer, "p_completion_method" "public"."onboarding_step_status", "p_time_spent" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_playbook_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    total_steps INTEGER;
    completed_steps INTEGER;
    total_subtasks INTEGER;
    completed_subtasks INTEGER;
    new_progress DECIMAL(3,2);
    new_status TEXT;
    playbook_id_var UUID;
BEGIN
    -- Get playbook_id from the trigger context
    IF TG_TABLE_NAME = 'playbook_action_steps' THEN
        playbook_id_var := COALESCE(NEW.playbook_id, OLD.playbook_id);
    ELSIF TG_TABLE_NAME = 'playbook_sub_tasks' THEN
        SELECT pas.playbook_id INTO playbook_id_var
        FROM playbook_action_steps pas
        WHERE pas.id = COALESCE(NEW.action_step_id, OLD.action_step_id);
    END IF;

    -- Count total and completed action steps
    SELECT COUNT(*), COUNT(*) FILTER (WHERE completed = TRUE)
    INTO total_steps, completed_steps
    FROM playbook_action_steps
    WHERE playbook_id = playbook_id_var;

    -- Count total and completed subtasks
    SELECT COUNT(*), COUNT(*) FILTER (WHERE pst.completed = TRUE)
    INTO total_subtasks, completed_subtasks
    FROM playbook_sub_tasks pst
    JOIN playbook_action_steps pas ON pas.id = pst.action_step_id
    WHERE pas.playbook_id = playbook_id_var;

    -- Calculate progress (steps + subtasks)
    IF (total_steps + total_subtasks) > 0 THEN
        new_progress := (completed_steps + completed_subtasks)::DECIMAL / (total_steps + total_subtasks)::DECIMAL;
    ELSE
        new_progress := 0;
    END IF;

    -- Determine status
    IF new_progress >= 1.0 THEN
        new_status := 'completed';
    ELSE
        new_status := 'inProgress';
    END IF;

    -- Update playbook
    UPDATE playbooks
    SET 
        progress = new_progress,
        total_tasks = total_steps + total_subtasks,
        status = new_status,
        completed_at = CASE WHEN new_status = 'completed' AND status != 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = playbook_id_var;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_playbook_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_playbook_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    progress_data RECORD;
    target_playbook_id UUID;
BEGIN
    -- Get the playbook ID based on the table being updated
    IF TG_TABLE_NAME = 'playbook_action_steps' THEN
        target_playbook_id := NEW.playbook_id;
    ELSIF TG_TABLE_NAME = 'playbook_sub_tasks' THEN
        SELECT playbook_id INTO target_playbook_id 
        FROM playbook_action_steps 
        WHERE id = NEW.action_step_id;
    ELSIF TG_TABLE_NAME = 'playbook_affirmations' THEN
        target_playbook_id := NEW.playbook_id;
    END IF;
    
    -- Get progress for the playbook
    SELECT * INTO progress_data 
    FROM calculate_playbook_progress(target_playbook_id);
    
    -- Update playbook status if 100% complete
    IF progress_data.progress_percentage = 100 THEN
        UPDATE playbooks 
        SET status = 'completed', updated_at = NOW()
        WHERE id = target_playbook_id
        AND status != 'completed';
    ELSIF progress_data.progress_percentage < 100 THEN
        UPDATE playbooks 
        SET status = 'ongoing', updated_at = NOW()
        WHERE id = target_playbook_id
        AND status = 'completed';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_playbook_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_prayers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_prayers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reflection_entries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_reflection_entries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_time_blocks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_time_blocks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_challenge_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update completion percentage and activities count
  UPDATE user_challenges 
  SET 
    activities_completed = (
      SELECT COUNT(*) 
      FROM user_challenge_progress 
      WHERE user_challenge_id = NEW.user_challenge_id
    ),
    completion_percentage = CASE 
      WHEN total_activities > 0 THEN 
        (SELECT COUNT(*) FROM user_challenge_progress WHERE user_challenge_id = NEW.user_challenge_id) * 100.0 / total_activities
      ELSE 0
    END,
    points_earned = (
      SELECT COALESCE(SUM(points_earned), 0) 
      FROM user_challenge_progress 
      WHERE user_challenge_id = NEW.user_challenge_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_challenge_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_challenge_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_stats"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer DEFAULT 1, "p_additional_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_stats JSONB;
  v_current_value INTEGER;
  v_new_value INTEGER;
  v_updated_stats JSONB;
BEGIN
  -- Get current stats
  SELECT gamification_stats INTO v_current_stats
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Get current value for the stat
  v_current_value := COALESCE((v_current_stats ->> p_stat_name)::INTEGER, 0);
  v_new_value := v_current_value + p_increment;
  
  -- Update the specific stat
  v_updated_stats := jsonb_set(v_current_stats, ARRAY[p_stat_name], to_jsonb(v_new_value));
  
  -- Handle special cases with additional data
  IF p_additional_data IS NOT NULL THEN
    -- Merge additional data
    v_updated_stats := v_updated_stats || p_additional_data;
  END IF;
  
  -- Handle streak tracking for devotionals
  IF p_stat_name = 'devotionals_finished' THEN
    -- Check if this is a new day for devotional streaks
    DECLARE
      v_last_devotional_date DATE;
      v_current_devotional_streak INTEGER;
      v_longest_devotional_streak INTEGER;
      v_devotionals_today INTEGER;
    BEGIN
      -- Get current devotional streak info
      v_current_devotional_streak := COALESCE((v_current_stats ->> 'devotional_day_streaks')::INTEGER, 0);
      v_longest_devotional_streak := COALESCE((v_current_stats ->> 'longest_devotional_streak')::INTEGER, 0);
      
      -- Count devotionals completed today (this would need to be tracked separately)
      v_devotionals_today := 1; -- Simplified for now
      
      -- Update devotionals per day record if needed
      IF v_devotionals_today > COALESCE((v_current_stats ->> 'devotionals_per_day_record')::INTEGER, 0) THEN
        v_updated_stats := jsonb_set(v_updated_stats, ARRAY['devotionals_per_day_record'], to_jsonb(v_devotionals_today));
      END IF;
    END;
  END IF;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    gamification_stats = v_updated_stats,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Check for new badge achievements
  PERFORM check_badge_achievements(p_user_id);
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_user_stats"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer, "p_additional_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_journal_entry"("p_id" "uuid", "p_user_id" "uuid", "p_content_type" "text", "p_content" "jsonb", "p_selected_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  existing_id UUID;
  result JSONB;
BEGIN
  -- Try to find existing entry
  SELECT id INTO existing_id
  FROM journal_entries
  WHERE user_id = p_user_id
    AND content_type = p_content_type
    AND selected_date = p_selected_date
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing entry
    UPDATE journal_entries
    SET 
      content = p_content,
      updated_at = NOW()
    WHERE id = existing_id
    RETURNING to_jsonb(journal_entries.*) INTO result;
  ELSE
    -- Insert new entry
    INSERT INTO journal_entries (
      id,
      user_id,
      content_type,
      content,
      selected_date,
      created_at,
      updated_at
    ) VALUES (
      COALESCE(p_id, gen_random_uuid()),
      p_user_id,
      p_content_type,
      p_content,
      p_selected_date,
      NOW(),
      NOW()
    )
    RETURNING to_jsonb(journal_entries.*) INTO result;
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."upsert_journal_entry"("p_id" "uuid", "p_user_id" "uuid", "p_content_type" "text", "p_content" "jsonb", "p_selected_date" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ab_test_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_name" "text" NOT NULL,
    "variant" "text" NOT NULL,
    "market" "text" DEFAULT 'US'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "conversion_event" "text",
    "converted_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."ab_test_assignments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_user_challenges" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "user_id",
    NULL::"uuid" AS "challenge_id",
    NULL::"public"."challenge_status" AS "status",
    NULL::"date" AS "start_date",
    NULL::"date" AS "end_date",
    NULL::numeric(5,2) AS "completion_percentage",
    NULL::integer AS "current_streak",
    NULL::integer AS "longest_streak",
    NULL::integer AS "activities_completed",
    NULL::integer AS "total_activities",
    NULL::integer AS "points_earned",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::"text" AS "computed_status",
    NULL::"text" AS "challenge_title",
    NULL::"text" AS "challenge_description",
    NULL::"text" AS "challenge_text",
    NULL::"public"."challenge_duration_type" AS "duration_type",
    NULL::integer AS "duration_days",
    NULL::"text" AS "category",
    NULL::"public"."challenge_difficulty" AS "difficulty",
    NULL::integer AS "base_points",
    NULL::"json" AS "activities";


ALTER TABLE "public"."active_user_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_logs" (
    "id" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "text" NOT NULL,
    "message" "text" NOT NULL,
    "service" "text" DEFAULT 'siFia-app'::"text" NOT NULL,
    "user_id" "uuid",
    "correlation_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "error" "jsonb",
    "performance" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "application_logs_level_check" CHECK (("level" = ANY (ARRAY['debug'::"text", 'info'::"text", 'warn'::"text", 'error'::"text", 'fatal'::"text"])))
);


ALTER TABLE "public"."application_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_logs" IS 'Centralized application logging with structured data';



CREATE TABLE IF NOT EXISTS "public"."audit_trail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "correlation_id" "text"
);


ALTER TABLE "public"."audit_trail" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_trail" IS 'Comprehensive audit trail for all user actions and data changes';



CREATE TABLE IF NOT EXISTS "public"."auth_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "success" boolean NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "scripture_verse" "text",
    "scripture_reference" "text",
    "required_activity" "text",
    "required_count" integer,
    "faith_points_reward" integer DEFAULT 0,
    "rarity" "text" DEFAULT 'common'::"text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "badges_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'rare'::"text", 'epic'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "activity_type" "public"."activity_type" NOT NULL,
    "journal_component" "text",
    "target_value" integer DEFAULT 1 NOT NULL,
    "points_value" integer DEFAULT 10 NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "challenge_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb",
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "milestone_type" "text" DEFAULT 'progress'::"text" NOT NULL,
    "target_value" integer NOT NULL,
    "reward_points" integer DEFAULT 0 NOT NULL,
    "reward_description" "text",
    "icon_name" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "challenge_text" "text" NOT NULL,
    "duration_type" "public"."challenge_duration_type" DEFAULT 'custom'::"public"."challenge_duration_type" NOT NULL,
    "duration_days" integer DEFAULT 7 NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "difficulty" "public"."challenge_difficulty" DEFAULT 'beginner'::"public"."challenge_difficulty" NOT NULL,
    "base_points" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "playbook_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."christ_acceptance_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "acceptance_declared_at" timestamp with time zone DEFAULT "now"(),
    "acceptance_context" "public"."acceptance_context" NOT NULL,
    "influenced_by" "text",
    "specific_content_id" "uuid",
    "prayer_text" "text",
    "baptism_interest" boolean DEFAULT false,
    "church_connection_interest" boolean DEFAULT false,
    "discipleship_interest" boolean DEFAULT false,
    "needs_follow_up" boolean DEFAULT true,
    "follow_up_completed" boolean DEFAULT false,
    "follow_up_date" timestamp with time zone,
    "confidence_score" double precision DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."christ_acceptance_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."christ_acceptance_events" IS 'Records when users accept Christ through the app';



CREATE TABLE IF NOT EXISTS "public"."content_effectiveness" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "completion_rate" double precision DEFAULT 0,
    "engagement_score" double precision DEFAULT 0,
    "time_to_complete" integer,
    "user_rating" integer,
    "completed_successfully" boolean DEFAULT false,
    "user_feedback_positive" boolean,
    "led_to_further_engagement" boolean DEFAULT false,
    "difficulty_match_score" double precision DEFAULT 0,
    "personalization_effectiveness" double precision DEFAULT 0,
    "measured_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."content_effectiveness" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_effectiveness" IS 'Learning system to improve content generation over time';



CREATE TABLE IF NOT EXISTS "public"."content_library" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "prompt_used" "text",
    "ai_model" "text" DEFAULT 'gpt-4'::"text",
    "tokens_used" integer DEFAULT 0,
    "generation_time_ms" integer,
    "intelligence_level" "text",
    "personalization_data" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "category" "text",
    "is_favorite" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "is_shared" boolean DEFAULT false,
    "share_token" "text",
    "export_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_library_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_entry'::"text"]))),
    CONSTRAINT "content_library_intelligence_level_check" CHECK (("intelligence_level" = ANY (ARRAY['basic'::"text", 'enhanced'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."content_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_classification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "column_name" "text",
    "classification_level" "text" NOT NULL,
    "encryption_required" boolean DEFAULT false NOT NULL,
    "audit_required" boolean DEFAULT false NOT NULL,
    "retention_days" integer DEFAULT 365 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_classification_classification_level_check" CHECK (("classification_level" = ANY (ARRAY['public'::"text", 'internal'::"text", 'confidential'::"text", 'restricted'::"text"])))
);


ALTER TABLE "public"."data_classification" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_classification" IS 'Data classification and retention policies for compliance';



CREATE TABLE IF NOT EXISTS "public"."devotionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "category" "text" DEFAULT 'Growth'::"text" NOT NULL,
    "categories" "text"[] DEFAULT ARRAY['Growth'::"text"],
    "playbook_id" "uuid",
    "playbook_title" "text",
    "user_input" "text",
    "total_days" integer DEFAULT 1 NOT NULL,
    "current_day" integer DEFAULT 1 NOT NULL,
    "progress" numeric(5,2) DEFAULT 0.0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "days" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rating" integer,
    "rated_at" timestamp with time zone,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "devotionals_category_check" CHECK (("category" = ANY (ARRAY['Prayer'::"text", 'Growth'::"text", 'Healing'::"text", 'Wisdom'::"text", 'Relationships'::"text", 'Purpose'::"text", 'Career'::"text", 'Finances'::"text", 'Mental Health'::"text", 'Parenting'::"text", 'Health'::"text"]))),
    CONSTRAINT "devotionals_progress_check" CHECK ((("progress" >= (0)::numeric) AND ("progress" <= (100)::numeric))),
    CONSTRAINT "devotionals_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."devotionals" OWNER TO "postgres";


COMMENT ON TABLE "public"."devotionals" IS 'Stores user devotionals with progress tracking and content';



COMMENT ON COLUMN "public"."devotionals"."category" IS 'Primary category from predefined list';



COMMENT ON COLUMN "public"."devotionals"."categories" IS 'Array of categories for multi-classification';



COMMENT ON COLUMN "public"."devotionals"."user_input" IS 'Original user input from playbook that generated this devotional';



COMMENT ON COLUMN "public"."devotionals"."total_days" IS 'Total number of days in the devotional';



COMMENT ON COLUMN "public"."devotionals"."current_day" IS 'Current day the user is on (1-based)';



COMMENT ON COLUMN "public"."devotionals"."progress" IS 'Completion percentage (0-100)';



COMMENT ON COLUMN "public"."devotionals"."days" IS 'JSON array containing the devotional content for each day';



CREATE TABLE IF NOT EXISTS "public"."expounding_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_step_id" "uuid" NOT NULL,
    "subtask_id" "uuid" NOT NULL,
    "expanded_content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expounding_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expounding_content_legacy" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action_step_id" "uuid",
    "subtask_id" "uuid",
    "expanded_content" "jsonb" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expounding_content_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_journey_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "has_accepted_christ" boolean,
    "acceptance_date" "date",
    "acceptance_context" "public"."acceptance_context",
    "spiritual_maturity" "public"."spiritual_maturity_level" DEFAULT 'unsure'::"public"."spiritual_maturity_level",
    "years_as_believer" integer,
    "church_attendance" "public"."church_attendance_frequency" DEFAULT 'never'::"public"."church_attendance_frequency",
    "current_church_name" "text",
    "church_denomination" "text",
    "baptism_status" "public"."baptism_status" DEFAULT 'not_applicable'::"public"."baptism_status",
    "baptism_date" "date",
    "bible_reading_frequency" "public"."bible_reading_frequency" DEFAULT 'never'::"public"."bible_reading_frequency",
    "prayer_frequency" "public"."prayer_frequency" DEFAULT 'never'::"public"."prayer_frequency",
    "preferred_bible_version" "text" DEFAULT 'NIV'::"text",
    "areas_of_growth" "text"[] DEFAULT '{}'::"text"[],
    "life_challenges" "text"[] DEFAULT '{}'::"text"[],
    "spiritual_gifts" "text"[] DEFAULT '{}'::"text"[],
    "ministry_interests" "text"[] DEFAULT '{}'::"text"[],
    "current_doubts" "text"[] DEFAULT '{}'::"text"[],
    "growth_desires" "text"[] DEFAULT '{}'::"text"[],
    "spiritual_influences" "text"[] DEFAULT '{}'::"text"[],
    "needs_pastoral_care" boolean DEFAULT false,
    "church_connection_requested" boolean DEFAULT false,
    "prayer_request_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_journey_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."faith_journey_profiles" IS 'Stores detailed faith journey and spiritual maturity data';



CREATE TABLE IF NOT EXISTS "public"."faith_points_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "total_points" integer DEFAULT 0,
    "current_level" integer DEFAULT 1,
    "points_to_next_level" integer DEFAULT 100,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "weekly_goal" integer DEFAULT 50,
    "weekly_progress" integer DEFAULT 0,
    "last_activity_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text",
    "first_name" "text",
    "last_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "phone" "text",
    "website" "text",
    "preferences" "jsonb" DEFAULT '{"content": {"language": "en", "bible_version": "NIV"}, "privacy": {"activity_status": true, "profile_visibility": "private"}, "appearance": {"theme": "system", "font_size": "medium", "reduced_motion": false}, "notifications": {"push": true, "email": true, "marketing": false, "reminder_time": "09:00"}}'::"jsonb" NOT NULL,
    "notification_preferences" "jsonb" DEFAULT '{"bible": {"preferredVersion": "NIV", "availableVersions": ["NIV", "ESV", "NASB", "KJV", "NKJV", "NLT", "CSB", "MSG"]}, "theme": "system", "system": {"timezone": "UTC", "pushEnabled": true, "emailEnabled": true}, "prayers": {"actsReminders": {"enabled": true, "schedule": [{"time": "07:00", "type": "adoration"}, {"time": "12:00", "type": "confession"}, {"time": "15:00", "type": "thanksgiving"}, {"time": "19:00", "type": "supplication"}]}, "unprayedPeople": {"time": "09:00", "enabled": true, "frequency": "daily"}, "prayNowReminders": {"time": "08:00", "enabled": true}, "answeredPrayersReview": {"time": "10:00", "enabled": true, "dayOfWeek": 0, "frequency": "weekly", "reviewPeriods": ["week", "month", "quarter", "halfYear", "year"]}}, "fontSize": "medium", "todayWin": {"dailyReminder": {"time": "19:00", "enabled": true}, "missedDayReminder": {"time": "21:30", "enabled": true}}, "devotions": {"unprayedPrayers": {"time": "18:00", "enabled": true}, "unansweredQuestions": {"time": "17:00", "enabled": true}}, "gratitude": {"dailyReminder": {"time": "20:00", "enabled": true, "minEntries": 3}, "missedDayReminder": {"time": "21:00", "enabled": true}}, "actionSteps": {"remindProgress": {"time": "12:00", "enabled": true, "frequency": "daily"}, "remindUnfinishedSubtasks": {"time": "18:00", "enabled": true, "remindAfterHours": 24}}, "colorScheme": "default", "affirmations": {"time": "08:00", "enabled": true, "sources": ["favorites", "recent"]}, "reflectionLog": {"guidedPrompts": {"time": "08:30", "enabled": true, "frequency": "daily"}}, "lookingForward": {"eveningReminder": {"time": "21:00", "enabled": true}, "nextDayReminder": {"time": "07:00", "enabled": true}}, "playbookChallenges": {"acceptedChallenge": {"enabled": true, "reminderTime": "10:00", "remindBeforeEnd": 1, "progressThresholds": [25, 50, 75]}, "incompleteChallenge": {"enabled": true, "reminderTime": "11:00", "remindAfterDaysInactive": 3}}}'::"jsonb" NOT NULL,
    "faith_points" integer DEFAULT 0,
    "growth_level" "text" DEFAULT 'Seedling'::"text",
    "total_faith_points_earned" integer DEFAULT 0,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "last_activity_date" "date",
    "gamification_stats" "jsonb" DEFAULT '{"weekly_stats": {"week_start_date": null, "prayers_this_week": 0, "devotionals_this_week": 0, "gratitude_days_this_week": 0, "journal_entries_this_week": 0, "todos_completed_this_week": 0, "priorities_completed_this_week": 0}, "badges_earned": [], "monthly_stats": {"month_start_date": null, "prayers_this_month": 0, "devotionals_this_month": 0, "gratitude_days_this_month": 0, "goals_completed_this_month": 0, "todos_completed_this_month": 0, "financial_activities_this_month": 0, "priorities_completed_this_month": 0}, "daily_tracking": {"last_gratitude_date": null, "last_win_recorded_date": null, "last_todo_completed_date": null, "last_looking_forward_date": null, "last_daily_goals_check_date": null, "last_financial_activity_date": null, "last_priority_completed_date": null}, "donations_made": 0, "daily_goals_met": 0, "financial_stats": {"tithing_entries": 0, "financial_goals_met": 0, "savings_goals_achieved": 0, "stewardship_activities": 0, "budget_entries_completed": 0, "charitable_giving_entries": 0, "debt_reduction_milestones": 0, "financial_prayers_recorded": 0}, "goals_completed": 0, "journal_entries": 0, "prayer_sessions": 0, "tasks_completed": 0, "themes_unlocked": ["pink"], "todos_completed": 0, "answered_prayers": 0, "playbooks_shared": 0, "gratitude_entries": 0, "people_prayed_for": 0, "playbooks_created": 0, "daily_goals_streak": 0, "devotionals_prayed": 0, "subtasks_completed": 0, "templates_unlocked": [], "daily_wins_recorded": 0, "milestones_achieved": [], "min_words_journaled": 0, "total_people_prayed": 0, "devotionals_finished": 0, "priorities_completed": 0, "total_donated_amount": 0, "daily_todos_completed": 0, "devotional_day_streaks": 0, "gratitude_daily_streak": 0, "prayer_requests_prayed": 0, "looking_forward_entries": 0, "longest_gratitude_streak": 0, "longest_devotional_streak": 0, "daily_priorities_completed": 0, "devotionals_per_day_record": 0, "longest_daily_goals_streak": 0, "journaled_questions_pondered": 0, "gratitude_days_with_min_3_items": 0}'::"jsonb",
    "email_verified" boolean DEFAULT false,
    "last_login_at" timestamp with time zone,
    "last_active_at" timestamp with time zone,
    "last_notification_check" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "country_code" "text" DEFAULT 'US'::"text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "locale" "text" DEFAULT 'en'::"text",
    "onboarding_completed" boolean DEFAULT false,
    CONSTRAINT "user_profiles_growth_level_check" CHECK (("growth_level" = ANY (ARRAY['Seedling'::"text", 'Sprout'::"text", 'Blooming'::"text", 'Fruitful'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."faith_points_leaderboard" WITH ("security_invoker"='true') AS
 SELECT "fp"."user_id",
    "up"."first_name",
    "up"."last_name",
    "fp"."total_points",
    "fp"."current_level",
    "fp"."current_streak",
    "fp"."longest_streak",
    "rank"() OVER (ORDER BY "fp"."total_points" DESC) AS "rank"
   FROM ("public"."faith_points_profiles" "fp"
     JOIN "public"."user_profiles" "up" ON (("fp"."user_id" = "up"."id")))
  ORDER BY "fp"."total_points" DESC
 LIMIT 100;


ALTER TABLE "public"."faith_points_leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "activity_type" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."faith_points_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2025_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2025_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2025_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2025_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2025_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2025_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2026_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faith_points_transactions_2026_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faith_points_transactions_2026_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."generated_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2025_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2025_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2025_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2025_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2025_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2025_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_content_2026_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "user_input" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "cost_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text"]))),
    CONSTRAINT "generated_content_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."generated_content_2026_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."generation_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."generation_queue" IS 'Intelligent priority queue for AI generation requests';



COMMENT ON COLUMN "public"."generation_queue"."priority" IS '1=family, 2=transformation, 3=growth, 4=starter, 5=basic/free_trial';



COMMENT ON COLUMN "public"."generation_queue"."is_onboarding" IS 'Whether this is an onboarding generation (free and does not count toward usage limits)';



CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_13" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_13" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_14" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_14" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_15" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_15" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_16" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_16" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_17" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_17" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_18" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_18" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_19" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_19" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_20" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_20" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_21" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_21" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_22" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_22" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_23" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_23" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_24" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_24" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_25" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_25" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_26" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_26" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_27" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_27" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_28" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_28" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_29" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_29" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_30" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_30" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_08_31" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_08_31" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_09_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_09_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_09_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_09_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_09_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_09_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_queue_2025_09_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "user_input" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_id" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_data" "jsonb",
    "error_message" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_params" "jsonb" DEFAULT '{}'::"jsonb",
    "cost_cents" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "intelligence_level" "text" DEFAULT 'basic'::"text",
    "user_profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_enabled" boolean DEFAULT false,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "result_id" "uuid",
    "processing_time_seconds" integer,
    "is_onboarding" boolean DEFAULT false,
    CONSTRAINT "generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "generation_queue_type_check" CHECK (("type" = ANY (ARRAY['playbook'::"text", 'devotional'::"text", 'journal_expansion'::"text"])))
);


ALTER TABLE "public"."generation_queue_2025_09_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."growth_levels" (
    "level_name" "text" NOT NULL,
    "min_faith_points" integer NOT NULL,
    "max_faith_points" integer,
    "description" "text",
    "benefits" "jsonb",
    "scripture_verse" "text",
    "scripture_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."growth_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "selected_date" "date" NOT NULL,
    "completed" boolean DEFAULT false,
    "priority" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "journal_entries_content_type_check" CHECK (("content_type" = ANY (ARRAY['gratitude'::"text", 'todo'::"text", 'today_win'::"text", 'looking_forward'::"text", 'todays_focus'::"text", 'reflection_log'::"text"]))),
    CONSTRAINT "journal_entries_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "prompts" "jsonb" NOT NULL,
    "structure" "jsonb" DEFAULT '{}'::"jsonb",
    "is_premium" boolean DEFAULT false,
    "required_tier" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "estimated_time_minutes" integer,
    "difficulty_level" "text",
    "usage_count" integer DEFAULT 0,
    "rating_average" numeric(3,2) DEFAULT 0.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "journal_templates_difficulty_check" CHECK (("difficulty_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "journal_templates_required_tier_check" CHECK (("required_tier" = ANY (ARRAY['starter'::"text", 'growth'::"text", 'transformation'::"text", 'family'::"text"])))
);


ALTER TABLE "public"."journal_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "public"."notification_channel" NOT NULL,
    "status" "public"."notification_status" NOT NULL,
    "error_message" "text",
    "opened" boolean DEFAULT false,
    "opened_at" timestamp with time zone,
    "clicked_url" "text",
    "device_id" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "in_app" boolean DEFAULT true,
    "email" boolean DEFAULT true,
    "push" boolean DEFAULT true,
    "sms" boolean DEFAULT false,
    "quiet_hours_enabled" boolean DEFAULT true,
    "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone,
    "quiet_hours_end" time without time zone DEFAULT '07:00:00'::time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "data" "jsonb",
    "image_url" "text",
    "action_url" "text",
    "status" "public"."notification_status" DEFAULT 'PENDING'::"public"."notification_status",
    "read_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "priority" integer DEFAULT 0,
    "channels" "public"."notification_channel"[] DEFAULT '{IN_APP}'::"public"."notification_channel"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_content_effectiveness" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "step_name" "text" NOT NULL,
    "content_variant" "text" NOT NULL,
    "completion_rate" double precision DEFAULT 0.0,
    "average_time_spent" integer DEFAULT 0,
    "skip_rate" double precision DEFAULT 0.0,
    "abandonment_rate" double precision DEFAULT 0.0,
    "average_rating" double precision DEFAULT 0.0,
    "positive_feedback_count" integer DEFAULT 0,
    "negative_feedback_count" integer DEFAULT 0,
    "christ_acceptance_rate" double precision DEFAULT 0.0,
    "trial_conversion_rate" double precision DEFAULT 0.0,
    "retention_rate_7_day" double precision DEFAULT 0.0,
    "retention_rate_30_day" double precision DEFAULT 0.0,
    "total_users_exposed" integer DEFAULT 0,
    "measurement_period_start" timestamp with time zone DEFAULT "now"(),
    "measurement_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_content_effectiveness" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_content_effectiveness" IS 'A/B testing and content performance metrics';



CREATE TABLE IF NOT EXISTS "public"."onboarding_personalization_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "personality_type" "public"."personality_type",
    "learning_style" "public"."learning_style",
    "preferred_content_length" "public"."content_length_preference" DEFAULT 'medium'::"public"."content_length_preference",
    "preferred_topics" "text"[] DEFAULT '{}'::"text"[],
    "avoided_topics" "text"[] DEFAULT '{}'::"text"[],
    "optimal_notification_times" time without time zone[] DEFAULT '{}'::time without time zone[],
    "preferred_study_days" "text"[] DEFAULT '{}'::"text"[],
    "daily_commitment_minutes" integer DEFAULT 15,
    "prefers_gentle_encouragement" boolean DEFAULT true,
    "prefers_direct_challenges" boolean DEFAULT false,
    "likes_community_features" boolean DEFAULT true,
    "prefers_audio_content" boolean DEFAULT false,
    "prefers_video_content" boolean DEFAULT false,
    "accessibility_needs" "text"[] DEFAULT '{}'::"text"[],
    "engagement_patterns" "jsonb" DEFAULT '{}'::"jsonb",
    "personalization_score" double precision DEFAULT 0.0,
    "confidence_level" double precision DEFAULT 0.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_personalization_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_personalization_profiles" IS 'User preferences and personality data for personalization';



CREATE TABLE IF NOT EXISTS "public"."onboarding_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "current_step" integer DEFAULT 1,
    "total_steps" integer DEFAULT 6,
    "completed_steps" "text"[] DEFAULT '{}'::"text"[],
    "skipped_steps" "text"[] DEFAULT '{}'::"text"[],
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "abandoned_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "completion_rate" double precision DEFAULT 0.0,
    "time_spent_seconds" integer DEFAULT 0,
    "session_id" "uuid" DEFAULT "gen_random_uuid"(),
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "is_completed" boolean DEFAULT false,
    "is_abandoned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_progress" IS 'Tracks user progress through the onboarding flow';



CREATE TABLE IF NOT EXISTS "public"."onboarding_step_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid" NOT NULL,
    "step_name" "text" NOT NULL,
    "step_number" integer NOT NULL,
    "time_spent_seconds" integer DEFAULT 0,
    "interactions_count" integer DEFAULT 0,
    "scroll_depth_percentage" double precision DEFAULT 0.0,
    "completion_method" "public"."onboarding_step_status" NOT NULL,
    "completion_timestamp" timestamp with time zone DEFAULT "now"(),
    "input_field_count" integer DEFAULT 0,
    "validation_errors_count" integer DEFAULT 0,
    "help_requests_count" integer DEFAULT 0,
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "network_quality" "text",
    "load_time_ms" integer,
    "variant_id" "text",
    "experiment_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_step_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_step_analytics" IS 'Detailed analytics for each onboarding step interaction';



CREATE TABLE IF NOT EXISTS "public"."performance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "duration_ms" numeric NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."performance_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."performance_metrics" IS 'Application performance tracking and optimization';



CREATE TABLE IF NOT EXISTS "public"."playbook_action_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "playbook_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "examples" "text",
    "example_interactive" boolean DEFAULT false,
    CONSTRAINT "action_steps_order_index_positive" CHECK (("order_index" >= 0)),
    CONSTRAINT "action_steps_text_length" CHECK ((("char_length"("text") >= 1) AND ("char_length"("text") <= 500)))
);


ALTER TABLE "public"."playbook_action_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."playbook_action_steps" IS 'Action steps for playbooks, can have sub-tasks';



COMMENT ON COLUMN "public"."playbook_action_steps"."example_interactive" IS 'Whether the action step example can be interacted with';



CREATE TABLE IF NOT EXISTS "public"."playbook_affirmations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "playbook_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affirmations_order_index_positive" CHECK (("order_index" >= 0)),
    CONSTRAINT "affirmations_text_length" CHECK ((("char_length"("text") >= 1) AND ("char_length"("text") <= 300)))
);


ALTER TABLE "public"."playbook_affirmations" OWNER TO "postgres";


COMMENT ON TABLE "public"."playbook_affirmations" IS 'Affirmations for playbooks to reinforce positive thinking';



CREATE TABLE IF NOT EXISTS "public"."playbook_sub_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action_step_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "detected_journal_type" character varying(50),
    "is_example" boolean DEFAULT false,
    "example_interactive" boolean DEFAULT false,
    CONSTRAINT "sub_tasks_order_index_positive" CHECK (("order_index" >= 0)),
    CONSTRAINT "sub_tasks_text_length" CHECK ((("char_length"("text") >= 1) AND ("char_length"("text") <= 300)))
);


ALTER TABLE "public"."playbook_sub_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."playbook_sub_tasks" IS 'Sub-tasks for action steps, providing granular task breakdown';



COMMENT ON COLUMN "public"."playbook_sub_tasks"."detected_journal_type" IS 'AI-detected journal type for smart suggestions';



COMMENT ON COLUMN "public"."playbook_sub_tasks"."is_example" IS 'Whether this subtask is an example';



COMMENT ON COLUMN "public"."playbook_sub_tasks"."example_interactive" IS 'Whether the example can be interacted with';



CREATE TABLE IF NOT EXISTS "public"."playbooks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "truth_in_love" "jsonb",
    "bible_verse" "jsonb",
    "direct_challenge" "jsonb",
    "challenge_cta" "text",
    "status" "text" DEFAULT 'ongoing'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_input" "text",
    "content" "jsonb",
    "affirmations" "jsonb",
    "subtitle" "text",
    "action_steps" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "playbooks_status_check" CHECK (("status" = ANY (ARRAY['ongoing'::"text", 'completed'::"text", 'paused'::"text"]))),
    CONSTRAINT "playbooks_title_length" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200))),
    CONSTRAINT "playbooks_user_id_not_null" CHECK (("user_id" IS NOT NULL))
);


ALTER TABLE "public"."playbooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."playbooks" IS 'Main playbook table with user-specific spiritual guidance content';



CREATE OR REPLACE VIEW "public"."playbooks_with_progress" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."user_id",
    "p"."title",
    "p"."truth_in_love",
    "p"."bible_verse",
    "p"."direct_challenge",
    "p"."challenge_cta",
    "p"."status",
    "p"."created_at",
    "p"."updated_at",
    (COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."playbook_action_steps"
          WHERE (("playbook_action_steps"."playbook_id" = "p"."id") AND ("playbook_action_steps"."completed" = true))), (0)::bigint) + COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."playbook_affirmations"
          WHERE (("playbook_affirmations"."playbook_id" = "p"."id") AND ("playbook_affirmations"."completed" = true))), (0)::bigint)) AS "completed_tasks",
    (COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."playbook_action_steps"
          WHERE ("playbook_action_steps"."playbook_id" = "p"."id")), (0)::bigint) + COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."playbook_affirmations"
          WHERE ("playbook_affirmations"."playbook_id" = "p"."id")), (0)::bigint)) AS "total_tasks",
        CASE
            WHEN ((COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_action_steps"
              WHERE ("playbook_action_steps"."playbook_id" = "p"."id")), (0)::bigint) + COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_affirmations"
              WHERE ("playbook_affirmations"."playbook_id" = "p"."id")), (0)::bigint)) = 0) THEN (0)::numeric
            ELSE "round"(((((COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_action_steps"
              WHERE (("playbook_action_steps"."playbook_id" = "p"."id") AND ("playbook_action_steps"."completed" = true))), (0)::bigint) + COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_affirmations"
              WHERE (("playbook_affirmations"."playbook_id" = "p"."id") AND ("playbook_affirmations"."completed" = true))), (0)::bigint)))::numeric / ((COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_action_steps"
              WHERE ("playbook_action_steps"."playbook_id" = "p"."id")), (0)::bigint) + COALESCE(( SELECT "count"(*) AS "count"
               FROM "public"."playbook_affirmations"
              WHERE ("playbook_affirmations"."playbook_id" = "p"."id")), (0)::bigint)))::numeric) * (100)::numeric), 2)
        END AS "progress_percentage"
   FROM "public"."playbooks" "p";


ALTER TABLE "public"."playbooks_with_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."playbooks_with_progress" IS 'View showing playbooks with calculated progress metrics';



CREATE TABLE IF NOT EXISTS "public"."prayers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prayer_type" "text" NOT NULL,
    "journal_category" "text",
    "content" "text" NOT NULL,
    "selected_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "person_name" "text",
    "is_prayer_request" boolean DEFAULT false,
    "prayed" boolean DEFAULT false,
    "devotional_title" "text",
    "day_number" integer,
    "day_title" "text",
    "total_days" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "answered_at" timestamp with time zone,
    "notes" "text",
    "requested_by" "text",
    "answered_date" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "prayers_journal_category_check" CHECK (("journal_category" = ANY (ARRAY['adoration'::"text", 'confession'::"text", 'thanksgiving'::"text", 'supplication'::"text", 'personal_prayer'::"text"]))),
    CONSTRAINT "prayers_prayer_type_check" CHECK (("prayer_type" = ANY (ARRAY['journal'::"text", 'people'::"text", 'devotional'::"text"]))),
    CONSTRAINT "prayers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'answered'::"text"])))
);


ALTER TABLE "public"."prayers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."prayers"."notes" IS 'Additional notes for prayers';



COMMENT ON COLUMN "public"."prayers"."requested_by" IS 'Who requested this prayer (for prayer requests)';



COMMENT ON COLUMN "public"."prayers"."answered_date" IS 'The date when the prayer was marked as answered';



CREATE TABLE IF NOT EXISTS "public"."prayers_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "prayer_type" "text",
    "journal_category" "text",
    "content" "text",
    "selected_date" "date",
    "status" "text",
    "person_name" "text",
    "is_prayer_request" boolean,
    "prayed" boolean,
    "devotional_title" "text",
    "day_number" integer,
    "day_title" "text",
    "total_days" integer,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "answered_at" timestamp with time zone,
    "notes" "text",
    "requested_by" "text",
    "answered_date" timestamp with time zone,
    "metadata" "jsonb"
);


ALTER TABLE "public"."prayers_backup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."queue_performance" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('hour'::"text", "generation_queue"."created_at") AS "hour",
    "generation_queue"."status",
    "count"(*) AS "item_count",
    "avg"("generation_queue"."processing_time_ms") AS "avg_processing_time",
    "max"("generation_queue"."processing_time_ms") AS "max_processing_time",
    "avg"("generation_queue"."actual_tokens") AS "avg_tokens"
   FROM "public"."generation_queue"
  WHERE ("generation_queue"."created_at" >= (CURRENT_DATE - '7 days'::interval))
  GROUP BY ("date_trunc"('hour'::"text", "generation_queue"."created_at")), "generation_queue"."status"
  ORDER BY ("date_trunc"('hour'::"text", "generation_queue"."created_at")) DESC;


ALTER TABLE "public"."queue_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reflection_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'reflection'::"text" NOT NULL,
    "selected_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "source" "text",
    "devotional_title" "text",
    "day_number" integer,
    "day_title" "text",
    "total_days" integer,
    "question_number" integer,
    "prompt" "text",
    "tags" "text"[],
    "playbook_title" "text",
    "playbook_id" "uuid",
    "subtask_id" "uuid"
);


ALTER TABLE "public"."reflection_entries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reflection_entries"."source" IS 'Source of the reflection entry (e.g., devotional)';



COMMENT ON COLUMN "public"."reflection_entries"."devotional_title" IS 'Title of the devotional this reflection belongs to';



COMMENT ON COLUMN "public"."reflection_entries"."day_number" IS 'Day number within the devotional';



COMMENT ON COLUMN "public"."reflection_entries"."day_title" IS 'Title of the specific day in the devotional';



COMMENT ON COLUMN "public"."reflection_entries"."total_days" IS 'Total number of days in the devotional';



COMMENT ON COLUMN "public"."reflection_entries"."question_number" IS 'Question number within the day (if applicable)';



COMMENT ON COLUMN "public"."reflection_entries"."playbook_title" IS 'Title of the playbook this reflection belongs to';



COMMENT ON COLUMN "public"."reflection_entries"."playbook_id" IS 'UUID of the playbook this reflection belongs to';



COMMENT ON COLUMN "public"."reflection_entries"."subtask_id" IS 'UUID of the specific subtask this reflection is for';



CREATE TABLE IF NOT EXISTS "public"."retention_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "modal_shown" boolean DEFAULT false,
    "action_taken" "text",
    "discount_offered" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."retention_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_version" (
    "version" integer NOT NULL,
    "description" "text",
    "applied_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schema_version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "description" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['auth_attempt'::"text", 'data_access'::"text", 'api_call'::"text", 'suspicious_activity'::"text", 'security_violation'::"text"]))),
    CONSTRAINT "security_events_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."security_events" IS 'Enterprise security event logging for monitoring and compliance';



CREATE TABLE IF NOT EXISTS "public"."smart_expounded_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action_step_id" "uuid",
    "expounded_content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."smart_expounded_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_expounded_steps" IS 'Caches AI-generated expounded content for action steps';



CREATE TABLE IF NOT EXISTS "public"."smart_financial_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sub_task_id" "uuid",
    "entry_type" character varying(50) NOT NULL,
    "amount" numeric(10,2),
    "description" "text",
    "category" character varying(100),
    "date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."smart_financial_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_financial_entries" IS 'Stores financial stewardship entries (tithing, savings, expenses, investments)';



CREATE TABLE IF NOT EXISTS "public"."smart_journal_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sub_task_id" "uuid",
    "journal_type" character varying(50) NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."smart_journal_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_journal_entries" IS 'Stores all journal entries linked to action step subtasks';



CREATE TABLE IF NOT EXISTS "public"."step_expounding" (
    "id" "text" NOT NULL,
    "action_step_id" "uuid",
    "subtask_id" "uuid",
    "step_number" integer NOT NULL,
    "step_title" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "scripture_references" "text"[],
    "practical_steps" "text"[],
    "reflection_questions" "text"[],
    "ai_generated" boolean DEFAULT true,
    "user_id" "uuid",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "step_expounding_content_type_check" CHECK (("content_type" = ANY (ARRAY['spiritual_insight'::"text", 'practical_guidance'::"text", 'biblical_context'::"text", 'reflection_questions'::"text", 'step_breakdown'::"text"]))),
    CONSTRAINT "step_expounding_step_number_check" CHECK ((("step_number" >= 1) AND ("step_number" <= 10)))
);


ALTER TABLE "public"."step_expounding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_health_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_type" "text" NOT NULL,
    "metric_name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_health_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_health_metrics" IS 'System health and performance monitoring metrics';



CREATE TABLE IF NOT EXISTS "public"."time_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "selected_date" "date" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "all_day" boolean DEFAULT false NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "category" "text" NOT NULL,
    "repeat_rule" "jsonb",
    "repeat_until" timestamp with time zone,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "time_blocks_category_not_empty" CHECK (("length"(TRIM(BOTH FROM "category")) > 0)),
    CONSTRAINT "time_blocks_start_before_end" CHECK ((("start_time" < "end_time") OR ("all_day" = true))),
    CONSTRAINT "time_blocks_title_not_empty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."time_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "achievement_id" "text" NOT NULL,
    "progress" integer DEFAULT 0,
    "target" integer NOT NULL,
    "completed" boolean DEFAULT false,
    "points_reward" integer DEFAULT 0,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "progress_when_earned" "jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."user_behavior_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_behavior_events" IS 'Behavioral tracking for intelligence system - all local processing';



COMMENT ON COLUMN "public"."user_behavior_events"."engagement_score" IS 'Calculated engagement score for this event (0.0-1.0)';



CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_31" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_31" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_32" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_32" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_33" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_33" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_34" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_34" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_35" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_35" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_36" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_36" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_37" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_37" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_38" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_38" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_39" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_39" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_40" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_40" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_41" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_41" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_42" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_42" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_behavior_events_2025_43" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_category" "text" DEFAULT 'engagement'::"text",
    "playbook_id" "uuid",
    "devotional_id" "uuid",
    "journal_entry_id" "uuid",
    "sequence_number" integer,
    "duration_seconds" integer,
    "engagement_score" double precision DEFAULT 0,
    "success_indicator" boolean DEFAULT false
);


ALTER TABLE "public"."user_behavior_events_2025_43" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_challenge_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_challenge_id" "uuid" NOT NULL,
    "activity_id" "uuid",
    "activity_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "points_earned" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "quality_score" integer,
    CONSTRAINT "user_challenge_progress_quality_score_check" CHECK ((("quality_score" >= 1) AND ("quality_score" <= 5)))
);


ALTER TABLE "public"."user_challenge_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "status" "public"."challenge_status" DEFAULT 'active'::"public"."challenge_status" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date" NOT NULL,
    "completion_percentage" numeric(5,2) DEFAULT 0.00 NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "activities_completed" integer DEFAULT 0 NOT NULL,
    "total_activities" integer DEFAULT 0 NOT NULL,
    "points_earned" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_completion_percentage" CHECK ((("completion_percentage" >= (0)::numeric) AND ("completion_percentage" <= (100)::numeric))),
    CONSTRAINT "valid_dates" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."user_challenges" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_challenge_stats" WITH ("security_invoker"='true') AS
 SELECT "user_challenges"."user_id",
    "count"(*) AS "total_challenges",
    "count"(*) FILTER (WHERE ("user_challenges"."status" = 'active'::"public"."challenge_status")) AS "active_challenges",
    "count"(*) FILTER (WHERE ("user_challenges"."status" = 'completed'::"public"."challenge_status")) AS "completed_challenges",
    COALESCE("sum"("user_challenges"."points_earned"), (0)::bigint) AS "total_points_earned",
    COALESCE("max"("user_challenges"."longest_streak"), 0) AS "best_streak",
    COALESCE("avg"("user_challenges"."completion_percentage"), (0)::numeric) AS "avg_completion_rate"
   FROM "public"."user_challenges"
  GROUP BY "user_challenges"."user_id";


ALTER TABLE "public"."user_challenge_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid",
    "context_data" "jsonb" NOT NULL,
    "confidence_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_contexts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_engagement_stats" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('day'::"text", "user_behavior_events"."created_at") AS "day",
    "count"(DISTINCT "user_behavior_events"."user_id") AS "active_users",
    "count"(*) AS "total_events",
    "count"(*) FILTER (WHERE ("user_behavior_events"."event_type" = 'playbook_generated'::"text")) AS "playbooks_generated",
    "count"(*) FILTER (WHERE ("user_behavior_events"."event_type" = 'devotional_generated'::"text")) AS "devotionals_generated"
   FROM "public"."user_behavior_events"
  WHERE ("user_behavior_events"."created_at" >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY ("date_trunc"('day'::"text", "user_behavior_events"."created_at"))
  ORDER BY ("date_trunc"('day'::"text", "user_behavior_events"."created_at")) DESC;


ALTER TABLE "public"."user_engagement_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "text",
    "page_url" "text",
    "user_agent" "text",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_intelligence_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "spiritual_maturity" "text" DEFAULT 'beginner'::"text",
    "learning_style" "text" DEFAULT 'balanced'::"text",
    "preferred_challenge_level" "text" DEFAULT 'moderate'::"text",
    "communication_style" "text" DEFAULT 'balanced'::"text",
    "successful_playbook_types" "text"[] DEFAULT '{}'::"text"[],
    "successful_devotional_types" "text"[] DEFAULT '{}'::"text"[],
    "optimal_action_step_count" integer DEFAULT 5,
    "preferred_content_length" "text" DEFAULT 'medium'::"text",
    "best_engagement_times" integer[] DEFAULT '{}'::integer[],
    "typical_session_length" integer DEFAULT 15,
    "preferred_session_frequency" integer DEFAULT 3,
    "average_completion_rate" double precision DEFAULT 0,
    "consistency_score" double precision DEFAULT 0,
    "engagement_depth_score" double precision DEFAULT 0,
    "focus_areas" "text"[] DEFAULT '{}'::"text"[],
    "growth_areas" "text"[] DEFAULT '{}'::"text"[],
    "strength_areas" "text"[] DEFAULT '{}'::"text"[],
    "preferred_bible_versions" "text"[] DEFAULT '{NIV}'::"text"[],
    "favorite_topics" "text"[] DEFAULT '{}'::"text"[],
    "avoided_topics" "text"[] DEFAULT '{}'::"text"[],
    "confidence_score" double precision DEFAULT 0,
    "data_points_count" integer DEFAULT 0,
    "last_analysis" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_intelligence_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_intelligence_profiles" IS 'AI personalization profiles built from local analysis';



COMMENT ON COLUMN "public"."user_intelligence_profiles"."confidence_score" IS 'How confident we are in this profile (0.0-1.0)';



CREATE TABLE IF NOT EXISTS "public"."user_questions" (
    "id" "text" NOT NULL,
    "action_step_id" "uuid",
    "subtask_id" "uuid",
    "user_question" "text" NOT NULL,
    "ai_response" "text" NOT NULL,
    "response_type" "text" NOT NULL,
    "related_step_number" integer,
    "parent_expounding_id" "text",
    "user_id" "uuid",
    "is_helpful" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_questions_response_type_check" CHECK (("response_type" = ANY (ARRAY['clarification'::"text", 'deeper_insight'::"text", 'practical_help'::"text", 'biblical_guidance'::"text"])))
);


ALTER TABLE "public"."user_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "user_agent" "text",
    "ip_address" "inet",
    "expires_at" timestamp with time zone NOT NULL,
    "revoked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "price_id" "text",
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "intelligence_enabled" boolean DEFAULT false,
    "advanced_analytics" boolean DEFAULT false,
    "priority_support" boolean DEFAULT false,
    "export_features" boolean DEFAULT false,
    "family_owner_id" "uuid",
    "family_members" "uuid"[] DEFAULT '{}'::"uuid"[],
    "max_family_members" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_subscriptions" IS 'User subscription plans and status';



COMMENT ON COLUMN "public"."user_subscriptions"."intelligence_enabled" IS 'Whether user has access to AI personalization features';



CREATE TABLE IF NOT EXISTS "public"."verification_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "type" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."verification_tokens" OWNER TO "postgres";


ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2025_08" FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2025_09" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2026_01" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."faith_points_transactions" ATTACH PARTITION "public"."faith_points_transactions_2026_02" FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2025_08" FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2025_09" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_01" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_02" FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_03" FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_04" FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_05" FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_06" FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_07" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');



ALTER TABLE ONLY "public"."generated_content" ATTACH PARTITION "public"."generated_content_2026_08" FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_05" FOR VALUES FROM ('2025-08-05 00:00:00+00') TO ('2025-08-06 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_06" FOR VALUES FROM ('2025-08-06 00:00:00+00') TO ('2025-08-07 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_07" FOR VALUES FROM ('2025-08-07 00:00:00+00') TO ('2025-08-08 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_08" FOR VALUES FROM ('2025-08-08 00:00:00+00') TO ('2025-08-09 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_09" FOR VALUES FROM ('2025-08-09 00:00:00+00') TO ('2025-08-10 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_10" FOR VALUES FROM ('2025-08-10 00:00:00+00') TO ('2025-08-11 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_11" FOR VALUES FROM ('2025-08-11 00:00:00+00') TO ('2025-08-12 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_12" FOR VALUES FROM ('2025-08-12 00:00:00+00') TO ('2025-08-13 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_13" FOR VALUES FROM ('2025-08-13 00:00:00+00') TO ('2025-08-14 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_14" FOR VALUES FROM ('2025-08-14 00:00:00+00') TO ('2025-08-15 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_15" FOR VALUES FROM ('2025-08-15 00:00:00+00') TO ('2025-08-16 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_16" FOR VALUES FROM ('2025-08-16 00:00:00+00') TO ('2025-08-17 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_17" FOR VALUES FROM ('2025-08-17 00:00:00+00') TO ('2025-08-18 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_18" FOR VALUES FROM ('2025-08-18 00:00:00+00') TO ('2025-08-19 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_19" FOR VALUES FROM ('2025-08-19 00:00:00+00') TO ('2025-08-20 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_20" FOR VALUES FROM ('2025-08-20 00:00:00+00') TO ('2025-08-21 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_21" FOR VALUES FROM ('2025-08-21 00:00:00+00') TO ('2025-08-22 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_22" FOR VALUES FROM ('2025-08-22 00:00:00+00') TO ('2025-08-23 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_23" FOR VALUES FROM ('2025-08-23 00:00:00+00') TO ('2025-08-24 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_24" FOR VALUES FROM ('2025-08-24 00:00:00+00') TO ('2025-08-25 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_25" FOR VALUES FROM ('2025-08-25 00:00:00+00') TO ('2025-08-26 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_26" FOR VALUES FROM ('2025-08-26 00:00:00+00') TO ('2025-08-27 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_27" FOR VALUES FROM ('2025-08-27 00:00:00+00') TO ('2025-08-28 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_28" FOR VALUES FROM ('2025-08-28 00:00:00+00') TO ('2025-08-29 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_29" FOR VALUES FROM ('2025-08-29 00:00:00+00') TO ('2025-08-30 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_30" FOR VALUES FROM ('2025-08-30 00:00:00+00') TO ('2025-08-31 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_08_31" FOR VALUES FROM ('2025-08-31 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_09_01" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-09-02 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_09_02" FOR VALUES FROM ('2025-09-02 00:00:00+00') TO ('2025-09-03 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_09_03" FOR VALUES FROM ('2025-09-03 00:00:00+00') TO ('2025-09-04 00:00:00+00');



ALTER TABLE ONLY "public"."generation_queue" ATTACH PARTITION "public"."generation_queue_2025_09_04" FOR VALUES FROM ('2025-09-04 00:00:00+00') TO ('2025-09-05 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_31" FOR VALUES FROM ('2025-08-04 00:00:00+00') TO ('2025-08-11 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_32" FOR VALUES FROM ('2025-08-11 00:00:00+00') TO ('2025-08-18 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_33" FOR VALUES FROM ('2025-08-18 00:00:00+00') TO ('2025-08-25 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_34" FOR VALUES FROM ('2025-08-25 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_35" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-09-08 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_36" FOR VALUES FROM ('2025-09-08 00:00:00+00') TO ('2025-09-15 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_37" FOR VALUES FROM ('2025-09-15 00:00:00+00') TO ('2025-09-22 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_38" FOR VALUES FROM ('2025-09-22 00:00:00+00') TO ('2025-09-29 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_39" FOR VALUES FROM ('2025-09-29 00:00:00+00') TO ('2025-10-06 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_40" FOR VALUES FROM ('2025-10-06 00:00:00+00') TO ('2025-10-13 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_41" FOR VALUES FROM ('2025-10-13 00:00:00+00') TO ('2025-10-20 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_42" FOR VALUES FROM ('2025-10-20 00:00:00+00') TO ('2025-10-27 00:00:00+00');



ALTER TABLE ONLY "public"."user_behavior_events" ATTACH PARTITION "public"."user_behavior_events_2025_43" FOR VALUES FROM ('2025-10-27 00:00:00+00') TO ('2025-11-03 00:00:00+00');



ALTER TABLE ONLY "public"."ab_test_assignments"
    ADD CONSTRAINT "ab_test_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ab_test_assignments"
    ADD CONSTRAINT "ab_test_assignments_user_test_unique" UNIQUE ("user_id", "test_name");



ALTER TABLE ONLY "public"."application_logs"
    ADD CONSTRAINT "application_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_trail"
    ADD CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_activities"
    ADD CONSTRAINT "challenge_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_analytics"
    ADD CONSTRAINT "challenge_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_milestones"
    ADD CONSTRAINT "challenge_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."christ_acceptance_events"
    ADD CONSTRAINT "christ_acceptance_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_effectiveness"
    ADD CONSTRAINT "content_effectiveness_content_id_user_id_key" UNIQUE ("content_id", "user_id");



ALTER TABLE ONLY "public"."content_effectiveness"
    ADD CONSTRAINT "content_effectiveness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."data_classification"
    ADD CONSTRAINT "data_classification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_classification"
    ADD CONSTRAINT "data_classification_table_name_column_name_key" UNIQUE ("table_name", "column_name");



ALTER TABLE ONLY "public"."devotionals"
    ADD CONSTRAINT "devotionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expounding_content_legacy"
    ADD CONSTRAINT "expounding_content_legacy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expounding_content"
    ADD CONSTRAINT "expounding_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faith_journey_profiles"
    ADD CONSTRAINT "faith_journey_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faith_journey_profiles"
    ADD CONSTRAINT "faith_journey_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."faith_points_log"
    ADD CONSTRAINT "faith_points_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faith_points_profiles"
    ADD CONSTRAINT "faith_points_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faith_points_profiles"
    ADD CONSTRAINT "faith_points_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."faith_points_transactions"
    ADD CONSTRAINT "faith_points_transactions_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2025_08"
    ADD CONSTRAINT "faith_points_transactions_2025_08_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2025_09"
    ADD CONSTRAINT "faith_points_transactions_2025_09_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2025_10"
    ADD CONSTRAINT "faith_points_transactions_2025_10_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2025_11"
    ADD CONSTRAINT "faith_points_transactions_2025_11_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2025_12"
    ADD CONSTRAINT "faith_points_transactions_2025_12_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2026_01"
    ADD CONSTRAINT "faith_points_transactions_2026_01_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."faith_points_transactions_2026_02"
    ADD CONSTRAINT "faith_points_transactions_2026_02_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content"
    ADD CONSTRAINT "generated_content_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2025_08"
    ADD CONSTRAINT "generated_content_2025_08_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2025_09"
    ADD CONSTRAINT "generated_content_2025_09_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2025_10"
    ADD CONSTRAINT "generated_content_2025_10_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2025_11"
    ADD CONSTRAINT "generated_content_2025_11_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2025_12"
    ADD CONSTRAINT "generated_content_2025_12_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_01"
    ADD CONSTRAINT "generated_content_2026_01_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_02"
    ADD CONSTRAINT "generated_content_2026_02_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_03"
    ADD CONSTRAINT "generated_content_2026_03_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_04"
    ADD CONSTRAINT "generated_content_2026_04_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_05"
    ADD CONSTRAINT "generated_content_2026_05_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_06"
    ADD CONSTRAINT "generated_content_2026_06_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_07"
    ADD CONSTRAINT "generated_content_2026_07_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generated_content_2026_08"
    ADD CONSTRAINT "generated_content_2026_08_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue"
    ADD CONSTRAINT "generation_queue_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_05"
    ADD CONSTRAINT "generation_queue_2025_08_05_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_06"
    ADD CONSTRAINT "generation_queue_2025_08_06_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_07"
    ADD CONSTRAINT "generation_queue_2025_08_07_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_08"
    ADD CONSTRAINT "generation_queue_2025_08_08_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_09"
    ADD CONSTRAINT "generation_queue_2025_08_09_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_10"
    ADD CONSTRAINT "generation_queue_2025_08_10_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_11"
    ADD CONSTRAINT "generation_queue_2025_08_11_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_12"
    ADD CONSTRAINT "generation_queue_2025_08_12_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_13"
    ADD CONSTRAINT "generation_queue_2025_08_13_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_14"
    ADD CONSTRAINT "generation_queue_2025_08_14_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_15"
    ADD CONSTRAINT "generation_queue_2025_08_15_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_16"
    ADD CONSTRAINT "generation_queue_2025_08_16_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_17"
    ADD CONSTRAINT "generation_queue_2025_08_17_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_18"
    ADD CONSTRAINT "generation_queue_2025_08_18_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_19"
    ADD CONSTRAINT "generation_queue_2025_08_19_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_20"
    ADD CONSTRAINT "generation_queue_2025_08_20_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_21"
    ADD CONSTRAINT "generation_queue_2025_08_21_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_22"
    ADD CONSTRAINT "generation_queue_2025_08_22_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_23"
    ADD CONSTRAINT "generation_queue_2025_08_23_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_24"
    ADD CONSTRAINT "generation_queue_2025_08_24_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_25"
    ADD CONSTRAINT "generation_queue_2025_08_25_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_26"
    ADD CONSTRAINT "generation_queue_2025_08_26_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_27"
    ADD CONSTRAINT "generation_queue_2025_08_27_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_28"
    ADD CONSTRAINT "generation_queue_2025_08_28_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_29"
    ADD CONSTRAINT "generation_queue_2025_08_29_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_30"
    ADD CONSTRAINT "generation_queue_2025_08_30_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_08_31"
    ADD CONSTRAINT "generation_queue_2025_08_31_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_09_01"
    ADD CONSTRAINT "generation_queue_2025_09_01_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_09_02"
    ADD CONSTRAINT "generation_queue_2025_09_02_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_09_03"
    ADD CONSTRAINT "generation_queue_2025_09_03_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."generation_queue_2025_09_04"
    ADD CONSTRAINT "generation_queue_2025_09_04_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."growth_levels"
    ADD CONSTRAINT "growth_levels_pkey" PRIMARY KEY ("level_name");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_templates"
    ADD CONSTRAINT "journal_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_notification_type_key" UNIQUE ("user_id", "notification_type");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_content_effectiveness"
    ADD CONSTRAINT "onboarding_content_effectiveness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_content_effectiveness"
    ADD CONSTRAINT "onboarding_content_effectiveness_step_name_content_variant_key" UNIQUE ("step_name", "content_variant");



ALTER TABLE ONLY "public"."onboarding_personalization_profiles"
    ADD CONSTRAINT "onboarding_personalization_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_personalization_profiles"
    ADD CONSTRAINT "onboarding_personalization_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."onboarding_step_analytics"
    ADD CONSTRAINT "onboarding_step_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbook_action_steps"
    ADD CONSTRAINT "playbook_action_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbook_action_steps"
    ADD CONSTRAINT "playbook_action_steps_playbook_id_order_index_key" UNIQUE ("playbook_id", "order_index");



ALTER TABLE ONLY "public"."playbook_affirmations"
    ADD CONSTRAINT "playbook_affirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbook_affirmations"
    ADD CONSTRAINT "playbook_affirmations_playbook_id_order_index_key" UNIQUE ("playbook_id", "order_index");



ALTER TABLE ONLY "public"."playbook_sub_tasks"
    ADD CONSTRAINT "playbook_sub_tasks_action_step_id_order_index_key" UNIQUE ("action_step_id", "order_index");



ALTER TABLE ONLY "public"."playbook_sub_tasks"
    ADD CONSTRAINT "playbook_sub_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbooks"
    ADD CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayers"
    ADD CONSTRAINT "prayers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reflection_entries"
    ADD CONSTRAINT "reflection_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retention_events"
    ADD CONSTRAINT "retention_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_version"
    ADD CONSTRAINT "schema_version_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_expounded_steps"
    ADD CONSTRAINT "smart_expounded_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_financial_entries"
    ADD CONSTRAINT "smart_financial_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_journal_entries"
    ADD CONSTRAINT "smart_journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_expounding"
    ADD CONSTRAINT "step_expounding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_health_metrics"
    ADD CONSTRAINT "system_health_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_user_date_start_unique" UNIQUE ("user_id", "selected_date", "start_time");



ALTER TABLE ONLY "public"."user_challenge_progress"
    ADD CONSTRAINT "unique_daily_activity" UNIQUE ("user_challenge_id", "activity_id", "activity_date");



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "unique_user_challenge" UNIQUE ("user_id", "challenge_id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_behavior_events"
    ADD CONSTRAINT "user_behavior_events_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_31"
    ADD CONSTRAINT "user_behavior_events_2025_31_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_32"
    ADD CONSTRAINT "user_behavior_events_2025_32_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_33"
    ADD CONSTRAINT "user_behavior_events_2025_33_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_34"
    ADD CONSTRAINT "user_behavior_events_2025_34_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_35"
    ADD CONSTRAINT "user_behavior_events_2025_35_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_36"
    ADD CONSTRAINT "user_behavior_events_2025_36_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_37"
    ADD CONSTRAINT "user_behavior_events_2025_37_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_38"
    ADD CONSTRAINT "user_behavior_events_2025_38_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_39"
    ADD CONSTRAINT "user_behavior_events_2025_39_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_40"
    ADD CONSTRAINT "user_behavior_events_2025_40_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_41"
    ADD CONSTRAINT "user_behavior_events_2025_41_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_42"
    ADD CONSTRAINT "user_behavior_events_2025_42_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_behavior_events_2025_43"
    ADD CONSTRAINT "user_behavior_events_2025_43_id_created_at_key" UNIQUE ("id", "created_at");



ALTER TABLE ONLY "public"."user_challenge_progress"
    ADD CONSTRAINT "user_challenge_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_contexts"
    ADD CONSTRAINT "user_contexts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_intelligence_profiles"
    ADD CONSTRAINT "user_intelligence_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_intelligence_profiles"
    ADD CONSTRAINT "user_intelligence_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."user_questions"
    ADD CONSTRAINT "user_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."verification_tokens"
    ADD CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_tokens"
    ADD CONSTRAINT "verification_tokens_user_id_type_token_key" UNIQUE ("user_id", "type", "token");



CREATE INDEX "idx_faith_points_transactions_category" ON ONLY "public"."faith_points_transactions" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2025_08_category_created_at_idx" ON "public"."faith_points_transactions_2025_08" USING "btree" ("category", "created_at");



CREATE INDEX "idx_faith_points_transactions_user_id" ON ONLY "public"."faith_points_transactions" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2025_08_user_id_created_at_idx" ON "public"."faith_points_transactions_2025_08" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2025_09_category_created_at_idx" ON "public"."faith_points_transactions_2025_09" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2025_09_user_id_created_at_idx" ON "public"."faith_points_transactions_2025_09" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2025_10_category_created_at_idx" ON "public"."faith_points_transactions_2025_10" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2025_10_user_id_created_at_idx" ON "public"."faith_points_transactions_2025_10" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2025_11_category_created_at_idx" ON "public"."faith_points_transactions_2025_11" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2025_11_user_id_created_at_idx" ON "public"."faith_points_transactions_2025_11" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2025_12_category_created_at_idx" ON "public"."faith_points_transactions_2025_12" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2025_12_user_id_created_at_idx" ON "public"."faith_points_transactions_2025_12" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2026_01_category_created_at_idx" ON "public"."faith_points_transactions_2026_01" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2026_01_user_id_created_at_idx" ON "public"."faith_points_transactions_2026_01" USING "btree" ("user_id", "created_at");



CREATE INDEX "faith_points_transactions_2026_02_category_created_at_idx" ON "public"."faith_points_transactions_2026_02" USING "btree" ("category", "created_at");



CREATE INDEX "faith_points_transactions_2026_02_user_id_created_at_idx" ON "public"."faith_points_transactions_2026_02" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_generated_content_type" ON ONLY "public"."generated_content" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2025_08_content_type_created_at_idx" ON "public"."generated_content_2025_08" USING "btree" ("content_type", "created_at");



CREATE INDEX "idx_generated_content_status" ON ONLY "public"."generated_content" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2025_08_status_created_at_idx" ON "public"."generated_content_2025_08" USING "btree" ("status", "created_at");



CREATE INDEX "idx_generated_content_user_id" ON ONLY "public"."generated_content" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2025_08_user_id_created_at_idx" ON "public"."generated_content_2025_08" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2025_09_content_type_created_at_idx" ON "public"."generated_content_2025_09" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2025_09_status_created_at_idx" ON "public"."generated_content_2025_09" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2025_09_user_id_created_at_idx" ON "public"."generated_content_2025_09" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2025_10_content_type_created_at_idx" ON "public"."generated_content_2025_10" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2025_10_status_created_at_idx" ON "public"."generated_content_2025_10" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2025_10_user_id_created_at_idx" ON "public"."generated_content_2025_10" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2025_11_content_type_created_at_idx" ON "public"."generated_content_2025_11" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2025_11_status_created_at_idx" ON "public"."generated_content_2025_11" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2025_11_user_id_created_at_idx" ON "public"."generated_content_2025_11" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2025_12_content_type_created_at_idx" ON "public"."generated_content_2025_12" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2025_12_status_created_at_idx" ON "public"."generated_content_2025_12" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2025_12_user_id_created_at_idx" ON "public"."generated_content_2025_12" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_01_content_type_created_at_idx" ON "public"."generated_content_2026_01" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_01_status_created_at_idx" ON "public"."generated_content_2026_01" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_01_user_id_created_at_idx" ON "public"."generated_content_2026_01" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_02_content_type_created_at_idx" ON "public"."generated_content_2026_02" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_02_status_created_at_idx" ON "public"."generated_content_2026_02" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_02_user_id_created_at_idx" ON "public"."generated_content_2026_02" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_03_content_type_created_at_idx" ON "public"."generated_content_2026_03" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_03_status_created_at_idx" ON "public"."generated_content_2026_03" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_03_user_id_created_at_idx" ON "public"."generated_content_2026_03" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_04_content_type_created_at_idx" ON "public"."generated_content_2026_04" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_04_status_created_at_idx" ON "public"."generated_content_2026_04" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_04_user_id_created_at_idx" ON "public"."generated_content_2026_04" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_05_content_type_created_at_idx" ON "public"."generated_content_2026_05" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_05_status_created_at_idx" ON "public"."generated_content_2026_05" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_05_user_id_created_at_idx" ON "public"."generated_content_2026_05" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_06_content_type_created_at_idx" ON "public"."generated_content_2026_06" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_06_status_created_at_idx" ON "public"."generated_content_2026_06" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_06_user_id_created_at_idx" ON "public"."generated_content_2026_06" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_07_content_type_created_at_idx" ON "public"."generated_content_2026_07" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_07_status_created_at_idx" ON "public"."generated_content_2026_07" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_07_user_id_created_at_idx" ON "public"."generated_content_2026_07" USING "btree" ("user_id", "created_at");



CREATE INDEX "generated_content_2026_08_content_type_created_at_idx" ON "public"."generated_content_2026_08" USING "btree" ("content_type", "created_at");



CREATE INDEX "generated_content_2026_08_status_created_at_idx" ON "public"."generated_content_2026_08" USING "btree" ("status", "created_at");



CREATE INDEX "generated_content_2026_08_user_id_created_at_idx" ON "public"."generated_content_2026_08" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_generation_queue_priority" ON ONLY "public"."generation_queue" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_05_priority_created_at_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_generation_queue_processing" ON ONLY "public"."generation_queue" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_05_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_generation_queue_status" ON ONLY "public"."generation_queue" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_05_status_updated_at_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("status", "updated_at");



CREATE INDEX "idx_generation_queue_type" ON ONLY "public"."generation_queue" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_05_type_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("type");



CREATE INDEX "idx_generation_queue_user_id" ON ONLY "public"."generation_queue" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_05_user_id_created_at_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_generation_queue_user" ON ONLY "public"."generation_queue" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_05_user_id_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("user_id");



CREATE INDEX "idx_generation_queue_worker" ON ONLY "public"."generation_queue" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_05_worker_id_idx" ON "public"."generation_queue_2025_08_05" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_06_priority_created_at_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_06_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_06_status_updated_at_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_06_type_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_06_user_id_created_at_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_06_user_id_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_06_worker_id_idx" ON "public"."generation_queue_2025_08_06" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_07_priority_created_at_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_07_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_07_status_updated_at_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_07_type_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_07_user_id_created_at_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_07_user_id_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_07_worker_id_idx" ON "public"."generation_queue_2025_08_07" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_08_priority_created_at_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_08_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_08_status_updated_at_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_08_type_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_08_user_id_created_at_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_08_user_id_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_08_worker_id_idx" ON "public"."generation_queue_2025_08_08" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_09_priority_created_at_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_09_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_09_status_updated_at_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_09_type_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_09_user_id_created_at_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_09_user_id_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_09_worker_id_idx" ON "public"."generation_queue_2025_08_09" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_10_priority_created_at_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_10_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_10_status_updated_at_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_10_type_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_10_user_id_created_at_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_10_user_id_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_10_worker_id_idx" ON "public"."generation_queue_2025_08_10" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_11_priority_created_at_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_11_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_11_status_updated_at_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_11_type_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_11_user_id_created_at_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_11_user_id_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_11_worker_id_idx" ON "public"."generation_queue_2025_08_11" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_12_priority_created_at_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_12_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_12_status_updated_at_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_12_type_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_12_user_id_created_at_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_12_user_id_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_12_worker_id_idx" ON "public"."generation_queue_2025_08_12" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_13_priority_created_at_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_13_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_13_status_updated_at_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_13_type_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_13_user_id_created_at_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_13_user_id_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_13_worker_id_idx" ON "public"."generation_queue_2025_08_13" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_14_priority_created_at_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_14_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_14_status_updated_at_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_14_type_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_14_user_id_created_at_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_14_user_id_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_14_worker_id_idx" ON "public"."generation_queue_2025_08_14" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_15_priority_created_at_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_15_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_15_status_updated_at_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_15_type_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_15_user_id_created_at_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_15_user_id_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_15_worker_id_idx" ON "public"."generation_queue_2025_08_15" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_16_priority_created_at_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_16_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_16_status_updated_at_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_16_type_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_16_user_id_created_at_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_16_user_id_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_16_worker_id_idx" ON "public"."generation_queue_2025_08_16" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_17_priority_created_at_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_17_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_17_status_updated_at_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_17_type_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_17_user_id_created_at_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_17_user_id_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_17_worker_id_idx" ON "public"."generation_queue_2025_08_17" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_18_priority_created_at_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_18_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_18_status_updated_at_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_18_type_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_18_user_id_created_at_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_18_user_id_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_18_worker_id_idx" ON "public"."generation_queue_2025_08_18" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_19_priority_created_at_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_19_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_19_status_updated_at_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_19_type_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_19_user_id_created_at_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_19_user_id_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_19_worker_id_idx" ON "public"."generation_queue_2025_08_19" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_20_priority_created_at_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_20_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_20_status_updated_at_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_20_type_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_20_user_id_created_at_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_20_user_id_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_20_worker_id_idx" ON "public"."generation_queue_2025_08_20" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_21_priority_created_at_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_21_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_21_status_updated_at_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_21_type_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_21_user_id_created_at_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_21_user_id_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_21_worker_id_idx" ON "public"."generation_queue_2025_08_21" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_22_priority_created_at_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_22_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_22_status_updated_at_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_22_type_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_22_user_id_created_at_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_22_user_id_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_22_worker_id_idx" ON "public"."generation_queue_2025_08_22" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_23_priority_created_at_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_23_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_23_status_updated_at_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_23_type_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_23_user_id_created_at_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_23_user_id_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_23_worker_id_idx" ON "public"."generation_queue_2025_08_23" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_24_priority_created_at_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_24_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_24_status_updated_at_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_24_type_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_24_user_id_created_at_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_24_user_id_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_24_worker_id_idx" ON "public"."generation_queue_2025_08_24" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_25_priority_created_at_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_25_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_25_status_updated_at_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_25_type_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_25_user_id_created_at_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_25_user_id_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_25_worker_id_idx" ON "public"."generation_queue_2025_08_25" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_26_priority_created_at_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_26_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_26_status_updated_at_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_26_type_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_26_user_id_created_at_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_26_user_id_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_26_worker_id_idx" ON "public"."generation_queue_2025_08_26" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_27_priority_created_at_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_27_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_27_status_updated_at_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_27_type_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_27_user_id_created_at_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_27_user_id_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_27_worker_id_idx" ON "public"."generation_queue_2025_08_27" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_28_priority_created_at_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_28_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_28_status_updated_at_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_28_type_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_28_user_id_created_at_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_28_user_id_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_28_worker_id_idx" ON "public"."generation_queue_2025_08_28" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_29_priority_created_at_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_29_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_29_status_updated_at_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_29_type_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_29_user_id_created_at_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_29_user_id_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_29_worker_id_idx" ON "public"."generation_queue_2025_08_29" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_30_priority_created_at_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_30_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_30_status_updated_at_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_30_type_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_30_user_id_created_at_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_30_user_id_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_30_worker_id_idx" ON "public"."generation_queue_2025_08_30" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_08_31_priority_created_at_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_08_31_status_priority_created_at_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_08_31_status_updated_at_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_08_31_type_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_08_31_user_id_created_at_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_08_31_user_id_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_08_31_worker_id_idx" ON "public"."generation_queue_2025_08_31" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_09_01_priority_created_at_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_09_01_status_priority_created_at_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_09_01_status_updated_at_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_09_01_type_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_09_01_user_id_created_at_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_09_01_user_id_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_09_01_worker_id_idx" ON "public"."generation_queue_2025_09_01" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_09_02_priority_created_at_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_09_02_status_priority_created_at_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_09_02_status_updated_at_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_09_02_type_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_09_02_user_id_created_at_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_09_02_user_id_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_09_02_worker_id_idx" ON "public"."generation_queue_2025_09_02" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_09_03_priority_created_at_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_09_03_status_priority_created_at_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_09_03_status_updated_at_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_09_03_type_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_09_03_user_id_created_at_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_09_03_user_id_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_09_03_worker_id_idx" ON "public"."generation_queue_2025_09_03" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "generation_queue_2025_09_04_priority_created_at_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("priority", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "generation_queue_2025_09_04_status_priority_created_at_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("status", "priority", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "generation_queue_2025_09_04_status_updated_at_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("status", "updated_at");



CREATE INDEX "generation_queue_2025_09_04_type_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("type");



CREATE INDEX "generation_queue_2025_09_04_user_id_created_at_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("user_id", "created_at");



CREATE INDEX "generation_queue_2025_09_04_user_id_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("user_id");



CREATE INDEX "generation_queue_2025_09_04_worker_id_idx" ON "public"."generation_queue_2025_09_04" USING "btree" ("worker_id") WHERE ("status" = 'processing'::"text");



CREATE INDEX "idx_action_steps_completed" ON "public"."playbook_action_steps" USING "btree" ("completed");



CREATE INDEX "idx_action_steps_order" ON "public"."playbook_action_steps" USING "btree" ("playbook_id", "order_index");



CREATE INDEX "idx_action_steps_playbook_id" ON "public"."playbook_action_steps" USING "btree" ("playbook_id");



CREATE INDEX "idx_affirmations_completed" ON "public"."playbook_affirmations" USING "btree" ("completed");



CREATE INDEX "idx_affirmations_order" ON "public"."playbook_affirmations" USING "btree" ("playbook_id", "order_index");



CREATE INDEX "idx_affirmations_playbook_id" ON "public"."playbook_affirmations" USING "btree" ("playbook_id");



CREATE INDEX "idx_analytics_event_type" ON "public"."challenge_analytics" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_user_id" ON "public"."challenge_analytics" USING "btree" ("user_id");



CREATE INDEX "idx_application_logs_correlation_id" ON "public"."application_logs" USING "btree" ("correlation_id");



CREATE INDEX "idx_application_logs_level" ON "public"."application_logs" USING "btree" ("level");



CREATE INDEX "idx_application_logs_service" ON "public"."application_logs" USING "btree" ("service");



CREATE INDEX "idx_application_logs_timestamp" ON "public"."application_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_application_logs_user_id" ON "public"."application_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_trail_correlation_id" ON "public"."audit_trail" USING "btree" ("correlation_id");



CREATE INDEX "idx_audit_trail_resource" ON "public"."audit_trail" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_audit_trail_timestamp" ON "public"."audit_trail" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_audit_trail_user_id" ON "public"."audit_trail" USING "btree" ("user_id");



CREATE INDEX "idx_auth_logs_user_id" ON "public"."auth_logs" USING "btree" ("user_id");



CREATE INDEX "idx_behavior_events_category" ON ONLY "public"."user_behavior_events" USING "btree" ("event_category");



CREATE INDEX "idx_behavior_events_created" ON ONLY "public"."user_behavior_events" USING "btree" ("created_at");



CREATE INDEX "idx_behavior_events_session" ON ONLY "public"."user_behavior_events" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_behavior_events_type" ON ONLY "public"."user_behavior_events" USING "btree" ("event_type");



CREATE INDEX "idx_behavior_events_user_id" ON ONLY "public"."user_behavior_events" USING "btree" ("user_id");



CREATE INDEX "idx_behavior_events_user_type" ON ONLY "public"."user_behavior_events" USING "btree" ("user_id", "event_type");



CREATE INDEX "idx_challenge_activities_challenge_id" ON "public"."challenge_activities" USING "btree" ("challenge_id");



CREATE INDEX "idx_challenge_activities_type" ON "public"."challenge_activities" USING "btree" ("activity_type");



CREATE INDEX "idx_challenges_active" ON "public"."challenges" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_challenges_category" ON "public"."challenges" USING "btree" ("category");



CREATE INDEX "idx_challenges_difficulty" ON "public"."challenges" USING "btree" ("difficulty");



CREATE INDEX "idx_christ_acceptance_context" ON "public"."christ_acceptance_events" USING "btree" ("acceptance_context");



CREATE INDEX "idx_christ_acceptance_created" ON "public"."christ_acceptance_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_christ_acceptance_follow_up" ON "public"."christ_acceptance_events" USING "btree" ("needs_follow_up", "follow_up_completed");



CREATE INDEX "idx_christ_acceptance_user_id" ON "public"."christ_acceptance_events" USING "btree" ("user_id");



CREATE INDEX "idx_content_effectiveness_completion" ON "public"."onboarding_content_effectiveness" USING "btree" ("completion_rate" DESC);



CREATE INDEX "idx_content_effectiveness_content" ON "public"."content_effectiveness" USING "btree" ("content_type", "content_id");



CREATE INDEX "idx_content_effectiveness_step" ON "public"."onboarding_content_effectiveness" USING "btree" ("step_name");



CREATE INDEX "idx_content_effectiveness_user" ON "public"."content_effectiveness" USING "btree" ("user_id");



CREATE INDEX "idx_content_effectiveness_variant" ON "public"."onboarding_content_effectiveness" USING "btree" ("content_variant");



CREATE INDEX "idx_content_library_created_at" ON "public"."content_library" USING "btree" ("created_at");



CREATE INDEX "idx_content_library_shared" ON "public"."content_library" USING "btree" ("is_shared") WHERE ("is_shared" = true);



CREATE INDEX "idx_content_library_type" ON "public"."content_library" USING "btree" ("content_type");



CREATE INDEX "idx_content_library_user_id" ON "public"."content_library" USING "btree" ("user_id");



CREATE INDEX "idx_content_library_user_type" ON "public"."content_library" USING "btree" ("user_id", "content_type", "created_at");



CREATE INDEX "idx_devotionals_category" ON "public"."devotionals" USING "btree" ("category");



CREATE INDEX "idx_devotionals_completed" ON "public"."devotionals" USING "btree" ("completed");



CREATE INDEX "idx_devotionals_created_at" ON "public"."devotionals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_devotionals_playbook_id" ON "public"."devotionals" USING "btree" ("playbook_id");



CREATE INDEX "idx_devotionals_user_id" ON "public"."devotionals" USING "btree" ("user_id");



CREATE INDEX "idx_expounding_content_action_step" ON "public"."expounding_content" USING "btree" ("action_step_id");



CREATE INDEX "idx_expounding_content_legacy_action_step" ON "public"."expounding_content_legacy" USING "btree" ("action_step_id");



CREATE INDEX "idx_expounding_content_legacy_subtask" ON "public"."expounding_content_legacy" USING "btree" ("subtask_id");



CREATE INDEX "idx_expounding_content_legacy_user" ON "public"."expounding_content_legacy" USING "btree" ("user_id");



CREATE INDEX "idx_expounding_content_subtask" ON "public"."expounding_content" USING "btree" ("subtask_id");



CREATE INDEX "idx_faith_journey_acceptance" ON "public"."faith_journey_profiles" USING "btree" ("has_accepted_christ");



CREATE INDEX "idx_faith_journey_care" ON "public"."faith_journey_profiles" USING "btree" ("needs_pastoral_care");



CREATE INDEX "idx_faith_journey_maturity" ON "public"."faith_journey_profiles" USING "btree" ("spiritual_maturity");



CREATE INDEX "idx_faith_journey_user_id" ON "public"."faith_journey_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_faith_points_profiles_level" ON "public"."faith_points_profiles" USING "btree" ("current_level");



CREATE INDEX "idx_faith_points_profiles_points" ON "public"."faith_points_profiles" USING "btree" ("total_points");



CREATE INDEX "idx_faith_points_profiles_user_id" ON "public"."faith_points_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_journal_entries_content_type" ON "public"."journal_entries" USING "btree" ("content_type");



CREATE INDEX "idx_journal_entries_selected_date" ON "public"."journal_entries" USING "btree" ("selected_date");



CREATE INDEX "idx_journal_entries_user_date" ON "public"."journal_entries" USING "btree" ("user_id", "selected_date");



CREATE INDEX "idx_journal_entries_user_id" ON "public"."journal_entries" USING "btree" ("user_id");



CREATE INDEX "idx_milestones_challenge_id" ON "public"."challenge_milestones" USING "btree" ("challenge_id");



CREATE INDEX "idx_notification_logs_notification_id" ON "public"."notification_logs" USING "btree" ("notification_id");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_scheduled" ON "public"."notifications" USING "btree" ("scheduled_for") WHERE ("status" = 'PENDING'::"public"."notification_status");



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("status");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_onboarding_progress_activity" ON "public"."onboarding_progress" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_onboarding_progress_session" ON "public"."onboarding_progress" USING "btree" ("session_id");



CREATE INDEX "idx_onboarding_progress_status" ON "public"."onboarding_progress" USING "btree" ("is_completed", "is_abandoned");



CREATE INDEX "idx_onboarding_progress_user_id" ON "public"."onboarding_progress" USING "btree" ("user_id");



CREATE INDEX "idx_performance_metrics_service" ON "public"."performance_metrics" USING "btree" ("service", "operation");



CREATE INDEX "idx_performance_metrics_timestamp" ON "public"."performance_metrics" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_performance_metrics_user_id" ON "public"."performance_metrics" USING "btree" ("user_id");



CREATE INDEX "idx_personalization_style" ON "public"."onboarding_personalization_profiles" USING "btree" ("learning_style");



CREATE INDEX "idx_personalization_type" ON "public"."onboarding_personalization_profiles" USING "btree" ("personality_type");



CREATE INDEX "idx_personalization_user_id" ON "public"."onboarding_personalization_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_playbook_action_steps_example_interactive" ON "public"."playbook_action_steps" USING "btree" ("example_interactive");



CREATE INDEX "idx_playbook_sub_tasks_detected_journal_type" ON "public"."playbook_sub_tasks" USING "btree" ("detected_journal_type");



CREATE INDEX "idx_playbooks_created_at" ON "public"."playbooks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_playbooks_status" ON "public"."playbooks" USING "btree" ("status");



CREATE INDEX "idx_playbooks_user_id" ON "public"."playbooks" USING "btree" ("user_id");



CREATE INDEX "idx_playbooks_user_status" ON "public"."playbooks" USING "btree" ("user_id", "status");



CREATE INDEX "idx_prayers_journal_category" ON "public"."prayers" USING "btree" ("journal_category") WHERE ("journal_category" IS NOT NULL);



CREATE INDEX "idx_prayers_prayer_type" ON "public"."prayers" USING "btree" ("prayer_type");



CREATE INDEX "idx_prayers_selected_date" ON "public"."prayers" USING "btree" ("selected_date");



CREATE INDEX "idx_prayers_user_id" ON "public"."prayers" USING "btree" ("user_id");



CREATE INDEX "idx_progress_date" ON "public"."user_challenge_progress" USING "btree" ("activity_date");



CREATE INDEX "idx_progress_user_challenge" ON "public"."user_challenge_progress" USING "btree" ("user_challenge_id");



CREATE INDEX "idx_reflection_entries_day_number" ON "public"."reflection_entries" USING "btree" ("day_number");



CREATE INDEX "idx_reflection_entries_devotional_title" ON "public"."reflection_entries" USING "btree" ("devotional_title");



CREATE INDEX "idx_reflection_entries_playbook_id" ON "public"."reflection_entries" USING "btree" ("playbook_id");



CREATE INDEX "idx_reflection_entries_selected_date" ON "public"."reflection_entries" USING "btree" ("selected_date");



CREATE INDEX "idx_reflection_entries_source" ON "public"."reflection_entries" USING "btree" ("source");



CREATE INDEX "idx_reflection_entries_subtask_id" ON "public"."reflection_entries" USING "btree" ("subtask_id");



CREATE INDEX "idx_reflection_entries_type" ON "public"."reflection_entries" USING "btree" ("type");



CREATE INDEX "idx_reflection_entries_user_id" ON "public"."reflection_entries" USING "btree" ("user_id");



CREATE INDEX "idx_retention_events_triggered" ON "public"."retention_events" USING "btree" ("triggered_at");



CREATE INDEX "idx_retention_events_user_type" ON "public"."retention_events" USING "btree" ("user_id", "event_type");



CREATE INDEX "idx_security_events_event_type" ON "public"."security_events" USING "btree" ("event_type");



CREATE INDEX "idx_security_events_severity" ON "public"."security_events" USING "btree" ("severity");



CREATE INDEX "idx_security_events_timestamp" ON "public"."security_events" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_security_events_user_id" ON "public"."security_events" USING "btree" ("user_id");



CREATE INDEX "idx_smart_expounded_steps_action_step_id" ON "public"."smart_expounded_steps" USING "btree" ("action_step_id");



CREATE INDEX "idx_smart_financial_entries_date" ON "public"."smart_financial_entries" USING "btree" ("date" DESC);



CREATE INDEX "idx_smart_financial_entries_entry_type" ON "public"."smart_financial_entries" USING "btree" ("entry_type");



CREATE INDEX "idx_smart_financial_entries_sub_task_id" ON "public"."smart_financial_entries" USING "btree" ("sub_task_id");



CREATE INDEX "idx_smart_financial_entries_user_id" ON "public"."smart_financial_entries" USING "btree" ("user_id");



CREATE INDEX "idx_smart_journal_entries_created_at" ON "public"."smart_journal_entries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_smart_journal_entries_journal_type" ON "public"."smart_journal_entries" USING "btree" ("journal_type");



CREATE INDEX "idx_smart_journal_entries_sub_task_id" ON "public"."smart_journal_entries" USING "btree" ("sub_task_id");



CREATE INDEX "idx_smart_journal_entries_user_id" ON "public"."smart_journal_entries" USING "btree" ("user_id");



CREATE INDEX "idx_step_analytics_completion" ON "public"."onboarding_step_analytics" USING "btree" ("completion_method");



CREATE INDEX "idx_step_analytics_created" ON "public"."onboarding_step_analytics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_step_analytics_session" ON "public"."onboarding_step_analytics" USING "btree" ("session_id");



CREATE INDEX "idx_step_analytics_step" ON "public"."onboarding_step_analytics" USING "btree" ("step_name", "step_number");



CREATE INDEX "idx_step_analytics_user_id" ON "public"."onboarding_step_analytics" USING "btree" ("user_id");



CREATE INDEX "idx_step_expounding_action_step" ON "public"."step_expounding" USING "btree" ("action_step_id");



CREATE INDEX "idx_step_expounding_step_number" ON "public"."step_expounding" USING "btree" ("step_number");



CREATE INDEX "idx_step_expounding_subtask" ON "public"."step_expounding" USING "btree" ("subtask_id");



CREATE INDEX "idx_step_expounding_user" ON "public"."step_expounding" USING "btree" ("user_id");



CREATE INDEX "idx_sub_tasks_action_step_id" ON "public"."playbook_sub_tasks" USING "btree" ("action_step_id");



CREATE INDEX "idx_sub_tasks_completed" ON "public"."playbook_sub_tasks" USING "btree" ("completed");



CREATE INDEX "idx_sub_tasks_order" ON "public"."playbook_sub_tasks" USING "btree" ("action_step_id", "order_index");



CREATE INDEX "idx_system_health_metrics_timestamp" ON "public"."system_health_metrics" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_system_health_metrics_type" ON "public"."system_health_metrics" USING "btree" ("metric_type", "metric_name");



CREATE INDEX "idx_time_blocks_category" ON "public"."time_blocks" USING "btree" ("category");



CREATE INDEX "idx_time_blocks_created_at" ON "public"."time_blocks" USING "btree" ("created_at");



CREATE INDEX "idx_time_blocks_user_date" ON "public"."time_blocks" USING "btree" ("user_id", "selected_date");



CREATE INDEX "idx_time_blocks_user_date_time" ON "public"."time_blocks" USING "btree" ("user_id", "selected_date", "start_time");



CREATE INDEX "idx_user_achievements_completed" ON "public"."user_achievements" USING "btree" ("completed", "completed_at");



CREATE INDEX "idx_user_achievements_user_id" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_badge_id" ON "public"."user_badges" USING "btree" ("badge_id");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_user_id_earned" ON "public"."user_badges" USING "btree" ("user_id", "earned_at");



CREATE INDEX "idx_user_behavior_events_type" ON ONLY "public"."user_behavior_events" USING "btree" ("event_type", "created_at");



CREATE INDEX "idx_user_behavior_events_user_id" ON ONLY "public"."user_behavior_events" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_user_challenges_dates" ON "public"."user_challenges" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_user_challenges_status" ON "public"."user_challenges" USING "btree" ("status");



CREATE INDEX "idx_user_challenges_user_id" ON "public"."user_challenges" USING "btree" ("user_id");



CREATE INDEX "idx_user_contexts_confidence" ON "public"."user_contexts" USING "btree" ("confidence_score");



CREATE INDEX "idx_user_contexts_user_id" ON "public"."user_contexts" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_user_events_created_at" ON "public"."user_events" USING "btree" ("created_at");



CREATE INDEX "idx_user_events_type" ON "public"."user_events" USING "btree" ("event_type");



CREATE INDEX "idx_user_events_user_id" ON "public"."user_events" USING "btree" ("user_id");



CREATE INDEX "idx_user_intelligence_profiles_maturity" ON "public"."user_intelligence_profiles" USING "btree" ("spiritual_maturity");



CREATE INDEX "idx_user_intelligence_profiles_updated" ON "public"."user_intelligence_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_user_intelligence_profiles_user_id" ON "public"."user_intelligence_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_username" ON "public"."user_profiles" USING "btree" ("username");



CREATE INDEX "idx_user_questions_action_step" ON "public"."user_questions" USING "btree" ("action_step_id");



CREATE INDEX "idx_user_questions_created" ON "public"."user_questions" USING "btree" ("created_at");



CREATE INDEX "idx_user_questions_subtask" ON "public"."user_questions" USING "btree" ("subtask_id");



CREATE INDEX "idx_user_questions_user" ON "public"."user_questions" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_user_subscriptions_trial_end" ON "public"."user_subscriptions" USING "btree" ("trial_end_date") WHERE ("trial_end_date" IS NOT NULL);



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_31_created_at_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_31_event_category_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_31_event_type_created_at_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_31_event_type_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_31_session_id_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_31_user_id_created_at_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_31_user_id_event_type_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_31_user_id_idx" ON "public"."user_behavior_events_2025_31" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_32_created_at_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_32_event_category_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_32_event_type_created_at_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_32_event_type_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_32_session_id_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_32_user_id_created_at_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_32_user_id_event_type_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_32_user_id_idx" ON "public"."user_behavior_events_2025_32" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_33_created_at_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_33_event_category_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_33_event_type_created_at_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_33_event_type_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_33_session_id_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_33_user_id_created_at_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_33_user_id_event_type_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_33_user_id_idx" ON "public"."user_behavior_events_2025_33" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_34_created_at_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_34_event_category_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_34_event_type_created_at_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_34_event_type_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_34_session_id_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_34_user_id_created_at_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_34_user_id_event_type_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_34_user_id_idx" ON "public"."user_behavior_events_2025_34" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_35_created_at_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_35_event_category_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_35_event_type_created_at_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_35_event_type_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_35_session_id_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_35_user_id_created_at_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_35_user_id_event_type_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_35_user_id_idx" ON "public"."user_behavior_events_2025_35" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_36_created_at_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_36_event_category_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_36_event_type_created_at_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_36_event_type_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_36_session_id_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_36_user_id_created_at_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_36_user_id_event_type_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_36_user_id_idx" ON "public"."user_behavior_events_2025_36" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_37_created_at_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_37_event_category_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_37_event_type_created_at_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_37_event_type_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_37_session_id_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_37_user_id_created_at_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_37_user_id_event_type_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_37_user_id_idx" ON "public"."user_behavior_events_2025_37" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_38_created_at_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_38_event_category_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_38_event_type_created_at_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_38_event_type_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_38_session_id_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_38_user_id_created_at_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_38_user_id_event_type_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_38_user_id_idx" ON "public"."user_behavior_events_2025_38" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_39_created_at_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_39_event_category_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_39_event_type_created_at_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_39_event_type_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_39_session_id_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_39_user_id_created_at_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_39_user_id_event_type_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_39_user_id_idx" ON "public"."user_behavior_events_2025_39" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_40_created_at_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_40_event_category_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_40_event_type_created_at_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_40_event_type_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_40_session_id_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_40_user_id_created_at_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_40_user_id_event_type_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_40_user_id_idx" ON "public"."user_behavior_events_2025_40" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_41_created_at_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_41_event_category_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_41_event_type_created_at_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_41_event_type_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_41_session_id_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_41_user_id_created_at_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_41_user_id_event_type_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_41_user_id_idx" ON "public"."user_behavior_events_2025_41" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_42_created_at_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_42_event_category_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_42_event_type_created_at_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_42_event_type_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_42_session_id_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_42_user_id_created_at_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_42_user_id_event_type_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_42_user_id_idx" ON "public"."user_behavior_events_2025_42" USING "btree" ("user_id");



CREATE INDEX "user_behavior_events_2025_43_created_at_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("created_at");



CREATE INDEX "user_behavior_events_2025_43_event_category_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("event_category");



CREATE INDEX "user_behavior_events_2025_43_event_type_created_at_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("event_type", "created_at");



CREATE INDEX "user_behavior_events_2025_43_event_type_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("event_type");



CREATE INDEX "user_behavior_events_2025_43_session_id_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "user_behavior_events_2025_43_user_id_created_at_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("user_id", "created_at");



CREATE INDEX "user_behavior_events_2025_43_user_id_event_type_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("user_id", "event_type");



CREATE INDEX "user_behavior_events_2025_43_user_id_idx" ON "public"."user_behavior_events_2025_43" USING "btree" ("user_id");



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2025_08_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2025_08_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2025_08_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2025_09_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2025_09_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2025_09_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2025_10_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2025_10_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2025_10_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2025_11_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2025_11_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2025_11_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2025_12_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2025_12_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2025_12_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2026_01_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2026_01_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2026_01_user_id_created_at_idx";



ALTER INDEX "public"."idx_faith_points_transactions_category" ATTACH PARTITION "public"."faith_points_transactions_2026_02_category_created_at_idx";



ALTER INDEX "public"."faith_points_transactions_id_created_at_key" ATTACH PARTITION "public"."faith_points_transactions_2026_02_id_created_at_key";



ALTER INDEX "public"."idx_faith_points_transactions_user_id" ATTACH PARTITION "public"."faith_points_transactions_2026_02_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2025_08_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2025_08_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2025_08_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2025_08_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2025_09_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2025_09_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2025_09_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2025_09_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2025_10_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2025_10_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2025_10_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2025_10_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2025_11_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2025_11_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2025_11_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2025_11_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2025_12_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2025_12_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2025_12_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2025_12_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_01_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_01_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_01_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_01_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_02_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_02_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_02_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_02_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_03_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_03_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_03_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_03_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_04_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_04_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_04_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_04_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_05_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_05_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_05_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_05_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_06_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_06_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_06_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_06_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_07_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_07_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_07_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_07_user_id_created_at_idx";



ALTER INDEX "public"."idx_generated_content_type" ATTACH PARTITION "public"."generated_content_2026_08_content_type_created_at_idx";



ALTER INDEX "public"."generated_content_id_created_at_key" ATTACH PARTITION "public"."generated_content_2026_08_id_created_at_key";



ALTER INDEX "public"."idx_generated_content_status" ATTACH PARTITION "public"."generated_content_2026_08_status_created_at_idx";



ALTER INDEX "public"."idx_generated_content_user_id" ATTACH PARTITION "public"."generated_content_2026_08_user_id_created_at_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_05_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_05_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_05_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_05_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_05_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_05_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_05_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_05_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_06_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_06_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_06_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_06_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_06_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_06_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_06_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_06_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_07_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_07_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_07_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_07_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_07_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_07_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_07_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_07_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_08_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_08_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_08_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_08_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_08_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_08_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_08_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_08_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_09_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_09_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_09_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_09_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_09_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_09_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_09_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_09_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_10_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_10_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_10_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_10_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_10_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_10_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_10_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_10_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_11_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_11_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_11_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_11_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_11_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_11_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_11_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_11_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_12_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_12_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_12_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_12_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_12_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_12_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_12_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_12_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_13_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_13_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_13_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_13_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_13_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_13_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_13_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_13_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_14_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_14_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_14_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_14_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_14_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_14_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_14_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_14_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_15_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_15_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_15_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_15_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_15_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_15_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_15_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_15_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_16_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_16_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_16_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_16_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_16_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_16_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_16_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_16_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_17_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_17_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_17_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_17_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_17_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_17_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_17_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_17_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_18_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_18_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_18_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_18_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_18_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_18_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_18_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_18_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_19_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_19_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_19_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_19_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_19_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_19_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_19_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_19_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_20_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_20_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_20_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_20_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_20_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_20_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_20_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_20_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_21_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_21_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_21_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_21_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_21_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_21_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_21_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_21_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_22_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_22_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_22_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_22_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_22_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_22_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_22_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_22_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_23_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_23_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_23_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_23_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_23_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_23_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_23_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_23_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_24_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_24_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_24_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_24_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_24_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_24_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_24_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_24_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_25_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_25_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_25_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_25_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_25_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_25_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_25_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_25_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_26_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_26_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_26_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_26_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_26_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_26_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_26_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_26_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_27_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_27_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_27_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_27_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_27_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_27_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_27_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_27_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_28_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_28_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_28_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_28_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_28_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_28_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_28_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_28_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_29_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_29_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_29_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_29_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_29_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_29_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_29_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_29_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_30_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_30_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_30_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_30_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_30_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_30_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_30_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_30_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_08_31_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_08_31_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_08_31_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_08_31_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_08_31_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_08_31_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_08_31_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_08_31_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_09_01_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_09_01_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_09_01_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_09_01_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_09_01_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_09_01_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_09_01_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_09_01_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_09_02_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_09_02_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_09_02_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_09_02_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_09_02_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_09_02_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_09_02_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_09_02_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_09_03_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_09_03_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_09_03_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_09_03_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_09_03_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_09_03_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_09_03_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_09_03_worker_id_idx";



ALTER INDEX "public"."generation_queue_id_created_at_key" ATTACH PARTITION "public"."generation_queue_2025_09_04_id_created_at_key";



ALTER INDEX "public"."idx_generation_queue_priority" ATTACH PARTITION "public"."generation_queue_2025_09_04_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_processing" ATTACH PARTITION "public"."generation_queue_2025_09_04_status_priority_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_status" ATTACH PARTITION "public"."generation_queue_2025_09_04_status_updated_at_idx";



ALTER INDEX "public"."idx_generation_queue_type" ATTACH PARTITION "public"."generation_queue_2025_09_04_type_idx";



ALTER INDEX "public"."idx_generation_queue_user_id" ATTACH PARTITION "public"."generation_queue_2025_09_04_user_id_created_at_idx";



ALTER INDEX "public"."idx_generation_queue_user" ATTACH PARTITION "public"."generation_queue_2025_09_04_user_id_idx";



ALTER INDEX "public"."idx_generation_queue_worker" ATTACH PARTITION "public"."generation_queue_2025_09_04_worker_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_31_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_31_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_31_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_31_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_31_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_31_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_31_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_31_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_31_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_32_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_32_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_32_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_32_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_32_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_32_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_32_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_32_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_32_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_33_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_33_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_33_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_33_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_33_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_33_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_33_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_33_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_33_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_34_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_34_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_34_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_34_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_34_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_34_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_34_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_34_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_34_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_35_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_35_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_35_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_35_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_35_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_35_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_35_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_35_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_35_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_36_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_36_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_36_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_36_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_36_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_36_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_36_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_36_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_36_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_37_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_37_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_37_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_37_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_37_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_37_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_37_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_37_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_37_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_38_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_38_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_38_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_38_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_38_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_38_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_38_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_38_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_38_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_39_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_39_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_39_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_39_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_39_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_39_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_39_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_39_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_39_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_40_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_40_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_40_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_40_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_40_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_40_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_40_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_40_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_40_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_41_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_41_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_41_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_41_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_41_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_41_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_41_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_41_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_41_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_42_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_42_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_42_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_42_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_42_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_42_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_42_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_42_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_42_user_id_idx";



ALTER INDEX "public"."idx_behavior_events_created" ATTACH PARTITION "public"."user_behavior_events_2025_43_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_category" ATTACH PARTITION "public"."user_behavior_events_2025_43_event_category_idx";



ALTER INDEX "public"."idx_user_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_43_event_type_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_type" ATTACH PARTITION "public"."user_behavior_events_2025_43_event_type_idx";



ALTER INDEX "public"."user_behavior_events_id_created_at_key" ATTACH PARTITION "public"."user_behavior_events_2025_43_id_created_at_key";



ALTER INDEX "public"."idx_behavior_events_session" ATTACH PARTITION "public"."user_behavior_events_2025_43_session_id_idx";



ALTER INDEX "public"."idx_user_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_43_user_id_created_at_idx";



ALTER INDEX "public"."idx_behavior_events_user_type" ATTACH PARTITION "public"."user_behavior_events_2025_43_user_id_event_type_idx";



ALTER INDEX "public"."idx_behavior_events_user_id" ATTACH PARTITION "public"."user_behavior_events_2025_43_user_id_idx";



CREATE OR REPLACE VIEW "public"."active_user_challenges" WITH ("security_invoker"='true') AS
 SELECT "uc"."id",
    "uc"."user_id",
    "uc"."challenge_id",
    "uc"."status",
    "uc"."start_date",
    "uc"."end_date",
    "uc"."completion_percentage",
    "uc"."current_streak",
    "uc"."longest_streak",
    "uc"."activities_completed",
    "uc"."total_activities",
    "uc"."points_earned",
    "uc"."created_at",
    "uc"."updated_at",
        CASE
            WHEN (("uc"."status" = 'active'::"public"."challenge_status") AND ("uc"."end_date" < CURRENT_DATE)) THEN 'expired'::"text"
            WHEN (("uc"."status" = 'active'::"public"."challenge_status") AND ("uc"."completion_percentage" >= (100)::numeric)) THEN 'completed'::"text"
            ELSE ("uc"."status")::"text"
        END AS "computed_status",
    "c"."title" AS "challenge_title",
    "c"."description" AS "challenge_description",
    "c"."challenge_text",
    "c"."duration_type",
    "c"."duration_days",
    "c"."category",
    "c"."difficulty",
    "c"."base_points",
    COALESCE("json_agg"("json_build_object"('id', "ca"."id", 'title', "ca"."title", 'description', "ca"."description", 'activity_type', "ca"."activity_type", 'journal_component', "ca"."journal_component", 'target_value', "ca"."target_value", 'points_value', "ca"."points_value", 'is_required', "ca"."is_required", 'order_index', "ca"."order_index") ORDER BY "ca"."order_index") FILTER (WHERE ("ca"."id" IS NOT NULL)), '[]'::"json") AS "activities"
   FROM (("public"."user_challenges" "uc"
     JOIN "public"."challenges" "c" ON (("uc"."challenge_id" = "c"."id")))
     LEFT JOIN "public"."challenge_activities" "ca" ON (("c"."id" = "ca"."challenge_id")))
  WHERE ("uc"."status" = 'active'::"public"."challenge_status")
  GROUP BY "uc"."id", "c"."id";



CREATE OR REPLACE TRIGGER "time_blocks_updated_at_trigger" BEFORE UPDATE ON "public"."time_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."update_time_blocks_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_devotionals_updated_at" BEFORE UPDATE ON "public"."devotionals" FOR EACH ROW EXECUTE FUNCTION "public"."update_devotionals_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_playbook_status_action_steps" AFTER UPDATE OF "completed" ON "public"."playbook_action_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_playbook_status"();



CREATE OR REPLACE TRIGGER "trigger_update_playbook_status_affirmations" AFTER UPDATE OF "completed" ON "public"."playbook_affirmations" FOR EACH ROW EXECUTE FUNCTION "public"."update_playbook_status"();



CREATE OR REPLACE TRIGGER "trigger_update_playbook_status_sub_tasks" AFTER UPDATE OF "completed" ON "public"."playbook_sub_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_playbook_status"();



CREATE OR REPLACE TRIGGER "update_action_steps_updated_at" BEFORE UPDATE ON "public"."playbook_action_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_affirmations_updated_at" BEFORE UPDATE ON "public"."playbook_affirmations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_challenges_updated_at" BEFORE UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_content_library_updated_at" BEFORE UPDATE ON "public"."content_library" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_logs_updated_at" BEFORE UPDATE ON "public"."notification_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_playbooks_updated_at" BEFORE UPDATE ON "public"."playbooks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_prayers_updated_at" BEFORE UPDATE ON "public"."prayers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reflection_entries_updated_at" BEFORE UPDATE ON "public"."reflection_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_smart_expounded_steps_updated_at" BEFORE UPDATE ON "public"."smart_expounded_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_smart_financial_entries_updated_at" BEFORE UPDATE ON "public"."smart_financial_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_smart_journal_entries_updated_at" BEFORE UPDATE ON "public"."smart_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sub_tasks_updated_at" BEFORE UPDATE ON "public"."playbook_sub_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_challenge_stats_trigger" AFTER INSERT OR UPDATE ON "public"."user_challenge_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_challenge_stats"();



CREATE OR REPLACE TRIGGER "update_user_challenges_updated_at" BEFORE UPDATE ON "public"."user_challenges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_sessions_updated_at" BEFORE UPDATE ON "public"."user_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ab_test_assignments"
    ADD CONSTRAINT "ab_test_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_logs"
    ADD CONSTRAINT "application_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_trail"
    ADD CONSTRAINT "audit_trail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_activities"
    ADD CONSTRAINT "challenge_activities_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_analytics"
    ADD CONSTRAINT "challenge_analytics_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."challenge_milestones"
    ADD CONSTRAINT "challenge_milestones_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."christ_acceptance_events"
    ADD CONSTRAINT "christ_acceptance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_effectiveness"
    ADD CONSTRAINT "content_effectiveness_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devotionals"
    ADD CONSTRAINT "devotionals_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devotionals"
    ADD CONSTRAINT "devotionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expounding_content_legacy"
    ADD CONSTRAINT "expounding_content_legacy_action_step_id_fkey" FOREIGN KEY ("action_step_id") REFERENCES "public"."playbook_action_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expounding_content_legacy"
    ADD CONSTRAINT "expounding_content_legacy_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "public"."playbook_sub_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expounding_content_legacy"
    ADD CONSTRAINT "expounding_content_legacy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faith_journey_profiles"
    ADD CONSTRAINT "faith_journey_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faith_points_profiles"
    ADD CONSTRAINT "faith_points_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."faith_points_transactions"
    ADD CONSTRAINT "faith_points_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."generated_content"
    ADD CONSTRAINT "generated_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."generation_queue"
    ADD CONSTRAINT "generation_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_personalization_profiles"
    ADD CONSTRAINT "onboarding_personalization_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_step_analytics"
    ADD CONSTRAINT "onboarding_step_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playbook_action_steps"
    ADD CONSTRAINT "playbook_action_steps_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playbook_affirmations"
    ADD CONSTRAINT "playbook_affirmations_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playbook_sub_tasks"
    ADD CONSTRAINT "playbook_sub_tasks_action_step_id_fkey" FOREIGN KEY ("action_step_id") REFERENCES "public"."playbook_action_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playbooks"
    ADD CONSTRAINT "playbooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reflection_entries"
    ADD CONSTRAINT "reflection_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."retention_events"
    ADD CONSTRAINT "retention_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."smart_expounded_steps"
    ADD CONSTRAINT "smart_expounded_steps_action_step_id_fkey" FOREIGN KEY ("action_step_id") REFERENCES "public"."playbook_action_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_financial_entries"
    ADD CONSTRAINT "smart_financial_entries_sub_task_id_fkey" FOREIGN KEY ("sub_task_id") REFERENCES "public"."playbook_sub_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_journal_entries"
    ADD CONSTRAINT "smart_journal_entries_sub_task_id_fkey" FOREIGN KEY ("sub_task_id") REFERENCES "public"."playbook_sub_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_expounding"
    ADD CONSTRAINT "step_expounding_action_step_id_fkey" FOREIGN KEY ("action_step_id") REFERENCES "public"."playbook_action_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_expounding"
    ADD CONSTRAINT "step_expounding_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "public"."playbook_sub_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_expounding"
    ADD CONSTRAINT "step_expounding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."user_behavior_events"
    ADD CONSTRAINT "user_behavior_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenge_progress"
    ADD CONSTRAINT "user_challenge_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."challenge_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_challenge_progress"
    ADD CONSTRAINT "user_challenge_progress_user_challenge_id_fkey" FOREIGN KEY ("user_challenge_id") REFERENCES "public"."user_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_contexts"
    ADD CONSTRAINT "user_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_intelligence_profiles"
    ADD CONSTRAINT "user_intelligence_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_questions"
    ADD CONSTRAINT "user_questions_action_step_id_fkey" FOREIGN KEY ("action_step_id") REFERENCES "public"."playbook_action_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_questions"
    ADD CONSTRAINT "user_questions_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "public"."playbook_sub_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_questions"
    ADD CONSTRAINT "user_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_family_owner_id_fkey" FOREIGN KEY ("family_owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_tokens"
    ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view active challenges" ON "public"."challenges" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view badge definitions" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "Anyone can view challenge activities" ON "public"."challenge_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_activities"."challenge_id") AND ("c"."is_active" = true)))));



CREATE POLICY "Anyone can view growth level definitions" ON "public"."growth_levels" FOR SELECT USING (true);



CREATE POLICY "Anyone can view milestones" ON "public"."challenge_milestones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_milestones"."challenge_id") AND ("c"."is_active" = true)))));



CREATE POLICY "Anyone can view smart expounded steps" ON "public"."smart_expounded_steps" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create challenges" ON "public"."challenges" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."schema_version" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users only" ON "public"."prayers_backup" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Everyone can view templates" ON "public"."journal_templates" FOR SELECT USING (true);



CREATE POLICY "Service accounts can insert application logs" ON "public"."application_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service accounts can insert audit trail" ON "public"."audit_trail" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service accounts can insert performance metrics" ON "public"."performance_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service accounts can insert security events" ON "public"."security_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service accounts can insert system health metrics" ON "public"."system_health_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can manage all profiles" ON "public"."faith_points_profiles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage profiles" ON "public"."faith_points_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage smart expounded steps" ON "public"."smart_expounded_steps" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage transactions" ON "public"."faith_points_log" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete action steps of their playbooks" ON "public"."playbook_action_steps" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_action_steps"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete affirmations of their playbooks" ON "public"."playbook_affirmations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_affirmations"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own devotionals" ON "public"."devotionals" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own journal entries" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own prayers" ON "public"."prayers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete sub-tasks of their action steps" ON "public"."playbook_sub_tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."playbook_action_steps" "pas"
     JOIN "public"."playbooks" "p" ON (("p"."id" = "pas"."playbook_id")))
  WHERE (("pas"."id" = "playbook_sub_tasks"."action_step_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own devotionals" ON "public"."devotionals" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own journal entries" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own playbooks" ON "public"."playbooks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own prayers" ON "public"."prayers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reflection entries" ON "public"."reflection_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own smart financial entries" ON "public"."smart_financial_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own smart journal entries" ON "public"."smart_journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own time blocks" ON "public"."time_blocks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert action steps to their playbooks" ON "public"."playbook_action_steps" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_action_steps"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert affirmations to their playbooks" ON "public"."playbook_affirmations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_affirmations"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own acceptance events" ON "public"."christ_acceptance_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own analytics" ON "public"."onboarding_step_analytics" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own behavior events" ON "public"."user_behavior_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own devotionals" ON "public"."devotionals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own events" ON "public"."user_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own faith journey" ON "public"."faith_journey_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own journal entries" ON "public"."journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own onboarding progress" ON "public"."onboarding_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own personalization profile" ON "public"."onboarding_personalization_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own prayers" ON "public"."prayers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own queue items" ON "public"."generation_queue" FOR INSERT TO "authenticated" WITH CHECK ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can insert own retention events" ON "public"."retention_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own test assignments" ON "public"."ab_test_assignments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert sub-tasks to their action steps" ON "public"."playbook_sub_tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."playbook_action_steps" "pas"
     JOIN "public"."playbooks" "p" ON (("p"."id" = "pas"."playbook_id")))
  WHERE (("pas"."id" = "playbook_sub_tasks"."action_step_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own analytics" ON "public"."challenge_analytics" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own challenges" ON "public"."user_challenges" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own devotionals" ON "public"."devotionals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own expounding content" ON "public"."expounding_content_legacy" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own journal entries" ON "public"."journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own playbooks" ON "public"."playbooks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own prayers" ON "public"."prayers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."faith_points_profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own progress" ON "public"."user_challenge_progress" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_challenges" "uc"
  WHERE (("uc"."id" = "user_challenge_progress"."user_challenge_id") AND ("uc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own questions" ON "public"."user_questions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own reflection entries" ON "public"."reflection_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own smart financial entries" ON "public"."smart_financial_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own smart journal entries" ON "public"."smart_journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own step expounding" ON "public"."step_expounding" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own subscription" ON "public"."user_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own time blocks" ON "public"."time_blocks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own transactions" ON "public"."faith_points_log" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own content" ON "public"."content_library" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own notification preferences" ON "public"."notification_preferences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own sessions" ON "public"."user_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update action steps of their playbooks" ON "public"."playbook_action_steps" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_action_steps"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update affirmations of their playbooks" ON "public"."playbook_affirmations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_affirmations"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own context" ON "public"."user_contexts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own devotionals" ON "public"."devotionals" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own faith journey" ON "public"."faith_journey_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own intelligence profile" ON "public"."user_intelligence_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own journal entries" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own onboarding progress" ON "public"."onboarding_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own personalization profile" ON "public"."onboarding_personalization_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own prayers" ON "public"."prayers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own queue items" ON "public"."generation_queue" FOR UPDATE TO "authenticated" USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can update own subscription" ON "public"."user_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update sub-tasks of their action steps" ON "public"."playbook_sub_tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."playbook_action_steps" "pas"
     JOIN "public"."playbooks" "p" ON (("p"."id" = "pas"."playbook_id")))
  WHERE (("pas"."id" = "playbook_sub_tasks"."action_step_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own challenges" ON "public"."user_challenges" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own devotionals" ON "public"."devotionals" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own expounding content" ON "public"."expounding_content_legacy" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own journal entries" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own playbooks" ON "public"."playbooks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own prayers" ON "public"."prayers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."faith_points_profiles" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own progress" ON "public"."user_challenge_progress" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_challenges" "uc"
  WHERE (("uc"."id" = "user_challenge_progress"."user_challenge_id") AND ("uc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own questions" ON "public"."user_questions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reflection entries" ON "public"."reflection_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own smart financial entries" ON "public"."smart_financial_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own smart journal entries" ON "public"."smart_journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own step expounding" ON "public"."step_expounding" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own subscription" ON "public"."user_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own time blocks" ON "public"."time_blocks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view action steps of their playbooks" ON "public"."playbook_action_steps" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_action_steps"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view affirmations of their playbooks" ON "public"."playbook_affirmations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."playbooks"
  WHERE (("playbooks"."id" = "playbook_affirmations"."playbook_id") AND ("playbooks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view expounding content" ON "public"."expounding_content" FOR SELECT USING (true);



CREATE POLICY "Users can view own acceptance events" ON "public"."christ_acceptance_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own achievements" ON "public"."user_achievements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own behavior events" ON "public"."user_behavior_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own content" ON "public"."generated_content" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own content effectiveness" ON "public"."content_effectiveness" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own context" ON "public"."user_contexts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own devotionals" ON "public"."devotionals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own events" ON "public"."user_behavior_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own events" ON "public"."user_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own faith journey" ON "public"."faith_journey_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own faith points" ON "public"."faith_points_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own intelligence profile" ON "public"."user_intelligence_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own journal entries" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own onboarding progress" ON "public"."onboarding_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own personalization profile" ON "public"."onboarding_personalization_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own prayers" ON "public"."prayers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own queue items" ON "public"."generation_queue" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own retention events" ON "public"."retention_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own test assignments" ON "public"."ab_test_assignments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."faith_points_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view sub-tasks of their action steps" ON "public"."playbook_sub_tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."playbook_action_steps" "pas"
     JOIN "public"."playbooks" "p" ON (("p"."id" = "pas"."playbook_id")))
  WHERE (("pas"."id" = "playbook_sub_tasks"."action_step_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own analytics" ON "public"."challenge_analytics" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own application logs" ON "public"."application_logs" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view their own audit trail" ON "public"."audit_trail" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own auth logs" ON "public"."auth_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own badges" ON "public"."user_badges" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own challenges" ON "public"."user_challenges" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own devotionals" ON "public"."devotionals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own expounding content" ON "public"."expounding_content_legacy" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own journal entries" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notification logs" ON "public"."notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own performance metrics" ON "public"."performance_metrics" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view their own playbooks" ON "public"."playbooks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own prayers" ON "public"."prayers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own progress" ON "public"."user_challenge_progress" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_challenges" "uc"
  WHERE (("uc"."id" = "user_challenge_progress"."user_challenge_id") AND ("uc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own questions" ON "public"."user_questions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reflection entries" ON "public"."reflection_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own security events" ON "public"."security_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own smart financial entries" ON "public"."smart_financial_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own smart journal entries" ON "public"."smart_journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own step expounding" ON "public"."step_expounding" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("is_public" = true)));



CREATE POLICY "Users can view their own subscription" ON "public"."user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own time blocks" ON "public"."time_blocks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."faith_points_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ab_test_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_trail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."christ_acceptance_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_effectiveness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_classification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devotionals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expounding_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expounding_content_legacy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_journey_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2025_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2026_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faith_points_transactions_2026_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2025_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_content_2026_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_13" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_14" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_15" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_16" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_17" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_18" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_19" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_20" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_21" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_22" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_23" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_24" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_25" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_26" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_27" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_28" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_29" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_30" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_08_31" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_09_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_09_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_09_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_queue_2025_09_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."growth_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_content_effectiveness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_personalization_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_step_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playbook_action_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playbook_affirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playbook_sub_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playbooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayers_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reflection_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retention_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_version" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_expounded_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_financial_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."step_expounding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_health_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_31" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_32" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_33" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_34" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_35" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_36" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_37" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_38" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_39" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_40" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_41" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_42" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_behavior_events_2025_43" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_challenge_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_intelligence_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_tokens" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."award_faith_points"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_activity_description" "text", "p_reference_id" "uuid", "p_reference_type" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."award_faith_points"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_activity_description" "text", "p_reference_id" "uuid", "p_reference_type" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_faith_points"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_activity_description" "text", "p_reference_id" "uuid", "p_reference_type" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_devotional_progress"("devotional_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_devotional_progress"("devotional_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_devotional_progress"("devotional_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_onboarding_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_onboarding_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_onboarding_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_playbook_progress"("playbook_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_playbook_progress"("playbook_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_playbook_progress"("playbook_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_retention_risk"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_retention_risk"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_retention_risk"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_badge_achievements"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_badge_achievements"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_badge_achievements"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_daily_goals_completion"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_daily_goals_completion"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_daily_goals_completion"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_overlapping_blocks"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_overlapping_blocks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_overlapping_blocks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_trial_expirations"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_trial_expirations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_trial_expirations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_partitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_user_profile"("p_user_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_user_profile"("p_user_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_user_profile"("p_user_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_devotional_from_playbook"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_duration" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_devotional_from_playbook"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_duration" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_devotional_from_playbook"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_duration" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_free_trial_subscription"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_free_trial_subscription"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_free_trial_subscription"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_monthly_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_monthly_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_monthly_partitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enable_rls_on_all_tables"() TO "anon";
GRANT ALL ON FUNCTION "public"."enable_rls_on_all_tables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enable_rls_on_all_tables"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("date_range_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("date_range_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("date_range_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feature_analytics"("feature_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feature_analytics"("feature_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feature_analytics"("feature_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_metrics"("timeframe_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_metrics"("timeframe_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_metrics"("timeframe_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_security_metrics"("timeframe_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_security_metrics"("timeframe_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_security_metrics"("timeframe_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_subscription_analytics"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_subscription_analytics"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_subscription_analytics"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_usage_counter"("p_user_id" "uuid", "p_period" "text", "p_type" "text", "p_tokens_used" integer, "p_cost_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_usage_counter"("p_user_id" "uuid", "p_period" "text", "p_type" "text", "p_tokens_used" integer, "p_cost_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_usage_counter"("p_user_id" "uuid", "p_period" "text", "p_type" "text", "p_tokens_used" integer, "p_cost_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_usage_tracking"("target_user_id" "uuid", "target_period" "text", "field_name" "text", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_usage_tracking"("target_user_id" "uuid", "target_period" "text", "field_name" "text", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_usage_tracking"("target_user_id" "uuid", "target_period" "text", "field_name" "text", "increment_by" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_onboarding"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_onboarding"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_onboarding"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_devotional_day_complete"("p_devotional_id" "uuid", "p_day_number" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_devotional_day_complete"("p_devotional_id" "uuid", "p_day_number" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_devotional_day_complete"("p_devotional_id" "uuid", "p_day_number" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_pending_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_pending_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_pending_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "public"."notification_type", "p_channels" "public"."notification_channel"[], "p_data" "jsonb", "p_image_url" "text", "p_action_url" "text", "p_scheduled_for" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "public"."notification_type", "p_channels" "public"."notification_channel"[], "p_data" "jsonb", "p_image_url" "text", "p_action_url" "text", "p_scheduled_for" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "public"."notification_type", "p_channels" "public"."notification_channel"[], "p_data" "jsonb", "p_image_url" "text", "p_action_url" "text", "p_scheduled_for" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_christ_acceptance"("p_user_id" "uuid", "p_acceptance_context" "public"."acceptance_context", "p_influenced_by" "text", "p_content_id" "uuid", "p_prayer_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_christ_acceptance"("p_user_id" "uuid", "p_acceptance_context" "public"."acceptance_context", "p_influenced_by" "text", "p_content_id" "uuid", "p_prayer_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_christ_acceptance"("p_user_id" "uuid", "p_acceptance_context" "public"."acceptance_context", "p_influenced_by" "text", "p_content_id" "uuid", "p_prayer_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_daily_win"("p_user_id" "uuid", "p_entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_daily_win"("p_user_id" "uuid", "p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_daily_win"("p_user_id" "uuid", "p_entry_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_was_prayed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_was_prayed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_was_prayed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_day_number" integer, "p_was_prayed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_day_number" integer, "p_was_prayed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_devotional_completion"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_day_number" integer, "p_was_prayed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_devotional_creation"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_total_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_devotional_creation"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_total_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_devotional_creation"("p_user_id" "uuid", "p_devotional_id" "uuid", "p_total_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_financial_activity"("p_user_id" "uuid", "p_activity_id" "uuid", "p_activity_type" "text", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_financial_activity"("p_user_id" "uuid", "p_activity_id" "uuid", "p_activity_type" "text", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_financial_activity"("p_user_id" "uuid", "p_activity_id" "uuid", "p_activity_type" "text", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_goal_completion"("p_user_id" "uuid", "p_goal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_goal_completion"("p_user_id" "uuid", "p_goal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_goal_completion"("p_user_id" "uuid", "p_goal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_gratitude_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_gratitude_items_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_gratitude_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_gratitude_items_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_gratitude_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_gratitude_items_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_journal_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_word_count" integer, "p_has_pondered_question" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_journal_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_word_count" integer, "p_has_pondered_question" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_journal_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_word_count" integer, "p_has_pondered_question" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_looking_forward_entry"("p_user_id" "uuid", "p_entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_looking_forward_entry"("p_user_id" "uuid", "p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_looking_forward_entry"("p_user_id" "uuid", "p_entry_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_playbook_creation"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_playbook_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_playbook_creation"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_playbook_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_playbook_creation"("p_user_id" "uuid", "p_playbook_id" "uuid", "p_playbook_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_prayer_activity"("p_user_id" "uuid", "p_prayer_id" "uuid", "p_activity_type" "text", "p_person_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_prayer_activity"("p_user_id" "uuid", "p_prayer_id" "uuid", "p_activity_type" "text", "p_person_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_prayer_activity"("p_user_id" "uuid", "p_prayer_id" "uuid", "p_activity_type" "text", "p_person_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_priority_completion"("p_user_id" "uuid", "p_priority_id" "uuid", "p_is_daily_priority" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_priority_completion"("p_user_id" "uuid", "p_priority_id" "uuid", "p_is_daily_priority" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_priority_completion"("p_user_id" "uuid", "p_priority_id" "uuid", "p_is_daily_priority" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_todo_completion"("p_user_id" "uuid", "p_todo_id" "uuid", "p_is_daily_todo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_todo_completion"("p_user_id" "uuid", "p_todo_id" "uuid", "p_is_daily_todo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_todo_completion"("p_user_id" "uuid", "p_todo_id" "uuid", "p_is_daily_todo" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_streak"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_streak"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_streak"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_devotionals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_devotionals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_devotionals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_intelligence_profile_from_behavior"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_intelligence_profile_from_behavior"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_intelligence_profile_from_behavior"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_journal_entries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_journal_entries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_journal_entries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_journal_entry_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_journal_entry_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_journal_entry_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_onboarding_progress"("p_user_id" "uuid", "p_step_name" "text", "p_step_number" integer, "p_completion_method" "public"."onboarding_step_status", "p_time_spent" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_onboarding_progress"("p_user_id" "uuid", "p_step_name" "text", "p_step_number" integer, "p_completion_method" "public"."onboarding_step_status", "p_time_spent" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_onboarding_progress"("p_user_id" "uuid", "p_step_name" "text", "p_step_number" integer, "p_completion_method" "public"."onboarding_step_status", "p_time_spent" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_playbook_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_playbook_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_playbook_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_playbook_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_playbook_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_playbook_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_prayers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_prayers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_prayers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reflection_entries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_reflection_entries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reflection_entries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_time_blocks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_time_blocks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_time_blocks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_challenge_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_challenge_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_challenge_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_stats"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer, "p_additional_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_stats"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer, "p_additional_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_stats"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer, "p_additional_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_journal_entry"("p_id" "uuid", "p_user_id" "uuid", "p_content_type" "text", "p_content" "jsonb", "p_selected_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_journal_entry"("p_id" "uuid", "p_user_id" "uuid", "p_content_type" "text", "p_content" "jsonb", "p_selected_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_journal_entry"("p_id" "uuid", "p_user_id" "uuid", "p_content_type" "text", "p_content" "jsonb", "p_selected_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."ab_test_assignments" TO "anon";
GRANT ALL ON TABLE "public"."ab_test_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."ab_test_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."active_user_challenges" TO "anon";
GRANT ALL ON TABLE "public"."active_user_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."active_user_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."application_logs" TO "anon";
GRANT ALL ON TABLE "public"."application_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."application_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_trail" TO "anon";
GRANT ALL ON TABLE "public"."audit_trail" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_trail" TO "service_role";



GRANT ALL ON TABLE "public"."auth_logs" TO "anon";
GRANT ALL ON TABLE "public"."auth_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_logs" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_activities" TO "anon";
GRANT ALL ON TABLE "public"."challenge_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_activities" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_analytics" TO "anon";
GRANT ALL ON TABLE "public"."challenge_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_milestones" TO "anon";
GRANT ALL ON TABLE "public"."challenge_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."christ_acceptance_events" TO "anon";
GRANT ALL ON TABLE "public"."christ_acceptance_events" TO "authenticated";
GRANT ALL ON TABLE "public"."christ_acceptance_events" TO "service_role";



GRANT ALL ON TABLE "public"."content_effectiveness" TO "anon";
GRANT ALL ON TABLE "public"."content_effectiveness" TO "authenticated";
GRANT ALL ON TABLE "public"."content_effectiveness" TO "service_role";



GRANT ALL ON TABLE "public"."content_library" TO "anon";
GRANT ALL ON TABLE "public"."content_library" TO "authenticated";
GRANT ALL ON TABLE "public"."content_library" TO "service_role";



GRANT ALL ON TABLE "public"."data_classification" TO "anon";
GRANT ALL ON TABLE "public"."data_classification" TO "authenticated";
GRANT ALL ON TABLE "public"."data_classification" TO "service_role";



GRANT ALL ON TABLE "public"."devotionals" TO "anon";
GRANT ALL ON TABLE "public"."devotionals" TO "authenticated";
GRANT ALL ON TABLE "public"."devotionals" TO "service_role";



GRANT ALL ON TABLE "public"."expounding_content" TO "anon";
GRANT ALL ON TABLE "public"."expounding_content" TO "authenticated";
GRANT ALL ON TABLE "public"."expounding_content" TO "service_role";



GRANT ALL ON TABLE "public"."expounding_content_legacy" TO "anon";
GRANT ALL ON TABLE "public"."expounding_content_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."expounding_content_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."faith_journey_profiles" TO "anon";
GRANT ALL ON TABLE "public"."faith_journey_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_journey_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_profiles" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_log" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_log" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_log" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2025_08" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_08" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_08" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2025_09" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_09" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_09" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."faith_points_transactions_2026_02" TO "anon";
GRANT ALL ON TABLE "public"."faith_points_transactions_2026_02" TO "authenticated";
GRANT ALL ON TABLE "public"."faith_points_transactions_2026_02" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content" TO "anon";
GRANT ALL ON TABLE "public"."generated_content" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2025_08" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2025_08" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2025_08" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2025_09" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2025_09" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2025_09" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_02" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_02" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_02" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_03" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_03" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_03" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_04" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_04" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_04" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_05" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_05" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_05" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_06" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_06" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_06" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_07" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_07" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_07" TO "service_role";



GRANT ALL ON TABLE "public"."generated_content_2026_08" TO "anon";
GRANT ALL ON TABLE "public"."generated_content_2026_08" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_content_2026_08" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_05" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_05" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_05" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_06" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_06" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_06" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_07" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_07" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_07" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_08" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_08" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_08" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_09" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_09" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_09" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_10" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_10" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_10" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_11" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_11" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_11" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_12" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_12" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_12" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_13" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_13" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_13" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_14" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_14" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_14" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_15" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_15" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_15" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_16" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_16" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_16" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_17" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_17" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_17" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_18" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_18" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_18" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_19" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_19" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_19" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_20" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_20" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_20" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_21" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_21" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_21" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_22" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_22" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_22" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_23" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_23" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_23" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_24" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_24" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_24" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_25" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_25" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_25" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_26" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_26" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_26" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_27" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_27" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_27" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_28" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_28" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_28" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_29" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_29" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_29" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_30" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_30" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_30" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_08_31" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_31" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_08_31" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_09_01" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_01" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_01" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_09_02" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_02" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_02" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_09_03" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_03" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_03" TO "service_role";



GRANT ALL ON TABLE "public"."generation_queue_2025_09_04" TO "anon";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_04" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_queue_2025_09_04" TO "service_role";



GRANT ALL ON TABLE "public"."growth_levels" TO "anon";
GRANT ALL ON TABLE "public"."growth_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."growth_levels" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."journal_templates" TO "anon";
GRANT ALL ON TABLE "public"."journal_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_templates" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_content_effectiveness" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_content_effectiveness" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_content_effectiveness" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_personalization_profiles" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_personalization_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_personalization_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_progress" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_step_analytics" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_step_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_step_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."playbook_action_steps" TO "anon";
GRANT ALL ON TABLE "public"."playbook_action_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."playbook_action_steps" TO "service_role";



GRANT ALL ON TABLE "public"."playbook_affirmations" TO "anon";
GRANT ALL ON TABLE "public"."playbook_affirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."playbook_affirmations" TO "service_role";



GRANT ALL ON TABLE "public"."playbook_sub_tasks" TO "anon";
GRANT ALL ON TABLE "public"."playbook_sub_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."playbook_sub_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."playbooks" TO "anon";
GRANT ALL ON TABLE "public"."playbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."playbooks" TO "service_role";



GRANT ALL ON TABLE "public"."playbooks_with_progress" TO "anon";
GRANT ALL ON TABLE "public"."playbooks_with_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."playbooks_with_progress" TO "service_role";



GRANT ALL ON TABLE "public"."prayers" TO "anon";
GRANT ALL ON TABLE "public"."prayers" TO "authenticated";
GRANT ALL ON TABLE "public"."prayers" TO "service_role";



GRANT ALL ON TABLE "public"."prayers_backup" TO "anon";
GRANT ALL ON TABLE "public"."prayers_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."prayers_backup" TO "service_role";



GRANT ALL ON TABLE "public"."queue_performance" TO "anon";
GRANT ALL ON TABLE "public"."queue_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."queue_performance" TO "service_role";



GRANT ALL ON TABLE "public"."reflection_entries" TO "anon";
GRANT ALL ON TABLE "public"."reflection_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."reflection_entries" TO "service_role";



GRANT ALL ON TABLE "public"."retention_events" TO "anon";
GRANT ALL ON TABLE "public"."retention_events" TO "authenticated";
GRANT ALL ON TABLE "public"."retention_events" TO "service_role";



GRANT ALL ON TABLE "public"."schema_version" TO "anon";
GRANT ALL ON TABLE "public"."schema_version" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_version" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."smart_expounded_steps" TO "anon";
GRANT ALL ON TABLE "public"."smart_expounded_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_expounded_steps" TO "service_role";



GRANT ALL ON TABLE "public"."smart_financial_entries" TO "anon";
GRANT ALL ON TABLE "public"."smart_financial_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_financial_entries" TO "service_role";



GRANT ALL ON TABLE "public"."smart_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."smart_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."step_expounding" TO "anon";
GRANT ALL ON TABLE "public"."step_expounding" TO "authenticated";
GRANT ALL ON TABLE "public"."step_expounding" TO "service_role";



GRANT ALL ON TABLE "public"."system_health_metrics" TO "anon";
GRANT ALL ON TABLE "public"."system_health_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."time_blocks" TO "anon";
GRANT ALL ON TABLE "public"."time_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."time_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_31" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_31" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_31" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_32" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_32" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_32" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_33" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_33" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_33" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_34" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_34" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_34" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_35" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_35" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_35" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_36" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_36" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_36" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_37" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_37" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_37" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_38" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_38" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_38" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_39" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_39" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_39" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_40" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_40" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_40" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_41" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_41" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_41" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_42" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_42" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_42" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavior_events_2025_43" TO "anon";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_43" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavior_events_2025_43" TO "service_role";



GRANT ALL ON TABLE "public"."user_challenge_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_challenge_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_challenge_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_challenges" TO "anon";
GRANT ALL ON TABLE "public"."user_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."user_challenge_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_challenge_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_challenge_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_contexts" TO "anon";
GRANT ALL ON TABLE "public"."user_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."user_engagement_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_engagement_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_engagement_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_events" TO "anon";
GRANT ALL ON TABLE "public"."user_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_intelligence_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_intelligence_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_intelligence_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_questions" TO "anon";
GRANT ALL ON TABLE "public"."user_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_questions" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_tokens" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
