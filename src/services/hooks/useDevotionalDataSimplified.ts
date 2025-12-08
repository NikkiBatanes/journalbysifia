import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Logger } from '../../utils/ProductionLogger';
import { DeviceEventEmitter } from 'react-native';
import { DevotionalApi } from '../api/devotionalApi';
import type { DevotionalApiEntry } from '../api/devotionalApi';
// import { defaultQueryOptions, defaultMutationOptions } from '../config/queryConfig'; // Unused
import { Devotional, DevotionalCreationParams, DevotionalCategory } from '../../interfaces/devotional';
// import { useAuth } from '../../context/IndustryStandardAuthContext'; // Unused
import { notificationService } from '../notificationService';
import { faithPointsService } from '../faithPointsService';
import { useCrossComponentSync } from './useCrossComponentSync';
// import { analytics } from '../analytics'; // TODO: Fix analytics import

// Query keys factory
const queryKeys = {
  devotionals: {
    all: ['devotionals'] as const,
    list: (userId: string) => [...queryKeys.devotionals.all, 'list', userId] as const,
    detail: (userId: string, id: string) => [...queryKeys.devotionals.all, 'detail', userId, id] as const,
  },
};

// Helper function to determine appropriate category based on content
const determineDevotionalCategory = (apiEntry: DevotionalApiEntry): DevotionalCategory => {
  // If category is already set and not the default 'Growth', use it
  if (apiEntry.category && apiEntry.category !== 'Growth') {
    return apiEntry.category as DevotionalCategory;
  }

  // Analyze title and description for category hints
  const content = `${apiEntry.title || ''} ${apiEntry.description || ''}`.toLowerCase();

  if (content.includes('prayer') || content.includes('pray')) {return 'Prayer';}
  if (content.includes('love') || content.includes('relationship') || content.includes('family')) {return 'Relationships';}
  if (content.includes('anxiety') || content.includes('worry') || content.includes('stress') || content.includes('mental')) {return 'Mental Health';}
  if (content.includes('wisdom') || content.includes('decision') || content.includes('guidance')) {return 'Wisdom';}
  if (content.includes('purpose') || content.includes('calling') || content.includes('mission')) {return 'Purpose';}
  if (content.includes('heal') || content.includes('recovery') || content.includes('restoration')) {return 'Healing';}
  if (content.includes('career') || content.includes('work') || content.includes('job')) {return 'Career';}
  if (content.includes('money') || content.includes('financial') || content.includes('finances')) {return 'Finances';}
  if (content.includes('parent') || content.includes('child') || content.includes('kids')) {return 'Parenting';}
  if (content.includes('health') || content.includes('physical') || content.includes('body')) {return 'Health';}

  // Default to 'Growth' for spiritual growth, faith, hope, etc.
  return 'Growth';
};

// Data transformer
const transformApiEntryToDevotional = (apiEntry: DevotionalApiEntry): Devotional => {
  const category = determineDevotionalCategory(apiEntry);

  return {
    id: apiEntry.id,
    userId: apiEntry.user_id,
    title: apiEntry.title,
    description: apiEntry.description,
    category,
    categories: apiEntry.categories || [category],
    playbookId: apiEntry.playbook_id,
    playbookTitle: apiEntry.playbook_title,
    userInput: apiEntry.user_input,
    totalDays: apiEntry.total_days,
    currentDay: apiEntry.current_day,
    progress: apiEntry.progress,
    completed: apiEntry.completed,
    completedAt: apiEntry.completed_at,
    days: apiEntry.days || [],
    rating: apiEntry.rating,
    feedback: apiEntry.feedback,
    createdAt: apiEntry.created_at,
    updatedAt: apiEntry.updated_at,
  };
};

/**
 * Fetch all devotionals for a user
 */
// Helper function to validate UUID format
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const useDevotionalDataReactQuery = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.devotionals.list(userId),
    queryFn: async () => {

      const apiEntries = await DevotionalApi.getDevotionals(userId);
      const transformed = apiEntries.map(transformApiEntryToDevotional);

      // Debug logging for simulator issue

      return transformed;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!userId,
    retry: 3,
  });
};

/**
 * Fetch a single devotional by ID
 */
