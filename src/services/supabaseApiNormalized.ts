/**
 * Updated Supabase API functions for normalized playbook schema
 * Supports the new database structure with separate tables for action steps, sub-tasks, and affirmations
 */

import { supabase } from './supabaseClient';
import { Playbook, ActionStep, SubTask, Affirmation } from '../interfaces/playbook';
import { Logger } from '../utils/ProductionLogger';

// Types for the normalized database schema
interface PlaybookRow {
  id: string;
  user_id: string;
  title: string;
  user_input: string | null;
  category: string | null;
  truth_in_love: any;
  bible_verse: any;
  bible_verse_reflection: string | null;
  direct_challenge: any;
  challenge_cta: string | null;
  transition_line: string | null;
  prayer: string | null;
  word_to_speak: string | null;
  words_to_speak?: string[] | null;
  faithful_actions_intro: string | null;
  status: 'ongoing' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  walkthrough_progress: number | null;
  refinement_count?: number | null;
  last_refined_at?: string | null;
  active_version?: number | null;
  latest_refinement_note?: string | null;
  tag: string | null;
}

interface ActionStepRow {
  id: string;
  playbook_id: string;
  text: string;
  examples: string | null;
  action_type?: 'done_skip' | 'commit' | 'choose' | 'text_input' | null;
  primary_button?: string | null;
  secondary_button?: string | null;
  description?: string | null;
  wisdom_text?: string | null;
  completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface SubTaskRow {
  id: string;
  action_step_id: string;
  text: string;
  completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface AffirmationRow {
  id: string;
  playbook_id: string;
  text: string;
  completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Helper function to transform database row to Playbook interface
function transformPlaybookRow(
  playbookRow: PlaybookRow,
  actionSteps: ActionStepRow[] = [],
  subTasks: SubTaskRow[] = [],
  affirmations: AffirmationRow[] = []
): Playbook {
  const bibleVerse = playbookRow.bible_verse || { text: '', reference: '' };
  const directChallenge = playbookRow.direct_challenge;
  const directChallengeObject = directChallenge && typeof directChallenge === 'object' ? directChallenge : null;
  const bibleVerseObject = bibleVerse && typeof bibleVerse === 'object' ? bibleVerse : null;
  const storedCover = directChallengeObject?.cover;
  const wordToSpeak = playbookRow.word_to_speak || directChallengeObject?.wordToSpeak || '';
  const wordsToSpeak = Array.isArray(playbookRow.words_to_speak)
    ? playbookRow.words_to_speak
    : wordToSpeak
      ? String(wordToSpeak).split(/\n+/).map(line => line.trim()).filter(Boolean)
      : undefined;

  // Group sub-tasks by action step ID
  const subTasksByStepId = subTasks.reduce((acc, subTask) => {
    if (!acc[subTask.action_step_id]) {
      acc[subTask.action_step_id] = [];
    }
    acc[subTask.action_step_id].push({
      id: subTask.id,
      text: subTask.text,
      completed: subTask.completed,
    });
    return acc;
  }, {} as Record<string, SubTask[]>);

  // Transform action steps with their sub-tasks
  const transformedActionSteps: ActionStep[] = actionSteps
    .sort((a, b) => a.order_index - b.order_index)
    .map(step => {
      let parsedExamples: any = null;
      if (step.examples) {
        try {
          const parsed = JSON.parse(step.examples);
          if (parsed?.__meta) {
            parsedExamples = parsed;
          }
        } catch {}
      }

      return {
        id: step.id,
        title: step.text,
        description: step.description || parsedExamples?.description || undefined,
        examples: parsedExamples?.examples || step.examples || undefined,
        actionType: step.action_type || parsedExamples?.actionType || undefined,
        primaryButton: step.primary_button || parsedExamples?.primaryButton || undefined,
        secondaryButton: step.secondary_button || parsedExamples?.secondaryButton || undefined,
        wisdom_text: step.wisdom_text || undefined,
        completed: step.completed,
        subTasks: subTasksByStepId[step.id] || [],
      };
    });

  // Transform affirmations
  const transformedAffirmations: Affirmation[] = affirmations
    .sort((a, b) => a.order_index - b.order_index)
    .map(affirmation => ({
      id: affirmation.id,
      text: affirmation.text,
      completed: affirmation.completed,
    }));

  return {
    id: playbookRow.id,
    user_id: playbookRow.user_id,
    title: playbookRow.title,
    userInput: playbookRow.user_input || '',
    category: playbookRow.category || undefined,
    truthInLove: playbookRow.truth_in_love,
    bibleVerse,
    bibleVerseReflection: playbookRow.bible_verse_reflection || bibleVerseObject?.reflection || '',
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
    directChallenge: directChallengeObject
      ? { text: directChallengeObject.text || '', summary: directChallengeObject.summary || '' }
      : directChallenge,
    challengeCTA: playbookRow.challenge_cta ?? undefined,
    transitionLine: playbookRow.transition_line || '',
    prayer: playbookRow.prayer || directChallengeObject?.prayer || '',
    wordToSpeak,
    wordsToSpeak,
    faithfulActionsIntro: playbookRow.faithful_actions_intro || directChallengeObject?.faithfulActionsIntro || '',
    actionSteps: transformedActionSteps,
    affirmations: transformedAffirmations,
    status: playbookRow.status,
    createdAt: playbookRow.created_at,
    updatedAt: playbookRow.updated_at,
    completedAt: playbookRow.completed_at ?? null,
    walkthroughProgress: playbookRow.walkthrough_progress ?? -1,
    refinementCount: playbookRow.refinement_count ?? 0,
    lastRefinedAt: playbookRow.last_refined_at ?? null,
    activeVersion: playbookRow.active_version ?? 1,
    latestRefinementNote: playbookRow.latest_refinement_note ?? null,
    tag: playbookRow.tag || undefined,
    progress: 0,
    totalTasks: transformedActionSteps.length,
  };
}

/**
 * Get all playbooks for a user with their related data
 * @param lightweight - When true, fetches minimal data for list views. Default false for full data.
 */
export async function getPlaybooks(userId: string, lightweight: boolean = false): Promise<Playbook[]> {
  try {
    // OPTIMIZED: Lightweight query for list view (no affirmations, minimal fields)
    const selectFields = lightweight
      ? `
        id,
        user_id,
        title,
        user_input,
        category,
        tag,
        truth_in_love,
        status,
        progress,
        total_tasks,
        created_at,
        updated_at,
        walkthrough_progress,
        completed_at,
        refinement_count,
        last_refined_at,
        active_version,
        latest_refinement_note,
        playbook_action_steps (
          id,
          text,
          completed,
          order_index,
          playbook_sub_tasks (
            id,
            text,
            completed,
            is_example,
            order_index
          )
        )
      `
      : `
        id,
        user_id,
        title,
        user_input,
        category,
        tag,
        truth_in_love,
        bible_verse,
        direct_challenge,
        challenge_cta,
        status,
        progress,
        total_tasks,
        created_at,
        updated_at,
        walkthrough_progress,
        completed_at,
        refinement_count,
        last_refined_at,
        active_version,
        latest_refinement_note,
        playbook_action_steps (
          id,
          text,
          examples,
          completed,
          order_index,
          created_at,
          updated_at,
          playbook_sub_tasks (
            id,
            text,
            completed,
            is_example,
            example_interactive,
            order_index,
            created_at,
            updated_at
          )
        ),
        playbook_affirmations (
          id,
          text,
          completed,
          order_index,
          created_at,
          updated_at
        )
      `;

    // @ts-ignore - Complex union type from nested Supabase query
    const { data: playbooksData, error: playbooksError } = await supabase
      .from('playbooks')
      .select(selectFields)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (playbooksError) {
      Logger.error('[getPlaybooks] Error fetching playbooks', playbooksError as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybooks',
    });
      throw playbooksError;
    }

    if (!playbooksData || playbooksData.length === 0) {
      return [];
    }

    // Transform the nested data into Playbook interface
    return playbooksData.map((playbookRow: any) => {
      // Transform action steps with their sub-tasks
      const actionSteps: ActionStep[] = (playbookRow.playbook_action_steps || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((step: any) => ({
          id: step.id,
          title: step.text || '',
          examples: lightweight ? '' : (step.examples || ''),
          completed: step.completed,
          orderIndex: step.order_index,
          subTasks: (step.playbook_sub_tasks || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((subTask: any) => ({
              id: subTask.id,
              text: subTask.text || '',
              completed: subTask.completed,
              is_example: subTask.is_example,
              example_interactive: lightweight ? false : (subTask.example_interactive || false),
              orderIndex: subTask.order_index,
            })),
        }));

      // Transform affirmations (skip in lightweight mode)
      const affirmations: Affirmation[] = lightweight ? [] : (playbookRow.playbook_affirmations || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((affirmation: any) => ({
          id: affirmation.id,
          text: affirmation.text,
          completed: affirmation.completed,
          orderIndex: affirmation.order_index,
        }));
      const directChallengeObject = !lightweight && playbookRow.direct_challenge && typeof playbookRow.direct_challenge === 'object'
        ? playbookRow.direct_challenge
        : null;
      const storedCover = directChallengeObject?.cover;

      return {
        id: playbookRow.id,
        user_id: playbookRow.user_id,
        title: playbookRow.title,
        userInput: playbookRow.user_input || '',
        category: playbookRow.category || undefined,
        tag: playbookRow.tag || undefined,
        truthInLove: playbookRow.truth_in_love || { text: '', summary: '' },
        bibleVerse: lightweight ? { text: '', reference: '' } : (playbookRow.bible_verse || { text: '', reference: '' }),
        directChallenge: lightweight ? '' : (playbookRow.direct_challenge || ''),
        challengeCTA: lightweight ? '' : (playbookRow.challenge_cta || ''),
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
        status: playbookRow.status,
        progress: playbookRow.progress || 0,
        totalTasks: playbookRow.total_tasks || 0,
        actionSteps,
        affirmations,
        createdAt: playbookRow.created_at,
        updatedAt: playbookRow.updated_at,
        completedAt: playbookRow.completed_at ?? null,
        walkthroughProgress: playbookRow.walkthrough_progress ?? -1,
        refinementCount: playbookRow.refinement_count ?? 0,
        lastRefinedAt: playbookRow.last_refined_at ?? null,
        activeVersion: playbookRow.active_version ?? 1,
        latestRefinementNote: playbookRow.latest_refinement_note ?? null,
      } as Playbook;
    });

  } catch (error) {
    Logger.error('[getPlaybooks] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybooks',
    });
    throw error;
  }
}

/**
 * Get a single playbook by ID with all related data
 */
export async function getPlaybook(userId: string, playbookId: string): Promise<Playbook | null> {

  try {
    // Fetch the playbook
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (playbookError) {
      if (playbookError.code === 'PGRST116') {

        return null;
      }
      Logger.error('[getPlaybook] Error fetching playbook', playbookError as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybook',
    });
      throw playbookError;
    }

    // Fetch action steps
    const { data: actionSteps, error: actionStepsError } = await supabase
      .from('playbook_action_steps')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index', { ascending: true });

    if (actionStepsError) {
      Logger.error('[getPlaybook] Error fetching action steps', actionStepsError as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybook',
    });
      throw actionStepsError;
    }

    // Fetch sub-tasks
    const actionStepIds = actionSteps?.map(step => step.id) || [];
    let subTasks: SubTaskRow[] = [];

    if (actionStepIds.length > 0) {
      const { data: subTasksData, error: subTasksError } = await supabase
        .from('playbook_sub_tasks')
        .select('*')
        .in('action_step_id', actionStepIds)
        .order('order_index', { ascending: true });

      if (subTasksError) {
        Logger.error('[getPlaybook] Error fetching sub-tasks', subTasksError as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybook',
    });
        throw subTasksError;
      }

      subTasks = subTasksData || [];
    }

    // Fetch affirmations
    const { data: affirmations, error: affirmationsError } = await supabase
      .from('playbook_affirmations')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index', { ascending: true });

    if (affirmationsError) {
      Logger.error('[getPlaybook] Error fetching affirmations', affirmationsError as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybook',
    });
      throw affirmationsError;
    }

    const result = transformPlaybookRow(playbook, actionSteps || [], subTasks, affirmations || []);

    return result;

  } catch (error) {
    Logger.error('[getPlaybook] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybook',
    });
    throw error;
  }
}

