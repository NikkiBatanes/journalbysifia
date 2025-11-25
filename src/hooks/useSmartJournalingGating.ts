// useSmartJournalingGating - Feature gating for smart journaling (time blocks, gratitude, prayer, reflect)
// Restricts Seeker and Spark accounts from using smart journaling features
// Only Growth and Transformation tiers have access

import { useMemo } from 'react';
import { useSubscription } from './useSubscription';
import type { SubscriptionTier } from '../types/subscription';

export type SmartJournalingFeature = 'general' | 'reflection' | 'gratitude' | 'prayer' | 'time_block';

export interface SmartJournalingGatingOptions {
  feature?: SmartJournalingFeature;
  allowSeekerFreeForm?: boolean;
  customMessage?: string;
}

export interface SmartJournalingGatingResult {
  isLocked: boolean;
  tier: SubscriptionTier;
  canUseFeature: boolean;
  upgradeMessage: string;
  feature: SmartJournalingFeature;
}

/**
 * Hook for managing smart journaling feature access
 * Seeker and Spark accounts are locked out and must upgrade to Growth or Transformation
 * Unless explicitly allowed per feature (e.g., journal carousel freeform)
 */
export function useSmartJournalingGating(options: SmartJournalingGatingOptions = {}): SmartJournalingGatingResult {
  const { subscription } = useSubscription();
  const tier = subscription?.tier || 'seeker';
  const {
    feature = 'general',
    allowSeekerFreeForm = false,
    customMessage,
  } = options;

  const result = useMemo(() => {
    // Allow bypass only for specific features when explicitly enabled (e.g., journal carousel)
    const seekerBypassesLock = allowSeekerFreeForm && feature === 'reflection';

    // For free_trial users, use their trial_chosen_tier for access checks
    const effectiveTier = tier === 'free_trial' && subscription?.trial_chosen_tier
      ? subscription.trial_chosen_tier
      : tier;

    // Restrict Seeker and Spark tiers - only Growth and Transformation can access smart journaling
    const isLocked = (effectiveTier === 'seeker' || effectiveTier === 'spark' || effectiveTier === 'spark_annual') && !seekerBypassesLock;
    const canUseFeature = !isLocked;

    const defaultMessages: Record<SmartJournalingFeature, string> = {
      general: 'Upgrade to Growth or Transformation to unlock Smart Journaling and track time blocks, gratitude, prayers, and reflections',
      reflection: 'Upgrade to Growth or Transformation to unlock guided prompts and premium journaling tools',
      gratitude: 'Upgrade to Growth or Transformation to unlock Smart Gratitude journaling with unlimited entries',
      prayer: 'Upgrade to Growth or Transformation to unlock Smart Prayer journaling and track answered prayers',
      time_block: 'Upgrade to Growth or Transformation to schedule time blocks and sync advanced journaling routines',
    };

    return {
      isLocked,
      tier: effectiveTier,
      canUseFeature,
      upgradeMessage: isLocked ? (customMessage || defaultMessages[feature] || defaultMessages.general) : '',
      feature,
    };
  }, [allowSeekerFreeForm, customMessage, feature, tier, subscription?.trial_chosen_tier]);

  return result;
}
