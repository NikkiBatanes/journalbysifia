// src/services/hooks/useJournalData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Logger } from '../../utils/ProductionLogger';
import { JournalApi, JournalApiEntry } from '../api/journalApi';
import { JournalCache } from '../cache/journalCache';
import { queryKeys } from '../queryKeys';
import { createRetryFunction, createRetryDelayFunction, RETRY_CONFIGS } from '../../utils/retry';
import { QueryConfig } from '../../types/api';
import { faithPointsService } from '../faithPointsService';
import { streakTrackingService } from '../streakTrackingService';

// Hook for getting gratitude entries with enhanced retry logic
export const useGratitudeData = (userId: string, date: string, config?: Partial<QueryConfig>) => {
  const defaultConfig: QueryConfig = {
    staleTime: 1 * 60 * 1000, // Reduced to 1 minute to ensure fresher data
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
    refetchOnMount: true, // Refetch on mount to ensure data is loaded
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
    retry: createRetryFunction(RETRY_CONFIGS.GRATITUDE_ENHANCED),
    retryDelay: createRetryDelayFunction(RETRY_CONFIGS.GRATITUDE_ENHANCED),
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.journal.gratitude(userId, date),
    queryFn: async () => {
      try {
        // Always fetch from API first to ensure fresh data
        const entries = await JournalApi.getGratitudeEntries(userId, date);

        // Cache the results for future use
        await JournalCache.setCache(userId, date, entries, 'gratitude');

        return entries;
      } catch (error) {
        Logger.error('Error fetching gratitude data', error as Error, {
      component: 'useJournalData',
    });
        // Only fall back to cache on error
        const cached = await JournalCache.getCache(userId, date, 'gratitude');
        if (cached) {
          return cached;
        }
        throw error;
      }
    },
    // Remove initialData to allow proper loading states
    ...finalConfig,
  });
};

// Hook for getting todo entries with enhanced retry logic
export const useTodosData = (userId: string, date: string, config?: Partial<QueryConfig>) => {
  const defaultConfig: QueryConfig = {
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
    refetchOnMount: true, // Refetch on mount to ensure data is loaded
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
    retry: createRetryFunction(RETRY_CONFIGS.TODOS_ENHANCED),
    retryDelay: createRetryDelayFunction(RETRY_CONFIGS.TODOS_ENHANCED),
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.journal.todos(userId, date),
    queryFn: async () => {
      try {
        // Try cache first
        const cached = await JournalCache.getCache(userId, date, 'todo');
        if (cached) {
          return cached;
        }

        // Fetch from API
        const entries = await JournalApi.getTodoEntries(userId, date);

        // Cache the results
        await JournalCache.setCache(userId, date, entries, 'todo');

        return entries;
      } catch (error) {
        Logger.error('Error fetching todos data', error as Error, {
      component: 'useJournalData',
    });
        throw error;
      }
    },
    ...finalConfig,
  });
};

// Hook for getting today's focus entries with enhanced retry logic
export const useTodaysFocusData = (userId: string, date: string, config?: Partial<QueryConfig>) => {
  const defaultConfig: QueryConfig = {
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
    refetchOnMount: true, // Refetch on mount to ensure data is loaded
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
    retry: createRetryFunction(RETRY_CONFIGS.FOCUS_ENHANCED),
    retryDelay: createRetryDelayFunction(RETRY_CONFIGS.FOCUS_ENHANCED),
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.journal.todaysFocus(userId, date),
    queryFn: async () => {
      try {
        // Try cache first
        const cached = await JournalCache.getCache(userId, date, 'todays_focus');
        if (cached) {
          return cached;
        }

        // Fetch from API
        const entries = await JournalApi.getTodaysFocusEntries(userId, date);

        // Cache the results
        await JournalCache.setCache(userId, date, entries, 'todays_focus');

        return entries;
      } catch (error) {
        Logger.error('Error fetching today\'s focus data:', error as Error, {
        component: 'useJournalData',
      });
        throw error;
      }
    },
    ...finalConfig,
  });
};

