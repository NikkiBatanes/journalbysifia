import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  StatusBar,
  useWindowDimensions,
  Alert,
  Linking,
  Platform,
  Animated,
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
import { logger } from '../../utils/logger';
import { notificationService } from '../../services/notificationService';
import { useQueryClient } from '@tanstack/react-query';

const OnboardingTrialOfferScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { currentFont } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallPhone = height <= 850;

  const fonts = useMemo(() => {
    const fontKey = currentFont || 'lexend';
    return {
      regular: getFontFamily(fontKey, 'regular'),
      medium: getFontFamily(fontKey, 'medium'),
      semiBold: getFontFamily(fontKey, 'semiBold'),
      bold: getFontFamily(fontKey, 'bold'),
    };
  }, [currentFont]);

  const styles = useMemo(() => createStyles(fonts, isSmallPhone), [fonts, isSmallPhone]);

  // Read selection from params passed from sales offer screen
  // If user selected transformation + annual in sales offer, trial will default to that
  // But user can change it via "Change Plan" button
  const routeParams = route?.params as { selectedTierId?: string; billing?: 'annual' | 'monthly'; skipNotificationPreference?: boolean; closeAllOnDismiss?: boolean; returnTo?: string; context?: string; onboardingFlow?: boolean; source?: string; feature?: string; dismissBothModalsOnClose?: boolean; isTrialEligible?: boolean } | undefined;
  const initialTierId: string = routeParams?.selectedTierId || 'growth'; // Use sales offer selection or default to growth
  const initialBilling: 'annual' | 'monthly' = routeParams?.billing || 'monthly'; // Default to monthly if not provided

  const fromExportRestriction = (routeParams?.source === 'pdf_export_restriction' || routeParams?.source === 'docx_export_restriction') && (routeParams?.feature === 'export_pdf' || routeParams?.feature === 'export_docx');

  // Detect if from registration onboarding vs upgrade/profile
  const fromRegistrationOnboarding = routeParams?.onboardingFlow === true && !routeParams?.source && !routeParams?.returnTo;
  const fromUpgradeOrProfile = !fromRegistrationOnboarding; // Any other source (upgrade, profile, feature locks, etc.)

  logger.debug('Trial screen initialized with params', {
    selectedTierId: routeParams?.selectedTierId,
    billing: routeParams?.billing,
    initialTierId,
    initialBilling,
  });

  const [selectedTierId, setSelectedTierId] = useState<string>(initialTierId);
  const [isAnnual, setIsAnnual] = useState(initialBilling === 'annual');
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const monthlyScale = useRef(new Animated.Value(1)).current;
  const annualScale = useRef(new Animated.Value(1)).current;

  const animateToggle = (isAnnual: boolean) => {
    if (isAnnual) {
      Animated.spring(monthlyScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      Animated.spring(annualScale, {
        toValue: 1.05,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.spring(annualScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      Animated.spring(monthlyScale, {
        toValue: 1.05,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  };

  useEffect(() => {
    animateToggle(isAnnual);
  }, [isAnnual]);
  // dynamicPricing removed - not used, only setDynamicPricing is called
  const [currencyInfo, setCurrencyInfo] = useState<any>(null);
  const [_isNavigatingAway, _setIsNavigatingAway] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [autoDismissScheduled, setAutoDismissScheduled] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [isClosing, setIsClosing] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [_trialProductAvailable, setTrialProductAvailable] = useState<boolean | null>(null);
  const [navigationInProgressRef] = [React.useRef(false)];

  const handleClose = async () => {
    if (isClosing || isStartingTrial || navigationInProgressRef.current) {
      logger.debug('handleClose blocked', { isClosing, isStartingTrial, navInProgress: navigationInProgressRef.current });
      return;
    }

    logger.debug('handleClose executing', {
      routeParams,
      returnTo: routeParams?.returnTo,
      context: routeParams?.context,
      dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
      closeAllOnDismiss: routeParams?.closeAllOnDismiss,
    });
    navigationInProgressRef.current = true;
    setIsClosing(true);

    try {
      triggerLightHaptic();
    } catch {}

    // Check if we came from user profile or other specific context
    const fromUserProfile = routeParams?.returnTo === 'UserProfile' || routeParams?.context === 'profile_settings';
    const dismissBothModalsOnClose = routeParams?.dismissBothModalsOnClose === true;

    logger.debug('Navigation context determined', { fromUserProfile, dismissBothModalsOnClose });

    // If from user profile with dismissBothModalsOnClose flag, dismiss all modals
    if (fromUserProfile && dismissBothModalsOnClose) {
      logger.debug('Closing from user profile - dismissing both modals', { fromUserProfile, dismissBothModalsOnClose });
      try {
        // Use goBack twice with proper timing to dismiss Trial and Sales Offer
        // This is more reliable than pop(2) for modal navigation
        navigation.goBack(); // Close Trial screen
        setTimeout(() => {
          navigation.goBack(); // Close Sales Offer screen
          logger.debug('Both modals dismissed, should be back at UserProfile');
        }, 100);
      } catch (error) {
        logger.error('Modal dismissal failed', error as Error);
        // Fallback: try going back once
        try {
          navigation.goBack();
        } catch (fallbackError) {
          logger.error('Fallback navigation also failed', fallbackError as Error);
        }
      }
    }
    // If from user profile (regular case)
    else if (fromUserProfile) {
      logger.debug('Closing from user profile - going back twice');
      try {
        // First pop this screen (Trial Offer)
        navigation.goBack();
        // Then after a brief delay, pop Sales Offer and navigate to UserProfile
        setTimeout(() => {
          navigation.goBack(); // Pop Sales Offer
          // UserProfile should now be visible since it's a modal in HomeStack
        }, 100);
      } catch (error) {
        // Fallback
        try { navigation.goBack(); } catch {}
      }
    } else if (fromRegistrationOnboarding) {
      // Only show notification setup for registration onboarding users
      logger.debug('Registration onboarding flow - navigating to notification setup');
      setTimeout(() => {
        (navigation as any).navigate('OnboardingNotificationSetup', {
          userType: 'freemium',
          fromCancelledTrial: true,
          onboardingFlow: true,
        });
      }, 50);
    } else if (routeParams?.closeAllOnDismiss) {
      logger.debug('closeAllOnDismiss - popping 2 screens');
      try {
        // Atomically pop Trial and Sales Offer to return to the previous context (e.g., PlaybookDetail)
        const popAction = StackActions.pop(2);
        navigation.dispatch(popAction);
      } catch (error) {
        // Fallback: try going back twice
        try {
          navigation.goBack();
          setTimeout(() => {
            navigation.goBack();
          }, 50);
        } catch {}
      }
    } else {
      // Default: For upgrade/profile users, dismiss both trial and sales offer screens
      logger.debug('Default close behavior (upgrade/profile user - dismissing both screens)', {
        fromRegistrationOnboarding,
        fromUpgradeOrProfile,
        returnTo: routeParams?.returnTo,
      });

      if (routeParams?.returnTo) {
        // Navigate to specific return screen after dismissing both modals
        try {
          navigation.goBack(); // Close Trial screen
          setTimeout(() => {
            navigation.goBack(); // Close Sales Offer screen
            setTimeout(() => {
              (navigation as any).navigate(routeParams.returnTo);
            }, 50);
          }, 50);
        } catch (error) {
          logger.error('Navigation to returnTo failed', error as Error);
          // Fallback: try going back twice
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 50);
        }
      } else {
        // Just go back twice to dismiss both trial and sales offer screens
        navigation.goBack(); // Close Trial screen
        setTimeout(() => {
          navigation.goBack(); // Close Sales Offer screen
        }, 50);
      }
    }

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

          // Auto-dismiss after showing success briefly
          if (!autoDismissScheduled) {
            setAutoDismissScheduled(true);
            setTimeout(() => {
              handleSuccessModalContinue();
            }, 2000);
          }
        }
      } catch (checkError) {
        // Continue with purchase attempt
      }

      // CRITICAL: Trial Offer Screen uses .freetrial product IDs
      // These are separate products in App Store Connect with 3-day free trial configured
      // Product ID format: app.sifia.com.{tier}.{billing}.freetrial
      // Example: app.sifia.com.transformation.annual.freetrial
      const paymentService = PlatformPaymentService.getInstance();

      // CRITICAL FIX: Check if user is already on trial
      // iOS rejects purchase silently when trial user tries to buy another trial product
      const billing = isAnnual ? 'annual' : 'monthly';
      let currentSubscription = null;
      let isAlreadyOnTrial = false;

      try {
        const { NewSubscriptionService } = await import('../../services/NewSubscriptionService');
        currentSubscription = await NewSubscriptionService.getUserSubscription(user.id);
        isAlreadyOnTrial = currentSubscription?.tier === 'free_trial' && currentSubscription?.status === 'active';
      } catch (error) {
        logger.warn('Failed to check current subscription status', { error: error as Error });
      }

      // Use regular product if already on trial, trial product if new user
      const productId = isAlreadyOnTrial
        ? `app.sifia.com.${selectedTierId}.${billing}` // Regular product for trial users
        : `app.sifia.com.${selectedTierId}.${billing}.freetrial`; // Trial product for new users

      logger.info('Product selection logic', {
        selectedTierId,
        billing,
        isAlreadyOnTrial,
        currentTier: currentSubscription?.tier,
        currentStatus: currentSubscription?.status,
        selectedProductId: productId,
      });

      logger.debug('Constructing trial product ID', {
        selectedTierId,
        billing,
        productId,
        isAnnual,
      });

      // ENHANCED: Verify the .freetrial product exists in App Store Connect
      // Even if configured, it might not be synced to TestFlight yet
      let availableProducts: any[] = [];
      let trialProduct: any = null;

      try {
        // Initialize payment service first
        await paymentService.initialize();

        // Get available products with retry logic
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            availableProducts = await paymentService.getAvailableProducts();
            if (availableProducts.length > 0) {break;}

            logger.warn(`Trial product check attempt ${attempt} failed - no products available`, {
              attempt,
              totalProducts: availableProducts.length,
            });

            if (attempt < 3) {
              // Wait 1 second before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (retryError) {
            logger.warn(`Trial product check attempt ${attempt} failed with error`, {
              attempt,
              error: retryError instanceof Error ? retryError.message : 'Unknown error',
            });

            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw retryError;
            }
          }
        }

        // Find the specific trial product
        trialProduct = availableProducts.find(p => p.productId === productId);

        // Log all available products for debugging
        logger.debug('Trial product availability check', {
          expectedProductId: productId,
          totalProducts: availableProducts.length,
          trialProducts: availableProducts.filter(p => p.productId.includes('freetrial')).map(p => p.productId),
          allProductIds: availableProducts.map(p => p.productId),
        });

        if (!trialProduct) {
          setTrialProductAvailable(false);

          // Enhanced error message with actionable guidance
          const errorMessage = `Free trial product not available.

🔍 DEBUGGING INFO:
• Expected trial product: ${productId}
• Available products: ${availableProducts.length}
• Selected tier: ${selectedTierId}
• Trial products found: ${availableProducts.filter(p => p.productId.includes('freetrial')).length}

🛠️ POSSIBLE SOLUTIONS:
1. App Store Connect: Ensure .freetrial products are approved and synced to TestFlight
2. Sandbox Testing: Use a sandbox tester account (not production Apple ID)
3. Product Sync: Wait 5-10 minutes for new products to sync to TestFlight
4. Bundle ID: Verify app bundle ID matches App Store Connect configuration

📱 REQUIRED PRODUCTS:
• app.sifia.com.spark.monthly.freetrial
• app.sifia.com.growth.monthly.freetrial  
• app.sifia.com.transformation.monthly.freetrial
• app.sifia.com.spark.annual.freetrial
• app.sifia.com.growth.annual.freetrial
• app.sifia.com.transformation.annual.freetrial`;

          logger.error(
            'Trial product not found - blocking purchase',
            undefined,
            {
              expectedProductId: productId,
              availableProducts: availableProducts.map(p => p.productId),
              trialProducts: availableProducts.filter(p => p.productId.includes('freetrial')).map(p => p.productId),
              selectedTierId,
              isAnnual,
            }
          );

          throw new Error(errorMessage);
        }

        // Set UI state to show trial is available
        setTrialProductAvailable(true);

        logger.info('Trial product verified and available', {
          productId: trialProduct.productId,
          localizedPrice: trialProduct.localizedPrice,
          title: trialProduct.title,
        });

      } catch (productError) {
        setTrialProductAvailable(false);

        const baseError = productError instanceof Error ? productError.message : 'Unknown error';
        const enhancedError = `Unable to verify trial availability: ${baseError}

🔄 RETRY SUGGESTIONS:
• Check internet connection and try again
• Ensure you're using a sandbox tester account
• Verify App Store Connect product configuration
• Wait a few minutes for product sync to complete`;

        throw new Error(enhancedError);
      }

      // Show Apple's payment sheet - will show "Free for 3 days, then $X.XX" if trial product
      let result;
      try {
        // Initialize payment service first
        await paymentService.initialize();

        // Set trial eligibility before purchase
        if (Platform.OS === 'ios') {
          try {
            const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
            const storeKit = AppleStoreKitService.getInstance();
            storeKit.setPurchaseEligibility(true); // TrialOfferScreen is always for eligible users
          } catch (error) {
            logger.warn('Failed to set purchase eligibility before iOS purchase', { error: error as Error });
          }
        }

        // Now initiate purchase
        logger.info('🛒 TRIAL STEP 1: Initiating trial purchase', {
          productId,
          userId: user.id,
          selectedTierId,
          billing,
          timestamp: new Date().toISOString(),
        });

        result = await paymentService.purchaseSubscription(productId, user.id);

        logger.info('📦 TRIAL STEP 2: Trial purchase result received', {
          success: result.success,
          hasTransactionId: !!result.transactionId,
          transactionId: result.transactionId?.substring(0, 10) + '...',
          error: result.error,
          timestamp: new Date().toISOString(),
        });
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
        // This activates the trial with tier-specific limits (Spark: 5/5, Growth: 15/15, Transformation: 25/25)
        try {
          logger.info('🔄 TRIAL STEP 3: Starting trial setup in database', {
            userId: user.id,
            durationDays: 3,
            chosenTier: selectedTierId,
            billingCycle: isAnnual ? 'annual' : 'monthly',
            timestamp: new Date().toISOString(),
          });

          const trialSetupStartTime = Date.now();
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
            platform_transaction_id: result.transactionId,
            original_transaction_id: result.transactionId,
            platform_subscription_id: result.transactionId,
          });

          const trialSetupDuration = Date.now() - trialSetupStartTime;
          logger.info(`✅ TRIAL STEP 4: Trial setup completed successfully (${trialSetupDuration}ms)`, {
            userId: user.id,
            duration: trialSetupDuration,
            timestamp: new Date().toISOString(),
          });

        } catch (trialSetupError) {
          logger.error('❌ TRIAL STEP 4: Trial setup failed', trialSetupError as Error, {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
          // Don't throw - Apple purchase already succeeded, just log the error
        }

        // ENTERPRISE IMPROVEMENT: Update loading steps
        setLoadingStep('activating');

        // Sync subscription
        try {
          logger.info('🔄 TRIAL STEP 5: Starting subscription sync', {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });

          const syncStartTime = Date.now();
          const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
          const storeKitService = AppleStoreKitService.getInstance();

          // NOTE: Stale purchase validation now handled in AppleStoreKitService.handlePurchaseUpdate
          // The service automatically rejects purchases older than 5 minutes from initiation
          // This ensures only fresh trial activations are processed

          await storeKitService.checkAndSyncSubscriptionStatus(user.id, false);

          const syncDuration = Date.now() - syncStartTime;
          logger.info(`✅ TRIAL STEP 6: Subscription sync completed (${syncDuration}ms)`, {
            userId: user.id,
            duration: syncDuration,
            timestamp: new Date().toISOString(),
          });

          // CRITICAL: Invalidate subscription cache to trigger UI updates across all hooks
          logger.debug('🔄 TRIAL STEP 7: Invalidating subscription cache for immediate UI update', {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });

          await queryClient.invalidateQueries({
            queryKey: ['subscription', user.id],
            refetchType: 'active', // Force immediate refetch of active queries
          });

          logger.info('✅ TRIAL STEP 8: All trial steps completed successfully', {
            userId: user.id,
            selectedTierId,
            timestamp: new Date().toISOString(),
          });

        } catch (syncError) {
          logger.error('❌ TRIAL STEP 6: Subscription sync failed', syncError as Error, {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
        }

        // Final step
        setLoadingStep('completing');

        // CRITICAL: Hide loading modal first, then show success modal
        // This prevents both modals from being visible at the same time
        logger.info('Trial purchase successful - showing success modal', {
          transactionId: result.transactionId,
          selectedTier: selectedTierId,
        });
        setPurchaseValidated(true); // Always show as validated for successful purchases
        setIsStartingTrial(false); // Hide loading modal

        // Minimal wait for loading modal to hide before showing success modal
        await new Promise(resolve => setTimeout(resolve, 200));

        // CRITICAL: Suppress faith points notifications during success modal to prevent z-index conflicts
        notificationService.suppressPointsNotifications(true);
        setShowSuccessModal(true);

        // Auto-dismiss trial offer screen after successful payment
        // Auto-navigate after a short delay to show success briefly
        if (!autoDismissScheduled) {
          setAutoDismissScheduled(true);
          setTimeout(() => {
            handleSuccessModalContinue();
          }, 2000); // Show success for 2 seconds then auto-dismiss
        }
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

  const handleRestorePurchase = async () => {
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
              Alert.alert('Restoring...', 'Please wait while we restore your purchases.');

              const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
              const storeKit = AppleStoreKitService.getInstance();

              const result = await storeKit.restorePurchases(user.id);

              if (result.success) {
                // Auto-dismiss loading alert and show success
                setTimeout(() => {
                  Alert.alert('Success', result.message, [{ text: 'OK' }]);
                }, 100);
              } else {
                Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
              }
            } catch (error) {
              logger.error('Restore purchases error', error as Error, {
                component: 'OnboardingTrialOfferScreen',
              });
              Alert.alert(
                'Restore Failed',
                'Unable to restore purchases. Please try again later or contact support.',
                [{ text: 'OK' }],
              );
            }
          },
        },
      ],
    );
  };

  const handleTermsOfService = () => {
    try {
      triggerLightHaptic();
      logger.info('Terms of Service requested');
      // Match Terms of Service URL used in UserProfileScreen
      Linking.openURL('https://sifia.app/legal/terms');
    } catch (error) {
      logger.error('Error opening terms of service', error as Error);
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
      // POST-LAUNCH: case 'family': return 'siFia Family';
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
  }, [routeParams?.feature, routeParams?.source]);

  const getSelectedTier = () => pricingTiers.find((t: any) => t.id === selectedTierId) || pricingTiers.find((t: any) => t.id === 'growth'); // POST-LAUNCH: fallback was 'family'

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


  const formatShortDate = (date: Date) => {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  };

  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  // hasTrialAvailable removed - defined but never called

  // Removed duplicate handleStartTrial function



  const getTrialBenefits = () => {
    switch (selectedTierId) {
      case 'growth':
        return 'You get 15 playbooks, 15 devotionals, and 1,3, & 5-day devotionals.';
      case 'spark':
        return 'You get 10 playbooks, 10 devotionals, and 1,3-day devotionals.';
      case 'transformation':
        return 'You get 15 playbooks, 15 devotionals, and 1,3,5 & 7-day devotionals.';
      default:
        return 'You get 15 playbooks, 15 devotionals, and 1,3, & 5-day devotionals.';
    }
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    const start = startDate;
    const end = endDate;
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
    }
  };

  const timelineItems = React.useMemo(() => {
    const today = new Date();
    const day2 = addDays(today, 2);
    const day3 = addDays(today, 3);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return [
      {
        id: 1,
        title: 'Today',
        subtitle: 'Your free trial begins',
        description: getTrialBenefits(),
        icon: 'checkmark-circle',
        iconColor: Colors.growthGreen,
        isCompleted: true,
      },
      {
        id: 2,
        title: formatDateRange(today, day2),
        subtitle: 'Use it in real moments',
        description: 'Come back with new situations, create devotionals, and see if the structure helps.',
        icon: 'notifications',
        iconColor: Colors.growthGreen,
        isCompleted: false,
      },
      {
        id: 3,
        title: formatDate(day3),
        subtitle: 'Your paid plan starts',
        description: `If you keep the subscription, your ${isAnnual ? 'annual' : 'monthly'} plan begins fresh.`,
        icon: 'rocket',
        iconColor: Colors.alertCoral,
        isCompleted: false,
      },
    ];
  }, [selectedTierId, isAnnual]);

