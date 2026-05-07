import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Logger } from '../utils/ProductionLogger';
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
  // Switch removed - using custom toggle
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { experiencePreferences } from '../services/experiencePreferences';
import { initSound, releaseSound } from '../utils/soundUtils';
import { supabase } from '../services/supabaseClient';

// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { userApi } from '../services/userApi';
import ProfileHeader from '../components/profile/ProfileHeader';
import { pickImageLocal, uploadAvatar } from '../services/avatarService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from '../services/faithPointsEvents';
import { accountDeletionService } from '../services/accountDeletionService';
import SubscriptionPlanModal from '../components/SubscriptionPlanModal';
import { UserProgress, UserPreferences } from '../types/auth';
import StreakTracker from '../components/dashboard/StreakTracker';
// Types for subscription - using inline types to avoid import issues
interface Subscription {
  id: string;
  tier: string;
  status: string;
  platform_subscription_id?: string;
  limits?: {
    playbooks: number;
    devotionals: number;
  };
  subscription_display_name?: string;
  billing_cycle?: 'monthly' | 'annual';
}

interface UsageTracking {
  playbooks_generated: number;
  devotionals_generated: number;
}
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { notificationManagementService, NotificationPreferences } from '../services/notificationManagementService';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
// POST-LAUNCH: import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { reportBug } from '../services/bugReportService';
import { reportFeature } from '../services/featureRequestService';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { pushNotificationService } from '../services/pushNotificationService';
import { navigateFromRoot } from '../utils/navigationHelpers';
import { requestReview } from '../services/reviewPromptService';

const { width } = Dimensions.get('window');

