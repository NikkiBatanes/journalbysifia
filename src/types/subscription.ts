// New Subscription System Types
// Created: 2025-08-20

export type SubscriptionTier =
  | 'seeker'           // Freemium: 0/0 limits after trial, 1 playbook during onboarding
  | 'free_trial'       // 2/2 free for 3 days
  | 'spark'            // 8 playbooks/devotionals + smart journaling
  | 'growth'           // 20 playbooks/devotionals
  | 'transformation'   // Unlimited (no dashboard counts)
  | 'family';          // Unlimited for up to 5 members (1 admin + 4 additional)

export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'pending_payment'
  | 'suspended';

export type PaymentPlatform =
  | 'apple'
  | 'google'
  | 'local_test';      // For local testing without app store

export type FamilyRole =
  | 'admin'
  | 'member';

export interface SubscriptionLimits {
  playbooks_limit: number;        // -1 for unlimited
  devotionals_limit: number;      // -1 for unlimited
  smart_journaling_enabled: boolean;
  show_dashboard_counts: boolean; // false for transformation/family
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;

  // Display name (e.g., "siFia Spark Trial", "siFia Growth")
  subscription_display_name?: string;

  // Trial and subscription dates
  trial_start_date?: string;
  trial_end_date?: string;
  trial_chosen_tier?: SubscriptionTier; // The plan user chose during trial signup
  subscription_start_date?: string;
  subscription_end_date?: string;

  // Payment integration
  platform?: PaymentPlatform;
  platform_subscription_id?: string;
  platform_transaction_id?: string;
  platform_receipt_data?: any;

  // Family subscription support
  family_group_id?: string;
  family_role?: FamilyRole;

  // Usage limits and tracking
  playbooks_limit: number;
  devotionals_limit: number;
  playbooks_used: number;
  devotionals_used: number;
  smart_journaling_enabled: boolean;

  // Discount codes
  discount_code?: string;
  discount_applied_amount?: number;
  discount_percentage?: number;

  // Metadata
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;

  // Computed properties
  limits?: SubscriptionLimits;
  is_trial?: boolean;
  is_expired?: boolean;
  days_remaining?: number;
}

export interface FamilySubscriptionGroup {
  id: string;
  admin_user_id: string;
  group_name: string;
  max_members: number;
  current_members: number;

  // Payment info
  platform?: PaymentPlatform;
  platform_subscription_id?: string;

  status: SubscriptionStatus;
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;

  // Computed properties
  members?: FamilyMember[];
}

export interface FamilyMember {
  user_id: string;
  role: FamilyRole;
  joined_at: string;
  user_profile?: {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface DiscountCode {
  id: string;
  code: string;

  // Discount configuration
  discount_percentage?: number;
  discount_amount?: number;

  // Validity
  valid_from: string;
  valid_until?: string;
  max_uses?: number;
  current_uses: number;

  // Applicable tiers
  applicable_tiers: SubscriptionTier[];

  // Dynamic discount settings
  is_dynamic: boolean;
  generated_for_user_id?: string;
  trigger_event?: string;

  metadata?: Record<string, any>;
  created_at: string;

  // Computed properties
  is_valid?: boolean;
  is_expired?: boolean;
  uses_remaining?: number;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  subscription_id: string;

  // Usage counters
  playbooks_generated: number;
  devotionals_generated: number;
  smart_journal_entries: number;
  export_count: number;

  // Tracking period
  tracking_period_start: string;
  last_reset_date: string;

  created_at: string;
  updated_at: string;
}

export interface SubscriptionUpgradeOptions {
  platform: PaymentPlatform;
  discount_code?: string;
  is_family_upgrade?: boolean;
  target_tier?: SubscriptionTier;
  billing_cycle?: 'monthly' | 'annual';
  subscription_start_date?: string;
  platform_subscription_id?: string;
  platform_transaction_id?: string;
}

export interface TrialStartOptions {
  user_id: string;
  duration_days?: number; // Default 3 days
  trial_chosen_tier?: SubscriptionTier; // The plan user chose during trial signup
  billing_cycle?: 'monthly' | 'annual'; // Billing preference for post-trial conversion
}

export interface FamilyInviteOptions {
  family_group_id: string;
  invitee_email: string;
  role?: FamilyRole;
}

// Utility type for subscription checks
export interface SubscriptionCheck {
  can_generate_playbook: boolean;
  can_generate_devotional: boolean;
  can_use_smart_journaling: boolean;
  can_export: boolean;
  playbooks_remaining: number;  // -1 for unlimited
  devotionals_remaining: number; // -1 for unlimited
  show_upgrade_prompt: boolean;
  upgrade_message?: string;
}

// Error types
export class SubscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class UsageLimitError extends SubscriptionError {
  constructor(
    tier: SubscriptionTier,
    feature: string,
    limit: number,
    used: number
  ) {
    super(
      `Usage limit exceeded for ${feature} on ${tier} tier: ${used}/${limit}`,
      'USAGE_LIMIT_EXCEEDED',
      { tier, feature, limit, used }
    );
  }
}

export class TrialExpiredError extends SubscriptionError {
  constructor(trial_end_date: string) {
    super(
      `Free trial expired on ${trial_end_date}`,
      'TRIAL_EXPIRED',
      { trial_end_date }
    );
  }
}

export class FamilyLimitError extends SubscriptionError {
  constructor(current_members: number, max_members: number) {
    super(
      `Family subscription limit reached: ${current_members}/${max_members}`,
      'FAMILY_LIMIT_EXCEEDED',
      { current_members, max_members }
    );
  }
}
