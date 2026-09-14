import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { toLocalDateString } from '../utils/date';
import { saveRoutineState, getRoutineState, ContentRef } from '../storage/routineStateStorage';

export interface RoutineContextValue {
  routine: 'morning' | 'evening';
  selectedDate: string;
  startedAt?: string;
  completedSteps: string[];
  contentRefs: Record<string, ContentRef | ContentRef[]>;
  markStepCompleted: (step: string, ref?: ContentRef) => Promise<void>;
  completeRoutine: () => Promise<void>;
  getContentRef: (step: string) => ContentRef | ContentRef[] | undefined;
  isLoading: boolean;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const route = useRoute<any>();
  const routine = route.params?.routine ?? 'morning';
  const dateParam = route.params?.selectedDate;

  const selectedDate = useMemo(() => {
    if (dateParam) {
      return toLocalDateString(new Date(dateParam));
    }
    return toLocalDateString(new Date());
  }, [dateParam]);

  const [state, setState] = useState<{
    completedSteps: string[];
    contentRefs: Record<string, ContentRef | ContentRef[]>;
    startedAt?: string;
    completed: boolean;
    isLoading: boolean;
  }>({
    completedSteps: [],
    contentRefs: {},
    completed: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await getRoutineState(routine, selectedDate);
      if (!mounted) {return;}

      if (existing) {
        setState({
          completedSteps: existing.completed_steps ?? [],
          contentRefs: existing.content_refs ?? {},
          startedAt: existing.started_at,
          completed: existing.completed,
          isLoading: false,
        });
      } else {
        const startedAt = new Date().toISOString();
        const created = await saveRoutineState(routine, selectedDate, {
          completed: false,
          completed_steps: [],
          content_refs: {},
          started_at: startedAt,
        });
        if (mounted) {
          setState({
            completedSteps: created.completed_steps,
            contentRefs: created.content_refs ?? {},
            startedAt: created.started_at,
            completed: false,
            isLoading: false,
          });
        }
      }
    })();

    return () => { mounted = false; };
  }, [routine, selectedDate]);

  const markStepCompleted = useCallback(async (step: string, ref?: ContentRef) => {
    setState(prev => {
      const nextCompletedSteps = prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step];

      const nextContentRefs = { ...prev.contentRefs };
      if (ref) {
        const existing = nextContentRefs[step];
        if (existing) {
          const list = Array.isArray(existing) ? [...existing] : [existing];
          list.push(ref);
          nextContentRefs[step] = list;
        } else {
          nextContentRefs[step] = ref;
        }
      }

      (async () => {
        await saveRoutineState(routine, selectedDate, {
          completed_steps: nextCompletedSteps,
          content_refs: nextContentRefs,
        });
      })();

      return {
        ...prev,
        completedSteps: nextCompletedSteps,
        contentRefs: nextContentRefs,
      };
    });
  }, [routine, selectedDate]);

  const completeRoutine = useCallback(async () => {
    await saveRoutineState(routine, selectedDate, { completed: true });
    setState(prev => ({ ...prev, completed: true }));
  }, [routine, selectedDate]);

  const getContentRef = useCallback((step: string) => {
    return state.contentRefs[step];
  }, [state.contentRefs]);

  const value: RoutineContextValue = useMemo(() => ({
    routine,
    selectedDate,
    startedAt: state.startedAt,
    completedSteps: state.completedSteps,
    contentRefs: state.contentRefs,
    markStepCompleted,
    completeRoutine,
    getContentRef,
    isLoading: state.isLoading,
  }), [routine, selectedDate, state, markStepCompleted, completeRoutine, getContentRef]);

  return (
    <RoutineContext.Provider value={value}>
      {children}
    </RoutineContext.Provider>
  );
};

export const useRoutine = (): RoutineContextValue => {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error('useRoutine must be used within a RoutineProvider');
  }
  return context;
};
