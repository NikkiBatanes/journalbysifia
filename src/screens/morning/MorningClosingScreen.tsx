import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';

import ThemedText from '../../components/common/ThemedText';
import ShareDropdownModal from '../../components/ShareDropdownModal';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import { toLocalDateString } from '../../utils/date';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';
import { useRoutine } from '../../context/RoutineContext';
import { getLocalJournalSingleton, getLocalJournalEntries } from '../../storage/journalStorage';
import { getLocalReflection } from '../../storage/reflectionStorage';

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
  useMorningStatusBar();
  const { completeRoutine, selectedDate, contentRefs } = useRoutine();
  const params = route.params ?? {};
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);

  const date = new Date(selectedDate);
  const dateStr = toLocalDateString(date);

  const [summary, setSummary] = useState({
    feeling: params.feeling,
    feelingIcon: params.feelingIcon,
    feelingIconType: params.feelingIconType,
    underneath: params.underneath,
    focus: params.focus,
    focusIcon: params.focusIcon,
    focusIconType: params.focusIconType,
    personalText: params.personalText,
    priorities: [] as string[],
    topTodos: [] as string[],
    psalmNumber: params.psalmNumber,
    psalmRead: params.psalmRead,
    selectedAttributes: params.selectedAttributes ?? [],
    carry: params.carry,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const next = { ...summary };

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
          next.psalmNumber = psalmEntry.metadata.psalmNumber ?? next.psalmNumber;
          next.psalmRead = psalmEntry.metadata.psalmRead ?? next.psalmRead;
          next.selectedAttributes = psalmEntry.metadata.selectedAttributes ?? next.selectedAttributes;
          next.carry = psalmEntry.metadata.carry ?? next.carry;
        }
      }

      if (mounted) {setSummary(next);}
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRefs, dateStr]);

  const priorityCountLabel = `${summary.priorities.length} ${summary.priorities.length === 1 ? 'priority' : 'priorities'}`;
  const todoCountLabel = `${summary.topTodos.length} ${summary.topTodos.length === 1 ? 'to-do' : 'to-dos'}`;

  const onDone = async () => {
    triggerLightHaptic();
    await completeRoutine();

    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Today' });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[styles.shareButton, { top: insets.top + 8 }]}
        onPress={() => {
          triggerLightHaptic();
          setShareDropdownOpen(true);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Share morning routine"
      >
        <Ionicons name="paper-plane-outline" size={17} color={Colors.text} />
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
            <ThemedText style={styles.subtitle}>You’ve begun your day with God.</ThemedText>
          </View>
        </View>

        <View style={styles.glanceSection}>
          <ThemedText weight="semiBold" style={styles.sectionEyebrow}>TODAY AT A GLANCE</ThemedText>
          <View style={styles.glanceGrid}>
            <View style={[styles.glanceColumn, styles.glanceColumnBorder]}>
              <ThemedText style={styles.glanceLabel}>Feeling</ThemedText>
              <View style={styles.valueWithIcon}>
                <SummaryIcon icon={summary.feelingIcon} iconType={summary.feelingIconType} />
                <ThemedText weight="semiBold" style={styles.glanceValue}>{summary.feeling || '—'}</ThemedText>
              </View>
            </View>
            <View style={styles.glanceColumn}>
              <ThemedText style={styles.glanceLabel}>Focus</ThemedText>
              <View style={styles.valueWithIcon}>
                <SummaryIcon icon={summary.focusIcon} iconType={summary.focusIconType} />
                <ThemedText weight="semiBold" style={styles.glanceValue}>{summary.focus || 'Open'}</ThemedText>
              </View>
              {summary.personalText ? (
                <ThemedText style={styles.focusReflection}>{summary.personalText}</ThemedText>
              ) : null}
            </View>
          </View>
          <View style={styles.todayCount}>
            <ThemedText style={styles.glanceLabel}>Today</ThemedText>
            <ThemedText weight="semiBold" style={styles.todayCountValue}>
              {priorityCountLabel} · {todoCountLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.psalmCard}>
          <View style={styles.psalmHeader}>
            <ThemedText weight="semiBold" style={styles.sectionEyebrow}>MORNING PSALM</ThemedText>
            <ThemedText weight="bold" style={styles.psalmTitle}>
              {summary.psalmNumber ? `Psalm ${summary.psalmNumber}` : 'Psalm'}
            </ThemedText>
          </View>

          <View style={styles.readStatus}>
            <View style={[styles.readStatusIcon, !summary.psalmRead && styles.readStatusIconInactive]}>
              <Ionicons name={summary.psalmRead ? 'checkmark' : 'book-outline'} size={14} color={summary.psalmRead ? Colors.hopeWhite : Colors.sage} />
            </View>
            <ThemedText weight="semiBold" style={styles.readStatusText}>
              {summary.psalmRead ? 'Full chapter read' : 'Chapter not marked read'}
            </ThemedText>
          </View>

          <ThemedText style={styles.psalmPrompt}>What you saw about God</ThemedText>
          <ThemedText weight="bold" style={summary.selectedAttributes.length > 0 ? styles.psalmAnswer : styles.psalmAnswerMuted}>
            {summary.selectedAttributes.length > 0 ? summary.selectedAttributes.join(' · ') : 'Nothing selected'}
          </ThemedText>

        </View>

        <View style={styles.asYouGo}>
          <ThemedText weight="semiBold" style={styles.sectionEyebrow}>AS YOU GO</ThemedText>
          <ThemedText weight="bold" style={styles.reminderText}>
            Remember who God is as{'\n'}you step into today.
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
          <ThemedText weight="semiBold" style={styles.doneButtonText}>Save & Finish</ThemedText>
        </TouchableOpacity>
      </View>

      <ShareDropdownModal
        visible={shareDropdownOpen}
        onClose={() => setShareDropdownOpen(false)}
        onExportPDF={() => {}}
        hideExportPDF={true}
        shareTitle="Share Journal by siFia with friends"
        shareText="I started my day with God using Journal by siFia."
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
    paddingBottom: 12,
    paddingTop: 12,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 54,
    marginBottom: 38,
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
    marginBottom: 34,
  },
  glanceGrid: {
    flexDirection: 'row',
    marginTop: 14,
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
  focusReflection: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  todayCount: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 20,
    paddingTop: 18,
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
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 26,
  },
  psalmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  psalmTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
  },
  readStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
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
  psalmPrompt: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  psalmAnswer: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 30,
  },
  psalmAnswerMuted: {
    color: Colors.textGray,
    fontSize: 18,
    lineHeight: 26,
  },
  asYouGo: {
    alignItems: 'center',
    marginTop: 38,
    paddingBottom: 8,
  },
  reminderText: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 29,
    textAlign: 'center',
    marginTop: 12,
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
