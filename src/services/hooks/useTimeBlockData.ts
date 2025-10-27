// src/services/hooks/useTimeBlockData.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { TimeBlockApi, TimeBlockApiEntry, ApiError } from '../api/timeBlockApi';
import { Logger } from '../../utils/ProductionLogger';
import { queryKeys } from '../queryKeys';
import { RETRY_CONFIGS, createRetryFunction } from '../../utils/retry';

type TimeBlockWithVersion = TimeBlockApiEntry & {
  optimisticId?: string;
  version: number;
  _isDeleted?: boolean;
};

// Cache configuration
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000,   // 30 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: createRetryFunction(RETRY_CONFIGS.TIMEBLOCK_ENHANCED),
} as const;

// Hook for getting time blocks for a specific date with enhanced error handling
export const useTimeBlockData = (
  userId: string,
  date: string,
  options?: Omit<UseQueryOptions<TimeBlockWithVersion[], ApiError>, 'queryKey' | 'queryFn'>
) => {

  return useQuery<TimeBlockWithVersion[], ApiError>({
    queryKey: queryKeys.timeBlocks.byDate(userId, date),
    queryFn: async () => {
      try {

        const data = await TimeBlockApi.getTimeBlocks(userId, date);

        return data.map(block => ({
          ...block,
          version: 1,
        }));
      } catch (error) {
        console.error(`Failed to fetch time blocks for ${date}:`, error);
        throw new Error('Failed to load time blocks. Please try again.');
      }
    },
    ...CACHE_CONFIG,
    retry: (failureCount, error) => {
      if (error.statusCode === 404 || error.statusCode === 401) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!userId && !!date,
    // Use throwOnError for React Query v4+
    throwOnError: (error) => error.statusCode !== 404, // Don't throw for 404s
    ...options,
  });
};

// Hook for getting time blocks in a date range with improved caching
export const useTimeBlocksInRange = (userId: string, startDate: string, endDate: string) => {
  const queryClient = useQueryClient();
  return useQuery<TimeBlockWithVersion[]>({
    queryKey: queryKeys.timeBlocks.dateRange(userId, startDate, endDate),
    queryFn: async () => {
      const data = await TimeBlockApi.getTimeBlocksInDateRange(userId, startDate, endDate);
      // Add version to each time block for optimistic updates
      return data.map(block => ({
        ...block,
        version: 1, // Initial version
      }));
    },
    ...CACHE_CONFIG,
    enabled: !!userId && !!startDate && !!endDate,
    // Use placeholder data to prevent loading states when we have cached data
    placeholderData: () => {
      // Try to get data from individual date caches first
      const queryCache = queryClient.getQueryCache();
      const allTimeBlocks: TimeBlockWithVersion[] = [];

      // Get all date queries that might be in our range
      const dateQueries = queryCache.findAll({
        queryKey: [queryKeys.timeBlocks.byDate(userId, '')],
      });

      // Check each date's data if it falls within our range
      for (const query of dateQueries) {
        const date = query.queryKey[2] as string; // Extract date from query key
        if (date >= startDate && date <= endDate) {
          const data = query.state.data as TimeBlockWithVersion[] | undefined;
          if (data) {
            allTimeBlocks.push(...data);
          }
        }
      }

      return allTimeBlocks.length > 0 ? allTimeBlocks : undefined;
    },
  });
};

// Hook for creating a time block
export const useCreateTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TimeBlockApi.createTimeBlock,
    onMutate: async (newTimeBlock) => {
      const queryKey = queryKeys.timeBlocks.byDate(newTimeBlock.user_id, newTimeBlock.selected_date);
      await queryClient.cancelQueries({ queryKey });

      const optimisticId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticTimeBlock: TimeBlockWithVersion = {
        ...newTimeBlock,
        id: optimisticId,
        created_at: now,
        updated_at: now,
        version: 0, // 0 indicates optimistic update
        optimisticId, // Store the optimistic ID for rollback
      };

      // Optimistically update the cache
      queryClient.setQueryData<TimeBlockWithVersion[]>(
        queryKey,
        (old = []) => [...old, optimisticTimeBlock]
      );

      return { optimisticId };
    },
    onError: (error, variables, context) => {
      Logger.error('Error creating time block', error as Error, { component: 'useTimeBlockData' });
      // Rollback the optimistic update
      if (context?.optimisticId) {
        const queryKey = queryKeys.timeBlocks.byDate(variables.user_id, variables.selected_date);
        queryClient.setQueryData<TimeBlockWithVersion[]>(
          queryKey,
          old => old?.filter(block => block.optimisticId !== context.optimisticId) ?? []
        );
      }
    },
    onSuccess: (data, variables, context) => {
      // Update the cache with the server response
      const queryKey = queryKeys.timeBlocks.byDate(data.user_id, data.selected_date);

      // Replace the optimistic time block with the actual one
      queryClient.setQueryData<TimeBlockWithVersion[]>(
        queryKey,
        old => old?.map(block =>
          block.optimisticId === context?.optimisticId
            ? { ...data, version: 1 }
            : block
        ) ?? []
      );
    },
  });
};

