import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService, { LocationPricing } from '../../services/pricingService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { useTheme } from '../../theme/ThemeContext';
import { PurchaseSuccessModal } from '../../components/PurchaseSuccessModal';
import { PurchaseLoadingModal } from '../../components/PurchaseLoadingModal';
import { PurchaseErrorModal } from '../../components/PurchaseErrorModal';
import { getFontFamily } from '../../theme/fonts';
import PlatformPaymentService from '../../services/PlatformPaymentService';
import { logger } from '../../utils/logger';

const OnboardingTrialOfferScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [isClosing, setIsClosing] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const navigationInProgressRef = React.useRef(false);

  const handleClose = async () => {
    if (isClosing || isStartingTrial || navigationInProgressRef.current) {
      logger.debug('handleClose ignored - already processing');
      return;
    }

    logger.info('User cancelled trial offer - navigating to notification setup');
    navigationInProgressRef.current = true;

    try {
      triggerLightHaptic();
    } catch {}

    // Always go to notification setup for cancelled trial - this is the expected flow
    const skipNotificationPreference = route?.params?.skipNotificationPreference;
    if (skipNotificationPreference) {
      // If skip pref set, go back to sales offer (they can try again or go back further)
      logger.info('Skip notifications set - going back to sales offer');
      navigation.goBack();
    } else {
      // Navigate to notification setup for cancelled trial users
      logger.info('Navigating cancelled trial user to notification setup');
      (navigation as any).navigate('OnboardingNotificationSetup', {
        userType: 'freemium',
        fromCancelledTrial: true
      });
    }

    // Set isClosing AFTER navigation to avoid blocking the navigation
    setIsClosing(true);

    // Reset state after navigation
    setTimeout(() => {
      navigationInProgressRef.current = false;
      setIsClosing(false);
    }, 1000);
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

      logger.debug('Starting trial subscription with Apple', {
        tier: selectedTierId,
        billing: isAnnual ? 'annual' : 'monthly',
      });

      // CRITICAL: Trial Offer Screen uses .freetrial product IDs
      // These are separate products in App Store Connect with 3-day free trial configured
      const paymentService = PlatformPaymentService.getInstance();

      // Use the .freetrial product ID - this matches what's in App Store Connect
      const billing = isAnnual ? 'annual' : 'monthly';
      let productId = `app.sifia.com.${selectedTierId}.${billing}.freetrial`;

      logger.debug('========================================');
      logger.debug('TRIAL PRODUCT VERIFICATION');
      logger.debug('Target product ID', { productId });
      logger.debug('========================================');

      // CRITICAL: Verify the .freetrial product exists in App Store Connect
      // Even if configured, it might not be synced to TestFlight yet
      try {
        const availableProducts = await paymentService.getAvailableProducts();

        logger.debug('📦 ALL AVAILABLE PRODUCTS FROM APP STORE', {});
        availableProducts.forEach((p, index) => {
          console.log(`[OnboardingTrialOffer] ${index + 1}. ${p.productId}`);
          console.log(`[OnboardingTrialOffer]    Price: ${p.localizedPrice}`);
          console.log(`[OnboardingTrialOffer]    Title: ${p.title}`);
        });
        logger.debug('========================================');

        const trialProduct = availableProducts.find(p => p.productId === productId);

        if (!trialProduct) {
          logger.warn('⚠️ .freetrial product NOT found in App Store!');
          logger.warn('Expected product', { productId });
          logger.warn('POSSIBLE CAUSES:');
          logger.warn('1. Product ID mismatch - check App Store Connect');
          logger.warn('2. Trial offer not approved yet');
          logger.warn('3. TestFlight build needs to be refreshed');
          logger.warn('4. Cleared for sale = NO in App Store Connect');

          // CRITICAL FIX: Don't fallback to regular products for trial screen
          // This prevents immediate charging instead of free trial
          logger.error('❌ Trial product not found - cannot offer free trial');
          logger.error('User should see error message instead of being charged');
          throw new Error(`Free trial not available. Please contact support or try again later.`);
        } else {
          logger.info('✅✅✅ TRIAL PRODUCT FOUND!');
          logger.debug('Product ID', { productId: trialProduct.productId });
          logger.debug('Price', { price: trialProduct.localizedPrice });
          logger.debug('Title', { title: trialProduct.title });
          logger.debug('User will see trial message', { price: trialProduct.localizedPrice });
        }
      } catch (productError) {
        logger.error('❌ Failed to verify products', productError as Error);
        logger.error('Cannot determine if trial product exists - blocking trial to prevent charging');
        throw new Error(`Unable to verify trial availability. Please try again later or contact support.`);
      }

      logger.debug('Final product ID', { productId });
      logger.debug('Showing Apple payment sheet', {});

      // ENTERPRISE IMPROVEMENT: Show loading modal
      setLoadingStep('processing');

      // Show Apple's payment sheet - will show "Free for 3 days, then $X.XX" if trial product
      const result = await paymentService.purchaseSubscription(productId, user.id);

      // Update loading step
      setLoadingStep('validating');

      if (result.success) {
        logger.info('✅ Trial subscription authorized by Apple');
        triggerSuccessHaptic();

        // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
        if (!result.transactionId) {
          logger.error('❌ Purchase missing transaction ID - possible stale state');
          throw new Error('Invalid purchase - no transaction ID');
        }

        // Additional verification: Check if transaction ID is recent (within last 5 minutes)
        // This prevents old cached transactions from activating subscriptions
        const transactionTime = Date.now();
        const fiveMinutesAgo = transactionTime - (5 * 60 * 1000);

        logger.debug('Transaction verification:', {
          hasTransactionId: !!result.transactionId,
          transactionId: result.transactionId?.substring(0, 10) + '...', // Log partial ID for debugging
        });

        // ENTERPRISE IMPROVEMENT: Update loading steps
        setLoadingStep('activating');

        // Sync subscription
        logger.debug('Syncing subscription status', {});
        try {
          const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
          const storeKitService = AppleStoreKitService.getInstance();
          await storeKitService.checkAndSyncSubscriptionStatus(user.id);
          logger.info('✅ Subscription synced');
        } catch (syncError) {
          logger.error('Subscription sync failed', syncError as Error);
        }

        // Final step
        setLoadingStep('completing');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Show success modal
        setPurchaseValidated(true); // Always show as validated for successful purchases
        setIsStartingTrial(false);
        setShowSuccessModal(true);
      } else {
        throw new Error(result.error || 'Trial subscription failed');
      }
    } catch (error: any) {
      logger.error('Error starting trial:', error);
      setIsStartingTrial(false);

      // ENTERPRISE IMPROVEMENT: Classify error and show appropriate modal
      const isCancelled =
        error?.message === 'USER_CANCELLED' ||
        error?.code === 'USER_CANCELLED' ||
        error?.message?.toLowerCase().includes('cancel') ||
        error?.message?.toLowerCase().includes('timeout');

      if (isCancelled) {
        logger.debug('User cancelled trial');
        // CRITICAL: Reset ALL purchase state to prevent stale/cached validation
        setIsStartingTrial(false);
        setPurchaseValidated(false);
        setShowSuccessModal(false);
        setLoadingStep('processing');
        return;
      }

      // For other errors, just log them silently instead of showing error modal
      logger.error('Purchase error (silent):', error?.message || 'Unknown error');
      setIsStartingTrial(false);
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
      logger.warn('No user found, waiting for auth to load...');
      // Don't redirect - just wait for auth context to initialize
      return;
    }
    logger.debug('User loaded', { userId: user.id });
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
        logger.debug('Currency info loaded', { currency });
        logger.debug('Sample tier prices', tiers[0] ? {
          tier: tiers[0].id,
          monthly: tiers[0].monthlyPrice,
          annual: tiers[0].annualPrice,
          symbol: currency.symbol,
        } : { status: 'No tiers' });
        if (mounted) {
          setPricingTiers(tiers || []);
          setCurrencyInfo(currency || null);
        }
      } catch (e) {
        logger.error('Failed to load pricing', e as Error);
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
      description: 'Try siFia Growth Plan free for 3 days.\nNo pressure, no catch.\nExperience personalized guidance and see how it fits your story.\n\nTry with 2 playbooks + 2 devotionals during trial.',
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
              Experience personalized guidance and see how it fits your story.{'\n\n'}
              <ThemedText weight="semiBold" style={styles.includedText}>
                Try with 2 playbooks + 2 devotionals during trial
              </ThemedText>
            </ThemedText>
          ) : (
            <ThemedText style={styles.timelineDescription}>{item.description}</ThemedText>
          )}
        </View>
      </View>
    );
  };

  // ENTERPRISE IMPROVEMENT: Simple navigation wrapper without complex guards
  const safeNavigate = useCallback((action: () => void, actionName: string) => {
    try {
      action();
      logger.info('Navigation action completed', { actionName });
    } catch (error) {
      logger.error('Navigation action failed', error as Error, { actionName });
      // Fallback to basic navigation
      try {
        navigation.goBack();
      } catch (fallbackError) {
        logger.error('Fallback navigation also failed', fallbackError as Error);
      }
    }
  }, [navigation]);

  // ENTERPRISE IMPROVEMENT: Enhanced success modal continue handler
  const handleSuccessModalContinue = useCallback(() => {
    setShowSuccessModal(false);

    // Use a more reliable navigation approach
    const skipNotificationPreference = route?.params?.skipNotificationPreference;

    logger.info('Success modal continue pressed', {
      skipNotificationPreference,
      navigationState: 'success_modal_complete'
    });

    // Small delay to ensure modal is fully hidden
    setTimeout(() => {
      if (skipNotificationPreference) {
        logger.info('Skipping notifications - going back to sales offer');
        safeNavigate(() => navigation.goBack(), 'go_back_to_sales');
      } else {
        logger.info('Navigating to notification setup for trial user');
        // Navigate to notification setup - use replace to avoid stack issues
        safeNavigate(() => {
          (navigation as any).replace('OnboardingNotificationSetup', {
            userType: 'trial',
            fromTrial: true,
            navigationGuarded: true
          });
        }, 'navigate_to_notification');
      }
    }, 100);
  }, [route?.params?.skipNotificationPreference, navigation, safeNavigate]);

  // Error handling is now done silently without modals

  return (
    <SafeAreaView style={styles.container}>
      {/* ENTERPRISE IMPROVEMENT: Loading Modal */}
      <PurchaseLoadingModal
        visible={isStartingTrial && !showSuccessModal}
        step={loadingStep}
      />

      {/* ENTERPRISE IMPROVEMENT: Success Modal */}
      <PurchaseSuccessModal
        visible={showSuccessModal}
        tier="free_trial"
        isTrial={true}
        isValidated={purchaseValidated}
        onContinue={handleSuccessModalContinue}
      />

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

            {/* Plan Selector - Change Plan Button */}
            <TouchableOpacity
              style={styles.changePlanButton}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setShowPlanSelector(!showPlanSelector);
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="medium" style={styles.changePlanButtonText}>
                Change Plan
              </ThemedText>
            </TouchableOpacity>

            {/* Plan Options - Show when button tapped */}
            {showPlanSelector && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.planOptionsScrollContent}
                style={styles.planOptionsScroll}
              >
                {pricingTiers.map((tier) => (
                  <TouchableOpacity
                    key={tier.id}
                    style={[
                      styles.planOptionExpanded,
                      selectedTierId === tier.id && styles.selectedPlanOptionExpanded,
                    ]}
                    onPress={() => {
                      try { triggerLightHaptic(); } catch {}
                      _setSelectedTierId(tier.id);
                      setShowPlanSelector(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planOptionContent}>
                      <ThemedText
                        weight={selectedTierId === tier.id ? 'bold' : 'semiBold'}
                        style={[
                          styles.planOptionTextExpanded,
                          selectedTierId === tier.id && styles.selectedPlanOptionTextExpanded,
                        ]}
                      >
                        {getTierDisplayName(tier.id)}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.planOptionPriceExpanded,
                          selectedTierId === tier.id && styles.selectedPlanOptionPriceExpanded,
                        ]}
                      >
                        {isAnnual ? `$${(tier.annualPrice || 0).toFixed(2)}/yr` : `$${(tier.monthlyPrice || 0).toFixed(2)}/mo`}
                      </ThemedText>
                    </View>
                    {selectedTierId === tier.id && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
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
  changePlanButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  changePlanButtonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: Colors.faithGold,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  planOptionsScroll: {
    marginTop: 12,
    marginBottom: 20,
  },
  planOptionsScrollContent: {
    paddingHorizontal: 8,
    gap: 12,
  },
  planOptionExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 160,
    marginRight: 8,
  },
  selectedPlanOptionExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: Colors.growthGreen,
  },
  planOptionContent: {
    flex: 1,
  },
  planOptionTextExpanded: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  selectedPlanOptionTextExpanded: {
    color: Colors.hopeWhite,
  },
  planOptionPriceExpanded: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  selectedPlanOptionPriceExpanded: {
    color: Colors.hopeWhite,
    opacity: 1,
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
  simpleWhatsIncluded: {
    alignItems: 'center',
    marginBottom: 16,
  },
  simpleWhatsIncludedText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.95,
  },
  whatsIncludedSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  whatsIncludedTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
  },
  benefitsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  benefitItem: {
    alignItems: 'center',
    flex: 1,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 2,
  },
  benefitSubtext: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
  },
  benefitDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
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
  includedText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginTop: 8,
    opacity: 0.85,
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
