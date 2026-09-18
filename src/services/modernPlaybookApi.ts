/**
 * Modern Playbook API
 * Uses direct Supabase session without AsyncStorage dependencies
 * Replaces legacy playbook operations with modern implementations
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { Playbook, ActionStep } from '../interfaces/playbook';
import { ensureValidUUID } from '../utils/uuidUtils';
import { AUTH_ERROR_MESSAGES } from '../constants/sessionConstants';

const isNetworkError = (error: any): boolean => Boolean(
  error?.message?.includes('Network request failed') ||
  error?.message?.includes('Network Error') ||
  error?.message?.includes('fetch') ||
  ['NETWORK_ERROR', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)
);

/**
 * Robust session retrieval with retry logic
 * Handles race conditions during operation protection periods
 */
async function getSessionWithRetry(retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        Logger.warn(`Session retrieval error (attempt ${i + 1}/${retries}):`, {
  component: 'modernPlaybookApi',
  data: sessionError,
});
        if (i === retries - 1) {throw sessionError;}
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }

      if (!session) {
        Logger.warn(`No session found (attempt ${i + 1}/${retries})`, {
      component: 'modernPlaybookApi',
    });
        if (i === retries - 1) {
          // Final attempt - try to refresh session
          try {
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (refreshedSession) {

              return refreshedSession;
            }
          } catch (refreshError) {
            Logger.error('❌ Session refresh failed', refreshError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
          }
          throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      return session;
    } catch (error) {
      Logger.error(`Session retrieval failed (attempt ${i + 1}/${retries})`, error as Error, {
        component: 'modernPlaybookApi',
        attempt: i + 1,
        maxRetries: retries,
      });
      if (i === retries - 1) {throw error;}
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
}
/**
 * Update playbook action steps using modern Supabase session
 * This replaces the legacy updatePlaybookActionSteps function
 */
export async function updatePlaybookActionSteps(
  playbookId: string | undefined,
  actionSteps: any[],
  completedAt?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!playbookId) {
      return { success: false, error: 'Playbook ID is required' };
    }

    // Get session with retry logic to handle race conditions
    const session = await getSessionWithRetry();

    if (!session?.access_token) {
      throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    const userId = session.user.id;

    // Verify playbook ownership for RLS
    const { data: playbookData, error: ownershipError } = await supabase
      .from('playbooks')
      .select('user_id')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (ownershipError || !playbookData) {
      Logger.error('❌ Playbook ownership verification failed', ownershipError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      return { success: false, error: 'Playbook not found or access denied' };
    }

    // Update the playbook's updated_at timestamp to reflect the action step changes
    await supabase
      .from('playbooks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', playbookId)
      .eq('user_id', userId);

    // Instead of deleting and recreating, update existing action steps
    if (actionSteps && actionSteps.length > 0) {
      for (let index = 0; index < actionSteps.length; index++) {
        const step = actionSteps[index];

        // Handle examples for updates
        let examplesText = '';
        if (step.examples) {
          examplesText = Array.isArray(step.examples)
            ? step.examples.join('; ')
            : step.examples;
        }

        const updateData = {
          text: step.title || step.text,
          examples: examplesText,
          completed: step.completed || false,
          order_index: index,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('playbook_action_steps')
          .update(updateData)
          .eq('id', step.id)
          .eq('playbook_id', playbookId);

        if (updateError) {
          Logger.error(`Error updating action step ${step.id}`, new Error(updateError.message || JSON.stringify(updateError)), {
        component: 'modernPlaybookApi',
        errorDetails: updateError,
        stepId: step.id,
      });
          return { success: false, error: `Failed to update action step ${index + 1}: ${updateError.message}` };
        }

        // Update subtasks if they exist and have completion status
        if (step.subTasks && Array.isArray(step.subTasks) && step.subTasks.length > 0) {

          for (const subTask of step.subTasks) {
            // Only update if subTask has an id (exists in database)
            if (subTask.id && typeof subTask === 'object' && 'completed' in subTask) {

              // Add retry logic for subtask updates
              let subTaskUpdateSuccess = false;
              let lastSubTaskError: any = null;
              const maxSubTaskRetries = 3;

              for (let subTaskRetry = 0; subTaskRetry < maxSubTaskRetries; subTaskRetry++) {
                try {
                  const { error: subTaskError } = await supabase
                    .from('playbook_sub_tasks')
                    .update({
                      completed: Boolean(subTask.completed),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', subTask.id)
                    .eq('action_step_id', step.id);

                  if (subTaskError) {
                    lastSubTaskError = subTaskError;
                    if (subTaskRetry < maxSubTaskRetries - 1) {
                      // Wait before retry
                      await new Promise(resolve => setTimeout(resolve, 1000 * (subTaskRetry + 1)));
                      continue;
                    }
                  } else {
                    subTaskUpdateSuccess = true;
                    break;
                  }
                } catch (networkError) {
                  lastSubTaskError = networkError;
                  if (subTaskRetry < maxSubTaskRetries - 1) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * (subTaskRetry + 1)));
                    continue;
                  }
                }
              }

              if (!subTaskUpdateSuccess && lastSubTaskError) {
                const isNetworkIssue = isNetworkError(lastSubTaskError);
                const errorMessage = lastSubTaskError?.message || JSON.stringify(lastSubTaskError);
                Logger.error(`Error updating subtask ${subTask.id} after ${maxSubTaskRetries} attempts`, new Error(errorMessage), {
          component: 'modernPlaybookApi',
          errorDetails: lastSubTaskError,
          subtaskId: subTask.id,
          stepId: step.id,
          retryAttempts: maxSubTaskRetries,
          isNetworkError: isNetworkIssue,
          errorType: isNetworkIssue ? 'NETWORK_ERROR' : 'DATABASE_ERROR',
        });
                // Continue with other subtasks even if one fails
              }
            }
          }
        }
      }

    }

    // Update playbook status and timestamp
    const { error: updateError } = await supabase
      .from('playbooks')
      .update({
        status: completedAt ? 'completed' : 'ongoing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', playbookId);

    if (updateError) {
      Logger.error('❌ Error updating playbook status', updateError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      return { success: false, error: `Failed to update playbook status: ${updateError.message}` };
    }

    return { success: true };

  } catch (error: any) {
    Logger.error('❌ Failed to update playbook action steps', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
    return { success: false, error: error.message };
  }
}

/**
 * Delete a playbook using modern Supabase session
 * This replaces the legacy deletePlaybook function
 */
export async function deletePlaybook(
  id: string | number,
  _userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get session with retry logic to handle race conditions
    const session = await getSessionWithRetry();

    if (!session?.access_token) {
      throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    const playbookId = String(id);

    // Validate and ensure proper UUID format
    const validatedId = ensureValidUUID(playbookId, 'deletePlaybook');
    if (validatedId !== playbookId) {
      Logger.error('❌ Invalid playbook ID format for deletion', new Error(String(playbookId)), {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      return { success: false, error: `Invalid playbook ID format: ${playbookId}. Expected UUID format.` };
    }

    // Delete from Supabase
    const { error } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', playbookId);

    if (error) {
      Logger.error('Error deleting playbook from Supabase', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      return { success: false, error: error.message };
    }

    // Emit event to notify dashboard and other components
    try {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('playbook_deleted', { id: playbookId, user_id: _userId });
    } catch {}

    return { success: true };

  } catch (error: any) {
    Logger.error('❌ Failed to delete playbook', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
    return { success: false, error: error.message };
  }
}

// Helper function from original working implementation
export function calculateTaskStats(actionSteps: any[]) {
  let completed = 0;
  let total = 0;
  actionSteps?.forEach((step: any) => {
    total++;
    if (step.completed) {completed++;}
    if (Array.isArray(step.subTasks)) {
      step.subTasks.forEach((sub: any) => {
        total++;
        if (sub.completed) {completed++;}
      });
    }
  });
  return { completed, total };
}

/**
 * Get all playbooks for a user with ACCURATE progress calculation
 * Reverted to working approach that counts both action steps AND subtasks
 */
export async function getPlaybooks(userId: string): Promise<Playbook[]> {

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
  }

  // Fetch from main playbooks table to get all data including action_steps
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    Logger.error('[modernGetPlaybooks] Error fetching playbooks', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
    throw new Error(`Failed to fetch playbooks: ${error.message}`);
  }

  if (!data || data.length === 0) {

    return [];
  }

  // Transform to Playbook interface with ACCURATE progress calculation
  const playbooks: Playbook[] = data.map(item => {
    // Calculate accurate progress including subtasks
    const { completed, total } = calculateTaskStats(item.action_steps || []);
    const accurateProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const directChallengeObject = item.direct_challenge && typeof item.direct_challenge === 'object'
      ? item.direct_challenge
      : null;
    const storedCover = directChallengeObject?.cover;

    return {
      id: item.id,
      title: item.title,
      userInput: item.user_input || '',
      truthInLove: item.truth_in_love || { text: '', summary: '' },
      actionSteps: item.action_steps || [],
      affirmations: item.affirmations || [],
      bibleVerse: item.bible_verse || { text: '', reference: '' },
      directChallenge: item.direct_challenge,
      challengeCTA: item.challenge_cta,
      cover: storedCover?.title && storedCover?.subtitle
        ? {
            title: String(storedCover.title),
            subtitle: String(storedCover.subtitle),
            estimatedMinutes: Number.isFinite(Number(storedCover.estimatedMinutes))
              ? Number(storedCover.estimatedMinutes)
              : Number.isFinite(Number(storedCover.estimated_minutes))
                ? Number(storedCover.estimated_minutes)
                : undefined,
          }
        : undefined,
      profileImage: item.profile_image,
      progress: accurateProgress, // Use calculated progress, not stored progress
      totalTasks: total,
      user_id: item.user_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      completedAt: item.completed_at,
      walkthroughProgress: item.walkthrough_progress ?? -1,
      refinementCount: item.refinement_count ?? 0,
      lastRefinedAt: item.last_refined_at ?? null,
      activeVersion: item.active_version ?? 1,
      latestRefinementNote: item.latest_refinement_note ?? null,
      status: item.status,
    };
  });

  return playbooks;
}

/**
 * Get a single playbook using modern Supabase session
 * This replaces the legacy getPlaybook function
 */
export async function getPlaybook(
  userId: string,
  playbookId: string
): Promise<Playbook | null> {
  try {
    // Get session with retry logic to handle race conditions
    const session = await getSessionWithRetry();

    if (!session?.access_token) {
      throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Validate and ensure proper UUID format
    const validatedId = ensureValidUUID(playbookId, 'getPlaybook');
    if (validatedId !== playbookId) {
      Logger.error('❌ Invalid playbook ID format', new Error(String(playbookId)), {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      throw new Error(`Invalid playbook ID format: ${playbookId}. Expected UUID format.`);
    }

    // Fetch playbook from the main table (not the view) to get user_input
    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {

        return null;
      }
      Logger.error('❌ Failed to fetch playbook', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch playbook: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Fetch action steps from separate table

    const { data: actionStepsData, error: actionStepsError } = await supabase
      .from('playbook_action_steps')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index');

    if (actionStepsError) {
      Logger.warn('⚠️ Warning: Could not fetch action steps', {
      component: 'modernPlaybookApi',
      error: actionStepsError,
    });
    }

    // Fetch affirmations from separate table

    const { data: affirmationsData, error: affirmationsError } = await supabase
      .from('playbook_affirmations')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index');

    if (affirmationsError) {
      Logger.warn('⚠️ Warning: Could not fetch affirmations', {
      component: 'modernPlaybookApi',
      error: affirmationsError,
    });
    }

    // Fetch sub-tasks for all action steps
    const actionStepIds = (actionStepsData || []).map(step => step.id);
    let subTasksData: any[] = [];

    if (actionStepIds.length > 0) {
      const { data: subTasksResult, error: subTasksError } = await supabase
        .from('playbook_sub_tasks')
        .select('*')
        .in('action_step_id', actionStepIds)
        .order('order_index');

      if (subTasksError) {
        Logger.warn('⚠️ Warning: Could not fetch sub-tasks', {
      component: 'modernPlaybookApi',
      error: subTasksError,
    });
      } else {
        subTasksData = subTasksResult || [];
      }
    }

    // Transform action steps to expected format with sub-tasks
    const actionSteps = (actionStepsData || []).map(step => {
      const stepSubTasks = subTasksData
        .filter(subTask => subTask.action_step_id === step.id)
        .map(subTask => ({
          id: subTask.id,
          text: subTask.text,
          completed: subTask.completed || false,
          is_example: subTask.is_example,
          isExample: subTask.is_example,
          example_interactive: subTask.example_interactive || false,
        }));

      // Parse guided format metadata from examples field if it contains __meta JSON
      let actionType: ActionStep['actionType'] | undefined;
      let primaryButton: string | undefined;
      let secondaryButton: string | undefined;
      let description: string | undefined;
      let examplesValue: string = step.examples || '';

      if (examplesValue.startsWith('{') && examplesValue.includes('__meta')) {
        try {
          const meta = JSON.parse(examplesValue);
          if (meta.__meta) {
            actionType = meta.actionType;
            primaryButton = meta.primaryButton;
            secondaryButton = meta.secondaryButton;
            description = meta.description;
            examplesValue = meta.examples || '';
          }
        } catch {
          // Not valid JSON — keep as plain examples string
        }
      }

      return {
        id: step.id,
        title: step.text,
        description: description || '', // Extracted from __meta or empty
        subTasks: stepSubTasks,
        examples: examplesValue, // Read from dedicated examples field
        wisdom_text: step.wisdom_text || undefined,
        completed: step.completed,
        actionType,
        primaryButton,
        secondaryButton,
      };
    });

    // Transform affirmations to expected format
    const affirmations = (affirmationsData || []).map(affirmation => ({
      id: affirmation.id,
      text: affirmation.text,
      completed: affirmation.completed,
    }));

    // Calculate progress manually since we're not using the view
    // Count both action steps and subtasks for accurate progress
    let totalTasks = 0;
    let completedTasks = 0;

    actionSteps.forEach(step => {
      const hasSubTasks = step.subTasks && step.subTasks.length > 0;

      if (hasSubTasks) {
        // For steps with subtasks, count each subtask
        totalTasks += step.subTasks.length;
        completedTasks += step.subTasks.filter(subTask => subTask.completed).length;
      } else {
        // For steps without subtasks, count the step itself
        totalTasks += 1;
        if (step.completed) {
          completedTasks += 1;
        }
      }
    });

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Normalize potentially stringified JSON fields
    const safeParse = (val: any) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    const rawTruth = safeParse(data.truth_in_love);
    const normalizedTruth = rawTruth && typeof rawTruth === 'object'
      ? {
          ...rawTruth,
          text: rawTruth.text || '',
          summary: rawTruth.summary || '',
          beats: rawTruth.beats || rawTruth.truth_beats,
          truthToCarry: rawTruth.truthToCarry || rawTruth.truth_to_carry,
        }
      : { text: typeof rawTruth === 'string' ? rawTruth : '', summary: '' };

    const rawBible = safeParse(data.bible_verse);
    const normalizedBible = rawBible && typeof rawBible === 'object'
      ? { text: rawBible.text || '', reference: rawBible.reference || '', version: rawBible.version || '' }
      : { text: typeof rawBible === 'string' ? rawBible : '', reference: '', version: '' };
    // Extract bibleVerseReflection piggybacked into bible_verse JSONB
    const storedBibleVerseReflection: string | undefined =
      rawBible && typeof rawBible === 'object' && rawBible.reflection
        ? String(rawBible.reflection)
        : undefined;

    const rawChallenge = safeParse(data.direct_challenge);
    const normalizedChallenge = rawChallenge && typeof rawChallenge === 'object'
      ? { text: rawChallenge.text || '', summary: rawChallenge.summary || '' }
      : (typeof rawChallenge === 'string' ? rawChallenge : '');
    // Extract prayer + wordToSpeak + faithfulActionsIntro piggybacked into direct_challenge JSONB
    const storedPrayer: string | undefined =
      rawChallenge && typeof rawChallenge === 'object' && rawChallenge.prayer
        ? String(rawChallenge.prayer)
        : undefined;
    const storedWordToSpeak: string | undefined =
      rawChallenge && typeof rawChallenge === 'object' && rawChallenge.wordToSpeak
        ? String(rawChallenge.wordToSpeak)
        : undefined;
    const storedFaithfulActionsIntro: string | undefined =
      rawChallenge && typeof rawChallenge === 'object' && rawChallenge.faithfulActionsIntro
        ? String(rawChallenge.faithfulActionsIntro)
        : undefined;
    const storedCover = rawChallenge && typeof rawChallenge === 'object' && rawChallenge.cover && typeof rawChallenge.cover === 'object'
      ? rawChallenge.cover
      : undefined;
    const cover = storedCover?.title && storedCover?.subtitle
      ? {
          title: String(storedCover.title),
          subtitle: String(storedCover.subtitle),
          estimatedMinutes: Number.isFinite(Number(storedCover.estimatedMinutes))
            ? Number(storedCover.estimatedMinutes)
            : Number.isFinite(Number(storedCover.estimated_minutes))
              ? Number(storedCover.estimated_minutes)
              : undefined,
        }
      : undefined;

    // Transform to Playbook interface
    const playbook: Playbook = {
      id: data.id,
      title: data.title,
      userInput: data.user_input || '', // Use the actual user_input column
      truthInLove: normalizedTruth,
      actionSteps: actionSteps,
      affirmations: affirmations,
      bibleVerse: normalizedBible,
      directChallenge: normalizedChallenge,
      challengeCTA: data.challenge_cta,
      transitionLine: data.transition_line || '',
      prayer: storedPrayer,
      wordToSpeak: storedWordToSpeak,
      bibleVerseReflection: storedBibleVerseReflection,
      faithfulActionsIntro: storedFaithfulActionsIntro,
      cover,
      profileImage: '', // Not stored in current schema
      progress: progress, // Calculated manually
      totalTasks: totalTasks, // Calculated manually
      user_id: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: null, // Not stored in current schema
      refinementCount: data.refinement_count ?? 0,
      lastRefinedAt: data.last_refined_at ?? null,
      activeVersion: data.active_version ?? 1,
      latestRefinementNote: data.latest_refinement_note ?? null,
      status: data.status,
    };

    return playbook;

  } catch (error: any) {
    Logger.error('❌ Failed to fetch playbook', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
    throw error;
  }
}

// Duplicate calculateTaskStats function removed - using the one defined earlier
