import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DevotionalApi } from '../api/devotionalApi';
import { queryKeys as globalQueryKeys } from '../queryKeys';
import { defaultQueryOptions, defaultMutationOptions } from '../config/queryConfig';
import { Devotional, DevotionalCreationParams, DevotionalCategory } from '../../interfaces/devotional';
import { useAuth } from '../../context/IndustryStandardAuthContext';
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
  
  if (content.includes('prayer') || content.includes('pray')) return 'Prayer';
  if (content.includes('faith') || content.includes('trust') || content.includes('believe')) return 'Faith';
  if (content.includes('love') || content.includes('relationship') || content.includes('family')) return 'Relationships';
  if (content.includes('peace') || content.includes('anxiety') || content.includes('worry') || content.includes('stress')) return 'Peace';
  if (content.includes('hope') || content.includes('encouragement') || content.includes('strength')) return 'Hope';
  if (content.includes('wisdom') || content.includes('decision') || content.includes('guidance')) return 'Wisdom';
  if (content.includes('forgiveness') || content.includes('forgive') || content.includes('mercy')) return 'Forgiveness';
  if (content.includes('gratitude') || content.includes('thankful') || content.includes('blessing')) return 'Gratitude';
  if (content.includes('purpose') || content.includes('calling') || content.includes('mission')) return 'Purpose';
  
  // Default to 'Spiritual Growth' instead of just 'Growth'
  return 'Spiritual Growth';
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
      console.log('[useDevotionalDataReactQuery] Fetching devotionals for user:', userId);
      const apiEntries = await DevotionalApi.getDevotionals(userId);
      const transformed = apiEntries.map(transformApiEntryToDevotional);
      
      // Debug logging for simulator issue
      console.log('[useDevotionalDataReactQuery] Transformed devotionals:', transformed.map(d => ({
        id: d.id,
        idType: typeof d.id,
        idLength: d.id?.length,
        title: d.title?.substring(0, 50),
        platform: require('react-native').Platform.OS,
      })));
      
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
  
  console.log('[useDevotionalByIdReactQuery] Hook called:', { userId, id, queryEnabled });
  
  const result = useQuery({
    queryKey: queryKeys.devotionals.detail(userId, id),
    queryFn: async () => {
      console.log('[useDevotionalByIdReactQuery] Query function executing');
      if (!isValidUUID(id)) {
        console.log('[useDevotionalByIdReactQuery] Invalid UUID, returning null');
        return null;
      }
      
      try {
        console.log('[useDevotionalByIdReactQuery] Calling API...');
        const apiEntry = await DevotionalApi.getDevotionalById(id);
        console.log('[useDevotionalByIdReactQuery] API result:', apiEntry ? 'found' : 'null');
        const transformed = apiEntry ? transformApiEntryToDevotional(apiEntry) : null;
        console.log('[useDevotionalByIdReactQuery] Transformed result:', transformed ? 'success' : 'null');
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
  
  console.log('[useDevotionalByIdReactQuery] Query state:', {
    data: result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    status: result.status,
    fetchStatus: result.fetchStatus
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
      console.log('[useCreateDevotionalReactQuery] Creating devotional:', params.duration, 'days');
      const devotional = await DevotionalApi.generateDevotional(params);
      return devotional;
    },
    onSuccess: (data, { userId: _userId }) => {
      console.log('[useCreateDevotionalReactQuery] Success:', data.id);

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
        if (!oldData) return [data];
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
      console.log('[useMarkDayCompleteReactQuery] Marking day complete:', { devotionalId, dayNumber });
      const apiEntry = await DevotionalApi.markDayComplete(devotionalId, dayNumber);
      return transformApiEntryToDevotional(apiEntry);
    },
    onSuccess: async (data, { devotionalId, dayNumber, userId: _completionUserId }) => {
      console.log('[useMarkDayCompleteReactQuery] Success:', { devotionalId, dayNumber });

      // Trigger cross-component sync to award faith points and update dashboard
      try {
        await syncDevotionalCompletion(devotionalId);
        console.log('[useMarkDayCompleteReactQuery] Cross-component sync completed');
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
          if (!oldData) return oldData;
          
          // Update the specific day's completed status
          const updatedDays = oldData.days.map((day: any, index: number) => {
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
      console.log('[useSubmitDevotionalRatingReactQuery] Submitting rating:', { devotionalId, rating });
      const apiEntry = await DevotionalApi.submitRating(devotionalId, rating);
      return transformApiEntryToDevotional(apiEntry);
    },
    onSuccess: (data, { devotionalId, rating, userId }) => {
      console.log('[useSubmitDevotionalRatingReactQuery] Success:', { devotionalId, rating });

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
      console.log('[useDevotionalOperations] Fetching playbook by ID:', playbookId);
      
      // Import the playbook API function
      const { getPlaybooks } = await import('../apiIntegration');
      
      // Get all playbooks and find the specific one
      const playbooks = await getPlaybooks(userId);
      const playbook = playbooks.find(p => p.id === playbookId);
      
      if (!playbook) {
        console.warn('[useDevotionalOperations] Playbook not found:', playbookId);
        return null;
      }
      
      console.log('[useDevotionalOperations] Found playbook:', playbook.title);
      return playbook;
    } catch (error) {
      console.error('[useDevotionalOperations] Error fetching playbook:', error);
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
