/**
 * Modern Devotional Generation API
 * Uses direct Supabase session without AsyncStorage bridge
 * Follows the same pattern as playbook generation for consistency
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { AUTH_ERROR_MESSAGES, API_RETRY_DELAY } from '../constants/sessionConstants';
import { Devotional, DevotionalCategory } from '../interfaces/devotional';
import { ENV } from '../config/environment';
import { withCircuitBreaker } from '../utils/circuitBreaker';
import { enterpriseResilience } from '../utils/enterpriseResilience';
import { withTimeout } from '../utils/apiTimeout';
import { monitoring } from '../utils/monitoring';

interface DevotionalGenerationParams {
  duration: number;
  playbookId?: string;
  userInput?: string;
  isOnboarding?: boolean;
  bibleVersion?: string;
  dateOfBirth?: string;
  ageGroup?: string;
}

// Use the standard Devotional interface
type GeneratedDevotional = Devotional;

/**
 * Internal devotional generation function
 * Wrapped by public API with enterprise resilience
 */
async function generateDevotionalInternal(
  params: DevotionalGenerationParams,
  userId: string,
  maxRetries: number = 5
): Promise<GeneratedDevotional> {
  const { duration, playbookId, userInput, isOnboarding, bibleVersion } = params;

  // Get fresh session directly from Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error(AUTH_ERROR_MESSAGES.NO_SESSION);
  }

  // Validate session token
  if (!session.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
  }

  const functionUrl = `${process.env.SUPABASE_URL || 'https://aesmrjinczhknchlrsmt.supabase.co'}/functions/v1/generate-devotional`;
  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {

      // Get user profile for age data
      let dateOfBirth: string | undefined;
      let ageGroup: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();

        Logger.info('Devotional user metadata snapshot for age detection', {
          component: 'modernDevotionalApi',
          data: {
            userMetadata: (user as any)?.user_metadata,
          },
        });

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

          // Get age group from user metadata (onboarding)
          ageGroup = (user as any)?.user_metadata?.ageGroup;
        }
      } catch {}

      // Always use Supabase SDK for production reliability
      // Supabase SDK handles iOS networking gracefully in all environments
      const shouldUseSupabaseSDK = true;

      let result;
      if (shouldUseSupabaseSDK) {
        // Use Supabase SDK (like onboarding does) - handles iOS networking gracefully
        Logger.info('Using Supabase SDK for production reliability', {
          component: 'modernDevotionalApi',
          data: { operation: 'devotional-generation', duration, hasPlaybookId: !!playbookId },
        });

        try {
          const sdkResponse = await withTimeout(
            supabase.functions.invoke('generate-devotional', {
              body: {
                duration,
                playbookId,
                userInput: userInput || 'General spiritual growth',
                bibleVersion: bibleVersion || 'NASB',
                dateOfBirth,
                ageGroup,
              },
            }),
            {
              timeoutMs: 180000, // 180 seconds (3 minutes) for TestFlight reliability
              operationName: 'Devotional Generation',
            }
          );

          Logger.info('Supabase SDK response received', {
            component: 'modernDevotionalApi',
            data: {
              hasError: !!sdkResponse.error,
              hasData: !!sdkResponse.data,
              errorType: typeof sdkResponse.error,
              dataType: typeof sdkResponse.data,
            },
          });

          // Transform Supabase SDK response
          if (sdkResponse.error) {
            Logger.error('Supabase SDK error', new Error(sdkResponse.error.message || 'Devotional generation failed'), {
              component: 'modernDevotionalApi',
              data: {
                error: sdkResponse.error,
                errorDetails: JSON.stringify(sdkResponse.error, null, 2),
              },
            });
            throw new Error(sdkResponse.error.message || 'Devotional generation failed');
          }

          if (!sdkResponse.data) {
            Logger.error('No data returned from Supabase SDK', new Error('No data returned from devotional generation'), {
              component: 'modernDevotionalApi',
              data: { sdkResponse },
            });
            throw new Error('No data returned from devotional generation');
          }

          // Supabase SDK already parsed JSON, use data directly
          result = sdkResponse.data;

          Logger.info('Supabase SDK success', {
            component: 'modernDevotionalApi',
            data: {
              resultType: typeof result,
              hasDays: result?.days?.length > 0,
              dayCount: result?.days?.length,
            },
          });
        } catch (sdkError) {
          Logger.error('Supabase SDK invocation failed, attempting fallback', sdkError as Error, {
            component: 'modernDevotionalApi',
            data: {
              errorType: sdkError?.constructor?.name,
              errorMessage: (sdkError as Error)?.message,
              errorDetails: (sdkError as Error)?.stack,
            },
          });

          // FALLBACK: Try fetch approach if SDK fails in TestFlight
          Logger.warn('Falling back to fetch approach due to SDK failure', {
            component: 'modernDevotionalApi',
          });

          const response = await withTimeout(
            fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': ENV.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                duration,
                playbookId,
                userInput: userInput || 'General spiritual growth',
                bibleVersion: bibleVersion || 'NASB',
                dateOfBirth,
                ageGroup,
              }),
            }),
            {
              timeoutMs: 180000,
              operationName: 'Devotional Generation (Fallback)',
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            Logger.error('Fallback fetch also failed', new Error(`Fallback failed: ${response.status}`), {
              component: 'modernDevotionalApi',
              data: { status: response.status, errorText },
            });
            throw new Error(`Devotional generation failed: ${response.status} - ${errorText}`);
          }

          result = await response.json();
          Logger.info('Fallback fetch succeeded', {
            component: 'modernDevotionalApi',
            data: { resultType: typeof result },
          });
        }
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
                duration,
                playbookId,
                userInput: userInput || 'General spiritual growth',
                bibleVersion: bibleVersion || 'NASB',
                dateOfBirth,
                ageGroup,
              }),
            }),
            {
              timeoutMs: 180000, // 180 seconds (3 minutes) for TestFlight reliability
              operationName: 'Devotional Generation',
            }
          );
        });

        if (!response.ok) {
        const errorText = await response.text();

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error(AUTH_ERROR_MESSAGES.SESSION_EXPIRED);
        } else if (response.status === 403) {
          throw new Error(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
        } else if (response.status >= 500) {
          Logger.error('Backend server error', new Error(`Server error: ${response.status}`), {
            component: 'modernDevotionalApi',
            data: { status: response.status, errorText, url: functionUrl },
          });
          throw new Error(`Server error: ${response.status}. Please try again.`);
        } else {
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
        }

        result = await response.json();
      }

      // Validate the response structure
      if (!result || !Array.isArray(result.days) || result.days.length === 0) {
        throw new Error('Invalid devotional format received from server');
      }

      // Choose a category: prefer result.category/categories if present, else derive from title/description
      // Database constraint only allows: Prayer, Growth, Healing, Wisdom, Relationships, Purpose, Career, Finances, Mental Health, Parenting, Health
      const deriveCategory = (payload: any): DevotionalCategory => {
        try {
          const fromResult: string | undefined = (payload?.category as string) || (Array.isArray(payload?.categories) ? payload.categories[0] : undefined);

          // Validate that the category from result is allowed by database constraint
          const allowedCategories = ['Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'];
          if (fromResult && typeof fromResult === 'string' && allowedCategories.includes(fromResult)) {
            return fromResult as DevotionalCategory;
          }

          const base = `${payload?.title || ''} ${payload?.description || ''}`.toLowerCase();
          if (base.includes('prayer') || base.includes('pray')) {return 'Prayer' as DevotionalCategory;}
          if (base.includes('love') || base.includes('relationship') || base.includes('family')) {return 'Relationships' as DevotionalCategory;}
          if (base.includes('anxiety') || base.includes('worry') || base.includes('stress') || base.includes('mental')) {return 'Mental Health' as DevotionalCategory;}
          if (base.includes('wisdom') || base.includes('decision') || base.includes('guidance')) {return 'Wisdom' as DevotionalCategory;}
          if (base.includes('purpose') || base.includes('calling') || base.includes('mission')) {return 'Purpose' as DevotionalCategory;}
          if (base.includes('heal') || base.includes('recovery') || base.includes('restoration')) {return 'Healing' as DevotionalCategory;}
          if (base.includes('career') || base.includes('work') || base.includes('job')) {return 'Career' as DevotionalCategory;}
          if (base.includes('money') || base.includes('financial') || base.includes('finances')) {return 'Finances' as DevotionalCategory;}
          if (base.includes('parent') || base.includes('child') || base.includes('kids')) {return 'Parenting' as DevotionalCategory;}
          if (base.includes('health') || base.includes('physical') || base.includes('body')) {return 'Health' as DevotionalCategory;}
          // Default to Growth for spiritual growth, faith, hope, etc.
          return 'Growth' as DevotionalCategory;
        } catch {
          return 'Growth' as DevotionalCategory;
        }
      };

      const computedCategory = deriveCategory(result);

      // Save the generated devotional to the database
      const { data: savedDevotional, error: saveError } = await supabase
        .from('devotionals')
        .insert({
          user_id: session.user.id,
          title: result.title || 'My Devotional',
          description: result.description || '',
          category: computedCategory,
          categories: [computedCategory],
          playbook_id: playbookId || null,
          playbook_title: null, // Will be populated if needed
          user_input: userInput || 'General spiritual growth',
          total_days: duration,
          current_day: 1,
          progress: 0,
          completed: false,
          days: result.days,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveError) {
        Logger.error('Error saving devotional to database', saveError as Error, {
  component: 'modernDevotionalApi',
});
        throw new Error(`Failed to save devotional: ${saveError.message}`);
      }

      // Track usage for subscription after successful generation
      try {
        const { subscriptionService } = await import('./subscriptionService');
        if (session.user?.id) {
          await subscriptionService.trackUsage(session.user.id, 'devotional', 0, isOnboarding || false);

        }
      } catch (trackingError) {
        Logger.warn('[ModernDevotionalApi] Failed to track usage', { component: 'modernDevotionalApi', data: trackingError });
        // Don't fail the generation if tracking fails
      }

      // Track successful generation
      monitoring.trackEvent('devotional_generated', {
        success: true,
        attempts: attempt + 1,
        userId,
        duration,
      }, userId);

      // Return the complete devotional object matching the Devotional interface
      return {
        ...result,
        id: savedDevotional.id,
        userId: savedDevotional.user_id,
        createdAt: savedDevotional.created_at,
        updatedAt: savedDevotional.updated_at,
        category: savedDevotional.category as DevotionalCategory,
        categories: savedDevotional.categories,
        playbookId: savedDevotional.playbook_id,
        playbookTitle: savedDevotional.playbook_title,
        totalDays: savedDevotional.total_days,
        currentDay: savedDevotional.current_day,
        completed: savedDevotional.completed,
        userInput: savedDevotional.user_input,
      };

    } catch (error: any) {
      lastError = error;

      // Convert circuit breaker errors to user-friendly messages
      if (error.message?.includes('Circuit breaker is OPEN')) {
        Logger.warn('Circuit breaker triggered for devotional generation', {
          component: 'modernDevotionalApi',
          data: { attempt: attempt + 1 },
        });
        throw new Error('We\'re experiencing high demand right now. Please try again in a few moments.');
      }

      Logger.error(`Attempt ${attempt + 1} failed:`, error, {
        component: 'modernDevotionalApi',
        data: JSON.stringify({ errorMessage: error.message }),
      });

      // Don't retry on certain errors
      if (error.message.includes('401') || error.message.includes('403')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = API_RETRY_DELAY * Math.pow(2, attempt);
        Logger.info(`Retrying devotional generation in ${delay}ms (attempt ${attempt + 2}/${maxRetries + 1})`, {
          component: 'modernDevotionalApi',
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If all attempts failed, throw the last error
  const errorMessage = lastError?.message || 'Failed to generate devotional after multiple attempts';
  Logger.error('❌ All devotional generation attempts failed', new Error(errorMessage), {
  component: 'modernDevotionalApi',
});
  throw new Error(errorMessage);
}

/**
 * Public API: Generate devotional with enterprise resilience
 * Includes queuing, rate limiting, retries, and circuit breaker protection
 */
export async function generateDevotional(
  params: DevotionalGenerationParams,
  maxRetries: number = 5
): Promise<GeneratedDevotional> {
  // Validate params first
  validateDevotionalParams(params);

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
      Logger.warn('Failed to get user tier for devotional, using default', {
        component: 'modernDevotionalApi',
      });
    }

    // Get age data from user metadata (onboarding)
    if (!params.dateOfBirth && user?.user_metadata?.dateOfBirth) {
      params.dateOfBirth = user.user_metadata.dateOfBirth;
    }
    if (!params.ageGroup && user?.user_metadata?.ageGroup) {
      params.ageGroup = user.user_metadata.ageGroup;
    }
  } catch (error) {
    Logger.error('Failed to get user for devotional generation', error as Error, {
      component: 'modernDevotionalApi',
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

  // Create deduplication key
  const deduplicationKey = `devotional-${userId}-${params.duration}-${params.userInput?.substring(0, 30) || 'default'}`;

  // Wrap with enterprise resilience (includes queuing, rate limiting, retries, health checks)
  return enterpriseResilience.executeWithResilience(
    () => generateDevotionalInternal(params, userId, maxRetries),
    {
      userId,
      tier: userTier,
      operationName: 'devotional-generation',
      priority,
      deduplicationKey,
    }
  );
}

/**
 * Helper function to validate devotional generation parameters
 */
export function validateDevotionalParams(params: DevotionalGenerationParams): void {
  const { duration, userInput } = params;

  if (!duration || duration < 1 || duration > 365) {
    throw new Error('Duration must be between 1 and 365 days');
  }

  if (userInput && userInput.length > 1000) {
    throw new Error('User input must be less than 1000 characters');
  }
}
