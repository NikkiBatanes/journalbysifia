import React, { createContext, useContext, useState } from 'react';

export type ActionStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
};

type ActionStepsContextType = {
  actionSteps: ActionStep[];
  setActionSteps: React.Dispatch<React.SetStateAction<ActionStep[]>>;
  handleToggleStep: (stepId: string) => void;
};

const ActionStepsContext = createContext<ActionStepsContextType | undefined>(undefined);

export const ActionStepsProvider: React.FC<{ initialSteps: ActionStep[]; children: React.ReactNode }> = ({
  initialSteps,
  children,
}) => {
  const [actionSteps, setActionSteps] = useState<ActionStep[]>(initialSteps);

  const handleToggleStep = (stepId: string) => {
    setActionSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, completed: !step.completed } : step
      )
    );
  };

  return (
    <ActionStepsContext.Provider value={{ actionSteps, setActionSteps, handleToggleStep }}>
      {children}
    </ActionStepsContext.Provider>
  );
};

export function useActionSteps() {
  const ctx = useContext(ActionStepsContext);
  if (!ctx) throw new Error('useActionSteps must be used within an ActionStepsProvider');
  return ctx;
}
