import type { JournalMergePreviewRecord } from '../sharedJournalMergePreview';
import type { LocalReflectionEntry } from '../../storage/reflectionStorage';

/** Synthetic local Heart Journal: matches the current metadata block location. */
export const heartJournalWithExtensions: LocalReflectionEntry = {
  id: 'heart-with-extensions', type: 'free', source: 'freeform',
  title: 'A quiet morning', content: 'This main text is shared.',
  selected_date: '2026-11-03', created_at: '2026-11-03T00:00:00.000Z',
  updated_at: '2026-11-03T00:00:00.000Z', linked_account_id: null,
  version: 1, sync_status: 'local',
  metadata: { journalClassification: 'notes', journalBlocks: [
    { id: 'photo-1', kind: 'photo', text: '', uri: 'file:///synthetic-only/photo.jpg' },
    { id: 'note-1', kind: 'note', text: 'Private structured block text.' },
    { id: 'future-1', kind: 'unknown_future_block', custom: { preserve: true } },
  ] },
};

// Normalized metadata only. A later audited adapter must classify stored variants
// and build an allowlisted shared base; never spread the raw record into a write.
export const heartJournalPreviewRecord: JournalMergePreviewRecord = {
  id: heartJournalWithExtensions.id, capabilityId: 'reflection', accountId: null,
};

/** 300 authored records; extensions are children, not extra entries in this count. */
export const makeThreeHundredGuestRecords = (): JournalMergePreviewRecord[] => [
  ...Array.from({ length: 80 }, (_, index) => ({
    id: `heart-${index}`, capabilityId: 'reflection', accountId: null,
  })),
  ...Array.from({ length: 40 }, (_, index) => ({
    id: `prayer-${index}`, capabilityId: 'prayer', accountId: null,
  })),
  ...Array.from({ length: 100 }, (_, index) => ({
    id: `study-${index}`, capabilityId: 'bible_study', accountId: null,
  })),
  ...Array.from({ length: 80 }, (_, index) => ({
    id: `review-${index}`, capabilityId: 'review', accountId: null,
  })),
];
