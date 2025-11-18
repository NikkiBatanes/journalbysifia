import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { notificationManagementService } from '../services/notificationManagementService';
import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { FamilyNotificationService } from '../services/FamilyNotificationService';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';

interface NotificationsScreenProps {
  navigation: any;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { badgeCount, fetchBadgeCount, clearBadge } = useNotificationBadge();
  const { acceptInvitation } = useFamilySubscription();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    if (!user?.id) {return;}

    try {
      setLoading(true);

      const userEmail = (user as any)?.email ? String((user as any).email).trim().toLowerCase() : null;

      const [queuedNotifications, inAppNotificationsRaw, familyInvitations] = await Promise.all([
        notificationManagementService.getPendingNotifications(user.id),
        FamilyNotificationService.getUnreadNotifications(user.id),
        (async () => {
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
              try {
                const { data: inviterProfile } = await supabase
                  .from('user_profiles')
                  .select('full_name, email')
                  .eq('id', invite.invited_by_user_id)
                  .single();

                inviterName = inviterProfile?.full_name || inviterProfile?.email || inviterName;
              } catch {
                // Fallback to generic label
              }

              return {
                id: invite.id,
                notification_type: 'family_invitation',
                title: 'Family Invitation',
                message: `${inviterName} invited you to join a family subscription`,
                data: {
                  invitation_code: invite.invitation_code,
                  family_group_id: invite.family_group_id,
                },
                created_at: invite.created_at,
              };
            })
          );

          return enriched;
        })(),
      ]);

      // Exclude family_invitation from in-app notifications to avoid duplicates
      const inAppNotifications = inAppNotificationsRaw.filter(
        (n: any) => n.notification_type !== 'family_invitation'
      );

      const mergedNotifications = [...inAppNotifications, ...queuedNotifications, ...familyInvitations].sort((a, b) => {
        const aTime = new Date(getNotificationTimestamp(a)).getTime();
        const bTime = new Date(getNotificationTimestamp(b)).getTime();
        return bTime - aTime;
      });

      setNotifications(mergedNotifications);
    } catch (error) {
      Logger.error('Failed to fetch notifications', error as Error, {
        component: 'NotificationsScreen',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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
      // Navigate using deep link
      if (notification.data?.deep_link) {
        notificationDeepLinkService.navigate(notification.data.deep_link);
      }

      // Mark as read/opened
      // TODO: Implement mark as read in notificationManagementService

      // Refresh badge count
      await fetchBadgeCount();
    } catch (error) {
      Logger.error('Failed to handle notification tap', error as Error, {
        component: 'NotificationsScreen',
      });
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    try {
      await clearBadge();
      setNotifications([]);
      await fetchBadgeCount();
    } catch (error) {
      Logger.error('Failed to clear notifications', error as Error, {
        component: 'NotificationsScreen',
      });
    }
  };

  // Load notifications on mount
  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
          Logger.debug('Real-time notification change in screen', {
            component: 'NotificationsScreen',
            event: payload.eventType,
          });
          // Refresh notifications list when changes occur
          fetchNotifications();
        }
      )
      .subscribe((status) => {
        Logger.debug('Notifications screen subscription status', {
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
          fetchNotifications();
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
  }, [user?.id, fetchNotifications]);

  // Handle family invitation acceptance
  const handleAcceptInvitation = async (notification: any) => {
    const invitationCode = notification.data?.invitation_code;
    if (!invitationCode) {
      Alert.alert('Error', 'Invalid invitation code');
      return;
    }

    setAcceptingInvite(notification.id);
    try {
      const success = await acceptInvitation(invitationCode);
      if (success) {
        // Mark notification as read
        await FamilyNotificationService.markAsRead(notification.id);

        // Remove from list
        setNotifications(prev => prev.filter(n => n.id !== notification.id));

        Alert.alert(
          'Welcome to the Family!',
          'You have successfully joined the family subscription with unlimited access!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('MainTabs'),
            },
          ]
        );

        await fetchBadgeCount();
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to accept invitation');
    } finally {
      setAcceptingInvite(null);
    }
  };

  // Handle family invitation decline
  const handleDeclineInvitation = async (notification: any) => {
    const invitationCode = notification.data?.invitation_code;
    if (!invitationCode) {
      Alert.alert('Error', 'Invalid invitation code');
      return;
    }

    try {
      const normalizedCode = String(invitationCode).trim().toUpperCase();

      // Look up the invitation to find who sent it
      const { data: invitation } = await supabase
        .from('family_invitations')
        .select('invited_by_user_id')
        .eq('invitation_code', normalizedCode)
        .single();

      // Mark invitation as declined
      await supabase
        .from('family_invitations')
        .update({ status: 'declined' })
        .eq('invitation_code', normalizedCode);

      // Mark in-app notification as read when applicable
      if (notification.id) {
        try {
          await FamilyNotificationService.markAsRead(notification.id);
        } catch {
          // Non-fatal
        }
      }

      // Remove from local list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      // Refresh badge count so bell updates immediately
      await fetchBadgeCount();

      // Notify inviter, if we could resolve them
      if (invitation?.invited_by_user_id) {
        const invitedName =
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.email ||
          'A member';

        await FamilyNotificationService.notifyInvitationDeclined(
          invitation.invited_by_user_id,
          invitedName
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invitation');
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      family_invitation: 'people',
      member_joined: 'person-add',
      trial_converted: 'checkmark-circle',
      prayer_reminder: 'hand-right',
      devotional_reminder: 'book',
      journal_prompt: 'create',
      streak_alert: 'flame',
      milestone_celebration: 'trophy',
      playbook_step: 'clipboard',
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

  const getNotificationTimestamp = (notification: any): string => {
    return notification.scheduled_for || notification.created_at || new Date(0).toISOString();
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
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <ThemedText weight="bold" style={styles.headerTitle}>
          Notifications
        </ThemedText>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
          >
            <ThemedText weight="medium" style={styles.clearText}>
              Clear All
            </ThemedText>
          </TouchableOpacity>
        )}
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
            const isFamilyInvitation = notification.notification_type === 'family_invitation';
            const isAccepting = acceptingInvite === notification.id;

            return (
              <View
                key={notification.id || index}
                style={styles.notificationCard}
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
                    color={getNotificationColor(notification.notification_type || notification.type)}
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

                {isFamilyInvitation ? (
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
                      onPress={() => handleAcceptInvitation(notification)}
                      disabled={isAccepting}
                    >
                      <ThemedText weight="semiBold" style={styles.acceptButtonText}>
                        {isAccepting ? 'Joining...' : 'Accept'}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineInvitation(notification)}
                      disabled={isAccepting}
                    >
                      <ThemedText weight="semiBold" style={styles.declineButtonText}>
                        Decline
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleNotificationTap(notification)}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                )}
              </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hopeWhite,
    width: '100%',
  },
  backButton: {
    padding: 8,
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
