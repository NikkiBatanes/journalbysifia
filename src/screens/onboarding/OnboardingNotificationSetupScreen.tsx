import React, { useState, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { pushNotificationService } from '../../services/pushNotificationService';
import { supabase } from '../../services/supabaseClient';
import ThemedText from '../../components/common/ThemedText';

interface RouteParams {
  userType: 'trial' | 'paid' | 'freemium';
  tier?: string;
}

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  required?: boolean;
}

const OnboardingNotificationSetupScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useNewSubscription(user?.id || '');
  const { userType, tier } = (route.params as RouteParams) || {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown'); // Used in lines 83-89

  // Derive display name for welcome message (first name only)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const displayName = (() => {
    // Try first_name first
    const firstName = (user as any)?.user_metadata?.first_name?.trim();
    if (firstName) {
      return firstName;
    }

    // Try to extract first name from full_name
    const fullName = user?.user_metadata?.full_name;
    if (fullName) {
      const firstNameFromFull = String(fullName).trim().split(/\s+/)[0];
      if (firstNameFromFull) {
        return firstNameFromFull;
      }
    }

    // Extract from email if needed
    if (user?.email) {
      const emailUsername = user.email.split('@')[0];
      // Simple extraction - capitalize first letter
      return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
    }

    return 'Friend';
  })();

  useEffect(() => {
    // Refresh subscription data when screen loads
    if (user?.id) {
      refreshSubscription();
    }
  }, [user?.id, refreshSubscription]);

  // Enterprise-grade permission status checking
  useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        setPermissionStatus('checking');
        const hasPermissions = await pushNotificationService.checkPermissions();
        setPermissionStatus(hasPermissions ? 'granted' : 'unknown');
      } catch (error) {
        Logger.error('Error checking notification permissions', error as Error, { component: 'OnboardingNotificationSetupScreen' });
        setPermissionStatus('unknown');
      }
    };

    checkPermissionStatus();
  }, []);

  // Determine effective user type from subscription or route params
  const effectiveUserType = userType || (subscription?.tier === 'free_trial' ? 'trial' : 'freemium');

  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([
    {
      id: 'playbooks',
      title: 'Playbooks',
      description: 'Gentle reminders for the steps and invitations in your playbooks',
      icon: 'albums-outline',
      enabled: true,
    },
    {
      id: 'daily_devotional',
      title: 'Devotionals',
      description: 'Soft prompts to begin your day with Scripture and reflection',
      icon: 'book-outline',
      enabled: true,
      required: false,
    },
    {
      id: 'journal_reminders',
      title: 'Journal Reminders',
      description: 'Occasional nudges to pause, reflect, and write',
      icon: 'create-outline',
      enabled: false,
    },
    {
      id: 'prayer_reminders',
      title: 'Prayer Reminders',
      description: 'Gentle invitations to return to prayer',
      icon: 'heart-outline',
      enabled: true,
    },
    {
      id: 'progress_updates',
      title: 'Progress Updates',
      description: 'Quiet celebrations of growth and faithfulness',
      icon: 'trending-up-outline',
      enabled: true,
    },
    {
      id: 'trial_reminders',
      title: 'Trial Reminders',
      description: 'Helpful updates so you can decide with peace',
      icon: 'time-outline',
      enabled: false,
      required: false,
    },
    {
      id: 'prayer_request_alerts',
      title: 'Prayer Request Alerts',
      description: 'Notifications when prayer requests need care and attention',
      icon: 'notifications-outline',
      enabled: true,
    },
  ]);

  const handleToggleSetting = (id: string) => {
    try { triggerLightHaptic(); } catch {}
    setNotificationSettings(prev =>
      prev.map(setting => {
        if (setting.id === id && !setting.required) {
          return { ...setting, enabled: !setting.enabled };
        }
        return setting;
      })
    );
  };

  const handleEnableNotifications = async () => {
    try {
      try { triggerSuccessHaptic(); } catch {}

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Initialize push notification service
      await pushNotificationService.initialize(user.id);

      // Request permissions
      const permissionsGranted = await pushNotificationService.requestPermissions();

      // Ensure device token is registered after permissions are granted
      if (permissionsGranted) {
        const storedToken = await pushNotificationService.getStoredToken();
        if (storedToken) {
          await pushNotificationService.saveDeviceToken(user.id, storedToken);
        }
      }

      if (permissionsGranted) {

        // Save notification preferences to Supabase
        const enabledSettings = notificationSettings
          .filter(setting => setting.enabled)
          .reduce((acc, setting) => {
            acc[setting.id] = true;
            return acc;
          }, {} as Record<string, boolean>);

        // Save preferences to notification_preferences table
        try {
          // Detect user's device timezone
          const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

          const { error: prefsError } = await supabase
            .from('notification_preferences')
            .upsert({
              user_id: user.id,
              notification_type: 'user_preferences', // Required field
              prayer_reminders: enabledSettings.prayer_reminders || false,
              playbook_steps: enabledSettings.playbooks || false,
              devotional_reminders: enabledSettings.daily_devotional || false,
              journal_prompts: enabledSettings.journal_reminders || false,
              milestone_celebrations: enabledSettings.progress_updates || false,
              trial_notifications: enabledSettings.trial_reminders || false,
              streak_alerts: enabledSettings.progress_updates || false,
              prayer_requests: enabledSettings.prayer_request_alerts || false,
              prayer_request_alerts: enabledSettings.prayer_request_alerts || false,
              timezone: deviceTimezone,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,notification_type',
            });

          if (prefsError) {
            Logger.error('Error saving notification preferences', prefsError as Error, {
  component: 'OnboardingNotificationSetupScreen',
});
          } else {

          }
        } catch (prefsError) {
          Logger.error('Error saving notification preferences', prefsError as Error, {
  component: 'OnboardingNotificationSetupScreen',
});
        }

        Alert.alert(
          '✨Notifications enabled',
          'You\'ll receive gentle reminders to help you return, reflect, and stay connected with God.',
          [
            {
              text: 'Let\'s go',
              onPress: () => {
                // Navigate to UserInput after notification setup (post-purchase)
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'UserInput' as any }],
                });
              },
            },
          ]
        );
      } else {
        // Permissions denied
        Alert.alert(
          'Notifications Not Enabled',
          'You can always enable notifications later in your device settings or profile.',
          [
            {
              text: 'Continue Anyway',
              onPress: () => {
                // Navigate to UserInput after notification setup (post-purchase)
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'UserInput' as any }],
                });
              },
            },
            {
              text: 'Open Settings',
              onPress: () => pushNotificationService.openNotificationSettings(),
            },
          ]
        );
      }

    } catch (error) {
      Logger.error('Error setting up notifications', error as Error, { component: 'OnboardingNotificationSetupScreen' });
      Alert.alert(
        'Setup Complete',
        'You can always enable notifications later in your profile settings.',
        [
          {
            text: 'Let\'s Go!',
            onPress: () => {
              // Navigate to UserInput after notification setup (post-purchase)
              navigation.reset({
                index: 0,
                routes: [{ name: 'UserInput' as any }],
              });
            },
          },
          {
            text: 'Open Settings',
            onPress: () => pushNotificationService.openNotificationSettings(),
          },
        ]
      );
    }
  };

  const handleSkip = () => {
    try { triggerLightHaptic(); } catch {}
    Alert.alert(
      'Skip Notifications?',
      'You can always enable notifications later in your profile settings.',
      [
        {
          text: 'Go Back',
          style: 'cancel',
        },
        {
          text: 'Skip',
          onPress: () => {
            // Navigate to UserInput after notification setup (post-purchase)
            navigation.reset({
              index: 0,
              routes: [{ name: 'UserInput' as any }],
            });
          },
        },
      ]
    );
  };

  const getWelcomeMessage = () => {
    // If user cancelled sales offer, they should be seeker regardless of subscription tier
    const fromCancelledSales = (route.params as any)?.fromCancelledSales;
    if (fromCancelledSales) {
      return {
        title: 'Welcome to siFia',
        subtitle: 'Your free Seeker plan includes 2 playbooks and 1 devotional each month.\nMove at a pace that feels right for your season.',
        badge: 'Free Access',
      };
    }

    const currentTier = subscription?.tier || tier || 'seeker';
    const baseTier = currentTier.replace('_annual', '');
    const trialChosenTier = (subscription as any)?.trial_chosen_tier?.replace('_annual', '') || 'growth';
    const trialLimits =
      trialChosenTier === 'spark' ? { playbooks: 5, devotionals: 5 } :
      trialChosenTier === 'transformation' ? { playbooks: 25, devotionals: 25 } :
      { playbooks: 15, devotionals: 15 };

    switch (baseTier) {
      case 'free_trial':
        return {
          title: 'Make the Most of Your Free Trial',
          subtitle: `Get timely reminders for your ${trialLimits.playbooks} playbooks and ${trialLimits.devotionals} devotionals over the next 3 days.`,
          badge: '3-Day Trial Active',
        };
      case 'spark':
        return {
          title: 'Welcome to Spark',
          subtitle: 'Get reminders for your 10 monthly playbooks, 10 devotionals, and journaling.',
          badge: 'Spark Subscriber',
        };
      case 'growth':
        return {
          title: 'Welcome to Growth',
          subtitle: 'Make the most of your 25 monthly playbooks and 25 devotionals with helpful reminders.',
          badge: 'Growth Subscriber',
        };
      case 'transformation':
        return {
          title: 'Welcome to siFia Transformation',
          subtitle: 'Enjoy 60 monthly playbooks and 60 devotionals with gentle reminders to support your daily walk.',
          badge: 'Transformation Subscriber',
        };
      // POST-LAUNCH: Family tier removed
      // case 'family':
      //   return {
      //     title: 'Welcome to siFia Family',
      //     subtitle: 'Keep your family connected with notifications for unlimited resources.',
      //     badge: 'Family Subscriber',
      //   };
      case 'seeker':
      default:
        return {
          title: 'Welcome to siFia',
          subtitle: 'Your free Seeker plan includes 2 playbooks and 1 devotional each month.\nMove at a pace that feels right for your season.',
          badge: 'Free Access',
        };
    }
  };

  const welcomeData = getWelcomeMessage();

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header removed by request */}

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          {/* Subscription Badge */}
          <View key="subscription-badge" style={styles.badgeContainer}>
            <ThemedText weight="semiBold" style={styles.badgeText}>{welcomeData.badge}</ThemedText>
          </View>

          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={48} color={Colors.alertCoral} />
          </View>
          <ThemedText
            style={[styles.welcomeTitle, effectiveUserType === 'paid' ? styles.welcomeTitleSmall : null]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {welcomeData.title}
          </ThemedText>
          <ThemedText style={styles.welcomeSubtitle}>
            {welcomeData.subtitle}
          </ThemedText>
        </View>

        {/* Notification Settings */}
        <View style={styles.settingsSection}>
          <ThemedText weight="bold" style={styles.settingsTitle}>Notification Preferences</ThemedText>
          <ThemedText style={styles.settingsSubtitle}>Choose what would be helpful for you right now. You can change these anytime.</ThemedText>

          {notificationSettings
            .filter(setting => !(setting.id === 'trial_reminders' && effectiveUserType === 'trial'))
            .map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name={setting.icon as any} size={24} color={Colors.alertCoral} />
                </View>
                <View style={styles.settingContent}>
                  <ThemedText weight="semiBold" style={styles.settingTitle}>{setting.title}</ThemedText>
                  <ThemedText style={styles.settingDescription}>{setting.description}</ThemedText>
                  {setting.required && (
                    <ThemedText weight="semiBold" style={styles.requiredText}>Required</ThemedText>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => !setting.required && handleToggleSetting(setting.id)}
                activeOpacity={0.7}
                disabled={setting.required}
                style={[
                  styles.toggle,
                  setting.enabled && styles.toggleActive,
                  setting.required && styles.toggleDisabled,
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: setting.enabled, disabled: setting.required }}
              >
                <View style={[
                  styles.toggleIndicator,
                  setting.enabled && styles.toggleIndicatorActive,
                ]} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <ThemedText weight="semiBold" style={styles.benefitsTitle}>Why turn on notifications?</ThemedText>
          <ThemedText style={styles.benefitText}>Gentle reminders to support your journey.</ThemedText>
          <ThemedText style={styles.benefitText}>Nothing urgent. Nothing forced.</ThemedText>
        </View>

      </ScrollView>

      {/* Sticky Footer Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }] }>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnableNotifications}>
          <ThemedText weight="semiBold" style={styles.primaryButtonText}>Enable Notifications</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryButton, styles.devotionalButton]} onPress={handleSkip}>
          <ThemedText weight="semiBold" style={styles.secondaryButtonText}>Maybe Later</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.privacyNote}>
          🔒 We respect your privacy. You can change these settings anytime in your profile.
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  logoHeart: {
    fontSize: 16,
    color: Colors.alertCoral,
    marginLeft: 2,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeTitleSmall: {
    fontSize: 20,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
  },
  welcomeSubtitlePrimary: {
    fontWeight: '600',
  },
  welcomeSubtitleNote: {
    fontSize: 13,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 18,
    marginTop: 8,
  },
  settingsSection: {
    marginBottom: 32,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  settingsSubtitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    opacity: 0.8,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'left',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.8,
    lineHeight: 18,
  },
  requiredText: {
    fontSize: 12,
    color: Colors.alertCoral,
    fontWeight: '600',
    marginTop: 4,
  },
  benefitsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 0,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  devotionalButton: {
    marginTop: 12,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.alertCoral,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 18,
    backgroundColor: Colors.hopeWhite,
    alignSelf: 'flex-start',
  },
  toggleIndicatorActive: {
    alignSelf: 'flex-end',
  },
  privacyNote: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    lineHeight: 16,
  },
  badgeContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
});

export default withErrorBoundary(OnboardingNotificationSetupScreen, 'OnboardingNotificationSetupScreen');
