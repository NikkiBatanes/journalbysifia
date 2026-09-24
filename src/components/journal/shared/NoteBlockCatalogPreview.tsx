import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';

import {SavedReflectionBlocks} from '../SavedReflectionBlocks';
import {JournalAdvancedBlockEditor} from './JournalAdvancedBlockEditor';
import {JournalTableBlock} from './JournalTableBlock';
import {
  type JournalBlock,
  type NoteBlockDefinition,
  type SelectableJournalBlockKind,
} from './journalBlocks';
import {Colors} from '../../../theme/colors';

const previewPhotoUri = Image.resolveAssetSource(
  require('../../../../assets/images/reviews/weekly-cover-looking-back-v2.png'),
).uri;

const NOTE_BLOCK_PREVIEWS: Record<SelectableJournalBlockKind, JournalBlock[]> =
  {
    section: [
      {id: 'preview-section', kind: 'section', text: 'What I’m learning'},
    ],
    action: [
      {
        id: 'preview-action-1',
        kind: 'action',
        text: 'Pause before I respond',
        completed: true,
      },
      {
        id: 'preview-action-2',
        kind: 'action',
        text: 'Pray for wisdom',
        completed: false,
      },
    ],
    bullets: [
      {
        id: 'preview-bullets',
        kind: 'bullets',
        text: 'What stood out',
        points: [
          'Grace meets me here',
          'God is present in the waiting',
          'I can respond with trust',
        ],
      },
    ],
    numbered: [
      {
        id: 'preview-numbered',
        kind: 'numbered',
        text: 'Practice this truth',
        points: [
          'Pause and listen',
          'Write what comes to mind',
          'Choose one faithful response',
        ],
      },
    ],
    column: [
      {id: 'preview-column', kind: 'column', text: ''},
      {
        id: 'preview-column-left',
        kind: 'photo',
        text: 'A quiet reminder',
        uri: previewPhotoUri,
        parentColumnId: 'preview-column',
        columnSide: 'left',
      },
      {
        id: 'preview-column-right',
        kind: 'bullets',
        text: 'Ways to respond',
        points: ['Pause', 'Pray', 'Trust'],
        parentColumnId: 'preview-column',
        columnSide: 'right',
      },
    ],
    photo: [
      {
        id: 'preview-photo',
        kind: 'photo',
        text: 'A moment worth keeping',
        uri: previewPhotoUri,
      },
    ],
    voice: [
      {
        id: 'preview-voice',
        kind: 'voice',
        text: 'A thought I wanted to capture',
        uri: 'mock://voice-note',
        durationMillis: 24000,
      },
    ],
    scripture: [
      {
        id: 'preview-scripture',
        kind: 'scripture',
        text: 'Psalm 46:10',
        scriptureText: 'Be still, and know that I am God.',
        scriptureReference: 'Psalm 46:10',
        scriptureVersion: 'NIV',
      },
    ],
    key: [
      {id: 'preview-key', kind: 'key', text: 'Grace changes how I respond.'},
    ],
    quote: [
      {
        id: 'preview-quote',
        kind: 'quote',
        text: 'Our heart is restless until it rests in you.',
        secondary: 'Augustine',
      },
    ],
    song: [
      {
        id: 'preview-song',
        kind: 'song',
        text: 'Goodness of God',
        secondary: 'CeCe Winans',
      },
    ],
    outline: [
      {
        id: 'preview-outline',
        kind: 'outline',
        text: 'Living with trust',
        outlineStyle: 'numbered',
        points: ['Remember who God is', 'Respond with faith'],
      },
    ],
    character: [
      {
        id: 'preview-character',
        kind: 'character',
        text: 'Ruth',
        note: 'Faithful in uncertainty and generous in love.',
        secondary: 'Ruth 1:16',
      },
    ],
    language: [
      {
        id: 'preview-language',
        kind: 'language',
        text: 'חֶסֶד · hesed',
        languageKind: 'hebrew',
        languageDetails: ['meaning', 'origin'],
        meaning: 'Steadfast, covenant love',
        origin: 'A loyal love expressed through action',
        reference: 'Psalm 136:1',
      },
    ],
    link: [{id: 'preview-link', kind: 'link', text: 'sifia.app/resource'}],
    table: [
      {
        id: 'preview-table',
        kind: 'table',
        text: '',
        tableRows: [
          ['Notice', 'Respond'],
          ['God is near', 'Choose trust'],
        ],
        tableCellAlignments: [
          ['left', 'left'],
          ['left', 'left'],
        ],
      },
    ],
    history: [
      {
        id: 'preview-history',
        kind: 'history',
        text: '',
        historyTypes: ['era', 'culture'],
        secondary: 'First century',
        eraPeriod: 'AD',
        note: 'House churches lived out their faith within the Roman world.',
        reference: 'Romans 12:1–2',
      },
    ],
    remember: [
      {
        id: 'preview-remember',
        kind: 'remember',
        text: 'God met me in an ordinary moment.',
      },
    ],
    response: [
      {
        id: 'preview-response',
        kind: 'response',
        text: 'I want to walk this out with patience.',
      },
    ],
    question: [
      {
        id: 'preview-question',
        kind: 'question',
        text: 'What is God inviting me to notice?',
      },
    ],
    reflection_question: [
      {
        id: 'preview-reflection-question',
        kind: 'reflection_question',
        text: 'Where did I notice grace today?',
        note: 'In a conversation I almost rushed past.',
      },
    ],
    revisit: [
      {
        id: 'preview-revisit',
        kind: 'revisit',
        text: 'Come back to this truth later this week.',
      },
    ],
    prayer: [
      {
        id: 'preview-prayer',
        kind: 'prayer',
        text: 'God, help me carry this truth into today.',
      },
    ],
    book: [
      {
        id: 'preview-book',
        kind: 'book',
        text: 'Mere Christianity',
        secondary: '— C. S. Lewis',
      },
    ],
  };

