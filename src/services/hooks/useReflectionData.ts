// src/services/hooks/useReflectionData.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DeviceEventEmitter } from 'react-native';
import { Logger } from '../../utils/ProductionLogger';
import { ReflectionApi, ReflectionApiEntry } from '../api/reflectionApi';
import { queryKeys } from '../queryKeys';
import { defaultQueryOptions, defaultMutationOptions, queryOptionsPresets } from '../config/queryConfig';
import { analytics } from '../../utils/analytics';
import { useAuth } from '../../context/IndustryStandardAuthContext';

// Hook for getting reflection entries for a specific date
export const useReflectionData = (userId: string, date: string) => {
  return useQuery({
    ...queryOptionsPresets.critical, // Use critical instead of realtime for better caching
    queryKey: queryKeys.reflections.byDate(userId, date),
    queryFn: () => ReflectionApi.getReflectionEntries(userId, date),
    enabled: !!userId && !!date,
    initialData: [], // Provide empty array as initial data
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
  });
};

// Hook for getting reflections by type
export const useReflectionsByType = (userId: string, date: string, type: 'free' | 'guided') => {
  return useQuery({
    queryKey: queryKeys.reflections.byType(userId, date, type),
    queryFn: () => ReflectionApi.getReflectionsByType(userId, date, type),
    ...defaultQueryOptions,
    enabled: !!userId && !!date && !!type,
  });
};

// Hook for getting reflections by playbook
export const useReflectionsByPlaybook = (userId: string, playbookId: string) => {
  return useQuery({
    queryKey: ['reflections', 'playbook', userId, playbookId],
    queryFn: () => ReflectionApi.getReflectionsByPlaybook(userId, playbookId),
    ...queryOptionsPresets.stable,
    enabled: !!userId && !!playbookId,
  });
};

// Hook for getting reflection by subtask
export const useReflectionBySubtask = (userId: string, subtaskId: string) => {
  return useQuery({
    queryKey: ['reflections', 'subtask', userId, subtaskId],
    queryFn: () => ReflectionApi.getReflectionBySubtask(userId, subtaskId),
    ...queryOptionsPresets.realtime, // Use realtime preset for fresh reflection data
    enabled: !!userId && !!subtaskId,
  });
};

// Hook for getting reflections in a date range
export const useReflectionsInRange = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.dateRange(userId, startDate, endDate),
    queryFn: () => ReflectionApi.getReflectionsInDateRange(userId, startDate, endDate),
    ...defaultQueryOptions,
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// Hook for infinite scrolling reflections
export const useInfiniteReflections = (userId: string, pageSize: number = 20) => {
  return useInfiniteQuery({
    queryKey: queryKeys.reflections.infinite(userId),
    queryFn: ({ pageParam = 0 }) => ReflectionApi.getPaginatedReflections(userId, pageParam, pageSize),
    initialPageParam: 0,
    ...defaultQueryOptions,
    enabled: !!userId,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) {return undefined;}
      return allPages.length;
    },
    getPreviousPageParam: (firstPage, allPages) => {
      if (allPages.length <= 1) {return undefined;}
      return allPages.length - 2;
    },
  });
};

// Hook for getting reflections count
export const useReflectionsCount = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.count(userId),
    queryFn: () => ReflectionApi.getReflectionsCount(userId),
    ...queryOptionsPresets.stable,
    enabled: !!userId,
  });
};

// Hook for searching reflections
export const useSearchReflections = (userId: string, searchTerm: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.search(userId, searchTerm),
    queryFn: () => ReflectionApi.searchReflections({ userId, searchTerm }),
    ...defaultQueryOptions,
    enabled: !!userId && !!searchTerm && searchTerm.length > 2,
  });
};

