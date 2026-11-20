import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, StyleSheet, Text, View} from 'react-native';
import {checkDevelopmentRestoreAtStartup} from './journalRestoreStartup';

export default function JournalRestoreStartupGate() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'checking' | 'ready' | 'blocked'>('checking');
  useEffect(() => {
    let active = true;
    checkDevelopmentRestoreAtStartup().then(result => {
      if (!active) {return;}
      setState('ready');
      if (result !== 'idle') {
        Alert.alert('Journal startup restore check passed', result === 'large-recovered'
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
  return (
    <View style={styles.container}>
      {state === 'blocked' ? <>
        <Text>Journal could not verify the development restore. Unlock the device and retry.</Text>
        <Button title="Retry" onPress={() => {
          setState('checking');
          setAttempt(value => value + 1);
        }} />
      </> : <ActivityIndicator accessibilityLabel="Checking Journal restore" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
});
