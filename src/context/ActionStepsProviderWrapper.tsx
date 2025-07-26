// src/context/ActionStepsProviderWrapper.tsx
import React, { ReactNode } from 'react';
import { ActionStepsProvider } from './ActionStepsContext';

interface ActionStepsProviderWrapperProps {
  initialSteps: any[];
  children: ReactNode;
  playbookId?: string;
}

export default function ActionStepsProviderWrapper({ initialSteps, children, playbookId }: ActionStepsProviderWrapperProps) {
  return (
    <ActionStepsProvider initialSteps={initialSteps} playbookId={playbookId}>
      {children}
    </ActionStepsProvider>
  );
}
