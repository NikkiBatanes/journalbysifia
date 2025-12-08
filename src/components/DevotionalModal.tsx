import React, { useState, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Modal, StyleSheet, TouchableOpacity, View, Dimensions, Animated, Easing } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import DevotionalLockIcon from './DevotionalLockIcon';
import UsageTooltipModal from './profile/UsageTooltipModal';
import useDevotionalGating from '../hooks/useDevotionalGating';

import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { generateSalesCopy } from '../utils/dynamicSalesCopy';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DurationOption {
  days: number;
  title: string;
  description: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  {
    days: 1,
    title: '1-Day Devotional',
    description: 'Perfect for a quick lift of faith',
  },
  {
    days: 3,
    title: '3-Day Devotional',
    description: 'Great for a focused mid-week refresh',
  },
  {
    days: 5,
    title: '5-Day Devotional',
    description: 'Ideal for a deeper dive into your journey',
  },
  {
    days: 7,
    title: '7-Day Devotional',
    description: 'A full week of spiritual growth',
  },
];

interface DevotionalModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDuration?: (days: number) => void;
  userStruggle?: string;
  playbookInfo?: string;
  playbookId?: string;
  userInput?: string;
  onDevotionalCreated?: (devotionalId: string) => void;
  isOnboarding?: boolean;
}

