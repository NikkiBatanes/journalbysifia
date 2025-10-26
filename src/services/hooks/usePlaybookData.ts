// src/services/hooks/usePlaybookData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Playbook } from '../../interfaces/playbook';
import { queryKeys } from '../queryKeys';
import { createRetryFunction, createRetryDelayFunction, RETRY_CONFIGS } from '../../utils/retry';
import { QueryConfig } from '../../types/api';
import { performanceMonitor, withQueryPerformance, withMutationPerformance } from '../../utils/performanceMonitor';

// Import existing API functions (we'll enhance these)
import {
  getPlaybooks as getPlaybooksApi,
  getPlaybook as getPlaybookApi,
} from '../apiIntegration';

// ========================================
// QUERY HOOKS
// ========================================

/**
 * Hook for getting all playbooks for a user
 * Uses React Query for caching and background updates
 */
export const usePlaybooksData = (userId: string, config?: Partial<QueryConfig>) => {
  const defaultConfig: QueryConfig = {
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    enabled: !!userId,
    // Avoid refetch on mount when cache is fresh to prevent unnecessary heavy queries
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: createRetryFunction(RETRY_CONFIGS.PLAYBOOKS),
    retryDelay: createRetryDelayFunction(RETRY_CONFIGS.PLAYBOOKS),
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.playbooks.all(userId),
    queryFn: withQueryPerformance(
      async () => {
        try {

          const playbooks = await getPlaybooksApi(userId);

          return playbooks;
        } catch (error) {
          console.error('[usePlaybooksData] Error fetching playbooks:', error);
          throw error;
        }
      },
      queryKeys.playbooks.all(userId)
    ),
    ...finalConfig,
  });
};

/**
 * Hook for getting a single playbook by ID
 */
export const usePlaybookData = (userId: string, playbookId: string, config?: Partial<QueryConfig>) => {
  const defaultConfig: QueryConfig = {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!userId && !!playbookId,
    refetchOnMount: false, // Don't refetch if we have data
    refetchOnWindowFocus: false,
    retry: createRetryFunction(RETRY_CONFIGS.PLAYBOOKS),
    retryDelay: createRetryDelayFunction(RETRY_CONFIGS.PLAYBOOKS),
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.playbooks.detail(userId, playbookId),
    queryFn: withQueryPerformance(
      async () => {
        try {

          // Fetch a single playbook directly to avoid loading all playbooks
          const playbook = await getPlaybookApi(userId, playbookId);
          if (!playbook) {
            throw new Error(`Playbook with ID ${playbookId} not found`);
          }
          return playbook;
        } catch (error) {
          console.error('[usePlaybookData] Error fetching playbook:', error);
          throw error;
        }
      },
      queryKeys.playbooks.detail(userId, playbookId)
    ),
    ...finalConfig,
  });
};

/**
 * Hook for getting playbooks by status
 */
export const usePlaybooksByStatus = (
  userId: string,
  status: 'inProgress' | 'completed',
  config?: Partial<QueryConfig>
) => {
  const defaultConfig: QueryConfig = {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!userId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  };

  const finalConfig = { ...defaultConfig, ...config };

  return useQuery({
    queryKey: queryKeys.playbooks.byStatus(userId, status),
    queryFn: withQueryPerformance(
      async () => {
        try {
          const playbooks = await getPlaybooksApi(userId);
          return playbooks.filter(p => p.status === status);
        } catch (error) {
          console.error('[usePlaybooksByStatus] Error:', error);
          throw error;
        }
      },
      queryKeys.playbooks.byStatus(userId, status)
    ),
    ...finalConfig,
  });
};

// ========================================
// MUTATION HOOKS
// ========================================

/**
 * Mutation for updating action step completion status
 * Includes optimistic updates for instant UI feedback
 */
