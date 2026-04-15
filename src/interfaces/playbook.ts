export interface BibleVerse {
  text: string;
  reference: string;
  version?: string;
}

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  is_example?: boolean; // Whether this subtask is an example
  example_interactive?: boolean; // Whether the example can be interacted with
  orderIndex?: number; // For ordering subtasks
}

export interface ActionStep {
  id: string;
  title: string;
  description?: string; // For steps without sub-tasks
  examples?: string; // Examples from database
  example_interactive?: boolean; // Whether examples can be interacted with
  subTasks?: SubTask[]; // Only present if there are sub-tasks
  completed: boolean; // Always boolean for strict typing
  orderIndex?: number; // For ordering action steps
  // New walkthrough format
  actionType?: 'done_skip' | 'commit' | 'choose' | 'text_input';
  primaryButton?: string; // Custom primary button label
  secondaryButton?: string; // Custom secondary button label
}

export interface TruthInLove {
  text: string;
  summary: string;
}

export interface Affirmation {
  id: string;
  text: string;
  completed: boolean;
}

export interface Playbook {
  completedAt?: string | null; // ISO date string when playbook is completed
  id: string;
  title: string;
  userInput: string;
  truthInLove: TruthInLove;
  actionSteps: ActionStep[];
  affirmations?: Affirmation[]; // @deprecated - replaced by wordsToSpeak array
  bibleVerse: BibleVerse;
  directChallenge?: string | { text: string; summary: string };
  challengeCTA?: string; // Optional call-to-action separated from the challenge body
  prayer?: string; // Short prayer to God for the walkthrough (Screen 4)
  wordToSpeak?: string; // Short declaration the user reads aloud (Screen 5) - legacy compat
  wordsToSpeak?: string[]; // Array of declaration lines (new format)
  bibleVerseReflection?: string; // 2-3 short reflection lines shown below the verse (Screen 2)
  faithfulActionsIntro?: string; // One-line framing sentence before action steps (Screen 3)
  transitionLine?: string; // Calm bridge line shown between Step 0 (Enter the Moment) and Step 1 (Truth in Love)
  profileImage?: string;
  progress: number;
  totalTasks: number;
  user_id: string; // User ID from Supabase
  createdAt?: string;
  updatedAt?: string;
  status?: string; // 'inProgress' | 'completed' or undefined for compatibility
}

