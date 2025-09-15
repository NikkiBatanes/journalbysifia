// Compatibility subscription interfaces (legacy)
// Bridges older imports to the new types while keeping existing services working.

// Re-export modern types where possible
export type ModernSubscriptionTier = import('../types/subscription').SubscriptionTier;

// Legacy tiers included in older UI/logic (annual variants)
export type SubscriptionTier =
  | ModernSubscriptionTier
  | 'spark_annual'
  | 'growth_annual'
  | 'transformation_annual'
  | 'family_annual';

// Limits shape used by legacy services (tierRestrictionService, etc.)
export interface SubscriptionLimits {
  playbooks: number; // -1 for unlimited
  devotionals: number; // -1 for unlimited
  exports: number; // -1 for unlimited
  apiCalls: number; // -1 for unlimited
  familyMembers: number; // -1 for unlimited

  // Feature flags
  intelligenceEnabled?: boolean;
  expoundingEnabled?: boolean;
  smartJournalingEnabled?: boolean;
  calendarSyncEnabled?: boolean;
  advancedAnalytics?: boolean;
  prioritySupport?: boolean;
  copyIncompleteTodosEnabled?: boolean;
  answeredPrayerTrackingEnabled?: boolean;
}

export type CurrencyCode = 'usd' | 'php';
export type BillingInterval = 'month' | 'year';

export interface PricingEntry {
  amount: number; // in cents
  currency: CurrencyCode;
  interval: BillingInterval;
}

// Baseline US pricing (in cents) - mirrors pricingService values
const US_MONTHLY: Record<Exclude<SubscriptionTier, `${string}_annual`>, PricingEntry> = {
  seeker: { amount: 0, currency: 'usd', interval: 'month' },
  free_trial: { amount: 0, currency: 'usd', interval: 'month' },
  spark: { amount: 799, currency: 'usd', interval: 'month' },
  growth: { amount: 1499, currency: 'usd', interval: 'month' },
  transformation: { amount: 2499, currency: 'usd', interval: 'month' },
  family: { amount: 4499, currency: 'usd', interval: 'month' },
};

const US_ANNUAL: Record<Extract<SubscriptionTier, `${string}_annual`>, PricingEntry> = {
  spark_annual: { amount: 7999, currency: 'usd', interval: 'year' },
  growth_annual: { amount: 14999, currency: 'usd', interval: 'year' },
  transformation_annual: { amount: 24999, currency: 'usd', interval: 'year' },
  family_annual: { amount: 44999, currency: 'usd', interval: 'year' },
};

export const PRICING_US: Record<SubscriptionTier, PricingEntry> = {
  ...US_MONTHLY,
  ...US_ANNUAL,
};

// Baseline PH pricing (in cents) - aligns with amounts referenced in code comments
const PH_MONTHLY: Record<Exclude<SubscriptionTier, `${string}_annual`>, PricingEntry> = {
  seeker: { amount: 0, currency: 'php', interval: 'month' },
  free_trial: { amount: 0, currency: 'php', interval: 'month' },
  spark: { amount: 19900, currency: 'php', interval: 'month' },
  growth: { amount: 39900, currency: 'php', interval: 'month' },
  transformation: { amount: 59900, currency: 'php', interval: 'month' },
  family: { amount: 129000, currency: 'php', interval: 'month' },
};

// Provide simple annual equivalents (12x monthly with ~17% off)
const PH_ANNUAL: Record<Extract<SubscriptionTier, `${string}_annual`>, PricingEntry> = {
  spark_annual: { amount: 199000, currency: 'php', interval: 'year' },
  growth_annual: { amount: 399000, currency: 'php', interval: 'year' },
  transformation_annual: { amount: 599000, currency: 'php', interval: 'year' },
  family_annual: { amount: 1199000, currency: 'php', interval: 'year' },
};

export const PRICING_PH: Record<SubscriptionTier, PricingEntry> = {
  ...PH_MONTHLY,
  ...PH_ANNUAL,
};