export const useUpdateActionStep = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { playbookId: string; stepId: string; completed: boolean },
    Error,
    { playbookId: string; stepId: string; completed: boolean; userId: string },
    { previousPlaybooks?: Playbook[] }
  >({
    mutationFn: withMutationPerformance(
      async ({
        playbookId,
        stepId,
        completed,
        userId: _userId,
      }: {
        playbookId: string;
        stepId: string;
        completed: boolean;
        userId: string;
      }) => {

        // Get current playbooks to update the specific step
        const playbooks = await getPlaybooksApi(_userId);
        const playbook = playbooks.find(p => p.id === playbookId);

        if (!playbook) {
          throw new Error(`Playbook with ID ${playbookId} not found`);
        }

        // TODO: Update the specific action step via API
        // For now, we'll just return the result without API call
        // When API is implemented, update the action step here

        return { playbookId, stepId, completed };
      },
      'updateActionStep'
    ),

    // Optimistic update
    onMutate: async ({ playbookId, stepId, completed, userId }) => {
      const timer = performanceMonitor.startTiming('optimisticUpdate:actionStep', 'mutation');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.playbooks.all(userId),
      });

      // Snapshot previous value
      const previousPlaybooks = queryClient.getQueryData<Playbook[]>(
        queryKeys.playbooks.all(userId)
      );

      // Optimistically update
      if (previousPlaybooks) {
        const updatedPlaybooks = previousPlaybooks.map(playbook => {
          if (playbook.id !== playbookId) {return playbook;}

          const updatedActionSteps = playbook.actionSteps.map(step => {
            if (step.id !== stepId) {return step;}
            return { ...step, completed };
          });

          // Recalculate progress
          const totalSteps = updatedActionSteps.length;
          const completedSteps = updatedActionSteps.filter(step => step.completed).length;
          const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
          const status = progress === 1 ? 'completed' : 'inProgress';

          return {
            ...playbook,
            actionSteps: updatedActionSteps,
            progress,
            status,
            completedAt: status === 'completed' && playbook.status !== 'completed'
              ? new Date().toISOString()
              : playbook.completedAt,
            updatedAt: new Date().toISOString(),
          };
        });

        queryClient.setQueryData(
          queryKeys.playbooks.all(userId),
          updatedPlaybooks
        );

        // Also update individual playbook cache if it exists
        const playbookDetailKey = queryKeys.playbooks.detail(userId, playbookId);
        const currentPlaybook = queryClient.getQueryData<Playbook>(playbookDetailKey);
        if (currentPlaybook) {
          const updatedPlaybook = updatedPlaybooks.find(p => p.id === playbookId);
          if (updatedPlaybook) {
            queryClient.setQueryData(playbookDetailKey, updatedPlaybook);
          }
        }
      }

      timer.end();

      return { previousPlaybooks };
    },

    // On success, invalidate and refetch
    onSuccess: (data, variables) => {

      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.playbooks.all(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.playbooks.detail(variables.userId, variables.playbookId),
      });
    },

    // On error, rollback optimistic update
    onError: (error, variables, context) => {
      console.error('[useUpdateActionStep] Error:', error);

      if (context?.previousPlaybooks) {
        queryClient.setQueryData(
          queryKeys.playbooks.all(variables.userId),
          context.previousPlaybooks
        );
      }
    },

    // Always refetch after error or success
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playbooks.all(variables.userId),
      });
    },
  });
};

/**
 * Mutation for updating sub-task completion status
 * Similar to action step but handles sub-tasks within steps
 */
export const useUpdateSubTask = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { playbookId: string; stepId: string; subTaskId: string; completed: boolean },
    Error,
    { playbookId: string; stepId: string; subTaskId: string; completed: boolean; userId: string },
    { previousPlaybooks?: Playbook[] }
  >({
    mutationFn: withMutationPerformance(
      async ({
        playbookId,
        stepId,
        subTaskId,
        completed,
        userId: _userId,
      }: {
        playbookId: string;
        stepId: string;
        subTaskId: string;
        completed: boolean;
        userId: string;
      }) => {

        // TODO: Implement sub-task specific API call
        // For now, we'll use the existing action step API
        // This will be enhanced when we migrate to the new database schema

        return { playbookId, stepId, subTaskId, completed };
      },
      'updateSubTask'
    ),

    // Optimistic update for sub-tasks
    onMutate: async ({ playbookId, stepId, subTaskId, completed, userId }) => {
      const timer = performanceMonitor.startTiming('optimisticUpdate:subTask', 'mutation');

      await queryClient.cancelQueries({
        queryKey: queryKeys.playbooks.all(userId),
      });

      const previousPlaybooks = queryClient.getQueryData<Playbook[]>(
        queryKeys.playbooks.all(userId)
      );

      if (previousPlaybooks) {
        const updatedPlaybooks = previousPlaybooks.map(playbook => {
          if (playbook.id !== playbookId) {return playbook;}

          const updatedActionSteps = playbook.actionSteps.map(step => {
            if (step.id !== stepId) {return step;}

            if (step.subTasks) {
              const updatedSubTasks = step.subTasks.map(subTask => {
                if (subTask.id !== subTaskId) {return subTask;}
                return { ...subTask, completed };
              });

              // Update step completion based on sub-tasks
              const allSubTasksCompleted = updatedSubTasks.every(st => st.completed);

              return {
                ...step,
                subTasks: updatedSubTasks,
                completed: allSubTasksCompleted,
              };
            }

            return step;
          });

          // Recalculate overall progress
          const totalSteps = updatedActionSteps.length;
          const completedSteps = updatedActionSteps.filter(step => step.completed).length;
          const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
          const status = progress === 1 ? 'completed' : 'inProgress';

          return {
            ...playbook,
            actionSteps: updatedActionSteps,
            progress,
            status,
            updatedAt: new Date().toISOString(),
          };
        });

        queryClient.setQueryData(
          queryKeys.playbooks.all(userId),
          updatedPlaybooks
        );
      }

      timer.end();

      return { previousPlaybooks };
    },

    onSuccess: (data, variables) => {

      queryClient.invalidateQueries({
        queryKey: queryKeys.playbooks.all(variables.userId),
      });
    },

    onError: (error, variables, context) => {
      console.error('[useUpdateSubTask] Error:', error);
      if (context?.previousPlaybooks) {
        queryClient.setQueryData(
          queryKeys.playbooks.all(variables.userId),
          context.previousPlaybooks
        );
      }
    },
  });
};

