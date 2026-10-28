import React from 'react';
import {getActiveReviewQAContext} from '../dev/reviews/reviewQALoader';
import {getOrCreateScriptureSequenceAnchor, validSequenceDate} from '../services/scriptureSequenceAnchor';
import {useAuth} from '../context/IndustryStandardAuthContext';

type AnchorValue = string | null | undefined;

/** Wait for a durable local/signup date, or an active development QA scenario. */
export const useDailyScriptureSequenceAnchor = (accountCreatedAt: AnchorValue) => {
  const {bootstrapping} = useAuth();
  const [attempt, retry] = React.useReducer(value => value + 1, 0);
  const [state, setState] = React.useState<{
    anchor: AnchorValue; ready: boolean; error: string | null; accountCreatedAt: AnchorValue;
  }>({
    anchor: undefined,
    accountCreatedAt,
    ready: false,
    error: null,
  });

  React.useEffect(() => {
    let active = true;
    setState({anchor: undefined, accountCreatedAt, ready: false, error: null});
    if (bootstrapping) {return () => {active = false;};}
    (async () => {
      const qaContext = __DEV__ ? await getActiveReviewQAContext() : null;
      return validSequenceDate(qaContext?.historyStart)
        || await getOrCreateScriptureSequenceAnchor(accountCreatedAt);
    })()
      .then(anchor => {
        if (active) {
          setState({anchor, accountCreatedAt, ready: true, error: null});
        }
      })
      .catch(() => {
        if (active) {
          setState({anchor: undefined, accountCreatedAt, ready: false,
            error: 'Could not load your reading schedule. Tap to retry.'});
        }
      });
    return () => {active = false;};
  }, [accountCreatedAt, bootstrapping, attempt]);

  return {...state, ready: state.ready && !bootstrapping && state.accountCreatedAt === accountCreatedAt, retry};
};
