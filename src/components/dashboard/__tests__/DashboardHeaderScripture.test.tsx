import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import DashboardHeaderScripture from '../DashboardHeaderScripture';
import ScriptureReaderModal from '../../ScriptureReaderModal';
import { getCachedScripturePassage, getScripturePassage, preloadScripturePassages } from '../../../services/scriptureReaderService';
import { getDashboardHeaderScripture } from '../../../data/dashboardHeaderScriptures';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  FadeInUp: {
    springify: jest.fn().mockReturnThis(),
    damping: jest.fn().mockReturnThis(),
    stiffness: jest.fn().mockReturnThis(),
  },
}));
jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../ScriptureReaderModal', () => jest.fn(() => null));
jest.mock('../../../services/scriptureReaderService', () => ({
  getCachedScripturePassage: jest.fn(),
  getScripturePassage: jest.fn(),
  preloadScripturePassages: jest.fn().mockResolvedValue(undefined),
}));

const date = new Date(2026, 8, 22, 9);
const reference = getDashboardHeaderScripture(date).displayReference;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (getCachedScripturePassage as jest.Mock).mockReturnValue(null);
  (getScripturePassage as jest.Mock).mockReturnValue(new Promise(() => {}));
});
afterEach(() => jest.useRealTimers());

it('shows a warm verse immediately and mounts the reader only when opened', () => {
  (getCachedScripturePassage as jest.Mock).mockReturnValue({ text: 'Cached verse' });
  const screen = render(<DashboardHeaderScripture date={date} bibleVersion="AMP" centered />);
  expect(screen.getByText('Cached verse')).toBeTruthy();
  expect(getScripturePassage).not.toHaveBeenCalled();
  expect(ScriptureReaderModal).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText(`Open ${reference} in Scripture Reader`));
  expect(ScriptureReaderModal).toHaveBeenCalled();
});

it('ignores a late response from the previous translation', async () => {
  let finishAmp!: (result: { text: string }) => void;
  let finishNasb!: (result: { text: string }) => void;
  (getScripturePassage as jest.Mock)
    .mockReturnValueOnce(new Promise(resolve => { finishAmp = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { finishNasb = resolve; }));
  const screen = render(<DashboardHeaderScripture date={date} bibleVersion="AMP" />);
  screen.rerender(<DashboardHeaderScripture date={date} bibleVersion="NASB" />);
  await act(async () => { finishNasb({ text: 'Selected translation' }); });
  await act(async () => { finishAmp({ text: 'Old translation' }); });
  expect(screen.getByText('Selected translation')).toBeTruthy();
  expect(screen.queryByText('Old translation')).toBeNull();
});

it('warms this evening and tomorrow in the selected translation after the visible verse loads', () => {
  (getCachedScripturePassage as jest.Mock).mockReturnValue({ text: 'Cached verse' });
  render(<DashboardHeaderScripture date={date} bibleVersion="AMP" />);
  expect(preloadScripturePassages).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1000); });
  const tomorrow = new Date(2026, 8, 23, 9);
  expect(preloadScripturePassages).toHaveBeenCalledWith([
    getDashboardHeaderScripture(date, true).passageReference,
    getDashboardHeaderScripture(tomorrow, false).passageReference,
    getDashboardHeaderScripture(tomorrow, true).passageReference,
  ], 'AMP');
});
