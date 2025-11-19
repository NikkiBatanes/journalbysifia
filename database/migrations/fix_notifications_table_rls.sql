-- Fix notifications table RLS to allow service-role inserts for family notifications
-- This allows the app to send notifications to other users (e.g., admin gets decline notification)

-- Create notifications table if it doesn't exist
-- Note: Using 'type' column (not 'notification_type') to match existing schema
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications for any user" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications for others" ON notifications;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own notifications
CREATE POLICY "Users can insert their own notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow authenticated users to insert notifications for other users
-- This is needed for family invitations, member joined, etc.
-- The app logic ensures proper authorization before calling these functions
CREATE POLICY "Authenticated users can insert notifications for others"
  ON notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comment
COMMENT ON TABLE notifications IS 'In-app notifications for users, including family invitation notifications';
