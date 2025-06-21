export interface ReflectionQuestion {
  id: string;
  text: string;
  userResponse?: string;
}

export interface Scripture {
  text: string;
  reference: string;
}

export interface DevotionalDay {
  id: string;
  dayNumber: number;
  title: string;
  reflection: string;
  reflectionQuestions: ReflectionQuestion[];
  prayer: string;
  completed: boolean;
  completedAt?: string;
  scripture: Scripture; // Add scripture property to match backend structure
}

export interface Devotional {
  id: string;
  title: string;
  description: string;
  category: DevotionalCategory;
  categories: string[]; // For backward compatibility with API responses
  days: DevotionalDay[];
  currentDay: number;
  totalDays: number;
  progress: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  playbookId?: string; // Reference to the playbook that generated this devotional
  userInput?: string; // The user input from the playbook
  isFallback?: boolean; // Indicates if this is a fallback devotional
}

export type DevotionalCategory =
  | 'Prayer'
  | 'Growth'
  | 'Healing'
  | 'Wisdom'
  | 'Relationships'
  | 'Purpose'
  | 'Career'
  | 'Finances'
  | 'Mental Health'
  | 'Parenting'
  | 'Health';

export const DEVOTIONAL_CATEGORIES: DevotionalCategory[] = [
  'Prayer',
  'Growth',
  'Healing',
  'Wisdom',
  'Relationships',
  'Purpose',
  'Career',
  'Finances',
  'Mental Health',
  'Parenting',
  'Health',
];

export interface DevotionalCreationParams {
  title?: string;
  description?: string;
  topic?: string;
  duration: number;
  playbookId?: string;
  userInput?: string;
}
