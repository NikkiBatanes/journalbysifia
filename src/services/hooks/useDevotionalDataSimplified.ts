import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        console.error('[useDevotionalByIdReactQuery] API error:', error);
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
      console.error('[useCreateDevotionalReactQuery] Error:', err);
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
    onSuccess: async (data, { devotionalId, dayNumber, userId: _completionUserId }) => {

      // Trigger cross-component sync to award faith points and update dashboard
      try {
        // Check if this completion makes the entire devotional complete
        const completedDaysCount = data.days.filter(day => day.completed).length;
        const isFullDevotionalComplete = completedDaysCount === data.totalDays;

        const syncResult = await syncDevotionalCompletion(devotionalId, undefined, {
          isFullDevotionalComplete,
          completedDaysCount,
          totalDays: data.totalDays,
          currentDay: dayNumber,
        });

      } catch (syncError) {
        console.error('[useMarkDayCompleteReactQuery] Sync error:', syncError);
      }

      // Only invalidate the list query to update dashboard, NOT the detail query
      // to prevent re-renders while the modal is open
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(userId),
      });

      // Use setQueryData to update the detail query data without triggering re-renders
      // This prevents the modal from reopening due to query invalidation
      queryClient.setQueryData(
        queryKeys.devotionals.detail(userId, devotionalId),
        (oldData: any) => {
          if (!oldData) {return oldData;}

          // Update the specific day's completed status
          const updatedDays = oldData.days.map((day: any, _index: number) => {
            if (day.dayNumber === dayNumber) {
              return { ...day, completed: true };
            }
            return day;
          });

          return { ...oldData, days: updatedDays };
        }
      );

      // Analytics tracking removed for now
    },
    onError: (error: Error) => {
      console.error('[useMarkDayCompleteReactQuery] Error:', error);
      // Analytics tracking removed for now
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
    onSuccess: (data, { devotionalId, rating, userId }) => {

      // Update list query cache (invalidate to refresh)
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(userId),
      });

      // Update detail query cache directly to prevent modal reset
      queryClient.setQueryData(
        queryKeys.devotionals.detail(userId, devotionalId),
        (oldData: any) => {
          if (oldData) {
            return { ...oldData, rating };
          }
          return oldData;
        }
      );

      // Analytics tracking removed for now
    },
    onError: (error: Error) => {
      console.error('[useSubmitDevotionalRatingReactQuery] Error:', error);
      // Analytics tracking removed for now
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
    onSuccess: (_, { devotionalId, userId }) => {

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.detail(userId, devotionalId),
      });

      // Analytics tracking removed for now
    },
    onError: (error: Error) => {
      console.error('[useDeleteDevotionalReactQuery] Error:', error);
      // Analytics tracking removed for now
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
      const playbooks = await getPlaybooks(userId);
      const playbook = playbooks.find(p => p.id === playbookId);

      if (!playbook) {
        console.warn('[useDevotionalOperations] Playbook not found:', playbookId);
        return null;
      }

      return playbook;
    } catch (catchError) {
      console.error('[useDevotionalOperations] Error fetching playbook:', catchError);
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
