import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearGuidedReflectionDraft, loadGuidedReflectionDraft, saveGuidedReflectionDraft } from '../guidedReflectionDraftStorage';
import { GUIDED_REFLECTION_FORMAT, type GuidedReflectionPayload } from '../../types/guidedReflection';

jest.mock('@react-native-async-storage/async-storage', () => ({ setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() }));

const payload: GuidedReflectionPayload = { format: GUIDED_REFLECTION_FORMAT, pathId: 'decision-to-make', pathTitle: 'I have a decision to make', currentStepId: 'options', completed: false, answers: [{ stepId: 'options', fields: { option_a_name: 'Stay', option_b_name: 'Go' }, notes: [{ id: 'stable-note', kind: 'question', text: 'Who is affected?' }] }] };

describe('Guided Reflection draft storage', () => {
  beforeEach(() => jest.clearAllMocks());
  it('restores current step, fields, selections, optional writing, and ordered note identity locally', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(payload));
    await saveGuidedReflectionDraft('2026-09-18', payload);
    expect(await loadGuidedReflectionDraft('2026-09-18', payload.pathId)).toEqual(payload);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.stringContaining('2026-09-18:decision-to-make'), JSON.stringify(payload));
  });
  it('clears only the matching journey draft after canonical save', async () => {
    await clearGuidedReflectionDraft('2026-09-18', payload.pathId);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(expect.stringContaining('2026-09-18:decision-to-make'));
  });
});