// Hook for getting today's win entries
export const useTodayWinData = (userId: string, date: string) => {
  return useQuery({
    queryKey: queryKeys.journal.todayWin(userId, date),
    queryFn: async () => {
      // Try cache first
      const cached = await JournalCache.getCache(userId, date, 'today_win');
      if (cached) {
        return cached;
      }

      // Fetch from API
      const entries = await JournalApi.getTodayWinEntries(userId, date);

      // Cache the results
      await JournalCache.setCache(userId, date, entries, 'today_win');

      return entries;
    },
    staleTime: 0, // Always consider data stale to prevent showing old data when switching dates
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
  });
};

// Hook for getting looking forward entries
export const useLookingForwardData = (userId: string, date: string) => {
  return useQuery({
    queryKey: queryKeys.journal.lookingForward(userId, date),
    queryFn: async () => {
      // Try cache first
      const cached = await JournalCache.getCache(userId, date, 'looking_forward');
      if (cached) {
        return cached;
      }

      // Fetch from API
      const entries = await JournalApi.getLookingForwardEntries(userId, date);

      // Cache the results
      await JournalCache.setCache(userId, date, entries, 'looking_forward');

      return entries;
    },
    staleTime: 0, // Always consider data stale to prevent showing old data when switching dates
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
  });
};

// Mutation hook for creating journal entries
export const useCreateJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.createJournalEntry,
    onMutate: async (newEntry) => {
      // Skip optimistic updates for gratitude entries to prevent duplicates with API-first strategy
      if (newEntry.content_type === 'gratitude') {
        // Just cancel queries to prevent race conditions
        const entriesQueryKey = queryKeys.journal.entries(newEntry.user_id, newEntry.selected_date);
        const gratitudeQueryKey = queryKeys.journal.gratitude(newEntry.user_id, newEntry.selected_date);

        await queryClient.cancelQueries({ queryKey: entriesQueryKey });
        await queryClient.cancelQueries({ queryKey: gratitudeQueryKey });

        return { skipOptimistic: true };
      }

      // Continue with optimistic updates for other content types
      const entriesQueryKey = queryKeys.journal.entries(newEntry.user_id, newEntry.selected_date);
      await queryClient.cancelQueries({ queryKey: entriesQueryKey });

      // Also cancel content-type specific queries
      let contentTypeQueryKey;
      if (newEntry.content_type === 'todo') {
        contentTypeQueryKey = queryKeys.journal.todos(newEntry.user_id, newEntry.selected_date);
      } else if (newEntry.content_type === 'todays_focus') {
        contentTypeQueryKey = queryKeys.journal.todaysFocus(newEntry.user_id, newEntry.selected_date);
      }

      if (contentTypeQueryKey) {
        await queryClient.cancelQueries({ queryKey: contentTypeQueryKey });
      }

      // Snapshot the previous values
      const previousEntries = queryClient.getQueryData(entriesQueryKey);
      const previousContentTypeEntries = contentTypeQueryKey ? queryClient.getQueryData(contentTypeQueryKey) : null;

      // Create the optimistic entry
      const optimisticEntry = {
        ...newEntry,
        id: 'temp-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update general entries
      queryClient.setQueryData(entriesQueryKey, (old: JournalApiEntry[] = []) => [
        ...old,
        optimisticEntry,
      ]);

      // Optimistically update content-type specific entries
      if (contentTypeQueryKey) {
        queryClient.setQueryData(contentTypeQueryKey, (old: JournalApiEntry[] = []) => [
          ...old,
          optimisticEntry,
        ]);
      }

      // Return a context object with the snapshotted values
      return { previousEntries, previousContentTypeEntries, contentTypeQueryKey };
    },
    onError: (err: Error, newEntry, context) => {
      Logger.error('Error creating journal entry', err as Error, {
      component: 'useJournalData',
    });

      // Skip rollback for gratitude entries (no optimistic updates to rollback)
      if (context?.skipOptimistic) {
        return;
      }

      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousEntries) {
        try {
          const entriesQueryKey = queryKeys.journal.entries(newEntry.user_id, newEntry.selected_date);
          queryClient.setQueryData(entriesQueryKey, context.previousEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back journal entry creation', rollbackError as Error, {
      component: 'useJournalData',
    });
        }
      }

      // Also rollback content-type specific queries
      if (context?.previousContentTypeEntries && context?.contentTypeQueryKey) {
        try {
          queryClient.setQueryData(context.contentTypeQueryKey, context.previousContentTypeEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back content-type specific query', rollbackError as Error, {
      component: 'useJournalData',
    });
        }
      }
    },
    onSuccess: async (data, variables) => {
      // Award faith points for journal entry
      if (variables.user_id) {
        try {
          await faithPointsService.awardPoints(
            variables.user_id,
            'journal_entry',
            {
              suppressNotification: true,
              content_type: variables.content_type,
              source: 'journal',
            }
          );
        } catch (error) {
          Logger.warn('Failed to award faith points for journal entry', {
            component: 'useJournalData',
            error: error as Error,
          });
        }

        // Update journal streak
        try {
          await streakTrackingService.updateStreak(variables.user_id, 'journal');
        } catch (error) {
          Logger.warn('Failed to update journal streak', {
            component: 'useJournalData',
            error: error as Error,
          });
        }
      }

      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.entries(variables.user_id, variables.selected_date),
      });

      // Also invalidate content-type specific queries
      if (variables.content_type === 'gratitude') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.gratitude(variables.user_id, variables.selected_date),
        });
      } else if (variables.content_type === 'todo') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.todos(variables.user_id, variables.selected_date),
        });
      } else if (variables.content_type === 'todays_focus') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.todaysFocus(variables.user_id, variables.selected_date),
        });
      }

      // Clear cache to force fresh data
      JournalCache.clearCache(variables.user_id, variables.selected_date, variables.content_type);
    },
  });
};

