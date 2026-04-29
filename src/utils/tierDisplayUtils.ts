/**
 * Centralized Tier Display Utilities
 * Single source of truth for subscription tier names and formatting
 */

import { SubscriptionTier } from '../interfaces/subscription';

/**
 * Normalize tier inputs coming from various sources (marketing, sales, legacy)
 * into canonical SubscriptionTier values used by the app.
 * Examples:
 *  - "spark" -> "spark"
 *  - "spark_annual" -> "spark_annual"
 *  - "spark-monthly" -> "spark"
 *  - "GROWTH-ANNUAL" -> "growth_annual"
 */
export const normalizeTierInput = (tierLike: string | undefined | null): SubscriptionTier | null => {
  if (!tierLike || typeof tierLike !== 'string') { return null; }
  // Lowercase, replace dashes with underscores, trim, and remove a trailing _monthly alias
  const cleaned = tierLike
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_month(ly)?$/, '');

  // Map known legacy/sales aliases to canonical tiers
  const aliasMap: Record<string, SubscriptionTier> = {
    // Spark tier
    'spark': 'spark',
    'spark_annual': 'spark_annual',

    // Seeker
    'seeker': 'seeker',
    'free': 'seeker',

    // Growth
    'growth': 'growth',
    'growth_annual': 'growth_annual',

    // Transformation (sometimes marketed as premium)
    'transformation': 'transformation',
    'transformation_annual': 'transformation_annual',
    'premium': 'transformation',
    'premium_annual': 'transformation_annual',

    // POST-LAUNCH: Family
    // 'family': 'family',
    // 'family_annual': 'family_annual',

    // Trial
    'free_trial': 'free_trial',
    'trial': 'free_trial',
  };

  // Also support cleaned values that already have _year or _annual
  const normalized = aliasMap[cleaned]
    || (cleaned.endsWith('_annual') && aliasMap[cleaned])
    || null;
  return normalized;
};

export const getTierDisplayName = (tier: SubscriptionTier): string => {
  const tierMappings = {
    // Free tier
    'free_trial': 'Free Trial',

    // Seeker (freemium - was "basic")
    'seeker': 'siFia Seeker',

    // Spark (entry paid) - 10 playbooks, 10 devotionals
    'spark': 'siFia Spark',
    'spark_annual': 'siFia Spark',

    // Growth (mid tier) - 25 playbooks, 25 devotionals
    'growth': 'siFia Growth',
    'growth_annual': 'siFia Growth',

    // Transformation (premium) - 60 playbooks, 60 devotionals, up to 7-day devotionals
    'transformation': 'siFia Transformation',
    'transformation_annual': 'siFia Transformation',

    // POST-LAUNCH: Family (top tier) - unlimited
    // 'family': 'siFia Family',
    // 'family_annual': 'siFia Family',
  } as Record<SubscriptionTier, string>;

  return tierMappings[tier] || 'Unknown Plan';
};

export const getTierShortName = (tier: SubscriptionTier): string => {
  const shortMappings = {
    'free_trial': 'TRIAL',
    'seeker': 'SEEKER',
    'spark': 'SPARK',
    'spark_annual': 'SPARK',
    'growth': 'GROWTH',
    'growth_annual': 'GROWTH',
    'transformation': 'TRANSFORMATION',
    'transformation_annual': 'TRANSFORMATION',
    // POST-LAUNCH: 'family': 'FAMILY',
    // POST-LAUNCH: 'family_annual': 'FAMILY',
  } as Record<SubscriptionTier, string>;

  return shortMappings[tier] || 'UNKNOWN';
};

export const isAnnualTier = (tier: SubscriptionTier): boolean => {
  return tier.includes('annual');
};

export const isTrial = (tier: SubscriptionTier): boolean => {
  return tier === 'free_trial';
};

export const isFreeTier = (tier: SubscriptionTier): boolean => {
  return tier === 'free_trial' || tier === 'seeker';
};

export const isPaidTier = (tier: SubscriptionTier): boolean => {
  return !isFreeTier(tier);
};
