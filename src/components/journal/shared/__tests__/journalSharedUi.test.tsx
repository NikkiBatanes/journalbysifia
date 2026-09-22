import React from 'react';
import fs from 'fs';
import path from 'path';
import {Animated, StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

jest.mock('../../../../hooks/useTheme', () => ({useTheme: () => ({currentFont: 'lexend'})}));

jest.mock('../../../common/ThemedText', () => {
  const ReactModule = require('react');
  const {Text} = require('react-native');
  return ({children, ...props}: any) => ReactModule.createElement(Text, props, children);
});
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('lucide-react-native', () => ({Pencil: 'Pencil'}));
import {GENERIC_JOURNAL_BLOCK_KINDS, JOURNAL_BLOCK_GAP, JOURNAL_BLOCKS, SERMON_BLOCK_KINDS, createJournalBlock, formatJournalAttribution, getJournalTableCellAlignment, hasMeaningfulJournalBlock, prepareJournalBlocksForSave} from '../journalBlocks';
import {REFLECTION_NOTE_TYPES} from '../../../../types/guidedReflection';
import {insertJournalBlock, removeJournalBlock, reorderJournalBlock, resolveJournalBlockDropIndex, updateJournalBlock} from '../journalBlockOperations';
import {JournalComposerBar} from '../JournalComposer';
import {JournalColumnBlock} from '../JournalColumnBlock';
import {JournalTableBlock} from '../JournalTableBlock';
import {ReflectionQuestionCard} from '../ReflectionQuestionCard';

describe('shared Journal UI extraction', () => {
  it('preserves the complete persisted Sermon registry and generic subset', () => {
    expect(Object.keys(JOURNAL_BLOCKS)).toEqual(['section', 'action', 'bullets', 'numbered', 'column', 'photo', 'voice', 'scripture', 'key', 'quote', 'song', 'outline', 'character', 'language', 'link', 'table', 'history', 'remember', 'response', 'question', 'reflection_question', 'revisit', 'prayer', 'book']);
    expect(SERMON_BLOCK_KINDS).toHaveLength(24);
    expect(SERMON_BLOCK_KINDS.slice(0, 7)).toEqual(['section', 'action', 'bullets', 'numbered', 'column', 'photo', 'voice']);
    expect(GENERIC_JOURNAL_BLOCK_KINDS).toEqual(['text', 'scripture', 'quote', 'key', 'remember', 'question', 'response']);
    expect(REFLECTION_NOTE_TYPES.find(item => item.kind === 'column')).toMatchObject({
      icon: 'view-column-outline',
      iconFamily: 'MaterialCommunityIcons',
    });
    expect(JOURNAL_BLOCK_GAP).toBe(12);
  });

  it('creates, inserts, edits, and removes stable blocks without disturbing siblings', () => {
    const first = createJournalBlock('quote', 'stable-quote');
    const insertion = insertJournalBlock([first], 'remember', 'stable-remember');
    expect(insertion.blocks.map(block => block.id)).toEqual(['stable-quote', 'stable-remember']);
    const edited = updateJournalBlock(insertion.blocks, 'stable-quote', {text: 'Keep this'});
    expect(edited[0]).toMatchObject({id: 'stable-quote', kind: 'quote', text: 'Keep this'});
    expect(removeJournalBlock(edited, 'stable-quote')).toEqual([insertion.block]);
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
    expect(resolveJournalBlockDropIndex(blocks, layouts, 'photo', -170)).toBe(0);
  });

  it('drops empty note types while keeping media that has saved content', () => {
    expect(hasMeaningfulJournalBlock(createJournalBlock('action'))).toBe(false);
    expect(hasMeaningfulJournalBlock(createJournalBlock('section'))).toBe(false);
    expect(hasMeaningfulJournalBlock(createJournalBlock('bullets'))).toBe(false);
    expect(hasMeaningfulJournalBlock(createJournalBlock('numbered'))).toBe(false);
    expect(hasMeaningfulJournalBlock(createJournalBlock('table'))).toBe(false);
    expect(hasMeaningfulJournalBlock({...createJournalBlock('action'), text: 'Follow up'})).toBe(true);
    expect(hasMeaningfulJournalBlock({...createJournalBlock('photo'), uri: 'file:///photo.jpg'})).toBe(true);
    expect(hasMeaningfulJournalBlock({...createJournalBlock('voice'), uri: 'file:///voice.m4a'})).toBe(true);
    expect(hasMeaningfulJournalBlock({...createJournalBlock('bullets'), points: ['Remember this']})).toBe(true);
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
    expect(prepareJournalBlocksForSave([column, emptyLeft, rightQuote])).toEqual([
      column,
      rightQuote,
    ]);
  });

  it('formats quote speakers and authors with one automatic em dash', () => {
    expect(formatJournalAttribution('')).toBe('');
    expect(formatJournalAttribution('Maya Angelou')).toBe('— Maya Angelou');
    expect(formatJournalAttribution('— Maya Angelou')).toBe('— Maya Angelou');
    const inlineBlock = fs.readFileSync(path.resolve(__dirname, '../JournalInlineBlock.tsx'), 'utf8');
    expect(inlineBlock).toContain('{fontFamily: attributionFontFamily}');
  });

  it('forwards every composer action and supports the open add state', () => {
    const handlers = {back: jest.fn(), write: jest.fn(), add: jest.fn(), next: jest.fn()};
    const animations = [0, 1, 2, 3].map(() => new Animated.Value(1));
    const view = render(<JournalComposerBar onBack={handlers.back} onWrite={handlers.write} onAdd={handlers.add} onNext={handlers.next} addOpen plusRotation={new Animated.Value(1)} pickerColorAnim={new Animated.Value(1)} actionAnimations={animations} />);
    fireEvent.press(view.getByLabelText('Back'));
    fireEvent.press(view.getByLabelText('Write'));
    fireEvent.press(view.getByLabelText('Close note type picker'));
    fireEvent.press(view.getByLabelText('Next'));
    Object.values(handlers).forEach(handler => expect(handler).toHaveBeenCalledTimes(1));
  });

  it('renders the extracted approved question card and Reflect callback', () => {
    const onReflect = jest.fn();
    const styles = StyleSheet.create({promptCard: {}, lockIconContainer: {}, promptTextContainer: {}, promptCardText: {}, reflectLabel: {}, buttonIcon: {}, reflectLabelText: {}});
    const view = render(<ReflectionQuestionCard question="Where is God inviting trust?" onReflect={onReflect} styles={styles} />);
    expect(view.getByText('Where is God inviting trust?')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Reflect'));
    expect(onReflect).toHaveBeenCalledTimes(1);
  });

  it('matches reflection note-type pills to the Session Notes choice size', () => {
    const composer = fs.readFileSync(path.resolve(__dirname, '../JournalComposer.tsx'), 'utf8');
    expect(composer).toMatch(/floatingTool:\s*\{[\s\S]*?minHeight: 48,[\s\S]*?paddingRight: 18,[\s\S]*?borderRadius: 28/);
    expect(composer).toContain('floatingToolText: {fontSize: 15');
    expect(composer).toMatch(/floatingToolIcon:\s*\{[\s\S]*?width: 28,[\s\S]*?height: 28/);
  });

  it('makes Sermon and Guided Reflection consume the extracted components', () => {
    const sermon = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const guided = fs.readFileSync(path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'), 'utf8');
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    expect(sermon).toContain('<JournalBlockPickerMenu');
    expect(sermon).toContain('<JournalComposerBar');
    expect(sermon).not.toContain('<BlurView');
    expect(sermon).not.toContain('styles.androidBlur');
    expect(sermon).toContain('<JournalInlineBlock');
    expect(guided).toContain('<JournalPickerMenu');
    expect(guided).toContain('<JournalComposerBar');
    expect(guided).toContain('<JournalInlineBlock');
    expect(guided).toContain('<JournalListBlock');
    expect(guided).toContain('<JournalTableBlock');
    expect(guided).toContain('<JournalColumnBlock');
    expect(guided).toContain('<JournalBlockIcon');
    expect(reflection).toContain('<JournalBlockIcon');
    expect(guided).toContain('<ReflectionSpecialBlock');
    expect(guided).toContain('<ReflectionQuestionCard');
  });

  it('keeps the table field shared by Session Notes and Reflection Log', () => {
    const sermon = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const detail = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesDetailScreen.tsx'), 'utf8');
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const saved = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const table = fs.readFileSync(path.resolve(__dirname, '../JournalTableBlock.tsx'), 'utf8');
    expect(sermon).toContain('<JournalTableBlock');
    expect(reflection).toContain('<JournalTableBlock');
    expect(reflection).toContain("kind === 'table'");
    expect(table).toContain('accessibilityLabel="Save table"');
    expect(table).toContain('<Ionicons name="checkmark" size={17} color={accent} />');
    expect(table).toMatch(/saveButton:\s*\{[\s\S]*?width: 32,[\s\S]*?height: 32,[\s\S]*?borderRadius: 16/);
    expect(table).not.toContain('saveButtonText');
    expect(table).toContain('Add row');
    expect(table).toContain('Add column');
    expect(table).toContain("(['left', 'center', 'right'] as const)");
    expect(table).toContain('resolvedAlignments[rowIndex][columnIndex]');
    expect(reflection).toContain('cellAlignments={block.tableCellAlignments}');
    expect(sermon).toContain('cellAlignments={block.tableCellAlignments}');
    expect(saved).toContain('<ScrollView\n              key={block.id}\n              horizontal');
    expect(saved).toContain('getJournalTableCellAlignment(');
    expect(detail).toContain("if (block.kind === 'table')");
    expect(detail).toContain('getJournalTableCellAlignment(');
    expect(detail).toContain('<React.Fragment key={block.id}>{renderContent()}</React.Fragment>');
    expect(sermon).toContain('savedTableHorizontalScroll: {marginBottom: JOURNAL_BLOCK_GAP}');
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
    const savedReflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogReactQuery.tsx'), 'utf8');
    expect(savedReflection).toContain('journal_blocks: entry.journal_blocks');
    expect(savedReflection).toContain('<SavedReflectionBlocks');
    expect(savedReflection).toContain('blocks={entry.journal_blocks}');
    expect(savedReflection).toContain('compact');
    const editor = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const savedBlocks = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    expect(editor).toContain('journalBlocks.filter(');
    expect(editor).toContain('journalBlocks: meaningfulJournalBlocks');
    expect(editor).toContain('secondaryInput: [s.secondaryInput, {fontFamily: fontFamilyRegular}]');
    expect(savedBlocks).toContain('borderLeftWidth: 2');
    expect(savedBlocks).toContain('borderLeftColor: onDark');
    expect(savedBlocks).toContain('allVisibleBlocks.slice(0, 3)');
    expect(savedBlocks).toContain('firstPhoto');
    expect(savedBlocks).toContain('compactPhoto: {height: 124}');
    expect(savedBlocks).toContain("hiddenBlockCount === 1 ? 'note' : 'notes'");
  });

  it('opens saved reflections in view mode before exposing edit controls', () => {
    const editor = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const screen = fs.readFileSync(path.resolve(__dirname, '../../../../screens/ReflectionEditorScreen.tsx'), 'utf8');
    const detail = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesDetailScreen.tsx'), 'utf8');
    const saved = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const special = fs.readFileSync(path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'), 'utf8');
    expect(editor).toContain('const [isEditMode, setIsEditMode] = React.useState(!isEditing)');
    expect(editor).toContain('if (isEditing && !isEditMode)');
    expect(editor).toContain('accessibilityLabel="Edit reflection"');
    expect(editor).toContain('onToggleAction={handleToggleSavedAction}');
    expect(screen).toContain('updates: {journal_blocks: journalBlocks}');
    expect(detail).toContain('onToggleAction={handleToggleSavedAction}');
    expect(saved).toContain('width: 19, height: 19, borderRadius: 7');
    expect(special).toContain('width: 19');
    expect(special).toContain('borderRadius: 7');
  });

  it('refreshes Moments after a saved action is toggled', () => {
    const reflectionScreen = fs.readFileSync(path.resolve(__dirname, '../../../../screens/ReflectionEditorScreen.tsx'), 'utf8');
    const sessionDetail = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesDetailScreen.tsx'), 'utf8');
    const moments = fs.readFileSync(path.resolve(__dirname, '../../../../screens/MomentsScreen.tsx'), 'utf8');
    expect(reflectionScreen).toContain("DeviceEventEmitter.emit('reflection_saved'");
    expect(sessionDetail).toContain("DeviceEventEmitter.emit('sermon_saved'");
    expect(reflectionScreen).toContain("type: 'action_toggled'");
    expect(sessionDetail).toContain("type: 'action_toggled'");
    expect(moments).toContain("DeviceEventEmitter.addListener('reflection_saved'");
    expect(moments).toContain("DeviceEventEmitter.addListener('sermon_saved'");
  });

  it('makes Section, Action, Photo, and Voice Note available throughout Session Notes', () => {
    const editor = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const detail = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesDetailScreen.tsx'), 'utf8');
    const specialBlocks = fs.readFileSync(path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'), 'utf8');
    expect(editor).toContain('<ReflectionSpecialBlock');
    expect(editor).toContain("kind === 'photo'");
    expect(editor).toContain("addBlock('photo', {uri: photo.uri})");
    expect(detail).toContain("['section', 'action', 'bullets', 'numbered', 'photo', 'voice']");
    expect(detail).toContain('<SavedReflectionBlocks');
    expect(specialBlocks).not.toContain('marginTop: 14');
    expect(specialBlocks).not.toContain('marginTop: 12');
    expect(specialBlocks).toContain('marginBottom: JOURNAL_BLOCK_GAP');
  });

  it('shares structured Bullets and Numbered blocks across Reflection and Session Notes', () => {
    expect(JOURNAL_BLOCKS.bullets.label).toBe('Bullets');
    expect(JOURNAL_BLOCKS.numbered.label).toBe('Numbered');
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const saved = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const list = fs.readFileSync(path.resolve(__dirname, '../JournalListBlock.tsx'), 'utf8');
    expect(reflection).toContain('<JournalListBlock');
    expect(reflection).toContain('onChangeTitle={text => updateBlock({text})}');
    expect(session).toContain('<JournalListBlock');
    expect(session).toContain('onChangeTitle={text =>');
    expect(list).toContain('placeholder="Add a title…"');
    expect(saved).toContain("block.kind === 'bullets' || block.kind === 'numbered'");
    expect(saved).toContain('{block.text.trim()}');
  });

  it('uses one uniform gap for every editable note block family', () => {
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const table = fs.readFileSync(path.resolve(__dirname, '../JournalTableBlock.tsx'), 'utf8');
    const list = fs.readFileSync(path.resolve(__dirname, '../JournalListBlock.tsx'), 'utf8');
    expect(reflection).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(session).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(table).toContain('marginBottom: JOURNAL_BLOCK_GAP');
    expect(list).toContain('marginBottom: JOURNAL_BLOCK_GAP');
  });

  it('supports contextual insertion and drag reordering in both editors', () => {
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const draggable = fs.readFileSync(path.resolve(__dirname, '../DraggableJournalBlock.tsx'), 'utf8');
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
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const saved = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const sessionDetail = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesDetailScreen.tsx'), 'utf8');
    expect(reflection).toContain('onReorderBlocks={handleReorderSavedBlocks}');
    expect(saved).toContain('const canReorder = !compact && Boolean(onReorderBlocks)');
    expect(saved).toContain('<DraggableJournalBlock');
    expect(sessionDetail).toContain('renderMovableBlocks(notesBlocks)');
    expect(sessionDetail).toContain('renderMovableBlocks(reflectionBlocks)');
    expect(sessionDetail).toContain('renderMovableBlocks(prayerBlocks)');
    expect(sessionDetail).toContain("type: 'blocks_reordered'");
  });

  it('selects an entire Column side without local Write or Add controls', () => {
    const onSelectSide = jest.fn();
    const view = render(
      <JournalColumnBlock
        leftBlocks={[]}
        rightBlocks={[]}
        activeSide="left"
        renderBlock={() => null}
        onSelectSide={onSelectSide}
        onDelete={jest.fn()}
      />,
    );

    expect(view.getByLabelText('Select left column')).toHaveProp(
      'accessibilityState',
      {selected: true},
    );
    expect(view.queryByLabelText('Write in left column')).toBeNull();
    expect(view.queryByLabelText('Add block to left column')).toBeNull();
    fireEvent.press(view.getByLabelText('Select right column'));
    expect(onSelectSide).toHaveBeenCalledWith('right');
  });

  it('supports nested left and right Column blocks in both editors and saved views', () => {
    expect(JOURNAL_BLOCKS.column.label).toBe('COLUMN');
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const guided = fs.readFileSync(path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const saved = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const column = fs.readFileSync(path.resolve(__dirname, '../JournalColumnBlock.tsx'), 'utf8');
    const nested = fs.readFileSync(path.resolve(__dirname, '../JournalNestedBlockEditor.tsx'), 'utf8');
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
    expect(column).toContain("backgroundColor: selected ? activeSurface : 'transparent'");
    expect(column).not.toContain("borderColor: selected ? accent : 'transparent'");
    expect(column).not.toContain('borderWidth: 1');
    expect(column).toContain('borderRadius: 14');
    expect(reflection).toContain('onSelectSide={side => {');
    expect(guided).toContain('onSelectSide={side =>');
    expect(session).toContain('onSelectSide={side => {');
    expect(reflection).toContain("? {columnId: block.id, side: 'left'}");
    expect(guided).toContain("? {columnId: id, side: 'left'}");
    expect(session).toContain("? {columnId: selectedBlock.id, side: 'left'}");
    expect(nested.match(/<JournalTextInput themed/g)).toHaveLength(3);
    expect(nested).not.toContain('Fonts.lora.regular');
    expect(reflection).toContain("item.kind !== 'column' && item.kind !== 'table'");
    expect(session).toContain("kind !== 'column' && kind !== 'table'");
    expect(reflection).toContain("(kind === 'column' || kind === 'table')");
    expect(session).toContain("(kind === 'column' || kind === 'table')");
  });

  it('uses the same temporary inline photo expansion in Reflection and Session Notes', () => {
    const specialBlocks = fs.readFileSync(path.resolve(__dirname, '../../ReflectionSpecialBlock.tsx'), 'utf8');
    const savedBlocks = fs.readFileSync(path.resolve(__dirname, '../../SavedReflectionBlocks.tsx'), 'utf8');
    const photoViewer = fs.readFileSync(path.resolve(__dirname, '../ExpandableJournalPhoto.tsx'), 'utf8');
    expect(specialBlocks).toContain('<ExpandableJournalPhoto');
    expect(savedBlocks).toContain('<ExpandableJournalPhoto');
    expect(photoViewer).toContain('setExpanded(false)');
    expect(photoViewer).toContain("resizeMode={expanded ? 'contain' : 'cover'}");
    expect(photoViewer).toContain('availableWidth / aspectRatio');
    expect(photoViewer).not.toContain('borderRadius: 0');
    expect(photoViewer).not.toContain('<Modal');
  });
});
