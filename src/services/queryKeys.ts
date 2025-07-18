/**
 * Centralized query keys for React Query
 * Following industry best practices for query key management
 * 
 * Structure: [domain, entity, ...identifiers]
 * Example: ['journal', 'gratitude', userId, date]
 */

export const queryKeys = {
  // Journal-related queries
  journal: {
    all: ['journal'] as const,
    entries: (userId: string, date: string) => ['journal', 'entries', userId, date] as const,
    gratitude: (userId: string, date: string) => ['journal', 'gratitude', userId, date] as const,
    todos: (userId: string, date: string) => ['journal', 'todos', userId, date] as const,
    timeBlocks: (userId: string, date: string) => ['journal', 'timeBlocks', userId, date] as const,
    todaysFocus: (userId: string, date: string) => ['journal', 'focus', userId, date] as const,
    reflections: (userId: string, date: string) => ['journal', 'reflections', userId, date] as const,
    todayWin: (userId: string, date: string) => ['journal', 'todayWin', userId, date] as const,
    lookingForward: (userId: string, date: string) => ['journal', 'lookingForward', userId, date] as const,
  },

  // Prayer-related queries
  prayers: {
    all: ['prayers'] as const,
    entries: (userId: string) => ['prayers', 'entries', userId] as const,
    devotional: (userId: string, devotionalId: string) => ['prayers', 'devotional', userId, devotionalId] as const,
    prayed: (userId: string) => ['prayers', 'prayed', userId] as const,
    prayedItems: (userId: string) => ['prayers', 'prayedItems', userId] as const,
  },

  // Devotional-related queries
  devotionals: {
    all: ['devotionals'] as const,
    list: (userId: string) => ['devotionals', 'list', userId] as const,
    detail: (userId: string, devotionalId: string) => ['devotionals', 'detail', userId, devotionalId] as const,
    progress: (userId: string, devotionalId: string) => ['devotionals', 'progress', userId, devotionalId] as const,
    playbook: (playbookId: string) => ['devotionals', 'playbook', playbookId] as const,
    ratings: (userId: string) => ['devotionals', 'ratings', userId] as const,
  },

  // Playbook-related queries
  playbooks: {
    all: ['playbooks'] as const,
    list: (userId: string) => ['playbooks', 'list', userId] as const,
    detail: (userId: string, playbookId: string) => ['playbooks', 'detail', userId, playbookId] as const,
    actionSteps: (playbookId: string) => ['playbooks', 'actionSteps', playbookId] as const,
    active: (userId: string) => ['playbooks', 'active', userId] as const,
    completed: (userId: string) => ['playbooks', 'completed', userId] as const,
  },

  // User-related queries
  user: {
    all: ['user'] as const,
    profile: (userId: string) => ['user', 'profile', userId] as const,
    preferences: (userId: string) => ['user', 'preferences', userId] as const,
    stats: (userId: string) => ['user', 'stats', userId] as const,
  },

  // Auth-related queries
  auth: {
    all: ['auth'] as const,
    session: () => ['auth', 'session'] as const,
    user: () => ['auth', 'user'] as const,
  },
} as const;

/**
 * Helper functions for query key management
 */
export const queryKeyHelpers = {
  // Invalidate all journal queries for a user
  invalidateJournalQueries: (userId: string) => queryKeys.journal.all,
  
  // Invalidate all queries for a specific date
  invalidateJournalDate: (userId: string, date: string) => ['journal', userId, date],
  
  // Invalidate all prayer queries for a user
  invalidatePrayerQueries: (userId: string) => queryKeys.prayers.all,
  
  // Invalidate all devotional queries for a user
  invalidateDevotionalQueries: (userId: string) => queryKeys.devotionals.all,
  
  // Invalidate all playbook queries for a user
  invalidatePlaybookQueries: (userId: string) => queryKeys.playbooks.all,
  
  // Invalidate all user-related queries
  invalidateUserQueries: (userId: string) => queryKeys.user.all,
};

/**
 * Type helpers for query keys
 */
export type QueryKeys = typeof queryKeys;
export type JournalQueryKeys = typeof queryKeys.journal;
export type PrayerQueryKeys = typeof queryKeys.prayers;
export type DevotionalQueryKeys = typeof queryKeys.devotionals;
export type PlaybookQueryKeys = typeof queryKeys.playbooks;
