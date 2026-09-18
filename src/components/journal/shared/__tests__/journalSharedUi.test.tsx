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
import {GENERIC_JOURNAL_BLOCK_KINDS, JOURNAL_BLOCKS, SERMON_BLOCK_KINDS, createJournalBlock} from '../journalBlocks';
import {insertJournalBlock, removeJournalBlock, updateJournalBlock} from '../journalBlockOperations';
import {JournalComposerBar} from '../JournalComposer';
import {ReflectionQuestionCard} from '../ReflectionQuestionCard';

describe('shared Journal UI extraction', () => {
  it('preserves the complete persisted Sermon registry and generic subset', () => {
    expect(Object.keys(JOURNAL_BLOCKS)).toEqual(['scripture', 'key', 'quote', 'song', 'outline', 'character', 'language', 'link', 'table', 'history', 'remember', 'response', 'question', 'reflection_question', 'revisit', 'prayer', 'book']);
    expect(SERMON_BLOCK_KINDS).toHaveLength(17);
    expect(GENERIC_JOURNAL_BLOCK_KINDS).toEqual(['text', 'scripture', 'quote', 'key', 'remember', 'question', 'response']);
  });

  it('creates, inserts, edits, and removes stable blocks without disturbing siblings', () => {
    const first = createJournalBlock('quote', 'stable-quote');
    const insertion = insertJournalBlock([first], 'remember', 'stable-remember');
    expect(insertion.blocks.map(block => block.id)).toEqual(['stable-quote', 'stable-remember']);
    const edited = updateJournalBlock(insertion.blocks, 'stable-quote', {text: 'Keep this'});
    expect(edited[0]).toMatchObject({id: 'stable-quote', kind: 'quote', text: 'Keep this'});
    expect(removeJournalBlock(edited, 'stable-quote')).toEqual([insertion.block]);
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
});
