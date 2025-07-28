-- Database Triggers for Automatic FaithPoints Awards
-- This makes the FaithPoints system work automatically without app changes

-- ========================================
-- TRIGGER 1: Award points when devotional is created
-- ========================================

CREATE OR REPLACE FUNCTION trigger_devotional_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points for creating a devotional
  PERFORM record_devotional_creation(
    NEW.user_id,
    NEW.id,
    NEW.total_days
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for devotional creation
DROP TRIGGER IF EXISTS devotional_created_trigger ON devotionals;
CREATE TRIGGER devotional_created_trigger
  AFTER INSERT ON devotionals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_devotional_created();

-- ========================================
-- TRIGGER 2: Award points when playbook is created
-- ========================================

CREATE OR REPLACE FUNCTION trigger_playbook_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points for creating a playbook
  PERFORM record_playbook_creation(
    NEW.user_id,
    NEW.id,
    COALESCE(NEW.title, 'Playbook')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for playbook creation (if playbooks table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playbooks') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS playbook_created_trigger ON playbooks';
        EXECUTE 'CREATE TRIGGER playbook_created_trigger
                  AFTER INSERT ON playbooks
                  FOR EACH ROW
                  EXECUTE FUNCTION trigger_playbook_created()';
    END IF;
END $$;

-- ========================================
-- TRIGGER 3: Award points when devotional day is completed
-- ========================================

CREATE OR REPLACE FUNCTION trigger_devotional_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only award points if completed status changed from false to true
  IF OLD.completed = FALSE AND NEW.completed = TRUE THEN
    PERFORM record_devotional_completion(
      NEW.user_id,
      NEW.id,
      NEW.current_day,
      FALSE  -- We don't track prayer status in this trigger
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for devotional completion
DROP TRIGGER IF EXISTS devotional_completed_trigger ON devotionals;
CREATE TRIGGER devotional_completed_trigger
  AFTER UPDATE ON devotionals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_devotional_completed();

-- ========================================
-- TRIGGER 4: Award points for prayer activities
-- ========================================

CREATE OR REPLACE FUNCTION trigger_prayer_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points for creating prayers
  CASE NEW.prayer_type
    WHEN 'devotional' THEN
      PERFORM award_faith_points(
        NEW.user_id,
        15,
        'devotional_prayer',
        'Created devotional prayer',
        NEW.id,
        'prayer'
      );
    WHEN 'people' THEN
      PERFORM award_faith_points(
        NEW.user_id,
        10,
        'people_prayer',
        'Prayed for someone',
        NEW.id,
        'prayer'
      );
    ELSE
      PERFORM award_faith_points(
        NEW.user_id,
        8,
        'journal_prayer',
        format('Created %s prayer', NEW.journal_category),
        NEW.id,
        'prayer'
      );
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for prayer creation
DROP TRIGGER IF EXISTS prayer_created_trigger ON prayers;
CREATE TRIGGER prayer_created_trigger
  AFTER INSERT ON prayers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_prayer_created();

-- ========================================
-- VERIFICATION QUERY
-- ========================================

-- Check that all triggers are created
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN (
  'devotional_created_trigger',
  'playbook_created_trigger', 
  'devotional_completed_trigger',
  'prayer_created_trigger'
)
ORDER BY event_object_table, trigger_name;
