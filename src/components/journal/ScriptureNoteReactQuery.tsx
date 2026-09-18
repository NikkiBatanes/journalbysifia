import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../common/ThemedText';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ShareComposer from '../TruthToCarryShareComposer';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic } from '../../utils/haptics';
import type { MomentTimelineItem } from '../../services/momentTimelineService';

interface Props {
  timelineItem?: MomentTimelineItem;
  timelineItems?: MomentTimelineItem[];
}

export const ScriptureNoteReactQuery: React.FC<Props> = ({ timelineItem, timelineItems }) => {
  const navigation = useNavigation();
  const items = timelineItems?.length ? timelineItems : timelineItem ? [timelineItem] : [];
  const reflections = items.map(item => item.reflection).filter((reflection): reflection is NonNullable<typeof reflection> => !!reflection);
  const [reader, setReader] = useState<{ reference: string; version: string } | null>(null);
  const [shareComposerText, setShareComposerText] = useState('');
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  if (!reflections.length) return null;

  const openNote = (reflection: typeof reflections[number]) => {
    triggerLightHaptic();
    (navigation as any).navigate('ScriptureNoteEditor', {
      selectedDate: reflection.selected_date,
      existingReflection: reflection,
    });
  };

  return (
    <View style={styles.section}>
      <ThemedText weight="semiBold" style={styles.sectionTitle}>SCRIPTURE NOTE</ThemedText>
      {reflections.map(reflection => (
        <TouchableOpacity
          key={reflection.id}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => openNote(reflection)}
          accessibilityRole="button"
          accessibilityLabel={`Open scripture note ${reflection.title || ''}`.trim()}
        >
          <ThemedText weight="bold" style={styles.reference}>{reflection.title || 'Scripture Note'}</ThemedText>
          {!!reflection.content?.trim() && (
            <ThemedText numberOfLines={4} ellipsizeMode="tail" style={styles.content}>
              {reflection.content.trim()}
            </ThemedText>
          )}
          <TouchableOpacity
            style={styles.readButton}
            activeOpacity={0.72}
            onPress={event => {
              event.stopPropagation();
              triggerLightHaptic();
              setReader({ reference: reflection.title || reflection.metadata?.reference || '', version: reflection.metadata?.version || 'NASB' });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Read ${reflection.title || 'scripture'}`}
          >
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={15} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.readButtonText}>Read verse</ThemedText>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      <ScriptureReaderModal
        visible={!!reader}
        passages={reader ? [{ reference: reader.reference }] : []}
        initialIndex={0}
        version={reader?.version || 'NASB'}
        onClose={() => setReader(null)}
        onShareScripture={text => {
          setShareComposerText(text);
          setShareComposerOpen(true);
        }}
      />
      <ShareComposer
        visible={shareComposerOpen}
        text={shareComposerText}
        onClose={() => setShareComposerOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 22,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.sage,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  reference: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  content: {
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  readButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
  },
  readButtonText: {
    color: Colors.sage,
    fontSize: 12,
  },
});
