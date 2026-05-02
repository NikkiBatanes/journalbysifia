import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet,
  Image,
  NativeModules,
  DeviceEventEmitter,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useScroll } from '../context/ScrollContext';
import { useQueryClient } from '@tanstack/react-query';
import { faithPointsService } from '../services/faithPointsService';
import { notificationService } from '../services/notificationService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { Colors } from '../theme/colors';
import { adminAnalyticsService } from '../services/adminAnalyticsService';
import { getTierShortName, normalizeTierInput } from '../utils/tierDisplayUtils';
import { SubscriptionTier } from '../interfaces/subscription';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { Logger } from '../utils/ProductionLogger';
import { NotificationTester } from '../utils/notificationTester';
import { SMART_NOTIFICATION_TYPES } from '../services/notifications/notificationTypes';
import { billingNotificationService } from '../services/billingNotificationService';
import { pushNotificationService } from '../services/pushNotificationService';
import { generateSalesCopy, type SalesCopyParams } from '../utils/dynamicSalesCopy';

import CombinedContentCarousel from '../components/dashboard/CombinedContentCarousel';
import FaithfulActionsCarousel, { extractIncompleteFaithfulActions } from '../components/dashboard/FaithfulActionsCarousel';
import ActionStepsCard from '../components/dashboard/ActionStepsCard';
import ReflectionQuestionsCard from '../components/dashboard/ReflectionQuestionsCard';
import SmartJournalingReflectionModal from './SmartJournalingReflectionModal';
import DevotionalDetailReflectionModal from './DevotionalDetailReflectionModal';
import BlueSheet from '../components/layout/BlueSheet';
import SmartJournalingPrayerModal from './SmartJournalingPrayerModal';
import SmartJournalingGratitudeModal from './SmartJournalingGratitudeModal';
import SmartJournalingTimeBlockModal from './SmartJournalingTimeBlockModal';
import JournalTypeSelectorTooltip, { JournalType } from '../components/JournalTypeSelectorTooltip';

// Removed WeeklyInsights and AIInsights
// Removed AsyncStorage (unused)
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { useUnprayedPrayerRequests, useMarkPrayerRequestPrayed, useCreatePrayer } from '../services/hooks/usePrayerData';
import { queryKeys } from '../services/queryKeys';
import { toLocalDateString } from '../utils/date';
import { getPlaybooks } from '../services/apiIntegration';
import ThemedText from '../components/common/ThemedText';
import NewSuccessModal from '../components/NewSuccessModal';
import SubscriptionPlanModal from '../components/SubscriptionPlanModal';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useNotificationBadge } from '../hooks/useNotificationBadge';

// Feature flags: hide subscription badge and usage counters for all plans
const SHOW_SUBSCRIPTION_BADGE = false;
const SHOW_USAGE_COUNTERS = false;

const { width } = Dimensions.get('window');


interface DashboardHomeScreenProps {
  navigation: any;
}

