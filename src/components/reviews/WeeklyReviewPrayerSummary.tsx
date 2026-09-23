import React, {useMemo, useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import type {ReviewPrayerSnapshotItem} from '../../storage/reviewStorage';
import type {PrayerReviewEventType} from '../../services/prayerReviewService';
import {fromLocalDateString} from '../../utils/date';
import {triggerLightHaptic} from '../../utils/haptics';

type GroupKey = 'changes' | 'brought' | 'carrying' | 'other';
type EventPresentation = {group: GroupKey; label: string};

const EVENTS: Record<PrayerReviewEventType, EventPresentation> = {
  new_prayer: {group: 'brought', label: 'Prayer'},
  request_received: {group: 'brought', label: 'Request received'},
  request_prayed_for: {group: 'brought', label: 'Prayed for a request'},
  thanksgiving: {group: 'brought', label: 'A prayer of thanks'},
  answer_recorded: {group: 'changes', label: 'Answer recorded'},
  need_answer_recorded: {group: 'changes', label: 'Prayer need answered'},
  update: {group: 'changes', label: 'Prayer update'},
  let_go: {group: 'changes', label: 'Let go'},
  return_to_prayer: {group: 'changes', label: 'Returned to prayer'},
  still_carrying: {group: 'carrying', label: 'Still carrying'},
};

const GROUPS: {key: GroupKey; title: string; icon: string; color: string; tint: string}[] = [
  {key: 'changes', title: 'Answers & changes', icon: 'leaf-outline', color: '#526F5D', tint: '#EAF0E5'},
  {key: 'brought', title: 'Brought to God', icon: 'prayer', color: '#8A6C4D', tint: '#F4EDE2'},
  {key: 'carrying', title: 'Still carrying', icon: 'heart-outline', color: '#876C68', tint: '#F5EAE6'},
  {key: 'other', title: 'More from prayer', icon: 'chatbubble-ellipses-outline', color: '#687B79', tint: '#EBF0ED'},
];

const PRAYER_TYPE_LABELS: Record<string, string> = {
  'PRAYER': 'Prayer',
  'PRAYER NEED': 'Prayer Need',
  'CAST PRAYER': 'CAST Prayer',
  'PRAYED FOR': 'Prayer for Someone',
  'BIBLE STUDY PRAYER': 'Bible Study Prayer',
  'PLAYBOOK PRAYER': 'Playbook Prayer',
  'DEVOTIONAL PRAYER': 'Devotional Prayer',
  'OPEN PRAYER': 'Open Prayer',
  'GUIDED PRAYER': 'Guided Prayer',
  'THANKSGIVING PRAYER': 'A prayer of thanks',
  'ADORATION PRAYER': 'Adoration Prayer',
  'CONFESSION PRAYER': 'Confession Prayer',
  'SUPPLICATION PRAYER': 'Supplication Prayer',
};

const prayerTypeLabel = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim().toLocaleUpperCase();
  if (!normalized) {return fallback;}
  return PRAYER_TYPE_LABELS[normalized]
    || normalized.toLocaleLowerCase().replace(/(^|[\s·/-])([a-z])/g, (_match, separator, letter) => `${separator}${letter.toLocaleUpperCase()}`);
};

const presentationFor = (item: ReviewPrayerSnapshotItem): EventPresentation => {
  if (item.eventType === 'new_prayer') {
    return {group: 'brought', label: prayerTypeLabel(item.prayerTypeLabel, 'Prayer')};
  }
  if (item.eventType === 'thanksgiving') {
    return {group: 'brought', label: prayerTypeLabel(item.prayerTypeLabel, 'A prayer of thanks')};
  }
  return Object.prototype.hasOwnProperty.call(EVENTS, item.eventType)
    ? EVENTS[item.eventType as PrayerReviewEventType]
    : {group: 'other', label: item.subtitle.trim() || 'Prayer moment'};
};

const formatDate = (value: string) => {
  const date = fromLocalDateString(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
};

const PREVIEW_COUNT = 2;
const EXCERPT_LENGTH = 140;

const PrayerMoment = ({item, color, tint, last}: {
  item: ReviewPrayerSnapshotItem; color: string; tint: string; last: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const title = item.title.trim() || 'Prayer';
  const text = item.text?.trim() || '';
  // Generated prayer titles often repeat the first line of the prayer itself.
  const repeatsTitle = text === title || text.startsWith(`${title}\n`) || (title.endsWith('…') && text.startsWith(title.slice(0, -1)));
  const hasDetails = !!text && (repeatsTitle ? text !== title : text.length > EXCERPT_LENGTH);
  const longTitle = title.length > EXCERPT_LENGTH;
  const expandable = hasDetails || longTitle;
  const preview = text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trim()}…` : text;
  const date = formatDate(item.eventDate);

  return <View style={styles.moment}>
    <View style={styles.rail} accessible={false}>
      <View style={[styles.dot, {backgroundColor: color, borderColor: tint}]}/>
      {!last && <View style={styles.connector}/>}
    </View>
    <View style={[styles.momentContent, last && styles.lastMoment]}>
      <View style={styles.eventMeta}>
        <ThemedText weight="medium" style={[styles.eventLabel, {color}]}>{presentationFor(item).label}</ThemedText>
        <ThemedText style={styles.date}>{item.eventType === 'still_carrying' ? `As of ${date}` : date}</ThemedText>
      </View>
      <ThemedText weight="medium" style={styles.title}>{expanded && repeatsTitle ? text : !expanded && longTitle ? `${title.slice(0, EXCERPT_LENGTH).trim()}…` : title}</ThemedText>
      {!!text && !repeatsTitle && <ThemedText style={styles.body}>{expanded ? text : preview}</ThemedText>}
      {expandable && <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Read less of' : 'Read full prayer moment for'} ${title}, ${date}`}
        accessibilityState={{expanded}}
        activeOpacity={0.7}
        style={styles.readButton}
        onPress={() => {triggerLightHaptic(); setExpanded(value => !value);}}>
        <ThemedText weight="medium" style={styles.readLabel}>{expanded ? 'Read less' : 'Read more'}</ThemedText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#526F5D"/>
      </TouchableOpacity>}
    </View>
  </View>;
};

