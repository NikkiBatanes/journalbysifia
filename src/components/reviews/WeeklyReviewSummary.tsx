import React, {useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Pencil} from 'lucide-react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import ThemedText from '../common/ThemedText';
import HeaderBackButton from '../common/HeaderBackButton';
import HeaderCloseButton from '../common/HeaderCloseButton';
import {WeeklyReviewPrayerSummary} from './WeeklyReviewPrayerSummary';
import {Fonts} from '../../theme/fonts';
import {Colors} from '../../theme/colors';
import {triggerLightHaptic} from '../../utils/haptics';
import {fromLocalDateString} from '../../utils/date';
import type {LocalReviewEntry} from '../../storage/reviewStorage';
import type {ReviewCapture, ReviewCaptureItem} from '../../services/reviewCaptureService';
import {buildWeeklyReviewSummary, LIFE_RATINGS} from '../../services/weeklyReviewSummary';
import {formatWeeklyGratitudePeriod} from '../../utils/weeklyGratitudePeriod';
import {formatWeeklyLookingAheadPeriod} from '../../utils/weeklyLookingAheadPeriod';
import {getWeeklyGratitudeItems} from '../../utils/weeklyGratitudeAnswers';
import {getWeeklyCareAreas} from '../../utils/weeklyLifeAreaAnswers';
import {getWeeklyChallengeChoices} from '../../utils/weeklyChallengeAnswers';
import {getWeeklyLookingForwardContent} from '../../utils/weeklyLookingForwardAnswers';
import {formatWeeklySupportAnswer, getLegacyWeeklyLookingAheadSections} from '../../utils/weeklyLookingAheadAnswers';

export type WeeklyReviewSummaryTab = 'back' | 'ahead';
interface Props {
  review: LocalReviewEntry;
  capture: ReviewCapture | null;
  captureLoading?: boolean;
  activeTab?: WeeklyReviewSummaryTab;
  onTabChange?: (tab: WeeklyReviewSummaryTab) => void;
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
  paper: '#F6F5EF', ink: '#293D35', muted: '#748078', green: '#526F5D',
  line: '#E6E9E1', card: '#FDFDF9', sage: '#E8EEE3', sand: '#F3EDE2', peach: '#F7E8DF',
};

const Landscape = ({ahead}: {ahead: boolean}) => (
  <View pointerEvents="none" accessible={false} style={styles.landscape}>
    {/* Fit the sun independently so wide screens cannot crop it or stretch it into an oval. */}
    <Svg width="100%" height="150" viewBox="0 0 390 150" preserveAspectRatio="xMaxYMin meet" style={StyleSheet.absoluteFill}>
      <Circle cx={ahead ? 275 : 330} cy={ahead ? 48 : 30} r={22} fill={ahead ? '#EFC896' : '#F0D8C3'}/>
    </Svg>
    <Svg width="100%" height="150" viewBox="0 0 390 150" preserveAspectRatio="none">
      <Path d="M75 150 C130 135 149 92 184 103 S220 121 254 73 S298 30 335 73 S370 77 410 42 V150Z" fill="#DEE5D9"/>
      <Path d="M5 150 C80 145 113 109 152 116 S206 144 251 108 S300 102 331 113 S375 83 410 97 V150Z" fill="#C8D6C8"/>
      <Path d="M0 150 C91 134 133 154 187 139 S266 116 309 131 S367 121 410 118 V150Z" fill="#A9BEAE"/>
      <Path d="M0 150 C118 146 160 164 232 151 S338 139 410 146 V160 H0Z" fill={palette.green}/>
    </Svg>
  </View>
);

const Excerpt = ({text, light = false}: {text: string; light?: boolean}) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 260;
  return <>
    <ThemedText style={[styles.body, light && styles.lightText]}>{long && !expanded ? `${text.slice(0, 260).trim()}…` : text}</ThemedText>
    {long && <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded}} style={styles.textAction}
      onPress={() => {triggerLightHaptic(); setExpanded(value => !value);}}>
      <ThemedText weight="medium" style={[styles.link, light && styles.lightText]}>{expanded ? 'Read less' : 'Read more'}</ThemedText>
    </TouchableOpacity>}
  </>;
};

const Chips = ({values, tone = 'sage'}: {values: string[]; tone?: 'sage' | 'sand' | 'peach'}) => (
  <View style={styles.chips}>{values.map((value, index) => <View key={`${value}-${index}`} style={[styles.chip, {backgroundColor: palette[tone]}]}>
    <ThemedText weight="medium" style={styles.chipText}>{value}</ThemedText>
  </View>)}</View>
);

