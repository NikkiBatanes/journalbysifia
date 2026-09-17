import {
  SESSION_NOTE_TYPES,
  getSessionNoteConfig,
  getSessionNoteContext,
  getSessionNoteReflectionCopy,
  isSessionNoteType,
  normalizeSessionNoteType,
  resolveSessionNoteType,
  sessionNoteTypeLabel,
  sessionNoteTypeName,
} from '../sessionNotes';
import { HEART_JOURNAL_CLASSIFICATIONS } from '../heartJournal';

describe('Session Note types', () => {
  it('defines the six stable document types in picker order', () => {
    expect(SESSION_NOTE_TYPES.map(item => item.value)).toEqual([
      'sermon',
      'conference',
      'speaking',
      'meeting',
      'workshop',
      'other',
    ]);
    expect(SESSION_NOTE_TYPES.map(item => item.label)).toEqual([
      'Sermon',
      'Conference',
      'Speaking',
      'Meeting',
      'Workshop',
      'Other',
    ]);
  });

  it.each(SESSION_NOTE_TYPES)('maps $value to "$documentLabel"', ({ value, documentLabel }) => {
    expect(sessionNoteTypeLabel(value)).toBe(documentLabel);
    expect(isSessionNoteType(value)).toBe(true);
    expect(normalizeSessionNoteType(value)).toBe(value);
  });

  it('labels Other as Session Notes so it never collides with Heart Journal Notes', () => {
    expect(sessionNoteTypeLabel('other')).toBe('Session Notes');
    expect(sessionNoteTypeName('other')).toBe('Other');
    expect(HEART_JOURNAL_CLASSIFICATIONS.find(item => item.value === 'notes')?.label).toBe('Notes');
  });

  it('resolves a persisted sessionNoteType from entry metadata', () => {
    expect(resolveSessionNoteType({ metadata: { sessionNoteType: 'conference' } })).toBe('conference');
    expect(resolveSessionNoteType({ metadata: { sessionNoteType: 'workshop' } })).toBe('workshop');
  });

  it('falls back to sermon for legacy records without the field', () => {
    expect(resolveSessionNoteType({ metadata: { main_scripture: 'Romans 12:1' } })).toBe('sermon');
    expect(resolveSessionNoteType({ metadata: {} })).toBe('sermon');
    expect(resolveSessionNoteType({})).toBe('sermon');
    expect(resolveSessionNoteType(null)).toBe('sermon');
    expect(resolveSessionNoteType(undefined)).toBe('sermon');
  });

  it('falls back to sermon for unknown or malformed values', () => {
    expect(normalizeSessionNoteType('notes')).toBe('sermon');
    expect(normalizeSessionNoteType('Conference Notes')).toBe('sermon');
    expect(normalizeSessionNoteType(42)).toBe('sermon');
    expect(normalizeSessionNoteType(undefined)).toBe('sermon');
    expect(resolveSessionNoteType({ metadata: { sessionNoteType: 'brain_dump' } })).toBe('sermon');
  });

  it.each([
    ['sermon', 'Sermon title', 'Pastor / Speaker', ['Series', 'Main Scripture', 'Church / Event']],
    ['conference', 'Session title', 'Speaker', ['Conference / Event', 'Topic / Track', 'Location']],
    ['speaking', 'Talk title', 'Speaker / Presenter', ['Event', 'Topic / Theme', 'Location']],
    ['meeting', 'Meeting title', 'People / Team', ['Organization / Group', 'Topic / Agenda', 'Location']],
    ['workshop', 'Workshop title', 'Facilitator / Speaker', ['Workshop / Event', 'Topic / Theme', 'Location']],
    ['other', 'Note title', 'Person / Speaker', ['Event / Context', 'Topic', 'Location']],
  ] as const)('provides semantic UI config for %s', (type, titleLabel, personLabel, details) => {
    const config = getSessionNoteConfig(type);
    expect(config.titleLabel).toBe(titleLabel);
    expect(config.personLabel).toBe(personLabel);
    expect(config.details.map(field => field.label)).toEqual(details);
  });

  it('keeps sermon metadata literal and isolates metadata for every generalized type', () => {
    const metadata = {
      speaker: 'Pastor', series: 'Faith Series', main_scripture: 'Romans 12:1', church: 'Church',
      sessionNoteDetails: {meeting: {person: 'Team', event: 'Org', topic: 'Agenda', location: 'Room 2'}},
    };
    expect(getSessionNoteContext(metadata, 'sermon')).toEqual({person: 'Pastor', event: 'Faith Series', topic: 'Romans 12:1', location: 'Church'});
    expect(getSessionNoteContext(metadata, 'meeting')).toEqual({person: 'Team', event: 'Org', topic: 'Agenda', location: 'Room 2'});
    expect(getSessionNoteContext(metadata, 'conference')).toEqual({person: '', event: '', topic: '', location: ''});
  });

  it('keeps sermon reflection wording and uses coherent neutral wording elsewhere', () => {
    expect(getSessionNoteReflectionCopy('sermon')[3].subtitle).toContain('sermon');
    SESSION_NOTE_TYPES.filter(item => item.value !== 'sermon').forEach(item => {
      expect(getSessionNoteReflectionCopy(item.value).map(step => `${step.title} ${step.subtitle}`).join(' ')).not.toMatch(/sermon|Scripture revealed|truth from Scripture/i);
    });
  });
});