const DevotionalModal: React.FC<DevotionalModalProps> = ({
  visible,
  onClose,
  onSelectDuration,
  playbookInfo,
  playbookId,
  userInput,
  onDevotionalCreated,
  isOnboarding = false,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation();
  const { createDevotional, isCreating } = useDevotionalOperations(user?.id || '');
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isVisible, setIsVisible] = useState(false);
  const [showPlaybookInfo, setShowPlaybookInfo] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [_ellipsis, setEllipsis] = useState('');
  const contentRef = React.useRef<View>(null);
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitModalData, setUsageLimitModalData] = useState<{
    isOnTrial: boolean;
    tier: string;
    trialChosenTier: string;
    devotionalsLimit: number;
    trialEndDate: string | null;
  } | null>(null);
  const [creationError, setCreationError] = useState<Error | null>(null);
  // Treat shorter devices (e.g., SE-class phones) as small so modal can use a bit more height
  const isSmallPhone = SCREEN_HEIGHT <= 850;

  // Feature gating
  const devotionalGating = useDevotionalGating();

  // Refresh gating data when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      devotionalGating.refreshSubscription();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh gating data when usage limit modal is shown
  React.useEffect(() => {
    if (showUsageLimitModal) {

      devotionalGating.refreshSubscription();
    }
  }, [showUsageLimitModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Haptics
  const hapticOptions = React.useMemo(() => ({
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  }), []);
  const triggerLightHaptic = React.useCallback(() => {
    try { ReactNativeHapticFeedback.trigger('impactLight', hapticOptions); } catch {}
  }, [hapticOptions]);

  // Success state and checkmark animation
  const [isSuccess, setIsSuccess] = useState(false);

  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Generating UI state (progress bar, shimmering step text, animated dots)
  const progressAnim = React.useRef(new Animated.Value(0)).current; // 0..100
  const shimmerOpacity = React.useRef(new Animated.Value(0.85)).current;
  const [dotCount, setDotCount] = useState(0);
  const [dotsWidth, setDotsWidth] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const generationSteps = React.useMemo(() => ([
    { title: 'Centering your heart…', description: '' },
    { title: 'Listening to your story…', description: '' },
    { title: 'Finding Scripture for each day…', description: '' },
    { title: 'Preparing reflections and prompts…', description: '' },
    { title: 'Crafting daily prayers…', description: '' },
    { title: 'Organizing your day-by-day journey…', description: '' },
    { title: 'Finalizing your devotional', description: '' },
  ]), []);
  const currentTitle = generationSteps[Math.min(currentStep, generationSteps.length - 1)]?.title || '';
  const baseTitle = React.useMemo(() => currentTitle.replace(/(…|\.{1,3})\s*$/, '').trimEnd(), [currentTitle]);

  // Ensure 'WHAT YOU SHARED' is collapsed initially each time the modal opens
  React.useEffect(() => {
    if (visible) {
      setShowPlaybookInfo(false);
      // Reset chevron rotation to collapsed state
      try { rotateAnim.setValue(0); } catch {}
      // CRITICAL FIX: Reset selected duration when modal opens
      setSelectedDuration(null);
    }
  }, [visible, rotateAnim]);

  React.useEffect(() => {

  }, [isCreating, creationError, isSuccess, selectedDuration]);
  // Animation for the overlay (fade in/out)
  // Fade animation for backdrop dim
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Shimmer loop while creating
  React.useEffect(() => {
    let mounted = true;
    const loop = () => {
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && mounted && isCreating && !isSuccess) {
          loop();
        }
      });
    };
    if (isCreating && !isSuccess) {
      loop();
    }
    return () => {
      mounted = false;
      shimmerOpacity.stopAnimation();
    };
  }, [isCreating, isSuccess, shimmerOpacity]);

  // Animated dots while creating
  React.useEffect(() => {
    if (!isCreating || isSuccess) { return; }
    const id = setInterval(() => setDotCount(prev => (prev + 1) % 4), 500);
    return () => clearInterval(id);
  }, [isCreating, isSuccess]);

  // Step advancement and progress bar animation while creating (cap at 95%)
  React.useEffect(() => {
    if (!isCreating || isSuccess) { return; }
    // Adjust step interval based on devotional duration
    // 1-3 day: 3000ms per step (18s total)
    // 5 day: 7000ms per step (42s total) - slower
    // 7 day: 8000ms per step (48s total) - slower
    const getStepDuration = () => {
      if (!selectedDuration) {return 3000;}
      if (selectedDuration >= 7) {return 8000;}
      if (selectedDuration >= 5) {return 7000;}
      return 3000;
    };

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        const isLast = nextStep >= generationSteps.length;
        Animated.timing(progressAnim, {
          toValue: Math.min(((isLast ? generationSteps.length : nextStep) / generationSteps.length) * 100, 95),
          duration: 1000,
          useNativeDriver: false,
        }).start();
        // Subtle haptic feedback on each visible step advancement
        if (!isLast) {
          try {
            triggerLightHaptic();
          } catch {}
        }
        return isLast ? prev : nextStep;
      });
    }, getStepDuration());
    return () => clearInterval(stepInterval);
  }, [isCreating, isSuccess, generationSteps.length, progressAnim, triggerLightHaptic, selectedDuration]);

  const measureContent = () => {
    if (contentRef.current) {
      contentRef.current.measureInWindow((_x, _y, _width, height) => {
        setContentHeight(height);
      });
    }
  };

  // Animate the ellipsis
  React.useEffect(() => {
    if (!isCreating) {return;}

    const timer = setInterval(() => {
      setEllipsis((prev: string) => {
        if (prev.length >= 3) {return '';}
        return prev + '.';
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isCreating]);

  React.useEffect(() => {
    let isMounted = true;
    let animation: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      setIsVisible(true);
      // Only reset progress animation when modal opens if no creation is in progress
      if (!isCreating && !isSuccess) {
        progressAnim.setValue(0);
        setCurrentStep(0);
      }
      // Small delay to ensure content is measured
      timer = setTimeout(() => {
        measureContent();
      }, 10);

      // Fade in backdrop and slide up modal
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
        }),
      ]);
      animation.start();
    } else {
      // Calculate the distance to slide down (full screen height + modal height + some extra)
      const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

      // Fade out backdrop quickly while sliding down
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100, // Very fast fade out
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: slideDownDistance,
          duration: 300, // Slide down duration
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]);

      animation.start(({ finished }) => {
        if (finished && isMounted) {
          setIsVisible(false);
          // Reset translateY for next open
          translateY.setValue(SCREEN_HEIGHT);
        }
      });
    }

    return () => {
      isMounted = false;
      if (animation) {
        animation.stop();
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [visible, contentHeight, fadeAnim, translateY, progressAnim, isCreating, isSuccess]);

  const togglePlaybookInfo = () => {
    setShowPlaybookInfo((prev) => {
      const next = !prev;
      Animated.spring(rotateAnim, {
        toValue: next ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
      return next;
    });
  };

  const handleSelectDuration = async (days: number) => {

    // Check if user has no remaining devotionals - check directly from subscription
    const devotionalsUsed = devotionalGating.subscription?.devotionals_used || 0;
    const devotionalsLimit = devotionalGating.subscription?.devotionals_limit || 0;
    const hasNoRemaining = devotionalsLimit !== -1 && devotionalsUsed >= devotionalsLimit;
    const isSeeker = devotionalGating.tier === 'seeker';

    // For Seeker users, skip popup and go directly to sales offer
    if (isSeeker && hasNoRemaining) {

      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from seeker/no-remaining gating', {
        component: 'DevotionalModal',
        context: 'seeker_no_remaining',
        requestedDuration: days,
      });

      onClose(); // Close the devotional modal
      navigation.navigate('OnboardingSalesOffer' as any, {
        upgradeMode: true,
        currentTier: 'seeker',
        requestedDuration: days,
        skipNotificationPreference: true,
        featureType: 'devotionals',
      });
      return;
    }

    if (hasNoRemaining) {

      // Force refresh before showing modal
      await devotionalGating.refreshSubscription();
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the current state to use in modal (prevents reactivity issues)
      // IMPORTANT: Check the ACTUAL tier from subscription, not the effectiveTier
      // because useDevotionalGating returns trial_chosen_tier as the tier for feature gating
      const actualTier = devotionalGating.subscription?.tier || devotionalGating.tier;
      const isOnTrial = actualTier === 'free_trial';

      setUsageLimitModalData({
        isOnTrial,
        tier: actualTier,
        trialChosenTier: devotionalGating.subscription?.trial_chosen_tier || 'spark',
        devotionalsLimit: devotionalGating.subscription?.devotionals_limit || 0,
        trialEndDate: devotionalGating.subscription?.trial_end_date || null,
      });

      setShowUsageLimitModal(true);
      return;
    }

    // Check if this duration is locked for current tier
    // Use 'onboarding' context only if explicitly in onboarding flow, otherwise use 'inApp'
    const accessCheck = devotionalGating.checkAccess(days, isOnboarding ? 'onboarding' : 'inApp');

    if (accessCheck.isLocked) {

      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from locked-duration gating', {
        component: 'DevotionalModal',
        context: 'duration_locked',
        tier: devotionalGating.tier,
        requestedDuration: days,
        isOnboarding,
      });

      onClose(); // Close the devotional modal first
      navigation.navigate('OnboardingSalesOffer' as any, {
        upgradeMode: true,
        currentTier: devotionalGating.tier,
        requestedDuration: days,
        skipNotificationPreference: true,
        featureType: 'devotionals',
      });
      return;
    }

    try {
      setSelectedDuration(days);
      setCreationError(null); // Reset error state

      if (onSelectDuration) {
        onSelectDuration(days);
        return;
      }

      // If no onSelectDuration provided, handle devotional creation here
      if (playbookId) {

        // Haptic feedback when generation starts (parity with playbook generation)
        try { triggerLightHaptic(); } catch {}
        // Show progress message for longer generations
        let progressTimeout: ReturnType<typeof setTimeout> | null = null;
        if (days >= 5) {
          progressTimeout = setTimeout(() => {

          }, 10000);
        }

        const devotional = await createDevotional({
          duration: days,
          playbookId,
          userInput: userInput || '', // Pass empty string if undefined
        });

        if (progressTimeout) {
          clearTimeout(progressTimeout);
        }

        if (devotional && onDevotionalCreated) {
          setIsSuccess(true);
          // Subtle haptic when success check appears
          try { triggerLightHaptic(); } catch {}
          Animated.timing(checkmarkAnim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }).start();
          // Simplified timing - single timeout to prevent navigation conflicts
          setTimeout(() => {
            handleClose(() => {
              // Navigate only after the modal has fully closed
              // Add small delay to ensure React Query updates have settled
              setTimeout(() => {
                onDevotionalCreated(devotional.id);
                // Reset animation state after navigation
                setIsSuccess(false);
                checkmarkAnim.setValue(0);
              }, 100);
            });
          }, 630); // Combined delay: 280ms animation + 350ms buffer
        }
      }
    } catch (err) {
      // Convert technical errors to user-friendly messages
      const error = err as Error;
      const userFriendlyError = error.message?.includes('Circuit breaker is OPEN') ||
                                error.message?.includes('experiencing high demand')
        ? new Error('We\'re experiencing high demand right now. Please try again in a few moments.')
        : error;

      setCreationError(userFriendlyError);
      Logger.error('[DevotionalModal] Error creating devotional', error, { component: 'DevotionalModal' });
      Logger.error('[DevotionalModal] Error details', undefined, {
        component: 'DevotionalModal',
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
  };

  const handleClose = (afterClose?: () => void) => {
    // Calculate the distance to slide down (full screen height + modal height + some extra)
    const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

    // Fade out backdrop quickly while sliding down
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200, // Fade aligned with slide
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: slideDownDistance,
        duration: 300, // Clear, perceivable slide down
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        // Reset animations for next open
        translateY.setValue(SCREEN_HEIGHT);
        progressAnim.setValue(0); // Reset progress bar to 0
        setCurrentStep(0); // Reset step counter
        // Invoke optional callback after close completes
        if (afterClose) { afterClose(); }
      }
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (!isVisible && !visible) {return null;}

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { triggerLightHaptic(); handleClose(); }}
          />
        </Animated.View>
        <Animated.View
          ref={contentRef}
          style={[
            styles.modalContainer,
            // On small phones, allow the modal to occupy slightly more vertical space so the footer stays visible
            isSmallPhone && styles.modalContainerSmallPhone,
            { transform: [{ translateY }] },
          ]}
          onLayout={measureContent}
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { triggerLightHaptic(); handleClose(); }}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentWrapper}>
            <View style={styles.fixedContent}>
              <ThemedText weight="semiBold" style={styles.title}>Create Your Personalized Devotional</ThemedText>
              <View style={styles.subtitleContainer}>
                <ThemedText weight="regular" style={styles.subtitle}>
                  Based on what you've shared, we'll craft a devotional tailored to your journey.
                </ThemedText>
              </View>
            </View>

            <View style={styles.scrollableContent}>
              {(playbookInfo || userInput) && (
                <View style={styles.playbookInfoContainer}>
                  <TouchableOpacity
                    style={styles.playbookInfoHeader}
                    onPress={() => { triggerLightHaptic(); togglePlaybookInfo(); }}
                    activeOpacity={0.8}
                  >
                    <ThemedText weight="semiBold" style={styles.playbookInfoLabel}>WHAT YOU SHARED</ThemedText>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={Colors.hopeWhite}
                      />
                    </Animated.View>
                  </TouchableOpacity>

                  <View style={[
                    styles.playbookInfoContent,
                    showPlaybookInfo ? styles.playbookInfoContentExpanded : styles.playbookInfoContentCollapsed,
                  ]}>
                    <ThemedText weight="regular" style={styles.playbookInfoText}>{userInput || playbookInfo}</ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.optionsContainer}>
                {!(isCreating || isSuccess) && (
                  <ThemedText weight="semiBold" style={styles.durationPrompt}>Select a devotional duration:</ThemedText>
                )}
                {(isCreating || isSuccess) ? (
    <View style={styles.generatingContainer}>
      {!isSuccess ? (
        <>
          <View style={styles.generationTitleRow}>
            <MaterialCommunityIcons name="book" size={24} color={Colors.hopeWhite} style={styles.generationTitleIcon} />
            <ThemedText weight="semiBold" style={styles.generationTitle}>
              {`Creating Your ${selectedDuration ? `${selectedDuration}-day` : ''}${selectedDuration ? ' ' : ''}Devotional`}
            </ThemedText>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.stepRow}>
            <Animated.View style={{ opacity: shimmerOpacity }}>
              <ThemedText weight="regular" style={[styles.currentStepText, styles.stepTextNoPadding]}>
                {baseTitle}
              </ThemedText>
            </Animated.View>
            <View style={[styles.dotsContainer, dotsWidth ? { width: dotsWidth } : null]}>
              <ThemedText weight="regular" style={[styles.currentStepText, styles.stepTextNoPadding]}>
                {'.'.repeat(dotCount)}
              </ThemedText>
            </View>
            {dotsWidth == null && (
              <ThemedText
                weight="regular"
                style={[styles.currentStepText, styles.hiddenMeasure]}
                onLayout={(e) => setDotsWidth(e.nativeEvent.layout.width)}
              >
                ...
              </ThemedText>
            )}
          </View>
        </>
      ) : (
        <>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                opacity: checkmarkAnim,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={64} color={Colors.growthGreen}/>
          </Animated.View>
          <ThemedText weight="semiBold" style={styles.loadingText}>Devotional Created!</ThemedText>
        </>
      )}
    </View>
  ) : creationError ? (
    <View style={styles.errorContainer}>
      <ThemedText weight="semiBold" style={styles.errorText}>{creationError?.message || 'An error occurred'}</ThemedText>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => {
          setCreationError(null);
          handleClose();
        }}
      >
        <ThemedText weight="semiBold" style={styles.retryButtonText}>Try Again</ThemedText>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.optionsContainer}>
                {DURATION_OPTIONS.map((option) => {
                  const accessCheck = devotionalGating.checkAccess(option.days, isOnboarding ? 'onboarding' : 'inApp');
                  const isLocked = accessCheck.isLocked;

                  return (
                    <TouchableOpacity
                      key={option.days}
                      style={[
                        styles.optionButton,
                        isLocked && styles.optionButtonLocked,
                      ]}
                      onPress={() => {
                        if (isOnboarding && isLocked) {
                          // In onboarding, locked durations should not be tappable
                          return;
                        }
                        triggerLightHaptic();
                        handleSelectDuration(option.days);
                      }}
                      disabled={isCreating || (isOnboarding && isLocked)}
                      activeOpacity={isLocked ? 0.6 : 0.8}
                    >
                      <View style={styles.optionHeader}>
                        <View style={styles.optionLeftContent}>
                          <ThemedText weight="semiBold" style={[
                            styles.optionDays,
                            isLocked && styles.optionTextLocked,
                          ]}>
                            {option.days} DAY
                          </ThemedText>
                          <ThemedText weight="semiBold" style={[
                            styles.optionTitle,
                            isLocked && styles.optionTextLocked,
                          ]}>
                            {option.title}
                          </ThemedText>
                        </View>

                        {/* Lock Icon */}
                        <DevotionalLockIcon
                          tier={devotionalGating.tier}
                          duration={option.days}
                          context={isOnboarding ? 'onboarding' : 'inApp'}
                          onLockTap={() => {
                            if (isOnboarding) {
                              // In onboarding, lock icon should not trigger sales offer
                              return;
                            }
                            Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from lock icon tap', {
                              component: 'DevotionalModal',
                              context: 'lock_icon',
                              tier: devotionalGating.tier,
                              requestedDuration: option.days,
                              isOnboarding,
                            });

                            onClose();
                            navigation.navigate('OnboardingSalesOffer' as any, {
                              upgradeMode: true,
                              currentTier: devotionalGating.tier,
                              requestedDuration: option.days,
                              featureType: 'devotionals',
                              skipNotificationPreference: true,
                            });
                          }}
                          size={20}
                        />
                      </View>

                      <ThemedText weight="regular" style={[
                        styles.optionDescription,
                        isLocked && styles.optionTextLocked,
                      ]}>
                        {option.description}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
  )}
  {/* Continue My Journey button for onboarding */}
  {isOnboarding && !(isCreating || isSuccess) && (
    <TouchableOpacity
      style={styles.continueJourneyButton}
      onPress={() => {
        try { triggerLightHaptic(); } catch {}
        Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from Continue My Journey (onboarding)', {
          component: 'DevotionalModal',
          context: 'continue_journey',
        });
        handleClose(() => {
          navigation.navigate('OnboardingSalesOffer' as any, {
            onboardingFlow: true,
            featureType: 'devotionals',
          });
        });
      }}
      activeOpacity={0.85}
    >
      <ThemedText weight="semiBold" style={styles.continueJourneyButtonText}>Continue My Journey</ThemedText>
    </TouchableOpacity>
  )}
  {/* Usage Badges moved near footer and centered (hidden during onboarding) */}
  {!isOnboarding && ((devotionalGating.subscription?.tier || devotionalGating.tier) !== 'transformation') && (
    // POST-LAUNCH: && ((devotionalGating.subscription?.tier || devotionalGating.tier) !== 'family')
    <View style={styles.badgeRow}>
      <View style={styles.tierBadgeContainer}>
        <ThemedText weight="semiBold" style={styles.tierBadgeText}>
          {devotionalGating.subscription?.subscription_display_name || `siFia ${devotionalGating.tier.charAt(0).toUpperCase() + devotionalGating.tier.slice(1)}`}
        </ThemedText>
      </View>
      {devotionalGating.tier === 'seeker' ? (
        <TouchableOpacity
          style={styles.countBadgeContainer}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from seeker badge tap', {
              component: 'DevotionalModal',
              context: 'seeker_badge',
              tier: devotionalGating.tier,
            });
            handleClose(() => {
              navigation.navigate('OnboardingSalesOffer' as any, {
                upgradeMode: true,
                currentTier: devotionalGating.tier,
                featureType: 'devotionals',
                skipNotificationPreference: true,
              });
            });
          }}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <ThemedText weight="semiBold" style={styles.countBadgeText}>
            {devotionalGating.usageInfo.displayMessage}
          </ThemedText>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.countBadgeContainer}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setTooltipVisible(true);
          }}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <ThemedText weight="semiBold" style={styles.countBadgeText}>
            {devotionalGating.usageInfo.displayMessage}
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  )}
  <ThemedText weight="regular" style={styles.footerText}>
    God's Word is a lamp to your feet and a light to your path.{'\n'}Let this devotional help you walk closer with Him.
  </ThemedText>
