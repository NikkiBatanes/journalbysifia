import React, {useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Pencil} from 'lucide-react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import HeaderBackButton from '../common/HeaderBackButton';
import HeaderCloseButton from '../common/HeaderCloseButton';
import ThemedText from '../common/ThemedText';
import {WeeklyReviewPrayerSummary} from './WeeklyReviewPrayerSummary';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import type {LocalReviewEntry} from '../../storage/reviewStorage';
import type {
  ReviewCapture,
  ReviewCaptureItem,
} from '../../services/reviewCaptureService';
import {rememberedReferenceMatchesMoment} from '../../services/reviewMemoryService';
import {fromLocalDateString} from '../../utils/date';
import {triggerLightHaptic} from '../../utils/haptics';

export type MonthlyReviewSummaryTab = 'back' | 'ahead';

interface Props {
  review: LocalReviewEntry;
  capture: ReviewCapture | null;
  captureLoading?: boolean;
  activeTab?: MonthlyReviewSummaryTab;
  onTabChange?: (tab: MonthlyReviewSummaryTab) => void;
  onEdit?: (stageKey: string) => void;
  onFinish?: () => void;
  saving?: boolean;
  saveError?: boolean;
  bottomInset?: number;
  topInset?: number;
  onBack?: () => void;
  onClose?: () => void;
  backAccessibilityLabel?: string;
}

const palette = {
  paper: '#F6F5EF',
  ink: '#293D35',
  muted: '#748078',
  green: '#526F5D',
  line: '#E6E9E1',
  card: '#FDFDF9',
  sage: '#E8EEE3',
  sand: '#F3EDE2',
  peach: '#F7E8DF',
};

const Landscape = ({ahead}: {ahead: boolean}) => (
  <View pointerEvents="none" accessible={false} style={styles.landscape}>
    <Svg
      width="100%"
      height="150"
      viewBox="0 0 390 150"
      preserveAspectRatio="xMaxYMin meet"
      style={StyleSheet.absoluteFill}>
      <Circle
        cx={ahead ? 275 : 330}
        cy={ahead ? 48 : 30}
        r={22}
        fill={ahead ? '#EFC896' : '#F0D8C3'}
      />
    </Svg>
    <Svg
      width="100%"
      height="150"
      viewBox="0 0 390 150"
      preserveAspectRatio="none">
      <Path
        d="M75 150 C130 135 149 92 184 103 S220 121 254 73 S298 30 335 73 S370 77 410 42 V150Z"
        fill="#DEE5D9"
      />
      <Path
        d="M5 150 C80 145 113 109 152 116 S206 144 251 108 S300 102 331 113 S375 83 410 97 V150Z"
        fill="#C8D6C8"
      />
      <Path
        d="M0 150 C91 134 133 154 187 139 S266 116 309 131 S367 121 410 118 V150Z"
        fill="#A9BEAE"
      />
      <Path
        d="M0 150 C118 146 160 164 232 151 S338 139 410 146 V160 H0Z"
        fill={palette.green}
      />
    </Svg>
  </View>
);

const Excerpt = ({text, light = false}: {text: string; light?: boolean}) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 260;
  return (
    <>
      <ThemedText style={[styles.body, light && styles.lightText]}>
        {isLong && !expanded ? `${text.slice(0, 260).trim()}…` : text}
      </ThemedText>
      {isLong && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{expanded}}
          style={styles.textAction}
          onPress={() => {
            triggerLightHaptic();
            setExpanded(value => !value);
          }}>
          <ThemedText
            weight="medium"
            style={[styles.link, light && styles.lightText]}>
            {expanded ? 'Read less' : 'Read more'}
          </ThemedText>
        </TouchableOpacity>
      )}
    </>
  );
};

const parseLocal = (value: string) => fromLocalDateString(value);

const formatReviewedMonth = (review: LocalReviewEntry) =>
  parseLocal(review.periodStart).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const formatNextMonth = (review: LocalReviewEntry) => {
  const end = parseLocal(review.periodEnd);
  return new Date(
    end.getFullYear(),
    end.getMonth() + 1,
    1,
    12,
  ).toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
};