// ... (rest of the code remains the same)
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
          {item.subtitle && (
            <ThemedText weight="bold" style={styles.timelineSubtitle}>{item.subtitle}</ThemedText>
          )}
          {item.description ? (
            <ThemedText style={styles.timelineDescription}>{item.description}</ThemedText>
          ) : null}
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
    logger.info('Success modal continue button pressed');
    setShowSuccessModal(false);
    setAutoDismissScheduled(false); // Reset auto-dismissal state

    // Re-enable faith points notifications after modal is hidden
    notificationService.suppressPointsNotifications(false);

    // Use a more reliable navigation approach
    const skipNotificationPreference = route?.params?.skipNotificationPreference;

    // Small delay to ensure modal is fully hidden
    setTimeout(() => {
      if (skipNotificationPreference) {
        logger.info('Navigating back (skipNotificationPreference=true)');
        safeNavigate(() => navigation.goBack(), 'go_back_to_sales');
      } else if (fromRegistrationOnboarding) {
        // Only show notification setup for registration onboarding users
        logger.info('Navigating to OnboardingNotificationSetup (registration onboarding)');
        try {
          (navigation as any).navigate('OnboardingNotificationSetup', {
            userType: 'trial',
            fromTrial: true,
            onboardingFlow: true,
          });
        } catch (navError) {
          safeNavigate(() => navigation.goBack(), 'go_back_first_modal');
          setTimeout(() => {
            safeNavigate(() => navigation.goBack(), 'go_back_second_modal');
          }, 100);
        }
      } else {
        safeNavigate(() => navigation.goBack(), 'go_back_default');
      }
    }, 100);
  }, [route?.params?.skipNotificationPreference, navigation, safeNavigate, fromRegistrationOnboarding]);

  const handleSuccessModalDismiss = useCallback(() => {
    handleSuccessModalContinue();
  }, [handleSuccessModalContinue]);

  // Reset auto-dismissal state when component unmounts
  useEffect(() => {
    return () => {
      setAutoDismissScheduled(false);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} animated />
      <PurchaseLoadingModal
        visible={isStartingTrial && !showSuccessModal}
        step={loadingStep}
      />

      <PurchaseSuccessModal
        visible={showSuccessModal}
        tier={selectedTierId}
        isTrial={true}
        isValidated={purchaseValidated}
        onContinue={handleSuccessModalDismiss}
      />

      {/* Sticky close button - outside ScrollView */}
      <TouchableOpacity
        style={[styles.closeButtonSticky, (isClosing || isStartingTrial) && styles.disabledButton]}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        disabled={isClosing || isStartingTrial}
      >
        <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
      </TouchableOpacity>

      <View style={styles.scrollContainer}>
        {/* Main Content (scrollable to avoid cut-off in landscape) */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isLandscape ? styles.scrollContentLandscape : styles.scrollContentPortrait]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Header - now inside ScrollView to scroll with content */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTextBlock}>
                <ThemedText weight="bold" style={styles.headerMainTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
                  {routeParams?.isTrialEligible ? 'How your free trial works' : 'Not sure yet?'}
                </ThemedText>
                {routeParams?.isTrialEligible && (
                  <ThemedText style={styles.headerSubText}>
                    3 days free on {getTierDisplayName(selectedTierId)}. After that, your subscription continues at {getLocalizedPrice()}/{isAnnual ? 'year' : 'month'} unless cancelled.
                  </ThemedText>
                )}
              </View>
            </View>
          </View>

          <View style={styles.contentWrap}>

          {/* Timeline */}
          <View style={styles.timelineContainer}>
            {timelineItems.map((item, index) => renderTimelineItem(item, index))}
          </View>

          {/* Selected Plan Container */}
          <View style={styles.selectedPlanContainer}>
            <ThemedText style={styles.selectedPlanLabel}>SELECTED PLAN</ThemedText>
            <ThemedText weight="bold" style={styles.selectedPlanName}>{getTierDisplayName(selectedTierId)} {isAnnual ? 'Annual' : 'Monthly'}</ThemedText>
            <TouchableOpacity
              style={styles.changePlanButton}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.changePlanButtonText}>Change Plan</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Bottom Links */}
          <View style={styles.bottomLinksContainer}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleRestorePurchase}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.linkText}>Restore Purchase</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleTermsOfService}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.linkText}>Terms of Service</ThemedText>
            </TouchableOpacity>
          </View>
          {/* Dev controls removed */}
        </View>
        </ScrollView>
      </View>

      {/* CTA and Footer (sticky) */}
      <View style={styles.footerBlock} pointerEvents="box-none">
        {/* Monthly/Annual Toggle */}
        <View style={styles.footerToggleContainer}>
          <Animated.View style={{ transform: [{ scale: monthlyScale }] }}>
            <TouchableOpacity
              style={[styles.footerToggleButton, !isAnnual && styles.activeFooterToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(false);
              }}
              activeOpacity={0.9}
            >
              <ThemedText weight={!isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, !isAnnual && styles.activeFooterToggleText]}>Monthly</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: annualScale }] }}>
            <TouchableOpacity
              style={[styles.footerToggleButton, isAnnual && styles.activeFooterToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(true);
              }}
              activeOpacity={0.9}
            >
              <ThemedText weight={isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, isAnnual && styles.activeFooterToggleText]}>Annual</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Pricing Summary (dynamic) */}
        <View style={styles.pricingSummary}>
          <ThemedText weight="bold" style={styles.pricingTitle}>
            {`3 days free, then ${getLocalizedPrice()}/${isAnnual ? 'year' : 'month'}`}
          </ThemedText>
          {isAnnual ? (
            <View style={styles.savingsContainer}>
              <ThemedText style={styles.annualSavingsText}>
                <ThemedText style={{ textDecorationLine: 'line-through', opacity: 0.6, color: Colors.faithGold }}>{`${currencyInfo?.symbol || '$'}${(getSelectedTier()?.monthlyPrice * 12).toFixed(2)}`}</ThemedText>
                {' · '}
                <ThemedText style={{ color: Colors.faithGold }}>Save 2 months</ThemedText>
              </ThemedText>
              <ThemedText style={styles.footerPriceApprox}>
                Pay once, grow all year.
              </ThemedText>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.startTrialButton, (isStartingTrial || isClosing) && styles.disabledButton]}
          onPress={handleStartTrial}
          activeOpacity={0.9}
          disabled={isStartingTrial || isClosing}
        >
          <ThemedText weight="bold" style={styles.startTrialButtonText}>
            {isStartingTrial ? 'Starting Trial...' : 'Start 3-day Free Trial'}
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.footerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
          Try 3 days free. No payment now. Cancel anytime.
        </ThemedText>
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

