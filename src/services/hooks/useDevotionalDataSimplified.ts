import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DevotionalApi } from '../api/devotionalApi';
import { DevotionalApiEntry } from '../api/devotionalApi';
import { Devotional, DevotionalCreationParams } from '../../interfaces/devotional';
// import { analytics } from '../analytics'; // TODO: Fix analytics import

// Query keys factory
const queryKeys = {
  devotionals: {
    all: ['devotionals'] as const,
    list: (userId: string) => [...queryKeys.devotionals.all, 'list', userId] as const,
    detail: (userId: string, id: string) => [...queryKeys.devotionals.all, 'detail', userId, id] as const,
  },
};

// Data transformer
const transformApiEntryToDevotional = (apiEntry: DevotionalApiEntry): Devotional => ({
  id: apiEntry.id,
  userId: apiEntry.user_id,
  title: apiEntry.title,
  description: apiEntry.description,
  category: (apiEntry.category as any) || 'Growth',
  categories: apiEntry.categories || [apiEntry.category || 'Growth'],
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
  ratedAt: apiEntry.rated_at,
  feedback: apiEntry.feedback,
  createdAt: apiEntry.created_at,
  updatedAt: apiEntry.updated_at,
});

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
      console.log('[useDevotionalDataReactQuery] Fetching devotionals for user:', userId);
      const apiEntries = await DevotionalApi.getDevotionals(userId);
      return apiEntries.map(transformApiEntryToDevotional);
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
  return useQuery({
    queryKey: queryKeys.devotionals.detail(userId, id),
    queryFn: async () => {
      console.log('[useDevotionalByIdReactQuery] Fetching devotional:', id);
      
      // Validate UUID format before making API call
      if (!isValidUUID(id)) {
        console.warn('[useDevotionalByIdReactQuery] Invalid UUID format, skipping API call:', id);
        return null;
      }
      const apiEntry = await DevotionalApi.getDevotionalById(id);
      return apiEntry ? transformApiEntryToDevotional(apiEntry) : null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!id && !!userId && isValidUUID(id),
    retry: 3,
  });
};

/**
 * Create a new devotional
 */
export const useCreateDevotionalReactQuery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ params, userId }: { params: DevotionalCreationParams; userId: string }) => {
      console.log('[useCreateDevotionalReactQuery] Creating devotional:', params.duration, 'days');
      const devotional = await DevotionalApi.generateDevotional(params);
      return devotional;
    },
    onSuccess: (data, { userId }) => {
      console.log('[useCreateDevotionalReactQuery] Success:', data.id);
      
      // Invalidate and refetch devotionals list
      queryClient.invalidateQueries({
        queryKey: queryKeys.devotionals.list(userId),
      });

      // Analytics tracking removed for now
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
export const useMarkDayCompleteReactQuery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ devotionalId, dayNumber }: {
      devotionalId: string;
      dayNumber: number;
      userId: string;
    }) => {
      console.log('[useMarkDayCompleteReactQuery] Marking day complete:', { devotionalId, dayNumber });
      const apiEntry = await DevotionalApi.markDayComplete(devotionalId, dayNumber);
      return transformApiEntryToDevotional(apiEntry);
    },
    onSuccess: (data, { devotionalId, dayNumber, userId }) => {
      console.log('[useMarkDayCompleteReactQuery] Success:', { devotionalId, dayNumber });
      
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
      console.log('[useSubmitDevotionalRatingReactQuery] Submitting rating:', { devotionalId, rating });
      const apiEntry = await DevotionalApi.submitRating(devotionalId, rating);
      return transformApiEntryToDevotional(apiEntry);
    },
    onSuccess: (data, { devotionalId, rating, userId }) => {
      console.log('[useSubmitDevotionalRatingReactQuery] Success:', { devotionalId, rating });
      
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
      console.log('[useDeleteDevotionalReactQuery] Deleting devotional:', devotionalId);
      await DevotionalApi.deleteDevotional(devotionalId);
    },
    onSuccess: (_, { devotionalId, userId }) => {
      console.log('[useDeleteDevotionalReactQuery] Success:', devotionalId);
      
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
  const markDayCompleteMutation = useMarkDayCompleteReactQuery();
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
    // TODO: Implement playbook fetching if needed
    console.log('fetchPlaybookById called with:', playbookId);
    return null;
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
