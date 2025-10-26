import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  Linking,
  Platform,
  Share,
  TextInput,
  Modal,
  Switch,
  Image,
} from 'react-native';
import { Pencil as LuPencil } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { experiencePreferences } from '../services/experiencePreferences';
import { initSound, releaseSound } from '../utils/soundUtils';

// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { userApi } from '../services/userApi';
import ProfileHeader from '../components/profile/ProfileHeader';
import { TrialDebugMenu } from '../components/debug/TrialDebugMenu';
import { pickImageLocal, uploadAvatar } from '../services/avatarService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from '../services/faithPointsEvents';
import { UserProgress, UserPreferences } from '../types/auth';
// Types for subscription - using inline types to avoid import issues
interface Subscription {
  id: string;
  tier: string;
  status: string;
  limits?: {
    playbooks: number;
    devotionals: number;
  };
}

interface UsageTracking {
  playbooks_generated: number;
  devotionals_generated: number;
}
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { notificationManagementService, NotificationPreferences } from '../services/notificationManagementService';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { reportBug } from '../services/bugReportService';
import { reportFeature } from '../services/featureRequestService';
import InAppReview from 'react-native-in-app-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

const { width } = Dimensions.get('window');

// Store metadata for review links
// TODO: Replace with your real App Store numeric ID once the app is live in the store
// Example: const APPLE_APP_ID = '1234567890';
const APPLE_APP_ID = '';
// Android package is already defined in app.json and native; keep here for clarity
const ANDROID_PACKAGE = 'com.sifiaopc.app';

interface Props {
  navigation: any;
}

interface ProfileStats {
  faithPoints: number;
  level: number;
  totalBadges: number;
  goalsCompleted: number;
  devotionalsFinished: number;
  prayerSessions: number;
  journalEntries: number;
}

const UserProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut, updatePreferences, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const font = useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  // Status bar: dark icons on white header area
  useScreenStatusBar('dark', Colors.hopeWhite);

  // Family subscription hook
  const {
    familyGroup,
    createFamilyGroup,
    refreshFamilyData,
  } = useFamilySubscription();
  // TODO: Add updateProfile and updatePreferences to IndustryStandardAuthContext
  const [_userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: (user as any)?.firstName || (user as any)?.user_metadata?.first_name || '',
    lastName: (user as any)?.lastName || (user as any)?.user_metadata?.last_name || '',
    birthDate: (user as any)?.user_metadata?.birth_date || '',
  });

  // Helpers: Quiet Hours formatting and pickers
  const formatTo12h = useCallback((time24?: string) => {
    if (!time24) {return '';}
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr || '0', 10);
    const m = parseInt(mStr || '0', 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) {h = 12;}
    const mm = m.toString().padStart(2, '0');
    return `${h}:${mm} ${suffix}`;
  }, []);

  // Notification preferences from the notification management service
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);

  // Time picker states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [tempTime, setTempTime] = useState(new Date());

  // Optimistic toggle update for notification preferences
  const updatePref = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      try { triggerLightHaptic(); } catch {}
      if (!notificationPrefs || !user?.id) {

        return;
      }
      const updated = { ...notificationPrefs, [key]: value } as NotificationPreferences;
      // Optimistic UI update
      setNotificationPrefs(updated);
      const ok = await notificationManagementService.updateNotificationPreferences(updated);
      if (!ok) {
        // Revert on failure
        setNotificationPrefs({ ...notificationPrefs });
        Alert.alert('Update failed', 'Unable to save notification preference. Please try again.');
      }
    },
    [notificationPrefs, user?.id]
  );

  // Native time picker handler
  const showNativeTimePicker = useCallback((type: 'start' | 'end') => {
    if (!notificationPrefs) {return;}

    const currentTime = type === 'start'
      ? notificationPrefs.quiet_hours_start || '22:00'
      : notificationPrefs.quiet_hours_end || '07:00';

    const [hours, minutes] = currentTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    setTempTime(date);
    setTimePickerType(type);
    setShowTimePicker(true);
  }, [notificationPrefs]);

  const handleTimeChange = useCallback(async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate && notificationPrefs && user?.id) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const field = timePickerType === 'start' ? 'quiet_hours_start' : 'quiet_hours_end';
      const updated = { ...notificationPrefs, [field]: timeString };

      const success = await notificationManagementService.updateNotificationPreferences(updated);
      if (success) {
        setNotificationPrefs(updated);
        try { triggerLightHaptic(); } catch {}
      }
    }
  }, [notificationPrefs, user?.id, timePickerType]);

  // Don't use Google avatar - force use of custom avatar system
  const avatarUrl = undefined; // Always use initials instead of Google avatar
  const initialLetter = useMemo(() => {
    const first = (profileForm as any)?.firstName || (user as any)?.user_metadata?.first_name || '';
    const last = (profileForm as any)?.lastName || (user as any)?.user_metadata?.last_name || '';
    const fallback = (user as any)?.user_metadata?.full_name || (user as any)?.email || 'U';
    const name = [first, last].filter(Boolean).join(' ') || fallback;
    return String(name).trim().charAt(0).toUpperCase();
  }, [profileForm, user]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deleteBirthYear, setDeleteBirthYear] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showInlineYearPicker, setShowInlineYearPicker] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState<Date>(() => {
    const birthDateStr = (user as any)?.user_metadata?.birth_date || (profileForm as any)?.birthDate;
    if (birthDateStr) {
      const date = new Date(birthDateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // Default to 25 years ago
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 25);
    return defaultDate;
  });
  // Delete Account helpers
  const isValidBirthYear = useMemo(() => {
    if (!deleteBirthYear) {return false;}
    const yr = parseInt(deleteBirthYear, 10);
    const now = new Date().getFullYear();
    return /^(19|20)\d{2}$/.test(deleteBirthYear) && yr >= 1900 && yr <= now;
  }, [deleteBirthYear]);

  const handleConfirmDeleteAccount = useCallback(async () => {

    try {
      try { triggerLightHaptic(); } catch {}
      if (!isValidBirthYear) {

        Alert.alert('Enter valid year', 'Please enter your birth year (YYYY) to continue.');
        return;
      }

      // Show confirmation alert before proceeding
      Alert.alert(
        'Delete Account',
        'Are you sure you want to permanently delete your account? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsDeletingAccount(true);
              try {
                // For now, show a message that this feature requires server-side implementation
                Alert.alert(
                  'Account Deletion Request',
                  'Your account deletion request has been received. For security reasons, account deletion requires manual verification. Please contact support to complete this process.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setDeleteAccountModal(false);
                        setEditProfileModal(false);
                        setDeleteBirthYear(''); // Clear the input
                      },
                    },
                  ]
                );
              } catch (e: any) {
                Alert.alert('Error', 'Unable to process deletion request at this time.');
              } finally {
                setIsDeletingAccount(false);
              }
            },
          },
        ]
      );
    } catch {}
  }, [isValidBirthYear, deleteBirthYear]);

  const loadNotificationPreferences = useCallback(async () => {
    if (!user?.id) {return;}

    try {

      let prefs = await notificationManagementService.getNotificationPreferences(user.id);

      // If no preferences exist, create defaults
      if (!prefs) {

        const defaultPrefs = {
          user_id: user.id,
          playbook_steps: true,
          devotional_reminders: true,
          trial_notifications: true,
          prayer_request_alerts: false,
          prayer_requests: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const success = await notificationManagementService.updateNotificationPreferences(defaultPrefs);
        if (success) {
          prefs = defaultPrefs;
        }
      }

      setNotificationPrefs(prefs);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Set minimal defaults on error
      setNotificationPrefs({
        user_id: user.id,
        playbook_steps: false,
        devotional_reminders: false,
        trial_notifications: false,
        prayer_request_alerts: false,
        prayer_requests: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [user?.id]);

  const loadProfileData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Parallel loading for better performance
      const [progressResponse, statsResponse] = await Promise.allSettled([
        userApi.getUserProgress(user.id),
        userApi.getProfileStats(user.id),
      ]);

      // Process results with proper null checks
      if (progressResponse.status === 'fulfilled' && progressResponse.value.success && progressResponse.value.data) {
        setUserProgress(progressResponse.value.data);
      }

      if (statsResponse.status === 'fulfilled' && statsResponse.value.success && statsResponse.value.data) {
        setProfileStats(statsResponse.value.data);
      }

      // Badge data loading removed - badges section not currently displayed

      // Load subscription and usage data separately to avoid blocking UI
      try {
        const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id);
        setSubscription(subscriptionData as any);

        const usageData = {
          playbooks_generated: subscriptionData.playbooks_used || 0,
          devotionals_generated: subscriptionData.devotionals_used || 0,
        };
        setUsage(usageData);

      } catch (error) {
        console.error('Failed to load subscription data:', error);
      }

      // Load notification preferences separately to avoid blocking
      loadNotificationPreferences().catch(error => {
        console.error('Failed to load notification preferences:', error);
      });

    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadNotificationPreferences]);

  /**
   * ENTERPRISE IMPROVEMENT: Restore Purchases Handler
   * Explanation: This allows users to recover their subscriptions after:
   * - Reinstalling the app
   * - Switching devices
   * - Losing their subscription status
   *
   * This is REQUIRED by Apple for all subscription apps.
   * Now includes server-side validation for security.
   */
  const handleRestorePurchases = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to restore purchases');
      return;
    }

    try {
      triggerLightHaptic();
    } catch {}

    Alert.alert(
      'Restore Purchases',
      'This will restore any previous purchases made with this Apple ID.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              // Show loading state
              Alert.alert('Restoring...', 'Please wait while we restore your purchases.');

              const { AppleStoreKitService } = await import('../services/AppleStoreKitService');
              const storeKit = AppleStoreKitService.getInstance();

              const result = await storeKit.restorePurchases(user.id);

              if (result.success) {
                // Refresh subscription data
                await loadProfileData();

                Alert.alert(
                  'Success',
                  result.message + (result.validated ? `\n\n✓ ${result.validated} purchase(s) validated server-side` : ''),
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
              }
            } catch (error) {
              console.error('Restore purchases error:', error);
              Alert.alert(
                'Restore Failed',
                'Unable to restore purchases. Please try again later or contact support.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  }, [user, loadProfileData]);

  // Personalization toggles
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [showTabLabelsEnabled, setShowTabLabelsEnabled] = useState(true);
  const [settingsModal, setSettingsModal] = useState(false);
  const [weekStartModal, setWeekStartModal] = useState(false);
  const [weekStartDraft, setWeekStartDraft] = useState<UserPreferences['weekStart']>('sunday');
  // Bible Version modal and draft

  const [bibleVersionModal, setBibleVersionModal] = useState(false);
  const [bibleVersionDraft, setBibleVersionDraft] = useState<string>('NASB');
  // Appearance modal and drafts
  const [appearanceModal, setAppearanceModal] = useState(false);
  const [themeDraft, setThemeDraft] = useState<'default'>('default');
  const [fontDraft, setFontDraft] = useState<UserPreferences['font']>('lexend');
  // Report Issue modal
  const [reportBugModal, setReportBugModal] = useState(false);
  const [bugReportText, setBugReportText] = useState('');

  // Feature request modal
  const [featureModal, setFeatureModal] = useState(false);
  const [featureText, setFeatureText] = useState('');
  const [featureCategory, setFeatureCategory] = useState<string>('UI/UX');

  // Load persisted experience preferences on mount (defaults are ON)
  useEffect(() => {
    let mounted = true;
    (async () => {
      await experiencePreferences.loadOnce();
      if (!mounted) {return;}
      setHapticsEnabled(experiencePreferences.hapticsEnabled);
      setSoundsEnabled(experiencePreferences.soundsEnabled);
      setShowTabLabelsEnabled(experiencePreferences.showTabLabelsEnabled);
      if (experiencePreferences.soundsEnabled) {
        initSound();
      } else {
        releaseSound();
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Toggle handlers that persist to centralized store
  const onToggleHaptics = async (value: boolean) => {
    setHapticsEnabled(value);
    await experiencePreferences.setHapticsEnabled(value);
  };

  const onToggleSounds = async (value: boolean) => {
    setSoundsEnabled(value);
    await experiencePreferences.setSoundsEnabled(value);
    if (value) {
      initSound();
    } else {
      releaseSound();
    }
  };

  const onToggleShowTabLabels = async (value: boolean) => {
    setShowTabLabelsEnabled(value);
    await experiencePreferences.setShowTabLabelsEnabled(value);
  };

  const handleSubmitBug = async () => {
    const text = bugReportText.trim();
    if (!text) {
      Alert.alert('Add a brief description', 'Please describe the issue before submitting.');
      return;
    }
    try {
      await reportBug({
        user_id: user?.id ?? null,
        message: text,
        platform: Platform.OS,
        os_version: String(Platform.Version),
        screen: 'UserProfileScreen',
        app_version: null,
        extra: { timestamp: new Date().toISOString() },
      });
      setReportBugModal(false);
      setBugReportText('');
      Alert.alert('Thanks!', 'Your bug report was sent.');
    } catch (error) {
      console.error('[ReportBug] Failed to submit bug report', error);
      Alert.alert('Error', 'Failed to submit bug report. Please try again later.');
    }
  };

  // Open App Store / Play Store review page with graceful fallbacks
  const openStoreReview = async () => {
    try {
      if (Platform.OS === 'ios') {
        if (!APPLE_APP_ID) {
          Alert.alert(
            'Coming soon',
            'Reviews will be available once the app is live on the App Store.'
          );
          return;
        }
        const iosDeepLink = `itms-apps://itunes.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
        const iosWeb = `https://apps.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
        const supported = await Linking.canOpenURL(iosDeepLink);
        await Linking.openURL(supported ? iosDeepLink : iosWeb);
        return;
      }

      const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
      const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const supported = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(supported ? marketUrl : webUrl);
    } catch (e) {
      Alert.alert(
        'Not available yet',
        'The store listing may not be live yet. Please try again after release.'
      );
    }
  };

  // Try in-app review first, with gentle app-level gating, then fallback to store page
  const handleLeaveReview = async () => {
    try {
      const now = Date.now();
      const year = new Date().getFullYear();
      const LAST_PROMPT_KEY = 'review:lastPromptAt';
      const COUNT_KEY = `review:promptCount:${year}`;
      const MIN_DAYS_BETWEEN = 30; // days
      const MAX_PER_YEAR = 3;

      const lastPromptRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
      const countRaw = await AsyncStorage.getItem(COUNT_KEY);
      const lastPromptAt = lastPromptRaw ? parseInt(lastPromptRaw, 10) : 0;
      const promptCount = countRaw ? parseInt(countRaw, 10) : 0;

      const daysSince = lastPromptAt ? (now - lastPromptAt) / (1000 * 60 * 60 * 24) : Infinity;
      const withinLimit = promptCount < MAX_PER_YEAR;
      const spacedEnough = daysSince >= MIN_DAYS_BETWEEN;

      const canPrompt = withinLimit && spacedEnough;

      if (canPrompt && InAppReview.isAvailable()) {
        await InAppReview.RequestInAppReview();
        // Regardless of whether the dialog actually appears, record attempt to avoid spamming
        await AsyncStorage.setItem(LAST_PROMPT_KEY, String(now));
        await AsyncStorage.setItem(COUNT_KEY, String(promptCount + 1));
        return; // don't immediately redirect to the store
      }
    } catch (e) {
      // ignore and fallback
    }
    // Fallback to store if in-app review isn't available or gating disallows it
    await openStoreReview();
  };

  // Share app with friends using platform-appropriate store link (with fallback)
  const handleShareApp = async () => {
    try {
      const iosUrl = APPLE_APP_ID ? `https://apps.apple.com/app/id${APPLE_APP_ID}` : 'https://sifia.app';
      const androidUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
      const message = `I’m using siFia to strengthen my faith journey. Try it here: ${url}`;

      await Share.share(
        Platform.select({
          ios: { url, message, title: 'Try siFia', subject: 'Try siFia' },
          android: { message, title: 'Try siFia' },
          default: { message, title: 'Try siFia' },
        }) as any
      );
    } catch (e) {
      Alert.alert('Share failed', 'Unable to open share sheet right now. Please try again later.');
    }
  };

  const handleEditAvatar = async () => {
    try {
      try { triggerLightHaptic(); } catch {}

      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to update your profile photo.');
        return;
      }

      const picked = await pickImageLocal();

      if (!picked) {return;} // user cancelled

      const url = await uploadAvatar(user, picked);

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

  const handleSaveAppearance = async () => {
    try {
      const updatedPreferences = {
        ...preferences,
        theme: themeDraft as any,
        font: fontDraft as any,
      };
      const result = await updatePreferences(updatedPreferences);
      if (result.success) {
        setPreferences(updatedPreferences);
        setAppearanceModal(false);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update appearance');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update appearance');
    }
  };

  const handleSubmitFeature = async () => {
    const text = featureText.trim();
    if (!text) {
      Alert.alert('Add a brief description', 'Please describe the feature before submitting.');
      return;
    }
    try {
      await reportFeature({
        user_id: user?.id ?? null,
        message: text,
        category: featureCategory,
        platform: Platform.OS,
        os_version: String(Platform.Version),
        screen: 'UserProfileScreen',
        app_version: null,
        extra: { timestamp: new Date().toISOString() },
      });
      setFeatureModal(false);
      setFeatureText('');
      Alert.alert('Thanks!', 'Your feature suggestion was sent.');
    } catch (error) {
      console.error('[FeatureRequest] Failed to submit', error);
      Alert.alert('Error', 'Failed to submit feature suggestion. Please try again later.');
    }
  };

  const FEATURE_CATEGORIES = ['UI/UX','New Content','Performance','Notifications','Integrations','Accessibility','Other'];

  const renderFeatureModal = () => (
    <Modal
      visible={featureModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView edges={['top','bottom']} style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setFeatureModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Suggest a Feature</Text>
          <TouchableOpacity onPress={() => { try { triggerSuccessHaptic(); } catch {} handleSubmitFeature(); }}>
            <Text style={[styles.saveText, font]}>Submit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={[styles.sectionLabel, font]}>Category</Text>
          <View style={styles.settingChipsRow}>
            {FEATURE_CATEGORIES.map(cat => {
              const active = featureCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => { try { triggerLightHaptic(); } catch {} setFeatureCategory(cat); }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive, font]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.spacer} />
          <TextInput
            style={[styles.bugInput, font]}
            placeholder="Describe the feature you'd like to see..."
            placeholderTextColor={theme.colors.placeholderText}
            multiline
            value={featureText}
            onChangeText={setFeatureText}
            textAlignVertical="top"
          />
          <Text style={[styles.bugHint, font]}>Picking a category helps us triage suggestions faster.</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderAppearanceModal = () => (
    <Modal
      visible={appearanceModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView edges={['top','bottom']} style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setAppearanceModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Appearance</Text>
          <TouchableOpacity onPress={() => { try { triggerSuccessHaptic(); } catch {} handleSaveAppearance(); }}>
            <Text style={[styles.saveText, font]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={[styles.settingDescription, font]}>
            Choose your preferred theme and font. Changes will apply when you tap Save.
          </Text>

          <View style={styles.settingItemColumn}>
            <Text style={[styles.settingLabel, font]}>Theme</Text>
            <View style={styles.settingChipsRow}>
              {(
                [
                  { key: 'default', label: 'Default', description: 'Original brand colors' },
                ] as const
              ).map((opt) => {
                const active = themeDraft === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { try { triggerLightHaptic(); } catch {} setThemeDraft(opt.key); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set theme to ${opt.label}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive, font]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.fontNote, font]}>More themes coming soon! We're preparing a fresh theming system.</Text>
          </View>

          <View style={styles.settingItemColumn}>
            <Text style={[styles.settingLabel, font]}>Font</Text>
            <View style={styles.settingChipsRow}>
              {(
                [
                  { key: 'lexend', label: 'Lexend', description: 'Dyslexia-friendly' },
                  { key: 'poppins', label: 'Poppins', description: 'Modern & clean' },
                  { key: 'nunito', label: 'Nunito Sans', description: 'Friendly & readable' },
                  { key: 'lora', label: 'Lora', description: 'Elegant serif' },
                ] as const
              ).map((fontOption) => {
                const active = fontDraft === fontOption.key;
                return (
                  <TouchableOpacity
                    key={fontOption.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { try { triggerLightHaptic(); } catch {} setFontDraft(fontOption.key); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set font to ${fontOption.label}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive, font]}>{fontOption.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.fontNote, font]}>Lexend font is specially designed to improve reading proficiency</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderReportBugModal = () => (
    <Modal
      visible={reportBugModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView edges={['top','bottom']} style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setReportBugModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Report a Bug</Text>
          <TouchableOpacity onPress={() => { try { triggerSuccessHaptic(); } catch {} handleSubmitBug(); }}>
            <Text style={[styles.saveText, font]}>Submit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={[styles.bugInput, font]}
            placeholder="Please report your issue..."
            placeholderTextColor={theme.colors.placeholderText}
            multiline
            value={bugReportText}
            onChangeText={setBugReportText}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={[styles.bugHint, font]}>We'll take your reported issues into account to improve siFia.</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );

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
    font: 'lexend',
    fontSize: 'medium',
    colorScheme: 'default',
    weekStart: 'sunday',
    calendar: {
      autoSync: false,
    },
    privacy: {
      profileVisibility: 'public',
      shareProgress: true,
      shareJournal: false,
    },
    content: {
      language: 'en',
      bibleVersion: 'NASB',
      autoPlayAudio: false,
      downloadForOffline: false,
      showVerseOfDay: true,
    },
  });

  // Reload preferences whenever the settings modal opens (placed after declaration to satisfy lints)
  useEffect(() => {
    if (settingsModal && user?.id) {
      loadNotificationPreferences();
    }
  }, [settingsModal, user?.id, loadNotificationPreferences]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Listen for faith points updates - optimized to prevent multiple calls
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout;

    const handlePointsUpdate = (data?: any) => {

      // Clear any existing timeout to prevent multiple calls
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      // Single delayed refresh instead of multiple calls
      refreshTimeout = setTimeout(() => {

        loadProfileData();
      }, 500);
    };

    faithPointsEvents.on(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdate);
    faithPointsEvents.on(FAITH_POINTS_EVENTS.LEVEL_UP, handlePointsUpdate);

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
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
      setProfileForm(prev => ({ ...prev, firstName, lastName }));

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

    }
  }, [preferences.theme, preferences.font]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleUpdateProfile = async () => {
    try {
      const first = (profileForm as any).firstName?.trim() || '';
      const last = (profileForm as any).lastName?.trim() || '';
      const full = [first, last].filter(Boolean).join(' ').trim();
      const birthYear = String((profileForm as any).birthYear || '').trim();

      // Validate birth year if provided
      if (birthYear) {
        const now = new Date().getFullYear();
        const yr = parseInt(birthYear, 10);
        const valid = /^(19|20)\d{2}$/.test(birthYear) && yr >= 1900 && yr <= now;
        if (!valid) {
          Alert.alert('Invalid birth year', 'Please enter a valid 4-digit birth year (e.g., 1995).');
          return;
        }
      }

      // Persist to Supabase auth user_metadata via context
      const result = await (updateProfile as any)({
        full_name: full || undefined,
        first_name: first || undefined,
        last_name: last || undefined,
        birth_year: birthYear || undefined,
      });

      if (result?.success === false) {
        throw new Error(result?.error?.message || 'Failed to update profile');
      }

      // Close modal
      setEditProfileModal(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile');
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

  // Save handler for week start (no success alert)
  const handleSaveWeekStart = async () => {
    try {
      const updatedPreferences = { ...preferences, weekStart: weekStartDraft };
      const result = await updatePreferences(updatedPreferences);
      if (result.success) {
        setPreferences(updatedPreferences);
        setWeekStartModal(false);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update week start');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update week start');
    }
  };

  // Save handler for Bible Version (no success alert)
  const handleSaveBibleVersion = async () => {
    try {

      const updatedPreferences = {
        ...preferences,
        content: { ...preferences.content, bibleVersion: bibleVersionDraft },
      };

      const result = await updatePreferences(updatedPreferences);
      if (result.success) {
        setPreferences(updatedPreferences);
        setBibleVersionModal(false);

      } else {
        console.error('[UserProfile] Failed to save Bible version:', result.error);
        Alert.alert('Error', result.error?.message || 'Failed to update Bible version');
      }
    } catch (error) {
      console.error('[UserProfile] Error saving Bible version:', error);
      Alert.alert('Error', 'Failed to update Bible version');
    }
  };

  // Initialize draft when opening the Week Start modal
  useEffect(() => {
    if (weekStartModal) {
      setWeekStartDraft(preferences.weekStart);
    }
  }, [weekStartModal, preferences.weekStart]);

  // Initialize drafts when opening the Appearance modal
  useEffect(() => {
    if (appearanceModal) {
      setThemeDraft(preferences.theme as any);
      setFontDraft(preferences.font as UserPreferences['font']);
    }
  }, [appearanceModal, preferences.theme, preferences.font]);

  // Initialize draft when opening the Bible Version modal
  useEffect(() => {
    if (bibleVersionModal) {
      setBibleVersionDraft(preferences.content?.bibleVersion || 'NASB');
    }
  }, [bibleVersionModal, preferences.content?.bibleVersion]);

  const handleLogout = async () => {
    try {
      try { triggerLightHaptic(); } catch {}

      // Set loading state to prevent UI interactions during logout
      setLoading(true);

      // Clear local state before logout to prevent stale data
      setUserProgress(null);
      setProfileStats(null);
      setSubscription(null);
      setUsage(null);
      setNotificationPrefs(null);

      await signOut();

    } catch (error) {
      console.error('❌ Logout failed:', error);
      setLoading(false); // Reset loading state on error
      Alert.alert('Logout Failed', 'Unable to logout. Please try again.');
    }
  };

  const renderProfileHeader = () => {
    // Determine plan label for header pill (siFia-branded)
    let planLabel: string | undefined;
    if (subscription) {
      const rawTier = subscription.tier || '';
      const tierBase = rawTier.replace(/_annual$/, '');

      // Use subscription_display_name if available
      const branded = (() => {
        if ((subscription as any)?.subscription_display_name) {
          return (subscription as any).subscription_display_name;
        }

        // Fallback to tier-based logic
        switch (tierBase) {
          // Legacy IDs
          case 'basic':
            return 'siFia Seeker';
          case 'seeker':
            return 'siFia Seeker';
          case 'spark':
            return 'siFia Spark';
          case 'growth':
            return 'siFia Growth';
          case 'transformation':
            return 'siFia Transformation';
          case 'family':
            return 'siFia Family';
          case 'free_trial':
            {
              const chosen = (subscription as any)?.trial_chosen_tier || 'growth';
              const tierName = String(chosen).charAt(0).toUpperCase() + String(chosen).slice(1);
              return `siFia ${tierName} Trial`;
            }
          default:
            return undefined;
        }
      })();

      // If canceled, user effectively falls back to free tier presentation
      planLabel = subscription.status === 'canceled' ? 'siFia Seeker' : (branded || 'siFia Seeker');
    }
    return (
      <ProfileHeader
        user={user}
        stats={{
          faithPoints: profileStats?.faithPoints ?? 0,
          level: profileStats?.level ?? 1,
          badgesCount: profileStats?.totalBadges ?? 0,
        }}
        onEditPress={() => { try { triggerLightHaptic(); } catch {} setEditProfileModal(true); }}
        onEditAvatar={handleEditAvatar}
        plan={planLabel}
        usage={usageSummary}
        subscription={subscription} // Pass subscription for tooltips
        isLoading={loading || !subscription || !usage}
      />
    );
  };

  // Removed compact stats cards (flame/trophy) per design update

  const usageSummary = useMemo(() => {
    if (!subscription || !usage) {return null;}
    const playbookLimitNum = subscription.limits?.playbooks === -1 ? -1 : (subscription.limits?.playbooks || 0);
    const devotionalLimitNum = subscription.limits?.devotionals === -1 ? -1 : (subscription.limits?.devotionals || 0);
    return {
      playbooks: { used: usage.playbooks_generated || 0, limit: playbookLimitNum },
      devotionals: { used: usage.devotionals_generated || 0, limit: devotionalLimitNum },
    } as const;
  }, [subscription, usage]);

  const renderCommunitySection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>COMMUNITY</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} handleShareApp(); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="share-social" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Share with Friends</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} handleLeaveReview(); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="star" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Leave a Review</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} Linking.openURL('https://instagram.com/sifia.app'); }}
          accessibilityRole="button"
          accessibilityLabel="Open Instagram @sifia.app"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="logo-instagram" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Instagram</Text>
          <Text style={[styles.menuValueText, font]}>@sifia.app</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} Linking.openURL('https://www.facebook.com/siFiaapp'); }}
          accessibilityRole="button"
          accessibilityLabel="Open Facebook page siFiaapp"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="logo-facebook" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Facebook</Text>
          <Text style={[styles.menuValueText, font]}>/siFiaapp</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} Linking.openURL('https://x.com/sifiaapp'); }}
          accessibilityRole="button"
          accessibilityLabel="Open X (Twitter) @sifiaapp"
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.twitterIconText}>X</Text>
          </View>
          <Text style={[styles.menuText, font]}>X</Text>
          <Text style={[styles.menuValueText, font]}>@sifiaapp</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLegalPrivacySection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>LEGAL & PRIVACY</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} handleRestorePurchases(); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="refresh" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Restore Purchases</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="document-text" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="lock-closed" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHelpSupportSection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>HELP & SUPPORT</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="help-circle" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>FAQ</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setFeatureModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="bulb" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Suggest a Feature</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setReportBugModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="bug" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Report a Bug</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAppBehaviorSection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>PERMISSIONS</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="notifications" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="calendar-outline" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Auto-sync to Calendar</Text>
          <Switch
            value={preferences.calendar?.autoSync || false}
            onValueChange={async (value) => {
              try { triggerLightHaptic(); } catch {}

              // If enabling auto-sync, request calendar permissions first
              if (value) {
                const { requestCalendarPermissions } = await import('../services/calendarSyncService');
                const hasPermission = await requestCalendarPermissions();

                if (!hasPermission) {
                  // Permission denied, don't enable auto-sync
                  return;
                }

                // Check if user is on Seeker/Free trial plan and trying to enable auto-sync
                const { NewSubscriptionService: SubscriptionService } = await import('../services/NewSubscriptionService');
                try {
                  const subscriptionData = await SubscriptionService.getUserSubscription(user?.id || '');
                  if (subscriptionData.tier === 'seeker' || subscriptionData.tier === 'free_trial') {
                    // Navigate to sales offer with return navigation context
                    navigation.navigate('OnboardingSalesOffer', {
                      source: 'calendar_auto_sync',
                      feature: 'Calendar Auto-Sync & Future Planning',
                      context: 'profile_settings',
                      skipNotificationPreference: true,
                      returnTo: 'UserProfile',
                      title: 'Upgrade to Plan Ahead',
                      subtitle: 'Unlock calendar auto-sync—plus guided journaling, playbooks, and devotionals to support your journey.',
                      benefits: [
                        'Auto-sync time blocks to your calendar seamlessly.',
                        'Plan days ahead with clear focus, to-dos, and time blocks.',
                        'Stay consistent with guided journaling that builds faithful rhythms.',
                        'Gain momentum with personalized playbooks and devotionals.',
                      ],
                    });
                    return;
                  }
                } catch (error) {
                  console.error('Failed to check subscription tier:', error);
                }
              }

              const updatedPreferences = {
                ...preferences,
                calendar: {
                  ...preferences.calendar,
                  autoSync: value,
                },
              };
              const result = await updatePreferences(updatedPreferences);
              if (result.success) {
                setPreferences(updatedPreferences);
              }
            }}
            thumbColor={Colors.hopeWhite}
            trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>System Permissions</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMenuOptions = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>PERSONALIZATION</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setBibleVersionModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="book" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Bible Version</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setWeekStartModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="calendar" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Week Start</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setAppearanceModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="color-palette" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Appearance</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="pulse" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Haptics</Text>
          <Switch
            value={hapticsEnabled}
            onValueChange={onToggleHaptics}
            thumbColor={Colors.hopeWhite}
            trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="volume-high" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Sounds</Text>
          <Switch
            value={soundsEnabled}
            onValueChange={onToggleSounds}
            thumbColor={Colors.hopeWhite}
            trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} onToggleShowTabLabels(!showTabLabelsEnabled); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="albums" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Show Tab Labels</Text>
          <Switch
            value={showTabLabelsEnabled}
            onValueChange={onToggleShowTabLabels}
            thumbColor={Colors.hopeWhite}
            trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFamilyManagementSection = () => {
    // Only show family management if user has family subscription or can create one
    const canManageFamily = Boolean(familyGroup) || subscription?.tier === 'family' || subscription?.tier === 'transformation';
    const isAdmin = familyGroup?.admin_user_id === user?.id;

    if (!canManageFamily) {return null;}

    return (
      <View>
        <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>FAMILY SUBSCRIPTION</Text>
        <View style={styles.menuContainer}>
          {familyGroup ? (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { try { triggerLightHaptic(); } catch {} navigation.navigate('FamilyAdminDashboard'); }}
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="people" size={18} color={Colors.anchorBlue} />
                </View>
                <Text style={[styles.menuText, font]}>
                  {isAdmin ? 'Manage Family' : 'Family Group'}
                </Text>
                <View style={styles.trialBadge}>
                  <Text style={[styles.trialBadgeText, font]}>
                    {familyGroup.current_members}/{familyGroup.max_members}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { try { triggerLightHaptic(); } catch {} navigation.navigate('FamilyInvitation'); }}
                >
                  <View style={styles.menuIconBox}>
                    <Ionicons name="person-add" size={18} color={Colors.anchorBlue} />
                  </View>
                  <Text style={[styles.menuText, font]}>Invite Members</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                try { triggerLightHaptic(); } catch {}
                try {
                  await createFamilyGroup(`${user?.email?.split('@')[0] || 'Family'}'s Group`, 'family-sub-id');
                  await refreshFamilyData();
                } catch (error) {
                  console.error('Failed to create family group:', error);
                }
              }}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="add-circle" size={18} color={Colors.anchorBlue} />
              </View>
              <Text style={[styles.menuText, font]}>Create Family Group</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLogoutSection = () => (
    <View>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={handleLogout}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="log-out" size={18} color={Colors.alertCoral} />
          </View>
          <Text style={[styles.menuText, styles.logoutText, font]}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={editProfileModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        edges={['top']}
        style={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setEditProfileModal(false); }} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Edit Profile</Text>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} handleUpdateProfile(); }}>
            <Text style={[styles.saveText, font]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalDescriptionContainer}
        >
          {/* Avatar with edit inside Edit Profile */}
          <View style={styles.modalAvatarSection}>
            <View style={styles.modalAvatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, styles.modalInitialAvatar]}>
                  <Text style={[styles.modalInitialLetter, font]}>{initialLetter}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.modalEditAvatarButton}
                onPress={handleEditAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <LuPencil size={16} color={Colors.alertCoral} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.sectionLabel, font]}>NAME</Text>
            <View style={styles.nameContainer}>
              <TextInput
                style={[styles.nameField, font]}
                value={(profileForm as any).firstName}
                onChangeText={(text) => setProfileForm({ ...profileForm, firstName: text })}
                placeholder="First name"
                placeholderTextColor={Colors.textGray}
              />
              <View style={styles.nameDivider} />
              <TextInput
                style={[styles.nameField, font]}
                value={(profileForm as any).lastName}
                onChangeText={(text) => setProfileForm({ ...profileForm, lastName: text })}
                placeholder="Last name"
                placeholderTextColor={Colors.textGray}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.sectionLabel, font]}>BIRTH DATE</Text>
            <TouchableOpacity
              style={styles.yearSelector}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                const birthDateStr = (user as any)?.user_metadata?.birth_date || (profileForm as any)?.birthDate;
                if (birthDateStr) {
                  const date = new Date(birthDateStr);
                  if (!isNaN(date.getTime())) {
                    setTempBirthDate(date);
                  } else {
                    // Default to 25 years ago
                    const defaultDate = new Date();
                    defaultDate.setFullYear(defaultDate.getFullYear() - 25);
                    setTempBirthDate(defaultDate);
                  }
                } else {
                  // Default to 25 years ago
                  const defaultDate = new Date();
                  defaultDate.setFullYear(defaultDate.getFullYear() - 25);
                  setTempBirthDate(defaultDate);
                }
                setShowInlineYearPicker((prev) => !prev);
              }}
            >
              <Text style={[styles.yearSelectorText, font]}>
                {(profileForm as any).birthDate ? new Date((profileForm as any).birthDate).toLocaleDateString() : 'Select date'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.textGray} />
            </TouchableOpacity>
            {showInlineYearPicker && (
              <View style={styles.yearPickerContainer}>
                <DateTimePicker
                  value={tempBirthDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                  minimumDate={new Date(1900, 0, 1)}
                  maximumDate={new Date(new Date().getFullYear(), 11, 31)}
                  textColor={Colors.hopeWhite}
                  themeVariant="dark"
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      setTempBirthDate(selectedDate);
                    }
                  }}
                />
                <View style={styles.yearPickerRow}>
                  <TouchableOpacity
                    onPress={() => setShowInlineYearPicker(false)}
                    style={styles.yearPickerCancelButton}
                  >
                    <Text style={[styles.cancelButtonText, font]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setProfileForm({ ...profileForm, birthDate: tempBirthDate.toISOString().split('T')[0] });
                      setShowInlineYearPicker(false);
                    }}
                    style={styles.yearPickerDoneButton}
                  >
                    <Text style={[styles.doneButtonText, font]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Danger zone */}
          <View style={styles.paddingBottom20}>
            <TouchableOpacity
              onPress={() => {

                try { triggerLightHaptic(); } catch {}

                setDeleteAccountModal(true);

              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteAccountButton}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Ionicons name="trash-outline" size={20} color={Colors.alertCoral} style={styles.iconWithMargin} />
              <View style={styles.flex1}>
                <Text style={[styles.deleteButtonText, font]}>Delete Account</Text>
                <Text style={[styles.descriptionText, font]}>This will permanently delete your account and data.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Delete Account Confirmation Modal
  const renderDeleteAccountModal = () => {

    return (
    <Modal
      visible={deleteAccountModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setDeleteAccountModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              try { triggerLightHaptic(); } catch {}
              // Don't clear the birth year when canceling - preserve user input
              setDeleteAccountModal(false);
            }}>
              <Text style={[styles.cancelText, font]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, font]}>Delete Account</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalDescriptionContainer}>
          <Text style={[styles.settingDescription, font]}>For security, please confirm your birth year to proceed with account deletion.</Text>
          <View style={styles.nameContainer}>
            <TextInput
              style={[styles.nameField, font]}
              value={deleteBirthYear}
              onChangeText={setDeleteBirthYear}
              placeholder="Birth year (YYYY)"
              placeholderTextColor={Colors.textGray}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <Text style={[styles.modalDescription, font]}>Enter a valid 4-digit year to continue.</Text>
          <TouchableOpacity
            onPress={() => {

              if (!isValidBirthYear || isDeletingAccount) {

                return;
              }
              handleConfirmDeleteAccount();
            }}
            disabled={!isValidBirthYear || isDeletingAccount}
            style={[
              styles.deleteButton,
              !isValidBirthYear || isDeletingAccount ? styles.deleteButtonDisabled : styles.deleteButtonEnabled,
            ]}
          >
            <Text style={[styles.deleteButtonText, font]}>{isDeletingAccount ? 'Deleting...' : 'Delete my account'}</Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    );
  };

  // Year Picker Modal no longer used (kept for backward compatibility if needed)
  const renderYearPickerModal = () => null;

  const renderWeekStartModal = () => (
    <Modal
      visible={weekStartModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        edges={['top']}
        style={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setWeekStartModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Week Start</Text>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} handleSaveWeekStart(); }}>
            <Text style={[styles.saveText, font]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={[styles.settingDescription, font]}>
            Choose which day your week starts on. This affects calendar views and weekly reports.
          </Text>

          <View style={styles.weekStartOptions}>
            {[
              { key: 'sunday', label: 'Sunday', description: '' },
              { key: 'monday', label: 'Monday', description: '' },
              { key: 'tuesday', label: 'Tuesday', description: '' },
              { key: 'wednesday', label: 'Wednesday', description: '' },
              { key: 'thursday', label: 'Thursday', description: '' },
              { key: 'friday', label: 'Friday', description: '' },
              { key: 'saturday', label: 'Saturday', description: '' },
            ].map((day) => {
              const isSelected = weekStartDraft === day.key;
              return (
                <TouchableOpacity
                  key={day.key}
                  style={[styles.weekStartOption, isSelected && styles.weekStartOptionSelected]}
                  onPress={() => { try { triggerLightHaptic(); } catch {} setWeekStartDraft(day.key as UserPreferences['weekStart']); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set week start to ${day.label}`}
                >
                  <View style={styles.weekStartOptionContent}>
                    <Text style={[styles.weekStartOptionLabel, isSelected && styles.weekStartOptionLabelSelected, font]}>
                      {day.label}
                    </Text>
                    {day.description && (
                      <Text style={[styles.weekStartOptionDescription, font]}>
                        {day.description}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={Colors.alertCoral} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderBibleVersionModal = () => (
    <Modal
      visible={bibleVersionModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        edges={['top','left','right']}
        style={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setBibleVersionModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Bible Version</Text>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} handleSaveBibleVersion(); }}>
            <Text style={[styles.saveText, font]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.bibleModalScrollView}
          contentContainerStyle={styles.bibleModalScrollContent}
          contentInset={styles.bibleModalScrollInset}
          scrollIndicatorInsets={{ bottom: (insets?.bottom || 0), top: 0, left: 0, right: 0 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.settingDescription, font]}>
            Choose your preferred Bible translation. This will be used across devotionals and verses.
          </Text>

          <View style={styles.weekStartOptions}>
            {(() => {
              const versions = [
                { key: 'NIV', label: 'NIV', description: 'New International Version' },
                { key: 'KJV', label: 'KJV', description: 'King James Version' },
                { key: 'ESV', label: 'ESV', description: 'English Standard Version' },
                { key: 'NLT', label: 'NLT', description: 'New Living Translation' },
                { key: 'NKJV', label: 'NKJV', description: 'New King James Version' },
                { key: 'NASB', label: 'NASB', description: 'New American Standard Bible' },
                { key: 'CSB', label: 'CSB', description: 'Christian Standard Bible' },
                { key: 'NRSV', label: 'NRSV', description: 'New Revised Standard Version' },
                { key: 'MSG', label: 'MSG', description: 'The Message (paraphrase)' },
                { key: 'AMP', label: 'AMP', description: 'Amplified Bible' },
              ].sort((a, b) => a.label.localeCompare(b.label));
              return versions.map((ver) => {
                const isSelected = bibleVersionDraft === ver.key;
                return (
                  <TouchableOpacity
                    key={ver.key}
                    style={[styles.weekStartOption, isSelected && styles.weekStartOptionSelected]}
                    onPress={() => { try { triggerLightHaptic(); } catch {} setBibleVersionDraft(ver.key); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set Bible version to ${ver.label}`}
                  >
                    <View style={styles.weekStartOptionContent}>
                      <Text style={[styles.weekStartOptionLabel, isSelected && styles.weekStartOptionLabelSelected, font]}>
                        {ver.label}
                      </Text>
                      {ver.description && (
                        <Text style={[styles.weekStartOptionDescription, font]}>
                          {ver.description}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={Colors.alertCoral} />
                    )}
                  </TouchableOpacity>
                );
              });
            })()}
          </View>

          {/* Footer spacer to clear the home indicator so last item is fully visible */}
          <View style={{ height: (insets?.bottom || 0) + 8 }} />
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
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(false); }}>
            <Text style={[styles.cancelText, font]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Notifications</Text>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} handleUpdatePreferences(); }}>
            <Text style={[styles.saveText, font]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingGroup}>
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Playbook Reminders</Text>
              <Switch
                value={notificationPrefs?.playbook_steps ?? false}
                onValueChange={(value) => updatePref('playbook_steps', value)}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Devotional Reminders</Text>
              <Switch
                value={notificationPrefs?.devotional_reminders ?? false}
                onValueChange={(value) => updatePref('devotional_reminders', value)}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Prayer Reminders</Text>
              <Switch
                value={notificationPrefs?.prayer_reminders ?? false}
                onValueChange={(value) => updatePref('prayer_reminders', value)}
                disabled={!notificationPrefs}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Journal Prompts</Text>
              <Switch
                value={notificationPrefs?.journal_prompts ?? false}
                onValueChange={(value) => updatePref('journal_prompts', value)}
                disabled={!notificationPrefs}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Progress Updates</Text>
              <Switch
                value={notificationPrefs?.milestone_celebrations ?? false}
                onValueChange={(value) => updatePref('milestone_celebrations', value)}
                disabled={!notificationPrefs}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Streak Alerts</Text>
              <Switch
                value={notificationPrefs?.streak_alerts ?? false}
                onValueChange={(value) => updatePref('streak_alerts', value)}
                disabled={!notificationPrefs}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            {subscription?.tier === 'free_trial' && (
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, font]}>Trial Notifications</Text>
                <Switch
                  value={notificationPrefs?.trial_notifications ?? false}
                  onValueChange={(value) => updatePref('trial_notifications', value)}
                  disabled={!notificationPrefs}
                  trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                  thumbColor={Colors.hopeWhite}
                />
              </View>
            )}

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Prayer Request Alerts</Text>
              <Switch
                value={notificationPrefs?.prayer_requests ?? false}
                onValueChange={(value) => updatePref('prayer_requests', value)}
                disabled={!notificationPrefs}
                trackColor={{ false: theme.colors.switchTrackActive, true: theme.colors.switchTrackActive }}
                thumbColor={Colors.hopeWhite}
              />
            </View>

            <View style={styles.settingItemColumnNotification}>
              <Text style={[styles.settingLabel, font]}>Quiet Hours</Text>
              <Text style={[styles.settingHint, font]}>We'll pause notifications during these times.</Text>
              <View style={styles.quietHoursContainer}>
                <TouchableOpacity
                  style={styles.timePickerRow}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}

                    showNativeTimePicker('start');
                  }}
                >
                  <Text style={[styles.timeLabel, font]}>Start</Text>
                  <Text style={[styles.timeValue, font]}>
                    {notificationPrefs?.quiet_hours_start ? formatTo12h(notificationPrefs.quiet_hours_start) : '10:00 PM'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerRow}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}

                    showNativeTimePicker('end');
                  }}
                >
                  <Text style={[styles.timeLabel, font]}>End</Text>
                  <Text style={[styles.timeValue, font]}>
                    {notificationPrefs?.quiet_hours_end ? formatTo12h(notificationPrefs.quiet_hours_end) : '7:00 AM'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      {showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}
    </Modal>
  );

  // Remove loading gate; render UI immediately

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.container,
        { backgroundColor: theme.colors.hopeWhite },
      ]}
    >
      {/* Fixed white header area with extra padding */}
      <View
        style={[
          styles.headerWrapper,
          styles.paddingTop22,
          { backgroundColor: theme.colors.hopeWhite },
        ]}
      >
        {renderProfileHeader()}
      </View>

      {/* Body with rounded top; only its content scrolls */}
      <View style={[styles.bodyContainer, { backgroundColor: theme.colors.anchorBlue }]}>
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: (insets?.bottom || 0) + 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Debug Menu - DEV ONLY */}
          {__DEV__ && <TrialDebugMenu onRefresh={onRefresh} />}

          {/* Badges removed from main container */}
          {renderMenuOptions()}
          {renderFamilyManagementSection()}
          {renderAppBehaviorSection()}
          {renderCommunitySection()}
          {renderHelpSupportSection()}
          {renderLegalPrivacySection()}
          {renderLogoutSection()}
        </ScrollView>
      </View>

      {renderEditProfileModal()}
      {renderDeleteAccountModal()}
      {renderYearPickerModal()}
      {renderWeekStartModal()}
      {renderBibleVersionModal()}
      {renderAppearanceModal()}
      {renderSettingsModal()}
      {renderReportBugModal()}
      {renderFeatureModal()}
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
    paddingTop: 50,
    paddingBottom: 0,
  },
  bodyContainer: {
    marginTop: 0,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    flex: 1,
  },
  headerWrapper: {
    // extra space so the header isn't cut by the notch
    paddingTop: 18,
  },
  // Settings & Appearance modal chips
  settingItemColumn: {
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  settingChipsRow: {
    flexDirection: 'row',
    gap: 8 as any,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipActive: {
    backgroundColor: Colors.alertCoral,
  },
  chipText: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.hopeWhite,
  },
  fontNote: {
    fontSize: 12,
    color: Colors.textGray,
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
  modalEditAvatarButton: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: Colors.hopeWhite,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
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
    color: Colors.textGray,
    textAlign: 'center',
  },
  badgesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  fullBleedContainer: {
    marginHorizontal: -20,
  },
  fullBleedContent: {
    paddingHorizontal: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    alignItems: 'center',
    marginRight: 16,
    width: 72,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.modalBlue,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeEmoji: {
    fontSize: 20,
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
    color: Colors.anchorBlue,
    fontWeight: '500',
  },
  menuContainer: {
    marginHorizontal: 0,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'visible',
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  menuItemSpaced: {
    paddingVertical: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 10,
  },
  menuValueText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginRight: 8,
  },
  menuIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: Colors.alertCoral,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  saveText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  bugInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 30,
    padding: 12,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  bugHint: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.6,
  },
  sectionLabelRight: {
    textAlign: 'left',
    marginLeft: 20,
    marginBottom: 8,
  },
  nameContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
  },
  nameField: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  nameDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Edit Profile modal avatar styles
  modalAvatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalAvatarContainer: {
    width: 96,
    height: 96,
    position: 'relative',
  },
  modalAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ccc',
  },
  modalInitialAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
  },
  modalInitialLetter: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.hopeWhite,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.hopeWhite,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  settingValue: {
    fontSize: 16,
    color: Colors.textGray,
    textTransform: 'capitalize',
  },
  settingItemColumnNotification: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gentleBorder,
  },
  settingHint: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  quietHoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.45,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginRight: 8,
  },
  timeValue: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  yearPickerModalContainer: {
    zIndex: 9999,
    elevation: 9999,
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
    color: Colors.textGray,
  },
  usageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageCard: {
    backgroundColor: Colors.sanctuaryWhite,
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
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: 12,
    color: Colors.textGray,
  },
  upgradeButton: {
    backgroundColor: Colors.anchorBlue,
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
  // Compact stats (Streak & Badges only)
  compactStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  compactStatCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.modalBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flex: 0.48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  compactStatContent: {
    marginLeft: 0,
    marginTop: 6,
    alignItems: 'center',
  },
  compactStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.hopeWhite,
  },
  compactStatLabel: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  // Modern counters for Playbooks/Devotionals
  countersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  countersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  counterCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    flex: 0.48,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  counterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterTitle: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  counterNumbers: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.hopeWhite,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.lightPurple,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
    width: '82%',
    alignSelf: 'center',
  },
  progressValue: {
    height: 8,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 6,
  },
  progressValueAlt: {
    height: 8,
    backgroundColor: Colors.devotionalPurple,
    borderRadius: 6,
  },
  // Week Start Modal Styles
  settingDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
    lineHeight: 20,
  },
  weekStartOptions: {
    gap: 12,
  },
  weekStartOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  weekStartOptionSelected: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderColor: Colors.alertCoral,
  },
  weekStartOptionContent: {
    flex: 1,
  },
  weekStartOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  weekStartOptionLabelSelected: {
    color: Colors.alertCoral,
  },
  weekStartOptionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  yearSelectorText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  yearPickerList: {
    maxHeight: 300,
  },
  yearOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  yearOptionSelected: {
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  yearOptionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  yearOptionTextSelected: {
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  spacer: {
    height: 12,
  },
  twitterIconText: {
    color: Colors.anchorBlue,
    fontSize: 16,
    fontWeight: '800',
  },
  bibleModalScrollView: {
    flex: 1,
  },
  bibleModalScrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  bibleModalScrollInset: {
    bottom: 0,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  paddingBottom20: {
    paddingBottom: 20,
  },
  yearPickerContainer: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  yearPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  yearPickerCancelButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  yearPickerDoneButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  modalSpacer: {
    width: 48,
  },
  modalDescription: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 6,
  },
  modalDescriptionContainer: {
    paddingBottom: 20,
  },
  deleteButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  deleteButtonDisabled: {
    backgroundColor: 'rgba(255,107,107,0.3)',
  },
  deleteButtonEnabled: {
    backgroundColor: Colors.alertCoral,
  },
  // Icon styles
  iconWithMargin: {
    marginRight: 8,
  },
  // Text styles
  cancelButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  descriptionText: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 4,
  },
  flex1: {
    flex: 1,
  },
  paddingTop22: {
    paddingTop: 22,
  },
  // Removed test button styles
});

export default withErrorBoundary(UserProfileScreen, 'UserProfileScreen');
