// New Subscription System Types
// Created: 2025-08-20

export type SubscriptionTier =
  | 'seeker'           // Free access layer: 2 PB / 1 DEV per month (resets monthly), up to 3-day devotionals
  | 'free_trial'       // Trial limits depend on trial_chosen_tier (Spark: 5/5, Growth: 15/15, Transformation: 25/25)
  | 'spark'            // 10 playbooks/devotionals, up to 3-day devotionals
  | 'spark_annual'     // Annual spark subscription
  | 'growth'           // 25 playbooks/devotionals, up to 5-day devotionals
  | 'growth_annual'    // Annual growth subscription
  | 'transformation'   // 60 playbooks/devotionals, up to 7-day devotionals
  | 'transformation_annual'; // Annual transformation subscription
  // | 'family';       // POST-LAUNCH: Unlimited for up to 5 members (1 admin + 4 additional)

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

// POST-LAUNCH: Family Role Types
// export type FamilyRole =
//   | 'admin'
//   | 'member';

export interface SubscriptionLimits {
  playbooks_limit: number;        // -1 for unlimited
  devotionals_limit: number;      // -1 for unlimited
  wisdom_limit: number;           // -1 for unlimited
  refinement_limit: number;       // -1 for unlimited
  smart_journaling_enabled: boolean;
  show_dashboard_counts: boolean;
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
  trial_converted_date?: string | null;
  trial_cancelled_date?: string | null;
  subscription_start_date?: string;
  subscription_end_date?: string;

  // Payment integration
  platform?: PaymentPlatform;
  platform_subscription_id?: string;
  platform_transaction_id?: string;
  original_transaction_id?: string | null;
  platform_receipt_data?: any;

  // POST-LAUNCH: Family subscription support
  // family_group_id?: string;
  // family_role?: FamilyRole;

  // Usage limits and tracking
  playbooks_limit: number;
  devotionals_limit: number;
  wisdom_limit: number;
  refinement_limit: number;
  playbooks_used: number;
  devotionals_used: number;
  wisdom_count: number;
  refinement_count: number;
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
  is_in_cooldown?: boolean; // User ended trial without upgrading, in 30-day cooldown
  replenish_date?: string; // Date when cooldown ends and usage resets
}

// POST-LAUNCH: Family Subscription Group Interface
/* export interface FamilySubscriptionGroup {
  id: string;
  admin_user_id: string;
  group_name: string;
  max_members: number;
  current_members: number;

  // Payment info
  platform?: PaymentPlatform;
  platform_subscription_id?: string;
  platform_transaction_id?: string;
  platform_receipt_data?: any;

  // Billing
  billing_cycle?: 'monthly' | 'annual';
  subscription_start_date?: string;
  subscription_end_date?: string;
  next_billing_date?: string;

  status: SubscriptionStatus;
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;

  // Computed properties
  members?: FamilyMember[];
  usage_summary?: FamilyUsageSummary;
  activity_log?: FamilyActivity[];
} */

// POST-LAUNCH: Family Member Interface
/* export interface FamilyMember {
  id?: string;
  user_id: string;
  family_group_id: string;
  role: FamilyRole;
  joined_at: string;
  status: 'active' | 'removed' | 'suspended';

  // User profile data
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;

  // Usage tracking
  playbooks_used?: number;
  devotionals_used?: number;
  last_active?: string;

  user_profile?: {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    avatar_url?: string;
  };
} */

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
  platform_transaction_id?: string;
  original_transaction_id?: string;
  platform_subscription_id?: string;
}

// POST-LAUNCH: Family Invite Options
/* export interface FamilyInviteOptions {
  family_group_id: string;
  invitee_email: string;
  role?: FamilyRole;
} */

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

// POST-LAUNCH: Family Limit Error
/* export class FamilyLimitError extends SubscriptionError {
  constructor(current_members: number, max_members: number) {
    super(
      `Family subscription limit reached: ${current_members}/${max_members}`,
      'FAMILY_LIMIT_EXCEEDED',
      { current_members, max_members }
    );
  }
} */

// ===== POST-LAUNCH: FAMILY SUBSCRIPTION EXTENDED TYPES =====
/*

export interface FamilyInvitation {
  id: string;
  family_group_id: string;
  invited_email: string;
  invited_by_user_id: string;
  invitation_code: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  accepted_by_user_id?: string;
  expires_at: string;
  accepted_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Computed properties
  is_expired?: boolean;
  days_until_expiry?: number;
  invited_by_name?: string;
}

export interface FamilyActivity {
  id: string;
  family_group_id: string;
  user_id?: string;
  activity_type: FamilyActivityType;
  activity_description?: string;
  affected_user_id?: string;
  metadata?: Record<string, any>;
  created_at: string;

  // Computed properties
  user_name?: string;
  affected_user_name?: string;
}

export type FamilyActivityType =
  | 'group_created'
  | 'member_added'
  | 'member_removed'
  | 'member_suspended'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'invitation_cancelled'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'payment_successful'
  | 'payment_failed'
  | 'admin_changed'
  | 'group_name_changed'
  | 'capacity_increased';

export interface FamilyUsageAnalytics {
  id: string;
  family_group_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  playbooks_generated: number;
  devotionals_generated: number;
  smart_journal_entries: number;
  active_days: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FamilyUsageSummary {
  total_playbooks: number;
  total_devotionals: number;
  total_journal_entries: number;
  active_members: number;
  avg_playbooks_per_member: number;
  avg_devotionals_per_member: number;
  period_start?: string;
  period_end?: string;
}

export interface FamilyMemberUsage {
  userId: string;
  fullName: string;
  email?: string;
  avatar_url?: string;
  playbooks: number;
  devotionals: number;
  journal_entries: number;
  active_days: number;
  last_active?: string;
  percentage_of_total?: number;
}

export interface CreateFamilyGroupOptions {
  admin_user_id: string;
  group_name: string;
  platform_subscription_id?: string;
  max_members?: number;
  billing_cycle?: 'monthly' | 'annual';
}

export interface InviteFamilyMemberOptions {
  family_group_id: string;
  invited_email: string;
  invited_by_user_id: string;
  custom_message?: string;
}

export interface RemoveFamilyMemberOptions {
  family_group_id: string;
  user_id: string;
  admin_user_id: string;
  reason?: string;
}

export interface FamilySubscriptionCheck {
  is_family_member: boolean;
  is_family_admin: boolean;
  family_group_id?: string;
  can_invite_members: boolean;
  can_remove_members: boolean;
  remaining_slots: number;
  total_slots: number;
}
*/
