import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import NoteBlockFrame from './shared/NoteBlockFrame';
import {NOTE_BLOCK_METRICS, getNoteBlockVisuals} from './shared/noteBlockTheme';

const formatDuration = (millis = 0) => {
  const seconds = Math.max(0, Math.round(millis / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const stripWrappingQuotationMarks = (text: string) =>
  text
    .trim()
    .replace(/^[“"]+|[”"]+$/g, '')
    .trim();

const normalizeJournalLink = (value = ''): string | null => {
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  const url = /^(https?:\/\/|mailto:)/i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(url) ? url : null;
};

const titleCase = (value: string) =>
  value
    .split('_')
    .map(part => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');

const languageLabel = (kind: JournalBlock['languageKind']) =>
  kind === 'hebrew'
    ? 'א Hebrew'
    : kind === 'greek'
    ? 'α Greek'
    : kind === 'aramaic'
    ? '𐡀 Aramaic'
    : kind === 'latin'
    ? 'L Latin'
    : '';

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
          Alert.alert(
            'Could not play voice note',
            'Please try playing the recording again.',
          );
        }
      });
    } catch {
      setPlaying(false);
      Alert.alert(
        'Could not play voice note',
        'Please try playing the recording again.',
      );
    }
  };

  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.65)' : Colors.textGray;
  return (
    <View
      style={[
        styles.voiceBlock,
        onDark ? styles.blockOnDark : styles.blockOnLight,
      ]}>
      <View style={styles.voiceRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          disabled={!block.uri}
          onPress={togglePlayback}
          style={[
            styles.voiceButton,
            {backgroundColor: onDark ? Colors.hopeWhite : Colors.sage},
          ]}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={18}
            color={onDark ? Colors.sage : Colors.hopeWhite}
          />
        </TouchableOpacity>
        <View style={styles.voiceCopy}>
          <ThemedText
            weight="bold"
            style={[styles.voiceTitle, {color: foreground}]}>
            Voice Note
          </ThemedText>
          <ThemedText style={[styles.voiceDuration, {color: muted}]}>
            {block.uri
              ? formatDuration(block.durationMillis)
              : 'Recording unavailable'}
          </ThemedText>
        </View>
      </View>
      {!!block.text?.trim() && (
        <ThemedText style={[styles.voiceNote, {color: foreground}]}>
          {block.text}
        </ThemedText>
      )}
    </View>
  );
};

