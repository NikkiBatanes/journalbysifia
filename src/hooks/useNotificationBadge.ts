import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { notificationManagementService } from '../services/notificationManagementService';
import { pushNotificationService } from '../services/pushNotificationService';
// POST-LAUNCH: import { FamilyNotificationService } from '../services/FamilyNotificationService';
import { supabase } from '../services/supabaseClient';
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

      // POST-LAUNCH: const userEmail = (user as any)?.email ? String((user as any).email).trim().toLowerCase() : null;

      const [pendingQueue, inAppUnread] = await Promise.all([
        notificationManagementService.getPendingNotifications(user.id),
        // POST-LAUNCH: FamilyNotificationService.getUnreadNotifications(user.id),
        [] as any[], // Placeholder for family notifications
        // POST-LAUNCH: Family invitations count
      ]);

      const count = pendingQueue.length + inAppUnread.length; // POST-LAUNCH: + familyInvites.length

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
  }, [user]);

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

  // Load badge count on mount and when user changes
  useEffect(() => {
    fetchBadgeCount();
  }, [fetchBadgeCount]);

  // Real-time subscription to notifications table
  useEffect(() => {
    if (!user?.id) {return;}

    Logger.debug('Setting up real-time notification subscription', {
      component: 'useNotificationBadge',
      userId: user.id,
    });

    // Subscribe to notifications table changes for this user
    const notificationsSubscription = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          Logger.debug('Real-time notification change detected', {
            component: 'useNotificationBadge',
            event: payload.eventType,
          });
          // Refresh badge count when notifications change
          fetchBadgeCount();
        }
      )
      .subscribe((status) => {
        Logger.debug('Notification subscription status', {
          component: 'useNotificationBadge',
          status,
        });
      });

    // Subscribe to notification_queue table changes
    const queueSubscription = supabase
      .channel(`notification_queue:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          Logger.debug('Real-time queue change detected', {
            component: 'useNotificationBadge',
            event: payload.eventType,
          });
          fetchBadgeCount();
        }
      )
      .subscribe();

    // Subscribe to family_invitations table changes
    const userEmail = (user as any)?.email ? String((user as any).email).trim().toLowerCase() : null;
    let familyInvitesSubscription: any = null;

    if (userEmail) {
      familyInvitesSubscription = supabase
        .channel(`family_invitations:${userEmail}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'family_invitations',
            filter: `invited_email=eq.${userEmail}`,
          },
          (payload) => {
            Logger.debug('Real-time family invitation change detected', {
              component: 'useNotificationBadge',
              event: payload.eventType,
            });
            fetchBadgeCount();
          }
        )
        .subscribe();
    }

    // Cleanup subscriptions on unmount
    return () => {
      Logger.debug('Cleaning up notification subscriptions', {
        component: 'useNotificationBadge',
      });
      notificationsSubscription.unsubscribe();
      queueSubscription.unsubscribe();
      if (familyInvitesSubscription) {
        familyInvitesSubscription.unsubscribe();
      }
    };
  }, [user?.id, user, fetchBadgeCount]);

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
