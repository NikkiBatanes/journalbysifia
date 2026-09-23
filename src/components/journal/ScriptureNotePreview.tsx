import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../common/ThemedText';
import SavedReflectionBlocks from './SavedReflectionBlocks';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import type {JournalBlock} from './shared/journalBlocks';

export const SCRIPTURE_NOTE_LABEL = 'SCRIPTURE NOTE';
export const SCRIPTURE_NOTE_SECTION_LABEL = 'Scripture Notes';
export const SCRIPTURE_NOTE_ICON = 'script-text-outline' as const;

export const ScriptureNoteIcon = ({
  size = 19,
  color = Colors.sage,
}: {
  size?: number;
  color?: string;
}) => (
  <MaterialCommunityIcons
    name={SCRIPTURE_NOTE_ICON}
    size={size}
    color={color}
  />
);

export const ScriptureNotePreview = ({
  reference,
  version = 'NASB',
  journalBlocks = [],
  content = '',
  meta,
  metaRightInset = 0,
  metaMinHeight = 15,
  footerAction,
  blocksPointerEvents = 'box-none',
}: {
  reference: string;
  version?: string;
  journalBlocks?: JournalBlock[];
  content?: string;
  meta?: React.ReactNode;
  metaRightInset?: number;
  metaMinHeight?: number;
  footerAction?: React.ReactNode;
  blocksPointerEvents?: ViewProps['pointerEvents'];
}) => (
  <>
    {!!meta && (
      <View
        style={[
          styles.metaRow,
          {minHeight: metaMinHeight, paddingRight: metaRightInset},
        ]}>
        {meta}
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
      <View pointerEvents={blocksPointerEvents} style={styles.blocks}>
        <SavedReflectionBlocks blocks={journalBlocks} compact />
      </View>
    ) : !!content.trim() ? (
      <View style={styles.contentBlock}>
        <ThemedText
          numberOfLines={5}
          ellipsizeMode="tail"
          style={styles.content}>
          {content.trim()}
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
      {footerAction}
    </View>
  </>
);

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
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
});
