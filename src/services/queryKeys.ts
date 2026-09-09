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

    // Infinite queries
    infinite: (userId: string, type: string) => ['journal', 'infinite', userId, type] as const,
    search: (userId: string, searchTerm: string) => ['journal', 'search', userId, searchTerm] as const,
  },

  // TimeBlock-related queries (separate database)
  timeBlocks: {
    all: ['timeBlocks'] as const,
    byDate: (userId: string, date: string) => ['timeBlocks', 'byDate', userId, date] as const,
    dateRange: (userId: string, startDate: string, endDate: string) => ['timeBlocks', 'dateRange', userId, startDate, endDate] as const,
    conflicts: (userId: string, date: string, startTime: string, endTime: string) => ['timeBlocks', 'conflicts', userId, date, startTime, endTime] as const,
  },

  // Reflection-related queries (separate database)
  reflections: {
    all: ['reflections'] as const,
    byDate: (userId: string, date: string) => ['reflections', 'byDate', userId, date] as const,
    byType: (userId: string, date: string, type: string) => ['reflections', 'byType', userId, date, type] as const,
    dateRange: (userId: string, startDate: string, endDate: string) => ['reflections', 'dateRange', userId, startDate, endDate] as const,
    search: (userId: string, searchTerm: string) => ['reflections', 'search', userId, searchTerm] as const,
    stats: (userId: string, startDate: string, endDate: string) => ['reflections', 'stats', userId, startDate, endDate] as const,
    infinite: (userId: string) => ['reflections', 'infinite', userId] as const,
    count: (userId: string) => ['reflections', 'count', userId] as const,
    byQuestion: (userId: string, questionText: string, dayNumber?: number, questionNumber?: number) =>
      ['reflections', 'byQuestion', userId, questionText, dayNumber, questionNumber] as const,
  },

  // Prayer-related queries
  prayers: {
    all: (userId: string) => ['prayers', userId] as const,
    entries: (userId: string, date: string) => ['prayers', 'entries', userId, date] as const,
    acts: (userId: string, date: string) => ['prayers', 'acts', userId, date] as const,
    people: (userId: string, date: string) => ['prayers', 'people', userId, date] as const,
    allPeople: (userId: string) => ['prayers', 'allPeople', userId] as const,
    guided: (userId: string, date: string) => ['prayers', 'guided', userId, date] as const,
    personal: (userId: string, date: string) => ['prayers', 'personal', userId, date] as const,
    allGuided: (userId: string) => ['prayers', 'allGuided', userId] as const,
    byType: (userId: string, date: string, type: string) => ['prayers', 'byType', userId, date, type] as const,
    search: (userId: string, searchTerm: string) => ['prayers', 'search', userId, searchTerm] as const,
    stats: (userId: string, startDate: string, endDate: string) => ['prayers', 'stats', userId, startDate, endDate] as const,
    prayed: (userId: string) => ['prayers', 'prayed', userId] as const,
    prayedItems: (userId: string) => ['prayers', 'prayedItems', userId] as const,
    // New: Unprayed prayer requests across all dates
    unprayedRequests: (userId: string) => ['prayers', 'unprayedRequests', userId] as const,

    // Infinite queries
    infinite: (userId: string, prayerType?: string) => ['prayers', 'infinite', userId, prayerType] as const,
  },

  // Playbook-related queries
  playbooks: {
    all: (userId: string) => ['playbooks', userId] as const,
    lists: () => ['playbooks'] as const,
    detail: (userId: string, playbookId: string) => ['playbooks', 'detail', userId, playbookId] as const,
    byStatus: (userId: string, status: string) => ['playbooks', 'status', userId, status] as const,
    actionSteps: (playbookId: string) => ['playbooks', 'actionSteps', playbookId] as const,
    affirmations: (playbookId: string) => ['playbooks', 'affirmations', playbookId] as const,
    progress: (userId: string) => ['playbooks', 'progress', userId] as const,
    stats: (userId: string) => ['playbooks', 'stats', userId] as const,
    search: (userId: string, searchTerm: string) => ['playbooks', 'search', userId, searchTerm] as const,

    // Advanced prefetching patterns
    adjacent: (userId: string, currentPlaybookId: string) => ['playbooks', 'adjacent', userId, currentPlaybookId] as const,
    batch: (userId: string, playbookIds: string[]) => ['playbooks', 'batch', userId, ...playbookIds.sort()] as const,
    related: (userId: string, playbookId: string) => ['playbooks', 'related', userId, playbookId] as const,

    // Cross-component relationships
    withJournal: (userId: string, playbookId: string, date: string) => ['playbooks', 'withJournal', userId, playbookId, date] as const,
    withPrayers: (userId: string, playbookId: string) => ['playbooks', 'withPrayers', userId, playbookId] as const,

    // Performance optimization keys
    infinite: (userId: string) => ['playbooks', 'infinite', userId] as const,
    prefetch: (userId: string, playbookIds: string[]) => ['playbooks', 'prefetch', userId, ...playbookIds.sort()] as const,
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

  // Global search queries
  search: {
    all: ['search'] as const,
    infinite: (userId: string, searchTerm: string, contentTypes: string[]) => ['search', 'infinite', userId, searchTerm, contentTypes] as const,
    recent: (userId: string) => ['search', 'recent', userId] as const,
  },

  // Dashboard-related queries
  dashboard: {
    all: ['dashboard'] as const,
    streaks: (userId: string) => ['dashboard', 'streaks', userId] as const,
    insights: (userId: string) => ['dashboard', 'insights', userId] as const,
  },
} as const;

/**
 * Helper functions for query key management
 */
export const queryKeyHelpers = {
  // Invalidate all journal queries for a user
  invalidateJournalQueries: (_userId: string) => queryKeys.journal.all,

  // Invalidate all queries for a specific date
  invalidateJournalDate: (userId: string, date: string) => ['journal', userId, date],

  // Invalidate all prayer queries for a user
  invalidatePrayerQueries: (_userId: string) => queryKeys.prayers.all,

  // Invalidate all playbook queries for a user
  invalidatePlaybookQueries: (_userId: string) => queryKeys.playbooks.all,

  // Invalidate all user-related queries
  invalidateUserQueries: (_userId: string) => queryKeys.user.all,
};

/**
 * Type helpers for query keys
 */
export type QueryKeys = typeof queryKeys;
export type JournalQueryKeys = typeof queryKeys.journal;
export type PrayerQueryKeys = typeof queryKeys.prayers;
export type PlaybookQueryKeys = typeof queryKeys.playbooks;
