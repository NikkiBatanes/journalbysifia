// Legacy-compatible wrapper around useNewSubscription
// Provides the older useSubscription() API expected by existing screens

import { useMemo } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNewSubscription } from './useNewSubscription';

export interface LegacyUsage {
  playbooks_generated: number;
  devotionals_generated: number;
  exports_generated?: number;
}

export interface LegacyUseSubscriptionResult {
  subscription: any | null;
  usage: LegacyUsage | null;
  loading: boolean;
  error: Error | null;
  refreshSubscription: () => Promise<void>;
}

export function useSubscription(): LegacyUseSubscriptionResult {
  const { user } = useAuth();
  const userId = user?.id || '';
  const newSub = useNewSubscription(userId);

  const usage = useMemo<LegacyUsage | null>(() => {
    if (!newSub.subscription) {return null;}
    const playbooksUsed = (newSub.subscription as any).playbooks_used ?? 0;
    const devotionalsUsed = (newSub.subscription as any).devotionals_used ?? 0;
    // exports count may be tracked separately; expose 0 if unknown
    return {
      playbooks_generated: playbooksUsed,
      devotionals_generated: devotionalsUsed,
      exports_generated: 0,
    };
  }, [newSub.subscription]);

  return {
    subscription: newSub.subscription,
    usage,
    loading: newSub.isLoading,
    error: newSub.error,
    refreshSubscription: newSub.refreshSubscription,
  };
}

export default useSubscription;
