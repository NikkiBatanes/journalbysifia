/**
 * Portable Journal backup archive manifest and restore preflight.
 *
 * This module is deliberately pure. It does not create files, decrypt bytes,
 * read media, write storage, or select a cryptographic implementation. The
 * manifest is intended to live inside a future authenticated encrypted
 * container; accepting this manifest alone never proves authenticity.
 */
import {
  JOURNAL_BACKUP_APP_IDENTIFIER,
  validateJournalBackup,
  type JournalBackupEnvelopeV1,
  type JournalBackupValidationIssue,
} from './journalBackupContract';

export const JOURNAL_BACKUP_ARCHIVE_FORMAT = 'journal-by-sifia-portable-archive';
export const JOURNAL_BACKUP_ARCHIVE_VERSION = 1 as const;

export const JOURNAL_BACKUP_ARCHIVE_LIMITS = {
  maxManifestBytes: 16 * 1024 * 1024,
  maxContainerBytes: 5_100_000_000,
  maxRecordCount: 50_000,
  maxAssetCount: 10_000,
  maxAssetBytes: 512 * 1024 * 1024,
  maxTotalAssetBytes: 5_000_000_000,
  maxDepth: 32,
  maxNodes: 500_000,
  maxStringBytes: 4 * 1024 * 1024,
  maxObjectKeyBytes: 512,
} as const;

export type JournalBackupAssetKind = 'image' | 'audio';

export interface JournalBackupArchiveAssetV1 {
  assetId: string;
  /** Content-addressed only inside the encrypted container. */
  path: string;
  kind: JournalBackupAssetKind;
  mediaType: string;
  byteLength: number;
  sha256: string;
  ownerRecordId: string;
}

export interface JournalBackupArchiveManifestV1 {
  format: typeof JOURNAL_BACKUP_ARCHIVE_FORMAT;
  archiveVersion: typeof JOURNAL_BACKUP_ARCHIVE_VERSION;
  appIdentifier: typeof JOURNAL_BACKUP_APP_IDENTIFIER;
  createdAt: string;
  snapshotId: string;
  backup: JournalBackupEnvelopeV1;
  assets: JournalBackupArchiveAssetV1[];
  totals: {
    records: number;
    assets: number;
    assetBytes: number;
  };
}

export interface JournalBackupArchiveValidationResult {
  valid: boolean;
  manifest?: JournalBackupArchiveManifestV1;
  fatal: JournalBackupValidationIssue[];
  warnings: JournalBackupValidationIssue[];
  calculated?: {
    manifestBytes: number;
    records: number;
    assets: number;
    assetBytes: number;
  };
}

export interface JournalBackupArchiveRestoreEvidence {
  /** Exact encrypted container length from the file descriptor. */
  containerByteLength: number;
  /** Exact authenticated manifest plaintext length, before JSON parsing. */
  manifestByteLength: number;
  /** Exact authenticated plaintext length for every declared object. */
  assetByteLengths: Record<string, number>;
  /** Set only after the native stream verified the authenticated final marker. */
  authenticatedFinalMarkerVerified: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MEDIA_TYPES: Record<JournalBackupAssetKind, ReadonlySet<string>> = {
  image: new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']),
  audio: new Set(['audio/aac', 'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']),
};
const PROHIBITED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const issue = (
  severity: 'fatal' | 'warning',
  code: string,
  path: string,
  message: string,
): JournalBackupValidationIssue => ({ severity, code, path, message });

/** UTF-8 byte length without relying on Node Buffer or a platform TextEncoder. */
export const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {bytes += 1;}
    else if (code <= 0x7ff) {bytes += 2;}
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {bytes += 4; index += 1;}
      else {bytes += 3;}
    } else {bytes += 3;}
  }
  return bytes;
};

