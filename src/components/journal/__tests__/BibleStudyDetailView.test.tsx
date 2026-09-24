import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import BibleStudyDetailView from '../BibleStudyDetailView';
import ScriptureReaderModal from '../../ScriptureReaderModal';
import type { BibleStudyContent } from '../../../storage/bibleStudyStorage';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 20 }) }));
jest.mock('../../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../ScriptureReaderModal', () => () => null);
jest.mock('@react-native-community/blur', () => ({ BlurView: require('react-native').View }));
jest.mock('../../common/ThemedText', () => {
  const { Text } = require('react-native');
  return ({ children, weight: _weight, ...props }: any) => <Text {...props}>{children}</Text>;
});

const content: BibleStudyContent = {
  format: 'bible_study_v1', highlights: [{ id: 'highlight', verseNumber: '1', text: 'The Lord is my shepherd.' }],
  observation: { text: 'My observation', tags: ['Promises'], byHighlight: { highlight: 'My note' }, promptsByHighlight: { highlight: ['Commands'] } },
  understanding: { text: 'God provides', prompts: ['What does this show about God?'], byPrompt: {} }, response: { text: 'Trust God', prompts: ['Believe', 'Other'] },
  prayer: { text: 'Help me trust', saveToPrayerJournal: true },
};
let renderer: TestRenderer.ReactTestRenderer;
let onEdit: jest.Mock;
let onClose: jest.Mock;

beforeEach(async () => {
  onEdit = jest.fn(async () => {});
  onClose = jest.fn();
  await act(async () => {
    renderer = TestRenderer.create(<BibleStudyDetailView reference="Psalm 23" selectedDate="2026-09-15" content={content} onEdit={onEdit} onClose={onClose} />);
  });
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.restoreAllMocks(); });

it('shows saved observation, question, and response pills, even when a selected question has no answer', async () => {
  const labels = () => renderer.root.findAll(node => node.props.children === 'Promises' || node.props.children === 'Commands' || node.props.children === 'What does this show about God?' || node.props.children === 'Believe' || node.props.children === 'Other')
    .map(node => node.props.children);
  expect(labels()).toEqual(expect.arrayContaining(['Promises', 'Commands', 'What does this show about God?']));
  const tabs = renderer.root.findAllByType(TouchableOpacity).filter(node => node.props.accessibilityRole === 'tab');
  await act(async () => tabs[1].props.onPress());
  expect(labels()).toEqual(expect.arrayContaining(['Believe', 'Other']));
});

it('opens and closes the reader for the exact passage from the title scroll icon', async () => {
  expect(renderer.root.findByType(ScriptureReaderModal).props.visible).toBe(false);
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Read study passage' }).props.onPress());
  const reader = renderer.root.findByType(ScriptureReaderModal);
  expect(reader.props.visible).toBe(true);
  expect(reader.props.passages).toEqual([{ reference: 'Psalm 23' }]);
  await act(async () => reader.props.onClose());
  expect(renderer.root.findByType(ScriptureReaderModal).props.visible).toBe(false);
});

it('opens the original editor instead of adding inputs to view mode', async () => {
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Edit Bible Study' }).props.onPress());
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Close Bible Study' }).props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('hides delete in saved view so it is only available from edit mode', () => {
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Delete Bible Study' })).toHaveLength(0);
});
