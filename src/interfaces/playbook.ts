export interface BibleVerse {
  text: string;
  reference: string;
}

export interface ActionStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface Playbook {
  id: string;
  title: string;
  truthInLove: string;
  truthSummary: string;
  actionSteps: ActionStep[];
  affirmation: string;
  bibleVerse: BibleVerse;
  directChallenge: string;
  createdAt: string;
  updatedAt: string;
  userInput?: string;
}
