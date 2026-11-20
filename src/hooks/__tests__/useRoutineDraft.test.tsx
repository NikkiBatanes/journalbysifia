import {act, renderHook} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRoutineDraft} from '../useRoutineDraft';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));

beforeEach(() => {jest.useFakeTimers(); jest.resetAllMocks();});
afterEach(() => {jest.useRealTimers();});

it('keeps a cleared draft deleted after its autosave timer fires', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  const restore = jest.fn();
  const {result, rerender} = renderHook(
    (value: string) => useRoutineDraft('morning', '2026-11-20', 'focus', value, restore),
    {initialProps: ''},
  );
  await act(async () => {});
  rerender('Finished writing');
  await act(async () => {await result.current(); jest.advanceTimersByTime(400);});
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('routine_draft:morning:2026-11-20:focus');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('preserves typing while a previous draft is still loading', async () => {
  let finishRead!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValue(new Promise(resolve => {finishRead = resolve;}));
  const restore = jest.fn();
  const {rerender} = renderHook(
    (value: string) => useRoutineDraft('morning', '2026-11-20', 'focus', value, restore),
    {initialProps: ''},
  );
  rerender('New writing');
  await act(async () => {
    jest.advanceTimersByTime(400);
    finishRead('"Old writing"');
  });
  expect(restore).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('routine_draft:morning:2026-11-20:focus', '"New writing"');
});

it('reopens the saved draft for a different day after clearing the first day', async () => {
  const restore = jest.fn();
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('"First day"').mockResolvedValueOnce('"Second day"');
  const {result, rerender} = renderHook(
    ({day, text}: {day: string; text: string}) => useRoutineDraft('evening', day, 'focus', text, restore),
    {initialProps: {day: '2026-11-19', text: ''}},
  );
  await act(async () => {});
  expect(restore).toHaveBeenLastCalledWith('First day');
  await act(async () => {await result.current();});
  rerender({day: '2026-11-20', text: ''});
  await act(async () => {});
  expect(restore).toHaveBeenLastCalledWith('Second day');
  rerender({day: '2026-11-20', text: 'Edited second day'});
  await act(async () => {jest.advanceTimersByTime(400);});
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('routine_draft:evening:2026-11-20:focus', '"Edited second day"');
});
