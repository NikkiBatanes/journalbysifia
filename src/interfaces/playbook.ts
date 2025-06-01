export interface BibleVerse {
  text: string;
  reference: string;
}

export interface ActionStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface TruthInLove {
  truth: string;
  summary: string;
}

export interface Playbook {
  id: string;
  title: string;
  userInput: string;
  truthInLove: TruthInLove;
  actionSteps: ActionStep[];
  affirmation: string;
  bibleVerse: BibleVerse;
  directChallenge: string;
  profileImage: string;
  progress: number;
  totalTasks: number;
  createdAt?: string;
  updatedAt?: string;
}
