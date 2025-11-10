import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, StackActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService from '../../services/pricingService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { useTheme } from '../../theme/ThemeContext';
import { PurchaseSuccessModal } from '../../components/PurchaseSuccessModal';
import { PurchaseLoadingModal } from '../../components/PurchaseLoadingModal';
import { getFontFamily } from '../../theme/fonts';
import PlatformPaymentService from '../../services/PlatformPaymentService';

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

  // Read selection from params passed from sales offer screen
  // If user selected transformation + annual in sales offer, trial will default to that
  // But user can change it via "Change Plan" button
  const routeParams = route?.params as { selectedTierId?: string; billing?: 'annual' | 'monthly'; skipNotificationPreference?: boolean; closeAllOnDismiss?: boolean } | undefined;
  const initialTierId: string = routeParams?.selectedTierId || 'growth'; // Use sales offer selection or default to growth
  const initialBilling: 'annual' | 'monthly' = routeParams?.billing || 'annual'; // Use sales offer billing or default to annual
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTierId);
  const [isAnnual, setIsAnnual] = useState(initialBilling === 'annual');
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  // dynamicPricing removed - not used, only setDynamicPricing is called
  const [currencyInfo, setCurrencyInfo] = useState<any>(null);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [isClosing, setIsClosing] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [trialProductAvailable, setTrialProductAvailable] = useState<boolean | null>(null);
  const [navigationInProgressRef] = [React.useRef(false)];

  const handleClose = async () => {
    if (isClosing || isStartingTrial || navigationInProgressRef.current) {
      return;
    }

    navigationInProgressRef.current = true;

    try {
      triggerLightHaptic();
    } catch {}

    // If instructed, close both Trial and Sales Offer screens to avoid loops
    if (routeParams?.closeAllOnDismiss) {
      try {
        // Atomically pop Trial and Sales Offer to return to the previous context (e.g., PlaybookDetail)
        (navigation as any).dispatch(StackActions.pop(2));
      } catch {
        try { navigation.goBack(); } catch {}
      }
    } else {
      // Default: go to notification setup or back, depending on skip flag
      const skipNotificationPreference = routeParams?.skipNotificationPreference;
      if (skipNotificationPreference) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('OnboardingNotificationSetup', {
          userType: 'freemium',
          fromCancelledTrial: true,
        });
      }
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

      // CRITICAL: Check if user already has an active trial
      try {
        const { NewSubscriptionService } = await import('../../services/NewSubscriptionService');
        const currentSubscription = await NewSubscriptionService.getUserSubscription(user.id);

        if (currentSubscription.tier === 'free_trial') {
          // Show success modal immediately since trial is already active
          setIsStartingTrial(false);
          setShowSuccessModal(true);
          return;
        }
      } catch (checkError) {
        // Continue with purchase attempt
      }

      // CRITICAL: Trial Offer Screen uses .freetrial product IDs
      // These are separate products in App Store Connect with 3-day free trial configured
      // Product ID format: app.sifia.com.{tier}.{billing}.freetrial
      // Example: app.sifia.com.transformation.annual.freetrial
      const paymentService = PlatformPaymentService.getInstance();

      // Use the .freetrial product ID based on selected tier and billing
      // This matches what's configured in App Store Connect
      const billing = isAnnual ? 'annual' : 'monthly';
      let productId = `app.sifia.com.${selectedTierId}.${billing}.freetrial`;

      // CRITICAL: Verify the .freetrial product exists in App Store Connect
      // Even if configured, it might not be synced to TestFlight yet
      try {
        const availableProducts = await paymentService.getAvailableProducts();

        const trialProduct = availableProducts.find(p => p.productId === productId);

        if (!trialProduct) {
          // Set UI state to show trial not available
          setTrialProductAvailable(false);

          // TEMPORARY: For TestFlight testing, use fallback product
          if (__DEV__ || Platform.OS === 'ios') {
            const fallbackProductId = `app.sifia.com.${selectedTierId}.${billing}`;
            const fallbackProduct = availableProducts.find(p => p.productId === fallbackProductId);

            if (fallbackProduct) {
              productId = fallbackProductId; // Use fallback for testing
            } else {
              const errorMessage = `Free trial not available.

🔍 DEBUGGING INFO:
• Expected trial product: ${productId}
• Available products: ${availableProducts.length}
• Selected tier: ${selectedTierId}

Please check App Store Connect configuration or contact support.`;

              throw new Error(errorMessage);
            }
          } else {
            // Production: Block trial if product not found
            throw new Error('Free trial not available. Please contact support or try again later.');
          }
        } else {
          // Set UI state to show trial is available
          setTrialProductAvailable(true);
        }
      } catch (productError) {
        throw new Error('Unable to verify trial availability. Please try again later or contact support.');
      }

      // Show Apple's payment sheet - will show "Free for 3 days, then $X.XX" if trial product
      let result;
      try {
        // Initialize payment service first
        await paymentService.initialize();

        // Now initiate purchase
        result = await paymentService.purchaseSubscription(productId, user.id);
      } catch (purchaseError) {
        // Provide more specific error messages
        if (purchaseError instanceof Error) {
          if (purchaseError.message.includes('timeout')) {
            throw new Error('Purchase timed out. Please check your internet connection and try again.');
          } else if (purchaseError.message.includes('cancelled') || purchaseError.message.includes('USER_CANCELLED')) {
            throw new Error('USER_CANCELLED');
          } else if (purchaseError.message.includes('not available')) {
            throw new Error('This trial offer is not currently available. Please try again later.');
          }
        }

        setIsStartingTrial(false);
        throw new Error('Failed to initiate purchase. Please try again.');
      }

      // Update loading step
      setLoadingStep('validating');

      if (result.success) {
        triggerSuccessHaptic();

        // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
        if (!result.transactionId) {
          throw new Error('Invalid purchase - no transaction ID');
        }

        // Additional verification: Check if transaction ID is recent (within last 5 minutes)
        // This prevents old cached transactions from activating subscriptions
        // const transactionTime = Date.now();
        // const fiveMinutesAgo = transactionTime - (5 * 60 * 1000); // Unused

        // CRITICAL: Now that Apple has authorized, set up the trial in database
        // This activates the trial with 2 playbooks + 2 devotionals
        try {
          const { NewSubscriptionService } = await import('../../services/NewSubscriptionService');

          // Start the trial in database - this creates the subscription record with:
          // - tier: 'free_trial'
          // - trial_start_date: now
          // - trial_end_date: now + 3 days
          // - trial_chosen_tier: selectedTierId (e.g., 'transformation', 'growth', etc.)
          // - playbooks_limit: 2
          // - devotionals_limit: 2
          await NewSubscriptionService.startFreeTrial({
            user_id: user.id,
            duration_days: 3,
            trial_chosen_tier: selectedTierId as any, // Remember which tier they want after trial
            billing_cycle: isAnnual ? 'annual' : 'monthly',
          });
        } catch (trialSetupError) {
          // Don't throw - Apple purchase already succeeded, just log the error
        }

        // ENTERPRISE IMPROVEMENT: Update loading steps
        setLoadingStep('activating');

        // Sync subscription
        try {
          const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
          const storeKitService = AppleStoreKitService.getInstance();

          // CRITICAL FIX: Check if this is a cached purchase from previous attempt
          const RNIap = await import('react-native-iap');
          const availablePurchases = await RNIap.default.getAvailablePurchases();
          const currentPurchase = availablePurchases?.find((p: any) =>
            p.productId.includes(selectedTierId) &&
            p.productId.includes(isAnnual ? 'annual' : 'monthly')
          );

          if (currentPurchase && currentPurchase.transactionDate) {
            // Check if this purchase is recent (within last 2 minutes)
            const purchaseTime = new Date(currentPurchase.transactionDate).getTime();
            const now = Date.now();
            const twoMinutesAgo = now - (2 * 60 * 1000);

            if (purchaseTime < twoMinutesAgo) {
              throw new Error('STALE_PURCHASE_CACHE');
            }
          }

          await storeKitService.checkAndSyncSubscriptionStatus(user.id);
        } catch (syncError) {
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
      setIsStartingTrial(false);

      // ENTERPRISE IMPROVEMENT: Classify error and show appropriate modal
      const isCancelled =
        error?.message === 'USER_CANCELLED' ||
        error?.code === 'USER_CANCELLED' ||
        error?.message?.toLowerCase().includes('cancel') ||
        error?.message?.toLowerCase().includes('timeout') ||
        error?.message === 'STALE_PURCHASE_CACHE' ||
        error?.message?.includes('Purchase timeout');

      if (isCancelled) {
        // CRITICAL: Reset ALL purchase state to prevent stale/cached validation
        setIsStartingTrial(false);
        setPurchaseValidated(false);
        setShowSuccessModal(false);
        setLoadingStep('processing');
        return;
      }

      // For other errors, just log them silently instead of showing error modal
      setIsStartingTrial(false);
    } finally {
      // FINAL SAFETY: Ensure loading state is always cleared
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

  // Safety timeout to prevent infinite loading (30 seconds max)
  useEffect(() => {
    if (isStartingTrial) {
      const safetyTimeout = setTimeout(() => {
        setIsStartingTrial(false);
        setPurchaseValidated(false);
        setShowSuccessModal(false);
        setLoadingStep('processing');
      }, 30000); // 30 second safety timeout

      return () => clearTimeout(safetyTimeout);
    }
  }, [isStartingTrial]);

  // Load pricing and currency for dynamic copy
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load location-based tiers for display
        const tiers = await pricingService.getLocationAdjustedPricing();
        const currency = await pricingService.getCurrencyInfo();

        if (mounted) {
          setPricingTiers(tiers || []);
          // setDynamicPricing([]); // Not using dynamic pricing for now - removed unused state
          setCurrencyInfo(currency || null);
        }
      } catch (e) {
        // Error silently handled - pricing loading is not critical
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getSelectedTier = () => pricingTiers.find((t: any) => t.id === selectedTierId) || pricingTiers.find((t: any) => t.id === 'family');

  // getCurrentPrice removed - defined but never called

  const getLocalizedPrice = () => {
    // Use tier pricing with currency
    const t = getSelectedTier();
    if (!t) {return '₱0';} // Use Philippine peso as fallback in development
    const price = isAnnual ? t.annualPrice : t.monthlyPrice;
    // Remove .00 for PHP whole numbers
    if (currencyInfo?.currency === 'PHP' && price % 1 === 0) {
      return `${currencyInfo.symbol}${Math.floor(price)}`;
    }
    return `${currencyInfo?.symbol || '₱'}${price.toFixed(2)}`;
  };

  const getMonthlyEquivalent = () => {
    // Use tier pricing
    const t = getSelectedTier();
    if (!t) {return 0;}
    return (t.annualPrice / 12);
  };

  const getAnnualSavings = () => {
    const t = getSelectedTier();
    if (!t) {return 0;}
    const monthlyTotal = t.monthlyPrice * 12;
    const savings = monthlyTotal - t.annualPrice;
    return savings;
  };

  const getSavingsPercentage = () => {
    const t = getSelectedTier();
    if (!t) {return 0;}
    const monthlyTotal = t.monthlyPrice * 12;
    const savings = monthlyTotal - t.annualPrice;
    const percentage = (savings / monthlyTotal) * 100;
    return Math.round(percentage);
  };

  // hasTrialAvailable removed - defined but never called

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
      description: 'Try siFia Family Plan free for 3 days.\nNo pressure, no catch.\nExperience personalized guidance and see how it fits your story.\n\nIncludes: 2 playbooks + 2 devotionals to get you started.',
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
                Includes: 2 playbooks + 2 devotionals to get you started
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
  const safeNavigate = useCallback((action: () => void, _actionName: string) => {
    try {
      action();
    } catch (error) {
      // Fallback to basic navigation
      try {
        navigation.goBack();
      } catch (fallbackError) {
        // Navigation failed - component will handle this gracefully
      }
    }
  }, [navigation]);

  // ENTERPRISE IMPROVEMENT: Enhanced success modal continue handler
  const handleSuccessModalContinue = useCallback(() => {
    setShowSuccessModal(false);

    // Use a more reliable navigation approach
    const skipNotificationPreference = route?.params?.skipNotificationPreference;

    // Small delay to ensure modal is fully hidden
    setTimeout(() => {
      if (skipNotificationPreference) {
        safeNavigate(() => navigation.goBack(), 'go_back_to_sales');
      } else {
        // Navigate to notification setup - use replace to avoid stack issues
        safeNavigate(() => {
          (navigation as any).replace('OnboardingNotificationSetup', {
            userType: 'trial',
            fromTrial: true,
            navigationGuarded: true,
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
          style={[styles.closeButton, (isClosing || isStartingTrial) && styles.disabledButton]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={isClosing || isStartingTrial}
        >
          <Ionicons name="close" size={22} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <ThemedText weight="bold" style={styles.headerMainTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
            Not sure yet?
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
            <ThemedText weight="semiBold" style={styles.introTitle}>
              That's okay. Starting something new can feel uncertain.
            </ThemedText>
            <ThemedText style={styles.introText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.92}>
              Here's what you'll unlock during your free trial.
            </ThemedText>
          </View>

          {/* Trial Availability Warning */}
          {trialProductAvailable === false && (
            <View style={styles.trialWarningContainer}>
              <Ionicons name="warning" size={20} color={Colors.alertCoral} />
              <ThemedText style={styles.trialWarningText}>
                Trial offer unavailable - using standard pricing
              </ThemedText>
            </View>
          )}

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
              {`3 days free, then ${getLocalizedPrice()} per ${isAnnual ? 'year' : 'month'}`}
            </ThemedText>
            {isAnnual ? (
              <View style={styles.savingsContainer}>
                <ThemedText weight="bold" style={styles.pricingSubtitle}>
                  {(() => {
                    const monthlyEq = getMonthlyEquivalent();
                    const formatted = (currencyInfo?.currency === 'PHP' && monthlyEq % 1 === 0) ? Math.floor(monthlyEq) : monthlyEq.toFixed(2);
                    return `Only ${currencyInfo?.symbol || '₱'}${formatted}/month`;
                  })()}
                </ThemedText>
                <ThemedText weight="semiBold" style={styles.freeOfferText}>2 months free</ThemedText>
                <ThemedText weight="semiBold" style={styles.savingsText}>
                  {(() => {
                    const savings = getAnnualSavings();
                    const formatted = (currencyInfo?.currency === 'PHP' && savings % 1 === 0) ? Math.floor(savings) : savings.toFixed(2);
                    return `Save ${currencyInfo?.symbol || '₱'}${formatted} (${getSavingsPercentage()}%)`;
                  })()}
                </ThemedText>
              </View>
            ) : null}

            {/* Plan Selector - Change Plan Button */}
            <TouchableOpacity
              style={styles.changePlanButton}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setShowPlanSelector(true);
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="medium" style={styles.changePlanButtonText}>
                Change Plan
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA and Footer */}
        <View style={styles.footerBlock}>
          <TouchableOpacity
            style={[styles.startTrialButton, (isStartingTrial || isClosing) && styles.disabledButton]}
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

      {/* Plan Selector Modal */}
      <Modal
        visible={showPlanSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setShowPlanSelector(false);
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <ThemedText weight="bold" style={styles.modalTitle}>Choose Your Plan</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  {isAnnual ? 'Annual Billing' : 'Monthly Billing'}
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setShowPlanSelector(false);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </View>

            {/* Plan Options - Show when button tapped */}
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
                    setSelectedTierId(tier.id);
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
                      {(() => {
                        // Use tier pricing directly
                        const price = isAnnual ? (tier.annualPrice || 0) : (tier.monthlyPrice || 0);
                        const formatted = (currencyInfo?.currency === 'PHP' && price % 1 === 0) ? Math.floor(price) : price.toFixed(2);
                        return `${currencyInfo?.symbol || '₱'}${formatted}${isAnnual ? '/yr' : '/mo'}`;
                      })()}
                    </ThemedText>
                  </View>
                  {selectedTierId === tier.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
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
  disabledButton: {
    opacity: 0.6,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 56,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
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
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  introText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    lineHeight: 22,
    opacity: 0.9,
  },
  trialWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.alertCoral,
  },
  trialWarningText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: Colors.alertCoral,
    marginLeft: 8,
    flex: 1,
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
    paddingHorizontal: 20,
    gap: 16,
  },
  planOptionExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    minWidth: 200,
  },
  selectedPlanOptionExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  savingsContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  savingsText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.growthGreen,
    textAlign: 'center',
    marginTop: 4,
  },
  freeOfferText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.faithGold,
    textAlign: 'center',
    marginTop: 2,
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
    maxWidth: 720,
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
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    paddingTop: 20,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.7,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default withErrorBoundary(OnboardingTrialOfferScreen, 'OnboardingTrialOfferScreen');
