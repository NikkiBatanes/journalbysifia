import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toLocalDateString } from '../utils/date';
import { saveRoutineState, updateRoutineState, ContentRef } from '../storage/routineStateStorage';
import { refreshMorningWidgetSnapshot } from '../services/morningWidgetService';

export interface RoutineContextValue {
  routine: 'morning' | 'evening';
  selectedDate: string;
  startedAt?: string;
  completedSteps: string[];
  contentRefs: Record<string, ContentRef | ContentRef[]>;
  completed: boolean;
  markStepCompleted: (step: string, ref?: ContentRef | ContentRef[], refKey?: string) => Promise<void>;
  completeRoutine: () => Promise<void>;
  getContentRef: (step: string) => ContentRef | ContentRef[] | undefined;
  isLoading: boolean;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

interface RoutineProviderProps {
  children: React.ReactNode;
  routine: 'morning' | 'evening';
  selectedDate?: string;
}

export const RoutineProvider: React.FC<RoutineProviderProps> = ({ children, routine, selectedDate: dateParam }) => {

  const selectedDate = useMemo(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
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
      const persisted = await saveRoutineState(routine, selectedDate, {});
      if (mounted) {
        setState({
          completedSteps: persisted.completed_steps ?? [],
          contentRefs: persisted.content_refs ?? {},
          startedAt: persisted.started_at,
          completed: persisted.completed,
          isLoading: false,
        });
      }
    })();

    return () => { mounted = false; };
  }, [routine, selectedDate]);

  const markStepCompleted = useCallback(async (step: string, ref?: ContentRef | ContentRef[], refKey?: string) => {
    const saved = await updateRoutineState(routine, selectedDate, current => {
      const currentSteps = current?.completed_steps ?? [];
      const nextCompletedSteps = currentSteps.includes(step) ? currentSteps : [...currentSteps, step];
      const nextContentRefs = { ...(current?.content_refs ?? {}) };
      if (ref) {
        const key = refKey ?? step;
        if (Array.isArray(ref)) {
          nextContentRefs[key] = ref;
        } else if (refKey) {
          nextContentRefs[key] = ref;
        } else {
          const existing = nextContentRefs[key];
          if (existing) {
            const list = Array.isArray(existing) ? [...existing] : [existing];
            const duplicate = list.some(r => r.local_id === ref.local_id && r.domain === ref.domain && r.content_type === ref.content_type);
            if (!duplicate) {
              list.push(ref);
            }
            nextContentRefs[key] = list;
          } else {
            nextContentRefs[key] = ref;
          }
        }
      }

      return {
        completed_steps: nextCompletedSteps,
        content_refs: nextContentRefs,
      };
    });
    setState(prev => ({
      ...prev,
      completedSteps: saved.completed_steps,
      contentRefs: saved.content_refs ?? {},
      startedAt: saved.started_at,
      completed: saved.completed,
    }));
    if (routine === 'morning') {
      void refreshMorningWidgetSnapshot();
    }
  }, [routine, selectedDate]);

  const completeRoutine = useCallback(async () => {
    const saved = await updateRoutineState(routine, selectedDate, () => ({ completed: true }));
    setState(prev => ({ ...prev, completed: saved.completed }));
    if (routine === 'morning') {
      void refreshMorningWidgetSnapshot();
    }
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
    completed: state.completed,
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
