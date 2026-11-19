import {
  JOURNAL_BACKUP_ARCHIVE_FORMAT,
  JOURNAL_BACKUP_ARCHIVE_LIMITS,
  countJournalBackupRecords,
  preflightJournalBackupArchiveRestore,
  utf8ByteLength,
  validateJournalBackupArchiveManifest,
} from '../journalBackupArchiveContract';
import {
  JOURNAL_BACKUP_APP_IDENTIFIER,
  JOURNAL_BACKUP_FORMAT,
} from '../journalBackupContract';

const makeBackup = () => ({
  format: JOURNAL_BACKUP_FORMAT,
  appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
  schemaVersion: 1,
  exportedAt: '2026-11-18T08:00:00.000Z',
  sensitive: true,
  inventory: {
    journalRecords: [{ id: 'journal-record-1', content_type: 'heart_journal', selected_date: '2026-11-18', content: '{}', created_at: '2026-11-18T08:00:00.000Z', updated_at: '2026-11-18T08:00:00.000Z' }],
    reflectionRecords: [],
    prayerRecords: [],
    bibleStudySessions: [],
    routineStates: [],
    reviews: [],
    reviewSettings: null,
    prayerDrafts: [],
    recordLocations: {
      journalRecords: [{ id: 'journal-record-1', key: 'journal_local:heart_journal:2026-11-18:journal-record-1' }],
      reflectionRecords: [],
      prayerRecords: [],
      bibleStudySessions: [],
      routineStates: [],
      reviews: [],
    },
    authoredDrafts: { sessionNotes: [], guidedReflections: [], routines: [] },
    gospelAuthoredContent: [],
    preferences: [],
    legacyAuthoredContent: { reflectionLogs: [], journalRecords: [] },
    integrity: {
      counts: {},
      tombstones: { journalRecords: 0, reflectionRecords: 0, prayerRecords: 0 },
      duplicateIds: [],
      danglingReferences: [],
      legacyOnlyRecords: { reflectionLogs: 0, journalRecords: 0 },
    },
  },
  integrity: {
    counts: {},
    tombstones: { journalRecords: 0, reflectionRecords: 0, prayerRecords: 0 },
    duplicateIds: [],
    danglingReferences: [],
    legacyOnlyRecords: { reflectionLogs: 0, journalRecords: 0 },
  },
});

const assetId = '11111111-1111-4111-8111-111111111111';
const makeManifest = () => {
  const backup = makeBackup();
  const assets = [{
    assetId,
    path: `objects/${assetId}`,
    kind: 'image',
    mediaType: 'image/jpeg',
    byteLength: 1024,
    sha256: 'a'.repeat(64),
    ownerRecordId: 'journal-record-1',
  }];
  return {
    format: JOURNAL_BACKUP_ARCHIVE_FORMAT,
    archiveVersion: 1,
    appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
    createdAt: '2026-11-18T08:00:00.000Z',
    snapshotId: '22222222-2222-4222-8222-222222222222',
    backup,
    assets,
    totals: { records: countJournalBackupRecords(backup as any), assets: 1, assetBytes: 1024 },
  };
};

it('validates a bounded V1 manifest and authenticated restore evidence', () => {
  const manifest = makeManifest();
  const validation = validateJournalBackupArchiveManifest(manifest);
  expect(validation.valid).toBe(true);
  expect(validation.calculated).toMatchObject({ records: 1, assets: 1, assetBytes: 1024 });

  const preflight = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength: 4096,
    manifestByteLength: validation.calculated!.manifestBytes,
    assetByteLengths: { [assetId]: 1024 },
    authenticatedFinalMarkerVerified: true,
  });
  expect(preflight.valid).toBe(true);
});

it('rejects traversal, absolute, and non-opaque asset paths', () => {
  for (const path of ['../secret', '/tmp/secret', `objects/${assetId}/extra`]) {
    const manifest = makeManifest();
    manifest.assets[0].path = path;
    const result = validateJournalBackupArchiveManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.fatal.map(entry => entry.code)).toContain('unsafe_asset_path');
  }
});

it('rejects mismatched totals and unsupported media before restore', () => {
  const manifest = makeManifest();
  manifest.totals.assetBytes = 1;
  manifest.assets[0].mediaType = 'video/mp4';
  const result = validateJournalBackupArchiveManifest(manifest);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toEqual(expect.arrayContaining([
    'unsupported_media_type',
    'archive_totals_mismatch',
  ]));
});

it('rejects an asset whose owning record is absent from the backup', () => {
  const manifest = makeManifest();
  manifest.assets[0].ownerRecordId = 'missing-record';
  const result = validateJournalBackupArchiveManifest(manifest);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toContain('orphan_asset_owner');
});

it('rejects unsafe object keys and over-limit strings', () => {
  const manifest = makeManifest() as any;
  manifest.backup.inventory.preferences.push(JSON.parse('{"key":"prefs:hapticsEnabled","value":{"__proto__":{"polluted":true}}}'));
  manifest.backup.inventory.reviewSettings = { note: 'x'.repeat(JOURNAL_BACKUP_ARCHIVE_LIMITS.maxStringBytes + 1) };
  manifest.totals.records = 3;
  const result = validateJournalBackupArchiveManifest(manifest);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toEqual(expect.arrayContaining([
    'prohibited_object_key',
    'manifest_string_too_large',
  ]));
  expect(({} as any).polluted).toBeUndefined();
});

it('rejects unauthenticated, truncated, mismatched, and unexpected restore evidence', () => {
  const manifest = makeManifest();
  const result = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength: 4096,
    manifestByteLength: utf8ByteLength(JSON.stringify(manifest)) - 1,
    assetByteLengths: { [assetId]: 100, '33333333-3333-4333-8333-333333333333': 1 },
    authenticatedFinalMarkerVerified: false,
  });
  expect(result.valid).toBe(false);
  expect(result.manifest).toBeUndefined();
  expect(result.fatal.map(entry => entry.code)).toEqual(expect.arrayContaining([
    'missing_authenticated_final_marker',
    'observed_manifest_size_mismatch',
    'observed_asset_size_mismatch',
    'unexpected_asset_evidence',
  ]));
});

it('rejects unsupported archive versions without migration guessing', () => {
  const manifest = { ...makeManifest(), archiveVersion: 2 };
  const result = validateJournalBackupArchiveManifest(manifest);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toContain('unsupported_archive_version');
});

it('allows shared integrity metadata and rejects a cycle before serialization', () => {
  const manifest = makeManifest();
  manifest.backup.integrity = manifest.backup.inventory.integrity;
  expect(validateJournalBackupArchiveManifest(manifest).valid).toBe(true);
  Object.assign(manifest.backup.integrity, {cycle: manifest});
  expect(validateJournalBackupArchiveManifest(manifest).fatal.map(issue => issue.code)).toContain('cyclic_manifest');
});
