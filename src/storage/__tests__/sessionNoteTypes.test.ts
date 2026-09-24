const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockValues.get(key) ?? null])),
}));

import fs from 'fs';
import path from 'path';
import {
  createLocalReflection,
  findLocalReflection,
  getLocalReflection,
  updateLocalReflection,
} from '../reflectionStorage';
import { SESSION_NOTE_TYPES, resolveSessionNoteType } from '../../types/sessionNotes';
import { validateJournalBackup, JOURNAL_BACKUP_APP_IDENTIFIER, JOURNAL_BACKUP_FORMAT } from '../../services/journalBackupContract';

beforeEach(() => mockValues.clear());

const blocks = [
  { id: 'block-1', kind: 'text', text: 'Opening thought' },
  { id: 'block-2', kind: 'quote', text: 'A line worth keeping' },
  { id: 'block-3', kind: 'remember', text: 'Do not forget this' },
];

const sessionNotePayload = (sessionNoteType: string) => ({
  linked_account_id: null,
  title: '',
  content: JSON.stringify({ format: 'sermon_notes_v1', blocks }),
  type: 'sermon',
  source: 'sermon_notes',
  tags: ['sermon'],
  selected_date: '2026-09-18',
  metadata: { is_complete: true, sessionNoteType },
});

describe('Session Note types on the shared structured-note document', () => {
  it.each(SESSION_NOTE_TYPES.map(item => item.value))(
    'persists %s on the same canonical sermon_notes record and block format',
    async sessionNoteType => {
      const created = await createLocalReflection(sessionNotePayload(sessionNoteType));
      const reopened = await getLocalReflection(created.id, 'sermon', created.selected_date);

      expect(reopened).toMatchObject({
        id: created.id,
        type: 'sermon',
        source: 'sermon_notes',
        tags: ['sermon'],
        selected_date: '2026-09-18',
      });
      expect(reopened?.metadata?.sessionNoteType).toBe(sessionNoteType);
      expect(resolveSessionNoteType(reopened)).toBe(sessionNoteType);
      const content = JSON.parse(reopened!.content);
      expect(content.format).toBe('sermon_notes_v1');
      expect(content.blocks.map((block: any) => block.id)).toEqual(['block-1', 'block-2', 'block-3']);
      expect(content.blocks.map((block: any) => block.kind)).toEqual(['text', 'quote', 'remember']);
    },
  );

  it('resolves a legacy Sermon without sessionNoteType to sermon without mutating it', async () => {
    const created = await createLocalReflection({
      linked_account_id: null,
      title: 'Legacy sermon',
      content: JSON.stringify({ format: 'sermon_notes_v1', blocks }),
      type: 'sermon',
      source: 'sermon_notes',
      tags: ['sermon'],
      selected_date: '2026-09-18',
      metadata: { is_complete: true, main_scripture: 'Romans 12:1' },
    });

    const reopened = await getLocalReflection(created.id, 'sermon', created.selected_date);
    expect(reopened?.metadata?.sessionNoteType).toBeUndefined();
    expect(resolveSessionNoteType(reopened)).toBe('sermon');

    // Reading must not mutate the stored record
    const rawKey = `reflection_local:sermon:2026-09-18:${created.id}`;
    expect(JSON.parse(mockValues.get(rawKey)!)).toEqual(created);
    expect((await findLocalReflection(created.id))?.metadata?.sessionNoteType).toBeUndefined();
  });

  it('retains identity, date, created_at, blocks, and type through a signed-out edit', async () => {
    const created = await createLocalReflection(sessionNotePayload('meeting'));
    const edited = await updateLocalReflection({
      ...created,
      title: 'Weekly sync',
      content: JSON.stringify({ format: 'sermon_notes_v1', blocks: [...blocks, { id: 'block-4', kind: 'text', text: 'Action item' }] }),
      metadata: { ...created.metadata, notice: 'Follow up with Sam' },
    });

    expect(edited.id).toBe(created.id);
    expect(edited.selected_date).toBe(created.selected_date);
    expect(edited.created_at).toBe(created.created_at);
    expect(edited.type).toBe('sermon');
    expect(edited.source).toBe('sermon_notes');
    expect(edited.metadata?.sessionNoteType).toBe('meeting');
    expect(edited.version).toBe(2);
    expect(JSON.parse(edited.content).blocks.map((block: any) => block.id)).toEqual([
      'block-1', 'block-2', 'block-3', 'block-4',
    ]);

    // One canonical record only — no duplicate per session type
    expect([...mockValues.keys()].filter(key => key.startsWith('reflection_local:sermon:'))).toHaveLength(1);
  });

  it('persists the resolved sermon type when a legacy Sermon is explicitly saved', async () => {
    const created = await createLocalReflection({
      linked_account_id: null,
      title: 'Legacy sermon',
      content: JSON.stringify({ format: 'sermon_notes_v1', blocks }),
      type: 'sermon',
      source: 'sermon_notes',
      selected_date: '2026-09-18',
      metadata: { is_complete: false },
    });
    const resolved = resolveSessionNoteType(created);
    const edited = await updateLocalReflection({
      ...created,
      metadata: { ...created.metadata, is_complete: true, sessionNoteType: resolved },
    });
    expect(edited.metadata?.sessionNoteType).toBe('sermon');
    expect(edited.id).toBe(created.id);
  });

  it('keeps Heart Journal notes classification fully separate', async () => {
    const heartJournal = await createLocalReflection({
      linked_account_id: null,
      title: 'Keep this',
      content: 'Something to keep',
      type: 'free',
      source: 'freeform',
      selected_date: '2026-09-18',
      metadata: { journalClassification: 'notes' },
    });
    const sessionNote = await createLocalReflection(sessionNotePayload('workshop'));

    const reopenedJournal = await findLocalReflection(heartJournal.id);
    expect(reopenedJournal).toMatchObject({ type: 'free', source: 'freeform', metadata: { journalClassification: 'notes' } });
    expect(reopenedJournal?.metadata?.sessionNoteType).toBeUndefined();

    const reopenedNote = await findLocalReflection(sessionNote.id);
    expect(reopenedNote?.metadata?.sessionNoteType).toBe('workshop');
    expect(reopenedNote?.metadata?.journalClassification).toBeUndefined();
  });

  it('leaves Guided reflections unchanged', async () => {
    const created = await createLocalReflection({
      linked_account_id: null,
      title: 'Prompt',
      content: 'Response',
      type: 'guided',
      source: 'guided',
      selected_date: '2026-09-18',
      metadata: { prompt: 'Prompt' },
    });
    const reopened = await findLocalReflection(created.id);
    expect(reopened?.metadata?.sessionNoteType).toBeUndefined();
    expect(reopened?.metadata).toEqual({ prompt: 'Prompt' });
  });

  it('preserves sessionNoteType verbatim in a valid backup inventory', () => {
    const record = { id: 'conf-1', type: 'sermon', source: 'sermon_notes', selected_date: '2026-09-18', content: '{}', created_at: '2026-09-18T10:00:00.000Z', updated_at: '2026-09-18T10:00:00.000Z', metadata: { sessionNoteType: 'conference' } };
    const backup = {
      format: JOURNAL_BACKUP_FORMAT,
      appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
      schemaVersion: 1,
      exportedAt: '2026-09-18T12:00:00.000Z',
      sensitive: true,
      inventory: {
        journalRecords: [], reflectionRecords: [record], prayerRecords: [],
        bibleStudySessions: [], routineStates: [], reviews: [], prayerDrafts: [],
        legacyAuthoredContent: { reflectionLogs: [], journalRecords: [] },
      },
      integrity: { counts: {}, tombstones: { journalRecords: 0, reflectionRecords: 0, prayerRecords: 0 }, duplicateIds: [], danglingReferences: [], legacyOnlyRecords: { reflectionLogs: 0, journalRecords: 0 } },
    };
    expect(validateJournalBackup(backup).valid).toBe(true);
    expect(backup.inventory.reflectionRecords[0].metadata.sessionNoteType).toBe('conference');
  });

  it('keeps a single shared editor wired to the session type param and shared block system', () => {
    const screen = fs.readFileSync(path.resolve(__dirname, '../../screens/SermonNotesScreen.tsx'), 'utf8');
    expect(screen).toContain('route?.params?.sessionNoteType');
    expect(screen).toContain('sessionNoteType,');
    expect(screen).toContain('SERMON_BLOCK_KINDS');
    expect(screen).toContain('<JournalBlockPickerMenu');
    expect(screen).toContain('<JournalComposerBar');
    expect(screen).not.toContain('ConferenceNotesScreen');
  });

  it('focuses the first details field after Add more details mounts it', () => {
    const screen = fs.readFileSync(path.resolve(__dirname, '../../screens/SermonNotesScreen.tsx'), 'utf8');
    expect(screen).toContain('const pendingSeriesFocusRef = useRef(false);');
    expect(screen).toMatch(
      /pendingSeriesFocusRef\.current = !showDetails;[\s\S]*?setShowDetails\(value => !value\);/,
    );
    expect(screen).toMatch(
      /inputLayouts\.current\.series = \{[\s\S]*?if \(pendingSeriesFocusRef\.current\) \{[\s\S]*?seriesInputRef\.current\?\.focus\(\);/,
    );
  });
});
