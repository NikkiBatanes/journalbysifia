import { normalizeTruthScreenEnhancement } from '../../../supabase/functions/_shared/truthScreenEnhancement';

describe('Truth in Love optional elements', () => {
  it('accepts the four supported content shapes', () => {
    const elements = [
      { kind: 'takeaway', text: 'You can listen without promising an answer.', items: [] },
      { kind: 'explanation', text: 'Hearing a request gives you information before you decide.', items: [] },
      { kind: 'flow', text: '', items: ['Hear the request', 'Clarify what is needed', 'Decide responsibly'] },
      { kind: 'comparison', text: '', items: ['Listening gives someone a hearing.', 'Committing gives them an answer.'] },
    ];
    elements.forEach(element => expect(normalizeTruthScreenEnhancement(element)).toEqual(element));
  });

  it('leaves old playbooks and absent optional elements unchanged', () => {
    [undefined, null, '', {}, { kind: 'unknown', text: 'Example', items: [] }].forEach(value => {
      expect(normalizeTruthScreenEnhancement(value)).toBeUndefined();
    });
  });

  it('rejects incomplete diagrams and mixed content shapes', () => {
    [
      { kind: 'comparison', text: '', items: ['Only one side'] },
      { kind: 'flow', text: '', items: ['First', 42] },
      { kind: 'flow', text: '', items: Array(5).fill('Step') },
      { kind: 'takeaway', text: 'A thought', items: ['Unrelated extra'] },
      { kind: 'explanation', text: ' ', items: [] },
      { kind: 'flow', text: 'Unexpected text', items: ['First', 'Second'] },
    ].forEach(value => expect(normalizeTruthScreenEnhancement(value)).toBeUndefined());
  });

  it('rejects oversized content rather than truncating its meaning', () => {
    expect(normalizeTruthScreenEnhancement({ kind: 'takeaway', text: 'a'.repeat(241), items: [] })).toBeUndefined();
    expect(normalizeTruthScreenEnhancement({ kind: 'explanation', text: 'a'.repeat(701), items: [] })).toBeUndefined();
    expect(normalizeTruthScreenEnhancement({ kind: 'flow', text: '', items: ['a'.repeat(181), 'Next'] })).toBeUndefined();
  });
});
