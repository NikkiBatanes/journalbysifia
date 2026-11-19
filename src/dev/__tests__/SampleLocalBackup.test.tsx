import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import SampleLocalBackup from '../SampleLocalBackup';
import archive from '../../native/NativeJournalArchiveCrypto';
import {restoreSharedPhotoTransfer} from '../journalSharedPhotoTransferProbe';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({__esModule: true, default: {chooseSampleBackupFile: jest.fn()}}));
jest.mock('../journalSharedPhotoTransferProbe', () => ({restoreSharedPhotoTransfer: jest.fn()}));
jest.mock('../../theme/ThemeContext', () => ({useTheme: () => ({colors: {text: 'black'}})}));
jest.mock('react-native-get-random-values', () => {
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: require('node:crypto').webcrypto});
  return {};
});

beforeEach(() => jest.resetAllMocks());

it('requires a saved recovery code and preserves it if the save picker is cancelled', async () => {
  render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Save sample backup'));
  const code = screen.getByTestId('sample-backup-recovery-code').props.children;
  expect(screen.getByRole('button', {name: 'Choose save location'})).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox'));
  jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce('').mockResolvedValueOnce('saved');
  fireEvent.press(screen.getByText('Choose save location'));
  await waitFor(() => expect(screen.getByText('Choose save location')).toBeOnTheScreen());
  expect(screen.getByTestId('sample-backup-recovery-code').props.children).toBe(code);
  expect(screen.queryByText('Sample backup saved.')).toBeNull();
  fireEvent.press(screen.getByText('Choose save location'));
  expect(await screen.findByText('Sample backup saved.')).toBeOnTheScreen();
  expect(archive.chooseSampleBackupFile).toHaveBeenCalledWith(true, code.replace(/[-\s]/g, ''));
  expect(screen.queryByTestId('sample-backup-recovery-code')).toBeNull();
});

it('blocks malformed codes, handles cancelled or invalid files, and reports success only after restore', async () => {
  render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Restore sample backup'));
  const input = screen.getByLabelText('Backup recovery code');
  fireEvent.changeText(input, 'bad');
  expect(screen.getByRole('button', {name: 'Choose backup file'})).toBeDisabled();
  fireEvent.changeText(input, 'ABCD-'.repeat(7) + 'ABCD');
  jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce('').mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('fixture');
  fireEvent.press(screen.getByText('Choose backup file'));
  await waitFor(() => expect(screen.getByText('Choose backup file')).toBeOnTheScreen());
  fireEvent.press(screen.getByText('Choose backup file'));
  expect(await screen.findByText(/Could not restore/)).toBeOnTheScreen();
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Choose backup file'));
  expect(await screen.findByText('Restored and verified 2 sample entries and 2 photos.')).toBeOnTheScreen();
  expect(archive.chooseSampleBackupFile).toHaveBeenCalledWith(false, 'abcd'.repeat(8));
  expect(restoreSharedPhotoTransfer).toHaveBeenCalledWith('fixture');
});
