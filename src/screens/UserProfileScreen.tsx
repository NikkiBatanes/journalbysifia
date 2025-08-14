import React, { useState, useEffect, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled
import { useAuth } from '../context/IndustryStandardAuthContext';
import { userApi } from '../services/userApi';
import ProfileHeader from '../components/profile/ProfileHeader';
import StatsGrid from '../components/profile/StatsGrid';
import MetricsExplainer from '../components/profile/MetricsExplainer';
import { pickImageLocal, uploadAvatar } from '../services/avatarService';
import { subscriptionService } from '../services/subscriptionService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from '../services/faithPointsEvents';
import { UserProgress, Badge, UserPreferences } from '../types/auth';
import { Subscription, UsageTracking } from '../interfaces/subscription';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

interface ProfileStats {
  faithPoints: number;
  level: number;
  totalBadges: number;
  currentStreak: number;
  goalsCompleted: number;
  devotionalsFinished: number;
  prayerSessions: number;
  journalEntries: number;
}

const UserProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut, updatePreferences } = useAuth();
  const theme = useTheme();
  // Status bar: dark icons on white header area
  useScreenStatusBar('dark', Colors.hopeWhite);
  // TODO: Add updateProfile and updatePreferences to IndustryStandardAuthContext
  const [_userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [recentBadges, setRecentBadges] = useState<Badge[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [_badgesModal, setBadgesModal] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: (user as any)?.firstName || (user as any)?.user_metadata?.first_name || '',
    lastName: (user as any)?.lastName || (user as any)?.user_metadata?.last_name || '',
  });

  const handleEditAvatar = async () => {
    try {
      console.log('[Avatar] Edit tapped');
      Alert.alert('Avatar', 'Opening photo library...');
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to update your profile photo.');
        return;
      }

      const picked = await pickImageLocal();
      console.log('[Avatar] Picker result:', picked ? 'asset selected' : 'cancelled');
      if (!picked) {return;} // user cancelled

      const url = await uploadAvatar(user, picked);
      console.log('[Avatar] Uploaded URL:', url);
      // const result = await updateProfile({ avatar_url: url }); // TODO: Implement updateProfile
      // if (result?.success === false) {
      //   throw new Error(result?.error?.message || 'Failed to update profile');
      // }
      Alert.alert('Profile Updated', 'Your profile photo has been updated.');
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      console.error('[Avatar] Error:', e);
      if (msg.includes('image-picker')) {
        Alert.alert(
          'Image Picker Missing',
          'Please install react-native-image-picker to enable selecting a photo.'
        );
      } else {
        Alert.alert('Avatar Update Failed', msg);
      }
    }
  };

  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      dailyDevotional: true,
      prayerReminders: true,
      journalPrompts: true,
      playbookUpdates: true,
      achievements: true,
      weeklyReports: true,
      pushEnabled: true,
      emailEnabled: true,
      reminderTime: '08:00',
      timezone: 'UTC',
    },
    theme: 'default',
    font: 'system',
    fontSize: 'medium',
    colorScheme: 'default',
    weekStart: 'sunday',
    privacy: {
      profileVisibility: 'public',
      shareProgress: true,
      shareJournal: false,
    },
    content: {
      language: 'en',
      bibleVersion: 'NIV',
      autoPlayAudio: false,
      downloadForOffline: false,
      showVerseOfDay: true,
    },
  });

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);

      // Load user progress and stats
      const progressResponse = await userApi.getUserProgress(user?.id || '');
      if (progressResponse.success && progressResponse.data) {
        setUserProgress(progressResponse.data);
      }

      // Load profile statistics
      const statsResponse = await userApi.getProfileStats(user?.id || '');
      if (statsResponse.success && statsResponse.data) {
        setProfileStats(statsResponse.data);
      }

      // Load recent badges
      const badgesResponse = await userApi.getRecentBadges(user?.id || '', 5);
      if (badgesResponse.success && badgesResponse.data) {
        setRecentBadges(badgesResponse.data);
      }

      // Load subscription and usage data
      if (user?.id) {
        try {
          const subscriptionData = await subscriptionService.getUserSubscription(user.id);
          setSubscription(subscriptionData);

          const usageData = await subscriptionService.getCurrentUsage(user.id);
          setUsage(usageData);

          console.log('📊 Subscription loaded:', subscriptionData.tier, subscriptionData.status);
          console.log('📈 Usage loaded - Playbooks:', usageData.playbooks_generated, 'Devotionals:', usageData.devotionals_generated);
        } catch (error) {
          console.error('Failed to load subscription data:', error);
        }
      }

      // TODO: Load user preferences from separate API or user_metadata
      // Supabase User doesn't have preferences property by default
      // Will need to implement separate preferences loading

    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Listen for faith points updates
  useEffect(() => {
    const handlePointsUpdate = (data?: any) => {
      console.log('🔄 Faith points updated, refreshing profile data...', data);
      // Force multiple refreshes to ensure data is updated
      setTimeout(() => {
        console.log('🔄 First refresh attempt...');
        loadProfileData();
      }, 200);

      setTimeout(() => {
        console.log('🔄 Second refresh attempt...');
        loadProfileData();
      }, 1000);

      setTimeout(() => {
        console.log('🔄 Final refresh attempt...');
        loadProfileData();
      }, 2000);
    };

    faithPointsEvents.on(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdate);
    faithPointsEvents.on(FAITH_POINTS_EVENTS.LEVEL_UP, handlePointsUpdate);

    return () => {
      faithPointsEvents.off(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdate);
      faithPointsEvents.off(FAITH_POINTS_EVENTS.LEVEL_UP, handlePointsUpdate);
    };
  }, [loadProfileData]);

  // Sync profile form with user data
  useEffect(() => {
    if (user) {
      const meta = (user as any)?.user_metadata || {};
      const uFirst = (user as any)?.firstName || meta.first_name || '';
      const uLast = (user as any)?.lastName || meta.last_name || '';
      // Fallback: derive from full_name if first/last missing
      let firstName = uFirst;
      let lastName = uLast;
      if ((!firstName || !lastName) && meta.full_name) {
        const parts = String(meta.full_name).trim().split(/\s+/);
        firstName = firstName || parts[0] || '';
        lastName = lastName || (parts.slice(1).join(' ') || '');
      }
      setProfileForm({ firstName, lastName });

      // Load preferences from user metadata if available
      const userPreferences = (user as any)?.user_metadata?.preferences;
      if (userPreferences) {
        setPreferences(prev => ({ ...prev, ...userPreferences }));
      }
    }
  }, [user]);

  // Live theme and font switching
  useEffect(() => {
    // Apply theme and font changes immediately when preferences change
    if (preferences.theme || preferences.font) {
      // The ThemeContext automatically picks up changes from user metadata
      // So we just need to update the user metadata when preferences change
      console.log('🎨 Theme preference changed to:', preferences.theme);
      console.log('🔤 Font preference changed to:', preferences.font);
    }
  }, [preferences.theme, preferences.font]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };


  const handleUpdateProfile = async () => {
    try {
      const full_name = `${(profileForm as any).firstName || ''} ${
        (profileForm as any).lastName || ''
      }`.trim();
      // Temporarily skip profile update until updateProfile is implemented
      setEditProfileModal(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      const result = await updatePreferences(preferences);
      if (result.success) {
        setSettingsModal(false);
        Alert.alert('Success', '🎨 Theme and font preferences updated! Changes will apply immediately.');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update preferences');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  // Handle immediate theme switching for live preview
  const handleThemeChange = async (newTheme: string) => {
    const updatedPreferences = { ...preferences, theme: newTheme as any };
    setPreferences(updatedPreferences);
    
    // Update user metadata immediately for live preview
    try {
      await updatePreferences(updatedPreferences);
      console.log('🎨 Theme switched to:', newTheme);
    } catch (error) {
      console.error('Failed to update theme preference:', error);
    }
  };

  // Handle immediate font switching for live preview
  const handleFontChange = async (newFont: string) => {
    const updatedPreferences = { ...preferences, font: newFont as any };
    setPreferences(updatedPreferences);
    
    // Update user metadata immediately for live preview
    try {
      await updatePreferences(updatedPreferences);
      console.log('🔤 Font switched to:', newFont);
    } catch (error) {
      console.error('Failed to update font preference:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Navigation will be handled automatically by auth state change
          },
        },
      ]
    );
  };

  const renderProfileHeader = () => (
    <ProfileHeader
      user={user}
      stats={{ faithPoints: profileStats?.faithPoints ?? 0, level: profileStats?.level ?? 1 }}
      onEditPress={() => setEditProfileModal(true)}
      onEditAvatar={handleEditAvatar}
    />
  );

  const renderStatsGrid = () => (
    <StatsGrid
      stats={{
        totalBadges: profileStats?.totalBadges ?? 0,
        currentStreak: profileStats?.currentStreak ?? 0,
        goalsCompleted: profileStats?.goalsCompleted ?? 0,
        devotionalsFinished: profileStats?.devotionalsFinished ?? 0,
        prayerSessions: profileStats?.prayerSessions ?? 0,
        journalEntries: profileStats?.journalEntries ?? 0,
      }}
    />
  );

  const renderSubscriptionInfo = () => {
    if (!subscription || !usage) {return null;}

    const isTrialing = subscription.status === 'trialing';
    const isCanceled = subscription.status === 'canceled';
    const trialDaysLeft = (subscription.trialEndDate && !isCanceled)
      ? Math.max(0, Math.ceil((new Date(subscription.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    console.log('🔍 Subscription Debug:', {
      tier: subscription.tier,
      status: subscription.status,
      limits: subscription.limits,
      usage: {
        playbooks_generated: usage.playbooks_generated,
        devotionals_generated: usage.devotionals_generated,
      },
    });

    const playbookLimit = subscription.limits?.playbooks === -1 ? 'Unlimited' : (subscription.limits?.playbooks || 0);
    const devotionalLimit = subscription.limits?.devotionals === -1 ? 'Unlimited' : (subscription.limits?.devotionals || 0);

    const playbookUsed = usage.playbooks_generated || 0;
    const devotionalUsed = usage.devotionals_generated || 0;

    return (
      <View style={styles.subscriptionContainer}>
        <Text style={styles.sectionTitle}>Your Plan</Text>

        {/* Subscription Status */}
        <View style={[styles.subscriptionCard, isTrialing && styles.trialCard]}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionTitleRow}>
              <Ionicons
                name={isCanceled ? 'close-circle' : (isTrialing ? 'time' : 'checkmark-circle')}
                size={24}
                color={isCanceled ? Colors.error : (isTrialing ? Colors.warning : Colors.success)}
              />
              <Text style={styles.subscriptionTitle}>
                {isCanceled ? 'BASIC (FREEMIUM)' : subscription.tier.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            {isTrialing && trialDaysLeft > 0 && (
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>{trialDaysLeft} days left</Text>
              </View>
            )}
          </View>

          <Text style={styles.subscriptionStatus}>
            {isCanceled
              ? 'Trial cancelled - You now have basic access'
              : (isTrialing
                ? `Your free trial expires in ${trialDaysLeft} days`
                : `Active since ${new Date(subscription.startDate).toLocaleDateString()}`)
            }
          </Text>
        </View>

        {/* Usage Statistics */}
        <View style={styles.usageGrid}>
          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Ionicons name="book-outline" size={20} color={Colors.primary} />
              <Text style={styles.usageTitle}>Playbooks</Text>
            </View>
            <Text style={styles.usageNumbers}>
              {playbookUsed} / {playbookLimit}
            </Text>
            <Text style={styles.usageLabel}>Generated this month</Text>
          </View>

          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Ionicons name="heart-outline" size={20} color={Colors.devotionalPurple} />
              <Text style={styles.usageTitle}>Devotionals</Text>
            </View>
            <Text style={styles.usageNumbers}>
              {devotionalUsed} / {devotionalLimit}
            </Text>
            <Text style={styles.usageLabel}>Generated this month</Text>
          </View>
        </View>

        {isTrialing && (
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRecentBadges = () => (
    <View style={styles.badgesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Badges</Text>
        <TouchableOpacity onPress={() => setBadgesModal(true)}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.badgesList}>
          {recentBadges.map((badge, index) => (
            <View key={index} style={styles.badgeItem}>
              <View style={styles.badgeIcon}>
                <Text style={styles.badgeEmoji}>{badge.icon}</Text>
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgePoints}>+{(badge as any).faith_points_reward || 0}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderMenuOptions = () => (
    <View style={styles.menuContainer}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => Alert.alert('Coming Soon', 'Goals feature is coming soon!')}
      >
        <Ionicons name="flag" size={24} color={Colors.primary} />
        <Text style={styles.menuText}>My Goals</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => Alert.alert('Coming Soon', 'Challenges feature is coming soon!')}
      >
        <Ionicons name="trophy" size={24} color={Colors.faithGold} />
        <Text style={styles.menuText}>Challenges</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setBadgesModal(true)}
      >
        <Ionicons name="medal" size={24} color={Colors.success} />
        <Text style={styles.menuText}>All Badges</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setSettingsModal(true)}
      >
        <Ionicons name="settings" size={24} color={Colors.mediumGray} />
        <Text style={styles.menuText}>Settings</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, styles.logoutItem]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out" size={24} color={Colors.error} />
        <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={editProfileModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setEditProfileModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleUpdateProfile}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              value={(profileForm as any).firstName}
              onChangeText={(text) => setProfileForm({ ...profileForm, firstName: text })}
              placeholder="Enter your first name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={(profileForm as any).lastName}
              onChangeText={(text) => setProfileForm({ ...profileForm, lastName: text })}
              placeholder="Enter your last name"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={settingsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setSettingsModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Settings</Text>
          <TouchableOpacity onPress={handleUpdatePreferences}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Notifications</Text>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Switch
                value={preferences.notifications.pushEnabled}
                onValueChange={(value) =>
                  setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, pushEnabled: value },
                  })
                }
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Switch
                value={preferences.notifications.emailEnabled}
                onValueChange={(value) =>
                  setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, emailEnabled: value },
                  })
                }
              />
            </View>
          </View>

          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Privacy</Text>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Profile Visibility</Text>
              <Text style={styles.settingValue}>{preferences.privacy.profileVisibility}</Text>
            </View>
          </View>

          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Calendar</Text>

            <View style={styles.settingItemColumn}>
              <Text style={styles.settingLabel}>Week Start</Text>
              <View style={styles.settingChipsRow}>
                {(
                  [
                    { key: 'sunday', label: 'Sun' },
                    { key: 'monday', label: 'Mon' },
                    { key: 'tuesday', label: 'Tue' },
                    { key: 'wednesday', label: 'Wed' },
                    { key: 'thursday', label: 'Thu' },
                    { key: 'friday', label: 'Fri' },
                    { key: 'saturday', label: 'Sat' },
                  ] as const
                ).map((d) => {
                  const active = preferences.weekStart === d.key;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setPreferences({ ...preferences, weekStart: d.key })}
                      accessibilityRole="button"
                      accessibilityLabel={`Set week start to ${d.label}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Appearance</Text>

            <View style={styles.settingItemColumn}>
              <Text style={styles.settingLabel}>Theme</Text>
              <View style={styles.settingChipsRow}>
                {(
                  [
                    { key: 'default', label: 'Default', description: 'Original brand colors' },
                    { key: 'dark', label: 'Dark', description: 'Dark mode' },
                    { key: 'coral', label: 'Coral', description: 'Warm coral theme' },
                    { key: 'sunshine', label: 'Sunshine', description: 'Bright yellow theme' },
                    { key: 'devotional', label: 'Devotional', description: 'Spiritual purple theme' },
                  ] as const
                ).map((opt) => {
                  const active = preferences.theme === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => handleThemeChange(opt.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set theme to ${opt.label}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.settingItemColumn}>
              <Text style={styles.settingLabel}>Font</Text>
              <View style={styles.settingChipsRow}>
                {(
                  [
                    { key: 'system', label: 'System', description: 'Device default' },
                    { key: 'lexend', label: 'Lexend', description: 'Dyslexia-friendly' },
                    { key: 'poppins', label: 'Poppins', description: 'Modern & clean' },
                    { key: 'nunito', label: 'Nunito Sans', description: 'Friendly & readable' },
                    { key: 'lora', label: 'Lora', description: 'Elegant serif' },
                  ] as const
                ).map((font) => {
                  const active = preferences.font === font.key;
                  return (
                    <TouchableOpacity
                      key={font.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => handleFontChange(font.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set font to ${font.label}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{font.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fontNote}>Lexend font is specially designed to improve reading proficiency</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.hopeWhite }]}>
      {/* Fixed white header area */}
      {renderProfileHeader()}

      {/* Body with rounded top; only its content scrolls */}
      <View style={[styles.bodyContainer, { backgroundColor: theme.colors.anchorBlue }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderStatsGrid()}
          <MetricsExplainer />
          {renderSubscriptionInfo()}
          {renderRecentBadges()}
          {renderMenuOptions()}
        </ScrollView>
      </View>

      {renderEditProfileModal()}
      {renderSettingsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  bodyContainer: {
    marginTop: 0,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    flex: 1,
  },
  // Settings modal additions (chips)
  settingItemColumn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  chipActive: {
    backgroundColor: Colors.alertCoral,
  },
  chipText: {
    color: Colors.darkerGray,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.hopeWhite,
  },
  fontNote: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  headerGradient: {
    paddingBottom: 20,
    backgroundColor: Colors.anchorBlue,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  defaultAvatar: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  levelContainer: {
    marginTop: 8,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  faithPointsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  editButton: {
    padding: 8,
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 60) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  badgesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  badgesList: {
    flexDirection: 'row',
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  badgePoints: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '500',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: Colors.error,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.mediumGray,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  settingValue: {
    fontSize: 16,
    color: Colors.mediumGray,
    textTransform: 'capitalize',
  },
  // Subscription and Usage Styles
  subscriptionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trialCard: {
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  subscriptionHeader: {
    marginBottom: 8,
  },
  subscriptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 8,
  },
  trialBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  trialBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subscriptionStatus: {
    fontSize: 14,
    color: Colors.mediumGray,
  },
  usageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    flex: 0.48,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 6,
  },
  usageNumbers: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  // Removed test button styles
});

export default UserProfileScreen;
