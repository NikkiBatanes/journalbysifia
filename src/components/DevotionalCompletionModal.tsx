import React, { useState, useEffect, useRef, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Dimensions,
  Animated,
  Easing,
  NativeModules,
} from 'react-native';
import { Colors } from '../theme';
import { OnboardingStyles } from '../theme/onboardingStyles';
import ThemedText from './common/ThemedText';
import AnimatedPointsNotification from './ui/AnimatedPointsNotification';
import { faithPointsService } from '../services/faithPointsService';

import { Devotional } from '../interfaces/devotional';
import { extractCleanTitle } from '../utils/titleUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Lightweight haptic helpers (no-op if module not linked)
const triggerLightHaptic = () => {
  try {
    const { RNHapticFeedback } = NativeModules as any;
    if (!RNHapticFeedback) {return;}

    const Haptic = require('react-native-haptic-feedback');
    const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
    if (typeof triggerFn === 'function') {
      triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    }
  } catch {}
};

const triggerSuccessHaptic = () => {
  try {
    const { RNHapticFeedback } = NativeModules as any;
    if (!RNHapticFeedback) {return;}

    const Haptic = require('react-native-haptic-feedback');
    const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
    if (typeof triggerFn === 'function') {
      triggerFn('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    }
  } catch {}
};

interface DevotionalCompletionModalProps {
  visible: boolean;
  devotional: Devotional;
  currentDayNumber: number;
  completedDays: number;
  onContinue: () => void;
  onClose: () => void;
  onRatingSubmit: (rating: number) => Promise<void>;
  onCheckReveal?: () => void; // Called when the checkmark reveal animation completes
}

const DevotionalCompletionModal: React.FC<DevotionalCompletionModalProps> = ({
  visible,
  devotional,
  currentDayNumber,
  completedDays: propCompletedDays,
  onContinue,
  onClose,
  onRatingSubmit,
  onCheckReveal,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const [rating, setRating] = useState(0);
  const [showLocalPoints, setShowLocalPoints] = useState(false);
  const [localPoints, setLocalPoints] = useState<number>(0);
  const pointsShownRef = useRef(false);

  // Memoize the animation complete callback to prevent re-renders
  const handleAnimationComplete = useCallback(() => {
    console.log('[DevotionalCompletionModal] Animation completed, hiding local points');
    setShowLocalPoints(false);
    animationKeyRef.current = null;
  }, []);

  // Simple celebratory burst particles
  type BurstParticle = {
    id: number;
    progress: Animated.Value; // 0 -> 1
    dx: number; // horizontal drift
    dy: number; // vertical rise
    size: number; // icon size
    rotate: number; // degrees
    color: string;
    delay: number;
  };
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const burstIdRef = useRef(0);

  const startBurst = useCallback((count = 8) => {
    const colors = [Colors.growthGreen, '#6bd16b', '#8de98d'];
    const particles: BurstParticle[] = Array.from({ length: count }).map((_, i) => {
      const id = burstIdRef.current++;
      return {
        id,
        progress: new Animated.Value(0),
        dx: (Math.random() * 140 - 70), // -70..70
        dy: 60 + Math.random() * 80,    // 60..140 upward
        size: 10 + Math.random() * 8,   // 10..18
        rotate: Math.random() * 90 - 45, // -45..45 deg
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 20, // Reduced stagger delay
      };
    });

    setBurstParticles(prev => [...prev, ...particles]);

    particles.forEach((p) => {
      Animated.timing(p.progress, {
        toValue: 1,
        duration: 700, // Reduced from 900ms
        delay: p.delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease), // Simpler easing
      }).start();
    });

    // Haptic pattern aligned with the burst: 4 light taps spaced across the burst duration
    const pulses = 4;
    const step = Math.max(1, Math.floor(particles.length / pulses));
    for (let i = 0; i < pulses; i++) {
      const idx = Math.min(particles.length - 1, i * step);
      const delay = particles[idx]?.delay || i * 80;
      setTimeout(() => {
        triggerLightHaptic();
      }, delay);
    }

    // Cleanup after the burst completes
    setTimeout(() => {
      setBurstParticles(prev => prev.filter(h => !particles.find(n => n.id === h.id)));
    }, 1000); // Reduced cleanup delay
  }, []);

  const isLastDay = devotional &&
    currentDayNumber === devotional.totalDays;

  const completedDays = propCompletedDays;
  const totalDays = devotional?.totalDays || 0;
  const progress = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
  // Guard to avoid re-running the full open sequence while visible stays true
  const hasOpenedRef = useRef(false);
  const lastVisibleState = useRef(false);
  const animationKeyRef = useRef<string | null>(null);

  // Run the slide-in and initial animations only when visibility changes to true
  useEffect(() => {
    console.log('[DevotionalCompletionModal] useEffect triggered:', {
      visible,
      hasOpened: hasOpenedRef.current,
      pointsShown: pointsShownRef.current,
      lastVisible: lastVisibleState.current,
      progress,
      devotionalTitle: devotional?.title,
      currentDayNumber,
    });

    // CRITICAL: Only run animations when visibility changes from false to true
    if (visible && !lastVisibleState.current && !hasOpenedRef.current) {
      console.log('[DevotionalCompletionModal] Starting modal open sequence - VISIBILITY CHANGED TO TRUE');
      hasOpenedRef.current = true;
      lastVisibleState.current = true;

      // Reset and run slide-in
      slideAnim.setValue(SCREEN_HEIGHT);
      backdropAnim.setValue(0);
      checkAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();

      // Kick off initial progress animation shortly after opening (snappier)
      setTimeout(() => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 300, // Faster
          useNativeDriver: false, // Cannot use native driver for width animations
          easing: Easing.out(Easing.quad),
        }).start();
      }, 80); // Minimal delay

      // Checkmark reveal sequence (earlier)
      setTimeout(() => {
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 260, // Slightly faster
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.2)), // Smoother than bounce
        }).start(() => {
          // Subtle success haptic when check appears
          triggerSuccessHaptic();
          // Fire celebratory burst when checkmark appears
          startBurst(8); // Reduced particle count from 12 to 8
          // Show local FP notification above this modal content for guaranteed visibility
          // Only show once per modal open to prevent flashing
          if (!pointsShownRef.current) {
            console.log('[DevotionalCompletionModal] Showing local points animation');
            pointsShownRef.current = true;
            try {
              // Use different activity type based on whether this is the last day
              const activityType = isLastDay ? 'devotional_full_completed' : 'devotional_completed';
              const pts = faithPointsService.getPointsForActivity(activityType as any);
              console.log('[DevotionalCompletionModal] Local points:', { activityType, pts, isLastDay });
              setLocalPoints(pts);

              // Set unique animation key to prevent re-renders
              animationKeyRef.current = `${devotional?.id}-${currentDayNumber}-${Date.now()}`;

              // Delay showing points slightly to ensure modal is fully visible
              setTimeout(() => {
                console.log('[DevotionalCompletionModal] Setting showLocalPoints to true');
                setShowLocalPoints(true);
              }, 100);
            } catch (e) {
              console.error('[DevotionalCompletionModal] Error showing points:', e);
            }
          } else {
            console.log('[DevotionalCompletionModal] Points already shown, skipping');
          }
          // Notify parent that check reveal completed

          try { onCheckReveal && onCheckReveal(); } catch {}
        });
      }, 500); // Faster reveal
    } else if (visible && hasOpenedRef.current) {
      console.log('[DevotionalCompletionModal] Modal already opened, skipping re-animation');
    } else if (!visible && lastVisibleState.current) {
      console.log('[DevotionalCompletionModal] Modal closing, resetting state');
      // Allow animations to run again next time it's opened
      hasOpenedRef.current = false;
      pointsShownRef.current = false;
      lastVisibleState.current = false;
      animationKeyRef.current = null;
      setShowLocalPoints(false);
    }
  }, [visible, backdropAnim, slideAnim, checkAnim, progressAnim, startBurst, onCheckReveal, devotional, currentDayNumber, isLastDay, progress]); // All animation dependencies
  //   Animated.timing(progressAnim, {
  //     toValue: progress,
  //     duration: 500,
  //     useNativeDriver: false,
  //     easing: Easing.out(Easing.ease),
  //   }).start();
  // }, [progress, visible, progressAnim]);

  const handleClose = useCallback(() => {
    // Haptic on close action
    triggerLightHaptic();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => {
      onClose();
      setRating(0);
      setShowLocalPoints(false);
      pointsShownRef.current = false;
    });
  }, [onClose, slideAnim, backdropAnim]);

  const handleStarPress = useCallback((index: number) => {
    const selectedRating = index + 1;
    // Update the UI state immediately
    triggerLightHaptic();
    setRating(selectedRating);
    // Submit the rating in the background
    onRatingSubmit(selectedRating).catch(console.error);
  }, [onRatingSubmit]);

  const renderStars = () => {
    return (
      <View style={styles.starsRow}>
        {Array(5).fill(0).map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleStarPress(index)}
            style={styles.starButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={index < rating ? 'star' : 'star-outline'}
              size={24}
              color={Colors.faithGold}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const checkOpacity = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Get the current day's data
  const currentDay = devotional.days.find(day => day.dayNumber === currentDayNumber);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropAnim },
            ]}
          />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {isLastDay ? (
              <>
                <ThemedText weight="bold" style={styles.congratsTitle}>
                  Congratulations!
                </ThemedText>
                <ThemedText weight="regular" style={styles.congratsSubtitle}>
                  You've completed the entire devotional!
                </ThemedText>
                {devotional.title && (
                  <View style={styles.titleContainer}>
                    <ThemedText weight="semiBold" style={styles.devotionalTitle} numberOfLines={2}>
                      {extractCleanTitle(devotional.title)}
                    </ThemedText>
                  </View>
                )}
                <Animated.View
                  style={[
                    styles.checkContainer,
                    {
                      opacity: checkOpacity,
                      transform: [{ scale: checkScale }],
                    },
                  ]}
                >
                  {burstParticles.length > 0 && (
                    <View pointerEvents="none" style={styles.burstLayer}>
                      {burstParticles.map((p) => {
                        const translateY = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -p.dy],
                        });
                        const translateX = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, p.dx],
                        });
                        const scale = p.progress.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0.4, 1.1, 0.8],
                        });
                        const opacity = p.progress.interpolate({
                          inputRange: [0, 0.6, 1],
                          outputRange: [0, 1, 0],
                        });
                        // Compute particle container style to avoid inline styles
                        const particleContainerStyle = {
                          width: p.size + 10,
                          height: p.size + 10,
                          borderRadius: (p.size + 10) / 2,
                          backgroundColor: Colors.growthGreen,
                          alignItems: 'center' as const,
                          justifyContent: 'center' as const,
                        };
                        return (
                          <Animated.View
                            key={p.id}
                            style={[
                              styles.burstParticle,
                              {
                                opacity,
                                transform: [
                                  { translateX },
                                  { translateY },
                                  { scale },
                                  { rotate: `${p.rotate}deg` },
                                ],
                              },
                            ]}
                          >
                            <View style={particleContainerStyle}>
                              <Ionicons name="checkmark" size={p.size} color={Colors.hopeWhite} />
                            </View>
                          </Animated.View>
                        );
                      })}
                    </View>
                  )}
                  <Ionicons
                    name="checkmark-circle"
                    size={80}
                    color={Colors.growthGreen}
                  />
                </Animated.View>

                <ThemedText weight="semiBold" style={styles.dayIndicator}>
                  {completedDays}/{totalDays} {completedDays === 1 ? 'Day' : 'Days'} Completed
                </ThemedText>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBackground}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        { width: progressWidth },
                      ]}
                    />
                  </View>
                </View>

                <ThemedText weight="regular" style={styles.ratingTitle}>
                  How would you rate this devotional?
                </ThemedText>

                <View style={styles.starsContainer}>
                  {renderStars()}
                </View>
              </>
            ) : (
              <>
                {devotional.totalDays > 1 && (
                  <ThemedText weight="semiBold" style={styles.dayIndicator}>
                    Day {currentDayNumber} of {totalDays}
                  </ThemedText>
                )}
                <View style={styles.titleContainer}>
                  <ThemedText weight="semiBold" style={styles.devotionalTitle}>
                    {devotional.totalDays > 1 && currentDay
                      ? `${extractCleanTitle(devotional.title)}: ${currentDay.title}`
                      : extractCleanTitle(devotional.title)}
                  </ThemedText>
                </View>
                <ThemedText weight="bold" style={styles.completedText}>
                  COMPLETED!
                </ThemedText>

                <Animated.View
                  style={[
                    styles.checkContainer,
                    {
                      opacity: checkOpacity,
                      transform: [{ scale: checkScale }],
                    },
                  ]}
                >
                  {burstParticles.length > 0 && (
                    <View pointerEvents="none" style={styles.burstLayer}>
                      {burstParticles.map((p) => {
                        const translateY = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -p.dy],
                        });
                        const translateX = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, p.dx],
                        });
                        const scale = p.progress.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0.4, 1.1, 0.8],
                        });
                        const opacity = p.progress.interpolate({
                          inputRange: [0, 0.6, 1],
                          outputRange: [0, 1, 0],
                        });
                        // Compute particle container style to avoid inline styles
                        const particleContainerStyle = {
                          width: p.size + 10,
                          height: p.size + 10,
                          borderRadius: (p.size + 10) / 2,
                          backgroundColor: Colors.growthGreen,
                          alignItems: 'center' as const,
                          justifyContent: 'center' as const,
                        };
                        return (
                          <Animated.View
                            key={p.id}
                            style={[
                              styles.burstParticle,
                              {
                                opacity,
                                transform: [
                                  { translateX },
                                  { translateY },
                                  { scale },
                                  { rotate: `${p.rotate}deg` },
                                ],
                              },
                            ]}
                          >
                            <View style={particleContainerStyle}>
                              <Ionicons name="checkmark" size={p.size} color={Colors.hopeWhite} />
                            </View>
                          </Animated.View>
                        );
                      })}
                    </View>
                  )}
                  <Ionicons
                    name="checkmark-circle"
                    size={80}
                    color={Colors.growthGreen}
                  />
                </Animated.View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBackground}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        { width: progressWidth },
                      ]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[OnboardingStyles.primaryButton, styles.continueButtonOverride]}
                  onPress={() => { triggerLightHaptic(); onContinue(); }}
                >
                  <ThemedText weight="semiBold" style={OnboardingStyles.primaryButtonText}>
                    Continue to Next Day
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
        {showLocalPoints && animationKeyRef.current && (
          <View pointerEvents="none" style={styles.localPointsOverlay}>
            <AnimatedPointsNotification
              key={animationKeyRef.current}
              points={localPoints}
              activityType={isLastDay ? 'devotional_full_completed' : 'devotional_completed'}
              position={'center'}
              visible={true}
              onAnimationComplete={handleAnimationComplete}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    opacity: 0,
  },
  backdropVisible: {
    opacity: 1,
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 10,
    paddingBottom: 40,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20, // Added top padding to push content down
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dayTitle: {
    fontSize: 24,
    color: Colors.text,
    marginTop: 20,
  },
  completedText: {
    fontSize: 18,
    color: Colors.growthGreen,
    marginTop: 16, // Increased top margin for more spacing
    marginBottom: 8, // Added bottom margin for more spacing
    letterSpacing: 0.5,
  },
  congratsTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginTop: 24,
    marginBottom: 4,
    lineHeight: 34,
    textAlign: 'center',
  },
  congratsSubtitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginTop: 0,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  checkContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstParticle: {
    position: 'absolute',
  },
  progressContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 30,
  },
  progressBackground: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 18,
    color: Colors.anchorBlue,
    marginTop: 16,
  },
  dayIndicator: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 16,
    opacity: 0.9,
  },
  devotionalTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 22,
  },
  titleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24, // Increased top margin for more spacing
    marginBottom: 24, // Increased bottom margin for more spacing
    width: '100%',
    alignSelf: 'center',
  },
  continueButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  localPointsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999999,
    elevation: 999999999,
    pointerEvents: 'none',
  },
  ratingTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginTop: 10,
    marginBottom: 0,
    lineHeight: 22,
    opacity: 0.9,
    textAlign: 'center',
  },
  starsContainer: {
    marginVertical: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starButton: {
    padding: 6,
    borderRadius: 12,
  },
  starIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  submitButton: {
    backgroundColor: Colors.faithGold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  continueButtonOverride: {
    width: '100%',
    marginTop: 30,
  },
});

export default DevotionalCompletionModal;
