-- Add title and message columns to notification_queue table if they don't exist
DO $$ 
BEGIN
    -- Add title column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_queue' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE notification_queue ADD COLUMN title TEXT;
    END IF;

    -- Add message column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_queue' 
        AND column_name = 'message'
    ) THEN
        ALTER TABLE notification_queue ADD COLUMN message TEXT;
    END IF;
END $$;

-- Add title and message columns to notifications table if they don't exist
DO $$ 
BEGIN
    -- Add title column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE notifications ADD COLUMN title TEXT;
    END IF;

    -- Add message column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'message'
    ) THEN
        ALTER TABLE notifications ADD COLUMN message TEXT;
    END IF;
END $$;

-- Update existing notification_queue records with default values for title/message
UPDATE notification_queue 
SET 
    title = COALESCE(title, 'Notification'),
    message = COALESCE(message, 'A new notification is available.')
WHERE title IS NULL OR message IS NULL;

-- Update existing notifications records with default values for title/message
UPDATE notifications 
SET 
    title = COALESCE(title, 'Notification'),
    message = COALESCE(message, 'A new notification is available.')
WHERE title IS NULL OR message IS NULL;

-- Add comments to document the columns
COMMENT ON COLUMN notification_queue.title IS 'The title of the notification';
COMMENT ON COLUMN notification_queue.message IS 'The message body of the notification';
COMMENT ON COLUMN notifications.title IS 'The title of the notification';
COMMENT ON COLUMN notifications.message IS 'The message body of the notification';
