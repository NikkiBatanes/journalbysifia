import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import { Pencil } from 'lucide-react-native';

import ThemedText from '../../components/common/ThemedText';
import ShareComposer, { MorningSummaryShareData } from '../../components/TruthToCarryShareComposer';
import { FOCUS_CATEGORIES } from '../../components/journal/TodaysFocusExperience';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import { fromLocalDateString, toLocalDateString } from '../../utils/date';
import { exitEveningFlow } from '../../navigation/exitEveningFlow';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { getLocalJournalSingleton, getLocalJournalEntries } from '../../storage/journalStorage';
import { getDailyClosingMessage } from '../../services/dailyClosingMessageService';
import { getLocalReflection } from '../../storage/reflectionStorage';
import { getScripturePassage } from '../../services/scriptureReaderService';
import {resolveSavedPsalmNumber} from '../../services/dailyScriptureSequence';

const SummaryIcon = ({ icon, iconType }: { icon?: string; iconType?: 'ionicons' | 'material' | 'fontawesome' }) => {
  if (!icon || !iconType) { return null; }
  if (iconType === 'material') {
    return <MaterialCommunityIcons name={icon as any} size={18} color={Colors.sage} />;
  }
  if (iconType === 'fontawesome') {
    return <FontAwesome6 name={icon as any} size={17} color={Colors.sage} />;
  }
  return <Ionicons name={icon as any} size={18} color={Colors.sage} />;
};

const MorningClosingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { completeRoutine, selectedDate, contentRefs, completed, routine } = useRoutine();
  const params = route.params ?? {};
  const [shareComposerOpen, setShareComposerOpen] = useState(false);

  const date = fromLocalDateString(selectedDate);
  const dateStr = toLocalDateString(date);
  const dailyMessage = useMemo(() => getDailyClosingMessage({
    userId: user?.id,
    date: dateStr,
    flow: 'morning',
  }), [dateStr, user?.id]);

  const [summary, setSummary] = useState({
    feeling: params.feeling,
    feelingIcon: params.feelingIcon,
    feelingIconType: params.feelingIconType,
    underneath: params.underneath,
    feelingScriptureText: '',
    feelingScriptureReference: '',
    feelingScriptureVersion: '',
    focus: params.focus,
    focusIcon: params.focusIcon,
    focusIconType: params.focusIconType,
    personalText: params.personalText,
    priorities: [] as string[],
    topTodos: [] as string[],
    psalmNumber: params.psalmNumber,
    psalmRead: params.psalmRead,
    selectedAttributes: params.selectedAttributes ?? [],
    customAttribute: params.customAttribute ?? '',
    carry: params.carry,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const next = { ...summary };

      const checkInRef = contentRefs.morning_check_in;
      const checkInId = checkInRef && !Array.isArray(checkInRef) ? checkInRef.local_id : undefined;
      if (checkInId) {
        const checkInEntry = await getLocalJournalSingleton('morning_check_in', dateStr);
        if (checkInEntry) {
          const parsed = typeof checkInEntry.content === 'string'
            ? JSON.parse(checkInEntry.content)
            : checkInEntry.content;
          next.feeling = parsed.feeling ?? next.feeling;
          next.feelingIcon = parsed.feelingIcon ?? next.feelingIcon;
          next.feelingIconType = parsed.feelingIconType ?? next.feelingIconType;
          next.underneath = parsed.underneathIt ?? next.underneath;
          if (parsed.scripture?.reference) {
            const passage = await getScripturePassage(parsed.scripture.reference, parsed.scripture.translation).catch(() => null);
            next.feelingScriptureText = passage
              ? (passage.verses?.length
                ? passage.verses.map(verse => verse.lines.join('\n')).join('\n')
                : passage.text)
              : '';
            next.feelingScriptureReference = passage?.reference || parsed.scripture.reference;
            next.feelingScriptureVersion = passage?.version || parsed.scripture.translation || '';
          }
        }
      }

      const focusRef = contentRefs.todays_focus;
      if (focusRef && !Array.isArray(focusRef)) {
        const focusEntry = await getLocalJournalSingleton('todays_focus', dateStr);
        if (focusEntry) {
          const parsed = typeof focusEntry.content === 'string'
            ? JSON.parse(focusEntry.content)
            : focusEntry.content;
          next.focus = parsed.focus || parsed.focusCategory;
          next.personalText = parsed.personalText;
          next.priorities = (parsed.priorities || []).map((p: any) => p.text || '');

          if (parsed.focusIcon && parsed.focusIconType) {
            next.focusIcon = parsed.focusIcon;
            next.focusIconType = parsed.focusIconType;
          } else if (parsed.focusCategory) {
            const category = FOCUS_CATEGORIES.find(c => c.id === parsed.focusCategory);
            if (category) {
              next.focusIcon = category.icon;
              next.focusIconType = category.iconType;
            }
          }
        }
      }

      const todoRef = contentRefs.todos;
      const todoIds = Array.isArray(todoRef) ? todoRef.map(r => r.local_id) : todoRef ? [todoRef.local_id] : [];
      if (todoIds.length > 0) {
        const entries = await getLocalJournalEntries('todo', dateStr);
        next.topTodos = entries
          .filter(e => todoIds.includes(e.id))
          .map(e => {
            const parsed = typeof e.content === 'string' ? JSON.parse(e.content) : e.content;
            return parsed.text || '';
          });
      }

      const psalmRef = contentRefs.psalm;
      const psalmId = Array.isArray(psalmRef) ? psalmRef[0]?.local_id : psalmRef?.local_id;
      if (psalmId) {
        const psalmEntry = await getLocalReflection(psalmId, 'scripture', dateStr);
        if (psalmEntry?.metadata) {
          next.psalmNumber = resolveSavedPsalmNumber(psalmEntry, Number(psalmEntry.metadata.psalmNumber) || next.psalmNumber || 1);
          next.psalmRead = psalmEntry.metadata.psalmRead ?? next.psalmRead;
          next.selectedAttributes = psalmEntry.metadata.selectedAttributes ?? next.selectedAttributes;
          next.customAttribute = psalmEntry.metadata.customAttribute ?? next.customAttribute;
          next.carry = psalmEntry?.content || psalmEntry.metadata.carry || next.carry;
        }
      }

      if (mounted) {setSummary(next);}
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRefs, dateStr]);

  const priorityCountLabel = `${summary.priorities.length} ${summary.priorities.length === 1 ? 'priority' : 'priorities'}`;
  const todoCountLabel = `${summary.topTodos.length} ${summary.topTodos.length === 1 ? 'to-do' : 'to-dos'}`;
  const psalmObservations = [
    ...summary.selectedAttributes,
    summary.customAttribute,
  ].filter((observation): observation is string => Boolean(observation?.trim()));
  const feelingVerseReference = [summary.feelingScriptureReference, summary.feelingScriptureVersion].filter(Boolean).join(' · ');
  const morningShareData: MorningSummaryShareData = {
    feeling: summary.feeling,
    feelingIcon: summary.feelingIcon,
    feelingIconType: summary.feelingIconType,
    feelingVerse: summary.feelingScriptureText,
    feelingVerseReference,
    focus: summary.focus,
    focusIcon: summary.focusIcon,
    focusIconType: summary.focusIconType,
    focusReflection: summary.personalText,
    prioritiesCount: summary.priorities.length,
    todosCount: summary.topTodos.length,
    psalmNumber: summary.psalmNumber,
    psalmRead: summary.psalmRead,
    observations: psalmObservations,
    reminder: dailyMessage,
  };
  const morningShareText = [
    'You’re ready for today.',
    `Feeling: ${summary.feeling || '—'}`,
    summary.feelingScriptureText ? `“${summary.feelingScriptureText}”\n${feelingVerseReference}` : '',
    `Focus: ${summary.focus || 'Open'}${summary.personalText ? `\n${summary.personalText}` : ''}`,
    `${priorityCountLabel} · ${todoCountLabel}`,
    `${summary.psalmNumber ? `Psalm ${summary.psalmNumber}` : 'Morning Psalm'} — ${summary.psalmRead ? 'Full chapter read' : 'Reading in progress'}`,
    `Pause and Praise: ${psalmObservations.length ? psalmObservations.join(' · ') : 'Nothing selected'}`,
    dailyMessage,
  ].filter(Boolean).join('\n\n');

  const onDone = async () => {
    triggerLightHaptic();

    if (completed) {
      exitEveningFlow(navigation, 'Today');
      return;
    }

    try {
      await completeRoutine();
    } catch (error) {
      console.error('Error saving morning routine state:', error);
      return;
    }

    DeviceEventEmitter.emit('reflection_saved', { type: 'morning_complete', date: dateStr });
    exitEveningFlow(navigation, 'Moments');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[styles.shareButton, { top: insets.top + 8 }]}
        onPress={() => {
          triggerLightHaptic();
          setShareComposerOpen(true);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Share morning routine"
      >
        <Ionicons name="paper-plane-outline" size={17} color={Colors.sage} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.editButton, { top: insets.top + 8 }]}
        onPress={() => {
          triggerLightHaptic();
          const firstStep = routine === 'evening' ? 'Gratitude' : 'EmotionCheckIn';
          navigation.navigate(firstStep);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Edit morning routine"
      >
        <Pencil size={17} color={Colors.sage} strokeWidth={1.8} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.completionHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="sunny-outline" size={26} color={Colors.hopeWhite} />
          </View>
          <View style={styles.completionHeaderText}>
            <ThemedText style={styles.title}>You’re ready for today.</ThemedText>
            <ThemedText style={styles.subtitle}>Your morning reflection is saved.</ThemedText>
          </View>
        </View>

        <View style={styles.glanceSection}>
          <ThemedText weight="semiBold" style={styles.sectionEyebrow}>TODAY AT A GLANCE</ThemedText>
          <View style={styles.glanceGrid}>
            <TouchableOpacity
              style={[styles.glanceColumn, styles.glanceColumnBorder]}
              onPress={() => { triggerLightHaptic(); navigation.navigate('EmotionCheckIn'); }}
              accessibilityRole="button"
              accessibilityLabel="Edit morning check-in"
              activeOpacity={0.75}
            >
              <ThemedText style={styles.glanceLabel}>Feeling</ThemedText>
              <View style={styles.valueWithIcon}>
                <SummaryIcon icon={summary.feelingIcon} iconType={summary.feelingIconType} />
                <ThemedText weight="semiBold" style={styles.glanceValue}>{summary.feeling || '—'}</ThemedText>
              </View>
              {summary.feelingScriptureText ? (
                <>
                  <ThemedText numberOfLines={4} style={styles.feelingScriptureText}>
                    “{summary.feelingScriptureText}”
                  </ThemedText>
                  <ThemedText numberOfLines={1} weight="medium" style={styles.feelingScriptureReference}>
                    {summary.feelingScriptureReference}{summary.feelingScriptureVersion ? ` · ${summary.feelingScriptureVersion}` : ''}
                  </ThemedText>
                </>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.glanceColumn}
              onPress={() => { triggerLightHaptic(); navigation.navigate('TodaysFocus'); }}
              accessibilityRole="button"
              accessibilityLabel="Edit today's focus"
              activeOpacity={0.75}
            >
              <ThemedText style={styles.glanceLabel}>Focus</ThemedText>
              <View style={styles.valueWithIcon}>
                <SummaryIcon icon={summary.focusIcon} iconType={summary.focusIconType} />
                <ThemedText weight="semiBold" style={styles.glanceValue}>{summary.focus || 'Open'}</ThemedText>
              </View>
              {summary.personalText ? (
                <ThemedText style={styles.focusReflection}>{summary.personalText}</ThemedText>
              ) : null}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.todayCount}
            onPress={() => { triggerLightHaptic(); navigation.navigate('Todos'); }}
            accessibilityRole="button"
            accessibilityLabel="Edit priorities and to-dos"
            activeOpacity={0.75}
          >
            <ThemedText style={styles.glanceLabel}>Today</ThemedText>
            <ThemedText weight="semiBold" style={styles.todayCountValue}>
              {priorityCountLabel} · {todoCountLabel}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.psalmCard}
          onPress={() => {
            triggerLightHaptic();
            navigation.navigate('PsalmOfTheDay', {
              returnToClosing: true,
              selectedAttributes: summary.selectedAttributes,
              customAttribute: summary.customAttribute,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit pause and praise response"
          activeOpacity={0.75}
        >
          <View style={styles.psalmHeader}>
            <ThemedText weight="semiBold" style={styles.sectionEyebrow}>MORNING PSALM</ThemedText>
            <ThemedText weight="bold" style={styles.psalmTitle}>
              {summary.psalmNumber ? `Psalm ${summary.psalmNumber}` : 'Psalm'}
            </ThemedText>
          </View>

          <View style={styles.readStatus}>
            <View style={[styles.readStatusIcon, !summary.psalmRead && styles.readStatusIconInactive]}>
              {summary.psalmRead ? <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} /> : <MaterialCommunityIcons name="progress-star" size={14} color={Colors.sage} />}
            </View>
            <ThemedText weight="semiBold" style={styles.readStatusText}>
              {summary.psalmRead ? 'Full chapter read' : 'Reading in progress'}
            </ThemedText>
          </View>

          <View style={styles.pauseAndPraiseSection}>
            <View style={styles.pauseAndPraiseTitleRow}>
              <Ionicons name="musical-notes" size={18} color={Colors.sage} />
              <ThemedText weight="bold" style={styles.pauseAndPraiseTitle}>Pause and Praise</ThemedText>
            </View>
            <ThemedText style={styles.psalmPrompt}>What you saw about God</ThemedText>
            <ThemedText weight="bold" style={psalmObservations.length > 0 ? styles.psalmAnswer : styles.psalmAnswerMuted}>
              {psalmObservations.length > 0 ? psalmObservations.join(' · ') : 'Nothing selected'}
            </ThemedText>
          </View>

        </TouchableOpacity>

        <View style={styles.asYouGo}>
          <ThemedText weight="semiBold" style={styles.sectionEyebrow}>AS YOU GO</ThemedText>
          <ThemedText weight="bold" style={styles.reminderText}>
            {dailyMessage}
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save and finish"
          onPress={onDone}
        >
          <ThemedText weight="semiBold" style={styles.doneButtonText}>{completed ? 'Done' : 'Save & Finish'}</ThemedText>
        </TouchableOpacity>
      </View>

      <ShareComposer
        visible={shareComposerOpen}
        variant="morning-summary"
        morningSummary={morningShareData}
        text={morningShareText}
        onClose={() => setShareComposerOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 8,
    paddingTop: 8,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 48,
    marginBottom: 28,
  },
  completionHeaderText: {
    flex: 1,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
  },
  shareButton: {
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
  editButton: {
    position: 'absolute',
    right: 70,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
  },
  sectionEyebrow: {
    color: Colors.sageMuted,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
  glanceSection: {
    marginBottom: 24,
  },
  glanceGrid: {
    flexDirection: 'row',
    marginTop: 10,
  },
  glanceColumn: {
    flex: 1,
    paddingVertical: 2,
    paddingLeft: 22,
  },
  glanceColumnBorder: {
    paddingLeft: 0,
    paddingRight: 22,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  glanceLabel: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  valueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  glanceValue: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
    flexShrink: 1,
  },
  feelingScriptureText: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },
  feelingScriptureReference: {
    color: Colors.sageMuted,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  focusReflection: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  todayCount: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 14,
    paddingTop: 14,
  },
  todayCountValue: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
  },
  psalmCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  psalmHeader: {
    alignItems: 'flex-start',
    gap: 3,
    marginBottom: 10,
  },
  psalmTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
    flexShrink: 1,
  },
  readStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  readStatusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readStatusIconInactive: {
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  readStatusText: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 18,
  },
  pauseAndPraiseSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: 14,
  },
  pauseAndPraiseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pauseAndPraiseTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
  },
  psalmPrompt: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 5,
  },
  psalmAnswer: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 27,
  },
  psalmAnswerMuted: {
    color: Colors.textGray,
    fontSize: 18,
    lineHeight: 26,
  },
  asYouGo: {
    alignItems: 'center',
    marginTop: 22,
    paddingBottom: 4,
  },
  reminderText: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 0,
  },
  doneButton: {
    flex: 1,
    minHeight: 56,
    backgroundColor: Colors.sage,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    letterSpacing: 0.2,
  },
});

export default MorningClosingScreen;
