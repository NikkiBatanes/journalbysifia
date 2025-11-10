// useSmartJournalingGating - Feature gating for smart journaling (time blocks, gratitude, prayer, reflect)
// Restricts seeker accounts from using smart journaling features

import { useMemo } from 'react';
import { useSubscription } from './useSubscription';
import type { SubscriptionTier } from '../types/subscription';

export interface SmartJournalingGatingResult {
  isLocked: boolean;
  tier: SubscriptionTier;
  canUseFeature: boolean;
  upgradeMessage: string;
}

/**
 * Hook for managing smart journaling feature access
 * Seeker accounts are locked out and must upgrade
 */
export function useSmartJournalingGating(): SmartJournalingGatingResult {
  const { subscription } = useSubscription();
  const tier = subscription?.tier || 'seeker';

  const result = useMemo(() => {
    // Seeker accounts are locked
    const isLocked = tier === 'seeker';
    const canUseFeature = !isLocked;

    return {
      isLocked,
      tier,
      canUseFeature,
      upgradeMessage: isLocked
        ? 'Upgrade to unlock Smart Journaling and track time blocks, gratitude, prayers, and reflections'
        : '',
    };
  }, [tier]);

  return result;
}
