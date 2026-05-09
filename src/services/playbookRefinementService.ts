import { supabase } from './supabaseClient';
import type { Playbook } from '../interfaces/playbook';

export type PlaybookCorrectionType =
  | 'wrong_assumption'
  | 'missing_detail'
  | 'too_generic'
  | 'wrong_tone'
  | 'explain_more';

export interface RefinePlaybookRequest {
  playbookId: string;
  userId: string;
  userName: string;
  correctionType: PlaybookCorrectionType;
  clarification: string;
  bibleVersion?: string;
  dateOfBirth?: string;
}

export interface RefinePlaybookResponse {
  success: boolean;
  playbook: Playbook;
  refinementCount: number;
  refinementLimit: number;
  remainingRefinements: number;
}

export async function getPreferredBibleVersion(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const fromMeta = (user as any)?.user_metadata?.preferences?.content?.bibleVersion;
    if (typeof fromMeta === 'string' && fromMeta.trim()) {
      return fromMeta.trim();
    }
  } catch {}
  return 'NASB';
}

export async function refinePlaybook(request: RefinePlaybookRequest): Promise<RefinePlaybookResponse> {
  const bibleVersion = request.bibleVersion || await getPreferredBibleVersion();

  const { data, error } = await supabase.functions.invoke('refine-guided-playbook', {
    body: {
      ...request,
      bibleVersion,
    },
  });

  if (error) {
    const rawMessage = error.message || 'Unable to refine this playbook right now.';
    try {
      const parsed = JSON.parse(rawMessage);
      const e: any = new Error(parsed.message || rawMessage);
      e.code = parsed.error;
      e.refinementCount = parsed.refinementCount;
      e.refinementLimit = parsed.refinementLimit;
      throw e;
    } catch (parseError: any) {
      if (parseError?.code) {
        throw parseError;
      }
      throw new Error(rawMessage);
    }
  }

  if (!data?.success || !data?.playbook) {
    throw new Error(data?.message || 'Unable to refine this playbook right now.');
  }

  return data as RefinePlaybookResponse;
}