const inspectStructure = (
  value: unknown,
  fatal: JournalBackupValidationIssue[],
): void => {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  const visit = (current: unknown, path: string, depth: number) => {
    nodes += 1;
    if (nodes > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxNodes) {
      if (!fatal.some(entry => entry.code === 'too_many_manifest_nodes')) {
        fatal.push(issue('fatal', 'too_many_manifest_nodes', path, 'Archive manifest exceeds the structural node limit.'));
      }
      return;
    }
    if (depth > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxDepth) {
      fatal.push(issue('fatal', 'manifest_nesting_too_deep', path, 'Archive manifest exceeds the nesting-depth limit.'));
      return;
    }
    if (typeof current === 'string') {
      if (utf8ByteLength(current) > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxStringBytes) {
        fatal.push(issue('fatal', 'manifest_string_too_large', path, 'Archive contains a string above the allowed byte limit.'));
      }
      return;
    }
    if (!current || typeof current !== 'object') {return;}
    if (ancestors.has(current)) {
      fatal.push(issue('fatal', 'cyclic_manifest', path, 'Archive manifest must be JSON-serializable and acyclic.'));
      return;
    }
    ancestors.add(current);
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
      ancestors.delete(current);
      return;
    }
    Object.keys(current).forEach(key => {
      if (PROHIBITED_OBJECT_KEYS.has(key)) {
        fatal.push(issue('fatal', 'prohibited_object_key', `${path}.${key}`, 'Archive contains an unsafe object key.'));
      }
      if (utf8ByteLength(key) > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxObjectKeyBytes) {
        fatal.push(issue('fatal', 'object_key_too_large', path, 'Archive object key exceeds the byte limit.'));
      }
      visit((current as Record<string, unknown>)[key], `${path}.${key}`, depth + 1);
    });
    ancestors.delete(current);
  };
  visit(value, '$', 0);
};

export const countJournalBackupRecords = (backup: JournalBackupEnvelopeV1): number => {
  const inventory = backup.inventory;
  return inventory.journalRecords.length
    + inventory.reflectionRecords.length
    + inventory.prayerRecords.length
    + inventory.bibleStudySessions.length
    + inventory.routineStates.length
    + inventory.reviews.length
    + inventory.prayerDrafts.length
    + inventory.authoredDrafts.sessionNotes.length
    + inventory.authoredDrafts.guidedReflections.length
    + inventory.authoredDrafts.routines.length
    + inventory.gospelAuthoredContent.length
    + inventory.preferences.length
    + inventory.legacyAuthoredContent.reflectionLogs.length
    + inventory.legacyAuthoredContent.journalRecords.length
    + (inventory.reviewSettings === null ? 0 : 1);
};

const safeManifestBytes = (
  candidate: unknown,
  fatal: JournalBackupValidationIssue[],
): number | null => {
  try {
    const serialized = JSON.stringify(candidate);
    if (serialized === undefined) {throw new Error('not serializable');}
    return utf8ByteLength(serialized);
  } catch {
    fatal.push(issue('fatal', 'unserializable_manifest', '$', 'Archive manifest is not valid serializable JSON.'));
    return null;
  }
};

/**
 * Validates the authenticated manifest structure and declared resources. It
 * does not authenticate or decrypt a container; restore must additionally run
 * `preflightJournalBackupArchiveRestore` with native-stream evidence.
 */
