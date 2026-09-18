/**
 * Calendar Feature Gating Hook
 * Compatibility API for calendar and repeat feature access.
 */

import { useMemo } from 'react';

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
  const currentTier = 'included';
  const isSeeker = false;
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
