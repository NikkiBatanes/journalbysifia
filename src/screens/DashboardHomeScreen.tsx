  // Feature flags: hide subscription badge and usage counters for all plans
  const SHOW_SUBSCRIPTION_BADGE = false;
  const SHOW_USAGE_COUNTERS = false;
/**
 * DashboardHomeScreen.tsx
 * Enterprise-grade dashboard home screen with comprehensive faith-based features
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  RefreshControl,
  Platform,
  StyleSheet,
  Image,
  NativeModules,
  DeviceEventEmitter,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { faithPointsService } from '../services/faithPointsService';
import { notificationService } from '../services/notificationService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { Colors } from '../theme/colors';
import { getTierShortName, normalizeTierInput } from '../utils/tierDisplayUtils';
import { SubscriptionTier } from '../interfaces/subscription';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';

import DailyAffirmationCard from '../components/dashboard/DailyAffirmationCard';
import DailyBibleVerseCard from '../components/dashboard/DailyBibleVerseCard';
import PlaybookCarousel from '../components/dashboard/PlaybookCarousel';
import DevotionalCarousel from '../components/dashboard/DevotionalCarousel';
import ActionStepsCard from '../components/dashboard/ActionStepsCard';
import ReflectionQuestionsCard from '../components/dashboard/ReflectionQuestionsCard';
import SmartJournalingReflectionModal from './SmartJournalingReflectionModal';
import DevotionalDetailReflectionModal from './DevotionalDetailReflectionModal';
import BlueSheet from '../components/layout/BlueSheet';
import SmartJournalingPrayerModal from './SmartJournalingPrayerModal';

import StreakTracker from '../components/dashboard/StreakTracker';
// Removed WeeklyInsights and AIInsights
// Removed AsyncStorage (unused)
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { useUnprayedPrayerRequests, useMarkPrayerRequestPrayed, useCreatePrayer } from '../services/hooks/usePrayerData';
import { queryKeys } from '../services/queryKeys';
import DashboardPrayerSkeleton from '../components/SkeletonLoader/DashboardPrayerSkeleton';
import ThemedText from '../components/common/ThemedText';
import NewSuccessModal from '../components/NewSuccessModal';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useNotificationBadge } from '../hooks/useNotificationBadge';

const { width } = Dimensions.get('window');

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

  // Fonts: derive theme font for TextInput usage (placeholders inherit TextInput font)
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');

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
      color: Colors.anchorBlue,
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
      // weight handled by ThemedText
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
    // Additional styling applied on top of BlueSheet if needed
    contentSheet: {
      flex: 1,
      position: 'relative',
      zIndex: 2,
      // Keep subtle top shadow if desired; BlueSheet handles the blue BG and radius
      shadowColor: Colors.anchorBlue,
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
      color: Colors.anchorBlue,
      // weight handled by ThemedText
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
      color: Colors.hopeWhite,
      // weight handled by ThemedText
    },
    greetingSection: {
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 10,
    },
    greeting: {
      fontSize: 24,
      // weight handled by ThemedText
      letterSpacing: 0.5,
      color: Colors.anchorBlue,
      marginTop: 0,
      marginBottom: 2,
    },
    motivationalText: {
      fontSize: 14,
      color: Colors.anchorBlue,
      opacity: 1,
      marginTop: 0,
      marginBottom: 0,
      // weight handled by ThemedText
    },
    placeholderCard: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: Colors.black,
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
      color: Colors.text,
      // weight handled by ThemedText
    },
    cardSubtitle: {
      fontSize: 14,
      color: Colors.anchorBlueLight,
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
      color: Colors.hopeWhite,
      // weight handled by ThemedText
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
      // weight handled by ThemedText
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    actionsHeaderSubtitle: {
      fontSize: 12,
      color: Colors.textGray,
      textAlign: 'center',
      marginTop: -2,
      marginBottom: 6,
      // weight handled by ThemedText
    },
    expandableButton: {
      backgroundColor: Colors.hopeWhite,
      borderRadius: 28,
      height: 56,
      shadowColor: Colors.black,
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
      tintColor: Colors.alertCoral,
    },
    expandText: {
      color: Colors.anchorBlue,
      fontSize: 14,
      marginLeft: 8,
      overflow: 'hidden',
      // weight handled by ThemedText
    },
    // Prayer Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: Colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalKeyboardContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      // Remove extra horizontal padding to avoid layout width shifts when typing
      paddingHorizontal: 0,
    },
    prayerModalContainer: {
      backgroundColor: Colors.anchorBlue,
      borderRadius: 30,
      padding: 20,
      // Lock width so it doesn't change when inputs gain focus or while typing
      // Use screen width minus side margins, capped at 400
      width: Math.min(width - 40, 400),
      maxWidth: 400,
      alignSelf: 'center',
      maxHeight: '80%',
    },
    prayerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    prayerModalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prayerModalTitle: {
      color: Colors.hopeWhite,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    prayerModalSubtitle: {
      color: Colors.secondaryText,
      fontSize: 14,
      marginBottom: 16,
    },
    prayerModalTabs: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 8,
    },
    prayerModalTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: Colors.lightOverlay,
    },
    prayerModalTabActive: {
      backgroundColor: Colors.mediumOverlay,
    },
    prayerModalTabText: {
      color: Colors.hopeWhite,
      fontSize: 12,
      // weight handled by ThemedText
    },
    prayerModalTabInactive: {
      opacity: 0.6,
    },
    prayerModalNameInput: {
      backgroundColor: Colors.lightOverlay,
      borderRadius: 8,
      padding: 12,
      color: Colors.hopeWhite,
      fontSize: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.lightBorder,
      fontFamily: fontRegular,
    },
    prayerModalTextArea: {
      backgroundColor: Colors.lightOverlay,
      borderRadius: 8,
      padding: 12,
      color: Colors.hopeWhite,
      fontSize: 16,
      minHeight: 120,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.lightBorder,
    },
    // Combined prayer input + request display container
    combinedPrayerField: {
      backgroundColor: Colors.lightOverlay,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.lightBorder,
      marginBottom: 12,
      overflow: 'hidden',
    },
    combinedPrayerInput: {
      padding: 12,
      color: Colors.hopeWhite,
      fontSize: 16,
      minHeight: 120,
      textAlignVertical: 'top' as const,
      fontFamily: fontRegular,
    },
    combinedDivider: {
      height: 1,
      backgroundColor: Colors.mediumOverlay,
    },
    prayerModalLabel: {
      color: Colors.hopeWhite,
      fontSize: 12,
      marginBottom: 4,
      // weight handled by ThemedText
    },
    prayerModalPreview: {
      color: Colors.secondaryText,
      fontSize: 14,
      marginBottom: 16,
    },
    prayerModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    prayerModalCancelButton: {
      width: 24,
      height: 24,
      borderRadius: 20,
      backgroundColor: Colors.mediumOverlay,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    prayerModalSaveButton: {
      width: 24,
      height: 24,
      borderRadius: 20,
      backgroundColor: Colors.alertCoral,
      justifyContent: 'center',
      alignItems: 'center',
    },
    prayerModalReadOnlyField: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: Colors.subtleOverlay,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.lightOverlay,
    },
    prayerModalFieldLabel: {
      color: Colors.hopeWhite,
      fontSize: 12,
      marginBottom: 6,
      // No uppercase; keep normal casing
      // weight handled by ThemedText
    },
    prayerModalReadOnlyText: {
      color: Colors.secondaryText,
      fontSize: 14,
      lineHeight: 20,
    },
    // Prayer Requests Card styles (moved from inline to satisfy linter)
    prayerRequestsContainer: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 16,
      marginTop: 0,
      marginBottom: 0,
    },
    prayerRequestsHeaderRow: {
      position: 'relative' as const,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      minHeight: 24,
    },
    prayerRequestsHeaderTitle: {
      fontSize: 12,
      color: Colors.hopeWhite,
      textAlign: 'center' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      paddingHorizontal: 48,
    },
    prayerRequestsHeaderRight: {
      position: 'absolute' as const,
      right: 0,
    },
    prayerRequestsHeaderRightBox: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      backgroundColor: 'transparent',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    prayerRequestsHeaderCount: {
      fontSize: 12,
      color: Colors.hopeWhite,
    },
    prayerRequestItem: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      padding: 16,
    },
    prayerRequestItemSpacing: {
      marginTop: 10,
    },
    prayerRequestHeaderRow: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    prayerRequestBadge: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    prayerRequestBadgeText: {
      color: Colors.hopeWhite,
      fontSize: 10,
      letterSpacing: 0.6,
    },
    prayerRequestName: {
      color: Colors.hopeWhite,
      fontSize: 16,
      marginBottom: 4,
    },
    prayerRequestDescription: {
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 10,
    },
    prayerRequestCTA: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.3)',
    },
    prayerRequestCTAText: {
      color: Colors.hopeWhite,
      marginLeft: 6,
    },
    moreTextMarginTop: {
      marginTop: 8,
    },
    combinedReadOnlyInner: {
      padding: 12,
    },
    prayerRequestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prayerRequestLabel: {
      color: Colors.alertCoral,
      fontSize: 14,
      flex: 1,
      // weight handled by ThemedText
    },
    prayerModalTabInactiveText: {
      color: Colors.mutedText,
    },
    prayerModalReadOnlyInput: {
      color: Colors.secondaryText,
      backgroundColor: Colors.subtleOverlay,
    },
    successModalOverlay: {
      flex: 1,
      backgroundColor: Colors.veryDarkOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    successModalContainer: {
      backgroundColor: Colors.modalBlue,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginHorizontal: 40,
      borderWidth: 1,
      borderColor: Colors.lightOverlay,
    },
    successModalTitle: {
      color: Colors.hopeWhite,
      fontSize: 18,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    successModalSubtitle: {
      color: Colors.tertiaryText,
      fontSize: 14,
      textAlign: 'center',
    },
    // Prayer pagination controls (mirror ActionStepsCard pagination styles)
    prayerPaginationContainer: {
      width: '100%',
      paddingVertical: 1,
    },
    prayerPaginationGroup: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingTop: 10,
      paddingBottom: 0,
    },
    prayerPaginationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: Colors.mediumOverlay,
      gap: 6,
    },
    prayerPaginationButtonText: {
      marginLeft: 2,
      fontSize: 11,
      lineHeight: 14,
    },
    prayerShowMoreButton: {
      backgroundColor: Colors.lightOverlay,
    },
    prayerShowLessButton: {
      backgroundColor: Colors.restfulShadow,
    },
    prayerShowMoreText: {
      color: Colors.alertCoral,
    },
    prayerShowLessText: {
      color: Colors.textGray,
    },
  });

  // Always show FAB for easy access to UserInput screen (no state needed)
  const { user } = useAuth();
  const { subscription, usage, refreshSubscription } = useSubscription();
  const queryClient = useQueryClient();
  const { badgeCount } = useNotificationBadge();

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
          Logger.error('Direct subscription fetch failed', error as Error, {
      component: 'DashboardHomeScreen',
    });
        }
      }
    };
    fetchDirectSubscription();
  }, [user?.id, subscription?.tier, queryClient]); // Re-run when cached subscription changes
  const [refreshing, setRefreshing] = useState(false);
  const [actionsCount, setActionsCount] = useState(0);
  const [currentMotivationalText, setCurrentMotivationalText] = useState(0);
  const [hasPlaybooks, setHasPlaybooks] = useState(true); // Track if user has playbooks
  const [hasDevotionals, setHasDevotionals] = useState(true); // Track if user has devotionals
  const [hasScripture, setHasScripture] = useState(true); // Track if scripture is shown
  const [hasAffirmations, setHasAffirmations] = useState(true); // Track if affirmations are shown
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

  // Prayer modal editor state
  const [showPrayerEditorModal, setShowPrayerEditorModal] = useState(false);
  const [modalPrayerName, setModalPrayerName] = useState('');
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPersonName, setSuccessPersonName] = useState('');
  // Prayer Requests: show more/less toggle
  const [showAllPrayerRequests, setShowAllPrayerRequests] = useState(false);

  // Status bar: auto-detect from background
  useScreenStatusBar('auto', Colors.hopeWhite);

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // (removed) triggerSuccessHaptic — unused

  // Selection haptic (when focusing inputs)
  const triggerSelectionHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('selection', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Collapsing Playbook label
  const playbookWidth = useRef(new Animated.Value(0)).current;
  const [playbookMeasuredWidth, setPlaybookMeasuredWidth] = useState(0);

  // Simple expandable button
  const buttonWidth = useRef(new Animated.Value(56)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  // ScrollView ref to reset position on focus
  const scrollRef = useRef<ScrollView | null>(null);
  // Dashboard mount animation (fade + subtle slide up)
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(mountTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mountOpacity, mountTranslateY]);
  const fabPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fabPan.setOffset({ x: (fabPan as any).x._value || 0, y: (fabPan as any).y._value || 0 });
        fabPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        fabPan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: () => {
        fabPan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        fabPan.flattenOffset();
      },
    })
  ).current;
  // When collapsed, keep text width at 0 so the icon stays perfectly centered
  const textWidth = textOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180], // max width for the label when expanded
  });
  // Removed draggable FAB logic (unused)

  // Reintroduce auto-expand animation (parity with PlaybookListScreen)
  const expandButton = useCallback(() => {
    let animationCount = 0;
    const maxAnimations = 2;
    const runAnimation = () => {
      if (animationCount >= maxAnimations) { return; }
      animationCount++;
      Animated.parallel([
        Animated.timing(buttonWidth, { toValue: 220, duration: 400, useNativeDriver: false }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 150, useNativeDriver: false }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(textOpacity, { toValue: 0, duration: 250, useNativeDriver: false }),
            Animated.timing(buttonWidth, { toValue: 56, duration: 350, useNativeDriver: false }),
          ]).start(() => {
            if (animationCount < maxAnimations) {
              setTimeout(() => { runAnimation(); }, 3000);
            }
          });
        }, 2500);
      });
    };
    runAnimation();
  }, [buttonWidth, textOpacity]);

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

  // Removed auto-expand animation on mount/focus for floating button per UX update

  useFocusEffect(
    useCallback(() => {
      // Reset state
      buttonWidth.setValue(56);
      textOpacity.setValue(0);

      // Always scroll to top when dashboard gains focus
      try { scrollRef.current?.scrollTo({ y: 0, animated: false }); } catch {}

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

      // Collapsing Playbook label
      if (playbookMeasuredWidth > 0) {
        playbookWidth.setValue(playbookMeasuredWidth);
        Animated.timing(playbookWidth, { toValue: 0, duration: 400, useNativeDriver: false }).start();
      }
      // Auto-expand FAB after a short delay (match PlaybookListScreen UX)
      setTimeout(() => { expandButton(); }, 1000);
    }, [
      playbookMeasuredWidth,
      playbookWidth,
      buttonWidth,
      textOpacity,
      refreshSubscription,
      queryClient,
      user?.id,
      expandButton,
    ])
  );

  // Listen for content creation events to show hidden sections
  useEffect(() => {
    const onDevotionalCreated = () => {
      // Show devotionals section when new devotional is created
      setHasDevotionals(true);
      // Devotionals contain scripture, so show scripture section
      setHasScripture(true);
    };

    const onPlaybookCreated = () => {
      // Show playbooks section when new playbook is created
      setHasPlaybooks(true);
      // Playbooks contain scripture and affirmations, so show both sections
      setHasScripture(true);
      setHasAffirmations(true);
    };

    const subDevotional = DeviceEventEmitter.addListener('devotional_created', onDevotionalCreated);
    const subPlaybook = DeviceEventEmitter.addListener('playbook_created', onPlaybookCreated);

    return () => {
      try { subDevotional.remove(); } catch {}
      try { subPlaybook.remove(); } catch {}
    };
  }, []);

  // Fetch unprayed prayer requests for current user (across all dates)
  const { data: unprayedRequests = [], isLoading: loadingRequests, isFetching: fetchingRequests } = useUnprayedPrayerRequests(user?.id || '');
  const markPrayedMutation = useMarkPrayerRequestPrayed();
  const createPrayerMutation = useCreatePrayer();

  const handleOpenPrayer = (req: any) => {
    triggerLightHaptic();
    // Show prayer editor modal
    setSelectedPrayerRequest(req);
    setModalPrayerName(req.person_name || '');
    setModalPrayerRequest('');
    setShowPrayerEditorModal(true);
  };

  const handlePrayerSaved = async () => {
    try {
      if (!selectedPrayerRequest) {return;}
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
      Logger.error('Failed to mark prayer request as prayed', e as Error, { component: 'DashboardHomeScreen' });
      Alert.alert('Error', 'Failed to update prayer request status.');
    } finally {
      setShowPrayerModal(false);
      setSelectedPrayerRequest(null);
    }
  };

  const handleSaveModalPrayer = async () => {
    if (!modalPrayerRequest.trim()) {
      Alert.alert('Missing Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setSavingModalPrayer(true);
    try {
      // Create prayer with user's prayer text first, then request content in metadata
      const prayerContent = modalPrayerRequest.trim();

      await createPrayerMutation.mutateAsync({
        content: prayerContent,
        prayer_type: 'people',
        person_name: modalPrayerName.trim(),
        metadata: {
          is_prayer_request: false, // This is a prayer, not a request
          original_request_id: selectedPrayerRequest?.id,
          original_request_content: selectedPrayerRequest?.content,
          prayer_request_display: selectedPrayerRequest?.content, // For red box display
        },
        selected_date: new Date().toLocaleDateString('en-CA'), // Always use current LOCAL date for prayers (YYYY-MM-DD format)
        user_id: user?.id || '',
      });

      // Immediately show success modal and close editor to avoid any delay
      setSuccessPersonName(modalPrayerName);
      setShowSuccessModal(true);
      handleCancelModalPrayer();

      // Run remaining work in background (no awaiting) to avoid blocking UI
      try {
        if (selectedPrayerRequest) {
          markPrayedMutation.mutateAsync({
            id: selectedPrayerRequest.id,
            isPrayed: true,
            _userId: selectedPrayerRequest.user_id,
            _dateStr: selectedPrayerRequest.selected_date,
          }).catch((e) => Logger.warn('DashboardHomeScreen: markPrayed failed (background)', { component: 'DashboardHomeScreen', error: e }));
        }

        if (user?.id) {
          Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.prayers.unprayedRequests(user.id) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.prayers.all(user.id) }),
            queryClient.invalidateQueries({ queryKey: ['prayers'] }),
            queryClient.invalidateQueries({ queryKey: ['prayer-requests'] }),
          ]).catch((e) => Logger.warn('DashboardHomeScreen: invalidateQueries failed (background)', { component: 'DashboardHomeScreen', error: e }));

          // Award faith points in background; toast shown later manually
          faithPointsService
            .awardPoints(user.id, 'prayer_for_now', {
              activity_type: 'prayer_for_others',
              prayer_request_id: selectedPrayerRequest?.id,
              prayer_content: prayerContent.substring(0, 100),
              prayed_for: modalPrayerName.trim(),
              suppressNotification: true,
            })
            .catch((e) => Logger.warn('DashboardHomeScreen: awardPoints failed (background)', { component: 'DashboardHomeScreen', error: e }));
        }
      } catch (error) {
        Logger.warn('⚠️ Could not award faith points', {
      component: 'DashboardHomeScreen',
      data: error,
    });
      }

      // Show success feedback (haptic removed; toast provides a single light tap)

      // Auto-hide success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);

      // After the success modal, show the FP notification so it appears on top
      // Slight delay after hide to ensure correct layering
      if (user?.id) {
        const points = faithPointsService.getPointsForActivity('prayer_for_now');
        setTimeout(() => {
          notificationService.showPointsNotification(points, 'prayer_for_now', 'center');
        }, 3200);
      }
    } catch (e) {
      Logger.error('Failed to save prayer', e as Error, { component: 'DashboardHomeScreen' });
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setSavingModalPrayer(false);
    }
  };

  const handleCancelModalPrayer = () => {
    setShowPrayerEditorModal(false);
    setSelectedPrayerRequest(null);
    setModalPrayerName('');
    setModalPrayerRequest('');
    setSavingModalPrayer(false);
  };

  const renderPrayerRequestsCard = () => {
    // Hide entirely when not loading and there are no unprayed requests
    if (!loadingRequests && !fetchingRequests && unprayedRequests.length === 0) {
      return null;
    }

    return (
    <View style={styles.prayerRequestsContainer}>
      <View style={styles.prayerRequestsHeaderRow}>
        <ThemedText weight="semiBold" style={styles.prayerRequestsHeaderTitle}>
          {unprayedRequests.length === 1 ? 'PRAYER REQUEST' : 'PRAYER REQUESTS'}
        </ThemedText>
        <View style={styles.prayerRequestsHeaderRight}>
          <View style={styles.prayerRequestsHeaderRightBox}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} />
            <ThemedText weight="semiBold" style={styles.prayerRequestsHeaderCount}>{unprayedRequests.length}</ThemedText>
          </View>
        </View>
      </View>
      {loadingRequests ? (
        <DashboardPrayerSkeleton />
      ) : unprayedRequests.length === 0 ? (
        <ThemedText weight="regular" style={styles.cardSubtitle}>No pending prayer requests. You're all caught up!</ThemedText>
      ) : (
        (showAllPrayerRequests ? unprayedRequests : unprayedRequests.slice(0, 2)).map((req: any, idx: number) => (
          <View
            key={req.id}
            style={[styles.prayerRequestItem, idx !== 0 && styles.prayerRequestItemSpacing]}
          >
            {/* Header Badge */}
            <View style={styles.prayerRequestHeaderRow}>
              <Ionicons name="mail-unread" size={14} color={Colors.alertCoral} />
              <View style={styles.prayerRequestBadge}>
                <ThemedText weight="bold" style={styles.prayerRequestBadgeText}>PRAYER REQUEST</ThemedText>
              </View>
            </View>

            {/* Name */}
            <ThemedText weight="bold" style={styles.prayerRequestName} numberOfLines={1}>
              {req.person_name || 'Someone'}
            </ThemedText>

            {/* Description */}
            <ThemedText weight="regular" style={styles.prayerRequestDescription} numberOfLines={2}>
              {req.content || '—'}
            </ThemedText>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); handleOpenPrayer(req); }}
              style={styles.prayerRequestCTA}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.hopeWhite} />
              <ThemedText weight="bold" style={styles.prayerRequestCTAText}>
                {`Pray for ${req.person_name || 'them'} now`}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ))
      )}
      {unprayedRequests.length > 2 ? (
        <View style={styles.prayerPaginationContainer}>
          <View style={styles.prayerPaginationGroup}>
            {!showAllPrayerRequests && (
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); setShowAllPrayerRequests(true); }}
                style={[styles.prayerPaginationButton, styles.prayerShowMoreButton]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Show more prayer requests"
              >
                <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                <ThemedText weight="semiBold" style={[styles.prayerPaginationButtonText, styles.prayerShowMoreText]}>Show more</ThemedText>
              </TouchableOpacity>
            )}
            {showAllPrayerRequests && (
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); setShowAllPrayerRequests(false); }}
                style={[styles.prayerPaginationButton, styles.prayerShowLessButton]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Show less prayer requests"
              >
                <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
                <ThemedText weight="semiBold" style={[styles.prayerPaginationButtonText, styles.prayerShowLessText]}>Show less</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
      Logger.warn('Dashboard refresh error', {
      component: 'DashboardHomeScreen',
      data: e,
    });
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
        {SHOW_SUBSCRIPTION_BADGE && (() => {
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
              disabled
            >
              <ThemedText weight="semiBold" style={styles.subscriptionText}>{displayName}</ThemedText>
            </TouchableOpacity>
          );
        })()}

        {/* Playbook Counter - disabled per request */}
        {SHOW_USAGE_COUNTERS && (() => {
          const limit = subscription?.limits?.playbooks;
          const used = usage?.playbooks_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => { triggerLightHaptic(); navigation.navigate('Playbooks'); }}
            >
              <MaterialCommunityIcons name="clipboard-text-play" size={18} color={Colors.faithGold} />
              <ThemedText weight="semiBold" style={styles.counterText}>{remaining}</ThemedText>
            </TouchableOpacity>
          );
        })()}

        {/* Devotional Counter - disabled per request */}
        {SHOW_USAGE_COUNTERS && (() => {
          const limit = subscription?.limits?.devotionals;
          const used = usage?.devotionals_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => { triggerLightHaptic(); navigation.navigate('Devotionals'); }}
            >
              <MaterialCommunityIcons name="book" size={18} color={Colors.faithGold} />
              <ThemedText weight="semiBold" style={styles.counterText}>{remaining}</ThemedText>
            </TouchableOpacity>
          );
        })()}

        {/* Notifications */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            triggerLightHaptic();
            // Navigate to notifications/activity screen
            // TODO: Create dedicated notifications screen
            navigation.navigate('UserProfile');
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.anchorBlue} />
          {badgeCount > 0 && (
            <View style={styles.notificationBadge}>
              <ThemedText weight="semiBold" style={styles.notificationCount}>{badgeCount}</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Avatar with Notification */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => { triggerLightHaptic(); navigation.navigate('UserProfile'); }}
        >
          {false ? (
            <Image
              source={{ uri: user?.user_metadata?.avatar_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.initialAvatar}>
              <ThemedText weight="semiBold" style={styles.initialLetter}>{(() => {
                const meta: any = (user as any)?.user_metadata || {};
                const displayName =
                  (user as any)?.displayName ||
                  meta.full_name ||
                  [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
                  (user as any)?.email ||
                  'User';
                return (displayName || 'U').trim().charAt(0).toUpperCase();
              })()}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGreeting = () => (
    <View style={styles.greetingSection}>
      <ThemedText weight="bold" style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">Hello, {firstName}</ThemedText>
      <ThemedText weight="semiBold" style={styles.motivationalText}>
        {MOTIVATIONAL_TEXTS[currentMotivationalText]}
      </ThemedText>
    </View>
  );

  // Removed unused renderPlaceholderCard

  const renderFloatingButton = () => (
    <Animated.View
      style={[
        styles.floatingButton,
        { transform: [{ translateX: fabPan.x }, { translateY: fabPan.y }] },
      ]}
      {...fabPanResponder.panHandlers}
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
          <Animated.View style={{ opacity: textOpacity, width: textWidth }}>
            <ThemedText weight="semiBold" style={styles.expandText} numberOfLines={1}>
              Create a Playbook
            </ThemedText>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: mountOpacity, transform: [{ translateY: mountTranslateY }] },
      ]}
    >
      {renderHeader()}
      {renderGreeting()}

      <BlueSheet style={styles.contentSheet}>
        <ScrollView
          ref={scrollRef}
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

          {/* Daily Scripture - now below Streak Tracker - Hide when empty */}
          {hasScripture && (
            <>
              <DailyBibleVerseCard
                onRefresh={() => setRefreshing(true)}
                onEmpty={() => setHasScripture(false)}
              />
              <View style={styles.sectionGap} />
            </>
          )}

          {/* Row 1: Inspiration Cards (Affirmation only) - Hide when empty to prevent gap */}
          {hasAffirmations && (
            <>
              <View style={styles.row}>
                <DailyAffirmationCard
                  onRefresh={() => setRefreshing(true)}
                  onEmpty={() => setHasAffirmations(false)}
                />
              </View>
              <View style={styles.sectionGap} />
            </>
          )}

          {/* Prayer Requests Section (hide when empty) */}
          {(loadingRequests || fetchingRequests || unprayedRequests.length > 0) && (
            <>
              {renderPrayerRequestsCard()}
              <View style={styles.sectionGap} />
            </>
          )}

          {/* Removed Weekly Insights and AI Insights */}

          {/* Playbooks Section - Only show when user has playbooks */}
          {hasPlaybooks && (
            <>
              {/* Collapsing Playbook label */}
              <View style={styles.playbookLabelContainer}>
                <Animated.View
                  style={[styles.playbookLabelClip, { width: playbookWidth }]}
                >
                  <ThemedText
                    onLayout={(e) => {
                      const w = e.nativeEvent.layout.width;
                      if (w !== playbookMeasuredWidth) {
                        setPlaybookMeasuredWidth(w);
                      }
                    }}
                    style={styles.playbookLabel}
                  >
                    Playbook
                  </ThemedText>
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
                onEmpty={() => setHasPlaybooks(false)}
              />
              <View style={styles.sectionGap} />
            </>
          )}
          {/* Devotionals Section - Only show when user has devotionals */}
          {hasDevotionals && (
            <>
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
                onEmpty={() => setHasDevotionals(false)}
              />
              <View style={styles.sectionGap} />
            </>
          )}

          {/* Today's Actions - Only show when there are unfinished steps */}
          {actionsCount > 0 && (
            <>
              {/* External Actions header and subtitle (moved out of card) */}
              <View style={styles.actionsHeaderContainer}>
                <ThemedText weight="semiBold" style={styles.actionsHeaderTitle}>{`TODAY'S ACTION${actionsCount === 1 ? '' : 'S'}`}</ThemedText>
                <ThemedText weight="medium" style={styles.actionsHeaderSubtitle}>{`Unfinished Steps (${actionsCount})`}</ThemedText>
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
            </>
          )}

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

          {/* Bottom spacing for floating button */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </BlueSheet>
      {renderFloatingButton()}

      {/* Reflection Modals */}
      <SmartJournalingReflectionModal
        visible={(() => {

          return showSJModal;
        })()}
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
        onSave={(_entry) => {
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

      {/* Prayer Editor Modal */}
      <Modal
        visible={showPrayerEditorModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={handleCancelModalPrayer}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardContainer}
          >
            <View style={styles.prayerModalContainer}>
              <View style={styles.prayerModalHeader}>
                <View style={styles.prayerModalHeaderLeft}>
                  <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
                  <ThemedText weight="bold" style={styles.prayerModalTitle}>PRAY FOR {modalPrayerName || 'Someone'}</ThemedText>
                </View>
              </View>

              <ThemedText weight="regular" style={styles.prayerModalSubtitle}>Lift up a prayer for {modalPrayerName || 'them'}</ThemedText>

              {/* Name field - pre-filled and non-editable */}
              <TextInput
                style={[styles.prayerModalNameInput]}
                value={modalPrayerName}
                onChangeText={setModalPrayerName}
                placeholder="Name (optional)"
                placeholderTextColor={Colors.placeholderText}
              />

              {/* Combined field: Prayer input + Prayer Request inside same card */}
              <View style={styles.combinedPrayerField}>
                <TextInput
                  style={styles.combinedPrayerInput}
                  placeholder={`Write a prayer for ${modalPrayerName || 'them'}…`}
                  placeholderTextColor={Colors.placeholderText}
                  value={modalPrayerRequest}
                  onChangeText={setModalPrayerRequest}
                  onFocus={triggerSelectionHaptic}
                  multiline
                  numberOfLines={6}
                  autoFocus
                />
                <View style={styles.combinedDivider} />
                <View style={styles.combinedReadOnlyInner}>
                  <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer request from {modalPrayerName || 'them'}</ThemedText>
                  <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{selectedPrayerRequest?.content || 'Provision for business'}</ThemedText>
                </View>
              </View>

              <View style={styles.prayerModalActions}>
                <TouchableOpacity
                  style={styles.prayerModalCancelButton}
                  onPress={() => { triggerLightHaptic(); handleCancelModalPrayer(); }}
                  disabled={savingModalPrayer}
                >
                  <Ionicons name="close" size={14} color={Colors.hopeWhite} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.prayerModalSaveButton}
                  onPress={() => { triggerLightHaptic(); handleSaveModalPrayer(); }}
                  disabled={savingModalPrayer || !modalPrayerRequest.trim()}
                >
                  <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Success Modal */}
      <NewSuccessModal
        visible={showSuccessModal}
        config={{
          title: `Prayed for ${successPersonName}`,
          message: 'God hears. We’ve saved your prayer so you can keep them close.',
          hideDoneButton: true,
        }}
        onDone={() => setShowSuccessModal(false)}
      />
    </Animated.View>
  );
};

export default withErrorBoundary(DashboardHomeScreen, 'DashboardHomeScreen');
