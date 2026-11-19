import React, {useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import 'react-native-get-random-values';
import {useTheme} from '../theme/ThemeContext';

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
  const text = {color: colors.text, fontFamily};
  const displayedCode = code.slice(0, 19) + '\n' + code.slice(20);
  const normalized = code.replace(/[-\s]/g, '').toLowerCase();
  function reset() {
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
      const archive: typeof import('../native/NativeJournalArchiveCrypto').default = require('../native/NativeJournalArchiveCrypto').default;
      const exporting = mode === 'export';
      const result = await archive.chooseSampleBackupFile(exporting, normalized);
      if (!result) {return;}
      if (!exporting) {
        const {restoreSharedPhotoTransfer}: typeof import('./journalSharedPhotoTransferProbe') = require('./journalSharedPhotoTransferProbe');
        await restoreSharedPhotoTransfer(result);
      }
      reset();
      setMessage(exporting ? 'Sample backup saved.' : 'Restored and verified 2 sample entries and 2 photos.');
    } catch {
      setMessage(mode === 'export' ? 'Could not save the sample backup. Try another location.' :
        'Could not restore the sample. Check the file and recovery code, then try again.');
    } finally {
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
      {mode === 'restore' && <>
        <Text style={text}>Enter the recovery code saved with this sample.</Text>
        <TextInput accessibilityLabel="Backup recovery code" placeholder="Recovery code" secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={96} value={code}
          editable={!busy} onChangeText={setCode} style={[text, styles.input, {borderColor: colors.chevronColor}]} />
      </>}
      {mode && <>
        {button(busy ? 'Working…' : mode === 'export' ? 'Choose save location' : 'Choose backup file', choose,
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
