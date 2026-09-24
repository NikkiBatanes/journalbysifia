import {useAuth} from '../context/IndustryStandardAuthContext';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  findNodeHandle,
  Image,
  Keyboard,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  UIManager,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HeaderBackButton from '../components/common/HeaderBackButton';
import HeaderCloseButton from '../components/common/HeaderCloseButton';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import Entypo from 'react-native-vector-icons/Entypo';
import {BookHeart} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import ThemedText from '../components/common/ThemedText';
import SavedReflectionBlocks from '../components/journal/SavedReflectionBlocks';
import {GuidedReflectionMomentPreview} from '../components/journal/GuidedReflectionMomentPreview';
import {
  SCRIPTURE_NOTE_ICON,
  SCRIPTURE_NOTE_SECTION_LABEL,
  ScriptureNoteIcon,
  ScriptureNotePreview,
} from '../components/journal/ScriptureNotePreview';
import FocusPriorityInputs, {
  type FocusPriorityInputsHandle,
} from '../components/journal/FocusPriorityInputs';
import {
  LookingForwardEmotionStep,
  LookingForwardWritingStep,
} from '../components/journal/LookingForwardExperience';
import {GratitudeListReactQuery} from '../components/journal/GratitudeListReactQuery';
import {MomentsPaletteContext} from '../context/MomentsPaletteContext';
import {
  ReviewMomentsList,
  type ReviewMomentsListHandle,
} from '../components/reviews/WeeklyReviewMomentsList';
import {
  WeeklyReviewSummary,
  type WeeklyReviewSummaryTab,
} from '../components/reviews/WeeklyReviewSummary';
import {
  MonthlyReviewSummary,
  type MonthlyReviewSummaryTab,
} from '../components/reviews/MonthlyReviewSummary';
import {MonthlyReviewPrayerOverview} from '../components/reviews/MonthlyReviewPrayerOverview';
import {ReviewPrayerMomentCard} from '../components/reviews/ReviewPrayerMomentCard';
import ProverbVerseExcerpt from '../components/scripture/ProverbVerseExcerpt';
import PrayerHandsIcon from '../components/common/PrayerHandsIcon';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {triggerLightHaptic} from '../utils/haptics';
import {toLocalDateString} from '../utils/date';
import {
  type ReviewType,
  type LocalReviewEntry,
  type ReviewMemorableItem,
  type ReviewPrayerSnapshotItem,
  getOrCreateLocalReviewForPeriod,
  updateLocalReview,
} from '../storage/reviewStorage';
import {getReviewSettings} from '../storage/reviewSettingsStorage';
import {
  getWeeklyPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
  getYearEndPeriodFor,
  getBeginYearPeriodFor,
  type ReviewPeriod,
} from '../services/reviewPeriodService';
import {
  getReviewCapture,
  type ReviewCapture,
  type ReviewCaptureItem,
  type ReviewCaptureKind,
  type ReviewCapturePresentation,
} from '../services/reviewCaptureService';
import {getReviewStages} from '../services/reviewStages';
import {WEEKLY_CARE_AREAS, WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';
import {getWeeklyCareAreas} from '../utils/weeklyLifeAreaAnswers';
import {
  getWeeklyChallengeChoices,
  getWeeklyChallengeOptions,
  toggleWeeklyChallengeChoice,
} from '../utils/weeklyChallengeAnswers';
import {getWeeklySupportChoices} from '../utils/weeklyLookingAheadAnswers';
import {formatWeeklyLookingAheadPeriod} from '../utils/weeklyLookingAheadPeriod';
import {formatWeeklyGratitudePeriod} from '../utils/weeklyGratitudePeriod';
import {
  formatNextMonthPeriod,
  formatReviewedMonthPeriod,
} from '../utils/reviewMonthPeriod';
import {
  getWeeklyLookingForwardEmotion,
  isWeeklyLookingForwardAnswerKey,
} from '../utils/weeklyLookingForwardAnswers';
import {saveWeeklyLookingForwardMoment} from '../services/weeklyLookingForwardService';
import {saveMonthlyReviewPrayer} from '../services/monthlyReviewPrayerService';
import {saveWeeklyReviewPrayer} from '../services/weeklyReviewPrayerService';
import {
  getWeeklyRhythm,
  type WeeklyRhythm,
} from '../services/weeklyRhythmService';
import {
  getMonthlyCheckInFeelings,
  getMonthlyLifeCheckInSummary,
  getMonthlyLookingForwardFeelings,
  getMonthlyWeeklyReviewFeelings,
  getWeeklyCheckInFeelings,
  type MonthlyCheckInFeeling,
  type MonthlyLifeCheckInSummary,
  type MonthlyWeeklyReviewFeelings,
  type WeeklyCheckInFeeling,
} from '../services/weeklyFeelingService';
import {summarizeMonthlyPatterns} from '../services/monthlyPatternSummaryService';
import {getReviewCoverSummary} from '../services/reviewCoverSummaryService';
import {getPrayerCaptureCountLabel} from '../services/reviewCaptureSummaryService';
import {useFloatingKeyboardButton} from '../hooks/useFloatingKeyboardButton';
import {
  claimFaithfulRhythmCelebration,
  FAITHFUL_RHYTHM_UPDATED,
} from '../services/faithfulRhythmService';
import {saveWeeklyGratitudeMoment} from '../services/weeklyGratitudeService';
import {
  getWeeklyGratitudeInputCount,
  getWeeklyGratitudeItems,
  isWeeklyGratitudeAnswerKey,
  weeklyGratitudeAnswerKey,
} from '../utils/weeklyGratitudeAnswers';
import {Logger} from '../utils/ProductionLogger';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const REVIEW_STAGE_STAGGER_MS = 52;
const REVIEW_PILL_BASE_DELAY_MS = 140;
const REVIEW_PILL_STAGGER_MS = 42;
const WEEKLY_COVER_METRIC_LIMIT = 6;

type StaggeredReviewStageProps = ViewProps & {
  animationKey: string;
  enabled: boolean;
};

/**
 * Reveals the major blocks on each Weekly Review page in sequence. The bounce
 * comes from scale so the page never appears to travel up from the bottom.
 */
const StaggeredReviewStage = ({
  animationKey,
  children,
  enabled,
  style,
  ...viewProps
}: StaggeredReviewStageProps) => {
  const items = React.Children.toArray(children);
  const itemCount = items.length;
  const animatedItems = useMemo(
    () =>
      Array.from({length: itemCount}, (_, index) => ({
        key: `${animationKey}-${index}`,
        value: new Animated.Value(enabled ? 0 : 1),
      })),
    [animationKey, enabled, itemCount],
  );

  useEffect(() => {
    let active = true;
    let frame: number | null = null;
    let entrance: Animated.CompositeAnimation | null = null;

    animatedItems.forEach(({value}) => {
      value.stopAnimation();
      value.setValue(enabled ? 0 : 1);
    });

    if (!enabled) {
      return () => {
        active = false;
      };
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (!active) {
          return;
        }
        if (reduceMotion) {
          animatedItems.forEach(({value}) => value.setValue(1));
          return;
        }

        entrance = Animated.stagger(
          REVIEW_STAGE_STAGGER_MS,
          animatedItems.map(({value}) =>
            Animated.spring(value, {
              toValue: 1,
              stiffness: 240,
              damping: 15,
              mass: 0.72,
              useNativeDriver: true,
            }),
          ),
        );
        frame = requestAnimationFrame(() => entrance?.start());
      })
      .catch(() => {
        if (active) {
          animatedItems.forEach(({value}) => value.setValue(1));
        }
      });

    return () => {
      active = false;
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      entrance?.stop();
      animatedItems.forEach(({value}) => value.stopAnimation());
    };
  }, [animatedItems, enabled]);

  return (
    <View {...viewProps} style={style}>
      {items.map((item, index) => {
        const animatedItem = animatedItems[index];
        const progress = animatedItem.value;
        return (
          <Animated.View
            key={animatedItem.key}
            style={{
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.965, 1],
                  }),
                },
              ],
            }}>
            {item}
          </Animated.View>
        );
      })}
    </View>
  );
};

/**
 * Cascades a single "How did this week feel?" pill in after the stage blocks
 * have started appearing. Keyed by feeling name so selection and the
 * show-more toggle never replay the entrance.
 */
