import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../../theme';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';

interface TutorialOverlayProps {
  showTutorial: boolean;
  tutorialStep: number;
  onTapTutorialComplete: () => void;
  onSwipeTutorialComplete: () => void;
  onSkipTutorial: () => void;
}

const TapToExpandTutorial = ({ onComplete }: { onComplete: () => void }) => {
  const pulseAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1, // Repeat indefinitely until user confirms
      true
    );
  }, [pulseAnim]);

  return (
    <>
      <View style={styles.tutorialLabel}>
        <MaterialIcons name="touch-app" size={24} color={Colors.hopeWhite} />
        <ThemedText weight="semiBold" style={styles.tutorialText}>
          Tap card to expand
        </ThemedText>
      </View>
      <Animated.View style={[styles.cardHighlight, animatedStyle]} />
    </>
  );
};

const SwipeToNavigateTutorial = ({ onComplete }: { onComplete: () => void }) => {
  const slideAnim = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
  }));

  useEffect(() => {
    slideAnim.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 800 }),
        withTiming(20, { duration: 800 }),
        withTiming(0, { duration: 800 })
      ),
      -1, // Repeat indefinitely until user confirms
      true
    );
  }, [slideAnim]);

  return (
    <>
      <Animated.View style={[styles.tutorialLabel, animatedStyle]}>
        <ThemedText weight="semiBold" style={styles.tutorialText}>
          Swipe to see more cards
        </ThemedText>
        <ThemedText style={styles.swipeIcon}>← →</ThemedText>
      </Animated.View>
    </>
  );
};

const OnboardingTutorial: React.FC<TutorialOverlayProps> = ({
  showTutorial,
  tutorialStep,
  onTapTutorialComplete,
  onSwipeTutorialComplete,
  onSkipTutorial,
}) => {
  if (!showTutorial) {return null;}

  return (
    <View style={styles.tutorialOverlay}>
      {tutorialStep === 1 && (
        <TapToExpandTutorial onComplete={onTapTutorialComplete} />
      )}
      {tutorialStep === 2 && (
        <SwipeToNavigateTutorial onComplete={onSwipeTutorialComplete} />
      )}

      {/* Confirmation button */}
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => {
          try { triggerLightHaptic(); } catch {}
          tutorialStep === 1 ? onTapTutorialComplete() : onSwipeTutorialComplete();
        }}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.confirmText}>
          {tutorialStep === 1 ? 'Next' : 'Done'}
        </ThemedText>
      </TouchableOpacity>

      {/* Skip Tutorial button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => {
          try { triggerLightHaptic(); } catch {}
          onSkipTutorial();
        }}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.skipText}>Skip Tutorial</ThemedText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 1000,
  },
  tutorialLabel: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tutorialText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  swipeIcon: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardHighlight: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 400, // Match actual card height
    borderRadius: 30, // Match card border radius
    borderWidth: 3,
    borderColor: Colors.alertCoral,
    backgroundColor: 'transparent',
  },
  confirmButton: {
    position: 'absolute',
    top: '70%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  skipButton: {
    position: 'absolute',
    top: '78%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default OnboardingTutorial;
