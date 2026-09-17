import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { SavedMorningMoment } from '../journal/SavedMorningMoment';
import type { MomentRoutineSection, MomentTimelineItem } from '../../services/momentTimelineService';
import { getAllPlugins } from '../../systems/journal/plugins/registry';
import { PluginRenderer } from '../../systems/journal/PluginRenderer';
import type { JournalPlugin, ViewMode } from '../../systems/journal/types';

const dateFromKey = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getRoutinePresentationKinds = (item: MomentTimelineItem): string[] =>
  (item.preview.sections || []).map(section => section.kind);

const pluginIdForSection = (section: MomentRoutineSection): string | null => {
  if (section.kind === 'focus') return 'focus';
  if (section.kind === 'priorities') return section.journalEntries?.some(entry => entry.content_type === 'todo') ? 'todos' : 'focus';
  if (section.kind === 'gratitude') return 'gratitude';
  if (section.kind === 'win') return 'todayswin';
  if (section.kind === 'looking_forward') return 'lookingforward';
  return null;
};

const RoutineSection: React.FC<{ section: MomentRoutineSection; selectedDate: Date; refreshKey?: number; navigation?: any; viewMode?: ViewMode }> = ({ section, selectedDate, refreshKey, navigation, viewMode = 'inline' }) => {
  switch (section.kind) {
    case 'check_in':
    case 'psalm':
    case 'proverbs':
      return section.presentation ? <SavedMorningMoment moment={section.presentation} viewMode={viewMode} /> : null;
    default: {
      const pluginId = pluginIdForSection(section);
      const original = pluginId ? getAllPlugins().find(plugin => plugin.id === pluginId) : undefined;
      if (!original) return null;
      const plugin: JournalPlugin = section.presentation ? { ...original, savedMorningMoment: section.presentation } : original;
      return <PluginRenderer plugin={plugin} selectedDate={selectedDate} refreshKey={refreshKey} viewMode={viewMode} navigation={navigation} />;
    }
  }
};

export const RoutineMomentSummary: React.FC<{ timelineItem: MomentTimelineItem; refreshKey?: number; navigation?: any; viewMode?: ViewMode }> = ({ timelineItem, refreshKey, navigation, viewMode = 'inline' }) => {
  const selectedDate = dateFromKey(timelineItem.selectedDate);
  const sections = timelineItem.preview.sections || [];
  if (!sections.length) return null;
  const hasFocusSection = sections.some(section => section.kind === 'focus');
  const visibleSections = sections.filter(section => section.kind !== 'priorities'
    || section.journalEntries?.some(entry => entry.content_type === 'todo')
    || !hasFocusSection);
  const morning = timelineItem.kind === 'morning';
  return <View style={styles.group}>
    <View style={styles.heading} accessibilityRole="header">
      <Ionicons name={morning ? 'sunny-outline' : 'moon-outline'} size={14} color={Colors.sage} />
      <ThemedText weight="semiBold" style={styles.headingText}>{morning ? 'MORNING' : 'EVENING'}</ThemedText>
    </View>
    <View style={styles.cards}>
      {visibleSections.map(section => <View key={`${section.kind}:${section.canonicalIds.join(':')}`} style={styles.cardSlot}><RoutineSection section={section} selectedDate={selectedDate} refreshKey={refreshKey} navigation={navigation} viewMode={viewMode} /></View>)}
    </View>
  </View>;
};

const styles = StyleSheet.create({
  group: { width: '100%' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12 },
  headingText: { color: Colors.sage, fontSize: 11, letterSpacing: 1.7 },
  cards: {},
  cardSlot: { paddingVertical: 12 },
});