/**
 * Mutation for updating affirmation completion status
 */
export const useUpdateAffirmation = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { playbookId: string; affirmationId: string; completed: boolean },
    Error,
    { playbookId: string; affirmationId: string; completed: boolean; userId: string },
    { previousPlaybooks?: Playbook[] }
  >({
    mutationFn: withMutationPerformance(
      async ({
        playbookId,
        affirmationId,
        completed,
      }: {
        playbookId: string;
        affirmationId: string;
        completed: boolean;
      }) => {

        // TODO: Implement affirmation specific API call
        return { playbookId, affirmationId, completed };
      },
      'updateAffirmation'
    ),

    // Optimistic update for affirmations
    onMutate: async ({ playbookId, affirmationId, completed, userId }) => {
      const timer = performanceMonitor.startTiming('optimisticUpdate:affirmation', 'mutation');

      await queryClient.cancelQueries({
        queryKey: queryKeys.playbooks.all(userId),
      });

      const previousPlaybooks = queryClient.getQueryData<Playbook[]>(
        queryKeys.playbooks.all(userId)
      );

      if (previousPlaybooks) {
        const updatedPlaybooks = previousPlaybooks.map(playbook => {
          if (playbook.id !== playbookId) {return playbook;}

          const updatedAffirmations = playbook.affirmations.map(affirmation => {
            if (affirmation.id !== affirmationId) {return affirmation;}
            return { ...affirmation, completed };
          });

          return {
            ...playbook,
            affirmations: updatedAffirmations,
            updatedAt: new Date().toISOString(),
          };
        });

        queryClient.setQueryData(
          queryKeys.playbooks.all(userId),
          updatedPlaybooks
        );
      }

      timer.end();

      return { previousPlaybooks };
    },

    onSuccess: (data, variables) => {

      queryClient.invalidateQueries({
        queryKey: queryKeys.playbooks.all(variables.userId),
      });
    },

    onError: (error, variables, context) => {
      console.error('[useUpdateAffirmation] Error:', error);
      if (context?.previousPlaybooks) {
        queryClient.setQueryData(
          queryKeys.playbooks.all(variables.userId),
          context.previousPlaybooks
        );
      }
    },
  });
};

// ========================================
// UTILITY HOOKS
// ========================================

/**
 * Hook for invalidating all playbook data
 * Useful for force refresh scenarios
 */
export const useInvalidatePlaybookData = () => {
  const queryClient = useQueryClient();

  return (userId: string) => {

    queryClient.invalidateQueries({
      queryKey: queryKeys.playbooks.all(userId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.playbooks.lists(),
    });
  };
};

/**
 * Hook for prefetching playbook data
 * Useful for improving perceived performance
 */
export const usePrefetchPlaybookData = () => {
  const queryClient = useQueryClient();

  return {
    prefetchPlaybooks: (userId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.playbooks.all(userId),
        queryFn: withQueryPerformance(
          async () => {
            const playbooks = await getPlaybooksApi(userId);
            return playbooks;
          },
          queryKeys.playbooks.all(userId)
        ),
        staleTime: 5 * 60 * 1000,
      });
    },

    prefetchPlaybook: (userId: string, playbookId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.playbooks.detail(userId, playbookId),
        queryFn: withQueryPerformance(
          async () => {
            const playbook = await getPlaybookApi(userId, playbookId);
            return playbook;
          },
          queryKeys.playbooks.detail(userId, playbookId)
        ),
        staleTime: 5 * 60 * 1000,
      });
    },
  };
};

// ========================================
// PERFORMANCE MONITORING
// ========================================

/**
 * Hook for monitoring playbook query performance
 */
export const usePlaybookQueryPerformance = (userId: string) => {
  const { data: playbooks, isLoading, error, dataUpdatedAt } = usePlaybooksData(userId);

  return {
    playbooksCount: playbooks?.length || 0,
    isLoading,
    hasError: !!error,
    lastUpdated: dataUpdatedAt,
    cacheAge: dataUpdatedAt ? Date.now() - dataUpdatedAt : 0,
  };
};
