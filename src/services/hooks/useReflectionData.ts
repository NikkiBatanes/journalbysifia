// src/services/hooks/useReflectionData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReflectionApi, ReflectionApiEntry } from '../api/reflectionApi';
import { queryKeys } from '../queryKeys';

// Hook for getting reflection entries for a specific date
export const useReflectionData = (userId: string, date: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.byDate(userId, date),
    queryFn: () => ReflectionApi.getReflectionEntries(userId, date),
    staleTime: 1000, // 1 second stale time to prevent excessive refetching
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
    refetchOnMount: false, // Don't refetch on mount to prevent loading flash
    initialData: [], // Provide empty array as initial data
  });
};

// Hook for getting reflections by type
export const useReflectionsByType = (userId: string, date: string, type: 'free' | 'guided') => {
  return useQuery({
    queryKey: queryKeys.reflections.byType(userId, date, type),
    queryFn: () => ReflectionApi.getReflectionsByType(userId, date, type),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date && !!type,
  });
};

// Hook for getting devotional reflections
export const useDevotionalReflections = (userId: string, devotionalId: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.devotional(userId, devotionalId),
    queryFn: () => ReflectionApi.getDevotionalReflections(userId, devotionalId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!devotionalId,
  });
};

// Hook for getting reflections in a date range
export const useReflectionsInRange = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.dateRange(userId, startDate, endDate),
    queryFn: () => ReflectionApi.getReflectionsInDateRange(userId, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// Hook for searching reflections
export const useSearchReflections = (userId: string, searchTerm: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.search(userId, searchTerm),
    queryFn: () => ReflectionApi.searchReflections(userId, searchTerm),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!searchTerm && searchTerm.length > 2,
  });
};

// Hook for getting reflection stats
export const useReflectionStats = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reflections.stats(userId, startDate, endDate),
    queryFn: () => ReflectionApi.getReflectionStats(userId, startDate, endDate),
    staleTime: 10 * 60 * 1000, // 10 minutes for stats
    gcTime: 20 * 60 * 1000, // 20 minutes
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// Hook for creating a reflection entry
export const useCreateReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ReflectionApi.createReflectionEntry,
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
    onError: (err, newReflection, context) => {
      console.error('Error creating reflection:', err);
      if (context?.previousReflections) {
        const queryKey = queryKeys.reflections.byDate(newReflection.user_id, newReflection.selected_date);
        queryClient.setQueryData(queryKey, context.previousReflections);
      }
    },
    onSuccess: (data, variables) => {
      console.log('🔍 useCreateReflection: Successfully created reflection', data.id);
      
      // Update cache with the real data instead of invalidating
      const queryKey = queryKeys.reflections.byDate(variables.user_id, variables.selected_date);
      queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) => {
        // Replace the temporary entry with the real one
        return old.map(entry => 
          entry.id.startsWith('temp-') ? data : entry
        );
      });

      // Also update type-specific queries if type is specified
      if (variables.type) {
        queryClient.setQueryData(
          queryKeys.reflections.byType(variables.user_id, variables.selected_date, variables.type),
          (old: ReflectionApiEntry[] = []) => {
            const existingEntry = old.find(entry => entry.id === data.id);
            return existingEntry ? old : [...old, data];
          }
        );
      }
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
    onError: (updateError, { id }, context) => {
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
    },
  });
};

// Hook for deleting a reflection entry
export const useDeleteReflection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ReflectionApi.deleteReflectionEntry,
    onMutate: async (reflectionId: string) => {
      // Find the reflection in cache to get user_id and selected_date
      const queries = queryClient.getQueriesData({ queryKey: ['reflections'] });
      let reflectionToDelete: ReflectionApiEntry | undefined;
      let queryKey: any;

      for (const [key, data] of queries) {
        if (Array.isArray(data)) {
          reflectionToDelete = data.find((reflection: ReflectionApiEntry) => reflection.id === reflectionId);
          if (reflectionToDelete) {
            queryKey = key;
            break;
          }
        }
      }

      if (reflectionToDelete && queryKey) {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey });

        // Snapshot the previous value
        const previousReflections = queryClient.getQueryData(queryKey);

        // Optimistically remove the reflection
        queryClient.setQueryData(queryKey, (old: ReflectionApiEntry[] = []) =>
          old.filter(reflection => reflection.id !== reflectionId)
        );

        return { previousReflections, queryKey, reflectionToDelete };
      }

      return { reflectionId };
    },
    onError: (error, _reflectionId, _context) => {
      console.error('Error deleting reflection:', error);
      if (_context?.previousReflections && _context?.queryKey) {
        queryClient.setQueryData(_context.queryKey, _context.previousReflections);
      }
    },
    onSuccess: (_, _reflectionId, _context) => {
      // Invalidate all reflection queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['reflections'],
      });
    },
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
