import React, {useEffect, useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import 'react-native-get-random-values';
import {useTheme} from '../theme/ThemeContext';

type SamplePreview = {previewId: string; entries: number; photos: number; photoBytes: number; firstContent?: string};
type Comparison = Awaited<ReturnType<typeof import('./journalSharedPhotoTransferProbe').beginSampleComparison>>;
const nativeArchive = (): typeof import('../native/NativeJournalArchiveCrypto').default =>
  require('../native/NativeJournalArchiveCrypto').default;

function readPreview(result: string): SamplePreview {
  const value = JSON.parse(result);
  if (typeof value?.previewId !== 'string' || !/^[a-f0-9]{32}$/.test(value.previewId) ||
      value.entries !== 2 || value.photos !== 2 || !Number.isSafeInteger(value.photoBytes) || value.photoBytes <= 0) {
    throw new Error('Invalid sample preview');
  }
  if (value.firstContent !== undefined && value.firstContent !== 'Call Mom.' &&
      !(typeof value.firstContent === 'string' && /^first-[a-f0-9]{32}$/.test(value.firstContent))) {
    throw new Error('Invalid sample comparison text');
  }
  return value;
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
  const [mode, setMode] = useState<'export' | 'restore' | null>(null);
  const [code, setCode] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [preview, setPreview] = useState<SamplePreview | null>(null);
  const pendingId = useRef<string | null>(null);
  const comparison = useRef<Comparison | null>(null);
  const [deviceText, setDeviceText] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      comparison.current?.discard();
      comparison.current = null;
      if (pendingId.current) {discardPreview(pendingId.current);}
      pendingId.current = null;
    };
  }, []);
  const text = {color: colors.text, fontFamily};
  const displayedCode = code.slice(0, 19) + '\n' + code.slice(20);
  const normalized = code.replace(/[-\s]/g, '').toLowerCase();
  function reset() {
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
  function start(exporting: boolean) {
    setMessage('');
    try {
      setCode(exporting ? newRecoveryCode() : '');
      setAcknowledged(false);
      setMode(exporting ? 'export' : 'restore');
    } catch {
      setMessage('Journal could not generate a recovery code. Try again.');
    }
  }
  async function choose() {
    if (running.current || !mode || !/^[a-f0-9]{32}$/.test(normalized) || (mode === 'export' && !acknowledged)) {return;}
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const archive = nativeArchive();
      const exporting = mode === 'export';
      if (!exporting && typeof archive.finishSampleRestorePreview !== 'function') {
        setMessage('Rebuild the development app to preview a backup.');
        return;
      }
      const result = await archive.chooseSampleBackupFile(exporting, normalized);
      if (!result) {return;}
      if (!exporting) {
        const selected = readPreview(result);
        if (!mounted.current) {discardPreview(selected.previewId); return;}
        pendingId.current = selected.previewId;
        setPreview(selected);
        return;
      }
      reset();
      setMessage('Sample backup saved.');
    } catch {
      setMessage(mode === 'export' ? 'Could not save the sample backup. Try another location.' :
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
      const sample = await beginSampleComparison(preview.firstContent);
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
      if (sample) {await sample.keepBoth(document);} else {await restoreSharedPhotoTransfer(document);}
      reset();
      setMessage(sample ? 'Kept both versions. All 4 sample entries and 2 photos were verified after reopening.' : `Restored and verified ${preview.entries} sample entries and ${preview.photos} photos.`);
    } catch {
      setDeviceText('');
      setPreview(null);
      setMessage('Could not finish the restore. Select the backup again to retry.');
    } finally {
      sample?.discard();
      running.current = false;
      setBusy(false);
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
      <Text style={text}>Practice with two sample entries and two photos. Your journal stays separate.</Text>
      {!mode && <>
        {button('Save sample backup', () => start(true))}
        {button('Restore sample backup', () => start(false))}
      </>}
      {mode === 'export' && <>
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
        {deviceText ? <>
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
        {!preview && button(busy ? 'Working…' : mode === 'export' ? 'Choose save location' : 'Choose backup file', choose,
          busy || !/^[a-f0-9]{32}$/.test(normalized) || (mode === 'export' && !acknowledged))}
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
