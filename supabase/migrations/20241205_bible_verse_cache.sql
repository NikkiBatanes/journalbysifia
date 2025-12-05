-- Create table for caching Bible verses from BibleGateway
-- This reduces scraping requests and improves performance

CREATE TABLE IF NOT EXISTS bible_verse_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  version TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite unique constraint
  CONSTRAINT unique_verse_version UNIQUE (reference, version)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bible_verse_cache_lookup 
  ON bible_verse_cache (reference, version);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_bible_verse_cache_expires 
  ON bible_verse_cache (expires_at);

-- Index for access patterns
CREATE INDEX IF NOT EXISTS idx_bible_verse_cache_access 
  ON bible_verse_cache (last_accessed_at DESC);

-- Enable Row Level Security
ALTER TABLE bible_verse_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access to bible_verse_cache"
  ON bible_verse_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_bible_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bible_verse_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create cached verse
CREATE OR REPLACE FUNCTION get_cached_bible_verse(
  p_reference TEXT,
  p_version TEXT
)
RETURNS TABLE (
  verse_text TEXT,
  is_cached BOOLEAN
) AS $$
BEGIN
  -- Try to get from cache
  RETURN QUERY
  SELECT 
    bvc.verse_text,
    true AS is_cached
  FROM bible_verse_cache bvc
  WHERE bvc.reference = p_reference
    AND bvc.version = p_version
    AND bvc.expires_at > NOW();
  
  -- Update access stats if found
  UPDATE bible_verse_cache
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE reference = p_reference
    AND version = p_version;
    
  -- If not found, return null
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cache a verse
CREATE OR REPLACE FUNCTION cache_bible_verse(
  p_reference TEXT,
  p_version TEXT,
  p_verse_text TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO bible_verse_cache (reference, version, verse_text)
  VALUES (p_reference, p_version, p_verse_text)
  ON CONFLICT (reference, version) 
  DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    created_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    access_count = bible_verse_cache.access_count + 1,
    last_accessed_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE bible_verse_cache IS 'Caches Bible verses scraped from BibleGateway to reduce API calls and improve performance';