/**
 * Create a new playbook with all related data
 */
export async function createPlaybook(playbook: Omit<Playbook, 'id' | 'createdAt' | 'updatedAt'>): Promise<Playbook> {

  // Check current session
  await supabase.auth.getSession();

  try {
    const rawDirectChallenge = playbook.directChallenge;
    const directChallengeToSave = (() => {
      const base: Record<string, any> = typeof rawDirectChallenge === 'object' && rawDirectChallenge !== null
        ? { ...(rawDirectChallenge as any) }
        : { text: typeof rawDirectChallenge === 'string' ? rawDirectChallenge : '', summary: '' };
      if (playbook.cover?.title && playbook.cover?.subtitle) {
        base.cover = playbook.cover;
      }
      return base;
    })();

    // Start a transaction by creating the main playbook first
    const { data: createdPlaybook, error: playbookError } = await supabase
      .from('playbooks')
      .insert({
        user_id: playbook.user_id,
        title: playbook.title,
        user_input: playbook.userInput || '',
        category: playbook.category || null,
        truth_in_love: playbook.truthInLove,
        bible_verse: playbook.bibleVerse,
        direct_challenge: directChallengeToSave,
        challenge_cta: playbook.challengeCTA,
        transition_line: (playbook as any).transitionLine || '',
        status: playbook.status || 'ongoing',
      })
      .select()
      .single();

    if (playbookError) {
      Logger.error('[createPlaybook] Error creating playbook', playbookError as Error, {
      component: 'supabaseApiNormalized',
      action: 'createPlaybook',
    });
      throw playbookError;
    }

    const playbookId = createdPlaybook.id;

    // Create action steps
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {
      const actionStepsToInsert = playbook.actionSteps
        .filter(step => step && (step.title || step.description))
        .map((step, index) => {
          // Extract examples from the step
          let examples = '';
          const stepAny = step as any;
          if (stepAny.examples) {
            if (typeof stepAny.examples === 'string') {
              examples = stepAny.examples.trim();
            } else if (Array.isArray(stepAny.examples)) {
              examples = stepAny.examples.join('\n');
            }
          }

          return {
            playbook_id: playbookId,
            text: (step.title || step.description || 'Untitled step').trim(),
            examples: examples,
            completed: step.completed || false,
            order_index: index,
          };
        });

      const { data: createdActionSteps, error: actionStepsError } = await supabase
        .from('playbook_action_steps')
        .insert(actionStepsToInsert)
        .select();

      if (actionStepsError) {
        Logger.error('[createPlaybook] Error creating action steps', actionStepsError as Error, {
      component: 'supabaseApiNormalized',
      action: 'createPlaybook',
    });
        throw actionStepsError;
      }

      // Create sub-tasks for action steps that have them
      const subTasksToInsert: any[] = [];

      playbook.actionSteps.forEach((step, stepIndex) => {

        if (step.subTasks && step.subTasks.length > 0) {
          const actionStepId = createdActionSteps[stepIndex].id;

          step.subTasks.forEach((subTask, subTaskIndex) => {
            // Handle both string and object formats
            let subTaskText = '';
            let subTaskCompleted = false;

            if (typeof subTask === 'string') {
              // Sub-task is a string
              subTaskText = (subTask as string).trim();
            } else if (subTask && typeof subTask === 'object') {
              // Sub-task is an object
              subTaskText = ((subTask as any).text || (subTask as any).title || '').trim();
              subTaskCompleted = (subTask as any).completed || false;
            }

            // Only insert sub-tasks with valid text
            if (subTaskText && subTaskText.length > 0) {
              subTasksToInsert.push({
                action_step_id: actionStepId,
                text: subTaskText,
                completed: subTaskCompleted,
                order_index: subTaskIndex,
              });

            } else {
              Logger.warn('[createPlaybook] Skipping sub-task with invalid text', {
          component: 'supabaseApiNormalized',
          action: 'createPlaybook',
          data: subTask,
        });
            }
          });
        }
      });

      if (subTasksToInsert.length > 0) {
        const { error: subTasksError } = await supabase
          .from('playbook_sub_tasks')
          .insert(subTasksToInsert);

        if (subTasksError) {
          Logger.error('[createPlaybook] Error creating sub-tasks', subTasksError as Error, {
      component: 'supabaseApiNormalized',
      action: 'createPlaybook',
    });
          throw subTasksError;
        }
      }
    }

    // Create affirmations
    if (playbook.affirmations && playbook.affirmations.length > 0) {

      const affirmationsToInsert: any[] = [];

      playbook.affirmations.forEach((affirmation, index) => {
        // Handle both string and object formats
        let affirmationText = '';
        let affirmationCompleted = false;

        if (typeof affirmation === 'string') {
          // Affirmation is a string
          affirmationText = (affirmation as string).trim();
        } else if (affirmation && typeof affirmation === 'object') {
          // Affirmation is an object
          affirmationText = ((affirmation as any).text || (affirmation as any).title || '').trim();
          affirmationCompleted = (affirmation as any).completed || false;
        }

        // Only insert affirmations with valid text
        if (affirmationText && affirmationText.length > 0) {
          affirmationsToInsert.push({
            playbook_id: playbookId,
            text: affirmationText,
            completed: affirmationCompleted,
            order_index: index,
          });

        } else {
          Logger.warn('[createPlaybook] Skipping affirmation with invalid text', {
          component: 'supabaseApiNormalized',
          action: 'createPlaybook',
          data: affirmation,
        });
        }
      });

      const { error: affirmationsError } = await supabase
        .from('playbook_affirmations')
        .insert(affirmationsToInsert);

      if (affirmationsError) {
        Logger.error('[createPlaybook] Error creating affirmations', affirmationsError as Error, {
      component: 'supabaseApiNormalized',
      action: 'createPlaybook',
    });
        throw affirmationsError;
      }
    }

    // Fetch the complete playbook with all related data
    const completePlaybook = await getPlaybook(playbook.user_id, playbookId);
    if (!completePlaybook) {
      throw new Error('Failed to fetch created playbook');
    }

    return completePlaybook;

  } catch (error) {
    Logger.error('[createPlaybook] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'createPlaybook',
    });
    throw error;
  }
}

