import React, { createContext, useContext, useState } from 'react';

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
      if (step.subTasks && step.subTasks.length > 0) {
        const completedSubTasks = step.subTasks.filter(st => st.completed).length;
        completed += completedSubTasks;
        total += step.subTasks.length;
      } else {
        if (step.completed) {completed++;}
        total++;
      }
    });

    return { completed, total };
  };

  const handleToggleStep = (stepId: string, subTaskId?: string) => {
    setActionSteps(prev =>
      prev.map(step => {
        if (step.id !== stepId) {return step;}

        // If toggling a sub-task
        if (subTaskId && step.subTasks) {
          const updatedSubTasks = step.subTasks.map(st =>
            st.id === subTaskId ? { ...st, completed: !st.completed } : st
          );

          // Check if all sub-tasks are completed
          const allSubTasksCompleted = updatedSubTasks.every(st => st.completed);

          return {
            ...step,
            subTasks: updatedSubTasks,
            completed: allSubTasksCompleted,
          };
        }

        // Toggle main step (only if no sub-tasks)
        if (!step.subTasks || step.subTasks.length === 0) {
          return { ...step, completed: !step.completed };
        }

        return step;
      })
    );
  };

  return (
    <ActionStepsContext.Provider value={{
      actionSteps,
      setActionSteps,
      handleToggleStep,
      getCompletedStepsCount,
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
