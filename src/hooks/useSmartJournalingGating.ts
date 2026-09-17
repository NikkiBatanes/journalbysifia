// Compatibility hook for Journal's smart journaling entry points.

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
 * Smart journaling is core Journal functionality and is not tier-gated.
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
    const effectiveTier = tier === 'free_trial' && subscription?.trial_chosen_tier
      ? subscription.trial_chosen_tier
      : tier;

    return {
      isLocked: false,
      tier: effectiveTier,
      canUseFeature: true,
      upgradeMessage: '',
      feature,
    };
  }, [allowSeekerFreeForm, customMessage, feature, tier, subscription?.trial_chosen_tier]);

  return result;
}
