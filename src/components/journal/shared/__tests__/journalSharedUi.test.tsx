import React from 'react';
import fs from 'fs';
import path from 'path';
import {Animated, StyleSheet} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';

jest.mock('../../../../hooks/useTheme', () => ({
  useTheme: () => ({currentFont: 'lexend'}),
}));

jest.mock('../../../common/ThemedText', () => {
  const ReactModule = require('react');
  const {Text} = require('react-native');
  return ({children, ...props}: any) =>
    ReactModule.createElement(Text, props, children);
});
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock(
  'react-native-vector-icons/MaterialCommunityIcons',
  () => 'MaterialCommunityIcons',
);
jest.mock('lucide-react-native', () => ({Pencil: 'Pencil'}));
jest.mock('../../../../services/scriptureReaderService', () => ({
  getScripturePassage: jest.fn().mockResolvedValue(null),
}));
jest.mock('react-native-sound', () => {
  const Sound: any = jest.fn();
  Sound.setCategory = jest.fn();
  Sound.MAIN_BUNDLE = '';
  return {__esModule: true, default: Sound};
});
jest.mock('../DraggableJournalBlock', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return ({children}: any) => ReactModule.createElement(View, null, children);
});
import {
  GENERIC_JOURNAL_BLOCK_KINDS,
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  NOTE_BLOCK_CATEGORIES,
  NOTE_BLOCK_CONTEXTS,
  NOTE_BLOCK_REGISTRY,
  SERMON_BLOCK_KINDS,
  createJournalBlock,
  formatJournalAttribution,
  getJournalTableCellAlignment,
  getNoteBlockDefinitionsForContext,
  hasMeaningfulJournalBlock,
  isBlockAllowedInContext,
  isJournalBlockKind,
  journalBlocksToPlainText,
  prepareJournalBlocksForSave,
} from '../journalBlocks';
import {REFLECTION_NOTE_TYPES} from '../../../../types/guidedReflection';
import {
  insertJournalBlock,
  removeJournalBlock,
  reorderJournalBlock,
  resolveJournalBlockDropIndex,
  updateJournalBlock,
} from '../journalBlockOperations';
import {JournalComposerBar, JournalPickerMenu} from '../JournalComposer';
import {JournalColumnBlock} from '../JournalColumnBlock';
import {JournalTableBlock} from '../JournalTableBlock';
import {ReflectionQuestionCard} from '../ReflectionQuestionCard';
import {NoteBlockFrame} from '../NoteBlockFrame';
import {JournalBlockEditor} from '../JournalBlockEditor';
import SavedReflectionBlocks from '../../SavedReflectionBlocks';
import ReflectionSpecialBlock from '../../ReflectionSpecialBlock';
import {Colors} from '../../../../theme/colors';
import {noteBlockPreferences} from '../../../../services/noteBlockPreferences';
import {
  NOTE_BLOCK_METRICS,
  getNoteBlockVisuals,
  resolveNoteBlockTone,
} from '../noteBlockTheme';

