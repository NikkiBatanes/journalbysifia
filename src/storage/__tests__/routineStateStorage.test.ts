import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRoutineState,
  saveRoutineState,
  updateRoutineState,
} from '../routineStateStorage';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('routineStateStorage', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    storage.getItem.mockImplementation(async key => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => {
      values.set(key, value);
    });
  });

  it('isolates Morning and Evening on the same selected date', async () => {
    await saveRoutineState('morning', '2026-09-15', { completed_steps: ['emotion'] });
    await saveRoutineState('evening', '2026-09-15', { completed_steps: ['gratitude'] });

    expect((await getRoutineState('morning', '2026-09-15'))?.completed_steps).toEqual(['emotion']);
    expect((await getRoutineState('evening', '2026-09-15'))?.completed_steps).toEqual(['gratitude']);
  });

  it('isolates the same routine across selected dates and restores completed state', async () => {
    await saveRoutineState('morning', '2026-09-15', { completed_steps: ['emotion'] });
    await saveRoutineState('morning', '2026-09-16', { completed_steps: ['psalm'], completed: true });

    expect((await getRoutineState('morning', '2026-09-15'))?.completed_steps).toEqual(['emotion']);
    expect(await getRoutineState('morning', '2026-09-16')).toEqual(expect.objectContaining({
      selected_date: '2026-09-16',
      completed: true,
      completed_steps: ['psalm'],
    }));
  });

  it('serializes rapid updates so later writes retain earlier steps and refs', async () => {
    const addStep = (step: string) => updateRoutineState('evening', '2026-09-15', current => ({
      completed_steps: [...(current?.completed_steps ?? []), step],
      content_refs: {
        ...(current?.content_refs ?? {}),
        [step]: { domain: 'journal', content_type: step, local_id: `${step}-id` },
      },
    }));

    await Promise.all([addStep('gratitude'), addStep('win'), addStep('looking_forward')]);
    const state = await getRoutineState('evening', '2026-09-15');

    expect(state?.completed_steps).toEqual(['gratitude', 'win', 'looking_forward']);
    expect(Object.keys(state?.content_refs ?? {})).toEqual(['gratitude', 'win', 'looking_forward']);
  });

  it('orders completion after the final step update', async () => {
    const finalStep = updateRoutineState('morning', '2026-09-15', current => ({
      completed_steps: [...(current?.completed_steps ?? []), 'carry'],
    }));
    const completion = updateRoutineState('morning', '2026-09-15', () => ({ completed: true }));
    await Promise.all([finalStep, completion]);

    expect(await getRoutineState('morning', '2026-09-15')).toEqual(expect.objectContaining({
      completed: true,
      completed_steps: ['carry'],
    }));
  });

  it('keeps the same routine id and completed_at when a completed routine is reopened', async () => {
    const first = await saveRoutineState('evening', '2026-09-15', { completed: true });
    const reopened = await saveRoutineState('evening', '2026-09-15', {});
    const reopenedAgain = await saveRoutineState('evening', '2026-09-15', { completed: true });

    expect(reopened.id).toBe(first.id);
    expect(reopenedAgain.id).toBe(first.id);
    expect(reopened.completed_at).toBe(first.completed_at);
    expect(reopenedAgain.completed_at).toBe(first.completed_at);
  });
});
