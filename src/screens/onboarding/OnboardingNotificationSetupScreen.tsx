import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { pushNotificationService } from '../../services/pushNotificationService';
import { notificationManagementService } from '../../services/notificationManagementService';
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
  
  // Enterprise-grade state management
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown');
  const [setupStep, setSetupStep] = useState<'preferences' | 'permissions' | 'complete'>('preferences');
  
  // Derive display name for welcome message
  const displayName =
    ((user as any)?.user_metadata?.full_name as string | undefined)?.trim() ||
    ((user as any)?.user_metadata?.first_name as string | undefined)?.trim() ||
    (user?.email ? user.email.split('@')[0] : undefined) ||
    'Friend';
  
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
        console.error('Error checking notification permissions:', error);
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
      description: 'Reminders for action steps and challenges in your Playbooks',
      icon: 'albums-outline',
      enabled: true,
    },
    {
      id: 'daily_devotional',
      title: 'Devotionals',
      description: 'Start your day with personalized guidance',
      icon: 'book-outline',
      enabled: true,
      required: false,
    },
    {
      id: 'journal_reminders',
      title: 'Journal Reminders',
      description: 'Gentle prompts to help you reflect and write',
      icon: 'create-outline',
      enabled: true,
    },
    {
      id: 'prayer_reminders',
      title: 'Prayer Reminders',
      description: 'Gentle nudges for your prayer time',
      icon: 'heart-outline',
      enabled: true,
    },
    {
      id: 'progress_updates',
      title: 'Progress Updates',
      description: 'Celebrate your growth milestones',
      icon: 'trending-up-outline',
      enabled: true,
    },
    {
      id: 'trial_reminders',
      title: 'Trial Reminders',
      description: 'Important updates about your trial status',
      icon: 'time-outline',
      enabled: effectiveUserType === 'trial',
      required: effectiveUserType === 'trial',
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
      
      if (permissionsGranted) {
        console.log('✅ Push notifications enabled successfully');
        
        // Save notification preferences to Supabase
        const enabledSettings = notificationSettings
          .filter(setting => setting.enabled)
          .reduce((acc, setting) => {
            acc[setting.id] = true;
            return acc;
          }, {} as Record<string, boolean>);

        // Save preferences to notification_preferences table
        try {
          const { error: prefsError } = await supabase
            .from('notification_preferences')
            .upsert({
              user_id: user.id,
              notification_type: 'user_preferences', // Required field
              prayer_reminders: enabledSettings.prayer_reminders || false,
              playbook_actions: enabledSettings.playbooks || false,
              devotional_reminders: enabledSettings.daily_devotional || false,
              journal_prompts: enabledSettings.journal_reminders || false,
              milestone_celebrations: enabledSettings.progress_updates || false,
              trial_notifications: enabledSettings.trial_reminders || false,
              updated_at: new Date().toISOString(),
            });

          if (prefsError) {
            console.error('Error saving notification preferences:', prefsError);
          } else {
            console.log('✅ Notification preferences saved successfully');
          }
        } catch (prefsError) {
          console.error('Error saving notification preferences:', prefsError);
        }
        
        Alert.alert(
          '🎉 Notifications Enabled!',
          'You\'ll receive personalized reminders to help you stay connected with God.',
          [
            {
              text: 'Let\'s Go!',
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' as any }],
              }),
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
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' as any }],
              }),
            },
            {
              text: 'Open Settings',
              onPress: () => pushNotificationService.openNotificationSettings(),
            },
          ]
        );
      }

    } catch (error) {
      console.error('Error setting up notifications:', error);
      Alert.alert(
        'Setup Complete',
        'You can always enable notifications later in your profile settings.',
        [
          {
            text: 'Continue',
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' as any }],
            }),
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
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' as any }],
          }),
        },
      ]
    );
  };

  const getWelcomeMessage = () => {
    const currentTier = subscription?.tier || tier || 'seeker';
    
    switch (currentTier) {
      case 'free_trial':
        return {
          title: 'Make the Most of Your Free Trial',
          subtitle: 'Get timely reminders for your 2 playbooks and 2 devotionals over the next 3 days.',
          badge: '3-Day Trial Active'
        };
      case 'spark':
        return {
          title: 'Welcome to SPARK',
          subtitle: 'Get reminders for your 8 monthly playbooks, devotionals, and journaling.',
          badge: 'SPARK Subscriber'
        };
      case 'growth':
        return {
          title: 'Welcome to GROWTH',
          subtitle: 'Make the most of your 20 monthly resources with helpful reminders.',
          badge: 'GROWTH Subscriber'
        };
      case 'transformation':
        return {
          title: 'Welcome to siFia TRANSFORMATION',
          subtitle: 'Enjoy unlimited access with gentle reminders to support your daily walk.',
          badge: 'TRANSFORMATION Subscriber'
        };
      case 'family':
        return {
          title: 'Welcome to siFia FAMILY',
          subtitle: 'Keep your family connected with notifications for unlimited resources.',
          badge: 'FAMILY Subscriber'
        };
      case 'seeker':
      default:
        return {
          title: 'Welcome, Seeker',
          subtitle: 'Stay motivated with gentle reminders and encouragement.',
          badge: 'Seeker (Freemium)'
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
          <View style={styles.badgeContainer}>
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
            {`Welcome ${displayName}`}
          </ThemedText>
          <ThemedText style={styles.welcomeSubtitle}>{welcomeData.subtitle}</ThemedText>
        </View>

        {/* Notification Settings */}
        <View style={styles.settingsSection}>
          <ThemedText weight="bold" style={styles.settingsTitle}>Notification Preferences</ThemedText>

          {notificationSettings.map((setting) => (
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
              <Switch
                value={setting.enabled}
                onValueChange={() => handleToggleSetting(setting.id)}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: Colors.growthGreen }}
                thumbColor={setting.enabled ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.5)'}
                disabled={setting.required}
              />
            </View>
          ))}
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <ThemedText weight="semiBold" style={styles.benefitsTitle}>Why turn on notifications?</ThemedText>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Stay on track with your action steps</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Get reminders for Playbook challenges</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Timely nudges for devotionals, prayer, and journaling</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Celebrate milestones and track your progress</ThemedText>
          </View>
        </View>

      </ScrollView>

      {/* Sticky Footer Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 2 }] }>
        <TouchableOpacity style={styles.enableButton} onPress={handleEnableNotifications}>
          <ThemedText weight="bold" style={styles.enableButtonText}>Enable Notifications</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <ThemedText weight="medium" style={styles.skipButtonText}>Maybe Later</ThemedText>
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
    paddingTop: 4,
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
  settingsSection: {
    marginBottom: 32,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
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
  enableButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  enableButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skipButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
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

export default OnboardingNotificationSetupScreen;
