import type { GuidedReflectionPath } from '../types/guidedReflection';

export const GUIDED_REFLECTION_PATHS: readonly GuidedReflectionPath[] = [
  {
    id: 'mind-feels-full', title: 'My mind feels full', description: 'Sort through what is taking up space, one piece at a time.',
    steps: [
      { id: 'space', eyebrow: "WHAT'S TAKING UP SPACE?", prompt: 'Tap everything that is on your mind.', interactionType: 'multi_select', options: ['Work', 'School', 'Deadlines', 'Money', 'Family', 'Relationship', 'Health', 'A decision', 'The future', 'Church / ministry', 'Something else'], optionalWrite: { label: 'Write about this', prompt: 'What else is taking up space?' }, allowNotes: true },
      { id: 'heaviest', eyebrow: 'WHICH FEELS HEAVIEST?', prompt: 'Choose the one that most needs your attention right now.', interactionType: 'single_select', options: ['Work', 'Money', 'Family', 'Relationship', 'Health', 'A decision', 'The future', 'Church / ministry', 'Something else'], optionalWrite: { label: 'Write about this', prompt: 'What about this feels heavy?' }, allowNotes: true },
      { id: 'attention', eyebrow: 'LOOK CLOSER', prompt: 'What needs your attention here?', interactionType: 'write', required: true, allowNotes: true },
      { id: 'discern', eyebrow: 'DISCERN', prompt: 'What is yours to carry, and what can you leave with God?', interactionType: 'paired_write', fields: [{ id: 'mine', label: 'MINE TO CARRY' }, { id: 'entrust', label: 'ENTRUST TO GOD' }], allowNotes: true },
      { id: 'need', eyebrow: 'BRING IT TO GOD', prompt: 'As you bring this to God, what are you asking Him for?', interactionType: 'multi_select', options: ['Wisdom', 'Peace', 'Courage', 'Patience', 'Trust', 'Strength', 'Something else'], optionalWrite: { label: 'Write a prayer', prompt: 'Bring what you need before God.' }, allowNotes: true },
      { id: 'scripture', eyebrow: 'RETURN TO SCRIPTURE', prompt: 'Read slowly, then notice what stands out.', interactionType: 'scripture_reflection', scripture: { reference: 'Matthew 6:31–34', question: 'What does this passage remind you is true when your mind is consumed with tomorrow?' }, allowNotes: true },
      { id: 'faithful-step', eyebrow: 'ONE FAITHFUL STEP', prompt: 'Respond with what is yours today.', interactionType: 'paired_write', fields: [{ id: 'do_today', label: 'WHAT CAN YOU FAITHFULLY DO TODAY?' }, { id: 'leave_with_god', label: 'WHAT CAN YOU LEAVE WITH GOD?' }], required: true },
    ],
  },
  {
    id: 'something-bothering-me', title: 'Something is bothering me', description: 'Name what happened and make room to respond with truth and love.',
    steps: [
      { id: 'name-it', eyebrow: 'NAME IT', prompt: 'What happened?', interactionType: 'write', required: true, allowNotes: true },
      { id: 'look-clearly', eyebrow: 'LOOK CLEARLY', prompt: 'Separate what you know from what you may be assuming.', interactionType: 'paired_write', fields: [{ id: 'facts', label: 'WHAT I KNOW' }, { id: 'assumptions', label: 'WHAT I MAY BE ASSUMING' }], allowNotes: true },
      { id: 'stir', eyebrow: 'WHAT DID IT STIR?', prompt: 'Tap what you noticed in your heart.', interactionType: 'multi_select', options: ['Hurt', 'Anger', 'Fear', 'Disappointment', 'Embarrassment', 'Jealousy', 'Confusion', 'Something else'], optionalWrite: { label: 'Write about this', prompt: "What's underneath that feeling?" }, allowNotes: true },
      { id: 'pull', eyebrow: 'NOTICE THE PULL', prompt: 'What do you feel pulled to do?', interactionType: 'multi_select', options: ['Withdraw', 'Defend myself', 'Confront', 'People-please', 'Fix it immediately', 'Avoid it', 'Get even', 'Something else'], optionalWrite: { label: 'Write about this', prompt: 'What is driving that pull?' }, allowNotes: true },
      { id: 'before-respond', eyebrow: 'BEFORE YOU RESPOND', prompt: 'Bring your heart before God. What do you want to say honestly?', interactionType: 'write', allowNotes: true },
      { id: 'scripture', eyebrow: 'RETURN TO SCRIPTURE', prompt: 'Receive the passage before deciding what to do.', interactionType: 'scripture_reflection', scripture: { reference: 'James 1:19–20', question: 'What does this passage invite you to remember before you respond?' }, allowNotes: true },
      { id: 'needed', eyebrow: 'DISCERN WHAT MAY BE NEEDED', prompt: 'These are possibilities for reflection, not instructions. What may be worth considering?', interactionType: 'multi_select', options: ['Forgive', 'Apologize', 'Clarify', 'Speak truth', 'Set a boundary', 'Wait', 'Seek counsel', 'Entrust it'], allowNotes: true },
      { id: 'respond', eyebrow: 'RESPOND FAITHFULLY', prompt: 'What would a truthful and loving next step look like?', interactionType: 'write', required: true },
    ],
  },
  {
    id: 'decision-to-make', title: 'I have a decision to make', description: 'Clarify what matters without asking the journal to decide for you.',
    steps: [
      { id: 'name-decision', eyebrow: 'NAME THE DECISION', prompt: 'What decision are you facing?', interactionType: 'write', required: true, allowNotes: true },
      { id: 'matters', eyebrow: 'WHAT MATTERS HERE?', prompt: 'Tap everything you want to hold in view.', interactionType: 'multi_select', options: ['Biblical faithfulness', 'People affected', 'Responsibility', 'Timing', 'Finances', 'Wise counsel', 'Long-term consequences', 'Something else'], allowNotes: true },
      { id: 'options', eyebrow: 'OPTIONS', prompt: 'Capture two possibilities without scoring or choosing a winner.', interactionType: 'options', fields: [{ id: 'option_a_name', label: 'OPTION A — NAME' }, { id: 'option_a_draw', label: 'WHAT DRAWS ME TOWARD IT' }, { id: 'option_a_concern', label: 'WHAT CONCERNS ME' }, { id: 'option_b_name', label: 'OPTION B — NAME' }, { id: 'option_b_draw', label: 'WHAT DRAWS ME TOWARD IT' }, { id: 'option_b_concern', label: 'WHAT CONCERNS ME' }], allowNotes: true },
      { id: 'influences', eyebrow: "WHAT'S INFLUENCING ME?", prompt: 'Notice what may be shaping your thinking.', interactionType: 'multi_select', options: ['Faith', 'Fear', 'Pressure', 'Comfort', 'Approval', 'Opportunity', 'Responsibility', 'Something else'], optionalWrite: { label: 'Write about this', prompt: 'How is this influencing you?' }, allowNotes: true },
      { id: 'sought-wisdom', eyebrow: 'HOW HAVE I SOUGHT GOD AND WISDOM?', prompt: 'Select what you have already made room for.', interactionType: 'multi_select', options: ['Prayer', 'Scripture', 'Wise counsel', 'Waiting', 'Gathering facts', 'A needed conversation', "I haven't yet"], allowNotes: true },
      { id: 'scripture', eyebrow: 'RETURN TO SCRIPTURE', prompt: 'Pause with this invitation to seek wisdom.', interactionType: 'scripture_reflection', scripture: { reference: 'James 1:5', question: 'What does this passage remind you to seek as you make this decision?' }, allowNotes: true },
      { id: 'still-need', eyebrow: 'WHAT DO I STILL NEED?', prompt: 'What would help you take the next honest step?', interactionType: 'single_select', options: ['More information', 'Counsel', 'Time', 'A conversation', 'Prayer', 'Nothing else right now', 'Something else'], allowNotes: true },
      { id: 'next-step', eyebrow: 'NEXT FAITHFUL STEP', prompt: 'What is the next faithful step you can take without needing to know the whole outcome?', interactionType: 'write', required: true },
    ],
  },
] as const;

export const getGuidedReflectionPath = (id: string) => GUIDED_REFLECTION_PATHS.find(path => path.id === id) ?? null;

const questionSentence = (value?: string): string | null => {
  const trimmed = value?.trim();
  if (!trimmed?.includes('?')) {
    return null;
  }
  const questionEnd = trimmed.indexOf('?') + 1;
  const throughQuestion = trimmed.slice(0, questionEnd);
  const sentenceStart = Math.max(
    throughQuestion.lastIndexOf('. '),
    throughQuestion.lastIndexOf('! '),
  );
  return throughQuestion.slice(sentenceStart < 0 ? 0 : sentenceStart + 2).trim();
};

/** Saved previews show the question itself, never the walkthrough instruction. */
export const guidedReflectionStepQuestion = (
  step: GuidedReflectionPath['steps'][number],
): string =>
  questionSentence(step.scripture?.question) ||
  questionSentence(step.prompt) ||
  questionSentence(step.eyebrow) ||
  step.fields
    ?.map(field => questionSentence(field.label))
    .find((value): value is string => Boolean(value)) ||
  step.eyebrow;
