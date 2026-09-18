import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { authErrorHandler } from '../utils/authErrorHandler';
import { AUTH_ERROR_MESSAGES } from '../constants/sessionConstants';
import {
  updatePlaybookActionSteps as modernUpdatePlaybookActionSteps,
  deletePlaybook as modernDeletePlaybook,
  getPlaybook as modernGetPlaybook,
} from './modernPlaybookApi';
import {
  getPlaybooks as normalizedGetPlaybooks,
  calculateTaskStats as normalizedCalculateTaskStats,
} from './supabaseApiNormalized';

/**
 * Bridge functions to integrate legacy supabaseApi.ts with new authentication system
 * This ensures all API calls use the current session from IndustryStandardAuthContext
 */

/**
 * Enhanced getPlaybooks with proper auth integration
 */
export async function getPlaybooks(
  userId: string,
  options: {
    showUserFeedback?: boolean;
    onAuthRequired?: () => void;
    lightweight?: boolean;
    retryAttempts?: number;
  } = {}
): Promise<any[]> {
  const { showUserFeedback = false, onAuthRequired, lightweight = false, retryAttempts = 1 } = options;

  try {

    // Get current session from the new auth system
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      Logger.error('❌ No active session for getting playbooks', sessionError as Error, {
  component: 'apiIntegration',
});

      const result = await authErrorHandler.handleApiError(
        { status: 401, message: AUTH_ERROR_MESSAGES.NO_SESSION },
        {
          operationName: 'loading playbooks',
          showUserFeedback,
          onAuthRequired,
        }
      );

      if (!result.handled) {
        throw new Error('Authentication required for loading playbooks');
      }

      return [];
    }

    // Use normalized playbook API for accurate progress calculation
    try {
      const result = await normalizedGetPlaybooks(userId, lightweight);

      return result;
    } catch (error: any) {
      // Handle specific authentication errors
      const errorMessage = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
      if (errorMessage.includes('session') || errorMessage.includes('token')) {
        const result = await authErrorHandler.handleApiError(error, {
          operationName: 'loading playbooks',
          showUserFeedback,
          onAuthRequired,
        });

        if (!result.handled) {
          throw error;
        }

        return [];
      }

      // Re-throw non-auth errors
      throw error;
    }

  } catch (error: any) {
    Logger.error('❌ Loading playbooks failed', error as Error, {
      component: 'apiIntegration',
    });

    const result = await authErrorHandler.handleApiError(error, {
      operationName: 'loading playbooks',
      showUserFeedback,
      retryAttempts,
      onAuthRequired,
    });

    if (result.shouldRetry) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return getPlaybooks(userId, { ...options, retryAttempts: retryAttempts - 1 });
    }

    if (!result.handled) {
      throw error;
    }

    return [];
  }
}

// Direct exports of modern functions (session handled by Supabase client)
// These functions use fresh JWT tokens directly from Supabase
export const updatePlaybookActionSteps = modernUpdatePlaybookActionSteps;
export const deletePlaybook = modernDeletePlaybook;
export const getPlaybook = modernGetPlaybook;
export const calculateTaskStats = normalizedCalculateTaskStats;
