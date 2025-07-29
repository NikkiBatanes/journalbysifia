// src/services/hooks/useReflectionData.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { ReflectionApi, ReflectionApiEntry } from '../api/reflectionApi';
import { queryKeys } from '../queryKeys';
import { defaultQueryOptions, defaultMutationOptions, queryOptionsPresets } from '../config/queryConfig';
import { analytics } from '../../utils/analytics';

// Hook for getting reflection entries for a specific date
export const useReflectionData = (userId: string, date: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.byDate(userId, date),
    queryFn: () => ReflectionApi.getReflectionEntries(userId, date),
    ...queryOptionsPresets.realtime,
    enabled: !!userId && !!date,
    initialData: [], // Provide empty array as initial data
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

// Hook for getting devotional reflections
export const useDevotionalReflections = (userId: string, devotionalId: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.devotional(userId, devotionalId),
    queryFn: () => ReflectionApi.getDevotionalReflections(userId, devotionalId),
    ...queryOptionsPresets.stable,
    enabled: !!userId && !!devotionalId,
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
    queryFn: () => ReflectionApi.searchReflections(userId, searchTerm),
    ...defaultQueryOptions,
    enabled: !!userId && !!searchTerm && searchTerm.length > 2,
  });
};

// Hook for getting reflection stats
export const useReflectionStats = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.stats(userId, startDate, endDate),
    queryFn: () => ReflectionApi.getReflectionStats(userId, startDate, endDate),
    ...queryOptionsPresets.background,
    enabled: !!userId && !!startDate && !!endDate,
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
          id: 'temp-' + Date.now(),
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
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.reflections.byDate(variables.user_id, variables.selected_date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reflections.byType(variables.user_id, variables.selected_date, variables.type) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reflections.stats(variables.user_id, variables.selected_date, variables.selected_date) });

      // Invalidate subtask-specific queries if subtask_id is present
      if (variables.subtask_id) {
        queryClient.invalidateQueries({ queryKey: ['reflections', 'subtask', variables.user_id, variables.subtask_id] });
      }

      // Update search results
      queryClient.invalidateQueries({ queryKey: ['reflections', 'search'] });

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
      console.log('🔍 useUpdateReflection: Starting API call', { id, updates });
      return ReflectionApi.updateReflectionEntry(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      // Find the reflection to get user_id and selected_date
      const queries = queryClient.getQueriesData({ queryKey: ['reflections'] });
      let reflectionToUpdate: ReflectionApiEntry | undefined;
      let queryKey: any;

      for (const [key, data] of queries) {
        if (Array.isArray(data)) {
          reflectionToUpdate = data.find((reflection: ReflectionApiEntry) => reflection.id === id);
          if (reflectionToUpdate) {
            queryKey = key;
            break;
          }
        }
      }

      if (reflectionToUpdate && queryKey) {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey });

        // Snapshot the previous value
        const previousReflections = queryClient.getQueryData(queryKey);

        // Optimistically update the reflection
        queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) =>
          old.map(reflection =>
            reflection.id === id
              ? { ...reflection, ...updates, updated_at: new Date().toISOString() }
              : reflection
          )
        );

        return { previousReflections, queryKey, reflectionToUpdate };
      }

      return { id, updates };
    },
    onError: (updateError, { id: _id }, context) => {
      console.error('🔍 useUpdateReflection: API call failed', updateError);
      if (context?.previousReflections && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousReflections);
      }
    },
    onSuccess: (data) => {
      console.log('🔍 useUpdateReflection: API call successful', data);

      // Update the specific reflection in the main query
      const queryKey = queryKeys.reflections.byDate(data.user_id, data.selected_date);
      queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) =>
        old.map(reflection => reflection.id === data.id ? data : reflection)
      );

      // Also update type-specific queries if type is specified
      if (data.type) {
        queryClient.setQueryData(
          queryKeys.reflections.byType(data.user_id, data.selected_date, data.type),
          (old: ReflectionApiEntry[] = []) =>
            old.map(reflection => reflection.id === data.id ? data : reflection)
        );
      }

      // Invalidate subtask-specific queries if subtask_id is present
      if (data.subtask_id) {
        queryClient.invalidateQueries({ queryKey: ['reflections', 'subtask', data.user_id, data.subtask_id] });
      }
    },
  });
};

// Hook for deleting a reflection entry - SIMPLIFIED VERSION
export const useDeleteReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reflectionId: string) => {
      console.log('🗑️ useDeleteReflection: Starting delete for:', reflectionId);

      // Direct database call without complex logic
      const result = await ReflectionApi.deleteReflectionEntry(reflectionId);

      console.log('✅ useDeleteReflection: Delete completed successfully');
      return result;
    },
    onSuccess: () => {
      console.log('🔄 useDeleteReflection: Invalidating cache...');

      // Simple cache invalidation - no complex optimistic updates
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
      });

      console.log('✅ useDeleteReflection: Cache invalidated successfully');
    },
    onError: (error) => {
      console.error('❌ useDeleteReflection: Delete failed:', error);
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