const resolveRemembered = (
  review: LocalReviewEntry,
  capture: ReviewCapture | null,
): ReviewCaptureItem[] => {
  if (!capture) {
    return [];
  }
  const used = new Set<string>();
  return review.memorableItems.flatMap(reference => {
    const exact = capture.items.find(
      item =>
        item.id === reference.id &&
        item.selectedDate === reference.selectedDate,
    );
    const match =
      exact ??
      capture.items.find(item => {
        const key = `${item.id}:${item.selectedDate}`;
        return (
          !used.has(key) && rememberedReferenceMatchesMoment(reference, item)
        );
      });
    if (!match) {
      return [];
    }
    used.add(`${match.id}:${match.selectedDate}`);
    return [match];
  });
};

export const MonthlyReviewSummary = ({
  review,
  capture,
  captureLoading = false,
  activeTab,
  onTabChange,
  onEdit,
  onFinish,
  saving = false,
  saveError = false,
  bottomInset = 0,
  topInset = 0,
  onBack,
  onClose,
  backAccessibilityLabel = 'Go back',
}: Props) => {
  const [localTab, setLocalTab] = useState<MonthlyReviewSummaryTab>('back');
  const tab = activeTab ?? localTab;
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [heroHeight, setHeroHeight] = useState(216);
  const headerHeight = onBack ? topInset + 52 : 0;
  const compactTop = onBack ? topInset : 0;
  const collapseDistance = heroHeight + headerHeight - compactTop;
  const [tabsInHeader, setTabsInHeader] = useState(false);
  const tabsInHeaderRef = useRef(false);
  const scrollOffset = useRef(0);
  const answers = review.answers;
  const monthFeelings = [
    ...(answers.month_feelings ?? '')
      .split('|')
      .map(value => value.trim())
      .filter(Boolean),
    ...(answers.month_feeling_other?.trim()
      ? [answers.month_feeling_other.trim()]
      : []),
  ];
  const reviewedMonth = formatReviewedMonth(review);
  const nextMonth = formatNextMonth(review);
  const remembered = useMemo(
    () => resolveRemembered(review, capture),
    [capture, review],
  );
  const priorities = [
    'next_month_priority_1',
    'next_month_priority_2',
    'next_month_priority_3',
  ]
    .map(key => answers[key]?.trim())
    .filter(Boolean);
  const activeDates = useMemo(
    () => [...new Set((capture?.items ?? []).map(item => item.selectedDate))],
    [capture],
  );
  const weekActivity = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    activeDates.forEach(value => {
      const day = parseLocal(value).getDate();
      counts[Math.min(4, Math.floor((day - 1) / 7))] += 1;
    });
    return counts;
  }, [activeDates]);
  const maxWeekActivity = Math.max(1, ...weekActivity);
  const completedDate = parseLocal(review.completedAt ?? review.updatedAt);
  const completedDateLabel = completedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const updateHeaderSurface = (
    offset = scrollOffset.current,
    distance = collapseDistance,
  ) => {
    const compact = offset >= distance;
    if (compact !== tabsInHeaderRef.current) {
      tabsInHeaderRef.current = compact;
      setTabsInHeader(compact);
    }
  };
  const compactStart = Math.max(0, collapseDistance - 140);
  const interpolateTabs = (expanded: number, compact: number) =>
    scrollY.interpolate({
      inputRange: [compactStart, collapseDistance],
      outputRange: [expanded, compact],
      extrapolate: 'clamp',
    });
  const tabsInset = interpolateTabs(20, onBack ? 64 : 20);
  const tabsTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [heroHeight, compactTop - headerHeight],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [
      compactStart,
      Math.max(compactStart + 1, collapseDistance - 52),
    ],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const tabTrackFadeDistance = Math.min(12, collapseDistance / 4);
  const tabTrackOpacity = scrollY.interpolate({
    inputRange: [
      0,
      tabTrackFadeDistance,
      collapseDistance - tabTrackFadeDistance,
      collapseDistance,
    ],
    outputRange: [1, 0, 0, 1],
    extrapolate: 'clamp',
  });

  const changeTab = (next: MonthlyReviewSummaryTab) => {
    if (next === tab) {
      return;
    }
    const nextOffset = tabsInHeaderRef.current ? collapseDistance : 0;
    triggerLightHaptic();
    setLocalTab(next);
    onTabChange?.(next);
    scrollOffset.current = nextOffset;
    scrollY.setValue(nextOffset);
    updateHeaderSurface(nextOffset);
    scroll.current?.scrollTo({y: nextOffset, animated: false});
  };
  const edit = (stageKey: string) => {
    if (!saving) {
      onEdit?.(stageKey);
    }
  };
  const empty = (copy: string) => (
    <ThemedText style={styles.empty}>{copy}</ThemedText>
  );
  const card = (
    title: string,
    icon: string,
    stageKey: string | null,
    content: React.ReactNode,
    style?: StyleProp<ViewStyle>,
    iconStyle?: StyleProp<ViewStyle>,
  ) => (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeading}>
        <View style={[styles.headingIcon, iconStyle]}>
          <Ionicons name={icon} size={17} color={palette.green} />
        </View>
        <ThemedText weight="semiBold" style={styles.cardTitle}>
          {title}
        </ThemedText>
        {onEdit && stageKey && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title.toLocaleLowerCase()}`}
            disabled={saving}
            onPress={() => edit(stageKey)}
            style={styles.edit}>
            <Pencil size={18} color={palette.green} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </View>
      {content}
    </View>
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    scrollOffset.current = offset;
    updateHeaderSurface(offset);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scroll}
        testID="monthly-review-scroll"
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: bottomInset + (onFinish ? 112 : 38),
        }}>
        <View
          testID="monthly-review-hero"
          onLayout={event => setHeroHeight(event.nativeEvent.layout.height)}
          style={[styles.hero, {paddingTop: headerHeight + 18}]}>
          <Landscape ahead={tab === 'ahead'} />
          <View style={styles.heroCopy}>
            <ThemedText weight="semiBold" style={styles.eyebrow}>
              MONTHLY REVIEW
            </ThemedText>
            <ThemedText weight="bold" style={styles.date}>
              {tab === 'back' ? reviewedMonth : nextMonth}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {tab === 'back'
                ? 'A wider view of what God has been doing.'
                : 'Carry what matters into a new month.'}
            </ThemedText>
            <View style={styles.heroBadge}>
              <Ionicons name="leaf-outline" size={14} color={palette.green} />
              <ThemedText weight="medium" style={styles.heroBadgeText}>
                {tab === 'back'
                  ? 'Pause. Notice. Carry it forward.'
                  : 'Faithful attention, one month at a time.'}
              </ThemedText>
            </View>
          </View>
        </View>
        <View style={styles.tabsPlaceholder} />
        <View style={styles.content}>
          <View style={styles.intro}>
            <ThemedText weight="semiBold" style={styles.sectionKicker}>
              {tab === 'back' ? 'THE MONTH YOU LIVED' : 'YOUR MONTH AHEAD'}
            </ThemedText>
            <ThemedText weight="bold" style={styles.sectionTitle}>
              {tab === 'back'
                ? 'See the month as a whole.'
                : 'Make room for what matters.'}
            </ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              {tab === 'back'
                ? 'Notice the patterns, the grace, and what you chose to remember.'
                : 'Let reflection become faithful attention—not a longer task list.'}
            </ThemedText>
            <ThemedText style={styles.sectionDate}>
              {tab === 'back' ? reviewedMonth : nextMonth}
            </ThemedText>
          </View>

          {tab === 'back' ? (
            <>
              {card(
                'How the month felt',
                'heart-outline',
                'monthly_feelings',
                monthFeelings.length ? (
                  <View style={styles.feelingChips}>
                    {monthFeelings.map((feeling, index) => (
                      <View
                        key={`${feeling}-${index}`}
                        style={styles.feelingChip}>
                        <ThemedText
                          weight="medium"
                          style={styles.feelingChipText}>
                          {feeling}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  empty('You left room for the month to keep unfolding.')
                ),
              )}
              {captureLoading ? (
                <View style={[styles.card, styles.loadingCard]}>
                  <ActivityIndicator color={palette.green} />
                  <ThemedText style={styles.empty}>
                    Gathering your month…
                  </ThemedText>
                </View>
              ) : capture ? (
                <View style={styles.card}>
                  <View style={styles.cardHeading}>
                    <View style={styles.headingIcon}>
                      <Ionicons
                        name="stats-chart-outline"
                        size={17}
                        color={palette.green}
                      />
                    </View>
                    <ThemedText weight="semiBold" style={styles.cardTitle}>
                      Your month, in moments
                    </ThemedText>
                  </View>
                  <View style={styles.stats}>
                    <View style={styles.stat}>
                      <ThemedText weight="bold" style={styles.statNumber}>
                        {activeDates.length}
                      </ThemedText>
                      <ThemedText style={styles.statLabel}>
                        days with moments
                      </ThemedText>
                    </View>
                    <View style={styles.stat}>
                      <ThemedText weight="bold" style={styles.statNumber}>
                        {capture.items.length}
                      </ThemedText>
                      <ThemedText style={styles.statLabel}>
                        saved moments
                      </ThemedText>
                    </View>
                    <View style={styles.stat}>
                      <ThemedText weight="bold" style={styles.statNumber}>
                        {review.memorableItems.length}
                      </ThemedText>
                      <ThemedText style={styles.statLabel}>
                        bookmarked
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.monthChart}>
                    {weekActivity.map((count, index) => (
                      <View key={index} style={styles.monthWeek}>
                        <View style={styles.monthBarTrack}>
                          <View
                            style={[
                              styles.monthBar,
                              {
                                height:
                                  count > 0
                                    ? 8 + (count / maxWeekActivity) * 42
                                    : 4,
                                backgroundColor:
                                  count > 0 ? '#8FAA94' : '#E6EAE2',
                              },
                            ]}
                          />
                        </View>
                        <ThemedText style={styles.monthWeekLabel}>
                          W{index + 1}
                        </ThemedText>
                        <ThemedText style={styles.monthWeekCount}>
                          {count}d
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                  <ThemedText style={styles.chartHint}>
                    A month is more than its busiest days.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.card}>
                  <ThemedText style={styles.empty}>
                    Your saved moments could not be loaded. Your written
                    reflections are below.
                  </ThemedText>
                </View>
              )}

              {card(
                'What shaped the month',
                'bookmark-outline',
                'captured',
                remembered.length || answers.remember_month?.trim() ? (
                  <>
                    {remembered.length ? (
                      <View style={styles.moments}>
                        {remembered.map(item => (
                          <View
                            key={`${item.id}:${item.selectedDate}`}
                            style={styles.moment}>
                            <View style={styles.momentDot} />
                            <View style={styles.flex}>
                              <ThemedText
                                weight="medium"
                                style={styles.momentTitle}>
                                {item.title}
                              </ThemedText>
                              <ThemedText style={styles.meta}>
                                {parseLocal(
                                  item.selectedDate,
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </ThemedText>
                              {!!item.text?.trim() && (
                                <Excerpt text={item.text.trim()} />
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {!!answers.remember_month?.trim() && (
                      <View style={styles.legacyMemory}>
                        <Excerpt text={answers.remember_month.trim()} />
                      </View>
                    )}
                  </>
                ) : (
                  empty(
                    'Nothing was bookmarked. The month can still hold meaning.',
                  )
                ),
              )}
              {card(
                'Patterns you noticed',
                'repeat-outline',
                'notice',
                answers.notice_month?.trim() ? (
                  <Excerpt text={answers.notice_month.trim()} />
                ) : (
                  empty(
                    'Some patterns need more than one month to become clear.',
                  )
                ),
              )}
              {card(
                'God’s faithfulness',
                'sparkles-outline',
                'god',
                answers.god_month?.trim() ? (
                  <Excerpt text={answers.god_month.trim()} />
                ) : (
                  empty('Keep noticing where grace met you.')
                ),
                styles.gratitudeCard,
                styles.gratitudeIcon,
              )}
              {card(
                'What God may be forming',
                'leaf-outline',
                'formation',
                answers.formation_month?.trim() ? (
                  <Excerpt text={answers.formation_month.trim()} />
                ) : (
                  empty('Formation can be quiet and unfinished.')
                ),
              )}
              {card(
                'This month in prayer',
                'heart-outline',
                'prayer',
                answers.prayer_month?.trim() ? (
                  <Excerpt text={answers.prayer_month.trim()} />
                ) : (
                  empty('There is room for gratitude and waiting here.')
                ),
              )}
              {!!review.prayerSnapshot?.length && (
                <WeeklyReviewPrayerSummary items={review.prayerSnapshot} />
              )}
              {card(
                'What you’re releasing',
                'remove-circle-outline',
                'release',
                answers.release_month?.trim() ? (
                  <Excerpt text={answers.release_month.trim()} />
                ) : (
                  empty('You do not have to force an ending.')
                ),
              )}
            </>
          ) : (
            <>
              {card(
                'What matters most',
                'flag-outline',
                'priority',
                priorities.length ? (
                  <View style={styles.priorities}>
                    {priorities.map((value, index) => (
                      <View key={index} style={styles.priority}>
                        <View style={styles.priorityNumber}>
                          <ThemedText
                            weight="semiBold"
                            style={styles.priorityNumberText}>
                            {String(index + 1).padStart(2, '0')}
                          </ThemedText>
                        </View>
                        <ThemedText weight="medium" style={styles.priorityText}>
                          {value}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  empty('You haven’t named a priority. One is enough.')
                ),
                styles.priorityCard,
              )}
              {card(
                'What needs attention',
                'compass-outline',
                'attention',
                answers.attention?.trim() ? (
                  <Excerpt text={answers.attention.trim()} />
                ) : (
                  empty('Leave room for what becomes clear.')
                ),
              )}
              {card(
                'What you want to continue',
                'arrow-forward-circle-outline',
                'continue',
                answers.continue?.trim() ? (
                  <Excerpt text={answers.continue.trim()} />
                ) : (
                  empty('Carry forward what gives life.')
                ),
              )}
              {card(
                'What can become simpler',
                'contract-outline',
                'simplify_or_stop',
                answers.simplify_or_stop?.trim() ? (
                  <Excerpt text={answers.simplify_or_stop.trim()} />
                ) : (
                  empty('Not everything needs to follow you.')
                ),
              )}
              {card(
                'Who you want to make room for',
                'people-outline',
                'people',
                answers.intentional_with?.trim() ? (
                  <Excerpt text={answers.intentional_with.trim()} />
                ) : (
                  empty('Intentional presence can stay simple.')
                ),
              )}
              {card(
                'A rhythm to protect',
                'repeat-outline',
                'rhythm',
                answers.rhythm?.trim() ? (
                  <Excerpt text={answers.rhythm.trim()} />
                ) : (
                  empty('Choose a rhythm that helps you remain grounded.')
                ),
              )}
              <View style={styles.prayerCard}>
                <View style={styles.prayerHeading}>
                  <Ionicons name="sparkles-outline" size={21} color="#DCE7D7" />
                  <ThemedText weight="semiBold" style={styles.prayerTitle}>
                    Your prayer for the month ahead
                  </ThemedText>
                  {onEdit && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Edit your prayer for the month ahead"
                      disabled={saving}
                      onPress={() => edit('prayer_for_month')}
                      style={styles.edit}>
                      <Pencil size={18} color="#FFFFFF" strokeWidth={1.8} />
                    </TouchableOpacity>
                  )}
                </View>
                <Excerpt
                  text={
                    answers.prayer_for_month?.trim() ||
                    'Bring the month ahead to God.'
                  }
                  light
                />
                <View style={styles.prayerRule} />
                <ThemedText style={styles.prayerFootnote}>
                  One faithful month. With God.
                </ThemedText>
              </View>
            </>
          )}
          <View style={styles.closing}>
            <Ionicons name="leaf-outline" size={23} color="#91A48C" />
            <ThemedText style={styles.closingText}>
              {tab === 'back'
                ? 'Keep what matters. Let the month settle.'
                : 'You do not have to carry the whole month at once.'}
            </ThemedText>
          </View>
          {review.status === 'completed' && (
            <ThemedText style={styles.completed}>
              Completed {completedDateLabel}
            </ThemedText>
          )}
        </View>
      </Animated.ScrollView>

      {onBack && (
        <View
          testID="monthly-review-navigation-surface"
          pointerEvents="none"
          style={[styles.navigationSurface, {height: headerHeight}]}
        />
      )}
      {onBack && (
        <View
          pointerEvents="box-none"
          style={[styles.navigationOverlay, {paddingTop: topInset}]}>
          <View pointerEvents="box-none" style={styles.navigationRow}>
            <HeaderBackButton
              accessibilityRole="button"
              accessibilityLabel={backAccessibilityLabel}
              onPress={onBack}
              color={palette.green}
            />
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden={tabsInHeader}
              importantForAccessibility={
                tabsInHeader ? 'no-hide-descendants' : 'auto'
              }
              style={[styles.navigationTitleWrap, {opacity: titleOpacity}]}>
              <ThemedText weight="medium" style={styles.navigationTitle}>
                Your monthly review
              </ThemedText>
            </Animated.View>
            {onClose ? (
              <HeaderCloseButton
                accessibilityLabel="Close review"
                onPress={onClose}
              />
            ) : (
              <View style={styles.navigationAction}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={palette.green}
                />
              </View>
            )}
          </View>
        </View>
      )}

      <Animated.View
        testID="monthly-review-moving-tabs"
        pointerEvents="box-none"
        style={[
          styles.tabsOverlay,
          {
            top: headerHeight,
            transform: [{translateY: tabsTranslateY}],
            paddingTop: interpolateTabs(14, 6),
            paddingBottom: interpolateTabs(12, 6),
          },
        ]}>
        <Animated.View
          style={[
            styles.tabs,
            {marginHorizontal: tabsInset, padding: interpolateTabs(5, 2)},
          ]}
          accessibilityRole="tablist">
          <Animated.View
            pointerEvents="none"
            style={[styles.tabTrack, {opacity: tabTrackOpacity}]}
          />
          {(
            [
              {key: 'back', label: 'Looking Back', icon: 'leaf-outline'},
              {key: 'ahead', label: 'Looking Ahead', icon: 'sunny-outline'},
            ] as const
          ).map(item => (
            <Animated.View
              key={item.key}
              style={[styles.tabSlot, {minHeight: interpolateTabs(46, 36)}]}>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{selected: tab === item.key}}
                onPress={() => changeTab(item.key)}
                activeOpacity={0.8}
                style={[styles.tab, tab === item.key && styles.activeTab]}>
                <Animated.View
                  style={{
                    width: interpolateTabs(17, 0),
                    marginRight: interpolateTabs(7, 0),
                    opacity: interpolateTabs(1, 0),
                    overflow: 'hidden',
                  }}>
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={tab === item.key ? '#FFFFFF' : palette.green}
                  />
                </Animated.View>
                <ThemedText
                  weight="semiBold"
                  numberOfLines={1}
                  style={[
                    styles.tabText,
                    tab === item.key && styles.lightText,
                  ]}>
                  {item.label}
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>
      </Animated.View>

      {onFinish && (
        <View
          style={[
            styles.finishBar,
            {paddingBottom: Math.max(14, bottomInset)},
          ]}>
          {saveError && (
            <ThemedText accessibilityRole="alert" style={styles.saveError}>
              Couldn’t finish saving your review. Please try again.
            </ThemedText>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Finish monthly review"
            accessibilityState={{disabled: saving, busy: saving}}
            disabled={saving}
            onPress={onFinish}
            style={[styles.finishButton, saving && {opacity: 0.65}]}
            activeOpacity={0.8}>
            {saving && (
              <ActivityIndicator size="small" color={Colors.hopeWhite} />
            )}
            <ThemedText weight="bold" style={styles.finishText}>
              {saving ? 'Saving…' : 'Finish review'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.paper},
  flex: {flex: 1, minWidth: 0},
  navigationSurface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 19,
    backgroundColor: palette.paper,
  },
  navigationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 22,
  },
  navigationRow: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationTitleWrap: {flex: 1, alignItems: 'center'},
  navigationTitle: {fontSize: 12, color: palette.green},
  navigationAction: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 21,
    backgroundColor: 'transparent',
  },
  tabsPlaceholder: {height: 82},
  hero: {
    minHeight: 216,
    paddingHorizontal: 24,
    paddingBottom: 48,
    overflow: 'hidden',
  },
  landscape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.72,
  },
  heroCopy: {gap: 10},
  eyebrow: {fontSize: 10, letterSpacing: 2.3, color: palette.green},
  date: {
    fontFamily: Fonts.lora.bold,
    fontSize: 30,
    lineHeight: 40,
    color: palette.ink,
    letterSpacing: -0.7,
  },
  heroSubtitle: {fontSize: 13, lineHeight: 21, color: '#58685E', maxWidth: 270},
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(253,253,249,0.88)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 3,
  },
  heroBadgeText: {fontSize: 10, color: palette.green},
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 22,
    gap: 4,
  },
  tabTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: palette.sage,
  },
  tabSlot: {flex: 1, borderRadius: 18},
  tab: {
    flex: 1,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  activeTab: {
    backgroundColor: palette.green,
    shadowColor: '#344C3F',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  tabText: {fontSize: 12, flexShrink: 1, color: palette.green},
  lightText: {color: '#F8FBF4'},
  content: {paddingHorizontal: 20, gap: 14},
  intro: {paddingTop: 13, paddingHorizontal: 3, paddingBottom: 8, gap: 7},
  sectionKicker: {fontSize: 9, letterSpacing: 2, color: palette.green},
  sectionTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 23,
    lineHeight: 31,
    color: palette.ink,
  },
  sectionSubtitle: {fontSize: 12, lineHeight: 19, color: palette.muted},
  sectionDate: {
    fontSize: 10,
    lineHeight: 17,
    color: palette.green,
    marginTop: 1,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECEEE6',
    padding: 18,
    shadowColor: '#3A4F3D',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.025,
    shadowRadius: 10,
  },
  loadingCard: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 15,
    minHeight: 30,
  },
  headingIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EFF2E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {flex: 1, fontSize: 15, lineHeight: 22, color: palette.ink},
  edit: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -5,
    marginRight: -8,
  },
  body: {fontSize: 14, lineHeight: 23, color: '#4E6055'},
  empty: {fontSize: 13, lineHeight: 21, color: palette.muted},
  feelingChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  feelingChip: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.sage,
  },
  feelingChipText: {fontSize: 13, lineHeight: 19, color: palette.ink},
  textAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
  },
  link: {fontSize: 11, color: palette.green},
  stats: {
    flexDirection: 'row',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: palette.line,
    marginBottom: 18,
  },
  stat: {flex: 1, alignItems: 'center', paddingHorizontal: 3, gap: 5},
  statNumber: {
    fontFamily: Fonts.lora.bold,
    fontSize: 29,
    lineHeight: 36,
    color: palette.ink,
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 15,
    color: palette.muted,
    textAlign: 'center',
  },
  monthChart: {
    height: 78,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    gap: 9,
  },
  monthWeek: {flex: 1, alignItems: 'center'},
  monthBarTrack: {height: 50, width: 28, justifyContent: 'flex-end'},
  monthBar: {width: 28, borderRadius: 8},
  monthWeekLabel: {fontSize: 9, color: palette.green, marginTop: 7},
  monthWeekCount: {fontSize: 9, color: palette.muted, marginTop: 2},
  chartHint: {
    fontSize: 11,
    lineHeight: 17,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 14,
  },
  moments: {gap: 2},
  moment: {flexDirection: 'row', gap: 11, paddingVertical: 9},
  momentDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: '#96AD99',
  },
  momentTitle: {fontSize: 13, lineHeight: 21, color: palette.ink},
  legacyMemory: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  meta: {
    fontSize: 10,
    color: palette.muted,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 5,
  },
  gratitudeCard: {backgroundColor: '#FBF2E9', borderColor: '#F0E7DC'},
  gratitudeIcon: {backgroundColor: '#F3DED2'},
  priorityCard: {backgroundColor: '#ECF1E8', borderColor: '#E1E9DB'},
  priorities: {gap: 16},
  priority: {flexDirection: 'row', gap: 13, alignItems: 'flex-start'},
  priorityNumber: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#DCE6D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityNumberText: {fontSize: 12, color: palette.green},
  priorityText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: palette.ink,
    paddingTop: 3,
  },
  prayerCard: {padding: 22, backgroundColor: '#526C5B', borderRadius: 24},
  prayerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  prayerTitle: {flex: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 23},
  prayerRule: {
    height: 1,
    backgroundColor: '#758D79',
    marginTop: 22,
    marginBottom: 15,
  },
  prayerFootnote: {fontSize: 11, color: '#D7E1CF'},
  closing: {alignItems: 'center', paddingVertical: 18, gap: 11},
  closingText: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    color: palette.muted,
    maxWidth: 260,
  },
  completed: {fontSize: 10, textAlign: 'center', color: palette.muted},
  finishBar: {
    borderTopWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: palette.paper,
  },
  finishButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: Colors.darkBackground,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  finishText: {fontSize: 16, color: Colors.hopeWhite},
  saveError: {
    fontSize: 12,
    color: '#A74B43',
    textAlign: 'center',
    paddingBottom: 10,
  },
});
