/**
 * Modern Devotional Generation API
 * Uses direct Supabase session without AsyncStorage bridge
 * Follows the same pattern as playbook generation for consistency
 */

import { supabase } from './supabaseClient';
import { AUTH_ERROR_MESSAGES, API_RETRY_ATTEMPTS, API_RETRY_DELAY } from '../constants/sessionConstants';
import { Devotional, DevotionalCategory } from '../interfaces/devotional';

interface DevotionalGenerationParams {
  duration: number;
  playbookId?: string;
  userInput?: string;
  isOnboarding?: boolean;
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
  const { duration, playbookId, userInput, isOnboarding } = params;

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
      console.log(`Generating devotional (attempt ${attempt + 1}/${maxRetries + 1})`);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE0NzEsImV4cCI6MjA1MDU0NzQ3MX0.Uy4Tz2Vy8Hs7Qg8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          duration,
          playbookId,
          userInput: userInput || 'General spiritual growth',
        }),
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
      if (!result || !Array.isArray(result.days) || result.days.length === 0) {
        throw new Error('Invalid devotional format received from server');
      }

      console.log('Devotional generated successfully, saving to database...');

      // Save the generated devotional to the database
      const { data: savedDevotional, error: saveError } = await supabase
        .from('devotionals')
        .insert({
          user_id: session.user.id,
          title: result.title || 'My Devotional',
          description: result.description || '',
          category: 'Growth', // Default category from valid list
          categories: ['Growth'], // Default categories array
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
        console.error('Error saving devotional to database:', saveError);
        throw new Error(`Failed to save devotional: ${saveError.message}`);
      }

      console.log('✅ Devotional saved to database:', savedDevotional.id);

      // Track usage for subscription after successful generation
      try {
        const { subscriptionService } = await import('./subscriptionService');
        if (session.user?.id) {
          await subscriptionService.trackUsage(session.user.id, 'devotional', 0, isOnboarding || false);
          console.log('[ModernDevotionalApi] Usage tracked for devotional generation');
        }
      } catch (trackingError) {
        console.warn('[ModernDevotionalApi] Failed to track usage:', trackingError);
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
        progress: savedDevotional.progress,
        completed: savedDevotional.completed,
        userInput: savedDevotional.user_input,
      };

    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;

      console.warn(`Devotional generation attempt ${attempt + 1} failed:`, error.message);

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
  const errorMessage = lastError?.message || 'Failed to generate devotional after multiple attempts';
  console.error('❌ All devotional generation attempts failed:', errorMessage);
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
