/**
 * Enterprise-Grade Subscription System
 * Handles all subscription tiers, limits, and billing
 */

export type SubscriptionTier = 'free_trial' | 'starter' | 'growth' | 'transformation' | 'family' | 'starter_annual' | 'growth_annual' | 'transformation_annual' | 'family_annual';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'expired';

export interface SubscriptionLimits {
  playbooks: number;
  devotionals: number;
  exports: number;
  apiCalls: number;
  familyMembers: number;
  intelligenceEnabled: boolean;
  intelligenceLevel?: 'basic' | 'enhanced' | 'advanced';
  smartJournalingEnabled?: boolean;
  journalTemplatesAccess?: 'basic' | 'all';
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

export interface UsageTracking {
  userId: string;
  period: string; // YYYY-MM format
  playbooks_used: number;
  devotionals_used: number;
  ai_tokens_used: number;
  ai_cost_cents: number;
  api_calls_made: number;
  lastUpdated: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;

  // Billing
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  priceId: string;

  // Dates
  startDate: string;
  endDate: string;
  trialEndDate?: string;
  canceledAt?: string;

  // Limits and usage
  limits: SubscriptionLimits;
  currentUsage: UsageTracking;

  // Family plan specific
  familyOwnerId?: string;
  familyMembers?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface BillingHistory {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'pending' | 'refunded';
  invoiceId?: string;
  paymentMethod: string;
  billingDate: string;
  nextBillingDate?: string;
  createdAt: string;
}

// Subscription tier configurations
export const SUBSCRIPTION_CONFIGS: Record<SubscriptionTier, SubscriptionLimits> = {
  free_trial: {
    playbooks: 2,
    devotionals: 2,
    exports: 0,
    familyMembers: 0,
    apiCalls: 0,
    intelligenceEnabled: true,
    intelligenceLevel: 'basic',
    smartJournalingEnabled: true,  // Full access during trial
    journalTemplatesAccess: 'all', // All templates during trial
    advancedAnalytics: false,
    prioritySupport: false,
  },
  starter: {
    playbooks: 4,
    devotionals: 4,
    exports: 0,
    familyMembers: 0,
    apiCalls: 0,
    intelligenceEnabled: true,
    intelligenceLevel: 'basic',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: false,
    prioritySupport: false,
  },
  growth: {
    playbooks: 15,
    devotionals: 15,
    exports: 0,
    familyMembers: 0,
    apiCalls: 0,
    intelligenceEnabled: true,
    intelligenceLevel: 'enhanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
  transformation: {
    playbooks: -1, // unlimited
    devotionals: -1,
    exports: 0,
    familyMembers: 0,
    apiCalls: 1000,
    intelligenceEnabled: true,
    intelligenceLevel: 'advanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
  family: {
    playbooks: -1,
    devotionals: -1,
    exports: 0,
    familyMembers: 5,
    apiCalls: 2000,
    intelligenceEnabled: true,
    intelligenceLevel: 'advanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
  starter_annual: {
    playbooks: 4,
    devotionals: 4,
    exports: 0,
    familyMembers: 0,
    apiCalls: 0,
    intelligenceEnabled: true,
    intelligenceLevel: 'basic',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: false,
    prioritySupport: false,
  },
  growth_annual: {
    playbooks: 15,
    devotionals: 15,
    exports: 0,
    familyMembers: 0,
    apiCalls: 0,
    intelligenceEnabled: true,
    intelligenceLevel: 'enhanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
  transformation_annual: {
    playbooks: -1,
    devotionals: -1,
    exports: 0,
    familyMembers: 0,
    apiCalls: 1000,
    intelligenceEnabled: true,
    intelligenceLevel: 'advanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
  family_annual: {
    playbooks: -1,
    devotionals: -1,
    exports: 0,
    familyMembers: 5,
    apiCalls: 2000,
    intelligenceEnabled: true,
    intelligenceLevel: 'advanced',
    smartJournalingEnabled: true,
    journalTemplatesAccess: 'all',
    advancedAnalytics: true,
    prioritySupport: true,
  },
};

// US Market Pricing (USD)
export const PRICING_US: Record<SubscriptionTier, { amount: number; currency: string; interval: 'month' | 'year' }> = {
  free_trial: { amount: 0, currency: 'usd', interval: 'month' },
  starter: { amount: 699, currency: 'usd', interval: 'month' }, // $6.99
  growth: { amount: 1299, currency: 'usd', interval: 'month' }, // $12.99
  transformation: { amount: 2499, currency: 'usd', interval: 'month' }, // $24.99
  family: { amount: 3499, currency: 'usd', interval: 'month' }, // $34.99
  starter_annual: { amount: 4999, currency: 'usd', interval: 'year' }, // $49.99 (17% off)
  growth_annual: { amount: 12999, currency: 'usd', interval: 'year' }, // $129.99 (17% off)
  transformation_annual: { amount: 24999, currency: 'usd', interval: 'year' }, // $249.99 (17% off)
  family_annual: { amount: 34999, currency: 'usd', interval: 'year' }, // $349.99 (17% off)
};

// Philippines Market Pricing (PHP) - Profitable & Affordable
export const PRICING_PH: Record<SubscriptionTier, { amount: number; currency: string; interval: 'month' | 'year' }> = {
  free_trial: { amount: 0, currency: 'php', interval: 'month' },
  starter: { amount: 19900, currency: 'php', interval: 'month' }, // ₱199 (~$3.58 USD equivalent)
  growth: { amount: 34900, currency: 'php', interval: 'month' }, // ₱349 (~$6.28 USD equivalent)
  transformation: { amount: 54900, currency: 'php', interval: 'month' }, // ₱549 (~$9.88 USD equivalent)
  family: { amount: 69900, currency: 'php', interval: 'month' }, // ₱699 (~$12.58 USD equivalent)
  starter_annual: { amount: 199900, currency: 'php', interval: 'year' }, // ₱1,999 (17% off)
  growth_annual: { amount: 349900, currency: 'php', interval: 'year' }, // ₱3,499 (17% off)
  transformation_annual: { amount: 549900, currency: 'php', interval: 'year' }, // ₱5,499 (17% off)
  family_annual: { amount: 699900, currency: 'php', interval: 'year' }, // ₱6,999 (17% off)
};

// Default to US pricing for backward compatibility
export const PRICING = PRICING_US;
