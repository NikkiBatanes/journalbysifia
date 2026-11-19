import React, {useEffect, useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import 'react-native-get-random-values';
import {createJournalBackup, validateJournalBackup} from '../services/journalBackupContract';
import {inspectJournalPhotoReferences} from './inspectJournalPhotoReferences';
import {planInventorySample} from './journalStagedBackup';
import type {SampleRevision} from './journalSharedPhotoTransferProbe';
import {useTheme} from '../theme/ThemeContext';

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

function newRecoveryCode() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').match(/.{4}/g)!.join('-');
}

export default function SampleLocalBackup() {
  const {colors, fontFamily} = useTheme();
  const [mode, setMode] = useState<'export' | 'inventory' | 'restore' | null>(null);
  const [entryCount, setEntryCount] = useState('300');
  const exporting = mode === 'export' || mode === 'inventory';
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
    setRevisionReview(null);
    comparison.current?.discard();
    comparison.current = null;
    setDeviceText('');
    if (pendingId.current) {discardPreview(pendingId.current);}
    pendingId.current = null;
    setPreview(null);
    setMode(null);
    setCode('');
    setAcknowledged(false);
  }
  function start(operation: 'export' | 'inventory' | 'restore') {
    if (running.current) {return;}
    setMessage('');
    try {
      setCode(operation === 'restore' ? '' : newRecoveryCode());
      setEntryCount('300');
      setAcknowledged(false);
      setMode(operation);
    } catch {
      setMessage('Journal could not generate a recovery code. Try again.');
    }
  }
  async function checkLocalJournal() {
    if (running.current) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const backup = await createJournalBackup();
      const result = validateJournalBackup(backup);
      if (!result.valid) {throw new Error('Local backup validation failed');}
      const photos = await inspectJournalPhotoReferences(backup.inventory, (uri, remaining) =>
        nativeArchive().inspectLocalPickerPhoto(uri, remaining));
      if (mounted.current) {
        setMessage(`Local journal, reflection and prayer entries: ${photos.entries}. Photo references in their journal blocks: ${photos.references}. Readable photo files: ${photos.readable}. Missing: ${photos.missing}. Unsupported: ${photos.unsupported}. Unreadable: ${photos.unreadable}. Over size limit: ${photos.overLimit}. Validation warnings: ${result.warnings.length}.`);
      }
    } catch {
      if (mounted.current) {setMessage('Could not verify a complete local journal snapshot. Try again after saving your edits.');}
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
    } catch {
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
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Text style={[text, styles.buttonText]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.section}>
      <Text style={[text, styles.title]}>Local backup test</Text>
      <Text style={text}>Practice saving and restoring generated journal entries.</Text>
      {!mode && <>
        {button('Save sample backup', () => start('export'), busy)}
        {button('Save a custom sample', () => start('inventory'), busy)}
        {button('Restore sample backup', () => start('restore'), busy)}
        {button(busy ? 'Checking…' : 'Check local journal counts', checkLocalJournal, busy)}
      </>}
      {exporting && <>
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
      {mode === 'restore' && !preview && <>
        <Text style={text}>Enter the recovery code saved with this sample.</Text>
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
      {!!message && <Text accessibilityLiveRegion="polite" style={text}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {padding: 16, gap: 8},
  title: {fontSize: 17, fontWeight: '600'},
  button: {minHeight: 44, justifyContent: 'center'},
  buttonText: {fontWeight: '600'},
  code: {fontSize: 17, fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'})},
  disabled: {opacity: 0.45},
  input: {minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8},
});
