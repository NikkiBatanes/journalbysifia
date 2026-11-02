import {JOHN_GUIDED_STUDIES} from '../../content/bibleStudy/john';

export type GuidedBibleStudyPage =
  | 'understand'
  | 'context'
  | 'look_again'
  | 'reflect'
  | 'respond'
  | 'pray'
  | 'carry';

export type GuidedAnswerSection = 'look_again' | 'reflect' | 'respond';

export interface GuidedBibleStudyContext {
  title: string;
  body: string;
}

export interface GuidedBibleStudyPrompt {
  question: string;
  guideLabel: string;
  guideAnswer: string;
  placeholder: string;
}

export interface GuidedBibleStudy {
  id: string;
  version: number;
  reference: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  summary: string;
  keyVerse: {
    reference: string;
    note: string;
  };
  contexts: GuidedBibleStudyContext[];
  lookAgain: GuidedBibleStudyPrompt;
  reflect: GuidedBibleStudyPrompt;
  respond: GuidedBibleStudyPrompt;
  prayer: string;
  carryTruth: string;
}

export const MATTHEW_23_GUIDED_STUDY: GuidedBibleStudy = {
  id: 'matthew-23-chapter-companion',
  version: 1,
  reference: 'Matthew 23',
  title: 'Matthew 23',
  subtitle: 'Begin with Scripture. Notice what Jesus condemns in religious leadership and what He says matters before God.',
  estimatedMinutes: 10,
  summary: 'Matthew 23 begins with Jesus speaking to the crowds and His disciples about the scribes and Pharisees, warning that their actions do not match what they teach. He describes leaders who place heavy burdens on others, seek public recognition, and love positions and titles of honor, then tells His followers that greatness among them is found in serving and humility. Jesus turns directly to the scribes and Pharisees with a series of severe woes that expose different forms of hypocrisy and distorted religious priorities. He condemns leadership that shuts people out of the kingdom, misdirects converts, creates misleading distinctions in oaths, and carefully tithes small herbs while neglecting the weightier matters of the law: justice, mercy, and faithfulness. He compares outwardly respectable religion with a cup cleaned only on the outside and with whitewashed tombs that appear beautiful while concealing uncleanness within. Jesus also confronts leaders who honor the tombs of the prophets while continuing the pattern of those who rejected and killed God\'s messengers. His warnings culminate in strong language about judgment and accountability for the rejection of righteous messengers. Yet the chapter does not end with denunciation alone: Jesus laments over Jerusalem, describing His desire to gather its children as a hen gathers her chicks under her wings and grieving that they were unwilling. Matthew 23 therefore exposes religious hypocrisy while emphasizing humility, inward integrity, justice, mercy, faithfulness, and Jesus\' grief over persistent rejection.',
  keyVerse: {
    reference: 'Matthew 23:23',
    note: 'This verse captures Jesus\' central criticism: careful outward observance cannot replace the weightier matters of justice, mercy, and faithfulness.',
  },
  contexts: [
    {
      title: 'Moses’ seat',
      body: '“Moses\' seat” refers to a position associated with teaching and interpreting the Law of Moses. Jesus distinguishes between the teaching role of the scribes and Pharisees and their conduct: His criticism centers on people who teach obligations to others but do not live consistently with what they teach.',
    },
    {
      title: 'Tithing small herbs',
      body: 'Mint, dill, and cumin were small garden plants, so carefully measuring a tenth of them pictures extremely detailed religious observance. Jesus does not condemn careful obedience itself; He says they should practice justice, mercy, and faithfulness without neglecting the other responsibilities.',
    },
    {
      title: 'Whitewashed tombs',
      body: 'Jesus\' image of whitewashed tombs depends on the contrast between an attractive exterior and what a tomb contains within. He uses the image to expose hypocrisy: appearing righteous before others while inwardly remaining full of hypocrisy and lawlessness.',
    },
  ],
  lookAgain: {
    question: 'Read Matthew 23:1–28 again. What repeated examples does Jesus give of people appearing righteous outwardly while their actions or hearts tell a different story?',
    guideLabel: 'Compare with the guide',
    guideAnswer: 'Jesus points to several examples: leaders who teach what is right but do not practice it, people who seek public honor, those who carefully tithe small herbs while neglecting justice, mercy, and faithfulness, a cup cleaned only on the outside, and whitewashed tombs that look beautiful but hide uncleanness within. The repeated contrast is between a respectable outward appearance and an inner life or conduct that does not match it.',
    placeholder: 'Write what you notice in the passage…',
  },
  reflect: {
    question: 'Jesus rebukes the scribes and Pharisees for focusing on outward religious details while neglecting justice, mercy, and faithfulness. What does this reveal about the kind of obedience Jesus actually values?',
    guideLabel: 'Read the study note',
    guideAnswer: 'Jesus values obedience that is sincere and whole, not merely visible or precise on the outside. He does not reject careful obedience, but he makes clear that justice, mercy, faithfulness, humility, and integrity must not be neglected.',
    placeholder: 'Reflect in your own words…',
  },
  respond: {
    question: 'Jesus warns against seeking honor while neglecting what matters to God. What is one way you can practice humility, justice, mercy, or faithfulness in a way that is genuine rather than for appearance?',
    guideLabel: 'See an example',
    guideAnswer: 'I can choose one quiet act of faithfulness that does not bring me recognition, such as helping someone in need, showing mercy in a difficult relationship, keeping a commitment, or serving without needing others to notice. The goal is to do what is right before God, not to appear righteous before people.',
    placeholder: 'Name one faithful response…',
  },
  prayer: 'Lord Jesus, You see beyond religious appearance and care about justice, mercy, faithfulness, humility, and truth within. Make my life consistent with what I profess, and teach me to serve without seeking recognition.',
  carryTruth: 'Jesus calls for faith that is humble, truthful within, and marked by justice, mercy, and faithfulness.',
};

export const GUIDED_BIBLE_STUDIES: GuidedBibleStudy[] = [
  MATTHEW_23_GUIDED_STUDY,
  ...JOHN_GUIDED_STUDIES,
];

export const getGuidedBibleStudy = (id?: string): GuidedBibleStudy | undefined =>
  id ? GUIDED_BIBLE_STUDIES.find(guide => guide.id === id) : undefined;
