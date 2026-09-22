import { GUIDED_REFLECTION_PATHS } from '../guidedReflectionPaths';
import { GUIDED_PROMPTS } from '../../components/journal/reflectionConstants';
import { GUIDED_QUESTION_LIBRARY, GUIDED_QUESTION_TOPICS, guidedQuestionTopicForPrompt, questionsForTopic } from '../guidedReflectionQuestions';
import { GUIDED_NOTE_TYPES, GUIDED_REFLECTION_FORMAT, emptyGuidedAnswer, guidedEntryKind, guidedEntrySource, parseGuidedReflection, serializeGuidedReflection, type GuidedReflectionPayload } from '../../types/guidedReflection';
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
      format: GUIDED_REFLECTION_FORMAT, pathId: 'mind-feels-full', pathTitle: 'My mind feels full', entryTitle: 'What I need to release before Friday', currentStepId: 'scripture', completed: false,
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
    expect(parseGuidedReflection(serializeGuidedReflection(payload))?.pathTitle).toBe('My mind feels full');
    expect(parseGuidedReflection(serializeGuidedReflection(payload))?.entryTitle).toBe('What I need to release before Friday');
    expect(parseGuidedReflection('legacy plain response')).toBeNull();
  });

  it('keeps Guided Prompts distinct from structured Guided Reflections', () => {
    const journey: GuidedReflectionPayload = {
      format: GUIDED_REFLECTION_FORMAT,
      pathId: 'mind-feels-full',
      pathTitle: 'My mind feels full',
      currentStepId: 'space',
      completed: false,
      answers: [{...emptyGuidedAnswer('space'), selected: ['Work']}],
    };

    expect(guidedEntryKind({type: 'guided', source: 'guided_prompt', content: 'A response'})).toBe('prompt');
    expect(guidedEntryKind({type: 'guided', content: 'A legacy prompt response'})).toBe('prompt');
    expect(guidedEntryKind({type: 'guided', source: 'guided', content: 'A chosen-question response'})).toBe('reflection');
    expect(guidedEntryKind({type: 'guided', source: 'guided', prompt: 'Where do you need peace?', content: 'A chosen-question response'})).toBe('prompt');
    expect(guidedEntryKind({type: 'guided', source: 'guided', question_topic: 'With God', content: 'A chosen-question response'})).toBe('prompt');
    expect(guidedEntryKind({type: 'guided', content: serializeGuidedReflection(journey)})).toBe('reflection');
    expect(guidedEntrySource({type: 'guided', source: 'guided_prompt'})).toBe('guided_prompt');
    expect(guidedEntrySource({type: 'guided', source: 'guided'})).toBe('guided');
    expect(guidedEntrySource({type: 'guided', source: 'guided', prompt: 'What feels heavy?'})).toBe('guided_prompt');
  });

  it('contains the authored content required by each path', () => {
    expect(path('mind-feels-full').steps.find(step => step.id === 'space')?.options).toEqual(expect.arrayContaining(['School', 'Deadlines']));
    expect(path('mind-feels-full').steps.find(step => step.id === 'attention')?.prompt).toBe('What needs your attention here?');
    expect(path('mind-feels-full').steps.find(step => step.id === 'discern')?.prompt).toBe('What is yours to carry, and what can you leave with God?');
    expect(path('mind-feels-full').steps.find(step => step.id === 'need')).toMatchObject({
      prompt: 'As you bring this to God, what are you asking Him for?',
      options: expect.arrayContaining(['Something else']),
    });
    expect(path('mind-feels-full').steps.find(step => step.id === 'scripture')?.scripture?.reference).toBe('Matthew 6:31–34');
    expect(path('something-bothering-me').steps.find(step => step.id === 'stir')?.options).toContain('Disappointment');
    expect(path('something-bothering-me').steps.find(step => step.id === 'needed')?.options).toContain('Set a boundary');
    expect(path('decision-to-make').steps.find(step => step.id === 'options')?.fields).toHaveLength(6);
    expect(path('decision-to-make').steps.find(step => step.id === 'sought-wisdom')?.options).toContain('Wise counsel');
    expect(path('decision-to-make').steps.find(step => step.id === 'scripture')?.scripture?.reference).toBe('James 1:5');
  });

  it('exposes only the approved generic Sermon-compatible note kinds', () => {
    expect(GUIDED_NOTE_TYPES.map(item => item.kind)).toEqual(['scripture', 'quote', 'key', 'remember', 'question', 'response']);
    expect(GUIDED_NOTE_TYPES.map(item => item.kind)).not.toEqual(expect.arrayContaining(['song', 'outline', 'character', 'language', 'history', 'book', 'prayer']));
    const sermonSource = fs.readFileSync(pathModule.resolve(__dirname, '../../screens/SermonNotesScreen.tsx'), 'utf8');
    expect(sermonSource).toContain("format: 'sermon_notes_v1'");
    expect(GENERIC_JOURNAL_BLOCK_KINDS.filter(kind => kind !== 'text')).toEqual(
      GUIDED_NOTE_TYPES.map(item => item.kind),
    );
  });

  it('retains every legacy prompt and filters vertical questions by horizontal topic', () => {
    expect(GUIDED_QUESTION_TOPICS).toEqual([
      'With God', 'My Heart', 'Relationships', 'Decisions', 'Growth', 'Work & Gifts',
      'Finances', 'Business', 'Home', 'Family', 'Health', 'Rest & Rhythms',
    ]);
    expect(GUIDED_QUESTION_LIBRARY.map(item => item.prompt)).toEqual(GUIDED_PROMPTS);
    GUIDED_QUESTION_TOPICS.forEach(topic => {
      expect(questionsForTopic(topic).length).toBeGreaterThanOrEqual(5);
      expect(questionsForTopic(topic).every(item => item.topic === topic)).toBe(true);
    });
    expect(guidedQuestionTopicForPrompt('Where have I noticed God at work in my life lately?')).toBe('With God');
    expect(guidedQuestionTopicForPrompt('  what would meaningful rest look like for me this week? ')).toBe('Rest & Rhythms');
    expect(guidedQuestionTopicForPrompt('A question that is not curated')).toBeNull();
  });
});
