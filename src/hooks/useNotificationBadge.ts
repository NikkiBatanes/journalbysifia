import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { notificationManagementService } from '../services/notificationManagementService';
import { pushNotificationService } from '../services/pushNotificationService';
// POST-LAUNCH: import { FamilyNotificationService } from '../services/FamilyNotificationService';
import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';

const getNotificationData = (notification: any): Record<string, any> => {
  return notification?.data && typeof notification.data === 'object' ? notification.data : {};
};

const getNotificationIdentity = (notification: any): string => {
  const data = getNotificationData(notification);
  const queueNotificationId = data.notification_id || data.queue_notification_id;
  if (typeof queueNotificationId === 'string' && queueNotificationId.length > 0) {
    return `queue:${queueNotificationId}`;
  }

  if (typeof data.dedupe_key === 'string' && data.dedupe_key.length > 0) {
    return `dedupe:${data.dedupe_key}`;
  }

  const sourceKey = data.source_id || data.deep_link || '';
  return [
    notification.title || '',
    notification.message || '',
    sourceKey,
  ].map(value => String(value).trim().toLowerCase()).join('|');
};

const getLooseNotificationIdentity = (notification: any): string => {
  return [
    notification.title || '',
    notification.message || '',
  ].map(value => String(value).trim().toLowerCase()).join('|');
};

/**
 * Hook for managing notification badge count
 * Use this to show unread notification count in UI
 */
export function useNotificationBadge() {
  const { user } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isClearingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch pending notification count
   */
  const fetchBadgeCount = useCallback(async () => {
    if (!user?.id) {
      setBadgeCount(0);
      setLoading(false);
      return;
    }

    // Skip fetching if we're in the middle of a clear operation
    // This prevents race conditions with real-time subscriptions
    if (isClearingRef.current) {
      Logger.debug('Skipping fetchBadgeCount during clear operation', {
        component: 'useNotificationBadge',
        userId: user.id,
      });
      return;
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce the fetch to prevent rapid successive calls
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);

      // POST-LAUNCH: const userEmail = (user as any)?.email ? String((user as any).email).trim().toLowerCase() : null;

      const [pendingQueue, inAppUnread, pushNotificationsUnread] = await Promise.all([
        notificationManagementService.getPendingNotifications(user.id),
        // POST-LAUNCH: FamilyNotificationService.getUnreadNotifications(user.id),
        [] as any[], // Placeholder for family notifications
        // NEW: Fetch unread push notifications from the notifications table
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        // POST-LAUNCH: Family invitations count
      ]);

      const pushNotificationsData = pushNotificationsUnread.data || [];
      const pushNotificationKeys = new Set(
        pushNotificationsData.flatMap(notification => [
          getNotificationIdentity(notification),
          getLooseNotificationIdentity(notification),
        ])
      );
      const visiblePendingQueue = pendingQueue.filter(notification => {
        return !pushNotificationKeys.has(getNotificationIdentity(notification)) &&
          !pushNotificationKeys.has(getLooseNotificationIdentity(notification));
      });
      const pushNotificationsCount = pushNotificationsData.length;
      const count = visiblePendingQueue.length + inAppUnread.length + pushNotificationsCount; // POST-LAUNCH: + familyInvites.length

      setBadgeCount(count);

      // Update app icon badge (iOS)
      await pushNotificationService.setBadgeNumber(count);

      Logger.info('Badge count updated', {
        component: 'useNotificationBadge',
        count,
        breakdown: {
          pendingQueue: visiblePendingQueue.length,
          inAppUnread: inAppUnread.length,
          pushNotificationsUnread: pushNotificationsCount,
        },
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
      }, 300); // 300ms debounce delay
    }, [user?.id]);

  /**
   * Clear badge count
   */
  const clearBadge = useCallback(async () => {
    if (!user?.id) {
      setBadgeCount(0);
      await pushNotificationService.setBadgeNumber(0);
      return;
    }

    try {
      // Set clearing flag to prevent race conditions with real-time subscriptions
      isClearingRef.current = true;

      // Update local state IMMEDIATELY for instant UI feedback
      setBadgeCount(0);
      await pushNotificationService.setBadgeNumber(0);

      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Clear all unread notifications in database
      await Promise.all([
        // Mark all push notifications as read
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false),

        // Mark all queue notifications as read
        notificationManagementService.markAllNotificationsAsRead(user.id),
      ]);

      Logger.info('Badge cleared and all notifications marked as read', {
        component: 'useNotificationBadge',
        userId: user.id,
      });
    } catch (error) {
      Logger.error('Failed to clear badge and notifications', error as Error, {
        component: 'useNotificationBadge',
        userId: user.id,
      });
      // Badge already set to 0 above, no need to repeat
    } finally {
      // Clear the flag after a longer delay to allow real-time subscriptions to settle
      setTimeout(() => {
        isClearingRef.current = false;
        // Force one final refresh to ensure consistency
        fetchBadgeCount();
      }, 1000); // Increased from 500ms to 1000ms
    }
  }, [user?.id, fetchBadgeCount]);

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
  }, [user, fetchBadgeCount]);

  // Refresh badge count every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBadgeCount();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchBadgeCount]);

  // Instant badge refresh when a notification is saved in-process
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('notification_saved', () => {
      fetchBadgeCount();
    });
    return () => sub.remove();
  }, [fetchBadgeCount]);

  // Cleanup timeout and clearing flag on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      isClearingRef.current = false;
    };
  }, []);

  return {
    badgeCount,
    loading,
    fetchBadgeCount,
    clearBadge,
    incrementBadge,
    decrementBadge,
  };
}
