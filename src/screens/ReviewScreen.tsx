import { useAuth } from '../context/IndustryStandardAuthContext';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  findNodeHandle,
  Keyboard,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import Entypo from 'react-native-vector-icons/Entypo';
import {BookHeart} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import ThemedText from '../components/common/ThemedText';
import ProverbVerseExcerpt from '../components/scripture/ProverbVerseExcerpt';
import PrayerHandsIcon from '../components/common/PrayerHandsIcon';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { toLocalDateString } from '../utils/date';
import {
  type ReviewType,
  type LocalReviewEntry,
  type ReviewMemorableItem,
  type ReviewPrayerSnapshotItem,
  getOrCreateLocalReviewForPeriod,
  updateLocalReview,
} from '../storage/reviewStorage';
import { getReviewSettings } from '../storage/reviewSettingsStorage';
import {
  getWeeklyPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
  getYearEndPeriodFor,
  getBeginYearPeriodFor,
  type ReviewPeriod,
} from '../services/reviewPeriodService';
import { getReviewCapture, type ReviewCapture, type ReviewCaptureItem, type ReviewCaptureKind, type ReviewCapturePresentation } from '../services/reviewCaptureService';
import { getReviewStages } from '../services/reviewStages';
import {getWeeklyRhythm, type WeeklyRhythm} from '../services/weeklyRhythmService';
import {getWeeklyCheckInFeelings, type WeeklyCheckInFeeling} from '../services/weeklyFeelingService';
import {getReviewCoverSummary} from '../services/reviewCoverSummaryService';
import {useFloatingKeyboardButton} from '../hooks/useFloatingKeyboardButton';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const BotanicalMark = () => (
  <View style={styles.botanicalMark} accessibilityElementsHidden>
    <View style={styles.botanicalStem} />
    <Ionicons name="leaf-outline" size={22} color={Colors.text} style={styles.botanicalLeafTop} />
    <Ionicons name="leaf-outline" size={20} color={Colors.text} style={styles.botanicalLeafLeft} />
    <Ionicons name="leaf-outline" size={19} color={Colors.text} style={styles.botanicalLeafRight} />
  </View>
);

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

const WEEKLY_SPIRITUAL_REFLECTION_WORDS = [
  'Blessed',
  'Still learning',
  'God felt near',
  'Wrestling',
  'Faithful',
  'Waiting',
  'Strengthened',
  'Uncertain',
  'Held',
  'Spiritually dry',
  'Guided',
  'God felt distant',
  'Grateful',
  'Being refined',
  'Growing',
  'Surrendering',
  'Awakened',
  'Seeking',
] as const;

const CAPTURE_PRESENTATION_GROUPS: Array<{presentation: ReviewCapturePresentation; title: string}> = [
  {presentation: 'morning_check_in', title: 'Morning check-ins'},
  {presentation: 'morning_psalm', title: 'Daily Psalms'},
  {presentation: 'focus', title: 'What you focused on'},
  {presentation: 'todo', title: 'To-dos'},
  {presentation: 'gratitude_list', title: 'Gratitudes'},
  {presentation: 'evening_proverb', title: 'Evening Proverbs'},
  {presentation: 'today_win', title: 'Wins'},
  {presentation: 'looking_forward', title: 'Looking forward'},
  {presentation: 'prayer', title: 'Prayers'},
  {presentation: 'bible_study', title: 'Bible studies'},
  {presentation: 'scripture_reflection', title: 'Scripture notes'},
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
  morning_check_in: 'sunny-outline',
  morning_psalm: 'sunny-outline',
  evening_proverb: 'moon-outline',
  prayer: 'hand-left-outline',
  gratitude_list: 'heart-circle-outline',
  bible_study: 'book-outline',
  scripture_reflection: 'book-outline',
  session_note: 'document-text-outline',
  today_win: 'trophy-outline',
  focus: 'compass-outline',
  todo: 'list-outline',
  looking_forward: 'arrow-forward-circle-outline',
};

const FocusCategoryIcon = ({item, size = 19}: {item: ReviewCaptureItem; size?: number}) => {
  if (!item.focusIcon) {return <MaterialIcons name="filter-center-focus" size={size} color={Colors.sage}/>;}
  if (item.focusIconType === 'material') {
    return <MaterialCommunityIcons name={item.focusIcon} size={size} color={Colors.sage}/>;
  }
  if (item.focusIconType === 'fontawesome') {
    return <FontAwesome6 name={item.focusIcon} size={size - 1} color={Colors.sage}/>;
  }
  return <Ionicons name={item.focusIcon} size={size} color={Colors.sage}/>;
};

const CaptureGroupIcon = ({presentation}: {presentation: ReviewCapturePresentation}) => {
  if (presentation === 'heart_journal') {
    return <BookHeart size={19} color={Colors.sage} strokeWidth={2.5}/>;
  }
  if (presentation === 'prayer') {
    return <PrayerHandsIcon size={19} color={Colors.sage}/>;
  }
  if (presentation === 'bible_study') {
    return <MaterialCommunityIcons name="book-outline" size={19} color={Colors.sage}/>;
  }
  if (presentation === 'focus') {
    return <MaterialIcons name="filter-center-focus" size={19} color={Colors.sage}/>;
  }
  if (presentation === 'todo') {
    return <Entypo name="list" size={19} color={Colors.sage}/>;
  }
  return <Ionicons name={CAPTURE_GROUP_ICONS[presentation]} size={19} color={Colors.sage}/>;
};

const FeelingIcon = ({item}: {item: ReviewCaptureItem}) => {
  if (!item.feelingIcon) {return null;}
  if (item.feelingIconType === 'material') {
    return <MaterialCommunityIcons name={item.feelingIcon} size={22} color={Colors.sage}/>;
  }
  if (item.feelingIconType === 'fontawesome') {
    return <FontAwesome6 name={item.feelingIcon} size={20} color={Colors.sage}/>;
  }
  return <Ionicons name={item.feelingIcon} size={22} color={Colors.sage}/>;
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
  if (!text || text.toLocaleLowerCase() === title.toLocaleLowerCase()) {return title;}
  return `${title} — ${text}`;
};

const HEART_JOURNAL_COUNT_LABELS: Record<string, [string, string]> = {
  Thoughts: ['thought', 'thoughts'],
  Notes: ['note', 'notes'],
  Reflection: ['reflection', 'reflections'],
  'Brain Dump': ['brain dump', 'brain dumps'],
  Lesson: ['lesson', 'lessons'],
  Idea: ['idea', 'ideas'],
  Letter: ['letter', 'letters'],
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
      ? `${remainingTypeCount} more ${remainingTypeCount === 1 ? 'type' : 'types'}`
      : '',
  ].filter(Boolean).join(' · ');
};

