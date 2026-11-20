import React, {useEffect, useRef, useState} from 'react';
import {Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import 'react-native-get-random-values';
import {createJournalBackup, validateJournalBackup} from '../services/journalBackupContract';
import {compareLocalSnapshotResult, inspectLocalSnapshotResult, LinkedBackupPhotoError, prepareJournalPhotoExport} from './prepareJournalPhotoManifest';
import {JournalBackupRestoreExecutionError} from '../services/journalBackupRestoreExecutor';
import {checkStreamedDeviceSnapshot, localSnapshotToken} from './journalStreamingSnapshotRestore';
import {checkDeviceSnapshot, hasDeviceRestoreSample} from './journalDeviceSnapshotRestore';
import {inspectJournalPhotoReferences} from './inspectJournalPhotoReferences';
import {planInventorySample} from './journalStagedBackup';
import type {SampleRevision} from './journalSharedPhotoTransferProbe';
import ExpandableJournalPhoto from '../components/journal/shared/ExpandableJournalPhoto';
import {reopenPracticePhotoReflection} from './readPracticePhotoReflection';
import {JournalBackupEntryReview} from './JournalBackupEntryReview';
import {useTheme} from '../theme/ThemeContext';

type BackupAction = 'export' | 'inventory' | 'restore' | 'saveLocal' | 'openLocal';
type SamplePreview = {previewId: string; inventory?: true; entries: number; photos: number; photoBytes: number; firstContent?: string; archiveDigest?: string; revision?: SampleRevision};
type Comparison = Awaited<ReturnType<typeof import('./journalSharedPhotoTransferProbe').beginSampleComparison>>;
const nativeArchive = (): typeof import('../native/NativeJournalArchiveCrypto').default =>
  require('../native/NativeJournalArchiveCrypto').default;

function readPreview(result: string): SamplePreview {
  const value = JSON.parse(result);
  if (typeof value?.previewId !== 'string' || !/^[a-f0-9]{32}$/.test(value.previewId)) {throw new Error('Invalid preview identity');}
  if (value.inventory !== undefined) {
    try {
      const {entries, photos, photoBytes, archiveDigest} = planInventorySample(JSON.stringify(value.inventory));
      return {previewId: value.previewId, inventory: true, entries, photos, photoBytes, archiveDigest};
    } catch (error) {
      discardPreview(value.previewId);
      throw error;
    }
  }
  if (value.entries !== 2 || value.photos !== (value.photoChange === 'added' ? 3 : 2) || !Number.isSafeInteger(value.photoBytes) || value.photoBytes <= 0) {
    throw new Error('Invalid sample preview');
  }
  if (value.photoChange !== undefined && value.photoChange !== 'added' && value.photoChange !== 'replaced') {
    throw new Error('Unknown sample photo revision');
  }
  const revised = value.photoChange !== undefined || value.baseDigest !== undefined || value.updatedAt !== undefined;
  if (revised && (value.firstContent !== 'Call Mom on Sunday.' || value.updatedAt !== '2026-11-20T00:00:00Z' ||
      typeof value.baseDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.baseDigest) ||
      typeof value.archiveDigest !== 'string' || value.baseDigest === value.archiveDigest)) {
    throw new Error('Invalid revised sample');
  }
  if (!revised && value.firstContent !== undefined && value.firstContent !== 'Call Mom.' &&
      !(typeof value.firstContent === 'string' && /^first-[a-f0-9]{32}$/.test(value.firstContent))) {
    throw new Error('Invalid sample comparison text');
  }
  if (value.archiveDigest !== undefined && (typeof value.archiveDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.archiveDigest))) {
    throw new Error('Invalid sample archive identity');
  }
  return {...value, revision: revised ? {
    ...(value.photoChange && {photoChange: value.photoChange}),
    baseDigest: value.baseDigest, archiveDigest: value.archiveDigest, updatedAt: value.updatedAt, firstContent: value.firstContent,
  } : undefined};
}

function discardPreview(id: string) {
  // Native also releases the bounded ciphertext snapshot on replacement or process exit.
  void nativeArchive().finishSampleRestorePreview(id, '', false).catch(() => {});
}

function releaseLocalStream(document: string | null) {
  const token = document && localSnapshotToken(document);
  if (token) {void nativeArchive().readLocalRestoreFrame(token, true).catch(() => {});}
}

