// src/services/hooks/useDevotionalData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DevotionalApi, DevotionalApiEntry } from '../api/devotionalApi';
import { DevotionalCreationParams } from '../../interfaces/devotional';
import { queryKeys } from '../queryKeys';

// ===== QUERY HOOKS =====

/**
 * Get all devotionals for a user
 */
export const useDevotionalData = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.devotionals.list(userId),
    queryFn: () => DevotionalApi.getDevotionals(userId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userId,
  });
};

/**
 * Get a specific devotional by ID
 */
export const useDevotionalById = (id: string) => {
  return useQuery({
    queryKey: queryKeys.devotionals.detail('', id), // userId not needed for detail lookup
    queryFn: () => DevotionalApi.getDevotionalById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
};

/**
 * Get playbook by ID (for devotional creation)
 */
export const usePlaybookById = (id: string) => {
  return useQuery({
    queryKey: queryKeys.playbooks.detail('', id), // userId not needed for playbook lookup
    queryFn: () => DevotionalApi.getPlaybookById(id),
    staleTime: 30 * 60 * 1000, // 30 minutes (playbooks don't change often)
    enabled: !!id,
  });
};

// ===== MUTATION HOOKS =====

/**
 * Create a new devotional
 */
export const useCreateDevotional = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ params, _userId }: { params: DevotionalCreationParams; _userId: string }) =>
      DevotionalApi.generateDevotional(params),
    onMutate: async ({ params, _userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });

      // Snapshot the previous value
      const previousDevotionals = queryClient.getQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(_userId)
      );

      // Create optimistic devotional
      const optimisticDevotional: DevotionalApiEntry = {
        id: `temp-${Date.now()}`,
        user_id: _userId,
        title: params.title || 'New Devotional',
        description: params.description || '',
        total_days: params.duration,
        current_day: 1,
        progress: 0,
        completed: false,
        days: Array.from({ length: params.duration }, (_, i) => ({
          dayNumber: i + 1,
          title: `Day ${i + 1}`,
          content: 'Loading...',
          completed: false,
        })),
        playbook_id: params.playbookId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update the cache
      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(_userId),
        (old = []) => [optimisticDevotional, ...old]
      );

      return { previousDevotionals, optimisticDevotional };
    },
    onError: (err: Error, { _userId }, context) => {
      console.error('Error creating devotional:', err);
      // Rollback on error
      if (context?.previousDevotionals) {
        queryClient.setQueryData(
          queryKeys.devotionals.list(_userId),
          context.previousDevotionals
        );
      }
    },
    onSuccess: (data, { _userId }) => {
      // Update the cache with the real data
      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId),
        (old = []) => {
          // Replace the optimistic entry with the real one
          return old.map(item =>
            item.id.startsWith('temp-') ? data as any : item
          );
        }
      );
    },
    onSettled: (data, error, { _userId }) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
    },
  });
};

/**
 * Update a devotional
 */
export const useUpdateDevotional = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
      _userId,
    }: {
      id: string;
      updates: Partial<Omit<DevotionalApiEntry, 'id' | 'user_id' | 'created_at'>>;
      _userId: string;
    }) => DevotionalApi.updateDevotional(id, updates),
    onMutate: async ({ id, updates, _userId }) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.detail(userId, id),
      });

      // Snapshot previous values
      const previousDevotionals = queryClient.getQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId)
      );
      const previousDevotional = queryClient.getQueryData<DevotionalApiEntry>(
        queryKeys.devotionals.detail(userId, id)
      );

      // Optimistically update list
      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId),
        (old = []) => old.map(devotional =>
          devotional.id === id
            ? { ...devotional, ...updates, updated_at: new Date().toISOString() }
            : devotional
        )
      );

      // Optimistically update detail
      if (previousDevotional) {
        queryClient.setQueryData(
          queryKeys.devotionals.detail(userId, id),
          { ...previousDevotional, ...updates, updated_at: new Date().toISOString() }
        );
      }

      return { previousDevotionals, previousDevotional };
    },
    onError: (err: Error, { id, userId }, context) => {
      console.error(`Error updating devotional ${id}:`, err);
      // Rollback on error
      if (context?.previousDevotionals) {
        queryClient.setQueryData(
          queryKeys.devotionals.list(_userId),
          context.previousDevotionals
        );
      }
      if (context?.previousDevotional) {
        queryClient.setQueryData(
          queryKeys.devotionals.detail(userId, id),
          context.previousDevotional
        );
      }
    },
    onSettled: (data, error: Error | null, { id, userId }) => {
      if (error) {
        console.error('Error in devotional operation:', error);
      }
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.detail(userId, id),
      });
    },
  });
};

/**
 * Mark a devotional day as complete
 */
