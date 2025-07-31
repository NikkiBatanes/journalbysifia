/**
 * Modern Playbook API
 * Uses direct Supabase session without AsyncStorage dependencies
 * Replaces legacy playbook operations with modern implementations
 */

import { supabase } from './supabaseClient';
import { Playbook } from '../interfaces/playbook';
import { generateUUID, ensureValidUUID } from '../utils/uuidUtils';
import { API_RETRY_ATTEMPTS, API_RETRY_DELAY, AUTH_ERROR_MESSAGES } from '../constants/sessionConstants';

/**
 * Robust session retrieval with retry logic
 * Handles race conditions during operation protection periods
 */
async function getSessionWithRetry(retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn(`Session retrieval error (attempt ${i + 1}/${retries}):`, sessionError);
        if (i === retries - 1) {throw sessionError;}
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }

      if (!session) {
        console.warn(`No session found (attempt ${i + 1}/${retries})`);
        if (i === retries - 1) {
          // Final attempt - try to refresh session
          try {
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (refreshedSession) {
              console.log('✅ Session recovered via refresh');
              return refreshedSession;
            }
          } catch (refreshError) {
            console.error('❌ Session refresh failed:', refreshError);
          }
          throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      return session;
    } catch (error) {
      console.error(`Session retrieval failed (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) {throw error;}
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
}
import { addJournalTypesToPlaybook } from '../utils/journalTypeDetection';

/**
 * Generate a new playbook using modern Supabase session
 * This replaces the legacy generatePlaybook function
 */
export async function generatePlaybook(
  userInput: string,
  userName: string,
  maxRetries: number = API_RETRY_ATTEMPTS
): Promise<Playbook> {
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
      console.log(`Generating playbook (attempt ${attempt + 1}/${maxRetries + 1})`);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE0NzEsImV4cCI6MjA1MDU0NzQ3MX0.Uy4Tz2Vy8Hs7Qg8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userInput, userName }),
      });

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

      console.log('✅ Playbook generated successfully with ID:', result.id);
      console.log('✅ Journal types detected and added to subtasks');
      return playbookWithJournalTypes;

    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;

      console.warn(`Playbook generation attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on authentication errors
      if (error.message.includes('session') || error.message.includes('token') || error.message.includes('sign in')) {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff delay
        const delay = API_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If we get here, all retries failed
  const errorMessage = lastError?.message || 'Failed to generate playbook after multiple attempts';
  console.error('❌ All playbook generation attempts failed:', errorMessage);
  throw new Error(errorMessage);
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

    console.log('💾 Saving playbook with UUID:', playbook.id);

    // Save to Supabase using the actual database schema
    const { data, error } = await supabase
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
      console.error('Error saving playbook to Supabase:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Playbook saved successfully:', data.id);

    // Save action steps to separate table
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {
      console.log('💾 Saving action steps to separate table...');

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
        console.error('❌ Error saving action steps:', actionStepsError);
        return { success: false, error: `Playbook saved but action steps failed: ${actionStepsError.message}` };
      }

      console.log('✅ Action steps saved successfully');

      // Save sub-tasks for each action step
      for (const [stepIndex, step] of playbook.actionSteps.entries()) {
        if (step.subTasks && step.subTasks.length > 0) {
          console.log(`💾 Saving ${step.subTasks.length} sub-tasks for step ${stepIndex + 1}...`);

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
            console.error('❌ Error saving sub-tasks:', subTasksError);
            return { success: false, error: `Sub-tasks failed for step ${stepIndex + 1}: ${subTasksError.message}` };
          }

          console.log(`✅ Sub-tasks saved for step ${stepIndex + 1}`);
        }
      }
    }

    // Save affirmations to separate table
    if (playbook.affirmations && playbook.affirmations.length > 0) {
      console.log('💾 Saving affirmations to separate table...');

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
        console.error('❌ Error saving affirmations:', affirmationsError);
        return { success: false, error: `Playbook saved but affirmations failed: ${affirmationsError.message}` };
      }

      console.log('✅ Affirmations saved successfully');
    }

    return { success: true };

  } catch (error: any) {
    console.error('❌ Failed to save playbook:', error);
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
    console.log('💾 Updating action steps for playbook:', playbookId, 'for user:', userId);

    // Verify playbook ownership for RLS
    const { data: playbookData, error: ownershipError } = await supabase
      .from('playbooks')
      .select('user_id')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (ownershipError || !playbookData) {
      console.error('❌ Playbook ownership verification failed:', ownershipError);
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
          console.error(`❌ Error updating action step ${step.id}:`, updateError);
          return { success: false, error: `Failed to update action step ${index + 1}: ${updateError.message}` };
        }

        // Update subtasks if they exist and have completion status
        if (step.subTasks && Array.isArray(step.subTasks) && step.subTasks.length > 0) {
          console.log(`📝 Updating ${step.subTasks.length} subtasks for step ${step.id}`);

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
                console.error(`❌ Error updating subtask ${subTask.id}:`, subTaskError);
                // Continue with other subtasks even if one fails
              } else {
                console.log(`✅ Updated subtask ${subTask.id} completed: ${subTask.completed}`);
              }
            }
          }
        }
      }

      console.log('✅ Action steps and subtasks updated successfully');
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
      console.error('❌ Error updating playbook status:', updateError);
      return { success: false, error: `Failed to update playbook status: ${updateError.message}` };
    }

    console.log('✅ Playbook action steps updated successfully');
    return { success: true };

  } catch (error: any) {
    console.error('❌ Failed to update playbook action steps:', error);
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
      console.error('❌ Invalid playbook ID format for deletion:', playbookId);
      return { success: false, error: `Invalid playbook ID format: ${playbookId}. Expected UUID format.` };
    }

    // Delete from Supabase
    const { error } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', playbookId);

    if (error) {
      console.error('Error deleting playbook from Supabase:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Playbook deleted successfully:', playbookId);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Failed to delete playbook:', error);
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
    if (Array.isArray(step.subtasks)) {
      step.subtasks.forEach((sub: any) => {
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
  console.log('[modernGetPlaybooks] Fetching playbooks for user:', userId);

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
    console.error('[modernGetPlaybooks] Error fetching playbooks:', error);
    throw new Error(`Failed to fetch playbooks: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('[modernGetPlaybooks] No playbooks found');
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

  console.log('[modernGetPlaybooks] Returning', playbooks.length, 'playbooks with accurate progress');
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

    console.log('📖 Fetching single playbook:', { userId, playbookId });

    // Validate and ensure proper UUID format
    const validatedId = ensureValidUUID(playbookId, 'getPlaybook');
    if (validatedId !== playbookId) {
      console.error('❌ Invalid playbook ID format:', playbookId);
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
        console.log('📖 Playbook not found');
        return null;
      }
      console.error('❌ Failed to fetch playbook:', error);
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
      console.warn('⚠️ Warning: Could not fetch action steps:', actionStepsError);
    }

    // Fetch affirmations from separate table
    const { data: affirmationsData, error: affirmationsError } = await supabase
      .from('playbook_affirmations')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index');

    if (affirmationsError) {
      console.warn('⚠️ Warning: Could not fetch affirmations:', affirmationsError);
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
        console.warn('⚠️ Warning: Could not fetch sub-tasks:', subTasksError);
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

    console.log('[DEBUG] Progress calculation:', { totalTasks, completedTasks, progress });

    // Transform to Playbook interface
    const playbook: Playbook = {
      id: data.id,
      title: data.title,
      userInput: data.user_input || '', // Use the actual user_input column
      truthInLove: data.truth_in_love || { text: '', summary: '' },
      actionSteps: actionSteps,
      affirmations: affirmations,
      bibleVerse: data.bible_verse || { text: '', reference: '' },
      directChallenge: data.direct_challenge,
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

    console.log('✅ Playbook fetched successfully:', playbook.id);
    return playbook;

  } catch (error: any) {
    console.error('❌ Failed to fetch playbook:', error);
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
