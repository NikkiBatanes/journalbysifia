// src/services/hooks/useTimeBlockData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimeBlockApi, TimeBlockApiEntry } from '../api/timeBlockApi';
import { queryKeys } from '../queryKeys';
import { RETRY_CONFIGS, createRetryFunction } from '../../utils/retry';

// Hook for getting time blocks for a specific date
export const useTimeBlockData = (userId: string, date: string) => {
  return useQuery({
    queryKey: queryKeys.timeBlocks.byDate(userId, date),
    queryFn: () => TimeBlockApi.getTimeBlocks(userId, date),
    staleTime: 1000, // 1 second stale time to prevent excessive refetching
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!date,
    refetchOnMount: false, // Don't refetch on mount to prevent loading flash
    initialData: [], // Provide empty array as initial data
    retry: createRetryFunction(RETRY_CONFIGS.TIMEBLOCK_ENHANCED),
  });
};

// Hook for getting time blocks in a date range
export const useTimeBlocksInRange = (userId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.timeBlocks.dateRange(userId, startDate, endDate),
    queryFn: () => TimeBlockApi.getTimeBlocksInDateRange(userId, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// Hook for creating a time block
export const useCreateTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TimeBlockApi.createTimeBlock,
    onMutate: async (newTimeBlock) => {
      // Cancel any outgoing refetches
      const queryKey = queryKeys.timeBlocks.byDate(newTimeBlock.user_id, newTimeBlock.selected_date);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTimeBlocks = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: TimeBlockApiEntry[] = []) => [
        ...old,
        {
          ...newTimeBlock,
          id: 'temp-' + Date.now(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TimeBlockApiEntry,
      ]);

      return { previousTimeBlocks };
    },
    onError: (err, newTimeBlock, context) => {
      console.error('Error creating time block:', err);
      if (context?.previousTimeBlocks) {
        const queryKey = queryKeys.timeBlocks.byDate(newTimeBlock.user_id, newTimeBlock.selected_date);
        queryClient.setQueryData(queryKey, context.previousTimeBlocks);
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeBlocks.byDate(variables.user_id, variables.selected_date),
      });
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
    onSuccess: (data) => {
      // Update the specific time block in the query
      queryClient.setQueryData(
        queryKeys.timeBlocks.byDate(data.user_id, data.selected_date),
        (old: TimeBlockApiEntry[] = []) =>
          old.map(block => block.id === data.id ? data : block)
      );
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
      const queries = queryClient.getQueriesData({ queryKey: ['timeBlocks'] });
      let timeBlockToDelete: TimeBlockApiEntry | undefined;
      let queryKey: any;

      for (const [key, data] of queries) {
        if (Array.isArray(data)) {
          timeBlockToDelete = data.find((block: TimeBlockApiEntry) => block.id === timeBlockId);
          if (timeBlockToDelete) {
            queryKey = key;
            break;
          }
        }
      }

      if (timeBlockToDelete && queryKey) {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey });

        // Snapshot the previous value
        const previousTimeBlocks = queryClient.getQueryData(queryKey);

        // Optimistically remove the time block
        queryClient.setQueryData(queryKey, (old: TimeBlockApiEntry[] = []) =>
          old.filter(block => block.id !== timeBlockId)
        );

        return { previousTimeBlocks, queryKey };
      }

      return { timeBlockId };
    },
    onError: (error, _timeBlockId, _context) => {
      console.error('Error deleting time block:', error);
      if (_context?.previousTimeBlocks && _context?.queryKey) {
        queryClient.setQueryData(_context.queryKey, _context.previousTimeBlocks);
      }
    },
    onSuccess: (_, _timeBlockId, _context) => {
      // Invalidate all time block queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['timeBlocks'],
      });
    },
  });
};

// Hook for checking time conflicts
export const useCheckTimeConflicts = () => {
  return useMutation({
    mutationFn: ({ userId, date, startTime, endTime, excludeId }: {
      userId: string;
      date: string;
      startTime: string;
      endTime: string;
      excludeId?: string;
    }) => TimeBlockApi.checkTimeConflicts(userId, date, startTime, endTime, excludeId),
  });
};

// Hook for invalidating all time block data
export const useInvalidateTimeBlockData = () => {
  const queryClient = useQueryClient();

  const invalidateAllTimeBlockData = (userId?: string, date?: string) => {
    if (userId && date) {
      // Invalidate specific date
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeBlocks.byDate(userId, date),
      });
    } else {
      // Invalidate all time block data
      queryClient.invalidateQueries({
        queryKey: ['timeBlocks'],
      });
    }
  };

  return { invalidateAllTimeBlockData };
};