const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive notification badge dimensions for iPad
  const { notificationBadgeSize, notificationBadgeRadius, notificationBadgeTop, notificationBadgeRight, notificationCountFontSize } = useMemo(() => {
    if (screenWidth >= 768) {
      // iPad - smaller badge
      return {
        notificationBadgeSize: 12,
        notificationBadgeRadius: 6,
        notificationBadgeTop: 4,
        notificationBadgeRight: 4,
        notificationCountFontSize: 7,
      };
    } else {
      // Phone - normal size
      return {
        notificationBadgeSize: 14,
        notificationBadgeRadius: 7,
        notificationBadgeTop: 6,
        notificationBadgeRight: 6,
        notificationCountFontSize: 9,
      };
    }
  }, [screenWidth]);

  // Fonts: derive theme font for TextInput usage (placeholders inherit TextInput font)
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const font = React.useMemo(() => ({ fontFamily: fontRegular }), [fontRegular]);

  // Create styles using theme values
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    safeArea: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: insets.top,
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
    counterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Colors.anchorBlue,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    counterText: {
      fontSize: 12,
      color: Colors.hopeWhite,
    },
    iconButton: {
      padding: 6,
      borderRadius: 14,
      backgroundColor: 'transparent',
    },
    devNotificationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: Colors.anchorBlue,
    },
    devNotificationButtonText: {
      color: Colors.hopeWhite,
      fontSize: 10,
      lineHeight: 12,
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
    marginTop: 1,
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
      marginBottom: 10,
      overflow: 'hidden',
    },
    playbookLabelClip: {
      overflow: 'hidden',
    },
    playbookLabel: {
      fontSize: 20,
      color: Colors.text,
    },
    notificationBadge: {
      position: 'absolute',
      top: notificationBadgeTop,
      right: notificationBadgeRight,
      backgroundColor: Colors.alertCoral,
      borderRadius: notificationBadgeRadius,
      minWidth: notificationBadgeSize,
      height: notificationBadgeSize,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationCount: {
      fontSize: notificationCountFontSize,
      color: Colors.hopeWhite,
      lineHeight: notificationBadgeSize,
    },
    profileImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      resizeMode: 'cover',
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
      paddingBottom: 4,
    },
    greeting: {
      fontSize: 20,
      // weight handled by ThemedText
      letterSpacing: 0.5,
      color: Colors.anchorBlue,
      marginTop: 0,
      marginBottom: 2,
    },
    motivationalText: {
      fontSize: 16,
      color: Colors.anchorBlue,
      opacity: 1,
      marginTop: 0,
      marginBottom: 4,
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
      paddingBottom: 100,
      paddingTop: 0,
    },
    pageInner: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    sectionGap: {
      height: 10,
    },
    smallSectionGap: {
      height: 8,
    },
    newMomentCardContainer: {
      marginBottom: 24,
      marginTop: 16,
    },
    newMomentCardContent: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newMomentInnerCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 30,
      paddingVertical: 24,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      gap: 16,
    },
    newMomentPrompt: {
      color: Colors.hopeWhite,
      fontSize: 20,
      textAlign: 'center',
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    newMomentButton: {
      backgroundColor: 'transparent',
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.hopeWhite,
      flexDirection: 'row',
      alignItems: 'center',
    },
    newMomentButtonText: {
      color: Colors.hopeWhite,
      letterSpacing: 0.5,
      fontSize: 15,
    },
    newMomentButtonIcon: {
      marginRight: 8,
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
    fullScreenModalContainer: {
      flex: 1,
      backgroundColor: Colors.anchorBlue,
      zIndex: 1,
    },
    fullScreenPrayerModalContainer: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
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
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    prayerModalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
    },
    prayerModalTitle: {
      color: Colors.hopeWhite,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    prayerModalSubtitle: {
      color: Colors.secondaryText,
      fontSize: 14,
      marginBottom: 16,
      textAlign: 'center',
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
      width: '100%',
      backgroundColor: Colors.inputBackground,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      padding: 14,
      color: Colors.hopeWhite,
      fontSize: 14,
      marginBottom: 20,
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
      backgroundColor: Colors.inputBackground,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      padding: 14,
      minHeight: 150,
      overflow: 'hidden',
    },
    combinedPrayerInput: {
      color: Colors.hopeWhite,
      fontSize: 15,
      lineHeight: 22,
      minHeight: 80,
      backgroundColor: 'transparent',
    },
    combinedDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
      marginVertical: 12,
    },
    combinedReadOnlyInner: {
      backgroundColor: 'rgba(26,60,109,0.15)',
      borderRadius: 8,
      padding: 12,
    },
    prayerModalLabel: {
      color: Colors.hopeWhite,
      fontSize: 12,
      marginBottom: 4,
      // weight handled by ThemedText
    },
    prayerModalFieldLabel: {
      color: Colors.hopeWhite,
      fontSize: 12,
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    prayerModalReadOnlyText: {
      color: Colors.secondaryText,
      fontSize: 14,
      lineHeight: 20,
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
      position: 'absolute',
      right: 20,
      top: 8,
      width: 42,
      height: 42,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.09)',
      borderRadius: 999,
      zIndex: 100,
    },
    prayerModalSaveButton: {
      position: 'absolute',
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.alertCoral,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 100,
    },
    prayerModalReadOnlyField: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: Colors.subtleOverlay,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.lightOverlay,
    },
    // Prayer Requests Card styles (moved from inline to satisfy linter)
    prayerRequestsContainer: {
      backgroundColor: 'transparent',
      borderRadius: 30,
      padding: 16,
      marginTop: 0,
      marginBottom: 16,
      width: screenWidth >= 768 ? 384 : Math.round((width - 32) * 0.85),
      alignSelf: 'center',
    },
    prayerRequestsHeaderRow: {
      position: 'relative' as const,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
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
      borderRadius: 30,
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
      marginBottom: 10,
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
  const { setShowTabBar } = useScroll();
  const tabBarCollapsedRef = useRef(false);
  const { badgeCount, fetchBadgeCount } = useNotificationBadge();
  const [isTestingNotifications, _setIsTestingNotifications] = useState(false);
  const [notifTestModalVisible, setNotifTestModalVisible] = useState(false);
  const [notifTestTab, setNotifTestTab] = useState<'types' | 'queue' | 'history'>('types');
  const [notifQueueItems, setNotifQueueItems] = useState<any[]>([]);
  const [notifHistoryItems, setNotifHistoryItems] = useState<any[]>([]);
  const [notifDataLoading, setNotifDataLoading] = useState(false);
  const [notifSending, setNotifSending] = useState<string | null>(null);
  const [notifLastSent, setNotifLastSent] = useState<{ type: string; title: string; message: string; debug?: string } | null>(null);
  const [notifSimulatedDay, setNotifSimulatedDay] = useState<number | null>(null);
  const [salesCopyModalVisible, setSalesCopyModalVisible] = useState(false);
  const [subscriptionPlanModalVisible, setSubscriptionPlanModalVisible] = useState(false);
  const [subscriptionTestMode, setSubscriptionTestMode] = useState<any>(null);

  const openSalesOfferFromSalesCopy = useCallback((params: any) => {
    const normalizedParams = {
      ...params,
      currentTier: params?.currentTier || params?.testModeTier,
    };

    if (normalizedParams.testModeTier === 'free_trial') {
      normalizedParams.currentTier = 'free_trial';
      normalizedParams.testModeIsOnTrial = normalizedParams.testModeIsOnTrial ?? true;
      normalizedParams.testModeHasStartedTrial = normalizedParams.testModeHasStartedTrial ?? true;
      normalizedParams.currentTrialChosenTier = normalizedParams.currentTrialChosenTier || normalizedParams.testModeTrialChosenTier;
      normalizedParams.currentTrialBillingCycle = normalizedParams.currentTrialBillingCycle || normalizedParams.testModeBillingCycle;
    }

    setSalesCopyModalVisible(false);
    setTimeout(() => {
      navigation.navigate('OnboardingSalesOffer' as any, normalizedParams);
    }, 250);
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      fetchBadgeCount();
    }, [fetchBadgeCount])
  );

  const handleTestAllNotifications = useCallback(() => {
    if (!__DEV__) {return;}
    setNotifTestTab('types');
    setNotifTestModalVisible(true);
  }, []);

  const loadNotifData = useCallback(async (tab: 'queue' | 'history') => {
    if (!user?.id) {return;}
    setNotifDataLoading(true);
    try {
      if (tab === 'queue') {
        const items = await NotificationTester.fetchMyQueue(user.id);
        setNotifQueueItems(items);
      } else {
        const items = await NotificationTester.fetchMyHistory(user.id);
        setNotifHistoryItems(items);
      }
    } catch (e) {
      Logger.error('Failed to load notif data', e as Error, { component: 'DashboardHomeScreen' });
    } finally {
      setNotifDataLoading(false);
    }
  }, [user?.id]);

  const handleSendSingleType = useCallback(async (type: string) => {
    setNotifSending(type);
    setNotifLastSent(null);
    try {
      const copy = await NotificationTester.sendSingleTypeTest(type as any, user?.id, notifSimulatedDay ?? undefined);
      if (copy) {
        setNotifLastSent({ type, title: copy.title, message: copy.message, debug: copy.debug });
      } else {
        setNotifLastSent({ type, title: '(no copy)', message: '', debug: 'no userId' });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send notification.');
    } finally {
      setNotifSending(null);
      // History reloads via 'notification_saved' event when the notification actually fires (~2 s)
      // Queue tab: reload now since engine writes to queue synchronously
      if (notifTestTab === 'queue') {
        loadNotifData('queue');
      }
    }
  }, [user?.id, notifSimulatedDay, notifTestTab, loadNotifData]);

  const handleSendBillingType = useCallback(async (type: string) => {
    if (!user?.id) {return;}
    setNotifSending(type);
    setNotifLastSent(null);
    try {
      const rawTier = subscription?.subscription_display_name || subscription?.tier || 'your plan';
      const tier = (rawTier === 'seeker' || rawTier === 'siFia Seeker') ? 'siFia Free' : rawTier;
      const copyMap: Record<string, { title: string; message: string }> = {
        subscription_renewed: { title: 'Your room is restored', message: `Your ${tier} plan renewed. Fresh room for playbooks and devotionals — keep going.` },
        payment_failed: { title: 'Payment Failed 💳', message: 'Your payment method failed. Please update it to continue your subscription.' },
        subscription_cancelled: { title: 'Subscription Cancelled 📋', message: 'We\'ll miss you! Your benefits continue until your plan expires.' },
        payment_successful: { title: `Welcome to ${tier}! 🌸`, message: 'Your payment was successful. Enjoy your enhanced spiritual journey!' },
      };
      const copy = copyMap[type] || { title: type, message: 'Billing event fired' };

      // Fire the push directly (2 s delay) so the banner appears immediately during testing
      await pushNotificationService.scheduleLocalNotification(
        { title: copy.title, message: copy.message, data: { type, deep_link: 'sifia://dashboard', test: true } },
        new Date(Date.now() + 2000),
      );

      // Also queue through billing service so it persists in the notification screen
      switch (type) {
        case 'subscription_renewed':
          billingNotificationService.handleSubscriptionRenewal(user.id, tier).catch(() => {});
          break;
        case 'payment_failed':
          billingNotificationService.handlePaymentFailure(user.id, 'test failure').catch(() => {});
          break;
        case 'subscription_cancelled':
          billingNotificationService.handleSubscriptionCancellation(user.id).catch(() => {});
          break;
        case 'payment_successful':
          billingNotificationService.handlePaymentSuccess(user.id, tier, 0).catch(() => {});
          break;
      }

      setNotifLastSent({ type, title: copy.title, message: copy.message, debug: 'push fires in ~2 s' });
    } catch (e) {
      Alert.alert('Error', 'Failed to send billing notification.');
    } finally {
      setNotifSending(null);
    }
  }, [user?.id, subscription]);

  // Add direct subscription fetch for debugging
  const [directSubscription, setDirectSubscription] = useState<any>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [rotationalMessage, setRotationalMessage] = useState(0);

  const motivationalMessages = [
    'Reflect, revisit, and keep going',
    'Your saved truths are here',
    'Return to what you\'re carrying with God',
    'Stay rooted in what God shows',
    'Keep going beyond this moment',
    'A quiet place to keep walking',
    'Take the next faithful step',
    'Pick up where grace met you',
  ];

  // Rotate motivational messages daily
  useEffect(() => {
    const loadDailyMessage = async () => {
      try {
        const today = new Date().toDateString();
        const storedDate = await AsyncStorage.getItem('motivationalMessageDate');
        const storedIndex = await AsyncStorage.getItem('motivationalMessageIndex');

        if (storedDate !== today) {
          // New day, rotate to next message
          const newIndex = storedIndex ? (parseInt(storedIndex, 10) + 1) % motivationalMessages.length : 0;
          await AsyncStorage.setItem('motivationalMessageDate', today);
          await AsyncStorage.setItem('motivationalMessageIndex', newIndex.toString());
          setRotationalMessage(newIndex);
        } else if (storedIndex !== null) {
          // Same day, use stored index
          setRotationalMessage(parseInt(storedIndex, 10));
        }
      } catch (error) {
        console.error('Failed to load daily motivational message:', error);
      }
    };

    loadDailyMessage();
  }, [motivationalMessages.length]);

  // Reset image load state when user changes
  useEffect(() => {
    setImageLoadFailed(false);
  }, [user]);

  useEffect(() => {
    const fetchDirectSubscription = async () => {
      if (user?.id) {
        try {
          const { subscriptionService } = await import('../services/subscriptionService');
          const directData = await subscriptionService.getUserSubscription(user.id);
          setDirectSubscription(directData);

          // If data doesn't match, invalidate React Query cache
          if (directData?.tier !== subscription?.tier && subscription?.tier) {
            queryClient.invalidateQueries({
              queryKey: ['subscription', user.id],
              refetchType: 'active', // Force immediate refetch
            });
          }
        } catch (_error) {
          Logger.error('Direct subscription fetch failed', _error as Error, {
      component: 'DashboardHomeScreen',
    });
        }
      }
    };
    fetchDirectSubscription();
  }, [user?.id, subscription?.tier, queryClient]); // Re-run when cached subscription changes
  const [refreshing, setRefreshing] = useState(false);
  const [actionsCount, setActionsCount] = useState(0);
  const [hasContent, setHasContent] = useState(true); // Track if user has any content
  const [faithfulActions, setFaithfulActions] = useState<any[]>([]);
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
  // Gratitude and TimeBlock modal state
  const [showGratitudeModal, setShowGratitudeModal] = useState(false);
  const [showTimeBlockModal, setShowTimeBlockModal] = useState(false);
  // Journal type selector tooltip state
  const [showJournalTypeSelector, setShowJournalTypeSelector] = useState(false);
  const [journalSelectorContent, setJournalSelectorContent] = useState('');

  // Prayer modal editor state
  const [showPrayerEditorModal, setShowPrayerEditorModal] = useState(false);
  const [modalPrayerName, setModalPrayerName] = useState('');
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPersonName, setSuccessPersonName] = useState('');

  // Hide status bar when prayer editor modal is open
  useEffect(() => {
    if (showPrayerEditorModal) {
      StatusBar.setHidden(true);
      return () => StatusBar.setHidden(false);
    }
  }, [showPrayerEditorModal]);
  // Prayer Requests: show more/less toggle
  const [showAllPrayerRequests, setShowAllPrayerRequests] = useState(false);

  // Status bar: auto-detect from background
  useScreenStatusBar('auto', Colors.hopeWhite);

  // Collapse bottom nav on scroll down, expand only when scrolling back to the very top
  const lastScrollYRef = useRef(0);
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;
    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar]);

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
  // Get user's first name with robust fallbacks
  const firstName =
    (user as any)?.firstName ||
    user?.user_metadata?.first_name ||
    (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).trim().split(/\s+/)[0] : undefined) ||
    (user as any)?.displayName?.split?.(' ')?.[0] ||
    user?.user_metadata?.given_name ||
    user?.email?.split('@')[0] ||
    'Friend';

  useFocusEffect(
    useCallback(() => {
      // Always scroll to top when dashboard gains focus
      try { scrollRef.current?.scrollTo({ y: 0, animated: false }); } catch {}
      // Ensure tab bar is expanded when returning to this screen
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);

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
    }, [
      refreshSubscription,
      queryClient,
      user?.id,
      setShowTabBar,
    ])
  );

  // Listen for content creation events to show hidden sections
  useEffect(() => {
    const onContentCreated = () => {
      // Show content section when new content is created
      setHasContent(true);
    };

    const subDevotional = DeviceEventEmitter.addListener('devotional_created', onContentCreated);
    const subPlaybook = DeviceEventEmitter.addListener('playbook_created', onContentCreated);

    return () => {
      try { subDevotional.remove(); } catch {}
      try { subPlaybook.remove(); } catch {}
    };
  }, []);

  // Auto-reload History tab when a notification is actually saved (fires ~2s after Send tap)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('notification_saved', () => {
      if (notifTestModalVisible && notifTestTab === 'history') {
        loadNotifData('history');
      }
    });
    return () => sub.remove();
  }, [notifTestModalVisible, notifTestTab, loadNotifData]);

  // Fetch unprayed prayer requests for current user (across all dates)
  const { data: unprayedRequests = [] } = useUnprayedPrayerRequests(user?.id || '');
  const markPrayedMutation = useMarkPrayerRequestPrayed();
  const createPrayerMutation = useCreatePrayer();

  // Fetch faithful actions from playbooks
  useEffect(() => {
    const fetchFaithfulActions = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const playbooksData = await getPlaybooks(user.id, { lightweight: true });
        const actions = extractIncompleteFaithfulActions(playbooksData);
        // Limit to 5 faithful actions
        setFaithfulActions(actions.slice(0, 5));
      } catch (error) {
        console.error('Error fetching faithful actions:', error);
      }
    };

    fetchFaithfulActions();
  }, [user?.id]);

  const handleOpenPrayer = (req: any) => {
    // Guard: don't navigate if prayer request is still an optimistic (temp) entry
    if (!req.id || req.id.startsWith('temp-')) { return; }
    triggerLightHaptic();
    // Navigate to PrayerEditorScreen instead of showing modal
    navigation.navigate('PrayerEditor' as any, {
      prayerRequest: {
        person_name: req.person_name,
        content: req.content,
        id: req.id,
        user_id: req.user_id,
        selected_date: req.selected_date || toLocalDateString(new Date()),
      },
    });
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
      // Only close modal for prayer requests, not for dashboard prayers
      setShowPrayerModal(false);
      setSelectedPrayerRequest(null);
    } catch (e) {
      Logger.error('Failed to mark prayer request as prayed', e as Error, { component: 'DashboardHomeScreen' });
      Alert.alert('Error', 'Failed to update prayer request status.');
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

      // Immediately show success modal and close editor to ensure proper z-index layering
      setSuccessPersonName(modalPrayerName);
      setShowSuccessModal(true);
      setShowPrayerEditorModal(false);

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
      } catch (_error) {
        Logger.warn('⚠️ Could not award faith points', {
      component: 'DashboardHomeScreen',
      data: _error,
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
    // Hide entirely when there are no unprayed requests (including during loading)
    if (unprayedRequests.length === 0) {
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
      {unprayedRequests.length === 0 ? (
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
        queryClient.invalidateQueries({
          queryKey: ['subscription', userId],
          refetchType: 'active', // Force immediate refetch
        }),
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

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devNotificationButton}
            onPress={() => {
              triggerLightHaptic();
              setSalesCopyModalVisible(true);
            }}
          >
            <Ionicons name="document-text-outline" size={14} color={Colors.hopeWhite} />
            <ThemedText weight="semiBold" style={styles.devNotificationButtonText}>
              Sales
            </ThemedText>
          </TouchableOpacity>
        )}

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devNotificationButton}
            onPress={() => {
              triggerLightHaptic();
              handleTestAllNotifications();
            }}
            disabled={isTestingNotifications}
          >
            {isTestingNotifications ? (
              <ActivityIndicator size="small" color={Colors.hopeWhite} />
            ) : (
              <Ionicons name="flask-outline" size={14} color={Colors.hopeWhite} />
            )}
            <ThemedText weight="semiBold" style={styles.devNotificationButtonText}>
              Test
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Notifications */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            triggerLightHaptic();
            navigation.navigate('Notifications');
          }}
          delayLongPress={500}
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
          {(() => {
            // Only allow local file URIs - block any external URLs
            const avatarUrl = (user as any)?.user_metadata?.avatar_url;
            const safeAvatarUrl = avatarUrl && avatarUrl.startsWith('file://') ? avatarUrl : null;

            return safeAvatarUrl && !imageLoadFailed ? (
              <Image
                source={{ uri: safeAvatarUrl }}
                style={styles.profileImage}
                onError={() => {
                  setImageLoadFailed(true);
                }}
                onLoad={() => {
                  setImageLoadFailed(false);
                }}
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
            );
          })()}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGreeting = () => (
    <View style={styles.greetingSection}>
      <ThemedText weight="bold" style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">Hello, {firstName}</ThemedText>
      <ThemedText weight="semiBold" style={styles.motivationalText}>
        {motivationalMessages[rotationalMessage]}
      </ThemedText>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right']}>
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
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <View style={styles.pageInner}>
          {/* Today’s Scripture removed */}

          {/* Today’s Word to Reflect On removed */}

          {/* Removed Weekly Insights and AI Insights */}

          {/* Removed Start a New Moment card */}

          <View style={styles.sectionGap} />

          {/* Prayer Requests Section (hide when empty) */}
          {unprayedRequests.length > 0 && renderPrayerRequestsCard()}

          <View style={styles.sectionGap} />

          {hasContent && (
            <CombinedContentCarousel
              onPlaybookPress={(playbook) => {
                triggerLightHaptic();
                // Track playbook view for analytics
                if (user?.id) {
                  adminAnalyticsService.trackFeatureUsage(user.id, 'playbook_view', { playbook_id: playbook.id, playbook_title: playbook.title });
                }
                navigation.navigate('PlaybookWalkthrough' as any, { playbook });
              }}
              onDevotionalPress={(devotional) => {
                triggerLightHaptic();
                // Track devotional view for analytics
                if (user?.id) {
                  adminAnalyticsService.trackFeatureUsage(user.id, 'devotional_view', { devotional_id: devotional.id, devotional_title: devotional.title });
                }
                navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
              }}
              onEmpty={() => setHasContent(false)}
            />
          )}

          <View style={styles.sectionGap} />

          {/* Faithful Actions Carousel - limited to 5 */}
          {faithfulActions.length > 0 && (
            <FaithfulActionsCarousel
              faithfulActions={faithfulActions}
              onPress={(item) => {
                triggerLightHaptic();
                navigation.navigate('PlaybookWalkthrough', {
                  playbook: { id: item.playbookId },
                  initialStep: 3,
                  initialActionIndex: item.actionIndex - 1,
                });
              }}
            />
          )}

          <View style={styles.sectionGap} />

          {/* Reflection Questions Card */}
          <ReflectionQuestionsCard
            onQuestionPress={(q: any) => {

              triggerLightHaptic();
              // Track reflection usage for analytics
              if (user?.id) {
                adminAnalyticsService.trackFeatureUsage(user.id, 'reflection', { question_id: q.id, question: q.question });
              }
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
            </>
          )}

          {/* Removed sections: Faith Community, Quick Actions, Growth & Progress, Community (Prayer Circle, Testimonies) */}

          </View>
        </ScrollView>
      </BlueSheet>
      {/* Reflection Modals */}
      <SmartJournalingReflectionModal
        visible={showSJModal}
        subtaskTitle={selectedReflection?.question || ''}
        // Pass metadata based on sourceType
        playbookTitle={
          selectedReflection?.sourceType === 'playbook'
            ? selectedReflection.source
            : selectedReflection?.sourceType === 'guided'
            ? selectedReflection.source // 'Free Guided Prompt' or 'Guided Prompt'
            : undefined
        }
        // Set isGuidedReflection only for guided prompts to hide metadata for those
        isGuidedReflection={selectedReflection?.sourceType === 'guided'}
        onSave={() => {
          // Don't close modal immediately - success modal will handle the flow
        }}
        onCancel={() => {
          setShowSJModal(false);
          setSelectedReflection(null);
          setJournalSelectorContent('');
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
        subtaskTitle={selectedPrayerRequest ? (selectedPrayerRequest.person_name ? `Pray for ${selectedPrayerRequest.person_name}` : 'Prayer') : (selectedReflection?.question || '')}
        initialActiveTab={selectedPrayerRequest ? 'people' : undefined}
        initialPersonName={selectedPrayerRequest?.person_name || ''}
        initialPrayerRequest={selectedPrayerRequest?.content || ''}
        onSave={() => {
          // Don't close modal immediately - success modal will handle the flow
          // Only handle prayer request marking if it's a prayer request (not dashboard scripture/declaration)
          if (selectedPrayerRequest) {
            handlePrayerSaved();
          }
        }}
        onCancel={() => {
          setShowPrayerModal(false);
          setSelectedPrayerRequest(null);
          setSelectedReflection(null);
          setJournalSelectorContent('');
        }}
      />

      {/* Gratitude Modal */}
      <SmartJournalingGratitudeModal
        visible={showGratitudeModal}
        subtaskTitle={selectedReflection?.question || ''}
        onSave={() => {
          // Don't close modal immediately - success modal will handle the flow
        }}
        onCancel={() => {
          setShowGratitudeModal(false);
          setSelectedReflection(null);
          setJournalSelectorContent('');
        }}
      />

      {/* TimeBlock Modal */}
      <SmartJournalingTimeBlockModal
        visible={showTimeBlockModal}
        subtaskTitle={selectedReflection?.question || ''}
        onSave={() => {
          // Don't close modal immediately - success modal will handle the flow
        }}
        onCancel={() => {
          setShowTimeBlockModal(false);
          setSelectedReflection(null);
          setJournalSelectorContent('');
        }}
      />

      {/* Prayer Editor Modal */}
      <Modal
        visible={showPrayerEditorModal}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelModalPrayer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fullScreenModalContainer}
        >
          <View style={styles.fullScreenPrayerModalContainer}>
              <TouchableOpacity
                style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
                onPress={() => { triggerLightHaptic(); handleCancelModalPrayer(); }}
                disabled={savingModalPrayer}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>

              <View style={styles.prayerModalHeader}>
                <View style={styles.prayerModalHeaderLeft}>
                  <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
                  <ThemedText weight="bold" style={styles.prayerModalTitle}>PRAY FOR {modalPrayerName || 'Someone'}</ThemedText>
                </View>
              </View>

              <ThemedText weight="regular" style={styles.prayerModalSubtitle}>Lift up a prayer for {modalPrayerName || 'them'}</ThemedText>

              {/* Name field - pre-filled and non-editable */}
              <TextInput
                style={[styles.prayerModalNameInput, font]}
                value={modalPrayerName}
                onChangeText={setModalPrayerName}
                placeholder="Name (optional)"
                placeholderTextColor={Colors.placeholderText}
                keyboardAppearance="dark"
                editable={false}
              />

              {/* Combined field: Prayer input + Prayer Request inside same card */}
              <View style={styles.combinedPrayerField}>
                <TextInput
                  style={[styles.combinedPrayerInput, font]}
                  placeholder={`Write a prayer for ${modalPrayerName || 'them'}…`}
                  placeholderTextColor={Colors.placeholderText}
                  value={modalPrayerRequest}
                  onChangeText={setModalPrayerRequest}
                  onFocus={triggerSelectionHaptic}
                  multiline
                  numberOfLines={6}
                  autoFocus
                  keyboardAppearance="dark"
                />
                <View style={styles.combinedDivider} />
                <View style={styles.combinedReadOnlyInner}>
                  <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer Request</ThemedText>
                  <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{selectedPrayerRequest?.content || 'Provision for business'}</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.prayerModalSaveButton, { bottom: insets.bottom - 10, opacity: modalPrayerRequest.trim() ? 1 : 0 }]}
                onPress={() => { triggerLightHaptic(); handleSaveModalPrayer(); }}
                disabled={savingModalPrayer || !modalPrayerRequest.trim()}
              >
                <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Modal */}
      <View style={{ zIndex: 10000 }}>
        <NewSuccessModal
          visible={showSuccessModal}
          config={{
            title: `Prayed for ${successPersonName}`,
            message: 'God hears. We’ve saved your prayer so you can keep them close.',
            hideDoneButton: true,
          }}
          onDone={() => {
            setShowSuccessModal(false);
            // Reset prayer modal state to prevent flickering
            setSelectedPrayerRequest(null);
            setModalPrayerName('');
            setModalPrayerRequest('');
            setSavingModalPrayer(false);
          }}
        />
      </View>

      {/* Journal Type Selector Tooltip */}
      <JournalTypeSelectorTooltip
        visible={showJournalTypeSelector}
        subtaskText={journalSelectorContent}
        onSelect={(type: JournalType) => {
          setShowJournalTypeSelector(false);
          // Keep selectedReflection and journalSelectorContent for the modal
          // Open the appropriate modal based on journal type
          if (type === 'reflection') {
            setShowSJModal(true);
          } else if (type === 'prayer') {
            setShowPrayerModal(true);
          } else if (type === 'gratitude') {
            setShowGratitudeModal(true);
          } else if (type === 'timeblock') {
            setShowTimeBlockModal(true);
          }
        }}
        onClose={() => {
          // Only clear state when user cancels (doesn't select a type)
          setShowJournalTypeSelector(false);
          setJournalSelectorContent('');
          setSelectedReflection(null);
        }}
      />
    </Animated.View>

    {/* Dev Notification Test Modal */}
    {__DEV__ && (
      <Modal
        visible={notifTestModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotifTestModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f1623' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
            <ThemedText weight="bold" style={{ color: '#fff', fontSize: 16 }}>Notification Tester</ThemedText>
            <TouchableOpacity onPress={() => setNotifTestModalVisible(false)}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            {(['types', 'queue', 'history'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  setNotifTestTab(tab);
                  if (tab === 'queue' || tab === 'history') {loadNotifData(tab);}
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: notifTestTab === tab ? Colors.anchorBlue : 'rgba(255,255,255,0.08)' }}
              >
                <ThemedText weight="semiBold" style={{ color: notifTestTab === tab ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  {tab === 'types' ? 'Types' : tab === 'queue' ? 'My Queue' : 'History'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Types tab */}
          {notifTestTab === 'types' && (
            <View style={{ flex: 1 }}>
              {/* Sticky Last Sent Container */}
              {notifLastSent && (() => {
                const isMiss = !notifLastSent.title || !notifLastSent.message;
                const accent = isMiss ? '#f44336' : '#4caf50';
                const bg = isMiss ? 'rgba(244,67,54,0.10)' : 'rgba(76,175,80,0.12)';
                const label = isMiss ? 'NO DATA' : 'SENT';
                return (
                  <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 10, backgroundColor: bg, borderWidth: 1, borderColor: `${accent}55` }}>
                    <ThemedText weight="semiBold" style={{ color: accent, fontSize: 10, marginBottom: 4 }}>{label} · {notifLastSent.type}</ThemedText>
                    {!isMiss && (
                      <>
                        <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 13, marginBottom: 2 }}>{notifLastSent.title}</ThemedText>
                        <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{notifLastSent.message}</ThemedText>
                      </>
                    )}
                    {notifLastSent.debug ? (
                      <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 6 }}>{notifLastSent.debug}</ThemedText>
                    ) : null}
                  </View>
                );
              })()}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
                <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>
                  Tap Send to fire a single notification using your real account data (arrives in ~2 s)
                </ThemedText>
                {/* Day-of-week simulator — affects rotating copy & group/individual prayer */}
                <View style={{ marginBottom: 8 }}>
                  <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 6 }}>
                    SIMULATE DAY · affects rotations &amp; group/individual prayer
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const).map((label, i) => {
                      const isToday = notifSimulatedDay === null && new Date().getDay() === i;
                      const isSelected = notifSimulatedDay === i;
                      return (
                        <TouchableOpacity
                          key={label}
                          onPress={() => setNotifSimulatedDay(isSelected ? null : i)}
                          style={{ flex: 1, paddingVertical: 5, borderRadius: 6, alignItems: 'center', backgroundColor: isSelected ? Colors.anchorBlue : isToday ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }}
                        >
                          <ThemedText weight={isSelected || isToday ? 'semiBold' : 'regular'} style={{ color: isSelected ? '#fff' : isToday ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)', fontSize: 10 }}>{label}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {notifSimulatedDay !== null && (
                    <ThemedText weight="regular" style={{ color: Colors.anchorBlue, fontSize: 10, marginTop: 4 }}>
                      Simulating {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][notifSimulatedDay]} — tap again to clear
                    </ThemedText>
                  )}
                </View>
                {SMART_NOTIFICATION_TYPES.map(type => {
                  const sending = notifSending === type;
                  return (
                    <View key={type} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                      <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, flex: 1, marginRight: 12 }}>
                        {type}
                      </ThemedText>
                      <TouchableOpacity
                        onPress={() => handleSendSingleType(type)}
                        disabled={sending || notifSending !== null}
                        style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: sending ? 'rgba(255,255,255,0.1)' : Colors.anchorBlue, opacity: notifSending !== null && !sending ? 0.4 : 1 }}
                      >
                        {sending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 11 }}>Send</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {/* Billing notifications */}
                <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 16, marginBottom: 4, letterSpacing: 0.5 }}>
                  BILLING
                </ThemedText>
                {(['subscription_renewed', 'payment_failed', 'subscription_cancelled', 'payment_successful'] as const).map(type => {
                  const sending = notifSending === type;
                  return (
                    <View key={type} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                      <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, flex: 1, marginRight: 12 }}>
                        {type}
                      </ThemedText>
                      <TouchableOpacity
                        onPress={() => handleSendBillingType(type)}
                        disabled={sending || notifSending !== null}
                        style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: sending ? 'rgba(255,255,255,0.1)' : '#7c3aed', opacity: notifSending !== null && !sending ? 0.4 : 1 }}
                      >
                        {sending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 11 }}>Send</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Queue tab */}
          {notifTestTab === 'queue' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {notifDataLoading ? (
                <ActivityIndicator color={Colors.anchorBlue} style={{ marginTop: 40 }} />
              ) : notifQueueItems.length === 0 ? (
                <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40 }}>No items in queue</ThemedText>
              ) : notifQueueItems.map(item => (
                <View key={item.id} style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 12, flex: 1 }}>{item.title || '(no title)'}</ThemedText>
                    <ThemedText weight="regular" style={{ color: item.status === 'sent' ? '#4caf50' : item.status === 'failed' ? '#f44336' : Colors.anchorBlue, fontSize: 10 }}>{item.status}</ThemedText>
                  </View>
                  <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>{item.message || '(no message)'}</ThemedText>
                  <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{item.type} · {item.scheduled_for ? new Date(item.scheduled_for).toLocaleString() : '-'}</ThemedText>
                </View>
              ))}
            </ScrollView>
          )}

          {/* History tab */}
          {notifTestTab === 'history' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {notifDataLoading ? (
                <ActivityIndicator color={Colors.anchorBlue} style={{ marginTop: 40 }} />
              ) : notifHistoryItems.length === 0 ? (
                <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40 }}>No history yet</ThemedText>
              ) : notifHistoryItems.map(item => (
                <View key={item.id} style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText weight="semiBold" style={{ color: item.is_read ? 'rgba(255,255,255,0.5)' : '#fff', fontSize: 12, flex: 1 }}>{item.title || '(no title)'}</ThemedText>
                    <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{item.is_read ? 'read' : 'unread'}</ThemedText>
                  </View>
                  <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>{item.message || '(no message)'}</ThemedText>
                  <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{item.type} · {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</ThemedText>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    )}

    {/* Sales Copy Viewer Modal */}
    {salesCopyModalVisible && (
      <Modal
        visible={salesCopyModalVisible}
        onRequestClose={() => setSalesCopyModalVisible(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.anchorBlue }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 16 }}>Sales Copy Scenarios</ThemedText>
            <TouchableOpacity onPress={() => setSalesCopyModalVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 16 }}>
              Tap a scenario to open the actual sales offer screen with those parameters
            </ThemedText>

            {/* Seeker Tier - Monthly Free Access Used Up */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'seeker',
                  testModeRemaining: 0,
                  testModeLimit: 2,
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - Playbooks Used Up (Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'seeker',
                  testModeRemaining: 0,
                  testModeLimit: 2,
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - Playbooks Used Up (Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 0,
                  testModeLimit: 1,
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - Devotionals Used Up (Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 0,
                  testModeLimit: 1,
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - Devotionals Used Up (Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining - Chosen Spark */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 5,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'spark',
                  testModeTrialFullLimit: 10,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining (Chosen Spark)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You've used all 5 playbooks included in your free trial. Your Spark plan starts soon with 10 playbooks each month.</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining - Chosen Growth */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 15,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'growth',
                  testModeTrialFullLimit: 25,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining (Chosen Growth)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You've used all 15 playbooks included in your free trial. Your Growth plan starts soon with 25 playbooks each month.</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining - Chosen Transformation */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 25,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'transformation',
                  testModeTrialFullLimit: 60,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining (Chosen Transformation)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You've used all 25 playbooks included in your free trial. Your Transformation plan starts soon with 60 playbooks each month.</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining Devotionals - Chosen Spark */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 5,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'spark',
                  testModeTrialFullLimit: 10,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining Devotionals (Chosen Spark)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You've used all 5 devotionals included in your free trial. Your Spark plan starts soon with 10 devotionals each month.</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining Devotionals - Chosen Growth */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 15,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'growth',
                  testModeTrialFullLimit: 25,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining Devotionals (Chosen Growth)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You've used all 15 devotionals included in your free trial. Your Growth plan starts soon with 25 devotionals each month.</ThemedText>
            </TouchableOpacity>

            {/* Trial User - No Remaining Devotionals - Chosen Transformation */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 3);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'free_trial',
                  testModeRemaining: 0,
                  testModeLimit: 25,
                  testModeIsOnTrial: true,
                  testModeHasStartedTrial: true,
                  testModeTrialChosenTier: 'transformation',
                  testModeTrialFullLimit: 60,
                  testModeTrialEndDate: futureDate.toISOString(),
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Trial - No Remaining Devotionals (Chosen Transformation)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'free_trial',
                  remaining: 0,
                  limit: 25,
                  isOnTrial: true,
                  trialChosenTier: 'transformation',
                  trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            {/* Paid User - No Remaining */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'spark',
                  testModeRemaining: 0,
                  testModeLimit: 10,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Spark - No Remaining</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'playbooks',
                  currentTier: 'spark',
                  remaining: 0,
                  limit: 10,
                  subscriptionStartDate: new Date().toISOString(),
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'growth',
                  testModeRemaining: 0,
                  testModeLimit: 25,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Growth - No Remaining</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'playbooks',
                  currentTier: 'growth',
                  remaining: 0,
                  limit: 25,
                  subscriptionStartDate: new Date().toISOString(),
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'playbooks',
                  testModeTier: 'transformation',
                  testModeRemaining: 0,
                  testModeLimit: 60,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Transformation - No Remaining</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'playbooks',
                  currentTier: 'transformation',
                  remaining: 0,
                  limit: 60,
                  subscriptionStartDate: new Date().toISOString(),
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            {/* Devotional Duration Locked */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 1,
                  testModeLimit: 1,
                  requestedDuration: 5,
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - 5-Day Devotional Locked (Trial Eligible)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'seeker',
                  remaining: 1,
                  limit: 1,
                  requestedDuration: 5,
                  hasEverStartedTrial: false,
                };
                const copy = generateSalesCopy(params);
                return `${copy.message} Button: ${copy.primaryCta}`;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 1,
                  testModeLimit: 1,
                  requestedDuration: 5,
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - 5-Day Devotional Locked (Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'seeker',
                  remaining: 1,
                  limit: 1,
                  requestedDuration: 5,
                  hasEverStartedTrial: true,
                };
                const copy = generateSalesCopy(params);
                return `${copy.message} Button: ${copy.primaryCta}`;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 1,
                  testModeLimit: 1,
                  requestedDuration: 7,
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - 7-Day Devotional Locked (Trial Eligible)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'seeker',
                  remaining: 1,
                  limit: 1,
                  requestedDuration: 7,
                  hasEverStartedTrial: false,
                };
                const copy = generateSalesCopy(params);
                return `${copy.message} Button: ${copy.primaryCta}`;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'seeker',
                  testModeRemaining: 1,
                  testModeLimit: 1,
                  requestedDuration: 7,
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker - 7-Day Devotional Locked (Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'seeker',
                  remaining: 1,
                  limit: 1,
                  requestedDuration: 7,
                  hasEverStartedTrial: true,
                };
                const copy = generateSalesCopy(params);
                return `${copy.message} Button: ${copy.primaryCta}`;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'spark',
                  testModeRemaining: 5,
                  testModeLimit: 10,
                  requestedDuration: 5,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Spark - 5-Day Devotional Locked</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'spark',
                  remaining: 5,
                  limit: 10,
                  requestedDuration: 5,
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'spark',
                  testModeRemaining: 5,
                  testModeLimit: 10,
                  requestedDuration: 7,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Spark - 7-Day Devotional Locked</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'spark',
                  remaining: 5,
                  limit: 10,
                  requestedDuration: 7,
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: true,
                  featureType: 'devotionals',
                  testModeTier: 'growth',
                  testModeRemaining: 10,
                  testModeLimit: 25,
                  requestedDuration: 7,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Growth - 7-Day Devotional Locked</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{(() => {
                const params: SalesCopyParams = {
                  featureType: 'devotionals',
                  currentTier: 'growth',
                  remaining: 10,
                  limit: 25,
                  requestedDuration: 7,
                };
                const copy = generateSalesCopy(params);
                return copy.message;
              })()}</ThemedText>
            </TouchableOpacity>

            {/* Context-based scenarios */}
            <ThemedText weight="semiBold" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' }}>
              Context-Based Scenarios
            </ThemedText>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'planning_lock',
                  feature: 'future_planning',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Planning Lock (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Gently prepare for what's ahead with guided planning inside your journal. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'planning_lock',
                  feature: 'future_planning',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Planning Lock (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Gently prepare for what's ahead with guided planning inside your journal. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'copy_todos_lock',
                  feature: 'copy_todos',
                  incompleteTodosCount: 5,
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Copy Todos Lock (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Copy 5 incomplete to-dos to future dates, and unlock advanced planning features, playbooks, and devotionals. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'copy_todos_lock',
                  feature: 'copy_todos',
                  incompleteTodosCount: 5,
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Copy Todos Lock (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Copy 5 incomplete to-dos to future dates, and unlock advanced planning features, playbooks, and devotionals. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'pdf_export_restriction',
                  feature: 'export_pdf',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>PDF Export Restriction (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Export your playbooks and devotionals as PDF documents so you can return to them later, print them, or save them for future reflection. PDF export is available with Growth and Transformation. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'pdf_export_restriction',
                  feature: 'export_pdf',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>PDF Export Restriction (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Export your playbooks and devotionals as PDF documents so you can return to them later, print them, or save them for future reflection. PDF export is available with Growth and Transformation. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'repeat_options',
                  feature: 'repeat_options',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Recurring Time Blocks (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Create recurring time blocks to build steady rhythms in your week. With an upgrade, you'll also have more room for playbooks and devotionals. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'repeat_options',
                  feature: 'repeat_options',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Recurring Time Blocks (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Create recurring time blocks to build steady rhythms in your week. With an upgrade, you'll also have more room for playbooks and devotionals. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'calendar_auto_sync',
                  feature: 'calendar_sync',
                  testModeTier: 'spark',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Calendar Auto-Sync (Spark Locked)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Automatically sync your time blocks to your device calendar so what you plan is easier to follow through on. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'calendar_auto_sync',
                  feature: 'calendar_sync',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Calendar Auto-Sync (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Automatically sync your time blocks to your device calendar so what you plan is easier to follow through on. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'calendar_auto_sync',
                  feature: 'calendar_sync',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Calendar Auto-Sync (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Automatically sync your time blocks to your device calendar so what you plan is easier to follow through on. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'guided_prompts_lock',
                  feature: 'guided_prompts',
                  tier: 'seeker',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: true,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Guided Prompts (Seeker - Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Access guided reflection prompts to help you slow down, reflect more deeply, and keep going with clarity. With an upgrade, you'll also unlock more room for playbooks and devotionals. Button: Upgrade to Growth</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                openSalesOfferFromSalesCopy({
                  upgradeMode: false,
                  source: 'guided_prompts_lock',
                  feature: 'guided_prompts',
                  tier: 'seeker',
                  testModeTier: 'seeker',
                  testModeHasEverStartedTrial: false,
                });
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Guided Prompts (Seeker - Not Used Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Access guided reflection prompts to help you slow down, reflect more deeply, and keep going with clarity. With an upgrade, you'll also unlock more room for playbooks and devotionals. Button: Start 3-Day Free Trial</ThemedText>
            </TouchableOpacity>

            {/* Subscription Flow Scenarios */}
            <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 16, marginTop: 24, marginBottom: 12 }}>Subscription Flow Scenarios</ThemedText>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'seeker', testModeStatus: 'active', testModeHasUsedTrial: false });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker (Eligible for Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Free Plan. Button: Continue with siFia</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'seeker', testModeStatus: 'active', testModeHasUsedTrial: true });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Seeker (Not Eligible for Trial)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Free Plan. Button: Continue with siFia</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'spark', testModeStatus: 'active', testModeBillingCycle: 'monthly' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Spark (Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: Upgrade Plan</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'spark', testModeStatus: 'active', testModeBillingCycle: 'annual' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Spark (Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: Upgrade Plan</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'growth', testModeStatus: 'active', testModeBillingCycle: 'monthly' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Growth (Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: Upgrade Plan</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'growth', testModeStatus: 'active', testModeBillingCycle: 'annual' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Growth (Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: Upgrade Plan</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'transformation', testModeStatus: 'active', testModeBillingCycle: 'monthly' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Transformation (Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: Upgrade Plan to Annual</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'transformation', testModeStatus: 'active', testModeBillingCycle: 'annual' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Transformation (Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Active. Button: No button (highest tier)</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'monthly', testModeTrialChosenTier: 'growth' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Growth Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>15 playbooks, 15 devotionals. Secondary: View Other Plans - Transformation monthly</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'annual', testModeTrialChosenTier: 'growth' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Growth Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>15 playbooks, 15 devotionals. Secondary: View Other Plans - Transformation annual</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'monthly', testModeTrialChosenTier: 'spark' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Spark Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>5 playbooks, 5 devotionals. Secondary: View Other Plans - Growth monthly</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'annual', testModeTrialChosenTier: 'spark' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Spark Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>5 playbooks, 5 devotionals. Secondary: View Other Plans - Growth annual</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'monthly', testModeTrialChosenTier: 'transformation' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Transformation Monthly)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>25 playbooks, 25 devotionals. Secondary: View Other Plans - Spark monthly</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }}
              onPress={() => {
                setSalesCopyModalVisible(false);
                setSubscriptionTestMode({ testModeTier: 'free_trial', testModeStatus: 'trialing', testModeBillingCycle: 'annual', testModeTrialChosenTier: 'transformation' });
                setSubscriptionPlanModalVisible(true);
              }}
            >
              <ThemedText weight="semiBold" style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>Free Trial (Transformation Annual)</ThemedText>
              <ThemedText weight="regular" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>25 playbooks, 25 devotionals. Secondary: View Other Plans - Spark annual</ThemedText>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Modal>
    )}

    {/* Subscription Plan Modal */}
    {subscriptionPlanModalVisible && (
      <SubscriptionPlanModal
        visible={subscriptionPlanModalVisible}
        onClose={() => setSubscriptionPlanModalVisible(false)}
        navigation={navigation}
        {...subscriptionTestMode}
      />
    )}

    </SafeAreaView>
  );
};

export default withErrorBoundary(DashboardHomeScreen, 'DashboardHomeScreen');
