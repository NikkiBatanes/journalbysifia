// QA entry point for a disposable Release build. Copy to the checkout's index.js.
// The normal app entry point never imports this file.
import React from 'react';
import {AppRegistry, Text} from 'react-native';
import {open} from '@op-engineering/op-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const databaseName = 'journal-release-provider-fixture.sqlite';
const expectedProvider = 'OpenSSL 3.5.9 29 Sep 2026';
const expectedCipher = '4.19.0 community';
const expectedValue = 'synthetic release fixture';

async function checkStorage() {
  const db = open({
    name: databaseName,
    encryptionKey: 'public-fixture-key-only',
  });
  try {
    const provider = (await db.execute('PRAGMA cipher_provider_version'))
      .rows[0]?.cipher_provider_version;
    const cipher = (await db.execute('PRAGMA cipher_version')).rows[0]
      ?.cipher_version;
    if (provider !== expectedProvider || cipher !== expectedCipher) {
      throw new Error(
        `Unexpected database provider: ${provider}, SQLCipher ${cipher}`,
      );
    }
    const exists =
      (
        await db.execute(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='fixture'",
        )
      ).rows.length > 0;
    if (!exists) {
      await db.transaction(async tx => {
        await tx.execute(
          'CREATE TABLE fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
        );
        await tx.execute('INSERT INTO fixture VALUES (1, ?)', [expectedValue]);
      });
    }
    const rows = (await db.execute('SELECT value FROM fixture')).rows;
    if (rows.length !== 1 || rows[0].value !== expectedValue) {
      throw new Error('Synthetic value did not survive');
    }
    return {status: exists ? 'reopened' : 'created', provider, cipher};
  } finally {
    db.close();
  }
}

function Probe() {
  const [message, setMessage] = React.useState('Checking encrypted storage');
  React.useEffect(() => {
    async function run() {
      const report = await checkStorage().catch(error => ({
        status: 'failed',
        detail: String(error),
      }));
      await AsyncStorage.setItem(
        'journal-release-provider-result',
        JSON.stringify(report),
      );
      setMessage(JSON.stringify(report));
    }
    run().catch(error => setMessage(String(error)));
  }, []);
  return React.createElement(Text, {accessible: true}, message);
}

AppRegistry.registerComponent('JournalBySiFia', () => Probe);
