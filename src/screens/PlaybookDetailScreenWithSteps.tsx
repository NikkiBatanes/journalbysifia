// This is a wrapper for PlaybookDetailScreen that provides ActionStepsContext.
import React from 'react';
import PlaybookDetailScreen from './PlaybookDetailScreen';
import { ActionStepsProvider } from '../context/ActionStepsContext';
import { Playbook } from '../interfaces/playbook';

export default function PlaybookDetailScreenWithSteps(props: any) {
  const playbook: Playbook = props.route?.params?.playbook;
  // Defensive: fallback to empty array if undefined
  const initialSteps = playbook?.actionSteps || [];

  return (
    <ActionStepsProvider initialSteps={initialSteps}>
      <PlaybookDetailScreen {...props} />
    </ActionStepsProvider>
  );
}
