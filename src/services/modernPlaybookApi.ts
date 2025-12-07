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
// Deduplication disabled for fresh personalized generation
// import { deduplicatePlaybookGeneration } from '../utils/requestDeduplication';
import { monitoring } from '../utils/monitoring';
import { withCircuitBreaker } from '../utils/circuitBreaker';
import { enterpriseResilience } from '../utils/enterpriseResilience';
import { ENV } from '../config/environment';
// Offline queue utilities available but not currently used
// import { queuePlaybookGeneration, isOnline } from '../utils/offlineQueue';

/**
 * Utility function to detect network errors
 */
function isNetworkError(error: any): boolean {
  const isNetwork = (
    error?.message?.includes('Network request failed') ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('fetch') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'ECONNRESET' ||
    error?.code === 'ETIMEDOUT'
  );

  // Temporary debug logging for TestFlight network issues
  if (isNetwork) {
    Logger.error('Network error detected in TestFlight', {
      component: 'modernPlaybookApi',
      data: {
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack,
        apiBaseUrl: ENV.API_BASE_URL,
        appEnv: ENV.APP_ENV,
      },
    });
  }

  return isNetwork;
}

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
import { addJournalTypesToPlaybook } from '../utils/journalTypeDetection';

/**
 * Validates playbook completeness and quality
 * Returns error message if validation fails, null if valid
 */