// Store metadata for review links
// App Store ID from sifia.app
const APPLE_APP_ID = '6751785713';
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

  const navigateToSalesOffer = useCallback((params: Record<string, unknown>) => {
    const didNavigate = navigateFromRoot(navigation, 'OnboardingSalesOffer', params);
    if (!didNavigate) {
      Logger.warn('[UserProfileScreen] Unable to navigate to sales offer', {
        component: 'UserProfileScreen',
      });
    }
  }, [navigation]);

  // POST-LAUNCH: Family subscription hook
  // const {
  //   familyGroup,
  //   createFamilyGroup,
  // } = useFamilySubscription();
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

  // Notification preferences from the notification management service
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);

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


  // Local state for instant avatar display
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [modalImageLoadFailed, setModalImageLoadFailed] = useState(false);

  // Use custom avatar URL from user profile if available, but only allow local file URIs
  const avatarUrl = (user as any)?.user_metadata?.avatar_url;
  const safeAvatarUrl = avatarUrl && avatarUrl.startsWith('file://') ? avatarUrl : null;

  // Use local avatar URL if available (instant), otherwise fall back to auth metadata
  const displayAvatarUrl = localAvatarUrl || safeAvatarUrl;

  // Reset modal image load state when avatar URL changes
  useEffect(() => {
    setModalImageLoadFailed(false);
  }, [displayAvatarUrl]);

    const initialLetter = useMemo(() => {
    const first = (profileForm as any)?.firstName || (user as any)?.user_metadata?.first_name || '';
    const last = (profileForm as any)?.lastName || (user as any)?.user_metadata?.last_name || '';
    const fallback = (user as any)?.user_metadata?.full_name || (user as any)?.email || 'U';
    const name = [first, last].filter(Boolean).join(' ') || fallback;
    return String(name).trim().charAt(0).toUpperCase();
  }, [profileForm, user]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        return;
      }

      (async () => {
        try {
          const { AppleStoreKitService } = await import('../services/AppleStoreKitService');
          const storeKit = AppleStoreKitService.getInstance();
          await storeKit.checkAndSyncSubscriptionStatus(user.id);

          // CRITICAL: Force refresh subscription data from database after sync
          // This ensures the UI shows the correct tier, especially after cancellation
          const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id, true); // Force fresh data
          setSubscription(subscriptionData as any);

          Logger.info('[UserProfileScreen] Subscription refreshed on focus', {
            component: 'UserProfileScreen',
            tier: subscriptionData.tier,
            status: subscriptionData.status,
          });
        } catch (_error) {
          Logger.error('[UserProfileScreen] Failed to sync subscription status on focus', _error as Error, {
            component: 'UserProfileScreen',
            action: 'sync_subscription_on_focus',
          });
        }
      })();
    }, [user?.id])
  );

  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showInlineYearPicker, setShowInlineYearPicker] = useState(false);
  const [systemPermissionsModal, setSystemPermissionsModal] = useState(false);
  const [subscriptionPlanModal, setSubscriptionPlanModal] = useState(false);
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

  const handleConfirmDeleteAccount = useCallback(async () => {
    Logger.debug('[UserProfileScreen] Delete account initiated', {
      component: 'UserProfileScreen',
      hasUser: !!user,
      userId: user?.id,
    });

    try {
      try { triggerLightHaptic(); } catch {}

      if (!user?.id) {
        Logger.error('[UserProfileScreen] No user ID found', undefined, {
          component: 'UserProfileScreen',
        });
        Alert.alert('Authentication Error', 'Please sign in to continue.');
        return;
      }

      Logger.debug('[UserProfileScreen] Starting account deletion process', {
        component: 'UserProfileScreen',
        userId: user.id,
      });

      // Show detailed confirmation alert
      Alert.alert(
        'Delete Account',
        'This will start the account deletion process. Your account will be permanently deleted after a 30-day grace period. You can cancel anytime during this period.\n\nThis action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start Deletion',
            style: 'destructive',
            onPress: async () => {
              Logger.debug('[UserProfileScreen] User confirmed deletion', {
                component: 'UserProfileScreen',
              });
              setIsDeletingAccount(true);
              try {
                // Use the enterprise-grade deletion service
                const result = await accountDeletionService.initiateAccountDeletion({
                  userId: user.id,
                  birthYear: '', // No longer required
                });

                if (result.success) {
                  Logger.info('[UserProfileScreen] Account deletion initiated successfully', {
                    component: 'UserProfileScreen',
                    deletionId: result.deletionId,
                    gracePeriodEnds: result.gracePeriodEnds,
                  });

                  // Close modals and reset state
                  setDeleteAccountModal(false);
                  setEditProfileModal(false);
                  setIsDeletingAccount(false);

                  // Show detailed success message
                  Alert.alert(
                    'Deletion Started',
                    result.message || 'Your account will be permanently deleted after 30 days. You can contact support anytime to cancel this process.',
                    [
                      {
                        text: 'I Understand',
                        onPress: async () => {
                          // Sign out the user after they acknowledge
                          await signOut();
                        },
                      },
                    ]
                  );
                } else {
                  throw new Error(result.message || 'Failed to initiate account deletion');
                }
              } catch (e: any) {
                Logger.error('Error initiating account deletion', e as Error, {
                  component: 'UserProfileScreen',
                  error: e.message,
                });

                let errorMessage = 'Unable to delete your account at this time. Please try again or contact support.';
                if (e.message?.includes('already in progress')) {
                  errorMessage = 'Account deletion is already in progress. Please contact support if you want to cancel.';
                }

                Alert.alert(
                  'Deletion Failed',
                  errorMessage,
                  [
                    {
                      text: 'OK',
                    },
                  ]
                );
              } finally {
                setIsDeletingAccount(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Logger.error('Unexpected error in handleConfirmDeleteAccount', error as Error, {
        component: 'UserProfileScreen',
      });
      setIsDeletingAccount(false);
    }
  }, [user, signOut]);

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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const success = await notificationManagementService.updateNotificationPreferences(defaultPrefs);
        if (success) {
          prefs = defaultPrefs;
        }
      }

      setNotificationPrefs(prefs);
    } catch (_error) {
      Logger.error('Error loading notification preferences', _error as Error, {
      component: 'UserProfileScreen',
    });
      // Set minimal defaults on error
      setNotificationPrefs({
        user_id: user.id,
        playbook_steps: false,
        devotional_reminders: false,
        trial_notifications: false,
        prayer_request_alerts: false,
        prayer_requests: false,
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
        // Check and apply monthly reset before reading — ensures profile always shows
        // current-period counts even if the billing webhook hasn't fired yet.
        await NewSubscriptionService.checkAndResetMonthlyUsage(user.id);

        const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id, true); // Force fresh data
        setSubscription(subscriptionData as any);

        const usageData = {
          playbooks_generated: subscriptionData.playbooks_used || 0,
          devotionals_generated: subscriptionData.devotionals_used || 0,
        };
        setUsage(usageData);

        // Auto-disable calendar autoSync if user is on seeker tier
        // Check user metadata directly since preferences state may not be loaded yet
        const currentPrefs = (user as any)?.user_metadata?.preferences || {};
        if (subscriptionData.tier === 'seeker' && currentPrefs.calendar?.autoSync === true) {
          const updatedPreferences = {
            ...currentPrefs,
            calendar: {
              ...currentPrefs.calendar,
              autoSync: false,
            },
          };
          const result = await updatePreferences(updatedPreferences);
          if (result.success) {
            setPreferences(updatedPreferences);
            Logger.info('Auto-disabled calendar autoSync for seeker tier', {
              component: 'UserProfileScreen',
              userId: user.id,
            });
          }
        }

      } catch (_error) {
        Logger.error('Failed to load subscription data', _error as Error, {
      component: 'UserProfileScreen',
    });
      }

      // Load notification preferences separately to avoid blocking
      loadNotificationPreferences().catch(error => {
        Logger.error('Failed to load notification preferences', error as Error, {
      component: 'UserProfileScreen',
    });
      });

    } catch (_error) {
      Logger.error('Failed to load profile data', _error as Error, {
      component: 'UserProfileScreen',
    });
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

                // Auto-dismiss loading alert and show success
                setTimeout(() => {
                  Alert.alert('Success', result.message, [{ text: 'OK' }]);
                }, 100);
              } else {
                Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
              }
            } catch (_error) {
              Logger.error('Restore purchases error', _error as Error, {
      component: 'UserProfileScreen',
    });
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
  const [isSavingCalendarAutoSync, setIsSavingCalendarAutoSync] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [weekStartModal, setWeekStartModal] = useState(false);
  const [weekStartDraft, setWeekStartDraft] = useState<UserPreferences['weekStart']>('sunday');
  // Bible Version modal and draft

  const [bibleVersionModal, setBibleVersionModal] = useState(false);
  const [bibleVersionDraft, setBibleVersionDraft] = useState<string>('NASB');
  const [isSavingBibleVersion, setIsSavingBibleVersion] = useState(false);
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

  // User preferences state
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
      try { triggerSuccessHaptic(); } catch {}
      Alert.alert('Thanks!', 'Your bug report was sent successfully.');
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to submit bug report. Please try again later.';

      Logger.error('[ReportBug] Failed to submit bug report', _error as Error, {
        component: 'UserProfileScreen',
      });

      Alert.alert('Error', errorMessage);
    }
  };


  const openExternalLink = useCallback(async (url: string) => {
    try { triggerLightHaptic(); } catch {}

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unable to open link', 'Please try again later.');
        return;
      }

      await Linking.openURL(url);
    } catch (_error) {
      Logger.error('Failed to open external link', _error as Error, {
        component: 'UserProfileScreen',
        url,
      });
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  }, []);

  // Try in-app review first, with gentle app-level gating, then fallback to store page
  const handleLeaveReview = async () => {
    try {
      await requestReview({ triggerSource: 'manual_profile_button' });
    } catch (error) {
      Logger.error('[UserProfileScreen] Error in handleLeaveReview', error as Error);
    }
  };

  // Share app with friends using platform-appropriate store link (with fallback)
  const handleShareApp = async () => {
    try {
      const iosUrl = APPLE_APP_ID ? `https://apps.apple.com/app/id${APPLE_APP_ID}` : 'https://sifia.app';
      const androidUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
      const message = `I've been using siFia to reflect, pray, and process real-life moments. Try it here: ${url}`;

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

      const uploadedAvatarUrl = await uploadAvatar(user, picked);

      // Set local avatar immediately for instant display
      setLocalAvatarUrl(uploadedAvatarUrl);

      // Update auth metadata in background (non-blocking)
      updateProfile({ avatar_url: uploadedAvatarUrl }).then(_result => {
        /* Background update completed */
        // Clear local state once auth is updated
        setLocalAvatarUrl(null);
      }).catch(_error => {
        /* Handle background update error silently */
      });
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      Logger.error('[Avatar] Error', e as Error, {
        component: 'UserProfileScreen',
      });
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
    } catch (_error) {
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
      try { triggerSuccessHaptic(); } catch {}
      Alert.alert('Thanks!', 'Your feature suggestion was sent successfully.');
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to submit feature suggestion. Please try again later.';

      Logger.error('[FeatureRequest] Failed to submit', _error as Error, {
        component: 'UserProfileScreen',
      });

      Alert.alert('Error', errorMessage);
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

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
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

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
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

  // Reload preferences whenever the settings modal opens
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

    const handlePointsUpdate = (_data?: any) => {
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
    faithPointsEvents.on(FAITH_POINTS_EVENTS.BADGE_UNLOCKED, handlePointsUpdate);

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      faithPointsEvents.off(FAITH_POINTS_EVENTS.POINTS_UPDATED, handlePointsUpdate);
      faithPointsEvents.off(FAITH_POINTS_EVENTS.LEVEL_UP, handlePointsUpdate);
      faithPointsEvents.off(FAITH_POINTS_EVENTS.BADGE_UNLOCKED, handlePointsUpdate);
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
      const birthDateStr = String((profileForm as any).birthDate || '').trim();

      // Validate birth date if provided
      if (birthDateStr) {
        const parsed = new Date(birthDateStr);
        if (isNaN(parsed.getTime())) {
          Alert.alert('Invalid birth date', 'Please select a valid birth date.');
          return;
        }
        const year = parsed.getFullYear();
        const nowYear = new Date().getFullYear();
        if (year < 1900 || year > nowYear) {
          Alert.alert('Invalid birth date', 'Please select a birth date between 1900 and the current year.');
          return;
        }
      }

      // Persist to Supabase auth user_metadata via context
      const result = await (updateProfile as any)({
        full_name: full || undefined,
        first_name: first || undefined,
        last_name: last || undefined,
        // Store full birth date in auth user_metadata for UI reads
        birth_date: birthDateStr || undefined,
      });

      if (result?.success === false) {
        throw new Error(result?.error?.message || 'Failed to update profile');
      }

      // Also sync full birth date to user_profiles.date_of_birth for server-side logic
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (accessToken && birthDateStr) {
          await userApi.updateProfile(accessToken, { dateOfBirth: birthDateStr } as any);
        }
      } catch (e) {
        // Non-fatal: log but do not block the user from saving profile
        Logger.warn('[UserProfile] Failed to sync birth date to user_profiles', {
          component: 'UserProfileScreen',
          action: 'sync_birth_date_profile',
          details: e instanceof Error ? e.message : String(e),
        } as any);
      }

      // Close modal
      setEditProfileModal(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile');
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
    } catch (_error) {
      Alert.alert('Error', 'Failed to update week start');
    }
  };

  // Save handler for Bible Version (no success alert)
  const handleSaveBibleVersion = async () => {
    try {
      setIsSavingBibleVersion(true);

      const updatedPreferences = {
        ...preferences,
        content: { ...preferences.content, bibleVersion: bibleVersionDraft },
      };

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 5000); // 5 second timeout
      });

      const result = await Promise.race([updatePreferences(updatedPreferences), timeoutPromise]) as any;

      if (result.success) {
        setPreferences(updatedPreferences);
        setBibleVersionModal(false);
      } else {
        Logger.error('[UserProfile] Failed to save Bible version', result.error as Error, {
        component: 'UserProfileScreen',
        });
        Alert.alert('Error', result.error?.message || 'Failed to update Bible version');
      }
    } catch (_error) {
      Logger.error('[UserProfile] Error saving Bible version', _error as Error, {
        component: 'UserProfileScreen',
      });
      // Show error immediately instead of waiting
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingBibleVersion(false);
    }
  };

  const handleToggleCalendarAutoSync = useCallback(async () => {
    if (isSavingCalendarAutoSync) {
      return;
    }

    try {
      try { triggerLightHaptic(); } catch {}
      setIsSavingCalendarAutoSync(true);

      const currentValue = preferences.calendar?.autoSync || false;
      const newValue = !currentValue;

      if (newValue) {
        try {
          const subscriptionData = await NewSubscriptionService.getUserSubscription(user?.id || '');
          if (subscriptionData.tier === 'seeker') {
            navigateToSalesOffer({
              source: 'calendar_auto_sync',
              feature: 'Calendar Auto-Sync & Future Planning',
              context: 'profile_settings',
              skipNotificationPreference: true,
              dismissBehavior: 'goBack',
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
        } catch (_error) {
          Logger.error('Failed to check subscription tier', _error as Error, {
            component: 'UserProfileScreen',
          });
        }

        const { requestCalendarPermissions } = await import('../services/calendarSyncService');
        const hasPermission = await requestCalendarPermissions();

        if (!hasPermission) {
          Alert.alert(
            'Calendar Access Required',
            'To sync your time blocks to your calendar, please enable calendar access for siFia.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                },
              },
            ]
          );
          return;
        }
      }

      const updatedPreferences = {
        ...preferences,
        calendar: {
          ...preferences.calendar,
          autoSync: newValue,
        },
      };
      const result = await updatePreferences(updatedPreferences);
      if (result.success) {
        setPreferences(updatedPreferences);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update calendar auto-sync');
      }
    } catch (_error) {
      Logger.error('Failed to update calendar auto-sync', _error as Error, {
        component: 'UserProfileScreen',
      });
      Alert.alert('Error', 'Failed to update calendar auto-sync. Please try again.');
    } finally {
      setIsSavingCalendarAutoSync(false);
    }
  }, [
    isSavingCalendarAutoSync,
    preferences,
    updatePreferences,
    user?.id,
    navigateToSalesOffer,
  ]);

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

    } catch (_error) {
      Logger.error('❌ Logout failed', _error as Error, {
      component: 'UserProfileScreen',
    });
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
          // POST-LAUNCH: case 'family':
          //   return 'siFia Family';
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

      // Add "Usage" to the plan label
      planLabel = `${planLabel} Usage`;
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
    const normalizeLimit = (limitValue?: number | null) => {
      if (typeof limitValue !== 'number') {return 0;}
      if (limitValue < 0) {return -1;}
      if (limitValue >= 999999) {return -1;}
      return limitValue;
    };
    const playbookLimitNum = normalizeLimit(subscription.limits?.playbooks);
    const devotionalLimitNum = normalizeLimit(subscription.limits?.devotionals);
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { try { triggerLightHaptic(); } catch {} Linking.openURL('https://www.youtube.com/@sifiaapp'); }}
          accessibilityRole="button"
          accessibilityLabel="Open YouTube channel @sifiaapp"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="logo-youtube" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>YouTube</Text>
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
          onPress={() => { openExternalLink('https://sifia.app/legal/terms'); }}
          accessibilityLabel="Open Terms of Service"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="document-text" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { openExternalLink('https://sifia.app/legal/privacy'); }}
          accessibilityLabel="Open Privacy Policy"
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
          onPress={() => { openExternalLink('https://sifia.app/#faq'); }}
          accessibilityLabel="Open Frequently Asked Questions"
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
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setSettingsModal(true);
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="notifications" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={handleToggleCalendarAutoSync}
          disabled={isSavingCalendarAutoSync}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="calendar-outline" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Auto-sync to Calendar</Text>
          <TouchableOpacity
            onPress={handleToggleCalendarAutoSync}
            disabled={isSavingCalendarAutoSync}
            style={styles.switchContainer}
          >
            <View style={[
              styles.switchTrack,
              (preferences.calendar?.autoSync || false) ? styles.switchTrackActive : styles.switchTrackInactive,
            ]}>
              <View style={[
                styles.switchThumb,
                { transform: [{ translateX: (preferences.calendar?.autoSync || false) ? 20 : 0 }] },
              ]} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setSystemPermissionsModal(true);
          }}
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

  const renderSubscriptionSection = () => {
    if (!subscription) {return null;}

    const tier = subscription.tier?.replace(/_annual$/, '') || 'seeker';
    // For trials, use billing_cycle field; for paid tiers, check tier suffix
    const isAnnual = subscription.tier === 'free_trial'
      ? subscription.billing_cycle === 'annual'
      : subscription.tier?.includes('_annual') || false;
    const billingPeriod = isAnnual ? 'Annual' : 'Monthly';
    const isSeeker = tier === 'seeker';
    const isSpark = tier === 'spark';
    const isGrowth = tier === 'growth';
    const isTransformation = tier === 'transformation';

    // Check if user is eligible for free trial
    // const isEligibleForTrial = subscription.status !== 'trialing' &&
    //                            subscription.status !== 'active' &&
    //                            !(subscription as any)?.has_used_trial;

    const tierDisplayName = isSeeker ? 'Seeker' :
                           isSpark ? 'Spark Plan' :
                           isGrowth ? 'Growth Plan' :
                           isTransformation ? 'Transformation Plan' :
                           tier === 'free_trial' ? subscription.subscription_display_name || 'Free Trial Plan' : `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`;

    const handleSubscriptionTap = () => {
      try { triggerLightHaptic(); } catch {}
      setSubscriptionPlanModal(true);
    };

    return (
      <View>
        <Text style={[styles.sectionLabel, styles.sectionLabelRight, font]}>SUBSCRIPTION</Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemSpaced]}
            onPress={handleSubscriptionTap}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name="diamond" size={18} color={Colors.anchorBlue} />
            </View>
            <View style={styles.flex1}>
              <Text style={[styles.menuText, font]}>{tierDisplayName}</Text>
                          </View>
            {isSeeker ? (
              <Text style={[styles.menuValueText, font, styles.iconWithMargin]}>Free Plan</Text>
            ) : (
              <Text style={[styles.menuValueText, font, styles.iconWithMargin]}>{billingPeriod}</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemSpaced]}
            onPress={() => { try { triggerLightHaptic(); } catch {} handleRestorePurchases(); }}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name="refresh" size={18} color={Colors.anchorBlue} />
            </View>
            <Text style={[styles.menuText, font]}>Restore Purchases</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
          <TouchableOpacity
            onPress={() => { try { triggerLightHaptic(); } catch {} onToggleHaptics(!hapticsEnabled); }}
            style={styles.switchContainer}
          >
            <View style={[
              styles.switchTrack,
              hapticsEnabled ? styles.switchTrackActive : styles.switchTrackInactive,
            ]}>
              <View style={[
                styles.switchThumb,
                { transform: [{ translateX: hapticsEnabled ? 20 : 0 }] },
              ]} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(true); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="volume-high" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Sounds</Text>
          <TouchableOpacity
            onPress={() => { try { triggerLightHaptic(); } catch {} onToggleSounds(!soundsEnabled); }}
            style={styles.switchContainer}
          >
            <View style={[
              styles.switchTrack,
              soundsEnabled ? styles.switchTrackActive : styles.switchTrackInactive,
            ]}>
              <View style={[
                styles.switchThumb,
                { transform: [{ translateX: soundsEnabled ? 20 : 0 }] },
              ]} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => { try { triggerLightHaptic(); } catch {} onToggleShowTabLabels(!showTabLabelsEnabled); }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="albums" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={[styles.menuText, font]}>Show Tab Labels</Text>
          <TouchableOpacity
            onPress={() => { try { triggerLightHaptic(); } catch {} onToggleShowTabLabels(!showTabLabelsEnabled); }}
            style={styles.switchContainer}
          >
            <View style={[
              styles.switchTrack,
              showTabLabelsEnabled ? styles.switchTrackActive : styles.switchTrackInactive,
            ]}>
              <View style={[
                styles.switchThumb,
                { transform: [{ translateX: showTabLabelsEnabled ? 20 : 0 }] },
              ]} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </View>
  );

  // POST-LAUNCH: Family Management Section - Removed for MVP launch
  // Function preserved in feature/family-subscription branch

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
              {displayAvatarUrl && !modalImageLoadFailed ? (
                <Image
                  source={{ uri: displayAvatarUrl }}
                  style={styles.modalAvatar}
                  onError={(_error) => {
                    setModalImageLoadFailed(true);
                  }}
                  onLoad={() => {
                    setModalImageLoadFailed(false);
                  }}
                />
              ) : (
                <View style={[styles.modalAvatar, styles.modalInitialAvatar]}>
                  <Text style={[styles.modalInitialLetter, font]}>{initialLetter}</Text>
                </View>
              )}
              {/* Hidden edit avatar button per user request */}
              {/* <TouchableOpacity
                style={styles.modalEditAvatarButton}
                onPress={handleEditAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <LuPencil size={16} color={Colors.alertCoral} />
              </TouchableOpacity> */}
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
                {(profileForm as any).birthDate ? new Date((profileForm as any).birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date'}
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
                // Close edit profile modal if it's open
                setEditProfileModal(false);
                setDeleteAccountModal(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteAccountButton}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Ionicons name="trash-outline" size={20} color={Colors.alertCoral} style={styles.deleteAccountIcon} />
              <View style={styles.deleteAccountTextContainer}>
                <Text style={[styles.deleteAccountTitle, font]}>Delete Account</Text>
                <Text style={[styles.deleteAccountDescription, font]}>This will permanently delete your account and data.</Text>
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
        transparent={false}
        onRequestClose={() => setDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Close button - upper right */}
            <TouchableOpacity
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setDeleteAccountModal(false);
              }}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, font]}>Delete Account</Text>
            </View>

            <View style={styles.modalDescriptionContainer}>
              <Text style={[styles.settingDescription, font]}>Are you sure you want to delete your account? This action cannot be undone.</Text>

              {/* Grace period information */}
              <View style={styles.gracePeriodInfo}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textGray} />
                <Text style={[styles.gracePeriodText, font]}>
                  Your account will be scheduled for deletion after a 30-day grace period. You can cancel anytime during this period by contacting support.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (isDeletingAccount) {
                    return;
                  }
                  handleConfirmDeleteAccount();
                }}
                disabled={isDeletingAccount}
                style={[
                  styles.deleteButton,
                  isDeletingAccount ? styles.deleteButtonDisabled : styles.deleteButtonEnabled,
                ]}
              >
                <Text style={[styles.deleteButtonText, font]}>{isDeletingAccount ? 'Starting deletion...' : 'Start account deletion'}</Text>
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
          <TouchableOpacity
            onPress={() => { try { triggerLightHaptic(); } catch {} handleSaveBibleVersion(); }}
            disabled={isSavingBibleVersion}
          >
            <Text style={[styles.saveText, font, isSavingBibleVersion && styles.saveTextDisabled]}>
              {isSavingBibleVersion ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.bibleVersionNoteContainer}>
            <Ionicons name="information-circle" size={18} color={Colors.faithGold} style={styles.bibleVersionNoteIcon} />
            <Text style={[styles.bibleVersionNote, font]}>
              Changing your Bible version only applies to content you generate from now on.
              Existing playbooks and devotionals will keep the version they were created with.
            </Text>
          </View>
          <View style={styles.spacer} />
          <Text style={[styles.settingDescription, font]}>
            Choose your preferred Bible translation. This will be used across new playbooks and devotionals.
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
                { key: 'AMP', label: 'AMP', description: 'Amplified Bible' },
                { key: 'MSG', label: 'MSG', description: 'The Message' },
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

  const renderSystemPermissionsModal = () => (
    <Modal
      visible={systemPermissionsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSystemPermissionsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setSystemPermissionsModal(false); }}>
            <Text style={[styles.cancelText, font]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>System Permissions</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.settingDescription, font]}>
            Manage the device permissions siFia uses for notifications, calendar sync, and location-based features. Permissions stay managed in your system settings.
          </Text>

          <View style={styles.settingGroup}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                try { triggerLightHaptic(); } catch {}
                await pushNotificationService.openNotificationSettings();
              }}
            >
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.settingLabel, font]}>Notifications</Text>
                <Text style={[styles.settingHint, font]}>
                  Tap to manage in device settings
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingGroup}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                try { triggerLightHaptic(); } catch {}
                if (Platform.OS === 'ios') {
                  await Linking.openURL('app-settings:');
                } else {
                  await Linking.openSettings();
                }
              }}
            >
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.settingLabel, font]}>Calendar</Text>
                <Text style={[styles.settingHint, font]}>
                  Tap to manage in device settings
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingGroup}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                try { triggerLightHaptic(); } catch {}
                if (Platform.OS === 'ios') {
                  await Linking.openURL('app-settings:');
                } else {
                  await Linking.openSettings();
                }
              }}
            >
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.settingLabel, font]}>Location</Text>
                <Text style={[styles.settingHint, font]}>
                  Tap to manage in device settings
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.chevronColor} />
            </TouchableOpacity>
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
          <TouchableOpacity onPress={() => { try { triggerLightHaptic(); } catch {} setSettingsModal(false); }}>
            <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, font]}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingGroup}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                try { triggerLightHaptic(); } catch {}
                await pushNotificationService.initialize(user?.id || '');
                const permissionsGranted = await pushNotificationService.requestPermissions();
                if (permissionsGranted) {
                  const storedToken = await pushNotificationService.getStoredToken();
                  if (storedToken) {
                    await pushNotificationService.saveDeviceToken(user?.id || '', storedToken);
                    Alert.alert('Success', 'Notifications enabled successfully');
                  }
                } else {
                  Alert.alert('Permissions Denied', 'Please enable notifications in your device settings');
                }
              }}
            >
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.settingLabel, font]}>Enable Push Notifications</Text>
                <Text style={[styles.settingHint, font]}>
                  Re-register device token for push notifications
                </Text>
              </View>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.chevronColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingGroup}>
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Playbook Reminders</Text>
              <TouchableOpacity
                onPress={() => updatePref('playbook_steps', !(notificationPrefs?.playbook_steps ?? false))}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.playbook_steps ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.playbook_steps ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Devotional Reminders</Text>
              <TouchableOpacity
                onPress={() => updatePref('devotional_reminders', !(notificationPrefs?.devotional_reminders ?? false))}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.devotional_reminders ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.devotional_reminders ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Prayer Reminders</Text>
              <TouchableOpacity
                onPress={() => updatePref('prayer_reminders', !(notificationPrefs?.prayer_reminders ?? false))}
                disabled={!notificationPrefs}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.prayer_reminders ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.prayer_reminders ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Journal Prompts</Text>
              <TouchableOpacity
                onPress={() => updatePref('journal_prompts', !(notificationPrefs?.journal_prompts ?? false))}
                disabled={!notificationPrefs}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.journal_prompts ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.journal_prompts ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Progress Updates</Text>
              <TouchableOpacity
                onPress={() => updatePref('milestone_celebrations', !(notificationPrefs?.milestone_celebrations ?? false))}
                disabled={!notificationPrefs}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.milestone_celebrations ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.milestone_celebrations ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Streak Alerts</Text>
              <TouchableOpacity
                onPress={() => updatePref('streak_alerts', !(notificationPrefs?.streak_alerts ?? false))}
                disabled={!notificationPrefs}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.streak_alerts ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.streak_alerts ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            {subscription?.tier === 'free_trial' && (
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, font]}>Trial Notifications</Text>
                <TouchableOpacity
                  onPress={() => updatePref('trial_notifications', !(notificationPrefs?.trial_notifications ?? false))}
                  disabled={!notificationPrefs}
                  style={styles.switchContainer}
                >
                  <View style={[
                    styles.switchTrack,
                    (notificationPrefs?.trial_notifications ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                  ]}>
                    <View style={[
                      styles.switchThumb,
                      { transform: [{ translateX: (notificationPrefs?.trial_notifications ?? false) ? 20 : 0 }] },
                    ]} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, font]}>Prayer Request Alerts</Text>
              <TouchableOpacity
                onPress={() => updatePref('prayer_request_alerts', !(notificationPrefs?.prayer_request_alerts ?? false))}
                disabled={!notificationPrefs}
                style={styles.switchContainer}
              >
                <View style={[
                  styles.switchTrack,
                  (notificationPrefs?.prayer_request_alerts ?? false) ? styles.switchTrackActive : styles.switchTrackInactive,
                ]}>
                  <View style={[
                    styles.switchThumb,
                    { transform: [{ translateX: (notificationPrefs?.prayer_request_alerts ?? false) ? 20 : 0 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
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
          <View style={styles.streakSection}>
            <StreakTracker />
          </View>
          {renderSubscriptionSection()}
          {renderMenuOptions()}
          {/* POST-LAUNCH: {renderFamilyManagementSection()} */}
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
      {renderSystemPermissionsModal()}
      {renderSettingsModal()}
      {renderReportBugModal()}
      {renderFeatureModal()}

      <SubscriptionPlanModal
        visible={subscriptionPlanModal}
        onClose={() => setSubscriptionPlanModal(false)}
        onContinueWithSiFia={() => {
          setSubscriptionPlanModal(false);
          navigation.goBack();
        }}
        navigation={navigation}
      />
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
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
    flex: 1,
  },
  streakSection: {
    paddingHorizontal: 0,
    paddingBottom: 16,
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
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    height: 36,
  },
  chipActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  chipText: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
    fontSize: 13,
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
  menuSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 10,
    marginTop: 2,
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
  saveTextDisabled: {
    opacity: 0.5,
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
    backgroundColor: 'transparent',
    resizeMode: 'cover',
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
    textTransform: 'capitalize',
  },
  settingItemColumnNotification: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gentleBorder,
  },
  permissionActionButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.alertCoral,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionActionText: {
    color: Colors.hopeWhite,
    fontSize: 15,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 52,
  },
  permissionTextContainer: {
    flex: 1,
    marginRight: 12,
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
  timePickerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
  },
  timePickerDoneButton: {
    backgroundColor: Colors.alertCoral,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  timePickerDoneText: {
    color: Colors.hopeWhite,
    fontSize: 16,
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
    marginTop: 8,
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
    borderRadius: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 50,
    minWidth: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  yearPickerDoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 50,
    minWidth: 100,
    backgroundColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  deleteAccountIcon: {
    marginRight: 8,
  },
  deleteAccountTextContainer: {
    flex: 1,
  },
  deleteAccountTitle: {
    color: Colors.alertCoral,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteAccountDescription: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 48,
    width: '100%',
    maxWidth: 400,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 16,
  },
  deleteButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonEnabled: {
    opacity: 1,
  },
  gracePeriodInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  gracePeriodText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textGray,
    marginLeft: 8,
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
  bibleVersionNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bibleVersionNoteIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  bibleVersionNote: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.85)',
    flex: 1,
  },
  settingGroup: {
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  // Custom toggle styles matching TimeBlockLogEditor
  switchContainer: {
    padding: 4,
  },
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchTrackActive: {
    backgroundColor: Colors.alertCoral,
  },
  switchTrackInactive: {
    backgroundColor: '#E0E0E0',
  },
});  // Removed test button styles

export default withErrorBoundary(UserProfileScreen, 'UserProfileScreen');
