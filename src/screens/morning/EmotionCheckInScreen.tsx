import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, LayoutAnimation, Platform, UIManager, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { differenceInCalendarDays } from 'date-fns';

import ThemedText from '../../components/common/ThemedText';
import StepFadeIn from '../../components/common/StepFadeIn';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { preloadScripturePassages } from '../../services/scriptureReaderService';
import {
  getLocalJournalSingleton,
  saveLocalJournalSingleton,
  LocalJournalEntry,
} from '../../storage/journalStorage';

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
  { id: 'other', name: 'Other', icon: 'plus-circle', iconType: 'material' },
];

const EmotionCheckInScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { selectedDate, markStepCompleted } = useRoutine();
  const [selected, setSelected] = useState<Feeling | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [customFeeling, setCustomFeeling] = useState('');
  const { currentFont } = useTheme();
  const isOtherSelected = selected?.id === 'other';
  const feelingName = isOtherSelected ? customFeeling.trim() : selected?.name;
  const toggleOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const dateStr = selectedDate;

  useEffect(() => {
    const createdAt = (user as any)?.created_at;
    const now = new Date();
    const start = createdAt ? new Date(createdAt) : now;
    const psalmNumber = (Math.max(0, differenceInCalendarDays(now, start)) % 150) + 1;
    preloadScripturePassages([`Psalm ${psalmNumber}`]);
  }, [user]);

  const allFeelings = useMemo(() => [...INITIAL_FEELINGS, ...MORE_FEELINGS], []);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await getLocalJournalSingleton('morning_check_in', dateStr);
      if (!existing || !mounted) { return; }
      const parsed = typeof existing.content === 'string'
        ? JSON.parse(existing.content)
        : existing.content;
      if (parsed.feeling) {
        const matched = allFeelings.find(f => f.name === parsed.feeling);
        if (matched) { setSelected(matched); }
        else { setSelected(allFeelings.find(f => f.id === 'other')!); setCustomFeeling(parsed.feeling); }
      }
    })();
    return () => { mounted = false; };
  }, [allFeelings, dateStr]);

  const displayedFeelings = useMemo(() => showMore ? allFeelings : INITIAL_FEELINGS, [showMore, allFeelings]);

  const onNext = React.useCallback(async () => {
    if (!selected || !feelingName) { return; }
    triggerMediumHaptic();

    let record: LocalJournalEntry | null = null;
    try {
      const content = JSON.stringify({
        feeling: feelingName,
        feelingIcon: selected.icon,
        feelingIconType: selected.iconType,
        underneathIt: '',
      });
      record = await saveLocalJournalSingleton('morning_check_in', dateStr, content);
      DeviceEventEmitter.emit('reflection_saved', { type: 'morning_check_in', date: dateStr });
    } catch (saveError) {
      console.error('Error saving morning check-in:', saveError);
    }

    await markStepCompleted(
      'emotion',
      record ? { domain: 'journal', content_type: 'morning_check_in', local_id: record.id } : undefined,
      'morning_check_in',
    );
    navigation.navigate('UnderneathIt', {
      feeling: feelingName,
      feelingIcon: selected.icon,
      feelingIconType: selected.iconType,
    });
  }, [navigation, selected, feelingName, markStepCompleted, dateStr]);

  const footer = selected && feelingName ? (
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

  const onBack = () => navigation.navigate('MainTabs', { screen: 'Today' });

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
      scrollWithHeader
    >
      {isOtherSelected ? (
        <StepFadeIn delay={160}>
          <TextInput
            value={customFeeling}
            onChangeText={setCustomFeeling}
            placeholder="Type how you’re feeling"
            placeholderTextColor={Colors.textGray}
            style={[styles.customInput, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]}
            multiline
            autoFocus
            accessibilityLabel="Your feeling"
          />
        </StepFadeIn>
      ) : (
        <StepFadeIn delay={160} style={styles.categoriesGrid}>
          {displayedFeelings.map((feeling) => {
            const isSelected = selected?.id === feeling.id;
            return (
              <TouchableOpacity
                key={feeling.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        </StepFadeIn>
      )}
      <StepFadeIn delay={240} style={{ alignSelf: 'center' }}>
        <Animated.View style={{ opacity: toggleOpacity }}>
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => {
              triggerLightHaptic();
              if (Platform.OS === 'android') { UIManager.setLayoutAnimationEnabledExperimental?.(true); }
              if (isOtherSelected) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelected(null);
                return;
              }
              Animated.timing(toggleOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowMore(value => !value);
                Animated.timing(toggleOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
              });
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isOtherSelected ? 'Choose again' : showMore ? 'Show less feelings' : 'Show more feelings'}
          >
            <ThemedText weight="semiBold" style={styles.showMoreText}>{isOtherSelected ? 'Choose again' : showMore ? 'Show less' : 'Show more'}</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </StepFadeIn>
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
  customInput: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
    paddingVertical: 16,
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
