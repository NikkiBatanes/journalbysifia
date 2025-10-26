import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playbook, ActionStep } from '../interfaces/playbook';
import { mergePlaybooks } from '../utils/mergePlaybooks';

// Import React Query hooks
import {
  usePlaybooksData,
  useUpdateActionStep,
  useUpdateSubTask,
  useUpdateAffirmation,
} from '../services/hooks/usePlaybookData';
import { useCrossComponentSync } from '../services/hooks/useCrossComponentSync';

type PlaybookStatus = 'inProgress' | 'completed';

// Enhanced interface that combines Zustand state with React Query integration
interface PlaybookStoreReactQuery {
  // Local state management (Zustand)
  localPlaybooks: Playbook[];
  isLocalLoading: boolean;
  lastSyncTime: string | null;
  offlineChanges: OfflineChange[];

  // UI state
  selectedPlaybookId: string | null;
  filterStatus: 'all' | 'ongoing' | 'completed';
  sortBy: 'created' | 'updated' | 'progress';
  // Read Aloud state (per playbook)
  readAloudMap: Record<string, boolean>;

  // Actions
  setLocalPlaybooks: (playbooks: Playbook[]) => void;
  setSelectedPlaybook: (id: string | null) => void;
  setFilterStatus: (status: 'all' | 'ongoing' | 'completed') => void;
  setSortBy: (sort: 'created' | 'updated' | 'progress') => void;
  addOfflineChange: (change: OfflineChange) => void;
  clearOfflineChanges: () => void;
  syncWithReactQuery: (playbooks: Playbook[]) => void;
  // Read Aloud actions
  setReadAloud: (playbookId: string, value: boolean) => void;
  getReadAloud: (playbookId: string) => boolean;

  // Enhanced actions with React Query integration
  updateActionStepOptimistic: (playbookId: string, stepId: string, completed: boolean) => void;
  updateSubTaskOptimistic: (playbookId: string, stepId: string, subTaskId: string, completed: boolean) => void;
  updateAffirmationOptimistic: (playbookId: string, affirmationId: string, completed: boolean) => void;

  // Computed getters
  getFilteredPlaybooks: () => Playbook[];
  getPlaybookById: (id: string) => Playbook | undefined;
  getPlaybookProgress: (id: string) => { completed: number; total: number; percentage: number };
}

// Interface for tracking offline changes
interface OfflineChange {
  id: string;
  type: 'action_step' | 'sub_task' | 'affirmation';
  playbookId: string;
  targetId: string;
  completed: boolean;
  timestamp: string;
  synced: boolean;
}

// Utility functions
function calculateProgressAndStatus(actionSteps: ActionStep[] = []): {
  completed: number;
  total: number;
  percentage: number;
  status: PlaybookStatus;
} {
  let completed = 0;
  let total = 0;

  actionSteps.forEach(step => {
    if (step.subTasks && step.subTasks.length > 0) {
      // Count sub-tasks
      step.subTasks.forEach(subTask => {
        total++;
        if (subTask.completed) {completed++;}
      });
    } else {
      // Count regular steps
      total++;
      if (step.completed) {completed++;}
    }
  });

  const percentage = total > 0 ? completed / total : 0;
  const status: PlaybookStatus = percentage === 1 ? 'completed' : 'inProgress';

  return { completed, total, percentage, status };
}

function updateActionStepInPlaybook(playbook: Playbook, stepId: string, completed: boolean): Playbook {
  const updatedActionSteps = playbook.actionSteps.map(step => {
    if (step.id === stepId) {
      return { ...step, completed };
    }
    return step;
  });

  const { total, percentage, status } = calculateProgressAndStatus(updatedActionSteps);

  return {
    ...playbook,
    actionSteps: updatedActionSteps,
    progress: percentage,
    totalTasks: total,
    status,
    completedAt: status === 'completed' && playbook.status !== 'completed'
      ? new Date().toISOString()
      : playbook.completedAt,
    updatedAt: new Date().toISOString(),
  };
}

