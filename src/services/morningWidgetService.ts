import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { differenceInCalendarDays } from 'date-fns';

import { toLocalDateString } from '../utils/date';
import { safeJsonParse } from '../utils/safeJsonParse';
import { getRoutineState } from '../storage/routineStateStorage';
import {
  getLocalJournalSingleton,
  getLocalTodosForDate,
} from '../storage/journalStorage';
import { getLocalReflections } from '../storage/reflectionStorage';
import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { applyWidgetFeelingSelection } from './morningCheckInService';

/**
 * Morning Home Screen widget sync.
 *
 * React Native AsyncStorage remains the canonical store. This service writes a
 * minimal "projection" into the App Group container (via MorningWidgetBridge)
 * so the WidgetKit extension can render without touching app-private storage.
 *
 * Write-back model: the widget App Intent cannot reach AsyncStorage, so it
 * records a pending check-in in the App Group. The app consumes that pending
 * action on the next foreground/deep-link and writes it through the SAME
 * canonical path used by EmotionCheckInScreen (morningCheckInService), then
 * rewrites the snapshot.
 */

interface MorningWidgetBridgeModule {
  updateSnapshot(snapshot: Record<string, unknown>): Promise<void>;
  consumePendingCheckIn(): Promise<{ feelingId?: string; date?: string } | null>;
  reloadTimelines(): void;
}

const Bridge: MorningWidgetBridgeModule | undefined =
  Platform.OS === 'ios'
    ? (NativeModules.MorningWidgetBridge as MorningWidgetBridgeModule | undefined)
    : undefined;

interface WidgetPriority {
  text: string;
  completed: boolean;
}

const isMorningPsalmReflection = (entry: { source?: string; metadata?: Record<string, any> }): boolean =>
  entry.source === 'morning_psalm' || entry.metadata?.source === 'morning_psalm';

const getTodayPsalmNumber = async (): Promise<number | undefined> => {
  try {
    const { data } = await supabase.auth.getUser();
    const createdAt = (data?.user as any)?.created_at;
    const now = new Date();
    const start = createdAt ? new Date(createdAt) : now;
    return (Math.max(0, differenceInCalendarDays(now, start)) % 150) + 1;
  } catch {
    return undefined;
  }
};

/** Build the minimal widget projection from canonical stores for TODAY. */
export const refreshMorningWidgetSnapshot = async (): Promise<void> => {
  if (!Bridge?.updateSnapshot) { return; }

  try {
    const today = toLocalDateString(new Date());
    const [routine, checkInEntry, focusEntry, todos, scriptureReflections] = await Promise.all([
      getRoutineState('morning', today),
      getLocalJournalSingleton('morning_check_in', today),
      getLocalJournalSingleton('todays_focus', today),
      getLocalTodosForDate(today),
      getLocalReflections('scripture', today),
    ]);

    const checkIn = checkInEntry
      ? safeJsonParse<Record<string, any>>(checkInEntry.content, { fallback: {} }) || {}
      : {};
    const focus = focusEntry
      ? safeJsonParse<Record<string, any>>(focusEntry.content, { fallback: {} }) || {}
      : {};
    const psalm = scriptureReflections.find(isMorningPsalmReflection);
    const psalmMetadata = psalm?.metadata ?? {};

    const priorities: WidgetPriority[] = Array.isArray(focus.priorities)
      ? focus.priorities
          .filter((p: any) => typeof p?.text === 'string' && p.text.trim().length > 0)
          .map((p: any) => ({ text: p.text, completed: p.completed === true }))
      : [];

    const openTodos = todos.filter(entry => {
      const content = safeJsonParse<Record<string, any>>(entry.content, { fallback: {} }) || {};
      return !(content.completed ?? entry.completed ?? false);
    });

    const snapshot: Record<string, unknown> = {
      date: today,
      routineStarted: Boolean(routine),
      routineCompleted: routine?.completed === true,
      completedSteps: routine?.completed_steps ?? [],
      feeling: typeof checkIn.feeling === 'string' && checkIn.feeling ? checkIn.feeling : null,
      feelingIcon: typeof checkIn.feelingIcon === 'string' ? checkIn.feelingIcon : null,
      psalmNumber:
        typeof psalmMetadata.psalmNumber === 'number'
          ? psalmMetadata.psalmNumber
          : await getTodayPsalmNumber(),
      psalmRead: psalmMetadata.psalmRead === true,
      selectedPsalmAttributes: Array.isArray(psalmMetadata.selectedAttributes)
        ? psalmMetadata.selectedAttributes
        : psalmMetadata.customAttribute
          ? [psalmMetadata.customAttribute]
          : [],
      focus: typeof focus.focus === 'string' && focus.focus ? focus.focus : null,
      personalFocus: typeof focus.personalText === 'string' && focus.personalText ? focus.personalText : null,
      priorities,
      todoCount: todos.length,
      openTodoCount: openTodos.length,
    };

    await Bridge.updateSnapshot(snapshot);
  } catch (error) {
    Logger.warn('Failed to refresh morning widget snapshot', {
      component: 'morningWidgetService',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Consume a feeling selected on the Home Screen and write it through the
 * canonical check-in path. Stale (non-today) pending actions are discarded.
 */
export const reconcileMorningWidgetActions = async (): Promise<void> => {
  if (!Bridge?.consumePendingCheckIn) { return; }

  try {
    const pending = await Bridge.consumePendingCheckIn().catch(() => null);
    if (!pending?.feelingId) { return; }

    const today = toLocalDateString(new Date());
    if (pending.date && pending.date !== today) { return; }

    await applyWidgetFeelingSelection(today, pending.feelingId);
  } catch (error) {
    Logger.warn('Failed to reconcile morning widget actions', {
      component: 'morningWidgetService',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
};

/** Reconcile pending widget writes, then push a fresh snapshot. */
export const syncMorningWidget = async (): Promise<void> => {
  await reconcileMorningWidgetActions();
  await refreshMorningWidgetSnapshot();
};

let listenersInitialized = false;

/**
 * App-level wiring: refresh the widget whenever morning-relevant events fire.
 * Todo mutations (which do not emit reflection_saved) are hooked separately in
 * the React Query mutation hooks.
 */
export const initMorningWidgetSync = (): void => {
  if (Platform.OS !== 'ios' || listenersInitialized) { return; }
  listenersInitialized = true;

  const refresh = () => { void refreshMorningWidgetSnapshot(); };
  DeviceEventEmitter.addListener('reflection_saved', refresh);
  DeviceEventEmitter.addListener('morning_complete', refresh);
  DeviceEventEmitter.addListener('future_plan_saved', refresh);
  void syncMorningWidget();
};