// Hook for creating multiple time blocks
export const useCreateMultipleTimeBlocks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TimeBlockApi.createMultipleTimeBlocks,
    onSuccess: (data) => {
      // Invalidate queries for all affected dates
      const affectedDates = [...new Set(data.map(block => block.selected_date))];
      const affectedUsers = [...new Set(data.map(block => block.user_id))];

      affectedUsers.forEach(userId => {
        affectedDates.forEach(date => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.timeBlocks.byDate(userId, date),
          });
        });
      });
    },
  });
};

// Hook for updating a time block
export const useUpdateTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<TimeBlockApiEntry, 'id' | 'user_id' | 'created_at'>> }) =>
      TimeBlockApi.updateTimeBlock(id, updates),
    onMutate: async ({ id, updates }) => {
      // Find the time block in cache to get user_id and selected_date
      const queries = queryClient.getQueriesData<TimeBlockWithVersion[]>({
        queryKey: [queryKeys.timeBlocks.all[0]],
      });

      let timeBlockToUpdate: TimeBlockWithVersion | undefined;
      let queryKey: any;

      for (const [key, data] of queries) {
        if (Array.isArray(data)) {
          timeBlockToUpdate = data.find(block => block.id === id);
          if (timeBlockToUpdate) {
            queryKey = key;
            break;
          }
        }
      }

      if (!timeBlockToUpdate || !queryKey) {return null;}

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTimeBlock = { ...timeBlockToUpdate };

      // Optimistically update the time block
      const optimisticId = `update-${Date.now()}-${id}`;
      const now = new Date().toISOString();

      queryClient.setQueryData<TimeBlockWithVersion[]>(
        queryKey,
        old => old?.map(block =>
          block.id === id
            ? {
                ...block,
                ...updates,
                updated_at: now,
                version: (block.version || 0) + 1,
                optimisticId,
              }
            : block
        )
      );

      return { previousTimeBlock, optimisticId, queryKey };
    },
    onError: (error, variables, context) => {
      Logger.error('Error updating time block', error as Error, { component: 'useTimeBlockData' });

      // Rollback on error
      if (context?.previousTimeBlock && context?.queryKey) {
        queryClient.setQueryData<TimeBlockWithVersion[]>(
          context.queryKey,
          old => old?.map(block =>
            block.id === variables.id
              ? { ...context.previousTimeBlock, version: (context.previousTimeBlock.version || 1) }
              : block
          )
        );
      }
    },
    onSuccess: (data, variables, context) => {
      // Update the cache with the server response
      if (context?.queryKey) {
        queryClient.setQueryData<TimeBlockWithVersion[]>(
          context.queryKey,
          old => old?.map(block =>
            block.optimisticId === context?.optimisticId
              ? {
                  ...data,
                  version: (block.version || 0) + 1,
                  // Preserve any optimistic IDs for chained updates
                  optimisticId: block.optimisticId,
                }
              : block
          )
        );
      }
    },
  });
};

