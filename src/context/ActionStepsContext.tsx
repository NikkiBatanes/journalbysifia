import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { updatePlaybookActionSteps, calculateTaskStats } from '../services/apiIntegration';
import { usePlaybookStore } from '../store/usePlaybookStore';
import { Playbook } from '../interfaces/playbook';

export type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  detected_journal_type?: string;
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
  const [actionSteps, setActionSteps] = useState<ActionStep[]>(initialSteps);
  const { updatePlaybook } = usePlaybookStore();

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
      console.warn('[WARNING] More completed tasks than total tasks!', { completed, total });
      completed = total;
    }

    return { completed, total };
  }, [actionSteps]);

  const normalizeSubTask = useCallback((task: SubTask | string, index: number, stepId: string): SubTask => {
    if (typeof task === 'string') {
      return {
        id: `${stepId}-subtask-${index}`,
        text: task,
        completed: false,
      };
    }
    // Ensure the task has all required properties
    return {
      id: task.id || `${stepId}-subtask-${index}`,
      text: task.text || '',
      completed: Boolean(task.completed),
      detected_journal_type: task.detected_journal_type || 'none', // Preserve smart journaling data
    };
  }, []);

  // Helper to determine if all steps/subtasks are completed
  const areAllStepsCompleted = useCallback((steps: ActionStep[]): boolean => {
    const { completed, total } = calculateTaskStats(steps);
    return total > 0 && completed === total;
  }, []);

  const handleToggleStep = useCallback((stepId: string, subTaskId?: string) => {

    setActionSteps(prev => {
      const prevCopy = [...prev];
      const stepIndex = prevCopy.findIndex(step => step.id === stepId);

      if (stepIndex === -1) {
        console.warn(`[WARNING] Step with id ${stepId} not found`);
        return prevCopy;
      }

      const updatedSteps = [...prevCopy];
      const step = { ...updatedSteps[stepIndex] };

      // Ensure subTasks is an array
      if (!Array.isArray(step.subTasks)) {
        step.subTasks = [];
      } else {
        step.subTasks = step.subTasks.map((task, index) =>
          normalizeSubTask(task, index, stepId)
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
        console.warn('[ActionStepsContext] No playbookId provided to saveActionSteps!');
        return;
      }

      const stats = calculateTaskStats(actionSteps);
      const allCompleted = areAllStepsCompleted(actionSteps);

      // Save action steps directly to database without relying on Zustand store
      await updatePlaybookActionSteps(pbId, actionSteps);

    } catch (error) {
      console.error('[ActionStepsContext] Error saving action steps:', error);
      throw error;
    }
  }, [actionSteps, areAllStepsCompleted]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    actionSteps,
    setActionSteps,
    handleToggleStep,
    getCompletedStepsCount,
    saveActionSteps,
  }), [actionSteps, handleToggleStep, getCompletedStepsCount, saveActionSteps]);

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