export const useDevotionalByIdReactQuery = (userId: string, id: string) => {
  const queryEnabled = !!id && !!userId && isValidUUID(id);

  const result = useQuery({
    queryKey: queryKeys.devotionals.detail(userId, id),
    queryFn: async () => {

      if (!isValidUUID(id)) {

        return null;
      }

      try {

        const apiEntry = await DevotionalApi.getDevotionalById(id);

        const transformed = apiEntry ? transformApiEntryToDevotional(apiEntry) : null;

        return transformed;
      } catch (error) {
        Logger.error('[useDevotionalByIdReactQuery] API error', error as Error, {
      component: 'useDevotionalDataSimplified',
    });
        throw error;
      }
    },
    staleTime: 0, // Force fresh data temporarily
    gcTime: 0, // No cache temporarily
    enabled: queryEnabled,
    retry: 3,
    refetchOnMount: true, // Force refetch temporarily
    refetchOnWindowFocus: false,
  });

  return result;
};

/**
 * Create a new devotional
 */
export const useCreateDevotionalReactQuery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ params, userId: _userId }: { params: DevotionalCreationParams; userId: string }) => {

      const devotional = await DevotionalApi.generateDevotional(params);
      return devotional;
    },
    onSuccess: (data, { userId: _userId }) => {

      // Invalidate and refetch devotionals list
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(_userId),
      });

      // Invalidate devotionals queries to trigger reflection questions update
      queryClient.invalidateQueries({
        queryKey: ['devotionals'],
      });

      // Use setQueryData for immediate updates without triggering re-renders
      queryClient.setQueryData(['devotionals', _userId], (oldData: any) => {
        if (!oldData) {return [data];}
        return [data, ...oldData];
      });

      // Delayed refetch to ensure data consistency without navigation conflicts
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ['devotionals'],
        });
      }, 1000);

      // Emit local event so non-React-Query consumers (e.g., DevotionalCarousel) refresh instantly
      try {
        DeviceEventEmitter.emit('devotional_created', { id: data.id, user_id: data.userId || _userId });
      } catch {}

      // Analytics tracking removed for now

      // Show Faith Points UI for devotional generation (do not rely on server-side triggers)
      try {
        const pts = faithPointsService.getPointsForActivity('devotional_generated');
        notificationService.showPointsNotification(pts, 'devotional_generated', 'center');
      } catch (e) {

      }
    },
    onError: (err: Error) => {
      Logger.error('[useCreateDevotionalReactQuery] Error', err as Error, {
      component: 'useDevotionalDataSimplified',
    });
      // Analytics tracking removed for now
    },
  });
};

/**
 * Mark a devotional day as complete
 */