export const WeeklyReviewPrayerSummary = ({items}: {items: ReviewPrayerSnapshotItem[]}) => {
  const [expandedGroups, setExpandedGroups] = useState<Partial<Record<GroupKey, boolean>>>({});
  const groups = useMemo(() => GROUPS.map(group => ({
    ...group,
    items: items.filter(item => presentationFor(item).group === group.key)
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
  })).filter(group => group.items.length > 0), [items]);

  if (!items.length) {return null;}

  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.headingIcon}><PrayerHandsIcon size={24} color="#526F5D"/></View>
      <View style={styles.headingText}>
        <ThemedText weight="semiBold" accessibilityRole="header" style={styles.headingTitle}>What happened in prayer</ThemedText>
        <ThemedText style={styles.subtitle}>The prayers and changes you recorded.</ThemedText>
      </View>
    </View>
    {groups.map(group => {
      const expanded = !!expandedGroups[group.key];
      const visible = expanded ? group.items : group.items.slice(0, PREVIEW_COUNT);
      return <View key={group.key} style={styles.group}>
        <View style={styles.groupHeading}>
          <View style={[styles.groupIcon, {backgroundColor: group.tint}]}>
            {group.icon === 'prayer' ? <PrayerHandsIcon size={17} color={group.color}/> : <Ionicons name={group.icon} size={17} color={group.color}/>}
          </View>
          <ThemedText weight="semiBold" accessibilityRole="header" style={styles.groupTitle}>{group.title}</ThemedText>
          <View style={[styles.count, {backgroundColor: group.tint}]}>
            <ThemedText weight="medium" accessibilityLabel={`${group.items.length} saved prayer ${group.items.length === 1 ? 'moment' : 'moments'}`} style={[styles.countText, {color: group.color}]}>{group.items.length}</ThemedText>
          </View>
        </View>
        {visible.map((item, index) => <PrayerMoment key={item.id} item={item} color={group.color} tint={group.tint} last={index === visible.length - 1}/>)}
        {group.items.length > PREVIEW_COUNT && <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Show fewer' : `Show all ${group.items.length}`} ${group.title.toLowerCase()} prayer moments`}
          accessibilityState={{expanded}}
          activeOpacity={0.7}
          style={[styles.moreButton, {backgroundColor: group.tint}]}
          onPress={() => {triggerLightHaptic(); setExpandedGroups(value => ({...value, [group.key]: !value[group.key]}));}}>
          <ThemedText weight="medium" style={[styles.moreLabel, {color: group.color}]}>{expanded ? 'Show less' : `Show ${group.items.length - PREVIEW_COUNT} more`}</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={group.color}/>
        </TouchableOpacity>}
      </View>;
    })}
  </View>;
};

const styles = StyleSheet.create({
  card: {backgroundColor: '#FDFDF9', borderRadius: 24, borderWidth: 1, borderColor: '#ECEEE6', shadowColor: '#3A4F3D', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.025, shadowRadius: 10},
  heading: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingVertical: 22},
  headingIcon: {width: 42, height: 42, borderRadius: 15, backgroundColor: '#EFF2E9', alignItems: 'center', justifyContent: 'center'},
  headingText: {flex: 1},
  headingTitle: {fontSize: 16, lineHeight: 23, color: '#293D35'},
  subtitle: {fontSize: 12, lineHeight: 19, color: '#748078', marginTop: 4},
  group: {padding: 18, borderTopWidth: 1, borderTopColor: '#ECEEE6'},
  groupHeading: {flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16},
  groupIcon: {width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  groupTitle: {flex: 1, fontSize: 14, lineHeight: 21, color: '#34493E'},
  count: {minWidth: 26, minHeight: 26, borderRadius: 13, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center'},
  countText: {fontSize: 12, lineHeight: 19},
  moment: {flexDirection: 'row', gap: 12},
  rail: {width: 14, alignItems: 'center', paddingTop: 5},
  dot: {width: 12, height: 12, borderRadius: 6, borderWidth: 3},
  connector: {flex: 1, width: 1, backgroundColor: '#E6E9E1', marginTop: 5, marginBottom: -1},
  momentContent: {flex: 1, paddingBottom: 22},
  lastMoment: {paddingBottom: 0},
  eventMeta: {flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 2, marginBottom: 5},
  eventLabel: {fontSize: 11, lineHeight: 18, flexShrink: 1},
  date: {fontSize: 11, lineHeight: 18, color: '#748078'},
  title: {fontSize: 14, lineHeight: 22, color: '#293D35'},
  body: {fontSize: 13, lineHeight: 21, color: '#617068', marginTop: 5},
  readButton: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 44},
  readLabel: {fontSize: 12, lineHeight: 19, color: '#526F5D'},
  moreButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10},
  moreLabel: {fontSize: 12, lineHeight: 19},
});
