import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
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
import ThemedText from './common/ThemedText';

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
  userId?: string; // User ID for awarding points and badges
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
  userId,
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
  const starAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(1))).current;


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

  // Track timers for cleanup
  const burstTimersRef = useRef<NodeJS.Timeout[]>([]);

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

    // ✅ FIX: Use requestAnimationFrame to defer state updates outside animation callback
    requestAnimationFrame(() => {
      setBurstParticles(prev => [...prev, ...particles]);
    });

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
      const timer = setTimeout(() => {
        triggerLightHaptic();
      }, delay);
      burstTimersRef.current.push(timer);
    }

    // Cleanup after the burst completes
    const cleanupTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        setBurstParticles(prev => prev.filter(h => !particles.find(n => n.id === h.id)));
      });
    }, 1000); // Reduced cleanup delay
    burstTimersRef.current.push(cleanupTimer);
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

  // ✅ FIX: Use refs for stable references to avoid dependency issues
  const startBurstRef = useRef(startBurst);
  const onCheckRevealRef = useRef(onCheckReveal);
  const isLastDayRef = useRef(isLastDay);
  const currentDayNumberRef = useRef(currentDayNumber);
  const devotionalIdRef = useRef(devotional?.id);
  const userIdRef = useRef(userId);

  // Update refs when values change
  useEffect(() => {
    startBurstRef.current = startBurst;
    onCheckRevealRef.current = onCheckReveal;
    isLastDayRef.current = isLastDay;
    currentDayNumberRef.current = currentDayNumber;
    devotionalIdRef.current = devotional?.id;
    userIdRef.current = userId;
  });

  // Run the slide-in and initial animations only when visibility changes to true
  useEffect(() => {
    // ✅ FIX: Store timeout IDs for cleanup
    const timeouts: NodeJS.Timeout[] = [];

    // CRITICAL: Only run animations when visibility changes from false to true
    if (visible && !lastVisibleState.current && !hasOpenedRef.current) {

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
      timeouts.push(setTimeout(() => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 300, // Faster
          useNativeDriver: false, // Cannot use native driver for width animations
          easing: Easing.out(Easing.quad),
        }).start();
      }, 80)); // Minimal delay

      // Checkmark reveal sequence (earlier)
      timeouts.push(setTimeout(() => {
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 260, // Slightly faster
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.2)), // Smoother than bounce
        }).start(() => {
          // ✅ FIX: Use requestAnimationFrame to defer state updates
          requestAnimationFrame(() => {
            // Subtle success haptic when check appears
            triggerSuccessHaptic();
            // Fire celebratory burst when checkmark appears
            startBurstRef.current(8); // Reduced particle count from 12 to 8
            // Notify parent that check reveal completed
            try { onCheckRevealRef.current && onCheckRevealRef.current(); } catch {}
          });
        });
      }, 500)); // Faster reveal
    } else if (!visible && lastVisibleState.current) {

      // Allow animations to run again next time it's opened
      hasOpenedRef.current = false;
      lastVisibleState.current = false;
      animationKeyRef.current = null;
    }

    // ✅ FIX: Cleanup timeouts on unmount or when visibility changes
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [visible, progress, slideAnim, backdropAnim, checkAnim, progressAnim]); // ✅ FIX: Include animation refs (stable, won't cause re-renders)
  //   Animated.timing(progressAnim, {
  //     toValue: progress,
  //     duration: 500,
  //     useNativeDriver: false,
  //     easing: Easing.out(Easing.ease),
  //   }).start();
  // }, [progress, visible, progressAnim]);

  const handleClose = useCallback(() => {
    Logger.debug('[DevotionalCompletionModal] handleClose invoked', { component: 'DevotionalCompletionModal' });

    // CRITICAL: Clear all burst timers immediately to prevent state updates after unmount
    burstTimersRef.current.forEach(timer => clearTimeout(timer));
    burstTimersRef.current = [];

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
      Logger.debug('[DevotionalCompletionModal] handleClose animation complete - calling onClose', { component: 'DevotionalCompletionModal' });
      onClose();
      setRating(0);
    });
  }, [onClose, slideAnim, backdropAnim]);

  const handleStarPress = useCallback((index: number) => {
    Logger.debug('[DevotionalCompletionModal] handleStarPress', { component: 'DevotionalCompletionModal', index });
    const selectedRating = index + 1;
    // Update the UI state immediately
    triggerLightHaptic();
    setRating(selectedRating);

    // Trigger spring animation on the pressed star
    starAnims[index].setValue(0.8);
    Animated.spring(starAnims[index], {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Submit the rating in the background
    onRatingSubmit(selectedRating)
      .then(() => {
        Logger.debug('[DevotionalCompletionModal] Rating submitted successfully', { component: 'DevotionalCompletionModal', selectedRating });
      })
      .catch((e) => {
        Logger.error('[DevotionalCompletionModal] Rating submission failed', e as Error, { component: 'DevotionalCompletionModal' });
      });
  }, [onRatingSubmit, starAnims]);

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
            <Animated.View style={{ transform: [{ scale: starAnims[index] }] }}>
              <Ionicons
                name="sparkles"
                size={14}
                color={index < rating ? Colors.alertCoral : 'rgba(255, 107, 107, 0.3)'}
                style={styles.starIcon}
              />
            </Animated.View>
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
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.contentLimiter}>
            {isLastDay ? (
              <>
                <View style={styles.completionHeaderContainer}>
                  <View style={styles.stepLabelRow}>
                    <Ionicons name="flash" size={18} color={Colors.alertCoral} />
                    <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
                      You've completed
                    </ThemedText>
                  </View>
                  <ThemedText weight="bold" style={styles.completionTitle}>
                    {extractCleanTitle(devotional.title)}
                  </ThemedText>
                  <ThemedText style={styles.completionPlaybookLabel}>DEVOTIONAL</ThemedText>
                </View>

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
                <View style={styles.completionHeaderContainer}>
                  <View style={styles.stepLabelRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
                      Day {currentDayNumber} of {totalDays} Completed
                    </ThemedText>
                  </View>
                  <ThemedText weight="bold" style={styles.completionTitle}>
                    {devotional.totalDays > 1 && currentDay
                      ? currentDay.title
                      : extractCleanTitle(devotional.title)}
                  </ThemedText>
                  <ThemedText style={styles.completionPlaybookLabel}>DEVOTIONAL</ThemedText>
                </View>

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
                  style={styles.continueButton}
                  onPress={() => { triggerLightHaptic(); onContinue(); }}
                >
                  <ThemedText weight="semiBold" style={styles.continueButtonText}>
                    Continue to Next Day
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
            </View>
          </View>
        </Animated.View>
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 0,
    paddingBottom: 32,
    height: SCREEN_HEIGHT * 0.55,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 16,
    padding: 8,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Limits only the inner content width on larger screens (e.g., iPad)
  contentLimiter: {
    width: '100%',
    maxWidth: 640, // adjust as desired (e.g., 600-720)
    alignSelf: 'center',
  },
  dayTitle: {
    fontSize: 24,
    color: Colors.text,
    marginTop: 20,
  },
  completedText: {
    fontSize: 18,
    color: Colors.growthGreen,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
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
    marginTop: 10,
    marginBottom: 30,
    alignSelf: 'center',
  },
  progressBackground: {
    height: 6,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
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
    textAlign: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 13,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  continueButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  ratingTitle: {
    fontSize: 13,
    color: Colors.hopeWhite,
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
    opacity: 0.8,
    textAlign: 'center',
  },
  starsContainer: {
    marginVertical: 8,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completionHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stepLabelWhite: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.9,
    letterSpacing: 0.5,
  },
  completionTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 4,
    lineHeight: 34,
    textAlign: 'center',
  },
  completionPlaybookLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

export default DevotionalCompletionModal;
