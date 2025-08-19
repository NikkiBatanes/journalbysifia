import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';

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
  
  useEffect(() => {
    // Refresh subscription data when screen loads
    if (user?.id) {
      refreshSubscription();
    }
  }, [user?.id, refreshSubscription]);

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
      // Here you would request notification permissions
      // For now, we'll simulate the process
      console.log('Requesting notification permissions...');

      // Simulate permission request
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate to home screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' as any }],
      });

    } catch (error) {
      console.error('Error setting up notifications:', error);
      Alert.alert(
        'Setup Complete',
        'You can always enable notifications later in your device settings.',
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
          title: 'Welcome to siFia SPARK',
          subtitle: 'Stay connected with notifications for your 8 monthly playbooks, devotionals, and smart journaling.',
          badge: 'SPARK Subscriber'
        };
      case 'growth':
        return {
          title: 'Welcome to siFia GROWTH',
          subtitle: 'Maximize your 20 monthly resources with personalized notification reminders.',
          badge: 'GROWTH Subscriber'
        };
      case 'transformation':
        return {
          title: 'Welcome to siFia TRANSFORMATION',
          subtitle: 'Enjoy unlimited access with gentle reminders to support your spiritual journey.',
          badge: 'TRANSFORMATION Subscriber'
        };
      case 'family':
        return {
          title: 'Welcome to siFia FAMILY',
          subtitle: 'Keep your family connected with notifications for unlimited spiritual resources.',
          badge: 'FAMILY Subscriber'
        };
      case 'seeker':
      default:
        return {
          title: 'Welcome, Seeker',
          subtitle: 'Stay motivated on your spiritual path with gentle reminders and encouragement.',
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
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header removed by request */}

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          {/* Subscription Badge */}
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{welcomeData.badge}</Text>
          </View>
          
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={48} color={Colors.alertCoral} />
          </View>
          <Text
            style={[styles.welcomeTitle, effectiveUserType === 'paid' ? styles.welcomeTitleSmall : null]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {welcomeData.title}
          </Text>
          <Text style={styles.welcomeSubtitle}>{welcomeData.subtitle}</Text>
        </View>

        {/* Notification Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsTitle}>Notification Preferences</Text>

          {notificationSettings.map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name={setting.icon as any} size={24} color={Colors.alertCoral} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                  {setting.required && (
                    <Text style={styles.requiredText}>Required</Text>
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
          <Text style={styles.benefitsTitle}>Why turn on notifications?</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Stay on track with your action steps</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Get reminders for Playbook challenges</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Timely nudges for devotionals, prayer, and journaling</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Celebrate milestones and track your progress</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.enableButton} onPress={handleEnableNotifications}>
          <Text style={styles.enableButtonText}>Enable Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Maybe Later</Text>
        </TouchableOpacity>

        {/* Privacy Note */}
        <Text style={styles.privacyNote}>
          🔒 We respect your privacy. You can change these settings anytime in your profile.
        </Text>
      </ScrollView>
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
    marginBottom: 32,
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
    marginBottom: 12,
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
    marginBottom: 16,
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
    marginTop: 16,
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