// Mutation hook for updating journal entries
export const useUpdateJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JournalApiEntry> }) =>
      JournalApi.updateJournalEntry(id, updates),
    onSuccess: (data) => {
      // Invalidate and refetch related queries (like create mutation)
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.entries(data.user_id, data.selected_date),
      });

      // Also invalidate content-type specific queries (CRITICAL FIX)
      if (data.content_type === 'gratitude') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.gratitude(data.user_id, data.selected_date),
        });
      } else if (data.content_type === 'todo') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.todos(data.user_id, data.selected_date),
        });
      } else if (data.content_type === 'todays_focus') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.journal.todaysFocus(data.user_id, data.selected_date),
        });
      }

      // Clear cache to force fresh data
      JournalCache.clearCache(data.user_id, data.selected_date, data.content_type);
    },
  });
};

// Mutation hook for deleting journal entries
export const useDeleteJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.deleteJournalEntry,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['journalEntries'] });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData<JournalApiEntry[]>(['journalEntries']) || [];

      // Find the entry being deleted for rollback purposes
      const entryToDelete = previousEntries.find(entry => entry.id === id);

      // Optimistically remove the entry
      queryClient.setQueryData<JournalApiEntry[]>(
        ['journalEntries'],
        (old = []) => old.filter(entry => entry.id !== id)
      );

      // Return the context for rollback
      return { previousEntries, entry: entryToDelete };
    },
    onError: (err: Error, id, context) => {
      Logger.error('Error deleting journal entry', err as Error, {
      component: 'useJournalData',
    });

      // Rollback on error
      if (context?.previousEntries) {
        try {
          queryClient.setQueryData(['journalEntries'], context.previousEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back journal entry deletion', rollbackError as Error, {
      component: 'useJournalData',
    });
        }
      }
    },
    onSuccess: (_, id, context) => {
      // Remove the entry from all relevant queries
      if (context?.entry) {
        const entry = context.entry;
        try {
          queryClient.setQueryData(
            queryKeys.journal.entries(entry.user_id, entry.selected_date),
            (old: JournalApiEntry[] = []) => old.filter(e => e.id !== id)
          );

          // Clear cache
          JournalCache.clearCache(entry.user_id, entry.selected_date, entry.content_type);
        } catch (error) {
          Logger.error('Error updating cache after successful deletion', error as Error, {
      component: 'useJournalData',
    });
        }
      }
    },
  });
};

