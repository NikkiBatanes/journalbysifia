import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY} from '../services/dailyScriptureSequence';
import {getActiveReviewQAContext} from '../dev/reviews/reviewQALoader';

type AnchorValue = string | null | undefined;

/** Uses the real signup date in production and the simulated signup date in Review QA. */
export const useDailyScriptureSequenceAnchor = (accountCreatedAt: AnchorValue) => {
  const [state, setState] = React.useState<{anchor: AnchorValue; ready: boolean}>({
    anchor: accountCreatedAt,
    ready: false,
  });

  React.useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY),
      __DEV__ ? getActiveReviewQAContext() : Promise.resolve(null),
    ])
      .then(([override, qaContext]) => {
        if (active) {
          setState({
            anchor: qaContext?.historyStart || override || accountCreatedAt,
            ready: true,
          });
        }
      })
      .catch(() => {
        if (active) {setState({anchor: accountCreatedAt, ready: true});}
      });
    return () => {active = false;};
  }, [accountCreatedAt]);

  return state;
};
