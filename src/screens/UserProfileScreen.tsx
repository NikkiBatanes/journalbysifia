import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { Pencil } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled
import { useAuth } from '../context/IndustryStandardAuthContext';
import { supabase } from '../services/supabaseClient';
import { userApi } from '../services/userApi';
import ProfileHeader from '../components/profile/ProfileHeader';
import { pickImageLocal, uploadAvatar } from '../services/avatarService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from '../services/faithPointsEvents';
import { UserProgress, Badge, UserPreferences } from '../types/auth';
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
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { useFamilySubscription } from '../hooks/useFamilySubscription';

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
  const { user, signOut, updatePreferences, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  // Status bar: dark icons on white header area
  useScreenStatusBar('dark', Colors.hopeWhite);
  
  // Family subscription hook
  const {
    familyGroup,
    loading: familyLoading,
    createFamilyGroup,
    inviteMember,
    removeMember,
    cancelInvitation,
    refreshFamilyData,
  } = useFamilySubscription();
  // TODO: Add updateProfile and updatePreferences to IndustryStandardAuthContext
  const [_userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [recentBadges, setRecentBadges] = useState<Badge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: (user as any)?.firstName || (user as any)?.user_metadata?.first_name || '',
    lastName: (user as any)?.lastName || (user as any)?.user_metadata?.last_name || '',
  });
  const avatarUrl = (user as any)?.user_metadata?.avatar_url as string | undefined;
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
  // Personalization toggles
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [settingsModal, setSettingsModal] = useState(false);
  const [_badgesModal, setBadgesModal] = useState(false);

  const handleEditAvatar = async () => {
    try {
      console.log('[Avatar] Edit tapped');
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

      // Load badges
      const badgesResponse = await userApi.getRecentBadges(user?.id || '', 5);
      if (badgesResponse.success && badgesResponse.data) {
        setRecentBadges(badgesResponse.data);
      }

      const allBadgesResponse = await userApi.getAllUserBadges(user?.id || '');
      if (allBadgesResponse.success && allBadgesResponse.data) {
        setAllBadges(allBadgesResponse.data);
        console.log('✅ Loaded user_badges count:', allBadgesResponse.data.length);
      }

      // Fallback: legacy storage uses user_profiles.badges JSON array
      if ((!allBadgesResponse.success || !allBadgesResponse.data || allBadgesResponse.data.length === 0) && user?.id) {
        const { data: profileRow, error: profileErr } = await supabase
          .from('user_profiles')
          .select('badges')
          .eq('id', user.id)
          .single();
        if (!profileErr) {
          const profileBadges = (profileRow?.badges || []) as any[];
          const mapped: Badge[] = profileBadges.map((b: any) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            icon: b.icon,
            rarity: b.rarity || 'common',
            category: b.category || 'achievement',
            unlockedAt: b.unlockedAt,
          }));
          setAllBadges(mapped);
          console.log('✅ Loaded user_profiles.badges count:', mapped.length);
        }
      }

      // Load subscription and usage data
      if (user?.id) {
        try {
          const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id);
          setSubscription(subscriptionData as any);

          const usageData = {
            playbooks_generated: subscriptionData.playbooks_used || 0,
            devotionals_generated: subscriptionData.devotionals_used || 0,
          };
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
      const first = (profileForm as any).firstName?.trim() || '';
      const last = (profileForm as any).lastName?.trim() || '';
      const full = [first, last].filter(Boolean).join(' ').trim();

      // Persist to Supabase auth user_metadata via context
      const result = await (updateProfile as any)({
        full_name: full || undefined,
        first_name: first || undefined,
        last_name: last || undefined,
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

  const handleLogout = async () => {
    // Immediate logout without confirmation
    await signOut();
    // Navigation will be handled automatically by auth state change
  };

  const renderProfileHeader = () => {
    // Determine plan label for header pill (siFia-branded)
    let planLabel: string | undefined;
    if (subscription) {
      const rawTier = subscription.tier || '';
      const tierBase = rawTier.replace(/_annual$/, '');
      const branded = (() => {
        switch (tierBase) {
          // Legacy IDs
          case 'basic':
            return 'siFia SEEKER';
          case 'seeker':
            return 'siFia SEEKER';
          case 'spark':
            return 'siFia SPARK';
          case 'growth':
            return 'siFia GROWTH';
          case 'transformation':
            return 'siFia TRANSFORMATION';
          case 'family':
            return 'siFia FAMILY';
          case 'free_trial':
            return 'Free Trial';
          default:
            return undefined;
        }
      })();

      // If canceled, user effectively falls back to free tier presentation
      planLabel = subscription.status === 'canceled' ? 'siFia SEEKER' : (branded || 'siFia SEEKER');
    }
    return (
      <ProfileHeader
        user={user}
        stats={{
          faithPoints: profileStats?.faithPoints ?? 0,
          level: profileStats?.level ?? 1,
          streakDays: profileStats?.currentStreak ?? 0,
          badgesCount: profileStats?.totalBadges ?? 0,
        }}
        onEditPress={() => setEditProfileModal(true)}
        onEditAvatar={handleEditAvatar}
        plan={planLabel}
        usage={usageSummary}
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

  const renderUsageCounters = () => {
    if (!subscription || !usage) {return null;}

    const isTrialing = subscription.status === 'trialing';
    const isCanceled = subscription.status === 'canceled';

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
    const playbookPct = typeof playbookLimit === 'number' && playbookLimit > 0 ? Math.min(1, playbookUsed / playbookLimit) : 0;
    const devotionalPct = typeof devotionalLimit === 'number' && devotionalLimit > 0 ? Math.min(1, devotionalUsed / devotionalLimit) : 0;

    // Debug logging
    console.log('🔍 Profile Usage Counter:', {
      playbookLimit,
      devotionalLimit,
      playbookUsed,
      devotionalUsed,
      subscription_tier: subscription?.tier,
      usage_object: usage,
      subscription_limits: subscription?.limits
    });

    return (
      <View style={styles.countersContainer}>
        <View style={styles.countersRow}>
          <View style={styles.counterCard}>
            <View style={styles.counterHeader}>
              <Ionicons name="book-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.counterNumbers}>{playbookUsed} / {playbookLimit}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressValue, { width: `${playbookPct * 100}%` }]} /></View>
          </View>
          <View style={styles.counterCard}>
            <View style={styles.counterHeader}>
              <Ionicons name="heart-outline" size={18} color={Colors.devotionalPurple} />
            </View>
            <Text style={styles.counterNumbers}>{devotionalUsed} / {devotionalLimit}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressValueAlt, { width: `${devotionalPct * 100}%` }]} /></View>
          </View>
        </View>

        {isTrialing && !isCanceled && (
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAllBadges = () => (
    <View style={styles.badgesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: Colors.hopeWhite }]}>Badges</Text>
        {!!recentBadges.length && (
          <TouchableOpacity onPress={() => setBadgesModal(true)}>
            <Text style={styles.viewAllText}>Recent</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!(allBadges && allBadges.length) && (
        <Text style={styles.badgesSubtitle} numberOfLines={2}>
          You have {allBadges.length} badges: {allBadges.map(b => b.name).join(', ')}
        </Text>
      )}

      {/* Full-bleed horizontal scroller */}
      <View style={styles.fullBleedContainer}>
        {((allBadges && allBadges.length) || (recentBadges && recentBadges.length)) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fullBleedContent}>
            <View style={styles.badgesList}>
              {(allBadges.length ? allBadges : recentBadges).map((badge, index) => {
                const iconStr = String((badge as any).icon || '').trim();
                const isIonicon = /^[a-z0-9-]+$/i.test(iconStr);
                return (
                  <View key={`${badge.id}-${index}`} style={styles.badgeItem}>
                    <View style={styles.badgeIcon}>
                      {isIonicon && iconStr ? (
                        <Ionicons name={iconStr as any} size={22} color={Colors.hopeWhite} />
                      ) : iconStr ? (
                        <Text style={[styles.badgeEmoji, { color: Colors.hopeWhite }]}>{iconStr}</Text>
                      ) : (
                        <Ionicons name="medal" size={22} color={Colors.hopeWhite} />
                      )}
                    </View>
                    <Text style={[styles.badgeName, { color: Colors.hopeWhite }]}>{badge.name}</Text>
                    <Text style={[styles.badgePoints, { color: Colors.hopeWhite }]}>+{(badge as any).faith_points_reward || 0}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <Text style={[styles.badgesSubtitle, { textAlign: 'center' }]}>No badges yet</Text>
        )}
      </View>
    </View>
  );

  const renderCommunitySection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>COMMUNITY</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="share-social" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Share with Friends</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="star" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Leave a Review</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="logo-instagram" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Instagram</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="logo-facebook" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Facebook</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Text style={{ color: Colors.anchorBlue, fontSize: 16, fontWeight: '800' }}>X</Text>
          </View>
          <Text style={styles.menuText}>X</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLegalPrivacySection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>LEGAL & PRIVACY</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="document-text" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="lock-closed" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHelpSupportSection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>HELP & SUPPORT</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="help-circle" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>FAQ</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="bulb" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Suggest a Feature</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="bug" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Report a Bug</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAppBehaviorSection = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>PERMISSIONS</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="notifications" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>System Permissions</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMenuOptions = () => (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>PERSONALIZATION</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="book" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Bible Version</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="calendar" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Week Start</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="color-palette" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Appearance</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="text" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Font</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="pulse" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Haptics</Text>
          <Switch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            thumbColor={hapticsEnabled ? Colors.hopeWhite : '#f4f3f4'}
            trackColor={{ false: 'rgba(255,255,255,0.25)', true: 'rgba(255,255,255,0.45)' }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemSpaced]}
          onPress={() => setSettingsModal(true)}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="volume-high" size={18} color={Colors.anchorBlue} />
          </View>
          <Text style={styles.menuText}>Sounds</Text>
          <Switch
            value={soundsEnabled}
            onValueChange={setSoundsEnabled}
            thumbColor={soundsEnabled ? Colors.hopeWhite : '#f4f3f4'}
            trackColor={{ false: 'rgba(255,255,255,0.25)', true: 'rgba(255,255,255,0.45)' }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFamilyManagementSection = () => {
    // Only show family management if user has family subscription or can create one
    const canManageFamily = Boolean(familyGroup) || subscription?.tier === 'family' || subscription?.tier === 'transformation';
    const isAdmin = familyGroup?.admin_user_id === user?.id;
    
    if (!canManageFamily) return null;

    return (
      <View>
        <Text style={[styles.sectionLabel, styles.sectionLabelRight]}>FAMILY SUBSCRIPTION</Text>
        <View style={styles.menuContainer}>
          {familyGroup ? (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('FamilyAdminDashboard')}
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="people" size={18} color={Colors.anchorBlue} />
                </View>
                <Text style={styles.menuText}>
                  {isAdmin ? 'Manage Family' : 'Family Group'}
                </Text>
                <View style={styles.trialBadge}>
                  <Text style={styles.trialBadgeText}>
                    {familyGroup.current_members}/{familyGroup.max_members}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
              </TouchableOpacity>
              
              {isAdmin && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => navigation.navigate('FamilyInvitation')}
                >
                  <View style={styles.menuIconBox}>
                    <Ionicons name="person-add" size={18} color={Colors.anchorBlue} />
                  </View>
                  <Text style={styles.menuText}>Invite Members</Text>
                  <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
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
              <Text style={styles.menuText}>Create Family Group</Text>
              <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
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
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color={'rgba(255,255,255,0.65)'} />
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
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setEditProfileModal(false)} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleUpdateProfile}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Avatar with edit inside Edit Profile */}
          <View style={styles.modalAvatarSection}>
            <View style={styles.modalAvatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, styles.modalInitialAvatar]}>
                  <Text style={styles.modalInitialLetter}>{initialLetter}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.modalEditAvatarButton}
                onPress={handleEditAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Pencil size={16} color={Colors.alertCoral} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>NAME</Text>
            <View style={styles.nameContainer}>
              <TextInput
                style={styles.nameField}
                value={(profileForm as any).firstName}
                onChangeText={(text) => setProfileForm({ ...profileForm, firstName: text })}
                placeholder="First name"
                placeholderTextColor={Colors.mediumGray}
              />
              <View style={styles.nameDivider} />
              <TextInput
                style={styles.nameField}
                value={(profileForm as any).lastName}
                onChangeText={(text) => setProfileForm({ ...profileForm, lastName: text })}
                placeholder="Last name"
                placeholderTextColor={Colors.mediumGray}
              />
            </View>
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
          { paddingTop: 22, backgroundColor: theme.colors.hopeWhite },
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
        >
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
  // Settings modal additions (chips)
  settingItemColumn: {
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#e9ecef',
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
  modalEditAvatarButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.hopeWhite,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
  },
  badgesSubtitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.9,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  badgesList: {
    flexDirection: 'row',
  },
  badgeItem: {
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
    color: Colors.primary,
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
    color: Colors.mediumGray,
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
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  progressValueAlt: {
    height: 8,
    backgroundColor: Colors.devotionalPurple,
    borderRadius: 6,
  },
  // Removed test button styles
});

export default UserProfileScreen;
