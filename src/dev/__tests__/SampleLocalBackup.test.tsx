import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import SampleLocalBackup from '../SampleLocalBackup';
import archive from '../../native/NativeJournalArchiveCrypto';
import {restoreSharedPhotoTransfer} from '../journalSharedPhotoTransferProbe';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({__esModule: true, default: {chooseSampleBackupFile: jest.fn(), finishSampleRestorePreview: jest.fn()}}));
jest.mock('../journalSharedPhotoTransferProbe', () => ({restoreSharedPhotoTransfer: jest.fn()}));
jest.mock('../../theme/ThemeContext', () => ({useTheme: () => ({colors: {text: 'black'}})}));
jest.mock('react-native-get-random-values', () => {
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: require('node:crypto').webcrypto});
  return {};
});

const previewId = 'a'.repeat(32);
const selectedPreview = JSON.stringify({previewId, entries: 2, photos: 2, photoBytes: 3840000});
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(archive.finishSampleRestorePreview).mockResolvedValue('fixture');
});

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
    .mockResolvedValueOnce(selectedPreview);
  fireEvent.press(screen.getByText('Choose backup file'));
  await waitFor(() => expect(screen.getByText('Choose backup file')).toBeOnTheScreen());
  fireEvent.press(screen.getByText('Choose backup file'));
  expect(await screen.findByText(/Could not preview/)).toBeOnTheScreen();
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Choose backup file'));
  expect(await screen.findByText('2 sample entries · 2 photos')).toBeOnTheScreen();
  expect(archive.finishSampleRestorePreview).not.toHaveBeenCalled();
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Confirm sample restore'));
  expect(await screen.findByText('Restored and verified 2 sample entries and 2 photos.')).toBeOnTheScreen();
  expect(archive.chooseSampleBackupFile).toHaveBeenCalledWith(false, 'abcd'.repeat(8));
  expect(restoreSharedPhotoTransfer).toHaveBeenCalledWith('fixture');
});

it.each(['cancel', 'unmount'])('discards a preview on %s without restoring journal data', async action => {
  const view = render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Restore sample backup'));
  fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
  jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce(selectedPreview);
  fireEvent.press(screen.getByText('Choose backup file'));
  await screen.findByText('Confirm sample restore');
  if (action === 'unmount') {view.unmount();} else {fireEvent.press(screen.getByText('Cancel'));}
  expect(archive.finishSampleRestorePreview).toHaveBeenCalledTimes(1);
  expect(archive.finishSampleRestorePreview).toHaveBeenCalledWith(previewId, '', false);
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
});

it('discards the verified selection if the picker returns after leaving the screen', async () => {
  let finishPicking!: (result: string) => void;
  jest.mocked(archive.chooseSampleBackupFile).mockReturnValueOnce(new Promise(resolve => {
    finishPicking = resolve;
  }));
  const view = render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Restore sample backup'));
  fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
  fireEvent.press(screen.getByText('Choose backup file'));
  view.unmount();
  finishPicking(selectedPreview);
  await waitFor(() => expect(archive.finishSampleRestorePreview).toHaveBeenCalledWith(previewId, '', false));
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
});
