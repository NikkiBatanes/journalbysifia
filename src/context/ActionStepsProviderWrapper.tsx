// src/context/ActionStepsProviderWrapper.tsx
import React, { ReactNode } from 'react';
import { ActionStepsProvider } from './ActionStepsContext';

interface ActionStepsProviderWrapperProps {
  initialSteps: any[];
  children: ReactNode;
}

export default function ActionStepsProviderWrapper({ initialSteps, children }: ActionStepsProviderWrapperProps) {
  return (
    <ActionStepsProvider initialSteps={initialSteps}>
      {children}
    </ActionStepsProvider>
  );
}
