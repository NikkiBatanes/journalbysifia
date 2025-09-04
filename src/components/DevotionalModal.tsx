import React, { useState, useRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Dimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';

import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { useAuth } from '../context/IndustryStandardAuthContext';

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
}

const DevotionalModal: React.FC<DevotionalModalProps> = ({
  visible,
  onClose,
  onSelectDuration,
  playbookInfo,
  playbookId,
  userInput,
  onDevotionalCreated,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const { user } = useAuth();
  const { createDevotional, isCreating, error } = useDevotionalOperations(user?.id || '');
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isVisible, setIsVisible] = useState(false);
  const [showPlaybookInfo, setShowPlaybookInfo] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [ellipsis, setEllipsis] = useState('');
  const contentRef = React.useRef<View>(null);
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

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

  // Generating UI state (progress bar, shimmering step text, animated dots)
  const progressAnim = React.useRef(new Animated.Value(0)).current; // 0..100
  const shimmerOpacity = React.useRef(new Animated.Value(0.85)).current;
  const [dotCount, setDotCount] = useState(0);
  const [dotsWidth, setDotsWidth] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const generationSteps = React.useMemo(() => ([
    { title: 'Centering your heart…', description: '' },
    { title: "Listening to your story…", description: '' },
    { title: "Finding Scripture for each day…", description: '' },
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
    }
  }, [visible]);

  React.useEffect(() => {
    console.log('[DevotionalModal] State changed:', { isCreating, error: !!error, isSuccess, selectedDuration });
  }, [isCreating, error, isSuccess, selectedDuration]);
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
        if (finished && mounted && isCreating && !isSuccess) loop();
      });
    };
    if (isCreating && !isSuccess) loop();
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
          try { triggerLightHaptic(); } catch {}
        }
        return isLast ? prev : nextStep;
      });
    }, 3000);
    return () => clearInterval(stepInterval);
  }, [isCreating, isSuccess, generationSteps.length, progressAnim]);

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
  }, [visible, contentHeight, fadeAnim, translateY]);

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
    console.log('[DevotionalModal] Button pressed for duration:', days);
    console.log('[DevotionalModal] Current props:', { playbookId, userInput, onSelectDuration });
    console.log('[DevotionalModal] User ID:', user?.id);

    try {
      setSelectedDuration(days);

      if (onSelectDuration) {
        onSelectDuration(days);
        return;
      }

      // If no onSelectDuration provided, handle devotional creation here
      if (playbookId && userInput) {
        console.log('[DevotionalModal] Creating devotional with params:', { duration: days, playbookId, userInput });
        // Haptic feedback when generation starts (parity with playbook generation)
        try { triggerLightHaptic(); } catch {}
        const devotional = await createDevotional({
          duration: days,
          playbookId,
          userInput,
        });
        console.log('[DevotionalModal] Devotional created:', devotional);

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
      console.error('[DevotionalModal] Error creating devotional:', err);
      console.error('[DevotionalModal] Error details:', {
        message: (err as any)?.message,
        stack: (err as any)?.stack,
        name: (err as any)?.name,
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
        // Reset translateY for next open
        translateY.setValue(SCREEN_HEIGHT);
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
              <ThemedText weight="regular" style={[styles.currentStepText, { paddingHorizontal: 0 }]}>
                {baseTitle}
              </ThemedText>
            </Animated.View>
            <View style={[styles.dotsContainer, dotsWidth ? { width: dotsWidth } : null]}>
              <ThemedText weight="regular" style={[styles.currentStepText, { paddingHorizontal: 0 }]}>
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
  ) : error ? (
    <View style={styles.errorContainer}>
      <ThemedText weight="semiBold" style={styles.errorText}>{error?.message || 'An error occurred'}</ThemedText>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => handleClose()}
      >
        <ThemedText weight="semiBold" style={styles.retryButtonText}>Try Again</ThemedText>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.optionsContainer}>
      {DURATION_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.days}
          style={styles.optionButton}
          onPress={() => { triggerLightHaptic(); handleSelectDuration(option.days); }}
          disabled={isCreating}
        >
          <ThemedText weight="semiBold" style={styles.optionDays}>{option.days} DAY</ThemedText>
          <ThemedText weight="semiBold" style={styles.optionTitle}>{option.title}</ThemedText>
          <ThemedText weight="regular" style={styles.optionDescription}>
            {option.description}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  )}
  <ThemedText weight="regular" style={styles.footerText}>
    God's Word is a lamp to your feet and a light to your path.{'\n'}Let this devotional help you walk closer with Him.
  </ThemedText>
</View>
            </View>
          </View>
        </Animated.View>
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
    marginBottom: 12,
    marginTop: 12,
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
    borderRadius: 16, // adjusted to 16 radius
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
});

export default DevotionalModal;