function newRecoveryCode() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').match(/.{4}/g)!.join('-');
}

function RestoredPracticePhoto({photo, number}: {
  photo: {uri: string; caption: string};
  number: number;
}) {
  const {colors, fontFamily} = useTheme();
  const text = {color: colors.text, fontFamily};
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const label = `Restored photo ${number}`;
  return (
    <View>
      <ExpandableJournalPhoto uri={photo.uri} imageStyle={styles.practicePhoto}
        accessibilityLabel={label} onImageResult={setLoaded} />
      {loaded !== null && <Text style={text}>{label}{loaded ? ' loaded' : ' could not be displayed'}</Text>}
      {!!photo.caption && <Text style={text}>{photo.caption}</Text>}
    </View>
  );
}

export default function SampleLocalBackup() {
  const {colors, fontFamily} = useTheme();
  const [showPractice, setShowPractice] = useState(false);
  const [mode, setMode] = useState<BackupAction | null>(null);
  const [localPreview, setLocalPreview] = useState<ReturnType<typeof inspectLocalSnapshotResult> | null>(null);
  const [entryReview, setEntryReview] = useState<Awaited<ReturnType<typeof compareLocalSnapshotResult>> | null>(null);
  const [confirmAdditions, setConfirmAdditions] = useState(false);
  const [restoredPhoto, setRestoredPhoto] = useState<string | null>(null);
  const [practiceReflection, setPracticeReflection] = useState<Awaited<ReturnType<typeof reopenPracticePhotoReflection>> | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const selectedDocument = useRef<string | null>(null);
  const sampleDocument = useRef<string | null>(null);
  const [entryCount, setEntryCount] = useState('300');
  const exporting = mode === 'export' || mode === 'inventory' || mode === 'saveLocal';
  const validCount = /^\d{1,3}$/.test(entryCount) && Number(entryCount) <= 300;
  const [code, setCode] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [preview, setPreview] = useState<SamplePreview | null>(null);
  const pendingId = useRef<string | null>(null);
  const comparison = useRef<Comparison | null>(null);
  const lastRestore = useRef<Comparison | null>(null);
  const [revisionReview, setRevisionReview] = useState<Awaited<ReturnType<Comparison['reviewRevision']>> | null>(null);
  const [deviceText, setDeviceText] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseLocalStream(selectedDocument.current);
      selectedDocument.current = null;
      comparison.current?.discard();
      comparison.current = null;
      lastRestore.current?.discard();
      lastRestore.current = null;
      if (pendingId.current) {discardPreview(pendingId.current);}
      pendingId.current = null;
    };
  }, []);
  const text = {color: colors.text, fontFamily};
  const displayedCode = code.slice(0, 19) + '\n' + code.slice(20);
  const normalized = code.replace(/[-\s]/g, '').toLowerCase();
  const canChooseFile = /^[a-f0-9]{32}$/.test(normalized) && (!exporting || acknowledged) && (mode !== 'inventory' || validCount);
  function reset() {
    releaseLocalStream(selectedDocument.current);
    selectedDocument.current = null;
    setRevisionReview(null);
    comparison.current?.discard();
    comparison.current = null;
    setDeviceText('');
    if (pendingId.current) {discardPreview(pendingId.current);}
    pendingId.current = null;
    setPreview(null);
    setRestoredPhoto(null);
    setPracticeReflection(null);
    setPhotoLoaded(false);
    sampleDocument.current = null;
    setLocalPreview(null);
    setEntryReview(null);
    setConfirmAdditions(false);
    setMode(null);
    setCode('');
    setAcknowledged(false);
  }
  function start(operation: BackupAction) {
    if (running.current) {return;}
    setMessage('');
    setPracticeReflection(null);
    try {
      setCode(operation === 'restore' || operation === 'openLocal' ? '' : newRecoveryCode());
      setEntryCount('300');
      setAcknowledged(false);
      setMode(operation);
    } catch {
      setMessage('Journal could not generate a recovery code. Try again.');
    }
  }
  async function checkLocalJournal(operation: 'count' | 'photos' | 'snapshot' = 'count') {
    if (running.current) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const backup = await createJournalBackup();
      const result = validateJournalBackup(backup);
      if (!result.valid) {throw new Error('Local backup validation failed');}
      if (operation !== 'count') {
        const {manifest, sources} = await prepareJournalPhotoExport(backup, (uri, remaining) =>
          nativeArchive().describeLocalPickerPhoto(uri, remaining));
        if (operation === 'snapshot') {
          const verified = await nativeArchive().verifyLocalSnapshot(JSON.stringify(manifest), sources);
          if (!verified) {throw new Error('Snapshot verification failed');}
          if (mounted.current) {
            setMessage(`Encrypted and read back ${manifest.totals.records} records and ${manifest.totals.assets} photo${manifest.totals.assets === 1 ? '' : 's'}. The temporary file was discarded.`);
          }
          return;
        }
        if (mounted.current) {
          setMessage(`Checked photo links for export. Distinct photos: ${manifest.totals.assets}, ${manifest.totals.assetBytes} bytes. No backup file was saved.`);
        }
        return;
      }
      const photos = await inspectJournalPhotoReferences(backup.inventory, (uri, remaining) =>
        nativeArchive().inspectLocalPickerPhoto(uri, remaining));
      if (mounted.current) {
        setMessage(`Local journal, reflection and prayer entries: ${photos.entries}. Photo references in their journal blocks: ${photos.references}. Readable photo files: ${photos.readable}. Missing: ${photos.missing}. Unsupported: ${photos.unsupported}. Unreadable: ${photos.unreadable}. Over size limit: ${photos.overLimit}. Validation warnings: ${result.warnings.length}.`);
      }
    } catch {
      if (mounted.current) {setMessage(operation === 'snapshot'
        ? 'Could not verify the encrypted snapshot. Check the referenced photos and available device storage.'
        : operation === 'photos'
        ? 'Could not prepare photo links for export. Check local journal counts for missing or unsupported photos.'
        : 'Could not verify a complete local journal snapshot. Try again after saving your edits.');}
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function choose() {
    if (running.current || !mode || !canChooseFile) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const archive = nativeArchive();
      if (mode === 'saveLocal') {
        const backup = await createJournalBackup();
        if (!validateJournalBackup(backup).valid) {throw new Error('Invalid snapshot');}
        const {manifest, sources} = await prepareJournalPhotoExport(backup, (uri, remaining) =>
          archive.describeLocalPickerPhoto(uri, remaining));
        if (!mounted.current) {return;}
        const saved = await archive.saveLocalSnapshot(normalized, JSON.stringify(manifest), sources);
        if (saved === 'saved' && mounted.current) {
          reset();
          setMessage('Backup file saved. Select Check saved backup to open it with your recovery code.');
        }
        return;
      }
      if (mode === 'openLocal') {
        const opened = await archive.openLocalSnapshot(normalized);
        if (!opened) {return;}
        if (!mounted.current) {releaseLocalStream(opened); return;}
        let contents;
        try {contents = inspectLocalSnapshotResult(opened);} catch (error) {releaseLocalStream(opened); throw error;}
        reset();
        selectedDocument.current = opened;
        if (hasDeviceRestoreSample(opened)) {sampleDocument.current = opened;}
        setLocalPreview(contents);
        return;
      }
      if (!exporting && typeof archive.finishSampleRestorePreview !== 'function') {
        setMessage('Rebuild the development app to preview a backup.');
        return;
      }
      const result = mode === 'inventory'
        ? await archive.saveInventorySample(normalized, Number(entryCount))
        : await archive.chooseSampleBackupFile(exporting, normalized);
      if (!result) {return;}
      if (!exporting) {
        const selected = readPreview(result);
        if (!mounted.current) {discardPreview(selected.previewId); return;}
        pendingId.current = selected.previewId;
        if (!selected.inventory && selected.archiveDigest && lastRestore.current && await lastRestore.current.alreadyRestored(selected.archiveDigest)) {
          if (mounted.current) {
            reset();
            setMessage('You already restored this backup. Your entries and photos are unchanged.');
          }
          return;
        }
        if (selected.revision) {
          try {
            if (!lastRestore.current) {throw new Error('Missing original sample');}
            const review = await lastRestore.current.reviewRevision(selected.revision);
            if (!mounted.current) {return;}
            setRevisionReview(review);
          } catch {
            if (mounted.current) {
              reset();
              setMessage('Open the original sample backup and choose Keep both before reviewing this revision.');
            }
            return;
          }
        }
        if (!mounted.current) {return;}
        setPreview(selected);
        return;
      }
      reset();
      setMessage('Sample backup saved.');
    } catch (error) {
      if (mode === 'saveLocal' && error instanceof LinkedBackupPhotoError) {
        setMessage('Backup could not be saved. An entry links to a web photo. This backup supports photos saved on the device.');
        return;
      }
      if (mode === 'openLocal' || mode === 'saveLocal') {
        setMessage(mode === 'saveLocal' ? 'Could not save the journal backup. Check photo availability and free space before retrying.' :
          'Could not verify this journal backup. Check the file and recovery code.');
        return;
      }
      setMessage(exporting ? 'Could not save the sample backup. Try another location.' :
        'Could not preview the sample. Check the file and recovery code, then try again.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function compare() {
    if (!preview?.firstContent || running.current) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const {beginSampleComparison}: typeof import('./journalSharedPhotoTransferProbe') = require('./journalSharedPhotoTransferProbe');
      const sample = await beginSampleComparison(preview.firstContent, preview.archiveDigest);
      if (!mounted.current) {sample.discard(); return;}
      comparison.current = sample;
      setDeviceText(sample.deviceText);
    } catch {
      setMessage('Could not open the practice journal. Try again.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function confirmRestore() {
    if (running.current || !preview || pendingId.current !== preview.previewId) {return;}
    running.current = true;
    setBusy(true);
    pendingId.current = null;
    const sample = comparison.current;
    comparison.current = null;
    try {
      const document = await nativeArchive().finishSampleRestorePreview(preview.previewId, normalized, true);
      const {restoreSharedPhotoTransfer}: typeof import('./journalSharedPhotoTransferProbe') = require('./journalSharedPhotoTransferProbe');
      if (sample) {await sample.keepBoth(document);}
      else if (preview.inventory) {await restoreSharedPhotoTransfer(document, preview.archiveDigest);}
      else {await restoreSharedPhotoTransfer(document);}
      lastRestore.current?.discard();
      lastRestore.current = mounted.current && sample && preview.archiveDigest ? sample : null;
      reset();
      setMessage(sample ? 'Kept both versions. All 4 sample entries and 2 photos were verified after reopening.' : `Restored and verified ${preview.entries} sample entries and ${preview.photos} photos.`);
    } catch {
      setDeviceText('');
      setPreview(null);
      setMessage('Could not finish the restore. Select the backup again to retry.');
    } finally {
      if (sample !== lastRestore.current) {sample?.discard();}
      running.current = false;
      setBusy(false);
    }
  }
  async function saveRevision() {
    if (!revisionReview || !preview || pendingId.current !== preview.previewId || running.current) {return;}
    running.current = true;
    setBusy(true);
    try {
      if (preview.revision?.photoChange) {
        await revisionReview.keepBoth(() => {
          pendingId.current = null;
          return nativeArchive().finishSampleRestorePreview(preview.previewId, normalized, true);
        });
      } else {
        await revisionReview.keepBoth();
      }
      if (mounted.current) {
        reset();
        setMessage('Added the revised entry. Your device version and existing photos were kept.');
      }
    } catch {
      if (mounted.current) {
        reset();
        setMessage('Could not add the revised entry. Choose the file again to review the latest device version.');
      }
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function compareWithDevice() {
    const document = selectedDocument.current;
    if (!document || running.current) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    setEntryReview(null);
    setConfirmAdditions(false);
    try {
      const review = await compareLocalSnapshotResult(document,
        (uri, remaining) => nativeArchive().describeLocalPickerPhoto(uri, remaining));
      if (mounted.current) {setEntryReview(review);}
    } catch {
      if (mounted.current) {setMessage('Could not compare entries. Check that device photos are available and try again after saving your edits.');}
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function addMissingEntries() {
    if (!entryReview?.count || !confirmAdditions || running.current) {return;}
    running.current = true;
    setBusy(true);
    try {
      await entryReview.confirm();
      if (mounted.current) {
        reset();
        setMessage(`Added ${entryReview.count} missing ${entryReview.count === 1 ? 'entry' : 'entries'} to this journal.`);
      }
    } catch (error) {
      if (mounted.current) {
        setConfirmAdditions(false);
        setEntryReview(null);
        setMessage(error instanceof JournalBackupRestoreExecutionError && error.recoveryRequired
          ? 'Close and reopen Journal to recover the interrupted restore.'
          : error instanceof JournalBackupRestoreExecutionError && error.code === 'restore_preview_stale'
            ? 'Your journal changed after this comparison. Compare again before adding entries.'
            : 'Could not finish adding entries. Compare the backup again.');
      }
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function confirmStreamedSnapshot(addMissing = false) {
    const document = selectedDocument.current;
    if (!document || running.current) {return;}
    running.current = true;
    setBusy(true);
    try {
      const result = await checkStreamedDeviceSnapshot(document, (token, discard) => nativeArchive().readLocalRestoreFrame(token, discard), addMissing);
      if (mounted.current && addMissing) {
        setMessage(`Practice journal added ${result.addedEntries} missing ${result.addedEntries === 1 ? 'entry' : 'entries'} with ${result.photos} ${result.photos === 1 ? 'photo' : 'photos'}.`);
      } else if (mounted.current) {setMessage(`Test journal verified. Photos: ${result.photos}. Photo bytes: ${result.bytes}.`);}
    } catch {
      if (mounted.current) {setMessage('Could not verify the test journal. Open the practice backup again.');}
    } finally {
      running.current = false;
      if (mounted.current) {reset(); setBusy(false);}
    }
  }
  async function showReopenedReflection() {
    if (running.current) {return;}
    running.current = true;
    reset();
    setMessage('');
    setBusy(true);
    try {
      const reflection = await reopenPracticePhotoReflection();
      if (mounted.current) {setPracticeReflection(reflection);}
    } catch {
      if (mounted.current) {setMessage('Open the two-photo practice backup and add its missing entries to the practice journal first.');}
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function checkIsolatedJournal(document?: string) {
    if (running.current) {return;}
    running.current = true;
    setBusy(true);
    try {
      const sample = await checkDeviceSnapshot(document);
      if (mounted.current) {
        reset();
        if (!document) {setRestoredPhoto(sample.photoUri);}
        setMessage(document ? 'Sample restored. Restart Journal and choose Reopen restored sample.' :
          `Restored reflection: ${sample.content}. Verified photo: ${sample.photoBytes} bytes.`);
      }
    } catch {
      if (mounted.current) {setMessage('Could not verify the isolated journal. Open and restore the Files test sample first.');}
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  async function testLocalRestoreInterruption(large = false) {
    if (running.current) {return;}
    running.current = true;
    setBusy(true);
    try {
      if (large) {
        const {armLargeRestore} = await import('./journalLargeRestoreProbe');
        const {markLargeRestorePending} = await import('./journalRestoreStartup');
        await armLargeRestore(markLargeRestorePending);
        Alert.alert('Large journal ready for recovery', 'Reopen Journal with practice storage still full. Try Retry, then Simulate freeing space.');
        return;
      }
      const {armLocalRestoreInterruption} = await import('./journalLocalRestoreInterruption');
      const {markLocalRestorePending} = await import('./journalRestoreStartup');
      await armLocalRestoreInterruption(markLocalRestorePending, () =>
        Alert.alert('Local restore interruption armed', 'Close and reopen Journal to verify the saved practice edit.'));
    } catch {
      if (mounted.current) {setMessage('Could not complete the practice interruption check.');}
    } finally {
      running.current = false;
      if (mounted.current) {setBusy(false);}
    }
  }
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Text style={[text, styles.buttonText]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[text, styles.title]}>Local backup</Text>
      {!mode && !localPreview && <Text style={text}>Save an encrypted copy of this journal to Files. You can do this without signing in or subscribing.</Text>}
      {localPreview && <>
        <Text accessibilityRole="header" style={[text, styles.title]}>Backup contents</Text>
        <Text style={text}>Your recovery code opened this backup.</Text>
        <Text style={text}>Saved {new Date(localPreview.createdAt).toLocaleString()}</Text>
        <Text style={text}>{localPreview.records} {localPreview.records === 1 ? 'record' : 'records'} in this backup</Text>
        {localPreview.sections.map(([label, count]) => <Text key={label} style={text}>{label} · {count}</Text>)}
        <Text style={text}>Attached photos · {localPreview.photos}{localPreview.photos > 0 ? ` (${localPreview.photoBytes.toLocaleString()} bytes)` : ''}</Text>
        {localPreview.legacyCount > 0 && <Text style={text}>Older records kept in the file and skipped during restore · {localPreview.legacyCount}</Text>}
        {button('Compare with this device', compareWithDevice, busy)}
        {entryReview && <>
          <JournalBackupEntryReview groups={entryReview.groups} />
          {entryReview.held > 0 && <Text style={text}>Missing entries held for a later restore because they contain photos or account data · {entryReview.held}</Text>}
          {entryReview.count > 0 && (confirmAdditions ? <>
            <Text style={text}>Add {entryReview.count} {entryReview.count === 1 ? 'entry' : 'entries'} to this device? Your existing entries and edits will be kept.</Text>
            {button('Confirm additions', addMissingEntries, busy)}
            {button('Cancel additions', () => setConfirmAdditions(false), busy)}
          </> : button(`Add ${entryReview.count} missing ${entryReview.count === 1 ? 'entry' : 'entries'}`, () => setConfirmAdditions(true), busy))}
        </>}
        {showPractice && selectedDocument.current && localSnapshotToken(selectedDocument.current) && <>
          {button('Add missing entries to practice journal', () => confirmStreamedSnapshot(true), busy)}
          {button('Restore and verify practice journal', () => confirmStreamedSnapshot(), busy)}
        </>}
        {showPractice && sampleDocument.current && button('Confirm restore to test journal', () => {
          if (sampleDocument.current) {void checkIsolatedJournal(sampleDocument.current);}
        }, busy)}
        {button('Close preview', () => {reset(); setMessage('');}, busy)}
      </>}
      {!mode && !localPreview && <>
        {button('Save encrypted backup', () => start('saveLocal'), busy)}
        {button('Check saved backup', () => start('openLocal'), busy)}
      </>}
      {exporting && <>
        {mode === 'saveLocal' && <Text style={text}>This file includes local backup records and supported JPEG and PNG photos from journal, reflection and prayer entries. Audio attachments are excluded.</Text>}
        {mode === 'inventory' && <>
          <Text style={text}>Choose 0 to 300 practice entries. Samples with two or more entries include three photos.</Text>
          <TextInput accessibilityLabel="Number of sample entries" keyboardType="number-pad"
            value={entryCount} onChangeText={setEntryCount} editable={!busy} maxLength={3}
            style={[text, styles.input, {borderColor: colors.chevronColor}]} />
        </>}
        <Text style={text}>Keep this recovery code somewhere separate from the backup. You’ll need it to open the file.</Text>
        <Text testID="sample-backup-recovery-code" selectable style={[text, styles.code]}>{displayedCode}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked: acknowledged, disabled: busy}}
          disabled={busy} onPress={() => setAcknowledged(!acknowledged)} style={styles.button}>
          <Text style={text}>{acknowledged ? '☑' : '☐'}  I saved my recovery code</Text>
        </Pressable>
      </>}
      {(mode === 'restore' || mode === 'openLocal') && !preview && <>
        <Text style={text}>{mode === 'openLocal' ? 'Enter the recovery code for this journal backup. Checking the file leaves your entries untouched.' : 'Enter the recovery code saved with this sample.'}</Text>
        <TextInput accessibilityLabel="Backup recovery code" placeholder="Recovery code" secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={96} value={code}
          editable={!busy} onChangeText={setCode} style={[text, styles.input, {borderColor: colors.chevronColor}]} />
      </>}
      {preview && <>
        <Text accessibilityRole="header" style={[text, styles.title]}>Restore preview</Text>
        <Text style={text}>{preview.entries} sample entries · {preview.photos} photos</Text>
        <Text style={text}>{(preview.photoBytes / 1_000_000).toFixed(1)} MB of photos</Text>
        {revisionReview ? <>
          <Text accessibilityRole="header" style={[text, styles.title]}>One entry changed in this backup</Text>
          <Text style={[text, styles.buttonText]}>On this device</Text>
          <Text style={text}>{revisionReview.deviceText}</Text>
          <Text style={[text, styles.buttonText]}>In the revised backup</Text>
          <Text style={text}>{preview.firstContent}</Text>
          <Text style={text}>{preview.revision?.photoChange === 'added'
            ? 'Keep both adds a separate entry with one extra photo.'
            : preview.revision?.photoChange === 'replaced'
              ? 'Keep both adds a separate entry with a different second photo. Your original photo stays on this device.'
              : 'Keep both adds a separate entry using the two photos already restored.'}</Text>
          {button('Keep my device version', () => {reset(); setMessage('Kept your device version.');}, busy)}
          {button('Keep both versions', saveRevision, busy)}
        </> : preview.entries === 0 ? <Text style={text}>This backup contains no journal entries to restore.</Text> : deviceText ? <>
          <Text accessibilityRole="header" style={[text, styles.title]}>Two versions of one sample entry</Text>
          <Text style={[text, styles.buttonText]}>On this device</Text>
          <Text style={text}>{deviceText}</Text>
          <Text style={[text, styles.buttonText]}>In the backup</Text>
          <Text style={text}>{preview.firstContent}</Text>
          <Text style={text}>The backup version has two photos. Keep both adds it as a separate entry and preserves your device version.</Text>
          {button(busy ? 'Restoring…' : 'Keep both and restore sample', confirmRestore, busy)}
        </> : <>
          <Text style={text}>{preview.firstContent
            ? 'Restore to an empty test journal or compare with an edited sample entry.'
            : 'Restore to an empty test journal.'}</Text>
          {button(busy ? 'Working…' : 'Confirm sample restore', confirmRestore, busy)}
          {!!preview.firstContent && button('Compare with an existing sample journal', compare, busy)}
        </>}
      </>}
      {mode && <>
        {!preview && button(busy ? 'Working…' : exporting ? 'Choose save location' : 'Choose backup file', choose,
          busy || !canChooseFile)}
        {button('Cancel', () => {reset(); setMessage('');}, busy)}
      </>}
      {restoredPhoto && <Image source={{uri: restoredPhoto}} style={{width: 64, height: 64}}
        accessible accessibilityLabel="Restored practice photo"
        onLoad={() => setPhotoLoaded(true)} onError={() => setMessage('The restored photo could not be displayed.')} />}
      {photoLoaded && <Text style={text}>Restored photo displayed</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={text}>{message}</Text>}
      {!mode && !localPreview && <>
        <Pressable accessibilityRole="button" accessibilityState={{expanded: showPractice, disabled: busy}}
          disabled={busy} onPress={() => {setPracticeReflection(null); setShowPractice(value => !value);}} style={styles.button}>
          <Text style={text}>Development backup tools</Text>
        </Pressable>
        {showPractice && <>
          {button('Test interrupted restore with a practice edit', () => testLocalRestoreInterruption(), busy)}
          {button('Test large journal recovery', () => testLocalRestoreInterruption(true), busy)}
          {button('Open restored photo reflection', showReopenedReflection, busy)}
          {practiceReflection && <>
            <Text accessibilityRole="header" style={text}>Restored practice reflection</Text>
            <Text style={text}>{practiceReflection.content}</Text>
            {practiceReflection.photos.map((photo, index) =>
              <RestoredPracticePhoto key={index} photo={photo} number={index + 1} />
            )}
          </>}
          {button('Reopen restored sample', () => checkIsolatedJournal(), busy)}
          {button('Save sample backup', () => start('export'), busy)}
          {button('Save a custom sample', () => start('inventory'), busy)}
          {button('Restore sample backup', () => start('restore'), busy)}
          {button(busy ? 'Checking…' : 'Check local journal counts', () => checkLocalJournal(), busy)}
          {button('Verify encrypted local snapshot', () => checkLocalJournal('snapshot'), busy)}
          {button('Check photo links for export', () => checkLocalJournal('photos'), busy)}
        </>}
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  practicePhoto: {width: '100%', height: 160, borderRadius: 16},
  section: {padding: 16, gap: 8},
  title: {fontSize: 17, fontWeight: '600'},
  button: {minHeight: 44, justifyContent: 'center'},
  buttonText: {fontWeight: '600'},
  code: {fontSize: 17, fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'})},
  disabled: {opacity: 0.45},
  input: {minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8},
});
