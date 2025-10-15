import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { InteractionManager } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService, { LocationPricing } from '../../services/pricingService';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { useTheme } from '../../theme/ThemeContext';
import { getFontFamily } from '../../theme/fonts';

const OnboardingTrialOfferScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { startTrial } = useNewSubscription(user?.id || '');
  const { currentFont } = useTheme();

  const fonts = useMemo(() => {
    const fontKey = currentFont || 'lexend';
    return {
      regular: getFontFamily(fontKey, 'regular'),
      medium: getFontFamily(fontKey, 'medium'),
      semiBold: getFontFamily(fontKey, 'semiBold'),
      bold: getFontFamily(fontKey, 'bold'),
    };
  }, [currentFont]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  // Read selection from params; default to annual
  const initialTierId: string = route?.params?.selectedTierId || 'growth';
  const initialBilling: 'annual' | 'monthly' = route?.params?.billing || 'annual';
  const [selectedTierId, _setSelectedTierId] = useState<string>(initialTierId);
  const [isAnnual, setIsAnnual] = useState(initialBilling === 'annual');
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const navigationInProgressRef = React.useRef(false);

  const handleClose = async () => {
    if (isClosing || isStartingTrial || navigationInProgressRef.current) {
      console.log('[OnboardingTrialOffer] handleClose ignored', { isClosing, isStartingTrial, navigationInProgress: navigationInProgressRef.current });
      return; // Prevent double-tap and multiple navigation calls
    }
    
    navigationInProgressRef.current = true;

    try {
      triggerLightHaptic();
    } catch {}
    setIsClosing(true);

    // Debug context dump
    const navState = (navigation as any)?.getState?.();
    console.log('[OnboardingTrialOffer] User declined trial – beginning close sequence', {
      skipNotificationPreference: route?.params?.skipNotificationPreference,
      selectedTierId,
      isAnnual,
      navRoutes: navState?.routes?.map((r: any) => r.name),
      navIndex: navState?.index,
    });

    // Watchdog: if navigation does not complete, release UI lock and notify
    let watchdogFired = false;
    const watchdog = setTimeout(() => {
      watchdogFired = true;
      console.warn('[OnboardingTrialOffer] Watchdog fired – navigation did not complete in time. Releasing UI lock.');
      setIsClosing(false);
      Alert.alert(
        'Please try again',
        'We could not proceed to notification setup. Tap close again or try Continue My Journey.',
        [{ text: 'OK' }]
      );
    }, 1500);

    const proceed = () => {
      try {
        const skipNotificationPreference = route?.params?.skipNotificationPreference;
        if (skipNotificationPreference) {
          console.log('[OnboardingTrialOffer] Skip pref set – performing double goBack()');
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 100);
        } else {
          // Pass canonical user type plus display label
          console.log('[OnboardingTrialOffer] Navigating to OnboardingNotificationSetup', { userType: 'freemium', display: 'seeker' });
          navigation.navigate(
            'OnboardingNotificationSetup' as never,
            { userType: 'freemium', displayName: 'siFia Seeker' } as never
          );
        }
      } catch (error) {
        console.error('[OnboardingTrialOffer] Navigation failed:', error);
        setIsClosing(false);
        navigationInProgressRef.current = false;
      } finally {
        // Release lock shortly after initiating navigation unless watchdog already handled
        setTimeout(() => {
          if (!watchdogFired) {
            setIsClosing(false);
            navigationInProgressRef.current = false;
            clearTimeout(watchdog);
          }
        }, 200);
      }
    };

    // Schedule after current animations/interactions to avoid conflicts
    InteractionManager.runAfterInteractions(() => {
      console.log('[OnboardingTrialOffer] runAfterInteractions – proceeding to navigate');
      // Small delay to allow overlay to animate out (slide down) before new screen
      setTimeout(proceed, 120);
    });
  };

  const handleStartTrial = async () => {
    if (isStartingTrial || isClosing) {return;} // Prevent double-tap

    try {
      triggerLightHaptic();
      setIsStartingTrial(true);
    } catch {}

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('[OnboardingTrialOffer] Starting trial subscription with Apple', {
        tier: selectedTierId,
        billing: isAnnual ? 'annual' : 'monthly',
      });

      // CRITICAL: Trial Offer Screen uses .freetrial product IDs
      // These are separate products in App Store Connect with 3-day free trial configured
      const { PlatformPaymentService } = await import('../../services/PlatformPaymentService');
      const paymentService = PlatformPaymentService.getInstance();

      // Use the .freetrial product ID - this matches what's in App Store Connect
      const billing = isAnnual ? 'annual' : 'monthly';
      const productId = `app.sifia.com.${selectedTierId}.${billing}.freetrial`;

      console.log('[OnboardingTrialOffer] Purchasing TRIAL subscription:', productId);
      console.log('[OnboardingTrialOffer] This product has 3-day free trial configured in App Store Connect');

      // Show Apple's payment sheet - will show "Free for 3 days, then $X.XX"
      const result = await paymentService.purchaseSubscription(productId, user.id);

      if (result.success) {
        console.log('[OnboardingTrialOffer] ✅ Trial subscription authorized by Apple');
        triggerSuccessHaptic();

        // The purchase listener will update the database to free_trial status
        // Wait a moment for it to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Navigate to notification setup
        const skipNotificationPreference = route?.params?.skipNotificationPreference;
        if (skipNotificationPreference) {
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 100);
        } else {
          navigation.navigate('OnboardingNotificationSetup' as never, { userType: 'trial' } as never);
        }
      } else {
        throw new Error(result.error || 'Trial subscription failed');
      }
    } catch (error: any) {
      console.error('[OnboardingTrialOffer] Error starting trial:', error);
      setIsStartingTrial(false);

      // Check if user cancelled
      const isCancelled =
        error?.message === 'USER_CANCELLED' ||
        error?.code === 'USER_CANCELLED' ||
        error?.message?.toLowerCase().includes('cancel');

      if (isCancelled) {
        console.log('[OnboardingTrialOffer] User cancelled trial - continuing as free user');
        // Navigate to notification setup (user remains as Seeker/free)
        const skipNotificationPreference = route?.params?.skipNotificationPreference;
        if (skipNotificationPreference) {
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 100);
        } else {
          navigation.navigate('OnboardingNotificationSetup' as never, { userType: 'freemium' } as never);
        }
        return;
      }

      // Show user-friendly error message
      const errorMessage = error?.message || 'Unable to start trial';

      Alert.alert(
        'Trial Unavailable',
        errorMessage,
        [
          {
            text: 'Continue as Free User',
            onPress: () => {
              const skipNotificationPreference = route?.params?.skipNotificationPreference;
              if (skipNotificationPreference) {
                navigation.goBack();
                setTimeout(() => navigation.goBack(), 100);
              } else {
                navigation.navigate('OnboardingNotificationSetup' as never, { userType: 'freemium' } as never);
              }
            },
          },
          { text: 'Try Again', style: 'cancel' },
        ]
      );
    }
  };

  const getTierDisplayName = (tierName: string) => {
    switch (tierName) {
      case 'seeker':
      case 'basic': return 'siFia Seeker';
      case 'spark':
      case 'starter': return 'siFia Spark';
      case 'growth': return 'siFia Growth';
      case 'transformation': return 'siFia Transformation';
      case 'family': return 'siFia Family';
      default: return tierName;
    }
  };

  // Safety check: Wait for user to load on hot reload instead of redirecting
  // Redirecting causes black screen during hot reload
  useEffect(() => {
    if (!user?.id) {
      console.warn('[OnboardingTrialOffer] No user found, waiting for auth to load...');
      // Don't redirect - just wait for auth context to initialize
      return;
    }
    console.log('[OnboardingTrialOffer] User loaded:', user.id);
  }, [user?.id]);

  // Load pricing and currency for dynamic copy
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tiers, currency] = await Promise.all([
          pricingService.getLocationAdjustedPricing(),
          pricingService.getCurrencyInfo(),
        ]);
        console.log('[OnboardingTrialOffer] Currency info loaded:', currency);
        console.log('[OnboardingTrialOffer] Sample tier prices:', tiers[0] ? {
          tier: tiers[0].id,
          monthly: tiers[0].monthlyPrice,
          annual: tiers[0].annualPrice,
          symbol: currency.symbol,
        } : 'No tiers');
        if (mounted) {
          setPricingTiers(tiers || []);
          setCurrencyInfo(currency || null);
        }
      } catch (e) {
        console.error('[OnboardingTrialOffer] Failed to load pricing:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getSelectedTier = () => pricingTiers.find((t: any) => t.id === selectedTierId) || pricingTiers.find((t: any) => t.id === 'growth');
  const getCurrentPrice = () => {
    const t = getSelectedTier();
    if (!t) {return 0;}
    return isAnnual ? t.annualPrice : t.monthlyPrice;
  };
  const getMonthlyEquivalent = () => {
    const t = getSelectedTier();
    if (!t) {return 0;}
    return (t.annualPrice / 12);
  };

  // Removed duplicate handleStartTrial function

  // Helpers for local date computations
  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };
  const formatMD = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const today = new Date();
  const reminderDate = addDays(today, 1); // remind one day before end
  const endDate = addDays(today, 2); // 3-day trial counts start day, so +2

  const timelineItems = [
    {
      id: 1,
      title: 'Today - Free trial starts',
      description: 'Try siFia Growth Plan free for 3 days.\nNo pressure, no catch.\nExperience personalized guidance and see how it fits your story.',
      icon: 'checkmark-circle',
      iconColor: Colors.growthGreen,
      isCompleted: true,
    },
    {
      id: 2,
      title: `${formatMD(reminderDate)} - Email Reminder`,
      description: 'We\'ll remind you before your trial ends, \nso you can decide with peace.',
      icon: 'mail',
      iconColor: Colors.alertCoral,
      isCompleted: false,
    },
    {
      id: 3,
      title: `${formatMD(endDate)} - Continue Your Journey`,
      description: 'Your trial ends unless cancelled.',
      icon: 'heart',
      iconColor: Colors.alertCoral,
      isCompleted: false,
    },
  ];

  const renderTimelineItem = (item: any, index: number) => {
    const isLast = index === timelineItems.length - 1;

    return (
      <View key={item.id} style={styles.timelineItem}>
        <View style={styles.timelineIconContainer}>
          <View style={[styles.timelineIcon, { backgroundColor: item.iconColor }]}>
            <Ionicons name={item.icon} size={20} color={Colors.hopeWhite} />
          </View>
          {!isLast && (
            <View style={styles.timelineLineTrack}>
              {index === 0 ? <View style={styles.timelineLineFill} /> : null}
            </View>
          )}
        </View>

        <View style={styles.timelineContent}>
          <ThemedText weight="semiBold" style={styles.timelineTitle}>{item.title}</ThemedText>
          {item.id === 1 ? (
            <ThemedText style={styles.timelineDescription}>
              Try <ThemedText weight="bold" style={styles.strong}>{`${getTierDisplayName(selectedTierId)} PLAN`}</ThemedText> free for 3 days{'\n'}
              No pressure, no catch.{'\n'}
              Experience personalized guidance and see how it fits your story.
            </ThemedText>
          ) : (
            <ThemedText style={styles.timelineDescription}>{item.description}</ThemedText>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.closeButton, (isClosing || isStartingTrial) && { opacity: 0.6 }]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={isClosing || isStartingTrial}
        >
          <Ionicons name="close" size={22} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <ThemedText weight="bold" style={styles.headerMainTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
            You've taken your first step!
          </ThemedText>
          <ThemedText style={styles.headerSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
            Keep walking, one faithful step at a time.
          </ThemedText>
        </View>
      </View>

      <View style={styles.scrollContainer}>
        {/* Main Content */}
        <View style={styles.contentWrap}>
          {/* Spacer below header */}
          <View style={styles.spacerHeight} />

          {/* Intro Text */}
          <View style={styles.introSection}>
            <ThemedText weight="semiBold" style={styles.introTitle}>Not sure yet?</ThemedText>
            <ThemedText style={styles.introText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.92}>
              That's okay. Starting something new can feel uncertain.
            </ThemedText>
          </View>

          {/* How Trial Works */}
          <ThemedText weight="semiBold" style={styles.sectionTitle}>So, how the trial works:</ThemedText>

          {/* Plan Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, !isAnnual && styles.activeToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(false);
              }}
              activeOpacity={0.9}
            >
              <ThemedText weight={!isAnnual ? 'semiBold' : 'medium'} style={[styles.toggleText, !isAnnual && styles.activeToggleText]}>Monthly</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, isAnnual && styles.activeToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(true);
              }}
              activeOpacity={0.9}
            >
              <ThemedText weight={isAnnual ? 'semiBold' : 'medium'} style={[styles.toggleText, isAnnual && styles.activeToggleText]}>Annual</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Timeline */}
          <View style={styles.timelineContainer}>
            {timelineItems.map((item, index) => renderTimelineItem(item, index))}
          </View>

          {/* Pricing Summary (dynamic) */}
          <View style={styles.pricingSummary}>
            {/* Rounded divider with floating centered tag */}
            <View style={styles.dividerWrapper}>
              <View style={styles.dividerLine} />
              <View style={styles.planTagFloating}>
                <ThemedText weight="bold" style={styles.planTagText}>
                  {`${getTierDisplayName(selectedTierId)} PLAN`}
                </ThemedText>
              </View>
            </View>
            <ThemedText weight="bold" style={styles.pricingTitle}>
              {`3 days free, then ${(currencyInfo?.symbol || '$')}${getCurrentPrice().toFixed(2)} per ${isAnnual ? 'year' : 'month'}`}
            </ThemedText>
            {isAnnual ? (
              <ThemedText weight="bold" style={styles.pricingSubtitle}>
                {`Only ${(currencyInfo?.symbol || '$')}${getMonthlyEquivalent().toFixed(2)}/month`}
              </ThemedText>
            ) : null}
          </View>
        </View>

        {/* CTA and Footer */}
        <View style={styles.footerBlock}>
          <TouchableOpacity
            style={[styles.startTrialButton, (isStartingTrial || isClosing) && { opacity: 0.6 }]}
            onPress={handleStartTrial}
            activeOpacity={0.9}
            disabled={isStartingTrial || isClosing}
          >
            <ThemedText weight="bold" style={styles.startTrialButtonText}>
              {isStartingTrial ? 'Starting Trial...' : 'Start your free 3‑day trial'}
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.footerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
            Try 3 days free. No pressure. Cancel anytime
          </ThemedText>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTextBlock: {
    alignItems: 'flex-start',
    width: '100%',
    paddingRight: 56, // leave room for close button
    paddingLeft: 0,
    maxWidth: '100%',
    gap: 2,
    alignSelf: 'stretch',
  },
  headerMainTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'left',
    lineHeight: 26,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.88,
    marginTop: 0,
    lineHeight: 22,
    letterSpacing: 0.15,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    top: 0,
    zIndex: 2,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 56,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
  },
  introSection: {
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 6,
  },
  introText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    lineHeight: 22,
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 24,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 16,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: Colors.growthGreen,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: Colors.hopeWhite,
  },
  activeToggleText: {
    color: Colors.hopeWhite,
    fontFamily: fonts.semiBold,
  },
  timelineContainer: {
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 40,
  },
  timelineLineTrack: {
    width: 6,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    overflow: 'hidden',
    minHeight: 40,
  },
  timelineLineFill: {
    flex: 1,
    backgroundColor: Colors.growthGreen,
    borderRadius: 999,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    lineHeight: 18,
    opacity: 0.9,
  },
  strong: {
    fontFamily: fonts.bold,
  },
  pricingSummary: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
  },
  dividerWrapper: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  dividerLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
  },
  planTagFloating: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#35537F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pricingTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 6,
  },
  pricingSubtitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  planTag: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  planTagText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
    textTransform: 'none',
  },
  contentWrap: {
    flexShrink: 1,
    paddingBottom: 8,
  },
  startTrialButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  footerBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  startTrialButtonText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 0,
  },
  spacerHeight: {
    height: 4,
  },
});

export default OnboardingTrialOfferScreen;
