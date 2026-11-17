import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {StatusBar} from 'react-native';
import {
  resolveStatusBarStyle,
  useScreenStatusBar,
} from '../useScreenStatusBar';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    require('react').useEffect(callback, [callback]),
}));

jest.mock('react-native', () => {
  return {
    StatusBar: {
      setBarStyle: jest.fn(),
    },
  };
});

const Harness = () => {
  useScreenStatusBar('dark', 'transparent');
  return null;
};

describe('useScreenStatusBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets a supported bar style without requiring the removed Android background API', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    expect(() => {
      act(() => {
        renderer = TestRenderer.create(<Harness />);
      });
    }).not.toThrow();

    expect(StatusBar.setBarStyle).toHaveBeenCalledWith('dark-content', true);

    act(() => renderer!.unmount());
  });

  it('keeps automatic contrast resolution for opaque screen colors', () => {
    expect(resolveStatusBarStyle('auto', '#526A5B')).toBe('light-content');
    expect(resolveStatusBarStyle('auto', '#FFFEFA')).toBe('dark-content');
  });
});
