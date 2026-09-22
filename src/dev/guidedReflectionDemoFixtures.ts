import {Image} from 'react-native';
import type {LocalReflectionEntry} from '../storage/reflectionStorage';
import {
  GUIDED_REFLECTION_FORMAT,
  serializeGuidedReflection,
  type GuidedReflectionNote,
  type GuidedReflectionPayload,
} from '../types/guidedReflection';

export const GUIDED_REFLECTION_DEMO_PREFIX = 'dev-guided-reflection-v1:';
export const GUIDED_REFLECTION_DEMO_WEEK = {
  start: '2026-09-14',
  end: '2026-09-20',
} as const;

export const guidedReflectionDemoReferenceDate = (): Date =>
  new Date(2026, 8, 20, 12, 0, 0, 0);

const DEMO_PHOTO_URI = Image.resolveAssetSource(
  require('../../assets/images/share/sifiashare_19.png'),
)?.uri || 'guided-reflection-demo://quiet-path';

export type GuidedReflectionDemoScenario =
  | 'full'
  | 'mind'
  | 'conflict'
  | 'decision'
  | 'draft';

export interface GuidedReflectionDemoFixture extends LocalReflectionEntry {
  demoLabel: string;
  metadata: {
    prompt: string;
    guidedJourney: GuidedReflectionPayload;
    journalBlocks: GuidedReflectionNote[];
    demoScenario: Exclude<GuidedReflectionDemoScenario, 'full'>;
  };
}