const StaggeredFeelingPill = ({
  delay,
  exiting = false,
  exitDelay = 0,
  children,
}: {
  delay: number;
  exiting?: boolean;
  exitDelay?: number;
  children: React.ReactNode;
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (exiting) {
      return;
    }
    let active = true;
    let entrance: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (!active) {
          return;
        }
        if (reduceMotion) {
          progress.setValue(1);
          return;
        }
        entrance = Animated.spring(progress, {
          toValue: 1,
          delay,
          stiffness: 240,
          damping: 15,
          mass: 0.72,
          useNativeDriver: true,
        });
        entrance.start();
      })
      .catch(() => {
        if (active) {
          progress.setValue(1);
        }
      });

    return () => {
      active = false;
      entrance?.stop();
      progress.stopAnimation();
    };
  }, [delay, exiting, progress]);

  useEffect(() => {
    if (!exiting) {
      return;
    }
    const exit = Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      delay: exitDelay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    exit.start();
    return () => exit.stop();
  }, [exiting, exitDelay, progress]);

  return (
    <Animated.View
      style={{
        alignSelf: 'flex-start',
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
};

type ReviewStage = number;

const CATEGORY_LABELS: Record<ReviewCaptureKind, string> = {
  sermon: 'Session notes',
  prayer: 'Prayers',
  reflection: 'Reflections',
  scripture: 'Scripture',
  journal: 'Journal',
  gratitude: 'Gratitudes',
  win: 'Wins',
  morning: 'Morning',
  evening: 'Evening',
};

const WEEKLY_FEELING_WORDS = [
  'Hopeful',
  'Faithful',
  'Strengthened',
  'Tired',
  'Wrestling',
  'Spiritually dry',
  'Still learning',
  'Growing',
  'Being refined',
  'Peaceful',
  'Joyful',
  'Overwhelmed',
  'Lonely',
  'Waiting',
  'Seeking',
  'Anxious',
  'Content',
  'Sad',
  'Grateful',
  'Blessed',
  'God felt near',
  'Uncertain',
  'Held',
  'Guided',
  'God felt distant',
  'Surrendering',
  'Awakened',
] as const;
const WEEKLY_FEELINGS_PREVIEW_COUNT = 9;

const MONTHLY_PATTERN_ALERT_CORAL = Colors.alertCoral;
const MONTHLY_PATTERN_NEEDS_CARE_WORDS = [
  'angry',
  'anxious',
  'bored',
  'discouraged',
  'frustrated',
  'god felt distant',
  'grumpy',
  'heavy',
  'hesitant',
  'hopeless',
  'lonely',
  'nervous',
  'overwhelmed',
  'reluctant',
  'restless',
  'sad',
  'spiritually dry',
  'stressed',
  'stuck',
  'tired',
  'uncertain',
  'unprepared',
  'unsure',
  'worried',
  'wrestling',
] as const;

const getMonthlyPatternFeelingColor = (feeling: string): string => {
  const normalizedFeeling = feeling.trim().toLowerCase();
  const needsCare = MONTHLY_PATTERN_NEEDS_CARE_WORDS.some(word =>
    normalizedFeeling.includes(word),
  );
  return needsCare ? MONTHLY_PATTERN_ALERT_CORAL : Colors.sageMuted;
};

const getMonthlyLifeRatingColor = (
  value: 'struggling' | 'okay' | 'well' | null,
): string => {
  if (value === 'well') {
    return Colors.sageMuted;
  }
  if (value === 'struggling') {
    return MONTHLY_PATTERN_ALERT_CORAL;
  }
  if (value === 'okay') {
    return '#CFC5AE';
  }
  return '#ECECE7';
};

const WEEKLY_LIFE_CHECK_IN_OPTIONS = [
  {value: 'struggling', label: 'Struggling'},
  {value: 'okay', label: 'Okay'},
  {value: 'well', label: 'Well'},
] as const;

const WEEKLY_GOD_FAITHFULNESS_OPTIONS = [
  'Provided for me',
  'Gave me strength',
  'Guided me',
  'Comforted me',
  'Protected me',
  'Through someone',
  'Answered a prayer',
  'Helped me grow',
  'Gave me peace',
  'In the ordinary',
  'I’m still looking',
] as const;

const isGodFaithfulnessChoice = (value: string): boolean =>
  WEEKLY_GOD_FAITHFULNESS_OPTIONS.some(option => option === value);

const CAPTURE_PRESENTATION_GROUPS: Array<{
  presentation: ReviewCapturePresentation;
  title: string;
}> = [
  {presentation: 'morning_check_in', title: 'Morning check-ins'},
  {presentation: 'morning_psalm', title: 'Daily Psalms'},
  {presentation: 'focus', title: 'What you focused on'},
  {presentation: 'todo', title: 'To-dos'},
  {presentation: 'gratitude_list', title: 'Gratitudes'},
  {presentation: 'evening_proverb', title: 'Evening Proverbs'},
  {presentation: 'today_win', title: 'Wins'},
  {presentation: 'looking_forward', title: 'Looking forward'},
  {presentation: 'testimony', title: 'Your testimony'},
  {presentation: 'for_me_day_reflection', title: 'New Life Day reflections'},
  {presentation: 'prayer', title: 'Prayers'},
  {presentation: 'bible_study', title: 'Bible studies'},
  {presentation: 'scripture_reflection', title: SCRIPTURE_NOTE_SECTION_LABEL},
  {presentation: 'session_note', title: 'Session notes'},
];

const HEART_JOURNAL_PRESENTATIONS = new Set<ReviewCapturePresentation>([
  'heart_journal',
  'guided_reflection',
  'devotional_reflection',
  'playbook_reflection',
]);

const CAPTURE_GROUP_ICONS: Record<ReviewCapturePresentation, string> = {
  heart_journal: 'heart-outline',
  guided_reflection: 'heart-outline',
  devotional_reflection: 'heart-outline',
  playbook_reflection: 'heart-outline',
  testimony: 'sparkles-outline',
  for_me_day_reflection: 'gift-outline',
  morning_check_in: 'sunny-outline',
  morning_psalm: 'sunny-outline',
  evening_proverb: 'moon-outline',
  prayer: 'hand-left-outline',
  gratitude_list: 'heart-circle-outline',
  bible_study: 'book-outline',
  scripture_reflection: SCRIPTURE_NOTE_ICON,
  session_note: 'document-text-outline',
  today_win: 'trophy-outline',
  focus: 'compass-outline',
  todo: 'list-outline',
  looking_forward: 'arrow-forward-circle-outline',
};

const FocusCategoryIcon = ({
  item,
  size = 19,
}: {
  item: ReviewCaptureItem;
  size?: number;
}) => {
  if (!item.focusIcon) {
    return (
      <MaterialIcons
        name="filter-center-focus"
        size={size}
        color={Colors.sage}
      />
    );
  }
  if (item.focusIconType === 'material') {
    return (
      <MaterialCommunityIcons
        name={item.focusIcon}
        size={size}
        color={Colors.sage}
      />
    );
  }
  if (item.focusIconType === 'fontawesome') {
    return (
      <FontAwesome6 name={item.focusIcon} size={size - 1} color={Colors.sage} />
    );
  }
  return <Ionicons name={item.focusIcon} size={size} color={Colors.sage} />;
};

const CaptureGroupIcon = ({
  presentation,
}: {
  presentation: ReviewCapturePresentation;
}) => {
  if (presentation === 'heart_journal') {
    return <BookHeart size={19} color={Colors.sage} strokeWidth={2.5} />;
  }
  if (presentation === 'prayer') {
    return <PrayerHandsIcon size={19} color={Colors.sage} />;
  }
  if (presentation === 'bible_study') {
    return (
      <MaterialCommunityIcons
        name="book-outline"
        size={19}
        color={Colors.sage}
      />
    );
  }
  if (presentation === 'scripture_reflection') {
    return <ScriptureNoteIcon size={19} color={Colors.sage} />;
  }
  if (presentation === 'focus') {
    return (
      <MaterialIcons name="filter-center-focus" size={19} color={Colors.sage} />
    );
  }
  if (presentation === 'todo') {
    return <Entypo name="list" size={19} color={Colors.sage} />;
  }
  return (
    <Ionicons
      name={CAPTURE_GROUP_ICONS[presentation]}
      size={19}
      color={Colors.sage}
    />
  );
};

const FeelingIcon = ({item}: {item: ReviewCaptureItem}) => {
  if (!item.feelingIcon) {
    return null;
  }
  if (item.feelingIconType === 'material') {
    return (
      <MaterialCommunityIcons
        name={item.feelingIcon}
        size={22}
        color={Colors.sage}
      />
    );
  }
  if (item.feelingIconType === 'fontawesome') {
    return (
      <FontAwesome6 name={item.feelingIcon} size={20} color={Colors.sage} />
    );
  }
  return <Ionicons name={item.feelingIcon} size={22} color={Colors.sage} />;
};

const formatCapturedDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatFollowingDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day + 1, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const capturedMomentCopy = (item: ReviewCaptureItem): string => {
  const title = item.title.trim();
  const text = item.text?.trim();
  if (!text || text.toLocaleLowerCase() === title.toLocaleLowerCase()) {
    return title;
  }
  return `${title} — ${text}`;
};

const memorableReferenceFor = (
  item: ReviewCaptureItem,
): ReviewMemorableItem => ({
  kind: item.kind,
  id: item.id,
  selectedDate: item.selectedDate,
  canonicalIds: [
    ...new Set(
      [item.id, item.prayerId, item.requestId].filter((id): id is string =>
        Boolean(id),
      ),
    ),
  ],
});

const carryForwardHeading = (type: ReviewType): string => {
  if (type === 'monthly') {
    return 'FROM YOUR WEEKLY REVIEWS';
  }
  if (type === 'quarterly') {
    return 'FROM YOUR MONTHLY REVIEWS';
  }
  if (type === 'year_end') {
    return 'FROM YOUR QUARTERLY REVIEWS';
  }
  return 'CARRIED FORWARD';
};

const HEART_JOURNAL_COUNT_LABELS: Record<string, [string, string]> = {
  Thoughts: ['thought', 'thoughts'],
  Notes: ['note', 'notes'],
  Reflection: ['reflection', 'reflections'],
  'Brain Dump': ['brain dump', 'brain dumps'],
  Lesson: ['lesson', 'lessons'],
  Idea: ['idea', 'ideas'],
  Letter: ['letter', 'letters'],
  'Guided prompt': ['guided prompt', 'guided prompts'],
  'Guided reflection': ['guided reflection', 'guided reflections'],
};

const heartJournalCountLabel = (items: ReviewCaptureItem[]): string => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const label = item.subtitle?.trim() || 'Thoughts';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const orderedLabels = [
    ...Object.keys(HEART_JOURNAL_COUNT_LABELS),
    ...[...counts.keys()].filter(label => !HEART_JOURNAL_COUNT_LABELS[label]),
  ];
  const populatedLabels = orderedLabels
    .filter(label => (counts.get(label) || 0) > 0)
    .sort((left, right) => (counts.get(right) || 0) - (counts.get(left) || 0));
  const visibleLabels = populatedLabels.slice(0, 2).map(label => {
    const count = counts.get(label) || 0;
    const copy = HEART_JOURNAL_COUNT_LABELS[label];
    return copy
      ? `${count} ${count === 1 ? copy[0] : copy[1]}`
      : `${count} ${label.toLocaleLowerCase()}`;
  });
  const remainingTypeCount = populatedLabels.length - visibleLabels.length;
  return [
    ...visibleLabels,
    remainingTypeCount > 0
      ? `${remainingTypeCount} more ${
          remainingTypeCount === 1 ? 'type' : 'types'
        }`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

const captureGroupCountLabel = (
  presentation: ReviewCapturePresentation,
  items: ReviewCaptureItem[],
): string => {
  if (presentation === 'heart_journal') {
    return heartJournalCountLabel(items);
  }
  if (presentation === 'prayer') {
    return getPrayerCaptureCountLabel(items);
  }
  if (presentation === 'scripture_reflection') {
    return `${items.length} ${items.length === 1 ? 'note' : 'notes'}`;
  }
  if (presentation === 'testimony') {
    return items.length === 1 ? '1 testimony' : `${items.length} testimonies`;
  }
  if (presentation === 'for_me_day_reflection') {
    return `${items.length} ${items.length === 1 ? 'yearly reflection' : 'yearly reflections'}`;
  }
  if (presentation === 'morning_check_in') {
    const reflectionCount = items.filter(item => {
      const text = item.text?.trim();
      return (
        text &&
        text.toLocaleLowerCase() !== item.title.trim().toLocaleLowerCase()
      );
    }).length;
    return [
      items.length > 0
        ? `${items.length} ${items.length === 1 ? 'check-in' : 'check-ins'}`
        : '',
      reflectionCount > 0
        ? `${reflectionCount} ${
            reflectionCount === 1 ? 'reflection' : 'reflections'
          } written`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (presentation === 'todo') {
    const completedCount = items.filter(item => item.completed).length;
    const pendingCount = items.length - completedCount;
    const prioritizedCount = items.filter(item => item.priority).length;
    return [
      completedCount > 0 ? `${completedCount} completed` : '',
      pendingCount > 0 ? `${pendingCount} pending` : '',
      prioritizedCount > 0 ? `${prioritizedCount} prioritized` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (presentation === 'focus') {
    const completedPriorities = items.reduce(
      (total, item) => total + (item.completedPriorityCount ?? 0),
      0,
    );
    return [
      items.length > 0
        ? `${items.length} ${items.length === 1 ? 'focus' : 'focuses'}`
        : '',
      completedPriorities > 0
        ? `${completedPriorities} ${
            completedPriorities === 1 ? 'priority' : 'priorities'
          } completed`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (presentation === 'gratitude_list') {
    const gratitudeCount = items.reduce(
      (total, item) => total + (item.lines?.length || 0),
      0,
    );
    return [
      items.length > 0
        ? `${items.length} gratitude ${items.length === 1 ? 'list' : 'lists'}`
        : '',
      gratitudeCount > 0
        ? `${gratitudeCount} ${
            gratitudeCount === 1 ? 'gratitude' : 'gratitudes'
          }`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (presentation === 'today_win') {
    return items.length > 0
      ? `${items.length} ${items.length === 1 ? 'win' : 'wins'}`
      : '';
  }
  if (presentation === 'looking_forward') {
    return items.length > 0
      ? `${items.length} ${
          items.length === 1 ? 'reflection' : 'reflections'
        } written`
      : '';
  }
  if (presentation === 'morning_psalm' || presentation === 'evening_proverb') {
    const fullChapterCount = items.filter(
      item => item.passageRead === true,
    ).length;
    const inProgressCount = items.filter(
      item => item.passageRead === false,
    ).length;
    return [
      fullChapterCount > 0
        ? `${fullChapterCount} full ${
            fullChapterCount === 1 ? 'chapter' : 'chapters'
          } read`
        : '',
      inProgressCount > 0 ? `${inProgressCount} reading in progress` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;
};

const WeeklyMomentCard = ({
  item,
  selected,
  width,
  relatedItems = [item],
  onPress,
  selectionAppearance = 'bookmark',
}: {
  item: ReviewCaptureItem;
  selected: boolean;
  width: number;
  relatedItems?: ReviewCaptureItem[];
  onPress: () => void;
  selectionAppearance?: 'bookmark' | 'heart';
}) => {
  const [showAllLines, setShowAllLines] = useState(false);
  const [underneathOverflows, setUnderneathOverflows] = useState(false);
  const body = item.text?.trim();
  const distinctBody =
    body && body.toLocaleLowerCase() !== item.title.trim().toLocaleLowerCase()
      ? body
      : '';
  const date = formatCapturedDate(item.selectedDate);
  const usesScriptureCardPalette =
    item.presentation === 'morning_psalm' ||
    item.presentation === 'evening_proverb' ||
    item.presentation === 'looking_forward';
  const usesHeartSelection = selectionAppearance === 'heart';
  const selection = (
    <View
      style={[
        styles.momentRemember,
        usesScriptureCardPalette && !selected && styles.psalmRemember,
        usesHeartSelection && styles.momentHeart,
        selected &&
          (usesHeartSelection
            ? styles.momentHeartSelected
            : styles.momentRememberSelected),
      ]}>
      <Ionicons
        name={
          usesHeartSelection
            ? selected
              ? 'heart'
              : 'heart-outline'
            : selected
            ? 'bookmark'
            : 'bookmark-outline'
        }
        size={18}
        color={
          usesHeartSelection
            ? Colors.alertCoral
            : selected
            ? Colors.hopeWhite
            : Colors.sage
        }
      />
    </View>
  );
  const commonProps = {
    accessibilityRole: 'checkbox' as const,
    accessibilityLabel: usesHeartSelection
      ? `${selected ? 'Remove heart' : 'Heart this moment'}. ${date}. ${capturedMomentCopy(
          item,
        )}`
      : `${
          selected ? 'Remove from remembered' : 'Remember this'
        }. ${date}. ${capturedMomentCopy(item)}`,
    accessibilityState: {checked: selected},
    activeOpacity: 0.76,
    onPress,
  };
  const shell = (content: React.ReactNode, extraStyle?: object) => (
    <TouchableOpacity
      {...commonProps}
      style={[
        styles.momentTypeCard,
        extraStyle,
        selected &&
          (usesHeartSelection
            ? styles.momentTypeCardHearted
            : styles.momentTypeCardSelected),
        {width},
      ]}>
      {selection}
      {content}
    </TouchableOpacity>
  );

  if (item.presentation === 'prayer') {
    return (
      <ReviewPrayerMomentCard
        item={item}
        selected={selected}
        width={width}
        onPress={onPress}
        selectionAppearance={selectionAppearance}
      />
    );
  }

  if (item.presentation === 'gratitude_list') {
    const lines = item.lines?.length ? item.lines : [item.title];
    const visibleLines = showAllLines ? lines : lines.slice(0, 5);
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <Ionicons name="heart-circle-outline" size={21} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.gratitudeCardEyebrow}>
            GRATITUDE LIST
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        <ThemedText style={styles.gratitudeCardSubtitle}>
          {lines.length === 1
            ? '1 moment of gratitude'
            : `${lines.length} moments of gratitude`}
        </ThemedText>
        <View style={styles.gratitudeLines}>
          {visibleLines.map((line, index) => (
            <View key={`${item.id}-${index}`} style={styles.gratitudeLine}>
              <View style={styles.gratitudeNumber}>
                <ThemedText style={styles.gratitudeNumberText}>
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText style={styles.gratitudeText} numberOfLines={2}>
                {line}
              </ThemedText>
            </View>
          ))}
        </View>
        {lines.length > 5 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{expanded: showAllLines}}
            accessibilityLabel={
              showAllLines
                ? 'Show fewer gratitude items'
                : `Show ${lines.length - 5} more gratitude items`
            }
            style={styles.momentShowMore}
            onPress={event => {
              event.stopPropagation();
              setShowAllLines(value => !value);
            }}>
            <Ionicons
              name={showAllLines ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.sage}
            />
            <ThemedText weight="medium" style={styles.momentShowMoreText}>
              {showAllLines ? 'Show less' : `Show more (${lines.length - 5})`}
            </ThemedText>
          </TouchableOpacity>
        )}
      </>,
    );
  }

  if (
    item.presentation === 'testimony' ||
    item.presentation === 'for_me_day_reflection'
  ) {
    const isTestimony = item.presentation === 'testimony';
    return shell(
      <>
        <View style={styles.forMeDayReviewHeader}>
          <View style={styles.forMeDayReviewMark}>
            <Ionicons
              name={isTestimony ? 'sparkles-outline' : 'gift-outline'}
              size={18}
              color={Colors.sage}
            />
          </View>
          <View style={styles.forMeDayReviewHeadingCopy}>
            <ThemedText weight="semiBold" style={styles.forMeDayReviewEyebrow}>
              MY NEW LIFE DAY
            </ThemedText>
            <ThemedText style={styles.forMeDayReviewDate}>{date}</ThemedText>
          </View>
        </View>
        <View style={styles.forMeDayReviewPill}>
          <ThemedText weight="semiBold" style={styles.forMeDayReviewPillText}>
            {isTestimony ? 'TESTIMONY' : 'YEARLY REFLECTION'}
          </ThemedText>
        </View>
        <Text style={styles.forMeDayReviewTitle} numberOfLines={2}>
          {isTestimony ? 'Your testimony' : item.title}
        </Text>
        {!!distinctBody && (
          <Text style={styles.forMeDayReviewBody} numberOfLines={4}>
            {distinctBody}
          </Text>
        )}
        <View style={styles.forMeDayReviewDivider} />
        <View style={styles.forMeDayReviewFooter}>
          <Ionicons name="sparkles" size={13} color={Colors.sage} />
          <ThemedText style={styles.forMeDayReviewFooterText} numberOfLines={1}>
            {item.detail || "A marker of God's faithfulness"}
          </ThemedText>
        </View>
      </>,
      styles.forMeDayReviewCard,
    );
  }

  if (item.presentation === 'bible_study') {
    return shell(
      <>
        <ThemedText weight="semiBold" style={styles.scriptureCenteredEyebrow}>
          BIBLE STUDY
        </ThemedText>
        <ThemedText weight="semiBold" style={styles.scriptureCenteredTitle}>
          {item.title}
        </ThemedText>
        {!!item.detail && (
          <ThemedText style={styles.scriptureTranslation}>
            {item.detail}
          </ThemedText>
        )}
        {!!distinctBody && (
          <ThemedText style={styles.scriptureQuote} numberOfLines={3}>
            {distinctBody}
          </ThemedText>
        )}
        <View style={styles.momentDivider} />
        <View style={styles.scriptureFooter}>
          <Ionicons name="book-outline" size={14} color={Colors.textGray} />
          <ThemedText style={styles.scriptureFooterText}>
            Passage read · Reflection saved
          </ThemedText>
        </View>
        <ThemedText style={styles.centeredMomentDate}>{date}</ThemedText>
      </>,
      styles.scriptureReviewCard,
    );
  }

  if (item.presentation === 'session_note') {
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <ThemedText weight="semiBold" style={styles.sessionEyebrow}>
            {(item.subtitle || 'Session Notes').toUpperCase()}
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        <ThemedText
          weight="semiBold"
          style={styles.sessionTitle}
          numberOfLines={2}>
          {item.title}
        </ThemedText>
        {!!item.detail && (
          <ThemedText style={styles.sessionDetail} numberOfLines={1}>
            {item.detail}
          </ThemedText>
        )}
        {!!distinctBody && (
          <View style={styles.sessionQuoteBox}>
            <ThemedText style={styles.sessionQuote} numberOfLines={3}>
              {distinctBody}
            </ThemedText>
          </View>
        )}
        <View style={styles.momentDivider} />
        <View style={styles.sessionFooter}>
          <Ionicons
            name="document-text-outline"
            size={14}
            color={Colors.textGray}
          />
          <ThemedText style={styles.sessionFooterText}>
            Notes and reflections
          </ThemedText>
        </View>
      </>,
    );
  }

  if (item.presentation === 'today_win') {
    return shell(
      <>
        <View style={styles.winHeader}>
          <Ionicons name="trophy-outline" size={22} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.winEyebrow}>
            TODAY'S WIN
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        {!!item.detail && (
          <ThemedText weight="semiBold" style={styles.winType}>
            {item.detail}
          </ThemedText>
        )}
        <View style={styles.momentDivider} />
        <ThemedText weight="medium" style={styles.winQuietLabel}>
          QUIET WIN
        </ThemedText>
        <ThemedText style={styles.winText} numberOfLines={4}>
          {item.text || item.title}
        </ThemedText>
      </>,
    );
  }

  if (HEART_JOURNAL_PRESENTATIONS.has(item.presentation)) {
    const label =
      item.presentation === 'guided_reflection'
        ? (item.subtitle || 'Guided reflection').toUpperCase()
        : item.presentation === 'devotional_reflection'
        ? 'DEVOTIONAL REFLECTION'
        : item.presentation === 'playbook_reflection'
        ? 'PLAYBOOK REFLECTION'
        : (item.subtitle || 'Thoughts').toUpperCase();
    const bodyLineLimit = item.presentation === 'guided_reflection' ? 2 : 3;
    const hasJournalBlocks = Boolean(item.journalBlocks?.length);
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <View
            style={[
              styles.reflectionBadge,
              item.presentation === 'guided_reflection' && styles.guidedBadge,
            ]}>
            <ThemedText weight="semiBold" style={styles.reflectionBadgeText}>
              {label}
            </ThemedText>
          </View>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        {item.presentation === 'guided_reflection' && !!item.lifeArea && (
          <View style={styles.guidedLifeArea}>
            <ThemedText weight="medium" style={styles.guidedLifeAreaValue}>
              {item.lifeArea}
            </ThemedText>
          </View>
        )}
        <ThemedText
          weight="medium"
          style={styles.reflectionTitle}
          numberOfLines={2}>
          {item.title}
        </ThemedText>
        {!!item.detail &&
          item.detail.trim().toLocaleLowerCase() !==
            item.title.trim().toLocaleLowerCase() && (
            <ThemedText style={styles.reflectionDetail} numberOfLines={1}>
              {item.detail}
            </ThemedText>
          )}
        {item.presentation === 'guided_reflection' && item.guidedJourney ? (
          <View pointerEvents="none" style={styles.reflectionBlocksPreview}>
            <GuidedReflectionMomentPreview journey={item.guidedJourney} />
          </View>
        ) : hasJournalBlocks ? (
          <View pointerEvents="none" style={styles.reflectionBlocksPreview}>
            <SavedReflectionBlocks blocks={item.journalBlocks!} compact />
          </View>
        ) : (
          !!distinctBody && (
            <ThemedText
              style={styles.reflectionBody}
              numberOfLines={bodyLineLimit}>
              {distinctBody}
            </ThemedText>
          )
        )}
      </>,
      styles.heartJournalReviewCard,
    );
  }

  if (item.presentation === 'morning_check_in') {
    return shell(
      <>
        <View style={styles.morningCheckInFeelingRow}>
          <FeelingIcon item={item} />
          <ThemedText
            weight="semiBold"
            style={styles.morningCheckInFeeling}
            numberOfLines={2}>
            {item.title}
          </ThemedText>
        </View>
        {!!item.scriptureText && (
          <Text style={styles.morningCheckInVerse} numberOfLines={5}>
            {item.scriptureText}
          </Text>
        )}
        {!!item.detail && (
          <ThemedText weight="medium" style={styles.morningCheckInReference}>
            {item.detail}
          </ThemedText>
        )}
        {!!distinctBody && (
          <>
            <ThemedText
              style={styles.morningCheckInUnderneath}
              numberOfLines={showAllLines ? undefined : 5}
              onTextLayout={event => {
                if (!showAllLines) {
                  setUnderneathOverflows(event.nativeEvent.lines.length > 5);
                }
              }}>
              {distinctBody}
            </ThemedText>
            {underneathOverflows && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{expanded: showAllLines}}
                style={styles.momentShowMore}
                onPress={event => {
                  event.stopPropagation();
                  setShowAllLines(value => !value);
                }}>
                <Ionicons
                  name={showAllLines ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={Colors.sage}
                />
                <ThemedText weight="medium" style={styles.momentShowMoreText}>
                  {showAllLines ? 'Show less' : 'Show more'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </>
        )}
        <ThemedText style={styles.centeredMomentDate}>{date}</ThemedText>
      </>,
    );
  }

  if (
    item.presentation === 'morning_psalm' ||
    item.presentation === 'evening_proverb'
  ) {
    const morning = item.presentation === 'morning_psalm';
    const wisdomItems = item.wisdomItems ?? [];
    const visibleWisdomItems = showAllLines
      ? wisdomItems
      : wisdomItems.slice(0, 1);
    const hiddenWisdomCount = Math.max(0, wisdomItems.length - 1);
    const hasStructuredWisdom =
      !morning && (wisdomItems.length > 0 || Boolean(item.wisdomResponse));
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <Ionicons
            name={morning ? 'sunny-outline' : 'moon-outline'}
            size={19}
            color={Colors.sage}
          />
          <ThemedText weight="semiBold" style={styles.rhythmEyebrow}>
            {morning ? 'MORNING PSALM' : 'EVENING PROVERB'}
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        <ThemedText weight="semiBold" style={styles.rhythmTitle}>
          {item.title}
        </ThemedText>
        {morning && !!distinctBody && (
          <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>
            WHO GOD IS
          </ThemedText>
        )}
        {hasStructuredWisdom && (
          <View style={styles.proverbWisdomSection}>
            <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>
              WISDOM YOU NOTICED
            </ThemedText>
            {visibleWisdomItems.map((wisdom, index) => (
              <View
                key={`${item.id}-wisdom-${index}`}
                style={styles.proverbWisdomItem}>
                <ThemedText weight="semiBold" style={styles.proverbWisdomLabel}>
                  {wisdom.label}
                </ThemedText>
                {!!wisdom.verses && (
                  <ProverbVerseExcerpt
                    reference={wisdom.verses}
                    numberOfLines={5}
                  />
                )}
                {!!wisdom.response && (
                  <View style={styles.proverbResponseSection}>
                    <ThemedText
                      weight="semiBold"
                      style={styles.rhythmTruthLabel}>
                      YOUR RESPONSE
                    </ThemedText>
                    <ThemedText style={styles.proverbResponseText}>
                      {wisdom.response}
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
            {wisdomItems.length > 1 && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{expanded: showAllLines}}
                accessibilityLabel={
                  showAllLines
                    ? 'Show less wisdom'
                    : `Show ${hiddenWisdomCount} more wisdom ${
                        hiddenWisdomCount === 1 ? 'item' : 'items'
                      }`
                }
                style={styles.momentShowMore}
                onPress={event => {
                  event.stopPropagation();
                  setShowAllLines(value => !value);
                }}>
                <Ionicons
                  name={showAllLines ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={Colors.sage}
                />
                <ThemedText weight="medium" style={styles.momentShowMoreText}>
                  {showAllLines
                    ? 'Show less'
                    : `Show more (${hiddenWisdomCount})`}
                </ThemedText>
              </TouchableOpacity>
            )}
            {!!item.wisdomResponse && (
              <View style={styles.proverbResponseSection}>
                <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>
                  YOUR RESPONSE
                </ThemedText>
                <ThemedText style={styles.proverbResponseText}>
                  {item.wisdomResponse}
                </ThemedText>
              </View>
            )}
          </View>
        )}
        {!hasStructuredWisdom && !!distinctBody && (
          <ThemedText style={styles.rhythmBody} numberOfLines={4}>
            {distinctBody}
          </ThemedText>
        )}
        {item.passageRead === false && (
          <View
            style={styles.rhythmReadingProgress}
            accessibilityElementsHidden>
            <MaterialCommunityIcons
              name="progress-star"
              size={14}
              color={Colors.sage}
            />
          </View>
        )}
      </>,
      styles.rhythmReviewCard,
    );
  }

  if (item.presentation === 'scripture_reflection') {
    return shell(
      <ScriptureNotePreview
        reference={item.title}
        version={item.detail || 'NASB'}
        journalBlocks={item.journalBlocks}
        content={distinctBody}
        meta={<ThemedText style={styles.momentDate}>{date}</ThemedText>}
        metaRightInset={36}
        metaMinHeight={24}
        blocksPointerEvents="none"
      />,
      styles.scriptureNoteReviewCard,
    );
  }

  if (item.presentation === 'todo') {
    const visibleTodos = showAllLines ? relatedItems : relatedItems.slice(0, 5);
    const completedCount = relatedItems.filter(todo => todo.completed).length;
    const pendingCount = relatedItems.length - completedCount;
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <Entypo name="list" size={19} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.sessionEyebrow}>
            TO-DOS
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        <ThemedText style={styles.todoSummary}>
          {pendingCount} pending · {completedCount} done
        </ThemedText>
        <View style={styles.todoReviewList}>
          {visibleTodos.map(todo => (
            <View key={todo.id} style={styles.todoReviewRow}>
              <Ionicons
                name={todo.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={todo.completed ? Colors.sage : Colors.textGray}
              />
              <ThemedText
                style={[
                  styles.todoReviewText,
                  todo.completed && styles.todoReviewTextCompleted,
                ]}
                numberOfLines={2}>
                {todo.text || todo.title}
              </ThemedText>
            </View>
          ))}
        </View>
        {relatedItems.length > 5 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{expanded: showAllLines}}
            accessibilityLabel={
              showAllLines
                ? 'Show fewer to-dos'
                : `Show ${relatedItems.length - 5} more to-dos`
            }
            style={styles.momentShowMore}
            onPress={event => {
              event.stopPropagation();
              setShowAllLines(value => !value);
            }}>
            <Ionicons
              name={showAllLines ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.sage}
            />
            <ThemedText weight="medium" style={styles.momentShowMoreText}>
              {showAllLines
                ? 'Show less'
                : `Show more (${relatedItems.length - 5})`}
            </ThemedText>
          </TouchableOpacity>
        )}
      </>,
    );
  }

  if (item.presentation === 'focus') {
    const priorities = item.focusPriorities ?? [];
    return shell(
      <>
        <View style={styles.momentMetaRow}>
          <FocusCategoryIcon item={item} size={18} />
          <ThemedText weight="semiBold" style={styles.sessionEyebrow}>
            {item.title.toUpperCase()}
          </ThemedText>
          <ThemedText style={styles.momentDate}>{date}</ThemedText>
        </View>
        {!!distinctBody && (
          <ThemedText weight="medium" style={styles.journalMomentText}>
            {distinctBody}
          </ThemedText>
        )}
        {priorities.length > 0 && (
          <View style={styles.focusPriorities}>
            <ThemedText weight="medium" style={styles.focusPrioritiesTitle}>
              {priorities.length === 1
                ? 'TOP PRIORITY'
                : `TOP ${priorities.length} PRIORITIES`}
            </ThemedText>
            {priorities.map((priority, index) => (
              <View
                key={`${item.id}-priority-${index}`}
                style={styles.focusPriorityRow}>
                <Ionicons
                  name={
                    priority.completed ? 'checkmark-circle' : 'ellipse-outline'
                  }
                  size={18}
                  color={priority.completed ? Colors.sage : Colors.textGray}
                />
                <ThemedText
                  style={[
                    styles.focusPriorityText,
                    priority.completed && styles.focusPriorityTextCompleted,
                  ]}>
                  {priority.text}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </>,
    );
  }

  if (item.presentation === 'looking_forward') {
    const towardDate = formatFollowingDate(item.selectedDate).toUpperCase();
    return shell(
      <>
        <View style={styles.lookingForwardHeader}>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={18}
            color={Colors.sage}
          />
          <ThemedText weight="semiBold" style={styles.sessionEyebrow}>
            LOOKING TOWARD {towardDate}
          </ThemedText>
        </View>
        <ThemedText
          weight="medium"
          style={styles.lookingForwardText}
          numberOfLines={4}>
          {item.text || item.title}
        </ThemedText>
        {!!item.detail && (
          <View style={styles.lookingForwardHeldSection}>
            <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>
              HOW YOU HELD IT
            </ThemedText>
            <View style={styles.lookingForwardEmotionRow}>
              <FeelingIcon item={item} />
              <ThemedText
                weight="semiBold"
                style={styles.lookingForwardEmotion}>
                {item.detail}
              </ThemedText>
            </View>
          </View>
        )}
        <ThemedText style={styles.lookingForwardWritten}>
          Written {date}
        </ThemedText>
      </>,
      styles.lookingForwardReviewCard,
    );
  }

  return shell(
    <>
      <View style={styles.momentMetaRow}>
        <Ionicons name="sunny-outline" size={18} color={Colors.sage} />
        <ThemedText weight="semiBold" style={styles.sessionEyebrow}>
          MORNING CHECK-IN
        </ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText
        weight="medium"
        style={styles.journalMomentText}
        numberOfLines={4}>
        {item.text || item.title}
      </ThemedText>
    </>,
  );
};

const ReviewScreen: React.FC = () => {
  const {preferences} = useAuth();
  const weekStart = preferences?.weekStart || 'monday';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );
  const {
    bottom: floatingActionBottom,
    keyboardVisible,
    keyboardHeight,
  } = useFloatingKeyboardButton(insets.bottom);
  const {height: screenHeight, width: screenWidth} = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const reviewMomentsListRef = useRef<ReviewMomentsListHandle>(null);
  const weeklyAdditionalMemoryInputRef = useRef<TextInput>(null);
  const monthlyPatternInputRef = useRef<TextInput>(null);
  const monthlyPatternInputFocusedRef = useRef(false);
  const monthlyPillOtherInputRef = useRef<TextInput>(null);
  const monthlyPrayerInputRef = useRef<TextInput>(null);
  const monthlyFormationInputRef = useRef<TextInput>(null);
  const customFeelingInputRef = useRef<TextInput>(null);
  const pendingCustomFeelingFocusRef = useRef(false);
  const godFaithfulnessInputRef = useRef<TextInput>(null);
  const pendingGodFaithfulnessFocusRef = useRef(false);
  const weeklyCareInputRef = useRef<TextInput>(null);
  const weeklyCareOtherInputRef = useRef<TextInput>(null);
  const pendingWeeklyCareOtherFocusRef = useRef(false);
  const weeklyChallengeOtherInputRef = useRef<TextInput>(null);
  const weeklyPrayerInputRef = useRef<TextInput>(null);
  const weeklyPriorityInputsRef = useRef<FocusPriorityInputsHandle>(null);
  const editingReviewSummaryRef = useRef(false);
  const weeklyGratitudeInputRefs = useRef<Array<TextInput | null>>([]);
  const completingReviewRef = useRef<string | null>(null);
  const loadedReviewIdRef = useRef<string | null>(null);

  const revealCustomReviewInput = useCallback(() => {
    const input = [
      customFeelingInputRef.current,
      monthlyFormationInputRef.current,
      godFaithfulnessInputRef.current,
      weeklyCareOtherInputRef.current,
      weeklyCareInputRef.current,
      monthlyPillOtherInputRef.current,
      monthlyPrayerInputRef.current,
    ].find(candidate => candidate?.isFocused());
    if (!input) {
      return;
    }
    const inputHandle = findNodeHandle(input);
    if (inputHandle) {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        80,
        true,
      );
    }
  }, []);

  const revealMonthlyPatternInput = useCallback(() => {
    const input = monthlyPatternInputRef.current;
    if (!input || !monthlyPatternInputFocusedRef.current) {
      return;
    }
    const inputHandle = findNodeHandle(input);
    if (inputHandle) {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        112,
        true,
      );
    }
    // This is the final field on the page, so the end position is also the
    // safest fallback while the keyboard changes the ScrollView's height.
    scrollRef.current?.scrollToEnd({animated: true});
  }, []);

  const revealWeeklyChallengeOtherInput = useCallback(() => {
    const input = weeklyChallengeOtherInputRef.current;
    if (!input?.isFocused()) {
      return;
    }
    const handle = findNodeHandle(input);
    if (handle) {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        handle,
        80,
        true,
      );
    }
  }, []);

  const revealWeeklyClosingInput = useCallback(() => {
    const input = weeklyPrayerInputRef.current;
    if (!input?.isFocused()) {
      return;
    }
    const handle = findNodeHandle(input);
    if (handle) {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        handle,
        80,
        true,
      );
    }
  }, []);

  const revealWeeklyAdditionalMemoryInput = useCallback(() => {
    const input = weeklyAdditionalMemoryInputRef.current;
    const inputHandle = input ? findNodeHandle(input) : null;
    const scrollResponder =
      reviewMomentsListRef.current?.getScrollResponder() as
        | {
            scrollResponderScrollNativeHandleToKeyboard?: (
              nodeHandle: number,
              additionalOffset?: number,
              preventNegativeScrollOffset?: boolean,
            ) => void;
          }
        | null
        | undefined;
    if (
      inputHandle &&
      scrollResponder?.scrollResponderScrollNativeHandleToKeyboard
    ) {
      scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        96,
        true,
      );
      return;
    }
    reviewMomentsListRef.current?.scrollToEnd({animated: true});
  }, []);

  useEffect(() => {
    const eventName =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(eventName, () => {
      if (weeklyAdditionalMemoryInputRef.current?.isFocused()) {
        requestAnimationFrame(revealWeeklyAdditionalMemoryInput);
      }
      if (monthlyPatternInputFocusedRef.current) {
        requestAnimationFrame(revealMonthlyPatternInput);
      }
    });
    return () => subscription.remove();
  }, [revealMonthlyPatternInput, revealWeeklyAdditionalMemoryInput]);

  useEffect(() => {
    if (
      !keyboardVisible ||
      !weeklyAdditionalMemoryInputRef.current?.isFocused()
    ) {
      return;
    }
    requestAnimationFrame(revealWeeklyAdditionalMemoryInput);
  }, [keyboardVisible, revealWeeklyAdditionalMemoryInput]);

  useEffect(() => {
    if (!keyboardVisible || !monthlyPatternInputFocusedRef.current) {
      return;
    }
    requestAnimationFrame(revealMonthlyPatternInput);
  }, [keyboardVisible, revealMonthlyPatternInput]);

  const [stage, setStage] = useState<ReviewStage>(1);
  const [weeklySummaryTab, setWeeklySummaryTab] =
    useState<WeeklyReviewSummaryTab>('back');
  const [monthlySummaryTab, setMonthlySummaryTab] =
    useState<MonthlyReviewSummaryTab>('back');
  const [review, setReview] = useState<LocalReviewEntry | null>(null);
  const reviewRef = useRef<LocalReviewEntry | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [reviewLoadError, setReviewLoadError] = useState(false);
  const [reviewLoadAttempt, setReviewLoadAttempt] = useState(0);
  const [reviewType, setReviewType] = useState<ReviewType>('weekly');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinishingWeeklyReview, setIsFinishingWeeklyReview] = useState(false);
  const [weeklyCompletionError, setWeeklyCompletionError] = useState(false);
  const [isFinishingMonthlyReview, setIsFinishingMonthlyReview] =
    useState(false);
  const [monthlyCompletionError, setMonthlyCompletionError] = useState(false);
  const [memorableItems, setMemorableItems] = useState(
    review?.memorableItems ?? [],
  );
  const [capture, setCapture] = useState<ReviewCapture | null>(null);
  const [monthlyMomentsView, setMonthlyMomentsView] = useState<
    'weekly_bookmarks' | 'all'
  >('all');
  const [monthlyPatternsView, setMonthlyPatternsView] = useState<
    'morning' | 'weekly' | 'looking_forward'
  >('morning');
  const [weeklyRhythm, setWeeklyRhythm] = useState<WeeklyRhythm | null>(null);
  const [checkInFeelings, setCheckInFeelings] = useState<
    Array<WeeklyCheckInFeeling | MonthlyCheckInFeeling>
  >([]);
  const [monthlyWeeklyReviewFeelings, setMonthlyWeeklyReviewFeelings] =
    useState<MonthlyWeeklyReviewFeelings>({reviewCount: 0, feelings: []});
  const [monthlyLookingForwardFeelings, setMonthlyLookingForwardFeelings] =
    useState<WeeklyCheckInFeeling[]>([]);
  const [monthlyLifeCheckInSummary, setMonthlyLifeCheckInSummary] =
    useState<MonthlyLifeCheckInSummary>({
      reviewCount: 0,
      areas: [],
      insight: '',
    });
  const monthlyPatternSummary = useMemo(
    () =>
      summarizeMonthlyPatterns({
        morning: checkInFeelings,
        weekly: monthlyWeeklyReviewFeelings,
        lookingForward: monthlyLookingForwardFeelings,
      }),
    [
      checkInFeelings,
      monthlyLookingForwardFeelings,
      monthlyWeeklyReviewFeelings,
    ],
  );
  const [expandedMonthlyFeeling, setExpandedMonthlyFeeling] = useState<
    string | null
  >(null);
  const [showAllWeeklySummary, setShowAllWeeklySummary] = useState(false);
  const [showCustomFeelingInput, setShowCustomFeelingInput] = useState(false);
  const [showAllWeeklyFeelings, setShowAllWeeklyFeelings] = useState(false);
  const [showGodFaithfulnessInput, setShowGodFaithfulnessInput] =
    useState(false);
  const [weeklyGratitudeInputCount, setWeeklyGratitudeInputCount] = useState(1);
  const [weeklyPriorityInputCount, setWeeklyPriorityInputCount] = useState(1);
  const [showWeeklyGratitudeLookBack, setShowWeeklyGratitudeLookBack] =
    useState(false);
  const [closingFeelings, setClosingFeelings] = useState<string[] | null>(null);
  const feelingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const weeklyGratitudeSaveTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingWeeklyGratitudeRef = useRef<{
    items: string[];
    periodStart: string;
    periodEnd: string;
    reviewId: string;
  } | null>(null);

  useEffect(
    () => () => {
      if (feelingsCloseTimerRef.current) {
        clearTimeout(feelingsCloseTimerRef.current);
      }
      if (weeklyGratitudeSaveTimerRef.current) {
        clearTimeout(weeklyGratitudeSaveTimerRef.current);
      }
      const pendingWeeklyGratitude = pendingWeeklyGratitudeRef.current;
      pendingWeeklyGratitudeRef.current = null;
      if (pendingWeeklyGratitude) {
        saveWeeklyGratitudeMoment(pendingWeeklyGratitude).catch(error => {
          Logger.error(
            'Failed to save Weekly Gratitude Moment',
            error as Error,
            {
              component: 'ReviewScreen',
              reviewId: pendingWeeklyGratitude.reviewId,
            },
          );
        });
      }
    },
    [],
  );

  const monthlyTestimony = useMemo(
    () => capture?.items.find(item => item.presentation === 'testimony') ?? null,
    [capture],
  );
  const monthlyWins = useMemo(
    () =>
      capture?.items.filter(item => item.presentation === 'today_win') ?? [],
    [capture],
  );
  const stages = useMemo(
    () =>
      getReviewStages(reviewType, {
        includeMonthlyTestimony:
          reviewType === 'monthly' && Boolean(monthlyTestimony),
        includeMonthlyWins:
          reviewType === 'monthly' && monthlyWins.length > 0,
      }),
    [monthlyTestimony, monthlyWins.length, reviewType],
  );
  const stageCount = stages.length;
  const currentStageKind = stages[stage - 1]?.kind;
  const isDesignedReview = reviewType === 'weekly' || reviewType === 'monthly';
  const isDesignedCoverStage = isDesignedReview && currentStageKind === 'cover';
  const reviewProgressStepCount = Math.max(
    1,
    isDesignedReview ? stageCount - 2 : stageCount,
  );
  const reviewProgressStep = Math.min(
    reviewProgressStepCount,
    Math.max(0, isDesignedReview ? stage - 1 : stage),
  );
  const isFeelingsStage = currentStageKind === 'feelings';
  const isWeeklyGodFaithfulnessStage =
    reviewType === 'weekly' && stages[stage - 1]?.key === 'god';
  const isMonthlyGodFaithfulnessStage =
    reviewType === 'monthly' && stages[stage - 1]?.key === 'god';
  const isMonthlyFormationStage =
    reviewType === 'monthly' && stages[stage - 1]?.key === 'formation';
  const isWeeklyCareStage =
    reviewType === 'weekly' && stages[stage - 1]?.key === 'dont_forget';
  const isMonthlyPatternsStage =
    reviewType === 'monthly' && stages[stage - 1]?.key === 'notice';
  const isMonthlyPrayerAheadStage =
    reviewType === 'monthly' &&
    stages[stage - 1]?.key === 'prayer_for_month';
  const hasAutoScrollingReviewInput =
    isFeelingsStage ||
    isWeeklyGodFaithfulnessStage ||
    isMonthlyGodFaithfulnessStage ||
    isMonthlyFormationStage ||
    isWeeklyCareStage ||
    isMonthlyPatternsStage ||
    isMonthlyPrayerAheadStage ||
    currentStageKind === 'pill_choices';
  const isLifeCheckInStage = currentStageKind === 'life_check_in';
  const isCapturedStage = currentStageKind === 'captured';
  const isRememberedStage = currentStageKind === 'remembered';
  const isWeeklyLookingAheadStage =
    reviewType === 'weekly' && stages[stage - 1]?.key === 'looking_ahead';
  const isMonthlyLookingAheadStage =
    reviewType === 'monthly' && stages[stage - 1]?.key === 'step_into';
  const isDesignedLookingAheadStage =
    isWeeklyLookingAheadStage || isMonthlyLookingAheadStage;
  const isDesignedPriorityStage =
    isDesignedReview && currentStageKind === 'priorities';
  const isWeeklyLookingForwardWalkthrough =
    reviewType === 'weekly' &&
    ['looking_forward_feeling', 'looking_forward'].includes(
      stages[stage - 1]?.key ?? '',
    );
  const hasFloatingNavigation =
    currentStageKind !== undefined &&
    currentStageKind !== 'cover' &&
    currentStageKind !== 'ready';
  const showsStandardNextButton =
    hasFloatingNavigation &&
    !isFeelingsStage &&
    !isCapturedStage &&
    !isDesignedLookingAheadStage;
  const hasHorizontalMomentCarousels =
    isDesignedReview && (isCapturedStage || isRememberedStage);
  const disablesPageSwipe =
    hasHorizontalMomentCarousels && reviewType !== 'monthly';
  const hasSavedProgress =
    review?.status === 'draft' &&
    (stages.some(
      item => item.key === review.lastStageKey && item.kind !== 'cover',
    ) ||
      memorableItems.length > 0 ||
      Object.values(answers).some(answer => answer.trim().length > 0));

  const typeFromRoute = route.params?.type as ReviewType | undefined;
  const startFromRoute = route.params?.periodStart as string | undefined;
  const endFromRoute = route.params?.periodEnd as string | undefined;
  const resumeFromRoute = route.params?.resumeLastStage === true;

  const loadReview = useCallback(
    async (isActive: () => boolean) => {
      const anchor = toLocalDateString(new Date());
      const settings = await getReviewSettings(weekStart);
      if (!isActive()) {
        return;
      }
      let type: ReviewType = typeFromRoute ?? 'weekly';
      let start = '';
      let end = '';

      if (typeFromRoute && startFromRoute && endFromRoute) {
        start = startFromRoute;
        end = endFromRoute;
      } else {
        let period: ReviewPeriod | null = null;
        switch (type) {
          case 'weekly':
            period = getWeeklyPeriodFor(settings.weekEndsOn, anchor);
            break;
          case 'monthly':
            period = getMonthlyPeriodFor(anchor);
            break;
          case 'quarterly':
            period = getQuarterlyPeriodFor(anchor);
            break;
          case 'year_end':
            period = getYearEndPeriodFor(anchor);
            break;
          case 'begin_year':
            period = getBeginYearPeriodFor(anchor);
            break;
        }

        if (!period) {
          start = anchor;
          end = anchor;
        } else {
          type = period.type;
          start = period.periodStart;
          end = period.periodEnd;
        }
      }

      const existing = await getOrCreateLocalReviewForPeriod({
        type,
        periodStart: start,
        periodEnd: end,
      });
      if (!isActive()) {
        return;
      }

      const [
        captured,
        rhythm,
        loadedCheckInFeelings,
        loadedMonthlyWeeklyReviewFeelings,
        loadedMonthlyLookingForwardFeelings,
        loadedMonthlyLifeCheckInSummary,
      ] = await Promise.all([
        getReviewCapture(start, end, type),
        type === 'weekly'
          ? getWeeklyRhythm(start, end, end)
          : Promise.resolve(null),
        type === 'weekly'
          ? getWeeklyCheckInFeelings(start, end)
          : type === 'monthly'
          ? getMonthlyCheckInFeelings(start, end)
          : Promise.resolve([]),
        type === 'monthly'
          ? getMonthlyWeeklyReviewFeelings(start, end)
          : Promise.resolve({reviewCount: 0, feelings: []}),
        type === 'monthly'
          ? getMonthlyLookingForwardFeelings(start, end)
          : Promise.resolve([]),
        type === 'monthly'
          ? getMonthlyLifeCheckInSummary(start, end)
          : Promise.resolve({reviewCount: 0, areas: [], insight: ''}),
      ]);
      if (!isActive()) {
        return;
      }

      if (loadedReviewIdRef.current !== existing.id) {
        const loadedStages = getReviewStages(type, {
          includeMonthlyTestimony:
            type === 'monthly' &&
            captured.items.some(item => item.presentation === 'testimony'),
          includeMonthlyWins:
            type === 'monthly' &&
            captured.items.some(item => item.presentation === 'today_win'),
        });
        const savedStageIndex = existing.lastStageKey
          ? loadedStages.findIndex(item => item.key === existing.lastStageKey)
          : -1;
        setStage(
          resumeFromRoute && existing.status === 'draft'
            ? savedStageIndex > 0
              ? savedStageIndex + 1
              : 2
            : 1,
        );
        setWeeklySummaryTab('back');
        setMonthlySummaryTab('back');
        editingReviewSummaryRef.current = false;
      }
      loadedReviewIdRef.current = existing.id;
      reviewRef.current = existing;
      setReview(existing);
      setReviewType(type);
      setPeriodStart(existing.periodStart);
      setPeriodEnd(existing.periodEnd);
      setAnswers(existing.answers);
      setWeeklyPriorityInputCount(
        (type === 'monthly'
          ? [
              'next_month_priority_1',
              'next_month_priority_2',
              'next_month_priority_3',
            ]
          : ['priority_1', 'priority_2', 'priority_3']
        ).reduce(
          (count, key, index) =>
            existing.answers[key]?.trim() ? index + 1 : count,
          1,
        ),
      );
      setWeeklyGratitudeInputCount(
        getWeeklyGratitudeInputCount(existing.answers),
      );
      setShowWeeklyGratitudeLookBack(false);
      setShowCustomFeelingInput(
        Boolean(
          existing.answers[
            type === 'monthly' ? 'month_feeling_other' : 'week_feeling_other'
          ]?.trim(),
        ),
      );
      const savedGodChoices = (existing.answers.god || '')
        .split('|')
        .filter(isGodFaithfulnessChoice);
      const legacyGodResponse =
        Boolean(existing.answers.god?.trim()) && savedGodChoices.length === 0;
      setShowGodFaithfulnessInput(
        Boolean(existing.answers.god_faithfulness_other?.trim()) ||
          legacyGodResponse,
      );
      setMemorableItems(existing.memorableItems);
      setCapture(captured);
      setMonthlyMomentsView(
        type === 'monthly' &&
          captured.items.some(item =>
            item.carriedForwardFrom?.includes('weekly'),
          )
          ? 'weekly_bookmarks'
          : 'all',
      );
      setMonthlyPatternsView('morning');
      setWeeklyRhythm(rhythm);
      setCheckInFeelings(loadedCheckInFeelings);
      setMonthlyWeeklyReviewFeelings(loadedMonthlyWeeklyReviewFeelings);
      setMonthlyLookingForwardFeelings(loadedMonthlyLookingForwardFeelings);
      setMonthlyLifeCheckInSummary(loadedMonthlyLifeCheckInSummary);
      setExpandedMonthlyFeeling(null);
      setShowAllWeeklySummary(false);
      const existingWeeklyGratitude = getWeeklyGratitudeItems(existing.answers);
      if (type === 'weekly' && existingWeeklyGratitude.length > 0) {
        saveWeeklyGratitudeMoment({
          items: existingWeeklyGratitude,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          reviewId: existing.id,
        }).catch(error => {
          Logger.error(
            'Failed to sync Weekly Gratitude Moment',
            error as Error,
            {
              component: 'ReviewScreen',
              reviewId: existing.id,
            },
          );
        });
      }
    },
    [
      typeFromRoute,
      startFromRoute,
      endFromRoute,
      resumeFromRoute,
      weekStart,
    ],
  );

  // Tab navigation can reuse this screen for the same period after new entries
  // are saved. Reload on every focus and ignore reads from a previous visit.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoadingReview(true);
      setReviewLoadError(false);
      loadReview(() => active)
        .catch(error => {
          if (!active) {
            return;
          }
          setReviewLoadError(true);
          Logger.error('Failed to load review', error as Error, {
            component: 'ReviewScreen',
            attempt: reviewLoadAttempt,
          });
        })
        .finally(() => {
          if (active) {
            setIsLoadingReview(false);
          }
        });
      return () => {
        active = false;
      };
    }, [loadReview, reviewLoadAttempt]),
  );

  useEffect(() => {
    if (!keyboardVisible) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      revealCustomReviewInput();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    keyboardHeight,
    keyboardVisible,
    revealCustomReviewInput,
    showCustomFeelingInput,
    showGodFaithfulnessInput,
  ]);

  useEffect(() => {
    if (!keyboardVisible) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      revealWeeklyChallengeOtherInput();
      revealWeeklyClosingInput();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    keyboardVisible,
    revealWeeklyChallengeOtherInput,
    revealWeeklyClosingInput,
  ]);

  const saveReview = useCallback(
    async (
      patch: Partial<
        Pick<
          LocalReviewEntry,
          | 'answers'
          | 'memorableItems'
          | 'prayerSnapshot'
          | 'status'
          | 'completedAt'
          | 'monthlyWeeklyBookmarksInitialized'
          | 'lastStageKey'
        >
      >,
    ) => {
      const currentReview = reviewRef.current;
      if (!currentReview) {
        return;
      }
      const updated: LocalReviewEntry = {
        ...currentReview,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      reviewRef.current = updated;
      setReview(updated);
      const persisted = await updateLocalReview(updated);
      if (reviewRef.current === updated) {
        reviewRef.current = persisted;
        setReview(persisted);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      isLoadingReview ||
      reviewLoadError ||
      reviewType === 'weekly' ||
      reviewType === 'monthly'
    ) {
      return;
    }
    if (stage === stageCount && review && review.status !== 'completed') {
      const completionKey = `${review.type}:${review.id}`;
      if (completingReviewRef.current === completionKey) {
        return;
      }
      completingReviewRef.current = completionKey;
      const prayerSnapshot: ReviewPrayerSnapshotItem[] = (capture?.items || [])
        .filter(
          item =>
            item.kind === 'prayer' && item.prayerEventType && item.prayerId,
        )
        .map(item => ({
          id: item.id,
          prayerId: item.prayerId!,
          needId: item.needId,
          requestId: item.requestId,
          eventType: item.prayerEventType!,
          eventDate: item.selectedDate,
          title: item.title,
          subtitle: item.subtitle || 'Prayer',
          text: item.text,
          prayerTypeLabel: item.prayerTypeLabel,
        }));
      const completeReview = async () => {
        await saveReview({
          status: 'completed',
          completedAt: new Date().toISOString(),
          prayerSnapshot,
        });
        DeviceEventEmitter.emit(FAITHFUL_RHYTHM_UPDATED, {
          rhythm: 'reviews',
          selectedDate: review.periodEnd,
        });
        if (
          await claimFaithfulRhythmCelebration(
            'reviews',
            review.periodEnd,
            weekStart,
          )
        ) {
          navigation.navigate('StreakPlan', {
            rhythm: 'reviews',
            source: 'review_complete',
          });
        }
      };
      completeReview().catch(() => {
        completingReviewRef.current = null;
      });
    }
  }, [
    stage,
    stageCount,
    review,
    reviewType,
    capture,
    saveReview,
    navigation,
    weekStart,
    isLoadingReview,
    reviewLoadError,
  ]);

  const finishWeeklyReview = useCallback(async () => {
    if (!review || completingReviewRef.current === review.id) {
      return;
    }
    completingReviewRef.current = review.id;
    setIsFinishingWeeklyReview(true);
    setWeeklyCompletionError(false);
    triggerLightHaptic();
    try {
      const prayerSnapshot: ReviewPrayerSnapshotItem[] = (capture?.items || [])
        .filter(
          item =>
            item.kind === 'prayer' && item.prayerEventType && item.prayerId,
        )
        .map(item => ({
          id: item.id,
          prayerId: item.prayerId!,
          needId: item.needId,
          requestId: item.requestId,
          eventType: item.prayerEventType!,
          eventDate: item.selectedDate,
          title: item.title,
          subtitle: item.subtitle || 'Prayer',
          text: item.text,
          prayerTypeLabel: item.prayerTypeLabel,
        }));
      if (Object.keys(answers).some(isWeeklyLookingForwardAnswerKey)) {
        await saveWeeklyLookingForwardMoment({
          answers,
          periodStart: review.periodStart,
          periodEnd: review.periodEnd,
          reviewId: review.id,
        });
      }
      await saveWeeklyReviewPrayer({
        text: answers.prayer_ahead ?? '',
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        reviewId: review.id,
      });
      await saveReview({
        answers,
        memorableItems,
        status: 'completed',
        completedAt: review.completedAt ?? new Date().toISOString(),
        prayerSnapshot,
      });
      DeviceEventEmitter.emit(FAITHFUL_RHYTHM_UPDATED, {
        rhythm: 'reviews',
        selectedDate: review.periodEnd,
      });
      const celebrate =
        review.status !== 'completed' &&
        (await claimFaithfulRhythmCelebration(
          'reviews',
          review.periodEnd,
          weekStart,
        ));
      if (celebrate) {
        navigation.navigate('StreakPlan', {
          rhythm: 'reviews',
          source: 'review_complete',
        });
      } else {
        navigation.goBack();
      }
    } catch {
      setWeeklyCompletionError(true);
    } finally {
      completingReviewRef.current = null;
      setIsFinishingWeeklyReview(false);
    }
  }, [
    review,
    capture,
    answers,
    memorableItems,
    saveReview,
    weekStart,
    navigation,
  ]);

  const finishMonthlyReview = useCallback(async () => {
    if (!review || completingReviewRef.current === review.id) {
      return;
    }
    completingReviewRef.current = review.id;
    setIsFinishingMonthlyReview(true);
    setMonthlyCompletionError(false);
    triggerLightHaptic();
    try {
      const capturedPrayerSnapshot: ReviewPrayerSnapshotItem[] = (
        capture?.items || []
      )
        .filter(
          item =>
            item.kind === 'prayer' && item.prayerEventType && item.prayerId,
        )
        .map(item => ({
          id: item.id,
          prayerId: item.prayerId!,
          needId: item.needId,
          requestId: item.requestId,
          eventType: item.prayerEventType!,
          eventDate: item.selectedDate,
          title: item.title,
          subtitle: item.subtitle || 'Prayer',
          text: item.text,
          prayerTypeLabel: item.prayerTypeLabel,
        }));
      const completeMonthlyPrayerSnapshot: ReviewPrayerSnapshotItem[] = [
        ...(capture?.monthlyPrayerReflection?.answered ?? []),
        ...(capture?.monthlyPrayerReflection?.waiting ?? []),
      ].map(item => ({
        id: item.id,
        prayerId: item.prayerId,
        needId: item.needId,
        requestId: item.requestId,
        eventType: item.eventType,
        eventDate: item.eventDate,
        title: item.title,
        subtitle: item.subtitle,
        text: item.text,
      }));
      const prayerSnapshot = [
        ...new Map(
          [...completeMonthlyPrayerSnapshot, ...capturedPrayerSnapshot].map(
            item => [item.id, item],
          ),
        ).values(),
      ];
      await saveMonthlyReviewPrayer({
        text: answers.prayer_for_month ?? '',
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        reviewId: review.id,
      });
      const completedAnswers = {
        ...answers,
        ...(monthlyPatternSummary
          ? {month_pattern_summary: monthlyPatternSummary}
          : {}),
      };
      await saveReview({
        answers: completedAnswers,
        memorableItems,
        status: 'completed',
        completedAt: review.completedAt ?? new Date().toISOString(),
        prayerSnapshot,
      });
      DeviceEventEmitter.emit(FAITHFUL_RHYTHM_UPDATED, {
        rhythm: 'reviews',
        selectedDate: review.periodEnd,
      });
      const celebrate =
        review.status !== 'completed' &&
        (await claimFaithfulRhythmCelebration(
          'reviews',
          review.periodEnd,
          weekStart,
        ));
      if (celebrate) {
        navigation.navigate('StreakPlan', {
          rhythm: 'reviews',
          source: 'review_complete',
        });
      } else {
        navigation.goBack();
      }
    } catch {
      setMonthlyCompletionError(true);
    } finally {
      completingReviewRef.current = null;
      setIsFinishingMonthlyReview(false);
    }
  }, [
    review,
    capture,
    answers,
    monthlyPatternSummary,
    memorableItems,
    saveReview,
    weekStart,
    navigation,
  ]);

  const goTo = useCallback(
    (next: ReviewStage) => {
      if (next < 1 || next > stageCount) {
        return;
      }
      triggerLightHaptic();
      Keyboard.dismiss();
      scrollRef.current?.scrollTo({y: 0, animated: false});
      const continuingWalkthrough =
        editingReviewSummaryRef.current &&
        stages[stage - 1]?.key === 'looking_forward_feeling' &&
        next === stage + 1;
      const returnToSummary =
        editingReviewSummaryRef.current &&
        !continuingWalkthrough &&
        next === stage + 1;
      if (!continuingWalkthrough) {
        editingReviewSummaryRef.current = false;
      }
      const destination = returnToSummary ? stageCount : next;
      const destinationStage = stages[destination - 1];
      if (
        reviewRef.current?.status === 'draft' &&
        destinationStage &&
        destinationStage.kind !== 'cover'
      ) {
        saveReview({lastStageKey: destinationStage.key}).catch(error =>
          Logger.error('Failed to save Review resume position', error as Error, {
            component: 'ReviewScreen',
            reviewId: reviewRef.current?.id,
            stageKey: destinationStage.key,
          }),
        );
      }
      setStage(destination);
    },
    [saveReview, stage, stageCount, stages],
  );

  const resumeReview = useCallback(() => {
    const savedStageIndex = review?.lastStageKey
      ? stages.findIndex(item => item.key === review.lastStageKey)
      : -1;
    goTo(savedStageIndex > 0 ? savedStageIndex + 1 : 2);
  }, [goTo, review?.lastStageKey, stages]);

  const beginMonthlyReview = useCallback(() => {
    if (review && !review.monthlyWeeklyBookmarksInitialized) {
      const existingKeys = new Set(
        memorableItems.map(item => `${item.id}:${item.selectedDate}`),
      );
      const weeklyBookmarks = (capture?.items ?? [])
        .filter(item => item.carriedForwardFrom?.includes('weekly'))
        .filter(item => !existingKeys.has(`${item.id}:${item.selectedDate}`))
        .map(memorableReferenceFor);
      const initializedMemorableItems = [...memorableItems, ...weeklyBookmarks];
      setMemorableItems(initializedMemorableItems);
      saveReview({
        memorableItems: initializedMemorableItems,
        monthlyWeeklyBookmarksInitialized: true,
      }).catch(error =>
        Logger.error(
          'Failed to initialize Monthly Review weekly bookmarks',
          error as Error,
          {component: 'ReviewScreen', reviewId: review.id},
        ),
      );
    }
    resumeReview();
  }, [capture, memorableItems, resumeReview, review, saveReview]);

  const stageRef = useRef(stage);
  const stageCountRef = useRef(stageCount);
  const pageSwipeDisabledRef = useRef(disablesPageSwipe);
  const horizontalCarouselGestureRef = useRef(false);

  useEffect(() => {
    stageRef.current = stage;
    horizontalCarouselGestureRef.current = false;
  }, [stage]);

  useEffect(() => {
    stageCountRef.current = stageCount;
  }, [stageCount]);

  useEffect(() => {
    pageSwipeDisabledRef.current = disablesPageSwipe;
  }, [disablesPageSwipe]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !pageSwipeDisabledRef.current &&
          !horizontalCarouselGestureRef.current &&
          Math.abs(g.dx) > 12 &&
          Math.abs(g.dy) < Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          const threshold = 40;
          if (g.dx < -threshold && stageRef.current < stageCountRef.current) {
            goTo(stageRef.current + 1);
          } else if (g.dx > threshold && stageRef.current > 1) {
            goTo(stageRef.current - 1);
          }
        },
      }),
    [goTo],
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  const periodLabel = useMemo(() => {
    if (!periodStart || !periodEnd) {
      return '';
    }
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const month = start
      .toLocaleString('default', {month: 'short'})
      .toUpperCase();
    return `${month} ${start.getDate()}–${end.getDate()}`;
  }, [periodStart, periodEnd]);

  const currentYear = new Date().getFullYear();

  const weeklyPeriodLabel = useMemo(
    () =>
      periodStart && periodEnd
        ? formatWeeklyGratitudePeriod(periodStart, periodEnd, currentYear)
        : '',
    [currentYear, periodEnd, periodStart],
  );

  const weeklyLookingAheadPeriodLabel = useMemo(
    () => formatWeeklyLookingAheadPeriod(periodEnd, currentYear),
    [currentYear, periodEnd],
  );

  const monthlyPeriodLabel = useMemo(
    () =>
      periodStart
        ? formatReviewedMonthPeriod(periodStart, currentYear)
        : '',
    [currentYear, periodStart],
  );

  const monthlyLookingAheadPeriodLabel = useMemo(
    () =>
      periodEnd ? formatNextMonthPeriod(periodEnd, currentYear) : '',
    [currentYear, periodEnd],
  );

  const monthlyLookingAheadMonthName = useMemo(() => {
    if (!periodEnd) {
      return 'next month';
    }
    const [year, month] = periodEnd.split('-').map(Number);
    return new Date(year, month, 1, 12).toLocaleDateString(undefined, {
      month: 'long',
    });
  }, [periodEnd]);

  const weeklyCoverSummary = useMemo(
    () =>
      capture
        ? getReviewCoverSummary(
            capture,
            weeklyRhythm
              ? {morning: weeklyRhythm.morning, evening: weeklyRhythm.evening}
              : undefined,
          )
        : [],
    [capture, weeklyRhythm],
  );
  const visibleWeeklyCoverSummary = showAllWeeklySummary
    ? weeklyCoverSummary
    : weeklyCoverSummary.slice(0, WEEKLY_COVER_METRIC_LIMIT);
  const hiddenWeeklyCoverMetricCount = Math.max(
    0,
    weeklyCoverSummary.length - visibleWeeklyCoverSummary.length,
  );

  const monthlyActiveDates = useMemo(
    () => [...new Set((capture?.items ?? []).map(item => item.selectedDate))],
    [capture],
  );
  const monthlyWeekActivity = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    monthlyActiveDates.forEach(value => {
      const day = Number(value.slice(-2));
      counts[Math.min(4, Math.floor((day - 1) / 7))] += 1;
    });
    return counts;
  }, [monthlyActiveDates]);
  const monthlyDayCount = useMemo(() => {
    if (!periodStart || !periodEnd) {
      return 0;
    }
    const [startYear, startMonth, startDay] = periodStart
      .split('-')
      .map(Number);
    const [endYear, endMonth, endDay] = periodEnd.split('-').map(Number);
    return (
      Math.round(
        (new Date(endYear, endMonth - 1, endDay, 12).getTime() -
          new Date(startYear, startMonth - 1, startDay, 12).getTime()) /
          86400000,
      ) + 1
    );
  }, [periodEnd, periodStart]);

  const weeklyGratitudeDates = useMemo(
    () =>
      [
        ...new Set(
          (capture?.items ?? [])
            .filter(
              item =>
                item.presentation === 'gratitude_list' &&
                item.lines?.some(line => line.trim()),
            )
            .map(item => item.selectedDate),
        ),
      ].sort(),
    [capture],
  );

  const revealWeeklyGratitudeInput = useCallback((index: number) => {
    const input = weeklyGratitudeInputRefs.current[index];
    const inputHandle = input ? findNodeHandle(input) : null;
    if (!inputHandle) {
      return;
    }
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      inputHandle,
      80,
      true,
    );
  }, []);

  const addWeeklyPriorityInput = useCallback(() => {
    if (weeklyPriorityInputCount >= 3) {
      return;
    }
    triggerLightHaptic();
    const index = weeklyPriorityInputCount;
    setWeeklyPriorityInputCount(count => Math.min(3, count + 1));
    requestAnimationFrame(() => weeklyPriorityInputsRef.current?.focus(index));
  }, [weeklyPriorityInputCount]);

  const onAnswerChange = (beat: string, text: string) => {
    const next = {...answers, [beat]: text};
    setAnswers(next);
    // Autosave draft
    saveReview({answers: next});
    if (
      reviewType === 'weekly' &&
      review &&
      isWeeklyLookingForwardAnswerKey(beat)
    ) {
      saveWeeklyLookingForwardMoment({
        answers: next,
        periodStart,
        periodEnd,
        reviewId: review.id,
      }).catch(error =>
        Logger.error('Failed to save weekly Looking Forward', error as Error, {
          component: 'ReviewScreen',
          reviewId: review.id,
        }),
      );
    }
    if (
      isWeeklyGratitudeAnswerKey(beat) &&
      reviewType === 'weekly' &&
      review &&
      periodStart &&
      periodEnd
    ) {
      if (weeklyGratitudeSaveTimerRef.current) {
        clearTimeout(weeklyGratitudeSaveTimerRef.current);
      }
      pendingWeeklyGratitudeRef.current = {
        items: getWeeklyGratitudeItems(next),
        periodStart,
        periodEnd,
        reviewId: review.id,
      };
      weeklyGratitudeSaveTimerRef.current = setTimeout(() => {
        weeklyGratitudeSaveTimerRef.current = null;
        const pendingWeeklyGratitude = pendingWeeklyGratitudeRef.current;
        pendingWeeklyGratitudeRef.current = null;
        if (!pendingWeeklyGratitude) {
          return;
        }
        saveWeeklyGratitudeMoment(pendingWeeklyGratitude).catch(error => {
          Logger.error(
            'Failed to save Weekly Gratitude Moment',
            error as Error,
            {
              component: 'ReviewScreen',
              reviewId: pendingWeeklyGratitude.reviewId,
            },
          );
        });
      }, 350);
    }
  };

  const toggleMemorable = (item: ReviewCaptureItem) => {
    triggerLightHaptic();
    const exists = memorableItems.find(
      m => m.id === item.id && m.selectedDate === item.selectedDate,
    );
    const next = exists
      ? memorableItems.filter(
          m => !(m.id === item.id && m.selectedDate === item.selectedDate),
        )
      : [...memorableItems, memorableReferenceFor(item)];
    setMemorableItems(next);
    saveReview({memorableItems: next});
  };

  const toggleMemorableGroup = (items: ReviewCaptureItem[]) => {
    triggerLightHaptic();
    const itemKeys = new Set(
      items.map(item => `${item.id}:${item.selectedDate}`),
    );
    const allSelected = items.every(item =>
      memorableItems.some(
        memorable =>
          memorable.id === item.id &&
          memorable.selectedDate === item.selectedDate,
      ),
    );
    const retained = memorableItems.filter(
      item => !itemKeys.has(`${item.id}:${item.selectedDate}`),
    );
    const next = allSelected
      ? retained
      : [...retained, ...items.map(memorableReferenceFor)];
    setMemorableItems(next);
    saveReview({memorableItems: next});
  };

  const renderCurrentStage = (): React.ReactNode => {
    const current = stages[stage - 1];
    if (!current) {
      return null;
    }

    if (current.kind === 'cover') {
      const eyebrow =
        current.eyebrow ??
        `${reviewType.replace('_', ' ').toUpperCase()} REVIEW`;
      if (reviewType === 'weekly') {
        const activeDays = weeklyRhythm?.activeDays ?? 0;
        const activeDayLabel = `${activeDays} ${
          activeDays === 1 ? 'day' : 'days'
        } this week`;
        return (
          <View
            style={[
              styles.stage,
              styles.weeklyCoverStage,
              {
                minHeight: Math.max(
                  0,
                  screenHeight - topInset - insets.bottom - 64,
                ),
              },
            ]}>
            <StaggeredReviewStage
              animationKey={current.key}
              enabled
              style={styles.weeklyCoverContent}>
              <Image
                accessible={false}
                resizeMode="contain"
                source={require('../../assets/images/reviews/weekly-cover-looking-back-v2.png')}
                style={styles.weeklyCoverArtwork}
              />
              <View style={styles.weeklyCoverHero}>
                <View style={styles.weeklyCoverLabelRow}>
                  <Ionicons name="leaf-outline" size={15} color={Colors.sage} />
                  <ThemedText
                    weight="semiBold"
                    style={styles.weeklyCoverEyebrow}>
                    WEEKLY REVIEW
                  </ThemedText>
                </View>
                <ThemedText
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={2}
                  weight="bold"
                  style={styles.reviewPeriodHeadline}>
                  {weeklyPeriodLabel}
                </ThemedText>
                <ThemedText
                  weight="semiBold"
                  style={styles.reviewDirectionPrompt}>
                  Now, let’s look back.
                </ThemedText>
                <ThemedText style={styles.weeklyCoverSubtitle}>
                  Pause. Notice what mattered. Carry it forward.
                </ThemedText>
              </View>

              <View style={styles.weeklyShowedUpCard}>
                <View style={styles.weeklyShowedUpHeader}>
                  <View style={styles.weeklyShowedUpIcon}>
                    <Ionicons
                      name="leaf-outline"
                      size={19}
                      color={Colors.sage}
                    />
                  </View>
                  <View style={styles.weeklyShowedUpCopy}>
                    <ThemedText
                      weight="semiBold"
                      style={styles.weeklyShowedUpLabel}>
                      YOU SHOWED UP
                    </ThemedText>
                    <ThemedText
                      weight="semiBold"
                      style={styles.weeklyShowedUpTotal}>
                      {activeDayLabel}
                    </ThemedText>
                  </View>
                  <View style={styles.weeklyShowedUpBadge}>
                    <ThemedText
                      weight="bold"
                      style={styles.weeklyShowedUpBadgeValue}>
                      {activeDays}
                    </ThemedText>
                    <ThemedText style={styles.weeklyShowedUpBadgeTotal}>
                      / 7
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.weeklyDayChart}>
                  {(weeklyRhythm?.days ?? []).map(day => {
                    const [year, month, date] = day.date.split('-').map(Number);
                    const label = new Date(
                      year,
                      month - 1,
                      date,
                      12,
                    ).toLocaleDateString(undefined, {weekday: 'narrow'});
                    const height = day.active
                      ? Math.min(28, 8 + day.activity * 3)
                      : 5;
                    return (
                      <View
                        accessible
                        accessibilityLabel={`${label}, ${
                          day.active
                            ? `${day.activity} activities`
                            : 'no activity'
                        }`}
                        key={day.date}
                        style={styles.weeklyDayColumn}>
                        <View style={styles.weeklyDayTrack}>
                          <View
                            style={[
                              styles.weeklyDayBar,
                              {height},
                              day.active
                                ? styles.weeklyDayBarActive
                                : styles.weeklyDayBarQuiet,
                            ]}
                          />
                        </View>
                        <ThemedText
                          weight="semiBold"
                          style={[
                            styles.weeklyDayLabel,
                            day.active && styles.weeklyDayLabelActive,
                          ]}>
                          {label}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
                {weeklyCoverSummary.length > 0 && (
                  <View style={styles.weeklySummarySection}>
                    <View style={styles.weeklySummaryHeading}>
                      <ThemedText
                        weight="semiBold"
                        style={styles.weeklySummaryEyebrow}>
                        YOUR WEEK AT A GLANCE
                      </ThemedText>
                      <View style={styles.weeklySummaryRule} />
                    </View>
                    <View style={styles.weeklySummaryMetrics}>
                      {visibleWeeklyCoverSummary.map(item => (
                        <View
                          key={item.key}
                          style={styles.weeklySummaryMetricSlot}>
                          <View style={styles.weeklySummaryPill}>
                            <ThemedText
                              weight="bold"
                              style={styles.weeklySummaryCount}>
                              {item.count}
                            </ThemedText>
                            <ThemedText style={styles.weeklySummaryLabel}>
                              {item.label}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                    {weeklyCoverSummary.length > WEEKLY_COVER_METRIC_LIMIT && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          showAllWeeklySummary
                            ? 'Show fewer weekly highlights'
                            : `Show ${hiddenWeeklyCoverMetricCount} more weekly highlights`
                        }
                        activeOpacity={0.7}
                        onPress={() => {
                          triggerLightHaptic();
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                          setShowAllWeeklySummary(value => !value);
                        }}
                        style={styles.weeklySummaryToggle}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.weeklySummaryToggleText}>
                          {showAllWeeklySummary
                            ? 'Show less'
                            : `${hiddenWeeklyCoverMetricCount} more from your week`}
                        </ThemedText>
                        <Ionicons
                          name={
                            showAllWeeklySummary ? 'chevron-up' : 'chevron-down'
                          }
                          size={15}
                          color={Colors.sage}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </StaggeredReviewStage>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                hasSavedProgress
                  ? 'Continue weekly review'
                  : 'Begin weekly review'
              }
              style={[styles.primaryButton, styles.weeklyBeginButton]}
              onPress={resumeReview}
              activeOpacity={0.8}>
              <ThemedText weight="bold" style={styles.weeklyBeginText}>
                {hasSavedProgress ? 'Continue review' : 'Begin review'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        );
      }
      if (reviewType === 'monthly') {
        const maxWeekActivity = Math.max(1, ...monthlyWeekActivity);
        return (
          <View
            style={[
              styles.stage,
              styles.weeklyCoverStage,
              styles.monthlyCoverStage,
              {
                minHeight: Math.max(
                  0,
                  screenHeight - topInset - insets.bottom - 64,
                ),
              },
            ]}>
            <StaggeredReviewStage
              animationKey={current.key}
              enabled
              style={styles.weeklyCoverContent}>
              <Image
                accessible={false}
                resizeMode="contain"
                source={require('../../assets/images/reviews/weekly-cover-looking-back-v2.png')}
                style={[styles.weeklyCoverArtwork, styles.monthlyCoverArtwork]}
              />
              <View style={[styles.weeklyCoverHero, styles.monthlyCoverHero]}>
                <View style={styles.weeklyCoverLabelRow}>
                  <Ionicons name="leaf-outline" size={15} color={Colors.sage} />
                  <ThemedText
                    weight="semiBold"
                    style={styles.weeklyCoverEyebrow}>
                    MONTHLY REVIEW
                  </ThemedText>
                </View>
                <ThemedText weight="bold" style={styles.reviewPeriodHeadline}>
                  {monthlyPeriodLabel}
                </ThemedText>
                <ThemedText
                  weight="semiBold"
                  style={styles.reviewDirectionPrompt}>
                  Now, let’s look back.
                </ThemedText>
                <ThemedText
                  style={[
                    styles.weeklyCoverSubtitle,
                    styles.monthlyCoverSubtitle,
                  ]}>
                  Notice what shaped you, where God met you, and what you want
                  to carry forward.
                </ThemedText>
              </View>

              <View
                style={[styles.weeklyShowedUpCard, styles.monthlyShowedUpCard]}>
                <View style={styles.weeklyShowedUpHeader}>
                  <View style={styles.weeklyShowedUpIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={Colors.sage}
                    />
                  </View>
                  <View style={styles.weeklyShowedUpCopy}>
                    <ThemedText
                      weight="semiBold"
                      style={styles.weeklyShowedUpLabel}>
                      YOUR MONTH AT A GLANCE
                    </ThemedText>
                    <ThemedText
                      weight="semiBold"
                      style={styles.weeklyShowedUpTotal}>
                      {monthlyActiveDates.length}{' '}
                      {monthlyActiveDates.length === 1 ? 'day' : 'days'} with
                      moments
                    </ThemedText>
                  </View>
                  <View style={styles.weeklyShowedUpBadge}>
                    <ThemedText
                      weight="bold"
                      style={styles.weeklyShowedUpBadgeValue}>
                      {monthlyActiveDates.length}
                    </ThemedText>
                    <ThemedText style={styles.weeklyShowedUpBadgeTotal}>
                      / {monthlyDayCount}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.weeklyDayChart, styles.monthlyDayChart]}>
                  {monthlyWeekActivity.map((count, index) => {
                    const height =
                      count > 0 ? 7 + (count / maxWeekActivity) * 22 : 5;
                    return (
                      <View
                        accessible
                        accessibilityLabel={`Week ${index + 1}, ${count} ${
                          count === 1 ? 'active day' : 'active days'
                        }`}
                        key={index}
                        style={styles.weeklyDayColumn}>
                        <View style={styles.weeklyDayTrack}>
                          <View
                            style={[
                              styles.weeklyDayBar,
                              {height},
                              count > 0
                                ? styles.weeklyDayBarActive
                                : styles.weeklyDayBarQuiet,
                            ]}
                          />
                        </View>
                        <ThemedText
                          weight="semiBold"
                          style={[
                            styles.weeklyDayLabel,
                            count > 0 && styles.weeklyDayLabelActive,
                          ]}>
                          W{index + 1}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
                {weeklyCoverSummary.length > 0 && (
                  <View
                    style={[
                      styles.weeklySummarySection,
                      styles.monthlySummarySection,
                    ]}>
                    <View style={styles.weeklySummaryHeading}>
                      <ThemedText
                        weight="semiBold"
                        style={styles.weeklySummaryEyebrow}>
                        WHAT FILLED YOUR MONTH
                      </ThemedText>
                      <View style={styles.weeklySummaryRule} />
                    </View>
                    <View
                      style={[
                        styles.weeklySummaryMetrics,
                        styles.monthlySummaryMetrics,
                      ]}>
                      {visibleWeeklyCoverSummary.map(item => (
                        <View
                          key={item.key}
                          style={styles.weeklySummaryMetricSlot}>
                          <View
                            style={[
                              styles.weeklySummaryPill,
                              styles.monthlySummaryPill,
                            ]}>
                            <ThemedText
                              weight="bold"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.82}
                              style={[
                                styles.weeklySummaryCount,
                                styles.monthlySummaryCount,
                              ]}>
                              {item.count}
                            </ThemedText>
                            <ThemedText style={styles.weeklySummaryLabel}>
                              {item.label}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                    {weeklyCoverSummary.length > WEEKLY_COVER_METRIC_LIMIT && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          showAllWeeklySummary
                            ? 'Show fewer monthly highlights'
                            : `Show ${hiddenWeeklyCoverMetricCount} more monthly highlights`
                        }
                        activeOpacity={0.7}
                        onPress={() => {
                          triggerLightHaptic();
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                          setShowAllWeeklySummary(value => !value);
                        }}
                        style={[
                          styles.weeklySummaryToggle,
                          styles.monthlySummaryToggle,
                        ]}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.weeklySummaryToggleText}>
                          {showAllWeeklySummary
                            ? 'Show less'
                            : `${hiddenWeeklyCoverMetricCount} more from your month`}
                        </ThemedText>
                        <Ionicons
                          name={
                            showAllWeeklySummary ? 'chevron-up' : 'chevron-down'
                          }
                          size={15}
                          color={Colors.sage}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </StaggeredReviewStage>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                hasSavedProgress
                  ? 'Continue monthly review'
                  : 'Begin monthly review'
              }
              style={[
                styles.primaryButton,
                styles.weeklyBeginButton,
                styles.monthlyBeginButton,
              ]}
              onPress={beginMonthlyReview}
              activeOpacity={0.8}>
              <ThemedText weight="bold" style={styles.weeklyBeginText}>
                {hasSavedProgress ? 'Continue review' : 'Begin review'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={styles.stage}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>
            {eyebrow}
          </ThemedText>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>
          <ThemedText style={styles.subtitle}>{current.subtitle}</ThemedText>

          {capture && (
            <View style={styles.captureStats}>
              <ThemedText weight="bold" style={styles.captureStatTotal}>
                {capture.items.length} moments from your{' '}
                {reviewType.replace('_', ' ')}
              </ThemedText>
              {Object.entries(capture.summary)
                .filter(([, count]) => count > 0)
                .map(([kind, count]) => (
                  <View key={kind} style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>
                      {CATEGORY_LABELS[kind as ReviewCaptureKind]}
                    </ThemedText>
                    <ThemedText
                      weight="semiBold"
                      style={styles.captureStatValue}>
                      {count}
                    </ThemedText>
                  </View>
                ))}
              {capture.prayerStats.total > 0 ? (
                <>
                  <View style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>
                      Prayers answered
                    </ThemedText>
                    <ThemedText
                      weight="semiBold"
                      style={styles.captureStatValue}>
                      {capture.prayerStats.answered}
                    </ThemedText>
                  </View>
                  <View style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>
                      Still praying
                    </ThemedText>
                    <ThemedText
                      weight="semiBold"
                      style={styles.captureStatValue}>
                      {capture.prayerStats.pending}
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => goTo(2)}
            activeOpacity={0.7}>
            <ThemedText weight="bold" style={styles.primaryButtonText}>
              {reviewType === 'year_end'
                ? 'Review my year'
                : 'Review my ' + reviewType.replace('_', ' ')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (
      (reviewType === 'weekly' || reviewType === 'monthly') &&
      (current.kind === 'captured' || current.kind === 'remembered')
    ) {
      const showingRemembered = current.kind === 'remembered';
      const periodWord = reviewType === 'monthly' ? 'month' : 'week';
      const rememberedKeys = new Set(
        memorableItems.map(item => `${item.id}:${item.selectedDate}`),
      );
      const allCapturedMoments = [...(capture?.items ?? [])];
      const weeklyBookmarkedMoments = allCapturedMoments.filter(item =>
        item.carriedForwardFrom?.includes('weekly'),
      );
      const otherMonthlyMoments = allCapturedMoments.filter(
        item => !item.carriedForwardFrom?.includes('weekly'),
      );
      const hasWeeklyBookmarks = weeklyBookmarkedMoments.length > 0;
      const showingMonthlyWeeklyBookmarks =
        reviewType === 'monthly' &&
        !showingRemembered &&
        hasWeeklyBookmarks &&
        monthlyMomentsView === 'weekly_bookmarks';
      const visibleCapturedMoments = showingMonthlyWeeklyBookmarks
        ? weeklyBookmarkedMoments
        : reviewType === 'monthly' && !showingRemembered
        ? otherMonthlyMoments
        : allCapturedMoments;
      const moments = visibleCapturedMoments
        .filter(
          item =>
            !showingRemembered ||
            rememberedKeys.has(`${item.id}:${item.selectedDate}`),
        )
        .sort((a, b) => a.selectedDate.localeCompare(b.selectedDate));
      const heartJournalGroup = {
        key: 'heart-journal',
        presentation: 'heart_journal' as ReviewCapturePresentation,
        title: 'Heart Journal',
        items: moments.filter(item =>
          HEART_JOURNAL_PRESENTATIONS.has(item.presentation),
        ),
      };
      const presentationGroups = CAPTURE_PRESENTATION_GROUPS.map(group => ({
        ...group,
        key: group.presentation,
        items: moments.filter(item => item.presentation === group.presentation),
      }));
      const momentGroups = [
        ...presentationGroups.slice(0, 10),
        heartJournalGroup,
        ...presentationGroups.slice(10),
      ].filter(group => group.items.length > 0);
      const carouselCardWidth = Math.min(310, Math.max(240, screenWidth - 76));
      return (
        <ReviewMomentsList
          ref={reviewMomentsListRef}
          key={current.key}
          groups={momentGroups}
          cardWidth={carouselCardWidth}
          onCarouselTouchStart={
            reviewType === 'monthly'
              ? () => {
                  horizontalCarouselGestureRef.current = true;
                }
              : undefined
          }
          onCarouselTouchEnd={
            reviewType === 'monthly'
              ? () => {
                  horizontalCarouselGestureRef.current = false;
                }
              : undefined
          }
          contentContainerStyle={[
            styles.weeklyCapturedStage,
            {
              paddingTop: topInset + 64,
              paddingBottom: keyboardVisible ? 320 : insets.bottom + 112,
            },
          ]}
          header={
            <View style={styles.weeklyCapturedHeading}>
              <View style={styles.feelingsLabelRow}>
                <Ionicons
                  name="leaf-outline"
                  size={reviewType === 'monthly' ? 17 : 15}
                  color={Colors.sage}
                />
                <ThemedText weight="semiBold" style={styles.feelingsLabel}>
                  LOOKING BACK
                </ThemedText>
              </View>
              <ThemedText weight="bold" style={styles.weeklyCapturedTitle}>
                {showingRemembered
                  ? current.title ?? 'What you want to remember'
                  : reviewType === 'monthly'
                  ? 'What shaped this month?'
                  : `Moments from this ${periodWord}`}
              </ThemedText>
              <ThemedText style={styles.weeklyCapturedSubtitle}>
                {showingRemembered && reviewType === 'monthly' ? (
                  'These are the moments that shaped the month and stayed with you.'
                ) : showingRemembered ? (
                  'These are the moments you bookmarked to carry forward.'
                ) : showingMonthlyWeeklyBookmarks ? (
                  <>
                    {
                      'These were bookmarked in your weekly reviews and are already hearted.\nUnheart anything you do not want to carry forward.'
                    }
                  </>
                ) : (
                  <>
                    {
                      reviewType === 'monthly'
                        ? 'Here are the moments you captured.\nTap the heart on anything that shaped your month.'
                        : 'Here are the moments you captured.\nTap the bookmark on anything you want to carry forward.'
                    }
                  </>
                )}
              </ThemedText>
              {reviewType === 'monthly' && !showingRemembered ? (
                hasWeeklyBookmarks ? (
                  <View
                    accessibilityRole="tablist"
                    style={styles.monthlyMomentsTabs}>
                    {(
                      [
                        {
                          key: 'weekly_bookmarks',
                          label: 'Weekly bookmarks',
                          count: weeklyBookmarkedMoments.length,
                        },
                        {
                          key: 'all',
                          label: 'More moments',
                          count: otherMonthlyMoments.length,
                        },
                      ] as const
                    ).map(option => {
                      const selected = monthlyMomentsView === option.key;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          accessibilityRole="tab"
                          accessibilityLabel={`${option.label}, ${option.count}`}
                          accessibilityState={{selected}}
                          activeOpacity={0.78}
                          onPress={() => {
                            triggerLightHaptic();
                            setMonthlyMomentsView(option.key);
                          }}
                          style={[
                            styles.monthlyMomentsTab,
                            selected && styles.monthlyMomentsTabActive,
                          ]}>
                          <ThemedText
                            weight="semiBold"
                            style={[
                              styles.monthlyMomentsTabText,
                              selected && styles.monthlyMomentsTabTextActive,
                            ]}>
                            {option.label} · {option.count}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.monthlyMomentsFallback}>
                    <Ionicons
                      name="heart-outline"
                      size={16}
                      color={Colors.alertCoral}
                    />
                    <ThemedText style={styles.monthlyMomentsFallbackText}>
                      No weekly bookmarks yet, so all moments are shown.
                    </ThemedText>
                  </View>
                )
              ) : null}
            </View>
          }
          renderGroupHeader={group => (
            <View style={styles.weeklyMomentGroupHeader}>
              <View style={styles.weeklyMomentGroupTitleRow}>
                <CaptureGroupIcon presentation={group.presentation} />
                <ThemedText
                  weight="semiBold"
                  style={styles.weeklyMomentGroupTitle}>
                  {group.title}
                </ThemedText>
              </View>
              {!!captureGroupCountLabel(group.presentation, group.items) && (
                <ThemedText style={styles.weeklyMomentGroupCount}>
                  {captureGroupCountLabel(group.presentation, group.items)}
                </ThemedText>
              )}
            </View>
          )}
          renderCard={({item, relatedItems}) => {
            const isSelected = relatedItems.every(related =>
              memorableItems.some(
                memorable =>
                  memorable.id === related.id &&
                  memorable.selectedDate === related.selectedDate,
              ),
            );
            return (
              <WeeklyMomentCard
                item={item}
                selected={isSelected}
                width={carouselCardWidth}
                relatedItems={relatedItems}
                selectionAppearance={
                  reviewType === 'monthly' ? 'heart' : 'bookmark'
                }
                onPress={() =>
                  relatedItems.length > 1
                    ? toggleMemorableGroup(relatedItems)
                    : toggleMemorable(item)
                }
              />
            );
          }}
          empty={
            <View style={styles.weeklyMomentsCard}>
              <View style={styles.weeklyMomentsEmpty}>
                <ThemedText style={styles.weeklyMomentsEmptyText}>
                  {showingRemembered
                    ? reviewType === 'monthly'
                      ? `You didn’t heart any moments from this ${periodWord}.`
                      : `You didn’t bookmark any moments from this ${periodWord}.`
                    : reviewType === 'monthly' &&
                      hasWeeklyBookmarks &&
                      monthlyMomentsView === 'all'
                    ? 'Every captured moment was already hearted from a weekly review.'
                    : `No journal moments were captured this ${periodWord}.`}
                </ThemedText>
              </View>
            </View>
          }
          footer={
            showingRemembered && reviewType === 'weekly' ? (
              <View style={styles.weeklyAdditionalMemory}>
                <ThemedText
                  weight="semiBold"
                  style={styles.weeklyAdditionalMemoryTitle}>
                  Anything else you want to remember?
                </ThemedText>
                <TextInput
                  ref={weeklyAdditionalMemoryInputRef}
                  style={[styles.input, styles.weeklyAdditionalMemoryInput]}
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  value={answers.week_memory_other ?? ''}
                  onFocus={() =>
                    requestAnimationFrame(revealWeeklyAdditionalMemoryInput)
                  }
                  onChangeText={text =>
                    onAnswerChange('week_memory_other', text)
                  }
                  placeholder="I also want to remember…"
                  placeholderTextColor={Colors.textGray}
                  accessibilityLabel="Anything else you want to remember?"
                />
              </View>
            ) : undefined
          }
        />
      );
    }

    if (current.kind === 'captured') {
      const carriedForwardItems =
        capture?.items.filter(item => item.carriedForwardFrom?.length) ?? [];
      const otherItems =
        capture?.items.filter(item => !item.carriedForwardFrom?.length) ?? [];
      const renderCaptureItem = (item: ReviewCaptureItem) => {
        const isSel = memorableItems.some(
          memorable =>
            memorable.id === item.id &&
            memorable.selectedDate === item.selectedDate,
        );
        return (
          <View key={`${item.kind}-${item.id}`} style={styles.captureItem}>
            <View style={styles.captureItemHeader}>
              <ThemedText weight="semiBold" style={styles.captureItemTitle}>
                {item.title}
              </ThemedText>
              {item.subtitle ? (
                <ThemedText style={styles.captureItemSubtitle}>
                  {item.subtitle} · {item.selectedDate}
                </ThemedText>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{checked: isSel}}
              accessibilityLabel={`${
                isSel ? 'Remove from remembered' : 'Remember this'
              }: ${item.title}`}
              style={[
                styles.rememberButton,
                isSel && styles.rememberButtonActive,
              ]}
              onPress={() => toggleMemorable(item)}
              activeOpacity={0.8}>
              <Ionicons
                name={isSel ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSel ? Colors.hopeWhite : Colors.sage}
              />
            </TouchableOpacity>
          </View>
        );
      };
      return (
        <View style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {capture
              ? `${capture.items.length} moments from your ${reviewType.replace(
                  '_',
                  ' ',
                )}. Remember what you want to carry forward.`
              : 'Loading…'}
          </ThemedText>
          {carriedForwardItems.length > 0 ? (
            <View style={styles.carryForwardSection}>
              <View style={styles.carryForwardHeadingRow}>
                <Ionicons name="bookmark" size={15} color={Colors.sage} />
                <ThemedText
                  weight="semiBold"
                  style={styles.carryForwardEyebrow}>
                  {carryForwardHeading(reviewType)}
                </ThemedText>
              </View>
              <ThemedText style={styles.carryForwardCopy}>
                You marked these as meaningful before. Choose what still
                deserves to move forward.
              </ThemedText>
              {carriedForwardItems.map(renderCaptureItem)}
            </View>
          ) : null}
          {otherItems.length > 0 && carriedForwardItems.length > 0 ? (
            <ThemedText weight="semiBold" style={styles.allMomentsHeading}>
              ALL MOMENTS
            </ThemedText>
          ) : null}
          {otherItems.map(renderCaptureItem)}
        </View>
      );
    }

    if (current.kind === 'feelings') {
      const isMonthlyFeelings = reviewType === 'monthly';
      const customFeelingKey = isMonthlyFeelings
        ? 'month_feeling_other'
        : 'week_feeling_other';
      const selected = (answers[current.answerKey!] || '')
        .split('|')
        .filter(item => Boolean(item) && item.toLocaleLowerCase() !== 'other');
      const customFeeling = answers[customFeelingKey] ?? '';
      const hasCustomFeeling = Boolean(customFeeling.trim());
      const hasCustomChoice = showCustomFeelingInput || hasCustomFeeling;
      const selectionCount = selected.length + (hasCustomChoice ? 1 : 0);
      const uniqueWords = (words: readonly string[]) =>
        words.filter(
          (item, index, all) =>
            item.toLocaleLowerCase() !== 'other' &&
            all.findIndex(
              other => other.toLocaleLowerCase() === item.toLocaleLowerCase(),
            ) === index,
        );
      const suggestedNames = uniqueWords([
        ...WEEKLY_FEELING_WORDS,
        ...checkInFeelings.map(item => item.name),
        ...selected,
      ]);
      const collapsedNames = uniqueWords([
        ...suggestedNames.slice(0, WEEKLY_FEELINGS_PREVIEW_COUNT),
        ...selected,
      ]);
      const visibleNames =
        showAllWeeklyFeelings || closingFeelings !== null
          ? suggestedNames
          : collapsedNames;
      const optionNames = [...visibleNames, 'Other'];
      const toggleFeeling = (feeling: string) => {
        const isSelected = selected.includes(feeling);
        if (!isSelected && selectionCount >= 3) {
          return;
        }
        triggerLightHaptic();
        const next = isSelected
          ? selected.filter(item => item !== feeling)
          : [...selected, feeling];
        onAnswerChange(current.answerKey!, next.join('|'));
      };
      const toggleCustomFeeling = () => {
        if (hasCustomChoice) {
          triggerLightHaptic();
          pendingCustomFeelingFocusRef.current = false;
          Keyboard.dismiss();
          setShowCustomFeelingInput(false);
          onAnswerChange(customFeelingKey, '');
          return;
        }
        if (selectionCount >= 3) {
          return;
        }
        triggerLightHaptic();
        pendingCustomFeelingFocusRef.current = true;
        setShowCustomFeelingInput(true);
      };
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[
            styles.stage,
            styles.feelingsStage,
            {
              minHeight: Math.max(
                580,
                screenHeight - topInset - insets.bottom - 64,
              ),
            },
          ]}>
          <View style={styles.feelingsHeading}>
            <View style={styles.feelingsLabelRow}>
              <Ionicons
                name="leaf-outline"
                size={reviewType === 'monthly' ? 17 : 15}
                color={Colors.sage}
              />
              <ThemedText weight="semiBold" style={styles.feelingsLabel}>
                LOOKING BACK
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.feelingsQuestion}>
              {current.question}
            </ThemedText>
          </View>
          {checkInFeelings.length > 0 ? (
            <View style={styles.checkInSummary}>
              <ThemedText weight="semiBold" style={styles.checkInSummaryLabel}>
                YOUR MORNING CHECK-INS
              </ThemedText>
              {isMonthlyFeelings ? (
                <ThemedText style={styles.monthlyCheckInSummaryCopy}>
                  {checkInFeelings.reduce(
                    (total, item) => total + item.count,
                    0,
                  )}{' '}
                  mornings recorded · {checkInFeelings.length}{' '}
                  {checkInFeelings.length === 1 ? 'feeling' : 'feelings'}
                </ThemedText>
              ) : null}
              <View style={styles.checkInSummaryPills}>
                {checkInFeelings.map(item => {
                  const feelingKey = item.name.toLocaleLowerCase();
                  const expanded = expandedMonthlyFeeling === feelingKey;
                  const content = (
                    <ThemedText
                      weight="medium"
                      style={[
                        styles.checkInSummaryPillText,
                        expanded && styles.monthlyCheckInSummaryPillTextActive,
                      ]}>
                      {item.name}
                      {item.count > 1 ? ` ×${item.count}` : ''}
                    </ThemedText>
                  );
                  return isMonthlyFeelings ? (
                    <TouchableOpacity
                      key={feelingKey}
                      accessibilityRole="button"
                      accessibilityState={{expanded}}
                      accessibilityLabel={`${item.name}, ${item.count} ${
                        item.count === 1 ? 'morning' : 'mornings'
                      }`}
                      activeOpacity={0.78}
                      onPress={() => {
                        triggerLightHaptic();
                        setExpandedMonthlyFeeling(value =>
                          value === feelingKey ? null : feelingKey,
                        );
                      }}
                      style={[
                        styles.checkInSummaryPill,
                        expanded && styles.monthlyCheckInSummaryPillActive,
                      ]}>
                      {content}
                    </TouchableOpacity>
                  ) : (
                    <View key={feelingKey} style={styles.checkInSummaryPill}>
                      {content}
                    </View>
                  );
                })}
              </View>
              {isMonthlyFeelings ? (
                <ThemedText style={styles.monthlyCheckInHint}>
                  Tap a feeling to revisit those mornings.
                </ThemedText>
              ) : null}
              {isMonthlyFeelings && expandedMonthlyFeeling ? (
                <View style={styles.monthlyCheckInDetails}>
                  {checkInFeelings
                    .filter(
                      item =>
                        item.name.toLocaleLowerCase() ===
                        expandedMonthlyFeeling,
                    )
                    .flatMap(item => ('entries' in item ? item.entries : []))
                    .map(entry => (
                      <View
                        key={entry.date}
                        style={styles.monthlyCheckInDetailRow}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyCheckInDate}>
                          {formatCapturedDate(entry.date)}
                        </ThemedText>
                        <ThemedText style={styles.monthlyCheckInReflection}>
                          {entry.underneathIt || 'No reflection added.'}
                        </ThemedText>
                      </View>
                    ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.weeklyChoicePrompt}>
            <ThemedText
              weight="semiBold"
              style={styles.weeklyChoicePromptLabel}>
              {isMonthlyFeelings
                ? 'LOOKING AT THE WHOLE MONTH'
                : 'LOOKING AT THE WHOLE WEEK'}
            </ThemedText>
            <ThemedText style={styles.feelingsSubtitle}>
              Choose or write up to 3 words.
            </ThemedText>
          </View>
          <View style={styles.feelingsGrid}>
            {optionNames.map((feeling, pillIndex) => {
              const isOther = feeling === 'Other';
              const isSelected = selected.includes(feeling);
              const isOtherActive = isOther && hasCustomChoice;
              const atLimit = isOther
                ? !isOtherActive && selectionCount >= 3
                : !isSelected && selectionCount >= 3;
              const active = isOther ? isOtherActive : isSelected;
              const exitingIndex = closingFeelings
                ? closingFeelings.indexOf(feeling)
                : -1;
              const isExiting = exitingIndex >= 0;
              const pillDelay = showAllWeeklyFeelings
                ? Math.max(0, pillIndex - collapsedNames.length) *
                  REVIEW_PILL_STAGGER_MS
                : REVIEW_PILL_BASE_DELAY_MS +
                  pillIndex * REVIEW_PILL_STAGGER_MS;
              return (
                <StaggeredFeelingPill
                  key={feeling}
                  delay={pillDelay}
                  exiting={isExiting}
                  exitDelay={
                    isExiting
                      ? ((closingFeelings?.length ?? 1) - 1 - exitingIndex) *
                        REVIEW_PILL_STAGGER_MS
                      : 0
                  }>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{selected: active, disabled: atLimit}}
                    disabled={atLimit}
                    activeOpacity={0.8}
                    style={[
                      styles.feelingPill,
                      active && styles.feelingPillSelected,
                      atLimit && styles.feelingPillDisabled,
                    ]}
                    onPress={() =>
                      isOther ? toggleCustomFeeling() : toggleFeeling(feeling)
                    }>
                    <ThemedText
                      weight="semiBold"
                      style={[
                        styles.feelingPillText,
                        active && styles.feelingPillTextSelected,
                      ]}>
                      {feeling}
                    </ThemedText>
                  </TouchableOpacity>
                </StaggeredFeelingPill>
              );
            })}
          </View>
          {suggestedNames.length > WEEKLY_FEELINGS_PREVIEW_COUNT ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{expanded: showAllWeeklyFeelings}}
              activeOpacity={0.7}
              onPress={() => {
                triggerLightHaptic();
                if (feelingsCloseTimerRef.current) {
                  clearTimeout(feelingsCloseTimerRef.current);
                  feelingsCloseTimerRef.current = null;
                }
                if (showAllWeeklyFeelings) {
                  const staying = new Set([...collapsedNames, 'Other']);
                  const exiting = optionNames.filter(
                    name => !staying.has(name),
                  );
                  AccessibilityInfo.isReduceMotionEnabled()
                    .then(reduceMotion => {
                      if (reduceMotion || exiting.length === 0) {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.spring,
                        );
                        setClosingFeelings(null);
                        setShowAllWeeklyFeelings(false);
                        return;
                      }
                      setClosingFeelings(exiting);
                      setShowAllWeeklyFeelings(false);
                      const totalExit =
                        (exiting.length - 1) * REVIEW_PILL_STAGGER_MS + 260;
                      feelingsCloseTimerRef.current = setTimeout(() => {
                        feelingsCloseTimerRef.current = null;
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.spring,
                        );
                        setClosingFeelings(null);
                      }, totalExit);
                    })
                    .catch(() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.spring,
                      );
                      setClosingFeelings(null);
                      setShowAllWeeklyFeelings(false);
                    });
                  return;
                }
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setClosingFeelings(null);
                setShowAllWeeklyFeelings(true);
              }}
              style={styles.feelingsShowMore}>
              <ThemedText weight="semiBold" style={styles.feelingsShowMoreText}>
                {showAllWeeklyFeelings ? 'Show less' : 'Show more'}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
          {showCustomFeelingInput || hasCustomFeeling ? (
            <TextInput
              ref={customFeelingInputRef}
              style={styles.customFeelingInput}
              value={customFeeling}
              onChangeText={text => onAnswerChange(customFeelingKey, text)}
              placeholder="Write it in your own words"
              placeholderTextColor={Colors.textGray}
              maxLength={160}
              multiline
              editable={selected.length < 3 || hasCustomFeeling}
              textAlignVertical="top"
              onLayout={() => {
                if (pendingCustomFeelingFocusRef.current) {
                  pendingCustomFeelingFocusRef.current = false;
                  customFeelingInputRef.current?.focus();
                }
                revealCustomReviewInput();
              }}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              accessibilityLabel="Write it in your own words"
            />
          ) : null}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'life_check_in') {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.lifeCheckInStage]}>
          <View style={styles.lifeCheckInHeading}>
            <View style={styles.feelingsLabelRow}>
              <Ionicons name="leaf-outline" size={15} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.feelingsLabel}>
                LOOKING BACK
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.lifeCheckInQuestion}>
              {current.question}
            </ThemedText>
            <ThemedText style={styles.lifeCheckInSubtitle}>
              {current.subtitle}
            </ThemedText>
          </View>

          {WEEKLY_LIFE_AREAS.map(area => {
            const selectedValue = answers[area.answerKey] ?? '';
            return (
              <View key={area.key} style={styles.lifeCheckInRow}>
                <View
                  style={styles.lifeCheckInIcon}
                  accessibilityElementsHidden>
                  <MaterialCommunityIcons
                    name={area.icon}
                    size={24}
                    color={Colors.sage}
                  />
                </View>
                <View style={styles.lifeCheckInContent}>
                  <ThemedText
                    weight="medium"
                    style={styles.lifeCheckInAreaLabel}>
                    {area.label}
                  </ThemedText>
                  <View style={styles.lifeCheckInOptions}>
                    {WEEKLY_LIFE_CHECK_IN_OPTIONS.map(option => {
                      const isSelected = selectedValue === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          accessibilityRole="button"
                          accessibilityLabel={`${area.label}: ${option.label}`}
                          accessibilityState={{selected: isSelected}}
                          activeOpacity={0.78}
                          onPress={() => {
                            triggerLightHaptic();
                            onAnswerChange(area.answerKey, option.value);
                          }}
                          style={[
                            styles.feelingPill,
                            styles.lifeCheckInPill,
                            isSelected && styles.feelingPillSelected,
                          ]}>
                          <ThemedText
                            weight="semiBold"
                            style={[
                              styles.feelingPillText,
                              styles.lifeCheckInPillText,
                              isSelected && styles.feelingPillTextSelected,
                            ]}>
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'remembered') {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled={reviewType === 'weekly' || reviewType === 'monthly'}
          style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {reviewType === 'monthly' && memorableItems.length > 0
              ? 'These are the moments that shaped the month and stayed with you.'
              : memorableItems.length > 0
              ? `You chose ${memorableItems.length} thing${
                  memorableItems.length === 1 ? '' : 's'
                } to carry with this review.`
              : 'Go back and tap the bookmark on anything you want to carry with this review.'}
          </ThemedText>
          {memorableItems
            .map(m =>
              capture?.items.find(
                i => i.id === m.id && i.selectedDate === m.selectedDate,
              ),
            )
            .filter(Boolean)
            .map(item => (
              <View
                key={`${item!.kind}-${item!.id}`}
                style={styles.captureItem}>
                <View style={styles.captureItemHeader}>
                  <ThemedText weight="semiBold" style={styles.captureItemTitle}>
                    {item!.title}
                  </ThemedText>
                  {item!.subtitle ? (
                    <ThemedText style={styles.captureItemSubtitle}>
                      {item!.subtitle} · {item!.selectedDate}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'life_summary' && reviewType === 'monthly') {
      const hasLifeCheckIns = monthlyLifeCheckInSummary.areas.some(
        area => area.answeredWeeks > 0,
      );
      const hasMissingLifeAnswers = monthlyLifeCheckInSummary.areas.some(area =>
        area.values.some(value => value === null),
      );
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyLifeSummaryStage]}>
          <View style={styles.monthlyLifeSummaryHeading}>
            <View style={styles.monthlyPatternsLabelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.monthlyPatternsLabel}>
                LOOKING BACK
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.monthlyLifeSummaryTitle}>
              {current.question}
            </ThemedText>
            <ThemedText style={styles.monthlyLifeSummarySubtitle}>
              {monthlyLifeCheckInSummary.reviewCount > 0
                ? `A synthesis of ${
                    monthlyLifeCheckInSummary.reviewCount
                  } weekly Whole-life ${
                    monthlyLifeCheckInSummary.reviewCount === 1
                      ? 'check-in'
                      : 'check-ins'
                  }.`
                : current.subtitle}
            </ThemedText>
          </View>

          {hasLifeCheckIns ? (
            <>
              {monthlyLifeCheckInSummary.insight ? (
                <View style={styles.monthlyLifeInsight}>
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color={Colors.sage}
                  />
                  <ThemedText style={styles.monthlyLifeInsightText}>
                    {monthlyLifeCheckInSummary.insight}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.monthlyLifeLegend}>
                {[
                  {label: 'Well', color: Colors.sageMuted},
                  {label: 'Okay', color: '#CFC5AE'},
                  {label: 'Needs care', color: MONTHLY_PATTERN_ALERT_CORAL},
                  ...(hasMissingLifeAnswers
                    ? [{label: 'No answer', color: '#ECECE7'}]
                    : []),
                ].map(item => (
                  <View key={item.label} style={styles.monthlyLifeLegendItem}>
                    <View
                      style={[
                        styles.monthlyLifeLegendDot,
                        {backgroundColor: item.color},
                      ]}
                    />
                    <ThemedText style={styles.monthlyLifeLegendText}>
                      {item.label}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.monthlyLifeAreaList}>
                {monthlyLifeCheckInSummary.areas.map(area => {
                  const counts = [
                    area.counts.well ? `${area.counts.well}× Well` : '',
                    area.counts.okay ? `${area.counts.okay}× Okay` : '',
                    area.counts.struggling
                      ? `${area.counts.struggling}× Needs care`
                      : '',
                  ].filter(Boolean);
                  const trendIcon =
                    area.trend === 'improving'
                      ? 'trending-up-outline'
                      : area.trend === 'declining'
                      ? 'trending-down-outline'
                      : area.trend === 'varied'
                      ? 'swap-horizontal-outline'
                      : area.trend === 'steady'
                      ? 'remove-outline'
                      : 'information-circle-outline';
                  return (
                    <View key={area.key} style={styles.monthlyLifeArea}>
                      <View style={styles.monthlyLifeAreaHeading}>
                        <View style={styles.monthlyLifeAreaIdentity}>
                          <MaterialCommunityIcons
                            name={area.icon}
                            size={22}
                            color={Colors.sage}
                          />
                          <ThemedText
                            weight="semiBold"
                            style={styles.monthlyLifeAreaLabel}>
                            {area.label}
                          </ThemedText>
                        </View>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyLifeInterpretation}>
                          {area.interpretation}
                        </ThemedText>
                      </View>

                      <View style={styles.monthlyLifeWeeks}>
                        {area.values.map((value, index) => (
                          <View
                            key={`${area.key}-${index}`}
                            accessible
                            accessibilityLabel={`Week ${index + 1}: ${
                              value === 'struggling'
                                ? 'Needs care'
                                : value
                                ? value[0].toUpperCase() + value.slice(1)
                                : 'No answer'
                            }`}
                            style={[
                              styles.monthlyLifeWeek,
                              {
                                backgroundColor:
                                  getMonthlyLifeRatingColor(value),
                              },
                            ]}
                          />
                        ))}
                      </View>

                      <View style={styles.monthlyLifeAreaFooter}>
                        <View>
                          <ThemedText style={styles.monthlyLifeCounts}>
                            {counts.join('  ·  ') || 'No weekly answers'}
                          </ThemedText>
                          <ThemedText style={styles.monthlyLifeCoverage}>
                            {area.answeredWeeks} of{' '}
                            {monthlyLifeCheckInSummary.reviewCount}{' '}
                            {monthlyLifeCheckInSummary.reviewCount === 1
                              ? 'week'
                              : 'weeks'}{' '}
                            answered
                          </ThemedText>
                        </View>
                        <View style={styles.monthlyLifeTrend}>
                          <Ionicons
                            name={trendIcon}
                            size={14}
                            color={Colors.textGray}
                          />
                          <ThemedText style={styles.monthlyLifeTrendText}>
                            {area.trendLabel}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.monthlyLifeEmpty}>
              <ThemedText style={styles.monthlyLifeEmptyText}>
                No Weekly Whole-life check-ins were completed this month.
                There’s nothing to interpret yet.
              </ThemedText>
            </View>
          )}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'pill_choices' && reviewType === 'monthly') {
      const drainingChoices = [
        ...(answers.month_draining ?? '')
          .split('|')
          .map(value => value.trim())
          .filter(value => value && value !== 'Other'),
        ...(answers.month_draining_other?.trim()
          ? [answers.month_draining_other.trim()]
          : []),
      ];
      const choices = [
        ...new Set([
          ...(current.key === 'monthly_leave_behind'
            ? drainingChoices
            : []),
          ...(current.choices ?? []),
        ]),
      ];
      const selectionLimit = current.selectionLimit ?? 3;
      const answerKey = current.answerKey!;
      const otherAnswerKey = current.otherAnswerKey!;
      const selectedChoices = (answers[answerKey] ?? '')
        .split('|')
        .map(value => value.trim())
        .filter(Boolean);
      const customChoice = answers[otherAnswerKey] ?? '';
      const hasOther =
        selectedChoices.includes('Other') || Boolean(customChoice.trim());
      const selectionCount = selectedChoices.length;
      const saveChoices = (patch: Record<string, string>) => {
        const next = {...answers, ...patch};
        setAnswers(next);
        saveReview({answers: next});
      };
      const toggleChoice = (choice: string) => {
        const isSelected = selectedChoices.includes(choice);
        if (!isSelected && selectionCount >= selectionLimit) {
          return;
        }
        triggerLightHaptic();
        if (isSelected) {
          saveChoices({
            [answerKey]: selectedChoices
              .filter(item => item !== choice)
              .join('|'),
            ...(choice === 'Other' ? {[otherAnswerKey]: ''} : {}),
          });
          return;
        }
        saveChoices({[answerKey]: [...selectedChoices, choice].join('|')});
      };

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyChoiceStage]}>
          <View style={styles.monthlyChoiceHeading}>
            <View style={styles.monthlyPatternsLabelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.monthlyPatternsLabel}>
                {current.label}
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.monthlyChoiceTitle}>
              {current.question}
            </ThemedText>
            <ThemedText style={styles.monthlyChoiceSubtitle}>
              {current.subtitle}
            </ThemedText>
          </View>

          <View style={styles.monthlyChoiceGrid}>
            {[...choices, 'Other'].map(choice => {
              const isSelected = selectedChoices.includes(choice);
              const disabled = !isSelected && selectionCount >= selectionLimit;
              return (
                <TouchableOpacity
                  key={choice}
                  accessibilityRole="button"
                  accessibilityLabel={choice}
                  accessibilityState={{selected: isSelected, disabled}}
                  activeOpacity={0.76}
                  disabled={disabled}
                  onPress={() => toggleChoice(choice)}
                  style={[
                    styles.monthlyChoicePill,
                    isSelected && styles.monthlyChoicePillSelected,
                    disabled && styles.monthlyChoicePillDisabled,
                  ]}>
                  {choice === 'Other' ? (
                    <Ionicons
                      name="add"
                      size={17}
                      color={isSelected ? Colors.hopeWhite : Colors.sage}
                    />
                  ) : null}
                  <ThemedText
                    weight="semiBold"
                    style={[
                      styles.monthlyChoicePillText,
                      isSelected && styles.monthlyChoicePillTextSelected,
                    ]}>
                    {choice}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {current.choiceDetails?.some(detail =>
            selectedChoices.includes(detail.choice),
          ) ? (
            <View style={styles.monthlyChoiceDetails}>
              <ThemedText
                weight="semiBold"
                style={styles.monthlyChoiceDetailsTitle}>
                Make it more specific
              </ThemedText>
              <ThemedText style={styles.monthlyChoiceDetailsSubtitle}>
                Optional · choose up to 3 for each area.
              </ThemedText>
              {current.choiceDetails
                .filter(detail => selectedChoices.includes(detail.choice))
                .map(detail => {
                  const detailSelections = (answers[detail.answerKey] ?? '')
                    .split('|')
                    .map(value => value.trim())
                    .filter(Boolean);
                  const detailLimit = detail.selectionLimit ?? 3;
                  return (
                    <View
                      key={detail.answerKey}
                      style={styles.monthlyChoiceDetailSection}>
                      <ThemedText
                        weight="semiBold"
                        style={styles.monthlyChoiceDetailLabel}>
                        {detail.choice}
                      </ThemedText>
                      <View style={styles.monthlyChoiceDetailGrid}>
                        {detail.choices.map(detailChoice => {
                          const isSelected =
                            detailSelections.includes(detailChoice);
                          const disabled =
                            !isSelected &&
                            detailSelections.length >= detailLimit;
                          return (
                            <TouchableOpacity
                              key={detailChoice}
                              accessibilityRole="button"
                              accessibilityLabel={`${detail.choice}: ${detailChoice}`}
                              accessibilityState={{
                                selected: isSelected,
                                disabled,
                              }}
                              activeOpacity={0.76}
                              disabled={disabled}
                              onPress={() => {
                                triggerLightHaptic();
                                saveChoices({
                                  [detail.answerKey]: isSelected
                                    ? detailSelections
                                        .filter(value => value !== detailChoice)
                                        .join('|')
                                    : [...detailSelections, detailChoice].join(
                                        '|',
                                      ),
                                });
                              }}
                              style={[
                                styles.monthlyChoiceDetailPill,
                                isSelected &&
                                  styles.monthlyChoiceDetailPillSelected,
                                disabled && styles.monthlyChoicePillDisabled,
                              ]}>
                              <ThemedText
                                weight="medium"
                                style={[
                                  styles.monthlyChoiceDetailPillText,
                                  isSelected &&
                                    styles.monthlyChoiceDetailPillTextSelected,
                                ]}>
                                {detailChoice}
                              </ThemedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : null}

          {hasOther ? (
            <TextInput
              ref={monthlyPillOtherInputRef}
              autoFocus
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              textAlignVertical="top"
              value={customChoice}
              onChangeText={text => saveChoices({[otherAnswerKey]: text})}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              onLayout={() => requestAnimationFrame(revealCustomReviewInput)}
              placeholder="Add your own…"
              placeholderTextColor={Colors.textGray}
              accessibilityLabel={`${current.question} Other`}
              style={styles.monthlyChoiceOtherInput}
            />
          ) : null}
        </StaggeredReviewStage>
      );
    }

    if (current.key === 'monthly_care' && reviewType === 'monthly') {
      const answerKey = current.answerKey!;
      const otherAnswerKey = current.otherAnswerKey!;
      const selectionLimit = current.selectionLimit ?? 3;
      const selectedAreas = (answers[answerKey] ?? '')
        .split('|')
        .map(value => value.trim())
        .filter(Boolean);
      const customCare = answers[otherAnswerKey] ?? '';
      const summaryByKey = new Map(
        monthlyLifeCheckInSummary.areas.map(area => [area.key, area]),
      );
      const orderedAreas = [...WEEKLY_LIFE_AREAS].sort((left, right) => {
        const rightCount = summaryByKey.get(right.key)?.counts.struggling ?? 0;
        const leftCount = summaryByKey.get(left.key)?.counts.struggling ?? 0;
        return rightCount - leftCount;
      });
      const saveCare = (patch: Record<string, string>) => {
        const next = {...answers, ...patch};
        setAnswers(next);
        saveReview({answers: next});
      };
      const toggleArea = (key: string) => {
        const isSelected = selectedAreas.includes(key);
        if (!isSelected && selectedAreas.length >= selectionLimit) {
          return;
        }
        triggerLightHaptic();
        saveCare({
          [answerKey]: isSelected
            ? selectedAreas.filter(value => value !== key).join('|')
            : [...selectedAreas, key].join('|'),
          ...(key === 'other' && isSelected ? {[otherAnswerKey]: ''} : {}),
        });
      };

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyChoiceStage]}>
          <View style={styles.monthlyChoiceHeading}>
            <View style={styles.monthlyPatternsLabelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.monthlyPatternsLabel}>
                {current.label}
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.monthlyChoiceTitle}>
              {current.question}
            </ThemedText>
            <ThemedText style={styles.monthlyChoiceSubtitle}>
              {monthlyLifeCheckInSummary.reviewCount > 0
                ? current.subtitle
                : 'There is no Whole-life pattern yet. Choose any area you want to care for intentionally.'}
            </ThemedText>
          </View>

          <View style={styles.monthlyCareList}>
            {[...orderedAreas, WEEKLY_CARE_AREAS[WEEKLY_CARE_AREAS.length - 1]].map(
              area => {
                const isSelected = selectedAreas.includes(area.key);
                const disabled =
                  !isSelected && selectedAreas.length >= selectionLimit;
                const strugglingCount =
                  area.key === 'other'
                    ? 0
                    : summaryByKey.get(area.key)?.counts.struggling ?? 0;
                const careSignal =
                  strugglingCount > 0
                    ? `Needs attention. Appeared in ${strugglingCount} weekly ${
                        strugglingCount === 1 ? 'check-in' : 'check-ins'
                      }`
                    : '';
                return (
                  <TouchableOpacity
                    key={area.key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={
                      careSignal ? `${area.label}. ${careSignal}` : area.label
                    }
                    accessibilityState={{checked: isSelected, disabled}}
                    activeOpacity={0.72}
                    disabled={disabled}
                    onPress={() => toggleArea(area.key)}
                    style={[
                      styles.monthlyCareRow,
                      disabled && styles.monthlyChoicePillDisabled,
                    ]}>
                    <View style={styles.monthlyCareIdentity}>
                      <MaterialCommunityIcons
                        name={area.icon as any}
                        size={24}
                        color={Colors.sage}
                      />
                      <View style={styles.monthlyCareCopy}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyCareLabel}>
                          {area.label}
                        </ThemedText>
                        {careSignal ? (
                          <View style={styles.monthlyCareSignalRow}>
                            <ThemedText
                              weight="semiBold"
                              style={styles.monthlyCareSignal}>
                              Needs attention
                            </ThemedText>
                            <ThemedText style={styles.monthlyCareEvidence}>
                              · Appeared in {strugglingCount} weekly{' '}
                              {strugglingCount === 1
                                ? 'check-in'
                                : 'check-ins'}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.monthlyCareMeta}>
                      <View
                        style={[
                          styles.monthlyChoiceCheck,
                          isSelected && styles.monthlyChoiceCheckSelected,
                        ]}>
                        {isSelected ? (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={Colors.hopeWhite}
                          />
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          {selectedAreas.includes('other') ? (
            <TextInput
              ref={monthlyPillOtherInputRef}
              autoFocus
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              textAlignVertical="top"
              value={customCare}
              onChangeText={text => saveCare({[otherAnswerKey]: text})}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              onLayout={() => requestAnimationFrame(revealCustomReviewInput)}
              placeholder="What else needs care?"
              placeholderTextColor={Colors.textGray}
              accessibilityLabel="Other area that needs care"
              style={styles.monthlyChoiceOtherInput}
            />
          ) : null}
        </StaggeredReviewStage>
      );
    }

    if (current.key === 'prayer_for_month' && reviewType === 'monthly') {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.weeklyClosingStage]}>
          <View style={styles.labelRow}>
            <PrayerHandsIcon size={18} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.weeklyChallengeTitle}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.weeklyChallengeSubtitle}>
            {current.subtitle}
          </ThemedText>
          <View style={styles.weeklyClosingNote}>
            <TextInput
              ref={monthlyPrayerInputRef}
              style={styles.weeklyPrayerInput}
              autoFocus
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              value={answers.prayer_for_month ?? ''}
              onChangeText={text => onAnswerChange('prayer_for_month', text)}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              onLayout={() => requestAnimationFrame(revealCustomReviewInput)}
              placeholder={current.placeholder}
              placeholderTextColor={Colors.textGray}
              textAlignVertical="top"
              accessibilityLabel="Your words to God for the month (optional)"
            />
          </View>
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'notice' &&
      reviewType === 'monthly'
    ) {
      const totalCheckIns = checkInFeelings.reduce(
        (total, item) => total + item.count,
        0,
      );
      const largestFeelingCount = Math.max(
        1,
        ...checkInFeelings.map(item => item.count),
      );
      const largestWeeklyFeelingCount = Math.max(
        1,
        ...monthlyWeeklyReviewFeelings.feelings.map(item => item.count),
      );
      const weeklyReviewCount = monthlyWeeklyReviewFeelings.reviewCount;
      const totalLookingForwardFeelings = monthlyLookingForwardFeelings.reduce(
        (total, item) => total + item.count,
        0,
      );
      const largestLookingForwardFeelingCount = Math.max(
        1,
        ...monthlyLookingForwardFeelings.map(item => item.count),
      );
      const hasMonthlyPatternSources =
        totalCheckIns > 0 ||
        weeklyReviewCount > 0 ||
        totalLookingForwardFeelings > 0;
      const patternTabs = [
        {
          key: 'morning',
          count: totalCheckIns,
          label: 'Morning check-ins',
          shortLabel: 'Morning',
        },
        {
          key: 'weekly',
          count: weeklyReviewCount,
          label: 'Weekly check-ins',
          shortLabel: 'Weekly',
        },
        {
          key: 'looking-forward',
          count: totalLookingForwardFeelings,
          label: 'Looking Forward reflections',
          shortLabel: 'Next day',
        },
      ] as const;

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyPatternsStage]}>
          <View style={styles.monthlyPatternsHeading}>
            <View style={styles.monthlyPatternsLabelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.monthlyPatternsLabel}>
                LOOKING BACK
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.monthlyPatternsTitle}>
              {current.question}
            </ThemedText>
            <ThemedText style={styles.monthlyPatternsSubtitle}>
              {hasMonthlyPatternSources
                ? 'Here’s what showed up across the month.'
                : 'There were no check-ins or Looking Forward reflections recorded this month. You can still name what you noticed.'}
            </ThemedText>
            <View accessibilityRole="tablist" style={styles.monthlyMomentsTabs}>
              {patternTabs.map(tab => {
                const tabKey =
                  tab.key === 'looking-forward' ? 'looking_forward' : tab.key;
                const selected = monthlyPatternsView === tabKey;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    accessibilityRole="tab"
                    accessibilityLabel={`${tab.label}, ${tab.count}`}
                    accessibilityState={{selected}}
                    activeOpacity={0.78}
                    onPress={() => {
                      triggerLightHaptic();
                      setMonthlyPatternsView(tabKey);
                    }}
                    style={[
                      styles.monthlyMomentsTab,
                      selected && styles.monthlyMomentsTabActive,
                    ]}>
                    <ThemedText
                      weight="semiBold"
                      style={[
                        styles.monthlyMomentsTabText,
                        selected && styles.monthlyMomentsTabTextActive,
                      ]}>
                      {tab.shortLabel} · {tab.count}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {monthlyPatternsView === 'morning' ? (
            <View style={styles.monthlyPatternSection}>
              <View style={styles.monthlyPatternSectionHeading}>
                <Ionicons name="sunny-outline" size={17} color={Colors.sage} />
                <ThemedText
                  weight="semiBold"
                  style={styles.monthlyPatternSectionTitle}>
                  MORNING CHECK-INS
                </ThemedText>
              </View>
              {checkInFeelings.length > 0 ? (
                <View style={styles.monthlyPatternList}>
                  {checkInFeelings.map(item => (
                    <View key={item.name} style={styles.monthlyPatternRow}>
                      <View style={styles.monthlyPatternLabelRow}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternName}>
                          {item.name}
                        </ThemedText>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternCount}>
                          {item.count} {item.count === 1 ? 'day' : 'days'}
                        </ThemedText>
                      </View>
                      <View style={styles.monthlyPatternTrack}>
                        <View
                          testID={`monthly-pattern-bar-morning-${item.name
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`}
                          style={[
                            styles.monthlyPatternFill,
                            {
                              width: `${
                                (item.count / largestFeelingCount) * 100
                              }%`,
                              backgroundColor: getMonthlyPatternFeelingColor(
                                item.name,
                              ),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.monthlyPatternEmptyText}>
                  No morning feelings were recorded this month.
                </ThemedText>
              )}
            </View>
          ) : null}

          {monthlyPatternsView === 'weekly' ? (
            <View style={styles.monthlyPatternSection}>
              <View style={styles.monthlyPatternSectionHeading}>
                <Ionicons
                  name="calendar-outline"
                  size={17}
                  color={Colors.sage}
                />
                <ThemedText
                  weight="semiBold"
                  style={styles.monthlyPatternSectionTitle}>
                  WEEKLY CHECK-INS
                </ThemedText>
              </View>
              {monthlyWeeklyReviewFeelings.feelings.length > 0 ? (
                <View style={styles.monthlyPatternList}>
                  {monthlyWeeklyReviewFeelings.feelings.map(item => (
                    <View key={item.name} style={styles.monthlyPatternRow}>
                      <View style={styles.monthlyPatternLabelRow}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternName}>
                          {item.name}
                        </ThemedText>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternCount}>
                          {item.count}×
                        </ThemedText>
                      </View>
                      <View style={styles.monthlyPatternTrack}>
                        <View
                          testID={`monthly-pattern-bar-weekly-${item.name
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`}
                          style={[
                            styles.monthlyPatternFill,
                            {
                              width: `${
                                (item.count / largestWeeklyFeelingCount) * 100
                              }%`,
                              backgroundColor: getMonthlyPatternFeelingColor(
                                item.name,
                              ),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.monthlyPatternEmptyText}>
                  No weekly feelings were recorded this month.
                </ThemedText>
              )}
            </View>
          ) : null}

          {monthlyPatternsView === 'looking_forward' ? (
            <View style={styles.monthlyPatternSection}>
              <View style={styles.monthlyPatternSectionHeading}>
                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={17}
                  color={Colors.sage}
                />
                <ThemedText
                  weight="semiBold"
                  style={styles.monthlyPatternSectionTitle}>
                  LOOKING FORWARD TO THE NEXT DAY, YOU FELT…
                </ThemedText>
              </View>
              {monthlyLookingForwardFeelings.length > 0 ? (
                <View style={styles.monthlyPatternList}>
                  {monthlyLookingForwardFeelings.map(item => (
                    <View key={item.name} style={styles.monthlyPatternRow}>
                      <View style={styles.monthlyPatternLabelRow}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternName}>
                          {item.name}
                        </ThemedText>
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyPatternCount}>
                          {item.count} {item.count === 1 ? 'day' : 'days'}
                        </ThemedText>
                      </View>
                      <View style={styles.monthlyPatternTrack}>
                        <View
                          testID={`monthly-pattern-bar-looking-forward-${item.name
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`}
                          style={[
                            styles.monthlyPatternFill,
                            {
                              width: `${
                                (item.count /
                                  largestLookingForwardFeelingCount) *
                                100
                              }%`,
                              backgroundColor: getMonthlyPatternFeelingColor(
                                item.name,
                              ),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.monthlyPatternEmptyText}>
                  No Looking Forward feelings were recorded this month.
                </ThemedText>
              )}
            </View>
          ) : null}

          {monthlyPatternSummary ? (
            <View style={styles.monthlyPatternInsight}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={Colors.sage}
              />
              <View style={styles.monthlyPatternInsightCopy}>
                <ThemedText
                  weight="semiBold"
                  style={styles.monthlyPatternInsightLabel}>
                  WHAT YOUR CHECK-INS SHOW
                </ThemedText>
                <ThemedText style={styles.monthlyPatternInsightText}>
                  {monthlyPatternSummary}
                </ThemedText>
              </View>
            </View>
          ) : null}

          <View style={styles.monthlyPatternNote}>
            <ThemedText
              weight="semiBold"
              style={styles.monthlyPatternNoteTitle}>
              What do you notice?
            </ThemedText>
            <TextInput
              ref={monthlyPatternInputRef}
              style={styles.monthlyPatternInput}
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              textAlignVertical="top"
              value={answers.notice_month ?? ''}
              onChangeText={text => onAnswerChange('notice_month', text)}
              onFocus={() => {
                monthlyPatternInputFocusedRef.current = true;
                requestAnimationFrame(revealMonthlyPatternInput);
              }}
              onBlur={() => {
                monthlyPatternInputFocusedRef.current = false;
              }}
              placeholder="Start writing…"
              placeholderTextColor={Colors.textGray}
              accessibilityLabel="What do you notice?"
            />
          </View>
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'notice' &&
      reviewType === 'weekly'
    ) {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.weeklyGratitudeStage]}>
          <View style={styles.weeklyGratitudeLabelContainer}>
            <Ionicons name="heart-outline" size={16} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.weeklyGratitudeLabel}>
              WEEKLY GRATITUDE
            </ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.weeklyGratitudeTitle}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.weeklyGratitudeSubtitle}>
            {current.subtitle}
          </ThemedText>

          {weeklyGratitudeDates.length > 0 ? (
            <View style={styles.weeklyGratitudeLookBack}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{expanded: showWeeklyGratitudeLookBack}}
                onPress={() => {
                  triggerLightHaptic();
                  setShowWeeklyGratitudeLookBack(show => !show);
                }}
                activeOpacity={0.7}
                style={styles.weeklyGratitudeLookBackToggle}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.sage}
                />
                <ThemedText
                  weight="medium"
                  style={styles.weeklyGratitudeLookBackTitle}>
                  Look back at your week
                </ThemedText>
                <Ionicons
                  name={
                    showWeeklyGratitudeLookBack ? 'chevron-up' : 'chevron-down'
                  }
                  size={18}
                  color={Colors.sage}
                />
              </TouchableOpacity>
              {showWeeklyGratitudeLookBack ? (
                <Pressable
                  accessible={false}
                  onPress={() => {
                    triggerLightHaptic();
                    setShowWeeklyGratitudeLookBack(false);
                  }}
                  style={styles.weeklyGratitudeLookBackContent}>
                  <ThemedText style={styles.weeklyGratitudeLookBackHint}>
                    Your daily gratitude from this week.
                  </ThemedText>
                  <MomentsPaletteContext.Provider value={true}>
                    {weeklyGratitudeDates.map(date => {
                      const [entryYear, entryMonth, entryDay] = date
                        .split('-')
                        .map(Number);
                      return (
                        <View
                          key={date}
                          style={styles.weeklyGratitudeLookBackDay}>
                          <View style={styles.weeklyGratitudeLookBackDatePill}>
                            <ThemedText
                              weight="semiBold"
                              style={styles.weeklyGratitudeLookBackDate}>
                              {formatCapturedDate(date)}
                            </ThemedText>
                          </View>
                          <GratitudeListReactQuery
                            selectedDate={
                              new Date(entryYear, entryMonth - 1, entryDay, 12)
                            }
                            viewMode="moments"
                            readOnly
                            cardStyle={styles.weeklyGratitudeLookBackCard}
                            iconColor={Colors.sage}
                            title="Gratitude"
                            iconPosition="top"
                          />
                        </View>
                      );
                    })}
                  </MomentsPaletteContext.Provider>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.weeklyGratitudeInputs}>
            {Array.from({length: weeklyGratitudeInputCount}, (_, index) => {
              const answerKey = weeklyGratitudeAnswerKey(index);
              return (
                <TextInput
                  key={answerKey}
                  ref={input => {
                    weeklyGratitudeInputRefs.current[index] = input;
                  }}
                  style={styles.weeklyGratitudeInput}
                  autoFocus={index === 0}
                  underlineColorAndroid="transparent"
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  value={answers[answerKey] ?? ''}
                  onChangeText={text => onAnswerChange(answerKey, text)}
                  onFocus={() => revealWeeklyGratitudeInput(index)}
                  placeholder={current.placeholder}
                  placeholderTextColor={Colors.textGray}
                  accessibilityLabel={
                    index === 0
                      ? 'Your weekly prayer of thanks'
                      : `Additional weekly reflection ${index}`
                  }
                />
              );
            })}
          </View>
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'prayer' &&
      reviewType === 'monthly'
    ) {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyPrayerStage]}>
          <View style={styles.labelRow}>
            <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText
            weight="bold"
            style={[styles.question, styles.questionWithSubtitle]}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.questionSubtitle}>
            {current.subtitle}
          </ThemedText>

          <MonthlyReviewPrayerOverview
            reflection={capture?.monthlyPrayerReflection}
            onCarouselTouchStart={() => {
              horizontalCarouselGestureRef.current = true;
            }}
            onCarouselTouchEnd={() => {
              horizontalCarouselGestureRef.current = false;
            }}
          />
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'god' &&
      reviewType === 'weekly'
    ) {
      const rawAnswer = answers.god ?? '';
      const selectedChoices = rawAnswer
        .split('|')
        .filter(isGodFaithfulnessChoice);
      const legacyResponse =
        rawAnswer.trim() && selectedChoices.length === 0
          ? rawAnswer.trim()
          : '';
      const customResponse = answers.god_faithfulness_other ?? legacyResponse;
      const hasCustomChoice =
        showGodFaithfulnessInput || Boolean(customResponse.trim());
      const selectionCount = selectedChoices.length + (hasCustomChoice ? 1 : 0);
      const saveGodAnswers = (patch: Record<string, string>) => {
        const next = {...answers, ...patch};
        setAnswers(next);
        saveReview({answers: next});
      };
      const toggleChoice = (choice: string) => {
        const isSelected = selectedChoices.includes(choice);
        if (!isSelected && selectionCount >= 3) {
          return;
        }
        triggerLightHaptic();
        const nextChoices =
          choice === 'I’m still looking'
            ? isSelected
              ? []
              : [choice]
            : isSelected
            ? selectedChoices.filter(item => item !== choice)
            : [
                ...selectedChoices.filter(item => item !== 'I’m still looking'),
                choice,
              ];
        saveGodAnswers({
          god: nextChoices.join('|'),
          ...(legacyResponse && answers.god_faithfulness_other === undefined
            ? {god_faithfulness_other: legacyResponse}
            : {}),
        });
      };
      const toggleCustomChoice = () => {
        if (hasCustomChoice) {
          triggerLightHaptic();
          pendingGodFaithfulnessFocusRef.current = false;
          Keyboard.dismiss();
          setShowGodFaithfulnessInput(false);
          saveGodAnswers({
            god: selectedChoices.join('|'),
            god_faithfulness_other: '',
          });
          return;
        }
        if (selectionCount >= 3) {
          return;
        }
        triggerLightHaptic();
        pendingGodFaithfulnessFocusRef.current = true;
        setShowGodFaithfulnessInput(true);
      };

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.godFaithfulnessStage]}>
          <View style={styles.labelRow}>
            <Ionicons name="sparkles-outline" size={16} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.godFaithfulnessQuestion}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.godFaithfulnessSubtitle}>
            {current.subtitle}
          </ThemedText>

          <View style={styles.godFaithfulnessGrid}>
            {[...WEEKLY_GOD_FAITHFULNESS_OPTIONS, 'Write my own'].map(
              (choice, index) => {
                const isCustom = choice === 'Write my own';
                const isSelected = isCustom
                  ? hasCustomChoice
                  : selectedChoices.includes(choice);
                const atLimit = !isSelected && selectionCount >= 3;
                return (
                  <StaggeredFeelingPill
                    key={choice}
                    delay={
                      REVIEW_PILL_BASE_DELAY_MS + index * REVIEW_PILL_STAGGER_MS
                    }>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: isSelected,
                        disabled: atLimit,
                      }}
                      disabled={atLimit}
                      activeOpacity={0.8}
                      onPress={() =>
                        isCustom ? toggleCustomChoice() : toggleChoice(choice)
                      }
                      style={[
                        styles.feelingPill,
                        isSelected && styles.feelingPillSelected,
                        atLimit && styles.feelingPillDisabled,
                      ]}>
                      <ThemedText
                        weight="semiBold"
                        style={[
                          styles.feelingPillText,
                          isSelected && styles.feelingPillTextSelected,
                        ]}>
                        {choice}
                      </ThemedText>
                    </TouchableOpacity>
                  </StaggeredFeelingPill>
                );
              },
            )}
          </View>

          {hasCustomChoice ? (
            <TextInput
              ref={godFaithfulnessInputRef}
              style={styles.godFaithfulnessInput}
              underlineColorAndroid="transparent"
              multiline
              scrollEnabled={false}
              value={customResponse}
              onChangeText={text =>
                saveGodAnswers({
                  god: selectedChoices.join('|'),
                  god_faithfulness_other: text,
                })
              }
              onLayout={() => {
                if (pendingGodFaithfulnessFocusRef.current) {
                  pendingGodFaithfulnessFocusRef.current = false;
                  godFaithfulnessInputRef.current?.focus();
                }
                revealCustomReviewInput();
              }}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              placeholder="Write how God met you this week…"
              placeholderTextColor={Colors.textGray}
              maxLength={320}
              textAlignVertical="top"
              accessibilityLabel="Write how God met you this week"
            />
          ) : null}
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'dont_forget' &&
      reviewType === 'weekly'
    ) {
      const selectedCareAreas = new Set(
        getWeeklyCareAreas(answers).map(area => area.key),
      );
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.weeklyCareStage]}>
          <View style={styles.labelRow}>
            <Ionicons name="heart-outline" size={16} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.weeklyGratitudeTitle}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.weeklyGratitudeSubtitle}>
            {current.subtitle}
          </ThemedText>
          <View style={styles.weeklyCareAreas}>
            {WEEKLY_CARE_AREAS.map(area => {
              const isSelected = selectedCareAreas.has(area.key);
              return (
                <View key={area.key} style={styles.weeklyCareAreaSlot}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={area.label}
                    accessibilityState={{selected: isSelected}}
                    activeOpacity={0.8}
                    onPress={() => {
                      triggerLightHaptic();
                      const next = new Set(selectedCareAreas);
                      if (area.key === 'other') {
                        pendingWeeklyCareOtherFocusRef.current = !isSelected;
                      }
                      if (isSelected) {
                        next.delete(area.key);
                      } else {
                        next.add(area.key);
                      }
                      onAnswerChange(
                        'week_care_areas',
                        WEEKLY_CARE_AREAS.filter(candidate =>
                          next.has(candidate.key),
                        )
                          .map(candidate => candidate.key)
                          .join('|'),
                      );
                    }}
                    style={[
                      styles.weeklyCareArea,
                      isSelected && styles.weeklyCareAreaSelected,
                    ]}>
                    <MaterialCommunityIcons
                      name={area.icon}
                      size={22}
                      color={isSelected ? Colors.hopeWhite : Colors.sage}
                    />
                    <ThemedText
                      weight="medium"
                      style={[
                        styles.weeklyCareAreaLabel,
                        isSelected && styles.weeklyCareAreaLabelSelected,
                      ]}>
                      {area.label}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <View style={styles.weeklyCareNote}>
            {selectedCareAreas.has('other') && (
              <View style={styles.weeklyCareOther}>
                <ThemedText weight="medium" style={styles.weeklyCareNoteLabel}>
                  What else needs care?
                </ThemedText>
                <TextInput
                  ref={weeklyCareOtherInputRef}
                  style={[styles.weeklyCareInput, styles.weeklyCareOtherInput]}
                  multiline
                  scrollEnabled={false}
                  underlineColorAndroid="transparent"
                  value={answers.week_care_other ?? ''}
                  onChangeText={text => onAnswerChange('week_care_other', text)}
                  onLayout={() => {
                    if (pendingWeeklyCareOtherFocusRef.current) {
                      pendingWeeklyCareOtherFocusRef.current = false;
                      weeklyCareOtherInputRef.current?.focus();
                    }
                    revealCustomReviewInput();
                  }}
                  onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
                  placeholder="Write your own area…"
                  placeholderTextColor={Colors.textGray}
                  textAlignVertical="top"
                  accessibilityLabel="Other area that needs care this week"
                />
              </View>
            )}
            <ThemedText weight="medium" style={styles.weeklyCareNoteLabel}>
              A note for this week
            </ThemedText>
            <TextInput
              ref={weeklyCareInputRef}
              style={styles.weeklyCareInput}
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              value={answers.dont_forget ?? ''}
              onChangeText={text => onAnswerChange('dont_forget', text)}
              onFocus={() => requestAnimationFrame(revealCustomReviewInput)}
              onLayout={revealCustomReviewInput}
              placeholder={current.placeholder}
              placeholderTextColor={Colors.textGray}
              textAlignVertical="top"
              accessibilityLabel="A note about what needs care this week"
            />
          </View>
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'question' &&
      current.key === 'watch_for' &&
      reviewType === 'weekly'
    ) {
      const selectedChoices = getWeeklyChallengeChoices(answers);
      const selectedKeys = new Set(selectedChoices.map(option => option.key));
      const saveChallengeAnswers = (patch: Record<string, string>) => {
        const next = {...answers, ...patch};
        setAnswers(next);
        saveReview({answers: next});
      };
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.weeklyChallengeStage]}>
          <View style={styles.labelRow}>
            <Ionicons
              name="arrow-forward-outline"
              size={16}
              color={Colors.sage}
            />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.weeklyChallengeTitle}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.weeklyChallengeSubtitle}>
            {current.subtitle}
          </ThemedText>
          <View style={styles.weeklyChallengeChoices}>
            {getWeeklyChallengeOptions(answers).map(option => {
              const isSelected = selectedKeys.has(option.key);
              return (
                <TouchableOpacity
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{selected: isSelected}}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerLightHaptic();
                    saveChallengeAnswers({
                      week_challenge_choices: toggleWeeklyChallengeChoice(
                        answers,
                        option.key,
                      ),
                    });
                    if (option.key === 'other' && !isSelected) {
                      requestAnimationFrame(() =>
                        weeklyChallengeOtherInputRef.current?.focus(),
                      );
                    }
                  }}
                  style={[
                    styles.feelingPill,
                    styles.weeklyChallengePill,
                    isSelected && styles.feelingPillSelected,
                  ]}>
                  <ThemedText
                    weight="medium"
                    style={[
                      styles.feelingPillText,
                      isSelected && styles.feelingPillTextSelected,
                    ]}>
                    {option.label}
                  </ThemedText>
                  <Ionicons
                    accessible={false}
                    name={isSelected ? 'close' : 'add'}
                    size={16}
                    color={isSelected ? Colors.hopeWhite : Colors.sage}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View>
            {selectedKeys.has('other') && (
              <View style={styles.weeklyChallengeOther}>
                <ThemedText weight="medium" style={styles.weeklyCareNoteLabel}>
                  Something else to be mindful of
                </ThemedText>
                <TextInput
                  ref={weeklyChallengeOtherInputRef}
                  style={[styles.weeklyCareInput, styles.weeklyChallengeInput]}
                  autoFocus
                  multiline
                  scrollEnabled={false}
                  underlineColorAndroid="transparent"
                  value={answers.watch_for ?? ''}
                  onChangeText={text =>
                    saveChallengeAnswers({
                      week_challenge_choices: selectedChoices
                        .map(option => option.key)
                        .join('|'),
                      watch_for: text,
                    })
                  }
                  onFocus={() =>
                    requestAnimationFrame(revealWeeklyChallengeOtherInput)
                  }
                  placeholder={current.placeholder}
                  placeholderTextColor={Colors.textGray}
                  textAlignVertical="top"
                  accessibilityLabel="Something else that could make this week difficult"
                />
              </View>
            )}
          </View>
        </StaggeredReviewStage>
      );
    }

    if (reviewType === 'weekly' && current.key === 'looking_forward_feeling') {
      return (
        <LookingForwardEmotionStep
          weekly
          embedded
          selectedEmotion={getWeeklyLookingForwardEmotion(answers)}
          onSelect={emotion =>
            onAnswerChange('week_looking_forward_emotion', emotion?.id ?? '')
          }
          onNext={() => goTo(stage + 1)}
          insets={{top: topInset + 36, bottom: insets.bottom}}
          customEmotion={answers.week_looking_forward_other ?? ''}
          setCustomEmotion={text =>
            onAnswerChange('week_looking_forward_other', text)
          }
          dateContext="today"
        />
      );
    }

    if (reviewType === 'weekly' && current.key === 'looking_forward') {
      return (
        <LookingForwardWritingStep
          weekly
          embedded
          emotion={getWeeklyLookingForwardEmotion(answers)}
          lookingAheadText={answers.week_looking_forward ?? ''}
          onChange={text => onAnswerChange('week_looking_forward', text)}
          onNext={() => goTo(stage + 1)}
          insets={{top: topInset + 36, bottom: insets.bottom}}
          customEmotion={answers.week_looking_forward_other ?? ''}
          dateContext="today"
        />
      );
    }

    if (reviewType === 'weekly' && current.key === 'prayer_ahead') {
      const savedPrayerWords = getWeeklySupportChoices(answers).filter(
        option => option.key !== 'other',
      );
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.weeklyClosingStage]}>
          <View style={styles.labelRow}>
            <PrayerHandsIcon size={18} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.weeklyChallengeTitle}>
            {current.question}
          </ThemedText>
          <ThemedText style={styles.weeklyChallengeSubtitle}>
            {current.subtitle}
          </ThemedText>
          <View style={styles.weeklyClosingNote}>
            {savedPrayerWords.length > 0 && (
              <ThemedText style={styles.weeklyCareNoteLabel}>
                {savedPrayerWords.map(option => option.label).join(' · ')}
              </ThemedText>
            )}
            <TextInput
              ref={weeklyPrayerInputRef}
              style={styles.weeklyPrayerInput}
              autoFocus
              multiline
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              value={answers.prayer_ahead ?? ''}
              onChangeText={text => onAnswerChange('prayer_ahead', text)}
              onFocus={() => requestAnimationFrame(revealWeeklyClosingInput)}
              placeholder={current.placeholder}
              placeholderTextColor={Colors.textGray}
              textAlignVertical="top"
              accessibilityLabel="Your words to God (optional)"
            />
          </View>
        </StaggeredReviewStage>
      );
    }

    if (
      current.kind === 'testimony' &&
      reviewType === 'monthly' &&
      monthlyTestimony
    ) {
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyTestimonyStage]}>
          <View style={styles.monthlyTestimonyHeading}>
            <View style={styles.labelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.label}>
                {current.label}
              </ThemedText>
            </View>
            <View style={styles.monthlyTestimonyEmblem}>
              <Ionicons
                name="sparkles-outline"
                size={22}
                color={Colors.sage}
              />
            </View>
            <ThemedText weight="bold" style={styles.monthlyTestimonyTitle}>
              {current.title}
            </ThemedText>
            <ThemedText style={styles.monthlyTestimonySubtitle}>
              {current.subtitle}
            </ThemedText>
          </View>

          <View style={styles.monthlyTestimonyCard}>
            <View style={styles.monthlyTestimonyCardHeading}>
              <View style={styles.monthlyTestimonyIcon}>
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={Colors.sage}
                />
              </View>
              <ThemedText
                weight="semiBold"
                style={styles.monthlyTestimonyCardTitle}>
                My testimony
              </ThemedText>
              {!!monthlyTestimony.detail && (
                <View style={styles.monthlyTestimonyDatePill}>
                  <Ionicons name="time-outline" size={12} color={Colors.sage} />
                  <ThemedText
                    numberOfLines={1}
                    style={styles.monthlyTestimonyDateText}>
                    {monthlyTestimony.detail}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.monthlyTestimonyRule} />
            <ThemedText
              numberOfLines={5}
              style={styles.monthlyTestimonyBody}>
              {monthlyTestimony.text?.trim()}
            </ThemedText>
          </View>

          <ThemedText style={styles.monthlyTestimonyFootnote}>
            This is part of the story of God’s faithfulness in your life.
          </ThemedText>
        </StaggeredReviewStage>
      );
    }

    if (reviewType === 'monthly' && current.kind === 'wins') {
      const wins = [...monthlyWins].sort((left, right) =>
        left.selectedDate.localeCompare(right.selectedDate),
      );
      const columnCount = Math.min(
        wins.length,
        screenWidth >= 700 ? 3 : screenWidth >= 350 ? 2 : 1,
      );
      const gridGap = 12;
      const gridWidth = screenWidth - 44;
      const columnWidth =
        (gridWidth - gridGap * Math.max(0, columnCount - 1)) / columnCount;
      const winColumns = Array.from({length: columnCount}, () => ({
        estimatedHeight: 0,
        items: [] as ReviewCaptureItem[],
      }));
      wins.forEach(win => {
        const shortestColumn = winColumns.reduce(
          (shortest, column, index, columns) =>
            column.estimatedHeight < columns[shortest].estimatedHeight
              ? index
              : shortest,
          0,
        );
        const charactersPerLine = Math.max(
          12,
          Math.floor((columnWidth - 30) / 7),
        );
        const copyLength =
          (win.detail?.trim().length ?? 0) +
          (win.text?.trim().length ?? win.title.trim().length);
        const estimatedLines = Math.max(
          1,
          Math.ceil(copyLength / charactersPerLine),
        );
        winColumns[shortestColumn].items.push(win);
        winColumns[shortestColumn].estimatedHeight +=
          126 + estimatedLines * 21 + gridGap;
      });
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled
          style={[styles.stage, styles.monthlyWinsStage]}>
          <View style={styles.weeklyCapturedHeading}>
            <View style={styles.feelingsLabelRow}>
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.feelingsLabel}>
                {current.label}
              </ThemedText>
            </View>
            <ThemedText weight="bold" style={styles.weeklyCapturedTitle}>
              {current.title}
            </ThemedText>
            <ThemedText style={styles.weeklyCapturedSubtitle}>
              {current.subtitle}
            </ThemedText>
          </View>

          <View style={styles.monthlyWinsCountRow}>
            <Ionicons name="trophy-outline" size={18} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.monthlyWinsCount}>
              {wins.length} {wins.length === 1 ? 'win' : 'wins'} recorded
            </ThemedText>
          </View>

          <View style={styles.monthlyWinsGrid}>
            {winColumns.map((column, columnIndex) => (
              <View
                key={`monthly-win-column-${columnIndex}`}
                style={styles.monthlyWinsColumn}>
                {column.items.map(win => {
                  const winType = win.detail?.trim();
                  const winText = win.text?.trim() || win.title.trim();
                  return (
                    <View
                      key={`${win.id}:${win.selectedDate}`}
                      style={styles.monthlyWinGridCard}>
                      <View style={styles.monthlyWinGridMeta}>
                        <View style={styles.monthlyWinGridIcon}>
                          <Ionicons
                            name="trophy-outline"
                            size={16}
                            color={Colors.sage}
                          />
                        </View>
                        <ThemedText style={styles.monthlyWinGridDate}>
                          {formatCapturedDate(win.selectedDate)}
                        </ThemedText>
                      </View>
                      {!!winType && (
                        <ThemedText
                          weight="semiBold"
                          style={styles.monthlyWinGridType}>
                          {winType}
                        </ThemedText>
                      )}
                      <View style={styles.monthlyWinGridRule} />
                      <ThemedText
                        weight="semiBold"
                        style={styles.monthlyWinGridLabel}>
                        QUIET WIN
                      </ThemedText>
                      <ThemedText style={styles.monthlyWinGridText}>
                        {winText}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'question') {
      const isWeeklyDifficulty =
        reviewType === 'weekly' && current.key === 'difficulty';
      const isWeeklyLearning =
        reviewType === 'weekly' && current.key === 'learning';
      const isMonthlyGodFaithfulness =
        reviewType === 'monthly' && current.key === 'god';
      const isMonthlyFormation =
        reviewType === 'monthly' && current.key === 'formation';
      const isActiveMonthlyReflection =
        isMonthlyFormation || isMonthlyGodFaithfulness;
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled={reviewType === 'weekly'}
          style={[
            styles.stage,
            isWeeklyDifficulty && styles.weeklyDifficultyStage,
          ]}>
          <View style={styles.labelRow}>
            {current.icon && (
              <Ionicons
                name={
                  isActiveMonthlyReflection
                    ? 'leaf-outline'
                    : (current.icon as any)
                }
                size={isActiveMonthlyReflection ? 17 : 16}
                color={Colors.sage}
              />
            )}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText
            weight="bold"
            style={[
              styles.question,
              current.subtitle && styles.questionWithSubtitle,
            ]}>
            {current.question}
          </ThemedText>
          {current.subtitle ? (
            <ThemedText style={styles.questionSubtitle}>
              {current.subtitle}
            </ThemedText>
          ) : null}
          <TextInput
            ref={
              isMonthlyFormation
                ? monthlyFormationInputRef
                : isMonthlyGodFaithfulness
                ? godFaithfulnessInputRef
                : undefined
            }
            style={styles.input}
            autoFocus={
              isWeeklyDifficulty ||
              isWeeklyLearning ||
              isActiveMonthlyReflection
            }
            underlineColorAndroid={
              isWeeklyDifficulty || isActiveMonthlyReflection
                ? 'transparent'
                : undefined
            }
            multiline
            scrollEnabled={!isActiveMonthlyReflection}
            value={answers[current.answerKey!] ?? ''}
            onChangeText={t => onAnswerChange(current.answerKey!, t)}
            onFocus={
              isActiveMonthlyReflection
                ? () => requestAnimationFrame(revealCustomReviewInput)
                : undefined
            }
            onLayout={
              isActiveMonthlyReflection ? revealCustomReviewInput : undefined
            }
            placeholder={current.placeholder ?? 'Start writing...'}
            placeholderTextColor={Colors.textGray}
            textAlignVertical="top"
            accessibilityLabel={current.question}
          />
          {reviewType === 'weekly' &&
          current.key === 'learning' &&
          answers.prayer?.trim() ? (
            <View style={styles.weeklySavedPrayer}>
              <ThemedText
                weight="semiBold"
                style={styles.weeklyAdditionalMemoryTitle}>
                Your saved prayer from this review
              </ThemedText>
              <ThemedText style={styles.weeklySavedPrayerBody}>
                {answers.prayer}
              </ThemedText>
            </View>
          ) : null}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'priorities') {
      const isDesignedPriority =
        reviewType === 'weekly' || reviewType === 'monthly';
      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled={isDesignedPriority}
          style={styles.stage}>
          <View style={styles.labelRow}>
            {reviewType === 'monthly' ? (
              <Ionicons name="leaf-outline" size={17} color={Colors.sage} />
            ) : isDesignedPriority ? (
              <MaterialIcons
                name="filter-center-focus"
                size={16}
                color={Colors.sage}
              />
            ) : (
              current.icon && (
                <Ionicons
                  name={current.icon as any}
                  size={16}
                  color={Colors.sage}
                />
              )
            )}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText
            weight="bold"
            style={[
              styles.question,
              isDesignedPriority &&
                current.subtitle &&
                styles.questionWithSubtitle,
            ]}>
            {reviewType === 'monthly'
              ? `What matters most in ${monthlyLookingAheadMonthName}?`
              : current.question}
          </ThemedText>
          {current.subtitle ? (
            <ThemedText
              style={
                isDesignedPriority ? styles.questionSubtitle : styles.subtitle
              }>
              {current.subtitle}
            </ThemedText>
          ) : null}
          {isDesignedPriority ? (
            <FocusPriorityInputs
              ref={weeklyPriorityInputsRef}
              visibleCount={weeklyPriorityInputCount}
              priorities={current.answerKeys!.map(key => answers[key] ?? '')}
              onChange={(index, text) =>
                onAnswerChange(current.answerKeys![index], text)
              }
            />
          ) : (
            current.answerKeys!.map((key, index) => (
              <TextInput
                key={key}
                style={[styles.input, styles.shortInput]}
                value={answers[key] ?? ''}
                onChangeText={t => onAnswerChange(key, t)}
                placeholder={`${current.label} ${index + 1}`}
                placeholderTextColor={Colors.textGray}
              />
            ))
          )}
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'transition') {
      if (
        (reviewType === 'weekly' && current.key === 'looking_ahead') ||
        (reviewType === 'monthly' && current.key === 'step_into')
      ) {
        const isMonthlyTransition = reviewType === 'monthly';
        return (
          <StaggeredReviewStage
            animationKey={current.key}
            enabled
            style={[
              styles.stage,
              styles.weeklyLookingAheadStage,
              {
                minHeight: Math.max(
                  480,
                  screenHeight - topInset - insets.bottom - 172,
                ),
              },
            ]}>
            <Image
              accessible={false}
              resizeMode="contain"
              source={require('../../assets/images/reviews/weekly-looking-ahead-sunrise-v2.png')}
              style={styles.weeklyLookingAheadArtwork}
            />
            <View style={styles.weeklyLookingAheadCopy}>
              <View style={styles.weeklyLookingAheadLabelRow}>
                <Ionicons name="leaf-outline" size={15} color={Colors.sage} />
                <ThemedText
                  weight="semiBold"
                  style={styles.weeklyLookingAheadLabel}>
                  {current.label}
                </ThemedText>
              </View>
              <ThemedText
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={2}
                weight="bold"
                style={styles.reviewPeriodHeadline}>
                {isMonthlyTransition
                  ? monthlyLookingAheadPeriodLabel
                  : weeklyLookingAheadPeriodLabel}
              </ThemedText>
              <ThemedText
                weight="semiBold"
                style={styles.reviewDirectionPrompt}>
                {current.title}
              </ThemedText>
              <ThemedText style={styles.weeklyLookingAheadSubtitle}>
                {current.subtitle}
              </ThemedText>
              <ThemedText style={styles.weeklyAheadOptional}>
                Answer what helps. You can skip any step.
              </ThemedText>
            </View>
          </StaggeredReviewStage>
        );
      }

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled={reviewType === 'weekly' || reviewType === 'monthly'}
          style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && (
              <Ionicons
                name={current.icon as any}
                size={16}
                color={Colors.sage}
              />
            )}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>{current.subtitle}</ThemedText>
        </StaggeredReviewStage>
      );
    }

    if (current.kind === 'ready') {
      const isMonthly = reviewType === 'monthly';
      const label =
        current.label ??
        `${reviewType.replace('_', ' ').toUpperCase()} IS READY`;

      const priorityKeys =
        reviewType === 'quarterly'
          ? ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3']
          : isMonthly
          ? [
              'next_month_priority_1',
              'next_month_priority_2',
              'next_month_priority_3',
            ]
          : ['priority_1', 'priority_2', 'priority_3'];
      const priorityCount = priorityKeys
        .map(k => answers[k])
        .filter(Boolean).length;

      const summaryRows =
        reviewType === 'begin_year' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Posture
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.posture?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Scripture
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.scripture_begin?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What I’m entrusting
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.surrender?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : reviewType === 'year_end' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Moments marked
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length} thing
                {memorableItems.length === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Answers recorded
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.answered ?? 0} prayer
                {capture?.prayerStats.answered === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Still praying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.pending ?? 0} prayer
                {capture?.prayerStats.pending === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What I want to carry
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.carry?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : reviewType === 'quarterly' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                One faithful focus
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.faithfulness_quarter?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Important decision
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.decision?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
          </>
        ) : isMonthly ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Prayer for next month
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.prayer_for_month?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Rhythm to protect
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.rhythm?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Still in prayer
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.pending ?? 0} prayer
                {capture?.prayerStats.pending === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                One faithful step
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.faithful_step?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        );

      return (
        <StaggeredReviewStage
          animationKey={current.key}
          enabled={reviewType === 'weekly'}
          style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && (
              <Ionicons
                name={current.icon as any}
                size={16}
                color={Colors.sage}
              />
            )}
            <ThemedText weight="semiBold" style={styles.label}>
              YOUR {label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>

          <View style={styles.summaryCard}>{summaryRows}</View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            activeOpacity={0.7}>
            <ThemedText weight="bold" style={styles.primaryButtonText}>
              Done
            </ThemedText>
          </TouchableOpacity>
        </StaggeredReviewStage>
      );
    }

    return null;
  };

  if (isLoadingReview || reviewLoadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.lightBackground}
          translucent={false}
        />
        <HeaderBackButton
          style={[styles.backButton, {top: topInset + 8}]}
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          accessibilityLabel="Back"
          color={Colors.text}
        />
        <View style={styles.reviewLoadState}>
          {isLoadingReview ? (
            <>
              <ActivityIndicator color={Colors.sage} />
              <ThemedText>Loading your review…</ThemedText>
            </>
          ) : (
            <>
              <ThemedText>We couldn’t load your review.</ThemedText>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => setReviewLoadAttempt(attempt => attempt + 1)}>
                <ThemedText weight="bold" style={styles.primaryButtonText}>
                  Try again
                </ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (reviewType === 'weekly' && currentStageKind === 'ready' && review) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <WeeklyReviewSummary
          topInset={topInset}
          backAccessibilityLabel="Previous review step"
          onBack={() => goTo(stage - 1)}
          onClose={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          review={{...review, answers, memorableItems}}
          capture={capture}
          activeTab={weeklySummaryTab}
          onTabChange={setWeeklySummaryTab}
          onEdit={stageKey => {
            goTo(stages.findIndex(item => item.key === stageKey) + 1);
            editingReviewSummaryRef.current = true;
          }}
          onFinish={finishWeeklyReview}
          saving={isFinishingWeeklyReview}
          saveError={weeklyCompletionError}
          bottomInset={insets.bottom}
        />
      </SafeAreaView>
    );
  }

  if (reviewType === 'monthly' && currentStageKind === 'ready' && review) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <MonthlyReviewSummary
          topInset={topInset}
          backAccessibilityLabel="Previous review step"
          onBack={() => goTo(stage - 1)}
          onClose={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          review={{...review, answers, memorableItems}}
          capture={capture}
          patternSummary={monthlyPatternSummary}
          activeTab={monthlySummaryTab}
          onTabChange={setMonthlySummaryTab}
          onEdit={stageKey => {
            goTo(stages.findIndex(item => item.key === stageKey) + 1);
            editingReviewSummaryRef.current = true;
          }}
          onFinish={finishMonthlyReview}
          saving={isFinishingMonthlyReview}
          saveError={monthlyCompletionError}
          bottomInset={insets.bottom}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.lightBackground}
        translucent={false}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(246, 245, 239, 1)',
          'rgba(246, 245, 239, 0.88)',
          'rgba(246, 245, 239, 0)',
        ]}
        locations={[0, 0.58, 1]}
        style={[styles.topChromeBlend, {height: topInset + 74}]}
      />

      {!isDesignedCoverStage && (
        <View
          testID="review-progress-bar"
          style={[styles.actionProgressBar, {top: topInset + 25}]}
          pointerEvents="none">
          <View
            testID="review-progress-fill"
            style={[
              styles.actionProgressFill,
              {
                width: `${
                  (reviewProgressStep / reviewProgressStepCount) * 100
                }%`,
              },
            ]}
          />
        </View>
      )}

      <HeaderBackButton
        style={[styles.backButton, {top: topInset + 8}]}
        onPress={() => {
          if (stage > 1) {
            goTo(stage - 1);
            return;
          }
          triggerLightHaptic();
          navigation.goBack();
        }}
        accessibilityLabel={stage > 1 ? 'Previous review step' : 'Back'}
        color={Colors.text}
      />

      <HeaderCloseButton
        style={[styles.closeButton, {top: topInset + 8}]}
        onPress={() => {
          triggerLightHaptic();
          Keyboard.dismiss();
          navigation.goBack();
        }}
        accessibilityLabel="Close review"
      />

      <View style={{flex: 1}} {...panResponder.panHandlers}>
        {hasHorizontalMomentCarousels || isWeeklyLookingForwardWalkthrough ? (
          renderCurrentStage()
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{flex: 1}}
            bounces={!(stage === 1 && isDesignedReview)}
            contentContainerStyle={{
              flexGrow:
                (stage === 1 && isDesignedReview) || isLifeCheckInStage
                  ? 1
                  : undefined,
              paddingTop: topInset + 36,
              paddingBottom: keyboardVisible
                ? hasAutoScrollingReviewInput
                  ? keyboardHeight + 88
                  : 320
                : insets.bottom + (hasFloatingNavigation ? 88 : 28),
            }}
            onContentSizeChange={
              isMonthlyPatternsStage
                ? revealMonthlyPatternInput
                : hasAutoScrollingReviewInput
                ? revealCustomReviewInput
                : undefined
            }
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            {renderCurrentStage()}
          </ScrollView>
        )}
      </View>

      {isFeelingsStage && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.feelingsFooter, {bottom: floatingActionBottom}]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.feelingsNext}
            onPress={() => goTo(stage + 1)}
            activeOpacity={0.7}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {isCapturedStage && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.capturedFooter, {bottom: floatingActionBottom}]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPress={() => goTo(stage + 1)}
            activeOpacity={0.7}
            style={styles.feelingsNext}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {isDesignedLookingAheadStage && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.weeklyLookingAheadFooter,
            {bottom: floatingActionBottom},
          ]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              reviewType === 'monthly'
                ? 'Continue to monthly looking ahead'
                : 'Continue to weekly priorities'
            }
            activeOpacity={0.8}
            onPress={() => goTo(stage + 1)}
            style={styles.weeklyLookingAheadContinueButton}>
            <ThemedText
              weight="bold"
              style={styles.weeklyLookingAheadContinueText}>
              Continue
            </ThemedText>
            {reviewType !== 'monthly' && (
              <Ionicons
                name="arrow-forward"
                size={22}
                color={Colors.hopeWhite}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {showsStandardNextButton && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.feelingsFooter, {bottom: floatingActionBottom}]}>
          {isDesignedPriorityStage && weeklyPriorityInputCount < 3 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add another priority"
              onPress={addWeeklyPriorityInput}
              activeOpacity={0.7}
              style={[styles.feelingsNext, styles.weeklyPriorityAdd]}>
              <Ionicons name="add" size={24} color={Colors.sage} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.feelingsNext}
            activeOpacity={0.7}
            onPress={() => goTo(stage + 1)}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  reviewLoadState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  topChromeBlend: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 19,
  },
  actionProgressBar: {
    position: 'absolute',
    left: '50%',
    zIndex: 20,
    height: 6,
    width: 120,
    marginLeft: -60,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.sage,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 21,
  },
  backButton: {
    position: 'absolute',
    left: 18,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  weeklyCoverStage: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  monthlyCoverStage: {
    paddingTop: 6,
  },
  weeklyCoverContent: {
    width: '100%',
  },
  weeklyCoverArtwork: {
    width: '100%',
    height: 128,
  },
  monthlyCoverArtwork: {
    height: 100,
  },
  weeklyCoverHero: {
    alignItems: 'center',
    marginTop: 7,
  },
  monthlyCoverHero: {
    marginTop: 0,
  },
  weeklyCoverLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  weeklyCoverEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.8,
  },
  reviewPeriodHeadline: {
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 35,
    lineHeight: 43,
    textAlign: 'center',
    marginTop: 8,
  },
  reviewDirectionPrompt: {
    color: Colors.sage,
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center',
  },
  weeklyCoverSubtitle: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  monthlyCoverSubtitle: {
    marginTop: 5,
  },
  weeklyShowedUpCard: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 15,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(223, 228, 221, 0.72)',
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 2,
  },
  monthlyShowedUpCard: {
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 11,
  },
  weeklyShowedUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  weeklyShowedUpIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyShowedUpCopy: {
    flex: 1,
  },
  weeklyShowedUpLabel: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.3,
  },
  weeklyShowedUpTotal: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
    marginTop: 1,
  },
  weeklyShowedUpBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingTop: 10,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.12)',
  },
  weeklyShowedUpBadgeValue: {
    color: Colors.sage,
    fontSize: 18,
    lineHeight: 23,
  },
  weeklyShowedUpBadgeTotal: {
    color: Colors.textGray,
    fontSize: 9,
    lineHeight: 13,
    marginLeft: 1,
  },
  weeklyDayChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 15,
    paddingHorizontal: 7,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(246, 245, 239, 0.82)',
  },
  monthlyDayChart: {
    marginTop: 11,
    paddingTop: 7,
    paddingBottom: 6,
  },
  weeklyDayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyDayTrack: {
    width: 8,
    height: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
  },
  weeklyDayBar: {
    width: 8,
    borderRadius: 5,
    minHeight: 5,
  },
  weeklyDayBarActive: {
    backgroundColor: Colors.sage,
  },
  weeklyDayBarQuiet: {
    backgroundColor: Colors.anchorBlueLight,
  },
  weeklyDayLabel: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 5,
  },
  weeklyDayLabelActive: {
    color: Colors.text,
  },
  weeklySummarySection: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 17,
    paddingTop: 15,
  },
  monthlySummarySection: {
    marginTop: 12,
    paddingTop: 11,
  },
  weeklySummaryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weeklySummaryEyebrow: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.4,
  },
  weeklySummaryRule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  weeklySummaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  monthlySummaryMetrics: {
    marginTop: 6,
  },
  weeklySummaryMetricSlot: {
    width: '50%',
    padding: 4,
  },
  weeklySummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(230, 235, 229, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    minHeight: 53,
  },
  monthlySummaryPill: {
    minHeight: 48,
    paddingVertical: 7,
  },
  weeklySummaryCount: {
    color: Colors.text,
    width: 30,
    fontSize: 19,
    lineHeight: 24,
  },
  monthlySummaryCount: {
    width: 42,
    flexShrink: 0,
  },
  weeklySummaryLabel: {
    flex: 1,
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
  },
  weeklySummaryToggle: {
    minHeight: 35,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  monthlySummaryToggle: {
    minHeight: 31,
    marginTop: 2,
    paddingVertical: 5,
  },
  weeklySummaryToggleText: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 16,
  },
  weeklyBeginButton: {
    marginTop: 18,
    minHeight: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  monthlyBeginButton: {
    marginTop: 12,
  },
  weeklyBeginText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  feelingsStage: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  feelingsHeading: {
    alignItems: 'center',
  },
  feelingsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  feelingsLabel: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.8,
  },
  feelingsQuestion: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 35,
    textAlign: 'center',
    marginTop: 17,
  },
  feelingsSubtitle: {
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  checkInSummary: {
    alignItems: 'center',
    marginTop: 22,
  },
  checkInSummaryLabel: {
    color: Colors.textGray,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.4,
    marginBottom: 9,
  },
  monthlyCheckInSummaryCopy: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -3,
    marginBottom: 11,
  },
  checkInSummaryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  checkInSummaryPill: {
    minHeight: 31,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInSummaryPillText: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 16,
  },
  monthlyCheckInSummaryPillActive: {
    backgroundColor: Colors.sage,
  },
  monthlyCheckInSummaryPillTextActive: {
    color: Colors.hopeWhite,
  },
  monthlyCheckInHint: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
  monthlyCheckInDetails: {
    alignSelf: 'stretch',
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 13,
    paddingHorizontal: 15,
  },
  monthlyCheckInDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: Colors.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthlyCheckInDate: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 18,
    minWidth: 48,
  },
  monthlyCheckInReflection: {
    flex: 1,
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 19,
  },
  weeklyChoicePrompt: {
    alignItems: 'center',
    marginTop: 26,
  },
  weeklyChoicePromptLabel: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  feelingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  feelingPill: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderColor: 'rgba(82, 106, 91, 0.2)',
    borderWidth: 1,
    borderRadius: 28,
  },
  feelingPillSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  feelingPillDisabled: {
    opacity: 0.48,
  },
  feelingPillText: {
    color: Colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  feelingPillTextSelected: {
    color: Colors.hopeWhite,
  },
  feelingsShowMore: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 16,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  feelingsShowMoreText: {
    color: Colors.sage,
    fontSize: 14,
    fontWeight: '600',
  },
  customFeelingInput: {
    minHeight: 52,
    width: '100%',
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 17,
    textAlign: 'left',
    paddingHorizontal: 0,
    paddingVertical: 10,
    marginTop: 10,
  },
  feelingsFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    zIndex: 30,
  },
  feelingsNext: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lifeCheckInStage: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 3,
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  lifeCheckInHeading: {
    alignItems: 'center',
  },
  lifeCheckInQuestion: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 6,
  },
  lifeCheckInSubtitle: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  lifeCheckInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lifeCheckInIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.12)',
  },
  lifeCheckInContent: {
    flex: 1,
    minWidth: 0,
  },
  lifeCheckInAreaLabel: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 2,
  },
  lifeCheckInOptions: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
  },
  lifeCheckInPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 20,
  },
  lifeCheckInPillText: {
    fontSize: 14,
    lineHeight: 18,
  },
  weeklyCapturedStage: {
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  weeklyCareStage: {
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  weeklyCareAreas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 24,
  },
  weeklyCareAreaSlot: {width: '50%', padding: 6},
  weeklyCareArea: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlueLight,
  },
  weeklyCareAreaSelected: {backgroundColor: Colors.sage},
  weeklyCareAreaLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  weeklyCareAreaLabelSelected: {color: Colors.hopeWhite},
  weeklyCareNote: {marginTop: 24},
  weeklyCareOther: {marginBottom: 20},
  weeklyCareOtherInput: {minHeight: 56},
  weeklyChallengeStage: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  weeklyChallengeTitle: {
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'center',
    color: Colors.text,
  },
  weeklyChallengeSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: Colors.textGray,
    marginTop: 12,
  },
  weeklyChallengeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
  },
  weeklyChallengePill: {
    maxWidth: '100%',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weeklyChallengeOther: {marginTop: 24},
  weeklyChallengeInput: {minHeight: 72},
  weeklyClosingStage: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  weeklyClosingNote: {marginTop: 28},
  weeklyPrayerInput: {
    minHeight: 180,
    marginTop: 8,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.text,
  },
  weeklyAheadOptional: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 12,
  },
  weeklyCareNoteLabel: {fontSize: 13, lineHeight: 19, color: Colors.textGray},
  weeklyCareInput: {
    minHeight: 96,
    marginTop: 8,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.text,
  },
  weeklyCapturedHeading: {
    alignItems: 'center',
    marginBottom: 22,
  },
  monthlyWinsStage: {
    paddingTop: 28,
    paddingHorizontal: 22,
  },
  monthlyWinsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  monthlyWinsCount: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  monthlyWinsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  monthlyWinsColumn: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  monthlyWinGridCard: {
    width: '100%',
    padding: 15,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 20,
  },
  monthlyWinGridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  monthlyWinGridIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.09)',
  },
  monthlyWinGridDate: {
    flexShrink: 1,
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  monthlyWinGridType: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  monthlyWinGridRule: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  monthlyWinGridLabel: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  monthlyWinGridText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  weeklyAdditionalMemory: {
    marginTop: 24,
  },
  weeklyAdditionalMemoryTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 24,
  },
  weeklyAdditionalMemoryInput: {
    minHeight: 120,
    marginTop: 8,
  },
  weeklySavedPrayer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 17,
    padding: 17,
    marginTop: 24,
  },
  weeklySavedPrayerBody: {
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  weeklyCapturedTitle: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 35,
    textAlign: 'center',
    marginTop: 17,
  },
  weeklyCapturedSubtitle: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  monthlyMomentsTabs: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginTop: 22,
  },
  monthlyMomentsTab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  monthlyMomentsTabActive: {
    borderBottomColor: Colors.sage,
  },
  monthlyMomentsTabText: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  monthlyMomentsTabTextActive: {
    color: Colors.text,
  },
  monthlyMomentsFallback: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginTop: 20,
  },
  monthlyMomentsFallbackText: {
    flexShrink: 1,
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  weeklyMomentsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  weeklyMomentGroupHeader: {
    alignItems: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  weeklyMomentGroupTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
  },
  weeklyMomentGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weeklyMomentGroupCount: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  momentTypeCard: {
    minHeight: 196,
    padding: 20,
    paddingTop: 22,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  momentTypeCardSelected: {
    borderColor: Colors.sage,
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  momentTypeCardHearted: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(217, 120, 114, 0.07)',
  },
  heartJournalReviewCard: {
    alignSelf: 'flex-start',
  },
  forMeDayReviewCard: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBF7EE',
    borderColor: 'rgba(185, 149, 98, 0.38)',
  },
  forMeDayReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 38,
    marginBottom: 14,
  },
  forMeDayReviewMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185, 149, 98, 0.14)',
  },
  forMeDayReviewHeadingCopy: {
    flex: 1,
  },
  forMeDayReviewEyebrow: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.4,
  },
  forMeDayReviewDate: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  forMeDayReviewPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    marginBottom: 9,
  },
  forMeDayReviewPillText: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.05,
  },
  forMeDayReviewTitle: {
    color: Colors.text,
    fontFamily: Platform.select({ios: 'Georgia-Bold', android: 'serif'}),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 27,
    marginBottom: 9,
    paddingRight: 12,
  },
  forMeDayReviewBody: {
    color: Colors.text,
    fontFamily: Platform.select({ios: 'Georgia', android: 'serif'}),
    fontSize: 14,
    lineHeight: 22,
  },
  forMeDayReviewDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(185, 149, 98, 0.24)',
    marginVertical: 14,
  },
  forMeDayReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forMeDayReviewFooterText: {
    flex: 1,
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
  },
  momentRemember: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    zIndex: 2,
  },
  momentRememberSelected: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  momentHeart: {
    borderColor: 'rgba(217, 120, 114, 0.42)',
  },
  momentHeartSelected: {
    backgroundColor: 'rgba(217, 120, 114, 0.16)',
    borderColor: Colors.alertCoral,
  },
  psalmRemember: {
    backgroundColor: 'rgba(232, 237, 232, 0.72)',
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  momentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 36,
    marginBottom: 12,
  },
  momentDate: {
    marginLeft: 'auto',
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
  },
  reflectionBadge: {
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  guidedBadge: {
    backgroundColor: 'rgba(103, 124, 146, 0.1)',
  },
  reflectionBadgeText: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.1,
  },
  reflectionTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 10,
  },
  reflectionDetail: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -5,
    marginBottom: 10,
  },
  guidedLifeArea: {
    marginTop: -2,
    marginBottom: 10,
  },
  guidedLifeAreaValue: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 18,
  },
  reflectionBody: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
    flexShrink: 1,
  },
  reflectionBlocksPreview: {
    marginTop: 2,
  },
  gratitudeCardEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.3,
  },
  gratitudeCardSubtitle: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  gratitudeLines: {gap: 10},
  gratitudeLine: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  gratitudeNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.actionBackground,
  },
  gratitudeNumberText: {color: Colors.sage, fontSize: 11, lineHeight: 15},
  gratitudeText: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 19},
  momentShowMore: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
  },
  momentShowMoreText: {color: Colors.sage, fontSize: 11, lineHeight: 15},
  scriptureReviewCard: {alignItems: 'center'},
  scriptureNoteReviewCard: {padding: 18, paddingTop: 18},
  scriptureCenteredEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.3,
    marginBottom: 12,
  },
  scriptureCenteredTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  scriptureTranslation: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  scriptureQuote: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },
  momentDivider: {
    height: 1,
    width: '100%',
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  scriptureFooter: {flexDirection: 'row', alignItems: 'center', gap: 6},
  scriptureFooterText: {color: Colors.textGray, fontSize: 11, lineHeight: 16},
  centeredMomentDate: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 7,
  },
  sessionEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
  },
  sessionTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 5,
    paddingRight: 28,
  },
  sessionDetail: {color: Colors.textGray, fontSize: 12, lineHeight: 18},
  sessionQuoteBox: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(82, 106, 91, 0.3)',
    paddingLeft: 12,
    marginTop: 13,
  },
  sessionQuote: {color: Colors.text, fontSize: 13, lineHeight: 20},
  sessionFooter: {flexDirection: 'row', alignItems: 'center', gap: 6},
  sessionFooterText: {color: Colors.textGray, fontSize: 11, lineHeight: 16},
  winHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 36,
    marginBottom: 13,
  },
  winEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
  },
  winType: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  winQuietLabel: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  winText: {color: Colors.text, fontSize: 14, lineHeight: 22},
  morningCheckInFeelingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
    paddingRight: 32,
  },
  morningCheckInFeeling: {
    flex: 1,
    color: Colors.text,
    fontSize: 20,
    lineHeight: 27,
  },
  morningCheckInVerse: {
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  morningCheckInReference: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  morningCheckInUnderneath: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rhythmReviewCard: {backgroundColor: 'rgba(232, 237, 232, 0.72)'},
  rhythmEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
  },
  rhythmTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 9,
  },
  rhythmTruthLabel: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  rhythmBody: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 22,
    paddingBottom: 20,
  },
  proverbWisdomSection: {paddingBottom: 20},
  proverbWisdomItem: {marginTop: 9},
  proverbWisdomLabel: {color: Colors.text, fontSize: 15, lineHeight: 21},
  proverbResponseSection: {
    marginTop: 13,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
  },
  proverbResponseText: {color: Colors.textGray, fontSize: 14, lineHeight: 21},
  rhythmReadingProgress: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  todoSummary: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 13,
  },
  todoReviewList: {gap: 9},
  todoReviewRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  todoReviewText: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 20},
  todoReviewTextCompleted: {
    color: Colors.textGray,
    textDecorationLine: 'line-through',
    opacity: 0.72,
  },
  journalMomentText: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 25,
    paddingTop: 10,
  },
  lookingForwardReviewCard: {backgroundColor: 'rgba(232, 237, 232, 0.72)'},
  lookingForwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 32,
  },
  lookingForwardText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  lookingForwardHeldSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  lookingForwardEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lookingForwardEmotion: {color: Colors.text, fontSize: 16, lineHeight: 22},
  lookingForwardWritten: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 14,
    textAlign: 'right',
  },
  focusPriorities: {
    gap: 9,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  focusPrioritiesTitle: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  focusPriorityRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  focusPriorityText: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  focusPriorityTextCompleted: {
    color: Colors.textGray,
    textDecorationLine: 'line-through',
    opacity: 0.72,
  },
  weeklyMomentsEmpty: {
    minHeight: 108,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyMomentsEmptyText: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  capturedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center' as const,
    color: Colors.textGray,
    marginBottom: 32,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
  },
  weeklyLookingAheadStage: {
    paddingTop: 68,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  weeklyLookingAheadArtwork: {
    width: '100%',
    height: 164,
  },
  weeklyLookingAheadCopy: {
    alignItems: 'center',
    marginTop: 24,
  },
  weeklyLookingAheadLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  weeklyLookingAheadLabel: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.8,
  },
  weeklyLookingAheadSubtitle: {
    maxWidth: 340,
    color: Colors.textGray,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 10,
  },
  weeklyLookingAheadFooter: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 30,
  },
  weeklyLookingAheadContinueButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  weeklyLookingAheadContinueText: {
    color: Colors.hopeWhite,
    fontSize: 17,
    lineHeight: 22,
  },
  weeklyGratitudeStage: {
    paddingTop: 34,
    paddingHorizontal: 20,
  },
  monthlyLifeSummaryStage: {
    paddingTop: 34,
    paddingHorizontal: 24,
  },
  monthlyLifeSummaryHeading: {
    alignItems: 'center',
  },
  monthlyLifeSummaryTitle: {
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 14,
  },
  monthlyLifeSummarySubtitle: {
    maxWidth: 330,
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  monthlyLifeInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(82, 106, 91, 0.07)',
  },
  monthlyLifeInsightText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  monthlyLifeLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 22,
  },
  monthlyLifeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthlyLifeLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  monthlyLifeLegendText: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
  },
  monthlyLifeAreaList: {
    marginTop: 12,
  },
  monthlyLifeArea: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  monthlyLifeAreaHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthlyLifeAreaIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  monthlyLifeAreaLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  monthlyLifeInterpretation: {
    maxWidth: 150,
    color: Colors.sage,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  monthlyLifeWeeks: {
    flexDirection: 'row',
    gap: 5,
    height: 9,
    marginTop: 14,
  },
  monthlyLifeWeek: {
    flex: 1,
    borderRadius: 999,
  },
  monthlyLifeAreaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
  },
  monthlyLifeCounts: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
  },
  monthlyLifeCoverage: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  monthlyLifeTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthlyLifeTrendText: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
  },
  monthlyLifeEmpty: {
    marginTop: 30,
    paddingVertical: 26,
  },
  monthlyLifeEmptyText: {
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  monthlyChoiceStage: {
    paddingTop: 34,
    paddingHorizontal: 24,
  },
  monthlyChoiceHeading: {
    alignItems: 'center',
  },
  monthlyChoiceTitle: {
    maxWidth: 340,
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 14,
  },
  monthlyChoiceSubtitle: {
    maxWidth: 330,
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  monthlyChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 32,
  },
  monthlyChoicePill: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.cardBackground,
  },
  monthlyChoicePillSelected: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  monthlyChoicePillDisabled: {
    opacity: 0.42,
  },
  monthlyChoicePillText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  monthlyChoicePillTextSelected: {
    color: Colors.hopeWhite,
  },
  monthlyChoiceDetails: {
    marginTop: 34,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  monthlyChoiceDetailsTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
  },
  monthlyChoiceDetailsSubtitle: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  monthlyChoiceDetailSection: {
    marginTop: 22,
  },
  monthlyChoiceDetailLabel: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 19,
  },
  monthlyChoiceDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  monthlyChoiceDetailPill: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.cardBackground,
  },
  monthlyChoiceDetailPillSelected: {
    borderColor: Colors.sageMuted,
    backgroundColor: Colors.anchorBlueLight,
  },
  monthlyChoiceDetailPillText: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
  },
  monthlyChoiceDetailPillTextSelected: {
    color: Colors.text,
  },
  monthlyChoiceOtherInput: {
    minHeight: 108,
    marginTop: 24,
    paddingHorizontal: 0,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  monthlyCareList: {
    marginTop: 28,
  },
  monthlyCareRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    paddingVertical: 12,
  },
  monthlyCareIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthlyCareCopy: {
    flex: 1,
    minWidth: 0,
  },
  monthlyCareLabel: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  monthlyCareSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  monthlyCareSignal: {
    color: Colors.alertCoral,
    fontSize: 11,
    lineHeight: 17,
  },
  monthlyCareEvidence: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 17,
  },
  monthlyCareMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthlyChoiceCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyChoiceCheckSelected: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  monthlyPrayerStage: {
    paddingTop: 34,
    paddingHorizontal: 28,
  },
  monthlyTestimonyStage: {
    paddingTop: 34,
    paddingHorizontal: 24,
  },
  monthlyTestimonyHeading: {
    alignItems: 'center',
  },
  monthlyTestimonyEmblem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 17,
    backgroundColor: '#EBEEE2',
  },
  monthlyTestimonyTitle: {
    maxWidth: 320,
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 25,
    lineHeight: 33,
    textAlign: 'center',
  },
  monthlyTestimonySubtitle: {
    maxWidth: 330,
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 9,
  },
  monthlyTestimonyCard: {
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E4D8',
    backgroundColor: '#FBF7EE',
  },
  monthlyTestimonyCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  monthlyTestimonyIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBEEE2',
  },
  monthlyTestimonyCardTitle: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 15,
    lineHeight: 21,
  },
  monthlyTestimonyDatePill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E9EEE4',
  },
  monthlyTestimonyDateText: {
    flexShrink: 1,
    color: Colors.sage,
    fontSize: 8.5,
    lineHeight: 12,
  },
  monthlyTestimonyRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    backgroundColor: '#E7E4D8',
  },
  monthlyTestimonyBody: {
    color: Colors.text,
    fontFamily: Fonts.lora.regular,
    fontSize: 14,
    lineHeight: 23,
    marginTop: 14,
  },
  monthlyTestimonyFootnote: {
    maxWidth: 310,
    alignSelf: 'center',
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 14,
  },
  monthlyPatternsStage: {
    paddingTop: 34,
    paddingHorizontal: 28,
  },
  monthlyPatternsHeading: {
    alignItems: 'center',
  },
  monthlyPatternsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  monthlyPatternsLabel: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
  monthlyPatternsTitle: {
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 14,
  },
  monthlyPatternsSubtitle: {
    maxWidth: 330,
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  monthlyPatternList: {
    gap: 22,
    marginTop: 16,
  },
  monthlyPatternSection: {
    marginTop: 32,
  },
  monthlyPatternSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  monthlyPatternSectionTitle: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.3,
  },
  monthlyPatternEmptyText: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  monthlyPatternRow: {
    gap: 9,
  },
  monthlyPatternLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthlyPatternName: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  monthlyPatternCount: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  monthlyPatternTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: Colors.inputBackground,
    overflow: 'hidden',
  },
  monthlyPatternFill: {
    height: '100%',
    minWidth: 10,
    borderRadius: 999,
  },
  monthlyPatternInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 30,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  monthlyPatternInsightCopy: {flex: 1},
  monthlyPatternInsightLabel: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.35,
  },
  monthlyPatternInsightText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  monthlyPatternNote: {
    minHeight: 132,
    marginTop: 38,
  },
  monthlyPatternNoteTitle: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  monthlyPatternInput: {
    flex: 1,
    minHeight: 94,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 0,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 25,
  },
  weeklyDifficultyStage: {
    paddingTop: 34,
  },
  weeklyGratitudeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  weeklyGratitudeLabel: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    color: Colors.sageMuted,
  },
  weeklyGratitudeTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 31,
    textAlign: 'center',
  },
  weeklyGratitudeSubtitle: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  weeklyGratitudeLookBack: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: Colors.anchorBlueLight,
  },
  weeklyGratitudeLookBackToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  weeklyGratitudeLookBackTitle: {
    flex: 1,
    color: Colors.sage,
    fontSize: 14,
    lineHeight: 21,
  },
  weeklyGratitudeLookBackContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  weeklyGratitudeLookBackHint: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 20,
  },
  weeklyGratitudeLookBackDay: {gap: 6},
  weeklyGratitudeLookBackCard: {
    backgroundColor: Colors.anchorBlueLight,
    minHeight: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  weeklyGratitudeLookBackDatePill: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(82, 106, 91, 0.12)',
  },
  weeklyGratitudeLookBackDate: {
    color: Colors.sage,
    fontSize: 12,
    lineHeight: 18,
  },
  weeklyGratitudeInputs: {
    gap: 14,
    marginTop: 22,
  },
  weeklyGratitudeInput: {
    borderRadius: 18,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 0,
    includeFontPadding: false,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.text,
  },
  weeklyPriorityAdd: {
    marginRight: 12,
    backgroundColor: Colors.anchorBlueLight,
  },
  godFaithfulnessStage: {
    paddingTop: 34,
    paddingHorizontal: 24,
  },
  godFaithfulnessQuestion: {
    fontFamily: Fonts.lora.bold,
    color: Colors.text,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    marginTop: 4,
  },
  godFaithfulnessSubtitle: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  godFaithfulnessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 28,
  },
  godFaithfulnessInput: {
    width: '100%',
    minHeight: 112,
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.text,
  },
  question: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center' as const,
    color: Colors.text,
    marginBottom: 24,
  },
  questionWithSubtitle: {
    marginBottom: 8,
  },
  questionSubtitle: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    paddingVertical: 16,
    minHeight: 200,
    textAlignVertical: 'top' as const,
  },
  shortInput: {
    minHeight: 56,
    paddingVertical: 12,
    marginBottom: 12,
  },
  captureStats: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  captureStatTotal: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  captureStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  captureStatLabel: {
    fontSize: 14,
    color: Colors.textGray,
  },
  captureStatValue: {
    fontSize: 14,
    color: Colors.text,
  },
  captureItem: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  carryForwardSection: {
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.18)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
  },
  carryForwardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  carryForwardEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.3,
  },
  carryForwardCopy: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 13,
  },
  allMomentsHeading: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.3,
    marginBottom: 10,
    marginLeft: 2,
  },
  captureItemHeader: {
    gap: 4,
  },
  captureItemTitle: {
    fontSize: 16,
    color: Colors.text,
  },
  captureItemSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
  },
  rememberButton: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  rememberButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryKey: {
    fontSize: 14,
    color: Colors.textGray,
    flexShrink: 0,
    width: 120,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    textAlign: 'right' as const,
  },
});

export default ReviewScreen;
