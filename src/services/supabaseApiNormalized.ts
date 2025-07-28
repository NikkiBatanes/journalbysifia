/**
 * Updated Supabase API functions for normalized playbook schema
 * Supports the new database structure with separate tables for action steps, sub-tasks, and affirmations
 */

import { supabase } from './supabaseClient';
import { Playbook, ActionStep, SubTask, Affirmation } from '../interfaces/playbook';

// Types for the normalized database schema
interface PlaybookRow {
  id: string;
  user_id: string;
  title: string;
  user_input: string | null;
  truth_in_love: any;
  bible_verse: any;
  direct_challenge: any;
  challenge_cta: string | null;
  status: 'ongoing' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

interface ActionStepRow {
  id: string;
  playbook_id: string;
  text: string;
  examples: string | null;
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
  detected_journal_type?: string | null;
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
  // Group sub-tasks by action step ID
  const subTasksByStepId = subTasks.reduce((acc, subTask) => {
    if (!acc[subTask.action_step_id]) {
      acc[subTask.action_step_id] = [];
    }
    acc[subTask.action_step_id].push({
      id: subTask.id,
      text: subTask.text,
      completed: subTask.completed,
      detected_journal_type: subTask.detected_journal_type ?? undefined, // Preserve smart journaling data
    });
    return acc;
  }, {} as Record<string, SubTask[]>);

  // Transform action steps with their sub-tasks
  const transformedActionSteps: ActionStep[] = actionSteps
    .sort((a, b) => a.order_index - b.order_index)
    .map(step => ({
      id: step.id,
      title: step.text,
      examples: step.examples || undefined,
      completed: step.completed,
      subTasks: subTasksByStepId[step.id] || [],
    }));

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
    userId: playbookRow.user_id,
    title: playbookRow.title,
    userInput: playbookRow.user_input || '',
    truthInLove: playbookRow.truth_in_love,
    bibleVerse: playbookRow.bible_verse,
    directChallenge: playbookRow.direct_challenge,
    challengeCTA: playbookRow.challenge_cta,
    actionSteps: transformedActionSteps,
    affirmations: transformedAffirmations,
    status: playbookRow.status,
    createdAt: playbookRow.created_at,
    updatedAt: playbookRow.updated_at,
  };
}

/**
 * Get all playbooks for a user with their related data
 */
