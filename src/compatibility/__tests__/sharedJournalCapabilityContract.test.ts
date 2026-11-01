import {
  SHARED_JOURNAL_CAPABILITIES,
  canJournalMutateSharedBase,
  getSharedJournalCapability,
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

  it('classifies review and routine state as references rather than copied canonical content', () => {
    for (const id of ['review', 'routine_state'] as const) {
      expect(getSharedJournalCapability(id)).toMatchObject({
        scope: 'journal_orchestration',
        remotePersistence: 'follows_referenced_records',
      });
    }
  });

  it('uses unique capability identifiers', () => {
    const ids = SHARED_JOURNAL_CAPABILITIES.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

