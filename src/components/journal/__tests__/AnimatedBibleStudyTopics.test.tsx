import React from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AnimatedBibleStudyTopics from '../AnimatedBibleStudyTopics';
import { BIBLE_STUDY_TOPICS } from '../../../data/bibleStudyTopics';

jest.mock('../../common/ThemedText', () => () => null);

it('uses the Sermon Notes staggered spring entrance and quick fade exit', async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const spring = jest.spyOn(Animated, 'spring').mockReturnValue({ start, stop, reset: jest.fn() });
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start, stop, reset: jest.fn() });
  const staggerStart = jest.fn();
  const stagger = jest.spyOn(Animated, 'stagger').mockReturnValue({ start: staggerStart, stop, reset: jest.fn() });
  const props = { suggestions: BIBLE_STUDY_TOPICS.slice(0, 4), topics: BIBLE_STUDY_TOPICS, reduceMotion: false,
    onSelect: jest.fn(), gridStyle: {}, buttonStyle: {}, textStyle: {} };
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(<AnimatedBibleStudyTopics {...props} expanded={false} />); });
    const layouts = renderer.root.findAll(node => typeof node.props.onLayout === 'function');
    // Host/component representations share props: select the unique callbacks.
    const callbacks = [...new Set(layouts.map(node => node.props.onLayout))];
    await act(async () => {
      callbacks[0]({ nativeEvent: { layout: { height: 320 } } });
      callbacks[1]({ nativeEvent: { layout: { height: 80 } } });
    });
    expect(spring).not.toHaveBeenCalled();
    await act(async () => renderer.update(<AnimatedBibleStudyTopics {...props} expanded />));
    expect(spring).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, tension: 90, friction: 12, useNativeDriver: true }));
    expect(stagger).toHaveBeenLastCalledWith(38, expect.any(Array));
    await act(async () => renderer.update(<AnimatedBibleStudyTopics {...props} expanded={false} />));
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 130, useNativeDriver: true }));
    expect(stagger).toHaveBeenLastCalledWith(28, expect.any(Array));
    expect(stagger).toHaveBeenCalledTimes(2);
    const oldCollapseCallback = staggerStart.mock.calls[1][0];
    await act(async () => renderer.update(<AnimatedBibleStudyTopics {...props} expanded />));
    await act(async () => oldCollapseCallback({ finished: true }));
    // A cancelled exit cannot collapse a newly reopened grid.
    const container = renderer.root.findAllByType(Animated.View)[0];
    expect(StyleSheet.flatten(container.props.style).height.__getValue()).toBe(320);
    // Touch feedback and reveal opacity belong to different elements.
    renderer.root.findAllByType(TouchableOpacity).forEach(button => {
      expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    });
  } finally {
    if (renderer) {await act(async () => renderer.unmount());}
    spring.mockRestore();
    timing.mockRestore();
    stagger.mockRestore();
  }
});
