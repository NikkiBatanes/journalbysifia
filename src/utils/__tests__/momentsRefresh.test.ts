import { DeviceEventEmitter } from 'react-native';
import { emitMomentsStructuralRefresh } from '../momentsRefresh';

describe('Moments structural refresh', () => {
  it('uses the existing reflection_saved channel for copied canonical Todos', () => {
    const listener = jest.fn();
    const subscription = DeviceEventEmitter.addListener('reflection_saved', listener);

    emitMomentsStructuralRefresh('todo_copied', '2026-09-19', ['copied-1', 'copied-2']);

    expect(listener).toHaveBeenCalledWith({
      type: 'todo_copied',
      date: '2026-09-19',
      canonicalIds: ['copied-1', 'copied-2'],
    });
    subscription.remove();
  });

  it('does not emit for content-only Todo or priority completion', () => {
    const listener = jest.fn();
    const subscription = DeviceEventEmitter.addListener('reflection_saved', listener);

    expect(listener).not.toHaveBeenCalled();
    subscription.remove();
  });
});