export const SavedReflectionBlocks = ({
  blocks,
  onDark = false,
  compact = false,
  embedded = false,
  onToggleAction,
  onReorderBlocks,
}: {
  blocks: JournalBlock[];
  onDark?: boolean;
  compact?: boolean;
  embedded?: boolean;
  onToggleAction?: (blockId: string) => void;
  onReorderBlocks?: (blocks: JournalBlock[]) => void | Promise<void>;
}) => {
  const blockLayoutsRef = useRef(
    new Map<string, {y: number; height: number}>(),
  );
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
  const preparedBlocks = prepareJournalBlocksForSave(blocks);
  const allVisibleBlocks = preparedBlocks.filter(
    block => !block.parentColumnId,
  );
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
    if (fromIndex < 0 || !layout) {
      return;
    }
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
      !current ||
      current.blockId !== blockId ||
      current.targetIndex === targetIndex
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
    if (reorderedParents === allVisibleBlocks) {
      return;
    }

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
      const fromOutline = block.sectionSource === 'outline';
      return (
        <View
          key={block.id}
          style={[
            styles.sectionBlock,
            fromOutline && styles.outlineSectionBlock,
          ]}>
          <View
            testID={
              fromOutline ? 'outline-section-marker' : 'section-title-divider'
            }
            style={[
              fromOutline ? styles.outlineSectionLine : styles.sectionLine,
              {backgroundColor: accent},
            ]}
          />
          {fromOutline ? (
            <ThemedText
              weight="bold"
              numberOfLines={compact ? 2 : undefined}
              style={[
                styles.sectionText,
                styles.outlineSectionText,
                {color: foreground},
              ]}>
              {block.text}
            </ThemedText>
          ) : (
            <ThemedText
              weight="bold"
              numberOfLines={compact ? 2 : undefined}
              style={[styles.sectionText, {color: foreground}]}>
              {block.text}
            </ThemedText>
          )}
        </View>
      );
    }
    if (block.kind === 'action') {
      const checkbox = (
        <View
          style={[
            styles.checkbox,
            {
              borderColor: accent,
              backgroundColor: block.completed ? accent : 'transparent',
            },
          ]}>
          {block.completed && (
            <Ionicons
              name="checkmark"
              size={13}
              color={onDark ? Colors.sage : Colors.hopeWhite}
            />
          )}
        </View>
      );
      return (
        <View key={block.id} style={styles.actionBlock}>
          {onToggleAction ? (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{checked: Boolean(block.completed)}}
              accessibilityLabel={
                block.completed
                  ? 'Mark action incomplete'
                  : 'Mark action complete'
              }
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              onPress={() => onToggleAction(block.id)}>
              {checkbox}
            </TouchableOpacity>
          ) : (
            checkbox
          )}
          <ThemedText
            numberOfLines={compact ? 2 : undefined}
            style={[
              styles.actionText,
              {color: foreground},
              block.completed && styles.completedAction,
            ]}>
            {block.text}
          </ThemedText>
        </View>
      );
    }
    if (block.kind === 'bullets' || block.kind === 'numbered') {
      const listItems = (block.points || []).filter(point => point.trim());
      const shownItems = compact ? listItems.slice(0, 4) : listItems;
      return (
        <View key={block.id} style={styles.savedFrame}>
          {!!block.text?.trim() && (
            <View style={styles.savedListHeader}>
              <ThemedText
                weight="bold"
                numberOfLines={compact ? 1 : undefined}
                style={[styles.savedListTitle, {color: foreground}]}>
                {block.text.trim()}
              </ThemedText>
            </View>
          )}
          <View style={styles.savedList}>
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
          <View
            style={[styles.savedColumnDivider, {backgroundColor: border}]}
          />
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
      const fitsWidth =
        (columnCount === 2 || columnCount === 3) &&
        tableRows.every(row => row.length === columnCount);
      const fittedCellStyle = fitsWidth && {
        width: `${100 / columnCount}%` as const,
      };
      return (
        <NoteBlockFrame
          key={block.id}
          kind="table"
          tone={onDark ? 'sage' : 'cream'}
          compact={compact}
          style={styles.savedFrame}>
          <ScrollView
            horizontal
            style={styles.tableScroll}
            scrollEnabled={!fitsWidth}
            contentContainerStyle={fitsWidth && styles.fullWidthTable}
            showsHorizontalScrollIndicator={false}>
            <View style={fitsWidth && styles.fullWidthTable}>
              {(compact ? tableRows.slice(0, 3) : tableRows).map(
                (row, rowIndex) => (
                  <View
                    key={`${block.id}-row-${rowIndex}`}
                    style={styles.tableRow}>
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
                          rowIndex === 0 && {
                            backgroundColor: onDark
                              ? 'rgba(220,232,222,0.14)'
                              : Colors.anchorBlueLight,
                          },
                          rowIndex === 0 && styles.tableHeaderCell,
                        ]}>
                        {cell}
                      </ThemedText>
                    ))}
                  </View>
                ),
              )}
            </View>
          </ScrollView>
        </NoteBlockFrame>
      );
    }

    const blockVisuals = getNoteBlockVisuals(
      block.kind,
      onDark ? 'sage' : 'cream',
    );
    const renderChips = (values: string[]) =>
      values.length ? (
        <View style={styles.chipRow}>
          {values.map(value => (
            <View
              key={`${block.id}-${value}`}
              style={[
                styles.chip,
                {
                  backgroundColor: blockVisuals.headerSurface,
                  borderColor: blockVisuals.border,
                },
              ]}>
              <ThemedText
                weight="semiBold"
                style={[styles.chipText, {color: blockVisuals.accent}]}>
                {titleCase(value)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null;

    const renderStandardContent = () => {
      if (block.kind === 'outline') {
        const points = (block.points || []).filter(point => point.trim());
        return (
          <>
            {points.map((point, index) => (
              <View
                key={`${block.id}-outline-${index}`}
                style={[
                  styles.outlineRow,
                  index === 0 && styles.firstOutlineRow,
                  {borderTopColor: blockVisuals.border},
                ]}>
                {block.outlineStyle === 'numbered' ? (
                  <View
                    style={[
                      styles.outlineNumberBadge,
                      {backgroundColor: blockVisuals.headerSurface},
                    ]}>
                    <ThemedText
                      weight="bold"
                      style={[
                        styles.outlineNumberText,
                        {color: blockVisuals.accent},
                      ]}>
                      {index + 1}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.outlineMarker,
                      {color: blockVisuals.accent},
                    ]}>
                    {block.outlineStyle === 'acronym'
                      ? `${point.trim().charAt(0).toUpperCase() || '•'} —`
                      : '•'}
                  </ThemedText>
                )}
                <ThemedText
                  numberOfLines={compact ? 2 : undefined}
                  style={[styles.outlineText, {color: foreground}]}>
                  {point}
                </ThemedText>
              </View>
            ))}
          </>
        );
      }

      if (block.kind === 'history') {
        const historyTypes = block.historyTypes || [];
        return (
          <>
            {renderChips(historyTypes)}
            {(historyTypes.includes('era') || historyTypes.includes('place')) &&
            (block.secondary?.trim() || block.eraPeriod) ? (
              <View
                style={[
                  styles.historyDetailRow,
                  {
                    borderColor: blockVisuals.border,
                    backgroundColor: blockVisuals.headerSurface,
                  },
                ]}>
                {historyTypes.includes('place') ? (
                  <Ionicons
                    name="location-outline"
                    size={17}
                    color={blockVisuals.accent}
                  />
                ) : null}
                <ThemedText
                  style={[styles.historyDetailText, {color: foreground}]}>
                  {block.secondary?.trim()}
                </ThemedText>
                {historyTypes.includes('era') && block.eraPeriod ? (
                  <View
                    style={[
                      styles.historyEra,
                      {backgroundColor: blockVisuals.surface},
                    ]}>
                    <ThemedText
                      weight="bold"
                      style={[styles.chipText, {color: blockVisuals.accent}]}>
                      {block.eraPeriod}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
            {!!(block.note || block.text)?.trim() && (
              <ThemedText
                numberOfLines={compact ? 3 : undefined}
                style={[styles.editorDetailText, {color: foreground}]}>
                {(block.note || block.text).trim()}
              </ThemedText>
            )}
            {!!block.reference?.trim() && (
              <ThemedText
                numberOfLines={compact ? 2 : undefined}
                style={[styles.editorSecondaryText, {color: muted}]}>
                {block.reference.trim()}
              </ThemedText>
            )}
          </>
        );
      }

      if (block.kind === 'language') {
        const language = languageLabel(block.languageKind);
        const originalWordLabel = block.languageKind
          ? `${block.languageKind.toUpperCase()} WORD`
          : 'ORIGINAL WORD';
        const hasWordConnection = Boolean(block.englishWord?.trim());
        return (
          <>
            {language ? renderChips([language]) : null}
            {(hasWordConnection || block.text?.trim()) && (
              <View
                style={[
                  styles.savedLanguageConnection,
                  {
                    backgroundColor: blockVisuals.headerSurface,
                    borderColor: blockVisuals.border,
                  },
                ]}>
                {hasWordConnection ? (
                  <View style={styles.savedLanguageWordColumn}>
                    <ThemedText
                      weight="bold"
                      style={[
                        styles.detailLabel,
                        {color: blockVisuals.accent},
                      ]}>
                      ENGLISH IN THE VERSE
                    </ThemedText>
                    <ThemedText
                      numberOfLines={compact ? 2 : undefined}
                      style={[styles.languageEnglishWord, {color: foreground}]}>
                      {block.englishWord?.trim()}
                    </ThemedText>
                  </View>
                ) : null}
                {hasWordConnection && block.text?.trim() ? (
                  <View style={styles.savedLanguageArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={blockVisuals.accent}
                    />
                  </View>
                ) : null}
                {!!block.text?.trim() && (
                  <View style={styles.savedLanguageWordColumn}>
                    <ThemedText
                      weight="bold"
                      style={[
                        styles.detailLabel,
                        {color: blockVisuals.accent},
                      ]}>
                      {originalWordLabel}
                    </ThemedText>
                    <ThemedText
                      numberOfLines={compact ? 2 : undefined}
                      style={[
                        styles.languageOriginalWord,
                        {color: foreground},
                      ]}>
                      {block.text.trim()}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
            {!!block.meaning?.trim() && (
              <View style={styles.languageDetailGroup}>
                <ThemedText
                  weight="bold"
                  style={[styles.detailLabel, {color: blockVisuals.accent}]}>
                  MEANING IN CONTEXT
                </ThemedText>
                <ThemedText
                  numberOfLines={compact ? 3 : undefined}
                  style={[styles.languageDetailText, {color: foreground}]}>
                  {block.meaning.trim()}
                </ThemedText>
              </View>
            )}
            {!!block.secondary?.trim() && (
              <View style={styles.languageDetailGroup}>
                <ThemedText
                  weight="bold"
                  style={[styles.detailLabel, {color: blockVisuals.accent}]}>
                  PRONUNCIATION
                </ThemedText>
                <ThemedText
                  numberOfLines={compact ? 2 : undefined}
                  style={[styles.languageSecondaryText, {color: muted}]}>
                  {block.secondary.trim()}
                </ThemedText>
              </View>
            )}
            {!!block.origin?.trim() && (
              <View style={styles.languageDetailGroup}>
                <ThemedText
                  weight="bold"
                  style={[styles.detailLabel, {color: blockVisuals.accent}]}>
                  WORD ORIGIN
                </ThemedText>
                <ThemedText
                  numberOfLines={compact ? 3 : undefined}
                  style={[styles.languageDetailText, {color: foreground}]}>
                  {block.origin.trim()}
                </ThemedText>
              </View>
            )}
            {!!block.reference?.trim() && (
              <View style={styles.languageDetailGroup}>
                <ThemedText
                  weight="bold"
                  style={[styles.detailLabel, {color: blockVisuals.accent}]}>
                  SCRIPTURE
                </ThemedText>
                <ThemedText
                  numberOfLines={compact ? 2 : undefined}
                  style={[styles.languageSecondaryText, {color: muted}]}>
                  {block.reference.trim()}
                </ThemedText>
              </View>
            )}
          </>
        );
      }

      if (block.kind === 'character') {
        const characterScripture = block.secondary || block.reference || '';
        return (
          <>
            {!!block.text?.trim() && (
              <ThemedText
                numberOfLines={compact ? 2 : undefined}
                style={[styles.characterName, {color: foreground}]}>
                {block.text.trim()}
              </ThemedText>
            )}
            {!!block.note?.trim() && (
              <ThemedText
                numberOfLines={compact ? 3 : undefined}
                style={[styles.characterReflection, {color: foreground}]}>
                {block.note.trim()}
              </ThemedText>
            )}
            {!!characterScripture.trim() && (
              <ThemedText
                numberOfLines={compact ? 2 : undefined}
                style={[styles.editorSecondaryText, {color: muted}]}>
                {characterScripture.trim()}
              </ThemedText>
            )}
          </>
        );
      }

      if (block.kind === 'reflection_question') {
        return (
          <>
            {!!block.text?.trim() && (
              <ThemedText
                numberOfLines={compact ? 3 : undefined}
                style={[styles.editorPrimaryText, {color: foreground}]}>
                {block.text.trim()}
              </ThemedText>
            )}
            {!!block.note?.trim() && (
              <>
                <ThemedText
                  weight="bold"
                  style={[
                    styles.detailLabel,
                    styles.reflectionAnswerLabel,
                    {color: blockVisuals.accent},
                  ]}>
                  ANSWER
                </ThemedText>
                <ThemedText
                  numberOfLines={compact ? 3 : undefined}
                  style={[styles.editorPrimaryText, {color: foreground}]}>
                  {block.note.trim()}
                </ThemedText>
              </>
            )}
          </>
        );
      }

      if (block.kind === 'scripture') {
        const scriptureReference =
          block.scriptureReference || block.reference || block.text;
        return (
          <View
            style={[
              styles.scripturePreview,
              {borderLeftColor: onDark ? 'rgba(255,255,255,0.42)' : accent},
            ]}>
            {!!block.scriptureText?.trim() && (
              <Text
                numberOfLines={compact ? 4 : undefined}
                style={[styles.scriptureText, {color: foreground}]}>
                {stripWrappingQuotationMarks(block.scriptureText)}
              </Text>
            )}
            {!!scriptureReference?.trim() && (
              <ThemedText
                weight="semiBold"
                numberOfLines={compact ? 2 : undefined}
                style={[
                  styles.scriptureReference,
                  {
                    color: onDark ? Colors.anchorBlueLight : accent,
                    marginTop: block.scriptureText?.trim() ? 8 : 0,
                  },
                ]}>
                {scriptureReference.trim()}
                {block.scriptureVersion ? ` · ${block.scriptureVersion}` : ''}
              </ThemedText>
            )}
          </View>
        );
      }

      const primaryText = block.text;
      const secondaryText =
        block.kind === 'quote' || block.kind === 'song' || block.kind === 'book'
          ? formatJournalAttribution(block.secondary?.trim())
          : block.secondary;
      const linkUrl =
        block.kind === 'link' ? normalizeJournalLink(block.text) : null;
      const usesSerifPrimary =
        block.kind === 'quote' ||
        block.kind === 'prayer' ||
        block.kind === 'song';
      const primaryStyle = [
        styles.editorPrimaryText,
        usesSerifPrimary && styles.serifPrimaryText,
        {color: foreground},
      ];

      return (
        <>
          {!!primaryText?.trim() && usesSerifPrimary ? (
            <Text numberOfLines={compact ? 3 : undefined} style={primaryStyle}>
              {primaryText.trim()}
            </Text>
          ) : !!primaryText?.trim() ? (
            <ThemedText
              numberOfLines={compact ? 3 : undefined}
              style={primaryStyle}>
              {primaryText.trim()}
            </ThemedText>
          ) : null}
          {!!secondaryText?.trim() && (
            <ThemedText
              numberOfLines={compact ? 2 : undefined}
              style={[styles.editorSecondaryText, {color: muted}]}>
              {secondaryText.trim()}
            </ThemedText>
          )}
          {linkUrl ? (
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel={`Open ${block.text.trim()}`}
              style={[
                styles.openLink,
                {
                  borderColor: blockVisuals.border,
                  backgroundColor: blockVisuals.headerSurface,
                },
              ]}
              onPress={() => {
                Linking.openURL(linkUrl).catch(() => {
                  Alert.alert(
                    'Could not open link',
                    'Please check the address.',
                  );
                });
              }}>
              <Ionicons
                name="open-outline"
                size={15}
                color={blockVisuals.accent}
              />
              <ThemedText
                weight="bold"
                style={[styles.openLinkText, {color: blockVisuals.accent}]}>
                Open link
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </>
      );
    };

    return (
      <NoteBlockFrame
        key={block.id}
        kind={block.kind}
        tone={onDark ? 'sage' : 'cream'}
        compact={compact}
        style={styles.savedFrame}
        headerContent={
          block.kind === 'outline' ? (
            <View style={styles.savedListHeader}>
              <JournalBlockIcon
                config={JOURNAL_BLOCKS.outline}
                size={compact ? 12 : 14}
                color={blockVisuals.accent}
              />
              {!!block.text?.trim() && (
                <ThemedText
                  weight="bold"
                  numberOfLines={compact ? 2 : undefined}
                  style={[styles.outlineHeaderTitle, {color: foreground}]}>
                  {block.text.trim()}
                </ThemedText>
              )}
            </View>
          ) : undefined
        }>
        {renderStandardContent()}
      </NoteBlockFrame>
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
    <View style={[styles.list, embedded && styles.embeddedList]}>
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
  embeddedList: {marginBottom: 0},
  textBlock: {
    minHeight: 44,
    paddingVertical: 6,
    fontSize: 16,
    lineHeight: 22,
  },
  sectionBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NOTE_BLOCK_METRICS.sectionDividerGap,
    paddingVertical: 15,
  },
  sectionLine: {
    width: NOTE_BLOCK_METRICS.sectionDividerWidth,
    height: NOTE_BLOCK_METRICS.sectionDividerThickness,
    borderRadius: NOTE_BLOCK_METRICS.sectionDividerThickness / 2,
  },
  outlineSectionBlock: {gap: 9},
  outlineSectionLine: {width: 4, minHeight: 28, borderRadius: 2},
  outlineSectionText: {
    fontSize: 18,
    lineHeight: 24,
  },
  sectionText: {flex: 1, fontSize: 18, lineHeight: 24},
  actionBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  actionText: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 23,
  },
  completedAction: {textDecorationLine: 'line-through', opacity: 0.65},
  savedListHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  savedList: {},
  savedListTitle: {flex: 1, fontSize: 15, lineHeight: 21},
  savedListRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  savedListMarker: {
    width: 23,
    paddingTop: 9,
    fontSize: 14,
    textAlign: 'right',
  },
  savedListText: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 7,
    fontSize: 14,
    lineHeight: 21,
  },
  listMoreText: {marginLeft: 31, fontSize: 11, lineHeight: 16},
  photoBlock: {width: '100%', alignSelf: 'stretch'},
  photo: {width: '100%', height: 220, borderRadius: 16},
  compactPhoto: {height: 124},
  caption: {paddingVertical: 10, fontSize: 14, lineHeight: 21},
  voiceBlock: {borderWidth: 1, borderRadius: 14, padding: 12},
  blockOnDark: {
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  blockOnLight: {
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
  },
  voiceRow: {flexDirection: 'row', alignItems: 'center'},
  voiceButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCopy: {flex: 1, marginLeft: 12},
  voiceTitle: {fontSize: 14, lineHeight: 20},
  voiceDuration: {fontSize: 12, lineHeight: 18},
  voiceNote: {paddingTop: 12, fontSize: 14, lineHeight: 21},
  savedFrame: {marginBottom: 0},
  editorPrimaryText: {
    minHeight: 54,
    paddingTop: 9,
    fontSize: 14,
    lineHeight: 21,
  },
  savedLanguageConnection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 9,
    padding: 10,
  },
  savedLanguageWordColumn: {flex: 1, gap: 4},
  savedLanguageArrow: {paddingHorizontal: 8},
  languageEnglishWord: {fontSize: 15, lineHeight: 21},
  languageOriginalWord: {
    fontFamily: Fonts.lora.bold,
    fontSize: 18,
    lineHeight: 25,
  },
  languageDetailGroup: {gap: 3, marginTop: 10},
  languageDetailText: {fontSize: 14, lineHeight: 21},
  languageSecondaryText: {fontSize: 12, lineHeight: 18},
  serifPrimaryText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  editorSecondaryText: {
    paddingTop: 7,
    fontSize: 12,
    lineHeight: 18,
  },
  editorDetailText: {
    minHeight: 54,
    marginTop: 8,
    paddingTop: 9,
    fontSize: 14,
    lineHeight: 21,
  },
  characterReflection: {
    minHeight: 46,
    marginTop: 2,
    paddingTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  scripturePreview: {
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    borderLeftWidth: 2,
  },
  scriptureText: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 28,
    opacity: 0.94,
  },
  scriptureReference: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailLabel: {fontSize: 9, lineHeight: 13, letterSpacing: 0.9},
  reflectionAnswerLabel: {marginTop: 12},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
  },
  chipText: {fontSize: 10, lineHeight: 14},
  characterName: {
    minHeight: 38,
    paddingTop: 7,
    fontSize: 16,
    lineHeight: 21,
  },
  historyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  historyDetailText: {
    flex: 1,
    minHeight: 42,
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: 'center',
  },
  historyEra: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  outlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  firstOutlineRow: {marginTop: 10},
  outlineHeaderTitle: {flex: 1, fontSize: 17, lineHeight: 23},
  outlineNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineNumberText: {fontSize: 11, lineHeight: 14},
  outlineMarker: {
    width: 20,
    fontSize: 11,
    lineHeight: 20,
    textAlign: 'center',
  },
  outlineText: {flex: 1, fontSize: 13, lineHeight: 20},
  openLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 18,
  },
  openLinkText: {fontSize: 11, lineHeight: 15},
  tableScroll: {marginHorizontal: -12},
  tableRow: {flexDirection: 'row'},
  fullWidthTable: {width: '100%'},
  tableCell: {
    width: 126,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  tableHeaderCell: {minHeight: 40},
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
