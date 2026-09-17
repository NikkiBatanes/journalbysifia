const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockValues.get(key) ?? null])),
}));

import {
  createLocalReflection,
  deleteLocalReflection,
  findLocalReflection,
  getLocalReflection,
  updateLocalReflection,
} from '../reflectionStorage';
import { HEART_JOURNAL_CLASSIFICATIONS, heartJournalClassificationLabel } from '../../types/heartJournal';
import { GUIDED_REFLECTION_FORMAT, serializeGuidedReflection, type GuidedReflectionPayload } from '../../types/guidedReflection';

beforeEach(() => mockValues.clear());

describe('canonical local reflections', () => {
  it('creates, reopens, edits, and deletes a signed-out reflection without changing its identity or date', async () => {
    const created = await createLocalReflection({
      server_id: null,
      linked_account_id: null,
      title: 'A local reflection',
      content: 'First thought',
      type: 'free',
      selected_date: '2026-09-17',
      source: 'freeform',
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.selected_date).toBe('2026-09-17');
    expect(await getLocalReflection(created.id, 'free', created.selected_date)).toMatchObject({
      id: created.id,
      content: 'First thought',
    });

    const edited = await updateLocalReflection({ ...created, content: 'Edited thought' });
    expect(edited.id).toBe(created.id);
    expect(edited.selected_date).toBe(created.selected_date);
    expect(edited.version).toBe(2);
    expect(await findLocalReflection(created.id)).toMatchObject({ content: 'Edited thought' });

    await deleteLocalReflection(created.id, created.type, created.selected_date);
    expect(await getLocalReflection(created.id, created.type, created.selected_date)).toBeNull();
    expect(await findLocalReflection(created.id)).toBeNull();
  });

  it('preserves a guided prompt, response, date, and identity through a signed-out edit', async () => {
    const prompt = 'Where did you notice God\'s faithfulness today?';
    const created = await createLocalReflection({
      server_id: null,
      linked_account_id: null,
      title: prompt,
      content: 'In a kind conversation.',
      type: 'guided',
      source: 'guided',
      selected_date: '2026-09-17',
      metadata: {prompt},
    });

    const reopened = await findLocalReflection(created.id);
    expect(reopened).toMatchObject({
      id: created.id,
      type: 'guided',
      source: 'guided',
      selected_date: '2026-09-17',
      content: 'In a kind conversation.',
      metadata: {prompt},
    });

    const edited = await updateLocalReflection({...reopened!, content: 'In a kind conversation and answered prayer.'});
    expect(edited).toMatchObject({id: created.id, selected_date: created.selected_date, content: 'In a kind conversation and answered prayer.', metadata: {prompt}});
    expect(edited.version).toBe(2);
    expect(mockValues.size).toBe(2); // one canonical record and one derived index; no duplicate reflection

    await deleteLocalReflection(edited.id, edited.type, edited.selected_date);
    expect(await findLocalReflection(created.id)).toBeNull();
  });

  it.each(HEART_JOURNAL_CLASSIFICATIONS)('persists signed-out Heart Journal classification $value without changing type/source', async ({value, label}) => {
    const created = await createLocalReflection({ linked_account_id: null, title: label, content: 'Plain writing', type: 'free', source: 'freeform', selected_date: '2026-09-17', metadata: {journalClassification: value} });
    const reopened = await findLocalReflection(created.id);
    expect(reopened).toMatchObject({id: created.id, type: 'free', source: 'freeform', selected_date: '2026-09-17', metadata: {journalClassification: value}});
    expect(heartJournalClassificationLabel(reopened?.metadata?.journalClassification)).toBe(label);
  });

  it('changes classification on the same canonical record and preserves its creation identity', async () => {
    const created = await createLocalReflection({ linked_account_id: null, title: 'Entry', content: 'First', type: 'free', source: 'freeform', selected_date: '2026-09-17', metadata: {journalClassification: 'thoughts'} });
    const edited = await updateLocalReflection({...created, content: 'Edited', metadata: {...created.metadata, journalClassification: 'lesson'}});
    expect(edited).toMatchObject({id: created.id, created_at: created.created_at, selected_date: created.selected_date, type: 'free', source: 'freeform', metadata: {journalClassification: 'lesson'}});
    expect(edited.version).toBe(2);
    expect([...mockValues.keys()].filter(key => key.startsWith('reflection_local:free:'))).toHaveLength(1);
  });

  it('keeps legacy free writing unclassified while retaining the Thoughts display fallback', async () => {
    const created = await createLocalReflection({ linked_account_id: null, title: 'Legacy', content: 'Existing', type: 'free', source: 'freeform', selected_date: '2026-09-17' });
    expect((await findLocalReflection(created.id))?.metadata?.journalClassification).toBeUndefined();
    expect(heartJournalClassificationLabel(undefined) || 'Thoughts').toBe('Thoughts');
  });

  it('never persists Heart Journal classification on a new Guided reflection', async () => {
    const prompt = 'Where did you notice God today?';
    const created = await createLocalReflection({ linked_account_id: null, title: prompt, content: 'In a quiet moment.', type: 'guided', source: 'guided', selected_date: '2026-09-17', metadata: { prompt, journalClassification: 'thoughts' } });
    const reopened = await findLocalReflection(created.id);

    expect(reopened).toMatchObject({ id: created.id, type: 'guided', source: 'guided', selected_date: '2026-09-17', metadata: { prompt } });
    expect(reopened?.metadata?.journalClassification).toBeUndefined();
  });

  it('clears leaked classification when a Guided reflection is explicitly edited', async () => {
    const prompt = 'What are you carrying?';
    const created = await createLocalReflection({ linked_account_id: null, title: 'My original title', content: 'Original response', type: 'guided', source: 'guided', selected_date: '2026-09-17', metadata: { prompt } });
    const transitioned = await updateLocalReflection({ ...created, content: 'My original body', metadata: { ...created.metadata, prompt, journalClassification: 'notes' } });

    expect(transitioned).toMatchObject({ id: created.id, created_at: created.created_at, selected_date: created.selected_date, type: 'guided', source: 'guided', title: 'My original title', content: 'My original body', metadata: { prompt } });
    expect(transitioned.metadata?.journalClassification).toBeUndefined();
    expect([...mockValues.keys()].filter(key => key.startsWith('reflection_local:guided:'))).toHaveLength(1);
  });

  it('saves and edits an entire structured Guided journey as one signed-out canonical reflection', async () => {
    const journey: GuidedReflectionPayload = { format: GUIDED_REFLECTION_FORMAT, pathId: 'mind-feels-full', pathTitle: 'My mind feels full', currentStepId: 'faithful-step', completed: true, answers: [{ stepId: 'space', selected: ['Work'], notes: [] }, { stepId: 'faithful-step', fields: { do_today: 'Finish the proposal', leave_with_god: 'The outcome' }, notes: [{ id: 'note-1', kind: 'remember', text: 'Stay present.' }] }] };
    const created = await createLocalReflection({ linked_account_id: null, title: journey.pathTitle, content: serializeGuidedReflection(journey), type: 'guided', source: 'guided', selected_date: '2026-09-18', metadata: { prompt: journey.pathTitle, guidedJourney: journey } });
    const editedJourney = { ...journey, answers: [...journey.answers, { stepId: 'scripture', text: 'God knows tomorrow.', notes: [] }] };
    const edited = await updateLocalReflection({ ...created, content: serializeGuidedReflection(editedJourney), metadata: { ...created.metadata, guidedJourney: editedJourney } });
    expect(edited).toMatchObject({ id: created.id, created_at: created.created_at, selected_date: created.selected_date, type: 'guided', source: 'guided', version: 2, metadata: { prompt: journey.pathTitle, guidedJourney: editedJourney } });
    expect([...mockValues.keys()].filter(key => key.startsWith('reflection_local:guided:'))).toHaveLength(1);
  });
});
