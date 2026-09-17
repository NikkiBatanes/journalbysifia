import { DeviceEventEmitter } from 'react-native';

import { getMorningCheckInPoolKey } from '../data/morningCheckInScriptures';
import { safeJsonParse } from '../utils/safeJsonParse';
import {
  getLocalJournalSingleton,
  saveLocalJournalSingleton,
  LocalJournalEntry,
} from '../storage/journalStorage';
import { updateRoutineState, ContentRef } from '../storage/routineStateStorage';

/**
 * Canonical Morning check-in helpers.
 *
 * The feeling lists and the save behavior here are the single source of truth
 * shared by EmotionCheckInScreen and the Home Screen widget write-back path.
 * Do NOT fork the pool-preservation rules: when the newly selected feeling
 * maps to the same scripture pool, the existing `underneathIt` text and
 * `scripture` selection are preserved; otherwise they are reset.
 */

export interface MorningFeeling {
  id: string;
  name: string;
  icon: string;
  iconType: 'ionicons' | 'material';
}

export const MORNING_INITIAL_FEELINGS: MorningFeeling[] = [
  { id: 'peaceful', name: 'Peaceful', icon: 'leaf-outline', iconType: 'ionicons' },
  { id: 'grateful', name: 'Grateful', icon: 'hand-heart', iconType: 'material' },
  { id: 'hopeful', name: 'Hopeful', icon: 'sunny-outline', iconType: 'ionicons' },
  { id: 'joyful', name: 'Joyful', icon: 'happy-outline', iconType: 'ionicons' },
  { id: 'anxious', name: 'Anxious', icon: 'cloudy-outline', iconType: 'ionicons' },
  { id: 'tired', name: 'Tired', icon: 'sleep', iconType: 'material' },
  { id: 'overwhelmed', name: 'Overwhelmed', icon: 'waves', iconType: 'material' },
  { id: 'sad', name: 'Sad', icon: 'emoticon-sad-outline', iconType: 'material' },
  { id: 'frustrated', name: 'Frustrated', icon: 'emoticon-angry-outline', iconType: 'material' },
  { id: 'excited', name: 'Excited', icon: 'sparkles-outline', iconType: 'ionicons' },
  { id: 'calm', name: 'Calm', icon: 'water-outline', iconType: 'ionicons' },
  { id: 'content', name: 'Content', icon: 'cafe-outline', iconType: 'ionicons' },
];

export const MORNING_MORE_FEELINGS: MorningFeeling[] = [
  { id: 'stressed', name: 'Stressed', icon: 'alert-circle-outline', iconType: 'ionicons' },
  { id: 'lonely', name: 'Lonely', icon: 'person-outline', iconType: 'ionicons' },
  { id: 'confident', name: 'Confident', icon: 'trophy-outline', iconType: 'ionicons' },
  { id: 'worried', name: 'Worried', icon: 'cloudy-night-outline', iconType: 'ionicons' },
  { id: 'restless', name: 'Restless', icon: 'flash-outline', iconType: 'ionicons' },
  { id: 'inspired', name: 'Inspired', icon: 'bulb-outline', iconType: 'ionicons' },
  { id: 'bored', name: 'Bored', icon: 'time-outline', iconType: 'ionicons' },
  { id: 'angry', name: 'Angry', icon: 'flame-outline', iconType: 'ionicons' },
  { id: 'discouraged', name: 'Discouraged', icon: 'rainy-outline', iconType: 'ionicons' },
  { id: 'brave', name: 'Brave', icon: 'shield-outline', iconType: 'ionicons' },
  { id: 'hopeless', name: 'Hopeless', icon: 'cloudy-outline', iconType: 'ionicons' },
  { id: 'grumpy', name: 'Grumpy', icon: 'thunderstorm-outline', iconType: 'ionicons' },
  { id: 'stuck', name: 'Stuck', icon: 'help-circle-outline', iconType: 'ionicons' },
  { id: 'loved', name: 'Loved', icon: 'heart-outline', iconType: 'ionicons' },
  { id: 'other', name: 'Other', icon: 'plus-circle', iconType: 'material' },
];