// Hook for getting reflection stats
export const useReflectionStats = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.stats(userId, startDate, endDate),
    queryFn: () => ReflectionApi.getReflectionStats(userId, startDate, endDate),
    ...defaultQueryOptions,
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// Hook to check if a reflection question has been journaled
export const useIsQuestionJournaled = (questionText: string, dayNumber?: number, questionNumber?: number) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.reflections.byQuestion(userId || '', questionText, dayNumber, questionNumber),
    queryFn: async () => {
      if (!userId) {return false;}

      // First try to find by exact question text and context
      const reflections = await ReflectionApi.searchReflections({
        userId,
        searchTerm: `"${questionText}"`,
        dayNumber,
        questionNumber,
        limit: 1,
      });

      // If no results, try a more general search
      if (reflections.length === 0) {
        const generalResults = await ReflectionApi.searchReflections({
          userId,
          searchTerm: questionText,
          limit: 5,
        });

        // Check if any result contains the question text
        return generalResults.some(reflection =>
          reflection.content?.includes(questionText) ||
          reflection.prompt?.includes(questionText)
        );
      }

      return reflections.length > 0;
    },
    ...queryOptionsPresets.stable,
    enabled: !!userId && !!questionText,
    // Cache the result for 5 minutes to avoid excessive queries
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for creating a reflection entry
export const useCreateReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ReflectionApi.createReflectionEntry,
    ...defaultMutationOptions,
    onMutate: async (newReflection) => {
      // Cancel any outgoing refetches
      const queryKey = queryKeys.reflections.byDate(newReflection.user_id, newReflection.selected_date);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousReflections = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) => [
        ...old,
        {
          ...newReflection,
          id: 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ReflectionApiEntry,
      ]);

      return { previousReflections };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousReflections) {
        const queryKey = queryKeys.reflections.byDate(variables.user_id, variables.selected_date);
        queryClient.setQueryData(queryKey, context.previousReflections);
      }

      // Track creation error
      analytics.track('reflection_creation_failed', {
        error: error.message,
        type: variables.type,
      });
    },
    onSuccess: (data, variables) => {
      // Update the cache directly with the new data (no refetching needed)
      const queryKey = queryKeys.reflections.byDate(variables.user_id, variables.selected_date);
      queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) => {
        // Remove any temporary entries and add the real one
        const filtered = old.filter(entry => !entry.id.startsWith('temp-'));
        return [...filtered, data];
      });

      // Update type-specific cache if type is specified
      if (variables.type) {
        queryClient.setQueryData(
          queryKeys.reflections.byType(variables.user_id, variables.selected_date, variables.type),
          (old: ReflectionApiEntry[] = []) => {
            const filtered = old.filter(entry => !entry.id.startsWith('temp-'));
            return [...filtered, data];
          }
        );
      }

      // Update subtask-specific queries if subtask_id is present (no refetch)
      if (variables.subtask_id) {
        queryClient.setQueryData(['reflections', 'subtask', variables.user_id, variables.subtask_id], data);
      }

      // Only invalidate search results (not critical queries)
      queryClient.invalidateQueries({ queryKey: ['reflections', 'search'], refetchType: 'none' });

      // Force refresh all relevant queries to ensure UI updates instantly for new reflections
      queryClient.invalidateQueries({
        queryKey: queryKeys.reflections.byDate(variables.user_id, variables.selected_date),
        refetchType: 'active', // Only refetch active queries
      });

      // Also invalidate the general reflections query to ensure list refreshes
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
        refetchType: 'active',
      });

      // And invalidate any journal-specific queries
      queryClient.invalidateQueries({
        queryKey: ['journal'],
        refetchType: 'active',
      });

      // Direct refetch as a fallback to ensure UI updates
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: queryKeys.reflections.byDate(variables.user_id, variables.selected_date),
        });
      }, 100);

      // Track successful creation
      analytics.track('reflection_created', {
        type: variables.type,
        contentLength: variables.content.length,
        hasTitle: !!variables.title,
      });
    },
  });
};

// Hook for updating a reflection entry
export const useUpdateReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<ReflectionApiEntry, 'id' | 'user_id' | 'created_at'>> }) => {

      return ReflectionApi.updateReflectionEntry(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      // Skip optimistic updates for better performance - direct cache updates are sufficient
      return { id, updates };
    },
    onError: (updateError, { id: _id }, _context) => {
      Logger.error('🔍 useUpdateReflection: API call failed', updateError as Error, {
  component: 'useReflectionData',
});
      // No rollback needed since we skipped optimistic updates
    },
    onSuccess: (data, _variables) => {
      // Update the specific reflection in the main query (no refetching needed)
      const queryKey = queryKeys.reflections.byDate(data.user_id, data.selected_date);

      queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) => {
        const updated = old.map(reflection => reflection.id === data.id ? data : reflection);
        return updated;
      });

      // Also update type-specific queries if type is specified (no refetching)
      if (data.type) {
        queryClient.setQueryData(
          queryKeys.reflections.byType(data.user_id, data.selected_date, data.type),
          (old: ReflectionApiEntry[] = []) =>
            old.map(reflection => reflection.id === data.id ? data : reflection)
        );
      }

      // Update subtask-specific queries if subtask_id is present (no refetch)
      if (data.subtask_id) {
        queryClient.setQueryData(['reflections', 'subtask', data.user_id, data.subtask_id], data);
      }

      // Force refresh all relevant queries to ensure UI updates instantly
      queryClient.invalidateQueries({
        queryKey: queryKeys.reflections.byDate(data.user_id, data.selected_date),
        refetchType: 'active', // Only refetch active queries
      });

      // Also invalidate the general reflections query to ensure list refreshes
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
        refetchType: 'active',
      });

      // And invalidate any journal-specific queries
      queryClient.invalidateQueries({
        queryKey: ['journal'],
        refetchType: 'active',
      });

      // Direct refetch as a fallback to ensure UI updates
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: queryKeys.reflections.byDate(data.user_id, data.selected_date),
        });
      }, 100);
    },
  });
};

// Hook for deleting a reflection entry - SIMPLIFIED VERSION
export const useDeleteReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reflectionId: string) => {

      // Direct database call without complex logic
      const result = await ReflectionApi.deleteReflectionEntry(reflectionId);

      return result;
    },
    onSuccess: () => {

      // Simple cache invalidation - no complex optimistic updates
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
      });

      // Emit event to notify other components (like MomentsScreen) to refresh
      try {
        DeviceEventEmitter.emit('reflection_deleted');
      } catch (emitError) {
        Logger.warn('Failed to emit reflection_deleted event', { component: 'useReflectionData', error: emitError as Error });
      }

    },
    onError: (error) => {
      Logger.error('❌ useDeleteReflection: Delete failed', error as Error, { component: 'useReflectionData' });
    },
    // Simple configuration - no retries to avoid complications
    retry: false,
    networkMode: 'online', // Only work when online
  });
};

// Hook for invalidating all reflection data
export const useInvalidateReflectionData = () => {
  const queryClient = useQueryClient();

  const invalidateAllReflectionData = (userId?: string, date?: string) => {
    if (userId && date) {
      // Invalidate specific date
      queryClient.invalidateQueries({
        queryKey: queryKeys.reflections.byDate(userId, date),
      });
    } else {
      // Invalidate all reflection data
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
      });
    }
  };

  return { invalidateAllReflectionData };
};
