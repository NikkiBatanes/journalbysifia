export interface ReflectionQuestion {
  id: string;
  text: string;
  userResponse?: string;
}

export interface Scripture {
  text: string;
  reference: string;
  version?: string; // Bible version (e.g., "NASB", "ESV", "NIV")
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
  userId?: string; // User ID for the devotional
  title: string;
  description: string;
  category: DevotionalCategory;
  categories: string[]; // For multiple categories support

  // Playbook relationship (ENHANCED)
  playbookId?: string; // Reference to the playbook that generated this devotional
  playbookTitle?: string; // Cached playbook title for quick access

  // Content and progress
  days: DevotionalDay[];
  currentDay: number;
  totalDays: number;
  progress: number;
  completed: boolean;
  completedAt?: string; // When the devotional was completed

  // User feedback (ENHANCED)
  rating?: number; // 1-5 star rating
  ratedAt?: string; // When the rating was submitted
  feedback?: string; // User feedback text

  // Metadata
  createdAt: string;
  updatedAt: string;

  // Legacy fields (for backward compatibility)
  userInput?: string; // The user input from the playbook
  isFallback?: boolean; // Indicates if this is a fallback devotional
}

export type DevotionalCategory =
  | 'Relationships'
  | 'Family'
  | 'Marriage'
  | 'Singleness'
  | 'Friendship'
  | 'Work & Career'
  | 'Calling & Purpose'
  | 'Finance & Stewardship'
  | 'Decision-Making'
  | 'Conflict & Boundaries'
  | 'Hurt & Forgiveness'
  | 'Faith & Obedience'
  | 'Church & Ministry'
  | 'Parenting'
  | 'Emotions & Inner Life'
  | 'Health & Wellness'
  | 'Anxiety & Peace'
  | 'Fear & Trust'
  | 'Waiting & Uncertainty'
  | 'Grief & Loss'
  | 'Shame & Guilt';

export const DEVOTIONAL_CATEGORIES: DevotionalCategory[] = [
  'Relationships',
  'Family',
  'Marriage',
  'Singleness',
  'Friendship',
  'Work & Career',
  'Calling & Purpose',
  'Finance & Stewardship',
  'Decision-Making',
  'Conflict & Boundaries',
  'Hurt & Forgiveness',
  'Faith & Obedience',
  'Church & Ministry',
  'Parenting',
  'Emotions & Inner Life',
  'Health & Wellness',
  'Anxiety & Peace',
  'Fear & Trust',
  'Waiting & Uncertainty',
  'Grief & Loss',
  'Shame & Guilt',
];

export interface DevotionalCreationParams {
  title?: string;
  description?: string;
  topic?: string;
  category?: DevotionalCategory; // NEW: Category for the devotional
  duration: number;
  playbookId?: string;
  userInput?: string;
  dateOfBirth?: string;
  ageGroup?: string;
  isOnboarding?: boolean; // NEW: Flag for onboarding context
}