const localDate = (referenceDate: Date, daysAgo: number): string => {
  const date = new Date(referenceDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const timestamp = (referenceDate: Date, daysAgo: number, hour: number, minute: number): string => {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const note = (
  id: string,
  kind: GuidedReflectionNote['kind'],
  text: string,
  extra: Partial<GuidedReflectionNote> = {},
): GuidedReflectionNote => ({id: `${GUIDED_REFLECTION_DEMO_PREFIX}${id}`, kind, text, ...extra});

const createFixture = ({
  suffix,
  demoLabel,
  scenario,
  journey,
  referenceDate,
  daysAgo,
  hour,
  minute,
}: {
  suffix: string;
  demoLabel: string;
  scenario: Exclude<GuidedReflectionDemoScenario, 'full'>;
  journey: GuidedReflectionPayload;
  referenceDate: Date;
  daysAgo: number;
  hour: number;
  minute: number;
}): GuidedReflectionDemoFixture => {
  const createdAt = timestamp(referenceDate, daysAgo, hour, minute);
  const journalBlocks = journey.answers.flatMap(answer => answer.notes);
  return {
    id: `${GUIDED_REFLECTION_DEMO_PREFIX}${suffix}`,
    server_id: null,
    linked_account_id: null,
    title: journey.pathTitle,
    content: serializeGuidedReflection(journey),
    type: 'guided',
    source: 'guided',
    tags: [],
    selected_date: localDate(referenceDate, daysAgo),
    created_at: createdAt,
    updated_at: createdAt,
    deleted: false,
    sync_status: 'local',
    version: 1,
    demoLabel,
    metadata: {
      prompt: journey.pathTitle,
      guidedJourney: journey,
      journalBlocks,
      demoScenario: scenario,
    },
  };
};

export const buildGuidedReflectionDemoFixtures = (
  referenceDate = guidedReflectionDemoReferenceDate(),
): GuidedReflectionDemoFixture[] => {
  const mind: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'mind-feels-full',
    pathTitle: 'My mind feels full',
    currentStepId: 'faithful-step',
    completed: true,
    answers: [
      {
        stepId: 'space',
        selected: ['Work', 'Money', 'The future'],
        optionalText: 'The proposal is due Friday, and I keep treating every unanswered email like an emergency.',
        notes: [
          note('mind-section', 'section', 'What is actually taking up space'),
          note('mind-bullets', 'bullets', 'What keeps looping in my head', {
            points: ['Finishing the client proposal well', 'Whether the delayed invoice will clear this week', 'How this busy month is affecting time with my family'],
          }),
        ],
      },
      {
        stepId: 'heaviest',
        selected: ['Work'],
        optionalText: 'I am afraid that asking for more time will make me look unreliable, even though the scope changed twice.',
        notes: [
          note('mind-question', 'question', 'Am I responding to the real deadline, or to my fear of disappointing people?'),
        ],
      },
      {
        stepId: 'attention',
        text: 'I need to clarify what can realistically be delivered by Friday instead of silently trying to absorb the extra work.',
        notes: [
          note('mind-key', 'key', 'Clarity is more faithful than quiet resentment.'),
          note('mind-photo', 'photo', 'The empty bench where I finally slowed down after lunch.', {
            uri: DEMO_PHOTO_URI,
          }),
        ],
      },
      {
        stepId: 'discern',
        fields: {
          mine: 'Send a revised scope and timeline, finish the two sections only I can write, and ask Maya to review the numbers.',
          entrust: 'How the client reacts, when the invoice lands, and whether everyone approves of the boundary.',
        },
        notes: [
          note('mind-column', 'column', ''),
          note('mind-column-left', 'key', 'Mine to carry', {
            parentColumnId: `${GUIDED_REFLECTION_DEMO_PREFIX}mind-column`,
            columnSide: 'left',
          }),
          note('mind-column-left-action', 'action', 'Send the revised scope before 10:00 AM.', {
            completed: true,
            parentColumnId: `${GUIDED_REFLECTION_DEMO_PREFIX}mind-column`,
            columnSide: 'left',
          }),
          note('mind-column-right', 'remember', 'God is responsible for the outcome; I am responsible for honesty.', {
            parentColumnId: `${GUIDED_REFLECTION_DEMO_PREFIX}mind-column`,
            columnSide: 'right',
          }),
        ],
      },
      {
        stepId: 'need',
        selected: ['Wisdom', 'Peace', 'Courage'],
        optionalText: 'God, steady me enough to be clear and kind. Help me do today’s work without trying to control tomorrow.',
        notes: [
          note('mind-voice', 'voice', 'A short prayer recorded during my walk. The original recording is intentionally unavailable in this portable demo.', {durationMillis: 43000}),
        ],
      },
      {
        stepId: 'scripture',
        text: 'Jesus does not deny that today has trouble; he releases me from borrowing tomorrow’s trouble too.',
        notes: [
          note('mind-scripture', 'scripture', '', {
            scriptureReference: 'Matthew 6:34',
            scriptureText: 'Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.',
            scriptureVersion: 'NIV',
          }),
          note('mind-quote', 'quote', 'Grace for today does not require certainty about tomorrow.', {secondary: 'Morning reflection'}),
        ],
      },
      {
        stepId: 'faithful-step',
        fields: {
          do_today: 'Send the scope note, complete the opening section, and stop work at 6:00 PM for dinner with my family.',
          leave_with_god: 'The client’s response and the pressure to prove that I can carry everything.',
        },
        notes: [
          note('mind-action', 'action', 'Send the scope and timeline to the client.', {completed: false}),
          note('mind-remember', 'remember', 'One clear, faithful step is enough for today.'),
          note('mind-response', 'response', 'Work from peace, tell the truth early, and let tonight be tonight.'),
        ],
      },
    ],
  };

  const conflict: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'something-bothering-me',
    pathTitle: 'Something is bothering me',
    currentStepId: 'respond',
    completed: true,
    answers: [
      {
        stepId: 'name-it',
        text: 'My sister canceled dinner after I had rearranged the week around it, then I saw photos of her out with friends.',
        notes: [note('conflict-text', 'text', 'I felt foolish for caring so much, which made the hurt come out as anger.')],
      },
      {
        stepId: 'look-clearly',
        fields: {
          facts: 'She canceled two hours before dinner. The photo was posted that evening. She said she was overwhelmed and needed to change plans.',
          assumptions: 'She values her friends more than me. She knew this would hurt me. I am always the one making an effort.',
        },
        notes: [
          note('conflict-table', 'table', '', {
            tableRows: [
              ['What I know', 'What I am assuming'],
              ['Dinner was canceled', 'I was deliberately excluded'],
              ['I have not asked her about the photo', 'The post tells the whole story'],
            ],
          }),
        ],
      },
      {
        stepId: 'stir',
        selected: ['Hurt', 'Anger', 'Embarrassment'],
        optionalText: 'Underneath the anger is a fear that I matter less to her than she matters to me.',
        notes: [],
      },
      {
        stepId: 'pull',
        selected: ['Withdraw', 'Confront'],
        optionalText: 'Part of me wants to go silent until she notices. Another part wants to send a sharp message so she feels what I felt.',
        notes: [note('conflict-numbered', 'numbered', 'Before I respond', {
          points: ['Wait until I can speak without punishing her', 'Ask what happened instead of leading with the photo', 'Say plainly that the late change hurt'],
        })],
      },
      {
        stepId: 'before-respond',
        text: 'God, I am hurt and I want to be understood. Keep me from using honesty as a weapon. Help me listen for what I do not yet know.',
        notes: [],
      },
      {
        stepId: 'scripture',
        text: 'I can be quick to listen without pretending nothing happened, and slow to speak without avoiding the conversation.',
        notes: [note('conflict-scripture', 'scripture', '', {
          scriptureReference: 'James 1:19–20',
          scriptureText: 'Everyone should be quick to listen, slow to speak and slow to become angry.',
          scriptureVersion: 'NIV',
        })],
      },
      {
        stepId: 'needed',
        selected: ['Clarify', 'Speak truth', 'Wait'],
        notes: [note('conflict-key', 'key', 'The goal is repair, not a verdict.')],
      },
      {
        stepId: 'respond',
        text: 'Tomorrow I will ask if we can talk. I will describe the canceled plan and how I felt when I saw the post, then give her room to explain.',
        notes: [note('conflict-action', 'action', 'Text her tomorrow: “Could we talk sometime after work?”', {completed: false})],
      },
    ],
  };

  const decision: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'decision-to-make',
    pathTitle: 'I have a decision to make',
    currentStepId: 'next-step',
    completed: true,
    answers: [
      {
        stepId: 'name-decision',
        text: 'Should I accept the team-lead role now or ask to revisit it after this quarter?',
        notes: [note('decision-section', 'section', 'A promotion without rushing the discernment')],
      },
      {
        stepId: 'matters',
        selected: ['Biblical faithfulness', 'People affected', 'Responsibility', 'Timing', 'Finances', 'Wise counsel'],
        notes: [],
      },
      {
        stepId: 'options',
        fields: {
          option_a_name: 'Accept the role now',
          option_a_draw: 'A chance to grow, serve the team, and improve our finances.',
          option_a_concern: 'The transition overlaps with a demanding family season and an unfinished major project.',
          option_b_name: 'Ask to revisit next quarter',
          option_b_draw: 'More margin to finish well and prepare for leadership instead of beginning depleted.',
          option_b_concern: 'The opportunity may not remain open, and fear could disguise itself as patience.',
        },
        notes: [],
      },
      {
        stepId: 'influences',
        selected: ['Faith', 'Fear', 'Approval', 'Opportunity', 'Responsibility'],
        optionalText: 'I notice how much I want the title to confirm that the last few years of work mattered.',
        notes: [note('decision-quote', 'quote', 'You do not have to prove you are ready by pretending you have no limits.', {secondary: 'Elena, during our conversation'})],
      },
      {
        stepId: 'sought-wisdom',
        selected: ['Prayer', 'Scripture', 'Wise counsel', 'Gathering facts', 'A needed conversation'],
        notes: [note('decision-bullets', 'bullets', 'Questions for my manager', {
          points: ['What support is available during the first 90 days?', 'Which responsibilities would leave my current plate?', 'Can the start date move by four weeks?'],
        })],
      },
      {
        stepId: 'scripture',
        text: 'Wisdom is something I can ask for honestly. I do not need to manufacture certainty before I ask.',
        notes: [note('decision-scripture', 'scripture', '', {
          scriptureReference: 'James 1:5',
          scriptureText: 'If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault.',
          scriptureVersion: 'NIV',
        })],
      },
      {
        stepId: 'still-need',
        selected: ['A conversation'],
        notes: [],
      },
      {
        stepId: 'next-step',
        text: 'Meet with my manager Thursday and ask the three practical questions before giving an answer.',
        notes: [
          note('decision-action', 'action', 'Prepare the three questions before Thursday’s one-on-one.', {completed: true}),
          note('decision-remember', 'remember', 'A wise next step can be clear even when the final answer is not.'),
        ],
      },
    ],
  };

  const familyLoad: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'mind-feels-full',
    pathTitle: 'My mind feels full',
    currentStepId: 'faithful-step',
    completed: true,
    answers: [
      {stepId: 'space', selected: ['Family', 'Health', 'The future'], optionalText: 'Dad has another appointment on Thursday, and I am trying to coordinate rides without making every conversation feel clinical.', notes: []},
      {stepId: 'heaviest', selected: ['Family'], optionalText: 'I want to help without taking over decisions that are still his to make.', notes: []},
      {stepId: 'attention', text: 'We need one calm family conversation about what help Dad actually wants this month.', notes: [note('family-load-key', 'key', 'Care can ask before it assumes.')]},
      {stepId: 'discern', fields: {mine: 'Call Dad, listen, and make a simple shared appointment list.', entrust: 'His test results and whether my siblings respond as quickly as I hope.'}, notes: []},
      {stepId: 'need', selected: ['Wisdom', 'Patience', 'Strength'], optionalText: 'Give me patience with the logistics and tenderness with the people involved.', notes: []},
      {stepId: 'scripture', text: 'Today has enough grace for today’s phone call. I do not have to solve the whole season tonight.', notes: [note('family-load-scripture', 'scripture', '', {scriptureReference: 'Matthew 6:34', scriptureText: 'Each day has enough trouble of its own.', scriptureVersion: 'NIV'})]},
      {stepId: 'faithful-step', fields: {do_today: 'Call Dad after dinner and ask what support would feel helpful.', leave_with_god: 'The diagnosis, the timeline, and everyone else’s response.'}, notes: [note('family-load-action', 'action', 'Call Dad after dinner.', {completed: false}), note('family-load-remember', 'remember', 'Being present is not the same as being in control.')]},
    ],
  };

  const ministryLoad: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'mind-feels-full',
    pathTitle: 'My mind feels full',
    currentStepId: 'faithful-step',
    completed: true,
    answers: [
      {stepId: 'space', selected: ['Church / ministry', 'Work', 'Relationship', 'Something else'], optionalText: 'I agreed to lead the retreat while work is entering its busiest month, and I have barely discussed it with Daniel.', notes: [note('ministry-load-bullets', 'bullets', 'Competing commitments', {points: ['Retreat teaching outline', 'Quarter-end reports', 'An overdue evening with Daniel', 'Sleep that keeps getting shortened']})]},
      {stepId: 'heaviest', selected: ['Church / ministry'], optionalText: 'The retreat matters, but I said yes before looking honestly at my capacity.', notes: []},
      {stepId: 'attention', text: 'I need to tell the coordinator what I can prepare well and ask someone else to own the logistics.', notes: []},
      {stepId: 'discern', fields: {mine: 'Prepare the two teaching sessions I committed to and communicate my limits this week.', entrust: 'Whether people are disappointed that I cannot also manage registration and supplies.'}, notes: [note('ministry-load-quote', 'quote', 'A faithful yes needs honest boundaries around it.', {secondary: 'Journal note'})]},
      {stepId: 'need', selected: ['Courage', 'Peace'], optionalText: 'Help me serve from love instead of fear of being seen as unhelpful.', notes: []},
      {stepId: 'scripture', text: 'I can give attention to what is in front of me instead of living inside every possible reaction.', notes: []},
      {stepId: 'faithful-step', fields: {do_today: 'Email the coordinator with a clear division of responsibilities.', leave_with_god: 'My reputation and the urge to make the retreat flawless.'}, notes: [note('ministry-load-response', 'response', 'Serve wholeheartedly within the limits I can honestly offer.')]},
    ],
  };

  const workConflict: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'something-bothering-me',
    pathTitle: 'Something is bothering me',
    currentStepId: 'respond',
    completed: true,
    answers: [
      {stepId: 'name-it', text: 'During the team meeting, Marcus corrected my numbers before I had finished explaining the updated source.', notes: []},
      {stepId: 'look-clearly', fields: {facts: 'He interrupted, quoted the previous report, and later messaged that he had not seen the revision.', assumptions: 'He wanted to embarrass me and does not trust my work.'}, notes: [note('work-conflict-table', 'table', '', {tableRows: [['Observed', 'Interpreted'], ['He used the old report', 'He ignored my update'], ['He apologized by message', 'He only cares because others noticed']]})]},
      {stepId: 'stir', selected: ['Embarrassment', 'Anger', 'Confusion'], optionalText: 'I felt exposed in front of the team and immediately wanted to prove that I was right.', notes: []},
      {stepId: 'pull', selected: ['Defend myself', 'Avoid it'], optionalText: 'I keep drafting a reply that copies everyone, then deleting it.', notes: []},
      {stepId: 'before-respond', text: 'God, help me care more about clarity and the working relationship than about winning the record.', notes: []},
      {stepId: 'scripture', text: 'Listening first may reveal carelessness rather than hostility. Slowing down gives truth room to be useful.', notes: []},
      {stepId: 'needed', selected: ['Clarify', 'Speak truth', 'Apologize'], notes: [note('work-conflict-question', 'question', 'Do I also need to apologize for sending the revision too late?')]},
      {stepId: 'respond', text: 'Ask Marcus for ten minutes tomorrow, explain the impact of the interruption, and own that I sent the revision late.', notes: [note('work-conflict-action', 'action', 'Ask Marcus for a ten-minute conversation.', {completed: false})]},
    ],
  };

  const homeConflict: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'something-bothering-me',
    pathTitle: 'Something is bothering me',
    currentStepId: 'respond',
    completed: true,
    answers: [
      {stepId: 'name-it', text: 'We agreed to share the weekend chores, but by Sunday evening most of them were still waiting and I finished them alone.', notes: []},
      {stepId: 'look-clearly', fields: {facts: 'The laundry and groceries were not done. Sam handled the car repair and took our son to practice.', assumptions: 'The house only runs because I notice everything, and my time matters less.'}, notes: []},
      {stepId: 'stir', selected: ['Hurt', 'Anger', 'Disappointment'], optionalText: 'I am not only tired from the chores; I am tired of feeling like the default planner.', notes: []},
      {stepId: 'pull', selected: ['Confront', 'Fix it immediately'], optionalText: 'I want to list every unfinished thing while I am still angry.', notes: []},
      {stepId: 'before-respond', text: 'Help me name the invisible work honestly without dismissing what Sam did contribute.', notes: [note('home-conflict-remember', 'remember', 'Specific requests are kinder than accumulated scorekeeping.')]},
      {stepId: 'scripture', text: 'Being slow to anger gives me space to speak about the pattern instead of attacking Sam’s character.', notes: []},
      {stepId: 'needed', selected: ['Clarify', 'Forgive', 'Set a boundary'], notes: []},
      {stepId: 'respond', text: 'After dinner, ask to remake the weekend list with clear ownership instead of relying on whoever notices first.', notes: [note('home-conflict-numbered', 'numbered', 'Conversation anchors', {points: ['Name the pattern without “always” or “never”', 'Acknowledge the car repair and practice run', 'Agree on visible ownership for next weekend']})]},
    ],
  };

  const homeDecision: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'decision-to-make',
    pathTitle: 'I have a decision to make',
    currentStepId: 'next-step',
    completed: true,
    answers: [
      {stepId: 'name-decision', text: 'Should we repair the kitchen this year or keep the savings untouched?', notes: []},
      {stepId: 'matters', selected: ['People affected', 'Responsibility', 'Timing', 'Finances', 'Long-term consequences'], notes: []},
      {stepId: 'options', fields: {option_a_name: 'Repair it this year', option_a_draw: 'Fix the leak before it spreads and make the kitchen safer.', option_a_concern: 'Use most of the emergency fund and add disruption during school.', option_b_name: 'Wait six months', option_b_draw: 'Rebuild savings and compare more contractors.', option_b_concern: 'The water damage may become more expensive.'}, notes: []},
      {stepId: 'influences', selected: ['Fear', 'Comfort', 'Responsibility'], optionalText: 'I am tempted either to panic and approve the first quote or avoid looking at the damage.', notes: []},
      {stepId: 'sought-wisdom', selected: ['Prayer', 'Wise counsel', 'Gathering facts'], notes: [note('home-decision-bullets', 'bullets', 'Facts still needed', {points: ['A second repair estimate', 'Whether insurance covers hidden water damage', 'The minimum safe repair versus a full renovation']})]},
      {stepId: 'scripture', text: 'Asking for wisdom includes patiently gathering ordinary facts.', notes: []},
      {stepId: 'still-need', selected: ['More information'], notes: []},
      {stepId: 'next-step', text: 'Schedule a second inspection and call the insurer before choosing the scope of work.', notes: [note('home-decision-action', 'action', 'Call the insurer on Monday.', {completed: false})]},
    ],
  };

  const studyDecision: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'decision-to-make',
    pathTitle: 'I have a decision to make',
    currentStepId: 'next-step',
    completed: true,
    answers: [
      {stepId: 'name-decision', text: 'Should I begin the counseling certificate in January or wait until the following intake?', notes: []},
      {stepId: 'matters', selected: ['Biblical faithfulness', 'People affected', 'Timing', 'Finances', 'Wise counsel', 'Long-term consequences'], notes: []},
      {stepId: 'options', fields: {option_a_name: 'Begin in January', option_a_draw: 'Start training while the desire and scholarship offer are present.', option_a_concern: 'Two evenings away each week during an already full family season.', option_b_name: 'Wait one intake', option_b_draw: 'Save more, prepare childcare, and finish the current volunteer commitment.', option_b_concern: 'Delay may become a comfortable habit rather than wise timing.'}, notes: []},
      {stepId: 'influences', selected: ['Faith', 'Fear', 'Opportunity', 'Responsibility'], optionalText: 'The opportunity feels meaningful, but I do not want urgency to make the decision for us.', notes: []},
      {stepId: 'sought-wisdom', selected: ['Prayer', 'Scripture', 'Wise counsel', 'A needed conversation'], notes: []},
      {stepId: 'scripture', text: 'God is generous with wisdom; uncertainty is an invitation to ask, not evidence that I have failed.', notes: [note('study-decision-scripture', 'scripture', '', {scriptureReference: 'James 1:5', scriptureText: 'If any of you lacks wisdom, you should ask God.', scriptureVersion: 'NIV'})]},
      {stepId: 'still-need', selected: ['A conversation'], notes: []},
      {stepId: 'next-step', text: 'Review the weekly schedule and childcare cost with Ana before the scholarship deadline.', notes: [note('study-decision-key', 'key', 'The next faithful step is a shared conversation, not a private conclusion.'), note('study-decision-action', 'action', 'Plan an unrushed conversation with Ana.', {completed: false})]},
    ],
  };

  const draft: GuidedReflectionPayload = {
    format: GUIDED_REFLECTION_FORMAT,
    pathId: 'decision-to-make',
    pathTitle: 'I have a decision to make',
    currentStepId: 'options',
    stoppedAtStepId: 'options',
    completed: false,
    answers: [
      {
        stepId: 'name-decision',
        text: 'Do we renew this apartment lease or move closer to my parents before the baby arrives?',
        notes: [],
      },
      {
        stepId: 'matters',
        selected: ['People affected', 'Timing', 'Finances', 'Long-term consequences'],
        notes: [],
      },
      {
        stepId: 'options',
        fields: {
          option_a_name: 'Renew for one more year',
          option_a_draw: 'Familiar routines, no moving costs, and a shorter commute.',
          option_a_concern: 'Less family support once the baby arrives.',
          option_b_name: 'Move closer to family',
          option_b_draw: 'Practical help, more shared meals, and grandparents nearby.',
          option_b_concern: 'Higher rent and a longer commute three days a week.',
        },
        notes: [note('draft-question', 'question', 'What kind of support will matter most in the first six months?')],
      },
    ],
  };

  return [
    createFixture({suffix: 'mind-full', demoLabel: 'Complete · Mind feels full', scenario: 'mind', journey: mind, referenceDate, daysAgo: 0, hour: 7, minute: 42}),
    createFixture({suffix: 'mind-family-care', demoLabel: 'Complete · Caring for a parent', scenario: 'mind', journey: familyLoad, referenceDate, daysAgo: 3, hour: 22, minute: 14}),
    createFixture({suffix: 'mind-ministry-load', demoLabel: 'Complete · Too many commitments', scenario: 'mind', journey: ministryLoad, referenceDate, daysAgo: 6, hour: 8, minute: 8}),
    createFixture({suffix: 'conflict', demoLabel: 'Complete · Relationship tension', scenario: 'conflict', journey: conflict, referenceDate, daysAgo: 2, hour: 20, minute: 18}),
    createFixture({suffix: 'conflict-at-work', demoLabel: 'Complete · Tension at work', scenario: 'conflict', journey: workConflict, referenceDate, daysAgo: 0, hour: 18, minute: 35}),
    createFixture({suffix: 'conflict-at-home', demoLabel: 'Complete · Uneven responsibilities', scenario: 'conflict', journey: homeConflict, referenceDate, daysAgo: 4, hour: 21, minute: 26}),
    createFixture({suffix: 'decision', demoLabel: 'Complete · Work decision', scenario: 'decision', journey: decision, referenceDate, daysAgo: 5, hour: 6, minute: 55}),
    createFixture({suffix: 'decision-home-repair', demoLabel: 'Complete · Home repair decision', scenario: 'decision', journey: homeDecision, referenceDate, daysAgo: 2, hour: 8, minute: 24}),
    createFixture({suffix: 'decision-study', demoLabel: 'Complete · Study and family timing', scenario: 'decision', journey: studyDecision, referenceDate, daysAgo: 6, hour: 20, minute: 44}),
    createFixture({suffix: 'draft', demoLabel: 'In progress · Family decision', scenario: 'draft', journey: draft, referenceDate, daysAgo: 1, hour: 21, minute: 6}),
  ];
};

export const guidedReflectionFixturesForScenario = (
  scenario: GuidedReflectionDemoScenario,
  referenceDate = guidedReflectionDemoReferenceDate(),
): GuidedReflectionDemoFixture[] => {
  const fixtures = buildGuidedReflectionDemoFixtures(referenceDate);
  return scenario === 'full'
    ? fixtures
    : fixtures.filter(fixture => fixture.metadata.demoScenario === scenario);
};
