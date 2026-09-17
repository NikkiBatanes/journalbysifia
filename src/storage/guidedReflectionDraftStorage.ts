import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GuidedReflectionPayload } from '../types/guidedReflection';
import { parseGuidedReflection } from '../types/guidedReflection';

const prefix = 'guided_reflection_draft_v1';
export const guidedReflectionDraftKey = (date: string, pathId: string) => `${prefix}:${date}:${pathId}`;

export const saveGuidedReflectionDraft = async (date: string, payload: GuidedReflectionPayload) => {
  await AsyncStorage.setItem(guidedReflectionDraftKey(date, payload.pathId), JSON.stringify(payload));
};
export const loadGuidedReflectionDraft = async (date: string, pathId: string) => parseGuidedReflection(await AsyncStorage.getItem(guidedReflectionDraftKey(date, pathId)));
export const clearGuidedReflectionDraft = async (date: string, pathId: string) => AsyncStorage.removeItem(guidedReflectionDraftKey(date, pathId));
