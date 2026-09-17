import { GUIDED_REFLECTION_PATHS } from '../guidedReflectionPaths';
import { GUIDED_PROMPTS } from '../../components/journal/reflectionConstants';
import { GUIDED_QUESTION_LIBRARY, GUIDED_QUESTION_TOPICS, questionsForTopic } from '../guidedReflectionQuestions';
import { GUIDED_NOTE_TYPES, GUIDED_REFLECTION_FORMAT, emptyGuidedAnswer, parseGuidedReflection, serializeGuidedReflection, type GuidedReflectionPayload } from '../../types/guidedReflection';
import fs from 'fs';
import pathModule from 'path';
import { GENERIC_JOURNAL_BLOCK_KINDS } from '../../components/journal/shared/journalBlocks';

const path = (id: string) => GUIDED_REFLECTION_PATHS.find(item => item.id === id)!;

describe('Guided Reflection V1 authored engine', () => {
  it('is deterministic, local, and has stable unique path and step IDs', () => {
    expect(GUIDED_REFLECTION_PATHS.map(item => item.id)).toEqual(['mind-feels-full', 'something-bothering-me', 'decision-to-make']);
    expect(new Set(GUIDED_REFLECTION_PATHS.flatMap(item => item.steps.map(step => `${item.id}:${step.id}`))).size).toBe(GUIDED_REFLECTION_PATHS.reduce((sum, item) => sum + item.steps.length, 0));
  });

  it('uses genuinely distinct authored sequences', () => {
    expect(path('mind-feels-full').steps.map(step => step.id)).toEqual(['space', 'heaviest', 'attention', 'discern', 'need', 'scripture', 'faithful-step']);
    expect(path('something-bothering-me').steps.map(step => step.id)).toEqual(['name-it', 'look-clearly', 'stir', 'pull', 'before-respond', 'scripture', 'needed', 'respond']);
    expect(path('decision-to-make').steps.map(step => step.id)).toEqual(['name-decision', 'matters', 'options', 'influences', 'sought-wisdom', 'scripture', 'still-need', 'next-step']);
  });

  it('covers supported interaction serialization including selections, writing, scripture, fields, and ordered notes', () => {
    const payload: GuidedReflectionPayload = {
      format: GUIDED_REFLECTION_FORMAT, pathId: 'mind-feels-full', pathTitle: 'My mind feels full', currentStepId: 'scripture', completed: false,
      answers: [
        { ...emptyGuidedAnswer('space'), selected: ['Work', 'Money'], optionalText: 'Both feel urgent.' },
        { stepId: 'discern', fields: { mine: 'Send the invoice', entrust: 'The outcome' }, notes: [
          { id: 'note-1', kind: 'key', text: 'Do what is mine.' },
          { id: 'note-2', kind: 'scripture', text: 'Return here.', reference: 'Matthew 6:31–34' },
        ] },
        { stepId: 'scripture', text: 'Tomorrow belongs to God.', notes: [] },
      ],
    };
    expect(parseGuidedReflection(serializeGuidedReflection(payload))).toEqual(payload);
    expect(parseGuidedReflection('legacy plain response')).toBeNull();
  });

  it('contains the authored content required by each path', () => {
    expect(path('mind-feels-full').steps.find(step => step.id === 'scripture')?.scripture?.reference).toBe('Matthew 6:31–34');
    expect(path('something-bothering-me').steps.find(step => step.id === 'stir')?.options).toContain('Disappointment');
    expect(path('something-bothering-me').steps.find(step => step.id === 'needed')?.options).toContain('Set a boundary');
    expect(path('decision-to-make').steps.find(step => step.id === 'options')?.fields).toHaveLength(6);
    expect(path('decision-to-make').steps.find(step => step.id === 'sought-wisdom')?.options).toContain('Wise counsel');
    expect(path('decision-to-make').steps.find(step => step.id === 'scripture')?.scripture?.reference).toBe('James 1:5');
  });

  it('exposes only the approved generic Sermon-compatible note kinds', () => {
    expect(GUIDED_NOTE_TYPES.map(item => item.kind)).toEqual(['text', 'scripture', 'quote', 'key', 'remember', 'question', 'response']);
    expect(GUIDED_NOTE_TYPES.map(item => item.kind)).not.toEqual(expect.arrayContaining(['song', 'outline', 'character', 'language', 'history', 'book', 'prayer']));
    const sermonSource = fs.readFileSync(pathModule.resolve(__dirname, '../../screens/SermonNotesScreen.tsx'), 'utf8');
    expect(sermonSource).toContain("format: 'sermon_notes_v1'");
    expect(GENERIC_JOURNAL_BLOCK_KINDS).toEqual(GUIDED_NOTE_TYPES.map(item => item.kind));
  });

  it('retains every legacy prompt and filters vertical questions by horizontal topic', () => {
    expect(GUIDED_QUESTION_TOPICS).toEqual(['With God', 'My Heart', 'Relationships', 'Decisions', 'Growth', 'Work & Gifts']);
    expect(GUIDED_QUESTION_LIBRARY.map(item => item.prompt)).toEqual(GUIDED_PROMPTS);
    GUIDED_QUESTION_TOPICS.forEach(topic => expect(questionsForTopic(topic).every(item => item.topic === topic)).toBe(true));
  });
});
