/**
 * Modern Devotional Generation API
 * Uses direct Supabase session without AsyncStorage bridge
 * Follows the same pattern as playbook generation for consistency
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { AUTH_ERROR_MESSAGES, API_RETRY_ATTEMPTS, API_RETRY_DELAY } from '../constants/sessionConstants';
import { Devotional, DevotionalCategory } from '../interfaces/devotional';

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

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE0NzEsImV4cCI6MjA1MDU0NzQ3MX0.Uy4Tz2Vy8Hs7Qg8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          duration,
          playbookId,
          userInput: userInput || 'General spiritual growth',
          bibleVersion: bibleVersion || 'NASB',
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
        Logger.error('Request timed out after 60 seconds', undefined, {
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
