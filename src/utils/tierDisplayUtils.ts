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

    // Family
    'family': 'family',
    'family_annual': 'family_annual',

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
  const tierMappings: Record<SubscriptionTier, string> = {
    // Free tier
    'free_trial': 'Free Trial',
    
    // Seeker (freemium - was "basic")
    'seeker': 'siFia SEEKER',
    
    // Spark (entry paid) - 8 playbooks, 8 devotionals
    'spark': 'siFia SPARK',
    'spark_annual': 'siFia SPARK',
    
    // Growth (mid tier) - 20 playbooks, 20 devotionals
    'growth': 'siFia GROWTH',
    'growth_annual': 'siFia GROWTH',
    
    // Transformation (premium) - unlimited
    'transformation': 'siFia TRANSFORMATION',
    'transformation_annual': 'siFia TRANSFORMATION',
    
    // Family (top tier) - unlimited
    'family': 'siFia FAMILY',
    'family_annual': 'siFia FAMILY'
  };
  
  return tierMappings[tier] || 'Unknown Plan';
};

export const getTierShortName = (tier: SubscriptionTier): string => {
  const shortMappings: Record<SubscriptionTier, string> = {
    'free_trial': 'TRIAL',
    'seeker': 'SEEKER',
    'spark': 'SPARK',
    'spark_annual': 'SPARK',
    'growth': 'GROWTH',
    'growth_annual': 'GROWTH',
    'transformation': 'TRANSFORMATION',
    'transformation_annual': 'TRANSFORMATION',
    'family': 'FAMILY',
    'family_annual': 'FAMILY'
  };
  
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