/**
 * Update an action step's completion status
 */
export async function updatePlaybookActionStep(
  userId: string,
  playbookId: string,
  stepId: string,
  completed: boolean
): Promise<Playbook> {

  try {
    // Update the action step
    const { error: updateError } = await supabase
      .from('playbook_action_steps')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', stepId)
      .eq('playbook_id', playbookId);

    if (updateError) {
      Logger.error('[updatePlaybookActionStep] Error updating action step', updateError as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookActionStep',
    });
      throw updateError;
    }

    // Fetch and return the updated playbook
    const updatedPlaybook = await getPlaybook(userId, playbookId);
    if (!updatedPlaybook) {
      throw new Error('Failed to fetch updated playbook');
    }

    return updatedPlaybook;

  } catch (error) {
    Logger.error('[updatePlaybookActionStep] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookActionStep',
    });
    throw error;
  }
}

/**
 * Update a sub-task's completion status
 */
export async function updatePlaybookSubTask(
  userId: string,
  playbookId: string,
  stepId: string,
  subTaskId: string,
  completed: boolean
): Promise<{ playbookId: string; stepId: string; subTaskId: string; completed: boolean }> {

  try {
    // OPTIMIZED: Just update the database - optimistic update handles UI
    const { error: updateError } = await supabase
      .from('playbook_sub_tasks')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', subTaskId)
      .eq('action_step_id', stepId);

    if (updateError) {
      Logger.error('[updatePlaybookSubTask] Error updating sub-task', updateError as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookSubTask',
    });
      throw updateError;
    }

    // Update the playbook's updated_at timestamp to reflect the sub-task change
    await supabase
      .from('playbooks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', playbookId);

    // PERFORMANCE: Don't fetch entire playbook - let optimistic update handle UI
    // Return minimal data for confirmation
    return { playbookId, stepId, subTaskId, completed };

  } catch (error) {
    Logger.error('[updatePlaybookSubTask] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookSubTask',
    });
    throw error;
  }
}

