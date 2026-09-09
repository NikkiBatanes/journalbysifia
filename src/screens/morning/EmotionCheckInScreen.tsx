import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

interface Feeling {
  id: string;
  name: string;
  icon: string;
  iconType: 'ionicons' | 'material';
}

const INITIAL_FEELINGS: Feeling[] = [
  { id: 'peaceful', name: 'Peaceful', icon: 'leaf-outline', iconType: 'ionicons' },
  { id: 'grateful', name: 'Grateful', icon: 'hand-heart', iconType: 'material' },
  { id: 'hopeful', name: 'Hopeful', icon: 'sunny-outline', iconType: 'ionicons' },
  { id: 'joyful', name: 'Joyful', icon: 'happy-outline', iconType: 'ionicons' },
  { id: 'anxious', name: 'Anxious', icon: 'cloudy-outline', iconType: 'ionicons' },
  { id: 'tired', name: 'Tired', icon: 'sleep', iconType: 'material' },
  { id: 'overwhelmed', name: 'Overwhelmed', icon: 'waves', iconType: 'material' },
  { id: 'sad', name: 'Sad', icon: 'emoticon-sad-outline', iconType: 'material' },
  { id: 'frustrated', name: 'Frustrated', icon: 'emoticon-angry-outline', iconType: 'material' },
  { id: 'excited', name: 'Excited', icon: 'sparkles-outline', iconType: 'ionicons' },
  { id: 'calm', name: 'Calm', icon: 'water-outline', iconType: 'ionicons' },
  { id: 'content', name: 'Content', icon: 'cafe-outline', iconType: 'ionicons' },
];

const MORE_FEELINGS: Feeling[] = [
  { id: 'stressed', name: 'Stressed', icon: 'alert-circle-outline', iconType: 'ionicons' },
  { id: 'lonely', name: 'Lonely', icon: 'person-outline', iconType: 'ionicons' },
  { id: 'confident', name: 'Confident', icon: 'trophy-outline', iconType: 'ionicons' },
  { id: 'worried', name: 'Worried', icon: 'cloudy-night-outline', iconType: 'ionicons' },
  { id: 'restless', name: 'Restless', icon: 'flash-outline', iconType: 'ionicons' },
  { id: 'inspired', name: 'Inspired', icon: 'bulb-outline', iconType: 'ionicons' },
  { id: 'bored', name: 'Bored', icon: 'time-outline', iconType: 'ionicons' },
  { id: 'angry', name: 'Angry', icon: 'flame-outline', iconType: 'ionicons' },
  { id: 'discouraged', name: 'Discouraged', icon: 'rainy-outline', iconType: 'ionicons' },
  { id: 'brave', name: 'Brave', icon: 'shield-outline', iconType: 'ionicons' },
  { id: 'hopeless', name: 'Hopeless', icon: 'cloudy-outline', iconType: 'ionicons' },
  { id: 'grumpy', name: 'Grumpy', icon: 'thunderstorm-outline', iconType: 'ionicons' },
  { id: 'stuck', name: 'Stuck', icon: 'help-circle-outline', iconType: 'ionicons' },
  { id: 'loved', name: 'Loved', icon: 'heart-outline', iconType: 'ionicons' },
];

// StepFadeIn — same entrance animation used in Today's Focus
interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const EmotionCheckInScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<Feeling | null>(null);
  const [showMore, setShowMore] = useState(false);
  useMorningStatusBar();
  const buttonScale = useRef(new Animated.Value(0)).current;

  // Enable LayoutAnimation for Android (kept for parity with Today's Focus)
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    if (selected) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selected, buttonScale]);

  const displayedFeelings = useMemo(() => showMore ? [...INITIAL_FEELINGS, ...MORE_FEELINGS] : INITIAL_FEELINGS, [showMore]);

  const onNext = React.useCallback(() => {
    if (!selected) { return; }
    triggerMediumHaptic();
    navigation.navigate('UnderneathIt', {
      feeling: selected?.name,
      morningFlow: route.params?.morningFlow === true,
    });
  }, [navigation, route.params?.morningFlow, selected]);

  // Horizontal swipe to advance / go back, same as Today's Focus
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return gestureState.dx < -14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx < 0) {
            onNext();
          }
        },
      }),
    [onNext, screenWidth]
  );

  return (
    <View style={styles.stepContainer} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[
          styles.stepContent,
          IS_IPAD && styles.stepContentPad,
          { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="favorite-border" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>MORNING CHECK-IN</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              How are you feeling?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160} style={styles.categoriesGrid}>
          {displayedFeelings.map((feeling) => {
            const isSelected = selected?.id === feeling.id;
            return (
              <TouchableOpacity
                key={feeling.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  setSelected(feeling);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Feeling ${feeling.name}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.categoryIconContainer}>
                  <View style={[
                    styles.categoryIconCircle,
                    isSelected && styles.categoryIconCircleSelected,
                  ]}>
                    {feeling.iconType === 'ionicons' ? (
                      <Ionicons
                        name={feeling.icon as any}
                        size={18}
                        color={Colors.hopeWhite}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={feeling.icon as any}
                        size={18}
                        color={Colors.hopeWhite}
                      />
                    )}
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                >
                  {feeling.name}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => { triggerLightHaptic(); setShowMore(!showMore); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showMore ? 'Show less feelings' : 'Show more feelings'}
          >
            <ThemedText weight="semiBold" style={styles.showMoreText}>{showMore ? 'Show less' : 'Show more'}</ThemedText>
          </TouchableOpacity>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating next button — same as Today's Focus */}
      {selected && (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: insets.bottom + 20, transform: [{ scale: buttonScale }] }]}>
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.getParent()?.goBack();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={Colors.textGray} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Styles mirror TodaysFocusWalkthroughScreen exactly
const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
  },
  stepContentPad: {
    paddingHorizontal: 160,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 32,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sageMuted,
  },
  labelIcon: {
    marginTop: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  categoryCard: {
    width: '31%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.sage,
  },
  categoryName: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.hopeWhite,
  },
  showMoreButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.sage,
    alignSelf: 'center',
  },
  showMoreText: {
    fontSize: 14,
    color: Colors.sage,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 999,
    zIndex: 100,
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  primaryButtonPad: {
    right: 48,
  },
});

export default EmotionCheckInScreen;