export const MORNING_ALL_FEELINGS: MorningFeeling[] = [
  ...MORNING_INITIAL_FEELINGS,
  ...MORNING_MORE_FEELINGS,
];

export const findMorningFeeling = (idOrName: string | undefined): MorningFeeling | undefined => {
  if (!idOrName) { return undefined; }
  const normalized = idOrName.trim().toLowerCase();
  return MORNING_ALL_FEELINGS.find(
    feeling => feeling.id === normalized || feeling.name.toLowerCase() === normalized,
  );
};

/**
 * Save a feeling selection into the canonical `morning_check_in` singleton.
 *
 * This is the exact behavior previously inlined in EmotionCheckInScreen.onNext:
 * - preserves `underneathIt`/`scripture` when the new feeling maps to the same
 *   scripture pool, resets them otherwise;
 * - `feelingNameOverride` supports the "Other" free-text feeling.
 */
export const saveMorningFeeling = async (
  dateStr: string,
  feeling: MorningFeeling,
  feelingNameOverride?: string,
): Promise<LocalJournalEntry> => {
  const feelingName = (feelingNameOverride ?? feeling.name).trim();
  const existing = await getLocalJournalSingleton('morning_check_in', dateStr);
  const existingContent = existing
    ? safeJsonParse<Record<string, any>>(existing.content, { fallback: {} }) || {}
    : {};

  const newPoolKey = getMorningCheckInPoolKey(feeling.id);
  const existingPoolKey = existingContent.scripture?.poolKey
    ? existingContent.scripture.poolKey
    : getMorningCheckInPoolKey(existingContent.feeling);
  const samePool = existingPoolKey && newPoolKey === existingPoolKey;

  const nextUnderneathIt = samePool && existingContent.underneathIt !== undefined
    ? existingContent.underneathIt
    : '';

  const nextScripture = samePool && existingContent.scripture?.reference
    ? { ...existingContent.scripture, poolKey: existingContent.scripture.poolKey || newPoolKey }
    : undefined;

  const content = JSON.stringify({
    feeling: feelingName,
    feelingIcon: feeling.icon,
    feelingIconType: feeling.iconType,
    underneathIt: nextUnderneathIt,
    ...(nextScripture ? { scripture: nextScripture } : {}),
  });

  const record = await saveLocalJournalSingleton('morning_check_in', dateStr, content);
  DeviceEventEmitter.emit('reflection_saved', { type: 'morning_check_in', date: dateStr });
  return record;
};

/**
 * Mark the `emotion` routine step completed outside of RoutineContext.
 * Mirrors RoutineContext.markStepCompleted('emotion', ref, 'morning_check_in').
 */
export const completeMorningEmotionStep = async (
  dateStr: string,
  record: LocalJournalEntry,
): Promise<void> => {
  const ref: ContentRef = {
    domain: 'journal',
    content_type: 'morning_check_in',
    local_id: record.id,
  };
  await updateRoutineState('morning', dateStr, current => {
    const currentSteps = current?.completed_steps ?? [];
    const nextCompletedSteps = currentSteps.includes('emotion')
      ? currentSteps
      : [...currentSteps, 'emotion'];
    const nextContentRefs = { ...(current?.content_refs ?? {}) };
    nextContentRefs['morning_check_in'] = ref;
    return {
      completed_steps: nextCompletedSteps,
      content_refs: nextContentRefs,
    };
  });
};

/**
 * Apply a feeling selected from the Home Screen widget.
 * Produces state indistinguishable from picking the feeling in
 * EmotionCheckInScreen: canonical singleton write + `emotion` step completion.
 */
export const applyWidgetFeelingSelection = async (
  dateStr: string,
  feelingId: string,
): Promise<LocalJournalEntry | null> => {
  const feeling = findMorningFeeling(feelingId);
  if (!feeling || feeling.id === 'other') { return null; }
  const record = await saveMorningFeeling(dateStr, feeling);
  await completeMorningEmotionStep(dateStr, record);
  return record;
};