/**
 * Update an affirmation's completion status
 */
export async function updatePlaybookAffirmation(
  userId: string,
  playbookId: string,
  affirmationId: string,
  completed: boolean
): Promise<Playbook> {

  try {
    // Update the affirmation
    const { error: updateError } = await supabase
      .from('playbook_affirmations')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', affirmationId)
      .eq('playbook_id', playbookId);

    if (updateError) {
      Logger.error('[updatePlaybookAffirmation] Error updating affirmation', updateError as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookAffirmation',
    });
      throw updateError;
    }

    // Fetch and return the updated playbook
    const updatedPlaybook = await getPlaybook(userId, playbookId);
    if (!updatedPlaybook) {
      throw new Error('Failed to fetch updated playbook');
    }

    return updatedPlaybook;

  } catch (error) {
    Logger.error('[updatePlaybookAffirmation] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookAffirmation',
    });
    throw error;
  }
}

/**
 * Delete a playbook and all related data
 */
export async function deletePlaybook(playbookId: string): Promise<void> {

  try {
    // Delete the playbook (CASCADE will handle related data)
    const { error: deleteError } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', playbookId);

    if (deleteError) {
      Logger.error('[deletePlaybook] Error deleting playbook', deleteError as Error, {
      component: 'supabaseApiNormalized',
      action: 'deletePlaybook',
    });
      throw deleteError;
    }

  } catch (error) {
    Logger.error('[deletePlaybook] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'deletePlaybook',
    });
    throw error;
  }
}