function validatePlaybookCompleteness(playbook: any): string | null {
  // Check title quality
  if (!playbook.title || playbook.title.trim().length < 5) {
    return 'Title is too short or missing';
  }

  if (playbook.title.length > 200) {
    return 'Title is too long';
  }

  // Check action steps completeness
  if (!Array.isArray(playbook.actionSteps) || playbook.actionSteps.length === 0) {
    return 'No action steps provided';
  }

  if (playbook.actionSteps.length < 3) {
    return 'Too few action steps (minimum 3 required)';
  }

  if (playbook.actionSteps.length > 10) {
    return 'Too many action steps (maximum 10 allowed)';
  }

  // Validate each action step
  for (let i = 0; i < playbook.actionSteps.length; i++) {
    const step = playbook.actionSteps[i];

    if (!step.title || step.title.trim().length < 5) {
      return `Action step ${i + 1} has incomplete title`;
    }

    if (step.title.length > 300) {
      return `Action step ${i + 1} title is too long`;
    }

    // Check for placeholder text that indicates incomplete generation
    const placeholderPatterns = [
      /\[.*\]/, // [placeholder text]
      /\.\.\./, // trailing dots
      /lorem ipsum/i,
      /example here/i,
      /fill in/i,
      /coming soon/i,
      /to be added/i,
      /incomplete/i,
      /partial/i,
    ];

    if (placeholderPatterns.some(pattern => pattern.test(step.title))) {
      return `Action step ${i + 1} contains placeholder text`;
    }

    // Validate subtasks if present
    if (step.subTasks && Array.isArray(step.subTasks)) {
      if (step.subTasks.length > 5) {
        return `Action step ${i + 1} has too many subtasks (maximum 5 allowed)`;
      }

      for (let j = 0; j < step.subTasks.length; j++) {
        const subTask = step.subTasks[j];

        if (!subTask.text || subTask.text.trim().length < 3) {
          return `Subtask ${j + 1} in action step ${i + 1} is incomplete`;
        }

        if (placeholderPatterns.some(pattern => pattern.test(subTask.text))) {
          return `Subtask ${j + 1} in action step ${i + 1} contains placeholder text`;
        }
      }
    }
  }

  // Check truthInLove section if present
  if (playbook.truthInLove) {
    if (typeof playbook.truthInLove === 'string') {
      if (playbook.truthInLove.trim().length > 0 && playbook.truthInLove.length < 10) {
        return 'Truth in Love section is too short';
      }
    } else if (typeof playbook.truthInLove === 'object' && playbook.truthInLove.text) {
      if (playbook.truthInLove.text.trim().length > 0 && playbook.truthInLove.text.length < 10) {
        return 'Truth in Love section is too short';
      }
    }
  }

  // Check bible verse if present
  if (playbook.bibleVerse) {
    if (typeof playbook.bibleVerse === 'string') {
      if (playbook.bibleVerse.trim().length > 0 && playbook.bibleVerse.length < 10) {
        return 'Bible verse is too short';
      }
    } else if (typeof playbook.bibleVerse === 'object' && playbook.bibleVerse.text) {
      if (playbook.bibleVerse.text.trim().length > 0 && playbook.bibleVerse.text.length < 10) {
        return 'Bible verse is too short';
      }
    }
  }

  // Check for overall quality indicators
  const totalLength = playbook.actionSteps.reduce((sum: number, step: any) => {
    return sum + (step.title ? step.title.length : 0) +
           (step.subTasks ? step.subTasks.reduce((subSum: number, subTask: any) =>
             subSum + (subTask.text ? subTask.text.length : 0), 0) : 0);
  }, 0);

  if (totalLength < 100) {
    return 'Playbook content is too short overall';
  }

  return null; // Validation passed
}

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

      // Resolve user's preferred Bible version (default NASB) and get user data
      let bibleVersion = 'NASB';
      let userIdForGeneration: string | undefined;
      let dateOfBirth: string | undefined;
      let ageGroup: string | undefined;
      let location: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userIdForGeneration = user?.id; // ENTERPRISE: Pass userId for context-aware generation
        const fromMeta = (user as any)?.user_metadata?.preferences?.content?.bibleVersion;
        Logger.info('Bible version from user metadata:', {
          component: 'modernPlaybookApi',
          data: { fromMeta, willUse: fromMeta || 'NASB (default)' },
        });
        if (typeof fromMeta === 'string' && fromMeta.trim()) {
          bibleVersion = fromMeta.trim();
        }

        Logger.info('User metadata snapshot for age detection', {
          component: 'modernPlaybookApi',
          data: {
            userMetadata: (user as any)?.user_metadata,
          },
        });

        // Get user profile for age data
        if (user?.id) {
          // First try user_profiles table (where date_of_birth is stored)
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('date_of_birth')
              .eq('id', user.id)
              .single();

            if (profile?.date_of_birth) {
              dateOfBirth = profile.date_of_birth;
            }
          } catch (profileError) {
            // Profile might not exist, continue to fallback
          }

          // Fallback to user_metadata (onboarding data)
          if (!dateOfBirth) {
            const metadata = (user as any)?.user_metadata;
            dateOfBirth = metadata?.dateOfBirth || metadata?.birth_date;
          }
        }

        // Get age group from user metadata (onboarding)
        ageGroup = (user as any)?.user_metadata?.ageGroup;

        // Get location from user preferences
        location = (user as any)?.user_metadata?.preferences?.location;
      } catch {}

      // CRITICAL FIX: Use Supabase SDK instead of raw fetch for TestFlight reliability
      // Onboarding works because it uses supabase.functions.invoke(), not fetch()
      // Raw fetch() has iOS networking issues in TestFlight builds
      const shouldUseSupabaseSDK = !__DEV__; // Production/TestFlight only

      let result;
      if (shouldUseSupabaseSDK) {
        // Use Supabase SDK (like onboarding does) - handles iOS networking gracefully
        Logger.info('Using Supabase SDK for production reliability', {
          component: 'modernPlaybookApi',
          data: { operation: 'playbook-generation', bibleVersion },
        });

        const sdkResponse = await withTimeout(
          supabase.functions.invoke('generate-playbook', {
            body: {
              userInput,
              userName,
              bibleVersion, // Sending Bible version to Supabase function
              userId: userIdForGeneration,
              dateOfBirth,
              ageGroup,
              location, // Send location for regional hotlines
            },
          }),
          TIMEOUT_CONFIGS.AI_GENERATION
        );

        // Transform Supabase SDK response
        if (sdkResponse.error) {
          // Check if the error data contains CONTENT_BLOCKED or AI_REFUSED
          const errorData = sdkResponse.error as any;
          if (errorData.message && typeof errorData.message === 'string') {
            try {
              const parsedError = JSON.parse(errorData.message);
              if (parsedError.error === 'CONTENT_BLOCKED' || parsedError.error === 'AI_REFUSED') {
                const blockError: any = new Error(parsedError.message || 'Content blocked');
                blockError.contentBlocked = true;
                blockError.christianMessage = parsedError.message;
                blockError.alternatives = parsedError.alternatives;
                blockError.category = parsedError.category;
                throw blockError;
              }
            } catch (parseErr) {
              // Not a JSON error, proceed with regular error handling
            }
          }
          throw new Error(sdkResponse.error.message || 'Playbook generation failed');
        }

        if (!sdkResponse.data) {
          throw new Error('No data returned from playbook generation');
        }

        // Supabase SDK already parsed JSON, use data directly
        result = sdkResponse.data;
      } else {
        // Development mode: Use raw fetch with circuit breaker
        const response = await withCircuitBreaker('openai-generation', async () => {
          return withTimeout(
            fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': ENV.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userInput,
                userName,
                bibleVersion,
                userId: userIdForGeneration,
                dateOfBirth,
                ageGroup,
                location,
              }),
            }),
            TIMEOUT_CONFIGS.AI_GENERATION
          );
        });

        if (!response.ok) {
          // Read as text first (can only read body once)
          const errorText = await response.text();

          // Try to parse as JSON (for structured errors like CONTENT_BLOCKED)
          try {
            const errorData = JSON.parse(errorText);

            // Handle CONTENT_BLOCKED error specially
            if (errorData.error === 'CONTENT_BLOCKED') {
              const blockError: any = new Error(errorData.message || 'Content blocked');
              blockError.contentBlocked = true;
              blockError.christianMessage = errorData.message;
              blockError.alternatives = errorData.alternatives;
              blockError.category = errorData.category;
              throw blockError;
            }

            // Handle AI_REFUSED error (AI can't generate even after paraphrasing)
            if (errorData.error === 'AI_REFUSED') {
              const refusedError: any = new Error(errorData.message || 'AI cannot generate content for this topic');
              refusedError.contentBlocked = true; // Treat same as contentBlocked for UI
              refusedError.christianMessage = errorData.message;
              refusedError.alternatives = errorData.alternatives;
              refusedError.category = errorData.category;
              throw refusedError;
            }

            // Handle other JSON errors
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          } catch (parseError) {
            // If it's already a CONTENT_BLOCKED error, re-throw it
            if ((parseError as any).contentBlocked) {
              throw parseError;
            }

            // JSON parsing failed, use text error
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
        }

        result = await response.json();
      }

      // Enhanced validation for complete playbook content
      if (!result || !result.title || !Array.isArray(result.actionSteps)) {
        throw new Error('Invalid playbook format received from server');
      }

      // Validate content completeness and quality
      const validationError = validatePlaybookCompleteness(result);
      if (validationError) {
        throw new Error(`Incomplete playbook: ${validationError}`);
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

      // Don't retry on authentication errors, timeouts, or CONTENT_BLOCKED errors
      // CONTENT_BLOCKED errors should fail immediately - retrying wastes money and won't succeed
      if (error.message.includes('session') ||
          error.message.includes('token') ||
          error.message.includes('sign in') ||
          (error as any).contentBlocked ||
          isTimeoutError(error)) {
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
  // Get userId and tier for enterprise resilience
  let userId: string;
  let userTier = 'seeker'; // default

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    userId = user.id;

    // Get user tier for rate limiting and priority
    try {
      const { subscriptionService } = await import('./subscriptionService');
      const subscription = await subscriptionService.getUserSubscription(userId);
      userTier = subscription.tier;
    } catch (tierError) {
      Logger.warn('Failed to get user tier, using default', {
        component: 'modernPlaybookApi',
      });
    }
  } catch (error) {
    Logger.error('Failed to get user for deduplication', error as Error, {
      component: 'modernPlaybookApi',
    });
    throw error;
  }

  // Get priority based on tier
  const tierPriority: Record<string, number> = {
    transformation: 10,
    growth: 7,
    spark: 5,
    seeker: 3,
  };
  const priority = tierPriority[userTier] || 3;

  // Wrap with enterprise resilience (includes queuing, rate limiting, retries, health checks)
  // NOTE: Deduplication DISABLED to ensure every generation is fresh and personalized
  // Each playbook should be unique even with same input (Bible translations, personalization, etc.)
  return enterpriseResilience.executeWithResilience(
    () => generatePlaybookInternal(userInput, userName, userId, maxRetries),
    {
      userId,
      tier: userTier,
      operationName: 'playbook-generation',
      priority: priority,
    }
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

    // Truncate title to meet database constraint (max 100 characters)
    const truncatedTitle = playbook.title.length > 100
      ? playbook.title.substring(0, 97) + '...'
      : playbook.title;

    // Save to Supabase using the actual database schema
    const { error } = await supabase
      .from('playbooks')
      .upsert({
        id: playbook.id,
        user_id: userId,
        title: truncatedTitle,
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

          // Insert new sub-tasks, splitting long ones if needed
          const subTasksToInsert: any[] = [];
          step.subTasks.forEach((subTask, subIndex) => {
            // Handle both string and object formats for subtasks
            const subTaskText = typeof subTask === 'string' ? subTask : subTask.text;
            const subTaskId = typeof subTask === 'object' && subTask.id ? subTask.id : ensureValidUUID(generateUUID());
            const isExample = typeof subTask === 'object' ? subTask.is_example : false;
            const exampleInteractive = typeof subTask === 'object' ? subTask.example_interactive : false;

            // Split long text into multiple sub-tasks if needed (approx 500 chars per sub-task)
            const MAX_LENGTH = 500;
            if (subTaskText.length > MAX_LENGTH) {
              const words = subTaskText.split(' ');
              let currentText = '';
              let partIndex = 0;

              words.forEach(word => {
                if ((currentText + ' ' + word).length > MAX_LENGTH && currentText) {
                  // Add current part as a separate sub-task
                  subTasksToInsert.push({
                    id: partIndex === 0 ? subTaskId : ensureValidUUID(generateUUID()),
                    action_step_id: step.id,
                    text: currentText.trim(),
                    completed: typeof subTask === 'object' ? subTask.completed : false,
                    order_index: subIndex + partIndex * 0.1, // Keep original order
                    is_example: isExample,
                    example_interactive: exampleInteractive,
                  });
                  currentText = word;
                  partIndex++;
                } else {
                  currentText += (currentText ? ' ' : '') + word;
                }
              });

              // Add remaining text
              if (currentText.trim()) {
                subTasksToInsert.push({
                  id: partIndex === 0 ? subTaskId : ensureValidUUID(generateUUID()),
                  action_step_id: step.id,
                  text: currentText.trim(),
                  completed: typeof subTask === 'object' ? subTask.completed : false,
                  order_index: subIndex + partIndex * 0.1,
                  is_example: isExample,
                  example_interactive: exampleInteractive,
                });
              }
            } else {
              // Add as-is if within limit
              subTasksToInsert.push({
                id: subTaskId,
                action_step_id: step.id,
                text: subTaskText,
                completed: typeof subTask === 'object' ? subTask.completed : false,
                order_index: subIndex,
                is_example: isExample,
                example_interactive: exampleInteractive,
              });
            }
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
