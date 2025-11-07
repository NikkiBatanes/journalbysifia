import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { notificationManagementService } from '../services/notificationManagementService';
import { pushNotificationService } from '../services/pushNotificationService';
import { Logger } from '../utils/ProductionLogger';

/**
 * Hook for managing notification badge count
 * Use this to show unread notification count in UI
 */
export function useNotificationBadge() {
  const { user } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch pending notification count
   */
  const fetchBadgeCount = useCallback(async () => {
    if (!user?.id) {
      setBadgeCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const pending = await notificationManagementService.getPendingNotifications(user.id);
      const count = pending.length;

      setBadgeCount(count);

      // Update app icon badge (iOS)
      await pushNotificationService.setBadgeNumber(count);

      Logger.info('Badge count updated', {
        component: 'useNotificationBadge',
        count,
      });
    } catch (error) {
      Logger.error('Failed to fetch badge count', error as Error, {
        component: 'useNotificationBadge',
        userId: user.id,
      });
      setBadgeCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Clear badge count
   */
  const clearBadge = useCallback(async () => {
    setBadgeCount(0);
    await pushNotificationService.setBadgeNumber(0);
  }, []);

  /**
   * Increment badge count
   */
  const incrementBadge = useCallback(async () => {
    const newCount = badgeCount + 1;
    setBadgeCount(newCount);
    await pushNotificationService.setBadgeNumber(newCount);
  }, [badgeCount]);

  /**
   * Decrement badge count
   */
  const decrementBadge = useCallback(async () => {
    const newCount = Math.max(0, badgeCount - 1);
    setBadgeCount(newCount);
    await pushNotificationService.setBadgeNumber(newCount);
  }, [badgeCount]);

  // Fetch badge count on mount and when user changes
  useEffect(() => {
    fetchBadgeCount();
  }, [fetchBadgeCount]);

  // Refresh badge count every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBadgeCount();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchBadgeCount]);

  return {
    badgeCount,
    loading,
    fetchBadgeCount,
    clearBadge,
    incrementBadge,
    decrementBadge,
  };
}
