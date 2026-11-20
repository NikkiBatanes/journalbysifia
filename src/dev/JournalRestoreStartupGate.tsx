import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, StyleSheet, Text, View} from 'react-native';
import {checkDevelopmentRestoreAtStartup, releasePracticeStorageLimit} from './journalRestoreStartup';

export default function JournalRestoreStartupGate() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'checking' | 'ready' | 'blocked' | 'practice-full'>('checking');
  useEffect(() => {
    let active = true;
    checkDevelopmentRestoreAtStartup().then(result => {
      if (!active) {return;}
      if (result === 'practice-full') {setState('practice-full'); return;}
      setState('ready');
      if (result !== 'idle') {
        Alert.alert('Journal startup restore check passed', result === 'device-recovered'
          ? 'Journal recovered the interrupted local restore before opening.'
          : result === 'large-recovered'
          ? 'Journal verified all 96 practice entries and their index after the storage failure.'
          : result === 'recovered'
          ? 'Journal recovered the original test entry before opening.'
          : 'Journal verified the original test entry before opening.');
      }
    }, () => {
      if (active) {setState('blocked');}
    });
    return () => { active = false; };
  }, [attempt]);

  if (state === 'ready') {
    // Defer the application module itself, including module-level storage readers.
    const App = require('../../App').default;
    return <App />;
  }
  const retry = () => {
    setState('checking');
    setAttempt(value => value + 1);
  };
  return (
    <View style={styles.container}>
      {state === 'blocked' || state === 'practice-full' ? <>
        <Text accessibilityRole="header">Journal recovery paused</Text>
        <Text>{state === 'practice-full'
          ? 'Practice storage is full. Your journal will open after recovery finishes.'
          : 'Unlock the device, make sure it has free storage, then retry recovery.'}</Text>
        <Button title="Retry" onPress={retry} />
        {state === 'practice-full' && <Button title="Simulate freeing space" onPress={async () => {
          setState('checking');
          try {
            await releasePracticeStorageLimit();
            retry();
          } catch {
            setState('practice-full');
          }
        }} />}
      </> : <ActivityIndicator accessibilityLabel="Checking Journal restore" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
});