/**
 * Get playbook progress using the database function
 */
export async function getPlaybookProgress(playbookId: string): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {

  try {
    const { data, error } = await supabase
      .rpc('calculate_playbook_progress', { playbook_uuid: playbookId });

    if (error) {
      Logger.error('[getPlaybookProgress] Error calculating progress', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybookProgress',
    });
      throw error;
    }

    if (!data || data.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const result = data[0];
    return {
      completed: result.completed_tasks || 0,
      total: result.total_tasks || 0,
      percentage: result.progress_percentage || 0,
    };

  } catch (error) {
    Logger.error('[getPlaybookProgress] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'getPlaybookProgress',
    });
    throw error;
  }
}

/**
 * Update playbook status
 */
export async function updateWalkthroughProgress(
  playbookId: string,
  progress: number,
): Promise<void> {
  try {
    await supabase
      .from('playbooks')
      .update({ walkthrough_progress: progress, updated_at: new Date().toISOString() })
      .eq('id', playbookId);
  } catch (_) {}
}

export async function updateActionStepCompleted(
  actionStepId: string,
): Promise<void> {
  try {
    // First, get the playbook_id for this action step
    const { data: stepData } = await supabase
      .from('playbook_action_steps')
      .select('playbook_id')
      .eq('id', actionStepId)
      .single();

    if (stepData?.playbook_id) {
      // Update the playbook's updated_at timestamp
      await supabase
        .from('playbooks')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', stepData.playbook_id);
    }

    // Then update the action step
    await supabase
      .from('playbook_action_steps')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('id', actionStepId);
  } catch (_) {}
}

