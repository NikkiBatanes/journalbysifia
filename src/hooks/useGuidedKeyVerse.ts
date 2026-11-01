import {useCallback, useEffect, useMemo, useState} from 'react';

import {
  getCachedScripturePassage,
  getScripturePassage,
  type ScriptureReaderResult,
} from '../services/scriptureReaderService';

interface KeyVerseState {
  key: string;
  result: ScriptureReaderResult | null;
  loading: boolean;
  error: string | null;
}

export const useGuidedKeyVerse = (reference: string, bibleVersion: string) => {
  const version = bibleVersion.trim().toUpperCase() || 'NASB';
  const key = `${version}:${reference}`;
  const initialResult = useMemo(
    () => getCachedScripturePassage(reference, version),
    [reference, version],
  );
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<KeyVerseState>({
    key,
    result: initialResult,
    loading: !initialResult,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const cached = getCachedScripturePassage(reference, version);
    setState({key, result: cached, loading: !cached, error: null});

    getScripturePassage(reference, version)
      .then(result => {
        if (active) {
          setState({key, result, loading: false, error: null});
        }
      })
      .catch(error => {
        if (active) {
          setState({
            key,
            result: null,
            loading: false,
            error: error instanceof Error
              ? error.message
              : 'This key verse could not be loaded right now.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [key, reference, retryToken, version]);

  const current = state.key === key
    ? state
    : {key, result: initialResult, loading: !initialResult, error: null};

  return {
    text: current.result?.text ?? '',
    version: current.result?.version ?? version,
    loading: current.loading,
    error: current.error,
    retry: useCallback(() => setRetryToken(value => value + 1), []),
  };
};
