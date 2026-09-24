import React from 'react';
import {StyleSheet, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  getGuidedReflectionPath,
  guidedReflectionStepQuestion,
} from '../../data/guidedReflectionPaths';
import {Colors} from '../../theme/colors';
import type {
  GuidedReflectionPayload,
  GuidedReflectionStepDefinition,
} from '../../types/guidedReflection';
import ThemedText from '../common/ThemedText';
import SavedReflectionBlocks from './SavedReflectionBlocks';

const hasAnswerContent = (
  answer: GuidedReflectionPayload['answers'][number],
) =>
  Boolean(
    answer.selected?.some(value => value.trim()) ||
      answer.text?.trim() ||
      answer.optionalText?.trim() ||
      Object.values(answer.fields || {}).some(value => value.trim()) ||
      answer.notes.length,
  );

const fallbackLabel = (value: string) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

/**
 * Compact question-first preview shared by Moments and Review carousels.
 * The saved reflection remains the full reader; cards intentionally reveal
 * only enough of the walkthrough to preserve its meaning and structure.
 */
export const GuidedReflectionMomentPreview = ({
  journey,
  onDark = false,
  showDisclosureIndicator = false,
}: {
  journey: GuidedReflectionPayload;
  onDark?: boolean;
  showDisclosureIndicator?: boolean;
}) => {
  const path = getGuidedReflectionPath(journey.pathId);
  const answersByStep = new Map(
    journey.answers.map(answer => [answer.stepId, answer]),
  );
  const knownStepIds = new Set(path?.steps.map(step => step.id) || []);
  const orderedAnswers: Array<{
    answer: GuidedReflectionPayload['answers'][number];
    step?: GuidedReflectionStepDefinition;
  }> = [
    ...(path?.steps.flatMap(step => {
      const answer = answersByStep.get(step.id);
      return answer ? [{answer, step}] : [];
    }) || journey.answers.map(answer => ({answer}))),
    ...(path
      ? journey.answers
          .filter(answer => !knownStepIds.has(answer.stepId))
          .map(answer => ({answer}))
      : []),
  ].filter(({answer}) => hasAnswerContent(answer));

  if (!orderedAnswers.length) {
    return null;
  }

  const visibleAnswers = orderedAnswers.slice(0, 2);
  const hiddenQuestionCount = orderedAnswers.length - visibleAnswers.length;

  return (
    <View style={styles.walkthrough}>
      {visibleAnswers.map(({answer, step}, index) => {
        const fieldDefinitions = step?.fields || [];
        const knownFieldIds = new Set(fieldDefinitions.map(field => field.id));
        const fieldResponses = [
          ...fieldDefinitions.flatMap(field => {
            const text = answer.fields?.[field.id]?.trim();
            return text ? [{id: field.id, label: field.label, text}] : [];
          }),
          ...Object.entries(answer.fields || {}).flatMap(([id, value]) => {
            const text = value.trim();
            return text && !knownFieldIds.has(id)
              ? [{id, label: fallbackLabel(id), text}]
              : [];
          }),
        ];
        const writtenResponses: Array<{
          id: string;
          label?: string;
          text: string;
        }> = [
          ...(answer.text?.trim()
            ? [{id: 'text', text: answer.text.trim()}]
            : []),
          ...(answer.optionalText?.trim()
            ? [
                {
                  id: 'optional',
                  label: step?.optionalWrite?.label,
                  text: answer.optionalText.trim(),
                },
              ]
            : []),
          ...fieldResponses,
        ];
        const visibleSelections = (answer.selected || []).slice(0, 5);
        const hiddenSelectionCount =
          (answer.selected?.length || 0) - visibleSelections.length;
        const visibleResponses = writtenResponses.slice(0, 2);
        const hiddenResponseCount =
          writtenResponses.length - visibleResponses.length;
        const topLevelNotes = answer.notes.filter(note => !note.parentColumnId);
        const firstVisibleNote = topLevelNotes[0] || answer.notes[0];
        const visibleNotes = firstVisibleNote
          ? answer.notes.filter(
              note =>
                note.id === firstVisibleNote.id ||
                note.parentColumnId === firstVisibleNote.id,
            )
          : [];
        const hiddenNoteCount = Math.max(0, topLevelNotes.length - 1);
        const question = step
          ? guidedReflectionStepQuestion(step)
          : fallbackLabel(answer.stepId);

        return (
          <View
            key={answer.stepId}
            style={[
              styles.step,
              index > 0 && styles.separatedStep,
              index > 0 && onDark && styles.separatedStepOnDark,
            ]}>
            <ThemedText
              weight="semiBold"
              numberOfLines={3}
              ellipsizeMode="tail"
              style={[styles.question, onDark && styles.questionOnDark]}>
              {question}
            </ThemedText>
            {!!step?.scripture?.reference && (
              <ThemedText
                weight="medium"
                style={[
                  styles.scriptureReference,
                  onDark && styles.scriptureReferenceOnDark,
                ]}>
                {step.scripture.reference}
              </ThemedText>
            )}

            {!!visibleSelections.length && (
              <View style={styles.selections}>
                {visibleSelections.map(selection => (
                  <View
                    key={`${answer.stepId}-${selection}`}
                    style={[styles.pill, onDark && styles.pillOnDark]}>
                    <ThemedText
                      style={[
                        styles.selectionText,
                        onDark && styles.selectionTextOnDark,
                      ]}>
                      {selection}
                    </ThemedText>
                  </View>
                ))}
                {hiddenSelectionCount > 0 && (
                  <View style={[styles.pill, onDark && styles.pillOnDark]}>
                    <ThemedText
                      style={[
                        styles.selectionText,
                        onDark && styles.selectionTextOnDark,
                      ]}>
                      +{hiddenSelectionCount} more
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {!!visibleResponses.length && (
              <View style={styles.responses}>
                {visibleResponses.map(response => (
                  <View
                    key={`${answer.stepId}-${response.id}`}
                    style={[
                      styles.response,
                      onDark && styles.responseOnDark,
                    ]}>
                    {!!response.label && (
                      <ThemedText
                        weight="semiBold"
                        style={[
                          styles.responseLabel,
                          onDark && styles.responseLabelOnDark,
                        ]}>
                        {response.label}
                      </ThemedText>
                    )}
                    <ThemedText
                      numberOfLines={3}
                      ellipsizeMode="tail"
                      style={[
                        styles.responseText,
                        onDark && styles.responseTextOnDark,
                      ]}>
                      {response.text}
                    </ThemedText>
                  </View>
                ))}
                {hiddenResponseCount > 0 && (
                  <ThemedText
                    weight="medium"
                    style={[styles.moreInline, onDark && styles.moreOnDark]}>
                    {hiddenResponseCount} more{' '}
                    {hiddenResponseCount === 1 ? 'response' : 'responses'}
                  </ThemedText>
                )}
              </View>
            )}

            {!!visibleNotes.length && (
              <View style={styles.notes}>
                <SavedReflectionBlocks
                  blocks={visibleNotes}
                  onDark={onDark}
                  compact
                  embedded
                />
                {hiddenNoteCount > 0 && (
                  <ThemedText
                    weight="medium"
                    style={[
                      styles.moreInline,
                      styles.moreNotes,
                      onDark && styles.moreOnDark,
                    ]}>
                    {hiddenNoteCount} more{' '}
                    {hiddenNoteCount === 1 ? 'note' : 'notes'}
                  </ThemedText>
                )}
              </View>
            )}
          </View>
        );
      })}
      {hiddenQuestionCount > 0 && (
        <View style={styles.moreQuestions}>
          <ThemedText
            weight="medium"
            style={[styles.moreQuestionsText, onDark && styles.moreOnDark]}>
            {hiddenQuestionCount} more{' '}
            {hiddenQuestionCount === 1 ? 'question' : 'questions'}
          </ThemedText>
          {showDisclosureIndicator && (
            <Ionicons
              name="chevron-forward"
              size={13}
              color={onDark ? Colors.hopeWhite : Colors.sage}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  walkthrough: {marginTop: 2},
  step: {paddingTop: 2},
  separatedStep: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  separatedStepOnDark: {borderTopColor: 'rgba(255,255,255,0.18)'},
  question: {color: Colors.text, fontSize: 14, lineHeight: 20},
  questionOnDark: {color: Colors.hopeWhite},
  scriptureReference: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  scriptureReferenceOnDark: {color: 'rgba(255,255,255,0.68)'},
  selections: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11},
  pill: {
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(82,106,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,106,91,0.2)',
  },
  pillOnDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectionText: {color: Colors.sage, fontSize: 12, lineHeight: 16},
  selectionTextOnDark: {color: Colors.hopeWhite},
  responses: {gap: 10, marginTop: 12},
  response: {
    paddingLeft: 13,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
  },
  responseOnDark: {borderLeftColor: 'rgba(255,255,255,0.22)'},
  responseLabel: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  responseLabelOnDark: {color: 'rgba(255,255,255,0.68)'},
  responseText: {color: Colors.text, fontSize: 13, lineHeight: 20},
  responseTextOnDark: {color: Colors.hopeWhite},
  notes: {marginTop: 13},
  moreInline: {
    alignSelf: 'flex-end',
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
  },
  moreOnDark: {color: 'rgba(255,255,255,0.72)'},
  moreNotes: {marginTop: 5},
  moreQuestions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 18,
  },
  moreQuestionsText: {color: Colors.textGray, fontSize: 11, lineHeight: 15},
});
