import {
  SHARED_JOURNAL_CAPABILITIES,
  canJournalMutateSharedBase,
  getSharedJournalCapability,
  getJournalPersistencePolicy,
  isFreeSharedCapability,
  requiresJournalCloudForAutomaticRemotePersistence,
  validateSharedJournalCapabilityContract,
} from '../sharedJournalCapabilityContract';

describe('shared journal capability contract', () => {
  it('has no structural or product-boundary violations', () => {
    expect(validateSharedJournalCapabilityContract()).toEqual([]);
  });

  it('keeps siFia-supported authored records free and bidirectional', () => {
    for (const id of ['daily_journal', 'reflection', 'prayer', 'time_block'] as const) {
      expect(isFreeSharedCapability(id)).toBe(true);
      expect(canJournalMutateSharedBase(id)).toBe(true);
    }
  });

  it('keeps saved siFia artifacts visible but read-only in Journal', () => {
    for (const id of ['saved_devotional', 'saved_playbook'] as const) {
      expect(getSharedJournalCapability(id)).toMatchObject({
        scope: 'shared_display_only',
        journalOperations: ['read'],
        remotePersistence: 'free_sifia_account',
      });
    }
  });

  it('keeps Journal-only content out of siFia and gates only automatic remote persistence', () => {
    for (const id of ['bible_study', 'scripture_note', 'session_note', 'journal_extension', 'journal_media'] as const) {
      const capability = getSharedJournalCapability(id);
      expect(capability.sifiaOperations).toEqual([]);
      expect(requiresJournalCloudForAutomaticRemotePersistence(id)).toBe(true);
    }
  });

  it('backs up review answers and routine progress separately from their canonical references', () => {
    for (const id of ['review', 'routine_state'] as const) {
      expect(getSharedJournalCapability(id)).toMatchObject({
        scope: 'journal_orchestration',
        remotePersistence: 'journal_cloud_or_manual_export',
      });
    }
  });

  it('plans future read-only extension display without enabling current siFia access', () => {
    for (const id of ['journal_extension', 'journal_media'] as const) {
      expect(getSharedJournalCapability(id)).toMatchObject({
        sifiaOperations: [], futureSifiaOperations: ['read'],
      });
    }
    expect(getSharedJournalCapability('bible_study').futureSifiaOperations).toBeUndefined();
  });

  it('keeps Journal usable and exportable without signing in, even with stale paid state', () => {
    for (const item of SHARED_JOURNAL_CAPABILITIES) {
      expect(getJournalPersistencePolicy(item.id, {
        accountId: null, sharedSyncConnected: true, journalCloudEntitled: true,
      })).toEqual({ local: true, manualExport: true, freeSharedSync: false, journalCloudSync: false });
    }
  });

  it('does not enable free shared sync on sign-in until the user connects it', () => {
    expect(getJournalPersistencePolicy('reflection', {
      accountId: 'account-a', sharedSyncConnected: false, journalCloudEntitled: false,
    }).freeSharedSync).toBe(false);
  });

  it('syncs Heart Journal bases free while a photo remains local without cloud', () => {
    const context = { accountId: 'account-a', sharedSyncConnected: true, journalCloudEntitled: false };
    expect(getJournalPersistencePolicy('reflection', context)).toMatchObject({ freeSharedSync: true, journalCloudSync: false });
    expect(getJournalPersistencePolicy('journal_media', context)).toMatchObject({ freeSharedSync: false, journalCloudSync: false });
  });

  it('supports Journal-only subscribers without connecting the siFia shared-data path', () => {
    expect(getJournalPersistencePolicy('bible_study', {
      accountId: 'journal-only-account', sharedSyncConnected: false, journalCloudEntitled: true,
    })).toEqual({ local: true, manualExport: true, freeSharedSync: false, journalCloudSync: true });
  });

  it('keeps free sync and export available after the cloud subscription expires', () => {
    const context = { accountId: 'account-a', sharedSyncConnected: true, journalCloudEntitled: false };
    expect(getJournalPersistencePolicy('reflection', context).freeSharedSync).toBe(true);
    expect(getJournalPersistencePolicy('review', context)).toEqual({
      local: true, manualExport: true, freeSharedSync: false, journalCloudSync: false,
    });
  });

  it('uses unique capability identifiers', () => {
    const ids = SHARED_JOURNAL_CAPABILITIES.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

