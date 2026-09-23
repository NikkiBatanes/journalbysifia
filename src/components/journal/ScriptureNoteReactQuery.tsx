import React, {useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {format} from 'date-fns';

import ThemedText from '../common/ThemedText';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ShareComposer from '../TruthToCarryShareComposer';
import SavedReflectionBlocks from './SavedReflectionBlocks';
import {JournalCard} from './JournalCard';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
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
        <MaterialCommunityIcons
          name="book-open-page-variant-outline"
          size={24}
          color={momentsPalette ? Colors.sage : Colors.alertCoral}
        />
      }
      title="SCRIPTURE NOTE"
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
              {!!time && (
                <View style={styles.timeRow}>
                  <ThemedText style={styles.time}>{time}</ThemedText>
                </View>
              )}

              <View style={styles.referenceBlock}>
                <View style={styles.referenceAccent} />
                <View style={styles.referenceCopy}>
                  <ThemedText weight="bold" style={styles.reference}>
                    {reference}
                  </ThemedText>
                  <ThemedText weight="medium" style={styles.version}>
                    {version}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.divider} />

              {journalBlocks.length > 0 ? (
                <View pointerEvents="box-none" style={styles.blocks}>
                  <SavedReflectionBlocks blocks={journalBlocks} compact />
                </View>
              ) : !!reflection.content?.trim() ? (
                <View style={styles.contentBlock}>
                  <ThemedText
                    numberOfLines={5}
                    ellipsizeMode="tail"
                    style={styles.content}>
                    {reflection.content.trim()}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.footer}>
                <View style={styles.savedNoteMeta}>
                  <MaterialCommunityIcons
                    name="notebook-edit-outline"
                    size={14}
                    color={Colors.textGray}
                  />
                  <ThemedText style={styles.savedNoteMetaText}>
                    {journalBlocks.length > 0
                      ? `${journalBlocks.length} ${
                          journalBlocks.length === 1 ? 'note' : 'notes'
                        }`
                      : 'Saved reflection'}
                  </ThemedText>
                </View>
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
              </View>
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  time: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 15,
  },
  referenceBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 13,
  },
  referenceAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.sage,
  },
  referenceCopy: {
    flex: 1,
  },
  reference: {
    color: Colors.text,
    fontFamily: Fonts.lora.bold,
    fontSize: 22,
    lineHeight: 29,
  },
  version: {
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 16,
  },
  blocks: {
    marginHorizontal: -2,
  },
  contentBlock: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(82, 106, 91, 0.24)',
    paddingLeft: 14,
  },
  content: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  savedNoteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedNoteMetaText: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
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