export async function updatePlaybookStatus(
  playbookId: string,
  status: 'ongoing' | 'completed' | 'paused'
): Promise<void> {

  try {
    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      patch.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('playbooks')
      .update(patch)
      .eq('id', playbookId);

    if (error) {
      Logger.error('[updatePlaybookStatus] Error updating status', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookStatus',
    });
      throw error;
    }

  } catch (error) {
    Logger.error('[updatePlaybookStatus] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookStatus',
    });
    throw error;
  }
}

/**
 * Update prayer_prayed status for a playbook
 */
export async function updatePlaybookPrayerPrayed(
  playbookId: string,
  prayerPrayed: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbooks')
      .update({ prayer_prayed: prayerPrayed, updated_at: new Date().toISOString() })
      .eq('id', playbookId);

    if (error) {
      Logger.error('[updatePlaybookPrayerPrayed] Error updating prayer_prayed', error as Error, {
        component: 'supabaseApiNormalized',
        action: 'updatePlaybookPrayerPrayed',
      });
      throw error;
    }
  } catch (error) {
    Logger.error('[updatePlaybookPrayerPrayed] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookPrayerPrayed',
    });
    throw error;
  }
}

// Calculate task statistics for action steps
export function calculateTaskStats(actionSteps: ActionStep[]): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  actionSteps.forEach(step => {
    if (step.subTasks && step.subTasks.length > 0) {
      // Count subtasks
      step.subTasks.forEach(subTask => {
        total++;
        if (subTask.completed) {
          completed++;
        }
      });
    } else {
      // Count the step itself if no subtasks
      total++;
      if (step.completed) {
        completed++;
      }
    }
  });

  return { completed, total };
}

