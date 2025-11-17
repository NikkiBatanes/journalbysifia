import React, { useState } from 'react';
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
      const pending = await notificationManagementService.getPendingNotifications(user.id);
      setNotifications(pending);
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

      {/* Badge Count */}
      {badgeCount > 0 && (
        <View style={styles.badgeContainer}>
          <ThemedText weight="medium" style={styles.badgeText}>
            {badgeCount} pending notification{badgeCount !== 1 ? 's' : ''}
          </ThemedText>
        </View>
      )}

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
                  {isFamilyInvitation && notification.data?.invitation_code && (
                    <ThemedText style={styles.invitationCode}>
                      Code: {notification.data.invitation_code}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.notificationTime}>
                    {formatTimeAgo(notification.scheduled_for || notification.created_at)}
                  </ThemedText>
                </View>

                {isFamilyInvitation ? (
                  <TouchableOpacity
                    style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
                    onPress={() => handleAcceptInvitation(notification)}
                    disabled={isAccepting}
                  >
                    <ThemedText weight="semiBold" style={styles.acceptButtonText}>
                      {isAccepting ? 'Joining...' : 'Accept'}
                    </ThemedText>
                  </TouchableOpacity>
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
});

export default NotificationsScreen;
