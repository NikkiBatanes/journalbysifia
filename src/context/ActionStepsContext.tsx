import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { updatePlaybookActionSteps, calculateTaskStats } from '../services/apiIntegration';
import { usePlaybookStore } from '../store/usePlaybookStore';
import { Playbook } from '../interfaces/playbook';

export type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  // Protected flag to prevent override of auto-checked states
  _protected?: boolean;
};

export type ActionStep = {
  id: string;
  title: string;
  description?: string;
  examples?: string;
  subTasks?: SubTask[];
  completed: boolean;
};

type ActionStepsContextType = {
  actionSteps: ActionStep[];
  setActionSteps: React.Dispatch<React.SetStateAction<ActionStep[]>>;
  handleToggleStep: (stepId: string, subTaskId?: string) => void;
  handleAutoCheckStep: (stepId: string, subTaskId: string) => void; // New method for auto-checking
  getCompletedStepsCount: () => { completed: number; total: number };
  saveActionSteps: (playbookId: string) => Promise<void>;
};

const ActionStepsContext = createContext<ActionStepsContextType | undefined>(undefined);

interface ActionStepsProviderProps {
  initialSteps: ActionStep[];
  children: ReactNode;
  playbookId?: string;
}

export const ActionStepsProvider: React.FC<ActionStepsProviderProps> = ({
  initialSteps,
  children,
  playbookId,
}) => {
  const [actionStepsInternal, setActionStepsInternal] = useState<ActionStep[]>(initialSteps);
  const { updatePlaybook } = usePlaybookStore();
  
  // Protected subtask tracking - preserves auto-checked states
  const protectedSubtasks = useRef<Set<string>>(new Set());

  // Wrapper for setActionSteps that ALWAYS preserves protected states
  const setActionSteps = useCallback((updater: React.SetStateAction<ActionStep[]>) => {
    setActionStepsInternal(prev => {
      const nextSteps = typeof updater === 'function' ? updater(prev) : updater;
      
      // CRITICAL: Merge protected states back into ANY update
      return nextSteps.map(step => ({
        ...step,
        subTasks: step.subTasks?.map(subTask => {
          const isProtected = protectedSubtasks.current.has(subTask.id);
          if (isProtected) {
            // Force preserve protected subtasks
            return {
              ...subTask,
              completed: true,
              _protected: true,
            };
          }
          return subTask;
        }),
      }));
    });
  }, []);

  const actionSteps = actionStepsInternal;

  const getCompletedStepsCount = useCallback(() => {
    let completed = 0;
    let total = 0;

    actionSteps.forEach(step => {
      const subTasks = step.subTasks || [];
      const hasSubTasks = subTasks.length > 0;

      if (hasSubTasks) {
        // For steps with subtasks, only count the step as completed if all subtasks are completed
        const allSubTasksCompleted = subTasks.every(st => st.completed);
        total++; // Count the main step
        if (allSubTasksCompleted) {
          completed++; // Only count as completed if all subtasks are done
        }
      } else {
        // For steps without subtasks, count the step itself
        total++;
        if (step.completed) {
          completed++;
        }
      }
    });

    // Ensure we don't show more completed than total tasks
    if (completed > total) {
      Logger.warn('[WARNING] More completed tasks than total tasks!', {
        component: 'ActionStepsContext',
        completed,
        total,
      });
      completed = total;
    }

    return { completed, total };
  }, [actionSteps]);

  const normalizeSubTask = useCallback((task: SubTask | string, index: number, stepId: string, preserveProtected: boolean = true): SubTask => {
    if (typeof task === 'string') {
      return {
        id: `${stepId}-subtask-${index}`,
        text: task,
        completed: false,
      };
    }
    
    // Check if this subtask is protected (auto-checked)
    const subtaskId = task.id || `${stepId}-subtask-${index}`;
    const isProtected = preserveProtected && protectedSubtasks.current.has(subtaskId);
    
    // Ensure the task has all required properties
    return {
      id: task.id || `${stepId}-subtask-${index}`,
      text: task.text || '',
      completed: isProtected ? true : Boolean(task.completed), // Preserve true if protected
      _protected: isProtected,
    };
  }, []);

  // Helper function removed as it was unused

  // New enterprise-grade method for auto-checking subtasks (protected)
  const handleAutoCheckStep = useCallback((stepId: string, subTaskId: string) => {
    Logger.info('[ActionStepsContext] Auto-checking subtask with protection', {
      component: 'ActionStepsContext',
      stepId,
      subTaskId,
    });

    // Add to protected set to prevent future overrides
    protectedSubtasks.current.add(subTaskId);

    setActionSteps(prev => {
      const prevCopy = [...prev];
      const stepIndex = prevCopy.findIndex(step => step.id === stepId);

      if (stepIndex === -1) {
        Logger.warn(`[WARNING] Step with id ${stepId} not found for auto-check`, {
          component: 'ActionStepsContext',
          stepId,
        });
        return prevCopy;
      }

      const updatedSteps = [...prevCopy];
      const step = { ...updatedSteps[stepIndex] };

      // Ensure subTasks is an array with protected preservation
      if (!Array.isArray(step.subTasks)) {
        step.subTasks = [];
      } else {
        step.subTasks = step.subTasks.map((task, index) =>
          normalizeSubTask(task, index, stepId, true) // Preserve protected states
        );
      }

      // Auto-check the specific subtask (protected)
      const subTaskIndex = step.subTasks.findIndex(st => st.id === subTaskId);
      if (subTaskIndex !== -1) {
        const updatedSubTasks = [...step.subTasks];
        updatedSubTasks[subTaskIndex] = {
          ...updatedSubTasks[subTaskIndex],
          completed: true,
          _protected: true, // Mark as protected
        };

        step.subTasks = updatedSubTasks;
        const allSubTasksCompleted = step.subTasks.every(st => st.completed);
        step.completed = allSubTasksCompleted;
      }

      updatedSteps[stepIndex] = step;

      // Update the global playbook store if playbookId is provided
      if (playbookId) {
        const stats = calculateTaskStats(updatedSteps);

        // Get the current playbook from the store to preserve other fields
        const currentPlaybook = usePlaybookStore.getState().playbooks.find(p => p.id === playbookId);

        if (currentPlaybook) {
          const updatedPlaybook: Playbook = {
            ...currentPlaybook,
            actionSteps: updatedSteps,
            progress: stats.completed / Math.max(stats.total, 1),
            updatedAt: new Date().toISOString(),
            totalTasks: stats.total,
            status: stats.completed === stats.total && stats.total > 0 ? 'completed' : 'inProgress',
          };
          updatePlaybook(updatedPlaybook);
        }
      }

      return updatedSteps;
    });
  }, [playbookId, updatePlaybook, normalizeSubTask]);

  const handleToggleStep = useCallback((stepId: string, subTaskId?: string) => {

    setActionSteps(prev => {
      const prevCopy = [...prev];
      const stepIndex = prevCopy.findIndex(step => step.id === stepId);

      if (stepIndex === -1) {
        Logger.warn(`[WARNING] Step with id ${stepId} not found`, {
          component: 'ActionStepsContext',
          stepId,
        });
        return prevCopy;
      }

      const updatedSteps = [...prevCopy];
      const step = { ...updatedSteps[stepIndex] };

      // Ensure subTasks is an array with protected preservation
      if (!Array.isArray(step.subTasks)) {
        step.subTasks = [];
      } else {
        step.subTasks = step.subTasks.map((task, index) =>
          normalizeSubTask(task, index, stepId, true) // Preserve protected states
        );
      }

      if (subTaskId && step.subTasks.length > 0) {

        // Toggle the subtask
        const subTaskIndex = step.subTasks.findIndex(st => st.id === subTaskId);
        if (subTaskIndex !== -1) {
          const updatedSubTasks = [...step.subTasks];
          updatedSubTasks[subTaskIndex] = {
            ...updatedSubTasks[subTaskIndex],
            completed: !updatedSubTasks[subTaskIndex].completed,
          };

          step.subTasks = updatedSubTasks;
          const allSubTasksCompleted = step.subTasks.every(st => st.completed);
          step.completed = allSubTasksCompleted;
        }
      } else if (!step.subTasks || step.subTasks.length === 0) {
        // Toggle step completion if no subTasks
        step.completed = !step.completed;
      }

      updatedSteps[stepIndex] = step;

      // Update the global playbook store if playbookId is provided
      if (playbookId) {
        const stats = calculateTaskStats(updatedSteps);

        // Get the current playbook from the store to preserve other fields
        const currentPlaybook = usePlaybookStore.getState().playbooks.find(p => p.id === playbookId);

        if (currentPlaybook) {
          const updatedPlaybook: Playbook = {
            ...currentPlaybook,
            actionSteps: updatedSteps,
            progress: stats.completed / Math.max(stats.total, 1),
            updatedAt: new Date().toISOString(),
            totalTasks: stats.total,
            status: stats.completed === stats.total && stats.total > 0 ? 'completed' : 'inProgress',
          };
          updatePlaybook(updatedPlaybook);
        }
      }

      return updatedSteps;
    });
  }, [playbookId, updatePlaybook, normalizeSubTask]);

  // Function to save action steps to the database
  // Accepts a playbookId and updates completedAt based on current state
  const saveActionSteps = useCallback(async (pbId: string) => {
    try {
      if (!pbId) {
        Logger.warn('[ActionStepsContext] No playbookId provided to saveActionSteps!', { component: 'ActionStepsContext' });
        return;
      }

      // Save action steps directly to database without relying on Zustand store
      await updatePlaybookActionSteps(pbId, actionSteps);

    } catch (error) {
      Logger.error('[ActionStepsContext] Error saving action steps', error as Error, { component: 'ActionStepsContext' });
      throw error;
    }
  }, [actionSteps]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    actionSteps,
    setActionSteps,
    handleToggleStep,
    handleAutoCheckStep,
    getCompletedStepsCount,
    saveActionSteps,
  }), [actionSteps, handleToggleStep, handleAutoCheckStep, getCompletedStepsCount, saveActionSteps]);

  return (
    <ActionStepsContext.Provider value={contextValue}>
      {children}
    </ActionStepsContext.Provider>
  );
};

export function useActionSteps() {
  const ctx = useContext(ActionStepsContext);
  if (!ctx) {throw new Error('useActionSteps must be used within an ActionStepsProvider');}
  return ctx;
}