// Hook for prefetching journal data
export const usePrefetchJournalData = () => {
  const queryClient = useQueryClient();

  const prefetchJournalData = async (userId: string, dates: string[]) => {
    const prefetchPromises = dates.flatMap(date => [
      queryClient.prefetchQuery({
        queryKey: queryKeys.journal.gratitude(userId, date),
        queryFn: () => JournalApi.getGratitudeEntries(userId, date),
        staleTime: 0, // Always consider data stale to prevent showing old data when switching dates
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.journal.todos(userId, date),
        queryFn: () => JournalApi.getTodoEntries(userId, date),
        staleTime: 0, // Always consider data stale to prevent showing old data when switching dates
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.journal.todaysFocus(userId, date),
        queryFn: () => JournalApi.getTodaysFocusEntries(userId, date),
        staleTime: 0, // Always consider data stale to prevent showing old data when switching dates
      }),
    ]);

    await Promise.all(prefetchPromises);
  };

  return { prefetchJournalData };
};

// Specific mutation hooks for LookingForward
export const useCreateLookingForwardEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: { user_id: string; selected_date: string; content: any }) =>
      JournalApi.createJournalEntry({
        ...entry,
        content_type: 'looking_forward',
      }),
    onMutate: async (newEntry) => {
      // Cancel any outgoing refetches
      const queryKey = queryKeys.journal.lookingForward(newEntry.user_id, newEntry.selected_date);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: JournalApiEntry[] = []) => [
        ...old,
        {
          ...newEntry,
          id: 'temp-' + Date.now(),
          content_type: 'looking_forward',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      return { previousEntries };
    },
    onError: (err, newEntry, context) => {
      Logger.error('Error creating looking forward entry', err as Error, {
      component: 'useJournalData',
    });
      if (context?.previousEntries) {
        try {
          const queryKey = queryKeys.journal.lookingForward(newEntry.user_id, newEntry.selected_date);
          queryClient.setQueryData(queryKey, context.previousEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back looking forward entry creation', rollbackError as Error, {
      component: 'useJournalData',
    });
        }
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.lookingForward(variables.user_id, variables.selected_date),
      });

      // Clear cache to force fresh data
      JournalCache.clearCache(variables.user_id, variables.selected_date, 'looking_forward');
    },
  });
};

export const useUpdateLookingForwardEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JournalApiEntry> }) =>
      JournalApi.updateJournalEntry(id, updates),
    onSuccess: (data) => {
      // Update the specific entry in the looking forward query
      queryClient.setQueryData(
        queryKeys.journal.lookingForward(data.user_id, data.selected_date),
        (old: JournalApiEntry[] = []) =>
          old.map(entry => entry.id === data.id ? data : entry)
      );

      // Clear cache to ensure consistency
      JournalCache.clearCache(data.user_id, data.selected_date, 'looking_forward');
    },
  });
};

export const useDeleteLookingForwardEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.deleteJournalEntry,
    onMutate: async (entryId: string) => {
      // We need to find the entry first to get user_id and selected_date
      // This is a limitation of the current API design
      return { entryId };
    },
    onSuccess: (_, _deletedId, _context: any) => {
      // Remove the entry from looking forward queries
      // Since we don't have user_id and selected_date, we invalidate all looking forward queries
      queryClient.invalidateQueries({
        queryKey: ['journal', 'lookingForward'],
      });
    },
  });
};

