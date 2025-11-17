// useSmartJournalingGating - Feature gating for smart journaling (time blocks, gratitude, prayer, reflect)
// Restricts seeker accounts from using smart journaling features

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
 * Seeker accounts are locked out and must upgrade unless explicitly allowed per feature
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
    const seekerBypassesLock = allowSeekerFreeForm && feature === 'reflection';
    const isLocked = tier === 'seeker' && !seekerBypassesLock;
    const canUseFeature = !isLocked;

    const defaultMessages: Record<SmartJournalingFeature, string> = {
      general: 'Upgrade to unlock Smart Journaling and track time blocks, gratitude, prayers, and reflections',
      reflection: 'Upgrade to unlock guided prompts and premium journaling tools',
      gratitude: 'Upgrade to unlock Smart Gratitude journaling with unlimited entries',
      prayer: 'Upgrade to unlock Smart Prayer journaling and track answered prayers',
      time_block: 'Upgrade to schedule time blocks and sync advanced journaling routines',
    };

    return {
      isLocked,
      tier,
      canUseFeature,
      upgradeMessage: isLocked ? (customMessage || defaultMessages[feature] || defaultMessages.general) : '',
      feature,
    };
  }, [allowSeekerFreeForm, customMessage, feature, tier]);

  return result;
}
