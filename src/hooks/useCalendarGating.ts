/**
 * Calendar Feature Gating Hook
 * Controls access to calendar sync and repeat features based on subscription tier
 */

import { useMemo, useEffect } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNavigation } from '@react-navigation/native';
import { analytics } from '../utils/analytics';
import { useQuery } from '@tanstack/react-query';
import NewSubscriptionService from '../services/NewSubscriptionService';

export interface CalendarGatingState {
  // Calendar sync permissions
  canSyncToCalendar: boolean;
  canUseRepeat: boolean;
  canUseLocationServices: boolean;
  canDeleteSeries: boolean;

  // Current tier info
  currentTier: string;
  isSeeker: boolean;

  // UI state
  showCalendarLock: boolean;
  showRepeatLock: boolean;

  // Actions
  handleCalendarLockTap: () => void;
  handleRepeatLockTap: () => void;

  // Upgrade prompts
  showCalendarUpgradePrompt: () => void;
  showRepeatUpgradePrompt: () => void;
}

export const useCalendarGating = (): CalendarGatingState => {
  const { user, updatePreferences } = useAuth();
  const navigation = useNavigation();

  // Use React Query to watch subscription changes - this makes the hook reactive
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id || ''],
    queryFn: () => NewSubscriptionService.getUserSubscription(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 0, // Always consider stale to ensure immediate updates after payment
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount to get latest state
  });

  // Get current tier from subscription, with fallback
  const currentTier = useMemo(() => {
    if (subscription?.tier) {
      return subscription.tier;
    }

    // Fallback to user object properties
    const userTier = (user as any)?.subscription?.tier
      || (user as any)?.app_metadata?.subscription_tier
      || (user as any)?.user_metadata?.subscription_tier
      || (user as any)?.tier
      || 'seeker';

    return userTier;
  }, [subscription, user]);

  const isSeeker = currentTier === 'seeker';

  const permissions = useMemo(() => {

    // Seeker (freemium) restrictions
    if (isSeeker) {
      return {
        canSyncToCalendar: false,
        canUseRepeat: false,
        canUseLocationServices: false, // Only manual entry
        canDeleteSeries: false, // Only single delete
      };
    }

    // All paid tiers get full access
    return {
      canSyncToCalendar: true,
      canUseRepeat: true,
      canUseLocationServices: true,
      canDeleteSeries: true,
    };
  }, [isSeeker]);

  // When user becomes seeker (cancelled or downgraded), automatically turn off calendar auto-sync
  useEffect(() => {
    const ensureAutoSyncOffForSeeker = async () => {
      try {
        if (!user?.id) {return;}
        if (currentTier !== 'seeker') {return;}

        const prefs = (user as any)?.user_metadata?.preferences || {};
        const calendarPrefs = prefs?.calendar || {};
        if (calendarPrefs.autoSync === true) {
          const updated = {
            ...prefs,
            calendar: { ...calendarPrefs, autoSync: false },
          };
          try {
            await updatePreferences(updated);
            Logger.info('Auto-disabled calendar autoSync for seeker tier', { component: 'useCalendarGating', userId: user.id });
          } catch (e) {
            Logger.warn('Failed to auto-disable calendar autoSync for seeker tier', { component: 'useCalendarGating', userId: user.id });
          }
        }
      } catch (error) {
        Logger.warn('ensureAutoSyncOffForSeeker error', { component: 'useCalendarGating', errorMessage: (error as Error)?.message });
      }
    };

    ensureAutoSyncOffForSeeker();
    // Depend on tier and user identity only
  }, [currentTier, user?.id, user, updatePreferences]);

  const handleCalendarLockTap = () => {
    analytics.trackTimeBlockEvent('calendar_lock_tapped' as any, {
      current_tier: currentTier,
      feature: 'calendar_sync',
    }, user?.id);

    // Navigate to upgrade screen
    (navigation as any).navigate('OnboardingSalesOffer', {
      source: 'calendar_sync',
      feature: 'Calendar Sync',
      context: 'timeblock',
    });
  };

  const handleRepeatLockTap = () => {
    analytics.trackTimeBlockEvent('repeat_lock_tapped' as any, {
      current_tier: currentTier,
      feature: 'repeat_options',
    }, user?.id);

    // Navigate to upgrade screen with skip notification flag
    (navigation as any).navigate('OnboardingSalesOffer', {
      source: 'repeat_options',
      feature: 'Repeat Options',
      context: 'timeblock',
      skipNotificationPreference: true,
    });
  };

  const showCalendarUpgradePrompt = () => {
    analytics.trackTimeBlockEvent('calendar_upgrade_prompt_shown' as any, {
      current_tier: currentTier,
    }, user?.id);

    (navigation as any).navigate('OnboardingSalesOffer', {
      source: 'calendar_upgrade_prompt',
      feature: 'Calendar Sync',
      context: 'timeblock',
      message: 'Sync your time blocks to your device calendar and never miss what matters most.',
      skipNotificationPreference: true,
    });
  };

  const showRepeatUpgradePrompt = () => {
    analytics.trackTimeBlockEvent('repeat_upgrade_prompt_shown' as any, {
      current_tier: currentTier,
    }, user?.id);

    (navigation as any).navigate('OnboardingSalesOffer', {
      source: 'repeat_upgrade_prompt',
      feature: 'Recurring Time Blocks',
      context: 'timeblock',
      message: 'Create recurring time blocks and build consistent spiritual habits.',
      skipNotificationPreference: true,
    });
  };

  return {
    ...permissions,
    currentTier,
    isSeeker,
    showCalendarLock: isSeeker,
    showRepeatLock: isSeeker,
    handleCalendarLockTap,
    handleRepeatLockTap,
    showCalendarUpgradePrompt,
    showRepeatUpgradePrompt,
  };
};
