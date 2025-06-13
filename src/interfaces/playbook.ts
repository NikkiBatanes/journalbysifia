export interface BibleVerse {
  text: string;
  reference: string;
}

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface ActionStep {
  id: string;
  title: string;
  description?: string; // For steps without sub-tasks
  subTasks?: SubTask[]; // Only present if there are sub-tasks
  completed: boolean; // Always boolean for strict typing
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
  affirmations: Affirmation[];
  bibleVerse: BibleVerse;
  directChallenge?: string | { text: string; summary: string };
  challengeCTA?: string; // Optional call-to-action separated from the challenge body
  profileImage?: string;
  progress: number;
  totalTasks: number;
  user_id: string; // User ID from Supabase
  createdAt?: string;
  updatedAt?: string;
  status?: string; // 'inProgress' | 'completed' or undefined for compatibility
}

