/**
 * Calendar Feature Gating Hook
 * Compatibility API for calendar and repeat feature access.
 */

import { useMemo } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
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
  const { user } = useAuth();

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
  // Journal is paid up front. These values deliberately do not depend on the
  // retained siFia subscription metadata. Device permission checks still live
  // in the calendar/location integrations themselves.
  const permissions = useMemo(() => ({
    canSyncToCalendar: true,
    canUseRepeat: true,
    canUseLocationServices: true,
    canDeleteSeries: true,
  }), []);

  // Preserve the legacy callback shape while there is no Journal lock to act on.
  const handleCalendarLockTap = () => {};
  const handleRepeatLockTap = () => {};
  const showCalendarUpgradePrompt = () => {};
  const showRepeatUpgradePrompt = () => {};

  return {
    ...permissions,
    currentTier,
    isSeeker,
    showCalendarLock: false,
    showRepeatLock: false,
    handleCalendarLockTap,
    handleRepeatLockTap,
    showCalendarUpgradePrompt,
    showRepeatUpgradePrompt,
  };
};