const formatMomentDate = (value: string) => fromLocalDateString(value).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

const Moment = ({item}: {item: ReviewCaptureItem}) => (
  <View style={styles.moment}>
    <View style={styles.momentDot}><Ionicons name="bookmark-outline" size={15} color={palette.green}/></View>
    <View style={styles.flex}>
      <ThemedText weight="medium" style={styles.momentTitle}>{item.title}</ThemedText>
      <ThemedText style={styles.meta}>{[item.subtitle, formatMomentDate(item.selectedDate)].filter(Boolean).join(' · ')}</ThemedText>
      {!!(item.text?.trim() || item.lines?.length) && <Excerpt text={item.text?.trim() || item.lines!.join('\n')}/>}
    </View>
  </View>
);

export const WeeklyReviewSummary = ({review, capture, captureLoading = false, activeTab, onTabChange, onEdit, onFinish, saving = false, saveError = false, bottomInset = 0, topInset = 0, onBack, onClose, backAccessibilityLabel = 'Go back'}: Props) => {
  const [localTab, setLocalTab] = useState<WeeklyReviewSummaryTab>('back');
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAllDayMoments, setShowAllDayMoments] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAllRemembered, setShowAllRemembered] = useState(false);
  const summary = useMemo(() => buildWeeklyReviewSummary(review, capture), [review, capture]);
  const answers = review.answers;
  const day = summary.days.find(item => item.date === selectedDay);
  const largestDay = Math.max(1, ...summary.days.map(item => item.count));
  const careAreas = getWeeklyCareAreas(answers);
  const challenges = getWeeklyChallengeChoices(answers);
  const gratitude = getWeeklyGratitudeItems(answers);
  const lookingForward = getWeeklyLookingForwardContent(answers);
  const priorities = ['priority_1', 'priority_2', 'priority_3'].map(key => answers[key]?.trim()).filter(Boolean);
  const godChoices = (answers.god ?? '').split('|').map(value => value.trim()).filter(Boolean);
  const legacy = getLegacyWeeklyLookingAheadSections(answers);
  const prayer = formatWeeklySupportAnswer(answers);
  const currentYear = new Date().getFullYear();
  const backHeaderDateLabel = formatWeeklyGratitudePeriod(review.periodStart, review.periodEnd, currentYear, 'long');
  const aheadHeaderDateLabel = formatWeeklyLookingAheadPeriod(review.periodEnd, currentYear, 'long');
  const aheadDateLabel = formatWeeklyLookingAheadPeriod(review.periodEnd, currentYear);
  const completedDate = fromLocalDateString(review.completedAt ?? review.updatedAt);
  const completedDateLabel = completedDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(completedDate.getFullYear() === currentYear ? {} : {year: 'numeric' as const}),
  });

  const updateHeaderSurface = (offset = scrollOffset.current, distance = collapseDistance) => {
    const compact = offset >= distance;
    if (compact !== tabsInHeaderRef.current) {
      tabsInHeaderRef.current = compact;
      setTabsInHeader(compact);
    }
  };
  const compactStart = Math.max(0, collapseDistance - 140);
  const interpolateTabs = (expanded: number, compact: number) => scrollY.interpolate({
    inputRange: [compactStart, collapseDistance], outputRange: [expanded, compact], extrapolate: 'clamp',
  });
  const tabsInset = interpolateTabs(20, onBack ? 64 : 20);
  const tabsTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance], outputRange: [heroHeight, compactTop - headerHeight],
    extrapolateLeft: 'extend', extrapolateRight: 'clamp',
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [compactStart, Math.max(compactStart + 1, collapseDistance - 52)],
    outputRange: [1, 0], extrapolate: 'clamp',
  });
  const tabTrackFadeDistance = Math.min(12, collapseDistance / 4);
  const tabTrackOpacity = scrollY.interpolate({
    inputRange: [0, tabTrackFadeDistance, collapseDistance - tabTrackFadeDistance, collapseDistance],
    outputRange: [1, 0, 0, 1], extrapolate: 'clamp',
  });
  const changeTab = (next: WeeklyReviewSummaryTab) => {
    if (next === tab) {return;}
    const keepInHeader = tabsInHeaderRef.current;
    const nextOffset = keepInHeader ? collapseDistance : 0;
    triggerLightHaptic();
    setLocalTab(next);
    onTabChange?.(next);
    scrollOffset.current = nextOffset;
    scrollY.setValue(nextOffset);
    updateHeaderSurface(nextOffset);
    scroll.current?.scrollTo({y: nextOffset, animated: false});
  };
  const edit = (stageKey: string) => {if (!saving) {onEdit?.(stageKey);}};
  const card = (title: string, icon: string, stageKey: string | null, content: React.ReactNode, style?: StyleProp<ViewStyle>, iconStyle?: StyleProp<ViewStyle>) => (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeading}>
        <View testID={stageKey ? `weekly-review-${stageKey}-icon` : undefined} style={[styles.headingIcon, iconStyle]}><Ionicons name={icon} size={17} color={palette.green}/></View>
        <ThemedText weight="semiBold" style={styles.cardTitle}>{title}</ThemedText>
        {onEdit && stageKey && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${title.toLowerCase()}`}
          disabled={saving} onPress={() => edit(stageKey)} style={styles.edit}>
          <Pencil size={18} color={palette.green} strokeWidth={1.8}/>
        </TouchableOpacity>}
      </View>
      {content}
    </View>
  );
  const empty = (copy: string) => <ThemedText style={styles.empty}>{copy}</ThemedText>;

  return <View style={styles.root}>
    <Animated.ScrollView testID="weekly-review-scroll" ref={scroll} showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
        // Insets and padding morph along with the position; layout properties require the JS driver.
        useNativeDriver: false,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
          updateHeaderSurface();
        },
      })}
      contentContainerStyle={{paddingTop: headerHeight, paddingBottom: onFinish ? 20 : bottomInset + 28}}>
      <View testID="weekly-review-hero" style={styles.hero} onLayout={event => {
        const height = event.nativeEvent.layout.height;
        setHeroHeight(height);
        updateHeaderSurface(scrollOffset.current, height + headerHeight - compactTop);
      }}>
        <Landscape ahead={tab === 'ahead'}/>
        <View style={styles.heroCopy}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>WEEKLY REVIEW</ThemedText>
          <Text style={styles.date}>{tab === 'back' ? backHeaderDateLabel : aheadHeaderDateLabel}</Text>
          <ThemedText style={styles.heroSubtitle}>{tab === 'back' ? 'A little space to see your week clearly.' : 'Entrust the week ahead to God.'}</ThemedText>
          <View style={styles.heroBadge}><Ionicons name={review.status === 'completed' ? 'checkmark-circle-outline' : 'leaf-outline'} size={14} color={palette.green}/>
            <ThemedText weight="medium" style={styles.heroBadgeText}>{review.status === 'completed' ? 'A week remembered' : 'Pause. Notice. Carry it forward.'}</ThemedText>
          </View>
        </View>
      </View>

      <View pointerEvents="none" style={styles.tabsPlaceholder}/>

      <View style={styles.content} key={tab}>
        <View style={styles.intro}>
          <ThemedText weight="semiBold" style={styles.sectionKicker}>{tab === 'back' ? 'THE WEEK YOU LIVED' : 'YOUR WEEK AHEAD'}</ThemedText>
          <Text style={styles.sectionTitle}>{tab === 'back' ? 'There was meaning here.' : 'Make room for what matters.'}</Text>
          <ThemedText style={styles.sectionSubtitle}>{tab === 'back'
            ? 'Looking back with God at what you felt, noticed, and chose to remember.'
            : 'With God, consider what to carry, care for, and pray over.'}</ThemedText>
          {tab === 'ahead' && <ThemedText weight="medium" style={styles.sectionDate}>{aheadDateLabel}</ThemedText>}
        </View>

        {tab === 'back' ? <>
          {card('How the week felt', 'heart-outline', 'feelings', summary.feelings.length
            ? <Chips values={summary.feelings}/>
            : empty('You left this open. There is room for a mixed week, too.'))}

          {card('Your week, in moments', 'bar-chart-outline', null, capture ? <>
            <View style={styles.stats}>
              {[{value: summary.activeDays, label: 'days with moments'}, {value: summary.moments.length, label: 'saved moments'}, {value: summary.rememberedCount, label: 'bookmarked'}].map(stat => (
                <View key={stat.label} style={styles.stat}><Text style={styles.statNumber}>{stat.value}</Text><ThemedText style={styles.statLabel}>{stat.label}</ThemedText></View>
              ))}
            </View>
            <View style={styles.chart}>
              {summary.days.map(item => <TouchableOpacity key={item.date} accessibilityRole="button"
                accessibilityLabel={`${item.date}: ${item.count} saved ${item.count === 1 ? 'moment' : 'moments'}`}
                accessibilityState={{selected: selectedDay === item.date}}
                onPress={() => {triggerLightHaptic(); setSelectedDay(selectedDay === item.date ? null : item.date); setShowAllDayMoments(false);}}
                style={styles.chartDay} activeOpacity={0.8}>
                <View style={styles.barTrack}><View style={[styles.bar, {height: item.count ? 12 + (item.count / largestDay) * 46 : 4, backgroundColor: selectedDay === item.date ? palette.ink : item.count ? '#8CA791' : '#E4E9E0'}]}/></View>
                <ThemedText weight="medium" style={styles.dayLabel}>{item.label.slice(0, 1)}</ThemedText>
                <ThemedText style={[styles.dayNumber, selectedDay === item.date && styles.selectedDay]}>{item.day}</ThemedText>
              </TouchableOpacity>)}
            </View>
            {day ? <View style={styles.dayDetail}>
              <ThemedText weight="semiBold" style={styles.detailTitle}>{day.label}, {formatMomentDate(day.date)} · {day.count} saved {day.count === 1 ? 'moment' : 'moments'}</ThemedText>
              {day.count ? (showAllDayMoments ? day.moments : day.moments.slice(0, 3)).map(item => <Moment key={`${item.presentation}:${item.id}`} item={item}/>) : empty('No moments were saved for this day.')}
              {day.count > 3 && <TouchableOpacity accessibilityRole="button" style={styles.textAction} onPress={() => {triggerLightHaptic(); setShowAllDayMoments(value => !value);}}>
                <ThemedText weight="medium" style={styles.link}>{showAllDayMoments ? 'Show fewer moments' : `Show all ${day.count} moments`}</ThemedText>
              </TouchableOpacity>}
            </View> : <ThemedText style={styles.chartHint}>Tap a day to revisit its moments.</ThemedText>}
            {summary.categories.length > 0 && <>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded: showBreakdown}} style={styles.breakdownToggle}
                onPress={() => {triggerLightHaptic(); setShowBreakdown(value => !value);}}>
                <ThemedText weight="medium" style={styles.link}>See activity breakdown</ThemedText>
                <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.green}/>
              </TouchableOpacity>
              {showBreakdown && <View style={styles.breakdown}>{summary.categories.map(group => <View key={group.key} style={styles.category}>
                <View style={styles.categoryHeading}><ThemedText style={styles.categoryLabel}>{group.label}</ThemedText><ThemedText weight="semiBold" style={styles.categoryLabel}>{group.count}</ThemedText></View>
                <View style={styles.categoryTrack}><View style={[styles.categoryFill, {width: `${group.count / summary.moments.length * 100}%`, backgroundColor: group.color}]}/></View>
              </View>)}</View>}
            </>}
            <ThemedText style={styles.finePrint}>Based on moments saved for this week.</ThemedText>
          </> : empty(captureLoading ? 'Gathering your saved moments…' : 'Your saved moments could not be loaded. Your written reflections are below.'))}

          {card('Whole-life check-in', 'grid-outline', 'life_check_in', <>
            {summary.answeredAreas > 0 && <>
              <View style={styles.lifeBar}>{summary.lifeCounts.filter(item => item.count).map(item => <View key={item.value} style={{flex: item.count, backgroundColor: LIFE_RATINGS[item.value].background, borderBottomWidth: 3, borderBottomColor: LIFE_RATINGS[item.value].color}}/>)}</View>
              <ThemedText style={styles.finePrint}>{summary.lifeCounts.filter(item => item.count).map(item => `${item.count} ${LIFE_RATINGS[item.value].label.toLowerCase()}`).join('  ·  ')}</ThemedText>
            </>}
            {summary.lifeAreas.map(area => <View key={area.key} style={styles.lifeRow}>
              <MaterialCommunityIcons name={area.icon} size={21} color={palette.green}/>
              <ThemedText weight="medium" style={styles.lifeLabel}>{area.label}</ThemedText>
              <View style={[styles.rating, {backgroundColor: LIFE_RATINGS[area.value]?.background ?? '#F0F1EB'}]}>
                <ThemedText weight="medium" style={[styles.ratingText, {color: LIFE_RATINGS[area.value]?.color ?? palette.muted}]}>{LIFE_RATINGS[area.value]?.label ?? (area.value || '—')}</ThemedText>
              </View>
            </View>)}
          </>)}

          {card('What stood out', 'bookmark-outline', 'remembered', <>
            {(showAllRemembered ? summary.remembered : summary.remembered.slice(0, 4)).map(item => <Moment key={`${item.id}:${item.selectedDate}`} item={item}/>)}
            {summary.remembered.length > 4 && <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded: showAllRemembered}} style={styles.textAction}
              onPress={() => {triggerLightHaptic(); setShowAllRemembered(value => !value);}}>
              <ThemedText weight="medium" style={styles.link}>{showAllRemembered ? 'Show fewer bookmarks' : `See all ${summary.remembered.length} bookmarks`}</ThemedText>
            </TouchableOpacity>}
            {!!answers.week_memory_other?.trim() && <View style={styles.writtenMemory}><Excerpt text={answers.week_memory_other.trim()}/></View>}
            {capture && summary.unavailableRemembered > 0 && <ThemedText style={styles.empty}>{summary.unavailableRemembered} bookmarked {summary.unavailableRemembered === 1 ? 'moment is' : 'moments are'} no longer available.</ThemedText>}
            {!capture && summary.rememberedCount > 0 && empty(captureLoading ? 'Gathering your bookmarked moments…' : 'Your bookmarks are saved. Their original moments could not be loaded.')}
            {!summary.rememberedCount && !answers.week_memory_other?.trim() && empty('No moments bookmarked. You can still carry something meaningful from this week.')}
          </>)}
          {card('The hard parts', 'heart-outline', 'difficulty', answers.week_difficulty?.trim() ? <Excerpt text={answers.week_difficulty.trim()}/> : empty('You left this reflection open.'))}
          {card('A prayer of thanks', 'sunny-outline', 'notice', gratitude.length ? <Excerpt text={gratitude.join('\n\n')}/> : empty('A simple thank-you can be enough.'), styles.gratitudeCard, styles.gratitudeIcon)}
          {card('How God met you', 'sparkles-outline', 'god', <>
            {godChoices.length > 0 && <Chips values={godChoices} tone="sand"/>}
            {!!answers.god_faithfulness_other?.trim() && <View style={styles.note}><Excerpt text={answers.god_faithfulness_other.trim()}/></View>}
            {!godChoices.length && !answers.god_faithfulness_other?.trim() && empty('You left room to keep noticing.')}
          </>)}
          {card('What you’re learning', 'leaf-outline', 'learning', answers.week_learning?.trim() ? <Excerpt text={answers.week_learning.trim()}/> : empty('Some things take time to become clear.'))}
          {!!answers.prayer?.trim() && card('What are you still bringing to God?', 'heart-outline', null, <Excerpt text={answers.prayer.trim()}/>)}
          {!!review.prayerSnapshot?.length && <WeeklyReviewPrayerSummary items={review.prayerSnapshot}/>}
        </> : <>
          {card('What matters most', 'flag-outline', 'priority', priorities.length ? <View style={styles.priorities}>{priorities.map((value, index) => <View key={index} style={styles.priority}>
            <View style={styles.priorityNumber}><ThemedText weight="semiBold" style={styles.priorityNumberText}>{String(index + 1).padStart(2, '0')}</ThemedText></View>
            <ThemedText weight="medium" style={styles.priorityText}>{value}</ThemedText>
          </View>)}</View> : empty('You haven’t named a priority. One is enough.'), styles.priorityCard)}
          {card('What needs care', 'heart-outline', 'dont_forget', <>
            {careAreas.length > 0 && <View style={styles.chips}>{careAreas.map(area => {
              const label = area.key === 'other' && answers.week_care_other?.trim() ? answers.week_care_other.trim() : area.label;
              return <View key={area.key} testID={`weekly-review-care-${area.key}`} accessibilityLabel={`${label} care area`} style={[styles.chip, styles.careChip, {backgroundColor: palette.sage}]}>
                <MaterialCommunityIcons name={area.icon} size={16} color={palette.green}/>
                <ThemedText weight="medium" style={styles.chipText}>{label}</ThemedText>
              </View>;
            })}</View>}
            {!!answers.dont_forget?.trim() && <View style={styles.note}><Excerpt text={answers.dont_forget.trim()}/></View>}
            {!careAreas.length && !answers.dont_forget?.trim() && empty('Nothing named here yet. Leave room for what comes up.')}
          </>)}
          {card('What to be mindful of', 'compass-outline', 'watch_for', <>
            {challenges.filter(item => item.key !== 'other').length > 0 && <Chips values={challenges.filter(item => item.key !== 'other').map(item => item.label)} tone="sand"/>}
            {challenges.some(item => item.key === 'other') && answers.watch_for?.trim() && <View style={styles.note}><Excerpt text={answers.watch_for.trim()}/></View>}
            {!challenges.length && empty('You left this open. Take the week as it comes.')}
          </>)}
          {card('Looking forward to this week', 'sunny-outline', 'looking_forward_feeling', <>
            {!!lookingForward.emotionName && <View style={styles.emotion}><MaterialCommunityIcons name={lookingForward.emotionIcon || 'heart-outline'} size={19} color={palette.green}/><ThemedText weight="medium" style={styles.chipText}>{lookingForward.emotionName}</ThemedText></View>}
            {lookingForward.entry.text ? <Excerpt text={lookingForward.entry.text}/> : empty('There is room for something good ahead.')}
          </>, styles.gratitudeCard, styles.gratitudeIcon)}
          <View style={styles.prayerCard}>
            <View style={styles.prayerHeading}><Ionicons name="sparkles-outline" size={21} color="#DCE7D7"/><ThemedText weight="semiBold" style={styles.prayerTitle}>Your prayer for the week</ThemedText>
              {onEdit && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit your prayer for the week" disabled={saving} onPress={() => edit('prayer_ahead')} style={styles.edit}><Pencil size={18} color="#FFFFFF" strokeWidth={1.8}/></TouchableOpacity>}
            </View>
            <Excerpt text={prayer || 'Bring what’s ahead to God.'} light/>
            <View style={styles.prayerRule}/><ThemedText style={styles.prayerFootnote}>One day at a time. With God.</ThemedText>
          </View>
          {legacy.map(section => <React.Fragment key={section.key}>{card(section.title, 'leaf-outline', null, <Excerpt text={section.value}/>)}</React.Fragment>)}
        </>}
        <View style={styles.closing}><Ionicons name="leaf-outline" size={23} color="#91A48C"/><ThemedText style={styles.closingText}>{tab === 'back' ? 'Keep what matters. Let the rest settle.' : 'You don’t have to carry the whole week at once.'}</ThemedText></View>
        {review.status === 'completed' && <ThemedText style={styles.completed}>Completed {completedDateLabel}</ThemedText>}
      </View>
    </Animated.ScrollView>
    {onBack && <View testID="weekly-review-navigation-surface" pointerEvents="none"
      style={[styles.navigationSurface, {height: headerHeight}]}/>} 
    {onBack && <View pointerEvents="box-none" style={[styles.navigationOverlay, {paddingTop: topInset}]}>
      <View pointerEvents="box-none" style={styles.navigationRow}>
        <HeaderBackButton accessibilityRole="button" accessibilityLabel={backAccessibilityLabel} onPress={onBack} color={palette.green}/>
        <Animated.View testID="weekly-review-navigation-title" pointerEvents="none" accessibilityElementsHidden={tabsInHeader}
          importantForAccessibility={tabsInHeader ? 'no-hide-descendants' : 'auto'} style={[styles.navigationTitleWrap, {opacity: titleOpacity}]}>
          <ThemedText weight="medium" style={styles.navigationTitle}>Your weekly review</ThemedText>
        </Animated.View>
        {onClose ? <HeaderCloseButton testID="weekly-review-close-button" accessibilityLabel="Close review" onPress={onClose}/>
          : <View style={styles.navigationAction}>
          <Ionicons name={review.status === 'completed' ? 'checkmark-circle-outline' : 'leaf-outline'} size={20} color={palette.green}/>
        </View>}
      </View>
    </View>}
    {/* One set of controls moves continuously from the hero into the navigation row. */}
    <Animated.View testID="weekly-review-moving-tabs" pointerEvents="box-none" style={[styles.tabsOverlay, {
      top: headerHeight, transform: [{translateY: tabsTranslateY}],
      paddingTop: interpolateTabs(14, 6), paddingBottom: interpolateTabs(12, 6),
    }]}>
      <Animated.View testID="weekly-review-tab-list" style={[styles.tabs, {marginHorizontal: tabsInset, padding: interpolateTabs(5, 2)}]} accessibilityRole="tablist">
        <Animated.View testID="weekly-review-tab-track" pointerEvents="none" style={[styles.tabTrack, {opacity: tabTrackOpacity}]}/>
        {([{key: 'back', label: 'Looking Back', icon: 'leaf-outline'}, {key: 'ahead', label: 'Looking Ahead', icon: 'sunny-outline'}] as const).map(item => (
          <Animated.View key={item.key} testID={`weekly-review-tab-slot-${item.key}`} style={[styles.tabSlot, {minHeight: interpolateTabs(46, 36)}]}>
            <TouchableOpacity accessibilityRole="tab" accessibilityLabel={item.label}
              accessibilityState={{selected: tab === item.key}} onPress={() => changeTab(item.key)} activeOpacity={0.8}
              hitSlop={{top: 4, bottom: 4}}
              style={[styles.tab, tab === item.key && styles.activeTab]}>
              <Animated.View style={{width: interpolateTabs(17, 0), marginRight: interpolateTabs(7, 0), opacity: interpolateTabs(1, 0), overflow: 'hidden'}}>
                <Ionicons name={item.icon} size={17} color={tab === item.key ? '#FFFFFF' : palette.green}/>
              </Animated.View>
              <ThemedText weight="semiBold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
                style={[styles.tabText, tab === item.key && styles.lightText]}>{item.label}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </Animated.View>
    </Animated.View>
    {onFinish && <View style={[styles.finishBar, {paddingBottom: Math.max(14, bottomInset)}]}>
      {saveError && <ThemedText accessibilityRole="alert" style={styles.saveError}>Couldn’t finish saving your review. Please try again.</ThemedText>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Finish weekly review" accessibilityState={{disabled: saving, busy: saving}}
        disabled={saving} onPress={onFinish} style={[styles.finishButton, saving && {opacity: 0.65}]} activeOpacity={0.8}>
        {saving && <ActivityIndicator size="small" color={Colors.hopeWhite}/>}
        <ThemedText weight="bold" style={styles.finishText}>{saving ? 'Saving…' : 'Finish review'}</ThemedText>
      </TouchableOpacity>
    </View>}
  </View>;
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.paper}, flex: {flex: 1, minWidth: 0},
  navigationSurface: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19, backgroundColor: palette.paper},
  navigationOverlay: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 22},
  navigationRow: {height: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center'},
  navigationTitleWrap: {flex: 1, alignItems: 'center'}, navigationTitle: {fontSize: 12, color: palette.green},
  navigationAction: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  tabsOverlay: {position: 'absolute', left: 0, right: 0, zIndex: 21, backgroundColor: 'transparent'}, tabsPlaceholder: {height: 82},
  hero: {minHeight: 216, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48, overflow: 'hidden'},
  landscape: {position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.72}, heroCopy: {gap: 10},
  eyebrow: {fontSize: 10, letterSpacing: 2.3, color: palette.green},
  date: {fontFamily: Fonts.lora.bold, fontSize: 30, lineHeight: 40, color: palette.ink, letterSpacing: -0.7},
  heroSubtitle: {fontSize: 13, lineHeight: 21, color: '#58685E', maxWidth: 250},
  heroBadge: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(253,253,249,0.88)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, marginTop: 3},
  heroBadgeText: {fontSize: 10, color: palette.green},
  tabs: {flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 22, gap: 4},
  tabTrack: {...StyleSheet.absoluteFillObject, borderRadius: 22, backgroundColor: palette.sage},
  tabSlot: {flex: 1, borderRadius: 18},
  tab: {flex: 1, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 7},
  activeTab: {backgroundColor: palette.green, shadowColor: '#344C3F', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2},
  tabText: {fontSize: 12, flexShrink: 1, color: palette.green}, lightText: {color: '#F8FBF4'},
  content: {paddingHorizontal: 20, gap: 14}, intro: {paddingTop: 13, paddingHorizontal: 3, paddingBottom: 8, gap: 7},
  sectionKicker: {fontSize: 9, letterSpacing: 2, color: palette.green}, sectionTitle: {fontFamily: Fonts.lora.bold, fontSize: 23, lineHeight: 31, color: palette.ink}, sectionSubtitle: {fontSize: 12, lineHeight: 19, color: palette.muted}, sectionDate: {fontSize: 10, lineHeight: 17, color: palette.green, marginTop: 1},
  card: {backgroundColor: palette.card, borderRadius: 24, borderWidth: 1, borderColor: '#ECEEE6', padding: 18, shadowColor: '#3A4F3D', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.025, shadowRadius: 10},
  cardHeading: {flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15, minHeight: 30},
  headingIcon: {width: 30, height: 30, borderRadius: 10, backgroundColor: '#EFF2E9', justifyContent: 'center', alignItems: 'center'},
  cardTitle: {flex: 1, fontSize: 15, lineHeight: 22, color: palette.ink}, edit: {minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginVertical: -5, marginRight: -8},
  body: {fontSize: 14, lineHeight: 23, color: '#4E6055'}, empty: {fontSize: 13, lineHeight: 21, color: palette.muted},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8}, chip: {borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%'}, careChip: {flexDirection: 'row', alignItems: 'center', gap: 7}, chipText: {fontSize: 13, lineHeight: 19, color: palette.ink},
  stats: {flexDirection: 'row', paddingBottom: 18, borderBottomWidth: 1, borderColor: palette.line, marginBottom: 18}, stat: {flex: 1, alignItems: 'center', paddingHorizontal: 3, gap: 5},
  statNumber: {fontFamily: Fonts.lora.bold, fontSize: 29, lineHeight: 36, color: palette.ink}, statLabel: {fontSize: 10, lineHeight: 15, color: palette.muted, textAlign: 'center'},
  chart: {flexDirection: 'row', gap: 5}, chartDay: {flex: 1, alignItems: 'center', paddingVertical: 2}, barTrack: {height: 64, width: '100%', maxWidth: 26, justifyContent: 'flex-end'}, bar: {borderRadius: 7, width: '100%'},
  dayLabel: {fontSize: 10, color: palette.muted, marginTop: 9}, dayNumber: {fontSize: 10, color: palette.green, padding: 4, overflow: 'hidden', borderRadius: 9}, selectedDay: {backgroundColor: palette.sage, fontWeight: '600'},
  chartHint: {fontSize: 11, lineHeight: 17, color: palette.muted, textAlign: 'center', marginTop: 13}, finePrint: {fontSize: 10, lineHeight: 17, color: palette.muted, marginTop: 12},
  dayDetail: {borderTopWidth: 1, borderColor: palette.line, paddingTop: 16, marginTop: 16}, detailTitle: {fontSize: 12, color: palette.green, marginBottom: 10},
  breakdownToggle: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: 7}, breakdown: {gap: 14, paddingTop: 7}, category: {gap: 6}, categoryHeading: {flexDirection: 'row', justifyContent: 'space-between'}, categoryLabel: {fontSize: 11, color: palette.green}, categoryTrack: {height: 5, borderRadius: 4, backgroundColor: '#EEF0E9', overflow: 'hidden'}, categoryFill: {height: 5, borderRadius: 4},
  lifeBar: {flexDirection: 'row', height: 9, borderRadius: 8, overflow: 'hidden', gap: 3}, lifeRow: {flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 49, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line},
  lifeLabel: {flex: 1, fontSize: 12, lineHeight: 18, color: palette.ink}, rating: {minWidth: 84, maxWidth: '43%', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11, alignItems: 'center'}, ratingText: {fontSize: 11, lineHeight: 17},
  moment: {flexDirection: 'row', gap: 10, paddingVertical: 10}, momentDot: {height: 28, width: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sage}, momentTitle: {fontSize: 13, lineHeight: 21, color: palette.ink}, meta: {fontSize: 10, color: palette.muted, lineHeight: 17, marginTop: 3, marginBottom: 6},
  writtenMemory: {paddingTop: 10}, note: {marginTop: 13}, textAction: {alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center'}, link: {fontSize: 11, color: palette.green},
  gratitudeCard: {backgroundColor: '#FBF2E9', borderColor: '#F0E7DC'}, gratitudeIcon: {backgroundColor: '#F3DED2'}, priorityCard: {backgroundColor: '#ECF1E8', borderColor: '#E1E9DB'}, priorities: {gap: 16}, priority: {flexDirection: 'row', gap: 13, alignItems: 'flex-start'}, priorityNumber: {width: 32, height: 32, borderRadius: 11, backgroundColor: '#DCE6D6', alignItems: 'center', justifyContent: 'center'}, priorityNumberText: {fontSize: 12, color: palette.green}, priorityText: {flex: 1, fontSize: 15, lineHeight: 24, color: palette.ink, paddingTop: 3},
  emotion: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15}, prayerCard: {padding: 22, backgroundColor: '#526C5B', borderRadius: 24}, prayerHeading: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16}, prayerTitle: {flex: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 23}, prayerRule: {height: 1, backgroundColor: '#758D79', marginTop: 22, marginBottom: 15}, prayerFootnote: {fontSize: 11, color: '#D7E1CF'},
  closing: {alignItems: 'center', paddingVertical: 18, gap: 11}, closingText: {fontSize: 12, lineHeight: 20, textAlign: 'center', color: palette.muted, maxWidth: 260}, completed: {fontSize: 10, textAlign: 'center', color: palette.muted},
  finishBar: {borderTopWidth: 1, borderColor: palette.line, paddingHorizontal: 20, paddingTop: 12, backgroundColor: palette.paper},
  finishButton: {width: '100%', height: 56, borderRadius: 28, backgroundColor: Colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: Colors.darkBackground, shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3},
  finishText: {fontSize: 16, color: Colors.hopeWhite}, saveError: {fontSize: 12, color: '#A74B43', textAlign: 'center', paddingBottom: 10},
});
