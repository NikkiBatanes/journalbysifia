import React from 'react';
import fs from 'fs';
import path from 'path';
import {Animated, StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

jest.mock('../../../common/ThemedText', () => {
  const ReactModule = require('react');
  const {Text} = require('react-native');
  return ({children, ...props}: any) => ReactModule.createElement(Text, props, children);
});
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('lucide-react-native', () => ({Pencil: 'Pencil'}));
import {GENERIC_JOURNAL_BLOCK_KINDS, JOURNAL_BLOCK_GAP, JOURNAL_BLOCKS, SERMON_BLOCK_KINDS, createJournalBlock, formatJournalAttribution, hasMeaningfulJournalBlock, prepareJournalBlocksForSave} from '../journalBlocks';
import {insertJournalBlock, removeJournalBlock, reorderJournalBlock, resolveJournalBlockDropIndex, updateJournalBlock} from '../journalBlockOperations';
import {JournalComposerBar} from '../JournalComposer';
import {ReflectionQuestionCard} from '../ReflectionQuestionCard';

describe('shared Journal UI extraction', () => {
  it('preserves the complete persisted Sermon registry and generic subset', () => {
    expect(Object.keys(JOURNAL_BLOCKS)).toEqual(['section', 'action', 'bullets', 'numbered', 'photo', 'voice', 'scripture', 'key', 'quote', 'song', 'outline', 'character', 'language', 'link', 'table', 'history', 'remember', 'response', 'question', 'reflection_question', 'revisit', 'prayer', 'book']);
    expect(SERMON_BLOCK_KINDS).toHaveLength(23);
    expect(SERMON_BLOCK_KINDS.slice(0, 6)).toEqual(['section', 'action', 'bullets', 'numbered', 'photo', 'voice']);
    expect(GENERIC_JOURNAL_BLOCK_KINDS).toEqual(['text', 'scripture', 'quote', 'key', 'remember', 'question', 'response']);
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

  it('makes Sermon and Guided Reflection consume the extracted components', () => {
    const sermon = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const guided = fs.readFileSync(path.resolve(__dirname, '../../GuidedReflectionExperience.tsx'), 'utf8');
    expect(sermon).toContain('<JournalBlockPickerMenu');
    expect(sermon).toContain('<JournalComposerBar');
    expect(sermon).toContain('<JournalInlineBlock');
    expect(guided).toContain('<JournalPickerMenu');
    expect(guided).toContain('<JournalComposerBar');
    expect(guided).toContain('<JournalInlineBlock');
    expect(guided).toContain('<ReflectionQuestionCard');
  });

  it('keeps the table field shared by Session Notes and Reflection Log', () => {
    const sermon = fs.readFileSync(path.resolve(__dirname, '../../../../screens/SermonNotesScreen.tsx'), 'utf8');
    const reflection = fs.readFileSync(path.resolve(__dirname, '../../ReflectionLogEditor.tsx'), 'utf8');
    const table = fs.readFileSync(path.resolve(__dirname, '../JournalTableBlock.tsx'), 'utf8');
    expect(sermon).toContain('<JournalTableBlock');
    expect(reflection).toContain('<JournalTableBlock');
    expect(reflection).toContain("kind === 'table'");
    expect(table).toContain('Save table');
    expect(table).toContain('Add row');
    expect(table).toContain('Add column');
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
