import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Sound from 'react-native-sound';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import {
  formatJournalAttribution,
  getJournalTableCellAlignment,
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  prepareJournalBlocksForSave,
  type JournalBlock,
} from './shared/journalBlocks';
import ExpandableJournalPhoto from './shared/ExpandableJournalPhoto';
import DraggableJournalBlock from './shared/DraggableJournalBlock';
import {
  reorderJournalBlock,
  resolveJournalBlockDropIndex,
} from './shared/journalBlockOperations';

const formatDuration = (millis = 0) => {
  const seconds = Math.max(0, Math.round(millis / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const SavedVoiceNote = ({
  block,
  onDark,
}: {
  block: JournalBlock;
  onDark: boolean;
}) => {
  const soundRef = useRef<Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      soundRef.current?.release();
    },
    [],
  );

  const togglePlayback = async () => {
    if (!block.uri) {
      return;
    }
    if (soundRef.current && playing) {
      soundRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      if (!soundRef.current) {
        Sound.setCategory('Playback');
        soundRef.current = await new Promise<Sound>((resolve, reject) => {
          const isBundledAsset = block.uri!.startsWith('bundle://');
          const sound = new Sound(
            isBundledAsset ? block.uri!.slice('bundle://'.length) : block.uri!,
            isBundledAsset ? Sound.MAIN_BUNDLE : '',
            error => {
            if (error) {
              sound.release();
              reject(error);
              return;
            }
            resolve(sound);
            },
          );
        });
      }
      setPlaying(true);
      soundRef.current.play(success => {
        setPlaying(false);
        if (success) {
          soundRef.current?.setCurrentTime(0);
        } else {
          Alert.alert('Could not play voice note', 'Please try playing the recording again.');
        }
      });
    } catch {
      setPlaying(false);
      Alert.alert('Could not play voice note', 'Please try playing the recording again.');
    }
  };

  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.65)' : Colors.textGray;
  return (
    <View style={[styles.voiceBlock, onDark ? styles.blockOnDark : styles.blockOnLight]}>
      <View style={styles.voiceRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          disabled={!block.uri}
          onPress={togglePlayback}
          style={[styles.voiceButton, {backgroundColor: onDark ? Colors.hopeWhite : Colors.sage}]}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={18}
            color={onDark ? Colors.sage : Colors.hopeWhite}
          />
        </TouchableOpacity>
        <View style={styles.voiceCopy}>
          <ThemedText weight="bold" style={[styles.voiceTitle, {color: foreground}]}>Voice Note</ThemedText>
          <ThemedText style={[styles.voiceDuration, {color: muted}]}>
            {block.uri ? formatDuration(block.durationMillis) : 'Recording unavailable'}
          </ThemedText>
        </View>
      </View>
      {!!block.text?.trim() && (
        <ThemedText style={[styles.caption, {color: foreground}]}>{block.text}</ThemedText>
      )}
    </View>
  );
};

export const SavedReflectionBlocks = ({
  blocks,
  onDark = false,
  compact = false,
  onToggleAction,
  onReorderBlocks,
}: {
  blocks: JournalBlock[];
  onDark?: boolean;
  compact?: boolean;
  onToggleAction?: (blockId: string) => void;
  onReorderBlocks?: (blocks: JournalBlock[]) => void | Promise<void>;
}) => {
  const blockLayoutsRef = useRef(new Map<string, {y: number; height: number}>());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    blockId: string;
    fromIndex: number;
    targetIndex: number;
    blockHeight: number;
  } | null>(null);
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.68)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;
  const preparedBlocks = prepareJournalBlocksForSave(blocks);
  const allVisibleBlocks = preparedBlocks.filter(block => !block.parentColumnId);
  const visibleBlocks = (() => {
    if (!compact || allVisibleBlocks.length <= 3) {
      return allVisibleBlocks;
    }
    const preview = allVisibleBlocks.slice(0, 3);
    const firstPhoto = allVisibleBlocks.find(block => block.kind === 'photo');
    if (firstPhoto && !preview.includes(firstPhoto)) {
      preview[preview.length - 1] = firstPhoto;
      preview.sort(
        (left, right) =>
          allVisibleBlocks.indexOf(left) - allVisibleBlocks.indexOf(right),
      );
    }
    return preview;
  })();
  const hiddenBlockCount = allVisibleBlocks.length - visibleBlocks.length;
  const canReorder = !compact && Boolean(onReorderBlocks);

  const handleDragStart = (blockId: string) => {
    const fromIndex = allVisibleBlocks.findIndex(block => block.id === blockId);
    const layout = blockLayoutsRef.current.get(blockId);
    if (fromIndex < 0 || !layout) {return;}
    setDragPreview({
      blockId,
      fromIndex,
      targetIndex: fromIndex,
      blockHeight: layout.height,
    });
  };

  const handleDragMove = (blockId: string, deltaY: number) => {
    const targetIndex = resolveJournalBlockDropIndex(
      allVisibleBlocks,
      blockLayoutsRef.current,
      blockId,
      deltaY,
    );
    setDragPreview(current =>
      !current || current.blockId !== blockId || current.targetIndex === targetIndex
        ? current
        : {...current, targetIndex},
    );
  };

  const handleDragEnd = (blockId: string, deltaY: number) => {
    const targetIndex = resolveJournalBlockDropIndex(
      allVisibleBlocks,
      blockLayoutsRef.current,
      blockId,
      deltaY,
    );
    setDragPreview(null);
    const reorderedParents = reorderJournalBlock(
      allVisibleBlocks,
      blockId,
      targetIndex,
    );
    if (reorderedParents === allVisibleBlocks) {return;}

    const parentIds = new Set(reorderedParents.map(block => block.id));
    const reorderedBlocks = reorderedParents.flatMap(parent => [
      parent,
      ...preparedBlocks.filter(child => child.parentColumnId === parent.id),
    ]);
    const orphanedChildren = preparedBlocks.filter(
      child => child.parentColumnId && !parentIds.has(child.parentColumnId),
    );
    setSelectedBlockId(blockId);
    onReorderBlocks?.([...reorderedBlocks, ...orphanedChildren]);
  };

  const renderedBlocks = visibleBlocks.map(block => {
        if (block.kind === 'text') {
          return (
            <ThemedText
              key={block.id}
              style={[
                styles.textBlock,
                {
                  color: foreground,
                  borderLeftColor: onDark
                    ? 'rgba(136, 158, 187, 0.2)'
                    : Colors.borderLight,
                },
              ]}
              numberOfLines={compact ? 4 : undefined}
              ellipsizeMode="tail">
              {block.text}
            </ThemedText>
          );
        }
        if (block.kind === 'section') {
          return (
            <View key={block.id} style={styles.sectionBlock}>
              <View style={[styles.sectionLine, {backgroundColor: accent}]} />
              <ThemedText
                weight="bold"
                numberOfLines={compact ? 2 : undefined}
                style={[styles.sectionText, {color: foreground}]}>
                {block.text}
              </ThemedText>
            </View>
          );
        }
        if (block.kind === 'action') {
          const checkbox = (
            <View style={[styles.checkbox, {borderColor: accent, backgroundColor: block.completed ? accent : 'transparent'}]}>
              {block.completed && <Ionicons name="checkmark" size={13} color={onDark ? Colors.sage : Colors.hopeWhite} />}
            </View>
          );
          return (
            <View key={block.id} style={styles.actionBlock}>
              {onToggleAction ? (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{checked: Boolean(block.completed)}}
                  accessibilityLabel={block.completed ? 'Mark action incomplete' : 'Mark action complete'}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  onPress={() => onToggleAction(block.id)}>
                  {checkbox}
                </TouchableOpacity>
              ) : checkbox}
              <ThemedText
                numberOfLines={compact ? 2 : undefined}
                style={[styles.actionText, {color: foreground}, block.completed && styles.completedAction]}>
                {block.text}
              </ThemedText>
            </View>
          );
        }
        if (block.kind === 'bullets' || block.kind === 'numbered') {
          const listItems = (block.points || []).filter(point => point.trim());
          const shownItems = compact ? listItems.slice(0, 4) : listItems;
          return (
            <View key={block.id} style={styles.savedList}>
              {!!block.text?.trim() && (
                <ThemedText
                  weight="bold"
                  numberOfLines={compact ? 1 : undefined}
                  style={[styles.savedListTitle, {color: foreground}]}>
                  {block.text.trim()}
                </ThemedText>
              )}
              {shownItems.map((point, index) => (
                <View key={`${block.id}-${index}`} style={styles.savedListRow}>
                  <ThemedText
                    weight="semiBold"
                    style={[styles.savedListMarker, {color: accent}]}>
                    {block.kind === 'numbered' ? `${index + 1}.` : '•'}
                  </ThemedText>
                  <ThemedText
                    numberOfLines={compact ? 2 : undefined}
                    style={[styles.savedListText, {color: foreground}]}>
                    {point}
                  </ThemedText>
                </View>
              ))}
              {shownItems.length < listItems.length && (
                <ThemedText style={[styles.listMoreText, {color: muted}]}>
                  {listItems.length - shownItems.length} more
                </ThemedText>
              )}
            </View>
          );
        }
        if (block.kind === 'column') {
          const nestedBlocks = preparedBlocks.filter(
            child => child.parentColumnId === block.id,
          );
          const withoutParent = (child: JournalBlock): JournalBlock => ({
            ...child,
            parentColumnId: undefined,
            columnSide: undefined,
          });
          const leftBlocks = nestedBlocks
            .filter(child => child.columnSide === 'left')
            .map(withoutParent);
          const rightBlocks = nestedBlocks
            .filter(child => child.columnSide === 'right')
            .map(withoutParent);
          return (
            <View key={block.id} style={styles.savedColumns}>
              <View style={styles.savedColumn}>
                <SavedReflectionBlocks
                  blocks={leftBlocks}
                  onDark={onDark}
                  compact={compact}
                  onToggleAction={onToggleAction}
                />
              </View>
              <View style={[styles.savedColumnDivider, {backgroundColor: border}]} />
              <View style={styles.savedColumn}>
                <SavedReflectionBlocks
                  blocks={rightBlocks}
                  onDark={onDark}
                  compact={compact}
                  onToggleAction={onToggleAction}
                />
              </View>
            </View>
          );
        }
        if (block.kind === 'photo') {
          return (
            <View key={block.id} style={styles.photoBlock}>
              {!!block.uri && (
                <ExpandableJournalPhoto
                  uri={block.uri}
                  imageStyle={[styles.photo, compact && styles.compactPhoto]}
                />
              )}
              {!!block.text?.trim() && (
                <ThemedText
                  numberOfLines={compact ? 2 : undefined}
                  style={[styles.caption, {color: foreground}]}>
                  {block.text}
                </ThemedText>
              )}
            </View>
          );
        }
        if (block.kind === 'voice') {
          return <SavedVoiceNote key={block.id} block={block} onDark={onDark} />;
        }
        if (block.kind === 'table') {
          const tableRows = block.tableRows || [];
          const columnCount = tableRows[0]?.length || 0;
          const fitsWidth = (columnCount === 2 || columnCount === 3) &&
            tableRows.every(row => row.length === columnCount);
          const fittedCellStyle = fitsWidth && {width: `${100 / columnCount}%` as const};
          return (
            <ScrollView
              key={block.id}
              horizontal
              scrollEnabled={!fitsWidth}
              contentContainerStyle={fitsWidth && styles.fullWidthTable}
              showsHorizontalScrollIndicator={false}>
              <View style={fitsWidth && styles.fullWidthTable}>
                {(compact ? tableRows.slice(0, 3) : tableRows).map((row, rowIndex) => (
                  <View key={`${block.id}-row-${rowIndex}`} style={styles.tableRow}>
                    {row.map((cell, columnIndex) => (
                      <ThemedText
                        key={`${block.id}-${rowIndex}-${columnIndex}`}
                        weight={rowIndex === 0 ? 'bold' : 'regular'}
                        style={[
                          styles.tableCell,
                          fittedCellStyle,
                          {
                            color: foreground,
                            borderColor: border,
                            textAlign: getJournalTableCellAlignment(
                              block.tableCellAlignments,
                              rowIndex,
                              columnIndex,
                            ),
                          },
                          rowIndex === 0 && {backgroundColor: onDark ? 'rgba(220,232,222,0.14)' : Colors.anchorBlueLight},
                        ]}>
                        {cell}
                      </ThemedText>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }

        const config = JOURNAL_BLOCKS[block.kind];
        const primaryText = block.kind === 'scripture'
          ? block.scriptureReference || block.reference || block.text
          : block.text;
        const secondaryText = block.kind === 'scripture'
          ? block.scriptureText
          : block.kind === 'quote'
          ? formatJournalAttribution(block.secondary?.trim())
          : block.secondary;
        return (
          <View key={block.id} style={[styles.standardBlock, {borderColor: border, backgroundColor: surface}]}>
            <View style={styles.labelRow}>
              <JournalBlockIcon config={config} size={14} color={accent} />
              <ThemedText weight="bold" style={[styles.label, {color: accent}]}>{config.label}</ThemedText>
            </View>
            {!!primaryText?.trim() && (
              <ThemedText
                numberOfLines={compact ? 3 : undefined}
                style={[styles.standardText, {color: foreground}, block.kind === 'quote' && styles.quoteText]}>
                {primaryText}
              </ThemedText>
            )}
            {!!secondaryText?.trim() && (
              <ThemedText
                numberOfLines={compact ? 2 : undefined}
                style={[styles.secondaryText, {color: muted}]}>
                {secondaryText}
              </ThemedText>
            )}
          </View>
        );
      });

  const displayedBlocks = canReorder
    ? renderedBlocks.map((content, index) => {
        const block = visibleBlocks[index];
        const shiftY = (() => {
          if (!dragPreview || dragPreview.blockId === block.id) {
            return 0;
          }
          if (
            dragPreview.targetIndex > dragPreview.fromIndex &&
            index > dragPreview.fromIndex &&
            index <= dragPreview.targetIndex
          ) {
            return -dragPreview.blockHeight;
          }
          if (
            dragPreview.targetIndex < dragPreview.fromIndex &&
            index >= dragPreview.targetIndex &&
            index < dragPreview.fromIndex
          ) {
            return dragPreview.blockHeight;
          }
          return 0;
        })();
        return (
          <DraggableJournalBlock
            key={block.id}
            blockId={block.id}
            selected={selectedBlockId === block.id}
            tone={onDark ? 'onDark' : 'default'}
            shiftY={shiftY}
            onSelect={() => setSelectedBlockId(block.id)}
            onLayout={layout => blockLayoutsRef.current.set(block.id, layout)}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}>
            {content}
          </DraggableJournalBlock>
        );
      })
    : renderedBlocks;

  return (
    <View style={styles.list}>
      {displayedBlocks}
      {hiddenBlockCount > 0 && (
        <ThemedText style={[styles.moreText, {color: muted}]}>
          {hiddenBlockCount} more {hiddenBlockCount === 1 ? 'note' : 'notes'}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {gap: JOURNAL_BLOCK_GAP, marginBottom: JOURNAL_BLOCK_GAP},
  textBlock: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionBlock: {flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7},
  sectionLine: {width: 4, minHeight: 28, borderRadius: 2},
  sectionText: {flex: 1, fontFamily: Fonts.lora.bold, fontSize: 17, lineHeight: 23},
  actionBlock: {flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 3},
  checkbox: {width: 19, height: 19, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  actionText: {flex: 1, fontSize: 14, lineHeight: 21},
  completedAction: {textDecorationLine: 'line-through', opacity: 0.65},
  savedList: {gap: 3, paddingVertical: 2},
  savedListTitle: {fontSize: 15, lineHeight: 21, marginBottom: 3},
  savedListRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  savedListMarker: {width: 23, fontSize: 14, lineHeight: 22, textAlign: 'right'},
  savedListText: {flex: 1, fontSize: 14, lineHeight: 22},
  listMoreText: {marginLeft: 31, fontSize: 11, lineHeight: 16},
  photoBlock: {width: '100%', alignSelf: 'stretch', gap: 7},
  photo: {width: '100%', height: 210, borderRadius: 16},
  compactPhoto: {height: 124},
  caption: {fontSize: 13, lineHeight: 19},
  voiceBlock: {borderWidth: 1, borderRadius: 16, padding: 12},
  blockOnDark: {borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(255,255,255,0.06)'},
  blockOnLight: {borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  voiceRow: {flexDirection: 'row', alignItems: 'center'},
  voiceButton: {width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center'},
  voiceCopy: {flex: 1, marginLeft: 10},
  voiceTitle: {fontSize: 13},
  voiceDuration: {fontSize: 11, marginTop: 1},
  standardBlock: {borderWidth: 1, borderRadius: 14, padding: 12},
  labelRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7},
  label: {fontSize: 10, letterSpacing: 1.1},
  standardText: {fontSize: 14, lineHeight: 21},
  quoteText: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 24},
  secondaryText: {fontSize: 12, lineHeight: 18, marginTop: 6},
  tableRow: {flexDirection: 'row'},
  fullWidthTable: {width: '100%'},
  tableCell: {width: 120, minHeight: 34, paddingHorizontal: 6, paddingVertical: 6, borderWidth: 0.5, fontSize: 12, lineHeight: 17},
  moreText: {fontSize: 11, lineHeight: 16, textAlign: 'right'},
  savedColumns: {flexDirection: 'row', alignItems: 'stretch', gap: 8},
  savedColumnDivider: {width: 1},
  savedColumn: {
    flex: 1,
    minWidth: 0,
    padding: 8,
  },
});

export default SavedReflectionBlocks;