const createStyles = (fonts: any, isSmallPhone: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    alignSelf: 'stretch',
    width: '100%',
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-start',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
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
    fontSize: 26,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'left',
    lineHeight: 30,
    letterSpacing: 0.25,
    marginBottom: 0,
    marginTop: 16,
  },
  headerSubText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.7,
    textAlign: 'left',
    marginTop: 4,
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
    position: 'absolute',
    top: 18,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonSticky: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
  scrollContentLandscape: {
    paddingBottom: 200,
  },
  scrollContentPortrait: {
    paddingBottom: 240,
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
    marginTop: 0,
    marginBottom: 20,
  },
  introTitle: {
    fontSize: isSmallPhone ? 14 : 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: isSmallPhone ? 14 : 17,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    lineHeight: isSmallPhone ? 22 : 24,
    opacity: 0.9,
    marginTop: 12,
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
  disabledButton: {
    opacity: 0.5,
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
    marginBottom: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 9,
    paddingHorizontal: 24,
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
    marginBottom: 16,
  },
  selectedPlanContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  selectedPlanLabel: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectedPlanName: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  changePlanButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  changePlanButtonText: {
    fontSize: 11,
    color: Colors.hopeWhite,
    fontWeight: '400',
  },
  timelineBulletsContainer: {
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  timelineBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineBulletText: {
    marginLeft: 10,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    lineHeight: 18,
    flex: 1,
  },
  devControlsContainer: {
    marginTop: 16,
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  devControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  devControlButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  devControlText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  timelineIndentedRow: {
    marginLeft: 28,
    marginTop: -3,
  },
  timelineIndentedText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.9,
    lineHeight: 18,
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
    marginBottom: 14,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 14,
  },
  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    paddingTop: 3,
  },
  timelineTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 3,
  },
  timelineSubtitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    opacity: 0.95,
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    lineHeight: 18,
    opacity: 0.6,
  },
  timelineDescriptionSpacing: {
    marginTop: 8,
  },
  timelineSectionSpacing: {
    marginTop: 8,
  },
  includesContainer: {
    borderRadius: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  includesColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  includesBadge: {
    borderWidth: 0.3,
    borderColor: Colors.hopeWhite,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  detailsWrapper: {
    flex: 1,
    minWidth: 0, // Allows text to wrap properly
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
  },
  includesDetails: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    opacity: 1.0,
    lineHeight: 16,
  },
  strong: {
    fontFamily: fonts.bold,
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
  annualSavingsHighlight: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.faithGold,
    textAlign: 'center',
    marginTop: 2,
  },
  annualSavingsText: {
    fontSize: 14,
    color: Colors.faithGold,
    textAlign: 'center',
    marginTop: 4,
  },
  footerPriceApprox: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
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
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    marginTop: 10,
  },
  startTrialButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 15,
    borderRadius: 50,
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
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  startTrialButtonText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 8,
    marginBottom: 24,
  },
  spacerHeight: {
    height: 0,
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
  bottomLinksContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  // Footer toggle styles
  footerToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  footerToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  activeFooterToggle: {
    backgroundColor: Colors.growthGreen,
  },
  footerToggleText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  activeFooterToggleText: {
    color: Colors.hopeWhite,
  },
  pricingSummary: {
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 4,
  },
  savingsContainer: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
});

export default withErrorBoundary(OnboardingTrialOfferScreen, 'OnboardingTrialOfferScreen');
