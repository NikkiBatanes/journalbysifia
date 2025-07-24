-- Add answered_date column to prayers table if it doesn't exist
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'prayers' AND column_name = 'answered_date'
    ) THEN
        -- Add the column as nullable since existing rows won't have this value
        ALTER TABLE prayers 
        ADD COLUMN answered_date TIMESTAMP WITH TIME ZONE;
        
        -- Add a comment to document the column
        COMMENT ON COLUMN prayers.answered_date IS 'The date when the prayer was marked as answered';
        
        RAISE NOTICE 'Added answered_date column to prayers table';
    ELSE
        RAISE NOTICE 'answered_date column already exists in prayers table';
    END IF;
END
$$;