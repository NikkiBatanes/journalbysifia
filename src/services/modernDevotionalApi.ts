/**
 * Modern Devotional Generation API
 * Uses direct Supabase session without AsyncStorage bridge
 * Follows the same pattern as playbook generation for consistency
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { AUTH_ERROR_MESSAGES, API_RETRY_ATTEMPTS, API_RETRY_DELAY } from '../constants/sessionConstants';
import { Devotional, DevotionalCategory } from '../interfaces/devotional';
import { ENV } from '../config/environment';

interface DevotionalGenerationParams {
  duration: number;
  playbookId?: string;
  userInput?: string;
  isOnboarding?: boolean;
  bibleVersion?: string;
}

// Use the standard Devotional interface
type GeneratedDevotional = Devotional;

/**
 * Validates devotional completeness and quality
 * Returns error message if validation fails, null if valid
 */
function validateDevotionalCompleteness(devotional: any, expectedDuration: number): string | null {
  // Check title quality
  if (!devotional.title || devotional.title.trim().length < 5) {
    return 'Title is too short or missing';
  }

  if (devotional.title.length > 200) {
    return 'Title is too long';
  }

  // Check description quality
  if (!devotional.description || devotional.description.trim().length < 10) {
    return 'Description is too short or missing';
  }

  if (devotional.description.length > 1000) {
    return 'Description is too long';
  }

  // Check days completeness
  if (!Array.isArray(devotional.days) || devotional.days.length === 0) {
    return 'No devotional days provided';
  }

  if (devotional.days.length !== expectedDuration) {
    return `Expected ${expectedDuration} days, but got ${devotional.days.length}`;
  }

  // Validate each day
  for (let i = 0; i < devotional.days.length; i++) {
    const day = devotional.days[i];

    if (!day.title || day.title.trim().length < 5) {
      return `Day ${i + 1} has incomplete title`;
    }

    if (!day.content || day.content.trim().length < 50) {
      return `Day ${i + 1} has insufficient content`;
    }

    if (day.content.length > 2000) {
      return `Day ${i + 1} content is too long`;
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
      /placeholder/i,
      /template/i,
    ];

    if (placeholderPatterns.some(pattern => pattern.test(day.title))) {
      return `Day ${i + 1} title contains placeholder text`;
    }

    if (placeholderPatterns.some(pattern => pattern.test(day.content))) {
      return `Day ${i + 1} content contains placeholder text`;
    }

    // Check for reflection if expected
    if (day.reflection) {
      if (day.reflection.trim().length < 20) {
        return `Day ${i + 1} reflection is too short`;
      }

      if (placeholderPatterns.some(pattern => pattern.test(day.reflection))) {
        return `Day ${i + 1} reflection contains placeholder text`;
      }
    }

    // Check for prayer if expected
    if (day.prayer) {
      if (day.prayer.trim().length < 10) {
        return `Day ${i + 1} prayer is too short`;
      }

      if (placeholderPatterns.some(pattern => pattern.test(day.prayer))) {
        return `Day ${i + 1} prayer contains placeholder text`;
      }
    }

    // Check for scripture if expected
    if (day.scripture) {
      if (typeof day.scripture === 'object' && day.scripture.text) {
        if (day.scripture.text.trim().length < 5) {
          return `Day ${i + 1} scripture is too short`;
        }
      } else if (typeof day.scripture === 'string') {
        if (day.scripture.trim().length < 5) {
          return `Day ${i + 1} scripture is too short`;
        }
      }
    }
  }

  // Check for overall quality indicators
  const totalContentLength = devotional.days.reduce((sum: number, day: any) => {
    return sum + (day.content ? day.content.length : 0) +
           (day.reflection ? day.reflection.length : 0) +
           (day.prayer ? day.prayer.length : 0);
  }, 0);

  const minLengthPerDay = 100; // Minimum 100 characters per day
  const expectedMinLength = expectedDuration * minLengthPerDay;

  if (totalContentLength < expectedMinLength) {
    return `Devotional content is too short overall (minimum ${expectedMinLength} characters expected)`;
  }

  return null; // Validation passed
}

/**
 * Generate a new devotional using modern Supabase session
 * This replaces the legacy generateDevotional function
 */
export async function generateDevotional(
  params: DevotionalGenerationParams,
  maxRetries: number = API_RETRY_ATTEMPTS
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

        if (user?.id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('date_of_birth')
            .eq('id', user.id)
            .single();

          if (profile?.date_of_birth) {
            dateOfBirth = profile.date_of_birth;
          }
        }

        // Fallback to age group from user metadata (onboarding)
        if (!dateOfBirth && user) {
          ageGroup = (user as any)?.user_metadata?.ageGroup;
        }
      } catch {}

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (increased for longer reflections)

      const response = await fetch(functionUrl, {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

      // Log the response for debugging
      Logger.info('Devotional API response received', {
        component: 'modernDevotionalApi',
        data: {
          daysCount: result?.days?.length || 0,
          firstDayTitle: result?.days?.[0]?.title || 'none',
          firstDayContentLength: result?.days?.[0]?.content?.length || 0,
          firstDayContentPreview: result?.days?.[0]?.content?.substring(0, 100) || 'none'
        }
      });

      // Validate the response structure
      if (!result || !Array.isArray(result.days) || result.days.length === 0) {
        throw new Error('Invalid devotional format received from server');
      }

      // Validate content completeness and quality
      const validationError = validateDevotionalCompleteness(result, duration);
      if (validationError) {
        // Log detailed info about the failed validation
        Logger.error('Devotional validation failed', {
          component: 'modernDevotionalApi',
          data: {
            validationError,
            duration,
            daysCount: result?.days?.length,
            dayDetails: result?.days?.map((day: any, index: number) => ({
              day: index + 1,
              titleLength: day?.title?.length || 0,
              contentLength: day?.content?.length || 0,
              hasTitle: !!day?.title,
              hasContent: !!day?.content,
              titlePreview: day?.title?.substring(0, 50) || 'none',
              contentPreview: day?.content?.substring(0, 100) || 'none'
            }))
          }
        });
        throw new Error(`Incomplete devotional: ${validationError}`);
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
      Logger.error(`Attempt ${attempt + 1} failed:`, {
        component: 'modernDevotionalApi',
        data: error.message,
      });

      // Handle timeout errors
      if (error.name === 'AbortError') {
        Logger.error('Request timed out after 120 seconds', undefined, {
      component: 'modernDevotionalApi',
    });
        throw new Error('Devotional generation timed out. Please try again with a shorter duration.');
      }

      // Don't retry on certain errors
      if (error.message.includes('401') || error.message.includes('403')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = API_RETRY_DELAY * Math.pow(2, attempt);

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
