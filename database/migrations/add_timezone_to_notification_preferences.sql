-- Add timezone column to notification_preferences
-- This allows quiet hours to work correctly in user's local time

DO $$
BEGIN
  -- Check if timezone column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' 
    AND column_name = 'timezone'
  ) THEN
    -- Add timezone column with default UTC
    ALTER TABLE notification_preferences 
    ADD COLUMN timezone TEXT DEFAULT 'UTC';
    
    -- Add comment
    COMMENT ON COLUMN notification_preferences.timezone IS 'User timezone for quiet hours calculation (IANA timezone format, e.g., Asia/Manila, America/New_York)';
  END IF;
END $$;

-- Create index for faster timezone lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_timezone 
ON notification_preferences(timezone);