export const useMarkDayCompleteReactQuery = (userId: string) => {
  const queryClient = useQueryClient();
  const { syncDevotionalCompletion } = useCrossComponentSync(userId);

  return useMutation({
    mutationFn: async ({ devotionalId, dayNumber }: {
      devotionalId: string;
      dayNumber: number;
      userId: string;
    }) => {

      const apiEntry = await DevotionalApi.markDayComplete(devotionalId, dayNumber);
      return transformApiEntryToDevotional(apiEntry);
    },
    onMutate: async ({ devotionalId, dayNumber, userId: mutationUserId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.devotionals.list(mutationUserId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.devotionals.detail(mutationUserId, devotionalId) });

      // Snapshot the previous values
      const previousDevotionals = queryClient.getQueryData(queryKeys.devotionals.list(mutationUserId));
      const previousDevotionalDetail = queryClient.getQueryData(queryKeys.devotionals.detail(mutationUserId, devotionalId));

      // Optimistically update the cache by marking the day as complete
      queryClient.setQueryData(queryKeys.devotionals.list(mutationUserId), (old: any) => {
        if (!Array.isArray(old)) {return old;}

        return old.map((devotional: any) => {
          if (devotional.id === devotionalId) {
            // Update the specific day to completed
            const updatedDays = devotional.days.map((day: any, index: number) =>
              index === dayNumber - 1 ? { ...day, completed: true } : day
            );

            // Check if this makes the entire devotional complete
            const completedDaysCount = updatedDays.filter((day: any) => day.completed).length;
            const isComplete = completedDaysCount === devotional.totalDays;

            return {
              ...devotional,
              days: updatedDays,
              completed: isComplete,
              updatedAt: new Date().toISOString(),
            };
          }
          return devotional;
        });
      });

      // Also optimistically update the individual devotional detail query
      queryClient.setQueryData(queryKeys.devotionals.detail(mutationUserId, devotionalId), (old: any) => {
        if (!old || !old.days) {return old;}

        // Update the specific day to completed
        const updatedDays = old.days.map((day: any, index: number) =>
          index === dayNumber - 1 ? { ...day, completed: true } : day
        );

        // Check if this makes the entire devotional complete
        const completedDaysCount = updatedDays.filter((day: any) => day.completed).length;
        const isComplete = completedDaysCount === old.totalDays;

        return {
          ...old,
          days: updatedDays,
          completed: isComplete,
          updatedAt: new Date().toISOString(),
        };
      });

      // Return a context object with the snapshotted values
      return { previousDevotionals, previousDevotionalDetail };
    },
    onSuccess: async (data, { devotionalId, dayNumber, userId: mutationUserId }) => {

      // ENTERPRISE-GRADE: Trigger cross-component sync immediately in background without blocking
      // All heavy operations (DB writes, invalidations) are already deferred internally
      try {
        // Check if this completion makes the entire devotional complete
        const completedDaysCount = data.days.filter(day => day.completed).length;
        const isFullDevotionalComplete = completedDaysCount === data.totalDays;

        syncDevotionalCompletion(
          devotionalId,
          undefined, // playbookId - not available in this context
          {
            isFullDevotionalComplete,
            completedDaysCount,
            totalDays: data.totalDays,
            currentDay: dayNumber,
          }
        ).catch((syncError: Error) => {
          Logger.error('[useMarkDayCompleteReactQuery] Sync error', syncError as Error, {
            component: 'useDevotionalDataSimplified',
          });
        });

      } catch (syncError) {
        Logger.error('[useMarkDayCompleteReactQuery] Sync error', syncError as Error, {
          component: 'useDevotionalDataSimplified',
        });
      }

      // Update cache with the latest server data to ensure consistency
      queryClient.setQueryData(queryKeys.devotionals.list(mutationUserId), (old: any) => {
        if (!Array.isArray(old)) {return old;}

        return old.map((devotional: any) => {
          if (devotional.id === devotionalId) {
            return data; // Use the server response for the updated devotional
          }
          return devotional;
        });
      });

      // Also update the individual devotional detail query
      queryClient.setQueryData(queryKeys.devotionals.detail(mutationUserId, devotionalId), data);

      // Analytics tracking removed for now
    },
    onError: (error: Error, { userId: mutationUserId, devotionalId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDevotionals) {
        queryClient.setQueryData(queryKeys.devotionals.list(mutationUserId), context.previousDevotionals);
      }
      if (context?.previousDevotionalDetail) {
        queryClient.setQueryData(queryKeys.devotionals.detail(mutationUserId, devotionalId), context.previousDevotionalDetail);
      }

      Logger.error('[useMarkDayCompleteReactQuery] Error', error as Error, {
        component: 'useDevotionalDataSimplified',
      });
    },
  });
};

/**
 * Submit devotional rating
 */
export const useSubmitDevotionalRatingReactQuery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ devotionalId, rating }: {
      devotionalId: string;
      rating: number;
      userId: string;
    }) => {

      const apiEntry = await DevotionalApi.submitRating(devotionalId, rating);
      return transformApiEntryToDevotional(apiEntry);
    },
    onMutate: async ({ devotionalId, rating, userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.devotionals.list(userId) });

      // Snapshot the previous value
      const previousDevotionals = queryClient.getQueryData(queryKeys.devotionals.list(userId));

      // Optimistically update the cache by adding the rating
      queryClient.setQueryData(queryKeys.devotionals.list(userId), (old: any) => {
        if (!Array.isArray(old)) {return old;}

        return old.map((devotional: any) => {
          if (devotional.id === devotionalId) {
            return {
              ...devotional,
              rating,
              updatedAt: new Date().toISOString(),
            };
          }
          return devotional;
        });
      });

      // Return a context object with the snapshotted value
      return { previousDevotionals };
    },
    onSuccess: (data, { devotionalId, rating: _rating, userId }) => {

      // CRITICAL FIX: Only update cache optimistically, don't invalidate
      queryClient.setQueryData(queryKeys.devotionals.list(userId), (old: any) => {
        if (!Array.isArray(old)) {return old;}

        return old.map((devotional: any) => {
          if (devotional.id === devotionalId) {
            return data; // Use the server response for the updated devotional
          }
          return devotional;
        });
      });

      // Analytics tracking removed for now
    },
    onError: (error: Error, { userId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDevotionals) {
        queryClient.setQueryData(queryKeys.devotionals.list(userId), context.previousDevotionals);
      }

      Logger.error('[useSubmitDevotionalRatingReactQuery] Error', error as Error, {
        component: 'useDevotionalDataSimplified',
      });
    },
  });
};