export const validateJournalBackupArchiveManifest = (
  candidate: unknown,
): JournalBackupArchiveValidationResult => {
  const fatal: JournalBackupValidationIssue[] = [];
  const warnings: JournalBackupValidationIssue[] = [];
  inspectStructure(candidate, fatal);
  const manifestBytes = fatal.length ? null : safeManifestBytes(candidate, fatal);
  if (manifestBytes !== null && manifestBytes > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxManifestBytes) {
    fatal.push(issue('fatal', 'manifest_too_large', '$', 'Archive manifest exceeds the maximum byte length.'));
  }
  if (!isObject(candidate)) {
    return { valid: false, fatal: [...fatal, issue('fatal', 'malformed_archive_manifest', '$', 'Archive manifest must be an object.')], warnings };
  }
  if (candidate.format !== JOURNAL_BACKUP_ARCHIVE_FORMAT || candidate.appIdentifier !== JOURNAL_BACKUP_APP_IDENTIFIER) {
    fatal.push(issue('fatal', 'wrong_archive_application', '$', 'Manifest is not a Journal by siFia portable archive.'));
  }
  if (candidate.archiveVersion !== JOURNAL_BACKUP_ARCHIVE_VERSION) {
    fatal.push(issue('fatal', 'unsupported_archive_version', '$.archiveVersion', 'Archive version is unsupported and cannot be guessed.'));
  }
  if (typeof candidate.createdAt !== 'string' || Number.isNaN(Date.parse(candidate.createdAt))) {
    fatal.push(issue('fatal', 'invalid_archive_created_at', '$.createdAt', 'createdAt must be a valid timestamp.'));
  }
  if (typeof candidate.snapshotId !== 'string' || !UUID.test(candidate.snapshotId)) {
    fatal.push(issue('fatal', 'invalid_snapshot_id', '$.snapshotId', 'snapshotId must be a UUID.'));
  }
  const backupResult = validateJournalBackup(candidate.backup);
  fatal.push(...backupResult.fatal.map(entry => ({ ...entry, path: `$.backup${entry.path === '$' ? '' : entry.path.slice(1)}` })));
  warnings.push(...backupResult.warnings.map(entry => ({ ...entry, path: `$.backup${entry.path === '$' ? '' : entry.path.slice(1)}` })));
  if (!Array.isArray(candidate.assets)) {
    fatal.push(issue('fatal', 'malformed_asset_manifest', '$.assets', 'assets must be an array.'));
  }
  if (!isObject(candidate.totals)) {
    fatal.push(issue('fatal', 'malformed_archive_totals', '$.totals', 'Archive totals are required.'));
  }
  if (fatal.length || !backupResult.backup || !Array.isArray(candidate.assets) || !isObject(candidate.totals)) {
    return { valid: false, fatal, warnings };
  }

  const recordCount = countJournalBackupRecords(backupResult.backup);
  if (recordCount > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxRecordCount) {
    fatal.push(issue('fatal', 'too_many_records', '$.backup.inventory', 'Archive exceeds the record-count limit.'));
  }
  if (candidate.assets.length > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxAssetCount) {
    fatal.push(issue('fatal', 'too_many_assets', '$.assets', 'Archive exceeds the asset-count limit.'));
  }
  const assetIds = new Set<string>();
  const assetPaths = new Set<string>();
  const owningRecordIds = new Set([
    ...backupResult.backup.inventory.journalRecords,
    ...backupResult.backup.inventory.reflectionRecords,
    ...backupResult.backup.inventory.prayerRecords,
    ...backupResult.backup.inventory.bibleStudySessions,
    ...backupResult.backup.inventory.routineStates,
    ...backupResult.backup.inventory.reviews,
  ].map(record => record.id));
  let assetBytes = 0;
  candidate.assets.forEach((asset: unknown, index: number) => {
    const path = `$.assets[${index}]`;
    if (!isObject(asset)) {
      fatal.push(issue('fatal', 'malformed_asset', path, 'Asset entry must be an object.'));
      return;
    }
    if (typeof asset.assetId !== 'string' || !UUID.test(asset.assetId)) {
      fatal.push(issue('fatal', 'invalid_asset_id', `${path}.assetId`, 'Asset ID must be a UUID.'));
    } else if (assetIds.has(asset.assetId)) {
      fatal.push(issue('fatal', 'duplicate_asset_id', `${path}.assetId`, 'Asset ID must be unique.'));
    } else {assetIds.add(asset.assetId);}
    const expectedPath = typeof asset.assetId === 'string' ? `objects/${asset.assetId}` : '';
    if (asset.path !== expectedPath) {
      fatal.push(issue('fatal', 'unsafe_asset_path', `${path}.path`, 'Asset path must be the exact opaque content path.'));
    } else if (assetPaths.has(asset.path)) {
      fatal.push(issue('fatal', 'duplicate_asset_path', `${path}.path`, 'Asset path must be unique.'));
    } else {assetPaths.add(asset.path);}
    const kind: unknown = asset.kind;
    if (kind !== 'image' && kind !== 'audio') {
      fatal.push(issue('fatal', 'unsupported_asset_kind', `${path}.kind`, 'Only image and audio assets are supported in archive V1.'));
    } else if (typeof asset.mediaType !== 'string' || !MEDIA_TYPES[kind].has(asset.mediaType)) {
      fatal.push(issue('fatal', 'unsupported_media_type', `${path}.mediaType`, 'Asset media type is not allowlisted for its kind.'));
    }
    if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength < 0 || asset.byteLength > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxAssetBytes) {
      fatal.push(issue('fatal', 'invalid_asset_size', `${path}.byteLength`, 'Asset byte length is invalid or exceeds the per-object limit.'));
    } else {assetBytes += asset.byteLength;}
    if (typeof asset.sha256 !== 'string' || !SHA256.test(asset.sha256)) {
      fatal.push(issue('fatal', 'invalid_asset_hash', `${path}.sha256`, 'Asset requires a lowercase SHA-256 hex digest.'));
    }
    if (typeof asset.ownerRecordId !== 'string' || !asset.ownerRecordId || utf8ByteLength(asset.ownerRecordId) > 512) {
      fatal.push(issue('fatal', 'invalid_asset_owner', `${path}.ownerRecordId`, 'Asset requires a bounded owning record ID.'));
    } else if (!owningRecordIds.has(asset.ownerRecordId)) {
      fatal.push(issue('fatal', 'orphan_asset_owner', `${path}.ownerRecordId`, 'Asset owner does not exist in the authenticated backup inventory.'));
    }
  });
  if (assetBytes > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxTotalAssetBytes) {
    fatal.push(issue('fatal', 'archive_assets_too_large', '$.assets', 'Declared assets exceed the total archive byte limit.'));
  }
  const totals = candidate.totals;
  if (totals.records !== recordCount || totals.assets !== candidate.assets.length || totals.assetBytes !== assetBytes) {
    fatal.push(issue('fatal', 'archive_totals_mismatch', '$.totals', 'Declared archive totals do not match manifest contents.'));
  }
  const calculated = { manifestBytes: manifestBytes ?? 0, records: recordCount, assets: candidate.assets.length, assetBytes };
  return {
    valid: fatal.length === 0,
    manifest: fatal.length === 0 ? candidate as JournalBackupArchiveManifestV1 : undefined,
    fatal,
    warnings,
    calculated,
  };
};

