import {
  GUIDED_REFLECTION_FORMAT,
  guidedReflectionAnswerPreview,
  type GuidedReflectionPayload,
} from '../guidedReflection';

describe('Guided Reflection Moments presentation', () => {
  it('keeps written answers in the preview without duplicating separately rendered note blocks', () => {
    const journey: GuidedReflectionPayload = {
      format: GUIDED_REFLECTION_FORMAT,
      pathId: 'mind-feels-full',
      pathTitle: 'My mind feels full',
      currentStepId: 'faithful-step',
      completed: true,
      answers: [
        {
          stepId: 'space',
          selected: ['Work'],
          optionalText: 'The deadline is taking up most of my attention.',
          notes: [{id: 'note-1', kind: 'key', text: 'Clarity over urgency.'}],
        },
        {
          stepId: 'faithful-step',
          fields: {
            do_today: 'Ask for a realistic timeline.',
            leave_with_god: 'The response I cannot control.',
          },
          notes: [],
        },
      ],
    };

    expect(guidedReflectionAnswerPreview(JSON.stringify(journey))).toBe(
      'The deadline is taking up most of my attention. · Ask for a realistic timeline. · The response I cannot control.',
    );
    expect(guidedReflectionAnswerPreview(JSON.stringify(journey))).not.toContain(
      'Clarity over urgency.',
    );
  });

  it('preserves legacy plain-text guided reflections', () => {
    expect(guidedReflectionAnswerPreview('  A legacy reflection.  ')).toBe(
      'A legacy reflection.',
    );
  });
});
