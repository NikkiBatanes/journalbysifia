import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import * as packaged from '@sifia/journal-contract';
import { getSharedJournalCapability } from '../sharedJournalCapabilityContract';
import { buildSharedJournalMergePreview } from '../sharedJournalMergePreview';
import { isCalendarDate } from '../sharedJournalFieldValidation';

describe('versioned shared contract package', () => {
  it('uses the installed shared implementation through the existing Journal entry points', () => {
    expect(getSharedJournalCapability).toBe(packaged.getSharedJournalCapability);
    expect(buildSharedJournalMergePreview).toBe(packaged.buildSharedJournalMergePreview);
    expect(isCalendarDate).toBe(packaged.isCalendarDate);
    expect(packaged.SHARED_JOURNAL_CONTRACT_VERSION).toBe(3);
    expect(packaged.validateSharedJournalCapabilityContract()).toEqual([]);
  });

  it('pins the local archive by integrity without a sibling checkout dependency', () => {
    const root = path.resolve(__dirname, '../../..');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const entry = lock.packages['node_modules/@sifia/journal-contract'];
    const bytes = fs.readFileSync(path.join(root, 'vendor/sifia-journal-contract-0.1.1.tgz'));
    expect(entry.version).toBe('0.1.1');
    expect(entry.resolved).toBe('file:vendor/sifia-journal-contract-0.1.1.tgz');
    expect(entry.integrity).toBe(`sha512-${createHash('sha512').update(bytes).digest('base64')}`);
  });

  it('contains no native/runtime dependencies or lifecycle install scripts', () => {
    const manifest = JSON.parse(fs.readFileSync(require.resolve('@sifia/journal-contract/package.json'), 'utf8'));
    expect(manifest.dependencies || {}).toEqual({});
    expect(manifest.scripts || {}).toEqual({});
    expect(manifest.sideEffects).toBe(false);
  });
});
