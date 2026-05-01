-- Add category column to playbooks table
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);

-- Add check constraint for category (matching devotionals constraint)
ALTER TABLE playbooks 
ADD CONSTRAINT playbooks_category_check 
CHECK (category = ANY (ARRAY[
  'Prayer'::text, 
  'Growth'::text, 
  'Healing'::text, 
  'Wisdom'::text, 
  'Relationships'::text, 
  'Purpose'::text, 
  'Career'::text, 
  'Finances'::text, 
  'Mental Health'::text, 
  'Parenting'::text, 
  'Health'::text,
  -- Legacy categories for backward compatibility
  'Family'::text,
  'Marriage'::text,
  'Singleness'::text,
  'Friendship'::text,
  'Work & Career'::text,
  'Calling & Purpose'::text,
  'Finance & Stewardship'::text,
  'Decision-Making'::text,
  'Conflict & Boundaries'::text,
  'Hurt & Forgiveness'::text,
  'Faith & Obedience'::text,
  'Church & Ministry'::text,
  'Emotions & Inner Life'::text,
  'Health & Wellness'::text,
  'Anxiety & Peace'::text,
  'Fear & Trust'::text,
  'Waiting & Uncertainty'::text,
  'Grief & Loss'::text,
  'Shame & Guilt'::text
]));