// Specific mutation hooks for TodayWin
export const useCreateTodayWinEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: { user_id: string; selected_date: string; content: any }) =>
      JournalApi.createJournalEntry({
        ...entry,
        content_type: 'today_win',
      }),
    // Removed onMutate optimistic updates to prevent conflicts with component-level optimistic updates
    onError: (err, _newEntry, _context) => {
      Logger.error('Error creating today\'s win entry:', err as Error, {
        component: 'useJournalData',
      });
      // Error handling is now managed at component level
    },
    onSuccess: (data, variables) => {
      // Update cache with the new data instead of invalidating
      const queryKey = queryKeys.journal.todayWin(variables.user_id, variables.selected_date);
      queryClient.setQueryData(queryKey, (old: JournalApiEntry[] = []) => {
        // Add the new entry to the cache
        return [...old, data];
      });

      // Clear local cache
      JournalCache.clearCache(variables.user_id, variables.selected_date, 'today_win');

    },
  });
};

export const useUpdateTodayWinEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JournalApiEntry> }) => {

      return JournalApi.updateJournalEntry(id, updates);
    },
    onSuccess: (data) => {

      const queryKey = queryKeys.journal.todayWin(data.user_id, data.selected_date);

      // Update the specific entry in the today win query
      queryClient.setQueryData(
        queryKey,
        (old: JournalApiEntry[] = []) => {

          const updated = old.map(entry => entry.id === data.id ? data : entry);

          return updated;
        }
      );

      // Clear local cache to ensure consistency
      JournalCache.clearCache(data.user_id, data.selected_date, 'today_win');

      // Don't invalidate immediately to avoid overriding optimistic updates
      // The cache is already updated above with the correct data
    },
    onError: (error) => {
      Logger.error('🏆 useUpdateTodayWinEntry: API call failed', error as Error, {
        component: 'useJournalData',
      });
    },
  });
};

export const useDeleteTodayWinEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.deleteJournalEntry,
    onMutate: async (entryId: string) => {
      // We need to find the entry first to get user_id and selected_date
      // This is a limitation of the current API design
      return { entryId };
    },
    onSuccess: (_, _deletedId, _context: any) => {
      // Remove the entry from today win queries
      // Since we don't have user_id and selected_date, we invalidate all today win queries
      queryClient.invalidateQueries({
        queryKey: ['journal', 'todayWin'],
      });
    },
  });
};

// Specific mutation hooks for TodaysFocus
export const useCreateTodaysFocusEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: { user_id: string; selected_date: string; content: any }) =>
      JournalApi.createJournalEntry({
        ...entry,
        content_type: 'todays_focus',
      }),
    onMutate: async (newEntry) => {
      // Cancel any outgoing refetches
      const queryKey = queryKeys.journal.todaysFocus(newEntry.user_id, newEntry.selected_date);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: JournalApiEntry[] = []) => [
        ...old,
        {
          ...newEntry,
          id: 'temp-' + Date.now(),
          content_type: 'todays_focus',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      return { previousEntries };
    },
    onError: (err, newEntry, context) => {
      Logger.error('Error creating today\'s focus entry:', err as Error, {
        component: 'useJournalData',
      });
      if (context?.previousEntries) {
        try {
          const queryKey = queryKeys.journal.todaysFocus(newEntry.user_id, newEntry.selected_date);
          queryClient.setQueryData(queryKey, context.previousEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back today\'s focus entry creation:', rollbackError as Error, {
        component: 'useJournalData',
      });
        }
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.todaysFocus(variables.user_id, variables.selected_date),
      });

      // Clear cache to force fresh data
      JournalCache.clearCache(variables.user_id, variables.selected_date, 'todays_focus');
    },
  });
};

export const useUpdateTodaysFocusEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JournalApiEntry> }) =>
      JournalApi.updateJournalEntry(id, updates),
    onSuccess: (data) => {
      // Update the specific entry in the today's focus query
      queryClient.setQueryData(
        queryKeys.journal.todaysFocus(data.user_id, data.selected_date),
        (old: JournalApiEntry[] = []) =>
          old.map(entry => entry.id === data.id ? data : entry)
      );

      // Clear cache to ensure consistency
      JournalCache.clearCache(data.user_id, data.selected_date, 'todays_focus');
    },
  });
};

export const useDeleteTodaysFocusEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.deleteJournalEntry,
    onMutate: async (entryId: string) => {
      // We need to find the entry first to get user_id and selected_date
      // This is a limitation of the current API design
      return { entryId };
    },
    onSuccess: (_, _deletedId, _context: any) => {
      // Remove the entry from today's focus queries
      // Since we don't have user_id and selected_date, we invalidate all today's focus queries
      queryClient.invalidateQueries({
        queryKey: ['journal', 'todaysFocus'],
      });
    },
  });
};

// Hook for invalidating all journal data
export const useInvalidateJournalData = () => {
  const queryClient = useQueryClient();

  const invalidateAllJournalData = (userId: string, date?: string) => {
    if (date) {
      // Invalidate specific date
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.entries(userId, date),
      });
    } else {
      // Invalidate all journal data for user
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.all,
      });
    }
  };

  const clearJournalCache = async (userId: string, date?: string) => {
    if (date) {
      await JournalCache.clearCache(userId, date);
    } else {
      await JournalCache.clearAllUserCache(userId);
    }
  };

  return { invalidateAllJournalData, clearJournalCache };
};

// Specific mutation hooks for Todos
export const useCreateTodoEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: { user_id: string; selected_date: string; content: any; content_type: string; completed?: boolean }) =>
      JournalApi.createJournalEntry({
        ...entry,
        content_type: 'todo',
      }),
    onMutate: async (newEntry) => {
      // Cancel any outgoing refetches
      const queryKey = queryKeys.journal.todos(newEntry.user_id, newEntry.selected_date);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: JournalApiEntry[] = []) => [
        ...old,
        {
          ...newEntry,
          id: 'temp-' + Date.now(),
          content_type: 'todo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      return { previousEntries };
    },
    onError: (err, newEntry, context) => {
      Logger.error('Error creating todo entry', err as Error, {
      component: 'useJournalData',
    });
      if (context?.previousEntries) {
        try {
          const queryKey = queryKeys.journal.todos(newEntry.user_id, newEntry.selected_date);
          queryClient.setQueryData(queryKey, context.previousEntries);
        } catch (rollbackError) {
          Logger.error('Error rolling back todo entry creation', rollbackError as Error, {
      component: 'useJournalData',
    });
        }
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.todos(variables.user_id, variables.selected_date),
      });

      // Clear cache to force fresh data
      JournalCache.clearCache(variables.user_id, variables.selected_date, 'todo');
    },
  });
};

export const useUpdateTodoEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JournalApiEntry> }) =>
      JournalApi.updateJournalEntry(id, updates),
    onSuccess: (data) => {
      // Update the specific entry in the todos query
      queryClient.setQueryData(
        queryKeys.journal.todos(data.user_id, data.selected_date),
        (old: JournalApiEntry[] = []) =>
          old.map(entry => entry.id === data.id ? data : entry)
      );

      // Clear cache to ensure consistency
      JournalCache.clearCache(data.user_id, data.selected_date, 'todo');
    },
  });
};

export const useDeleteTodoEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: JournalApi.deleteJournalEntry,
    onMutate: async (entryId: string) => {
      // We need to find the entry first to get user_id and selected_date
      // This is a limitation of the current API design
      return { entryId };
    },
    onSuccess: (_, _deletedId, _context: any) => {
      // Remove the entry from todos queries
      // Since we don't have user_id and selected_date, we invalidate all todos queries
      queryClient.invalidateQueries({
        queryKey: ['journal', 'todos'],
      });
    },
  });
};
