// src/screens/AllScreensNavigationScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import ThemedText from '../components/common/ThemedText';

interface ScreenItem {
  name: string;
  displayName: string;
  icon: string;
  iconType: 'MaterialCommunityIcons' | 'MaterialIcons' | 'Ionicons';
  category: string;
  description: string;
  params?: any;
}

const AllScreensNavigationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const theme = useTheme();

  const screenCategories: { [key: string]: ScreenItem[] } = {
    'User & Profile': [
      {
        name: 'UserProfileModal',
        displayName: 'User Profile',
        icon: 'account-circle',
        iconType: 'MaterialCommunityIcons',
        category: 'User & Profile',
        description: 'View and edit user profile settings',
      },
      {
        name: 'UserInput',
        displayName: 'AI Assistant',
        icon: 'robot',
        iconType: 'MaterialCommunityIcons',
        category: 'User & Profile',
        description: 'Chat with siFia AI assistant',
      },
    ],
    'Spiritual Growth': [
      {
        name: 'StreakDetail',
        displayName: 'Streak Details',
        icon: 'fire',
        iconType: 'MaterialCommunityIcons',
        category: 'Spiritual Growth',
        description: 'View prayer and devotional streaks',
      },
    ],
    'Playbook System': [
      {
        name: 'GeneratingPlaybook',
        displayName: 'Generating Playbook',
        icon: 'cog',
        iconType: 'MaterialCommunityIcons',
        category: 'Playbook System',
        description: 'Playbook generation progress screen',
      },
      {
        name: 'PlaybookDetail',
        displayName: 'Playbook Detail',
        icon: 'clipboard-text-play',
        iconType: 'MaterialCommunityIcons',
        category: 'Playbook System',
        description: 'View detailed playbook content',
        params: { playbookId: 'demo' },
      },
    ],
    'Devotionals': [
      {
        name: 'DevotionalDetail',
        displayName: 'Devotional Detail',
        icon: 'book-open-page-variant',
        iconType: 'MaterialCommunityIcons',
        category: 'Devotionals',
        description: 'View devotional content and progress',
        params: { devotionalId: 'demo' },
      },
    ],
    'Smart Journaling': [
      {
        name: 'SmartJournalingGratitudeModal',
        displayName: 'Gratitude Journal',
        icon: 'heart',
        iconType: 'MaterialCommunityIcons',
        category: 'Smart Journaling',
        description: 'Smart gratitude journaling modal',
      },
      {
        name: 'SmartJournalingPrayerModal',
        displayName: 'Prayer Journal',
        icon: 'hands-pray',
        iconType: 'MaterialCommunityIcons',
        category: 'Smart Journaling',
        description: 'Smart prayer journaling modal',
      },
      {
        name: 'SmartJournalingReflectionModal',
        displayName: 'Reflection Journal',
        icon: 'thought-bubble',
        iconType: 'MaterialCommunityIcons',
        category: 'Smart Journaling',
        description: 'Smart reflection journaling modal',
      },
      {
        name: 'SmartJournalingTimeBlockModal',
        displayName: 'Time Block Journal',
        icon: 'clock',
        iconType: 'MaterialCommunityIcons',
        category: 'Smart Journaling',
        description: 'Smart time blocking modal',
      },
      {
        name: 'DevotionalDetailReflectionModal',
        displayName: 'Devotional Reflection',
        icon: 'book-edit',
        iconType: 'MaterialCommunityIcons',
        category: 'Smart Journaling',
        description: 'Devotional reflection modal',
      },
    ],
    'Family & Subscription': [
      {
        name: 'FamilyAdminDashboard',
        displayName: 'Family Admin',
        icon: 'account-group',
        iconType: 'MaterialCommunityIcons',
        category: 'Family & Subscription',
        description: 'Manage family subscription',
      },
      {
        name: 'FamilyInvitation',
        displayName: 'Family Invitation',
        icon: 'account-plus',
        iconType: 'MaterialCommunityIcons',
        category: 'Family & Subscription',
        description: 'Join family subscription',
      },
    ],
    'Onboarding Flow': [
      {
        name: 'OnboardingSplash',
        displayName: 'Onboarding Splash',
        icon: 'rocket-launch',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Initial onboarding splash screen',
      },
      {
        name: 'TransformJourney',
        displayName: 'Transform Journey',
        icon: 'transformation',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Transform your life introduction',
      },
      {
        name: 'OnboardingWelcome',
        displayName: 'Welcome Screen',
        icon: 'hand-wave',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Welcome slideshow screen',
      },
      {
        name: 'OnboardingPersonalization',
        displayName: 'Personalization',
        icon: 'account-edit',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Personalization questionnaire',
      },
      {
        name: 'OnboardingPlaybookGeneration',
        displayName: 'Playbook Generation',
        icon: 'auto-fix',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Generate first playbook',
      },
      {
        name: 'OnboardingPlaybookReady',
        displayName: 'Playbook Ready',
        icon: 'check-circle',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Playbook generation complete',
      },
      {
        name: 'OnboardingSalesOffer',
        displayName: 'Sales Offer',
        icon: 'sale',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Subscription sales offer',
      },
      {
        name: 'OnboardingTrialOffer',
        displayName: 'Trial Offer',
        icon: 'gift',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Free trial offer screen',
      },
      {
        name: 'OnboardingPaymentProcessing',
        displayName: 'Payment Processing',
        icon: 'credit-card-clock',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Payment processing screen',
      },
      {
        name: 'OnboardingPaymentConfirmation',
        displayName: 'Payment Confirmation',
        icon: 'check-circle-outline',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Payment confirmation screen',
      },
      {
        name: 'OnboardingNotificationSetup',
        displayName: 'Notification Setup',
        icon: 'bell-ring',
        iconType: 'MaterialCommunityIcons',
        category: 'Onboarding Flow',
        description: 'Setup push notifications',
      },
    ],
    'Authentication': [
      {
        name: 'Auth',
        displayName: 'Authentication',
        icon: 'login',
        iconType: 'MaterialCommunityIcons',
        category: 'Authentication',
        description: 'Login and registration flow',
      },
    ],
    'Special Views': [
      {
        name: 'MomentsScreen',
        displayName: 'Moments View',
        icon: 'calendar-heart',
        iconType: 'MaterialCommunityIcons',
        category: 'Special Views',
        description: 'Carousel view of daily moments',
      },
    ],
  };

  const handleScreenNavigation = (screen: ScreenItem) => {
    try {
      if (screen.params) {
        navigation.navigate(screen.name, screen.params);
      } else {
        navigation.navigate(screen.name);
      }
    } catch (error) {
      console.log(`Navigation to ${screen.name} failed:`, error);
      // Some screens might not be accessible in current context
    }
  };

  const renderIcon = (screen: ScreenItem) => {
    const iconProps = {
      name: screen.icon,
      size: 24,
      color: theme.colors.alertCoral,
    };

    switch (screen.iconType) {
      case 'MaterialCommunityIcons':
        return <MaterialCommunityIcons {...iconProps} />;
      case 'MaterialIcons':
        return <MaterialIcons {...iconProps} />;
      case 'Ionicons':
        return <Ionicons {...iconProps} />;
      default:
        return <MaterialCommunityIcons {...iconProps} />;
    }
  };

  const renderScreenItem = (screen: ScreenItem) => (
    <TouchableOpacity
      key={screen.name}
      style={[styles.screenItem, { backgroundColor: theme.colors.cardBackground }]}
      onPress={() => handleScreenNavigation(screen)}
      activeOpacity={0.7}
    >
      <View style={styles.screenItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.alertCoral}20` }]}>
          {renderIcon(screen)}
        </View>
        <View style={styles.screenInfo}>
          <ThemedText weight="semiBold" style={styles.screenName}>
            {screen.displayName}
          </ThemedText>
          <ThemedText weight="regular" style={[styles.screenDescription, { color: theme.colors.anchorBlueLight }]}>
            {screen.description}
          </ThemedText>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.anchorBlueLight}
      />
    </TouchableOpacity>
  );

  const renderCategory = (categoryName: string, screens: ScreenItem[]) => (
    <View key={categoryName} style={styles.categoryContainer}>
      <ThemedText weight="bold" style={[styles.categoryTitle, { color: theme.colors.hopeWhite }]}>
        {categoryName}
      </ThemedText>
      <View style={styles.categoryContent}>
        {screens.map(renderScreenItem)}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.anchorBlue }]}>
      <View style={styles.header}>
        <ThemedText weight="bold" style={[styles.headerTitle, { color: theme.colors.hopeWhite }]}>
          All Screens
        </ThemedText>
        <ThemedText weight="regular" style={[styles.headerSubtitle, { color: theme.colors.anchorBlueLight }]}>
          Navigate to any screen in the app
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(screenCategories).map(([categoryName, screens]) =>
          renderCategory(categoryName, screens)
        )}

        <View style={styles.footer}>
          <ThemedText weight="regular" style={[styles.footerText, { color: theme.colors.anchorBlueLight }]}>
            Total screens: {Object.values(screenCategories).flat().length}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  categoryContainer: {
    marginBottom: 32,
  },
  categoryTitle: {
    fontSize: 20,
    marginBottom: 16,
  },
  categoryContent: {
    gap: 12,
  },
  screenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  screenItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  screenInfo: {
    flex: 1,
  },
  screenName: {
    fontSize: 16,
    marginBottom: 4,
  },
  screenDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
});

export default AllScreensNavigationScreen;