// Update all action steps for a playbook
export async function updatePlaybookActionSteps(
  playbookId: string,
  actionSteps: ActionStep[]
): Promise<void> {
  try {

    // Update each action step in the database
    for (const step of actionSteps) {

      // Update the main action step
      const { error: stepError } = await supabase
        .from('playbook_action_steps')
        .update({
          completed: step.completed,
          updated_at: new Date().toISOString(),
        })
        .eq('playbook_id', playbookId)
        .eq('id', step.id);

      if (stepError) {
        Logger.error(`[updatePlaybookActionSteps] Error updating step ${step.id}`, stepError as Error, {
          component: 'supabaseApiNormalized',
          action: 'updatePlaybookActionSteps',
          stepId: step.id,
        });
        // Continue with other steps even if one fails
      }

      // Update sub-tasks if they exist
      if (step.subTasks && step.subTasks.length > 0) {
        for (const subTask of step.subTasks) {

          const { error: subTaskError } = await supabase
            .from('playbook_sub_tasks')
            .update({
              completed: subTask.completed,
              updated_at: new Date().toISOString(),
            })
            .eq('action_step_id', step.id)
            .eq('id', subTask.id);

          if (subTaskError) {
            Logger.error(`[updatePlaybookActionSteps] Error updating subtask ${subTask.id}`, subTaskError as Error, {
              component: 'supabaseApiNormalized',
              action: 'updatePlaybookActionSteps',
              subTaskId: subTask.id,
            });
            // Continue with other subtasks even if one fails
          }
        }
      }
    }

    // Update playbook progress and status
    const stats = calculateTaskStats(actionSteps);
    const allCompleted = stats.total > 0 && stats.completed === stats.total;

    await updatePlaybookStatus(
      playbookId,
      allCompleted ? 'completed' : 'ongoing'
    );

  } catch (error) {
    Logger.error('[updatePlaybookActionSteps] Error updating action steps', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'updatePlaybookActionSteps',
    });
    throw error;
  }
}

/**
 * Replace a previously stored user name inside all of the user's playbook
 * content. Older playbooks were generated with the user's real name baked into
 * the text (instead of the [User's Name] placeholder), so a profile name change
 * never reached them. This rewrites every stored occurrence of the old first
 * name to the new one so completed playbooks stay personalized.
 */
