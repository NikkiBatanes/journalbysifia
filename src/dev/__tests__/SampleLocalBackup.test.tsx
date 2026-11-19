import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import SampleLocalBackup from '../SampleLocalBackup';
import {JOURNAL_BACKUP_RESTORE_POLICY} from '../../services/journalBackupContract';
import {planInventorySample} from '../journalStagedBackup';
import archive from '../../native/NativeJournalArchiveCrypto';
import {beginSampleComparison, restoreSharedPhotoTransfer} from '../journalSharedPhotoTransferProbe';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({__esModule: true, default: {saveInventorySample: jest.fn(), chooseSampleBackupFile: jest.fn(), finishSampleRestorePreview: jest.fn()}}));
jest.mock('../journalSharedPhotoTransferProbe', () => ({restoreSharedPhotoTransfer: jest.fn(), beginSampleComparison: jest.fn()}));
jest.mock('../journalStagedBackup', () => ({planInventorySample: jest.fn()}));
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

it.each(['confirm', 'cancel'])('shows both sample texts before %s', async action => {
  const sample = {deviceText: 'Call Mom after dinner.', discard: jest.fn(), keepBoth: jest.fn(), reviewRevision: jest.fn(), alreadyRestored: jest.fn()};
  jest.mocked(beginSampleComparison).mockResolvedValue(sample);
  jest.mocked(archive.chooseSampleBackupFile).mockResolvedValue(JSON.stringify({
    ...JSON.parse(selectedPreview), firstContent: 'Call Mom.',
  }));
  render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Restore sample backup'));
  fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
  fireEvent.press(screen.getByText('Choose backup file'));
  fireEvent.press(await screen.findByText('Compare with an existing sample journal'));
  expect(await screen.findByText('Call Mom after dinner.')).toBeOnTheScreen();
  expect(screen.getByText('Call Mom.')).toBeOnTheScreen();
  expect(archive.finishSampleRestorePreview).not.toHaveBeenCalled();
  if (action === 'cancel') {
    fireEvent.press(screen.getByText('Cancel'));
    expect(sample.keepBoth).not.toHaveBeenCalled();
    expect(archive.finishSampleRestorePreview).toHaveBeenCalledWith(previewId, '', false);
  } else {
    fireEvent.press(screen.getByText('Keep both and restore sample'));
    expect(await screen.findByText(/All 4 sample entries/)).toBeOnTheScreen();
    expect(sample.keepBoth).toHaveBeenCalledWith('fixture');
  }
  expect(sample.discard).toHaveBeenCalled();
  expect(restoreSharedPhotoTransfer).not.toHaveBeenCalled();
});

it('recognizes a second verified selection before staging photos and still previews a different backup', async () => {
  const archiveDigest = '1'.repeat(64);
  const sample = {
    deviceText: 'Call Mom after dinner.', discard: jest.fn(), keepBoth: jest.fn(), reviewRevision: jest.fn(),
    alreadyRestored: jest.fn(async (digest: string) => digest === archiveDigest),
  };
  jest.mocked(beginSampleComparison).mockResolvedValue(sample);
  const view = render(<SampleLocalBackup />);
  async function select(id: string, digest: string) {
    jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce(JSON.stringify({
      ...JSON.parse(selectedPreview), previewId: id, firstContent: 'Call Mom.', archiveDigest: digest,
    }));
    fireEvent.press(screen.getByText('Restore sample backup'));
    fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
    fireEvent.press(screen.getByText('Choose backup file'));
  }
  await select(previewId, archiveDigest);
  fireEvent.press(await screen.findByText('Compare with an existing sample journal'));
  fireEvent.press(await screen.findByText('Keep both and restore sample'));
  await screen.findByText(/All 4 sample entries/);
  const secondId = '2'.repeat(32);
  await select(secondId, archiveDigest);
  await screen.findByText(/You already restored this backup/);
  expect(archive.finishSampleRestorePreview).toHaveBeenCalledTimes(2);
  expect(archive.finishSampleRestorePreview).toHaveBeenLastCalledWith(secondId, '', false);
  expect(sample.keepBoth).toHaveBeenCalledTimes(1);
  await select('3'.repeat(32), '4'.repeat(64));
  expect(await screen.findByText('Compare with an existing sample journal')).toBeOnTheScreen();
  view.unmount();
  expect(sample.discard).toHaveBeenCalledTimes(1);
});

