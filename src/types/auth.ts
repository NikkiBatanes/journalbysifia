export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  
  // Spiritual profile
  spiritualLevel?: 'beginner' | 'growing' | 'mature' | 'leader';
  denomination?: string;
  churchName?: string;
  
  // Gamification
  level: number;
  experience: number;
  streak: number;
  longestStreak: number;
  totalPoints: number;
  badges: Badge[];
  
  // Preferences
  preferences: UserPreferences;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'devotional' | 'prayer' | 'journal' | 'playbook' | 'streak' | 'achievement';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: string;
  progress?: number;
  maxProgress?: number;
}

export interface UserPreferences {
  // Notifications
  notifications: {
    dailyDevotional: boolean;
    prayerReminders: boolean;
    journalPrompts: boolean;
    playbookUpdates: boolean;
    achievements: boolean;
    weeklyReports: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
    reminderTime: string; // HH:MM format
    timezone: string;
  };
  
  // Appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large' | 'extra_large';
  colorScheme: 'default' | 'blue' | 'green' | 'purple' | 'pink' | 'warm';
  
  // Privacy
  privacy: {
    profileVisibility: 'public' | 'private';
    shareProgress: boolean;
    shareJournal: boolean;
  };
  
  // Content
  content: {
    language: string;
    bibleVersion: string;
    autoPlayAudio: boolean;
    downloadForOffline: boolean;
    showVerseOfDay: boolean;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  retrying: boolean;
  refreshRetrying: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface SocialAuthProvider {
  id: 'google' | 'apple' | 'facebook';
  name: string;
  icon: string;
  color: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: 'devotional' | 'prayer' | 'journal' | 'scripture' | 'service' | 'custom';
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one_time';
  targetValue: number;
  currentValue: number;
  unit: string; // 'days', 'minutes', 'chapters', 'prayers', etc.
  startDate: string;
  endDate?: string;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
  reward?: {
    points: number;
    badge?: string;
    title?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  duration: number; // in days
  playbookId: string;
  actionStepId?: string; // If challenge is from specific action step
  requirements: {
    level?: number;
    badges?: string[];
    completedPlaybooks?: string[];
  };
  rewards: {
    points: number;
    experience: number;
    badges: string[];
    title?: string;
  };
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface UserProgress {
  userId: string;
  totalDevotionals: number;
  totalPrayers: number;
  totalJournalEntries: number;
  totalPlaybooksCompleted: number;
  currentStreak: number;
  longestStreak: number;
  weeklyGoals: Goal[];
  monthlyGoals: Goal[];
  activeGoals: Goal[];
  completedGoals: Goal[];
  activeChallenges: string[];
  completedChallenges: string[];
  lastUpdated: string;
}