export async function replaceStoredUserNameInPlaybooks(
  userId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const oldClean = String(oldName || '').trim();
  const newClean = String(newName || '').trim();
  if (!userId || oldClean.length < 2 || newClean.length < 2 || oldClean === newClean) {
    return;
  }

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(`\\b${escapeRegExp(oldClean)}\\b('s|’s)?`, 'g');

  const transform = (value: any): any => {
    if (typeof value === 'string') {
      return value.replace(nameRegex, (_match, possessive) => `${newClean}${possessive || ''}`);
    }
    if (Array.isArray(value)) {
      return value.map(transform);
    }
    if (value && typeof value === 'object') {
      const next: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        next[key] = transform(value[key]);
      }
      return next;
    }
    return value;
  };

  const valuesEqual = (a: any, b: any): boolean => {
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return a === b;
  };

  const now = new Date().toISOString();

  try {
    const { data: playbooks, error: playbooksError } = await supabase
      .from('playbooks')
      .select('id, title, user_input, truth_in_love, bible_verse_reflection, direct_challenge, challenge_cta, transition_line, prayer, word_to_speak, words_to_speak, faithful_actions_intro')
      .eq('user_id', userId);

    if (playbooksError) {
      Logger.error('[replaceStoredUserNameInPlaybooks] Error fetching playbooks', playbooksError as Error, {
        component: 'supabaseApiNormalized',
        action: 'replaceStoredUserNameInPlaybooks',
      });
      return;
    }

    const playbookIds: string[] = [];
    const playbookTextFields = [
      'title', 'user_input', 'truth_in_love', 'bible_verse_reflection',
      'direct_challenge', 'challenge_cta', 'transition_line', 'prayer',
      'word_to_speak', 'words_to_speak', 'faithful_actions_intro',
    ];

    for (const row of playbooks || []) {
      const patch: Record<string, any> = {};
      for (const field of playbookTextFields) {
        const current = (row as any)[field];
        if (current === null || current === undefined) { continue; }
        const next = transform(current);
        if (!valuesEqual(current, next)) {
          patch[field] = next;
        }
      }

      if (Object.keys(patch).length > 0) {
        patch.updated_at = now;
        const { error } = await supabase
          .from('playbooks')
          .update(patch)
          .eq('id', row.id);
        if (error) {
          Logger.error('[replaceStoredUserNameInPlaybooks] Error updating playbook', error as Error, {
            component: 'supabaseApiNormalized',
            action: 'replaceStoredUserNameInPlaybooks',
            playbookId: row.id,
          });
        }
      }

      playbookIds.push(row.id);
    }

    if (playbookIds.length === 0) { return; }

    const { data: actionSteps, error: stepsError } = await supabase
      .from('playbook_action_steps')
      .select('id, text, examples, description, wisdom_text')
      .in('playbook_id', playbookIds);

    if (stepsError) {
      Logger.error('[replaceStoredUserNameInPlaybooks] Error fetching action steps', stepsError as Error, {
        component: 'supabaseApiNormalized',
        action: 'replaceStoredUserNameInPlaybooks',
      });
    } else {
      const stepIds: string[] = [];
      for (const step of actionSteps || []) {
        stepIds.push(step.id);
        const patch: Record<string, any> = {};
        for (const field of ['text', 'examples', 'description', 'wisdom_text']) {
          const current = (step as any)[field];
          if (current === null || current === undefined) { continue; }
          const next = transform(current);
          if (next !== current) {
            patch[field] = next;
          }
        }
        if (Object.keys(patch).length > 0) {
          patch.updated_at = now;
          await supabase
            .from('playbook_action_steps')
            .update(patch)
            .eq('id', step.id);
        }
      }

      if (stepIds.length > 0) {
        const { data: subTasks } = await supabase
          .from('playbook_sub_tasks')
          .select('id, text')
          .in('action_step_id', stepIds);

        for (const subTask of subTasks || []) {
          const next = transform(subTask.text);
          if (next !== subTask.text) {
            await supabase
              .from('playbook_sub_tasks')
              .update({ text: next, updated_at: now })
              .eq('id', subTask.id);
          }
        }
      }
    }

    const { data: affirmations } = await supabase
      .from('playbook_affirmations')
      .select('id, text')
      .in('playbook_id', playbookIds);

    for (const affirmation of affirmations || []) {
      const next = transform(affirmation.text);
      if (next !== affirmation.text) {
        await supabase
          .from('playbook_affirmations')
          .update({ text: next, updated_at: now })
          .eq('id', affirmation.id);
      }
    }
  } catch (error) {
    Logger.error('[replaceStoredUserNameInPlaybooks] Unexpected error', error as Error, {
      component: 'supabaseApiNormalized',
      action: 'replaceStoredUserNameInPlaybooks',
    });
  }
}