// Hook for deleting a time block
export const useDeleteTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TimeBlockApi.deleteTimeBlock,
    onMutate: async (timeBlockId: string) => {
      // Find the time block in cache to get user_id and selected_date
      const queries = queryClient.getQueriesData<TimeBlockWithVersion[]>({
        queryKey: [queryKeys.timeBlocks.all[0]],
      });

      let timeBlockToDelete: TimeBlockWithVersion | undefined;
      let queryKey: any;

      for (const [key, data] of queries) {
        if (Array.isArray(data)) {
          timeBlockToDelete = data.find(block => block.id === timeBlockId);
          if (timeBlockToDelete) {
            queryKey = key;
            break;
          }
        }
      }

      if (!timeBlockToDelete || !queryKey) {return null;}

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTimeBlocks = queryClient.getQueryData<TimeBlockWithVersion[]>(queryKey);

      // Optimistically remove the time block with a tombstone
      const optimisticId = `delete-${Date.now()}-${timeBlockId}`;

      queryClient.setQueryData<TimeBlockWithVersion[]>(
        queryKey,
        old => old?.map(block =>
          block.id === timeBlockId
            ? { ...block, _isDeleted: true, optimisticId }
            : block
        )
      );

      return {
        previousTimeBlocks,
        timeBlockToDelete,
        optimisticId,
        queryKey,
      };
    },
    onError: (error, timeBlockId, context) => {
      Logger.error('Error deleting time block', error as Error, { component: 'useTimeBlockData' });

      // Rollback on error
      if (context?.previousTimeBlocks && context?.queryKey) {
        queryClient.setQueryData(
          context.queryKey,
          context.previousTimeBlocks
        );
      }
    },
    onSuccess: (_, timeBlockId, context) => {
      if (!context?.queryKey) {return;}

      // Remove the tombstoned time block from the cache
      queryClient.setQueryData<TimeBlockWithVersion[]>(
        context.queryKey,
        old => old?.filter(block => !block._isDeleted) ?? []
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: [queryKeys.timeBlocks.all[0]],
        refetchType: 'active',
      });
    },
  });
};

// Hook for checking time conflicts with caching
export const useCheckTimeConflicts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      date: string;
      startTime: string;
      endTime: string;
      excludeId?: string;
    }) => {
      // Create a cache key for this specific time range check
      const cacheKey = [
        'timeBlockConflicts',
        params.userId,
        params.date,
        params.startTime,
        params.endTime,
        params.excludeId || '',
      ];

      // Check cache first
      const cachedResult = queryClient.getQueryData(cacheKey);
      if (cachedResult) {
        return cachedResult as boolean;
      }

      // If not in cache, make the API call
      const result = await TimeBlockApi.checkTimeConflicts(
        params.userId,
        params.date,
        params.startTime,
        params.endTime,
        params.excludeId
      );

      // Cache the result for 1 minute
      queryClient.setQueryData(cacheKey, result);
      // Set a timeout to remove from cache after 1 minute
      setTimeout(() => {
        queryClient.removeQueries({
          queryKey: cacheKey,
          exact: true,
        });
      }, 60 * 1000);

      return result;
    },
  });
};

// Hook for invalidating time block data with smart cache management
export const useInvalidateTimeBlockData = () => {
  const queryClient = useQueryClient();

  return (userId: string, date?: string) => {
    if (date) {
      // Invalidate specific date and date range queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeBlocks.byDate(userId, date),
      });

      // Also invalidate any date range that might include this date
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey) || queryKey[0] !== queryKeys.timeBlocks.all[0]) {
            return false;
          }

          // Check if this is a date range query that includes our date
          if (queryKey[1] === 'dateRange' && queryKey[2] === userId) {
            const [startDate, endDate] = queryKey[3].split('_');
            return date >= startDate && date <= endDate;
          }

          return false;
        },
      });
    } else {
      // Invalidate all time block queries for this user
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === queryKeys.timeBlocks.all[0] &&
            (queryKey[1] === 'byDate' || queryKey[1] === 'dateRange') &&
            queryKey[2] === userId
          );
        },
      });
    }
  };
};

// Helper hook to prefetch time blocks for smoother UX
export const usePrefetchTimeBlocks = () => {
  const queryClient = useQueryClient();

  return (userId: string, dates: string[]) => {
    dates.forEach(date => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.timeBlocks.byDate(userId, date),
        queryFn: () => TimeBlockApi.getTimeBlocks(userId, date).then(blocks =>
          blocks.map(block => ({
            ...block,
            version: 1,
          }))
        ),
        ...CACHE_CONFIG,
      });
    });
  };
};