function updateSubTaskInPlaybook(playbook: Playbook, stepId: string, subTaskId: string, completed: boolean): Playbook {
  const updatedActionSteps = playbook.actionSteps.map(step => {
    if (step.id === stepId && step.subTasks) {
      const updatedSubTasks = step.subTasks.map(subTask => {
        if (subTask.id === subTaskId) {
          return { ...subTask, completed };
        }
        return subTask;
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

  const { total, percentage, status } = calculateProgressAndStatus(updatedActionSteps);

  return {
    ...playbook,
    actionSteps: updatedActionSteps,
    progress: percentage,
    totalTasks: total,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function updateAffirmationInPlaybook(playbook: Playbook, affirmationId: string, completed: boolean): Playbook {
  const updatedAffirmations = playbook.affirmations.map(affirmation => {
    if (affirmation.id === affirmationId) {
      return { ...affirmation, completed };
    }
    return affirmation;
  });

  return {
    ...playbook,
    affirmations: updatedAffirmations,
    updatedAt: new Date().toISOString(),
  };
}

// Create the enhanced store
export const usePlaybookStoreReactQuery = create<PlaybookStoreReactQuery>()(
  persist(
    (set, get) => ({
      // Initial state
      localPlaybooks: [],
      isLocalLoading: false,
      lastSyncTime: null,
      offlineChanges: [],
      selectedPlaybookId: null,
      filterStatus: 'all',
      sortBy: 'created',
      readAloudMap: {},

      // Basic setters
      setLocalPlaybooks: (playbooks: Playbook[]) => {
        set({
          localPlaybooks: playbooks,
          lastSyncTime: new Date().toISOString(),
        });
      },

      setSelectedPlaybook: (id: string | null) => {
        set({ selectedPlaybookId: id });
      },

      setFilterStatus: (status: 'all' | 'ongoing' | 'completed') => {
        set({ filterStatus: status });
      },

      setSortBy: (sort: 'created' | 'updated' | 'progress') => {
        set({ sortBy: sort });
      },

      // Read Aloud actions
      setReadAloud: (playbookId: string, value: boolean) => {
        set(state => ({ readAloudMap: { ...state.readAloudMap, [playbookId]: value } }));
      },
      getReadAloud: (playbookId: string) => {
        const state = get();
        return !!state.readAloudMap[playbookId];
      },

      addOfflineChange: (change: OfflineChange) => {
        set(state => ({
          offlineChanges: [...state.offlineChanges, change],
        }));
      },

      clearOfflineChanges: () => {
        set({ offlineChanges: [] });
      },

      // Sync with React Query data
      syncWithReactQuery: (playbooks: Playbook[]) => {
        const state = get();
        const merged = mergePlaybooks(state.localPlaybooks, playbooks);
        set({
          localPlaybooks: merged,
          lastSyncTime: new Date().toISOString(),
        });
      },

      // Optimistic updates (for immediate UI feedback)
      updateActionStepOptimistic: (playbookId: string, stepId: string, completed: boolean) => {

        set(state => {
          const updatedPlaybooks = state.localPlaybooks.map(playbook => {
            if (playbook.id === playbookId) {
              return updateActionStepInPlaybook(playbook, stepId, completed);
            }
            return playbook;
          });

          // Track offline change
          const offlineChange: OfflineChange = {
            id: `${playbookId}_${stepId}_${Date.now()}`,
            type: 'action_step',
            playbookId,
            targetId: stepId,
            completed,
            timestamp: new Date().toISOString(),
            synced: false,
          };

          return {
            localPlaybooks: updatedPlaybooks,
            offlineChanges: [...state.offlineChanges, offlineChange],
          };
        });
      },

      updateSubTaskOptimistic: (playbookId: string, stepId: string, subTaskId: string, completed: boolean) => {

        set(state => {
          const updatedPlaybooks = state.localPlaybooks.map(playbook => {
            if (playbook.id === playbookId) {
              return updateSubTaskInPlaybook(playbook, stepId, subTaskId, completed);
            }
            return playbook;
          });

          const offlineChange: OfflineChange = {
            id: `${playbookId}_${stepId}_${subTaskId}_${Date.now()}`,
            type: 'sub_task',
            playbookId,
            targetId: `${stepId}:${subTaskId}`,
            completed,
            timestamp: new Date().toISOString(),
            synced: false,
          };

          return {
            localPlaybooks: updatedPlaybooks,
            offlineChanges: [...state.offlineChanges, offlineChange],
          };
        });
      },

      updateAffirmationOptimistic: (playbookId: string, affirmationId: string, completed: boolean) => {

        set(state => {
          const updatedPlaybooks = state.localPlaybooks.map(playbook => {
            if (playbook.id === playbookId) {
              return updateAffirmationInPlaybook(playbook, affirmationId, completed);
            }
            return playbook;
          });

          const offlineChange: OfflineChange = {
            id: `${playbookId}_${affirmationId}_${Date.now()}`,
            type: 'affirmation',
            playbookId,
            targetId: affirmationId,
            completed,
            timestamp: new Date().toISOString(),
            synced: false,
          };

          return {
            localPlaybooks: updatedPlaybooks,
            offlineChanges: [...state.offlineChanges, offlineChange],
          };
        });
      },

      // Computed getters
      getFilteredPlaybooks: () => {
        const state = get();
        let filtered = state.localPlaybooks;

        // Apply status filter
        if (state.filterStatus !== 'all') {
          filtered = filtered.filter(playbook => {
            const { percentage } = calculateProgressAndStatus(playbook.actionSteps || []);
            const isCompleted = percentage === 1;

            if (state.filterStatus === 'completed') {return isCompleted;}
            if (state.filterStatus === 'ongoing') {return !isCompleted;}
            return true;
          });
        }

        // Apply sorting
        filtered.sort((a, b) => {
          switch (state.sortBy) {
            case 'created':
              return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            case 'updated':
              return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
            case 'progress':
              const progressA = calculateProgressAndStatus(a.actionSteps || []).percentage;
              const progressB = calculateProgressAndStatus(b.actionSteps || []).percentage;
              return progressB - progressA;
            default:
              return 0;
          }
        });

        return filtered;
      },

      getPlaybookById: (id: string) => {
        const state = get();
        return state.localPlaybooks.find(playbook => playbook.id === id);
      },

      getPlaybookProgress: (id: string) => {
        const state = get();
        const playbook = state.localPlaybooks.find(p => p.id === id);

        if (!playbook) {
          return { completed: 0, total: 0, percentage: 0 };
        }

        return calculateProgressAndStatus(playbook.actionSteps || []);
      },
    }),
    {
      name: 'playbook-storage-react-query',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data, not computed values
      partialize: (state) => ({
        localPlaybooks: state.localPlaybooks,
        lastSyncTime: state.lastSyncTime,
        offlineChanges: state.offlineChanges,
        selectedPlaybookId: state.selectedPlaybookId,
        filterStatus: state.filterStatus,
        sortBy: state.sortBy,
        readAloudMap: state.readAloudMap,
      }),
    }
  )
);

// ========================================
// REACT QUERY INTEGRATION HOOKS
// ========================================

/**
 * Hook that combines React Query data fetching with Zustand local state
 * This provides the best of both worlds: server state management + local UI state
 */
export const usePlaybookDataWithStore = (userId: string) => {
  // Get specific functions from the store to avoid reference changes
  const syncWithReactQuery = usePlaybookStoreReactQuery(state => state.syncWithReactQuery);
  const updateActionStepOptimistic = usePlaybookStoreReactQuery(state => state.updateActionStepOptimistic);
  const updateSubTaskOptimistic = usePlaybookStoreReactQuery(state => state.updateSubTaskOptimistic);
  const updateAffirmationOptimistic = usePlaybookStoreReactQuery(state => state.updateAffirmationOptimistic);

  const getFilteredPlaybooks = usePlaybookStoreReactQuery(state => state.getFilteredPlaybooks);
  const getPlaybookById = usePlaybookStoreReactQuery(state => state.getPlaybookById);
  const selectedPlaybookId = usePlaybookStoreReactQuery(state => state.selectedPlaybookId);
  const isLocalLoading = usePlaybookStoreReactQuery(state => state.isLocalLoading);
  const filterStatus = usePlaybookStoreReactQuery(state => state.filterStatus);
  const sortBy = usePlaybookStoreReactQuery(state => state.sortBy);
  const setFilterStatus = usePlaybookStoreReactQuery(state => state.setFilterStatus);
  const setSortBy = usePlaybookStoreReactQuery(state => state.setSortBy);
  const setSelectedPlaybook = usePlaybookStoreReactQuery(state => state.setSelectedPlaybook);
  const getPlaybookProgress = usePlaybookStoreReactQuery(state => state.getPlaybookProgress);
  const offlineChanges = usePlaybookStoreReactQuery(state => state.offlineChanges);
  const lastSyncTime = usePlaybookStoreReactQuery(state => state.lastSyncTime);

  // React Query for server state
  const {
    data: serverPlaybooks = [],
    isLoading: isServerLoading,
    error: serverError,
    refetch,
  } = usePlaybooksData(userId);

  // React Query mutations
  const updateActionStepMutation = useUpdateActionStep();
  const updateSubTaskMutation = useUpdateSubTask();
  const updateAffirmationMutation = useUpdateAffirmation();

  // Cross-component synchronization
  const { syncPlaybookProgress, prefetchRelatedData } = useCrossComponentSync(userId);

  // Sync server data with local store
  useEffect(() => {
    if (serverPlaybooks.length > 0) {
      syncWithReactQuery(serverPlaybooks);
    }
  }, [serverPlaybooks, syncWithReactQuery]);

  // Enhanced action handlers that use both optimistic updates and React Query
  const handleActionStepUpdate = useCallback(async (
    playbookId: string,
    stepId: string,
    completed: boolean
  ) => {
    // 1. Immediate optimistic update in Zustand
    updateActionStepOptimistic(playbookId, stepId, completed);

    // 2. Background sync with React Query
    try {
      await updateActionStepMutation.mutateAsync({
        playbookId,
        stepId,
        completed,
        userId,
      });

      // 3. Calculate new progress and sync with related components
      const updatedPlaybook = getPlaybookById(playbookId);
      if (updatedPlaybook) {
        const progress = getPlaybookProgress(playbookId);
        await syncPlaybookProgress(playbookId, progress.percentage);

        // Prefetch related data for better UX
        await prefetchRelatedData(playbookId);
      }

    } catch (error) {
      console.error('[usePlaybookDataWithStore] Action step sync failed:', error);
      // React Query will handle rollback automatically
    }
  }, [updateActionStepOptimistic, updateActionStepMutation, userId, getPlaybookById, getPlaybookProgress, syncPlaybookProgress, prefetchRelatedData]);

  const handleSubTaskUpdate = useCallback(async (
    playbookId: string,
    stepId: string,
    subTaskId: string,
    completed: boolean
  ) => {
    // 1. Immediate optimistic update in Zustand
    updateSubTaskOptimistic(playbookId, stepId, subTaskId, completed);

    // 2. Background sync with React Query
    try {
      await updateSubTaskMutation.mutateAsync({
        playbookId,
        stepId,
        subTaskId,
        completed,
        userId,
      });

    } catch (error) {
      console.error('[usePlaybookDataWithStore] Sub-task sync failed:', error);
    }
  }, [updateSubTaskOptimistic, updateSubTaskMutation, userId]);

  const handleAffirmationUpdate = useCallback(async (
    playbookId: string,
    affirmationId: string,
    completed: boolean
  ) => {
    // 1. Immediate optimistic update in Zustand
    updateAffirmationOptimistic(playbookId, affirmationId, completed);

    // 2. Background sync with React Query
    try {
      await updateAffirmationMutation.mutateAsync({
        playbookId,
        affirmationId,
        completed,
        userId,
      });

    } catch (error) {
      console.error('[usePlaybookDataWithStore] Affirmation sync failed:', error);
    }
  }, [updateAffirmationOptimistic, updateAffirmationMutation, userId]);

  return {
    // Data
    playbooks: getFilteredPlaybooks(),
    selectedPlaybook: selectedPlaybookId ? getPlaybookById(selectedPlaybookId) : null,

    // Loading states
    isLoading: isServerLoading || isLocalLoading,
    error: serverError,

    // Filters and sorting
    filterStatus,
    sortBy,
    setFilterStatus,
    setSortBy,

    // Actions
    setSelectedPlaybook,
    handleActionStepUpdate,
    handleSubTaskUpdate,
    handleAffirmationUpdate,
    refetch,

    // Utilities
    getPlaybookProgress,
    offlineChanges,
    lastSyncTime,
  };
};

// Export individual selectors for performance optimization
export const usePlaybookFilter = () => usePlaybookStoreReactQuery(state => state.filterStatus);
export const usePlaybookSort = () => usePlaybookStoreReactQuery(state => state.sortBy);
export const useSelectedPlaybook = () => usePlaybookStoreReactQuery(state => state.selectedPlaybookId);
export const useOfflineChanges = () => usePlaybookStoreReactQuery(state => state.offlineChanges);
