import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';

interface RouteParams {
  userType: 'trial' | 'paid' | 'freemium';
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
  const route = useRoute();
  const { userType } = route.params as RouteParams;

  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([
    {
      id: 'daily_devotional',
      title: 'Daily Devotionals',
      description: 'Start your day with personalized spiritual guidance',
      icon: 'book-outline',
      enabled: true,
      required: true,
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
      description: 'Celebrate your spiritual growth milestones',
      icon: 'trending-up-outline',
      enabled: true,
    },
    {
      id: 'community_updates',
      title: 'Community & Support',
      description: 'Connect with others on their faith journey',
      icon: 'people-outline',
      enabled: false,
    },
    {
      id: 'trial_reminders',
      title: 'Trial Reminders',
      description: 'Important updates about your trial status',
      icon: 'time-outline',
      enabled: userType === 'trial',
      required: userType === 'trial',
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
    switch (userType) {
      case 'trial':
        return {
          title: 'Stay Connected During Your Trial',
          subtitle: 'Get the most out of your 3-day experience with timely reminders and guidance.',
        };
      case 'paid':
        return {
          title: 'Stay Connected on Your Journey',
          subtitle: 'Let us support and encourage you with personalized notifications.',
        };
      case 'freemium':
        return {
          title: 'Stay Motivated on Your Path',
          subtitle: 'Receive encouragement and reminders to keep growing spiritually.',
        };
      default:
        return {
          title: 'Stay Connected',
          subtitle: 'Receive personalized guidance and encouragement.',
        };
    }
  };

  const welcomeData = getWelcomeMessage();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>siFia</Text>
          <Text style={styles.logoHeart}>❤</Text>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={48} color={Colors.alertCoral} />
          </View>
          <Text style={styles.welcomeTitle}>{welcomeData.title}</Text>
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
          <Text style={styles.benefitsTitle}>Why enable notifications?</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Stay consistent with your spiritual practices</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Receive personalized encouragement</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.benefitText}>Never miss important spiritual moments</Text>
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
    </SafeAreaView>
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
  },
  enableButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  privacyNote: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 40,
  },
});

export default OnboardingNotificationSetupScreen;
