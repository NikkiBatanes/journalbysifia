import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { differenceInCalendarDays } from 'date-fns';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { preloadScripturePassages } from '../../services/scriptureReaderService';

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

const EmotionCheckInScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { markStepCompleted } = useRoutine();
  const [selected, setSelected] = useState<Feeling | null>(null);
  const [showMore, setShowMore] = useState(false);
  const buttonScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createdAt = (user as any)?.created_at;
    const now = new Date();
    const start = createdAt ? new Date(createdAt) : now;
    const psalmNumber = (Math.max(0, differenceInCalendarDays(now, start)) % 150) + 1;
    preloadScripturePassages([`Psalm ${psalmNumber}`]);
  }, [user]);

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

  const onNext = React.useCallback(async () => {
    if (!selected) { return; }
    triggerMediumHaptic();
    await markStepCompleted('emotion');
    navigation.navigate('UnderneathIt', {
      feeling: selected.name,
      feelingIcon: selected.icon,
      feelingIconType: selected.iconType,
    });
  }, [navigation, selected, markStepCompleted]);

  const footer = selected ? (
    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity
        onPress={onNext}
        activeOpacity={0.7}
        style={styles.primaryButton}
      >
        <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  ) : null;

  const onBack = () => navigation.goBack();

  return (
    <RoutineStepShell
      step={1}
      totalSteps={6}
      eyebrow="MORNING CHECK-IN"
      eyebrowIcon={<Ionicons name="sunny-outline" size={14} color={Colors.sage} />}
      title="How are you feeling?"
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
    >
      <View style={styles.categoriesGrid}>
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
      </View>
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  categoryCard: {
    width: '30%',
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
  primaryButton: {
    alignSelf: 'flex-end',
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
  },
});

export default EmotionCheckInScreen;