const captureGroupCountLabel = (presentation: ReviewCapturePresentation, items: ReviewCaptureItem[]): string => {
  if (presentation === 'heart_journal') {
    return heartJournalCountLabel(items);
  }
  if (presentation === 'morning_check_in') {
    const reflectionCount = items.filter(item => {
      const text = item.text?.trim();
      return text && text.toLocaleLowerCase() !== item.title.trim().toLocaleLowerCase();
    }).length;
    return [
      items.length > 0 ? `${items.length} ${items.length === 1 ? 'check-in' : 'check-ins'}` : '',
      reflectionCount > 0 ? `${reflectionCount} ${reflectionCount === 1 ? 'reflection' : 'reflections'} written` : '',
    ].filter(Boolean).join(' · ');
  }
  if (presentation === 'todo') {
    const completedCount = items.filter(item => item.completed).length;
    const pendingCount = items.length - completedCount;
    const prioritizedCount = items.filter(item => item.priority).length;
    return [
      completedCount > 0 ? `${completedCount} completed` : '',
      pendingCount > 0 ? `${pendingCount} pending` : '',
      prioritizedCount > 0 ? `${prioritizedCount} prioritized` : '',
    ].filter(Boolean).join(' · ');
  }
  if (presentation === 'focus') {
    const completedPriorities = items.reduce((total, item) => total + (item.completedPriorityCount ?? 0), 0);
    return [
      items.length > 0 ? `${items.length} ${items.length === 1 ? 'focus' : 'focuses'}` : '',
      completedPriorities > 0 ? `${completedPriorities} ${completedPriorities === 1 ? 'priority' : 'priorities'} completed` : '',
    ].filter(Boolean).join(' · ');
  }
  if (presentation === 'gratitude_list') {
    const gratitudeCount = items.reduce((total, item) => total + (item.lines?.length || 0), 0);
    return [
      items.length > 0 ? `${items.length} gratitude ${items.length === 1 ? 'list' : 'lists'}` : '',
      gratitudeCount > 0 ? `${gratitudeCount} ${gratitudeCount === 1 ? 'gratitude' : 'gratitudes'}` : '',
    ].filter(Boolean).join(' · ');
  }
  if (presentation === 'today_win') {
    return items.length > 0 ? `${items.length} ${items.length === 1 ? 'win' : 'wins'}` : '';
  }
  if (presentation === 'looking_forward') {
    return items.length > 0 ? `${items.length} ${items.length === 1 ? 'reflection' : 'reflections'} written` : '';
  }
  if (presentation === 'morning_psalm' || presentation === 'evening_proverb') {
    const fullChapterCount = items.filter(item => item.passageRead === true).length;
    const inProgressCount = items.filter(item => item.passageRead === false).length;
    return [
      fullChapterCount > 0 ? `${fullChapterCount} full ${fullChapterCount === 1 ? 'chapter' : 'chapters'} read` : '',
      inProgressCount > 0 ? `${inProgressCount} reading in progress` : '',
    ].filter(Boolean).join(' · ');
  }
  return `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;
};

const WeeklyMomentCard = ({
  item,
  selected,
  width,
  relatedItems = [item],
  onPress,
}: {
  item: ReviewCaptureItem;
  selected: boolean;
  width: number;
  relatedItems?: ReviewCaptureItem[];
  onPress: () => void;
}) => {
  const [showAllLines, setShowAllLines] = useState(false);
  const [underneathOverflows, setUnderneathOverflows] = useState(false);
  const body = item.text?.trim();
  const distinctBody = body && body.toLocaleLowerCase() !== item.title.trim().toLocaleLowerCase() ? body : '';
  const date = formatCapturedDate(item.selectedDate);
  const usesScriptureCardPalette = item.presentation === 'morning_psalm'
    || item.presentation === 'evening_proverb'
    || item.presentation === 'looking_forward';
  const selection = (
    <View style={[
      styles.momentRemember,
      usesScriptureCardPalette && !selected && styles.psalmRemember,
      selected && styles.momentRememberSelected,
    ]}>
      <Ionicons
        name={selected ? 'bookmark' : 'bookmark-outline'}
        size={18}
        color={selected ? Colors.hopeWhite : Colors.sage}/>
    </View>
  );
  const commonProps = {
    accessibilityRole: 'checkbox' as const,
    accessibilityLabel: `${date}. ${capturedMomentCopy(item)}`,
    accessibilityState: {checked: selected},
    activeOpacity: 0.76,
    onPress,
  };
  const shell = (content: React.ReactNode, extraStyle?: object) => (
    <TouchableOpacity {...commonProps} style={[
      styles.momentTypeCard,
      extraStyle,
      selected && styles.momentTypeCardSelected,
      {width},
    ]}>
      {selection}
      {content}
    </TouchableOpacity>
  );

  if (item.presentation === 'prayer') {
    const status = item.answered ? 'ANSWERED' : item.prayerEventType === 'still_carrying' ? 'STILL PRAYING' : 'PRAYED FOR';
    return shell(<>
      <View style={styles.momentMetaRow}>
        <Ionicons name="heart-outline" size={15} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.prayerCardEyebrow}>{status}</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText weight="bold" style={styles.prayerCardTitle} numberOfLines={2}>{item.title}</ThemedText>
      {!!distinctBody && <ThemedText style={styles.prayerCardBody} numberOfLines={4}>{distinctBody}</ThemedText>}
      <View style={styles.prayerStatusPill}>
        <Ionicons name={item.answered ? 'sparkles-outline' : 'leaf-outline'} size={14} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.prayerStatusText}>{item.answered ? 'God answered' : 'Carry in prayer'}</ThemedText>
      </View>
    </>, styles.prayerReviewCard);
  }

  if (item.presentation === 'gratitude_list') {
    const lines = item.lines?.length ? item.lines : [item.title];
    const visibleLines = showAllLines ? lines : lines.slice(0, 5);
    return shell(<>
      <View style={styles.momentMetaRow}>
        <Ionicons name="heart-circle-outline" size={21} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.gratitudeCardEyebrow}>GRATITUDE LIST</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText style={styles.gratitudeCardSubtitle}>{lines.length === 1 ? '1 moment of gratitude' : `${lines.length} moments of gratitude`}</ThemedText>
      <View style={styles.gratitudeLines}>
        {visibleLines.map((line, index) => <View key={`${item.id}-${index}`} style={styles.gratitudeLine}>
          <View style={styles.gratitudeNumber}><ThemedText style={styles.gratitudeNumberText}>{index + 1}</ThemedText></View>
          <ThemedText style={styles.gratitudeText} numberOfLines={2}>{line}</ThemedText>
        </View>)}
      </View>
      {lines.length > 5 && <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{expanded: showAllLines}}
        accessibilityLabel={showAllLines ? 'Show fewer gratitude items' : `Show ${lines.length - 5} more gratitude items`}
        style={styles.momentShowMore}
        onPress={event => {event.stopPropagation(); setShowAllLines(value => !value);}}>
        <Ionicons name={showAllLines ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.sage}/>
        <ThemedText weight="medium" style={styles.momentShowMoreText}>{showAllLines ? 'Show less' : `Show more (${lines.length - 5})`}</ThemedText>
      </TouchableOpacity>}
    </>);
  }

  if (item.presentation === 'bible_study') {
    return shell(<>
      <ThemedText weight="semiBold" style={styles.scriptureCenteredEyebrow}>BIBLE STUDY</ThemedText>
      <ThemedText weight="semiBold" style={styles.scriptureCenteredTitle}>{item.title}</ThemedText>
      {!!item.detail && <ThemedText style={styles.scriptureTranslation}>{item.detail}</ThemedText>}
      {!!distinctBody && <ThemedText style={styles.scriptureQuote} numberOfLines={3}>{distinctBody}</ThemedText>}
      <View style={styles.momentDivider}/>
      <View style={styles.scriptureFooter}><Ionicons name="book-outline" size={14} color={Colors.textGray}/><ThemedText style={styles.scriptureFooterText}>Passage read · Reflection saved</ThemedText></View>
      <ThemedText style={styles.centeredMomentDate}>{date}</ThemedText>
    </>, styles.scriptureReviewCard);
  }

  if (item.presentation === 'session_note') {
    return shell(<>
      <View style={styles.momentMetaRow}>
        <ThemedText weight="semiBold" style={styles.sessionEyebrow}>{(item.subtitle || 'Session Notes').toUpperCase()}</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.sessionTitle} numberOfLines={2}>{item.title}</ThemedText>
      {!!item.detail && <ThemedText style={styles.sessionDetail} numberOfLines={1}>{item.detail}</ThemedText>}
      {!!distinctBody && <View style={styles.sessionQuoteBox}><ThemedText style={styles.sessionQuote} numberOfLines={3}>{distinctBody}</ThemedText></View>}
      <View style={styles.momentDivider}/>
      <View style={styles.sessionFooter}><Ionicons name="document-text-outline" size={14} color={Colors.textGray}/><ThemedText style={styles.sessionFooterText}>Notes and reflections</ThemedText></View>
    </>);
  }

  if (item.presentation === 'today_win') {
    return shell(<>
      <View style={styles.winHeader}>
        <Ionicons name="trophy-outline" size={22} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.winEyebrow}>TODAY'S WIN</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      {!!item.detail && <ThemedText weight="semiBold" style={styles.winType}>{item.detail}</ThemedText>}
      <View style={styles.momentDivider}/>
      <ThemedText weight="medium" style={styles.winQuietLabel}>QUIET WIN</ThemedText>
      <ThemedText style={styles.winText} numberOfLines={4}>{item.text || item.title}</ThemedText>
    </>);
  }

  if (HEART_JOURNAL_PRESENTATIONS.has(item.presentation)) {
    const label = item.presentation === 'guided_reflection' ? (item.subtitle || 'Guided reflection').toUpperCase()
      : item.presentation === 'devotional_reflection' ? 'DEVOTIONAL REFLECTION'
        : item.presentation === 'playbook_reflection' ? 'PLAYBOOK REFLECTION'
        : (item.subtitle || 'Thoughts').toUpperCase();
    return shell(<>
      <View style={styles.momentMetaRow}>
        <View style={[styles.reflectionBadge, item.presentation === 'guided_reflection' && styles.guidedBadge]}><ThemedText weight="semiBold" style={styles.reflectionBadgeText}>{label}</ThemedText></View>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      {item.presentation === 'guided_reflection' && !!item.lifeArea && <View style={styles.guidedLifeArea}>
        <ThemedText weight="medium" style={styles.guidedLifeAreaValue}>{item.lifeArea}</ThemedText>
      </View>}
      <ThemedText weight="medium" style={styles.reflectionTitle} numberOfLines={2}>{item.title}</ThemedText>
      {item.presentation !== 'guided_reflection' && !!item.detail && <ThemedText style={styles.reflectionDetail} numberOfLines={1}>{item.detail}</ThemedText>}
      {!!distinctBody && <ThemedText style={styles.reflectionBody} numberOfLines={4}>{distinctBody}</ThemedText>}
    </>);
  }

  if (item.presentation === 'morning_check_in') {
    return shell(<>
      <View style={styles.morningCheckInFeelingRow}>
        <FeelingIcon item={item}/>
        <ThemedText weight="semiBold" style={styles.morningCheckInFeeling} numberOfLines={2}>{item.title}</ThemedText>
      </View>
      {!!item.scriptureText && <Text style={styles.morningCheckInVerse} numberOfLines={5}>{item.scriptureText}</Text>}
      {!!item.detail && <ThemedText weight="medium" style={styles.morningCheckInReference}>{item.detail}</ThemedText>}
      {!!distinctBody && <>
        <ThemedText
          style={styles.morningCheckInUnderneath}
          numberOfLines={showAllLines ? undefined : 5}
          onTextLayout={event => {
            if (!showAllLines) {setUnderneathOverflows(event.nativeEvent.lines.length > 5);}
          }}>
          {distinctBody}
        </ThemedText>
        {underneathOverflows && <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{expanded: showAllLines}}
          style={styles.momentShowMore}
          onPress={event => {event.stopPropagation(); setShowAllLines(value => !value);}}>
          <Ionicons name={showAllLines ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.sage}/>
          <ThemedText weight="medium" style={styles.momentShowMoreText}>{showAllLines ? 'Show less' : 'Show more'}</ThemedText>
        </TouchableOpacity>}
      </>}
      <ThemedText style={styles.centeredMomentDate}>{date}</ThemedText>
    </>);
  }

  if (item.presentation === 'morning_psalm' || item.presentation === 'evening_proverb') {
    const morning = item.presentation === 'morning_psalm';
    const wisdomItems = item.wisdomItems ?? [];
    const visibleWisdomItems = showAllLines ? wisdomItems : wisdomItems.slice(0, 1);
    const hiddenWisdomCount = Math.max(0, wisdomItems.length - 1);
    const hasStructuredWisdom = !morning && (wisdomItems.length > 0 || Boolean(item.wisdomResponse));
    return shell(<>
      <View style={styles.momentMetaRow}>
        <Ionicons name={morning ? 'sunny-outline' : 'moon-outline'} size={19} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.rhythmEyebrow}>{morning ? 'MORNING PSALM' : 'EVENING PROVERB'}</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.rhythmTitle}>{item.title}</ThemedText>
      {morning && !!distinctBody && <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>WHO GOD IS</ThemedText>}
      {hasStructuredWisdom && <View style={styles.proverbWisdomSection}>
        <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>WISDOM YOU NOTICED</ThemedText>
        {visibleWisdomItems.map((wisdom, index) => <View key={`${item.id}-wisdom-${index}`} style={styles.proverbWisdomItem}>
          <ThemedText weight="semiBold" style={styles.proverbWisdomLabel}>{wisdom.label}</ThemedText>
          {!!wisdom.verses && <ProverbVerseExcerpt reference={wisdom.verses} numberOfLines={5} />}
          {!!wisdom.response && <View style={styles.proverbResponseSection}>
            <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>YOUR RESPONSE</ThemedText>
            <ThemedText style={styles.proverbResponseText}>{wisdom.response}</ThemedText>
          </View>}
        </View>)}
        {wisdomItems.length > 1 && <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{expanded: showAllLines}}
          accessibilityLabel={showAllLines ? 'Show less wisdom' : `Show ${hiddenWisdomCount} more wisdom ${hiddenWisdomCount === 1 ? 'item' : 'items'}`}
          style={styles.momentShowMore}
          onPress={event => {event.stopPropagation(); setShowAllLines(value => !value);}}>
          <Ionicons name={showAllLines ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.sage}/>
          <ThemedText weight="medium" style={styles.momentShowMoreText}>{showAllLines ? 'Show less' : `Show more (${hiddenWisdomCount})`}</ThemedText>
        </TouchableOpacity>}
        {!!item.wisdomResponse && <View style={styles.proverbResponseSection}>
          <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>YOUR RESPONSE</ThemedText>
          <ThemedText style={styles.proverbResponseText}>{item.wisdomResponse}</ThemedText>
        </View>}
      </View>}
      {!hasStructuredWisdom && !!distinctBody && <ThemedText style={styles.rhythmBody} numberOfLines={4}>{distinctBody}</ThemedText>}
      {item.passageRead === false && <View style={styles.rhythmReadingProgress} accessibilityElementsHidden>
        <MaterialCommunityIcons name="progress-star" size={14} color={Colors.sage}/>
      </View>}
    </>, styles.rhythmReviewCard);
  }

  if (item.presentation === 'scripture_reflection') {
    return shell(<>
      <View style={styles.momentMetaRow}><Ionicons name="book-outline" size={18} color={Colors.sage}/><ThemedText weight="semiBold" style={styles.sessionEyebrow}>SCRIPTURE NOTE</ThemedText><ThemedText style={styles.momentDate}>{date}</ThemedText></View>
      <ThemedText weight="semiBold" style={styles.sessionTitle}>{item.title}</ThemedText>
      {!!distinctBody && <View style={styles.sessionQuoteBox}><ThemedText style={styles.sessionQuote} numberOfLines={4}>{distinctBody}</ThemedText></View>}
    </>);
  }

  if (item.presentation === 'todo') {
    const visibleTodos = showAllLines ? relatedItems : relatedItems.slice(0, 5);
    const completedCount = relatedItems.filter(todo => todo.completed).length;
    const pendingCount = relatedItems.length - completedCount;
    return shell(<>
      <View style={styles.momentMetaRow}>
        <Entypo name="list" size={19} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.sessionEyebrow}>TO-DOS</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      <ThemedText style={styles.todoSummary}>{pendingCount} pending · {completedCount} done</ThemedText>
      <View style={styles.todoReviewList}>
        {visibleTodos.map(todo => <View key={todo.id} style={styles.todoReviewRow}>
          <Ionicons name={todo.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={todo.completed ? Colors.sage : Colors.textGray}/>
          <ThemedText style={[styles.todoReviewText, todo.completed && styles.todoReviewTextCompleted]} numberOfLines={2}>{todo.text || todo.title}</ThemedText>
        </View>)}
      </View>
      {relatedItems.length > 5 && <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{expanded: showAllLines}}
        accessibilityLabel={showAllLines ? 'Show fewer to-dos' : `Show ${relatedItems.length - 5} more to-dos`}
        style={styles.momentShowMore}
        onPress={event => {event.stopPropagation(); setShowAllLines(value => !value);}}>
        <Ionicons name={showAllLines ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.sage}/>
        <ThemedText weight="medium" style={styles.momentShowMoreText}>{showAllLines ? 'Show less' : `Show more (${relatedItems.length - 5})`}</ThemedText>
      </TouchableOpacity>}
    </>);
  }

  if (item.presentation === 'focus') {
    const priorities = item.focusPriorities ?? [];
    return shell(<>
      <View style={styles.momentMetaRow}>
        <FocusCategoryIcon item={item} size={18}/>
        <ThemedText weight="semiBold" style={styles.sessionEyebrow}>{item.title.toUpperCase()}</ThemedText>
        <ThemedText style={styles.momentDate}>{date}</ThemedText>
      </View>
      {!!distinctBody && <ThemedText weight="medium" style={styles.journalMomentText}>{distinctBody}</ThemedText>}
      {priorities.length > 0 && <View style={styles.focusPriorities}>
        <ThemedText weight="medium" style={styles.focusPrioritiesTitle}>
          {priorities.length === 1 ? 'TOP PRIORITY' : `TOP ${priorities.length} PRIORITIES`}
        </ThemedText>
        {priorities.map((priority, index) => <View key={`${item.id}-priority-${index}`} style={styles.focusPriorityRow}>
          <Ionicons name={priority.completed ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={priority.completed ? Colors.sage : Colors.textGray}/>
          <ThemedText style={[styles.focusPriorityText, priority.completed && styles.focusPriorityTextCompleted]}>{priority.text}</ThemedText>
        </View>)}
      </View>}
    </>);
  }

  if (item.presentation === 'looking_forward') {
    const towardDate = formatFollowingDate(item.selectedDate).toUpperCase();
    return shell(<>
      <View style={styles.lookingForwardHeader}>
        <Ionicons name="arrow-forward-circle-outline" size={18} color={Colors.sage}/>
        <ThemedText weight="semiBold" style={styles.sessionEyebrow}>LOOKING TOWARD {towardDate}</ThemedText>
      </View>
      <ThemedText weight="medium" style={styles.lookingForwardText} numberOfLines={4}>{item.text || item.title}</ThemedText>
      {!!item.detail && <View style={styles.lookingForwardHeldSection}>
        <ThemedText weight="semiBold" style={styles.rhythmTruthLabel}>HOW YOU HELD IT</ThemedText>
        <View style={styles.lookingForwardEmotionRow}>
          <FeelingIcon item={item}/>
          <ThemedText weight="semiBold" style={styles.lookingForwardEmotion}>{item.detail}</ThemedText>
        </View>
      </View>}
      <ThemedText style={styles.lookingForwardWritten}>Written {date}</ThemedText>
    </>, styles.lookingForwardReviewCard);
  }

  return shell(<>
    <View style={styles.momentMetaRow}><Ionicons name="sunny-outline" size={18} color={Colors.sage}/><ThemedText weight="semiBold" style={styles.sessionEyebrow}>MORNING CHECK-IN</ThemedText><ThemedText style={styles.momentDate}>{date}</ThemedText></View>
    <ThemedText weight="medium" style={styles.journalMomentText} numberOfLines={4}>{item.text || item.title}</ThemedText>
  </>);
};

const ReviewScreen: React.FC = () => {
  const { preferences } = useAuth();
  const weekStart = preferences?.weekStart || 'monday';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const {bottom: floatingActionBottom, keyboardVisible} = useFloatingKeyboardButton(insets.bottom);
  const {height: screenHeight, width: screenWidth} = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const customFeelingInputRef = useRef<TextInput>(null);

  const revealCustomFeelingInput = useCallback(() => {
    const inputHandle = customFeelingInputRef.current
      ? findNodeHandle(customFeelingInputRef.current)
      : null;
    if (!inputHandle) {return;}
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      inputHandle,
      80,
      true,
    );
  }, []);

  const [stage, setStage] = useState<ReviewStage>(1);
  const [review, setReview] = useState<LocalReviewEntry | null>(null);
  const [reviewType, setReviewType] = useState<ReviewType>('weekly');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [memorableItems, setMemorableItems] = useState(review?.memorableItems ?? []);
  const [capture, setCapture] = useState<ReviewCapture | null>(null);
  const [weeklyRhythm, setWeeklyRhythm] = useState<WeeklyRhythm | null>(null);
  const [weeklyCheckInFeelings, setWeeklyCheckInFeelings] = useState<WeeklyCheckInFeeling[]>([]);
  const [showCustomFeelingInput, setShowCustomFeelingInput] = useState(false);
  const [showAllWeeklyFeelings, setShowAllWeeklyFeelings] = useState(false);

  const stages = useMemo(() => getReviewStages(reviewType), [reviewType]);
  const stageCount = stages.length;
  const isFeelingsStage = stages[stage - 1]?.kind === 'feelings';
  const isCapturedStage = stages[stage - 1]?.kind === 'captured';
  const hasSavedProgress = review?.status === 'draft' && (
    memorableItems.length > 0 ||
    Object.values(answers).some(answer => answer.trim().length > 0)
  );

  const typeFromRoute = route.params?.type as ReviewType | undefined;
  const startFromRoute = route.params?.periodStart as string | undefined;
  const endFromRoute = route.params?.periodEnd as string | undefined;

  const loadReview = useCallback(async () => {
    const anchor = toLocalDateString(new Date());
    const settings = await getReviewSettings(weekStart);
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

    const [captured, rhythm, checkInFeelings] = await Promise.all([
      getReviewCapture(start, end, type),
      type === 'weekly' ? getWeeklyRhythm(start, end, end) : Promise.resolve(null),
      type === 'weekly' ? getWeeklyCheckInFeelings(start, end) : Promise.resolve([]),
    ]);

    setReview(existing);
    setReviewType(type);
    setPeriodStart(existing.periodStart);
    setPeriodEnd(existing.periodEnd);
    setAnswers(existing.answers);
    setShowCustomFeelingInput(Boolean(existing.answers.week_feeling_other?.trim()));
    setMemorableItems(existing.memorableItems);
    setCapture(captured);
    setWeeklyRhythm(rhythm);
    setWeeklyCheckInFeelings(checkInFeelings);
  }, [typeFromRoute, startFromRoute, endFromRoute, weekStart]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  useEffect(() => {
    if (!keyboardVisible || !showCustomFeelingInput) {return;}
    const frame = requestAnimationFrame(() => {
      revealCustomFeelingInput();
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboardVisible, revealCustomFeelingInput, showCustomFeelingInput]);

  const saveReview = useCallback(
    async (patch: Partial<Pick<LocalReviewEntry, 'answers' | 'memorableItems' | 'prayerSnapshot' | 'status' | 'completedAt'>>) => {
      if (!review) {return;}
      const updated = {
        ...review,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await updateLocalReview(updated);
      setReview(updated);
    },
    [review],
  );

  useEffect(() => {
    if (stage === stageCount && review && review.status !== 'completed') {
      const prayerSnapshot: ReviewPrayerSnapshotItem[] = (capture?.items || [])
        .filter(item => item.kind === 'prayer' && item.prayerEventType && item.prayerId)
        .map(item => ({ id: item.id, prayerId: item.prayerId!, needId: item.needId, requestId: item.requestId, eventType: item.prayerEventType!, eventDate: item.selectedDate, title: item.title, subtitle: item.subtitle || 'Prayer', text: item.text }));
      saveReview({ status: 'completed', completedAt: new Date().toISOString(), prayerSnapshot });
    }
  }, [stage, stageCount, review, capture, saveReview]);

  const goTo = useCallback(
    (next: ReviewStage) => {
      if (next < 1 || next > stageCount) {return;}
      triggerLightHaptic();
      Keyboard.dismiss();
      setStage(next);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [stageCount],
  );

  const stageRef = useRef(stage);
  const stageCountRef = useRef(stageCount);
  const capturedStageRef = useRef(isCapturedStage);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    stageCountRef.current = stageCount;
  }, [stageCount]);

  useEffect(() => {
    capturedStageRef.current = isCapturedStage;
  }, [isCapturedStage]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !capturedStageRef.current && Math.abs(g.dx) > 12 && Math.abs(g.dy) < Math.abs(g.dx),
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
    if (!periodStart || !periodEnd) {return '';}
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const month = start.toLocaleString('default', { month: 'short' }).toUpperCase();
    return `${month} ${start.getDate()}–${end.getDate()}`;
  }, [periodStart, periodEnd]);

  const weeklyPeriodLabel = useMemo(() => {
    if (!periodStart || !periodEnd) {return '';}
    const parseLocal = (value:string) => {const [year,month,day]=value.split('-').map(Number);return new Date(year,month-1,day,12);};
    const start=parseLocal(periodStart); const end=parseLocal(periodEnd);
    const startText=start.toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const endText=end.toLocaleDateString(undefined,start.getMonth()===end.getMonth()?{day:'numeric'}:{month:'short',day:'numeric'});
    return `${startText} – ${endText}`;
  }, [periodStart,periodEnd]);

  const weeklyCoverSummary = useMemo(
    () => capture ? getReviewCoverSummary(
      capture,
      weeklyRhythm ? {morning: weeklyRhythm.morning, evening: weeklyRhythm.evening} : undefined,
    ) : [],
    [capture, weeklyRhythm],
  );

  const onAnswerChange = (beat: string, text: string) => {
    const next = { ...answers, [beat]: text };
    setAnswers(next);
    // Autosave draft
    saveReview({ answers: next });
  };

  const toggleMemorable = (item: { kind: ReviewMemorableItem['kind']; id: string; selectedDate: string }) => {
    const exists = memorableItems.find(
      m => m.id === item.id && m.selectedDate === item.selectedDate,
    );
    const next = exists
      ? memorableItems.filter(
          m => !(m.id === item.id && m.selectedDate === item.selectedDate),
        )
      : [...memorableItems, { kind: item.kind, id: item.id, selectedDate: item.selectedDate }];
    setMemorableItems(next);
    saveReview({ memorableItems: next });
  };

  const toggleMemorableGroup = (items: Array<{kind: ReviewMemorableItem['kind']; id: string; selectedDate: string}>) => {
    const itemKeys = new Set(items.map(item => `${item.id}:${item.selectedDate}`));
    const allSelected = items.every(item => memorableItems.some(
      memorable => memorable.id === item.id && memorable.selectedDate === item.selectedDate,
    ));
    const retained = memorableItems.filter(item => !itemKeys.has(`${item.id}:${item.selectedDate}`));
    const next = allSelected
      ? retained
      : [...retained, ...items.map(item => ({kind: item.kind, id: item.id, selectedDate: item.selectedDate}))];
    setMemorableItems(next);
    saveReview({memorableItems: next});
  };

  const renderCurrentStage = (): React.ReactNode => {
    const current = stages[stage - 1];
    if (!current) {return null;}

    if (current.kind === 'cover') {
      const eyebrow = current.eyebrow ?? `${reviewType.replace('_', ' ').toUpperCase()} REVIEW`;
      if(reviewType==='weekly'){
        const denseSummary = weeklyCoverSummary.length > 12;
        return <View style={[styles.stage,styles.weeklyCoverStage,{minHeight:Math.max(0,screenHeight-topInset-insets.bottom-64)}]}>
          <View style={styles.weeklyCoverHero}>
            <BotanicalMark />
            <ThemedText weight="semiBold" style={styles.weeklyCoverEyebrow}>WEEKLY REVIEW</ThemedText>
            <ThemedText weight="bold" style={styles.weeklyCoverTitle}>Your week</ThemedText>
            <ThemedText weight="bold" style={styles.weeklyCoverPeriod}>{weeklyPeriodLabel}</ThemedText>
            <ThemedText style={styles.weeklyCoverSubtitle}>Pause. Look back. Look ahead.{`\n`}See what matters.</ThemedText>
          </View>

          <View style={styles.weeklyShowedUpCard}>
            <View style={styles.weeklyShowedUpHeader}>
              <View style={styles.weeklyShowedUpIcon}><Ionicons name="leaf-outline" size={18} color={Colors.text}/></View>
              <View style={styles.weeklyShowedUpCopy}>
                <ThemedText weight="semiBold" style={styles.weeklyShowedUpLabel}>You showed up</ThemedText>
                <ThemedText weight="semiBold" style={styles.weeklyShowedUpTotal}>{weeklyRhythm?.activeDays??0} days this week</ThemedText>
              </View>
            </View>
            <View style={styles.weeklyDayChart}>
              {(weeklyRhythm?.days??[]).map(day=>{
                const [year,month,date]=day.date.split('-').map(Number);
                const label=new Date(year,month-1,date,12).toLocaleDateString(undefined,{weekday:'narrow'});
                const height=day.active?Math.min(26,7+day.activity*3):6;
                return <View key={day.date} style={styles.weeklyDayColumn}>
                  <View style={[styles.weeklyDayTrack,{height:26}]}><View style={[styles.weeklyDayBar,{height},day.active?styles.weeklyDayBarActive:styles.weeklyDayBarQuiet]}/></View>
                  <ThemedText weight="semiBold" style={styles.weeklyDayLabel}>{label}</ThemedText>
                </View>;
              })}
            </View>
            {weeklyCoverSummary.length > 0 && <View style={styles.weeklySummarySection}>
              <ThemedText weight="semiBold" style={styles.weeklySummaryEyebrow}>YOUR WEEK IN NUMBERS</ThemedText>
              <View style={styles.weeklySummaryMetrics}>
                {weeklyCoverSummary.map(item=><View key={item.key} style={styles.weeklySummaryMetricSlot}>
                  <View style={[styles.weeklySummaryPill,denseSummary&&styles.weeklySummaryPillDense]}>
                    <ThemedText weight="bold" style={[styles.weeklySummaryCount,denseSummary&&styles.weeklySummaryCountDense]}>{item.count}</ThemedText>
                    <ThemedText style={[styles.weeklySummaryLabel,denseSummary&&styles.weeklySummaryLabelDense]}>{item.label}</ThemedText>
                  </View>
                </View>)}
              </View>
            </View>}
          </View>

          <TouchableOpacity style={[styles.primaryButton,styles.weeklyBeginButton]} onPress={()=>goTo(2)} activeOpacity={0.8}>
            <ThemedText weight="bold" style={styles.weeklyBeginText}>{hasSavedProgress?'Continue':'Begin'}</ThemedText>
          </TouchableOpacity>
        </View>;
      }
      return (
        <View style={styles.stage}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>
            {eyebrow}
          </ThemedText>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {current.subtitle}
          </ThemedText>

          {capture && (
            <View style={styles.captureStats}>
              <ThemedText weight="bold" style={styles.captureStatTotal}>
                {capture.items.length} moments from your {reviewType.replace('_', ' ')}
              </ThemedText>
              {Object.entries(capture.summary)
                .filter(([, count]) => count > 0)
                .map(([kind, count]) => (
                  <View key={kind} style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>
                      {CATEGORY_LABELS[kind as ReviewCaptureKind]}
                    </ThemedText>
                    <ThemedText weight="semiBold" style={styles.captureStatValue}>
                      {count}
                    </ThemedText>
                  </View>
                ))}
              {capture.prayerStats.total > 0 ? (
                <>
                  <View style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>Prayers answered</ThemedText>
                    <ThemedText weight="semiBold" style={styles.captureStatValue}>
                      {capture.prayerStats.answered}
                    </ThemedText>
                  </View>
                  <View style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>Still praying</ThemedText>
                    <ThemedText weight="semiBold" style={styles.captureStatValue}>
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
              {reviewType === 'year_end' ? 'Review my year' : 'Review my ' + reviewType.replace('_', ' ')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (current.kind === 'captured') {
      if (reviewType === 'weekly') {
        const moments = [...(capture?.items ?? [])]
          .sort((a, b) => a.selectedDate.localeCompare(b.selectedDate));
        const heartJournalGroup = {
          key: 'heart-journal',
          presentation: 'heart_journal' as ReviewCapturePresentation,
          title: 'Heart Journal',
          items: moments.filter(item => HEART_JOURNAL_PRESENTATIONS.has(item.presentation)),
        };
        const presentationGroups = CAPTURE_PRESENTATION_GROUPS.map(group => ({
            ...group,
            key: group.presentation,
            items: moments.filter(item => item.presentation === group.presentation),
          }));
        const momentGroups = [
          ...presentationGroups.slice(0, 8),
          heartJournalGroup,
          ...presentationGroups.slice(8),
        ].filter(group => group.items.length > 0);
        const carouselCardWidth = Math.min(310, Math.max(240, screenWidth - 76));
        return (
          <View style={[styles.stage, styles.weeklyCapturedStage]}>
            <View style={styles.weeklyCapturedHeading}>
              <View style={styles.feelingsLabelRow}>
                <Ionicons name="leaf-outline" size={15} color={Colors.sage}/>
                <ThemedText weight="semiBold" style={styles.feelingsLabel}>LOOKING BACK</ThemedText>
              </View>
              <ThemedText weight="bold" style={styles.weeklyCapturedTitle}>Moments from this week</ThemedText>
              <ThemedText style={styles.weeklyCapturedSubtitle}>
                Here are the moments you captured.{`\n`}Tap any that stood out to you.
              </ThemedText>
            </View>

            {momentGroups.length > 0 ? momentGroups.map(group => (
              <View key={group.key} style={styles.weeklyMomentGroup}>
                <View style={styles.weeklyMomentGroupHeader}>
                  <View style={styles.weeklyMomentGroupTitleRow}>
                    <CaptureGroupIcon presentation={group.presentation}/>
                    <ThemedText weight="semiBold" style={styles.weeklyMomentGroupTitle}>{group.title}</ThemedText>
                  </View>
                  {!!captureGroupCountLabel(group.presentation, group.items) && <ThemedText style={styles.weeklyMomentGroupCount}>
                    {captureGroupCountLabel(group.presentation, group.items)}
                  </ThemedText>}
                </View>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  style={styles.weeklyMomentCarouselViewport}
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={carouselCardWidth + 12}
                  disableIntervalMomentum
                  contentContainerStyle={styles.weeklyMomentCarousel}>
                  {(group.presentation === 'todo'
                    ? [...new Set(group.items.map(todo => todo.selectedDate))].map(selectedDate => {
                      const relatedItems = group.items.filter(todo => todo.selectedDate === selectedDate);
                      return {item: relatedItems[0], relatedItems, key: `todos-${selectedDate}`};
                    })
                    : group.items.map(item => ({item, relatedItems: [item], key: `${item.kind}-${item.id}-${item.selectedDate}`}))
                  ).map(({item, relatedItems, key}) => {
                    const isSelected = relatedItems.every(related => memorableItems.some(
                      memorable => memorable.id === related.id && memorable.selectedDate === related.selectedDate,
                    ));
                    return (
                      <WeeklyMomentCard
                        key={key}
                        item={item}
                        selected={isSelected}
                        width={carouselCardWidth}
                        relatedItems={relatedItems}
                        onPress={() => relatedItems.length > 1 ? toggleMemorableGroup(relatedItems) : toggleMemorable(item)}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            )) : (
              <View style={styles.weeklyMomentsCard}>
                <View style={styles.weeklyMomentsEmpty}>
                  <ThemedText style={styles.weeklyMomentsEmptyText}>No journal moments were captured this week.</ThemedText>
                </View>
              </View>
            )}

          </View>
        );
      }
      return (
        <View style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {capture
              ? `${capture.items.length} moments from your ${reviewType.replace('_', ' ')}.`
              : 'Loading…'}
          </ThemedText>
          {capture?.items.map(item => {
            const isSel = memorableItems.some(
              m => m.id === item.id && m.selectedDate === item.selectedDate,
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
                  style={[
                    styles.rememberButton,
                    isSel && styles.rememberButtonActive,
                  ]}
                  onPress={() => toggleMemorable(item)}
                  activeOpacity={0.8}>
                  <Ionicons
                    name={isSel ? 'heart' : 'heart-outline'}
                    size={14}
                    color={isSel ? Colors.hopeWhite : Colors.sage}
                  />
                  <ThemedText
                    weight="semiBold"
                    style={[
                      styles.rememberButtonText,
                      isSel && styles.rememberButtonTextActive,
                    ]}>
                    {isSel ? 'Remembered' : 'Remember this'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      );
    }

    if(current.kind==='feelings'){
      const selected=(answers[current.answerKey!]||'').split('|').filter(item=>Boolean(item)&&item.toLocaleLowerCase()!=='other');
      const customFeeling=answers.week_feeling_other??'';
      const hasCustomFeeling=Boolean(customFeeling.trim());
      const hasCustomChoice=showCustomFeelingInput||hasCustomFeeling;
      const selectionCount=selected.length+(hasCustomChoice?1:0);
      const uniqueWords=(words:readonly string[])=>words.filter((item,index,all)=>item.toLocaleLowerCase()!=='other'&&all.findIndex(other=>other.toLocaleLowerCase()===item.toLocaleLowerCase())===index);
      const suggestedNames=uniqueWords([...WEEKLY_SPIRITUAL_REFLECTION_WORDS,...selected]);
      const visibleNames=showAllWeeklyFeelings
        ? suggestedNames
        : uniqueWords([...suggestedNames.slice(0,10),...selected]);
      const optionNames=[...visibleNames,'Other'];
      const toggleFeeling=(feeling:string)=>{
        const isSelected=selected.includes(feeling);
        if(!isSelected&&selectionCount>=3)return;
        triggerLightHaptic();
        const next=isSelected?selected.filter(item=>item!==feeling):[...selected,feeling];
        onAnswerChange(current.answerKey!,next.join('|'));
      };
      const toggleCustomFeeling=()=>{
        if(hasCustomChoice){
          triggerLightHaptic();
          Keyboard.dismiss();
          setShowCustomFeelingInput(false);
          onAnswerChange('week_feeling_other','');
          return;
        }
        if(selectionCount>=3)return;
        triggerLightHaptic();
        setShowCustomFeelingInput(true);
        requestAnimationFrame(()=>{
          customFeelingInputRef.current?.focus();
        });
      };
      return <View style={[styles.stage,styles.feelingsStage,{minHeight:Math.max(580,screenHeight-topInset-insets.bottom-64)}]}>
        <View style={styles.feelingsHeading}>
          <View style={styles.feelingsLabelRow}>
            <Ionicons name="leaf-outline" size={15} color={Colors.sage}/>
            <ThemedText weight="semiBold" style={styles.feelingsLabel}>LOOKING BACK</ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.feelingsQuestion}>How did this week feel?</ThemedText>
        </View>
        {weeklyCheckInFeelings.length>0?<View style={styles.checkInSummary}>
          <ThemedText weight="semiBold" style={styles.checkInSummaryLabel}>YOUR MORNING CHECK-INS</ThemedText>
          <View style={styles.checkInSummaryPills}>
            {weeklyCheckInFeelings.map(item=><View key={item.name.toLocaleLowerCase()} style={styles.checkInSummaryPill}>
              <ThemedText weight="medium" style={styles.checkInSummaryPillText}>{item.name}{item.count>1?` ×${item.count}`:''}</ThemedText>
            </View>)}
          </View>
        </View>:null}
        <View style={styles.weeklyChoicePrompt}>
          <ThemedText weight="semiBold" style={styles.weeklyChoicePromptLabel}>LOOKING AT THE WHOLE WEEK</ThemedText>
          <ThemedText style={styles.feelingsSubtitle}>Choose or write up to 3 words.</ThemedText>
        </View>
        <View style={styles.feelingsGrid}>
          {optionNames.map(feeling=>{
            const isOther=feeling==='Other';
            const isSelected=selected.includes(feeling);
            const isOtherActive=isOther&&hasCustomChoice;
            const atLimit=isOther?!isOtherActive&&selectionCount>=3:!isSelected&&selectionCount>=3;
            const active=isOther?isOtherActive:isSelected;
            return <TouchableOpacity key={feeling} accessibilityRole="button" accessibilityState={{selected:active,disabled:atLimit}} disabled={atLimit} activeOpacity={0.8} style={[styles.feelingPill,active&&styles.feelingPillSelected,atLimit&&styles.feelingPillDisabled]} onPress={()=>isOther?toggleCustomFeeling():toggleFeeling(feeling)}>
              <ThemedText weight="semiBold" style={[styles.feelingPillText,active&&styles.feelingPillTextSelected]}>{feeling}</ThemedText>
            </TouchableOpacity>;
          })}
        </View>
        {suggestedNames.length>10?<TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{expanded:showAllWeeklyFeelings}}
          activeOpacity={0.7}
          onPress={()=>{triggerLightHaptic();setShowAllWeeklyFeelings(value=>!value);}}
          style={styles.feelingsShowMore}>
          <ThemedText weight="semiBold" style={styles.feelingsShowMoreText}>{showAllWeeklyFeelings?'Show less':'Show more'}</ThemedText>
        </TouchableOpacity>:null}
        {showCustomFeelingInput||hasCustomFeeling?<TextInput
          ref={customFeelingInputRef}
          style={styles.customFeelingInput}
          value={customFeeling}
          onChangeText={text=>onAnswerChange('week_feeling_other',text)}
          placeholder="Write it in your own words"
          placeholderTextColor={Colors.textGray}
          maxLength={160}
          multiline
          editable={selected.length<3||hasCustomFeeling}
          textAlignVertical="top"
          onFocus={()=>requestAnimationFrame(revealCustomFeelingInput)}
          accessibilityLabel="Write it in your own words"
        />:null}
      </View>;
    }

    if (current.kind === 'remembered') {
      return (
        <View style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {memorableItems.length > 0
              ? `You chose ${memorableItems.length} thing${
                  memorableItems.length === 1 ? '' : 's'
                } to carry with this review.`
              : 'Tap the heart on anything you want to carry with this review.'}
          </ThemedText>
          {memorableItems
            .map(m => capture?.items.find(i => i.id === m.id && i.selectedDate === m.selectedDate))
            .filter(Boolean)
            .map(item => (
              <View key={`${item!.kind}-${item!.id}`} style={styles.captureItem}>
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
        </View>
      );
    }

    if (current.kind === 'question') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.question}>
            {current.question}
          </ThemedText>
          <TextInput
            style={styles.input}
            multiline
            value={answers[current.answerKey!] ?? ''}
            onChangeText={t => onAnswerChange(current.answerKey!, t)}
            placeholder={current.placeholder ?? 'Start writing...'}
            placeholderTextColor={Colors.textGray}
            textAlignVertical="top"
          />
        </View>
      );
    }

    if (current.kind === 'priorities') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.question}>
            {current.question}
          </ThemedText>
          {current.subtitle ? (
            <ThemedText style={styles.subtitle}>{current.subtitle}</ThemedText>
          ) : null}
          {current.answerKeys!.map((key, index) => (
            <TextInput
              key={key}
              style={[styles.input, styles.shortInput]}
              value={answers[key] ?? ''}
              onChangeText={t => onAnswerChange(key, t)}
              placeholder={`${current.label} ${index + 1}`}
              placeholderTextColor={Colors.textGray}
            />
          ))}
        </View>
      );
    }

    if (current.kind === 'transition') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {current.subtitle}
          </ThemedText>
        </View>
      );
    }

    if (current.kind === 'ready') {
      const isMonthly = reviewType === 'monthly';
      const label = current.label ?? `${reviewType.replace('_', ' ').toUpperCase()} IS READY`;

      const priorityKeys =
        reviewType === 'quarterly'
          ? ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3']
          : isMonthly
          ? ['next_month_priority_1', 'next_month_priority_2', 'next_month_priority_3']
          : ['priority_1', 'priority_2', 'priority_3'];
      const priorityCount = priorityKeys.map(k => answers[k]).filter(Boolean).length;

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
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              YOUR {label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>

          <View style={styles.summaryCard}>
            {summaryRows}
          </View>

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
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false} />

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

      {stage > 1 && (
        <View
          style={[
            styles.actionProgressBar,
            { top: topInset + 25 },
          ]}
          pointerEvents="none">
          <View
            style={[
              styles.actionProgressFill,
              { width: `${((stage - 1) / Math.max(1, stageCount - 1)) * 100}%` },
            ]}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.backButton, { top: topInset + 8 }]}
        onPress={() => stage > 1 ? goTo(stage - 1) : navigation.goBack()}
        activeOpacity={0.7}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
        accessibilityRole="button"
        accessibilityLabel={stage > 1 ? 'Previous review step' : 'Back'}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.closeButton, { top: topInset + 8 }]}
        onPress={() => {
          triggerLightHaptic();
          Keyboard.dismiss();
          navigation.goBack();
        }}
        activeOpacity={0.7}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
        accessibilityRole="button"
        accessibilityLabel="Close review">
        <Ionicons name="close" size={17} color={Colors.sage} />
      </TouchableOpacity>

      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          scrollEnabled={!(stage === 1 && reviewType === 'weekly')}
          bounces={!(stage === 1 && reviewType === 'weekly')}
          contentContainerStyle={{
            paddingTop: topInset + 36,
            paddingBottom: keyboardVisible
              ? 320
              : insets.bottom + (isFeelingsStage || isCapturedStage || (stage >= 4 && stage < stageCount) ? 88 : 28),
          }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {renderCurrentStage()}
        </ScrollView>
      </View>

      {isFeelingsStage && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.feelingsFooter, {bottom: floatingActionBottom}]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
            onPress={()=>goTo(stage+1)}
            activeOpacity={0.7}
            style={styles.feelingsSkipButton}>
            <ThemedText weight="semiBold" style={styles.feelingsSkip}>Skip</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.feelingsNext}
            onPress={()=>goTo(stage+1)}
            activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite}/>
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
            onPress={()=>goTo(stage+1)}
            activeOpacity={0.7}
            style={styles.feelingsNext}>
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite}/>
          </TouchableOpacity>
        </Animated.View>
      )}

      {stage >= 4 && stage < stageCount && (
        <AnimatedTouchableOpacity
          style={[styles.fab, { bottom: floatingActionBottom }]}
          activeOpacity={0.7}
          onPress={() => goTo(stage + 1)}>
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </AnimatedTouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    right: 18,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
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
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  weeklyCoverHero: {
    alignItems: 'center',
  },
  botanicalMark: {
    width: 56,
    height: 58,
    marginBottom: 2,
  },
  botanicalStem: {
    position: 'absolute',
    width: 1.5,
    height: 42,
    left: 27,
    top: 14,
    backgroundColor: Colors.text,
    borderRadius: 2,
    transform: [{rotate: '14deg'}],
  },
  botanicalLeafTop: {
    position: 'absolute',
    left: 24,
    top: 0,
    transform: [{rotate: '-24deg'}],
  },
  botanicalLeafLeft: {
    position: 'absolute',
    left: 10,
    top: 25,
    transform: [{rotate: '-72deg'}],
  },
  botanicalLeafRight: {
    position: 'absolute',
    right: 8,
    top: 31,
    transform: [{rotate: '18deg'}],
  },
  weeklyCoverEyebrow: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.8,
  },
  weeklyCoverTitle: {
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 34,
    lineHeight: 40,
    marginTop: 7,
  },
  weeklyCoverPeriod: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 0,
  },
  weeklyCoverSubtitle: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
  },
  weeklyShowedUpCard: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    marginTop: 12,
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  weeklyShowedUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  weeklyShowedUpIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyShowedUpCopy: {
    minWidth: 138,
  },
  weeklyShowedUpLabel: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  weeklyShowedUpTotal: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  weeklyDayChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  weeklyDayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyDayTrack: {
    width: 17,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  weeklyDayBar: {
    width: 11,
    borderRadius: 6,
    minHeight: 6,
  },
  weeklyDayBarActive: {
    backgroundColor: Colors.sage,
  },
  weeklyDayBarQuiet: {
    backgroundColor: Colors.anchorBlueLight,
  },
  weeklyDayLabel: {
    color: Colors.text,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 3,
  },
  weeklySummarySection: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 11,
    paddingTop: 9,
  },
  weeklySummaryEyebrow: {
    color: Colors.textGray,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 1.3,
    textAlign: 'center',
  },
  weeklySummaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginHorizontal: -3,
  },
  weeklySummaryMetricSlot: {
    width: '25%',
    padding: 3,
  },
  weeklySummaryPill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
    paddingHorizontal: 4,
    paddingVertical: 5,
    minHeight: 48,
  },
  weeklySummaryPillDense: {
    minHeight: 42,
    paddingVertical: 3,
  },
  weeklySummaryCount: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 20,
  },
  weeklySummaryCountDense: {
    fontSize: 15,
    lineHeight: 18,
  },
  weeklySummaryLabel: {
    color: Colors.textGray,
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
  },
  weeklySummaryLabelDense: {
    fontSize: 8,
    lineHeight: 10,
  },
  weeklyBeginButton: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 'auto',
    minHeight: 50,
    height: 50,
    borderRadius: 25,
  },
  weeklyBeginText: {
    color: Colors.hopeWhite,
    fontSize: 17,
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
    borderWidth: 0.5,
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 30,
  },
  feelingsSkipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  feelingsSkip: {
    color: Colors.textGray,
    fontSize: 15,
  },
  feelingsNext: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  weeklyCapturedStage: {
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  weeklyCapturedHeading: {
    alignItems: 'center',
    marginBottom: 22,
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
  weeklyMomentGroup: {
    marginBottom: 24,
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
  weeklyMomentCarousel: {
    paddingHorizontal: 22,
    gap: 12,
  },
  weeklyMomentCarouselViewport: {
    marginHorizontal: -22,
  },
  momentTypeCard: {
    minHeight: 196,
    padding: 20,
    paddingTop: 22,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  momentTypeCardSelected: {
    borderColor: Colors.sage,
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
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
  },
  prayerReviewCard: {
    backgroundColor: Colors.cardBackground,
  },
  prayerCardEyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  prayerCardTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 7,
  },
  prayerCardBody: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  prayerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.actionBackground,
  },
  prayerStatusText: {color: Colors.sage, fontSize: 11, lineHeight: 15},
  gratitudeCardEyebrow: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.3},
  gratitudeCardSubtitle: {color: Colors.textGray, fontSize: 12, lineHeight: 17, marginBottom: 14},
  gratitudeLines: {gap: 10},
  gratitudeLine: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  gratitudeNumber: {width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.actionBackground},
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
  scriptureCenteredEyebrow: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.3, marginBottom: 12},
  scriptureCenteredTitle: {color: Colors.text, fontSize: 20, lineHeight: 26, textAlign: 'center', paddingHorizontal: 24},
  scriptureTranslation: {color: Colors.textGray, fontSize: 11, lineHeight: 16, marginTop: 4},
  scriptureQuote: {color: Colors.text, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 14, paddingHorizontal: 10},
  momentDivider: {height: 1, width: '100%', backgroundColor: Colors.borderLight, marginVertical: 14},
  scriptureFooter: {flexDirection: 'row', alignItems: 'center', gap: 6},
  scriptureFooterText: {color: Colors.textGray, fontSize: 11, lineHeight: 16},
  centeredMomentDate: {color: Colors.textGray, fontSize: 10, lineHeight: 14, marginTop: 7},
  sessionEyebrow: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.2},
  sessionTitle: {color: Colors.text, fontSize: 18, lineHeight: 24, marginBottom: 5, paddingRight: 28},
  sessionDetail: {color: Colors.textGray, fontSize: 12, lineHeight: 18},
  sessionQuoteBox: {borderLeftWidth: 2, borderLeftColor: 'rgba(82, 106, 91, 0.3)', paddingLeft: 12, marginTop: 13},
  sessionQuote: {color: Colors.text, fontSize: 13, lineHeight: 20},
  sessionFooter: {flexDirection: 'row', alignItems: 'center', gap: 6},
  sessionFooterText: {color: Colors.textGray, fontSize: 11, lineHeight: 16},
  winHeader: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 36, marginBottom: 13},
  winEyebrow: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.2},
  winType: {color: Colors.text, fontSize: 18, lineHeight: 24, textAlign: 'center'},
  winQuietLabel: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, marginBottom: 7},
  winText: {color: Colors.text, fontSize: 14, lineHeight: 22},
  morningCheckInFeelingRow: {flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14, paddingRight: 32},
  morningCheckInFeeling: {flex: 1, color: Colors.text, fontSize: 20, lineHeight: 27},
  morningCheckInVerse: {color: Colors.text, fontFamily: 'Georgia', fontSize: 14, lineHeight: 22, fontStyle: 'italic'},
  morningCheckInReference: {color: Colors.sage, fontSize: 11, lineHeight: 16, marginTop: 5},
  morningCheckInUnderneath: {color: Colors.textGray, fontSize: 14, lineHeight: 22, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight},
  rhythmReviewCard: {backgroundColor: 'rgba(232, 237, 232, 0.72)'},
  rhythmEyebrow: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.2},
  rhythmTitle: {color: Colors.text, fontSize: 18, lineHeight: 24, marginBottom: 9},
  rhythmTruthLabel: {color: Colors.sage, fontSize: 9, lineHeight: 14, letterSpacing: 1.3, marginBottom: 5},
  rhythmBody: {color: Colors.textGray, fontSize: 14, lineHeight: 22, paddingBottom: 20},
  proverbWisdomSection: {paddingBottom: 20},
  proverbWisdomItem: {marginTop: 9},
  proverbWisdomLabel: {color: Colors.text, fontSize: 15, lineHeight: 21},
  proverbResponseSection: {marginTop: 13, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: Colors.borderLight},
  proverbResponseText: {color: Colors.textGray, fontSize: 14, lineHeight: 21},
  rhythmReadingProgress: {position: 'absolute', right: 16, bottom: 14, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(82, 106, 91, 0.1)', borderWidth: 1, borderColor: 'rgba(82, 106, 91, 0.22)'},
  todoSummary: {color: Colors.textGray, fontSize: 12, lineHeight: 17, marginBottom: 13},
  todoReviewList: {gap: 9},
  todoReviewRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  todoReviewText: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 20},
  todoReviewTextCompleted: {color: Colors.textGray, textDecorationLine: 'line-through', opacity: 0.72},
  journalMomentText: {color: Colors.text, fontSize: 17, lineHeight: 25, paddingTop: 10},
  lookingForwardReviewCard: {backgroundColor: 'rgba(232, 237, 232, 0.72)'},
  lookingForwardHeader: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 32},
  lookingForwardText: {color: Colors.text, fontSize: 16, lineHeight: 24, marginTop: 14},
  lookingForwardHeldSection: {marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderLight},
  lookingForwardEmotionRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  lookingForwardEmotion: {color: Colors.text, fontSize: 16, lineHeight: 22},
  lookingForwardWritten: {color: Colors.textGray, fontSize: 10, lineHeight: 14, marginTop: 14, textAlign: 'right'},
  focusPriorities: {gap: 9, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderLight},
  focusPrioritiesTitle: {color: Colors.sage, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, marginBottom: 2},
  focusPriorityRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  focusPriorityText: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 20},
  focusPriorityTextCompleted: {color: Colors.textGray, textDecorationLine: 'line-through', opacity: 0.72},
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
  question: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center' as const,
    color: Colors.text,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  rememberButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  rememberButtonText: {
    fontSize: 12,
    color: Colors.sage,
  },
  rememberButtonTextActive: {
    color: Colors.hopeWhite,
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