</View>
            </View>
          </View>
        </Animated.View>

        {/* Usage Tooltip Modal */}
        <UsageTooltipModal
          visible={tooltipVisible}
          onClose={() => setTooltipVisible(false)}
          type="devotionals"
          subscription={devotionalGating.subscription}
          usage={{
            playbooks: { used: 0, limit: 0 },
            devotionals: {
              used: devotionalGating.subscription?.devotionals_used || 0,
              limit: devotionalGating.subscription?.devotionals_limit || 0,
            },
          }}
          stats={null}
        />

        {/* Usage Limit Modal */}
        {showUsageLimitModal && usageLimitModalData && (
          <Modal
            visible={showUsageLimitModal}
            transparent
            animationType="none"
            onRequestClose={() => {
              setShowUsageLimitModal(false);
              setUsageLimitModalData(null);
            }}
          >
            <View style={styles.usageLimitOverlay}>
              <View style={styles.usageLimitContainer}>
                <View style={styles.usageLimitHeader}>
                  <MaterialCommunityIcons name="book" size={32} color={Colors.alertCoral} />
                  <ThemedText weight="bold" style={styles.usageLimitTitle}>
                    {(() => {
                      const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData;
                      const salesCopy = generateSalesCopy({
                        featureType: 'devotionals',
                        currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                        remaining: 0,
                        limit: devotionalsLimit,
                        isOnTrial,
                        trialChosenTier: trialChosenTier as any,
                        trialEndDate,
                        subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                      });
                      return salesCopy.title;
                    })()}
                  </ThemedText>
                </View>

                <ThemedText weight="regular" style={styles.usageLimitMessage}>
                  {(() => {
                    const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData;
                    const salesCopy = generateSalesCopy({
                      featureType: 'devotionals',
                      currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                      remaining: 0,
                      limit: devotionalsLimit,
                      isOnTrial,
                      trialChosenTier: trialChosenTier as any,
                      trialEndDate,
                      subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                    });
                    return salesCopy.message;
                  })()}
                </ThemedText>

                {(() => {
                  const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData || {
                    isOnTrial: false,
                    tier: 'spark',
                    trialChosenTier: 'spark',
                    devotionalsLimit: 0,
                    trialEndDate: null,
                  };

                  const salesCopy = generateSalesCopy({
                    featureType: 'devotionals',
                    currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                    remaining: 0,
                    limit: devotionalsLimit,
                    isOnTrial,
                    trialChosenTier: trialChosenTier as any,
                    trialEndDate,
                    subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                  });

                  const isUnlimitedTrial = isOnTrial && (trialChosenTier === 'transformation');
                  if (isUnlimitedTrial) {
                    // Show a single dismiss button so the user can close the popup
                    return (
                      <View style={styles.usageLimitButtons}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => {
                            setShowUsageLimitModal(false);
                            setUsageLimitModalData(null);
                          }}
                        >
                          <ThemedText weight="semiBold" style={styles.cancelButtonText}>
                            {salesCopy.primaryCta}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                <View style={styles.usageLimitButtons}>
                  <TouchableOpacity
                    style={styles.upgradeButtonFull}
                    onPress={() => {
                      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from usage limit modal primary CTA', {
                        component: 'DevotionalModal',
                        context: 'usage_limit_modal_primary',
                        tier,
                        isOnTrial,
                        recommendedTier: salesCopy.recommendedTier,
                      });

                      setShowUsageLimitModal(false);
                      setUsageLimitModalData(null);
                      onClose();
                      navigation.navigate('OnboardingSalesOffer' as any, {
                        upgradeMode: true,
                        currentTier: tier || 'spark',
                        selectedTier: salesCopy.recommendedTier,
                        skipNotificationPreference: true,
                        featureType: 'devotionals', // Explicitly mark this as devotional upgrade
                      });
                    }}
                  >
                    <ThemedText weight="semiBold" style={styles.upgradeButtonText}>
                      {salesCopy.primaryCta}
                    </ThemedText>
                  </TouchableOpacity>
                  {salesCopy.secondaryCta && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowUsageLimitModal(false);
                        setUsageLimitModalData(null);
                      }}
                    >
                      <ThemedText weight="semiBold" style={styles.cancelButtonText}>
                        {salesCopy.secondaryCta}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                  );
                })()}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  checkmarkContainer: {
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40, // Increased bottom padding for better spacing
    maxHeight: '85%',
    minHeight: 300, // Ensure minimum height for smooth animation
    borderWidth: 0, // Remove modal border
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    left: 0,
    right: 0,
  },
  modalContainerSmallPhone: {
    maxHeight: '92%',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 0,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 0,
    marginTop: 0,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: 10,
    width: '100%',
    flexShrink: 1,
    includeFontPadding: false,
    alignSelf: 'center',
    maxWidth: '100%',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  subtitleContainer: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 0,
    lineHeight: 24,
  },
  durationPrompt: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 4, // Reduced from 12px to 4px
    paddingHorizontal: 4,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16, // adjusted to 16 radius for duration choices
    padding: 10,
    borderWidth: 0, // remove border
    borderColor: 'transparent',
  },
  optionButtonLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.7,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionLeftContent: {
    flex: 1,
  },
  optionTextLocked: {
    opacity: 0.6,
  },
  // New: split usage badges row (left-aligned)
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  tierBadgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tierBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    includeFontPadding: false,
  },
  countBadgeContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  countBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    includeFontPadding: false,
  },
  usageCounterContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  usageCounterText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    textAlign: 'center',
    includeFontPadding: false,
  },
  optionDays: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  optionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  playbookInfoContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0, // remove border
    borderColor: 'transparent',
  },
  playbookInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playbookInfoLabel: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1,
    opacity: 1,
    marginVertical: 2,
    textTransform: 'uppercase',
  },
  fixedContent: {
    width: '100%',
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scrollableContent: {
    flex: 1,
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  playbookInfoContent: {
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  playbookInfoContentExpanded: {
    maxHeight: 1000, // Arbitrarily large value to allow content to expand
    paddingBottom: 12,
  },
  playbookInfoContentCollapsed: {
    maxHeight: 0,
    paddingBottom: 0,
  },
  playbookInfoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30, // increased to 30px per design request
    borderWidth: 0, // No border
    borderColor: 'transparent',
    marginVertical: 10,
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  generationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  generationTitleRow: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generationTitleIcon: {
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '80%',
    marginBottom: 18,
  },
  progressBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStepText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
    includeFontPadding: false,
  },
  dotsContainer: {
    marginLeft: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: undefined as unknown as number,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
    marginVertical: 10,
  },
  errorText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  retryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  stepTextNoPadding: {
    paddingHorizontal: 0,
  },
  // Usage Limit Modal Styles
  usageLimitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  usageLimitContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  usageLimitHeader: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  usageLimitTitle: {
    fontSize: 22,
    color: Colors.hopeWhite,
    marginTop: 12,
    textAlign: 'center',
  },
  usageLimitMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 24,
  },
  usageLimitButtons: {
    gap: 12,
  },
  continueJourneyButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  continueJourneyButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  upgradeButtonFull: {
    backgroundColor: Colors.alertCoral,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default DevotionalModal;
