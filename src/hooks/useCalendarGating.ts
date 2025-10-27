/**
 * Calendar Feature Gating Hook
 * Controls access to calendar sync and repeat features based on subscription tier
 */

import { useMemo, useState, useEffect } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNavigation } from '@react-navigation/native';
import { analytics } from '../utils/analytics';

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
  const { user } = useAuth();
  const navigation = useNavigation();
  const [currentTier, setCurrentTier] = useState<string>('seeker');

  useEffect(() => {
    const loadTier = async () => {
      if (!user?.id) {
        setCurrentTier('seeker');
        return;
      }

      try {
        // Use the same service that UserProfile uses to get accurate tier
        const { NewSubscriptionService } = await import('../services/NewSubscriptionService');
        const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id);

        setCurrentTier(subscriptionData.tier || 'seeker');
      } catch (error) {
        Logger.error('🔍 useCalendarGating - Failed to get subscription', error as Error, { component: 'useCalendarGating' });

        // Fallback to user object properties
        const userTier = (user as any)?.subscription?.tier
          || (user as any)?.app_metadata?.subscription_tier
          || (user as any)?.user_metadata?.subscription_tier
          || (user as any)?.tier
          || 'seeker';

        setCurrentTier(userTier);
      }
    };

    loadTier();
  }, [user]);

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