/**
 * Delete devotional
 */
export const useDeleteDevotionalReactQuery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ devotionalId }: {
      devotionalId: string;
      userId: string;
    }) => {

      await DevotionalApi.deleteDevotional(devotionalId);
    },
    onMutate: async ({ devotionalId, userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.devotionals.list(userId) });

      // Snapshot the previous value
      const previousDevotionals = queryClient.getQueryData(queryKeys.devotionals.list(userId));

      // Optimistically update the cache by removing the deleted devotional
      queryClient.setQueryData(queryKeys.devotionals.list(userId), (old: any) => {
        if (!Array.isArray(old)) {return old;}
        return old.filter((devotional: any) => devotional.id !== devotionalId);
      });

      // Return a context object with the snapshotted value
      return { previousDevotionals };
    },
    onSuccess: (_, { devotionalId: _devotionalId, userId }) => {

      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(userId),
      });

    },
    onError: (error: Error, { userId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDevotionals) {
        queryClient.setQueryData(queryKeys.devotionals.list(userId), context.previousDevotionals);
      }

      Logger.error('[useDeleteDevotionalReactQuery] Error', error as Error, {
      component: 'useDevotionalDataSimplified',
    });
    },
  });
};

/**
 * Unified operations hook that replaces DevotionalContext
 */
export const useDevotionalOperations = (userId: string) => {
  const { data: devotionals = [], isLoading, error, refetch } = useDevotionalDataReactQuery(userId);
  const createMutation = useCreateDevotionalReactQuery();
  const markDayCompleteMutation = useMarkDayCompleteReactQuery(userId);
  const submitRatingMutation = useSubmitDevotionalRatingReactQuery();
  const deleteMutation = useDeleteDevotionalReactQuery();

  const createDevotional = async (params: DevotionalCreationParams) => {
    return createMutation.mutateAsync({ params, userId });
  };

  const markDayComplete = async (devotionalId: string, dayNumber: number) => {
    return markDayCompleteMutation.mutateAsync({ devotionalId, dayNumber, userId });
  };

  const submitDevotionalRating = async (devotionalId: string, rating: number) => {
    return submitRatingMutation.mutateAsync({ devotionalId, rating, userId });
  };

  const deleteDevotional = async (devotionalId: string) => {
    return deleteMutation.mutateAsync({ devotionalId, userId });
  };

  const fetchPlaybookById = async (playbookId: string) => {
    try {

      // Import the playbook API function
      const { getPlaybooks } = await import('../apiIntegration');

      // Get all playbooks and find the specific one
      const playbooks = await getPlaybooks(userId, { lightweight: false });
      const playbook = playbooks.find(p => p.id === playbookId);

      if (!playbook) {
        Logger.warn('[useDevotionalOperations] Playbook not found', {
      component: 'useDevotionalDataSimplified',
      data: playbookId,
    });
        return null;
      }

      return playbook;
    } catch (catchError) {
      Logger.error('[useDevotionalOperations] Error fetching playbook', catchError as Error, {
  component: 'useDevotionalDataSimplified',
});
      return null;
    }
  };

  return {
    devotionals,
    isLoading,
    error,
    refetch,
    createDevotional,
    markDayComplete,
    submitDevotionalRating,
    deleteDevotional,
    // Mutation loading states
    isCreating: createMutation.isPending,
    isMarkingComplete: markDayCompleteMutation.isPending,
    isSubmittingRating: submitRatingMutation.isPending,
    isDeleting: deleteMutation.isPending,
    fetchPlaybookById,
  };
};