export async function getPlaybooks(userId: string): Promise<Playbook[]> {
  console.log('[getPlaybooks] Fetching playbooks for user:', userId);

  try {
    // Fetch playbooks
    const { data: playbooks, error: playbooksError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (playbooksError) {
      console.error('[getPlaybooks] Error fetching playbooks:', playbooksError);
      throw playbooksError;
    }

    if (!playbooks || playbooks.length === 0) {
      console.log('[getPlaybooks] No playbooks found');
      return [];
    }

    const playbookIds = playbooks.map(p => p.id);

    // Fetch all action steps for these playbooks
    const { data: actionSteps, error: actionStepsError } = await supabase
      .from('playbook_action_steps')
      .select('*')
      .in('playbook_id', playbookIds)
      .order('order_index', { ascending: true });

    if (actionStepsError) {
      console.error('[getPlaybooks] Error fetching action steps:', actionStepsError);
      throw actionStepsError;
    }

    // Debug: Log fetched action steps
    console.log('[getPlaybooks] Fetched action steps:', actionSteps?.slice(0, 2));
    if (actionSteps && actionSteps.length > 0) {
      console.log('[getPlaybooks] First action step examples:', actionSteps[0].examples);
      console.log('[getPlaybooks] First action step full data:', actionSteps[0]);
    }

    // Fetch all sub-tasks for these action steps
    const actionStepIds = actionSteps?.map(step => step.id) || [];
    let subTasks: SubTaskRow[] = [];

    if (actionStepIds.length > 0) {
      const { data: subTasksData, error: subTasksError } = await supabase
        .from('playbook_sub_tasks')
        .select('*')
        .in('action_step_id', actionStepIds)
        .order('order_index', { ascending: true });

      if (subTasksError) {
        console.error('[getPlaybooks] Error fetching sub-tasks:', subTasksError);
        throw subTasksError;
      }

      subTasks = subTasksData || [];
    }

    // Fetch all affirmations for these playbooks
    const { data: affirmations, error: affirmationsError } = await supabase
      .from('playbook_affirmations')
      .select('*')
      .in('playbook_id', playbookIds)
      .order('order_index', { ascending: true });

    if (affirmationsError) {
      console.error('[getPlaybooks] Error fetching affirmations:', affirmationsError);
      throw affirmationsError;
    }

    // Transform and group data by playbook
    const result = playbooks.map(playbook => {
      const playbookActionSteps = actionSteps?.filter(step => step.playbook_id === playbook.id) || [];
      const playbookAffirmations = affirmations?.filter(aff => aff.playbook_id === playbook.id) || [];

      return transformPlaybookRow(playbook, playbookActionSteps, subTasks, playbookAffirmations);
    });

    console.log('[getPlaybooks] Successfully fetched', result.length, 'playbooks');
    return result;

  } catch (error) {
    console.error('[getPlaybooks] Unexpected error:', error);
    throw error;
  }
}

/**
 * Get a single playbook by ID with all related data
 */
export async function getPlaybook(userId: string, playbookId: string): Promise<Playbook | null> {
  console.log('[getPlaybook] Fetching playbook:', { userId, playbookId });

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
        console.log('[getPlaybook] Playbook not found');
        return null;
      }
      console.error('[getPlaybook] Error fetching playbook:', playbookError);
      throw playbookError;
    }

    // Fetch action steps
    const { data: actionSteps, error: actionStepsError } = await supabase
      .from('playbook_action_steps')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index', { ascending: true });

    if (actionStepsError) {
      console.error('[getPlaybook] Error fetching action steps:', actionStepsError);
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
        console.error('[getPlaybook] Error fetching sub-tasks:', subTasksError);
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
      console.error('[getPlaybook] Error fetching affirmations:', affirmationsError);
      throw affirmationsError;
    }

    const result = transformPlaybookRow(playbook, actionSteps || [], subTasks, affirmations || []);
    console.log('[getPlaybook] Successfully fetched playbook');
    return result;

  } catch (error) {
    console.error('[getPlaybook] Unexpected error:', error);
    throw error;
  }
}

/**
 * Create a new playbook with all related data
 */
