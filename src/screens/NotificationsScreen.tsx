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
import { Logger } from '../utils/ProductionLogger';
import { testNotifications } from '../utils/testNotifications';

interface NotificationsScreenProps {
  navigation: any;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { badgeCount, fetchBadgeCount, clearBadge } = useNotificationBadge();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user?.id) return;

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
  };

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
  }, [user?.id]);

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
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
        {notifications.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
          >
            <ThemedText weight="medium" style={styles.clearText}>
              Clear All
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={async () => {
              if (sendingTest) { return; }
              setSendingTest(true);
              try {
                Logger.info('Test button pressed - starting notification test');
                
                // Ensure permissions and initialization before testing
                const { pushNotificationService } = await import('../services/pushNotificationService');
                
                Logger.info('Requesting notification permissions...');
                const hasPermissions = await pushNotificationService.requestPermissions();
                Logger.info('Permissions result:', { hasPermissions });
                
                if (user?.id) {
                  Logger.info('Initializing push notification service...');
                  await pushNotificationService.initialize(user.id);
                  Logger.info('Push notification service initialized');
                }
                
                Logger.info('Sending test notification...');
                await testNotifications.sendPrayerStreakAlert();
                
                // Add a mock notification to the UI immediately for testing
                const mockNotification = {
                  id: `test-${Date.now()}`,
                  title: "Don't Break Your 5-Day Prayer Streak! 🔥",
                  message: "You're on fire! Keep your spiritual momentum going.",
                  type: 'streak_alert',
                  data: {
                    deep_link: 'sifia://journal/prayer',
                    type: 'streak_alert',
                  },
                  scheduled_for: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                };
                
                setNotifications([mockNotification]);
                await fetchBadgeCount();
                
                // Provide immediate user feedback
                Alert.alert(
                  'Test Notification Added! 🔔', 
                  'A sample notification has been added to your list and scheduled to appear on your lock screen in 1-2 seconds.\n\nTo see the actual notification banner:\n• Lock your device, or\n• Go to home screen\n• Wait 1-2 seconds',
                  [{ text: 'OK' }]
                );
              } catch (e) {
                const error = e as Error;
                Logger.error('Test notification failed', error, { 
                  component: 'NotificationsScreen',
                  errorMessage: error.message,
                  errorStack: error.stack,
                });
                Alert.alert(
                  'Test Failed', 
                  `Unable to send test notification.\n\nError: ${error.message}\n\nPlease ensure:\n• Notification permissions are enabled\n• Testing on a real device (not simulator)\n• App has been opened at least once`,
                  [{ text: 'OK' }]
                );
              } finally {
                setSendingTest(false);
              }
            }}
            >
            <ThemedText weight="medium" style={styles.clearText}>
              {sendingTest ? 'Testing…' : 'Test'}
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
            <Ionicons name="notifications-outline" size={64} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.emptyText}>
              Loading notifications...
            </ThemedText>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textGray} />
            <ThemedText weight="medium" style={styles.emptyText}>
              No Notifications
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              You're all caught up!
            </ThemedText>
          </View>
        ) : (
          notifications.map((notification, index) => (
            <TouchableOpacity
              key={notification.id || index}
              style={styles.notificationCard}
              onPress={() => handleNotificationTap(notification)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${getNotificationColor(notification.type)}20` },
                ]}
              >
                <Ionicons
                  name={getNotificationIcon(notification.type)}
                  size={24}
                  color={getNotificationColor(notification.type)}
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
                  {formatTimeAgo(notification.scheduled_for || notification.created_at)}
                </ThemedText>
              </View>

              <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          ))
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
});

export default NotificationsScreen;
