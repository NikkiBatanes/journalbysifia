/**
 * DashboardHomeScreen.tsx
 * Enterprise-grade dashboard home screen with comprehensive faith-based features
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  RefreshControl,
  Platform,
  StyleSheet,
  Image,
  NativeModules,
  DeviceEventEmitter,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../hooks/useTheme';
import { getTierShortName, normalizeTierInput } from '../utils/tierDisplayUtils';
import { SubscriptionTier } from '../interfaces/subscription';
// Removed unused imports to reduce lint noise

import DailyAffirmationCard from '../components/dashboard/DailyAffirmationCard';
import DailyBibleVerseCard from '../components/dashboard/DailyBibleVerseCard';
import PlaybookCarousel from '../components/dashboard/PlaybookCarousel';
import DevotionalCarousel from '../components/dashboard/DevotionalCarousel';
import ActionStepsCard from '../components/dashboard/ActionStepsCard';
import ReflectionQuestionsCard from '../components/dashboard/ReflectionQuestionsCard';
import SmartJournalingReflectionModal from './SmartJournalingReflectionModal';
import DevotionalDetailReflectionModal from './DevotionalDetailReflectionModal';
import SmartJournalingPrayerModal from './SmartJournalingPrayerModal';

import StreakTracker from '../components/dashboard/StreakTracker';
// Removed WeeklyInsights and AIInsights
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { useUnprayedPrayerRequests, useMarkPrayerRequestPrayed } from '../services/hooks/usePrayerData';
import { queryKeys } from '../services/queryKeys';
import DashboardPrayerSkeleton from '../components/SkeletonLoader/DashboardPrayerSkeleton';

const { width, height } = Dimensions.get('window');

// Motivational texts that rotate
const MOTIVATIONAL_TEXTS = [
  "Let's grow in faith today",
  'Grow closer to God today with faith in action',
  'Transform your faith into action today',
  'Walk boldly in His purpose for you',
  'Let His love guide your steps today',
  'Embrace His grace in every moment',
  'Find strength in His promises today',
  'Let faith be your compass today',
  'Discover His plan through prayer and action',
  'Trust His timing, embrace His calling',
];

interface DashboardHomeScreenProps {
  navigation: any;
}

const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const Colors = theme.colors;
  const Fonts = theme.typography;

  // Create styles using theme values
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 0,
      backgroundColor: Colors.hopeWhite,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: Colors.primary,
    },
    subscriptionBadge: {
      backgroundColor: Colors.faithGold,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginLeft: 12,
    },
    subscriptionText: {
      color: Colors.hopeWhite,
      fontSize: 12,
      fontWeight: '600',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    profileButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.lightGray,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContainer: {
      flex: 1,
    },
    content: {
      flex: 1,
      backgroundColor: Colors.anchorBlue,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
      // Increase overlap so rounded corners are clearly visible
      marginTop: -20,
      paddingTop: 0,
      position: 'relative',
      zIndex: 2,
      // subtle top elevation so corners are visible
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    sectionHeader: {
      marginTop: 24,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.text,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 0,
    },
    playbookLabelContainer: {
      marginTop: 0,
      marginBottom: 0,
      overflow: 'hidden',
    },
    playbookLabelClip: {
      overflow: 'hidden',
    },
    playbookLabel: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.text,
    },
    bottomSpacing: {
      height: 100,
    },
    floatingButton: {
      position: 'absolute',
      bottom: 110, // Above bottom navigation
      right: 20,
      zIndex: 1000,
    },
    floatingButtonText: {
      color: Colors.hopeWhite,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    counterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
      // Remove elevation/shadow; use subtle border instead
      borderWidth: 1,
      borderColor: Colors.faithGold,
    },
    counterText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.anchorBlue,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: Colors.alertCoral,
      borderRadius: 7,
      minWidth: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationCount: {
      fontSize: 9,
      fontWeight: '600',
      color: Colors.hopeWhite,
      lineHeight: 12,
    },
    profileImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.lightGray,
    },
    initialAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.alertCoral,
      justifyContent: 'center',
      alignItems: 'center',
    },
    initialLetter: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.hopeWhite,
    },
    greetingSection: {
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 16,
    },
    greeting: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: Colors.anchorBlue,
      marginTop: 0,
      marginBottom: 2,
    },
    motivationalText: {
      fontSize: 14,
      color: Colors.anchorBlue,
      fontWeight: '600',
      opacity: 1,
      marginTop: 0,
      marginBottom: 12,
    },
    placeholderCard: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: Colors.cardShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.text,
    },
    cardSubtitle: {
      fontSize: 14,
      color: Colors.secondary,
      marginBottom: 8,
    },
    comingSoonBadge: {
      backgroundColor: Colors.faithGold,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    comingSoonText: {
      fontSize: 10,
      fontWeight: '600',
      color: Colors.hopeWhite,
    },
    scrollView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 0,
      paddingTop: 0,
    },
    sectionGap: {
      height: 16,
    },
    smallSectionGap: {
      height: 8,
    },
    actionsHeaderContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 0,
      marginBottom: 0,
    },
    actionsHeaderTitle: {
      fontSize: 12,
      color: Colors.hopeWhite,
      textAlign: 'center',
      textTransform: 'uppercase',
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    actionsHeaderSubtitle: {
      fontSize: 12,
      color: Colors.mediumGray,
      textAlign: 'center',
      marginTop: -2,
      marginBottom: 6,
      fontWeight: '500',
    },
    expandableButton: {
      backgroundColor: Colors.hopeWhite, 
      borderRadius: 28, 
      height: 56,
      shadowColor: Colors.cardShadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      alignSelf: 'flex-end', 
    },
    expandableButtonTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start', // keep content anchored left; icon container provides centering
      paddingHorizontal: 0,
      minWidth: 56, // ensures perfect circle when collapsed
    },
    fabIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingButtonIcon: {
      width: 40,
      height: 40,
      alignSelf: 'center',
    },
    expandText: {
      color: Colors.anchorBlue,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
      // Do not use flex here; it pushes the icon off-center when collapsed
    },
  });

  // Always show FAB for easy access to UserInput screen
  const [showFab, setShowFab] = useState(true);
  const { user } = useAuth();
  const { subscription, usage, loading: subscriptionLoading, refreshSubscription } = useSubscription();
  const queryClient = useQueryClient();
  
  // Add direct subscription fetch for debugging
  const [directSubscription, setDirectSubscription] = useState<any>(null);
  
  useEffect(() => {
    const fetchDirectSubscription = async () => {
      if (user?.id) {
        try {
          const { subscriptionService } = await import('../services/subscriptionService');
          const directData = await subscriptionService.getUserSubscription(user.id);
          setDirectSubscription(directData);
          
          // If data doesn't match, invalidate React Query cache
          if (directData?.tier !== subscription?.tier && subscription?.tier) {
            queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
          }
        } catch (error) {
          console.error('Direct subscription fetch failed:', error);
        }
      }
    };
    fetchDirectSubscription();
  }, [user?.id, subscription?.tier, queryClient]); // Re-run when cached subscription changes
  const [refreshing, setRefreshing] = useState(false);
  const [actionsCount, setActionsCount] = useState(0);
  const [currentMotivationalText, setCurrentMotivationalText] = useState(0);
  // Reflection Questions state
  const [selectedReflection, setSelectedReflection] = useState<{
    question: string;
    source: string;
    sourceType: 'playbook' | 'devotional' | 'guided';
    sourceId?: string; // Devotional ID for linking
    // Optional devotional metadata
    dayNumber?: number;
    dayTitle?: string;
    totalDays?: number;
    questionNumber?: number;
  } | null>(null);
  const [showSJModal, setShowSJModal] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  // Prayer Requests modal state
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [selectedPrayerRequest, setSelectedPrayerRequest] = useState<any | null>(null);

  // Status bar: auto-detect from background
  useScreenStatusBar('auto', '#F2F5F7');

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return;
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) return;
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Collapsing Playbook label
  const playbookWidth = useRef(new Animated.Value(0)).current;
  const [playbookMeasuredWidth, setPlaybookMeasuredWidth] = useState(0);

  // Simple expandable button
  const buttonWidth = useRef(new Animated.Value(56)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  // When collapsed, keep text width at 0 so the icon stays perfectly centered
  const textWidth = textOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180], // max width for the label when expanded
  });
  const hasExpanded = useRef(false);


  // Draggable floating button - positioned above bottom navigation
  const pan = useRef(new Animated.ValueXY({ x: -20, y: height - 280 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // Snap to edges (adjusted for right-anchored container)
        const currentX = (pan.x as any)._value;
        const snapToEdge = currentX < -width / 2 ? -width + 76 : -20;
        Animated.spring(pan.x, {
          toValue: snapToEdge,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Get user's first name with robust fallbacks
  const firstName =
    (user as any)?.firstName ||
    user?.user_metadata?.first_name ||
    (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).trim().split(/\s+/)[0] : undefined) ||
    (user as any)?.displayName?.split?.(' ')?.[0] ||
    user?.user_metadata?.given_name ||
    user?.email?.split('@')[0] ||
    'Friend';

  // Set daily motivational text based on current date
  useEffect(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const textIndex = dayOfYear % MOTIVATIONAL_TEXTS.length;
    setCurrentMotivationalText(textIndex);
  }, []);

  // Animate when screen is focused (dashboard opened)
  // Expandable animation that repeats
  const expandButton = useCallback(() => {
    let animationCount = 0;
    const maxAnimations = 2; // Animate 2 times

    const runAnimation = () => {
      if (animationCount >= maxAnimations) {return;}
      animationCount++;

      // Expand to show text
      Animated.parallel([
        Animated.timing(buttonWidth, {
          toValue: 220,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Hold for 2.5 seconds then collapse
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: false,
            }),
            Animated.timing(buttonWidth, {
              toValue: 56,
              duration: 350,
              useNativeDriver: false,
            }),
          ]).start(() => {
            // Wait 3 seconds before next animation
            if (animationCount < maxAnimations) {
              setTimeout(() => {
                runAnimation();
              }, 3000);
            }
          });
        }, 2500);
      });
    };

    runAnimation();
  }, [buttonWidth, textOpacity]);

  useFocusEffect(
    useCallback(() => {
      // Reset state
      buttonWidth.setValue(56);
      textOpacity.setValue(0);

      // Refresh subscription data when screen comes into focus
      refreshSubscription();

      // Proactively refresh devotionals across components
      try {
        const uid = user?.id;
        if (uid) {
          // Invalidate React Query caches used by hooks
          queryClient.invalidateQueries({ queryKey: ['devotionals'] });
          // Emit a dashboard-focused event for non-RQ consumers (e.g., DevotionalCarousel)
          DeviceEventEmitter.emit('dashboard_focused', { user_id: uid });
        } else {
          DeviceEventEmitter.emit('dashboard_focused', {} as any);
        }
      } catch {}

      // Wait a moment then start expanding animation
      setTimeout(() => {
        expandButton();
      }, 1000);

      // Collapsing Playbook label
      if (playbookMeasuredWidth > 0) {
        playbookWidth.setValue(playbookMeasuredWidth);
        Animated.timing(playbookWidth, { toValue: 0, duration: 400, useNativeDriver: false }).start();
      }
    }, [
      playbookMeasuredWidth,
      playbookWidth,
      buttonWidth,
      textOpacity,
      expandButton,
    ])
  );

  // Fetch unprayed prayer requests for current user (across all dates)
  const { data: unprayedRequests = [], isLoading: loadingRequests, isFetching: fetchingRequests, refetch: refetchRequests } = useUnprayedPrayerRequests(user?.id || '');
  const markPrayedMutation = useMarkPrayerRequestPrayed();

  const handleOpenPrayer = (req: any) => {
    triggerLightHaptic();
    setSelectedPrayerRequest(req);
    setShowPrayerModal(true);
  };

  const handlePrayerSaved = async () => {
    try {
      if (!selectedPrayerRequest) return;
      await markPrayedMutation.mutateAsync({
        id: selectedPrayerRequest.id,
        isPrayed: true,
        _userId: selectedPrayerRequest.user_id,
        _dateStr: selectedPrayerRequest.selected_date,
      });
      // Invalidate unprayed list to refresh dashboard
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.unprayedRequests(user.id) });
      }
    } catch (e) {
      console.error('Failed to mark prayer request as prayed:', e);
      Alert.alert('Error', 'Failed to update prayer request status.');
    } finally {
      setShowPrayerModal(false);
      setSelectedPrayerRequest(null);
    }
  };

  const renderPrayerRequestsCard = () => {
    // Hide entirely when not loading and there are no unprayed requests
    if (!loadingRequests && !fetchingRequests && unprayedRequests.length === 0) {
      return null;
    }

    return (
    <View style={{
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 16,
      marginTop: 0,
      marginBottom: 0,
    }}>
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 8, minHeight: 24 }}>
        <Text style={{
          fontSize: 12,
          color: Colors.hopeWhite,
          textAlign: 'center',
          textTransform: 'uppercase',
          fontWeight: '600',
          letterSpacing: 0.8,
          paddingHorizontal: 48,
        }}>
          {unprayedRequests.length === 1 ? 'PRAYER REQUEST' : 'PRAYER REQUESTS'}
        </Text>
        <View style={{ position: 'absolute', right: 0 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            gap: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)'
          }}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.hopeWhite }}>{unprayedRequests.length}</Text>
          </View>
        </View>
      </View>
      {loadingRequests || fetchingRequests ? (
        <DashboardPrayerSkeleton />
      ) : unprayedRequests.length === 0 ? (
        <Text style={styles.cardSubtitle}>No pending prayer requests. You're all caught up!</Text>
      ) : (
        unprayedRequests.slice(0, 5).map((req: any, idx: number) => (
          <View
            key={req.id}
            style={{
              marginTop: idx === 0 ? 0 : 10,
              backgroundColor: 'transparent',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.3)',
              padding: 16,
            }}
          >
            {/* Header Badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <Ionicons name="mail-unread" size={14} color={Colors.alertCoral} />
              <View style={{
                backgroundColor: 'transparent',
                paddingHorizontal: 0,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 0,
                borderColor: 'transparent'
              }}>
                <Text style={{ color: Colors.hopeWhite, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>PRAYER REQUEST</Text>
              </View>
            </View>

            {/* Name */}
            <Text style={{ color: Colors.hopeWhite, fontSize: 16, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>
              {req.person_name || 'Someone'}
            </Text>

            {/* Description */}
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: 10 }} numberOfLines={2}>
              {req.content || '—'}
            </Text>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); handleOpenPrayer(req); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.hopeWhite} />
              <Text style={{ color: Colors.hopeWhite, fontWeight: '700', marginLeft: 6 }}>
                {`Pray for ${req.person_name || 'them'} now`}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      {unprayedRequests.length > 5 ? (
        <Text style={[styles.cardSubtitle, { marginTop: 8 }]}> 
          And {unprayedRequests.length - 5} more...
        </Text>
      ) : null}
    </View>
  );
  };



  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const userId = user?.id;
      // Invalidate key dashboard queries (subscription, usage, analytics, playbooks, devotionals, intelligence)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription', userId] }),
        queryClient.invalidateQueries({ queryKey: ['usage', userId] }),
        queryClient.invalidateQueries({ queryKey: ['subscription-analytics', userId] }),
        queryClient.invalidateQueries({ queryKey: ['intelligence-recommendations', userId] }),
        // Broad invalidations to cover differing key factories
        queryClient.invalidateQueries({ queryKey: ['playbooks'] }),
        queryClient.invalidateQueries({ queryKey: ['devotionals'] }),
      ]);
    } catch (e) {
      console.warn('Dashboard refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // (Removed) Test Faith Points and DB check helpers

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Right side - Subscription and Profile */}
      <View style={styles.headerRight}>
        {/* Subscription Status */}
        {(() => {
          // Use direct subscription if available and different from cached
          const activeSubscription = (directSubscription && directSubscription.tier !== subscription?.tier)
            ? directSubscription
            : subscription;

          const tier = activeSubscription?.tier || 'seeker';
          const normalizedTier = normalizeTierInput(tier) || (tier as SubscriptionTier);

          // Hide tier badge for Transformation and Family tiers in dashboard
          if (
            tier === 'transformation' || tier === 'transformation_annual' ||
            tier === 'family' || tier === 'family_annual'
          ) {
            return null;
          }

          const displayName = getTierShortName(normalizedTier as SubscriptionTier);

          // Removed debug logging of tier mapping

          if (!displayName) { return null; }

          return (
            <TouchableOpacity
              style={styles.subscriptionBadge}
              onPress={() => navigation.navigate('UserProfile')}
            >
              <Text style={styles.subscriptionText}>{displayName}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Playbook Counter - hide entirely when unlimited */}
        {(() => {
          const limit = subscription?.limits?.playbooks;
          const used = usage?.playbooks_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          
          // Removed debug logging for playbook counter
          
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => navigation.navigate('Playbooks')}
            >
              <MaterialCommunityIcons name="clipboard-text-play" size={18} color={Colors.faithGold} />
              <Text style={styles.counterText}>{remaining}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Devotional Counter - hide entirely when unlimited */}
        {(() => {
          const limit = subscription?.limits?.devotionals;
          const used = usage?.devotionals_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => navigation.navigate('Devotionals')}
            >
              <MaterialCommunityIcons name="book" size={18} color={Colors.faithGold} />
              <Text style={styles.counterText}>{remaining}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Notifications */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            triggerLightHaptic();
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.anchorBlue} />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationCount}>3</Text>
          </View>
        </TouchableOpacity>

        {/* Profile Avatar with Notification */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => { triggerLightHaptic(); navigation.navigate('UserProfile'); }}
        >
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.initialAvatar}>
              <Text style={styles.initialLetter}>{(() => {
                const meta: any = (user as any)?.user_metadata || {};
                const displayName =
                  (user as any)?.displayName ||
                  meta.full_name ||
                  [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
                  (user as any)?.email ||
                  'User';
                return (displayName || 'U').trim().charAt(0).toUpperCase();
              })()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGreeting = () => (
    <View style={styles.greetingSection}>
      <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">Hello, {firstName}</Text>
      <Text style={styles.motivationalText}>
        {MOTIVATIONAL_TEXTS[currentMotivationalText]}
      </Text>
    </View>
  );

  const renderPlaceholderCard = (title: string, subtitle: string, icon: string) => (
    <View style={styles.placeholderCard}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={24} color={Colors.anchorBlue} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonText}>Coming Soon</Text>
      </View>
    </View>
  );

  const renderFloatingButton = () => (
    <Animated.View
      style={[
        styles.floatingButton,
        {
          opacity: 1, // Always visible, no animation dependency
        },
      ]}
    >
      <Animated.View style={[styles.expandableButton, { width: buttonWidth }]}>
        <TouchableOpacity
          style={styles.expandableButtonTouchable}
          onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
          activeOpacity={0.8}
        >
          <View style={styles.fabIconContainer}>
            <Image
              source={require('../../assets/icons/siFiaHeartWhiteTransparent.png')}
              style={styles.floatingButtonIcon}
              resizeMode="contain"
              accessibilityLabel="siFia"
            />
          </View>
          <Animated.Text
            style={[styles.expandText, { opacity: textOpacity, width: textWidth }]}
            numberOfLines={1}
          >
            Create a Playbook
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  // (Removed) Test buttons UI

  return (
    <View style={styles.container}>

      {renderHeader()}
      {renderGreeting()}

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Progress Tracking - moved above Today's Scripture */}
        <StreakTracker />
        <View style={styles.smallSectionGap} />

        {/* Daily Scripture - now below Streak Tracker */}
        <DailyBibleVerseCard onRefresh={() => setRefreshing(true)} />
        <View style={styles.sectionGap} />

        {/* Row 1: Inspiration Cards (Affirmation only) */}
        <View style={styles.row}>
          <DailyAffirmationCard onRefresh={() => setRefreshing(true)} />
        </View>
        <View style={styles.sectionGap} />

        {/* Prayer Requests Section (hide when empty) */}
        {(loadingRequests || fetchingRequests || unprayedRequests.length > 0) && (
          <>
            {renderPrayerRequestsCard()}
            <View style={styles.sectionGap} />
          </>
        )}

        {/* Removed Weekly Insights and AI Insights */}

        {/* Collapsing Playbook label */}
        <View style={styles.playbookLabelContainer}>
          <Animated.View
            style={[styles.playbookLabelClip, { width: playbookWidth }]}
          >
            <Text
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w !== playbookMeasuredWidth) {
                  setPlaybookMeasuredWidth(w);
                }
              }}
              style={styles.playbookLabel}
            >
              Playbook
            </Text>
          </Animated.View>
        </View>

        <PlaybookCarousel
          onPlaybookPress={(playbook) => {
            triggerLightHaptic();
            navigation.navigate('PlaybookDetail', { playbookId: playbook.id });
          }}
          onViewAll={() => {
            // Navigate to playbooks list
            triggerLightHaptic();
            navigation.navigate('Playbooks');
          }}
        />
        <View style={styles.sectionGap} />
        <DevotionalCarousel
          onDevotionalPress={(devotional) => {
            // Navigate to devotional detail screen
            triggerLightHaptic();
            navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
          }}
          onViewAll={() => {
            // Navigate to devotionals list
            triggerLightHaptic();
            navigation.navigate('Devotionals');
          }}
        />
        <View style={styles.sectionGap} />

        {/* External Actions header and subtitle (moved out of card) */}
        <View style={styles.actionsHeaderContainer}>
          <Text style={styles.actionsHeaderTitle}>{`TODAY'S ACTION${actionsCount === 1 ? '' : 'S'}`}</Text>
          <Text style={styles.actionsHeaderSubtitle}>{`Unfinished Steps (${actionsCount})`}</Text>
        </View>

        <ActionStepsCard
          onStepPress={(step) => {
            // Navigate to Playbook detail when an action step is tapped
            triggerLightHaptic();
            navigation.navigate('PlaybookDetail', { playbookId: step.playbookId });
          }}
          onViewAll={() => {
            // Navigate to all action steps
          }}
          onCountChange={setActionsCount}
        />
        <View style={styles.sectionGap} />
        
        {/* Reflection Questions Card */}
        <ReflectionQuestionsCard
          onQuestionPress={(q: any) => {
            triggerLightHaptic();
            // Include enriched metadata for devotional reflections
            setSelectedReflection({
              question: q.question,
              source: q.source,
              sourceType: q.sourceType,
              sourceId: q.sourceId, // This is the devotional ID
              dayNumber: q.dayNumber,
              dayTitle: q.dayTitle,
              totalDays: q.totalDays,
              questionNumber: q.questionIndex,
            });
            // Route by sourceType: devotional -> devotional modal; playbook/guided -> SJ modal
            if (q.sourceType === 'devotional') {
              setShowDevotionalModal(true);
            } else {
              setShowSJModal(true);
            }
          }}
          onViewAll={() => {
            // Navigate to journal reflections or a dedicated reflections screen if available
            triggerLightHaptic();
            navigation.navigate('Journal');
          }}
        />
        <View style={styles.sectionGap} />
        
        {/* Removed sections: Faith Community, Quick Actions, Growth & Progress, Community (Prayer Circle, Testimonies) */}

        {/* Bottom spacing for floating button (only when visible) */}
        {showFab ? <View style={styles.bottomSpacing} /> : null}
        </ScrollView>
      </View>

      {showFab ? renderFloatingButton() : null}

      {/* Reflection Modals */}
      <SmartJournalingReflectionModal
        visible={showSJModal}
        subtaskTitle={selectedReflection?.question || ''}
        // Hide metadata when reflection comes from a guided prompt
        isGuidedReflection={selectedReflection?.sourceType === 'guided'}
        onSave={() => {
          // Don't close modal immediately - success modal will handle the flow
        }}
        onCancel={() => {
          setShowSJModal(false);
          setSelectedReflection(null);
        }}
      />
      <DevotionalDetailReflectionModal
        visible={showDevotionalModal}
        question={selectedReflection?.question || ''}
        devotionalId={selectedReflection?.sourceId}
        devotionalTitle={selectedReflection?.source}
        dayNumber={selectedReflection?.dayNumber}
        dayTitle={selectedReflection?.dayTitle}
        totalDays={selectedReflection?.totalDays}
        questionNumber={selectedReflection?.questionNumber}
        onSave={(entry) => {
          // Don't close modal immediately - success modal will handle the flow
          // Removed debug logging
          
          // Invalidate all reflection-related queries to ensure real-time updates
          queryClient.invalidateQueries({
            queryKey: ['reflections'],
          });
          
          // Also invalidate devotional queries in case they affect question availability
          queryClient.invalidateQueries({
            queryKey: ['devotionals'],
          });
          
          // Force refetch of reflection questions
          queryClient.refetchQueries({
            queryKey: ['reflections'],
          });
        }}
        onCancel={() => {
          setShowDevotionalModal(false);
          setSelectedReflection(null);
        }}
      />
      {/* Prayer Modal */}
      <SmartJournalingPrayerModal
        visible={showPrayerModal}
        subtaskTitle={selectedPrayerRequest ? (selectedPrayerRequest.person_name ? `Pray for ${selectedPrayerRequest.person_name}` : 'Prayer') : ''}
        initialActiveTab={selectedPrayerRequest ? 'people' : undefined}
        initialPersonName={selectedPrayerRequest?.person_name || ''}
        initialPrayerRequest={selectedPrayerRequest?.content || ''}
        onSave={() => handlePrayerSaved()}
        onCancel={() => { setShowPrayerModal(false); setSelectedPrayerRequest(null); }}
      />
    </View>
  );
};

export default DashboardHomeScreen;
