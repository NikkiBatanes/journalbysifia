/**
 * Modern Playbook API
 * Uses direct Supabase session without AsyncStorage dependencies
 * Replaces legacy playbook operations with modern implementations
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { Playbook } from '../interfaces/playbook';
import { generateUUID, ensureValidUUID } from '../utils/uuidUtils';
import { API_RETRY_ATTEMPTS, API_RETRY_DELAY, AUTH_ERROR_MESSAGES } from '../constants/sessionConstants';
import { withTimeout, TIMEOUT_CONFIGS, isTimeoutError } from '../utils/apiTimeout';
import { deduplicatePlaybookGeneration } from '../utils/requestDeduplication';
import { monitoring } from '../utils/monitoring';

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
      Logger.error(`Session retrieval failed (attempt ${i + 1}/${retries}):`, {
        component: 'modernPlaybookApi',
        data: error,
      });
      if (i === retries - 1) {throw error;}
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
}
import { addJournalTypesToPlaybook } from '../utils/journalTypeDetection';

/**
 * Internal function that does the actual generation
 * Wrapped by generatePlaybook for deduplication
 */
async function generatePlaybookInternal(
  userInput: string,
  userName: string,
  userId: string,
  maxRetries: number = API_RETRY_ATTEMPTS
): Promise<Playbook> {
  // Start performance timer (no UI impact)
  const endTimer = monitoring.startTimer('playbook_generation');
  
  // Get session with retry logic to handle race conditions
  const session = await getSessionWithRetry();

  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
  }

  // Validate session token
  if (!session.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
  }

  const functionUrl = `${process.env.SUPABASE_URL || 'https://aesmrjinczhknchlrsmt.supabase.co'}/functions/v1/generate-playbook`;
  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {

      // Resolve user's preferred Bible version (default NASB) and get userId
      let bibleVersion = 'NASB';
      let userId: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id; // ENTERPRISE: Pass userId for context-aware generation
        const fromMeta = (user as any)?.user_metadata?.preferences?.content?.bibleVersion;
        if (typeof fromMeta === 'string' && fromMeta.trim()) {
          bibleVersion = fromMeta.trim();
        }
      } catch {}

      // Wrap fetch with timeout to prevent hanging (60s for AI generation)
      const response = await withTimeout(
        fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE0NzEsImV4cCI6MjA1MDU0NzQ3MX0.Uy4Tz2Vy8Hs7Qg8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userInput, userName, bibleVersion, userId }),
        }),
        TIMEOUT_CONFIGS.AI_GENERATION
      );

      if (!response.ok) {
        const errorText = await response.text();

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error(AUTH_ERROR_MESSAGES.SESSION_EXPIRED);
        } else if (response.status === 403) {
          throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}. Please try again.`);
        } else {
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
      }

      const result = await response.json();

      // Validate the response structure
      if (!result || !result.title || !Array.isArray(result.actionSteps)) {
        throw new Error('Invalid playbook format received from server');
      }

      // Ensure the playbook has a proper UUID
      result.id = ensureValidUUID(result.id, 'generatePlaybook response');

      // Add journal type detection to all subtasks
      const playbookWithJournalTypes = addJournalTypesToPlaybook(result);

      // Track successful generation (no UI impact)
      endTimer(true);
      monitoring.trackEvent('playbook_generated', {
        success: true,
        attempts: attempt + 1,
        userId,
      }, userId);

      // Usage tracking is handled by GeneratingPlaybookScreen.tsx to avoid double counting
      // and to properly handle onboarding flag

      return playbookWithJournalTypes;

    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;

      // Log timeout errors differently
      if (isTimeoutError(error)) {
        Logger.warn(`⏱️ Playbook generation timeout (attempt ${attempt + 1}):`, {
          component: 'modernPlaybookApi',
          data: error.message,
        });
      } else {
        Logger.warn(`Playbook generation attempt ${attempt + 1} failed:`, {
          component: 'modernPlaybookApi',
          data: error.message,
        });
      }

      // Don't retry on authentication errors or timeouts (timeout means server is slow, not failed)
      if (error.message.includes('session') || error.message.includes('token') || error.message.includes('sign in') || isTimeoutError(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff delay
        const delay = API_RETRY_DELAY * Math.pow(2, attempt);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If we get here, all retries failed
  const errorMessage = lastError?.message || 'Failed to generate playbook after multiple attempts';
  Logger.error('❌ All playbook generation attempts failed', new Error(errorMessage), {
      component: 'modernPlaybookApi',
      action: 'error',
    });
  throw new Error(errorMessage);
}

/**
 * Generate a new playbook with request deduplication
 * Public API that wraps generatePlaybookInternal with deduplication
 * Prevents duplicate requests from the same user with same input
 */
export async function generatePlaybook(
  userInput: string,
  userName: string,
  maxRetries: number = API_RETRY_ATTEMPTS
): Promise<Playbook> {
  // Get userId for deduplication
  let userId: string;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    userId = user.id;
  } catch (error) {
    Logger.error('Failed to get user for deduplication', error as Error, {
      component: 'modernPlaybookApi',
    });
    throw error;
  }

  // Wrap with deduplication
  return deduplicatePlaybookGeneration(
    userId,
    userInput,
    () => generatePlaybookInternal(userInput, userName, userId, maxRetries)
  );
}

/**
 * Save a playbook using modern Supabase session
 * This replaces the legacy savePlaybook function
 */
export async function savePlaybook(playbook: Playbook, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get session with retry logic to handle race conditions
    const session = await getSessionWithRetry();

    if (!session?.access_token) {
      throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Ensure playbook has a proper UUID
    playbook.id = ensureValidUUID(playbook.id, 'savePlaybook');

    // Save to Supabase using the actual database schema
    const { error } = await supabase
      .from('playbooks')
      .upsert({
        id: playbook.id,
        user_id: userId,
        title: playbook.title,
        user_input: playbook.userInput, // Use the actual user_input column
        truth_in_love: playbook.truthInLove,
        bible_verse: playbook.bibleVerse,
        direct_challenge: playbook.directChallenge,
        challenge_cta: playbook.challengeCTA,
        status: playbook.status || 'ongoing',
        created_at: playbook.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      Logger.error('Error saving playbook to Supabase', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
      return { success: false, error: error.message };
    }

    // Save action steps to separate table
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {

      // Delete existing action steps
      await supabase
        .from('playbook_action_steps')
        .delete()
        .eq('playbook_id', playbook.id);

      // Insert new action steps with examples in dedicated field
      const actionStepsToInsert = playbook.actionSteps.map((step, index) => {
        // Handle both string and array formats for examples
        let examplesText = '';
        if (step.examples) {
          examplesText = Array.isArray(step.examples)
            ? step.examples.join('; ')
            : step.examples;
        }

        return {
          id: step.id,
          playbook_id: playbook.id,
          text: step.title, // Clean title without examples
          examples: examplesText, // Store examples in dedicated field
          completed: step.completed || false,
          order_index: index,
          example_interactive: step.example_interactive || false,
        };
      });

      const { error: actionStepsError } = await supabase
        .from('playbook_action_steps')
        .insert(actionStepsToInsert);

      if (actionStepsError) {
        Logger.error('❌ Error saving action steps', actionStepsError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
        return { success: false, error: `Playbook saved but action steps failed: ${actionStepsError.message}` };
      }

      // Save sub-tasks for each action step
      for (const [stepIndex, step] of playbook.actionSteps.entries()) {
        if (step.subTasks && step.subTasks.length > 0) {

          // Delete existing sub-tasks for this action step
          await supabase
            .from('playbook_sub_tasks')
            .delete()
            .eq('action_step_id', step.id);

          // Insert new sub-tasks
          const subTasksToInsert = step.subTasks.map((subTask, subIndex) => {
            // Handle both string and object formats for subtasks
            const subTaskText = typeof subTask === 'string' ? subTask : subTask.text;
            const subTaskId = typeof subTask === 'object' && subTask.id ? subTask.id : ensureValidUUID(generateUUID());
            const detectedJournalType = typeof subTask === 'object' ? subTask.detected_journal_type : null;
            const isExample = typeof subTask === 'object' ? subTask.is_example : false;
            const exampleInteractive = typeof subTask === 'object' ? subTask.example_interactive : false;

            return {
              id: subTaskId,
              action_step_id: step.id,
              text: subTaskText,
              completed: typeof subTask === 'object' ? subTask.completed : false,
              order_index: subIndex,
              detected_journal_type: detectedJournalType,
              is_example: isExample,
              example_interactive: exampleInteractive,
            };
          });

          const { error: subTasksError } = await supabase
            .from('playbook_sub_tasks')
            .insert(subTasksToInsert);

          if (subTasksError) {
            Logger.error('❌ Error saving sub-tasks', subTasksError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
            return { success: false, error: `Sub-tasks failed for step ${stepIndex + 1}: ${subTasksError.message}` };
          }

        }
      }
    }

    // Save affirmations to separate table
    if (playbook.affirmations && playbook.affirmations.length > 0) {

      // Delete existing affirmations
      await supabase
        .from('playbook_affirmations')
        .delete()
        .eq('playbook_id', playbook.id);

      // Insert new affirmations
      const affirmationsToInsert = playbook.affirmations.map((affirmation, index) => ({
        id: affirmation.id,
        playbook_id: playbook.id,
        text: affirmation.text,
        completed: affirmation.completed || false,
        order_index: index,
      }));

      const { error: affirmationsError } = await supabase
        .from('playbook_affirmations')
        .insert(affirmationsToInsert);

      if (affirmationsError) {
        Logger.error('❌ Error saving affirmations', affirmationsError as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
        return { success: false, error: `Playbook saved but affirmations failed: ${affirmationsError.message}` };
      }

    }

    // Emit event to notify dashboard and other components
    try {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('playbook_created', { id: playbook.id, user_id: userId });
    } catch {}

    return { success: true };

  } catch (error: any) {
    Logger.error('❌ Failed to save playbook', error as Error, {
      component: 'modernPlaybookApi',
      action: 'error',
    });
    return { success: false, error: error.message };
  }
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
          Logger.error(`❌ Error updating action step ${step.id}:`, {
        component: 'modernPlaybookApi',
        data: updateError,
      });
          return { success: false, error: `Failed to update action step ${index + 1}: ${updateError.message}` };
        }

        // Update subtasks if they exist and have completion status
        if (step.subTasks && Array.isArray(step.subTasks) && step.subTasks.length > 0) {

          for (const subTask of step.subTasks) {
            // Only update if subTask has an id (exists in database)
            if (subTask.id && typeof subTask === 'object' && 'completed' in subTask) {
              const { error: subTaskError } = await supabase
                .from('playbook_sub_tasks')
                .update({
                  completed: Boolean(subTask.completed),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', subTask.id)
                .eq('action_step_id', step.id);

              if (subTaskError) {
                Logger.error(`❌ Error updating subtask ${subTask.id}:`, {
        component: 'modernPlaybookApi',
        data: subTaskError,
      });
                // Continue with other subtasks even if one fails
              } else {

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
      profileImage: item.profile_image,
      progress: accurateProgress, // Use calculated progress, not stored progress
      totalTasks: total,
      user_id: item.user_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      completedAt: item.completed_at,
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
          detected_journal_type: subTask.detected_journal_type || undefined,
        }));

      return {
        id: step.id,
        title: step.text,
        description: '', // Not stored in database
        subTasks: stepSubTasks,
        examples: step.examples || '', // Read from dedicated examples field
        completed: step.completed,
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
      ? { text: rawTruth.text || '', summary: rawTruth.summary || '' }
      : { text: typeof rawTruth === 'string' ? rawTruth : '', summary: '' };

    const rawBible = safeParse(data.bible_verse);
    const normalizedBible = rawBible && typeof rawBible === 'object'
      ? { text: rawBible.text || '', reference: rawBible.reference || '' }
      : { text: typeof rawBible === 'string' ? rawBible : '', reference: '' };

    const rawChallenge = safeParse(data.direct_challenge);
    const normalizedChallenge = rawChallenge && typeof rawChallenge === 'object'
      ? { text: rawChallenge.text || '', summary: rawChallenge.summary || '' }
      : (typeof rawChallenge === 'string' ? rawChallenge : '');

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
      profileImage: '', // Not stored in current schema
      progress: progress, // Calculated manually
      totalTasks: totalTasks, // Calculated manually
      user_id: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: null, // Not stored in current schema
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

/**
 * Helper function to validate playbook generation parameters
 */
export function validatePlaybookParams(userInput: string, userName: string): void {
  if (!userInput || userInput.trim().length === 0) {
    throw new Error('User input is required for playbook generation');
  }

  if (userInput.length > 2000) {
    throw new Error('User input must be less than 2000 characters');
  }

  if (!userName || userName.trim().length === 0) {
    throw new Error('User name is required for playbook generation');
  }
}