export const useMarkDayComplete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      devotionalId,
      dayNumber,
      _userId,
    }: {
      devotionalId: string;
      dayNumber: number;
      _userId: string;
    }) => DevotionalApi.markDayComplete(devotionalId, dayNumber),
    onMutate: async ({ devotionalId, dayNumber, _userId }) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.detail(userId, devotionalId),
      });

      // Get current devotional
      const currentDevotional = queryClient.getQueryData<DevotionalApiEntry>(
        queryKeys.devotionals.detail(userId, devotionalId)
      );

      if (!currentDevotional) {return;}

      // Calculate optimistic updates
      const updatedDays = [...currentDevotional.days];
      const dayIndex = dayNumber - 1;

      if (dayIndex >= 0 && dayIndex < updatedDays.length) {
        updatedDays[dayIndex] = {
          ...updatedDays[dayIndex],
          completed: true,
          completedAt: new Date().toISOString(),
        };
      }

      const completedDays = updatedDays.filter(day => day.completed).length;
      const progress = Math.round((completedDays / currentDevotional.total_days) * 100);
      const allCompleted = completedDays === currentDevotional.total_days;

      const optimisticUpdates = {
        days: updatedDays,
        current_day: allCompleted ? currentDevotional.total_days : Math.min(dayNumber + 1, currentDevotional.total_days),
        progress,
        completed: allCompleted,
        updated_at: new Date().toISOString(),
      };

      // Optimistically update caches
      const updatedDevotional = { ...currentDevotional, ...optimisticUpdates };

      queryClient.setQueryData(
        queryKeys.devotionals.detail(userId, devotionalId),
        updatedDevotional
      );

      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId),
        (old = []) => old.map(d => d.id === devotionalId ? updatedDevotional : d)
      );

      return { previousDevotional: currentDevotional };
    },
    onError: (err: Error, { devotionalId, userId }, context) => {
      console.error(`Error marking day complete for devotional ${devotionalId}:`, err);
      // Rollback on error
      if (context?.previousDevotional) {
        queryClient.setQueryData(
          queryKeys.devotionals.detail(userId, devotionalId),
          context.previousDevotional
        );
        queryClient.setQueryData<DevotionalApiEntry[]>(
          queryKeys.devotionals.list(_userId),
          (old = []) => old.map(d => d.id === devotionalId ? context.previousDevotional! : d)
        );
      }
    },
    onSettled: (data, error: Error | null, { devotionalId, userId }) => {
      if (error) {
        console.error('Error in day completion operation:', error);
      }
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.detail(userId, devotionalId),
      });
    },
  });
};

/**
 * Submit a devotional rating
 */
export const useSubmitDevotionalRating = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      devotionalId,
      rating,
      _userId,
    }: {
      devotionalId: string;
      rating: number;
      _userId: string;
    }) => DevotionalApi.submitRating(devotionalId, rating),
    onMutate: async ({ devotionalId, rating, _userId }) => {
      // Optimistic update similar to other mutations
      const ratingUpdates = {
        rating,
        rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update caches optimistically
      queryClient.setQueryData<DevotionalApiEntry>(
        queryKeys.devotionals.detail(userId, devotionalId),
        (old) => old ? { ...old, ...ratingUpdates } : old
      );

      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId),
        (old = []) => old.map(d => d.id === devotionalId ? { ...d, ...ratingUpdates } : d)
      );
    },
    onSettled: (data, error: Error | null, { devotionalId, userId }) => {
      if (error) {
        console.error('Error in rating submission:', error);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.detail(userId, devotionalId),
      });
    },
  });
};

/**
 * Delete a devotional
 */
export const useDeleteDevotional = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      _userId,
    }: {
      id: string;
      _userId: string;
    }) => DevotionalApi.deleteDevotional(id),
    onMutate: async ({ id, _userId }) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });

      // Snapshot previous value
      const previousDevotionals = queryClient.getQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId)
      );

      // Optimistically remove from list
      queryClient.setQueryData<DevotionalApiEntry[]>(
        queryKeys.devotionals.list(userId),
        (old = []) => old.filter(devotional => devotional.id !== id)
      );

      // Remove from detail cache
      queryClient.removeQueries({
        queryKey: queryKeys.devotionals.detail(userId, id),
      });

      return { previousDevotionals };
    },
    onError: (err: Error, { _userId }, context) => {
      console.error('Error deleting devotional:', err);
      // Rollback on error
      if (context?.previousDevotionals) {
        queryClient.setQueryData(
          queryKeys.devotionals.list(_userId),
          context.previousDevotionals
        );
      }
    },
    onSettled: (data, error: Error | null, { _userId }) => {
      if (error) {
        console.error('Error in devotional deletion:', error);
      }
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });
    },
  });
};