export async function createPlaybook(playbook: Omit<Playbook, 'id' | 'createdAt' | 'updatedAt'>): Promise<Playbook> {
  console.log('[createPlaybook] Creating playbook:', playbook.title);
  console.log('[createPlaybook] User ID:', playbook.user_id);

  // Check current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('[createPlaybook] Current session:', session?.user?.id);
  console.log('[createPlaybook] Session error:', sessionError);

  try {
    // Start a transaction by creating the main playbook first
    const { data: createdPlaybook, error: playbookError } = await supabase
      .from('playbooks')
      .insert({
        user_id: playbook.user_id,
        title: playbook.title,
        user_input: playbook.userInput || '',
        truth_in_love: playbook.truthInLove,
        bible_verse: playbook.bibleVerse,
        direct_challenge: playbook.directChallenge,
        challenge_cta: playbook.challengeCTA,
        status: playbook.status || 'ongoing',
      })
      .select()
      .single();

    if (playbookError) {
      console.error('[createPlaybook] Error creating playbook:', playbookError);
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

          console.log(`[createPlaybook] Action step ${index}: text="${(step.title || step.description || 'Untitled step').trim()}", examples="${examples}"`);

          return {
            playbook_id: playbookId,
            text: (step.title || step.description || 'Untitled step').trim(),
            examples: examples,
            completed: step.completed || false,
            order_index: index,
          };
        });

      console.log('[createPlaybook] Filtered action steps count:', actionStepsToInsert.length);

      const { data: createdActionSteps, error: actionStepsError } = await supabase
        .from('playbook_action_steps')
        .insert(actionStepsToInsert)
        .select();

      if (actionStepsError) {
        console.error('[createPlaybook] Error creating action steps:', actionStepsError);
        throw actionStepsError;
      }

      // Create sub-tasks for action steps that have them
      const subTasksToInsert: any[] = [];
      console.log('[createPlaybook] Processing action steps for sub-tasks:', playbook.actionSteps.length);

      playbook.actionSteps.forEach((step, stepIndex) => {
        console.log(`[createPlaybook] Step ${stepIndex}:`, {
          title: step.title,
          hasSubTasks: !!step.subTasks,
          subTasksLength: step.subTasks?.length || 0,
          subTasks: step.subTasks,
        });

        if (step.subTasks && step.subTasks.length > 0) {
          const actionStepId = createdActionSteps[stepIndex].id;
          console.log(`[createPlaybook] Processing ${step.subTasks.length} sub-tasks for step ${stepIndex}`);

          step.subTasks.forEach((subTask, subTaskIndex) => {
            // Handle both string and object formats
            let subTaskText = '';
            let subTaskCompleted = false;

            if (typeof subTask === 'string') {
              // Sub-task is a string
              subTaskText = subTask.trim();
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
              console.log(`[createPlaybook] Added sub-task: "${subTaskText}"`);
            } else {
              console.warn('[createPlaybook] Skipping sub-task with invalid text:', subTask);
            }
          });
        }
      });

      console.log('[createPlaybook] Total sub-tasks to insert:', subTasksToInsert.length);
      console.log('[createPlaybook] Sub-tasks data:', subTasksToInsert);

      if (subTasksToInsert.length > 0) {
        const { error: subTasksError } = await supabase
          .from('playbook_sub_tasks')
          .insert(subTasksToInsert);

        if (subTasksError) {
          console.error('[createPlaybook] Error creating sub-tasks:', subTasksError);
          throw subTasksError;
        }
      }
    }

    // Create affirmations
    if (playbook.affirmations && playbook.affirmations.length > 0) {
      console.log('[createPlaybook] Processing affirmations:', playbook.affirmations.length);

      const affirmationsToInsert: any[] = [];

      playbook.affirmations.forEach((affirmation, index) => {
        // Handle both string and object formats
        let affirmationText = '';
        let affirmationCompleted = false;

        if (typeof affirmation === 'string') {
          // Affirmation is a string
          affirmationText = affirmation.trim();
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
          console.log(`[createPlaybook] Added affirmation: "${affirmationText}"`);
        } else {
          console.warn('[createPlaybook] Skipping affirmation with invalid text:', affirmation);
        }
      });

      console.log('[createPlaybook] Total affirmations to insert:', affirmationsToInsert.length);

      const { error: affirmationsError } = await supabase
        .from('playbook_affirmations')
        .insert(affirmationsToInsert);

      if (affirmationsError) {
        console.error('[createPlaybook] Error creating affirmations:', affirmationsError);
        throw affirmationsError;
      }
    }

    // Fetch the complete playbook with all related data
    const completePlaybook = await getPlaybook(playbook.user_id, playbookId);
    if (!completePlaybook) {
      throw new Error('Failed to fetch created playbook');
    }

    console.log('[createPlaybook] Successfully created playbook');
    return completePlaybook;

  } catch (error) {
    console.error('[createPlaybook] Unexpected error:', error);
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
  console.log('[updatePlaybookActionStep] Updating:', { playbookId, stepId, completed });

  try {
    // Update the action step
    const { error: updateError } = await supabase
      .from('playbook_action_steps')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', stepId)
      .eq('playbook_id', playbookId);

    if (updateError) {
      console.error('[updatePlaybookActionStep] Error updating action step:', updateError);
      throw updateError;
    }

    // Fetch and return the updated playbook
    const updatedPlaybook = await getPlaybook(userId, playbookId);
    if (!updatedPlaybook) {
      throw new Error('Failed to fetch updated playbook');
    }

    console.log('[updatePlaybookActionStep] Successfully updated action step');
    return updatedPlaybook;

  } catch (error) {
    console.error('[updatePlaybookActionStep] Unexpected error:', error);
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
): Promise<Playbook> {
  console.log('[updatePlaybookSubTask] Updating:', { playbookId, stepId, subTaskId, completed });

  try {
    // Update the sub-task
    const { error: updateError } = await supabase
      .from('playbook_sub_tasks')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', subTaskId)
      .eq('action_step_id', stepId);

    if (updateError) {
      console.error('[updatePlaybookSubTask] Error updating sub-task:', updateError);
      throw updateError;
    }

    // Fetch and return the updated playbook
    const updatedPlaybook = await getPlaybook(userId, playbookId);
    if (!updatedPlaybook) {
      throw new Error('Failed to fetch updated playbook');
    }

    console.log('[updatePlaybookSubTask] Successfully updated sub-task');
    return updatedPlaybook;

  } catch (error) {
    console.error('[updatePlaybookSubTask] Unexpected error:', error);
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
  console.log('[updatePlaybookAffirmation] Updating:', { playbookId, affirmationId, completed });

  try {
    // Update the affirmation
    const { error: updateError } = await supabase
      .from('playbook_affirmations')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', affirmationId)
      .eq('playbook_id', playbookId);

    if (updateError) {
      console.error('[updatePlaybookAffirmation] Error updating affirmation:', updateError);
      throw updateError;
    }

    // Fetch and return the updated playbook
    const updatedPlaybook = await getPlaybook(userId, playbookId);
    if (!updatedPlaybook) {
      throw new Error('Failed to fetch updated playbook');
    }

    console.log('[updatePlaybookAffirmation] Successfully updated affirmation');
    return updatedPlaybook;

  } catch (error) {
    console.error('[updatePlaybookAffirmation] Unexpected error:', error);
    throw error;
  }
}

/**
 * Delete a playbook and all related data
 */
export async function deletePlaybook(playbookId: string): Promise<void> {
  console.log('[deletePlaybook] Deleting playbook:', playbookId);

  try {
    // Delete the playbook (CASCADE will handle related data)
    const { error: deleteError } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', playbookId);

    if (deleteError) {
      console.error('[deletePlaybook] Error deleting playbook:', deleteError);
      throw deleteError;
    }

    console.log('[deletePlaybook] Successfully deleted playbook');

  } catch (error) {
    console.error('[deletePlaybook] Unexpected error:', error);
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
  console.log('[getPlaybookProgress] Calculating progress for:', playbookId);

  try {
    const { data, error } = await supabase
      .rpc('calculate_playbook_progress', { playbook_uuid: playbookId });

    if (error) {
      console.error('[getPlaybookProgress] Error calculating progress:', error);
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
    console.error('[getPlaybookProgress] Unexpected error:', error);
    throw error;
  }
}

/**
 * Update playbook status
 */
export async function updatePlaybookStatus(
  playbookId: string,
  status: 'ongoing' | 'completed' | 'paused'
): Promise<void> {
  console.log('[updatePlaybookStatus] Updating status:', { playbookId, status });

  try {
    const { error } = await supabase
      .from('playbooks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', playbookId);

    if (error) {
      console.error('[updatePlaybookStatus] Error updating status:', error);
      throw error;
    }

    console.log('[updatePlaybookStatus] Successfully updated status');

  } catch (error) {
    console.error('[updatePlaybookStatus] Unexpected error:', error);
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
    console.log(`[updatePlaybookActionSteps] Updating ${actionSteps.length} action steps for playbook ${playbookId}`);

    // Update each action step in the database
    for (const step of actionSteps) {
      console.log(`[updatePlaybookActionSteps] Updating step ${step.id}, completed: ${step.completed}`);

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
        console.error(`[updatePlaybookActionSteps] Error updating step ${step.id}:`, stepError);
        // Continue with other steps even if one fails
      }

      // Update sub-tasks if they exist
      if (step.subTasks && step.subTasks.length > 0) {
        for (const subTask of step.subTasks) {
          console.log(`[updatePlaybookActionSteps] Updating subtask ${subTask.id}, completed: ${subTask.completed}`);

          const { error: subTaskError } = await supabase
            .from('playbook_sub_tasks')
            .update({
              completed: subTask.completed,
              updated_at: new Date().toISOString(),
            })
            .eq('action_step_id', step.id)
            .eq('id', subTask.id);

          if (subTaskError) {
            console.error(`[updatePlaybookActionSteps] Error updating subtask ${subTask.id}:`, subTaskError);
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

    console.log(`[updatePlaybookActionSteps] Successfully updated all action steps and status for ${playbookId}`);
  } catch (error) {
    console.error('[updatePlaybookActionSteps] Error updating action steps:', error);
    throw error;
  }
}
