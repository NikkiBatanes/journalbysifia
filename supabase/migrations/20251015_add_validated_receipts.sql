-- Migration: Add validated_receipts table for server-side receipt validation
-- Created: 2025-10-15
-- Purpose: Store and track validated Apple/Google receipts for enterprise-grade IAP

-- Create validated_receipts table
CREATE TABLE IF NOT EXISTS validated_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  receipt_data TEXT NOT NULL,
  validation_response JSONB NOT NULL,
  product_id TEXT,
  transaction_id TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN DEFAULT true,
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_validated_receipts_user_id ON validated_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_transaction_id ON validated_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_expires_at ON validated_receipts(expires_at);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_platform ON validated_receipts(platform);

-- Add RLS policies
ALTER TABLE validated_receipts ENABLE ROW LEVEL SECURITY;

-- Users can read their own receipts
CREATE POLICY "Users can read own receipts"
  ON validated_receipts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update receipts (server-side only)
CREATE POLICY "Service role can manage receipts"
  ON validated_receipts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_validated_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validated_receipts_updated_at
  BEFORE UPDATE ON validated_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_validated_receipts_updated_at();

-- Add comments
COMMENT ON TABLE validated_receipts IS 'Server-validated Apple/Google receipts for IAP';
COMMENT ON COLUMN validated_receipts.receipt_data IS 'Base64 encoded receipt data';
COMMENT ON COLUMN validated_receipts.validation_response IS 'Full response from Apple/Google validation';
COMMENT ON COLUMN validated_receipts.transaction_id IS 'Unique transaction ID from store';
COMMENT ON COLUMN validated_receipts.expires_at IS 'Subscription expiration timestamp';