it.each([
  ['keep device', undefined], ['keep both', undefined], ['missing original', undefined],
  ['keep device', 'added'], ['keep both', 'added'], ['keep device', 'replaced'], ['keep both', 'replaced'],
])('reviews a related backup before a decision: %s, %s', async (choice, photoChange) => {
  const digest = '1'.repeat(64);
  const revised = {...JSON.parse(selectedPreview), baseDigest: digest, archiveDigest: '3'.repeat(64),
    firstContent: 'Call Mom on Sunday.', updatedAt: '2026-11-20T00:00:00Z',
    photoChange, photos: photoChange === 'added' ? 3 : 2};
  const keepBoth = jest.fn(async (stage?: () => Promise<string>) => {if (stage) {await stage();}});
  const sample = {deviceText: 'Call Mom after dinner.', discard: jest.fn(), keepBoth: jest.fn(),
    alreadyRestored: jest.fn().mockResolvedValue(false),
    reviewRevision: jest.fn().mockResolvedValue({deviceText: 'I called Mom today.', keepBoth})};
  jest.mocked(beginSampleComparison).mockResolvedValue(sample);
  render(<SampleLocalBackup />);
  async function pick(value: object) {
    jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce(JSON.stringify(value));
    fireEvent.press(screen.getByText('Restore sample backup'));
    fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
    fireEvent.press(screen.getByText('Choose backup file'));
  }
  if (choice !== 'missing original') {
    await pick({...JSON.parse(selectedPreview), firstContent: 'Call Mom.', archiveDigest: digest});
    fireEvent.press(await screen.findByText('Compare with an existing sample journal'));
    fireEvent.press(await screen.findByText('Keep both and restore sample'));
    await screen.findByText(/All 4 sample entries/);
  }
  await pick(revised);
  if (choice === 'missing original') {
    await screen.findByText(/Open the original sample backup/);
  } else {
    await screen.findByText('I called Mom today.');
    expect(screen.getByText('Call Mom on Sunday.')).toBeOnTheScreen();
    if (photoChange) {
      expect(screen.getByText(photoChange === 'added' ? /with one extra photo/ : /with a different second photo/)).toBeOnTheScreen();
    }
    expect(keepBoth).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(choice === 'keep both' ? 'Keep both versions' : 'Keep my device version'));
    await screen.findByText(choice === 'keep both' ? /Added the revised entry/ : 'Kept your device version.');
  }
  expect(keepBoth).toHaveBeenCalledTimes(choice === 'keep both' ? 1 : 0);
  expect(archive.finishSampleRestorePreview).toHaveBeenLastCalledWith(previewId, photoChange && choice === 'keep both' ? 'b'.repeat(32) : '', Boolean(photoChange && choice === 'keep both'));
});

it.each([0, 300])('shows the verified count and handles confirmation for %i entries', async entries => {
  const digest = 'b'.repeat(64);
  jest.mocked(planInventorySample).mockReturnValue({
    plan: {valid: true, fatal: [], warnings: [], operations: [], operationCounts: {},
      clearOwnedKeysMatching: [], requiresRollbackSnapshot: true, interruptionHandling: JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling},
    entries, photos: 0, photoBytes: 0, archiveDigest: digest,
  });
  jest.mocked(archive.chooseSampleBackupFile).mockResolvedValueOnce(JSON.stringify({previewId, inventory: {}}));
  render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Restore sample backup'));
  fireEvent.changeText(screen.getByLabelText('Backup recovery code'), 'b'.repeat(32));
  fireEvent.press(screen.getByText('Choose backup file'));
  await screen.findByText(entries + ' sample entries · 0 photos');
  if (entries) {
    fireEvent.press(screen.getByText('Confirm sample restore'));
    await waitFor(() => expect(restoreSharedPhotoTransfer).toHaveBeenCalledWith('fixture', digest));
  } else {
    expect(screen.queryByText('Confirm sample restore')).toBeNull();
    fireEvent.press(screen.getByText('Cancel'));
    expect(archive.finishSampleRestorePreview).toHaveBeenCalledWith(previewId, '', false);
  }
});

it('exports only a bounded custom entry count after the recovery code is acknowledged', async () => {
  render(<SampleLocalBackup />);
  fireEvent.press(screen.getByText('Save a custom sample'));
  const choose = () => screen.getByRole('button', {name: 'Choose save location'});
  const count = screen.getByLabelText('Number of sample entries');
  expect(count.props.value).toBe('300');
  expect(choose()).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox'));
  for (const invalid of ['', '301', '-1', '1.5']) {
    fireEvent.changeText(count, invalid);
    expect(choose()).toBeDisabled();
  }
  fireEvent.changeText(count, '0');
  jest.mocked(archive.saveInventorySample).mockResolvedValueOnce('saved');
  fireEvent.press(choose());
  await screen.findByText('Sample backup saved.');
  expect(archive.saveInventorySample).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{32}$/), 0);
});

it('checks on-device counts only on request and keeps journal text and photo paths out of the screen', async () => {
  const fixture = {id: 'r1', type: 'free', selected_date: '2026-09-17',
    created_at: '2026-09-17T12:00:00Z', updated_at: '2026-09-17T12:00:00Z', content: 'private writing',
    metadata: {journalBlocks: [{kind: 'photo', uri: 'file:///private-photo'}]}};
  const rows: [string, string][] = [
    ['reflection_local:free:2026-09-17:r1', JSON.stringify(fixture)],
    ['reflection_local:free:2026-09-17:r2', JSON.stringify({...fixture, id: 'r2', deleted: true})],
  ];
  jest.mocked(AsyncStorage.getAllKeys).mockResolvedValue(rows.map(([key]) => key));
  jest.mocked(AsyncStorage.multiGet).mockResolvedValue(rows);
  render(<SampleLocalBackup />);
  expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Check local journal counts'));
  expect(await screen.findByText(/entries: 1\. Photo references in their journal blocks: 1\. Validation warnings: 0/)).toBeOnTheScreen();
  expect(screen.queryByText(/private writing|private-photo/)).toBeNull();
  expect(archive.chooseSampleBackupFile).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  jest.mocked(AsyncStorage.multiGet).mockRejectedValue(new Error('private writing'));
  fireEvent.press(screen.getByText('Check local journal counts'));
  expect(await screen.findByText(/Could not verify a complete local journal snapshot/)).toBeOnTheScreen();
  expect(screen.queryByText(/private writing|private-photo|Photo references in/)).toBeNull();
});
