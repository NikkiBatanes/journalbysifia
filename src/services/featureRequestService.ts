import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

export type FeatureRequestPayload = {
  user_id: string | null;
  message: string;
  category: string;
  platform: string;
  os_version: string;
  screen: string;
  app_version?: string | null;
  extra?: any;
};

/**
 * Submit a feature request to the database
 * @throws Error with user-friendly message if submission fails
 */
export async function reportFeature(payload: FeatureRequestPayload) {
  try {
    // Validate required fields
    if (!payload.message?.trim()) {
      throw new Error('Please describe the feature before submitting.');
    }

    if (!payload.category?.trim()) {
      throw new Error('Please select a category for your feature request.');
    }

    Logger.info('Submitting feature request', {
      component: 'featureRequestService',
      user_id: payload.user_id,
      category: payload.category,
    });

    // Insert into 'feature_requests' table
    const { data, error } = await supabase
      .from('feature_requests')
      .insert({
        user_id: payload.user_id,
        message: payload.message,
        category: payload.category,
        platform: payload.platform,
        os_version: payload.os_version,
        screen: payload.screen,
        app_version: payload.app_version ?? null,
        extra: payload.extra ?? null,
      })
      .select()
      .single();

    if (error) {
      // Debug: Log the raw error to see what we're actually getting
      Logger.info('RAW SUPABASE ERROR', { error });
      Logger.info('Error type', { errorType: typeof error });
      Logger.info('Error keys', { errorKeys: Object.keys(error) });
      Logger.info('Error.code', { code: error.code });
      Logger.info('Error.message', { message: error.message });
      Logger.info('Error.details', { details: error.details });
      Logger.info('Error.hint', { hint: error.hint });
      Logger.info('Error stringified', { errorString: JSON.stringify(error) });

      // Extract meaningful error information
      const errorCode = error.code || 'UNKNOWN';
      const errorMessage = error.message || error.hint || error.details || 'Unknown database error';

      // Log detailed error for debugging
      Logger.error('Feature request submission failed', new Error(errorMessage), {
        component: 'featureRequestService',
        errorCode,
        errorMessage: error.message,
        errorHint: error.hint,
        errorDetails: error.details,
        rawError: String(error),
        payload: {
          user_id: payload.user_id,
          platform: payload.platform,
          screen: payload.screen,
          category: payload.category,
        },
      });

      // Provide user-friendly error messages based on error code
      if (errorCode === '42P01') {
        throw new Error('Feature requests are currently unavailable. Please contact support.');
      } else if (errorCode === '23505') {
        throw new Error('This feature request has already been submitted.');
      } else if (errorCode.startsWith('23')) {
        throw new Error('Invalid feature request data. Please try again.');
      } else if (errorCode.startsWith('42')) {
        throw new Error('Feature request system is not configured. Please contact support.');
      } else {
        throw new Error(errorMessage || 'Failed to submit feature request. Please try again.');
      }
    }

    Logger.info('Feature request submitted successfully', {
      component: 'featureRequestService',
      requestId: data?.id,
    });

    return data;
  } catch (error) {
    // If it's already an Error with a message, re-throw it
    if (error instanceof Error) {
      throw error;
    }

    // Otherwise, wrap it in a generic error
    Logger.error('Unexpected error in reportFeature', new Error(String(error)), {
      component: 'featureRequestService',
      errorType: typeof error,
    });

    throw new Error('Failed to submit feature request. Please check your connection and try again.');
  }
}
