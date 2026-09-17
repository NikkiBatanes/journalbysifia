import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import FuturePlanningScreen from '../FuturePlanningScreen';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../components/ErrorBoundary/withErrorBoundary', () => ({
  withErrorBoundary: (Component: React.ComponentType<any>) => Component,
}));
jest.mock('../../components/journal/TodaysFocusExperience', () => {
  const ReactNative = require('react-native');
  return (props: any) => (
    <>
      <ReactNative.Text testID="focus-context">{props.planningContext}</ReactNative.Text>
      <ReactNative.Pressable testID="save-focus" onPress={() => props.onComplete({ id: 'focus-id' })} />
      <ReactNative.Pressable testID="skip-focus" onPress={props.onSkip} />
    </>
  );
});
jest.mock('../../components/journal/TodosExperience', () => {
  const ReactNative = require('react-native');
  return (props: any) => (
    <>
      <ReactNative.Text testID="todos-context">{props.planningContext}</ReactNative.Text>
      <ReactNative.Pressable testID="save-todos" onPress={() => props.onComplete({ record: null, items: [] })} />
    </>
  );
});

describe('FuturePlanningScreen navigation', () => {
  it('moves from Focus to Todos and returns to Today after Done', () => {
    const goBack = jest.fn();
    const screen = render(<FuturePlanningScreen
      route={{ key: 'planning', name: 'FuturePlanning', params: { selectedDate: '2026-09-18', isTomorrow: true } } as any}
      navigation={{ goBack } as any}
    />);

    expect(screen.getByTestId('focus-context').props.children).toBe('tomorrow');
    fireEvent.press(screen.getByTestId('save-focus'));
    expect(screen.getByTestId('todos-context').props.children).toBe('tomorrow');
    fireEvent.press(screen.getByTestId('save-todos'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('allows a later-date Todos-only plan through Skip focus', () => {
    const screen = render(<FuturePlanningScreen
      route={{ key: 'planning', name: 'FuturePlanning', params: { selectedDate: '2026-09-21', isTomorrow: false } } as any}
      navigation={{ goBack: jest.fn() } as any}
    />);

    fireEvent.press(screen.getByTestId('skip-focus'));
    expect(screen.getByTestId('todos-context').props.children).toBe('later');
  });
});
