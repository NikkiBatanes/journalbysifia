import React, {useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {format} from 'date-fns';

import ThemedText from '../common/ThemedText';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ShareComposer from '../TruthToCarryShareComposer';
import {JournalCard} from './JournalCard';
import {
  SCRIPTURE_NOTE_LABEL,
  ScriptureNoteIcon,
  ScriptureNotePreview,
} from './ScriptureNotePreview';
import {Colors} from '../../theme/colors';
import {triggerLightHaptic} from '../../utils/haptics';
import {useMomentsPalette} from '../../context/MomentsPaletteContext';
import type {JournalBlock} from './shared/journalBlocks';
import type {MomentTimelineItem} from '../../services/momentTimelineService';
import type {ViewMode} from '../../systems/journal/types';

interface Props {
  timelineItem?: MomentTimelineItem;
  timelineItems?: MomentTimelineItem[];
  viewMode?: ViewMode;
}

export const ScriptureNoteReactQuery: React.FC<Props> = ({
  timelineItem,
  timelineItems,
  viewMode,
}) => {
  const navigation = useNavigation();
  const momentsPalette = useMomentsPalette();
  const items = timelineItems?.length
    ? timelineItems
    : timelineItem
    ? [timelineItem]
    : [];
  const reflections = items
    .map(item => item.reflection)
    .filter(
      (reflection): reflection is NonNullable<typeof reflection> =>
        !!reflection,
    );
  const [reader, setReader] = useState<{
    reference: string;
    version: string;
  } | null>(null);
  const [shareComposerText, setShareComposerText] = useState('');
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  if (!reflections.length) return null;

  const openNote = (reflection: (typeof reflections)[number]) => {
    triggerLightHaptic();
    (navigation as any).navigate('ScriptureNoteEditor', {
      selectedDate: reflection.selected_date,
      existingReflection: reflection,
    });
  };

  return (
    <JournalCard
      icon={
        <ScriptureNoteIcon
          size={24}
          color={momentsPalette ? Colors.sage : Colors.alertCoral}
        />
      }
      title={SCRIPTURE_NOTE_LABEL}
      subtitle={`${reflections.length} saved ${
        reflections.length === 1 ? 'note' : 'notes'
      }`}
      viewMode={viewMode}>
      <View style={styles.section}>
        {reflections.map(reflection => {
          const reference =
            reflection.title ||
            reflection.metadata?.reference ||
            'Scripture Note';
          const version = reflection.metadata?.version || 'NASB';
          const storedJournalBlocks = reflection.metadata?.journalBlocks;
          const journalBlocks = Array.isArray(storedJournalBlocks)
            ? (storedJournalBlocks as JournalBlock[])
            : [];
          const timestamp = reflection.updated_at || reflection.created_at;
          const time =
            timestamp && !Number.isNaN(new Date(timestamp).getTime())
              ? format(new Date(timestamp), 'h:mm a')
              : '';

          return (
            <TouchableOpacity
              key={reflection.id}
              style={[styles.card, momentsPalette && styles.momentsCard]}
              activeOpacity={0.8}
              onPress={() => openNote(reflection)}
              accessibilityRole="button"
              accessibilityLabel={`Open scripture note ${reference}`}>
              <ScriptureNotePreview
                reference={reference}
                version={version}
                journalBlocks={journalBlocks}
                content={reflection.content || ''}
                meta={
                  time ? (
                    <ThemedText style={styles.time}>{time}</ThemedText>
                  ) : undefined
                }
                footerAction={
                  <TouchableOpacity
                    style={styles.readButton}
                    activeOpacity={0.72}
                    onPress={event => {
                      event.stopPropagation();
                      triggerLightHaptic();
                      setReader({reference, version});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Read ${reference}`}>
                    <MaterialCommunityIcons
                      name="book-outline"
                      size={15}
                      color={Colors.sage}
                    />
                    <ThemedText weight="semiBold" style={styles.readButtonText}>
                      Read verse
                    </ThemedText>
                  </TouchableOpacity>
                }
              />
            </TouchableOpacity>
          );
        })}
        <ScriptureReaderModal
          visible={!!reader}
          passages={reader ? [{reference: reader.reference}] : []}
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
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 0,
    gap: 12,
  },
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  momentsCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.inputBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  time: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 15,
  },
  readButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(82, 106, 91, 0.09)',
  },
  readButtonText: {
    color: Colors.sage,
    fontSize: 12,
  },
});
