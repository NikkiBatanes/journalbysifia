import {
  createGuidedNoteId,
  type GuidedReflectionPayload,
  type GuidedReflectionStepDefinition,
  type GuidedStepAnswer,
} from '../types/guidedReflection';

/**
 * Older guided journeys stored writing in `text` and `fields`, while the
 * current editor works with movable note blocks. Promote those values only
 * when a saved journey is opened for editing so its readable view remains
 * untouched and no response is duplicated.
 */
export const prepareGuidedReflectionForBlockEditing = (
  payload: GuidedReflectionPayload,
  steps: readonly GuidedReflectionStepDefinition[],
): GuidedReflectionPayload => {
  const stepsById = new Map(steps.map(step => [step.id, step]));
  let changed = false;

  const answers = payload.answers.map((answer): GuidedStepAnswer => {
    const text = answer.text?.trim();
    const fieldEntries = Object.entries(answer.fields || {}).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].trim().length > 0,
    );

    if (!text && fieldEntries.length === 0) {
      return answer;
    }

    changed = true;
    const step = stepsById.get(answer.stepId);
    const fieldOrder = new Map(
      (step?.fields || []).map((field, index) => [field.id, index]),
    );
    const orderedFields = [...fieldEntries].sort(
      ([leftId], [rightId]) =>
        (fieldOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (fieldOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER),
    );
    const promotedNotes = [
      ...(text
        ? [
            {
              id: createGuidedNoteId(),
              kind: 'text' as const,
              text,
            },
          ]
        : []),
      ...orderedFields.map(([fieldId, value]) => ({
        id: createGuidedNoteId(),
        kind: 'reflection_question' as const,
        text:
          step?.fields?.find(field => field.id === fieldId)?.label || fieldId,
        note: value.trim(),
      })),
    ];

    return {
      ...answer,
      text: undefined,
      fields: undefined,
      notes: [...promotedNotes, ...answer.notes],
    };
  });

  return changed ? {...payload, answers} : payload;
};
