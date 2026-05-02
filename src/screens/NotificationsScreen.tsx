import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { notificationManagementService } from '../services/notificationManagementService';
// import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
// POST-LAUNCH: import { FamilyNotificationService } from '../services/FamilyNotificationService';
import { notificationAnalyticsService } from '../services/notificationAnalyticsService';
import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
// POST-LAUNCH: import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { triggerLightHaptic } from '../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationsScreenProps {
  navigation: any;
}

const getNotificationTimestamp = (notification: any): string => {
  return notification.created_at || notification.scheduled_for || new Date(0).toISOString();
};

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

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { fetchBadgeCount, clearBadge } = useNotificationBadge();
  // POST-LAUNCH: const { acceptInvitation } = useFamilySubscription();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessingTap, setIsProcessingTap] = useState(false);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());
  // POST-LAUNCH: const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    if (!user?.id) {return;}

    try {
      setLoading(true);

      // Clear notification cache
      try {
        await AsyncStorage.removeItem('notification_queue');
        await AsyncStorage.removeItem('notifications:lastScheduled');
      } catch (e) {
        console.log('Failed to clear cache:', e);
      }

      // POST-LAUNCH: const userEmail = (user as any)?.email ? String((user as any)?.email).trim().toLowerCase() : null;

      const [queuedNotifications, inAppNotificationsRaw, pushNotifications] = await Promise.all([
        // POST-LAUNCH: familyInvitations
        notificationManagementService.getPendingNotifications(user.id),
        // POST-LAUNCH: FamilyNotificationService.getUnreadNotifications(user.id),
        [] as any[], // Placeholder for family notifications
        // NEW: Fetch push notifications from the notifications table
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false) // Only fetch unread notifications
          .order('created_at', { ascending: false })
          .limit(50),
        // POST-LAUNCH: Family invitations
        /* (async () => {
          if (!userEmail) {return [] as any[];}

          const { data, error } = await supabase
            .from('family_invitations')
            .select('*')
            .eq('invited_email', userEmail)
            .eq('status', 'pending');

          if (error || !data) {return [] as any[];}

          // Enrich invitations with inviter name/email
          const enriched = await Promise.all(
            data.map(async (invite: any) => {
              let inviterName = 'Family admin';
              let inviterFullName = '';
              try {
                const { data: inviterProfile } = await supabase
                  .from('user_profiles')
                  .select('full_name, email')
                  .eq('id', invite.invited_by_user_id)
                  .single();

                if (inviterProfile?.full_name) {
                  inviterFullName = inviterProfile.full_name;
                  inviterName = inviterProfile.full_name;
                } else if (inviterProfile?.email) {
                  inviterName = inviterProfile.email;
                }
              } catch {
                // Fallback to generic label
              }

              return {
                id: invite.id,
                notification_type: 'family_invitation',
                title: 'Family Invitation',
                message: inviterFullName
                  ? `${inviterFullName} invited you to join a family subscription`
                  : `${inviterName} invited you to join a family subscription`,
                data: {
                  invitation_code: invite.invitation_code,
                  family_group_id: invite.family_group_id,
                },
                created_at: invite.created_at,
              };
            })
          );

          return enriched;
        })(), */
      ]);

      // Exclude family_invitation from in-app notifications to avoid duplicates
      const inAppNotifications = inAppNotificationsRaw.filter(
        (n: any) => n.notification_type !== 'family_invitation'
      );

      // Extract push notifications data
      const pushNotificationsData = (pushNotifications.data || []).map((notification: any) => ({
        ...notification,
        _notification_source: 'notifications',
      }));
      const queuedNotificationsData = queuedNotifications.map((notification: any) => ({
        ...notification,
        _notification_source: 'queue',
      }));
      const pushNotificationKeys = new Set(
        pushNotificationsData.flatMap((notification: any) => [
          getNotificationIdentity(notification),
          getLooseNotificationIdentity(notification),
        ])
      );
      const visibleQueuedNotificationsData = queuedNotificationsData.filter((notification: any) => {
        return !pushNotificationKeys.has(getNotificationIdentity(notification)) &&
          !pushNotificationKeys.has(getLooseNotificationIdentity(notification));
      });

      // Merge all notification sources and sort by timestamp (newest first)
      // POST-LAUNCH: Add familyInvitations back
      const mergedNotifications = [...inAppNotifications, ...visibleQueuedNotificationsData, ...pushNotificationsData].sort((a, b) => {
        const aTime = new Date(getNotificationTimestamp(a)).getTime();
        const bTime = new Date(getNotificationTimestamp(b)).getTime();
        return bTime - aTime; // Descending: newer timestamps (larger numbers) appear first
      });

      // Filter out locally dismissed notifications
      const filteredNotifications = mergedNotifications.filter(n => !locallyDismissedIds.has(n.id));

      console.log('🔔 DEBUG: Final notifications count:', filteredNotifications.length);
      console.log('🔔 DEBUG: Full notification details:', JSON.stringify(filteredNotifications, null, 2));

      setNotifications(filteredNotifications);
    } catch (error) {
      Logger.error('Failed to fetch notifications', error as Error, {
        component: 'NotificationsScreen',
      });
    } finally {
      setLoading(false);
    }
  }, [user, locallyDismissedIds]);

  // Refresh notifications
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    await fetchBadgeCount();
    setRefreshing(false);
  };

  // Handle notification tap
  const handleNotificationTap = async (notification: any) => {
    try {
      // Set processing flag to prevent real-time subscription interference
      setIsProcessingTap(true);

      // Add haptic feedback
      triggerLightHaptic();

      // Mark notification as read immediately and remove from local state
      if (notification.id && !notification.is_read && user?.id) {
        // Add to locally dismissed set to prevent re-fetching
        setLocallyDismissedIds(prev => new Set(prev).add(notification.id));

        // Update local state immediately for instant UI feedback
        setNotifications(prev =>
          prev.filter(n => n.id !== notification.id)
        );

        // Mark as read in database (fire-and-forget to not block navigation)
        if (notification._notification_source === 'notifications') {
          supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notification.id)
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (error) {
                Logger.error('Failed to mark push notification as read', error, {
                  component: 'NotificationsScreen',
                  notificationId: notification.id,
                });
              } else {
                // Remove from locally dismissed set after successful DB update
                setLocallyDismissedIds(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(notification.id);
                  return newSet;
                });
              }
            });
        } else if (notification._notification_source === 'queue') {
          notificationManagementService.markNotificationAsRead(notification.id, user.id).then(success => {
            if (success) {
              // Remove from locally dismissed set after successful DB update
              setLocallyDismissedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(notification.id);
                return newSet;
              });
            }
          });
        }
      }

      // Track analytics (tapped event)
      if (notification.id) {
        notificationAnalyticsService.trackTapped(notification.id).catch(error => {
          Logger.error('Failed to track notification tap', error as Error, {
            component: 'NotificationsScreen',
          });
        });
      }

      // Navigate using deep link
      if (notification.data?.deep_link) {
        notificationDeepLinkService.navigate(notification.data.deep_link);
      } else {
        // Smart fallback navigation based on notification type
        const notificationType = notification.type || notification.notification_type;
        let targetScreen: string | null = null;

        switch (notificationType) {
          case 'REMINDER':
            if (notification.data?.type === 'prayer_reminder') {
              targetScreen = 'Journal'; // Navigate to Journal for prayer reminders
            } else if (notification.data?.type === 'devotional_reminder') {
              targetScreen = 'Devotionals'; // Navigate to Devotionals for devotional reminders
            } else {
              targetScreen = 'Journal'; // Default for reminders
            }
            break;
          case 'ACHIEVEMENT':
            targetScreen = 'MainTabs'; // Navigate to main tabs (Dashboard is nested inside)
            break;
          case 'ACTIVITY':
            targetScreen = 'Journal'; // Navigate to Journal for prayer requests
            break;
          case 'PROMOTIONAL':
            targetScreen = 'MainTabs'; // Navigate to main tabs (Dashboard is nested inside)
            break;
          case 'SYSTEM':
            targetScreen = 'MainTabs'; // Navigate to main tabs (Dashboard is nested inside)
            break;
          default:
            // For notifications, navigate to Journal as default
            targetScreen = 'Journal';
        }

        if (targetScreen) {
          // Reset to main tabs and navigate to specific tab
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });

          // Navigate to the specific tab after reset
          setTimeout(() => {
            navigation.navigate('MainTabs', { screen: targetScreen });
          }, 100);
        }
      }

      // Refresh badge count
      fetchBadgeCount().catch(error => {
        Logger.error('Failed to refresh badge count', error as Error, {
          component: 'NotificationsScreen',
        });
      });

      // Clear processing flag after a short delay to allow database operations to complete
      setTimeout(() => {
        setIsProcessingTap(false);
      }, 1000);
    } catch (error) {
      Logger.error('Failed to handle notification tap', error as Error, {
        component: 'NotificationsScreen',
      });
      setIsProcessingTap(false);
    }
  };

  // Clear all notifications (except pending family invitations)
  const handleClearAll = async () => {
    if (!user?.id) {return;}

    // Add haptic feedback
    triggerLightHaptic();

    try {
      // Mark all unread notifications as read for this user
      const { error: notifError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .select('id');

      if (notifError) {
        Logger.error('Failed to mark notifications as read in Supabase', notifError, {
          component: 'NotificationsScreen',
          errorDetails: {
            message: notifError.message,
            details: notifError.details,
            hint: notifError.hint,
            code: notifError.code,
          },
        });
      } else {
        Logger.info('Marked notifications as read', {
          component: 'NotificationsScreen',
          userId: user.id,
        });
      }

      // Mark delivered queue notifications as read without cancelling future reminders.
      const clearedQueue = await notificationManagementService.markAllNotificationsAsRead(user.id);
      if (clearedQueue) {
        Logger.info('Marked delivered queue notifications as read', {
          component: 'NotificationsScreen',
          userId: user.id,
        });
      } else {
        Logger.error('Failed to clear delivered notifications from queue', undefined, {
          component: 'NotificationsScreen',
          userId: user.id,
        });
      }

      // Clear badge immediately for instant UI update
      await clearBadge();

      // Refresh the notification list
      await fetchNotifications();

      Logger.info('Cleared all notifications except pending family invitations', {
        component: 'NotificationsScreen',
      });
    } catch (error) {
      Logger.error('Failed to clear notifications', error as Error, {
        component: 'NotificationsScreen',
      });
    }
  };

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh whenever the screen comes back into focus (handles navigate-back case)
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // Instant refresh when a notification is saved in-process (bypasses Supabase realtime)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('notification_saved', () => {
      fetchNotifications();
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  // Track opened analytics when notifications change
  useEffect(() => {
    const trackOpened = async () => {
      if (notifications.length > 0) {
        // Track opened for all unread notifications
        for (const notification of notifications) {
          if (notification.id && !notification.is_read) {
            await notificationAnalyticsService.trackOpened(notification.id);
          }
        }
      }
    };

    trackOpened();
  }, [notifications]);

  // Real-time subscription to notifications, queue, and family invitations
  useEffect(() => {
    if (!user?.id) {return;}

    Logger.debug('Setting up real-time notification subscription for screen', {
      component: 'NotificationsScreen',
      userId: user.id,
    });

    // Subscribe to notifications table changes
    const notificationsSubscription = supabase
      .channel(`notifications_screen:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          Logger.info('Real-time notification change in screen', {
            component: 'NotificationsScreen',
            event: payload.eventType,
            payload: JSON.stringify(payload),
          });
          // Skip refresh if user is currently tapping a notification to prevent interference
          if (!isProcessingTap) {
            fetchNotifications();
          }
        }
      )
      .subscribe((status) => {
        Logger.info('Notifications screen subscription status', {
          component: 'NotificationsScreen',
          status,
        });
      });

    // Subscribe to notification_queue table changes
    const queueSubscription = supabase
      .channel(`queue_screen:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          Logger.debug('Real-time queue change in screen', {
            component: 'NotificationsScreen',
            event: payload.eventType,
          });
          // Skip refresh if user is currently tapping a notification to prevent interference
          if (!isProcessingTap) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    // Subscribe to family_invitations changes for this user (by email)
    const userEmail = (user as any)?.email ? String((user as any).email).trim().toLowerCase() : null;
    const familyInvitesSubscription = userEmail
      ? supabase
          .channel(`family_invitations_screen:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'family_invitations',
              filter: `invited_email=eq.${userEmail}`,
            },
            (payload) => {
              Logger.debug('Real-time family invitation change in screen', {
                component: 'NotificationsScreen',
                event: payload.eventType,
              });
              fetchNotifications();
            }
          )
          .subscribe()
      : null;

    // Cleanup subscriptions
    return () => {
      Logger.debug('Cleaning up notification screen subscriptions', {
        component: 'NotificationsScreen',
      });
      notificationsSubscription.unsubscribe();
      queueSubscription.unsubscribe();
      familyInvitesSubscription?.unsubscribe();
    };
  }, [user, fetchNotifications, isProcessingTap]);

  // POST-LAUNCH: Handle family invitation acceptance
  /* const handleAcceptInvitation = async (notification: any) => {
    const invitationCode = notification.data?.invitation_code;
    if (!invitationCode) {
      Alert.alert('Error', 'Invalid invitation code');
      return;
    }

    setAcceptingInvite(notification.id);
    try {
      await acceptInvitation(invitationCode);

      // Mark notification as read
      if (notification.id) {
        try {
          await FamilyNotificationService.markAsRead(notification.id);
        } catch (markError) {
          Logger.warn('Failed to mark notification as read after accept', {
            component: 'NotificationsScreen',
          });
        }
      }

      // Refresh the notification list and badge
      await fetchNotifications();
      await fetchBadgeCount();

      Alert.alert(
        'Welcome to the Family!',
        'You have successfully joined the family subscription.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Go back to previous screen (Dashboard)
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Logger.error('Failed to accept family invitation', error as Error, {
        component: 'NotificationsScreen',
        invitationCode,
      });
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to accept invitation. Please try again or contact support.'
      );
    } finally {
      setAcceptingInvite(null);
    }
  }; */

  // POST-LAUNCH: Handle family invitation decline
  /* const handleDeclineInvitation = async (notification: any) => {
    const invitationCode = notification.data?.invitation_code;
    if (!invitationCode) {
      Alert.alert('Error', 'Invalid invitation code');
      return;
    }

    try {
      const normalizedCode = String(invitationCode).trim().toUpperCase();

      // Look up the invitation to find who sent it
      const { data: invitation, error: lookupError } = await supabase
        .from('family_invitations')
        .select('invited_by_user_id')
        .eq('invitation_code', normalizedCode)
        .eq('status', 'pending')
        .single();

      if (lookupError || !invitation) {
        Logger.error('Failed to find invitation', lookupError as Error, {
          component: 'NotificationsScreen',
          invitationCode: normalizedCode,
        });
        Alert.alert('Error', 'Invitation not found or already processed.');
        return;
      }

      // Mark invitation as declined
      const { data: declineResult, error: declineError } = await supabase
        .from('family_invitations')
        .update({ status: 'declined' })
        .eq('invitation_code', normalizedCode)
        .eq('status', 'pending')
        .select();

      if (declineError) {
        Logger.error('Failed to decline invitation', undefined, {
          component: 'NotificationsScreen',
          supabaseError: {
            code: (declineError as any).code,
            message: (declineError as any).message,
            details: (declineError as any).details,
            hint: (declineError as any).hint,
          },
        });
        Alert.alert('Error', 'Failed to decline invitation. Please try again.');
        return;
      }

      if (!declineResult || declineResult.length === 0) {
        Logger.error('Decline update returned no rows - invitation may not exist or already processed', undefined, {
          component: 'NotificationsScreen',
          invitationCode: normalizedCode,
        });
        Alert.alert('Error', 'Invitation not found or already processed.');
        return;
      }

      Logger.info('Invitation declined successfully', {
        component: 'NotificationsScreen',
        invitationCode: normalizedCode,
        updatedRows: declineResult.length,
      });

      // Mark in-app notification as read
      if (notification.id) {
        try {
          await FamilyNotificationService.markAsRead(notification.id);
        } catch (markError) {
          Logger.warn('Failed to mark notification as read after decline', {
            component: 'NotificationsScreen',
          });
        }
      }

      // Refresh the notification list and badge
      await fetchNotifications();
      await fetchBadgeCount();

      // Notify inviter
      if (invitation.invited_by_user_id) {
        const invitedName =
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.email ||
          'A member';

        try {
          await FamilyNotificationService.notifyInvitationDeclined(
            invitation.invited_by_user_id,
            invitedName
          );

          Logger.info('Family invitation declined and inviter notified', {
            component: 'NotificationsScreen',
            inviterId: invitation.invited_by_user_id,
            invitedName,
          });
        } catch (notifyError) {
          Logger.warn('Failed to notify inviter of decline', {
            component: 'NotificationsScreen',
          });
        }
      }

      Alert.alert('Invitation Declined', 'The invitation has been declined.');
    } catch (error) {
      Logger.error('Failed to decline family invitation', error as Error, {
        component: 'NotificationsScreen',
        invitationCode,
      });
      Alert.alert('Error', 'Failed to decline invitation. Please try again.');
    }
  }; */

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      family_invitation: 'people',
      member_joined: 'person-add',
      trial_converted: 'checkmark-circle',
      prayer_reminder: 'hand-right',
      devotional_reminder: 'book',
      devotional_day_ready: 'book',
      devotional_prayer_prompt: 'hand-right',
      devotional_reflection_prompt: 'create',
      devotional_verse_revisit: 'bookmarks',
      devotional_completed_reflection: 'sparkles',
      journal_prompt: 'create',
      journal_todays_focus: 'flag',
      journal_todo: 'checkbox',
      journal_gratitude: 'heart',
      journal_todays_win: 'trophy',
      journal_looking_forward: 'moon',
      heart_journal_prompt: 'heart-circle',
      streak_alert: 'flame',
      milestone_celebration: 'trophy',
      playbook_step: 'clipboard',
      playbook_word_to_speak: 'megaphone',
      playbook_faithful_action: 'footsteps',
      playbook_verse_revisit: 'bookmarks',
      playbook_prayer_revisit: 'hand-right',
      playbook_to_devotional: 'book',
      playbook_actions_complete: 'trophy',
      playbook_actions_milestone: 'trending-up',
      prayer_request_care: 'people',
      prayer_today: 'hand-right',
      create_devotional: 'add-circle',
      create_playbook: 'add-circle',
      create_first_devotional: 'add-circle',
      create_first_playbook: 'add-circle',
      usage_room_devotional: 'leaf',
      usage_room_playbook: 'leaf',
      content_refresh_wait: 'hourglass',
      upgrade_room: 'sparkles',
      trial_notification: 'time',
      weekly_summary: 'stats-chart',
    };
    return iconMap[type] || 'notifications';
  };

  // Get color for notification type
  const getNotificationColor = (type: string) => {
    if (type.includes('celebration') || type.includes('milestone')) {
      return Colors.faithGold;
    }
    if (type.includes('streak')) {
      return Colors.alertCoral;
    }
    if (type.includes('trial')) {
      return Colors.alertCoral;
    }
    return Colors.anchorBlue;
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {return 'Just now';}
    if (diffMins < 60) {return `${diffMins}m ago`;}
    if (diffHours < 24) {return `${diffHours}h ago`;}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { triggerLightHaptic(); navigation.goBack(); }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <ThemedText weight="bold" style={styles.headerTitle}>
          Notifications
        </ThemedText>
        <View style={styles.headerActions}>
          {/* Only show Clear All if there are notifications */}
          {notifications.length > 0 ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
            >
              <ThemedText weight="medium" style={styles.clearText}>
                Clear All
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={48} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.emptyText}>
              Loading notifications...
            </ThemedText>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={40} color={Colors.textGray} />
            <ThemedText weight="medium" style={styles.emptyText}>
              No Notifications
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              You're all caught up!
            </ThemedText>
          </View>
        ) : (
          notifications.map((notification, index) => {
            // POST-LAUNCH: Family invitation handling removed - restore from feature/family-subscription branch

            return (
              <TouchableOpacity
                key={notification.id || index}
                style={styles.notificationCard}
                onPress={() => {
                  handleNotificationTap(notification);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${getNotificationColor(notification.notification_type || notification.type)}20` },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(notification.notification_type || notification.type)}
                    size={24}
                    color={Colors.hopeWhite}
                  />
                </View>

                <View style={styles.notificationContent}>
                  <ThemedText weight="semiBold" style={styles.notificationTitle}>
                    {notification.title}
                  </ThemedText>
                  <ThemedText style={styles.notificationMessage}>
                    {notification.message}
                  </ThemedText>
                  <ThemedText style={styles.notificationTime}>
                    {formatTimeAgo(getNotificationTimestamp(notification))}
                  </ThemedText>
                </View>

                <View style={styles.chevronContainer}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.anchorBlue,
    width: '100%',
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 14,
    color: Colors.alertCoral,
  },
  badgeContainer: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 8,
    opacity: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: Colors.hopeWhite,
    marginBottom: 4,
    opacity: 0.8,
  },
  notificationTime: {
    fontSize: 11,
    color: Colors.alertCoral,
    opacity: 0.9,
  },
  chevronContainer: {
    justifyContent: 'center',
  },
  invitationCode: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.faithGold,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  acceptButton: {
    backgroundColor: Colors.growthGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 12,
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.textGray,
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  inviteActions: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  declineButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    backgroundColor: 'transparent',
  },
  declineButtonText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
});

export default NotificationsScreen;
