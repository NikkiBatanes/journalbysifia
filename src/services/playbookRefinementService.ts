import { supabase } from './supabaseClient';
import type { Playbook } from '../interfaces/playbook';

export type PlaybookCorrectionType =
  | 'wrong_assumption'
  | 'missing_detail'
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
  isOnboarding?: boolean;
  isBeatBased?: boolean;
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
  const defaultMessage = 'siFia could not revise this playbook right now. Your current playbook is still here. Please try again in a moment.';

  const functionName = request.isBeatBased ? 'refine-guided-playbook-v146test' : 'refine-guided-playbook';

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      ...request,
      bibleVersion,
    },
  });

  if (error) {
    let parsed: any = null;

    try {
      if (error.context && typeof error.context.json === 'function') {
        parsed = await error.context.json();
      }
    } catch {}

    if (!parsed && error.message) {
      try {
        parsed = JSON.parse(error.message);
      } catch {}
    }

    const e: any = new Error(parsed?.message || defaultMessage);
    e.code = parsed?.error || error.name || 'REFINEMENT_FAILED';
    e.refinementCount = parsed?.refinementCount;
    e.refinementLimit = parsed?.refinementLimit;
    throw e;
  }

  if (!data?.success || !data?.playbook) {
    const e: any = new Error(data?.message || defaultMessage);
    e.code = data?.error || 'REFINEMENT_FAILED';
    throw e;
  }

  return data as RefinePlaybookResponse;
}
