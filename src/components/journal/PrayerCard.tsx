import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Sparkle} from 'lucide-react-native';
import { format } from 'date-fns';

import ThemedText from '../common/ThemedText';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { useMomentsPalette } from '../../context/MomentsPaletteContext';
import { trackingStatus, isTrackedPrayer, isPrayerLetGo, prayerNeeds, type PrayerUpdate } from '../../utils/prayerTracking';
import { triggerLightHaptic } from '../../utils/haptics';
import { PrayerApiEntry } from '../../services/api/prayerApi';

export type PrayerHomeEntry = PrayerApiEntry & {
  groupedEntries?: PrayerApiEntry[];
};

const formatStarted = (dateString?: string | null) => {
  if (!dateString) { return ''; }
  try {
    const date = new Date(dateString.length === 10 ? `${dateString}T12:00:00` : dateString);
    return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy').toUpperCase();
  } catch {
    return '';
  }
};

const CAST_ORDER = ['confession', 'adoration', 'supplication', 'thanksgiving'];

const PrayerCard = ({
  prayer,
  onPrayAgain,
  onAddPrayer,
  onManage,
  onEdit,
  onManageAnswers,
  onAnswered,
  onRelease,
  answering,
}: {
  prayer: PrayerHomeEntry;
  onPrayAgain?: (prayer: PrayerHomeEntry) => void;
  onAddPrayer?: (prayer: PrayerHomeEntry) => void;
  onManage?: (prayer: PrayerHomeEntry) => void;
  onEdit?: (prayer: PrayerHomeEntry) => void;
  onManageAnswers?: (prayer: PrayerHomeEntry) => void;
  onAnswered?: (prayer: PrayerHomeEntry, needId?: string) => void;
  onRelease?: (prayer: PrayerHomeEntry) => void;
  answering: boolean;
}) => {
  const momentsPalette = useMomentsPalette();
  const state = trackingStatus(prayer);
  const tracked = isTrackedPrayer(prayer);
  const isAnswered = state === 'answered';
  const isPrayerRequest = prayer.is_prayer_request === true;
  const isCast = prayer.metadata?.prayer_style === 'cast' || (prayer.groupedEntries || []).some((e: any) => e.metadata?.prayer_style === 'cast');
  const isOpen = prayer.metadata?.prayer_style === 'open' || prayer.journal_category === 'personal_prayer';
  const isWeeklyReviewPrayer = prayer.metadata?.source === 'weekly_review'
    || prayer.metadata?.weeklyReviewId
    || prayer.metadata?.tags?.includes?.('weekly');
  const hasRequestOrigin = !!prayer.metadata?.original_request_id || !!prayer.metadata?.original_request_content || !!prayer.metadata?.prayer_request_display;
  const typeLabel = prayer.metadata?.prayer_need ? 'PRAYER NEED'
    : isPrayerRequest ? prayer.prayed ? 'PRAYED FOR' : 'PRAYER REQUEST'
      : isAnswered && hasRequestOrigin ? 'ANSWERED'
        : isPrayerLetGo(prayer) && hasRequestOrigin ? 'LET GO'
          : hasRequestOrigin ? 'PRAYED FOR'
            : isCast ? 'CAST PRAYER'
              : isOpen ? isWeeklyReviewPrayer ? 'WEEKLY · OPEN PRAYER' : 'OPEN PRAYER' : 'PRAYED FOR';
  const title = prayer.metadata?.prayer_need
    ? prayer.person_name || prayer.content?.split('\n')[0] || 'My prayer need'
    : isCast ? 'CAST Prayer' : isOpen ? 'Open Prayer' : prayer.person_name || 'Prayer';
  const [showHistory, setShowHistory] = useState(false);
  const history: PrayerUpdate[] = Array.isArray(prayer.metadata?.prayer_updates) ? [...(prayer.metadata?.prayer_updates || [])].reverse() : [];
  const latestUpdate = history.find(update => !update.status);
  const body = prayer.content || '';
  const notes = prayer.notes?.trim() || '';
  const needs = prayerNeeds(prayer);
  const savedTopics = prayer.metadata?.topics;
  const topics = Array.isArray(savedTopics) ? savedTopics.filter(Boolean) : [...new Set(needs.map(need => need.topic).filter(Boolean))];
  const seenCastSections = new Set<string>();
  const castSections = isCast ? (prayer.groupedEntries || [prayer]).map(entry => {
    const category = entry.journal_category || '';
    const text = entry.content || entry.notes || '';
    // Older entries may already include their own heading. Display it once as a label.
    const content = CAST_ORDER.includes(category)
      ? text.replace(new RegExp('^(?:\\s*' + category + '[ \\t]*:?\\s*(?:\\r?\\n|$))+' , 'i'), '').trim()
      : text.trim();
    return { id: entry.id, label: CAST_ORDER.includes(category) ? category.toUpperCase() : '', content };
  }).filter(section => {
    if (!section.content) return false;
    const key = section.label || section.id;
    if (seenCastSections.has(key)) return false;
    seenCastSections.add(key);
    return true;
  }) : [];
  const prayerCount = prayer.prayer_count ?? (prayer.prayed ? 1 : 0);

  const needsPrayer = isPrayerRequest && !prayer.prayed && state === 'pending';
  const requestContext = !isPrayerRequest
    ? prayer.metadata?.prayer_request_display || prayer.metadata?.original_request_content
    : undefined;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => onEdit?.(prayer)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
        <View style={styles.prayerTypeRow}>
          {isOpen ? <Ionicons name="chatbubble-outline" size={14} color={Colors.sage} /> : <Ionicons name={isPrayerRequest ? 'mail-unread-outline' : isCast ? 'layers-outline' : 'heart-outline'} size={14} color={Colors.sage} />}
          <ThemedText weight="semiBold" style={styles.cardMeta}>{typeLabel}</ThemedText>
          {!momentsPalette && <ThemedText style={styles.cardDate}>{formatStarted(isWeeklyReviewPrayer ? prayer.selected_date : prayer.created_at)}</ThemedText>}
        </View>
        <ThemedText weight="bold" style={styles.cardTitle}>{title}</ThemedText>
        {prayer.metadata?.prayer_need && topics.length > 0 && <ThemedText weight="semiBold" style={styles.needTopics}>{topics.join(' · ').toUpperCase()}</ThemedText>}
        {isCast ? castSections.map(section => <View key={section.id} style={styles.castSection}>
          {!!section.label && <ThemedText weight="semiBold" style={styles.castLabel}>{section.label}</ThemedText>}
          <ThemedText style={[styles.cardBody, styles.castBody]} numberOfLines={2}>{section.content}</ThemedText>
        </View>) : prayer.metadata?.prayer_need
          ? !!notes && <ThemedText style={styles.cardBody} numberOfLines={4}>{notes}</ThemedText>
          : !!body && !body.startsWith(title) && <ThemedText style={styles.cardBody} numberOfLines={3}>{body}</ThemedText>}
        {prayer.metadata?.prayer_need && !momentsPalette && <ThemedText style={styles.needDates}>Praying since {formatStarted(prayer.metadata?.praying_since || prayer.selected_date)}{needs.length === 1 && needs[0].expectedDate ? ` · On or before ${formatStarted(needs[0].expectedDate)}` : ''}</ThemedText>}
        {!!requestContext && (
          <View style={styles.requestContext}>
            <Ionicons name="mail-unread-outline" size={12} color={Colors.alertCoral} />
            <ThemedText style={styles.requestContextText} numberOfLines={3}>Prayer Request · {requestContext}</ThemedText>
          </View>
        )}
      </TouchableOpacity>
      {latestUpdate && !showHistory && <View style={styles.updatePreview}>
        <ThemedText weight="semiBold" style={styles.updateLabel}>{latestUpdate.kind === 'answered' ? 'GOD ANSWERED' : latestUpdate.kind === 'situation-changed' ? 'SITUATION CHANGED' : 'LATEST UPDATE'} · {formatStarted(latestUpdate.date)}</ThemedText>
        <ThemedText style={styles.updateText} numberOfLines={3}>{latestUpdate.text}</ThemedText>
      </View>}
      {showHistory && history.map((update, index) => <View key={update.id || `${update.date}-${index}`} style={styles.updatePreview}>
        <ThemedText weight="semiBold" style={styles.updateLabel}>{formatStarted(update.date)}{update.needId ? ` · ${prayerNeeds(prayer).find(need => need.id === update.needId)?.text || 'Prayer need'}` : ''}</ThemedText>
        <ThemedText style={styles.updateText}>{update.text}</ThemedText>
      </View>)}
      {history.length > 0 && <TouchableOpacity style={styles.historyToggle} onPress={() => { triggerLightHaptic(); setShowHistory(!showHistory); }} accessibilityRole="button" accessibilityState={{ expanded: showHistory }}>
        <ThemedText weight="semiBold" style={styles.actionButtonText}>{showHistory ? 'Hide history' : `View history (${history.length})`}</ThemedText>
        <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.sage} />
      </TouchableOpacity>}
      {tracked && needs.length > 1 && onAnswered && needs.map(need => <View key={need.id} style={styles.castSection}><ThemedText style={styles.cardBody}>{need.text}</ThemedText><ThemedText style={styles.cardMeta}>{need.status === 'pending' ? 'Still praying' : need.status === 'answered' ? 'Answered' : 'Let go'}</ThemedText><TouchableOpacity disabled={answering} style={[styles.actionButton, { alignSelf: 'flex-start', marginVertical: 8 }]} onPress={() => onAnswered(prayer, need.id)}><Ionicons name="checkmark-circle-outline" size={14} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.actionButtonText}>{need.status === 'answered' ? 'Answered' : 'Mark answered'}</ThemedText></TouchableOpacity></View>)}
      {needsPrayer && onAddPrayer ? (
        <View style={styles.requestActionContainer}>
          <TouchableOpacity style={styles.requestPrayButton} onPress={() => onAddPrayer(prayer)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.sage} />
            <ThemedText weight="medium" style={styles.requestPrayText}>Pray now</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardActions}>
          {!isAnswered && !isPrayerLetGo(prayer) && onPrayAgain && <TouchableOpacity style={[styles.actionButton, styles.cardActionButton]} onPress={() => onPrayAgain(prayer)} activeOpacity={0.7}>
            <PrayerHandsIcon size={14} color={Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText]} numberOfLines={1}>Pray again</ThemedText>
          </TouchableOpacity>}
          {onManage && <TouchableOpacity style={[styles.actionButton, styles.cardActionButton]} onPress={() => onManage(prayer)} activeOpacity={0.7}>
            <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText]} numberOfLines={1}>{hasRequestOrigin && (isAnswered || isPrayerLetGo(prayer)) ? 'View journey' : tracked ? 'Update' : 'Keep praying'}</ThemedText>
          </TouchableOpacity>}
          {tracked && !isAnswered && onRelease && <TouchableOpacity style={[styles.actionButton, styles.cardActionButton]} onPress={() => onRelease(prayer)} activeOpacity={0.7}>
            <Ionicons name={state === 'closed' ? 'refresh-outline' : 'leaf-outline'} size={14} color={Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText]} numberOfLines={1}>{state === 'closed' ? 'Return' : 'Let go'}</ThemedText>
          </TouchableOpacity>}
        </View>
      )}
      {onAnswered && tracked && !needsPrayer && (
        <TouchableOpacity
          disabled={answering}
          style={[styles.releaseButton, isAnswered && styles.releaseButtonActive]}
          onPress={() => (onManageAnswers && prayerNeeds(prayer).length > 1) ? onManageAnswers(prayer) : onAnswered(prayer, prayerNeeds(prayer)[0]?.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={needs.length > 1 ? 'Manage answers' : isAnswered ? 'Answered' : 'Mark answered'}>
          <Sparkle size={15} color={isAnswered ? Colors.hopeWhite : Colors.sage} strokeWidth={1.8} />
          <ThemedText weight="semiBold" style={[styles.releaseButtonText, isAnswered && styles.releaseButtonTextActive]}>
            {needs.length > 1 ? 'Manage answers' : isAnswered ? 'Answered' : 'Mark answered'}
          </ThemedText>
        </TouchableOpacity>
      )}
      {!needsPrayer && (
        <ThemedText style={styles.prayedMeta}>
          {!tracked ? 'Saved prayer · Not tracked' : isAnswered ? 'Answered' : state === 'closed' ? 'Let go' : 'Still praying'}{prayerCount > 0 ? ` · Prayed ${prayerCount} ${prayerCount === 1 ? 'time' : 'times'}` : ''}{prayer.answered_date && isAnswered ? ` · ${formatStarted(prayer.answered_date)}` : ''}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.inputBorder,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  updatePreview: { borderLeftWidth: 2, borderLeftColor: Colors.sageMuted, paddingLeft: 12, marginBottom: 12 },
  updateLabel: { color: Colors.sageMuted, fontSize: 9, lineHeight: 14, letterSpacing: 1.2, marginBottom: 5 },
  updateText: { color: Colors.text, fontSize: 13, lineHeight: 20 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  prayerTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  cardDate: { marginLeft: 'auto', color: Colors.textGray, fontSize: 10, lineHeight: 15 },
  castSection: { marginTop: 8 },
  castLabel: { color: Colors.sageMuted, fontSize: 9, lineHeight: 13, letterSpacing: 1.2, marginBottom: 4 },
  castBody: { marginBottom: 8 },
  requestContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(217, 120, 114, 0.28)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  requestContextText: { flex: 1, color: Colors.textGray, fontSize: 13, lineHeight: 18 },
  requestActionContainer: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 4, paddingTop: 12 },
  requestPrayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  requestPrayText: { color: Colors.sage, fontSize: 14, lineHeight: 20 },
  releaseButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 6,
    borderRadius: 19,
    backgroundColor: Colors.actionBackground,
  },
  releaseButtonText: {color: Colors.sage, fontSize: 11, lineHeight: 16},
  releaseButtonActive: {backgroundColor: Colors.sage},
  releaseButtonTextActive: {color: Colors.hopeWhite},
  cardMeta: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.7,
    marginBottom: 0,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
    fontFamily: Fonts.bold,
  },
  cardBody: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    fontFamily: Fonts.regular,
  },
  needTopics: { color: Colors.sageMuted, fontSize: 9, lineHeight: 14, letterSpacing: 1.2, marginBottom: 8 },
  needDates: { color: Colors.textGray, fontSize: 11, lineHeight: 17, marginBottom: 12 },
  prayedMeta: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  cardActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 5,
  },
  cardActionButton: { flex: 1, flexBasis: 0, minWidth: 0, justifyContent: 'center', paddingHorizontal: 5, gap: 4 },
  cardActionText: { flexShrink: 1, fontSize: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: 'transparent',
  },
  actionButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  actionButtonText: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Fonts.semiBold,
  },
  actionButtonTextActive: {
    color: Colors.hopeWhite,
  },
});

export default PrayerCard;