export const NoteBlockCatalogPreview = ({
  definition,
  tone = 'default',
}: {
  definition: NoteBlockDefinition;
  tone?: 'default' | 'onDark';
}) => {
  const kind = definition.kind as SelectableJournalBlockKind;
  const onDark = tone === 'onDark';
  const fallbackHeight =
    kind === 'outline' || kind === 'history'
      ? 220
      : kind === 'character'
      ? 180
      : kind === 'column'
      ? 250
      : kind === 'language' || kind === 'table'
      ? 190
      : 150;
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const tablePreview = kind === 'table' ? NOTE_BLOCK_PREVIEWS.table[0] : null;
  const advancedPreview = ['outline', 'history', 'character'].includes(kind)
    ? NOTE_BLOCK_PREVIEWS[kind][0]
    : null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.viewport,
        onDark && styles.viewportOnDark,
        {height: measuredHeight || fallbackHeight},
      ]}>
      <View
        style={styles.scale}
        onLayout={({nativeEvent}) => {
          const height = Math.max(
            72,
            Math.ceil(nativeEvent.layout.height * 0.6) + 24,
          );
          setMeasuredHeight(current => (current === height ? current : height));
        }}>
        {tablePreview ? (
          <JournalTableBlock
            rows={tablePreview.tableRows}
            cellAlignments={tablePreview.tableCellAlignments}
            editing
            onChangeRows={() => undefined}
            onChangeCellAlignments={() => undefined}
            onChangeEditing={() => undefined}
            onDelete={() => undefined}
            registerInput={() => undefined}
            tone={tone}
          />
        ) : advancedPreview ? (
          <JournalAdvancedBlockEditor
            block={advancedPreview}
            onChange={() => undefined}
            onDelete={() => undefined}
            onFocus={() => undefined}
            onCreateSection={
              advancedPreview.kind === 'outline' ? () => undefined : undefined
            }
            registerInput={() => undefined}
            tone={tone}
          />
        ) : (
          <SavedReflectionBlocks
            blocks={NOTE_BLOCK_PREVIEWS[kind]}
            compact
            embedded
            onDark={onDark}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    padding: 6,
    borderRadius: 11,
    backgroundColor: Colors.lightBackground,
  },
  viewportOnDark: {
    backgroundColor: Colors.sage,
  },
  scale: {
    width: '166.6667%',
    transform: [{scale: 0.6}],
    transformOrigin: 'top left',
  },
});

export default NoteBlockCatalogPreview;