describe('shared Journal UI extraction', () => {
  it('preserves the complete persisted Sermon registry and generic subset', () => {
    expect(Object.keys(JOURNAL_BLOCKS)).toEqual([
      'text',
      'section',
      'action',
      'bullets',
      'numbered',
      'column',
      'photo',
      'voice',
      'scripture',
      'key',
      'quote',
      'song',
      'outline',
      'character',
      'language',
      'link',
      'table',
      'history',
      'remember',
      'response',
      'question',
      'reflection_question',
      'revisit',
      'prayer',
      'book',
    ]);
    expect(SERMON_BLOCK_KINDS).toHaveLength(24);
    expect(SERMON_BLOCK_KINDS.slice(0, 8)).toEqual([
      'section',
      'action',
      'bullets',
      'numbered',
      'column',
      'table',
      'photo',
      'voice',
    ]);
    expect(GENERIC_JOURNAL_BLOCK_KINDS).toEqual([
      'text',
      'scripture',
      'quote',
      'key',
      'remember',
      'question',
      'response',
    ]);
    expect(
      REFLECTION_NOTE_TYPES.find(item => item.kind === 'column'),
    ).toMatchObject({
      label: '2 Columns',
      icon: 'view-split-vertical',
      iconFamily: 'MaterialCommunityIcons',
    });
    expect(JOURNAL_BLOCK_GAP).toBe(12);
  });

  it('derives every context catalog from one validated note-block registry', () => {
    expect(NOTE_BLOCK_REGISTRY).toBe(JOURNAL_BLOCKS);
    expect(NOTE_BLOCK_CONTEXTS).toEqual(['reflection', 'scripture', 'session']);
    expect(NOTE_BLOCK_CATEGORIES.map(category => category.id)).toEqual([
      'writing',
      'structure',
      'capture',
      'highlights',
      'reflect',
      'resources',
      'study',
    ]);
    expect(
      getNoteBlockDefinitionsForContext('reflection').map(item => item.kind),
    ).toEqual(REFLECTION_NOTE_TYPES.map(item => item.kind));
    expect(
      getNoteBlockDefinitionsForContext('scripture').map(item => item.kind),
    ).toEqual(REFLECTION_NOTE_TYPES.map(item => item.kind));
    expect(
      getNoteBlockDefinitionsForContext('session').map(item => item.kind),
    ).toEqual(SERMON_BLOCK_KINDS);
    NOTE_BLOCK_CONTEXTS.forEach(context => {
      expect(getNoteBlockDefinitionsForContext(context)).toHaveLength(24);
      expect(
        getNoteBlockDefinitionsForContext(context).map(item => item.kind),
      ).toEqual(SERMON_BLOCK_KINDS);
    });
    expect(
      getNoteBlockDefinitionsForContext('session', {includeWrite: true})[0]
        .kind,
    ).toBe('text');
  });

  it('keeps persisted IDs stable and records context and nesting capabilities', () => {
    expect(isJournalBlockKind('outline')).toBe(true);
    expect(isJournalBlockKind('sticker')).toBe(false);
    expect(isBlockAllowedInContext('outline', 'session')).toBe(true);
    expect(isBlockAllowedInContext('outline', 'reflection')).toBe(true);
    expect(isBlockAllowedInContext('character', 'scripture')).toBe(true);
    expect(NOTE_BLOCK_REGISTRY.column.allowInColumn).toBe(false);
    expect(NOTE_BLOCK_REGISTRY.table.allowInColumn).toBe(false);
    expect(NOTE_BLOCK_REGISTRY.quote.allowInColumn).toBe(true);
    Object.entries(NOTE_BLOCK_REGISTRY).forEach(([kind, definition]) => {
      expect(definition.kind).toBe(kind);
      expect(definition.pickerLabel).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(definition.category).toBeTruthy();
    });
  });

  it('renders advanced block editing through the shared editor', () => {
    const onChange = jest.fn();
    const view = render(
      <JournalBlockEditor
        block={createJournalBlock('outline', 'outline-editor')}
        styles={{}}
        registerInput={jest.fn()}
        onChange={onChange}
        onDelete={jest.fn()}
        bibleVersion="NASB"
      />,
    );

    expect(view.getByText('MESSAGE OUTLINE')).toBeTruthy();
    expect(view.getAllByPlaceholderText(/Outline point/)).toHaveLength(3);
    fireEvent.press(view.getByText('Simple'));
    expect(onChange).toHaveBeenCalledWith({outlineStyle: 'simple'});
    fireEvent.press(view.getByText('＋ Add outline point'));
    expect(onChange).toHaveBeenCalledWith({points: ['', '', '', '']});
  });

  it('preserves advanced fields in the legacy text projection', () => {
    const text = journalBlocksToPlainText([
      {
        ...createJournalBlock('character', 'character'),
        text: 'Ruth',
        note: 'Faithful in uncertainty',
        secondary: 'Ruth 1:16',
      },
      {
        ...createJournalBlock('language', 'language'),
        text: 'agape',
        meaning: 'Self-giving love',
        origin: 'Greek usage',
        reference: '1 Corinthians 13',
      },
      {
        ...createJournalBlock('history', 'history'),
        secondary: 'First century AD',
        note: 'Written into a divided city',
        reference: 'Ephesians 2',
      },
    ]);

    expect(text).toContain(
      'BIBLE CHARACTER\nRuth\nFaithful in uncertainty\nRuth 1:16',
    );
    expect(text).toContain(
      'LANGUAGE NOTE\nagape\nSelf-giving love\nGreek usage\n1 Corinthians 13',
    );
    expect(text).toContain(
      'HISTORICAL CONTEXT\nFirst century AD\nWritten into a divided city\nEphesians 2',
    );
  });

  it('uses one semantic visual system for sage and cream block surfaces', () => {
    expect(resolveNoteBlockTone('default')).toBe('cream');
    expect(resolveNoteBlockTone('onDark')).toBe('sage');
    expect(getNoteBlockVisuals('quote', 'cream')).toMatchObject({
      tone: 'cream',
      surface: '#F4F3ED',
      accent: Colors.sage,
    });
    expect(getNoteBlockVisuals('scripture', 'sage')).toMatchObject({
      tone: 'sage',
      foreground: Colors.hopeWhite,
      surface: 'rgba(220,232,222,0.14)',
    });
    expect(NOTE_BLOCK_METRICS).toMatchObject({
      gap: JOURNAL_BLOCK_GAP,
      radius: 14,
      padding: 12,
      bodySize: 14,
      bodyLineHeight: 21,
    });
  });

  it('renders the same accessible block frame in both visual tones', () => {
    const onDelete = jest.fn();
    const cream = render(
      <NoteBlockFrame kind="key" tone="cream" onDelete={onDelete}>
        <></>
      </NoteBlockFrame>,
    );
    expect(cream.getByText('KEY POINT')).toBeTruthy();
    fireEvent.press(cream.getByLabelText('Remove Key Point block'));
    expect(onDelete).toHaveBeenCalledTimes(1);

    const sage = render(
      <NoteBlockFrame kind="scripture" tone="sage">
        <></>
      </NoteBlockFrame>,
    );
    expect(sage.getByText('SCRIPTURE')).toBeTruthy();
  });

  it('uses a short left horizontal divider and bold title for Section blocks', () => {
    const view = render(
      <ReflectionSpecialBlock
        block={{...createJournalBlock('section'), text: 'What stood out'}}
        onChange={jest.fn()}
        onDelete={jest.fn()}
        registerInput={jest.fn()}
      />,
    );
    expect(
      StyleSheet.flatten(
        view.getByPlaceholderText('Section title').props.style,
      ),
    ).toMatchObject({
      fontFamily: 'Lexend-Bold',
      minHeight: 40,
      paddingVertical: 0,
      textAlignVertical: 'center',
    });
    expect(
      StyleSheet.flatten(view.getByTestId('section-title-divider').props.style),
    ).toMatchObject({width: 32, height: 2, borderRadius: 1});

    const savedView = render(
      <SavedReflectionBlocks
        blocks={[{...createJournalBlock('section'), text: 'What stood out'}]}
      />,
    );
    expect(savedView.getByText('What stood out').props).toMatchObject({
      weight: 'bold',
    });
    expect(
      StyleSheet.flatten(
        savedView.getByTestId('section-title-divider').props.style,
      ),
    ).toMatchObject({width: 32, height: 2, borderRadius: 1});

    const sermon = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    expect(sermon).toContain('width:32px;height:2px');
  });

  it('keeps sections started from Message Outline in the original style', () => {
    const block = {
      ...createJournalBlock('section'),
      text: 'Grace in practice',
      sectionSource: 'outline' as const,
    };
    const editor = render(
      <ReflectionSpecialBlock
        block={block}
        onChange={jest.fn()}
        onDelete={jest.fn()}
        registerInput={jest.fn()}
      />,
    );
    expect(
      StyleSheet.flatten(
        editor.getByTestId('outline-section-marker').props.style,
      ),
    ).toMatchObject({width: 4, height: 30, borderRadius: 2});
    expect(editor.queryByTestId('section-title-divider')).toBeNull();

    const saved = render(<SavedReflectionBlocks blocks={[block]} />);
    expect(
      StyleSheet.flatten(
        saved.getByTestId('outline-section-marker').props.style,
      ),
    ).toMatchObject({width: 4, minHeight: 28, borderRadius: 2});
    expect(
      StyleSheet.flatten(saved.getByText('Grace in practice').props.style),
    ).toMatchObject({fontFamily: 'Lora-Bold'});
    expect(saved.queryByTestId('section-title-divider')).toBeNull();

    const sermon = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    expect(sermon).toContain("sectionSource: 'outline'");
    expect(sermon).toContain('border-left:4px solid #526A5B');
  });

  it('matches every Scripture block to the Scripture Note passage format', () => {
    const lookup = fs.readFileSync(
      path.resolve(__dirname, '../ScriptureLookupInput.tsx'),
      'utf8',
    );
    expect(lookup).not.toContain('name="search"');
    expect(lookup).toMatch(/preview:\s*\{[\s\S]*?borderLeftWidth: 2/);
    expect(lookup).toMatch(/previewText:\s*\{[\s\S]*?fontStyle: 'italic'/);
    expect(lookup).toContain(
      '<Text style={[sharedStyles.previewText, {color: foreground}]}>',
    );
    expect(lookup).not.toContain(
      '<ThemedText style={[sharedStyles.previewText, {color: foreground}]}>',
    );
    expect(lookup).toContain('{(searchActive || !resolvedVerse) && (');
    expect(lookup).toContain('onBlur={() => setSearchActive(false)}');
    expect(lookup).toContain('accessibilityLabel="Edit scripture reference"');
    expect(lookup).toContain('onPress={activateSearch}');
    expect(lookup).toMatch(
      /previewReference:\s*\{[\s\S]*?textTransform: 'uppercase'/,
    );
    expect(lookup).toContain('stripWrappingQuotationMarks(resolvedVerse.text)');

    const editors = [
      fs.readFileSync(
        path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../screens/ScriptureNoteEditorScreen.tsx',
        ),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(__dirname, '../JournalNestedBlockEditor.tsx'),
        'utf8',
      ),
    ];
    editors.forEach(source => {
      expect(source).toContain('<ScriptureLookupInput');
      expect(source).toContain('scriptureText: result?.text');
      expect(source).toContain('scriptureReference: result?.reference');
      expect(source).toContain('scriptureVersion: result?.version');
    });

    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    expect(saved).toMatch(
      /block\.kind === 'scripture'[\s\S]*?styles\.scripturePreview/,
    );
    expect(saved).toMatch(/scriptureText:\s*\{[\s\S]*?fontStyle: 'italic'/);
    expect(saved).toMatch(
      /<Text[\s\S]*?styles\.scriptureText[\s\S]*?stripWrappingQuotationMarks\(block\.scriptureText\)/,
    );
  });

  it('renders every specialized field through the shared saved-block renderer', () => {
    const view = render(
      <SavedReflectionBlocks
        blocks={[
          {
            ...createJournalBlock('outline', 'outline'),
            text: 'Grace',
            points: ['Receive it', 'Share it'],
          },
          {
            ...createJournalBlock('history', 'history'),
            historyTypes: ['era', 'place'],
            secondary: 'First century',
            eraPeriod: 'AD',
            note: 'Written into a divided city.',
            reference: 'Ephesians 2',
          },
          {
            ...createJournalBlock('language', 'language'),
            text: 'agape',
            languageKind: 'greek',
            languageDetails: ['meaning', 'origin'],
            meaning: 'Self-giving love',
            origin: 'Greek usage',
            reference: '1 Corinthians 13',
          },
          {
            ...createJournalBlock('character', 'character'),
            text: 'Ruth',
            note: 'Faithful in uncertainty',
            secondary: 'Ruth 1:16',
          },
          {
            ...createJournalBlock('reflection_question', 'reflection'),
            text: 'Where can I trust?',
            note: 'In the waiting.',
          },
        ]}
      />,
    );

    [
      'Grace',
      'Receive it',
      'Written into a divided city.',
      'Ephesians 2',
      'agape',
      'Self-giving love',
      'Greek usage',
      'Faithful in uncertainty',
      'Where can I trust?',
      'In the waiting.',
    ].forEach(value => expect(view.getByText(value)).toBeTruthy());
  });

  it('creates, inserts, edits, and removes stable blocks without disturbing siblings', () => {
    const first = createJournalBlock('quote', 'stable-quote');
    const insertion = insertJournalBlock(
      [first],
      'remember',
      'stable-remember',
    );
    expect(insertion.blocks.map(block => block.id)).toEqual([
      'stable-quote',
      'stable-remember',
    ]);
    const edited = updateJournalBlock(insertion.blocks, 'stable-quote', {
      text: 'Keep this',
    });
    expect(edited[0]).toMatchObject({
      id: 'stable-quote',
      kind: 'quote',
      text: 'Keep this',
    });
    expect(removeJournalBlock(edited, 'stable-quote')).toEqual([
      insertion.block,
    ]);
  });

  it('inserts beneath the active block and reorders blocks without changing their data', () => {
    const first = createJournalBlock('text', 'first');
    const last = {...createJournalBlock('quote', 'last'), text: 'Keep me'};
    const insertion = insertJournalBlock(
      [first, last],
      'remember',
      'middle',
      'first',
    );

    expect(insertion.blocks.map(block => block.id)).toEqual([
      'first',
      'middle',
      'last',
    ]);
    const reordered = reorderJournalBlock(insertion.blocks, 'last', 0);
    expect(reordered.map(block => block.id)).toEqual([
      'last',
      'first',
      'middle',
    ]);
    expect(reordered[0]).toMatchObject({kind: 'quote', text: 'Keep me'});
  });

  it('resolves a live drop target as a dragged block crosses its neighbors', () => {
    const blocks = ['first', 'photo', 'response'].map(id => ({id}));
    const layouts = new Map([
      ['first', {y: 0, height: 80}],
      ['photo', {y: 92, height: 220}],
      ['response', {y: 324, height: 100}],
    ]);

    expect(resolveJournalBlockDropIndex(blocks, layouts, 'photo', 0)).toBe(1);
    expect(resolveJournalBlockDropIndex(blocks, layouts, 'photo', 180)).toBe(2);
    expect(resolveJournalBlockDropIndex(blocks, layouts, 'photo', -170)).toBe(
      0,
    );
  });

  it('drops empty note types while keeping media that has saved content', () => {
    expect(hasMeaningfulJournalBlock(createJournalBlock('action'))).toBe(false);
    expect(hasMeaningfulJournalBlock(createJournalBlock('section'))).toBe(
      false,
    );
    expect(hasMeaningfulJournalBlock(createJournalBlock('bullets'))).toBe(
      false,
    );
    expect(hasMeaningfulJournalBlock(createJournalBlock('numbered'))).toBe(
      false,
    );
    expect(hasMeaningfulJournalBlock(createJournalBlock('table'))).toBe(false);
    expect(
      hasMeaningfulJournalBlock({
        ...createJournalBlock('action'),
        text: 'Follow up',
      }),
    ).toBe(true);
    expect(
      hasMeaningfulJournalBlock({
        ...createJournalBlock('photo'),
        uri: 'file:///photo.jpg',
      }),
    ).toBe(true);
    expect(
      hasMeaningfulJournalBlock({
        ...createJournalBlock('voice'),
        uri: 'file:///voice.m4a',
      }),
    ).toBe(true);
    expect(
      hasMeaningfulJournalBlock({
        ...createJournalBlock('bullets'),
        points: ['Remember this'],
      }),
    ).toBe(true);
  });

  it('removes empty list items before saving', () => {
    const bullets = {
      ...createJournalBlock('bullets'),
      text: 'Things to remember',
      points: ['First', '   ', '', 'Last'],
    };
    const emptyNumbered = {
      ...createJournalBlock('numbered'),
      points: ['', '  '],
    };

    expect(prepareJournalBlocksForSave([bullets, emptyNumbered])).toEqual([
      {...bullets, points: ['First', 'Last']},
    ]);
  });

  it('keeps a column only when one of its left or right blocks has content', () => {
    const column = createJournalBlock('column', 'column-1');
    const emptyLeft = {
      ...createJournalBlock('section', 'left-empty'),
      parentColumnId: column.id,
      columnSide: 'left' as const,
    };
    const rightQuote = {
      ...createJournalBlock('quote', 'right-quote'),
      text: 'Grace meets me here.',
      parentColumnId: column.id,
      columnSide: 'right' as const,
    };

    expect(prepareJournalBlocksForSave([column, emptyLeft])).toEqual([]);
    expect(
      prepareJournalBlocksForSave([column, emptyLeft, rightQuote]),
    ).toEqual([column, rightQuote]);
  });

  it('formats quote speakers and authors with one automatic em dash', () => {
    expect(formatJournalAttribution('')).toBe('');
    expect(formatJournalAttribution('Maya Angelou')).toBe('— Maya Angelou');
    expect(formatJournalAttribution('— Maya Angelou')).toBe('— Maya Angelou');
    const inlineBlock = fs.readFileSync(
      path.resolve(__dirname, '../JournalInlineBlock.tsx'),
      'utf8',
    );
    expect(inlineBlock).toContain('{fontFamily: attributionFontFamily}');
  });

  it('forwards every composer action and supports the open add state', () => {
    const handlers = {
      back: jest.fn(),
      write: jest.fn(),
      add: jest.fn(),
      next: jest.fn(),
    };
    const animations = [0, 1, 2, 3].map(() => new Animated.Value(1));
    const view = render(
      <JournalComposerBar
        onBack={handlers.back}
        onWrite={handlers.write}
        onAdd={handlers.add}
        onNext={handlers.next}
        addOpen
        plusRotation={new Animated.Value(1)}
        pickerColorAnim={new Animated.Value(1)}
        actionAnimations={animations}
      />,
    );
    fireEvent.press(view.getByLabelText('Back'));
    fireEvent.press(view.getByLabelText('Write'));
    fireEvent.press(view.getByLabelText('Close note type picker'));
    fireEvent.press(view.getByLabelText('Next'));
    Object.values(handlers).forEach(handler =>
      expect(handler).toHaveBeenCalledTimes(1),
    );
  });

  it('visually distinguishes a disabled Next or Save action', () => {
    const onNext = jest.fn();
    const view = render(
      <JournalComposerBar
        onBack={jest.fn()}
        onWrite={jest.fn()}
        onAdd={jest.fn()}
        onNext={onNext}
        addOpen={false}
        plusRotation={new Animated.Value(0)}
        pickerColorAnim={new Animated.Value(0)}
        actionAnimations={[0, 1, 2, 3].map(() => new Animated.Value(1))}
        nextIcon="checkmark"
        nextLabel="Save reflection"
        nextDisabled
        tone="onDark"
      />,
    );
    const save = view.getByLabelText('Save reflection');
    expect(save.props.accessibilityState).toEqual({disabled: true});
    expect(StyleSheet.flatten(save.props.style)).toMatchObject({opacity: 0.4});
    fireEvent.press(save);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('renders the extracted approved question card and Reflect callback', () => {
    const onReflect = jest.fn();
    const styles = StyleSheet.create({
      promptCard: {},
      lockIconContainer: {},
      promptTextContainer: {},
      promptCardText: {},
      reflectLabel: {},
      buttonIcon: {},
      reflectLabelText: {},
    });
    const view = render(
      <ReflectionQuestionCard
        question="Where is God inviting trust?"
        onReflect={onReflect}
        styles={styles}
      />,
    );
    expect(view.getByText('Where is God inviting trust?')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Reflect'));
    expect(onReflect).toHaveBeenCalledTimes(1);
  });

  it('uses an unlimited favorites bar and a categorized all-blocks sheet', () => {
    jest.useFakeTimers();
    const favoriteSpy = jest
      .spyOn(noteBlockPreferences, 'toggleFavoriteKind')
      .mockResolvedValue(true);
    try {
      const composer = fs.readFileSync(
        path.resolve(__dirname, '../JournalComposer.tsx'),
        'utf8',
      );
      const catalogPreview = fs.readFileSync(
        path.resolve(__dirname, '../NoteBlockCatalogPreview.tsx'),
        'utf8',
      );
      const onboarding = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../screens/journalOnboarding/JournalOnboardingScreen.tsx',
        ),
        'utf8',
      );
      expect(composer).toContain(
        'favorites.length ? favorites : visibleItems.slice(0, 5)',
      );
      expect(composer).toContain('preferences.favoriteKinds');
      expect(composer).toContain('Browse all note blocks');
      expect(composer).toContain('NOTE_BLOCK_CATEGORIES.map');
      expect(composer).toContain('[0, 1].map(columnIndex =>');
      expect(composer).toContain('definition={definition}');
      expect(composer).toContain('tone={tone}');
      expect(catalogPreview).toContain("const onDark = tone === 'onDark'");
      expect(catalogPreview).toContain('onDark={onDark}');
      expect(catalogPreview).toMatch(/<JournalTableBlock[\s\S]*?tone=\{tone\}/);
      expect(catalogPreview).toMatch(
        /<JournalAdvancedBlockEditor[\s\S]*?tone=\{tone\}/,
      );
      expect(catalogPreview).not.toContain('<ReflectionSpecialBlock');
      expect(catalogPreview).toMatch(
        /<SavedReflectionBlocks[\s\S]*?blocks=\{NOTE_BLOCK_PREVIEWS\[kind\]\}[\s\S]*?onDark=\{onDark\}/,
      );
      expect(catalogPreview).toContain('backgroundColor: Colors.sage');
      expect(onboarding).toMatch(
        /<SavedReflectionBlocks[\s\S]*?blocks=\{NOTE_BLOCK_MOCKUPS\[kind\]\}/,
      );
      expect(onboarding).not.toContain('mock-outline-section');
      expect(composer).toContain(
        'Tap to add. Long press to add or remove a favorite.',
      );
      expect(composer).toContain('animationType="none"');
      expect(composer).toContain('{opacity: backdropOpacity}');
      expect(composer).toContain(
        '{transform: [{translateY: sheetTranslateY}]}',
      );
      expect(composer).not.toContain('animationType="slide"');
      expect(composer).toContain('createJournalPickerEntrance');
      expect(composer).toContain('Animated.stagger(\n    52');
      expect(composer).toContain('outputRange: [0.72, 1]');
      expect(composer).not.toContain('outputRange: [8, 0]');
      expect(composer).toContain(
        'Animated.delay(290 + Math.max(0, initialItems.length - 1) * 52)',
      );
      expect(composer).toContain('duration: 320');
      expect(composer).toContain('outputRange: [0.96, 1]');
      expect(composer).toMatch(
        /const openAllBlocks[\s\S]*?triggerLightHaptic\(\)/,
      );
      expect(composer).toMatch(
        /const closeAllBlocks[\s\S]*?shouldTriggerHaptic[\s\S]*?triggerLightHaptic\(\)/,
      );
      expect(composer).toMatch(
        /const toggleFavorite[\s\S]*?triggerSelectionHaptic\(\)/,
      );
      expect(composer).toContain('closeAllBlocks(() => onSelect(key), false)');

      const pickerConsumers = [
        fs.readFileSync(
          path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
          'utf8',
        ),
        fs.readFileSync(
          path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
          'utf8',
        ),
        fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../../screens/ScriptureNoteEditorScreen.tsx',
          ),
          'utf8',
        ),
        fs.readFileSync(
          path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
          'utf8',
        ),
      ];
      pickerConsumers.forEach(source => {
        expect(source).toContain('createJournalPickerEntrance(');
      });

      const onSelect = jest.fn();
      const kinds = [
        'section',
        'action',
        'bullets',
        'numbered',
        'photo',
        'quote',
      ] as const;
      const view = render(
        <JournalPickerMenu
          items={kinds.map(kind => ({key: kind, label: kind, icon: <></>}))}
          animations={kinds.map(() => new Animated.Value(1))}
          onSelect={onSelect}
        />,
      );
      const quickBar = view.getByLabelText('Quick note blocks');
      expect(quickBar).toBeTruthy();
      expect(view.queryByText('Add a block')).toBeNull();
      expect(StyleSheet.flatten(quickBar.props.style)).toMatchObject({
        alignSelf: 'stretch',
        marginHorizontal: -18,
      });
      expect(StyleSheet.flatten(quickBar.props.style)).not.toHaveProperty(
        'backgroundColor',
      );
      expect(StyleSheet.flatten(quickBar.props.style)).not.toHaveProperty(
        'elevation',
      );
      expect(StyleSheet.flatten(quickBar.props.style)).not.toHaveProperty(
        'borderWidth',
      );
      expect(StyleSheet.flatten(quickBar.props.style)).not.toHaveProperty(
        'borderTopWidth',
      );
      expect(StyleSheet.flatten(quickBar.props.style)).not.toHaveProperty(
        'borderBottomWidth',
      );
      fireEvent.press(view.getByLabelText('Add Section block'));
      expect(onSelect).toHaveBeenCalledWith('section');

      fireEvent.press(view.getByLabelText('Browse all note blocks'));
      expect(view.getByText('HIGHLIGHTS')).toBeTruthy();
      const quoteButtons = view.getAllByLabelText('Add Quote block');
      fireEvent(quoteButtons[quoteButtons.length - 1], 'longPress');
      expect(favoriteSpy).toHaveBeenCalledWith('quote');
      fireEvent.press(quoteButtons[quoteButtons.length - 1]);
      expect(onSelect).not.toHaveBeenCalledWith('quote');
      act(() => jest.advanceTimersByTime(350));
      expect(onSelect).toHaveBeenCalledWith('quote');
    } finally {
      favoriteSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('dismisses every block picker before opening the native photo library', () => {
    const sources = [
      fs.readFileSync(
        path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../screens/ScriptureNoteEditorScreen.tsx',
        ),
        'utf8',
      ),
    ];
    sources.forEach(source => {
      expect(source).toMatch(
        /kind === 'photo'[\s\S]*?closeNotePicker\(async \(\) => \{[\s\S]*?pickImageLocal\(\)/,
      );
    });

    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    expect(session).toMatch(
      /kind === 'photo'[\s\S]*?closeCapturePicker\(async \(\) => \{[\s\S]*?pickImageLocal\(\)/,
    );
  });

  it('uses the contrasting picker treatment on green journal screens', () => {
    const view = render(
      <JournalPickerMenu
        items={[{key: 'section', label: 'Section', icon: <></>}]}
        animations={[new Animated.Value(1)]}
        onSelect={jest.fn()}
        tone="onDark"
      />,
    );
    expect(
      StyleSheet.flatten(view.getByText('Browse').props.style),
    ).toMatchObject({color: Colors.hopeWhite});
    expect(
      StyleSheet.flatten(
        view.getByLabelText('Browse all note blocks').props.style,
      ),
    ).toMatchObject({
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
    });
    expect(
      StyleSheet.flatten(view.getByLabelText('Add Section block').props.style),
    ).toMatchObject({
      backgroundColor: '#5E7A6B',
      borderColor: 'rgba(255,255,255,0.2)',
    });
    fireEvent.press(view.getByLabelText('Browse all note blocks'));
    expect(
      StyleSheet.flatten(
        view.getByLabelText('Note block browser sheet').props.style,
      ),
    ).toMatchObject({backgroundColor: Colors.sage});
    expect(
      StyleSheet.flatten(view.getByText('Add a note block').props.style),
    ).toMatchObject({color: Colors.hopeWhite});
    const sectionButtons = view.getAllByLabelText('Add Section block');
    expect(
      StyleSheet.flatten(sectionButtons[sectionButtons.length - 1].props.style),
    ).toMatchObject({
      borderColor: Colors.hopeWhite,
      backgroundColor: '#587264',
    });
    const greenEditors = [
      fs.readFileSync(
        path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
        'utf8',
      ),
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../screens/ScriptureNoteEditorScreen.tsx',
        ),
        'utf8',
      ),
    ];
    greenEditors.forEach(source => {
      expect(source).toMatch(/<JournalPickerMenu[\s\S]*?tone="onDark"/);
    });
  });

  it('exposes persisted note-block customization from the More tab', () => {
    const more = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/UserProfileScreen.tsx'),
      'utf8',
    );
    const preferences = fs.readFileSync(
      path.resolve(__dirname, '../../../../services/noteBlockPreferences.ts'),
      'utf8',
    );
    expect(more).toContain('accessibilityLabel="Customize note blocks"');
    expect(more).toContain('renderNoteBlocksModal()');
    expect(more).toContain('noteBlockPreferences.toggleFavoriteKind(kind)');
    expect(more).toContain('noteBlockPreferences.setKindEnabled(kind, value)');
    expect(preferences).toContain("const STORAGE_KEY = 'prefs:noteBlocks:v2'");
    expect(preferences).toContain(
      "const LEGACY_STORAGE_KEY = 'prefs:noteBlocks:v1'",
    );
    expect(preferences).not.toContain('NOTE_BLOCK_QUICK_LIMIT');
    expect(preferences).toContain('canDisableKind');
  });

  it('makes Sermon and Guided Reflection consume the extracted components', () => {
    const sermon = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const guided = fs.readFileSync(
      path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
      'utf8',
    );
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    expect(sermon).toContain('<JournalBlockPickerMenu');
    expect(sermon).toContain('<JournalComposerBar');
    expect(sermon).not.toContain('<BlurView');
    expect(sermon).not.toContain('styles.androidBlur');
    expect(sermon).toContain('<JournalBlockEditor');
    expect(guided).toContain('<JournalPickerMenu');
    expect(guided).toContain('<JournalComposerBar');
    expect(guided).toContain('<JournalBlockEditor');
    expect(guided).toContain('<JournalColumnBlock');
    expect(guided).toContain('<JournalBlockIcon');
    expect(reflection).toContain('<JournalBlockIcon');
    expect(guided).toContain('<ReflectionQuestionCard');
  });

  it('routes every app note composer through the universal picker and frame system', () => {
    const composer = fs.readFileSync(
      path.resolve(__dirname, '../JournalComposer.tsx'),
      'utf8',
    );
    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const scripture = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/ScriptureNoteEditorScreen.tsx',
      ),
      'utf8',
    );
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const guided = fs.readFileSync(
      path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
      'utf8',
    );

    expect(composer).toContain('useNoteBlockPreferences()');
    [session, scripture, reflection, guided].forEach(source => {
      expect(source).toContain('<JournalComposerBar');
      expect(source).toMatch(/<Journal(?:Block)?PickerMenu/);
      expect(source).toContain('<JournalBlockEditor');
    });
    expect(session).toContain('<NoteBlockFrame');
    expect(session).toContain('<JournalTextInput');
  });

  it('keeps the table field shared by Session Notes and Reflection Log', () => {
    const sermon = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const detail = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/SermonNotesDetailScreen.tsx',
      ),
      'utf8',
    );
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const table = fs.readFileSync(
      path.resolve(__dirname, '../JournalTableBlock.tsx'),
      'utf8',
    );
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../JournalBlockEditor.tsx'),
      'utf8',
    );
    expect(sermon).toContain('<JournalBlockEditor');
    expect(reflection).toContain('<JournalBlockEditor');
    expect(editor).toContain("definition.renderMode === 'table'");
    expect(table).toContain('accessibilityLabel="Save table"');
    expect(table).toContain(
      '<Ionicons name="checkmark" size={17} color={accent} />',
    );
    expect(table).toMatch(
      /saveButton:\s*\{[\s\S]*?width: 32,[\s\S]*?height: 32,[\s\S]*?borderRadius: 16/,
    );
    expect(table).not.toContain('saveButtonText');
    expect(table).toContain('Add row');
    expect(table).toContain('Add column');
    expect(table).toContain("(['left', 'center', 'right'] as const)");
    expect(table).toContain('resolvedAlignments[rowIndex][columnIndex]');
    expect(editor).toContain('cellAlignments={block.tableCellAlignments}');
    expect(saved).toMatch(/<ScrollView\s+key=\{block\.id\}\s+horizontal/);
    expect(saved).toContain('getJournalTableCellAlignment(');
    expect(detail).toContain('blocks={blocksWithChildren}');
    expect(detail).toContain('embedded');
    expect(detail).not.toContain('getJournalTableCellAlignment(');
    expect(sermon).toContain(
      'savedTableHorizontalScroll: {marginBottom: JOURNAL_BLOCK_GAP}',
    );
  });

  it('aligns only the selected Table cell and preserves every other cell', () => {
    const onChangeCellAlignments = jest.fn();
    const view = render(
      <JournalTableBlock
        rows={[
          ['Name', 'Total'],
          ['Grace', '12'],
        ]}
        cellAlignments={[
          ['left', 'left'],
          ['left', 'left'],
        ]}
        editing
        onChangeRows={jest.fn()}
        onChangeCellAlignments={onChangeCellAlignments}
        onChangeEditing={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent(view.getByDisplayValue('12'), 'focus');
    fireEvent.press(view.getByLabelText('Align cell row 2 column 2 center'));
    expect(onChangeCellAlignments).toHaveBeenCalledWith([
      ['left', 'left'],
      ['left', 'center'],
    ]);
  });

  it('adds table rows and columns with one atomic structure update', () => {
    const onChangeRows = jest.fn();
    const onChangeCellAlignments = jest.fn();
    const view = render(
      <JournalTableBlock
        rows={[
          ['Name', 'Total'],
          ['Grace', '12'],
        ]}
        cellAlignments={[
          ['left', 'center'],
          ['right', 'left'],
        ]}
        editing
        onChangeRows={onChangeRows}
        onChangeCellAlignments={onChangeCellAlignments}
        onChangeEditing={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.press(view.getByLabelText('Add row'));
    expect(onChangeRows).toHaveBeenLastCalledWith(
      [
        ['Name', 'Total'],
        ['Grace', '12'],
        ['', ''],
      ],
      [
        ['left', 'center'],
        ['right', 'left'],
        ['left', 'left'],
      ],
    );

    fireEvent.press(view.getByLabelText('Add column'));
    expect(onChangeRows).toHaveBeenLastCalledWith(
      [
        ['Name', 'Total', ''],
        ['Grace', '12', ''],
      ],
      [
        ['left', 'center', 'left'],
        ['right', 'left', 'left'],
      ],
    );
    expect(onChangeCellAlignments).not.toHaveBeenCalled();
  });

  it('keeps legacy column alignments readable in older saved tables', () => {
    expect(getJournalTableCellAlignment(['left', 'right'], 0, 1)).toBe('right');
    expect(getJournalTableCellAlignment(['left', 'right'], 3, 1)).toBe('right');
    expect(
      getJournalTableCellAlignment(
        [
          ['center', 'left'],
          ['left', 'right'],
        ],
        1,
        1,
      ),
    ).toBe('right');
  });

  it('keeps structured Reflection Log blocks in the saved view and edit handoff', () => {
    const savedReflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogReactQuery.tsx'),
      'utf8',
    );
    expect(savedReflection).toContain('journal_blocks: entry.journal_blocks');
    expect(savedReflection).toContain('<SavedReflectionBlocks');
    expect(savedReflection).toContain('blocks={entry.journal_blocks}');
    expect(savedReflection).toContain('compact');
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const savedBlocks = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    expect(editor).toContain('journalBlocks.filter(');
    expect(editor).toContain('journalBlocks: meaningfulJournalBlocks');
    expect(editor).toContain(
      'secondaryInput: [s.secondaryInput, {fontFamily: fontFamilyRegular}]',
    );
    expect(savedBlocks).toContain('borderLeftWidth: 2');
    expect(savedBlocks).toContain('borderLeftColor: onDark');
    expect(savedBlocks).toContain('allVisibleBlocks.slice(0, 3)');
    expect(savedBlocks).toContain('firstPhoto');
    expect(savedBlocks).toContain('compactPhoto: {height: 124}');
    expect(savedBlocks).toContain("hiddenBlockCount === 1 ? 'note' : 'notes'");
  });

  it('opens saved reflections in view mode before exposing edit controls', () => {
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const screen = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/ReflectionEditorScreen.tsx'),
      'utf8',
    );
    const detail = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/SermonNotesDetailScreen.tsx',
      ),
      'utf8',
    );
    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const special = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'),
      'utf8',
    );
    expect(editor).toContain(
      'const [isEditMode, setIsEditMode] = React.useState(!isEditing)',
    );
    expect(editor).toContain('if (isEditing && !isEditMode)');
    expect(editor).toContain('accessibilityLabel="Edit reflection"');
    expect(editor).toContain('onToggleAction={handleToggleSavedAction}');
    expect(screen).toContain('updates: {journal_blocks: journalBlocks}');
    expect(detail).toContain('onToggleAction={handleToggleSavedAction}');
    expect(saved).toMatch(
      /checkbox:\s*\{[\s\S]*?width: 19,[\s\S]*?height: 19,[\s\S]*?borderRadius: 7/,
    );
    expect(special).toContain('width: 19');
    expect(special).toContain('borderRadius: 7');
  });

  it('refreshes Moments after a saved action is toggled', () => {
    const reflectionScreen = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/ReflectionEditorScreen.tsx'),
      'utf8',
    );
    const sessionDetail = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/SermonNotesDetailScreen.tsx',
      ),
      'utf8',
    );
    const moments = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/MomentsScreen.tsx'),
      'utf8',
    );
    expect(reflectionScreen).toContain(
      "DeviceEventEmitter.emit('reflection_saved'",
    );
    expect(sessionDetail).toContain("DeviceEventEmitter.emit('sermon_saved'");
    expect(reflectionScreen).toContain("type: 'action_toggled'");
    expect(sessionDetail).toContain("type: 'action_toggled'");
    expect(moments).toContain(
      "DeviceEventEmitter.addListener('reflection_saved'",
    );
    expect(moments).toContain("DeviceEventEmitter.addListener('sermon_saved'");
  });

  it('makes Section, Action, Photo, and Voice Note available throughout Session Notes', () => {
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const detail = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/SermonNotesDetailScreen.tsx',
      ),
      'utf8',
    );
    const specialBlocks = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'),
      'utf8',
    );
    expect(editor).toContain('<JournalBlockEditor');
    expect(specialBlocks).toContain("block.kind === 'photo'");
    expect(editor).toContain("kind === 'photo'");
    expect(editor).toContain("addBlock('photo', {uri: photo.uri})");
    expect(editor).not.toContain('styles.blockPickerScroll');
    expect(detail).toContain('blocks={blocksWithChildren}');
    expect(detail).toContain('<SavedReflectionBlocks');
    expect(specialBlocks).not.toContain('marginTop: 14');
    expect(specialBlocks).not.toContain('marginTop: 12');
    expect(specialBlocks).toContain('marginBottom: JOURNAL_BLOCK_GAP');
  });

  it('shares structured Bullets and Numbered blocks across Reflection and Session Notes', () => {
    expect(JOURNAL_BLOCKS.bullets.label).toBe('Bullets');
    expect(JOURNAL_BLOCKS.numbered.label).toBe('Numbered');
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const list = fs.readFileSync(
      path.resolve(__dirname, '../JournalListBlock.tsx'),
      'utf8',
    );
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../JournalBlockEditor.tsx'),
      'utf8',
    );
    expect(reflection).toContain('<JournalBlockEditor');
    expect(session).toContain('<JournalBlockEditor');
    expect(editor).toContain("definition.renderMode === 'list'");
    expect(editor).toContain('onChangeTitle={text => onChange({text})}');
    expect(list).toContain('placeholder="Add a title…"');
    expect(saved).toContain(
      "block.kind === 'bullets' || block.kind === 'numbered'",
    );
    expect(saved).toContain('{block.text.trim()}');
  });

  it('uses one uniform gap for every editable note block family', () => {
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const table = fs.readFileSync(
      path.resolve(__dirname, '../JournalTableBlock.tsx'),
      'utf8',
    );
    const list = fs.readFileSync(
      path.resolve(__dirname, '../JournalListBlock.tsx'),
      'utf8',
    );
    expect(reflection).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(session).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(table).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(list).toContain('marginBottom: JOURNAL_BLOCK_GAP');
  });

  it('supports contextual insertion and drag reordering in both editors', () => {
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const draggable = fs.readFileSync(
      path.resolve(__dirname, '../DraggableJournalBlock.tsx'),
      'utf8',
    );
    expect(reflection).toContain('selectedBlockId');
    expect(reflection).toContain('<DraggableJournalBlock');
    expect(reflection).toContain('handleDragJournalBlock');
    expect(session).toContain('insertionAfterId');
    expect(session).toContain('<DraggableJournalBlock');
    expect(session).toContain('handleDragBlock');
    expect(draggable).toContain('{selected && (');
    expect(draggable).toContain('<GestureDetector gesture={dragGesture}>');
    expect(draggable).toContain('withSpring(shiftY');
    expect(draggable).toContain('reorder-three-outline');
    expect(draggable).toContain('size={16}');
    expect(draggable).toContain('left: -26');
  });

  it('persists drag reordering from saved Reflection and Session Notes views', () => {
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const sessionDetail = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../screens/SermonNotesDetailScreen.tsx',
      ),
      'utf8',
    );
    expect(reflection).toContain('onReorderBlocks={handleReorderSavedBlocks}');
    expect(saved).toContain(
      'const canReorder = !compact && Boolean(onReorderBlocks)',
    );
    expect(saved).toContain('<DraggableJournalBlock');
    expect(sessionDetail).toContain('renderMovableBlocks(notesBlocks)');
    expect(sessionDetail).toContain('renderMovableBlocks(reflectionBlocks)');
    expect(sessionDetail).toContain('renderMovableBlocks(prayerBlocks)');
    expect(sessionDetail).toContain("type: 'blocks_reordered'");
  });

  it('starts 2 Columns neutral and selects a side only after a tap', () => {
    const onSelectSide = jest.fn();
    const view = render(
      <JournalColumnBlock
        leftBlocks={[]}
        rightBlocks={[]}
        activeSide={null}
        renderBlock={() => null}
        onSelectSide={onSelectSide}
        onDelete={jest.fn()}
      />,
    );

    expect(view.getByLabelText('Select left column')).toHaveProp(
      'accessibilityState',
      {selected: false},
    );
    expect(view.getAllByText('Tap to select')).toHaveLength(2);
    expect(view.queryByLabelText('Write in left column')).toBeNull();
    expect(view.queryByLabelText('Add block to left column')).toBeNull();
    fireEvent.press(view.getByLabelText('Select right column'));
    expect(onSelectSide).toHaveBeenCalledWith('right');
    view.rerender(
      <JournalColumnBlock
        leftBlocks={[]}
        rightBlocks={[]}
        activeSide="right"
        renderBlock={() => null}
        onSelectSide={onSelectSide}
        onDelete={jest.fn()}
      />,
    );
    expect(view.getByLabelText('Select right column')).toHaveProp(
      'accessibilityState',
      {selected: true},
    );
    expect(view.getByText('Selected')).toBeTruthy();
  });

  it('supports nested left and right Column blocks in both editors and saved views', () => {
    expect(JOURNAL_BLOCKS.column.label).toBe('2 COLUMNS');
    const reflection = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionLogEditor.tsx'),
      'utf8',
    );
    const guided = fs.readFileSync(
      path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'),
      'utf8',
    );
    const session = fs.readFileSync(
      path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'),
      'utf8',
    );
    const saved = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const column = fs.readFileSync(
      path.resolve(__dirname, '../JournalColumnBlock.tsx'),
      'utf8',
    );
    const nested = fs.readFileSync(
      path.resolve(__dirname, '../JournalNestedBlockEditor.tsx'),
      'utf8',
    );
    expect(reflection).toContain('<JournalColumnBlock');
    expect(session).toContain('<JournalColumnBlock');
    expect(reflection).toContain('parentColumnId');
    expect(session).toContain('parentColumnId');
    expect(saved).toContain('styles.savedColumns');
    expect(column).toContain("renderSide('left', leftBlocks)");
    expect(column).toContain("renderSide('right', rightBlocks)");
    expect(column).toContain('config={JOURNAL_BLOCKS.column}');
    expect(column).not.toContain('name="grid-outline"');
    expect(column).not.toContain('{side.toUpperCase()}');
    expect(column).not.toContain('<Pencil');
    expect(column).not.toContain('name="add"');
    expect(column).toContain('accessibilityLabel={`Select ${side} column`}');
    expect(column).toContain('accessibilityState={{selected}}');
    expect(column).toContain('onSelectSide(side)');
    expect(column).toContain(
      "backgroundColor: selected ? activeSurface : 'transparent'",
    );
    expect(column).not.toContain(
      "borderColor: selected ? accent : 'transparent'",
    );
    expect(column).not.toContain('borderWidth: 1');
    expect(column).toContain('borderRadius: 14');
    expect(reflection).toContain('onSelectSide={side => {');
    expect(guided).toContain('onSelectSide={side =>');
    expect(session).toContain('onSelectSide={side => {');
    expect(reflection).toMatch(/kind === 'column'\s*\? null/);
    expect(guided).toMatch(/kind === 'column'\s*\? null/);
    expect(session).toMatch(/kind === 'column'\s*\? null/);
    expect(nested.match(/<JournalTextInput themed/g)).toHaveLength(3);
    expect(nested).not.toContain('Fonts.lora.regular');
    expect(reflection).toContain('JOURNAL_BLOCKS[item.kind].allowInColumn');
    expect(guided).toContain('JOURNAL_BLOCKS[item.kind].allowInColumn');
    expect(session).toContain('NOTE_BLOCK_REGISTRY[kind].allowInColumn');
    expect(reflection).toContain('!JOURNAL_BLOCKS[kind].allowInColumn');
    expect(session).toContain('!NOTE_BLOCK_REGISTRY[kind].allowInColumn');
  });

  it('uses the same temporary inline photo expansion in Reflection and Session Notes', () => {
    const specialBlocks = fs.readFileSync(
      path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'),
      'utf8',
    );
    const savedBlocks = fs.readFileSync(
      path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'),
      'utf8',
    );
    const photoViewer = fs.readFileSync(
      path.resolve(__dirname, '../ExpandableJournalPhoto.tsx'),
      'utf8',
    );
    expect(specialBlocks).toContain('<ExpandableJournalPhoto');
    expect(savedBlocks).toContain('<ExpandableJournalPhoto');
    expect(photoViewer).toContain('setExpanded(false)');
    expect(photoViewer).toContain(
      "resizeMode={expanded ? 'contain' : 'cover'}",
    );
    expect(photoViewer).toContain('availableWidth / aspectRatio');
    expect(photoViewer).not.toContain('borderRadius: 0');
    expect(photoViewer).not.toContain('<Modal');
  });
});