/**
 * Restore-only preflight. The native authenticated stream must supply this
 * evidence after verifying the final marker and before any allocation/write.
 */
export const preflightJournalBackupArchiveRestore = (
  candidate: unknown,
  evidence: JournalBackupArchiveRestoreEvidence,
): JournalBackupArchiveValidationResult => {
  const result = validateJournalBackupArchiveManifest(candidate);
  const fatal = [...result.fatal];
  const warnings = [...result.warnings];
  if (!Number.isSafeInteger(evidence.containerByteLength) || evidence.containerByteLength <= 0 || evidence.containerByteLength > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxContainerBytes) {
    fatal.push(issue('fatal', 'invalid_container_size', '$evidence.containerByteLength', 'Encrypted container size is invalid or exceeds the limit.'));
  }
  if (!Number.isSafeInteger(evidence.manifestByteLength) || evidence.manifestByteLength <= 0 || evidence.manifestByteLength > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxManifestBytes) {
    fatal.push(issue('fatal', 'invalid_observed_manifest_size', '$evidence.manifestByteLength', 'Authenticated manifest byte length is invalid or exceeds the limit.'));
  } else if (result.calculated && evidence.manifestByteLength !== result.calculated.manifestBytes) {
    fatal.push(issue('fatal', 'observed_manifest_size_mismatch', '$evidence.manifestByteLength', 'Authenticated manifest byte length does not match the validated manifest.'));
  }
  if (evidence.authenticatedFinalMarkerVerified !== true) {
    fatal.push(issue('fatal', 'missing_authenticated_final_marker', '$evidence.authenticatedFinalMarkerVerified', 'Truncated or unauthenticated archives cannot be restored.'));
  }
  if (result.manifest) {
    const declaredIds = new Set(result.manifest.assets.map(asset => asset.assetId));
    const observedAssetByteLengths = isObject(evidence.assetByteLengths)
      ? evidence.assetByteLengths
      : {};
    if (!isObject(evidence.assetByteLengths)) {
      fatal.push(issue('fatal', 'invalid_asset_evidence', '$evidence.assetByteLengths', 'Authenticated asset-length evidence must be an object.'));
    }
    Object.keys(observedAssetByteLengths).forEach(assetId => {
      if (!declaredIds.has(assetId)) {
        fatal.push(issue('fatal', 'unexpected_asset_evidence', '$evidence.assetByteLengths', 'Observed asset is not declared by the authenticated manifest.'));
      }
    });
    result.manifest.assets.forEach(asset => {
      if (observedAssetByteLengths[asset.assetId] !== asset.byteLength) {
        fatal.push(issue('fatal', 'observed_asset_size_mismatch', `$evidence.assetByteLengths.${asset.assetId}`, 'Observed authenticated asset length does not match the manifest.'));
      }
    });
  }
  return {
    ...result,
    valid: result.valid && fatal.length === 0,
    manifest: result.valid && fatal.length === 0 ? result.manifest : undefined,
    fatal,
    warnings,
  };
};
