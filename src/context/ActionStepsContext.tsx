import React, { createContext, useContext, useState, useCallback } from 'react';
import { updatePlaybookActionSteps } from '../services/supabaseApi';

export type SubTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type ActionStep = {
  id: string;
  title: string;
  description?: string;
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

export const ActionStepsProvider: React.FC<{ initialSteps: ActionStep[]; children: React.ReactNode }> = ({
  initialSteps,
  children,
}) => {
  const [actionSteps, setActionSteps] = useState<ActionStep[]>(initialSteps);

  const getCompletedStepsCount = () => {
    let completed = 0;
    let total = 0;

    actionSteps.forEach(step => {
      const subTasks = step.subTasks || [];
      const hasSubTasks = subTasks.length > 0;

      if (hasSubTasks) {
        // For steps with subtasks, count each subtask individually
        const completedSubTasks = subTasks.filter(st => st.completed).length;
        completed += completedSubTasks;
        total += subTasks.length;
      } else {
        // For steps without subtasks, count the step itself
        if (step.completed) {
          completed++;
        }
        total++;
      }
    });

    // Ensure we don't show more completed than total tasks
    if (completed > total) {
      console.warn('[WARNING] More completed tasks than total tasks!', { completed, total });
      completed = total;
    }

    console.log('[DEBUG] Task count:', { completed, total });
    return { completed, total };
  };

  const normalizeSubTask = (task: any, index: number, stepId: string): SubTask => {
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
    };
  };

  const handleToggleStep = (stepId: string, subTaskId?: string) => {
    console.log('[DEBUG] handleToggleStep called with:', { stepId, subTaskId });

    setActionSteps(prev => {
      // Create a deep copy of the previous state to ensure immutability
      const prevCopy = JSON.parse(JSON.stringify(prev));
      console.log('[DEBUG] Current steps before update:', JSON.stringify(prevCopy, null, 2));

      // Find the step to update
      const stepIndex = prevCopy.findIndex((step: any) => step.id === stepId);
      if (stepIndex === -1) {
        console.warn(`[WARNING] Step with id ${stepId} not found`);
        return prevCopy;
      }

      const step = prevCopy[stepIndex];

      // Ensure subTasks is an array and properly normalized
      if (!Array.isArray(step.subTasks)) {
        step.subTasks = [];
      } else {
        // Normalize any string subtasks to objects
        step.subTasks = step.subTasks.map((task: any, index: number) =>
          normalizeSubTask(task, index, stepId)
        );
      }

      // If toggling a sub-task
      if (subTaskId && step.subTasks.length > 0) {
        console.log('[DEBUG] Toggling subtask for step:', step.title);

        // Find the subtask by ID
        const subTaskIndex = step.subTasks.findIndex((st: any) => st.id === subTaskId);

        if (subTaskIndex === -1) {
          console.warn(`[WARNING] Subtask with id ${subTaskId} not found in step ${stepId}`);
          console.log('[DEBUG] Available subtask IDs:', step.subTasks.map((st: any) => ({
            id: st.id,
            text: st.text,
            type: typeof st,
          })));
          return prevCopy;
        }

        // Toggle the found subtask
        step.subTasks[subTaskIndex] = {
          ...step.subTasks[subTaskIndex],
          completed: !step.subTasks[subTaskIndex].completed,
        };

        console.log('[DEBUG] Updated subTasks:', JSON.stringify(step.subTasks, null, 2));

        // Check if all sub-tasks are completed
        const allSubTasksCompleted = step.subTasks.every((st: any) => st.completed);
        console.log('[DEBUG] All subtasks completed?', allSubTasksCompleted);

        // Update step completion status
        step.completed = allSubTasksCompleted;
      }
      // Toggle main step (only if no sub-tasks)
      else if (!step.subTasks || step.subTasks.length === 0) {
        console.log('[DEBUG] Toggling main step without subtasks:', step.title);
        step.completed = !step.completed;
      }

      // Create a new array to trigger re-render
      const updated = [...prevCopy];

      console.log('[DEBUG] Steps after update:', JSON.stringify(updated, null, 2));

      // Verify the state is actually different
      const stateChanged = JSON.stringify(prev) !== JSON.stringify(updated);
      console.log('[DEBUG] State changed?', stateChanged);

      if (!stateChanged) {
        console.warn('[WARNING] State did not change after toggle!');
      }

      return updated;
    });
  };

  // Function to save action steps to the database
  const saveActionSteps = useCallback(async (playbookId: string) => {
    try {
      console.log('[ActionStepsContext] Saving action steps for playbook:', playbookId);
      await updatePlaybookActionSteps(playbookId, actionSteps);
      console.log('[ActionStepsContext] Successfully saved action steps');
    } catch (error) {
      console.error('[ActionStepsContext] Error saving action steps:', error);
      throw error;
    }
  }, [actionSteps]);

  return (
    <ActionStepsContext.Provider value={{
      actionSteps,
      setActionSteps,
      handleToggleStep,
      getCompletedStepsCount,
      saveActionSteps,
    }}>
      {children}
    </ActionStepsContext.Provider>
  );
};

export function useActionSteps() {
  const ctx = useContext(ActionStepsContext);
  if (!ctx) {throw new Error('useActionSteps must be used within an ActionStepsProvider');}
  return ctx;
}
